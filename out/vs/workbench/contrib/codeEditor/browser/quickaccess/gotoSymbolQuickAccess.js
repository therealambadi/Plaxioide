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
import { localize, localize2 } from "../../../../../nls.js";
import { IQuickInputService, ItemActivation } from "../../../../../platform/quickinput/common/quickInput.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { Extensions as QuickaccessExtensions } from "../../../../../platform/quickinput/common/quickAccess.js";
import { AbstractGotoSymbolQuickAccessProvider } from "../../../../../editor/contrib/quickAccess/browser/gotoSymbolQuickAccess.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { DisposableStore, toDisposable, Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { timeout } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { registerAction2, Action2, MenuId } from "../../../../../platform/actions/common/actions.js";
import { KeyMod, KeyCode } from "../../../../../base/common/keyCodes.js";
import { prepareQuery } from "../../../../../base/common/fuzzyScorer.js";
import { SymbolKind } from "../../../../../editor/common/languages.js";
import { fuzzyScore } from "../../../../../base/common/filters.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IOutlineService, OutlineTarget } from "../../../../services/outline/browser/outline.js";
import { isCompositeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { IOutlineModelService } from "../../../../../editor/contrib/documentSymbols/browser/outlineModel.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { accessibilityHelpIsShown, accessibleViewIsShown } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { matchesFuzzyIconAware, parseLabelWithIcons } from "../../../../../base/common/iconLabels.js";
let GotoSymbolQuickAccessProvider = class extends AbstractGotoSymbolQuickAccessProvider {
  constructor(editorService, editorGroupService, configurationService, languageFeaturesService, outlineService, outlineModelService) {
    super(languageFeaturesService, outlineModelService, {
      openSideBySideDirection: () => this.configuration.openSideBySideDirection
    });
    this.editorService = editorService;
    this.editorGroupService = editorGroupService;
    this.configurationService = configurationService;
    this.outlineService = outlineService;
    this.onDidActiveTextEditorControlChange = this.editorService.onDidActiveEditorChange;
  }
  //#region DocumentSymbols (text editor required)
  get configuration() {
    const editorConfig = this.configurationService.getValue().workbench?.editor;
    return {
      openEditorPinned: !editorConfig?.enablePreviewFromQuickOpen || !editorConfig?.enablePreview,
      openSideBySideDirection: editorConfig?.openSideBySideDirection
    };
  }
  get activeTextEditorControl() {
    if (isCompositeEditor(this.editorService.activeEditorPane?.getControl())) {
      return void 0;
    }
    return this.editorService.activeTextEditorControl;
  }
  gotoLocation(context, options) {
    if ((options.keyMods.alt || this.configuration.openEditorPinned && options.keyMods.ctrlCmd || options.forceSideBySide) && this.editorService.activeEditor) {
      context.restoreViewState?.();
      const editorOptions = {
        selection: options.range,
        pinned: options.keyMods.ctrlCmd || this.configuration.openEditorPinned,
        preserveFocus: options.preserveFocus
      };
      this.editorGroupService.sideGroup.openEditor(this.editorService.activeEditor, editorOptions);
    } else {
      super.gotoLocation(context, options);
    }
  }
  async getSymbolPicks(model, filter, options, disposables, token) {
    const result = await Promise.race([
      this.waitForLanguageSymbolRegistry(model, disposables),
      timeout(GotoSymbolQuickAccessProvider.SYMBOL_PICKS_TIMEOUT)
    ]);
    if (!result || token.isCancellationRequested) {
      return [];
    }
    return this.doGetSymbolPicks(this.getDocumentSymbols(model, token), prepareQuery(filter), options, token, model);
  }
  //#endregion
  provideWithoutTextEditor(picker) {
    if (this.canPickWithOutlineService()) {
      return this.doGetOutlinePicks(picker);
    }
    return super.provideWithoutTextEditor(picker);
  }
  canPickWithOutlineService() {
    return this.editorService.activeEditorPane ? this.outlineService.canCreateOutline(this.editorService.activeEditorPane) : false;
  }
  doGetOutlinePicks(picker) {
    const pane = this.editorService.activeEditorPane;
    if (!pane) {
      return Disposable.None;
    }
    const cts = new CancellationTokenSource();
    const disposables = new DisposableStore();
    disposables.add(toDisposable(() => cts.dispose(true)));
    picker.busy = true;
    this.outlineService.createOutline(pane, OutlineTarget.QuickPick, cts.token).then((outline) => {
      if (!outline) {
        return;
      }
      if (cts.token.isCancellationRequested) {
        outline.dispose();
        return;
      }
      disposables.add(outline);
      const viewState = outline.captureViewState();
      disposables.add(toDisposable(() => {
        if (picker.selectedItems.length === 0) {
          viewState.dispose();
        }
      }));
      const entries = outline.config.quickPickDataSource.getQuickPickElements();
      const items = entries.map((entry, idx) => {
        return {
          kind: SymbolKind.File,
          index: idx,
          score: 0,
          label: entry.label,
          description: entry.description,
          ariaLabel: entry.ariaLabel,
          iconClasses: entry.iconClasses
        };
      });
      disposables.add(picker.onDidAccept(() => {
        picker.hide();
        const [entry] = picker.selectedItems;
        if (entry && entries[entry.index]) {
          outline.reveal(entries[entry.index].element, {}, false, false);
        }
      }));
      const updatePickerItems = () => {
        const filteredItems = items.filter((item) => {
          if (picker.value === "@") {
            item.score = 0;
            item.highlights = void 0;
            return true;
          }
          const trimmedQuery = picker.value.substring(AbstractGotoSymbolQuickAccessProvider.PREFIX.length).trim();
          const parsedLabel = parseLabelWithIcons(item.label);
          const score = fuzzyScore(
            trimmedQuery,
            trimmedQuery.toLowerCase(),
            0,
            parsedLabel.text,
            parsedLabel.text.toLowerCase(),
            0,
            { firstMatchCanBeWeak: true, boostFullMatch: true }
          );
          if (!score) {
            return false;
          }
          item.score = score[1];
          item.highlights = { label: matchesFuzzyIconAware(trimmedQuery, parsedLabel) ?? void 0 };
          return true;
        });
        if (filteredItems.length === 0) {
          const label = localize("empty", "No matching entries");
          picker.items = [{ label, index: -1, kind: SymbolKind.String }];
          picker.ariaLabel = label;
        } else {
          picker.items = filteredItems;
        }
      };
      updatePickerItems();
      disposables.add(picker.onDidChangeValue(updatePickerItems));
      const previewDisposable = new MutableDisposable();
      disposables.add(previewDisposable);
      disposables.add(picker.onDidChangeActive(() => {
        const [entry] = picker.activeItems;
        if (entry && entries[entry.index]) {
          previewDisposable.value = outline.preview(entries[entry.index].element);
        } else {
          previewDisposable.clear();
        }
      }));
    }).catch((err) => {
      onUnexpectedError(err);
      picker.hide();
    }).finally(() => {
      picker.busy = false;
    });
    return disposables;
  }
};
//#endregion
//#region public methods to use this picker from other pickers
GotoSymbolQuickAccessProvider.SYMBOL_PICKS_TIMEOUT = 8e3;
GotoSymbolQuickAccessProvider = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ILanguageFeaturesService),
  __decorateParam(4, IOutlineService),
  __decorateParam(5, IOutlineModelService)
], GotoSymbolQuickAccessProvider);
const _GotoSymbolAction = class _GotoSymbolAction extends Action2 {
  constructor() {
    super({
      id: _GotoSymbolAction.ID,
      title: {
        ...localize2("gotoSymbol", "Go to Symbol in Editor..."),
        mnemonicTitle: localize({ key: "miGotoSymbolInEditor", comment: ["&& denotes a mnemonic"] }, "Go to &&Symbol in Editor...")
      },
      f1: true,
      keybinding: {
        when: ContextKeyExpr.and(accessibleViewIsShown.negate(), accessibilityHelpIsShown.negate()),
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyO
      },
      menu: [{
        id: MenuId.MenubarGoMenu,
        group: "4_symbol_nav",
        order: 1
      }]
    });
  }
  run(accessor) {
    accessor.get(IQuickInputService).quickAccess.show(GotoSymbolQuickAccessProvider.PREFIX, { itemActivation: ItemActivation.NONE });
  }
};
_GotoSymbolAction.ID = "workbench.action.gotoSymbol";
let GotoSymbolAction = _GotoSymbolAction;
registerAction2(GotoSymbolAction);
Registry.as(QuickaccessExtensions.Quickaccess).registerQuickAccessProvider({
  ctor: GotoSymbolQuickAccessProvider,
  prefix: AbstractGotoSymbolQuickAccessProvider.PREFIX,
  contextKey: "inFileSymbolsPicker",
  placeholder: localize("gotoSymbolQuickAccessPlaceholder", "Type the name of a symbol to go to."),
  helpEntries: [
    {
      description: localize("gotoSymbolQuickAccess", "Go to Symbol in Editor"),
      prefix: AbstractGotoSymbolQuickAccessProvider.PREFIX,
      commandId: GotoSymbolAction.ID,
      commandCenterOrder: 40
    },
    {
      description: localize("gotoSymbolByCategoryQuickAccess", "Go to Symbol in Editor by Category"),
      prefix: AbstractGotoSymbolQuickAccessProvider.PREFIX_BY_CATEGORY
    }
  ]
});
export {
  GotoSymbolQuickAccessProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvcXVpY2thY2Nlc3MvZ290b1N5bWJvbFF1aWNrQWNjZXNzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJS2V5TW9kcywgSVF1aWNrUGlja1NlcGFyYXRvciwgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrLCBJdGVtQWN0aXZhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElRdWlja0FjY2Vzc1JlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIFF1aWNrYWNjZXNzRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrQWNjZXNzLmpzJztcbmltcG9ydCB7IEFic3RyYWN0R290b1N5bWJvbFF1aWNrQWNjZXNzUHJvdmlkZXIsIElHb3RvU3ltYm9sUXVpY2tQaWNrSXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3F1aWNrQWNjZXNzL2Jyb3dzZXIvZ290b1N5bWJvbFF1aWNrQWNjZXNzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVkaXRvckNvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSwgRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckFjdGlvbjIsIEFjdGlvbjIsIE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgS2V5TW9kLCBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgcHJlcGFyZVF1ZXJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZnV6enlTY29yZXIuanMnO1xuaW1wb3J0IHsgU3ltYm9sS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IGZ1enp5U2NvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElRdWlja0FjY2Vzc1RleHRFZGl0b3JDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvcXVpY2tBY2Nlc3MvYnJvd3Nlci9lZGl0b3JOYXZpZ2F0aW9uUXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgSU91dGxpbmVTZXJ2aWNlLCBPdXRsaW5lVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvb3V0bGluZS9icm93c2VyL291dGxpbmUuanMnO1xuaW1wb3J0IHsgaXNDb21wb3NpdGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElUZXh0RWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElPdXRsaW5lTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZG9jdW1lbnRTeW1ib2xzL2Jyb3dzZXIvb3V0bGluZU1vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgYWNjZXNzaWJpbGl0eUhlbHBJc1Nob3duLCBhY2Nlc3NpYmxlVmlld0lzU2hvd24gfSBmcm9tICcuLi8uLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgbWF0Y2hlc0Z1enp5SWNvbkF3YXJlLCBwYXJzZUxhYmVsV2l0aEljb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaWNvbkxhYmVscy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBHb3RvU3ltYm9sUXVpY2tBY2Nlc3NQcm92aWRlciBleHRlbmRzIEFic3RyYWN0R290b1N5bWJvbFF1aWNrQWNjZXNzUHJvdmlkZXIge1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBvbkRpZEFjdGl2ZVRleHRFZGl0b3JDb250cm9sQ2hhbmdlID0gdGhpcy5lZGl0b3JTZXJ2aWNlLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJT3V0bGluZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvdXRsaW5lU2VydmljZTogSU91dGxpbmVTZXJ2aWNlLFxuXHRcdEBJT3V0bGluZU1vZGVsU2VydmljZSBvdXRsaW5lTW9kZWxTZXJ2aWNlOiBJT3V0bGluZU1vZGVsU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsIG91dGxpbmVNb2RlbFNlcnZpY2UsIHtcblx0XHRcdG9wZW5TaWRlQnlTaWRlRGlyZWN0aW9uOiAoKSA9PiB0aGlzLmNvbmZpZ3VyYXRpb24ub3BlblNpZGVCeVNpZGVEaXJlY3Rpb25cblx0XHR9KTtcblx0fVxuXG5cdC8vI3JlZ2lvbiBEb2N1bWVudFN5bWJvbHMgKHRleHQgZWRpdG9yIHJlcXVpcmVkKVxuXG5cdHByaXZhdGUgZ2V0IGNvbmZpZ3VyYXRpb24oKSB7XG5cdFx0Y29uc3QgZWRpdG9yQ29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJV29ya2JlbmNoRWRpdG9yQ29uZmlndXJhdGlvbj4oKS53b3JrYmVuY2g/LmVkaXRvcjtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRvcGVuRWRpdG9yUGlubmVkOiAhZWRpdG9yQ29uZmlnPy5lbmFibGVQcmV2aWV3RnJvbVF1aWNrT3BlbiB8fCAhZWRpdG9yQ29uZmlnPy5lbmFibGVQcmV2aWV3LFxuXHRcdFx0b3BlblNpZGVCeVNpZGVEaXJlY3Rpb246IGVkaXRvckNvbmZpZz8ub3BlblNpZGVCeVNpZGVEaXJlY3Rpb25cblx0XHR9O1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldCBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCgpIHtcblxuXHRcdC8vIFRPRE86IHRoaXMgZGlzdGluY3Rpb24gc2hvdWxkIGdvIGF3YXkgYnkgYWRvcHRpbmcgYElPdXRsaW5lU2VydmljZWBcblx0XHQvLyBmb3IgYWxsIGVkaXRvcnMgKGVpdGhlciB0ZXh0IGJhc2VkIG9uZXMgb3Igbm90KS4gQ3VycmVudGx5IHRleHQgYmFzZWRcblx0XHQvLyBlZGl0b3JzIGFyZSBub3QgeWV0IHVzaW5nIHRoZSBuZXcgb3V0bGluZSBzZXJ2aWNlIGluZnJhc3RydWN0dXJlIGJ1dCB0aGVcblx0XHQvLyBcImNsYXNzaWNhbFwiIGRvY3VtZW50IHN5bWJvbHMgYXBwcm9hY2guXG5cdFx0aWYgKGlzQ29tcG9zaXRlRWRpdG9yKHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lPy5nZXRDb250cm9sKCkpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ290b0xvY2F0aW9uKGNvbnRleHQ6IElRdWlja0FjY2Vzc1RleHRFZGl0b3JDb250ZXh0LCBvcHRpb25zOiB7IHJhbmdlOiBJUmFuZ2U7IGtleU1vZHM6IElLZXlNb2RzOyBmb3JjZVNpZGVCeVNpZGU/OiBib29sZWFuOyBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbiB9KTogdm9pZCB7XG5cblx0XHQvLyBDaGVjayBmb3Igc2lkZUJ5U2lkZSB1c2Vcblx0XHRpZiAoKG9wdGlvbnMua2V5TW9kcy5hbHQgfHwgKHRoaXMuY29uZmlndXJhdGlvbi5vcGVuRWRpdG9yUGlubmVkICYmIG9wdGlvbnMua2V5TW9kcy5jdHJsQ21kKSB8fCBvcHRpb25zLmZvcmNlU2lkZUJ5U2lkZSkgJiYgdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcikge1xuXHRcdFx0Y29udGV4dC5yZXN0b3JlVmlld1N0YXRlPy4oKTsgLy8gc2luY2Ugd2Ugb3BlbiB0byB0aGUgc2lkZSwgcmVzdG9yZSB2aWV3IHN0YXRlIGluIHRoaXMgZWRpdG9yXG5cblx0XHRcdGNvbnN0IGVkaXRvck9wdGlvbnM6IElUZXh0RWRpdG9yT3B0aW9ucyA9IHtcblx0XHRcdFx0c2VsZWN0aW9uOiBvcHRpb25zLnJhbmdlLFxuXHRcdFx0XHRwaW5uZWQ6IG9wdGlvbnMua2V5TW9kcy5jdHJsQ21kIHx8IHRoaXMuY29uZmlndXJhdGlvbi5vcGVuRWRpdG9yUGlubmVkLFxuXHRcdFx0XHRwcmVzZXJ2ZUZvY3VzOiBvcHRpb25zLnByZXNlcnZlRm9jdXNcblx0XHRcdH07XG5cblx0XHRcdHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLnNpZGVHcm91cC5vcGVuRWRpdG9yKHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IsIGVkaXRvck9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSBsZXQgcGFyZW50IGhhbmRsZSBpdFxuXHRcdGVsc2Uge1xuXHRcdFx0c3VwZXIuZ290b0xvY2F0aW9uKGNvbnRleHQsIG9wdGlvbnMpO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBwdWJsaWMgbWV0aG9kcyB0byB1c2UgdGhpcyBwaWNrZXIgZnJvbSBvdGhlciBwaWNrZXJzXG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgU1lNQk9MX1BJQ0tTX1RJTUVPVVQgPSA4MDAwO1xuXG5cdGFzeW5jIGdldFN5bWJvbFBpY2tzKG1vZGVsOiBJVGV4dE1vZGVsLCBmaWx0ZXI6IHN0cmluZywgb3B0aW9uczogeyBleHRyYUNvbnRhaW5lckxhYmVsPzogc3RyaW5nIH0sIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8QXJyYXk8SUdvdG9TeW1ib2xRdWlja1BpY2tJdGVtIHwgSVF1aWNrUGlja1NlcGFyYXRvcj4+IHtcblxuXHRcdC8vIElmIHRoZSByZWdpc3RyeSBkb2VzIG5vdCBrbm93IHRoZSBtb2RlbCwgd2Ugd2FpdCBmb3IgYXMgbG9uZyBhc1xuXHRcdC8vIHRoZSByZWdpc3RyeSBrbm93cyBpdC4gVGhpcyBoZWxwcyBpbiBjYXNlcyB3aGVyZSBhIGxhbmd1YWdlXG5cdFx0Ly8gcmVnaXN0cnkgd2FzIG5vdCBhY3RpdmF0ZWQgeWV0IGZvciBwcm92aWRpbmcgYW55IHN5bWJvbHMuXG5cdFx0Ly8gVG8gbm90IHdhaXQgZm9yZXZlciwgd2UgZXZlbnR1YWxseSB0aW1lb3V0IHRob3VnaC5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0dGhpcy53YWl0Rm9yTGFuZ3VhZ2VTeW1ib2xSZWdpc3RyeShtb2RlbCwgZGlzcG9zYWJsZXMpLFxuXHRcdFx0dGltZW91dChHb3RvU3ltYm9sUXVpY2tBY2Nlc3NQcm92aWRlci5TWU1CT0xfUElDS1NfVElNRU9VVClcblx0XHRdKTtcblxuXHRcdGlmICghcmVzdWx0IHx8IHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZG9HZXRTeW1ib2xQaWNrcyh0aGlzLmdldERvY3VtZW50U3ltYm9scyhtb2RlbCwgdG9rZW4pLCBwcmVwYXJlUXVlcnkoZmlsdGVyKSwgb3B0aW9ucywgdG9rZW4sIG1vZGVsKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBwcm92aWRlV2l0aG91dFRleHRFZGl0b3IocGlja2VyOiBJUXVpY2tQaWNrPElHb3RvU3ltYm9sUXVpY2tQaWNrSXRlbSwgeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0+KTogSURpc3Bvc2FibGUge1xuXHRcdGlmICh0aGlzLmNhblBpY2tXaXRoT3V0bGluZVNlcnZpY2UoKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9HZXRPdXRsaW5lUGlja3MocGlja2VyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHN1cGVyLnByb3ZpZGVXaXRob3V0VGV4dEVkaXRvcihwaWNrZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBjYW5QaWNrV2l0aE91dGxpbmVTZXJ2aWNlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSA/IHRoaXMub3V0bGluZVNlcnZpY2UuY2FuQ3JlYXRlT3V0bGluZSh0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSkgOiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgZG9HZXRPdXRsaW5lUGlja3MocGlja2VyOiBJUXVpY2tQaWNrPElHb3RvU3ltYm9sUXVpY2tQaWNrSXRlbSwgeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0+KTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHBhbmUgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRpZiAoIXBhbmUpIHtcblx0XHRcdHJldHVybiBEaXNwb3NhYmxlLk5vbmU7XG5cdFx0fVxuXHRcdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBjdHMuZGlzcG9zZSh0cnVlKSkpO1xuXG5cdFx0cGlja2VyLmJ1c3kgPSB0cnVlO1xuXG5cdFx0dGhpcy5vdXRsaW5lU2VydmljZS5jcmVhdGVPdXRsaW5lKHBhbmUsIE91dGxpbmVUYXJnZXQuUXVpY2tQaWNrLCBjdHMudG9rZW4pLnRoZW4ob3V0bGluZSA9PiB7XG5cblx0XHRcdGlmICghb3V0bGluZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdG91dGxpbmUuZGlzcG9zZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChvdXRsaW5lKTtcblxuXHRcdFx0Y29uc3Qgdmlld1N0YXRlID0gb3V0bGluZS5jYXB0dXJlVmlld1N0YXRlKCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0aWYgKHBpY2tlci5zZWxlY3RlZEl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHZpZXdTdGF0ZS5kaXNwb3NlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0Y29uc3QgZW50cmllcyA9IG91dGxpbmUuY29uZmlnLnF1aWNrUGlja0RhdGFTb3VyY2UuZ2V0UXVpY2tQaWNrRWxlbWVudHMoKTtcblxuXHRcdFx0Y29uc3QgaXRlbXM6IElHb3RvU3ltYm9sUXVpY2tQaWNrSXRlbVtdID0gZW50cmllcy5tYXAoKGVudHJ5LCBpZHgpID0+IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRraW5kOiBTeW1ib2xLaW5kLkZpbGUsXG5cdFx0XHRcdFx0aW5kZXg6IGlkeCxcblx0XHRcdFx0XHRzY29yZTogMCxcblx0XHRcdFx0XHRsYWJlbDogZW50cnkubGFiZWwsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGVudHJ5LmRlc2NyaXB0aW9uLFxuXHRcdFx0XHRcdGFyaWFMYWJlbDogZW50cnkuYXJpYUxhYmVsLFxuXHRcdFx0XHRcdGljb25DbGFzc2VzOiBlbnRyeS5pY29uQ2xhc3Nlc1xuXHRcdFx0XHR9O1xuXHRcdFx0fSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChwaWNrZXIub25EaWRBY2NlcHQoKCkgPT4ge1xuXHRcdFx0XHRwaWNrZXIuaGlkZSgpO1xuXHRcdFx0XHRjb25zdCBbZW50cnldID0gcGlja2VyLnNlbGVjdGVkSXRlbXM7XG5cdFx0XHRcdGlmIChlbnRyeSAmJiBlbnRyaWVzW2VudHJ5LmluZGV4XSkge1xuXHRcdFx0XHRcdG91dGxpbmUucmV2ZWFsKGVudHJpZXNbZW50cnkuaW5kZXhdLmVsZW1lbnQsIHt9LCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdGNvbnN0IHVwZGF0ZVBpY2tlckl0ZW1zID0gKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBmaWx0ZXJlZEl0ZW1zID0gaXRlbXMuZmlsdGVyKGl0ZW0gPT4ge1xuXHRcdFx0XHRcdGlmIChwaWNrZXIudmFsdWUgPT09ICdAJykge1xuXHRcdFx0XHRcdFx0Ly8gZGVmYXVsdCwgbm8gZmlsdGVyaW5nLCBzY29yaW5nLi4uXG5cdFx0XHRcdFx0XHRpdGVtLnNjb3JlID0gMDtcblx0XHRcdFx0XHRcdGl0ZW0uaGlnaGxpZ2h0cyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHRyaW1tZWRRdWVyeSA9IHBpY2tlci52YWx1ZS5zdWJzdHJpbmcoQWJzdHJhY3RHb3RvU3ltYm9sUXVpY2tBY2Nlc3NQcm92aWRlci5QUkVGSVgubGVuZ3RoKS50cmltKCk7XG5cdFx0XHRcdFx0Y29uc3QgcGFyc2VkTGFiZWwgPSBwYXJzZUxhYmVsV2l0aEljb25zKGl0ZW0ubGFiZWwpO1xuXHRcdFx0XHRcdGNvbnN0IHNjb3JlID0gZnV6enlTY29yZSh0cmltbWVkUXVlcnksIHRyaW1tZWRRdWVyeS50b0xvd2VyQ2FzZSgpLCAwLFxuXHRcdFx0XHRcdFx0cGFyc2VkTGFiZWwudGV4dCwgcGFyc2VkTGFiZWwudGV4dC50b0xvd2VyQ2FzZSgpLCAwLFxuXHRcdFx0XHRcdFx0eyBmaXJzdE1hdGNoQ2FuQmVXZWFrOiB0cnVlLCBib29zdEZ1bGxNYXRjaDogdHJ1ZSB9KTtcblxuXHRcdFx0XHRcdGlmICghc2NvcmUpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpdGVtLnNjb3JlID0gc2NvcmVbMV07XG5cdFx0XHRcdFx0aXRlbS5oaWdobGlnaHRzID0geyBsYWJlbDogbWF0Y2hlc0Z1enp5SWNvbkF3YXJlKHRyaW1tZWRRdWVyeSwgcGFyc2VkTGFiZWwpID8/IHVuZGVmaW5lZCB9O1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRpZiAoZmlsdGVyZWRJdGVtcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRjb25zdCBsYWJlbCA9IGxvY2FsaXplKCdlbXB0eScsICdObyBtYXRjaGluZyBlbnRyaWVzJyk7XG5cdFx0XHRcdFx0cGlja2VyLml0ZW1zID0gW3sgbGFiZWwsIGluZGV4OiAtMSwga2luZDogU3ltYm9sS2luZC5TdHJpbmcgfV07XG5cdFx0XHRcdFx0cGlja2VyLmFyaWFMYWJlbCA9IGxhYmVsO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHBpY2tlci5pdGVtcyA9IGZpbHRlcmVkSXRlbXM7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHR1cGRhdGVQaWNrZXJJdGVtcygpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHBpY2tlci5vbkRpZENoYW5nZVZhbHVlKHVwZGF0ZVBpY2tlckl0ZW1zKSk7XG5cblx0XHRcdGNvbnN0IHByZXZpZXdEaXNwb3NhYmxlID0gbmV3IE11dGFibGVEaXNwb3NhYmxlKCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocHJldmlld0Rpc3Bvc2FibGUpO1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocGlja2VyLm9uRGlkQ2hhbmdlQWN0aXZlKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgW2VudHJ5XSA9IHBpY2tlci5hY3RpdmVJdGVtcztcblx0XHRcdFx0aWYgKGVudHJ5ICYmIGVudHJpZXNbZW50cnkuaW5kZXhdKSB7XG5cdFx0XHRcdFx0cHJldmlld0Rpc3Bvc2FibGUudmFsdWUgPSBvdXRsaW5lLnByZXZpZXcoZW50cmllc1tlbnRyeS5pbmRleF0uZWxlbWVudCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cHJldmlld0Rpc3Bvc2FibGUuY2xlYXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0fSkuY2F0Y2goZXJyID0+IHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdFx0XHRwaWNrZXIuaGlkZSgpO1xuXHRcdH0pLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0cGlja2VyLmJ1c3kgPSBmYWxzZTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBkaXNwb3NhYmxlcztcblx0fVxufVxuXG5jbGFzcyBHb3RvU3ltYm9sQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZ290b1N5bWJvbCc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEdvdG9TeW1ib2xBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5sb2NhbGl6ZTIoJ2dvdG9TeW1ib2wnLCBcIkdvIHRvIFN5bWJvbCBpbiBFZGl0b3IuLi5cIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlHb3RvU3ltYm9sSW5FZGl0b3InLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiR28gdG8gJiZTeW1ib2wgaW4gRWRpdG9yLi4uXCIpLFxuXHRcdFx0fSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoYWNjZXNzaWJsZVZpZXdJc1Nob3duLm5lZ2F0ZSgpLCBhY2Nlc3NpYmlsaXR5SGVscElzU2hvd24ubmVnYXRlKCkpLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleU9cblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJHb01lbnUsXG5cdFx0XHRcdGdyb3VwOiAnNF9zeW1ib2xfbmF2Jyxcblx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKS5xdWlja0FjY2Vzcy5zaG93KEdvdG9TeW1ib2xRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCwgeyBpdGVtQWN0aXZhdGlvbjogSXRlbUFjdGl2YXRpb24uTk9ORSB9KTtcblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoR290b1N5bWJvbEFjdGlvbik7XG5cblJlZ2lzdHJ5LmFzPElRdWlja0FjY2Vzc1JlZ2lzdHJ5PihRdWlja2FjY2Vzc0V4dGVuc2lvbnMuUXVpY2thY2Nlc3MpLnJlZ2lzdGVyUXVpY2tBY2Nlc3NQcm92aWRlcih7XG5cdGN0b3I6IEdvdG9TeW1ib2xRdWlja0FjY2Vzc1Byb3ZpZGVyLFxuXHRwcmVmaXg6IEFic3RyYWN0R290b1N5bWJvbFF1aWNrQWNjZXNzUHJvdmlkZXIuUFJFRklYLFxuXHRjb250ZXh0S2V5OiAnaW5GaWxlU3ltYm9sc1BpY2tlcicsXG5cdHBsYWNlaG9sZGVyOiBsb2NhbGl6ZSgnZ290b1N5bWJvbFF1aWNrQWNjZXNzUGxhY2Vob2xkZXInLCBcIlR5cGUgdGhlIG5hbWUgb2YgYSBzeW1ib2wgdG8gZ28gdG8uXCIpLFxuXHRoZWxwRW50cmllczogW1xuXHRcdHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ290b1N5bWJvbFF1aWNrQWNjZXNzJywgXCJHbyB0byBTeW1ib2wgaW4gRWRpdG9yXCIpLFxuXHRcdFx0cHJlZml4OiBBYnN0cmFjdEdvdG9TeW1ib2xRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCxcblx0XHRcdGNvbW1hbmRJZDogR290b1N5bWJvbEFjdGlvbi5JRCxcblx0XHRcdGNvbW1hbmRDZW50ZXJPcmRlcjogNDBcblx0XHR9LFxuXHRcdHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ290b1N5bWJvbEJ5Q2F0ZWdvcnlRdWlja0FjY2VzcycsIFwiR28gdG8gU3ltYm9sIGluIEVkaXRvciBieSBDYXRlZ29yeVwiKSxcblx0XHRcdHByZWZpeDogQWJzdHJhY3RHb3RvU3ltYm9sUXVpY2tBY2Nlc3NQcm92aWRlci5QUkVGSVhfQllfQ0FURUdPUllcblx0XHR9XG5cdF1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQXdDLG9CQUFnQyxzQkFBc0I7QUFDOUYsU0FBUyxzQkFBc0I7QUFFL0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBK0IsY0FBYyw2QkFBNkI7QUFDMUUsU0FBUyw2Q0FBdUU7QUFDaEYsU0FBUyw2QkFBNkI7QUFHdEMsU0FBUyxpQkFBOEIsY0FBYyxZQUFZLHlCQUF5QjtBQUMxRixTQUFTLGVBQWU7QUFDeEIsU0FBNEIsK0JBQStCO0FBQzNELFNBQVMsaUJBQWlCLFNBQVMsY0FBYztBQUNqRCxTQUFTLFFBQVEsZUFBZTtBQUNoQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHlCQUF5QjtBQUVsQyxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLGlCQUFpQixxQkFBcUI7QUFDL0MsU0FBUyx5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
