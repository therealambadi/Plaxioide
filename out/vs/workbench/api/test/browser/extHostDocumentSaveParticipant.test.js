import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import { ExtHostDocuments } from "../../common/extHostDocuments.js";
import { ExtHostDocumentsAndEditors } from "../../common/extHostDocumentsAndEditors.js";
import { TextDocumentSaveReason, TextEdit, Position, EndOfLine } from "../../common/extHostTypes.js";
import { ExtHostDocumentSaveParticipant } from "../../common/extHostDocumentSaveParticipant.js";
import { SingleProxyRPCProtocol } from "../common/testRPCProtocol.js";
import { SaveReason } from "../../../common/editor.js";
import { mock } from "../../../../base/test/common/mock.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
import { nullExtensionDescription } from "../../../services/extensions/common/extensions.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
function timeout(n) {
  return new Promise((resolve) => setTimeout(resolve, n));
}
suite("ExtHostDocumentSaveParticipant", () => {
  const resource = URI.parse("foo:bar");
  const mainThreadBulkEdits = new class extends mock() {
  }();
  let documents;
  const nullLogService = new NullLogService();
  setup(() => {
    const documentsAndEditors = new ExtHostDocumentsAndEditors(SingleProxyRPCProtocol(null), new NullLogService());
    documentsAndEditors.$acceptDocumentsAndEditorsDelta({
      addedDocuments: [{
        isDirty: false,
        languageId: "foo",
        uri: resource,
        versionId: 1,
        lines: ["foo"],
        EOL: "\n",
        encoding: "utf8"
      }]
    });
    documents = new ExtHostDocuments(SingleProxyRPCProtocol(null), documentsAndEditors);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("no listeners, no problem", () => {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, mainThreadBulkEdits);
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then(() => assert.ok(true));
  });
  test("event delivery", () => {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, mainThreadBulkEdits);
    let event;
    const sub = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(e) {
      event = e;
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then(() => {
      sub.dispose();
      assert.ok(event);
      assert.strictEqual(event.reason, TextDocumentSaveReason.Manual);
      assert.strictEqual(typeof event.waitUntil, "function");
    });
  });
  test("event delivery, immutable", () => {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, mainThreadBulkEdits);
    let event;
    const sub = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(e) {
      event = e;
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then(() => {
      sub.dispose();
      assert.ok(event);
      assert.throws(() => {
        event.document = null;
      });
    });
  });
  test("event delivery, bad listener", () => {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, mainThreadBulkEdits);
    const sub = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(e) {
      throw new Error("\u{1F480}");
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then((values) => {
      sub.dispose();
      const [first] = values;
      assert.strictEqual(first, false);
    });
  });
  test("event delivery, bad listener doesn't prevent more events", () => {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, mainThreadBulkEdits);
    const sub1 = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(e) {
      throw new Error("\u{1F480}");
    });
    let event;
    const sub2 = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(e) {
      event = e;
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then(() => {
      sub1.dispose();
      sub2.dispose();
      assert.ok(event);
    });
  });
  test("event delivery, in subscriber order", () => {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, mainThreadBulkEdits);
    let counter = 0;
    const sub1 = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(event) {
      assert.strictEqual(counter++, 0);
    });
    const sub2 = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(event) {
      assert.strictEqual(counter++, 1);
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then(() => {
      sub1.dispose();
      sub2.dispose();
    });
  });
  test("event delivery, ignore bad listeners", async () => {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, mainThreadBulkEdits, { timeout: 5, errors: 1 });
    let callCount = 0;
    const sub = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(event) {
      callCount += 1;
      throw new Error("boom");
    });
    await participant.$participateInSave(resource, SaveReason.EXPLICIT);
    await participant.$participateInSave(resource, SaveReason.EXPLICIT);
    await participant.$participateInSave(resource, SaveReason.EXPLICIT);
    await participant.$participateInSave(resource, SaveReason.EXPLICIT);
    sub.dispose();
    assert.strictEqual(callCount, 2);
  });
  test("event delivery, overall timeout", async function() {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, mainThreadBulkEdits, { timeout: 20, errors: 5 });
    const calls = [];
    const sub1 = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(event) {
      calls.push(1);
    });
    const sub2 = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(event) {
      calls.push(2);
      event.waitUntil(timeout(100));
    });
    const sub3 = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(event) {
      calls.push(3);
    });
    const values = await participant.$participateInSave(resource, SaveReason.EXPLICIT);
    sub1.dispose();
    sub2.dispose();
    sub3.dispose();
    assert.deepStrictEqual(calls, [1, 2]);
    assert.strictEqual(values.length, 2);
  });
  test("event delivery, waitUntil", () => {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, mainThreadBulkEdits);
    const sub = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(event) {
      event.waitUntil(timeout(10));
      event.waitUntil(timeout(10));
      event.waitUntil(timeout(10));
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then(() => {
      sub.dispose();
    });
  });
  test("event delivery, waitUntil must be called sync", () => {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, mainThreadBulkEdits);
    const sub = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(event) {
      event.waitUntil(new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            assert.throws(() => event.waitUntil(timeout(10)));
            resolve(void 0);
          } catch (e) {
            reject(e);
          }
        }, 10);
      }));
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then(() => {
      sub.dispose();
    });
  });
  test("event delivery, waitUntil will timeout", function() {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, mainThreadBulkEdits, { timeout: 5, errors: 3 });
    const sub = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(event) {
      event.waitUntil(timeout(100));
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then((values) => {
      sub.dispose();
      const [first] = values;
      assert.strictEqual(first, false);
    });
  });
  test("event delivery, waitUntil failure handling", () => {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, mainThreadBulkEdits);
    const sub1 = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(e) {
      e.waitUntil(Promise.reject(new Error("dddd")));
    });
    let event;
    const sub2 = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(e) {
      event = e;
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then(() => {
      assert.ok(event);
      sub1.dispose();
      sub2.dispose();
    });
  });
  test("event delivery, pushEdits sync", () => {
    let dto;
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, new class extends mock() {
      $tryApplyWorkspaceEdit(_edits) {
        dto = _edits.value;
        return Promise.resolve(true);
      }
    }());
    const sub = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(e) {
      e.waitUntil(Promise.resolve([TextEdit.insert(new Position(0, 0), "bar")]));
      e.waitUntil(Promise.resolve([TextEdit.setEndOfLine(EndOfLine.CRLF)]));
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then(() => {
      sub.dispose();
      assert.strictEqual(dto.edits.length, 2);
      assert.ok(dto.edits[0].textEdit);
      assert.ok(dto.edits[1].textEdit);
    });
  });
  test("event delivery, concurrent change", () => {
    let edits;
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, new class extends mock() {
      $tryApplyWorkspaceEdit(_edits) {
        edits = _edits.value;
        return Promise.resolve(true);
      }
    }());
    const sub = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(e) {
      documents.$acceptModelChanged(resource, {
        changes: [{
          range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
          rangeOffset: void 0,
          rangeLength: void 0,
          text: "bar"
        }],
        eol: void 0,
        versionId: 2,
        isRedoing: false,
        isUndoing: false
      }, true);
      e.waitUntil(Promise.resolve([TextEdit.insert(new Position(0, 0), "bar")]));
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then((values) => {
      sub.dispose();
      assert.strictEqual(edits, void 0);
      assert.strictEqual(values[0], false);
    });
  });
  test("event delivery, two listeners -> two document states", () => {
    const participant = new ExtHostDocumentSaveParticipant(nullLogService, documents, new class extends mock() {
      $tryApplyWorkspaceEdit(dto) {
        for (const edit of dto.value.edits) {
          const uri = URI.revive(edit.resource);
          const { text, range } = edit.textEdit;
          documents.$acceptModelChanged(uri, {
            changes: [{
              range,
              text,
              rangeOffset: void 0,
              rangeLength: void 0
            }],
            eol: void 0,
            versionId: documents.getDocumentData(uri).version + 1,
            isRedoing: false,
            isUndoing: false
          }, true);
        }
        return Promise.resolve(true);
      }
    }());
    const document = documents.getDocument(resource);
    const sub1 = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(e) {
      assert.strictEqual(document.version, 1);
      assert.strictEqual(document.getText(), "foo");
      e.waitUntil(Promise.resolve([TextEdit.insert(new Position(0, 0), "bar")]));
    });
    const sub2 = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(e) {
      assert.strictEqual(document.version, 2);
      assert.strictEqual(document.getText(), "barfoo");
      e.waitUntil(Promise.resolve([TextEdit.insert(new Position(0, 0), "bar")]));
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then((values) => {
      sub1.dispose();
      sub2.dispose();
      assert.strictEqual(document.version, 3);
      assert.strictEqual(document.getText(), "barbarfoo");
    });
  });
  test("Log failing listener", function() {
    let didLogSomething = false;
    const participant = new ExtHostDocumentSaveParticipant(new class extends NullLogService {
      error(message, ...args) {
        didLogSomething = true;
      }
    }(), documents, mainThreadBulkEdits);
    const sub = participant.getOnWillSaveTextDocumentEvent(nullExtensionDescription)(function(e) {
      throw new Error("boom");
    });
    return participant.$participateInSave(resource, SaveReason.EXPLICIT).then(() => {
      sub.dispose();
      assert.strictEqual(didLogSomething, true);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0RG9jdW1lbnRTYXZlUGFydGljaXBhbnQudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRXh0SG9zdERvY3VtZW50cyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0RG9jdW1lbnRzLmpzJztcbmltcG9ydCB7IEV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzLmpzJztcbmltcG9ydCB7IFRleHREb2N1bWVudFNhdmVSZWFzb24sIFRleHRFZGl0LCBQb3NpdGlvbiwgRW5kT2ZMaW5lIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBNYWluVGhyZWFkVGV4dEVkaXRvcnNTaGFwZSwgSVdvcmtzcGFjZUVkaXREdG8sIElXb3Jrc3BhY2VUZXh0RWRpdER0bywgTWFpblRocmVhZEJ1bGtFZGl0c1NoYXBlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgRXh0SG9zdERvY3VtZW50U2F2ZVBhcnRpY2lwYW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3REb2N1bWVudFNhdmVQYXJ0aWNpcGFudC5qcyc7XG5pbXBvcnQgeyBTaW5nbGVQcm94eVJQQ1Byb3RvY29sIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RSUENQcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBTYXZlUmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgdHlwZSAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0IHsgbW9jayB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL3Byb3h5SWRlbnRpZmllci5qcyc7XG5cbmZ1bmN0aW9uIHRpbWVvdXQobjogbnVtYmVyKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbikpO1xufVxuXG5zdWl0ZSgnRXh0SG9zdERvY3VtZW50U2F2ZVBhcnRpY2lwYW50JywgKCkgPT4ge1xuXG5cdGNvbnN0IHJlc291cmNlID0gVVJJLnBhcnNlKCdmb286YmFyJyk7XG5cdGNvbnN0IG1haW5UaHJlYWRCdWxrRWRpdHMgPSBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPE1haW5UaHJlYWRCdWxrRWRpdHNTaGFwZT4oKSB7IH07XG5cdGxldCBkb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHM7XG5cdGNvbnN0IG51bGxMb2dTZXJ2aWNlID0gbmV3IE51bGxMb2dTZXJ2aWNlKCk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGNvbnN0IGRvY3VtZW50c0FuZEVkaXRvcnMgPSBuZXcgRXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMoU2luZ2xlUHJveHlSUENQcm90b2NvbChudWxsKSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGRvY3VtZW50c0FuZEVkaXRvcnMuJGFjY2VwdERvY3VtZW50c0FuZEVkaXRvcnNEZWx0YSh7XG5cdFx0XHRhZGRlZERvY3VtZW50czogW3tcblx0XHRcdFx0aXNEaXJ0eTogZmFsc2UsXG5cdFx0XHRcdGxhbmd1YWdlSWQ6ICdmb28nLFxuXHRcdFx0XHR1cmk6IHJlc291cmNlLFxuXHRcdFx0XHR2ZXJzaW9uSWQ6IDEsXG5cdFx0XHRcdGxpbmVzOiBbJ2ZvbyddLFxuXHRcdFx0XHRFT0w6ICdcXG4nLFxuXHRcdFx0XHRlbmNvZGluZzogJ3V0ZjgnXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHRcdGRvY3VtZW50cyA9IG5ldyBFeHRIb3N0RG9jdW1lbnRzKFNpbmdsZVByb3h5UlBDUHJvdG9jb2wobnVsbCksIGRvY3VtZW50c0FuZEVkaXRvcnMpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdubyBsaXN0ZW5lcnMsIG5vIHByb2JsZW0nLCAoKSA9PiB7XG5cdFx0Y29uc3QgcGFydGljaXBhbnQgPSBuZXcgRXh0SG9zdERvY3VtZW50U2F2ZVBhcnRpY2lwYW50KG51bGxMb2dTZXJ2aWNlLCBkb2N1bWVudHMsIG1haW5UaHJlYWRCdWxrRWRpdHMpO1xuXHRcdHJldHVybiBwYXJ0aWNpcGFudC4kcGFydGljaXBhdGVJblNhdmUocmVzb3VyY2UsIFNhdmVSZWFzb24uRVhQTElDSVQpLnRoZW4oKCkgPT4gYXNzZXJ0Lm9rKHRydWUpKTtcblx0fSk7XG5cblx0dGVzdCgnZXZlbnQgZGVsaXZlcnknLCAoKSA9PiB7XG5cdFx0Y29uc3QgcGFydGljaXBhbnQgPSBuZXcgRXh0SG9zdERvY3VtZW50U2F2ZVBhcnRpY2lwYW50KG51bGxMb2dTZXJ2aWNlLCBkb2N1bWVudHMsIG1haW5UaHJlYWRCdWxrRWRpdHMpO1xuXG5cdFx0bGV0IGV2ZW50OiB2c2NvZGUuVGV4dERvY3VtZW50V2lsbFNhdmVFdmVudDtcblx0XHRjb25zdCBzdWIgPSBwYXJ0aWNpcGFudC5nZXRPbldpbGxTYXZlVGV4dERvY3VtZW50RXZlbnQobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uKShmdW5jdGlvbiAoZSkge1xuXHRcdFx0ZXZlbnQgPSBlO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHBhcnRpY2lwYW50LiRwYXJ0aWNpcGF0ZUluU2F2ZShyZXNvdXJjZSwgU2F2ZVJlYXNvbi5FWFBMSUNJVCkudGhlbigoKSA9PiB7XG5cdFx0XHRzdWIuZGlzcG9zZSgpO1xuXG5cdFx0XHRhc3NlcnQub2soZXZlbnQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnJlYXNvbiwgVGV4dERvY3VtZW50U2F2ZVJlYXNvbi5NYW51YWwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBldmVudC53YWl0VW50aWwsICdmdW5jdGlvbicpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdldmVudCBkZWxpdmVyeSwgaW1tdXRhYmxlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBhcnRpY2lwYW50ID0gbmV3IEV4dEhvc3REb2N1bWVudFNhdmVQYXJ0aWNpcGFudChudWxsTG9nU2VydmljZSwgZG9jdW1lbnRzLCBtYWluVGhyZWFkQnVsa0VkaXRzKTtcblxuXHRcdGxldCBldmVudDogdnNjb2RlLlRleHREb2N1bWVudFdpbGxTYXZlRXZlbnQ7XG5cdFx0Y29uc3Qgc3ViID0gcGFydGljaXBhbnQuZ2V0T25XaWxsU2F2ZVRleHREb2N1bWVudEV2ZW50KG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbikoZnVuY3Rpb24gKGUpIHtcblx0XHRcdGV2ZW50ID0gZTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBwYXJ0aWNpcGFudC4kcGFydGljaXBhdGVJblNhdmUocmVzb3VyY2UsIFNhdmVSZWFzb24uRVhQTElDSVQpLnRoZW4oKCkgPT4ge1xuXHRcdFx0c3ViLmRpc3Bvc2UoKTtcblxuXHRcdFx0YXNzZXJ0Lm9rKGV2ZW50KTtcblx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4geyAoZXZlbnQuZG9jdW1lbnQgYXMgYW55KSA9IG51bGwhOyB9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZXZlbnQgZGVsaXZlcnksIGJhZCBsaXN0ZW5lcicsICgpID0+IHtcblx0XHRjb25zdCBwYXJ0aWNpcGFudCA9IG5ldyBFeHRIb3N0RG9jdW1lbnRTYXZlUGFydGljaXBhbnQobnVsbExvZ1NlcnZpY2UsIGRvY3VtZW50cywgbWFpblRocmVhZEJ1bGtFZGl0cyk7XG5cblx0XHRjb25zdCBzdWIgPSBwYXJ0aWNpcGFudC5nZXRPbldpbGxTYXZlVGV4dERvY3VtZW50RXZlbnQobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uKShmdW5jdGlvbiAoZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdcdUQ4M0RcdURDODAnKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBwYXJ0aWNpcGFudC4kcGFydGljaXBhdGVJblNhdmUocmVzb3VyY2UsIFNhdmVSZWFzb24uRVhQTElDSVQpLnRoZW4odmFsdWVzID0+IHtcblx0XHRcdHN1Yi5kaXNwb3NlKCk7XG5cblx0XHRcdGNvbnN0IFtmaXJzdF0gPSB2YWx1ZXM7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QsIGZhbHNlKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZXZlbnQgZGVsaXZlcnksIGJhZCBsaXN0ZW5lciBkb2VzblxcJ3QgcHJldmVudCBtb3JlIGV2ZW50cycsICgpID0+IHtcblx0XHRjb25zdCBwYXJ0aWNpcGFudCA9IG5ldyBFeHRIb3N0RG9jdW1lbnRTYXZlUGFydGljaXBhbnQobnVsbExvZ1NlcnZpY2UsIGRvY3VtZW50cywgbWFpblRocmVhZEJ1bGtFZGl0cyk7XG5cblx0XHRjb25zdCBzdWIxID0gcGFydGljaXBhbnQuZ2V0T25XaWxsU2F2ZVRleHREb2N1bWVudEV2ZW50KG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbikoZnVuY3Rpb24gKGUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignXHVEODNEXHVEQzgwJyk7XG5cdFx0fSk7XG5cdFx0bGV0IGV2ZW50OiB2c2NvZGUuVGV4dERvY3VtZW50V2lsbFNhdmVFdmVudDtcblx0XHRjb25zdCBzdWIyID0gcGFydGljaXBhbnQuZ2V0T25XaWxsU2F2ZVRleHREb2N1bWVudEV2ZW50KG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbikoZnVuY3Rpb24gKGUpIHtcblx0XHRcdGV2ZW50ID0gZTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBwYXJ0aWNpcGFudC4kcGFydGljaXBhdGVJblNhdmUocmVzb3VyY2UsIFNhdmVSZWFzb24uRVhQTElDSVQpLnRoZW4oKCkgPT4ge1xuXHRcdFx0c3ViMS5kaXNwb3NlKCk7XG5cdFx0XHRzdWIyLmRpc3Bvc2UoKTtcblxuXHRcdFx0YXNzZXJ0Lm9rKGV2ZW50KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZXZlbnQgZGVsaXZlcnksIGluIHN1YnNjcmliZXIgb3JkZXInLCAoKSA9PiB7XG5cdFx0Y29uc3QgcGFydGljaXBhbnQgPSBuZXcgRXh0SG9zdERvY3VtZW50U2F2ZVBhcnRpY2lwYW50KG51bGxMb2dTZXJ2aWNlLCBkb2N1bWVudHMsIG1haW5UaHJlYWRCdWxrRWRpdHMpO1xuXG5cdFx0bGV0IGNvdW50ZXIgPSAwO1xuXHRcdGNvbnN0IHN1YjEgPSBwYXJ0aWNpcGFudC5nZXRPbldpbGxTYXZlVGV4dERvY3VtZW50RXZlbnQobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uKShmdW5jdGlvbiAoZXZlbnQpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudGVyKyssIDApO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgc3ViMiA9IHBhcnRpY2lwYW50LmdldE9uV2lsbFNhdmVUZXh0RG9jdW1lbnRFdmVudChudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24pKGZ1bmN0aW9uIChldmVudCkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIrKywgMSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcGFydGljaXBhbnQuJHBhcnRpY2lwYXRlSW5TYXZlKHJlc291cmNlLCBTYXZlUmVhc29uLkVYUExJQ0lUKS50aGVuKCgpID0+IHtcblx0XHRcdHN1YjEuZGlzcG9zZSgpO1xuXHRcdFx0c3ViMi5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V2ZW50IGRlbGl2ZXJ5LCBpZ25vcmUgYmFkIGxpc3RlbmVycycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwYXJ0aWNpcGFudCA9IG5ldyBFeHRIb3N0RG9jdW1lbnRTYXZlUGFydGljaXBhbnQobnVsbExvZ1NlcnZpY2UsIGRvY3VtZW50cywgbWFpblRocmVhZEJ1bGtFZGl0cywgeyB0aW1lb3V0OiA1LCBlcnJvcnM6IDEgfSk7XG5cblx0XHRsZXQgY2FsbENvdW50ID0gMDtcblx0XHRjb25zdCBzdWIgPSBwYXJ0aWNpcGFudC5nZXRPbldpbGxTYXZlVGV4dERvY3VtZW50RXZlbnQobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uKShmdW5jdGlvbiAoZXZlbnQpIHtcblx0XHRcdGNhbGxDb3VudCArPSAxO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdib29tJyk7XG5cdFx0fSk7XG5cblx0XHRhd2FpdCBwYXJ0aWNpcGFudC4kcGFydGljaXBhdGVJblNhdmUocmVzb3VyY2UsIFNhdmVSZWFzb24uRVhQTElDSVQpO1xuXHRcdGF3YWl0IHBhcnRpY2lwYW50LiRwYXJ0aWNpcGF0ZUluU2F2ZShyZXNvdXJjZSwgU2F2ZVJlYXNvbi5FWFBMSUNJVCk7XG5cdFx0YXdhaXQgcGFydGljaXBhbnQuJHBhcnRpY2lwYXRlSW5TYXZlKHJlc291cmNlLCBTYXZlUmVhc29uLkVYUExJQ0lUKTtcblx0XHRhd2FpdCBwYXJ0aWNpcGFudC4kcGFydGljaXBhdGVJblNhdmUocmVzb3VyY2UsIFNhdmVSZWFzb24uRVhQTElDSVQpO1xuXG5cdFx0c3ViLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbENvdW50LCAyKTtcblx0fSk7XG5cblx0dGVzdCgnZXZlbnQgZGVsaXZlcnksIG92ZXJhbGwgdGltZW91dCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwYXJ0aWNpcGFudCA9IG5ldyBFeHRIb3N0RG9jdW1lbnRTYXZlUGFydGljaXBhbnQobnVsbExvZ1NlcnZpY2UsIGRvY3VtZW50cywgbWFpblRocmVhZEJ1bGtFZGl0cywgeyB0aW1lb3V0OiAyMCwgZXJyb3JzOiA1IH0pO1xuXG5cdFx0Ly8gbGV0IGNhbGxDb3VudCA9IDA7XG5cdFx0Y29uc3QgY2FsbHM6IG51bWJlcltdID0gW107XG5cdFx0Y29uc3Qgc3ViMSA9IHBhcnRpY2lwYW50LmdldE9uV2lsbFNhdmVUZXh0RG9jdW1lbnRFdmVudChudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24pKGZ1bmN0aW9uIChldmVudCkge1xuXHRcdFx0Y2FsbHMucHVzaCgxKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHN1YjIgPSBwYXJ0aWNpcGFudC5nZXRPbldpbGxTYXZlVGV4dERvY3VtZW50RXZlbnQobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uKShmdW5jdGlvbiAoZXZlbnQpIHtcblx0XHRcdGNhbGxzLnB1c2goMik7XG5cdFx0XHRldmVudC53YWl0VW50aWwodGltZW91dCgxMDApKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHN1YjMgPSBwYXJ0aWNpcGFudC5nZXRPbldpbGxTYXZlVGV4dERvY3VtZW50RXZlbnQobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uKShmdW5jdGlvbiAoZXZlbnQpIHtcblx0XHRcdGNhbGxzLnB1c2goMyk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCB2YWx1ZXMgPSBhd2FpdCBwYXJ0aWNpcGFudC4kcGFydGljaXBhdGVJblNhdmUocmVzb3VyY2UsIFNhdmVSZWFzb24uRVhQTElDSVQpO1xuXHRcdHN1YjEuZGlzcG9zZSgpO1xuXHRcdHN1YjIuZGlzcG9zZSgpO1xuXHRcdHN1YjMuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFsxLCAyXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlcy5sZW5ndGgsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdldmVudCBkZWxpdmVyeSwgd2FpdFVudGlsJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBhcnRpY2lwYW50ID0gbmV3IEV4dEhvc3REb2N1bWVudFNhdmVQYXJ0aWNpcGFudChudWxsTG9nU2VydmljZSwgZG9jdW1lbnRzLCBtYWluVGhyZWFkQnVsa0VkaXRzKTtcblxuXHRcdGNvbnN0IHN1YiA9IHBhcnRpY2lwYW50LmdldE9uV2lsbFNhdmVUZXh0RG9jdW1lbnRFdmVudChudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24pKGZ1bmN0aW9uIChldmVudCkge1xuXG5cdFx0XHRldmVudC53YWl0VW50aWwodGltZW91dCgxMCkpO1xuXHRcdFx0ZXZlbnQud2FpdFVudGlsKHRpbWVvdXQoMTApKTtcblx0XHRcdGV2ZW50LndhaXRVbnRpbCh0aW1lb3V0KDEwKSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcGFydGljaXBhbnQuJHBhcnRpY2lwYXRlSW5TYXZlKHJlc291cmNlLCBTYXZlUmVhc29uLkVYUExJQ0lUKS50aGVuKCgpID0+IHtcblx0XHRcdHN1Yi5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0fSk7XG5cblx0dGVzdCgnZXZlbnQgZGVsaXZlcnksIHdhaXRVbnRpbCBtdXN0IGJlIGNhbGxlZCBzeW5jJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBhcnRpY2lwYW50ID0gbmV3IEV4dEhvc3REb2N1bWVudFNhdmVQYXJ0aWNpcGFudChudWxsTG9nU2VydmljZSwgZG9jdW1lbnRzLCBtYWluVGhyZWFkQnVsa0VkaXRzKTtcblxuXHRcdGNvbnN0IHN1YiA9IHBhcnRpY2lwYW50LmdldE9uV2lsbFNhdmVUZXh0RG9jdW1lbnRFdmVudChudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24pKGZ1bmN0aW9uIChldmVudCkge1xuXG5cdFx0XHRldmVudC53YWl0VW50aWwobmV3IFByb21pc2U8dW5kZWZpbmVkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IGV2ZW50LndhaXRVbnRpbCh0aW1lb3V0KDEwKSkpO1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdHJlamVjdChlKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0fSwgMTApO1xuXHRcdFx0fSkpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHBhcnRpY2lwYW50LiRwYXJ0aWNpcGF0ZUluU2F2ZShyZXNvdXJjZSwgU2F2ZVJlYXNvbi5FWFBMSUNJVCkudGhlbigoKSA9PiB7XG5cdFx0XHRzdWIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdldmVudCBkZWxpdmVyeSwgd2FpdFVudGlsIHdpbGwgdGltZW91dCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHBhcnRpY2lwYW50ID0gbmV3IEV4dEhvc3REb2N1bWVudFNhdmVQYXJ0aWNpcGFudChudWxsTG9nU2VydmljZSwgZG9jdW1lbnRzLCBtYWluVGhyZWFkQnVsa0VkaXRzLCB7IHRpbWVvdXQ6IDUsIGVycm9yczogMyB9KTtcblxuXHRcdGNvbnN0IHN1YiA9IHBhcnRpY2lwYW50LmdldE9uV2lsbFNhdmVUZXh0RG9jdW1lbnRFdmVudChudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24pKGZ1bmN0aW9uIChldmVudCkge1xuXHRcdFx0ZXZlbnQud2FpdFVudGlsKHRpbWVvdXQoMTAwKSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcGFydGljaXBhbnQuJHBhcnRpY2lwYXRlSW5TYXZlKHJlc291cmNlLCBTYXZlUmVhc29uLkVYUExJQ0lUKS50aGVuKHZhbHVlcyA9PiB7XG5cdFx0XHRzdWIuZGlzcG9zZSgpO1xuXG5cdFx0XHRjb25zdCBbZmlyc3RdID0gdmFsdWVzO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LCBmYWxzZSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V2ZW50IGRlbGl2ZXJ5LCB3YWl0VW50aWwgZmFpbHVyZSBoYW5kbGluZycsICgpID0+IHtcblx0XHRjb25zdCBwYXJ0aWNpcGFudCA9IG5ldyBFeHRIb3N0RG9jdW1lbnRTYXZlUGFydGljaXBhbnQobnVsbExvZ1NlcnZpY2UsIGRvY3VtZW50cywgbWFpblRocmVhZEJ1bGtFZGl0cyk7XG5cblx0XHRjb25zdCBzdWIxID0gcGFydGljaXBhbnQuZ2V0T25XaWxsU2F2ZVRleHREb2N1bWVudEV2ZW50KG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbikoZnVuY3Rpb24gKGUpIHtcblx0XHRcdGUud2FpdFVudGlsKFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignZGRkZCcpKSk7XG5cdFx0fSk7XG5cblx0XHRsZXQgZXZlbnQ6IHZzY29kZS5UZXh0RG9jdW1lbnRXaWxsU2F2ZUV2ZW50O1xuXHRcdGNvbnN0IHN1YjIgPSBwYXJ0aWNpcGFudC5nZXRPbldpbGxTYXZlVGV4dERvY3VtZW50RXZlbnQobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uKShmdW5jdGlvbiAoZSkge1xuXHRcdFx0ZXZlbnQgPSBlO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHBhcnRpY2lwYW50LiRwYXJ0aWNpcGF0ZUluU2F2ZShyZXNvdXJjZSwgU2F2ZVJlYXNvbi5FWFBMSUNJVCkudGhlbigoKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soZXZlbnQpO1xuXHRcdFx0c3ViMS5kaXNwb3NlKCk7XG5cdFx0XHRzdWIyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZXZlbnQgZGVsaXZlcnksIHB1c2hFZGl0cyBzeW5jJywgKCkgPT4ge1xuXG5cdFx0bGV0IGR0bzogSVdvcmtzcGFjZUVkaXREdG87XG5cdFx0Y29uc3QgcGFydGljaXBhbnQgPSBuZXcgRXh0SG9zdERvY3VtZW50U2F2ZVBhcnRpY2lwYW50KG51bGxMb2dTZXJ2aWNlLCBkb2N1bWVudHMsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZFRleHRFZGl0b3JzU2hhcGU+KCkge1xuXHRcdFx0JHRyeUFwcGx5V29ya3NwYWNlRWRpdChfZWRpdHM6IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzPElXb3Jrc3BhY2VFZGl0RHRvPikge1xuXHRcdFx0XHRkdG8gPSBfZWRpdHMudmFsdWU7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzdWIgPSBwYXJ0aWNpcGFudC5nZXRPbldpbGxTYXZlVGV4dERvY3VtZW50RXZlbnQobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uKShmdW5jdGlvbiAoZSkge1xuXHRcdFx0ZS53YWl0VW50aWwoUHJvbWlzZS5yZXNvbHZlKFtUZXh0RWRpdC5pbnNlcnQobmV3IFBvc2l0aW9uKDAsIDApLCAnYmFyJyldKSk7XG5cdFx0XHRlLndhaXRVbnRpbChQcm9taXNlLnJlc29sdmUoW1RleHRFZGl0LnNldEVuZE9mTGluZShFbmRPZkxpbmUuQ1JMRildKSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcGFydGljaXBhbnQuJHBhcnRpY2lwYXRlSW5TYXZlKHJlc291cmNlLCBTYXZlUmVhc29uLkVYUExJQ0lUKS50aGVuKCgpID0+IHtcblx0XHRcdHN1Yi5kaXNwb3NlKCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkdG8uZWRpdHMubGVuZ3RoLCAyKTtcblx0XHRcdGFzc2VydC5vaygoPElXb3Jrc3BhY2VUZXh0RWRpdER0bz5kdG8uZWRpdHNbMF0pLnRleHRFZGl0KTtcblx0XHRcdGFzc2VydC5vaygoPElXb3Jrc3BhY2VUZXh0RWRpdER0bz5kdG8uZWRpdHNbMV0pLnRleHRFZGl0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZXZlbnQgZGVsaXZlcnksIGNvbmN1cnJlbnQgY2hhbmdlJywgKCkgPT4ge1xuXG5cdFx0bGV0IGVkaXRzOiBJV29ya3NwYWNlRWRpdER0bztcblx0XHRjb25zdCBwYXJ0aWNpcGFudCA9IG5ldyBFeHRIb3N0RG9jdW1lbnRTYXZlUGFydGljaXBhbnQobnVsbExvZ1NlcnZpY2UsIGRvY3VtZW50cywgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxNYWluVGhyZWFkVGV4dEVkaXRvcnNTaGFwZT4oKSB7XG5cdFx0XHQkdHJ5QXBwbHlXb3Jrc3BhY2VFZGl0KF9lZGl0czogU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnM8SVdvcmtzcGFjZUVkaXREdG8+KSB7XG5cdFx0XHRcdGVkaXRzID0gX2VkaXRzLnZhbHVlO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgc3ViID0gcGFydGljaXBhbnQuZ2V0T25XaWxsU2F2ZVRleHREb2N1bWVudEV2ZW50KG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbikoZnVuY3Rpb24gKGUpIHtcblxuXHRcdFx0Ly8gY29uY3VycmVudCBjaGFuZ2UgZnJvbSBzb21ld2hlcmVcblx0XHRcdGRvY3VtZW50cy4kYWNjZXB0TW9kZWxDaGFuZ2VkKHJlc291cmNlLCB7XG5cdFx0XHRcdGNoYW5nZXM6IFt7XG5cdFx0XHRcdFx0cmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogMSwgZW5kQ29sdW1uOiAxIH0sXG5cdFx0XHRcdFx0cmFuZ2VPZmZzZXQ6IHVuZGVmaW5lZCEsXG5cdFx0XHRcdFx0cmFuZ2VMZW5ndGg6IHVuZGVmaW5lZCEsXG5cdFx0XHRcdFx0dGV4dDogJ2Jhcidcblx0XHRcdFx0fV0sXG5cdFx0XHRcdGVvbDogdW5kZWZpbmVkISxcblx0XHRcdFx0dmVyc2lvbklkOiAyLFxuXHRcdFx0XHRpc1JlZG9pbmc6IGZhbHNlLFxuXHRcdFx0XHRpc1VuZG9pbmc6IGZhbHNlLFxuXHRcdFx0fSwgdHJ1ZSk7XG5cblx0XHRcdGUud2FpdFVudGlsKFByb21pc2UucmVzb2x2ZShbVGV4dEVkaXQuaW5zZXJ0KG5ldyBQb3NpdGlvbigwLCAwKSwgJ2JhcicpXSkpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHBhcnRpY2lwYW50LiRwYXJ0aWNpcGF0ZUluU2F2ZShyZXNvdXJjZSwgU2F2ZVJlYXNvbi5FWFBMSUNJVCkudGhlbih2YWx1ZXMgPT4ge1xuXHRcdFx0c3ViLmRpc3Bvc2UoKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRzLCB1bmRlZmluZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlc1swXSwgZmFsc2UpO1xuXHRcdH0pO1xuXG5cdH0pO1xuXG5cdHRlc3QoJ2V2ZW50IGRlbGl2ZXJ5LCB0d28gbGlzdGVuZXJzIC0+IHR3byBkb2N1bWVudCBzdGF0ZXMnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBwYXJ0aWNpcGFudCA9IG5ldyBFeHRIb3N0RG9jdW1lbnRTYXZlUGFydGljaXBhbnQobnVsbExvZ1NlcnZpY2UsIGRvY3VtZW50cywgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxNYWluVGhyZWFkVGV4dEVkaXRvcnNTaGFwZT4oKSB7XG5cdFx0XHQkdHJ5QXBwbHlXb3Jrc3BhY2VFZGl0KGR0bzogU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnM8SVdvcmtzcGFjZUVkaXREdG8+KSB7XG5cblx0XHRcdFx0Zm9yIChjb25zdCBlZGl0IG9mIGR0by52YWx1ZS5lZGl0cykge1xuXG5cdFx0XHRcdFx0Y29uc3QgdXJpID0gVVJJLnJldml2ZSgoPElXb3Jrc3BhY2VUZXh0RWRpdER0bz5lZGl0KS5yZXNvdXJjZSk7XG5cdFx0XHRcdFx0Y29uc3QgeyB0ZXh0LCByYW5nZSB9ID0gKDxJV29ya3NwYWNlVGV4dEVkaXREdG8+ZWRpdCkudGV4dEVkaXQ7XG5cdFx0XHRcdFx0ZG9jdW1lbnRzLiRhY2NlcHRNb2RlbENoYW5nZWQodXJpLCB7XG5cdFx0XHRcdFx0XHRjaGFuZ2VzOiBbe1xuXHRcdFx0XHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0XHRcdFx0dGV4dCxcblx0XHRcdFx0XHRcdFx0cmFuZ2VPZmZzZXQ6IHVuZGVmaW5lZCEsXG5cdFx0XHRcdFx0XHRcdHJhbmdlTGVuZ3RoOiB1bmRlZmluZWQhLFxuXHRcdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0XHRlb2w6IHVuZGVmaW5lZCEsXG5cdFx0XHRcdFx0XHR2ZXJzaW9uSWQ6IGRvY3VtZW50cy5nZXREb2N1bWVudERhdGEodXJpKSEudmVyc2lvbiArIDEsXG5cdFx0XHRcdFx0XHRpc1JlZG9pbmc6IGZhbHNlLFxuXHRcdFx0XHRcdFx0aXNVbmRvaW5nOiBmYWxzZSxcblx0XHRcdFx0XHR9LCB0cnVlKTtcblx0XHRcdFx0XHQvLyB9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZG9jdW1lbnQgPSBkb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXG5cdFx0Y29uc3Qgc3ViMSA9IHBhcnRpY2lwYW50LmdldE9uV2lsbFNhdmVUZXh0RG9jdW1lbnRFdmVudChudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24pKGZ1bmN0aW9uIChlKSB7XG5cdFx0XHQvLyB0aGUgZG9jdW1lbnQgc3RhdGUgd2Ugc3RhcnRlZCB3aXRoXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9jdW1lbnQudmVyc2lvbiwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9jdW1lbnQuZ2V0VGV4dCgpLCAnZm9vJyk7XG5cblx0XHRcdGUud2FpdFVudGlsKFByb21pc2UucmVzb2x2ZShbVGV4dEVkaXQuaW5zZXJ0KG5ldyBQb3NpdGlvbigwLCAwKSwgJ2JhcicpXSkpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgc3ViMiA9IHBhcnRpY2lwYW50LmdldE9uV2lsbFNhdmVUZXh0RG9jdW1lbnRFdmVudChudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24pKGZ1bmN0aW9uIChlKSB7XG5cdFx0XHQvLyB0aGUgZG9jdW1lbnQgc3RhdGUgQUZURVIgdGhlIGZpcnN0IGxpc3RlbmVyIGtpY2tlZCBpblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRvY3VtZW50LnZlcnNpb24sIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRvY3VtZW50LmdldFRleHQoKSwgJ2JhcmZvbycpO1xuXG5cdFx0XHRlLndhaXRVbnRpbChQcm9taXNlLnJlc29sdmUoW1RleHRFZGl0Lmluc2VydChuZXcgUG9zaXRpb24oMCwgMCksICdiYXInKV0pKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBwYXJ0aWNpcGFudC4kcGFydGljaXBhdGVJblNhdmUocmVzb3VyY2UsIFNhdmVSZWFzb24uRVhQTElDSVQpLnRoZW4odmFsdWVzID0+IHtcblx0XHRcdHN1YjEuZGlzcG9zZSgpO1xuXHRcdFx0c3ViMi5kaXNwb3NlKCk7XG5cblx0XHRcdC8vIHRoZSBkb2N1bWVudCBzdGF0ZSBBRlRFUiBldmVudGluZyBpcyBkb25lXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9jdW1lbnQudmVyc2lvbiwgMyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9jdW1lbnQuZ2V0VGV4dCgpLCAnYmFyYmFyZm9vJyk7XG5cdFx0fSk7XG5cblx0fSk7XG5cblx0dGVzdCgnTG9nIGZhaWxpbmcgbGlzdGVuZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0bGV0IGRpZExvZ1NvbWV0aGluZyA9IGZhbHNlO1xuXHRcdGNvbnN0IHBhcnRpY2lwYW50ID0gbmV3IEV4dEhvc3REb2N1bWVudFNhdmVQYXJ0aWNpcGFudChuZXcgY2xhc3MgZXh0ZW5kcyBOdWxsTG9nU2VydmljZSB7XG5cdFx0XHRvdmVycmlkZSBlcnJvcihtZXNzYWdlOiBzdHJpbmcgfCBFcnJvciwgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRcdFx0ZGlkTG9nU29tZXRoaW5nID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9LCBkb2N1bWVudHMsIG1haW5UaHJlYWRCdWxrRWRpdHMpO1xuXG5cblx0XHRjb25zdCBzdWIgPSBwYXJ0aWNpcGFudC5nZXRPbldpbGxTYXZlVGV4dERvY3VtZW50RXZlbnQobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uKShmdW5jdGlvbiAoZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdib29tJyk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcGFydGljaXBhbnQuJHBhcnRpY2lwYXRlSW5TYXZlKHJlc291cmNlLCBTYXZlUmVhc29uLkVYUExJQ0lUKS50aGVuKCgpID0+IHtcblx0XHRcdHN1Yi5kaXNwb3NlKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlkTG9nU29tZXRoaW5nLCB0cnVlKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdBQVc7QUFDcEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyx3QkFBd0IsVUFBVSxVQUFVLGlCQUFpQjtBQUV0RSxTQUFTLHNDQUFzQztBQUMvQyxTQUFT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
