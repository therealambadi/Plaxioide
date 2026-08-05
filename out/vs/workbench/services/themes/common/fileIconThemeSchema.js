import * as nls from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as JSONExtensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { fontWeightRegex, fontStyleRegex, fontSizeRegex, fontIdRegex, fontColorRegex, fontIdErrorMessage } from "../../../../platform/theme/common/iconRegistry.js";
const schemaId = "vscode://schemas/icon-theme";
const schema = {
  type: "object",
  allowComments: true,
  allowTrailingCommas: true,
  definitions: {
    folderExpanded: {
      type: "string",
      description: nls.localize("schema.folderExpanded", "The folder icon for expanded folders. The expanded folder icon is optional. If not set, the icon defined for folder will be shown.")
    },
    folder: {
      type: "string",
      description: nls.localize("schema.folder", "The folder icon for collapsed folders, and if folderExpanded is not set, also for expanded folders.")
    },
    file: {
      type: "string",
      description: nls.localize("schema.file", "The default file icon, shown for all files that don't match any extension, filename or language id.")
    },
    rootFolder: {
      type: "string",
      description: nls.localize("schema.rootFolder", "The folder icon for collapsed root folders, and if rootFolderExpanded is not set, also for expanded root folders.")
    },
    rootFolderExpanded: {
      type: "string",
      description: nls.localize("schema.rootFolderExpanded", "The folder icon for expanded root folders. The expanded root folder icon is optional. If not set, the icon defined for root folder will be shown.")
    },
    rootFolderNames: {
      type: "object",
      description: nls.localize("schema.rootFolderNames", "Associates root folder names to icons. The object key is the root folder name. No patterns or wildcards are allowed. Root folder name matching is case insensitive."),
      additionalProperties: {
        type: "string",
        description: nls.localize("schema.folderName", "The ID of the icon definition for the association.")
      }
    },
    rootFolderNamesExpanded: {
      type: "object",
      description: nls.localize("schema.rootFolderNamesExpanded", "Associates root folder names to icons for expanded root folders. The object key is the root folder name. No patterns or wildcards are allowed. Root folder name matching is case insensitive."),
      additionalProperties: {
        type: "string",
        description: nls.localize("schema.rootFolderNameExpanded", "The ID of the icon definition for the association.")
      }
    },
    folderNames: {
      type: "object",
      description: nls.localize("schema.folderNames", "Associates folder names to icons. The object key is the folder name, not including any path segments. No patterns or wildcards are allowed. Folder name matching is case insensitive."),
      additionalProperties: {
        type: "string",
        description: nls.localize("schema.folderName", "The ID of the icon definition for the association.")
      }
    },
    folderNamesExpanded: {
      type: "object",
      description: nls.localize("schema.folderNamesExpanded", "Associates folder names to icons for expanded folders. The object key is the folder name, not including any path segments. No patterns or wildcards are allowed. Folder name matching is case insensitive."),
      additionalProperties: {
        type: "string",
        description: nls.localize("schema.folderNameExpanded", "The ID of the icon definition for the association.")
      }
    },
    fileExtensions: {
      type: "object",
      description: nls.localize("schema.fileExtensions", "Associates file extensions to icons. The object key is the file extension name. The extension name is the last segment of a file name after the last dot (not including the dot). Extensions are compared case insensitive."),
      additionalProperties: {
        type: "string",
        description: nls.localize("schema.fileExtension", "The ID of the icon definition for the association.")
      }
    },
    fileNames: {
      type: "object",
      description: nls.localize("schema.fileNames", "Associates file names to icons. The object key is the full file name, but not including any path segments. File name can include dots and a possible file extension. No patterns or wildcards are allowed. File name matching is case insensitive."),
      additionalProperties: {
        type: "string",
        description: nls.localize("schema.fileName", "The ID of the icon definition for the association.")
      }
    },
    languageIds: {
      type: "object",
      description: nls.localize("schema.languageIds", "Associates languages to icons. The object key is the language id as defined in the language contribution point."),
      additionalProperties: {
        type: "string",
        description: nls.localize("schema.languageId", "The ID of the icon definition for the association.")
      }
    },
    associations: {
      type: "object",
      properties: {
        folderExpanded: {
          $ref: "#/definitions/folderExpanded"
        },
        folder: {
          $ref: "#/definitions/folder"
        },
        file: {
          $ref: "#/definitions/file"
        },
        folderNames: {
          $ref: "#/definitions/folderNames"
        },
        folderNamesExpanded: {
          $ref: "#/definitions/folderNamesExpanded"
        },
        rootFolder: {
          $ref: "#/definitions/rootFolder"
        },
        rootFolderExpanded: {
          $ref: "#/definitions/rootFolderExpanded"
        },
        rootFolderNames: {
          $ref: "#/definitions/rootFolderNames"
        },
        rootFolderNamesExpanded: {
          $ref: "#/definitions/rootFolderNamesExpanded"
        },
        fileExtensions: {
          $ref: "#/definitions/fileExtensions"
        },
        fileNames: {
          $ref: "#/definitions/fileNames"
        },
        languageIds: {
          $ref: "#/definitions/languageIds"
        }
      }
    }
  },
  properties: {
    fonts: {
      type: "array",
      description: nls.localize("schema.fonts", "Fonts that are used in the icon definitions."),
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
                  description: nls.localize("schema.font-path", "The font path, relative to the current file icon theme file.")
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
            pattern: fontWeightRegex.source
          },
          style: {
            type: "string",
            description: nls.localize("schema.font-style", "The style of the font. See https://developer.mozilla.org/en-US/docs/Web/CSS/font-style for valid values."),
            pattern: fontStyleRegex.source
          },
          size: {
            type: "string",
            description: nls.localize("schema.font-size", "The default size of the font. We strongly recommend using a percentage value, for example: 125%."),
            pattern: fontSizeRegex.source
          }
        },
        required: [
          "id",
          "src"
        ]
      }
    },
    iconDefinitions: {
      type: "object",
      description: nls.localize("schema.iconDefinitions", "Description of all icons that can be used when associating files to icons."),
      additionalProperties: {
        type: "object",
        description: nls.localize("schema.iconDefinition", "An icon definition. The object key is the ID of the definition."),
        properties: {
          iconPath: {
            type: "string",
            description: nls.localize("schema.iconPath", "When using a SVG or PNG: The path to the image. The path is relative to the icon set file.")
          },
          fontCharacter: {
            type: "string",
            description: nls.localize("schema.fontCharacter", "When using a glyph font: The character in the font to use.")
          },
          fontColor: {
            type: "string",
            format: "color-hex",
            description: nls.localize("schema.fontColor", "When using a glyph font: The color to use."),
            pattern: fontColorRegex.source
          },
          fontSize: {
            type: "string",
            description: nls.localize("schema.fontSize", "When using a font: The font size in percentage to the text font. If not set, defaults to the size in the font definition."),
            pattern: fontSizeRegex.source
          },
          fontId: {
            type: "string",
            description: nls.localize("schema.fontId", "When using a font: The id of the font. If not set, defaults to the first font definition."),
            pattern: fontIdRegex.source,
            patternErrorMessage: fontIdErrorMessage
          }
        }
      }
    },
    folderExpanded: {
      $ref: "#/definitions/folderExpanded"
    },
    folder: {
      $ref: "#/definitions/folder"
    },
    file: {
      $ref: "#/definitions/file"
    },
    folderNames: {
      $ref: "#/definitions/folderNames"
    },
    folderNamesExpanded: {
      $ref: "#/definitions/folderNamesExpanded"
    },
    rootFolder: {
      $ref: "#/definitions/rootFolder"
    },
    rootFolderExpanded: {
      $ref: "#/definitions/rootFolderExpanded"
    },
    rootFolderNames: {
      $ref: "#/definitions/rootFolderNames"
    },
    rootFolderNamesExpanded: {
      $ref: "#/definitions/rootFolderNamesExpanded"
    },
    fileExtensions: {
      $ref: "#/definitions/fileExtensions"
    },
    fileNames: {
      $ref: "#/definitions/fileNames"
    },
    languageIds: {
      $ref: "#/definitions/languageIds"
    },
    light: {
      $ref: "#/definitions/associations",
      description: nls.localize("schema.light", "Optional associations for file icons in light color themes.")
    },
    highContrast: {
      $ref: "#/definitions/associations",
      description: nls.localize("schema.highContrast", "Optional associations for file icons in high contrast color themes.")
    },
    hidesExplorerArrows: {
      type: "boolean",
      description: nls.localize("schema.hidesExplorerArrows", "Configures whether the file explorer's arrows should be hidden when this theme is active.")
    },
    showLanguageModeIcons: {
      type: "boolean",
      description: nls.localize("schema.showLanguageModeIcons", "Configures whether the default language icons should be used if the theme does not define an icon for a language.")
    }
  }
};
function registerFileIconThemeSchemas() {
  const schemaRegistry = Registry.as(JSONExtensions.JSONContribution);
  schemaRegistry.registerSchema(schemaId, schema);
}
export {
  registerFileIconThemeSchemas
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2NvbW1vbi9maWxlSWNvblRoZW1lU2NoZW1hLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuXG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIEpTT05FeHRlbnNpb25zLCBJSlNPTkNvbnRyaWJ1dGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vanNvbnNjaGVtYXMvY29tbW9uL2pzb25Db250cmlidXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgZm9udFdlaWdodFJlZ2V4LCBmb250U3R5bGVSZWdleCwgZm9udFNpemVSZWdleCwgZm9udElkUmVnZXgsIGZvbnRDb2xvclJlZ2V4LCBmb250SWRFcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcblxuY29uc3Qgc2NoZW1hSWQgPSAndnNjb2RlOi8vc2NoZW1hcy9pY29uLXRoZW1lJztcbmNvbnN0IHNjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdHR5cGU6ICdvYmplY3QnLFxuXHRhbGxvd0NvbW1lbnRzOiB0cnVlLFxuXHRhbGxvd1RyYWlsaW5nQ29tbWFzOiB0cnVlLFxuXHRkZWZpbml0aW9uczoge1xuXHRcdGZvbGRlckV4cGFuZGVkOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5mb2xkZXJFeHBhbmRlZCcsICdUaGUgZm9sZGVyIGljb24gZm9yIGV4cGFuZGVkIGZvbGRlcnMuIFRoZSBleHBhbmRlZCBmb2xkZXIgaWNvbiBpcyBvcHRpb25hbC4gSWYgbm90IHNldCwgdGhlIGljb24gZGVmaW5lZCBmb3IgZm9sZGVyIHdpbGwgYmUgc2hvd24uJylcblx0XHR9LFxuXHRcdGZvbGRlcjoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuZm9sZGVyJywgJ1RoZSBmb2xkZXIgaWNvbiBmb3IgY29sbGFwc2VkIGZvbGRlcnMsIGFuZCBpZiBmb2xkZXJFeHBhbmRlZCBpcyBub3Qgc2V0LCBhbHNvIGZvciBleHBhbmRlZCBmb2xkZXJzLicpXG5cblx0XHR9LFxuXHRcdGZpbGU6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZpbGUnLCAnVGhlIGRlZmF1bHQgZmlsZSBpY29uLCBzaG93biBmb3IgYWxsIGZpbGVzIHRoYXQgZG9uXFwndCBtYXRjaCBhbnkgZXh0ZW5zaW9uLCBmaWxlbmFtZSBvciBsYW5ndWFnZSBpZC4nKVxuXG5cdFx0fSxcblx0XHRyb290Rm9sZGVyOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5yb290Rm9sZGVyJywgJ1RoZSBmb2xkZXIgaWNvbiBmb3IgY29sbGFwc2VkIHJvb3QgZm9sZGVycywgYW5kIGlmIHJvb3RGb2xkZXJFeHBhbmRlZCBpcyBub3Qgc2V0LCBhbHNvIGZvciBleHBhbmRlZCByb290IGZvbGRlcnMuJylcblx0XHR9LFxuXHRcdHJvb3RGb2xkZXJFeHBhbmRlZDoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEucm9vdEZvbGRlckV4cGFuZGVkJywgJ1RoZSBmb2xkZXIgaWNvbiBmb3IgZXhwYW5kZWQgcm9vdCBmb2xkZXJzLiBUaGUgZXhwYW5kZWQgcm9vdCBmb2xkZXIgaWNvbiBpcyBvcHRpb25hbC4gSWYgbm90IHNldCwgdGhlIGljb24gZGVmaW5lZCBmb3Igcm9vdCBmb2xkZXIgd2lsbCBiZSBzaG93bi4nKVxuXHRcdH0sXG5cdFx0cm9vdEZvbGRlck5hbWVzOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5yb290Rm9sZGVyTmFtZXMnLCAnQXNzb2NpYXRlcyByb290IGZvbGRlciBuYW1lcyB0byBpY29ucy4gVGhlIG9iamVjdCBrZXkgaXMgdGhlIHJvb3QgZm9sZGVyIG5hbWUuIE5vIHBhdHRlcm5zIG9yIHdpbGRjYXJkcyBhcmUgYWxsb3dlZC4gUm9vdCBmb2xkZXIgbmFtZSBtYXRjaGluZyBpcyBjYXNlIGluc2Vuc2l0aXZlLicpLFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5mb2xkZXJOYW1lJywgJ1RoZSBJRCBvZiB0aGUgaWNvbiBkZWZpbml0aW9uIGZvciB0aGUgYXNzb2NpYXRpb24uJylcblx0XHRcdH1cblx0XHR9LFxuXHRcdHJvb3RGb2xkZXJOYW1lc0V4cGFuZGVkOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5yb290Rm9sZGVyTmFtZXNFeHBhbmRlZCcsICdBc3NvY2lhdGVzIHJvb3QgZm9sZGVyIG5hbWVzIHRvIGljb25zIGZvciBleHBhbmRlZCByb290IGZvbGRlcnMuIFRoZSBvYmplY3Qga2V5IGlzIHRoZSByb290IGZvbGRlciBuYW1lLiBObyBwYXR0ZXJucyBvciB3aWxkY2FyZHMgYXJlIGFsbG93ZWQuIFJvb3QgZm9sZGVyIG5hbWUgbWF0Y2hpbmcgaXMgY2FzZSBpbnNlbnNpdGl2ZS4nKSxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEucm9vdEZvbGRlck5hbWVFeHBhbmRlZCcsICdUaGUgSUQgb2YgdGhlIGljb24gZGVmaW5pdGlvbiBmb3IgdGhlIGFzc29jaWF0aW9uLicpXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRmb2xkZXJOYW1lczoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuZm9sZGVyTmFtZXMnLCAnQXNzb2NpYXRlcyBmb2xkZXIgbmFtZXMgdG8gaWNvbnMuIFRoZSBvYmplY3Qga2V5IGlzIHRoZSBmb2xkZXIgbmFtZSwgbm90IGluY2x1ZGluZyBhbnkgcGF0aCBzZWdtZW50cy4gTm8gcGF0dGVybnMgb3Igd2lsZGNhcmRzIGFyZSBhbGxvd2VkLiBGb2xkZXIgbmFtZSBtYXRjaGluZyBpcyBjYXNlIGluc2Vuc2l0aXZlLicpLFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5mb2xkZXJOYW1lJywgJ1RoZSBJRCBvZiB0aGUgaWNvbiBkZWZpbml0aW9uIGZvciB0aGUgYXNzb2NpYXRpb24uJylcblx0XHRcdH1cblx0XHR9LFxuXHRcdGZvbGRlck5hbWVzRXhwYW5kZWQ6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZvbGRlck5hbWVzRXhwYW5kZWQnLCAnQXNzb2NpYXRlcyBmb2xkZXIgbmFtZXMgdG8gaWNvbnMgZm9yIGV4cGFuZGVkIGZvbGRlcnMuIFRoZSBvYmplY3Qga2V5IGlzIHRoZSBmb2xkZXIgbmFtZSwgbm90IGluY2x1ZGluZyBhbnkgcGF0aCBzZWdtZW50cy4gTm8gcGF0dGVybnMgb3Igd2lsZGNhcmRzIGFyZSBhbGxvd2VkLiBGb2xkZXIgbmFtZSBtYXRjaGluZyBpcyBjYXNlIGluc2Vuc2l0aXZlLicpLFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5mb2xkZXJOYW1lRXhwYW5kZWQnLCAnVGhlIElEIG9mIHRoZSBpY29uIGRlZmluaXRpb24gZm9yIHRoZSBhc3NvY2lhdGlvbi4nKVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0ZmlsZUV4dGVuc2lvbnM6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZpbGVFeHRlbnNpb25zJywgJ0Fzc29jaWF0ZXMgZmlsZSBleHRlbnNpb25zIHRvIGljb25zLiBUaGUgb2JqZWN0IGtleSBpcyB0aGUgZmlsZSBleHRlbnNpb24gbmFtZS4gVGhlIGV4dGVuc2lvbiBuYW1lIGlzIHRoZSBsYXN0IHNlZ21lbnQgb2YgYSBmaWxlIG5hbWUgYWZ0ZXIgdGhlIGxhc3QgZG90IChub3QgaW5jbHVkaW5nIHRoZSBkb3QpLiBFeHRlbnNpb25zIGFyZSBjb21wYXJlZCBjYXNlIGluc2Vuc2l0aXZlLicpLFxuXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZpbGVFeHRlbnNpb24nLCAnVGhlIElEIG9mIHRoZSBpY29uIGRlZmluaXRpb24gZm9yIHRoZSBhc3NvY2lhdGlvbi4nKVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0ZmlsZU5hbWVzOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5maWxlTmFtZXMnLCAnQXNzb2NpYXRlcyBmaWxlIG5hbWVzIHRvIGljb25zLiBUaGUgb2JqZWN0IGtleSBpcyB0aGUgZnVsbCBmaWxlIG5hbWUsIGJ1dCBub3QgaW5jbHVkaW5nIGFueSBwYXRoIHNlZ21lbnRzLiBGaWxlIG5hbWUgY2FuIGluY2x1ZGUgZG90cyBhbmQgYSBwb3NzaWJsZSBmaWxlIGV4dGVuc2lvbi4gTm8gcGF0dGVybnMgb3Igd2lsZGNhcmRzIGFyZSBhbGxvd2VkLiBGaWxlIG5hbWUgbWF0Y2hpbmcgaXMgY2FzZSBpbnNlbnNpdGl2ZS4nKSxcblxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5maWxlTmFtZScsICdUaGUgSUQgb2YgdGhlIGljb24gZGVmaW5pdGlvbiBmb3IgdGhlIGFzc29jaWF0aW9uLicpXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRsYW5ndWFnZUlkczoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEubGFuZ3VhZ2VJZHMnLCAnQXNzb2NpYXRlcyBsYW5ndWFnZXMgdG8gaWNvbnMuIFRoZSBvYmplY3Qga2V5IGlzIHRoZSBsYW5ndWFnZSBpZCBhcyBkZWZpbmVkIGluIHRoZSBsYW5ndWFnZSBjb250cmlidXRpb24gcG9pbnQuJyksXG5cblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEubGFuZ3VhZ2VJZCcsICdUaGUgSUQgb2YgdGhlIGljb24gZGVmaW5pdGlvbiBmb3IgdGhlIGFzc29jaWF0aW9uLicpXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRhc3NvY2lhdGlvbnM6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRmb2xkZXJFeHBhbmRlZDoge1xuXHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL2ZvbGRlckV4cGFuZGVkJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRmb2xkZXI6IHtcblx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9mb2xkZXInXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGZpbGU6IHtcblx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9maWxlJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRmb2xkZXJOYW1lczoge1xuXHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL2ZvbGRlck5hbWVzJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRmb2xkZXJOYW1lc0V4cGFuZGVkOiB7XG5cdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvZm9sZGVyTmFtZXNFeHBhbmRlZCdcblx0XHRcdFx0fSxcblx0XHRcdFx0cm9vdEZvbGRlcjoge1xuXHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3Jvb3RGb2xkZXInXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJvb3RGb2xkZXJFeHBhbmRlZDoge1xuXHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3Jvb3RGb2xkZXJFeHBhbmRlZCdcblx0XHRcdFx0fSxcblx0XHRcdFx0cm9vdEZvbGRlck5hbWVzOiB7XG5cdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvcm9vdEZvbGRlck5hbWVzJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRyb290Rm9sZGVyTmFtZXNFeHBhbmRlZDoge1xuXHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3Jvb3RGb2xkZXJOYW1lc0V4cGFuZGVkJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRmaWxlRXh0ZW5zaW9uczoge1xuXHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL2ZpbGVFeHRlbnNpb25zJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRmaWxlTmFtZXM6IHtcblx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9maWxlTmFtZXMnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGxhbmd1YWdlSWRzOiB7XG5cdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvbGFuZ3VhZ2VJZHMnXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cdHByb3BlcnRpZXM6IHtcblx0XHRmb250czoge1xuXHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5mb250cycsICdGb250cyB0aGF0IGFyZSB1c2VkIGluIHRoZSBpY29uIGRlZmluaXRpb25zLicpLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRpZDoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuaWQnLCAnVGhlIElEIG9mIHRoZSBmb250LicpLFxuXHRcdFx0XHRcdFx0cGF0dGVybjogZm9udElkUmVnZXguc291cmNlLFxuXHRcdFx0XHRcdFx0cGF0dGVybkVycm9yTWVzc2FnZTogZm9udElkRXJyb3JNZXNzYWdlXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzcmM6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuc3JjJywgJ1RoZSBsb2NhdGlvbiBvZiB0aGUgZm9udC4nKSxcblx0XHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuZm9udC1wYXRoJywgJ1RoZSBmb250IHBhdGgsIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IGZpbGUgaWNvbiB0aGVtZSBmaWxlLicpLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0Zm9ybWF0OiB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5mb250LWZvcm1hdCcsICdUaGUgZm9ybWF0IG9mIHRoZSBmb250LicpLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZW51bTogWyd3b2ZmJywgJ3dvZmYyJywgJ3RydWV0eXBlJywgJ29wZW50eXBlJywgJ2VtYmVkZGVkLW9wZW50eXBlJywgJ3N2ZyddXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRyZXF1aXJlZDogW1xuXHRcdFx0XHRcdFx0XHRcdCdwYXRoJyxcblx0XHRcdFx0XHRcdFx0XHQnZm9ybWF0J1xuXHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR3ZWlnaHQ6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZvbnQtd2VpZ2h0JywgJ1RoZSB3ZWlnaHQgb2YgdGhlIGZvbnQuIFNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9DU1MvZm9udC13ZWlnaHQgZm9yIHZhbGlkIHZhbHVlcy4nKSxcblx0XHRcdFx0XHRcdHBhdHRlcm46IGZvbnRXZWlnaHRSZWdleC5zb3VyY2Vcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5mb250LXN0eWxlJywgJ1RoZSBzdHlsZSBvZiB0aGUgZm9udC4gU2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0NTUy9mb250LXN0eWxlIGZvciB2YWxpZCB2YWx1ZXMuJyksXG5cdFx0XHRcdFx0XHRwYXR0ZXJuOiBmb250U3R5bGVSZWdleC5zb3VyY2Vcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHNpemU6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZvbnQtc2l6ZScsICdUaGUgZGVmYXVsdCBzaXplIG9mIHRoZSBmb250LiBXZSBzdHJvbmdseSByZWNvbW1lbmQgdXNpbmcgYSBwZXJjZW50YWdlIHZhbHVlLCBmb3IgZXhhbXBsZTogMTI1JS4nKSxcblx0XHRcdFx0XHRcdHBhdHRlcm46IGZvbnRTaXplUmVnZXguc291cmNlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRyZXF1aXJlZDogW1xuXHRcdFx0XHRcdCdpZCcsXG5cdFx0XHRcdFx0J3NyYydcblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0aWNvbkRlZmluaXRpb25zOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5pY29uRGVmaW5pdGlvbnMnLCAnRGVzY3JpcHRpb24gb2YgYWxsIGljb25zIHRoYXQgY2FuIGJlIHVzZWQgd2hlbiBhc3NvY2lhdGluZyBmaWxlcyB0byBpY29ucy4nKSxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuaWNvbkRlZmluaXRpb24nLCAnQW4gaWNvbiBkZWZpbml0aW9uLiBUaGUgb2JqZWN0IGtleSBpcyB0aGUgSUQgb2YgdGhlIGRlZmluaXRpb24uJyksXG5cdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRpY29uUGF0aDoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuaWNvblBhdGgnLCAnV2hlbiB1c2luZyBhIFNWRyBvciBQTkc6IFRoZSBwYXRoIHRvIHRoZSBpbWFnZS4gVGhlIHBhdGggaXMgcmVsYXRpdmUgdG8gdGhlIGljb24gc2V0IGZpbGUuJylcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGZvbnRDaGFyYWN0ZXI6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZvbnRDaGFyYWN0ZXInLCAnV2hlbiB1c2luZyBhIGdseXBoIGZvbnQ6IFRoZSBjaGFyYWN0ZXIgaW4gdGhlIGZvbnQgdG8gdXNlLicpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRmb250Q29sb3I6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0Zm9ybWF0OiAnY29sb3ItaGV4Jyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5mb250Q29sb3InLCAnV2hlbiB1c2luZyBhIGdseXBoIGZvbnQ6IFRoZSBjb2xvciB0byB1c2UuJyksXG5cdFx0XHRcdFx0XHRwYXR0ZXJuOiBmb250Q29sb3JSZWdleC5zb3VyY2Vcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGZvbnRTaXplOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5mb250U2l6ZScsICdXaGVuIHVzaW5nIGEgZm9udDogVGhlIGZvbnQgc2l6ZSBpbiBwZXJjZW50YWdlIHRvIHRoZSB0ZXh0IGZvbnQuIElmIG5vdCBzZXQsIGRlZmF1bHRzIHRvIHRoZSBzaXplIGluIHRoZSBmb250IGRlZmluaXRpb24uJyksXG5cdFx0XHRcdFx0XHRwYXR0ZXJuOiBmb250U2l6ZVJlZ2V4LnNvdXJjZVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Zm9udElkOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5mb250SWQnLCAnV2hlbiB1c2luZyBhIGZvbnQ6IFRoZSBpZCBvZiB0aGUgZm9udC4gSWYgbm90IHNldCwgZGVmYXVsdHMgdG8gdGhlIGZpcnN0IGZvbnQgZGVmaW5pdGlvbi4nKSxcblx0XHRcdFx0XHRcdHBhdHRlcm46IGZvbnRJZFJlZ2V4LnNvdXJjZSxcblx0XHRcdFx0XHRcdHBhdHRlcm5FcnJvck1lc3NhZ2U6IGZvbnRJZEVycm9yTWVzc2FnZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0Zm9sZGVyRXhwYW5kZWQ6IHtcblx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL2ZvbGRlckV4cGFuZGVkJ1xuXHRcdH0sXG5cdFx0Zm9sZGVyOiB7XG5cdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9mb2xkZXInXG5cdFx0fSxcblx0XHRmaWxlOiB7XG5cdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9maWxlJ1xuXHRcdH0sXG5cdFx0Zm9sZGVyTmFtZXM6IHtcblx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL2ZvbGRlck5hbWVzJ1xuXHRcdH0sXG5cdFx0Zm9sZGVyTmFtZXNFeHBhbmRlZDoge1xuXHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvZm9sZGVyTmFtZXNFeHBhbmRlZCdcblx0XHR9LFxuXHRcdHJvb3RGb2xkZXI6IHtcblx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3Jvb3RGb2xkZXInXG5cdFx0fSxcblx0XHRyb290Rm9sZGVyRXhwYW5kZWQ6IHtcblx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3Jvb3RGb2xkZXJFeHBhbmRlZCdcblx0XHR9LFxuXHRcdHJvb3RGb2xkZXJOYW1lczoge1xuXHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvcm9vdEZvbGRlck5hbWVzJ1xuXHRcdH0sXG5cdFx0cm9vdEZvbGRlck5hbWVzRXhwYW5kZWQ6IHtcblx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3Jvb3RGb2xkZXJOYW1lc0V4cGFuZGVkJ1xuXHRcdH0sXG5cdFx0ZmlsZUV4dGVuc2lvbnM6IHtcblx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL2ZpbGVFeHRlbnNpb25zJ1xuXHRcdH0sXG5cdFx0ZmlsZU5hbWVzOiB7XG5cdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9maWxlTmFtZXMnXG5cdFx0fSxcblx0XHRsYW5ndWFnZUlkczoge1xuXHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvbGFuZ3VhZ2VJZHMnXG5cdFx0fSxcblx0XHRsaWdodDoge1xuXHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvYXNzb2NpYXRpb25zJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5saWdodCcsICdPcHRpb25hbCBhc3NvY2lhdGlvbnMgZm9yIGZpbGUgaWNvbnMgaW4gbGlnaHQgY29sb3IgdGhlbWVzLicpXG5cdFx0fSxcblx0XHRoaWdoQ29udHJhc3Q6IHtcblx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL2Fzc29jaWF0aW9ucycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuaGlnaENvbnRyYXN0JywgJ09wdGlvbmFsIGFzc29jaWF0aW9ucyBmb3IgZmlsZSBpY29ucyBpbiBoaWdoIGNvbnRyYXN0IGNvbG9yIHRoZW1lcy4nKVxuXHRcdH0sXG5cdFx0aGlkZXNFeHBsb3JlckFycm93czoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmhpZGVzRXhwbG9yZXJBcnJvd3MnLCAnQ29uZmlndXJlcyB3aGV0aGVyIHRoZSBmaWxlIGV4cGxvcmVyXFwncyBhcnJvd3Mgc2hvdWxkIGJlIGhpZGRlbiB3aGVuIHRoaXMgdGhlbWUgaXMgYWN0aXZlLicpXG5cdFx0fSxcblx0XHRzaG93TGFuZ3VhZ2VNb2RlSWNvbnM6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5zaG93TGFuZ3VhZ2VNb2RlSWNvbnMnLCAnQ29uZmlndXJlcyB3aGV0aGVyIHRoZSBkZWZhdWx0IGxhbmd1YWdlIGljb25zIHNob3VsZCBiZSB1c2VkIGlmIHRoZSB0aGVtZSBkb2VzIG5vdCBkZWZpbmUgYW4gaWNvbiBmb3IgYSBsYW5ndWFnZS4nKVxuXHRcdH1cblx0fVxufTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyRmlsZUljb25UaGVtZVNjaGVtYXMoKSB7XG5cdGNvbnN0IHNjaGVtYVJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUpTT05Db250cmlidXRpb25SZWdpc3RyeT4oSlNPTkV4dGVuc2lvbnMuSlNPTkNvbnRyaWJ1dGlvbik7XG5cdHNjaGVtYVJlZ2lzdHJ5LnJlZ2lzdGVyU2NoZW1hKHNjaGVtYUlk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
