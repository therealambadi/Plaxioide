import { Emitter } from "../../../../base/common/event.js";
import { localize } from "../../../../nls.js";
import { Extensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
const IBreadcrumbsService = createDecorator("IEditorBreadcrumbsService");
class BreadcrumbsService {
  constructor() {
    this._map = /* @__PURE__ */ new Map();
  }
  register(group, widget) {
    if (this._map.has(group)) {
      throw new Error(`group (${group}) has already a widget`);
    }
    this._map.set(group, widget);
    return {
      dispose: () => this._map.delete(group)
    };
  }
  getWidget(group) {
    return this._map.get(group);
  }
}
registerSingleton(IBreadcrumbsService, BreadcrumbsService, InstantiationType.Delayed);
const _BreadcrumbsConfig = class _BreadcrumbsConfig {
  constructor() {
  }
  static _stub(name) {
    return {
      bindTo(service) {
        const onDidChange = new Emitter();
        const listener = service.onDidChangeConfiguration((e) => {
          if (e.affectsConfiguration(name)) {
            onDidChange.fire(void 0);
          }
        });
        return new class {
          constructor() {
            this.name = name;
            this.onDidChange = onDidChange.event;
          }
          getValue(overrides) {
            if (overrides) {
              return service.getValue(name, overrides);
            } else {
              return service.getValue(name);
            }
          }
          updateValue(newValue, overrides) {
            if (overrides) {
              return service.updateValue(name, newValue, overrides);
            } else {
              return service.updateValue(name, newValue);
            }
          }
          dispose() {
            listener.dispose();
            onDidChange.dispose();
          }
        }();
      }
    };
  }
};
_BreadcrumbsConfig.IsEnabled = _BreadcrumbsConfig._stub("breadcrumbs.enabled");
_BreadcrumbsConfig.UseQuickPick = _BreadcrumbsConfig._stub("breadcrumbs.useQuickPick");
_BreadcrumbsConfig.FilePath = _BreadcrumbsConfig._stub("breadcrumbs.filePath");
_BreadcrumbsConfig.SymbolPath = _BreadcrumbsConfig._stub("breadcrumbs.symbolPath");
_BreadcrumbsConfig.SymbolSortOrder = _BreadcrumbsConfig._stub("breadcrumbs.symbolSortOrder");
_BreadcrumbsConfig.Icons = _BreadcrumbsConfig._stub("breadcrumbs.icons");
_BreadcrumbsConfig.TitleScrollbarSizing = _BreadcrumbsConfig._stub("workbench.editor.titleScrollbarSizing");
_BreadcrumbsConfig.FileExcludes = _BreadcrumbsConfig._stub("files.exclude");
let BreadcrumbsConfig = _BreadcrumbsConfig;
Registry.as(Extensions.Configuration).registerConfiguration({
  id: "breadcrumbs",
  title: localize("title", "Breadcrumb Navigation"),
  order: 101,
  type: "object",
  properties: {
    "breadcrumbs.enabled": {
      description: localize("enabled", "Enable/disable navigation breadcrumbs."),
      type: "boolean",
      default: false
    },
    "breadcrumbs.filePath": {
      description: localize("filepath", "Controls whether and how file paths are shown in the breadcrumbs view."),
      type: "string",
      default: "on",
      enum: ["on", "off", "last"],
      enumDescriptions: [
        localize("filepath.on", "Show the file path in the breadcrumbs view."),
        localize("filepath.off", "Do not show the file path in the breadcrumbs view."),
        localize("filepath.last", "Only show the last element of the file path in the breadcrumbs view.")
      ]
    },
    "breadcrumbs.symbolPath": {
      description: localize("symbolpath", "Controls whether and how symbols are shown in the breadcrumbs view."),
      type: "string",
      default: "on",
      enum: ["on", "off", "last"],
      enumDescriptions: [
        localize("symbolpath.on", "Show all symbols in the breadcrumbs view."),
        localize("symbolpath.off", "Do not show symbols in the breadcrumbs view."),
        localize("symbolpath.last", "Only show the current symbol in the breadcrumbs view.")
      ]
    },
    "breadcrumbs.symbolSortOrder": {
      description: localize("symbolSortOrder", "Controls how symbols are sorted in the breadcrumbs outline view."),
      type: "string",
      default: "position",
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      enum: ["position", "name", "type"],
      enumDescriptions: [
        localize("symbolSortOrder.position", "Show symbol outline in file position order."),
        localize("symbolSortOrder.name", "Show symbol outline in alphabetical order."),
        localize("symbolSortOrder.type", "Show symbol outline in symbol type order.")
      ]
    },
    "breadcrumbs.icons": {
      description: localize("icons", "Render breadcrumb items with icons."),
      type: "boolean",
      default: true
    },
    "breadcrumbs.showFiles": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.file", "When enabled breadcrumbs show `file`-symbols.")
    },
    "breadcrumbs.showModules": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.module", "When enabled breadcrumbs show `module`-symbols.")
    },
    "breadcrumbs.showNamespaces": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.namespace", "When enabled breadcrumbs show `namespace`-symbols.")
    },
    "breadcrumbs.showPackages": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.package", "When enabled breadcrumbs show `package`-symbols.")
    },
    "breadcrumbs.showClasses": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.class", "When enabled breadcrumbs show `class`-symbols.")
    },
    "breadcrumbs.showMethods": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.method", "When enabled breadcrumbs show `method`-symbols.")
    },
    "breadcrumbs.showProperties": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.property", "When enabled breadcrumbs show `property`-symbols.")
    },
    "breadcrumbs.showFields": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.field", "When enabled breadcrumbs show `field`-symbols.")
    },
    "breadcrumbs.showConstructors": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.constructor", "When enabled breadcrumbs show `constructor`-symbols.")
    },
    "breadcrumbs.showEnums": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.enum", "When enabled breadcrumbs show `enum`-symbols.")
    },
    "breadcrumbs.showInterfaces": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.interface", "When enabled breadcrumbs show `interface`-symbols.")
    },
    "breadcrumbs.showFunctions": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.function", "When enabled breadcrumbs show `function`-symbols.")
    },
    "breadcrumbs.showVariables": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.variable", "When enabled breadcrumbs show `variable`-symbols.")
    },
    "breadcrumbs.showConstants": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.constant", "When enabled breadcrumbs show `constant`-symbols.")
    },
    "breadcrumbs.showStrings": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.string", "When enabled breadcrumbs show `string`-symbols.")
    },
    "breadcrumbs.showNumbers": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.number", "When enabled breadcrumbs show `number`-symbols.")
    },
    "breadcrumbs.showBooleans": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.boolean", "When enabled breadcrumbs show `boolean`-symbols.")
    },
    "breadcrumbs.showArrays": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.array", "When enabled breadcrumbs show `array`-symbols.")
    },
    "breadcrumbs.showObjects": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.object", "When enabled breadcrumbs show `object`-symbols.")
    },
    "breadcrumbs.showKeys": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.key", "When enabled breadcrumbs show `key`-symbols.")
    },
    "breadcrumbs.showNull": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.null", "When enabled breadcrumbs show `null`-symbols.")
    },
    "breadcrumbs.showEnumMembers": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.enumMember", "When enabled breadcrumbs show `enumMember`-symbols.")
    },
    "breadcrumbs.showStructs": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.struct", "When enabled breadcrumbs show `struct`-symbols.")
    },
    "breadcrumbs.showEvents": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.event", "When enabled breadcrumbs show `event`-symbols.")
    },
    "breadcrumbs.showOperators": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.operator", "When enabled breadcrumbs show `operator`-symbols.")
    },
    "breadcrumbs.showTypeParameters": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.typeParameter", "When enabled breadcrumbs show `typeParameter`-symbols.")
    }
  }
});
export {
  BreadcrumbsConfig,
  BreadcrumbsService,
  IBreadcrumbsService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvYnJlYWRjcnVtYnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBCcmVhZGNydW1ic1dpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9icmVhZGNydW1icy9icmVhZGNydW1ic1dpZGdldC5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZ2xvYi5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvbk92ZXJyaWRlcywgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5LCBDb25maWd1cmF0aW9uU2NvcGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEdyb3VwSWRlbnRpZmllciwgSUVkaXRvclBhcnRPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5cbmV4cG9ydCBjb25zdCBJQnJlYWRjcnVtYnNTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElCcmVhZGNydW1ic1NlcnZpY2U+KCdJRWRpdG9yQnJlYWRjcnVtYnNTZXJ2aWNlJyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUJyZWFkY3J1bWJzU2VydmljZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHJlZ2lzdGVyKGdyb3VwOiBHcm91cElkZW50aWZpZXIsIHdpZGdldDogQnJlYWRjcnVtYnNXaWRnZXQpOiBJRGlzcG9zYWJsZTtcblxuXHRnZXRXaWRnZXQoZ3JvdXA6IEdyb3VwSWRlbnRpZmllcik6IEJyZWFkY3J1bWJzV2lkZ2V0IHwgdW5kZWZpbmVkO1xufVxuXG5cbmV4cG9ydCBjbGFzcyBCcmVhZGNydW1ic1NlcnZpY2UgaW1wbGVtZW50cyBJQnJlYWRjcnVtYnNTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tYXAgPSBuZXcgTWFwPG51bWJlciwgQnJlYWRjcnVtYnNXaWRnZXQ+KCk7XG5cblx0cmVnaXN0ZXIoZ3JvdXA6IG51bWJlciwgd2lkZ2V0OiBCcmVhZGNydW1ic1dpZGdldCk6IElEaXNwb3NhYmxlIHtcblx0XHRpZiAodGhpcy5fbWFwLmhhcyhncm91cCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgZ3JvdXAgKCR7Z3JvdXB9KSBoYXMgYWxyZWFkeSBhIHdpZGdldGApO1xuXHRcdH1cblx0XHR0aGlzLl9tYXAuc2V0KGdyb3VwLCB3aWRnZXQpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB0aGlzLl9tYXAuZGVsZXRlKGdyb3VwKVxuXHRcdH07XG5cdH1cblxuXHRnZXRXaWRnZXQoZ3JvdXA6IG51bWJlcik6IEJyZWFkY3J1bWJzV2lkZ2V0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fbWFwLmdldChncm91cCk7XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSUJyZWFkY3J1bWJzU2VydmljZSwgQnJlYWRjcnVtYnNTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcblxuXG4vLyNyZWdpb24gY29uZmlnXG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCcmVhZGNydW1ic0NvbmZpZzxUPiB7XG5cblx0YWJzdHJhY3QgZ2V0IG5hbWUoKTogc3RyaW5nO1xuXHRhYnN0cmFjdCBnZXQgb25EaWRDaGFuZ2UoKTogRXZlbnQ8dm9pZD47XG5cblx0YWJzdHJhY3QgZ2V0VmFsdWUob3ZlcnJpZGVzPzogSUNvbmZpZ3VyYXRpb25PdmVycmlkZXMpOiBUO1xuXHRhYnN0cmFjdCB1cGRhdGVWYWx1ZSh2YWx1ZTogVCwgb3ZlcnJpZGVzPzogSUNvbmZpZ3VyYXRpb25PdmVycmlkZXMpOiBQcm9taXNlPHZvaWQ+O1xuXHRhYnN0cmFjdCBkaXNwb3NlKCk6IHZvaWQ7XG5cblx0cHJpdmF0ZSBjb25zdHJ1Y3RvcigpIHtcblx0XHQvLyBpbnRlcm5hbFxuXHR9XG5cblx0c3RhdGljIHJlYWRvbmx5IElzRW5hYmxlZCA9IEJyZWFkY3J1bWJzQ29uZmlnLl9zdHViPGJvb2xlYW4+KCdicmVhZGNydW1icy5lbmFibGVkJyk7XG5cdHN0YXRpYyByZWFkb25seSBVc2VRdWlja1BpY2sgPSBCcmVhZGNydW1ic0NvbmZpZy5fc3R1Yjxib29sZWFuPignYnJlYWRjcnVtYnMudXNlUXVpY2tQaWNrJyk7XG5cdHN0YXRpYyByZWFkb25seSBGaWxlUGF0aCA9IEJyZWFkY3J1bWJzQ29uZmlnLl9zdHViPCdvbicgfCAnb2ZmJyB8ICdsYXN0Jz4oJ2JyZWFkY3J1bWJzLmZpbGVQYXRoJyk7XG5cdHN0YXRpYyByZWFkb25seSBTeW1ib2xQYXRoID0gQnJlYWRjcnVtYnNDb25maWcuX3N0dWI8J29uJyB8ICdvZmYnIHwgJ2xhc3QnPignYnJlYWRjcnVtYnMuc3ltYm9sUGF0aCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgU3ltYm9sU29ydE9yZGVyID0gQnJlYWRjcnVtYnNDb25maWcuX3N0dWI8J3Bvc2l0aW9uJyB8ICduYW1lJyB8ICd0eXBlJz4oJ2JyZWFkY3J1bWJzLnN5bWJvbFNvcnRPcmRlcicpO1xuXHRzdGF0aWMgcmVhZG9ubHkgSWNvbnMgPSBCcmVhZGNydW1ic0NvbmZpZy5fc3R1Yjxib29sZWFuPignYnJlYWRjcnVtYnMuaWNvbnMnKTtcblx0c3RhdGljIHJlYWRvbmx5IFRpdGxlU2Nyb2xsYmFyU2l6aW5nID0gQnJlYWRjcnVtYnNDb25maWcuX3N0dWI8SUVkaXRvclBhcnRPcHRpb25zWyd0aXRsZVNjcm9sbGJhclNpemluZyddPignd29ya2JlbmNoLmVkaXRvci50aXRsZVNjcm9sbGJhclNpemluZycpO1xuXG5cdHN0YXRpYyByZWFkb25seSBGaWxlRXhjbHVkZXMgPSBCcmVhZGNydW1ic0NvbmZpZy5fc3R1YjxnbG9iLklFeHByZXNzaW9uPignZmlsZXMuZXhjbHVkZScpO1xuXG5cdHByaXZhdGUgc3RhdGljIF9zdHViPFQ+KG5hbWU6IHN0cmluZyk6IHsgYmluZFRvKHNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSk6IEJyZWFkY3J1bWJzQ29uZmlnPFQ+IH0ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRiaW5kVG8oc2VydmljZSkge1xuXHRcdFx0XHRjb25zdCBvbkRpZENoYW5nZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cblx0XHRcdFx0Y29uc3QgbGlzdGVuZXIgPSBzZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihuYW1lKSkge1xuXHRcdFx0XHRcdFx0b25EaWRDaGFuZ2UuZmlyZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0cmV0dXJuIG5ldyBjbGFzcyBpbXBsZW1lbnRzIEJyZWFkY3J1bWJzQ29uZmlnPFQ+IHtcblx0XHRcdFx0XHRyZWFkb25seSBuYW1lID0gbmFtZTtcblx0XHRcdFx0XHRyZWFkb25seSBvbkRpZENoYW5nZSA9IG9uRGlkQ2hhbmdlLmV2ZW50O1xuXHRcdFx0XHRcdGdldFZhbHVlKG92ZXJyaWRlcz86IElDb25maWd1cmF0aW9uT3ZlcnJpZGVzKTogVCB7XG5cdFx0XHRcdFx0XHRpZiAob3ZlcnJpZGVzKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBzZXJ2aWNlLmdldFZhbHVlKG5hbWUsIG92ZXJyaWRlcyk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gc2VydmljZS5nZXRWYWx1ZShuYW1lKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dXBkYXRlVmFsdWUobmV3VmFsdWU6IFQsIG92ZXJyaWRlcz86IElDb25maWd1cmF0aW9uT3ZlcnJpZGVzKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdFx0XHRpZiAob3ZlcnJpZGVzKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBzZXJ2aWNlLnVwZGF0ZVZhbHVlKG5hbWUsIG5ld1ZhbHVlLCBvdmVycmlkZXMpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHNlcnZpY2UudXBkYXRlVmFsdWUobmFtZSwgbmV3VmFsdWUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdFx0XHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0b25EaWRDaGFuZ2UuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbikucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0aWQ6ICdicmVhZGNydW1icycsXG5cdHRpdGxlOiBsb2NhbGl6ZSgndGl0bGUnLCBcIkJyZWFkY3J1bWIgTmF2aWdhdGlvblwiKSxcblx0b3JkZXI6IDEwMSxcblx0dHlwZTogJ29iamVjdCcsXG5cdHByb3BlcnRpZXM6IHtcblx0XHQnYnJlYWRjcnVtYnMuZW5hYmxlZCc6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZW5hYmxlZCcsIFwiRW5hYmxlL2Rpc2FibGUgbmF2aWdhdGlvbiBicmVhZGNydW1icy5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdFx0J2JyZWFkY3J1bWJzLmZpbGVQYXRoJzoge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWxlcGF0aCcsIFwiQ29udHJvbHMgd2hldGhlciBhbmQgaG93IGZpbGUgcGF0aHMgYXJlIHNob3duIGluIHRoZSBicmVhZGNydW1icyB2aWV3LlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZGVmYXVsdDogJ29uJyxcblx0XHRcdGVudW06IFsnb24nLCAnb2ZmJywgJ2xhc3QnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ2ZpbGVwYXRoLm9uJywgXCJTaG93IHRoZSBmaWxlIHBhdGggaW4gdGhlIGJyZWFkY3J1bWJzIHZpZXcuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnZmlsZXBhdGgub2ZmJywgXCJEbyBub3Qgc2hvdyB0aGUgZmlsZSBwYXRoIGluIHRoZSBicmVhZGNydW1icyB2aWV3LlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ2ZpbGVwYXRoLmxhc3QnLCBcIk9ubHkgc2hvdyB0aGUgbGFzdCBlbGVtZW50IG9mIHRoZSBmaWxlIHBhdGggaW4gdGhlIGJyZWFkY3J1bWJzIHZpZXcuXCIpLFxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0J2JyZWFkY3J1bWJzLnN5bWJvbFBhdGgnOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3N5bWJvbHBhdGgnLCBcIkNvbnRyb2xzIHdoZXRoZXIgYW5kIGhvdyBzeW1ib2xzIGFyZSBzaG93biBpbiB0aGUgYnJlYWRjcnVtYnMgdmlldy5cIiksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGRlZmF1bHQ6ICdvbicsXG5cdFx0XHRlbnVtOiBbJ29uJywgJ29mZicsICdsYXN0J10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCdzeW1ib2xwYXRoLm9uJywgXCJTaG93IGFsbCBzeW1ib2xzIGluIHRoZSBicmVhZGNydW1icyB2aWV3LlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3N5bWJvbHBhdGgub2ZmJywgXCJEbyBub3Qgc2hvdyBzeW1ib2xzIGluIHRoZSBicmVhZGNydW1icyB2aWV3LlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3N5bWJvbHBhdGgubGFzdCcsIFwiT25seSBzaG93IHRoZSBjdXJyZW50IHN5bWJvbCBpbiB0aGUgYnJlYWRjcnVtYnMgdmlldy5cIiksXG5cdFx0XHRdXG5cdFx0fSxcblx0XHQnYnJlYWRjcnVtYnMuc3ltYm9sU29ydE9yZGVyJzoge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzeW1ib2xTb3J0T3JkZXInLCBcIkNvbnRyb2xzIGhvdyBzeW1ib2xzIGFyZSBzb3J0ZWQgaW4gdGhlIGJyZWFkY3J1bWJzIG91dGxpbmUgdmlldy5cIiksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGRlZmF1bHQ6ICdwb3NpdGlvbicsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0ZW51bTogWydwb3NpdGlvbicsICduYW1lJywgJ3R5cGUnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ3N5bWJvbFNvcnRPcmRlci5wb3NpdGlvbicsIFwiU2hvdyBzeW1ib2wgb3V0bGluZSBpbiBmaWxlIHBvc2l0aW9uIG9yZGVyLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3N5bWJvbFNvcnRPcmRlci5uYW1lJywgXCJTaG93IHN5bWJvbCBvdXRsaW5lIGluIGFscGhhYmV0aWNhbCBvcmRlci5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCdzeW1ib2xTb3J0T3JkZXIudHlwZScsIFwiU2hvdyBzeW1ib2wgb3V0bGluZSBpbiBzeW1ib2wgdHlwZSBvcmRlci5cIiksXG5cdFx0XHRdXG5cdFx0fSxcblx0XHQnYnJlYWRjcnVtYnMuaWNvbnMnOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ljb25zJywgXCJSZW5kZXIgYnJlYWRjcnVtYiBpdGVtcyB3aXRoIGljb25zLlwiKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHR9LFxuXHRcdCdicmVhZGNydW1icy5zaG93RmlsZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLmZpbGUnLCBcIldoZW4gZW5hYmxlZCBicmVhZGNydW1icyBzaG93IGBmaWxlYC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J2JyZWFkY3J1bWJzLnNob3dNb2R1bGVzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5tb2R1bGUnLCBcIldoZW4gZW5hYmxlZCBicmVhZGNydW1icyBzaG93IGBtb2R1bGVgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnYnJlYWRjcnVtYnMuc2hvd05hbWVzcGFjZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLm5hbWVzcGFjZScsIFwiV2hlbiBlbmFibGVkIGJyZWFkY3J1bWJzIHNob3cgYG5hbWVzcGFjZWAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdicmVhZGNydW1icy5zaG93UGFja2FnZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLnBhY2thZ2UnLCBcIldoZW4gZW5hYmxlZCBicmVhZGNydW1icyBzaG93IGBwYWNrYWdlYC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J2JyZWFkY3J1bWJzLnNob3dDbGFzc2VzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5jbGFzcycsIFwiV2hlbiBlbmFibGVkIGJyZWFkY3J1bWJzIHNob3cgYGNsYXNzYC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J2JyZWFkY3J1bWJzLnNob3dNZXRob2RzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5tZXRob2QnLCBcIldoZW4gZW5hYmxlZCBicmVhZGNydW1icyBzaG93IGBtZXRob2RgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnYnJlYWRjcnVtYnMuc2hvd1Byb3BlcnRpZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLnByb3BlcnR5JywgXCJXaGVuIGVuYWJsZWQgYnJlYWRjcnVtYnMgc2hvdyBgcHJvcGVydHlgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnYnJlYWRjcnVtYnMuc2hvd0ZpZWxkcyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMuZmllbGQnLCBcIldoZW4gZW5hYmxlZCBicmVhZGNydW1icyBzaG93IGBmaWVsZGAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdicmVhZGNydW1icy5zaG93Q29uc3RydWN0b3JzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5jb25zdHJ1Y3RvcicsIFwiV2hlbiBlbmFibGVkIGJyZWFkY3J1bWJzIHNob3cgYGNvbnN0cnVjdG9yYC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J2JyZWFkY3J1bWJzLnNob3dFbnVtcyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMuZW51bScsIFwiV2hlbiBlbmFibGVkIGJyZWFkY3J1bWJzIHNob3cgYGVudW1gLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnYnJlYWRjcnVtYnMuc2hvd0ludGVyZmFjZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLmludGVyZmFjZScsIFwiV2hlbiBlbmFibGVkIGJyZWFkY3J1bWJzIHNob3cgYGludGVyZmFjZWAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdicmVhZGNydW1icy5zaG93RnVuY3Rpb25zJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5mdW5jdGlvbicsIFwiV2hlbiBlbmFibGVkIGJyZWFkY3J1bWJzIHNob3cgYGZ1bmN0aW9uYC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J2JyZWFkY3J1bWJzLnNob3dWYXJpYWJsZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLnZhcmlhYmxlJywgXCJXaGVuIGVuYWJsZWQgYnJlYWRjcnVtYnMgc2hvdyBgdmFyaWFibGVgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnYnJlYWRjcnVtYnMuc2hvd0NvbnN0YW50cyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMuY29uc3RhbnQnLCBcIldoZW4gZW5hYmxlZCBicmVhZGNydW1icyBzaG93IGBjb25zdGFudGAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdicmVhZGNydW1icy5zaG93U3RyaW5ncyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMuc3RyaW5nJywgXCJXaGVuIGVuYWJsZWQgYnJlYWRjcnVtYnMgc2hvdyBgc3RyaW5nYC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J2JyZWFkY3J1bWJzLnNob3dOdW1iZXJzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5udW1iZXInLCBcIldoZW4gZW5hYmxlZCBicmVhZGNydW1icyBzaG93IGBudW1iZXJgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnYnJlYWRjcnVtYnMuc2hvd0Jvb2xlYW5zJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5ib29sZWFuJywgXCJXaGVuIGVuYWJsZWQgYnJlYWRjcnVtYnMgc2hvdyBgYm9vbGVhbmAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdicmVhZGNydW1icy5zaG93QXJyYXlzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5hcnJheScsIFwiV2hlbiBlbmFibGVkIGJyZWFkY3J1bWJzIHNob3cgYGFycmF5YC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J2JyZWFkY3J1bWJzLnNob3dPYmplY3RzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5vYmplY3QnLCBcIldoZW4gZW5hYmxlZCBicmVhZGNydW1icyBzaG93IGBvYmplY3RgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnYnJlYWRjcnVtYnMuc2hvd0tleXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLmtleScsIFwiV2hlbiBlbmFibGVkIGJyZWFkY3J1bWJzIHNob3cgYGtleWAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdicmVhZGNydW1icy5zaG93TnVsbCc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMubnVsbCcsIFwiV2hlbiBlbmFibGVkIGJyZWFkY3J1bWJzIHNob3cgYG51bGxgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnYnJlYWRjcnVtYnMuc2hvd0VudW1NZW1iZXJzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5lbnVtTWVtYmVyJywgXCJXaGVuIGVuYWJsZWQgYnJlYWRjcnVtYnMgc2hvdyBgZW51bU1lbWJlcmAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdicmVhZGNydW1icy5zaG93U3RydWN0cyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMuc3RydWN0JywgXCJXaGVuIGVuYWJsZWQgYnJlYWRjcnVtYnMgc2hvdyBgc3RydWN0YC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J2JyZWFkY3J1bWJzLnNob3dFdmVudHMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLmV2ZW50JywgXCJXaGVuIGVuYWJsZWQgYnJlYWRjcnVtYnMgc2hvdyBgZXZlbnRgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnYnJlYWRjcnVtYnMuc2hvd09wZXJhdG9ycyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMub3BlcmF0b3InLCBcIldoZW4gZW5hYmxlZCBicmVhZGNydW1icyBzaG93IGBvcGVyYXRvcmAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdicmVhZGNydW1icy5zaG93VHlwZVBhcmFtZXRlcnMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLnR5cGVQYXJhbWV0ZXInLCBcIldoZW4gZW5hYmxlZCBicmVhZGNydW1icyBzaG93IGB0eXBlUGFyYW1ldGVyYC1zeW1ib2xzLlwiKVxuXHRcdH1cblx0fVxufSk7XG5cbi8vI2VuZHJlZ2lvblxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUyxlQUFzQjtBQUcvQixTQUFTLGdCQUFnQjtBQUV6QixTQUFTLFlBQW9DLDBCQUEwQjtBQUN2RSxTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxnQkFBZ0I7QUFHbEIsTUFBTSxzQkFBc0IsZ0JBQXFDLDJCQUEyQjtBQVk1RixNQUFNLG1CQUFrRDtBQUFBLEVBQXhEO0FBSU4sU0FBaUIsT0FBTyxvQkFBSSxJQUErQjtBQUFBO0FBQUEsRUFFM0QsU0FBUyxPQUFlLFFBQXdDO0FBQy9ELFFBQUksS0FBSyxLQUFLLElBQUksS0FBSyxHQUFHO0FBQ3pCLFlBQU0sSUFBSSxNQUFNLFVBQVUsS0FBSyx3QkFBd0I7QUFBQSxJQUN4RDtBQUNBLFNBQUssS0FBSyxJQUFJLE9BQU8sTUFBTTtBQUMzQixXQUFPO0FBQUEsTUFDTixTQUFTLE1BQU0sS0FBSyxLQUFLLE9BQU8sS0FB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
