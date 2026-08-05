import * as nls from "../../../nls.js";
import { ExtensionsRegistry } from "../../services/extensions/common/extensionsRegistry.js";
import * as resources from "../../../base/common/resources.js";
import { isString } from "../../../base/common/types.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Extensions } from "../../services/extensionManagement/common/extensionFeatures.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { SyncDescriptor } from "../../../platform/instantiation/common/descriptors.js";
import { MarkdownString } from "../../../base/common/htmlContent.js";
const configurationExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "jsonValidation",
  defaultExtensionKind: ["workspace", "web"],
  jsonSchema: {
    description: nls.localize("contributes.jsonValidation", "Contributes json schema configuration."),
    type: "array",
    defaultSnippets: [{ body: [{ fileMatch: "${1:file.json}", url: "${2:url}" }] }],
    items: {
      type: "object",
      defaultSnippets: [{ body: { fileMatch: "${1:file.json}", url: "${2:url}" } }],
      properties: {
        fileMatch: {
          type: ["string", "array"],
          description: nls.localize("contributes.jsonValidation.fileMatch", `The file pattern (or an array of patterns) to match, for example "package.json" or "*.launch". Exclusion patterns start with '!'`),
          items: {
            type: ["string"]
          }
        },
        url: {
          description: nls.localize("contributes.jsonValidation.url", "A schema URL ('http:', 'https:') or relative path to the extension folder ('./')."),
          type: "string"
        }
      }
    }
  }
});
class JSONValidationExtensionPoint {
  constructor() {
    configurationExtPoint.setHandler((extensions) => {
      for (const extension of extensions) {
        const extensionValue = extension.value;
        const collector = extension.collector;
        const extensionLocation = extension.description.extensionLocation;
        if (!extensionValue || !Array.isArray(extensionValue)) {
          collector.error(nls.localize("invalid.jsonValidation", "'configuration.jsonValidation' must be a array"));
          return;
        }
        extensionValue.forEach((extension2) => {
          if (!isString(extension2.fileMatch) && !(Array.isArray(extension2.fileMatch) && extension2.fileMatch.every(isString))) {
            collector.error(nls.localize("invalid.fileMatch", "'configuration.jsonValidation.fileMatch' must be defined as a string or an array of strings."));
            return;
          }
          const uri = extension2.url;
          if (!isString(uri)) {
            collector.error(nls.localize("invalid.url", "'configuration.jsonValidation.url' must be a URL or relative path"));
            return;
          }
          if (uri.startsWith("./")) {
            try {
              const colorThemeLocation = resources.joinPath(extensionLocation, uri);
              if (!resources.isEqualOrParent(colorThemeLocation, extensionLocation)) {
                collector.warn(nls.localize("invalid.path.1", "Expected `contributes.{0}.url` ({1}) to be included inside extension's folder ({2}). This might make the extension non-portable.", configurationExtPoint.name, colorThemeLocation.toString(), extensionLocation.path));
              }
            } catch (e) {
              collector.error(nls.localize("invalid.url.fileschema", "'configuration.jsonValidation.url' is an invalid relative URL: {0}", e.message));
            }
          } else if (!/^[^:/?#]+:\/\//.test(uri)) {
            collector.error(nls.localize("invalid.url.schema", "'configuration.jsonValidation.url' must be an absolute URL or start with './'  to reference schemas located in the extension."));
            return;
          }
        });
      }
    });
  }
}
class JSONValidationDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.jsonValidation;
  }
  render(manifest) {
    const contrib = manifest.contributes?.jsonValidation || [];
    if (!contrib.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      nls.localize("fileMatch", "File Match"),
      nls.localize("schema", "Schema")
    ];
    const rows = contrib.map((v) => {
      return [
        new MarkdownString().appendMarkdown(`\`${Array.isArray(v.fileMatch) ? v.fileMatch.join(", ") : v.fileMatch}\``),
        v.url
      ];
    });
    return {
      data: {
        headers,
        rows
      },
      dispose: () => {
      }
    };
  }
}
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "jsonValidation",
  label: nls.localize("jsonValidation", "JSON Validation"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(JSONValidationDataRenderer)
});
export {
  JSONValidationExtensionPoint
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9qc29uVmFsaWRhdGlvbkV4dGVuc2lvblBvaW50LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuaW1wb3J0ICogYXMgcmVzb3VyY2VzIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBpc1N0cmluZyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUV4dGVuc2lvbkZlYXR1cmVUYWJsZVJlbmRlcmVyLCBJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSwgSVJlbmRlcmVkRGF0YSwgSVJvd0RhdGEsIElUYWJsZURhdGEgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25GZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uTWFuaWZlc3QgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5cbmludGVyZmFjZSBJSlNPTlZhbGlkYXRpb25FeHRlbnNpb25Qb2ludCB7XG5cdGZpbGVNYXRjaDogc3RyaW5nIHwgc3RyaW5nW107XG5cdHVybDogc3RyaW5nO1xufVxuXG5jb25zdCBjb25maWd1cmF0aW9uRXh0UG9pbnQgPSBFeHRlbnNpb25zUmVnaXN0cnkucmVnaXN0ZXJFeHRlbnNpb25Qb2ludDxJSlNPTlZhbGlkYXRpb25FeHRlbnNpb25Qb2ludFtdPih7XG5cdGV4dGVuc2lvblBvaW50OiAnanNvblZhbGlkYXRpb24nLFxuXHRkZWZhdWx0RXh0ZW5zaW9uS2luZDogWyd3b3Jrc3BhY2UnLCAnd2ViJ10sXG5cdGpzb25TY2hlbWE6IHtcblx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5qc29uVmFsaWRhdGlvbicsICdDb250cmlidXRlcyBqc29uIHNjaGVtYSBjb25maWd1cmF0aW9uLicpLFxuXHRcdHR5cGU6ICdhcnJheScsXG5cdFx0ZGVmYXVsdFNuaXBwZXRzOiBbeyBib2R5OiBbeyBmaWxlTWF0Y2g6ICckezE6ZmlsZS5qc29ufScsIHVybDogJyR7Mjp1cmx9JyB9XSB9XSxcblx0XHRpdGVtczoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IHsgZmlsZU1hdGNoOiAnJHsxOmZpbGUuanNvbn0nLCB1cmw6ICckezI6dXJsfScgfSB9XSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0ZmlsZU1hdGNoOiB7XG5cdFx0XHRcdFx0dHlwZTogWydzdHJpbmcnLCAnYXJyYXknXSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5qc29uVmFsaWRhdGlvbi5maWxlTWF0Y2gnLCAnVGhlIGZpbGUgcGF0dGVybiAob3IgYW4gYXJyYXkgb2YgcGF0dGVybnMpIHRvIG1hdGNoLCBmb3IgZXhhbXBsZSBcInBhY2thZ2UuanNvblwiIG9yIFwiKi5sYXVuY2hcIi4gRXhjbHVzaW9uIHBhdHRlcm5zIHN0YXJ0IHdpdGggXFwnIVxcJycpLFxuXHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiBbJ3N0cmluZyddXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR1cmw6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5qc29uVmFsaWRhdGlvbi51cmwnLCAnQSBzY2hlbWEgVVJMIChcXCdodHRwOlxcJywgXFwnaHR0cHM6XFwnKSBvciByZWxhdGl2ZSBwYXRoIHRvIHRoZSBleHRlbnNpb24gZm9sZGVyIChcXCcuL1xcJykuJyksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbmV4cG9ydCBjbGFzcyBKU09OVmFsaWRhdGlvbkV4dGVuc2lvblBvaW50IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25maWd1cmF0aW9uRXh0UG9pbnQuc2V0SGFuZGxlcigoZXh0ZW5zaW9ucykgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25WYWx1ZSA9IDxJSlNPTlZhbGlkYXRpb25FeHRlbnNpb25Qb2ludFtdPmV4dGVuc2lvbi52YWx1ZTtcblx0XHRcdFx0Y29uc3QgY29sbGVjdG9yID0gZXh0ZW5zaW9uLmNvbGxlY3Rvcjtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uTG9jYXRpb24gPSBleHRlbnNpb24uZGVzY3JpcHRpb24uZXh0ZW5zaW9uTG9jYXRpb247XG5cblx0XHRcdFx0aWYgKCFleHRlbnNpb25WYWx1ZSB8fCAhQXJyYXkuaXNBcnJheShleHRlbnNpb25WYWx1ZSkpIHtcblx0XHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLmpzb25WYWxpZGF0aW9uJywgXCInY29uZmlndXJhdGlvbi5qc29uVmFsaWRhdGlvbicgbXVzdCBiZSBhIGFycmF5XCIpKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0ZXh0ZW5zaW9uVmFsdWUuZm9yRWFjaChleHRlbnNpb24gPT4ge1xuXHRcdFx0XHRcdGlmICghaXNTdHJpbmcoZXh0ZW5zaW9uLmZpbGVNYXRjaCkgJiYgIShBcnJheS5pc0FycmF5KGV4dGVuc2lvbi5maWxlTWF0Y2gpICYmIGV4dGVuc2lvbi5maWxlTWF0Y2guZXZlcnkoaXNTdHJpbmcpKSkge1xuXHRcdFx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5maWxlTWF0Y2gnLCBcIidjb25maWd1cmF0aW9uLmpzb25WYWxpZGF0aW9uLmZpbGVNYXRjaCcgbXVzdCBiZSBkZWZpbmVkIGFzIGEgc3RyaW5nIG9yIGFuIGFycmF5IG9mIHN0cmluZ3MuXCIpKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgdXJpID0gZXh0ZW5zaW9uLnVybDtcblx0XHRcdFx0XHRpZiAoIWlzU3RyaW5nKHVyaSkpIHtcblx0XHRcdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihubHMubG9jYWxpemUoJ2ludmFsaWQudXJsJywgXCInY29uZmlndXJhdGlvbi5qc29uVmFsaWRhdGlvbi51cmwnIG11c3QgYmUgYSBVUkwgb3IgcmVsYXRpdmUgcGF0aFwiKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICh1cmkuc3RhcnRzV2l0aCgnLi8nKSkge1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgY29sb3JUaGVtZUxvY2F0aW9uID0gcmVzb3VyY2VzLmpvaW5QYXRoKGV4dGVuc2lvbkxvY2F0aW9uLCB1cmkpO1xuXHRcdFx0XHRcdFx0XHRpZiAoIXJlc291cmNlcy5pc0VxdWFsT3JQYXJlbnQoY29sb3JUaGVtZUxvY2F0aW9uLCBleHRlbnNpb25Mb2NhdGlvbikpIHtcblx0XHRcdFx0XHRcdFx0XHRjb2xsZWN0b3Iud2FybihubHMubG9jYWxpemUoJ2ludmFsaWQucGF0aC4xJywgXCJFeHBlY3RlZCBgY29udHJpYnV0ZXMuezB9LnVybGAgKHsxfSkgdG8gYmUgaW5jbHVkZWQgaW5zaWRlIGV4dGVuc2lvbidzIGZvbGRlciAoezJ9KS4gVGhpcyBtaWdodCBtYWtlIHRoZSBleHRlbnNpb24gbm9uLXBvcnRhYmxlLlwiLCBjb25maWd1cmF0aW9uRXh0UG9pbnQubmFtZSwgY29sb3JUaGVtZUxvY2F0aW9uLnRvU3RyaW5nKCksIGV4dGVuc2lvbkxvY2F0aW9uLnBhdGgpKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLnVybC5maWxlc2NoZW1hJywgXCInY29uZmlndXJhdGlvbi5qc29uVmFsaWRhdGlvbi51cmwnIGlzIGFuIGludmFsaWQgcmVsYXRpdmUgVVJMOiB7MH1cIiwgZS5tZXNzYWdlKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIGlmICghL15bXjovPyNdKzpcXC9cXC8vLnRlc3QodXJpKSkge1xuXHRcdFx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC51cmwuc2NoZW1hJywgXCInY29uZmlndXJhdGlvbi5qc29uVmFsaWRhdGlvbi51cmwnIG11c3QgYmUgYW4gYWJzb2x1dGUgVVJMIG9yIHN0YXJ0IHdpdGggJy4vJyAgdG8gcmVmZXJlbmNlIHNjaGVtYXMgbG9jYXRlZCBpbiB0aGUgZXh0ZW5zaW9uLlwiKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG59XG5cbmNsYXNzIEpTT05WYWxpZGF0aW9uRGF0YVJlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFeHRlbnNpb25GZWF0dXJlVGFibGVSZW5kZXJlciB7XG5cblx0cmVhZG9ubHkgdHlwZSA9ICd0YWJsZSc7XG5cblx0c2hvdWxkUmVuZGVyKG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISFtYW5pZmVzdC5jb250cmlidXRlcz8uanNvblZhbGlkYXRpb247XG5cdH1cblxuXHRyZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IElSZW5kZXJlZERhdGE8SVRhYmxlRGF0YT4ge1xuXHRcdGNvbnN0IGNvbnRyaWIgPSBtYW5pZmVzdC5jb250cmlidXRlcz8uanNvblZhbGlkYXRpb24gfHwgW107XG5cdFx0aWYgKCFjb250cmliLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHsgZGF0YTogeyBoZWFkZXJzOiBbXSwgcm93czogW10gfSwgZGlzcG9zZTogKCkgPT4geyB9IH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGVhZGVycyA9IFtcblx0XHRcdG5scy5sb2NhbGl6ZSgnZmlsZU1hdGNoJywgXCJGaWxlIE1hdGNoXCIpLFxuXHRcdFx0bmxzLmxvY2FsaXplKCdzY2hlbWEnLCBcIlNjaGVtYVwiKSxcblx0XHRdO1xuXG5cdFx0Y29uc3Qgcm93czogSVJvd0RhdGFbXVtdID0gY29udHJpYi5tYXAodiA9PiB7XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRuZXcgTWFya2Rvd25TdHJpbmcoKS5hcHBlbmRNYXJrZG93bihgXFxgJHtBcnJheS5pc0FycmF5KHYuZmlsZU1hdGNoKSA/IHYuZmlsZU1hdGNoLmpvaW4oJywgJykgOiB2LmZpbGVNYXRjaH1cXGBgKSxcblx0XHRcdFx0di51cmwsXG5cdFx0XHRdO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGRhdGE6IHtcblx0XHRcdFx0aGVhZGVycyxcblx0XHRcdFx0cm93c1xuXHRcdFx0fSxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHsgfVxuXHRcdH07XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnk+KEV4dGVuc2lvbnMuRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSkucmVnaXN0ZXJFeHRlbnNpb25GZWF0dXJlKHtcblx0aWQ6ICdqc29uVmFsaWRhdGlvbicsXG5cdGxhYmVsOiBubHMubG9jYWxpemUoJ2pzb25WYWxpZGF0aW9uJywgXCJKU09OIFZhbGlkYXRpb25cIiksXG5cdGFjY2Vzczoge1xuXHRcdGNhblRvZ2dsZTogZmFsc2Vcblx0fSxcblx0cmVuZGVyZXI6IG5ldyBTeW5jRGVzY3JpcHRvcihKU09OVmFsaWRhdGlvbkRhdGFSZW5kZXJlciksXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLDBCQUEwQjtBQUNuQyxZQUFZLGVBQWU7QUFDM0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxrQkFBbUg7QUFFNUgsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxzQkFBc0I7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
