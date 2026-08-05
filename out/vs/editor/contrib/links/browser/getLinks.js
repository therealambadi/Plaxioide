import { coalesce } from "../../../../base/common/arrays.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { onUnexpectedExternalError } from "../../../../base/common/errors.js";
import { DisposableStore, isDisposable } from "../../../../base/common/lifecycle.js";
import { assertType } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { Range } from "../../../common/core/range.js";
import { IModelService } from "../../../common/services/model.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
class Link {
  constructor(link, provider) {
    this._link = link;
    this._provider = provider;
  }
  toJSON() {
    return {
      range: this.range,
      url: this.url,
      tooltip: this.tooltip
    };
  }
  get range() {
    return this._link.range;
  }
  get url() {
    return this._link.url;
  }
  get tooltip() {
    return this._link.tooltip;
  }
  async resolve(token) {
    if (this._link.url) {
      return this._link.url;
    }
    if (typeof this._provider.resolveLink === "function") {
      return Promise.resolve(this._provider.resolveLink(this._link, token)).then((value) => {
        this._link = value || this._link;
        if (this._link.url) {
          return this.resolve(token);
        }
        return Promise.reject(new Error("missing"));
      });
    }
    return Promise.reject(new Error("missing"));
  }
}
const _LinksList = class _LinksList {
  constructor(tuples) {
    this._disposables = new DisposableStore();
    let links = [];
    for (const [list, provider] of tuples) {
      const newLinks = list.links.map((link) => new Link(link, provider));
      links = _LinksList._union(links, newLinks);
      if (isDisposable(list)) {
        this._disposables ??= new DisposableStore();
        this._disposables.add(list);
      }
    }
    this.links = links;
  }
  dispose() {
    this._disposables?.dispose();
    this.links.length = 0;
  }
  static _union(oldLinks, newLinks) {
    const result = [];
    let oldIndex;
    let oldLen;
    let newIndex;
    let newLen;
    for (oldIndex = 0, newIndex = 0, oldLen = oldLinks.length, newLen = newLinks.length; oldIndex < oldLen && newIndex < newLen; ) {
      const oldLink = oldLinks[oldIndex];
      const newLink = newLinks[newIndex];
      if (Range.areIntersectingOrTouching(oldLink.range, newLink.range)) {
        oldIndex++;
        continue;
      }
      const comparisonResult = Range.compareRangesUsingStarts(oldLink.range, newLink.range);
      if (comparisonResult < 0) {
        result.push(oldLink);
        oldIndex++;
      } else {
        result.push(newLink);
        newIndex++;
      }
    }
    for (; oldIndex < oldLen; oldIndex++) {
      result.push(oldLinks[oldIndex]);
    }
    for (; newIndex < newLen; newIndex++) {
      result.push(newLinks[newIndex]);
    }
    return result;
  }
};
_LinksList.Empty = new _LinksList([]);
let LinksList = _LinksList;
async function getLinks(providers, model, token) {
  const lists = [];
  const promises = providers.ordered(model).reverse().map(async (provider, i) => {
    try {
      const result = await provider.provideLinks(model, token);
      if (result) {
        lists[i] = [result, provider];
      }
    } catch (err) {
      onUnexpectedExternalError(err);
    }
  });
  await Promise.all(promises);
  let res = new LinksList(coalesce(lists));
  if (token.isCancellationRequested) {
    res.dispose();
    res = LinksList.Empty;
  }
  return res;
}
CommandsRegistry.registerCommand("_executeLinkProvider", async (accessor, ...args) => {
  let [uri, resolveCount] = args;
  assertType(uri instanceof URI);
  if (typeof resolveCount !== "number") {
    resolveCount = 0;
  }
  const { linkProvider } = accessor.get(ILanguageFeaturesService);
  const model = accessor.get(IModelService).getModel(uri);
  if (!model) {
    return [];
  }
  const list = await getLinks(linkProvider, model, CancellationToken.None);
  if (!list) {
    return [];
  }
  for (let i = 0; i < Math.min(resolveCount, list.links.length); i++) {
    await list.links[i].resolve(CancellationToken.None);
  }
  const result = list.links.slice(0);
  list.dispose();
  return result;
});
export {
  Link,
  LinksList,
  getLinks
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9saW5rcy9icm93c2VyL2dldExpbmtzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY29hbGVzY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgb25VbmV4cGVjdGVkRXh0ZXJuYWxFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIGlzRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMaW5rLCBJTGlua3NMaXN0LCBMaW5rUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZUZlYXR1cmVSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBMaW5rIGltcGxlbWVudHMgSUxpbmsge1xuXG5cdHByaXZhdGUgX2xpbms6IElMaW5rO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcjogTGlua1Byb3ZpZGVyO1xuXG5cdGNvbnN0cnVjdG9yKGxpbms6IElMaW5rLCBwcm92aWRlcjogTGlua1Byb3ZpZGVyKSB7XG5cdFx0dGhpcy5fbGluayA9IGxpbms7XG5cdFx0dGhpcy5fcHJvdmlkZXIgPSBwcm92aWRlcjtcblx0fVxuXG5cdHRvSlNPTigpOiBJTGluayB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJhbmdlOiB0aGlzLnJhbmdlLFxuXHRcdFx0dXJsOiB0aGlzLnVybCxcblx0XHRcdHRvb2x0aXA6IHRoaXMudG9vbHRpcFxuXHRcdH07XG5cdH1cblxuXHRnZXQgcmFuZ2UoKTogSVJhbmdlIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluay5yYW5nZTtcblx0fVxuXG5cdGdldCB1cmwoKTogVVJJIHwgc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluay51cmw7XG5cdH1cblxuXHRnZXQgdG9vbHRpcCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9saW5rLnRvb2x0aXA7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VVJJIHwgc3RyaW5nPiB7XG5cdFx0aWYgKHRoaXMuX2xpbmsudXJsKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbGluay51cmw7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiB0aGlzLl9wcm92aWRlci5yZXNvbHZlTGluayA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLl9wcm92aWRlci5yZXNvbHZlTGluayh0aGlzLl9saW5rLCB0b2tlbikpLnRoZW4odmFsdWUgPT4ge1xuXHRcdFx0XHR0aGlzLl9saW5rID0gdmFsdWUgfHwgdGhpcy5fbGluaztcblx0XHRcdFx0aWYgKHRoaXMuX2xpbmsudXJsKSB7XG5cdFx0XHRcdFx0Ly8gcmVjdXJzZVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnJlc29sdmUodG9rZW4pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignbWlzc2luZycpKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ21pc3NpbmcnKSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIExpbmtzTGlzdCB7XG5cblx0c3RhdGljIHJlYWRvbmx5IEVtcHR5ID0gbmV3IExpbmtzTGlzdChbXSk7XG5cblx0cmVhZG9ubHkgbGlua3M6IExpbmtbXTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlIHwgdW5kZWZpbmVkID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKHR1cGxlczogW0lMaW5rc0xpc3QsIExpbmtQcm92aWRlcl1bXSkge1xuXG5cdFx0bGV0IGxpbmtzOiBMaW5rW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IFtsaXN0LCBwcm92aWRlcl0gb2YgdHVwbGVzKSB7XG5cdFx0XHQvLyBtZXJnZSBhbGwgbGlua3Ncblx0XHRcdGNvbnN0IG5ld0xpbmtzID0gbGlzdC5saW5rcy5tYXAobGluayA9PiBuZXcgTGluayhsaW5rLCBwcm92aWRlcikpO1xuXHRcdFx0bGlua3MgPSBMaW5rc0xpc3QuX3VuaW9uKGxpbmtzLCBuZXdMaW5rcyk7XG5cdFx0XHQvLyByZWdpc3RlciBkaXNwb3NhYmxlc1xuXHRcdFx0aWYgKGlzRGlzcG9zYWJsZShsaXN0KSkge1xuXHRcdFx0XHR0aGlzLl9kaXNwb3NhYmxlcyA/Pz0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQobGlzdCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMubGlua3MgPSBsaW5rcztcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXM/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLmxpbmtzLmxlbmd0aCA9IDA7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfdW5pb24ob2xkTGlua3M6IExpbmtbXSwgbmV3TGlua3M6IExpbmtbXSk6IExpbmtbXSB7XG5cdFx0Ly8gcmV1bml0ZSBvbGRMaW5rcyB3aXRoIG5ld0xpbmtzIGFuZCByZW1vdmUgZHVwbGljYXRlc1xuXHRcdGNvbnN0IHJlc3VsdDogTGlua1tdID0gW107XG5cdFx0bGV0IG9sZEluZGV4OiBudW1iZXI7XG5cdFx0bGV0IG9sZExlbjogbnVtYmVyO1xuXHRcdGxldCBuZXdJbmRleDogbnVtYmVyO1xuXHRcdGxldCBuZXdMZW46IG51bWJlcjtcblxuXHRcdGZvciAob2xkSW5kZXggPSAwLCBuZXdJbmRleCA9IDAsIG9sZExlbiA9IG9sZExpbmtzLmxlbmd0aCwgbmV3TGVuID0gbmV3TGlua3MubGVuZ3RoOyBvbGRJbmRleCA8IG9sZExlbiAmJiBuZXdJbmRleCA8IG5ld0xlbjspIHtcblx0XHRcdGNvbnN0IG9sZExpbmsgPSBvbGRMaW5rc1tvbGRJbmRleF07XG5cdFx0XHRjb25zdCBuZXdMaW5rID0gbmV3TGlua3NbbmV3SW5kZXhdO1xuXG5cdFx0XHRpZiAoUmFuZ2UuYXJlSW50ZXJzZWN0aW5nT3JUb3VjaGluZyhvbGRMaW5rLnJhbmdlLCBuZXdMaW5rLnJhbmdlKSkge1xuXHRcdFx0XHQvLyBSZW1vdmUgdGhlIG9sZExpbmtcblx0XHRcdFx0b2xkSW5kZXgrKztcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNvbXBhcmlzb25SZXN1bHQgPSBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMob2xkTGluay5yYW5nZSwgbmV3TGluay5yYW5nZSk7XG5cblx0XHRcdGlmIChjb21wYXJpc29uUmVzdWx0IDwgMCkge1xuXHRcdFx0XHQvLyBvbGRMaW5rIGlzIGJlZm9yZVxuXHRcdFx0XHRyZXN1bHQucHVzaChvbGRMaW5rKTtcblx0XHRcdFx0b2xkSW5kZXgrKztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIG5ld0xpbmsgaXMgYmVmb3JlXG5cdFx0XHRcdHJlc3VsdC5wdXNoKG5ld0xpbmspO1xuXHRcdFx0XHRuZXdJbmRleCsrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAoOyBvbGRJbmRleCA8IG9sZExlbjsgb2xkSW5kZXgrKykge1xuXHRcdFx0cmVzdWx0LnB1c2gob2xkTGlua3Nbb2xkSW5kZXhdKTtcblx0XHR9XG5cdFx0Zm9yICg7IG5ld0luZGV4IDwgbmV3TGVuOyBuZXdJbmRleCsrKSB7XG5cdFx0XHRyZXN1bHQucHVzaChuZXdMaW5rc1tuZXdJbmRleF0pO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0TGlua3MocHJvdmlkZXJzOiBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeTxMaW5rUHJvdmlkZXI+LCBtb2RlbDogSVRleHRNb2RlbCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxMaW5rc0xpc3Q+IHtcblx0Y29uc3QgbGlzdHM6IFtJTGlua3NMaXN0LCBMaW5rUHJvdmlkZXJdW10gPSBbXTtcblxuXHQvLyBhc2sgYWxsIHByb3ZpZGVycyBmb3IgbGlua3MgaW4gcGFyYWxsZWxcblx0Y29uc3QgcHJvbWlzZXMgPSBwcm92aWRlcnMub3JkZXJlZChtb2RlbCkucmV2ZXJzZSgpLm1hcChhc3luYyAocHJvdmlkZXIsIGkpID0+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZUxpbmtzKG1vZGVsLCB0b2tlbik7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGxpc3RzW2ldID0gW3Jlc3VsdCwgcHJvdmlkZXJdO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0b25VbmV4cGVjdGVkRXh0ZXJuYWxFcnJvcihlcnIpO1xuXHRcdH1cblx0fSk7XG5cblx0YXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXG5cdGxldCByZXMgPSBuZXcgTGlua3NMaXN0KGNvYWxlc2NlKGxpc3RzKSk7XG5cblx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0cmVzLmRpc3Bvc2UoKTtcblx0XHRyZXMgPSBMaW5rc0xpc3QuRW1wdHk7XG5cdH1cblxuXHRyZXR1cm4gcmVzO1xufVxuXG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdfZXhlY3V0ZUxpbmtQcm92aWRlcicsIGFzeW5jIChhY2Nlc3NvciwgLi4uYXJncyk6IFByb21pc2U8SUxpbmtbXT4gPT4ge1xuXHRsZXQgW3VyaSwgcmVzb2x2ZUNvdW50XSA9IGFyZ3M7XG5cdGFzc2VydFR5cGUodXJpIGluc3RhbmNlb2YgVVJJKTtcblxuXHRpZiAodHlwZW9mIHJlc29sdmVDb3VudCAhPT0gJ251bWJlcicpIHtcblx0XHRyZXNvbHZlQ291bnQgPSAwO1xuXHR9XG5cblx0Y29uc3QgeyBsaW5rUHJvdmlkZXIgfSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRjb25zdCBtb2RlbCA9IGFjY2Vzc29yLmdldChJTW9kZWxTZXJ2aWNlKS5nZXRNb2RlbCh1cmkpO1xuXHRpZiAoIW1vZGVsKSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cdGNvbnN0IGxpc3QgPSBhd2FpdCBnZXRMaW5rcyhsaW5rUHJvdmlkZXIsIG1vZGVsLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0aWYgKCFsaXN0KSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0Ly8gcmVzb2x2ZSBsaW5rc1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IE1hdGgubWluKHJlc29sdmVDb3VudCwgbGlzdC5saW5rcy5sZW5ndGgpOyBpKyspIHtcblx0XHRhd2FpdCBsaXN0LmxpbmtzW2ldLnJlc29sdmUoQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdH1cblxuXHRjb25zdCByZXN1bHQgPSBsaXN0LmxpbmtzLnNsaWNlKDApO1xuXHRsaXN0LmRpc3Bvc2UoKTtcblx0cmV0dXJuIHJlc3VsdDtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxpQkFBaUIsb0JBQW9CO0FBQzlDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsV0FBVztBQUNwQixTQUFpQixhQUFhO0FBRzlCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMsZ0NBQWdDO0FBRWxDLE1B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LElBQUksV0FBVSxDQUFDLENBQUM7QUFGbEMsSUFBTSxZQUFOO0FBd0VQLGVBQXNCLFNBQVMsV0FBa0QsT0FBbUIsT0FBOEM7QUFDakosUUFBTSxRQUFzQyxDQUFDO0FBRzdDLFFBQU0sV0FBVyxVQUFVLFFBQVEsS0FBSyxFQUFFLFFBQVEsRUFBRSxJQUFJLE9BQU8sVUFBVSxNQUFNO0FBQzlFLFFBQUk7QUFDSCxZQUFNLFNBQVMsTUFBTSxTQUFTLGFBQWEsT0FBTyxLQUFLO0FBQ3ZELFVBQUksUUFBUTtBQUNYLGNBQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxRQUFRO0FBQUEsTUFDN0I7QUFBQSxJQUNELFNBQVMsS0FBSztBQUNiLGdDQUEwQixHQUFHO0FBQUEsSUFDOUI7QUFBQSxFQUNELENBQUM7QUFFRCxRQUFNLFFBQVEsSUFBSSxRQUFRO0FBRTFCLE1BQUksTUFBTSxJQUFJLFVBQVUsU0FBUyxLQUFLLENBQUM7QUFFdkMsTUFBSSxNQUFNLHlCQUF5QjtBQUNsQyxRQUFJLFFBQVE7QUFDWixVQUFNLFVBQVU7QUFBQSxFQUNqQjtBQUVBLFNBQU87QUFDUjtBQUdBLGlCQUFpQixnQkFBZ0Isd0JBQXdCLE9BQU8sYUFBYSxTQUEyQjtBQUN2RyxNQUFJLENBQUMsS0FBSyxZQUFZLElBQUk7QUFDMUIsYUFBVyxlQUFlLEdBQUc7QUFFN0IsTUFBSSxPQUFPLGlCQUFpQixVQUFVO0FBQ3JDLG1CQUFlO0FBQUEsRUFDaEI7QUFFQSxRQUFNLEVBQUUsYUFBYSxJQUFJLFNBQVMsSUFBSSx3QkFBd0I7QUFDOUQsUUFBTSxRQUFRLFNBQVMsSUFBSSxhQUFhLEVBQUUsU0FBUyxHQUFHO0FBQ3RELE1BQUksQ0FBQyxPQUFPO0FBQ1gsV0FBTyxDQUFDO0FBQUEsRUFDVDtBQUNBLFFBQU0sT0FBTyxNQUFNLFNBQVMsY0FBYyxPQUFPLGtCQUFrQixJQUFJO0FBQ3ZFLE1BQUksQ0FBQyxNQUFNO0FBQ1YsV0FBTyxDQUFDO0FBQUEsRUFDVDtBQUdBLFdBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxJQUFJLGNBQWMsS0FBSyxNQUFNLE1BQU0sR0FBRyxLQUFLO0FBQ25FLFVBQU0sS0FBSyxNQUFNLENBQUMsRUFBRSxRQUFRLGtCQUFrQixJQUFJO0FBQUEsRUFDbkQ7QUFFQSxRQUFNLFNBQVMsS0FBSyxNQUFNLE1BQU0sQ0FBQztBQUNqQyxPQUFLLFFBQVE7QUFDYixTQUFPO0FBQ1IsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
