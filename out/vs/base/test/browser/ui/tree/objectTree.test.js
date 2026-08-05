import assert from "assert";
import { CompressibleObjectTree, ObjectTree } from "../../../../browser/ui/tree/objectTree.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../common/utils.js";
function getRowsTextContent(container) {
  const rows = [...container.querySelectorAll(".monaco-list-row")];
  rows.sort((a, b) => parseInt(a.getAttribute("data-index")) - parseInt(b.getAttribute("data-index")));
  return rows.map((row) => row.querySelector(".monaco-tl-contents").textContent);
}
suite("ObjectTree", function() {
  suite("TreeNavigator", function() {
    let tree;
    let filter = (_) => true;
    teardown(() => {
      tree.dispose();
      filter = (_) => true;
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    setup(() => {
      const container = document.createElement("div");
      container.style.width = "200px";
      container.style.height = "200px";
      const delegate = new class {
        getHeight() {
          return 20;
        }
        getTemplateId() {
          return "default";
        }
      }();
      const renderer = new class {
        constructor() {
          this.templateId = "default";
        }
        renderTemplate(container2) {
          return container2;
        }
        renderElement(element, index, templateData) {
          templateData.textContent = `${element.element}`;
        }
        disposeTemplate() {
        }
      }();
      tree = new ObjectTree("test", container, delegate, [renderer], { filter: { filter: (el) => filter(el) } });
      tree.layout(200);
    });
    test("should be able to navigate", () => {
      tree.setChildren(null, [
        {
          element: 0,
          children: [
            { element: 10 },
            { element: 11 },
            { element: 12 }
          ]
        },
        { element: 1 },
        { element: 2 }
      ]);
      const navigator = tree.navigate();
      assert.strictEqual(navigator.current(), null);
      assert.strictEqual(navigator.next(), 0);
      assert.strictEqual(navigator.current(), 0);
      assert.strictEqual(navigator.next(), 10);
      assert.strictEqual(navigator.current(), 10);
      assert.strictEqual(navigator.next(), 11);
      assert.strictEqual(navigator.current(), 11);
      assert.strictEqual(navigator.next(), 12);
      assert.strictEqual(navigator.current(), 12);
      assert.strictEqual(navigator.next(), 1);
      assert.strictEqual(navigator.current(), 1);
      assert.strictEqual(navigator.next(), 2);
      assert.strictEqual(navigator.current(), 2);
      assert.strictEqual(navigator.previous(), 1);
      assert.strictEqual(navigator.current(), 1);
      assert.strictEqual(navigator.previous(), 12);
      assert.strictEqual(navigator.previous(), 11);
      assert.strictEqual(navigator.previous(), 10);
      assert.strictEqual(navigator.previous(), 0);
      assert.strictEqual(navigator.previous(), null);
      assert.strictEqual(navigator.next(), 0);
      assert.strictEqual(navigator.next(), 10);
      assert.strictEqual(navigator.first(), 0);
      assert.strictEqual(navigator.last(), 2);
    });
    test("should skip collapsed nodes", () => {
      tree.setChildren(null, [
        {
          element: 0,
          collapsed: true,
          children: [
            { element: 10 },
            { element: 11 },
            { element: 12 }
          ]
        },
        { element: 1 },
        { element: 2 }
      ]);
      const navigator = tree.navigate();
      assert.strictEqual(navigator.current(), null);
      assert.strictEqual(navigator.next(), 0);
      assert.strictEqual(navigator.next(), 1);
      assert.strictEqual(navigator.next(), 2);
      assert.strictEqual(navigator.next(), null);
      assert.strictEqual(navigator.previous(), 2);
      assert.strictEqual(navigator.previous(), 1);
      assert.strictEqual(navigator.previous(), 0);
      assert.strictEqual(navigator.previous(), null);
      assert.strictEqual(navigator.next(), 0);
      assert.strictEqual(navigator.first(), 0);
      assert.strictEqual(navigator.last(), 2);
    });
    test("should skip filtered elements", () => {
      filter = (el) => el % 2 === 0;
      tree.setChildren(null, [
        {
          element: 0,
          children: [
            { element: 10 },
            { element: 11 },
            { element: 12 }
          ]
        },
        { element: 1 },
        { element: 2 }
      ]);
      const navigator = tree.navigate();
      assert.strictEqual(navigator.current(), null);
      assert.strictEqual(navigator.next(), 0);
      assert.strictEqual(navigator.next(), 10);
      assert.strictEqual(navigator.next(), 12);
      assert.strictEqual(navigator.next(), 2);
      assert.strictEqual(navigator.next(), null);
      assert.strictEqual(navigator.previous(), 2);
      assert.strictEqual(navigator.previous(), 12);
      assert.strictEqual(navigator.previous(), 10);
      assert.strictEqual(navigator.previous(), 0);
      assert.strictEqual(navigator.previous(), null);
      assert.strictEqual(navigator.next(), 0);
      assert.strictEqual(navigator.next(), 10);
      assert.strictEqual(navigator.first(), 0);
      assert.strictEqual(navigator.last(), 2);
    });
    test("should be able to start from node", () => {
      tree.setChildren(null, [
        {
          element: 0,
          children: [
            { element: 10 },
            { element: 11 },
            { element: 12 }
          ]
        },
        { element: 1 },
        { element: 2 }
      ]);
      const navigator = tree.navigate(1);
      assert.strictEqual(navigator.current(), 1);
      assert.strictEqual(navigator.next(), 2);
      assert.strictEqual(navigator.current(), 2);
      assert.strictEqual(navigator.previous(), 1);
      assert.strictEqual(navigator.current(), 1);
      assert.strictEqual(navigator.previous(), 12);
      assert.strictEqual(navigator.previous(), 11);
      assert.strictEqual(navigator.previous(), 10);
      assert.strictEqual(navigator.previous(), 0);
      assert.strictEqual(navigator.previous(), null);
      assert.strictEqual(navigator.next(), 0);
      assert.strictEqual(navigator.next(), 10);
      assert.strictEqual(navigator.first(), 0);
      assert.strictEqual(navigator.last(), 2);
    });
  });
  class Delegate {
    getHeight() {
      return 20;
    }
    getTemplateId() {
      return "default";
    }
  }
  class Renderer {
    constructor() {
      this.templateId = "default";
    }
    renderTemplate(container) {
      return container;
    }
    renderElement(element, index, templateData) {
      templateData.textContent = `${element.element}`;
    }
    disposeTemplate() {
    }
  }
  class IdentityProvider {
    getId(element) {
      return `${element % 100}`;
    }
  }
  test("traits are preserved according to string identity", function() {
    const container = document.createElement("div");
    container.style.width = "200px";
    container.style.height = "200px";
    const delegate = new Delegate();
    const renderer = new Renderer();
    const identityProvider = new IdentityProvider();
    const tree = new ObjectTree("test", container, delegate, [renderer], { identityProvider });
    tree.layout(200);
    tree.setChildren(null, [{ element: 0 }, { element: 1 }, { element: 2 }, { element: 3 }]);
    tree.setFocus([1]);
    assert.deepStrictEqual(tree.getFocus(), [1]);
    tree.setChildren(null, [{ element: 100 }, { element: 101 }, { element: 102 }, { element: 103 }]);
    assert.deepStrictEqual(tree.getFocus(), [101]);
  });
});
suite("CompressibleObjectTree", function() {
  class Delegate {
    getHeight() {
      return 20;
    }
    getTemplateId() {
      return "default";
    }
  }
  class Renderer {
    constructor() {
      this.templateId = "default";
    }
    renderTemplate(container) {
      return container;
    }
    renderElement(node, _, templateData) {
      templateData.textContent = `${node.element}`;
    }
    renderCompressedElements(node, _, templateData) {
      templateData.textContent = `${node.element.elements.join("/")}`;
    }
    disposeTemplate() {
    }
  }
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("empty", function() {
    const container = document.createElement("div");
    container.style.width = "200px";
    container.style.height = "200px";
    const tree = ds.add(new CompressibleObjectTree("test", container, new Delegate(), [new Renderer()]));
    tree.layout(200);
    assert.strictEqual(getRowsTextContent(container).length, 0);
  });
  test("simple", function() {
    const container = document.createElement("div");
    container.style.width = "200px";
    container.style.height = "200px";
    const tree = ds.add(new CompressibleObjectTree("test", container, new Delegate(), [new Renderer()]));
    tree.layout(200);
    tree.setChildren(null, [
      {
        element: 0,
        children: [
          { element: 10 },
          { element: 11 },
          { element: 12 }
        ]
      },
      { element: 1 },
      { element: 2 }
    ]);
    assert.deepStrictEqual(getRowsTextContent(container), ["0", "10", "11", "12", "1", "2"]);
  });
  test("compressed", () => {
    const container = document.createElement("div");
    container.style.width = "200px";
    container.style.height = "200px";
    const tree = ds.add(new CompressibleObjectTree("test", container, new Delegate(), [new Renderer()]));
    tree.layout(200);
    tree.setChildren(null, [
      {
        element: 1,
        children: [{
          element: 11,
          children: [{
            element: 111,
            children: [
              { element: 1111 },
              { element: 1112 },
              { element: 1113 }
            ]
          }]
        }]
      }
    ]);
    assert.deepStrictEqual(getRowsTextContent(container), ["1/11/111", "1111", "1112", "1113"]);
    tree.setChildren(11, [
      { element: 111 },
      { element: 112 },
      { element: 113 }
    ]);
    assert.deepStrictEqual(getRowsTextContent(container), ["1/11", "111", "112", "113"]);
    tree.setChildren(113, [
      { element: 1131 }
    ]);
    assert.deepStrictEqual(getRowsTextContent(container), ["1/11", "111", "112", "113/1131"]);
    tree.setChildren(1131, [
      { element: 1132 }
    ]);
    assert.deepStrictEqual(getRowsTextContent(container), ["1/11", "111", "112", "113/1131/1132"]);
    tree.setChildren(1131, [
      { element: 1132 },
      { element: 1133 }
    ]);
    assert.deepStrictEqual(getRowsTextContent(container), ["1/11", "111", "112", "113/1131", "1132", "1133"]);
  });
  test("enableCompression", () => {
    const container = document.createElement("div");
    container.style.width = "200px";
    container.style.height = "200px";
    const tree = ds.add(new CompressibleObjectTree("test", container, new Delegate(), [new Renderer()]));
    tree.layout(200);
    tree.setChildren(null, [
      {
        element: 1,
        children: [{
          element: 11,
          children: [{
            element: 111,
            children: [
              { element: 1111 },
              { element: 1112 },
              { element: 1113 }
            ]
          }]
        }]
      }
    ]);
    assert.deepStrictEqual(getRowsTextContent(container), ["1/11/111", "1111", "1112", "1113"]);
    tree.updateOptions({ compressionEnabled: false });
    assert.deepStrictEqual(getRowsTextContent(container), ["1", "11", "111", "1111", "1112", "1113"]);
    tree.updateOptions({ compressionEnabled: true });
    assert.deepStrictEqual(getRowsTextContent(container), ["1/11/111", "1111", "1112", "1113"]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvYnJvd3Nlci91aS90cmVlL29iamVjdFRyZWUudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IElJZGVudGl0eVByb3ZpZGVyLCBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IElDb21wcmVzc2VkVHJlZU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3VpL3RyZWUvY29tcHJlc3NlZE9iamVjdFRyZWVNb2RlbC5qcyc7XG5pbXBvcnQgeyBDb21wcmVzc2libGVPYmplY3RUcmVlLCBJQ29tcHJlc3NpYmxlVHJlZVJlbmRlcmVyLCBPYmplY3RUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci91aS90cmVlL29iamVjdFRyZWUuanMnO1xuaW1wb3J0IHsgSVRyZWVOb2RlLCBJVHJlZVJlbmRlcmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3V0aWxzLmpzJztcblxuZnVuY3Rpb24gZ2V0Um93c1RleHRDb250ZW50KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBzdHJpbmdbXSB7XG5cdGNvbnN0IHJvd3MgPSBbLi4uY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb25hY28tbGlzdC1yb3cnKV07XG5cdHJvd3Muc29ydCgoYSwgYikgPT4gcGFyc2VJbnQoYS5nZXRBdHRyaWJ1dGUoJ2RhdGEtaW5kZXgnKSEpIC0gcGFyc2VJbnQoYi5nZXRBdHRyaWJ1dGUoJ2RhdGEtaW5kZXgnKSEpKTtcblx0cmV0dXJuIHJvd3MubWFwKHJvdyA9PiByb3cucXVlcnlTZWxlY3RvcignLm1vbmFjby10bC1jb250ZW50cycpIS50ZXh0Q29udGVudCEpO1xufVxuXG5zdWl0ZSgnT2JqZWN0VHJlZScsIGZ1bmN0aW9uICgpIHtcblxuXHRzdWl0ZSgnVHJlZU5hdmlnYXRvcicsIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgdHJlZTogT2JqZWN0VHJlZTxudW1iZXI+O1xuXHRcdGxldCBmaWx0ZXIgPSAoXzogbnVtYmVyKSA9PiB0cnVlO1xuXG5cdFx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdFx0dHJlZS5kaXNwb3NlKCk7XG5cdFx0XHRmaWx0ZXIgPSAoXzogbnVtYmVyKSA9PiB0cnVlO1xuXHRcdH0pO1xuXG5cdFx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdGNvbnRhaW5lci5zdHlsZS53aWR0aCA9ICcyMDBweCc7XG5cdFx0XHRjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gJzIwMHB4JztcblxuXHRcdFx0Y29uc3QgZGVsZWdhdGUgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxudW1iZXI+IHtcblx0XHRcdFx0Z2V0SGVpZ2h0KCkgeyByZXR1cm4gMjA7IH1cblx0XHRcdFx0Z2V0VGVtcGxhdGVJZCgpOiBzdHJpbmcgeyByZXR1cm4gJ2RlZmF1bHQnOyB9XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCByZW5kZXJlciA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8bnVtYmVyLCB2b2lkLCBIVE1MRWxlbWVudD4ge1xuXHRcdFx0XHRyZWFkb25seSB0ZW1wbGF0ZUlkID0gJ2RlZmF1bHQnO1xuXHRcdFx0XHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQge1xuXHRcdFx0XHRcdHJldHVybiBjb250YWluZXI7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8bnVtYmVyLCB2b2lkPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdFx0XHRcdHRlbXBsYXRlRGF0YS50ZXh0Q29udGVudCA9IGAke2VsZW1lbnQuZWxlbWVudH1gO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRpc3Bvc2VUZW1wbGF0ZSgpOiB2b2lkIHsgfVxuXHRcdFx0fTtcblxuXHRcdFx0dHJlZSA9IG5ldyBPYmplY3RUcmVlPG51bWJlcj4oJ3Rlc3QnLCBjb250YWluZXIsIGRlbGVnYXRlLCBbcmVuZGVyZXJdLCB7IGZpbHRlcjogeyBmaWx0ZXI6IChlbCkgPT4gZmlsdGVyKGVsKSB9IH0pO1xuXHRcdFx0dHJlZS5sYXlvdXQoMjAwKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBiZSBhYmxlIHRvIG5hdmlnYXRlJywgKCkgPT4ge1xuXHRcdFx0dHJlZS5zZXRDaGlsZHJlbihudWxsLCBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRlbGVtZW50OiAwLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMCB9LFxuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMSB9LFxuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMiB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0eyBlbGVtZW50OiAxIH0sXG5cdFx0XHRcdHsgZWxlbWVudDogMiB9XG5cdFx0XHRdKTtcblxuXHRcdFx0Y29uc3QgbmF2aWdhdG9yID0gdHJlZS5uYXZpZ2F0ZSgpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLmN1cnJlbnQoKSwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLm5leHQoKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLmN1cnJlbnQoKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLm5leHQoKSwgMTApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5jdXJyZW50KCksIDEwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IubmV4dCgpLCAxMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLmN1cnJlbnQoKSwgMTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5uZXh0KCksIDEyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IuY3VycmVudCgpLCAxMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLm5leHQoKSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLmN1cnJlbnQoKSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLm5leHQoKSwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLmN1cnJlbnQoKSwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLnByZXZpb3VzKCksIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5jdXJyZW50KCksIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5wcmV2aW91cygpLCAxMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLnByZXZpb3VzKCksIDExKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IucHJldmlvdXMoKSwgMTApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5wcmV2aW91cygpLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IucHJldmlvdXMoKSwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLm5leHQoKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLm5leHQoKSwgMTApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5maXJzdCgpLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IubGFzdCgpLCAyKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBza2lwIGNvbGxhcHNlZCBub2RlcycsICgpID0+IHtcblx0XHRcdHRyZWUuc2V0Q2hpbGRyZW4obnVsbCwgW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWxlbWVudDogMCwgY29sbGFwc2VkOiB0cnVlLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMCB9LFxuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMSB9LFxuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMiB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0eyBlbGVtZW50OiAxIH0sXG5cdFx0XHRcdHsgZWxlbWVudDogMiB9XG5cdFx0XHRdKTtcblxuXHRcdFx0Y29uc3QgbmF2aWdhdG9yID0gdHJlZS5uYXZpZ2F0ZSgpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLmN1cnJlbnQoKSwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLm5leHQoKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLm5leHQoKSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLm5leHQoKSwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLm5leHQoKSwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLnByZXZpb3VzKCksIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5wcmV2aW91cygpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IucHJldmlvdXMoKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLnByZXZpb3VzKCksIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5uZXh0KCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5maXJzdCgpLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IubGFzdCgpLCAyKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBza2lwIGZpbHRlcmVkIGVsZW1lbnRzJywgKCkgPT4ge1xuXHRcdFx0ZmlsdGVyID0gZWwgPT4gZWwgJSAyID09PSAwO1xuXG5cdFx0XHR0cmVlLnNldENoaWxkcmVuKG51bGwsIFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGVsZW1lbnQ6IDAsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDEwIH0sXG5cdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExIH0sXG5cdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDEyIH0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7IGVsZW1lbnQ6IDEgfSxcblx0XHRcdFx0eyBlbGVtZW50OiAyIH1cblx0XHRcdF0pO1xuXG5cdFx0XHRjb25zdCBuYXZpZ2F0b3IgPSB0cmVlLm5hdmlnYXRlKCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IuY3VycmVudCgpLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IubmV4dCgpLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IubmV4dCgpLCAxMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLm5leHQoKSwgMTIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5uZXh0KCksIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5uZXh0KCksIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5wcmV2aW91cygpLCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IucHJldmlvdXMoKSwgMTIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5wcmV2aW91cygpLCAxMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLnByZXZpb3VzKCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5wcmV2aW91cygpLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IubmV4dCgpLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IubmV4dCgpLCAxMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLmZpcnN0KCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5sYXN0KCksIDIpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGJlIGFibGUgdG8gc3RhcnQgZnJvbSBub2RlJywgKCkgPT4ge1xuXHRcdFx0dHJlZS5zZXRDaGlsZHJlbihudWxsLCBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRlbGVtZW50OiAwLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMCB9LFxuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMSB9LFxuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMiB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0eyBlbGVtZW50OiAxIH0sXG5cdFx0XHRcdHsgZWxlbWVudDogMiB9XG5cdFx0XHRdKTtcblxuXHRcdFx0Y29uc3QgbmF2aWdhdG9yID0gdHJlZS5uYXZpZ2F0ZSgxKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5jdXJyZW50KCksIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5uZXh0KCksIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5jdXJyZW50KCksIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5wcmV2aW91cygpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IuY3VycmVudCgpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IucHJldmlvdXMoKSwgMTIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5wcmV2aW91cygpLCAxMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLnByZXZpb3VzKCksIDEwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IucHJldmlvdXMoKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLnByZXZpb3VzKCksIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5uZXh0KCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5hdmlnYXRvci5uZXh0KCksIDEwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYXZpZ2F0b3IuZmlyc3QoKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmF2aWdhdG9yLmxhc3QoKSwgMik7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdGNsYXNzIERlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8bnVtYmVyPiB7XG5cdFx0Z2V0SGVpZ2h0KCkgeyByZXR1cm4gMjA7IH1cblx0XHRnZXRUZW1wbGF0ZUlkKCk6IHN0cmluZyB7IHJldHVybiAnZGVmYXVsdCc7IH1cblx0fVxuXG5cdGNsYXNzIFJlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxudW1iZXIsIHZvaWQsIEhUTUxFbGVtZW50PiB7XG5cdFx0cmVhZG9ubHkgdGVtcGxhdGVJZCA9ICdkZWZhdWx0Jztcblx0XHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQge1xuXHRcdFx0cmV0dXJuIGNvbnRhaW5lcjtcblx0XHR9XG5cdFx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8bnVtYmVyLCB2b2lkPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdFx0dGVtcGxhdGVEYXRhLnRleHRDb250ZW50ID0gYCR7ZWxlbWVudC5lbGVtZW50fWA7XG5cdFx0fVxuXHRcdGRpc3Bvc2VUZW1wbGF0ZSgpOiB2b2lkIHsgfVxuXHR9XG5cblx0Y2xhc3MgSWRlbnRpdHlQcm92aWRlciBpbXBsZW1lbnRzIElJZGVudGl0eVByb3ZpZGVyPG51bWJlcj4ge1xuXHRcdGdldElkKGVsZW1lbnQ6IG51bWJlcik6IHsgdG9TdHJpbmcoKTogc3RyaW5nIH0ge1xuXHRcdFx0cmV0dXJuIGAke2VsZW1lbnQgJSAxMDB9YDtcblx0XHR9XG5cdH1cblxuXHR0ZXN0KCd0cmFpdHMgYXJlIHByZXNlcnZlZCBhY2NvcmRpbmcgdG8gc3RyaW5nIGlkZW50aXR5JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnRhaW5lci5zdHlsZS53aWR0aCA9ICcyMDBweCc7XG5cdFx0Y29udGFpbmVyLnN0eWxlLmhlaWdodCA9ICcyMDBweCc7XG5cblx0XHRjb25zdCBkZWxlZ2F0ZSA9IG5ldyBEZWxlZ2F0ZSgpO1xuXHRcdGNvbnN0IHJlbmRlcmVyID0gbmV3IFJlbmRlcmVyKCk7XG5cdFx0Y29uc3QgaWRlbnRpdHlQcm92aWRlciA9IG5ldyBJZGVudGl0eVByb3ZpZGVyKCk7XG5cblx0XHRjb25zdCB0cmVlID0gbmV3IE9iamVjdFRyZWU8bnVtYmVyPigndGVzdCcsIGNvbnRhaW5lciwgZGVsZWdhdGUsIFtyZW5kZXJlcl0sIHsgaWRlbnRpdHlQcm92aWRlciB9KTtcblx0XHR0cmVlLmxheW91dCgyMDApO1xuXG5cdFx0dHJlZS5zZXRDaGlsZHJlbihudWxsLCBbeyBlbGVtZW50OiAwIH0sIHsgZWxlbWVudDogMSB9LCB7IGVsZW1lbnQ6IDIgfSwgeyBlbGVtZW50OiAzIH1dKTtcblx0XHR0cmVlLnNldEZvY3VzKFsxXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0cmVlLmdldEZvY3VzKCksIFsxXSk7XG5cblx0XHR0cmVlLnNldENoaWxkcmVuKG51bGwsIFt7IGVsZW1lbnQ6IDEwMCB9LCB7IGVsZW1lbnQ6IDEwMSB9LCB7IGVsZW1lbnQ6IDEwMiB9LCB7IGVsZW1lbnQ6IDEwMyB9XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0cmVlLmdldEZvY3VzKCksIFsxMDFdKTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ0NvbXByZXNzaWJsZU9iamVjdFRyZWUnLCBmdW5jdGlvbiAoKSB7XG5cblx0Y2xhc3MgRGVsZWdhdGUgaW1wbGVtZW50cyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxudW1iZXI+IHtcblx0XHRnZXRIZWlnaHQoKSB7IHJldHVybiAyMDsgfVxuXHRcdGdldFRlbXBsYXRlSWQoKTogc3RyaW5nIHsgcmV0dXJuICdkZWZhdWx0JzsgfVxuXHR9XG5cblx0Y2xhc3MgUmVuZGVyZXIgaW1wbGVtZW50cyBJQ29tcHJlc3NpYmxlVHJlZVJlbmRlcmVyPG51bWJlciwgdm9pZCwgSFRNTEVsZW1lbnQ+IHtcblx0XHRyZWFkb25seSB0ZW1wbGF0ZUlkID0gJ2RlZmF1bHQnO1xuXHRcdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB7XG5cdFx0XHRyZXR1cm4gY29udGFpbmVyO1xuXHRcdH1cblx0XHRyZW5kZXJFbGVtZW50KG5vZGU6IElUcmVlTm9kZTxudW1iZXIsIHZvaWQ+LCBfOiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRcdHRlbXBsYXRlRGF0YS50ZXh0Q29udGVudCA9IGAke25vZGUuZWxlbWVudH1gO1xuXHRcdH1cblx0XHRyZW5kZXJDb21wcmVzc2VkRWxlbWVudHMobm9kZTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8bnVtYmVyPiwgdm9pZD4sIF86IG51bWJlciwgdGVtcGxhdGVEYXRhOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdFx0dGVtcGxhdGVEYXRhLnRleHRDb250ZW50ID0gYCR7bm9kZS5lbGVtZW50LmVsZW1lbnRzLmpvaW4oJy8nKX1gO1xuXHRcdH1cblx0XHRkaXNwb3NlVGVtcGxhdGUoKTogdm9pZCB7IH1cblx0fVxuXG5cdGNvbnN0IGRzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnZW1wdHknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29udGFpbmVyLnN0eWxlLndpZHRoID0gJzIwMHB4Jztcblx0XHRjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gJzIwMHB4JztcblxuXHRcdGNvbnN0IHRyZWUgPSBkcy5hZGQobmV3IENvbXByZXNzaWJsZU9iamVjdFRyZWU8bnVtYmVyPigndGVzdCcsIGNvbnRhaW5lciwgbmV3IERlbGVnYXRlKCksIFtuZXcgUmVuZGVyZXIoKV0pKTtcblx0XHR0cmVlLmxheW91dCgyMDApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFJvd3NUZXh0Q29udGVudChjb250YWluZXIpLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NpbXBsZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb250YWluZXIuc3R5bGUud2lkdGggPSAnMjAwcHgnO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSAnMjAwcHgnO1xuXG5cdFx0Y29uc3QgdHJlZSA9IGRzLmFkZChuZXcgQ29tcHJlc3NpYmxlT2JqZWN0VHJlZTxudW1iZXI+KCd0ZXN0JywgY29udGFpbmVyLCBuZXcgRGVsZWdhdGUoKSwgW25ldyBSZW5kZXJlcigpXSkpO1xuXHRcdHRyZWUubGF5b3V0KDIwMCk7XG5cblx0XHR0cmVlLnNldENoaWxkcmVuKG51bGwsIFtcblx0XHRcdHtcblx0XHRcdFx0ZWxlbWVudDogMCwgY2hpbGRyZW46IFtcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDEwIH0sXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAxMSB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogMTIgfSxcblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRcdHsgZWxlbWVudDogMSB9LFxuXHRcdFx0eyBlbGVtZW50OiAyIH1cblx0XHRdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0Um93c1RleHRDb250ZW50KGNvbnRhaW5lciksIFsnMCcsICcxMCcsICcxMScsICcxMicsICcxJywgJzInXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbXByZXNzZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29udGFpbmVyLnN0eWxlLndpZHRoID0gJzIwMHB4Jztcblx0XHRjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gJzIwMHB4JztcblxuXHRcdGNvbnN0IHRyZWUgPSBkcy5hZGQobmV3IENvbXByZXNzaWJsZU9iamVjdFRyZWU8bnVtYmVyPigndGVzdCcsIGNvbnRhaW5lciwgbmV3IERlbGVnYXRlKCksIFtuZXcgUmVuZGVyZXIoKV0pKTtcblx0XHR0cmVlLmxheW91dCgyMDApO1xuXG5cdFx0dHJlZS5zZXRDaGlsZHJlbihudWxsLCBbXG5cdFx0XHR7XG5cdFx0XHRcdGVsZW1lbnQ6IDEsIGNoaWxkcmVuOiBbe1xuXHRcdFx0XHRcdGVsZW1lbnQ6IDExLCBjaGlsZHJlbjogW3tcblx0XHRcdFx0XHRcdGVsZW1lbnQ6IDExMSwgY2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMTExIH0sXG5cdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogMTExMiB9LFxuXHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExMTMgfSxcblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9XVxuXHRcdFx0fVxuXHRcdF0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSb3dzVGV4dENvbnRlbnQoY29udGFpbmVyKSwgWycxLzExLzExMScsICcxMTExJywgJzExMTInLCAnMTExMyddKTtcblxuXHRcdHRyZWUuc2V0Q2hpbGRyZW4oMTEsIFtcblx0XHRcdHsgZWxlbWVudDogMTExIH0sXG5cdFx0XHR7IGVsZW1lbnQ6IDExMiB9LFxuXHRcdFx0eyBlbGVtZW50OiAxMTMgfSxcblx0XHRdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0Um93c1RleHRDb250ZW50KGNvbnRhaW5lciksIFsnMS8xMScsICcxMTEnLCAnMTEyJywgJzExMyddKTtcblxuXHRcdHRyZWUuc2V0Q2hpbGRyZW4oMTEzLCBbXG5cdFx0XHR7IGVsZW1lbnQ6IDExMzEgfVxuXHRcdF0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSb3dzVGV4dENvbnRlbnQoY29udGFpbmVyKSwgWycxLzExJywgJzExMScsICcxMTInLCAnMTEzLzExMzEnXSk7XG5cblx0XHR0cmVlLnNldENoaWxkcmVuKDExMzEsIFtcblx0XHRcdHsgZWxlbWVudDogMTEzMiB9XG5cdFx0XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldFJvd3NUZXh0Q29udGVudChjb250YWluZXIpLCBbJzEvMTEnLCAnMTExJywgJzExMicsICcxMTMvMTEzMS8xMTMyJ10pO1xuXG5cdFx0dHJlZS5zZXRDaGlsZHJlbigxMTMxLCBbXG5cdFx0XHR7IGVsZW1lbnQ6IDExMzIgfSxcblx0XHRcdHsgZWxlbWVudDogMTEzMyB9LFxuXHRcdF0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSb3dzVGV4dENvbnRlbnQoY29udGFpbmVyKSwgWycxLzExJywgJzExMScsICcxMTInLCAnMTEzLzExMzEnLCAnMTEzMicsICcxMTMzJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdlbmFibGVDb21wcmVzc2lvbicsICgpID0+IHtcblx0XHRjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb250YWluZXIuc3R5bGUud2lkdGggPSAnMjAwcHgnO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSAnMjAwcHgnO1xuXG5cdFx0Y29uc3QgdHJlZSA9IGRzLmFkZChuZXcgQ29tcHJlc3NpYmxlT2JqZWN0VHJlZTxudW1iZXI+KCd0ZXN0JywgY29udGFpbmVyLCBuZXcgRGVsZWdhdGUoKSwgW25ldyBSZW5kZXJlcigpXSkpO1xuXHRcdHRyZWUubGF5b3V0KDIwMCk7XG5cblx0XHR0cmVlLnNldENoaWxkcmVuKG51bGwsIFtcblx0XHRcdHtcblx0XHRcdFx0ZWxlbWVudDogMSwgY2hpbGRyZW46IFt7XG5cdFx0XHRcdFx0ZWxlbWVudDogMTEsIGNoaWxkcmVuOiBbe1xuXHRcdFx0XHRcdFx0ZWxlbWVudDogMTExLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExMTEgfSxcblx0XHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMTEyIH0sXG5cdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogMTExMyB9LFxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH1dXG5cdFx0XHR9XG5cdFx0XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldFJvd3NUZXh0Q29udGVudChjb250YWluZXIpLCBbJzEvMTEvMTExJywgJzExMTEnLCAnMTExMicsICcxMTEzJ10pO1xuXG5cdFx0dHJlZS51cGRhdGVPcHRpb25zKHsgY29tcHJlc3Npb25FbmFibGVkOiBmYWxzZSB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldFJvd3NUZXh0Q29udGVudChjb250YWluZXIpLCBbJzEnLCAnMTEnLCAnMTExJywgJzExMTEnLCAnMTExMicsICcxMTEzJ10pO1xuXG5cdFx0dHJlZS51cGRhdGVPcHRpb25zKHsgY29tcHJlc3Npb25FbmFibGVkOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0Um93c1RleHRDb250ZW50KGNvbnRhaW5lciksIFsnMS8xMS8xMTEnLCAnMTExMScsICcxMTEyJywgJzExMTMnXSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFHbkIsU0FBUyx3QkFBbUQsa0JBQWtCO0FBRTlFLFNBQVMsK0NBQStDO0FBRXhELFNBQVMsbUJBQW1CLFdBQWtDO0FBQzdELFFBQU0sT0FBTyxDQUFDLEdBQUcsVUFBVSxpQkFBaUIsa0JBQWtCLENBQUM7QUFDL0Qs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dkMsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLENBQUM7QUFBQSxJQUN2QyxDQUFDO0FBRUQsU0FBSyxpQ0FBaUMsTUFBTTtBQUMzQyxlQUFTLFFBQU0sS0FBSyxNQUFNO0FBRTFCLFdBQUssWUFBWSxNQUFNO0FBQUEsUUFDdEI7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUFHLFVBQVU7QUFBQSxZQUNyQixFQUFFLFNBQVMsR0FBRztBQUFBLFlBQ2QsRUFBRSxTQUFTLEdBQUc7QUFBQSxZQUNkLEVBQUUsU0FBUyxHQUFHO0FBQUEsVUFDZjtBQUFBLFFBQ0Q7QUFBQSxRQUNBLEVBQUUsU0FBUyxFQUFFO0FBQUEsUUFDYixFQUFFLFNBQVMsRUFBRTtBQUFBLE1BQ2QsQ0FBQztBQUVELFlBQU0sWUFBWSxLQUFLLFNBQVM7QUFFaEMsYUFBTyxZQUFZLFVBQVUsUUFBUSxHQUFHLElBQUk7QUFDNUMsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLENBQUM7QUFDdEMsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLEVBQUU7QUFDdkMsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLEVBQUU7QUFDdkMsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLENBQUM7QUFDdEMsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLElBQUk7QUFDekMsYUFBTyxZQUFZLFVBQVUsU0FBUyxHQUFHLENBQUM7QUFDMUMsYUFBTyxZQUFZLFVBQVUsU0FBUyxHQUFHLEVBQUU7QUFDM0MsYUFBTyxZQUFZLFVBQVUsU0FBUyxHQUFHLEVBQUU7QUFDM0MsYUFBTyxZQUFZLFVBQVUsU0FBUyxHQUFHLENBQUM7QUFDMUMsYUFBTyxZQUFZLFVBQVUsU0FBUyxHQUFHLElBQUk7QUFDN0MsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLENBQUM7QUFDdEMsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLEVBQUU7QUFDdkMsYUFBTyxZQUFZLFVBQVUsTUFBTSxHQUFHLENBQUM7QUFDdkMsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLENBQUM7QUFBQSxJQUN2QyxDQUFDO0FBRUQsU0FBSyxxQ0FBcUMsTUFBTTtBQUMvQyxXQUFLLFlBQVksTUFBTTtBQUFBLFFBQ3RCO0FBQUEsVUFDQyxTQUFTO0FBQUEsVUFBRyxVQUFVO0FBQUEsWUFDckIsRUFBRSxTQUFTLEdBQUc7QUFBQSxZQUNkLEVBQUUsU0FBUyxHQUFHO0FBQUEsWUFDZCxFQUFFLFNBQVMsR0FBRztBQUFBLFVBQ2Y7QUFBQSxRQUNEO0FBQUEsUUFDQSxFQUFFLFNBQVMsRUFBRTtBQUFBLFFBQ2IsRUFBRSxTQUFTLEVBQUU7QUFBQSxNQUNkLENBQUM7QUFFRCxZQUFNLFlBQVksS0FBSyxTQUFTLENBQUM7QUFFakMsYUFBTyxZQUFZLFVBQVUsUUFBUSxHQUFHLENBQUM7QUFDekMsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLENBQUM7QUFDdEMsYUFBTyxZQUFZLFVBQVUsUUFBUSxHQUFHLENBQUM7QUFDekMsYUFBTyxZQUFZLFVBQVUsU0FBUyxHQUFHLENBQUM7QUFDMUMsYUFBTyxZQUFZLFVBQVUsUUFBUSxHQUFHLENBQUM7QUFDekMsYUFBTyxZQUFZLFVBQVUsU0FBUyxHQUFHLEVBQUU7QUFDM0MsYUFBTyxZQUFZLFVBQVUsU0FBUyxHQUFHLEVBQUU7QUFDM0MsYUFBTyxZQUFZLFVBQVUsU0FBUyxHQUFHLEVBQUU7QUFDM0MsYUFBTyxZQUFZLFVBQVUsU0FBUyxHQUFHLENBQUM7QUFDMUMsYUFBTyxZQUFZLFVBQVUsU0FBUyxHQUFHLElBQUk7QUFDN0MsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLENBQUM7QUFDdEMsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLEVBQUU7QUFDdkMsYUFBTyxZQUFZLFVBQVUsTUFBTSxHQUFHLENBQUM7QUFDdkMsYUFBTyxZQUFZLFVBQVUsS0FBSyxHQUFHLENBQUM7QUFBQSxJQUN2QyxDQUFDO0FBQUEsRUFDRixDQUFDO0FBQUEsRUFFRCxNQUFNLFNBQWlEO0FBQUEsSUFDdEQsWUFBWTtBQUFFLGFBQU87QUFBQSxJQUFJO0FBQUEsSUFDekIsZ0JBQXdCO0FBQUUsYUFBTztBQUFBLElBQVc7QUFBQSxFQUM3QztBQUFBLEVBRUEsTUFBTSxTQUE2RDtBQUFBLElBQW5FO0FBQ0MsV0FBUyxhQUFhO0FBQUE7QUFBQSxJQUN0QixlQUFlLFdBQXFDO0FBQ25ELGFBQU87QUFBQSxJQUNSO0FBQUEsSUFDQSxjQUFjLFNBQWtDLE9BQWUsY0FBaUM7QUFDL0YsbUJBQWEsY0FBYyxHQUFHLFFBQVEsT0FBTztBQUFBLElBQzlDO0FBQUEsSUFDQSxrQkFBd0I7QUFBQSxJQUFFO0FBQUEsRUFDM0I7QUFBQSxFQUVBLE1BQU0saUJBQXNEO0FBQUEsSUFDM0QsTUFBTSxTQUF5QztBQUM5QyxhQUFPLEdBQUcsVUFBVSxHQUFHO0FBQUEsSUFDeEI7QUFBQSxFQUNEO0FBRUEsT0FBSyxxREFBcUQsV0FBWTtBQUNyRSxVQUFNLFlBQVksU0FBUyxjQUFjLEtBQUs7QUFDOUMsY0FBVSxNQUFNLFFBQVE7QUFDeEIsY0FBVSxNQUFNLFNBQVM7QUFFekIsVUFBTSxXQUFXLElBQUksU0FBUztBQUM5QixVQUFNLFdBQVcsSUFBSSxTQUFTO0FBQzlCLFVBQU0sbUJBQW1CLElBQUksaUJBQWlCO0FBRTlDLFVBQU0sT0FBTyxJQUFJLFdBQW1CLFFBQVEsV0FBVyxVQUFVLENBQUMsUUFBUSxHQUFHLEVBQUUsaUJBQWlCLENBQUM7QUFDakcsU0FBSyxPQUFPLEdBQUc7QUFFZixTQUFLLFlBQVksTUFBTSxDQUFDLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztBQUN2RixTQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDakIsV0FBTyxnQkFBZ0IsS0FBSyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFFM0MsU0FBSyxZQUFZLE1BQU0sQ0FBQyxFQUFFLFNBQVMsSUFBSSxHQUFHLEVBQUUsU0FBUyxJQUFJLEdBQUcsRUFBRSxTQUFTLElBQUksR0FBRyxFQUFFLFNBQVMsSUFBSSxDQUFDLENBQUM7QUFDL0YsV0FBTyxnQkFBZ0IsS0FBSyxTQUFTLEdBQUcsQ0FBQyxHQUFHLENBQUM7QUFBQSxFQUM5QyxDQUFDO0FBQ0YsQ0FBQztBQUVELE1BQU0sMEJBQTBCLFdBQVk7QUFBQSxFQUUzQyxNQUFNLFNBQWlEO0FBQUEsSUFDdEQsWUFBWTtBQUFFLGFBQU87QUFBQSxJQUFJO0FBQUEsSUFDekIsZ0JBQXdCO0FBQUUsYUFBTztBQUFBLElBQVc7QUFBQSxFQUM3QztBQUFBLEVBRUEsTUFBTSxTQUF5RTtBQUFBLElBQS9FO0FBQ0MsV0FBUyxhQUFhO0FBQUE7QUFBQSxJQUN0QixlQUFlLFdBQXFDO0FBQ25ELGFBQU87QUFBQSxJQUNSO0FBQUEsSUFDQSxjQUFjLE1BQStCLEdBQVcsY0FBaUM7QUFDeEYsbUJBQWEsY0FBYyxHQUFHLEtBQUssT0FBTztBQUFBLElBQzNDO0FBQUEsSUFDQSx5QkFBeUIsTUFBb0QsR0FBVyxjQUFpQztBQUN4SCxtQkFBYSxjQUFjLEdBQUcsS0FBSyxRQUFRLFNBQVMsS0FBSyxHQUFHLENBQUM7QUFBQSxJQUM5RDtBQUFBLElBQ0Esa0JBQXdCO0FBQUEsSUFBRTtBQUFBLEVBQzNCO0FBRUEsUUFBTSxLQUFLLHdDQUF3QztBQUVuRCxPQUFLLFNBQVMsV0FBWTtBQUN6QixVQUFNLFlBQVksU0FBUyxjQUFjLEtBQUs7QUFDOUMsY0FBVSxNQUFNLFFBQVE7QUFDeEIsY0FBVSxNQUFNLFNBQVM7QUFFekIsVUFBTSxPQUFPLEdBQUcsSUFBSSxJQUFJLHVCQUErQixRQUFRLFdBQVcsSUFBSSxTQUFTLEdBQUcsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDM0csU0FBSyxPQUFPLEdBQUc7QUFFZixXQUFPLFlBQVksbUJBQW1CLFNBQVMsRUFBRSxRQUFRLENBQUM7QUFBQSxFQUMzRCxDQUFDO0FBRUQsT0FBSyxVQUFVLFdBQVk7QUFDMUIsVUFBTSxZQUFZLFNBQVMsY0FBYyxLQUFLO0FBQzlDLGNBQVUsTUFBTSxRQUFRO0FBQ3hCLGNBQVUsTUFBTSxTQUFTO0FBRXpCLFVBQU0sT0FBTyxHQUFHLElBQUksSUFBSSx1QkFBK0IsUUFBUSxXQUFXLElBQUksU0FBUyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQzNHLFNBQUssT0FBTyxHQUFHO0FBRWYsU0FBSyxZQUFZLE1BQU07QUFBQSxNQUN0QjtBQUFBLFFBQ0MsU0FBUztBQUFBLFFBQUcsVUFBVTtBQUFBLFVBQ3JCLEVBQUUsU0FBUyxHQUFHO0FBQUEsVUFDZCxFQUFFLFNBQVMsR0FBRztBQUFBLFVBQ2QsRUFBRSxTQUFTLEdBQUc7QUFBQSxRQUNmO0FBQUEsTUFDRDtBQUFBLE1BQ0EsRUFBRSxTQUFTLEVBQUU7QUFBQSxNQUNiLEVBQUUsU0FBUyxFQUFFO0FBQUEsSUFDZCxDQUFDO0FBRUQsV0FBTyxnQkFBZ0IsbUJBQW1CLFNBQVMsR0FBRyxDQUFDLEtBQUssTUFBTSxNQUFNLE1BQU0sS0FBSyxHQUFHLENBQUM7QUFBQSxFQUN4RixDQUFDO0FBRUQsT0FBSyxjQUFjLE1BQU07QUFDeEIsVUFBTSxZQUFZLFNBQVMsY0FBYyxLQUFLO0FBQzlDLGNBQVUsTUFBTSxRQUFRO0FBQ3hCLGNBQVUsTUFBTSxTQUFTO0FBRXpCLFVBQU0sT0FBTyxHQUFHLElBQUksSUFBSSx1QkFBK0IsUUFBUSxXQUFXLElBQUksU0FBUyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQzNHLFNBQUssT0FBTyxHQUFHO0FBRWYsU0FBSyxZQUFZLE1BQU07QUFBQSxNQUN0QjtBQUFBLFFBQ0MsU0FBUztBQUFBLFFBQUcsVUFBVSxDQUFDO0FBQUEsVUFDdEIsU0FBUztBQUFBLFVBQUksVUFBVSxDQUFDO0FBQUEsWUFDdkIsU0FBUztBQUFBLFlBQUssVUFBVTtBQUFBLGNBQ3ZCLEVBQUUsU0FBUyxLQUFLO0FBQUEsY0FDaEIsRUFBRSxTQUFTLEtBQUs7QUFBQSxjQUNoQixFQUFFLFNBQVMsS0FBSztBQUFBLFlBQ2pCO0FBQUEsVUFDRCxDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDRjtBQUFBLElBQ0QsQ0FBQztBQUVELFdBQU8sZ0JBQWdCLG1CQUFtQixTQUFTLEdBQUcsQ0FBQyxZQUFZLFFBQVEsUUFBUSxNQUFNLENBQUM7QUFFMUYsU0FBSyxZQUFZLElBQUk7QUFBQSxNQUNwQixFQUFFLFNBQVMsSUFBSTtBQUFBLE1BQ2YsRUFBRSxTQUFTLElBQUk7QUFBQSxNQUNmLEVBQUUsU0FBUyxJQUFJO0FBQUEsSUFDaEIsQ0FBQztBQUVELFdBQU8sZ0JBQWdCLG1CQUFtQixTQUFTLEdBQUcsQ0FBQyxRQUFRLE9BQU8sT0FBTyxLQUFLLENBQUM7QUFFbkYsU0FBSyxZQUFZLEtBQUs7QUFBQSxNQUNyQixFQUFFLFNBQVMsS0FBSztBQUFBLElBQ2pCLENBQUM7QUFFRCxXQUFPLGdCQUFnQixtQkFBbUIsU0FBUyxHQUFHLENBQUMsUUFBUSxPQUFPLE9BQU8sVUFBVSxDQUFDO0FBRXhGLFNBQUssWUFBWSxNQUFNO0FBQUEsTUFDdEIsRUFBRSxTQUFTLEtBQUs7QUFBQSxJQUNqQixDQUFDO0FBRUQsV0FBTyxnQkFBZ0IsbUJBQW1CLFNBQVMsR0FBRyxDQUFDLFFBQVEsT0FBTyxPQUFPLGVBQWUsQ0FBQztBQUU3RixTQUFLLFlBQVksTUFBTTtBQUFBLE1BQ3RCLEVBQUUsU0FBUyxLQUFLO0FBQUEsTUFDaEIsRUFBRSxTQUFTLEtBQUs7QUFBQSxJQUNqQixDQUFDO0FBRUQsV0FBTyxnQkFBZ0IsbUJBQW1CLFNBQVMsR0FBRyxDQUFDLFFBQVEsT0FBTyxPQUFPLFlBQVksUUFBUSxNQUFNLENBQUM7QUFBQSxFQUN6RyxDQUFDO0FBRUQsT0FBSyxxQkFBcUIsTUFBTTtBQUMvQixVQUFNLFlBQVksU0FBUyxjQUFjLEtBQUs7QUFDOUMsY0FBVSxNQUFNLFFBQVE7QUFDeEIsY0FBVSxNQUFNLFNBQVM7QUFFekIsVUFBTSxPQUFPLEdBQUcsSUFBSSxJQUFJLHVCQUErQixRQUFRLFdBQVcsSUFBSSxTQUFTLEdBQUcsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDM0csU0FBSyxPQUFPLEdBQUc7QUFFZixTQUFLLFlBQVksTUFBTTtBQUFBLE1BQ3RCO0FBQUEsUUFDQyxTQUFTO0FBQUEsUUFBRyxVQUFVLENBQUM7QUFBQSxVQUN0QixTQUFTO0FBQUEsVUFBSSxVQUFVLENBQUM7QUFBQSxZQUN2QixTQUFTO0FBQUEsWUFBSyxVQUFVO0FBQUEsY0FDdkIsRUFBRSxTQUFTLEtBQUs7QUFBQSxjQUNoQixFQUFFLFNBQVMsS0FBSztBQUFBLGNBQ2hCLEVBQUUsU0FBUyxLQUFLO0FBQUEsWUFDakI7QUFBQSxVQUNELENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRCxDQUFDO0FBRUQsV0FBTyxnQkFBZ0IsbUJBQW1CLFNBQVMsR0FBRyxDQUFDLFlBQVksUUFBUSxRQUFRLE1BQU0sQ0FBQztBQUUxRixTQUFLLGNBQWMsRUFBRSxvQkFBb0IsTUFBTSxDQUFDO0FBQ2hELFdBQU8sZ0JBQWdCLG1CQUFtQixTQUFTLEdBQUcsQ0FBQyxLQUFLLE1BQU0sT0FBTyxRQUFRLFFBQVEsTUFBTSxDQUFDO0FBRWhHLFNBQUssY0FBYyxFQUFFLG9CQUFvQixLQUFLLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsbUJBQW1CLFNBQVMsR0FBRyxDQUFDLFlBQVksUUFBUSxRQUFRLE1BQU0sQ0FBQztBQUFBLEVBQzNGLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJjb250YWluZXIiXQp9Cg==
