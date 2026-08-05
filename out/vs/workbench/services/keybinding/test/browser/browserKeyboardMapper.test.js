import assert from "assert";
import "../../browser/keyboardLayouts/en.darwin.js";
import "../../browser/keyboardLayouts/de.darwin.js";
import { KeyboardLayoutContribution } from "../../browser/keyboardLayouts/_.contribution.js";
import { BrowserKeyboardMapperFactoryBase } from "../../browser/keyboardLayoutService.js";
import { KeymapInfo } from "../../common/keymapInfo.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { TestNotificationService } from "../../../../../platform/notification/test/common/testNotificationService.js";
import { TestStorageService } from "../../../../test/common/workbenchTestServices.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
class TestKeyboardMapperFactory extends BrowserKeyboardMapperFactoryBase {
  constructor(configurationService, notificationService, storageService, commandService) {
    super(configurationService);
    const keymapInfos = KeyboardLayoutContribution.INSTANCE.layoutInfos;
    this._keymapInfos.push(...keymapInfos.map((info) => new KeymapInfo(info.layout, info.secondaryLayouts, info.mapping, info.isUserKeyboardLayout)));
    this._mru = this._keymapInfos;
    this._initialized = true;
    this.setLayoutFromBrowserAPI();
    const usLayout = this.getUSStandardLayout();
    if (usLayout) {
      this.setActiveKeyMapping(usLayout.mapping);
    }
  }
}
suite("keyboard layout loader", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  let instantiationService;
  let instance;
  setup(() => {
    instantiationService = new TestInstantiationService();
    const storageService = new TestStorageService();
    const notitifcationService = instantiationService.stub(INotificationService, new TestNotificationService());
    const configurationService = instantiationService.stub(IConfigurationService, new TestConfigurationService());
    const commandService = instantiationService.stub(ICommandService, {});
    ds.add(instantiationService);
    ds.add(storageService);
    instance = new TestKeyboardMapperFactory(configurationService, notitifcationService, storageService, commandService);
    ds.add(instance);
  });
  teardown(() => {
    instantiationService.dispose();
  });
  test("load default US keyboard layout", () => {
    assert.notStrictEqual(instance.activeKeyboardLayout, null);
  });
  test("isKeyMappingActive", () => {
    instance.setUSKeyboardLayout();
    assert.strictEqual(instance.isKeyMappingActive({
      KeyA: {
        value: "a",
        valueIsDeadKey: false,
        withShift: "A",
        withShiftIsDeadKey: false,
        withAltGr: "\xE5",
        withAltGrIsDeadKey: false,
        withShiftAltGr: "\xC5",
        withShiftAltGrIsDeadKey: false
      }
    }), true);
    assert.strictEqual(instance.isKeyMappingActive({
      KeyA: {
        value: "a",
        valueIsDeadKey: false,
        withShift: "A",
        withShiftIsDeadKey: false,
        withAltGr: "\xE5",
        withAltGrIsDeadKey: false,
        withShiftAltGr: "\xC5",
        withShiftAltGrIsDeadKey: false
      },
      KeyZ: {
        value: "z",
        valueIsDeadKey: false,
        withShift: "Z",
        withShiftIsDeadKey: false,
        withAltGr: "\u03A9",
        withAltGrIsDeadKey: false,
        withShiftAltGr: "\xB8",
        withShiftAltGrIsDeadKey: false
      }
    }), true);
    assert.strictEqual(instance.isKeyMappingActive({
      KeyZ: {
        value: "y",
        valueIsDeadKey: false,
        withShift: "Y",
        withShiftIsDeadKey: false,
        withAltGr: "\xA5",
        withAltGrIsDeadKey: false,
        withShiftAltGr: "\u0178",
        withShiftAltGrIsDeadKey: false
      }
    }), false);
  });
  test("Switch keymapping", () => {
    instance.setActiveKeyMapping({
      KeyZ: {
        value: "y",
        valueIsDeadKey: false,
        withShift: "Y",
        withShiftIsDeadKey: false,
        withAltGr: "\xA5",
        withAltGrIsDeadKey: false,
        withShiftAltGr: "\u0178",
        withShiftAltGrIsDeadKey: false
      }
    });
    assert.strictEqual(!!instance.activeKeyboardLayout.isUSStandard, false);
    assert.strictEqual(instance.isKeyMappingActive({
      KeyZ: {
        value: "y",
        valueIsDeadKey: false,
        withShift: "Y",
        withShiftIsDeadKey: false,
        withAltGr: "\xA5",
        withAltGrIsDeadKey: false,
        withShiftAltGr: "\u0178",
        withShiftAltGrIsDeadKey: false
      }
    }), true);
    instance.setUSKeyboardLayout();
    assert.strictEqual(instance.activeKeyboardLayout.isUSStandard, true);
  });
  test("Switch keyboard layout info", () => {
    instance.setKeyboardLayout("com.apple.keylayout.German");
    assert.strictEqual(!!instance.activeKeyboardLayout.isUSStandard, false);
    assert.strictEqual(instance.isKeyMappingActive({
      KeyZ: {
        value: "y",
        valueIsDeadKey: false,
        withShift: "Y",
        withShiftIsDeadKey: false,
        withAltGr: "\xA5",
        withAltGrIsDeadKey: false,
        withShiftAltGr: "\u0178",
        withShiftAltGrIsDeadKey: false
      }
    }), true);
    instance.setUSKeyboardLayout();
    assert.strictEqual(instance.activeKeyboardLayout.isUSStandard, true);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMva2V5YmluZGluZy90ZXN0L2Jyb3dzZXIvYnJvd3NlcktleWJvYXJkTWFwcGVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0ICcuLi8uLi9icm93c2VyL2tleWJvYXJkTGF5b3V0cy9lbi5kYXJ3aW4uanMnO1xuaW1wb3J0ICcuLi8uLi9icm93c2VyL2tleWJvYXJkTGF5b3V0cy9kZS5kYXJ3aW4uanMnO1xuaW1wb3J0IHsgS2V5Ym9hcmRMYXlvdXRDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi9icm93c2VyL2tleWJvYXJkTGF5b3V0cy9fLmNvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgeyBCcm93c2VyS2V5Ym9hcmRNYXBwZXJGYWN0b3J5QmFzZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIva2V5Ym9hcmRMYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEtleW1hcEluZm8sIElLZXltYXBJbmZvIH0gZnJvbSAnLi4vLi4vY29tbW9uL2tleW1hcEluZm8uanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBUZXN0Tm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Tm90aWZpY2F0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0U3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxuY2xhc3MgVGVzdEtleWJvYXJkTWFwcGVyRmFjdG9yeSBleHRlbmRzIEJyb3dzZXJLZXlib2FyZE1hcHBlckZhY3RvcnlCYXNlIHtcblx0Y29uc3RydWN0b3IoY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSwgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UpIHtcblx0XHQvLyBzdXBlcihub3RpZmljYXRpb25TZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgY29tbWFuZFNlcnZpY2UpO1xuXHRcdHN1cGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGtleW1hcEluZm9zOiBJS2V5bWFwSW5mb1tdID0gS2V5Ym9hcmRMYXlvdXRDb250cmlidXRpb24uSU5TVEFOQ0UubGF5b3V0SW5mb3M7XG5cdFx0dGhpcy5fa2V5bWFwSW5mb3MucHVzaCguLi5rZXltYXBJbmZvcy5tYXAoaW5mbyA9PiAobmV3IEtleW1hcEluZm8oaW5mby5sYXlvdXQsIGluZm8uc2Vjb25kYXJ5TGF5b3V0cywgaW5mby5tYXBwaW5nLCBpbmZvLmlzVXNlcktleWJvYXJkTGF5b3V0KSkpKTtcblx0XHR0aGlzLl9tcnUgPSB0aGlzLl9rZXltYXBJbmZvcztcblx0XHR0aGlzLl9pbml0aWFsaXplZCA9IHRydWU7XG5cdFx0dGhpcy5zZXRMYXlvdXRGcm9tQnJvd3NlckFQSSgpO1xuXHRcdGNvbnN0IHVzTGF5b3V0ID0gdGhpcy5nZXRVU1N0YW5kYXJkTGF5b3V0KCk7XG5cdFx0aWYgKHVzTGF5b3V0KSB7XG5cdFx0XHR0aGlzLnNldEFjdGl2ZUtleU1hcHBpbmcodXNMYXlvdXQubWFwcGluZyk7XG5cdFx0fVxuXHR9XG59XG5cbnN1aXRlKCdrZXlib2FyZCBsYXlvdXQgbG9hZGVyJywgKCkgPT4ge1xuXHRjb25zdCBkcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblx0bGV0IGluc3RhbmNlOiBUZXN0S2V5Ym9hcmRNYXBwZXJGYWN0b3J5O1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKTtcblx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKTtcblx0XHRjb25zdCBub3RpdGlmY2F0aW9uU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGlmaWNhdGlvblNlcnZpY2UsIG5ldyBUZXN0Tm90aWZpY2F0aW9uU2VydmljZSgpKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29tbWFuZFNlcnZpY2UsIHt9KTtcblxuXHRcdGRzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0ZHMuYWRkKHN0b3JhZ2VTZXJ2aWNlKTtcblxuXHRcdGluc3RhbmNlID0gbmV3IFRlc3RLZXlib2FyZE1hcHBlckZhY3RvcnkoY29uZmlndXJhdGlvblNlcnZpY2UsIG5vdGl0aWZjYXRpb25TZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgY29tbWFuZFNlcnZpY2UpO1xuXHRcdGRzLmFkZChpbnN0YW5jZSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xvYWQgZGVmYXVsdCBVUyBrZXlib2FyZCBsYXlvdXQnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGluc3RhbmNlLmFjdGl2ZUtleWJvYXJkTGF5b3V0LCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnaXNLZXlNYXBwaW5nQWN0aXZlJywgKCkgPT4ge1xuXHRcdGluc3RhbmNlLnNldFVTS2V5Ym9hcmRMYXlvdXQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdGFuY2UuaXNLZXlNYXBwaW5nQWN0aXZlKHtcblx0XHRcdEtleUE6IHtcblx0XHRcdFx0dmFsdWU6ICdhJyxcblx0XHRcdFx0dmFsdWVJc0RlYWRLZXk6IGZhbHNlLFxuXHRcdFx0XHR3aXRoU2hpZnQ6ICdBJyxcblx0XHRcdFx0d2l0aFNoaWZ0SXNEZWFkS2V5OiBmYWxzZSxcblx0XHRcdFx0d2l0aEFsdEdyOiAnXHUwMEU1Jyxcblx0XHRcdFx0d2l0aEFsdEdySXNEZWFkS2V5OiBmYWxzZSxcblx0XHRcdFx0d2l0aFNoaWZ0QWx0R3I6ICdcdTAwQzUnLFxuXHRcdFx0XHR3aXRoU2hpZnRBbHRHcklzRGVhZEtleTogZmFsc2Vcblx0XHRcdH1cblx0XHR9KSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdGFuY2UuaXNLZXlNYXBwaW5nQWN0aXZlKHtcblx0XHRcdEtleUE6IHtcblx0XHRcdFx0dmFsdWU6ICdhJyxcblx0XHRcdFx0dmFsdWVJc0RlYWRLZXk6IGZhbHNlLFxuXHRcdFx0XHR3aXRoU2hpZnQ6ICdBJyxcblx0XHRcdFx0d2l0aFNoaWZ0SXNEZWFkS2V5OiBmYWxzZSxcblx0XHRcdFx0d2l0aEFsdEdyOiAnXHUwMEU1Jyxcblx0XHRcdFx0d2l0aEFsdEdySXNEZWFkS2V5OiBmYWxzZSxcblx0XHRcdFx0d2l0aFNoaWZ0QWx0R3I6ICdcdTAwQzUnLFxuXHRcdFx0XHR3aXRoU2hpZnRBbHRHcklzRGVhZEtleTogZmFsc2Vcblx0XHRcdH0sXG5cdFx0XHRLZXlaOiB7XG5cdFx0XHRcdHZhbHVlOiAneicsXG5cdFx0XHRcdHZhbHVlSXNEZWFkS2V5OiBmYWxzZSxcblx0XHRcdFx0d2l0aFNoaWZ0OiAnWicsXG5cdFx0XHRcdHdpdGhTaGlmdElzRGVhZEtleTogZmFsc2UsXG5cdFx0XHRcdHdpdGhBbHRHcjogJ1x1MDNBOScsXG5cdFx0XHRcdHdpdGhBbHRHcklzRGVhZEtleTogZmFsc2UsXG5cdFx0XHRcdHdpdGhTaGlmdEFsdEdyOiAnXHUwMEI4Jyxcblx0XHRcdFx0d2l0aFNoaWZ0QWx0R3JJc0RlYWRLZXk6IGZhbHNlXG5cdFx0XHR9XG5cdFx0fSksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluc3RhbmNlLmlzS2V5TWFwcGluZ0FjdGl2ZSh7XG5cdFx0XHRLZXlaOiB7XG5cdFx0XHRcdHZhbHVlOiAneScsXG5cdFx0XHRcdHZhbHVlSXNEZWFkS2V5OiBmYWxzZSxcblx0XHRcdFx0d2l0aFNoaWZ0OiAnWScsXG5cdFx0XHRcdHdpdGhTaGlmdElzRGVhZEtleTogZmFsc2UsXG5cdFx0XHRcdHdpdGhBbHRHcjogJ1x1MDBBNScsXG5cdFx0XHRcdHdpdGhBbHRHcklzRGVhZEtleTogZmFsc2UsXG5cdFx0XHRcdHdpdGhTaGlmdEFsdEdyOiAnXHUwMTc4Jyxcblx0XHRcdFx0d2l0aFNoaWZ0QWx0R3JJc0RlYWRLZXk6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdH0pLCBmYWxzZSk7XG5cblx0fSk7XG5cblx0dGVzdCgnU3dpdGNoIGtleW1hcHBpbmcnLCAoKSA9PiB7XG5cdFx0aW5zdGFuY2Uuc2V0QWN0aXZlS2V5TWFwcGluZyh7XG5cdFx0XHRLZXlaOiB7XG5cdFx0XHRcdHZhbHVlOiAneScsXG5cdFx0XHRcdHZhbHVlSXNEZWFkS2V5OiBmYWxzZSxcblx0XHRcdFx0d2l0aFNoaWZ0OiAnWScsXG5cdFx0XHRcdHdpdGhTaGlmdElzRGVhZEtleTogZmFsc2UsXG5cdFx0XHRcdHdpdGhBbHRHcjogJ1x1MDBBNScsXG5cdFx0XHRcdHdpdGhBbHRHcklzRGVhZEtleTogZmFsc2UsXG5cdFx0XHRcdHdpdGhTaGlmdEFsdEdyOiAnXHUwMTc4Jyxcblx0XHRcdFx0d2l0aFNoaWZ0QWx0R3JJc0RlYWRLZXk6IGZhbHNlXG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCEhaW5zdGFuY2UuYWN0aXZlS2V5Ym9hcmRMYXlvdXQhLmlzVVNTdGFuZGFyZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnN0YW5jZS5pc0tleU1hcHBpbmdBY3RpdmUoe1xuXHRcdFx0S2V5Wjoge1xuXHRcdFx0XHR2YWx1ZTogJ3knLFxuXHRcdFx0XHR2YWx1ZUlzRGVhZEtleTogZmFsc2UsXG5cdFx0XHRcdHdpdGhTaGlmdDogJ1knLFxuXHRcdFx0XHR3aXRoU2hpZnRJc0RlYWRLZXk6IGZhbHNlLFxuXHRcdFx0XHR3aXRoQWx0R3I6ICdcdTAwQTUnLFxuXHRcdFx0XHR3aXRoQWx0R3JJc0RlYWRLZXk6IGZhbHNlLFxuXHRcdFx0XHR3aXRoU2hpZnRBbHRHcjogJ1x1MDE3OCcsXG5cdFx0XHRcdHdpdGhTaGlmdEFsdEdySXNEZWFkS2V5OiBmYWxzZVxuXHRcdFx0fSxcblx0XHR9KSwgdHJ1ZSk7XG5cblx0XHRpbnN0YW5jZS5zZXRVU0tleWJvYXJkTGF5b3V0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluc3RhbmNlLmFjdGl2ZUtleWJvYXJkTGF5b3V0IS5pc1VTU3RhbmRhcmQsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdTd2l0Y2gga2V5Ym9hcmQgbGF5b3V0IGluZm8nLCAoKSA9PiB7XG5cdFx0aW5zdGFuY2Uuc2V0S2V5Ym9hcmRMYXlvdXQoJ2NvbS5hcHBsZS5rZXlsYXlvdXQuR2VybWFuJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCEhaW5zdGFuY2UuYWN0aXZlS2V5Ym9hcmRMYXlvdXQhLmlzVVNTdGFuZGFyZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnN0YW5jZS5pc0tleU1hcHBpbmdBY3RpdmUoe1xuXHRcdFx0S2V5Wjoge1xuXHRcdFx0XHR2YWx1ZTogJ3knLFxuXHRcdFx0XHR2YWx1ZUlzRGVhZEtleTogZmFsc2UsXG5cdFx0XHRcdHdpdGhTaGlmdDogJ1knLFxuXHRcdFx0XHR3aXRoU2hpZnRJc0RlYWRLZXk6IGZhbHNlLFxuXHRcdFx0XHR3aXRoQWx0R3I6ICdcdTAwQTUnLFxuXHRcdFx0XHR3aXRoQWx0R3JJc0RlYWRLZXk6IGZhbHNlLFxuXHRcdFx0XHR3aXRoU2hpZnRBbHRHcjogJ1x1MDE3OCcsXG5cdFx0XHRcdHdpdGhTaGlmdEFsdEdySXNEZWFkS2V5OiBmYWxzZVxuXHRcdFx0fSxcblx0XHR9KSwgdHJ1ZSk7XG5cblx0XHRpbnN0YW5jZS5zZXRVU0tleWJvYXJkTGF5b3V0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluc3RhbmNlLmFjdGl2ZUtleWJvYXJkTGF5b3V0IS5pc1VTU3RhbmRhcmQsIHRydWUpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsT0FBTyxZQUFZO0FBQ25CLE9BQU87QUFDUCxPQUFPO0FBQ1AsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyxrQkFBK0I7QUFDeEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyx1QkFBdUI7QUFFaEMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUywrQ0FBK0M7QUFFeEQsTUFBTSxrQ0FBa0MsaUNBQWlDO0FBQUEsRUFDeEUsWUFBWSxzQkFBNkMscUJBQTJDLGdCQUFpQyxnQkFBaUM7QUFFckssVUFBTSxvQkFBb0I7QUFFMUIsVUFBTSxjQUE2QiwyQkFBMkIsU0FBUztBQUN2RSxTQUFLLGFBQWEsS0FBSyxHQUFHLFlBQVksSUFBSSxVQUFTLElBQUksV0FBVyxLQUFLLFFBQVEsS0FBSyxrQkFBa0IsS0FBSyxTQUFTLEtBQUssb0JB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
