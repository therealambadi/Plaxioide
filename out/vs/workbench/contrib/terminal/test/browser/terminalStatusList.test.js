import { deepStrictEqual, strictEqual } from "assert";
import { Codicon } from "../../../../../base/common/codicons.js";
import Severity from "../../../../../base/common/severity.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { spinningLoading } from "../../../../../platform/theme/common/iconRegistry.js";
import { TerminalStatusList } from "../../browser/terminalStatusList.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
function statusesEqual(list, expected) {
  deepStrictEqual(list.statuses.map((e) => [e.id, e.severity]), expected);
}
suite("Workbench - TerminalStatusList", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let list;
  setup(() => {
    const instantiationService = workbenchInstantiationService(void 0, store);
    list = store.add(instantiationService.createInstance(TerminalStatusList));
  });
  test("primary", () => {
    strictEqual(list.primary?.id, void 0);
    list.add({ id: "info1", severity: Severity.Info });
    strictEqual(list.primary?.id, "info1");
    list.add({ id: "warning1", severity: Severity.Warning });
    strictEqual(list.primary?.id, "warning1");
    list.add({ id: "info2", severity: Severity.Info });
    strictEqual(list.primary?.id, "warning1");
    list.add({ id: "warning2", severity: Severity.Warning });
    strictEqual(list.primary?.id, "warning2");
    list.add({ id: "info3", severity: Severity.Info });
    strictEqual(list.primary?.id, "warning2");
    list.add({ id: "error1", severity: Severity.Error });
    strictEqual(list.primary?.id, "error1");
    list.add({ id: "warning3", severity: Severity.Warning });
    strictEqual(list.primary?.id, "error1");
    list.add({ id: "error2", severity: Severity.Error });
    strictEqual(list.primary?.id, "error2");
    list.remove("error1");
    strictEqual(list.primary?.id, "error2");
    list.remove("error2");
    strictEqual(list.primary?.id, "warning3");
  });
  test("statuses", () => {
    strictEqual(list.statuses.length, 0);
    list.add({ id: "info", severity: Severity.Info });
    list.add({ id: "warning", severity: Severity.Warning });
    list.add({ id: "error", severity: Severity.Error });
    strictEqual(list.statuses.length, 3);
    statusesEqual(list, [
      ["info", Severity.Info],
      ["warning", Severity.Warning],
      ["error", Severity.Error]
    ]);
    list.remove("info");
    list.remove("warning");
    list.remove("error");
    strictEqual(list.statuses.length, 0);
  });
  test("onDidAddStatus", async () => {
    const result = await new Promise((r) => {
      store.add(list.onDidAddStatus(r));
      list.add({ id: "test", severity: Severity.Info });
    });
    deepStrictEqual(result, { id: "test", severity: Severity.Info });
  });
  test("onDidRemoveStatus", async () => {
    const result = await new Promise((r) => {
      store.add(list.onDidRemoveStatus(r));
      list.add({ id: "test", severity: Severity.Info });
      list.remove("test");
    });
    deepStrictEqual(result, { id: "test", severity: Severity.Info });
  });
  test("onDidChangePrimaryStatus", async () => {
    const result = await new Promise((r) => {
      store.add(list.onDidChangePrimaryStatus(r));
      list.add({ id: "test", severity: Severity.Info });
    });
    deepStrictEqual(result, { id: "test", severity: Severity.Info });
  });
  test("primary is not updated to status without an icon", async () => {
    list.add({ id: "test", severity: Severity.Info, icon: Codicon.check });
    list.add({ id: "warning", severity: Severity.Warning });
    deepStrictEqual(list.primary, { id: "test", severity: Severity.Info, icon: Codicon.check });
  });
  test("add", () => {
    statusesEqual(list, []);
    list.add({ id: "info", severity: Severity.Info });
    statusesEqual(list, [
      ["info", Severity.Info]
    ]);
    list.add({ id: "warning", severity: Severity.Warning });
    statusesEqual(list, [
      ["info", Severity.Info],
      ["warning", Severity.Warning]
    ]);
    list.add({ id: "error", severity: Severity.Error });
    statusesEqual(list, [
      ["info", Severity.Info],
      ["warning", Severity.Warning],
      ["error", Severity.Error]
    ]);
  });
  test("add should remove animation", () => {
    statusesEqual(list, []);
    list.add({ id: "info", severity: Severity.Info, icon: spinningLoading });
    statusesEqual(list, [
      ["info", Severity.Info]
    ]);
    strictEqual(list.statuses[0].icon.id, Codicon.play.id, "loading~spin should be converted to play");
    list.add({ id: "warning", severity: Severity.Warning, icon: ThemeIcon.modify(Codicon.zap, "spin") });
    statusesEqual(list, [
      ["info", Severity.Info],
      ["warning", Severity.Warning]
    ]);
    strictEqual(list.statuses[1].icon.id, Codicon.zap.id, "zap~spin should have animation removed only");
  });
  test("add should fire onDidRemoveStatus if same status id with a different object reference was added", () => {
    const eventCalls = [];
    store.add(list.onDidAddStatus(() => eventCalls.push("add")));
    store.add(list.onDidRemoveStatus(() => eventCalls.push("remove")));
    list.add({ id: "test", severity: Severity.Info });
    list.add({ id: "test", severity: Severity.Info });
    deepStrictEqual(eventCalls, [
      "add",
      "remove",
      "add"
    ]);
  });
  test("remove", () => {
    list.add({ id: "info", severity: Severity.Info });
    list.add({ id: "warning", severity: Severity.Warning });
    list.add({ id: "error", severity: Severity.Error });
    statusesEqual(list, [
      ["info", Severity.Info],
      ["warning", Severity.Warning],
      ["error", Severity.Error]
    ]);
    list.remove("warning");
    statusesEqual(list, [
      ["info", Severity.Info],
      ["error", Severity.Error]
    ]);
    list.remove("info");
    statusesEqual(list, [
      ["error", Severity.Error]
    ]);
    list.remove("error");
    statusesEqual(list, []);
  });
  test("toggle", () => {
    const status = { id: "info", severity: Severity.Info };
    list.toggle(status, true);
    statusesEqual(list, [
      ["info", Severity.Info]
    ]);
    list.toggle(status, false);
    statusesEqual(list, []);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIvdGVybWluYWxTdGF0dXNMaXN0LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBkZWVwU3RyaWN0RXF1YWwsIHN0cmljdEVxdWFsIH0gZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgc3Bpbm5pbmdMb2FkaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2ljb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbFN0YXR1c0xpc3QgfSBmcm9tICcuLi8uLi9icm93c2VyL3Rlcm1pbmFsU3RhdHVzTGlzdC5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxTdGF0dXMgfSBmcm9tICcuLi8uLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcblxuZnVuY3Rpb24gc3RhdHVzZXNFcXVhbChsaXN0OiBUZXJtaW5hbFN0YXR1c0xpc3QsIGV4cGVjdGVkOiBbc3RyaW5nLCBTZXZlcml0eV1bXSkge1xuXHRkZWVwU3RyaWN0RXF1YWwobGlzdC5zdGF0dXNlcy5tYXAoZSA9PiBbZS5pZCwgZS5zZXZlcml0eV0pLCBleHBlY3RlZCk7XG59XG5cbnN1aXRlKCdXb3JrYmVuY2ggLSBUZXJtaW5hbFN0YXR1c0xpc3QnLCAoKSA9PiB7XG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cdGxldCBsaXN0OiBUZXJtaW5hbFN0YXR1c0xpc3Q7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0bGlzdCA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbFN0YXR1c0xpc3QpKTtcblx0fSk7XG5cblx0dGVzdCgncHJpbWFyeScsICgpID0+IHtcblx0XHRzdHJpY3RFcXVhbChsaXN0LnByaW1hcnk/LmlkLCB1bmRlZmluZWQpO1xuXHRcdGxpc3QuYWRkKHsgaWQ6ICdpbmZvMScsIHNldmVyaXR5OiBTZXZlcml0eS5JbmZvIH0pO1xuXHRcdHN0cmljdEVxdWFsKGxpc3QucHJpbWFyeT8uaWQsICdpbmZvMScpO1xuXHRcdGxpc3QuYWRkKHsgaWQ6ICd3YXJuaW5nMScsIHNldmVyaXR5OiBTZXZlcml0eS5XYXJuaW5nIH0pO1xuXHRcdHN0cmljdEVxdWFsKGxpc3QucHJpbWFyeT8uaWQsICd3YXJuaW5nMScpO1xuXHRcdGxpc3QuYWRkKHsgaWQ6ICdpbmZvMicsIHNldmVyaXR5OiBTZXZlcml0eS5JbmZvIH0pO1xuXHRcdHN0cmljdEVxdWFsKGxpc3QucHJpbWFyeT8uaWQsICd3YXJuaW5nMScpO1xuXHRcdGxpc3QuYWRkKHsgaWQ6ICd3YXJuaW5nMicsIHNldmVyaXR5OiBTZXZlcml0eS5XYXJuaW5nIH0pO1xuXHRcdHN0cmljdEVxdWFsKGxpc3QucHJpbWFyeT8uaWQsICd3YXJuaW5nMicpO1xuXHRcdGxpc3QuYWRkKHsgaWQ6ICdpbmZvMycsIHNldmVyaXR5OiBTZXZlcml0eS5JbmZvIH0pO1xuXHRcdHN0cmljdEVxdWFsKGxpc3QucHJpbWFyeT8uaWQsICd3YXJuaW5nMicpO1xuXHRcdGxpc3QuYWRkKHsgaWQ6ICdlcnJvcjEnLCBzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IgfSk7XG5cdFx0c3RyaWN0RXF1YWwobGlzdC5wcmltYXJ5Py5pZCwgJ2Vycm9yMScpO1xuXHRcdGxpc3QuYWRkKHsgaWQ6ICd3YXJuaW5nMycsIHNldmVyaXR5OiBTZXZlcml0eS5XYXJuaW5nIH0pO1xuXHRcdHN0cmljdEVxdWFsKGxpc3QucHJpbWFyeT8uaWQsICdlcnJvcjEnKTtcblx0XHRsaXN0LmFkZCh7IGlkOiAnZXJyb3IyJywgc2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yIH0pO1xuXHRcdHN0cmljdEVxdWFsKGxpc3QucHJpbWFyeT8uaWQsICdlcnJvcjInKTtcblx0XHRsaXN0LnJlbW92ZSgnZXJyb3IxJyk7XG5cdFx0c3RyaWN0RXF1YWwobGlzdC5wcmltYXJ5Py5pZCwgJ2Vycm9yMicpO1xuXHRcdGxpc3QucmVtb3ZlKCdlcnJvcjInKTtcblx0XHRzdHJpY3RFcXVhbChsaXN0LnByaW1hcnk/LmlkLCAnd2FybmluZzMnKTtcblx0fSk7XG5cblx0dGVzdCgnc3RhdHVzZXMnLCAoKSA9PiB7XG5cdFx0c3RyaWN0RXF1YWwobGlzdC5zdGF0dXNlcy5sZW5ndGgsIDApO1xuXHRcdGxpc3QuYWRkKHsgaWQ6ICdpbmZvJywgc2V2ZXJpdHk6IFNldmVyaXR5LkluZm8gfSk7XG5cdFx0bGlzdC5hZGQoeyBpZDogJ3dhcm5pbmcnLCBzZXZlcml0eTogU2V2ZXJpdHkuV2FybmluZyB9KTtcblx0XHRsaXN0LmFkZCh7IGlkOiAnZXJyb3InLCBzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IgfSk7XG5cdFx0c3RyaWN0RXF1YWwobGlzdC5zdGF0dXNlcy5sZW5ndGgsIDMpO1xuXHRcdHN0YXR1c2VzRXF1YWwobGlzdCwgW1xuXHRcdFx0WydpbmZvJywgU2V2ZXJpdHkuSW5mb10sXG5cdFx0XHRbJ3dhcm5pbmcnLCBTZXZlcml0eS5XYXJuaW5nXSxcblx0XHRcdFsnZXJyb3InLCBTZXZlcml0eS5FcnJvcl0sXG5cdFx0XSk7XG5cdFx0bGlzdC5yZW1vdmUoJ2luZm8nKTtcblx0XHRsaXN0LnJlbW92ZSgnd2FybmluZycpO1xuXHRcdGxpc3QucmVtb3ZlKCdlcnJvcicpO1xuXHRcdHN0cmljdEVxdWFsKGxpc3Quc3RhdHVzZXMubGVuZ3RoLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnb25EaWRBZGRTdGF0dXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgbmV3IFByb21pc2U8SVRlcm1pbmFsU3RhdHVzPihyID0+IHtcblx0XHRcdHN0b3JlLmFkZChsaXN0Lm9uRGlkQWRkU3RhdHVzKHIpKTtcblx0XHRcdGxpc3QuYWRkKHsgaWQ6ICd0ZXN0Jywgc2V2ZXJpdHk6IFNldmVyaXR5LkluZm8gfSk7XG5cdFx0fSk7XG5cdFx0ZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgeyBpZDogJ3Rlc3QnLCBzZXZlcml0eTogU2V2ZXJpdHkuSW5mbyB9KTtcblx0fSk7XG5cblx0dGVzdCgnb25EaWRSZW1vdmVTdGF0dXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgbmV3IFByb21pc2U8SVRlcm1pbmFsU3RhdHVzPihyID0+IHtcblx0XHRcdHN0b3JlLmFkZChsaXN0Lm9uRGlkUmVtb3ZlU3RhdHVzKHIpKTtcblx0XHRcdGxpc3QuYWRkKHsgaWQ6ICd0ZXN0Jywgc2V2ZXJpdHk6IFNldmVyaXR5LkluZm8gfSk7XG5cdFx0XHRsaXN0LnJlbW92ZSgndGVzdCcpO1xuXHRcdH0pO1xuXHRcdGRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIHsgaWQ6ICd0ZXN0Jywgc2V2ZXJpdHk6IFNldmVyaXR5LkluZm8gfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29uRGlkQ2hhbmdlUHJpbWFyeVN0YXR1cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgUHJvbWlzZTxJVGVybWluYWxTdGF0dXMgfCB1bmRlZmluZWQ+KHIgPT4ge1xuXHRcdFx0c3RvcmUuYWRkKGxpc3Qub25EaWRDaGFuZ2VQcmltYXJ5U3RhdHVzKHIpKTtcblx0XHRcdGxpc3QuYWRkKHsgaWQ6ICd0ZXN0Jywgc2V2ZXJpdHk6IFNldmVyaXR5LkluZm8gfSk7XG5cdFx0fSk7XG5cdFx0ZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgeyBpZDogJ3Rlc3QnLCBzZXZlcml0eTogU2V2ZXJpdHkuSW5mbyB9KTtcblx0fSk7XG5cblx0dGVzdCgncHJpbWFyeSBpcyBub3QgdXBkYXRlZCB0byBzdGF0dXMgd2l0aG91dCBhbiBpY29uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxpc3QuYWRkKHsgaWQ6ICd0ZXN0Jywgc2V2ZXJpdHk6IFNldmVyaXR5LkluZm8sIGljb246IENvZGljb24uY2hlY2sgfSk7XG5cdFx0bGlzdC5hZGQoeyBpZDogJ3dhcm5pbmcnLCBzZXZlcml0eTogU2V2ZXJpdHkuV2FybmluZyB9KTtcblx0XHRkZWVwU3RyaWN0RXF1YWwobGlzdC5wcmltYXJ5LCB7IGlkOiAndGVzdCcsIHNldmVyaXR5OiBTZXZlcml0eS5JbmZvLCBpY29uOiBDb2RpY29uLmNoZWNrIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhZGQnLCAoKSA9PiB7XG5cdFx0c3RhdHVzZXNFcXVhbChsaXN0LCBbXSk7XG5cdFx0bGlzdC5hZGQoeyBpZDogJ2luZm8nLCBzZXZlcml0eTogU2V2ZXJpdHkuSW5mbyB9KTtcblx0XHRzdGF0dXNlc0VxdWFsKGxpc3QsIFtcblx0XHRcdFsnaW5mbycsIFNldmVyaXR5LkluZm9dXG5cdFx0XSk7XG5cdFx0bGlzdC5hZGQoeyBpZDogJ3dhcm5pbmcnLCBzZXZlcml0eTogU2V2ZXJpdHkuV2FybmluZyB9KTtcblx0XHRzdGF0dXNlc0VxdWFsKGxpc3QsIFtcblx0XHRcdFsnaW5mbycsIFNldmVyaXR5LkluZm9dLFxuXHRcdFx0Wyd3YXJuaW5nJywgU2V2ZXJpdHkuV2FybmluZ11cblx0XHRdKTtcblx0XHRsaXN0LmFkZCh7IGlkOiAnZXJyb3InLCBzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IgfSk7XG5cdFx0c3RhdHVzZXNFcXVhbChsaXN0LCBbXG5cdFx0XHRbJ2luZm8nLCBTZXZlcml0eS5JbmZvXSxcblx0XHRcdFsnd2FybmluZycsIFNldmVyaXR5Lldhcm5pbmddLFxuXHRcdFx0WydlcnJvcicsIFNldmVyaXR5LkVycm9yXVxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhZGQgc2hvdWxkIHJlbW92ZSBhbmltYXRpb24nLCAoKSA9PiB7XG5cdFx0c3RhdHVzZXNFcXVhbChsaXN0LCBbXSk7XG5cdFx0bGlzdC5hZGQoeyBpZDogJ2luZm8nLCBzZXZlcml0eTogU2V2ZXJpdHkuSW5mbywgaWNvbjogc3Bpbm5pbmdMb2FkaW5nIH0pO1xuXHRcdHN0YXR1c2VzRXF1YWwobGlzdCwgW1xuXHRcdFx0WydpbmZvJywgU2V2ZXJpdHkuSW5mb11cblx0XHRdKTtcblx0XHRzdHJpY3RFcXVhbChsaXN0LnN0YXR1c2VzWzBdLmljb24hLmlkLCBDb2RpY29uLnBsYXkuaWQsICdsb2FkaW5nfnNwaW4gc2hvdWxkIGJlIGNvbnZlcnRlZCB0byBwbGF5Jyk7XG5cdFx0bGlzdC5hZGQoeyBpZDogJ3dhcm5pbmcnLCBzZXZlcml0eTogU2V2ZXJpdHkuV2FybmluZywgaWNvbjogVGhlbWVJY29uLm1vZGlmeShDb2RpY29uLnphcCwgJ3NwaW4nKSB9KTtcblx0XHRzdGF0dXNlc0VxdWFsKGxpc3QsIFtcblx0XHRcdFsnaW5mbycsIFNldmVyaXR5LkluZm9dLFxuXHRcdFx0Wyd3YXJuaW5nJywgU2V2ZXJpdHkuV2FybmluZ11cblx0XHRdKTtcblx0XHRzdHJpY3RFcXVhbChsaXN0LnN0YXR1c2VzWzFdLmljb24hLmlkLCBDb2RpY29uLnphcC5pZCwgJ3phcH5zcGluIHNob3VsZCBoYXZlIGFuaW1hdGlvbiByZW1vdmVkIG9ubHknKTtcblx0fSk7XG5cblx0dGVzdCgnYWRkIHNob3VsZCBmaXJlIG9uRGlkUmVtb3ZlU3RhdHVzIGlmIHNhbWUgc3RhdHVzIGlkIHdpdGggYSBkaWZmZXJlbnQgb2JqZWN0IHJlZmVyZW5jZSB3YXMgYWRkZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXZlbnRDYWxsczogc3RyaW5nW10gPSBbXTtcblx0XHRzdG9yZS5hZGQobGlzdC5vbkRpZEFkZFN0YXR1cygoKSA9PiBldmVudENhbGxzLnB1c2goJ2FkZCcpKSk7XG5cdFx0c3RvcmUuYWRkKGxpc3Qub25EaWRSZW1vdmVTdGF0dXMoKCkgPT4gZXZlbnRDYWxscy5wdXNoKCdyZW1vdmUnKSkpO1xuXHRcdGxpc3QuYWRkKHsgaWQ6ICd0ZXN0Jywgc2V2ZXJpdHk6IFNldmVyaXR5LkluZm8gfSk7XG5cdFx0bGlzdC5hZGQoeyBpZDogJ3Rlc3QnLCBzZXZlcml0eTogU2V2ZXJpdHkuSW5mbyB9KTtcblx0XHRkZWVwU3RyaWN0RXF1YWwoZXZlbnRDYWxscywgW1xuXHRcdFx0J2FkZCcsXG5cdFx0XHQncmVtb3ZlJyxcblx0XHRcdCdhZGQnXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbW92ZScsICgpID0+IHtcblx0XHRsaXN0LmFkZCh7IGlkOiAnaW5mbycsIHNldmVyaXR5OiBTZXZlcml0eS5JbmZvIH0pO1xuXHRcdGxpc3QuYWRkKHsgaWQ6ICd3YXJuaW5nJywgc2V2ZXJpdHk6IFNldmVyaXR5Lldhcm5pbmcgfSk7XG5cdFx0bGlzdC5hZGQoeyBpZDogJ2Vycm9yJywgc2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yIH0pO1xuXHRcdHN0YXR1c2VzRXF1YWwobGlzdCwgW1xuXHRcdFx0WydpbmZvJywgU2V2ZXJpdHkuSW5mb10sXG5cdFx0XHRbJ3dhcm5pbmcnLCBTZXZlcml0eS5XYXJuaW5nXSxcblx0XHRcdFsnZXJyb3InLCBTZXZlcml0eS5FcnJvcl1cblx0XHRdKTtcblx0XHRsaXN0LnJlbW92ZSgnd2FybmluZycpO1xuXHRcdHN0YXR1c2VzRXF1YWwobGlzdCwgW1xuXHRcdFx0WydpbmZvJywgU2V2ZXJpdHkuSW5mb10sXG5cdFx0XHRbJ2Vycm9yJywgU2V2ZXJpdHkuRXJyb3JdXG5cdFx0XSk7XG5cdFx0bGlzdC5yZW1vdmUoJ2luZm8nKTtcblx0XHRzdGF0dXNlc0VxdWFsKGxpc3QsIFtcblx0XHRcdFsnZXJyb3InLCBTZXZlcml0eS5FcnJvcl1cblx0XHRdKTtcblx0XHRsaXN0LnJlbW92ZSgnZXJyb3InKTtcblx0XHRzdGF0dXNlc0VxdWFsKGxpc3QsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgndG9nZ2xlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHN0YXR1cyA9IHsgaWQ6ICdpbmZvJywgc2V2ZXJpdHk6IFNldmVyaXR5LkluZm8gfTtcblx0XHRsaXN0LnRvZ2dsZShzdGF0dXMsIHRydWUpO1xuXHRcdHN0YXR1c2VzRXF1YWwobGlzdCwgW1xuXHRcdFx0WydpbmZvJywgU2V2ZXJpdHkuSW5mb11cblx0XHRdKTtcblx0XHRsaXN0LnRvZ2dsZShzdGF0dXMsIGZhbHNlKTtcblx0XHRzdGF0dXNlc0VxdWFsKGxpc3QsIFtdKTtc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
