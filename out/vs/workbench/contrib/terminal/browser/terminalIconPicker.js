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
import { Dimension, getActiveDocument } from "../../../../base/browser/dom.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { codiconsLibrary } from "../../../../base/common/codiconsLibrary.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { defaultInputBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { getIconRegistry } from "../../../../platform/theme/common/iconRegistry.js";
import { WorkbenchIconSelectBox } from "../../../services/userDataProfile/browser/iconSelectBox.js";
const icons = new Lazy(() => {
  const iconDefinitions = getIconRegistry().getIcons();
  const includedChars = /* @__PURE__ */ new Set();
  const dedupedIcons = iconDefinitions.filter((e) => {
    if (e.id === codiconsLibrary.blank.id) {
      return false;
    }
    if (!("fontCharacter" in e.defaults)) {
      return false;
    }
    if (includedChars.has(e.defaults.fontCharacter)) {
      return false;
    }
    includedChars.add(e.defaults.fontCharacter);
    return true;
  });
  return dedupedIcons;
});
let TerminalIconPicker = class extends Disposable {
  constructor(instantiationService, _hoverService) {
    super();
    this._hoverService = _hoverService;
    this._iconSelectBox = instantiationService.createInstance(WorkbenchIconSelectBox, {
      icons: icons.value,
      inputBoxStyles: defaultInputBoxStyles,
      showIconInfo: true
    });
  }
  async pickIcons() {
    const dimension = new Dimension(486, 260);
    return new Promise((resolve) => {
      this._register(this._iconSelectBox.onDidSelect((e) => {
        resolve(e);
        this._iconSelectBox.dispose();
      }));
      this._iconSelectBox.clearInput();
      const hoverWidget = this._hoverService.showInstantHover({
        content: this._iconSelectBox.domNode,
        target: getActiveDocument().body,
        position: {
          hoverPosition: HoverPosition.BELOW
        },
        persistence: {
          sticky: true
        },
        appearance: {
          showPointer: true
        }
      }, true);
      if (hoverWidget) {
        this._register(hoverWidget);
      }
      this._iconSelectBox.layout(dimension);
      this._iconSelectBox.focus();
    });
  }
};
TerminalIconPicker = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IHoverService)
], TerminalIconPicker);
export {
  TerminalIconPicker
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsSWNvblBpY2tlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpbWVuc2lvbiwgZ2V0QWN0aXZlRG9jdW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEhvdmVyUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJXaWRnZXQuanMnO1xuaW1wb3J0IHsgY29kaWNvbnNMaWJyYXJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnNMaWJyYXJ5LmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYXp5LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHR5cGUgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0SW5wdXRCb3hTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgZ2V0SWNvblJlZ2lzdHJ5LCBJY29uQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2ljb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hJY29uU2VsZWN0Qm94IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2Jyb3dzZXIvaWNvblNlbGVjdEJveC5qcyc7XG5cbmNvbnN0IGljb25zID0gbmV3IExhenk8SWNvbkNvbnRyaWJ1dGlvbltdPigoKSA9PiB7XG5cdGNvbnN0IGljb25EZWZpbml0aW9ucyA9IGdldEljb25SZWdpc3RyeSgpLmdldEljb25zKCk7XG5cdGNvbnN0IGluY2x1ZGVkQ2hhcnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0Y29uc3QgZGVkdXBlZEljb25zID0gaWNvbkRlZmluaXRpb25zLmZpbHRlcihlID0+IHtcblx0XHRpZiAoZS5pZCA9PT0gY29kaWNvbnNMaWJyYXJ5LmJsYW5rLmlkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICghKCdmb250Q2hhcmFjdGVyJyBpbiBlLmRlZmF1bHRzKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoaW5jbHVkZWRDaGFycy5oYXMoZS5kZWZhdWx0cy5mb250Q2hhcmFjdGVyKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpbmNsdWRlZENoYXJzLmFkZChlLmRlZmF1bHRzLmZvbnRDaGFyYWN0ZXIpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9KTtcblx0cmV0dXJuIGRlZHVwZWRJY29ucztcbn0pO1xuXG5leHBvcnQgY2xhc3MgVGVybWluYWxJY29uUGlja2VyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2ljb25TZWxlY3RCb3g6IFdvcmtiZW5jaEljb25TZWxlY3RCb3g7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyU2VydmljZTogSUhvdmVyU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5faWNvblNlbGVjdEJveCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtiZW5jaEljb25TZWxlY3RCb3gsIHtcblx0XHRcdGljb25zOiBpY29ucy52YWx1ZSxcblx0XHRcdGlucHV0Qm94U3R5bGVzOiBkZWZhdWx0SW5wdXRCb3hTdHlsZXMsXG5cdFx0XHRzaG93SWNvbkluZm86IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHBpY2tJY29ucygpOiBQcm9taXNlPFRoZW1lSWNvbiB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGRpbWVuc2lvbiA9IG5ldyBEaW1lbnNpb24oNDg2LCAyNjApO1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxUaGVtZUljb24gfCB1bmRlZmluZWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5faWNvblNlbGVjdEJveC5vbkRpZFNlbGVjdChlID0+IHtcblx0XHRcdFx0cmVzb2x2ZShlKTtcblx0XHRcdFx0dGhpcy5faWNvblNlbGVjdEJveC5kaXNwb3NlKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9pY29uU2VsZWN0Qm94LmNsZWFySW5wdXQoKTtcblx0XHRcdGNvbnN0IGhvdmVyV2lkZ2V0ID0gdGhpcy5faG92ZXJTZXJ2aWNlLnNob3dJbnN0YW50SG92ZXIoe1xuXHRcdFx0XHRjb250ZW50OiB0aGlzLl9pY29uU2VsZWN0Qm94LmRvbU5vZGUsXG5cdFx0XHRcdHRhcmdldDogZ2V0QWN0aXZlRG9jdW1lbnQoKS5ib2R5LFxuXHRcdFx0XHRwb3NpdGlvbjoge1xuXHRcdFx0XHRcdGhvdmVyUG9zaXRpb246IEhvdmVyUG9zaXRpb24uQkVMT1csXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHBlcnNpc3RlbmNlOiB7XG5cdFx0XHRcdFx0c3RpY2t5OiB0cnVlLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRhcHBlYXJhbmNlOiB7XG5cdFx0XHRcdFx0c2hvd1BvaW50ZXI6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0fSwgdHJ1ZSk7XG5cdFx0XHRpZiAoaG92ZXJXaWRnZXQpIHtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoaG92ZXJXaWRnZXQpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5faWNvblNlbGVjdEJveC5sYXlvdXQoZGltZW5zaW9uKTtcblx0XHRcdHRoaXMuX2ljb25TZWxlY3RCb3guZm9jdXMoKTtcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFdBQVcseUJBQXlCO0FBQzdDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsWUFBWTtBQUNyQixTQUFTLGtCQUFrQjtBQUUzQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHVCQUF5QztBQUNsRCxTQUFTLDhCQUE4QjtBQUV2QyxNQUFNLFFBQVEsSUFBSSxLQUF5QixNQUFNO0FBQ2hELFFBQU0sa0JBQWtCLGdCQUFnQixFQUFFLFNBQVM7QUFDbkQsUUFBTSxnQkFBZ0Isb0JBQUksSUFBWTtBQUN0QyxRQUFNLGVBQWUsZ0JBQWdCLE9BQU8sT0FBSztBQUNoRCxRQUFJLEVBQUUsT0FBTyxnQkFBZ0IsTUFBTSxJQUFJO0FBQ3RDLGFBQU87QUFBQSxJQUNSO0FBQ0EsUUFBSSxFQUFFLG1CQUFtQixFQUFFLFdBQVc7QUFDckMsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLGNBQWMsSUFBSSxFQUFFLFNBQVMsYUFBYSxHQUFHO0FBQ2hELGFBQU87QUFBQSxJQUNSO0FBQ0Esa0JBQWMsSUFBSSxFQUFFLFNBQVMsYUFBYTtBQUMxQyxXQUFPO0FBQUEsRUFDUixDQUFDO0FBQ0QsU0FBTztBQUNSLENBQUM7QUFFTSxJQUFNLHFCQUFOLGNBQWlDLFdBQVc7QUFBQSxFQUdsRCxZQUN3QixzQkFDUyxlQUMvQjtBQUNELFVBQU07QUFGMEI7QUFJaEMsU0FBSyxpQkFBaUIscUJBQXFCLGVBQWUsd0JBQXdCO0FBQUEsTUFDakYsT0FBTyxNQUFNO0FBQUEsTUFDYixnQkFBZ0I7QUFBQSxNQUNoQixjQUFjO0FBQUEsSUFDZixDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBTSxZQUE0QztBQUNqRCxVQUFNLFlBQVksSUFBSSxVQUFVLEtBQUssR0FBRztBQUN4QyxXQUFPLElBQUksUUFBK0IsYUFBVztBQUNwRCxXQUFLLFVBQVUsS0FBSyxlQUFlLFlBQVksT0FBSztBQUNuRCxnQkFBUSxDQUFDO0FBQ1QsYUFBSyxlQUFlLFFBQVE7QUFBQSxNQUM3QixDQUFDLENBQUM7QUFDRixXQUFLLGVBQWUsV0FBVztBQUMvQixZQUFNLGNBQWMsS0FBSyxjQUFjLGlCQUFpQjtBQUFBLFFBQ3ZELFNBQVMsS0FBSyxlQUFlO0FBQUEsUUFDN0IsUUFBUSxrQkFBa0IsRUFBRTtBQUFBLFFBQzVCLFVBQVU7QUFBQSxVQUNULGVBQWUsY0FBYztBQUFBLFFBQzlCO0FBQUEsUUFDQSxhQUFhO0FBQUEsVUFDWixRQUFRO0FBQUEsUUFDVDtBQUFBLFFBQ0EsWUFBWTtBQUFBLFVBQ1gsYUFBYTtBQUFBLFFBQ2Q7QUFBQSxNQUNELEdBQUcsSUFBSTtBQUNQLFVBQUksYUFBYTtBQUNoQixhQUFLLFVBQVUsV0FBVztBQUFBLE1BQzNCO0FBQ0EsV0FBSyxlQUFlLE9BQU8sU0FBUztBQUNwQyxXQUFLLGVBQWUsTUFBTTtBQUFBLElBQzNCLENBQUM7QUFBQSxFQUNGO0FBQ0Q7QUE1Q2EscUJBQU47QUFBQSxFQUlKO0FBQUEsRUFDQTtBQUFBLEdBTFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
