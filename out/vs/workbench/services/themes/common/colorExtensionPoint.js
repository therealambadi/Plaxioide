import * as nls from "../../../../nls.js";
import { ExtensionsRegistry } from "../../extensions/common/extensionsRegistry.js";
import { Extensions as ColorRegistryExtensions } from "../../../../platform/theme/common/colorRegistry.js";
import { Color } from "../../../../base/common/color.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Extensions } from "../../extensionManagement/common/extensionFeatures.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
const colorRegistry = Registry.as(ColorRegistryExtensions.ColorContribution);
const colorReferenceSchema = colorRegistry.getColorReferenceSchema();
const colorIdPattern = "^\\w+[.\\w+]*$";
const configurationExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "colors",
  jsonSchema: {
    description: nls.localize("contributes.color", "Contributes extension defined themable colors"),
    type: "array",
    items: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: nls.localize("contributes.color.id", "The identifier of the themable color"),
          pattern: colorIdPattern,
          patternErrorMessage: nls.localize("contributes.color.id.format", "Identifiers must only contain letters, digits and dots and can not start with a dot")
        },
        description: {
          type: "string",
          description: nls.localize("contributes.color.description", "The description of the themable color")
        },
        defaults: {
          type: "object",
          properties: {
            light: {
              description: nls.localize("contributes.defaults.light", "The default color for light themes. Either a color value in hex (#RRGGBB[AA]) or the identifier of a themable color which provides the default."),
              type: "string",
              anyOf: [
                colorReferenceSchema,
                { type: "string", format: "color-hex" }
              ]
            },
            dark: {
              description: nls.localize("contributes.defaults.dark", "The default color for dark themes. Either a color value in hex (#RRGGBB[AA]) or the identifier of a themable color which provides the default."),
              type: "string",
              anyOf: [
                colorReferenceSchema,
                { type: "string", format: "color-hex" }
              ]
            },
            highContrast: {
              description: nls.localize("contributes.defaults.highContrast", "The default color for high contrast dark themes. Either a color value in hex (#RRGGBB[AA]) or the identifier of a themable color which provides the default. If not provided, the `dark` color is used as default for high contrast dark themes."),
              type: "string",
              anyOf: [
                colorReferenceSchema,
                { type: "string", format: "color-hex" }
              ]
            },
            highContrastLight: {
              description: nls.localize("contributes.defaults.highContrastLight", "The default color for high contrast light themes. Either a color value in hex (#RRGGBB[AA]) or the identifier of a themable color which provides the default. If not provided, the `light` color is used as default for high contrast light themes."),
              type: "string",
              anyOf: [
                colorReferenceSchema,
                { type: "string", format: "color-hex" }
              ]
            }
          },
          required: ["light", "dark"]
        }
      }
    }
  }
});
class ColorExtensionPoint {
  constructor() {
    configurationExtPoint.setHandler((extensions, delta) => {
      for (const extension of delta.added) {
        const extensionValue = extension.value;
        const collector = extension.collector;
        if (!extensionValue || !Array.isArray(extensionValue)) {
          collector.error(nls.localize("invalid.colorConfiguration", "'configuration.colors' must be a array"));
          return;
        }
        const parseColorValue = (s, name) => {
          if (s.length > 0) {
            if (s[0] === "#") {
              return Color.Format.CSS.parseHex(s);
            } else {
              return s;
            }
          }
          collector.error(nls.localize("invalid.default.colorType", "{0} must be either a color value in hex (#RRGGBB[AA] or #RGB[A]) or the identifier of a themable color which provides the default.", name));
          return Color.red;
        };
        for (const colorContribution of extensionValue) {
          if (typeof colorContribution.id !== "string" || colorContribution.id.length === 0) {
            collector.error(nls.localize("invalid.id", "'configuration.colors.id' must be defined and can not be empty"));
            return;
          }
          if (!colorContribution.id.match(colorIdPattern)) {
            collector.error(nls.localize("invalid.id.format", "'configuration.colors.id' must only contain letters, digits and dots and can not start with a dot"));
            return;
          }
          if (typeof colorContribution.description !== "string" || colorContribution.id.length === 0) {
            collector.error(nls.localize("invalid.description", "'configuration.colors.description' must be defined and can not be empty"));
            return;
          }
          const defaults = colorContribution.defaults;
          if (!defaults || typeof defaults !== "object" || typeof defaults.light !== "string" || typeof defaults.dark !== "string") {
            collector.error(nls.localize("invalid.defaults", "'configuration.colors.defaults' must be defined and must contain 'light' and 'dark'"));
            return;
          }
          if (defaults.highContrast && typeof defaults.highContrast !== "string") {
            collector.error(nls.localize("invalid.defaults.highContrast", "If defined, 'configuration.colors.defaults.highContrast' must be a string."));
            return;
          }
          if (defaults.highContrastLight && typeof defaults.highContrastLight !== "string") {
            collector.error(nls.localize("invalid.defaults.highContrastLight", "If defined, 'configuration.colors.defaults.highContrastLight' must be a string."));
            return;
          }
          colorRegistry.registerColor(colorContribution.id, {
            light: parseColorValue(defaults.light, "configuration.colors.defaults.light"),
            dark: parseColorValue(defaults.dark, "configuration.colors.defaults.dark"),
            hcDark: parseColorValue(defaults.highContrast ?? defaults.dark, "configuration.colors.defaults.highContrast"),
            hcLight: parseColorValue(defaults.highContrastLight ?? defaults.light, "configuration.colors.defaults.highContrastLight")
          }, colorContribution.description);
        }
      }
      for (const extension of delta.removed) {
        const extensionValue = extension.value;
        for (const colorContribution of extensionValue) {
          colorRegistry.deregisterColor(colorContribution.id);
        }
      }
    });
  }
}
class ColorDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.colors;
  }
  render(manifest) {
    const colors = manifest.contributes?.colors || [];
    if (!colors.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      nls.localize("id", "ID"),
      nls.localize("description", "Description"),
      nls.localize("defaultDark", "Dark Default"),
      nls.localize("defaultLight", "Light Default"),
      nls.localize("defaultHC", "High Contrast Default")
    ];
    const toColor = (colorReference) => colorReference[0] === "#" ? Color.fromHex(colorReference) : void 0;
    const rows = colors.sort((a, b) => a.id.localeCompare(b.id)).map((color) => {
      return [
        new MarkdownString().appendMarkdown(`\`${color.id}\``),
        color.description,
        toColor(color.defaults.dark) ?? new MarkdownString().appendMarkdown(`\`${color.defaults.dark}\``),
        toColor(color.defaults.light) ?? new MarkdownString().appendMarkdown(`\`${color.defaults.light}\``),
        toColor(color.defaults.highContrast) ?? new MarkdownString().appendMarkdown(`\`${color.defaults.highContrast}\``)
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
  id: "colors",
  label: nls.localize("colors", "Colors"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(ColorDataRenderer)
});
export {
  ColorExtensionPoint
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2NvbW1vbi9jb2xvckV4dGVuc2lvblBvaW50LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUNvbG9yUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgQ29sb3JSZWdpc3RyeUV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUV4dGVuc2lvbkZlYXR1cmVUYWJsZVJlbmRlcmVyLCBJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSwgSVJlbmRlcmVkRGF0YSwgSVJvd0RhdGEsIElUYWJsZURhdGEgfSBmcm9tICcuLi8uLi9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25GZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25NYW5pZmVzdCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5cbmludGVyZmFjZSBJQ29sb3JFeHRlbnNpb25Qb2ludCB7XG5cdGlkOiBzdHJpbmc7XG5cdGRlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdGRlZmF1bHRzOiB7IGxpZ2h0OiBzdHJpbmc7IGRhcms6IHN0cmluZzsgaGlnaENvbnRyYXN0OiBzdHJpbmc7IGhpZ2hDb250cmFzdExpZ2h0Pzogc3RyaW5nIH07XG59XG5cbmNvbnN0IGNvbG9yUmVnaXN0cnk6IElDb2xvclJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbG9yUmVnaXN0cnk+KENvbG9yUmVnaXN0cnlFeHRlbnNpb25zLkNvbG9yQ29udHJpYnV0aW9uKTtcblxuY29uc3QgY29sb3JSZWZlcmVuY2VTY2hlbWEgPSBjb2xvclJlZ2lzdHJ5LmdldENvbG9yUmVmZXJlbmNlU2NoZW1hKCk7XG5jb25zdCBjb2xvcklkUGF0dGVybiA9ICdeXFxcXHcrWy5cXFxcdytdKiQnO1xuXG5jb25zdCBjb25maWd1cmF0aW9uRXh0UG9pbnQgPSBFeHRlbnNpb25zUmVnaXN0cnkucmVnaXN0ZXJFeHRlbnNpb25Qb2ludDxJQ29sb3JFeHRlbnNpb25Qb2ludFtdPih7XG5cdGV4dGVuc2lvblBvaW50OiAnY29sb3JzJyxcblx0anNvblNjaGVtYToge1xuXHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLmNvbG9yJywgJ0NvbnRyaWJ1dGVzIGV4dGVuc2lvbiBkZWZpbmVkIHRoZW1hYmxlIGNvbG9ycycpLFxuXHRcdHR5cGU6ICdhcnJheScsXG5cdFx0aXRlbXM6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRpZDoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLmNvbG9yLmlkJywgJ1RoZSBpZGVudGlmaWVyIG9mIHRoZSB0aGVtYWJsZSBjb2xvcicpLFxuXHRcdFx0XHRcdHBhdHRlcm46IGNvbG9ySWRQYXR0ZXJuLFxuXHRcdFx0XHRcdHBhdHRlcm5FcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuY29sb3IuaWQuZm9ybWF0JywgJ0lkZW50aWZpZXJzIG11c3Qgb25seSBjb250YWluIGxldHRlcnMsIGRpZ2l0cyBhbmQgZG90cyBhbmQgY2FuIG5vdCBzdGFydCB3aXRoIGEgZG90JyksXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuY29sb3IuZGVzY3JpcHRpb24nLCAnVGhlIGRlc2NyaXB0aW9uIG9mIHRoZSB0aGVtYWJsZSBjb2xvcicpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRkZWZhdWx0czoge1xuXHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdGxpZ2h0OiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLmRlZmF1bHRzLmxpZ2h0JywgJ1RoZSBkZWZhdWx0IGNvbG9yIGZvciBsaWdodCB0aGVtZXMuIEVpdGhlciBhIGNvbG9yIHZhbHVlIGluIGhleCAoI1JSR0dCQltBQV0pIG9yIHRoZSBpZGVudGlmaWVyIG9mIGEgdGhlbWFibGUgY29sb3Igd2hpY2ggcHJvdmlkZXMgdGhlIGRlZmF1bHQuJyksXG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRhbnlPZjogW1xuXHRcdFx0XHRcdFx0XHRcdGNvbG9yUmVmZXJlbmNlU2NoZW1hLFxuXHRcdFx0XHRcdFx0XHRcdHsgdHlwZTogJ3N0cmluZycsIGZvcm1hdDogJ2NvbG9yLWhleCcgfVxuXHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0ZGFyazoge1xuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5kZWZhdWx0cy5kYXJrJywgJ1RoZSBkZWZhdWx0IGNvbG9yIGZvciBkYXJrIHRoZW1lcy4gRWl0aGVyIGEgY29sb3IgdmFsdWUgaW4gaGV4ICgjUlJHR0JCW0FBXSkgb3IgdGhlIGlkZW50aWZpZXIgb2YgYSB0aGVtYWJsZSBjb2xvciB3aGljaCBwcm92aWRlcyB0aGUgZGVmYXVsdC4nKSxcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdGFueU9mOiBbXG5cdFx0XHRcdFx0XHRcdFx0Y29sb3JSZWZlcmVuY2VTY2hlbWEsXG5cdFx0XHRcdFx0XHRcdFx0eyB0eXBlOiAnc3RyaW5nJywgZm9ybWF0OiAnY29sb3ItaGV4JyB9XG5cdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRoaWdoQ29udHJhc3Q6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuZGVmYXVsdHMuaGlnaENvbnRyYXN0JywgJ1RoZSBkZWZhdWx0IGNvbG9yIGZvciBoaWdoIGNvbnRyYXN0IGRhcmsgdGhlbWVzLiBFaXRoZXIgYSBjb2xvciB2YWx1ZSBpbiBoZXggKCNSUkdHQkJbQUFdKSBvciB0aGUgaWRlbnRpZmllciBvZiBhIHRoZW1hYmxlIGNvbG9yIHdoaWNoIHByb3ZpZGVzIHRoZSBkZWZhdWx0LiBJZiBub3QgcHJvdmlkZWQsIHRoZSBgZGFya2AgY29sb3IgaXMgdXNlZCBhcyBkZWZhdWx0IGZvciBoaWdoIGNvbnRyYXN0IGRhcmsgdGhlbWVzLicpLFxuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0XHRcdFx0XHRjb2xvclJlZmVyZW5jZVNjaGVtYSxcblx0XHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdzdHJpbmcnLCBmb3JtYXQ6ICdjb2xvci1oZXgnIH1cblx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGhpZ2hDb250cmFzdExpZ2h0OiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLmRlZmF1bHRzLmhpZ2hDb250cmFzdExpZ2h0JywgJ1RoZSBkZWZhdWx0IGNvbG9yIGZvciBoaWdoIGNvbnRyYXN0IGxpZ2h0IHRoZW1lcy4gRWl0aGVyIGEgY29sb3IgdmFsdWUgaW4gaGV4ICgjUlJHR0JCW0FBXSkgb3IgdGhlIGlkZW50aWZpZXIgb2YgYSB0aGVtYWJsZSBjb2xvciB3aGljaCBwcm92aWRlcyB0aGUgZGVmYXVsdC4gSWYgbm90IHByb3ZpZGVkLCB0aGUgYGxpZ2h0YCBjb2xvciBpcyB1c2VkIGFzIGRlZmF1bHQgZm9yIGhpZ2ggY29udHJhc3QgbGlnaHQgdGhlbWVzLicpLFxuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0XHRcdFx0XHRjb2xvclJlZmVyZW5jZVNjaGVtYSxcblx0XHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdzdHJpbmcnLCBmb3JtYXQ6ICdjb2xvci1oZXgnIH1cblx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVxdWlyZWQ6IFsnbGlnaHQnLCAnZGFyayddXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5leHBvcnQgY2xhc3MgQ29sb3JFeHRlbnNpb25Qb2ludCB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0Y29uZmlndXJhdGlvbkV4dFBvaW50LnNldEhhbmRsZXIoKGV4dGVuc2lvbnMsIGRlbHRhKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBkZWx0YS5hZGRlZCkge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25WYWx1ZSA9IDxJQ29sb3JFeHRlbnNpb25Qb2ludFtdPmV4dGVuc2lvbi52YWx1ZTtcblx0XHRcdFx0Y29uc3QgY29sbGVjdG9yID0gZXh0ZW5zaW9uLmNvbGxlY3RvcjtcblxuXHRcdFx0XHRpZiAoIWV4dGVuc2lvblZhbHVlIHx8ICFBcnJheS5pc0FycmF5KGV4dGVuc2lvblZhbHVlKSkge1xuXHRcdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihubHMubG9jYWxpemUoJ2ludmFsaWQuY29sb3JDb25maWd1cmF0aW9uJywgXCInY29uZmlndXJhdGlvbi5jb2xvcnMnIG11c3QgYmUgYSBhcnJheVwiKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHBhcnNlQ29sb3JWYWx1ZSA9IChzOiBzdHJpbmcsIG5hbWU6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRcdGlmIChzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdGlmIChzWzBdID09PSAnIycpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIENvbG9yLkZvcm1hdC5DU1MucGFyc2VIZXgocyk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5kZWZhdWx0LmNvbG9yVHlwZScsIFwiezB9IG11c3QgYmUgZWl0aGVyIGEgY29sb3IgdmFsdWUgaW4gaGV4ICgjUlJHR0JCW0FBXSBvciAjUkdCW0FdKSBvciB0aGUgaWRlbnRpZmllciBvZiBhIHRoZW1hYmxlIGNvbG9yIHdoaWNoIHByb3ZpZGVzIHRoZSBkZWZhdWx0LlwiLCBuYW1lKSk7XG5cdFx0XHRcdFx0cmV0dXJuIENvbG9yLnJlZDtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRmb3IgKGNvbnN0IGNvbG9yQ29udHJpYnV0aW9uIG9mIGV4dGVuc2lvblZhbHVlKSB7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBjb2xvckNvbnRyaWJ1dGlvbi5pZCAhPT0gJ3N0cmluZycgfHwgY29sb3JDb250cmlidXRpb24uaWQubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLmlkJywgXCInY29uZmlndXJhdGlvbi5jb2xvcnMuaWQnIG11c3QgYmUgZGVmaW5lZCBhbmQgY2FuIG5vdCBiZSBlbXB0eVwiKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICghY29sb3JDb250cmlidXRpb24uaWQubWF0Y2goY29sb3JJZFBhdHRlcm4pKSB7XG5cdFx0XHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLmlkLmZvcm1hdCcsIFwiJ2NvbmZpZ3VyYXRpb24uY29sb3JzLmlkJyBtdXN0IG9ubHkgY29udGFpbiBsZXR0ZXJzLCBkaWdpdHMgYW5kIGRvdHMgYW5kIGNhbiBub3Qgc3RhcnQgd2l0aCBhIGRvdFwiKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICh0eXBlb2YgY29sb3JDb250cmlidXRpb24uZGVzY3JpcHRpb24gIT09ICdzdHJpbmcnIHx8IGNvbG9yQ29udHJpYnV0aW9uLmlkLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5kZXNjcmlwdGlvbicsIFwiJ2NvbmZpZ3VyYXRpb24uY29sb3JzLmRlc2NyaXB0aW9uJyBtdXN0IGJlIGRlZmluZWQgYW5kIGNhbiBub3QgYmUgZW1wdHlcIikpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBkZWZhdWx0cyA9IGNvbG9yQ29udHJpYnV0aW9uLmRlZmF1bHRzO1xuXHRcdFx0XHRcdGlmICghZGVmYXVsdHMgfHwgdHlwZW9mIGRlZmF1bHRzICE9PSAnb2JqZWN0JyB8fCB0eXBlb2YgZGVmYXVsdHMubGlnaHQgIT09ICdzdHJpbmcnIHx8IHR5cGVvZiBkZWZhdWx0cy5kYXJrICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5kZWZhdWx0cycsIFwiJ2NvbmZpZ3VyYXRpb24uY29sb3JzLmRlZmF1bHRzJyBtdXN0IGJlIGRlZmluZWQgYW5kIG11c3QgY29udGFpbiAnbGlnaHQnIGFuZCAnZGFyaydcIikpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZGVmYXVsdHMuaGlnaENvbnRyYXN0ICYmIHR5cGVvZiBkZWZhdWx0cy5oaWdoQ29udHJhc3QgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLmRlZmF1bHRzLmhpZ2hDb250cmFzdCcsIFwiSWYgZGVmaW5lZCwgJ2NvbmZpZ3VyYXRpb24uY29sb3JzLmRlZmF1bHRzLmhpZ2hDb250cmFzdCcgbXVzdCBiZSBhIHN0cmluZy5cIikpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZGVmYXVsdHMuaGlnaENvbnRyYXN0TGlnaHQgJiYgdHlwZW9mIGRlZmF1bHRzLmhpZ2hDb250cmFzdExpZ2h0ICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5kZWZhdWx0cy5oaWdoQ29udHJhc3RMaWdodCcsIFwiSWYgZGVmaW5lZCwgJ2NvbmZpZ3VyYXRpb24uY29sb3JzLmRlZmF1bHRzLmhpZ2hDb250cmFzdExpZ2h0JyBtdXN0IGJlIGEgc3RyaW5nLlwiKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29sb3JSZWdpc3RyeS5yZWdpc3RlckNvbG9yKGNvbG9yQ29udHJpYnV0aW9uLmlkLCB7XG5cdFx0XHRcdFx0XHRsaWdodDogcGFyc2VDb2xvclZhbHVlKGRlZmF1bHRzLmxpZ2h0LCAnY29uZmlndXJhdGlvbi5jb2xvcnMuZGVmYXVsdHMubGlnaHQnKSxcblx0XHRcdFx0XHRcdGRhcms6IHBhcnNlQ29sb3JWYWx1ZShkZWZhdWx0cy5kYXJrLCAnY29uZmlndXJhdGlvbi5jb2xvcnMuZGVmYXVsdHMuZGFyaycpLFxuXHRcdFx0XHRcdFx0aGNEYXJrOiBwYXJzZUNvbG9yVmFsdWUoZGVmYXVsdHMuaGlnaENvbnRyYXN0ID8/IGRlZmF1bHRzLmRhcmssICdjb25maWd1cmF0aW9uLmNvbG9ycy5kZWZhdWx0cy5oaWdoQ29udHJhc3QnKSxcblx0XHRcdFx0XHRcdGhjTGlnaHQ6IHBhcnNlQ29sb3JWYWx1ZShkZWZhdWx0cy5oaWdoQ29udHJhc3RMaWdodCA/PyBkZWZhdWx0cy5saWdodCwgJ2NvbmZpZ3VyYXRpb24uY29sb3JzLmRlZmF1bHRzLmhpZ2hDb250cmFzdExpZ2h0JyksXG5cdFx0XHRcdFx0fSwgY29sb3JDb250cmlidXRpb24uZGVzY3JpcHRpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBkZWx0YS5yZW1vdmVkKSB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvblZhbHVlID0gPElDb2xvckV4dGVuc2lvblBvaW50W10+ZXh0ZW5zaW9uLnZhbHVlO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGNvbG9yQ29udHJpYnV0aW9uIG9mIGV4dGVuc2lvblZhbHVlKSB7XG5cdFx0XHRcdFx0Y29sb3JSZWdpc3RyeS5kZXJlZ2lzdGVyQ29sb3IoY29sb3JDb250cmlidXRpb24uaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgQ29sb3JEYXRhUmVuZGVyZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUV4dGVuc2lvbkZlYXR1cmVUYWJsZVJlbmRlcmVyIHtcblxuXHRyZWFkb25seSB0eXBlID0gJ3RhYmxlJztcblxuXHRzaG91bGRSZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIW1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5jb2xvcnM7XG5cdH1cblxuXHRyZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IElSZW5kZXJlZERhdGE8SVRhYmxlRGF0YT4ge1xuXHRcdGNvbnN0IGNvbG9ycyA9IG1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5jb2xvcnMgfHwgW107XG5cdFx0aWYgKCFjb2xvcnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4geyBkYXRhOiB7IGhlYWRlcnM6IFtdLCByb3dzOiBbXSB9LCBkaXNwb3NlOiAoKSA9PiB7IH0gfTtcblx0XHR9XG5cblx0XHRjb25zdCBoZWFkZXJzID0gW1xuXHRcdFx0bmxzLmxvY2FsaXplKCdpZCcsIFwiSURcIiksXG5cdFx0XHRubHMubG9jYWxpemUoJ2Rlc2NyaXB0aW9uJywgXCJEZXNjcmlwdGlvblwiKSxcblx0XHRcdG5scy5sb2NhbGl6ZSgnZGVmYXVsdERhcmsnLCBcIkRhcmsgRGVmYXVsdFwiKSxcblx0XHRcdG5scy5sb2NhbGl6ZSgnZGVmYXVsdExpZ2h0JywgXCJMaWdodCBEZWZhdWx0XCIpLFxuXHRcdFx0bmxzLmxvY2FsaXplKCdkZWZhdWx0SEMnLCBcIkhpZ2ggQ29udHJhc3QgRGVmYXVsdFwiKSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgdG9Db2xvciA9IChjb2xvclJlZmVyZW5jZTogc3RyaW5nKTogQ29sb3IgfCB1bmRlZmluZWQgPT4gY29sb3JSZWZlcmVuY2VbMF0gPT09ICcjJyA/IENvbG9yLmZyb21IZXgoY29sb3JSZWZlcmVuY2UpIDogdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3Qgcm93czogSVJvd0RhdGFbXVtdID0gY29sb3JzLnNvcnQoKGEsIGIpID0+IGEuaWQubG9jYWxlQ29tcGFyZShiLmlkKSlcblx0XHRcdC5tYXAoY29sb3IgPT4ge1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZE1hcmtkb3duKGBcXGAke2NvbG9yLmlkfVxcYGApLFxuXHRcdFx0XHRcdGNvbG9yLmRlc2NyaXB0aW9uLFxuXHRcdFx0XHRcdHRvQ29sb3IoY29sb3IuZGVmYXVsdHMuZGFyaykgPz8gbmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kTWFya2Rvd24oYFxcYCR7Y29sb3IuZGVmYXVsdHMuZGFya31cXGBgKSxcblx0XHRcdFx0XHR0b0NvbG9yKGNvbG9yLmRlZmF1bHRzLmxpZ2h0KSA/PyBuZXcgTWFya2Rvd25TdHJpbmcoKS5hcHBlbmRNYXJrZG93bihgXFxgJHtjb2xvci5kZWZhdWx0cy5saWdodH1cXGBgKSxcblx0XHRcdFx0XHR0b0NvbG9yKGNvbG9yLmRlZmF1bHRzLmhpZ2hDb250cmFzdCkgPz8gbmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kTWFya2Rvd24oYFxcYCR7Y29sb3IuZGVmYXVsdHMuaGlnaENvbnRyYXN0fVxcYGApLFxuXHRcdFx0XHRdO1xuXHRcdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGF0YToge1xuXHRcdFx0XHRoZWFkZXJzLFxuXHRcdFx0XHRyb3dzXG5cdFx0XHR9LFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4geyB9XG5cdFx0fTtcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeT4oRXh0ZW5zaW9ucy5FeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5KS5yZWdpc3RlckV4dGVuc2lvbkZlYXR1cmUoe1xuXHRpZDogJ2NvbG9ycycsXG5cdGxhYmVsOiBubHMubG9jYWxpemUoJ2NvbG9ycycsIFwiQ29sb3JzXCIpLFxuXHRhY2Nlc3M6IHtcblx0XHRjYW5Ub2dnbGU6IGZhbHNlXG5cdH0sXG5cdHJlbmRlcmVyOiBuZXcgU3luY0Rlc2NyaXB0b3IoQ29sb3JEYXRhUmVuZGVyZXIpLFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUywwQkFBMEI7QUFDbkMsU0FBeUIsY0FBYywrQkFBK0I7QUFDdEUsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsa0JBQW1IO0FBQzVILFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsc0JBQXNCO0FBUS9CLE1BQU0sZ0JBQWdDLFNBQVMsR0FBbUIsd0JBQXdCLGlCQUFpQjtBQUUzRyxNQUFNLHVCQUF1QixjQUFjLHdCQUF3QjtBQUNuRSxNQUFNLGlCQUFpQjtBQUV2QixNQUFNLHdCQUF3QixtQkFBbUIsdUJBQStDO0FBQUEsRUFDL0YsZ0JBQWdCO0FBQUEsRUFDaEIsWUFBWTtBQUFBLElBQ1gsYUFBYSxJQUFJLFNBQVMscUJBQXFCLCtDQUErQztBQUFBLElBQzlGLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLFlBQVk7QUFBQSxRQUNYLElBQUk7QUFBQSxVQUNILE1BQU07QUFBQSxVQUNO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
