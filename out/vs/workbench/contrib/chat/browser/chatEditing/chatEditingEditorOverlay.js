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
import "../media/chatEditingEditorOverlay.css";
import { combinedDisposable, DisposableMap, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, derived, derivedOpts, observableFromEvent, observableSignalFromEvent, observableValue, transaction } from "../../../../../base/common/observable.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IChatEditingService, WorkingSetEntryState } from "../../common/chatEditingService.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { ActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { addDisposableGenericMouseMoveListener, append, reset } from "../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { assertType } from "../../../../../base/common/types.js";
import { localize } from "../../../../../nls.js";
import { AcceptAction, navigationBearingFakeActionId, RejectAction } from "./chatEditingEditorActions.js";
import { IChatService } from "../../common/chatService.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { EditorGroupView } from "../../../../browser/parts/editor/editorGroupView.js";
import { Event } from "../../../../../base/common/event.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../common/editor.js";
import { IInlineChatSessionService } from "../../../inlineChat/browser/inlineChatSessionService.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { ObservableEditorSession } from "./chatEditingEditorContextKeys.js";
import { rcut } from "../../../../../base/common/strings.js";
let ChatEditorOverlayWidget = class {
  constructor(_editor, _chatService, instaService) {
    this._editor = _editor;
    this._chatService = _chatService;
    this._showStore = new DisposableStore();
    this._session = observableValue(this, void 0);
    this._entry = observableValue(this, void 0);
    this._navigationBearings = observableValue(this, { changeCount: -1, activeIdx: -1, entriesCount: -1 });
    this._domNode = document.createElement("div");
    this._domNode.classList.add("chat-editor-overlay-widget");
    const progressNode = document.createElement("div");
    progressNode.classList.add("chat-editor-overlay-progress");
    append(progressNode, renderIcon(ThemeIcon.modify(Codicon.loading, "spin")));
    this._domNode.appendChild(progressNode);
    const toolbarNode = document.createElement("div");
    toolbarNode.classList.add("chat-editor-overlay-toolbar");
    this._domNode.appendChild(toolbarNode);
    this._toolbar = instaService.createInstance(MenuWorkbenchToolBar, toolbarNode, MenuId.ChatEditingEditorContent, {
      telemetrySource: "chatEditor.overlayToolbar",
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      toolbarOptions: {
        primaryGroup: () => true,
        useSeparatorsInPrimaryActions: true
      },
      menuOptions: { renderShortTitle: true },
      actionViewItemProvider: (action, options) => {
        const that = this;
        if (action.id === navigationBearingFakeActionId) {
          return new class extends ActionViewItem {
            constructor() {
              super(void 0, action, { ...options, icon: false, label: true, keybindingNotRenderedWithLabel: true });
            }
            render(container) {
              super.render(container);
              container.classList.add("label-item");
              this._store.add(autorun((r) => {
                assertType(this.label);
                const { changeCount, activeIdx } = that._navigationBearings.read(r);
                if (changeCount > 0) {
                  const n = activeIdx === -1 ? "1" : `${activeIdx + 1}`;
                  this.label.innerText = localize("nOfM", "{0} of {1}", n, changeCount);
                } else {
                  this.label.innerText = localize("0Of0", "0 of 0");
                }
                this.updateTooltip();
              }));
            }
            getTooltip() {
              const { changeCount, entriesCount } = that._navigationBearings.get();
              if (changeCount === -1 || entriesCount === -1) {
                return void 0;
              } else if (changeCount === 1 && entriesCount === 1) {
                return localize("tooltip_11", "1 change in 1 file");
              } else if (changeCount === 1) {
                return localize("tooltip_1n", "1 change in {0} files", entriesCount);
              } else if (entriesCount === 1) {
                return localize("tooltip_n1", "{0} changes in 1 file", changeCount);
              } else {
                return localize("tooltip_nm", "{0} changes in {1} files", changeCount, entriesCount);
              }
            }
          }();
        }
        if (action.id === AcceptAction.ID || action.id === RejectAction.ID) {
          return new class extends ActionViewItem {
            constructor() {
              super(void 0, action, { ...options, icon: false, label: true, keybindingNotRenderedWithLabel: true });
              this._reveal = this._store.add(new MutableDisposable());
            }
            render(container) {
              super.render(container);
              if (action.id === AcceptAction.ID) {
                const listener = this._store.add(new MutableDisposable());
                this._store.add(autorun((r) => {
                  assertType(this.label);
                  assertType(this.element);
                  const ctrl = that._entry.read(r)?.autoAcceptController.read(r);
                  if (ctrl) {
                    const r2 = -100 * (ctrl.remaining / ctrl.total);
                    this.element.style.setProperty("--vscode-action-item-auto-timeout", `${r2}%`);
                    this.element.classList.toggle("auto", true);
                    listener.value = addDisposableGenericMouseMoveListener(this.element, () => ctrl.cancel());
                  } else {
                    this.element.classList.toggle("auto", false);
                    listener.clear();
                  }
                }));
              }
            }
            set actionRunner(actionRunner) {
              super.actionRunner = actionRunner;
              this._reveal.value = actionRunner.onWillRun((_e) => {
                that._editor.focus();
              });
            }
            get actionRunner() {
              return super.actionRunner;
            }
          }();
        }
        if (action.id === "inlineChat2.reveal" || action.id === "workbench.action.chat.openEditSession") {
          return new class extends ActionViewItem {
            constructor() {
              super(void 0, action, options);
              this._requestMessage = derived((r) => {
                const session = that._session.read(r);
                const chatModel = that._chatService.getSession(session?.chatSessionId ?? "");
                if (!session || !chatModel) {
                  return void 0;
                }
                const response = that._entry.read(r)?.isCurrentlyBeingModifiedBy.read(r);
                if (response) {
                  if (response?.isPaused.read(r)) {
                    return { message: localize("paused", "Edits Paused"), paused: true };
                  }
                  const entry = that._entry.read(r);
                  if (entry) {
                    const progress = entry?.rewriteRatio.read(r);
                    const message = progress === 0 ? localize("generating", "Generating edits") : localize("applyingPercentage", "{0}% Applying edits", Math.round(progress * 100));
                    return { message };
                  }
                }
                if (session.isGlobalEditingSession) {
                  return void 0;
                }
                const request = observableFromEvent(this, chatModel.onDidChange, () => chatModel.getRequests().at(-1)).read(r);
                if (!request || request.response?.isComplete) {
                  return void 0;
                }
                return { message: request.message.text };
              });
            }
            render(container) {
              super.render(container);
              container.classList.add("label-item");
              this._store.add(autorun((r) => {
                assertType(this.label);
                const value = this._requestMessage.read(r);
                if (!value) {
                  this.options.icon = true;
                  this.options.label = false;
                  reset(this.label);
                  this.updateClass();
                  this.updateLabel();
                  this.updateTooltip();
                } else {
                  this.options.icon = false;
                  this.options.label = true;
                  this.updateClass();
                  this.updateTooltip();
                  const message = rcut(value.message, 47);
                  reset(this.label, message);
                }
                const busy = Boolean(value && !value.paused);
                that._domNode.classList.toggle("busy", busy);
                this.label.classList.toggle("busy", busy);
              }));
            }
            getTooltip() {
              return this._requestMessage.get()?.message || super.getTooltip();
            }
          }();
        }
        return void 0;
      }
    });
  }
  dispose() {
    this.hide();
    this._showStore.dispose();
    this._toolbar.dispose();
  }
  getDomNode() {
    return this._domNode;
  }
  show(session, entry, indicies) {
    this._showStore.clear();
    transaction((tx) => {
      this._session.set(session, tx);
      this._entry.set(entry, tx);
    });
    this._showStore.add(autorun((r) => {
      const entryIndex = indicies.entryIndex.read(r);
      const changeIndex = indicies.changeIndex.read(r);
      const entries = session.entries.read(r);
      let activeIdx = entryIndex !== void 0 && changeIndex !== void 0 ? changeIndex : -1;
      let totalChangesCount = 0;
      for (let i = 0; i < entries.length; i++) {
        const changesCount = entries[i].changesCount.read(r);
        totalChangesCount += changesCount;
        if (entryIndex !== void 0 && i < entryIndex) {
          activeIdx += changesCount;
        }
      }
      this._navigationBearings.set({ changeCount: totalChangesCount, activeIdx, entriesCount: entries.length }, void 0);
    }));
  }
  hide() {
    transaction((tx) => {
      this._session.set(void 0, tx);
      this._entry.set(void 0, tx);
      this._navigationBearings.set({ changeCount: -1, activeIdx: -1, entriesCount: -1 }, tx);
    });
    this._showStore.clear();
  }
};
ChatEditorOverlayWidget = __decorateClass([
  __decorateParam(1, IChatService),
  __decorateParam(2, IInstantiationService)
], ChatEditorOverlayWidget);
let ChatEditingOverlayController = class {
  constructor(container, group, instaService, chatService, chatEditingService, inlineChatService) {
    this._store = new DisposableStore();
    this._domNode = document.createElement("div");
    this._domNode.classList.add("chat-editing-editor-overlay");
    this._domNode.style.position = "absolute";
    this._domNode.style.bottom = `24px`;
    this._domNode.style.right = `24px`;
    this._domNode.style.zIndex = `100`;
    const widget = instaService.createInstance(ChatEditorOverlayWidget, group);
    this._domNode.appendChild(widget.getDomNode());
    this._store.add(toDisposable(() => this._domNode.remove()));
    this._store.add(widget);
    const show = () => {
      if (!container.contains(this._domNode)) {
        container.appendChild(this._domNode);
      }
    };
    const hide = () => {
      if (container.contains(this._domNode)) {
        widget.hide();
        this._domNode.remove();
      }
    };
    const activeEditorSignal = observableSignalFromEvent(this, Event.any(group.onDidActiveEditorChange, group.onDidModelChange));
    const activeUriObs = derivedOpts({ equalsFn: isEqual }, (r) => {
      activeEditorSignal.read(r);
      const editor = group.activeEditorPane;
      const uri = EditorResourceAccessor.getOriginalUri(editor?.input, { supportSideBySide: SideBySideEditor.PRIMARY });
      return uri;
    });
    const sessionAndEntry = derived((r) => {
      activeEditorSignal.read(r);
      const uri = activeUriObs.read(r);
      if (!uri) {
        return void 0;
      }
      return new ObservableEditorSession(uri, chatEditingService, inlineChatService).value.read(r);
    });
    const isInProgress = derived((r) => {
      const session = sessionAndEntry.read(r)?.session;
      if (!session) {
        return false;
      }
      const chatModel = chatService.getSession(session.chatSessionId);
      const lastResponse = observableFromEvent(this, chatModel.onDidChange, () => chatModel.getRequests().at(-1)?.response);
      const response = lastResponse.read(r);
      if (!response) {
        return false;
      }
      return observableFromEvent(this, response.onDidChange, () => !response.isComplete).read(r);
    });
    this._store.add(autorun((r) => {
      const data = sessionAndEntry.read(r);
      if (!data) {
        hide();
        return;
      }
      const { session, entry } = data;
      if (entry?.state.read(r) === WorkingSetEntryState.Modified || !session.isGlobalEditingSession && isInProgress.read(r)) {
        const editorPane = group.activeEditorPane;
        assertType(editorPane);
        const changeIndex = derived((r2) => entry ? entry.getEditorIntegration(editorPane).currentIndex.read(r2) : 0);
        const entryIndex = derived(
          (r2) => entry ? session.entries.read(r2).indexOf(entry) : 0
        );
        widget.show(session, entry, { entryIndex, changeIndex });
        show();
      } else {
        hide();
      }
    }));
  }
  dispose() {
    this._store.dispose();
  }
};
ChatEditingOverlayController = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IChatService),
  __decorateParam(4, IChatEditingService),
  __decorateParam(5, IInlineChatSessionService)
], ChatEditingOverlayController);
let ChatEditingEditorOverlay = class {
  constructor(editorGroupsService, instantiationService) {
    this._store = new DisposableStore();
    const editorGroups = observableFromEvent(
      this,
      Event.any(editorGroupsService.onDidAddGroup, editorGroupsService.onDidRemoveGroup),
      () => editorGroupsService.groups
    );
    const overlayWidgets = new DisposableMap();
    this._store.add(autorun((r) => {
      const toDelete = new Set(overlayWidgets.keys());
      const groups = editorGroups.read(r);
      for (const group of groups) {
        if (!(group instanceof EditorGroupView)) {
          continue;
        }
        toDelete.delete(group);
        if (!overlayWidgets.has(group)) {
          const scopedInstaService = instantiationService.createChild(
            new ServiceCollection([IContextKeyService, group.scopedContextKeyService])
          );
          const container = group.element;
          const ctrl = scopedInstaService.createInstance(ChatEditingOverlayController, container, group);
          overlayWidgets.set(group, combinedDisposable(ctrl, scopedInstaService));
        }
      }
      for (const group of toDelete) {
        overlayWidgets.deleteAndDispose(group);
      }
    }));
  }
  dispose() {
    this._store.dispose();
  }
};
ChatEditingEditorOverlay.ID = "chat.edits.editorOverlay";
ChatEditingEditorOverlay = __decorateClass([
  __decorateParam(0, IEditorGroupsService),
  __decorateParam(1, IInstantiationService)
], ChatEditingEditorOverlay);
export {
  ChatEditingEditorOverlay
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdFZGl0b3JPdmVybGF5LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuLi9tZWRpYS9jaGF0RWRpdGluZ0VkaXRvck92ZXJsYXkuY3NzJztcbmltcG9ydCB7IGNvbWJpbmVkRGlzcG9zYWJsZSwgRGlzcG9zYWJsZU1hcCwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGF1dG9ydW4sIGRlcml2ZWQsIGRlcml2ZWRPcHRzLCBJT2JzZXJ2YWJsZSwgb2JzZXJ2YWJsZUZyb21FdmVudCwgb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudCwgb2JzZXJ2YWJsZVZhbHVlLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSGlkZGVuSXRlbVN0cmF0ZWd5LCBNZW51V29ya2JlbmNoVG9vbEJhciwgV29ya2JlbmNoVG9vbEJhciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci90b29sYmFyLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUNoYXRFZGl0aW5nU2VydmljZSwgSUNoYXRFZGl0aW5nU2Vzc2lvbiwgSU1vZGlmaWVkRmlsZUVudHJ5LCBXb3JraW5nU2V0RW50cnlTdGF0ZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCB7IElBY3Rpb25SdW5uZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IGFkZERpc3Bvc2FibGVHZW5lcmljTW91c2VNb3ZlTGlzdGVuZXIsIGFwcGVuZCwgcmVzZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IHJlbmRlckljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaWNvbkxhYmVsL2ljb25MYWJlbHMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWNjZXB0QWN0aW9uLCBuYXZpZ2F0aW9uQmVhcmluZ0Zha2VBY3Rpb25JZCwgUmVqZWN0QWN0aW9uIH0gZnJvbSAnLi9jaGF0RWRpdGluZ0VkaXRvckFjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXAsIElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVkaXRvckdyb3VwVmlldyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvckdyb3VwVmlldy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBTaWRlQnlTaWRlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vaW5saW5lQ2hhdC9icm93c2VyL2lubGluZUNoYXRTZXNzaW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IE9ic2VydmFibGVFZGl0b3JTZXNzaW9uIH0gZnJvbSAnLi9jaGF0RWRpdGluZ0VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IHJjdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcblxuY2xhc3MgQ2hhdEVkaXRvck92ZXJsYXlXaWRnZXQge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RvbU5vZGU6IEhUTUxFbGVtZW50O1xuXHQvLyBwcml2YXRlIHJlYWRvbmx5IF9wcm9ncmVzc05vZGU6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF90b29sYmFyOiBXb3JrYmVuY2hUb29sQmFyO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Nob3dTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zZXNzaW9uID0gb2JzZXJ2YWJsZVZhbHVlPElDaGF0RWRpdGluZ1Nlc3Npb24gfCB1bmRlZmluZWQ+KHRoaXMsIHVuZGVmaW5lZCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VudHJ5ID0gb2JzZXJ2YWJsZVZhbHVlPElNb2RpZmllZEZpbGVFbnRyeSB8IHVuZGVmaW5lZD4odGhpcywgdW5kZWZpbmVkKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9uYXZpZ2F0aW9uQmVhcmluZ3MgPSBvYnNlcnZhYmxlVmFsdWU8eyBjaGFuZ2VDb3VudDogbnVtYmVyOyBhY3RpdmVJZHg6IG51bWJlcjsgZW50cmllc0NvdW50OiBudW1iZXIgfT4odGhpcywgeyBjaGFuZ2VDb3VudDogLTEsIGFjdGl2ZUlkeDogLTEsIGVudHJpZXNDb3VudDogLTEgfSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiB7IGZvY3VzKCk6IHZvaWQgfSxcblx0XHRASUNoYXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5fZG9tTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuX2RvbU5vZGUuY2xhc3NMaXN0LmFkZCgnY2hhdC1lZGl0b3Itb3ZlcmxheS13aWRnZXQnKTtcblxuXHRcdGNvbnN0IHByb2dyZXNzTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHByb2dyZXNzTm9kZS5jbGFzc0xpc3QuYWRkKCdjaGF0LWVkaXRvci1vdmVybGF5LXByb2dyZXNzJyk7XG5cdFx0YXBwZW5kKHByb2dyZXNzTm9kZSwgcmVuZGVySWNvbihUaGVtZUljb24ubW9kaWZ5KENvZGljb24ubG9hZGluZywgJ3NwaW4nKSkpO1xuXHRcdHRoaXMuX2RvbU5vZGUuYXBwZW5kQ2hpbGQocHJvZ3Jlc3NOb2RlKTtcblxuXHRcdGNvbnN0IHRvb2xiYXJOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dG9vbGJhck5vZGUuY2xhc3NMaXN0LmFkZCgnY2hhdC1lZGl0b3Itb3ZlcmxheS10b29sYmFyJyk7XG5cdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmRDaGlsZCh0b29sYmFyTm9kZSk7XG5cblx0XHR0aGlzLl90b29sYmFyID0gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVXb3JrYmVuY2hUb29sQmFyLCB0b29sYmFyTm9kZSwgTWVudUlkLkNoYXRFZGl0aW5nRWRpdG9yQ29udGVudCwge1xuXHRcdFx0dGVsZW1ldHJ5U291cmNlOiAnY2hhdEVkaXRvci5vdmVybGF5VG9vbGJhcicsXG5cdFx0XHRoaWRkZW5JdGVtU3RyYXRlZ3k6IEhpZGRlbkl0ZW1TdHJhdGVneS5JZ25vcmUsXG5cdFx0XHR0b29sYmFyT3B0aW9uczoge1xuXHRcdFx0XHRwcmltYXJ5R3JvdXA6ICgpID0+IHRydWUsXG5cdFx0XHRcdHVzZVNlcGFyYXRvcnNJblByaW1hcnlBY3Rpb25zOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0bWVudU9wdGlvbnM6IHsgcmVuZGVyU2hvcnRUaXRsZTogdHJ1ZSB9LFxuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbiwgb3B0aW9ucykgPT4ge1xuXHRcdFx0XHRjb25zdCB0aGF0ID0gdGhpcztcblxuXHRcdFx0XHRpZiAoYWN0aW9uLmlkID09PSBuYXZpZ2F0aW9uQmVhcmluZ0Zha2VBY3Rpb25JZCkge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgY2xhc3MgZXh0ZW5kcyBBY3Rpb25WaWV3SXRlbSB7XG5cblx0XHRcdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdFx0XHRzdXBlcih1bmRlZmluZWQsIGFjdGlvbiwgeyAuLi5vcHRpb25zLCBpY29uOiBmYWxzZSwgbGFiZWw6IHRydWUsIGtleWJpbmRpbmdOb3RSZW5kZXJlZFdpdGhMYWJlbDogdHJ1ZSB9KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cblx0XHRcdFx0XHRcdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2xhYmVsLWl0ZW0nKTtcblxuXHRcdFx0XHRcdFx0XHR0aGlzLl9zdG9yZS5hZGQoYXV0b3J1bihyID0+IHtcblx0XHRcdFx0XHRcdFx0XHRhc3NlcnRUeXBlKHRoaXMubGFiZWwpO1xuXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgeyBjaGFuZ2VDb3VudCwgYWN0aXZlSWR4IH0gPSB0aGF0Ll9uYXZpZ2F0aW9uQmVhcmluZ3MucmVhZChyKTtcblxuXHRcdFx0XHRcdFx0XHRcdGlmIChjaGFuZ2VDb3VudCA+IDApIHtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IG4gPSBhY3RpdmVJZHggPT09IC0xID8gJzEnIDogYCR7YWN0aXZlSWR4ICsgMX1gO1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5sYWJlbC5pbm5lclRleHQgPSBsb2NhbGl6ZSgnbk9mTScsIFwiezB9IG9mIHsxfVwiLCBuLCBjaGFuZ2VDb3VudCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMubGFiZWwuaW5uZXJUZXh0ID0gbG9jYWxpemUoJzBPZjAnLCBcIjAgb2YgMFwiKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVRvb2x0aXAoKTtcblx0XHRcdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0VG9vbHRpcCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB7IGNoYW5nZUNvdW50LCBlbnRyaWVzQ291bnQgfSA9IHRoYXQuX25hdmlnYXRpb25CZWFyaW5ncy5nZXQoKTtcblx0XHRcdFx0XHRcdFx0aWYgKGNoYW5nZUNvdW50ID09PSAtMSB8fCBlbnRyaWVzQ291bnQgPT09IC0xKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmIChjaGFuZ2VDb3VudCA9PT0gMSAmJiBlbnRyaWVzQ291bnQgPT09IDEpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3Rvb2x0aXBfMTEnLCBcIjEgY2hhbmdlIGluIDEgZmlsZVwiKTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmIChjaGFuZ2VDb3VudCA9PT0gMSkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgndG9vbHRpcF8xbicsIFwiMSBjaGFuZ2UgaW4gezB9IGZpbGVzXCIsIGVudHJpZXNDb3VudCk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoZW50cmllc0NvdW50ID09PSAxKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0b29sdGlwX24xJywgXCJ7MH0gY2hhbmdlcyBpbiAxIGZpbGVcIiwgY2hhbmdlQ291bnQpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgndG9vbHRpcF9ubScsIFwiezB9IGNoYW5nZXMgaW4gezF9IGZpbGVzXCIsIGNoYW5nZUNvdW50LCBlbnRyaWVzQ291bnQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChhY3Rpb24uaWQgPT09IEFjY2VwdEFjdGlvbi5JRCB8fCBhY3Rpb24uaWQgPT09IFJlamVjdEFjdGlvbi5JRCkge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgY2xhc3MgZXh0ZW5kcyBBY3Rpb25WaWV3SXRlbSB7XG5cblx0XHRcdFx0XHRcdHByaXZhdGUgcmVhZG9ubHkgX3JldmVhbCA9IHRoaXMuX3N0b3JlLmFkZChuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0XHRcdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdFx0XHRzdXBlcih1bmRlZmluZWQsIGFjdGlvbiwgeyAuLi5vcHRpb25zLCBpY29uOiBmYWxzZSwgbGFiZWw6IHRydWUsIGtleWJpbmRpbmdOb3RSZW5kZXJlZFdpdGhMYWJlbDogdHJ1ZSB9KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRcdFx0XHRcdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cblx0XHRcdFx0XHRcdFx0aWYgKGFjdGlvbi5pZCA9PT0gQWNjZXB0QWN0aW9uLklEKSB7XG5cblx0XHRcdFx0XHRcdFx0XHRjb25zdCBsaXN0ZW5lciA9IHRoaXMuX3N0b3JlLmFkZChuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0XHRcdFx0XHRcdFx0XHR0aGlzLl9zdG9yZS5hZGQoYXV0b3J1bihyID0+IHtcblxuXHRcdFx0XHRcdFx0XHRcdFx0YXNzZXJ0VHlwZSh0aGlzLmxhYmVsKTtcblx0XHRcdFx0XHRcdFx0XHRcdGFzc2VydFR5cGUodGhpcy5lbGVtZW50KTtcblxuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgY3RybCA9IHRoYXQuX2VudHJ5LnJlYWQocik/LmF1dG9BY2NlcHRDb250cm9sbGVyLnJlYWQocik7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoY3RybCkge1xuXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHIgPSAtMTAwICogKGN0cmwucmVtYWluaW5nIC8gY3RybC50b3RhbCk7XG5cblx0XHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KCctLXZzY29kZS1hY3Rpb24taXRlbS1hdXRvLXRpbWVvdXQnLCBgJHtyfSVgKTtcblxuXHRcdFx0XHRcdFx0XHRcdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnYXV0bycsIHRydWUpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRsaXN0ZW5lci52YWx1ZSA9IGFkZERpc3Bvc2FibGVHZW5lcmljTW91c2VNb3ZlTGlzdGVuZXIodGhpcy5lbGVtZW50LCAoKSA9PiBjdHJsLmNhbmNlbCgpKTtcblx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdhdXRvJywgZmFsc2UpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRsaXN0ZW5lci5jbGVhcigpO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRvdmVycmlkZSBzZXQgYWN0aW9uUnVubmVyKGFjdGlvblJ1bm5lcjogSUFjdGlvblJ1bm5lcikge1xuXHRcdFx0XHRcdFx0XHRzdXBlci5hY3Rpb25SdW5uZXIgPSBhY3Rpb25SdW5uZXI7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3JldmVhbC52YWx1ZSA9IGFjdGlvblJ1bm5lci5vbldpbGxSdW4oX2UgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdHRoYXQuX2VkaXRvci5mb2N1cygpO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdG92ZXJyaWRlIGdldCBhY3Rpb25SdW5uZXIoKTogSUFjdGlvblJ1bm5lciB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBzdXBlci5hY3Rpb25SdW5uZXI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChhY3Rpb24uaWQgPT09ICdpbmxpbmVDaGF0Mi5yZXZlYWwnIHx8IGFjdGlvbi5pZCA9PT0gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5vcGVuRWRpdFNlc3Npb24nKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBjbGFzcyBleHRlbmRzIEFjdGlvblZpZXdJdGVtIHtcblxuXHRcdFx0XHRcdFx0cHJpdmF0ZSBfcmVxdWVzdE1lc3NhZ2U6IElPYnNlcnZhYmxlPHsgbWVzc2FnZTogc3RyaW5nOyBwYXVzZWQ/OiBib29sZWFuIH0gfCB1bmRlZmluZWQ+O1xuXG5cdFx0XHRcdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0XHRcdFx0c3VwZXIodW5kZWZpbmVkLCBhY3Rpb24sIG9wdGlvbnMpO1xuXG5cdFx0XHRcdFx0XHRcdHRoaXMuX3JlcXVlc3RNZXNzYWdlID0gZGVyaXZlZChyID0+IHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBzZXNzaW9uID0gdGhhdC5fc2Vzc2lvbi5yZWFkKHIpO1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGNoYXRNb2RlbCA9IHRoYXQuX2NoYXRTZXJ2aWNlLmdldFNlc3Npb24oc2Vzc2lvbj8uY2hhdFNlc3Npb25JZCA/PyAnJyk7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKCFzZXNzaW9uIHx8ICFjaGF0TW9kZWwpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgcmVzcG9uc2UgPSB0aGF0Ll9lbnRyeS5yZWFkKHIpPy5pc0N1cnJlbnRseUJlaW5nTW9kaWZpZWRCeS5yZWFkKHIpO1xuXG5cdFx0XHRcdFx0XHRcdFx0aWYgKHJlc3BvbnNlKSB7XG5cblx0XHRcdFx0XHRcdFx0XHRcdGlmIChyZXNwb25zZT8uaXNQYXVzZWQucmVhZChyKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4geyBtZXNzYWdlOiBsb2NhbGl6ZSgncGF1c2VkJywgXCJFZGl0cyBQYXVzZWRcIiksIHBhdXNlZDogdHJ1ZSB9O1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBlbnRyeSA9IHRoYXQuX2VudHJ5LnJlYWQocik7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoZW50cnkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgcHJvZ3Jlc3MgPSBlbnRyeT8ucmV3cml0ZVJhdGlvLnJlYWQocik7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBwcm9ncmVzcyA9PT0gMFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gbG9jYWxpemUoJ2dlbmVyYXRpbmcnLCBcIkdlbmVyYXRpbmcgZWRpdHNcIilcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ6IGxvY2FsaXplKCdhcHBseWluZ1BlcmNlbnRhZ2UnLCBcInswfSUgQXBwbHlpbmcgZWRpdHNcIiwgTWF0aC5yb3VuZChwcm9ncmVzcyAqIDEwMCkpO1xuXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiB7IG1lc3NhZ2UgfTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHRpZiAoc2Vzc2lvbi5pc0dsb2JhbEVkaXRpbmdTZXNzaW9uKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJlcXVlc3QgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsIGNoYXRNb2RlbC5vbkRpZENoYW5nZSwgKCkgPT4gY2hhdE1vZGVsLmdldFJlcXVlc3RzKCkuYXQoLTEpKS5yZWFkKHIpO1xuXHRcdFx0XHRcdFx0XHRcdGlmICghcmVxdWVzdCB8fCByZXF1ZXN0LnJlc3BvbnNlPy5pc0NvbXBsZXRlKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4geyBtZXNzYWdlOiByZXF1ZXN0Lm1lc3NhZ2UudGV4dCB9O1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cblx0XHRcdFx0XHRcdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2xhYmVsLWl0ZW0nKTtcblxuXHRcdFx0XHRcdFx0XHR0aGlzLl9zdG9yZS5hZGQoYXV0b3J1bihyID0+IHtcblx0XHRcdFx0XHRcdFx0XHRhc3NlcnRUeXBlKHRoaXMubGFiZWwpO1xuXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgdmFsdWUgPSB0aGlzLl9yZXF1ZXN0TWVzc2FnZS5yZWFkKHIpO1xuXHRcdFx0XHRcdFx0XHRcdGlmICghdmFsdWUpIHtcblx0XHRcdFx0XHRcdFx0XHRcdC8vIG5vcm1hbCByZW5kZXJpbmdcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMub3B0aW9ucy5pY29uID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMub3B0aW9ucy5sYWJlbCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRcdFx0cmVzZXQodGhpcy5sYWJlbCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZUNsYXNzKCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZUxhYmVsKCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVRvb2x0aXAoKTtcblxuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLm9wdGlvbnMuaWNvbiA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5vcHRpb25zLmxhYmVsID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMudXBkYXRlQ2xhc3MoKTtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMudXBkYXRlVG9vbHRpcCgpO1xuXG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBtZXNzYWdlID0gcmN1dCh2YWx1ZS5tZXNzYWdlLCA0Nyk7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXNldCh0aGlzLmxhYmVsLCBtZXNzYWdlKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHRjb25zdCBidXN5ID0gQm9vbGVhbih2YWx1ZSAmJiAhdmFsdWUucGF1c2VkKTtcblx0XHRcdFx0XHRcdFx0XHR0aGF0Ll9kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ2J1c3knLCBidXN5KTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmxhYmVsLmNsYXNzTGlzdC50b2dnbGUoJ2J1c3knLCBidXN5KTtcblxuXHRcdFx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHByb3RlY3RlZCBvdmVycmlkZSBnZXRUb29sdGlwKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB0aGlzLl9yZXF1ZXN0TWVzc2FnZS5nZXQoKT8ubWVzc2FnZSB8fCBzdXBlci5nZXRUb29sdGlwKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLmhpZGUoKTtcblx0XHR0aGlzLl9zaG93U3RvcmUuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3Rvb2xiYXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0Z2V0RG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvbU5vZGU7XG5cdH1cblxuXHRzaG93KHNlc3Npb246IElDaGF0RWRpdGluZ1Nlc3Npb24sIGVudHJ5OiBJTW9kaWZpZWRGaWxlRW50cnkgfCB1bmRlZmluZWQsIGluZGljaWVzOiB7IGVudHJ5SW5kZXg6IElPYnNlcnZhYmxlPG51bWJlcj47IGNoYW5nZUluZGV4OiBJT2JzZXJ2YWJsZTxudW1iZXI+IH0pIHtcblxuXHRcdHRoaXMuX3Nob3dTdG9yZS5jbGVhcigpO1xuXG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0dGhpcy5fc2Vzc2lvbi5zZXQoc2Vzc2lvbiwgdHgpO1xuXHRcdFx0dGhpcy5fZW50cnkuc2V0KGVudHJ5LCB0eCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9zaG93U3RvcmUuYWRkKGF1dG9ydW4ociA9PiB7XG5cblx0XHRcdGNvbnN0IGVudHJ5SW5kZXggPSBpbmRpY2llcy5lbnRyeUluZGV4LnJlYWQocik7XG5cdFx0XHRjb25zdCBjaGFuZ2VJbmRleCA9IGluZGljaWVzLmNoYW5nZUluZGV4LnJlYWQocik7XG5cblx0XHRcdGNvbnN0IGVudHJpZXMgPSBzZXNzaW9uLmVudHJpZXMucmVhZChyKTtcblxuXHRcdFx0bGV0IGFjdGl2ZUlkeCA9IGVudHJ5SW5kZXggIT09IHVuZGVmaW5lZCAmJiBjaGFuZ2VJbmRleCAhPT0gdW5kZWZpbmVkXG5cdFx0XHRcdD8gY2hhbmdlSW5kZXhcblx0XHRcdFx0OiAtMTtcblxuXHRcdFx0bGV0IHRvdGFsQ2hhbmdlc0NvdW50ID0gMDtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZW50cmllcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBjaGFuZ2VzQ291bnQgPSBlbnRyaWVzW2ldLmNoYW5nZXNDb3VudC5yZWFkKHIpO1xuXHRcdFx0XHR0b3RhbENoYW5nZXNDb3VudCArPSBjaGFuZ2VzQ291bnQ7XG5cblx0XHRcdFx0aWYgKGVudHJ5SW5kZXggIT09IHVuZGVmaW5lZCAmJiBpIDwgZW50cnlJbmRleCkge1xuXHRcdFx0XHRcdGFjdGl2ZUlkeCArPSBjaGFuZ2VzQ291bnQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fbmF2aWdhdGlvbkJlYXJpbmdzLnNldCh7IGNoYW5nZUNvdW50OiB0b3RhbENoYW5nZXNDb3VudCwgYWN0aXZlSWR4LCBlbnRyaWVzQ291bnQ6IGVudHJpZXMubGVuZ3RoIH0sIHVuZGVmaW5lZCk7XG5cdFx0fSkpO1xuXG5cdH1cblxuXHRoaWRlKCkge1xuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdHRoaXMuX3Nlc3Npb24uc2V0KHVuZGVmaW5lZCwgdHgpO1xuXHRcdFx0dGhpcy5fZW50cnkuc2V0KHVuZGVmaW5lZCwgdHgpO1xuXHRcdFx0dGhpcy5fbmF2aWdhdGlvbkJlYXJpbmdzLnNldCh7IGNoYW5nZUNvdW50OiAtMSwgYWN0aXZlSWR4OiAtMSwgZW50cmllc0NvdW50OiAtMSB9LCB0eCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5fc2hvd1N0b3JlLmNsZWFyKCk7XG5cdH1cbn1cblxuY2xhc3MgQ2hhdEVkaXRpbmdPdmVybGF5Q29udHJvbGxlciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZG9tTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0Z3JvdXA6IElFZGl0b3JHcm91cCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ2hhdFNlcnZpY2UgY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0XHRASUNoYXRFZGl0aW5nU2VydmljZSBjaGF0RWRpdGluZ1NlcnZpY2U6IElDaGF0RWRpdGluZ1NlcnZpY2UsXG5cdFx0QElJbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UgaW5saW5lQ2hhdFNlcnZpY2U6IElJbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2Vcblx0KSB7XG5cblx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ2NoYXQtZWRpdGluZy1lZGl0b3Itb3ZlcmxheScpO1xuXHRcdHRoaXMuX2RvbU5vZGUuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdHRoaXMuX2RvbU5vZGUuc3R5bGUuYm90dG9tID0gYDI0cHhgO1xuXHRcdHRoaXMuX2RvbU5vZGUuc3R5bGUucmlnaHQgPSBgMjRweGA7XG5cdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS56SW5kZXggPSBgMTAwYDtcblxuXHRcdGNvbnN0IHdpZGdldCA9IGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0RWRpdG9yT3ZlcmxheVdpZGdldCwgZ3JvdXApO1xuXHRcdHRoaXMuX2RvbU5vZGUuYXBwZW5kQ2hpbGQod2lkZ2V0LmdldERvbU5vZGUoKSk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9kb21Ob2RlLnJlbW92ZSgpKSk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKHdpZGdldCk7XG5cblx0XHRjb25zdCBzaG93ID0gKCkgPT4ge1xuXHRcdFx0aWYgKCFjb250YWluZXIuY29udGFpbnModGhpcy5fZG9tTm9kZSkpIHtcblx0XHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2RvbU5vZGUpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBoaWRlID0gKCkgPT4ge1xuXHRcdFx0aWYgKGNvbnRhaW5lci5jb250YWlucyh0aGlzLl9kb21Ob2RlKSkge1xuXHRcdFx0XHR3aWRnZXQuaGlkZSgpO1xuXHRcdFx0XHR0aGlzLl9kb21Ob2RlLnJlbW92ZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBhY3RpdmVFZGl0b3JTaWduYWwgPSBvYnNlcnZhYmxlU2lnbmFsRnJvbUV2ZW50KHRoaXMsIEV2ZW50LmFueShncm91cC5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSwgZ3JvdXAub25EaWRNb2RlbENoYW5nZSkpO1xuXG5cdFx0Y29uc3QgYWN0aXZlVXJpT2JzID0gZGVyaXZlZE9wdHMoeyBlcXVhbHNGbjogaXNFcXVhbCB9LCByID0+IHtcblxuXHRcdFx0YWN0aXZlRWRpdG9yU2lnbmFsLnJlYWQocik7IC8vIHNpZ25hbFxuXG5cdFx0XHRjb25zdCBlZGl0b3IgPSBncm91cC5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdFx0Y29uc3QgdXJpID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShlZGl0b3I/LmlucHV0LCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cblx0XHRcdHJldHVybiB1cmk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzZXNzaW9uQW5kRW50cnkgPSBkZXJpdmVkKHIgPT4ge1xuXG5cdFx0XHRhY3RpdmVFZGl0b3JTaWduYWwucmVhZChyKTsgLy8gc2lnbmFsIHRvIGVuc3VyZSBhY3RpdmVFZGl0b3IgYW5kIGFjdGl2ZUVkaXRvclBhbmUgZG9uJ3QgZ28gb3V0IG9mIHN5bmNcblxuXHRcdFx0Y29uc3QgdXJpID0gYWN0aXZlVXJpT2JzLnJlYWQocik7XG5cdFx0XHRpZiAoIXVyaSkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbmV3IE9ic2VydmFibGVFZGl0b3JTZXNzaW9uKHVyaSwgY2hhdEVkaXRpbmdTZXJ2aWNlLCBpbmxpbmVDaGF0U2VydmljZSkudmFsdWUucmVhZChyKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGlzSW5Qcm9ncmVzcyA9IGRlcml2ZWQociA9PiB7XG5cblx0XHRcdGNvbnN0IHNlc3Npb24gPSBzZXNzaW9uQW5kRW50cnkucmVhZChyKT8uc2Vzc2lvbjtcblx0XHRcdGlmICghc2Vzc2lvbikge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNoYXRNb2RlbCA9IGNoYXRTZXJ2aWNlLmdldFNlc3Npb24oc2Vzc2lvbi5jaGF0U2Vzc2lvbklkKSE7XG5cdFx0XHRjb25zdCBsYXN0UmVzcG9uc2UgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsIGNoYXRNb2RlbC5vbkRpZENoYW5nZSwgKCkgPT4gY2hhdE1vZGVsLmdldFJlcXVlc3RzKCkuYXQoLTEpPy5yZXNwb25zZSk7XG5cblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gbGFzdFJlc3BvbnNlLnJlYWQocik7XG5cdFx0XHRpZiAoIXJlc3BvbnNlKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsIHJlc3BvbnNlLm9uRGlkQ2hhbmdlLCAoKSA9PiAhcmVzcG9uc2UuaXNDb21wbGV0ZSkucmVhZChyKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZChhdXRvcnVuKHIgPT4ge1xuXG5cdFx0XHRjb25zdCBkYXRhID0gc2Vzc2lvbkFuZEVudHJ5LnJlYWQocik7XG5cblx0XHRcdGlmICghZGF0YSkge1xuXHRcdFx0XHRoaWRlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgeyBzZXNzaW9uLCBlbnRyeSB9ID0gZGF0YTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHRlbnRyeT8uc3RhdGUucmVhZChyKSA9PT0gV29ya2luZ1NldEVudHJ5U3RhdGUuTW9kaWZpZWQgLy8gYW55IGVudHJ5IGNoYW5naW5nXG5cdFx0XHRcdHx8ICghc2Vzc2lvbi5pc0dsb2JhbEVkaXRpbmdTZXNzaW9uICYmIGlzSW5Qcm9ncmVzcy5yZWFkKHIpKSAvLyBpbmxpbmUgY2hhdCByZXF1ZXN0XG5cdFx0XHQpIHtcblx0XHRcdFx0Ly8gYW55IHNlc3Npb24gd2l0aCBjaGFuZ2VzXG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBncm91cC5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdFx0XHRhc3NlcnRUeXBlKGVkaXRvclBhbmUpO1xuXG5cdFx0XHRcdGNvbnN0IGNoYW5nZUluZGV4ID0gZGVyaXZlZChyID0+IGVudHJ5XG5cdFx0XHRcdFx0PyBlbnRyeS5nZXRFZGl0b3JJbnRlZ3JhdGlvbihlZGl0b3JQYW5lKS5jdXJyZW50SW5kZXgucmVhZChyKVxuXHRcdFx0XHRcdDogMCk7XG5cblx0XHRcdFx0Y29uc3QgZW50cnlJbmRleCA9IGRlcml2ZWQociA9PiBlbnRyeVxuXHRcdFx0XHRcdD8gc2Vzc2lvbi5lbnRyaWVzLnJlYWQocikuaW5kZXhPZihlbnRyeSlcblx0XHRcdFx0XHQ6IDBcblx0XHRcdFx0KTtcblxuXHRcdFx0XHR3aWRnZXQuc2hvdyhzZXNzaW9uLCBlbnRyeSwgeyBlbnRyeUluZGV4LCBjaGFuZ2VJbmRleCB9KTtcblx0XHRcdFx0c2hvdygpO1xuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBub3RoaW5nXG5cdFx0XHRcdGhpZGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3N0b3JlLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdEVkaXRpbmdFZGl0b3JPdmVybGF5IGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ2NoYXQuZWRpdHMuZWRpdG9yT3ZlcmxheSc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFZGl0b3JHcm91cHNTZXJ2aWNlIGVkaXRvckdyb3Vwc1NlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cblx0XHRjb25zdCBlZGl0b3JHcm91cHMgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KFxuXHRcdFx0dGhpcyxcblx0XHRcdEV2ZW50LmFueShlZGl0b3JHcm91cHNTZXJ2aWNlLm9uRGlkQWRkR3JvdXAsIGVkaXRvckdyb3Vwc1NlcnZpY2Uub25EaWRSZW1vdmVHcm91cCksXG5cdFx0XHQoKSA9PiBlZGl0b3JHcm91cHNTZXJ2aWNlLmdyb3Vwc1xuXHRcdCk7XG5cblx0XHRjb25zdCBvdmVybGF5V2lkZ2V0cyA9IG5ldyBEaXNwb3NhYmxlTWFwPElFZGl0b3JHcm91cD4oKTtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZChhdXRvcnVuKHIgPT4ge1xuXG5cdFx0XHRjb25zdCB0b0RlbGV0ZSA9IG5ldyBTZXQob3ZlcmxheVdpZGdldHMua2V5cygpKTtcblx0XHRcdGNvbnN0IGdyb3VwcyA9IGVkaXRvckdyb3Vwcy5yZWFkKHIpO1xuXG5cblx0XHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgZ3JvdXBzKSB7XG5cblx0XHRcdFx0aWYgKCEoZ3JvdXAgaW5zdGFuY2VvZiBFZGl0b3JHcm91cFZpZXcpKSB7XG5cdFx0XHRcdFx0Ly8gVE9ET0Bqcmlla2VuIGJldHRlciB3aXRoIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL3RyZWUvYmVuL2xheW91dC1ncm91cC1jb250YWluZXJcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRvRGVsZXRlLmRlbGV0ZShncm91cCk7IC8vIHdlIGtlZXAgdGhlIHdpZGdldCBmb3IgdGhpcyBncm91cCFcblxuXHRcdFx0XHRpZiAoIW92ZXJsYXlXaWRnZXRzLmhhcyhncm91cCkpIHtcblxuXHRcdFx0XHRcdGNvbnN0IHNjb3BlZEluc3RhU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKFxuXHRcdFx0XHRcdFx0bmV3IFNlcnZpY2VDb2xsZWN0aW9uKFtJQ29udGV4dEtleVNlcnZpY2UsIGdyb3VwLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlXSlcblx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0Y29uc3QgY29udGFpbmVyID0gZ3JvdXAuZWxlbWVudDtcblxuXHRcdFx0XHRcdGNvbnN0IGN0cmwgPSBzY29wZWRJbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdEVkaXRpbmdPdmVybGF5Q29udHJvbGxlciwgY29udGFpbmVyLCBncm91cCk7XG5cdFx0XHRcdFx0b3ZlcmxheVdpZGdldHMuc2V0KGdyb3VwLCBjb21iaW5lZERpc3Bvc2FibGUoY3RybCwgc2NvcGVkSW5zdGFTZXJ2aWNlKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBncm91cCBvZiB0b0RlbGV0ZSkge1xuXHRcdFx0XHRvdmVybGF5V2lkZ2V0cy5kZWxldGVBbmREaXNwb3NlKGdyb3VwKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3N0b3JlLmRpc3Bvc2UoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsU0FBUyxvQkFBb0IsZUFBZSxpQkFBaUIsbUJBQW1CLG9CQUFvQjtBQUNwRyxTQUFTLFNBQVMsU0FBUyxhQUEw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
