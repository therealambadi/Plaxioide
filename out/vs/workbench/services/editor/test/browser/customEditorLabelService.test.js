import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { CustomEditorLabelService } from "../../common/customEditorLabelService.js";
import { TestServiceAccessor, workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
suite("Custom Editor Label Service", () => {
  const disposables = new DisposableStore();
  setup(() => {
  });
  teardown(async () => {
    disposables.clear();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  async function createCustomLabelService(instantiationService = workbenchInstantiationService(void 0, disposables)) {
    const configService = new TestConfigurationService();
    await configService.setUserConfiguration(CustomEditorLabelService.SETTING_ID_ENABLED, true);
    instantiationService.stub(IConfigurationService, configService);
    const customLabelService = disposables.add(instantiationService.createInstance(CustomEditorLabelService));
    return [customLabelService, configService, instantiationService.createInstance(TestServiceAccessor)];
  }
  async function updatePattern(configService, value) {
    await configService.setUserConfiguration(CustomEditorLabelService.SETTING_ID_PATTERNS, value);
    configService.onDidChangeConfigurationEmitter.fire({
      affectsConfiguration: (key) => key === CustomEditorLabelService.SETTING_ID_PATTERNS,
      source: ConfigurationTarget.USER,
      affectedKeys: new Set(CustomEditorLabelService.SETTING_ID_PATTERNS),
      change: {
        keys: [],
        overrides: []
      }
    });
  }
  test("Custom Labels: filename.extname", async () => {
    const [customLabelService, configService] = await createCustomLabelService();
    await updatePattern(configService, {
      "**": "${filename}.${extname}"
    });
    const filenames = [
      "file.txt",
      "file.txt1.tx2",
      ".file.txt"
    ];
    for (const filename of filenames) {
      const label2 = customLabelService.getName(URI.file(filename));
      assert.strictEqual(label2, filename);
    }
    let label = customLabelService.getName(URI.file("file"));
    assert.strictEqual(label, "file.${extname}");
    label = customLabelService.getName(URI.file(".file"));
    assert.strictEqual(label, ".file.${extname}");
  });
  test("Custom Labels: filename", async () => {
    const [customLabelService, configService] = await createCustomLabelService();
    await updatePattern(configService, {
      "**": "${filename}"
    });
    assert.strictEqual(customLabelService.getName(URI.file("file")), "file");
    assert.strictEqual(customLabelService.getName(URI.file("file.txt")), "file");
    assert.strictEqual(customLabelService.getName(URI.file("file.txt1.txt2")), "file");
    assert.strictEqual(customLabelService.getName(URI.file("folder/file.txt1.txt2")), "file");
    assert.strictEqual(customLabelService.getName(URI.file(".file")), ".file");
    assert.strictEqual(customLabelService.getName(URI.file(".file.txt")), ".file");
    assert.strictEqual(customLabelService.getName(URI.file(".file.txt1.txt2")), ".file");
    assert.strictEqual(customLabelService.getName(URI.file("folder/.file.txt1.txt2")), ".file");
  });
  test("Custom Labels: extname(N)", async () => {
    const [customLabelService, configService] = await createCustomLabelService();
    await updatePattern(configService, {
      "**/ext/**": "${extname}",
      "**/ext0/**": "${extname(0)}",
      "**/ext1/**": "${extname(1)}",
      "**/ext2/**": "${extname(2)}",
      "**/extMinus1/**": "${extname(-1)}",
      "**/extMinus2/**": "${extname(-2)}"
    });
    function assertExtname(filename, ext) {
      assert.strictEqual(customLabelService.getName(URI.file(`test/ext/${filename}`)), ext.extname ?? "${extname}", filename);
      assert.strictEqual(customLabelService.getName(URI.file(`test/ext0/${filename}`)), ext.ext0 ?? "${extname(0)}", filename);
      assert.strictEqual(customLabelService.getName(URI.file(`test/ext1/${filename}`)), ext.ext1 ?? "${extname(1)}", filename);
      assert.strictEqual(customLabelService.getName(URI.file(`test/ext2/${filename}`)), ext.ext2 ?? "${extname(2)}", filename);
      assert.strictEqual(customLabelService.getName(URI.file(`test/extMinus1/${filename}`)), ext.extMinus1 ?? "${extname(-1)}", filename);
      assert.strictEqual(customLabelService.getName(URI.file(`test/extMinus2/${filename}`)), ext.extMinus2 ?? "${extname(-2)}", filename);
    }
    assertExtname("file.txt", {
      extname: "txt",
      ext0: "txt",
      extMinus1: "txt"
    });
    assertExtname("file.txt1.txt2", {
      extname: "txt1.txt2",
      ext0: "txt2",
      ext1: "txt1",
      extMinus1: "txt1",
      extMinus2: "txt2"
    });
    assertExtname(".file.txt1.txt2", {
      extname: "txt1.txt2",
      ext0: "txt2",
      ext1: "txt1",
      extMinus1: "txt1",
      extMinus2: "txt2"
    });
    assertExtname(".file.txt1.txt2.txt3.txt4", {
      extname: "txt1.txt2.txt3.txt4",
      ext0: "txt4",
      ext1: "txt3",
      ext2: "txt2",
      extMinus1: "txt1",
      extMinus2: "txt2"
    });
    assertExtname("file", {});
    assertExtname(".file", {});
  });
  test("Custom Labels: dirname(N)", async () => {
    const [customLabelService, configService] = await createCustomLabelService();
    await updatePattern(configService, {
      "**": "${dirname},${dirname(0)},${dirname(1)},${dirname(2)},${dirname(-1)},${dirname(-2)}"
    });
    function assertDirname(path, dir) {
      assert.strictEqual(customLabelService.getName(URI.file(path))?.split(",")[0], dir.dirname ?? "${dirname}", path);
      assert.strictEqual(customLabelService.getName(URI.file(path))?.split(",")[1], dir.dir0 ?? "${dirname(0)}", path);
      assert.strictEqual(customLabelService.getName(URI.file(path))?.split(",")[2], dir.dir1 ?? "${dirname(1)}", path);
      assert.strictEqual(customLabelService.getName(URI.file(path))?.split(",")[3], dir.dir2 ?? "${dirname(2)}", path);
      assert.strictEqual(customLabelService.getName(URI.file(path))?.split(",")[4], dir.dirMinus1 ?? "${dirname(-1)}", path);
      assert.strictEqual(customLabelService.getName(URI.file(path))?.split(",")[5], dir.dirMinus2 ?? "${dirname(-2)}", path);
    }
    assertDirname("folder/file.txt", {
      dirname: "folder",
      dir0: "folder",
      dirMinus1: "folder"
    });
    assertDirname("root/folder/file.txt", {
      dirname: "folder",
      dir0: "folder",
      dir1: "root",
      dirMinus1: "root",
      dirMinus2: "folder"
    });
    assertDirname("root/.folder/file.txt", {
      dirname: ".folder",
      dir0: ".folder",
      dir1: "root",
      dirMinus1: "root",
      dirMinus2: ".folder"
    });
    assertDirname("root/parent/folder/file.txt", {
      dirname: "folder",
      dir0: "folder",
      dir1: "parent",
      dir2: "root",
      dirMinus1: "root",
      dirMinus2: "parent"
    });
    assertDirname("file.txt", {});
  });
  test("Custom Labels: no pattern match", async () => {
    const [customLabelService, configService] = await createCustomLabelService();
    await updatePattern(configService, {
      "**/folder/**": "folder",
      "file": "file"
    });
    assert.strictEqual(customLabelService.getName(URI.file("file")), void 0);
    assert.strictEqual(customLabelService.getName(URI.file("file.txt")), void 0);
    assert.strictEqual(customLabelService.getName(URI.file("file.txt1.txt2")), void 0);
    assert.strictEqual(customLabelService.getName(URI.file("folder1/file.txt1.txt2")), void 0);
    assert.strictEqual(customLabelService.getName(URI.file(".file")), void 0);
    assert.strictEqual(customLabelService.getName(URI.file(".file.txt")), void 0);
    assert.strictEqual(customLabelService.getName(URI.file(".file.txt1.txt2")), void 0);
    assert.strictEqual(customLabelService.getName(URI.file("folder1/file.txt1.txt2")), void 0);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZWRpdG9yL3Rlc3QvYnJvd3Nlci9jdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IEN1c3RvbUVkaXRvckxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlc3RJbnN0YW50aWF0aW9uU2VydmljZSwgVGVzdFNlcnZpY2VBY2Nlc3Nvciwgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcblxuc3VpdGUoJ0N1c3RvbSBFZGl0b3IgTGFiZWwgU2VydmljZScsICgpID0+IHtcblxuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRzZXR1cCgoKSA9PiB7IH0pO1xuXG5cdHRlYXJkb3duKGFzeW5jICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRhc3luYyBmdW5jdGlvbiBjcmVhdGVDdXN0b21MYWJlbFNlcnZpY2UoaW5zdGFudGlhdGlvblNlcnZpY2U6IElUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIGRpc3Bvc2FibGVzKSk6IFByb21pc2U8W0N1c3RvbUVkaXRvckxhYmVsU2VydmljZSwgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLCBUZXN0U2VydmljZUFjY2Vzc29yXT4ge1xuXHRcdGNvbnN0IGNvbmZpZ1NlcnZpY2UgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0YXdhaXQgY29uZmlnU2VydmljZS5zZXRVc2VyQ29uZmlndXJhdGlvbihDdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UuU0VUVElOR19JRF9FTkFCTEVELCB0cnVlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb25maWd1cmF0aW9uU2VydmljZSwgY29uZmlnU2VydmljZSk7XG5cblx0XHRjb25zdCBjdXN0b21MYWJlbFNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlKSk7XG5cdFx0cmV0dXJuIFtjdXN0b21MYWJlbFNlcnZpY2UsIGNvbmZpZ1NlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTZXJ2aWNlQWNjZXNzb3IpXTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVBhdHRlcm4oY29uZmlnU2VydmljZTogVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLCB2YWx1ZTogYW55KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgY29uZmlnU2VydmljZS5zZXRVc2VyQ29uZmlndXJhdGlvbihDdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UuU0VUVElOR19JRF9QQVRURVJOUywgdmFsdWUpO1xuXHRcdGNvbmZpZ1NlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uRW1pdHRlci5maXJlKHtcblx0XHRcdGFmZmVjdHNDb25maWd1cmF0aW9uOiAoa2V5OiBzdHJpbmcpID0+IGtleSA9PT0gQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlLlNFVFRJTkdfSURfUEFUVEVSTlMsXG5cdFx0XHRzb3VyY2U6IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUixcblx0XHRcdGFmZmVjdGVkS2V5czogbmV3IFNldChDdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UuU0VUVElOR19JRF9QQVRURVJOUyksXG5cdFx0XHRjaGFuZ2U6IHtcblx0XHRcdFx0a2V5czogW10sXG5cdFx0XHRcdG92ZXJyaWRlczogW11cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHRlc3QoJ0N1c3RvbSBMYWJlbHM6IGZpbGVuYW1lLmV4dG5hbWUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgW2N1c3RvbUxhYmVsU2VydmljZSwgY29uZmlnU2VydmljZV0gPSBhd2FpdCBjcmVhdGVDdXN0b21MYWJlbFNlcnZpY2UoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVBhdHRlcm4oY29uZmlnU2VydmljZSwge1xuXHRcdFx0JyoqJzogJyR7ZmlsZW5hbWV9LiR7ZXh0bmFtZX0nXG5cdFx0fSk7XG5cblx0XHRjb25zdCBmaWxlbmFtZXMgPSBbXG5cdFx0XHQnZmlsZS50eHQnLFxuXHRcdFx0J2ZpbGUudHh0MS50eDInLFxuXHRcdFx0Jy5maWxlLnR4dCcsXG5cdFx0XTtcblxuXHRcdGZvciAoY29uc3QgZmlsZW5hbWUgb2YgZmlsZW5hbWVzKSB7XG5cdFx0XHRjb25zdCBsYWJlbCA9IGN1c3RvbUxhYmVsU2VydmljZS5nZXROYW1lKFVSSS5maWxlKGZpbGVuYW1lKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWwsIGZpbGVuYW1lKTtcblx0XHR9XG5cblx0XHRsZXQgbGFiZWwgPSBjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZSgnZmlsZScpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWwsICdmaWxlLiR7ZXh0bmFtZX0nKTtcblxuXHRcdGxhYmVsID0gY3VzdG9tTGFiZWxTZXJ2aWNlLmdldE5hbWUoVVJJLmZpbGUoJy5maWxlJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbCwgJy5maWxlLiR7ZXh0bmFtZX0nKTtcblx0fSk7XG5cblx0dGVzdCgnQ3VzdG9tIExhYmVsczogZmlsZW5hbWUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgW2N1c3RvbUxhYmVsU2VydmljZSwgY29uZmlnU2VydmljZV0gPSBhd2FpdCBjcmVhdGVDdXN0b21MYWJlbFNlcnZpY2UoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVBhdHRlcm4oY29uZmlnU2VydmljZSwge1xuXHRcdFx0JyoqJzogJyR7ZmlsZW5hbWV9Jyxcblx0XHR9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZSgnZmlsZScpKSwgJ2ZpbGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3VzdG9tTGFiZWxTZXJ2aWNlLmdldE5hbWUoVVJJLmZpbGUoJ2ZpbGUudHh0JykpLCAnZmlsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZSgnZmlsZS50eHQxLnR4dDInKSksICdmaWxlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGN1c3RvbUxhYmVsU2VydmljZS5nZXROYW1lKFVSSS5maWxlKCdmb2xkZXIvZmlsZS50eHQxLnR4dDInKSksICdmaWxlJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3VzdG9tTGFiZWxTZXJ2aWNlLmdldE5hbWUoVVJJLmZpbGUoJy5maWxlJykpLCAnLmZpbGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3VzdG9tTGFiZWxTZXJ2aWNlLmdldE5hbWUoVVJJLmZpbGUoJy5maWxlLnR4dCcpKSwgJy5maWxlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGN1c3RvbUxhYmVsU2VydmljZS5nZXROYW1lKFVSSS5maWxlKCcuZmlsZS50eHQxLnR4dDInKSksICcuZmlsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZSgnZm9sZGVyLy5maWxlLnR4dDEudHh0MicpKSwgJy5maWxlJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0N1c3RvbSBMYWJlbHM6IGV4dG5hbWUoTiknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgW2N1c3RvbUxhYmVsU2VydmljZSwgY29uZmlnU2VydmljZV0gPSBhd2FpdCBjcmVhdGVDdXN0b21MYWJlbFNlcnZpY2UoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVBhdHRlcm4oY29uZmlnU2VydmljZSwge1xuXHRcdFx0JyoqL2V4dC8qKic6ICcke2V4dG5hbWV9Jyxcblx0XHRcdCcqKi9leHQwLyoqJzogJyR7ZXh0bmFtZSgwKX0nLFxuXHRcdFx0JyoqL2V4dDEvKionOiAnJHtleHRuYW1lKDEpfScsXG5cdFx0XHQnKiovZXh0Mi8qKic6ICcke2V4dG5hbWUoMil9Jyxcblx0XHRcdCcqKi9leHRNaW51czEvKionOiAnJHtleHRuYW1lKC0xKX0nLFxuXHRcdFx0JyoqL2V4dE1pbnVzMi8qKic6ICcke2V4dG5hbWUoLTIpfScsXG5cdFx0fSk7XG5cblx0XHRpbnRlcmZhY2UgSUV4dCB7XG5cdFx0XHRleHRuYW1lPzogc3RyaW5nO1xuXHRcdFx0ZXh0MD86IHN0cmluZztcblx0XHRcdGV4dDE/OiBzdHJpbmc7XG5cdFx0XHRleHQyPzogc3RyaW5nO1xuXHRcdFx0ZXh0TWludXMxPzogc3RyaW5nO1xuXHRcdFx0ZXh0TWludXMyPzogc3RyaW5nO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGFzc2VydEV4dG5hbWUoZmlsZW5hbWU6IHN0cmluZywgZXh0OiBJRXh0KTogdm9pZCB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3VzdG9tTGFiZWxTZXJ2aWNlLmdldE5hbWUoVVJJLmZpbGUoYHRlc3QvZXh0LyR7ZmlsZW5hbWV9YCkpLCBleHQuZXh0bmFtZSA/PyAnJHtleHRuYW1lfScsIGZpbGVuYW1lKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZShgdGVzdC9leHQwLyR7ZmlsZW5hbWV9YCkpLCBleHQuZXh0MCA/PyAnJHtleHRuYW1lKDApfScsIGZpbGVuYW1lKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZShgdGVzdC9leHQxLyR7ZmlsZW5hbWV9YCkpLCBleHQuZXh0MSA/PyAnJHtleHRuYW1lKDEpfScsIGZpbGVuYW1lKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZShgdGVzdC9leHQyLyR7ZmlsZW5hbWV9YCkpLCBleHQuZXh0MiA/PyAnJHtleHRuYW1lKDIpfScsIGZpbGVuYW1lKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZShgdGVzdC9leHRNaW51czEvJHtmaWxlbmFtZX1gKSksIGV4dC5leHRNaW51czEgPz8gJyR7ZXh0bmFtZSgtMSl9JywgZmlsZW5hbWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGN1c3RvbUxhYmVsU2VydmljZS5nZXROYW1lKFVSSS5maWxlKGB0ZXN0L2V4dE1pbnVzMi8ke2ZpbGVuYW1lfWApKSwgZXh0LmV4dE1pbnVzMiA/PyAnJHtleHRuYW1lKC0yKX0nLCBmaWxlbmFtZSk7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0RXh0bmFtZSgnZmlsZS50eHQnLCB7XG5cdFx0XHRleHRuYW1lOiAndHh0Jyxcblx0XHRcdGV4dDA6ICd0eHQnLFxuXHRcdFx0ZXh0TWludXMxOiAndHh0Jyxcblx0XHR9KTtcblxuXHRcdGFzc2VydEV4dG5hbWUoJ2ZpbGUudHh0MS50eHQyJywge1xuXHRcdFx0ZXh0bmFtZTogJ3R4dDEudHh0MicsXG5cdFx0XHRleHQwOiAndHh0MicsXG5cdFx0XHRleHQxOiAndHh0MScsXG5cdFx0XHRleHRNaW51czE6ICd0eHQxJyxcblx0XHRcdGV4dE1pbnVzMjogJ3R4dDInLFxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0RXh0bmFtZSgnLmZpbGUudHh0MS50eHQyJywge1xuXHRcdFx0ZXh0bmFtZTogJ3R4dDEudHh0MicsXG5cdFx0XHRleHQwOiAndHh0MicsXG5cdFx0XHRleHQxOiAndHh0MScsXG5cdFx0XHRleHRNaW51czE6ICd0eHQxJyxcblx0XHRcdGV4dE1pbnVzMjogJ3R4dDInLFxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0RXh0bmFtZSgnLmZpbGUudHh0MS50eHQyLnR4dDMudHh0NCcsIHtcblx0XHRcdGV4dG5hbWU6ICd0eHQxLnR4dDIudHh0My50eHQ0Jyxcblx0XHRcdGV4dDA6ICd0eHQ0Jyxcblx0XHRcdGV4dDE6ICd0eHQzJyxcblx0XHRcdGV4dDI6ICd0eHQyJyxcblx0XHRcdGV4dE1pbnVzMTogJ3R4dDEnLFxuXHRcdFx0ZXh0TWludXMyOiAndHh0MicsXG5cdFx0fSk7XG5cblx0XHRhc3NlcnRFeHRuYW1lKCdmaWxlJywge30pO1xuXHRcdGFzc2VydEV4dG5hbWUoJy5maWxlJywge30pO1xuXHR9KTtcblxuXHR0ZXN0KCdDdXN0b20gTGFiZWxzOiBkaXJuYW1lKE4pJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFtjdXN0b21MYWJlbFNlcnZpY2UsIGNvbmZpZ1NlcnZpY2VdID0gYXdhaXQgY3JlYXRlQ3VzdG9tTGFiZWxTZXJ2aWNlKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVQYXR0ZXJuKGNvbmZpZ1NlcnZpY2UsIHtcblx0XHRcdCcqKic6ICcke2Rpcm5hbWV9LCR7ZGlybmFtZSgwKX0sJHtkaXJuYW1lKDEpfSwke2Rpcm5hbWUoMil9LCR7ZGlybmFtZSgtMSl9LCR7ZGlybmFtZSgtMil9Jyxcblx0XHR9KTtcblxuXHRcdGludGVyZmFjZSBJRGlyIHtcblx0XHRcdGRpcm5hbWU/OiBzdHJpbmc7XG5cdFx0XHRkaXIwPzogc3RyaW5nO1xuXHRcdFx0ZGlyMT86IHN0cmluZztcblx0XHRcdGRpcjI/OiBzdHJpbmc7XG5cdFx0XHRkaXJNaW51czE/OiBzdHJpbmc7XG5cdFx0XHRkaXJNaW51czI/OiBzdHJpbmc7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gYXNzZXJ0RGlybmFtZShwYXRoOiBzdHJpbmcsIGRpcjogSURpcik6IHZvaWQge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGN1c3RvbUxhYmVsU2VydmljZS5nZXROYW1lKFVSSS5maWxlKHBhdGgpKT8uc3BsaXQoJywnKVswXSwgZGlyLmRpcm5hbWUgPz8gJyR7ZGlybmFtZX0nLCBwYXRoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZShwYXRoKSk/LnNwbGl0KCcsJylbMV0sIGRpci5kaXIwID8/ICcke2Rpcm5hbWUoMCl9JywgcGF0aCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3VzdG9tTGFiZWxTZXJ2aWNlLmdldE5hbWUoVVJJLmZpbGUocGF0aCkpPy5zcGxpdCgnLCcpWzJdLCBkaXIuZGlyMSA/PyAnJHtkaXJuYW1lKDEpfScsIHBhdGgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGN1c3RvbUxhYmVsU2VydmljZS5nZXROYW1lKFVSSS5maWxlKHBhdGgpKT8uc3BsaXQoJywnKVszXSwgZGlyLmRpcjIgPz8gJyR7ZGlybmFtZSgyKX0nLCBwYXRoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZShwYXRoKSk/LnNwbGl0KCcsJylbNF0sIGRpci5kaXJNaW51czEgPz8gJyR7ZGlybmFtZSgtMSl9JywgcGF0aCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3VzdG9tTGFiZWxTZXJ2aWNlLmdldE5hbWUoVVJJLmZpbGUocGF0aCkpPy5zcGxpdCgnLCcpWzVdLCBkaXIuZGlyTWludXMyID8/ICcke2Rpcm5hbWUoLTIpfScsIHBhdGgpO1xuXHRcdH1cblxuXHRcdGFzc2VydERpcm5hbWUoJ2ZvbGRlci9maWxlLnR4dCcsIHtcblx0XHRcdGRpcm5hbWU6ICdmb2xkZXInLFxuXHRcdFx0ZGlyMDogJ2ZvbGRlcicsXG5cdFx0XHRkaXJNaW51czE6ICdmb2xkZXInLFxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0RGlybmFtZSgncm9vdC9mb2xkZXIvZmlsZS50eHQnLCB7XG5cdFx0XHRkaXJuYW1lOiAnZm9sZGVyJyxcblx0XHRcdGRpcjA6ICdmb2xkZXInLFxuXHRcdFx0ZGlyMTogJ3Jvb3QnLFxuXHRcdFx0ZGlyTWludXMxOiAncm9vdCcsXG5cdFx0XHRkaXJNaW51czI6ICdmb2xkZXInLFxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0RGlybmFtZSgncm9vdC8uZm9sZGVyL2ZpbGUudHh0Jywge1xuXHRcdFx0ZGlybmFtZTogJy5mb2xkZXInLFxuXHRcdFx0ZGlyMDogJy5mb2xkZXInLFxuXHRcdFx0ZGlyMTogJ3Jvb3QnLFxuXHRcdFx0ZGlyTWludXMxOiAncm9vdCcsXG5cdFx0XHRkaXJNaW51czI6ICcuZm9sZGVyJyxcblx0XHR9KTtcblxuXHRcdGFzc2VydERpcm5hbWUoJ3Jvb3QvcGFyZW50L2ZvbGRlci9maWxlLnR4dCcsIHtcblx0XHRcdGRpcm5hbWU6ICdmb2xkZXInLFxuXHRcdFx0ZGlyMDogJ2ZvbGRlcicsXG5cdFx0XHRkaXIxOiAncGFyZW50Jyxcblx0XHRcdGRpcjI6ICdyb290Jyxcblx0XHRcdGRpck1pbnVzMTogJ3Jvb3QnLFxuXHRcdFx0ZGlyTWludXMyOiAncGFyZW50Jyxcblx0XHR9KTtcblxuXHRcdGFzc2VydERpcm5hbWUoJ2ZpbGUudHh0Jywge30pO1xuXHR9KTtcblxuXHR0ZXN0KCdDdXN0b20gTGFiZWxzOiBubyBwYXR0ZXJuIG1hdGNoJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFtjdXN0b21MYWJlbFNlcnZpY2UsIGNvbmZpZ1NlcnZpY2VdID0gYXdhaXQgY3JlYXRlQ3VzdG9tTGFiZWxTZXJ2aWNlKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVQYXR0ZXJuKGNvbmZpZ1NlcnZpY2UsIHtcblx0XHRcdCcqKi9mb2xkZXIvKionOiAnZm9sZGVyJyxcblx0XHRcdCdmaWxlJzogJ2ZpbGUnLFxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGN1c3RvbUxhYmVsU2VydmljZS5nZXROYW1lKFVSSS5maWxlKCdmaWxlJykpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZSgnZmlsZS50eHQnKSksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGN1c3RvbUxhYmVsU2VydmljZS5nZXROYW1lKFVSSS5maWxlKCdmaWxlLnR4dDEudHh0MicpKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3VzdG9tTGFiZWxTZXJ2aWNlLmdldE5hbWUoVVJJLmZpbGUoJ2ZvbGRlcjEvZmlsZS50eHQxLnR4dDInKSksIHVuZGVmaW5lZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3VzdG9tTGFiZWxTZXJ2aWNlLmdldE5hbWUoVVJJLmZpbGUoJy5maWxlJykpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZSgnLmZpbGUudHh0JykpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZSgnLmZpbGUudHh0MS50eHQyJykpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21MYWJlbFNlcnZpY2UuZ2V0TmFtZShVUkkuZmlsZSgnZm9sZGVyMS9maWxlLnR4dDEudHh0MicpKSwgdW5kZWZpbmVkKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxxQkFBcUIsNkJBQTZCO0FBQzNELFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQW9DLHFCQUFxQixxQ0FBcUM7QUFFOUYsTUFBTSwrQkFBK0IsTUFBTTtBQUUxQyxRQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFFeEMsUUFBTSxNQUFNO0FBQUEsRUFBRSxDQUFDO0FBRWYsV0FB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LEVBQUUsQ0FBQyxHQUFHLElBQUksYUFBYSxrQkFBa0IsSUFBSTtBQUFBLElBQ3RIO0FBRUEsa0JBQWMsbUJBQW1CO0FBQUEsTUFDaEMsU0FBUztBQUFBLE1BQ1QsTUFBTTtBQUFBLE1BQ04sV0FBVztBQUFBLElBQ1osQ0FBQztBQUVELGtCQUFjLHdCQUF3QjtBQUFBLE1BQ3JDLFNBQVM7QUFBQSxNQUNULE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLFdBQVc7QUFBQSxNQUNYLFdBQVc7QUFBQSxJQUNaLENBQUM7QUFFRCxrQkFBYyx5QkFBeUI7QUFBQSxNQUN0QyxTQUFTO0FBQUEsTUFDVCxNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixXQUFXO0FBQUEsTUFDWCxXQUFXO0FBQUEsSUFDWixDQUFDO0FBRUQsa0JBQWMsK0JBQStCO0FBQUEsTUFDNUMsU0FBUztBQUFBLE1BQ1QsTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sV0FBVztBQUFBLE1BQ1gsV0FBVztBQUFBLElBQ1osQ0FBQztBQUVELGtCQUFjLFlBQVksQ0FBQyxDQUFDO0FBQUEsRUFDN0IsQ0FBQztBQUVELE9BQUssbUNBQW1DLFlBQVk7QUFDbkQsVUFBTSxDQUFDLG9CQUFvQixhQUFhLElBQUksTUFBTSx5QkFBeUI7QUFFM0UsVUFBTSxjQUFjLGVBQWU7QUFBQSxNQUNsQyxnQkFBZ0I7QUFBQSxNQUNoQixRQUFRO0FBQUEsSUFDVCxDQUFDO0FBRUQsV0FBTyxZQUFZLG1CQUFtQixRQUFRLElBQUksS0FBSyxNQUFNLENBQUMsR0FBRyxNQUFTO0FBQzFFLFdBQU8sWUFBWSxtQkFBbUIsUUFBUSxJQUFJLEtBQUssVUFBVSxDQUFDLEdBQUcsTUFBUztBQUM5RSxXQUFPLFlBQVksbUJBQW1CLFFBQVEsSUFBSSxLQUFLLGdCQUFnQixDQUFDLEdBQUcsTUFBUztBQUNwRixXQUFPLFlBQVksbUJBQW1CLFFBQVEsSUFBSSxLQUFLLHdCQUF3QixDQUFDLEdBQUcsTUFBUztBQUU1RixXQUFPLFlBQVksbUJBQW1CLFFBQVEsSUFBSSxLQUFLLE9BQU8sQ0FBQyxHQUFHLE1BQVM7QUFDM0UsV0FBTyxZQUFZLG1CQUFtQixRQUFRLElBQUksS0FBSyxXQUFXLENBQUMsR0FBRyxNQUFTO0FBQy9FLFdBQU8sWUFBWSxtQkFBbUIsUUFBUSxJQUFJLEtBQUssaUJBQWlCLENBQUMsR0FBRyxNQUFTO0FBQ3JGLFdBQU8sWUFBWSxtQkFBbUIsUUFBUSxJQUFJLEtBQUssd0JBQXdCLENBQUMsR0FBRyxNQUFTO0FBQUEsRUFDN0YsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbImxhYmVsIl0KfQo=
