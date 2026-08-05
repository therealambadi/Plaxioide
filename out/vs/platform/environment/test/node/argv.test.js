import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { formatOptions, parseArgs } from "../../node/argv.js";
import { addArg } from "../../node/argvHelper.js";
function o(description, type = "string") {
  return {
    description,
    type
  };
}
function c(description, options) {
  return {
    description,
    type: "subcommand",
    options
  };
}
suite("formatOptions", () => {
  test("Text should display small columns correctly", () => {
    assert.deepStrictEqual(
      formatOptions({
        "add": o("bar")
      }, 80),
      ["  --add        bar"]
    );
    assert.deepStrictEqual(
      formatOptions({
        "add": o("bar"),
        "wait": o("ba"),
        "trace": o("b")
      }, 80),
      [
        "  --add        bar",
        "  --wait       ba",
        "  --trace      b"
      ]
    );
  });
  test("Text should wrap", () => {
    assert.deepStrictEqual(
      formatOptions({
        "add": o("bar ".repeat(9))
      }, 40),
      [
        "  --add        bar bar bar bar bar bar",
        "               bar bar bar"
      ]
    );
  });
  test("Text should revert to the condensed view when the terminal is too narrow", () => {
    assert.deepStrictEqual(
      formatOptions({
        "add": o("bar ".repeat(9))
      }, 30),
      [
        "  --add",
        "      bar bar bar bar bar bar bar bar bar "
      ]
    );
  });
  test("addArg", () => {
    assert.deepStrictEqual(addArg([], "foo"), ["foo"]);
    assert.deepStrictEqual(addArg([], "foo", "bar"), ["foo", "bar"]);
    assert.deepStrictEqual(addArg(["foo"], "bar"), ["foo", "bar"]);
    assert.deepStrictEqual(addArg(["--wait"], "bar"), ["--wait", "bar"]);
    assert.deepStrictEqual(addArg(["--wait", "--", "--foo"], "bar"), ["--wait", "bar", "--", "--foo"]);
    assert.deepStrictEqual(addArg(["--", "--foo"], "bar"), ["bar", "--", "--foo"]);
  });
  test("subcommands", () => {
    assert.deepStrictEqual(
      formatOptions({
        "testcmd": c("A test command", { add: o("A test command option") })
      }, 30),
      [
        "  --testcmd",
        "      A test command"
      ]
    );
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
suite("parseArgs", () => {
  function newErrorReporter(result = [], command = "") {
    const commandPrefix = command ? command + "-" : "";
    return {
      onDeprecatedOption: (deprecatedId) => result.push(`${commandPrefix}onDeprecatedOption ${deprecatedId}`),
      onUnknownOption: (id) => result.push(`${commandPrefix}onUnknownOption ${id}`),
      onEmptyValue: (id) => result.push(`${commandPrefix}onEmptyValue ${id}`),
      onMultipleValues: (id, usedValue) => result.push(`${commandPrefix}onMultipleValues ${id} ${usedValue}`),
      getSubcommandReporter: (c2) => newErrorReporter(result, commandPrefix + c2),
      result
    };
  }
  function assertParse(options, input, expected, expectedErrors) {
    const errorReporter = newErrorReporter();
    assert.deepStrictEqual(parseArgs(input, options, errorReporter), expected);
    assert.deepStrictEqual(errorReporter.result, expectedErrors);
  }
  test("subcommands", () => {
    const options1 = {
      "testcmd": c("A test command", {
        testArg: o("A test command option"),
        _: { type: "string[]" }
      }),
      _: { type: "string[]" }
    };
    assertParse(
      options1,
      ["testcmd", "--testArg=foo"],
      { testcmd: { testArg: "foo", "_": [] }, "_": [] },
      []
    );
    assertParse(
      options1,
      ["testcmd", "--testArg=foo", "--testX"],
      { testcmd: { testArg: "foo", "_": [] }, "_": [] },
      ["testcmd-onUnknownOption testX"]
    );
    const options2 = {
      "testcmd": c("A test command", {
        testArg: o("A test command option")
      }),
      testX: { type: "boolean", global: true, description: "" },
      _: { type: "string[]" }
    };
    assertParse(
      options2,
      ["testcmd", "--testArg=foo", "--testX"],
      { testcmd: { testArg: "foo", testX: true, "_": [] }, "_": [] },
      []
    );
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9lbnZpcm9ubWVudC90ZXN0L25vZGUvYXJndi50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBmb3JtYXRPcHRpb25zLCBPcHRpb24sIE9wdGlvbkRlc2NyaXB0aW9ucywgU3ViY29tbWFuZCwgcGFyc2VBcmdzLCBFcnJvclJlcG9ydGVyIH0gZnJvbSAnLi4vLi4vbm9kZS9hcmd2LmpzJztcbmltcG9ydCB7IGFkZEFyZyB9IGZyb20gJy4uLy4uL25vZGUvYXJndkhlbHBlci5qcyc7XG5cbmZ1bmN0aW9uIG8oZGVzY3JpcHRpb246IHN0cmluZywgdHlwZTogJ2Jvb2xlYW4nIHwgJ3N0cmluZycgfCAnc3RyaW5nW10nID0gJ3N0cmluZycpOiBPcHRpb248YW55PiB7XG5cdHJldHVybiB7XG5cdFx0ZGVzY3JpcHRpb24sIHR5cGVcblx0fTtcbn1cbmZ1bmN0aW9uIGMoZGVzY3JpcHRpb246IHN0cmluZywgb3B0aW9uczogT3B0aW9uRGVzY3JpcHRpb25zPGFueT4pOiBTdWJjb21tYW5kPGFueT4ge1xuXHRyZXR1cm4ge1xuXHRcdGRlc2NyaXB0aW9uLCB0eXBlOiAnc3ViY29tbWFuZCcsIG9wdGlvbnNcblx0fTtcbn1cblxuc3VpdGUoJ2Zvcm1hdE9wdGlvbnMnLCAoKSA9PiB7XG5cblx0dGVzdCgnVGV4dCBzaG91bGQgZGlzcGxheSBzbWFsbCBjb2x1bW5zIGNvcnJlY3RseScsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0Zm9ybWF0T3B0aW9ucyh7XG5cdFx0XHRcdCdhZGQnOiBvKCdiYXInKVxuXHRcdFx0fSwgODApLFxuXHRcdFx0WycgIC0tYWRkICAgICAgICBiYXInXVxuXHRcdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdGZvcm1hdE9wdGlvbnMoe1xuXHRcdFx0XHQnYWRkJzogbygnYmFyJyksXG5cdFx0XHRcdCd3YWl0JzogbygnYmEnKSxcblx0XHRcdFx0J3RyYWNlJzogbygnYicpXG5cdFx0XHR9LCA4MCksXG5cdFx0XHRbXG5cdFx0XHRcdCcgIC0tYWRkICAgICAgICBiYXInLFxuXHRcdFx0XHQnICAtLXdhaXQgICAgICAgYmEnLFxuXHRcdFx0XHQnICAtLXRyYWNlICAgICAgYidcblx0XHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXh0IHNob3VsZCB3cmFwJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRmb3JtYXRPcHRpb25zKHtcblx0XHRcdFx0J2FkZCc6IG8oKDxhbnk+J2JhciAnKS5yZXBlYXQoOSkpXG5cdFx0XHR9LCA0MCksXG5cdFx0XHRbXG5cdFx0XHRcdCcgIC0tYWRkICAgICAgICBiYXIgYmFyIGJhciBiYXIgYmFyIGJhcicsXG5cdFx0XHRcdCcgICAgICAgICAgICAgICBiYXIgYmFyIGJhcidcblx0XHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXh0IHNob3VsZCByZXZlcnQgdG8gdGhlIGNvbmRlbnNlZCB2aWV3IHdoZW4gdGhlIHRlcm1pbmFsIGlzIHRvbyBuYXJyb3cnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdGZvcm1hdE9wdGlvbnMoe1xuXHRcdFx0XHQnYWRkJzogbygoPGFueT4nYmFyICcpLnJlcGVhdCg5KSlcblx0XHRcdH0sIDMwKSxcblx0XHRcdFtcblx0XHRcdFx0JyAgLS1hZGQnLFxuXHRcdFx0XHQnICAgICAgYmFyIGJhciBiYXIgYmFyIGJhciBiYXIgYmFyIGJhciBiYXIgJ1xuXHRcdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FkZEFyZycsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFkZEFyZyhbXSwgJ2ZvbycpLCBbJ2ZvbyddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFkZEFyZyhbXSwgJ2ZvbycsICdiYXInKSwgWydmb28nLCAnYmFyJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWRkQXJnKFsnZm9vJ10sICdiYXInKSwgWydmb28nLCAnYmFyJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWRkQXJnKFsnLS13YWl0J10sICdiYXInKSwgWyctLXdhaXQnLCAnYmFyJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWRkQXJnKFsnLS13YWl0JywgJy0tJywgJy0tZm9vJ10sICdiYXInKSwgWyctLXdhaXQnLCAnYmFyJywgJy0tJywgJy0tZm9vJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWRkQXJnKFsnLS0nLCAnLS1mb28nXSwgJ2JhcicpLCBbJ2JhcicsICctLScsICctLWZvbyddKTtcblx0fSk7XG5cblx0dGVzdCgnc3ViY29tbWFuZHMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdGZvcm1hdE9wdGlvbnMoe1xuXHRcdFx0XHQndGVzdGNtZCc6IGMoJ0EgdGVzdCBjb21tYW5kJywgeyBhZGQ6IG8oJ0EgdGVzdCBjb21tYW5kIG9wdGlvbicpIH0pXG5cdFx0XHR9LCAzMCksXG5cdFx0XHRbXG5cdFx0XHRcdCcgIC0tdGVzdGNtZCcsXG5cdFx0XHRcdCcgICAgICBBIHRlc3QgY29tbWFuZCdcblx0XHRcdF0pO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuXG5zdWl0ZSgncGFyc2VBcmdzJywgKCkgPT4ge1xuXHRmdW5jdGlvbiBuZXdFcnJvclJlcG9ydGVyKHJlc3VsdDogc3RyaW5nW10gPSBbXSwgY29tbWFuZCA9ICcnKTogRXJyb3JSZXBvcnRlciAmIHsgcmVzdWx0OiBzdHJpbmdbXSB9IHtcblx0XHRjb25zdCBjb21tYW5kUHJlZml4ID0gY29tbWFuZCA/IGNvbW1hbmQgKyAnLScgOiAnJztcblx0XHRyZXR1cm4ge1xuXHRcdFx0b25EZXByZWNhdGVkT3B0aW9uOiAoZGVwcmVjYXRlZElkKSA9PiByZXN1bHQucHVzaChgJHtjb21tYW5kUHJlZml4fW9uRGVwcmVjYXRlZE9wdGlvbiAke2RlcHJlY2F0ZWRJZH1gKSxcblx0XHRcdG9uVW5rbm93bk9wdGlvbjogKGlkKSA9PiByZXN1bHQucHVzaChgJHtjb21tYW5kUHJlZml4fW9uVW5rbm93bk9wdGlvbiAke2lkfWApLFxuXHRcdFx0b25FbXB0eVZhbHVlOiAoaWQpID0+IHJlc3VsdC5wdXNoKGAke2NvbW1hbmRQcmVmaXh9b25FbXB0eVZhbHVlICR7aWR9YCksXG5cdFx0XHRvbk11bHRpcGxlVmFsdWVzOiAoaWQsIHVzZWRWYWx1ZSkgPT4gcmVzdWx0LnB1c2goYCR7Y29tbWFuZFByZWZpeH1vbk11bHRpcGxlVmFsdWVzICR7aWR9ICR7dXNlZFZhbHVlfWApLFxuXHRcdFx0Z2V0U3ViY29tbWFuZFJlcG9ydGVyOiAoYykgPT4gbmV3RXJyb3JSZXBvcnRlcihyZXN1bHQsIGNvbW1hbmRQcmVmaXggKyBjKSxcblx0XHRcdHJlc3VsdFxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBhc3NlcnRQYXJzZTxUPihvcHRpb25zOiBPcHRpb25EZXNjcmlwdGlvbnM8VD4sIGlucHV0OiBzdHJpbmdbXSwgZXhwZWN0ZWQ6IFQsIGV4cGVjdGVkRXJyb3JzOiBzdHJpbmdbXSkge1xuXHRcdGNvbnN0IGVycm9yUmVwb3J0ZXIgPSBuZXdFcnJvclJlcG9ydGVyKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZUFyZ3MoaW5wdXQsIG9wdGlvbnMsIGVycm9yUmVwb3J0ZXIpLCBleHBlY3RlZCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlcnJvclJlcG9ydGVyLnJlc3VsdCwgZXhwZWN0ZWRFcnJvcnMpO1xuXHR9XG5cblx0dGVzdCgnc3ViY29tbWFuZHMnLCAoKSA9PiB7XG5cblx0XHRpbnRlcmZhY2UgVGVzdEFyZ3MxIHtcblx0XHRcdHRlc3RjbWQ/OiB7XG5cdFx0XHRcdHRlc3RBcmc/OiBzdHJpbmc7XG5cdFx0XHRcdF86IHN0cmluZ1tdO1xuXHRcdFx0fTtcblx0XHRcdF86IHN0cmluZ1tdO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9wdGlvbnMxID0ge1xuXHRcdFx0J3Rlc3RjbWQnOiBjKCdBIHRlc3QgY29tbWFuZCcsIHtcblx0XHRcdFx0dGVzdEFyZzogbygnQSB0ZXN0IGNvbW1hbmQgb3B0aW9uJyksXG5cdFx0XHRcdF86IHsgdHlwZTogJ3N0cmluZ1tdJyB9XG5cdFx0XHR9KSxcblx0XHRcdF86IHsgdHlwZTogJ3N0cmluZ1tdJyB9XG5cdFx0fSBhcyBPcHRpb25EZXNjcmlwdGlvbnM8VGVzdEFyZ3MxPjtcblx0XHRhc3NlcnRQYXJzZShcblx0XHRcdG9wdGlvbnMxLFxuXHRcdFx0Wyd0ZXN0Y21kJywgJy0tdGVzdEFyZz1mb28nXSxcblx0XHRcdHsgdGVzdGNtZDogeyB0ZXN0QXJnOiAnZm9vJywgJ18nOiBbXSB9LCAnXyc6IFtdIH0sXG5cdFx0XHRbXVxuXHRcdCk7XG5cdFx0YXNzZXJ0UGFyc2UoXG5cdFx0XHRvcHRpb25zMSxcblx0XHRcdFsndGVzdGNtZCcsICctLXRlc3RBcmc9Zm9vJywgJy0tdGVzdFgnXSxcblx0XHRcdHsgdGVzdGNtZDogeyB0ZXN0QXJnOiAnZm9vJywgJ18nOiBbXSB9LCAnXyc6IFtdIH0sXG5cdFx0XHRbJ3Rlc3RjbWQtb25Vbmtub3duT3B0aW9uIHRlc3RYJ11cblx0XHQpO1xuXG5cdFx0aW50ZXJmYWNlIFRlc3RBcmdzMiB7XG5cdFx0XHR0ZXN0Y21kPzoge1xuXHRcdFx0XHR0ZXN0QXJnPzogc3RyaW5nO1xuXHRcdFx0XHR0ZXN0WD86IGJvb2xlYW47XG5cdFx0XHRcdF86IHN0cmluZ1tdO1xuXHRcdFx0fTtcblx0XHRcdHRlc3RYPzogYm9vbGVhbjtcblx0XHRcdF86IHN0cmluZ1tdO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9wdGlvbnMyID0ge1xuXHRcdFx0J3Rlc3RjbWQnOiBjKCdBIHRlc3QgY29tbWFuZCcsIHtcblx0XHRcdFx0dGVzdEFyZzogbygnQSB0ZXN0IGNvbW1hbmQgb3B0aW9uJylcblx0XHRcdH0pLFxuXHRcdFx0dGVzdFg6IHsgdHlwZTogJ2Jvb2xlYW4nLCBnbG9iYWw6IHRydWUsIGRlc2NyaXB0aW9uOiAnJyB9LFxuXHRcdFx0XzogeyB0eXBlOiAnc3RyaW5nW10nIH1cblx0XHR9IGFzIE9wdGlvbkRlc2NyaXB0aW9uczxUZXN0QXJnczI+O1xuXHRcdGFzc2VydFBhcnNlKFxuXHRcdFx0b3B0aW9uczIsXG5cdFx0XHRbJ3Rlc3RjbWQnLCAnLS10ZXN0QXJnPWZvbycsICctLXRlc3RYJ10sXG5cdFx0XHR7IHRlc3RjbWQ6IHsgdGVzdEFyZzogJ2ZvbycsIHRlc3RYOiB0cnVlLCAnXyc6IFtdIH0sICdfJzogW10gfSxcblx0XHRcdFtdXG5cdFx0KTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJd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
