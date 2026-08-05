import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import { ExtHostDocumentsAndEditors } from "../../common/extHostDocumentsAndEditors.js";
import { SingleProxyRPCProtocol } from "../common/testRPCProtocol.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { ExtHostDocumentContentProvider } from "../../common/extHostDocumentContentProviders.js";
import { Emitter } from "../../../../base/common/event.js";
import { timeout } from "../../../../base/common/async.js";
import { runWithFakedTimers } from "../../../../base/test/common/timeTravelScheduler.js";
suite("ExtHostDocumentContentProvider", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const resource = URI.parse("foo:bar");
  let documentContentProvider;
  let mainThreadContentProvider;
  const changes = [];
  setup(() => {
    changes.length = 0;
    mainThreadContentProvider = new class {
      $registerTextContentProvider(handle, scheme) {
      }
      $unregisterTextContentProvider(handle) {
      }
      async $onVirtualDocumentChange(uri, value) {
        await timeout(10);
        changes.push([uri, value]);
      }
      dispose() {
        throw new Error("Method not implemented.");
      }
    }();
    const ehContext = SingleProxyRPCProtocol(mainThreadContentProvider);
    const documentsAndEditors = new ExtHostDocumentsAndEditors(ehContext, new NullLogService());
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
    documentContentProvider = new ExtHostDocumentContentProvider(ehContext, documentsAndEditors, new NullLogService());
  });
  test("TextDocumentContentProvider drops onDidChange events when they happen quickly #179711", async () => {
    await runWithFakedTimers({}, async function() {
      const emitter = new Emitter();
      const contents = ["X", "Y"];
      let counter = 0;
      let stack = 0;
      const d = documentContentProvider.registerTextDocumentContentProvider(resource.scheme, {
        onDidChange: emitter.event,
        async provideTextDocumentContent(_uri) {
          assert.strictEqual(stack, 0);
          stack++;
          try {
            await timeout(0);
            return contents[counter++ % contents.length];
          } finally {
            stack--;
          }
        }
      });
      emitter.fire(resource);
      emitter.fire(resource);
      await timeout(100);
      assert.strictEqual(changes.length, 2);
      assert.strictEqual(changes[0][1], "X");
      assert.strictEqual(changes[1][1], "Y");
      d.dispose();
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0RG9jdW1lbnRDb250ZW50UHJvdmlkZXIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycy5qcyc7XG5pbXBvcnQgeyBTaW5nbGVQcm94eVJQQ1Byb3RvY29sIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RSUENQcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdERvY3VtZW50Q29udGVudFByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3REb2N1bWVudENvbnRlbnRQcm92aWRlcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IE1haW5UaHJlYWREb2N1bWVudENvbnRlbnRQcm92aWRlcnNTaGFwZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBydW5XaXRoRmFrZWRUaW1lcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3RpbWVUcmF2ZWxTY2hlZHVsZXIuanMnO1xuXG5zdWl0ZSgnRXh0SG9zdERvY3VtZW50Q29udGVudFByb3ZpZGVyJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNvbnN0IHJlc291cmNlID0gVVJJLnBhcnNlKCdmb286YmFyJyk7XG5cdGxldCBkb2N1bWVudENvbnRlbnRQcm92aWRlcjogRXh0SG9zdERvY3VtZW50Q29udGVudFByb3ZpZGVyO1xuXHRsZXQgbWFpblRocmVhZENvbnRlbnRQcm92aWRlcjogTWFpblRocmVhZERvY3VtZW50Q29udGVudFByb3ZpZGVyc1NoYXBlO1xuXHRjb25zdCBjaGFuZ2VzOiBbdXJpOiBVcmlDb21wb25lbnRzLCB2YWx1ZTogc3RyaW5nXVtdID0gW107XG5cblx0c2V0dXAoKCkgPT4ge1xuXG5cdFx0Y2hhbmdlcy5sZW5ndGggPSAwO1xuXG5cdFx0bWFpblRocmVhZENvbnRlbnRQcm92aWRlciA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIE1haW5UaHJlYWREb2N1bWVudENvbnRlbnRQcm92aWRlcnNTaGFwZSB7XG5cdFx0XHQkcmVnaXN0ZXJUZXh0Q29udGVudFByb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBzY2hlbWU6IHN0cmluZyk6IHZvaWQge1xuXG5cdFx0XHR9XG5cdFx0XHQkdW5yZWdpc3RlclRleHRDb250ZW50UHJvdmlkZXIoaGFuZGxlOiBudW1iZXIpOiB2b2lkIHtcblxuXHRcdFx0fVxuXHRcdFx0YXN5bmMgJG9uVmlydHVhbERvY3VtZW50Q2hhbmdlKHVyaTogVXJpQ29tcG9uZW50cywgdmFsdWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwKTtcblx0XHRcdFx0Y2hhbmdlcy5wdXNoKFt1cmksIHZhbHVlXSk7XG5cdFx0XHR9XG5cdFx0XHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGVoQ29udGV4dCA9IFNpbmdsZVByb3h5UlBDUHJvdG9jb2wobWFpblRocmVhZENvbnRlbnRQcm92aWRlcik7XG5cdFx0Y29uc3QgZG9jdW1lbnRzQW5kRWRpdG9ycyA9IG5ldyBFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyhlaENvbnRleHQsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRkb2N1bWVudHNBbmRFZGl0b3JzLiRhY2NlcHREb2N1bWVudHNBbmRFZGl0b3JzRGVsdGEoe1xuXHRcdFx0YWRkZWREb2N1bWVudHM6IFt7XG5cdFx0XHRcdGlzRGlydHk6IGZhbHNlLFxuXHRcdFx0XHRsYW5ndWFnZUlkOiAnZm9vJyxcblx0XHRcdFx0dXJpOiByZXNvdXJjZSxcblx0XHRcdFx0dmVyc2lvbklkOiAxLFxuXHRcdFx0XHRsaW5lczogWydmb28nXSxcblx0XHRcdFx0RU9MOiAnXFxuJyxcblx0XHRcdFx0ZW5jb2Rpbmc6ICd1dGY4J1xuXHRcdFx0fV1cblx0XHR9KTtcblx0XHRkb2N1bWVudENvbnRlbnRQcm92aWRlciA9IG5ldyBFeHRIb3N0RG9jdW1lbnRDb250ZW50UHJvdmlkZXIoZWhDb250ZXh0LCBkb2N1bWVudHNBbmRFZGl0b3JzLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHREb2N1bWVudENvbnRlbnRQcm92aWRlciBkcm9wcyBvbkRpZENoYW5nZSBldmVudHMgd2hlbiB0aGV5IGhhcHBlbiBxdWlja2x5ICMxNzk3MTEnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxVUkk+KCk7XG5cdFx0XHRjb25zdCBjb250ZW50cyA9IFsnWCcsICdZJ107XG5cdFx0XHRsZXQgY291bnRlciA9IDA7XG5cblx0XHRcdGxldCBzdGFjayA9IDA7XG5cblx0XHRcdGNvbnN0IGQgPSBkb2N1bWVudENvbnRlbnRQcm92aWRlci5yZWdpc3RlclRleHREb2N1bWVudENvbnRlbnRQcm92aWRlcihyZXNvdXJjZS5zY2hlbWUsIHtcblx0XHRcdFx0b25EaWRDaGFuZ2U6IGVtaXR0ZXIuZXZlbnQsXG5cdFx0XHRcdGFzeW5jIHByb3ZpZGVUZXh0RG9jdW1lbnRDb250ZW50KF91cmkpIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhY2ssIDApO1xuXHRcdFx0XHRcdHN0YWNrKys7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gY29udGVudHNbY291bnRlcisrICUgY29udGVudHMubGVuZ3RoXTtcblx0XHRcdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdFx0c3RhY2stLTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRlbWl0dGVyLmZpcmUocmVzb3VyY2UpO1xuXHRcdFx0ZW1pdHRlci5maXJlKHJlc291cmNlKTtcblxuXHRcdFx0YXdhaXQgdGltZW91dCgxMDApO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hhbmdlcy5sZW5ndGgsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoYW5nZXNbMF1bMV0sICdYJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hhbmdlc1sxXVsxXSwgJ1knKTtcblxuXHRcdFx0ZC5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsV0FBMEI7QUFDbkMsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxlQUFlO0FBRXhCLFNBQVMsZUFBZTtBQUN4QixTQUFTLDBCQUEwQjtBQUVuQyxNQUFNLGtDQUFrQyxNQUFNO0FBRTdDLDBDQUF3QztBQUV4QyxRQUFNLFdBQVcsSUFBSSxNQUFNLFNBQVM7QUFDcEMsTUFBSTtBQUNKLE1BQUk7QUFDSixRQUFNLFVBQWlELENBQUM7QUFFeEQsUUFBTSxNQUFNO0FBRVgsWUFBUSxTQUFTO0FBRWpCLGdDQUE0QixJQUFJLE1BQXlEO0FBQUEsTUFDeEYsNkJBQTZCLFFBQWdCLFFBQXNCO0FBQUEsTUFFbkU7QUFBQSxNQUNBLCtCQUErQixRQUFzQjtBQUFBLE1BRXJEO0FBQUEsTUFDQSxNQUFNLHlCQUF5QixLQUFvQixPQUE4QjtBQUNoRixjQUFNLFFBQVEsRUFBRTtBQUNoQixnQkFBUSxLQUFLLENBQUMsS0FBSyxLQUFLLENBQUM7QUFBQSxNQUMxQjtBQUFBLE1BQ0EsVUFBZ0I7QUFDZixjQUFNLElBQUksTUFBTSx5QkFBeUI7QUFBQSxNQUMxQztBQUFBLElBQ0Q7QUFFQSxVQUFNLFlBQVksdUJBQXVCLHlCQUF5QjtBQUNsRSxVQUFNLHNCQUFzQixJQUFJLDJCQUEyQixXQUFXLElBQUksZUFBZSxDQUFDO0FBQzFGLHdCQUFvQixnQ0FBZ0M7QUFBQSxNQUNuRCxnQkFBZ0IsQ0FBQztBQUFBLFFBQ2hCLFNBQVM7QUFBQSxRQUNULFlBQVk7QUFBQSxRQUNaLEtBQUs7QUFBQSxRQUNMLFdBQVc7QUFBQSxRQUNYLE9BQU8sQ0FBQyxLQUFLO0FBQUEsUUFDYixLQUFLO0FBQUEsUUFDTCxVQUFVO0FBQUEsTUFDWCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQ0QsOEJBQTBCLElBQUksK0JBQStCLFdBQVcscUJBQXFCLElBQUksZUFBZSxDQUFDO0FBQUEsRUFDbEgsQ0FBQztBQUVELE9BQUsseUZBQXlGLFlBQVk7QUFDekcsVUFBTSxtQkFBbUIsQ0FBQyxHQUFHLGlCQUFrQjtBQUU5QyxZQUFNLFVBQVUsSUFBSSxRQUFhO0FBQ2pDLFlBQU0sV0FBVyxDQUFDLEtBQUssR0FBRztBQUMxQixVQUFJLFVBQVU7QUFFZCxVQUFJLFFBQVE7QUFFWixZQUFNLElBQUksd0JBQXdCLG9DQUFvQyxTQUFTLFFBQVE7QUFBQSxRQUN0RixhQUFhLFFBQVE7QUFBQSxRQUNyQixNQUFNLDJCQUEyQixNQUFNO0FBQ3RDLGlCQUFPLFlBQVksT0FBTyxDQUFDO0FBQzNCO0FBQ0EsY0FBSTtBQUNILGtCQUFNLFFBQVEsQ0FBQztBQUNmLG1CQUFPLFNBQVMsWUFBWSxTQUFTLE1BQU07QUFBQSxVQUM1QyxVQUFFO0FBQ0Q7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUVELGNBQVEsS0FBSyxRQUFRO0FBQ3JCLGNBQVEsS0FBSyxRQUFRO0FBRXJCLFlBQU0sUUFBUSxHQUFHO0FBRWpCLGFBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxhQUFPLFlBQVksUUFBUSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUc7QUFDckMsYUFBTyxZQUFZLFFBQVEsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHO0FBRXJDLFFBQUUsUUFBUTtBQUFBLElBQ1gsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUdGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
