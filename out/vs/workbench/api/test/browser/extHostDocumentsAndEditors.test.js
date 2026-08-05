import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import { ExtHostDocumentsAndEditors } from "../../common/extHostDocumentsAndEditors.js";
import { TestRPCProtocol } from "../common/testRPCProtocol.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
suite("ExtHostDocumentsAndEditors", () => {
  let editors;
  setup(function() {
    editors = new ExtHostDocumentsAndEditors(new TestRPCProtocol(), new NullLogService());
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("The value of TextDocument.isClosed is incorrect when a text document is closed, #27949", () => {
    editors.$acceptDocumentsAndEditorsDelta({
      addedDocuments: [{
        EOL: "\n",
        isDirty: true,
        languageId: "fooLang",
        uri: URI.parse("foo:bar"),
        versionId: 1,
        lines: [
          "first",
          "second"
        ],
        encoding: "utf8"
      }]
    });
    return new Promise((resolve, reject) => {
      const d = editors.onDidRemoveDocuments((e) => {
        try {
          for (const data of e) {
            assert.strictEqual(data.document.isClosed, true);
          }
          resolve(void 0);
        } catch (e2) {
          reject(e2);
        } finally {
          d.dispose();
        }
      });
      editors.$acceptDocumentsAndEditorsDelta({
        removedDocuments: [URI.parse("foo:bar")]
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzLmpzJztcbmltcG9ydCB7IFRlc3RSUENQcm90b2NvbCB9IGZyb20gJy4uL2NvbW1vbi90ZXN0UlBDUHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxuc3VpdGUoJ0V4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzJywgKCkgPT4ge1xuXG5cdGxldCBlZGl0b3JzOiBFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycztcblxuXHRzZXR1cChmdW5jdGlvbiAoKSB7XG5cdFx0ZWRpdG9ycyA9IG5ldyBFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyhuZXcgVGVzdFJQQ1Byb3RvY29sKCksIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnVGhlIHZhbHVlIG9mIFRleHREb2N1bWVudC5pc0Nsb3NlZCBpcyBpbmNvcnJlY3Qgd2hlbiBhIHRleHQgZG9jdW1lbnQgaXMgY2xvc2VkLCAjMjc5NDknLCAoKSA9PiB7XG5cblx0XHRlZGl0b3JzLiRhY2NlcHREb2N1bWVudHNBbmRFZGl0b3JzRGVsdGEoe1xuXHRcdFx0YWRkZWREb2N1bWVudHM6IFt7XG5cdFx0XHRcdEVPTDogJ1xcbicsXG5cdFx0XHRcdGlzRGlydHk6IHRydWUsXG5cdFx0XHRcdGxhbmd1YWdlSWQ6ICdmb29MYW5nJyxcblx0XHRcdFx0dXJpOiBVUkkucGFyc2UoJ2ZvbzpiYXInKSxcblx0XHRcdFx0dmVyc2lvbklkOiAxLFxuXHRcdFx0XHRsaW5lczogW1xuXHRcdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdFx0J3NlY29uZCdcblx0XHRcdFx0XSxcblx0XHRcdFx0ZW5jb2Rpbmc6ICd1dGY4J1xuXHRcdFx0fV1cblx0XHR9KTtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cblx0XHRcdGNvbnN0IGQgPSBlZGl0b3JzLm9uRGlkUmVtb3ZlRG9jdW1lbnRzKGUgPT4ge1xuXHRcdFx0XHR0cnkge1xuXG5cdFx0XHRcdFx0Zm9yIChjb25zdCBkYXRhIG9mIGUpIHtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkYXRhLmRvY3VtZW50LmlzQ2xvc2VkLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0cmVqZWN0KGUpO1xuXHRcdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdGQuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0ZWRpdG9ycy4kYWNjZXB0RG9jdW1lbnRzQW5kRWRpdG9yc0RlbHRhKHtcblx0XHRcdFx0cmVtb3ZlZERvY3VtZW50czogW1VSSS5wYXJzZSgnZm9vOmJhcicpXVxuXHRcdFx0fSk7XG5cblx0XHR9KTtcblx0fSk7XG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsV0FBVztBQUNwQixTQUFTLGtDQUFrQztBQUMzQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLCtDQUErQztBQUV4RCxNQUFNLDhCQUE4QixNQUFNO0FBRXpDLE1BQUk7QUFFSixRQUFNLFdBQVk7QUFDakIsY0FBVSxJQUFJLDJCQUEyQixJQUFJLGdCQUFnQixHQUFHLElBQUksZUFBZSxDQUFDO0FBQUEsRUFDckYsQ0FBQztBQUVELDBDQUF3QztBQUV4QyxPQUFLLDBGQUEwRixNQUFNO0FBRXBHLFlBQVEsZ0NBQWdDO0FBQUEsTUFDdkMsZ0JBQWdCLENBQUM7QUFBQSxRQUNoQixLQUFLO0FBQUEsUUFDTCxTQUFTO0FBQUEsUUFDVCxZQUFZO0FBQUEsUUFDWixLQUFLLElBQUksTUFBTSxTQUFTO0FBQUEsUUFDeEIsV0FBVztBQUFBLFFBQ1gsT0FBTztBQUFBLFVBQ047QUFBQSxVQUNBO0FBQUEsUUFDRDtBQUFBLFFBQ0EsVUFBVTtBQUFBLE1BQ1gsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFdBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBRXZDLFlBQU0sSUFBSSxRQUFRLHFCQUFxQixPQUFLO0FBQzNDLFlBQUk7QUFFSCxxQkFBVyxRQUFRLEdBQUc7QUFDckIsbUJBQU8sWUFBWSxLQUFLLFNBQVMsVUFBVSxJQUFJO0FBQUEsVUFDaEQ7QUFDQSxrQkFBUSxNQUFTO0FBQUEsUUFDbEIsU0FBU0EsSUFBRztBQUNYLGlCQUFPQSxFQUFDO0FBQUEsUUFDVCxVQUFFO0FBQ0QsWUFBRSxRQUFRO0FBQUEsUUFDWDtBQUFBLE1BQ0QsQ0FBQztBQUVELGNBQVEsZ0NBQWdDO0FBQUEsUUFDdkMsa0JBQWtCLENBQUMsSUFBSSxNQUFNLFNBQVMsQ0FBQztBQUFBLE1BQ3hDLENBQUM7QUFBQSxJQUVGLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRixDQUFDOyIsCiAgIm5hbWVzIjogWyJlIl0KfQo=
