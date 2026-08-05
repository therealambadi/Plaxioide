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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isEqualOrParent } from "../../../../base/common/resources.js";
import { score } from "../../../../editor/common/languageSelector.js";
import { Emitter } from "../../../../base/common/event.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
function createProviderComparer(uri) {
  return (a, b) => {
    if (a.rootUri && !b.rootUri) {
      return -1;
    } else if (!a.rootUri && b.rootUri) {
      return 1;
    } else if (!a.rootUri && !b.rootUri) {
      return 0;
    }
    const aIsParent = isEqualOrParent(uri, a.rootUri);
    const bIsParent = isEqualOrParent(uri, b.rootUri);
    if (aIsParent && bIsParent) {
      return a.rootUri.fsPath.length - b.rootUri.fsPath.length;
    } else if (aIsParent) {
      return -1;
    } else if (bIsParent) {
      return 1;
    } else {
      return 0;
    }
  };
}
let QuickDiffService = class extends Disposable {
  constructor(uriIdentityService) {
    super();
    this.uriIdentityService = uriIdentityService;
    this.quickDiffProviders = /* @__PURE__ */ new Set();
    this._onDidChangeQuickDiffProviders = this._register(new Emitter());
    this.onDidChangeQuickDiffProviders = this._onDidChangeQuickDiffProviders.event;
  }
  addQuickDiffProvider(quickDiff) {
    this.quickDiffProviders.add(quickDiff);
    this._onDidChangeQuickDiffProviders.fire();
    return {
      dispose: () => {
        this.quickDiffProviders.delete(quickDiff);
        this._onDidChangeQuickDiffProviders.fire();
      }
    };
  }
  isQuickDiff(diff) {
    return !!diff.originalResource && typeof diff.label === "string" && typeof diff.isSCM === "boolean";
  }
  async getQuickDiffs(uri, language = "", isSynchronized = false) {
    const providers = Array.from(this.quickDiffProviders).filter((provider) => !provider.rootUri || this.uriIdentityService.extUri.isEqualOrParent(uri, provider.rootUri)).sort(createProviderComparer(uri));
    const diffs = await Promise.all(providers.map(async (provider) => {
      const scoreValue = provider.selector ? score(provider.selector, uri, language, isSynchronized, void 0, void 0) : 10;
      const diff = {
        originalResource: scoreValue > 0 ? await provider.getOriginalResource(uri) ?? void 0 : void 0,
        label: provider.label,
        isSCM: provider.isSCM,
        visible: provider.visible
      };
      return diff;
    }));
    return diffs.filter(this.isQuickDiff);
  }
};
QuickDiffService = __decorateClass([
  __decorateParam(0, IUriIdentityService)
], QuickDiffService);
async function getOriginalResource(quickDiffService, uri, language, isSynchronized) {
  const quickDiffs = await quickDiffService.getQuickDiffs(uri, language, isSynchronized);
  return quickDiffs.length > 0 ? quickDiffs[0].originalResource : null;
}
export {
  QuickDiffService,
  getOriginalResource
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zY20vY29tbW9uL3F1aWNrRGlmZlNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVF1aWNrRGlmZlNlcnZpY2UsIFF1aWNrRGlmZiwgUXVpY2tEaWZmUHJvdmlkZXIgfSBmcm9tICcuL3F1aWNrRGlmZi5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsT3JQYXJlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgc2NvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlU2VsZWN0b3IuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuXG5mdW5jdGlvbiBjcmVhdGVQcm92aWRlckNvbXBhcmVyKHVyaTogVVJJKTogKGE6IFF1aWNrRGlmZlByb3ZpZGVyLCBiOiBRdWlja0RpZmZQcm92aWRlcikgPT4gbnVtYmVyIHtcblx0cmV0dXJuIChhLCBiKSA9PiB7XG5cdFx0aWYgKGEucm9vdFVyaSAmJiAhYi5yb290VXJpKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fSBlbHNlIGlmICghYS5yb290VXJpICYmIGIucm9vdFVyaSkge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fSBlbHNlIGlmICghYS5yb290VXJpICYmICFiLnJvb3RVcmkpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFJc1BhcmVudCA9IGlzRXF1YWxPclBhcmVudCh1cmksIGEucm9vdFVyaSEpO1xuXHRcdGNvbnN0IGJJc1BhcmVudCA9IGlzRXF1YWxPclBhcmVudCh1cmksIGIucm9vdFVyaSEpO1xuXG5cdFx0aWYgKGFJc1BhcmVudCAmJiBiSXNQYXJlbnQpIHtcblx0XHRcdHJldHVybiBhLnJvb3RVcmkhLmZzUGF0aC5sZW5ndGggLSBiLnJvb3RVcmkhLmZzUGF0aC5sZW5ndGg7XG5cdFx0fSBlbHNlIGlmIChhSXNQYXJlbnQpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9IGVsc2UgaWYgKGJJc1BhcmVudCkge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblx0fTtcbn1cblxuZXhwb3J0IGNsYXNzIFF1aWNrRGlmZlNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVF1aWNrRGlmZlNlcnZpY2Uge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHF1aWNrRGlmZlByb3ZpZGVyczogU2V0PFF1aWNrRGlmZlByb3ZpZGVyPiA9IG5ldyBTZXQoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VRdWlja0RpZmZQcm92aWRlcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VRdWlja0RpZmZQcm92aWRlcnMgPSB0aGlzLl9vbkRpZENoYW5nZVF1aWNrRGlmZlByb3ZpZGVycy5ldmVudDtcblxuXHRjb25zdHJ1Y3RvcihASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRhZGRRdWlja0RpZmZQcm92aWRlcihxdWlja0RpZmY6IFF1aWNrRGlmZlByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRcdHRoaXMucXVpY2tEaWZmUHJvdmlkZXJzLmFkZChxdWlja0RpZmYpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUXVpY2tEaWZmUHJvdmlkZXJzLmZpcmUoKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnF1aWNrRGlmZlByb3ZpZGVycy5kZWxldGUocXVpY2tEaWZmKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VRdWlja0RpZmZQcm92aWRlcnMuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGlzUXVpY2tEaWZmKGRpZmY6IHsgb3JpZ2luYWxSZXNvdXJjZT86IFVSSTsgbGFiZWw/OiBzdHJpbmc7IGlzU0NNPzogYm9vbGVhbiB9KTogZGlmZiBpcyBRdWlja0RpZmYge1xuXHRcdHJldHVybiAhIWRpZmYub3JpZ2luYWxSZXNvdXJjZSAmJiAodHlwZW9mIGRpZmYubGFiZWwgPT09ICdzdHJpbmcnKSAmJiAodHlwZW9mIGRpZmYuaXNTQ00gPT09ICdib29sZWFuJyk7XG5cdH1cblxuXHRhc3luYyBnZXRRdWlja0RpZmZzKHVyaTogVVJJLCBsYW5ndWFnZTogc3RyaW5nID0gJycsIGlzU3luY2hyb25pemVkOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPFF1aWNrRGlmZltdPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXJzID0gQXJyYXkuZnJvbSh0aGlzLnF1aWNrRGlmZlByb3ZpZGVycylcblx0XHRcdC5maWx0ZXIocHJvdmlkZXIgPT4gIXByb3ZpZGVyLnJvb3RVcmkgfHwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWxPclBhcmVudCh1cmksIHByb3ZpZGVyLnJvb3RVcmkpKVxuXHRcdFx0LnNvcnQoY3JlYXRlUHJvdmlkZXJDb21wYXJlcih1cmkpKTtcblxuXHRcdGNvbnN0IGRpZmZzID0gYXdhaXQgUHJvbWlzZS5hbGwocHJvdmlkZXJzLm1hcChhc3luYyBwcm92aWRlciA9PiB7XG5cdFx0XHRjb25zdCBzY29yZVZhbHVlID0gcHJvdmlkZXIuc2VsZWN0b3IgPyBzY29yZShwcm92aWRlci5zZWxlY3RvciwgdXJpLCBsYW5ndWFnZSwgaXNTeW5jaHJvbml6ZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKSA6IDEwO1xuXHRcdFx0Y29uc3QgZGlmZjogUGFydGlhbDxRdWlja0RpZmY+ID0ge1xuXHRcdFx0XHRvcmlnaW5hbFJlc291cmNlOiBzY29yZVZhbHVlID4gMCA/IGF3YWl0IHByb3ZpZGVyLmdldE9yaWdpbmFsUmVzb3VyY2UodXJpKSA/PyB1bmRlZmluZWQgOiB1bmRlZmluZWQsXG5cdFx0XHRcdGxhYmVsOiBwcm92aWRlci5sYWJlbCxcblx0XHRcdFx0aXNTQ006IHByb3ZpZGVyLmlzU0NNLFxuXHRcdFx0XHR2aXNpYmxlOiBwcm92aWRlci52aXNpYmxlXG5cdFx0XHR9O1xuXHRcdFx0cmV0dXJuIGRpZmY7XG5cdFx0fSkpO1xuXHRcdHJldHVybiBkaWZmcy5maWx0ZXI8UXVpY2tEaWZmPih0aGlzLmlzUXVpY2tEaWZmKTtcblx0fVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0T3JpZ2luYWxSZXNvdXJjZShxdWlja0RpZmZTZXJ2aWNlOiBJUXVpY2tEaWZmU2VydmljZSwgdXJpOiBVUkksIGxhbmd1YWdlOiBzdHJpbmcgfCB1bmRlZmluZWQsIGlzU3luY2hyb25pemVkOiBib29sZWFuIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxVUkkgfCBudWxsPiB7XG5cdGNvbnN0IHF1aWNrRGlmZnMgPSBhd2FpdCBxdWlja0RpZmZTZXJ2aWNlLmdldFF1aWNrRGlmZnModXJpLCBsYW5ndWFnZSwgaXNTeW5jaHJvbml6ZWQpO1xuXHRyZXR1cm4gcXVpY2tEaWZmcy5sZW5ndGggPiAwID8gcXVpY2tEaWZmc1swXS5vcmlnaW5hbFJlc291cmNlIDogbnVsbDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyxrQkFBK0I7QUFFeEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZUFBZTtBQUN4QixTQUFTLDJCQUEyQjtBQUVwQyxTQUFTLHVCQUF1QixLQUFrRTtBQUNqRyxTQUFPLENBQUMsR0FBRyxNQUFNO0FBQ2hCLFFBQUksRUFBRSxXQUFXLENBQUMsRUFBRSxTQUFTO0FBQzVCLGFBQU87QUFBQSxJQUNSLFdBQVcsQ0FBQyxFQUFFLFdBQVcsRUFBRSxTQUFTO0FBQ25DLGFBQU87QUFBQSxJQUNSLFdBQVcsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxFQUFFLFNBQVM7QUFDcEMsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLFlBQVksZ0JBQWdCLEtBQUssRUFBRSxPQUFRO0FBQ2pELFVBQU0sWUFBWSxnQkFBZ0IsS0FBSyxFQUFFLE9BQVE7QUFFakQsUUFBSSxhQUFhLFdBQVc7QUFDM0IsYUFBTyxFQUFFLFFBQVMsT0FBTyxTQUFTLEVBQUUsUUFBUyxPQUFPO0FBQUEsSUFDckQsV0FBVyxXQUFXO0FBQ3JCLGFBQU87QUFBQSxJQUNSLFdBQVcsV0FBVztBQUNyQixhQUFPO0FBQUEsSUFDUixPQUFPO0FBQ04sYUFBTztBQUFBLElBQ1I7QUFBQSxFQUNEO0FBQ0Q7QUFFTyxJQUFNLG1CQUFOLGNBQStCLFdBQXdDO0FBQUEsRUFPN0UsWUFBa0Qsb0JBQXlDO0FBQzFGLFVBQU07QUFEMkM7QUFKbEQsU0FBUSxxQkFBNkMsb0JBQUksSUFBSTtBQUM3RCxTQUFpQixpQ0FBaUMsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQ3BGLFNBQVMsZ0NBQWdDLEtBQUssK0JBQStCO0FBQUEsRUFJN0U7QUFBQSxFQUVBLHFCQUFxQixXQUEyQztBQUMvRCxTQUFLLG1CQUFtQixJQUFJLFNBQVM7QUFDckMsU0FBSywrQkFBK0IsS0FBSztBQUN6QyxXQUFPO0FBQUEsTUFDTixTQUFTLE1BQU07QUFDZCxhQUFLLG1CQUFtQixPQUFPLFNBQVM7QUFDeEMsYUFBSywrQkFBK0IsS0FBSztBQUFBLE1BQzFDO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLFlBQVksTUFBc0Y7QUFDekcsV0FBTyxDQUFDLENBQUMsS0FBSyxvQkFBcUIsT0FBTyxLQUFLLFVBQVUsWUFBYyxPQUFPLEtBQUssVUFBVTtBQUFBLEVBQzlGO0FBQUEsRUFFQSxNQUFNLGNBQWMsS0FBVSxXQUFtQixJQUFJLGlCQUEwQixPQUE2QjtBQUMzRyxVQUFNLFlBQVksTUFBTSxLQUFLLEtBQUssa0JBQWtCLEVBQ2xELE9BQU8sY0FBWSxDQUFDLFNBQVMsV0FBVyxLQUFLLG1CQUFtQixPQUFPLGdCQUFnQixLQUFLLFNBQVMsT0FBTyxDQUFDLEVBQzdHLEtBQUssdUJBQXVCLEdBQUcsQ0FBQztBQUVsQyxVQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksVUFBVSxJQUFJLE9BQU0sYUFBWTtBQUMvRCxZQUFNLGFBQWEsU0FBUyxXQUFXLE1BQU0sU0FBUyxVQUFVLEtBQUssVUFBVSxnQkFBZ0IsUUFBVyxNQUFTLElBQUk7QUFDdkgsWUFBTSxPQUEyQjtBQUFBLFFBQ2hDLGtCQUFrQixhQUFhLElBQUksTUFBTSxTQUFTLG9CQUFvQixHQUFHLEtBQUssU0FBWTtBQUFBLFFBQzFGLE9BQU8sU0FBUztBQUFBLFFBQ2hCLE9BQU8sU0FBUztBQUFBLFFBQ2hCLFNBQVMsU0FBUztBQUFBLE1BQ25CO0FBQ0EsYUFBTztBQUFBLElBQ1IsQ0FBQyxDQUFDO0FBQ0YsV0FBTyxNQUFNLE9BQWtCLEtBQUssV0FBVztBQUFBLEVBQ2hEO0FBQ0Q7QUEzQ2EsbUJBQU47QUFBQSxFQU9PO0FBQUEsR0FQRDtBQTZDYixlQUFzQixvQkFBb0Isa0JBQXFDLEtBQVUsVUFBOEIsZ0JBQTBEO0FBQ2hMLFFBQU0sYUFBYSxNQUFNLGlCQUFpQixjQUFjLEtBQUssVUFBVSxjQUFjO0FBQ3JGLFNBQU8sV0FBVyxTQUFTLElBQUksV0FBVyxDQUFDLEVBQUUsbUJBQW1CO0FBQ2pFOyIsCiAgIm5hbWVzIjogW10KfQo=
