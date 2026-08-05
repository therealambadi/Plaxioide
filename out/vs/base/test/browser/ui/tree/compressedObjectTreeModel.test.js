import assert from "assert";
import { compress, CompressedObjectTreeModel, decompress } from "../../../../browser/ui/tree/compressedObjectTreeModel.js";
import { Iterable } from "../../../../common/iterator.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../common/utils.js";
function resolve(treeElement) {
  const result = { element: treeElement.element };
  const children = Array.from(Iterable.from(treeElement.children), resolve);
  if (treeElement.incompressible) {
    result.incompressible = true;
  }
  if (children.length > 0) {
    result.children = children;
  }
  return result;
}
suite("CompressedObjectTree", function() {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("compress & decompress", function() {
    test("small", function() {
      const decompressed = { element: 1 };
      const compressed = { element: { elements: [1], incompressible: false } };
      assert.deepStrictEqual(resolve(compress(decompressed)), compressed);
      assert.deepStrictEqual(resolve(decompress(compressed)), decompressed);
    });
    test("no compression", function() {
      const decompressed = {
        element: 1,
        children: [
          { element: 11 },
          { element: 12 },
          { element: 13 }
        ]
      };
      const compressed = {
        element: { elements: [1], incompressible: false },
        children: [
          { element: { elements: [11], incompressible: false } },
          { element: { elements: [12], incompressible: false } },
          { element: { elements: [13], incompressible: false } }
        ]
      };
      assert.deepStrictEqual(resolve(compress(decompressed)), compressed);
      assert.deepStrictEqual(resolve(decompress(compressed)), decompressed);
    });
    test("single hierarchy", function() {
      const decompressed = {
        element: 1,
        children: [
          {
            element: 11,
            children: [
              {
                element: 111,
                children: [
                  { element: 1111 }
                ]
              }
            ]
          }
        ]
      };
      const compressed = {
        element: { elements: [1, 11, 111, 1111], incompressible: false }
      };
      assert.deepStrictEqual(resolve(compress(decompressed)), compressed);
      assert.deepStrictEqual(resolve(decompress(compressed)), decompressed);
    });
    test("deep compression", function() {
      const decompressed = {
        element: 1,
        children: [
          {
            element: 11,
            children: [
              {
                element: 111,
                children: [
                  { element: 1111 },
                  { element: 1112 },
                  { element: 1113 },
                  { element: 1114 }
                ]
              }
            ]
          }
        ]
      };
      const compressed = {
        element: { elements: [1, 11, 111], incompressible: false },
        children: [
          { element: { elements: [1111], incompressible: false } },
          { element: { elements: [1112], incompressible: false } },
          { element: { elements: [1113], incompressible: false } },
          { element: { elements: [1114], incompressible: false } }
        ]
      };
      assert.deepStrictEqual(resolve(compress(decompressed)), compressed);
      assert.deepStrictEqual(resolve(decompress(compressed)), decompressed);
    });
    test("double deep compression", function() {
      const decompressed = {
        element: 1,
        children: [
          {
            element: 11,
            children: [
              {
                element: 111,
                children: [
                  { element: 1112 },
                  { element: 1113 }
                ]
              }
            ]
          },
          {
            element: 12,
            children: [
              {
                element: 121,
                children: [
                  { element: 1212 },
                  { element: 1213 }
                ]
              }
            ]
          }
        ]
      };
      const compressed = {
        element: { elements: [1], incompressible: false },
        children: [
          {
            element: { elements: [11, 111], incompressible: false },
            children: [
              { element: { elements: [1112], incompressible: false } },
              { element: { elements: [1113], incompressible: false } }
            ]
          },
          {
            element: { elements: [12, 121], incompressible: false },
            children: [
              { element: { elements: [1212], incompressible: false } },
              { element: { elements: [1213], incompressible: false } }
            ]
          }
        ]
      };
      assert.deepStrictEqual(resolve(compress(decompressed)), compressed);
      assert.deepStrictEqual(resolve(decompress(compressed)), decompressed);
    });
    test("incompressible leaf", function() {
      const decompressed = {
        element: 1,
        children: [
          {
            element: 11,
            children: [
              {
                element: 111,
                children: [
                  { element: 1111, incompressible: true }
                ]
              }
            ]
          }
        ]
      };
      const compressed = {
        element: { elements: [1, 11, 111], incompressible: false },
        children: [
          { element: { elements: [1111], incompressible: true } }
        ]
      };
      assert.deepStrictEqual(resolve(compress(decompressed)), compressed);
      assert.deepStrictEqual(resolve(decompress(compressed)), decompressed);
    });
    test("incompressible branch", function() {
      const decompressed = {
        element: 1,
        children: [
          {
            element: 11,
            children: [
              {
                element: 111,
                incompressible: true,
                children: [
                  { element: 1111 }
                ]
              }
            ]
          }
        ]
      };
      const compressed = {
        element: { elements: [1, 11], incompressible: false },
        children: [
          { element: { elements: [111, 1111], incompressible: true } }
        ]
      };
      assert.deepStrictEqual(resolve(compress(decompressed)), compressed);
      assert.deepStrictEqual(resolve(decompress(compressed)), decompressed);
    });
    test("incompressible chain", function() {
      const decompressed = {
        element: 1,
        children: [
          {
            element: 11,
            children: [
              {
                element: 111,
                incompressible: true,
                children: [
                  { element: 1111, incompressible: true }
                ]
              }
            ]
          }
        ]
      };
      const compressed = {
        element: { elements: [1, 11], incompressible: false },
        children: [
          {
            element: { elements: [111], incompressible: true },
            children: [
              { element: { elements: [1111], incompressible: true } }
            ]
          }
        ]
      };
      assert.deepStrictEqual(resolve(compress(decompressed)), compressed);
      assert.deepStrictEqual(resolve(decompress(compressed)), decompressed);
    });
    test("incompressible tree", function() {
      const decompressed = {
        element: 1,
        children: [
          {
            element: 11,
            incompressible: true,
            children: [
              {
                element: 111,
                incompressible: true,
                children: [
                  { element: 1111, incompressible: true }
                ]
              }
            ]
          }
        ]
      };
      const compressed = {
        element: { elements: [1], incompressible: false },
        children: [
          {
            element: { elements: [11], incompressible: true },
            children: [
              {
                element: { elements: [111], incompressible: true },
                children: [
                  { element: { elements: [1111], incompressible: true } }
                ]
              }
            ]
          }
        ]
      };
      assert.deepStrictEqual(resolve(compress(decompressed)), compressed);
      assert.deepStrictEqual(resolve(decompress(compressed)), decompressed);
    });
  });
  function bindListToModel(list, model) {
    return model.onDidSpliceRenderedNodes(({ start, deleteCount, elements }) => {
      list.splice(start, deleteCount, ...elements);
    });
  }
  function toArray(list) {
    return list.map((i) => i.element.elements);
  }
  suite("CompressedObjectTreeModel", function() {
    function withSmartSplice(fn) {
      fn({});
      fn({ diffIdentityProvider: { getId: (n) => String(n) } });
    }
    test("ctor", () => {
      const model = new CompressedObjectTreeModel("test");
      assert(model);
      assert.strictEqual(model.size, 0);
    });
    test("flat", () => withSmartSplice((options) => {
      const list = [];
      const model = new CompressedObjectTreeModel("test");
      const disposable = bindListToModel(list, model);
      model.setChildren(null, [
        { element: 0 },
        { element: 1 },
        { element: 2 }
      ], options);
      assert.deepStrictEqual(toArray(list), [[0], [1], [2]]);
      assert.strictEqual(model.size, 3);
      model.setChildren(null, [
        { element: 3 },
        { element: 4 },
        { element: 5 }
      ], options);
      assert.deepStrictEqual(toArray(list), [[3], [4], [5]]);
      assert.strictEqual(model.size, 3);
      model.setChildren(null, [], options);
      assert.deepStrictEqual(toArray(list), []);
      assert.strictEqual(model.size, 0);
      disposable.dispose();
    }));
    test("nested", () => withSmartSplice((options) => {
      const list = [];
      const model = new CompressedObjectTreeModel("test");
      const disposable = bindListToModel(list, model);
      model.setChildren(null, [
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
      ], options);
      assert.deepStrictEqual(toArray(list), [[0], [10], [11], [12], [1], [2]]);
      assert.strictEqual(model.size, 6);
      model.setChildren(12, [
        { element: 120 },
        { element: 121 }
      ], options);
      assert.deepStrictEqual(toArray(list), [[0], [10], [11], [12], [120], [121], [1], [2]]);
      assert.strictEqual(model.size, 8);
      model.setChildren(0, [], options);
      assert.deepStrictEqual(toArray(list), [[0], [1], [2]]);
      assert.strictEqual(model.size, 3);
      model.setChildren(null, [], options);
      assert.deepStrictEqual(toArray(list), []);
      assert.strictEqual(model.size, 0);
      disposable.dispose();
    }));
    test("compressed", () => withSmartSplice((options) => {
      const list = [];
      const model = new CompressedObjectTreeModel("test");
      const disposable = bindListToModel(list, model);
      model.setChildren(null, [
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
      ], options);
      assert.deepStrictEqual(toArray(list), [[1, 11, 111], [1111], [1112], [1113]]);
      assert.strictEqual(model.size, 6);
      model.setChildren(11, [
        { element: 111 },
        { element: 112 },
        { element: 113 }
      ], options);
      assert.deepStrictEqual(toArray(list), [[1, 11], [111], [112], [113]]);
      assert.strictEqual(model.size, 5);
      model.setChildren(113, [
        { element: 1131 }
      ], options);
      assert.deepStrictEqual(toArray(list), [[1, 11], [111], [112], [113, 1131]]);
      assert.strictEqual(model.size, 6);
      model.setChildren(1131, [
        { element: 1132 }
      ], options);
      assert.deepStrictEqual(toArray(list), [[1, 11], [111], [112], [113, 1131, 1132]]);
      assert.strictEqual(model.size, 7);
      model.setChildren(1131, [
        { element: 1132 },
        { element: 1133 }
      ], options);
      assert.deepStrictEqual(toArray(list), [[1, 11], [111], [112], [113, 1131], [1132], [1133]]);
      assert.strictEqual(model.size, 8);
      disposable.dispose();
    }));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvYnJvd3Nlci91aS90cmVlL2NvbXByZXNzZWRPYmplY3RUcmVlTW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGNvbXByZXNzLCBDb21wcmVzc2VkT2JqZWN0VHJlZU1vZGVsLCBkZWNvbXByZXNzLCBJQ29tcHJlc3NlZFRyZWVFbGVtZW50LCBJQ29tcHJlc3NlZFRyZWVOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci91aS90cmVlL2NvbXByZXNzZWRPYmplY3RUcmVlTW9kZWwuanMnO1xuaW1wb3J0IHsgSU9iamVjdFRyZWVNb2RlbFNldENoaWxkcmVuT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvdWkvdHJlZS9vYmplY3RUcmVlTW9kZWwuanMnO1xuaW1wb3J0IHsgSVRyZWVNb2RlbCwgSVRyZWVOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbmludGVyZmFjZSBJUmVzb2x2ZWRDb21wcmVzc2VkVHJlZUVsZW1lbnQ8VD4gZXh0ZW5kcyBJQ29tcHJlc3NlZFRyZWVFbGVtZW50PFQ+IHtcblx0cmVhZG9ubHkgZWxlbWVudDogVDtcblx0cmVhZG9ubHkgY2hpbGRyZW4/OiBJQ29tcHJlc3NlZFRyZWVFbGVtZW50PFQ+W107XG59XG5cbmZ1bmN0aW9uIHJlc29sdmU8VD4odHJlZUVsZW1lbnQ6IElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8VD4pOiBJUmVzb2x2ZWRDb21wcmVzc2VkVHJlZUVsZW1lbnQ8VD4ge1xuXHRjb25zdCByZXN1bHQ6IGFueSA9IHsgZWxlbWVudDogdHJlZUVsZW1lbnQuZWxlbWVudCB9O1xuXHRjb25zdCBjaGlsZHJlbiA9IEFycmF5LmZyb20oSXRlcmFibGUuZnJvbSh0cmVlRWxlbWVudC5jaGlsZHJlbiksIHJlc29sdmUpO1xuXG5cdGlmICh0cmVlRWxlbWVudC5pbmNvbXByZXNzaWJsZSkge1xuXHRcdHJlc3VsdC5pbmNvbXByZXNzaWJsZSA9IHRydWU7XG5cdH1cblxuXHRpZiAoY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuXHRcdHJlc3VsdC5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuc3VpdGUoJ0NvbXByZXNzZWRPYmplY3RUcmVlJywgZnVuY3Rpb24gKCkge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHN1aXRlKCdjb21wcmVzcyAmIGRlY29tcHJlc3MnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHR0ZXN0KCdzbWFsbCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IGRlY29tcHJlc3NlZDogSUNvbXByZXNzZWRUcmVlRWxlbWVudDxudW1iZXI+ID0geyBlbGVtZW50OiAxIH07XG5cdFx0XHRjb25zdCBjb21wcmVzc2VkOiBJUmVzb2x2ZWRDb21wcmVzc2VkVHJlZUVsZW1lbnQ8SUNvbXByZXNzZWRUcmVlTm9kZTxudW1iZXI+PiA9XG5cdFx0XHRcdHsgZWxlbWVudDogeyBlbGVtZW50czogWzFdLCBpbmNvbXByZXNzaWJsZTogZmFsc2UgfSB9O1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc29sdmUoY29tcHJlc3MoZGVjb21wcmVzc2VkKSksIGNvbXByZXNzZWQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXNvbHZlKGRlY29tcHJlc3MoY29tcHJlc3NlZCkpLCBkZWNvbXByZXNzZWQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbm8gY29tcHJlc3Npb24nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBkZWNvbXByZXNzZWQ6IElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8bnVtYmVyPiA9IHtcblx0XHRcdFx0ZWxlbWVudDogMSwgY2hpbGRyZW46IFtcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExIH0sXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAxMiB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogMTMgfVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBjb21wcmVzc2VkOiBJUmVzb2x2ZWRDb21wcmVzc2VkVHJlZUVsZW1lbnQ8SUNvbXByZXNzZWRUcmVlTm9kZTxudW1iZXI+PiA9IHtcblx0XHRcdFx0ZWxlbWVudDogeyBlbGVtZW50czogWzFdLCBpbmNvbXByZXNzaWJsZTogZmFsc2UgfSxcblx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IHsgZWxlbWVudHM6IFsxMV0sIGluY29tcHJlc3NpYmxlOiBmYWxzZSB9IH0sXG5cdFx0XHRcdFx0eyBlbGVtZW50OiB7IGVsZW1lbnRzOiBbMTJdLCBpbmNvbXByZXNzaWJsZTogZmFsc2UgfSB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogeyBlbGVtZW50czogWzEzXSwgaW5jb21wcmVzc2libGU6IGZhbHNlIH0gfVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc29sdmUoY29tcHJlc3MoZGVjb21wcmVzc2VkKSksIGNvbXByZXNzZWQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXNvbHZlKGRlY29tcHJlc3MoY29tcHJlc3NlZCkpLCBkZWNvbXByZXNzZWQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2luZ2xlIGhpZXJhcmNoeScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IGRlY29tcHJlc3NlZDogSUNvbXByZXNzZWRUcmVlRWxlbWVudDxudW1iZXI+ID0ge1xuXHRcdFx0XHRlbGVtZW50OiAxLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGVsZW1lbnQ6IDExLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0ZWxlbWVudDogMTExLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMTExIH1cblx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IGNvbXByZXNzZWQ6IElSZXNvbHZlZENvbXByZXNzZWRUcmVlRWxlbWVudDxJQ29tcHJlc3NlZFRyZWVOb2RlPG51bWJlcj4+ID0ge1xuXHRcdFx0XHRlbGVtZW50OiB7IGVsZW1lbnRzOiBbMSwgMTEsIDExMSwgMTExMV0sIGluY29tcHJlc3NpYmxlOiBmYWxzZSB9XG5cdFx0XHR9O1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc29sdmUoY29tcHJlc3MoZGVjb21wcmVzc2VkKSksIGNvbXByZXNzZWQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXNvbHZlKGRlY29tcHJlc3MoY29tcHJlc3NlZCkpLCBkZWNvbXByZXNzZWQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZGVlcCBjb21wcmVzc2lvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IGRlY29tcHJlc3NlZDogSUNvbXByZXNzZWRUcmVlRWxlbWVudDxudW1iZXI+ID0ge1xuXHRcdFx0XHRlbGVtZW50OiAxLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGVsZW1lbnQ6IDExLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0ZWxlbWVudDogMTExLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMTExIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExMTIgfSxcblx0XHRcdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogMTExMyB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMTE0IH0sXG5cdFx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBjb21wcmVzc2VkOiBJUmVzb2x2ZWRDb21wcmVzc2VkVHJlZUVsZW1lbnQ8SUNvbXByZXNzZWRUcmVlTm9kZTxudW1iZXI+PiA9IHtcblx0XHRcdFx0ZWxlbWVudDogeyBlbGVtZW50czogWzEsIDExLCAxMTFdLCBpbmNvbXByZXNzaWJsZTogZmFsc2UgfSxcblx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IHsgZWxlbWVudHM6IFsxMTExXSwgaW5jb21wcmVzc2libGU6IGZhbHNlIH0gfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IHsgZWxlbWVudHM6IFsxMTEyXSwgaW5jb21wcmVzc2libGU6IGZhbHNlIH0gfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IHsgZWxlbWVudHM6IFsxMTEzXSwgaW5jb21wcmVzc2libGU6IGZhbHNlIH0gfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IHsgZWxlbWVudHM6IFsxMTE0XSwgaW5jb21wcmVzc2libGU6IGZhbHNlIH0gfSxcblx0XHRcdFx0XVxuXHRcdFx0fTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXNvbHZlKGNvbXByZXNzKGRlY29tcHJlc3NlZCkpLCBjb21wcmVzc2VkKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzb2x2ZShkZWNvbXByZXNzKGNvbXByZXNzZWQpKSwgZGVjb21wcmVzc2VkKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2RvdWJsZSBkZWVwIGNvbXByZXNzaW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgZGVjb21wcmVzc2VkOiBJQ29tcHJlc3NlZFRyZWVFbGVtZW50PG51bWJlcj4gPSB7XG5cdFx0XHRcdGVsZW1lbnQ6IDEsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWxlbWVudDogMTEsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRlbGVtZW50OiAxMTEsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExMTIgfSxcblx0XHRcdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogMTExMyB9LFxuXHRcdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWxlbWVudDogMTIsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRlbGVtZW50OiAxMjEsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDEyMTIgfSxcblx0XHRcdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogMTIxMyB9LFxuXHRcdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgY29tcHJlc3NlZDogSVJlc29sdmVkQ29tcHJlc3NlZFRyZWVFbGVtZW50PElDb21wcmVzc2VkVHJlZU5vZGU8bnVtYmVyPj4gPSB7XG5cdFx0XHRcdGVsZW1lbnQ6IHsgZWxlbWVudHM6IFsxXSwgaW5jb21wcmVzc2libGU6IGZhbHNlIH0sXG5cdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWxlbWVudDogeyBlbGVtZW50czogWzExLCAxMTFdLCBpbmNvbXByZXNzaWJsZTogZmFsc2UgfSxcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogeyBlbGVtZW50czogWzExMTJdLCBpbmNvbXByZXNzaWJsZTogZmFsc2UgfSB9LFxuXHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IHsgZWxlbWVudHM6IFsxMTEzXSwgaW5jb21wcmVzc2libGU6IGZhbHNlIH0gfSxcblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGVsZW1lbnQ6IHsgZWxlbWVudHM6IFsxMiwgMTIxXSwgaW5jb21wcmVzc2libGU6IGZhbHNlIH0sXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IHsgZWxlbWVudHM6IFsxMjEyXSwgaW5jb21wcmVzc2libGU6IGZhbHNlIH0gfSxcblx0XHRcdFx0XHRcdFx0eyBlbGVtZW50OiB7IGVsZW1lbnRzOiBbMTIxM10sIGluY29tcHJlc3NpYmxlOiBmYWxzZSB9IH0sXG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc29sdmUoY29tcHJlc3MoZGVjb21wcmVzc2VkKSksIGNvbXByZXNzZWQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXNvbHZlKGRlY29tcHJlc3MoY29tcHJlc3NlZCkpLCBkZWNvbXByZXNzZWQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnaW5jb21wcmVzc2libGUgbGVhZicsIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IGRlY29tcHJlc3NlZDogSUNvbXByZXNzZWRUcmVlRWxlbWVudDxudW1iZXI+ID0ge1xuXHRcdFx0XHRlbGVtZW50OiAxLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGVsZW1lbnQ6IDExLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0ZWxlbWVudDogMTExLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMTExLCBpbmNvbXByZXNzaWJsZTogdHJ1ZSB9XG5cdFx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBjb21wcmVzc2VkOiBJUmVzb2x2ZWRDb21wcmVzc2VkVHJlZUVsZW1lbnQ8SUNvbXByZXNzZWRUcmVlTm9kZTxudW1iZXI+PiA9IHtcblx0XHRcdFx0ZWxlbWVudDogeyBlbGVtZW50czogWzEsIDExLCAxMTFdLCBpbmNvbXByZXNzaWJsZTogZmFsc2UgfSxcblx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IHsgZWxlbWVudHM6IFsxMTExXSwgaW5jb21wcmVzc2libGU6IHRydWUgfSB9XG5cdFx0XHRcdF1cblx0XHRcdH07XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzb2x2ZShjb21wcmVzcyhkZWNvbXByZXNzZWQpKSwgY29tcHJlc3NlZCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc29sdmUoZGVjb21wcmVzcyhjb21wcmVzc2VkKSksIGRlY29tcHJlc3NlZCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpbmNvbXByZXNzaWJsZSBicmFuY2gnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBkZWNvbXByZXNzZWQ6IElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8bnVtYmVyPiA9IHtcblx0XHRcdFx0ZWxlbWVudDogMSwgY2hpbGRyZW46IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRlbGVtZW50OiAxMSwgY2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdGVsZW1lbnQ6IDExMSwgaW5jb21wcmVzc2libGU6IHRydWUsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExMTEgfVxuXHRcdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgY29tcHJlc3NlZDogSVJlc29sdmVkQ29tcHJlc3NlZFRyZWVFbGVtZW50PElDb21wcmVzc2VkVHJlZU5vZGU8bnVtYmVyPj4gPSB7XG5cdFx0XHRcdGVsZW1lbnQ6IHsgZWxlbWVudHM6IFsxLCAxMV0sIGluY29tcHJlc3NpYmxlOiBmYWxzZSB9LFxuXHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHsgZWxlbWVudDogeyBlbGVtZW50czogWzExMSwgMTExMV0sIGluY29tcHJlc3NpYmxlOiB0cnVlIH0gfVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc29sdmUoY29tcHJlc3MoZGVjb21wcmVzc2VkKSksIGNvbXByZXNzZWQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXNvbHZlKGRlY29tcHJlc3MoY29tcHJlc3NlZCkpLCBkZWNvbXByZXNzZWQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnaW5jb21wcmVzc2libGUgY2hhaW4nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBkZWNvbXByZXNzZWQ6IElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8bnVtYmVyPiA9IHtcblx0XHRcdFx0ZWxlbWVudDogMSwgY2hpbGRyZW46IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRlbGVtZW50OiAxMSwgY2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdGVsZW1lbnQ6IDExMSwgaW5jb21wcmVzc2libGU6IHRydWUsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExMTEsIGluY29tcHJlc3NpYmxlOiB0cnVlIH1cblx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IGNvbXByZXNzZWQ6IElSZXNvbHZlZENvbXByZXNzZWRUcmVlRWxlbWVudDxJQ29tcHJlc3NlZFRyZWVOb2RlPG51bWJlcj4+ID0ge1xuXHRcdFx0XHRlbGVtZW50OiB7IGVsZW1lbnRzOiBbMSwgMTFdLCBpbmNvbXByZXNzaWJsZTogZmFsc2UgfSxcblx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRlbGVtZW50OiB7IGVsZW1lbnRzOiBbMTExXSwgaW5jb21wcmVzc2libGU6IHRydWUgfSxcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogeyBlbGVtZW50czogWzExMTFdLCBpbmNvbXByZXNzaWJsZTogdHJ1ZSB9IH1cblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH07XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzb2x2ZShjb21wcmVzcyhkZWNvbXByZXNzZWQpKSwgY29tcHJlc3NlZCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc29sdmUoZGVjb21wcmVzcyhjb21wcmVzc2VkKSksIGRlY29tcHJlc3NlZCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpbmNvbXByZXNzaWJsZSB0cmVlJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgZGVjb21wcmVzc2VkOiBJQ29tcHJlc3NlZFRyZWVFbGVtZW50PG51bWJlcj4gPSB7XG5cdFx0XHRcdGVsZW1lbnQ6IDEsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWxlbWVudDogMTEsIGluY29tcHJlc3NpYmxlOiB0cnVlLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0ZWxlbWVudDogMTExLCBpbmNvbXByZXNzaWJsZTogdHJ1ZSwgY2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogMTExMSwgaW5jb21wcmVzc2libGU6IHRydWUgfVxuXHRcdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgY29tcHJlc3NlZDogSVJlc29sdmVkQ29tcHJlc3NlZFRyZWVFbGVtZW50PElDb21wcmVzc2VkVHJlZU5vZGU8bnVtYmVyPj4gPSB7XG5cdFx0XHRcdGVsZW1lbnQ6IHsgZWxlbWVudHM6IFsxXSwgaW5jb21wcmVzc2libGU6IGZhbHNlIH0sXG5cdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWxlbWVudDogeyBlbGVtZW50czogWzExXSwgaW5jb21wcmVzc2libGU6IHRydWUgfSxcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRlbGVtZW50OiB7IGVsZW1lbnRzOiBbMTExXSwgaW5jb21wcmVzc2libGU6IHRydWUgfSxcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0eyBlbGVtZW50OiB7IGVsZW1lbnRzOiBbMTExMV0sIGluY29tcHJlc3NpYmxlOiB0cnVlIH0gfVxuXHRcdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXNvbHZlKGNvbXByZXNzKGRlY29tcHJlc3NlZCkpLCBjb21wcmVzc2VkKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzb2x2ZShkZWNvbXByZXNzKGNvbXByZXNzZWQpKSwgZGVjb21wcmVzc2VkKTtcblx0XHR9KTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gYmluZExpc3RUb01vZGVsPFQ+KGxpc3Q6IElUcmVlTm9kZTxUPltdLCBtb2RlbDogSVRyZWVNb2RlbDxULCBhbnksIGFueT4pOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIG1vZGVsLm9uRGlkU3BsaWNlUmVuZGVyZWROb2RlcygoeyBzdGFydCwgZGVsZXRlQ291bnQsIGVsZW1lbnRzIH0pID0+IHtcblx0XHRcdGxpc3Quc3BsaWNlKHN0YXJ0LCBkZWxldGVDb3VudCwgLi4uZWxlbWVudHMpO1xuXHRcdH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gdG9BcnJheTxUPihsaXN0OiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxUPj5bXSk6IFRbXVtdIHtcblx0XHRyZXR1cm4gbGlzdC5tYXAoaSA9PiBpLmVsZW1lbnQuZWxlbWVudHMpO1xuXHR9XG5cblx0c3VpdGUoJ0NvbXByZXNzZWRPYmplY3RUcmVlTW9kZWwnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHQvKipcblx0XHQgKiBDYWxscyB0aGF0IHRlc3QgZnVuY3Rpb24gdHdpY2UsIG9uY2Ugd2l0aCBhbiBlbXB0eSBvcHRpb25zIGFuZFxuXHRcdCAqIG9uY2Ugd2l0aCBgZGlmZklkZW50aXR5UHJvdmlkZXJgLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHdpdGhTbWFydFNwbGljZShmbjogKG9wdGlvbnM6IElPYmplY3RUcmVlTW9kZWxTZXRDaGlsZHJlbk9wdGlvbnM8bnVtYmVyLCBhbnk+KSA9PiB2b2lkKSB7XG5cdFx0XHRmbih7fSk7XG5cdFx0XHRmbih7IGRpZmZJZGVudGl0eVByb3ZpZGVyOiB7IGdldElkOiBuID0+IFN0cmluZyhuKSB9IH0pO1xuXHRcdH1cblxuXG5cdFx0dGVzdCgnY3RvcicsICgpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gbmV3IENvbXByZXNzZWRPYmplY3RUcmVlTW9kZWw8bnVtYmVyPigndGVzdCcpO1xuXHRcdFx0YXNzZXJ0KG1vZGVsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5zaXplLCAwKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2ZsYXQnLCAoKSA9PiB3aXRoU21hcnRTcGxpY2Uob3B0aW9ucyA9PiB7XG5cdFx0XHRjb25zdCBsaXN0OiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxudW1iZXI+PltdID0gW107XG5cdFx0XHRjb25zdCBtb2RlbCA9IG5ldyBDb21wcmVzc2VkT2JqZWN0VHJlZU1vZGVsPG51bWJlcj4oJ3Rlc3QnKTtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBiaW5kTGlzdFRvTW9kZWwobGlzdCwgbW9kZWwpO1xuXG5cdFx0XHRtb2RlbC5zZXRDaGlsZHJlbihudWxsLCBbXG5cdFx0XHRcdHsgZWxlbWVudDogMCB9LFxuXHRcdFx0XHR7IGVsZW1lbnQ6IDEgfSxcblx0XHRcdFx0eyBlbGVtZW50OiAyIH1cblx0XHRcdF0sIG9wdGlvbnMpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFtbMF0sIFsxXSwgWzJdXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuc2l6ZSwgMyk7XG5cblx0XHRcdG1vZGVsLnNldENoaWxkcmVuKG51bGwsIFtcblx0XHRcdFx0eyBlbGVtZW50OiAzIH0sXG5cdFx0XHRcdHsgZWxlbWVudDogNCB9LFxuXHRcdFx0XHR7IGVsZW1lbnQ6IDUgfSxcblx0XHRcdF0sIG9wdGlvbnMpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFtbM10sIFs0XSwgWzVdXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuc2l6ZSwgMyk7XG5cblx0XHRcdG1vZGVsLnNldENoaWxkcmVuKG51bGwsIFtdLCBvcHRpb25zKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnJheShsaXN0KSwgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLnNpemUsIDApO1xuXG5cdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR9KSk7XG5cblx0XHR0ZXN0KCduZXN0ZWQnLCAoKSA9PiB3aXRoU21hcnRTcGxpY2Uob3B0aW9ucyA9PiB7XG5cdFx0XHRjb25zdCBsaXN0OiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxudW1iZXI+PltdID0gW107XG5cdFx0XHRjb25zdCBtb2RlbCA9IG5ldyBDb21wcmVzc2VkT2JqZWN0VHJlZU1vZGVsPG51bWJlcj4oJ3Rlc3QnKTtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBiaW5kTGlzdFRvTW9kZWwobGlzdCwgbW9kZWwpO1xuXG5cdFx0XHRtb2RlbC5zZXRDaGlsZHJlbihudWxsLCBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRlbGVtZW50OiAwLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMCB9LFxuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMSB9LFxuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAxMiB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0eyBlbGVtZW50OiAxIH0sXG5cdFx0XHRcdHsgZWxlbWVudDogMiB9XG5cdFx0XHRdLCBvcHRpb25zKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbWzBdLCBbMTBdLCBbMTFdLCBbMTJdLCBbMV0sIFsyXV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLnNpemUsIDYpO1xuXG5cdFx0XHRtb2RlbC5zZXRDaGlsZHJlbigxMiwgW1xuXHRcdFx0XHR7IGVsZW1lbnQ6IDEyMCB9LFxuXHRcdFx0XHR7IGVsZW1lbnQ6IDEyMSB9XG5cdFx0XHRdLCBvcHRpb25zKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbWzBdLCBbMTBdLCBbMTFdLCBbMTJdLCBbMTIwXSwgWzEyMV0sIFsxXSwgWzJdXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuc2l6ZSwgOCk7XG5cblx0XHRcdG1vZGVsLnNldENoaWxkcmVuKDAsIFtdLCBvcHRpb25zKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnJheShsaXN0KSwgW1swXSwgWzFdLCBbMl1dKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5zaXplLCAzKTtcblxuXHRcdFx0bW9kZWwuc2V0Q2hpbGRyZW4obnVsbCwgW10sIG9wdGlvbnMpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuc2l6ZSwgMCk7XG5cblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdH0pKTtcblxuXHRcdHRlc3QoJ2NvbXByZXNzZWQnLCAoKSA9PiB3aXRoU21hcnRTcGxpY2Uob3B0aW9ucyA9PiB7XG5cdFx0XHRjb25zdCBsaXN0OiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxudW1iZXI+PltdID0gW107XG5cdFx0XHRjb25zdCBtb2RlbCA9IG5ldyBDb21wcmVzc2VkT2JqZWN0VHJlZU1vZGVsPG51bWJlcj4oJ3Rlc3QnKTtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBiaW5kTGlzdFRvTW9kZWwobGlzdCwgbW9kZWwpO1xuXG5cdFx0XHRtb2RlbC5zZXRDaGlsZHJlbihudWxsLCBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRlbGVtZW50OiAxLCBjaGlsZHJlbjogW3tcblx0XHRcdFx0XHRcdGVsZW1lbnQ6IDExLCBjaGlsZHJlbjogW3tcblx0XHRcdFx0XHRcdFx0ZWxlbWVudDogMTExLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogMTExMSB9LFxuXHRcdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogMTExMiB9LFxuXHRcdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogMTExMyB9LFxuXHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH1cblx0XHRcdF0sIG9wdGlvbnMpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFtbMSwgMTEsIDExMV0sIFsxMTExXSwgWzExMTJdLCBbMTExM11dKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5zaXplLCA2KTtcblxuXHRcdFx0bW9kZWwuc2V0Q2hpbGRyZW4oMTEsIFtcblx0XHRcdFx0eyBlbGVtZW50OiAxMTEgfSxcblx0XHRcdFx0eyBlbGVtZW50OiAxMTIgfSxcblx0XHRcdFx0eyBlbGVtZW50OiAxMTMgfSxcblx0XHRcdF0sIG9wdGlvbnMpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFtbMSwgMTFdLCBbMTExXSwgWzExMl0sIFsxMTNdXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuc2l6ZSwgNSk7XG5cblx0XHRcdG1vZGVsLnNldENoaWxkcmVuKDExMywgW1xuXHRcdFx0XHR7IGVsZW1lbnQ6IDExMzEgfVxuXHRcdFx0XSwgb3B0aW9ucyk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnJheShsaXN0KSwgW1sxLCAxMV0sIFsxMTFdLCBbMTEyXSwgWzExMywgMTEzMV1dKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5zaXplLCA2KTtcblxuXHRcdFx0bW9kZWwuc2V0Q2hpbGRyZW4oMTEzMSwgW1xuXHRcdFx0XHR7IGVsZW1lbnQ6IDExMzIgfVxuXHRcdFx0XSwgb3B0aW9ucyk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnJheShsaXN0KSwgW1sxLCAxMV0sIFsxMTFdLCBbMTEyXSwgWzExMywgMTEzMSwgMTEzMl1dKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5zaXplLCA3KTtcblxuXHRcdFx0bW9kZWwuc2V0Q2hpbGRyZW4oMTEzMSwgW1xuXHRcdFx0XHR7IGVsZW1lbnQ6IDExMzIgfSxcblx0XHRcdFx0eyBlbGVtZW50OiAxMTMzIH0sXG5cdFx0XHRdLCBvcHRpb25zKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbWzEsIDExXSwgWzExMV0sIFsxMTJdLCBbMTEzLCAxMTMxXSwgWzExMzJdLCBbMTEzM11dKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5zaXplLCA4KTtcblxuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0fSkpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsVUFBVSwyQkFBMkIsa0JBQStEO0FBRzdHLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsK0NBQStDO0FBUXhELFNBQVMsUUFBVyxhQUEyRTtBQUM5RixRQUFNLFNBQWMsRUFBRSxTQUFTLFlBQVksUUFBUTtBQUNuRCxRQUFNLFdBQVcsTUFBTSxLQUFLLFNBQVMsS0FBSyxZQUFZLFFBQVEsR0FBRyxPQUFPO0FBRXhFLE1BQUksWUFBWSxnQkFBZ0I7QUFD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
