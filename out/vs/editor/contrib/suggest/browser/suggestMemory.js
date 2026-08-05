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
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { LRUCache } from "../../../../base/common/map.js";
import { TernarySearchTree } from "../../../../base/common/ternarySearchTree.js";
import { CompletionItemKinds } from "../../../common/languages.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from "../../../../platform/storage/common/storage.js";
class Memory {
  constructor(name) {
    this.name = name;
  }
  select(model, pos, items) {
    if (items.length === 0) {
      return 0;
    }
    const topScore = items[0].score[0];
    for (let i = 0; i < items.length; i++) {
      const { score, completion: suggestion } = items[i];
      if (score[0] !== topScore) {
        break;
      }
      if (suggestion.preselect) {
        return i;
      }
    }
    return 0;
  }
}
class NoMemory extends Memory {
  constructor() {
    super("first");
  }
  memorize(model, pos, item) {
  }
  toJSON() {
    return void 0;
  }
  fromJSON() {
  }
}
class LRUMemory extends Memory {
  constructor() {
    super("recentlyUsed");
    this._cache = new LRUCache(300, 0.66);
    this._seq = 0;
  }
  memorize(model, pos, item) {
    const key = `${model.getLanguageId()}/${item.textLabel}`;
    this._cache.set(key, {
      touch: this._seq++,
      type: item.completion.kind,
      insertText: item.completion.insertText
    });
  }
  select(model, pos, items) {
    if (items.length === 0) {
      return 0;
    }
    const lineSuffix = model.getLineContent(pos.lineNumber).substr(pos.column - 10, pos.column - 1);
    if (/\s$/.test(lineSuffix)) {
      return super.select(model, pos, items);
    }
    const topScore = items[0].score[0];
    let indexPreselect = -1;
    let indexRecency = -1;
    let seq = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i].score[0] !== topScore) {
        break;
      }
      const key = `${model.getLanguageId()}/${items[i].textLabel}`;
      const item = this._cache.peek(key);
      if (item && item.touch > seq && item.type === items[i].completion.kind && item.insertText === items[i].completion.insertText) {
        seq = item.touch;
        indexRecency = i;
      }
      if (items[i].completion.preselect && indexPreselect === -1) {
        return indexPreselect = i;
      }
    }
    if (indexRecency !== -1) {
      return indexRecency;
    } else if (indexPreselect !== -1) {
      return indexPreselect;
    } else {
      return 0;
    }
  }
  toJSON() {
    return this._cache.toJSON();
  }
  fromJSON(data) {
    this._cache.clear();
    const seq = 0;
    for (const [key, value] of data) {
      value.touch = seq;
      value.type = typeof value.type === "number" ? value.type : CompletionItemKinds.fromString(value.type);
      this._cache.set(key, value);
    }
    this._seq = this._cache.size;
  }
}
class PrefixMemory extends Memory {
  constructor() {
    super("recentlyUsedByPrefix");
    this._trie = TernarySearchTree.forStrings();
    this._seq = 0;
  }
  memorize(model, pos, item) {
    const { word } = model.getWordUntilPosition(pos);
    const key = `${model.getLanguageId()}/${word}`;
    this._trie.set(key, {
      type: item.completion.kind,
      insertText: item.completion.insertText,
      touch: this._seq++
    });
  }
  select(model, pos, items) {
    const { word } = model.getWordUntilPosition(pos);
    if (!word) {
      return super.select(model, pos, items);
    }
    const key = `${model.getLanguageId()}/${word}`;
    let item = this._trie.get(key);
    if (!item) {
      item = this._trie.findSubstr(key);
    }
    if (item) {
      for (let i = 0; i < items.length; i++) {
        const { kind, insertText } = items[i].completion;
        if (kind === item.type && insertText === item.insertText) {
          return i;
        }
      }
    }
    return super.select(model, pos, items);
  }
  toJSON() {
    const entries = [];
    this._trie.forEach((value, key) => entries.push([key, value]));
    entries.sort((a, b) => -(a[1].touch - b[1].touch)).forEach((value, i) => value[1].touch = i);
    return entries.slice(0, 200);
  }
  fromJSON(data) {
    this._trie.clear();
    if (data.length > 0) {
      this._seq = data[0][1].touch + 1;
      for (const [key, value] of data) {
        value.type = typeof value.type === "number" ? value.type : CompletionItemKinds.fromString(value.type);
        this._trie.set(key, value);
      }
    }
  }
}
let SuggestMemoryService = class {
  constructor(_storageService, _configService) {
    this._storageService = _storageService;
    this._configService = _configService;
    this._disposables = new DisposableStore();
    this._persistSoon = new RunOnceScheduler(() => this._saveState(), 500);
    this._disposables.add(_storageService.onWillSaveState((e) => {
      if (e.reason === WillSaveStateReason.SHUTDOWN) {
        this._saveState();
      }
    }));
  }
  dispose() {
    this._disposables.dispose();
    this._persistSoon.dispose();
  }
  memorize(model, pos, item) {
    this._withStrategy(model, pos).memorize(model, pos, item);
    this._persistSoon.schedule();
  }
  select(model, pos, items) {
    return this._withStrategy(model, pos).select(model, pos, items);
  }
  _withStrategy(model, pos) {
    const mode = this._configService.getValue("editor.suggestSelection", {
      overrideIdentifier: model.getLanguageIdAtPosition(pos.lineNumber, pos.column),
      resource: model.uri
    });
    if (this._strategy?.name !== mode) {
      this._saveState();
      const ctor = SuggestMemoryService._strategyCtors.get(mode) || NoMemory;
      this._strategy = new ctor();
      try {
        const share = this._configService.getValue("editor.suggest.shareSuggestSelections");
        const scope = share ? StorageScope.PROFILE : StorageScope.WORKSPACE;
        const raw = this._storageService.get(`${SuggestMemoryService._storagePrefix}/${mode}`, scope);
        if (raw) {
          this._strategy.fromJSON(JSON.parse(raw));
        }
      } catch (e) {
      }
    }
    return this._strategy;
  }
  _saveState() {
    if (this._strategy) {
      const share = this._configService.getValue("editor.suggest.shareSuggestSelections");
      const scope = share ? StorageScope.PROFILE : StorageScope.WORKSPACE;
      const raw = JSON.stringify(this._strategy);
      this._storageService.store(`${SuggestMemoryService._storagePrefix}/${this._strategy.name}`, raw, scope, StorageTarget.MACHINE);
    }
  }
};
SuggestMemoryService._strategyCtors = /* @__PURE__ */ new Map([
  ["recentlyUsedByPrefix", PrefixMemory],
  ["recentlyUsed", LRUMemory],
  ["first", NoMemory]
]);
SuggestMemoryService._storagePrefix = "suggest/memories";
SuggestMemoryService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IConfigurationService)
], SuggestMemoryService);
const ISuggestMemoryService = createDecorator("ISuggestMemories");
registerSingleton(ISuggestMemoryService, SuggestMemoryService, InstantiationType.Delayed);
export {
  ISuggestMemoryService,
  LRUMemory,
  Memory,
  NoMemory,
  PrefixMemory,
  SuggestMemoryService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdE1lbW9yeS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblxuaW1wb3J0IHsgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBMUlVDYWNoZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBUZXJuYXJ5U2VhcmNoVHJlZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Rlcm5hcnlTZWFyY2hUcmVlLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgQ29tcGxldGlvbkl0ZW1LaW5kLCBDb21wbGV0aW9uSXRlbUtpbmRzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBDb21wbGV0aW9uSXRlbSB9IGZyb20gJy4vc3VnZ2VzdC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCwgV2lsbFNhdmVTdGF0ZVJlYXNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgTWVtb3J5IHtcblxuXHRjb25zdHJ1Y3RvcihyZWFkb25seSBuYW1lOiBNZW1Nb2RlKSB7IH1cblxuXHRzZWxlY3QobW9kZWw6IElUZXh0TW9kZWwsIHBvczogSVBvc2l0aW9uLCBpdGVtczogQ29tcGxldGlvbkl0ZW1bXSk6IG51bWJlciB7XG5cdFx0aWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdGNvbnN0IHRvcFNjb3JlID0gaXRlbXNbMF0uc2NvcmVbMF07XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgeyBzY29yZSwgY29tcGxldGlvbjogc3VnZ2VzdGlvbiB9ID0gaXRlbXNbaV07XG5cdFx0XHRpZiAoc2NvcmVbMF0gIT09IHRvcFNjb3JlKSB7XG5cdFx0XHRcdC8vIHN0b3Agd2hlbiBsZWF2aW5nIHRoZSBncm91cCBvZiB0b3AgbWF0Y2hlc1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGlmIChzdWdnZXN0aW9uLnByZXNlbGVjdCkge1xuXHRcdFx0XHQvLyBzdG9wIHdoZW4gc2VlaW5nIGFuIGF1dG8tc2VsZWN0LWl0ZW1cblx0XHRcdFx0cmV0dXJuIGk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiAwO1xuXHR9XG5cblx0YWJzdHJhY3QgbWVtb3JpemUobW9kZWw6IElUZXh0TW9kZWwsIHBvczogSVBvc2l0aW9uLCBpdGVtOiBDb21wbGV0aW9uSXRlbSk6IHZvaWQ7XG5cblx0YWJzdHJhY3QgdG9KU09OKCk6IG9iamVjdCB8IHVuZGVmaW5lZDtcblxuXHRhYnN0cmFjdCBmcm9tSlNPTihkYXRhOiBvYmplY3QpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgTm9NZW1vcnkgZXh0ZW5kcyBNZW1vcnkge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCdmaXJzdCcpO1xuXHR9XG5cblx0bWVtb3JpemUobW9kZWw6IElUZXh0TW9kZWwsIHBvczogSVBvc2l0aW9uLCBpdGVtOiBDb21wbGV0aW9uSXRlbSk6IHZvaWQge1xuXHRcdC8vIG5vLW9wXG5cdH1cblxuXHR0b0pTT04oKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGZyb21KU09OKCkge1xuXHRcdC8vXG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBNZW1JdGVtIHtcblx0dHlwZTogc3RyaW5nIHwgQ29tcGxldGlvbkl0ZW1LaW5kO1xuXHRpbnNlcnRUZXh0OiBzdHJpbmc7XG5cdHRvdWNoOiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBMUlVNZW1vcnkgZXh0ZW5kcyBNZW1vcnkge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCdyZWNlbnRseVVzZWQnKTtcblx0fVxuXG5cdHByaXZhdGUgX2NhY2hlID0gbmV3IExSVUNhY2hlPHN0cmluZywgTWVtSXRlbT4oMzAwLCAwLjY2KTtcblx0cHJpdmF0ZSBfc2VxID0gMDtcblxuXHRtZW1vcml6ZShtb2RlbDogSVRleHRNb2RlbCwgcG9zOiBJUG9zaXRpb24sIGl0ZW06IENvbXBsZXRpb25JdGVtKTogdm9pZCB7XG5cdFx0Y29uc3Qga2V5ID0gYCR7bW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpfS8ke2l0ZW0udGV4dExhYmVsfWA7XG5cdFx0dGhpcy5fY2FjaGUuc2V0KGtleSwge1xuXHRcdFx0dG91Y2g6IHRoaXMuX3NlcSsrLFxuXHRcdFx0dHlwZTogaXRlbS5jb21wbGV0aW9uLmtpbmQsXG5cdFx0XHRpbnNlcnRUZXh0OiBpdGVtLmNvbXBsZXRpb24uaW5zZXJ0VGV4dFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2VsZWN0KG1vZGVsOiBJVGV4dE1vZGVsLCBwb3M6IElQb3NpdGlvbiwgaXRlbXM6IENvbXBsZXRpb25JdGVtW10pOiBudW1iZXIge1xuXG5cdFx0aWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZVN1ZmZpeCA9IG1vZGVsLmdldExpbmVDb250ZW50KHBvcy5saW5lTnVtYmVyKS5zdWJzdHIocG9zLmNvbHVtbiAtIDEwLCBwb3MuY29sdW1uIC0gMSk7XG5cdFx0aWYgKC9cXHMkLy50ZXN0KGxpbmVTdWZmaXgpKSB7XG5cdFx0XHRyZXR1cm4gc3VwZXIuc2VsZWN0KG1vZGVsLCBwb3MsIGl0ZW1zKTtcblx0XHR9XG5cblx0XHRjb25zdCB0b3BTY29yZSA9IGl0ZW1zWzBdLnNjb3JlWzBdO1xuXHRcdGxldCBpbmRleFByZXNlbGVjdCA9IC0xO1xuXHRcdGxldCBpbmRleFJlY2VuY3kgPSAtMTtcblx0XHRsZXQgc2VxID0gLTE7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKGl0ZW1zW2ldLnNjb3JlWzBdICE9PSB0b3BTY29yZSkge1xuXHRcdFx0XHQvLyBjb25zaWRlciBvbmx5IHRvcCBpdGVtc1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNvbnN0IGtleSA9IGAke21vZGVsLmdldExhbmd1YWdlSWQoKX0vJHtpdGVtc1tpXS50ZXh0TGFiZWx9YDtcblx0XHRcdGNvbnN0IGl0ZW0gPSB0aGlzLl9jYWNoZS5wZWVrKGtleSk7XG5cdFx0XHRpZiAoaXRlbSAmJiBpdGVtLnRvdWNoID4gc2VxICYmIGl0ZW0udHlwZSA9PT0gaXRlbXNbaV0uY29tcGxldGlvbi5raW5kICYmIGl0ZW0uaW5zZXJ0VGV4dCA9PT0gaXRlbXNbaV0uY29tcGxldGlvbi5pbnNlcnRUZXh0KSB7XG5cdFx0XHRcdHNlcSA9IGl0ZW0udG91Y2g7XG5cdFx0XHRcdGluZGV4UmVjZW5jeSA9IGk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoaXRlbXNbaV0uY29tcGxldGlvbi5wcmVzZWxlY3QgJiYgaW5kZXhQcmVzZWxlY3QgPT09IC0xKSB7XG5cdFx0XHRcdC8vIHN0b3Agd2hlbiBzZWVpbmcgYW4gYXV0by1zZWxlY3QtaXRlbVxuXHRcdFx0XHRyZXR1cm4gaW5kZXhQcmVzZWxlY3QgPSBpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoaW5kZXhSZWNlbmN5ICE9PSAtMSkge1xuXHRcdFx0cmV0dXJuIGluZGV4UmVjZW5jeTtcblx0XHR9IGVsc2UgaWYgKGluZGV4UHJlc2VsZWN0ICE9PSAtMSkge1xuXHRcdFx0cmV0dXJuIGluZGV4UHJlc2VsZWN0O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdH1cblxuXHR0b0pTT04oKTogb2JqZWN0IHtcblx0XHRyZXR1cm4gdGhpcy5fY2FjaGUudG9KU09OKCk7XG5cdH1cblxuXHRmcm9tSlNPTihkYXRhOiBbc3RyaW5nLCBNZW1JdGVtXVtdKTogdm9pZCB7XG5cdFx0dGhpcy5fY2FjaGUuY2xlYXIoKTtcblx0XHRjb25zdCBzZXEgPSAwO1xuXHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIGRhdGEpIHtcblx0XHRcdHZhbHVlLnRvdWNoID0gc2VxO1xuXHRcdFx0dmFsdWUudHlwZSA9IHR5cGVvZiB2YWx1ZS50eXBlID09PSAnbnVtYmVyJyA/IHZhbHVlLnR5cGUgOiBDb21wbGV0aW9uSXRlbUtpbmRzLmZyb21TdHJpbmcodmFsdWUudHlwZSk7XG5cdFx0XHR0aGlzLl9jYWNoZS5zZXQoa2V5LCB2YWx1ZSk7XG5cdFx0fVxuXHRcdHRoaXMuX3NlcSA9IHRoaXMuX2NhY2hlLnNpemU7XG5cdH1cbn1cblxuXG5leHBvcnQgY2xhc3MgUHJlZml4TWVtb3J5IGV4dGVuZHMgTWVtb3J5IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcigncmVjZW50bHlVc2VkQnlQcmVmaXgnKTtcblx0fVxuXG5cdHByaXZhdGUgX3RyaWUgPSBUZXJuYXJ5U2VhcmNoVHJlZS5mb3JTdHJpbmdzPE1lbUl0ZW0+KCk7XG5cdHByaXZhdGUgX3NlcSA9IDA7XG5cblx0bWVtb3JpemUobW9kZWw6IElUZXh0TW9kZWwsIHBvczogSVBvc2l0aW9uLCBpdGVtOiBDb21wbGV0aW9uSXRlbSk6IHZvaWQge1xuXHRcdGNvbnN0IHsgd29yZCB9ID0gbW9kZWwuZ2V0V29yZFVudGlsUG9zaXRpb24ocG9zKTtcblx0XHRjb25zdCBrZXkgPSBgJHttb2RlbC5nZXRMYW5ndWFnZUlkKCl9LyR7d29yZH1gO1xuXHRcdHRoaXMuX3RyaWUuc2V0KGtleSwge1xuXHRcdFx0dHlwZTogaXRlbS5jb21wbGV0aW9uLmtpbmQsXG5cdFx0XHRpbnNlcnRUZXh0OiBpdGVtLmNvbXBsZXRpb24uaW5zZXJ0VGV4dCxcblx0XHRcdHRvdWNoOiB0aGlzLl9zZXErK1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2VsZWN0KG1vZGVsOiBJVGV4dE1vZGVsLCBwb3M6IElQb3NpdGlvbiwgaXRlbXM6IENvbXBsZXRpb25JdGVtW10pOiBudW1iZXIge1xuXHRcdGNvbnN0IHsgd29yZCB9ID0gbW9kZWwuZ2V0V29yZFVudGlsUG9zaXRpb24ocG9zKTtcblx0XHRpZiAoIXdvcmQpIHtcblx0XHRcdHJldHVybiBzdXBlci5zZWxlY3QobW9kZWwsIHBvcywgaXRlbXMpO1xuXHRcdH1cblx0XHRjb25zdCBrZXkgPSBgJHttb2RlbC5nZXRMYW5ndWFnZUlkKCl9LyR7d29yZH1gO1xuXHRcdGxldCBpdGVtID0gdGhpcy5fdHJpZS5nZXQoa2V5KTtcblx0XHRpZiAoIWl0ZW0pIHtcblx0XHRcdGl0ZW0gPSB0aGlzLl90cmllLmZpbmRTdWJzdHIoa2V5KTtcblx0XHR9XG5cdFx0aWYgKGl0ZW0pIHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgeyBraW5kLCBpbnNlcnRUZXh0IH0gPSBpdGVtc1tpXS5jb21wbGV0aW9uO1xuXHRcdFx0XHRpZiAoa2luZCA9PT0gaXRlbS50eXBlICYmIGluc2VydFRleHQgPT09IGl0ZW0uaW5zZXJ0VGV4dCkge1xuXHRcdFx0XHRcdHJldHVybiBpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBzdXBlci5zZWxlY3QobW9kZWwsIHBvcywgaXRlbXMpO1xuXHR9XG5cblx0dG9KU09OKCk6IG9iamVjdCB7XG5cblx0XHRjb25zdCBlbnRyaWVzOiBbc3RyaW5nLCBNZW1JdGVtXVtdID0gW107XG5cdFx0dGhpcy5fdHJpZS5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiBlbnRyaWVzLnB1c2goW2tleSwgdmFsdWVdKSk7XG5cblx0XHQvLyBzb3J0IGJ5IGxhc3QgcmVjZW50bHkgdXNlZCAodG91Y2gpLCB0aGVuXG5cdFx0Ly8gdGFrZSB0aGUgdG9wIDIwMCBpdGVtIGFuZCBub3JtYWxpemUgdGhlaXJcblx0XHQvLyB0b3VjaFxuXHRcdGVudHJpZXNcblx0XHRcdC5zb3J0KChhLCBiKSA9PiAtKGFbMV0udG91Y2ggLSBiWzFdLnRvdWNoKSlcblx0XHRcdC5mb3JFYWNoKCh2YWx1ZSwgaSkgPT4gdmFsdWVbMV0udG91Y2ggPSBpKTtcblxuXHRcdHJldHVybiBlbnRyaWVzLnNsaWNlKDAsIDIwMCk7XG5cdH1cblxuXHRmcm9tSlNPTihkYXRhOiBbc3RyaW5nLCBNZW1JdGVtXVtdKTogdm9pZCB7XG5cdFx0dGhpcy5fdHJpZS5jbGVhcigpO1xuXHRcdGlmIChkYXRhLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuX3NlcSA9IGRhdGFbMF1bMV0udG91Y2ggKyAxO1xuXHRcdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgZGF0YSkge1xuXHRcdFx0XHR2YWx1ZS50eXBlID0gdHlwZW9mIHZhbHVlLnR5cGUgPT09ICdudW1iZXInID8gdmFsdWUudHlwZSA6IENvbXBsZXRpb25JdGVtS2luZHMuZnJvbVN0cmluZyh2YWx1ZS50eXBlKTtcblx0XHRcdFx0dGhpcy5fdHJpZS5zZXQoa2V5LCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCB0eXBlIE1lbU1vZGUgPSAnZmlyc3QnIHwgJ3JlY2VudGx5VXNlZCcgfCAncmVjZW50bHlVc2VkQnlQcmVmaXgnO1xuXG5leHBvcnQgY2xhc3MgU3VnZ2VzdE1lbW9yeVNlcnZpY2UgaW1wbGVtZW50cyBJU3VnZ2VzdE1lbW9yeVNlcnZpY2Uge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9zdHJhdGVneUN0b3JzID0gbmV3IE1hcDxNZW1Nb2RlLCB7IG5ldygpOiBNZW1vcnkgfT4oW1xuXHRcdFsncmVjZW50bHlVc2VkQnlQcmVmaXgnLCBQcmVmaXhNZW1vcnldLFxuXHRcdFsncmVjZW50bHlVc2VkJywgTFJVTWVtb3J5XSxcblx0XHRbJ2ZpcnN0JywgTm9NZW1vcnldXG5cdF0pO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9zdG9yYWdlUHJlZml4ID0gJ3N1Z2dlc3QvbWVtb3JpZXMnO1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3BlcnNpc3RTb29uOiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIF9zdHJhdGVneT86IE1lbW9yeTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWdTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX3BlcnNpc3RTb29uID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5fc2F2ZVN0YXRlKCksIDUwMCk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKF9zdG9yYWdlU2VydmljZS5vbldpbGxTYXZlU3RhdGUoZSA9PiB7XG5cdFx0XHRpZiAoZS5yZWFzb24gPT09IFdpbGxTYXZlU3RhdGVSZWFzb24uU0hVVERPV04pIHtcblx0XHRcdFx0dGhpcy5fc2F2ZVN0YXRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fcGVyc2lzdFNvb24uZGlzcG9zZSgpO1xuXHR9XG5cblx0bWVtb3JpemUobW9kZWw6IElUZXh0TW9kZWwsIHBvczogSVBvc2l0aW9uLCBpdGVtOiBDb21wbGV0aW9uSXRlbSk6IHZvaWQge1xuXHRcdHRoaXMuX3dpdGhTdHJhdGVneShtb2RlbCwgcG9zKS5tZW1vcml6ZShtb2RlbCwgcG9zLCBpdGVtKTtcblx0XHR0aGlzLl9wZXJzaXN0U29vbi5zY2hlZHVsZSgpO1xuXHR9XG5cblx0c2VsZWN0KG1vZGVsOiBJVGV4dE1vZGVsLCBwb3M6IElQb3NpdGlvbiwgaXRlbXM6IENvbXBsZXRpb25JdGVtW10pOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl93aXRoU3RyYXRlZ3kobW9kZWwsIHBvcykuc2VsZWN0KG1vZGVsLCBwb3MsIGl0ZW1zKTtcblx0fVxuXG5cdHByaXZhdGUgX3dpdGhTdHJhdGVneShtb2RlbDogSVRleHRNb2RlbCwgcG9zOiBJUG9zaXRpb24pOiBNZW1vcnkge1xuXG5cdFx0Y29uc3QgbW9kZSA9IHRoaXMuX2NvbmZpZ1NlcnZpY2UuZ2V0VmFsdWU8TWVtTW9kZT4oJ2VkaXRvci5zdWdnZXN0U2VsZWN0aW9uJywge1xuXHRcdFx0b3ZlcnJpZGVJZGVudGlmaWVyOiBtb2RlbC5nZXRMYW5ndWFnZUlkQXRQb3NpdGlvbihwb3MubGluZU51bWJlciwgcG9zLmNvbHVtbiksXG5cdFx0XHRyZXNvdXJjZTogbW9kZWwudXJpXG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy5fc3RyYXRlZ3k/Lm5hbWUgIT09IG1vZGUpIHtcblxuXHRcdFx0dGhpcy5fc2F2ZVN0YXRlKCk7XG5cdFx0XHRjb25zdCBjdG9yID0gU3VnZ2VzdE1lbW9yeVNlcnZpY2UuX3N0cmF0ZWd5Q3RvcnMuZ2V0KG1vZGUpIHx8IE5vTWVtb3J5O1xuXHRcdFx0dGhpcy5fc3RyYXRlZ3kgPSBuZXcgY3RvcigpO1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBzaGFyZSA9IHRoaXMuX2NvbmZpZ1NlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2VkaXRvci5zdWdnZXN0LnNoYXJlU3VnZ2VzdFNlbGVjdGlvbnMnKTtcblx0XHRcdFx0Y29uc3Qgc2NvcGUgPSBzaGFyZSA/IFN0b3JhZ2VTY29wZS5QUk9GSUxFIDogU3RvcmFnZVNjb3BlLldPUktTUEFDRTtcblx0XHRcdFx0Y29uc3QgcmF3ID0gdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0KGAke1N1Z2dlc3RNZW1vcnlTZXJ2aWNlLl9zdG9yYWdlUHJlZml4fS8ke21vZGV9YCwgc2NvcGUpO1xuXHRcdFx0XHRpZiAocmF3KSB7XG5cdFx0XHRcdFx0dGhpcy5fc3RyYXRlZ3kuZnJvbUpTT04oSlNPTi5wYXJzZShyYXcpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHQvLyB0aGluZ3MgY2FuIGdvIHdyb25nIHdpdGggSlNPTi4uLlxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9zdHJhdGVneTtcblx0fVxuXG5cdHByaXZhdGUgX3NhdmVTdGF0ZSgpIHtcblx0XHRpZiAodGhpcy5fc3RyYXRlZ3kpIHtcblx0XHRcdGNvbnN0IHNoYXJlID0gdGhpcy5fY29uZmlnU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignZWRpdG9yLnN1Z2dlc3Quc2hhcmVTdWdnZXN0U2VsZWN0aW9ucycpO1xuXHRcdFx0Y29uc3Qgc2NvcGUgPSBzaGFyZSA/IFN0b3JhZ2VTY29wZS5QUk9GSUxFIDogU3RvcmFnZVNjb3BlLldPUktTUEFDRTtcblx0XHRcdGNvbnN0IHJhdyA9IEpTT04uc3RyaW5naWZ5KHRoaXMuX3N0cmF0ZWd5KTtcblx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKGAke1N1Z2dlc3RNZW1vcnlTZXJ2aWNlLl9zdG9yYWdlUHJlZml4fS8ke3RoaXMuX3N0cmF0ZWd5Lm5hbWV9YCwgcmF3LCBzY29wZSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR9XG5cdH1cbn1cblxuXG5leHBvcnQgY29uc3QgSVN1Z2dlc3RNZW1vcnlTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElTdWdnZXN0TWVtb3J5U2VydmljZT4oJ0lTdWdnZXN0TWVtb3JpZXMnKTtcblxuZXhwb3J0IGludGVyZmFjZSBJU3VnZ2VzdE1lbW9yeVNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdG1lbW9yaXplKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3M6IElQb3NpdGlvbiwgaXRlbTogQ29tcGxldGlvbkl0ZW0pOiB2b2lkO1xuXHRzZWxlY3QobW9kZWw6IElUZXh0TW9kZWwsIHBvczogSVBvc2l0aW9uLCBpdGVtczogQ29tcGxldGlvbkl0ZW1bXSk6IG51bWJlcjtcbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSVN1Z2dlc3RNZW1vcnlTZXJ2aWNlLCBTdWdnZXN0TWVtb3J5U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMseUJBQXlCO0FBR2xDLFNBQTZCLDJCQUEyQjtBQUV4RCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxpQkFBaUIsY0FBYyxlQUFlLDJCQUEyQjtBQUUzRSxNQUFlLE9BQU87QUFBQSxFQUU1QixZQUFxQixNQUFlO0FBQWY7QUFBQSxFQUFpQjtBQUFBLEVBRXRDLE9BQU8sT0FBbUIsS0FBZ0IsT0FBaUM7QUFDMUUsUUFBSSxNQUFNLFdBQVcsR0FBRztBQUN2QixhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sV0FBVyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUM7QUFDakMsYUFBUyxJQUFJLEdBQUcsSUFBSSxNQUFNLFFBQVEsS0FBSztBQUN0QyxZQUFNLEVBQUUsT0FBTyxZQUFZLFdBQVcsSUFBSSxNQUFNLENBQUM7QUFDakQsVUFBSSxNQUFNLENBQUMsTUFBTSxVQUFVO0FBRTFCO0FBQUEsTUFDRDtBQUNBLFVBQUksV0FBVyxXQUFXO0FBRXpCLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBT0Q7QUFFTyxNQUFNLGlCQUFpQixPQUFPO0FBQUEsRUFFcEMsY0FBYztBQUNiLFVBQU0sT0FBTztBQUFBLEVBQ2Q7QUFBQSxFQUVBLFNBQVMsT0FBbUIsS0FBZ0IsTUFBNEI7QUFBQSxFQUV4RTtB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
