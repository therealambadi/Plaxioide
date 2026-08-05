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
import { timeout } from "../../../base/common/async.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { logOnceWebWorkerWarning } from "../../../base/common/worker/webWorker.js";
import { createWebWorker } from "../../../base/browser/webWorkerFactory.js";
import { Range } from "../../common/core/range.js";
import * as languages from "../../common/languages.js";
import { ILanguageConfigurationService } from "../../common/languages/languageConfigurationRegistry.js";
import { EditorWorker } from "../../common/services/editorWebWorker.js";
import { IModelService } from "../../common/services/model.js";
import { ITextResourceConfigurationService } from "../../common/services/textResourceConfiguration.js";
import { isNonEmptyArray } from "../../../base/common/arrays.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { canceled, onUnexpectedError } from "../../../base/common/errors.js";
import { ILanguageFeaturesService } from "../../common/services/languageFeatures.js";
import { MovedText } from "../../common/diff/linesDiffComputer.js";
import { DetailedLineRangeMapping, RangeMapping, LineRangeMapping } from "../../common/diff/rangeMapping.js";
import { LineRange } from "../../common/core/lineRange.js";
import { mainWindow } from "../../../base/browser/window.js";
import { WindowIntervalTimer } from "../../../base/browser/dom.js";
import { WorkerTextModelSyncClient } from "../../common/services/textModelSync/textModelSync.impl.js";
import { EditorWorkerHost } from "../../common/services/editorWorkerHost.js";
const STOP_WORKER_DELTA_TIME_MS = 5 * 60 * 1e3;
function canSyncModel(modelService, resource) {
  const model = modelService.getModel(resource);
  if (!model) {
    return false;
  }
  if (model.isTooLargeForSyncing()) {
    return false;
  }
  return true;
}
let EditorWorkerService = class extends Disposable {
  constructor(workerDescriptor, modelService, configurationService, logService, _languageConfigurationService, languageFeaturesService) {
    super();
    this._languageConfigurationService = _languageConfigurationService;
    this._modelService = modelService;
    this._workerManager = this._register(new WorkerManager(workerDescriptor, this._modelService));
    this._logService = logService;
    this._register(languageFeaturesService.linkProvider.register({ language: "*", hasAccessToAllModels: true }, {
      provideLinks: async (model, token) => {
        if (!canSyncModel(this._modelService, model.uri)) {
          return Promise.resolve({ links: [] });
        }
        const worker = await this._workerWithResources([model.uri]);
        const links = await worker.$computeLinks(model.uri.toString());
        return links && { links };
      }
    }));
    this._register(languageFeaturesService.completionProvider.register("*", new WordBasedCompletionItemProvider(this._workerManager, configurationService, this._modelService, this._languageConfigurationService)));
  }
  dispose() {
    super.dispose();
  }
  canComputeUnicodeHighlights(uri) {
    return canSyncModel(this._modelService, uri);
  }
  async computedUnicodeHighlights(uri, options, range) {
    const worker = await this._workerWithResources([uri]);
    return worker.$computeUnicodeHighlights(uri.toString(), options, range);
  }
  async computeDiff(original, modified, options, algorithm) {
    const worker = await this._workerWithResources(
      [original, modified],
      /* forceLargeModels */
      true
    );
    const result = await worker.$computeDiff(original.toString(), modified.toString(), options, algorithm);
    if (!result) {
      return null;
    }
    const diff = {
      identical: result.identical,
      quitEarly: result.quitEarly,
      changes: toLineRangeMappings(result.changes),
      moves: result.moves.map((m) => new MovedText(
        new LineRangeMapping(new LineRange(m[0], m[1]), new LineRange(m[2], m[3])),
        toLineRangeMappings(m[4])
      ))
    };
    return diff;
    function toLineRangeMappings(changes) {
      return changes.map(
        (c) => new DetailedLineRangeMapping(
          new LineRange(c[0], c[1]),
          new LineRange(c[2], c[3]),
          c[4]?.map(
            (c2) => new RangeMapping(
              new Range(c2[0], c2[1], c2[2], c2[3]),
              new Range(c2[4], c2[5], c2[6], c2[7])
            )
          )
        )
      );
    }
  }
  canComputeDirtyDiff(original, modified) {
    return canSyncModel(this._modelService, original) && canSyncModel(this._modelService, modified);
  }
  async computeDirtyDiff(original, modified, ignoreTrimWhitespace) {
    const worker = await this._workerWithResources([original, modified]);
    return worker.$computeDirtyDiff(original.toString(), modified.toString(), ignoreTrimWhitespace);
  }
  async computeMoreMinimalEdits(resource, edits, pretty = false) {
    if (isNonEmptyArray(edits)) {
      if (!canSyncModel(this._modelService, resource)) {
        return Promise.resolve(edits);
      }
      const sw = StopWatch.create();
      const result = this._workerWithResources([resource]).then((worker) => worker.$computeMoreMinimalEdits(resource.toString(), edits, pretty));
      result.finally(() => this._logService.trace("FORMAT#computeMoreMinimalEdits", resource.toString(true), sw.elapsed()));
      return Promise.race([result, timeout(1e3).then(() => edits)]);
    } else {
      return Promise.resolve(void 0);
    }
  }
  computeHumanReadableDiff(resource, edits) {
    if (isNonEmptyArray(edits)) {
      if (!canSyncModel(this._modelService, resource)) {
        return Promise.resolve(edits);
      }
      const sw = StopWatch.create();
      const opts = { ignoreTrimWhitespace: false, maxComputationTimeMs: 1e3, computeMoves: false };
      const result = this._workerWithResources([resource]).then((worker) => worker.$computeHumanReadableDiff(resource.toString(), edits, opts)).catch((err) => {
        onUnexpectedError(err);
        return this.computeMoreMinimalEdits(resource, edits, true);
      });
      result.finally(() => this._logService.trace("FORMAT#computeHumanReadableDiff", resource.toString(true), sw.elapsed()));
      return result;
    } else {
      return Promise.resolve(void 0);
    }
  }
  canNavigateValueSet(resource) {
    return canSyncModel(this._modelService, resource);
  }
  async navigateValueSet(resource, range, up) {
    const model = this._modelService.getModel(resource);
    if (!model) {
      return null;
    }
    const wordDefRegExp = this._languageConfigurationService.getLanguageConfiguration(model.getLanguageId()).getWordDefinition();
    const wordDef = wordDefRegExp.source;
    const wordDefFlags = wordDefRegExp.flags;
    const worker = await this._workerWithResources([resource]);
    return worker.$navigateValueSet(resource.toString(), range, up, wordDef, wordDefFlags);
  }
  canComputeWordRanges(resource) {
    return canSyncModel(this._modelService, resource);
  }
  async computeWordRanges(resource, range) {
    const model = this._modelService.getModel(resource);
    if (!model) {
      return Promise.resolve(null);
    }
    const wordDefRegExp = this._languageConfigurationService.getLanguageConfiguration(model.getLanguageId()).getWordDefinition();
    const wordDef = wordDefRegExp.source;
    const wordDefFlags = wordDefRegExp.flags;
    const worker = await this._workerWithResources([resource]);
    return worker.$computeWordRanges(resource.toString(), range, wordDef, wordDefFlags);
  }
  async findSectionHeaders(uri, options) {
    const worker = await this._workerWithResources([uri]);
    return worker.$findSectionHeaders(uri.toString(), options);
  }
  async computeDefaultDocumentColors(uri) {
    const worker = await this._workerWithResources([uri]);
    return worker.$computeDefaultDocumentColors(uri.toString());
  }
  async _workerWithResources(resources, forceLargeModels = false) {
    const worker = await this._workerManager.withWorker();
    return await worker.workerWithSyncedResources(resources, forceLargeModels);
  }
};
EditorWorkerService = __decorateClass([
  __decorateParam(1, IModelService),
  __decorateParam(2, ITextResourceConfigurationService),
  __decorateParam(3, ILogService),
  __decorateParam(4, ILanguageConfigurationService),
  __decorateParam(5, ILanguageFeaturesService)
], EditorWorkerService);
class WordBasedCompletionItemProvider {
  constructor(workerManager, configurationService, modelService, languageConfigurationService) {
    this.languageConfigurationService = languageConfigurationService;
    this._debugDisplayName = "wordbasedCompletions";
    this._workerManager = workerManager;
    this._configurationService = configurationService;
    this._modelService = modelService;
  }
  async provideCompletionItems(model, position) {
    const config = this._configurationService.getValue(model.uri, position, "editor");
    if (config.wordBasedSuggestions === "off") {
      return void 0;
    }
    const models = [];
    if (config.wordBasedSuggestions === "currentDocument") {
      if (canSyncModel(this._modelService, model.uri)) {
        models.push(model.uri);
      }
    } else {
      for (const candidate of this._modelService.getModels()) {
        if (!canSyncModel(this._modelService, candidate.uri)) {
          continue;
        }
        if (candidate === model) {
          models.unshift(candidate.uri);
        } else if (config.wordBasedSuggestions === "allDocuments" || candidate.getLanguageId() === model.getLanguageId()) {
          models.push(candidate.uri);
        }
      }
    }
    if (models.length === 0) {
      return void 0;
    }
    const wordDefRegExp = this.languageConfigurationService.getLanguageConfiguration(model.getLanguageId()).getWordDefinition();
    const word = model.getWordAtPosition(position);
    const replace = !word ? Range.fromPositions(position) : new Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
    const insert = replace.setEndPosition(position.lineNumber, position.column);
    const client = await this._workerManager.withWorker();
    const data = await client.textualSuggest(models, word?.word, wordDefRegExp);
    if (!data) {
      return void 0;
    }
    return {
      duration: data.duration,
      suggestions: data.words.map((word2) => {
        return {
          kind: languages.CompletionItemKind.Text,
          label: word2,
          insertText: word2,
          range: { insert, replace }
        };
      })
    };
  }
}
let WorkerManager = class extends Disposable {
  constructor(_workerDescriptor, modelService) {
    super();
    this._workerDescriptor = _workerDescriptor;
    this._modelService = modelService;
    this._editorWorkerClient = null;
    this._lastWorkerUsedTime = (/* @__PURE__ */ new Date()).getTime();
    const stopWorkerInterval = this._register(new WindowIntervalTimer());
    stopWorkerInterval.cancelAndSet(() => this._checkStopIdleWorker(), Math.round(STOP_WORKER_DELTA_TIME_MS / 2), mainWindow);
    this._register(this._modelService.onModelRemoved((_) => this._checkStopEmptyWorker()));
  }
  dispose() {
    if (this._editorWorkerClient) {
      this._editorWorkerClient.dispose();
      this._editorWorkerClient = null;
    }
    super.dispose();
  }
  /**
   * Check if the model service has no more models and stop the worker if that is the case.
   */
  _checkStopEmptyWorker() {
    if (!this._editorWorkerClient) {
      return;
    }
    const models = this._modelService.getModels();
    if (models.length === 0) {
      this._editorWorkerClient.dispose();
      this._editorWorkerClient = null;
    }
  }
  /**
   * Check if the worker has been idle for a while and then stop it.
   */
  _checkStopIdleWorker() {
    if (!this._editorWorkerClient) {
      return;
    }
    const timeSinceLastWorkerUsedTime = (/* @__PURE__ */ new Date()).getTime() - this._lastWorkerUsedTime;
    if (timeSinceLastWorkerUsedTime > STOP_WORKER_DELTA_TIME_MS) {
      this._editorWorkerClient.dispose();
      this._editorWorkerClient = null;
    }
  }
  withWorker() {
    this._lastWorkerUsedTime = (/* @__PURE__ */ new Date()).getTime();
    if (!this._editorWorkerClient) {
      this._editorWorkerClient = new EditorWorkerClient(this._workerDescriptor, false, this._modelService);
    }
    return Promise.resolve(this._editorWorkerClient);
  }
};
WorkerManager = __decorateClass([
  __decorateParam(1, IModelService)
], WorkerManager);
class SynchronousWorkerClient {
  constructor(instance) {
    this._instance = instance;
    this.proxy = this._instance;
  }
  dispose() {
    this._instance.dispose();
  }
  setChannel(channel, handler) {
    throw new Error(`Not supported`);
  }
  getChannel(channel) {
    throw new Error(`Not supported`);
  }
}
let EditorWorkerClient = class extends Disposable {
  constructor(_workerDescriptorOrWorker, keepIdleModels, modelService) {
    super();
    this._workerDescriptorOrWorker = _workerDescriptorOrWorker;
    this._disposed = false;
    this._modelService = modelService;
    this._keepIdleModels = keepIdleModels;
    this._worker = null;
    this._modelManager = null;
  }
  // foreign host request
  fhr(method, args) {
    throw new Error(`Not implemented!`);
  }
  _getOrCreateWorker() {
    if (!this._worker) {
      try {
        this._worker = this._register(createWebWorker(this._workerDescriptorOrWorker));
        EditorWorkerHost.setChannel(this._worker, this._createEditorWorkerHost());
      } catch (err) {
        logOnceWebWorkerWarning(err);
        this._worker = this._createFallbackLocalWorker();
      }
    }
    return this._worker;
  }
  async _getProxy() {
    try {
      const proxy = this._getOrCreateWorker().proxy;
      await proxy.$ping();
      return proxy;
    } catch (err) {
      logOnceWebWorkerWarning(err);
      this._worker = this._createFallbackLocalWorker();
      return this._worker.proxy;
    }
  }
  _createFallbackLocalWorker() {
    return new SynchronousWorkerClient(new EditorWorker(null));
  }
  _createEditorWorkerHost() {
    return {
      $fhr: (method, args) => this.fhr(method, args)
    };
  }
  _getOrCreateModelManager(proxy) {
    if (!this._modelManager) {
      this._modelManager = this._register(new WorkerTextModelSyncClient(proxy, this._modelService, this._keepIdleModels));
    }
    return this._modelManager;
  }
  async workerWithSyncedResources(resources, forceLargeModels = false) {
    if (this._disposed) {
      return Promise.reject(canceled());
    }
    const proxy = await this._getProxy();
    this._getOrCreateModelManager(proxy).ensureSyncedResources(resources, forceLargeModels);
    return proxy;
  }
  async textualSuggest(resources, leadingWord, wordDefRegExp) {
    const proxy = await this.workerWithSyncedResources(resources);
    const wordDef = wordDefRegExp.source;
    const wordDefFlags = wordDefRegExp.flags;
    return proxy.$textualSuggest(resources.map((r) => r.toString()), leadingWord, wordDef, wordDefFlags);
  }
  dispose() {
    super.dispose();
    this._disposed = true;
  }
};
EditorWorkerClient = __decorateClass([
  __decorateParam(2, IModelService)
], EditorWorkerClient);
export {
  EditorWorkerClient,
  EditorWorkerService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9lZGl0b3JXb3JrZXJTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2dPbmNlV2ViV29ya2VyV2FybmluZywgSVdlYldvcmtlckNsaWVudCwgUHJveGllZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3dvcmtlci93ZWJXb3JrZXIuanMnO1xuaW1wb3J0IHsgY3JlYXRlV2ViV29ya2VyLCBJV2ViV29ya2VyRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93ZWJXb3JrZXJGYWN0b3J5LmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VzIGZyb20gJy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEVkaXRvcldvcmtlciB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9lZGl0b3JXZWJXb3JrZXIuanMnO1xuaW1wb3J0IHsgRGlmZkFsZ29yaXRobU5hbWUsIElFZGl0b3JXb3JrZXJTZXJ2aWNlLCBJTGluZUNoYW5nZSwgSVVuaWNvZGVIaWdobGlnaHRzUmVzdWx0IH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlcnZpY2VzL2VkaXRvcldvcmtlci5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IGlzTm9uRW1wdHlBcnJheSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBjYW5jZWxlZCwgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgVW5pY29kZUhpZ2hsaWdodGVyT3B0aW9ucyB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy91bmljb2RlVGV4dE1vZGVsSGlnaGxpZ2h0ZXIuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSUNoYW5nZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9kaWZmL2xlZ2FjeUxpbmVzRGlmZkNvbXB1dGVyLmpzJztcbmltcG9ydCB7IElEb2N1bWVudERpZmYsIElEb2N1bWVudERpZmZQcm92aWRlck9wdGlvbnMgfSBmcm9tICcuLi8uLi9jb21tb24vZGlmZi9kb2N1bWVudERpZmZQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBJTGluZXNEaWZmQ29tcHV0ZXJPcHRpb25zLCBNb3ZlZFRleHQgfSBmcm9tICcuLi8uLi9jb21tb24vZGlmZi9saW5lc0RpZmZDb21wdXRlci5qcyc7XG5pbXBvcnQgeyBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcsIFJhbmdlTWFwcGluZywgTGluZVJhbmdlTWFwcGluZyB9IGZyb20gJy4uLy4uL2NvbW1vbi9kaWZmL3JhbmdlTWFwcGluZy5qcyc7XG5pbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICcuLi8uLi9jb21tb24vY29yZS9saW5lUmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VjdGlvbkhlYWRlciwgRmluZFNlY3Rpb25IZWFkZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlcnZpY2VzL2ZpbmRTZWN0aW9uSGVhZGVycy5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBXaW5kb3dJbnRlcnZhbFRpbWVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBXb3JrZXJUZXh0TW9kZWxTeW5jQ2xpZW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlcnZpY2VzL3RleHRNb2RlbFN5bmMvdGV4dE1vZGVsU3luYy5pbXBsLmpzJztcbmltcG9ydCB7IEVkaXRvcldvcmtlckhvc3QgfSBmcm9tICcuLi8uLi9jb21tb24vc2VydmljZXMvZWRpdG9yV29ya2VySG9zdC5qcyc7XG5cbi8qKlxuICogU3RvcCB0aGUgd29ya2VyIGlmIGl0IHdhcyBub3QgbmVlZGVkIGZvciA1IG1pbi5cbiAqL1xuY29uc3QgU1RPUF9XT1JLRVJfREVMVEFfVElNRV9NUyA9IDUgKiA2MCAqIDEwMDA7XG5cbmZ1bmN0aW9uIGNhblN5bmNNb2RlbChtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsIHJlc291cmNlOiBVUkkpOiBib29sZWFuIHtcblx0Y29uc3QgbW9kZWwgPSBtb2RlbFNlcnZpY2UuZ2V0TW9kZWwocmVzb3VyY2UpO1xuXHRpZiAoIW1vZGVsKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGlmIChtb2RlbC5pc1Rvb0xhcmdlRm9yU3luY2luZygpKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRWRpdG9yV29ya2VyU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRWRpdG9yV29ya2VyU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF93b3JrZXJNYW5hZ2VyOiBXb3JrZXJNYW5hZ2VyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR3b3JrZXJEZXNjcmlwdG9yOiBJV2ViV29ya2VyRGVzY3JpcHRvcixcblx0XHRASU1vZGVsU2VydmljZSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX21vZGVsU2VydmljZSA9IG1vZGVsU2VydmljZTtcblx0XHR0aGlzLl93b3JrZXJNYW5hZ2VyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFdvcmtlck1hbmFnZXIod29ya2VyRGVzY3JpcHRvciwgdGhpcy5fbW9kZWxTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fbG9nU2VydmljZSA9IGxvZ1NlcnZpY2U7XG5cblx0XHQvLyByZWdpc3RlciBkZWZhdWx0IGxpbmstcHJvdmlkZXIgYW5kIGRlZmF1bHQgY29tcGxldGlvbnMtcHJvdmlkZXJcblx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5saW5rUHJvdmlkZXIucmVnaXN0ZXIoeyBsYW5ndWFnZTogJyonLCBoYXNBY2Nlc3NUb0FsbE1vZGVsczogdHJ1ZSB9LCB7XG5cdFx0XHRwcm92aWRlTGlua3M6IGFzeW5jIChtb2RlbCwgdG9rZW4pID0+IHtcblx0XHRcdFx0aWYgKCFjYW5TeW5jTW9kZWwodGhpcy5fbW9kZWxTZXJ2aWNlLCBtb2RlbC51cmkpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh7IGxpbmtzOiBbXSB9KTsgLy8gRmlsZSB0b28gbGFyZ2Vcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCB3b3JrZXIgPSBhd2FpdCB0aGlzLl93b3JrZXJXaXRoUmVzb3VyY2VzKFttb2RlbC51cmldKTtcblx0XHRcdFx0Y29uc3QgbGlua3MgPSBhd2FpdCB3b3JrZXIuJGNvbXB1dGVMaW5rcyhtb2RlbC51cmkudG9TdHJpbmcoKSk7XG5cdFx0XHRcdHJldHVybiBsaW5rcyAmJiB7IGxpbmtzIH07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlci5yZWdpc3RlcignKicsIG5ldyBXb3JkQmFzZWRDb21wbGV0aW9uSXRlbVByb3ZpZGVyKHRoaXMuX3dvcmtlck1hbmFnZXIsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLl9tb2RlbFNlcnZpY2UsIHRoaXMuX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpKSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwdWJsaWMgY2FuQ29tcHV0ZVVuaWNvZGVIaWdobGlnaHRzKHVyaTogVVJJKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGNhblN5bmNNb2RlbCh0aGlzLl9tb2RlbFNlcnZpY2UsIHVyaSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgY29tcHV0ZWRVbmljb2RlSGlnaGxpZ2h0cyh1cmk6IFVSSSwgb3B0aW9uczogVW5pY29kZUhpZ2hsaWdodGVyT3B0aW9ucywgcmFuZ2U/OiBJUmFuZ2UpOiBQcm9taXNlPElVbmljb2RlSGlnaGxpZ2h0c1Jlc3VsdD4ge1xuXHRcdGNvbnN0IHdvcmtlciA9IGF3YWl0IHRoaXMuX3dvcmtlcldpdGhSZXNvdXJjZXMoW3VyaV0pO1xuXHRcdHJldHVybiB3b3JrZXIuJGNvbXB1dGVVbmljb2RlSGlnaGxpZ2h0cyh1cmkudG9TdHJpbmcoKSwgb3B0aW9ucywgcmFuZ2UpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGNvbXB1dGVEaWZmKG9yaWdpbmFsOiBVUkksIG1vZGlmaWVkOiBVUkksIG9wdGlvbnM6IElEb2N1bWVudERpZmZQcm92aWRlck9wdGlvbnMsIGFsZ29yaXRobTogRGlmZkFsZ29yaXRobU5hbWUpOiBQcm9taXNlPElEb2N1bWVudERpZmYgfCBudWxsPiB7XG5cdFx0Y29uc3Qgd29ya2VyID0gYXdhaXQgdGhpcy5fd29ya2VyV2l0aFJlc291cmNlcyhbb3JpZ2luYWwsIG1vZGlmaWVkXSwgLyogZm9yY2VMYXJnZU1vZGVscyAqL3RydWUpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdvcmtlci4kY29tcHV0ZURpZmYob3JpZ2luYWwudG9TdHJpbmcoKSwgbW9kaWZpZWQudG9TdHJpbmcoKSwgb3B0aW9ucywgYWxnb3JpdGhtKTtcblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdC8vIENvbnZlcnQgZnJvbSBzcGFjZSBlZmZpY2llbnQgSlNPTiBkYXRhIHRvIHJpY2ggb2JqZWN0cy5cblx0XHRjb25zdCBkaWZmOiBJRG9jdW1lbnREaWZmID0ge1xuXHRcdFx0aWRlbnRpY2FsOiByZXN1bHQuaWRlbnRpY2FsLFxuXHRcdFx0cXVpdEVhcmx5OiByZXN1bHQucXVpdEVhcmx5LFxuXHRcdFx0Y2hhbmdlczogdG9MaW5lUmFuZ2VNYXBwaW5ncyhyZXN1bHQuY2hhbmdlcyksXG5cdFx0XHRtb3ZlczogcmVzdWx0Lm1vdmVzLm1hcChtID0+IG5ldyBNb3ZlZFRleHQoXG5cdFx0XHRcdG5ldyBMaW5lUmFuZ2VNYXBwaW5nKG5ldyBMaW5lUmFuZ2UobVswXSwgbVsxXSksIG5ldyBMaW5lUmFuZ2UobVsyXSwgbVszXSkpLFxuXHRcdFx0XHR0b0xpbmVSYW5nZU1hcHBpbmdzKG1bNF0pXG5cdFx0XHQpKVxuXHRcdH07XG5cdFx0cmV0dXJuIGRpZmY7XG5cblx0XHRmdW5jdGlvbiB0b0xpbmVSYW5nZU1hcHBpbmdzKGNoYW5nZXM6IHJlYWRvbmx5IElMaW5lQ2hhbmdlW10pOiByZWFkb25seSBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmdbXSB7XG5cdFx0XHRyZXR1cm4gY2hhbmdlcy5tYXAoXG5cdFx0XHRcdChjKSA9PiBuZXcgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nKFxuXHRcdFx0XHRcdG5ldyBMaW5lUmFuZ2UoY1swXSwgY1sxXSksXG5cdFx0XHRcdFx0bmV3IExpbmVSYW5nZShjWzJdLCBjWzNdKSxcblx0XHRcdFx0XHRjWzRdPy5tYXAoXG5cdFx0XHRcdFx0XHQoYykgPT4gbmV3IFJhbmdlTWFwcGluZyhcblx0XHRcdFx0XHRcdFx0bmV3IFJhbmdlKGNbMF0sIGNbMV0sIGNbMl0sIGNbM10pLFxuXHRcdFx0XHRcdFx0XHRuZXcgUmFuZ2UoY1s0XSwgY1s1XSwgY1s2XSwgY1s3XSlcblx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHQpXG5cdFx0XHRcdClcblx0XHRcdCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGNhbkNvbXB1dGVEaXJ0eURpZmYob3JpZ2luYWw6IFVSSSwgbW9kaWZpZWQ6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAoY2FuU3luY01vZGVsKHRoaXMuX21vZGVsU2VydmljZSwgb3JpZ2luYWwpICYmIGNhblN5bmNNb2RlbCh0aGlzLl9tb2RlbFNlcnZpY2UsIG1vZGlmaWVkKSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgY29tcHV0ZURpcnR5RGlmZihvcmlnaW5hbDogVVJJLCBtb2RpZmllZDogVVJJLCBpZ25vcmVUcmltV2hpdGVzcGFjZTogYm9vbGVhbik6IFByb21pc2U8SUNoYW5nZVtdIHwgbnVsbD4ge1xuXHRcdGNvbnN0IHdvcmtlciA9IGF3YWl0IHRoaXMuX3dvcmtlcldpdGhSZXNvdXJjZXMoW29yaWdpbmFsLCBtb2RpZmllZF0pO1xuXHRcdHJldHVybiB3b3JrZXIuJGNvbXB1dGVEaXJ0eURpZmYob3JpZ2luYWwudG9TdHJpbmcoKSwgbW9kaWZpZWQudG9TdHJpbmcoKSwgaWdub3JlVHJpbVdoaXRlc3BhY2UpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGNvbXB1dGVNb3JlTWluaW1hbEVkaXRzKHJlc291cmNlOiBVUkksIGVkaXRzOiBsYW5ndWFnZXMuVGV4dEVkaXRbXSB8IG51bGwgfCB1bmRlZmluZWQsIHByZXR0eTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxsYW5ndWFnZXMuVGV4dEVkaXRbXSB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmIChpc05vbkVtcHR5QXJyYXkoZWRpdHMpKSB7XG5cdFx0XHRpZiAoIWNhblN5bmNNb2RlbCh0aGlzLl9tb2RlbFNlcnZpY2UsIHJlc291cmNlKSkge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGVkaXRzKTsgLy8gRmlsZSB0b28gbGFyZ2Vcblx0XHRcdH1cblx0XHRcdGNvbnN0IHN3ID0gU3RvcFdhdGNoLmNyZWF0ZSgpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fd29ya2VyV2l0aFJlc291cmNlcyhbcmVzb3VyY2VdKS50aGVuKHdvcmtlciA9PiB3b3JrZXIuJGNvbXB1dGVNb3JlTWluaW1hbEVkaXRzKHJlc291cmNlLnRvU3RyaW5nKCksIGVkaXRzLCBwcmV0dHkpKTtcblx0XHRcdHJlc3VsdC5maW5hbGx5KCgpID0+IHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ0ZPUk1BVCNjb21wdXRlTW9yZU1pbmltYWxFZGl0cycsIHJlc291cmNlLnRvU3RyaW5nKHRydWUpLCBzdy5lbGFwc2VkKCkpKTtcblx0XHRcdHJldHVybiBQcm9taXNlLnJhY2UoW3Jlc3VsdCwgdGltZW91dCgxMDAwKS50aGVuKCgpID0+IGVkaXRzKV0pO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgY29tcHV0ZUh1bWFuUmVhZGFibGVEaWZmKHJlc291cmNlOiBVUkksIGVkaXRzOiBsYW5ndWFnZXMuVGV4dEVkaXRbXSB8IG51bGwgfCB1bmRlZmluZWQpOiBQcm9taXNlPGxhbmd1YWdlcy5UZXh0RWRpdFtdIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKGlzTm9uRW1wdHlBcnJheShlZGl0cykpIHtcblx0XHRcdGlmICghY2FuU3luY01vZGVsKHRoaXMuX21vZGVsU2VydmljZSwgcmVzb3VyY2UpKSB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoZWRpdHMpOyAvLyBGaWxlIHRvbyBsYXJnZVxuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgc3cgPSBTdG9wV2F0Y2guY3JlYXRlKCk7XG5cdFx0XHRjb25zdCBvcHRzOiBJTGluZXNEaWZmQ29tcHV0ZXJPcHRpb25zID0geyBpZ25vcmVUcmltV2hpdGVzcGFjZTogZmFsc2UsIG1heENvbXB1dGF0aW9uVGltZU1zOiAxMDAwLCBjb21wdXRlTW92ZXM6IGZhbHNlIH07XG5cdFx0XHRjb25zdCByZXN1bHQgPSAoXG5cdFx0XHRcdHRoaXMuX3dvcmtlcldpdGhSZXNvdXJjZXMoW3Jlc291cmNlXSlcblx0XHRcdFx0XHQudGhlbih3b3JrZXIgPT4gd29ya2VyLiRjb21wdXRlSHVtYW5SZWFkYWJsZURpZmYocmVzb3VyY2UudG9TdHJpbmcoKSwgZWRpdHMsIG9wdHMpKVxuXHRcdFx0XHRcdC5jYXRjaCgoZXJyKSA9PiB7XG5cdFx0XHRcdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnIpO1xuXHRcdFx0XHRcdFx0Ly8gSW4gY2FzZSBvZiBhbiBleGNlcHRpb24sIGZhbGwgYmFjayB0byBjb21wdXRlTW9yZU1pbmltYWxFZGl0c1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuY29tcHV0ZU1vcmVNaW5pbWFsRWRpdHMocmVzb3VyY2UsIGVkaXRzLCB0cnVlKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0KTtcblx0XHRcdHJlc3VsdC5maW5hbGx5KCgpID0+IHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ0ZPUk1BVCNjb21wdXRlSHVtYW5SZWFkYWJsZURpZmYnLCByZXNvdXJjZS50b1N0cmluZyh0cnVlKSwgc3cuZWxhcHNlZCgpKSk7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgY2FuTmF2aWdhdGVWYWx1ZVNldChyZXNvdXJjZTogVVJJKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIChjYW5TeW5jTW9kZWwodGhpcy5fbW9kZWxTZXJ2aWNlLCByZXNvdXJjZSkpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIG5hdmlnYXRlVmFsdWVTZXQocmVzb3VyY2U6IFVSSSwgcmFuZ2U6IElSYW5nZSwgdXA6IGJvb2xlYW4pOiBQcm9taXNlPGxhbmd1YWdlcy5JSW5wbGFjZVJlcGxhY2VTdXBwb3J0UmVzdWx0IHwgbnVsbD4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWxTZXJ2aWNlLmdldE1vZGVsKHJlc291cmNlKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3Qgd29yZERlZlJlZ0V4cCA9IHRoaXMuX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuZ2V0TGFuZ3VhZ2VDb25maWd1cmF0aW9uKG1vZGVsLmdldExhbmd1YWdlSWQoKSkuZ2V0V29yZERlZmluaXRpb24oKTtcblx0XHRjb25zdCB3b3JkRGVmID0gd29yZERlZlJlZ0V4cC5zb3VyY2U7XG5cdFx0Y29uc3Qgd29yZERlZkZsYWdzID0gd29yZERlZlJlZ0V4cC5mbGFncztcblx0XHRjb25zdCB3b3JrZXIgPSBhd2FpdCB0aGlzLl93b3JrZXJXaXRoUmVzb3VyY2VzKFtyZXNvdXJjZV0pO1xuXHRcdHJldHVybiB3b3JrZXIuJG5hdmlnYXRlVmFsdWVTZXQocmVzb3VyY2UudG9TdHJpbmcoKSwgcmFuZ2UsIHVwLCB3b3JkRGVmLCB3b3JkRGVmRmxhZ3MpO1xuXHR9XG5cblx0cHVibGljIGNhbkNvbXB1dGVXb3JkUmFuZ2VzKHJlc291cmNlOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gY2FuU3luY01vZGVsKHRoaXMuX21vZGVsU2VydmljZSwgcmVzb3VyY2UpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGNvbXB1dGVXb3JkUmFuZ2VzKHJlc291cmNlOiBVUkksIHJhbmdlOiBJUmFuZ2UpOiBQcm9taXNlPHsgW3dvcmQ6IHN0cmluZ106IElSYW5nZVtdIH0gfCBudWxsPiB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9tb2RlbFNlcnZpY2UuZ2V0TW9kZWwocmVzb3VyY2UpO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG5cdFx0fVxuXHRcdGNvbnN0IHdvcmREZWZSZWdFeHAgPSB0aGlzLl9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldExhbmd1YWdlQ29uZmlndXJhdGlvbihtb2RlbC5nZXRMYW5ndWFnZUlkKCkpLmdldFdvcmREZWZpbml0aW9uKCk7XG5cdFx0Y29uc3Qgd29yZERlZiA9IHdvcmREZWZSZWdFeHAuc291cmNlO1xuXHRcdGNvbnN0IHdvcmREZWZGbGFncyA9IHdvcmREZWZSZWdFeHAuZmxhZ3M7XG5cdFx0Y29uc3Qgd29ya2VyID0gYXdhaXQgdGhpcy5fd29ya2VyV2l0aFJlc291cmNlcyhbcmVzb3VyY2VdKTtcblx0XHRyZXR1cm4gd29ya2VyLiRjb21wdXRlV29yZFJhbmdlcyhyZXNvdXJjZS50b1N0cmluZygpLCByYW5nZSwgd29yZERlZiwgd29yZERlZkZsYWdzKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBmaW5kU2VjdGlvbkhlYWRlcnModXJpOiBVUkksIG9wdGlvbnM6IEZpbmRTZWN0aW9uSGVhZGVyT3B0aW9ucyk6IFByb21pc2U8U2VjdGlvbkhlYWRlcltdPiB7XG5cdFx0Y29uc3Qgd29ya2VyID0gYXdhaXQgdGhpcy5fd29ya2VyV2l0aFJlc291cmNlcyhbdXJpXSk7XG5cdFx0cmV0dXJuIHdvcmtlci4kZmluZFNlY3Rpb25IZWFkZXJzKHVyaS50b1N0cmluZygpLCBvcHRpb25zKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBjb21wdXRlRGVmYXVsdERvY3VtZW50Q29sb3JzKHVyaTogVVJJKTogUHJvbWlzZTxsYW5ndWFnZXMuSUNvbG9ySW5mb3JtYXRpb25bXSB8IG51bGw+IHtcblx0XHRjb25zdCB3b3JrZXIgPSBhd2FpdCB0aGlzLl93b3JrZXJXaXRoUmVzb3VyY2VzKFt1cmldKTtcblx0XHRyZXR1cm4gd29ya2VyLiRjb21wdXRlRGVmYXVsdERvY3VtZW50Q29sb3JzKHVyaS50b1N0cmluZygpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3dvcmtlcldpdGhSZXNvdXJjZXMocmVzb3VyY2VzOiBVUklbXSwgZm9yY2VMYXJnZU1vZGVsczogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxQcm94aWVkPEVkaXRvcldvcmtlcj4+IHtcblx0XHRjb25zdCB3b3JrZXIgPSBhd2FpdCB0aGlzLl93b3JrZXJNYW5hZ2VyLndpdGhXb3JrZXIoKTtcblx0XHRyZXR1cm4gYXdhaXQgd29ya2VyLndvcmtlcldpdGhTeW5jZWRSZXNvdXJjZXMocmVzb3VyY2VzLCBmb3JjZUxhcmdlTW9kZWxzKTtcblx0fVxufVxuXG5jbGFzcyBXb3JkQmFzZWRDb21wbGV0aW9uSXRlbVByb3ZpZGVyIGltcGxlbWVudHMgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtUHJvdmlkZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3dvcmtlck1hbmFnZXI6IFdvcmtlck1hbmFnZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX21vZGVsU2VydmljZTogSU1vZGVsU2VydmljZTtcblxuXHRyZWFkb25seSBfZGVidWdEaXNwbGF5TmFtZSA9ICd3b3JkYmFzZWRDb21wbGV0aW9ucyc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0d29ya2VyTWFuYWdlcjogV29ya2VyTWFuYWdlcixcblx0XHRjb25maWd1cmF0aW9uU2VydmljZTogSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX3dvcmtlck1hbmFnZXIgPSB3b3JrZXJNYW5hZ2VyO1xuXHRcdHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlID0gY29uZmlndXJhdGlvblNlcnZpY2U7XG5cdFx0dGhpcy5fbW9kZWxTZXJ2aWNlID0gbW9kZWxTZXJ2aWNlO1xuXHR9XG5cblx0YXN5bmMgcHJvdmlkZUNvbXBsZXRpb25JdGVtcyhtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uKTogUHJvbWlzZTxsYW5ndWFnZXMuQ29tcGxldGlvbkxpc3QgfCB1bmRlZmluZWQ+IHtcblx0XHR0eXBlIFdvcmRCYXNlZFN1Z2dlc3Rpb25zQ29uZmlnID0ge1xuXHRcdFx0d29yZEJhc2VkU3VnZ2VzdGlvbnM/OiAnb2ZmJyB8ICdjdXJyZW50RG9jdW1lbnQnIHwgJ21hdGNoaW5nRG9jdW1lbnRzJyB8ICdhbGxEb2N1bWVudHMnO1xuXHRcdH07XG5cdFx0Y29uc3QgY29uZmlnID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8V29yZEJhc2VkU3VnZ2VzdGlvbnNDb25maWc+KG1vZGVsLnVyaSwgcG9zaXRpb24sICdlZGl0b3InKTtcblx0XHRpZiAoY29uZmlnLndvcmRCYXNlZFN1Z2dlc3Rpb25zID09PSAnb2ZmJykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbHM6IFVSSVtdID0gW107XG5cdFx0aWYgKGNvbmZpZy53b3JkQmFzZWRTdWdnZXN0aW9ucyA9PT0gJ2N1cnJlbnREb2N1bWVudCcpIHtcblx0XHRcdC8vIG9ubHkgY3VycmVudCBmaWxlIGFuZCBvbmx5IGlmIG5vdCB0b28gbGFyZ2Vcblx0XHRcdGlmIChjYW5TeW5jTW9kZWwodGhpcy5fbW9kZWxTZXJ2aWNlLCBtb2RlbC51cmkpKSB7XG5cdFx0XHRcdG1vZGVscy5wdXNoKG1vZGVsLnVyaSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGVpdGhlciBhbGwgZmlsZXMgb3IgZmlsZXMgb2Ygc2FtZSBsYW5ndWFnZVxuXHRcdFx0Zm9yIChjb25zdCBjYW5kaWRhdGUgb2YgdGhpcy5fbW9kZWxTZXJ2aWNlLmdldE1vZGVscygpKSB7XG5cdFx0XHRcdGlmICghY2FuU3luY01vZGVsKHRoaXMuX21vZGVsU2VydmljZSwgY2FuZGlkYXRlLnVyaSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoY2FuZGlkYXRlID09PSBtb2RlbCkge1xuXHRcdFx0XHRcdG1vZGVscy51bnNoaWZ0KGNhbmRpZGF0ZS51cmkpO1xuXG5cdFx0XHRcdH0gZWxzZSBpZiAoY29uZmlnLndvcmRCYXNlZFN1Z2dlc3Rpb25zID09PSAnYWxsRG9jdW1lbnRzJyB8fCBjYW5kaWRhdGUuZ2V0TGFuZ3VhZ2VJZCgpID09PSBtb2RlbC5nZXRMYW5ndWFnZUlkKCkpIHtcblx0XHRcdFx0XHRtb2RlbHMucHVzaChjYW5kaWRhdGUudXJpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChtb2RlbHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyBGaWxlIHRvbyBsYXJnZSwgbm8gb3RoZXIgZmlsZXNcblx0XHR9XG5cblx0XHRjb25zdCB3b3JkRGVmUmVnRXhwID0gdGhpcy5sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldExhbmd1YWdlQ29uZmlndXJhdGlvbihtb2RlbC5nZXRMYW5ndWFnZUlkKCkpLmdldFdvcmREZWZpbml0aW9uKCk7XG5cdFx0Y29uc3Qgd29yZCA9IG1vZGVsLmdldFdvcmRBdFBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRjb25zdCByZXBsYWNlID0gIXdvcmQgPyBSYW5nZS5mcm9tUG9zaXRpb25zKHBvc2l0aW9uKSA6IG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCB3b3JkLnN0YXJ0Q29sdW1uLCBwb3NpdGlvbi5saW5lTnVtYmVyLCB3b3JkLmVuZENvbHVtbik7XG5cdFx0Y29uc3QgaW5zZXJ0ID0gcmVwbGFjZS5zZXRFbmRQb3NpdGlvbihwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4pO1xuXG5cdFx0Y29uc3QgY2xpZW50ID0gYXdhaXQgdGhpcy5fd29ya2VyTWFuYWdlci53aXRoV29ya2VyKCk7XG5cdFx0Y29uc3QgZGF0YSA9IGF3YWl0IGNsaWVudC50ZXh0dWFsU3VnZ2VzdChtb2RlbHMsIHdvcmQ/LndvcmQsIHdvcmREZWZSZWdFeHApO1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZHVyYXRpb246IGRhdGEuZHVyYXRpb24sXG5cdFx0XHRzdWdnZXN0aW9uczogZGF0YS53b3Jkcy5tYXAoKHdvcmQpOiBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW0gPT4ge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGtpbmQ6IGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuVGV4dCxcblx0XHRcdFx0XHRsYWJlbDogd29yZCxcblx0XHRcdFx0XHRpbnNlcnRUZXh0OiB3b3JkLFxuXHRcdFx0XHRcdHJhbmdlOiB7IGluc2VydCwgcmVwbGFjZSB9XG5cdFx0XHRcdH07XG5cdFx0XHR9KSxcblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIFdvcmtlck1hbmFnZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2U7XG5cdHByaXZhdGUgX2VkaXRvcldvcmtlckNsaWVudDogRWRpdG9yV29ya2VyQ2xpZW50IHwgbnVsbDtcblx0cHJpdmF0ZSBfbGFzdFdvcmtlclVzZWRUaW1lOiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfd29ya2VyRGVzY3JpcHRvcjogSVdlYldvcmtlckRlc2NyaXB0b3IsXG5cdFx0QElNb2RlbFNlcnZpY2UgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fbW9kZWxTZXJ2aWNlID0gbW9kZWxTZXJ2aWNlO1xuXHRcdHRoaXMuX2VkaXRvcldvcmtlckNsaWVudCA9IG51bGw7XG5cdFx0dGhpcy5fbGFzdFdvcmtlclVzZWRUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcblxuXHRcdGNvbnN0IHN0b3BXb3JrZXJJbnRlcnZhbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBXaW5kb3dJbnRlcnZhbFRpbWVyKCkpO1xuXHRcdHN0b3BXb3JrZXJJbnRlcnZhbC5jYW5jZWxBbmRTZXQoKCkgPT4gdGhpcy5fY2hlY2tTdG9wSWRsZVdvcmtlcigpLCBNYXRoLnJvdW5kKFNUT1BfV09SS0VSX0RFTFRBX1RJTUVfTVMgLyAyKSwgbWFpbldpbmRvdyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9tb2RlbFNlcnZpY2Uub25Nb2RlbFJlbW92ZWQoXyA9PiB0aGlzLl9jaGVja1N0b3BFbXB0eVdvcmtlcigpKSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fZWRpdG9yV29ya2VyQ2xpZW50KSB7XG5cdFx0XHR0aGlzLl9lZGl0b3JXb3JrZXJDbGllbnQuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fZWRpdG9yV29ya2VyQ2xpZW50ID0gbnVsbDtcblx0XHR9XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIHRoZSBtb2RlbCBzZXJ2aWNlIGhhcyBubyBtb3JlIG1vZGVscyBhbmQgc3RvcCB0aGUgd29ya2VyIGlmIHRoYXQgaXMgdGhlIGNhc2UuXG5cdCAqL1xuXHRwcml2YXRlIF9jaGVja1N0b3BFbXB0eVdvcmtlcigpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvcldvcmtlckNsaWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVscyA9IHRoaXMuX21vZGVsU2VydmljZS5nZXRNb2RlbHMoKTtcblx0XHRpZiAobW9kZWxzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Ly8gVGhlcmUgYXJlIG5vIG1vcmUgbW9kZWxzID0+IG5vdGhpbmcgcG9zc2libGUgZm9yIG1lIHRvIGRvXG5cdFx0XHR0aGlzLl9lZGl0b3JXb3JrZXJDbGllbnQuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fZWRpdG9yV29ya2VyQ2xpZW50ID0gbnVsbDtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2hlY2sgaWYgdGhlIHdvcmtlciBoYXMgYmVlbiBpZGxlIGZvciBhIHdoaWxlIGFuZCB0aGVuIHN0b3AgaXQuXG5cdCAqL1xuXHRwcml2YXRlIF9jaGVja1N0b3BJZGxlV29ya2VyKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yV29ya2VyQ2xpZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGltZVNpbmNlTGFzdFdvcmtlclVzZWRUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKSAtIHRoaXMuX2xhc3RXb3JrZXJVc2VkVGltZTtcblx0XHRpZiAodGltZVNpbmNlTGFzdFdvcmtlclVzZWRUaW1lID4gU1RPUF9XT1JLRVJfREVMVEFfVElNRV9NUykge1xuXHRcdFx0dGhpcy5fZWRpdG9yV29ya2VyQ2xpZW50LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX2VkaXRvcldvcmtlckNsaWVudCA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHdpdGhXb3JrZXIoKTogUHJvbWlzZTxFZGl0b3JXb3JrZXJDbGllbnQ+IHtcblx0XHR0aGlzLl9sYXN0V29ya2VyVXNlZFRpbWUgPSAobmV3IERhdGUoKSkuZ2V0VGltZSgpO1xuXHRcdGlmICghdGhpcy5fZWRpdG9yV29ya2VyQ2xpZW50KSB7XG5cdFx0XHR0aGlzLl9lZGl0b3JXb3JrZXJDbGllbnQgPSBuZXcgRWRpdG9yV29ya2VyQ2xpZW50KHRoaXMuX3dvcmtlckRlc2NyaXB0b3IsIGZhbHNlLCB0aGlzLl9tb2RlbFNlcnZpY2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2VkaXRvcldvcmtlckNsaWVudCk7XG5cdH1cbn1cblxuY2xhc3MgU3luY2hyb25vdXNXb3JrZXJDbGllbnQ8VCBleHRlbmRzIElEaXNwb3NhYmxlPiBpbXBsZW1lbnRzIElXZWJXb3JrZXJDbGllbnQ8VD4ge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW5jZTogVDtcblx0cHVibGljIHJlYWRvbmx5IHByb3h5OiBQcm94aWVkPFQ+O1xuXG5cdGNvbnN0cnVjdG9yKGluc3RhbmNlOiBUKSB7XG5cdFx0dGhpcy5faW5zdGFuY2UgPSBpbnN0YW5jZTtcblx0XHR0aGlzLnByb3h5ID0gdGhpcy5faW5zdGFuY2UgYXMgUHJveGllZDxUPjtcblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2luc3RhbmNlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRDaGFubmVsPFQgZXh0ZW5kcyBvYmplY3Q+KGNoYW5uZWw6IHN0cmluZywgaGFuZGxlcjogVCk6IHZvaWQge1xuXHRcdHRocm93IG5ldyBFcnJvcihgTm90IHN1cHBvcnRlZGApO1xuXHR9XG5cblx0cHVibGljIGdldENoYW5uZWw8VCBleHRlbmRzIG9iamVjdD4oY2hhbm5lbDogc3RyaW5nKTogUHJveGllZDxUPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBOb3Qgc3VwcG9ydGVkYCk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRWRpdG9yV29ya2VyQ2xpZW50IHtcblx0ZmhyKG1ldGhvZDogc3RyaW5nLCBhcmdzOiBhbnlbXSk6IFByb21pc2U8YW55Pjtcbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRvcldvcmtlckNsaWVudCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRWRpdG9yV29ya2VyQ2xpZW50IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2tlZXBJZGxlTW9kZWxzOiBib29sZWFuO1xuXHRwcml2YXRlIF93b3JrZXI6IElXZWJXb3JrZXJDbGllbnQ8RWRpdG9yV29ya2VyPiB8IG51bGw7XG5cdHByaXZhdGUgX21vZGVsTWFuYWdlcjogV29ya2VyVGV4dE1vZGVsU3luY0NsaWVudCB8IG51bGw7XG5cdHByaXZhdGUgX2Rpc3Bvc2VkID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfd29ya2VyRGVzY3JpcHRvck9yV29ya2VyOiBJV2ViV29ya2VyRGVzY3JpcHRvciB8IFdvcmtlcixcblx0XHRrZWVwSWRsZU1vZGVsczogYm9vbGVhbixcblx0XHRASU1vZGVsU2VydmljZSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fbW9kZWxTZXJ2aWNlID0gbW9kZWxTZXJ2aWNlO1xuXHRcdHRoaXMuX2tlZXBJZGxlTW9kZWxzID0ga2VlcElkbGVNb2RlbHM7XG5cdFx0dGhpcy5fd29ya2VyID0gbnVsbDtcblx0XHR0aGlzLl9tb2RlbE1hbmFnZXIgPSBudWxsO1xuXHR9XG5cblx0Ly8gZm9yZWlnbiBob3N0IHJlcXVlc3Rcblx0cHVibGljIGZocihtZXRob2Q6IHN0cmluZywgYXJnczogYW55W10pOiBQcm9taXNlPGFueT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcihgTm90IGltcGxlbWVudGVkIWApO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0T3JDcmVhdGVXb3JrZXIoKTogSVdlYldvcmtlckNsaWVudDxFZGl0b3JXb3JrZXI+IHtcblx0XHRpZiAoIXRoaXMuX3dvcmtlcikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5fd29ya2VyID0gdGhpcy5fcmVnaXN0ZXIoY3JlYXRlV2ViV29ya2VyPEVkaXRvcldvcmtlcj4odGhpcy5fd29ya2VyRGVzY3JpcHRvck9yV29ya2VyKSk7XG5cdFx0XHRcdEVkaXRvcldvcmtlckhvc3Quc2V0Q2hhbm5lbCh0aGlzLl93b3JrZXIsIHRoaXMuX2NyZWF0ZUVkaXRvcldvcmtlckhvc3QoKSk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0bG9nT25jZVdlYldvcmtlcldhcm5pbmcoZXJyKTtcblx0XHRcdFx0dGhpcy5fd29ya2VyID0gdGhpcy5fY3JlYXRlRmFsbGJhY2tMb2NhbFdvcmtlcigpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fd29ya2VyO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIF9nZXRQcm94eSgpOiBQcm9taXNlPFByb3hpZWQ8RWRpdG9yV29ya2VyPj4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBwcm94eSA9IHRoaXMuX2dldE9yQ3JlYXRlV29ya2VyKCkucHJveHk7XG5cdFx0XHRhd2FpdCBwcm94eS4kcGluZygpO1xuXHRcdFx0cmV0dXJuIHByb3h5O1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0bG9nT25jZVdlYldvcmtlcldhcm5pbmcoZXJyKTtcblx0XHRcdHRoaXMuX3dvcmtlciA9IHRoaXMuX2NyZWF0ZUZhbGxiYWNrTG9jYWxXb3JrZXIoKTtcblx0XHRcdHJldHVybiB0aGlzLl93b3JrZXIucHJveHk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlRmFsbGJhY2tMb2NhbFdvcmtlcigpOiBTeW5jaHJvbm91c1dvcmtlckNsaWVudDxFZGl0b3JXb3JrZXI+IHtcblx0XHRyZXR1cm4gbmV3IFN5bmNocm9ub3VzV29ya2VyQ2xpZW50KG5ldyBFZGl0b3JXb3JrZXIobnVsbCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlRWRpdG9yV29ya2VySG9zdCgpOiBFZGl0b3JXb3JrZXJIb3N0IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0JGZocjogKG1ldGhvZCwgYXJncykgPT4gdGhpcy5maHIobWV0aG9kLCBhcmdzKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF9nZXRPckNyZWF0ZU1vZGVsTWFuYWdlcihwcm94eTogUHJveGllZDxFZGl0b3JXb3JrZXI+KTogV29ya2VyVGV4dE1vZGVsU3luY0NsaWVudCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbE1hbmFnZXIpIHtcblx0XHRcdHRoaXMuX21vZGVsTWFuYWdlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBXb3JrZXJUZXh0TW9kZWxTeW5jQ2xpZW50KHByb3h5LCB0aGlzLl9tb2RlbFNlcnZpY2UsIHRoaXMuX2tlZXBJZGxlTW9kZWxzKSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tb2RlbE1hbmFnZXI7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgd29ya2VyV2l0aFN5bmNlZFJlc291cmNlcyhyZXNvdXJjZXM6IFVSSVtdLCBmb3JjZUxhcmdlTW9kZWxzOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPFByb3hpZWQ8RWRpdG9yV29ya2VyPj4ge1xuXHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KGNhbmNlbGVkKCkpO1xuXHRcdH1cblx0XHRjb25zdCBwcm94eSA9IGF3YWl0IHRoaXMuX2dldFByb3h5KCk7XG5cdFx0dGhpcy5fZ2V0T3JDcmVhdGVNb2RlbE1hbmFnZXIocHJveHkpLmVuc3VyZVN5bmNlZFJlc291cmNlcyhyZXNvdXJjZXMsIGZvcmNlTGFyZ2VNb2RlbHMpO1xuXHRcdHJldHVybiBwcm94eTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyB0ZXh0dWFsU3VnZ2VzdChyZXNvdXJjZXM6IFVSSVtdLCBsZWFkaW5nV29yZDogc3RyaW5nIHwgdW5kZWZpbmVkLCB3b3JkRGVmUmVnRXhwOiBSZWdFeHApOiBQcm9taXNlPHsgd29yZHM6IHN0cmluZ1tdOyBkdXJhdGlvbjogbnVtYmVyIH0gfCBudWxsPiB7XG5cdFx0Y29uc3QgcHJveHkgPSBhd2FpdCB0aGlzLndvcmtlcldpdGhTeW5jZWRSZXNvdXJjZXMocmVzb3VyY2VzKTtcblx0XHRjb25zdCB3b3JkRGVmID0gd29yZERlZlJlZ0V4cC5zb3VyY2U7XG5cdFx0Y29uc3Qgd29yZERlZkZsYWdzID0gd29yZERlZlJlZ0V4cC5mbGFncztcblx0XHRyZXR1cm4gcHJveHkuJHRleHR1YWxTdWdnZXN0KHJlc291cmNlcy5tYXAociA9PiByLnRvU3RyaW5nKCkpLCBsZWFkaW5nV29yZCwgd29yZERlZiwgd29yZERlZkZsYWdzKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2Rpc3Bvc2VkID0gdHJ1ZTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBK0I7QUFFeEMsU0FBUywrQkFBMEQ7QUFDbkUsU0FBUyx1QkFBNkM7QUFFdEQsU0FBaUIsYUFBYTtBQUU5QixZQUFZLGVBQWU7QUFDM0IsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx5Q0FBeUM7QUFDbEQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxVQUFVLHlCQUF5QjtBQUU1QyxTQUFTLGdDQUFnQztBQUd6QyxTQUFvQyxpQkFBaUI7QUFDckQsU0FBUywwQkFBMEIsY0FBYyx3QkFBd0I7QUFDekUsU0FBUyxpQkFBaUI7QUFFMUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyx3QkFBd0I7QUFLakMsTUFBTSw0QkFBNEIsSUFBSSxLQUFLO0FBRTNDLFNBQVMsYUFBYSxjQUE2QixVQUF3QjtBQUMxRSxRQUFNLFFBQVEsYUFBYSxTQUFTLFFBQVE7QUFDNUMsTUFBSSxDQUFDLE9BQU87QUFDWCxXQUFPO0FBQUEsRUFDUjtBQUNBLE1BQUksTUFBTSxxQkFBcUIsR0FBRztBQUNqQyxXQUFPO0FBQUEsRUFDUjtBQUNBLFNBQU87QUFDUjtBQUVPLElBQWUsc0JBQWYsY0FBMkMsV0FBMkM7QUFBQSxFQVE1RixZQUNDLGtCQUNlLGNBQ29CLHNCQUN0QixZQUNtQywrQkFDdEIseUJBQ3pCO0FBQ0QsVUFBTTtBQUgwQztBQUloRCxTQUFLLGdCQUFnQjtBQUNyQixTQUFLLGlCQUFpQixLQUFLLFVBQVUsSUFBSSxjQUFjLGtCQUFrQixLQUFLLGFBQWEsQ0FBQztBQUM1RixTQUFLLGNBQWM7QUFHbkIsU0FBSyxVQUFVLHdCQUF3QixhQUFhLFNBQVMsRUFBRSxVQUFVLEtBQUssc0JBQXNCLEtBQUssR0FBRztBQUFBLE1BQzNHLGNBQWMsT0FBTyxPQUFPLFVBQVU7QUFDckMsWUFBSSxDQUFDLGFBQWEsS0FBSyxlQUFlLE1BQU0sR0FBRyxHQUFHO0FBQ2pELGlCQUFPLFFBQVEsUUFBUSxFQUFFLE9BQU8sQ0FBQyxFQUFFLENBQUM7QUFBQSxRQUNyQztBQUNBLGNBQU0sU0FBUyxNQUFNLEtBQUsscUJBQXFCLENBQUMsTUFBTSxHQUFHLENBQUM7QUFDMUQsY0FBTSxRQUFRLE1BQU0sT0FBTyxjQUFjLE1BQU0sSUFBSSxTQUFTLENBQUM7QUFDN0QsZUFBTyxTQUFTLEVBQUUsTUFBTTtBQUFBLE1BQ3pCO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFDRixTQUFLLFVBQVUsd0JBQXdCLG1CQUFtQixTQUFTLEtBQUssSUFBSSxnQ0FBZ0MsS0FBSyxnQkFBZ0Isc0JBQXNCLEtBQUssZUFBZSxLQUFLLDZCQUE2QixDQUFDLENBQUM7QUFBQSxFQUNoTjtBQUFBLEVBRWdCLFVBQWdCO0FBQy9CLFVBQU0sUUFBUTtBQUFBLEVBQ2Y7QUFBQSxFQUVPLDRCQUE0QixLQUFtQjtBQUNyRCxXQUFPLGFBQWEsS0FBSyxlQUFlLEdBQUc7QUFBQSxFQUM1QztBQUFBLEVBRUEsTUFBYSwwQkFBMEIsS0FBVSxTQUFvQyxPQUFtRDtBQUN2SSxVQUFNLFNBQVMsTUFBTSxLQUFLLHFCQUFxQixDQUFDLEdBQUcsQ0FBQztBQUNwRCxXQUFPLE9BQU8sMEJBQTBCLElBQUksU0FBUyxHQUFHLFNBQVMsS0FBSztBQUFBLEVBQ3ZFO0FBQUEsRUFFQSxNQUFhLFlBQVksVUFBZSxVQUFlLFNBQXVDLFdBQTZEO0FBQzFKLFVBQU0sU0FBUyxNQUFNLEtBQUs7QUFBQSxNQUFxQixDQUFDLFVBQVUsUUFBUTtBQUFBO0FBQUEsTUFBeUI7QUFBQSxJQUFJO0FBQy9GLFVBQU0sU0FBUyxNQUFNLE9BQU8sYUFBYSxTQUFTLFNBQVMsR0FBRyxTQUFTLFNBQVMsR0FBRyxTQUFTLFNBQVM7QUFDckcsUUFBSSxDQUFDLFFBQVE7QUFDWixhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sT0FBc0I7QUFBQSxNQUMzQixXQUFXLE9BQU87QUFBQSxNQUNsQixXQUFXLE9BQU87QUFBQSxNQUNsQixTQUFTLG9CQUFvQixPQUFPLE9BQU87QUFBQSxNQUMzQyxPQUFPLE9BQU8sTUFBTSxJQUFJLE9BQUssSUFBSTtBQUFBLFFBQ2hDLElBQUksaUJBQWlCLElBQUksVUFBVSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksVUFBVSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQUEsUUFDekUsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUFBLElBQ0Y7QUFDQSxXQUFPO0FBRVAsYUFBUyxvQkFBb0IsU0FBc0U7QUFDbEcsYUFBTyxRQUFRO0FBQUEsUUFDZCxDQUFDLE1BQU0sSUFBSTtBQUFBLFVBQ1YsSUFBSSxVQUFVLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBQUEsVUFDeEIsSUFBSSxVQUFVLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBQUEsVUFDeEIsRUFBRSxDQUFDLEdBQUc7QUFBQSxZQUNMLENBQUNBLE9BQU0sSUFBSTtBQUFBLGNBQ1YsSUFBSSxNQUFNQSxHQUFFLENBQUMsR0FBR0EsR0FBRSxDQUFDLEdBQUdBLEdBQUUsQ0FBQyxHQUFHQSxHQUFFLENBQUMsQ0FBQztBQUFBLGNBQ2hDLElBQUksTUFBTUEsR0FBRSxDQUFDLEdBQUdBLEdBQUUsQ0FBQyxHQUFHQSxHQUFFLENBQUMsR0FBR0EsR0FBRSxDQUFDLENBQUM7QUFBQSxZQUNqQztBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFTyxvQkFBb0IsVUFBZSxVQUF3QjtBQUNqRSxXQUFRLGFBQWEsS0FBSyxlQUFlLFFBQVEsS0FBSyxhQUFhLEtBQUssZUFBZSxRQUFRO0FBQUEsRUFDaEc7QUFBQSxFQUVBLE1BQWEsaUJBQWlCLFVBQWUsVUFBZSxzQkFBMEQ7QUFDckgsVUFBTSxTQUFTLE1BQU0sS0FBSyxxQkFBcUIsQ0FBQyxVQUFVLFFBQVEsQ0FBQztBQUNuRSxXQUFPLE9BQU8sa0JBQWtCLFNBQVMsU0FBUyxHQUFHLFNBQVMsU0FBUyxHQUFHLG9CQUFvQjtBQUFBLEVBQy9GO0FBQUEsRUFFQSxNQUFhLHdCQUF3QixVQUFlLE9BQWdELFNBQWtCLE9BQWtEO0FBQ3ZLLFFBQUksZ0JBQWdCLEtBQUssR0FBRztBQUMzQixVQUFJLENBQUMsYUFBYSxLQUFLLGVBQWUsUUFBUSxHQUFHO0FBQ2hELGVBQU8sUUFBUSxRQUFRLEtBQUs7QUFBQSxNQUM3QjtBQUNBLFlBQU0sS0FBSyxVQUFVLE9BQU87QUFDNUIsWUFBTSxTQUFTLEtBQUsscUJBQXFCLENBQUMsUUFBUSxDQUFDLEVBQUUsS0FBSyxZQUFVLE9BQU8seUJBQXlCLFNBQVMsU0FBUyxHQUFHLE9BQU8sTUFBTSxDQUFDO0FBQ3ZJLGFBQU8sUUFBUSxNQUFNLEtBQUssWUFBWSxNQUFNLGtDQUFrQyxTQUFTLFNBQVMsSUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLENBQUM7QUFDcEgsYUFBTyxRQUFRLEtBQUssQ0FBQyxRQUFRLFFBQVEsR0FBSSxFQUFFLEtBQUssTUFBTSxLQUFLLENBQUMsQ0FBQztBQUFBLElBRTlELE9BQU87QUFDTixhQUFPLFFBQVEsUUFBUSxNQUFTO0FBQUEsSUFDakM7QUFBQSxFQUNEO0FBQUEsRUFFTyx5QkFBeUIsVUFBZSxPQUEyRjtBQUN6SSxRQUFJLGdCQUFnQixLQUFLLEdBQUc7QUFDM0IsVUFBSSxDQUFDLGFBQWEsS0FBSyxlQUFlLFFBQVEsR0FBRztBQUNoRCxlQUFPLFFBQVEsUUFBUSxLQUFLO0FBQUEsTUFDN0I7QUFDQSxZQUFNLEtBQUssVUFBVSxPQUFPO0FBQzVCLFlBQU0sT0FBa0MsRUFBRSxzQkFBc0IsT0FBTyxzQkFBc0IsS0FBTSxjQUFjLE1BQU07QUFDdkgsWUFBTSxTQUNMLEtBQUsscUJBQXFCLENBQUMsUUFBUSxDQUFDLEVBQ2xDLEtBQUssWUFBVSxPQUFPLDBCQUEwQixTQUFTLFNBQVMsR0FBRyxPQUFPLElBQUksQ0FBQyxFQUNqRixNQUFNLENBQUMsUUFBUTtBQUNmLDBCQUFrQixHQUFHO0FBRXJCLGVBQU8sS0FBSyx3QkFBd0IsVUFBVSxPQUFPLElBQUk7QUFBQSxNQUMxRCxDQUFDO0FBRUgsYUFBTyxRQUFRLE1BQU0sS0FBSyxZQUFZLE1BQU0sbUNBQW1DLFNBQVMsU0FBUyxJQUFJLEdBQUcsR0FBRyxRQUFRLENBQUMsQ0FBQztBQUNySCxhQUFPO0FBQUEsSUFFUixPQUFPO0FBQ04sYUFBTyxRQUFRLFFBQVEsTUFBUztBQUFBLElBQ2pDO0FBQUEsRUFDRDtBQUFBLEVBRU8sb0JBQW9CLFVBQXdCO0FBQ2xELFdBQVEsYUFBYSxLQUFLLGVBQWUsUUFBUTtBQUFBLEVBQ2xEO0FBQUEsRUFFQSxNQUFhLGlCQUFpQixVQUFlLE9BQWUsSUFBcUU7QUFDaEksVUFBTSxRQUFRLEtBQUssY0FBYyxTQUFTLFFBQVE7QUFDbEQsUUFBSSxDQUFDLE9BQU87QUFDWCxhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sZ0JBQWdCLEtBQUssOEJBQThCLHlCQUF5QixNQUFNLGNBQWMsQ0FBQyxFQUFFLGtCQUFrQjtBQUMzSCxVQUFNLFVBQVUsY0FBYztBQUM5QixVQUFNLGVBQWUsY0FBYztBQUNuQyxVQUFNLFNBQVMsTUFBTSxLQUFLLHFCQUFxQixDQUFDLFFBQVEsQ0FBQztBQUN6RCxXQUFPLE9BQU8sa0JBQWtCLFNBQVMsU0FBUyxHQUFHLE9BQU8sSUFBSSxTQUFTLFlBQVk7QUFBQSxFQUN0RjtBQUFBLEVBRU8scUJBQXFCLFVBQXdCO0FBQ25ELFdBQU8sYUFBYSxLQUFLLGVBQWUsUUFBUTtBQUFBLEVBQ2pEO0FBQUEsRUFFQSxNQUFhLGtCQUFrQixVQUFlLE9BQTZEO0FBQzFHLFVBQU0sUUFBUSxLQUFLLGNBQWMsU0FBUyxRQUFRO0FBQ2xELFFBQUksQ0FBQyxPQUFPO0FBQ1gsYUFBTyxRQUFRLFFBQVEsSUFBSTtBQUFBLElBQzVCO0FBQ0EsVUFBTSxnQkFBZ0IsS0FBSyw4QkFBOEIseUJBQXlCLE1BQU0sY0FBYyxDQUFDLEVBQUUsa0JBQWtCO0FBQzNILFVBQU0sVUFBVSxjQUFjO0FBQzlCLFVBQU0sZUFBZSxjQUFjO0FBQ25DLFVBQU0sU0FBUyxNQUFNLEtBQUsscUJBQXFCLENBQUMsUUFBUSxDQUFDO0FBQ3pELFdBQU8sT0FBTyxtQkFBbUIsU0FBUyxTQUFTLEdBQUcsT0FBTyxTQUFTLFlBQVk7QUFBQSxFQUNuRjtBQUFBLEVBRUEsTUFBYSxtQkFBbUIsS0FBVSxTQUE2RDtBQUN0RyxVQUFNLFNBQVMsTUFBTSxLQUFLLHFCQUFxQixDQUFDLEdBQUcsQ0FBQztBQUNwRCxXQUFPLE9BQU8sb0JBQW9CLElBQUksU0FBUyxHQUFHLE9BQU87QUFBQSxFQUMxRDtBQUFBLEVBRUEsTUFBYSw2QkFBNkIsS0FBeUQ7QUFDbEcsVUFBTSxTQUFTLE1BQU0sS0FBSyxxQkFBcUIsQ0FBQyxHQUFHLENBQUM7QUFDcEQsV0FBTyxPQUFPLDhCQUE4QixJQUFJLFNBQVMsQ0FBQztBQUFBLEVBQzNEO0FBQUEsRUFFQSxNQUFjLHFCQUFxQixXQUFrQixtQkFBNEIsT0FBdUM7QUFDdkgsVUFBTSxTQUFTLE1BQU0sS0FBSyxlQUFlLFdBQVc7QUFDcEQsV0FBTyxNQUFNLE9BQU8sMEJBQTBCLFdBQVcsZ0JBQWdCO0FBQUEsRUFDMUU7QUFDRDtBQWhMc0Isc0JBQWY7QUFBQSxFQVVKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBZG1CO0FBa0x0QixNQUFNLGdDQUE0RTtBQUFBLEVBUWpGLFlBQ0MsZUFDQSxzQkFDQSxjQUNpQiw4QkFDaEI7QUFEZ0I7QUFObEIsU0FBUyxvQkFBb0I7QUFRNUIsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSyx3QkFBd0I7QUFDN0IsU0FBSyxnQkFBZ0I7QUFBQSxFQUN0QjtBQUFBLEVBRUEsTUFBTSx1QkFBdUIsT0FBbUIsVUFBbUU7QUFJbEgsVUFBTSxTQUFTLEtBQUssc0JBQXNCLFNBQXFDLE1BQU0sS0FBSyxVQUFVLFFBQVE7QUFDNUcsUUFBSSxPQUFPLHlCQUF5QixPQUFPO0FBQzFDLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxTQUFnQixDQUFDO0FBQ3ZCLFFBQUksT0FBTyx5QkFBeUIsbUJBQW1CO0FBRXRELFVBQUksYUFBYSxLQUFLLGVBQWUsTUFBTSxHQUFHLEdBQUc7QUFDaEQsZUFBTyxLQUFLLE1BQU0sR0FBRztBQUFBLE1BQ3RCO0FBQUEsSUFDRCxPQUFPO0FBRU4saUJBQVcsYUFBYSxLQUFLLGNBQWMsVUFBVSxHQUFHO0FBQ3ZELFlBQUksQ0FBQyxhQUFhLEtBQUssZUFBZSxVQUFVLEdBQUcsR0FBRztBQUNyRDtBQUFBLFFBQ0Q7QUFDQSxZQUFJLGNBQWMsT0FBTztBQUN4QixpQkFBTyxRQUFRLFVBQVUsR0FBRztBQUFBLFFBRTdCLFdBQVcsT0FBTyx5QkFBeUIsa0JBQWtCLFVBQVUsY0FBYyxNQUFNLE1BQU0sY0FBYyxHQUFHO0FBQ2pILGlCQUFPLEtBQUssVUFBVSxHQUFHO0FBQUEsUUFDMUI7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFFBQUksT0FBTyxXQUFXLEdBQUc7QUFDeEIsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLGdCQUFnQixLQUFLLDZCQUE2Qix5QkFBeUIsTUFBTSxjQUFjLENBQUMsRUFBRSxrQkFBa0I7QUFDMUgsVUFBTSxPQUFPLE1BQU0sa0JBQWtCLFFBQVE7QUFDN0MsVUFBTSxVQUFVLENBQUMsT0FBTyxNQUFNLGNBQWMsUUFBUSxJQUFJLElBQUksTUFBTSxTQUFTLFlBQVksS0FBSyxhQUFhLFNBQVMsWUFBWSxLQUFLLFNBQVM7QUFDNUksVUFBTSxTQUFTLFFBQVEsZUFBZSxTQUFTLFlBQVksU0FBUyxNQUFNO0FBRTFFLFVBQU0sU0FBUyxNQUFNLEtBQUssZUFBZSxXQUFXO0FBQ3BELFVBQU0sT0FBTyxNQUFNLE9BQU8sZUFBZSxRQUFRLE1BQU0sTUFBTSxhQUFhO0FBQzFFLFFBQUksQ0FBQyxNQUFNO0FBQ1YsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPO0FBQUEsTUFDTixVQUFVLEtBQUs7QUFBQSxNQUNmLGFBQWEsS0FBSyxNQUFNLElBQUksQ0FBQ0MsVUFBbUM7QUFDL0QsZUFBTztBQUFBLFVBQ04sTUFBTSxVQUFVLG1CQUFtQjtBQUFBLFVBQ25DLE9BQU9BO0FBQUEsVUFDUCxZQUFZQTtBQUFBLFVBQ1osT0FBTyxFQUFFLFFBQVEsUUFBUTtBQUFBLFFBQzFCO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFDRDtBQUVBLElBQU0sZ0JBQU4sY0FBNEIsV0FBVztBQUFBLEVBTXRDLFlBQ2tCLG1CQUNGLGNBQ2Q7QUFDRCxVQUFNO0FBSFc7QUFJakIsU0FBSyxnQkFBZ0I7QUFDckIsU0FBSyxzQkFBc0I7QUFDM0IsU0FBSyx1QkFBdUIsb0JBQUksS0FBSyxHQUFHLFFBQVE7QUFFaEQsVUFBTSxxQkFBcUIsS0FBSyxVQUFVLElBQUksb0JBQW9CLENBQUM7QUFDbkUsdUJBQW1CLGFBQWEsTUFBTSxLQUFLLHFCQUFxQixHQUFHLEtBQUssTUFBTSw0QkFBNEIsQ0FBQyxHQUFHLFVBQVU7QUFFeEgsU0FBSyxVQUFVLEtBQUssY0FBYyxlQUFlLE9BQUssS0FBSyxzQkFBc0IsQ0FBQyxDQUFDO0FBQUEsRUFDcEY7QUFBQSxFQUVnQixVQUFnQjtBQUMvQixRQUFJLEtBQUsscUJBQXFCO0FBQzdCLFdBQUssb0JBQW9CLFFBQVE7QUFDakMsV0FBSyxzQkFBc0I7QUFBQSxJQUM1QjtBQUNBLFVBQU0sUUFBUTtBQUFBLEVBQ2Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtRLHdCQUE4QjtBQUNyQyxRQUFJLENBQUMsS0FBSyxxQkFBcUI7QUFDOUI7QUFBQSxJQUNEO0FBRUEsVUFBTSxTQUFTLEtBQUssY0FBYyxVQUFVO0FBQzVDLFFBQUksT0FBTyxXQUFXLEdBQUc7QUFFeEIsV0FBSyxvQkFBb0IsUUFBUTtBQUNqQyxXQUFLLHNCQUFzQjtBQUFBLElBQzVCO0FBQUEsRUFDRDtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS1EsdUJBQTZCO0FBQ3BDLFFBQUksQ0FBQyxLQUFLLHFCQUFxQjtBQUM5QjtBQUFBLElBQ0Q7QUFFQSxVQUFNLCtCQUErQixvQkFBSSxLQUFLLEdBQUcsUUFBUSxJQUFJLEtBQUs7QUFDbEUsUUFBSSw4QkFBOEIsMkJBQTJCO0FBQzVELFdBQUssb0JBQW9CLFFBQVE7QUFDakMsV0FBSyxzQkFBc0I7QUFBQSxJQUM1QjtBQUFBLEVBQ0Q7QUFBQSxFQUVPLGFBQTBDO0FBQ2hELFNBQUssdUJBQXVCLG9CQUFJLEtBQUssR0FBRyxRQUFRO0FBQ2hELFFBQUksQ0FBQyxLQUFLLHFCQUFxQjtBQUM5QixXQUFLLHNCQUFzQixJQUFJLG1CQUFtQixLQUFLLG1CQUFtQixPQUFPLEtBQUssYUFBYTtBQUFBLElBQ3BHO0FBQ0EsV0FBTyxRQUFRLFFBQVEsS0FBSyxtQkFBbUI7QUFBQSxFQUNoRDtBQUNEO0FBbkVNLGdCQUFOO0FBQUEsRUFRRztBQUFBLEdBUkc7QUFxRU4sTUFBTSx3QkFBOEU7QUFBQSxFQUluRixZQUFZLFVBQWE7QUFDeEIsU0FBSyxZQUFZO0FBQ2pCLFNBQUssUUFBUSxLQUFLO0FBQUEsRUFDbkI7QUFBQSxFQUVPLFVBQWdCO0FBQ3RCLFNBQUssVUFBVSxRQUFRO0FBQUEsRUFDeEI7QUFBQSxFQUVPLFdBQTZCLFNBQWlCLFNBQWtCO0FBQ3RFLFVBQU0sSUFBSSxNQUFNLGVBQWU7QUFBQSxFQUNoQztBQUFBLEVBRU8sV0FBNkIsU0FBNkI7QUFDaEUsVUFBTSxJQUFJLE1BQU0sZUFBZTtBQUFBLEVBQ2hDO0FBQ0Q7QUFNTyxJQUFNLHFCQUFOLGNBQWlDLFdBQTBDO0FBQUEsRUFRakYsWUFDa0IsMkJBQ2pCLGdCQUNlLGNBQ2Q7QUFDRCxVQUFNO0FBSlc7QUFIbEIsU0FBUSxZQUFZO0FBUW5CLFNBQUssZ0JBQWdCO0FBQ3JCLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssVUFBVTtBQUNmLFNBQUssZ0JBQWdCO0FBQUEsRUFDdEI7QUFBQTtBQUFBLEVBR08sSUFBSSxRQUFnQixNQUEyQjtBQUNyRCxVQUFNLElBQUksTUFBTSxrQkFBa0I7QUFBQSxFQUNuQztBQUFBLEVBRVEscUJBQXFEO0FBQzVELFFBQUksQ0FBQyxLQUFLLFNBQVM7QUFDbEIsVUFBSTtBQUNILGFBQUssVUFBVSxLQUFLLFVBQVUsZ0JBQThCLEtBQUsseUJBQXlCLENBQUM7QUFDM0YseUJBQWlCLFdBQVcsS0FBSyxTQUFTLEtBQUssd0JBQXdCLENBQUM7QUFBQSxNQUN6RSxTQUFTLEtBQUs7QUFDYixnQ0FBd0IsR0FBRztBQUMzQixhQUFLLFVBQVUsS0FBSywyQkFBMkI7QUFBQSxNQUNoRDtBQUFBLElBQ0Q7QUFDQSxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxNQUFnQixZQUE0QztBQUMzRCxRQUFJO0FBQ0gsWUFBTSxRQUFRLEtBQUssbUJBQW1CLEVBQUU7QUFDeEMsWUFBTSxNQUFNLE1BQU07QUFDbEIsYUFBTztBQUFBLElBQ1IsU0FBUyxLQUFLO0FBQ2IsOEJBQXdCLEdBQUc7QUFDM0IsV0FBSyxVQUFVLEtBQUssMkJBQTJCO0FBQy9DLGFBQU8sS0FBSyxRQUFRO0FBQUEsSUFDckI7QUFBQSxFQUNEO0FBQUEsRUFFUSw2QkFBb0U7QUFDM0UsV0FBTyxJQUFJLHdCQUF3QixJQUFJLGFBQWEsSUFBSSxDQUFDO0FBQUEsRUFDMUQ7QUFBQSxFQUVRLDBCQUE0QztBQUNuRCxXQUFPO0FBQUEsTUFDTixNQUFNLENBQUMsUUFBUSxTQUFTLEtBQUssSUFBSSxRQUFRLElBQUk7QUFBQSxJQUM5QztBQUFBLEVBQ0Q7QUFBQSxFQUVRLHlCQUF5QixPQUF5RDtBQUN6RixRQUFJLENBQUMsS0FBSyxlQUFlO0FBQ3hCLFdBQUssZ0JBQWdCLEtBQUssVUFBVSxJQUFJLDBCQUEwQixPQUFPLEtBQUssZUFBZSxLQUFLLGVBQWUsQ0FBQztBQUFBLElBQ25IO0FBQ0EsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsTUFBYSwwQkFBMEIsV0FBa0IsbUJBQTRCLE9BQXVDO0FBQzNILFFBQUksS0FBSyxXQUFXO0FBQ25CLGFBQU8sUUFBUSxPQUFPLFNBQVMsQ0FBQztBQUFBLElBQ2pDO0FBQ0EsVUFBTSxRQUFRLE1BQU0sS0FBSyxVQUFVO0FBQ25DLFNBQUsseUJBQXlCLEtBQUssRUFBRSxzQkFBc0IsV0FBVyxnQkFBZ0I7QUFDdEYsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWEsZUFBZSxXQUFrQixhQUFpQyxlQUE4RTtBQUM1SixVQUFNLFFBQVEsTUFBTSxLQUFLLDBCQUEwQixTQUFTO0FBQzVELFVBQU0sVUFBVSxjQUFjO0FBQzlCLFVBQU0sZUFBZSxjQUFjO0FBQ25DLFdBQU8sTUFBTSxnQkFBZ0IsVUFBVSxJQUFJLE9BQUssRUFBRSxTQUFTLENBQUMsR0FBRyxhQUFhLFNBQVMsWUFBWTtBQUFBLEVBQ2xHO0FBQUEsRUFFUyxVQUFnQjtBQUN4QixVQUFNLFFBQVE7QUFDZCxTQUFLLFlBQVk7QUFBQSxFQUNsQjtBQUNEO0FBdkZhLHFCQUFOO0FBQUEsRUFXSjtBQUFBLEdBWFU7IiwKICAibmFtZXMiOiBbImMiLCAid29yZCJdCn0K
