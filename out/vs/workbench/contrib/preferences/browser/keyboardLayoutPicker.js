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
import * as nls from "../../../../nls.js";
import { StatusbarAlignment, IStatusbarService } from "../../../services/statusbar/browser/statusbar.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { parseKeyboardLayoutDescription, areKeyboardLayoutsEqual, getKeyboardLayoutId, IKeyboardLayoutService } from "../../../../platform/keyboardLayout/common/keyboardLayout.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { KEYBOARD_LAYOUT_OPEN_PICKER } from "../common/preferences.js";
import { isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
let KeyboardLayoutPickerContribution = class extends Disposable {
  constructor(keyboardLayoutService, statusbarService) {
    super();
    this.keyboardLayoutService = keyboardLayoutService;
    this.statusbarService = statusbarService;
    this.pickerElement = this._register(new MutableDisposable());
    const name = nls.localize("status.workbench.keyboardLayout", "Keyboard Layout");
    const layout = this.keyboardLayoutService.getCurrentKeyboardLayout();
    if (layout) {
      const layoutInfo = parseKeyboardLayoutDescription(layout);
      const text = nls.localize("keyboardLayout", "Layout: {0}", layoutInfo.label);
      this.pickerElement.value = this.statusbarService.addEntry(
        {
          name,
          text,
          ariaLabel: text,
          command: KEYBOARD_LAYOUT_OPEN_PICKER
        },
        "status.workbench.keyboardLayout",
        StatusbarAlignment.RIGHT
      );
    }
    this._register(this.keyboardLayoutService.onDidChangeKeyboardLayout(() => {
      const layout2 = this.keyboardLayoutService.getCurrentKeyboardLayout();
      const layoutInfo = parseKeyboardLayoutDescription(layout2);
      if (this.pickerElement.value) {
        const text = nls.localize("keyboardLayout", "Layout: {0}", layoutInfo.label);
        this.pickerElement.value.update({
          name,
          text,
          ariaLabel: text,
          command: KEYBOARD_LAYOUT_OPEN_PICKER
        });
      } else {
        const text = nls.localize("keyboardLayout", "Layout: {0}", layoutInfo.label);
        this.pickerElement.value = this.statusbarService.addEntry(
          {
            name,
            text,
            ariaLabel: text,
            command: KEYBOARD_LAYOUT_OPEN_PICKER
          },
          "status.workbench.keyboardLayout",
          StatusbarAlignment.RIGHT
        );
      }
    }));
  }
};
KeyboardLayoutPickerContribution.ID = "workbench.contrib.keyboardLayoutPicker";
KeyboardLayoutPickerContribution = __decorateClass([
  __decorateParam(0, IKeyboardLayoutService),
  __decorateParam(1, IStatusbarService)
], KeyboardLayoutPickerContribution);
registerWorkbenchContribution2(KeyboardLayoutPickerContribution.ID, KeyboardLayoutPickerContribution, WorkbenchPhase.BlockStartup);
const DEFAULT_CONTENT = [
  `// ${nls.localize("displayLanguage", "Defines the keyboard layout used in VS Code in the browser environment.")}`,
  `// ${nls.localize("doc", 'Open VS Code and run "Developer: Inspect Key Mappings (JSON)" from Command Palette.')}`,
  ``,
  `// Once you have the keyboard layout info, please paste it below.`,
  "\n"
].join("\n");
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: KEYBOARD_LAYOUT_OPEN_PICKER,
      title: nls.localize2("keyboard.chooseLayout", "Change Keyboard Layout"),
      f1: true
    });
  }
  async run(accessor) {
    const keyboardLayoutService = accessor.get(IKeyboardLayoutService);
    const quickInputService = accessor.get(IQuickInputService);
    const configurationService = accessor.get(IConfigurationService);
    const environmentService = accessor.get(IEnvironmentService);
    const editorService = accessor.get(IEditorService);
    const fileService = accessor.get(IFileService);
    const layouts = keyboardLayoutService.getAllKeyboardLayouts();
    const currentLayout = keyboardLayoutService.getCurrentKeyboardLayout();
    const layoutConfig = configurationService.getValue("keyboard.layout");
    const isAutoDetect = layoutConfig === "autodetect";
    const picks = layouts.map((layout) => {
      const picked = !isAutoDetect && areKeyboardLayoutsEqual(currentLayout, layout);
      const layoutInfo = parseKeyboardLayoutDescription(layout);
      return {
        layout,
        label: [layoutInfo.label, layout && layout.isUserKeyboardLayout ? "(User configured layout)" : ""].join(" "),
        id: layout.text || layout.lang || layout.layout,
        description: layoutInfo.description + (picked ? " (Current layout)" : ""),
        picked: !isAutoDetect && areKeyboardLayoutsEqual(currentLayout, layout)
      };
    }).sort((a, b) => {
      return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
    });
    if (picks.length > 0) {
      const platform = isMacintosh ? "Mac" : isWindows ? "Win" : "Linux";
      picks.unshift({ type: "separator", label: nls.localize("layoutPicks", "Keyboard Layouts ({0})", platform) });
    }
    const configureKeyboardLayout = { label: nls.localize("configureKeyboardLayout", "Configure Keyboard Layout") };
    picks.unshift(configureKeyboardLayout);
    const autoDetectMode = {
      label: nls.localize("autoDetect", "Auto Detect"),
      description: isAutoDetect ? `Current: ${parseKeyboardLayoutDescription(currentLayout).label}` : void 0,
      picked: isAutoDetect ? true : void 0
    };
    picks.unshift(autoDetectMode);
    const pick = await quickInputService.pick(picks, { placeHolder: nls.localize("pickKeyboardLayout", "Select Keyboard Layout"), matchOnDescription: true });
    if (!pick) {
      return;
    }
    if (pick === autoDetectMode) {
      configurationService.updateValue("keyboard.layout", "autodetect");
      return;
    }
    if (pick === configureKeyboardLayout) {
      const file = environmentService.keyboardLayoutResource;
      await fileService.stat(file).then(void 0, () => {
        return fileService.createFile(file, VSBuffer.fromString(DEFAULT_CONTENT));
      }).then((stat) => {
        if (!stat) {
          return void 0;
        }
        return editorService.openEditor({
          resource: stat.resource,
          languageId: "jsonc",
          options: { pinned: true }
        });
      }, (error) => {
        throw new Error(nls.localize("fail.createSettings", "Unable to create '{0}' ({1}).", file.toString(), error));
      });
      return Promise.resolve();
    }
    configurationService.updateValue("keyboard.layout", getKeyboardLayoutId(pick.layout));
  }
});
export {
  KeyboardLayoutPickerContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL2tleWJvYXJkTGF5b3V0UGlja2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBTdGF0dXNiYXJBbGlnbm1lbnQsIElTdGF0dXNiYXJTZXJ2aWNlLCBJU3RhdHVzYmFyRW50cnlBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3N0YXR1c2Jhci9icm93c2VyL3N0YXR1c2Jhci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBwYXJzZUtleWJvYXJkTGF5b3V0RGVzY3JpcHRpb24sIGFyZUtleWJvYXJkTGF5b3V0c0VxdWFsLCBnZXRLZXlib2FyZExheW91dElkLCBJS2V5Ym9hcmRMYXlvdXRTZXJ2aWNlLCBJS2V5Ym9hcmRMYXlvdXRJbmZvIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5Ym9hcmRMYXlvdXQvY29tbW9uL2tleWJvYXJkTGF5b3V0LmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBLRVlCT0FSRF9MQVlPVVRfT1BFTl9QSUNLRVIgfSBmcm9tICcuLi9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2gsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFF1aWNrUGlja0lucHV0LCBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgSUVkaXRvclBhbmUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcblxuZXhwb3J0IGNsYXNzIEtleWJvYXJkTGF5b3V0UGlja2VyQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5rZXlib2FyZExheW91dFBpY2tlcic7XG5cblx0cHJpdmF0ZSByZWFkb25seSBwaWNrZXJFbGVtZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yPigpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUtleWJvYXJkTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJvYXJkTGF5b3V0U2VydmljZTogSUtleWJvYXJkTGF5b3V0U2VydmljZSxcblx0XHRASVN0YXR1c2JhclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdGF0dXNiYXJTZXJ2aWNlOiBJU3RhdHVzYmFyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IG5hbWUgPSBubHMubG9jYWxpemUoJ3N0YXR1cy53b3JrYmVuY2gua2V5Ym9hcmRMYXlvdXQnLCBcIktleWJvYXJkIExheW91dFwiKTtcblxuXHRcdGNvbnN0IGxheW91dCA9IHRoaXMua2V5Ym9hcmRMYXlvdXRTZXJ2aWNlLmdldEN1cnJlbnRLZXlib2FyZExheW91dCgpO1xuXHRcdGlmIChsYXlvdXQpIHtcblx0XHRcdGNvbnN0IGxheW91dEluZm8gPSBwYXJzZUtleWJvYXJkTGF5b3V0RGVzY3JpcHRpb24obGF5b3V0KTtcblx0XHRcdGNvbnN0IHRleHQgPSBubHMubG9jYWxpemUoJ2tleWJvYXJkTGF5b3V0JywgXCJMYXlvdXQ6IHswfVwiLCBsYXlvdXRJbmZvLmxhYmVsKTtcblxuXHRcdFx0dGhpcy5waWNrZXJFbGVtZW50LnZhbHVlID0gdGhpcy5zdGF0dXNiYXJTZXJ2aWNlLmFkZEVudHJ5KFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bmFtZSxcblx0XHRcdFx0XHR0ZXh0LFxuXHRcdFx0XHRcdGFyaWFMYWJlbDogdGV4dCxcblx0XHRcdFx0XHRjb21tYW5kOiBLRVlCT0FSRF9MQVlPVVRfT1BFTl9QSUNLRVJcblx0XHRcdFx0fSxcblx0XHRcdFx0J3N0YXR1cy53b3JrYmVuY2gua2V5Ym9hcmRMYXlvdXQnLFxuXHRcdFx0XHRTdGF0dXNiYXJBbGlnbm1lbnQuUklHSFRcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5rZXlib2FyZExheW91dFNlcnZpY2Uub25EaWRDaGFuZ2VLZXlib2FyZExheW91dCgoKSA9PiB7XG5cdFx0XHRjb25zdCBsYXlvdXQgPSB0aGlzLmtleWJvYXJkTGF5b3V0U2VydmljZS5nZXRDdXJyZW50S2V5Ym9hcmRMYXlvdXQoKTtcblx0XHRcdGNvbnN0IGxheW91dEluZm8gPSBwYXJzZUtleWJvYXJkTGF5b3V0RGVzY3JpcHRpb24obGF5b3V0KTtcblxuXHRcdFx0aWYgKHRoaXMucGlja2VyRWxlbWVudC52YWx1ZSkge1xuXHRcdFx0XHRjb25zdCB0ZXh0ID0gbmxzLmxvY2FsaXplKCdrZXlib2FyZExheW91dCcsIFwiTGF5b3V0OiB7MH1cIiwgbGF5b3V0SW5mby5sYWJlbCk7XG5cdFx0XHRcdHRoaXMucGlja2VyRWxlbWVudC52YWx1ZS51cGRhdGUoe1xuXHRcdFx0XHRcdG5hbWUsXG5cdFx0XHRcdFx0dGV4dCxcblx0XHRcdFx0XHRhcmlhTGFiZWw6IHRleHQsXG5cdFx0XHRcdFx0Y29tbWFuZDogS0VZQk9BUkRfTEFZT1VUX09QRU5fUElDS0VSXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgdGV4dCA9IG5scy5sb2NhbGl6ZSgna2V5Ym9hcmRMYXlvdXQnLCBcIkxheW91dDogezB9XCIsIGxheW91dEluZm8ubGFiZWwpO1xuXHRcdFx0XHR0aGlzLnBpY2tlckVsZW1lbnQudmFsdWUgPSB0aGlzLnN0YXR1c2JhclNlcnZpY2UuYWRkRW50cnkoXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZSxcblx0XHRcdFx0XHRcdHRleHQsXG5cdFx0XHRcdFx0XHRhcmlhTGFiZWw6IHRleHQsXG5cdFx0XHRcdFx0XHRjb21tYW5kOiBLRVlCT0FSRF9MQVlPVVRfT1BFTl9QSUNLRVJcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdCdzdGF0dXMud29ya2JlbmNoLmtleWJvYXJkTGF5b3V0Jyxcblx0XHRcdFx0XHRTdGF0dXNiYXJBbGlnbm1lbnQuUklHSFRcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cbn1cblxucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKEtleWJvYXJkTGF5b3V0UGlja2VyQ29udHJpYnV0aW9uLklELCBLZXlib2FyZExheW91dFBpY2tlckNvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UuQmxvY2tTdGFydHVwKTtcblxuaW50ZXJmYWNlIExheW91dFF1aWNrUGlja0l0ZW0gZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdGxheW91dDogSUtleWJvYXJkTGF5b3V0SW5mbztcbn1cblxuaW50ZXJmYWNlIElVbmtub3duTGF5b3V0IHtcblx0dGV4dD86IHN0cmluZztcblx0bGFuZz86IHN0cmluZztcblx0bGF5b3V0Pzogc3RyaW5nO1xufVxuXG5jb25zdCBERUZBVUxUX0NPTlRFTlQ6IHN0cmluZyA9IFtcblx0YC8vICR7bmxzLmxvY2FsaXplKCdkaXNwbGF5TGFuZ3VhZ2UnLCAnRGVmaW5lcyB0aGUga2V5Ym9hcmQgbGF5b3V0IHVzZWQgaW4gVlMgQ29kZSBpbiB0aGUgYnJvd3NlciBlbnZpcm9ubWVudC4nKX1gLFxuXHRgLy8gJHtubHMubG9jYWxpemUoJ2RvYycsICdPcGVuIFZTIENvZGUgYW5kIHJ1biBcIkRldmVsb3BlcjogSW5zcGVjdCBLZXkgTWFwcGluZ3MgKEpTT04pXCIgZnJvbSBDb21tYW5kIFBhbGV0dGUuJyl9YCxcblx0YGAsXG5cdGAvLyBPbmNlIHlvdSBoYXZlIHRoZSBrZXlib2FyZCBsYXlvdXQgaW5mbywgcGxlYXNlIHBhc3RlIGl0IGJlbG93LmAsXG5cdCdcXG4nXG5dLmpvaW4oJ1xcbicpO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEtFWUJPQVJEX0xBWU9VVF9PUEVOX1BJQ0tFUixcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdrZXlib2FyZC5jaG9vc2VMYXlvdXQnLCBcIkNoYW5nZSBLZXlib2FyZCBMYXlvdXRcIiksXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qga2V5Ym9hcmRMYXlvdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElLZXlib2FyZExheW91dFNlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVudmlyb25tZW50U2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGxheW91dHMgPSBrZXlib2FyZExheW91dFNlcnZpY2UuZ2V0QWxsS2V5Ym9hcmRMYXlvdXRzKCk7XG5cdFx0Y29uc3QgY3VycmVudExheW91dCA9IGtleWJvYXJkTGF5b3V0U2VydmljZS5nZXRDdXJyZW50S2V5Ym9hcmRMYXlvdXQoKTtcblx0XHRjb25zdCBsYXlvdXRDb25maWcgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgna2V5Ym9hcmQubGF5b3V0Jyk7XG5cdFx0Y29uc3QgaXNBdXRvRGV0ZWN0ID0gbGF5b3V0Q29uZmlnID09PSAnYXV0b2RldGVjdCc7XG5cblx0XHRjb25zdCBwaWNrczogUXVpY2tQaWNrSW5wdXRbXSA9IGxheW91dHMubWFwKGxheW91dCA9PiB7XG5cdFx0XHRjb25zdCBwaWNrZWQgPSAhaXNBdXRvRGV0ZWN0ICYmIGFyZUtleWJvYXJkTGF5b3V0c0VxdWFsKGN1cnJlbnRMYXlvdXQsIGxheW91dCk7XG5cdFx0XHRjb25zdCBsYXlvdXRJbmZvID0gcGFyc2VLZXlib2FyZExheW91dERlc2NyaXB0aW9uKGxheW91dCk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRsYXlvdXQ6IGxheW91dCxcblx0XHRcdFx0bGFiZWw6IFtsYXlvdXRJbmZvLmxhYmVsLCAobGF5b3V0ICYmIGxheW91dC5pc1VzZXJLZXlib2FyZExheW91dCkgPyAnKFVzZXIgY29uZmlndXJlZCBsYXlvdXQpJyA6ICcnXS5qb2luKCcgJyksXG5cdFx0XHRcdGlkOiAobGF5b3V0IGFzIElVbmtub3duTGF5b3V0KS50ZXh0IHx8IChsYXlvdXQgYXMgSVVua25vd25MYXlvdXQpLmxhbmcgfHwgKGxheW91dCBhcyBJVW5rbm93bkxheW91dCkubGF5b3V0LFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbGF5b3V0SW5mby5kZXNjcmlwdGlvbiArIChwaWNrZWQgPyAnIChDdXJyZW50IGxheW91dCknIDogJycpLFxuXHRcdFx0XHRwaWNrZWQ6ICFpc0F1dG9EZXRlY3QgJiYgYXJlS2V5Ym9hcmRMYXlvdXRzRXF1YWwoY3VycmVudExheW91dCwgbGF5b3V0KVxuXHRcdFx0fTtcblx0XHR9KS5zb3J0KChhOiBJUXVpY2tQaWNrSXRlbSwgYjogSVF1aWNrUGlja0l0ZW0pID0+IHtcblx0XHRcdHJldHVybiBhLmxhYmVsIDwgYi5sYWJlbCA/IC0xIDogKGEubGFiZWwgPiBiLmxhYmVsID8gMSA6IDApO1xuXHRcdH0pO1xuXG5cdFx0aWYgKHBpY2tzLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IHBsYXRmb3JtID0gaXNNYWNpbnRvc2ggPyAnTWFjJyA6IGlzV2luZG93cyA/ICdXaW4nIDogJ0xpbnV4Jztcblx0XHRcdHBpY2tzLnVuc2hpZnQoeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IG5scy5sb2NhbGl6ZSgnbGF5b3V0UGlja3MnLCBcIktleWJvYXJkIExheW91dHMgKHswfSlcIiwgcGxhdGZvcm0pIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbmZpZ3VyZUtleWJvYXJkTGF5b3V0OiBJUXVpY2tQaWNrSXRlbSA9IHsgbGFiZWw6IG5scy5sb2NhbGl6ZSgnY29uZmlndXJlS2V5Ym9hcmRMYXlvdXQnLCBcIkNvbmZpZ3VyZSBLZXlib2FyZCBMYXlvdXRcIikgfTtcblxuXHRcdHBpY2tzLnVuc2hpZnQoY29uZmlndXJlS2V5Ym9hcmRMYXlvdXQpO1xuXG5cdFx0Ly8gT2ZmZXIgdG8gXCJBdXRvIERldGVjdFwiXG5cdFx0Y29uc3QgYXV0b0RldGVjdE1vZGU6IElRdWlja1BpY2tJdGVtID0ge1xuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnYXV0b0RldGVjdCcsIFwiQXV0byBEZXRlY3RcIiksXG5cdFx0XHRkZXNjcmlwdGlvbjogaXNBdXRvRGV0ZWN0ID8gYEN1cnJlbnQ6ICR7cGFyc2VLZXlib2FyZExheW91dERlc2NyaXB0aW9uKGN1cnJlbnRMYXlvdXQpLmxhYmVsfWAgOiB1bmRlZmluZWQsXG5cdFx0XHRwaWNrZWQ6IGlzQXV0b0RldGVjdCA/IHRydWUgOiB1bmRlZmluZWRcblx0XHR9O1xuXG5cdFx0cGlja3MudW5zaGlmdChhdXRvRGV0ZWN0TW9kZSk7XG5cblx0XHRjb25zdCBwaWNrID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhwaWNrcywgeyBwbGFjZUhvbGRlcjogbmxzLmxvY2FsaXplKCdwaWNrS2V5Ym9hcmRMYXlvdXQnLCBcIlNlbGVjdCBLZXlib2FyZCBMYXlvdXRcIiksIG1hdGNoT25EZXNjcmlwdGlvbjogdHJ1ZSB9KTtcblx0XHRpZiAoIXBpY2spIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAocGljayA9PT0gYXV0b0RldGVjdE1vZGUpIHtcblx0XHRcdC8vIHNldCBrZXltYXAgc2VydmljZSB0byBhdXRvIG1vZGVcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKCdrZXlib2FyZC5sYXlvdXQnLCAnYXV0b2RldGVjdCcpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChwaWNrID09PSBjb25maWd1cmVLZXlib2FyZExheW91dCkge1xuXHRcdFx0Y29uc3QgZmlsZSA9IGVudmlyb25tZW50U2VydmljZS5rZXlib2FyZExheW91dFJlc291cmNlO1xuXG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS5zdGF0KGZpbGUpLnRoZW4odW5kZWZpbmVkLCAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiBmaWxlU2VydmljZS5jcmVhdGVGaWxlKGZpbGUsIFZTQnVmZmVyLmZyb21TdHJpbmcoREVGQVVMVF9DT05URU5UKSk7XG5cdFx0XHR9KS50aGVuKChzdGF0KTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD4gfCB1bmRlZmluZWQgPT4ge1xuXHRcdFx0XHRpZiAoIXN0YXQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRcdHJlc291cmNlOiBzdGF0LnJlc291cmNlLFxuXHRcdFx0XHRcdGxhbmd1YWdlSWQ6ICdqc29uYycsXG5cdFx0XHRcdFx0b3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfVxuXHRcdFx0XHR9KTtcblx0XHRcdH0sIChlcnJvcikgPT4ge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IobmxzLmxvY2FsaXplKCdmYWlsLmNyZWF0ZVNldHRpbmdzJywgXCJVbmFibGUgdG8gY3JlYXRlICd7MH0nICh7MX0pLlwiLCBmaWxlLnRvU3RyaW5nKCksIGVycm9yKSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblxuXHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKCdrZXlib2FyZC5sYXlvdXQnLCBnZXRLZXlib2FyZExheW91dElkKCg8TGF5b3V0UXVpY2tQaWNrSXRlbT5waWNrKS5sYXlvdXQpKTtcblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLG9CQUFvQix5QkFBa0Q7QUFDL0UsU0FBUyxZQUFZLHlCQUF5QjtBQUM5QyxTQUFTLGdDQUFnQyx5QkFBeUIscUJBQXFCLDhCQUFtRDtBQUMxSSxTQUFpQyxnQkFBZ0Isc0NBQXNDO0FBQ3ZGLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsYUFBYSxpQkFBaUI7QUFDdkMsU0FBeUIsMEJBQTBDO0FBQ25FLFNBQVMsU0FBUyx1QkFBdUI7QUFDekMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFJbEIsSUFBTSxtQ0FBTixjQUErQyxXQUE2QztBQUFBLEVBTWxHLFlBQzBDLHVCQUNMLGtCQUNuQztBQUNELFVBQU07QUFIbUM7QUFDTDtBQUpyQyxTQUFpQixnQkFBZ0IsS0FBSyxVQUFVLElBQUksa0JBQTJDLENBQUM7QUFRL0YsVUFBTSxPQUFPLElBQUksU0FBUyxtQ0FBbUMsaUJBQWlCO0FBRTlFLFVBQU0sU0FBUyxLQUFLLHNCQUFzQix5QkFBeUI7QUFDbkUsUUFBSSxRQUFRO0FBQ1gsWUFBTSxhQUFhLCtCQUErQixNQUFNO0FBQ3hELFlBQU0sT0FBTyxJQUFJLFNBQVMsa0JBQWtCLGVBQWUsV0FBVyxLQUFLO0FBRTNFLFdBQUssY0FBYyxRQUFRLEtBQUssaUJBQWlCO0FBQUEsUUFDaEQ7QUFBQSxVQUNDO0FBQUEsVUFDQTtBQUFBLFVBQ0EsV0FBVztBQUFBLFVBQ1gsU0FBUztBQUFBLFFBQ1Y7QUFBQSxRQUNBO0FBQUEsUUFDQSxtQkFBbUI7QUFBQSxNQUNwQjtBQUFBLElBQ0Q7QUFFQSxTQUFLLFVBQVUsS0FBSyxzQkFBc0IsMEJBQTBCLE1BQU07QUFDekUsWUFBTUEsVUFBUyxLQUFLLHNCQUFzQix5QkFBeUI7QUFDbkUsWUFBTSxhQUFhLCtCQUErQkEsT0FBTTtBQUV4RCxVQUFJLEtBQUssY0FBYyxPQUFPO0FBQzdCLGNBQU0sT0FBTyxJQUFJLFNBQVMsa0JBQWtCLGVBQWUsV0FBVyxLQUFLO0FBQzNFLGFBQUssY0FBYyxNQUFNLE9BQU87QUFBQSxVQUMvQjtBQUFBLFVBQ0E7QUFBQSxVQUNBLFdBQVc7QUFBQSxVQUNYLFNBQVM7QUFBQSxRQUNWLENBQUM7QUFBQSxNQUNGLE9BQU87QUFDTixjQUFNLE9BQU8sSUFBSSxTQUFTLGtCQUFrQixlQUFlLFdBQVcsS0FBSztBQUMzRSxhQUFLLGNBQWMsUUFBUSxLQUFLLGlCQUFpQjtBQUFBLFVBQ2hEO0FBQUEsWUFDQztBQUFBLFlBQ0E7QUFBQSxZQUNBLFdBQVc7QUFBQSxZQUNYLFNBQVM7QUFBQSxVQUNWO0FBQUEsVUFDQTtBQUFBLFVBQ0EsbUJBQW1CO0FBQUEsUUFDcEI7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQ0Q7QUExRGEsaUNBRUksS0FBSztBQUZULG1DQUFOO0FBQUEsRUFPSjtBQUFBLEVBQ0E7QUFBQSxHQVJVO0FBNERiLCtCQUErQixpQ0FBaUMsSUFBSSxrQ0FBa0MsZUFBZSxZQUFZO0FBWWpJLE1BQU0sa0JBQTBCO0FBQUEsRUFDL0IsTUFBTSxJQUFJLFNBQVMsbUJBQW1CLHlFQUF5RSxDQUFDO0FBQUEsRUFDaEgsTUFBTSxJQUFJLFNBQVMsT0FBTyxxRkFBcUYsQ0FBQztBQUFBLEVBQ2hIO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRCxFQUFFLEtBQUssSUFBSTtBQUVYLGdCQUFnQixjQUFjLFFBQVE7QUFBQSxFQUNyQyxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTyxJQUFJLFVBQVUseUJBQXlCLHdCQUF3QjtBQUFBLE1BQ3RFLElBQUk7QUFBQSxJQUNMLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFNLElBQUksVUFBMkM7QUFDcEQsVUFBTSx3QkFBd0IsU0FBUyxJQUFJLHNCQUFzQjtBQUNqRSxVQUFNLG9CQUFvQixTQUFTLElBQUksa0JBQWtCO0FBQ3pELFVBQU0sdUJBQXVCLFNBQVMsSUFBSSxxQkFBcUI7QUFDL0QsVUFBTSxxQkFBcUIsU0FBUyxJQUFJLG1CQUFtQjtBQUMzRCxVQUFNLGdCQUFnQixTQUFTLElBQUksY0FBYztBQUNqRCxVQUFNLGNBQWMsU0FBUyxJQUFJLFlBQVk7QUFFN0MsVUFBTSxVQUFVLHNCQUFzQixzQkFBc0I7QUFDNUQsVUFBTSxnQkFBZ0Isc0JBQXNCLHlCQUF5QjtBQUNyRSxVQUFNLGVBQWUscUJBQXFCLFNBQVMsaUJBQWlCO0FBQ3BFLFVBQU0sZUFBZSxpQkFBaUI7QUFFdEMsVUFBTSxRQUEwQixRQUFRLElBQUksWUFBVTtBQUNyRCxZQUFNLFNBQVMsQ0FBQyxnQkFBZ0Isd0JBQXdCLGVBQWUsTUFBTTtBQUM3RSxZQUFNLGFBQWEsK0JBQStCLE1BQU07QUFDeEQsYUFBTztBQUFBLFFBQ047QUFBQSxRQUNBLE9BQU8sQ0FBQyxXQUFXLE9BQVEsVUFBVSxPQUFPLHVCQUF3Qiw2QkFBNkIsRUFBRSxFQUFFLEtBQUssR0FBRztBQUFBLFFBQzdHLElBQUssT0FBMEIsUUFBUyxPQUEwQixRQUFTLE9BQTBCO0FBQUEsUUFDckcsYUFBYSxXQUFXLGVBQWUsU0FBUyxzQkFBc0I7QUFBQSxRQUN0RSxRQUFRLENBQUMsZ0JBQWdCLHdCQUF3QixlQUFlLE1BQU07QUFBQSxNQUN2RTtBQUFBLElBQ0QsQ0FBQyxFQUFFLEtBQUssQ0FBQyxHQUFtQixNQUFzQjtBQUNqRCxhQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsS0FBTSxFQUFFLFFBQVEsRUFBRSxRQUFRLElBQUk7QUFBQSxJQUMxRCxDQUFDO0FBRUQsUUFBSSxNQUFNLFNBQVMsR0FBRztBQUNyQixZQUFNLFdBQVcsY0FBYyxRQUFRLFlBQVksUUFBUTtBQUMzRCxZQUFNLFFBQVEsRUFBRSxNQUFNLGFBQWEsT0FBTyxJQUFJLFNBQVMsZUFBZSwwQkFBMEIsUUFBUSxFQUFFLENBQUM7QUFBQSxJQUM1RztBQUVBLFVBQU0sMEJBQTBDLEVBQUUsT0FBTyxJQUFJLFNBQVMsMkJBQTJCLDJCQUEyQixFQUFFO0FBRTlILFVBQU0sUUFBUSx1QkFBdUI7QUFHckMsVUFBTSxpQkFBaUM7QUFBQSxNQUN0QyxPQUFPLElBQUksU0FBUyxjQUFjLGFBQWE7QUFBQSxNQUMvQyxhQUFhLGVBQWUsWUFBWSwrQkFBK0IsYUFBYSxFQUFFLEtBQUssS0FBSztBQUFBLE1BQ2hHLFFBQVEsZUFBZSxPQUFPO0FBQUEsSUFDL0I7QUFFQSxVQUFNLFFBQVEsY0FBYztBQUU1QixVQUFNLE9BQU8sTUFBTSxrQkFBa0IsS0FBSyxPQUFPLEVBQUUsYUFBYSxJQUFJLFNBQVMsc0JBQXNCLHdCQUF3QixHQUFHLG9CQUFvQixLQUFLLENBQUM7QUFDeEosUUFBSSxDQUFDLE1BQU07QUFDVjtBQUFBLElBQ0Q7QUFFQSxRQUFJLFNBQVMsZ0JBQWdCO0FBRTVCLDJCQUFxQixZQUFZLG1CQUFtQixZQUFZO0FBQ2hFO0FBQUEsSUFDRDtBQUVBLFFBQUksU0FBUyx5QkFBeUI7QUFDckMsWUFBTSxPQUFPLG1CQUFtQjtBQUVoQyxZQUFNLFlBQVksS0FBSyxJQUFJLEVBQUUsS0FBSyxRQUFXLE1BQU07QUFDbEQsZUFBTyxZQUFZLFdBQVcsTUFBTSxTQUFTLFdBQVcsZUFBZSxDQUFDO0FBQUEsTUFDekUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxTQUF1RDtBQUMvRCxZQUFJLENBQUMsTUFBTTtBQUNWLGlCQUFPO0FBQUEsUUFDUjtBQUNBLGVBQU8sY0FBYyxXQUFXO0FBQUEsVUFDL0IsVUFBVSxLQUFLO0FBQUEsVUFDZixZQUFZO0FBQUEsVUFDWixTQUFTLEVBQUUsUUFBUSxLQUFLO0FBQUEsUUFDekIsQ0FBQztBQUFBLE1BQ0YsR0FBRyxDQUFDLFVBQVU7QUFDYixjQUFNLElBQUksTUFBTSxJQUFJLFNBQVMsdUJBQXVCLGlDQUFpQyxLQUFLLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFBQSxNQUM3RyxDQUFDO0FBRUQsYUFBTyxRQUFRLFFBQVE7QUFBQSxJQUN4QjtBQUVBLHlCQUFxQixZQUFZLG1CQUFtQixvQkFBMEMsS0FBTSxNQUFNLENBQUM7QUFBQSxFQUM1RztBQUNELENBQUM7IiwKICAibmFtZXMiOiBbImxheW91dCJdCn0K
