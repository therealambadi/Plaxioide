import assert from "assert";
import { timeout } from "../../../../base/common/async.js";
import { URI } from "../../../../base/common/uri.js";
import { runWithFakedTimers } from "../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { MarkerService } from "../../../../platform/markers/common/markerService.js";
import { MainThreadDiagnostics } from "../../browser/mainThreadDiagnostics.js";
import { ExtensionHostKind } from "../../../services/extensions/common/extensionHostKind.js";
import { mock } from "../../../test/common/workbenchTestServices.js";
suite("MainThreadDiagnostics", function() {
  let markerService;
  setup(function() {
    markerService = new MarkerService();
  });
  teardown(function() {
    markerService.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("clear markers on dispose", function() {
    const diag = new MainThreadDiagnostics(
      new class {
        constructor() {
          this.remoteAuthority = "";
          this.extensionHostKind = ExtensionHostKind.LocalProcess;
        }
        dispose() {
        }
        assertRegistered() {
        }
        set(v) {
          return null;
        }
        getProxy() {
          return {
            $acceptMarkersChange() {
            }
          };
        }
        drain() {
          return null;
        }
      }(),
      markerService,
      new class extends mock() {
        asCanonicalUri(uri) {
          return uri;
        }
      }()
    );
    diag.$changeMany("foo", [[URI.file("a"), [{
      code: "666",
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
      message: "fffff",
      severity: 1,
      source: "me"
    }]]]);
    assert.strictEqual(markerService.read().length, 1);
    diag.dispose();
    assert.strictEqual(markerService.read().length, 0);
  });
  test("OnDidChangeDiagnostics triggers twice on same diagnostics #136434", function() {
    return runWithFakedTimers({}, async () => {
      const changedData = [];
      const diag = new MainThreadDiagnostics(
        new class {
          constructor() {
            this.remoteAuthority = "";
            this.extensionHostKind = ExtensionHostKind.LocalProcess;
          }
          dispose() {
          }
          assertRegistered() {
          }
          set(v) {
            return null;
          }
          getProxy() {
            return {
              $acceptMarkersChange(data) {
                changedData.push(data);
              }
            };
          }
          drain() {
            return null;
          }
        }(),
        markerService,
        new class extends mock() {
          asCanonicalUri(uri) {
            return uri;
          }
        }()
      );
      const markerDataStub = {
        code: "666",
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
        severity: 1,
        source: "me"
      };
      const target = URI.file("a");
      diag.$changeMany("foo", [[target, [{ ...markerDataStub, message: "same_owner" }]]]);
      markerService.changeOne("bar", target, [{ ...markerDataStub, message: "forgein_owner" }]);
      await timeout(0);
      assert.strictEqual(markerService.read().length, 2);
      assert.strictEqual(changedData.length, 1);
      assert.strictEqual(changedData[0].length, 1);
      assert.strictEqual(changedData[0][0][1][0].message, "forgein_owner");
      diag.dispose();
    });
  });
  test('onDidChangeDiagnostics different behavior when "extensionKind" ui running on remote workspace #136955', function() {
    return runWithFakedTimers({}, async () => {
      const markerData = {
        code: "666",
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
        severity: 1,
        source: "me",
        message: "message"
      };
      const target = URI.file("a");
      markerService.changeOne("bar", target, [markerData]);
      const changedData = [];
      const diag = new MainThreadDiagnostics(
        new class {
          constructor() {
            this.remoteAuthority = "";
            this.extensionHostKind = ExtensionHostKind.LocalProcess;
          }
          dispose() {
          }
          assertRegistered() {
          }
          set(v) {
            return null;
          }
          getProxy() {
            return {
              $acceptMarkersChange(data) {
                changedData.push(data);
              }
            };
          }
          drain() {
            return null;
          }
        }(),
        markerService,
        new class extends mock() {
          asCanonicalUri(uri) {
            return uri;
          }
        }()
      );
      diag.$clear("bar");
      await timeout(0);
      assert.strictEqual(markerService.read().length, 0);
      assert.strictEqual(changedData.length, 1);
      diag.dispose();
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9tYWluVGhyZWFkRGlhZ25vc3RpY3MudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgcnVuV2l0aEZha2VkVGltZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi90aW1lVHJhdmVsU2NoZWR1bGVyLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgTWFya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1hcmtlckRhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJzLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgTWFpblRocmVhZERpYWdub3N0aWNzIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9tYWluVGhyZWFkRGlhZ25vc3RpY3MuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0SG9zdEN1c3RvbWVycy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25Ib3N0S2luZCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbkhvc3RLaW5kLmpzJztcbmltcG9ydCB7IG1vY2sgfSBmcm9tICcuLi8uLi8uLi90ZXN0L2NvbW1vbi93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuXG5cbnN1aXRlKCdNYWluVGhyZWFkRGlhZ25vc3RpY3MnLCBmdW5jdGlvbiAoKSB7XG5cblx0bGV0IG1hcmtlclNlcnZpY2U6IE1hcmtlclNlcnZpY2U7XG5cblx0c2V0dXAoZnVuY3Rpb24gKCkge1xuXHRcdG1hcmtlclNlcnZpY2UgPSBuZXcgTWFya2VyU2VydmljZSgpO1xuXHR9KTtcblxuXHR0ZWFyZG93bihmdW5jdGlvbiAoKSB7XG5cdFx0bWFya2VyU2VydmljZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2NsZWFyIG1hcmtlcnMgb24gZGlzcG9zZScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGRpYWcgPSBuZXcgTWFpblRocmVhZERpYWdub3N0aWNzKFxuXHRcdFx0bmV3IGNsYXNzIGltcGxlbWVudHMgSUV4dEhvc3RDb250ZXh0IHtcblx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5ID0gJyc7XG5cdFx0XHRcdGV4dGVuc2lvbkhvc3RLaW5kID0gRXh0ZW5zaW9uSG9zdEtpbmQuTG9jYWxQcm9jZXNzO1xuXHRcdFx0XHRkaXNwb3NlKCkgeyB9XG5cdFx0XHRcdGFzc2VydFJlZ2lzdGVyZWQoKSB7IH1cblx0XHRcdFx0c2V0KHY6IGFueSk6IGFueSB7IHJldHVybiBudWxsOyB9XG5cdFx0XHRcdGdldFByb3h5KCk6IGFueSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdCRhY2NlcHRNYXJrZXJzQ2hhbmdlKCkgeyB9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkcmFpbigpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuXHRcdFx0fSxcblx0XHRcdG1hcmtlclNlcnZpY2UsXG5cdFx0XHRuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElVcmlJZGVudGl0eVNlcnZpY2U+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBhc0Nhbm9uaWNhbFVyaSh1cmk6IFVSSSkgeyByZXR1cm4gdXJpOyB9XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdGRpYWcuJGNoYW5nZU1hbnkoJ2ZvbycsIFtbVVJJLmZpbGUoJ2EnKSwgW3tcblx0XHRcdGNvZGU6ICc2NjYnLFxuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxLFxuXHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRlbmRMaW5lTnVtYmVyOiAxLFxuXHRcdFx0ZW5kQ29sdW1uOiAxLFxuXHRcdFx0bWVzc2FnZTogJ2ZmZmZmJyxcblx0XHRcdHNldmVyaXR5OiAxLFxuXHRcdFx0c291cmNlOiAnbWUnXG5cdFx0fV1dXSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFya2VyU2VydmljZS5yZWFkKCkubGVuZ3RoLCAxKTtcblx0XHRkaWFnLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFya2VyU2VydmljZS5yZWFkKCkubGVuZ3RoLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnT25EaWRDaGFuZ2VEaWFnbm9zdGljcyB0cmlnZ2VycyB0d2ljZSBvbiBzYW1lIGRpYWdub3N0aWNzICMxMzY0MzQnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyAoKSA9PiB7XG5cblx0XHRcdGNvbnN0IGNoYW5nZWREYXRhOiBbVXJpQ29tcG9uZW50cywgSU1hcmtlckRhdGFbXV1bXVtdID0gW107XG5cblx0XHRcdGNvbnN0IGRpYWcgPSBuZXcgTWFpblRocmVhZERpYWdub3N0aWNzKFxuXHRcdFx0XHRuZXcgY2xhc3MgaW1wbGVtZW50cyBJRXh0SG9zdENvbnRleHQge1xuXHRcdFx0XHRcdHJlbW90ZUF1dGhvcml0eSA9ICcnO1xuXHRcdFx0XHRcdGV4dGVuc2lvbkhvc3RLaW5kID0gRXh0ZW5zaW9uSG9zdEtpbmQuTG9jYWxQcm9jZXNzO1xuXHRcdFx0XHRcdGRpc3Bvc2UoKSB7IH1cblx0XHRcdFx0XHRhc3NlcnRSZWdpc3RlcmVkKCkgeyB9XG5cdFx0XHRcdFx0c2V0KHY6IGFueSk6IGFueSB7IHJldHVybiBudWxsOyB9XG5cdFx0XHRcdFx0Z2V0UHJveHkoKTogYW55IHtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdCRhY2NlcHRNYXJrZXJzQ2hhbmdlKGRhdGE6IFtVcmlDb21wb25lbnRzLCBJTWFya2VyRGF0YVtdXVtdKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y2hhbmdlZERhdGEucHVzaChkYXRhKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZHJhaW4oKTogYW55IHsgcmV0dXJuIG51bGw7IH1cblx0XHRcdFx0fSxcblx0XHRcdFx0bWFya2VyU2VydmljZSxcblx0XHRcdFx0bmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJVXJpSWRlbnRpdHlTZXJ2aWNlPigpIHtcblx0XHRcdFx0XHRvdmVycmlkZSBhc0Nhbm9uaWNhbFVyaSh1cmk6IFVSSSkgeyByZXR1cm4gdXJpOyB9XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cblx0XHRcdGNvbnN0IG1hcmtlckRhdGFTdHViID0ge1xuXHRcdFx0XHRjb2RlOiAnNjY2Jyxcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxLFxuXHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0ZW5kTGluZU51bWJlcjogMSxcblx0XHRcdFx0ZW5kQ29sdW1uOiAxLFxuXHRcdFx0XHRzZXZlcml0eTogMSxcblx0XHRcdFx0c291cmNlOiAnbWUnXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgdGFyZ2V0ID0gVVJJLmZpbGUoJ2EnKTtcblx0XHRcdGRpYWcuJGNoYW5nZU1hbnkoJ2ZvbycsIFtbdGFyZ2V0LCBbeyAuLi5tYXJrZXJEYXRhU3R1YiwgbWVzc2FnZTogJ3NhbWVfb3duZXInIH1dXV0pO1xuXHRcdFx0bWFya2VyU2VydmljZS5jaGFuZ2VPbmUoJ2JhcicsIHRhcmdldCwgW3sgLi4ubWFya2VyRGF0YVN0dWIsIG1lc3NhZ2U6ICdmb3JnZWluX293bmVyJyB9XSk7XG5cblx0XHRcdC8vIGFkZGVkIG9uZSBtYXJrZXIgdmlhIHRoZSBBUEkgYW5kIG9uZSB2aWEgdGhlIGV4dCBob3N0LiB0aGUgbGF0dGVyIG11c3Qgbm90XG5cdFx0XHQvLyB0cmlnZ2VyIGFuIGV2ZW50IHRvIHRoZSBleHRlbnNpb24gaG9zdFxuXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hcmtlclNlcnZpY2UucmVhZCgpLmxlbmd0aCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hhbmdlZERhdGEubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGFuZ2VkRGF0YVswXS5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoYW5nZWREYXRhWzBdWzBdWzFdWzBdLm1lc3NhZ2UsICdmb3JnZWluX293bmVyJyk7XG5cblx0XHRcdGRpYWcuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdvbkRpZENoYW5nZURpYWdub3N0aWNzIGRpZmZlcmVudCBiZWhhdmlvciB3aGVuIFwiZXh0ZW5zaW9uS2luZFwiIHVpIHJ1bm5pbmcgb24gcmVtb3RlIHdvcmtzcGFjZSAjMTM2OTU1JywgZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jICgpID0+IHtcblxuXHRcdFx0Y29uc3QgbWFya2VyRGF0YTogSU1hcmtlckRhdGEgPSB7XG5cdFx0XHRcdGNvZGU6ICc2NjYnLFxuXHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDEsXG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRlbmRMaW5lTnVtYmVyOiAxLFxuXHRcdFx0XHRlbmRDb2x1bW46IDEsXG5cdFx0XHRcdHNldmVyaXR5OiAxLFxuXHRcdFx0XHRzb3VyY2U6ICdtZScsXG5cdFx0XHRcdG1lc3NhZ2U6ICdtZXNzYWdlJ1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHRhcmdldCA9IFVSSS5maWxlKCdhJyk7XG5cdFx0XHRtYXJrZXJTZXJ2aWNlLmNoYW5nZU9uZSgnYmFyJywgdGFyZ2V0LCBbbWFya2VyRGF0YV0pO1xuXG5cdFx0XHRjb25zdCBjaGFuZ2VkRGF0YTogW1VyaUNvbXBvbmVudHMsIElNYXJrZXJEYXRhW11dW11bXSA9IFtdO1xuXG5cdFx0XHRjb25zdCBkaWFnID0gbmV3IE1haW5UaHJlYWREaWFnbm9zdGljcyhcblx0XHRcdFx0bmV3IGNsYXNzIGltcGxlbWVudHMgSUV4dEhvc3RDb250ZXh0IHtcblx0XHRcdFx0XHRyZW1vdGVBdXRob3JpdHkgPSAnJztcblx0XHRcdFx0XHRleHRlbnNpb25Ib3N0S2luZCA9IEV4dGVuc2lvbkhvc3RLaW5kLkxvY2FsUHJvY2Vzcztcblx0XHRcdFx0XHRkaXNwb3NlKCkgeyB9XG5cdFx0XHRcdFx0YXNzZXJ0UmVnaXN0ZXJlZCgpIHsgfVxuXHRcdFx0XHRcdHNldCh2OiBhbnkpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuXHRcdFx0XHRcdGdldFByb3h5KCk6IGFueSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHQkYWNjZXB0TWFya2Vyc0NoYW5nZShkYXRhOiBbVXJpQ29tcG9uZW50cywgSU1hcmtlckRhdGFbXV1bXSkge1xuXHRcdFx0XHRcdFx0XHRcdGNoYW5nZWREYXRhLnB1c2goZGF0YSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGRyYWluKCk6IGFueSB7IHJldHVybiBudWxsOyB9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdG1hcmtlclNlcnZpY2UsXG5cdFx0XHRcdG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SVVyaUlkZW50aXR5U2VydmljZT4oKSB7XG5cdFx0XHRcdFx0b3ZlcnJpZGUgYXNDYW5vbmljYWxVcmkodXJpOiBVUkkpIHsgcmV0dXJuIHVyaTsgfVxuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXG5cdFx0XHRkaWFnLiRjbGVhcignYmFyJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hcmtlclNlcnZpY2UucmVhZCgpLmxlbmd0aCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hhbmdlZERhdGEubGVuZ3RoLCAxKTtcblxuXHRcdFx0ZGlhZy5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsV0FBMEI7QUFDbkMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxxQkFBcUI7QUFHOUIsU0FBUyw2QkFBNkI7QUFFdEMsU0FBUyx5QkFBeUI7QUFDbEMs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
