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
import { createCancelablePromise, disposableTimeout, RunOnceScheduler } from "../../../../base/common/async.js";
import { onUnexpectedError, onUnexpectedExternalError } from "../../../../base/common/errors.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { StableEditorScrollState } from "../../../browser/stableEditorScroll.js";
import { MouseTargetType } from "../../../browser/editorBrowser.js";
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { EditorOption, EDITOR_FONT_DEFAULTS } from "../../../common/config/editorOptions.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { getCodeLensModel } from "./codelens.js";
import { ICodeLensCache } from "./codeLensCache.js";
import { CodeLensHelper, CodeLensWidget } from "./codelensWidget.js";
import { localize, localize2 } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ILanguageFeatureDebounceService } from "../../../common/services/languageFeatureDebounce.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
let CodeLensContribution = class {
  constructor(_editor, _languageFeaturesService, debounceService, _commandService, _notificationService, _codeLensCache) {
    this._editor = _editor;
    this._languageFeaturesService = _languageFeaturesService;
    this._commandService = _commandService;
    this._notificationService = _notificationService;
    this._codeLensCache = _codeLensCache;
    this._disposables = new DisposableStore();
    this._localToDispose = new DisposableStore();
    this._lenses = [];
    this._oldCodeLensModels = new DisposableStore();
    this._provideCodeLensDebounce = debounceService.for(_languageFeaturesService.codeLensProvider, "CodeLensProvide", { min: 250 });
    this._resolveCodeLensesDebounce = debounceService.for(_languageFeaturesService.codeLensProvider, "CodeLensResolve", { min: 250, salt: "resolve" });
    this._resolveCodeLensesScheduler = new RunOnceScheduler(() => this._resolveCodeLensesInViewport(), this._resolveCodeLensesDebounce.default());
    this._disposables.add(this._editor.onDidChangeModel(() => this._onModelChange()));
    this._disposables.add(this._editor.onDidChangeModelLanguage(() => this._onModelChange()));
    this._disposables.add(this._editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.fontInfo) || e.hasChanged(EditorOption.codeLensFontSize) || e.hasChanged(EditorOption.codeLensFontFamily)) {
        this._updateLensStyle();
      }
      if (e.hasChanged(EditorOption.codeLens)) {
        this._onModelChange();
      }
    }));
    this._disposables.add(_languageFeaturesService.codeLensProvider.onDidChange(this._onModelChange, this));
    this._onModelChange();
    this._updateLensStyle();
  }
  dispose() {
    this._localDispose();
    this._localToDispose.dispose();
    this._disposables.dispose();
    this._oldCodeLensModels.dispose();
    this._currentCodeLensModel?.dispose();
  }
  _getLayoutInfo() {
    const lineHeightFactor = Math.max(1.3, this._editor.getOption(EditorOption.lineHeight) / this._editor.getOption(EditorOption.fontSize));
    let fontSize = this._editor.getOption(EditorOption.codeLensFontSize);
    if (!fontSize || fontSize < 5) {
      fontSize = this._editor.getOption(EditorOption.fontSize) * 0.9 | 0;
    }
    return {
      fontSize,
      codeLensHeight: fontSize * lineHeightFactor | 0
    };
  }
  _updateLensStyle() {
    const { codeLensHeight, fontSize } = this._getLayoutInfo();
    const fontFamily = this._editor.getOption(EditorOption.codeLensFontFamily);
    const editorFontInfo = this._editor.getOption(EditorOption.fontInfo);
    const { style } = this._editor.getContainerDomNode();
    style.setProperty("--vscode-editorCodeLens-lineHeight", `${codeLensHeight}px`);
    style.setProperty("--vscode-editorCodeLens-fontSize", `${fontSize}px`);
    style.setProperty("--vscode-editorCodeLens-fontFeatureSettings", editorFontInfo.fontFeatureSettings);
    if (fontFamily) {
      style.setProperty("--vscode-editorCodeLens-fontFamily", fontFamily);
      style.setProperty("--vscode-editorCodeLens-fontFamilyDefault", EDITOR_FONT_DEFAULTS.fontFamily);
    }
    this._editor.changeViewZones((accessor) => {
      for (const lens of this._lenses) {
        lens.updateHeight(codeLensHeight, accessor);
      }
    });
  }
  _localDispose() {
    this._getCodeLensModelPromise?.cancel();
    this._getCodeLensModelPromise = void 0;
    this._resolveCodeLensesPromise?.cancel();
    this._resolveCodeLensesPromise = void 0;
    this._localToDispose.clear();
    this._oldCodeLensModels.clear();
    this._currentCodeLensModel?.dispose();
  }
  _onModelChange() {
    this._localDispose();
    const model = this._editor.getModel();
    if (!model) {
      return;
    }
    if (!this._editor.getOption(EditorOption.codeLens) || model.isTooLargeForTokenization()) {
      return;
    }
    const cachedLenses = this._codeLensCache.get(model);
    if (cachedLenses) {
      this._renderCodeLensSymbols(cachedLenses);
    }
    if (!this._languageFeaturesService.codeLensProvider.has(model)) {
      if (cachedLenses) {
        disposableTimeout(() => {
          const cachedLensesNow = this._codeLensCache.get(model);
          if (cachedLenses === cachedLensesNow) {
            this._codeLensCache.delete(model);
            this._onModelChange();
          }
        }, 30 * 1e3, this._localToDispose);
      }
      return;
    }
    for (const provider of this._languageFeaturesService.codeLensProvider.all(model)) {
      if (typeof provider.onDidChange === "function") {
        const registration = provider.onDidChange(() => scheduler.schedule());
        this._localToDispose.add(registration);
      }
    }
    const scheduler = new RunOnceScheduler(() => {
      const t1 = Date.now();
      this._getCodeLensModelPromise?.cancel();
      this._getCodeLensModelPromise = createCancelablePromise((token) => getCodeLensModel(this._languageFeaturesService.codeLensProvider, model, token));
      this._getCodeLensModelPromise.then((result) => {
        if (this._currentCodeLensModel) {
          this._oldCodeLensModels.add(this._currentCodeLensModel);
        }
        this._currentCodeLensModel = result;
        this._codeLensCache.put(model, result);
        const newDelay = this._provideCodeLensDebounce.update(model, Date.now() - t1);
        scheduler.delay = newDelay;
        this._renderCodeLensSymbols(result);
        this._resolveCodeLensesInViewportSoon();
      }, onUnexpectedError);
    }, this._provideCodeLensDebounce.get(model));
    this._localToDispose.add(scheduler);
    this._localToDispose.add(toDisposable(() => this._resolveCodeLensesScheduler.cancel()));
    this._localToDispose.add(this._editor.onDidChangeModelContent(() => {
      this._editor.changeDecorations((decorationsAccessor) => {
        this._editor.changeViewZones((viewZonesAccessor) => {
          const toDispose = [];
          let lastLensLineNumber = -1;
          this._lenses.forEach((lens) => {
            if (!lens.isValid() || lastLensLineNumber === lens.getLineNumber()) {
              toDispose.push(lens);
            } else {
              lens.update(viewZonesAccessor);
              lastLensLineNumber = lens.getLineNumber();
            }
          });
          const helper = new CodeLensHelper();
          toDispose.forEach((l) => {
            l.dispose(helper, viewZonesAccessor);
            this._lenses.splice(this._lenses.indexOf(l), 1);
          });
          helper.commit(decorationsAccessor);
        });
      });
      scheduler.schedule();
      this._resolveCodeLensesScheduler.cancel();
      this._resolveCodeLensesPromise?.cancel();
      this._resolveCodeLensesPromise = void 0;
    }));
    this._localToDispose.add(this._editor.onDidFocusEditorText(() => {
      scheduler.schedule();
    }));
    this._localToDispose.add(this._editor.onDidBlurEditorText(() => {
      scheduler.cancel();
    }));
    this._localToDispose.add(this._editor.onDidScrollChange((e) => {
      if (e.scrollTopChanged && this._lenses.length > 0) {
        this._resolveCodeLensesInViewportSoon();
      }
    }));
    this._localToDispose.add(this._editor.onDidLayoutChange(() => {
      this._resolveCodeLensesInViewportSoon();
    }));
    this._localToDispose.add(toDisposable(() => {
      if (this._editor.getModel()) {
        const scrollState = StableEditorScrollState.capture(this._editor);
        this._editor.changeDecorations((decorationsAccessor) => {
          this._editor.changeViewZones((viewZonesAccessor) => {
            this._disposeAllLenses(decorationsAccessor, viewZonesAccessor);
          });
        });
        scrollState.restore(this._editor);
      } else {
        this._disposeAllLenses(void 0, void 0);
      }
    }));
    this._localToDispose.add(this._editor.onMouseDown((e) => {
      if (e.target.type !== MouseTargetType.CONTENT_WIDGET) {
        return;
      }
      let target = e.target.element;
      if (target?.tagName === "SPAN") {
        target = target.parentElement;
      }
      if (target?.tagName === "A") {
        for (const lens of this._lenses) {
          const command = lens.getCommand(target);
          if (command) {
            this._commandService.executeCommand(command.id, ...command.arguments || []).catch((err) => this._notificationService.error(err));
            break;
          }
        }
      }
    }));
    scheduler.schedule();
  }
  _disposeAllLenses(decChangeAccessor, viewZoneChangeAccessor) {
    const helper = new CodeLensHelper();
    for (const lens of this._lenses) {
      lens.dispose(helper, viewZoneChangeAccessor);
    }
    if (decChangeAccessor) {
      helper.commit(decChangeAccessor);
    }
    this._lenses.length = 0;
  }
  _renderCodeLensSymbols(symbols) {
    if (!this._editor.hasModel()) {
      return;
    }
    const maxLineNumber = this._editor.getModel().getLineCount();
    const groups = [];
    let lastGroup;
    for (const symbol of symbols.lenses) {
      const line = symbol.symbol.range.startLineNumber;
      if (line < 1 || line > maxLineNumber) {
        continue;
      } else if (lastGroup && lastGroup[lastGroup.length - 1].symbol.range.startLineNumber === line) {
        lastGroup.push(symbol);
      } else {
        lastGroup = [symbol];
        groups.push(lastGroup);
      }
    }
    if (!groups.length && !this._lenses.length) {
      return;
    }
    const scrollState = StableEditorScrollState.capture(this._editor);
    const layoutInfo = this._getLayoutInfo();
    this._editor.changeDecorations((decorationsAccessor) => {
      this._editor.changeViewZones((viewZoneAccessor) => {
        const helper = new CodeLensHelper();
        let codeLensIndex = 0;
        let groupsIndex = 0;
        while (groupsIndex < groups.length && codeLensIndex < this._lenses.length) {
          const symbolsLineNumber = groups[groupsIndex][0].symbol.range.startLineNumber;
          const codeLensLineNumber = this._lenses[codeLensIndex].getLineNumber();
          if (codeLensLineNumber < symbolsLineNumber) {
            this._lenses[codeLensIndex].dispose(helper, viewZoneAccessor);
            this._lenses.splice(codeLensIndex, 1);
          } else if (codeLensLineNumber === symbolsLineNumber) {
            this._lenses[codeLensIndex].updateCodeLensSymbols(groups[groupsIndex], helper);
            groupsIndex++;
            codeLensIndex++;
          } else {
            this._lenses.splice(codeLensIndex, 0, new CodeLensWidget(groups[groupsIndex], this._editor, helper, viewZoneAccessor, layoutInfo.codeLensHeight, () => this._resolveCodeLensesInViewportSoon()));
            codeLensIndex++;
            groupsIndex++;
          }
        }
        while (codeLensIndex < this._lenses.length) {
          this._lenses[codeLensIndex].dispose(helper, viewZoneAccessor);
          this._lenses.splice(codeLensIndex, 1);
        }
        while (groupsIndex < groups.length) {
          this._lenses.push(new CodeLensWidget(groups[groupsIndex], this._editor, helper, viewZoneAccessor, layoutInfo.codeLensHeight, () => this._resolveCodeLensesInViewportSoon()));
          groupsIndex++;
        }
        helper.commit(decorationsAccessor);
      });
    });
    scrollState.restore(this._editor);
  }
  _resolveCodeLensesInViewportSoon() {
    const model = this._editor.getModel();
    if (model) {
      this._resolveCodeLensesScheduler.schedule();
    }
  }
  _resolveCodeLensesInViewport() {
    this._resolveCodeLensesPromise?.cancel();
    this._resolveCodeLensesPromise = void 0;
    const model = this._editor.getModel();
    if (!model) {
      return;
    }
    const toResolve = [];
    const lenses = [];
    this._lenses.forEach((lens) => {
      const request = lens.computeIfNecessary(model);
      if (request) {
        toResolve.push(request);
        lenses.push(lens);
      }
    });
    if (toResolve.length === 0) {
      return;
    }
    const t1 = Date.now();
    const resolvePromise = createCancelablePromise((token) => {
      const promises = toResolve.map((request, i) => {
        const resolvedSymbols = new Array(request.length);
        const promises2 = request.map((request2, i2) => {
          if (!request2.symbol.command && typeof request2.provider.resolveCodeLens === "function") {
            return Promise.resolve(request2.provider.resolveCodeLens(model, request2.symbol, token)).then((symbol) => {
              resolvedSymbols[i2] = symbol;
            }, onUnexpectedExternalError);
          } else {
            resolvedSymbols[i2] = request2.symbol;
            return Promise.resolve(void 0);
          }
        });
        return Promise.all(promises2).then(() => {
          if (!token.isCancellationRequested && !lenses[i].isDisposed()) {
            lenses[i].updateCommands(resolvedSymbols);
          }
        });
      });
      return Promise.all(promises);
    });
    this._resolveCodeLensesPromise = resolvePromise;
    this._resolveCodeLensesPromise.then(() => {
      const newDelay = this._resolveCodeLensesDebounce.update(model, Date.now() - t1);
      this._resolveCodeLensesScheduler.delay = newDelay;
      if (this._currentCodeLensModel) {
        this._codeLensCache.put(model, this._currentCodeLensModel);
      }
      this._oldCodeLensModels.clear();
      if (resolvePromise === this._resolveCodeLensesPromise) {
        this._resolveCodeLensesPromise = void 0;
      }
    }, (err) => {
      onUnexpectedError(err);
      if (resolvePromise === this._resolveCodeLensesPromise) {
        this._resolveCodeLensesPromise = void 0;
      }
    });
  }
  async getModel() {
    await this._getCodeLensModelPromise;
    await this._resolveCodeLensesPromise;
    return !this._currentCodeLensModel?.isDisposed ? this._currentCodeLensModel : void 0;
  }
};
CodeLensContribution.ID = "css.editor.codeLens";
CodeLensContribution = __decorateClass([
  __decorateParam(1, ILanguageFeaturesService),
  __decorateParam(2, ILanguageFeatureDebounceService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, ICodeLensCache)
], CodeLensContribution);
registerEditorContribution(CodeLensContribution.ID, CodeLensContribution, EditorContributionInstantiation.AfterFirstRender);
registerEditorAction(class ShowLensesInCurrentLine extends EditorAction {
  constructor() {
    super({
      id: "codelens.showLensesInCurrentLine",
      precondition: EditorContextKeys.hasCodeLensProvider,
      label: localize2("showLensOnLine", "Show CodeLens Commands for Current Line")
    });
  }
  async run(accessor, editor) {
    if (!editor.hasModel()) {
      return;
    }
    const quickInputService = accessor.get(IQuickInputService);
    const commandService = accessor.get(ICommandService);
    const notificationService = accessor.get(INotificationService);
    const lineNumber = editor.getSelection().positionLineNumber;
    const codelensController = editor.getContribution(CodeLensContribution.ID);
    if (!codelensController) {
      return;
    }
    const model = await codelensController.getModel();
    if (!model) {
      return;
    }
    const items = [];
    for (const lens of model.lenses) {
      if (lens.symbol.command && lens.symbol.range.startLineNumber === lineNumber) {
        items.push({
          label: lens.symbol.command.title,
          command: lens.symbol.command
        });
      }
    }
    if (items.length === 0) {
      return;
    }
    const item = await quickInputService.pick(items, {
      canPickMany: false,
      placeHolder: localize("placeHolder", "Select a command")
    });
    if (!item) {
      return;
    }
    let command = item.command;
    if (model.isDisposed) {
      const newModel = await codelensController.getModel();
      const newLens = newModel?.lenses.find((lens) => lens.symbol.range.startLineNumber === lineNumber && lens.symbol.command?.title === command.title);
      if (!newLens || !newLens.symbol.command) {
        return;
      }
      command = newLens.symbol.command;
    }
    try {
      await commandService.executeCommand(command.id, ...command.arguments || []);
    } catch (err) {
      notificationService.error(err);
    }
  }
});
export {
  CodeLensContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9jb2RlbGVucy9icm93c2VyL2NvZGVsZW5zQ29udHJvbGxlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblxuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlLCBkaXNwb3NhYmxlVGltZW91dCwgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yLCBvblVuZXhwZWN0ZWRFeHRlcm5hbEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFN0YWJsZUVkaXRvclNjcm9sbFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9zdGFibGVFZGl0b3JTY3JvbGwuanMnO1xuaW1wb3J0IHsgSUFjdGl2ZUNvZGVFZGl0b3IsIElDb2RlRWRpdG9yLCBJVmlld1pvbmVDaGFuZ2VBY2Nlc3NvciwgTW91c2VUYXJnZXRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGlvbiwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbiwgcmVnaXN0ZXJFZGl0b3JBY3Rpb24sIHJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiwgRURJVE9SX0ZPTlRfREVGQVVMVFMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBDb2RlTGVucywgQ29tbWFuZCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgQ29kZUxlbnNJdGVtLCBDb2RlTGVuc01vZGVsLCBnZXRDb2RlTGVuc01vZGVsIH0gZnJvbSAnLi9jb2RlbGVucy5qcyc7XG5pbXBvcnQgeyBJQ29kZUxlbnNDYWNoZSB9IGZyb20gJy4vY29kZUxlbnNDYWNoZS5qcyc7XG5pbXBvcnQgeyBDb2RlTGVuc0hlbHBlciwgQ29kZUxlbnNXaWRnZXQgfSBmcm9tICcuL2NvZGVsZW5zV2lkZ2V0LmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRmVhdHVyZURlYm91bmNlSW5mb3JtYXRpb24sIElMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgQ29kZUxlbnNDb250cmlidXRpb24gaW1wbGVtZW50cyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQ6IHN0cmluZyA9ICdjc3MuZWRpdG9yLmNvZGVMZW5zJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbG9jYWxUb0Rpc3Bvc2UgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbGVuc2VzOiBDb2RlTGVuc1dpZGdldFtdID0gW107XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZUNvZGVMZW5zRGVib3VuY2U6IElGZWF0dXJlRGVib3VuY2VJbmZvcm1hdGlvbjtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVzb2x2ZUNvZGVMZW5zZXNEZWJvdW5jZTogSUZlYXR1cmVEZWJvdW5jZUluZm9ybWF0aW9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXNvbHZlQ29kZUxlbnNlc1NjaGVkdWxlcjogUnVuT25jZVNjaGVkdWxlcjtcblxuXHRwcml2YXRlIF9nZXRDb2RlTGVuc01vZGVsUHJvbWlzZTogQ2FuY2VsYWJsZVByb21pc2U8Q29kZUxlbnNNb2RlbD4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29sZENvZGVMZW5zTW9kZWxzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIF9jdXJyZW50Q29kZUxlbnNNb2RlbDogQ29kZUxlbnNNb2RlbCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfcmVzb2x2ZUNvZGVMZW5zZXNQcm9taXNlOiBDYW5jZWxhYmxlUHJvbWlzZTxhbnk+IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlIGRlYm91bmNlU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29kZUxlbnNDYWNoZSBwcml2YXRlIHJlYWRvbmx5IF9jb2RlTGVuc0NhY2hlOiBJQ29kZUxlbnNDYWNoZVxuXHQpIHtcblx0XHR0aGlzLl9wcm92aWRlQ29kZUxlbnNEZWJvdW5jZSA9IGRlYm91bmNlU2VydmljZS5mb3IoX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvZGVMZW5zUHJvdmlkZXIsICdDb2RlTGVuc1Byb3ZpZGUnLCB7IG1pbjogMjUwIH0pO1xuXHRcdHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzRGVib3VuY2UgPSBkZWJvdW5jZVNlcnZpY2UuZm9yKF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb2RlTGVuc1Byb3ZpZGVyLCAnQ29kZUxlbnNSZXNvbHZlJywgeyBtaW46IDI1MCwgc2FsdDogJ3Jlc29sdmUnIH0pO1xuXHRcdHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzU2NoZWR1bGVyID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5fcmVzb2x2ZUNvZGVMZW5zZXNJblZpZXdwb3J0KCksIHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzRGVib3VuY2UuZGVmYXVsdCgpKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCgoKSA9PiB0aGlzLl9vbk1vZGVsQ2hhbmdlKCkpKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxMYW5ndWFnZSgoKSA9PiB0aGlzLl9vbk1vZGVsQ2hhbmdlKCkpKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZSkgPT4ge1xuXHRcdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uZm9udEluZm8pIHx8IGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uY29kZUxlbnNGb250U2l6ZSkgfHwgZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5jb2RlTGVuc0ZvbnRGYW1pbHkpKSB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUxlbnNTdHlsZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uY29kZUxlbnMpKSB7XG5cdFx0XHRcdHRoaXMuX29uTW9kZWxDaGFuZ2UoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb2RlTGVuc1Byb3ZpZGVyLm9uRGlkQ2hhbmdlKHRoaXMuX29uTW9kZWxDaGFuZ2UsIHRoaXMpKTtcblx0XHR0aGlzLl9vbk1vZGVsQ2hhbmdlKCk7XG5cblx0XHR0aGlzLl91cGRhdGVMZW5zU3R5bGUoKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fbG9jYWxEaXNwb3NlKCk7XG5cdFx0dGhpcy5fbG9jYWxUb0Rpc3Bvc2UuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9vbGRDb2RlTGVuc01vZGVscy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY3VycmVudENvZGVMZW5zTW9kZWw/LmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldExheW91dEluZm8oKSB7XG5cdFx0Y29uc3QgbGluZUhlaWdodEZhY3RvciA9IE1hdGgubWF4KDEuMywgdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCkgLyB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250U2l6ZSkpO1xuXHRcdGxldCBmb250U2l6ZSA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmNvZGVMZW5zRm9udFNpemUpO1xuXHRcdGlmICghZm9udFNpemUgfHwgZm9udFNpemUgPCA1KSB7XG5cdFx0XHRmb250U2l6ZSA9ICh0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250U2l6ZSkgKiAuOSkgfCAwO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0Zm9udFNpemUsXG5cdFx0XHRjb2RlTGVuc0hlaWdodDogKGZvbnRTaXplICogbGluZUhlaWdodEZhY3RvcikgfCAwLFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVMZW5zU3R5bGUoKTogdm9pZCB7XG5cblx0XHRjb25zdCB7IGNvZGVMZW5zSGVpZ2h0LCBmb250U2l6ZSB9ID0gdGhpcy5fZ2V0TGF5b3V0SW5mbygpO1xuXHRcdGNvbnN0IGZvbnRGYW1pbHkgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5jb2RlTGVuc0ZvbnRGYW1pbHkpO1xuXHRcdGNvbnN0IGVkaXRvckZvbnRJbmZvID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZm9udEluZm8pO1xuXG5cdFx0Y29uc3QgeyBzdHlsZSB9ID0gdGhpcy5fZWRpdG9yLmdldENvbnRhaW5lckRvbU5vZGUoKTtcblxuXHRcdHN0eWxlLnNldFByb3BlcnR5KCctLXZzY29kZS1lZGl0b3JDb2RlTGVucy1saW5lSGVpZ2h0JywgYCR7Y29kZUxlbnNIZWlnaHR9cHhgKTtcblx0XHRzdHlsZS5zZXRQcm9wZXJ0eSgnLS12c2NvZGUtZWRpdG9yQ29kZUxlbnMtZm9udFNpemUnLCBgJHtmb250U2l6ZX1weGApO1xuXHRcdHN0eWxlLnNldFByb3BlcnR5KCctLXZzY29kZS1lZGl0b3JDb2RlTGVucy1mb250RmVhdHVyZVNldHRpbmdzJywgZWRpdG9yRm9udEluZm8uZm9udEZlYXR1cmVTZXR0aW5ncyk7XG5cblx0XHRpZiAoZm9udEZhbWlseSkge1xuXHRcdFx0c3R5bGUuc2V0UHJvcGVydHkoJy0tdnNjb2RlLWVkaXRvckNvZGVMZW5zLWZvbnRGYW1pbHknLCBmb250RmFtaWx5KTtcblx0XHRcdHN0eWxlLnNldFByb3BlcnR5KCctLXZzY29kZS1lZGl0b3JDb2RlTGVucy1mb250RmFtaWx5RGVmYXVsdCcsIEVESVRPUl9GT05UX0RFRkFVTFRTLmZvbnRGYW1pbHkpO1xuXHRcdH1cblxuXHRcdC8vXG5cdFx0dGhpcy5fZWRpdG9yLmNoYW5nZVZpZXdab25lcyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGxlbnMgb2YgdGhpcy5fbGVuc2VzKSB7XG5cdFx0XHRcdGxlbnMudXBkYXRlSGVpZ2h0KGNvZGVMZW5zSGVpZ2h0LCBhY2Nlc3Nvcik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9sb2NhbERpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZ2V0Q29kZUxlbnNNb2RlbFByb21pc2U/LmNhbmNlbCgpO1xuXHRcdHRoaXMuX2dldENvZGVMZW5zTW9kZWxQcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzUHJvbWlzZT8uY2FuY2VsKCk7XG5cdFx0dGhpcy5fcmVzb2x2ZUNvZGVMZW5zZXNQcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2xvY2FsVG9EaXNwb3NlLmNsZWFyKCk7XG5cdFx0dGhpcy5fb2xkQ29kZUxlbnNNb2RlbHMuY2xlYXIoKTtcblx0XHR0aGlzLl9jdXJyZW50Q29kZUxlbnNNb2RlbD8uZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25Nb2RlbENoYW5nZSgpOiB2b2lkIHtcblxuXHRcdHRoaXMuX2xvY2FsRGlzcG9zZSgpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5jb2RlTGVucykgfHwgbW9kZWwuaXNUb29MYXJnZUZvclRva2VuaXphdGlvbigpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2FjaGVkTGVuc2VzID0gdGhpcy5fY29kZUxlbnNDYWNoZS5nZXQobW9kZWwpO1xuXHRcdGlmIChjYWNoZWRMZW5zZXMpIHtcblx0XHRcdHRoaXMuX3JlbmRlckNvZGVMZW5zU3ltYm9scyhjYWNoZWRMZW5zZXMpO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29kZUxlbnNQcm92aWRlci5oYXMobW9kZWwpKSB7XG5cdFx0XHQvLyBubyBwcm92aWRlciAtPiByZXR1cm4gYnV0IGNoZWNrIHdpdGhcblx0XHRcdC8vIGNhY2hlZCBsZW5zZXMuIHRoZXkgZXhwaXJlIGFmdGVyIDMwIHNlY29uZHNcblx0XHRcdGlmIChjYWNoZWRMZW5zZXMpIHtcblx0XHRcdFx0ZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGNhY2hlZExlbnNlc05vdyA9IHRoaXMuX2NvZGVMZW5zQ2FjaGUuZ2V0KG1vZGVsKTtcblx0XHRcdFx0XHRpZiAoY2FjaGVkTGVuc2VzID09PSBjYWNoZWRMZW5zZXNOb3cpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2NvZGVMZW5zQ2FjaGUuZGVsZXRlKG1vZGVsKTtcblx0XHRcdFx0XHRcdHRoaXMuX29uTW9kZWxDaGFuZ2UoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIDMwICogMTAwMCwgdGhpcy5fbG9jYWxUb0Rpc3Bvc2UpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgcHJvdmlkZXIgb2YgdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29kZUxlbnNQcm92aWRlci5hbGwobW9kZWwpKSB7XG5cdFx0XHRpZiAodHlwZW9mIHByb3ZpZGVyLm9uRGlkQ2hhbmdlID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdGNvbnN0IHJlZ2lzdHJhdGlvbiA9IHByb3ZpZGVyLm9uRGlkQ2hhbmdlKCgpID0+IHNjaGVkdWxlci5zY2hlZHVsZSgpKTtcblx0XHRcdFx0dGhpcy5fbG9jYWxUb0Rpc3Bvc2UuYWRkKHJlZ2lzdHJhdGlvbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2NoZWR1bGVyID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4ge1xuXHRcdFx0Y29uc3QgdDEgPSBEYXRlLm5vdygpO1xuXG5cdFx0XHR0aGlzLl9nZXRDb2RlTGVuc01vZGVsUHJvbWlzZT8uY2FuY2VsKCk7XG5cdFx0XHR0aGlzLl9nZXRDb2RlTGVuc01vZGVsUHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IGdldENvZGVMZW5zTW9kZWwodGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29kZUxlbnNQcm92aWRlciwgbW9kZWwsIHRva2VuKSk7XG5cblx0XHRcdHRoaXMuX2dldENvZGVMZW5zTW9kZWxQcm9taXNlLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX2N1cnJlbnRDb2RlTGVuc01vZGVsKSB7XG5cdFx0XHRcdFx0dGhpcy5fb2xkQ29kZUxlbnNNb2RlbHMuYWRkKHRoaXMuX2N1cnJlbnRDb2RlTGVuc01vZGVsKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9jdXJyZW50Q29kZUxlbnNNb2RlbCA9IHJlc3VsdDtcblxuXHRcdFx0XHQvLyBjYWNoZSBtb2RlbCB0byByZWR1Y2UgZmxpY2tlclxuXHRcdFx0XHR0aGlzLl9jb2RlTGVuc0NhY2hlLnB1dChtb2RlbCwgcmVzdWx0KTtcblxuXHRcdFx0XHQvLyB1cGRhdGUgbW92aW5nIGF2ZXJhZ2Vcblx0XHRcdFx0Y29uc3QgbmV3RGVsYXkgPSB0aGlzLl9wcm92aWRlQ29kZUxlbnNEZWJvdW5jZS51cGRhdGUobW9kZWwsIERhdGUubm93KCkgLSB0MSk7XG5cdFx0XHRcdHNjaGVkdWxlci5kZWxheSA9IG5ld0RlbGF5O1xuXG5cdFx0XHRcdC8vIHJlbmRlciBsZW5zZXNcblx0XHRcdFx0dGhpcy5fcmVuZGVyQ29kZUxlbnNTeW1ib2xzKHJlc3VsdCk7XG5cdFx0XHRcdC8vIGRvbS5zY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKCgpID0+IHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzSW5WaWV3cG9ydCgpKTtcblx0XHRcdFx0dGhpcy5fcmVzb2x2ZUNvZGVMZW5zZXNJblZpZXdwb3J0U29vbigpO1xuXHRcdFx0fSwgb25VbmV4cGVjdGVkRXJyb3IpO1xuXG5cdFx0fSwgdGhpcy5fcHJvdmlkZUNvZGVMZW5zRGVib3VuY2UuZ2V0KG1vZGVsKSk7XG5cblx0XHR0aGlzLl9sb2NhbFRvRGlzcG9zZS5hZGQoc2NoZWR1bGVyKTtcblx0XHR0aGlzLl9sb2NhbFRvRGlzcG9zZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzU2NoZWR1bGVyLmNhbmNlbCgpKSk7XG5cdFx0dGhpcy5fbG9jYWxUb0Rpc3Bvc2UuYWRkKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9lZGl0b3IuY2hhbmdlRGVjb3JhdGlvbnMoZGVjb3JhdGlvbnNBY2Nlc3NvciA9PiB7XG5cdFx0XHRcdHRoaXMuX2VkaXRvci5jaGFuZ2VWaWV3Wm9uZXModmlld1pvbmVzQWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHRvRGlzcG9zZTogQ29kZUxlbnNXaWRnZXRbXSA9IFtdO1xuXHRcdFx0XHRcdGxldCBsYXN0TGVuc0xpbmVOdW1iZXI6IG51bWJlciA9IC0xO1xuXG5cdFx0XHRcdFx0dGhpcy5fbGVuc2VzLmZvckVhY2goKGxlbnMpID0+IHtcblx0XHRcdFx0XHRcdGlmICghbGVucy5pc1ZhbGlkKCkgfHwgbGFzdExlbnNMaW5lTnVtYmVyID09PSBsZW5zLmdldExpbmVOdW1iZXIoKSkge1xuXHRcdFx0XHRcdFx0XHQvLyBpbnZhbGlkIC0+IGxlbnMgY29sbGFwc2VkLCBhdHRhY2ggcmFuZ2UgZG9lc24ndCBleGlzdCBhbnltb3JlXG5cdFx0XHRcdFx0XHRcdC8vIGxpbmVfbnVtYmVyIC0+IGxlbnNlcyBzaG91bGQgbmV2ZXIgYmUgb24gdGhlIHNhbWUgbGluZVxuXHRcdFx0XHRcdFx0XHR0b0Rpc3Bvc2UucHVzaChsZW5zKTtcblxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0bGVucy51cGRhdGUodmlld1pvbmVzQWNjZXNzb3IpO1xuXHRcdFx0XHRcdFx0XHRsYXN0TGVuc0xpbmVOdW1iZXIgPSBsZW5zLmdldExpbmVOdW1iZXIoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGNvbnN0IGhlbHBlciA9IG5ldyBDb2RlTGVuc0hlbHBlcigpO1xuXHRcdFx0XHRcdHRvRGlzcG9zZS5mb3JFYWNoKChsKSA9PiB7XG5cdFx0XHRcdFx0XHRsLmRpc3Bvc2UoaGVscGVyLCB2aWV3Wm9uZXNBY2Nlc3Nvcik7XG5cdFx0XHRcdFx0XHR0aGlzLl9sZW5zZXMuc3BsaWNlKHRoaXMuX2xlbnNlcy5pbmRleE9mKGwpLCAxKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRoZWxwZXIuY29tbWl0KGRlY29yYXRpb25zQWNjZXNzb3IpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHQvLyBBc2sgZm9yIGFsbCByZWZlcmVuY2VzIGFnYWluXG5cdFx0XHRzY2hlZHVsZXIuc2NoZWR1bGUoKTtcblxuXHRcdFx0Ly8gQ2FuY2VsIHBlbmRpbmcgYW5kIGFjdGl2ZSByZXNvbHZlIHJlcXVlc3RzXG5cdFx0XHR0aGlzLl9yZXNvbHZlQ29kZUxlbnNlc1NjaGVkdWxlci5jYW5jZWwoKTtcblx0XHRcdHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzUHJvbWlzZT8uY2FuY2VsKCk7XG5cdFx0XHR0aGlzLl9yZXNvbHZlQ29kZUxlbnNlc1Byb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX2xvY2FsVG9EaXNwb3NlLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRGb2N1c0VkaXRvclRleHQoKCkgPT4ge1xuXHRcdFx0c2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX2xvY2FsVG9EaXNwb3NlLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRCbHVyRWRpdG9yVGV4dCgoKSA9PiB7XG5cdFx0XHRzY2hlZHVsZXIuY2FuY2VsKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX2xvY2FsVG9EaXNwb3NlLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRTY3JvbGxDaGFuZ2UoZSA9PiB7XG5cdFx0XHRpZiAoZS5zY3JvbGxUb3BDaGFuZ2VkICYmIHRoaXMuX2xlbnNlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzSW5WaWV3cG9ydFNvb24oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fbG9jYWxUb0Rpc3Bvc2UuYWRkKHRoaXMuX2VkaXRvci5vbkRpZExheW91dENoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9yZXNvbHZlQ29kZUxlbnNlc0luVmlld3BvcnRTb29uKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX2xvY2FsVG9EaXNwb3NlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpKSB7XG5cdFx0XHRcdGNvbnN0IHNjcm9sbFN0YXRlID0gU3RhYmxlRWRpdG9yU2Nyb2xsU3RhdGUuY2FwdHVyZSh0aGlzLl9lZGl0b3IpO1xuXHRcdFx0XHR0aGlzLl9lZGl0b3IuY2hhbmdlRGVjb3JhdGlvbnMoZGVjb3JhdGlvbnNBY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fZWRpdG9yLmNoYW5nZVZpZXdab25lcyh2aWV3Wm9uZXNBY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLl9kaXNwb3NlQWxsTGVuc2VzKGRlY29yYXRpb25zQWNjZXNzb3IsIHZpZXdab25lc0FjY2Vzc29yKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHNjcm9sbFN0YXRlLnJlc3RvcmUodGhpcy5fZWRpdG9yKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIE5vIGFjY2Vzc29ycyBhdmFpbGFibGVcblx0XHRcdFx0dGhpcy5fZGlzcG9zZUFsbExlbnNlcyh1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX2xvY2FsVG9EaXNwb3NlLmFkZCh0aGlzLl9lZGl0b3Iub25Nb3VzZURvd24oZSA9PiB7XG5cdFx0XHRpZiAoZS50YXJnZXQudHlwZSAhPT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfV0lER0VUKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGxldCB0YXJnZXQgPSBlLnRhcmdldC5lbGVtZW50O1xuXHRcdFx0aWYgKHRhcmdldD8udGFnTmFtZSA9PT0gJ1NQQU4nKSB7XG5cdFx0XHRcdHRhcmdldCA9IHRhcmdldC5wYXJlbnRFbGVtZW50O1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRhcmdldD8udGFnTmFtZSA9PT0gJ0EnKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgbGVucyBvZiB0aGlzLl9sZW5zZXMpIHtcblx0XHRcdFx0XHRjb25zdCBjb21tYW5kID0gbGVucy5nZXRDb21tYW5kKHRhcmdldCBhcyBIVE1MTGlua0VsZW1lbnQpO1xuXHRcdFx0XHRcdGlmIChjb21tYW5kKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChjb21tYW5kLmlkLCAuLi4oY29tbWFuZC5hcmd1bWVudHMgfHwgW10pKS5jYXRjaChlcnIgPT4gdGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnIpKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRzY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0fVxuXG5cdHByaXZhdGUgX2Rpc3Bvc2VBbGxMZW5zZXMoZGVjQ2hhbmdlQWNjZXNzb3I6IElNb2RlbERlY29yYXRpb25zQ2hhbmdlQWNjZXNzb3IgfCB1bmRlZmluZWQsIHZpZXdab25lQ2hhbmdlQWNjZXNzb3I6IElWaWV3Wm9uZUNoYW5nZUFjY2Vzc29yIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgaGVscGVyID0gbmV3IENvZGVMZW5zSGVscGVyKCk7XG5cdFx0Zm9yIChjb25zdCBsZW5zIG9mIHRoaXMuX2xlbnNlcykge1xuXHRcdFx0bGVucy5kaXNwb3NlKGhlbHBlciwgdmlld1pvbmVDaGFuZ2VBY2Nlc3Nvcik7XG5cdFx0fVxuXHRcdGlmIChkZWNDaGFuZ2VBY2Nlc3Nvcikge1xuXHRcdFx0aGVscGVyLmNvbW1pdChkZWNDaGFuZ2VBY2Nlc3Nvcik7XG5cdFx0fVxuXHRcdHRoaXMuX2xlbnNlcy5sZW5ndGggPSAwO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyQ29kZUxlbnNTeW1ib2xzKHN5bWJvbHM6IENvZGVMZW5zTW9kZWwpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWF4TGluZU51bWJlciA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpLmdldExpbmVDb3VudCgpO1xuXHRcdGNvbnN0IGdyb3VwczogQ29kZUxlbnNJdGVtW11bXSA9IFtdO1xuXHRcdGxldCBsYXN0R3JvdXA6IENvZGVMZW5zSXRlbVtdIHwgdW5kZWZpbmVkO1xuXG5cdFx0Zm9yIChjb25zdCBzeW1ib2wgb2Ygc3ltYm9scy5sZW5zZXMpIHtcblx0XHRcdGNvbnN0IGxpbmUgPSBzeW1ib2wuc3ltYm9sLnJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdGlmIChsaW5lIDwgMSB8fCBsaW5lID4gbWF4TGluZU51bWJlcikge1xuXHRcdFx0XHQvLyBpbnZhbGlkIGNvZGUgbGVuc1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH0gZWxzZSBpZiAobGFzdEdyb3VwICYmIGxhc3RHcm91cFtsYXN0R3JvdXAubGVuZ3RoIC0gMV0uc3ltYm9sLnJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gbGluZSkge1xuXHRcdFx0XHQvLyBvbiBzYW1lIGxpbmUgYXMgcHJldmlvdXNcblx0XHRcdFx0bGFzdEdyb3VwLnB1c2goc3ltYm9sKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIG9uIGxhdGVyIGxpbmUgYXMgcHJldmlvdXNcblx0XHRcdFx0bGFzdEdyb3VwID0gW3N5bWJvbF07XG5cdFx0XHRcdGdyb3Vwcy5wdXNoKGxhc3RHcm91cCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFncm91cHMubGVuZ3RoICYmICF0aGlzLl9sZW5zZXMubGVuZ3RoKSB7XG5cdFx0XHQvLyBOb3RoaW5nIHRvIGNoYW5nZVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNjcm9sbFN0YXRlID0gU3RhYmxlRWRpdG9yU2Nyb2xsU3RhdGUuY2FwdHVyZSh0aGlzLl9lZGl0b3IpO1xuXHRcdGNvbnN0IGxheW91dEluZm8gPSB0aGlzLl9nZXRMYXlvdXRJbmZvKCk7XG5cblx0XHR0aGlzLl9lZGl0b3IuY2hhbmdlRGVjb3JhdGlvbnMoZGVjb3JhdGlvbnNBY2Nlc3NvciA9PiB7XG5cdFx0XHR0aGlzLl9lZGl0b3IuY2hhbmdlVmlld1pvbmVzKHZpZXdab25lQWNjZXNzb3IgPT4ge1xuXG5cdFx0XHRcdGNvbnN0IGhlbHBlciA9IG5ldyBDb2RlTGVuc0hlbHBlcigpO1xuXHRcdFx0XHRsZXQgY29kZUxlbnNJbmRleCA9IDA7XG5cdFx0XHRcdGxldCBncm91cHNJbmRleCA9IDA7XG5cblx0XHRcdFx0d2hpbGUgKGdyb3Vwc0luZGV4IDwgZ3JvdXBzLmxlbmd0aCAmJiBjb2RlTGVuc0luZGV4IDwgdGhpcy5fbGVuc2VzLmxlbmd0aCkge1xuXG5cdFx0XHRcdFx0Y29uc3Qgc3ltYm9sc0xpbmVOdW1iZXIgPSBncm91cHNbZ3JvdXBzSW5kZXhdWzBdLnN5bWJvbC5yYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRcdFx0Y29uc3QgY29kZUxlbnNMaW5lTnVtYmVyID0gdGhpcy5fbGVuc2VzW2NvZGVMZW5zSW5kZXhdLmdldExpbmVOdW1iZXIoKTtcblxuXHRcdFx0XHRcdGlmIChjb2RlTGVuc0xpbmVOdW1iZXIgPCBzeW1ib2xzTGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0dGhpcy5fbGVuc2VzW2NvZGVMZW5zSW5kZXhdLmRpc3Bvc2UoaGVscGVyLCB2aWV3Wm9uZUFjY2Vzc29yKTtcblx0XHRcdFx0XHRcdHRoaXMuX2xlbnNlcy5zcGxpY2UoY29kZUxlbnNJbmRleCwgMSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChjb2RlTGVuc0xpbmVOdW1iZXIgPT09IHN5bWJvbHNMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9sZW5zZXNbY29kZUxlbnNJbmRleF0udXBkYXRlQ29kZUxlbnNTeW1ib2xzKGdyb3Vwc1tncm91cHNJbmRleF0sIGhlbHBlcik7XG5cdFx0XHRcdFx0XHRncm91cHNJbmRleCsrO1xuXHRcdFx0XHRcdFx0Y29kZUxlbnNJbmRleCsrO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9sZW5zZXMuc3BsaWNlKGNvZGVMZW5zSW5kZXgsIDAsIG5ldyBDb2RlTGVuc1dpZGdldChncm91cHNbZ3JvdXBzSW5kZXhdLCA8SUFjdGl2ZUNvZGVFZGl0b3I+dGhpcy5fZWRpdG9yLCBoZWxwZXIsIHZpZXdab25lQWNjZXNzb3IsIGxheW91dEluZm8uY29kZUxlbnNIZWlnaHQsICgpID0+IHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzSW5WaWV3cG9ydFNvb24oKSkpO1xuXHRcdFx0XHRcdFx0Y29kZUxlbnNJbmRleCsrO1xuXHRcdFx0XHRcdFx0Z3JvdXBzSW5kZXgrKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBEZWxldGUgZXh0cmEgY29kZSBsZW5zZXNcblx0XHRcdFx0d2hpbGUgKGNvZGVMZW5zSW5kZXggPCB0aGlzLl9sZW5zZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhpcy5fbGVuc2VzW2NvZGVMZW5zSW5kZXhdLmRpc3Bvc2UoaGVscGVyLCB2aWV3Wm9uZUFjY2Vzc29yKTtcblx0XHRcdFx0XHR0aGlzLl9sZW5zZXMuc3BsaWNlKGNvZGVMZW5zSW5kZXgsIDEpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gQ3JlYXRlIGV4dHJhIHN5bWJvbHNcblx0XHRcdFx0d2hpbGUgKGdyb3Vwc0luZGV4IDwgZ3JvdXBzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMuX2xlbnNlcy5wdXNoKG5ldyBDb2RlTGVuc1dpZGdldChncm91cHNbZ3JvdXBzSW5kZXhdLCA8SUFjdGl2ZUNvZGVFZGl0b3I+dGhpcy5fZWRpdG9yLCBoZWxwZXIsIHZpZXdab25lQWNjZXNzb3IsIGxheW91dEluZm8uY29kZUxlbnNIZWlnaHQsICgpID0+IHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzSW5WaWV3cG9ydFNvb24oKSkpO1xuXHRcdFx0XHRcdGdyb3Vwc0luZGV4Kys7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRoZWxwZXIuY29tbWl0KGRlY29yYXRpb25zQWNjZXNzb3IpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRzY3JvbGxTdGF0ZS5yZXN0b3JlKHRoaXMuX2VkaXRvcik7XG5cdH1cblxuXHRwcml2YXRlIF9yZXNvbHZlQ29kZUxlbnNlc0luVmlld3BvcnRTb29uKCk6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHR0aGlzLl9yZXNvbHZlQ29kZUxlbnNlc1NjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3Jlc29sdmVDb2RlTGVuc2VzSW5WaWV3cG9ydCgpOiB2b2lkIHtcblxuXHRcdHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzUHJvbWlzZT8uY2FuY2VsKCk7XG5cdFx0dGhpcy5fcmVzb2x2ZUNvZGVMZW5zZXNQcm9taXNlID0gdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9SZXNvbHZlOiBDb2RlTGVuc0l0ZW1bXVtdID0gW107XG5cdFx0Y29uc3QgbGVuc2VzOiBDb2RlTGVuc1dpZGdldFtdID0gW107XG5cdFx0dGhpcy5fbGVuc2VzLmZvckVhY2goKGxlbnMpID0+IHtcblx0XHRcdGNvbnN0IHJlcXVlc3QgPSBsZW5zLmNvbXB1dGVJZk5lY2Vzc2FyeShtb2RlbCk7XG5cdFx0XHRpZiAocmVxdWVzdCkge1xuXHRcdFx0XHR0b1Jlc29sdmUucHVzaChyZXF1ZXN0KTtcblx0XHRcdFx0bGVuc2VzLnB1c2gobGVucyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAodG9SZXNvbHZlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHQxID0gRGF0ZS5ub3coKTtcblxuXHRcdGNvbnN0IHJlc29sdmVQcm9taXNlID0gY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UodG9rZW4gPT4ge1xuXG5cdFx0XHRjb25zdCBwcm9taXNlcyA9IHRvUmVzb2x2ZS5tYXAoKHJlcXVlc3QsIGkpID0+IHtcblxuXHRcdFx0XHRjb25zdCByZXNvbHZlZFN5bWJvbHMgPSBuZXcgQXJyYXk8Q29kZUxlbnMgfCB1bmRlZmluZWQgfCBudWxsPihyZXF1ZXN0Lmxlbmd0aCk7XG5cdFx0XHRcdGNvbnN0IHByb21pc2VzID0gcmVxdWVzdC5tYXAoKHJlcXVlc3QsIGkpID0+IHtcblx0XHRcdFx0XHRpZiAoIXJlcXVlc3Quc3ltYm9sLmNvbW1hbmQgJiYgdHlwZW9mIHJlcXVlc3QucHJvdmlkZXIucmVzb2x2ZUNvZGVMZW5zID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcXVlc3QucHJvdmlkZXIucmVzb2x2ZUNvZGVMZW5zKG1vZGVsLCByZXF1ZXN0LnN5bWJvbCwgdG9rZW4pKS50aGVuKHN5bWJvbCA9PiB7XG5cdFx0XHRcdFx0XHRcdHJlc29sdmVkU3ltYm9sc1tpXSA9IHN5bWJvbDtcblx0XHRcdFx0XHRcdH0sIG9uVW5leHBlY3RlZEV4dGVybmFsRXJyb3IpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlZFN5bWJvbHNbaV0gPSByZXF1ZXN0LnN5bWJvbDtcblx0XHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKCF0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCAmJiAhbGVuc2VzW2ldLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRcdFx0bGVuc2VzW2ldLnVwZGF0ZUNvbW1hbmRzKHJlc29sdmVkU3ltYm9scyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXHRcdH0pO1xuXHRcdHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzUHJvbWlzZSA9IHJlc29sdmVQcm9taXNlO1xuXG5cdFx0dGhpcy5fcmVzb2x2ZUNvZGVMZW5zZXNQcm9taXNlLnRoZW4oKCkgPT4ge1xuXG5cdFx0XHQvLyB1cGRhdGUgbW92aW5nIGF2ZXJhZ2Vcblx0XHRcdGNvbnN0IG5ld0RlbGF5ID0gdGhpcy5fcmVzb2x2ZUNvZGVMZW5zZXNEZWJvdW5jZS51cGRhdGUobW9kZWwsIERhdGUubm93KCkgLSB0MSk7XG5cdFx0XHR0aGlzLl9yZXNvbHZlQ29kZUxlbnNlc1NjaGVkdWxlci5kZWxheSA9IG5ld0RlbGF5O1xuXG5cdFx0XHRpZiAodGhpcy5fY3VycmVudENvZGVMZW5zTW9kZWwpIHsgLy8gdXBkYXRlIHRoZSBjYWNoZWQgc3RhdGUgd2l0aCBuZXcgcmVzb2x2ZWQgaXRlbXNcblx0XHRcdFx0dGhpcy5fY29kZUxlbnNDYWNoZS5wdXQobW9kZWwsIHRoaXMuX2N1cnJlbnRDb2RlTGVuc01vZGVsKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX29sZENvZGVMZW5zTW9kZWxzLmNsZWFyKCk7IC8vIGRpc3Bvc2Ugb2xkIG1vZGVscyBvbmNlIHdlIGhhdmUgdXBkYXRlZCB0aGUgVUkgd2l0aCB0aGUgY3VycmVudCBtb2RlbFxuXHRcdFx0aWYgKHJlc29sdmVQcm9taXNlID09PSB0aGlzLl9yZXNvbHZlQ29kZUxlbnNlc1Byb21pc2UpIHtcblx0XHRcdFx0dGhpcy5fcmVzb2x2ZUNvZGVMZW5zZXNQcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0sIGVyciA9PiB7XG5cdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnIpOyAvLyBjYW4gYWxzbyBiZSBjYW5jZWxsYXRpb24hXG5cdFx0XHRpZiAocmVzb2x2ZVByb21pc2UgPT09IHRoaXMuX3Jlc29sdmVDb2RlTGVuc2VzUHJvbWlzZSkge1xuXHRcdFx0XHR0aGlzLl9yZXNvbHZlQ29kZUxlbnNlc1Byb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBnZXRNb2RlbCgpOiBQcm9taXNlPENvZGVMZW5zTW9kZWwgfCB1bmRlZmluZWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9nZXRDb2RlTGVuc01vZGVsUHJvbWlzZTtcblx0XHRhd2FpdCB0aGlzLl9yZXNvbHZlQ29kZUxlbnNlc1Byb21pc2U7XG5cdFx0cmV0dXJuICF0aGlzLl9jdXJyZW50Q29kZUxlbnNNb2RlbD8uaXNEaXNwb3NlZFxuXHRcdFx0PyB0aGlzLl9jdXJyZW50Q29kZUxlbnNNb2RlbFxuXHRcdFx0OiB1bmRlZmluZWQ7XG5cdH1cbn1cblxucmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24oQ29kZUxlbnNDb250cmlidXRpb24uSUQsIENvZGVMZW5zQ29udHJpYnV0aW9uLCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLkFmdGVyRmlyc3RSZW5kZXIpO1xuXG5yZWdpc3RlckVkaXRvckFjdGlvbihjbGFzcyBTaG93TGVuc2VzSW5DdXJyZW50TGluZSBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdjb2RlbGVucy5zaG93TGVuc2VzSW5DdXJyZW50TGluZScsXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLmhhc0NvZGVMZW5zUHJvdmlkZXIsXG5cdFx0XHRsYWJlbDogbG9jYWxpemUyKCdzaG93TGVuc09uTGluZScsIFwiU2hvdyBDb2RlTGVucyBDb21tYW5kcyBmb3IgQ3VycmVudCBMaW5lXCIpLFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgbGluZU51bWJlciA9IGVkaXRvci5nZXRTZWxlY3Rpb24oKS5wb3NpdGlvbkxpbmVOdW1iZXI7XG5cdFx0Y29uc3QgY29kZWxlbnNDb250cm9sbGVyID0gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxDb2RlTGVuc0NvbnRyaWJ1dGlvbj4oQ29kZUxlbnNDb250cmlidXRpb24uSUQpO1xuXHRcdGlmICghY29kZWxlbnNDb250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBjb2RlbGVuc0NvbnRyb2xsZXIuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHQvLyBub3RoaW5nXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXRlbXM6IHsgbGFiZWw6IHN0cmluZzsgY29tbWFuZDogQ29tbWFuZCB9W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGxlbnMgb2YgbW9kZWwubGVuc2VzKSB7XG5cdFx0XHRpZiAobGVucy5zeW1ib2wuY29tbWFuZCAmJiBsZW5zLnN5bWJvbC5yYW5nZS5zdGFydExpbmVOdW1iZXIgPT09IGxpbmVOdW1iZXIpIHtcblx0XHRcdFx0aXRlbXMucHVzaCh7XG5cdFx0XHRcdFx0bGFiZWw6IGxlbnMuc3ltYm9sLmNvbW1hbmQudGl0bGUsXG5cdFx0XHRcdFx0Y29tbWFuZDogbGVucy5zeW1ib2wuY29tbWFuZFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaXRlbXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHQvLyBXZSBkb250IHdhbnQgYW4gZW1wdHkgcGlja2VyXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXRlbSA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soaXRlbXMsIHtcblx0XHRcdGNhblBpY2tNYW55OiBmYWxzZSxcblx0XHRcdHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgncGxhY2VIb2xkZXInLCBcIlNlbGVjdCBhIGNvbW1hbmRcIilcblx0XHR9KTtcblx0XHRpZiAoIWl0ZW0pIHtcblx0XHRcdC8vIE5vdGhpbmcgcGlja2VkXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGNvbW1hbmQgPSBpdGVtLmNvbW1hbmQ7XG5cblx0XHRpZiAobW9kZWwuaXNEaXNwb3NlZCkge1xuXHRcdFx0Ly8gdHJ5IHRvIGZpbmQgdGhlIHNhbWUgY29tbWFuZCBhZ2FpbiBpbi1jYXNlIHRoZSBtb2RlbCBoYXMgYmVlbiByZS1jcmVhdGVkIGluIHRoZSBtZWFudGltZVxuXHRcdFx0Ly8gdGhpcyBpcyBhIGJlc3QgYXR0ZW1wdCBhcHByb2FjaCB3aGljaCBzaG91bGRuJ3QgYmUgbmVlZGVkIGJlY2F1c2UgZWFnZXIgbW9kZWwgcmUtY3JlYXRlc1xuXHRcdFx0Ly8gc2hvdWxkbid0IGhhcHBlbiBkdWUgdG8gZm9jdXMgaW4vb3V0IGFueW1vcmVcblx0XHRcdGNvbnN0IG5ld01vZGVsID0gYXdhaXQgY29kZWxlbnNDb250cm9sbGVyLmdldE1vZGVsKCk7XG5cdFx0XHRjb25zdCBuZXdMZW5zID0gbmV3TW9kZWw/LmxlbnNlcy5maW5kKGxlbnMgPT4gbGVucy5zeW1ib2wucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID09PSBsaW5lTnVtYmVyICYmIGxlbnMuc3ltYm9sLmNvbW1hbmQ/LnRpdGxlID09PSBjb21tYW5kLnRpdGxlKTtcblx0XHRcdGlmICghbmV3TGVucyB8fCAhbmV3TGVucy5zeW1ib2wuY29tbWFuZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb21tYW5kID0gbmV3TGVucy5zeW1ib2wuY29tbWFuZDtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZC5pZCwgLi4uKGNvbW1hbmQuYXJndW1lbnRzIHx8IFtdKSk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0fVxuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBNEIseUJBQXlCLG1CQUFtQix3QkFBd0I7QUFDaEcsU0FBUyxtQkFBbUIsaUNBQWlDO0FBQzdELFNBQVMsaUJBQWlCLG9CQUFvQjtBQUM5QyxTQUFTLCtCQUErQjtBQUN4QyxTQUFrRSx1QkFBdUI7QUFDekYsU0FBUyxjQUFjLGlDQUFpQyxzQkFBc0Isa0NBQW9EO0FBQ2xJLFNBQVMsY0FBYyw0QkFBNEI7QUFFbkQsU0FBUyx5QkFBeUI7QUFHbEMsU0FBc0Msd0JBQXdCO0FBQzlELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQWdCLHNCQUFzQjtBQUMvQyxTQUFTLFVB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QixTQUFTLElBQUksa0JBQWtCO0FBQ3pELFVBQU0saUJBQWlCLFNBQVMsSUFBSSxlQUFlO0FBQ25ELFVBQU0sc0JBQXNCLFNBQVMsSUFBSSxvQkFBb0I7QUFFN0QsVUFBTSxhQUFhLE9BQU8sYUFBYSxFQUFFO0FBQ3pDLFVBQU0scUJBQXFCLE9BQU8sZ0JBQXNDLHFCQUFxQixFQUFFO0FBQy9GLFFBQUksQ0FBQyxvQkFBb0I7QUFDeEI7QUFBQSxJQUNEO0FBRUEsVUFBTSxRQUFRLE1BQU0sbUJBQW1CLFNBQVM7QUFDaEQsUUFBSSxDQUFDLE9BQU87QUFFWDtBQUFBLElBQ0Q7QUFFQSxVQUFNLFFBQStDLENBQUM7QUFDdEQsZUFBVyxRQUFRLE1BQU0sUUFBUTtBQUNoQyxVQUFJLEtBQUssT0FBTyxXQUFXLEtBQUssT0FBTyxNQUFNLG9CQUFvQixZQUFZO0FBQzVFLGNBQU0sS0FBSztBQUFBLFVBQ1YsT0FBTyxLQUFLLE9BQU8sUUFBUTtBQUFBLFVBQzNCLFNBQVMsS0FBSyxPQUFPO0FBQUEsUUFDdEIsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNEO0FBRUEsUUFBSSxNQUFNLFdBQVcsR0FBRztBQUV2QjtBQUFBLElBQ0Q7QUFFQSxVQUFNLE9BQU8sTUFBTSxrQkFBa0IsS0FBSyxPQUFPO0FBQUEsTUFDaEQsYUFBYTtBQUFBLE1BQ2IsYUFBYSxTQUFTLGVBQWUsa0JBQWtCO0FBQUEsSUFDeEQsQ0FBQztBQUNELFFBQUksQ0FBQyxNQUFNO0FBRVY7QUFBQSxJQUNEO0FBRUEsUUFBSSxVQUFVLEtBQUs7QUFFbkIsUUFBSSxNQUFNLFlBQVk7QUFJckIsWUFBTSxXQUFXLE1BQU0sbUJBQW1CLFNBQVM7QUFDbkQsWUFBTSxVQUFVLFVBQVUsT0FBTyxLQUFLLFVBQVEsS0FBSyxPQUFPLE1BQU0sb0JBQW9CLGNBQWMsS0FBSyxPQUFPLFNBQVMsVUFBVSxRQUFRLEtBQUs7QUFDOUksVUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLE9BQU8sU0FBUztBQUN4QztBQUFBLE1BQ0Q7QUFDQSxnQkFBVSxRQUFRLE9BQU87QUFBQSxJQUMxQjtBQUVBLFFBQUk7QUFDSCxZQUFNLGVBQWUsZUFBZSxRQUFRLElBQUksR0FBSSxRQUFRLGFBQWEsQ0FBQyxDQUFFO0FBQUEsSUFDN0UsU0FBUyxLQUFLO0FBQ2IsMEJBQW9CLE1BQU0sR0FBRztBQUFBLElBQzlCO0FBQUEsRUFDRDtBQUNELENBQUM7IiwKICAibmFtZXMiOiBbInByb21pc2VzIiwgInJlcXVlc3QiLCAiaSJdCn0K
