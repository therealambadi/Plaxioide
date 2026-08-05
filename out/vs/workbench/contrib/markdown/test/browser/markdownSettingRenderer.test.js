import assert from "assert";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ConfigurationScope, Extensions } from "../../../../../platform/configuration/common/configurationRegistry.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { SimpleSettingRenderer } from "../../browser/markdownSettingRenderer.js";
const configuration = {
  "id": "examples",
  "title": "Examples",
  "type": "object",
  "properties": {
    "example.booleanSetting": {
      "type": "boolean",
      "default": false,
      "scope": ConfigurationScope.APPLICATION
    },
    "example.booleanSetting2": {
      "type": "boolean",
      "default": true,
      "scope": ConfigurationScope.APPLICATION
    },
    "example.stringSetting": {
      "type": "string",
      "default": "one",
      "scope": ConfigurationScope.APPLICATION
    },
    "example.numberSetting": {
      "type": "number",
      "default": 3,
      "scope": ConfigurationScope.APPLICATION
    }
  }
};
class MarkdownConfigurationService extends TestConfigurationService {
  async updateValue(key, value) {
    const [section, setting] = key.split(".");
    return this.setUserConfiguration(section, { [setting]: value });
  }
}
suite("Markdown Setting Renderer Test", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let configurationService;
  let preferencesService;
  let contextMenuService;
  let settingRenderer;
  suiteSetup(() => {
    configurationService = new MarkdownConfigurationService();
    preferencesService = {
      getSetting: (setting) => {
        let type = "boolean";
        if (setting.includes("string")) {
          type = "string";
        }
        return { type, key: setting };
      }
    };
    contextMenuService = {};
    Registry.as(Extensions.Configuration).registerConfiguration(configuration);
    settingRenderer = new SimpleSettingRenderer(configurationService, contextMenuService, preferencesService, { publicLog2: () => {
    } }, { writeText: async () => {
    } });
  });
  suiteTeardown(() => {
    Registry.as(Extensions.Configuration).deregisterConfigurations([configuration]);
  });
  test("render code setting button with value", () => {
    const htmlRenderer = settingRenderer.getHtmlRenderer();
    const htmlNoValue = '<a href="code-oss://settings/example.booleanSetting" codesetting="true">';
    const renderedHtmlNoValue = htmlRenderer({ block: false, raw: htmlNoValue, pre: false, text: "", type: "html" });
    assert.strictEqual(
      renderedHtmlNoValue,
      `<code tabindex="0"><a href="code-setting://example.booleanSetting/true" class="codesetting" title="View or change setting" aria-role="button"><svg width="14" height="14" viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.8-1.3 2 .8.8 2-1.3.8.3.4 2.3h1.2l.5-2.4.8-.3 2 1.3.8-.8-1.3-2 .3-.8 2.3-.4V7.4l-2.4-.5-.3-.8 1.3-2-.8-.8-2 1.3-.7-.2zM9.4 1l.5 2.4L12 2.1l2 2-1.4 2.1 2.4.4v2.8l-2.4.5L14 12l-2 2-2.1-1.4-.5 2.4H6.6l-.5-2.4L4 13.9l-2-2 1.4-2.1L1 9.4V6.6l2.4-.5L2.1 4l2-2 2.1 1.4.4-2.4h2.8zm.6 7c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM8 9c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1z"/></svg>
			<span class="separator"></span>
			<span class="setting-name">example.booleanSetting</span>
		</a></code>`
    );
  });
  test("actions with no value", () => {
    const uri = URI.parse(settingRenderer.settingToUriString("example.booleanSetting"));
    const actions = settingRenderer.getActions(uri);
    assert.strictEqual(actions?.length, 2);
    assert.strictEqual(actions[0].label, 'View "Example: Boolean Setting" in Settings');
  });
  test("actions with value + updating and restoring", async () => {
    await configurationService.setUserConfiguration("example", { stringSetting: "two" });
    const uri = URI.parse(settingRenderer.settingToUriString("example.stringSetting", "three"));
    const verifyOriginalState = (actions2) => {
      assert.strictEqual(actions2?.length, 3);
      assert.strictEqual(actions2[0].label, 'Set "Example: String Setting" to "three"');
      assert.strictEqual(actions2[1].label, "View in Settings");
      assert.strictEqual(configurationService.getValue("example.stringSetting"), "two");
      return true;
    };
    const actions = settingRenderer.getActions(uri);
    if (verifyOriginalState(actions)) {
      await actions[0].run();
      assert.strictEqual(configurationService.getValue("example.stringSetting"), "three");
      const actionsUpdated = settingRenderer.getActions(uri);
      assert.strictEqual(actionsUpdated?.length, 3);
      assert.strictEqual(actionsUpdated[0].label, 'Restore value of "Example: String Setting"');
      assert.strictEqual(actions[1].label, "View in Settings");
      assert.strictEqual(actions[2].label, "Copy Setting ID");
      assert.strictEqual(configurationService.getValue("example.stringSetting"), "three");
      await actionsUpdated[0].run();
      verifyOriginalState(settingRenderer.getActions(uri));
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tYXJrZG93bi90ZXN0L2Jyb3dzZXIvbWFya2Rvd25TZXR0aW5nUmVuZGVyZXIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uU2NvcGUsIEV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uTm9kZSwgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBTaW1wbGVTZXR0aW5nUmVuZGVyZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL21hcmtkb3duU2V0dGluZ1JlbmRlcmVyLmpzJztcbmltcG9ydCB7IElQcmVmZXJlbmNlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuXG5jb25zdCBjb25maWd1cmF0aW9uOiBJQ29uZmlndXJhdGlvbk5vZGUgPSB7XG5cdCdpZCc6ICdleGFtcGxlcycsXG5cdCd0aXRsZSc6ICdFeGFtcGxlcycsXG5cdCd0eXBlJzogJ29iamVjdCcsXG5cdCdwcm9wZXJ0aWVzJzoge1xuXHRcdCdleGFtcGxlLmJvb2xlYW5TZXR0aW5nJzoge1xuXHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHQnZGVmYXVsdCc6IGZhbHNlLFxuXHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OXG5cdFx0fSxcblx0XHQnZXhhbXBsZS5ib29sZWFuU2V0dGluZzInOiB7XG5cdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdCdkZWZhdWx0JzogdHJ1ZSxcblx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTlxuXHRcdH0sXG5cdFx0J2V4YW1wbGUuc3RyaW5nU2V0dGluZyc6IHtcblx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHQnZGVmYXVsdCc6ICdvbmUnLFxuXHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OXG5cdFx0fSxcblx0XHQnZXhhbXBsZS5udW1iZXJTZXR0aW5nJzoge1xuXHRcdFx0J3R5cGUnOiAnbnVtYmVyJyxcblx0XHRcdCdkZWZhdWx0JzogMyxcblx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTlxuXHRcdH1cblx0fVxufTtcblxuY2xhc3MgTWFya2Rvd25Db25maWd1cmF0aW9uU2VydmljZSBleHRlbmRzIFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB7XG5cdG92ZXJyaWRlIGFzeW5jIHVwZGF0ZVZhbHVlKGtleTogc3RyaW5nLCB2YWx1ZTogYW55KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgW3NlY3Rpb24sIHNldHRpbmddID0ga2V5LnNwbGl0KCcuJyk7XG5cdFx0cmV0dXJuIHRoaXMuc2V0VXNlckNvbmZpZ3VyYXRpb24oc2VjdGlvbiwgeyBbc2V0dGluZ106IHZhbHVlIH0pO1xuXHR9XG59XG5cbnN1aXRlKCdNYXJrZG93biBTZXR0aW5nIFJlbmRlcmVyIFRlc3QnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCBjb25maWd1cmF0aW9uU2VydmljZTogVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlO1xuXHRsZXQgcHJlZmVyZW5jZXNTZXJ2aWNlOiBJUHJlZmVyZW5jZXNTZXJ2aWNlO1xuXHRsZXQgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlO1xuXHRsZXQgc2V0dGluZ1JlbmRlcmVyOiBTaW1wbGVTZXR0aW5nUmVuZGVyZXI7XG5cblx0c3VpdGVTZXR1cCgoKSA9PiB7XG5cdFx0Y29uZmlndXJhdGlvblNlcnZpY2UgPSBuZXcgTWFya2Rvd25Db25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdHByZWZlcmVuY2VzU2VydmljZSA9IDxJUHJlZmVyZW5jZXNTZXJ2aWNlPntcblx0XHRcdGdldFNldHRpbmc6IChzZXR0aW5nKSA9PiB7XG5cdFx0XHRcdGxldCB0eXBlID0gJ2Jvb2xlYW4nO1xuXHRcdFx0XHRpZiAoc2V0dGluZy5pbmNsdWRlcygnc3RyaW5nJykpIHtcblx0XHRcdFx0XHR0eXBlID0gJ3N0cmluZyc7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHsgdHlwZSwga2V5OiBzZXR0aW5nIH07XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRjb250ZXh0TWVudVNlcnZpY2UgPSA8SUNvbnRleHRNZW51U2VydmljZT57fTtcblx0XHRSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pLnJlZ2lzdGVyQ29uZmlndXJhdGlvbihjb25maWd1cmF0aW9uKTtcblx0XHRzZXR0aW5nUmVuZGVyZXIgPSBuZXcgU2ltcGxlU2V0dGluZ1JlbmRlcmVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIHByZWZlcmVuY2VzU2VydmljZSwgeyBwdWJsaWNMb2cyOiAoKSA9PiB7IH0gfSBhcyBhbnksIHsgd3JpdGVUZXh0OiBhc3luYyAoKSA9PiB7IH0gfSBhcyBhbnkpO1xuXHR9KTtcblxuXHRzdWl0ZVRlYXJkb3duKCgpID0+IHtcblx0XHRSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pLmRlcmVnaXN0ZXJDb25maWd1cmF0aW9ucyhbY29uZmlndXJhdGlvbl0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZW5kZXIgY29kZSBzZXR0aW5nIGJ1dHRvbiB3aXRoIHZhbHVlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGh0bWxSZW5kZXJlciA9IHNldHRpbmdSZW5kZXJlci5nZXRIdG1sUmVuZGVyZXIoKTtcblx0XHRjb25zdCBodG1sTm9WYWx1ZSA9ICc8YSBocmVmPVwiY29kZS1vc3M6Ly9zZXR0aW5ncy9leGFtcGxlLmJvb2xlYW5TZXR0aW5nXCIgY29kZXNldHRpbmc9XCJ0cnVlXCI+Jztcblx0XHRjb25zdCByZW5kZXJlZEh0bWxOb1ZhbHVlID0gaHRtbFJlbmRlcmVyKHsgYmxvY2s6IGZhbHNlLCByYXc6IGh0bWxOb1ZhbHVlLCBwcmU6IGZhbHNlLCB0ZXh0OiAnJywgdHlwZTogJ2h0bWwnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZW5kZXJlZEh0bWxOb1ZhbHVlLFxuXHRcdFx0YDxjb2RlIHRhYmluZGV4PVwiMFwiPjxhIGhyZWY9XCJjb2RlLXNldHRpbmc6Ly9leGFtcGxlLmJvb2xlYW5TZXR0aW5nL3RydWVcIiBjbGFzcz1cImNvZGVzZXR0aW5nXCIgdGl0bGU9XCJWaWV3IG9yIGNoYW5nZSBzZXR0aW5nXCIgYXJpYS1yb2xlPVwiYnV0dG9uXCI+PHN2ZyB3aWR0aD1cIjE0XCIgaGVpZ2h0PVwiMTRcIiB2aWV3Qm94PVwiMCAwIDE1IDE1XCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGZpbGw9XCJjdXJyZW50Q29sb3JcIj48cGF0aCBkPVwiTTkuMSA0LjRMOC42IDJINy40bC0uNSAyLjQtLjcuMy0yLTEuMy0uOS44IDEuMyAyLS4yLjctMi40LjV2MS4ybDIuNC41LjMuOC0xLjMgMiAuOC44IDItMS4zLjguMy40IDIuM2gxLjJsLjUtMi40LjgtLjMgMiAxLjMuOC0uOC0xLjMtMiAuMy0uOCAyLjMtLjRWNy40bC0yLjQtLjUtLjMtLjggMS4zLTItLjgtLjgtMiAxLjMtLjctLjJ6TTkuNCAxbC41IDIuNEwxMiAyLjFsMiAyLTEuNCAyLjEgMi40LjR2Mi44bC0yLjQuNUwxNCAxMmwtMiAyLTIuMS0xLjQtLjUgMi40SDYuNmwtLjUtMi40TDQgMTMuOWwtMi0yIDEuNC0yLjFMMSA5LjRWNi42bDIuNC0uNUwyLjEgNGwyLTIgMi4xIDEuNC40LTIuNGgyLjh6bS42IDdjMCAxLjEtLjkgMi0yIDJzLTItLjktMi0yIC45LTIgMi0yIDIgLjkgMiAyek04IDljLjYgMCAxLS40IDEtMXMtLjQtMS0xLTEtMSAuNC0xIDEgLjQgMSAxIDF6XCIvPjwvc3ZnPlxuXHRcdFx0PHNwYW4gY2xhc3M9XCJzZXBhcmF0b3JcIj48L3NwYW4+XG5cdFx0XHQ8c3BhbiBjbGFzcz1cInNldHRpbmctbmFtZVwiPmV4YW1wbGUuYm9vbGVhblNldHRpbmc8L3NwYW4+XG5cdFx0PC9hPjwvY29kZT5gKTtcblx0fSk7XG5cblx0dGVzdCgnYWN0aW9ucyB3aXRoIG5vIHZhbHVlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZShzZXR0aW5nUmVuZGVyZXIuc2V0dGluZ1RvVXJpU3RyaW5nKCdleGFtcGxlLmJvb2xlYW5TZXR0aW5nJykpO1xuXHRcdGNvbnN0IGFjdGlvbnMgPSBzZXR0aW5nUmVuZGVyZXIuZ2V0QWN0aW9ucyh1cmkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zPy5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zWzBdLmxhYmVsLCAnVmlldyBcIkV4YW1wbGU6IEJvb2xlYW4gU2V0dGluZ1wiIGluIFNldHRpbmdzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FjdGlvbnMgd2l0aCB2YWx1ZSArIHVwZGF0aW5nIGFuZCByZXN0b3JpbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2Uuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ2V4YW1wbGUnLCB7IHN0cmluZ1NldHRpbmc6ICd0d28nIH0pO1xuXHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZShzZXR0aW5nUmVuZGVyZXIuc2V0dGluZ1RvVXJpU3RyaW5nKCdleGFtcGxlLnN0cmluZ1NldHRpbmcnLCAndGhyZWUnKSk7XG5cblx0XHRjb25zdCB2ZXJpZnlPcmlnaW5hbFN0YXRlID0gKGFjdGlvbnM6IElBY3Rpb25bXSB8IHVuZGVmaW5lZCk6IGFjdGlvbnMgaXMgSUFjdGlvbltdID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zPy5sZW5ndGgsIDMpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGlvbnNbMF0ubGFiZWwsICdTZXQgXCJFeGFtcGxlOiBTdHJpbmcgU2V0dGluZ1wiIHRvIFwidGhyZWVcIicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGlvbnNbMV0ubGFiZWwsICdWaWV3IGluIFNldHRpbmdzJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2V4YW1wbGUuc3RyaW5nU2V0dGluZycpLCAndHdvJyk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgYWN0aW9ucyA9IHNldHRpbmdSZW5kZXJlci5nZXRBY3Rpb25zKHVyaSk7XG5cdFx0aWYgKHZlcmlmeU9yaWdpbmFsU3RhdGUoYWN0aW9ucykpIHtcblx0XHRcdC8vIFVwZGF0ZSB0aGUgdmFsdWVcblx0XHRcdGF3YWl0IGFjdGlvbnNbMF0ucnVuKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2V4YW1wbGUuc3RyaW5nU2V0dGluZycpLCAndGhyZWUnKTtcblx0XHRcdGNvbnN0IGFjdGlvbnNVcGRhdGVkID0gc2V0dGluZ1JlbmRlcmVyLmdldEFjdGlvbnModXJpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zVXBkYXRlZD8ubGVuZ3RoLCAzKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zVXBkYXRlZFswXS5sYWJlbCwgJ1Jlc3RvcmUgdmFsdWUgb2YgXCJFeGFtcGxlOiBTdHJpbmcgU2V0dGluZ1wiJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aW9uc1sxXS5sYWJlbCwgJ1ZpZXcgaW4gU2V0dGluZ3MnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zWzJdLmxhYmVsLCAnQ29weSBTZXR0aW5nIElEJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2V4YW1wbGUuc3RyaW5nU2V0dGluZycpLCAndGhyZWUnKTtcblxuXHRcdFx0Ly8gUmVzdG9yZSB0aGUgdmFsdWVcblx0XHRcdGF3YWl0IGFjdGlvbnNVcGRhdGVkWzBdLnJ1bigpO1xuXHRcdFx0dmVyaWZ5T3JpZ2luYWxTdGF0ZShzZXR0aW5nUmVuZGVyZXIuZ2V0QWN0aW9ucyh1cmkpKTtcblx0XHR9XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxPQUFPLFlBQVk7QUFFbkIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsb0JBQW9CLGtCQUE4RDtBQUMzRixTQUFTLGdDQUFnQztBQUV6QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDZCQUE2QjtBQUd0QyxNQUFNLGdCQUFvQztBQUFBLEVBQ3pDLE1BQU07QUFBQSxFQUNOLFNBQVM7QUFBQSxFQUNULFFBQVE7QUFBQSxFQUNSLGNBQWM7QUFBQSxJQUNiLDBCQUEwQjtBQUFBLE1BQ3pCLFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxNQUNYLFNBQVMsbUJBQW1CO0FBQUEsSUFDN0I7QUFBQSxJQUNBLDJCQUEyQjtBQUFBLE1BQzFCLFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxNQUNYLFNBQVMsbUJBQW1CO0FBQUEsSUFDN0I7QUFBQSxJQUNBLHlCQUF5QjtBQUFBLE1BQ3hCLFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxNQUNYLFNBQVMsbUJBQW1CO0FBQUEsSUFDN0I7QUFBQSxJQUNBLHlCQUF5QjtBQUFBLE1BQ3hCLFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxNQUNYLFNBQVMsbUJBQW1CO0FBQUEsSUFDN0I7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxNQUFNLHFDQUFxQyx5QkFBeUI7QUFBQSxFQUNuRSxNQUFlLFlBQVksS0FBYSxPQUEyQjtBQUNsRSxVQUFNLENBQUMsU0FBUyxPQUFPLElBQUksSUFBSSxNQUFNLEdBQUc7QUFDeEMsV0FBTyxLQUFLLHFCQUFxQixTQUFTLEVBQUUsQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDO0FBQUEsRUFDL0Q7QUFDRDtBQUVBLE1BQU0sa0NBQWtDLE1BQU07QUFDN0MsMENBQXdDO0FBRXhDLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFFSixhQUFXLE1BQU07QUFDaEIsMkJBQXVCLElBQUksNkJBQTZCO0FBQ3hELHlCQUEwQztBQUFBLE1BQ3pDLFlBQVksQ0FBQyxZQUFZO0FBQ3hCLFlBQUksT0FBTztBQUNYLFlBQUksUUFBUSxTQUFTLFFBQVEsR0FBRztBQUMvQixpQkFBTztBQUFBLFFBQ1I7QUFDQSxlQUFPLEVBQUUsTUFBTSxLQUFLLFFBQVE7QUFBQSxNQUM3QjtBQUFBLElBQ0Q7QUFDQSx5QkFBMEMsQ0FBQztBQUMzQyxhQUFTLEdBQTJCLFdBQVcsYUFBYSxFQUFFLHNCQUFzQixhQUFhO0FBQ2pHLHNCQUFrQixJQUFJLHNCQUFzQixzQkFBc0Isb0JBQW9CLG9CQUFvQixFQUFFLFlBQVksTUFBTTtBQUFBLElBQUUsRUFBRSxHQUFVLEVBQUUsV0FBVyxZQUFZO0FBQUEsSUFBRSxFQUFFLENBQVE7QUFBQSxFQUNsTCxDQUFDO0FBRUQsZ0JBQWMsTUFBTTtBQUNuQixhQUFTLEdBQTJCLFdBQVcsYUFBYSxFQUFFLHlCQUF5QixDQUFDLGFBQWEsQ0FBQztBQUFBLEVBQ3ZHLENBQUM7QUFFRCxPQUFLLHlDQUF5QyxNQUFNO0FBQ25ELFVBQU0sZUFBZSxnQkFBZ0IsZ0JBQWdCO0FBQ3JELFVBQU0sY0FBYztBQUNwQixVQUFNLHNCQUFzQixhQUFhLEVBQUUsT0FBTyxPQUFPLEtBQUssYUFBYSxLQUFLLE9BQU8sTUFBTSxJQUFJLE1BQU0sT0FBTyxDQUFDO0FBQy9HLFdBQU87QUFBQSxNQUFZO0FBQUEsTUFDbEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUdXO0FBQUEsRUFDYixDQUFDO0FBRUQsT0FBSyx5QkFBeUIsTUFBTTtBQUNuQyxVQUFNLE1BQU0sSUFBSSxNQUFNLGdCQUFnQixtQkFBbUIsd0JBQXdCLENBQUM7QUFDbEYsVUFBTSxVQUFVLGdCQUFnQixXQUFXLEdBQUc7QUFDOUMsV0FBTyxZQUFZLFNBQVMsUUFBUSxDQUFDO0FBQ3JDLFdBQU8sWUFBWSxRQUFRLENBQUMsRUFBRSxPQUFPLDZDQUE2QztBQUFBLEVBQ25GLENBQUM7QUFFRCxPQUFLLCtDQUErQyxZQUFZO0FBQy9ELFVBQU0scUJBQXFCLHFCQUFxQixXQUFXLEVBQUUsZUFBZSxNQUFNLENBQUM7QUFDbkYsVUFBTSxNQUFNLElBQUksTUFBTSxnQkFBZ0IsbUJBQW1CLHlCQUF5QixPQUFPLENBQUM7QUFFMUYsVUFBTSxzQkFBc0IsQ0FBQ0EsYUFBeUQ7QUFDckYsYUFBTyxZQUFZQSxVQUFTLFFBQVEsQ0FBQztBQUNyQyxhQUFPLFlBQVlBLFNBQVEsQ0FBQyxFQUFFLE9BQU8sMENBQTBDO0FBQy9FLGFBQU8sWUFBWUEsU0FBUSxDQUFDLEVBQUUsT0FBTyxrQkFBa0I7QUFDdkQsYUFBTyxZQUFZLHFCQUFxQixTQUFTLHVCQUF1QixHQUFHLEtBQUs7QUFDaEYsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLFVBQVUsZ0JBQWdCLFdBQVcsR0FBRztBQUM5QyxRQUFJLG9CQUFvQixPQUFPLEdBQUc7QUFFakMsWUFBTSxRQUFRLENBQUMsRUFBRSxJQUFJO0FBQ3JCLGFBQU8sWUFBWSxxQkFBcUIsU0FBUyx1QkFBdUIsR0FBRyxPQUFPO0FBQ2xGLFlBQU0saUJBQWlCLGdCQUFnQixXQUFXLEdBQUc7QUFDckQsYUFBTyxZQUFZLGdCQUFnQixRQUFRLENBQUM7QUFDNUMsYUFBTyxZQUFZLGVBQWUsQ0FBQyxFQUFFLE9BQU8sNENBQTRDO0FBQ3hGLGFBQU8sWUFBWSxRQUFRLENBQUMsRUFBRSxPQUFPLGtCQUFrQjtBQUN2RCxhQUFPLFlBQVksUUFBUSxDQUFDLEVBQUUsT0FBTyxpQkFBaUI7QUFDdEQsYUFBTyxZQUFZLHFCQUFxQixTQUFTLHVCQUF1QixHQUFHLE9BQU87QUFHbEYsWUFBTSxlQUFlLENBQUMsRUFBRSxJQUFJO0FBQzVCLDBCQUFvQixnQkFBZ0IsV0FBVyxHQUFHLENBQUM7QUFBQSxJQUNwRDtBQUFBLEVBQ0QsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbImFjdGlvbnMiXQp9Cg==
