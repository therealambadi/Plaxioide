import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { MarkerSeverity } from "../../common/markers.js";
import * as markerService from "../../common/markerService.js";
function randomMarkerData(severity = MarkerSeverity.Error) {
  return {
    severity,
    message: Math.random().toString(16),
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 1
  };
}
suite("Marker Service", () => {
  let service;
  teardown(function() {
    service.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("query", () => {
    service = new markerService.MarkerService();
    service.changeAll("far", [{
      resource: URI.parse("file:///c/test/file.cs"),
      marker: randomMarkerData(MarkerSeverity.Error)
    }]);
    assert.strictEqual(service.read().length, 1);
    assert.strictEqual(service.read({ owner: "far" }).length, 1);
    assert.strictEqual(service.read({ resource: URI.parse("file:///c/test/file.cs") }).length, 1);
    assert.strictEqual(service.read({ owner: "far", resource: URI.parse("file:///c/test/file.cs") }).length, 1);
    service.changeAll("boo", [{
      resource: URI.parse("file:///c/test/file.cs"),
      marker: randomMarkerData(MarkerSeverity.Warning)
    }]);
    assert.strictEqual(service.read().length, 2);
    assert.strictEqual(service.read({ owner: "far" }).length, 1);
    assert.strictEqual(service.read({ owner: "boo" }).length, 1);
    assert.strictEqual(service.read({ severities: MarkerSeverity.Error }).length, 1);
    assert.strictEqual(service.read({ severities: MarkerSeverity.Warning }).length, 1);
    assert.strictEqual(service.read({ severities: MarkerSeverity.Hint }).length, 0);
    assert.strictEqual(service.read({ severities: MarkerSeverity.Error | MarkerSeverity.Warning }).length, 2);
  });
  test("changeOne override", () => {
    service = new markerService.MarkerService();
    service.changeOne("far", URI.parse("file:///path/only.cs"), [randomMarkerData()]);
    assert.strictEqual(service.read().length, 1);
    assert.strictEqual(service.read({ owner: "far" }).length, 1);
    service.changeOne("boo", URI.parse("file:///path/only.cs"), [randomMarkerData()]);
    assert.strictEqual(service.read().length, 2);
    assert.strictEqual(service.read({ owner: "far" }).length, 1);
    assert.strictEqual(service.read({ owner: "boo" }).length, 1);
    service.changeOne("far", URI.parse("file:///path/only.cs"), [randomMarkerData(), randomMarkerData()]);
    assert.strictEqual(service.read({ owner: "far" }).length, 2);
    assert.strictEqual(service.read({ owner: "boo" }).length, 1);
  });
  test("changeOne/All clears", () => {
    service = new markerService.MarkerService();
    service.changeOne("far", URI.parse("file:///path/only.cs"), [randomMarkerData()]);
    service.changeOne("boo", URI.parse("file:///path/only.cs"), [randomMarkerData()]);
    assert.strictEqual(service.read({ owner: "far" }).length, 1);
    assert.strictEqual(service.read({ owner: "boo" }).length, 1);
    assert.strictEqual(service.read().length, 2);
    service.changeOne("far", URI.parse("file:///path/only.cs"), []);
    assert.strictEqual(service.read({ owner: "far" }).length, 0);
    assert.strictEqual(service.read({ owner: "boo" }).length, 1);
    assert.strictEqual(service.read().length, 1);
    service.changeAll("boo", []);
    assert.strictEqual(service.read({ owner: "far" }).length, 0);
    assert.strictEqual(service.read({ owner: "boo" }).length, 0);
    assert.strictEqual(service.read().length, 0);
  });
  test("changeAll sends event for cleared", () => {
    service = new markerService.MarkerService();
    service.changeAll("far", [{
      resource: URI.parse("file:///d/path"),
      marker: randomMarkerData()
    }, {
      resource: URI.parse("file:///d/path"),
      marker: randomMarkerData()
    }]);
    assert.strictEqual(service.read({ owner: "far" }).length, 2);
    const d = service.onMarkerChanged((changedResources) => {
      assert.strictEqual(changedResources.length, 1);
      changedResources.forEach((u) => assert.strictEqual(u.toString(), "file:///d/path"));
      assert.strictEqual(service.read({ owner: "far" }).length, 0);
    });
    service.changeAll("far", []);
    d.dispose();
  });
  test("changeAll merges", () => {
    service = new markerService.MarkerService();
    service.changeAll("far", [{
      resource: URI.parse("file:///c/test/file.cs"),
      marker: randomMarkerData()
    }, {
      resource: URI.parse("file:///c/test/file.cs"),
      marker: randomMarkerData()
    }]);
    assert.strictEqual(service.read({ owner: "far" }).length, 2);
  });
  test("changeAll must not break integrety, issue #12635", () => {
    service = new markerService.MarkerService();
    service.changeAll("far", [{
      resource: URI.parse("scheme:path1"),
      marker: randomMarkerData()
    }, {
      resource: URI.parse("scheme:path2"),
      marker: randomMarkerData()
    }]);
    service.changeAll("boo", [{
      resource: URI.parse("scheme:path1"),
      marker: randomMarkerData()
    }]);
    service.changeAll("far", [{
      resource: URI.parse("scheme:path1"),
      marker: randomMarkerData()
    }, {
      resource: URI.parse("scheme:path2"),
      marker: randomMarkerData()
    }]);
    assert.strictEqual(service.read({ owner: "far" }).length, 2);
    assert.strictEqual(service.read({ resource: URI.parse("scheme:path1") }).length, 2);
  });
  test("invalid marker data", () => {
    const data = randomMarkerData();
    service = new markerService.MarkerService();
    data.message = void 0;
    service.changeOne("far", URI.parse("some:uri/path"), [data]);
    assert.strictEqual(service.read({ owner: "far" }).length, 0);
    data.message = null;
    service.changeOne("far", URI.parse("some:uri/path"), [data]);
    assert.strictEqual(service.read({ owner: "far" }).length, 0);
    data.message = "null";
    service.changeOne("far", URI.parse("some:uri/path"), [data]);
    assert.strictEqual(service.read({ owner: "far" }).length, 1);
  });
  test("MapMap#remove returns bad values, https://github.com/microsoft/vscode/issues/13548", () => {
    service = new markerService.MarkerService();
    service.changeOne("o", URI.parse("some:uri/1"), [randomMarkerData()]);
    service.changeOne("o", URI.parse("some:uri/2"), []);
  });
  test("Error code of zero in markers get removed, #31275", function() {
    const data = {
      code: "0",
      startLineNumber: 1,
      startColumn: 2,
      endLineNumber: 1,
      endColumn: 5,
      message: "test",
      severity: 0,
      source: "me"
    };
    service = new markerService.MarkerService();
    service.changeOne("far", URI.parse("some:thing"), [data]);
    const marker = service.read({ resource: URI.parse("some:thing") });
    assert.strictEqual(marker.length, 1);
    assert.strictEqual(marker[0].code, "0");
  });
  test("resource filter hides markers for the filtered resource", () => {
    service = new markerService.MarkerService();
    const resource1 = URI.parse("file:///path/file1.cs");
    const resource2 = URI.parse("file:///path/file2.cs");
    service.changeOne("owner1", resource1, [randomMarkerData()]);
    service.changeOne("owner1", resource2, [randomMarkerData()]);
    assert.strictEqual(service.read().length, 2);
    assert.strictEqual(service.read({ resource: resource1 }).length, 1);
    assert.strictEqual(service.read({ resource: resource2 }).length, 1);
    const filter = service.installResourceFilter(resource1, "Test filter");
    assert.strictEqual(service.read().length, 2);
    assert.strictEqual(service.read({ resource: resource1 }).length, 1);
    assert.strictEqual(service.read({ resource: resource2 }).length, 1);
    filter.dispose();
    assert.strictEqual(service.read().length, 2);
    assert.strictEqual(service.read({ resource: resource1 }).length, 1);
    assert.strictEqual(service.read({ resource: resource2 }).length, 1);
  });
  test("resource filter affects all filter combinations", () => {
    service = new markerService.MarkerService();
    const resource = URI.parse("file:///path/file.cs");
    service.changeOne("owner1", resource, [randomMarkerData(MarkerSeverity.Error)]);
    service.changeOne("owner2", resource, [randomMarkerData(MarkerSeverity.Warning)]);
    assert.strictEqual(service.read().length, 2);
    assert.strictEqual(service.read({ resource }).length, 2);
    assert.strictEqual(service.read({ owner: "owner1" }).length, 1);
    assert.strictEqual(service.read({ owner: "owner2" }).length, 1);
    assert.strictEqual(service.read({ owner: "owner1", resource }).length, 1);
    assert.strictEqual(service.read({ severities: MarkerSeverity.Error }).length, 1);
    assert.strictEqual(service.read({ severities: MarkerSeverity.Warning }).length, 1);
    const filter = service.installResourceFilter(resource, "Filter reason");
    assert.strictEqual(service.read().length, 1);
    assert.strictEqual(service.read({ resource }).length, 1);
    assert.strictEqual(service.read({ owner: "owner1" }).length, 1);
    assert.strictEqual(service.read({ owner: "owner2" }).length, 1);
    const ownerResourceMarkers = service.read({ owner: "owner1", resource });
    assert.strictEqual(ownerResourceMarkers.length, 1);
    assert.strictEqual(ownerResourceMarkers[0].severity, MarkerSeverity.Info);
    assert.strictEqual(ownerResourceMarkers[0].owner, "markersFilter");
    assert.strictEqual(service.read({ severities: MarkerSeverity.Error }).length, 1);
    assert.strictEqual(service.read({ severities: MarkerSeverity.Warning }).length, 1);
    assert.strictEqual(service.read({ severities: MarkerSeverity.Info }).length, 1);
    filter.dispose();
    assert.strictEqual(service.read().length, 2);
  });
  test("multiple filters for same resource are handled correctly", () => {
    service = new markerService.MarkerService();
    const resource = URI.parse("file:///path/file.cs");
    service.changeOne("owner1", resource, [randomMarkerData()]);
    assert.strictEqual(service.read().length, 1);
    assert.strictEqual(service.read({ resource }).length, 1);
    const filter1 = service.installResourceFilter(resource, "First filter");
    const filter2 = service.installResourceFilter(resource, "Second filter");
    assert.strictEqual(service.read().length, 1);
    assert.strictEqual(service.read({ resource }).length, 1);
    filter1.dispose();
    assert.strictEqual(service.read().length, 1);
    assert.strictEqual(service.read({ resource }).length, 1);
    filter2.dispose();
    assert.strictEqual(service.read().length, 1);
    assert.strictEqual(service.read({ resource }).length, 1);
  });
  test("resource filter with reason shows info marker when markers are filtered", () => {
    service = new markerService.MarkerService();
    const resource = URI.parse("file:///path/file.cs");
    service.changeOne("owner1", resource, [
      randomMarkerData(MarkerSeverity.Error),
      randomMarkerData(MarkerSeverity.Warning)
    ]);
    assert.strictEqual(service.read().length, 2);
    assert.strictEqual(service.read({ resource }).length, 2);
    const filterReason = "Test filter reason";
    const filter = service.installResourceFilter(resource, filterReason);
    const markers = service.read({ resource });
    assert.strictEqual(markers.length, 1);
    assert.strictEqual(markers[0].severity, MarkerSeverity.Info);
    assert.ok(markers[0].message.includes(filterReason));
    filter.dispose();
    assert.strictEqual(service.read({ resource }).length, 2);
  });
  test("reading all markers shows info marker for filtered resources", () => {
    service = new markerService.MarkerService();
    const resource1 = URI.parse("file:///path/file1.cs");
    const resource2 = URI.parse("file:///path/file2.cs");
    service.changeOne("owner1", resource1, [randomMarkerData()]);
    service.changeOne("owner1", resource2, [randomMarkerData()]);
    assert.strictEqual(service.read().length, 2);
    const filterReason = "Resource is being edited";
    const filter = service.installResourceFilter(resource1, filterReason);
    const allMarkers = service.read();
    assert.strictEqual(allMarkers.length, 2);
    const infoMarker = allMarkers.find(
      (marker) => marker.owner === "markersFilter" && marker.severity === MarkerSeverity.Info
    );
    assert.ok(infoMarker);
    assert.strictEqual(infoMarker?.resource.toString(), resource1.toString());
    assert.ok(infoMarker?.message.includes(filterReason));
    filter.dispose();
  });
  test("out of order filter disposal works correctly", () => {
    service = new markerService.MarkerService();
    const resource = URI.parse("file:///path/file.cs");
    service.changeOne("owner1", resource, [randomMarkerData()]);
    assert.strictEqual(service.read().length, 1);
    assert.strictEqual(service.read({ resource }).length, 1);
    const filter1 = service.installResourceFilter(resource, "First filter");
    const filter2 = service.installResourceFilter(resource, "Second filter");
    const filter3 = service.installResourceFilter(resource, "Third filter");
    assert.strictEqual(service.read().length, 1);
    assert.strictEqual(service.read({ resource }).length, 1);
    filter2.dispose();
    assert.strictEqual(service.read().length, 1);
    assert.strictEqual(service.read({ resource }).length, 1);
    const markers = service.read({ resource });
    assert.ok(markers[0].message.includes("Problems are paused because"));
    filter3.dispose();
    filter1.dispose();
    assert.strictEqual(service.read().length, 1);
    assert.strictEqual(service.read({ resource }).length, 1);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9tYXJrZXJzL3Rlc3QvY29tbW9uL21hcmtlclNlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElNYXJrZXJEYXRhLCBNYXJrZXJTZXZlcml0eSB9IGZyb20gJy4uLy4uL2NvbW1vbi9tYXJrZXJzLmpzJztcbmltcG9ydCAqIGFzIG1hcmtlclNlcnZpY2UgZnJvbSAnLi4vLi4vY29tbW9uL21hcmtlclNlcnZpY2UuanMnO1xuXG5mdW5jdGlvbiByYW5kb21NYXJrZXJEYXRhKHNldmVyaXR5ID0gTWFya2VyU2V2ZXJpdHkuRXJyb3IpOiBJTWFya2VyRGF0YSB7XG5cdHJldHVybiB7XG5cdFx0c2V2ZXJpdHksXG5cdFx0bWVzc2FnZTogTWF0aC5yYW5kb20oKS50b1N0cmluZygxNiksXG5cdFx0c3RhcnRMaW5lTnVtYmVyOiAxLFxuXHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdGVuZExpbmVOdW1iZXI6IDEsXG5cdFx0ZW5kQ29sdW1uOiAxXG5cdH07XG59XG5cbnN1aXRlKCdNYXJrZXIgU2VydmljZScsICgpID0+IHtcblxuXHRsZXQgc2VydmljZTogbWFya2VyU2VydmljZS5NYXJrZXJTZXJ2aWNlO1xuXG5cdHRlYXJkb3duKGZ1bmN0aW9uICgpIHtcblx0XHRzZXJ2aWNlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgncXVlcnknLCAoKSA9PiB7XG5cblx0XHRzZXJ2aWNlID0gbmV3IG1hcmtlclNlcnZpY2UuTWFya2VyU2VydmljZSgpO1xuXG5cdFx0c2VydmljZS5jaGFuZ2VBbGwoJ2ZhcicsIFt7XG5cdFx0XHRyZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL2MvdGVzdC9maWxlLmNzJyksXG5cdFx0XHRtYXJrZXI6IHJhbmRvbU1hcmtlckRhdGEoTWFya2VyU2V2ZXJpdHkuRXJyb3IpXG5cdFx0fV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCgpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IG93bmVyOiAnZmFyJyB9KS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL2MvdGVzdC9maWxlLmNzJykgfSkubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdmYXInLCByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL2MvdGVzdC9maWxlLmNzJykgfSkubGVuZ3RoLCAxKTtcblxuXG5cdFx0c2VydmljZS5jaGFuZ2VBbGwoJ2JvbycsIFt7XG5cdFx0XHRyZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL2MvdGVzdC9maWxlLmNzJyksXG5cdFx0XHRtYXJrZXI6IHJhbmRvbU1hcmtlckRhdGEoTWFya2VyU2V2ZXJpdHkuV2FybmluZylcblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKCkubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdmYXInIH0pLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IG93bmVyOiAnYm9vJyB9KS5sZW5ndGgsIDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IHNldmVyaXRpZXM6IE1hcmtlclNldmVyaXR5LkVycm9yIH0pLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IHNldmVyaXRpZXM6IE1hcmtlclNldmVyaXR5Lldhcm5pbmcgfSkubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgc2V2ZXJpdGllczogTWFya2VyU2V2ZXJpdHkuSGludCB9KS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyBzZXZlcml0aWVzOiBNYXJrZXJTZXZlcml0eS5FcnJvciB8IE1hcmtlclNldmVyaXR5Lldhcm5pbmcgfSkubGVuZ3RoLCAyKTtcblxuXHR9KTtcblxuXG5cdHRlc3QoJ2NoYW5nZU9uZSBvdmVycmlkZScsICgpID0+IHtcblxuXHRcdHNlcnZpY2UgPSBuZXcgbWFya2VyU2VydmljZS5NYXJrZXJTZXJ2aWNlKCk7XG5cdFx0c2VydmljZS5jaGFuZ2VPbmUoJ2ZhcicsIFVSSS5wYXJzZSgnZmlsZTovLy9wYXRoL29ubHkuY3MnKSwgW3JhbmRvbU1hcmtlckRhdGEoKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoKS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyBvd25lcjogJ2ZhcicgfSkubGVuZ3RoLCAxKTtcblxuXHRcdHNlcnZpY2UuY2hhbmdlT25lKCdib28nLCBVUkkucGFyc2UoJ2ZpbGU6Ly8vcGF0aC9vbmx5LmNzJyksIFtyYW5kb21NYXJrZXJEYXRhKCldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKCkubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdmYXInIH0pLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IG93bmVyOiAnYm9vJyB9KS5sZW5ndGgsIDEpO1xuXG5cdFx0c2VydmljZS5jaGFuZ2VPbmUoJ2ZhcicsIFVSSS5wYXJzZSgnZmlsZTovLy9wYXRoL29ubHkuY3MnKSwgW3JhbmRvbU1hcmtlckRhdGEoKSwgcmFuZG9tTWFya2VyRGF0YSgpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IG93bmVyOiAnZmFyJyB9KS5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyBvd25lcjogJ2JvbycgfSkubGVuZ3RoLCAxKTtcblxuXHR9KTtcblxuXHR0ZXN0KCdjaGFuZ2VPbmUvQWxsIGNsZWFycycsICgpID0+IHtcblxuXHRcdHNlcnZpY2UgPSBuZXcgbWFya2VyU2VydmljZS5NYXJrZXJTZXJ2aWNlKCk7XG5cdFx0c2VydmljZS5jaGFuZ2VPbmUoJ2ZhcicsIFVSSS5wYXJzZSgnZmlsZTovLy9wYXRoL29ubHkuY3MnKSwgW3JhbmRvbU1hcmtlckRhdGEoKV0pO1xuXHRcdHNlcnZpY2UuY2hhbmdlT25lKCdib28nLCBVUkkucGFyc2UoJ2ZpbGU6Ly8vcGF0aC9vbmx5LmNzJyksIFtyYW5kb21NYXJrZXJEYXRhKCldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdmYXInIH0pLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IG93bmVyOiAnYm9vJyB9KS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoKS5sZW5ndGgsIDIpO1xuXG5cdFx0c2VydmljZS5jaGFuZ2VPbmUoJ2ZhcicsIFVSSS5wYXJzZSgnZmlsZTovLy9wYXRoL29ubHkuY3MnKSwgW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyBvd25lcjogJ2ZhcicgfSkubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdib28nIH0pLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCgpLmxlbmd0aCwgMSk7XG5cblx0XHRzZXJ2aWNlLmNoYW5nZUFsbCgnYm9vJywgW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyBvd25lcjogJ2ZhcicgfSkubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdib28nIH0pLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCgpLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NoYW5nZUFsbCBzZW5kcyBldmVudCBmb3IgY2xlYXJlZCcsICgpID0+IHtcblxuXHRcdHNlcnZpY2UgPSBuZXcgbWFya2VyU2VydmljZS5NYXJrZXJTZXJ2aWNlKCk7XG5cdFx0c2VydmljZS5jaGFuZ2VBbGwoJ2ZhcicsIFt7XG5cdFx0XHRyZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL2QvcGF0aCcpLFxuXHRcdFx0bWFya2VyOiByYW5kb21NYXJrZXJEYXRhKClcblx0XHR9LCB7XG5cdFx0XHRyZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vL2QvcGF0aCcpLFxuXHRcdFx0bWFya2VyOiByYW5kb21NYXJrZXJEYXRhKClcblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdmYXInIH0pLmxlbmd0aCwgMik7XG5cblx0XHRjb25zdCBkID0gc2VydmljZS5vbk1hcmtlckNoYW5nZWQoY2hhbmdlZFJlc291cmNlcyA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hhbmdlZFJlc291cmNlcy5sZW5ndGgsIDEpO1xuXHRcdFx0Y2hhbmdlZFJlc291cmNlcy5mb3JFYWNoKHUgPT4gYXNzZXJ0LnN0cmljdEVxdWFsKHUudG9TdHJpbmcoKSwgJ2ZpbGU6Ly8vZC9wYXRoJykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IG93bmVyOiAnZmFyJyB9KS5sZW5ndGgsIDApO1xuXHRcdH0pO1xuXG5cdFx0c2VydmljZS5jaGFuZ2VBbGwoJ2ZhcicsIFtdKTtcblxuXHRcdGQuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdjaGFuZ2VBbGwgbWVyZ2VzJywgKCkgPT4ge1xuXHRcdHNlcnZpY2UgPSBuZXcgbWFya2VyU2VydmljZS5NYXJrZXJTZXJ2aWNlKCk7XG5cblx0XHRzZXJ2aWNlLmNoYW5nZUFsbCgnZmFyJywgW3tcblx0XHRcdHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly8vYy90ZXN0L2ZpbGUuY3MnKSxcblx0XHRcdG1hcmtlcjogcmFuZG9tTWFya2VyRGF0YSgpXG5cdFx0fSwge1xuXHRcdFx0cmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovLy9jL3Rlc3QvZmlsZS5jcycpLFxuXHRcdFx0bWFya2VyOiByYW5kb21NYXJrZXJEYXRhKClcblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdmYXInIH0pLmxlbmd0aCwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ2NoYW5nZUFsbCBtdXN0IG5vdCBicmVhayBpbnRlZ3JldHksIGlzc3VlICMxMjYzNScsICgpID0+IHtcblx0XHRzZXJ2aWNlID0gbmV3IG1hcmtlclNlcnZpY2UuTWFya2VyU2VydmljZSgpO1xuXG5cdFx0c2VydmljZS5jaGFuZ2VBbGwoJ2ZhcicsIFt7XG5cdFx0XHRyZXNvdXJjZTogVVJJLnBhcnNlKCdzY2hlbWU6cGF0aDEnKSxcblx0XHRcdG1hcmtlcjogcmFuZG9tTWFya2VyRGF0YSgpXG5cdFx0fSwge1xuXHRcdFx0cmVzb3VyY2U6IFVSSS5wYXJzZSgnc2NoZW1lOnBhdGgyJyksXG5cdFx0XHRtYXJrZXI6IHJhbmRvbU1hcmtlckRhdGEoKVxuXHRcdH1dKTtcblxuXHRcdHNlcnZpY2UuY2hhbmdlQWxsKCdib28nLCBbe1xuXHRcdFx0cmVzb3VyY2U6IFVSSS5wYXJzZSgnc2NoZW1lOnBhdGgxJyksXG5cdFx0XHRtYXJrZXI6IHJhbmRvbU1hcmtlckRhdGEoKVxuXHRcdH1dKTtcblxuXHRcdHNlcnZpY2UuY2hhbmdlQWxsKCdmYXInLCBbe1xuXHRcdFx0cmVzb3VyY2U6IFVSSS5wYXJzZSgnc2NoZW1lOnBhdGgxJyksXG5cdFx0XHRtYXJrZXI6IHJhbmRvbU1hcmtlckRhdGEoKVxuXHRcdH0sIHtcblx0XHRcdHJlc291cmNlOiBVUkkucGFyc2UoJ3NjaGVtZTpwYXRoMicpLFxuXHRcdFx0bWFya2VyOiByYW5kb21NYXJrZXJEYXRhKClcblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdmYXInIH0pLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IHJlc291cmNlOiBVUkkucGFyc2UoJ3NjaGVtZTpwYXRoMScpIH0pLmxlbmd0aCwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ2ludmFsaWQgbWFya2VyIGRhdGEnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBkYXRhID0gcmFuZG9tTWFya2VyRGF0YSgpO1xuXHRcdHNlcnZpY2UgPSBuZXcgbWFya2VyU2VydmljZS5NYXJrZXJTZXJ2aWNlKCk7XG5cblx0XHRkYXRhLm1lc3NhZ2UgPSB1bmRlZmluZWQhO1xuXHRcdHNlcnZpY2UuY2hhbmdlT25lKCdmYXInLCBVUkkucGFyc2UoJ3NvbWU6dXJpL3BhdGgnKSwgW2RhdGFdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdmYXInIH0pLmxlbmd0aCwgMCk7XG5cblx0XHRkYXRhLm1lc3NhZ2UgPSBudWxsITtcblx0XHRzZXJ2aWNlLmNoYW5nZU9uZSgnZmFyJywgVVJJLnBhcnNlKCdzb21lOnVyaS9wYXRoJyksIFtkYXRhXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IG93bmVyOiAnZmFyJyB9KS5sZW5ndGgsIDApO1xuXG5cdFx0ZGF0YS5tZXNzYWdlID0gJ251bGwnO1xuXHRcdHNlcnZpY2UuY2hhbmdlT25lKCdmYXInLCBVUkkucGFyc2UoJ3NvbWU6dXJpL3BhdGgnKSwgW2RhdGFdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdmYXInIH0pLmxlbmd0aCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ01hcE1hcCNyZW1vdmUgcmV0dXJucyBiYWQgdmFsdWVzLCBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTM1NDgnLCAoKSA9PiB7XG5cdFx0c2VydmljZSA9IG5ldyBtYXJrZXJTZXJ2aWNlLk1hcmtlclNlcnZpY2UoKTtcblxuXHRcdHNlcnZpY2UuY2hhbmdlT25lKCdvJywgVVJJLnBhcnNlKCdzb21lOnVyaS8xJyksIFtyYW5kb21NYXJrZXJEYXRhKCldKTtcblx0XHRzZXJ2aWNlLmNoYW5nZU9uZSgnbycsIFVSSS5wYXJzZSgnc29tZTp1cmkvMicpLCBbXSk7XG5cblx0fSk7XG5cblx0dGVzdCgnRXJyb3IgY29kZSBvZiB6ZXJvIGluIG1hcmtlcnMgZ2V0IHJlbW92ZWQsICMzMTI3NScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBkYXRhID0gPElNYXJrZXJEYXRhPntcblx0XHRcdGNvZGU6ICcwJyxcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSxcblx0XHRcdHN0YXJ0Q29sdW1uOiAyLFxuXHRcdFx0ZW5kTGluZU51bWJlcjogMSxcblx0XHRcdGVuZENvbHVtbjogNSxcblx0XHRcdG1lc3NhZ2U6ICd0ZXN0Jyxcblx0XHRcdHNldmVyaXR5OiAwIGFzIE1hcmtlclNldmVyaXR5LFxuXHRcdFx0c291cmNlOiAnbWUnXG5cdFx0fTtcblx0XHRzZXJ2aWNlID0gbmV3IG1hcmtlclNlcnZpY2UuTWFya2VyU2VydmljZSgpO1xuXG5cdFx0c2VydmljZS5jaGFuZ2VPbmUoJ2ZhcicsIFVSSS5wYXJzZSgnc29tZTp0aGluZycpLCBbZGF0YV0pO1xuXHRcdGNvbnN0IG1hcmtlciA9IHNlcnZpY2UucmVhZCh7IHJlc291cmNlOiBVUkkucGFyc2UoJ3NvbWU6dGhpbmcnKSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXJrZXIubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFya2VyWzBdLmNvZGUsICcwJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc291cmNlIGZpbHRlciBoaWRlcyBtYXJrZXJzIGZvciB0aGUgZmlsdGVyZWQgcmVzb3VyY2UnLCAoKSA9PiB7XG5cdFx0c2VydmljZSA9IG5ldyBtYXJrZXJTZXJ2aWNlLk1hcmtlclNlcnZpY2UoKTtcblx0XHRjb25zdCByZXNvdXJjZTEgPSBVUkkucGFyc2UoJ2ZpbGU6Ly8vcGF0aC9maWxlMS5jcycpO1xuXHRcdGNvbnN0IHJlc291cmNlMiA9IFVSSS5wYXJzZSgnZmlsZTovLy9wYXRoL2ZpbGUyLmNzJyk7XG5cblx0XHQvLyBBZGQgbWFya2VycyB0byBib3RoIHJlc291cmNlc1xuXHRcdHNlcnZpY2UuY2hhbmdlT25lKCdvd25lcjEnLCByZXNvdXJjZTEsIFtyYW5kb21NYXJrZXJEYXRhKCldKTtcblx0XHRzZXJ2aWNlLmNoYW5nZU9uZSgnb3duZXIxJywgcmVzb3VyY2UyLCBbcmFuZG9tTWFya2VyRGF0YSgpXSk7XG5cblx0XHQvLyBWZXJpZnkgYm90aCByZXNvdXJjZXMgaGF2ZSBtYXJrZXJzXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCgpLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IHJlc291cmNlOiByZXNvdXJjZTEgfSkubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgcmVzb3VyY2U6IHJlc291cmNlMiB9KS5sZW5ndGgsIDEpO1xuXG5cdFx0Ly8gSW5zdGFsbCBmaWx0ZXIgZm9yIHJlc291cmNlMVxuXHRcdGNvbnN0IGZpbHRlciA9IHNlcnZpY2UuaW5zdGFsbFJlc291cmNlRmlsdGVyKHJlc291cmNlMSwgJ1Rlc3QgZmlsdGVyJyk7XG5cblx0XHQvLyBWZXJpZnkgcmVzb3VyY2UxIG1hcmtlcnMgYXJlIGZpbHRlcmVkIG91dCwgYnV0IGhhdmUgMSBpbmZvIG1hcmtlciBpbnN0ZWFkXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCgpLmxlbmd0aCwgMik7IC8vIDEgcmVhbCArIDEgaW5mb1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyByZXNvdXJjZTogcmVzb3VyY2UxIH0pLmxlbmd0aCwgMSk7IC8vIDEgaW5mb1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyByZXNvdXJjZTogcmVzb3VyY2UyIH0pLmxlbmd0aCwgMSk7XG5cblx0XHQvLyBEaXNwb3NlIGZpbHRlclxuXHRcdGZpbHRlci5kaXNwb3NlKCk7XG5cblx0XHQvLyBWZXJpZnkgcmVzb3VyY2UxIG1hcmtlcnMgYXJlIHZpc2libGUgYWdhaW5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKCkubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgcmVzb3VyY2U6IHJlc291cmNlMSB9KS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyByZXNvdXJjZTogcmVzb3VyY2UyIH0pLmxlbmd0aCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc291cmNlIGZpbHRlciBhZmZlY3RzIGFsbCBmaWx0ZXIgY29tYmluYXRpb25zJywgKCkgPT4ge1xuXHRcdHNlcnZpY2UgPSBuZXcgbWFya2VyU2VydmljZS5NYXJrZXJTZXJ2aWNlKCk7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkucGFyc2UoJ2ZpbGU6Ly8vcGF0aC9maWxlLmNzJyk7XG5cblx0XHRzZXJ2aWNlLmNoYW5nZU9uZSgnb3duZXIxJywgcmVzb3VyY2UsIFtyYW5kb21NYXJrZXJEYXRhKE1hcmtlclNldmVyaXR5LkVycm9yKV0pO1xuXHRcdHNlcnZpY2UuY2hhbmdlT25lKCdvd25lcjInLCByZXNvdXJjZSwgW3JhbmRvbU1hcmtlckRhdGEoTWFya2VyU2V2ZXJpdHkuV2FybmluZyldKTtcblxuXHRcdC8vIFZlcmlmeSBpbml0aWFsIHN0YXRlXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCgpLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IHJlc291cmNlIH0pLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IG93bmVyOiAnb3duZXIxJyB9KS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyBvd25lcjogJ293bmVyMicgfSkubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdvd25lcjEnLCByZXNvdXJjZSB9KS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyBzZXZlcml0aWVzOiBNYXJrZXJTZXZlcml0eS5FcnJvciB9KS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyBzZXZlcml0aWVzOiBNYXJrZXJTZXZlcml0eS5XYXJuaW5nIH0pLmxlbmd0aCwgMSk7XG5cblx0XHQvLyBJbnN0YWxsIGZpbHRlclxuXHRcdGNvbnN0IGZpbHRlciA9IHNlcnZpY2UuaW5zdGFsbFJlc291cmNlRmlsdGVyKHJlc291cmNlLCAnRmlsdGVyIHJlYXNvbicpO1xuXG5cdFx0Ly8gVmVyaWZ5IGluZm9ybWF0aW9uIG1hcmtlciBpcyBzaG93biBmb3IgcmVzb3VyY2UgcXVlcmllc1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoKS5sZW5ndGgsIDEpOyAvLyAxIGluZm8gbWFya2VyXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IHJlc291cmNlIH0pLmxlbmd0aCwgMSk7IC8vIDEgaW5mbyBtYXJrZXJcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdvd25lcjEnIH0pLmxlbmd0aCwgMSk7IC8vIDEgaW5mbyBtYXJrZXJcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgb3duZXI6ICdvd25lcjInIH0pLmxlbmd0aCwgMSk7IC8vIDEgaW5mbyBtYXJrZXJcblxuXHRcdC8vIFZlcmlmeSBvd25lcityZXNvdXJjZSBxdWVyeSByZXR1cm5zIGFuIGluZm8gbWFya2VyIGZvciBmaWx0ZXJlZCByZXNvdXJjZXNcblx0XHRjb25zdCBvd25lclJlc291cmNlTWFya2VycyA9IHNlcnZpY2UucmVhZCh7IG93bmVyOiAnb3duZXIxJywgcmVzb3VyY2UgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG93bmVyUmVzb3VyY2VNYXJrZXJzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG93bmVyUmVzb3VyY2VNYXJrZXJzWzBdLnNldmVyaXR5LCBNYXJrZXJTZXZlcml0eS5JbmZvKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3duZXJSZXNvdXJjZU1hcmtlcnNbMF0ub3duZXIsICdtYXJrZXJzRmlsdGVyJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgc2V2ZXJpdGllczogTWFya2VyU2V2ZXJpdHkuRXJyb3IgfSkubGVuZ3RoLCAxKTsgLy8gMSBpbmZvIG1hcmtlclxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyBzZXZlcml0aWVzOiBNYXJrZXJTZXZlcml0eS5XYXJuaW5nIH0pLmxlbmd0aCwgMSk7IC8vIDEgaW5mbyBtYXJrZXJcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgc2V2ZXJpdGllczogTWFya2VyU2V2ZXJpdHkuSW5mbyB9KS5sZW5ndGgsIDEpOyAvLyBPdXIgaW5mbyBtYXJrZXJcblxuXHRcdC8vIFJlbW92ZSBmaWx0ZXIgYW5kIHZlcmlmeSBtYXJrZXJzIGFyZSB2aXNpYmxlIGFnYWluXG5cdFx0ZmlsdGVyLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKCkubGVuZ3RoLCAyKTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlwbGUgZmlsdGVycyBmb3Igc2FtZSByZXNvdXJjZSBhcmUgaGFuZGxlZCBjb3JyZWN0bHknLCAoKSA9PiB7XG5cdFx0c2VydmljZSA9IG5ldyBtYXJrZXJTZXJ2aWNlLk1hcmtlclNlcnZpY2UoKTtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5wYXJzZSgnZmlsZTovLy9wYXRoL2ZpbGUuY3MnKTtcblxuXHRcdC8vIEFkZCBtYXJrZXIgdG8gcmVzb3VyY2Vcblx0XHRzZXJ2aWNlLmNoYW5nZU9uZSgnb3duZXIxJywgcmVzb3VyY2UsIFtyYW5kb21NYXJrZXJEYXRhKCldKTtcblxuXHRcdC8vIFZlcmlmeSByZXNvdXJjZSBoYXMgbWFya2Vyc1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoKS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyByZXNvdXJjZSB9KS5sZW5ndGgsIDEpO1xuXG5cdFx0Ly8gSW5zdGFsbCB0d28gZmlsdGVycyBmb3IgdGhlIHNhbWUgcmVzb3VyY2Vcblx0XHRjb25zdCBmaWx0ZXIxID0gc2VydmljZS5pbnN0YWxsUmVzb3VyY2VGaWx0ZXIocmVzb3VyY2UsICdGaXJzdCBmaWx0ZXInKTtcblx0XHRjb25zdCBmaWx0ZXIyID0gc2VydmljZS5pbnN0YWxsUmVzb3VyY2VGaWx0ZXIocmVzb3VyY2UsICdTZWNvbmQgZmlsdGVyJyk7XG5cblx0XHQvLyBWZXJpZnkgcmVzb3VyY2UgbWFya2VycyBhcmUgZmlsdGVyZWQgb3V0IGJ1dCBpbmZvIG1hcmtlciBpcyBzaG93blxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoKS5sZW5ndGgsIDEpOyAvLyAxIGluZm8gbWFya2VyXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IHJlc291cmNlIH0pLmxlbmd0aCwgMSk7IC8vIDEgaW5mbyBtYXJrZXJcblxuXHRcdC8vIERpc3Bvc2Ugb25seSBvbmUgZmlsdGVyXG5cdFx0ZmlsdGVyMS5kaXNwb3NlKCk7XG5cblx0XHQvLyBWZXJpZnkgcmVzb3VyY2UgbWFya2VycyBhcmUgc3RpbGwgZmlsdGVyZWQgb3V0IGJlY2F1c2Ugb25lIGZpbHRlciByZW1haW5zXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCgpLmxlbmd0aCwgMSk7IC8vIHN0aWxsIDEgaW5mbyBtYXJrZXJcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgcmVzb3VyY2UgfSkubGVuZ3RoLCAxKTsgLy8gc3RpbGwgMSBpbmZvIG1hcmtlclxuXG5cdFx0Ly8gRGlzcG9zZSB0aGUgc2Vjb25kIGZpbHRlclxuXHRcdGZpbHRlcjIuZGlzcG9zZSgpO1xuXG5cdFx0Ly8gTm93IGFsbCBmaWx0ZXJzIGFyZSBnb25lLCBzbyBtYXJrZXJzIHNob3VsZCBiZSB2aXNpYmxlIGFnYWluXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCgpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IHJlc291cmNlIH0pLmxlbmd0aCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc291cmNlIGZpbHRlciB3aXRoIHJlYXNvbiBzaG93cyBpbmZvIG1hcmtlciB3aGVuIG1hcmtlcnMgYXJlIGZpbHRlcmVkJywgKCkgPT4ge1xuXHRcdHNlcnZpY2UgPSBuZXcgbWFya2VyU2VydmljZS5NYXJrZXJTZXJ2aWNlKCk7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkucGFyc2UoJ2ZpbGU6Ly8vcGF0aC9maWxlLmNzJyk7XG5cblx0XHQvLyBBZGQgZXJyb3IgYW5kIHdhcm5pbmcgdG8gdGhlIHJlc291cmNlXG5cdFx0c2VydmljZS5jaGFuZ2VPbmUoJ293bmVyMScsIHJlc291cmNlLCBbXG5cdFx0XHRyYW5kb21NYXJrZXJEYXRhKE1hcmtlclNldmVyaXR5LkVycm9yKSxcblx0XHRcdHJhbmRvbU1hcmtlckRhdGEoTWFya2VyU2V2ZXJpdHkuV2FybmluZylcblx0XHRdKTtcblxuXHRcdC8vIFZlcmlmeSBpbml0aWFsIHN0YXRlXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCgpLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IHJlc291cmNlIH0pLmxlbmd0aCwgMik7XG5cblx0XHQvLyBBcHBseSBhIGZpbHRlciB3aXRoIHJlYXNvblxuXHRcdGNvbnN0IGZpbHRlclJlYXNvbiA9ICdUZXN0IGZpbHRlciByZWFzb24nO1xuXHRcdGNvbnN0IGZpbHRlciA9IHNlcnZpY2UuaW5zdGFsbFJlc291cmNlRmlsdGVyKHJlc291cmNlLCBmaWx0ZXJSZWFzb24pO1xuXG5cdFx0Ly8gVmVyaWZ5IHRoYXQgd2UgZ2V0IGEgc2luZ2xlIGluZm8gbWFya2VyIHdpdGggb3VyIHJlYXNvblxuXHRcdGNvbnN0IG1hcmtlcnMgPSBzZXJ2aWNlLnJlYWQoeyByZXNvdXJjZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFya2Vycy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXJrZXJzWzBdLnNldmVyaXR5LCBNYXJrZXJTZXZlcml0eS5JbmZvKTtcblx0XHRhc3NlcnQub2sobWFya2Vyc1swXS5tZXNzYWdlLmluY2x1ZGVzKGZpbHRlclJlYXNvbikpO1xuXG5cdFx0Ly8gUmVtb3ZlIGZpbHRlciBhbmQgdmVyaWZ5IHRoZSBvcmlnaW5hbCBtYXJrZXJzIGFyZSBiYWNrXG5cdFx0ZmlsdGVyLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgcmVzb3VyY2UgfSkubGVuZ3RoLCAyKTtcblx0fSk7XG5cblx0dGVzdCgncmVhZGluZyBhbGwgbWFya2VycyBzaG93cyBpbmZvIG1hcmtlciBmb3IgZmlsdGVyZWQgcmVzb3VyY2VzJywgKCkgPT4ge1xuXHRcdHNlcnZpY2UgPSBuZXcgbWFya2VyU2VydmljZS5NYXJrZXJTZXJ2aWNlKCk7XG5cdFx0Y29uc3QgcmVzb3VyY2UxID0gVVJJLnBhcnNlKCdmaWxlOi8vL3BhdGgvZmlsZTEuY3MnKTtcblx0XHRjb25zdCByZXNvdXJjZTIgPSBVUkkucGFyc2UoJ2ZpbGU6Ly8vcGF0aC9maWxlMi5jcycpO1xuXG5cdFx0Ly8gQWRkIG1hcmtlcnMgdG8gYm90aCByZXNvdXJjZXNcblx0XHRzZXJ2aWNlLmNoYW5nZU9uZSgnb3duZXIxJywgcmVzb3VyY2UxLCBbcmFuZG9tTWFya2VyRGF0YSgpXSk7XG5cdFx0c2VydmljZS5jaGFuZ2VPbmUoJ293bmVyMScsIHJlc291cmNlMiwgW3JhbmRvbU1hcmtlckRhdGEoKV0pO1xuXG5cdFx0Ly8gVmVyaWZ5IGluaXRpYWwgc3RhdGVcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKCkubGVuZ3RoLCAyKTtcblxuXHRcdC8vIEZpbHRlciBvbmUgcmVzb3VyY2Ugd2l0aCBhIHJlYXNvblxuXHRcdGNvbnN0IGZpbHRlclJlYXNvbiA9ICdSZXNvdXJjZSBpcyBiZWluZyBlZGl0ZWQnO1xuXHRcdGNvbnN0IGZpbHRlciA9IHNlcnZpY2UuaW5zdGFsbFJlc291cmNlRmlsdGVyKHJlc291cmNlMSwgZmlsdGVyUmVhc29uKTtcblxuXHRcdC8vIFJlYWQgYWxsIG1hcmtlcnNcblx0XHRjb25zdCBhbGxNYXJrZXJzID0gc2VydmljZS5yZWFkKCk7XG5cblx0XHQvLyBTaG91bGQgaGF2ZSAyIG1hcmtlcnMgLSBvbmUgcmVhbCBtYXJrZXIgYW5kIG9uZSBpbmZvIG1hcmtlclxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhbGxNYXJrZXJzLmxlbmd0aCwgMik7XG5cblx0XHQvLyBGaW5kIHRoZSBpbmZvIG1hcmtlclxuXHRcdGNvbnN0IGluZm9NYXJrZXIgPSBhbGxNYXJrZXJzLmZpbmQobWFya2VyID0+XG5cdFx0XHRtYXJrZXIub3duZXIgPT09ICdtYXJrZXJzRmlsdGVyJyAmJlxuXHRcdFx0bWFya2VyLnNldmVyaXR5ID09PSBNYXJrZXJTZXZlcml0eS5JbmZvXG5cdFx0KTtcblxuXHRcdC8vIFZlcmlmeSB0aGUgaW5mbyBtYXJrZXJcblx0XHRhc3NlcnQub2soaW5mb01hcmtlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluZm9NYXJrZXI/LnJlc291cmNlLnRvU3RyaW5nKCksIHJlc291cmNlMS50b1N0cmluZygpKTtcblx0XHRhc3NlcnQub2soaW5mb01hcmtlcj8ubWVzc2FnZS5pbmNsdWRlcyhmaWx0ZXJSZWFzb24pKTtcblxuXHRcdC8vIFJlbW92ZSBmaWx0ZXJcblx0XHRmaWx0ZXIuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdvdXQgb2Ygb3JkZXIgZmlsdGVyIGRpc3Bvc2FsIHdvcmtzIGNvcnJlY3RseScsICgpID0+IHtcblx0XHRzZXJ2aWNlID0gbmV3IG1hcmtlclNlcnZpY2UuTWFya2VyU2VydmljZSgpO1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLnBhcnNlKCdmaWxlOi8vL3BhdGgvZmlsZS5jcycpO1xuXG5cdFx0Ly8gQWRkIG1hcmtlciB0byByZXNvdXJjZVxuXHRcdHNlcnZpY2UuY2hhbmdlT25lKCdvd25lcjEnLCByZXNvdXJjZSwgW3JhbmRvbU1hcmtlckRhdGEoKV0pO1xuXG5cdFx0Ly8gVmVyaWZ5IHJlc291cmNlIGhhcyBtYXJrZXJzXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCgpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IHJlc291cmNlIH0pLmxlbmd0aCwgMSk7XG5cblx0XHQvLyBJbnN0YWxsIHRocmVlIGZpbHRlcnMgZm9yIHRoZSBzYW1lIHJlc291cmNlXG5cdFx0Y29uc3QgZmlsdGVyMSA9IHNlcnZpY2UuaW5zdGFsbFJlc291cmNlRmlsdGVyKHJlc291cmNlLCAnRmlyc3QgZmlsdGVyJyk7XG5cdFx0Y29uc3QgZmlsdGVyMiA9IHNlcnZpY2UuaW5zdGFsbFJlc291cmNlRmlsdGVyKHJlc291cmNlLCAnU2Vjb25kIGZpbHRlcicpO1xuXHRcdGNvbnN0IGZpbHRlcjMgPSBzZXJ2aWNlLmluc3RhbGxSZXNvdXJjZUZpbHRlcihyZXNvdXJjZSwgJ1RoaXJkIGZpbHRlcicpO1xuXG5cdFx0Ly8gVmVyaWZ5IHJlc291cmNlIG1hcmtlcnMgYXJlIGZpbHRlcmVkIG91dCBidXQgaW5mbyBtYXJrZXIgaXMgc2hvd25cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKCkubGVuZ3RoLCAxKTsgLy8gMSBpbmZvIG1hcmtlclxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoeyByZXNvdXJjZSB9KS5sZW5ndGgsIDEpOyAvLyAxIGluZm8gbWFya2VyXG5cblx0XHQvLyBEaXNwb3NlIGZpbHRlcnMgaW4gYSBkaWZmZXJlbnQgb3JkZXIgdGhhbiB0aGV5IHdlcmUgY3JlYXRlZFxuXHRcdGZpbHRlcjIuZGlzcG9zZSgpOyAgLy8gUmVtb3ZlIHRoZSBzZWNvbmQgZmlsdGVyIGZpcnN0XG5cblx0XHQvLyBWZXJpZnkgcmVzb3VyY2UgbWFya2VycyBhcmUgc3RpbGwgZmlsdGVyZWQgb3V0IHdpdGggMiBmaWx0ZXJzIHJlbWFpbmluZ1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnJlYWQoKS5sZW5ndGgsIDEpOyAvLyBzdGlsbCAxIGluZm8gbWFya2VyXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UucmVhZCh7IHJlc291cmNlIH0pLmxlbmd0aCwgMSk7IC8vIHN0aWxsIDEgaW5mbyBtYXJrZXJcblxuXHRcdC8vIENoZWNrIGlmIG1lc3NhZ2UgY29udGFpbnMgdGhlIGNvcnJlY3QgY291bnQgb2YgZmlsdGVyc1xuXHRcdGNvbnN0IG1hcmtlcnMgPSBzZXJ2aWNlLnJlYWQoeyByZXNvdXJjZSB9KTtcblx0XHRhc3NlcnQub2sobWFya2Vyc1swXS5tZXNzYWdlLmluY2x1ZGVzKCdQcm9ibGVtcyBhcmUgcGF1c2VkIGJlY2F1c2UnKSk7XG5cblx0XHQvLyBSZW1vdmUgcmVtYWluaW5nIGZpbHRlcnMgaW4gYW55IG9yZGVyXG5cdFx0ZmlsdGVyMy5kaXNwb3NlKCk7XG5cdFx0ZmlsdGVyMS5kaXNwb3NlKCk7XG5cblx0XHQvLyBOb3cgYWxsIGZpbHRlcnMgYXJlIGdvbmUsIHNvIG1hcmtlcnMgc2hvdWxkIGJlIHZpc2libGUgYWdhaW5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKCkubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5yZWFkKHsgcmVzb3VyY2UgfSkubGVuZ3RoLCAxKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBc0Isc0JBQXNCO0FBQzVDLFlBQVksbUJBQW1CO0FBRS9CLFNBQVMsaUJBQWlCLFdBQVcsZUFBZSxPQUFvQjtBQUN2RSxTQUFPO0FBQUEsSUFDTjtBQUFBLElBQ0EsU0FBUyxLQUFLLE9BQU8sRUFBRSxTQUFTLEVBQUU7QUFBQSxJQUNsQyxpQkFBaUI7QUFBQSxJQUNqQixhQUFhO0FBQUEsSUFDYixlQUFlO0FBQUEsSUFDZixXQUFXO0FBQUEsRUFDWjtBQUNEO0FBRUEsTUFBTSxrQkFBa0IsTUFBTTtBQUU3QixNQUFJO0FBRUosV0FBUyxXQUFZO0FBQ3BCLFlBQVEsUUFBUTtBQUFBLEVBQ2pCLENBQUM7QUFFRCwwQ0FBd0M7QUFFeEMsT0FBSyxTQUFTLE1BQU07QUFFbkIsY0FBVSxJQUFJLGNBQWMsY0FBYztBQUUxQyxZQUFRLFVBQVUsT0FBTyxDQUFDO0FBQUEsTUFDekIsVUFBVSxJQUFJLE1BQU0sd0JBQXdCO0FBQUEsTUFDNUMsUUFBUSxpQkFBaUIsZUFBZSxLQUFLO0FBQUEsSUFDOUMsQ0FBQyxDQUFDO0FBRUYsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFFBQVEsQ0FBQztBQUMzQyxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsT0FBTyxNQUFNLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDM0QsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFVBQVUsSUFBSSxNQUFNLHdCQUF3QixFQUFFLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDNUYsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE9BQU8sT0FBTyxVQUFVLElBQUksTUFBTSx3QkFBd0IsRUFBRSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBRzFHLFlBQVEsVUFBVSxPQUFPLENBQUM7QUFBQSxNQUN6QixVQUFVLElBQUksTUFBTSx3QkFBd0I7QUFBQSxNQUM1QyxRQUFRLGlCQUFpQixlQUFlLE9BQU87QUFBQSxJQUNoRCxDQUFDLENBQUM7QUFFRixXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQzNDLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxPQUFPLE1BQU0sQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUMzRCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsT0FBTyxNQUFNLENBQUMsRUFBRSxRQUFRLENBQUM7QUFFM0QsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFlBQVksZUFBZSxNQUFNLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDL0UsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFlBQVksZUFBZSxRQUFRLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDakYsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFlBQVksZUFBZSxLQUFLLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDOUUsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFlBQVksZUFBZSxRQUFRLGVBQWUsUUFBUSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQUEsRUFFekcsQ0FBQztBQUdELE9BQUssc0JBQXNCLE1BQU07QUFFaEMsY0FBVSxJQUFJLGNBQWMsY0FBYztBQUMxQyxZQUFRLFVBQVUsT0FBTyxJQUFJLE1BQU0sc0JBQXNCLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQ2hGLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxRQUFRLENBQUM7QUFDM0MsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE9BQU8sTUFBTSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBRTNELFlBQVEsVUFBVSxPQUFPLElBQUksTUFBTSxzQkFBc0IsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFDaEYsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFFBQVEsQ0FBQztBQUMzQyxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsT0FBTyxNQUFNLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDM0QsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE9BQU8sTUFBTSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBRTNELFlBQVEsVUFBVSxPQUFPLElBQUksTUFBTSxzQkFBc0IsR0FBRyxDQUFDLGlCQUFpQixHQUFHLGlCQUFpQixDQUFDLENBQUM7QUFDcEcsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE9BQU8sTUFBTSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQzNELFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxPQUFPLE1BQU0sQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUFBLEVBRTVELENBQUM7QUFFRCxPQUFLLHdCQUF3QixNQUFNO0FBRWxDLGNBQVUsSUFBSSxjQUFjLGNBQWM7QUFDMUMsWUFBUSxVQUFVLE9BQU8sSUFBSSxNQUFNLHNCQUFzQixHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUNoRixZQUFRLFVBQVUsT0FBTyxJQUFJLE1BQU0sc0JBQXNCLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQ2hGLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxPQUFPLE1BQU0sQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUMzRCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsT0FBTyxNQUFNLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDM0QsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFFBQVEsQ0FBQztBQUUzQyxZQUFRLFVBQVUsT0FBTyxJQUFJLE1BQU0sc0JBQXNCLEdBQUcsQ0FBQyxDQUFDO0FBQzlELFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxPQUFPLE1BQU0sQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUMzRCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsT0FBTyxNQUFNLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDM0QsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFFBQVEsQ0FBQztBQUUzQyxZQUFRLFVBQVUsT0FBTyxDQUFDLENBQUM7QUFDM0IsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE9BQU8sTUFBTSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQzNELFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxPQUFPLE1BQU0sQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUMzRCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQUEsRUFDNUMsQ0FBQztBQUVELE9BQUsscUNBQXFDLE1BQU07QUFFL0MsY0FBVSxJQUFJLGNBQWMsY0FBYztBQUMxQyxZQUFRLFVBQVUsT0FBTyxDQUFDO0FBQUEsTUFDekIsVUFBVSxJQUFJLE1BQU0sZ0JBQWdCO0FBQUEsTUFDcEMsUUFBUSxpQkFBaUI7QUFBQSxJQUMxQixHQUFHO0FBQUEsTUFDRixVQUFVLElBQUksTUFBTSxnQkFBZ0I7QUFBQSxNQUNwQyxRQUFRLGlCQUFpQjtBQUFBLElBQzFCLENBQUMsQ0FBQztBQUVGLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxPQUFPLE1BQU0sQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUUzRCxVQUFNLElBQUksUUFBUSxnQkFBZ0Isc0JBQW9CO0FBQ3JELGFBQU8sWUFBWSxpQkFBaUIsUUFBUSxDQUFDO0FBQzdDLHVCQUFpQixRQUFRLE9BQUssT0FBTyxZQUFZLEVBQUUsU0FBUyxHQUFHLGdCQUFnQixDQUFDO0FBQ2hGLGFBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxPQUFPLE1BQU0sQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUFBLElBQzVELENBQUM7QUFFRCxZQUFRLFVBQVUsT0FBTyxDQUFDLENBQUM7QUFFM0IsTUFBRSxRQUFRO0FBQUEsRUFDWCxDQUFDO0FBRUQsT0FBSyxvQkFBb0IsTUFBTTtBQUM5QixjQUFVLElBQUksY0FBYyxjQUFjO0FBRTFDLFlBQVEsVUFBVSxPQUFPLENBQUM7QUFBQSxNQUN6QixVQUFVLElBQUksTUFBTSx3QkFBd0I7QUFBQSxNQUM1QyxRQUFRLGlCQUFpQjtBQUFBLElBQzFCLEdBQUc7QUFBQSxNQUNGLFVBQVUsSUFBSSxNQUFNLHdCQUF3QjtBQUFBLE1BQzVDLFFBQVEsaUJBQWlCO0FBQUEsSUFDMUIsQ0FBQyxDQUFDO0FBRUYsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE9BQU8sTUFBTSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQUEsRUFDNUQsQ0FBQztBQUVELE9BQUssb0RBQW9ELE1BQU07QUFDOUQsY0FBVSxJQUFJLGNBQWMsY0FBYztBQUUxQyxZQUFRLFVBQVUsT0FBTyxDQUFDO0FBQUEsTUFDekIsVUFBVSxJQUFJLE1BQU0sY0FBYztBQUFBLE1BQ2xDLFFBQVEsaUJBQWlCO0FBQUEsSUFDMUIsR0FBRztBQUFBLE1BQ0YsVUFBVSxJQUFJLE1BQU0sY0FBYztBQUFBLE1BQ2xDLFFBQVEsaUJBQWlCO0FBQUEsSUFDMUIsQ0FBQyxDQUFDO0FBRUYsWUFBUSxVQUFVLE9BQU8sQ0FBQztBQUFBLE1BQ3pCLFVBQVUsSUFBSSxNQUFNLGNBQWM7QUFBQSxNQUNsQyxRQUFRLGlCQUFpQjtBQUFBLElBQzFCLENBQUMsQ0FBQztBQUVGLFlBQVEsVUFBVSxPQUFPLENBQUM7QUFBQSxNQUN6QixVQUFVLElBQUksTUFBTSxjQUFjO0FBQUEsTUFDbEMsUUFBUSxpQkFBaUI7QUFBQSxJQUMxQixHQUFHO0FBQUEsTUFDRixVQUFVLElBQUksTUFBTSxjQUFjO0FBQUEsTUFDbEMsUUFBUSxpQkFBaUI7QUFBQSxJQUMxQixDQUFDLENBQUM7QUFFRixXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsT0FBTyxNQUFNLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDM0QsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFVBQVUsSUFBSSxNQUFNLGNBQWMsRUFBRSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQUEsRUFDbkYsQ0FBQztBQUVELE9BQUssdUJBQXVCLE1BQU07QUFFakMsVUFBTSxPQUFPLGlCQUFpQjtBQUM5QixjQUFVLElBQUksY0FBYyxjQUFjO0FBRTFDLFNBQUssVUFBVTtBQUNmLFlBQVEsVUFBVSxPQUFPLElBQUksTUFBTSxlQUFlLEdBQUcsQ0FBQyxJQUFJLENBQUM7QUFDM0QsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE9BQU8sTUFBTSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBRTNELFNBQUssVUFBVTtBQUNmLFlBQVEsVUFBVSxPQUFPLElBQUksTUFBTSxlQUFlLEdBQUcsQ0FBQyxJQUFJLENBQUM7QUFDM0QsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE9BQU8sTUFBTSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBRTNELFNBQUssVUFBVTtBQUNmLFlBQVEsVUFBVSxPQUFPLElBQUksTUFBTSxlQUFlLEdBQUcsQ0FBQyxJQUFJLENBQUM7QUFDM0QsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE9BQU8sTUFBTSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQUEsRUFDNUQsQ0FBQztBQUVELE9BQUssc0ZBQXNGLE1BQU07QUFDaEcsY0FBVSxJQUFJLGNBQWMsY0FBYztBQUUxQyxZQUFRLFVBQVUsS0FBSyxJQUFJLE1BQU0sWUFBWSxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUNwRSxZQUFRLFVBQVUsS0FBSyxJQUFJLE1BQU0sWUFBWSxHQUFHLENBQUMsQ0FBQztBQUFBLEVBRW5ELENBQUM7QUFFRCxPQUFLLHFEQUFxRCxXQUFZO0FBQ3JFLFVBQU0sT0FBb0I7QUFBQSxNQUN6QixNQUFNO0FBQUEsTUFDTixpQkFBaUI7QUFBQSxNQUNqQixhQUFhO0FBQUEsTUFDYixlQUFlO0FBQUEsTUFDZixXQUFXO0FBQUEsTUFDWCxTQUFTO0FBQUEsTUFDVCxVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFDVDtBQUNBLGNBQVUsSUFBSSxjQUFjLGNBQWM7QUFFMUMsWUFBUSxVQUFVLE9BQU8sSUFBSSxNQUFNLFlBQVksR0FBRyxDQUFDLElBQUksQ0FBQztBQUN4RCxVQUFNLFNBQVMsUUFBUSxLQUFLLEVBQUUsVUFBVSxJQUFJLE1BQU0sWUFBWSxFQUFFLENBQUM7QUFFakUsV0FBTyxZQUFZLE9BQU8sUUFBUSxDQUFDO0FBQ25DLFdBQU8sWUFBWSxPQUFPLENBQUMsRUFBRSxNQUFNLEdBQUc7QUFBQSxFQUN2QyxDQUFDO0FBRUQsT0FBSywyREFBMkQsTUFBTTtBQUNyRSxjQUFVLElBQUksY0FBYyxjQUFjO0FBQzFDLFVBQU0sWUFBWSxJQUFJLE1BQU0sdUJBQXVCO0FBQ25ELFVBQU0sWUFBWSxJQUFJLE1BQU0sdUJBQXVCO0FBR25ELFlBQVEsVUFBVSxVQUFVLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQzNELFlBQVEsVUFBVSxVQUFVLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBRzNELFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxRQUFRLENBQUM7QUFDM0MsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFVBQVUsVUFBVSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQ2xFLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxVQUFVLFVBQVUsQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUdsRSxVQUFNLFNBQVMsUUFBUSxzQkFBc0IsV0FBVyxhQUFhO0FBR3JFLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxRQUFRLENBQUM7QUFDM0MsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFVBQVUsVUFBVSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQ2xFLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxVQUFVLFVBQVUsQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUdsRSxXQUFPLFFBQVE7QUFHZixXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQzNDLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxVQUFVLFVBQVUsQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUNsRSxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsVUFBVSxVQUFVLENBQUMsRUFBRSxRQUFRLENBQUM7QUFBQSxFQUNuRSxDQUFDO0FBRUQsT0FBSyxtREFBbUQsTUFBTTtBQUM3RCxjQUFVLElBQUksY0FBYyxjQUFjO0FBQzFDLFVBQU0sV0FBVyxJQUFJLE1BQU0sc0JBQXNCO0FBRWpELFlBQVEsVUFBVSxVQUFVLFVBQVUsQ0FBQyxpQkFBaUIsZUFBZSxLQUFLLENBQUMsQ0FBQztBQUM5RSxZQUFRLFVBQVUsVUFBVSxVQUFVLENBQUMsaUJBQWlCLGVBQWUsT0FBTyxDQUFDLENBQUM7QUFHaEYsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFFBQVEsQ0FBQztBQUMzQyxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsU0FBUyxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQ3ZELFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxPQUFPLFNBQVMsQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUM5RCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsT0FBTyxTQUFTLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDOUQsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE9BQU8sVUFBVSxTQUFTLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDeEUsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFlBQVksZUFBZSxNQUFNLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDL0UsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFlBQVksZUFBZSxRQUFRLENBQUMsRUFBRSxRQUFRLENBQUM7QUFHakYsVUFBTSxTQUFTLFFBQVEsc0JBQXNCLFVBQVUsZUFBZTtBQUd0RSxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQzNDLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxTQUFTLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDdkQsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE9BQU8sU0FBUyxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQzlELFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxPQUFPLFNBQVMsQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUc5RCxVQUFNLHVCQUF1QixRQUFRLEtBQUssRUFBRSxPQUFPLFVBQVUsU0FBUyxDQUFDO0FBQ3ZFLFdBQU8sWUFBWSxxQkFBcUIsUUFBUSxDQUFDO0FBQ2pELFdBQU8sWUFBWSxxQkFBcUIsQ0FBQyxFQUFFLFVBQVUsZUFBZSxJQUFJO0FBQ3hFLFdBQU8sWUFBWSxxQkFBcUIsQ0FBQyxFQUFFLE9BQU8sZUFBZTtBQUVqRSxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsWUFBWSxlQUFlLE1BQU0sQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUMvRSxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsWUFBWSxlQUFlLFFBQVEsQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUNqRixXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsWUFBWSxlQUFlLEtBQUssQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUc5RSxXQUFPLFFBQVE7QUFDZixXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQUEsRUFDNUMsQ0FBQztBQUVELE9BQUssNERBQTRELE1BQU07QUFDdEUsY0FBVSxJQUFJLGNBQWMsY0FBYztBQUMxQyxVQUFNLFdBQVcsSUFBSSxNQUFNLHNCQUFzQjtBQUdqRCxZQUFRLFVBQVUsVUFBVSxVQUFVLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUcxRCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQzNDLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxTQUFTLENBQUMsRUFBRSxRQUFRLENBQUM7QUFHdkQsVUFBTSxVQUFVLFFBQVEsc0JBQXNCLFVBQVUsY0FBYztBQUN0RSxVQUFNLFVBQVUsUUFBUSxzQkFBc0IsVUFBVSxlQUFlO0FBR3ZFLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxRQUFRLENBQUM7QUFDM0MsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFNBQVMsQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUd2RCxZQUFRLFFBQVE7QUFHaEIsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFFBQVEsQ0FBQztBQUMzQyxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsU0FBUyxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBR3ZELFlBQVEsUUFBUTtBQUdoQixXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQzNDLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxTQUFTLENBQUMsRUFBRSxRQUFRLENBQUM7QUFBQSxFQUN4RCxDQUFDO0FBRUQsT0FBSywyRUFBMkUsTUFBTTtBQUNyRixjQUFVLElBQUksY0FBYyxjQUFjO0FBQzFDLFVBQU0sV0FBVyxJQUFJLE1BQU0sc0JBQXNCO0FBR2pELFlBQVEsVUFBVSxVQUFVLFVBQVU7QUFBQSxNQUNyQyxpQkFBaUIsZUFBZSxLQUFLO0FBQUEsTUFDckMsaUJBQWlCLGVBQWUsT0FBTztBQUFBLElBQ3hDLENBQUM7QUFHRCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQzNDLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxTQUFTLENBQUMsRUFBRSxRQUFRLENBQUM7QUFHdkQsVUFBTSxlQUFlO0FBQ3JCLFVBQU0sU0FBUyxRQUFRLHNCQUFzQixVQUFVLFlBQVk7QUFHbkUsVUFBTSxVQUFVLFFBQVEsS0FBSyxFQUFFLFNBQVMsQ0FBQztBQUN6QyxXQUFPLFlBQVksUUFBUSxRQUFRLENBQUM7QUFDcEMsV0FBTyxZQUFZLFFBQVEsQ0FBQyxFQUFFLFVBQVUsZUFBZSxJQUFJO0FBQzNELFdBQU8sR0FBRyxRQUFRLENBQUMsRUFBRSxRQUFRLFNBQVMsWUFBWSxDQUFDO0FBR25ELFdBQU8sUUFBUTtBQUNmLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxTQUFTLENBQUMsRUFBRSxRQUFRLENBQUM7QUFBQSxFQUN4RCxDQUFDO0FBRUQsT0FBSyxnRUFBZ0UsTUFBTTtBQUMxRSxjQUFVLElBQUksY0FBYyxjQUFjO0FBQzFDLFVBQU0sWUFBWSxJQUFJLE1BQU0sdUJBQXVCO0FBQ25ELFVBQU0sWUFBWSxJQUFJLE1BQU0sdUJBQXVCO0FBR25ELFlBQVEsVUFBVSxVQUFVLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQzNELFlBQVEsVUFBVSxVQUFVLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBRzNELFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxRQUFRLENBQUM7QUFHM0MsVUFBTSxlQUFlO0FBQ3JCLFVBQU0sU0FBUyxRQUFRLHNCQUFzQixXQUFXLFlBQVk7QUFHcEUsVUFBTSxhQUFhLFFBQVEsS0FBSztBQUdoQyxXQUFPLFlBQVksV0FBVyxRQUFRLENBQUM7QUFHdkMsVUFBTSxhQUFhLFdBQVc7QUFBQSxNQUFLLFlBQ2xDLE9BQU8sVUFBVSxtQkFDakIsT0FBTyxhQUFhLGVBQWU7QUFBQSxJQUNwQztBQUdBLFdBQU8sR0FBRyxVQUFVO0FBQ3BCLFdBQU8sWUFBWSxZQUFZLFNBQVMsU0FBUyxHQUFHLFVBQVUsU0FBUyxDQUFDO0FBQ3hFLFdBQU8sR0FBRyxZQUFZLFFBQVEsU0FBUyxZQUFZLENBQUM7QUFHcEQsV0FBTyxRQUFRO0FBQUEsRUFDaEIsQ0FBQztBQUVELE9BQUssZ0RBQWdELE1BQU07QUFDMUQsY0FBVSxJQUFJLGNBQWMsY0FBYztBQUMxQyxVQUFNLFdBQVcsSUFBSSxNQUFNLHNCQUFzQjtBQUdqRCxZQUFRLFVBQVUsVUFBVSxVQUFVLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUcxRCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQzNDLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxTQUFTLENBQUMsRUFBRSxRQUFRLENBQUM7QUFHdkQsVUFBTSxVQUFVLFFBQVEsc0JBQXNCLFVBQVUsY0FBYztBQUN0RSxVQUFNLFVBQVUsUUFBUSxzQkFBc0IsVUFBVSxlQUFlO0FBQ3ZFLFVBQU0sVUFBVSxRQUFRLHNCQUFzQixVQUFVLGNBQWM7QUFHdEUsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFFBQVEsQ0FBQztBQUMzQyxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsU0FBUyxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBR3ZELFlBQVEsUUFBUTtBQUdoQixXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQzNDLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxTQUFTLENBQUMsRUFBRSxRQUFRLENBQUM7QUFHdkQsVUFBTSxVQUFVLFFBQVEsS0FBSyxFQUFFLFNBQVMsQ0FBQztBQUN6QyxXQUFPLEdBQUcsUUFBUSxDQUFDLEVBQUUsUUFBUSxTQUFTLDZCQUE2QixDQUFDO0FBR3BFLFlBQVEsUUFBUTtBQUNoQixZQUFRLFFBQVE7QUFHaEIsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLFFBQVEsQ0FBQztBQUMzQyxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsU0FBUyxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQUEsRUFDeEQsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
