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
import { Emitter } from "../../../../../base/common/event.js";
import { localize } from "../../../../../nls.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { listInvalidItemForeground, listDeemphasizedForeground } from "../../../../../platform/theme/common/colorRegistry.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { explorerRootErrorEmitter } from "./explorerViewer.js";
import { IExplorerService } from "../files.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
function provideDecorations(fileStat) {
  if (fileStat.isRoot && fileStat.error) {
    return {
      tooltip: localize("canNotResolve", "Unable to resolve workspace folder ({0})", toErrorMessage(fileStat.error)),
      letter: "!",
      color: listInvalidItemForeground
    };
  }
  if (fileStat.isSymbolicLink) {
    return {
      tooltip: localize("symbolicLlink", "Symbolic Link"),
      letter: "\u2937"
    };
  }
  if (fileStat.isUnknown) {
    return {
      tooltip: localize("unknown", "Unknown File Type"),
      letter: "?"
    };
  }
  if (fileStat.isExcluded) {
    return {
      color: listDeemphasizedForeground
    };
  }
  return void 0;
}
let ExplorerDecorationsProvider = class {
  constructor(explorerService, contextService) {
    this.explorerService = explorerService;
    this.label = localize("label", "Explorer");
    this._onDidChange = new Emitter();
    this.toDispose = new DisposableStore();
    this.toDispose.add(this._onDidChange);
    this.toDispose.add(contextService.onDidChangeWorkspaceFolders((e) => {
      this._onDidChange.fire(e.changed.concat(e.added).map((wf) => wf.uri));
    }));
    this.toDispose.add(explorerRootErrorEmitter.event((resource) => {
      this._onDidChange.fire([resource]);
    }));
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  async provideDecorations(resource) {
    const fileStat = this.explorerService.findClosest(resource);
    if (!fileStat) {
      throw new Error("ExplorerItem not found");
    }
    return provideDecorations(fileStat);
  }
  dispose() {
    this.toDispose.dispose();
  }
};
ExplorerDecorationsProvider = __decorateClass([
  __decorateParam(0, IExplorerService),
  __decorateParam(1, IWorkspaceContextService)
], ExplorerDecorationsProvider);
export {
  ExplorerDecorationsProvider,
  provideDecorations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL3ZpZXdzL2V4cGxvcmVyRGVjb3JhdGlvbnNQcm92aWRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElEZWNvcmF0aW9uc1Byb3ZpZGVyLCBJRGVjb3JhdGlvbkRhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9kZWNvcmF0aW9ucy9jb21tb24vZGVjb3JhdGlvbnMuanMnO1xuaW1wb3J0IHsgbGlzdEludmFsaWRJdGVtRm9yZWdyb3VuZCwgbGlzdERlZW1waGFzaXplZEZvcmVncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZXhwbG9yZXJSb290RXJyb3JFbWl0dGVyIH0gZnJvbSAnLi9leHBsb3JlclZpZXdlci5qcyc7XG5pbXBvcnQgeyBFeHBsb3Jlckl0ZW0gfSBmcm9tICcuLi8uLi9jb21tb24vZXhwbG9yZXJNb2RlbC5qcyc7XG5pbXBvcnQgeyBJRXhwbG9yZXJTZXJ2aWNlIH0gZnJvbSAnLi4vZmlsZXMuanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gcHJvdmlkZURlY29yYXRpb25zKGZpbGVTdGF0OiBFeHBsb3Jlckl0ZW0pOiBJRGVjb3JhdGlvbkRhdGEgfCB1bmRlZmluZWQge1xuXHRpZiAoZmlsZVN0YXQuaXNSb290ICYmIGZpbGVTdGF0LmVycm9yKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdjYW5Ob3RSZXNvbHZlJywgXCJVbmFibGUgdG8gcmVzb2x2ZSB3b3Jrc3BhY2UgZm9sZGVyICh7MH0pXCIsIHRvRXJyb3JNZXNzYWdlKGZpbGVTdGF0LmVycm9yKSksXG5cdFx0XHRsZXR0ZXI6ICchJyxcblx0XHRcdGNvbG9yOiBsaXN0SW52YWxpZEl0ZW1Gb3JlZ3JvdW5kLFxuXHRcdH07XG5cdH1cblx0aWYgKGZpbGVTdGF0LmlzU3ltYm9saWNMaW5rKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdzeW1ib2xpY0xsaW5rJywgXCJTeW1ib2xpYyBMaW5rXCIpLFxuXHRcdFx0bGV0dGVyOiAnXFx1MjkzNydcblx0XHR9O1xuXHR9XG5cdGlmIChmaWxlU3RhdC5pc1Vua25vd24pIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ3Vua25vd24nLCBcIlVua25vd24gRmlsZSBUeXBlXCIpLFxuXHRcdFx0bGV0dGVyOiAnPydcblx0XHR9O1xuXHR9XG5cdGlmIChmaWxlU3RhdC5pc0V4Y2x1ZGVkKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGNvbG9yOiBsaXN0RGVlbXBoYXNpemVkRm9yZWdyb3VuZCxcblx0XHR9O1xuXHR9XG5cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNsYXNzIEV4cGxvcmVyRGVjb3JhdGlvbnNQcm92aWRlciBpbXBsZW1lbnRzIElEZWNvcmF0aW9uc1Byb3ZpZGVyIHtcblx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZyA9IGxvY2FsaXplKCdsYWJlbCcsIFwiRXhwbG9yZXJcIik7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gbmV3IEVtaXR0ZXI8VVJJW10+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgdG9EaXNwb3NlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXhwbG9yZXJTZXJ2aWNlIHByaXZhdGUgZXhwbG9yZXJTZXJ2aWNlOiBJRXhwbG9yZXJTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZVxuXHQpIHtcblx0XHR0aGlzLnRvRGlzcG9zZS5hZGQodGhpcy5fb25EaWRDaGFuZ2UpO1xuXHRcdHRoaXMudG9EaXNwb3NlLmFkZChjb250ZXh0U2VydmljZS5vbkRpZENoYW5nZVdvcmtzcGFjZUZvbGRlcnMoZSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKGUuY2hhbmdlZC5jb25jYXQoZS5hZGRlZCkubWFwKHdmID0+IHdmLnVyaSkpO1xuXHRcdH0pKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5hZGQoZXhwbG9yZXJSb290RXJyb3JFbWl0dGVyLmV2ZW50KChyZXNvdXJjZSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKFtyZXNvdXJjZV0pO1xuXHRcdH0pKSk7XG5cdH1cblxuXHRnZXQgb25EaWRDaGFuZ2UoKTogRXZlbnQ8VVJJW10+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cdH1cblxuXHRhc3luYyBwcm92aWRlRGVjb3JhdGlvbnMocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SURlY29yYXRpb25EYXRhIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZmlsZVN0YXQgPSB0aGlzLmV4cGxvcmVyU2VydmljZS5maW5kQ2xvc2VzdChyZXNvdXJjZSk7XG5cdFx0aWYgKCFmaWxlU3RhdCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdFeHBsb3Jlckl0ZW0gbm90IGZvdW5kJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHByb3ZpZGVEZWNvcmF0aW9ucyhmaWxlU3RhdCk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMudG9EaXNwb3NlLmRpc3Bvc2UoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFnQixlQUFlO0FBQy9CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsMkJBQTJCLGtDQUFrQztBQUN0RSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdDQUFnQztBQUV6QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHNCQUFzQjtBQUV4QixTQUFTLG1CQUFtQixVQUFxRDtBQUN2RixNQUFJLFNBQVMsVUFBVSxTQUFTLE9BQU87QUFDdEMsV0FBTztBQUFBLE1BQ04sU0FBUyxTQUFTLGlCQUFpQiw0Q0FBNEMsZUFBZSxTQUFTLEtBQUssQ0FBQztBQUFBLE1BQzdHLFFBQVE7QUFBQSxNQUNSLE9BQU87QUFBQSxJQUNSO0FBQUEsRUFDRDtBQUNBLE1BQUksU0FBUyxnQkFBZ0I7QUFDNUIsV0FBTztBQUFBLE1BQ04sU0FBUyxTQUFTLGlCQUFpQixlQUFlO0FBQUEsTUFDbEQsUUFBUTtBQUFBLElBQ1Q7QUFBQSxFQUNEO0FBQ0EsTUFBSSxTQUFTLFdBQVc7QUFDdkIsV0FBTztBQUFBLE1BQ04sU0FBUyxTQUFTLFdBQVcsbUJBQW1CO0FBQUEsTUFDaEQsUUFBUTtBQUFBLElBQ1Q7QUFBQSxFQUNEO0FBQ0EsTUFBSSxTQUFTLFlBQVk7QUFDeEIsV0FBTztBQUFBLE1BQ04sT0FBTztBQUFBLElBQ1I7QUFBQSxFQUNEO0FBRUEsU0FBTztBQUNSO0FBRU8sSUFBTSw4QkFBTixNQUFrRTtBQUFBLEVBS3hFLFlBQzJCLGlCQUNBLGdCQUN6QjtBQUZ5QjtBQUwzQixTQUFTLFFBQWdCLFNBQVMsU0FBUyxVQUFVO0FBQ3JELFNBQWlCLGVBQWUsSUFBSSxRQUFlO0FBQ25ELFNBQWlCLFlBQVksSUFBSSxnQkFBZ0I7QUFNaEQsU0FBSyxVQUFVLElBQUksS0FBSyxZQUFZO0FBQ3BDLFNBQUssVUFBVSxJQUFJLGVBQWUsNEJBQTRCLE9BQUs7QUFDbEUsV0FBSyxhQUFhLEtBQUssRUFBRSxRQUFRLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxRQUFNLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDbkUsQ0FBQyxDQUFDO0FBQ0YsU0FBSyxVQUFVLElBQUkseUJBQXlCLE1BQU8sY0FBWTtBQUM5RCxXQUFLLGFBQWEsS0FBSyxDQUFDLFFBQVEsQ0FBQztBQUFBLElBQ2xDLENBQUUsQ0FBQztBQUFBLEVBQ0o7QUFBQSxFQUVBLElBQUksY0FBNEI7QUFDL0IsV0FBTyxLQUFLLGFBQWE7QUFBQSxFQUMxQjtBQUFBLEVBRUEsTUFBTSxtQkFBbUIsVUFBcUQ7QUFDN0UsVUFBTSxXQUFXLEtBQUssZ0JBQWdCLFlBQVksUUFBUTtBQUMxRCxRQUFJLENBQUMsVUFBVTtBQUNkLFlBQU0sSUFBSSxNQUFNLHdCQUF3QjtBQUFBLElBQ3pDO0FBRUEsV0FBTyxtQkFBbUIsUUFBUTtBQUFBLEVBQ25DO0FBQUEsRUFFQSxVQUFnQjtBQUNmLFNBQUssVUFBVSxRQUFRO0FBQUEsRUFDeEI7QUFDRDtBQWxDYSw4QkFBTjtBQUFBLEVBTUo7QUFBQSxFQUNBO0FBQUEsR0FQVTsiLAogICJuYW1lcyI6IFtdCn0K
