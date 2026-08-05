import * as assert from "assert";
import { Emitter } from "../../../../../base/common/event.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { mock, TestStorageService } from "../../../../test/common/workbenchTestServices.js";
import { TestingContinuousRunService } from "../../common/testingContinuousRunService.js";
import { TestRunProfileBitset } from "../../common/testTypes.js";
suite("TestingContinuousRunService", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  let testService;
  let cr;
  const profile1 = { profileId: 1, controllerId: "ctrl", group: TestRunProfileBitset.Run, label: "label", supportsContinuousRun: true, isDefault: false, hasConfigurationHandler: true, tag: null };
  const profile2 = { profileId: 2, controllerId: "ctrl", group: TestRunProfileBitset.Run, label: "label", supportsContinuousRun: true, isDefault: false, hasConfigurationHandler: true, tag: null };
  class MockTestService extends mock() {
    constructor() {
      super(...arguments);
      this.requests = /* @__PURE__ */ new Set();
      this.log = [];
    }
    startContinuousRun(req, token) {
      this.requests.add(req);
      this.log.push(["start", req.targets[0].profileId, req.targets[0].testIds]);
      ds.add(token.onCancellationRequested(() => {
        this.log.push(["stop", req.targets[0].profileId, req.targets[0].testIds]);
        this.requests.delete(req);
      }));
      return Promise.resolve();
    }
  }
  class MockProfilesService extends mock() {
    constructor() {
      super(...arguments);
      this.didChangeEmitter = ds.add(new Emitter());
      this.onDidChange = this.didChangeEmitter.event;
    }
    getGroupDefaultProfiles(group, controllerId) {
      return [];
    }
  }
  setup(() => {
    testService = new MockTestService();
    cr = ds.add(new TestingContinuousRunService(
      testService,
      ds.add(new TestStorageService()),
      ds.add(new MockContextKeyService()),
      new MockProfilesService()
    ));
  });
  test("isSpecificallyEnabledFor", () => {
    assert.strictEqual(cr.isEnabled(), false);
    assert.strictEqual(cr.isSpecificallyEnabledFor("testId"), false);
    cr.start([profile1], "testId\0child");
    assert.strictEqual(cr.isSpecificallyEnabledFor("testId"), false);
    assert.strictEqual(cr.isSpecificallyEnabledFor("testId\0child"), true);
    assert.deepStrictEqual(testService.log, [
      ["start", 1, ["testId\0child"]]
    ]);
  });
  test("isEnabledForAParentOf", () => {
    assert.strictEqual(cr.isEnabled(), false);
    assert.strictEqual(cr.isEnabledForAParentOf("testId"), false);
    cr.start([profile1], "parentTestId\0testId");
    assert.strictEqual(cr.isEnabledForAParentOf("parentTestId"), false);
    assert.strictEqual(cr.isEnabledForAParentOf("parentTestId\0testId"), true);
    assert.strictEqual(cr.isEnabledForAParentOf("parentTestId\0testId\0nestd"), true);
    assert.strictEqual(cr.isEnabled(), true);
    assert.deepStrictEqual(testService.log, [
      ["start", 1, ["parentTestId\0testId"]]
    ]);
  });
  test("isEnabledForAChildOf", () => {
    assert.strictEqual(cr.isEnabled(), false);
    assert.strictEqual(cr.isEnabledForAChildOf("testId"), false);
    cr.start([profile1], "testId\0childTestId");
    assert.strictEqual(cr.isEnabledForAChildOf("testId"), true);
    assert.strictEqual(cr.isEnabledForAChildOf("testId\0childTestId"), true);
    assert.strictEqual(cr.isEnabledForAChildOf("testId\0childTestId\0neested"), false);
    assert.strictEqual(cr.isEnabled(), true);
  });
  suite("lifecycle", () => {
    test("stops general in DFS order", () => {
      cr.start([profile1], "a\0b\0c\0d");
      cr.start([profile1], "a\0b");
      cr.start([profile1], "a\0b\0c");
      cr.stop();
      assert.deepStrictEqual(testService.log, [
        ["start", 1, ["a\0b\0c\0d"]],
        ["start", 1, ["a\0b"]],
        ["start", 1, ["a\0b\0c"]],
        ["stop", 1, ["a\0b\0c\0d"]],
        ["stop", 1, ["a\0b\0c"]],
        ["stop", 1, ["a\0b"]]
      ]);
      assert.strictEqual(cr.isEnabled(), false);
    });
    test("stops profiles in DFS order", () => {
      cr.start([profile1], "a\0b\0c\0d");
      cr.start([profile1], "a\0b");
      cr.start([profile1], "a\0b\0c");
      cr.stopProfile(profile1);
      assert.deepStrictEqual(testService.log, [
        ["start", 1, ["a\0b\0c\0d"]],
        ["start", 1, ["a\0b"]],
        ["start", 1, ["a\0b\0c"]],
        ["stop", 1, ["a\0b\0c\0d"]],
        ["stop", 1, ["a\0b\0c"]],
        ["stop", 1, ["a\0b"]]
      ]);
      assert.strictEqual(cr.isEnabled(), false);
    });
    test("updates profile for a test if profile is changed", () => {
      cr.start([profile1], "parent\0testId");
      cr.start([profile2], "parent\0testId");
      assert.strictEqual(cr.isEnabled(), true);
      cr.stop();
      assert.strictEqual(cr.isEnabled(), false);
      assert.deepStrictEqual(testService.log, [
        ["start", 1, ["parent\0testId"]],
        ["start", 2, ["parent\0testId"]],
        ["stop", 1, ["parent\0testId"]],
        ["stop", 2, ["parent\0testId"]]
      ]);
      assert.strictEqual(cr.isEnabled(), false);
    });
    test("stops a single profile test", () => {
      cr.start([profile1, profile2], "parent\0testId");
      cr.stopProfile(profile1);
      assert.deepStrictEqual(testService.log, [
        ["start", 1, ["parent\0testId"]],
        ["start", 2, ["parent\0testId"]],
        ["stop", 1, ["parent\0testId"]]
      ]);
      assert.strictEqual(cr.isEnabled(), true);
      cr.stopProfile(profile2);
      assert.deepStrictEqual(testService.log, [
        ["start", 1, ["parent\0testId"]],
        ["start", 2, ["parent\0testId"]],
        ["stop", 1, ["parent\0testId"]],
        ["stop", 2, ["parent\0testId"]]
      ]);
      assert.strictEqual(cr.isEnabled(), false);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL3Rlc3QvY29tbW9uL3Rlc3RpbmdDb250aW51b3VzUnVuU2VydmljZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBNb2NrQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL3Rlc3QvY29tbW9uL21vY2tLZXliaW5kaW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBtb2NrLCBUZXN0U3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgSVRlc3RpbmdDb250aW51b3VzUnVuU2VydmljZSwgVGVzdGluZ0NvbnRpbnVvdXNSdW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlc3RpbmdDb250aW51b3VzUnVuU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVzdFByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlc3RQcm9maWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlc3RSdW5Qcm9maWxlLCBSZXNvbHZlZFRlc3RSdW5SZXF1ZXN0LCBUZXN0UnVuUHJvZmlsZUJpdHNldCB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXN0VHlwZXMuanMnO1xuXG5zdWl0ZSgnVGVzdGluZ0NvbnRpbnVvdXNSdW5TZXJ2aWNlJywgKCkgPT4ge1xuXHRjb25zdCBkcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRsZXQgdGVzdFNlcnZpY2U6IE1vY2tUZXN0U2VydmljZTtcblx0bGV0IGNyOiBJVGVzdGluZ0NvbnRpbnVvdXNSdW5TZXJ2aWNlO1xuXG5cdGNvbnN0IHByb2ZpbGUxOiBJVGVzdFJ1blByb2ZpbGUgPSB7IHByb2ZpbGVJZDogMSwgY29udHJvbGxlcklkOiAnY3RybCcsIGdyb3VwOiBUZXN0UnVuUHJvZmlsZUJpdHNldC5SdW4sIGxhYmVsOiAnbGFiZWwnLCBzdXBwb3J0c0NvbnRpbnVvdXNSdW46IHRydWUsIGlzRGVmYXVsdDogZmFsc2UsIGhhc0NvbmZpZ3VyYXRpb25IYW5kbGVyOiB0cnVlLCB0YWc6IG51bGwgfTtcblx0Y29uc3QgcHJvZmlsZTI6IElUZXN0UnVuUHJvZmlsZSA9IHsgcHJvZmlsZUlkOiAyLCBjb250cm9sbGVySWQ6ICdjdHJsJywgZ3JvdXA6IFRlc3RSdW5Qcm9maWxlQml0c2V0LlJ1biwgbGFiZWw6ICdsYWJlbCcsIHN1cHBvcnRzQ29udGludW91c1J1bjogdHJ1ZSwgaXNEZWZhdWx0OiBmYWxzZSwgaGFzQ29uZmlndXJhdGlvbkhhbmRsZXI6IHRydWUsIHRhZzogbnVsbCB9O1xuXG5cdGNsYXNzIE1vY2tUZXN0U2VydmljZSBleHRlbmRzIG1vY2s8SVRlc3RTZXJ2aWNlPigpIHtcblx0XHRwdWJsaWMgcmVxdWVzdHMgPSBuZXcgU2V0PFJlc29sdmVkVGVzdFJ1blJlcXVlc3Q+KCk7XG5cdFx0cHVibGljIGxvZzogW2tpbmQ6ICdzdGFydCcgfCAnc3RvcCcsIHByb2ZpbGVJZDogbnVtYmVyLCB0ZXN0SWRzOiBzdHJpbmdbXV1bXSA9IFtdO1xuXG5cdFx0b3ZlcnJpZGUgc3RhcnRDb250aW51b3VzUnVuKHJlcTogUmVzb2x2ZWRUZXN0UnVuUmVxdWVzdCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHR0aGlzLnJlcXVlc3RzLmFkZChyZXEpO1xuXHRcdFx0dGhpcy5sb2cucHVzaChbJ3N0YXJ0JywgcmVxLnRhcmdldHNbMF0ucHJvZmlsZUlkLCByZXEudGFyZ2V0c1swXS50ZXN0SWRzXSk7XG5cdFx0XHRkcy5hZGQodG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmxvZy5wdXNoKFsnc3RvcCcsIHJlcS50YXJnZXRzWzBdLnByb2ZpbGVJZCwgcmVxLnRhcmdldHNbMF0udGVzdElkc10pO1xuXHRcdFx0XHR0aGlzLnJlcXVlc3RzLmRlbGV0ZShyZXEpO1xuXHRcdFx0fSkpO1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblx0fVxuXG5cdGNsYXNzIE1vY2tQcm9maWxlc1NlcnZpY2UgZXh0ZW5kcyBtb2NrPElUZXN0UHJvZmlsZVNlcnZpY2U+KCkge1xuXHRcdHB1YmxpYyBkaWRDaGFuZ2VFbWl0dGVyID0gZHMuYWRkKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRcdG92ZXJyaWRlIG9uRGlkQ2hhbmdlID0gdGhpcy5kaWRDaGFuZ2VFbWl0dGVyLmV2ZW50O1xuXG5cdFx0b3ZlcnJpZGUgZ2V0R3JvdXBEZWZhdWx0UHJvZmlsZXMoZ3JvdXA6IFRlc3RSdW5Qcm9maWxlQml0c2V0LCBjb250cm9sbGVySWQ/OiBzdHJpbmcpOiBJVGVzdFJ1blByb2ZpbGVbXSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHR9XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdHRlc3RTZXJ2aWNlID0gbmV3IE1vY2tUZXN0U2VydmljZSgpO1xuXHRcdGNyID0gZHMuYWRkKG5ldyBUZXN0aW5nQ29udGludW91c1J1blNlcnZpY2UoXG5cdFx0XHR0ZXN0U2VydmljZSxcblx0XHRcdGRzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpLFxuXHRcdFx0ZHMuYWRkKG5ldyBNb2NrQ29udGV4dEtleVNlcnZpY2UoKSksXG5cdFx0XHRuZXcgTW9ja1Byb2ZpbGVzU2VydmljZSgpLFxuXHRcdCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc1NwZWNpZmljYWxseUVuYWJsZWRGb3InLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyLmlzRW5hYmxlZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyLmlzU3BlY2lmaWNhbGx5RW5hYmxlZEZvcigndGVzdElkJyksIGZhbHNlKTtcblxuXHRcdGNyLnN0YXJ0KFtwcm9maWxlMV0sICd0ZXN0SWRcXDBjaGlsZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjci5pc1NwZWNpZmljYWxseUVuYWJsZWRGb3IoJ3Rlc3RJZCcpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyLmlzU3BlY2lmaWNhbGx5RW5hYmxlZEZvcigndGVzdElkXFwwY2hpbGQnKSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RTZXJ2aWNlLmxvZywgW1xuXHRcdFx0WydzdGFydCcsIDEsIFsndGVzdElkXFwwY2hpbGQnXV0sXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzRW5hYmxlZEZvckFQYXJlbnRPZicsICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3IuaXNFbmFibGVkKCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3IuaXNFbmFibGVkRm9yQVBhcmVudE9mKCd0ZXN0SWQnKSwgZmFsc2UpO1xuXHRcdGNyLnN0YXJ0KFtwcm9maWxlMV0sICdwYXJlbnRUZXN0SWRcXDB0ZXN0SWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3IuaXNFbmFibGVkRm9yQVBhcmVudE9mKCdwYXJlbnRUZXN0SWQnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjci5pc0VuYWJsZWRGb3JBUGFyZW50T2YoJ3BhcmVudFRlc3RJZFxcMHRlc3RJZCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3IuaXNFbmFibGVkRm9yQVBhcmVudE9mKCdwYXJlbnRUZXN0SWRcXDB0ZXN0SWRcXDBuZXN0ZCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3IuaXNFbmFibGVkKCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0U2VydmljZS5sb2csIFtcblx0XHRcdFsnc3RhcnQnLCAxLCBbJ3BhcmVudFRlc3RJZFxcMHRlc3RJZCddXSxcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnaXNFbmFibGVkRm9yQUNoaWxkT2YnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyLmlzRW5hYmxlZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyLmlzRW5hYmxlZEZvckFDaGlsZE9mKCd0ZXN0SWQnKSwgZmFsc2UpO1xuXHRcdGNyLnN0YXJ0KFtwcm9maWxlMV0sICd0ZXN0SWRcXDBjaGlsZFRlc3RJZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjci5pc0VuYWJsZWRGb3JBQ2hpbGRPZigndGVzdElkJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjci5pc0VuYWJsZWRGb3JBQ2hpbGRPZigndGVzdElkXFwwY2hpbGRUZXN0SWQnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyLmlzRW5hYmxlZEZvckFDaGlsZE9mKCd0ZXN0SWRcXDBjaGlsZFRlc3RJZFxcMG5lZXN0ZWQnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjci5pc0VuYWJsZWQoKSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdsaWZlY3ljbGUnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc3RvcHMgZ2VuZXJhbCBpbiBERlMgb3JkZXInLCAoKSA9PiB7XG5cdFx0XHRjci5zdGFydChbcHJvZmlsZTFdLCAnYVxcMGJcXDBjXFwwZCcpO1xuXHRcdFx0Y3Iuc3RhcnQoW3Byb2ZpbGUxXSwgJ2FcXDBiJyk7XG5cdFx0XHRjci5zdGFydChbcHJvZmlsZTFdLCAnYVxcMGJcXDBjJyk7XG5cdFx0XHRjci5zdG9wKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RTZXJ2aWNlLmxvZywgW1xuXHRcdFx0XHRbJ3N0YXJ0JywgMSwgWydhXFwwYlxcMGNcXDBkJ11dLFxuXHRcdFx0XHRbJ3N0YXJ0JywgMSwgWydhXFwwYiddXSxcblx0XHRcdFx0WydzdGFydCcsIDEsIFsnYVxcMGJcXDBjJ11dLFxuXHRcdFx0XHRbJ3N0b3AnLCAxLCBbJ2FcXDBiXFwwY1xcMGQnXV0sXG5cdFx0XHRcdFsnc3RvcCcsIDEsIFsnYVxcMGJcXDBjJ11dLFxuXHRcdFx0XHRbJ3N0b3AnLCAxLCBbJ2FcXDBiJ11dLFxuXHRcdFx0XSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3IuaXNFbmFibGVkKCksIGZhbHNlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3N0b3BzIHByb2ZpbGVzIGluIERGUyBvcmRlcicsICgpID0+IHtcblx0XHRcdGNyLnN0YXJ0KFtwcm9maWxlMV0sICdhXFwwYlxcMGNcXDBkJyk7XG5cdFx0XHRjci5zdGFydChbcHJvZmlsZTFdLCAnYVxcMGInKTtcblx0XHRcdGNyLnN0YXJ0KFtwcm9maWxlMV0sICdhXFwwYlxcMGMnKTtcblx0XHRcdGNyLnN0b3BQcm9maWxlKHByb2ZpbGUxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdFNlcnZpY2UubG9nLCBbXG5cdFx0XHRcdFsnc3RhcnQnLCAxLCBbJ2FcXDBiXFwwY1xcMGQnXV0sXG5cdFx0XHRcdFsnc3RhcnQnLCAxLCBbJ2FcXDBiJ11dLFxuXHRcdFx0XHRbJ3N0YXJ0JywgMSwgWydhXFwwYlxcMGMnXV0sXG5cdFx0XHRcdFsnc3RvcCcsIDEsIFsnYVxcMGJcXDBjXFwwZCddXSxcblx0XHRcdFx0WydzdG9wJywgMSwgWydhXFwwYlxcMGMnXV0sXG5cdFx0XHRcdFsnc3RvcCcsIDEsIFsnYVxcMGInXV0sXG5cdFx0XHRdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjci5pc0VuYWJsZWQoKSwgZmFsc2UpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndXBkYXRlcyBwcm9maWxlIGZvciBhIHRlc3QgaWYgcHJvZmlsZSBpcyBjaGFuZ2VkJywgKCkgPT4ge1xuXHRcdFx0Y3Iuc3RhcnQoW3Byb2ZpbGUxXSwgJ3BhcmVudFxcMHRlc3RJZCcpO1xuXHRcdFx0Y3Iuc3RhcnQoW3Byb2ZpbGUyXSwgJ3BhcmVudFxcMHRlc3RJZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyLmlzRW5hYmxlZCgpLCB0cnVlKTtcblx0XHRcdGNyLnN0b3AoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjci5pc0VuYWJsZWQoKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0U2VydmljZS5sb2csIFtcblx0XHRcdFx0WydzdGFydCcsIDEsIFsncGFyZW50XFwwdGVzdElkJ11dLFxuXHRcdFx0XHRbJ3N0YXJ0JywgMiwgWydwYXJlbnRcXDB0ZXN0SWQnXV0sXG5cdFx0XHRcdFsnc3RvcCcsIDEsIFsncGFyZW50XFwwdGVzdElkJ11dLFxuXHRcdFx0XHRbJ3N0b3AnLCAyLCBbJ3BhcmVudFxcMHRlc3RJZCddXSxcblx0XHRcdF0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyLmlzRW5hYmxlZCgpLCBmYWxzZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzdG9wcyBhIHNpbmdsZSBwcm9maWxlIHRlc3QnLCAoKSA9PiB7XG5cdFx0XHRjci5zdGFydChbcHJvZmlsZTEsIHByb2ZpbGUyXSwgJ3BhcmVudFxcMHRlc3RJZCcpO1xuXHRcdFx0Y3Iuc3RvcFByb2ZpbGUocHJvZmlsZTEpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0U2VydmljZS5sb2csIFtcblx0XHRcdFx0WydzdGFydCcsIDEsIFsncGFyZW50XFwwdGVzdElkJ11dLFxuXHRcdFx0XHRbJ3N0YXJ0JywgMiwgWydwYXJlbnRcXDB0ZXN0SWQnXV0sXG5cdFx0XHRcdFsnc3RvcCcsIDEsIFsncGFyZW50XFwwdGVzdElkJ11dLFxuXHRcdFx0XSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3IuaXNFbmFibGVkKCksIHRydWUpO1xuXG5cdFx0XHRjci5zdG9wUHJvZmlsZShwcm9maWxlMik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RTZXJ2aWNlLmxvZywgW1xuXHRcdFx0XHRbJ3N0YXJ0JywgMSwgWydwYXJlbnRcXDB0ZXN0SWQnXV0sXG5cdFx0XHRcdFsnc3RhcnQnLCAyLCBbJ3BhcmVudFxcMHRlc3RJZCddXSxcblx0XHRcdFx0WydzdG9wJywgMSwgWydwYXJlbnRcXDB0ZXN0SWQnXV0sXG5cdFx0XHRcdFsnc3RvcCcsIDIsIFsncGFyZW50XFwwdGVzdElkJ11dLFxuXHRcdFx0XSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0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
