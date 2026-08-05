import * as nls from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as JSONExtensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { workbenchColorsSchemaId } from "../../../../platform/theme/common/colorRegistry.js";
import { tokenStylingSchemaId } from "../../../../platform/theme/common/tokenClassificationRegistry.js";
const textMateScopes = [
  "comment",
  "comment.block",
  "comment.block.documentation",
  "comment.line",
  "constant",
  "constant.character",
  "constant.character.escape",
  "constant.numeric",
  "constant.numeric.integer",
  "constant.numeric.float",
  "constant.numeric.hex",
  "constant.numeric.octal",
  "constant.other",
  "constant.regexp",
  "constant.rgb-value",
  "emphasis",
  "entity",
  "entity.name",
  "entity.name.class",
  "entity.name.function",
  "entity.name.method",
  "entity.name.section",
  "entity.name.selector",
  "entity.name.tag",
  "entity.name.type",
  "entity.other",
  "entity.other.attribute-name",
  "entity.other.inherited-class",
  "invalid",
  "invalid.deprecated",
  "invalid.illegal",
  "keyword",
  "keyword.control",
  "keyword.operator",
  "keyword.operator.new",
  "keyword.operator.assignment",
  "keyword.operator.arithmetic",
  "keyword.operator.logical",
  "keyword.other",
  "markup",
  "markup.bold",
  "markup.changed",
  "markup.deleted",
  "markup.heading",
  "markup.inline.raw",
  "markup.inserted",
  "markup.italic",
  "markup.list",
  "markup.list.numbered",
  "markup.list.unnumbered",
  "markup.other",
  "markup.quote",
  "markup.raw",
  "markup.underline",
  "markup.underline.link",
  "meta",
  "meta.block",
  "meta.cast",
  "meta.class",
  "meta.function",
  "meta.function-call",
  "meta.preprocessor",
  "meta.return-type",
  "meta.selector",
  "meta.tag",
  "meta.type.annotation",
  "meta.type",
  "punctuation.definition.string.begin",
  "punctuation.definition.string.end",
  "punctuation.separator",
  "punctuation.separator.continuation",
  "punctuation.terminator",
  "storage",
  "storage.modifier",
  "storage.type",
  "string",
  "string.interpolated",
  "string.other",
  "string.quoted",
  "string.quoted.double",
  "string.quoted.other",
  "string.quoted.single",
  "string.quoted.triple",
  "string.regexp",
  "string.unquoted",
  "strong",
  "support",
  "support.class",
  "support.constant",
  "support.function",
  "support.other",
  "support.type",
  "support.type.property-name",
  "support.variable",
  "variable",
  "variable.language",
  "variable.name",
  "variable.other",
  "variable.other.readwrite",
  "variable.parameter"
];
const textmateColorsSchemaId = "vscode://schemas/textmate-colors";
const textmateColorGroupSchemaId = `${textmateColorsSchemaId}#/definitions/colorGroup`;
const textmateColorSchema = {
  type: "array",
  definitions: {
    colorGroup: {
      default: "#FF0000",
      anyOf: [
        {
          type: "string",
          format: "color-hex"
        },
        {
          $ref: "#/definitions/settings"
        }
      ]
    },
    settings: {
      type: "object",
      description: nls.localize("schema.token.settings", "Colors and styles for the token."),
      properties: {
        foreground: {
          type: "string",
          description: nls.localize("schema.token.foreground", "Foreground color for the token."),
          format: "color-hex",
          default: "#ff0000"
        },
        background: {
          type: "string",
          deprecationMessage: nls.localize("schema.token.background.warning", "Token background colors are currently not supported.")
        },
        fontStyle: {
          type: "string",
          description: nls.localize("schema.token.fontStyle", "Font style of the rule: 'italic', 'bold', 'underline', 'strikethrough' or a combination. The empty string unsets inherited settings."),
          pattern: "^(\\s*\\b(italic|bold|underline|strikethrough))*\\s*$",
          patternErrorMessage: nls.localize("schema.fontStyle.error", "Font style must be 'italic', 'bold', 'underline', 'strikethrough' or a combination or the empty string."),
          defaultSnippets: [
            { label: nls.localize("schema.token.fontStyle.none", "None (clear inherited style)"), bodyText: '""' },
            { body: "italic" },
            { body: "bold" },
            { body: "underline" },
            { body: "strikethrough" },
            { body: "italic bold" },
            { body: "italic underline" },
            { body: "italic strikethrough" },
            { body: "bold underline" },
            { body: "bold strikethrough" },
            { body: "underline strikethrough" },
            { body: "italic bold underline" },
            { body: "italic bold strikethrough" },
            { body: "italic underline strikethrough" },
            { body: "bold underline strikethrough" },
            { body: "italic bold underline strikethrough" }
          ]
        }
      },
      additionalProperties: false,
      defaultSnippets: [{ body: { foreground: "${1:#FF0000}", fontStyle: "${2:bold}" } }]
    }
  },
  items: {
    type: "object",
    defaultSnippets: [{ body: { scope: "${1:keyword.operator}", settings: { foreground: "${2:#FF0000}" } } }],
    properties: {
      name: {
        type: "string",
        description: nls.localize("schema.properties.name", "Description of the rule.")
      },
      scope: {
        description: nls.localize("schema.properties.scope", "Scope selector against which this rule matches."),
        anyOf: [
          {
            enum: textMateScopes
          },
          {
            type: "string"
          },
          {
            type: "array",
            items: {
              enum: textMateScopes
            }
          },
          {
            type: "array",
            items: {
              type: "string"
            }
          }
        ]
      },
      settings: {
        $ref: "#/definitions/settings"
      }
    },
    required: [
      "settings"
    ],
    additionalProperties: false
  }
};
const colorThemeSchemaId = "vscode://schemas/color-theme";
const colorThemeSchema = {
  type: "object",
  allowComments: true,
  allowTrailingCommas: true,
  properties: {
    colors: {
      description: nls.localize("schema.workbenchColors", "Colors in the workbench"),
      $ref: workbenchColorsSchemaId,
      additionalProperties: false
    },
    tokenColors: {
      anyOf: [
        {
          type: "string",
          description: nls.localize("schema.tokenColors.path", "Path to a tmTheme file (relative to the current file).")
        },
        {
          description: nls.localize("schema.colors", "Colors for syntax highlighting"),
          $ref: textmateColorsSchemaId
        }
      ]
    },
    semanticHighlighting: {
      type: "boolean",
      description: nls.localize("schema.supportsSemanticHighlighting", "Whether semantic highlighting should be enabled for this theme.")
    },
    semanticTokenColors: {
      type: "object",
      description: nls.localize("schema.semanticTokenColors", "Colors for semantic tokens"),
      $ref: tokenStylingSchemaId
    }
  }
};
function registerColorThemeSchemas() {
  const schemaRegistry = Registry.as(JSONExtensions.JSONContribution);
  schemaRegistry.registerSchema(colorThemeSchemaId, colorThemeSchema);
  schemaRegistry.registerSchema(textmateColorsSchemaId, textmateColorSchema);
}
export {
  colorThemeSchemaId,
  registerColorThemeSchemas,
  textmateColorGroupSchemaId,
  textmateColorsSchemaId
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2NvbW1vbi9jb2xvclRoZW1lU2NoZW1hLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuXG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIEpTT05FeHRlbnNpb25zLCBJSlNPTkNvbnRyaWJ1dGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vanNvbnNjaGVtYXMvY29tbW9uL2pzb25Db250cmlidXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuXG5pbXBvcnQgeyB3b3JrYmVuY2hDb2xvcnNTY2hlbWFJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IHRva2VuU3R5bGluZ1NjaGVtYUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3Rva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeS5qcyc7XG5cbmNvbnN0IHRleHRNYXRlU2NvcGVzID0gW1xuXHQnY29tbWVudCcsXG5cdCdjb21tZW50LmJsb2NrJyxcblx0J2NvbW1lbnQuYmxvY2suZG9jdW1lbnRhdGlvbicsXG5cdCdjb21tZW50LmxpbmUnLFxuXHQnY29uc3RhbnQnLFxuXHQnY29uc3RhbnQuY2hhcmFjdGVyJyxcblx0J2NvbnN0YW50LmNoYXJhY3Rlci5lc2NhcGUnLFxuXHQnY29uc3RhbnQubnVtZXJpYycsXG5cdCdjb25zdGFudC5udW1lcmljLmludGVnZXInLFxuXHQnY29uc3RhbnQubnVtZXJpYy5mbG9hdCcsXG5cdCdjb25zdGFudC5udW1lcmljLmhleCcsXG5cdCdjb25zdGFudC5udW1lcmljLm9jdGFsJyxcblx0J2NvbnN0YW50Lm90aGVyJyxcblx0J2NvbnN0YW50LnJlZ2V4cCcsXG5cdCdjb25zdGFudC5yZ2ItdmFsdWUnLFxuXHQnZW1waGFzaXMnLFxuXHQnZW50aXR5Jyxcblx0J2VudGl0eS5uYW1lJyxcblx0J2VudGl0eS5uYW1lLmNsYXNzJyxcblx0J2VudGl0eS5uYW1lLmZ1bmN0aW9uJyxcblx0J2VudGl0eS5uYW1lLm1ldGhvZCcsXG5cdCdlbnRpdHkubmFtZS5zZWN0aW9uJyxcblx0J2VudGl0eS5uYW1lLnNlbGVjdG9yJyxcblx0J2VudGl0eS5uYW1lLnRhZycsXG5cdCdlbnRpdHkubmFtZS50eXBlJyxcblx0J2VudGl0eS5vdGhlcicsXG5cdCdlbnRpdHkub3RoZXIuYXR0cmlidXRlLW5hbWUnLFxuXHQnZW50aXR5Lm90aGVyLmluaGVyaXRlZC1jbGFzcycsXG5cdCdpbnZhbGlkJyxcblx0J2ludmFsaWQuZGVwcmVjYXRlZCcsXG5cdCdpbnZhbGlkLmlsbGVnYWwnLFxuXHQna2V5d29yZCcsXG5cdCdrZXl3b3JkLmNvbnRyb2wnLFxuXHQna2V5d29yZC5vcGVyYXRvcicsXG5cdCdrZXl3b3JkLm9wZXJhdG9yLm5ldycsXG5cdCdrZXl3b3JkLm9wZXJhdG9yLmFzc2lnbm1lbnQnLFxuXHQna2V5d29yZC5vcGVyYXRvci5hcml0aG1ldGljJyxcblx0J2tleXdvcmQub3BlcmF0b3IubG9naWNhbCcsXG5cdCdrZXl3b3JkLm90aGVyJyxcblx0J21hcmt1cCcsXG5cdCdtYXJrdXAuYm9sZCcsXG5cdCdtYXJrdXAuY2hhbmdlZCcsXG5cdCdtYXJrdXAuZGVsZXRlZCcsXG5cdCdtYXJrdXAuaGVhZGluZycsXG5cdCdtYXJrdXAuaW5saW5lLnJhdycsXG5cdCdtYXJrdXAuaW5zZXJ0ZWQnLFxuXHQnbWFya3VwLml0YWxpYycsXG5cdCdtYXJrdXAubGlzdCcsXG5cdCdtYXJrdXAubGlzdC5udW1iZXJlZCcsXG5cdCdtYXJrdXAubGlzdC51bm51bWJlcmVkJyxcblx0J21hcmt1cC5vdGhlcicsXG5cdCdtYXJrdXAucXVvdGUnLFxuXHQnbWFya3VwLnJhdycsXG5cdCdtYXJrdXAudW5kZXJsaW5lJyxcblx0J21hcmt1cC51bmRlcmxpbmUubGluaycsXG5cdCdtZXRhJyxcblx0J21ldGEuYmxvY2snLFxuXHQnbWV0YS5jYXN0Jyxcblx0J21ldGEuY2xhc3MnLFxuXHQnbWV0YS5mdW5jdGlvbicsXG5cdCdtZXRhLmZ1bmN0aW9uLWNhbGwnLFxuXHQnbWV0YS5wcmVwcm9jZXNzb3InLFxuXHQnbWV0YS5yZXR1cm4tdHlwZScsXG5cdCdtZXRhLnNlbGVjdG9yJyxcblx0J21ldGEudGFnJyxcblx0J21ldGEudHlwZS5hbm5vdGF0aW9uJyxcblx0J21ldGEudHlwZScsXG5cdCdwdW5jdHVhdGlvbi5kZWZpbml0aW9uLnN0cmluZy5iZWdpbicsXG5cdCdwdW5jdHVhdGlvbi5kZWZpbml0aW9uLnN0cmluZy5lbmQnLFxuXHQncHVuY3R1YXRpb24uc2VwYXJhdG9yJyxcblx0J3B1bmN0dWF0aW9uLnNlcGFyYXRvci5jb250aW51YXRpb24nLFxuXHQncHVuY3R1YXRpb24udGVybWluYXRvcicsXG5cdCdzdG9yYWdlJyxcblx0J3N0b3JhZ2UubW9kaWZpZXInLFxuXHQnc3RvcmFnZS50eXBlJyxcblx0J3N0cmluZycsXG5cdCdzdHJpbmcuaW50ZXJwb2xhdGVkJyxcblx0J3N0cmluZy5vdGhlcicsXG5cdCdzdHJpbmcucXVvdGVkJyxcblx0J3N0cmluZy5xdW90ZWQuZG91YmxlJyxcblx0J3N0cmluZy5xdW90ZWQub3RoZXInLFxuXHQnc3RyaW5nLnF1b3RlZC5zaW5nbGUnLFxuXHQnc3RyaW5nLnF1b3RlZC50cmlwbGUnLFxuXHQnc3RyaW5nLnJlZ2V4cCcsXG5cdCdzdHJpbmcudW5xdW90ZWQnLFxuXHQnc3Ryb25nJyxcblx0J3N1cHBvcnQnLFxuXHQnc3VwcG9ydC5jbGFzcycsXG5cdCdzdXBwb3J0LmNvbnN0YW50Jyxcblx0J3N1cHBvcnQuZnVuY3Rpb24nLFxuXHQnc3VwcG9ydC5vdGhlcicsXG5cdCdzdXBwb3J0LnR5cGUnLFxuXHQnc3VwcG9ydC50eXBlLnByb3BlcnR5LW5hbWUnLFxuXHQnc3VwcG9ydC52YXJpYWJsZScsXG5cdCd2YXJpYWJsZScsXG5cdCd2YXJpYWJsZS5sYW5ndWFnZScsXG5cdCd2YXJpYWJsZS5uYW1lJyxcblx0J3ZhcmlhYmxlLm90aGVyJyxcblx0J3ZhcmlhYmxlLm90aGVyLnJlYWR3cml0ZScsXG5cdCd2YXJpYWJsZS5wYXJhbWV0ZXInXG5dO1xuXG5leHBvcnQgY29uc3QgdGV4dG1hdGVDb2xvcnNTY2hlbWFJZCA9ICd2c2NvZGU6Ly9zY2hlbWFzL3RleHRtYXRlLWNvbG9ycyc7XG5leHBvcnQgY29uc3QgdGV4dG1hdGVDb2xvckdyb3VwU2NoZW1hSWQgPSBgJHt0ZXh0bWF0ZUNvbG9yc1NjaGVtYUlkfSMvZGVmaW5pdGlvbnMvY29sb3JHcm91cGA7XG5cbmNvbnN0IHRleHRtYXRlQ29sb3JTY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnYXJyYXknLFxuXHRkZWZpbml0aW9uczoge1xuXHRcdGNvbG9yR3JvdXA6IHtcblx0XHRcdGRlZmF1bHQ6ICcjRkYwMDAwJyxcblx0XHRcdGFueU9mOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRmb3JtYXQ6ICdjb2xvci1oZXgnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9zZXR0aW5ncydcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0c2V0dGluZ3M6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLnRva2VuLnNldHRpbmdzJywgJ0NvbG9ycyBhbmQgc3R5bGVzIGZvciB0aGUgdG9rZW4uJyksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGZvcmVncm91bmQ6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEudG9rZW4uZm9yZWdyb3VuZCcsICdGb3JlZ3JvdW5kIGNvbG9yIGZvciB0aGUgdG9rZW4uJyksXG5cdFx0XHRcdFx0Zm9ybWF0OiAnY29sb3ItaGV4Jyxcblx0XHRcdFx0XHRkZWZhdWx0OiAnI2ZmMDAwMCdcblx0XHRcdFx0fSxcblx0XHRcdFx0YmFja2dyb3VuZDoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlcHJlY2F0aW9uTWVzc2FnZTogbmxzLmxvY2FsaXplKCdzY2hlbWEudG9rZW4uYmFja2dyb3VuZC53YXJuaW5nJywgJ1Rva2VuIGJhY2tncm91bmQgY29sb3JzIGFyZSBjdXJyZW50bHkgbm90IHN1cHBvcnRlZC4nKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmb250U3R5bGU6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEudG9rZW4uZm9udFN0eWxlJywgJ0ZvbnQgc3R5bGUgb2YgdGhlIHJ1bGU6IFxcJ2l0YWxpY1xcJywgXFwnYm9sZFxcJywgXFwndW5kZXJsaW5lXFwnLCBcXCdzdHJpa2V0aHJvdWdoXFwnIG9yIGEgY29tYmluYXRpb24uIFRoZSBlbXB0eSBzdHJpbmcgdW5zZXRzIGluaGVyaXRlZCBzZXR0aW5ncy4nKSxcblx0XHRcdFx0XHRwYXR0ZXJuOiAnXihcXFxccypcXFxcYihpdGFsaWN8Ym9sZHx1bmRlcmxpbmV8c3RyaWtldGhyb3VnaCkpKlxcXFxzKiQnLFxuXHRcdFx0XHRcdHBhdHRlcm5FcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZvbnRTdHlsZS5lcnJvcicsICdGb250IHN0eWxlIG11c3QgYmUgXFwnaXRhbGljXFwnLCBcXCdib2xkXFwnLCBcXCd1bmRlcmxpbmVcXCcsIFxcJ3N0cmlrZXRocm91Z2hcXCcgb3IgYSBjb21iaW5hdGlvbiBvciB0aGUgZW1wdHkgc3RyaW5nLicpLFxuXHRcdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW1xuXHRcdFx0XHRcdFx0eyBsYWJlbDogbmxzLmxvY2FsaXplKCdzY2hlbWEudG9rZW4uZm9udFN0eWxlLm5vbmUnLCAnTm9uZSAoY2xlYXIgaW5oZXJpdGVkIHN0eWxlKScpLCBib2R5VGV4dDogJ1wiXCInIH0sXG5cdFx0XHRcdFx0XHR7IGJvZHk6ICdpdGFsaWMnIH0sXG5cdFx0XHRcdFx0XHR7IGJvZHk6ICdib2xkJyB9LFxuXHRcdFx0XHRcdFx0eyBib2R5OiAndW5kZXJsaW5lJyB9LFxuXHRcdFx0XHRcdFx0eyBib2R5OiAnc3RyaWtldGhyb3VnaCcgfSxcblx0XHRcdFx0XHRcdHsgYm9keTogJ2l0YWxpYyBib2xkJyB9LFxuXHRcdFx0XHRcdFx0eyBib2R5OiAnaXRhbGljIHVuZGVybGluZScgfSxcblx0XHRcdFx0XHRcdHsgYm9keTogJ2l0YWxpYyBzdHJpa2V0aHJvdWdoJyB9LFxuXHRcdFx0XHRcdFx0eyBib2R5OiAnYm9sZCB1bmRlcmxpbmUnIH0sXG5cdFx0XHRcdFx0XHR7IGJvZHk6ICdib2xkIHN0cmlrZXRocm91Z2gnIH0sXG5cdFx0XHRcdFx0XHR7IGJvZHk6ICd1bmRlcmxpbmUgc3RyaWtldGhyb3VnaCcgfSxcblx0XHRcdFx0XHRcdHsgYm9keTogJ2l0YWxpYyBib2xkIHVuZGVybGluZScgfSxcblx0XHRcdFx0XHRcdHsgYm9keTogJ2l0YWxpYyBib2xkIHN0cmlrZXRocm91Z2gnIH0sXG5cdFx0XHRcdFx0XHR7IGJvZHk6ICdpdGFsaWMgdW5kZXJsaW5lIHN0cmlrZXRocm91Z2gnIH0sXG5cdFx0XHRcdFx0XHR7IGJvZHk6ICdib2xkIHVuZGVybGluZSBzdHJpa2V0aHJvdWdoJyB9LFxuXHRcdFx0XHRcdFx0eyBib2R5OiAnaXRhbGljIGJvbGQgdW5kZXJsaW5lIHN0cmlrZXRocm91Z2gnIH1cblx0XHRcdFx0XHRdXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IHsgZm9yZWdyb3VuZDogJyR7MTojRkYwMDAwfScsIGZvbnRTdHlsZTogJyR7Mjpib2xkfScgfSB9XVxuXHRcdH1cblx0fSxcblx0aXRlbXM6IHtcblx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IHsgc2NvcGU6ICckezE6a2V5d29yZC5vcGVyYXRvcn0nLCBzZXR0aW5nczogeyBmb3JlZ3JvdW5kOiAnJHsyOiNGRjAwMDB9JyB9IH0gfV0sXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0bmFtZToge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLnByb3BlcnRpZXMubmFtZScsICdEZXNjcmlwdGlvbiBvZiB0aGUgcnVsZS4nKVxuXHRcdFx0fSxcblx0XHRcdHNjb3BlOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5wcm9wZXJ0aWVzLnNjb3BlJywgJ1Njb3BlIHNlbGVjdG9yIGFnYWluc3Qgd2hpY2ggdGhpcyBydWxlIG1hdGNoZXMuJyksXG5cdFx0XHRcdGFueU9mOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZW51bTogdGV4dE1hdGVTY29wZXNcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHRcdFx0ZW51bTogdGV4dE1hdGVTY29wZXNcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRcdHNldHRpbmdzOiB7XG5cdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3NldHRpbmdzJ1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0cmVxdWlyZWQ6IFtcblx0XHRcdCdzZXR0aW5ncydcblx0XHRdLFxuXHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZVxuXHR9XG59O1xuXG5leHBvcnQgY29uc3QgY29sb3JUaGVtZVNjaGVtYUlkID0gJ3ZzY29kZTovL3NjaGVtYXMvY29sb3ItdGhlbWUnO1xuXG5jb25zdCBjb2xvclRoZW1lU2NoZW1hOiBJSlNPTlNjaGVtYSA9IHtcblx0dHlwZTogJ29iamVjdCcsXG5cdGFsbG93Q29tbWVudHM6IHRydWUsXG5cdGFsbG93VHJhaWxpbmdDb21tYXM6IHRydWUsXG5cdHByb3BlcnRpZXM6IHtcblx0XHRjb2xvcnM6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS53b3JrYmVuY2hDb2xvcnMnLCAnQ29sb3JzIGluIHRoZSB3b3JrYmVuY2gnKSxcblx0XHRcdCRyZWY6IHdvcmtiZW5jaENvbG9yc1NjaGVtYUlkLFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlXG5cdFx0fSxcblx0XHR0b2tlbkNvbG9yczoge1xuXHRcdFx0YW55T2Y6IFt7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEudG9rZW5Db2xvcnMucGF0aCcsICdQYXRoIHRvIGEgdG1UaGVtZSBmaWxlIChyZWxhdGl2ZSB0byB0aGUgY3VycmVudCBmaWxlKS4nKVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmNvbG9ycycsICdDb2xvcnMgZm9yIHN5bnRheCBoaWdobGlnaHRpbmcnKSxcblx0XHRcdFx0JHJlZjogdGV4dG1hdGVDb2xvcnNTY2hlbWFJZFxuXHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0c2VtYW50aWNIaWdobGlnaHRpbmc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5zdXBwb3J0c1NlbWFudGljSGlnaGxpZ2h0aW5nJywgJ1doZXRoZXIgc2VtYW50aWMgaGlnaGxpZ2h0aW5nIHNob3VsZCBiZSBlbmFibGVkIGZvciB0aGlzIHRoZW1lLicpXG5cdFx0fSxcblx0XHRzZW1hbnRpY1Rva2VuQ29sb3JzOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5zZW1hbnRpY1Rva2VuQ29sb3JzJywgJ0NvbG9ycyBmb3Igc2VtYW50aWMgdG9rZW5zJyksXG5cdFx0XHQkcmVmOiB0b2tlblN0eWxpbmdTY2hlbWFJZFxuXHRcdH1cblx0fVxufTtcblxuXG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckNvbG9yVGhlbWVTY2hlbWFzKCkge1xuXHRjb25zdCBzY2hlbWFSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElKU09OQ29udHJpYnV0aW9uUmVnaXN0cnk+KEpTT05FeHRlbnNpb25zLkpTT05Db250cmlidXRpb24pO1xuXHRzY2hlbWFSZWdpc3RyeS5yZWdpc3RlclNjaGVtYShjb2xvclRoZW1lU2NoZW1hSWQsIGNvbG9yVGhlbWVTY2hlbWEpO1xuXHRzY2hlbWFSZWdpc3RyeS5yZWdpc3RlclNjaGVtYSh0ZXh0bWF0ZUNvbG9yc1NjaGVtYUlkLCB0ZXh0bWF0ZUNvbG9yU2NoZW1hKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLFlBQVksU0FBUztBQUVyQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGNBQWMsc0JBQWlEO0FBR3hFLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsNEJBQTRCO0FBRXJDLE1BQU0saUJBQWlCO0FBQUEsRUFDdEI7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7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
