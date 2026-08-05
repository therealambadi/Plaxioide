import * as nls from "../../../../nls.js";
import { ExtensionsRegistry } from "../../extensions/common/extensionsRegistry.js";
import { Extensions as IconRegistryExtensions } from "../../../../platform/theme/common/iconRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import * as resources from "../../../../base/common/resources.js";
import { extname, posix } from "../../../../base/common/path.js";
const iconRegistry = Registry.as(IconRegistryExtensions.IconContribution);
const iconReferenceSchema = iconRegistry.getIconReferenceSchema();
const iconIdPattern = `^${ThemeIcon.iconNameSegment}(-${ThemeIcon.iconNameSegment})+$`;
const iconConfigurationExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "icons",
  jsonSchema: {
    description: nls.localize("contributes.icons", "Contributes extension defined themable icons"),
    type: "object",
    propertyNames: {
      pattern: iconIdPattern,
      description: nls.localize("contributes.icon.id", "The identifier of the themable icon"),
      patternErrorMessage: nls.localize("contributes.icon.id.format", "Identifiers can only contain letters, digits and minuses and need to consist of at least two segments in the form `component-iconname`.")
    },
    additionalProperties: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: nls.localize("contributes.icon.description", "The description of the themable icon")
        },
        default: {
          anyOf: [
            iconReferenceSchema,
            {
              type: "object",
              properties: {
                fontPath: {
                  description: nls.localize("contributes.icon.default.fontPath", "The path of the icon font that defines the icon."),
                  type: "string"
                },
                fontCharacter: {
                  description: nls.localize("contributes.icon.default.fontCharacter", "The character for the icon in the icon font."),
                  type: "string"
                }
              },
              required: ["fontPath", "fontCharacter"],
              defaultSnippets: [{ body: { fontPath: "${1:myiconfont.woff}", fontCharacter: "${2:\\\\E001}" } }]
            }
          ],
          description: nls.localize("contributes.icon.default", "The default of the icon. Either a reference to an existing ThemeIcon or an icon in an icon font.")
        }
      },
      required: ["description", "default"],
      defaultSnippets: [{ body: { description: "${1:my icon}", default: { fontPath: "${2:myiconfont.woff}", fontCharacter: "${3:\\\\E001}" } } }]
    },
    defaultSnippets: [{ body: { "${1:my-icon-id}": { description: "${2:my icon}", default: { fontPath: "${3:myiconfont.woff}", fontCharacter: "${4:\\\\E001}" } } } }]
  }
});
class IconExtensionPoint {
  constructor() {
    iconConfigurationExtPoint.setHandler((extensions, delta) => {
      for (const extension of delta.added) {
        const extensionValue = extension.value;
        const collector = extension.collector;
        if (!extensionValue || typeof extensionValue !== "object") {
          collector.error(nls.localize("invalid.icons.configuration", "'configuration.icons' must be an object with the icon names as properties."));
          return;
        }
        for (const id in extensionValue) {
          if (!id.match(iconIdPattern)) {
            collector.error(nls.localize("invalid.icons.id.format", "'configuration.icons' keys represent the icon id and can only contain letter, digits and minuses. They need to consist of at least two segments in the form `component-iconname`."));
            return;
          }
          const iconContribution = extensionValue[id];
          if (typeof iconContribution.description !== "string" || iconContribution.description.length === 0) {
            collector.error(nls.localize("invalid.icons.description", "'configuration.icons.description' must be defined and can not be empty"));
            return;
          }
          const defaultIcon = iconContribution.default;
          if (typeof defaultIcon === "string") {
            iconRegistry.registerIcon(id, { id: defaultIcon }, iconContribution.description);
          } else if (typeof defaultIcon === "object" && typeof defaultIcon.fontPath === "string" && typeof defaultIcon.fontCharacter === "string") {
            const fileExt = extname(defaultIcon.fontPath).substring(1);
            const format = formatMap[fileExt];
            if (!format) {
              collector.warn(nls.localize("invalid.icons.default.fontPath.extension", "Expected `contributes.icons.default.fontPath` to have file extension 'woff', woff2' or 'ttf', is '{0}'.", fileExt));
              return;
            }
            const extensionLocation = extension.description.extensionLocation;
            const iconFontLocation = resources.joinPath(extensionLocation, defaultIcon.fontPath);
            const fontId = getFontId(extension.description, defaultIcon.fontPath);
            const definition = iconRegistry.registerIconFont(fontId, { src: [{ location: iconFontLocation, format }] });
            if (!resources.isEqualOrParent(iconFontLocation, extensionLocation)) {
              collector.warn(nls.localize("invalid.icons.default.fontPath.path", "Expected `contributes.icons.default.fontPath` ({0}) to be included inside extension's folder ({0}).", iconFontLocation.path, extensionLocation.path));
              return;
            }
            iconRegistry.registerIcon(id, {
              fontCharacter: defaultIcon.fontCharacter,
              font: {
                id: fontId,
                definition
              }
            }, iconContribution.description);
          } else {
            collector.error(nls.localize("invalid.icons.default", "'configuration.icons.default' must be either a reference to the id of an other theme icon (string) or a icon definition (object) with properties `fontPath` and `fontCharacter`."));
          }
        }
      }
      for (const extension of delta.removed) {
        const extensionValue = extension.value;
        for (const id in extensionValue) {
          iconRegistry.deregisterIcon(id);
        }
      }
    });
  }
}
const formatMap = {
  "ttf": "truetype",
  "woff": "woff",
  "woff2": "woff2"
};
function getFontId(description, fontPath) {
  return posix.join(description.identifier.value, fontPath);
}
export {
  IconExtensionPoint
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2NvbW1vbi9pY29uRXh0ZW5zaW9uUG9pbnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNSZWdpc3RyeSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJSWNvblJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIEljb25SZWdpc3RyeUV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyByZXNvdXJjZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgcG9zaXggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcblxuaW50ZXJmYWNlIElJY29uRXh0ZW5zaW9uUG9pbnQge1xuXHRbaWQ6IHN0cmluZ106IHtcblx0XHRkZXNjcmlwdGlvbjogc3RyaW5nO1xuXHRcdGRlZmF1bHQ6IHsgZm9udFBhdGg6IHN0cmluZzsgZm9udENoYXJhY3Rlcjogc3RyaW5nIH0gfCBzdHJpbmc7XG5cdH07XG59XG5cbmNvbnN0IGljb25SZWdpc3RyeTogSUljb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElJY29uUmVnaXN0cnk+KEljb25SZWdpc3RyeUV4dGVuc2lvbnMuSWNvbkNvbnRyaWJ1dGlvbik7XG5cbmNvbnN0IGljb25SZWZlcmVuY2VTY2hlbWEgPSBpY29uUmVnaXN0cnkuZ2V0SWNvblJlZmVyZW5jZVNjaGVtYSgpO1xuY29uc3QgaWNvbklkUGF0dGVybiA9IGBeJHtUaGVtZUljb24uaWNvbk5hbWVTZWdtZW50fSgtJHtUaGVtZUljb24uaWNvbk5hbWVTZWdtZW50fSkrJGA7XG5cbmNvbnN0IGljb25Db25maWd1cmF0aW9uRXh0UG9pbnQgPSBFeHRlbnNpb25zUmVnaXN0cnkucmVnaXN0ZXJFeHRlbnNpb25Qb2ludDxJSWNvbkV4dGVuc2lvblBvaW50Pih7XG5cdGV4dGVuc2lvblBvaW50OiAnaWNvbnMnLFxuXHRqc29uU2NoZW1hOiB7XG5cdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuaWNvbnMnLCAnQ29udHJpYnV0ZXMgZXh0ZW5zaW9uIGRlZmluZWQgdGhlbWFibGUgaWNvbnMnKSxcblx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRwcm9wZXJ0eU5hbWVzOiB7XG5cdFx0XHRwYXR0ZXJuOiBpY29uSWRQYXR0ZXJuLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuaWNvbi5pZCcsICdUaGUgaWRlbnRpZmllciBvZiB0aGUgdGhlbWFibGUgaWNvbicpLFxuXHRcdFx0cGF0dGVybkVycm9yTWVzc2FnZTogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5pY29uLmlkLmZvcm1hdCcsICdJZGVudGlmaWVycyBjYW4gb25seSBjb250YWluIGxldHRlcnMsIGRpZ2l0cyBhbmQgbWludXNlcyBhbmQgbmVlZCB0byBjb25zaXN0IG9mIGF0IGxlYXN0IHR3byBzZWdtZW50cyBpbiB0aGUgZm9ybSBgY29tcG9uZW50LWljb25uYW1lYC4nKSxcblx0XHR9LFxuXHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5pY29uLmRlc2NyaXB0aW9uJywgJ1RoZSBkZXNjcmlwdGlvbiBvZiB0aGUgdGhlbWFibGUgaWNvbicpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0XHRcdGljb25SZWZlcmVuY2VTY2hlbWEsXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0Zm9udFBhdGg6IHtcblx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLmljb24uZGVmYXVsdC5mb250UGF0aCcsICdUaGUgcGF0aCBvZiB0aGUgaWNvbiBmb250IHRoYXQgZGVmaW5lcyB0aGUgaWNvbi4nKSxcblx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRmb250Q2hhcmFjdGVyOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5pY29uLmRlZmF1bHQuZm9udENoYXJhY3RlcicsICdUaGUgY2hhcmFjdGVyIGZvciB0aGUgaWNvbiBpbiB0aGUgaWNvbiBmb250LicpLFxuXHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ2ZvbnRQYXRoJywgJ2ZvbnRDaGFyYWN0ZXInXSxcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbeyBib2R5OiB7IGZvbnRQYXRoOiAnJHsxOm15aWNvbmZvbnQud29mZn0nLCBmb250Q2hhcmFjdGVyOiAnJHsyOlxcXFxcXFxcRTAwMX0nIH0gfV1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLmljb24uZGVmYXVsdCcsICdUaGUgZGVmYXVsdCBvZiB0aGUgaWNvbi4gRWl0aGVyIGEgcmVmZXJlbmNlIHRvIGFuIGV4aXN0aW5nIFRoZW1lSWNvbiBvciBhbiBpY29uIGluIGFuIGljb24gZm9udC4nKSxcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHJlcXVpcmVkOiBbJ2Rlc2NyaXB0aW9uJywgJ2RlZmF1bHQnXSxcblx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBkZXNjcmlwdGlvbjogJyR7MTpteSBpY29ufScsIGRlZmF1bHQ6IHsgZm9udFBhdGg6ICckezI6bXlpY29uZm9udC53b2ZmfScsIGZvbnRDaGFyYWN0ZXI6ICckezM6XFxcXFxcXFxFMDAxfScgfSB9IH1dXG5cdFx0fSxcblx0XHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IHsgJyR7MTpteS1pY29uLWlkfSc6IHsgZGVzY3JpcHRpb246ICckezI6bXkgaWNvbn0nLCBkZWZhdWx0OiB7IGZvbnRQYXRoOiAnJHszOm15aWNvbmZvbnQud29mZn0nLCBmb250Q2hhcmFjdGVyOiAnJHs0OlxcXFxcXFxcRTAwMX0nIH0gfSB9IH1dXG5cdH1cbn0pO1xuXG5leHBvcnQgY2xhc3MgSWNvbkV4dGVuc2lvblBvaW50IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRpY29uQ29uZmlndXJhdGlvbkV4dFBvaW50LnNldEhhbmRsZXIoKGV4dGVuc2lvbnMsIGRlbHRhKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBkZWx0YS5hZGRlZCkge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25WYWx1ZSA9IDxJSWNvbkV4dGVuc2lvblBvaW50PmV4dGVuc2lvbi52YWx1ZTtcblx0XHRcdFx0Y29uc3QgY29sbGVjdG9yID0gZXh0ZW5zaW9uLmNvbGxlY3RvcjtcblxuXHRcdFx0XHRpZiAoIWV4dGVuc2lvblZhbHVlIHx8IHR5cGVvZiBleHRlbnNpb25WYWx1ZSAhPT0gJ29iamVjdCcpIHtcblx0XHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLmljb25zLmNvbmZpZ3VyYXRpb24nLCBcIidjb25maWd1cmF0aW9uLmljb25zJyBtdXN0IGJlIGFuIG9iamVjdCB3aXRoIHRoZSBpY29uIG5hbWVzIGFzIHByb3BlcnRpZXMuXCIpKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IGlkIGluIGV4dGVuc2lvblZhbHVlKSB7XG5cdFx0XHRcdFx0aWYgKCFpZC5tYXRjaChpY29uSWRQYXR0ZXJuKSkge1xuXHRcdFx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5pY29ucy5pZC5mb3JtYXQnLCBcIidjb25maWd1cmF0aW9uLmljb25zJyBrZXlzIHJlcHJlc2VudCB0aGUgaWNvbiBpZCBhbmQgY2FuIG9ubHkgY29udGFpbiBsZXR0ZXIsIGRpZ2l0cyBhbmQgbWludXNlcy4gVGhleSBuZWVkIHRvIGNvbnNpc3Qgb2YgYXQgbGVhc3QgdHdvIHNlZ21lbnRzIGluIHRoZSBmb3JtIGBjb21wb25lbnQtaWNvbm5hbWVgLlwiKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IGljb25Db250cmlidXRpb24gPSBleHRlbnNpb25WYWx1ZVtpZF07XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBpY29uQ29udHJpYnV0aW9uLmRlc2NyaXB0aW9uICE9PSAnc3RyaW5nJyB8fCBpY29uQ29udHJpYnV0aW9uLmRlc2NyaXB0aW9uLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5pY29ucy5kZXNjcmlwdGlvbicsIFwiJ2NvbmZpZ3VyYXRpb24uaWNvbnMuZGVzY3JpcHRpb24nIG11c3QgYmUgZGVmaW5lZCBhbmQgY2FuIG5vdCBiZSBlbXB0eVwiKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IGRlZmF1bHRJY29uID0gaWNvbkNvbnRyaWJ1dGlvbi5kZWZhdWx0O1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgZGVmYXVsdEljb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRpY29uUmVnaXN0cnkucmVnaXN0ZXJJY29uKGlkLCB7IGlkOiBkZWZhdWx0SWNvbiB9LCBpY29uQ29udHJpYnV0aW9uLmRlc2NyaXB0aW9uKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBkZWZhdWx0SWNvbiA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIGRlZmF1bHRJY29uLmZvbnRQYXRoID09PSAnc3RyaW5nJyAmJiB0eXBlb2YgZGVmYXVsdEljb24uZm9udENoYXJhY3RlciA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGZpbGVFeHQgPSBleHRuYW1lKGRlZmF1bHRJY29uLmZvbnRQYXRoKS5zdWJzdHJpbmcoMSk7XG5cdFx0XHRcdFx0XHRjb25zdCBmb3JtYXQgPSBmb3JtYXRNYXBbZmlsZUV4dF07XG5cdFx0XHRcdFx0XHRpZiAoIWZvcm1hdCkge1xuXHRcdFx0XHRcdFx0XHRjb2xsZWN0b3Iud2FybihubHMubG9jYWxpemUoJ2ludmFsaWQuaWNvbnMuZGVmYXVsdC5mb250UGF0aC5leHRlbnNpb24nLCBcIkV4cGVjdGVkIGBjb250cmlidXRlcy5pY29ucy5kZWZhdWx0LmZvbnRQYXRoYCB0byBoYXZlIGZpbGUgZXh0ZW5zaW9uICd3b2ZmJywgd29mZjInIG9yICd0dGYnLCBpcyAnezB9Jy5cIiwgZmlsZUV4dCkpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb25zdCBleHRlbnNpb25Mb2NhdGlvbiA9IGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5leHRlbnNpb25Mb2NhdGlvbjtcblx0XHRcdFx0XHRcdGNvbnN0IGljb25Gb250TG9jYXRpb24gPSByZXNvdXJjZXMuam9pblBhdGgoZXh0ZW5zaW9uTG9jYXRpb24sIGRlZmF1bHRJY29uLmZvbnRQYXRoKTtcblx0XHRcdFx0XHRcdGNvbnN0IGZvbnRJZCA9IGdldEZvbnRJZChleHRlbnNpb24uZGVzY3JpcHRpb24sIGRlZmF1bHRJY29uLmZvbnRQYXRoKTtcblx0XHRcdFx0XHRcdGNvbnN0IGRlZmluaXRpb24gPSBpY29uUmVnaXN0cnkucmVnaXN0ZXJJY29uRm9udChmb250SWQsIHsgc3JjOiBbeyBsb2NhdGlvbjogaWNvbkZvbnRMb2NhdGlvbiwgZm9ybWF0IH1dIH0pO1xuXHRcdFx0XHRcdFx0aWYgKCFyZXNvdXJjZXMuaXNFcXVhbE9yUGFyZW50KGljb25Gb250TG9jYXRpb24sIGV4dGVuc2lvbkxvY2F0aW9uKSkge1xuXHRcdFx0XHRcdFx0XHRjb2xsZWN0b3Iud2FybihubHMubG9jYWxpemUoJ2ludmFsaWQuaWNvbnMuZGVmYXVsdC5mb250UGF0aC5wYXRoJywgXCJFeHBlY3RlZCBgY29udHJpYnV0ZXMuaWNvbnMuZGVmYXVsdC5mb250UGF0aGAgKHswfSkgdG8gYmUgaW5jbHVkZWQgaW5zaWRlIGV4dGVuc2lvbidzIGZvbGRlciAoezB9KS5cIiwgaWNvbkZvbnRMb2NhdGlvbi5wYXRoLCBleHRlbnNpb25Mb2NhdGlvbi5wYXRoKSk7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGljb25SZWdpc3RyeS5yZWdpc3Rlckljb24oaWQsIHtcblx0XHRcdFx0XHRcdFx0Zm9udENoYXJhY3RlcjogZGVmYXVsdEljb24uZm9udENoYXJhY3Rlcixcblx0XHRcdFx0XHRcdFx0Zm9udDoge1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBmb250SWQsXG5cdFx0XHRcdFx0XHRcdFx0ZGVmaW5pdGlvblxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9LCBpY29uQ29udHJpYnV0aW9uLmRlc2NyaXB0aW9uKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5pY29ucy5kZWZhdWx0JywgXCInY29uZmlndXJhdGlvbi5pY29ucy5kZWZhdWx0JyBtdXN0IGJlIGVpdGhlciBhIHJlZmVyZW5jZSB0byB0aGUgaWQgb2YgYW4gb3RoZXIgdGhlbWUgaWNvbiAoc3RyaW5nKSBvciBhIGljb24gZGVmaW5pdGlvbiAob2JqZWN0KSB3aXRoIHByb3BlcnRpZXMgYGZvbnRQYXRoYCBhbmQgYGZvbnRDaGFyYWN0ZXJgLlwiKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBkZWx0YS5yZW1vdmVkKSB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvblZhbHVlID0gPElJY29uRXh0ZW5zaW9uUG9pbnQ+ZXh0ZW5zaW9uLnZhbHVlO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGlkIGluIGV4dGVuc2lvblZhbHVlKSB7XG5cdFx0XHRcdFx0aWNvblJlZ2lzdHJ5LmRlcmVnaXN0ZXJJY29uKGlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbmNvbnN0IGZvcm1hdE1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcblx0J3R0Zic6ICd0cnVldHlwZScsXG5cdCd3b2ZmJzogJ3dvZmYnLFxuXHQnd29mZjInOiAnd29mZjInXG59O1xuXG5mdW5jdGlvbiBnZXRGb250SWQoZGVzY3JpcHRpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgZm9udFBhdGg6IHN0cmluZykge1xuXHRyZXR1cm4gcG9zaXguam9pbihkZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlLCBmb250UGF0aCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUywwQkFBMEI7QUFDbkMsU0FBd0IsY0FBYyw4QkFBOEI7QUFDcEUsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFBaUI7QUFDMUIsWUFBWSxlQUFlO0FBRTNCLFNBQVMsU0FBUyxhQUFhO0FBUy9CLE1BQU0sZUFBOEIsU0FBUyxHQUFrQix1QkFBdUIsZ0JBQWdCO0FBRXRHLE1BQU0sc0JBQXNCLGFBQWEsdUJBQXVCO0FBQ2hFLE1BQU0sZ0JBQWdCLElBQUksVUFBVSxlQUFlLEtBQUssVUFBVSxlQUFlO0FBRWpGLE1BQU0sNEJBQTRCLG1CQUFtQix1QkFBNEM7QUFBQSxFQUNoRyxnQkFBZ0I7QUFBQSxFQUNoQixZQUFZO0FBQUEsSUFDWCxhQUFhLElBQUksU0FBUyxxQkFBcUIsOENBQThDO0FBQUEsSUFDN0YsTUFBTTtBQUFBLElBQ04sZUFBZTtBQUFBLE1BQ2QsU0FBUztBQUFBLE1BQ1QsYUFBYSxJQUFJLFNBQVMsdUJBQXVCLHFDQUFxQztBQUFBLE1BQ3RGLHFCQUFxQixJQUFJLFNBQVMsOEJBQThCLHlJQUF5STtBQUFBLElBQzFNO0FBQUEsSUFDQSxzQkFBc0I7QUFBQSxNQUNyQixNQUFNO0FBQUEsTUFDTixZQUFZO0FBQUEsUUFDWCxhQUFhO0FBQUEsVUFDWixNQUFNO0FBQUEsVUFDTixhQUFhLElBQUksU0FBUyxnQ0FBZ0Msc0NBQXNDO0FBQUEsUUFDakc7QUFBQSxRQUNBLFNBQVM7QUFBQSxVQUNSLE9BQU87QUFBQSxZQUNOO0FBQUEsWUFDQTtBQUFBLGNBQ0MsTUFBTTtBQUFBLGNBQ04sWUFBWTtBQUFBLGdCQUNYLFVBQVU7QUFBQSxrQkFDVCxhQUFhLElBQUksU0FBUyxxQ0FBcUMsa0RBQWtEO0FBQUEsa0JBQ2pILE1BQU07QUFBQSxnQkFDUDtBQUFBLGdCQUNBLGVBQWU7QUFBQSxrQkFDZCxhQUFhLElBQUksU0FBUywwQ0FBMEMsOENBQThDO0FBQUEsa0JBQ2xILE1BQU07QUFBQSxnQkFDUDtBQUFBLGNBQ0Q7QUFBQSxjQUNBLFVBQVUsQ0FBQyxZQUFZLGVBQWU7QUFBQSxjQUN0QyxpQkFBaUIsQ0FBQyxFQUFFLE1BQU0sRUFBRSxVQUFVLHdCQUF3QixlQUFlLGdCQUFnQixFQUFFLENBQUM7QUFBQSxZQUNqRztBQUFBLFVBQ0Q7QUFBQSxVQUNBLGFBQWEsSUFBSSxTQUFTLDRCQUE0QixrR0FBa0c7QUFBQSxRQUN6SjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLFVBQVUsQ0FBQyxlQUFlLFNBQVM7QUFBQSxNQUNuQyxpQkFBaUIsQ0FBQyxFQUFFLE1BQU0sRUFBRSxhQUFhLGdCQUFnQixTQUFTLEVBQUUsVUFBVSx3QkFBd0IsZUFBZSxnQkFBZ0IsRUFBRSxFQUFFLENBQUM7QUFBQSxJQUMzSTtBQUFBLElBQ0EsaUJBQWlCLENBQUMsRUFBRSxNQUFNLEVBQUUsbUJBQW1CLEVBQUUsYUFBYSxnQkFBZ0IsU0FBUyxFQUFFLFVBQVUsd0JBQXdCLGVBQWUsZ0JBQWdCLEVBQUUsRUFBRSxFQUFFLENBQUM7QUFBQSxFQUNsSztBQUNELENBQUM7QUFFTSxNQUFNLG1CQUFtQjtBQUFBLEVBRS9CLGNBQWM7QUFDYiw4QkFBMEIsV0FBVyxDQUFDLFlBQVksVUFBVTtBQUMzRCxpQkFBVyxhQUFhLE1BQU0sT0FBTztBQUNwQyxjQUFNLGlCQUFzQyxVQUFVO0FBQ3RELGNBQU0sWUFBWSxVQUFVO0FBRTVCLFlBQUksQ0FBQyxrQkFBa0IsT0FBTyxtQkFBbUIsVUFBVTtBQUMxRCxvQkFBVSxNQUFNLElBQUksU0FBUywrQkFBK0IsNEVBQTRFLENBQUM7QUFDekk7QUFBQSxRQUNEO0FBRUEsbUJBQVcsTUFBTSxnQkFBZ0I7QUFDaEMsY0FBSSxDQUFDLEdBQUcsTUFBTSxhQUFhLEdBQUc7QUFDN0Isc0JBQVUsTUFBTSxJQUFJLFNBQVMsMkJBQTJCLG1MQUFtTCxDQUFDO0FBQzVPO0FBQUEsVUFDRDtBQUNBLGdCQUFNLG1CQUFtQixlQUFlLEVBQUU7QUFDMUMsY0FBSSxPQUFPLGlCQUFpQixnQkFBZ0IsWUFBWSxpQkFBaUIsWUFBWSxXQUFXLEdBQUc7QUFDbEcsc0JBQVUsTUFBTSxJQUFJLFNBQVMsNkJBQTZCLHdFQUF3RSxDQUFDO0FBQ25JO0FBQUEsVUFDRDtBQUNBLGdCQUFNLGNBQWMsaUJBQWlCO0FBQ3JDLGNBQUksT0FBTyxnQkFBZ0IsVUFBVTtBQUNwQyx5QkFBYSxhQUFhLElBQUksRUFBRSxJQUFJLFlBQVksR0FBRyxpQkFBaUIsV0FBVztBQUFBLFVBQ2hGLFdBQVcsT0FBTyxnQkFBZ0IsWUFBWSxPQUFPLFlBQVksYUFBYSxZQUFZLE9BQU8sWUFBWSxrQkFBa0IsVUFBVTtBQUN4SSxrQkFBTSxVQUFVLFFBQVEsWUFBWSxRQUFRLEVBQUUsVUFBVSxDQUFDO0FBQ3pELGtCQUFNLFNBQVMsVUFBVSxPQUFPO0FBQ2hDLGdCQUFJLENBQUMsUUFBUTtBQUNaLHdCQUFVLEtBQUssSUFBSSxTQUFTLDRDQUE0QywyR0FBMkcsT0FBTyxDQUFDO0FBQzNMO0FBQUEsWUFDRDtBQUNBLGtCQUFNLG9CQUFvQixVQUFVLFlBQVk7QUFDaEQsa0JBQU0sbUJBQW1CLFVBQVUsU0FBUyxtQkFBbUIsWUFBWSxRQUFRO0FBQ25GLGtCQUFNLFNBQVMsVUFBVSxVQUFVLGFBQWEsWUFBWSxRQUFRO0FBQ3BFLGtCQUFNLGFBQWEsYUFBYSxpQkFBaUIsUUFBUSxFQUFFLEtBQUssQ0FBQyxFQUFFLFVBQVUsa0JBQWtCLE9BQU8sQ0FBQyxFQUFFLENBQUM7QUFDMUcsZ0JBQUksQ0FBQyxVQUFVLGdCQUFnQixrQkFBa0IsaUJBQWlCLEdBQUc7QUFDcEUsd0JBQVUsS0FBSyxJQUFJLFNBQVMsdUNBQXVDLHVHQUF1RyxpQkFBaUIsTUFBTSxrQkFBa0IsSUFBSSxDQUFDO0FBQ3hOO0FBQUEsWUFDRDtBQUNBLHlCQUFhLGFBQWEsSUFBSTtBQUFBLGNBQzdCLGVBQWUsWUFBWTtBQUFBLGNBQzNCLE1BQU07QUFBQSxnQkFDTCxJQUFJO0FBQUEsZ0JBQ0o7QUFBQSxjQUNEO0FBQUEsWUFDRCxHQUFHLGlCQUFpQixXQUFXO0FBQUEsVUFDaEMsT0FBTztBQUNOLHNCQUFVLE1BQU0sSUFBSSxTQUFTLHlCQUF5QixrTEFBa0wsQ0FBQztBQUFBLFVBQzFPO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFDQSxpQkFBVyxhQUFhLE1BQU0sU0FBUztBQUN0QyxjQUFNLGlCQUFzQyxVQUFVO0FBQ3RELG1CQUFXLE1BQU0sZ0JBQWdCO0FBQ2hDLHVCQUFhLGVBQWUsRUFBRTtBQUFBLFFBQy9CO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFDRDtBQUVBLE1BQU0sWUFBb0M7QUFBQSxFQUN6QyxPQUFPO0FBQUEsRUFDUCxRQUFRO0FBQUEsRUFDUixTQUFTO0FBQ1Y7QUFFQSxTQUFTLFVBQVUsYUFBb0MsVUFBa0I7QUFDeEUsU0FBTyxNQUFNLEtBQUssWUFBWSxXQUFXLE9BQU8sUUFBUTtBQUN6RDsiLAogICJuYW1lcyI6IFtdCn0K
