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
import { IDebugService, State } from "../common/debug.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { ITitleService } from "../../../services/title/browser/titleService.js";
let DebugTitleContribution = class {
  constructor(debugService, hostService, titleService) {
    this.toDispose = [];
    const updateTitle = () => {
      if (debugService.state === State.Stopped && !hostService.hasFocus) {
        titleService.updateProperties({ prefix: "\u{1F534}" });
      } else {
        titleService.updateProperties({ prefix: "" });
      }
    };
    this.toDispose.push(debugService.onDidChangeState(updateTitle));
    this.toDispose.push(hostService.onDidChangeFocus(updateTitle));
  }
  dispose() {
    dispose(this.toDispose);
  }
};
DebugTitleContribution = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, IHostService),
  __decorateParam(2, ITitleService)
], DebugTitleContribution);
export {
  DebugTitleContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnVGl0bGUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSURlYnVnU2VydmljZSwgU3RhdGUgfSBmcm9tICcuLi9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgZGlzcG9zZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgSVRpdGxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RpdGxlL2Jyb3dzZXIvdGl0bGVTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNsYXNzIERlYnVnVGl0bGVDb250cmlidXRpb24gaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRwcml2YXRlIHRvRGlzcG9zZTogSURpc3Bvc2FibGVbXSA9IFtdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRGVidWdTZXJ2aWNlIGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0QElUaXRsZVNlcnZpY2UgdGl0bGVTZXJ2aWNlOiBJVGl0bGVTZXJ2aWNlXG5cdCkge1xuXHRcdGNvbnN0IHVwZGF0ZVRpdGxlID0gKCkgPT4ge1xuXHRcdFx0aWYgKGRlYnVnU2VydmljZS5zdGF0ZSA9PT0gU3RhdGUuU3RvcHBlZCAmJiAhaG9zdFNlcnZpY2UuaGFzRm9jdXMpIHtcblx0XHRcdFx0dGl0bGVTZXJ2aWNlLnVwZGF0ZVByb3BlcnRpZXMoeyBwcmVmaXg6ICdcdUQ4M0RcdUREMzQnIH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGl0bGVTZXJ2aWNlLnVwZGF0ZVByb3BlcnRpZXMoeyBwcmVmaXg6ICcnIH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaChkZWJ1Z1NlcnZpY2Uub25EaWRDaGFuZ2VTdGF0ZSh1cGRhdGVUaXRsZSkpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2goaG9zdFNlcnZpY2Uub25EaWRDaGFuZ2VGb2N1cyh1cGRhdGVUaXRsZSkpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRkaXNwb3NlKHRoaXMudG9EaXNwb3NlKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLGVBQWUsYUFBYTtBQUNyQyxTQUFTLGVBQTRCO0FBQ3JDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMscUJBQXFCO0FBRXZCLElBQU0seUJBQU4sTUFBK0Q7QUFBQSxFQUlyRSxZQUNnQixjQUNELGFBQ0MsY0FDZDtBQU5GLFNBQVEsWUFBMkIsQ0FBQztBQU9uQyxVQUFNLGNBQWMsTUFBTTtBQUN6QixVQUFJLGFBQWEsVUFBVSxNQUFNLFdBQVcsQ0FBQyxZQUFZLFVBQVU7QUFDbEUscUJBQWEsaUJBQWlCLEVBQUUsUUFBUSxZQUFLLENBQUM7QUFBQSxNQUMvQyxPQUFPO0FBQ04scUJBQWEsaUJBQWlCLEVBQUUsUUFBUSxHQUFHLENBQUM7QUFBQSxNQUM3QztBQUFBLElBQ0Q7QUFDQSxTQUFLLFVBQVUsS0FBSyxhQUFhLGlCQUFpQixXQUFXLENBQUM7QUFDOUQsU0FBSyxVQUFVLEtBQUssWUFBWSxpQkFBaUIsV0FBVyxDQUFDO0FBQUEsRUFDOUQ7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsWUFBUSxLQUFLLFNBQVM7QUFBQSxFQUN2QjtBQUNEO0FBdkJhLHlCQUFOO0FBQUEsRUFLSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FQVTsiLAogICJuYW1lcyI6IFtdCn0K
