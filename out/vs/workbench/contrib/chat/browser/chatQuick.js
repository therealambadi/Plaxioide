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
import * as dom from "../../../../base/browser/dom.js";
import { Orientation, Sash } from "../../../../base/browser/ui/sash/sash.js";
import { disposableTimeout } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { editorBackground, inputBackground, quickInputBackground, quickInputForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { showChatView } from "./chat.js";
import { ChatWidget } from "./chatWidget.js";
import { isCellTextEditOperation } from "../common/chatModel.js";
import { IChatService } from "../common/chatService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { EDITOR_DRAG_AND_DROP_BACKGROUND } from "../../../common/theme.js";
import { ChatAgentLocation } from "../common/constants.js";
let QuickChatService = class extends Disposable {
  constructor(quickInputService, chatService, instantiationService) {
    super();
    this.quickInputService = quickInputService;
    this.chatService = chatService;
    this.instantiationService = instantiationService;
    this._onDidClose = this._register(new Emitter());
    this.onDidClose = this._onDidClose.event;
  }
  get enabled() {
    return !!this.chatService.isEnabled(ChatAgentLocation.Panel);
  }
  get focused() {
    const widget = this._input?.widget;
    if (!widget) {
      return false;
    }
    return dom.isAncestorOfActiveElement(widget);
  }
  toggle(options) {
    if (this.focused && !options?.query) {
      this.close();
    } else {
      this.open(options);
      if (options?.isPartialQuery) {
        const disposable = this._store.add(Event.once(this.onDidClose)(() => {
          this._currentChat?.clearValue();
          this._store.delete(disposable);
        }));
      }
    }
  }
  open(options) {
    if (this._input) {
      if (this._currentChat && options?.query) {
        this._currentChat.focus();
        this._currentChat.setValue(options.query, options.selection);
        if (!options.isPartialQuery) {
          this._currentChat.acceptInput();
        }
        return;
      }
      return this.focus();
    }
    const disposableStore = new DisposableStore();
    this._input = this.quickInputService.createQuickWidget();
    this._input.contextKey = "chatInputVisible";
    this._input.ignoreFocusOut = true;
    disposableStore.add(this._input);
    this._container ??= dom.$(".interactive-session");
    this._input.widget = this._container;
    this._input.show();
    if (!this._currentChat) {
      this._currentChat = this.instantiationService.createInstance(QuickChat);
      this._currentChat.render(this._container);
    } else {
      this._currentChat.show();
    }
    disposableStore.add(this._input.onDidHide(() => {
      disposableStore.dispose();
      this._currentChat.hide();
      this._input = void 0;
      this._onDidClose.fire();
    }));
    this._currentChat.focus();
    if (options?.query) {
      this._currentChat.setValue(options.query, options.selection);
      if (!options.isPartialQuery) {
        this._currentChat.acceptInput();
      }
    }
  }
  focus() {
    this._currentChat?.focus();
  }
  close() {
    this._input?.dispose();
    this._input = void 0;
  }
  async openInChatView() {
    await this._currentChat?.openChatView();
    this.close();
  }
};
QuickChatService = __decorateClass([
  __decorateParam(0, IQuickInputService),
  __decorateParam(1, IChatService),
  __decorateParam(2, IInstantiationService)
], QuickChatService);
let QuickChat = class extends Disposable {
  constructor(instantiationService, contextKeyService, chatService, layoutService, viewsService) {
    super();
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.chatService = chatService;
    this.layoutService = layoutService;
    this.viewsService = viewsService;
    this.maintainScrollTimer = this._register(new MutableDisposable());
    this._deferUpdatingDynamicLayout = false;
  }
  clear() {
    this.model?.dispose();
    this.model = void 0;
    this.updateModel();
    this.widget.inputEditor.setValue("");
  }
  focus(selection) {
    if (this.widget) {
      this.widget.focusInput();
      const value = this.widget.inputEditor.getValue();
      if (value) {
        this.widget.inputEditor.setSelection(selection ?? {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: value.length + 1
        });
      }
    }
  }
  hide() {
    this.widget.setVisible(false);
    this.maintainScrollTimer.value = disposableTimeout(() => {
      this.maintainScrollTimer.clear();
    }, 30 * 1e3);
  }
  show() {
    this.widget.setVisible(true);
    if (this._deferUpdatingDynamicLayout) {
      this._deferUpdatingDynamicLayout = false;
      this.widget.updateDynamicChatTreeItemLayout(2, this.maxHeight);
    }
    if (!this.maintainScrollTimer.value) {
      this.widget.layoutDynamicChatTreeItemMode();
    }
  }
  render(parent) {
    if (this.widget) {
      throw new Error("Cannot render quick chat twice");
    }
    const scopedInstantiationService = this._register(this.instantiationService.createChild(
      new ServiceCollection([
        IContextKeyService,
        this._register(this.contextKeyService.createScoped(parent))
      ])
    ));
    this.widget = this._register(
      scopedInstantiationService.createInstance(
        ChatWidget,
        ChatAgentLocation.Panel,
        { isQuickChat: true },
        { autoScroll: true, renderInputOnTop: true, renderStyle: "compact", menus: { inputSideToolbar: MenuId.ChatInputSide }, enableImplicitContext: true },
        {
          listForeground: quickInputForeground,
          listBackground: quickInputBackground,
          overlayBackground: EDITOR_DRAG_AND_DROP_BACKGROUND,
          inputEditorBackground: inputBackground,
          resultEditorBackground: editorBackground
        }
      )
    );
    this.widget.render(parent);
    this.widget.setVisible(true);
    this.widget.setDynamicChatTreeItemLayout(2, this.maxHeight);
    this.updateModel();
    this.sash = this._register(new Sash(parent, { getHorizontalSashTop: () => parent.offsetHeight }, { orientation: Orientation.HORIZONTAL }));
    this.registerListeners(parent);
  }
  get maxHeight() {
    return this.layoutService.mainContainerDimension.height - QuickChat.DEFAULT_HEIGHT_OFFSET;
  }
  registerListeners(parent) {
    this._register(this.layoutService.onDidLayoutMainContainer(() => {
      if (this.widget.visible) {
        this.widget.updateDynamicChatTreeItemLayout(2, this.maxHeight);
      } else {
        this._deferUpdatingDynamicLayout = true;
      }
    }));
    this._register(this.widget.inputEditor.onDidChangeModelContent((e) => {
      this._currentQuery = this.widget.inputEditor.getValue();
    }));
    this._register(this.widget.onDidClear(() => this.clear()));
    this._register(this.widget.onDidChangeHeight((e) => this.sash.layout()));
    const width = parent.offsetWidth;
    this._register(this.sash.onDidStart(() => {
      this.widget.isDynamicChatTreeItemLayoutEnabled = false;
    }));
    this._register(this.sash.onDidChange((e) => {
      if (e.currentY < QuickChat.DEFAULT_MIN_HEIGHT || e.currentY > this.maxHeight) {
        return;
      }
      this.widget.layout(e.currentY, width);
      this.sash.layout();
    }));
    this._register(this.sash.onDidReset(() => {
      this.widget.isDynamicChatTreeItemLayoutEnabled = true;
      this.widget.layoutDynamicChatTreeItemMode();
    }));
  }
  async acceptInput() {
    return this.widget.acceptInput();
  }
  async openChatView() {
    const widget = await showChatView(this.viewsService);
    if (!widget?.viewModel || !this.model) {
      return;
    }
    for (const request of this.model.getRequests()) {
      if (request.response?.response.value || request.response?.result) {
        const message = [];
        for (const item of request.response.response.value) {
          if (item.kind === "textEditGroup") {
            for (const group of item.edits) {
              message.push({
                kind: "textEdit",
                edits: group,
                uri: item.uri
              });
            }
          } else if (item.kind === "notebookEditGroup") {
            for (const group of item.edits) {
              if (isCellTextEditOperation(group)) {
                message.push({
                  kind: "textEdit",
                  edits: [group.edit],
                  uri: group.uri
                });
              } else {
                message.push({
                  kind: "notebookEdit",
                  edits: [group],
                  uri: item.uri
                });
              }
            }
          } else {
            message.push(item);
          }
        }
        this.chatService.addCompleteRequest(
          widget.viewModel.sessionId,
          request.message,
          request.variableData,
          request.attempt,
          {
            message,
            result: request.response.result,
            followups: request.response.followups
          }
        );
      } else if (request.message) {
      }
    }
    const value = this.widget.inputEditor.getValue();
    if (value) {
      widget.inputEditor.setValue(value);
    }
    widget.focusInput();
  }
  setValue(value, selection) {
    this.widget.inputEditor.setValue(value);
    this.focus(selection);
  }
  clearValue() {
    this.widget.inputEditor.setValue("");
  }
  updateModel() {
    this.model ??= this.chatService.startSession(ChatAgentLocation.Panel, CancellationToken.None);
    if (!this.model) {
      throw new Error("Could not start chat session");
    }
    this.widget.setModel(this.model, { inputValue: this._currentQuery });
  }
};
// TODO@TylerLeonhardt: be responsive to window size
QuickChat.DEFAULT_MIN_HEIGHT = 200;
QuickChat.DEFAULT_HEIGHT_OFFSET = 100;
QuickChat = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IChatService),
  __decorateParam(3, ILayoutService),
  __decorateParam(4, IViewsService)
], QuickChat);
export {
  QuickChatService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFF1aWNrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgT3JpZW50YXRpb24sIFNhc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2FzaC9zYXNoLmpzJztcbmltcG9ydCB7IGRpc3Bvc2FibGVUaW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBlZGl0b3JCYWNrZ3JvdW5kLCBpbnB1dEJhY2tncm91bmQsIHF1aWNrSW5wdXRCYWNrZ3JvdW5kLCBxdWlja0lucHV0Rm9yZWdyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElRdWlja0NoYXRPcGVuT3B0aW9ucywgSVF1aWNrQ2hhdFNlcnZpY2UsIHNob3dDaGF0VmlldyB9IGZyb20gJy4vY2hhdC5qcyc7XG5pbXBvcnQgeyBDaGF0V2lkZ2V0IH0gZnJvbSAnLi9jaGF0V2lkZ2V0LmpzJztcbmltcG9ydCB7IENoYXRNb2RlbCwgaXNDZWxsVGV4dEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IElQYXJzZWRDaGF0UmVxdWVzdCB9IGZyb20gJy4uL2NvbW1vbi9jaGF0UGFyc2VyVHlwZXMuanMnO1xuaW1wb3J0IHsgSUNoYXRQcm9ncmVzcywgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVESVRPUl9EUkFHX0FORF9EUk9QX0JBQ0tHUk9VTkQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24gfSBmcm9tICcuLi9jb21tb24vY29uc3RhbnRzLmpzJztcblxuZXhwb3J0IGNsYXNzIFF1aWNrQ2hhdFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVF1aWNrQ2hhdFNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENsb3NlID0gdGhpcy5fb25EaWRDbG9zZS5ldmVudDtcblxuXHRwcml2YXRlIF9pbnB1dDogSVF1aWNrV2lkZ2V0IHwgdW5kZWZpbmVkO1xuXHQvLyBUT0RPQFR5bGVyTGVvbmhhcmR0OiBzdXBwb3J0IG11bHRpcGxlIGNoYXQgcHJvdmlkZXJzIGV2ZW50dWFsbHlcblx0cHJpdmF0ZSBfY3VycmVudENoYXQ6IFF1aWNrQ2hhdCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASUNoYXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGdldCBlbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuY2hhdFNlcnZpY2UuaXNFbmFibGVkKENoYXRBZ2VudExvY2F0aW9uLlBhbmVsKTtcblx0fVxuXG5cdGdldCBmb2N1c2VkKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuX2lucHV0Py53aWRnZXQgYXMgSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKCF3aWRnZXQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIGRvbS5pc0FuY2VzdG9yT2ZBY3RpdmVFbGVtZW50KHdpZGdldCk7XG5cdH1cblxuXHR0b2dnbGUob3B0aW9ucz86IElRdWlja0NoYXRPcGVuT3B0aW9ucyk6IHZvaWQge1xuXHRcdC8vIElmIHRoZSBpbnB1dCBpcyBhbHJlYWR5IHNob3duLCBoaWRlIGl0LiBUaGlzIHByb3ZpZGVzIGEgdG9nZ2xlIGJlaGF2aW9yIG9mIHRoZSBxdWlja1xuXHRcdC8vIHBpY2suIFRoaXMgc2hvdWxkIG5vdCBoYXBwZW4gd2hlbiB0aGVyZSBpcyBhIHF1ZXJ5LlxuXHRcdGlmICh0aGlzLmZvY3VzZWQgJiYgIW9wdGlvbnM/LnF1ZXJ5KSB7XG5cdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMub3BlbihvcHRpb25zKTtcblx0XHRcdC8vIElmIHRoaXMgaXMgYSBwYXJ0aWFsIHF1ZXJ5LCB0aGUgdmFsdWUgc2hvdWxkIGJlIGNsZWFyZWQgd2hlbiBjbG9zZWQgYXMgb3RoZXJ3aXNlIGl0XG5cdFx0XHQvLyB3b3VsZCByZW1haW4gZm9yIHRoZSBuZXh0IHRpbWUgdGhlIHF1aWNrIGNoYXQgaXMgb3BlbmVkIGluIGFueSBjb250ZXh0LlxuXHRcdFx0aWYgKG9wdGlvbnM/LmlzUGFydGlhbFF1ZXJ5KSB7XG5cdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0aGlzLl9zdG9yZS5hZGQoRXZlbnQub25jZSh0aGlzLm9uRGlkQ2xvc2UpKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9jdXJyZW50Q2hhdD8uY2xlYXJWYWx1ZSgpO1xuXHRcdFx0XHRcdHRoaXMuX3N0b3JlLmRlbGV0ZShkaXNwb3NhYmxlKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdG9wZW4ob3B0aW9ucz86IElRdWlja0NoYXRPcGVuT3B0aW9ucyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pbnB1dCkge1xuXHRcdFx0aWYgKHRoaXMuX2N1cnJlbnRDaGF0ICYmIG9wdGlvbnM/LnF1ZXJ5KSB7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRDaGF0LmZvY3VzKCk7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRDaGF0LnNldFZhbHVlKG9wdGlvbnMucXVlcnksIG9wdGlvbnMuc2VsZWN0aW9uKTtcblx0XHRcdFx0aWYgKCFvcHRpb25zLmlzUGFydGlhbFF1ZXJ5KSB7XG5cdFx0XHRcdFx0dGhpcy5fY3VycmVudENoYXQuYWNjZXB0SW5wdXQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcy5mb2N1cygpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdHRoaXMuX2lucHV0ID0gdGhpcy5xdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1dpZGdldCgpO1xuXHRcdHRoaXMuX2lucHV0LmNvbnRleHRLZXkgPSAnY2hhdElucHV0VmlzaWJsZSc7XG5cdFx0dGhpcy5faW5wdXQuaWdub3JlRm9jdXNPdXQgPSB0cnVlO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5faW5wdXQpO1xuXG5cdFx0dGhpcy5fY29udGFpbmVyID8/PSBkb20uJCgnLmludGVyYWN0aXZlLXNlc3Npb24nKTtcblx0XHR0aGlzLl9pbnB1dC53aWRnZXQgPSB0aGlzLl9jb250YWluZXI7XG5cblx0XHR0aGlzLl9pbnB1dC5zaG93KCk7XG5cdFx0aWYgKCF0aGlzLl9jdXJyZW50Q2hhdCkge1xuXHRcdFx0dGhpcy5fY3VycmVudENoYXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFF1aWNrQ2hhdCk7XG5cblx0XHRcdC8vIHNob3cgbmVlZHMgdG8gY29tZSBhZnRlciB0aGUgcXVpY2twaWNrIGlzIHNob3duXG5cdFx0XHR0aGlzLl9jdXJyZW50Q2hhdC5yZW5kZXIodGhpcy5fY29udGFpbmVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fY3VycmVudENoYXQuc2hvdygpO1xuXHRcdH1cblxuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5faW5wdXQub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdGRpc3Bvc2FibGVTdG9yZS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9jdXJyZW50Q2hhdCEuaGlkZSgpO1xuXHRcdFx0dGhpcy5faW5wdXQgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLl9vbkRpZENsb3NlLmZpcmUoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9jdXJyZW50Q2hhdC5mb2N1cygpO1xuXG5cdFx0aWYgKG9wdGlvbnM/LnF1ZXJ5KSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50Q2hhdC5zZXRWYWx1ZShvcHRpb25zLnF1ZXJ5LCBvcHRpb25zLnNlbGVjdGlvbik7XG5cdFx0XHRpZiAoIW9wdGlvbnMuaXNQYXJ0aWFsUXVlcnkpIHtcblx0XHRcdFx0dGhpcy5fY3VycmVudENoYXQuYWNjZXB0SW5wdXQoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0Zm9jdXMoKTogdm9pZCB7XG5cdFx0dGhpcy5fY3VycmVudENoYXQ/LmZvY3VzKCk7XG5cdH1cblx0Y2xvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5faW5wdXQ/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9pbnB1dCA9IHVuZGVmaW5lZDtcblx0fVxuXHRhc3luYyBvcGVuSW5DaGF0VmlldygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9jdXJyZW50Q2hhdD8ub3BlbkNoYXRWaWV3KCk7XG5cdFx0dGhpcy5jbG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIFF1aWNrQ2hhdCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHQvLyBUT0RPQFR5bGVyTGVvbmhhcmR0OiBiZSByZXNwb25zaXZlIHRvIHdpbmRvdyBzaXplXG5cdHN0YXRpYyBERUZBVUxUX01JTl9IRUlHSFQgPSAyMDA7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERFRkFVTFRfSEVJR0hUX09GRlNFVCA9IDEwMDtcblxuXHRwcml2YXRlIHdpZGdldCE6IENoYXRXaWRnZXQ7XG5cdHByaXZhdGUgc2FzaCE6IFNhc2g7XG5cdHByaXZhdGUgbW9kZWw6IENoYXRNb2RlbCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY3VycmVudFF1ZXJ5OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgbWFpbnRhaW5TY3JvbGxUaW1lcjogTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElEaXNwb3NhYmxlPigpKTtcblx0cHJpdmF0ZSBfZGVmZXJVcGRhdGluZ0R5bmFtaWNMYXlvdXQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNoYXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0XHRASUxheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJTGF5b3V0U2VydmljZSxcblx0XHRASVZpZXdzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHZpZXdzU2VydmljZTogSVZpZXdzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGNsZWFyKCkge1xuXHRcdHRoaXMubW9kZWw/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLm1vZGVsID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMudXBkYXRlTW9kZWwoKTtcblx0XHR0aGlzLndpZGdldC5pbnB1dEVkaXRvci5zZXRWYWx1ZSgnJyk7XG5cdH1cblxuXHRmb2N1cyhzZWxlY3Rpb24/OiBTZWxlY3Rpb24pOiB2b2lkIHtcblx0XHRpZiAodGhpcy53aWRnZXQpIHtcblx0XHRcdHRoaXMud2lkZ2V0LmZvY3VzSW5wdXQoKTtcblx0XHRcdGNvbnN0IHZhbHVlID0gdGhpcy53aWRnZXQuaW5wdXRFZGl0b3IuZ2V0VmFsdWUoKTtcblx0XHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0XHR0aGlzLndpZGdldC5pbnB1dEVkaXRvci5zZXRTZWxlY3Rpb24oc2VsZWN0aW9uID8/IHtcblx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDEsXG5cdFx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogMSxcblx0XHRcdFx0XHRlbmRDb2x1bW46IHZhbHVlLmxlbmd0aCArIDFcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aGlkZSgpOiB2b2lkIHtcblx0XHR0aGlzLndpZGdldC5zZXRWaXNpYmxlKGZhbHNlKTtcblx0XHQvLyBNYWludGFpbiBzY3JvbGwgcG9zaXRpb24gZm9yIGEgc2hvcnQgdGltZSBzbyB0aGF0IGlmIHRoZSB1c2VyIHJlLXNob3dzIHRoZSBjaGF0XG5cdFx0Ly8gdGhlIHNhbWUgc2Nyb2xsIHBvc2l0aW9uIHdpbGwgYmUgdXNlZC5cblx0XHR0aGlzLm1haW50YWluU2Nyb2xsVGltZXIudmFsdWUgPSBkaXNwb3NhYmxlVGltZW91dCgoKSA9PiB7XG5cdFx0XHQvLyBBdCB0aGlzIHBvaW50LCBjbGVhciB0aGlzIG11dGFibGUgZGlzcG9zYWJsZSB3aGljaCB3aWxsIGJlIG91ciBzaWduYWwgdGhhdFxuXHRcdFx0Ly8gdGhlIHRpbWVyIGhhcyBleHBpcmVkIGFuZCB3ZSBzaG91bGQgc3RvcCBtYWludGFpbmluZyBzY3JvbGwgcG9zaXRpb25cblx0XHRcdHRoaXMubWFpbnRhaW5TY3JvbGxUaW1lci5jbGVhcigpO1xuXHRcdH0sIDMwICogMTAwMCk7IC8vIDMwIHNlY29uZHNcblx0fVxuXG5cdHNob3coKTogdm9pZCB7XG5cdFx0dGhpcy53aWRnZXQuc2V0VmlzaWJsZSh0cnVlKTtcblx0XHQvLyBJZiB0aGUgbXV0YWJsZSBkaXNwb3NhYmxlIGlzIHNldCwgdGhlbiB3ZSBhcmUga2VlcGluZyB0aGUgZXhpc3Rpbmcgc2Nyb2xsIHBvc2l0aW9uXG5cdFx0Ly8gc28gd2Ugc2hvdWxkIG5vdCB1cGRhdGUgdGhlIGxheW91dC5cblx0XHRpZiAodGhpcy5fZGVmZXJVcGRhdGluZ0R5bmFtaWNMYXlvdXQpIHtcblx0XHRcdHRoaXMuX2RlZmVyVXBkYXRpbmdEeW5hbWljTGF5b3V0ID0gZmFsc2U7XG5cdFx0XHR0aGlzLndpZGdldC51cGRhdGVEeW5hbWljQ2hhdFRyZWVJdGVtTGF5b3V0KDIsIHRoaXMubWF4SGVpZ2h0KTtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLm1haW50YWluU2Nyb2xsVGltZXIudmFsdWUpIHtcblx0XHRcdHRoaXMud2lkZ2V0LmxheW91dER5bmFtaWNDaGF0VHJlZUl0ZW1Nb2RlKCk7XG5cdFx0fVxuXHR9XG5cblx0cmVuZGVyKHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy53aWRnZXQpIHtcblx0XHRcdC8vIE5PVEU6IGlmIHRoaXMgY2hhbmdlcywgd2UgbmVlZCB0byBtYWtlIHN1cmUgZGlzcG9zYWJsZXMgaW4gdGhpcyBmdW5jdGlvbiBhcmUgdHJhY2tlZCBkaWZmZXJlbnRseS5cblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHJlbmRlciBxdWljayBjaGF0IHR3aWNlJyk7XG5cdFx0fVxuXHRcdGNvbnN0IHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVDaGlsZChcblx0XHRcdG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbXG5cdFx0XHRcdElDb250ZXh0S2V5U2VydmljZSxcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQocGFyZW50KSlcblx0XHRcdF0pXG5cdFx0KSk7XG5cdFx0dGhpcy53aWRnZXQgPSB0aGlzLl9yZWdpc3Rlcihcblx0XHRcdHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRDaGF0V2lkZ2V0LFxuXHRcdFx0XHRDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCxcblx0XHRcdFx0eyBpc1F1aWNrQ2hhdDogdHJ1ZSB9LFxuXHRcdFx0XHR7IGF1dG9TY3JvbGw6IHRydWUsIHJlbmRlcklucHV0T25Ub3A6IHRydWUsIHJlbmRlclN0eWxlOiAnY29tcGFjdCcsIG1lbnVzOiB7IGlucHV0U2lkZVRvb2xiYXI6IE1lbnVJZC5DaGF0SW5wdXRTaWRlIH0sIGVuYWJsZUltcGxpY2l0Q29udGV4dDogdHJ1ZSB9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGlzdEZvcmVncm91bmQ6IHF1aWNrSW5wdXRGb3JlZ3JvdW5kLFxuXHRcdFx0XHRcdGxpc3RCYWNrZ3JvdW5kOiBxdWlja0lucHV0QmFja2dyb3VuZCxcblx0XHRcdFx0XHRvdmVybGF5QmFja2dyb3VuZDogRURJVE9SX0RSQUdfQU5EX0RST1BfQkFDS0dST1VORCxcblx0XHRcdFx0XHRpbnB1dEVkaXRvckJhY2tncm91bmQ6IGlucHV0QmFja2dyb3VuZCxcblx0XHRcdFx0XHRyZXN1bHRFZGl0b3JCYWNrZ3JvdW5kOiBlZGl0b3JCYWNrZ3JvdW5kXG5cdFx0XHRcdH0pKTtcblx0XHR0aGlzLndpZGdldC5yZW5kZXIocGFyZW50KTtcblx0XHR0aGlzLndpZGdldC5zZXRWaXNpYmxlKHRydWUpO1xuXHRcdHRoaXMud2lkZ2V0LnNldER5bmFtaWNDaGF0VHJlZUl0ZW1MYXlvdXQoMiwgdGhpcy5tYXhIZWlnaHQpO1xuXHRcdHRoaXMudXBkYXRlTW9kZWwoKTtcblx0XHR0aGlzLnNhc2ggPSB0aGlzLl9yZWdpc3RlcihuZXcgU2FzaChwYXJlbnQsIHsgZ2V0SG9yaXpvbnRhbFNhc2hUb3A6ICgpID0+IHBhcmVudC5vZmZzZXRIZWlnaHQgfSwgeyBvcmllbnRhdGlvbjogT3JpZW50YXRpb24uSE9SSVpPTlRBTCB9KSk7XG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycyhwYXJlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgbWF4SGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubGF5b3V0U2VydmljZS5tYWluQ29udGFpbmVyRGltZW5zaW9uLmhlaWdodCAtIFF1aWNrQ2hhdC5ERUZBVUxUX0hFSUdIVF9PRkZTRVQ7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxheW91dFNlcnZpY2Uub25EaWRMYXlvdXRNYWluQ29udGFpbmVyKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLndpZGdldC52aXNpYmxlKSB7XG5cdFx0XHRcdHRoaXMud2lkZ2V0LnVwZGF0ZUR5bmFtaWNDaGF0VHJlZUl0ZW1MYXlvdXQoMiwgdGhpcy5tYXhIZWlnaHQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gSWYgdGhlIGNoYXQgaXMgbm90IHZpc2libGUsIHRoZW4gd2Ugc2hvdWxkIGRlZmVyIHVwZGF0aW5nIHRoZSBsYXlvdXRcblx0XHRcdFx0Ly8gYmVjYXVzZSBpdCByZWxpZXMgb24gb2Zmc2V0SGVpZ2h0IHdoaWNoIG9ubHkgd29ya3MgY29ycmVjdGx5XG5cdFx0XHRcdC8vIHdoZW4gdGhlIGNoYXQgaXMgdmlzaWJsZS5cblx0XHRcdFx0dGhpcy5fZGVmZXJVcGRhdGluZ0R5bmFtaWNMYXlvdXQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndpZGdldC5pbnB1dEVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoZSkgPT4ge1xuXHRcdFx0dGhpcy5fY3VycmVudFF1ZXJ5ID0gdGhpcy53aWRnZXQuaW5wdXRFZGl0b3IuZ2V0VmFsdWUoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53aWRnZXQub25EaWRDbGVhcigoKSA9PiB0aGlzLmNsZWFyKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndpZGdldC5vbkRpZENoYW5nZUhlaWdodCgoZSkgPT4gdGhpcy5zYXNoLmxheW91dCgpKSk7XG5cdFx0Y29uc3Qgd2lkdGggPSBwYXJlbnQub2Zmc2V0V2lkdGg7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zYXNoLm9uRGlkU3RhcnQoKCkgPT4ge1xuXHRcdFx0dGhpcy53aWRnZXQuaXNEeW5hbWljQ2hhdFRyZWVJdGVtTGF5b3V0RW5hYmxlZCA9IGZhbHNlO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNhc2gub25EaWRDaGFuZ2UoKGUpID0+IHtcblx0XHRcdGlmIChlLmN1cnJlbnRZIDwgUXVpY2tDaGF0LkRFRkFVTFRfTUlOX0hFSUdIVCB8fCBlLmN1cnJlbnRZID4gdGhpcy5tYXhIZWlnaHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy53aWRnZXQubGF5b3V0KGUuY3VycmVudFksIHdpZHRoKTtcblx0XHRcdHRoaXMuc2FzaC5sYXlvdXQoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zYXNoLm9uRGlkUmVzZXQoKCkgPT4ge1xuXHRcdFx0dGhpcy53aWRnZXQuaXNEeW5hbWljQ2hhdFRyZWVJdGVtTGF5b3V0RW5hYmxlZCA9IHRydWU7XG5cdFx0XHR0aGlzLndpZGdldC5sYXlvdXREeW5hbWljQ2hhdFRyZWVJdGVtTW9kZSgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdGFzeW5jIGFjY2VwdElucHV0KCkge1xuXHRcdHJldHVybiB0aGlzLndpZGdldC5hY2NlcHRJbnB1dCgpO1xuXHR9XG5cblx0YXN5bmMgb3BlbkNoYXRWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHdpZGdldCA9IGF3YWl0IHNob3dDaGF0Vmlldyh0aGlzLnZpZXdzU2VydmljZSk7XG5cdFx0aWYgKCF3aWRnZXQ/LnZpZXdNb2RlbCB8fCAhdGhpcy5tb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgcmVxdWVzdCBvZiB0aGlzLm1vZGVsLmdldFJlcXVlc3RzKCkpIHtcblx0XHRcdGlmIChyZXF1ZXN0LnJlc3BvbnNlPy5yZXNwb25zZS52YWx1ZSB8fCByZXF1ZXN0LnJlc3BvbnNlPy5yZXN1bHQpIHtcblxuXG5cdFx0XHRcdGNvbnN0IG1lc3NhZ2U6IElDaGF0UHJvZ3Jlc3NbXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgcmVxdWVzdC5yZXNwb25zZS5yZXNwb25zZS52YWx1ZSkge1xuXHRcdFx0XHRcdGlmIChpdGVtLmtpbmQgPT09ICd0ZXh0RWRpdEdyb3VwJykge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBncm91cCBvZiBpdGVtLmVkaXRzKSB7XG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2UucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0a2luZDogJ3RleHRFZGl0Jyxcblx0XHRcdFx0XHRcdFx0XHRlZGl0czogZ3JvdXAsXG5cdFx0XHRcdFx0XHRcdFx0dXJpOiBpdGVtLnVyaVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2UgaWYgKGl0ZW0ua2luZCA9PT0gJ25vdGVib29rRWRpdEdyb3VwJykge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBncm91cCBvZiBpdGVtLmVkaXRzKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChpc0NlbGxUZXh0RWRpdE9wZXJhdGlvbihncm91cCkpIHtcblx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdFx0a2luZDogJ3RleHRFZGl0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdGVkaXRzOiBbZ3JvdXAuZWRpdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHR1cmk6IGdyb3VwLnVyaVxuXHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0XHRraW5kOiAnbm90ZWJvb2tFZGl0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdGVkaXRzOiBbZ3JvdXBdLFxuXHRcdFx0XHRcdFx0XHRcdFx0dXJpOiBpdGVtLnVyaVxuXHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdG1lc3NhZ2UucHVzaChpdGVtKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmNoYXRTZXJ2aWNlLmFkZENvbXBsZXRlUmVxdWVzdCh3aWRnZXQudmlld01vZGVsLnNlc3Npb25JZCxcblx0XHRcdFx0XHRyZXF1ZXN0Lm1lc3NhZ2UgYXMgSVBhcnNlZENoYXRSZXF1ZXN0LFxuXHRcdFx0XHRcdHJlcXVlc3QudmFyaWFibGVEYXRhLFxuXHRcdFx0XHRcdHJlcXVlc3QuYXR0ZW1wdCxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRtZXNzYWdlLFxuXHRcdFx0XHRcdFx0cmVzdWx0OiByZXF1ZXN0LnJlc3BvbnNlLnJlc3VsdCxcblx0XHRcdFx0XHRcdGZvbGxvd3VwczogcmVxdWVzdC5yZXNwb25zZS5mb2xsb3d1cHNcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSBpZiAocmVxdWVzdC5tZXNzYWdlKSB7XG5cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMud2lkZ2V0LmlucHV0RWRpdG9yLmdldFZhbHVlKCk7XG5cdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHR3aWRnZXQuaW5wdXRFZGl0b3Iuc2V0VmFsdWUodmFsdWUpO1xuXHRcdH1cblx0XHR3aWRnZXQuZm9jdXNJbnB1dCgpO1xuXHR9XG5cblx0c2V0VmFsdWUodmFsdWU6IHN0cmluZywgc2VsZWN0aW9uPzogU2VsZWN0aW9uKTogdm9pZCB7XG5cdFx0dGhpcy53aWRnZXQuaW5wdXRFZGl0b3Iuc2V0VmFsdWUodmFsdWUpO1xuXHRcdHRoaXMuZm9jdXMoc2VsZWN0aW9uKTtcblx0fVxuXG5cdGNsZWFyVmFsdWUoKTogdm9pZCB7XG5cdFx0dGhpcy53aWRnZXQuaW5wdXRFZGl0b3Iuc2V0VmFsdWUoJycpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVNb2RlbCgpOiB2b2lkIHtcblx0XHR0aGlzLm1vZGVsID8/PSB0aGlzLmNoYXRTZXJ2aWNlLnN0YXJ0U2Vzc2lvbihDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0aWYgKCF0aGlzLm1vZGVsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBzdGFydCBjaGF0IHNlc3Npb24nKTtcblx0XHR9XG5cblx0XHR0aGlzLndpZGdldC5zZXRNb2RlbCh0aGlzLm1vZGVsLCB7IGlucHV0VmFsdWU6IHRoaXMuX2N1cnJlbnRRdWVyeSB9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxhQUFhLFlBQVk7QUFDbEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxZQUFZLGlCQUE4Qix5QkFBeUI7QUFFNUUsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMEJBQXdDO0FBQ2pELFNBQVMsa0JBQWtCLGlCQUFpQixzQkFBc0IsNEJBQTRCO0FBQzlGLFNBQW1ELG9CQUFvQjtBQUN2RSxTQUFTLGtCQUFrQjtBQUMzQixTQUFvQiwrQkFBK0I7QUFFbkQsU0FBd0Isb0JBQW9CO0FBQzVDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsdUNBQXVDO0FBQ2hELFNBQVMseUJBQXlCO0FBRTNCLElBQU0sbUJBQU4sY0FBK0IsV0FBd0M7QUFBQSxFQVc3RSxZQUNzQyxtQkFDTixhQUNTLHNCQUN2QztBQUNELFVBQU07QUFKK0I7QUFDTjtBQUNTO0FBWHpDLFNBQWlCLGNBQWMsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQ2pFLFNBQVMsYUFBYSxLQUFLLFlBQVk7QUFBQSxFQWF2QztBQUFBLEVBRUEsSUFBSSxVQUFtQjtBQUN0QixXQUFPLENBQUMsQ0FBQyxLQUFLLFlBQVksVUFBVSxrQkFBa0IsS0FBSztBQUFBLEVBQzVEO0FBQUEsRUFFQSxJQUFJLFVBQW1CO0FBQ3RCLFVBQU0sU0FBUyxLQUFLLFFBQVE7QUFDNUIsUUFBSSxD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
