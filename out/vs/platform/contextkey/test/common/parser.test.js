import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Parser } from "../../common/contextkey.js";
function parseToStr(input) {
  const parser = new Parser();
  const prints = [];
  const print = (...ss) => {
    ss.forEach((s) => prints.push(s));
  };
  const expr = parser.parse(input);
  if (expr === void 0) {
    if (parser.lexingErrors.length > 0) {
      print("Lexing errors:", "\n\n");
      parser.lexingErrors.forEach((lexingError) => print(`Unexpected token '${lexingError.lexeme}' at offset ${lexingError.offset}. ${lexingError.additionalInfo}`, "\n"));
    }
    if (parser.parsingErrors.length > 0) {
      if (parser.lexingErrors.length > 0) {
        print("\n --- \n");
      }
      print("Parsing errors:", "\n\n");
      parser.parsingErrors.forEach((parsingError) => print(`Unexpected '${parsingError.lexeme}' at offset ${parsingError.offset}.`, "\n"));
    }
  } else {
    print(expr.serialize());
  }
  return prints.join("");
}
suite("Context Key Parser", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test(" foo", () => {
    const input = " foo";
    assert.deepStrictEqual(parseToStr(input), "foo");
  });
  test("!foo", () => {
    const input = "!foo";
    assert.deepStrictEqual(parseToStr(input), "!foo");
  });
  test("foo =~ /bar/", () => {
    const input = "foo =~ /bar/";
    assert.deepStrictEqual(parseToStr(input), "foo =~ /bar/");
  });
  test(`foo || (foo =~ /bar/ && baz)`, () => {
    const input = `foo || (foo =~ /bar/ && baz)`;
    assert.deepStrictEqual(parseToStr(input), "foo || baz && foo =~ /bar/");
  });
  test("foo || (foo =~ /bar/ || baz)", () => {
    const input = "foo || (foo =~ /bar/ || baz)";
    assert.deepStrictEqual(parseToStr(input), "baz || foo || foo =~ /bar/");
  });
  test(`(foo || bar) && (jee || jar)`, () => {
    const input = `(foo || bar) && (jee || jar)`;
    assert.deepStrictEqual(parseToStr(input), "bar && jar || bar && jee || foo && jar || foo && jee");
  });
  test("foo && foo =~ /zee/i", () => {
    const input = "foo && foo =~ /zee/i";
    assert.deepStrictEqual(parseToStr(input), "foo && foo =~ /zee/i");
  });
  test("foo.bar==enabled", () => {
    const input = "foo.bar==enabled";
    assert.deepStrictEqual(parseToStr(input), "foo.bar == 'enabled'");
  });
  test(`foo.bar == 'enabled'`, () => {
    const input = `foo.bar == 'enabled'`;
    assert.deepStrictEqual(parseToStr(input), `foo.bar == 'enabled'`);
  });
  test("foo.bar:zed==completed - equality with no space", () => {
    const input = "foo.bar:zed==completed";
    assert.deepStrictEqual(parseToStr(input), "foo.bar:zed == 'completed'");
  });
  test("a && b || c", () => {
    const input = "a && b || c";
    assert.deepStrictEqual(parseToStr(input), "c || a && b");
  });
  test("fooBar && baz.jar && fee.bee<K-loo+1>", () => {
    const input = "fooBar && baz.jar && fee.bee<K-loo+1>";
    assert.deepStrictEqual(parseToStr(input), "baz.jar && fee.bee<K-loo+1> && fooBar");
  });
  test("foo.barBaz<C-r> < 2", () => {
    const input = "foo.barBaz<C-r> < 2";
    assert.deepStrictEqual(parseToStr(input), `foo.barBaz<C-r> < 2`);
  });
  test("foo.bar >= -1", () => {
    const input = "foo.bar >= -1";
    assert.deepStrictEqual(parseToStr(input), "foo.bar >= -1");
  });
  test(`key contains &nbsp: view == vsc-packages-activitybar-folders\xA0&& vsc-packages-folders-loaded`, () => {
    const input = `view == vsc-packages-activitybar-folders\xA0&& vsc-packages-folders-loaded`;
    assert.deepStrictEqual(parseToStr(input), "vsc-packages-folders-loaded && view == 'vsc-packages-activitybar-folders'");
  });
  test("foo.bar <= -1", () => {
    const input = "foo.bar <= -1";
    assert.deepStrictEqual(parseToStr(input), `foo.bar <= -1`);
  });
  test("!cmake:hideBuildCommand && cmake:enableFullFeatureSet", () => {
    const input = "!cmake:hideBuildCommand && cmake:enableFullFeatureSet";
    assert.deepStrictEqual(parseToStr(input), "cmake:enableFullFeatureSet && !cmake:hideBuildCommand");
  });
  test("!(foo && bar)", () => {
    const input = "!(foo && bar)";
    assert.deepStrictEqual(parseToStr(input), "!bar || !foo");
  });
  test("!(foo && bar || boar) || deer", () => {
    const input = "!(foo && bar || boar) || deer";
    assert.deepStrictEqual(parseToStr(input), "deer || !bar && !boar || !boar && !foo");
  });
  test(`!(!foo)`, () => {
    const input = `!(!foo)`;
    assert.deepStrictEqual(parseToStr(input), "foo");
  });
  suite("controversial", () => {
    test(`debugState == "stopped"`, () => {
      const input = `debugState == "stopped"`;
      assert.deepStrictEqual(parseToStr(input), `debugState == '"stopped"'`);
    });
    test(` viewItem == VSCode WorkSpace`, () => {
      const input = ` viewItem == VSCode WorkSpace`;
      assert.deepStrictEqual(parseToStr(input), "Parsing errors:\n\nUnexpected 'WorkSpace' at offset 20.\n");
    });
  });
  suite("regex", () => {
    test(`resource =~ //foo/(barr|door/(Foo-Bar%20Templates|Soo%20Looo)|Web%20Site%Jjj%20Llll)(/.*)*$/`, () => {
      const input = `resource =~ //foo/(barr|door/(Foo-Bar%20Templates|Soo%20Looo)|Web%20Site%Jjj%20Llll)(/.*)*$/`;
      assert.deepStrictEqual(parseToStr(input), "resource =~ /\\/foo\\/(barr|door\\/(Foo-Bar%20Templates|Soo%20Looo)|Web%20Site%Jjj%20Llll)(\\/.*)*$/");
    });
    test(`resource =~ /((/scratch/(?!update)(.*)/)|((/src/).*/)).*$/`, () => {
      const input = `resource =~ /((/scratch/(?!update)(.*)/)|((/src/).*/)).*$/`;
      assert.deepStrictEqual(parseToStr(input), "resource =~ /((\\/scratch\\/(?!update)(.*)\\/)|((\\/src\\/).*\\/)).*$/");
    });
    test(`resourcePath =~ /.md(.yml|.txt)*$/giym`, () => {
      const input = `resourcePath =~ /.md(.yml|.txt)*$/giym`;
      assert.deepStrictEqual(parseToStr(input), "resourcePath =~ /.md(.yml|.txt)*$/im");
    });
  });
  suite("error handling", () => {
    test(`/foo`, () => {
      const input = `/foo`;
      assert.deepStrictEqual(parseToStr(input), "Lexing errors:\n\nUnexpected token '/foo' at offset 0. Did you forget to escape the '/' (slash) character? Put two backslashes before it to escape, e.g., '\\\\/'.\n\n --- \nParsing errors:\n\nUnexpected '/foo' at offset 0.\n");
    });
    test(`!b == 'true'`, () => {
      const input = `!b == 'true'`;
      assert.deepStrictEqual(parseToStr(input), "Parsing errors:\n\nUnexpected '==' at offset 3.\n");
    });
    test("!foo &&  in bar", () => {
      const input = "!foo &&  in bar";
      assert.deepStrictEqual(parseToStr(input), "Parsing errors:\n\nUnexpected 'in' at offset 9.\n");
    });
    test("vim<c-r> == 1 && vim<2<=3", () => {
      const input = "vim<c-r> == 1 && vim<2<=3";
      assert.deepStrictEqual(parseToStr(input), "Lexing errors:\n\nUnexpected token '=' at offset 23. Did you mean == or =~?\n\n --- \nParsing errors:\n\nUnexpected '=' at offset 23.\n");
    });
    test(`foo && 'bar`, () => {
      const input = `foo && 'bar`;
      assert.deepStrictEqual(parseToStr(input), "Lexing errors:\n\nUnexpected token ''bar' at offset 7. Did you forget to open or close the quote?\n\n --- \nParsing errors:\n\nUnexpected ''bar' at offset 7.\n");
    });
    test(`config.foo &&  &&bar =~ /^foo$|^bar-foo$|^joo$|^jar$/ && !foo`, () => {
      const input = `config.foo &&  &&bar =~ /^foo$|^bar-foo$|^joo$|^jar$/ && !foo`;
      assert.deepStrictEqual(parseToStr(input), "Parsing errors:\n\nUnexpected '&&' at offset 15.\n");
    });
    test(`!foo == 'test'`, () => {
      const input = `!foo == 'test'`;
      assert.deepStrictEqual(parseToStr(input), "Parsing errors:\n\nUnexpected '==' at offset 5.\n");
    });
    test(`!!foo`, function() {
      const input = `!!foo`;
      assert.deepStrictEqual(parseToStr(input), "Parsing errors:\n\nUnexpected '!' at offset 1.\n");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9jb250ZXh0a2V5L3Rlc3QvY29tbW9uL3BhcnNlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgUGFyc2VyIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbnRleHRrZXkuanMnO1xuXG5mdW5jdGlvbiBwYXJzZVRvU3RyKGlucHV0OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRjb25zdCBwYXJzZXIgPSBuZXcgUGFyc2VyKCk7XG5cblx0Y29uc3QgcHJpbnRzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdGNvbnN0IHByaW50ID0gKC4uLnNzOiBzdHJpbmdbXSkgPT4geyBzcy5mb3JFYWNoKHMgPT4gcHJpbnRzLnB1c2gocykpOyB9O1xuXG5cdGNvbnN0IGV4cHIgPSBwYXJzZXIucGFyc2UoaW5wdXQpO1xuXHRpZiAoZXhwciA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHBhcnNlci5sZXhpbmdFcnJvcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0cHJpbnQoJ0xleGluZyBlcnJvcnM6JywgJ1xcblxcbicpO1xuXHRcdFx0cGFyc2VyLmxleGluZ0Vycm9ycy5mb3JFYWNoKGxleGluZ0Vycm9yID0+IHByaW50KGBVbmV4cGVjdGVkIHRva2VuICcke2xleGluZ0Vycm9yLmxleGVtZX0nIGF0IG9mZnNldCAke2xleGluZ0Vycm9yLm9mZnNldH0uICR7bGV4aW5nRXJyb3IuYWRkaXRpb25hbEluZm99YCwgJ1xcbicpKTtcblx0XHR9XG5cblx0XHRpZiAocGFyc2VyLnBhcnNpbmdFcnJvcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0aWYgKHBhcnNlci5sZXhpbmdFcnJvcnMubGVuZ3RoID4gMCkgeyBwcmludCgnXFxuIC0tLSBcXG4nKTsgfVxuXHRcdFx0cHJpbnQoJ1BhcnNpbmcgZXJyb3JzOicsICdcXG5cXG4nKTtcblx0XHRcdHBhcnNlci5wYXJzaW5nRXJyb3JzLmZvckVhY2gocGFyc2luZ0Vycm9yID0+IHByaW50KGBVbmV4cGVjdGVkICcke3BhcnNpbmdFcnJvci5sZXhlbWV9JyBhdCBvZmZzZXQgJHtwYXJzaW5nRXJyb3Iub2Zmc2V0fS5gLCAnXFxuJykpO1xuXHRcdH1cblxuXHR9IGVsc2Uge1xuXHRcdHByaW50KGV4cHIuc2VyaWFsaXplKCkpO1xuXHR9XG5cblx0cmV0dXJuIHByaW50cy5qb2luKCcnKTtcbn1cblxuc3VpdGUoJ0NvbnRleHQgS2V5IFBhcnNlcicsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCcgZm9vJywgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gJyBmb28nO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwiZm9vXCIpO1xuXHR9KTtcblxuXHR0ZXN0KCchZm9vJywgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gJyFmb28nO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwiIWZvb1wiKTtcblx0fSk7XG5cblx0dGVzdCgnZm9vID1+IC9iYXIvJywgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gJ2ZvbyA9fiAvYmFyLyc7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZVRvU3RyKGlucHV0KSwgXCJmb28gPX4gL2Jhci9cIik7XG5cdH0pO1xuXG5cdHRlc3QoYGZvbyB8fCAoZm9vID1+IC9iYXIvICYmIGJheilgLCAoKSA9PiB7XG5cdFx0Y29uc3QgaW5wdXQgPSBgZm9vIHx8IChmb28gPX4gL2Jhci8gJiYgYmF6KWA7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZVRvU3RyKGlucHV0KSwgXCJmb28gfHwgYmF6ICYmIGZvbyA9fiAvYmFyL1wiKTtcblx0fSk7XG5cblx0dGVzdCgnZm9vIHx8IChmb28gPX4gL2Jhci8gfHwgYmF6KScsICgpID0+IHtcblx0XHRjb25zdCBpbnB1dCA9ICdmb28gfHwgKGZvbyA9fiAvYmFyLyB8fCBiYXopJztcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhcnNlVG9TdHIoaW5wdXQpLCBcImJheiB8fCBmb28gfHwgZm9vID1+IC9iYXIvXCIpO1xuXHR9KTtcblxuXHR0ZXN0KGAoZm9vIHx8IGJhcikgJiYgKGplZSB8fCBqYXIpYCwgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gYChmb28gfHwgYmFyKSAmJiAoamVlIHx8IGphcilgO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwiYmFyICYmIGphciB8fCBiYXIgJiYgamVlIHx8IGZvbyAmJiBqYXIgfHwgZm9vICYmIGplZVwiKTtcblx0fSk7XG5cblx0dGVzdCgnZm9vICYmIGZvbyA9fiAvemVlL2knLCAoKSA9PiB7XG5cdFx0Y29uc3QgaW5wdXQgPSAnZm9vICYmIGZvbyA9fiAvemVlL2knO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwiZm9vICYmIGZvbyA9fiAvemVlL2lcIik7XG5cdH0pO1xuXG5cdHRlc3QoJ2Zvby5iYXI9PWVuYWJsZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgaW5wdXQgPSAnZm9vLmJhcj09ZW5hYmxlZCc7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZVRvU3RyKGlucHV0KSwgXCJmb28uYmFyID09ICdlbmFibGVkJ1wiKTtcblx0fSk7XG5cblx0dGVzdChgZm9vLmJhciA9PSAnZW5hYmxlZCdgLCAoKSA9PiB7XG5cdFx0Y29uc3QgaW5wdXQgPSBgZm9vLmJhciA9PSAnZW5hYmxlZCdgO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIGBmb28uYmFyID09ICdlbmFibGVkJ2ApO1xuXHR9KTtcblxuXHR0ZXN0KCdmb28uYmFyOnplZD09Y29tcGxldGVkIC0gZXF1YWxpdHkgd2l0aCBubyBzcGFjZScsICgpID0+IHtcblx0XHRjb25zdCBpbnB1dCA9ICdmb28uYmFyOnplZD09Y29tcGxldGVkJztcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhcnNlVG9TdHIoaW5wdXQpLCBcImZvby5iYXI6emVkID09ICdjb21wbGV0ZWQnXCIpO1xuXHR9KTtcblxuXHR0ZXN0KCdhICYmIGIgfHwgYycsICgpID0+IHtcblx0XHRjb25zdCBpbnB1dCA9ICdhICYmIGIgfHwgYyc7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZVRvU3RyKGlucHV0KSwgXCJjIHx8IGEgJiYgYlwiKTtcblx0fSk7XG5cblx0dGVzdCgnZm9vQmFyICYmIGJhei5qYXIgJiYgZmVlLmJlZTxLLWxvbysxPicsICgpID0+IHtcblx0XHRjb25zdCBpbnB1dCA9ICdmb29CYXIgJiYgYmF6LmphciAmJiBmZWUuYmVlPEstbG9vKzE+Jztcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhcnNlVG9TdHIoaW5wdXQpLCBcImJhei5qYXIgJiYgZmVlLmJlZTxLLWxvbysxPiAmJiBmb29CYXJcIik7XG5cdH0pO1xuXG5cdHRlc3QoJ2Zvby5iYXJCYXo8Qy1yPiA8IDInLCAoKSA9PiB7XG5cdFx0Y29uc3QgaW5wdXQgPSAnZm9vLmJhckJhejxDLXI+IDwgMic7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZVRvU3RyKGlucHV0KSwgYGZvby5iYXJCYXo8Qy1yPiA8IDJgKTtcblx0fSk7XG5cblx0dGVzdCgnZm9vLmJhciA+PSAtMScsICgpID0+IHtcblx0XHRjb25zdCBpbnB1dCA9ICdmb28uYmFyID49IC0xJztcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhcnNlVG9TdHIoaW5wdXQpLCBcImZvby5iYXIgPj0gLTFcIik7XG5cdH0pO1xuXG5cdHRlc3QoYGtleSBjb250YWlucyAmbmJzcDogdmlldyA9PSB2c2MtcGFja2FnZXMtYWN0aXZpdHliYXItZm9sZGVyc1x1MDBBMCYmIHZzYy1wYWNrYWdlcy1mb2xkZXJzLWxvYWRlZGAsICgpID0+IHtcblx0XHRjb25zdCBpbnB1dCA9IGB2aWV3ID09IHZzYy1wYWNrYWdlcy1hY3Rpdml0eWJhci1mb2xkZXJzXHUwMEEwJiYgdnNjLXBhY2thZ2VzLWZvbGRlcnMtbG9hZGVkYDtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhcnNlVG9TdHIoaW5wdXQpLCBcInZzYy1wYWNrYWdlcy1mb2xkZXJzLWxvYWRlZCAmJiB2aWV3ID09ICd2c2MtcGFja2FnZXMtYWN0aXZpdHliYXItZm9sZGVycydcIik7XG5cdH0pO1xuXG5cdHRlc3QoJ2Zvby5iYXIgPD0gLTEnLCAoKSA9PiB7XG5cdFx0Y29uc3QgaW5wdXQgPSAnZm9vLmJhciA8PSAtMSc7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZVRvU3RyKGlucHV0KSwgYGZvby5iYXIgPD0gLTFgKTtcblx0fSk7XG5cblx0dGVzdCgnIWNtYWtlOmhpZGVCdWlsZENvbW1hbmQgXFx1MDAyNlxcdTAwMjYgY21ha2U6ZW5hYmxlRnVsbEZlYXR1cmVTZXQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgaW5wdXQgPSAnIWNtYWtlOmhpZGVCdWlsZENvbW1hbmQgXFx1MDAyNlxcdTAwMjYgY21ha2U6ZW5hYmxlRnVsbEZlYXR1cmVTZXQnO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwiY21ha2U6ZW5hYmxlRnVsbEZlYXR1cmVTZXQgJiYgIWNtYWtlOmhpZGVCdWlsZENvbW1hbmRcIik7XG5cdH0pO1xuXG5cdHRlc3QoJyEoZm9vICYmIGJhciknLCAoKSA9PiB7XG5cdFx0Y29uc3QgaW5wdXQgPSAnIShmb28gJiYgYmFyKSc7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZVRvU3RyKGlucHV0KSwgXCIhYmFyIHx8ICFmb29cIik7XG5cdH0pO1xuXG5cdHRlc3QoJyEoZm9vICYmIGJhciB8fCBib2FyKSB8fCBkZWVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gJyEoZm9vICYmIGJhciB8fCBib2FyKSB8fCBkZWVyJztcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhcnNlVG9TdHIoaW5wdXQpLCBcImRlZXIgfHwgIWJhciAmJiAhYm9hciB8fCAhYm9hciAmJiAhZm9vXCIpO1xuXHR9KTtcblxuXHR0ZXN0KGAhKCFmb28pYCwgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gYCEoIWZvbylgO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwiZm9vXCIpO1xuXHR9KTtcblxuXHRzdWl0ZSgnY29udHJvdmVyc2lhbCcsICgpID0+IHtcblx0XHQvKlxuXHRcdFx0bmV3IHBhcnNlciBLRUVQUyBvbGQgb25lJ3MgYmVoYXZpb3I6XG5cblx0XHRcdG9sZCBwYXJzZXIgb3V0cHV0OiB7IGtleTogJ2RlYnVnU3RhdGUnLCBvcDogJz09JywgdmFsdWU6ICdcInN0b3BwZWRcIicgfVxuXHRcdFx0bmV3IHBhcnNlciBvdXRwdXQ6IHsga2V5OiAnZGVidWdTdGF0ZScsIG9wOiAnPT0nLCB2YWx1ZTogJ1wic3RvcHBlZFwiJyB9XG5cblx0XHRcdFRPRE9AdWx1Z2Jla25hOiB3ZSBzaG91bGQgY29uc2lkZXIgYnJlYWtpbmcgb2xkIHBhcnNlcidzIGJlaGF2aW9yLCBhbmQgbm90IHRha2UgZG91YmxlIHF1b3RlcyBhcyBwYXJ0IG9mIHRoZSBgdmFsdWVgIGJlY2F1c2UgdGhhdCdzIG5vdCB3aGF0IHVzZXIgZXhwZWN0cy5cblx0XHQqL1xuXHRcdHRlc3QoYGRlYnVnU3RhdGUgPT0gXCJzdG9wcGVkXCJgLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBpbnB1dCA9IGBkZWJ1Z1N0YXRlID09IFwic3RvcHBlZFwiYDtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwiZGVidWdTdGF0ZSA9PSAnXFxcInN0b3BwZWRcXFwiJ1wiKTtcblx0XHR9KTtcblxuXHRcdC8qXG5cdFx0XHRuZXcgcGFyc2VyIEJSRUFLUyBvbGQgb25lJ3MgYmVoYXZpb3I6XG5cblx0XHRcdG9sZCBwYXJzZXIgb3V0cHV0OiB7IGtleTogJ3ZpZXdJdGVtJywgb3A6ICc9PScsIHZhbHVlOiAnVlNDb2RlIFdvcmtTcGFjZScgfVxuXHRcdFx0bmV3IHBhcnNlciBvdXRwdXQ6IHsga2V5OiAndmlld0l0ZW0nLCBvcDogJz09JywgdmFsdWU6ICdWU0NvZGUnIH1cblxuXHRcdFx0VE9ET0B1bHVnYmVrbmE6IHNpbmNlIHRoaXMncyBicmVha2luZywgd2UgY2FuIGhhdmUgaGFja3kgY29kZSB0aGF0IHRyaWVzIGRldGVjdGluZyBzdWNoIGNhc2VzIGFuZCByZXBsaWNhdGUgb2xkIHBhcnNlcidzIGJlaGF2aW9yLlxuXHRcdCovXG5cdFx0dGVzdChgIHZpZXdJdGVtID09IFZTQ29kZSBXb3JrU3BhY2VgLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBpbnB1dCA9IGAgdmlld0l0ZW0gPT0gVlNDb2RlIFdvcmtTcGFjZWA7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhcnNlVG9TdHIoaW5wdXQpLCBcIlBhcnNpbmcgZXJyb3JzOlxcblxcblVuZXhwZWN0ZWQgJ1dvcmtTcGFjZScgYXQgb2Zmc2V0IDIwLlxcblwiKTtcblx0XHR9KTtcblxuXG5cdH0pO1xuXG5cdHN1aXRlKCdyZWdleCcsICgpID0+IHtcblxuXHRcdHRlc3QoYHJlc291cmNlID1+IC8vZm9vLyhiYXJyfGRvb3IvKEZvby1CYXIlMjBUZW1wbGF0ZXN8U29vJTIwTG9vbyl8V2ViJTIwU2l0ZSVKamolMjBMbGxsKSgvLiopKiQvYCwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBgcmVzb3VyY2UgPX4gLy9mb28vKGJhcnJ8ZG9vci8oRm9vLUJhciUyMFRlbXBsYXRlc3xTb28lMjBMb29vKXxXZWIlMjBTaXRlJUpqaiUyMExsbGwpKC8uKikqJC9gO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZVRvU3RyKGlucHV0KSwgXCJyZXNvdXJjZSA9fiAvXFxcXC9mb29cXFxcLyhiYXJyfGRvb3JcXFxcLyhGb28tQmFyJTIwVGVtcGxhdGVzfFNvbyUyMExvb28pfFdlYiUyMFNpdGUlSmpqJTIwTGxsbCkoXFxcXC8uKikqJC9cIik7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KGByZXNvdXJjZSA9fiAvKCgvc2NyYXRjaC8oPyF1cGRhdGUpKC4qKS8pfCgoL3NyYy8pLiovKSkuKiQvYCwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBgcmVzb3VyY2UgPX4gLygoL3NjcmF0Y2gvKD8hdXBkYXRlKSguKikvKXwoKC9zcmMvKS4qLykpLiokL2A7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhcnNlVG9TdHIoaW5wdXQpLCBcInJlc291cmNlID1+IC8oKFxcXFwvc2NyYXRjaFxcXFwvKD8hdXBkYXRlKSguKilcXFxcLyl8KChcXFxcL3NyY1xcXFwvKS4qXFxcXC8pKS4qJC9cIik7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KGByZXNvdXJjZVBhdGggPX4gL1xcLm1kKFxcLnltbHxcXC50eHQpKiQvZ2l5bWAsICgpID0+IHtcblx0XHRcdGNvbnN0IGlucHV0ID0gYHJlc291cmNlUGF0aCA9fiAvXFwubWQoXFwueW1sfFxcLnR4dCkqJC9naXltYDtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwicmVzb3VyY2VQYXRoID1+IC8ubWQoLnltbHwudHh0KSokL2ltXCIpO1xuXHRcdH0pO1xuXG5cdH0pO1xuXG5cdHN1aXRlKCdlcnJvciBoYW5kbGluZycsICgpID0+IHtcblxuXHRcdHRlc3QoYC9mb29gLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBpbnB1dCA9IGAvZm9vYDtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwiTGV4aW5nIGVycm9yczpcXG5cXG5VbmV4cGVjdGVkIHRva2VuICcvZm9vJyBhdCBvZmZzZXQgMC4gRGlkIHlvdSBmb3JnZXQgdG8gZXNjYXBlIHRoZSAnLycgKHNsYXNoKSBjaGFyYWN0ZXI/IFB1dCB0d28gYmFja3NsYXNoZXMgYmVmb3JlIGl0IHRvIGVzY2FwZSwgZS5nLiwgJ1xcXFxcXFxcLycuXFxuXFxuIC0tLSBcXG5QYXJzaW5nIGVycm9yczpcXG5cXG5VbmV4cGVjdGVkICcvZm9vJyBhdCBvZmZzZXQgMC5cXG5cIik7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KGAhYiA9PSAndHJ1ZSdgLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBpbnB1dCA9IGAhYiA9PSAndHJ1ZSdgO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZVRvU3RyKGlucHV0KSwgXCJQYXJzaW5nIGVycm9yczpcXG5cXG5VbmV4cGVjdGVkICc9PScgYXQgb2Zmc2V0IDMuXFxuXCIpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnIWZvbyAmJiAgaW4gYmFyJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaW5wdXQgPSAnIWZvbyAmJiAgaW4gYmFyJztcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwiUGFyc2luZyBlcnJvcnM6XFxuXFxuVW5leHBlY3RlZCAnaW4nIGF0IG9mZnNldCA5LlxcblwiKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3ZpbTxjLXI+ID09IDEgJiYgdmltPDI8PTMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBpbnB1dCA9ICd2aW08Yy1yPiA9PSAxICYmIHZpbTwyPD0zJztcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwiTGV4aW5nIGVycm9yczpcXG5cXG5VbmV4cGVjdGVkIHRva2VuICc9JyBhdCBvZmZzZXQgMjMuIERpZCB5b3UgbWVhbiA9PSBvciA9fj9cXG5cXG4gLS0tIFxcblBhcnNpbmcgZXJyb3JzOlxcblxcblVuZXhwZWN0ZWQgJz0nIGF0IG9mZnNldCAyMy5cXG5cIik7IC8vIEZJWE1FXG5cdFx0fSk7XG5cblx0XHR0ZXN0KGBmb28gJiYgJ2JhcmAsICgpID0+IHtcblx0XHRcdGNvbnN0IGlucHV0ID0gYGZvbyAmJiAnYmFyYDtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwiTGV4aW5nIGVycm9yczpcXG5cXG5VbmV4cGVjdGVkIHRva2VuICcnYmFyJyBhdCBvZmZzZXQgNy4gRGlkIHlvdSBmb3JnZXQgdG8gb3BlbiBvciBjbG9zZSB0aGUgcXVvdGU/XFxuXFxuIC0tLSBcXG5QYXJzaW5nIGVycm9yczpcXG5cXG5VbmV4cGVjdGVkICcnYmFyJyBhdCBvZmZzZXQgNy5cXG5cIik7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KGBjb25maWcuZm9vICYmICAmJmJhciA9fiAvXmZvbyR8XmJhci1mb28kfF5qb28kfF5qYXIkLyAmJiAhZm9vYCwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBgY29uZmlnLmZvbyAmJiAgJiZiYXIgPX4gL15mb28kfF5iYXItZm9vJHxeam9vJHxeamFyJC8gJiYgIWZvb2A7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhcnNlVG9TdHIoaW5wdXQpLCBcIlBhcnNpbmcgZXJyb3JzOlxcblxcblVuZXhwZWN0ZWQgJyYmJyBhdCBvZmZzZXQgMTUuXFxuXCIpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdChgIWZvbyA9PSAndGVzdCdgLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBpbnB1dCA9IGAhZm9vID09ICd0ZXN0J2A7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhcnNlVG9TdHIoaW5wdXQpLCBcIlBhcnNpbmcgZXJyb3JzOlxcblxcblVuZXhwZWN0ZWQgJz09JyBhdCBvZmZzZXQgNS5cXG5cIik7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KGAhIWZvb2AsIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IGlucHV0ID0gYCEhZm9vYDtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VUb1N0cihpbnB1dCksIFwiUGFyc2luZyBlcnJvcnM6XFxuXFxuVW5leHBlY3RlZCAnIScgYXQgb2Zmc2V0IDEuXFxuXCIpO1xuXHRcdH0pO1xuXG5cdH0pO1xuXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLE9BQU8sWUFBWTtBQUNuQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLGNBQWM7QUFFdkIsU0FBUyxXQUFXLE9BQXVCO0FBQzFDLFFBQU0sU0FBUyxJQUFJLE9BQU87QUFFMUIsUUFBTSxTQUFtQixDQUFDO0FBRTFCLFFBQU0sUUFBUSxJQUFJLE9BQWlCO0FBQUUsT0FBRyxRQUFRLE9BQUssT0FBTyxLQUFLLENBQUMsQ0FBQztBQUFBLEVBQUc7QUFFdEUsUUFBTSxPQUFPLE9BQU8sTUFBTSxLQUFLO0FBQy9CLE1BQUksU0FBUyxRQUFXO0FBQ3ZCLFFBQUksT0FBTyxhQUFhLFNBQVMsR0FBRztBQUNuQyxZQUFNLGtCQUFrQixNQUFNO0FBQzlCLGFBQU8sYUFBYSxRQUFRLGlCQUFlLE1BQU0scUJBQXFCLFlB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
