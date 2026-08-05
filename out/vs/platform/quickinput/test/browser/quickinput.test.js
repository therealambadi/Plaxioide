import assert from "assert";
import { unthemedInboxStyles } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { unthemedButtonStyles } from "../../../../base/browser/ui/button/button.js";
import { unthemedListStyles } from "../../../../base/browser/ui/list/listWidget.js";
import { unthemedToggleStyles } from "../../../../base/browser/ui/toggle/toggle.js";
import { Event } from "../../../../base/common/event.js";
import { raceTimeout } from "../../../../base/common/async.js";
import { unthemedCountStyles } from "../../../../base/browser/ui/countBadge/countBadge.js";
import { unthemedKeybindingLabelOptions } from "../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { unthemedProgressBarOptions } from "../../../../base/browser/ui/progressbar/progressbar.js";
import { QuickInputController } from "../../browser/quickInputController.js";
import { TestThemeService } from "../../../theme/test/common/testThemeService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { ItemActivation } from "../../common/quickInput.js";
import { TestInstantiationService } from "../../../instantiation/test/common/instantiationServiceMock.js";
import { IThemeService } from "../../../theme/common/themeService.js";
import { IConfigurationService } from "../../../configuration/common/configuration.js";
import { TestConfigurationService } from "../../../configuration/test/common/testConfigurationService.js";
import { ILayoutService } from "../../../layout/browser/layoutService.js";
import { IContextViewService } from "../../../contextview/browser/contextView.js";
import { IListService, ListService } from "../../../list/browser/listService.js";
import { IContextKeyService } from "../../../contextkey/common/contextkey.js";
import { ContextKeyService } from "../../../contextkey/browser/contextKeyService.js";
import { NoMatchingKb } from "../../../keybinding/common/keybindingResolver.js";
import { IKeybindingService } from "../../../keybinding/common/keybinding.js";
import { ContextViewService } from "../../../contextview/browser/contextViewService.js";
import { IAccessibilityService } from "../../../accessibility/common/accessibility.js";
import { TestAccessibilityService } from "../../../accessibility/test/common/testAccessibilityService.js";
async function setupWaitTilShownListener(controller) {
  const result = await raceTimeout(new Promise((resolve) => {
    const event = controller.onShow((_) => {
      event.dispose();
      resolve(true);
    });
  }), 2e3);
  if (!result) {
    throw new Error("Cancelled");
  }
}
suite("QuickInput", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let controller;
  setup(() => {
    const fixture = document.createElement("div");
    mainWindow.document.body.appendChild(fixture);
    store.add(toDisposable(() => fixture.remove()));
    const instantiationService = new TestInstantiationService();
    instantiationService.stub(IThemeService, new TestThemeService());
    instantiationService.stub(IConfigurationService, new TestConfigurationService());
    instantiationService.stub(IAccessibilityService, new TestAccessibilityService());
    instantiationService.stub(IListService, store.add(new ListService()));
    instantiationService.stub(ILayoutService, { activeContainer: fixture, onDidLayoutContainer: Event.None });
    instantiationService.stub(IContextViewService, store.add(instantiationService.createInstance(ContextViewService)));
    instantiationService.stub(IContextKeyService, store.add(instantiationService.createInstance(ContextKeyService)));
    instantiationService.stub(IKeybindingService, {
      mightProducePrintableCharacter() {
        return false;
      },
      softDispatch() {
        return NoMatchingKb;
      }
    });
    controller = store.add(instantiationService.createInstance(
      QuickInputController,
      {
        container: fixture,
        idPrefix: "testQuickInput",
        ignoreFocusOut() {
          return true;
        },
        returnFocus() {
        },
        backKeybindingLabel() {
          return void 0;
        },
        setContextKey() {
          return void 0;
        },
        linkOpenerDelegate(content) {
        },
        hoverDelegate: {
          showHover(options, focus) {
            return void 0;
          },
          delay: 200
        },
        styles: {
          button: unthemedButtonStyles,
          countBadge: unthemedCountStyles,
          inputBox: unthemedInboxStyles,
          toggle: unthemedToggleStyles,
          keybindingLabel: unthemedKeybindingLabelOptions,
          list: unthemedListStyles,
          progressBar: unthemedProgressBarOptions,
          widget: {
            quickInputBackground: void 0,
            quickInputForeground: void 0,
            quickInputTitleBackground: void 0,
            widgetBorder: void 0,
            widgetShadow: void 0
          },
          pickerGroup: {
            pickerGroupBorder: void 0,
            pickerGroupForeground: void 0
          }
        }
      }
    ));
    controller.layout({ height: 20, width: 40 }, 0);
  });
  test("pick - basecase", async () => {
    const item = { label: "foo" };
    const wait = setupWaitTilShownListener(controller);
    const pickPromise = controller.pick([item, { label: "bar" }]);
    await wait;
    controller.accept();
    const pick = await raceTimeout(pickPromise, 2e3);
    assert.strictEqual(pick, item);
  });
  test("pick - activeItem is honored", async () => {
    const item = { label: "foo" };
    const wait = setupWaitTilShownListener(controller);
    const pickPromise = controller.pick([{ label: "bar" }, item], { activeItem: item });
    await wait;
    controller.accept();
    const pick = await pickPromise;
    assert.strictEqual(pick, item);
  });
  test("input - basecase", async () => {
    const wait = setupWaitTilShownListener(controller);
    const inputPromise = controller.input({ value: "foo" });
    await wait;
    controller.accept();
    const value = await raceTimeout(inputPromise, 2e3);
    assert.strictEqual(value, "foo");
  });
  test("onDidChangeValue - gets triggered when .value is set", async () => {
    const quickpick = store.add(controller.createQuickPick());
    let value = void 0;
    store.add(quickpick.onDidChangeValue((e) => value = e));
    quickpick.value = "changed";
    try {
      assert.strictEqual(value, quickpick.value);
    } finally {
      quickpick.dispose();
    }
  });
  test("keepScrollPosition - works with activeItems", async () => {
    const quickpick = store.add(controller.createQuickPick());
    const items = [];
    for (let i = 0; i < 1e3; i++) {
      items.push({ label: `item ${i}` });
    }
    quickpick.items = items;
    quickpick.activeItems = [items[items.length - 1]];
    quickpick.show();
    const cursorTop = quickpick.scrollTop;
    assert.notStrictEqual(cursorTop, 0);
    quickpick.keepScrollPosition = true;
    quickpick.activeItems = [items[0]];
    assert.strictEqual(cursorTop, quickpick.scrollTop);
    quickpick.keepScrollPosition = false;
    quickpick.activeItems = [items[0]];
    assert.strictEqual(quickpick.scrollTop, 0);
  });
  test("keepScrollPosition - works with items", async () => {
    const quickpick = store.add(controller.createQuickPick());
    const items = [];
    for (let i = 0; i < 1e3; i++) {
      items.push({ label: `item ${i}` });
    }
    quickpick.items = items;
    quickpick.activeItems = [items[items.length - 1]];
    quickpick.show();
    const cursorTop = quickpick.scrollTop;
    assert.notStrictEqual(cursorTop, 0);
    quickpick.keepScrollPosition = true;
    quickpick.items = items;
    assert.strictEqual(cursorTop, quickpick.scrollTop);
    quickpick.keepScrollPosition = false;
    quickpick.items = items;
    assert.strictEqual(quickpick.scrollTop, 0);
  });
  test("selectedItems - verify previous selectedItems does not hang over to next set of items", async () => {
    const quickpick = store.add(controller.createQuickPick());
    quickpick.items = [{ label: "step 1" }];
    quickpick.show();
    void await new Promise((resolve) => {
      store.add(quickpick.onDidAccept(() => {
        quickpick.canSelectMany = true;
        quickpick.items = [{ label: "a" }, { label: "b" }, { label: "c" }];
        resolve();
      }));
      controller.accept();
    });
    controller.accept();
    assert.strictEqual(quickpick.selectedItems.length, 0);
  });
  test("activeItems - verify onDidChangeActive is triggered after setting items", async () => {
    const quickpick = store.add(controller.createQuickPick());
    const activeItemsFromEvent = [];
    store.add(quickpick.onDidChangeActive((items) => activeItemsFromEvent.push(...items)));
    quickpick.show();
    const item = { label: "step 1" };
    quickpick.items = [item];
    assert.strictEqual(activeItemsFromEvent.length, 1);
    assert.strictEqual(activeItemsFromEvent[0], item);
    assert.strictEqual(quickpick.activeItems.length, 1);
    assert.strictEqual(quickpick.activeItems[0], item);
  });
  test("activeItems - verify setting itemActivation to None still triggers onDidChangeActive after selection #207832", async () => {
    const quickpick = store.add(controller.createQuickPick());
    const item = { label: "step 1" };
    quickpick.items = [item];
    quickpick.show();
    assert.strictEqual(quickpick.activeItems[0], item);
    const activeItemsFromEvent = [];
    store.add(quickpick.onDidChangeActive((items) => activeItemsFromEvent.push(...items)));
    quickpick.itemActivation = ItemActivation.NONE;
    quickpick.items = [item];
    assert.strictEqual(activeItemsFromEvent.length, 0);
    assert.strictEqual(quickpick.activeItems.length, 0);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9xdWlja2lucHV0L3Rlc3QvYnJvd3Nlci9xdWlja2lucHV0LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyB1bnRoZW1lZEluYm94U3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2lucHV0Ym94L2lucHV0Qm94LmpzJztcbmltcG9ydCB7IHVudGhlbWVkQnV0dG9uU3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2J1dHRvbi9idXR0b24uanMnO1xuaW1wb3J0IHsgdW50aGVtZWRMaXN0U3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFdpZGdldC5qcyc7XG5pbXBvcnQgeyB1bnRoZW1lZFRvZ2dsZVN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90b2dnbGUvdG9nZ2xlLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgcmFjZVRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyB1bnRoZW1lZENvdW50U3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2NvdW50QmFkZ2UvY291bnRCYWRnZS5qcyc7XG5pbXBvcnQgeyB1bnRoZW1lZEtleWJpbmRpbmdMYWJlbE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkva2V5YmluZGluZ0xhYmVsL2tleWJpbmRpbmdMYWJlbC5qcyc7XG5pbXBvcnQgeyB1bnRoZW1lZFByb2dyZXNzQmFyT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9wcm9ncmVzc2Jhci9wcm9ncmVzc2Jhci5qcyc7XG5pbXBvcnQgeyBRdWlja0lucHV0Q29udHJvbGxlciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvcXVpY2tJbnB1dENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgVGVzdFRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3RoZW1lL3Rlc3QvY29tbW9uL3Rlc3RUaGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuaW1wb3J0IHsgUXVpY2tQaWNrIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElRdWlja1BpY2tJdGVtLCBJdGVtQWN0aXZhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElMaXN0U2VydmljZSwgTGlzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbnRleHRrZXkvYnJvd3Nlci9jb250ZXh0S2V5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBOb01hdGNoaW5nS2IgfSBmcm9tICcuLi8uLi8uLi9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IFRlc3RBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2FjY2Vzc2liaWxpdHkvdGVzdC9jb21tb24vdGVzdEFjY2Vzc2liaWxpdHlTZXJ2aWNlLmpzJztcblxuLy8gU2V0cyB1cCBhbiBgb25TaG93YCBsaXN0ZW5lciB0byBhbGxvdyB1cyB0byB3YWl0IHVudGlsIHRoZSBxdWljayBwaWNrIGlzIHNob3duICh1c2VmdWwgd2hlbiB0cmlnZ2VyaW5nIGFuIGBhY2NlcHQoKWAgcmlnaHQgYWZ0ZXIgbGF1bmNoaW5nIGEgcXVpY2sgcGljaylcbi8vIGtpY2sgdGhpcyBvZmYgYmVmb3JlIHlvdSBsYXVuY2ggdGhlIHBpY2tlciBhbmQgdGhlbiBhd2FpdCB0aGUgcHJvbWlzZSByZXR1cm5lZCBhZnRlciB5b3UgbGF1bmNoIHRoZSBwaWNrZXIuXG5hc3luYyBmdW5jdGlvbiBzZXR1cFdhaXRUaWxTaG93bkxpc3RlbmVyKGNvbnRyb2xsZXI6IFF1aWNrSW5wdXRDb250cm9sbGVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJhY2VUaW1lb3V0KG5ldyBQcm9taXNlPGJvb2xlYW4+KHJlc29sdmUgPT4ge1xuXHRcdGNvbnN0IGV2ZW50ID0gY29udHJvbGxlci5vblNob3coXyA9PiB7XG5cdFx0XHRldmVudC5kaXNwb3NlKCk7XG5cdFx0XHRyZXNvbHZlKHRydWUpO1xuXHRcdH0pO1xuXHR9KSwgMjAwMCk7XG5cblx0aWYgKCFyZXN1bHQpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NhbmNlbGxlZCcpO1xuXHR9XG59XG5cbnN1aXRlKCdRdWlja0lucHV0JywgKCkgPT4geyAvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTQ3NTQzXG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cdGxldCBjb250cm9sbGVyOiBRdWlja0lucHV0Q29udHJvbGxlcjtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdG1haW5XaW5kb3cuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChmaXh0dXJlKTtcblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGZpeHR1cmUucmVtb3ZlKCkpKTtcblxuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSgpO1xuXG5cdFx0Ly8gU3R1YiB0aGUgc2VydmljZXMgdGhlIHF1aWNrIGlucHV0IGNvbnRyb2xsZXIgbmVlZHMgdG8gZnVuY3Rpb25cblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUaGVtZVNlcnZpY2UsIG5ldyBUZXN0VGhlbWVTZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUFjY2Vzc2liaWxpdHlTZXJ2aWNlLCBuZXcgVGVzdEFjY2Vzc2liaWxpdHlTZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxpc3RTZXJ2aWNlLCBzdG9yZS5hZGQobmV3IExpc3RTZXJ2aWNlKCkpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElMYXlvdXRTZXJ2aWNlLCB7IGFjdGl2ZUNvbnRhaW5lcjogZml4dHVyZSwgb25EaWRMYXlvdXRDb250YWluZXI6IEV2ZW50Lk5vbmUgfSBhcyBhbnkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnRleHRWaWV3U2VydmljZSwgc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnRleHRWaWV3U2VydmljZSkpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb250ZXh0S2V5U2VydmljZSwgc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnRleHRLZXlTZXJ2aWNlKSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUtleWJpbmRpbmdTZXJ2aWNlLCB7XG5cdFx0XHRtaWdodFByb2R1Y2VQcmludGFibGVDaGFyYWN0ZXIoKSB7IHJldHVybiBmYWxzZTsgfSxcblx0XHRcdHNvZnREaXNwYXRjaCgpIHsgcmV0dXJuIE5vTWF0Y2hpbmdLYjsgfSxcblx0XHR9KTtcblxuXHRcdGNvbnRyb2xsZXIgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRRdWlja0lucHV0Q29udHJvbGxlcixcblx0XHRcdHtcblx0XHRcdFx0Y29udGFpbmVyOiBmaXh0dXJlLFxuXHRcdFx0XHRpZFByZWZpeDogJ3Rlc3RRdWlja0lucHV0Jyxcblx0XHRcdFx0aWdub3JlRm9jdXNPdXQoKSB7IHJldHVybiB0cnVlOyB9LFxuXHRcdFx0XHRyZXR1cm5Gb2N1cygpIHsgfSxcblx0XHRcdFx0YmFja0tleWJpbmRpbmdMYWJlbCgpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfSxcblx0XHRcdFx0c2V0Q29udGV4dEtleSgpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfSxcblx0XHRcdFx0bGlua09wZW5lckRlbGVnYXRlKGNvbnRlbnQpIHsgfSxcblx0XHRcdFx0aG92ZXJEZWxlZ2F0ZToge1xuXHRcdFx0XHRcdHNob3dIb3ZlcihvcHRpb25zLCBmb2N1cykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGRlbGF5OiAyMDBcblx0XHRcdFx0fSxcblx0XHRcdFx0c3R5bGVzOiB7XG5cdFx0XHRcdFx0YnV0dG9uOiB1bnRoZW1lZEJ1dHRvblN0eWxlcyxcblx0XHRcdFx0XHRjb3VudEJhZGdlOiB1bnRoZW1lZENvdW50U3R5bGVzLFxuXHRcdFx0XHRcdGlucHV0Qm94OiB1bnRoZW1lZEluYm94U3R5bGVzLFxuXHRcdFx0XHRcdHRvZ2dsZTogdW50aGVtZWRUb2dnbGVTdHlsZXMsXG5cdFx0XHRcdFx0a2V5YmluZGluZ0xhYmVsOiB1bnRoZW1lZEtleWJpbmRpbmdMYWJlbE9wdGlvbnMsXG5cdFx0XHRcdFx0bGlzdDogdW50aGVtZWRMaXN0U3R5bGVzLFxuXHRcdFx0XHRcdHByb2dyZXNzQmFyOiB1bnRoZW1lZFByb2dyZXNzQmFyT3B0aW9ucyxcblx0XHRcdFx0XHR3aWRnZXQ6IHtcblx0XHRcdFx0XHRcdHF1aWNrSW5wdXRCYWNrZ3JvdW5kOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRxdWlja0lucHV0Rm9yZWdyb3VuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0cXVpY2tJbnB1dFRpdGxlQmFja2dyb3VuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0d2lkZ2V0Qm9yZGVyOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHR3aWRnZXRTaGFkb3c6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHBpY2tlckdyb3VwOiB7XG5cdFx0XHRcdFx0XHRwaWNrZXJHcm91cEJvcmRlcjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0cGlja2VyR3JvdXBGb3JlZ3JvdW5kOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KSk7XG5cblx0XHQvLyBpbml0aWFsIGxheW91dFxuXHRcdGNvbnRyb2xsZXIubGF5b3V0KHsgaGVpZ2h0OiAyMCwgd2lkdGg6IDQwIH0sIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdwaWNrIC0gYmFzZWNhc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaXRlbSA9IHsgbGFiZWw6ICdmb28nIH07XG5cblx0XHRjb25zdCB3YWl0ID0gc2V0dXBXYWl0VGlsU2hvd25MaXN0ZW5lcihjb250cm9sbGVyKTtcblx0XHRjb25zdCBwaWNrUHJvbWlzZSA9IGNvbnRyb2xsZXIucGljayhbaXRlbSwgeyBsYWJlbDogJ2JhcicgfV0pO1xuXHRcdGF3YWl0IHdhaXQ7XG5cblx0XHRjb250cm9sbGVyLmFjY2VwdCgpO1xuXHRcdGNvbnN0IHBpY2sgPSBhd2FpdCByYWNlVGltZW91dChwaWNrUHJvbWlzZSwgMjAwMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGljaywgaXRlbSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BpY2sgLSBhY3RpdmVJdGVtIGlzIGhvbm9yZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaXRlbSA9IHsgbGFiZWw6ICdmb28nIH07XG5cblx0XHRjb25zdCB3YWl0ID0gc2V0dXBXYWl0VGlsU2hvd25MaXN0ZW5lcihjb250cm9sbGVyKTtcblx0XHRjb25zdCBwaWNrUHJvbWlzZSA9IGNvbnRyb2xsZXIucGljayhbeyBsYWJlbDogJ2JhcicgfSwgaXRlbV0sIHsgYWN0aXZlSXRlbTogaXRlbSB9KTtcblx0XHRhd2FpdCB3YWl0O1xuXG5cdFx0Y29udHJvbGxlci5hY2NlcHQoKTtcblx0XHRjb25zdCBwaWNrID0gYXdhaXQgcGlja1Byb21pc2U7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGljaywgaXRlbSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lucHV0IC0gYmFzZWNhc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgd2FpdCA9IHNldHVwV2FpdFRpbFNob3duTGlzdGVuZXIoY29udHJvbGxlcik7XG5cdFx0Y29uc3QgaW5wdXRQcm9taXNlID0gY29udHJvbGxlci5pbnB1dCh7IHZhbHVlOiAnZm9vJyB9KTtcblx0XHRhd2FpdCB3YWl0O1xuXG5cdFx0Y29udHJvbGxlci5hY2NlcHQoKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHJhY2VUaW1lb3V0KGlucHV0UHJvbWlzZSwgMjAwMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUsICdmb28nKTtcblx0fSk7XG5cblx0dGVzdCgnb25EaWRDaGFuZ2VWYWx1ZSAtIGdldHMgdHJpZ2dlcmVkIHdoZW4gLnZhbHVlIGlzIHNldCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBxdWlja3BpY2sgPSBzdG9yZS5hZGQoY29udHJvbGxlci5jcmVhdGVRdWlja1BpY2soKSk7XG5cblx0XHRsZXQgdmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRzdG9yZS5hZGQocXVpY2twaWNrLm9uRGlkQ2hhbmdlVmFsdWUoKGUpID0+IHZhbHVlID0gZSkpO1xuXG5cdFx0Ly8gVHJpZ2dlciBhIGNoYW5nZVxuXHRcdHF1aWNrcGljay52YWx1ZSA9ICdjaGFuZ2VkJztcblxuXHRcdHRyeSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUsIHF1aWNrcGljay52YWx1ZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHF1aWNrcGljay5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdrZWVwU2Nyb2xsUG9zaXRpb24gLSB3b3JrcyB3aXRoIGFjdGl2ZUl0ZW1zJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHF1aWNrcGljayA9IHN0b3JlLmFkZChjb250cm9sbGVyLmNyZWF0ZVF1aWNrUGljaygpIGFzIFF1aWNrUGljazxJUXVpY2tQaWNrSXRlbT4pO1xuXG5cdFx0Y29uc3QgaXRlbXMgPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDEwMDA7IGkrKykge1xuXHRcdFx0aXRlbXMucHVzaCh7IGxhYmVsOiBgaXRlbSAke2l9YCB9KTtcblx0XHR9XG5cdFx0cXVpY2twaWNrLml0ZW1zID0gaXRlbXM7XG5cdFx0Ly8gc2V0dGluZyB0aGUgYWN0aXZlIGl0ZW0gc2hvdWxkIGNhdXNlIHRoZSBxdWljayBwaWNrIHRvIHNjcm9sbCB0byB0aGUgYm90dG9tXG5cdFx0cXVpY2twaWNrLmFjdGl2ZUl0ZW1zID0gW2l0ZW1zW2l0ZW1zLmxlbmd0aCAtIDFdXTtcblx0XHRxdWlja3BpY2suc2hvdygpO1xuXG5cdFx0Y29uc3QgY3Vyc29yVG9wID0gcXVpY2twaWNrLnNjcm9sbFRvcDtcblxuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChjdXJzb3JUb3AsIDApO1xuXG5cdFx0cXVpY2twaWNrLmtlZXBTY3JvbGxQb3NpdGlvbiA9IHRydWU7XG5cdFx0cXVpY2twaWNrLmFjdGl2ZUl0ZW1zID0gW2l0ZW1zWzBdXTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3Vyc29yVG9wLCBxdWlja3BpY2suc2Nyb2xsVG9wKTtcblxuXHRcdHF1aWNrcGljay5rZWVwU2Nyb2xsUG9zaXRpb24gPSBmYWxzZTtcblx0XHRxdWlja3BpY2suYWN0aXZlSXRlbXMgPSBbaXRlbXNbMF1dO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWlja3BpY2suc2Nyb2xsVG9wLCAwKTtcblx0fSk7XG5cblx0dGVzdCgna2VlcFNjcm9sbFBvc2l0aW9uIC0gd29ya3Mgd2l0aCBpdGVtcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBxdWlja3BpY2sgPSBzdG9yZS5hZGQoY29udHJvbGxlci5jcmVhdGVRdWlja1BpY2soKSBhcyBRdWlja1BpY2s8SVF1aWNrUGlja0l0ZW0+KTtcblxuXHRcdGNvbnN0IGl0ZW1zID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxMDAwOyBpKyspIHtcblx0XHRcdGl0ZW1zLnB1c2goeyBsYWJlbDogYGl0ZW0gJHtpfWAgfSk7XG5cdFx0fVxuXHRcdHF1aWNrcGljay5pdGVtcyA9IGl0ZW1zO1xuXHRcdC8vIHNldHRpbmcgdGhlIGFjdGl2ZSBpdGVtIHNob3VsZCBjYXVzZSB0aGUgcXVpY2sgcGljayB0byBzY3JvbGwgdG8gdGhlIGJvdHRvbVxuXHRcdHF1aWNrcGljay5hY3RpdmVJdGVtcyA9IFtpdGVtc1tpdGVtcy5sZW5ndGggLSAxXV07XG5cdFx0cXVpY2twaWNrLnNob3coKTtcblxuXHRcdGNvbnN0IGN1cnNvclRvcCA9IHF1aWNrcGljay5zY3JvbGxUb3A7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGN1cnNvclRvcCwgMCk7XG5cblx0XHRxdWlja3BpY2sua2VlcFNjcm9sbFBvc2l0aW9uID0gdHJ1ZTtcblx0XHRxdWlja3BpY2suaXRlbXMgPSBpdGVtcztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3Vyc29yVG9wLCBxdWlja3BpY2suc2Nyb2xsVG9wKTtcblxuXHRcdHF1aWNrcGljay5rZWVwU2Nyb2xsUG9zaXRpb24gPSBmYWxzZTtcblx0XHRxdWlja3BpY2suaXRlbXMgPSBpdGVtcztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVpY2twaWNrLnNjcm9sbFRvcCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NlbGVjdGVkSXRlbXMgLSB2ZXJpZnkgcHJldmlvdXMgc2VsZWN0ZWRJdGVtcyBkb2VzIG5vdCBoYW5nIG92ZXIgdG8gbmV4dCBzZXQgb2YgaXRlbXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcXVpY2twaWNrID0gc3RvcmUuYWRkKGNvbnRyb2xsZXIuY3JlYXRlUXVpY2tQaWNrKCkpO1xuXHRcdHF1aWNrcGljay5pdGVtcyA9IFt7IGxhYmVsOiAnc3RlcCAxJyB9XTtcblx0XHRxdWlja3BpY2suc2hvdygpO1xuXG5cdFx0dm9pZCAoYXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRzdG9yZS5hZGQocXVpY2twaWNrLm9uRGlkQWNjZXB0KCgpID0+IHtcblx0XHRcdFx0cXVpY2twaWNrLmNhblNlbGVjdE1hbnkgPSB0cnVlO1xuXHRcdFx0XHRxdWlja3BpY2suaXRlbXMgPSBbeyBsYWJlbDogJ2EnIH0sIHsgbGFiZWw6ICdiJyB9LCB7IGxhYmVsOiAnYycgfV07XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0Ly8gYWNjZXB0ICdzdGVwIDEnXG5cdFx0XHRjb250cm9sbGVyLmFjY2VwdCgpO1xuXHRcdH0pKTtcblxuXHRcdC8vIGFjY2VwdCBpbiBtdWx0aS1zZWxlY3Rcblx0XHRjb250cm9sbGVyLmFjY2VwdCgpO1xuXG5cdFx0Ly8gU2luY2Ugd2UgZG9uJ3Qgc2VsZWN0IGFueSBpdGVtcywgdGhlIHNlbGVjdGVkIGl0ZW1zIHNob3VsZCBiZSBlbXB0eVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWlja3BpY2suc2VsZWN0ZWRJdGVtcy5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdhY3RpdmVJdGVtcyAtIHZlcmlmeSBvbkRpZENoYW5nZUFjdGl2ZSBpcyB0cmlnZ2VyZWQgYWZ0ZXIgc2V0dGluZyBpdGVtcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBxdWlja3BpY2sgPSBzdG9yZS5hZGQoY29udHJvbGxlci5jcmVhdGVRdWlja1BpY2soKSk7XG5cblx0XHQvLyBTZXR1cCBsaXN0ZW5lciBmb3IgdmVyaWZpY2F0aW9uXG5cdFx0Y29uc3QgYWN0aXZlSXRlbXNGcm9tRXZlbnQ6IElRdWlja1BpY2tJdGVtW10gPSBbXTtcblx0XHRzdG9yZS5hZGQocXVpY2twaWNrLm9uRGlkQ2hhbmdlQWN0aXZlKGl0ZW1zID0+IGFjdGl2ZUl0ZW1zRnJvbUV2ZW50LnB1c2goLi4uaXRlbXMpKSk7XG5cblx0XHRxdWlja3BpY2suc2hvdygpO1xuXG5cdFx0Y29uc3QgaXRlbSA9IHsgbGFiZWw6ICdzdGVwIDEnIH07XG5cdFx0cXVpY2twaWNrLml0ZW1zID0gW2l0ZW1dO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGl2ZUl0ZW1zRnJvbUV2ZW50Lmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGl2ZUl0ZW1zRnJvbUV2ZW50WzBdLCBpdGVtKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVpY2twaWNrLmFjdGl2ZUl0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1aWNrcGljay5hY3RpdmVJdGVtc1swXSwgaXRlbSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FjdGl2ZUl0ZW1zIC0gdmVyaWZ5IHNldHRpbmcgaXRlbUFjdGl2YXRpb24gdG8gTm9uZSBzdGlsbCB0cmlnZ2VycyBvbkRpZENoYW5nZUFjdGl2ZSBhZnRlciBzZWxlY3Rpb24gIzIwNzgzMicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBxdWlja3BpY2sgPSBzdG9yZS5hZGQoY29udHJvbGxlci5jcmVhdGVRdWlja1BpY2soKSk7XG5cdFx0Y29uc3QgaXRlbSA9IHsgbGFiZWw6ICdzdGVwIDEnIH07XG5cdFx0cXVpY2twaWNrLml0ZW1zID0gW2l0ZW1dO1xuXHRcdHF1aWNrcGljay5zaG93KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1aWNrcGljay5hY3RpdmVJdGVtc1swXSwgaXRlbSk7XG5cblx0XHQvLyBTZXR1cCBsaXN0ZW5lciBmb3IgdmVyaWZpY2F0aW9uXG5cdFx0Y29uc3QgYWN0aXZlSXRlbXNGcm9tRXZlbnQ6IElRdWlja1BpY2tJdGVtW10gPSBbXTtcblx0XHRzdG9yZS5hZGQocXVpY2twaWNrLm9uRGlkQ2hhbmdlQWN0aXZlKGl0ZW1zID0+IGFjdGl2ZUl0ZW1zRnJvbUV2ZW50LnB1c2goLi4uaXRlbXMpKSk7XG5cblx0XHQvLyBUcmlnZ2VyIGEgY2hhbmdlXG5cdFx0cXVpY2twaWNrLml0ZW1BY3RpdmF0aW9uID0gSXRlbUFjdGl2YXRpb24uTk9ORTtcblx0XHRxdWlja3BpY2suaXRlbXMgPSBbaXRlbV07XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aXZlSXRlbXNGcm9tRXZlbnQubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVpY2twaWNrLmFjdGl2ZUl0ZW1zLmxlbmd0aCwgMCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsa0JBQWtCO0FBRTNCLFNBQXlCLHNCQUFzQjtBQUMvQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGNBQWMsbUJBQW1CO0FBQzFDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0NBQWdDO0FBSXpDLGVBQWUsMEJBQTBCLFlBQWlEO0FBQ3pGLFFBQU0sU0FBUyxNQUFNLFlBQVksSUFBSSxRQUFpQixhQUFXO0FBQ2hFLFVBQU0sUUFBUSxXQUFXLE9BQU8sT0FBSztBQUNwQyxZQUFNLFFBQVE7QUFDZCxjQUFRLElBQUk7QUFBQSxJQUNiLENBQUM7QUFBQSxFQUNGLENBQUMsR0FBRyxHQUFJO0FBRVIsTUFBSSxDQUFDLFFBQVE7QUFDWixVQUFNLElBQUksTUFBTSxXQUFXO0FBQUEsRUFDNUI7QUFDRDtBQUVBLE1BQU0sY0FBYyxNQUFNO0FBQ3pCLFFBQU0sUUFBUSx3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
