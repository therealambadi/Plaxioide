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
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { raceCancellation } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { CancellationError, onUnexpectedError } from "../../../../base/common/errors.js";
import { isMarkdownString } from "../../../../base/common/htmlContent.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { assertType } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { EditorAction, EditorCommand, EditorContributionInstantiation, registerEditorAction, registerEditorCommand, registerEditorContribution, registerModelAndPositionCommand } from "../../../browser/editorExtensions.js";
import { IBulkEditService } from "../../../browser/services/bulkEditService.js";
import { ICodeEditorService } from "../../../browser/services/codeEditorService.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { NewSymbolNameTriggerKind } from "../../../common/languages.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { ITextResourceConfigurationService } from "../../../common/services/textResourceConfiguration.js";
import { CodeEditorStateFlag, EditorStateCancellationTokenSource } from "../../editorState/browser/editorState.js";
import { MessageController } from "../../message/browser/messageController.js";
import * as nls from "../../../../nls.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ConfigurationScope, Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IEditorProgressService } from "../../../../platform/progress/common/progress.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { CONTEXT_RENAME_INPUT_VISIBLE, RenameWidget } from "./renameWidget.js";
class RenameSkeleton {
  constructor(model, position, registry) {
    this.model = model;
    this.position = position;
    this._providerRenameIdx = 0;
    this._providers = registry.ordered(model);
  }
  hasProvider() {
    return this._providers.length > 0;
  }
  async resolveRenameLocation(token) {
    const rejects = [];
    for (this._providerRenameIdx = 0; this._providerRenameIdx < this._providers.length; this._providerRenameIdx++) {
      const provider = this._providers[this._providerRenameIdx];
      if (!provider.resolveRenameLocation) {
        break;
      }
      const res = await provider.resolveRenameLocation(this.model, this.position, token);
      if (!res) {
        continue;
      }
      if (res.rejectReason) {
        rejects.push(res.rejectReason);
        continue;
      }
      return res;
    }
    this._providerRenameIdx = 0;
    const word = this.model.getWordAtPosition(this.position);
    if (!word) {
      return {
        range: Range.fromPositions(this.position),
        text: "",
        rejectReason: rejects.length > 0 ? rejects.join("\n") : void 0
      };
    }
    return {
      range: new Range(this.position.lineNumber, word.startColumn, this.position.lineNumber, word.endColumn),
      text: word.word,
      rejectReason: rejects.length > 0 ? rejects.join("\n") : void 0
    };
  }
  async provideRenameEdits(newName, token) {
    return this._provideRenameEdits(newName, this._providerRenameIdx, [], token);
  }
  async _provideRenameEdits(newName, i, rejects, token) {
    const provider = this._providers[i];
    if (!provider) {
      return {
        edits: [],
        rejectReason: rejects.join("\n")
      };
    }
    const result = await provider.provideRenameEdits(this.model, this.position, newName, token);
    if (!result) {
      return this._provideRenameEdits(newName, i + 1, rejects.concat(nls.localize("no result", "No result.")), token);
    } else if (result.rejectReason) {
      return this._provideRenameEdits(newName, i + 1, rejects.concat(result.rejectReason), token);
    }
    return result;
  }
}
async function rename(registry, model, position, newName) {
  const skeleton = new RenameSkeleton(model, position, registry);
  const loc = await skeleton.resolveRenameLocation(CancellationToken.None);
  if (loc?.rejectReason) {
    return { edits: [], rejectReason: loc.rejectReason };
  }
  return skeleton.provideRenameEdits(newName, CancellationToken.None);
}
let RenameController = class {
  constructor(editor, _instaService, _notificationService, _bulkEditService, _progressService, _logService, _configService, _languageFeaturesService, _telemetryService) {
    this.editor = editor;
    this._instaService = _instaService;
    this._notificationService = _notificationService;
    this._bulkEditService = _bulkEditService;
    this._progressService = _progressService;
    this._logService = _logService;
    this._configService = _configService;
    this._languageFeaturesService = _languageFeaturesService;
    this._telemetryService = _telemetryService;
    this._disposableStore = new DisposableStore();
    this._cts = new CancellationTokenSource();
    this._renameWidget = this._disposableStore.add(this._instaService.createInstance(RenameWidget, this.editor, ["acceptRenameInput", "acceptRenameInputWithPreview"]));
  }
  static get(editor) {
    return editor.getContribution(RenameController.ID);
  }
  dispose() {
    this._disposableStore.dispose();
    this._cts.dispose(true);
  }
  async run() {
    const trace = this._logService.trace.bind(this._logService, "[rename]");
    this._cts.dispose(true);
    this._cts = new CancellationTokenSource();
    if (!this.editor.hasModel()) {
      trace("editor has no model");
      return void 0;
    }
    const position = this.editor.getPosition();
    const skeleton = new RenameSkeleton(this.editor.getModel(), position, this._languageFeaturesService.renameProvider);
    if (!skeleton.hasProvider()) {
      trace("skeleton has no provider");
      return void 0;
    }
    const cts1 = new EditorStateCancellationTokenSource(this.editor, CodeEditorStateFlag.Position | CodeEditorStateFlag.Value, void 0, this._cts.token);
    let loc;
    try {
      trace("resolving rename location");
      const resolveLocationOperation = skeleton.resolveRenameLocation(cts1.token);
      this._progressService.showWhile(resolveLocationOperation, 250);
      loc = await resolveLocationOperation;
      trace("resolved rename location");
    } catch (e) {
      if (e instanceof CancellationError) {
        trace("resolve rename location cancelled", JSON.stringify(e, null, "	"));
      } else {
        trace("resolve rename location failed", e instanceof Error ? e : JSON.stringify(e, null, "	"));
        if (typeof e === "string" || isMarkdownString(e)) {
          MessageController.get(this.editor)?.showMessage(e || nls.localize("resolveRenameLocationFailed", "An unknown error occurred while resolving rename location"), position);
        }
      }
      return void 0;
    } finally {
      cts1.dispose();
    }
    if (!loc) {
      trace("returning early - no loc");
      return void 0;
    }
    if (loc.rejectReason) {
      trace(`returning early - rejected with reason: ${loc.rejectReason}`, loc.rejectReason);
      MessageController.get(this.editor)?.showMessage(loc.rejectReason, position);
      return void 0;
    }
    if (cts1.token.isCancellationRequested) {
      trace("returning early - cts1 cancelled");
      return void 0;
    }
    const cts2 = new EditorStateCancellationTokenSource(this.editor, CodeEditorStateFlag.Position | CodeEditorStateFlag.Value, loc.range, this._cts.token);
    const model = this.editor.getModel();
    const newSymbolNamesProviders = this._languageFeaturesService.newSymbolNamesProvider.all(model);
    const resolvedNewSymbolnamesProviders = await Promise.all(newSymbolNamesProviders.map(async (p) => [p, await p.supportsAutomaticNewSymbolNamesTriggerKind ?? false]));
    const requestRenameSuggestions = (triggerKind, cts) => {
      let providers = resolvedNewSymbolnamesProviders.slice();
      if (triggerKind === NewSymbolNameTriggerKind.Automatic) {
        providers = providers.filter(([_, supportsAutomatic]) => supportsAutomatic);
      }
      return providers.map(([p]) => p.provideNewSymbolNames(model, loc.range, triggerKind, cts));
    };
    trace("creating rename input field and awaiting its result");
    const supportPreview = this._bulkEditService.hasPreviewHandler() && this._configService.getValue(this.editor.getModel().uri, "editor.rename.enablePreview");
    const inputFieldResult = await this._renameWidget.getInput(
      loc.range,
      loc.text,
      supportPreview,
      newSymbolNamesProviders.length > 0 ? requestRenameSuggestions : void 0,
      cts2
    );
    trace("received response from rename input field");
    if (newSymbolNamesProviders.length > 0) {
      this._reportTelemetry(newSymbolNamesProviders.length, model.getLanguageId(), inputFieldResult);
    }
    if (typeof inputFieldResult === "boolean") {
      trace(`returning early - rename input field response - ${inputFieldResult}`);
      if (inputFieldResult) {
        this.editor.focus();
      }
      cts2.dispose();
      return void 0;
    }
    this.editor.focus();
    trace("requesting rename edits");
    const renameOperation = raceCancellation(skeleton.provideRenameEdits(inputFieldResult.newName, cts2.token), cts2.token).then(async (renameResult) => {
      if (!renameResult) {
        trace("returning early - no rename edits result");
        return;
      }
      if (!this.editor.hasModel()) {
        trace("returning early - no model after rename edits are provided");
        return;
      }
      if (renameResult.rejectReason) {
        trace(`returning early - rejected with reason: ${renameResult.rejectReason}`);
        this._notificationService.info(renameResult.rejectReason);
        return;
      }
      this.editor.setSelection(Range.fromPositions(this.editor.getSelection().getPosition()));
      trace("applying edits");
      this._bulkEditService.apply(renameResult, {
        editor: this.editor,
        showPreview: inputFieldResult.wantsPreview,
        label: nls.localize("label", "Renaming '{0}' to '{1}'", loc?.text, inputFieldResult.newName),
        code: "undoredo.rename",
        quotableLabel: nls.localize("quotableLabel", "Renaming {0} to {1}", loc?.text, inputFieldResult.newName),
        respectAutoSaveConfig: true
      }).then((result) => {
        trace("edits applied");
        if (result.ariaSummary) {
          alert(nls.localize("aria", "Successfully renamed '{0}' to '{1}'. Summary: {2}", loc.text, inputFieldResult.newName, result.ariaSummary));
        }
      }).catch((err) => {
        trace(`error when applying edits ${JSON.stringify(err, null, "	")}`);
        this._notificationService.error(nls.localize("rename.failedApply", "Rename failed to apply edits"));
        this._logService.error(err);
      });
    }, (err) => {
      trace("error when providing rename edits", JSON.stringify(err, null, "	"));
      this._notificationService.error(nls.localize("rename.failed", "Rename failed to compute edits"));
      this._logService.error(err);
    }).finally(() => {
      cts2.dispose();
    });
    trace("returning rename operation");
    this._progressService.showWhile(renameOperation, 250);
    return renameOperation;
  }
  acceptRenameInput(wantsPreview) {
    this._renameWidget.acceptInput(wantsPreview);
  }
  cancelRenameInput() {
    this._renameWidget.cancelInput(true, "cancelRenameInput command");
  }
  focusNextRenameSuggestion() {
    this._renameWidget.focusNextRenameSuggestion();
  }
  focusPreviousRenameSuggestion() {
    this._renameWidget.focusPreviousRenameSuggestion();
  }
  _reportTelemetry(nRenameSuggestionProviders, languageId, inputFieldResult) {
    const value = typeof inputFieldResult === "boolean" ? {
      kind: "cancelled",
      languageId,
      nRenameSuggestionProviders
    } : {
      kind: "accepted",
      languageId,
      nRenameSuggestionProviders,
      source: inputFieldResult.stats.source.k,
      nRenameSuggestions: inputFieldResult.stats.nRenameSuggestions,
      timeBeforeFirstInputFieldEdit: inputFieldResult.stats.timeBeforeFirstInputFieldEdit,
      wantsPreview: inputFieldResult.wantsPreview,
      nRenameSuggestionsInvocations: inputFieldResult.stats.nRenameSuggestionsInvocations,
      hadAutomaticRenameSuggestionsInvocation: inputFieldResult.stats.hadAutomaticRenameSuggestionsInvocation
    };
    this._telemetryService.publicLog2("renameInvokedEvent", value);
  }
};
RenameController.ID = "editor.contrib.renameController";
RenameController = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IBulkEditService),
  __decorateParam(4, IEditorProgressService),
  __decorateParam(5, ILogService),
  __decorateParam(6, ITextResourceConfigurationService),
  __decorateParam(7, ILanguageFeaturesService),
  __decorateParam(8, ITelemetryService)
], RenameController);
class RenameAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.rename",
      label: nls.localize2("rename.label", "Rename Symbol"),
      precondition: ContextKeyExpr.and(EditorContextKeys.writable, EditorContextKeys.hasRenameProvider),
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyCode.F2,
        weight: KeybindingWeight.EditorContrib
      },
      contextMenuOpts: {
        group: "1_modification",
        order: 1.1
      }
    });
  }
  runCommand(accessor, args) {
    const editorService = accessor.get(ICodeEditorService);
    const [uri, pos] = Array.isArray(args) && args || [void 0, void 0];
    if (URI.isUri(uri) && Position.isIPosition(pos)) {
      return editorService.openCodeEditor({ resource: uri }, editorService.getActiveCodeEditor()).then((editor) => {
        if (!editor) {
          return;
        }
        editor.setPosition(pos);
        editor.invokeWithinContext((accessor2) => {
          this.reportTelemetry(accessor2, editor);
          return this.run(accessor2, editor);
        });
      }, onUnexpectedError);
    }
    return super.runCommand(accessor, args);
  }
  run(accessor, editor) {
    const logService = accessor.get(ILogService);
    const controller = RenameController.get(editor);
    if (controller) {
      logService.trace("[RenameAction] got controller, running...");
      return controller.run();
    }
    logService.trace("[RenameAction] returning early - controller missing");
    return Promise.resolve();
  }
}
registerEditorContribution(RenameController.ID, RenameController, EditorContributionInstantiation.Lazy);
registerEditorAction(RenameAction);
const RenameCommand = EditorCommand.bindToContribution(RenameController.get);
registerEditorCommand(new RenameCommand({
  id: "acceptRenameInput",
  precondition: CONTEXT_RENAME_INPUT_VISIBLE,
  handler: (x) => x.acceptRenameInput(false),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 99,
    kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, ContextKeyExpr.not("isComposing")),
    primary: KeyCode.Enter
  }
}));
registerEditorCommand(new RenameCommand({
  id: "acceptRenameInputWithPreview",
  precondition: ContextKeyExpr.and(CONTEXT_RENAME_INPUT_VISIBLE, ContextKeyExpr.has("config.editor.rename.enablePreview")),
  handler: (x) => x.acceptRenameInput(true),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 99,
    kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, ContextKeyExpr.not("isComposing")),
    primary: KeyMod.CtrlCmd + KeyCode.Enter
  }
}));
registerEditorCommand(new RenameCommand({
  id: "cancelRenameInput",
  precondition: CONTEXT_RENAME_INPUT_VISIBLE,
  handler: (x) => x.cancelRenameInput(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 99,
    kbExpr: EditorContextKeys.focus,
    primary: KeyCode.Escape,
    secondary: [KeyMod.Shift | KeyCode.Escape]
  }
}));
registerAction2(class FocusNextRenameSuggestion extends Action2 {
  constructor() {
    super({
      id: "focusNextRenameSuggestion",
      title: {
        ...nls.localize2("focusNextRenameSuggestion", "Focus Next Rename Suggestion")
      },
      precondition: CONTEXT_RENAME_INPUT_VISIBLE,
      keybinding: [
        {
          primary: KeyCode.DownArrow,
          weight: KeybindingWeight.EditorContrib + 99
        }
      ]
    });
  }
  run(accessor) {
    const currentEditor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
    if (!currentEditor) {
      return;
    }
    const controller = RenameController.get(currentEditor);
    if (!controller) {
      return;
    }
    controller.focusNextRenameSuggestion();
  }
});
registerAction2(class FocusPreviousRenameSuggestion extends Action2 {
  constructor() {
    super({
      id: "focusPreviousRenameSuggestion",
      title: {
        ...nls.localize2("focusPreviousRenameSuggestion", "Focus Previous Rename Suggestion")
      },
      precondition: CONTEXT_RENAME_INPUT_VISIBLE,
      keybinding: [
        {
          primary: KeyCode.UpArrow,
          weight: KeybindingWeight.EditorContrib + 99
        }
      ]
    });
  }
  run(accessor) {
    const currentEditor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
    if (!currentEditor) {
      return;
    }
    const controller = RenameController.get(currentEditor);
    if (!controller) {
      return;
    }
    controller.focusPreviousRenameSuggestion();
  }
});
registerModelAndPositionCommand("_executeDocumentRenameProvider", function(accessor, model, position, ...args) {
  const [newName] = args;
  assertType(typeof newName === "string");
  const { renameProvider } = accessor.get(ILanguageFeaturesService);
  return rename(renameProvider, model, position, newName);
});
registerModelAndPositionCommand("_executePrepareRename", async function(accessor, model, position) {
  const { renameProvider } = accessor.get(ILanguageFeaturesService);
  const skeleton = new RenameSkeleton(model, position, renameProvider);
  const loc = await skeleton.resolveRenameLocation(CancellationToken.None);
  if (loc?.rejectReason) {
    throw new Error(loc.rejectReason);
  }
  return loc;
});
Registry.as(Extensions.Configuration).registerConfiguration({
  id: "editor",
  properties: {
    "editor.rename.enablePreview": {
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      description: nls.localize("enablePreview", "Enable/disable the ability to preview changes before renaming"),
      default: true,
      type: "boolean"
    }
  }
});
export {
  RenameAction,
  rename
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9yZW5hbWUvYnJvd3Nlci9yZW5hbWUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBhbGVydCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgcmFjZUNhbmNlbGxhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25FcnJvciwgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgaXNNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGlvbiwgRWRpdG9yQ29tbWFuZCwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbiwgU2VydmljZXNBY2Nlc3NvciwgcmVnaXN0ZXJFZGl0b3JBY3Rpb24sIHJlZ2lzdGVyRWRpdG9yQ29tbWFuZCwgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24sIHJlZ2lzdGVyTW9kZWxBbmRQb3NpdGlvbkNvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUJ1bGtFZGl0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvc2VydmljZXMvYnVsa0VkaXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uLCBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgTmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kLCBSZWplY3Rpb24sIFJlbmFtZUxvY2F0aW9uLCBSZW5hbWVQcm92aWRlciwgV29ya3NwYWNlRWRpdCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvdGV4dFJlc291cmNlQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yU3RhdGVGbGFnLCBFZGl0b3JTdGF0ZUNhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vZWRpdG9yU3RhdGUvYnJvd3Nlci9lZGl0b3JTdGF0ZS5qcyc7XG5pbXBvcnQgeyBNZXNzYWdlQ29udHJvbGxlciB9IGZyb20gJy4uLy4uL21lc3NhZ2UvYnJvd3Nlci9tZXNzYWdlQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblNjb3BlLCBFeHRlbnNpb25zLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgQ09OVEVYVF9SRU5BTUVfSU5QVVRfVklTSUJMRSwgTmV3TmFtZVNvdXJjZSwgUmVuYW1lV2lkZ2V0LCBSZW5hbWVXaWRnZXRSZXN1bHQgfSBmcm9tICcuL3JlbmFtZVdpZGdldC5qcyc7XG5cbmNsYXNzIFJlbmFtZVNrZWxldG9uIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcnM6IFJlbmFtZVByb3ZpZGVyW107XG5cdHByaXZhdGUgX3Byb3ZpZGVyUmVuYW1lSWR4OiBudW1iZXIgPSAwO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwb3NpdGlvbjogUG9zaXRpb24sXG5cdFx0cmVnaXN0cnk6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PFJlbmFtZVByb3ZpZGVyPlxuXHQpIHtcblx0XHR0aGlzLl9wcm92aWRlcnMgPSByZWdpc3RyeS5vcmRlcmVkKG1vZGVsKTtcblx0fVxuXG5cdGhhc1Byb3ZpZGVyKCkge1xuXHRcdHJldHVybiB0aGlzLl9wcm92aWRlcnMubGVuZ3RoID4gMDtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmVSZW5hbWVMb2NhdGlvbih0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFJlbmFtZUxvY2F0aW9uICYgUmVqZWN0aW9uIHwgdW5kZWZpbmVkPiB7XG5cblx0XHRjb25zdCByZWplY3RzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0Zm9yICh0aGlzLl9wcm92aWRlclJlbmFtZUlkeCA9IDA7IHRoaXMuX3Byb3ZpZGVyUmVuYW1lSWR4IDwgdGhpcy5fcHJvdmlkZXJzLmxlbmd0aDsgdGhpcy5fcHJvdmlkZXJSZW5hbWVJZHgrKykge1xuXHRcdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9wcm92aWRlcnNbdGhpcy5fcHJvdmlkZXJSZW5hbWVJZHhdO1xuXHRcdFx0aWYgKCFwcm92aWRlci5yZXNvbHZlUmVuYW1lTG9jYXRpb24pIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZXMgPSBhd2FpdCBwcm92aWRlci5yZXNvbHZlUmVuYW1lTG9jYXRpb24odGhpcy5tb2RlbCwgdGhpcy5wb3NpdGlvbiwgdG9rZW4pO1xuXHRcdFx0aWYgKCFyZXMpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAocmVzLnJlamVjdFJlYXNvbikge1xuXHRcdFx0XHRyZWplY3RzLnB1c2gocmVzLnJlamVjdFJlYXNvbik7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlcztcblx0XHR9XG5cblx0XHQvLyB3ZSBhcmUgaGVyZSB3aGVuIG5vIHByb3ZpZGVyIHByZXBhcmVkIGEgbG9jYXRpb24gd2hpY2ggbWVhbnMgd2UgY2FuXG5cdFx0Ly8ganVzdCByZWx5IG9uIHRoZSB3b3JkIHVuZGVyIGN1cnNvciBhbmQgc3RhcnQgd2l0aCB0aGUgZmlyc3QgcHJvdmlkZXJcblx0XHR0aGlzLl9wcm92aWRlclJlbmFtZUlkeCA9IDA7XG5cblx0XHRjb25zdCB3b3JkID0gdGhpcy5tb2RlbC5nZXRXb3JkQXRQb3NpdGlvbih0aGlzLnBvc2l0aW9uKTtcblx0XHRpZiAoIXdvcmQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tUG9zaXRpb25zKHRoaXMucG9zaXRpb24pLFxuXHRcdFx0XHR0ZXh0OiAnJyxcblx0XHRcdFx0cmVqZWN0UmVhc29uOiByZWplY3RzLmxlbmd0aCA+IDAgPyByZWplY3RzLmpvaW4oJ1xcbicpIDogdW5kZWZpbmVkXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSh0aGlzLnBvc2l0aW9uLmxpbmVOdW1iZXIsIHdvcmQuc3RhcnRDb2x1bW4sIHRoaXMucG9zaXRpb24ubGluZU51bWJlciwgd29yZC5lbmRDb2x1bW4pLFxuXHRcdFx0dGV4dDogd29yZC53b3JkLFxuXHRcdFx0cmVqZWN0UmVhc29uOiByZWplY3RzLmxlbmd0aCA+IDAgPyByZWplY3RzLmpvaW4oJ1xcbicpIDogdW5kZWZpbmVkXG5cdFx0fTtcblx0fVxuXG5cdGFzeW5jIHByb3ZpZGVSZW5hbWVFZGl0cyhuZXdOYW1lOiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8V29ya3NwYWNlRWRpdCAmIFJlamVjdGlvbj4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm92aWRlUmVuYW1lRWRpdHMobmV3TmFtZSwgdGhpcy5fcHJvdmlkZXJSZW5hbWVJZHgsIFtdLCB0b2tlbik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9wcm92aWRlUmVuYW1lRWRpdHMobmV3TmFtZTogc3RyaW5nLCBpOiBudW1iZXIsIHJlamVjdHM6IHN0cmluZ1tdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFdvcmtzcGFjZUVkaXQgJiBSZWplY3Rpb24+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuX3Byb3ZpZGVyc1tpXTtcblx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRlZGl0czogW10sXG5cdFx0XHRcdHJlamVjdFJlYXNvbjogcmVqZWN0cy5qb2luKCdcXG4nKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlUmVuYW1lRWRpdHModGhpcy5tb2RlbCwgdGhpcy5wb3NpdGlvbiwgbmV3TmFtZSwgdG9rZW4pO1xuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcHJvdmlkZVJlbmFtZUVkaXRzKG5ld05hbWUsIGkgKyAxLCByZWplY3RzLmNvbmNhdChubHMubG9jYWxpemUoJ25vIHJlc3VsdCcsIFwiTm8gcmVzdWx0LlwiKSksIHRva2VuKTtcblx0XHR9IGVsc2UgaWYgKHJlc3VsdC5yZWplY3RSZWFzb24pIHtcblx0XHRcdHJldHVybiB0aGlzLl9wcm92aWRlUmVuYW1lRWRpdHMobmV3TmFtZSwgaSArIDEsIHJlamVjdHMuY29uY2F0KHJlc3VsdC5yZWplY3RSZWFzb24pLCB0b2tlbik7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlbmFtZShyZWdpc3RyeTogTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnk8UmVuYW1lUHJvdmlkZXI+LCBtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCBuZXdOYW1lOiBzdHJpbmcpOiBQcm9taXNlPFdvcmtzcGFjZUVkaXQgJiBSZWplY3Rpb24+IHtcblx0Y29uc3Qgc2tlbGV0b24gPSBuZXcgUmVuYW1lU2tlbGV0b24obW9kZWwsIHBvc2l0aW9uLCByZWdpc3RyeSk7XG5cdGNvbnN0IGxvYyA9IGF3YWl0IHNrZWxldG9uLnJlc29sdmVSZW5hbWVMb2NhdGlvbihDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0aWYgKGxvYz8ucmVqZWN0UmVhc29uKSB7XG5cdFx0cmV0dXJuIHsgZWRpdHM6IFtdLCByZWplY3RSZWFzb246IGxvYy5yZWplY3RSZWFzb24gfTtcblx0fVxuXHRyZXR1cm4gc2tlbGV0b24ucHJvdmlkZVJlbmFtZUVkaXRzKG5ld05hbWUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xufVxuXG4vLyAtLS0gIHJlZ2lzdGVyIGFjdGlvbnMgYW5kIGNvbW1hbmRzXG5cbmNsYXNzIFJlbmFtZUNvbnRyb2xsZXIgaW1wbGVtZW50cyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ2VkaXRvci5jb250cmliLnJlbmFtZUNvbnRyb2xsZXInO1xuXG5cdHN0YXRpYyBnZXQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IFJlbmFtZUNvbnRyb2xsZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxSZW5hbWVDb250cm9sbGVyPihSZW5hbWVDb250cm9sbGVyLklEKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlbmFtZVdpZGdldDogUmVuYW1lV2lkZ2V0O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgX2N0czogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElCdWxrRWRpdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYnVsa0VkaXRTZXJ2aWNlOiBJQnVsa0VkaXRTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Byb2dyZXNzU2VydmljZTogSUVkaXRvclByb2dyZXNzU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWdTZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5fcmVuYW1lV2lkZ2V0ID0gdGhpcy5fZGlzcG9zYWJsZVN0b3JlLmFkZCh0aGlzLl9pbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVuYW1lV2lkZ2V0LCB0aGlzLmVkaXRvciwgWydhY2NlcHRSZW5hbWVJbnB1dCcsICdhY2NlcHRSZW5hbWVJbnB1dFdpdGhQcmV2aWV3J10pKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZVN0b3JlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9jdHMuZGlzcG9zZSh0cnVlKTtcblx0fVxuXG5cdGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdGNvbnN0IHRyYWNlID0gdGhpcy5fbG9nU2VydmljZS50cmFjZS5iaW5kKHRoaXMuX2xvZ1NlcnZpY2UsICdbcmVuYW1lXScpO1xuXG5cdFx0Ly8gc2V0IHVwIGNhbmNlbGxhdGlvbiB0b2tlbiB0byBwcmV2ZW50IHJlZW50cmFudCByZW5hbWUsIHRoaXNcblx0XHQvLyBpcyB0aGUgcGFyZW50IHRvIHRoZSByZXNvbHZlLSBhbmQgcmVuYW1lLXRva2Vuc1xuXHRcdHRoaXMuX2N0cy5kaXNwb3NlKHRydWUpO1xuXHRcdHRoaXMuX2N0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXG5cdFx0aWYgKCF0aGlzLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHR0cmFjZSgnZWRpdG9yIGhhcyBubyBtb2RlbCcpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMuZWRpdG9yLmdldFBvc2l0aW9uKCk7XG5cdFx0Y29uc3Qgc2tlbGV0b24gPSBuZXcgUmVuYW1lU2tlbGV0b24odGhpcy5lZGl0b3IuZ2V0TW9kZWwoKSwgcG9zaXRpb24sIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnJlbmFtZVByb3ZpZGVyKTtcblxuXHRcdGlmICghc2tlbGV0b24uaGFzUHJvdmlkZXIoKSkge1xuXHRcdFx0dHJhY2UoJ3NrZWxldG9uIGhhcyBubyBwcm92aWRlcicpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHQvLyBwYXJ0IDEgLSByZXNvbHZlIHJlbmFtZSBsb2NhdGlvblxuXHRcdGNvbnN0IGN0czEgPSBuZXcgRWRpdG9yU3RhdGVDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSh0aGlzLmVkaXRvciwgQ29kZUVkaXRvclN0YXRlRmxhZy5Qb3NpdGlvbiB8IENvZGVFZGl0b3JTdGF0ZUZsYWcuVmFsdWUsIHVuZGVmaW5lZCwgdGhpcy5fY3RzLnRva2VuKTtcblxuXHRcdGxldCBsb2M6IFJlbmFtZUxvY2F0aW9uICYgUmVqZWN0aW9uIHwgdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHR0cmFjZSgncmVzb2x2aW5nIHJlbmFtZSBsb2NhdGlvbicpO1xuXHRcdFx0Y29uc3QgcmVzb2x2ZUxvY2F0aW9uT3BlcmF0aW9uID0gc2tlbGV0b24ucmVzb2x2ZVJlbmFtZUxvY2F0aW9uKGN0czEudG9rZW4pO1xuXHRcdFx0dGhpcy5fcHJvZ3Jlc3NTZXJ2aWNlLnNob3dXaGlsZShyZXNvbHZlTG9jYXRpb25PcGVyYXRpb24sIDI1MCk7XG5cdFx0XHRsb2MgPSBhd2FpdCByZXNvbHZlTG9jYXRpb25PcGVyYXRpb247XG5cdFx0XHR0cmFjZSgncmVzb2x2ZWQgcmVuYW1lIGxvY2F0aW9uJyk7XG5cdFx0fSBjYXRjaCAoZTogdW5rbm93bikge1xuXHRcdFx0aWYgKGUgaW5zdGFuY2VvZiBDYW5jZWxsYXRpb25FcnJvcikge1xuXHRcdFx0XHR0cmFjZSgncmVzb2x2ZSByZW5hbWUgbG9jYXRpb24gY2FuY2VsbGVkJywgSlNPTi5zdHJpbmdpZnkoZSwgbnVsbCwgJ1xcdCcpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRyYWNlKCdyZXNvbHZlIHJlbmFtZSBsb2NhdGlvbiBmYWlsZWQnLCBlIGluc3RhbmNlb2YgRXJyb3IgPyBlIDogSlNPTi5zdHJpbmdpZnkoZSwgbnVsbCwgJ1xcdCcpKTtcblx0XHRcdFx0aWYgKHR5cGVvZiBlID09PSAnc3RyaW5nJyB8fCBpc01hcmtkb3duU3RyaW5nKGUpKSB7XG5cdFx0XHRcdFx0TWVzc2FnZUNvbnRyb2xsZXIuZ2V0KHRoaXMuZWRpdG9yKT8uc2hvd01lc3NhZ2UoZSB8fCBubHMubG9jYWxpemUoJ3Jlc29sdmVSZW5hbWVMb2NhdGlvbkZhaWxlZCcsIFwiQW4gdW5rbm93biBlcnJvciBvY2N1cnJlZCB3aGlsZSByZXNvbHZpbmcgcmVuYW1lIGxvY2F0aW9uXCIpLCBwb3NpdGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Y3RzMS5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0aWYgKCFsb2MpIHtcblx0XHRcdHRyYWNlKCdyZXR1cm5pbmcgZWFybHkgLSBubyBsb2MnKTtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKGxvYy5yZWplY3RSZWFzb24pIHtcblx0XHRcdHRyYWNlKGByZXR1cm5pbmcgZWFybHkgLSByZWplY3RlZCB3aXRoIHJlYXNvbjogJHtsb2MucmVqZWN0UmVhc29ufWAsIGxvYy5yZWplY3RSZWFzb24pO1xuXHRcdFx0TWVzc2FnZUNvbnRyb2xsZXIuZ2V0KHRoaXMuZWRpdG9yKT8uc2hvd01lc3NhZ2UobG9jLnJlamVjdFJlYXNvbiwgcG9zaXRpb24pO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAoY3RzMS50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0dHJhY2UoJ3JldHVybmluZyBlYXJseSAtIGN0czEgY2FuY2VsbGVkJyk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIHBhcnQgMiAtIGRvIHJlbmFtZSBhdCBsb2NhdGlvblxuXHRcdGNvbnN0IGN0czIgPSBuZXcgRWRpdG9yU3RhdGVDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSh0aGlzLmVkaXRvciwgQ29kZUVkaXRvclN0YXRlRmxhZy5Qb3NpdGlvbiB8IENvZGVFZGl0b3JTdGF0ZUZsYWcuVmFsdWUsIGxvYy5yYW5nZSwgdGhpcy5fY3RzLnRva2VuKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKTsgLy8gQHVsdWdiZWtuYTogYXNzdW1lcyBlZGl0b3Igc3RpbGwgaGFzIGEgbW9kZWwsIG90aGVyd2lzZSwgY3RzMSBzaG91bGQndmUgYmVlbiBjYW5jZWxsZWRcblxuXHRcdGNvbnN0IG5ld1N5bWJvbE5hbWVzUHJvdmlkZXJzID0gdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UubmV3U3ltYm9sTmFtZXNQcm92aWRlci5hbGwobW9kZWwpO1xuXG5cdFx0Y29uc3QgcmVzb2x2ZWROZXdTeW1ib2xuYW1lc1Byb3ZpZGVycyA9IGF3YWl0IFByb21pc2UuYWxsKG5ld1N5bWJvbE5hbWVzUHJvdmlkZXJzLm1hcChhc3luYyBwID0+IFtwLCBhd2FpdCBwLnN1cHBvcnRzQXV0b21hdGljTmV3U3ltYm9sTmFtZXNUcmlnZ2VyS2luZCA/PyBmYWxzZV0gYXMgY29uc3QpKTtcblxuXHRcdGNvbnN0IHJlcXVlc3RSZW5hbWVTdWdnZXN0aW9ucyA9ICh0cmlnZ2VyS2luZDogTmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kLCBjdHM6IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRsZXQgcHJvdmlkZXJzID0gcmVzb2x2ZWROZXdTeW1ib2xuYW1lc1Byb3ZpZGVycy5zbGljZSgpO1xuXG5cdFx0XHRpZiAodHJpZ2dlcktpbmQgPT09IE5ld1N5bWJvbE5hbWVUcmlnZ2VyS2luZC5BdXRvbWF0aWMpIHtcblx0XHRcdFx0cHJvdmlkZXJzID0gcHJvdmlkZXJzLmZpbHRlcigoW18sIHN1cHBvcnRzQXV0b21hdGljXSkgPT4gc3VwcG9ydHNBdXRvbWF0aWMpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcHJvdmlkZXJzLm1hcCgoW3AsXSkgPT4gcC5wcm92aWRlTmV3U3ltYm9sTmFtZXMobW9kZWwsIGxvYy5yYW5nZSwgdHJpZ2dlcktpbmQsIGN0cykpO1xuXHRcdH07XG5cblx0XHR0cmFjZSgnY3JlYXRpbmcgcmVuYW1lIGlucHV0IGZpZWxkIGFuZCBhd2FpdGluZyBpdHMgcmVzdWx0Jyk7XG5cdFx0Y29uc3Qgc3VwcG9ydFByZXZpZXcgPSB0aGlzLl9idWxrRWRpdFNlcnZpY2UuaGFzUHJldmlld0hhbmRsZXIoKSAmJiB0aGlzLl9jb25maWdTZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KHRoaXMuZWRpdG9yLmdldE1vZGVsKCkudXJpLCAnZWRpdG9yLnJlbmFtZS5lbmFibGVQcmV2aWV3Jyk7XG5cdFx0Y29uc3QgaW5wdXRGaWVsZFJlc3VsdCA9IGF3YWl0IHRoaXMuX3JlbmFtZVdpZGdldC5nZXRJbnB1dChcblx0XHRcdGxvYy5yYW5nZSxcblx0XHRcdGxvYy50ZXh0LFxuXHRcdFx0c3VwcG9ydFByZXZpZXcsXG5cdFx0XHRuZXdTeW1ib2xOYW1lc1Byb3ZpZGVycy5sZW5ndGggPiAwID8gcmVxdWVzdFJlbmFtZVN1Z2dlc3Rpb25zIDogdW5kZWZpbmVkLFxuXHRcdFx0Y3RzMlxuXHRcdCk7XG5cdFx0dHJhY2UoJ3JlY2VpdmVkIHJlc3BvbnNlIGZyb20gcmVuYW1lIGlucHV0IGZpZWxkJyk7XG5cblx0XHRpZiAobmV3U3ltYm9sTmFtZXNQcm92aWRlcnMubGVuZ3RoID4gMCkgeyAvLyBAdWx1Z2Jla25hOiB3ZSdyZSBpbnRlcmVzdGVkIG9ubHkgaW4gdGVsZW1ldHJ5IGZvciByZW5hbWUgc3VnZ2VzdGlvbnMgY3VycmVudGx5XG5cdFx0XHR0aGlzLl9yZXBvcnRUZWxlbWV0cnkobmV3U3ltYm9sTmFtZXNQcm92aWRlcnMubGVuZ3RoLCBtb2RlbC5nZXRMYW5ndWFnZUlkKCksIGlucHV0RmllbGRSZXN1bHQpO1xuXHRcdH1cblxuXHRcdC8vIG5vIHJlc3VsdCwgb25seSBoaW50IHRvIGZvY3VzIHRoZSBlZGl0b3Igb3Igbm90XG5cdFx0aWYgKHR5cGVvZiBpbnB1dEZpZWxkUmVzdWx0ID09PSAnYm9vbGVhbicpIHtcblx0XHRcdHRyYWNlKGByZXR1cm5pbmcgZWFybHkgLSByZW5hbWUgaW5wdXQgZmllbGQgcmVzcG9uc2UgLSAke2lucHV0RmllbGRSZXN1bHR9YCk7XG5cdFx0XHRpZiAoaW5wdXRGaWVsZFJlc3VsdCkge1xuXHRcdFx0XHR0aGlzLmVkaXRvci5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdFx0Y3RzMi5kaXNwb3NlKCk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHRoaXMuZWRpdG9yLmZvY3VzKCk7XG5cblx0XHR0cmFjZSgncmVxdWVzdGluZyByZW5hbWUgZWRpdHMnKTtcblx0XHRjb25zdCByZW5hbWVPcGVyYXRpb24gPSByYWNlQ2FuY2VsbGF0aW9uKHNrZWxldG9uLnByb3ZpZGVSZW5hbWVFZGl0cyhpbnB1dEZpZWxkUmVzdWx0Lm5ld05hbWUsIGN0czIudG9rZW4pLCBjdHMyLnRva2VuKS50aGVuKGFzeW5jIHJlbmFtZVJlc3VsdCA9PiB7XG5cblx0XHRcdGlmICghcmVuYW1lUmVzdWx0KSB7XG5cdFx0XHRcdHRyYWNlKCdyZXR1cm5pbmcgZWFybHkgLSBubyByZW5hbWUgZWRpdHMgcmVzdWx0Jyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICghdGhpcy5lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0XHR0cmFjZSgncmV0dXJuaW5nIGVhcmx5IC0gbm8gbW9kZWwgYWZ0ZXIgcmVuYW1lIGVkaXRzIGFyZSBwcm92aWRlZCcpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChyZW5hbWVSZXN1bHQucmVqZWN0UmVhc29uKSB7XG5cdFx0XHRcdHRyYWNlKGByZXR1cm5pbmcgZWFybHkgLSByZWplY3RlZCB3aXRoIHJlYXNvbjogJHtyZW5hbWVSZXN1bHQucmVqZWN0UmVhc29ufWApO1xuXHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLmluZm8ocmVuYW1lUmVzdWx0LnJlamVjdFJlYXNvbik7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gY29sbGFwc2Ugc2VsZWN0aW9uIHRvIGFjdGl2ZSBlbmRcblx0XHRcdHRoaXMuZWRpdG9yLnNldFNlbGVjdGlvbihSYW5nZS5mcm9tUG9zaXRpb25zKHRoaXMuZWRpdG9yLmdldFNlbGVjdGlvbigpLmdldFBvc2l0aW9uKCkpKTtcblxuXHRcdFx0dHJhY2UoJ2FwcGx5aW5nIGVkaXRzJyk7XG5cblx0XHRcdHRoaXMuX2J1bGtFZGl0U2VydmljZS5hcHBseShyZW5hbWVSZXN1bHQsIHtcblx0XHRcdFx0ZWRpdG9yOiB0aGlzLmVkaXRvcixcblx0XHRcdFx0c2hvd1ByZXZpZXc6IGlucHV0RmllbGRSZXN1bHQud2FudHNQcmV2aWV3LFxuXHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdsYWJlbCcsIFwiUmVuYW1pbmcgJ3swfScgdG8gJ3sxfSdcIiwgbG9jPy50ZXh0LCBpbnB1dEZpZWxkUmVzdWx0Lm5ld05hbWUpLFxuXHRcdFx0XHRjb2RlOiAndW5kb3JlZG8ucmVuYW1lJyxcblx0XHRcdFx0cXVvdGFibGVMYWJlbDogbmxzLmxvY2FsaXplKCdxdW90YWJsZUxhYmVsJywgXCJSZW5hbWluZyB7MH0gdG8gezF9XCIsIGxvYz8udGV4dCwgaW5wdXRGaWVsZFJlc3VsdC5uZXdOYW1lKSxcblx0XHRcdFx0cmVzcGVjdEF1dG9TYXZlQ29uZmlnOiB0cnVlXG5cdFx0XHR9KS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRcdHRyYWNlKCdlZGl0cyBhcHBsaWVkJyk7XG5cdFx0XHRcdGlmIChyZXN1bHQuYXJpYVN1bW1hcnkpIHtcblx0XHRcdFx0XHRhbGVydChubHMubG9jYWxpemUoJ2FyaWEnLCBcIlN1Y2Nlc3NmdWxseSByZW5hbWVkICd7MH0nIHRvICd7MX0nLiBTdW1tYXJ5OiB7Mn1cIiwgbG9jLnRleHQsIGlucHV0RmllbGRSZXN1bHQubmV3TmFtZSwgcmVzdWx0LmFyaWFTdW1tYXJ5KSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pLmNhdGNoKGVyciA9PiB7XG5cdFx0XHRcdHRyYWNlKGBlcnJvciB3aGVuIGFwcGx5aW5nIGVkaXRzICR7SlNPTi5zdHJpbmdpZnkoZXJyLCBudWxsLCAnXFx0Jyl9YCk7XG5cdFx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobmxzLmxvY2FsaXplKCdyZW5hbWUuZmFpbGVkQXBwbHknLCBcIlJlbmFtZSBmYWlsZWQgdG8gYXBwbHkgZWRpdHNcIikpO1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0XHR9KTtcblxuXHRcdH0sIGVyciA9PiB7XG5cdFx0XHR0cmFjZSgnZXJyb3Igd2hlbiBwcm92aWRpbmcgcmVuYW1lIGVkaXRzJywgSlNPTi5zdHJpbmdpZnkoZXJyLCBudWxsLCAnXFx0JykpO1xuXG5cdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKG5scy5sb2NhbGl6ZSgncmVuYW1lLmZhaWxlZCcsIFwiUmVuYW1lIGZhaWxlZCB0byBjb21wdXRlIGVkaXRzXCIpKTtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoZXJyKTtcblxuXHRcdH0pLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0Y3RzMi5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHR0cmFjZSgncmV0dXJuaW5nIHJlbmFtZSBvcGVyYXRpb24nKTtcblxuXHRcdHRoaXMuX3Byb2dyZXNzU2VydmljZS5zaG93V2hpbGUocmVuYW1lT3BlcmF0aW9uLCAyNTApO1xuXHRcdHJldHVybiByZW5hbWVPcGVyYXRpb247XG5cblx0fVxuXG5cdGFjY2VwdFJlbmFtZUlucHV0KHdhbnRzUHJldmlldzogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX3JlbmFtZVdpZGdldC5hY2NlcHRJbnB1dCh3YW50c1ByZXZpZXcpO1xuXHR9XG5cblx0Y2FuY2VsUmVuYW1lSW5wdXQoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVuYW1lV2lkZ2V0LmNhbmNlbElucHV0KHRydWUsICdjYW5jZWxSZW5hbWVJbnB1dCBjb21tYW5kJyk7XG5cdH1cblxuXHRmb2N1c05leHRSZW5hbWVTdWdnZXN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlbmFtZVdpZGdldC5mb2N1c05leHRSZW5hbWVTdWdnZXN0aW9uKCk7XG5cdH1cblxuXHRmb2N1c1ByZXZpb3VzUmVuYW1lU3VnZ2VzdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLl9yZW5hbWVXaWRnZXQuZm9jdXNQcmV2aW91c1JlbmFtZVN1Z2dlc3Rpb24oKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlcG9ydFRlbGVtZXRyeShuUmVuYW1lU3VnZ2VzdGlvblByb3ZpZGVyczogbnVtYmVyLCBsYW5ndWFnZUlkOiBzdHJpbmcsIGlucHV0RmllbGRSZXN1bHQ6IGJvb2xlYW4gfCBSZW5hbWVXaWRnZXRSZXN1bHQpIHtcblx0XHR0eXBlIFJlbmFtZUludm9rZWRFdmVudCA9XG5cdFx0XHR7XG5cdFx0XHRcdGtpbmQ6ICdhY2NlcHRlZCcgfCAnY2FuY2VsbGVkJztcblx0XHRcdFx0bGFuZ3VhZ2VJZDogc3RyaW5nO1xuXHRcdFx0XHRuUmVuYW1lU3VnZ2VzdGlvblByb3ZpZGVyczogbnVtYmVyO1xuXG5cdFx0XHRcdC8qKiBwcm92aWRlZCBvbmx5IGlmIGtpbmQgPSAnYWNjZXB0ZWQnICovXG5cdFx0XHRcdHNvdXJjZT86IE5ld05hbWVTb3VyY2VbJ2snXTtcblx0XHRcdFx0LyoqIHByb3ZpZGVkIG9ubHkgaWYga2luZCA9ICdhY2NlcHRlZCcgKi9cblx0XHRcdFx0blJlbmFtZVN1Z2dlc3Rpb25zPzogbnVtYmVyO1xuXHRcdFx0XHQvKiogcHJvdmlkZWQgb25seSBpZiBraW5kID0gJ2FjY2VwdGVkJyAqL1xuXHRcdFx0XHR0aW1lQmVmb3JlRmlyc3RJbnB1dEZpZWxkRWRpdD86IG51bWJlcjtcblx0XHRcdFx0LyoqIHByb3ZpZGVkIG9ubHkgaWYga2luZCA9ICdhY2NlcHRlZCcgKi9cblx0XHRcdFx0d2FudHNQcmV2aWV3PzogYm9vbGVhbjtcblx0XHRcdFx0LyoqIHByb3ZpZGVkIG9ubHkgaWYga2luZCA9ICdhY2NlcHRlZCcgKi9cblx0XHRcdFx0blJlbmFtZVN1Z2dlc3Rpb25zSW52b2NhdGlvbnM/OiBudW1iZXI7XG5cdFx0XHRcdC8qKiBwcm92aWRlZCBvbmx5IGlmIGtpbmQgPSAnYWNjZXB0ZWQnICovXG5cdFx0XHRcdGhhZEF1dG9tYXRpY1JlbmFtZVN1Z2dlc3Rpb25zSW52b2NhdGlvbj86IGJvb2xlYW47XG5cdFx0XHR9O1xuXG5cdFx0dHlwZSBSZW5hbWVJbnZva2VkQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRvd25lcjogJ3VsdWdiZWtuYSc7XG5cdFx0XHRjb21tZW50OiAnQSByZW5hbWUgb3BlcmF0aW9uIHdhcyBpbnZva2VkLic7XG5cblx0XHRcdGtpbmQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGV0aGVyIHRoZSByZW5hbWUgb3BlcmF0aW9uIHdhcyBjYW5jZWxsZWQgb3IgYWNjZXB0ZWQuJyB9O1xuXHRcdFx0bGFuZ3VhZ2VJZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0RvY3VtZW50IGxhbmd1YWdlIElELicgfTtcblx0XHRcdG5SZW5hbWVTdWdnZXN0aW9uUHJvdmlkZXJzOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnTnVtYmVyIG9mIHJlbmFtZSBwcm92aWRlcnMgZm9yIHRoaXMgZG9jdW1lbnQuJyB9O1xuXG5cdFx0XHRzb3VyY2U/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciB0aGUgbmV3IG5hbWUgY2FtZSBmcm9tIHRoZSBpbnB1dCBmaWVsZCBvciByZW5hbWUgc3VnZ2VzdGlvbnMuJyB9O1xuXHRcdFx0blJlbmFtZVN1Z2dlc3Rpb25zPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ051bWJlciBvZiByZW5hbWUgc3VnZ2VzdGlvbnMgdXNlciBoYXMgZ290JyB9O1xuXHRcdFx0dGltZUJlZm9yZUZpcnN0SW5wdXRGaWVsZEVkaXQ/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnTWlsbGlzZWNvbmRzIGJlZm9yZSB1c2VyIGVkaXRzIHRoZSBpbnB1dCBmaWVsZCBmb3IgdGhlIGZpcnN0IHRpbWUnIH07XG5cdFx0XHR3YW50c1ByZXZpZXc/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnSWYgdXNlciB3YW50ZWQgcHJldmlldy4nIH07XG5cdFx0XHRuUmVuYW1lU3VnZ2VzdGlvbnNJbnZvY2F0aW9ucz86IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdOdW1iZXIgb2YgdGltZXMgcmVuYW1lIHN1Z2dlc3Rpb25zIHdlcmUgaW52b2tlZCcgfTtcblx0XHRcdGhhZEF1dG9tYXRpY1JlbmFtZVN1Z2dlc3Rpb25zSW52b2NhdGlvbj86IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGV0aGVyIHJlbmFtZSBzdWdnZXN0aW9ucyB3ZXJlIGludm9rZWQgYXV0b21hdGljYWxseScgfTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgdmFsdWU6IFJlbmFtZUludm9rZWRFdmVudCA9XG5cdFx0XHR0eXBlb2YgaW5wdXRGaWVsZFJlc3VsdCA9PT0gJ2Jvb2xlYW4nXG5cdFx0XHRcdD8ge1xuXHRcdFx0XHRcdGtpbmQ6ICdjYW5jZWxsZWQnLFxuXHRcdFx0XHRcdGxhbmd1YWdlSWQsXG5cdFx0XHRcdFx0blJlbmFtZVN1Z2dlc3Rpb25Qcm92aWRlcnMsXG5cdFx0XHRcdH1cblx0XHRcdFx0OiB7XG5cdFx0XHRcdFx0a2luZDogJ2FjY2VwdGVkJyxcblx0XHRcdFx0XHRsYW5ndWFnZUlkLFxuXHRcdFx0XHRcdG5SZW5hbWVTdWdnZXN0aW9uUHJvdmlkZXJzLFxuXG5cdFx0XHRcdFx0c291cmNlOiBpbnB1dEZpZWxkUmVzdWx0LnN0YXRzLnNvdXJjZS5rLFxuXHRcdFx0XHRcdG5SZW5hbWVTdWdnZXN0aW9uczogaW5wdXRGaWVsZFJlc3VsdC5zdGF0cy5uUmVuYW1lU3VnZ2VzdGlvbnMsXG5cdFx0XHRcdFx0dGltZUJlZm9yZUZpcnN0SW5wdXRGaWVsZEVkaXQ6IGlucHV0RmllbGRSZXN1bHQuc3RhdHMudGltZUJlZm9yZUZpcnN0SW5wdXRGaWVsZEVkaXQsXG5cdFx0XHRcdFx0d2FudHNQcmV2aWV3OiBpbnB1dEZpZWxkUmVzdWx0LndhbnRzUHJldmlldyxcblx0XHRcdFx0XHRuUmVuYW1lU3VnZ2VzdGlvbnNJbnZvY2F0aW9uczogaW5wdXRGaWVsZFJlc3VsdC5zdGF0cy5uUmVuYW1lU3VnZ2VzdGlvbnNJbnZvY2F0aW9ucyxcblx0XHRcdFx0XHRoYWRBdXRvbWF0aWNSZW5hbWVTdWdnZXN0aW9uc0ludm9jYXRpb246IGlucHV0RmllbGRSZXN1bHQuc3RhdHMuaGFkQXV0b21hdGljUmVuYW1lU3VnZ2VzdGlvbnNJbnZvY2F0aW9uLFxuXHRcdFx0XHR9O1xuXG5cdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFJlbmFtZUludm9rZWRFdmVudCwgUmVuYW1lSW52b2tlZENsYXNzaWZpY2F0aW9uPigncmVuYW1lSW52b2tlZEV2ZW50JywgdmFsdWUpO1xuXHR9XG59XG5cbi8vIC0tLS0gYWN0aW9uIGltcGxlbWVudGF0aW9uXG5cbmV4cG9ydCBjbGFzcyBSZW5hbWVBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5yZW5hbWUnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ3JlbmFtZS5sYWJlbCcsIFwiUmVuYW1lIFN5bWJvbFwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlLCBFZGl0b3JDb250ZXh0S2V5cy5oYXNSZW5hbWVQcm92aWRlciksXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRjIsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0Y29udGV4dE1lbnVPcHRzOiB7XG5cdFx0XHRcdGdyb3VwOiAnMV9tb2RpZmljYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMS4xXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBydW5Db21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzOiBbVVJJLCBJUG9zaXRpb25dKTogdm9pZCB8IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvZGVFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBbdXJpLCBwb3NdID0gQXJyYXkuaXNBcnJheShhcmdzKSAmJiBhcmdzIHx8IFt1bmRlZmluZWQsIHVuZGVmaW5lZF07XG5cblx0XHRpZiAoVVJJLmlzVXJpKHVyaSkgJiYgUG9zaXRpb24uaXNJUG9zaXRpb24ocG9zKSkge1xuXHRcdFx0cmV0dXJuIGVkaXRvclNlcnZpY2Uub3BlbkNvZGVFZGl0b3IoeyByZXNvdXJjZTogdXJpIH0sIGVkaXRvclNlcnZpY2UuZ2V0QWN0aXZlQ29kZUVkaXRvcigpKS50aGVuKGVkaXRvciA9PiB7XG5cdFx0XHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdFx0XHRlZGl0b3IuaW52b2tlV2l0aGluQ29udGV4dChhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0dGhpcy5yZXBvcnRUZWxlbWV0cnkoYWNjZXNzb3IsIGVkaXRvcik7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMucnVuKGFjY2Vzc29yLCBlZGl0b3IpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0sIG9uVW5leHBlY3RlZEVycm9yKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3VwZXIucnVuQ29tbWFuZChhY2Nlc3NvciwgYXJncyk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBSZW5hbWVDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXG5cdFx0aWYgKGNvbnRyb2xsZXIpIHtcblx0XHRcdGxvZ1NlcnZpY2UudHJhY2UoJ1tSZW5hbWVBY3Rpb25dIGdvdCBjb250cm9sbGVyLCBydW5uaW5nLi4uJyk7XG5cdFx0XHRyZXR1cm4gY29udHJvbGxlci5ydW4oKTtcblx0XHR9XG5cdFx0bG9nU2VydmljZS50cmFjZSgnW1JlbmFtZUFjdGlvbl0gcmV0dXJuaW5nIGVhcmx5IC0gY29udHJvbGxlciBtaXNzaW5nJyk7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHR9XG59XG5cbnJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uKFJlbmFtZUNvbnRyb2xsZXIuSUQsIFJlbmFtZUNvbnRyb2xsZXIsIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24uTGF6eSk7XG5yZWdpc3RlckVkaXRvckFjdGlvbihSZW5hbWVBY3Rpb24pO1xuXG5jb25zdCBSZW5hbWVDb21tYW5kID0gRWRpdG9yQ29tbWFuZC5iaW5kVG9Db250cmlidXRpb248UmVuYW1lQ29udHJvbGxlcj4oUmVuYW1lQ29udHJvbGxlci5nZXQpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFJlbmFtZUNvbW1hbmQoe1xuXHRpZDogJ2FjY2VwdFJlbmFtZUlucHV0Jyxcblx0cHJlY29uZGl0aW9uOiBDT05URVhUX1JFTkFNRV9JTlBVVF9WSVNJQkxFLFxuXHRoYW5kbGVyOiB4ID0+IHguYWNjZXB0UmVuYW1lSW5wdXQoZmFsc2UpLFxuXHRrYk9wdHM6IHtcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiArIDk5LFxuXHRcdGtiRXhwcjogQ29udGV4dEtleUV4cHIuYW5kKEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLCBDb250ZXh0S2V5RXhwci5ub3QoJ2lzQ29tcG9zaW5nJykpLFxuXHRcdHByaW1hcnk6IEtleUNvZGUuRW50ZXJcblx0fVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFJlbmFtZUNvbW1hbmQoe1xuXHRpZDogJ2FjY2VwdFJlbmFtZUlucHV0V2l0aFByZXZpZXcnLFxuXHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX1JFTkFNRV9JTlBVVF9WSVNJQkxFLCBDb250ZXh0S2V5RXhwci5oYXMoJ2NvbmZpZy5lZGl0b3IucmVuYW1lLmVuYWJsZVByZXZpZXcnKSksXG5cdGhhbmRsZXI6IHggPT4geC5hY2NlcHRSZW5hbWVJbnB1dCh0cnVlKSxcblx0a2JPcHRzOiB7XG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIgKyA5OSxcblx0XHRrYkV4cHI6IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy5mb2N1cywgQ29udGV4dEtleUV4cHIubm90KCdpc0NvbXBvc2luZycpKSxcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCArIEtleUNvZGUuRW50ZXJcblx0fVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFJlbmFtZUNvbW1hbmQoe1xuXHRpZDogJ2NhbmNlbFJlbmFtZUlucHV0Jyxcblx0cHJlY29uZGl0aW9uOiBDT05URVhUX1JFTkFNRV9JTlBVVF9WSVNJQkxFLFxuXHRoYW5kbGVyOiB4ID0+IHguY2FuY2VsUmVuYW1lSW5wdXQoKSxcblx0a2JPcHRzOiB7XG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIgKyA5OSxcblx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLFxuXHRcdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlLFxuXHRcdHNlY29uZGFyeTogW0tleU1vZC5TaGlmdCB8IEtleUNvZGUuRXNjYXBlXVxuXHR9XG59KSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBGb2N1c05leHRSZW5hbWVTdWdnZXN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZm9jdXNOZXh0UmVuYW1lU3VnZ2VzdGlvbicsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5ubHMubG9jYWxpemUyKCdmb2N1c05leHRSZW5hbWVTdWdnZXN0aW9uJywgXCJGb2N1cyBOZXh0IFJlbmFtZSBTdWdnZXN0aW9uXCIpLFxuXHRcdFx0fSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9SRU5BTUVfSU5QVVRfVklTSUJMRSxcblx0XHRcdGtleWJpbmRpbmc6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRG93bkFycm93LFxuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliICsgOTksXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IGN1cnJlbnRFZGl0b3IgPSBhY2Nlc3Nvci5nZXQoSUNvZGVFZGl0b3JTZXJ2aWNlKS5nZXRGb2N1c2VkQ29kZUVkaXRvcigpO1xuXHRcdGlmICghY3VycmVudEVkaXRvcikgeyByZXR1cm47IH1cblxuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBSZW5hbWVDb250cm9sbGVyLmdldChjdXJyZW50RWRpdG9yKTtcblx0XHRpZiAoIWNvbnRyb2xsZXIpIHsgcmV0dXJuOyB9XG5cblx0XHRjb250cm9sbGVyLmZvY3VzTmV4dFJlbmFtZVN1Z2dlc3Rpb24oKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBGb2N1c1ByZXZpb3VzUmVuYW1lU3VnZ2VzdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2ZvY3VzUHJldmlvdXNSZW5hbWVTdWdnZXN0aW9uJyxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdC4uLm5scy5sb2NhbGl6ZTIoJ2ZvY3VzUHJldmlvdXNSZW5hbWVTdWdnZXN0aW9uJywgXCJGb2N1cyBQcmV2aW91cyBSZW5hbWUgU3VnZ2VzdGlvblwiKSxcblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfUkVOQU1FX0lOUFVUX1ZJU0lCTEUsXG5cdFx0XHRrZXliaW5kaW5nOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLlVwQXJyb3csXG5cdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIgKyA5OSxcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgY3VycmVudEVkaXRvciA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpLmdldEZvY3VzZWRDb2RlRWRpdG9yKCk7XG5cdFx0aWYgKCFjdXJyZW50RWRpdG9yKSB7IHJldHVybjsgfVxuXG5cdFx0Y29uc3QgY29udHJvbGxlciA9IFJlbmFtZUNvbnRyb2xsZXIuZ2V0KGN1cnJlbnRFZGl0b3IpO1xuXHRcdGlmICghY29udHJvbGxlcikgeyByZXR1cm47IH1cblxuXHRcdGNvbnRyb2xsZXIuZm9jdXNQcmV2aW91c1JlbmFtZVN1Z2dlc3Rpb24oKTtcblx0fVxufSk7XG5cbi8vIC0tLS0gYXBpIGJyaWRnZSBjb21tYW5kXG5cbnJlZ2lzdGVyTW9kZWxBbmRQb3NpdGlvbkNvbW1hbmQoJ19leGVjdXRlRG9jdW1lbnRSZW5hbWVQcm92aWRlcicsIGZ1bmN0aW9uIChhY2Nlc3NvciwgbW9kZWwsIHBvc2l0aW9uLCAuLi5hcmdzKSB7XG5cdGNvbnN0IFtuZXdOYW1lXSA9IGFyZ3M7XG5cdGFzc2VydFR5cGUodHlwZW9mIG5ld05hbWUgPT09ICdzdHJpbmcnKTtcblx0Y29uc3QgeyByZW5hbWVQcm92aWRlciB9ID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cdHJldHVybiByZW5hbWUocmVuYW1lUHJvdmlkZXIsIG1vZGVsLCBwb3NpdGlvbiwgbmV3TmFtZSk7XG59KTtcblxucmVnaXN0ZXJNb2RlbEFuZFBvc2l0aW9uQ29tbWFuZCgnX2V4ZWN1dGVQcmVwYXJlUmVuYW1lJywgYXN5bmMgZnVuY3Rpb24gKGFjY2Vzc29yLCBtb2RlbCwgcG9zaXRpb24pIHtcblx0Y29uc3QgeyByZW5hbWVQcm92aWRlciB9ID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cdGNvbnN0IHNrZWxldG9uID0gbmV3IFJlbmFtZVNrZWxldG9uKG1vZGVsLCBwb3NpdGlvbiwgcmVuYW1lUHJvdmlkZXIpO1xuXHRjb25zdCBsb2MgPSBhd2FpdCBza2VsZXRvbi5yZXNvbHZlUmVuYW1lTG9jYXRpb24oQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdGlmIChsb2M/LnJlamVjdFJlYXNvbikge1xuXHRcdHRocm93IG5ldyBFcnJvcihsb2MucmVqZWN0UmVhc29uKTtcblx0fVxuXHRyZXR1cm4gbG9jO1xufSk7XG5cblxuLy90b2RvQGpyaWVrZW4gdXNlIGVkaXRvciBvcHRpb25zIHdvcmxkXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pLnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdGlkOiAnZWRpdG9yJyxcblx0cHJvcGVydGllczoge1xuXHRcdCdlZGl0b3IucmVuYW1lLmVuYWJsZVByZXZpZXcnOiB7XG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZW5hYmxlUHJldmlldycsIFwiRW5hYmxlL2Rpc2FibGUgdGhlIGFiaWxpdHkgdG8gcHJldmlldyBjaGFuZ2VzIGJlZm9yZSByZW5hbWluZ1wiKSxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHR0eXBlOiAnYm9vbGVhbidcblx0XHR9XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGFBQWE7QUFDdEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxtQkFBbUIsK0JBQStCO0FBQzNELFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLFNBQVMsY0FBYztBQUNoQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLFdBQVc7QUFFcEIsU0FBUyxjQUFjLGVBQWUsaUNBQW1ELHNCQUFzQix1QkFBdUIsNEJBQTRCLHVDQUF1QztBQUN6TSxT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
