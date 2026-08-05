import * as nls from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as JSONExtensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { fontIdErrorMessage, fontIdRegex, fontStyleRegex, fontWeightRegex, iconsSchemaId } from "../../../../platform/theme/common/iconRegistry.js";
const schemaId = "vscode://schemas/product-icon-theme";
const schema = {
  type: "object",
  allowComments: true,
  allowTrailingCommas: true,
  properties: {
    fonts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: nls.localize("schema.id", "The ID of the font."),
            pattern: fontIdRegex.source,
            patternErrorMessage: fontIdErrorMessage
          },
          src: {
            type: "array",
            description: nls.localize("schema.src", "The location of the font."),
            items: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: nls.localize("schema.font-path", "The font path, relative to the current product icon theme file.")
                },
                format: {
                  type: "string",
                  description: nls.localize("schema.font-format", "The format of the font."),
                  enum: ["woff", "woff2", "truetype", "opentype", "embedded-opentype", "svg"]
                }
              },
              required: [
                "path",
                "format"
              ]
            }
          },
          weight: {
            type: "string",
            description: nls.localize("schema.font-weight", "The weight of the font. See https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight for valid values."),
            anyOf: [
              { enum: ["normal", "bold", "lighter", "bolder"] },
              { type: "string", pattern: fontWeightRegex.source }
            ]
          },
          style: {
            type: "string",
            description: nls.localize("schema.font-style", "The style of the font. See https://developer.mozilla.org/en-US/docs/Web/CSS/font-style for valid values."),
            anyOf: [
              { enum: ["normal", "italic", "oblique"] },
              { type: "string", pattern: fontStyleRegex.source }
            ]
          }
        },
        required: [
          "id",
          "src"
        ]
      }
    },
    iconDefinitions: {
      description: nls.localize("schema.iconDefinitions", "Association of icon name to a font character."),
      $ref: iconsSchemaId
    }
  }
};
function registerProductIconThemeSchemas() {
  const schemaRegistry = Registry.as(JSONExtensions.JSONContribution);
  schemaRegistry.registerSchema(schemaId, schema);
}
export {
  registerProductIconThemeSchemas
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2NvbW1vbi9wcm9kdWN0SWNvblRoZW1lU2NoZW1hLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuXG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIEpTT05FeHRlbnNpb25zLCBJSlNPTkNvbnRyaWJ1dGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vanNvbnNjaGVtYXMvY29tbW9uL2pzb25Db250cmlidXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgZm9udElkRXJyb3JNZXNzYWdlLCBmb250SWRSZWdleCwgZm9udFN0eWxlUmVnZXgsIGZvbnRXZWlnaHRSZWdleCwgaWNvbnNTY2hlbWFJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuXG5jb25zdCBzY2hlbWFJZCA9ICd2c2NvZGU6Ly9zY2hlbWFzL3Byb2R1Y3QtaWNvbi10aGVtZSc7XG5jb25zdCBzY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnb2JqZWN0Jyxcblx0YWxsb3dDb21tZW50czogdHJ1ZSxcblx0YWxsb3dUcmFpbGluZ0NvbW1hczogdHJ1ZSxcblx0cHJvcGVydGllczoge1xuXHRcdGZvbnRzOiB7XG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRpZDoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuaWQnLCAnVGhlIElEIG9mIHRoZSBmb250LicpLFxuXHRcdFx0XHRcdFx0cGF0dGVybjogZm9udElkUmVnZXguc291cmNlLFxuXHRcdFx0XHRcdFx0cGF0dGVybkVycm9yTWVzc2FnZTogZm9udElkRXJyb3JNZXNzYWdlXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzcmM6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuc3JjJywgJ1RoZSBsb2NhdGlvbiBvZiB0aGUgZm9udC4nKSxcblx0XHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuZm9udC1wYXRoJywgJ1RoZSBmb250IHBhdGgsIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHByb2R1Y3QgaWNvbiB0aGVtZSBmaWxlLicpLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0Zm9ybWF0OiB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5mb250LWZvcm1hdCcsICdUaGUgZm9ybWF0IG9mIHRoZSBmb250LicpLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZW51bTogWyd3b2ZmJywgJ3dvZmYyJywgJ3RydWV0eXBlJywgJ29wZW50eXBlJywgJ2VtYmVkZGVkLW9wZW50eXBlJywgJ3N2ZyddXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRyZXF1aXJlZDogW1xuXHRcdFx0XHRcdFx0XHRcdCdwYXRoJyxcblx0XHRcdFx0XHRcdFx0XHQnZm9ybWF0J1xuXHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR3ZWlnaHQ6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZvbnQtd2VpZ2h0JywgJ1RoZSB3ZWlnaHQgb2YgdGhlIGZvbnQuIFNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9DU1MvZm9udC13ZWlnaHQgZm9yIHZhbGlkIHZhbHVlcy4nKSxcblx0XHRcdFx0XHRcdGFueU9mOiBbXG5cdFx0XHRcdFx0XHRcdHsgZW51bTogWydub3JtYWwnLCAnYm9sZCcsICdsaWdodGVyJywgJ2JvbGRlciddIH0sXG5cdFx0XHRcdFx0XHRcdHsgdHlwZTogJ3N0cmluZycsIHBhdHRlcm46IGZvbnRXZWlnaHRSZWdleC5zb3VyY2UgfVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZvbnQtc3R5bGUnLCAnVGhlIHN0eWxlIG9mIHRoZSBmb250LiBTZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL2ZvbnQtc3R5bGUgZm9yIHZhbGlkIHZhbHVlcy4nKSxcblx0XHRcdFx0XHRcdGFueU9mOiBbXG5cdFx0XHRcdFx0XHRcdHsgZW51bTogWydub3JtYWwnLCAnaXRhbGljJywgJ29ibGlxdWUnXSB9LFxuXHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdzdHJpbmcnLCBwYXR0ZXJuOiBmb250U3R5bGVSZWdleC5zb3VyY2UgfVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0cmVxdWlyZWQ6IFtcblx0XHRcdFx0XHQnaWQnLFxuXHRcdFx0XHRcdCdzcmMnXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9LFxuXHRcdGljb25EZWZpbml0aW9uczoge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmljb25EZWZpbml0aW9ucycsICdBc3NvY2lhdGlvbiBvZiBpY29uIG5hbWUgdG8gYSBmb250IGNoYXJhY3Rlci4nKSxcblx0XHRcdCRyZWY6IGljb25zU2NoZW1hSWRcblx0XHR9XG5cdH1cbn07XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclByb2R1Y3RJY29uVGhlbWVTY2hlbWFzKCkge1xuXHRjb25zdCBzY2hlbWFSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElKU09OQ29udHJpYnV0aW9uUmVnaXN0cnk+KEpTT05FeHRlbnNpb25zLkpTT05Db250cmlidXRpb24pO1xuXHRzY2hlbWFSZWdpc3RyeS5yZWdpc3RlclNjaGVt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
