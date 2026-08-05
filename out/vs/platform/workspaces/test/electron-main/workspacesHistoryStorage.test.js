import assert from "assert";
import { tmpdir } from "os";
import { join } from "../../../../base/common/path.js";
import { URI } from "../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { NullLogService } from "../../../log/common/log.js";
import { isRecentFolder, restoreRecentlyOpened, toStoreData } from "../../common/workspaces.js";
suite("History Storage", () => {
  function toWorkspace(uri) {
    return {
      id: "1234",
      configPath: uri
    };
  }
  function assertEqualURI(u1, u2, message) {
    assert.strictEqual(u1 && u1.toString(), u2 && u2.toString(), message);
  }
  function assertEqualWorkspace(w1, w2, message) {
    if (!w1 || !w2) {
      assert.strictEqual(w1, w2, message);
      return;
    }
    assert.strictEqual(w1.id, w2.id, message);
    assertEqualURI(w1.configPath, w2.configPath, message);
  }
  function assertEqualRecentlyOpened(actual, expected, message) {
    assert.strictEqual(actual.files.length, expected.files.length, message);
    for (let i = 0; i < actual.files.length; i++) {
      assertEqualURI(actual.files[i].fileUri, expected.files[i].fileUri, message);
      assert.strictEqual(actual.files[i].label, expected.files[i].label);
      assert.strictEqual(actual.files[i].remoteAuthority, expected.files[i].remoteAuthority);
    }
    assert.strictEqual(actual.workspaces.length, expected.workspaces.length, message);
    for (let i = 0; i < actual.workspaces.length; i++) {
      const expectedRecent = expected.workspaces[i];
      const actualRecent = actual.workspaces[i];
      if (isRecentFolder(actualRecent)) {
        assertEqualURI(actualRecent.folderUri, expectedRecent.folderUri, message);
      } else {
        assertEqualWorkspace(actualRecent.workspace, expectedRecent.workspace, message);
      }
      assert.strictEqual(actualRecent.label, expectedRecent.label);
      assert.strictEqual(actualRecent.remoteAuthority, actualRecent.remoteAuthority);
    }
  }
  function assertRestoring(state, message) {
    const stored = toStoreData(state);
    const restored = restoreRecentlyOpened(stored, new NullLogService());
    assertEqualRecentlyOpened(state, restored, message);
  }
  const testWSPath = URI.file(join(tmpdir(), "windowStateTest", "test.code-workspace"));
  const testFileURI = URI.file(join(tmpdir(), "windowStateTest", "testFile.txt"));
  const testFolderURI = URI.file(join(tmpdir(), "windowStateTest", "testFolder"));
  const testRemoteFolderURI = URI.parse("foo://bar/c/e");
  const testRemoteFileURI = URI.parse("foo://bar/c/d.txt");
  const testRemoteWSURI = URI.parse("foo://bar/c/test.code-workspace");
  test("storing and restoring", () => {
    let ro;
    ro = {
      files: [],
      workspaces: []
    };
    assertRestoring(ro, "empty");
    ro = {
      files: [{ fileUri: testFileURI }],
      workspaces: []
    };
    assertRestoring(ro, "file");
    ro = {
      files: [],
      workspaces: [{ folderUri: testFolderURI }]
    };
    assertRestoring(ro, "folder");
    ro = {
      files: [],
      workspaces: [{ workspace: toWorkspace(testWSPath) }, { folderUri: testFolderURI }]
    };
    assertRestoring(ro, "workspaces and folders");
    ro = {
      files: [{ fileUri: testRemoteFileURI }],
      workspaces: [{ workspace: toWorkspace(testRemoteWSURI) }, { folderUri: testRemoteFolderURI }]
    };
    assertRestoring(ro, "remote workspaces and folders");
    ro = {
      files: [{ label: "abc", fileUri: testFileURI }],
      workspaces: [{ label: "def", workspace: toWorkspace(testWSPath) }, { folderUri: testRemoteFolderURI }]
    };
    assertRestoring(ro, "labels");
    ro = {
      files: [{ label: "abc", remoteAuthority: "test", fileUri: testRemoteFileURI }],
      workspaces: [{ label: "def", remoteAuthority: "test", workspace: toWorkspace(testWSPath) }, { folderUri: testRemoteFolderURI, remoteAuthority: "test" }]
    };
    assertRestoring(ro, "authority");
  });
  test("open 1_55", () => {
    const v1_55 = `{
			"entries": [
				{
					"folderUri": "foo://bar/23/43",
					"remoteAuthority": "test+test"
				},
				{
					"workspace": {
						"id": "53b714b46ef1a2d4346568b4f591028c",
						"configPath": "file:///home/user/workspaces/testing/custom.code-workspace"
					}
				},
				{
					"folderUri": "file:///home/user/workspaces/testing/folding",
					"label": "abc"
				},
				{
					"fileUri": "file:///home/user/.config/code-oss-dev/storage.json",
					"label": "def"
				}
			]
		}`;
    const windowsState = restoreRecentlyOpened(JSON.parse(v1_55), new NullLogService());
    const expected = {
      files: [{ label: "def", fileUri: URI.parse("file:///home/user/.config/code-oss-dev/storage.json") }],
      workspaces: [
        { folderUri: URI.parse("foo://bar/23/43"), remoteAuthority: "test+test" },
        { workspace: { id: "53b714b46ef1a2d4346568b4f591028c", configPath: URI.parse("file:///home/user/workspaces/testing/custom.code-workspace") } },
        { label: "abc", folderUri: URI.parse("file:///home/user/workspaces/testing/folding") }
      ]
    };
    assertEqualRecentlyOpened(windowsState, expected, "v1_33");
  });
  test("toStoreData drops label if it matches path", () => {
    const actual = toStoreData({
      workspaces: [],
      files: [{
        fileUri: URI.parse("file:///foo/bar/test.txt"),
        label: "/foo/bar/test.txt",
        remoteAuthority: void 0
      }]
    });
    assert.deepStrictEqual(actual, {
      entries: [{
        fileUri: "file:///foo/bar/test.txt",
        label: void 0,
        remoteAuthority: void 0
      }]
    });
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS93b3Jrc3BhY2VzL3Rlc3QvZWxlY3Ryb24tbWFpbi93b3Jrc3BhY2VzSGlzdG9yeVN0b3JhZ2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IHRtcGRpciB9IGZyb20gJ29zJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUlkZW50aWZpZXIgfSBmcm9tICcuLi8uLi8uLi93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJUmVjZW50Rm9sZGVyLCBJUmVjZW50bHlPcGVuZWQsIElSZWNlbnRXb3Jrc3BhY2UsIGlzUmVjZW50Rm9sZGVyLCByZXN0b3JlUmVjZW50bHlPcGVuZWQsIHRvU3RvcmVEYXRhIH0gZnJvbSAnLi4vLi4vY29tbW9uL3dvcmtzcGFjZXMuanMnO1xuXG5zdWl0ZSgnSGlzdG9yeSBTdG9yYWdlJywgKCkgPT4ge1xuXG5cdGZ1bmN0aW9uIHRvV29ya3NwYWNlKHVyaTogVVJJKTogSVdvcmtzcGFjZUlkZW50aWZpZXIge1xuXHRcdHJldHVybiB7XG5cdFx0XHRpZDogJzEyMzQnLFxuXHRcdFx0Y29uZmlnUGF0aDogdXJpXG5cdFx0fTtcblx0fVxuXHRmdW5jdGlvbiBhc3NlcnRFcXVhbFVSSSh1MTogVVJJIHwgdW5kZWZpbmVkLCB1MjogVVJJIHwgdW5kZWZpbmVkLCBtZXNzYWdlPzogc3RyaW5nKTogdm9pZCB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHUxICYmIHUxLnRvU3RyaW5nKCksIHUyICYmIHUyLnRvU3RyaW5nKCksIG1lc3NhZ2UpO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0RXF1YWxXb3Jrc3BhY2UodzE6IElXb3Jrc3BhY2VJZGVudGlmaWVyIHwgdW5kZWZpbmVkLCB3MjogSVdvcmtzcGFjZUlkZW50aWZpZXIgfCB1bmRlZmluZWQsIG1lc3NhZ2U/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoIXcxIHx8ICF3Mikge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHcxLCB3MiwgbWVzc2FnZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3MS5pZCwgdzIuaWQsIG1lc3NhZ2UpO1xuXHRcdGFzc2VydEVxdWFsVVJJKHcxLmNvbmZpZ1BhdGgsIHcyLmNvbmZpZ1BhdGgsIG1lc3NhZ2UpO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0RXF1YWxSZWNlbnRseU9wZW5lZChhY3R1YWw6IElSZWNlbnRseU9wZW5lZCwgZXhwZWN0ZWQ6IElSZWNlbnRseU9wZW5lZCwgbWVzc2FnZT86IHN0cmluZykge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZmlsZXMubGVuZ3RoLCBleHBlY3RlZC5maWxlcy5sZW5ndGgsIG1lc3NhZ2UpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYWN0dWFsLmZpbGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRhc3NlcnRFcXVhbFVSSShhY3R1YWwuZmlsZXNbaV0uZmlsZVVyaSwgZXhwZWN0ZWQuZmlsZXNbaV0uZmlsZVVyaSwgbWVzc2FnZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmZpbGVzW2ldLmxhYmVsLCBleHBlY3RlZC5maWxlc1tpXS5sYWJlbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmZpbGVzW2ldLnJlbW90ZUF1dGhvcml0eSwgZXhwZWN0ZWQuZmlsZXNbaV0ucmVtb3RlQXV0aG9yaXR5KTtcblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC53b3Jrc3BhY2VzLmxlbmd0aCwgZXhwZWN0ZWQud29ya3NwYWNlcy5sZW5ndGgsIG1lc3NhZ2UpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYWN0dWFsLndvcmtzcGFjZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGV4cGVjdGVkUmVjZW50ID0gZXhwZWN0ZWQud29ya3NwYWNlc1tpXTtcblx0XHRcdGNvbnN0IGFjdHVhbFJlY2VudCA9IGFjdHVhbC53b3Jrc3BhY2VzW2ldO1xuXHRcdFx0aWYgKGlzUmVjZW50Rm9sZGVyKGFjdHVhbFJlY2VudCkpIHtcblx0XHRcdFx0YXNzZXJ0RXF1YWxVUkkoYWN0dWFsUmVjZW50LmZvbGRlclVyaSwgKDxJUmVjZW50Rm9sZGVyPmV4cGVjdGVkUmVjZW50KS5mb2xkZXJVcmksIG1lc3NhZ2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXNzZXJ0RXF1YWxXb3Jrc3BhY2UoYWN0dWFsUmVjZW50LndvcmtzcGFjZSwgKDxJUmVjZW50V29ya3NwYWNlPmV4cGVjdGVkUmVjZW50KS53b3Jrc3BhY2UsIG1lc3NhZ2UpO1xuXHRcdFx0fVxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbFJlY2VudC5sYWJlbCwgZXhwZWN0ZWRSZWNlbnQubGFiZWwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbFJlY2VudC5yZW1vdGVBdXRob3JpdHksIGFjdHVhbFJlY2VudC5yZW1vdGVBdXRob3JpdHkpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydFJlc3RvcmluZyhzdGF0ZTogSVJlY2VudGx5T3BlbmVkLCBtZXNzYWdlPzogc3RyaW5nKSB7XG5cdFx0Y29uc3Qgc3RvcmVkID0gdG9TdG9yZURhdGEoc3RhdGUpO1xuXHRcdGNvbnN0IHJlc3RvcmVkID0gcmVzdG9yZVJlY2VudGx5T3BlbmVkKHN0b3JlZCwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGFzc2VydEVxdWFsUmVjZW50bHlPcGVuZWQoc3RhdGUsIHJlc3RvcmVkLCBtZXNzYWdlKTtcblx0fVxuXG5cdGNvbnN0IHRlc3RXU1BhdGggPSBVUkkuZmlsZShqb2luKHRtcGRpcigpLCAnd2luZG93U3RhdGVUZXN0JywgJ3Rlc3QuY29kZS13b3Jrc3BhY2UnKSk7XG5cdGNvbnN0IHRlc3RGaWxlVVJJID0gVVJJLmZpbGUoam9pbih0bXBkaXIoKSwgJ3dpbmRvd1N0YXRlVGVzdCcsICd0ZXN0RmlsZS50eHQnKSk7XG5cdGNvbnN0IHRlc3RGb2xkZXJVUkkgPSBVUkkuZmlsZShqb2luKHRtcGRpcigpLCAnd2luZG93U3RhdGVUZXN0JywgJ3Rlc3RGb2xkZXInKSk7XG5cblx0Y29uc3QgdGVzdFJlbW90ZUZvbGRlclVSSSA9IFVSSS5wYXJzZSgnZm9vOi8vYmFyL2MvZScpO1xuXHRjb25zdCB0ZXN0UmVtb3RlRmlsZVVSSSA9IFVSSS5wYXJzZSgnZm9vOi8vYmFyL2MvZC50eHQnKTtcblx0Y29uc3QgdGVzdFJlbW90ZVdTVVJJID0gVVJJLnBhcnNlKCdmb286Ly9iYXIvYy90ZXN0LmNvZGUtd29ya3NwYWNlJyk7XG5cblx0dGVzdCgnc3RvcmluZyBhbmQgcmVzdG9yaW5nJywgKCkgPT4ge1xuXHRcdGxldCBybzogSVJlY2VudGx5T3BlbmVkO1xuXHRcdHJvID0ge1xuXHRcdFx0ZmlsZXM6IFtdLFxuXHRcdFx0d29ya3NwYWNlczogW11cblx0XHR9O1xuXHRcdGFzc2VydFJlc3RvcmluZyhybywgJ2VtcHR5Jyk7XG5cdFx0cm8gPSB7XG5cdFx0XHRmaWxlczogW3sgZmlsZVVyaTogdGVzdEZpbGVVUkkgfV0sXG5cdFx0XHR3b3Jrc3BhY2VzOiBbXVxuXHRcdH07XG5cdFx0YXNzZXJ0UmVzdG9yaW5nKHJvLCAnZmlsZScpO1xuXHRcdHJvID0ge1xuXHRcdFx0ZmlsZXM6IFtdLFxuXHRcdFx0d29ya3NwYWNlczogW3sgZm9sZGVyVXJpOiB0ZXN0Rm9sZGVyVVJJIH1dXG5cdFx0fTtcblx0XHRhc3NlcnRSZXN0b3Jpbmcocm8sICdmb2xkZXInKTtcblx0XHRybyA9IHtcblx0XHRcdGZpbGVzOiBbXSxcblx0XHRcdHdvcmtzcGFjZXM6IFt7IHdvcmtzcGFjZTogdG9Xb3Jrc3BhY2UodGVzdFdTUGF0aCkgfSwgeyBmb2xkZXJVcmk6IHRlc3RGb2xkZXJVUkkgfV1cblx0XHR9O1xuXHRcdGFzc2VydFJlc3RvcmluZyhybywgJ3dvcmtzcGFjZXMgYW5kIGZvbGRlcnMnKTtcblxuXHRcdHJvID0ge1xuXHRcdFx0ZmlsZXM6IFt7IGZpbGVVcmk6IHRlc3RSZW1vdGVGaWxlVVJJIH1dLFxuXHRcdFx0d29ya3NwYWNlczogW3sgd29ya3NwYWNlOiB0b1dvcmtzcGFjZSh0ZXN0UmVtb3RlV1NVUkkpIH0sIHsgZm9sZGVyVXJpOiB0ZXN0UmVtb3RlRm9sZGVyVVJJIH1dXG5cdFx0fTtcblx0XHRhc3NlcnRSZXN0b3Jpbmcocm8sICdyZW1vdGUgd29ya3NwYWNlcyBhbmQgZm9sZGVycycpO1xuXHRcdHJvID0ge1xuXHRcdFx0ZmlsZXM6IFt7IGxhYmVsOiAnYWJjJywgZmlsZVVyaTogdGVzdEZpbGVVUkkgfV0sXG5cdFx0XHR3b3Jrc3BhY2VzOiBbeyBsYWJlbDogJ2RlZicsIHdvcmtzcGFjZTogdG9Xb3Jrc3BhY2UodGVzdFdTUGF0aCkgfSwgeyBmb2xkZXJVcmk6IHRlc3RSZW1vdGVGb2xkZXJVUkkgfV1cblx0XHR9O1xuXHRcdGFzc2VydFJlc3RvcmluZyhybywgJ2xhYmVscycpO1xuXHRcdHJvID0ge1xuXHRcdFx0ZmlsZXM6IFt7IGxhYmVsOiAnYWJjJywgcmVtb3RlQXV0aG9yaXR5OiAndGVzdCcsIGZpbGVVcmk6IHRlc3RSZW1vdGVGaWxlVVJJIH1dLFxuXHRcdFx0d29ya3NwYWNlczogW3sgbGFiZWw6ICdkZWYnLCByZW1vdGVBdXRob3JpdHk6ICd0ZXN0Jywgd29ya3NwYWNlOiB0b1dvcmtzcGFjZSh0ZXN0V1NQYXRoKSB9LCB7IGZvbGRlclVyaTogdGVzdFJlbW90ZUZvbGRlclVSSSwgcmVtb3RlQXV0aG9yaXR5OiAndGVzdCcgfV1cblx0XHR9O1xuXHRcdGFzc2VydFJlc3RvcmluZyhybywgJ2F1dGhvcml0eScpO1xuXHR9KTtcblxuXHR0ZXN0KCdvcGVuIDFfNTUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdjFfNTUgPSBge1xuXHRcdFx0XCJlbnRyaWVzXCI6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdFwiZm9sZGVyVXJpXCI6IFwiZm9vOi8vYmFyLzIzLzQzXCIsXG5cdFx0XHRcdFx0XCJyZW1vdGVBdXRob3JpdHlcIjogXCJ0ZXN0K3Rlc3RcIlxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0XCJ3b3Jrc3BhY2VcIjoge1xuXHRcdFx0XHRcdFx0XCJpZFwiOiBcIjUzYjcxNGI0NmVmMWEyZDQzNDY1NjhiNGY1OTEwMjhjXCIsXG5cdFx0XHRcdFx0XHRcImNvbmZpZ1BhdGhcIjogXCJmaWxlOi8vL2hvbWUvdXNlci93b3Jrc3BhY2VzL3Rlc3RpbmcvY3VzdG9tLmNvZGUtd29ya3NwYWNlXCJcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRcImZvbGRlclVyaVwiOiBcImZpbGU6Ly8vaG9tZS91c2VyL3dvcmtzcGFjZXMvdGVzdGluZy9mb2xkaW5nXCIsXG5cdFx0XHRcdFx0XCJsYWJlbFwiOiBcImFiY1wiXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRcImZpbGVVcmlcIjogXCJmaWxlOi8vL2hvbWUvdXNlci8uY29uZmlnL2NvZGUtb3NzLWRldi9zdG9yYWdlLmpzb25cIixcblx0XHRcdFx0XHRcImxhYmVsXCI6IFwiZGVmXCJcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH1gO1xuXG5cdFx0Y29uc3Qgd2luZG93c1N0YXRlID0gcmVzdG9yZVJlY2VudGx5T3BlbmVkKEpTT04ucGFyc2UodjFfNTUpLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cdFx0Y29uc3QgZXhwZWN0ZWQ6IElSZWNlbnRseU9wZW5lZCA9IHtcblx0XHRcdGZpbGVzOiBbeyBsYWJlbDogJ2RlZicsIGZpbGVVcmk6IFVSSS5wYXJzZSgnZmlsZTovLy9ob21lL3VzZXIvLmNvbmZpZy9jb2RlLW9zcy1kZXYvc3RvcmFnZS5qc29uJykgfV0sXG5cdFx0XHR3b3Jrc3BhY2VzOiBbXG5cdFx0XHRcdHsgZm9sZGVyVXJpOiBVUkkucGFyc2UoJ2ZvbzovL2Jhci8yMy80MycpLCByZW1vdGVBdXRob3JpdHk6ICd0ZXN0K3Rlc3QnIH0sXG5cdFx0XHRcdHsgd29ya3NwYWNlOiB7IGlkOiAnNTNiNzE0YjQ2ZWYxYTJkNDM0NjU2OGI0ZjU5MTAyOGMnLCBjb25maWdQYXRoOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vaG9tZS91c2VyL3dvcmtzcGFjZXMvdGVzdGluZy9jdXN0b20uY29kZS13b3Jrc3BhY2UnKSB9IH0sXG5cdFx0XHRcdHsgbGFiZWw6ICdhYmMnLCBmb2xkZXJVcmk6IFVSSS5wYXJzZSgnZmlsZTovLy9ob21lL3VzZXIvd29ya3NwYWNlcy90ZXN0aW5nL2ZvbGRpbmcnKSB9XG5cdFx0XHRdXG5cdFx0fTtcblxuXHRcdGFzc2VydEVxdWFsUmVjZW50bHlPcGVuZWQod2luZG93c1N0YXRlLCBleHBlY3RlZCwgJ3YxXzMzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RvU3RvcmVEYXRhIGRyb3BzIGxhYmVsIGlmIGl0IG1hdGNoZXMgcGF0aCcsICgpID0+IHtcblx0XHRjb25zdCBhY3R1YWwgPSB0b1N0b3JlRGF0YSh7XG5cdFx0XHR3b3Jrc3BhY2VzOiBbXSxcblx0XHRcdGZpbGVzOiBbe1xuXHRcdFx0XHRmaWxlVXJpOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vZm9vL2Jhci90ZXN0LnR4dCcpLFxuXHRcdFx0XHRsYWJlbDogJy9mb28vYmFyL3Rlc3QudHh0Jyxcblx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiB1bmRlZmluZWRcblx0XHRcdH1dXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIHtcblx0XHRcdGVudHJpZXM6IFt7XG5cdFx0XHRcdGZpbGVVcmk6ICdmaWxlOi8vL2Zvby9iYXIvdGVzdC50eHQnLFxuXHRcdFx0XHRsYWJlbDogdW5kZWZpbmVkLFxuXHRcdFx0XHRyZW1vdGVBdXRob3JpdHk6IHVuZGVmaW5lZFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGNBQWM7QUFDdkIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsV0FBVztBQUNwQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLHNCQUFzQjtBQUUvQixTQUEyRCxnQkFBZ0IsdUJBQXVCLG1CQUFtQjtBQUVySCxNQUFNLG1CQUFtQixNQUFNO0FBRTlCLFdBQVMsWUFBWSxLQUFnQztBQUNwRCxXQUFPO0FBQUEsTUFDTixJQUFJO0FBQUEsTUFDSixZQUFZO0FBQUEsSUFDYjtBQUFBLEVBQ0Q7QUFDQSxXQUFT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
