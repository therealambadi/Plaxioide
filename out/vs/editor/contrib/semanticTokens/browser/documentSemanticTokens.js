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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import * as errors from "../../../../base/common/errors.js";
import { Disposable, dispose } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { registerEditorFeature } from "../../../common/editorFeatures.js";
import { ILanguageFeatureDebounceService } from "../../../common/services/languageFeatureDebounce.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { IModelService } from "../../../common/services/model.js";
import { toMultilineTokens2 } from "../../../common/services/semanticTokensProviderStyling.js";
import { ISemanticTokensStylingService } from "../../../common/services/semanticTokensStyling.js";
import { getDocumentSemanticTokens, hasDocumentSemanticTokensProvider, isSemanticTokens, isSemanticTokensEdits } from "../common/getSemanticTokens.js";
import { SEMANTIC_HIGHLIGHTING_SETTING_ID, isSemanticColoringEnabled } from "../common/semanticTokensConfig.js";
let DocumentSemanticTokensFeature = class extends Disposable {
  constructor(semanticTokensStylingService, modelService, themeService, configurationService, languageFeatureDebounceService, languageFeaturesService) {
    super();
    this._watchers = new ResourceMap();
    const register = (model) => {
      this._watchers.get(model.uri)?.dispose();
      this._watchers.set(model.uri, new ModelSemanticColoring(model, semanticTokensStylingService, themeService, languageFeatureDebounceService, languageFeaturesService));
    };
    const deregister = (model, modelSemanticColoring) => {
      modelSemanticColoring.dispose();
      this._watchers.delete(model.uri);
    };
    const handleSettingOrThemeChange = () => {
      for (const model of modelService.getModels()) {
        const curr = this._watchers.get(model.uri);
        if (isSemanticColoringEnabled(model, themeService, configurationService)) {
          if (!curr) {
            register(model);
          }
        } else {
          if (curr) {
            deregister(model, curr);
          }
        }
      }
    };
    modelService.getModels().forEach((model) => {
      if (isSemanticColoringEnabled(model, themeService, configurationService)) {
        register(model);
      }
    });
    this._register(modelService.onModelAdded((model) => {
      if (isSemanticColoringEnabled(model, themeService, configurationService)) {
        register(model);
      }
    }));
    this._register(modelService.onModelRemoved((model) => {
      const curr = this._watchers.get(model.uri);
      if (curr) {
        deregister(model, curr);
      }
    }));
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SEMANTIC_HIGHLIGHTING_SETTING_ID)) {
        handleSettingOrThemeChange();
      }
    }));
    this._register(themeService.onDidColorThemeChange(handleSettingOrThemeChange));
  }
  dispose() {
    dispose(this._watchers.values());
    this._watchers.clear();
    super.dispose();
  }
};
DocumentSemanticTokensFeature = __decorateClass([
  __decorateParam(0, ISemanticTokensStylingService),
  __decorateParam(1, IModelService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ILanguageFeatureDebounceService),
  __decorateParam(5, ILanguageFeaturesService)
], DocumentSemanticTokensFeature);
let ModelSemanticColoring = class extends Disposable {
  constructor(model, _semanticTokensStylingService, themeService, languageFeatureDebounceService, languageFeaturesService) {
    super();
    this._semanticTokensStylingService = _semanticTokensStylingService;
    this._isDisposed = false;
    this._model = model;
    this._provider = languageFeaturesService.documentSemanticTokensProvider;
    this._debounceInformation = languageFeatureDebounceService.for(this._provider, "DocumentSemanticTokens", { min: ModelSemanticColoring.REQUEST_MIN_DELAY, max: ModelSemanticColoring.REQUEST_MAX_DELAY });
    this._fetchDocumentSemanticTokens = this._register(new RunOnceScheduler(() => this._fetchDocumentSemanticTokensNow(), ModelSemanticColoring.REQUEST_MIN_DELAY));
    this._currentDocumentResponse = null;
    this._currentDocumentRequestCancellationTokenSource = null;
    this._documentProvidersChangeListeners = [];
    this._providersChangedDuringRequest = false;
    this._register(this._model.onDidChangeContent(() => {
      if (!this._fetchDocumentSemanticTokens.isScheduled()) {
        this._fetchDocumentSemanticTokens.schedule(this._debounceInformation.get(this._model));
      }
    }));
    this._register(this._model.onDidChangeAttached(() => {
      if (!this._fetchDocumentSemanticTokens.isScheduled()) {
        this._fetchDocumentSemanticTokens.schedule(this._debounceInformation.get(this._model));
      }
    }));
    this._register(this._model.onDidChangeLanguage(() => {
      if (this._currentDocumentResponse) {
        this._currentDocumentResponse.dispose();
        this._currentDocumentResponse = null;
      }
      if (this._currentDocumentRequestCancellationTokenSource) {
        this._currentDocumentRequestCancellationTokenSource.cancel();
        this._currentDocumentRequestCancellationTokenSource = null;
      }
      this._setDocumentSemanticTokens(null, null, null, []);
      this._fetchDocumentSemanticTokens.schedule(0);
    }));
    const bindDocumentChangeListeners = () => {
      dispose(this._documentProvidersChangeListeners);
      this._documentProvidersChangeListeners = [];
      for (const provider of this._provider.all(model)) {
        if (typeof provider.onDidChange === "function") {
          this._documentProvidersChangeListeners.push(provider.onDidChange(() => {
            if (this._currentDocumentRequestCancellationTokenSource) {
              this._providersChangedDuringRequest = true;
              return;
            }
            this._fetchDocumentSemanticTokens.schedule(0);
          }));
        }
      }
    };
    bindDocumentChangeListeners();
    this._register(this._provider.onDidChange(() => {
      bindDocumentChangeListeners();
      this._fetchDocumentSemanticTokens.schedule(this._debounceInformation.get(this._model));
    }));
    this._register(themeService.onDidColorThemeChange((_) => {
      this._setDocumentSemanticTokens(null, null, null, []);
      this._fetchDocumentSemanticTokens.schedule(this._debounceInformation.get(this._model));
    }));
    this._fetchDocumentSemanticTokens.schedule(0);
  }
  dispose() {
    if (this._currentDocumentResponse) {
      this._currentDocumentResponse.dispose();
      this._currentDocumentResponse = null;
    }
    if (this._currentDocumentRequestCancellationTokenSource) {
      this._currentDocumentRequestCancellationTokenSource.cancel();
      this._currentDocumentRequestCancellationTokenSource = null;
    }
    dispose(this._documentProvidersChangeListeners);
    this._documentProvidersChangeListeners = [];
    this._setDocumentSemanticTokens(null, null, null, []);
    this._isDisposed = true;
    super.dispose();
  }
  _fetchDocumentSemanticTokensNow() {
    if (this._currentDocumentRequestCancellationTokenSource) {
      return;
    }
    if (!hasDocumentSemanticTokensProvider(this._provider, this._model)) {
      if (this._currentDocumentResponse) {
        this._model.tokenization.setSemanticTokens(null, false);
      }
      return;
    }
    if (!this._model.isAttachedToEditor()) {
      return;
    }
    const cancellationTokenSource = new CancellationTokenSource();
    const lastProvider = this._currentDocumentResponse ? this._currentDocumentResponse.provider : null;
    const lastResultId = this._currentDocumentResponse ? this._currentDocumentResponse.resultId || null : null;
    const request = getDocumentSemanticTokens(this._provider, this._model, lastProvider, lastResultId, cancellationTokenSource.token);
    this._currentDocumentRequestCancellationTokenSource = cancellationTokenSource;
    this._providersChangedDuringRequest = false;
    const pendingChanges = [];
    const contentChangeListener = this._model.onDidChangeContent((e) => {
      pendingChanges.push(e);
    });
    const sw = new StopWatch(false);
    request.then((res) => {
      this._debounceInformation.update(this._model, sw.elapsed());
      this._currentDocumentRequestCancellationTokenSource = null;
      contentChangeListener.dispose();
      if (!res) {
        this._setDocumentSemanticTokens(null, null, null, pendingChanges);
      } else {
        const { provider, tokens } = res;
        const styling = this._semanticTokensStylingService.getStyling(provider);
        this._setDocumentSemanticTokens(provider, tokens || null, styling, pendingChanges);
      }
    }, (err) => {
      const isExpectedError = err && (errors.isCancellationError(err) || typeof err.message === "string" && err.message.indexOf("busy") !== -1);
      if (!isExpectedError) {
        errors.onUnexpectedError(err);
      }
      this._currentDocumentRequestCancellationTokenSource = null;
      contentChangeListener.dispose();
      if (pendingChanges.length > 0 || this._providersChangedDuringRequest) {
        if (!this._fetchDocumentSemanticTokens.isScheduled()) {
          this._fetchDocumentSemanticTokens.schedule(this._debounceInformation.get(this._model));
        }
      }
    });
  }
  static _copy(src, srcOffset, dest, destOffset, length) {
    length = Math.min(length, dest.length - destOffset, src.length - srcOffset);
    for (let i = 0; i < length; i++) {
      dest[destOffset + i] = src[srcOffset + i];
    }
  }
  _setDocumentSemanticTokens(provider, tokens, styling, pendingChanges) {
    const currentResponse = this._currentDocumentResponse;
    const rescheduleIfNeeded = () => {
      if ((pendingChanges.length > 0 || this._providersChangedDuringRequest) && !this._fetchDocumentSemanticTokens.isScheduled()) {
        this._fetchDocumentSemanticTokens.schedule(this._debounceInformation.get(this._model));
      }
    };
    if (this._currentDocumentResponse) {
      this._currentDocumentResponse.dispose();
      this._currentDocumentResponse = null;
    }
    if (this._isDisposed) {
      if (provider && tokens) {
        provider.releaseDocumentSemanticTokens(tokens.resultId);
      }
      return;
    }
    if (!provider || !styling) {
      this._model.tokenization.setSemanticTokens(null, false);
      return;
    }
    if (!tokens) {
      this._model.tokenization.setSemanticTokens(null, true);
      rescheduleIfNeeded();
      return;
    }
    if (isSemanticTokensEdits(tokens)) {
      if (!currentResponse) {
        this._model.tokenization.setSemanticTokens(null, true);
        return;
      }
      if (tokens.edits.length === 0) {
        tokens = {
          resultId: tokens.resultId,
          data: currentResponse.data
        };
      } else {
        let deltaLength = 0;
        for (const edit of tokens.edits) {
          deltaLength += (edit.data ? edit.data.length : 0) - edit.deleteCount;
        }
        const srcData = currentResponse.data;
        const destData = new Uint32Array(srcData.length + deltaLength);
        let srcLastStart = srcData.length;
        let destLastStart = destData.length;
        for (let i = tokens.edits.length - 1; i >= 0; i--) {
          const edit = tokens.edits[i];
          if (edit.start > srcData.length) {
            styling.warnInvalidEditStart(currentResponse.resultId, tokens.resultId, i, edit.start, srcData.length);
            this._model.tokenization.setSemanticTokens(null, true);
            return;
          }
          const copyCount = srcLastStart - (edit.start + edit.deleteCount);
          if (copyCount > 0) {
            ModelSemanticColoring._copy(srcData, srcLastStart - copyCount, destData, destLastStart - copyCount, copyCount);
            destLastStart -= copyCount;
          }
          if (edit.data) {
            ModelSemanticColoring._copy(edit.data, 0, destData, destLastStart - edit.data.length, edit.data.length);
            destLastStart -= edit.data.length;
          }
          srcLastStart = edit.start;
        }
        if (srcLastStart > 0) {
          ModelSemanticColoring._copy(srcData, 0, destData, 0, srcLastStart);
        }
        tokens = {
          resultId: tokens.resultId,
          data: destData
        };
      }
    }
    if (isSemanticTokens(tokens)) {
      this._currentDocumentResponse = new SemanticTokensResponse(provider, tokens.resultId, tokens.data);
      const result = toMultilineTokens2(tokens, styling, this._model.getLanguageId());
      if (pendingChanges.length > 0) {
        for (const change of pendingChanges) {
          for (const area of result) {
            for (const singleChange of change.changes) {
              area.applyEdit(singleChange.range, singleChange.text);
            }
          }
        }
      }
      this._model.tokenization.setSemanticTokens(result, true);
    } else {
      this._model.tokenization.setSemanticTokens(null, true);
    }
    rescheduleIfNeeded();
  }
};
ModelSemanticColoring.REQUEST_MIN_DELAY = 300;
ModelSemanticColoring.REQUEST_MAX_DELAY = 2e3;
ModelSemanticColoring = __decorateClass([
  __decorateParam(1, ISemanticTokensStylingService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, ILanguageFeatureDebounceService),
  __decorateParam(4, ILanguageFeaturesService)
], ModelSemanticColoring);
class SemanticTokensResponse {
  constructor(provider, resultId, data) {
    this.provider = provider;
    this.resultId = resultId;
    this.data = data;
  }
  dispose() {
    this.provider.releaseDocumentSemanticTokens(this.resultId);
  }
}
registerEditorFeature(DocumentSemanticTokensFeature);
export {
  DocumentSemanticTokensFeature
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zZW1hbnRpY1Rva2Vucy9icm93c2VyL2RvY3VtZW50U2VtYW50aWNUb2tlbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0ICogYXMgZXJyb3JzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBTdG9wV2F0Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdG9wd2F0Y2guanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckVkaXRvckZlYXR1cmUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyLCBTZW1hbnRpY1Rva2VucywgU2VtYW50aWNUb2tlbnNFZGl0cyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJRmVhdHVyZURlYm91bmNlSW5mb3JtYXRpb24sIElMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyU3R5bGluZywgdG9NdWx0aWxpbmVUb2tlbnMyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL3NlbWFudGljVG9rZW5zUHJvdmlkZXJTdHlsaW5nLmpzJztcbmltcG9ydCB7IElTZW1hbnRpY1Rva2Vuc1N0eWxpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL3NlbWFudGljVG9rZW5zU3R5bGluZy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBnZXREb2N1bWVudFNlbWFudGljVG9rZW5zLCBoYXNEb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIsIGlzU2VtYW50aWNUb2tlbnMsIGlzU2VtYW50aWNUb2tlbnNFZGl0cyB9IGZyb20gJy4uL2NvbW1vbi9nZXRTZW1hbnRpY1Rva2Vucy5qcyc7XG5pbXBvcnQgeyBTRU1BTlRJQ19ISUdITElHSFRJTkdfU0VUVElOR19JRCwgaXNTZW1hbnRpY0NvbG9yaW5nRW5hYmxlZCB9IGZyb20gJy4uL2NvbW1vbi9zZW1hbnRpY1Rva2Vuc0NvbmZpZy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBEb2N1bWVudFNlbWFudGljVG9rZW5zRmVhdHVyZSBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3dhdGNoZXJzID0gbmV3IFJlc291cmNlTWFwPE1vZGVsU2VtYW50aWNDb2xvcmluZz4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVNlbWFudGljVG9rZW5zU3R5bGluZ1NlcnZpY2Ugc2VtYW50aWNUb2tlbnNTdHlsaW5nU2VydmljZTogSVNlbWFudGljVG9rZW5zU3R5bGluZ1NlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UgbGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IHJlZ2lzdGVyID0gKG1vZGVsOiBJVGV4dE1vZGVsKSA9PiB7XG5cdFx0XHR0aGlzLl93YXRjaGVycy5nZXQobW9kZWwudXJpKT8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fd2F0Y2hlcnMuc2V0KG1vZGVsLnVyaSwgbmV3IE1vZGVsU2VtYW50aWNDb2xvcmluZyhtb2RlbCwgc2VtYW50aWNUb2tlbnNTdHlsaW5nU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBsYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UsIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKSk7XG5cdFx0fTtcblx0XHRjb25zdCBkZXJlZ2lzdGVyID0gKG1vZGVsOiBJVGV4dE1vZGVsLCBtb2RlbFNlbWFudGljQ29sb3Jpbmc6IE1vZGVsU2VtYW50aWNDb2xvcmluZykgPT4ge1xuXHRcdFx0bW9kZWxTZW1hbnRpY0NvbG9yaW5nLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX3dhdGNoZXJzLmRlbGV0ZShtb2RlbC51cmkpO1xuXHRcdH07XG5cdFx0Y29uc3QgaGFuZGxlU2V0dGluZ09yVGhlbWVDaGFuZ2UgPSAoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IG1vZGVsIG9mIG1vZGVsU2VydmljZS5nZXRNb2RlbHMoKSkge1xuXHRcdFx0XHRjb25zdCBjdXJyID0gdGhpcy5fd2F0Y2hlcnMuZ2V0KG1vZGVsLnVyaSk7XG5cdFx0XHRcdGlmIChpc1NlbWFudGljQ29sb3JpbmdFbmFibGVkKG1vZGVsLCB0aGVtZVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSkge1xuXHRcdFx0XHRcdGlmICghY3Vycikge1xuXHRcdFx0XHRcdFx0cmVnaXN0ZXIobW9kZWwpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoY3Vycikge1xuXHRcdFx0XHRcdFx0ZGVyZWdpc3Rlcihtb2RlbCwgY3Vycik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRtb2RlbFNlcnZpY2UuZ2V0TW9kZWxzKCkuZm9yRWFjaChtb2RlbCA9PiB7XG5cdFx0XHRpZiAoaXNTZW1hbnRpY0NvbG9yaW5nRW5hYmxlZChtb2RlbCwgdGhlbWVTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSkpIHtcblx0XHRcdFx0cmVnaXN0ZXIobW9kZWwpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG1vZGVsU2VydmljZS5vbk1vZGVsQWRkZWQoKG1vZGVsKSA9PiB7XG5cdFx0XHRpZiAoaXNTZW1hbnRpY0NvbG9yaW5nRW5hYmxlZChtb2RlbCwgdGhlbWVTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSkpIHtcblx0XHRcdFx0cmVnaXN0ZXIobW9kZWwpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihtb2RlbFNlcnZpY2Uub25Nb2RlbFJlbW92ZWQoKG1vZGVsKSA9PiB7XG5cdFx0XHRjb25zdCBjdXJyID0gdGhpcy5fd2F0Y2hlcnMuZ2V0KG1vZGVsLnVyaSk7XG5cdFx0XHRpZiAoY3Vycikge1xuXHRcdFx0XHRkZXJlZ2lzdGVyKG1vZGVsLCBjdXJyKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oU0VNQU5USUNfSElHSExJR0hUSU5HX1NFVFRJTkdfSUQpKSB7XG5cdFx0XHRcdGhhbmRsZVNldHRpbmdPclRoZW1lQ2hhbmdlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UoaGFuZGxlU2V0dGluZ09yVGhlbWVDaGFuZ2UpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0ZGlzcG9zZSh0aGlzLl93YXRjaGVycy52YWx1ZXMoKSk7XG5cdFx0dGhpcy5fd2F0Y2hlcnMuY2xlYXIoKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBNb2RlbFNlbWFudGljQ29sb3JpbmcgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwdWJsaWMgc3RhdGljIFJFUVVFU1RfTUlOX0RFTEFZID0gMzAwO1xuXHRwdWJsaWMgc3RhdGljIFJFUVVFU1RfTUFYX0RFTEFZID0gMjAwMDtcblxuXHRwcml2YXRlIF9pc0Rpc3Bvc2VkOiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbDogSVRleHRNb2RlbDtcblx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXI6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PERvY3VtZW50U2VtYW50aWNUb2tlbnNQcm92aWRlcj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlYm91bmNlSW5mb3JtYXRpb246IElGZWF0dXJlRGVib3VuY2VJbmZvcm1hdGlvbjtcblx0cHJpdmF0ZSByZWFkb25seSBfZmV0Y2hEb2N1bWVudFNlbWFudGljVG9rZW5zOiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIF9jdXJyZW50RG9jdW1lbnRSZXNwb25zZTogU2VtYW50aWNUb2tlbnNSZXNwb25zZSB8IG51bGw7XG5cdHByaXZhdGUgX2N1cnJlbnREb2N1bWVudFJlcXVlc3RDYW5jZWxsYXRpb25Ub2tlblNvdXJjZTogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfCBudWxsO1xuXHRwcml2YXRlIF9kb2N1bWVudFByb3ZpZGVyc0NoYW5nZUxpc3RlbmVyczogSURpc3Bvc2FibGVbXTtcblx0cHJpdmF0ZSBfcHJvdmlkZXJzQ2hhbmdlZER1cmluZ1JlcXVlc3Q6IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0QElTZW1hbnRpY1Rva2Vuc1N0eWxpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3NlbWFudGljVG9rZW5zU3R5bGluZ1NlcnZpY2U6IElTZW1hbnRpY1Rva2Vuc1N0eWxpbmdTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZSBsYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IGZhbHNlO1xuXHRcdHRoaXMuX21vZGVsID0gbW9kZWw7XG5cdFx0dGhpcy5fcHJvdmlkZXIgPSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXI7XG5cdFx0dGhpcy5fZGVib3VuY2VJbmZvcm1hdGlvbiA9IGxhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZS5mb3IodGhpcy5fcHJvdmlkZXIsICdEb2N1bWVudFNlbWFudGljVG9rZW5zJywgeyBtaW46IE1vZGVsU2VtYW50aWNDb2xvcmluZy5SRVFVRVNUX01JTl9ERUxBWSwgbWF4OiBNb2RlbFNlbWFudGljQ29sb3JpbmcuUkVRVUVTVF9NQVhfREVMQVkgfSk7XG5cdFx0dGhpcy5fZmV0Y2hEb2N1bWVudFNlbWFudGljVG9rZW5zID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5fZmV0Y2hEb2N1bWVudFNlbWFudGljVG9rZW5zTm93KCksIE1vZGVsU2VtYW50aWNDb2xvcmluZy5SRVFVRVNUX01JTl9ERUxBWSkpO1xuXHRcdHRoaXMuX2N1cnJlbnREb2N1bWVudFJlc3BvbnNlID0gbnVsbDtcblx0XHR0aGlzLl9jdXJyZW50RG9jdW1lbnRSZXF1ZXN0Q2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgPSBudWxsO1xuXHRcdHRoaXMuX2RvY3VtZW50UHJvdmlkZXJzQ2hhbmdlTGlzdGVuZXJzID0gW107XG5cdFx0dGhpcy5fcHJvdmlkZXJzQ2hhbmdlZER1cmluZ1JlcXVlc3QgPSBmYWxzZTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX21vZGVsLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX2ZldGNoRG9jdW1lbnRTZW1hbnRpY1Rva2Vucy5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRcdHRoaXMuX2ZldGNoRG9jdW1lbnRTZW1hbnRpY1Rva2Vucy5zY2hlZHVsZSh0aGlzLl9kZWJvdW5jZUluZm9ybWF0aW9uLmdldCh0aGlzLl9tb2RlbCkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9tb2RlbC5vbkRpZENoYW5nZUF0dGFjaGVkKCgpID0+IHtcblx0XHRcdGlmICghdGhpcy5fZmV0Y2hEb2N1bWVudFNlbWFudGljVG9rZW5zLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdFx0dGhpcy5fZmV0Y2hEb2N1bWVudFNlbWFudGljVG9rZW5zLnNjaGVkdWxlKHRoaXMuX2RlYm91bmNlSW5mb3JtYXRpb24uZ2V0KHRoaXMuX21vZGVsKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX21vZGVsLm9uRGlkQ2hhbmdlTGFuZ3VhZ2UoKCkgPT4ge1xuXHRcdFx0Ly8gY2xlYXIgYW55IG91dHN0YW5kaW5nIHN0YXRlXG5cdFx0XHRpZiAodGhpcy5fY3VycmVudERvY3VtZW50UmVzcG9uc2UpIHtcblx0XHRcdFx0dGhpcy5fY3VycmVudERvY3VtZW50UmVzcG9uc2UuZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl9jdXJyZW50RG9jdW1lbnRSZXNwb25zZSA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fY3VycmVudERvY3VtZW50UmVxdWVzdENhbmNlbGxhdGlvblRva2VuU291cmNlKSB7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnREb2N1bWVudFJlcXVlc3RDYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5jYW5jZWwoKTtcblx0XHRcdFx0dGhpcy5fY3VycmVudERvY3VtZW50UmVxdWVzdENhbmNlbGxhdGlvblRva2VuU291cmNlID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3NldERvY3VtZW50U2VtYW50aWNUb2tlbnMobnVsbCwgbnVsbCwgbnVsbCwgW10pO1xuXHRcdFx0dGhpcy5fZmV0Y2hEb2N1bWVudFNlbWFudGljVG9rZW5zLnNjaGVkdWxlKDApO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGJpbmREb2N1bWVudENoYW5nZUxpc3RlbmVycyA9ICgpID0+IHtcblx0XHRcdGRpc3Bvc2UodGhpcy5fZG9jdW1lbnRQcm92aWRlcnNDaGFuZ2VMaXN0ZW5lcnMpO1xuXHRcdFx0dGhpcy5fZG9jdW1lbnRQcm92aWRlcnNDaGFuZ2VMaXN0ZW5lcnMgPSBbXTtcblx0XHRcdGZvciAoY29uc3QgcHJvdmlkZXIgb2YgdGhpcy5fcHJvdmlkZXIuYWxsKG1vZGVsKSkge1xuXHRcdFx0XHRpZiAodHlwZW9mIHByb3ZpZGVyLm9uRGlkQ2hhbmdlID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdFx0dGhpcy5fZG9jdW1lbnRQcm92aWRlcnNDaGFuZ2VMaXN0ZW5lcnMucHVzaChwcm92aWRlci5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAodGhpcy5fY3VycmVudERvY3VtZW50UmVxdWVzdENhbmNlbGxhdGlvblRva2VuU291cmNlKSB7XG5cdFx0XHRcdFx0XHRcdC8vIHRoZXJlIGlzIGFscmVhZHkgYSByZXF1ZXN0IHJ1bm5pbmcsXG5cdFx0XHRcdFx0XHRcdHRoaXMuX3Byb3ZpZGVyc0NoYW5nZWREdXJpbmdSZXF1ZXN0ID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhpcy5fZmV0Y2hEb2N1bWVudFNlbWFudGljVG9rZW5zLnNjaGVkdWxlKDApO1xuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0YmluZERvY3VtZW50Q2hhbmdlTGlzdGVuZXJzKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fcHJvdmlkZXIub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0YmluZERvY3VtZW50Q2hhbmdlTGlzdGVuZXJzKCk7XG5cdFx0XHR0aGlzLl9mZXRjaERvY3VtZW50U2VtYW50aWNUb2tlbnMuc2NoZWR1bGUodGhpcy5fZGVib3VuY2VJbmZvcm1hdGlvbi5nZXQodGhpcy5fbW9kZWwpKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKF8gPT4ge1xuXHRcdFx0Ly8gY2xlYXIgb3V0IGV4aXN0aW5nIHRva2Vuc1xuXHRcdFx0dGhpcy5fc2V0RG9jdW1lbnRTZW1hbnRpY1Rva2VucyhudWxsLCBudWxsLCBudWxsLCBbXSk7XG5cdFx0XHR0aGlzLl9mZXRjaERvY3VtZW50U2VtYW50aWNUb2tlbnMuc2NoZWR1bGUodGhpcy5fZGVib3VuY2VJbmZvcm1hdGlvbi5nZXQodGhpcy5fbW9kZWwpKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9mZXRjaERvY3VtZW50U2VtYW50aWNUb2tlbnMuc2NoZWR1bGUoMCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fY3VycmVudERvY3VtZW50UmVzcG9uc2UpIHtcblx0XHRcdHRoaXMuX2N1cnJlbnREb2N1bWVudFJlc3BvbnNlLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX2N1cnJlbnREb2N1bWVudFJlc3BvbnNlID0gbnVsbDtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2N1cnJlbnREb2N1bWVudFJlcXVlc3RDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSkge1xuXHRcdFx0dGhpcy5fY3VycmVudERvY3VtZW50UmVxdWVzdENhbmNlbGxhdGlvblRva2VuU291cmNlLmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5fY3VycmVudERvY3VtZW50UmVxdWVzdENhbmNlbGxhdGlvblRva2VuU291cmNlID0gbnVsbDtcblx0XHR9XG5cdFx0ZGlzcG9zZSh0aGlzLl9kb2N1bWVudFByb3ZpZGVyc0NoYW5nZUxpc3RlbmVycyk7XG5cdFx0dGhpcy5fZG9jdW1lbnRQcm92aWRlcnNDaGFuZ2VMaXN0ZW5lcnMgPSBbXTtcblx0XHR0aGlzLl9zZXREb2N1bWVudFNlbWFudGljVG9rZW5zKG51bGwsIG51bGwsIG51bGwsIFtdKTtcblx0XHR0aGlzLl9pc0Rpc3Bvc2VkID0gdHJ1ZTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgX2ZldGNoRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc05vdygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fY3VycmVudERvY3VtZW50UmVxdWVzdENhbmNlbGxhdGlvblRva2VuU291cmNlKSB7XG5cdFx0XHQvLyB0aGVyZSBpcyBhbHJlYWR5IGEgcmVxdWVzdCBydW5uaW5nLCBsZXQgaXQgZmluaXNoLi4uXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCFoYXNEb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIodGhpcy5fcHJvdmlkZXIsIHRoaXMuX21vZGVsKSkge1xuXHRcdFx0Ly8gdGhlcmUgaXMgbm8gcHJvdmlkZXJcblx0XHRcdGlmICh0aGlzLl9jdXJyZW50RG9jdW1lbnRSZXNwb25zZSkge1xuXHRcdFx0XHQvLyB0aGVyZSBhcmUgc2VtYW50aWMgdG9rZW5zIHNldFxuXHRcdFx0XHR0aGlzLl9tb2RlbC50b2tlbml6YXRpb24uc2V0U2VtYW50aWNUb2tlbnMobnVsbCwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fbW9kZWwuaXNBdHRhY2hlZFRvRWRpdG9yKCkpIHtcblx0XHRcdC8vIHRoaXMgZG9jdW1lbnQgaXMgbm90IHZpc2libGUsIHRoZXJlIGlzIG5vIG5lZWQgdG8gZmV0Y2ggc2VtYW50aWMgdG9rZW5zIGZvciBpdFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNhbmNlbGxhdGlvblRva2VuU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0Y29uc3QgbGFzdFByb3ZpZGVyID0gdGhpcy5fY3VycmVudERvY3VtZW50UmVzcG9uc2UgPyB0aGlzLl9jdXJyZW50RG9jdW1lbnRSZXNwb25zZS5wcm92aWRlciA6IG51bGw7XG5cdFx0Y29uc3QgbGFzdFJlc3VsdElkID0gdGhpcy5fY3VycmVudERvY3VtZW50UmVzcG9uc2UgPyB0aGlzLl9jdXJyZW50RG9jdW1lbnRSZXNwb25zZS5yZXN1bHRJZCB8fCBudWxsIDogbnVsbDtcblx0XHRjb25zdCByZXF1ZXN0ID0gZ2V0RG9jdW1lbnRTZW1hbnRpY1Rva2Vucyh0aGlzLl9wcm92aWRlciwgdGhpcy5fbW9kZWwsIGxhc3RQcm92aWRlciwgbGFzdFJlc3VsdElkLCBjYW5jZWxsYXRpb25Ub2tlblNvdXJjZS50b2tlbik7XG5cdFx0dGhpcy5fY3VycmVudERvY3VtZW50UmVxdWVzdENhbmNlbGxhdGlvblRva2VuU291cmNlID0gY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U7XG5cdFx0dGhpcy5fcHJvdmlkZXJzQ2hhbmdlZER1cmluZ1JlcXVlc3QgPSBmYWxzZTtcblxuXHRcdGNvbnN0IHBlbmRpbmdDaGFuZ2VzOiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50W10gPSBbXTtcblx0XHRjb25zdCBjb250ZW50Q2hhbmdlTGlzdGVuZXIgPSB0aGlzLl9tb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQoKGUpID0+IHtcblx0XHRcdHBlbmRpbmdDaGFuZ2VzLnB1c2goZSk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzdyA9IG5ldyBTdG9wV2F0Y2goZmFsc2UpO1xuXHRcdHJlcXVlc3QudGhlbigocmVzKSA9PiB7XG5cdFx0XHR0aGlzLl9kZWJvdW5jZUluZm9ybWF0aW9uLnVwZGF0ZSh0aGlzLl9tb2RlbCwgc3cuZWxhcHNlZCgpKTtcblx0XHRcdHRoaXMuX2N1cnJlbnREb2N1bWVudFJlcXVlc3RDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSA9IG51bGw7XG5cdFx0XHRjb250ZW50Q2hhbmdlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXG5cdFx0XHRpZiAoIXJlcykge1xuXHRcdFx0XHR0aGlzLl9zZXREb2N1bWVudFNlbWFudGljVG9rZW5zKG51bGwsIG51bGwsIG51bGwsIHBlbmRpbmdDaGFuZ2VzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHsgcHJvdmlkZXIsIHRva2VucyB9ID0gcmVzO1xuXHRcdFx0XHRjb25zdCBzdHlsaW5nID0gdGhpcy5fc2VtYW50aWNUb2tlbnNTdHlsaW5nU2VydmljZS5nZXRTdHlsaW5nKHByb3ZpZGVyKTtcblx0XHRcdFx0dGhpcy5fc2V0RG9jdW1lbnRTZW1hbnRpY1Rva2Vucyhwcm92aWRlciwgdG9rZW5zIHx8IG51bGwsIHN0eWxpbmcsIHBlbmRpbmdDaGFuZ2VzKTtcblx0XHRcdH1cblx0XHR9LCAoZXJyKSA9PiB7XG5cdFx0XHRjb25zdCBpc0V4cGVjdGVkRXJyb3IgPSBlcnIgJiYgKGVycm9ycy5pc0NhbmNlbGxhdGlvbkVycm9yKGVycikgfHwgKHR5cGVvZiBlcnIubWVzc2FnZSA9PT0gJ3N0cmluZycgJiYgZXJyLm1lc3NhZ2UuaW5kZXhPZignYnVzeScpICE9PSAtMSkpO1xuXHRcdFx0aWYgKCFpc0V4cGVjdGVkRXJyb3IpIHtcblx0XHRcdFx0ZXJyb3JzLm9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNlbWFudGljIHRva2VucyBlYXRzIHVwIGFsbCBlcnJvcnMgYW5kIGNvbnNpZGVycyBlcnJvcnMgdG8gbWVhbiB0aGF0IHRoZSByZXN1bHQgaXMgdGVtcG9yYXJpbHkgbm90IGF2YWlsYWJsZVxuXHRcdFx0Ly8gVGhlIEFQSSBkb2VzIG5vdCBoYXZlIGEgc3BlY2lhbCBlcnJvciBraW5kIHRvIGV4cHJlc3MgdGhpcy4uLlxuXHRcdFx0dGhpcy5fY3VycmVudERvY3VtZW50UmVxdWVzdENhbmNlbGxhdGlvblRva2VuU291cmNlID0gbnVsbDtcblx0XHRcdGNvbnRlbnRDaGFuZ2VMaXN0ZW5lci5kaXNwb3NlKCk7XG5cblx0XHRcdGlmIChwZW5kaW5nQ2hhbmdlcy5sZW5ndGggPiAwIHx8IHRoaXMuX3Byb3ZpZGVyc0NoYW5nZWREdXJpbmdSZXF1ZXN0KSB7XG5cdFx0XHRcdC8vIE1vcmUgY2hhbmdlcyBvY2N1cnJlZCB3aGlsZSB0aGUgcmVxdWVzdCB3YXMgcnVubmluZ1xuXHRcdFx0XHRpZiAoIXRoaXMuX2ZldGNoRG9jdW1lbnRTZW1hbnRpY1Rva2Vucy5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRcdFx0dGhpcy5fZmV0Y2hEb2N1bWVudFNlbWFudGljVG9rZW5zLnNjaGVkdWxlKHRoaXMuX2RlYm91bmNlSW5mb3JtYXRpb24uZ2V0KHRoaXMuX21vZGVsKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9jb3B5KHNyYzogVWludDMyQXJyYXksIHNyY09mZnNldDogbnVtYmVyLCBkZXN0OiBVaW50MzJBcnJheSwgZGVzdE9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcik6IHZvaWQge1xuXHRcdC8vIHByb3RlY3QgYWdhaW5zdCBvdmVyZmxvd3Ncblx0XHRsZW5ndGggPSBNYXRoLm1pbihsZW5ndGgsIGRlc3QubGVuZ3RoIC0gZGVzdE9mZnNldCwgc3JjLmxlbmd0aCAtIHNyY09mZnNldCk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuXHRcdFx0ZGVzdFtkZXN0T2Zmc2V0ICsgaV0gPSBzcmNbc3JjT2Zmc2V0ICsgaV07XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2V0RG9jdW1lbnRTZW1hbnRpY1Rva2Vucyhwcm92aWRlcjogRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyIHwgbnVsbCwgdG9rZW5zOiBTZW1hbnRpY1Rva2VucyB8IFNlbWFudGljVG9rZW5zRWRpdHMgfCBudWxsLCBzdHlsaW5nOiBTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyU3R5bGluZyB8IG51bGwsIHBlbmRpbmdDaGFuZ2VzOiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50W10pOiB2b2lkIHtcblx0XHRjb25zdCBjdXJyZW50UmVzcG9uc2UgPSB0aGlzLl9jdXJyZW50RG9jdW1lbnRSZXNwb25zZTtcblx0XHRjb25zdCByZXNjaGVkdWxlSWZOZWVkZWQgPSAoKSA9PiB7XG5cdFx0XHRpZiAoKHBlbmRpbmdDaGFuZ2VzLmxlbmd0aCA+IDAgfHwgdGhpcy5fcHJvdmlkZXJzQ2hhbmdlZER1cmluZ1JlcXVlc3QpICYmICF0aGlzLl9mZXRjaERvY3VtZW50U2VtYW50aWNUb2tlbnMuaXNTY2hlZHVsZWQoKSkge1xuXHRcdFx0XHR0aGlzLl9mZXRjaERvY3VtZW50U2VtYW50aWNUb2tlbnMuc2NoZWR1bGUodGhpcy5fZGVib3VuY2VJbmZvcm1hdGlvbi5nZXQodGhpcy5fbW9kZWwpKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKHRoaXMuX2N1cnJlbnREb2N1bWVudFJlc3BvbnNlKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50RG9jdW1lbnRSZXNwb25zZS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9jdXJyZW50RG9jdW1lbnRSZXNwb25zZSA9IG51bGw7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHQvLyBkaXNwb3NlZCFcblx0XHRcdGlmIChwcm92aWRlciAmJiB0b2tlbnMpIHtcblx0XHRcdFx0cHJvdmlkZXIucmVsZWFzZURvY3VtZW50U2VtYW50aWNUb2tlbnModG9rZW5zLnJlc3VsdElkKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCFwcm92aWRlciB8fCAhc3R5bGluZykge1xuXHRcdFx0dGhpcy5fbW9kZWwudG9rZW5pemF0aW9uLnNldFNlbWFudGljVG9rZW5zKG51bGwsIGZhbHNlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0b2tlbnMpIHtcblx0XHRcdHRoaXMuX21vZGVsLnRva2VuaXphdGlvbi5zZXRTZW1hbnRpY1Rva2VucyhudWxsLCB0cnVlKTtcblx0XHRcdHJlc2NoZWR1bGVJZk5lZWRlZCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChpc1NlbWFudGljVG9rZW5zRWRpdHModG9rZW5zKSkge1xuXHRcdFx0aWYgKCFjdXJyZW50UmVzcG9uc2UpIHtcblx0XHRcdFx0Ly8gbm90IHBvc3NpYmxlIVxuXHRcdFx0XHR0aGlzLl9tb2RlbC50b2tlbml6YXRpb24uc2V0U2VtYW50aWNUb2tlbnMobnVsbCwgdHJ1ZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICh0b2tlbnMuZWRpdHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdC8vIG5vdGhpbmcgdG8gZG8hXG5cdFx0XHRcdHRva2VucyA9IHtcblx0XHRcdFx0XHRyZXN1bHRJZDogdG9rZW5zLnJlc3VsdElkLFxuXHRcdFx0XHRcdGRhdGE6IGN1cnJlbnRSZXNwb25zZS5kYXRhXG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsZXQgZGVsdGFMZW5ndGggPSAwO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGVkaXQgb2YgdG9rZW5zLmVkaXRzKSB7XG5cdFx0XHRcdFx0ZGVsdGFMZW5ndGggKz0gKGVkaXQuZGF0YSA/IGVkaXQuZGF0YS5sZW5ndGggOiAwKSAtIGVkaXQuZGVsZXRlQ291bnQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBzcmNEYXRhID0gY3VycmVudFJlc3BvbnNlLmRhdGE7XG5cdFx0XHRcdGNvbnN0IGRlc3REYXRhID0gbmV3IFVpbnQzMkFycmF5KHNyY0RhdGEubGVuZ3RoICsgZGVsdGFMZW5ndGgpO1xuXG5cdFx0XHRcdGxldCBzcmNMYXN0U3RhcnQgPSBzcmNEYXRhLmxlbmd0aDtcblx0XHRcdFx0bGV0IGRlc3RMYXN0U3RhcnQgPSBkZXN0RGF0YS5sZW5ndGg7XG5cdFx0XHRcdGZvciAobGV0IGkgPSB0b2tlbnMuZWRpdHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0XHRjb25zdCBlZGl0ID0gdG9rZW5zLmVkaXRzW2ldO1xuXG5cdFx0XHRcdFx0aWYgKGVkaXQuc3RhcnQgPiBzcmNEYXRhLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0c3R5bGluZy53YXJuSW52YWxpZEVkaXRTdGFydChjdXJyZW50UmVzcG9uc2UucmVzdWx0SWQsIHRva2Vucy5yZXN1bHRJZCwgaSwgZWRpdC5zdGFydCwgc3JjRGF0YS5sZW5ndGgpO1xuXHRcdFx0XHRcdFx0Ly8gVGhlIGVkaXRzIGFyZSBpbnZhbGlkIGFuZCB0aGVyZSdzIG5vIHdheSB0byByZWNvdmVyXG5cdFx0XHRcdFx0XHR0aGlzLl9tb2RlbC50b2tlbml6YXRpb24uc2V0U2VtYW50aWNUb2tlbnMobnVsbCwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgY29weUNvdW50ID0gc3JjTGFzdFN0YXJ0IC0gKGVkaXQuc3RhcnQgKyBlZGl0LmRlbGV0ZUNvdW50KTtcblx0XHRcdFx0XHRpZiAoY29weUNvdW50ID4gMCkge1xuXHRcdFx0XHRcdFx0TW9kZWxTZW1hbnRpY0NvbG9yaW5nLl9jb3B5KHNyY0RhdGEsIHNyY0xhc3RTdGFydCAtIGNvcHlDb3VudCwgZGVzdERhdGEsIGRlc3RMYXN0U3RhcnQgLSBjb3B5Q291bnQsIGNvcHlDb3VudCk7XG5cdFx0XHRcdFx0XHRkZXN0TGFzdFN0YXJ0IC09IGNvcHlDb3VudDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoZWRpdC5kYXRhKSB7XG5cdFx0XHRcdFx0XHRNb2RlbFNlbWFudGljQ29sb3JpbmcuX2NvcHkoZWRpdC5kYXRhLCAwLCBkZXN0RGF0YSwgZGVzdExhc3RTdGFydCAtIGVkaXQuZGF0YS5sZW5ndGgsIGVkaXQuZGF0YS5sZW5ndGgpO1xuXHRcdFx0XHRcdFx0ZGVzdExhc3RTdGFydCAtPSBlZGl0LmRhdGEubGVuZ3RoO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHNyY0xhc3RTdGFydCA9IGVkaXQuc3RhcnQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoc3JjTGFzdFN0YXJ0ID4gMCkge1xuXHRcdFx0XHRcdE1vZGVsU2VtYW50aWNDb2xvcmluZy5fY29weShzcmNEYXRhLCAwLCBkZXN0RGF0YSwgMCwgc3JjTGFzdFN0YXJ0KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRva2VucyA9IHtcblx0XHRcdFx0XHRyZXN1bHRJZDogdG9rZW5zLnJlc3VsdElkLFxuXHRcdFx0XHRcdGRhdGE6IGRlc3REYXRhXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGlzU2VtYW50aWNUb2tlbnModG9rZW5zKSkge1xuXG5cdFx0XHR0aGlzLl9jdXJyZW50RG9jdW1lbnRSZXNwb25zZSA9IG5ldyBTZW1hbnRpY1Rva2Vuc1Jlc3BvbnNlKHByb3ZpZGVyLCB0b2tlbnMucmVzdWx0SWQsIHRva2Vucy5kYXRhKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdG9NdWx0aWxpbmVUb2tlbnMyKHRva2Vucywgc3R5bGluZywgdGhpcy5fbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpKTtcblxuXHRcdFx0Ly8gQWRqdXN0IGluY29taW5nIHNlbWFudGljIHRva2Vuc1xuXHRcdFx0aWYgKHBlbmRpbmdDaGFuZ2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Ly8gTW9yZSBjaGFuZ2VzIG9jY3VycmVkIHdoaWxlIHRoZSByZXF1ZXN0IHdhcyBydW5uaW5nXG5cdFx0XHRcdC8vIFdlIG5lZWQgdG86XG5cdFx0XHRcdC8vIDEuIEFkanVzdCBpbmNvbWluZyBzZW1hbnRpYyB0b2tlbnNcblx0XHRcdFx0Ly8gMi4gUmVxdWVzdCB0aGVtIGFnYWluXG5cdFx0XHRcdGZvciAoY29uc3QgY2hhbmdlIG9mIHBlbmRpbmdDaGFuZ2VzKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBhcmVhIG9mIHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBzaW5nbGVDaGFuZ2Ugb2YgY2hhbmdlLmNoYW5nZXMpIHtcblx0XHRcdFx0XHRcdFx0YXJlYS5hcHBseUVkaXQoc2luZ2xlQ2hhbmdlLnJhbmdlLCBzaW5nbGVDaGFuZ2UudGV4dCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX21vZGVsLnRva2VuaXphdGlvbi5zZXRTZW1hbnRpY1Rva2VucyhyZXN1bHQsIHRydWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9tb2RlbC50b2tlbml6YXRpb24uc2V0U2VtYW50aWNUb2tlbnMobnVsbCwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0cmVzY2hlZHVsZUlmTmVlZGVkKCk7XG5cdH1cbn1cblxuY2xhc3MgU2VtYW50aWNUb2tlbnNSZXNwb25zZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBwcm92aWRlcjogRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyLFxuXHRcdHB1YmxpYyByZWFkb25seSByZXN1bHRJZDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdHB1YmxpYyByZWFkb25seSBkYXRhOiBVaW50MzJBcnJheVxuXHQpIHsgfVxuXG5cdHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMucHJvdmlkZXIucmVsZWFzZURvY3VtZW50U2VtYW50aWNUb2tlbnModGhpcy5yZXN1bHRJZCk7XG5cdH1cbn1cblxucmVnaXN0ZXJFZGl0b3JGZWF0dXJlKERvY3VtZW50U2VtYW50aWNUb2tlbnNGZWF0dXJlKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywrQkFBK0I7QUFDeEMsWUFBWSxZQUFZO0FBQ3hCLFNBQVMsWUFBeUIsZUFBZTtBQUNqRCxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDZCQUE2QjtBQUl0QyxTQUFzQyx1Q0FBdUM7QUFDN0UsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBd0MsMEJBQTBCO0FBQ2xFLFNBQVMscUNBQXFDO0FBRTlDLFNBQVMsMkJBQTJCLG1DQUFtQyxrQkFBa0IsNkJBQTZCO0FBQ3RILFNBQVMsa0NBQWtDLGlDQUFpQztBQUVyRSxJQUFNLGdDQUFOLGNBQTRDLFdBQVc7QUFBQSxFQUk3RCxZQUNnQyw4QkFDaEIsY0FDQSxjQUNRLHNCQUNVLGdDQUNQLHlCQUN6QjtBQUNELFVBQU07QUFWUCxTQUFpQixZQUFZLElBQUksWUFBbUM7QUFZbkUsVUFBTSxXQUFXLENBQUMsVUFBc0I7QUFDdkMsV0FBSyxVQUFVLElBQUksTUFBTSxHQUFHLEdBQUcsUUFBUTtBQUN2QyxXQUFLLFVBQVUsSUFBSSxNQUFNLEtBQUssSUFBSSxzQkFBc0IsT0FBTyw4QkFBOEIsY0FBYyxnQ0FBZ0MsdUJBQXVCLENBQUM7QUFBQSxJQUNwSztBQUNBLFVBQU0sYUFBYSxDQUFDLE9BQW1CLDBCQUFpRDtBQUN2Riw0QkFBc0IsUUFBUTtBQUM5QixXQUFLLFVBQVUsT0FBTyxNQUFNLEdBQUc7QUFB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
