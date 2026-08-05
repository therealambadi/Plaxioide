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
import { addDisposableListener } from "../../../../base/browser/dom.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { createCancelablePromise, DeferredPromise, raceCancellation } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { createStringDataTransferItem, matchesMimeType, UriList } from "../../../../base/common/dataTransfer.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { HierarchicalKind } from "../../../../base/common/hierarchicalKind.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Mimes } from "../../../../base/common/mime.js";
import * as platform from "../../../../base/common/platform.js";
import { upcast } from "../../../../base/common/types.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ClipboardEventUtils } from "../../../browser/controller/editContext/clipboardUtils.js";
import { toExternalVSDataTransfer, toVSDataTransfer } from "../../../browser/dnd.js";
import { IBulkEditService } from "../../../browser/services/bulkEditService.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Range } from "../../../common/core/range.js";
import { Handler } from "../../../common/editorCommon.js";
import { DocumentPasteTriggerKind } from "../../../common/languages.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { CodeEditorStateFlag, EditorStateCancellationTokenSource } from "../../editorState/browser/editorState.js";
import { InlineProgressManager } from "../../inlineProgress/browser/inlineProgress.js";
import { MessageController } from "../../message/browser/messageController.js";
import { DefaultTextPasteOrDropEditProvider } from "./defaultProviders.js";
import { createCombinedWorkspaceEdit, sortEditsByYieldTo } from "./edit.js";
import { PostEditWidgetManager } from "./postEditWidget.js";
const changePasteTypeCommandId = "editor.changePasteType";
const pasteAsPreferenceConfig = "editor.pasteAs.preferences";
const pasteWidgetVisibleCtx = new RawContextKey("pasteWidgetVisible", false, localize("pasteWidgetVisible", "Whether the paste widget is showing"));
const vscodeClipboardMime = "application/vnd.code.copymetadata";
let CopyPasteController = class extends Disposable {
  constructor(editor, instantiationService, _bulkEditService, _clipboardService, _commandService, _configService, _languageFeaturesService, _quickInputService, _progressService) {
    super();
    this._bulkEditService = _bulkEditService;
    this._clipboardService = _clipboardService;
    this._commandService = _commandService;
    this._configService = _configService;
    this._languageFeaturesService = _languageFeaturesService;
    this._quickInputService = _quickInputService;
    this._progressService = _progressService;
    this._editor = editor;
    const container = editor.getContainerDomNode();
    this._register(addDisposableListener(container, "copy", (e) => this.handleCopy(e)));
    this._register(addDisposableListener(container, "cut", (e) => this.handleCopy(e)));
    this._register(addDisposableListener(container, "paste", (e) => this.handlePaste(e), true));
    this._pasteProgressManager = this._register(new InlineProgressManager("pasteIntoEditor", editor, instantiationService));
    this._postPasteWidgetManager = this._register(instantiationService.createInstance(
      PostEditWidgetManager,
      "pasteIntoEditor",
      editor,
      pasteWidgetVisibleCtx,
      { id: changePasteTypeCommandId, label: localize("postPasteWidgetTitle", "Show paste options...") },
      () => CopyPasteController._configureDefaultAction ? [CopyPasteController._configureDefaultAction] : []
    ));
  }
  static get(editor) {
    return editor.getContribution(CopyPasteController.ID);
  }
  static setConfigureDefaultAction(action) {
    CopyPasteController._configureDefaultAction = action;
  }
  changePasteType() {
    this._postPasteWidgetManager.tryShowSelector();
  }
  pasteAs(preferred) {
    this._editor.focus();
    try {
      this._pasteAsActionContext = { preferred };
      this._commandService.executeCommand("editor.action.clipboardPasteAction");
    } finally {
      this._pasteAsActionContext = void 0;
    }
  }
  clearWidgets() {
    this._postPasteWidgetManager.clear();
  }
  isPasteAsEnabled() {
    return this._editor.getOption(EditorOption.pasteAs).enabled;
  }
  async finishedPaste() {
    await this._currentPasteOperation;
  }
  handleCopy(e) {
    if (!this._editor.hasTextFocus()) {
      return;
    }
    this._clipboardService.clearInternalState?.();
    if (!e.clipboardData || !this.isPasteAsEnabled()) {
      return;
    }
    const model = this._editor.getModel();
    const selections = this._editor.getSelections();
    if (!model || !selections?.length) {
      return;
    }
    const enableEmptySelectionClipboard = this._editor.getOption(EditorOption.emptySelectionClipboard);
    let ranges = selections;
    const wasFromEmptySelection = selections.length === 1 && selections[0].isEmpty();
    if (wasFromEmptySelection) {
      if (!enableEmptySelectionClipboard) {
        return;
      }
      ranges = [new Range(ranges[0].startLineNumber, 1, ranges[0].startLineNumber, 1 + model.getLineLength(ranges[0].startLineNumber))];
    }
    const toCopy = this._editor._getViewModel()?.getPlainTextToCopy(selections, enableEmptySelectionClipboard, platform.isWindows);
    const multicursorText = Array.isArray(toCopy) ? toCopy : null;
    const defaultPastePayload = {
      multicursorText,
      pasteOnNewLine: wasFromEmptySelection,
      mode: null
    };
    const providers = this._languageFeaturesService.documentPasteEditProvider.ordered(model).filter((x) => !!x.prepareDocumentPaste);
    if (!providers.length) {
      this.setCopyMetadata(e.clipboardData, { defaultPastePayload });
      return;
    }
    const dataTransfer = toVSDataTransfer(e.clipboardData);
    const providerCopyMimeTypes = providers.flatMap((x) => x.copyMimeTypes ?? []);
    const handle = generateUuid();
    this.setCopyMetadata(e.clipboardData, {
      id: handle,
      providerCopyMimeTypes,
      defaultPastePayload
    });
    const operations = providers.map((provider) => {
      return {
        providerMimeTypes: provider.copyMimeTypes,
        operation: createCancelablePromise((token) => provider.prepareDocumentPaste(model, ranges, dataTransfer, token).catch((err) => {
          console.error(err);
          return void 0;
        }))
      };
    });
    CopyPasteController._currentCopyOperation?.operations.forEach((entry) => entry.operation.cancel());
    CopyPasteController._currentCopyOperation = { handle, operations };
  }
  async handlePaste(e) {
    if (!e.clipboardData || !this._editor.hasTextFocus()) {
      return;
    }
    MessageController.get(this._editor)?.closeMessage();
    this._currentPasteOperation?.cancel();
    this._currentPasteOperation = void 0;
    const model = this._editor.getModel();
    const selections = this._editor.getSelections();
    if (!selections?.length || !model) {
      return;
    }
    if (this._editor.getOption(EditorOption.readOnly) || !this.isPasteAsEnabled() && !this._pasteAsActionContext) {
      return;
    }
    const metadata = this.fetchCopyMetadata(e);
    const dataTransfer = toExternalVSDataTransfer(e.clipboardData);
    dataTransfer.delete(vscodeClipboardMime);
    const fileTypes = Array.from(e.clipboardData.files).map((file) => file.type);
    const allPotentialMimeTypes = [
      ...e.clipboardData.types,
      ...fileTypes,
      ...metadata?.providerCopyMimeTypes ?? [],
      // TODO: always adds `uri-list` because this get set if there are resources in the system clipboard.
      // However we can only check the system clipboard async. For this early check, just add it in.
      // We filter providers again once we have the final dataTransfer we will use.
      Mimes.uriList
    ];
    const allProviders = this._languageFeaturesService.documentPasteEditProvider.ordered(model).filter((provider) => {
      const preference = this._pasteAsActionContext?.preferred;
      if (preference) {
        if (!this.providerMatchesPreference(provider, preference)) {
          return false;
        }
      }
      return provider.pasteMimeTypes?.some((type) => matchesMimeType(type, allPotentialMimeTypes));
    });
    if (!allProviders.length) {
      if (this._pasteAsActionContext?.preferred) {
        this.showPasteAsNoEditMessage(selections, this._pasteAsActionContext.preferred);
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (this._pasteAsActionContext) {
      this.showPasteAsPick(this._pasteAsActionContext.preferred, allProviders, selections, dataTransfer, metadata);
    } else {
      this.doPasteInline(allProviders, selections, dataTransfer, metadata, e);
    }
  }
  showPasteAsNoEditMessage(selections, preference) {
    const kindLabel = "only" in preference ? preference.only.value : "preferences" in preference ? preference.preferences.length ? preference.preferences.map((preference2) => preference2.value).join(", ") : localize("noPreferences", "empty") : preference.providerId;
    MessageController.get(this._editor)?.showMessage(localize("pasteAsError", "No paste edits for '{0}' found", kindLabel), selections[0].getStartPosition());
  }
  doPasteInline(allProviders, selections, dataTransfer, metadata, clipboardEvent) {
    const editor = this._editor;
    if (!editor.hasModel()) {
      return;
    }
    const editorStateCts = new EditorStateCancellationTokenSource(editor, CodeEditorStateFlag.Value | CodeEditorStateFlag.Selection, void 0);
    const p = createCancelablePromise(async (pToken) => {
      const editor2 = this._editor;
      if (!editor2.hasModel()) {
        return;
      }
      const model = editor2.getModel();
      const disposables = new DisposableStore();
      const cts = disposables.add(new CancellationTokenSource(pToken));
      disposables.add(editorStateCts.token.onCancellationRequested(() => cts.cancel()));
      const token = cts.token;
      try {
        await this.mergeInDataFromCopy(allProviders, dataTransfer, metadata, token);
        if (token.isCancellationRequested) {
          return;
        }
        const supportedProviders = allProviders.filter((provider) => this.isSupportedPasteProvider(provider, dataTransfer));
        if (!supportedProviders.length || supportedProviders.length === 1 && supportedProviders[0] instanceof DefaultTextPasteOrDropEditProvider) {
          return this.applyDefaultPasteHandler(dataTransfer, metadata, token, clipboardEvent);
        }
        const context = {
          triggerKind: DocumentPasteTriggerKind.Automatic
        };
        const editSession = await this.getPasteEdits(supportedProviders, dataTransfer, model, selections, context, token);
        disposables.add(editSession);
        if (token.isCancellationRequested) {
          return;
        }
        if (editSession.edits.length === 1 && editSession.edits[0].provider instanceof DefaultTextPasteOrDropEditProvider) {
          return this.applyDefaultPasteHandler(dataTransfer, metadata, token, clipboardEvent);
        }
        if (editSession.edits.length) {
          const canShowWidget = editor2.getOption(EditorOption.pasteAs).showPasteSelector === "afterPaste";
          return this._postPasteWidgetManager.applyEditAndShowIfNeeded(selections, { activeEditIndex: this.getInitialActiveEditIndex(model, editSession.edits), allEdits: editSession.edits }, canShowWidget, async (edit, resolveToken) => {
            if (!edit.provider.resolveDocumentPasteEdit) {
              return edit;
            }
            const resolveP = edit.provider.resolveDocumentPasteEdit(edit, resolveToken);
            const showP = new DeferredPromise();
            const resolved = await this._pasteProgressManager.showWhile(selections[0].getEndPosition(), localize("resolveProcess", "Resolving paste edit for '{0}'. Click to cancel", edit.title), raceCancellation(Promise.race([showP.p, resolveP]), resolveToken), {
              cancel: () => showP.cancel()
            }, 0);
            if (resolved) {
              edit.insertText = resolved.insertText;
              edit.additionalEdit = resolved.additionalEdit;
            }
            return edit;
          }, token);
        }
        await this.applyDefaultPasteHandler(dataTransfer, metadata, token, clipboardEvent);
      } finally {
        disposables.dispose();
        if (this._currentPasteOperation === p) {
          this._currentPasteOperation = void 0;
        }
      }
    });
    this._pasteProgressManager.showWhile(selections[0].getEndPosition(), localize("pasteIntoEditorProgress", "Running paste handlers. Click to cancel and do basic paste"), p, {
      cancel: async () => {
        try {
          p.cancel();
          if (editorStateCts.token.isCancellationRequested) {
            return;
          }
          await this.applyDefaultPasteHandler(dataTransfer, metadata, editorStateCts.token, clipboardEvent);
        } finally {
          editorStateCts.dispose();
        }
      }
    }).then(() => {
      editorStateCts.dispose();
    });
    this._currentPasteOperation = p;
  }
  showPasteAsPick(preference, allProviders, selections, dataTransfer, metadata) {
    const p = createCancelablePromise(async (token) => {
      const editor = this._editor;
      if (!editor.hasModel()) {
        return;
      }
      const model = editor.getModel();
      const disposables = new DisposableStore();
      const tokenSource = disposables.add(new EditorStateCancellationTokenSource(editor, CodeEditorStateFlag.Value | CodeEditorStateFlag.Selection, void 0, token));
      try {
        await this.mergeInDataFromCopy(allProviders, dataTransfer, metadata, tokenSource.token);
        if (tokenSource.token.isCancellationRequested) {
          return;
        }
        let supportedProviders = allProviders.filter((provider) => this.isSupportedPasteProvider(provider, dataTransfer, preference));
        if (preference) {
          supportedProviders = supportedProviders.filter((provider) => this.providerMatchesPreference(provider, preference));
        }
        const context = {
          triggerKind: DocumentPasteTriggerKind.PasteAs,
          only: preference && "only" in preference ? preference.only : void 0
        };
        let editSession = disposables.add(await this.getPasteEdits(supportedProviders, dataTransfer, model, selections, context, tokenSource.token));
        if (tokenSource.token.isCancellationRequested) {
          return;
        }
        if (preference) {
          editSession = {
            edits: editSession.edits.filter((edit) => {
              if ("only" in preference) {
                return preference.only.contains(edit.kind);
              } else if ("preferences" in preference) {
                return preference.preferences.some((preference2) => preference2.contains(edit.kind));
              } else {
                return preference.providerId === edit.provider.id;
              }
            }),
            dispose: editSession.dispose
          };
        }
        if (!editSession.edits.length) {
          if (preference) {
            this.showPasteAsNoEditMessage(selections, preference);
          }
          return;
        }
        let pickedEdit;
        if (preference) {
          pickedEdit = editSession.edits.at(0);
        } else {
          const configureDefaultItem = {
            id: "editor.pasteAs.default",
            label: localize("pasteAsDefault", "Configure default paste action"),
            edit: void 0
          };
          const selected = await this._quickInputService.pick(
            [
              ...editSession.edits.map((edit) => ({
                label: edit.title,
                description: edit.kind?.value,
                edit
              })),
              ...CopyPasteController._configureDefaultAction ? [
                upcast({ type: "separator" }),
                {
                  label: CopyPasteController._configureDefaultAction.label,
                  edit: void 0
                }
              ] : []
            ],
            {
              placeHolder: localize("pasteAsPickerPlaceholder", "Select Paste Action")
            }
          );
          if (selected === configureDefaultItem) {
            CopyPasteController._configureDefaultAction?.run();
            return;
          }
          pickedEdit = selected?.edit;
        }
        if (!pickedEdit) {
          return;
        }
        const combinedWorkspaceEdit = createCombinedWorkspaceEdit(model.uri, selections, pickedEdit);
        await this._bulkEditService.apply(combinedWorkspaceEdit, { editor: this._editor });
      } finally {
        disposables.dispose();
        if (this._currentPasteOperation === p) {
          this._currentPasteOperation = void 0;
        }
      }
    });
    this._progressService.withProgress({
      location: ProgressLocation.Window,
      title: localize("pasteAsProgress", "Running paste handlers")
    }, () => p);
  }
  setCopyMetadata(dataTransfer, metadata) {
    dataTransfer.setData(vscodeClipboardMime, JSON.stringify(metadata));
  }
  fetchCopyMetadata(e) {
    if (!e.clipboardData) {
      return;
    }
    const rawMetadata = e.clipboardData.getData(vscodeClipboardMime);
    if (rawMetadata) {
      try {
        return JSON.parse(rawMetadata);
      } catch {
        return void 0;
      }
    }
    const [_, metadata] = ClipboardEventUtils.getTextData(e.clipboardData);
    if (metadata) {
      return {
        defaultPastePayload: {
          mode: metadata.mode,
          multicursorText: metadata.multicursorText ?? null,
          pasteOnNewLine: !!metadata.isFromEmptySelection
        }
      };
    }
    return void 0;
  }
  async mergeInDataFromCopy(allProviders, dataTransfer, metadata, token) {
    if (metadata?.id && CopyPasteController._currentCopyOperation?.handle === metadata.id) {
      const toResolve = CopyPasteController._currentCopyOperation.operations.filter((op) => allProviders.some((provider) => provider.pasteMimeTypes.some((type) => matchesMimeType(type, op.providerMimeTypes)))).map((op) => op.operation);
      const toMergeResults = await Promise.all(toResolve);
      if (token.isCancellationRequested) {
        return;
      }
      for (const toMergeData of toMergeResults.reverse()) {
        if (toMergeData) {
          for (const [key, value] of toMergeData) {
            dataTransfer.replace(key, value);
          }
        }
      }
    }
    if (!dataTransfer.has(Mimes.uriList)) {
      const resources = await this._clipboardService.readResources();
      if (token.isCancellationRequested) {
        return;
      }
      if (resources.length) {
        dataTransfer.append(Mimes.uriList, createStringDataTransferItem(UriList.create(resources)));
      }
    }
  }
  async getPasteEdits(providers, dataTransfer, model, selections, context, token) {
    const disposables = new DisposableStore();
    const results = await raceCancellation(
      Promise.all(providers.map(async (provider) => {
        try {
          const edits2 = await provider.provideDocumentPasteEdits?.(model, selections, dataTransfer, context, token);
          if (edits2) {
            disposables.add(edits2);
          }
          return edits2?.edits?.map((edit) => ({ ...edit, provider }));
        } catch (err) {
          if (!isCancellationError(err)) {
            console.error(err);
          }
          return void 0;
        }
      })),
      token
    );
    const edits = coalesce(results ?? []).flat().filter((edit) => {
      return !context.only || context.only.contains(edit.kind);
    });
    return {
      edits: sortEditsByYieldTo(edits),
      dispose: () => disposables.dispose()
    };
  }
  async applyDefaultPasteHandler(dataTransfer, metadata, token, clipboardEvent) {
    const textDataTransfer = dataTransfer.get(Mimes.text) ?? dataTransfer.get("text");
    const text = await textDataTransfer?.asString() ?? "";
    if (token.isCancellationRequested) {
      return;
    }
    const payload = {
      clipboardEvent,
      text,
      pasteOnNewLine: metadata?.defaultPastePayload.pasteOnNewLine ?? false,
      multicursorText: metadata?.defaultPastePayload.multicursorText ?? null,
      mode: null
    };
    this._editor.trigger("keyboard", Handler.Paste, payload);
  }
  /**
   * Filter out providers if they:
   * - Don't handle any of the data transfer types we have
   * - Don't match the preferred paste kind
   */
  isSupportedPasteProvider(provider, dataTransfer, preference) {
    if (!provider.pasteMimeTypes?.some((type) => dataTransfer.matches(type))) {
      return false;
    }
    return !preference || this.providerMatchesPreference(provider, preference);
  }
  providerMatchesPreference(provider, preference) {
    if ("only" in preference) {
      return provider.providedPasteEditKinds.some((providedKind) => preference.only.contains(providedKind));
    } else if ("preferences" in preference) {
      return preference.preferences.some((providedKind) => preference.preferences.some((preferredKind) => preferredKind.contains(providedKind)));
    } else {
      return provider.id === preference.providerId;
    }
  }
  getInitialActiveEditIndex(model, edits) {
    const preferredProviders = this._configService.getValue(pasteAsPreferenceConfig, { resource: model.uri });
    for (const config of Array.isArray(preferredProviders) ? preferredProviders : []) {
      const desiredKind = new HierarchicalKind(config);
      const editIndex = edits.findIndex((edit) => desiredKind.contains(edit.kind));
      if (editIndex >= 0) {
        return editIndex;
      }
    }
    return 0;
  }
};
CopyPasteController.ID = "editor.contrib.copyPasteActionController";
CopyPasteController = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IBulkEditService),
  __decorateParam(3, IClipboardService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ILanguageFeaturesService),
  __decorateParam(7, IQuickInputService),
  __decorateParam(8, IProgressService)
], CopyPasteController);
export {
  CopyPasteController,
  changePasteTypeCommandId,
  pasteAsPreferenceConfig,
  pasteWidgetVisibleCtx
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9kcm9wT3JQYXN0ZUludG8vYnJvd3Nlci9jb3B5UGFzdGVDb250cm9sbGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYWRkRGlzcG9zYWJsZUxpc3RlbmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxhYmxlUHJvbWlzZSwgY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UsIERlZmVycmVkUHJvbWlzZSwgcmFjZUNhbmNlbGxhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTdHJpbmdEYXRhVHJhbnNmZXJJdGVtLCBJUmVhZG9ubHlWU0RhdGFUcmFuc2ZlciwgbWF0Y2hlc01pbWVUeXBlLCBVcmlMaXN0LCBWU0RhdGFUcmFuc2ZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RhdGFUcmFuc2Zlci5qcyc7XG5pbXBvcnQgeyBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEhpZXJhcmNoaWNhbEtpbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oaWVyYXJjaGljYWxLaW5kLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBNaW1lcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21pbWUuanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgdXBjYXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElQcm9ncmVzc1NlcnZpY2UsIFByb2dyZXNzTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSwgSVF1aWNrUGlja1NlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgQ2xpcGJvYXJkRXZlbnRVdGlscyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvY29udHJvbGxlci9lZGl0Q29udGV4dC9jbGlwYm9hcmRVdGlscy5qcyc7XG5pbXBvcnQgeyB0b0V4dGVybmFsVlNEYXRhVHJhbnNmZXIsIHRvVlNEYXRhVHJhbnNmZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciwgUGFzdGVQYXlsb2FkIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElCdWxrRWRpdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBIYW5kbGVyLCBJRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBEb2N1bWVudFBhc3RlQ29udGV4dCwgRG9jdW1lbnRQYXN0ZUVkaXQsIERvY3VtZW50UGFzdGVFZGl0UHJvdmlkZXIsIERvY3VtZW50UGFzdGVUcmlnZ2VyS2luZCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yU3RhdGVGbGFnLCBFZGl0b3JTdGF0ZUNhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vZWRpdG9yU3RhdGUvYnJvd3Nlci9lZGl0b3JTdGF0ZS5qcyc7XG5pbXBvcnQgeyBJbmxpbmVQcm9ncmVzc01hbmFnZXIgfSBmcm9tICcuLi8uLi9pbmxpbmVQcm9ncmVzcy9icm93c2VyL2lubGluZVByb2dyZXNzLmpzJztcbmltcG9ydCB7IE1lc3NhZ2VDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vbWVzc2FnZS9icm93c2VyL21lc3NhZ2VDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IFByZWZlcnJlZFBhc3RlQ29uZmlndXJhdGlvbiB9IGZyb20gJy4vY29weVBhc3RlQ29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IERlZmF1bHRUZXh0UGFzdGVPckRyb3BFZGl0UHJvdmlkZXIgfSBmcm9tICcuL2RlZmF1bHRQcm92aWRlcnMuanMnO1xuaW1wb3J0IHsgY3JlYXRlQ29tYmluZWRXb3Jrc3BhY2VFZGl0LCBzb3J0RWRpdHNCeVlpZWxkVG8gfSBmcm9tICcuL2VkaXQuanMnO1xuaW1wb3J0IHsgUG9zdEVkaXRXaWRnZXRNYW5hZ2VyIH0gZnJvbSAnLi9wb3N0RWRpdFdpZGdldC5qcyc7XG5cbmV4cG9ydCBjb25zdCBjaGFuZ2VQYXN0ZVR5cGVDb21tYW5kSWQgPSAnZWRpdG9yLmNoYW5nZVBhc3RlVHlwZSc7XG5cbmV4cG9ydCBjb25zdCBwYXN0ZUFzUHJlZmVyZW5jZUNvbmZpZyA9ICdlZGl0b3IucGFzdGVBcy5wcmVmZXJlbmNlcyc7XG5cbmV4cG9ydCBjb25zdCBwYXN0ZVdpZGdldFZpc2libGVDdHggPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPigncGFzdGVXaWRnZXRWaXNpYmxlJywgZmFsc2UsIGxvY2FsaXplKCdwYXN0ZVdpZGdldFZpc2libGUnLCBcIldoZXRoZXIgdGhlIHBhc3RlIHdpZGdldCBpcyBzaG93aW5nXCIpKTtcblxuY29uc3QgdnNjb2RlQ2xpcGJvYXJkTWltZSA9ICdhcHBsaWNhdGlvbi92bmQuY29kZS5jb3B5bWV0YWRhdGEnO1xuXG5pbnRlcmZhY2UgQ29weU1ldGFkYXRhIHtcblx0cmVhZG9ubHkgaWQ/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHByb3ZpZGVyQ29weU1pbWVUeXBlcz86IHJlYWRvbmx5IHN0cmluZ1tdO1xuXG5cdHJlYWRvbmx5IGRlZmF1bHRQYXN0ZVBheWxvYWQ6IE9taXQ8UGFzdGVQYXlsb2FkLCAndGV4dCc+O1xufVxuXG50eXBlIFBhc3RlRWRpdFdpdGhQcm92aWRlciA9IERvY3VtZW50UGFzdGVFZGl0ICYge1xuXHRwcm92aWRlcjogRG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlcjtcbn07XG5cblxuaW50ZXJmYWNlIERvY3VtZW50UGFzdGVXaXRoUHJvdmlkZXJFZGl0c1Nlc3Npb24ge1xuXHRlZGl0czogcmVhZG9ubHkgUGFzdGVFZGl0V2l0aFByb3ZpZGVyW107XG5cdGRpc3Bvc2UoKTogdm9pZDtcbn1cblxuZXhwb3J0IHR5cGUgUGFzdGVQcmVmZXJlbmNlID1cblx0fCB7IHJlYWRvbmx5IG9ubHk6IEhpZXJhcmNoaWNhbEtpbmQgfVxuXHR8IHsgcmVhZG9ubHkgcHJlZmVyZW5jZXM6IHJlYWRvbmx5IEhpZXJhcmNoaWNhbEtpbmRbXSB9XG5cdHwgeyByZWFkb25seSBwcm92aWRlcklkOiBzdHJpbmcgfSAvLyBPbmx5IHVzZWQgaW50ZXJuYWxseVxuXHQ7XG5cbmludGVyZmFjZSBDb3B5T3BlcmF0aW9uIHtcblx0cmVhZG9ubHkgcHJvdmlkZXJNaW1lVHlwZXM6IHJlYWRvbmx5IHN0cmluZ1tdO1xuXHRyZWFkb25seSBvcGVyYXRpb246IENhbmNlbGFibGVQcm9taXNlPElSZWFkb25seVZTRGF0YVRyYW5zZmVyIHwgdW5kZWZpbmVkPjtcbn1cblxuZXhwb3J0IGNsYXNzIENvcHlQYXN0ZUNvbnRyb2xsZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuY29udHJpYi5jb3B5UGFzdGVBY3Rpb25Db250cm9sbGVyJztcblxuXHRwdWJsaWMgc3RhdGljIGdldChlZGl0b3I6IElDb2RlRWRpdG9yKTogQ29weVBhc3RlQ29udHJvbGxlciB8IG51bGwge1xuXHRcdHJldHVybiBlZGl0b3IuZ2V0Q29udHJpYnV0aW9uPENvcHlQYXN0ZUNvbnRyb2xsZXI+KENvcHlQYXN0ZUNvbnRyb2xsZXIuSUQpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBzZXRDb25maWd1cmVEZWZhdWx0QWN0aW9uKGFjdGlvbjogSUFjdGlvbikge1xuXHRcdENvcHlQYXN0ZUNvbnRyb2xsZXIuX2NvbmZpZ3VyZURlZmF1bHRBY3Rpb24gPSBhY3Rpb247XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfY29uZmlndXJlRGVmYXVsdEFjdGlvbj86IElBY3Rpb247XG5cblx0LyoqXG5cdCAqIEdsb2JhbCB0cmFja2luZyB0aGUgbGFzdCBjb3B5IG9wZXJhdGlvbi5cblx0ICpcblx0ICogVGhpcyBpcyBzaGFyZWQgYWNyb3NzIGFsbCBlZGl0b3JzIHNvIHRoYXQgeW91IGNhbiBjb3B5IGFuZCBwYXN0ZSBiZXR3ZWVuIGdyb3Vwcy5cblx0ICpcblx0ICogVE9ETzogZmlndXJlIG91dCBob3cgdG8gbWFrZSB0aGlzIHdvcmsgd2l0aCBtdWx0aXBsZSB3aW5kb3dzXG5cdCAqL1xuXHRwcml2YXRlIHN0YXRpYyBfY3VycmVudENvcHlPcGVyYXRpb24/OiB7XG5cdFx0cmVhZG9ubHkgaGFuZGxlOiBzdHJpbmc7XG5cdFx0cmVhZG9ubHkgb3BlcmF0aW9uczogUmVhZG9ubHlBcnJheTxDb3B5T3BlcmF0aW9uPjtcblx0fTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yO1xuXG5cdHByaXZhdGUgX2N1cnJlbnRQYXN0ZU9wZXJhdGlvbj86IENhbmNlbGFibGVQcm9taXNlPHZvaWQ+O1xuXHRwcml2YXRlIF9wYXN0ZUFzQWN0aW9uQ29udGV4dD86IHsgcmVhZG9ubHkgcHJlZmVycmVkPzogUGFzdGVQcmVmZXJlbmNlIH07XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcGFzdGVQcm9ncmVzc01hbmFnZXI6IElubGluZVByb2dyZXNzTWFuYWdlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfcG9zdFBhc3RlV2lkZ2V0TWFuYWdlcjogUG9zdEVkaXRXaWRnZXRNYW5hZ2VyPFBhc3RlRWRpdFdpdGhQcm92aWRlcj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElCdWxrRWRpdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYnVsa0VkaXRTZXJ2aWNlOiBJQnVsa0VkaXRTZXJ2aWNlLFxuXHRcdEBJQ2xpcGJvYXJkU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jbGlwYm9hcmRTZXJ2aWNlOiBJQ2xpcGJvYXJkU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWdTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9lZGl0b3IgPSBlZGl0b3I7XG5cblx0XHRjb25zdCBjb250YWluZXIgPSBlZGl0b3IuZ2V0Q29udGFpbmVyRG9tTm9kZSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihjb250YWluZXIsICdjb3B5JywgZSA9PiB0aGlzLmhhbmRsZUNvcHkoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIoY29udGFpbmVyLCAnY3V0JywgZSA9PiB0aGlzLmhhbmRsZUNvcHkoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIoY29udGFpbmVyLCAncGFzdGUnLCBlID0+IHRoaXMuaGFuZGxlUGFzdGUoZSksIHRydWUpKTtcblxuXHRcdHRoaXMuX3Bhc3RlUHJvZ3Jlc3NNYW5hZ2VyID0gdGhpcy5fcmVnaXN0ZXIobmV3IElubGluZVByb2dyZXNzTWFuYWdlcigncGFzdGVJbnRvRWRpdG9yJywgZWRpdG9yLCBpbnN0YW50aWF0aW9uU2VydmljZSkpO1xuXG5cdFx0dGhpcy5fcG9zdFBhc3RlV2lkZ2V0TWFuYWdlciA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFBvc3RFZGl0V2lkZ2V0TWFuYWdlciwgJ3Bhc3RlSW50b0VkaXRvcicsIGVkaXRvciwgcGFzdGVXaWRnZXRWaXNpYmxlQ3R4LFxuXHRcdFx0eyBpZDogY2hhbmdlUGFzdGVUeXBlQ29tbWFuZElkLCBsYWJlbDogbG9jYWxpemUoJ3Bvc3RQYXN0ZVdpZGdldFRpdGxlJywgXCJTaG93IHBhc3RlIG9wdGlvbnMuLi5cIikgfSxcblx0XHRcdCgpID0+IENvcHlQYXN0ZUNvbnRyb2xsZXIuX2NvbmZpZ3VyZURlZmF1bHRBY3Rpb24gPyBbQ29weVBhc3RlQ29udHJvbGxlci5fY29uZmlndXJlRGVmYXVsdEFjdGlvbl0gOiBbXVxuXHRcdCkpO1xuXHR9XG5cblx0cHVibGljIGNoYW5nZVBhc3RlVHlwZSgpIHtcblx0XHR0aGlzLl9wb3N0UGFzdGVXaWRnZXRNYW5hZ2VyLnRyeVNob3dTZWxlY3RvcigpO1xuXHR9XG5cblx0cHVibGljIHBhc3RlQXMocHJlZmVycmVkPzogUGFzdGVQcmVmZXJlbmNlKSB7XG5cdFx0dGhpcy5fZWRpdG9yLmZvY3VzKCk7XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX3Bhc3RlQXNBY3Rpb25Db250ZXh0ID0geyBwcmVmZXJyZWQgfTtcblx0XHRcdHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCdlZGl0b3IuYWN0aW9uLmNsaXBib2FyZFBhc3RlQWN0aW9uJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX3Bhc3RlQXNBY3Rpb25Db250ZXh0ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBjbGVhcldpZGdldHMoKSB7XG5cdFx0dGhpcy5fcG9zdFBhc3RlV2lkZ2V0TWFuYWdlci5jbGVhcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1Bhc3RlQXNFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5wYXN0ZUFzKS5lbmFibGVkO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGZpbmlzaGVkUGFzdGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fY3VycmVudFBhc3RlT3BlcmF0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVDb3B5KGU6IENsaXBib2FyZEV2ZW50KSB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzVGV4dEZvY3VzKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBFeHBsaWNpdGx5IGNsZWFyIHRoZSBjbGlwYm9hcmQgaW50ZXJuYWwgc3RhdGUuXG5cdFx0Ly8gVGhpcyBpcyBuZWVkZWQgYmVjYXVzZSBvbiB3ZWIsIHRoZSBicm93c2VyIGNsaXBib2FyZCBpcyBmYWtlZCBvdXQgdXNpbmcgYW4gaW4tbWVtb3J5IHN0b3JlLlxuXHRcdC8vIFRoaXMgbWVhbnMgdGhlIHJlc291cmNlcyBjbGlwYm9hcmQgaXMgbm90IHByb3Blcmx5IHVwZGF0ZWQgd2hlbiBjb3B5aW5nIGZyb20gdGhlIGVkaXRvci5cblx0XHR0aGlzLl9jbGlwYm9hcmRTZXJ2aWNlLmNsZWFySW50ZXJuYWxTdGF0ZT8uKCk7XG5cblx0XHRpZiAoIWUuY2xpcGJvYXJkRGF0YSB8fCAhdGhpcy5pc1Bhc3RlQXNFbmFibGVkKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLl9lZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdGlmICghbW9kZWwgfHwgIXNlbGVjdGlvbnM/Lmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVuYWJsZUVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZW1wdHlTZWxlY3Rpb25DbGlwYm9hcmQpO1xuXG5cdFx0bGV0IHJhbmdlczogcmVhZG9ubHkgSVJhbmdlW10gPSBzZWxlY3Rpb25zO1xuXHRcdGNvbnN0IHdhc0Zyb21FbXB0eVNlbGVjdGlvbiA9IHNlbGVjdGlvbnMubGVuZ3RoID09PSAxICYmIHNlbGVjdGlvbnNbMF0uaXNFbXB0eSgpO1xuXHRcdGlmICh3YXNGcm9tRW1wdHlTZWxlY3Rpb24pIHtcblx0XHRcdGlmICghZW5hYmxlRW1wdHlTZWxlY3Rpb25DbGlwYm9hcmQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRyYW5nZXMgPSBbbmV3IFJhbmdlKHJhbmdlc1swXS5zdGFydExpbmVOdW1iZXIsIDEsIHJhbmdlc1swXS5zdGFydExpbmVOdW1iZXIsIDEgKyBtb2RlbC5nZXRMaW5lTGVuZ3RoKHJhbmdlc1swXS5zdGFydExpbmVOdW1iZXIpKV07XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9Db3B5ID0gdGhpcy5fZWRpdG9yLl9nZXRWaWV3TW9kZWwoKT8uZ2V0UGxhaW5UZXh0VG9Db3B5KHNlbGVjdGlvbnMsIGVuYWJsZUVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkLCBwbGF0Zm9ybS5pc1dpbmRvd3MpO1xuXHRcdGNvbnN0IG11bHRpY3Vyc29yVGV4dCA9IEFycmF5LmlzQXJyYXkodG9Db3B5KSA/IHRvQ29weSA6IG51bGw7XG5cblx0XHRjb25zdCBkZWZhdWx0UGFzdGVQYXlsb2FkID0ge1xuXHRcdFx0bXVsdGljdXJzb3JUZXh0LFxuXHRcdFx0cGFzdGVPbk5ld0xpbmU6IHdhc0Zyb21FbXB0eVNlbGVjdGlvbixcblx0XHRcdG1vZGU6IG51bGxcblx0XHR9O1xuXG5cdFx0Y29uc3QgcHJvdmlkZXJzID0gdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlclxuXHRcdFx0Lm9yZGVyZWQobW9kZWwpXG5cdFx0XHQuZmlsdGVyKHggPT4gISF4LnByZXBhcmVEb2N1bWVudFBhc3RlKTtcblx0XHRpZiAoIXByb3ZpZGVycy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuc2V0Q29weU1ldGFkYXRhKGUuY2xpcGJvYXJkRGF0YSwgeyBkZWZhdWx0UGFzdGVQYXlsb2FkIH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRhdGFUcmFuc2ZlciA9IHRvVlNEYXRhVHJhbnNmZXIoZS5jbGlwYm9hcmREYXRhKTtcblx0XHRjb25zdCBwcm92aWRlckNvcHlNaW1lVHlwZXMgPSBwcm92aWRlcnMuZmxhdE1hcCh4ID0+IHguY29weU1pbWVUeXBlcyA/PyBbXSk7XG5cblx0XHQvLyBTYXZlIG9mZiBhIGhhbmRsZSBwb2ludGluZyB0byBkYXRhIHRoYXQgVlMgQ29kZSBtYWludGFpbnMuXG5cdFx0Y29uc3QgaGFuZGxlID0gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0dGhpcy5zZXRDb3B5TWV0YWRhdGEoZS5jbGlwYm9hcmREYXRhLCB7XG5cdFx0XHRpZDogaGFuZGxlLFxuXHRcdFx0cHJvdmlkZXJDb3B5TWltZVR5cGVzLFxuXHRcdFx0ZGVmYXVsdFBhc3RlUGF5bG9hZFxuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgb3BlcmF0aW9ucyA9IHByb3ZpZGVycy5tYXAoKHByb3ZpZGVyKTogQ29weU9wZXJhdGlvbiA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRwcm92aWRlck1pbWVUeXBlczogcHJvdmlkZXIuY29weU1pbWVUeXBlcyxcblx0XHRcdFx0b3BlcmF0aW9uOiBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSh0b2tlbiA9PlxuXHRcdFx0XHRcdHByb3ZpZGVyLnByZXBhcmVEb2N1bWVudFBhc3RlIShtb2RlbCwgcmFuZ2VzLCBkYXRhVHJhbnNmZXIsIHRva2VuKVxuXHRcdFx0XHRcdFx0LmNhdGNoKGVyciA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH0pKVxuXHRcdFx0fTtcblx0XHR9KTtcblxuXHRcdENvcHlQYXN0ZUNvbnRyb2xsZXIuX2N1cnJlbnRDb3B5T3BlcmF0aW9uPy5vcGVyYXRpb25zLmZvckVhY2goZW50cnkgPT4gZW50cnkub3BlcmF0aW9uLmNhbmNlbCgpKTtcblx0XHRDb3B5UGFzdGVDb250cm9sbGVyLl9jdXJyZW50Q29weU9wZXJhdGlvbiA9IHsgaGFuZGxlLCBvcGVyYXRpb25zIH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGhhbmRsZVBhc3RlKGU6IENsaXBib2FyZEV2ZW50KSB7XG5cdFx0aWYgKCFlLmNsaXBib2FyZERhdGEgfHwgIXRoaXMuX2VkaXRvci5oYXNUZXh0Rm9jdXMoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdE1lc3NhZ2VDb250cm9sbGVyLmdldCh0aGlzLl9lZGl0b3IpPy5jbG9zZU1lc3NhZ2UoKTtcblx0XHR0aGlzLl9jdXJyZW50UGFzdGVPcGVyYXRpb24/LmNhbmNlbCgpO1xuXHRcdHRoaXMuX2N1cnJlbnRQYXN0ZU9wZXJhdGlvbiA9IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0aWYgKCFzZWxlY3Rpb25zPy5sZW5ndGggfHwgIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ucmVhZE9ubHkpIC8vIE5ldmVyIGVuYWJsZWQgaWYgZWRpdG9yIGlzIHJlYWRvbmx5LlxuXHRcdFx0fHwgKCF0aGlzLmlzUGFzdGVBc0VuYWJsZWQoKSAmJiAhdGhpcy5fcGFzdGVBc0FjdGlvbkNvbnRleHQpIC8vIE9yIGZlYXR1cmUgZGlzYWJsZWQgKGJ1dCBzdGlsbCBlbmFibGUgaWYgcGFzdGUgd2FzIGV4cGxpY2l0bHkgcmVxdWVzdGVkKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1ldGFkYXRhID0gdGhpcy5mZXRjaENvcHlNZXRhZGF0YShlKTtcblx0XHRjb25zdCBkYXRhVHJhbnNmZXIgPSB0b0V4dGVybmFsVlNEYXRhVHJhbnNmZXIoZS5jbGlwYm9hcmREYXRhKTtcblx0XHRkYXRhVHJhbnNmZXIuZGVsZXRlKHZzY29kZUNsaXBib2FyZE1pbWUpO1xuXG5cdFx0Y29uc3QgZmlsZVR5cGVzID0gQXJyYXkuZnJvbShlLmNsaXBib2FyZERhdGEuZmlsZXMpLm1hcChmaWxlID0+IGZpbGUudHlwZSk7XG5cblx0XHRjb25zdCBhbGxQb3RlbnRpYWxNaW1lVHlwZXMgPSBbXG5cdFx0XHQuLi5lLmNsaXBib2FyZERhdGEudHlwZXMsXG5cdFx0XHQuLi5maWxlVHlwZXMsXG5cdFx0XHQuLi5tZXRhZGF0YT8ucHJvdmlkZXJDb3B5TWltZVR5cGVzID8/IFtdLFxuXHRcdFx0Ly8gVE9ETzogYWx3YXlzIGFkZHMgYHVyaS1saXN0YCBiZWNhdXNlIHRoaXMgZ2V0IHNldCBpZiB0aGVyZSBhcmUgcmVzb3VyY2VzIGluIHRoZSBzeXN0ZW0gY2xpcGJvYXJkLlxuXHRcdFx0Ly8gSG93ZXZlciB3ZSBjYW4gb25seSBjaGVjayB0aGUgc3lzdGVtIGNsaXBib2FyZCBhc3luYy4gRm9yIHRoaXMgZWFybHkgY2hlY2ssIGp1c3QgYWRkIGl0IGluLlxuXHRcdFx0Ly8gV2UgZmlsdGVyIHByb3ZpZGVycyBhZ2FpbiBvbmNlIHdlIGhhdmUgdGhlIGZpbmFsIGRhdGFUcmFuc2ZlciB3ZSB3aWxsIHVzZS5cblx0XHRcdE1pbWVzLnVyaUxpc3QsXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFsbFByb3ZpZGVycyA9IHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50UGFzdGVFZGl0UHJvdmlkZXJcblx0XHRcdC5vcmRlcmVkKG1vZGVsKVxuXHRcdFx0LmZpbHRlcihwcm92aWRlciA9PiB7XG5cdFx0XHRcdC8vIEZpbHRlciBvdXQgcHJvdmlkZXJzIHRoYXQgZG9uJ3QgbWF0Y2ggdGhlIHJlcXVlc3RlZCBwYXN0ZSB0eXBlc1xuXHRcdFx0XHRjb25zdCBwcmVmZXJlbmNlID0gdGhpcy5fcGFzdGVBc0FjdGlvbkNvbnRleHQ/LnByZWZlcnJlZDtcblx0XHRcdFx0aWYgKHByZWZlcmVuY2UpIHtcblx0XHRcdFx0XHRpZiAoIXRoaXMucHJvdmlkZXJNYXRjaGVzUHJlZmVyZW5jZShwcm92aWRlciwgcHJlZmVyZW5jZSkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBBbmQgcHJvdmlkZXJzIHRoYXQgZG9uJ3QgaGFuZGxlIGFueSBvZiBtaW1lIHR5cGVzIGluIHRoZSBjbGlwYm9hcmRcblx0XHRcdFx0cmV0dXJuIHByb3ZpZGVyLnBhc3RlTWltZVR5cGVzPy5zb21lKHR5cGUgPT4gbWF0Y2hlc01pbWVUeXBlKHR5cGUsIGFsbFBvdGVudGlhbE1pbWVUeXBlcykpO1xuXHRcdFx0fSk7XG5cdFx0aWYgKCFhbGxQcm92aWRlcnMubGVuZ3RoKSB7XG5cdFx0XHRpZiAodGhpcy5fcGFzdGVBc0FjdGlvbkNvbnRleHQ/LnByZWZlcnJlZCkge1xuXHRcdFx0XHR0aGlzLnNob3dQYXN0ZUFzTm9FZGl0TWVzc2FnZShzZWxlY3Rpb25zLCB0aGlzLl9wYXN0ZUFzQWN0aW9uQ29udGV4dC5wcmVmZXJyZWQpO1xuXG5cdFx0XHRcdC8vIEFsc28gcHJldmVudCBkZWZhdWx0IHBhc3RlIGZyb20gYXBwbHlpbmdcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFByZXZlbnQgdGhlIGVkaXRvcidzIGRlZmF1bHQgcGFzdGUgaGFuZGxlciBmcm9tIHJ1bm5pbmcuXG5cdFx0Ly8gTm90ZSB0aGF0IGFmdGVyIHRoaXMgcG9pbnQsIHdlIGFyZSBmdWxseSByZXNwb25zaWJsZSBmb3IgaGFuZGxpbmcgcGFzdGUuXG5cdFx0Ly8gSWYgd2UgY2FuJ3QgcHJvdmlkZXIgYSBwYXN0ZSBmb3IgYW55IHJlYXNvbiwgd2UgbmVlZCB0byBleHBsaWNpdGx5IGRlbGVnYXRlIHBhc3RpbmcgYmFjayB0byB0aGUgZWRpdG9yLlxuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXG5cdFx0aWYgKHRoaXMuX3Bhc3RlQXNBY3Rpb25Db250ZXh0KSB7XG5cdFx0XHR0aGlzLnNob3dQYXN0ZUFzUGljayh0aGlzLl9wYXN0ZUFzQWN0aW9uQ29udGV4dC5wcmVmZXJyZWQsIGFsbFByb3ZpZGVycywgc2VsZWN0aW9ucywgZGF0YVRyYW5zZmVyLCBtZXRhZGF0YSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZG9QYXN0ZUlubGluZShhbGxQcm92aWRlcnMsIHNlbGVjdGlvbnMsIGRhdGFUcmFuc2ZlciwgbWV0YWRhdGEsIGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2hvd1Bhc3RlQXNOb0VkaXRNZXNzYWdlKHNlbGVjdGlvbnM6IHJlYWRvbmx5IFNlbGVjdGlvbltdLCBwcmVmZXJlbmNlOiBQYXN0ZVByZWZlcmVuY2UpIHtcblx0XHRjb25zdCBraW5kTGFiZWwgPSAnb25seScgaW4gcHJlZmVyZW5jZVxuXHRcdFx0PyBwcmVmZXJlbmNlLm9ubHkudmFsdWVcblx0XHRcdDogJ3ByZWZlcmVuY2VzJyBpbiBwcmVmZXJlbmNlXG5cdFx0XHRcdD8gKHByZWZlcmVuY2UucHJlZmVyZW5jZXMubGVuZ3RoID8gcHJlZmVyZW5jZS5wcmVmZXJlbmNlcy5tYXAocHJlZmVyZW5jZSA9PiBwcmVmZXJlbmNlLnZhbHVlKS5qb2luKCcsICcpIDogbG9jYWxpemUoJ25vUHJlZmVyZW5jZXMnLCBcImVtcHR5XCIpKVxuXHRcdFx0XHQ6IHByZWZlcmVuY2UucHJvdmlkZXJJZDtcblxuXHRcdE1lc3NhZ2VDb250cm9sbGVyLmdldCh0aGlzLl9lZGl0b3IpPy5zaG93TWVzc2FnZShsb2NhbGl6ZSgncGFzdGVBc0Vycm9yJywgXCJObyBwYXN0ZSBlZGl0cyBmb3IgJ3swfScgZm91bmRcIiwga2luZExhYmVsKSwgc2VsZWN0aW9uc1swXS5nZXRTdGFydFBvc2l0aW9uKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1Bhc3RlSW5saW5lKGFsbFByb3ZpZGVyczogcmVhZG9ubHkgRG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlcltdLCBzZWxlY3Rpb25zOiByZWFkb25seSBTZWxlY3Rpb25bXSwgZGF0YVRyYW5zZmVyOiBWU0RhdGFUcmFuc2ZlciwgbWV0YWRhdGE6IENvcHlNZXRhZGF0YSB8IHVuZGVmaW5lZCwgY2xpcGJvYXJkRXZlbnQ6IENsaXBib2FyZEV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5fZWRpdG9yO1xuXHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3JTdGF0ZUN0cyA9IG5ldyBFZGl0b3JTdGF0ZUNhbmNlbGxhdGlvblRva2VuU291cmNlKGVkaXRvciwgQ29kZUVkaXRvclN0YXRlRmxhZy5WYWx1ZSB8IENvZGVFZGl0b3JTdGF0ZUZsYWcuU2VsZWN0aW9uLCB1bmRlZmluZWQpO1xuXG5cdFx0Y29uc3QgcCA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKGFzeW5jIChwVG9rZW4pID0+IHtcblx0XHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuX2VkaXRvcjtcblx0XHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblxuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRjb25zdCBjdHMgPSBkaXNwb3NhYmxlcy5hZGQobmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKHBUb2tlbikpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVkaXRvclN0YXRlQ3RzLnRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IGN0cy5jYW5jZWwoKSkpO1xuXG5cdFx0XHRjb25zdCB0b2tlbiA9IGN0cy50b2tlbjtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMubWVyZ2VJbkRhdGFGcm9tQ29weShhbGxQcm92aWRlcnMsIGRhdGFUcmFuc2ZlciwgbWV0YWRhdGEsIHRva2VuKTtcblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgc3VwcG9ydGVkUHJvdmlkZXJzID0gYWxsUHJvdmlkZXJzLmZpbHRlcihwcm92aWRlciA9PiB0aGlzLmlzU3VwcG9ydGVkUGFzdGVQcm92aWRlcihwcm92aWRlciwgZGF0YVRyYW5zZmVyKSk7XG5cdFx0XHRcdGlmICghc3VwcG9ydGVkUHJvdmlkZXJzLmxlbmd0aFxuXHRcdFx0XHRcdHx8IChzdXBwb3J0ZWRQcm92aWRlcnMubGVuZ3RoID09PSAxICYmIHN1cHBvcnRlZFByb3ZpZGVyc1swXSBpbnN0YW5jZW9mIERlZmF1bHRUZXh0UGFzdGVPckRyb3BFZGl0UHJvdmlkZXIpIC8vIE9ubHkgb3VyIGRlZmF1bHQgdGV4dCBwcm92aWRlciBpcyBhY3RpdmVcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuYXBwbHlEZWZhdWx0UGFzdGVIYW5kbGVyKGRhdGFUcmFuc2ZlciwgbWV0YWRhdGEsIHRva2VuLCBjbGlwYm9hcmRFdmVudCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBjb250ZXh0OiBEb2N1bWVudFBhc3RlQ29udGV4dCA9IHtcblx0XHRcdFx0XHR0cmlnZ2VyS2luZDogRG9jdW1lbnRQYXN0ZVRyaWdnZXJLaW5kLkF1dG9tYXRpYyxcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRjb25zdCBlZGl0U2Vzc2lvbiA9IGF3YWl0IHRoaXMuZ2V0UGFzdGVFZGl0cyhzdXBwb3J0ZWRQcm92aWRlcnMsIGRhdGFUcmFuc2ZlciwgbW9kZWwsIHNlbGVjdGlvbnMsIGNvbnRleHQsIHRva2VuKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVkaXRTZXNzaW9uKTtcblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gSWYgdGhlIG9ubHkgZWRpdCByZXR1cm5lZCBpcyBvdXIgZGVmYXVsdCB0ZXh0IGVkaXQsIHVzZSB0aGUgZGVmYXVsdCBwYXN0ZSBoYW5kbGVyXG5cdFx0XHRcdGlmIChlZGl0U2Vzc2lvbi5lZGl0cy5sZW5ndGggPT09IDEgJiYgZWRpdFNlc3Npb24uZWRpdHNbMF0ucHJvdmlkZXIgaW5zdGFuY2VvZiBEZWZhdWx0VGV4dFBhc3RlT3JEcm9wRWRpdFByb3ZpZGVyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuYXBwbHlEZWZhdWx0UGFzdGVIYW5kbGVyKGRhdGFUcmFuc2ZlciwgbWV0YWRhdGEsIHRva2VuLCBjbGlwYm9hcmRFdmVudCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZWRpdFNlc3Npb24uZWRpdHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2FuU2hvd1dpZGdldCA9IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnBhc3RlQXMpLnNob3dQYXN0ZVNlbGVjdG9yID09PSAnYWZ0ZXJQYXN0ZSc7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX3Bvc3RQYXN0ZVdpZGdldE1hbmFnZXIuYXBwbHlFZGl0QW5kU2hvd0lmTmVlZGVkKHNlbGVjdGlvbnMsIHsgYWN0aXZlRWRpdEluZGV4OiB0aGlzLmdldEluaXRpYWxBY3RpdmVFZGl0SW5kZXgobW9kZWwsIGVkaXRTZXNzaW9uLmVkaXRzKSwgYWxsRWRpdHM6IGVkaXRTZXNzaW9uLmVkaXRzIH0sIGNhblNob3dXaWRnZXQsIGFzeW5jIChlZGl0LCByZXNvbHZlVG9rZW4pID0+IHtcblx0XHRcdFx0XHRcdGlmICghZWRpdC5wcm92aWRlci5yZXNvbHZlRG9jdW1lbnRQYXN0ZUVkaXQpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGVkaXQ7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGNvbnN0IHJlc29sdmVQID0gZWRpdC5wcm92aWRlci5yZXNvbHZlRG9jdW1lbnRQYXN0ZUVkaXQoZWRpdCwgcmVzb2x2ZVRva2VuKTtcblx0XHRcdFx0XHRcdGNvbnN0IHNob3dQID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRcdFx0XHRcdFx0Y29uc3QgcmVzb2x2ZWQgPSBhd2FpdCB0aGlzLl9wYXN0ZVByb2dyZXNzTWFuYWdlci5zaG93V2hpbGUoc2VsZWN0aW9uc1swXS5nZXRFbmRQb3NpdGlvbigpLCBsb2NhbGl6ZSgncmVzb2x2ZVByb2Nlc3MnLCBcIlJlc29sdmluZyBwYXN0ZSBlZGl0IGZvciAnezB9Jy4gQ2xpY2sgdG8gY2FuY2VsXCIsIGVkaXQudGl0bGUpLCByYWNlQ2FuY2VsbGF0aW9uKFByb21pc2UucmFjZShbc2hvd1AucCwgcmVzb2x2ZVBdKSwgcmVzb2x2ZVRva2VuKSwge1xuXHRcdFx0XHRcdFx0XHRjYW5jZWw6ICgpID0+IHNob3dQLmNhbmNlbCgpXG5cdFx0XHRcdFx0XHR9LCAwKTtcblxuXHRcdFx0XHRcdFx0aWYgKHJlc29sdmVkKSB7XG5cdFx0XHRcdFx0XHRcdGVkaXQuaW5zZXJ0VGV4dCA9IHJlc29sdmVkLmluc2VydFRleHQ7XG5cdFx0XHRcdFx0XHRcdGVkaXQuYWRkaXRpb25hbEVkaXQgPSByZXNvbHZlZC5hZGRpdGlvbmFsRWRpdDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBlZGl0O1xuXHRcdFx0XHRcdH0sIHRva2VuKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGF3YWl0IHRoaXMuYXBwbHlEZWZhdWx0UGFzdGVIYW5kbGVyKGRhdGFUcmFuc2ZlciwgbWV0YWRhdGEsIHRva2VuLCBjbGlwYm9hcmRFdmVudCk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdGlmICh0aGlzLl9jdXJyZW50UGFzdGVPcGVyYXRpb24gPT09IHApIHtcblx0XHRcdFx0XHR0aGlzLl9jdXJyZW50UGFzdGVPcGVyYXRpb24gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuX3Bhc3RlUHJvZ3Jlc3NNYW5hZ2VyLnNob3dXaGlsZShzZWxlY3Rpb25zWzBdLmdldEVuZFBvc2l0aW9uKCksIGxvY2FsaXplKCdwYXN0ZUludG9FZGl0b3JQcm9ncmVzcycsIFwiUnVubmluZyBwYXN0ZSBoYW5kbGVycy4gQ2xpY2sgdG8gY2FuY2VsIGFuZCBkbyBiYXNpYyBwYXN0ZVwiKSwgcCwge1xuXHRcdFx0Y2FuY2VsOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cC5jYW5jZWwoKTtcblxuXHRcdFx0XHRcdGlmIChlZGl0b3JTdGF0ZUN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGF3YWl0IHRoaXMuYXBwbHlEZWZhdWx0UGFzdGVIYW5kbGVyKGRhdGFUcmFuc2ZlciwgbWV0YWRhdGEsIGVkaXRvclN0YXRlQ3RzLnRva2VuLCBjbGlwYm9hcmRFdmVudCk7XG5cdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0ZWRpdG9yU3RhdGVDdHMuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkudGhlbigoKSA9PiB7XG5cdFx0XHRlZGl0b3JTdGF0ZUN0cy5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5fY3VycmVudFBhc3RlT3BlcmF0aW9uID0gcDtcblx0fVxuXG5cdHByaXZhdGUgc2hvd1Bhc3RlQXNQaWNrKHByZWZlcmVuY2U6IFBhc3RlUHJlZmVyZW5jZSB8IHVuZGVmaW5lZCwgYWxsUHJvdmlkZXJzOiByZWFkb25seSBEb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyW10sIHNlbGVjdGlvbnM6IHJlYWRvbmx5IFNlbGVjdGlvbltdLCBkYXRhVHJhbnNmZXI6IFZTRGF0YVRyYW5zZmVyLCBtZXRhZGF0YTogQ29weU1ldGFkYXRhIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgcCA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKGFzeW5jICh0b2tlbikgPT4ge1xuXHRcdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5fZWRpdG9yO1xuXHRcdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGNvbnN0IHRva2VuU291cmNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBFZGl0b3JTdGF0ZUNhbmNlbGxhdGlvblRva2VuU291cmNlKGVkaXRvciwgQ29kZUVkaXRvclN0YXRlRmxhZy5WYWx1ZSB8IENvZGVFZGl0b3JTdGF0ZUZsYWcuU2VsZWN0aW9uLCB1bmRlZmluZWQsIHRva2VuKSk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLm1lcmdlSW5EYXRhRnJvbUNvcHkoYWxsUHJvdmlkZXJzLCBkYXRhVHJhbnNmZXIsIG1ldGFkYXRhLCB0b2tlblNvdXJjZS50b2tlbik7XG5cdFx0XHRcdGlmICh0b2tlblNvdXJjZS50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEZpbHRlciBvdXQgYW55IHByb3ZpZGVycyB0aGUgZG9uJ3QgbWF0Y2ggdGhlIGZ1bGwgZGF0YSB0cmFuc2ZlciB3ZSB3aWxsIHNlbmQgdGhlbS5cblx0XHRcdFx0bGV0IHN1cHBvcnRlZFByb3ZpZGVycyA9IGFsbFByb3ZpZGVycy5maWx0ZXIocHJvdmlkZXIgPT4gdGhpcy5pc1N1cHBvcnRlZFBhc3RlUHJvdmlkZXIocHJvdmlkZXIsIGRhdGFUcmFuc2ZlciwgcHJlZmVyZW5jZSkpO1xuXHRcdFx0XHRpZiAocHJlZmVyZW5jZSkge1xuXHRcdFx0XHRcdC8vIFdlIGFyZSBsb29raW5nIGZvciBhIHNwZWNpZmljIGVkaXRcblx0XHRcdFx0XHRzdXBwb3J0ZWRQcm92aWRlcnMgPSBzdXBwb3J0ZWRQcm92aWRlcnMuZmlsdGVyKHByb3ZpZGVyID0+IHRoaXMucHJvdmlkZXJNYXRjaGVzUHJlZmVyZW5jZShwcm92aWRlciwgcHJlZmVyZW5jZSkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgY29udGV4dDogRG9jdW1lbnRQYXN0ZUNvbnRleHQgPSB7XG5cdFx0XHRcdFx0dHJpZ2dlcktpbmQ6IERvY3VtZW50UGFzdGVUcmlnZ2VyS2luZC5QYXN0ZUFzLFxuXHRcdFx0XHRcdG9ubHk6IHByZWZlcmVuY2UgJiYgJ29ubHknIGluIHByZWZlcmVuY2UgPyBwcmVmZXJlbmNlLm9ubHkgOiB1bmRlZmluZWQsXG5cdFx0XHRcdH07XG5cdFx0XHRcdGxldCBlZGl0U2Vzc2lvbiA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCB0aGlzLmdldFBhc3RlRWRpdHMoc3VwcG9ydGVkUHJvdmlkZXJzLCBkYXRhVHJhbnNmZXIsIG1vZGVsLCBzZWxlY3Rpb25zLCBjb250ZXh0LCB0b2tlblNvdXJjZS50b2tlbikpO1xuXHRcdFx0XHRpZiAodG9rZW5Tb3VyY2UudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBGaWx0ZXIgb3V0IGFueSBlZGl0cyB0aGF0IGRvbid0IG1hdGNoIHRoZSByZXF1ZXN0ZWQga2luZFxuXHRcdFx0XHRpZiAocHJlZmVyZW5jZSkge1xuXHRcdFx0XHRcdGVkaXRTZXNzaW9uID0ge1xuXHRcdFx0XHRcdFx0ZWRpdHM6IGVkaXRTZXNzaW9uLmVkaXRzLmZpbHRlcihlZGl0ID0+IHtcblx0XHRcdFx0XHRcdFx0aWYgKCdvbmx5JyBpbiBwcmVmZXJlbmNlKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHByZWZlcmVuY2Uub25seS5jb250YWlucyhlZGl0LmtpbmQpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCdwcmVmZXJlbmNlcycgaW4gcHJlZmVyZW5jZSkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBwcmVmZXJlbmNlLnByZWZlcmVuY2VzLnNvbWUocHJlZmVyZW5jZSA9PiBwcmVmZXJlbmNlLmNvbnRhaW5zKGVkaXQua2luZCkpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBwcmVmZXJlbmNlLnByb3ZpZGVySWQgPT09IGVkaXQucHJvdmlkZXIuaWQ7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdFx0ZGlzcG9zZTogZWRpdFNlc3Npb24uZGlzcG9zZVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWVkaXRTZXNzaW9uLmVkaXRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGlmIChwcmVmZXJlbmNlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnNob3dQYXN0ZUFzTm9FZGl0TWVzc2FnZShzZWxlY3Rpb25zLCBwcmVmZXJlbmNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IHBpY2tlZEVkaXQ6IERvY3VtZW50UGFzdGVFZGl0IHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAocHJlZmVyZW5jZSkge1xuXHRcdFx0XHRcdHBpY2tlZEVkaXQgPSBlZGl0U2Vzc2lvbi5lZGl0cy5hdCgwKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0eXBlIEl0ZW1XaXRoRWRpdCA9IElRdWlja1BpY2tJdGVtICYgeyBlZGl0PzogRG9jdW1lbnRQYXN0ZUVkaXQgfTtcblx0XHRcdFx0XHRjb25zdCBjb25maWd1cmVEZWZhdWx0SXRlbTogSXRlbVdpdGhFZGl0ID0ge1xuXHRcdFx0XHRcdFx0aWQ6ICdlZGl0b3IucGFzdGVBcy5kZWZhdWx0Jyxcblx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgncGFzdGVBc0RlZmF1bHQnLCBcIkNvbmZpZ3VyZSBkZWZhdWx0IHBhc3RlIGFjdGlvblwiKSxcblx0XHRcdFx0XHRcdGVkaXQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0Y29uc3Qgc2VsZWN0ZWQgPSBhd2FpdCB0aGlzLl9xdWlja0lucHV0U2VydmljZS5waWNrPEl0ZW1XaXRoRWRpdD4oXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdC4uLmVkaXRTZXNzaW9uLmVkaXRzLm1hcCgoZWRpdCk6IEl0ZW1XaXRoRWRpdCA9PiAoe1xuXHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBlZGl0LnRpdGxlLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBlZGl0LmtpbmQ/LnZhbHVlLFxuXHRcdFx0XHRcdFx0XHRcdGVkaXQsXG5cdFx0XHRcdFx0XHRcdH0pKSxcblx0XHRcdFx0XHRcdFx0Li4uKENvcHlQYXN0ZUNvbnRyb2xsZXIuX2NvbmZpZ3VyZURlZmF1bHRBY3Rpb24gPyBbXG5cdFx0XHRcdFx0XHRcdFx0dXBjYXN0PElRdWlja1BpY2tTZXBhcmF0b3I+KHsgdHlwZTogJ3NlcGFyYXRvcicgfSksXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bGFiZWw6IENvcHlQYXN0ZUNvbnRyb2xsZXIuX2NvbmZpZ3VyZURlZmF1bHRBY3Rpb24ubGFiZWwsXG5cdFx0XHRcdFx0XHRcdFx0XHRlZGl0OiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRdIDogW10pXG5cdFx0XHRcdFx0XHRdLCB7XG5cdFx0XHRcdFx0XHRwbGFjZUhvbGRlcjogbG9jYWxpemUoJ3Bhc3RlQXNQaWNrZXJQbGFjZWhvbGRlcicsIFwiU2VsZWN0IFBhc3RlIEFjdGlvblwiKSxcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGlmIChzZWxlY3RlZCA9PT0gY29uZmlndXJlRGVmYXVsdEl0ZW0pIHtcblx0XHRcdFx0XHRcdENvcHlQYXN0ZUNvbnRyb2xsZXIuX2NvbmZpZ3VyZURlZmF1bHRBY3Rpb24/LnJ1bigpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHBpY2tlZEVkaXQgPSBzZWxlY3RlZD8uZWRpdDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghcGlja2VkRWRpdCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGNvbWJpbmVkV29ya3NwYWNlRWRpdCA9IGNyZWF0ZUNvbWJpbmVkV29ya3NwYWNlRWRpdChtb2RlbC51cmksIHNlbGVjdGlvbnMsIHBpY2tlZEVkaXQpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9idWxrRWRpdFNlcnZpY2UuYXBwbHkoY29tYmluZWRXb3Jrc3BhY2VFZGl0LCB7IGVkaXRvcjogdGhpcy5fZWRpdG9yIH0pO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHRpZiAodGhpcy5fY3VycmVudFBhc3RlT3BlcmF0aW9uID09PSBwKSB7XG5cdFx0XHRcdFx0dGhpcy5fY3VycmVudFBhc3RlT3BlcmF0aW9uID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHtcblx0XHRcdGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLldpbmRvdyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgncGFzdGVBc1Byb2dyZXNzJywgXCJSdW5uaW5nIHBhc3RlIGhhbmRsZXJzXCIpLFxuXHRcdH0sICgpID0+IHApO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRDb3B5TWV0YWRhdGEoZGF0YVRyYW5zZmVyOiBEYXRhVHJhbnNmZXIsIG1ldGFkYXRhOiBDb3B5TWV0YWRhdGEpIHtcblx0XHRkYXRhVHJhbnNmZXIuc2V0RGF0YSh2c2NvZGVDbGlwYm9hcmRNaW1lLCBKU09OLnN0cmluZ2lmeShtZXRhZGF0YSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBmZXRjaENvcHlNZXRhZGF0YShlOiBDbGlwYm9hcmRFdmVudCk6IENvcHlNZXRhZGF0YSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFlLmNsaXBib2FyZERhdGEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBQcmVmZXIgdXNpbmcgdGhlIGNsaXBib2FyZCBkYXRhIHdlIHNhdmVkIG9mZlxuXHRcdGNvbnN0IHJhd01ldGFkYXRhID0gZS5jbGlwYm9hcmREYXRhLmdldERhdGEodnNjb2RlQ2xpcGJvYXJkTWltZSk7XG5cdFx0aWYgKHJhd01ldGFkYXRhKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRyZXR1cm4gSlNPTi5wYXJzZShyYXdNZXRhZGF0YSk7XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2UgdHJ5IHRvIGV4dHJhY3QgdGhlIGdlbmVyaWMgdGV4dCBlZGl0b3IgbWV0YWRhdGFcblx0XHRjb25zdCBbXywgbWV0YWRhdGFdID0gQ2xpcGJvYXJkRXZlbnRVdGlscy5nZXRUZXh0RGF0YShlLmNsaXBib2FyZERhdGEpO1xuXHRcdGlmIChtZXRhZGF0YSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZGVmYXVsdFBhc3RlUGF5bG9hZDoge1xuXHRcdFx0XHRcdG1vZGU6IG1ldGFkYXRhLm1vZGUsXG5cdFx0XHRcdFx0bXVsdGljdXJzb3JUZXh0OiBtZXRhZGF0YS5tdWx0aWN1cnNvclRleHQgPz8gbnVsbCxcblx0XHRcdFx0XHRwYXN0ZU9uTmV3TGluZTogISFtZXRhZGF0YS5pc0Zyb21FbXB0eVNlbGVjdGlvbixcblx0XHRcdFx0fSxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbWVyZ2VJbkRhdGFGcm9tQ29weShhbGxQcm92aWRlcnM6IHJlYWRvbmx5IERvY3VtZW50UGFzdGVFZGl0UHJvdmlkZXJbXSwgZGF0YVRyYW5zZmVyOiBWU0RhdGFUcmFuc2ZlciwgbWV0YWRhdGE6IENvcHlNZXRhZGF0YSB8IHVuZGVmaW5lZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKG1ldGFkYXRhPy5pZCAmJiBDb3B5UGFzdGVDb250cm9sbGVyLl9jdXJyZW50Q29weU9wZXJhdGlvbj8uaGFuZGxlID09PSBtZXRhZGF0YS5pZCkge1xuXHRcdFx0Ly8gT25seSByZXNvbHZlIHByb3ZpZGVycyB0aGF0IGhhdmUgZGF0YSB3ZSBtYXkgY2FyZSBhYm91dFxuXHRcdFx0Y29uc3QgdG9SZXNvbHZlID0gQ29weVBhc3RlQ29udHJvbGxlci5fY3VycmVudENvcHlPcGVyYXRpb24ub3BlcmF0aW9uc1xuXHRcdFx0XHQuZmlsdGVyKG9wID0+IGFsbFByb3ZpZGVycy5zb21lKHByb3ZpZGVyID0+IHByb3ZpZGVyLnBhc3RlTWltZVR5cGVzLnNvbWUodHlwZSA9PiBtYXRjaGVzTWltZVR5cGUodHlwZSwgb3AucHJvdmlkZXJNaW1lVHlwZXMpKSkpXG5cdFx0XHRcdC5tYXAob3AgPT4gb3Aub3BlcmF0aW9uKTtcblxuXHRcdFx0Y29uc3QgdG9NZXJnZVJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbCh0b1Jlc29sdmUpO1xuXHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gVmFsdWVzIGZyb20gaGlnaGVyIHByaW9yaXR5IHByb3ZpZGVycyBzaG91bGQgb3ZlcndyaXRlIHZhbHVlcyBmcm9tIGxvd2VyIHByaW9yaXR5IG9uZXMuXG5cdFx0XHQvLyBSZXZlcnNlIHRoZSBhcnJheSB0byBzbyB0aGF0IHRoZSBjYWxscyB0byBgRGF0YVRyYW5zZmVyLnJlcGxhY2VgIGxhdGVyIHdpbGwgZG8gdGhpc1xuXHRcdFx0Zm9yIChjb25zdCB0b01lcmdlRGF0YSBvZiB0b01lcmdlUmVzdWx0cy5yZXZlcnNlKCkpIHtcblx0XHRcdFx0aWYgKHRvTWVyZ2VEYXRhKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgdG9NZXJnZURhdGEpIHtcblx0XHRcdFx0XHRcdGRhdGFUcmFuc2Zlci5yZXBsYWNlKGtleSwgdmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghZGF0YVRyYW5zZmVyLmhhcyhNaW1lcy51cmlMaXN0KSkge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VzID0gYXdhaXQgdGhpcy5fY2xpcGJvYXJkU2VydmljZS5yZWFkUmVzb3VyY2VzKCk7XG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVzb3VyY2VzLmxlbmd0aCkge1xuXHRcdFx0XHRkYXRhVHJhbnNmZXIuYXBwZW5kKE1pbWVzLnVyaUxpc3QsIGNyZWF0ZVN0cmluZ0RhdGFUcmFuc2Zlckl0ZW0oVXJpTGlzdC5jcmVhdGUocmVzb3VyY2VzKSkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0UGFzdGVFZGl0cyhwcm92aWRlcnM6IHJlYWRvbmx5IERvY3VtZW50UGFzdGVFZGl0UHJvdmlkZXJbXSwgZGF0YVRyYW5zZmVyOiBWU0RhdGFUcmFuc2ZlciwgbW9kZWw6IElUZXh0TW9kZWwsIHNlbGVjdGlvbnM6IHJlYWRvbmx5IFNlbGVjdGlvbltdLCBjb250ZXh0OiBEb2N1bWVudFBhc3RlQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxEb2N1bWVudFBhc3RlV2l0aFByb3ZpZGVyRWRpdHNTZXNzaW9uPiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCByZXN1bHRzID0gYXdhaXQgcmFjZUNhbmNlbGxhdGlvbihcblx0XHRcdFByb21pc2UuYWxsKHByb3ZpZGVycy5tYXAoYXN5bmMgcHJvdmlkZXIgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IGVkaXRzID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZURvY3VtZW50UGFzdGVFZGl0cz8uKG1vZGVsLCBzZWxlY3Rpb25zLCBkYXRhVHJhbnNmZXIsIGNvbnRleHQsIHRva2VuKTtcblx0XHRcdFx0XHRpZiAoZWRpdHMpIHtcblx0XHRcdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChlZGl0cyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBlZGl0cz8uZWRpdHM/Lm1hcChlZGl0ID0+ICh7IC4uLmVkaXQsIHByb3ZpZGVyIH0pKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0aWYgKCFpc0NhbmNlbGxhdGlvbkVycm9yKGVycikpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSkpLFxuXHRcdFx0dG9rZW4pO1xuXHRcdGNvbnN0IGVkaXRzID0gY29hbGVzY2UocmVzdWx0cyA/PyBbXSkuZmxhdCgpLmZpbHRlcihlZGl0ID0+IHtcblx0XHRcdHJldHVybiAhY29udGV4dC5vbmx5IHx8IGNvbnRleHQub25seS5jb250YWlucyhlZGl0LmtpbmQpO1xuXHRcdH0pO1xuXHRcdHJldHVybiB7XG5cdFx0XHRlZGl0czogc29ydEVkaXRzQnlZaWVsZFRvKGVkaXRzKSxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGFwcGx5RGVmYXVsdFBhc3RlSGFuZGxlcihkYXRhVHJhbnNmZXI6IFZTRGF0YVRyYW5zZmVyLCBtZXRhZGF0YTogQ29weU1ldGFkYXRhIHwgdW5kZWZpbmVkLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIGNsaXBib2FyZEV2ZW50OiBDbGlwYm9hcmRFdmVudCkge1xuXHRcdGNvbnN0IHRleHREYXRhVHJhbnNmZXIgPSBkYXRhVHJhbnNmZXIuZ2V0KE1pbWVzLnRleHQpID8/IGRhdGFUcmFuc2Zlci5nZXQoJ3RleHQnKTtcblx0XHRjb25zdCB0ZXh0ID0gKGF3YWl0IHRleHREYXRhVHJhbnNmZXI/LmFzU3RyaW5nKCkpID8/ICcnO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBheWxvYWQ6IFBhc3RlUGF5bG9hZCA9IHtcblx0XHRcdGNsaXBib2FyZEV2ZW50LFxuXHRcdFx0dGV4dCxcblx0XHRcdHBhc3RlT25OZXdMaW5lOiBtZXRhZGF0YT8uZGVmYXVsdFBhc3RlUGF5bG9hZC5wYXN0ZU9uTmV3TGluZSA/PyBmYWxzZSxcblx0XHRcdG11bHRpY3Vyc29yVGV4dDogbWV0YWRhdGE/LmRlZmF1bHRQYXN0ZVBheWxvYWQubXVsdGljdXJzb3JUZXh0ID8/IG51bGwsXG5cdFx0XHRtb2RlOiBudWxsLFxuXHRcdH07XG5cdFx0dGhpcy5fZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5QYXN0ZSwgcGF5bG9hZCk7XG5cdH1cblxuXHQvKipcblx0ICogRmlsdGVyIG91dCBwcm92aWRlcnMgaWYgdGhleTpcblx0ICogLSBEb24ndCBoYW5kbGUgYW55IG9mIHRoZSBkYXRhIHRyYW5zZmVyIHR5cGVzIHdlIGhhdmVcblx0ICogLSBEb24ndCBtYXRjaCB0aGUgcHJlZmVycmVkIHBhc3RlIGtpbmRcblx0ICovXG5cdHByaXZhdGUgaXNTdXBwb3J0ZWRQYXN0ZVByb3ZpZGVyKHByb3ZpZGVyOiBEb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyLCBkYXRhVHJhbnNmZXI6IFZTRGF0YVRyYW5zZmVyLCBwcmVmZXJlbmNlPzogUGFzdGVQcmVmZXJlbmNlKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFwcm92aWRlci5wYXN0ZU1pbWVUeXBlcz8uc29tZSh0eXBlID0+IGRhdGFUcmFuc2Zlci5tYXRjaGVzKHR5cGUpKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiAhcHJlZmVyZW5jZSB8fCB0aGlzLnByb3ZpZGVyTWF0Y2hlc1ByZWZlcmVuY2UocHJvdmlkZXIsIHByZWZlcmVuY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBwcm92aWRlck1hdGNoZXNQcmVmZXJlbmNlKHByb3ZpZGVyOiBEb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyLCBwcmVmZXJlbmNlOiBQYXN0ZVByZWZlcmVuY2UpOiBib29sZWFuIHtcblx0XHRpZiAoJ29ubHknIGluIHByZWZlcmVuY2UpIHtcblx0XHRcdHJldHVybiBwcm92aWRlci5wcm92aWRlZFBhc3RlRWRpdEtpbmRzLnNvbWUocHJvdmlkZWRLaW5kID0+IHByZWZlcmVuY2Uub25seS5jb250YWlucyhwcm92aWRlZEtpbmQpKTtcblx0XHR9IGVsc2UgaWYgKCdwcmVmZXJlbmNlcycgaW4gcHJlZmVyZW5jZSkge1xuXHRcdFx0cmV0dXJuIHByZWZlcmVuY2UucHJlZmVyZW5jZXMuc29tZShwcm92aWRlZEtpbmQgPT4gcHJlZmVyZW5jZS5wcmVmZXJlbmNlcy5zb21lKHByZWZlcnJlZEtpbmQgPT4gcHJlZmVycmVkS2luZC5jb250YWlucyhwcm92aWRlZEtpbmQpKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBwcm92aWRlci5pZCA9PT0gcHJlZmVyZW5jZS5wcm92aWRlcklkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0SW5pdGlhbEFjdGl2ZUVkaXRJbmRleChtb2RlbDogSVRleHRNb2RlbCwgZWRpdHM6IHJlYWRvbmx5IERvY3VtZW50UGFzdGVFZGl0W10pOiBudW1iZXIge1xuXHRcdGNvbnN0IHByZWZlcnJlZFByb3ZpZGVycyA9IHRoaXMuX2NvbmZpZ1NlcnZpY2UuZ2V0VmFsdWU8UHJlZmVycmVkUGFzdGVDb25maWd1cmF0aW9uW10+KHBhc3RlQXNQcmVmZXJlbmNlQ29uZmlnLCB7IHJlc291cmNlOiBtb2RlbC51cmkgfSk7XG5cdFx0Zm9yIChjb25zdCBjb25maWcgb2YgQXJyYXkuaXNBcnJheShwcmVmZXJyZWRQcm92aWRlcnMpID8gcHJlZmVycmVkUHJvdmlkZXJzIDogW10pIHtcblx0XHRcdGNvbnN0IGRlc2lyZWRLaW5kID0gbmV3IEhpZXJhcmNoaWNhbEtpbmQoY29uZmlnKTtcblx0XHRcdGNvbnN0IGVkaXRJbmRleCA9IGVkaXRzLmZpbmRJbmRleChlZGl0ID0+IGRlc2lyZWRLaW5kLmNvbnRhaW5zKGVkaXQua2luZCkpO1xuXHRcdFx0aWYgKGVkaXRJbmRleCA+PSAwKSB7XG5cdFx0XHRcdHJldHVybiBlZGl0SW5kZXg7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIDA7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyw2QkFBNkI7QUFFdEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBNEIseUJBQXlCLGlCQUFpQix3QkFBd0I7QUFDOUYsU0FBNEIsK0JBQStCO0FBQzNELFNBQVMsOEJBQXVELGlCQUFpQixlQUErQjtBQUNo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
