var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
import { ExplorerItem } from "../../common/explorerModel.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { TestFileService, workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
import { NullFilesConfigurationService } from "../../../../test/common/workbenchTestServices.js";
import { ExplorerFindProvider } from "../../browser/views/explorerViewer.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { WorkbenchCompressibleAsyncDataTree } from "../../../../../platform/list/browser/listService.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { ISearchService } from "../../../../services/search/common/search.js";
import { URI } from "../../../../../base/common/uri.js";
import assert from "assert";
import { IExplorerService } from "../../browser/files.js";
import { basename } from "../../../../../base/common/resources.js";
import { TreeFindMatchType, TreeFindMode } from "../../../../../base/browser/ui/tree/abstractTree.js";
var require_explorerFindProvider_test = __commonJS({
  "/Users/ambadi/Desktop/plc-main/src/vs/workbench/contrib/files/test/browser/explorerFindProvider.test.ts"(exports) {
    function find(element, id) {
      if (element.name === id) {
        return element;
      }
      if (!element.children) {
        return void 0;
      }
      for (const child of element.children.values()) {
        const result = find(child, id);
        if (result) {
          return result;
        }
      }
      return void 0;
    }
    class Renderer {
      constructor() {
        this.templateId = "default";
      }
      renderTemplate(container) {
        return container;
      }
      renderElement(element, index, templateData) {
        templateData.textContent = element.element.name;
      }
      disposeTemplate(templateData) {
      }
      renderCompressedElements(node, index, templateData, height) {
        const result = [];
        for (const element of node.element.elements) {
          result.push(element.name);
        }
        templateData.textContent = result.join("/");
      }
    }
    class IdentityProvider {
      getId(element) {
        return {
          toString: () => {
            return element.name;
          }
        };
      }
    }
    class VirtualDelegate {
      getHeight() {
        return 20;
      }
      getTemplateId(element) {
        return "default";
      }
    }
    class DataSource {
      hasChildren(element) {
        return !!element.children && element.children.size > 0;
      }
      getChildren(element) {
        return Promise.resolve(Array.from(element.children.values()) || []);
      }
      getParent(element) {
        return element.parent;
      }
    }
    class AccessibilityProvider {
      getWidgetAriaLabel() {
        return "";
      }
      getAriaLabel(stat) {
        return stat.name;
      }
    }
    class KeyboardNavigationLabelProvider {
      getKeyboardNavigationLabel(stat) {
        return stat.name;
      }
      getCompressedNodeKeyboardNavigationLabel(stats) {
        return stats.map((stat) => stat.name).join("/");
      }
    }
    class CompressionDelegate {
      constructor(dataSource) {
        this.dataSource = dataSource;
      }
      isIncompressible(element) {
        return !this.dataSource.hasChildren(element);
      }
    }
    class TestFilesFilter {
      filter() {
        return true;
      }
      isIgnored() {
        return false;
      }
      dispose() {
      }
    }
    suite("Find Provider - ExplorerView", () => {
      const disposables = ensureNoDisposablesAreLeakedInTestSuite();
      const fileService = new TestFileService();
      const configService = new TestConfigurationService();
      function createStat(path, isFolder) {
        return new ExplorerItem(URI.from({ scheme: "file", path }), fileService, configService, NullFilesConfigurationService, void 0, isFolder);
      }
      let root;
      let instantiationService;
      const searchMappings = /* @__PURE__ */ new Map([
        ["bb", [URI.file("/root/b/bb/bbb.txt"), URI.file("/root/a/ab/abb.txt"), URI.file("/root/b/bb/bba.txt")]]
      ]);
      setup(() => {
        root = createStat.call(exports, "/root", true);
        const a = createStat.call(exports, "/root/a", true);
        const aa = createStat.call(exports, "/root/a/aa", true);
        const ab = createStat.call(exports, "/root/a/ab", true);
        const aba = createStat.call(exports, "/root/a/ab/aba.txt", false);
        const abb = createStat.call(exports, "/root/a/ab/abb.txt", false);
        const b = createStat.call(exports, "/root/b", true);
        const ba = createStat.call(exports, "/root/b/ba", true);
        const baa = createStat.call(exports, "/root/b/ba/baa.txt", false);
        const bab = createStat.call(exports, "/root/b/ba/bab.txt", false);
        const bb = createStat.call(exports, "/root/b/bb", true);
        root.addChild(a);
        a.addChild(aa);
        a.addChild(ab);
        ab.addChild(aba);
        ab.addChild(abb);
        root.addChild(b);
        b.addChild(ba);
        ba.addChild(baa);
        ba.addChild(bab);
        b.addChild(bb);
        instantiationService = workbenchInstantiationService(void 0, disposables);
        instantiationService.stub(IExplorerService, {
          roots: [root],
          refresh: () => Promise.resolve(),
          findClosest: (resource) => {
            return find(root, basename(resource)) ?? null;
          }
        });
        instantiationService.stub(ISearchService, {
          fileSearch(query, token) {
            const filePattern = query.filePattern?.replace(/\//g, "").replace(/\*/g, "").replace(/\[/g, "").replace(/\]/g, "").replace(/[A-Z]/g, "") ?? "";
            const fileMatches = (searchMappings.get(filePattern) ?? []).map((u) => ({ resource: u }));
            return Promise.resolve({ results: fileMatches, messages: [] });
          },
          schemeHasFileSearchProvider() {
            return true;
          }
        });
      });
      test("find provider", async function() {
        const disposables2 = new DisposableStore();
        const container = document.createElement("div");
        const dataSource = new DataSource();
        const compressionDelegate = new CompressionDelegate(dataSource);
        const keyboardNavigationLabelProvider = new KeyboardNavigationLabelProvider();
        const accessibilityProvider = new AccessibilityProvider();
        const filter = instantiationService.createInstance(TestFilesFilter);
        const options = { identityProvider: new IdentityProvider(), keyboardNavigationLabelProvider, accessibilityProvider };
        const tree = disposables2.add(instantiationService.createInstance(WorkbenchCompressibleAsyncDataTree, "test", container, new VirtualDelegate(), compressionDelegate, [new Renderer()], dataSource, options));
        tree.layout(200);
        await tree.setInput(root);
        const findProvider = instantiationService.createInstance(ExplorerFindProvider, filter, () => tree);
        findProvider.startSession();
        assert.strictEqual(find(root, "abb.txt") !== void 0, true);
        assert.strictEqual(find(root, "bba.txt") !== void 0, false);
        assert.strictEqual(find(root, "bbb.txt") !== void 0, false);
        assert.strictEqual(find(root, "abb.txt")?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, "a")?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, "ab")?.isMarkedAsFiltered(), false);
        await findProvider.find("bb", { matchType: TreeFindMatchType.Contiguous, findMode: TreeFindMode.Filter }, new CancellationTokenSource().token);
        assert.strictEqual(find(root, "abb.txt") !== void 0, true);
        assert.strictEqual(find(root, "bba.txt") !== void 0, true);
        assert.strictEqual(find(root, "bbb.txt") !== void 0, true);
        assert.strictEqual(find(root, "abb.txt")?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, "bba.txt")?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, "bbb.txt")?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, "a")?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, "ab")?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, "b")?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, "bb")?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, "aa")?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, "ba")?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, "aba.txt")?.isMarkedAsFiltered(), false);
        await findProvider.endSession();
        assert.strictEqual(find(root, "abb.txt") !== void 0, true);
        assert.strictEqual(find(root, "baa.txt") !== void 0, true);
        assert.strictEqual(find(root, "baa.txt") !== void 0, true);
        assert.strictEqual(find(root, "bba.txt") !== void 0, false);
        assert.strictEqual(find(root, "bbb.txt") !== void 0, false);
        assert.strictEqual(find(root, "a")?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, "ab")?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, "b")?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, "bb")?.isMarkedAsFiltered(), false);
        disposables2.dispose();
      });
    });
  }
});
export default require_explorerFindProvider_test();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy90ZXN0L2Jyb3dzZXIvZXhwbG9yZXJGaW5kUHJvdmlkZXIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElDb21wcmVzc2libGVUcmVlUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9vYmplY3RUcmVlLmpzJztcbmltcG9ydCB7IElJZGVudGl0eVByb3ZpZGVyLCBJS2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciwgSUxpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IElDb21wcmVzc2VkVHJlZU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9jb21wcmVzc2VkT2JqZWN0VHJlZU1vZGVsLmpzJztcbmltcG9ydCB7IEV4cGxvcmVySXRlbSB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHBsb3Jlck1vZGVsLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSVRyZWVDb21wcmVzc2lvbkRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvYXN5bmNEYXRhVHJlZS5qcyc7XG5pbXBvcnQgeyBJVHJlZU5vZGUsIElBc3luY0RhdGFTb3VyY2UsIElUcmVlRmlsdGVyLCBUcmVlRmlsdGVyUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVGVzdEZpbGVTZXJ2aWNlLCB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgTnVsbEZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgRXhwbG9yZXJGaW5kUHJvdmlkZXIsIEZpbGVzRmlsdGVyIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci92aWV3cy9leHBsb3JlclZpZXdlci5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZU9wdGlvbnMsIFdvcmtiZW5jaENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IEZ1enp5U2NvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBJRmlsZU1hdGNoLCBJRmlsZVF1ZXJ5LCBJU2VhcmNoQ29tcGxldGUsIElTZWFyY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IElFeHBsb3JlclNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2ZpbGVzLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFRyZWVGaW5kTWF0Y2hUeXBlLCBUcmVlRmluZE1vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9hYnN0cmFjdFRyZWUuanMnO1xuXG5mdW5jdGlvbiBmaW5kKGVsZW1lbnQ6IEV4cGxvcmVySXRlbSwgaWQ6IHN0cmluZyk6IEV4cGxvcmVySXRlbSB8IHVuZGVmaW5lZCB7XG5cdGlmIChlbGVtZW50Lm5hbWUgPT09IGlkKSB7XG5cdFx0cmV0dXJuIGVsZW1lbnQ7XG5cdH1cblxuXHRpZiAoIWVsZW1lbnQuY2hpbGRyZW4pIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Zm9yIChjb25zdCBjaGlsZCBvZiBlbGVtZW50LmNoaWxkcmVuLnZhbHVlcygpKSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gZmluZChjaGlsZCwgaWQpO1xuXG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5jbGFzcyBSZW5kZXJlciBpbXBsZW1lbnRzIElDb21wcmVzc2libGVUcmVlUmVuZGVyZXI8RXhwbG9yZXJJdGVtLCBGdXp6eVNjb3JlLCBIVE1MRWxlbWVudD4ge1xuXHRyZWFkb25seSB0ZW1wbGF0ZUlkID0gJ2RlZmF1bHQnO1xuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiBjb250YWluZXI7XG5cdH1cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8RXhwbG9yZXJJdGVtLCBGdXp6eVNjb3JlPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS50ZXh0Q29udGVudCA9IGVsZW1lbnQuZWxlbWVudC5uYW1lO1xuXHR9XG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Ly8gbm9vcFxuXHR9XG5cdHJlbmRlckNvbXByZXNzZWRFbGVtZW50cyhub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxFeHBsb3Jlckl0ZW0+LCBGdXp6eVNjb3JlPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBIVE1MRWxlbWVudCwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2Ygbm9kZS5lbGVtZW50LmVsZW1lbnRzKSB7XG5cdFx0XHRyZXN1bHQucHVzaChlbGVtZW50Lm5hbWUpO1xuXHRcdH1cblxuXHRcdHRlbXBsYXRlRGF0YS50ZXh0Q29udGVudCA9IHJlc3VsdC5qb2luKCcvJyk7XG5cdH1cbn1cblxuY2xhc3MgSWRlbnRpdHlQcm92aWRlciBpbXBsZW1lbnRzIElJZGVudGl0eVByb3ZpZGVyPEV4cGxvcmVySXRlbT4ge1xuXHRnZXRJZChlbGVtZW50OiBFeHBsb3Jlckl0ZW0pIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dG9TdHJpbmc6ICgpID0+IHsgcmV0dXJuIGVsZW1lbnQubmFtZTsgfVxuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgVmlydHVhbERlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8RXhwbG9yZXJJdGVtPiB7XG5cdGdldEhlaWdodCgpIHsgcmV0dXJuIDIwOyB9XG5cdGdldFRlbXBsYXRlSWQoZWxlbWVudDogRXhwbG9yZXJJdGVtKTogc3RyaW5nIHsgcmV0dXJuICdkZWZhdWx0JzsgfVxufVxuXG5jbGFzcyBEYXRhU291cmNlIGltcGxlbWVudHMgSUFzeW5jRGF0YVNvdXJjZTxFeHBsb3Jlckl0ZW0sIEV4cGxvcmVySXRlbT4ge1xuXHRoYXNDaGlsZHJlbihlbGVtZW50OiBFeHBsb3Jlckl0ZW0pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISFlbGVtZW50LmNoaWxkcmVuICYmIGVsZW1lbnQuY2hpbGRyZW4uc2l6ZSA+IDA7XG5cdH1cblx0Z2V0Q2hpbGRyZW4oZWxlbWVudDogRXhwbG9yZXJJdGVtKTogUHJvbWlzZTxFeHBsb3Jlckl0ZW1bXT4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoQXJyYXkuZnJvbShlbGVtZW50LmNoaWxkcmVuLnZhbHVlcygpKSB8fCBbXSk7XG5cdH1cblx0Z2V0UGFyZW50KGVsZW1lbnQ6IEV4cGxvcmVySXRlbSk6IEV4cGxvcmVySXRlbSB7XG5cdFx0cmV0dXJuIGVsZW1lbnQucGFyZW50ITtcblx0fVxuXG59XG5cbmNsYXNzIEFjY2Vzc2liaWxpdHlQcm92aWRlciBpbXBsZW1lbnRzIElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPEV4cGxvcmVySXRlbT4ge1xuXHRnZXRXaWRnZXRBcmlhTGFiZWwoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gJyc7XG5cdH1cblx0Z2V0QXJpYUxhYmVsKHN0YXQ6IEV4cGxvcmVySXRlbSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHN0YXQubmFtZTtcblx0fVxufVxuXG5jbGFzcyBLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyIGltcGxlbWVudHMgSUtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI8RXhwbG9yZXJJdGVtPiB7XG5cdGdldEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsKHN0YXQ6IEV4cGxvcmVySXRlbSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHN0YXQubmFtZTtcblx0fVxuXHRnZXRDb21wcmVzc2VkTm9kZUtleWJvYXJkTmF2aWdhdGlvbkxhYmVsKHN0YXRzOiBFeHBsb3Jlckl0ZW1bXSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHN0YXRzLm1hcChzdGF0ID0+IHN0YXQubmFtZSkuam9pbignLycpO1xuXHR9XG59XG5cbmNsYXNzIENvbXByZXNzaW9uRGVsZWdhdGUgaW1wbGVtZW50cyBJVHJlZUNvbXByZXNzaW9uRGVsZWdhdGU8RXhwbG9yZXJJdGVtPiB7XG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgZGF0YVNvdXJjZTogRGF0YVNvdXJjZSkgeyB9XG5cdGlzSW5jb21wcmVzc2libGUoZWxlbWVudDogRXhwbG9yZXJJdGVtKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICF0aGlzLmRhdGFTb3VyY2UuaGFzQ2hpbGRyZW4oZWxlbWVudCk7XG5cdH1cbn1cblxuY2xhc3MgVGVzdEZpbGVzRmlsdGVyIGltcGxlbWVudHMgSVRyZWVGaWx0ZXI8RXhwbG9yZXJJdGVtPiB7XG5cdGZpbHRlcigpOiBUcmVlRmlsdGVyUmVzdWx0PHZvaWQ+IHsgcmV0dXJuIHRydWU7IH1cblx0aXNJZ25vcmVkKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0ZGlzcG9zZSgpIHsgfVxufVxuXG5zdWl0ZSgnRmluZCBQcm92aWRlciAtIEV4cGxvcmVyVmlldycsICgpID0+IHtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRjb25zdCBmaWxlU2VydmljZSA9IG5ldyBUZXN0RmlsZVNlcnZpY2UoKTtcblx0Y29uc3QgY29uZmlnU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKTtcblxuXHRmdW5jdGlvbiBjcmVhdGVTdGF0KHRoaXM6IGFueSwgcGF0aDogc3RyaW5nLCBpc0ZvbGRlcjogYm9vbGVhbik6IEV4cGxvcmVySXRlbSB7XG5cdFx0cmV0dXJuIG5ldyBFeHBsb3Jlckl0ZW0oVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJywgcGF0aCB9KSwgZmlsZVNlcnZpY2UsIGNvbmZpZ1NlcnZpY2UsIE51bGxGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLCB1bmRlZmluZWQsIGlzRm9sZGVyKTtcblx0fVxuXG5cdGxldCByb290OiBFeHBsb3Jlckl0ZW07XG5cblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cblx0Y29uc3Qgc2VhcmNoTWFwcGluZ3MgPSBuZXcgTWFwPHN0cmluZywgVVJJW10+KFtcblx0XHRbJ2JiJywgW1VSSS5maWxlKCcvcm9vdC9iL2JiL2JiYi50eHQnKSwgVVJJLmZpbGUoJy9yb290L2EvYWIvYWJiLnR4dCcpLCBVUkkuZmlsZSgnL3Jvb3QvYi9iYi9iYmEudHh0JyldXSxcblx0XSk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdHJvb3QgPSBjcmVhdGVTdGF0LmNhbGwodGhpcywgJy9yb290JywgdHJ1ZSk7XG5cdFx0Y29uc3QgYSA9IGNyZWF0ZVN0YXQuY2FsbCh0aGlzLCAnL3Jvb3QvYScsIHRydWUpO1xuXHRcdGNvbnN0IGFhID0gY3JlYXRlU3RhdC5jYWxsKHRoaXMsICcvcm9vdC9hL2FhJywgdHJ1ZSk7XG5cdFx0Y29uc3QgYWIgPSBjcmVhdGVTdGF0LmNhbGwodGhpcywgJy9yb290L2EvYWInLCB0cnVlKTtcblx0XHRjb25zdCBhYmEgPSBjcmVhdGVTdGF0LmNhbGwodGhpcywgJy9yb290L2EvYWIvYWJhLnR4dCcsIGZhbHNlKTtcblx0XHRjb25zdCBhYmIgPSBjcmVhdGVTdGF0LmNhbGwodGhpcywgJy9yb290L2EvYWIvYWJiLnR4dCcsIGZhbHNlKTtcblx0XHRjb25zdCBiID0gY3JlYXRlU3RhdC5jYWxsKHRoaXMsICcvcm9vdC9iJywgdHJ1ZSk7XG5cdFx0Y29uc3QgYmEgPSBjcmVhdGVTdGF0LmNhbGwodGhpcywgJy9yb290L2IvYmEnLCB0cnVlKTtcblx0XHRjb25zdCBiYWEgPSBjcmVhdGVTdGF0LmNhbGwodGhpcywgJy9yb290L2IvYmEvYmFhLnR4dCcsIGZhbHNlKTtcblx0XHRjb25zdCBiYWIgPSBjcmVhdGVTdGF0LmNhbGwodGhpcywgJy9yb290L2IvYmEvYmFiLnR4dCcsIGZhbHNlKTtcblx0XHRjb25zdCBiYiA9IGNyZWF0ZVN0YXQuY2FsbCh0aGlzLCAnL3Jvb3QvYi9iYicsIHRydWUpO1xuXG5cdFx0cm9vdC5hZGRDaGlsZChhKTtcblx0XHRhLmFkZENoaWxkKGFhKTtcblx0XHRhLmFkZENoaWxkKGFiKTtcblx0XHRhYi5hZGRDaGlsZChhYmEpO1xuXHRcdGFiLmFkZENoaWxkKGFiYik7XG5cdFx0cm9vdC5hZGRDaGlsZChiKTtcblx0XHRiLmFkZENoaWxkKGJhKTtcblx0XHRiYS5hZGRDaGlsZChiYWEpO1xuXHRcdGJhLmFkZENoaWxkKGJhYik7XG5cdFx0Yi5hZGRDaGlsZChiYik7XG5cblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgZGlzcG9zYWJsZXMpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUV4cGxvcmVyU2VydmljZSwge1xuXHRcdFx0cm9vdHM6IFtyb290XSxcblx0XHRcdHJlZnJlc2g6ICgpID0+IFByb21pc2UucmVzb2x2ZSgpLFxuXHRcdFx0ZmluZENsb3Nlc3Q6IChyZXNvdXJjZTogVVJJKSA9PiB7XG5cdFx0XHRcdHJldHVybiBmaW5kKHJvb3QsIGJhc2VuYW1lKHJlc291cmNlKSkgPz8gbnVsbDtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU2VhcmNoU2VydmljZSwge1xuXHRcdFx0ZmlsZVNlYXJjaChxdWVyeTogSUZpbGVRdWVyeSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVNlYXJjaENvbXBsZXRlPiB7XG5cdFx0XHRcdGNvbnN0IGZpbGVQYXR0ZXJuID0gcXVlcnkuZmlsZVBhdHRlcm4/LnJlcGxhY2UoL1xcLy9nLCAnJylcblx0XHRcdFx0XHQucmVwbGFjZSgvXFwqL2csICcnKVxuXHRcdFx0XHRcdC5yZXBsYWNlKC9cXFsvZywgJycpXG5cdFx0XHRcdFx0LnJlcGxhY2UoL1xcXS9nLCAnJylcblx0XHRcdFx0XHQucmVwbGFjZSgvW0EtWl0vZywgJycpID8/ICcnO1xuXHRcdFx0XHRjb25zdCBmaWxlTWF0Y2hlczogSUZpbGVNYXRjaFtdID0gKHNlYXJjaE1hcHBpbmdzLmdldChmaWxlUGF0dGVybikgPz8gW10pLm1hcCh1ID0+ICh7IHJlc291cmNlOiB1IH0pKTtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh7IHJlc3VsdHM6IGZpbGVNYXRjaGVzLCBtZXNzYWdlczogW10gfSk7XG5cdFx0XHR9LFxuXHRcdFx0c2NoZW1lSGFzRmlsZVNlYXJjaFByb3ZpZGVyKCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZmluZCBwcm92aWRlcicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdC8vIFRyZWUgU3R1ZmZcblx0XHRjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuXHRcdGNvbnN0IGRhdGFTb3VyY2UgPSBuZXcgRGF0YVNvdXJjZSgpO1xuXHRcdGNvbnN0IGNvbXByZXNzaW9uRGVsZWdhdGUgPSBuZXcgQ29tcHJlc3Npb25EZWxlZ2F0ZShkYXRhU291cmNlKTtcblx0XHRjb25zdCBrZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyID0gbmV3IEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXIoKTtcblx0XHRjb25zdCBhY2Nlc3NpYmlsaXR5UHJvdmlkZXIgPSBuZXcgQWNjZXNzaWJpbGl0eVByb3ZpZGVyKCk7XG5cdFx0Y29uc3QgZmlsdGVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdEZpbGVzRmlsdGVyKSBhcyB1bmtub3duIGFzIEZpbGVzRmlsdGVyO1xuXG5cdFx0Y29uc3Qgb3B0aW9uczogSVdvcmtiZW5jaENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWVPcHRpb25zPEV4cGxvcmVySXRlbSwgRnV6enlTY29yZT4gPSB7IGlkZW50aXR5UHJvdmlkZXI6IG5ldyBJZGVudGl0eVByb3ZpZGVyKCksIGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXIsIGFjY2Vzc2liaWxpdHlQcm92aWRlciB9O1xuXHRcdGNvbnN0IHRyZWUgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZTxFeHBsb3Jlckl0ZW0gfCBFeHBsb3Jlckl0ZW1bXSwgRXhwbG9yZXJJdGVtLCBGdXp6eVNjb3JlPiwgJ3Rlc3QnLCBjb250YWluZXIsIG5ldyBWaXJ0dWFsRGVsZWdhdGUoKSwgY29tcHJlc3Npb25EZWxlZ2F0ZSwgW25ldyBSZW5kZXJlcigpXSwgZGF0YVNvdXJjZSwgb3B0aW9ucykpO1xuXHRcdHRyZWUubGF5b3V0KDIwMCk7XG5cblx0XHRhd2FpdCB0cmVlLnNldElucHV0KHJvb3QpO1xuXG5cdFx0Y29uc3QgZmluZFByb3ZpZGVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXhwbG9yZXJGaW5kUHJvdmlkZXIsIGZpbHRlciwgKCkgPT4gdHJlZSk7XG5cblx0XHRmaW5kUHJvdmlkZXIuc3RhcnRTZXNzaW9uKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZChyb290LCAnYWJiLnR4dCcpICE9PSB1bmRlZmluZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kKHJvb3QsICdiYmEudHh0JykgIT09IHVuZGVmaW5lZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kKHJvb3QsICdiYmIudHh0JykgIT09IHVuZGVmaW5lZCwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmQocm9vdCwgJ2FiYi50eHQnKT8uaXNNYXJrZWRBc0ZpbHRlcmVkKCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZChyb290LCAnYScpPy5pc01hcmtlZEFzRmlsdGVyZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kKHJvb3QsICdhYicpPy5pc01hcmtlZEFzRmlsdGVyZWQoKSwgZmFsc2UpO1xuXG5cdFx0YXdhaXQgZmluZFByb3ZpZGVyLmZpbmQoJ2JiJywgeyBtYXRjaFR5cGU6IFRyZWVGaW5kTWF0Y2hUeXBlLkNvbnRpZ3VvdXMsIGZpbmRNb2RlOiBUcmVlRmluZE1vZGUuRmlsdGVyIH0sIG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpLnRva2VuKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kKHJvb3QsICdhYmIudHh0JykgIT09IHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmQocm9vdCwgJ2JiYS50eHQnKSAhPT0gdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZChyb290LCAnYmJiLnR4dCcpICE9PSB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmQocm9vdCwgJ2FiYi50eHQnKT8uaXNNYXJrZWRBc0ZpbHRlcmVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kKHJvb3QsICdiYmEudHh0Jyk/LmlzTWFya2VkQXNGaWx0ZXJlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZChyb290LCAnYmJiLnR4dCcpPy5pc01hcmtlZEFzRmlsdGVyZWQoKSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZChyb290LCAnYScpPy5pc01hcmtlZEFzRmlsdGVyZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmQocm9vdCwgJ2FiJyk/LmlzTWFya2VkQXNGaWx0ZXJlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZChyb290LCAnYicpPy5pc01hcmtlZEFzRmlsdGVyZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmQocm9vdCwgJ2JiJyk/LmlzTWFya2VkQXNGaWx0ZXJlZCgpLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kKHJvb3QsICdhYScpPy5pc01hcmtlZEFzRmlsdGVyZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kKHJvb3QsICdiYScpPy5pc01hcmtlZEFzRmlsdGVyZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kKHJvb3QsICdhYmEudHh0Jyk/LmlzTWFya2VkQXNGaWx0ZXJlZCgpLCBmYWxzZSk7XG5cblx0XHRhd2FpdCBmaW5kUHJvdmlkZXIuZW5kU2Vzc2lvbigpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmQocm9vdCwgJ2FiYi50eHQnKSAhPT0gdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZChyb290LCAnYmFhLnR4dCcpICE9PSB1bmRlZmluZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kKHJvb3QsICdiYWEudHh0JykgIT09IHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmQocm9vdCwgJ2JiYS50eHQnKSAhPT0gdW5kZWZpbmVkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmQocm9vdCwgJ2JiYi50eHQnKSAhPT0gdW5kZWZpbmVkLCBmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZChyb290LCAnYScpPy5pc01hcmtlZEFzRmlsdGVyZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kKHJvb3QsICdhYicpPy5pc01hcmtlZEFzRmlsdGVyZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kKHJvb3QsICdiJyk/LmlzTWFya2VkQXNGaWx0ZXJlZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmQocm9vdCwgJ2JiJyk/LmlzTWFya2VkQXNGaWx0ZXJlZCgpLCBmYWxzZSk7XG5cblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFw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
