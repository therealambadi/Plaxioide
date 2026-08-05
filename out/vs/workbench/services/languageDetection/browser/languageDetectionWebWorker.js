import { importAMDNodeModule } from "../../../../amdX.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { LanguageDetectionWorkerHost } from "./languageDetectionWorker.protocol.js";
import { WorkerTextModelSyncServer } from "../../../../editor/common/services/textModelSync/textModelSync.impl.js";
function create(workerServer) {
  return new LanguageDetectionWorker(workerServer);
}
const _LanguageDetectionWorker = class _LanguageDetectionWorker {
  constructor(workerServer) {
    this._workerTextModelSyncServer = new WorkerTextModelSyncServer();
    this._regexpLoadFailed = false;
    this._loadFailed = false;
    this.modelIdToCoreId = /* @__PURE__ */ new Map();
    this._host = LanguageDetectionWorkerHost.getChannel(workerServer);
    this._workerTextModelSyncServer.bindToServer(workerServer);
  }
  async $detectLanguage(uri, langBiases, preferHistory, supportedLangs) {
    const languages = [];
    const confidences = [];
    const stopWatch = new StopWatch();
    const documentTextSample = this.getTextForDetection(uri);
    if (!documentTextSample) {
      return;
    }
    const neuralResolver = async () => {
      for await (const language of this.detectLanguagesImpl(documentTextSample)) {
        if (!this.modelIdToCoreId.has(language.languageId)) {
          this.modelIdToCoreId.set(language.languageId, await this._host.$getLanguageId(language.languageId));
        }
        const coreId = this.modelIdToCoreId.get(language.languageId);
        if (coreId && (!supportedLangs?.length || supportedLangs.includes(coreId))) {
          languages.push(coreId);
          confidences.push(language.confidence);
        }
      }
      stopWatch.stop();
      if (languages.length) {
        this._host.$sendTelemetryEvent(languages, confidences, stopWatch.elapsed());
        return languages[0];
      }
      return void 0;
    };
    const historicalResolver = async () => this.runRegexpModel(documentTextSample, langBiases ?? {}, supportedLangs);
    if (preferHistory) {
      const history = await historicalResolver();
      if (history) {
        return history;
      }
      const neural = await neuralResolver();
      if (neural) {
        return neural;
      }
    } else {
      const neural = await neuralResolver();
      if (neural) {
        return neural;
      }
      const history = await historicalResolver();
      if (history) {
        return history;
      }
    }
    return void 0;
  }
  getTextForDetection(uri) {
    const editorModel = this._workerTextModelSyncServer.getModel(uri);
    if (!editorModel) {
      return;
    }
    const end = editorModel.positionAt(1e4);
    const content = editorModel.getValueInRange({
      startColumn: 1,
      startLineNumber: 1,
      endColumn: end.column,
      endLineNumber: end.lineNumber
    });
    return content;
  }
  async getRegexpModel() {
    if (this._regexpLoadFailed) {
      return;
    }
    if (this._regexpModel) {
      return this._regexpModel;
    }
    const uri = await this._host.$getRegexpModelUri();
    try {
      this._regexpModel = await importAMDNodeModule(uri, "");
      return this._regexpModel;
    } catch (e) {
      this._regexpLoadFailed = true;
      return;
    }
  }
  async runRegexpModel(content, langBiases, supportedLangs) {
    const regexpModel = await this.getRegexpModel();
    if (!regexpModel) {
      return;
    }
    if (supportedLangs?.length) {
      for (const lang of Object.keys(langBiases)) {
        if (supportedLangs.includes(lang)) {
          langBiases[lang] = 1;
        } else {
          langBiases[lang] = 0;
        }
      }
    }
    const detected = regexpModel.detect(content, langBiases, supportedLangs);
    return detected;
  }
  async getModelOperations() {
    if (this._modelOperations) {
      return this._modelOperations;
    }
    const uri = await this._host.$getIndexJsUri();
    const { ModelOperations } = await importAMDNodeModule(uri, "");
    this._modelOperations = new ModelOperations({
      modelJsonLoaderFunc: async () => {
        const response = await fetch(await this._host.$getModelJsonUri());
        try {
          const modelJSON = await response.json();
          return modelJSON;
        } catch (e) {
          const message = `Failed to parse model JSON.`;
          throw new Error(message);
        }
      },
      weightsLoaderFunc: async () => {
        const response = await fetch(await this._host.$getWeightsUri());
        const buffer = await response.arrayBuffer();
        return buffer;
      }
    });
    return this._modelOperations;
  }
  // This adjusts the language confidence scores to be more accurate based on:
  // * VS Code's language usage
  // * Languages with 'problematic' syntaxes that have caused incorrect language detection
  adjustLanguageConfidence(modelResult) {
    switch (modelResult.languageId) {
      // For the following languages, we increase the confidence because
      // these are commonly used languages in VS Code and supported
      // by the model.
      case "js":
      case "html":
      case "json":
      case "ts":
      case "css":
      case "py":
      case "xml":
      case "php":
        modelResult.confidence += _LanguageDetectionWorker.positiveConfidenceCorrectionBucket1;
        break;
      // case 'yaml': // YAML has been know to cause incorrect language detection because the language is pretty simple. We don't want to increase the confidence for this.
      case "cpp":
      case "sh":
      case "java":
      case "cs":
      case "c":
        modelResult.confidence += _LanguageDetectionWorker.positiveConfidenceCorrectionBucket2;
        break;
      // For the following languages, we need to be extra confident that the language is correct because
      // we've had issues like #131912 that caused incorrect guesses. To enforce this, we subtract the
      // negativeConfidenceCorrection from the confidence.
      // languages that are provided by default in VS Code
      case "bat":
      case "ini":
      case "makefile":
      case "sql":
      // languages that aren't provided by default in VS Code
      case "csv":
      case "toml":
        modelResult.confidence -= _LanguageDetectionWorker.negativeConfidenceCorrection;
        break;
      default:
        break;
    }
    return modelResult;
  }
  async *detectLanguagesImpl(content) {
    if (this._loadFailed) {
      return;
    }
    let modelOperations;
    try {
      modelOperations = await this.getModelOperations();
    } catch (e) {
      console.log(e);
      this._loadFailed = true;
      return;
    }
    let modelResults;
    try {
      modelResults = await modelOperations.runModel(content);
    } catch (e) {
      console.warn(e);
    }
    if (!modelResults || modelResults.length === 0 || modelResults[0].confidence < _LanguageDetectionWorker.expectedRelativeConfidence) {
      return;
    }
    const firstModelResult = this.adjustLanguageConfidence(modelResults[0]);
    if (firstModelResult.confidence < _LanguageDetectionWorker.expectedRelativeConfidence) {
      return;
    }
    const possibleLanguages = [firstModelResult];
    for (let current of modelResults) {
      if (current === firstModelResult) {
        continue;
      }
      current = this.adjustLanguageConfidence(current);
      const currentHighest = possibleLanguages[possibleLanguages.length - 1];
      if (currentHighest.confidence - current.confidence >= _LanguageDetectionWorker.expectedRelativeConfidence) {
        while (possibleLanguages.length) {
          yield possibleLanguages.shift();
        }
        if (current.confidence > _LanguageDetectionWorker.expectedRelativeConfidence) {
          possibleLanguages.push(current);
          continue;
        }
        return;
      } else {
        if (current.confidence > _LanguageDetectionWorker.expectedRelativeConfidence) {
          possibleLanguages.push(current);
          continue;
        }
        return;
      }
    }
  }
};
_LanguageDetectionWorker.expectedRelativeConfidence = 0.2;
_LanguageDetectionWorker.positiveConfidenceCorrectionBucket1 = 0.05;
_LanguageDetectionWorker.positiveConfidenceCorrectionBucket2 = 0.025;
_LanguageDetectionWorker.negativeConfidenceCorrection = 0.5;
let LanguageDetectionWorker = _LanguageDetectionWorker;
export {
  LanguageDetectionWorker,
  create
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvbGFuZ3VhZ2VEZXRlY3Rpb24vYnJvd3Nlci9sYW5ndWFnZURldGVjdGlvbldlYldvcmtlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB0eXBlIHsgTW9kZWxPcGVyYXRpb25zLCBNb2RlbFJlc3VsdCB9IGZyb20gJ0B2c2NvZGUvdnNjb2RlLWxhbmd1YWdlZGV0ZWN0aW9uJztcbmltcG9ydCB7IGltcG9ydEFNRE5vZGVNb2R1bGUgfSBmcm9tICcuLi8uLi8uLi8uLi9hbWRYLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBJV2ViV29ya2VyU2VydmVyUmVxdWVzdEhhbmRsZXIsIElXZWJXb3JrZXJTZXJ2ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi93b3JrZXIvd2ViV29ya2VyLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRGV0ZWN0aW9uV29ya2VySG9zdCwgSUxhbmd1YWdlRGV0ZWN0aW9uV29ya2VyIH0gZnJvbSAnLi9sYW5ndWFnZURldGVjdGlvbldvcmtlci5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBXb3JrZXJUZXh0TW9kZWxTeW5jU2VydmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90ZXh0TW9kZWxTeW5jL3RleHRNb2RlbFN5bmMuaW1wbC5qcyc7XG5cbnR5cGUgUmVnZXhwTW9kZWwgPSB7IGRldGVjdDogKGlucDogc3RyaW5nLCBsYW5nQmlhc2VzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+LCBzdXBwb3J0ZWRMYW5ncz86IHN0cmluZ1tdKSA9PiBzdHJpbmcgfCB1bmRlZmluZWQgfTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZSh3b3JrZXJTZXJ2ZXI6IElXZWJXb3JrZXJTZXJ2ZXIpOiBJV2ViV29ya2VyU2VydmVyUmVxdWVzdEhhbmRsZXIge1xuXHRyZXR1cm4gbmV3IExhbmd1YWdlRGV0ZWN0aW9uV29ya2VyKHdvcmtlclNlcnZlcik7XG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCBjbGFzcyBMYW5ndWFnZURldGVjdGlvbldvcmtlciBpbXBsZW1lbnRzIElMYW5ndWFnZURldGVjdGlvbldvcmtlciB7XG5cdF9yZXF1ZXN0SGFuZGxlckJyYW5kOiBhbnk7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgZXhwZWN0ZWRSZWxhdGl2ZUNvbmZpZGVuY2UgPSAwLjI7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IHBvc2l0aXZlQ29uZmlkZW5jZUNvcnJlY3Rpb25CdWNrZXQxID0gMC4wNTtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgcG9zaXRpdmVDb25maWRlbmNlQ29ycmVjdGlvbkJ1Y2tldDIgPSAwLjAyNTtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgbmVnYXRpdmVDb25maWRlbmNlQ29ycmVjdGlvbiA9IDAuNTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF93b3JrZXJUZXh0TW9kZWxTeW5jU2VydmVyID0gbmV3IFdvcmtlclRleHRNb2RlbFN5bmNTZXJ2ZXIoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9ob3N0OiBMYW5ndWFnZURldGVjdGlvbldvcmtlckhvc3Q7XG5cdHByaXZhdGUgX3JlZ2V4cE1vZGVsOiBSZWdleHBNb2RlbCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfcmVnZXhwTG9hZEZhaWxlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHByaXZhdGUgX21vZGVsT3BlcmF0aW9uczogTW9kZWxPcGVyYXRpb25zIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9sb2FkRmFpbGVkOiBib29sZWFuID0gZmFsc2U7XG5cblx0cHJpdmF0ZSBtb2RlbElkVG9Db3JlSWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nIHwgdW5kZWZpbmVkPigpO1xuXG5cdGNvbnN0cnVjdG9yKHdvcmtlclNlcnZlcjogSVdlYldvcmtlclNlcnZlcikge1xuXHRcdHRoaXMuX2hvc3QgPSBMYW5ndWFnZURldGVjdGlvbldvcmtlckhvc3QuZ2V0Q2hhbm5lbCh3b3JrZXJTZXJ2ZXIpO1xuXHRcdHRoaXMuX3dvcmtlclRleHRNb2RlbFN5bmNTZXJ2ZXIuYmluZFRvU2VydmVyKHdvcmtlclNlcnZlcik7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJGRldGVjdExhbmd1YWdlKHVyaTogc3RyaW5nLCBsYW5nQmlhc2VzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+IHwgdW5kZWZpbmVkLCBwcmVmZXJIaXN0b3J5OiBib29sZWFuLCBzdXBwb3J0ZWRMYW5ncz86IHN0cmluZ1tdKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBsYW5ndWFnZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgY29uZmlkZW5jZXM6IG51bWJlcltdID0gW107XG5cdFx0Y29uc3Qgc3RvcFdhdGNoID0gbmV3IFN0b3BXYXRjaCgpO1xuXHRcdGNvbnN0IGRvY3VtZW50VGV4dFNhbXBsZSA9IHRoaXMuZ2V0VGV4dEZvckRldGVjdGlvbih1cmkpO1xuXHRcdGlmICghZG9jdW1lbnRUZXh0U2FtcGxlKSB7IHJldHVybjsgfVxuXG5cdFx0Y29uc3QgbmV1cmFsUmVzb2x2ZXIgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRmb3IgYXdhaXQgKGNvbnN0IGxhbmd1YWdlIG9mIHRoaXMuZGV0ZWN0TGFuZ3VhZ2VzSW1wbChkb2N1bWVudFRleHRTYW1wbGUpKSB7XG5cdFx0XHRcdGlmICghdGhpcy5tb2RlbElkVG9Db3JlSWQuaGFzKGxhbmd1YWdlLmxhbmd1YWdlSWQpKSB7XG5cdFx0XHRcdFx0dGhpcy5tb2RlbElkVG9Db3JlSWQuc2V0KGxhbmd1YWdlLmxhbmd1YWdlSWQsIGF3YWl0IHRoaXMuX2hvc3QuJGdldExhbmd1YWdlSWQobGFuZ3VhZ2UubGFuZ3VhZ2VJZCkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGNvcmVJZCA9IHRoaXMubW9kZWxJZFRvQ29yZUlkLmdldChsYW5ndWFnZS5sYW5ndWFnZUlkKTtcblx0XHRcdFx0aWYgKGNvcmVJZCAmJiAoIXN1cHBvcnRlZExhbmdzPy5sZW5ndGggfHwgc3VwcG9ydGVkTGFuZ3MuaW5jbHVkZXMoY29yZUlkKSkpIHtcblx0XHRcdFx0XHRsYW5ndWFnZXMucHVzaChjb3JlSWQpO1xuXHRcdFx0XHRcdGNvbmZpZGVuY2VzLnB1c2gobGFuZ3VhZ2UuY29uZmlkZW5jZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHN0b3BXYXRjaC5zdG9wKCk7XG5cblx0XHRcdGlmIChsYW5ndWFnZXMubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuX2hvc3QuJHNlbmRUZWxlbWV0cnlFdmVudChsYW5ndWFnZXMsIGNvbmZpZGVuY2VzLCBzdG9wV2F0Y2guZWxhcHNlZCgpKTtcblx0XHRcdFx0cmV0dXJuIGxhbmd1YWdlc1swXTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGhpc3RvcmljYWxSZXNvbHZlciA9IGFzeW5jICgpID0+IHRoaXMucnVuUmVnZXhwTW9kZWwoZG9jdW1lbnRUZXh0U2FtcGxlLCBsYW5nQmlhc2VzID8/IHt9LCBzdXBwb3J0ZWRMYW5ncyk7XG5cblx0XHRpZiAocHJlZmVySGlzdG9yeSkge1xuXHRcdFx0Y29uc3QgaGlzdG9yeSA9IGF3YWl0IGhpc3RvcmljYWxSZXNvbHZlcigpO1xuXHRcdFx0aWYgKGhpc3RvcnkpIHsgcmV0dXJuIGhpc3Rvcnk7IH1cblx0XHRcdGNvbnN0IG5ldXJhbCA9IGF3YWl0IG5ldXJhbFJlc29sdmVyKCk7XG5cdFx0XHRpZiAobmV1cmFsKSB7IHJldHVybiBuZXVyYWw7IH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbmV1cmFsID0gYXdhaXQgbmV1cmFsUmVzb2x2ZXIoKTtcblx0XHRcdGlmIChuZXVyYWwpIHsgcmV0dXJuIG5ldXJhbDsgfVxuXHRcdFx0Y29uc3QgaGlzdG9yeSA9IGF3YWl0IGhpc3RvcmljYWxSZXNvbHZlcigpO1xuXHRcdFx0aWYgKGhpc3RvcnkpIHsgcmV0dXJuIGhpc3Rvcnk7IH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRUZXh0Rm9yRGV0ZWN0aW9uKHVyaTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBlZGl0b3JNb2RlbCA9IHRoaXMuX3dvcmtlclRleHRNb2RlbFN5bmNTZXJ2ZXIuZ2V0TW9kZWwodXJpKTtcblx0XHRpZiAoIWVkaXRvck1vZGVsKSB7IHJldHVybjsgfVxuXG5cdFx0Y29uc3QgZW5kID0gZWRpdG9yTW9kZWwucG9zaXRpb25BdCgxMDAwMCk7XG5cdFx0Y29uc3QgY29udGVudCA9IGVkaXRvck1vZGVsLmdldFZhbHVlSW5SYW5nZSh7XG5cdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSxcblx0XHRcdGVuZENvbHVtbjogZW5kLmNvbHVtbixcblx0XHRcdGVuZExpbmVOdW1iZXI6IGVuZC5saW5lTnVtYmVyXG5cdFx0fSk7XG5cdFx0cmV0dXJuIGNvbnRlbnQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFJlZ2V4cE1vZGVsKCk6IFByb21pc2U8UmVnZXhwTW9kZWwgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAodGhpcy5fcmVnZXhwTG9hZEZhaWxlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fcmVnZXhwTW9kZWwpIHtcblx0XHRcdHJldHVybiB0aGlzLl9yZWdleHBNb2RlbDtcblx0XHR9XG5cdFx0Y29uc3QgdXJpOiBzdHJpbmcgPSBhd2FpdCB0aGlzLl9ob3N0LiRnZXRSZWdleHBNb2RlbFVyaSgpO1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9yZWdleHBNb2RlbCA9IGF3YWl0IGltcG9ydEFNRE5vZGVNb2R1bGUodXJpLCAnJykgYXMgUmVnZXhwTW9kZWw7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVnZXhwTW9kZWw7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5fcmVnZXhwTG9hZEZhaWxlZCA9IHRydWU7XG5cdFx0XHQvLyBjb25zb2xlLndhcm4oJ2Vycm9yIGxvYWRpbmcgbGFuZ3VhZ2UgZGV0ZWN0aW9uIG1vZGVsJywgZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW5SZWdleHBNb2RlbChjb250ZW50OiBzdHJpbmcsIGxhbmdCaWFzZXM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4sIHN1cHBvcnRlZExhbmdzPzogc3RyaW5nW10pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHJlZ2V4cE1vZGVsID0gYXdhaXQgdGhpcy5nZXRSZWdleHBNb2RlbCgpO1xuXHRcdGlmICghcmVnZXhwTW9kZWwpIHsgcmV0dXJuOyB9XG5cblx0XHRpZiAoc3VwcG9ydGVkTGFuZ3M/Lmxlbmd0aCkge1xuXHRcdFx0Ly8gV2hlbiB1c2luZyBzdXBwb3J0ZWRMYW5ncywgbm9ybWFsbHkgY29tcHV0ZWQgYmlhc2VzIGFyZSB0b28gZXh0cmVtZS4gSnVzdCB1c2UgYSBcImJpdG1hc2tcIiBvZiBzb3J0cy5cblx0XHRcdGZvciAoY29uc3QgbGFuZyBvZiBPYmplY3Qua2V5cyhsYW5nQmlhc2VzKSkge1xuXHRcdFx0XHRpZiAoc3VwcG9ydGVkTGFuZ3MuaW5jbHVkZXMobGFuZykpIHtcblx0XHRcdFx0XHRsYW5nQmlhc2VzW2xhbmddID0gMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRsYW5nQmlhc2VzW2xhbmddID0gMDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGRldGVjdGVkID0gcmVnZXhwTW9kZWwuZGV0ZWN0KGNvbnRlbnQsIGxhbmdCaWFzZXMsIHN1cHBvcnRlZExhbmdzKTtcblx0XHRyZXR1cm4gZGV0ZWN0ZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldE1vZGVsT3BlcmF0aW9ucygpOiBQcm9taXNlPE1vZGVsT3BlcmF0aW9ucz4ge1xuXHRcdGlmICh0aGlzLl9tb2RlbE9wZXJhdGlvbnMpIHtcblx0XHRcdHJldHVybiB0aGlzLl9tb2RlbE9wZXJhdGlvbnM7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXJpOiBzdHJpbmcgPSBhd2FpdCB0aGlzLl9ob3N0LiRnZXRJbmRleEpzVXJpKCk7XG5cdFx0Y29uc3QgeyBNb2RlbE9wZXJhdGlvbnMgfSA9IGF3YWl0IGltcG9ydEFNRE5vZGVNb2R1bGUodXJpLCAnJykgYXMgdHlwZW9mIGltcG9ydCgnQHZzY29kZS92c2NvZGUtbGFuZ3VhZ2VkZXRlY3Rpb24nKTtcblx0XHR0aGlzLl9tb2RlbE9wZXJhdGlvbnMgPSBuZXcgTW9kZWxPcGVyYXRpb25zKHtcblx0XHRcdG1vZGVsSnNvbkxvYWRlckZ1bmM6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChhd2FpdCB0aGlzLl9ob3N0LiRnZXRNb2RlbEpzb25VcmkoKSk7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWxKU09OID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXHRcdFx0XHRcdHJldHVybiBtb2RlbEpTT047XG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRjb25zdCBtZXNzYWdlID0gYEZhaWxlZCB0byBwYXJzZSBtb2RlbCBKU09OLmA7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0d2VpZ2h0c0xvYWRlckZ1bmM6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChhd2FpdCB0aGlzLl9ob3N0LiRnZXRXZWlnaHRzVXJpKCkpO1xuXHRcdFx0XHRjb25zdCBidWZmZXIgPSBhd2FpdCByZXNwb25zZS5hcnJheUJ1ZmZlcigpO1xuXHRcdFx0XHRyZXR1cm4gYnVmZmVyO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsT3BlcmF0aW9ucztcblx0fVxuXG5cdC8vIFRoaXMgYWRqdXN0cyB0aGUgbGFuZ3VhZ2UgY29uZmlkZW5jZSBzY29yZXMgdG8gYmUgbW9yZSBhY2N1cmF0ZSBiYXNlZCBvbjpcblx0Ly8gKiBWUyBDb2RlJ3MgbGFuZ3VhZ2UgdXNhZ2Vcblx0Ly8gKiBMYW5ndWFnZXMgd2l0aCAncHJvYmxlbWF0aWMnIHN5bnRheGVzIHRoYXQgaGF2ZSBjYXVzZWQgaW5jb3JyZWN0IGxhbmd1YWdlIGRldGVjdGlvblxuXHRwcml2YXRlIGFkanVzdExhbmd1YWdlQ29uZmlkZW5jZShtb2RlbFJlc3VsdDogTW9kZWxSZXN1bHQpOiBNb2RlbFJlc3VsdCB7XG5cdFx0c3dpdGNoIChtb2RlbFJlc3VsdC5sYW5ndWFnZUlkKSB7XG5cdFx0XHQvLyBGb3IgdGhlIGZvbGxvd2luZyBsYW5ndWFnZXMsIHdlIGluY3JlYXNlIHRoZSBjb25maWRlbmNlIGJlY2F1c2Vcblx0XHRcdC8vIHRoZXNlIGFyZSBjb21tb25seSB1c2VkIGxhbmd1YWdlcyBpbiBWUyBDb2RlIGFuZCBzdXBwb3J0ZWRcblx0XHRcdC8vIGJ5IHRoZSBtb2RlbC5cblx0XHRcdGNhc2UgJ2pzJzpcblx0XHRcdGNhc2UgJ2h0bWwnOlxuXHRcdFx0Y2FzZSAnanNvbic6XG5cdFx0XHRjYXNlICd0cyc6XG5cdFx0XHRjYXNlICdjc3MnOlxuXHRcdFx0Y2FzZSAncHknOlxuXHRcdFx0Y2FzZSAneG1sJzpcblx0XHRcdGNhc2UgJ3BocCc6XG5cdFx0XHRcdG1vZGVsUmVzdWx0LmNvbmZpZGVuY2UgKz0gTGFuZ3VhZ2VEZXRlY3Rpb25Xb3JrZXIucG9zaXRpdmVDb25maWRlbmNlQ29ycmVjdGlvbkJ1Y2tldDE7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Ly8gY2FzZSAneWFtbCc6IC8vIFlBTUwgaGFzIGJlZW4ga25vdyB0byBjYXVzZSBpbmNvcnJlY3QgbGFuZ3VhZ2UgZGV0ZWN0aW9uIGJlY2F1c2UgdGhlIGxhbmd1YWdlIGlzIHByZXR0eSBzaW1wbGUuIFdlIGRvbid0IHdhbnQgdG8gaW5jcmVhc2UgdGhlIGNvbmZpZGVuY2UgZm9yIHRoaXMuXG5cdFx0XHRjYXNlICdjcHAnOlxuXHRcdFx0Y2FzZSAnc2gnOlxuXHRcdFx0Y2FzZSAnamF2YSc6XG5cdFx0XHRjYXNlICdjcyc6XG5cdFx0XHRjYXNlICdjJzpcblx0XHRcdFx0bW9kZWxSZXN1bHQuY29uZmlkZW5jZSArPSBMYW5ndWFnZURldGVjdGlvbldvcmtlci5wb3NpdGl2ZUNvbmZpZGVuY2VDb3JyZWN0aW9uQnVja2V0Mjtcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdC8vIEZvciB0aGUgZm9sbG93aW5nIGxhbmd1YWdlcywgd2UgbmVlZCB0byBiZSBleHRyYSBjb25maWRlbnQgdGhhdCB0aGUgbGFuZ3VhZ2UgaXMgY29ycmVjdCBiZWNhdXNlXG5cdFx0XHQvLyB3ZSd2ZSBoYWQgaXNzdWVzIGxpa2UgIzEzMTkxMiB0aGF0IGNhdXNlZCBpbmNvcnJlY3QgZ3Vlc3Nlcy4gVG8gZW5mb3JjZSB0aGlzLCB3ZSBzdWJ0cmFjdCB0aGVcblx0XHRcdC8vIG5lZ2F0aXZlQ29uZmlkZW5jZUNvcnJlY3Rpb24gZnJvbSB0aGUgY29uZmlkZW5jZS5cblxuXHRcdFx0Ly8gbGFuZ3VhZ2VzIHRoYXQgYXJlIHByb3ZpZGVkIGJ5IGRlZmF1bHQgaW4gVlMgQ29kZVxuXHRcdFx0Y2FzZSAnYmF0Jzpcblx0XHRcdGNhc2UgJ2luaSc6XG5cdFx0XHRjYXNlICdtYWtlZmlsZSc6XG5cdFx0XHRjYXNlICdzcWwnOlxuXHRcdFx0Ly8gbGFuZ3VhZ2VzIHRoYXQgYXJlbid0IHByb3ZpZGVkIGJ5IGRlZmF1bHQgaW4gVlMgQ29kZVxuXHRcdFx0Y2FzZSAnY3N2Jzpcblx0XHRcdGNhc2UgJ3RvbWwnOlxuXHRcdFx0XHQvLyBPdGhlciBjb25zaWRlcmF0aW9ucyBmb3IgbmVnYXRpdmVDb25maWRlbmNlQ29ycmVjdGlvbiB0aGF0XG5cdFx0XHRcdC8vIGFyZW4ndCBidWlsdCBpbiBidXQgc3Vwb3J0ZWQgYnkgdGhlIG1vZGVsIGluY2x1ZGU6XG5cdFx0XHRcdC8vICogQXNzZW1ibHksIFRlWCAtIFRoZXNlIGxhbmd1YWdlcyBkaWRuJ3QgaGF2ZSBjbGVhciBsYW5ndWFnZSBtb2RlcyBpbiB0aGUgY29tbXVuaXR5XG5cdFx0XHRcdC8vICogTWFya2Rvd24sIERvY2tlcmZpbGUgLSBUaGVzZSBsYW5ndWFnZXMgYXJlIHNpbXBsZSBidXQgdGhleSBlbWJlZCBvdGhlciBsYW5ndWFnZXNcblx0XHRcdFx0bW9kZWxSZXN1bHQuY29uZmlkZW5jZSAtPSBMYW5ndWFnZURldGVjdGlvbldvcmtlci5uZWdhdGl2ZUNvbmZpZGVuY2VDb3JyZWN0aW9uO1xuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0YnJlYWs7XG5cblx0XHR9XG5cdFx0cmV0dXJuIG1vZGVsUmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyAqIGRldGVjdExhbmd1YWdlc0ltcGwoY29udGVudDogc3RyaW5nKTogQXN5bmNHZW5lcmF0b3I8TW9kZWxSZXN1bHQsIHZvaWQsIHVua25vd24+IHtcblx0XHRpZiAodGhpcy5fbG9hZEZhaWxlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBtb2RlbE9wZXJhdGlvbnM6IE1vZGVsT3BlcmF0aW9ucyB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0bW9kZWxPcGVyYXRpb25zID0gYXdhaXQgdGhpcy5nZXRNb2RlbE9wZXJhdGlvbnMoKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhlKTtcblx0XHRcdHRoaXMuX2xvYWRGYWlsZWQgPSB0cnVlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBtb2RlbFJlc3VsdHM6IE1vZGVsUmVzdWx0W10gfCB1bmRlZmluZWQ7XG5cblx0XHR0cnkge1xuXHRcdFx0bW9kZWxSZXN1bHRzID0gYXdhaXQgbW9kZWxPcGVyYXRpb25zLnJ1bk1vZGVsKGNvbnRlbnQpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUud2FybihlKTtcblx0XHR9XG5cblx0XHRpZiAoIW1vZGVsUmVzdWx0c1xuXHRcdFx0fHwgbW9kZWxSZXN1bHRzLmxlbmd0aCA9PT0gMFxuXHRcdFx0fHwgbW9kZWxSZXN1bHRzWzBdLmNvbmZpZGVuY2UgPCBMYW5ndWFnZURldGVjdGlvbldvcmtlci5leHBlY3RlZFJlbGF0aXZlQ29uZmlkZW5jZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpcnN0TW9kZWxSZXN1bHQgPSB0aGlzLmFkanVzdExhbmd1YWdlQ29uZmlkZW5jZShtb2RlbFJlc3VsdHNbMF0pO1xuXHRcdGlmIChmaXJzdE1vZGVsUmVzdWx0LmNvbmZpZGVuY2UgPCBMYW5ndWFnZURldGVjdGlvbldvcmtlci5leHBlY3RlZFJlbGF0aXZlQ29uZmlkZW5jZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBvc3NpYmxlTGFuZ3VhZ2VzOiBNb2RlbFJlc3VsdFtdID0gW2ZpcnN0TW9kZWxSZXN1bHRdO1xuXG5cdFx0Zm9yIChsZXQgY3VycmVudCBvZiBtb2RlbFJlc3VsdHMpIHtcblx0XHRcdGlmIChjdXJyZW50ID09PSBmaXJzdE1vZGVsUmVzdWx0KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjdXJyZW50ID0gdGhpcy5hZGp1c3RMYW5ndWFnZUNvbmZpZGVuY2UoY3VycmVudCk7XG5cdFx0XHRjb25zdCBjdXJyZW50SGlnaGVzdCA9IHBvc3NpYmxlTGFuZ3VhZ2VzW3Bvc3NpYmxlTGFuZ3VhZ2VzLmxlbmd0aCAtIDFdO1xuXG5cdFx0XHRpZiAoY3VycmVudEhpZ2hlc3QuY29uZmlkZW5jZSAtIGN1cnJlbnQuY29uZmlkZW5jZSA+PSBMYW5ndWFnZURldGVjdGlvbldvcmtlci5leHBlY3RlZFJlbGF0aXZlQ29uZmlkZW5jZSkge1xuXHRcdFx0XHR3aGlsZSAocG9zc2libGVMYW5ndWFnZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0eWllbGQgcG9zc2libGVMYW5ndWFnZXMuc2hpZnQoKSE7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGN1cnJlbnQuY29uZmlkZW5jZSA+IExhbmd1YWdlRGV0ZWN0aW9uV29ya2VyLmV4cGVjdGVkUmVsYXRpdmVDb25maWRlbmNlKSB7XG5cdFx0XHRcdFx0cG9zc2libGVMYW5ndWFnZXMucHVzaChjdXJyZW50KTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoY3VycmVudC5jb25maWRlbmNlID4gTGFuZ3VhZ2VEZXRlY3Rpb25Xb3JrZXIuZXhwZWN0ZWRSZWxhdGl2ZUNvbmZpZGVuY2UpIHtcblx0XHRcdFx0XHRwb3NzaWJsZUxhbmd1YWdlcy5wdXNoKGN1cnJlbnQpO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJB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
