var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { reset } from "../../../../base/browser/dom.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, observableFromEvent } from "../../../../base/common/observable.js";
import { assertType } from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { MenuEntryActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { observableMemento } from "../../../../platform/observable/common/observableMemento.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ILanguageModelToolsService, ToolDataSource } from "../common/languageModelToolsService.js";
const storedTools = observableMemento({
  defaultValue: {},
  key: "chat/selectedTools"
});
let ChatSelectedTools = class extends Disposable {
  constructor(toolsService, instaService, storageService) {
    super();
    this._selectedTools = this._register(storedTools(StorageScope.WORKSPACE, StorageTarget.MACHINE, storageService));
    const allTools = observableFromEvent(
      toolsService.onDidChangeTools,
      () => Array.from(toolsService.getTools()).filter((t) => t.supportsToolPicker)
    );
    const disabledData = this._selectedTools.map((data) => {
      return (data.disabledBuckets?.length || data.disabledTools?.length) && {
        buckets: new Set(data.disabledBuckets),
        toolIds: new Set(data.disabledTools)
      };
    });
    this.tools = derived((r) => {
      const disabled = disabledData.read(r);
      const tools = allTools.read(r);
      if (!disabled) {
        return tools;
      }
      return tools.filter(
        (t) => !(disabled.toolIds.has(t.id) || disabled.buckets.has(ToolDataSource.toKey(t.source)))
      );
    });
    const toolsCount = derived((r) => {
      const count = allTools.read(r).length;
      const enabled = this.tools.read(r).length;
      return { count, enabled };
    });
    const onDidRender = this._store.add(new Emitter());
    this.toolsActionItemViewItemProvider = Object.assign(
      (action, options) => {
        if (!(action instanceof MenuItemAction)) {
          return void 0;
        }
        return instaService.createInstance(class extends MenuEntryActionViewItem {
          render(container) {
            this.options.icon = false;
            this.options.label = true;
            container.classList.add("chat-mcp");
            super.render(container);
          }
          updateLabel() {
            this._store.add(autorun((r) => {
              assertType(this.label);
              const { enabled, count } = toolsCount.read(r);
              const message = count === 0 ? "$(tools)" : enabled !== count ? localize("tool.1", "{0} {1} of {2}", "$(tools)", enabled, count) : localize("tool.0", "{0} {1}", "$(tools)", count);
              reset(this.label, ...renderLabelWithIcons(message));
              if (this.element?.isConnected) {
                onDidRender.fire();
              }
            }));
          }
        }, action, { ...options, keybindingNotRenderedWithLabel: true });
      },
      { onDidRender: onDidRender.event }
    );
  }
  update(disableBuckets, disableTools) {
    this._selectedTools.set({
      disabledBuckets: disableBuckets.map(ToolDataSource.toKey),
      disabledTools: disableTools.map((t) => t.id)
    }, void 0);
  }
};
ChatSelectedTools = __decorateClass([
  __decorateParam(0, ILanguageModelToolsService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IStorageService)
], ChatSelectedTools);
export {
  ChatSelectedTools
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFNlbGVjdGVkVG9vbHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cbmltcG9ydCB7IHJlc2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uVmlld0l0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyByZW5kZXJMYWJlbFdpdGhJY29ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgZGVyaXZlZCwgSU9ic2VydmFibGUsIG9ic2VydmFibGVGcm9tRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGFzc2VydFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBNZW51RW50cnlBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBNZW51SXRlbUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlTWVtZW50bywgb2JzZXJ2YWJsZU1lbWVudG8gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vYnNlcnZhYmxlL2NvbW1vbi9vYnNlcnZhYmxlTWVtZW50by5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UsIElUb29sRGF0YSwgVG9vbERhdGFTb3VyY2UgfSBmcm9tICcuLi9jb21tb24vbGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5qcyc7XG5cbi8qKlxuICogTmV3IHRvb2xzIGFuZCBuZXcgdG9vbCBzb3VyY2VzIHRoYXQgY29tZSBpbiBzaG91bGQgZ2VuZXJhbGx5IGJlIGVuYWJsZWQgdW50aWxcbiAqIHRoZSB1c2VyIGRpc2FibGVzIHRoZW0uIFRvIHN0b3JlIHRoaW5ncywgd2Ugc3RvcmUgb25seSB0aGUgYnVja2V0cyBhbmRcbiAqIGluZGl2aWR1YWwgdG9vbHMgdGhhdCB3ZXJlIGRpc2FibGVkLCBzbyB0aGUgbmV3IGRhdGEgc291cmNlcyB0aGF0IGNvbWUgaW5cbiAqIGFyZSBlbmFibGVkLCBhbmQgbmV3IHRvb2xzIHRoYXQgY29tZSBpbiBmb3IgZGF0YSBzb3VyY2VzIG5vdCBkaXNhYmxlZCBhcmVcbiAqIGFsc28gZW5hYmxlZC5cbiAqL1xudHlwZSBTdG9yZWREYXRhID0geyBkaXNhYmxlZEJ1Y2tldHM/OiAvKiBUb29sRGF0YVNvdXJjZS50b0tleSAqLyByZWFkb25seSBzdHJpbmdbXTsgZGlzYWJsZWRUb29scz86IHJlYWRvbmx5IHN0cmluZ1tdIH07XG5cbmNvbnN0IHN0b3JlZFRvb2xzID0gb2JzZXJ2YWJsZU1lbWVudG88U3RvcmVkRGF0YT4oe1xuXHRkZWZhdWx0VmFsdWU6IHt9LFxuXHRrZXk6ICdjaGF0L3NlbGVjdGVkVG9vbHMnLFxufSk7XG5cbmV4cG9ydCBjbGFzcyBDaGF0U2VsZWN0ZWRUb29scyBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NlbGVjdGVkVG9vbHM6IE9ic2VydmFibGVNZW1lbnRvPFN0b3JlZERhdGE+O1xuXG5cdHJlYWRvbmx5IHRvb2xzOiBJT2JzZXJ2YWJsZTxJVG9vbERhdGFbXT47XG5cblx0cmVhZG9ubHkgdG9vbHNBY3Rpb25JdGVtVmlld0l0ZW1Qcm92aWRlcjogSUFjdGlvblZpZXdJdGVtUHJvdmlkZXIgJiB7IG9uRGlkUmVuZGVyOiBFdmVudDx2b2lkPiB9O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSB0b29sc1NlcnZpY2U6IElMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fc2VsZWN0ZWRUb29scyA9IHRoaXMuX3JlZ2lzdGVyKHN0b3JlZFRvb2xzKFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSwgc3RvcmFnZVNlcnZpY2UpKTtcblxuXHRcdGNvbnN0IGFsbFRvb2xzID0gb2JzZXJ2YWJsZUZyb21FdmVudChcblx0XHRcdHRvb2xzU2VydmljZS5vbkRpZENoYW5nZVRvb2xzLFxuXHRcdFx0KCkgPT4gQXJyYXkuZnJvbSh0b29sc1NlcnZpY2UuZ2V0VG9vbHMoKSkuZmlsdGVyKHQgPT4gdC5zdXBwb3J0c1Rvb2xQaWNrZXIpXG5cdFx0KTtcblxuXHRcdGNvbnN0IGRpc2FibGVkRGF0YSA9IHRoaXMuX3NlbGVjdGVkVG9vbHMubWFwKGRhdGEgPT4ge1xuXHRcdFx0cmV0dXJuIChkYXRhLmRpc2FibGVkQnVja2V0cz8ubGVuZ3RoIHx8IGRhdGEuZGlzYWJsZWRUb29scz8ubGVuZ3RoKSAmJiB7XG5cdFx0XHRcdGJ1Y2tldHM6IG5ldyBTZXQoZGF0YS5kaXNhYmxlZEJ1Y2tldHMpLFxuXHRcdFx0XHR0b29sSWRzOiBuZXcgU2V0KGRhdGEuZGlzYWJsZWRUb29scyksXG5cdFx0XHR9O1xuXHRcdH0pO1xuXG5cdFx0dGhpcy50b29scyA9IGRlcml2ZWQociA9PiB7XG5cdFx0XHRjb25zdCBkaXNhYmxlZCA9IGRpc2FibGVkRGF0YS5yZWFkKHIpO1xuXHRcdFx0Y29uc3QgdG9vbHMgPSBhbGxUb29scy5yZWFkKHIpO1xuXHRcdFx0aWYgKCFkaXNhYmxlZCkge1xuXHRcdFx0XHRyZXR1cm4gdG9vbHM7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0b29scy5maWx0ZXIodCA9PlxuXHRcdFx0XHQhKGRpc2FibGVkLnRvb2xJZHMuaGFzKHQuaWQpIHx8IGRpc2FibGVkLmJ1Y2tldHMuaGFzKFRvb2xEYXRhU291cmNlLnRvS2V5KHQuc291cmNlKSkpXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdG9vbHNDb3VudCA9IGRlcml2ZWQociA9PiB7XG5cdFx0XHRjb25zdCBjb3VudCA9IGFsbFRvb2xzLnJlYWQocikubGVuZ3RoO1xuXHRcdFx0Y29uc3QgZW5hYmxlZCA9IHRoaXMudG9vbHMucmVhZChyKS5sZW5ndGg7XG5cdFx0XHRyZXR1cm4geyBjb3VudCwgZW5hYmxlZCB9O1xuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgb25EaWRSZW5kZXIgPSB0aGlzLl9zdG9yZS5hZGQobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cblx0XHR0aGlzLnRvb2xzQWN0aW9uSXRlbVZpZXdJdGVtUHJvdmlkZXIgPSBPYmplY3QuYXNzaWduKFxuXHRcdFx0KGFjdGlvbjogSUFjdGlvbiwgb3B0aW9uczogSUFjdGlvblZpZXdJdGVtT3B0aW9ucykgPT4ge1xuXHRcdFx0XHRpZiAoIShhY3Rpb24gaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbikpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShjbGFzcyBleHRlbmRzIE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtIHtcblxuXHRcdFx0XHRcdG92ZXJyaWRlIHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0XHRcdFx0XHR0aGlzLm9wdGlvbnMuaWNvbiA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0dGhpcy5vcHRpb25zLmxhYmVsID0gdHJ1ZTtcblx0XHRcdFx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdjaGF0LW1jcCcpO1xuXHRcdFx0XHRcdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cHJvdGVjdGVkIG92ZXJyaWRlIHVwZGF0ZUxhYmVsKCk6IHZvaWQge1xuXHRcdFx0XHRcdFx0dGhpcy5fc3RvcmUuYWRkKGF1dG9ydW4ociA9PiB7XG5cdFx0XHRcdFx0XHRcdGFzc2VydFR5cGUodGhpcy5sYWJlbCk7XG5cblx0XHRcdFx0XHRcdFx0Y29uc3QgeyBlbmFibGVkLCBjb3VudCB9ID0gdG9vbHNDb3VudC5yZWFkKHIpO1xuXG5cdFx0XHRcdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBjb3VudCA9PT0gMFxuXHRcdFx0XHRcdFx0XHRcdD8gJyQodG9vbHMpJ1xuXHRcdFx0XHRcdFx0XHRcdDogZW5hYmxlZCAhPT0gY291bnRcblx0XHRcdFx0XHRcdFx0XHRcdD8gbG9jYWxpemUoJ3Rvb2wuMScsIFwiezB9IHsxfSBvZiB7Mn1cIiwgJyQodG9vbHMpJywgZW5hYmxlZCwgY291bnQpXG5cdFx0XHRcdFx0XHRcdFx0XHQ6IGxvY2FsaXplKCd0b29sLjAnLCBcInswfSB7MX1cIiwgJyQodG9vbHMpJywgY291bnQpO1xuXG5cdFx0XHRcdFx0XHRcdHJlc2V0KHRoaXMubGFiZWwsIC4uLnJlbmRlckxhYmVsV2l0aEljb25zKG1lc3NhZ2UpKTtcblx0XHRcdFx0XHRcdFx0aWYgKHRoaXMuZWxlbWVudD8uaXNDb25uZWN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRvbkRpZFJlbmRlci5maXJlKCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0fSwgYWN0aW9uLCB7IC4uLm9wdGlvbnMsIGtleWJpbmRpbmdOb3RSZW5kZXJlZFdpdGhMYWJlbDogdHJ1ZSB9KTtcblx0XHRcdH0sXG5cdFx0XHR7IG9uRGlkUmVuZGVyOiBvbkRpZFJlbmRlci5ldmVudCB9XG5cdFx0KTtcblx0fVxuXG5cdHVwZGF0ZShkaXNhYmxlQnVja2V0czogcmVhZG9ubHkgVG9vbERhdGFTb3VyY2VbXSwgZGlzYWJsZVRvb2xzOiByZWFkb25seSBJVG9vbERhdGFbXSk6IHZvaWQge1xuXHRcdHRoaXMuX3NlbGVjdGVkVG9vbHMuc2V0KHtcblx0XHRcdGRpc2FibGVkQnVja2V0czogZGlzYWJsZUJ1Y2tldHMubWFwKFRvb2xEYXRhU291cmNlLnRvS2V5KSxcblx0XHRcdGRpc2FibGVkVG9vbHM6IGRpc2FibGVUb29scy5tYXAodCA9PiB0LmlkKVxuXHRcdH0sIHVuZGVmaW5lZCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyxhQUFhO0FBR3RCLFNBQVMsNEJBQTRCO0FBRXJDLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxTQUFTLFNBQXNCLDJCQUEyQjtBQUNuRSxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDZCQUE2QjtBQUN0QyxTQUE0Qix5QkFBeUI7QUFDckQsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBUyw0QkFBdUMsc0JBQXNCO0FBV3RFLE1BQU0sY0FBYyxrQkFBOEI7QUFBQSxFQUNqRCxjQUFjLENBQUM7QUFBQSxFQUNmLEtBQUs7QUFDTixDQUFDO0FBRU0sSUFBTSxvQkFBTixjQUFnQyxXQUFXO0FBQUEsRUFRakQsWUFDNkIsY0FDTCxjQUNOLGdCQUNoQjtBQUNELFVBQU07QUFFTixTQUFLLGlCQUFpQixLQUFLLFVBQVUsWUFBWSxhQUFhLFdBQVcsY0FBYyxTQUFTLGNBQWMsQ0FBQztBQUUvRyxVQUFNLFdBQVc7QUFBQSxNQUNoQixhQUFhO0FBQUEsTUFDYixNQUFNLE1BQU0sS0FBSyxh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
