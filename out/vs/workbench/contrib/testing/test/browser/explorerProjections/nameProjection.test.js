import assert from "assert";
import { Emitter } from "../../../../../../base/common/event.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { ListProjection } from "../../../browser/explorerProjections/listProjection.js";
import { TestId } from "../../../common/testId.js";
import { TestDiffOpType, TestItemExpandState } from "../../../common/testTypes.js";
import { TestTreeTestHarness } from "../testObjectTree.js";
import { TestTestItem } from "../../common/testStubs.js";
suite("Workbench - Testing Explorer Hierarchal by Name Projection", () => {
  let harness;
  let onTestChanged;
  let resultsService;
  teardown(() => {
    harness.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    onTestChanged = new Emitter();
    resultsService = {
      onResultsChanged: () => void 0,
      onTestChanged: onTestChanged.event,
      getStateById: () => ({ state: { state: 0 }, computedState: 0 })
    };
    harness = new TestTreeTestHarness((l) => new ListProjection({}, l, resultsService));
  });
  test("renders initial tree", () => {
    harness.flush();
    assert.deepStrictEqual(harness.tree.getRendered(), [
      { e: "aa" },
      { e: "ab" },
      { e: "b" }
    ]);
  });
  test("updates render if second test provider appears", async () => {
    harness.flush();
    harness.pushDiff({
      op: TestDiffOpType.Add,
      item: { controllerId: "ctrl2", expand: TestItemExpandState.Expanded, item: new TestTestItem(new TestId(["ctrl2"]), "root2").toTestItem() }
    }, {
      op: TestDiffOpType.Add,
      item: { controllerId: "ctrl2", expand: TestItemExpandState.NotExpandable, item: new TestTestItem(new TestId(["ctrl2", "id-c"]), "c", void 0).toTestItem() }
    });
    assert.deepStrictEqual(harness.flush(), [
      { e: "root", children: [{ e: "aa" }, { e: "ab" }, { e: "b" }] },
      { e: "root2", children: [{ e: "c" }] }
    ]);
  });
  test("updates nodes if they add children", async () => {
    harness.flush();
    harness.c.root.children.get("id-a").children.add(new TestTestItem(new TestId(["ctrlId", "id-a", "id-ac"]), "ac"));
    assert.deepStrictEqual(harness.flush(), [
      { e: "aa" },
      { e: "ab" },
      { e: "ac" },
      { e: "b" }
    ]);
  });
  test("updates nodes if they remove children", async () => {
    harness.flush();
    harness.c.root.children.get("id-a").children.delete("id-ab");
    assert.deepStrictEqual(harness.flush(), [
      { e: "aa" },
      { e: "b" }
    ]);
  });
  test("swaps when node is no longer leaf", async () => {
    harness.flush();
    harness.c.root.children.get("id-b").children.add(new TestTestItem(new TestId(["ctrlId", "id-b", "id-ba"]), "ba"));
    assert.deepStrictEqual(harness.flush(), [
      { e: "aa" },
      { e: "ab" },
      { e: "ba" }
    ]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL3Rlc3QvYnJvd3Nlci9leHBsb3JlclByb2plY3Rpb25zL25hbWVQcm9qZWN0aW9uLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBMaXN0UHJvamVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZXhwbG9yZXJQcm9qZWN0aW9ucy9saXN0UHJvamVjdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0SWQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdGVzdElkLmpzJztcbmltcG9ydCB7IFRlc3RSZXN1bHRJdGVtQ2hhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Rlc3RSZXN1bHQuanMnO1xuaW1wb3J0IHsgVGVzdERpZmZPcFR5cGUsIFRlc3RJdGVtRXhwYW5kU3RhdGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdGVzdFR5cGVzLmpzJztcbmltcG9ydCB7IFRlc3RUcmVlVGVzdEhhcm5lc3MgfSBmcm9tICcuLi90ZXN0T2JqZWN0VHJlZS5qcyc7XG5pbXBvcnQgeyBUZXN0VGVzdEl0ZW0gfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdFN0dWJzLmpzJztcblxuc3VpdGUoJ1dvcmtiZW5jaCAtIFRlc3RpbmcgRXhwbG9yZXIgSGllcmFyY2hhbCBieSBOYW1lIFByb2plY3Rpb24nLCAoKSA9PiB7XG5cdGxldCBoYXJuZXNzOiBUZXN0VHJlZVRlc3RIYXJuZXNzPExpc3RQcm9qZWN0aW9uPjtcblx0bGV0IG9uVGVzdENoYW5nZWQ6IEVtaXR0ZXI8VGVzdFJlc3VsdEl0ZW1DaGFuZ2U+O1xuXHRsZXQgcmVzdWx0c1NlcnZpY2U6IGFueTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0aGFybmVzcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRvblRlc3RDaGFuZ2VkID0gbmV3IEVtaXR0ZXIoKTtcblx0XHRyZXN1bHRzU2VydmljZSA9IHtcblx0XHRcdG9uUmVzdWx0c0NoYW5nZWQ6ICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdG9uVGVzdENoYW5nZWQ6IG9uVGVzdENoYW5nZWQuZXZlbnQsXG5cdFx0XHRnZXRTdGF0ZUJ5SWQ6ICgpID0+ICh7IHN0YXRlOiB7IHN0YXRlOiAwIH0sIGNvbXB1dGVkU3RhdGU6IDAgfSksXG5cdFx0fTtcblxuXHRcdGhhcm5lc3MgPSBuZXcgVGVzdFRyZWVUZXN0SGFybmVzcyhsID0+IG5ldyBMaXN0UHJvamVjdGlvbih7fSwgbCwgcmVzdWx0c1NlcnZpY2UgYXMgYW55KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbmRlcnMgaW5pdGlhbCB0cmVlJywgKCkgPT4ge1xuXHRcdGhhcm5lc3MuZmx1c2goKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MudHJlZS5nZXRSZW5kZXJlZCgpLCBbXG5cdFx0XHR7IGU6ICdhYScgfSwgeyBlOiAnYWInIH0sIHsgZTogJ2InIH1cblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlcyByZW5kZXIgaWYgc2Vjb25kIHRlc3QgcHJvdmlkZXIgYXBwZWFycycsIGFzeW5jICgpID0+IHtcblx0XHRoYXJuZXNzLmZsdXNoKCk7XG5cdFx0aGFybmVzcy5wdXNoRGlmZih7XG5cdFx0XHRvcDogVGVzdERpZmZPcFR5cGUuQWRkLFxuXHRcdFx0aXRlbTogeyBjb250cm9sbGVySWQ6ICdjdHJsMicsIGV4cGFuZDogVGVzdEl0ZW1FeHBhbmRTdGF0ZS5FeHBhbmRlZCwgaXRlbTogbmV3IFRlc3RUZXN0SXRlbShuZXcgVGVzdElkKFsnY3RybDInXSksICdyb290MicpLnRvVGVzdEl0ZW0oKSB9LFxuXHRcdH0sIHtcblx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5BZGQsXG5cdFx0XHRpdGVtOiB7IGNvbnRyb2xsZXJJZDogJ2N0cmwyJywgZXhwYW5kOiBUZXN0SXRlbUV4cGFuZFN0YXRlLk5vdEV4cGFuZGFibGUsIGl0ZW06IG5ldyBUZXN0VGVzdEl0ZW0obmV3IFRlc3RJZChbJ2N0cmwyJywgJ2lkLWMnXSksICdjJywgdW5kZWZpbmVkKS50b1Rlc3RJdGVtKCkgfSxcblx0XHR9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGFybmVzcy5mbHVzaCgpLCBbXG5cdFx0XHR7IGU6ICdyb290JywgY2hpbGRyZW46IFt7IGU6ICdhYScgfSwgeyBlOiAnYWInIH0sIHsgZTogJ2InIH1dIH0sXG5cdFx0XHR7IGU6ICdyb290MicsIGNoaWxkcmVuOiBbeyBlOiAnYycgfV0gfSxcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlcyBub2RlcyBpZiB0aGV5IGFkZCBjaGlsZHJlbicsIGFzeW5jICgpID0+IHtcblx0XHRoYXJuZXNzLmZsdXNoKCk7XG5cblx0XHRoYXJuZXNzLmMucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWEnKSEuY2hpbGRyZW4uYWRkKG5ldyBUZXN0VGVzdEl0ZW0obmV3IFRlc3RJZChbJ2N0cmxJZCcsICdpZC1hJywgJ2lkLWFjJ10pLCAnYWMnKSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MuZmx1c2goKSwgW1xuXHRcdFx0eyBlOiAnYWEnIH0sXG5cdFx0XHR7IGU6ICdhYicgfSxcblx0XHRcdHsgZTogJ2FjJyB9LFxuXHRcdFx0eyBlOiAnYicgfVxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVzIG5vZGVzIGlmIHRoZXkgcmVtb3ZlIGNoaWxkcmVuJywgYXN5bmMgKCkgPT4ge1xuXHRcdGhhcm5lc3MuZmx1c2goKTtcblx0XHRoYXJuZXNzLmMucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWEnKSEuY2hpbGRyZW4uZGVsZXRlKCdpZC1hYicpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLmZsdXNoKCksIFtcblx0XHRcdHsgZTogJ2FhJyB9LFxuXHRcdFx0eyBlOiAnYicgfVxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzd2FwcyB3aGVuIG5vZGUgaXMgbm8gbG9uZ2VyIGxlYWYnLCBhc3luYyAoKSA9PiB7XG5cdFx0aGFybmVzcy5mbHVzaCgpO1xuXHRcdGhhcm5lc3MuYy5yb290LmNoaWxkcmVuLmdldCgnaWQtYicpIS5jaGlsZHJlbi5hZGQobmV3IFRlc3RUZXN0SXRlbShuZXcgVGVzdElkKFsnY3RybElkJywgJ2lkLWInLCAnaWQtYmEnXSksICdiYScpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGFybmVzcy5mbHVzaCgpLCBbXG5cdFx0XHR7IGU6ICdhYScgfSxcblx0XHRcdHsgZTogJ2FiJyB9LFxu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
