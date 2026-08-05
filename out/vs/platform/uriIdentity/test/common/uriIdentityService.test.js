import assert from "assert";
import { UriIdentityService } from "../../common/uriIdentityService.js";
import { mock } from "../../../../base/test/common/mock.js";
import { FileSystemProviderCapabilities } from "../../../files/common/files.js";
import { URI } from "../../../../base/common/uri.js";
import { Event } from "../../../../base/common/event.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
suite("URI Identity", function() {
  class FakeFileService extends mock() {
    constructor(data) {
      super();
      this.data = data;
      this.onDidChangeFileSystemProviderCapabilities = Event.None;
      this.onDidChangeFileSystemProviderRegistrations = Event.None;
    }
    hasProvider(uri) {
      return this.data.has(uri.scheme);
    }
    hasCapability(uri, flag) {
      const mask = this.data.get(uri.scheme) ?? 0;
      return Boolean(mask & flag);
    }
  }
  let _service;
  setup(function() {
    _service = new UriIdentityService(new FakeFileService(/* @__PURE__ */ new Map([
      ["bar", FileSystemProviderCapabilities.PathCaseSensitive],
      ["foo", FileSystemProviderCapabilities.None]
    ])));
  });
  teardown(function() {
    _service.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function assertCanonical(input, expected, service = _service) {
    const actual = service.asCanonicalUri(input);
    assert.strictEqual(actual.toString(), expected.toString());
    assert.ok(service.extUri.isEqual(actual, expected));
  }
  test("extUri (isEqual)", function() {
    const a = URI.parse("foo://bar/bang");
    const a1 = URI.parse("foo://bar/BANG");
    const b = URI.parse("bar://bar/bang");
    const b1 = URI.parse("bar://bar/BANG");
    assert.strictEqual(_service.extUri.isEqual(a, a1), true);
    assert.strictEqual(_service.extUri.isEqual(a1, a), true);
    assert.strictEqual(_service.extUri.isEqual(b, b1), false);
    assert.strictEqual(_service.extUri.isEqual(b1, b), false);
  });
  test("asCanonicalUri (casing)", function() {
    const a = URI.parse("foo://bar/bang");
    const a1 = URI.parse("foo://bar/BANG");
    const b = URI.parse("bar://bar/bang");
    const b1 = URI.parse("bar://bar/BANG");
    assertCanonical(a, a);
    assertCanonical(a1, a);
    assertCanonical(b, b);
    assertCanonical(b1, b1);
  });
  test("asCanonicalUri (normalization)", function() {
    const a = URI.parse("foo://bar/bang");
    assertCanonical(a, a);
    assertCanonical(URI.parse("foo://bar/./bang"), a);
    assertCanonical(URI.parse("foo://bar/./bang"), a);
    assertCanonical(URI.parse("foo://bar/./foo/../bang"), a);
  });
  test("asCanonicalUri (keep fragement)", function() {
    const a = URI.parse("foo://bar/bang");
    assertCanonical(a, a);
    assertCanonical(URI.parse("foo://bar/./bang#frag"), a.with({ fragment: "frag" }));
    assertCanonical(URI.parse("foo://bar/./bang#frag"), a.with({ fragment: "frag" }));
    assertCanonical(URI.parse("foo://bar/./bang#frag"), a.with({ fragment: "frag" }));
    assertCanonical(URI.parse("foo://bar/./foo/../bang#frag"), a.with({ fragment: "frag" }));
    const b = URI.parse("foo://bar/bazz#frag");
    assertCanonical(b, b);
    assertCanonical(URI.parse("foo://bar/bazz"), b.with({ fragment: "" }));
    assertCanonical(URI.parse("foo://bar/BAZZ#DDD"), b.with({ fragment: "DDD" }));
  });
  test.skip("[perf] CPU pegged after some builds #194853", function() {
    const n = 100 + 2 ** 16;
    for (let i = 0; i < n; i++) {
      const uri = URI.parse(`foo://bar/${i}`);
      const uri2 = _service.asCanonicalUri(uri);
      assert.ok(uri2);
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91cmlJZGVudGl0eS90ZXN0L2NvbW1vbi91cmlJZGVudGl0eVNlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi91cmlJZGVudGl0eVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbW9jayB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UsIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcyB9IGZyb20gJy4uLy4uLy4uL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxuc3VpdGUoJ1VSSSBJZGVudGl0eScsIGZ1bmN0aW9uICgpIHtcblxuXHRjbGFzcyBGYWtlRmlsZVNlcnZpY2UgZXh0ZW5kcyBtb2NrPElGaWxlU2VydmljZT4oKSB7XG5cblx0XHRvdmVycmlkZSBvbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcyA9IEV2ZW50Lk5vbmU7XG5cdFx0b3ZlcnJpZGUgb25EaWRDaGFuZ2VGaWxlU3lzdGVtUHJvdmlkZXJSZWdpc3RyYXRpb25zID0gRXZlbnQuTm9uZTtcblxuXHRcdGNvbnN0cnVjdG9yKHJlYWRvbmx5IGRhdGE6IE1hcDxzdHJpbmcsIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcz4pIHtcblx0XHRcdHN1cGVyKCk7XG5cdFx0fVxuXHRcdG92ZXJyaWRlIGhhc1Byb3ZpZGVyKHVyaTogVVJJKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kYXRhLmhhcyh1cmkuc2NoZW1lKTtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgaGFzQ2FwYWJpbGl0eSh1cmk6IFVSSSwgZmxhZzogRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzKTogYm9vbGVhbiB7XG5cdFx0XHRjb25zdCBtYXNrID0gdGhpcy5kYXRhLmdldCh1cmkuc2NoZW1lKSA/PyAwO1xuXHRcdFx0cmV0dXJuIEJvb2xlYW4obWFzayAmIGZsYWcpO1xuXHRcdH1cblx0fVxuXG5cdGxldCBfc2VydmljZTogVXJpSWRlbnRpdHlTZXJ2aWNlO1xuXG5cdHNldHVwKGZ1bmN0aW9uICgpIHtcblx0XHRfc2VydmljZSA9IG5ldyBVcmlJZGVudGl0eVNlcnZpY2UobmV3IEZha2VGaWxlU2VydmljZShuZXcgTWFwKFtcblx0XHRcdFsnYmFyJywgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLlBhdGhDYXNlU2Vuc2l0aXZlXSxcblx0XHRcdFsnZm9vJywgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLk5vbmVdXG5cdFx0XSkpKTtcblx0fSk7XG5cblx0dGVhcmRvd24oZnVuY3Rpb24gKCkge1xuXHRcdF9zZXJ2aWNlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gYXNzZXJ0Q2Fub25pY2FsKGlucHV0OiBVUkksIGV4cGVjdGVkOiBVUkksIHNlcnZpY2U6IFVyaUlkZW50aXR5U2VydmljZSA9IF9zZXJ2aWNlKSB7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VydmljZS5hc0Nhbm9uaWNhbFVyaShpbnB1dCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC50b1N0cmluZygpLCBleHBlY3RlZC50b1N0cmluZygpKTtcblx0XHRhc3NlcnQub2soc2VydmljZS5leHRVcmkuaXNFcXVhbChhY3R1YWwsIGV4cGVjdGVkKSk7XG5cdH1cblxuXHR0ZXN0KCdleHRVcmkgKGlzRXF1YWwpJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGEgPSBVUkkucGFyc2UoJ2ZvbzovL2Jhci9iYW5nJyk7XG5cdFx0Y29uc3QgYTEgPSBVUkkucGFyc2UoJ2ZvbzovL2Jhci9CQU5HJyk7XG5cdFx0Y29uc3QgYiA9IFVSSS5wYXJzZSgnYmFyOi8vYmFyL2JhbmcnKTtcblx0XHRjb25zdCBiMSA9IFVSSS5wYXJzZSgnYmFyOi8vYmFyL0JBTkcnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChfc2VydmljZS5leHRVcmkuaXNFcXVhbChhLCBhMSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChfc2VydmljZS5leHRVcmkuaXNFcXVhbChhMSwgYSksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKF9zZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGIsIGIxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChfc2VydmljZS5leHRVcmkuaXNFcXVhbChiMSwgYiksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnYXNDYW5vbmljYWxVcmkgKGNhc2luZyknLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBhID0gVVJJLnBhcnNlKCdmb286Ly9iYXIvYmFuZycpO1xuXHRcdGNvbnN0IGExID0gVVJJLnBhcnNlKCdmb286Ly9iYXIvQkFORycpO1xuXHRcdGNvbnN0IGIgPSBVUkkucGFyc2UoJ2JhcjovL2Jhci9iYW5nJyk7XG5cdFx0Y29uc3QgYjEgPSBVUkkucGFyc2UoJ2JhcjovL2Jhci9CQU5HJyk7XG5cblx0XHRhc3NlcnRDYW5vbmljYWwoYSwgYSk7XG5cdFx0YXNzZXJ0Q2Fub25pY2FsKGExLCBhKTtcblxuXHRcdGFzc2VydENhbm9uaWNhbChiLCBiKTtcblx0XHRhc3NlcnRDYW5vbmljYWwoYjEsIGIxKTsgLy8gY2FzZSBzZW5zaXRpdmVcblx0fSk7XG5cblx0dGVzdCgnYXNDYW5vbmljYWxVcmkgKG5vcm1hbGl6YXRpb24pJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGEgPSBVUkkucGFyc2UoJ2ZvbzovL2Jhci9iYW5nJyk7XG5cdFx0YXNzZXJ0Q2Fub25pY2FsKGEsIGEpO1xuXHRcdGFzc2VydENhbm9uaWNhbChVUkkucGFyc2UoJ2ZvbzovL2Jhci8uL2JhbmcnKSwgYSk7XG5cdFx0YXNzZXJ0Q2Fub25pY2FsKFVSSS5wYXJzZSgnZm9vOi8vYmFyLy4vYmFuZycpLCBhKTtcblx0XHRhc3NlcnRDYW5vbmljYWwoVVJJLnBhcnNlKCdmb286Ly9iYXIvLi9mb28vLi4vYmFuZycpLCBhKTtcblx0fSk7XG5cblx0dGVzdCgnYXNDYW5vbmljYWxVcmkgKGtlZXAgZnJhZ2VtZW50KScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGEgPSBVUkkucGFyc2UoJ2ZvbzovL2Jhci9iYW5nJyk7XG5cblx0XHRhc3NlcnRDYW5vbmljYWwoYSwgYSk7XG5cdFx0YXNzZXJ0Q2Fub25pY2FsKFVSSS5wYXJzZSgnZm9vOi8vYmFyLy4vYmFuZyNmcmFnJyksIGEud2l0aCh7IGZyYWdtZW50OiAnZnJhZycgfSkpO1xuXHRcdGFzc2VydENhbm9uaWNhbChVUkkucGFyc2UoJ2ZvbzovL2Jhci8uL2JhbmcjZnJhZycpLCBhLndpdGgoeyBmcmFnbWVudDogJ2ZyYWcnIH0pKTtcblx0XHRhc3NlcnRDYW5vbmljYWwoVVJJLnBhcnNlKCdmb286Ly9iYXIvLi9iYW5nI2ZyYWcnKSwgYS53aXRoKHsgZnJhZ21lbnQ6ICdmcmFnJyB9KSk7XG5cdFx0YXNzZXJ0Q2Fub25pY2FsKFVSSS5wYXJzZSgnZm9vOi8vYmFyLy4vZm9vLy4uL2JhbmcjZnJhZycpLCBhLndpdGgoeyBmcmFnbWVudDogJ2ZyYWcnIH0pKTtcblxuXHRcdGNvbnN0IGIgPSBVUkkucGFyc2UoJ2ZvbzovL2Jhci9iYXp6I2ZyYWcnKTtcblx0XHRhc3NlcnRDYW5vbmljYWwoYiwgYik7XG5cdFx0YXNzZXJ0Q2Fub25pY2FsKFVSSS5wYXJzZSgnZm9vOi8vYmFyL2JhenonKSwgYi53aXRoKHsgZnJhZ21lbnQ6ICcnIH0pKTtcblx0XHRhc3NlcnRDYW5vbmljYWwoVVJJLnBhcnNlKCdmb286Ly9iYXIvQkFaWiNEREQnKSwgYi53aXRoKHsgZnJhZ21lbnQ6ICdEREQnIH0pKTsgLy8gbG93ZXItY2FzZSBwYXRoLCBidXQgZnJhZ21lbnQgaXMga2VwdFxuXHR9KTtcblxuXHR0ZXN0LnNraXAoJ1twZXJmXSBDUFUgcGVnZ2VkIGFmdGVyIHNvbWUgYnVpbGRzICMxOTQ4NTMnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBuID0gMTAwICsgKDIgKiogMTYpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbjsgaSsrKSB7XG5cdFx0XHRjb25zdCB1cmkgPSBVUkkucGFyc2UoYGZvbzovL2Jhci8ke2l9YCk7XG5cdFx0XHRjb25zdCB1cmkyID0gX3NlcnZpY2UuYXNDYW5vbmljYWxVcmkodXJpKTtcblxuXHRcdFx0YXNzZXJ0Lm9rKHVyaTIpO1xuXHRcdH1cblx0fSk7XG59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
