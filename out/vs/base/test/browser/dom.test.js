import assert from "assert";
import { $, h, multibyteAwareBtoa, trackAttributes, copyAttributes, disposableWindowInterval, getWindows, getWindowsCount, getWindowId, getWindowById, hasWindow, getWindow, getDocument, isHTMLElement, SafeTriangle } from "../../browser/dom.js";
import { asCssValueWithDefault } from "../../../base/browser/cssValue.js";
import { ensureCodeWindow, isAuxiliaryWindow, mainWindow } from "../../browser/window.js";
import { DeferredPromise, timeout } from "../../common/async.js";
import { runWithFakedTimers } from "../common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../common/utils.js";
suite("dom", () => {
  test("hasClass", () => {
    const element = document.createElement("div");
    element.className = "foobar boo far";
    assert(element.classList.contains("foobar"));
    assert(element.classList.contains("boo"));
    assert(element.classList.contains("far"));
    assert(!element.classList.contains("bar"));
    assert(!element.classList.contains("foo"));
    assert(!element.classList.contains(""));
  });
  test("removeClass", () => {
    let element = document.createElement("div");
    element.className = "foobar boo far";
    element.classList.remove("boo");
    assert(element.classList.contains("far"));
    assert(!element.classList.contains("boo"));
    assert(element.classList.contains("foobar"));
    assert.strictEqual(element.className, "foobar far");
    element = document.createElement("div");
    element.className = "foobar boo far";
    element.classList.remove("far");
    assert(!element.classList.contains("far"));
    assert(element.classList.contains("boo"));
    assert(element.classList.contains("foobar"));
    assert.strictEqual(element.className, "foobar boo");
    element.classList.remove("boo");
    assert(!element.classList.contains("far"));
    assert(!element.classList.contains("boo"));
    assert(element.classList.contains("foobar"));
    assert.strictEqual(element.className, "foobar");
    element.classList.remove("foobar");
    assert(!element.classList.contains("far"));
    assert(!element.classList.contains("boo"));
    assert(!element.classList.contains("foobar"));
    assert.strictEqual(element.className, "");
  });
  test("removeClass should consider hyphens", function() {
    const element = document.createElement("div");
    element.classList.add("foo-bar");
    element.classList.add("bar");
    assert(element.classList.contains("foo-bar"));
    assert(element.classList.contains("bar"));
    element.classList.remove("bar");
    assert(element.classList.contains("foo-bar"));
    assert(!element.classList.contains("bar"));
    element.classList.remove("foo-bar");
    assert(!element.classList.contains("foo-bar"));
    assert(!element.classList.contains("bar"));
  });
  test("multibyteAwareBtoa", () => {
    assert.ok(multibyteAwareBtoa("hello world").length > 0);
    assert.ok(multibyteAwareBtoa("\u5E73\u4EEE\u540D").length > 0);
    assert.ok(multibyteAwareBtoa(new Array(1e5).fill("vs").join("")).length > 0);
  });
  suite("$", () => {
    test("should build simple nodes", () => {
      const div = $("div");
      assert(div);
      assert(isHTMLElement(div));
      assert.strictEqual(div.tagName, "DIV");
      assert(!div.firstChild);
    });
    test("should build nodes with id", () => {
      const div = $("div#foo");
      assert(div);
      assert(isHTMLElement(div));
      assert.strictEqual(div.tagName, "DIV");
      assert.strictEqual(div.id, "foo");
    });
    test("should build nodes with class-name", () => {
      const div = $("div.foo");
      assert(div);
      assert(isHTMLElement(div));
      assert.strictEqual(div.tagName, "DIV");
      assert.strictEqual(div.className, "foo");
    });
    test("should build nodes with attributes", () => {
      let div = $("div", { class: "test" });
      assert.strictEqual(div.className, "test");
      div = $("div", void 0);
      assert.strictEqual(div.className, "");
    });
    test("should build nodes with children", () => {
      let div = $("div", void 0, $("span", { id: "demospan" }));
      const firstChild = div.firstChild;
      assert.strictEqual(firstChild.tagName, "SPAN");
      assert.strictEqual(firstChild.id, "demospan");
      div = $("div", void 0, "hello");
      assert.strictEqual(div.firstChild && div.firstChild.textContent, "hello");
    });
    test("should build nodes with text children", () => {
      const div = $("div", void 0, "foobar");
      const firstChild = div.firstChild;
      assert.strictEqual(firstChild.tagName, void 0);
      assert.strictEqual(firstChild.textContent, "foobar");
    });
  });
  suite("h", () => {
    test("should build simple nodes", () => {
      const div = h("div");
      assert(isHTMLElement(div.root));
      assert.strictEqual(div.root.tagName, "DIV");
      const span = h("span");
      assert(isHTMLElement(span.root));
      assert.strictEqual(span.root.tagName, "SPAN");
      const img = h("img");
      assert(isHTMLElement(img.root));
      assert.strictEqual(img.root.tagName, "IMG");
    });
    test("should handle ids and classes", () => {
      const divId = h("div#myid");
      assert.strictEqual(divId.root.tagName, "DIV");
      assert.strictEqual(divId.root.id, "myid");
      const divClass = h("div.a");
      assert.strictEqual(divClass.root.tagName, "DIV");
      assert.strictEqual(divClass.root.classList.length, 1);
      assert(divClass.root.classList.contains("a"));
      const divClasses = h("div.a.b.c");
      assert.strictEqual(divClasses.root.tagName, "DIV");
      assert.strictEqual(divClasses.root.classList.length, 3);
      assert(divClasses.root.classList.contains("a"));
      assert(divClasses.root.classList.contains("b"));
      assert(divClasses.root.classList.contains("c"));
      const divAll = h("div#myid.a.b.c");
      assert.strictEqual(divAll.root.tagName, "DIV");
      assert.strictEqual(divAll.root.id, "myid");
      assert.strictEqual(divAll.root.classList.length, 3);
      assert(divAll.root.classList.contains("a"));
      assert(divAll.root.classList.contains("b"));
      assert(divAll.root.classList.contains("c"));
      const spanId = h("span#myid");
      assert.strictEqual(spanId.root.tagName, "SPAN");
      assert.strictEqual(spanId.root.id, "myid");
      const spanClass = h("span.a");
      assert.strictEqual(spanClass.root.tagName, "SPAN");
      assert.strictEqual(spanClass.root.classList.length, 1);
      assert(spanClass.root.classList.contains("a"));
      const spanClasses = h("span.a.b.c");
      assert.strictEqual(spanClasses.root.tagName, "SPAN");
      assert.strictEqual(spanClasses.root.classList.length, 3);
      assert(spanClasses.root.classList.contains("a"));
      assert(spanClasses.root.classList.contains("b"));
      assert(spanClasses.root.classList.contains("c"));
      const spanAll = h("span#myid.a.b.c");
      assert.strictEqual(spanAll.root.tagName, "SPAN");
      assert.strictEqual(spanAll.root.id, "myid");
      assert.strictEqual(spanAll.root.classList.length, 3);
      assert(spanAll.root.classList.contains("a"));
      assert(spanAll.root.classList.contains("b"));
      assert(spanAll.root.classList.contains("c"));
    });
    test("should implicitly handle ids and classes", () => {
      const divId = h("#myid");
      assert.strictEqual(divId.root.tagName, "DIV");
      assert.strictEqual(divId.root.id, "myid");
      const divClass = h(".a");
      assert.strictEqual(divClass.root.tagName, "DIV");
      assert.strictEqual(divClass.root.classList.length, 1);
      assert(divClass.root.classList.contains("a"));
      const divClasses = h(".a.b.c");
      assert.strictEqual(divClasses.root.tagName, "DIV");
      assert.strictEqual(divClasses.root.classList.length, 3);
      assert(divClasses.root.classList.contains("a"));
      assert(divClasses.root.classList.contains("b"));
      assert(divClasses.root.classList.contains("c"));
      const divAll = h("#myid.a.b.c");
      assert.strictEqual(divAll.root.tagName, "DIV");
      assert.strictEqual(divAll.root.id, "myid");
      assert.strictEqual(divAll.root.classList.length, 3);
      assert(divAll.root.classList.contains("a"));
      assert(divAll.root.classList.contains("b"));
      assert(divAll.root.classList.contains("c"));
    });
    test("should handle @ identifiers", () => {
      const implicit = h("@el");
      assert.strictEqual(implicit.root, implicit.el);
      assert.strictEqual(implicit.el.tagName, "DIV");
      const explicit = h("div@el");
      assert.strictEqual(explicit.root, explicit.el);
      assert.strictEqual(explicit.el.tagName, "DIV");
      const implicitId = h("#myid@el");
      assert.strictEqual(implicitId.root, implicitId.el);
      assert.strictEqual(implicitId.el.tagName, "DIV");
      assert.strictEqual(implicitId.root.id, "myid");
      const explicitId = h("div#myid@el");
      assert.strictEqual(explicitId.root, explicitId.el);
      assert.strictEqual(explicitId.el.tagName, "DIV");
      assert.strictEqual(explicitId.root.id, "myid");
      const implicitClass = h(".a@el");
      assert.strictEqual(implicitClass.root, implicitClass.el);
      assert.strictEqual(implicitClass.el.tagName, "DIV");
      assert.strictEqual(implicitClass.root.classList.length, 1);
      assert(implicitClass.root.classList.contains("a"));
      const explicitClass = h("div.a@el");
      assert.strictEqual(explicitClass.root, explicitClass.el);
      assert.strictEqual(explicitClass.el.tagName, "DIV");
      assert.strictEqual(explicitClass.root.classList.length, 1);
      assert(explicitClass.root.classList.contains("a"));
    });
  });
  test("should recurse", () => {
    const result = h("div.code-view", [
      h("div.title@title"),
      h("div.container", [
        h("div.gutter@gutterDiv"),
        h("span@editor")
      ])
    ]);
    assert.strictEqual(result.root.tagName, "DIV");
    assert.strictEqual(result.root.className, "code-view");
    assert.strictEqual(result.root.childElementCount, 2);
    assert.strictEqual(result.root.firstElementChild, result.title);
    assert.strictEqual(result.title.tagName, "DIV");
    assert.strictEqual(result.title.className, "title");
    assert.strictEqual(result.title.childElementCount, 0);
    assert.strictEqual(result.gutterDiv.tagName, "DIV");
    assert.strictEqual(result.gutterDiv.className, "gutter");
    assert.strictEqual(result.gutterDiv.childElementCount, 0);
    assert.strictEqual(result.editor.tagName, "SPAN");
    assert.strictEqual(result.editor.className, "");
    assert.strictEqual(result.editor.childElementCount, 0);
  });
  test("cssValueWithDefault", () => {
    assert.strictEqual(asCssValueWithDefault("red", "blue"), "red");
    assert.strictEqual(asCssValueWithDefault(void 0, "blue"), "blue");
    assert.strictEqual(asCssValueWithDefault("var(--my-var)", "blue"), "var(--my-var, blue)");
    assert.strictEqual(asCssValueWithDefault("var(--my-var, red)", "blue"), "var(--my-var, red)");
    assert.strictEqual(asCssValueWithDefault("var(--my-var, var(--my-var2))", "blue"), "var(--my-var, var(--my-var2, blue))");
  });
  test("copyAttributes", () => {
    const elementSource = document.createElement("div");
    elementSource.setAttribute("foo", "bar");
    elementSource.setAttribute("bar", "foo");
    const elementTarget = document.createElement("div");
    copyAttributes(elementSource, elementTarget);
    assert.strictEqual(elementTarget.getAttribute("foo"), "bar");
    assert.strictEqual(elementTarget.getAttribute("bar"), "foo");
  });
  test("trackAttributes (unfiltered)", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      const elementSource = document.createElement("div");
      const elementTarget = document.createElement("div");
      const disposable = trackAttributes(elementSource, elementTarget);
      elementSource.setAttribute("foo", "bar");
      elementSource.setAttribute("bar", "foo");
      await timeout(1);
      assert.strictEqual(elementTarget.getAttribute("foo"), "bar");
      assert.strictEqual(elementTarget.getAttribute("bar"), "foo");
      disposable.dispose();
    });
  });
  test("trackAttributes (filtered)", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      const elementSource = document.createElement("div");
      const elementTarget = document.createElement("div");
      const disposable = trackAttributes(elementSource, elementTarget, ["foo"]);
      elementSource.setAttribute("foo", "bar");
      elementSource.setAttribute("bar", "foo");
      await timeout(1);
      assert.strictEqual(elementTarget.getAttribute("foo"), "bar");
      assert.strictEqual(elementTarget.getAttribute("bar"), null);
      disposable.dispose();
    });
  });
  test("window utilities", () => {
    const windows = Array.from(getWindows());
    assert.strictEqual(windows.length, 1);
    assert.strictEqual(getWindowsCount(), 1);
    const windowId = getWindowId(mainWindow);
    assert.ok(typeof windowId === "number");
    assert.strictEqual(getWindowById(windowId)?.window, mainWindow);
    assert.strictEqual(getWindowById(void 0, true).window, mainWindow);
    assert.strictEqual(hasWindow(windowId), true);
    assert.strictEqual(isAuxiliaryWindow(mainWindow), false);
    ensureCodeWindow(mainWindow, 1);
    assert.ok(typeof mainWindow.vscodeWindowId === "number");
    const div = document.createElement("div");
    assert.strictEqual(getWindow(div), mainWindow);
    assert.strictEqual(getDocument(div), mainWindow.document);
    const event = document.createEvent("MouseEvent");
    assert.strictEqual(getWindow(event), mainWindow);
    assert.strictEqual(getDocument(event), mainWindow.document);
  });
  suite("disposableWindowInterval", () => {
    test("basics", async () => {
      let count = 0;
      const promise = new DeferredPromise();
      const interval = disposableWindowInterval(mainWindow, () => {
        count++;
        if (count === 3) {
          promise.complete(void 0);
          return true;
        } else {
          return false;
        }
      }, 0, 10);
      await promise.p;
      assert.strictEqual(count, 3);
      interval.dispose();
    });
    test("iterations", async () => {
      let count = 0;
      const interval = disposableWindowInterval(mainWindow, () => {
        count++;
        return false;
      }, 0, 0);
      await timeout(5);
      assert.strictEqual(count, 0);
      interval.dispose();
    });
    test("dispose", async () => {
      let count = 0;
      const interval = disposableWindowInterval(mainWindow, () => {
        count++;
        return false;
      }, 0, 10);
      interval.dispose();
      await timeout(5);
      assert.strictEqual(count, 0);
    });
  });
  suite("SafeTriangle", () => {
    const fakeElement = (left, right, top, bottom) => {
      return { getBoundingClientRect: () => ({ left, right, top, bottom }) };
    };
    test("works", () => {
      const safeTriangle = new SafeTriangle(0, 0, fakeElement(10, 20, 10, 20));
      assert.strictEqual(safeTriangle.contains(5, 5), true);
      assert.strictEqual(safeTriangle.contains(15, 5), false);
      assert.strictEqual(safeTriangle.contains(25, 5), false);
      assert.strictEqual(safeTriangle.contains(5, 15), false);
      assert.strictEqual(safeTriangle.contains(15, 15), true);
      assert.strictEqual(safeTriangle.contains(25, 15), false);
      assert.strictEqual(safeTriangle.contains(5, 25), false);
      assert.strictEqual(safeTriangle.contains(15, 25), false);
      assert.strictEqual(safeTriangle.contains(25, 25), false);
    });
    test("other dirations", () => {
      const a = new SafeTriangle(30, 30, fakeElement(10, 20, 10, 20));
      assert.strictEqual(a.contains(25, 25), true);
      const b = new SafeTriangle(0, 30, fakeElement(10, 20, 10, 20));
      assert.strictEqual(b.contains(5, 25), true);
      const c = new SafeTriangle(30, 0, fakeElement(10, 20, 10, 20));
      assert.strictEqual(c.contains(25, 5), true);
    });
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvYnJvd3Nlci9kb20udGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7ICQsIGgsIG11bHRpYnl0ZUF3YXJlQnRvYSwgdHJhY2tBdHRyaWJ1dGVzLCBjb3B5QXR0cmlidXRlcywgZGlzcG9zYWJsZVdpbmRvd0ludGVydmFsLCBnZXRXaW5kb3dzLCBnZXRXaW5kb3dzQ291bnQsIGdldFdpbmRvd0lkLCBnZXRXaW5kb3dCeUlkLCBoYXNXaW5kb3csIGdldFdpbmRvdywgZ2V0RG9jdW1lbnQsIGlzSFRNTEVsZW1lbnQsIFNhZmVUcmlhbmdsZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGFzQ3NzVmFsdWVXaXRoRGVmYXVsdCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9jc3NWYWx1ZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVDb2RlV2luZG93LCBpc0F1eGlsaWFyeVdpbmRvdywgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSwgdGltZW91dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBydW5XaXRoRmFrZWRUaW1lcnMgfSBmcm9tICcuLi9jb21tb24vdGltZVRyYXZlbFNjaGVkdWxlci5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnZG9tJywgKCkgPT4ge1xuXHR0ZXN0KCdoYXNDbGFzcycsICgpID0+IHtcblxuXHRcdGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRlbGVtZW50LmNsYXNzTmFtZSA9ICdmb29iYXIgYm9vIGZhcic7XG5cblx0XHRhc3NlcnQoZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2Zvb2JhcicpKTtcblx0XHRhc3NlcnQoZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2JvbycpKTtcblx0XHRhc3NlcnQoZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2ZhcicpKTtcblx0XHRhc3NlcnQoIWVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdiYXInKSk7XG5cdFx0YXNzZXJ0KCFlbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnZm9vJykpO1xuXHRcdGFzc2VydCghZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJycpKTtcblx0fSk7XG5cblx0dGVzdCgncmVtb3ZlQ2xhc3MnLCAoKSA9PiB7XG5cblx0XHRsZXQgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGVsZW1lbnQuY2xhc3NOYW1lID0gJ2Zvb2JhciBib28gZmFyJztcblxuXHRcdGVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnYm9vJyk7XG5cdFx0YXNzZXJ0KGVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdmYXInKSk7XG5cdFx0YXNzZXJ0KCFlbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnYm9vJykpO1xuXHRcdGFzc2VydChlbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnZm9vYmFyJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbGVtZW50LmNsYXNzTmFtZSwgJ2Zvb2JhciBmYXInKTtcblxuXHRcdGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRlbGVtZW50LmNsYXNzTmFtZSA9ICdmb29iYXIgYm9vIGZhcic7XG5cblx0XHRlbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2ZhcicpO1xuXHRcdGFzc2VydCghZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2ZhcicpKTtcblx0XHRhc3NlcnQoZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2JvbycpKTtcblx0XHRhc3NlcnQoZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2Zvb2JhcicpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWxlbWVudC5jbGFzc05hbWUsICdmb29iYXIgYm9vJyk7XG5cblx0XHRlbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2JvbycpO1xuXHRcdGFzc2VydCghZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2ZhcicpKTtcblx0XHRhc3NlcnQoIWVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdib28nKSk7XG5cdFx0YXNzZXJ0KGVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdmb29iYXInKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVsZW1lbnQuY2xhc3NOYW1lLCAnZm9vYmFyJyk7XG5cblx0XHRlbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2Zvb2JhcicpO1xuXHRcdGFzc2VydCghZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2ZhcicpKTtcblx0XHRhc3NlcnQoIWVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdib28nKSk7XG5cdFx0YXNzZXJ0KCFlbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnZm9vYmFyJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbGVtZW50LmNsYXNzTmFtZSwgJycpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZW1vdmVDbGFzcyBzaG91bGQgY29uc2lkZXIgaHlwaGVucycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cblx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2Zvby1iYXInKTtcblx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2JhcicpO1xuXG5cdFx0YXNzZXJ0KGVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdmb28tYmFyJykpO1xuXHRcdGFzc2VydChlbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnYmFyJykpO1xuXG5cdFx0ZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdiYXInKTtcblx0XHRhc3NlcnQoZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2Zvby1iYXInKSk7XG5cdFx0YXNzZXJ0KCFlbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnYmFyJykpO1xuXG5cdFx0ZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdmb28tYmFyJyk7XG5cdFx0YXNzZXJ0KCFlbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnZm9vLWJhcicpKTtcblx0XHRhc3NlcnQoIWVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdiYXInKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpYnl0ZUF3YXJlQnRvYScsICgpID0+IHtcblx0XHRhc3NlcnQub2sobXVsdGlieXRlQXdhcmVCdG9hKCdoZWxsbyB3b3JsZCcpLmxlbmd0aCA+IDApO1xuXHRcdGFzc2VydC5vayhtdWx0aWJ5dGVBd2FyZUJ0b2EoJ1x1NUU3M1x1NEVFRVx1NTQwRCcpLmxlbmd0aCA+IDApO1xuXHRcdGFzc2VydC5vayhtdWx0aWJ5dGVBd2FyZUJ0b2EobmV3IEFycmF5KDEwMDAwMCkuZmlsbCgndnMnKS5qb2luKCcnKSkubGVuZ3RoID4gMCk7IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMTIwMTNcblx0fSk7XG5cblx0c3VpdGUoJyQnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIGJ1aWxkIHNpbXBsZSBub2RlcycsICgpID0+IHtcblx0XHRcdGNvbnN0IGRpdiA9ICQoJ2RpdicpO1xuXHRcdFx0YXNzZXJ0KGRpdik7XG5cdFx0XHRhc3NlcnQoaXNIVE1MRWxlbWVudChkaXYpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXYudGFnTmFtZSwgJ0RJVicpO1xuXHRcdFx0YXNzZXJ0KCFkaXYuZmlyc3RDaGlsZCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgYnVpbGQgbm9kZXMgd2l0aCBpZCcsICgpID0+IHtcblx0XHRcdGNvbnN0IGRpdiA9ICQoJ2RpdiNmb28nKTtcblx0XHRcdGFzc2VydChkaXYpO1xuXHRcdFx0YXNzZXJ0KGlzSFRNTEVsZW1lbnQoZGl2KSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGl2LnRhZ05hbWUsICdESVYnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXYuaWQsICdmb28nKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBidWlsZCBub2RlcyB3aXRoIGNsYXNzLW5hbWUnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBkaXYgPSAkKCdkaXYuZm9vJyk7XG5cdFx0XHRhc3NlcnQoZGl2KTtcblx0XHRcdGFzc2VydChpc0hUTUxFbGVtZW50KGRpdikpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpdi50YWdOYW1lLCAnRElWJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGl2LmNsYXNzTmFtZSwgJ2ZvbycpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGJ1aWxkIG5vZGVzIHdpdGggYXR0cmlidXRlcycsICgpID0+IHtcblx0XHRcdGxldCBkaXYgPSAkKCdkaXYnLCB7IGNsYXNzOiAndGVzdCcgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGl2LmNsYXNzTmFtZSwgJ3Rlc3QnKTtcblxuXHRcdFx0ZGl2ID0gJCgnZGl2JywgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXYuY2xhc3NOYW1lLCAnJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgYnVpbGQgbm9kZXMgd2l0aCBjaGlsZHJlbicsICgpID0+IHtcblx0XHRcdGxldCBkaXYgPSAkKCdkaXYnLCB1bmRlZmluZWQsICQoJ3NwYW4nLCB7IGlkOiAnZGVtb3NwYW4nIH0pKTtcblx0XHRcdGNvbnN0IGZpcnN0Q2hpbGQgPSBkaXYuZmlyc3RDaGlsZCBhcyBIVE1MRWxlbWVudDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdENoaWxkLnRhZ05hbWUsICdTUEFOJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3RDaGlsZC5pZCwgJ2RlbW9zcGFuJyk7XG5cblx0XHRcdGRpdiA9ICQoJ2RpdicsIHVuZGVmaW5lZCwgJ2hlbGxvJyk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXYuZmlyc3RDaGlsZCAmJiBkaXYuZmlyc3RDaGlsZC50ZXh0Q29udGVudCwgJ2hlbGxvJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgYnVpbGQgbm9kZXMgd2l0aCB0ZXh0IGNoaWxkcmVuJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGl2ID0gJCgnZGl2JywgdW5kZWZpbmVkLCAnZm9vYmFyJyk7XG5cdFx0XHRjb25zdCBmaXJzdENoaWxkID0gZGl2LmZpcnN0Q2hpbGQgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3RDaGlsZC50YWdOYW1lLCB1bmRlZmluZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0Q2hpbGQudGV4dENvbnRlbnQsICdmb29iYXInKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2gnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIGJ1aWxkIHNpbXBsZSBub2RlcycsICgpID0+IHtcblx0XHRcdGNvbnN0IGRpdiA9IGgoJ2RpdicpO1xuXHRcdFx0YXNzZXJ0KGlzSFRNTEVsZW1lbnQoZGl2LnJvb3QpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXYucm9vdC50YWdOYW1lLCAnRElWJyk7XG5cblx0XHRcdGNvbnN0IHNwYW4gPSBoKCdzcGFuJyk7XG5cdFx0XHRhc3NlcnQoaXNIVE1MRWxlbWVudChzcGFuLnJvb3QpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGFuLnJvb3QudGFnTmFtZSwgJ1NQQU4nKTtcblxuXHRcdFx0Y29uc3QgaW1nID0gaCgnaW1nJyk7XG5cdFx0XHRhc3NlcnQoaXNIVE1MRWxlbWVudChpbWcucm9vdCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGltZy5yb290LnRhZ05hbWUsICdJTUcnKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBoYW5kbGUgaWRzIGFuZCBjbGFzc2VzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGl2SWQgPSBoKCdkaXYjbXlpZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpdklkLnJvb3QudGFnTmFtZSwgJ0RJVicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpdklkLnJvb3QuaWQsICdteWlkJyk7XG5cblx0XHRcdGNvbnN0IGRpdkNsYXNzID0gaCgnZGl2LmEnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXZDbGFzcy5yb290LnRhZ05hbWUsICdESVYnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXZDbGFzcy5yb290LmNsYXNzTGlzdC5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0KGRpdkNsYXNzLnJvb3QuY2xhc3NMaXN0LmNvbnRhaW5zKCdhJykpO1xuXG5cdFx0XHRjb25zdCBkaXZDbGFzc2VzID0gaCgnZGl2LmEuYi5jJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGl2Q2xhc3Nlcy5yb290LnRhZ05hbWUsICdESVYnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXZDbGFzc2VzLnJvb3QuY2xhc3NMaXN0Lmxlbmd0aCwgMyk7XG5cdFx0XHRhc3NlcnQoZGl2Q2xhc3Nlcy5yb290LmNsYXNzTGlzdC5jb250YWlucygnYScpKTtcblx0XHRcdGFzc2VydChkaXZDbGFzc2VzLnJvb3QuY2xhc3NMaXN0LmNvbnRhaW5zKCdiJykpO1xuXHRcdFx0YXNzZXJ0KGRpdkNsYXNzZXMucm9vdC5jbGFzc0xpc3QuY29udGFpbnMoJ2MnKSk7XG5cblx0XHRcdGNvbnN0IGRpdkFsbCA9IGgoJ2RpdiNteWlkLmEuYi5jJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGl2QWxsLnJvb3QudGFnTmFtZSwgJ0RJVicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpdkFsbC5yb290LmlkLCAnbXlpZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpdkFsbC5yb290LmNsYXNzTGlzdC5sZW5ndGgsIDMpO1xuXHRcdFx0YXNzZXJ0KGRpdkFsbC5yb290LmNsYXNzTGlzdC5jb250YWlucygnYScpKTtcblx0XHRcdGFzc2VydChkaXZBbGwucm9vdC5jbGFzc0xpc3QuY29udGFpbnMoJ2InKSk7XG5cdFx0XHRhc3NlcnQoZGl2QWxsLnJvb3QuY2xhc3NMaXN0LmNvbnRhaW5zKCdjJykpO1xuXG5cdFx0XHRjb25zdCBzcGFuSWQgPSBoKCdzcGFuI215aWQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGFuSWQucm9vdC50YWdOYW1lLCAnU1BBTicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNwYW5JZC5yb290LmlkLCAnbXlpZCcpO1xuXG5cdFx0XHRjb25zdCBzcGFuQ2xhc3MgPSBoKCdzcGFuLmEnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGFuQ2xhc3Mucm9vdC50YWdOYW1lLCAnU1BBTicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNwYW5DbGFzcy5yb290LmNsYXNzTGlzdC5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0KHNwYW5DbGFzcy5yb290LmNsYXNzTGlzdC5jb250YWlucygnYScpKTtcblxuXHRcdFx0Y29uc3Qgc3BhbkNsYXNzZXMgPSBoKCdzcGFuLmEuYi5jJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BhbkNsYXNzZXMucm9vdC50YWdOYW1lLCAnU1BBTicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNwYW5DbGFzc2VzLnJvb3QuY2xhc3NMaXN0Lmxlbmd0aCwgMyk7XG5cdFx0XHRhc3NlcnQoc3BhbkNsYXNzZXMucm9vdC5jbGFzc0xpc3QuY29udGFpbnMoJ2EnKSk7XG5cdFx0XHRhc3NlcnQoc3BhbkNsYXNzZXMucm9vdC5jbGFzc0xpc3QuY29udGFpbnMoJ2InKSk7XG5cdFx0XHRhc3NlcnQoc3BhbkNsYXNzZXMucm9vdC5jbGFzc0xpc3QuY29udGFpbnMoJ2MnKSk7XG5cblx0XHRcdGNvbnN0IHNwYW5BbGwgPSBoKCdzcGFuI215aWQuYS5iLmMnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGFuQWxsLnJvb3QudGFnTmFtZSwgJ1NQQU4nKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGFuQWxsLnJvb3QuaWQsICdteWlkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BhbkFsbC5yb290LmNsYXNzTGlzdC5sZW5ndGgsIDMpO1xuXHRcdFx0YXNzZXJ0KHNwYW5BbGwucm9vdC5jbGFzc0xpc3QuY29udGFpbnMoJ2EnKSk7XG5cdFx0XHRhc3NlcnQoc3BhbkFsbC5yb290LmNsYXNzTGlzdC5jb250YWlucygnYicpKTtcblx0XHRcdGFzc2VydChzcGFuQWxsLnJvb3QuY2xhc3NMaXN0LmNvbnRhaW5zKCdjJykpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGltcGxpY2l0bHkgaGFuZGxlIGlkcyBhbmQgY2xhc3NlcycsICgpID0+IHtcblx0XHRcdGNvbnN0IGRpdklkID0gaCgnI215aWQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXZJZC5yb290LnRhZ05hbWUsICdESVYnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXZJZC5yb290LmlkLCAnbXlpZCcpO1xuXG5cdFx0XHRjb25zdCBkaXZDbGFzcyA9IGgoJy5hJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGl2Q2xhc3Mucm9vdC50YWdOYW1lLCAnRElWJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGl2Q2xhc3Mucm9vdC5jbGFzc0xpc3QubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydChkaXZDbGFzcy5yb290LmNsYXNzTGlzdC5jb250YWlucygnYScpKTtcblxuXHRcdFx0Y29uc3QgZGl2Q2xhc3NlcyA9IGgoJy5hLmIuYycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpdkNsYXNzZXMucm9vdC50YWdOYW1lLCAnRElWJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGl2Q2xhc3Nlcy5yb290LmNsYXNzTGlzdC5sZW5ndGgsIDMpO1xuXHRcdFx0YXNzZXJ0KGRpdkNsYXNzZXMucm9vdC5jbGFzc0xpc3QuY29udGFpbnMoJ2EnKSk7XG5cdFx0XHRhc3NlcnQoZGl2Q2xhc3Nlcy5yb290LmNsYXNzTGlzdC5jb250YWlucygnYicpKTtcblx0XHRcdGFzc2VydChkaXZDbGFzc2VzLnJvb3QuY2xhc3NMaXN0LmNvbnRhaW5zKCdjJykpO1xuXG5cdFx0XHRjb25zdCBkaXZBbGwgPSBoKCcjbXlpZC5hLmIuYycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpdkFsbC5yb290LnRhZ05hbWUsICdESVYnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXZBbGwucm9vdC5pZCwgJ215aWQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXZBbGwucm9vdC5jbGFzc0xpc3QubGVuZ3RoLCAzKTtcblx0XHRcdGFzc2VydChkaXZBbGwucm9vdC5jbGFzc0xpc3QuY29udGFpbnMoJ2EnKSk7XG5cdFx0XHRhc3NlcnQoZGl2QWxsLnJvb3QuY2xhc3NMaXN0LmNvbnRhaW5zKCdiJykpO1xuXHRcdFx0YXNzZXJ0KGRpdkFsbC5yb290LmNsYXNzTGlzdC5jb250YWlucygnYycpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBoYW5kbGUgQCBpZGVudGlmaWVycycsICgpID0+IHtcblx0XHRcdGNvbnN0IGltcGxpY2l0ID0gaCgnQGVsJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW1wbGljaXQucm9vdCwgaW1wbGljaXQuZWwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGltcGxpY2l0LmVsLnRhZ05hbWUsICdESVYnKTtcblxuXHRcdFx0Y29uc3QgZXhwbGljaXQgPSBoKCdkaXZAZWwnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHBsaWNpdC5yb290LCBleHBsaWNpdC5lbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhwbGljaXQuZWwudGFnTmFtZSwgJ0RJVicpO1xuXG5cdFx0XHRjb25zdCBpbXBsaWNpdElkID0gaCgnI215aWRAZWwnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbXBsaWNpdElkLnJvb3QsIGltcGxpY2l0SWQuZWwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGltcGxpY2l0SWQuZWwudGFnTmFtZSwgJ0RJVicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGltcGxpY2l0SWQucm9vdC5pZCwgJ215aWQnKTtcblxuXHRcdFx0Y29uc3QgZXhwbGljaXRJZCA9IGgoJ2RpdiNteWlkQGVsJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhwbGljaXRJZC5yb290LCBleHBsaWNpdElkLmVsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHBsaWNpdElkLmVsLnRhZ05hbWUsICdESVYnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHBsaWNpdElkLnJvb3QuaWQsICdteWlkJyk7XG5cblx0XHRcdGNvbnN0IGltcGxpY2l0Q2xhc3MgPSBoKCcuYUBlbCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGltcGxpY2l0Q2xhc3Mucm9vdCwgaW1wbGljaXRDbGFzcy5lbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW1wbGljaXRDbGFzcy5lbC50YWdOYW1lLCAnRElWJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW1wbGljaXRDbGFzcy5yb290LmNsYXNzTGlzdC5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0KGltcGxpY2l0Q2xhc3Mucm9vdC5jbGFzc0xpc3QuY29udGFpbnMoJ2EnKSk7XG5cblx0XHRcdGNvbnN0IGV4cGxpY2l0Q2xhc3MgPSBoKCdkaXYuYUBlbCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4cGxpY2l0Q2xhc3Mucm9vdCwgZXhwbGljaXRDbGFzcy5lbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhwbGljaXRDbGFzcy5lbC50YWdOYW1lLCAnRElWJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhwbGljaXRDbGFzcy5yb290LmNsYXNzTGlzdC5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0KGV4cGxpY2l0Q2xhc3Mucm9vdC5jbGFzc0xpc3QuY29udGFpbnMoJ2EnKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZCByZWN1cnNlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGgoJ2Rpdi5jb2RlLXZpZXcnLCBbXG5cdFx0XHRoKCdkaXYudGl0bGVAdGl0bGUnKSxcblx0XHRcdGgoJ2Rpdi5jb250YWluZXInLCBbXG5cdFx0XHRcdGgoJ2Rpdi5ndXR0ZXJAZ3V0dGVyRGl2JyksXG5cdFx0XHRcdGgoJ3NwYW5AZWRpdG9yJyksXG5cdFx0XHRdKSxcblx0XHRdKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQucm9vdC50YWdOYW1lLCAnRElWJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5yb290LmNsYXNzTmFtZSwgJ2NvZGUtdmlldycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQucm9vdC5jaGlsZEVsZW1lbnRDb3VudCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5yb290LmZpcnN0RWxlbWVudENoaWxkLCByZXN1bHQudGl0bGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQudGl0bGUudGFnTmFtZSwgJ0RJVicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQudGl0bGUuY2xhc3NOYW1lLCAndGl0bGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnRpdGxlLmNoaWxkRWxlbWVudENvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmd1dHRlckRpdi50YWdOYW1lLCAnRElWJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5ndXR0ZXJEaXYuY2xhc3NOYW1lLCAnZ3V0dGVyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5ndXR0ZXJEaXYuY2hpbGRFbGVtZW50Q291bnQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZWRpdG9yLnRhZ05hbWUsICdTUEFOJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5lZGl0b3IuY2xhc3NOYW1lLCAnJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5lZGl0b3IuY2hpbGRFbGVtZW50Q291bnQsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdjc3NWYWx1ZVdpdGhEZWZhdWx0JywgKCkgPT4ge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhc0Nzc1ZhbHVlV2l0aERlZmF1bHQoJ3JlZCcsICdibHVlJyksICdyZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXNDc3NWYWx1ZVdpdGhEZWZhdWx0KHVuZGVmaW5lZCwgJ2JsdWUnKSwgJ2JsdWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXNDc3NWYWx1ZVdpdGhEZWZhdWx0KCd2YXIoLS1teS12YXIpJywgJ2JsdWUnKSwgJ3ZhcigtLW15LXZhciwgYmx1ZSknKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXNDc3NWYWx1ZVdpdGhEZWZhdWx0KCd2YXIoLS1teS12YXIsIHJlZCknLCAnYmx1ZScpLCAndmFyKC0tbXktdmFyLCByZWQpJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFzQ3NzVmFsdWVXaXRoRGVmYXVsdCgndmFyKC0tbXktdmFyLCB2YXIoLS1teS12YXIyKSknLCAnYmx1ZScpLCAndmFyKC0tbXktdmFyLCB2YXIoLS1teS12YXIyLCBibHVlKSknKTtcblx0fSk7XG5cblx0dGVzdCgnY29weUF0dHJpYnV0ZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZWxlbWVudFNvdXJjZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGVsZW1lbnRTb3VyY2Uuc2V0QXR0cmlidXRlKCdmb28nLCAnYmFyJyk7XG5cdFx0ZWxlbWVudFNvdXJjZS5zZXRBdHRyaWJ1dGUoJ2JhcicsICdmb28nKTtcblxuXHRcdGNvbnN0IGVsZW1lbnRUYXJnZXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb3B5QXR0cmlidXRlcyhlbGVtZW50U291cmNlLCBlbGVtZW50VGFyZ2V0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbGVtZW50VGFyZ2V0LmdldEF0dHJpYnV0ZSgnZm9vJyksICdiYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWxlbWVudFRhcmdldC5nZXRBdHRyaWJ1dGUoJ2JhcicpLCAnZm9vJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RyYWNrQXR0cmlidXRlcyAodW5maWx0ZXJlZCknLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZWxlbWVudFNvdXJjZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0Y29uc3QgZWxlbWVudFRhcmdldCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gdHJhY2tBdHRyaWJ1dGVzKGVsZW1lbnRTb3VyY2UsIGVsZW1lbnRUYXJnZXQpO1xuXG5cdFx0XHRlbGVtZW50U291cmNlLnNldEF0dHJpYnV0ZSgnZm9vJywgJ2JhcicpO1xuXHRcdFx0ZWxlbWVudFNvdXJjZS5zZXRBdHRyaWJ1dGUoJ2JhcicsICdmb28nKTtcblxuXHRcdFx0YXdhaXQgdGltZW91dCgxKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVsZW1lbnRUYXJnZXQuZ2V0QXR0cmlidXRlKCdmb28nKSwgJ2JhcicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVsZW1lbnRUYXJnZXQuZ2V0QXR0cmlidXRlKCdiYXInKSwgJ2ZvbycpO1xuXG5cdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndHJhY2tBdHRyaWJ1dGVzIChmaWx0ZXJlZCknLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZWxlbWVudFNvdXJjZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0Y29uc3QgZWxlbWVudFRhcmdldCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gdHJhY2tBdHRyaWJ1dGVzKGVsZW1lbnRTb3VyY2UsIGVsZW1lbnRUYXJnZXQsIFsnZm9vJ10pO1xuXG5cdFx0XHRlbGVtZW50U291cmNlLnNldEF0dHJpYnV0ZSgnZm9vJywgJ2JhcicpO1xuXHRcdFx0ZWxlbWVudFNvdXJjZS5zZXRBdHRyaWJ1dGUoJ2JhcicsICdmb28nKTtcblxuXHRcdFx0YXdhaXQgdGltZW91dCgxKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVsZW1lbnRUYXJnZXQuZ2V0QXR0cmlidXRlKCdmb28nKSwgJ2JhcicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVsZW1lbnRUYXJnZXQuZ2V0QXR0cmlidXRlKCdiYXInKSwgbnVsbCk7XG5cblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd3aW5kb3cgdXRpbGl0aWVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHdpbmRvd3MgPSBBcnJheS5mcm9tKGdldFdpbmRvd3MoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdpbmRvd3MubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0V2luZG93c0NvdW50KCksIDEpO1xuXHRcdGNvbnN0IHdpbmRvd0lkID0gZ2V0V2luZG93SWQobWFpbldpbmRvdyk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiB3aW5kb3dJZCA9PT0gJ251bWJlcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRXaW5kb3dCeUlkKHdpbmRvd0lkKT8ud2luZG93LCBtYWluV2luZG93KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0V2luZG93QnlJZCh1bmRlZmluZWQsIHRydWUpLndpbmRvdywgbWFpbldpbmRvdyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhc1dpbmRvdyh3aW5kb3dJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0F1eGlsaWFyeVdpbmRvdyhtYWluV2luZG93KSwgZmFsc2UpO1xuXHRcdGVuc3VyZUNvZGVXaW5kb3cobWFpbldpbmRvdywgMSk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiBtYWluV2luZG93LnZzY29kZVdpbmRvd0lkID09PSAnbnVtYmVyJyk7XG5cblx0XHRjb25zdCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0V2luZG93KGRpdiksIG1haW5XaW5kb3cpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXREb2N1bWVudChkaXYpLCBtYWluV2luZG93LmRvY3VtZW50KTtcblxuXHRcdGNvbnN0IGV2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ01vdXNlRXZlbnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0V2luZG93KGV2ZW50KSwgbWFpbldpbmRvdyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldERvY3VtZW50KGV2ZW50KSwgbWFpbldpbmRvdy5kb2N1bWVudCk7XG5cdH0pO1xuXG5cdHN1aXRlKCdkaXNwb3NhYmxlV2luZG93SW50ZXJ2YWwnLCAoKSA9PiB7XG5cdFx0dGVzdCgnYmFzaWNzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0bGV0IGNvdW50ID0gMDtcblx0XHRcdGNvbnN0IHByb21pc2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdFx0XHRjb25zdCBpbnRlcnZhbCA9IGRpc3Bvc2FibGVXaW5kb3dJbnRlcnZhbChtYWluV2luZG93LCAoKSA9PiB7XG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHRcdGlmIChjb3VudCA9PT0gMykge1xuXHRcdFx0XHRcdHByb21pc2UuY29tcGxldGUodW5kZWZpbmVkKTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDAsIDEwKTtcblxuXHRcdFx0YXdhaXQgcHJvbWlzZS5wO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAzKTtcblx0XHRcdGludGVydmFsLmRpc3Bvc2UoKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2l0ZXJhdGlvbnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRsZXQgY291bnQgPSAwO1xuXHRcdFx0Y29uc3QgaW50ZXJ2YWwgPSBkaXNwb3NhYmxlV2luZG93SW50ZXJ2YWwobWFpbldpbmRvdywgKCkgPT4ge1xuXHRcdFx0XHRjb3VudCsrO1xuXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0sIDAsIDApO1xuXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAwKTtcblx0XHRcdGludGVydmFsLmRpc3Bvc2UoKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2Rpc3Bvc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRsZXQgY291bnQgPSAwO1xuXHRcdFx0Y29uc3QgaW50ZXJ2YWwgPSBkaXNwb3NhYmxlV2luZG93SW50ZXJ2YWwobWFpbldpbmRvdywgKCkgPT4ge1xuXHRcdFx0XHRjb3VudCsrO1xuXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0sIDAsIDEwKTtcblxuXHRcdFx0aW50ZXJ2YWwuZGlzcG9zZSgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdTYWZlVHJpYW5nbGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFrZUVsZW1lbnQgPSAobGVmdDogbnVtYmVyLCByaWdodDogbnVtYmVyLCB0b3A6IG51bWJlciwgYm90dG9tOiBudW1iZXIpOiBIVE1MRWxlbWVudCA9PiB7XG5cdFx0XHRyZXR1cm4geyBnZXRCb3VuZGluZ0NsaWVudFJlY3Q6ICgpID0+ICh7IGxlZnQsIHJpZ2h0LCB0b3AsIGJvdHRvbSB9KSB9IGFzIGFueTtcblx0XHR9O1xuXG5cdFx0dGVzdCgnd29ya3MnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBzYWZlVHJpYW5nbGUgPSBuZXcgU2FmZVRyaWFuZ2xlKDAsIDAsIGZha2VFbGVtZW50KDEwLCAyMCwgMTAsIDIwKSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYWZlVHJpYW5nbGUuY29udGFpbnMoNSwgNSksIHRydWUpOyAvLyBpbiB0cmlhbmdsZSByZWdpb25cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYWZlVHJpYW5nbGUuY29udGFpbnMoMTUsIDUpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FmZVRyaWFuZ2xlLmNvbnRhaW5zKDI1LCA1KSwgZmFsc2UpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FmZVRyaWFuZ2xlLmNvbnRhaW5zKDUsIDE1KSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhZmVUcmlhbmdsZS5jb250YWlucygxNSwgMTUpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYWZlVHJpYW5nbGUuY29udGFpbnMoMjUsIDE1KSwgZmFsc2UpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FmZVRyaWFuZ2xlLmNvbnRhaW5zKDUsIDI1KSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhZmVUcmlhbmdsZS5jb250YWlucygxNSwgMjUpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FmZVRyaWFuZ2xlLmNvbnRhaW5zKDI1LCAyNSksIGZhbHNlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ290aGVyIGRpcmF0aW9ucycsICgpID0+IHtcblx0XHRcdGNvbnN0IGEgPSBuZXcgU2FmZVRyaWFuZ2xlKDMwLCAzMCwgZmFrZUVsZW1lbnQoMTAsIDIwLCAxMCwgMjApKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLmNvbnRhaW5zKDI1LCAyNSksIHRydWUpO1xuXG5cdFx0XHRjb25zdCBiID0gbmV3IFNhZmVUcmlhbmdsZSgwLCAzMCwgZmFrZUVsZW1lbnQoMTAsIDIwLCAxMCwgMjApKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLmNvbnRhaW5zKDUsIDI1KSwgdHJ1ZSk7XG5cblx0XHRcdGNvbnN0IGMgPSBuZXcgU2FmZVRyaWFuZ2xlKDMwLCAwLCBmYWtlRWxlbWVudCgxMCwgMjAsIDEwLCAyMCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGMuY29udGFpbnMoMjUsIDUpLCB0cnVlKTtcblx0XHR9KTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLEdBQUcsR0FBRyxvQkFBb0IsaUJBQWlCLGdCQUFnQiwwQkFBMEIsWUFBWSxpQkFBaUIsYUFBYSxlQUFlLFdBQVcsV0FBVyxhQUFhLGVBQWUsb0JBQW9CO0FBQzdOLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsa0JBQWtCLG1CQUFtQixrQkFBa0I7QUFDaEUsU0FBUyxpQkFBaUIsZUFBZTtBQUN6QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLCtDQUErQztBQUV4RCxNQUFNLE9BQU8sTUFBTTtBQUNsQixPQUFLLFlBQVksTUFBTTtBQUV0QixVQUFNLFVBQVUsU0FBUyxjQUFjLEtBQUs7QUFDNUMsWUFBUSxZQUFZO0FBRXBCLFdBQU8sUUFBUSxVQUFVLFNBQVMsUUFBUSxDQUFDO0FBQzNDLFdBQU8sUUFBUSxVQUFVLFNBQVMsS0FBSyxDQUFDO0FBQ3hDLFdBQU8sUUFBUSxVQUFVLFNBQVMsS0FBSyxDQUFDO0FBQ3hDLFdBQU8sQ0FBQyxRQUFRLFVBQVUsU0FBUyxLQUFLLENBQUM7QUFDekMsV0FBTyxDQUFDLFFBQVEsVUFBVSxTQUFTLEtBQUssQ0FBQztBQUN6QyxXQUFPLENBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxDQUFDO0FBQUEsRUFDdkMsQ0FBQztBQUVELE9BQUssZUFBZSxNQUFNO0FBRXpCLFFBQUksVUFBVSxTQUFTLGNBQWMsS0FBSztBQUMxQyxZQUFRLFlBQVk7QUFFcEIsWUFBUSxVQUFVLE9BQU8sS0FBSztBQUM5QixXQUFPLFFBQVEsVUFBVSxTQUFTLEtBQUss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
