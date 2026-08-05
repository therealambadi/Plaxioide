import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { merge } from "../../common/snippetsMerge.js";
const tsSnippet1 = `{

	// Place your snippets for TypeScript here. Each snippet is defined under a snippet name and has a prefix, body and
	// description. The prefix is what is used to trigger the snippet and the body will be expanded and inserted. Possible variables are:
	// $1, $2 for tab stops, $0 for the final cursor position, Placeholders with the
	// same ids are connected.
	"Print to console": {
	// Example:
	"prefix": "log",
		"body": [
			"console.log('$1');",
			"$2"
		],
			"description": "Log output to console",
	}

}`;
const tsSnippet2 = `{

	// Place your snippets for TypeScript here. Each snippet is defined under a snippet name and has a prefix, body and
	// description. The prefix is what is used to trigger the snippet and the body will be expanded and inserted. Possible variables are:
	// $1, $2 for tab stops, $0 for the final cursor position, Placeholders with the
	// same ids are connected.
	"Print to console": {
	// Example:
	"prefix": "log",
		"body": [
			"console.log('$1');",
			"$2"
		],
			"description": "Log output to console always",
	}

}`;
const htmlSnippet1 = `{
/*
	// Place your snippets for HTML here. Each snippet is defined under a snippet name and has a prefix, body and
	// description. The prefix is what is used to trigger the snippet and the body will be expanded and inserted.
	// Example:
	"Print to console": {
	"prefix": "log",
		"body": [
			"console.log('$1');",
			"$2"
		],
			"description": "Log output to console"
	}
*/
"Div": {
	"prefix": "div",
		"body": [
			"<div>",
			"",
			"</div>"
		],
			"description": "New div"
	}
}`;
const htmlSnippet2 = `{
/*
	// Place your snippets for HTML here. Each snippet is defined under a snippet name and has a prefix, body and
	// description. The prefix is what is used to trigger the snippet and the body will be expanded and inserted.
	// Example:
	"Print to console": {
	"prefix": "log",
		"body": [
			"console.log('$1');",
			"$2"
		],
			"description": "Log output to console"
	}
*/
"Div": {
	"prefix": "div",
		"body": [
			"<div>",
			"",
			"</div>"
		],
			"description": "New div changed"
	}
}`;
const cSnippet = `{
	// Place your snippets for c here. Each snippet is defined under a snippet name and has a prefix, body and
	// description. The prefix is what is used to trigger the snippet and the body will be expanded and inserted. Possible variables are:
	// $1, $2 for tab stops, $0 for the final cursor position.Placeholders with the
	// same ids are connected.
	// Example:
	"Print to console": {
	"prefix": "log",
		"body": [
			"console.log('$1');",
			"$2"
		],
			"description": "Log output to console"
	}
}`;
suite("SnippetsMerge", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("merge when local and remote are same with one snippet", async () => {
    const local = { "html.json": htmlSnippet1 };
    const remote = { "html.json": htmlSnippet1 };
    const actual = merge(local, remote, null);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when local and remote are same with multiple entries", async () => {
    const local = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const remote = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const actual = merge(local, remote, null);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when local and remote are same with multiple entries in different order", async () => {
    const local = { "typescript.json": tsSnippet1, "html.json": htmlSnippet1 };
    const remote = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const actual = merge(local, remote, null);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when local and remote are same with different base content", async () => {
    const local = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const remote = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const base = { "html.json": htmlSnippet2, "typescript.json": tsSnippet2 };
    const actual = merge(local, remote, base);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when a new entry is added to remote", async () => {
    const local = { "html.json": htmlSnippet1 };
    const remote = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const actual = merge(local, remote, null);
    assert.deepStrictEqual(actual.local.added, { "typescript.json": tsSnippet1 });
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when multiple new entries are added to remote", async () => {
    const local = {};
    const remote = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const actual = merge(local, remote, null);
    assert.deepStrictEqual(actual.local.added, remote);
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when new entry is added to remote from base and local has not changed", async () => {
    const local = { "html.json": htmlSnippet1 };
    const remote = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const actual = merge(local, remote, local);
    assert.deepStrictEqual(actual.local.added, { "typescript.json": tsSnippet1 });
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when an entry is removed from remote from base and local has not changed", async () => {
    const local = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const remote = { "html.json": htmlSnippet1 };
    const actual = merge(local, remote, local);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, ["typescript.json"]);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when all entries are removed from base and local has not changed", async () => {
    const local = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const remote = {};
    const actual = merge(local, remote, local);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, ["html.json", "typescript.json"]);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when an entry is updated in remote from base and local has not changed", async () => {
    const local = { "html.json": htmlSnippet1 };
    const remote = { "html.json": htmlSnippet2 };
    const actual = merge(local, remote, local);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, { "html.json": htmlSnippet2 });
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when remote has moved forwarded with multiple changes and local stays with base", async () => {
    const local = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const remote = { "html.json": htmlSnippet2, "c.json": cSnippet };
    const actual = merge(local, remote, local);
    assert.deepStrictEqual(actual.local.added, { "c.json": cSnippet });
    assert.deepStrictEqual(actual.local.updated, { "html.json": htmlSnippet2 });
    assert.deepStrictEqual(actual.local.removed, ["typescript.json"]);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when a new entries are added to local", async () => {
    const local = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1, "c.json": cSnippet };
    const remote = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const actual = merge(local, remote, null);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, { "c.json": cSnippet });
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when multiple new entries are added to local from base and remote is not changed", async () => {
    const local = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1, "c.json": cSnippet };
    const remote = { "typescript.json": tsSnippet1 };
    const actual = merge(local, remote, remote);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, { "html.json": htmlSnippet1, "c.json": cSnippet });
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when an entry is removed from local from base and remote has not changed", async () => {
    const local = { "html.json": htmlSnippet1 };
    const remote = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const actual = merge(local, remote, remote);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, ["typescript.json"]);
  });
  test("merge when an entry is updated in local from base and remote has not changed", async () => {
    const local = { "html.json": htmlSnippet2, "typescript.json": tsSnippet1 };
    const remote = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const actual = merge(local, remote, remote);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, { "html.json": htmlSnippet2 });
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when local has moved forwarded with multiple changes and remote stays with base", async () => {
    const local = { "html.json": htmlSnippet2, "c.json": cSnippet };
    const remote = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const actual = merge(local, remote, remote);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, { "c.json": cSnippet });
    assert.deepStrictEqual(actual.remote.updated, { "html.json": htmlSnippet2 });
    assert.deepStrictEqual(actual.remote.removed, ["typescript.json"]);
  });
  test("merge when local and remote with one entry but different value", async () => {
    const local = { "html.json": htmlSnippet1 };
    const remote = { "html.json": htmlSnippet2 };
    const actual = merge(local, remote, null);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, ["html.json"]);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when the entry is removed in remote but updated in local and a new entry is added in remote", async () => {
    const base = { "html.json": htmlSnippet1 };
    const local = { "html.json": htmlSnippet2 };
    const remote = { "typescript.json": tsSnippet1 };
    const actual = merge(local, remote, base);
    assert.deepStrictEqual(actual.local.added, { "typescript.json": tsSnippet1 });
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, ["html.json"]);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge with single entry and local is empty", async () => {
    const base = { "html.json": htmlSnippet1 };
    const local = {};
    const remote = { "html.json": htmlSnippet2 };
    const actual = merge(local, remote, base);
    assert.deepStrictEqual(actual.local.added, { "html.json": htmlSnippet2 });
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, []);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when local and remote has moved forwareded with conflicts", async () => {
    const base = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const local = { "html.json": htmlSnippet2, "c.json": cSnippet };
    const remote = { "typescript.json": tsSnippet2 };
    const actual = merge(local, remote, base);
    assert.deepStrictEqual(actual.local.added, { "typescript.json": tsSnippet2 });
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, ["html.json"]);
    assert.deepStrictEqual(actual.remote.added, { "c.json": cSnippet });
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
  test("merge when local and remote has moved forwareded with multiple conflicts", async () => {
    const base = { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 };
    const local = { "html.json": htmlSnippet2, "typescript.json": tsSnippet2, "c.json": cSnippet };
    const remote = { "c.json": cSnippet };
    const actual = merge(local, remote, base);
    assert.deepStrictEqual(actual.local.added, {});
    assert.deepStrictEqual(actual.local.updated, {});
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.conflicts, ["html.json", "typescript.json"]);
    assert.deepStrictEqual(actual.remote.added, {});
    assert.deepStrictEqual(actual.remote.updated, {});
    assert.deepStrictEqual(actual.remote.removed, []);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvdGVzdC9jb21tb24vc25pcHBldHNNZXJnZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBtZXJnZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9zbmlwcGV0c01lcmdlLmpzJztcblxuY29uc3QgdHNTbmlwcGV0MSA9IGB7XG5cblx0Ly8gUGxhY2UgeW91ciBzbmlwcGV0cyBmb3IgVHlwZVNjcmlwdCBoZXJlLiBFYWNoIHNuaXBwZXQgaXMgZGVmaW5lZCB1bmRlciBhIHNuaXBwZXQgbmFtZSBhbmQgaGFzIGEgcHJlZml4LCBib2R5IGFuZFxuXHQvLyBkZXNjcmlwdGlvbi4gVGhlIHByZWZpeCBpcyB3aGF0IGlzIHVzZWQgdG8gdHJpZ2dlciB0aGUgc25pcHBldCBhbmQgdGhlIGJvZHkgd2lsbCBiZSBleHBhbmRlZCBhbmQgaW5zZXJ0ZWQuIFBvc3NpYmxlIHZhcmlhYmxlcyBhcmU6XG5cdC8vICQxLCAkMiBmb3IgdGFiIHN0b3BzLCAkMCBmb3IgdGhlIGZpbmFsIGN1cnNvciBwb3NpdGlvbiwgUGxhY2Vob2xkZXJzIHdpdGggdGhlXG5cdC8vIHNhbWUgaWRzIGFyZSBjb25uZWN0ZWQuXG5cdFwiUHJpbnQgdG8gY29uc29sZVwiOiB7XG5cdC8vIEV4YW1wbGU6XG5cdFwicHJlZml4XCI6IFwibG9nXCIsXG5cdFx0XCJib2R5XCI6IFtcblx0XHRcdFwiY29uc29sZS5sb2coJyQxJyk7XCIsXG5cdFx0XHRcIiQyXCJcblx0XHRdLFxuXHRcdFx0XCJkZXNjcmlwdGlvblwiOiBcIkxvZyBvdXRwdXQgdG8gY29uc29sZVwiLFxuXHR9XG5cbn1gO1xuXG5jb25zdCB0c1NuaXBwZXQyID0gYHtcblxuXHQvLyBQbGFjZSB5b3VyIHNuaXBwZXRzIGZvciBUeXBlU2NyaXB0IGhlcmUuIEVhY2ggc25pcHBldCBpcyBkZWZpbmVkIHVuZGVyIGEgc25pcHBldCBuYW1lIGFuZCBoYXMgYSBwcmVmaXgsIGJvZHkgYW5kXG5cdC8vIGRlc2NyaXB0aW9uLiBUaGUgcHJlZml4IGlzIHdoYXQgaXMgdXNlZCB0byB0cmlnZ2VyIHRoZSBzbmlwcGV0IGFuZCB0aGUgYm9keSB3aWxsIGJlIGV4cGFuZGVkIGFuZCBpbnNlcnRlZC4gUG9zc2libGUgdmFyaWFibGVzIGFyZTpcblx0Ly8gJDEsICQyIGZvciB0YWIgc3RvcHMsICQwIGZvciB0aGUgZmluYWwgY3Vyc29yIHBvc2l0aW9uLCBQbGFjZWhvbGRlcnMgd2l0aCB0aGVcblx0Ly8gc2FtZSBpZHMgYXJlIGNvbm5lY3RlZC5cblx0XCJQcmludCB0byBjb25zb2xlXCI6IHtcblx0Ly8gRXhhbXBsZTpcblx0XCJwcmVmaXhcIjogXCJsb2dcIixcblx0XHRcImJvZHlcIjogW1xuXHRcdFx0XCJjb25zb2xlLmxvZygnJDEnKTtcIixcblx0XHRcdFwiJDJcIlxuXHRcdF0sXG5cdFx0XHRcImRlc2NyaXB0aW9uXCI6IFwiTG9nIG91dHB1dCB0byBjb25zb2xlIGFsd2F5c1wiLFxuXHR9XG5cbn1gO1xuXG5jb25zdCBodG1sU25pcHBldDEgPSBge1xuLypcblx0Ly8gUGxhY2UgeW91ciBzbmlwcGV0cyBmb3IgSFRNTCBoZXJlLiBFYWNoIHNuaXBwZXQgaXMgZGVmaW5lZCB1bmRlciBhIHNuaXBwZXQgbmFtZSBhbmQgaGFzIGEgcHJlZml4LCBib2R5IGFuZFxuXHQvLyBkZXNjcmlwdGlvbi4gVGhlIHByZWZpeCBpcyB3aGF0IGlzIHVzZWQgdG8gdHJpZ2dlciB0aGUgc25pcHBldCBhbmQgdGhlIGJvZHkgd2lsbCBiZSBleHBhbmRlZCBhbmQgaW5zZXJ0ZWQuXG5cdC8vIEV4YW1wbGU6XG5cdFwiUHJpbnQgdG8gY29uc29sZVwiOiB7XG5cdFwicHJlZml4XCI6IFwibG9nXCIsXG5cdFx0XCJib2R5XCI6IFtcblx0XHRcdFwiY29uc29sZS5sb2coJyQxJyk7XCIsXG5cdFx0XHRcIiQyXCJcblx0XHRdLFxuXHRcdFx0XCJkZXNjcmlwdGlvblwiOiBcIkxvZyBvdXRwdXQgdG8gY29uc29sZVwiXG5cdH1cbiovXG5cIkRpdlwiOiB7XG5cdFwicHJlZml4XCI6IFwiZGl2XCIsXG5cdFx0XCJib2R5XCI6IFtcblx0XHRcdFwiPGRpdj5cIixcblx0XHRcdFwiXCIsXG5cdFx0XHRcIjwvZGl2PlwiXG5cdFx0XSxcblx0XHRcdFwiZGVzY3JpcHRpb25cIjogXCJOZXcgZGl2XCJcblx0fVxufWA7XG5cbmNvbnN0IGh0bWxTbmlwcGV0MiA9IGB7XG4vKlxuXHQvLyBQbGFjZSB5b3VyIHNuaXBwZXRzIGZvciBIVE1MIGhlcmUuIEVhY2ggc25pcHBldCBpcyBkZWZpbmVkIHVuZGVyIGEgc25pcHBldCBuYW1lIGFuZCBoYXMgYSBwcmVmaXgsIGJvZHkgYW5kXG5cdC8vIGRlc2NyaXB0aW9uLiBUaGUgcHJlZml4IGlzIHdoYXQgaXMgdXNlZCB0byB0cmlnZ2VyIHRoZSBzbmlwcGV0IGFuZCB0aGUgYm9keSB3aWxsIGJlIGV4cGFuZGVkIGFuZCBpbnNlcnRlZC5cblx0Ly8gRXhhbXBsZTpcblx0XCJQcmludCB0byBjb25zb2xlXCI6IHtcblx0XCJwcmVmaXhcIjogXCJsb2dcIixcblx0XHRcImJvZHlcIjogW1xuXHRcdFx0XCJjb25zb2xlLmxvZygnJDEnKTtcIixcblx0XHRcdFwiJDJcIlxuXHRcdF0sXG5cdFx0XHRcImRlc2NyaXB0aW9uXCI6IFwiTG9nIG91dHB1dCB0byBjb25zb2xlXCJcblx0fVxuKi9cblwiRGl2XCI6IHtcblx0XCJwcmVmaXhcIjogXCJkaXZcIixcblx0XHRcImJvZHlcIjogW1xuXHRcdFx0XCI8ZGl2PlwiLFxuXHRcdFx0XCJcIixcblx0XHRcdFwiPC9kaXY+XCJcblx0XHRdLFxuXHRcdFx0XCJkZXNjcmlwdGlvblwiOiBcIk5ldyBkaXYgY2hhbmdlZFwiXG5cdH1cbn1gO1xuXG5jb25zdCBjU25pcHBldCA9IGB7XG5cdC8vIFBsYWNlIHlvdXIgc25pcHBldHMgZm9yIGMgaGVyZS4gRWFjaCBzbmlwcGV0IGlzIGRlZmluZWQgdW5kZXIgYSBzbmlwcGV0IG5hbWUgYW5kIGhhcyBhIHByZWZpeCwgYm9keSBhbmRcblx0Ly8gZGVzY3JpcHRpb24uIFRoZSBwcmVmaXggaXMgd2hhdCBpcyB1c2VkIHRvIHRyaWdnZXIgdGhlIHNuaXBwZXQgYW5kIHRoZSBib2R5IHdpbGwgYmUgZXhwYW5kZWQgYW5kIGluc2VydGVkLiBQb3NzaWJsZSB2YXJpYWJsZXMgYXJlOlxuXHQvLyAkMSwgJDIgZm9yIHRhYiBzdG9wcywgJDAgZm9yIHRoZSBmaW5hbCBjdXJzb3IgcG9zaXRpb24uUGxhY2Vob2xkZXJzIHdpdGggdGhlXG5cdC8vIHNhbWUgaWRzIGFyZSBjb25uZWN0ZWQuXG5cdC8vIEV4YW1wbGU6XG5cdFwiUHJpbnQgdG8gY29uc29sZVwiOiB7XG5cdFwicHJlZml4XCI6IFwibG9nXCIsXG5cdFx0XCJib2R5XCI6IFtcblx0XHRcdFwiY29uc29sZS5sb2coJyQxJyk7XCIsXG5cdFx0XHRcIiQyXCJcblx0XHRdLFxuXHRcdFx0XCJkZXNjcmlwdGlvblwiOiBcIkxvZyBvdXRwdXQgdG8gY29uc29sZVwiXG5cdH1cbn1gO1xuXG5zdWl0ZSgnU25pcHBldHNNZXJnZScsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBsb2NhbCBhbmQgcmVtb3RlIGFyZSBzYW1lIHdpdGggb25lIHNuaXBwZXQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWwgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEgfTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEgfTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsLCByZW1vdGUsIG51bGwpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0cywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5hZGRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnJlbW92ZWQsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBsb2NhbCBhbmQgcmVtb3RlIGFyZSBzYW1lIHdpdGggbXVsdGlwbGUgZW50cmllcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbCA9IHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MSwgJ3R5cGVzY3JpcHQuanNvbic6IHRzU25pcHBldDEgfTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEsICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbCwgcmVtb3RlLCBudWxsKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUudXBkYXRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5yZW1vdmVkLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gbG9jYWwgYW5kIHJlbW90ZSBhcmUgc2FtZSB3aXRoIG11bHRpcGxlIGVudHJpZXMgaW4gZGlmZmVyZW50IG9yZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsID0geyAndHlwZXNjcmlwdC5qc29uJzogdHNTbmlwcGV0MSwgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MSB9O1xuXHRcdGNvbnN0IHJlbW90ZSA9IHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MSwgJ3R5cGVzY3JpcHQuanNvbic6IHRzU25pcHBldDEgfTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsLCByZW1vdGUsIG51bGwpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0cywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5hZGRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnJlbW92ZWQsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBsb2NhbCBhbmQgcmVtb3RlIGFyZSBzYW1lIHdpdGggZGlmZmVyZW50IGJhc2UgY29udGVudCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbCA9IHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MSwgJ3R5cGVzY3JpcHQuanNvbic6IHRzU25pcHBldDEgfTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEsICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH07XG5cdFx0Y29uc3QgYmFzZSA9IHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MiwgJ3R5cGVzY3JpcHQuanNvbic6IHRzU25pcHBldDIgfTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsLCByZW1vdGUsIGJhc2UpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0cywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5hZGRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnJlbW92ZWQsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBhIG5ldyBlbnRyeSBpcyBhZGRlZCB0byByZW1vdGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWwgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEgfTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEsICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbCwgcmVtb3RlLCBudWxsKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCB7ICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLmFkZGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnVwZGF0ZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUucmVtb3ZlZCwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIG11bHRpcGxlIG5ldyBlbnRyaWVzIGFyZSBhZGRlZCB0byByZW1vdGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWwgPSB7fTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEsICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbCwgcmVtb3RlLCBudWxsKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCByZW1vdGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLmFkZGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnVwZGF0ZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUucmVtb3ZlZCwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIG5ldyBlbnRyeSBpcyBhZGRlZCB0byByZW1vdGUgZnJvbSBiYXNlIGFuZCBsb2NhbCBoYXMgbm90IGNoYW5nZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWwgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEgfTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEsICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbCwgcmVtb3RlLCBsb2NhbCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgeyAndHlwZXNjcmlwdC5qc29uJzogdHNTbmlwcGV0MSB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0cywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5hZGRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnJlbW92ZWQsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBhbiBlbnRyeSBpcyByZW1vdmVkIGZyb20gcmVtb3RlIGZyb20gYmFzZSBhbmQgbG9jYWwgaGFzIG5vdCBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsID0geyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQxLCAndHlwZXNjcmlwdC5qc29uJzogdHNTbmlwcGV0MSB9O1xuXHRcdGNvbnN0IHJlbW90ZSA9IHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MSB9O1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWwsIHJlbW90ZSwgbG9jYWwpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgWyd0eXBlc2NyaXB0Lmpzb24nXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLmFkZGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnVwZGF0ZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUucmVtb3ZlZCwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGFsbCBlbnRyaWVzIGFyZSByZW1vdmVkIGZyb20gYmFzZSBhbmQgbG9jYWwgaGFzIG5vdCBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsID0geyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQxLCAndHlwZXNjcmlwdC5qc29uJzogdHNTbmlwcGV0MSB9O1xuXHRcdGNvbnN0IHJlbW90ZSA9IHt9O1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWwsIHJlbW90ZSwgbG9jYWwpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgWydodG1sLmpzb24nLCAndHlwZXNjcmlwdC5qc29uJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0cywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5hZGRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnJlbW92ZWQsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBhbiBlbnRyeSBpcyB1cGRhdGVkIGluIHJlbW90ZSBmcm9tIGJhc2UgYW5kIGxvY2FsIGhhcyBub3QgY2hhbmdlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbCA9IHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MSB9O1xuXHRcdGNvbnN0IHJlbW90ZSA9IHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MiB9O1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWwsIHJlbW90ZSwgbG9jYWwpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDIgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0cywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5hZGRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnJlbW92ZWQsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiByZW1vdGUgaGFzIG1vdmVkIGZvcndhcmRlZCB3aXRoIG11bHRpcGxlIGNoYW5nZXMgYW5kIGxvY2FsIHN0YXlzIHdpdGggYmFzZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbCA9IHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MSwgJ3R5cGVzY3JpcHQuanNvbic6IHRzU25pcHBldDEgfTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDIsICdjLmpzb24nOiBjU25pcHBldCB9O1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWwsIHJlbW90ZSwgbG9jYWwpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIHsgJ2MuanNvbic6IGNTbmlwcGV0IH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MiB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbJ3R5cGVzY3JpcHQuanNvbiddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUudXBkYXRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5yZW1vdmVkLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gYSBuZXcgZW50cmllcyBhcmUgYWRkZWQgdG8gbG9jYWwnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWwgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEsICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxLCAnYy5qc29uJzogY1NuaXBwZXQgfTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEsICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbCwgcmVtb3RlLCBudWxsKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUuYWRkZWQsIHsgJ2MuanNvbic6IGNTbmlwcGV0IH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnJlbW92ZWQsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBtdWx0aXBsZSBuZXcgZW50cmllcyBhcmUgYWRkZWQgdG8gbG9jYWwgZnJvbSBiYXNlIGFuZCByZW1vdGUgaXMgbm90IGNoYW5nZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWwgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEsICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxLCAnYy5qc29uJzogY1NuaXBwZXQgfTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbCwgcmVtb3RlLCByZW1vdGUpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0cywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5hZGRlZCwgeyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQxLCAnYy5qc29uJzogY1NuaXBwZXQgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnVwZGF0ZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUucmVtb3ZlZCwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGFuIGVudHJ5IGlzIHJlbW92ZWQgZnJvbSBsb2NhbCBmcm9tIGJhc2UgYW5kIHJlbW90ZSBoYXMgbm90IGNoYW5nZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWwgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEgfTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEsICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbCwgcmVtb3RlLCByZW1vdGUpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0cywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5hZGRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnJlbW92ZWQsIFsndHlwZXNjcmlwdC5qc29uJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGFuIGVudHJ5IGlzIHVwZGF0ZWQgaW4gbG9jYWwgZnJvbSBiYXNlIGFuZCByZW1vdGUgaGFzIG5vdCBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsID0geyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQyLCAndHlwZXNjcmlwdC5qc29uJzogdHNTbmlwcGV0MSB9O1xuXHRcdGNvbnN0IHJlbW90ZSA9IHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MSwgJ3R5cGVzY3JpcHQuanNvbic6IHRzU25pcHBldDEgfTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsLCByZW1vdGUsIHJlbW90ZSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLmFkZGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnVwZGF0ZWQsIHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MiB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUucmVtb3ZlZCwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGxvY2FsIGhhcyBtb3ZlZCBmb3J3YXJkZWQgd2l0aCBtdWx0aXBsZSBjaGFuZ2VzIGFuZCByZW1vdGUgc3RheXMgd2l0aCBiYXNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsID0geyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQyLCAnYy5qc29uJzogY1NuaXBwZXQgfTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEsICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbCwgcmVtb3RlLCByZW1vdGUpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0cywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5hZGRlZCwgeyAnYy5qc29uJzogY1NuaXBwZXQgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnVwZGF0ZWQsIHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MiB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUucmVtb3ZlZCwgWyd0eXBlc2NyaXB0Lmpzb24nXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gbG9jYWwgYW5kIHJlbW90ZSB3aXRoIG9uZSBlbnRyeSBidXQgZGlmZmVyZW50IHZhbHVlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsID0geyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQxIH07XG5cdFx0Y29uc3QgcmVtb3RlID0geyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQyIH07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbCwgcmVtb3RlLCBudWxsKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHMsIFsnaHRtbC5qc29uJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5hZGRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnJlbW92ZWQsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiB0aGUgZW50cnkgaXMgcmVtb3ZlZCBpbiByZW1vdGUgYnV0IHVwZGF0ZWQgaW4gbG9jYWwgYW5kIGEgbmV3IGVudHJ5IGlzIGFkZGVkIGluIHJlbW90ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBiYXNlID0geyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQxIH07XG5cdFx0Y29uc3QgbG9jYWwgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDIgfTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbCwgcmVtb3RlLCBiYXNlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCB7ICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzLCBbJ2h0bWwuanNvbiddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUudXBkYXRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5yZW1vdmVkLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdpdGggc2luZ2xlIGVudHJ5IGFuZCBsb2NhbCBpcyBlbXB0eScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBiYXNlID0geyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQxIH07XG5cdFx0Y29uc3QgbG9jYWwgPSB7fTtcblx0XHRjb25zdCByZW1vdGUgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDIgfTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsLCByZW1vdGUsIGJhc2UpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MiB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0cywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5hZGRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS51cGRhdGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnJlbW92ZWQsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBsb2NhbCBhbmQgcmVtb3RlIGhhcyBtb3ZlZCBmb3J3YXJlZGVkIHdpdGggY29uZmxpY3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2UgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEsICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH07XG5cdFx0Y29uc3QgbG9jYWwgPSB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDIsICdjLmpzb24nOiBjU25pcHBldCB9O1xuXHRcdGNvbnN0IHJlbW90ZSA9IHsgJ3R5cGVzY3JpcHQuanNvbic6IHRzU25pcHBldDIgfTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsLCByZW1vdGUsIGJhc2UpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIHsgJ3R5cGVzY3JpcHQuanNvbic6IHRzU25pcHBldDIgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHMsIFsnaHRtbC5qc29uJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5hZGRlZCwgeyAnYy5qc29uJzogY1NuaXBwZXQgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLnVwZGF0ZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUucmVtb3ZlZCwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGxvY2FsIGFuZCByZW1vdGUgaGFzIG1vdmVkIGZvcndhcmVkZWQgd2l0aCBtdWx0aXBsZSBjb25mbGljdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgYmFzZSA9IHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MSwgJ3R5cGVzY3JpcHQuanNvbic6IHRzU25pcHBldDEgfTtcblx0XHRjb25zdCBsb2NhbCA9IHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MiwgJ3R5cGVzY3JpcHQuanNvbic6IHRzU25pcHBldDIsICdjLmpzb24nOiBjU25pcHBldCB9O1xuXHRcdGNvbnN0IHJlbW90ZSA9IHsgJ2MuanNvbic6IGNTbmlwcGV0IH07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbCwgcmVtb3RlLCBiYXNlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCB7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHMsIFsnaHRtbC5qc29uJywgJ3R5cGVzY3JpcHQuanNvbiddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUuYWRkZWQsIHt9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUudXBkYXRlZCwge30pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZS5yZW1vdmVkLCBbXSk7XG5cdH0pO1xuXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLGFBQWE7QUFFdEIsTUFBTSxhQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFrQm5CLE1BQU0sYUFBYTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBa0JuQixNQUFNLGVBQWU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBeUJyQixNQUFNLGVBQWU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBeUJyQixNQUFNLFdBQVc7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBZ0JqQixNQUFNLGlCQUFpQixNQUFNO0FBQzVCLDBDQUF3QztBQUV4QyxPQUFLLHlEQUF5RCxZQUFZO0FBQ3pFLFVBQU0sUUFBUSxFQUFFLGFBQWEsYUFBYTtBQUMxQyxVQUFNLFNBQVMsRUFBRSxhQUFhLGFBQWE7QUFFM0MsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLElBQUk7QUFFeEMsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxXQUFXLENBQUMsQ0FBQztBQUMzQyxXQUFPLGdCQUFnQixPQUFPLE9BQU8sT0FBTyxDQUFDLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQ2hELFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUFBLEVBQ2pELENBQUM7QUFFRCxPQUFLLDhEQUE4RCxZQUFZO0FBQzlFLFVBQU0sUUFBUSxFQUFFLGFBQWEsY0FBYyxtQkFBbUIsV0FBVztBQUN6RSxVQUFNLFNBQVMsRUFBRSxhQUFhLGNBQWMsbUJBQW1CLFdBQVc7QUFFMUUsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLElBQUk7QUFFeEMsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxXQUFXLENBQUMsQ0FBQztBQUMzQyxXQUFPLGdCQUFnQixPQUFPLE9BQU8sT0FBTyxDQUFDLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQ2hELFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUFBLEVBQ2pELENBQUM7QUFFRCxPQUFLLGlGQUFpRixZQUFZO0FBQ2pHLFVBQU0sUUFBUSxFQUFFLG1CQUFtQixZQUFZLGFBQWEsYUFBYTtBQUN6RSxVQUFNLFNBQVMsRUFBRSxhQUFhLGNBQWMsbUJBQW1CLFdBQVc7QUFFMUUsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLElBQUk7QUFFeEMsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxXQUFXLENBQUMsQ0FBQztBQUMzQyxXQUFPLGdCQUFnQixPQUFPLE9BQU8sT0FBTyxDQUFDLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQ2hELFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUFBLEVBQ2pELENBQUM7QUFFRCxPQUFLLG9FQUFvRSxZQUFZO0FBQ3BGLFVBQU0sUUFBUSxFQUFFLGFBQWEsY0FBYyxtQkFBbUIsV0FBVztBQUN6RSxVQUFNLFNBQVMsRUFBRSxhQUFhLGNBQWMsbUJBQW1CLFdBQVc7QUFDMUUsVUFBTSxPQUFPLEVBQUUsYUFBYSxjQUFjLG1CQUFtQixXQUFXO0FBRXhFLFVBQU0sU0FBUyxNQUFNLE9BQU8sUUFBUSxJQUFJO0FBRXhDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxPQUFPLENBQUMsQ0FBQztBQUM3QyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQy9DLFdBQU8sZ0JBQWdCLE9BQU8sV0FBVyxDQUFDLENBQUM7QUFDM0MsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUNoRCxXQUFPLGdCQUFnQixPQUFPLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFBQSxFQUNqRCxDQUFDO0FBRUQsT0FBSyw2Q0FBNkMsWUFBWTtBQUM3RCxVQUFNLFFBQVEsRUFBRSxhQUFhLGFBQWE7QUFDMUMsVUFBTSxTQUFTLEVBQUUsYUFBYSxjQUFjLG1CQUFtQixXQUFXO0FBRTFFLFVBQU0sU0FBUyxNQUFNLE9BQU8sUUFBUSxJQUFJO0FBRXhDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxPQUFPLEVBQUUsbUJBQW1CLFdBQVcsQ0FBQztBQUM1RSxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQy9DLFdBQU8sZ0JBQWdCLE9BQU8sV0FBVyxDQUFDLENBQUM7QUFDM0MsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUNoRCxXQUFPLGdCQUFnQixPQUFPLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFBQSxFQUNqRCxDQUFDO0FBRUQsT0FBSyx1REFBdUQsWUFBWTtBQUN2RSxVQUFNLFFBQVEsQ0FBQztBQUNmLFVBQU0sU0FBUyxFQUFFLGFBQWEsY0FBYyxtQkFBbUIsV0FBVztBQUUxRSxVQUFNLFNBQVMsTUFBTSxPQUFPLFFBQVEsSUFBSTtBQUV4QyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sT0FBTyxNQUFNO0FBQ2pELFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxXQUFXLENBQUMsQ0FBQztBQUMzQyxXQUFPLGdCQUFnQixPQUFPLE9BQU8sT0FBTyxDQUFDLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQ2hELFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUFBLEVBQ2pELENBQUM7QUFFRCxPQUFLLCtFQUErRSxZQUFZO0FBQy9GLFVBQU0sUUFBUSxFQUFFLGFBQWEsYUFBYTtBQUMxQyxVQUFNLFNBQVMsRUFBRSxhQUFhLGNBQWMsbUJBQW1CLFdBQVc7QUFFMUUsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLEtBQUs7QUFFekMsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLE9BQU8sRUFBRSxtQkFBbUIsV0FBVyxDQUFDO0FBQzVFLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxXQUFXLENBQUMsQ0FBQztBQUMzQyxXQUFPLGdCQUFnQixPQUFPLE9BQU8sT0FBTyxDQUFDLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQ2hELFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUFBLEVBQ2pELENBQUM7QUFFRCxPQUFLLGtGQUFrRixZQUFZO0FBQ2xHLFVBQU0sUUFBUSxFQUFFLGFBQWEsY0FBYyxtQkFBbUIsV0FBVztBQUN6RSxVQUFNLFNBQVMsRUFBRSxhQUFhLGFBQWE7QUFFM0MsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLEtBQUs7QUFFekMsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLGlCQUFpQixDQUFDO0FBQ2hFLFdBQU8sZ0JBQWdCLE9BQU8sV0FBVyxDQUFDLENBQUM7QUFDM0MsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUNoRCxXQUFPLGdCQUFnQixPQUFPLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFBQSxFQUNqRCxDQUFDO0FBRUQsT0FBSywwRUFBMEUsWUFBWTtBQUMxRixVQUFNLFFBQVEsRUFBRSxhQUFhLGNBQWMsbUJBQW1CLFdBQVc7QUFDekUsVUFBTSxTQUFTLENBQUM7QUFFaEIsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLEtBQUs7QUFFekMsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLGFBQWEsaUJBQWlCLENBQUM7QUFDN0UsV0FBTyxnQkFBZ0IsT0FBTyxXQUFXLENBQUMsQ0FBQztBQUMzQyxXQUFPLGdCQUFnQixPQUFPLE9BQU8sT0FBTyxDQUFDLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQ2hELFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUFBLEVBQ2pELENBQUM7QUFFRCxPQUFLLGdGQUFnRixZQUFZO0FBQ2hHLFVBQU0sUUFBUSxFQUFFLGFBQWEsYUFBYTtBQUMxQyxVQUFNLFNBQVMsRUFBRSxhQUFhLGFBQWE7QUFFM0MsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLEtBQUs7QUFFekMsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLEVBQUUsYUFBYSxhQUFhLENBQUM7QUFDMUUsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQy9DLFdBQU8sZ0JBQWdCLE9BQU8sV0FBVyxDQUFDLENBQUM7QUFDM0MsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUNoRCxXQUFPLGdCQUFnQixPQUFPLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFBQSxFQUNqRCxDQUFDO0FBRUQsT0FBSyx5RkFBeUYsWUFBWTtBQUN6RyxVQUFNLFFBQVEsRUFBRSxhQUFhLGNBQWMsbUJBQW1CLFdBQVc7QUFDekUsVUFBTSxTQUFTLEVBQUUsYUFBYSxjQUFjLFVBQVUsU0FBUztBQUUvRCxVQUFNLFNBQVMsTUFBTSxPQUFPLFFBQVEsS0FBSztBQUV6QyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sT0FBTyxFQUFFLFVBQVUsU0FBUyxDQUFDO0FBQ2pFLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLEVBQUUsYUFBYSxhQUFhLENBQUM7QUFDMUUsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQztBQUNoRSxXQUFPLGdCQUFnQixPQUFPLFdBQVcsQ0FBQyxDQUFDO0FBQzNDLFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxPQUFPLENBQUMsQ0FBQztBQUM5QyxXQUFPLGdCQUFnQixPQUFPLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFDaEQsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQUEsRUFDakQsQ0FBQztBQUVELE9BQUssK0NBQStDLFlBQVk7QUFDL0QsVUFBTSxRQUFRLEVBQUUsYUFBYSxjQUFjLG1CQUFtQixZQUFZLFVBQVUsU0FBUztBQUM3RixVQUFNLFNBQVMsRUFBRSxhQUFhLGNBQWMsbUJBQW1CLFdBQVc7QUFFMUUsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLElBQUk7QUFFeEMsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxXQUFXLENBQUMsQ0FBQztBQUMzQyxXQUFPLGdCQUFnQixPQUFPLE9BQU8sT0FBTyxFQUFFLFVBQVUsU0FBUyxDQUFDO0FBQ2xFLFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUNoRCxXQUFPLGdCQUFnQixPQUFPLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFBQSxFQUNqRCxDQUFDO0FBRUQsT0FBSywwRkFBMEYsWUFBWTtBQUMxRyxVQUFNLFFBQVEsRUFBRSxhQUFhLGNBQWMsbUJBQW1CLFlBQVksVUFBVSxTQUFTO0FBQzdGLFVBQU0sU0FBUyxFQUFFLG1CQUFtQixXQUFXO0FBRS9DLFVBQU0sU0FBUyxNQUFNLE9BQU8sUUFBUSxNQUFNO0FBRTFDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxPQUFPLENBQUMsQ0FBQztBQUM3QyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQy9DLFdBQU8sZ0JBQWdCLE9BQU8sV0FBVyxDQUFDLENBQUM7QUFDM0MsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLE9BQU8sRUFBRSxhQUFhLGNBQWMsVUFBVSxTQUFTLENBQUM7QUFDN0YsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQ2hELFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUFBLEVBQ2pELENBQUM7QUFFRCxPQUFLLGtGQUFrRixZQUFZO0FBQ2xHLFVBQU0sUUFBUSxFQUFFLGFBQWEsYUFBYTtBQUMxQyxVQUFNLFNBQVMsRUFBRSxhQUFhLGNBQWMsbUJBQW1CLFdBQVc7QUFFMUUsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLE1BQU07QUFFMUMsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxXQUFXLENBQUMsQ0FBQztBQUMzQyxXQUFPLGdCQUFnQixPQUFPLE9BQU8sT0FBTyxDQUFDLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQ2hELFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsaUJBQWlCLENBQUM7QUFBQSxFQUNsRSxDQUFDO0FBRUQsT0FBSyxnRkFBZ0YsWUFBWTtBQUNoRyxVQUFNLFFBQVEsRUFBRSxhQUFhLGNBQWMsbUJBQW1CLFdBQVc7QUFDekUsVUFBTSxTQUFTLEVBQUUsYUFBYSxjQUFjLG1CQUFtQixXQUFXO0FBRTFFLFVBQU0sU0FBUyxNQUFNLE9BQU8sUUFBUSxNQUFNO0FBRTFDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxPQUFPLENBQUMsQ0FBQztBQUM3QyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQy9DLFdBQU8sZ0JBQWdCLE9BQU8sV0FBVyxDQUFDLENBQUM7QUFDM0MsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLEVBQUUsYUFBYSxhQUFhLENBQUM7QUFDM0UsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQUEsRUFDakQsQ0FBQztBQUVELE9BQUsseUZBQXlGLFlBQVk7QUFDekcsVUFBTSxRQUFRLEVBQUUsYUFBYSxjQUFjLFVBQVUsU0FBUztBQUM5RCxVQUFNLFNBQVMsRUFBRSxhQUFhLGNBQWMsbUJBQW1CLFdBQVc7QUFFMUUsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLE1BQU07QUFFMUMsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxXQUFXLENBQUMsQ0FBQztBQUMzQyxXQUFPLGdCQUFnQixPQUFPLE9BQU8sT0FBTyxFQUFFLFVBQVUsU0FBUyxDQUFDO0FBQ2xFLFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLEVBQUUsYUFBYSxhQUFhLENBQUM7QUFDM0UsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQztBQUFBLEVBQ2xFLENBQUM7QUFFRCxPQUFLLGtFQUFrRSxZQUFZO0FBQ2xGLFVBQU0sUUFBUSxFQUFFLGFBQWEsYUFBYTtBQUMxQyxVQUFNLFNBQVMsRUFBRSxhQUFhLGFBQWE7QUFFM0MsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLElBQUk7QUFFeEMsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxXQUFXLENBQUMsV0FBVyxDQUFDO0FBQ3RELFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxPQUFPLENBQUMsQ0FBQztBQUM5QyxXQUFPLGdCQUFnQixPQUFPLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFDaEQsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQUEsRUFDakQsQ0FBQztBQUVELE9BQUsscUdBQXFHLFlBQVk7QUFDckgsVUFBTSxPQUFPLEVBQUUsYUFBYSxhQUFhO0FBQ3pDLFVBQU0sUUFBUSxFQUFFLGFBQWEsYUFBYTtBQUMxQyxVQUFNLFNBQVMsRUFBRSxtQkFBbUIsV0FBVztBQUUvQyxVQUFNLFNBQVMsTUFBTSxPQUFPLFFBQVEsSUFBSTtBQUV4QyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sT0FBTyxFQUFFLG1CQUFtQixXQUFXLENBQUM7QUFDNUUsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQy9DLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLFdBQVcsQ0FBQyxXQUFXLENBQUM7QUFDdEQsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUNoRCxXQUFPLGdCQUFnQixPQUFPLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFBQSxFQUNqRCxDQUFDO0FBRUQsT0FBSyw4Q0FBOEMsWUFBWTtBQUM5RCxVQUFNLE9BQU8sRUFBRSxhQUFhLGFBQWE7QUFDekMsVUFBTSxRQUFRLENBQUM7QUFDZixVQUFNLFNBQVMsRUFBRSxhQUFhLGFBQWE7QUFFM0MsVUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLElBQUk7QUFFeEMsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLE9BQU8sRUFBRSxhQUFhLGFBQWEsQ0FBQztBQUN4RSxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQy9DLFdBQU8sZ0JBQWdCLE9BQU8sV0FBVyxDQUFDLENBQUM7QUFDM0MsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUNoRCxXQUFPLGdCQUFnQixPQUFPLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFBQSxFQUNqRCxDQUFDO0FBRUQsT0FBSyxtRUFBbUUsWUFBWTtBQUNuRixVQUFNLE9BQU8sRUFBRSxhQUFhLGNBQWMsbUJBQW1CLFdBQVc7QUFDeEUsVUFBTSxRQUFRLEVBQUUsYUFBYSxjQUFjLFVBQVUsU0FBUztBQUM5RCxVQUFNLFNBQVMsRUFBRSxtQkFBbUIsV0FBVztBQUUvQyxVQUFNLFNBQVMsTUFBTSxPQUFPLFFBQVEsSUFBSTtBQUV4QyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sT0FBTyxFQUFFLG1CQUFtQixXQUFXLENBQUM7QUFDNUUsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQy9DLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxTQUFTLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixPQUFPLFdBQVcsQ0FBQyxXQUFXLENBQUM7QUFDdEQsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLE9BQU8sRUFBRSxVQUFVLFNBQVMsQ0FBQztBQUNsRSxXQUFPLGdCQUFnQixPQUFPLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFDaEQsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQUEsRUFDakQsQ0FBQztBQUVELE9BQUssNEVBQTRFLFlBQVk7QUFDNUYsVUFBTSxPQUFPLEVBQUUsYUFBYSxjQUFjLG1CQUFtQixXQUFXO0FBQ3hFLFVBQU0sUUFBUSxFQUFFLGFBQWEsY0FBYyxtQkFBbUIsWUFBWSxVQUFVLFNBQVM7QUFDN0YsVUFBTSxTQUFTLEVBQUUsVUFBVSxTQUFTO0FBRXBDLFVBQU0sU0FBUyxNQUFNLE9BQU8sUUFBUSxJQUFJO0FBRXhDLFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxPQUFPLENBQUMsQ0FBQztBQUM3QyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQy9DLFdBQU8sZ0JBQWdCLE9BQU8sV0FBVyxDQUFDLGFBQWEsaUJBQWlCLENBQUM7QUFDekUsV0FBTyxnQkFBZ0IsT0FBTyxPQUFPLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLE9BQU8sT0FBTyxTQUFTLENBQUMsQ0FBQztBQUNoRCxXQUFPLGdCQUFnQixPQUFPLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFBQSxFQUNqRCxDQUFDO0FBRUYsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
