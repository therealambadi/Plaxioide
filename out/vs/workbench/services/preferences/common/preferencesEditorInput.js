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
import { Codicon } from "../../../../base/common/codicons.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import * as nls from "../../../../nls.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { IPreferencesService } from "./preferences.js";
const SettingsEditorIcon = registerIcon("settings-editor-label-icon", Codicon.settings, nls.localize("settingsEditorLabelIcon", "Icon of the settings editor label."));
let SettingsEditor2Input = class extends EditorInput {
  constructor(_preferencesService) {
    super();
    this.resource = URI.from({
      scheme: Schemas.vscodeSettings,
      path: `settingseditor`
    });
    this._settingsModel = _preferencesService.createSettings2EditorModel();
  }
  matches(otherInput) {
    return super.matches(otherInput) || otherInput instanceof SettingsEditor2Input;
  }
  get typeId() {
    return SettingsEditor2Input.ID;
  }
  getName() {
    return nls.localize("settingsEditor2InputName", "Settings");
  }
  getIcon() {
    return SettingsEditorIcon;
  }
  async resolve() {
    return this._settingsModel;
  }
  dispose() {
    this._settingsModel.dispose();
    super.dispose();
  }
};
SettingsEditor2Input.ID = "workbench.input.settings2";
SettingsEditor2Input = __decorateClass([
  __decorateParam(0, IPreferencesService)
], SettingsEditor2Input);
export {
  SettingsEditor2Input
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzRWRpdG9ySW5wdXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVVudHlwZWRFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElQcmVmZXJlbmNlc1NlcnZpY2UgfSBmcm9tICcuL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IFNldHRpbmdzMkVkaXRvck1vZGVsIH0gZnJvbSAnLi9wcmVmZXJlbmNlc01vZGVscy5qcyc7XG5cbmNvbnN0IFNldHRpbmdzRWRpdG9ySWNvbiA9IHJlZ2lzdGVySWNvbignc2V0dGluZ3MtZWRpdG9yLWxhYmVsLWljb24nLCBDb2RpY29uLnNldHRpbmdzLCBubHMubG9jYWxpemUoJ3NldHRpbmdzRWRpdG9yTGFiZWxJY29uJywgJ0ljb24gb2YgdGhlIHNldHRpbmdzIGVkaXRvciBsYWJlbC4nKSk7XG5cbmV4cG9ydCBjbGFzcyBTZXR0aW5nc0VkaXRvcjJJbnB1dCBleHRlbmRzIEVkaXRvcklucHV0IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQ6IHN0cmluZyA9ICd3b3JrYmVuY2guaW5wdXQuc2V0dGluZ3MyJztcblx0cHJpdmF0ZSByZWFkb25seSBfc2V0dGluZ3NNb2RlbDogU2V0dGluZ3MyRWRpdG9yTW9kZWw7XG5cblx0cmVhZG9ubHkgcmVzb3VyY2U6IFVSSSA9IFVSSS5mcm9tKHtcblx0XHRzY2hlbWU6IFNjaGVtYXMudnNjb2RlU2V0dGluZ3MsXG5cdFx0cGF0aDogYHNldHRpbmdzZWRpdG9yYFxuXHR9KTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVByZWZlcmVuY2VzU2VydmljZSBfcHJlZmVyZW5jZXNTZXJ2aWNlOiBJUHJlZmVyZW5jZXNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fc2V0dGluZ3NNb2RlbCA9IF9wcmVmZXJlbmNlc1NlcnZpY2UuY3JlYXRlU2V0dGluZ3MyRWRpdG9yTW9kZWwoKTtcblx0fVxuXG5cdG92ZXJyaWRlIG1hdGNoZXMob3RoZXJJbnB1dDogRWRpdG9ySW5wdXQgfCBJVW50eXBlZEVkaXRvcklucHV0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHN1cGVyLm1hdGNoZXMob3RoZXJJbnB1dCkgfHwgb3RoZXJJbnB1dCBpbnN0YW5jZW9mIFNldHRpbmdzRWRpdG9yMklucHV0O1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IHR5cGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBTZXR0aW5nc0VkaXRvcjJJbnB1dC5JRDtcblx0fVxuXG5cdG92ZXJyaWRlIGdldE5hbWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdzZXR0aW5nc0VkaXRvcjJJbnB1dE5hbWUnLCBcIlNldHRpbmdzXCIpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0SWNvbigpOiBUaGVtZUljb24ge1xuXHRcdHJldHVybiBTZXR0aW5nc0VkaXRvckljb247XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyByZXNvbHZlKCk6IFByb21pc2U8U2V0dGluZ3MyRWRpdG9yTW9kZWw+IHtcblx0XHRyZXR1cm4gdGhpcy5fc2V0dGluZ3NNb2RlbDtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fc2V0dGluZ3NNb2RlbC5kaXNwb3NlKCk7XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUV4QixTQUFTLFdBQVc7QUFDcEIsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsMkJBQTJCO0FBR3BDLE1BQU0scUJBQXFCLGFBQWEsOEJBQThCLFFBQVEsVUFBVSxJQUFJLFNBQVMsMkJBQTJCLG9DQUFvQyxDQUFDO0FBRTlKLElBQU0sdUJBQU4sY0FBbUMsWUFBWTtBQUFBLEVBVXJELFlBQ3NCLHFCQUNwQjtBQUNELFVBQU07QUFSUCxTQUFTLFdBQWdCLElBQUksS0FBSztBQUFBLE1BQ2pDLFFBQVEsUUFBUTtBQUFBLE1BQ2hCLE1BQU07QUFBQSxJQUNQLENBQUM7QUFPQSxTQUFLLGlCQUFpQixvQkFBb0IsMkJBQTJCO0FBQUEsRUFDdEU7QUFBQSxFQUVTLFFBQVEsWUFBd0Q7QUFDeEUsV0FBTyxNQUFNLFFBQVEsVUFBVSxLQUFLLHNCQUFzQjtBQUFBLEVBQzNEO0FBQUEsRUFFQSxJQUFhLFNBQWlCO0FBQzdCLFdBQU8scUJBQXFCO0FBQUEsRUFDN0I7QUFBQSxFQUVTLFVBQWtCO0FBQzFCLFdBQU8sSUFBSSxTQUFTLDRCQUE0QixVQUFVO0FBQUEsRUFDM0Q7QUFBQSxFQUVTLFVBQXFCO0FBQzdCLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFlLFVBQXlDO0FBQ3ZELFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVTLFVBQWdCO0FBQ3hCLFNBQUssZUFBZSxRQUFRO0FBRTVCLFVBQU0sUUFBUTtBQUFBLEVBQ2Y7QUFDRDtBQTNDYSxxQkFFSSxLQUFhO0FBRmpCLHVCQUFOO0FBQUEsRUFXSjtBQUFBLEdBWFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
