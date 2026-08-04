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
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Position } from "../../../../editor/common/core/position.js";
import { SymbolKind } from "../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { Range } from "../../../../editor/common/core/range.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
const IContextGatheringService = createDecorator("contextGatheringService");
let ContextGatheringService = class extends Disposable {
  constructor(_langFeaturesService, _modelService, _codeEditorService) {
    super();
    this._langFeaturesService = _langFeaturesService;
    this._modelService = _modelService;
    this._codeEditorService = _codeEditorService;
    this._NUM_LINES = 3;
    this._MAX_SNIPPET_LINES = 7;
    // Reasonable size for context
    // Cache holds the most recent list of snippets.
    this._cache = [];
    this._snippetIntervals = [];
    this._modelService.getModels().forEach((model) => this._subscribeToModel(model));
    this._register(this._modelService.onModelAdded((model) => this._subscribeToModel(model)));
  }
  _subscribeToModel(model) {
    console.log("Subscribing to model:", model.uri.toString());
    this._register(model.onDidChangeContent(() => {
      const editor = this._codeEditorService.getFocusedCodeEditor();
      if (editor && editor.getModel() === model) {
        const pos = editor.getPosition();
        console.log("updateCache called at position:", pos);
        if (pos) {
          this.updateCache(model, pos);
        }
      }
    }));
  }
  async updateCache(model, pos) {
    const snippets = /* @__PURE__ */ new Set();
    this._snippetIntervals = [];
    await this._gatherNearbySnippets(model, pos, this._NUM_LINES, 3, snippets, this._snippetIntervals);
    await this._gatherParentSnippets(model, pos, this._NUM_LINES, 3, snippets, this._snippetIntervals);
    this._cache = Array.from(snippets);
    console.log("Cache updated:", this._cache);
  }
  getCachedSnippets() {
    return this._cache;
  }
  // Basic snippet extraction.
  _getSnippetForRange(model, range, numLines) {
    const startLine = Math.max(range.startLineNumber - numLines, 1);
    const endLine = Math.min(range.endLineNumber + numLines, model.getLineCount());
    const totalLines = endLine - startLine + 1;
    const adjustedStartLine = totalLines > this._MAX_SNIPPET_LINES ? endLine - this._MAX_SNIPPET_LINES + 1 : startLine;
    const snippetRange = new Range(adjustedStartLine, 1, endLine, model.getLineMaxColumn(endLine));
    return this._cleanSnippet(model.getValueInRange(snippetRange));
  }
  _cleanSnippet(snippet) {
    return snippet.split("\n").filter((line) => {
      const trimmed = line.trim();
      return trimmed && !/^\/\/+$/.test(trimmed);
    }).join("\n").trim();
  }
  _normalizeSnippet(snippet) {
    return snippet.replace(/\n{2,}/g, "\n").trim();
  }
  _addSnippetIfNotOverlapping(model, range, snippets, visited) {
    const startLine = range.startLineNumber;
    const endLine = range.endLineNumber;
    const uri = model.uri.toString();
    if (!this._isRangeVisited(uri, startLine, endLine, visited)) {
      visited.push({ uri, startLine, endLine });
      const snippet = this._normalizeSnippet(this._getSnippetForRange(model, range, this._NUM_LINES));
      if (snippet.length > 0) {
        snippets.add(snippet);
      }
    }
  }
  async _gatherNearbySnippets(model, pos, numLines, depth, snippets, visited) {
    if (depth <= 0) return;
    const startLine = Math.max(pos.lineNumber - numLines, 1);
    const endLine = Math.min(pos.lineNumber + numLines, model.getLineCount());
    const range = new Range(startLine, 1, endLine, model.getLineMaxColumn(endLine));
    this._addSnippetIfNotOverlapping(model, range, snippets, visited);
    const symbols = await this._getSymbolsNearPosition(model, pos, numLines);
    for (const sym of symbols) {
      const defs = await this._getDefinitionSymbols(model, sym);
      for (const def of defs) {
        const defModel = this._modelService.getModel(def.uri);
        if (defModel) {
          const defPos = new Position(def.range.startLineNumber, def.range.startColumn);
          this._addSnippetIfNotOverlapping(defModel, def.range, snippets, visited);
          await this._gatherNearbySnippets(defModel, defPos, numLines, depth - 1, snippets, visited);
        }
      }
    }
  }
  async _gatherParentSnippets(model, pos, numLines, depth, snippets, visited) {
    if (depth <= 0) return;
    const container = await this._findContainerFunction(model, pos);
    if (!container) return;
    const containerRange = container.kind === SymbolKind.Method ? container.selectionRange : container.range;
    this._addSnippetIfNotOverlapping(model, containerRange, snippets, visited);
    const symbols = await this._getSymbolsNearRange(model, containerRange, numLines);
    for (const sym of symbols) {
      const defs = await this._getDefinitionSymbols(model, sym);
      for (const def of defs) {
        const defModel = this._modelService.getModel(def.uri);
        if (defModel) {
          const defPos = new Position(def.range.startLineNumber, def.range.startColumn);
          this._addSnippetIfNotOverlapping(defModel, def.range, snippets, visited);
          await this._gatherNearbySnippets(defModel, defPos, numLines, depth - 1, snippets, visited);
        }
      }
    }
    const containerPos = new Position(containerRange.startLineNumber, containerRange.startColumn);
    await this._gatherParentSnippets(model, containerPos, numLines, depth - 1, snippets, visited);
  }
  _isRangeVisited(uri, startLine, endLine, visited) {
    return visited.some(
      (interval) => interval.uri === uri && !(endLine < interval.startLine || startLine > interval.endLine)
    );
  }
  async _getSymbolsNearPosition(model, pos, numLines) {
    const startLine = Math.max(pos.lineNumber - numLines, 1);
    const endLine = Math.min(pos.lineNumber + numLines, model.getLineCount());
    const range = new Range(startLine, 1, endLine, model.getLineMaxColumn(endLine));
    return this._getSymbolsInRange(model, range);
  }
  async _getSymbolsNearRange(model, range, numLines) {
    const centerLine = Math.floor((range.startLineNumber + range.endLineNumber) / 2);
    const startLine = Math.max(centerLine - numLines, 1);
    const endLine = Math.min(centerLine + numLines, model.getLineCount());
    const searchRange = new Range(startLine, 1, endLine, model.getLineMaxColumn(endLine));
    return this._getSymbolsInRange(model, searchRange);
  }
  async _getSymbolsInRange(model, range) {
    const symbols = [];
    const providers = this._langFeaturesService.documentSymbolProvider.ordered(model);
    for (const provider of providers) {
      try {
        const result = await provider.provideDocumentSymbols(model, CancellationToken.None);
        if (result) {
          const flat = this._flattenSymbols(result);
          const intersecting = flat.filter((sym) => this._rangesIntersect(sym.range, range));
          symbols.push(...intersecting);
        }
      } catch (e) {
        console.warn("Symbol provider error:", e);
      }
    }
    const refProviders = this._langFeaturesService.referenceProvider.ordered(model);
    for (let line = range.startLineNumber; line <= range.endLineNumber; line++) {
      const content = model.getLineContent(line);
      const words = content.match(/[a-zA-Z_]\w*/g) || [];
      for (const word of words) {
        const startColumn = content.indexOf(word) + 1;
        const pos = new Position(line, startColumn);
        if (!this._positionInRange(pos, range)) continue;
        for (const provider of refProviders) {
          try {
            const refs = await provider.provideReferences(model, pos, { includeDeclaration: true }, CancellationToken.None);
            if (refs) {
              const filtered = refs.filter((ref) => this._rangesIntersect(ref.range, range));
              for (const ref of filtered) {
                symbols.push({
                  name: word,
                  detail: "",
                  kind: SymbolKind.Variable,
                  range: ref.range,
                  selectionRange: ref.range,
                  children: [],
                  tags: []
                });
              }
            }
          } catch (e) {
            console.warn("Reference provider error:", e);
          }
        }
      }
    }
    return symbols;
  }
  _flattenSymbols(symbols) {
    const flat = [];
    for (const sym of symbols) {
      flat.push(sym);
      if (sym.children && sym.children.length > 0) {
        flat.push(...this._flattenSymbols(sym.children));
      }
    }
    return flat;
  }
  _rangesIntersect(a, b) {
    return !(a.endLineNumber < b.startLineNumber || a.startLineNumber > b.endLineNumber || a.endLineNumber === b.startLineNumber && a.endColumn < b.startColumn || a.startLineNumber === b.endLineNumber && a.endColumn > b.endColumn);
  }
  _positionInRange(pos, range) {
    return pos.lineNumber >= range.startLineNumber && pos.lineNumber <= range.endLineNumber && (pos.lineNumber !== range.startLineNumber || pos.column >= range.startColumn) && (pos.lineNumber !== range.endLineNumber || pos.column <= range.endColumn);
  }
  // Get definition symbols for a given symbol.
  async _getDefinitionSymbols(model, symbol) {
    const pos = new Position(symbol.range.startLineNumber, symbol.range.startColumn);
    const providers = this._langFeaturesService.definitionProvider.ordered(model);
    const defs = [];
    for (const provider of providers) {
      try {
        const res = await provider.provideDefinition(model, pos, CancellationToken.None);
        if (res) {
          const links = Array.isArray(res) ? res : [res];
          defs.push(...links.map((link) => ({
            name: symbol.name,
            detail: symbol.detail,
            kind: symbol.kind,
            range: link.range,
            selectionRange: link.range,
            children: [],
            tags: symbol.tags || [],
            uri: link.uri
            // Now keeping it as URI instead of converting to string
          })));
        }
      } catch (e) {
        console.warn("Definition provider error:", e);
      }
    }
    return defs;
  }
  async _findContainerFunction(model, pos) {
    const searchRange = new Range(
      Math.max(pos.lineNumber - 1, 1),
      1,
      Math.min(pos.lineNumber + 1, model.getLineCount()),
      model.getLineMaxColumn(pos.lineNumber)
    );
    const symbols = await this._getSymbolsInRange(model, searchRange);
    const funcs = symbols.filter(
      (s) => (s.kind === SymbolKind.Function || s.kind === SymbolKind.Method) && this._positionInRange(pos, s.range)
    );
    if (!funcs.length) return null;
    return funcs.reduce((innermost, current) => {
      if (!innermost) return current;
      const moreInner = (current.range.startLineNumber > innermost.range.startLineNumber || current.range.startLineNumber === innermost.range.startLineNumber && current.range.startColumn > innermost.range.startColumn) && (current.range.endLineNumber < innermost.range.endLineNumber || current.range.endLineNumber === innermost.range.endLineNumber && current.range.endColumn < innermost.range.endColumn);
      return moreInner ? current : innermost;
    }, null);
  }
};
ContextGatheringService = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ICodeEditorService)
], ContextGatheringService);
registerSingleton(IContextGatheringService, ContextGatheringService, InstantiationType.Eager);
export {
  IContextGatheringService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvY29udGV4dEdhdGhlcmluZ1NlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IERvY3VtZW50U3ltYm9sLCBTeW1ib2xLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UsIElSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcblxuXG4vLyBtYWtlIHN1cmUgc25pcHBldCBsb2dpYyB3b3Jrc1xuLy8gY2hhbmdlIGxvZ2ljIGZvciBgdmlzaXRlZGAgdG8gaW50ZXJ2YWxzXG4vLyBhdG9taWNhbGx5IHNldCBuZXcgc25pcHBldHMgYXQgZW5kXG4vLyB0aHJvdHRsZSBjYWNoZSBzZXR0aW5nXG5cbmludGVyZmFjZSBJVmlzaXRlZEludGVydmFsIHtcblx0dXJpOiBzdHJpbmc7XG5cdHN0YXJ0TGluZTogbnVtYmVyO1xuXHRlbmRMaW5lOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRleHRHYXRoZXJpbmdTZXJ2aWNlIHtcblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHR1cGRhdGVDYWNoZShtb2RlbDogSVRleHRNb2RlbCwgcG9zOiBQb3NpdGlvbik6IFByb21pc2U8dm9pZD47XG5cdGdldENhY2hlZFNuaXBwZXRzKCk6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgY29uc3QgSUNvbnRleHRHYXRoZXJpbmdTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElDb250ZXh0R2F0aGVyaW5nU2VydmljZT4oJ2NvbnRleHRHYXRoZXJpbmdTZXJ2aWNlJyk7XG5cbmNsYXNzIENvbnRleHRHYXRoZXJpbmdTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElDb250ZXh0R2F0aGVyaW5nU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfTlVNX0xJTkVTID0gMztcblx0cHJpdmF0ZSByZWFkb25seSBfTUFYX1NOSVBQRVRfTElORVMgPSA3OyAgLy8gUmVhc29uYWJsZSBzaXplIGZvciBjb250ZXh0XG5cdC8vIENhY2hlIGhvbGRzIHRoZSBtb3N0IHJlY2VudCBsaXN0IG9mIHNuaXBwZXRzLlxuXHRwcml2YXRlIF9jYWNoZTogc3RyaW5nW10gPSBbXTtcblx0cHJpdmF0ZSBfc25pcHBldEludGVydmFsczogSVZpc2l0ZWRJbnRlcnZhbFtdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5nRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX21vZGVsU2VydmljZS5nZXRNb2RlbHMoKS5mb3JFYWNoKG1vZGVsID0+IHRoaXMuX3N1YnNjcmliZVRvTW9kZWwobW9kZWwpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9tb2RlbFNlcnZpY2Uub25Nb2RlbEFkZGVkKG1vZGVsID0+IHRoaXMuX3N1YnNjcmliZVRvTW9kZWwobW9kZWwpKSk7XG5cdH1cblxuXHRwcml2YXRlIF9zdWJzY3JpYmVUb01vZGVsKG1vZGVsOiBJVGV4dE1vZGVsKTogdm9pZCB7XG5cdFx0Y29uc29sZS5sb2coJ1N1YnNjcmliaW5nIHRvIG1vZGVsOicsIG1vZGVsLnVyaS50b1N0cmluZygpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihtb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQoKCkgPT4ge1xuXHRcdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5fY29kZUVkaXRvclNlcnZpY2UuZ2V0Rm9jdXNlZENvZGVFZGl0b3IoKTtcblx0XHRcdGlmIChlZGl0b3IgJiYgZWRpdG9yLmdldE1vZGVsKCkgPT09IG1vZGVsKSB7XG5cdFx0XHRcdGNvbnN0IHBvcyA9IGVkaXRvci5nZXRQb3NpdGlvbigpO1xuXHRcdFx0XHRjb25zb2xlLmxvZygndXBkYXRlQ2FjaGUgY2FsbGVkIGF0IHBvc2l0aW9uOicsIHBvcyk7XG5cdFx0XHRcdGlmIChwb3MpIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZUNhY2hlKG1vZGVsLCBwb3MpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHVwZGF0ZUNhY2hlKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3M6IFBvc2l0aW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc25pcHBldHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHR0aGlzLl9zbmlwcGV0SW50ZXJ2YWxzID0gW107IC8vIFJlc2V0IGludGVydmFscyBmb3IgbmV3IGNhY2hlIHVwZGF0ZVxuXG5cdFx0YXdhaXQgdGhpcy5fZ2F0aGVyTmVhcmJ5U25pcHBldHMobW9kZWwsIHBvcywgdGhpcy5fTlVNX0xJTkVTLCAzLCBzbmlwcGV0cywgdGhpcy5fc25pcHBldEludGVydmFscyk7XG5cdFx0YXdhaXQgdGhpcy5fZ2F0aGVyUGFyZW50U25pcHBldHMobW9kZWwsIHBvcywgdGhpcy5fTlVNX0xJTkVTLCAzLCBzbmlwcGV0cywgdGhpcy5fc25pcHBldEludGVydmFscyk7XG5cblx0XHQvLyBDb252ZXJ0IHRvIGFycmF5IGFuZCBmaWx0ZXIgb3ZlcmxhcHBpbmcgc25pcHBldHNcblx0XHR0aGlzLl9jYWNoZSA9IEFycmF5LmZyb20oc25pcHBldHMpO1xuXHRcdGNvbnNvbGUubG9nKCdDYWNoZSB1cGRhdGVkOicsIHRoaXMuX2NhY2hlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRDYWNoZWRTbmlwcGV0cygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NhY2hlO1xuXHR9XG5cblx0Ly8gQmFzaWMgc25pcHBldCBleHRyYWN0aW9uLlxuXHRwcml2YXRlIF9nZXRTbmlwcGV0Rm9yUmFuZ2UobW9kZWw6IElUZXh0TW9kZWwsIHJhbmdlOiBJUmFuZ2UsIG51bUxpbmVzOiBudW1iZXIpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHN0YXJ0TGluZSA9IE1hdGgubWF4KHJhbmdlLnN0YXJ0TGluZU51bWJlciAtIG51bUxpbmVzLCAxKTtcblx0XHRjb25zdCBlbmRMaW5lID0gTWF0aC5taW4ocmFuZ2UuZW5kTGluZU51bWJlciArIG51bUxpbmVzLCBtb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cblx0XHQvLyBFbmZvcmNlIG1heGltdW0gc25pcHBldCBzaXplXG5cdFx0Y29uc3QgdG90YWxMaW5lcyA9IGVuZExpbmUgLSBzdGFydExpbmUgKyAxO1xuXHRcdGNvbnN0IGFkanVzdGVkU3RhcnRMaW5lID0gdG90YWxMaW5lcyA+IHRoaXMuX01BWF9TTklQUEVUX0xJTkVTXG5cdFx0XHQ/IGVuZExpbmUgLSB0aGlzLl9NQVhfU05JUFBFVF9MSU5FUyArIDFcblx0XHRcdDogc3RhcnRMaW5lO1xuXG5cdFx0Y29uc3Qgc25pcHBldFJhbmdlID0gbmV3IFJhbmdlKGFkanVzdGVkU3RhcnRMaW5lLCAxLCBlbmRMaW5lLCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGVuZExpbmUpKTtcblx0XHRyZXR1cm4gdGhpcy5fY2xlYW5TbmlwcGV0KG1vZGVsLmdldFZhbHVlSW5SYW5nZShzbmlwcGV0UmFuZ2UpKTtcblx0fVxuXG5cdHByaXZhdGUgX2NsZWFuU25pcHBldChzbmlwcGV0OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiBzbmlwcGV0XG5cdFx0XHQuc3BsaXQoJ1xcbicpXG5cdFx0XHQvLyBSZW1vdmUgZW1wdHkgbGluZXMgYW5kIGxpbmVzIHdpdGggb25seSBjb21tZW50c1xuXHRcdFx0LmZpbHRlcihsaW5lID0+IHtcblx0XHRcdFx0Y29uc3QgdHJpbW1lZCA9IGxpbmUudHJpbSgpO1xuXHRcdFx0XHRyZXR1cm4gdHJpbW1lZCAmJiAhL15cXC9cXC8rJC8udGVzdCh0cmltbWVkKTtcblx0XHRcdH0pXG5cdFx0XHQvLyBSZWpvaW4gd2l0aCBuZXdsaW5lc1xuXHRcdFx0LmpvaW4oJ1xcbicpXG5cdFx0XHQvLyBSZW1vdmUgZXhjZXNzIHdoaXRlc3BhY2Vcblx0XHRcdC50cmltKCk7XG5cdH1cblxuXHRwcml2YXRlIF9ub3JtYWxpemVTbmlwcGV0KHNuaXBwZXQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHNuaXBwZXRcblx0XHRcdC8vIFJlbW92ZSBtdWx0aXBsZSBuZXdsaW5lc1xuXHRcdFx0LnJlcGxhY2UoL1xcbnsyLH0vZywgJ1xcbicpXG5cdFx0XHQvLyBSZW1vdmUgdHJhaWxpbmcgd2hpdGVzcGFjZVxuXHRcdFx0LnRyaW0oKTtcblx0fVxuXG5cdHByaXZhdGUgX2FkZFNuaXBwZXRJZk5vdE92ZXJsYXBwaW5nKFxuXHRcdG1vZGVsOiBJVGV4dE1vZGVsLFxuXHRcdHJhbmdlOiBJUmFuZ2UsXG5cdFx0c25pcHBldHM6IFNldDxzdHJpbmc+LFxuXHRcdHZpc2l0ZWQ6IElWaXNpdGVkSW50ZXJ2YWxbXVxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCBzdGFydExpbmUgPSByYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgZW5kTGluZSA9IHJhbmdlLmVuZExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgdXJpID0gbW9kZWwudXJpLnRvU3RyaW5nKCk7XG5cblx0XHRpZiAoIXRoaXMuX2lzUmFuZ2VWaXNpdGVkKHVyaSwgc3RhcnRMaW5lLCBlbmRMaW5lLCB2aXNpdGVkKSkge1xuXHRcdFx0dmlzaXRlZC5wdXNoKHsgdXJpLCBzdGFydExpbmUsIGVuZExpbmUgfSk7XG5cdFx0XHRjb25zdCBzbmlwcGV0ID0gdGhpcy5fbm9ybWFsaXplU25pcHBldCh0aGlzLl9nZXRTbmlwcGV0Rm9yUmFuZ2UobW9kZWwsIHJhbmdlLCB0aGlzLl9OVU1fTElORVMpKTtcblx0XHRcdGlmIChzbmlwcGV0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0c25pcHBldHMuYWRkKHNuaXBwZXQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2dhdGhlck5lYXJieVNuaXBwZXRzKFxuXHRcdG1vZGVsOiBJVGV4dE1vZGVsLFxuXHRcdHBvczogUG9zaXRpb24sXG5cdFx0bnVtTGluZXM6IG51bWJlcixcblx0XHRkZXB0aDogbnVtYmVyLFxuXHRcdHNuaXBwZXRzOiBTZXQ8c3RyaW5nPixcblx0XHR2aXNpdGVkOiBJVmlzaXRlZEludGVydmFsW11cblx0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGRlcHRoIDw9IDApIHJldHVybjtcblxuXHRcdGNvbnN0IHN0YXJ0TGluZSA9IE1hdGgubWF4KHBvcy5saW5lTnVtYmVyIC0gbnVtTGluZXMsIDEpO1xuXHRcdGNvbnN0IGVuZExpbmUgPSBNYXRoLm1pbihwb3MubGluZU51bWJlciArIG51bUxpbmVzLCBtb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0Y29uc3QgcmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnRMaW5lLCAxLCBlbmRMaW5lLCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGVuZExpbmUpKTtcblxuXHRcdHRoaXMuX2FkZFNuaXBwZXRJZk5vdE92ZXJsYXBwaW5nKG1vZGVsLCByYW5nZSwgc25pcHBldHMsIHZpc2l0ZWQpO1xuXG5cdFx0Y29uc3Qgc3ltYm9scyA9IGF3YWl0IHRoaXMuX2dldFN5bWJvbHNOZWFyUG9zaXRpb24obW9kZWwsIHBvcywgbnVtTGluZXMpO1xuXHRcdGZvciAoY29uc3Qgc3ltIG9mIHN5bWJvbHMpIHtcblx0XHRcdGNvbnN0IGRlZnMgPSBhd2FpdCB0aGlzLl9nZXREZWZpbml0aW9uU3ltYm9scyhtb2RlbCwgc3ltKTtcblx0XHRcdGZvciAoY29uc3QgZGVmIG9mIGRlZnMpIHtcblx0XHRcdFx0Y29uc3QgZGVmTW9kZWwgPSB0aGlzLl9tb2RlbFNlcnZpY2UuZ2V0TW9kZWwoZGVmLnVyaSk7XG5cdFx0XHRcdGlmIChkZWZNb2RlbCkge1xuXHRcdFx0XHRcdGNvbnN0IGRlZlBvcyA9IG5ldyBQb3NpdGlvbihkZWYucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBkZWYucmFuZ2Uuc3RhcnRDb2x1bW4pO1xuXHRcdFx0XHRcdHRoaXMuX2FkZFNuaXBwZXRJZk5vdE92ZXJsYXBwaW5nKGRlZk1vZGVsLCBkZWYucmFuZ2UsIHNuaXBwZXRzLCB2aXNpdGVkKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl9nYXRoZXJOZWFyYnlTbmlwcGV0cyhkZWZNb2RlbCwgZGVmUG9zLCBudW1MaW5lcywgZGVwdGggLSAxLCBzbmlwcGV0cywgdmlzaXRlZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nYXRoZXJQYXJlbnRTbmlwcGV0cyhcblx0XHRtb2RlbDogSVRleHRNb2RlbCxcblx0XHRwb3M6IFBvc2l0aW9uLFxuXHRcdG51bUxpbmVzOiBudW1iZXIsXG5cdFx0ZGVwdGg6IG51bWJlcixcblx0XHRzbmlwcGV0czogU2V0PHN0cmluZz4sXG5cdFx0dmlzaXRlZDogSVZpc2l0ZWRJbnRlcnZhbFtdXG5cdCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChkZXB0aCA8PSAwKSByZXR1cm47XG5cblx0XHRjb25zdCBjb250YWluZXIgPSBhd2FpdCB0aGlzLl9maW5kQ29udGFpbmVyRnVuY3Rpb24obW9kZWwsIHBvcyk7XG5cdFx0aWYgKCFjb250YWluZXIpIHJldHVybjtcblxuXHRcdGNvbnN0IGNvbnRhaW5lclJhbmdlID0gY29udGFpbmVyLmtpbmQgPT09IFN5bWJvbEtpbmQuTWV0aG9kID8gY29udGFpbmVyLnNlbGVjdGlvblJhbmdlIDogY29udGFpbmVyLnJhbmdlO1xuXHRcdHRoaXMuX2FkZFNuaXBwZXRJZk5vdE92ZXJsYXBwaW5nKG1vZGVsLCBjb250YWluZXJSYW5nZSwgc25pcHBldHMsIHZpc2l0ZWQpO1xuXG5cdFx0Y29uc3Qgc3ltYm9scyA9IGF3YWl0IHRoaXMuX2dldFN5bWJvbHNOZWFyUmFuZ2UobW9kZWwsIGNvbnRhaW5lclJhbmdlLCBudW1MaW5lcyk7XG5cdFx0Zm9yIChjb25zdCBzeW0gb2Ygc3ltYm9scykge1xuXHRcdFx0Y29uc3QgZGVmcyA9IGF3YWl0IHRoaXMuX2dldERlZmluaXRpb25TeW1ib2xzKG1vZGVsLCBzeW0pO1xuXHRcdFx0Zm9yIChjb25zdCBkZWYgb2YgZGVmcykge1xuXHRcdFx0XHRjb25zdCBkZWZNb2RlbCA9IHRoaXMuX21vZGVsU2VydmljZS5nZXRNb2RlbChkZWYudXJpKTtcblx0XHRcdFx0aWYgKGRlZk1vZGVsKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGVmUG9zID0gbmV3IFBvc2l0aW9uKGRlZi5yYW5nZS5zdGFydExpbmVOdW1iZXIsIGRlZi5yYW5nZS5zdGFydENvbHVtbik7XG5cdFx0XHRcdFx0dGhpcy5fYWRkU25pcHBldElmTm90T3ZlcmxhcHBpbmcoZGVmTW9kZWwsIGRlZi5yYW5nZSwgc25pcHBldHMsIHZpc2l0ZWQpO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuX2dhdGhlck5lYXJieVNuaXBwZXRzKGRlZk1vZGVsLCBkZWZQb3MsIG51bUxpbmVzLCBkZXB0aCAtIDEsIHNuaXBwZXRzLCB2aXNpdGVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRhaW5lclBvcyA9IG5ldyBQb3NpdGlvbihjb250YWluZXJSYW5nZS5zdGFydExpbmVOdW1iZXIsIGNvbnRhaW5lclJhbmdlLnN0YXJ0Q29sdW1uKTtcblx0XHRhd2FpdCB0aGlzLl9nYXRoZXJQYXJlbnRTbmlwcGV0cyhtb2RlbCwgY29udGFpbmVyUG9zLCBudW1MaW5lcywgZGVwdGggLSAxLCBzbmlwcGV0cywgdmlzaXRlZCk7XG5cdH1cblxuXHRwcml2YXRlIF9pc1JhbmdlVmlzaXRlZCh1cmk6IHN0cmluZywgc3RhcnRMaW5lOiBudW1iZXIsIGVuZExpbmU6IG51bWJlciwgdmlzaXRlZDogSVZpc2l0ZWRJbnRlcnZhbFtdKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHZpc2l0ZWQuc29tZShpbnRlcnZhbCA9PlxuXHRcdFx0aW50ZXJ2YWwudXJpID09PSB1cmkgJiZcblx0XHRcdCEoZW5kTGluZSA8IGludGVydmFsLnN0YXJ0TGluZSB8fCBzdGFydExpbmUgPiBpbnRlcnZhbC5lbmRMaW5lKVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXRTeW1ib2xzTmVhclBvc2l0aW9uKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3M6IFBvc2l0aW9uLCBudW1MaW5lczogbnVtYmVyKTogUHJvbWlzZTxEb2N1bWVudFN5bWJvbFtdPiB7XG5cdFx0Y29uc3Qgc3RhcnRMaW5lID0gTWF0aC5tYXgocG9zLmxpbmVOdW1iZXIgLSBudW1MaW5lcywgMSk7XG5cdFx0Y29uc3QgZW5kTGluZSA9IE1hdGgubWluKHBvcy5saW5lTnVtYmVyICsgbnVtTGluZXMsIG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZShzdGFydExpbmUsIDEsIGVuZExpbmUsIG1vZGVsLmdldExpbmVNYXhDb2x1bW4oZW5kTGluZSkpO1xuXHRcdHJldHVybiB0aGlzLl9nZXRTeW1ib2xzSW5SYW5nZShtb2RlbCwgcmFuZ2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZ2V0U3ltYm9sc05lYXJSYW5nZShtb2RlbDogSVRleHRNb2RlbCwgcmFuZ2U6IElSYW5nZSwgbnVtTGluZXM6IG51bWJlcik6IFByb21pc2U8RG9jdW1lbnRTeW1ib2xbXT4ge1xuXHRcdGNvbnN0IGNlbnRlckxpbmUgPSBNYXRoLmZsb29yKChyYW5nZS5zdGFydExpbmVOdW1iZXIgKyByYW5nZS5lbmRMaW5lTnVtYmVyKSAvIDIpO1xuXHRcdGNvbnN0IHN0YXJ0TGluZSA9IE1hdGgubWF4KGNlbnRlckxpbmUgLSBudW1MaW5lcywgMSk7XG5cdFx0Y29uc3QgZW5kTGluZSA9IE1hdGgubWluKGNlbnRlckxpbmUgKyBudW1MaW5lcywgbW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdGNvbnN0IHNlYXJjaFJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0TGluZSwgMSwgZW5kTGluZSwgbW9kZWwuZ2V0TGluZU1heENvbHVtbihlbmRMaW5lKSk7XG5cdFx0cmV0dXJuIHRoaXMuX2dldFN5bWJvbHNJblJhbmdlKG1vZGVsLCBzZWFyY2hSYW5nZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXRTeW1ib2xzSW5SYW5nZShtb2RlbDogSVRleHRNb2RlbCwgcmFuZ2U6IElSYW5nZSk6IFByb21pc2U8RG9jdW1lbnRTeW1ib2xbXT4ge1xuXHRcdGNvbnN0IHN5bWJvbHM6IERvY3VtZW50U3ltYm9sW10gPSBbXTtcblx0XHRjb25zdCBwcm92aWRlcnMgPSB0aGlzLl9sYW5nRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50U3ltYm9sUHJvdmlkZXIub3JkZXJlZChtb2RlbCk7XG5cdFx0Zm9yIChjb25zdCBwcm92aWRlciBvZiBwcm92aWRlcnMpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVEb2N1bWVudFN5bWJvbHMobW9kZWwsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdFx0Y29uc3QgZmxhdCA9IHRoaXMuX2ZsYXR0ZW5TeW1ib2xzKHJlc3VsdCk7XG5cdFx0XHRcdFx0Y29uc3QgaW50ZXJzZWN0aW5nID0gZmxhdC5maWx0ZXIoc3ltID0+IHRoaXMuX3Jhbmdlc0ludGVyc2VjdChzeW0ucmFuZ2UsIHJhbmdlKSk7XG5cdFx0XHRcdFx0c3ltYm9scy5wdXNoKC4uLmludGVyc2VjdGluZyk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdTeW1ib2wgcHJvdmlkZXIgZXJyb3I6JywgZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8vIEFsc28gY2hlY2sgcmVmZXJlbmNlIHByb3ZpZGVycy5cblx0XHRjb25zdCByZWZQcm92aWRlcnMgPSB0aGlzLl9sYW5nRmVhdHVyZXNTZXJ2aWNlLnJlZmVyZW5jZVByb3ZpZGVyLm9yZGVyZWQobW9kZWwpO1xuXHRcdGZvciAobGV0IGxpbmUgPSByYW5nZS5zdGFydExpbmVOdW1iZXI7IGxpbmUgPD0gcmFuZ2UuZW5kTGluZU51bWJlcjsgbGluZSsrKSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZSk7XG5cdFx0XHRjb25zdCB3b3JkcyA9IGNvbnRlbnQubWF0Y2goL1thLXpBLVpfXVxcdyovZykgfHwgW107XG5cdFx0XHRmb3IgKGNvbnN0IHdvcmQgb2Ygd29yZHMpIHtcblx0XHRcdFx0Y29uc3Qgc3RhcnRDb2x1bW4gPSBjb250ZW50LmluZGV4T2Yod29yZCkgKyAxO1xuXHRcdFx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24obGluZSwgc3RhcnRDb2x1bW4pO1xuXHRcdFx0XHRpZiAoIXRoaXMuX3Bvc2l0aW9uSW5SYW5nZShwb3MsIHJhbmdlKSkgY29udGludWU7XG5cdFx0XHRcdGZvciAoY29uc3QgcHJvdmlkZXIgb2YgcmVmUHJvdmlkZXJzKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IHJlZnMgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlUmVmZXJlbmNlcyhtb2RlbCwgcG9zLCB7IGluY2x1ZGVEZWNsYXJhdGlvbjogdHJ1ZSB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdFx0XHRcdGlmIChyZWZzKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGZpbHRlcmVkID0gcmVmcy5maWx0ZXIocmVmID0+IHRoaXMuX3Jhbmdlc0ludGVyc2VjdChyZWYucmFuZ2UsIHJhbmdlKSk7XG5cdFx0XHRcdFx0XHRcdGZvciAoY29uc3QgcmVmIG9mIGZpbHRlcmVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0c3ltYm9scy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6IHdvcmQsXG5cdFx0XHRcdFx0XHRcdFx0XHRkZXRhaWw6ICcnLFxuXHRcdFx0XHRcdFx0XHRcdFx0a2luZDogU3ltYm9sS2luZC5WYXJpYWJsZSxcblx0XHRcdFx0XHRcdFx0XHRcdHJhbmdlOiByZWYucmFuZ2UsXG5cdFx0XHRcdFx0XHRcdFx0XHRzZWxlY3Rpb25SYW5nZTogcmVmLnJhbmdlLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtdLFxuXHRcdFx0XHRcdFx0XHRcdFx0dGFnczogW11cblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignUmVmZXJlbmNlIHByb3ZpZGVyIGVycm9yOicsIGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gc3ltYm9scztcblx0fVxuXG5cdHByaXZhdGUgX2ZsYXR0ZW5TeW1ib2xzKHN5bWJvbHM6IERvY3VtZW50U3ltYm9sW10pOiBEb2N1bWVudFN5bWJvbFtdIHtcblx0XHRjb25zdCBmbGF0OiBEb2N1bWVudFN5bWJvbFtdID0gW107XG5cdFx0Zm9yIChjb25zdCBzeW0gb2Ygc3ltYm9scykge1xuXHRcdFx0ZmxhdC5wdXNoKHN5bSk7XG5cdFx0XHRpZiAoc3ltLmNoaWxkcmVuICYmIHN5bS5jaGlsZHJlbi5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGZsYXQucHVzaCguLi50aGlzLl9mbGF0dGVuU3ltYm9scyhzeW0uY2hpbGRyZW4pKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZsYXQ7XG5cdH1cblxuXHRwcml2YXRlIF9yYW5nZXNJbnRlcnNlY3QoYTogSVJhbmdlLCBiOiBJUmFuZ2UpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gIShcblx0XHRcdGEuZW5kTGluZU51bWJlciA8IGIuc3RhcnRMaW5lTnVtYmVyIHx8XG5cdFx0XHRhLnN0YXJ0TGluZU51bWJlciA+IGIuZW5kTGluZU51bWJlciB8fFxuXHRcdFx0KGEuZW5kTGluZU51bWJlciA9PT0gYi5zdGFydExpbmVOdW1iZXIgJiYgYS5lbmRDb2x1bW4gPCBiLnN0YXJ0Q29sdW1uKSB8fFxuXHRcdFx0KGEuc3RhcnRMaW5lTnVtYmVyID09PSBiLmVuZExpbmVOdW1iZXIgJiYgYS5lbmRDb2x1bW4gPiBiLmVuZENvbHVtbilcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcG9zaXRpb25JblJhbmdlKHBvczogUG9zaXRpb24sIHJhbmdlOiBJUmFuZ2UpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gcG9zLmxpbmVOdW1iZXIgPj0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICYmXG5cdFx0XHRwb3MubGluZU51bWJlciA8PSByYW5nZS5lbmRMaW5lTnVtYmVyICYmXG5cdFx0XHQocG9zLmxpbmVOdW1iZXIgIT09IHJhbmdlLnN0YXJ0TGluZU51bWJlciB8fCBwb3MuY29sdW1uID49IHJhbmdlLnN0YXJ0Q29sdW1uKSAmJlxuXHRcdFx0KHBvcy5saW5lTnVtYmVyICE9PSByYW5nZS5lbmRMaW5lTnVtYmVyIHx8IHBvcy5jb2x1bW4gPD0gcmFuZ2UuZW5kQ29sdW1uKTtcblx0fVxuXG5cdC8vIEdldCBkZWZpbml0aW9uIHN5bWJvbHMgZm9yIGEgZ2l2ZW4gc3ltYm9sLlxuXHRwcml2YXRlIGFzeW5jIF9nZXREZWZpbml0aW9uU3ltYm9scyhtb2RlbDogSVRleHRNb2RlbCwgc3ltYm9sOiBEb2N1bWVudFN5bWJvbCk6IFByb21pc2U8KERvY3VtZW50U3ltYm9sICYgeyB1cmk6IFVSSSB9KVtdPiB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKHN5bWJvbC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIHN5bWJvbC5yYW5nZS5zdGFydENvbHVtbik7XG5cdFx0Y29uc3QgcHJvdmlkZXJzID0gdGhpcy5fbGFuZ0ZlYXR1cmVzU2VydmljZS5kZWZpbml0aW9uUHJvdmlkZXIub3JkZXJlZChtb2RlbCk7XG5cdFx0Y29uc3QgZGVmczogKERvY3VtZW50U3ltYm9sICYgeyB1cmk6IFVSSSB9KVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBwcm92aWRlciBvZiBwcm92aWRlcnMpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHJlcyA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVEZWZpbml0aW9uKG1vZGVsLCBwb3MsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0XHRpZiAocmVzKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGlua3MgPSBBcnJheS5pc0FycmF5KHJlcykgPyByZXMgOiBbcmVzXTtcblx0XHRcdFx0XHRkZWZzLnB1c2goLi4ubGlua3MubWFwKGxpbmsgPT4gKHtcblx0XHRcdFx0XHRcdG5hbWU6IHN5bWJvbC5uYW1lLFxuXHRcdFx0XHRcdFx0ZGV0YWlsOiBzeW1ib2wuZGV0YWlsLFxuXHRcdFx0XHRcdFx0a2luZDogc3ltYm9sLmtpbmQsXG5cdFx0XHRcdFx0XHRyYW5nZTogbGluay5yYW5nZSxcblx0XHRcdFx0XHRcdHNlbGVjdGlvblJhbmdlOiBsaW5rLnJhbmdlLFxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtdLFxuXHRcdFx0XHRcdFx0dGFnczogc3ltYm9sLnRhZ3MgfHwgW10sXG5cdFx0XHRcdFx0XHR1cmk6IGxpbmsudXJpICAvLyBOb3cga2VlcGluZyBpdCBhcyBVUkkgaW5zdGVhZCBvZiBjb252ZXJ0aW5nIHRvIHN0cmluZ1xuXHRcdFx0XHRcdH0pKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdEZWZpbml0aW9uIHByb3ZpZGVyIGVycm9yOicsIGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZGVmcztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2ZpbmRDb250YWluZXJGdW5jdGlvbihtb2RlbDogSVRleHRNb2RlbCwgcG9zOiBQb3NpdGlvbik6IFByb21pc2U8RG9jdW1lbnRTeW1ib2wgfCBudWxsPiB7XG5cdFx0Y29uc3Qgc2VhcmNoUmFuZ2UgPSBuZXcgUmFuZ2UoXG5cdFx0XHRNYXRoLm1heChwb3MubGluZU51bWJlciAtIDEsIDEpLCAxLFxuXHRcdFx0TWF0aC5taW4ocG9zLmxpbmVOdW1iZXIgKyAxLCBtb2RlbC5nZXRMaW5lQ291bnQoKSksXG5cdFx0XHRtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHBvcy5saW5lTnVtYmVyKVxuXHRcdCk7XG5cdFx0Y29uc3Qgc3ltYm9scyA9IGF3YWl0IHRoaXMuX2dldFN5bWJvbHNJblJhbmdlKG1vZGVsLCBzZWFyY2hSYW5nZSk7XG5cdFx0Y29uc3QgZnVuY3MgPSBzeW1ib2xzLmZpbHRlcihzID0+XG5cdFx0XHQocy5raW5kID09PSBTeW1ib2xLaW5kLkZ1bmN0aW9uIHx8IHMua2luZCA9PT0gU3ltYm9sS2luZC5NZXRob2QpICYmXG5cdFx0XHR0aGlzLl9wb3NpdGlvbkluUmFuZ2UocG9zLCBzLnJhbmdlKVxuXHRcdCk7XG5cdFx0aWYgKCFmdW5jcy5sZW5ndGgpIHJldHVybiBudWxsO1xuXHRcdHJldHVybiBmdW5jcy5yZWR1Y2UoKGlubmVybW9zdCwgY3VycmVudCkgPT4ge1xuXHRcdFx0aWYgKCFpbm5lcm1vc3QpIHJldHVybiBjdXJyZW50O1xuXHRcdFx0Y29uc3QgbW9yZUlubmVyID1cblx0XHRcdFx0KGN1cnJlbnQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID4gaW5uZXJtb3N0LnJhbmdlLnN0YXJ0TGluZU51bWJlciB8fFxuXHRcdFx0XHRcdChjdXJyZW50LnJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gaW5uZXJtb3N0LnJhbmdlLnN0YXJ0TGluZU51bWJlciAmJlxuXHRcdFx0XHRcdFx0Y3VycmVudC5yYW5nZS5zdGFydENvbHVtbiA+IGlubmVybW9zdC5yYW5nZS5zdGFydENvbHVtbikpICYmXG5cdFx0XHRcdChjdXJyZW50LnJhbmdlLmVuZExpbmVOdW1iZXIgPCBpbm5lcm1vc3QucmFuZ2UuZW5kTGluZU51bWJlciB8fFxuXHRcdFx0XHRcdChjdXJyZW50LnJhbmdlLmVuZExpbmVOdW1iZXIgPT09IGlubmVybW9zdC5yYW5nZS5lbmRMaW5lTnVtYmVyICYmXG5cdFx0XHRcdFx0XHRjdXJyZW50LnJhbmdlLmVuZENvbHVtbiA8IGlubmVybW9zdC5yYW5nZS5lbmRDb2x1bW4pKTtcblx0XHRcdHJldHVybiBtb3JlSW5uZXIgPyBjdXJyZW50IDogaW5uZXJtb3N0O1xuXHRcdH0sIG51bGwgYXMgRG9jdW1lbnRTeW1ib2wgfCBudWxsKTtcblx0fVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJQ29udGV4dEdhdGhlcmluZ1NlcnZpY2UsIENvbnRleHRHYXRoZXJpbmdTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUFBLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQXlCLGtCQUFrQjtBQUUzQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGFBQXFCO0FBQzlCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDBCQUEwQjtBQXFCNUIsTUFBTSwyQkFBMkIsZ0JBQTBDLHlCQUF5QjtBQUUzRyxJQUFNLDBCQUFOLGNBQXNDLFdBQStDO0FBQUEsRUFRcEYsWUFDNEMsc0JBQ1gsZUFDSyxvQkFDcEM7QUFDRCxVQUFNO0FBSnFDO0FBQ1g7QUFDSztBQVR0QyxTQUFpQixhQUFhO0FBQzlCLFNBQWlCLHFCQUFxQjtBQUV0QztBQUFBO0FBQUEsU0FBUSxTQUFtQixDQUFDO0FBQzVCLFNBQVEsb0JBQXdDLENBQUM7QUFRaEQsU0FBSyxjQUFjLFVBQVUsRUFBRSxRQUFRLFdBQVMsS0FBSyxrQkFBa0IsS0FBSyxDQUFDO0FBQzdFLFNBQUssVUFBVSxLQUFLLGNBQWMsYUFBYSxXQUFTLEtBQUssa0JBQWtC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
