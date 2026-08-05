import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import { MainThreadDocumentContentProviders } from "../../browser/mainThreadDocumentContentProviders.js";
import { createTextModel } from "../../../../editor/test/common/testTextModel.js";
import { mock } from "../../../../base/test/common/mock.js";
import { TestRPCProtocol } from "../common/testRPCProtocol.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
suite("MainThreadDocumentContentProviders", function() {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  test("events are processed properly", function() {
    const uri = URI.parse("test:uri");
    const model = createTextModel("1", void 0, void 0, uri);
    const providers = new MainThreadDocumentContentProviders(
      new TestRPCProtocol(),
      null,
      null,
      new class extends mock() {
        getModel(_uri) {
          assert.strictEqual(uri.toString(), _uri.toString());
          return model;
        }
      }(),
      new class extends mock() {
        computeMoreMinimalEdits(_uri, data) {
          assert.strictEqual(model.getValue(), "1");
          return Promise.resolve(data);
        }
      }()
    );
    store.add(model);
    store.add(providers);
    return new Promise((resolve, reject) => {
      let expectedEvents = 1;
      store.add(model.onDidChangeContent((e) => {
        expectedEvents -= 1;
        try {
          assert.ok(expectedEvents >= 0);
        } catch (err) {
          reject(err);
        }
        if (model.getValue() === "1\n2\n3") {
          model.dispose();
          resolve();
        }
      }));
      providers.$onVirtualDocumentChange(uri, "1\n2");
      providers.$onVirtualDocumentChange(uri, "1\n2\n3");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9tYWluVGhyZWFkRG9jdW1lbnRDb250ZW50UHJvdmlkZXJzLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgTWFpblRocmVhZERvY3VtZW50Q29udGVudFByb3ZpZGVycyB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbWFpblRocmVhZERvY3VtZW50Q29udGVudFByb3ZpZGVycy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElFZGl0b3JXb3JrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9lZGl0b3JXb3JrZXIuanMnO1xuaW1wb3J0IHsgVGVzdFJQQ1Byb3RvY29sIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RSUENQcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBUZXh0RWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnTWFpblRocmVhZERvY3VtZW50Q29udGVudFByb3ZpZGVycycsIGZ1bmN0aW9uICgpIHtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2V2ZW50cyBhcmUgcHJvY2Vzc2VkIHByb3Blcmx5JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgdXJpID0gVVJJLnBhcnNlKCd0ZXN0OnVyaScpO1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCcxJywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVyaSk7XG5cblx0XHRjb25zdCBwcm92aWRlcnMgPSBuZXcgTWFpblRocmVhZERvY3VtZW50Q29udGVudFByb3ZpZGVycyhuZXcgVGVzdFJQQ1Byb3RvY29sKCksIG51bGwhLCBudWxsISxcblx0XHRcdG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SU1vZGVsU2VydmljZT4oKSB7XG5cdFx0XHRcdG92ZXJyaWRlIGdldE1vZGVsKF91cmk6IFVSSSkge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1cmkudG9TdHJpbmcoKSwgX3VyaS50b1N0cmluZygpKTtcblx0XHRcdFx0XHRyZXR1cm4gbW9kZWw7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFZGl0b3JXb3JrZXJTZXJ2aWNlPigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgY29tcHV0ZU1vcmVNaW5pbWFsRWRpdHMoX3VyaTogVVJJLCBkYXRhOiBUZXh0RWRpdFtdIHwgdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICcxJyk7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShkYXRhKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHQpO1xuXG5cdFx0c3RvcmUuYWRkKG1vZGVsKTtcblx0XHRzdG9yZS5hZGQocHJvdmlkZXJzKTtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRsZXQgZXhwZWN0ZWRFdmVudHMgPSAxO1xuXHRcdFx0c3RvcmUuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudChlID0+IHtcblx0XHRcdFx0ZXhwZWN0ZWRFdmVudHMgLT0gMTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhc3NlcnQub2soZXhwZWN0ZWRFdmVudHMgPj0gMCk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdHJlamVjdChlcnIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChtb2RlbC5nZXRWYWx1ZSgpID09PSAnMVxcbjJcXG4zJykge1xuXHRcdFx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdHByb3ZpZGVycy4kb25WaXJ0dWFsRG9jdW1lbnRDaGFuZ2UodXJpLCAnMVxcbjInKTtcblx0XHRcdHByb3ZpZGVycy4kb25WaXJ0dWFsRG9jdW1lbnRDaGFuZ2UodXJpLCAnMVxcbjJcXG4zJyk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsMENBQTBDO0FBQ25ELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsWUFBWTtBQUdyQixTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLCtDQUErQztBQUV4RCxNQUFNLHNDQUFzQyxXQUFZO0FBRXZELFFBQU0sUUFBUSx3Q0FBd0M7QUFFdEQsT0FBSyxpQ0FBaUMsV0FBWTtBQUVqRCxVQUFNLE1BQU0sSUFBSSxNQUFNLFVBQVU7QUFDaEMsVUFBTSxRQUFRLGdCQUFnQixLQUFLLFFBQVcsUUFBVyxHQUFHO0FBRTVELFVBQU0sWUFBWSxJQUFJO0FBQUEsTUFBbUMsSUFBSSxnQkFBZ0I7QUFBQSxNQUFHO0FBQUEsTUFBTztBQUFBLE1BQ3RGLElBQUksY0FBYyxLQUFvQixFQUFFO0FBQUEsUUFDOUIsU0FBUyxNQUFXO0FBQzVCLGlCQUFPLFlBQVksSUFBSSxTQUFTLEdBQUcsS0FBSyxTQUFTLENBQUM7QUFDbEQsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxjQUFjLEtBQTJCLEVBQUU7QUFBQSxRQUNyQyx3QkFBd0IsTUFBVyxNQUE4QjtBQUN6RSxpQkFBTyxZQUFZLE1BQU0sU0FBUyxHQUFHLEdBQUc7QUFDeEMsaUJBQU8sUUFBUSxRQUFRLElBQUk7QUFBQSxRQUM1QjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsVUFBTSxJQUFJLEtBQUs7QUFDZixVQUFNLElBQUksU0FBUztBQUVuQixXQUFPLElBQUksUUFBYyxDQUFDLFNBQVMsV0FBVztBQUM3QyxVQUFJLGlCQUFpQjtBQUNyQixZQUFNLElBQUksTUFBTSxtQkFBbUIsT0FBSztBQUN2QywwQkFBa0I7QUFDbEIsWUFBSTtBQUNILGlCQUFPLEdBQUcsa0JBQWtCLENBQUM7QUFBQSxRQUM5QixTQUFTLEtBQUs7QUFDYixpQkFBTyxHQUFHO0FBQUEsUUFDWDtBQUNBLFlBQUksTUFBTSxTQUFTLE1BQU0sV0FBVztBQUNuQyxnQkFBTSxRQUFRO0FBQ2Qsa0JBQVE7QUFBQSxRQUNUO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFDRixnQkFBVSx5QkFBeUIsS0FBSyxNQUFNO0FBQzlDLGdCQUFVLHlCQUF5QixLQUFLLFNBQVM7QUFBQSxJQUNsRCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
