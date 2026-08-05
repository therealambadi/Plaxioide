import { ObjectTree } from "../../../../../base/browser/ui/tree/objectTree.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { TestItemTreeElement, TestTreeErrorMessage } from "../../browser/explorerProjections/index.js";
import { MainThreadTestCollection } from "../../common/mainThreadTestCollection.js";
import { testStubs } from "../common/testStubs.js";
const element = document.createElement("div");
element.style.height = "1000px";
element.style.width = "200px";
class TestObjectTree extends ObjectTree {
  constructor(serializer, sorter) {
    super(
      "test",
      element,
      {
        getHeight: () => 20,
        getTemplateId: () => "default"
      },
      [
        {
          disposeTemplate: ({ store }) => store.dispose(),
          renderElement: ({ depth, element: element2 }, _index, { container, store }) => {
            const render = () => {
              container.textContent = `${depth}:${serializer(element2)}`;
              Object.assign(container.dataset, element2);
            };
            render();
            if (element2 instanceof TestItemTreeElement) {
              store.add(element2.onChange(render));
            }
          },
          disposeElement: (_el, _index, { store }) => store.clear(),
          renderTemplate: (container) => ({ container, store: new DisposableStore() }),
          templateId: "default"
        }
      ],
      {
        sorter: sorter ?? {
          compare: (a, b) => serializer(a).localeCompare(serializer(b))
        }
      }
    );
    this.layout(1e3, 200);
  }
  getRendered(getProperty) {
    const elements = element.querySelectorAll(".monaco-tl-contents");
    const sorted = [...elements].sort((a, b) => pos(a) - pos(b));
    const chain = [{ e: "", children: [] }];
    for (const element2 of sorted) {
      const [depthStr, label] = element2.textContent.split(":");
      const depth = Number(depthStr);
      const parent = chain[depth - 1];
      const child = { e: label };
      if (getProperty) {
        child.data = element2.dataset[getProperty];
      }
      parent.children = parent.children?.concat(child) ?? [child];
      chain[depth] = child;
    }
    return chain[0].children;
  }
}
const pos = (element2) => Number(element2.parentElement.parentElement.getAttribute("aria-posinset"));
class ByLabelTreeSorter {
  compare(a, b) {
    if (a instanceof TestTreeErrorMessage || b instanceof TestTreeErrorMessage) {
      return (a instanceof TestTreeErrorMessage ? -1 : 0) + (b instanceof TestTreeErrorMessage ? 1 : 0);
    }
    if (a instanceof TestItemTreeElement && b instanceof TestItemTreeElement && a.test.item.uri && b.test.item.uri && a.test.item.uri.toString() === b.test.item.uri.toString() && a.test.item.range && b.test.item.range) {
      const delta = a.test.item.range.startLineNumber - b.test.item.range.startLineNumber;
      if (delta !== 0) {
        return delta;
      }
    }
    return (a.test.item.sortText || a.test.item.label).localeCompare(b.test.item.sortText || b.test.item.label);
  }
}
class TestTreeTestHarness extends Disposable {
  constructor(makeTree, c = testStubs.nested()) {
    super();
    this.c = c;
    this.onDiff = this._register(new Emitter());
    this.onFolderChange = this._register(new Emitter());
    this.isProcessingDiff = false;
    this._register(c);
    this._register(this.c.onDidGenerateDiff((d) => this.c.setDiff(
      d
      /* don't clear during testing */
    )));
    const collection = new MainThreadTestCollection({ asCanonicalUri: (u) => u }, (testId, levels) => {
      this.c.expand(testId, levels);
      if (!this.isProcessingDiff) {
        this.onDiff.fire(this.c.collectDiff());
      }
      return Promise.resolve();
    });
    this._register(this.onDiff.event((diff) => collection.apply(diff)));
    this.projection = this._register(makeTree({
      collection,
      onDidProcessDiff: this.onDiff.event
    }));
    const sorter = new ByLabelTreeSorter();
    this.tree = this._register(new TestObjectTree((t) => "test" in t ? t.test.item.label : t.message.toString(), sorter));
    this._register(this.tree.onDidChangeCollapseState((evt) => {
      if (evt.node.element instanceof TestItemTreeElement) {
        this.projection.expandElement(evt.node.element, evt.deep ? Infinity : 0);
      }
    }));
  }
  pushDiff(...diff) {
    this.onDiff.fire(diff);
  }
  flush() {
    this.isProcessingDiff = true;
    while (this.c.currentDiff.length) {
      this.onDiff.fire(this.c.collectDiff());
    }
    this.isProcessingDiff = false;
    this.projection.applyTo(this.tree);
    return this.tree.getRendered();
  }
}
export {
  TestTreeTestHarness
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL3Rlc3QvYnJvd3Nlci90ZXN0T2JqZWN0VHJlZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IE9iamVjdFRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9vYmplY3RUcmVlLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUZvbGRlcnNDaGFuZ2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElUZXN0VHJlZVByb2plY3Rpb24sIFRlc3RFeHBsb3JlclRyZWVFbGVtZW50LCBUZXN0SXRlbVRyZWVFbGVtZW50LCBUZXN0VHJlZUVycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvZXhwbG9yZXJQcm9qZWN0aW9ucy9pbmRleC5qcyc7XG5pbXBvcnQgeyBNYWluVGhyZWFkVGVzdENvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi9jb21tb24vbWFpblRocmVhZFRlc3RDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RzRGlmZiwgVGVzdHNEaWZmT3AgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdFR5cGVzLmpzJztcbmltcG9ydCB7IElUZXN0U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyB0ZXN0U3R1YnMgfSBmcm9tICcuLi9jb21tb24vdGVzdFN0dWJzLmpzJztcbmltcG9ydCB7IElUcmVlUmVuZGVyZXIsIElUcmVlU29ydGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5cbnR5cGUgU2VyaWFsaXplZFRyZWUgPSB7IGU6IHN0cmluZzsgY2hpbGRyZW4/OiBTZXJpYWxpemVkVHJlZVtdOyBkYXRhPzogc3RyaW5nIH07XG5cbmNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbmVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gJzEwMDBweCc7XG5lbGVtZW50LnN0eWxlLndpZHRoID0gJzIwMHB4JztcblxuY2xhc3MgVGVzdE9iamVjdFRyZWU8VD4gZXh0ZW5kcyBPYmplY3RUcmVlPFQsIGFueT4ge1xuXHRjb25zdHJ1Y3RvcihzZXJpYWxpemVyOiAobm9kZTogVCkgPT4gc3RyaW5nLCBzb3J0ZXI/OiBJVHJlZVNvcnRlcjxUPikge1xuXHRcdHN1cGVyKFxuXHRcdFx0J3Rlc3QnLFxuXHRcdFx0ZWxlbWVudCxcblx0XHRcdHtcblx0XHRcdFx0Z2V0SGVpZ2h0OiAoKSA9PiAyMCxcblx0XHRcdFx0Z2V0VGVtcGxhdGVJZDogKCkgPT4gJ2RlZmF1bHQnXG5cdFx0XHR9LFxuXHRcdFx0W1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZGlzcG9zZVRlbXBsYXRlOiAoeyBzdG9yZSB9KSA9PiBzdG9yZS5kaXNwb3NlKCksXG5cdFx0XHRcdFx0cmVuZGVyRWxlbWVudDogKHsgZGVwdGgsIGVsZW1lbnQgfSwgX2luZGV4LCB7IGNvbnRhaW5lciwgc3RvcmUgfSkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgcmVuZGVyID0gKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRjb250YWluZXIudGV4dENvbnRlbnQgPSBgJHtkZXB0aH06JHtzZXJpYWxpemVyKGVsZW1lbnQpfWA7XG5cdFx0XHRcdFx0XHRcdE9iamVjdC5hc3NpZ24oY29udGFpbmVyLmRhdGFzZXQsIGVsZW1lbnQpO1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdHJlbmRlcigpO1xuXG5cdFx0XHRcdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFRlc3RJdGVtVHJlZUVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdFx0c3RvcmUuYWRkKGVsZW1lbnQub25DaGFuZ2UocmVuZGVyKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRkaXNwb3NlRWxlbWVudDogKF9lbCwgX2luZGV4LCB7IHN0b3JlIH0pID0+IHN0b3JlLmNsZWFyKCksXG5cdFx0XHRcdFx0cmVuZGVyVGVtcGxhdGU6IGNvbnRhaW5lciA9PiAoeyBjb250YWluZXIsIHN0b3JlOiBuZXcgRGlzcG9zYWJsZVN0b3JlKCkgfSksXG5cdFx0XHRcdFx0dGVtcGxhdGVJZDogJ2RlZmF1bHQnXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElUcmVlUmVuZGVyZXI8VCwgYW55LCB7IHN0b3JlOiBEaXNwb3NhYmxlU3RvcmU7IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfT5cblx0XHRcdF0sXG5cdFx0XHR7XG5cdFx0XHRcdHNvcnRlcjogc29ydGVyID8/IHtcblx0XHRcdFx0XHRjb21wYXJlOiAoYSwgYikgPT4gc2VyaWFsaXplcihhKS5sb2NhbGVDb21wYXJlKHNlcmlhbGl6ZXIoYikpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpO1xuXHRcdHRoaXMubGF5b3V0KDEwMDAsIDIwMCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0UmVuZGVyZWQoZ2V0UHJvcGVydHk/OiBzdHJpbmcpIHtcblx0XHRjb25zdCBlbGVtZW50cyA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oJy5tb25hY28tdGwtY29udGVudHMnKTtcblx0XHRjb25zdCBzb3J0ZWQgPSBbLi4uZWxlbWVudHNdLnNvcnQoKGEsIGIpID0+IHBvcyhhKSAtIHBvcyhiKSk7XG5cdFx0Y29uc3QgY2hhaW46IFNlcmlhbGl6ZWRUcmVlW10gPSBbeyBlOiAnJywgY2hpbGRyZW46IFtdIH1dO1xuXHRcdGZvciAoY29uc3QgZWxlbWVudCBvZiBzb3J0ZWQpIHtcblx0XHRcdGNvbnN0IFtkZXB0aFN0ciwgbGFiZWxdID0gZWxlbWVudC50ZXh0Q29udGVudCEuc3BsaXQoJzonKTtcblx0XHRcdGNvbnN0IGRlcHRoID0gTnVtYmVyKGRlcHRoU3RyKTtcblx0XHRcdGNvbnN0IHBhcmVudCA9IGNoYWluW2RlcHRoIC0gMV07XG5cdFx0XHRjb25zdCBjaGlsZDogU2VyaWFsaXplZFRyZWUgPSB7IGU6IGxhYmVsIH07XG5cdFx0XHRpZiAoZ2V0UHJvcGVydHkpIHtcblx0XHRcdFx0Y2hpbGQuZGF0YSA9IGVsZW1lbnQuZGF0YXNldFtnZXRQcm9wZXJ0eV07XG5cdFx0XHR9XG5cdFx0XHRwYXJlbnQuY2hpbGRyZW4gPSBwYXJlbnQuY2hpbGRyZW4/LmNvbmNhdChjaGlsZCkgPz8gW2NoaWxkXTtcblx0XHRcdGNoYWluW2RlcHRoXSA9IGNoaWxkO1xuXHRcdH1cblxuXHRcdHJldHVybiBjaGFpblswXS5jaGlsZHJlbjtcblx0fVxufVxuXG5jb25zdCBwb3MgPSAoZWxlbWVudDogRWxlbWVudCkgPT4gTnVtYmVyKGVsZW1lbnQucGFyZW50RWxlbWVudCEucGFyZW50RWxlbWVudCEuZ2V0QXR0cmlidXRlKCdhcmlhLXBvc2luc2V0JykpO1xuXG5cbmNsYXNzIEJ5TGFiZWxUcmVlU29ydGVyIGltcGxlbWVudHMgSVRyZWVTb3J0ZXI8VGVzdEV4cGxvcmVyVHJlZUVsZW1lbnQ+IHtcblx0cHVibGljIGNvbXBhcmUoYTogVGVzdEV4cGxvcmVyVHJlZUVsZW1lbnQsIGI6IFRlc3RFeHBsb3JlclRyZWVFbGVtZW50KTogbnVtYmVyIHtcblx0XHRpZiAoYSBpbnN0YW5jZW9mIFRlc3RUcmVlRXJyb3JNZXNzYWdlIHx8IGIgaW5zdGFuY2VvZiBUZXN0VHJlZUVycm9yTWVzc2FnZSkge1xuXHRcdFx0cmV0dXJuIChhIGluc3RhbmNlb2YgVGVzdFRyZWVFcnJvck1lc3NhZ2UgPyAtMSA6IDApICsgKGIgaW5zdGFuY2VvZiBUZXN0VHJlZUVycm9yTWVzc2FnZSA/IDEgOiAwKTtcblx0XHR9XG5cblx0XHRpZiAoYSBpbnN0YW5jZW9mIFRlc3RJdGVtVHJlZUVsZW1lbnQgJiYgYiBpbnN0YW5jZW9mIFRlc3RJdGVtVHJlZUVsZW1lbnQgJiYgYS50ZXN0Lml0ZW0udXJpICYmIGIudGVzdC5pdGVtLnVyaSAmJiBhLnRlc3QuaXRlbS51cmkudG9TdHJpbmcoKSA9PT0gYi50ZXN0Lml0ZW0udXJpLnRvU3RyaW5nKCkgJiYgYS50ZXN0Lml0ZW0ucmFuZ2UgJiYgYi50ZXN0Lml0ZW0ucmFuZ2UpIHtcblx0XHRcdGNvbnN0IGRlbHRhID0gYS50ZXN0Lml0ZW0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIC0gYi50ZXN0Lml0ZW0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0aWYgKGRlbHRhICE9PSAwKSB7XG5cdFx0XHRcdHJldHVybiBkZWx0YTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gKGEudGVzdC5pdGVtLnNvcnRUZXh0IHx8IGEudGVzdC5pdGVtLmxhYmVsKS5sb2NhbGVDb21wYXJlKGIudGVzdC5pdGVtLnNvcnRUZXh0IHx8IGIudGVzdC5pdGVtLmxhYmVsKTtcblx0fVxufVxuXG4vLyBuYW1lcyBhcmUgaGFyZFxuZXhwb3J0IGNsYXNzIFRlc3RUcmVlVGVzdEhhcm5lc3M8VCBleHRlbmRzIElUZXN0VHJlZVByb2plY3Rpb24gPSBJVGVzdFRyZWVQcm9qZWN0aW9uPiBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IG9uRGlmZiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFRlc3RzRGlmZj4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkZvbGRlckNoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElXb3Jrc3BhY2VGb2xkZXJzQ2hhbmdlRXZlbnQ+KCkpO1xuXHRwcml2YXRlIGlzUHJvY2Vzc2luZ0RpZmYgPSBmYWxzZTtcblx0cHVibGljIHJlYWRvbmx5IHByb2plY3Rpb246IFQ7XG5cdHB1YmxpYyByZWFkb25seSB0cmVlOiBUZXN0T2JqZWN0VHJlZTxUZXN0RXhwbG9yZXJUcmVlRWxlbWVudD47XG5cblx0Y29uc3RydWN0b3IobWFrZVRyZWU6IChsaXN0ZW5lcjogSVRlc3RTZXJ2aWNlKSA9PiBULCBwdWJsaWMgcmVhZG9ubHkgYyA9IHRlc3RTdHVicy5uZXN0ZWQoKSkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYyk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jLm9uRGlkR2VuZXJhdGVEaWZmKGQgPT4gdGhpcy5jLnNldERpZmYoZCAvKiBkb24ndCBjbGVhciBkdXJpbmcgdGVzdGluZyAqLykpKTtcblxuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgTWFpblRocmVhZFRlc3RDb2xsZWN0aW9uKHsgYXNDYW5vbmljYWxVcmk6IHUgPT4gdSB9LCAodGVzdElkLCBsZXZlbHMpID0+IHtcblx0XHRcdHRoaXMuYy5leHBhbmQodGVzdElkLCBsZXZlbHMpO1xuXHRcdFx0aWYgKCF0aGlzLmlzUHJvY2Vzc2luZ0RpZmYpIHtcblx0XHRcdFx0dGhpcy5vbkRpZmYuZmlyZSh0aGlzLmMuY29sbGVjdERpZmYoKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZmYuZXZlbnQoZGlmZiA9PiBjb2xsZWN0aW9uLmFwcGx5KGRpZmYpKSk7XG5cblx0XHR0aGlzLnByb2plY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihtYWtlVHJlZSh7XG5cdFx0XHRjb2xsZWN0aW9uLFxuXHRcdFx0b25EaWRQcm9jZXNzRGlmZjogdGhpcy5vbkRpZmYuZXZlbnQsXG5cdFx0fSBhcyBhbnkpKTtcblx0XHRjb25zdCBzb3J0ZXIgPSBuZXcgQnlMYWJlbFRyZWVTb3J0ZXIoKTtcblx0XHR0aGlzLnRyZWUgPSB0aGlzLl9yZWdpc3RlcihuZXcgVGVzdE9iamVjdFRyZWUodCA9PiAndGVzdCcgaW4gdCA/IHQudGVzdC5pdGVtLmxhYmVsIDogdC5tZXNzYWdlLnRvU3RyaW5nKCksIHNvcnRlcikpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbkRpZENoYW5nZUNvbGxhcHNlU3RhdGUoZXZ0ID0+IHtcblx0XHRcdGlmIChldnQubm9kZS5lbGVtZW50IGluc3RhbmNlb2YgVGVzdEl0ZW1UcmVlRWxlbWVudCkge1xuXHRcdFx0XHR0aGlzLnByb2plY3Rpb24uZXhwYW5kRWxlbWVudChldnQubm9kZS5lbGVtZW50LCBldnQuZGVlcCA/IEluZmluaXR5IDogMCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIHB1c2hEaWZmKC4uLmRpZmY6IFRlc3RzRGlmZk9wW10pIHtcblx0XHR0aGlzLm9uRGlmZi5maXJlKGRpZmYpO1xuXHR9XG5cblx0cHVibGljIGZsdXNoKCkge1xuXHRcdHRoaXMuaXNQcm9jZXNzaW5nRGlmZiA9IHRydWU7XG5cdFx0d2hpbGUgKHRoaXMuYy5jdXJyZW50RGlmZi5sZW5ndGgpIHtcblx0XHRcdHRoaXMub25EaWZmLmZpcmUodGhpcy5jLmNvbGxlY3REaWZmKCkpO1xuXHRcdH1cblx0XHR0aGlzLmlzUHJvY2Vzc2luZ0RpZmYgPSBmYWxzZTtcblxuXHRcdHRoaXMucHJvamVjdGlvbi5hcHBseVRvKHRoaXMudHJlZSk7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5nZXRSZW5kZXJlZCgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZLHVCQUF1QjtBQUU1QyxTQUF1RCxxQkFBcUIsNEJBQTRCO0FBQ3hHLFNBQVMsZ0NBQWdDO0FBR3pDLFNBQVMsaUJBQWlCO0FBSzFCLE1BQU0sVUFBVSxTQUFTLGNBQWMsS0FBSztBQUM1QyxRQUFRLE1BQU0sU0FBUztBQUN2QixRQUFRLE1BQU0sUUFBUTtBQUV0QixNQUFNLHVCQUEwQixXQUFtQjtBQUFBLEVBQ2xELFlBQVksWUFBaUMsUUFBeUI7QUFDckU7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxRQUNDLFdBQVcsTUFBTTtBQUFBLFFBQ2pCLGVBQWUsTUFBTTtBQUFBLE1BQ3RCO0FBQUEsTUFDQTtBQUFBLFFBQ0M7QUFBQSxVQUNDLGlCQUFpQixDQUFDLEVBQUUsTUFBTSxNQUFNLE1BQU0sUUFBUTtBQUFBLFVBQzlDLGVBQWUsQ0FBQyxFQUFFLE9BQU8sU0FBQUEsU0FBUSxHQUFHLFFBQVEsRUFBRSxXQUFXLE1BQU0sTUFBTTtBQUNwRSxrQkFBTSxTQUFTLE1BQU07QUFDcEIsd0JBQVUsY0FBYyxHQUFHLEtBQUssSUFBSSxXQUFXQSxRQUFPLENBQUM7QUFDdkQscUJBQU8sT0FBTyxVQUFVLFNBQVNBLFFBQU87QUFBQSxZQUN6QztBQUNBLG1CQUFPO0FBRVAsZ0JBQUlBLG9CQUFtQixxQkFBcUI7QUFDM0Msb0JBQU0sSUFBSUEsU0FBUSxTQUFTLE1BQU0sQ0FBQztBQUFBLFlBQ25DO0FBQUEsVUFDRDtBQUFBLFVBQ0EsZ0JBQWdCLENBQUMsS0FBSyxRQUFRLEVBQUUsTUFBTSxNQUFNLE1BQU0sTUFBTTtBQUFBLFVBQ3hELGdCQUFnQixnQkFB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
