import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { assertSnapshot } from "../../../../../base/test/common/snapshot.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ChatMarkdownRenderer } from "../../browser/chatMarkdownRenderer.js";
import { ITrustedDomainService } from "../../../url/browser/trustedDomainService.js";
import { MockTrustedDomainService } from "../../../url/test/browser/mockTrustedDomainService.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
suite("ChatMarkdownRenderer", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let testRenderer;
  setup(() => {
    const instantiationService = store.add(workbenchInstantiationService(void 0, store));
    instantiationService.stub(ITrustedDomainService, new MockTrustedDomainService(["http://allowed.com"]));
    testRenderer = instantiationService.createInstance(ChatMarkdownRenderer, {});
  });
  test("simple", async () => {
    const md = new MarkdownString("a");
    const result = store.add(testRenderer.render(md));
    await assertSnapshot(result.element.textContent);
  });
  test("supportHtml with one-line markdown", async () => {
    const md = new MarkdownString("**hello**");
    md.supportHtml = true;
    const result = store.add(testRenderer.render(md));
    await assertSnapshot(result.element.outerHTML);
    const md2 = new MarkdownString("1. [_hello_](https://example.com) test **text**");
    md2.supportHtml = true;
    const result2 = store.add(testRenderer.render(md2));
    await assertSnapshot(result2.element.outerHTML);
  });
  test("invalid HTML", async () => {
    const md = new MarkdownString("1<canvas>2<details>3</details></canvas>4");
    md.supportHtml = true;
    const result = store.add(testRenderer.render(md));
    await assertSnapshot(result.element.outerHTML);
  });
  test("invalid HTML with attributes", async () => {
    const md = new MarkdownString('1<details id="id1" style="display: none">2<details id="my id 2">3</details></details>4');
    md.supportHtml = true;
    const result = store.add(testRenderer.render(md));
    await assertSnapshot(result.element.outerHTML);
  });
  test("valid HTML", async () => {
    const md = new MarkdownString(`
<h1>heading</h1>
<ul>
	<li>1</li>
	<li><b>hi</b></li>
</ul>
<pre><code>code here</code></pre>`);
    md.supportHtml = true;
    const result = store.add(testRenderer.render(md));
    await assertSnapshot(result.element.outerHTML);
  });
  test("mixed valid and invalid HTML", async () => {
    const md = new MarkdownString(`
<h1>heading</h1>
<details>
<ul>
	<li><span><details><i>1</i></details></span></li>
	<li><b>hi</b></li>
</ul>
</details>
<pre><canvas>canvas here</canvas></pre><details></details>`);
    md.supportHtml = true;
    const result = store.add(testRenderer.render(md));
    await assertSnapshot(result.element.outerHTML);
  });
  test("self-closing elements", async () => {
    const md = new MarkdownString('<area><hr><br><input type="text" value="test">');
    md.supportHtml = true;
    const result = store.add(testRenderer.render(md));
    await assertSnapshot(result.element.outerHTML);
  });
  test("html comments", async () => {
    const md = new MarkdownString("<!-- comment1 <div></div> --><div>content</div><!-- comment2 -->");
    md.supportHtml = true;
    const result = store.add(testRenderer.render(md));
    await assertSnapshot(result.element.outerHTML);
  });
  test("CDATA", async () => {
    const md = new MarkdownString("<![CDATA[<div>content</div>]]>");
    md.supportHtml = true;
    const result = store.add(testRenderer.render(md));
    await assertSnapshot(result.element.outerHTML);
  });
  test("remote images", async () => {
    const md = new MarkdownString('<img src="http://allowed.com/image.jpg"> <img src="http://disallowed.com/image.jpg">');
    md.supportHtml = true;
    const result = store.add(testRenderer.render(md));
    await assertSnapshot(result.element.outerHTML);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvYnJvd3Nlci9jaGF0TWFya2Rvd25SZW5kZXJlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBhc3NlcnRTbmFwc2hvdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vc25hcHNob3QuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBDaGF0TWFya2Rvd25SZW5kZXJlciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY2hhdE1hcmtkb3duUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgSVRydXN0ZWREb21haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vdXJsL2Jyb3dzZXIvdHJ1c3RlZERvbWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTW9ja1RydXN0ZWREb21haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vdXJsL3Rlc3QvYnJvd3Nlci9tb2NrVHJ1c3RlZERvbWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcblxuc3VpdGUoJ0NoYXRNYXJrZG93blJlbmRlcmVyJywgKCkgPT4ge1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCB0ZXN0UmVuZGVyZXI6IENoYXRNYXJrZG93blJlbmRlcmVyO1xuXHRzZXR1cCgoKSA9PiB7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdG9yZS5hZGQod29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRydXN0ZWREb21haW5TZXJ2aWNlLCBuZXcgTW9ja1RydXN0ZWREb21haW5TZXJ2aWNlKFsnaHR0cDovL2FsbG93ZWQuY29tJ10pKTtcblx0XHR0ZXN0UmVuZGVyZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0TWFya2Rvd25SZW5kZXJlciwge30pO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW1wbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbWQgPSBuZXcgTWFya2Rvd25TdHJpbmcoJ2EnKTtcblx0XHRjb25zdCByZXN1bHQgPSBzdG9yZS5hZGQodGVzdFJlbmRlcmVyLnJlbmRlcihtZCkpO1xuXHRcdGF3YWl0IGFzc2VydFNuYXBzaG90KHJlc3VsdC5lbGVtZW50LnRleHRDb250ZW50KTtcblx0fSk7XG5cblx0dGVzdCgnc3VwcG9ydEh0bWwgd2l0aCBvbmUtbGluZSBtYXJrZG93bicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtZCA9IG5ldyBNYXJrZG93blN0cmluZygnKipoZWxsbyoqJyk7XG5cdFx0bWQuc3VwcG9ydEh0bWwgPSB0cnVlO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHN0b3JlLmFkZCh0ZXN0UmVuZGVyZXIucmVuZGVyKG1kKSk7XG5cdFx0YXdhaXQgYXNzZXJ0U25hcHNob3QocmVzdWx0LmVsZW1lbnQub3V0ZXJIVE1MKTtcblxuXHRcdGNvbnN0IG1kMiA9IG5ldyBNYXJrZG93blN0cmluZygnMS4gW19oZWxsb19dKGh0dHBzOi8vZXhhbXBsZS5jb20pIHRlc3QgKip0ZXh0KionKTtcblx0XHRtZDIuc3VwcG9ydEh0bWwgPSB0cnVlO1xuXHRcdGNvbnN0IHJlc3VsdDIgPSBzdG9yZS5hZGQodGVzdFJlbmRlcmVyLnJlbmRlcihtZDIpKTtcblx0XHRhd2FpdCBhc3NlcnRTbmFwc2hvdChyZXN1bHQyLmVsZW1lbnQub3V0ZXJIVE1MKTtcblx0fSk7XG5cblx0dGVzdCgnaW52YWxpZCBIVE1MJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1kID0gbmV3IE1hcmtkb3duU3RyaW5nKCcxPGNhbnZhcz4yPGRldGFpbHM+MzwvZGV0YWlscz48L2NhbnZhcz40Jyk7XG5cdFx0bWQuc3VwcG9ydEh0bWwgPSB0cnVlO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHN0b3JlLmFkZCh0ZXN0UmVuZGVyZXIucmVuZGVyKG1kKSk7XG5cdFx0YXdhaXQgYXNzZXJ0U25hcHNob3QocmVzdWx0LmVsZW1lbnQub3V0ZXJIVE1MKTtcblx0fSk7XG5cblx0dGVzdCgnaW52YWxpZCBIVE1MIHdpdGggYXR0cmlidXRlcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtZCA9IG5ldyBNYXJrZG93blN0cmluZygnMTxkZXRhaWxzIGlkPVwiaWQxXCIgc3R5bGU9XCJkaXNwbGF5OiBub25lXCI+MjxkZXRhaWxzIGlkPVwibXkgaWQgMlwiPjM8L2RldGFpbHM+PC9kZXRhaWxzPjQnKTtcblx0XHRtZC5zdXBwb3J0SHRtbCA9IHRydWU7XG5cdFx0Y29uc3QgcmVzdWx0ID0gc3RvcmUuYWRkKHRlc3RSZW5kZXJlci5yZW5kZXIobWQpKTtcblx0XHRhd2FpdCBhc3NlcnRTbmFwc2hvdChyZXN1bHQuZWxlbWVudC5vdXRlckhUTUwpO1xuXHR9KTtcblxuXHR0ZXN0KCd2YWxpZCBIVE1MJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1kID0gbmV3IE1hcmtkb3duU3RyaW5nKGBcbjxoMT5oZWFkaW5nPC9oMT5cbjx1bD5cblx0PGxpPjE8L2xpPlxuXHQ8bGk+PGI+aGk8L2I+PC9saT5cbjwvdWw+XG48cHJlPjxjb2RlPmNvZGUgaGVyZTwvY29kZT48L3ByZT5gKTtcblx0XHRtZC5zdXBwb3J0SHRtbCA9IHRydWU7XG5cdFx0Y29uc3QgcmVzdWx0ID0gc3RvcmUuYWRkKHRlc3RSZW5kZXJlci5yZW5kZXIobWQpKTtcblx0XHRhd2FpdCBhc3NlcnRTbmFwc2hvdChyZXN1bHQuZWxlbWVudC5vdXRlckhUTUwpO1xuXHR9KTtcblxuXHR0ZXN0KCdtaXhlZCB2YWxpZCBhbmQgaW52YWxpZCBIVE1MJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1kID0gbmV3IE1hcmtkb3duU3RyaW5nKGBcbjxoMT5oZWFkaW5nPC9oMT5cbjxkZXRhaWxzPlxuPHVsPlxuXHQ8bGk+PHNwYW4+PGRldGFpbHM+PGk+MTwvaT48L2RldGFpbHM+PC9zcGFuPjwvbGk+XG5cdDxsaT48Yj5oaTwvYj48L2xpPlxuPC91bD5cbjwvZGV0YWlscz5cbjxwcmU+PGNhbnZhcz5jYW52YXMgaGVyZTwvY2FudmFzPjwvcHJlPjxkZXRhaWxzPjwvZGV0YWlscz5gKTtcblx0XHRtZC5zdXBwb3J0SHRtbCA9IHRydWU7XG5cdFx0Y29uc3QgcmVzdWx0ID0gc3RvcmUuYWRkKHRlc3RSZW5kZXJlci5yZW5kZXIobWQpKTtcblx0XHRhd2FpdCBhc3NlcnRTbmFwc2hvdChyZXN1bHQuZWxlbWVudC5vdXRlckhUTUwpO1xuXHR9KTtcblxuXHR0ZXN0KCdzZWxmLWNsb3NpbmcgZWxlbWVudHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbWQgPSBuZXcgTWFya2Rvd25TdHJpbmcoJzxhcmVhPjxocj48YnI+PGlucHV0IHR5cGU9XCJ0ZXh0XCIgdmFsdWU9XCJ0ZXN0XCI+Jyk7XG5cdFx0bWQuc3VwcG9ydEh0bWwgPSB0cnVlO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHN0b3JlLmFkZCh0ZXN0UmVuZGVyZXIucmVuZGVyKG1kKSk7XG5cdFx0YXdhaXQgYXNzZXJ0U25hcHNob3QocmVzdWx0LmVsZW1lbnQub3V0ZXJIVE1MKTtcblx0fSk7XG5cblx0dGVzdCgnaHRtbCBjb21tZW50cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtZCA9IG5ldyBNYXJrZG93blN0cmluZygnPCEtLSBjb21tZW50MSA8ZGl2PjwvZGl2PiAtLT48ZGl2PmNvbnRlbnQ8L2Rpdj48IS0tIGNvbW1lbnQyIC0tPicpO1xuXHRcdG1kLnN1cHBvcnRIdG1sID0gdHJ1ZTtcblx0XHRjb25zdCByZXN1bHQgPSBzdG9yZS5hZGQodGVzdFJlbmRlcmVyLnJlbmRlcihtZCkpO1xuXHRcdGF3YWl0IGFzc2VydFNuYXBzaG90KHJlc3VsdC5lbGVtZW50Lm91dGVySFRNTCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NEQVRBJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1kID0gbmV3IE1hcmtkb3duU3RyaW5nKCc8IVtDREFUQVs8ZGl2PmNvbnRlbnQ8L2Rpdj5dXT4nKTtcblx0XHRtZC5zdXBwb3J0SHRtbCA9IHRydWU7XG5cdFx0Y29uc3QgcmVzdWx0ID0gc3RvcmUuYWRkKHRlc3RSZW5kZXJlci5yZW5kZXIobWQpKTtcblx0XHRhd2FpdCBhc3NlcnRTbmFwc2hvdChyZXN1bHQuZWxlbWVudC5vdXRlckhUTUwpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZW1vdGUgaW1hZ2VzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1kID0gbmV3IE1hcmtkb3duU3RyaW5nKCc8aW1nIHNyYz1cImh0dHA6Ly9hbGxvd2VkLmNvbS9pbWFnZS5qcGdcIj4gPGltZyBzcmM9XCJodHRwOi8vZGlzYWxsb3dlZC5jb20vaW1hZ2UuanBnXCI+Jyk7XG5cdFx0bWQuc3VwcG9ydEh0bWwgPSB0cnVlO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHN0b3JlLmFkZCh0ZXN0UmVuZGVyZXIucmVuZGVyKG1kKSk7XG5cdFx0YXdhaXQgYXNzZXJ0U25hcHNob3QocmVzdWx0LmVsZW1lbnQub3V0ZXJIVE1MKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMscUNBQXFDO0FBRTlDLE1BQU0sd0JBQXdCLE1BQU07QUFDbkMsUUFBTSxRQUFRLHdDQUF3QztBQUV0RCxNQUFJO0FBQ0osUUFBTSxNQUFNO0FBQ1gsVUFBTSx1QkFBdUIsTUFBTSxJQUFJLDhCQUE4QixRQUFXLEtBQUssQ0FBQztBQUN0Rix5QkFBcUIsS0FBSyx1QkFBdUIsSUFBSSx5QkFBeUIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBQ3JHLG1CQUFlLHFCQUFxQixlQUFlLHNCQUFzQixDQUFDLENBQUM7QUFBQSxFQUM1RSxDQUFDO0FBRUQsT0FBSyxVQUFVLFlBQVk7QUFDMUIsVUFBTSxLQUFLLElBQUksZUFBZSxHQUFHO0FBQ2pDLFVBQU0sU0FBUyxNQUFNLElBQUksYUFBYSxPQUFPLEVBQUUsQ0FBQztBQUNoRCxVQUFNLGVBQWUsT0FBTyxRQUFRLFdBQVc7QUFBQSxFQUNoRCxDQUFDO0FBRUQsT0FBSyxzQ0FBc0MsWUFBWTtBQUN0RCxVQUFNLEtBQUssSUFBSSxlQUFlLFdBQVc7QUFDekMsT0FBRyxjQUFjO0FBQ2pCLFVBQU0sU0FBUyxNQUFNLElBQUksYUFBYSxPQUFPLEVBQUUsQ0FB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
