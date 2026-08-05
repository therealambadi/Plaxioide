import assert from "assert";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { isIMenuItem, MenuId, MenuRegistry } from "../../common/actions.js";
import { MenuService } from "../../common/menuService.js";
import { NullCommandService } from "../../../commands/test/common/nullCommandService.js";
import { MockContextKeyService, MockKeybindingService } from "../../../keybinding/test/common/mockKeybindingService.js";
import { InMemoryStorageService } from "../../../storage/common/storage.js";
const contextKeyService = new class extends MockContextKeyService {
  contextMatchesRules() {
    return true;
  }
}();
suite("MenuService", function() {
  let menuService;
  const disposables = new DisposableStore();
  let testMenuId;
  setup(function() {
    menuService = new MenuService(NullCommandService, new MockKeybindingService(), new InMemoryStorageService());
    testMenuId = new MenuId(`testo/${generateUuid()}`);
    disposables.clear();
  });
  teardown(function() {
    disposables.clear();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("group sorting", function() {
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "one", title: "FOO" },
      group: "0_hello"
    }));
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "two", title: "FOO" },
      group: "hello"
    }));
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "three", title: "FOO" },
      group: "Hello"
    }));
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "four", title: "FOO" },
      group: ""
    }));
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "five", title: "FOO" },
      group: "navigation"
    }));
    const groups = disposables.add(menuService.createMenu(testMenuId, contextKeyService)).getActions();
    assert.strictEqual(groups.length, 5);
    const [one, two, three, four, five] = groups;
    assert.strictEqual(one[0], "navigation");
    assert.strictEqual(two[0], "0_hello");
    assert.strictEqual(three[0], "hello");
    assert.strictEqual(four[0], "Hello");
    assert.strictEqual(five[0], "");
  });
  test("in group sorting, by title", function() {
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "a", title: "aaa" },
      group: "Hello"
    }));
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "b", title: "fff" },
      group: "Hello"
    }));
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "c", title: "zzz" },
      group: "Hello"
    }));
    const groups = disposables.add(menuService.createMenu(testMenuId, contextKeyService)).getActions();
    assert.strictEqual(groups.length, 1);
    const [, actions] = groups[0];
    assert.strictEqual(actions.length, 3);
    const [one, two, three] = actions;
    assert.strictEqual(one.id, "a");
    assert.strictEqual(two.id, "b");
    assert.strictEqual(three.id, "c");
  });
  test("in group sorting, by title and order", function() {
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "a", title: "aaa" },
      group: "Hello",
      order: 10
    }));
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "b", title: "fff" },
      group: "Hello"
    }));
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "c", title: "zzz" },
      group: "Hello",
      order: -1
    }));
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "d", title: "yyy" },
      group: "Hello",
      order: -1
    }));
    const groups = disposables.add(menuService.createMenu(testMenuId, contextKeyService)).getActions();
    assert.strictEqual(groups.length, 1);
    const [, actions] = groups[0];
    assert.strictEqual(actions.length, 4);
    const [one, two, three, four] = actions;
    assert.strictEqual(one.id, "d");
    assert.strictEqual(two.id, "c");
    assert.strictEqual(three.id, "b");
    assert.strictEqual(four.id, "a");
  });
  test("in group sorting, special: navigation", function() {
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "a", title: "aaa" },
      group: "navigation",
      order: 1.3
    }));
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "b", title: "fff" },
      group: "navigation",
      order: 1.2
    }));
    disposables.add(MenuRegistry.appendMenuItem(testMenuId, {
      command: { id: "c", title: "zzz" },
      group: "navigation",
      order: 1.1
    }));
    const groups = disposables.add(menuService.createMenu(testMenuId, contextKeyService)).getActions();
    assert.strictEqual(groups.length, 1);
    const [[, actions]] = groups;
    assert.strictEqual(actions.length, 3);
    const [one, two, three] = actions;
    assert.strictEqual(one.id, "c");
    assert.strictEqual(two.id, "b");
    assert.strictEqual(three.id, "a");
  });
  test("special MenuId palette", function() {
    disposables.add(MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
      command: { id: "a", title: "Explicit" }
    }));
    disposables.add(MenuRegistry.addCommand({ id: "b", title: "Implicit" }));
    let foundA = false;
    let foundB = false;
    for (const item of MenuRegistry.getMenuItems(MenuId.CommandPalette)) {
      if (isIMenuItem(item)) {
        if (item.command.id === "a") {
          assert.strictEqual(item.command.title, "Explicit");
          foundA = true;
        }
        if (item.command.id === "b") {
          assert.strictEqual(item.command.title, "Implicit");
          foundB = true;
        }
      }
    }
    assert.strictEqual(foundA, true);
    assert.strictEqual(foundB, true);
  });
  test("Extension contributed submenus missing with errors in output #155030", function() {
    const id = generateUuid();
    const menu = new MenuId(id);
    assert.throws(() => new MenuId(id));
    assert.ok(menu === MenuId.for(id));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9hY3Rpb25zL3Rlc3QvY29tbW9uL21lbnVTZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IGlzSU1lbnVJdGVtLCBNZW51SWQsIE1lbnVSZWdpc3RyeSB9IGZyb20gJy4uLy4uL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL21lbnVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE51bGxDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1hbmRzL3Rlc3QvY29tbW9uL251bGxDb21tYW5kU2VydmljZS5qcyc7XG5pbXBvcnQgeyBNb2NrQ29udGV4dEtleVNlcnZpY2UsIE1vY2tLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2tleWJpbmRpbmcvdGVzdC9jb21tb24vbW9ja0tleWJpbmRpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEluTWVtb3J5U3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcblxuLy8gLS0tIHNlcnZpY2UgaW5zdGFuY2VzXG5cbmNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gbmV3IGNsYXNzIGV4dGVuZHMgTW9ja0NvbnRleHRLZXlTZXJ2aWNlIHtcblx0b3ZlcnJpZGUgY29udGV4dE1hdGNoZXNSdWxlcygpIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufTtcblxuLy8gLS0tIHRlc3RzXG5cbnN1aXRlKCdNZW51U2VydmljZScsIGZ1bmN0aW9uICgpIHtcblxuXHRsZXQgbWVudVNlcnZpY2U6IE1lbnVTZXJ2aWNlO1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0bGV0IHRlc3RNZW51SWQ6IE1lbnVJZDtcblxuXHRzZXR1cChmdW5jdGlvbiAoKSB7XG5cdFx0bWVudVNlcnZpY2UgPSBuZXcgTWVudVNlcnZpY2UoTnVsbENvbW1hbmRTZXJ2aWNlLCBuZXcgTW9ja0tleWJpbmRpbmdTZXJ2aWNlKCksIG5ldyBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlKCkpO1xuXHRcdHRlc3RNZW51SWQgPSBuZXcgTWVudUlkKGB0ZXN0by8ke2dlbmVyYXRlVXVpZCgpfWApO1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKGZ1bmN0aW9uICgpIHtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdncm91cCBzb3J0aW5nJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbSh0ZXN0TWVudUlkLCB7XG5cdFx0XHRjb21tYW5kOiB7IGlkOiAnb25lJywgdGl0bGU6ICdGT08nIH0sXG5cdFx0XHRncm91cDogJzBfaGVsbG8nXG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbSh0ZXN0TWVudUlkLCB7XG5cdFx0XHRjb21tYW5kOiB7IGlkOiAndHdvJywgdGl0bGU6ICdGT08nIH0sXG5cdFx0XHRncm91cDogJ2hlbGxvJ1xuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0odGVzdE1lbnVJZCwge1xuXHRcdFx0Y29tbWFuZDogeyBpZDogJ3RocmVlJywgdGl0bGU6ICdGT08nIH0sXG5cdFx0XHRncm91cDogJ0hlbGxvJ1xuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0odGVzdE1lbnVJZCwge1xuXHRcdFx0Y29tbWFuZDogeyBpZDogJ2ZvdXInLCB0aXRsZTogJ0ZPTycgfSxcblx0XHRcdGdyb3VwOiAnJ1xuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0odGVzdE1lbnVJZCwge1xuXHRcdFx0Y29tbWFuZDogeyBpZDogJ2ZpdmUnLCB0aXRsZTogJ0ZPTycgfSxcblx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbidcblx0XHR9KSk7XG5cblx0XHRjb25zdCBncm91cHMgPSBkaXNwb3NhYmxlcy5hZGQobWVudVNlcnZpY2UuY3JlYXRlTWVudSh0ZXN0TWVudUlkLCBjb250ZXh0S2V5U2VydmljZSkpLmdldEFjdGlvbnMoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cHMubGVuZ3RoLCA1KTtcblx0XHRjb25zdCBbb25lLCB0d28sIHRocmVlLCBmb3VyLCBmaXZlXSA9IGdyb3VwcztcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvbmVbMF0sICduYXZpZ2F0aW9uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR3b1swXSwgJzBfaGVsbG8nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhyZWVbMF0sICdoZWxsbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VyWzBdLCAnSGVsbG8nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml2ZVswXSwgJycpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbiBncm91cCBzb3J0aW5nLCBieSB0aXRsZScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0odGVzdE1lbnVJZCwge1xuXHRcdFx0Y29tbWFuZDogeyBpZDogJ2EnLCB0aXRsZTogJ2FhYScgfSxcblx0XHRcdGdyb3VwOiAnSGVsbG8nXG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbSh0ZXN0TWVudUlkLCB7XG5cdFx0XHRjb21tYW5kOiB7IGlkOiAnYicsIHRpdGxlOiAnZmZmJyB9LFxuXHRcdFx0Z3JvdXA6ICdIZWxsbydcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKHRlc3RNZW51SWQsIHtcblx0XHRcdGNvbW1hbmQ6IHsgaWQ6ICdjJywgdGl0bGU6ICd6enonIH0sXG5cdFx0XHRncm91cDogJ0hlbGxvJ1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGdyb3VwcyA9IGRpc3Bvc2FibGVzLmFkZChtZW51U2VydmljZS5jcmVhdGVNZW51KHRlc3RNZW51SWQsIGNvbnRleHRLZXlTZXJ2aWNlKSkuZ2V0QWN0aW9ucygpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3Vwcy5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IFssIGFjdGlvbnNdID0gZ3JvdXBzWzBdO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGlvbnMubGVuZ3RoLCAzKTtcblx0XHRjb25zdCBbb25lLCB0d28sIHRocmVlXSA9IGFjdGlvbnM7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9uZS5pZCwgJ2EnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHdvLmlkLCAnYicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aHJlZS5pZCwgJ2MnKTtcblx0fSk7XG5cblx0dGVzdCgnaW4gZ3JvdXAgc29ydGluZywgYnkgdGl0bGUgYW5kIG9yZGVyJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbSh0ZXN0TWVudUlkLCB7XG5cdFx0XHRjb21tYW5kOiB7IGlkOiAnYScsIHRpdGxlOiAnYWFhJyB9LFxuXHRcdFx0Z3JvdXA6ICdIZWxsbycsXG5cdFx0XHRvcmRlcjogMTBcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKHRlc3RNZW51SWQsIHtcblx0XHRcdGNvbW1hbmQ6IHsgaWQ6ICdiJywgdGl0bGU6ICdmZmYnIH0sXG5cdFx0XHRncm91cDogJ0hlbGxvJ1xuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0odGVzdE1lbnVJZCwge1xuXHRcdFx0Y29tbWFuZDogeyBpZDogJ2MnLCB0aXRsZTogJ3p6eicgfSxcblx0XHRcdGdyb3VwOiAnSGVsbG8nLFxuXHRcdFx0b3JkZXI6IC0xXG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbSh0ZXN0TWVudUlkLCB7XG5cdFx0XHRjb21tYW5kOiB7IGlkOiAnZCcsIHRpdGxlOiAneXl5JyB9LFxuXHRcdFx0Z3JvdXA6ICdIZWxsbycsXG5cdFx0XHRvcmRlcjogLTFcblx0XHR9KSk7XG5cblx0XHRjb25zdCBncm91cHMgPSBkaXNwb3NhYmxlcy5hZGQobWVudVNlcnZpY2UuY3JlYXRlTWVudSh0ZXN0TWVudUlkLCBjb250ZXh0S2V5U2VydmljZSkpLmdldEFjdGlvbnMoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cHMubGVuZ3RoLCAxKTtcblx0XHRjb25zdCBbLCBhY3Rpb25zXSA9IGdyb3Vwc1swXTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zLmxlbmd0aCwgNCk7XG5cdFx0Y29uc3QgW29uZSwgdHdvLCB0aHJlZSwgZm91cl0gPSBhY3Rpb25zO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvbmUuaWQsICdkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR3by5pZCwgJ2MnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhyZWUuaWQsICdiJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvdXIuaWQsICdhJyk7XG5cdH0pO1xuXG5cblx0dGVzdCgnaW4gZ3JvdXAgc29ydGluZywgc3BlY2lhbDogbmF2aWdhdGlvbicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0odGVzdE1lbnVJZCwge1xuXHRcdFx0Y29tbWFuZDogeyBpZDogJ2EnLCB0aXRsZTogJ2FhYScgfSxcblx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRvcmRlcjogMS4zXG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbSh0ZXN0TWVudUlkLCB7XG5cdFx0XHRjb21tYW5kOiB7IGlkOiAnYicsIHRpdGxlOiAnZmZmJyB9LFxuXHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdG9yZGVyOiAxLjJcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKHRlc3RNZW51SWQsIHtcblx0XHRcdGNvbW1hbmQ6IHsgaWQ6ICdjJywgdGl0bGU6ICd6enonIH0sXG5cdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0b3JkZXI6IDEuMVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGdyb3VwcyA9IGRpc3Bvc2FibGVzLmFkZChtZW51U2VydmljZS5jcmVhdGVNZW51KHRlc3RNZW51SWQsIGNvbnRleHRLZXlTZXJ2aWNlKSkuZ2V0QWN0aW9ucygpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3Vwcy5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IFtbLCBhY3Rpb25zXV0gPSBncm91cHM7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aW9ucy5sZW5ndGgsIDMpO1xuXHRcdGNvbnN0IFtvbmUsIHR3bywgdGhyZWVdID0gYWN0aW9ucztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob25lLmlkLCAnYycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0d28uaWQsICdiJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRocmVlLmlkLCAnYScpO1xuXHR9KTtcblxuXHR0ZXN0KCdzcGVjaWFsIE1lbnVJZCBwYWxldHRlJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ29tbWFuZFBhbGV0dGUsIHtcblx0XHRcdGNvbW1hbmQ6IHsgaWQ6ICdhJywgdGl0bGU6ICdFeHBsaWNpdCcgfVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChNZW51UmVnaXN0cnkuYWRkQ29tbWFuZCh7IGlkOiAnYicsIHRpdGxlOiAnSW1wbGljaXQnIH0pKTtcblxuXHRcdGxldCBmb3VuZEEgPSBmYWxzZTtcblx0XHRsZXQgZm91bmRCID0gZmFsc2U7XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIE1lbnVSZWdpc3RyeS5nZXRNZW51SXRlbXMoTWVudUlkLkNvbW1hbmRQYWxldHRlKSkge1xuXHRcdFx0aWYgKGlzSU1lbnVJdGVtKGl0ZW0pKSB7XG5cdFx0XHRcdGlmIChpdGVtLmNvbW1hbmQuaWQgPT09ICdhJykge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtLmNvbW1hbmQudGl0bGUsICdFeHBsaWNpdCcpO1xuXHRcdFx0XHRcdGZvdW5kQSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGl0ZW0uY29tbWFuZC5pZCA9PT0gJ2InKSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0uY29tbWFuZC50aXRsZSwgJ0ltcGxpY2l0Jyk7XG5cdFx0XHRcdFx0Zm91bmRCID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmRBLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmRCLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnRXh0ZW5zaW9uIGNvbnRyaWJ1dGVkIHN1Ym1lbnVzIG1pc3Npbmcgd2l0aCBlcnJvcnMgaW4gb3V0cHV0ICMxNTUwMzAnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBpZCA9IGdlbmVyYXRlVXVpZCgpO1xuXHRcdGNvbnN0IG1lbnUgPSBuZXcgTWVudUlkKGlkKTtcblxuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gbmV3IE1lbnVJZChpZCkpO1xuXHRcdGFzc2VydC5vayhtZW51ID09PSBNZW51SWQuZm9yKGlkKSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxhQUFhLFFBQVEsb0JBQW9CO0FBQ2xELFNBQVMsbUJBQW1CO0FBQzVCLFNB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
