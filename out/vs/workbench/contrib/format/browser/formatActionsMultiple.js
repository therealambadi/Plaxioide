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
import { getCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { EditorAction, registerEditorAction } from "../../../../editor/browser/editorExtensions.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import * as nls from "../../../../nls.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { formatDocumentRangesWithProvider, formatDocumentWithProvider, getRealAndSyntheticDocumentFormattersOrdered, FormattingConflicts, FormattingMode, FormattingKind } from "../../../../editor/contrib/format/browser/format.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IExtensionService, toExtension } from "../../../services/extensions/common/extensions.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { INotificationService, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IWorkbenchExtensionEnablementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { editorConfigurationBaseNode } from "../../../../editor/common/config/editorConfigurationSchema.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { ILanguageStatusService } from "../../../services/languageStatus/common/languageStatusService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { generateUuid } from "../../../../base/common/uuid.js";
let DefaultFormatter = class extends Disposable {
  constructor(_extensionService, _extensionEnablementService, _configService, _notificationService, _dialogService, _quickInputService, _languageService, _languageFeaturesService, _languageStatusService, _editorService) {
    super();
    this._extensionService = _extensionService;
    this._extensionEnablementService = _extensionEnablementService;
    this._configService = _configService;
    this._notificationService = _notificationService;
    this._dialogService = _dialogService;
    this._quickInputService = _quickInputService;
    this._languageService = _languageService;
    this._languageFeaturesService = _languageFeaturesService;
    this._languageStatusService = _languageStatusService;
    this._editorService = _editorService;
    this._languageStatusStore = this._store.add(new DisposableStore());
    this._store.add(this._extensionService.onDidChangeExtensions(this._updateConfigValues, this));
    this._store.add(FormattingConflicts.setFormatterSelector((formatter, document, mode, kind) => this._selectFormatter(formatter, document, mode, kind)));
    this._store.add(_editorService.onDidActiveEditorChange(this._updateStatus, this));
    this._store.add(_languageFeaturesService.documentFormattingEditProvider.onDidChange(this._updateStatus, this));
    this._store.add(_languageFeaturesService.documentRangeFormattingEditProvider.onDidChange(this._updateStatus, this));
    this._store.add(_configService.onDidChangeConfiguration((e) => e.affectsConfiguration(DefaultFormatter.configName) && this._updateStatus()));
    this._updateConfigValues();
  }
  async _updateConfigValues() {
    await this._extensionService.whenInstalledExtensionsRegistered();
    let extensions = [...this._extensionService.extensions];
    extensions = extensions.sort((a, b) => {
      const boostA = a.categories?.find((cat) => cat === "Formatters" || cat === "Programming Languages");
      const boostB = b.categories?.find((cat) => cat === "Formatters" || cat === "Programming Languages");
      if (boostA && !boostB) {
        return -1;
      } else if (!boostA && boostB) {
        return 1;
      } else {
        return a.name.localeCompare(b.name);
      }
    });
    DefaultFormatter.extensionIds.length = 0;
    DefaultFormatter.extensionItemLabels.length = 0;
    DefaultFormatter.extensionDescriptions.length = 0;
    DefaultFormatter.extensionIds.push(null);
    DefaultFormatter.extensionItemLabels.push(nls.localize("null", "None"));
    DefaultFormatter.extensionDescriptions.push(nls.localize("nullFormatterDescription", "None"));
    for (const extension of extensions) {
      if (extension.main || extension.browser) {
        DefaultFormatter.extensionIds.push(extension.identifier.value);
        DefaultFormatter.extensionItemLabels.push(extension.displayName ?? "");
        DefaultFormatter.extensionDescriptions.push(extension.description ?? "");
      }
    }
  }
  static _maybeQuotes(s) {
    return s.match(/\s/) ? `'${s}'` : s;
  }
  async _analyzeFormatter(kind, formatter, document) {
    const defaultFormatterId = this._configService.getValue(DefaultFormatter.configName, {
      resource: document.uri,
      overrideIdentifier: document.getLanguageId()
    });
    if (defaultFormatterId) {
      const defaultFormatter = formatter.find((formatter2) => ExtensionIdentifier.equals(formatter2.extensionId, defaultFormatterId));
      if (defaultFormatter) {
        return defaultFormatter;
      }
      const extension = await this._extensionService.getExtension(defaultFormatterId);
      if (extension && this._extensionEnablementService.isEnabled(toExtension(extension))) {
        const langName2 = this._languageService.getLanguageName(document.getLanguageId()) || document.getLanguageId();
        const detail = kind === FormattingKind.File ? nls.localize("miss.1", "Extension '{0}' is configured as formatter but it cannot format '{1}'-files", extension.displayName || extension.name, langName2) : nls.localize("miss.2", "Extension '{0}' is configured as formatter but it can only format '{1}'-files as a whole, not selections or parts of it.", extension.displayName || extension.name, langName2);
        return detail;
      }
    } else if (formatter.length === 1) {
      return formatter[0];
    }
    const langName = this._languageService.getLanguageName(document.getLanguageId()) || document.getLanguageId();
    const message = !defaultFormatterId ? nls.localize("config.needed", "There are multiple formatters for '{0}' files. One of them should be configured as default formatter.", DefaultFormatter._maybeQuotes(langName)) : nls.localize("config.bad", "Extension '{0}' is configured as formatter but not available. Select a different default formatter to continue.", defaultFormatterId);
    return message;
  }
  async _selectFormatter(formatter, document, mode, kind) {
    const formatterOrMessage = await this._analyzeFormatter(kind, formatter, document);
    if (typeof formatterOrMessage !== "string") {
      return formatterOrMessage;
    }
    if (mode !== FormattingMode.Silent) {
      const { confirmed } = await this._dialogService.confirm({
        message: nls.localize("miss", "Configure Default Formatter"),
        detail: formatterOrMessage,
        primaryButton: nls.localize({ key: "do.config", comment: ["&& denotes a mnemonic"] }, "&&Configure...")
      });
      if (confirmed) {
        return this._pickAndPersistDefaultFormatter(formatter, document);
      }
    } else {
      this._notificationService.prompt(
        Severity.Info,
        formatterOrMessage,
        [{ label: nls.localize("do.config.notification", "Configure..."), run: () => this._pickAndPersistDefaultFormatter(formatter, document) }],
        { priority: NotificationPriority.SILENT }
      );
    }
    return void 0;
  }
  async _pickAndPersistDefaultFormatter(formatter, document) {
    const picks = formatter.map((formatter2, index) => {
      return {
        index,
        label: formatter2.displayName || (formatter2.extensionId ? formatter2.extensionId.value : "?"),
        description: formatter2.extensionId && formatter2.extensionId.value
      };
    });
    const langName = this._languageService.getLanguageName(document.getLanguageId()) || document.getLanguageId();
    const pick = await this._quickInputService.pick(picks, { placeHolder: nls.localize("select", "Select a default formatter for '{0}' files", DefaultFormatter._maybeQuotes(langName)) });
    if (!pick || !formatter[pick.index].extensionId) {
      return void 0;
    }
    this._configService.updateValue(DefaultFormatter.configName, formatter[pick.index].extensionId.value, {
      resource: document.uri,
      overrideIdentifier: document.getLanguageId()
    });
    return formatter[pick.index];
  }
  // --- status item
  _updateStatus() {
    this._languageStatusStore.clear();
    const editor = getCodeEditor(this._editorService.activeTextEditorControl);
    if (!editor || !editor.hasModel()) {
      return;
    }
    const document = editor.getModel();
    const formatter = getRealAndSyntheticDocumentFormattersOrdered(this._languageFeaturesService.documentFormattingEditProvider, this._languageFeaturesService.documentRangeFormattingEditProvider, document);
    if (formatter.length === 0) {
      return;
    }
    const cts = new CancellationTokenSource();
    this._languageStatusStore.add(toDisposable(() => cts.dispose(true)));
    this._analyzeFormatter(FormattingKind.File, formatter, document).then((result) => {
      if (cts.token.isCancellationRequested) {
        return;
      }
      if (typeof result !== "string") {
        return;
      }
      const command = { id: `formatter/configure/dfl/${generateUuid()}`, title: nls.localize("do.config.command", "Configure...") };
      this._languageStatusStore.add(CommandsRegistry.registerCommand(command.id, () => this._pickAndPersistDefaultFormatter(formatter, document)));
      this._languageStatusStore.add(this._languageStatusService.addStatus({
        id: "formatter.conflict",
        name: nls.localize("summary", "Formatter Conflicts"),
        selector: { language: document.getLanguageId(), pattern: document.uri.fsPath },
        severity: Severity.Error,
        label: nls.localize("formatter", "Formatting"),
        detail: result,
        busy: false,
        source: "",
        command,
        accessibilityInfo: void 0
      }));
    });
  }
};
DefaultFormatter.configName = "editor.defaultFormatter";
DefaultFormatter.extensionIds = [];
DefaultFormatter.extensionItemLabels = [];
DefaultFormatter.extensionDescriptions = [];
DefaultFormatter = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IWorkbenchExtensionEnablementService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, IQuickInputService),
  __decorateParam(6, ILanguageService),
  __decorateParam(7, ILanguageFeaturesService),
  __decorateParam(8, ILanguageStatusService),
  __decorateParam(9, IEditorService)
], DefaultFormatter);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
  DefaultFormatter,
  LifecyclePhase.Restored
);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...editorConfigurationBaseNode,
  properties: {
    [DefaultFormatter.configName]: {
      description: nls.localize("formatter.default", "Defines a default formatter which takes precedence over all other formatter settings. Must be the identifier of an extension contributing a formatter."),
      type: ["string", "null"],
      default: null,
      enum: DefaultFormatter.extensionIds,
      enumItemLabels: DefaultFormatter.extensionItemLabels,
      markdownEnumDescriptions: DefaultFormatter.extensionDescriptions
    }
  }
});
async function showFormatterPick(accessor, model, formatters) {
  const quickPickService = accessor.get(IQuickInputService);
  const configService = accessor.get(IConfigurationService);
  const languageService = accessor.get(ILanguageService);
  const overrides = { resource: model.uri, overrideIdentifier: model.getLanguageId() };
  const defaultFormatter = configService.getValue(DefaultFormatter.configName, overrides);
  let defaultFormatterPick;
  const picks = formatters.map((provider, index) => {
    const isDefault = ExtensionIdentifier.equals(provider.extensionId, defaultFormatter);
    const pick2 = {
      index,
      label: provider.displayName || "",
      description: isDefault ? nls.localize("def", "(default)") : void 0
    };
    if (isDefault) {
      defaultFormatterPick = pick2;
    }
    return pick2;
  });
  const configurePick = {
    label: nls.localize("config", "Configure Default Formatter...")
  };
  const pick = await quickPickService.pick(
    [...picks, { type: "separator" }, configurePick],
    {
      placeHolder: nls.localize("format.placeHolder", "Select a formatter"),
      activeItem: defaultFormatterPick
    }
  );
  if (!pick) {
    return void 0;
  } else if (pick === configurePick) {
    const langName = languageService.getLanguageName(model.getLanguageId()) || model.getLanguageId();
    const pick2 = await quickPickService.pick(picks, { placeHolder: nls.localize("select", "Select a default formatter for '{0}' files", DefaultFormatter._maybeQuotes(langName)) });
    if (pick2 && formatters[pick2.index].extensionId) {
      configService.updateValue(DefaultFormatter.configName, formatters[pick2.index].extensionId.value, overrides);
    }
    return void 0;
  } else {
    return pick.index;
  }
}
registerEditorAction(class FormatDocumentMultipleAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.formatDocument.multiple",
      label: nls.localize("formatDocument.label.multiple", "Format Document With..."),
      alias: "Format Document...",
      precondition: ContextKeyExpr.and(EditorContextKeys.writable, EditorContextKeys.hasMultipleDocumentFormattingProvider),
      contextMenuOpts: {
        group: "1_modification",
        order: 1.3
      }
    });
  }
  async run(accessor, editor, args) {
    if (!editor.hasModel()) {
      return;
    }
    const instaService = accessor.get(IInstantiationService);
    const languageFeaturesService = accessor.get(ILanguageFeaturesService);
    const model = editor.getModel();
    const provider = getRealAndSyntheticDocumentFormattersOrdered(languageFeaturesService.documentFormattingEditProvider, languageFeaturesService.documentRangeFormattingEditProvider, model);
    const pick = await instaService.invokeFunction(showFormatterPick, model, provider);
    if (typeof pick === "number") {
      await instaService.invokeFunction(formatDocumentWithProvider, provider[pick], editor, FormattingMode.Explicit, CancellationToken.None);
    }
  }
});
registerEditorAction(class FormatSelectionMultipleAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.formatSelection.multiple",
      label: nls.localize("formatSelection.label.multiple", "Format Selection With..."),
      alias: "Format Code...",
      precondition: ContextKeyExpr.and(ContextKeyExpr.and(EditorContextKeys.writable), EditorContextKeys.hasMultipleDocumentSelectionFormattingProvider),
      contextMenuOpts: {
        when: ContextKeyExpr.and(EditorContextKeys.hasNonEmptySelection),
        group: "1_modification",
        order: 1.31
      }
    });
  }
  async run(accessor, editor) {
    if (!editor.hasModel()) {
      return;
    }
    const instaService = accessor.get(IInstantiationService);
    const languageFeaturesService = accessor.get(ILanguageFeaturesService);
    const model = editor.getModel();
    let range = editor.getSelection();
    if (range.isEmpty()) {
      range = new Range(range.startLineNumber, 1, range.startLineNumber, model.getLineMaxColumn(range.startLineNumber));
    }
    const provider = languageFeaturesService.documentRangeFormattingEditProvider.ordered(model);
    const pick = await instaService.invokeFunction(showFormatterPick, model, provider);
    if (typeof pick === "number") {
      await instaService.invokeFunction(formatDocumentRangesWithProvider, provider[pick], editor, range, CancellationToken.None, true);
    }
  }
});
export {
  DefaultFormatter
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9mb3JtYXQvYnJvd3Nlci9mb3JtYXRBY3Rpb25zTXVsdGlwbGUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBnZXRDb2RlRWRpdG9yLCBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQWN0aW9uLCByZWdpc3RlckVkaXRvckFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IERvY3VtZW50Rm9ybWF0dGluZ0VkaXRQcm92aWRlciwgRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBmb3JtYXREb2N1bWVudFJhbmdlc1dpdGhQcm92aWRlciwgZm9ybWF0RG9jdW1lbnRXaXRoUHJvdmlkZXIsIGdldFJlYWxBbmRTeW50aGV0aWNEb2N1bWVudEZvcm1hdHRlcnNPcmRlcmVkLCBGb3JtYXR0aW5nQ29uZmxpY3RzLCBGb3JtYXR0aW5nTW9kZSwgRm9ybWF0dGluZ0tpbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9mb3JtYXQvYnJvd3Nlci9mb3JtYXQuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBDb25maWd1cmF0aW9uRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIFdvcmtiZW5jaEV4dGVuc2lvbnMsIElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlLCB0b0V4dGVuc2lvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgTm90aWZpY2F0aW9uUHJpb3JpdHksIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgZWRpdG9yQ29uZmlndXJhdGlvbkJhc2VOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yQ29uZmlndXJhdGlvblNjaGVtYS5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVN0YXR1c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYW5ndWFnZVN0YXR1cy9jb21tb24vbGFuZ3VhZ2VTdGF0dXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5cbnR5cGUgRm9ybWF0dGluZ0VkaXRQcm92aWRlciA9IERvY3VtZW50Rm9ybWF0dGluZ0VkaXRQcm92aWRlciB8IERvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdFByb3ZpZGVyO1xuXG5leHBvcnQgY2xhc3MgRGVmYXVsdEZvcm1hdHRlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgY29uZmlnTmFtZSA9ICdlZGl0b3IuZGVmYXVsdEZvcm1hdHRlcic7XG5cblx0c3RhdGljIGV4dGVuc2lvbklkczogKHN0cmluZyB8IG51bGwpW10gPSBbXTtcblx0c3RhdGljIGV4dGVuc2lvbkl0ZW1MYWJlbHM6IHN0cmluZ1tdID0gW107XG5cdHN0YXRpYyBleHRlbnNpb25EZXNjcmlwdGlvbnM6IHN0cmluZ1tdID0gW107XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTdGF0dXNTdG9yZSA9IHRoaXMuX3N0b3JlLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWdTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9kaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3F1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0XHRASUxhbmd1YWdlU3RhdHVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVN0YXR1c1NlcnZpY2U6IElMYW5ndWFnZVN0YXR1c1NlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZCh0aGlzLl9leHRlbnNpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlRXh0ZW5zaW9ucyh0aGlzLl91cGRhdGVDb25maWdWYWx1ZXMsIHRoaXMpKTtcblx0XHR0aGlzLl9zdG9yZS5hZGQoRm9ybWF0dGluZ0NvbmZsaWN0cy5zZXRGb3JtYXR0ZXJTZWxlY3RvcigoZm9ybWF0dGVyLCBkb2N1bWVudCwgbW9kZSwga2luZCkgPT4gdGhpcy5fc2VsZWN0Rm9ybWF0dGVyKGZvcm1hdHRlciwgZG9jdW1lbnQsIG1vZGUsIGtpbmQpKSk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKF9lZGl0b3JTZXJ2aWNlLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKHRoaXMuX3VwZGF0ZVN0YXR1cywgdGhpcykpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRGb3JtYXR0aW5nRWRpdFByb3ZpZGVyLm9uRGlkQ2hhbmdlKHRoaXMuX3VwZGF0ZVN0YXR1cywgdGhpcykpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIub25EaWRDaGFuZ2UodGhpcy5fdXBkYXRlU3RhdHVzLCB0aGlzKSk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKF9jb25maWdTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oRGVmYXVsdEZvcm1hdHRlci5jb25maWdOYW1lKSAmJiB0aGlzLl91cGRhdGVTdGF0dXMoKSkpO1xuXHRcdHRoaXMuX3VwZGF0ZUNvbmZpZ1ZhbHVlcygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfdXBkYXRlQ29uZmlnVmFsdWVzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX2V4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cdFx0bGV0IGV4dGVuc2lvbnMgPSBbLi4udGhpcy5fZXh0ZW5zaW9uU2VydmljZS5leHRlbnNpb25zXTtcblxuXHRcdGV4dGVuc2lvbnMgPSBleHRlbnNpb25zLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGNvbnN0IGJvb3N0QSA9IGEuY2F0ZWdvcmllcz8uZmluZChjYXQgPT4gY2F0ID09PSAnRm9ybWF0dGVycycgfHwgY2F0ID09PSAnUHJvZ3JhbW1pbmcgTGFuZ3VhZ2VzJyk7XG5cdFx0XHRjb25zdCBib29zdEIgPSBiLmNhdGVnb3JpZXM/LmZpbmQoY2F0ID0+IGNhdCA9PT0gJ0Zvcm1hdHRlcnMnIHx8IGNhdCA9PT0gJ1Byb2dyYW1taW5nIExhbmd1YWdlcycpO1xuXG5cdFx0XHRpZiAoYm9vc3RBICYmICFib29zdEIpIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fSBlbHNlIGlmICghYm9vc3RBICYmIGJvb3N0Qikge1xuXHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0RGVmYXVsdEZvcm1hdHRlci5leHRlbnNpb25JZHMubGVuZ3RoID0gMDtcblx0XHREZWZhdWx0Rm9ybWF0dGVyLmV4dGVuc2lvbkl0ZW1MYWJlbHMubGVuZ3RoID0gMDtcblx0XHREZWZhdWx0Rm9ybWF0dGVyLmV4dGVuc2lvbkRlc2NyaXB0aW9ucy5sZW5ndGggPSAwO1xuXG5cdFx0RGVmYXVsdEZvcm1hdHRlci5leHRlbnNpb25JZHMucHVzaChudWxsKTtcblx0XHREZWZhdWx0Rm9ybWF0dGVyLmV4dGVuc2lvbkl0ZW1MYWJlbHMucHVzaChubHMubG9jYWxpemUoJ251bGwnLCAnTm9uZScpKTtcblx0XHREZWZhdWx0Rm9ybWF0dGVyLmV4dGVuc2lvbkRlc2NyaXB0aW9ucy5wdXNoKG5scy5sb2NhbGl6ZSgnbnVsbEZvcm1hdHRlckRlc2NyaXB0aW9uJywgXCJOb25lXCIpKTtcblxuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4dGVuc2lvbnMpIHtcblx0XHRcdGlmIChleHRlbnNpb24ubWFpbiB8fCBleHRlbnNpb24uYnJvd3Nlcikge1xuXHRcdFx0XHREZWZhdWx0Rm9ybWF0dGVyLmV4dGVuc2lvbklkcy5wdXNoKGV4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlKTtcblx0XHRcdFx0RGVmYXVsdEZvcm1hdHRlci5leHRlbnNpb25JdGVtTGFiZWxzLnB1c2goZXh0ZW5zaW9uLmRpc3BsYXlOYW1lID8/ICcnKTtcblx0XHRcdFx0RGVmYXVsdEZvcm1hdHRlci5leHRlbnNpb25EZXNjcmlwdGlvbnMucHVzaChleHRlbnNpb24uZGVzY3JpcHRpb24gPz8gJycpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHN0YXRpYyBfbWF5YmVRdW90ZXMoczogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gcy5tYXRjaCgvXFxzLykgPyBgJyR7c30nYCA6IHM7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9hbmFseXplRm9ybWF0dGVyPFQgZXh0ZW5kcyBGb3JtYXR0aW5nRWRpdFByb3ZpZGVyPihraW5kOiBGb3JtYXR0aW5nS2luZCwgZm9ybWF0dGVyOiBUW10sIGRvY3VtZW50OiBJVGV4dE1vZGVsKTogUHJvbWlzZTxUIHwgc3RyaW5nPiB7XG5cdFx0Y29uc3QgZGVmYXVsdEZvcm1hdHRlcklkID0gdGhpcy5fY29uZmlnU2VydmljZS5nZXRWYWx1ZTxzdHJpbmc+KERlZmF1bHRGb3JtYXR0ZXIuY29uZmlnTmFtZSwge1xuXHRcdFx0cmVzb3VyY2U6IGRvY3VtZW50LnVyaSxcblx0XHRcdG92ZXJyaWRlSWRlbnRpZmllcjogZG9jdW1lbnQuZ2V0TGFuZ3VhZ2VJZCgpXG5cdFx0fSk7XG5cblx0XHRpZiAoZGVmYXVsdEZvcm1hdHRlcklkKSB7XG5cdFx0XHQvLyBnb29kIC0+IGZvcm1hdHRlciBjb25maWd1cmVkXG5cdFx0XHRjb25zdCBkZWZhdWx0Rm9ybWF0dGVyID0gZm9ybWF0dGVyLmZpbmQoZm9ybWF0dGVyID0+IEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKGZvcm1hdHRlci5leHRlbnNpb25JZCwgZGVmYXVsdEZvcm1hdHRlcklkKSk7XG5cdFx0XHRpZiAoZGVmYXVsdEZvcm1hdHRlcikge1xuXHRcdFx0XHQvLyBmb3JtYXR0ZXIgYXZhaWxhYmxlXG5cdFx0XHRcdHJldHVybiBkZWZhdWx0Rm9ybWF0dGVyO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBiYWQgLT4gZm9ybWF0dGVyIGdvbmVcblx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IGF3YWl0IHRoaXMuX2V4dGVuc2lvblNlcnZpY2UuZ2V0RXh0ZW5zaW9uKGRlZmF1bHRGb3JtYXR0ZXJJZCk7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uICYmIHRoaXMuX2V4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZCh0b0V4dGVuc2lvbihleHRlbnNpb24pKSkge1xuXHRcdFx0XHQvLyBmb3JtYXR0ZXIgZG9lcyBub3QgdGFyZ2V0IHRoaXMgZmlsZVxuXHRcdFx0XHRjb25zdCBsYW5nTmFtZSA9IHRoaXMuX2xhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZU5hbWUoZG9jdW1lbnQuZ2V0TGFuZ3VhZ2VJZCgpKSB8fCBkb2N1bWVudC5nZXRMYW5ndWFnZUlkKCk7XG5cdFx0XHRcdGNvbnN0IGRldGFpbCA9IGtpbmQgPT09IEZvcm1hdHRpbmdLaW5kLkZpbGVcblx0XHRcdFx0XHQ/IG5scy5sb2NhbGl6ZSgnbWlzcy4xJywgXCJFeHRlbnNpb24gJ3swfScgaXMgY29uZmlndXJlZCBhcyBmb3JtYXR0ZXIgYnV0IGl0IGNhbm5vdCBmb3JtYXQgJ3sxfSctZmlsZXNcIiwgZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5uYW1lLCBsYW5nTmFtZSlcblx0XHRcdFx0XHQ6IG5scy5sb2NhbGl6ZSgnbWlzcy4yJywgXCJFeHRlbnNpb24gJ3swfScgaXMgY29uZmlndXJlZCBhcyBmb3JtYXR0ZXIgYnV0IGl0IGNhbiBvbmx5IGZvcm1hdCAnezF9Jy1maWxlcyBhcyBhIHdob2xlLCBub3Qgc2VsZWN0aW9ucyBvciBwYXJ0cyBvZiBpdC5cIiwgZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5uYW1lLCBsYW5nTmFtZSk7XG5cdFx0XHRcdHJldHVybiBkZXRhaWw7XG5cdFx0XHR9XG5cblx0XHR9IGVsc2UgaWYgKGZvcm1hdHRlci5sZW5ndGggPT09IDEpIHtcblx0XHRcdC8vIG9rIC0+IG5vdGhpbmcgY29uZmlndXJlZCBidXQgb25seSBvbmUgZm9ybWF0dGVyIGF2YWlsYWJsZVxuXHRcdFx0cmV0dXJuIGZvcm1hdHRlclswXTtcblx0XHR9XG5cblx0XHRjb25zdCBsYW5nTmFtZSA9IHRoaXMuX2xhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZU5hbWUoZG9jdW1lbnQuZ2V0TGFuZ3VhZ2VJZCgpKSB8fCBkb2N1bWVudC5nZXRMYW5ndWFnZUlkKCk7XG5cdFx0Y29uc3QgbWVzc2FnZSA9ICFkZWZhdWx0Rm9ybWF0dGVySWRcblx0XHRcdD8gbmxzLmxvY2FsaXplKCdjb25maWcubmVlZGVkJywgXCJUaGVyZSBhcmUgbXVsdGlwbGUgZm9ybWF0dGVycyBmb3IgJ3swfScgZmlsZXMuIE9uZSBvZiB0aGVtIHNob3VsZCBiZSBjb25maWd1cmVkIGFzIGRlZmF1bHQgZm9ybWF0dGVyLlwiLCBEZWZhdWx0Rm9ybWF0dGVyLl9tYXliZVF1b3RlcyhsYW5nTmFtZSkpXG5cdFx0XHQ6IG5scy5sb2NhbGl6ZSgnY29uZmlnLmJhZCcsIFwiRXh0ZW5zaW9uICd7MH0nIGlzIGNvbmZpZ3VyZWQgYXMgZm9ybWF0dGVyIGJ1dCBub3QgYXZhaWxhYmxlLiBTZWxlY3QgYSBkaWZmZXJlbnQgZGVmYXVsdCBmb3JtYXR0ZXIgdG8gY29udGludWUuXCIsIGRlZmF1bHRGb3JtYXR0ZXJJZCk7XG5cblx0XHRyZXR1cm4gbWVzc2FnZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3NlbGVjdEZvcm1hdHRlcjxUIGV4dGVuZHMgRm9ybWF0dGluZ0VkaXRQcm92aWRlcj4oZm9ybWF0dGVyOiBUW10sIGRvY3VtZW50OiBJVGV4dE1vZGVsLCBtb2RlOiBGb3JtYXR0aW5nTW9kZSwga2luZDogRm9ybWF0dGluZ0tpbmQpOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBmb3JtYXR0ZXJPck1lc3NhZ2UgPSBhd2FpdCB0aGlzLl9hbmFseXplRm9ybWF0dGVyKGtpbmQsIGZvcm1hdHRlciwgZG9jdW1lbnQpO1xuXHRcdGlmICh0eXBlb2YgZm9ybWF0dGVyT3JNZXNzYWdlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIGZvcm1hdHRlck9yTWVzc2FnZTtcblx0XHR9XG5cblx0XHRpZiAobW9kZSAhPT0gRm9ybWF0dGluZ01vZGUuU2lsZW50KSB7XG5cdFx0XHQvLyBydW5uaW5nIGZyb20gYSB1c2VyIGFjdGlvbiAtPiBzaG93IG1vZGFsIGRpYWxvZyBzbyB0aGF0IHVzZXJzIGNvbmZpZ3VyZVxuXHRcdFx0Ly8gYSBkZWZhdWx0IGZvcm1hdHRlclxuXHRcdFx0Y29uc3QgeyBjb25maXJtZWQgfSA9IGF3YWl0IHRoaXMuX2RpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnbWlzcycsIFwiQ29uZmlndXJlIERlZmF1bHQgRm9ybWF0dGVyXCIpLFxuXHRcdFx0XHRkZXRhaWw6IGZvcm1hdHRlck9yTWVzc2FnZSxcblx0XHRcdFx0cHJpbWFyeUJ1dHRvbjogbmxzLmxvY2FsaXplKHsga2V5OiAnZG8uY29uZmlnJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQ29uZmlndXJlLi4uXCIpXG5cdFx0XHR9KTtcblx0XHRcdGlmIChjb25maXJtZWQpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3BpY2tBbmRQZXJzaXN0RGVmYXVsdEZvcm1hdHRlcihmb3JtYXR0ZXIsIGRvY3VtZW50KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gbm8gdXNlciBhY3Rpb24gLT4gc2hvdyBhIHNpbGVudCBub3RpZmljYXRpb24gYW5kIHByb2NlZWRcblx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFxuXHRcdFx0XHRTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRmb3JtYXR0ZXJPck1lc3NhZ2UsXG5cdFx0XHRcdFt7IGxhYmVsOiBubHMubG9jYWxpemUoJ2RvLmNvbmZpZy5ub3RpZmljYXRpb24nLCBcIkNvbmZpZ3VyZS4uLlwiKSwgcnVuOiAoKSA9PiB0aGlzLl9waWNrQW5kUGVyc2lzdERlZmF1bHRGb3JtYXR0ZXIoZm9ybWF0dGVyLCBkb2N1bWVudCkgfV0sXG5cdFx0XHRcdHsgcHJpb3JpdHk6IE5vdGlmaWNhdGlvblByaW9yaXR5LlNJTEVOVCB9XG5cdFx0XHQpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcGlja0FuZFBlcnNpc3REZWZhdWx0Rm9ybWF0dGVyPFQgZXh0ZW5kcyBGb3JtYXR0aW5nRWRpdFByb3ZpZGVyPihmb3JtYXR0ZXI6IFRbXSwgZG9jdW1lbnQ6IElUZXh0TW9kZWwpOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBwaWNrcyA9IGZvcm1hdHRlci5tYXAoKGZvcm1hdHRlciwgaW5kZXgpOiBJSW5kZXhlZFBpY2sgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aW5kZXgsXG5cdFx0XHRcdGxhYmVsOiBmb3JtYXR0ZXIuZGlzcGxheU5hbWUgfHwgKGZvcm1hdHRlci5leHRlbnNpb25JZCA/IGZvcm1hdHRlci5leHRlbnNpb25JZC52YWx1ZSA6ICc/JyksXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBmb3JtYXR0ZXIuZXh0ZW5zaW9uSWQgJiYgZm9ybWF0dGVyLmV4dGVuc2lvbklkLnZhbHVlXG5cdFx0XHR9O1xuXHRcdH0pO1xuXHRcdGNvbnN0IGxhbmdOYW1lID0gdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmdldExhbmd1YWdlTmFtZShkb2N1bWVudC5nZXRMYW5ndWFnZUlkKCkpIHx8IGRvY3VtZW50LmdldExhbmd1YWdlSWQoKTtcblx0XHRjb25zdCBwaWNrID0gYXdhaXQgdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UucGljayhwaWNrcywgeyBwbGFjZUhvbGRlcjogbmxzLmxvY2FsaXplKCdzZWxlY3QnLCBcIlNlbGVjdCBhIGRlZmF1bHQgZm9ybWF0dGVyIGZvciAnezB9JyBmaWxlc1wiLCBEZWZhdWx0Rm9ybWF0dGVyLl9tYXliZVF1b3RlcyhsYW5nTmFtZSkpIH0pO1xuXHRcdGlmICghcGljayB8fCAhZm9ybWF0dGVyW3BpY2suaW5kZXhdLmV4dGVuc2lvbklkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLl9jb25maWdTZXJ2aWNlLnVwZGF0ZVZhbHVlKERlZmF1bHRGb3JtYXR0ZXIuY29uZmlnTmFtZSwgZm9ybWF0dGVyW3BpY2suaW5kZXhdLmV4dGVuc2lvbklkIS52YWx1ZSwge1xuXHRcdFx0cmVzb3VyY2U6IGRvY3VtZW50LnVyaSxcblx0XHRcdG92ZXJyaWRlSWRlbnRpZmllcjogZG9jdW1lbnQuZ2V0TGFuZ3VhZ2VJZCgpXG5cdFx0fSk7XG5cdFx0cmV0dXJuIGZvcm1hdHRlcltwaWNrLmluZGV4XTtcblx0fVxuXG5cdC8vIC0tLSBzdGF0dXMgaXRlbVxuXG5cdHByaXZhdGUgX3VwZGF0ZVN0YXR1cygpIHtcblx0XHR0aGlzLl9sYW5ndWFnZVN0YXR1c1N0b3JlLmNsZWFyKCk7XG5cblx0XHRjb25zdCBlZGl0b3IgPSBnZXRDb2RlRWRpdG9yKHRoaXMuX2VkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpO1xuXHRcdGlmICghZWRpdG9yIHx8ICFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXG5cdFx0Y29uc3QgZG9jdW1lbnQgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRjb25zdCBmb3JtYXR0ZXIgPSBnZXRSZWFsQW5kU3ludGhldGljRG9jdW1lbnRGb3JtYXR0ZXJzT3JkZXJlZCh0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudEZvcm1hdHRpbmdFZGl0UHJvdmlkZXIsIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdFByb3ZpZGVyLCBkb2N1bWVudCk7XG5cblx0XHRpZiAoZm9ybWF0dGVyLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdHRoaXMuX2xhbmd1YWdlU3RhdHVzU3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBjdHMuZGlzcG9zZSh0cnVlKSkpO1xuXG5cdFx0dGhpcy5fYW5hbHl6ZUZvcm1hdHRlcihGb3JtYXR0aW5nS2luZC5GaWxlLCBmb3JtYXR0ZXIsIGRvY3VtZW50KS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRpZiAoY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlb2YgcmVzdWx0ICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjb21tYW5kID0geyBpZDogYGZvcm1hdHRlci9jb25maWd1cmUvZGZsLyR7Z2VuZXJhdGVVdWlkKCl9YCwgdGl0bGU6IG5scy5sb2NhbGl6ZSgnZG8uY29uZmlnLmNvbW1hbmQnLCBcIkNvbmZpZ3VyZS4uLlwiKSB9O1xuXHRcdFx0dGhpcy5fbGFuZ3VhZ2VTdGF0dXNTdG9yZS5hZGQoQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoY29tbWFuZC5pZCwgKCkgPT4gdGhpcy5fcGlja0FuZFBlcnNpc3REZWZhdWx0Rm9ybWF0dGVyKGZvcm1hdHRlciwgZG9jdW1lbnQpKSk7XG5cdFx0XHR0aGlzLl9sYW5ndWFnZVN0YXR1c1N0b3JlLmFkZCh0aGlzLl9sYW5ndWFnZVN0YXR1c1NlcnZpY2UuYWRkU3RhdHVzKHtcblx0XHRcdFx0aWQ6ICdmb3JtYXR0ZXIuY29uZmxpY3QnLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUoJ3N1bW1hcnknLCBcIkZvcm1hdHRlciBDb25mbGljdHNcIiksXG5cdFx0XHRcdHNlbGVjdG9yOiB7IGxhbmd1YWdlOiBkb2N1bWVudC5nZXRMYW5ndWFnZUlkKCksIHBhdHRlcm46IGRvY3VtZW50LnVyaS5mc1BhdGggfSxcblx0XHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yLFxuXHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdmb3JtYXR0ZXInLCBcIkZvcm1hdHRpbmdcIiksXG5cdFx0XHRcdGRldGFpbDogcmVzdWx0LFxuXHRcdFx0XHRidXN5OiBmYWxzZSxcblx0XHRcdFx0c291cmNlOiAnJyxcblx0XHRcdFx0Y29tbWFuZCxcblx0XHRcdFx0YWNjZXNzaWJpbGl0eUluZm86IHVuZGVmaW5lZFxuXHRcdFx0fSkpO1xuXHRcdH0pO1xuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihcblx0RGVmYXVsdEZvcm1hdHRlcixcblx0TGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWRcbik7XG5cblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pLnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdC4uLmVkaXRvckNvbmZpZ3VyYXRpb25CYXNlTm9kZSxcblx0cHJvcGVydGllczoge1xuXHRcdFtEZWZhdWx0Rm9ybWF0dGVyLmNvbmZpZ05hbWVdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdmb3JtYXR0ZXIuZGVmYXVsdCcsIFwiRGVmaW5lcyBhIGRlZmF1bHQgZm9ybWF0dGVyIHdoaWNoIHRha2VzIHByZWNlZGVuY2Ugb3ZlciBhbGwgb3RoZXIgZm9ybWF0dGVyIHNldHRpbmdzLiBNdXN0IGJlIHRoZSBpZGVudGlmaWVyIG9mIGFuIGV4dGVuc2lvbiBjb250cmlidXRpbmcgYSBmb3JtYXR0ZXIuXCIpLFxuXHRcdFx0dHlwZTogWydzdHJpbmcnLCAnbnVsbCddLFxuXHRcdFx0ZGVmYXVsdDogbnVsbCxcblx0XHRcdGVudW06IERlZmF1bHRGb3JtYXR0ZXIuZXh0ZW5zaW9uSWRzLFxuXHRcdFx0ZW51bUl0ZW1MYWJlbHM6IERlZmF1bHRGb3JtYXR0ZXIuZXh0ZW5zaW9uSXRlbUxhYmVscyxcblx0XHRcdG1hcmtkb3duRW51bURlc2NyaXB0aW9uczogRGVmYXVsdEZvcm1hdHRlci5leHRlbnNpb25EZXNjcmlwdGlvbnNcblx0XHR9XG5cdH1cbn0pO1xuXG5pbnRlcmZhY2UgSUluZGV4ZWRQaWNrIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHRpbmRleDogbnVtYmVyO1xufVxuXG5cbmFzeW5jIGZ1bmN0aW9uIHNob3dGb3JtYXR0ZXJQaWNrKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBtb2RlbDogSVRleHRNb2RlbCwgZm9ybWF0dGVyczogRm9ybWF0dGluZ0VkaXRQcm92aWRlcltdKTogUHJvbWlzZTxudW1iZXIgfCB1bmRlZmluZWQ+IHtcblx0Y29uc3QgcXVpY2tQaWNrU2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRjb25zdCBjb25maWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblxuXHRjb25zdCBvdmVycmlkZXMgPSB7IHJlc291cmNlOiBtb2RlbC51cmksIG92ZXJyaWRlSWRlbnRpZmllcjogbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpIH07XG5cdGNvbnN0IGRlZmF1bHRGb3JtYXR0ZXIgPSBjb25maWdTZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4oRGVmYXVsdEZvcm1hdHRlci5jb25maWdOYW1lLCBvdmVycmlkZXMpO1xuXG5cdGxldCBkZWZhdWx0Rm9ybWF0dGVyUGljazogSUluZGV4ZWRQaWNrIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0IHBpY2tzID0gZm9ybWF0dGVycy5tYXAoKHByb3ZpZGVyLCBpbmRleCkgPT4ge1xuXHRcdGNvbnN0IGlzRGVmYXVsdCA9IEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKHByb3ZpZGVyLmV4dGVuc2lvbklkLCBkZWZhdWx0Rm9ybWF0dGVyKTtcblx0XHRjb25zdCBwaWNrOiBJSW5kZXhlZFBpY2sgPSB7XG5cdFx0XHRpbmRleCxcblx0XHRcdGxhYmVsOiBwcm92aWRlci5kaXNwbGF5TmFtZSB8fCAnJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBpc0RlZmF1bHQgPyBubHMubG9jYWxpemUoJ2RlZicsIFwiKGRlZmF1bHQpXCIpIDogdW5kZWZpbmVkLFxuXHRcdH07XG5cblx0XHRpZiAoaXNEZWZhdWx0KSB7XG5cdFx0XHQvLyBhdXRvZm9jdXMgZGVmYXVsdCBwaWNrXG5cdFx0XHRkZWZhdWx0Rm9ybWF0dGVyUGljayA9IHBpY2s7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBpY2s7XG5cdH0pO1xuXG5cdGNvbnN0IGNvbmZpZ3VyZVBpY2s6IElRdWlja1BpY2tJdGVtID0ge1xuXHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2NvbmZpZycsIFwiQ29uZmlndXJlIERlZmF1bHQgRm9ybWF0dGVyLi4uXCIpXG5cdH07XG5cblx0Y29uc3QgcGljayA9IGF3YWl0IHF1aWNrUGlja1NlcnZpY2UucGljayhbLi4ucGlja3MsIHsgdHlwZTogJ3NlcGFyYXRvcicgfSwgY29uZmlndXJlUGlja10sXG5cdFx0e1xuXHRcdFx0cGxhY2VIb2xkZXI6IG5scy5sb2NhbGl6ZSgnZm9ybWF0LnBsYWNlSG9sZGVyJywgXCJTZWxlY3QgYSBmb3JtYXR0ZXJcIiksXG5cdFx0XHRhY3RpdmVJdGVtOiBkZWZhdWx0Rm9ybWF0dGVyUGlja1xuXHRcdH1cblx0KTtcblx0aWYgKCFwaWNrKSB7XG5cdFx0Ly8gZGlzbWlzc2VkXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblxuXHR9IGVsc2UgaWYgKHBpY2sgPT09IGNvbmZpZ3VyZVBpY2spIHtcblx0XHQvLyBjb25maWcgZGVmYXVsdFxuXHRcdGNvbnN0IGxhbmdOYW1lID0gbGFuZ3VhZ2VTZXJ2aWNlLmdldExhbmd1YWdlTmFtZShtb2RlbC5nZXRMYW5ndWFnZUlkKCkpIHx8IG1vZGVsLmdldExhbmd1YWdlSWQoKTtcblx0XHRjb25zdCBwaWNrID0gYXdhaXQgcXVpY2tQaWNrU2VydmljZS5waWNrKHBpY2tzLCB7IHBsYWNlSG9sZGVyOiBubHMubG9jYWxpemUoJ3NlbGVjdCcsIFwiU2VsZWN0IGEgZGVmYXVsdCBmb3JtYXR0ZXIgZm9yICd7MH0nIGZpbGVzXCIsIERlZmF1bHRGb3JtYXR0ZXIuX21heWJlUXVvdGVzKGxhbmdOYW1lKSkgfSk7XG5cdFx0aWYgKHBpY2sgJiYgZm9ybWF0dGVyc1twaWNrLmluZGV4XS5leHRlbnNpb25JZCkge1xuXHRcdFx0Y29uZmlnU2VydmljZS51cGRhdGVWYWx1ZShEZWZhdWx0Rm9ybWF0dGVyLmNvbmZpZ05hbWUsIGZvcm1hdHRlcnNbcGljay5pbmRleF0uZXh0ZW5zaW9uSWQhLnZhbHVlLCBvdmVycmlkZXMpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXG5cdH0gZWxzZSB7XG5cdFx0Ly8gcGlja2VkIG9uZVxuXHRcdHJldHVybiAoPElJbmRleGVkUGljaz5waWNrKS5pbmRleDtcblx0fVxuXG59XG5cbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKGNsYXNzIEZvcm1hdERvY3VtZW50TXVsdGlwbGVBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5mb3JtYXREb2N1bWVudC5tdWx0aXBsZScsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdmb3JtYXREb2N1bWVudC5sYWJlbC5tdWx0aXBsZScsIFwiRm9ybWF0IERvY3VtZW50IFdpdGguLi5cIiksXG5cdFx0XHRhbGlhczogJ0Zvcm1hdCBEb2N1bWVudC4uLicsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSwgRWRpdG9yQ29udGV4dEtleXMuaGFzTXVsdGlwbGVEb2N1bWVudEZvcm1hdHRpbmdQcm92aWRlciksXG5cdFx0XHRjb250ZXh0TWVudU9wdHM6IHtcblx0XHRcdFx0Z3JvdXA6ICcxX21vZGlmaWNhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAxLjNcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBpbnN0YVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBnZXRSZWFsQW5kU3ludGhldGljRG9jdW1lbnRGb3JtYXR0ZXJzT3JkZXJlZChsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudEZvcm1hdHRpbmdFZGl0UHJvdmlkZXIsIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdFByb3ZpZGVyLCBtb2RlbCk7XG5cdFx0Y29uc3QgcGljayA9IGF3YWl0IGluc3RhU2VydmljZS5pbnZva2VGdW5jdGlvbihzaG93Rm9ybWF0dGVyUGljaywgbW9kZWwsIHByb3ZpZGVyKTtcblx0XHRpZiAodHlwZW9mIHBpY2sgPT09ICdudW1iZXInKSB7XG5cdFx0XHRhd2FpdCBpbnN0YVNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZm9ybWF0RG9jdW1lbnRXaXRoUHJvdmlkZXIsIHByb3ZpZGVyW3BpY2tdLCBlZGl0b3IsIEZvcm1hdHRpbmdNb2RlLkV4cGxpY2l0LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckVkaXRvckFjdGlvbihjbGFzcyBGb3JtYXRTZWxlY3Rpb25NdWx0aXBsZUFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLmZvcm1hdFNlbGVjdGlvbi5tdWx0aXBsZScsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdmb3JtYXRTZWxlY3Rpb24ubGFiZWwubXVsdGlwbGUnLCBcIkZvcm1hdCBTZWxlY3Rpb24gV2l0aC4uLlwiKSxcblx0XHRcdGFsaWFzOiAnRm9ybWF0IENvZGUuLi4nLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuYW5kKEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlKSwgRWRpdG9yQ29udGV4dEtleXMuaGFzTXVsdGlwbGVEb2N1bWVudFNlbGVjdGlvbkZvcm1hdHRpbmdQcm92aWRlciksXG5cdFx0XHRjb250ZXh0TWVudU9wdHM6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEVkaXRvckNvbnRleHRLZXlzLmhhc05vbkVtcHR5U2VsZWN0aW9uKSxcblx0XHRcdFx0Z3JvdXA6ICcxX21vZGlmaWNhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAxLjMxXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGluc3RhU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGxldCByYW5nZTogUmFuZ2UgPSBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0aWYgKHJhbmdlLmlzRW1wdHkoKSkge1xuXHRcdFx0cmFuZ2UgPSBuZXcgUmFuZ2UocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxLCByYW5nZS5zdGFydExpbmVOdW1iZXIsIG1vZGVsLmdldExpbmVNYXhDb2x1bW4ocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFJhbmdlRm9ybWF0dGluZ0VkaXRQcm92aWRlci5vcmRlcmVkKG1vZGVsKTtcblx0XHRjb25zdCBwaWNrID0gYXdhaXQgaW5zdGFTZXJ2aWNlLmludm9rZUZ1bmN0aW9uKHNob3dGb3JtYXR0ZXJQaWNrLCBtb2RlbCwgcHJvdmlkZXIpO1xuXHRcdGlmICh0eXBlb2YgcGljayA9PT0gJ251bWJlcicpIHtcblx0XHRcdGF3YWl0IGluc3RhU2VydmljZS5pbnZva2VGdW5jdGlvbihmb3JtYXREb2N1bWVudFJhbmdlc1dpdGhQcm92aWRlciwgcHJvdmlkZXJbcGlja10sIGVkaXRvciwgcmFuZ2UsIENhbmNlbGxhdGlvblRva2VuLk5vbmUsIHRydWUpO1xuXHRcdH1cblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMscUJBQWtDO0FBQzNDLFNBQVMsY0FBYyw0QkFBNEI7QUFDbkQsU0FBUyx5QkFBeUI7QUFFbEMsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMEJBQTBDO0FBQ25ELFNBQVMsbUJBQW1CLCtCQUErQjtBQUMzRCxTQUFTLDZCQUErQztBQUN4RCxTQUFTLGtDQUFrQyw0QkFBNEIsOENBQThDLHFCQUFxQixnQkFBZ0Isc0JBQXNCO0FBQ2hMLFNBQVMsYUFBYTtBQUN0QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFpQyxjQUFjLCtCQUErQjtBQUM5RSxTQUFTLGNBQWMsMkJBQW9GO0FBQzNHLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsbUJBQW1CLG1CQUFtQjtBQUMvQyxTQUFTLFlBQVksaUJBQWlCLG9CQUFvQjtBQUMxRCxTQUFTLDZCQUE2QjtBQUV0QyxTQUFT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
