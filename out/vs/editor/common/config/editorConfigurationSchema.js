import { diffEditorDefaultOptions } from "./diffEditor.js";
import { editorOptionsRegistry } from "./editorOptions.js";
import { EDITOR_MODEL_DEFAULTS } from "../core/textModelDefaults.js";
import * as nls from "../../../nls.js";
import { ConfigurationScope, Extensions } from "../../../platform/configuration/common/configurationRegistry.js";
import { Registry } from "../../../platform/registry/common/platform.js";
const editorConfigurationBaseNode = Object.freeze({
  id: "editor",
  order: 5,
  type: "object",
  title: nls.localize("editorConfigurationTitle", "Editor"),
  scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
});
const editorConfiguration = {
  ...editorConfigurationBaseNode,
  properties: {
    "editor.tabSize": {
      type: "number",
      default: EDITOR_MODEL_DEFAULTS.tabSize,
      minimum: 1,
      maximum: 16,
      markdownDescription: nls.localize("tabSize", "The number of spaces a tab is equal to. This setting is overridden based on the file contents when {0} is on.", "`#editor.detectIndentation#`")
    },
    "editor.indentSize": {
      "anyOf": [
        {
          type: "string",
          enum: ["tabSize"]
        },
        {
          type: "number",
          minimum: 1
        }
      ],
      default: "tabSize",
      markdownDescription: nls.localize("indentSize", 'The number of spaces used for indentation or `"tabSize"` to use the value from `#editor.tabSize#`. This setting is overridden based on the file contents when `#editor.detectIndentation#` is on.')
    },
    "editor.insertSpaces": {
      type: "boolean",
      default: EDITOR_MODEL_DEFAULTS.insertSpaces,
      markdownDescription: nls.localize("insertSpaces", "Insert spaces when pressing `Tab`. This setting is overridden based on the file contents when {0} is on.", "`#editor.detectIndentation#`")
    },
    "editor.detectIndentation": {
      type: "boolean",
      default: EDITOR_MODEL_DEFAULTS.detectIndentation,
      markdownDescription: nls.localize("detectIndentation", "Controls whether {0} and {1} will be automatically detected when a file is opened based on the file contents.", "`#editor.tabSize#`", "`#editor.insertSpaces#`")
    },
    "editor.trimAutoWhitespace": {
      type: "boolean",
      default: EDITOR_MODEL_DEFAULTS.trimAutoWhitespace,
      description: nls.localize("trimAutoWhitespace", "Remove trailing auto inserted whitespace.")
    },
    "editor.largeFileOptimizations": {
      type: "boolean",
      default: EDITOR_MODEL_DEFAULTS.largeFileOptimizations,
      description: nls.localize("largeFileOptimizations", "Special handling for large files to disable certain memory intensive features.")
    },
    "editor.wordBasedSuggestions": {
      enum: ["off", "currentDocument", "matchingDocuments", "allDocuments"],
      default: "matchingDocuments",
      enumDescriptions: [
        nls.localize("wordBasedSuggestions.off", "Turn off Word Based Suggestions."),
        nls.localize("wordBasedSuggestions.currentDocument", "Only suggest words from the active document."),
        nls.localize("wordBasedSuggestions.matchingDocuments", "Suggest words from all open documents of the same language."),
        nls.localize("wordBasedSuggestions.allDocuments", "Suggest words from all open documents.")
      ],
      description: nls.localize("wordBasedSuggestions", "Controls whether completions should be computed based on words in the document and from which documents they are computed.")
    },
    "editor.semanticHighlighting.enabled": {
      enum: [true, false, "configuredByTheme"],
      enumDescriptions: [
        nls.localize("semanticHighlighting.true", "Semantic highlighting enabled for all color themes."),
        nls.localize("semanticHighlighting.false", "Semantic highlighting disabled for all color themes."),
        nls.localize("semanticHighlighting.configuredByTheme", "Semantic highlighting is configured by the current color theme's `semanticHighlighting` setting.")
      ],
      default: "configuredByTheme",
      description: nls.localize("semanticHighlighting.enabled", "Controls whether the semanticHighlighting is shown for the languages that support it.")
    },
    "editor.stablePeek": {
      type: "boolean",
      default: false,
      markdownDescription: nls.localize("stablePeek", "Keep peek editors open even when double-clicking their content or when hitting `Escape`.")
    },
    "editor.maxTokenizationLineLength": {
      type: "integer",
      default: 2e4,
      description: nls.localize("maxTokenizationLineLength", "Lines above this length will not be tokenized for performance reasons")
    },
    "editor.experimental.asyncTokenization": {
      type: "boolean",
      default: true,
      description: nls.localize("editor.experimental.asyncTokenization", "Controls whether the tokenization should happen asynchronously on a web worker."),
      tags: ["experimental"]
    },
    "editor.experimental.asyncTokenizationLogging": {
      type: "boolean",
      default: false,
      description: nls.localize("editor.experimental.asyncTokenizationLogging", "Controls whether async tokenization should be logged. For debugging only.")
    },
    "editor.experimental.asyncTokenizationVerification": {
      type: "boolean",
      default: false,
      description: nls.localize("editor.experimental.asyncTokenizationVerification", "Controls whether async tokenization should be verified against legacy background tokenization. Might slow down tokenization. For debugging only."),
      tags: ["experimental"]
    },
    "editor.experimental.treeSitterTelemetry": {
      type: "boolean",
      default: false,
      markdownDescription: nls.localize("editor.experimental.treeSitterTelemetry", "Controls whether tree sitter parsing should be turned on and telemetry collected. Setting `editor.experimental.preferTreeSitter` for specific languages will take precedence."),
      tags: ["experimental", "onExP"]
    },
    "editor.experimental.preferTreeSitter.css": {
      type: "boolean",
      default: false,
      markdownDescription: nls.localize("editor.experimental.preferTreeSitter.css", "Controls whether tree sitter parsing should be turned on for css. This will take precedence over `editor.experimental.treeSitterTelemetry` for css."),
      tags: ["experimental", "onExP"]
    },
    "editor.experimental.preferTreeSitter.typescript": {
      type: "boolean",
      default: false,
      markdownDescription: nls.localize("editor.experimental.preferTreeSitter.typescript", "Controls whether tree sitter parsing should be turned on for typescript. This will take precedence over `editor.experimental.treeSitterTelemetry` for typescript."),
      tags: ["experimental", "onExP"]
    },
    "editor.experimental.preferTreeSitter.ini": {
      type: "boolean",
      default: false,
      markdownDescription: nls.localize("editor.experimental.preferTreeSitter.ini", "Controls whether tree sitter parsing should be turned on for ini. This will take precedence over `editor.experimental.treeSitterTelemetry` for ini."),
      tags: ["experimental", "onExP"]
    },
    "editor.experimental.preferTreeSitter.regex": {
      type: "boolean",
      default: false,
      markdownDescription: nls.localize("editor.experimental.preferTreeSitter.regex", "Controls whether tree sitter parsing should be turned on for regex. This will take precedence over `editor.experimental.treeSitterTelemetry` for regex."),
      tags: ["experimental", "onExP"]
    },
    "editor.language.brackets": {
      type: ["array", "null"],
      default: null,
      // We want to distinguish the empty array from not configured.
      description: nls.localize("schema.brackets", "Defines the bracket symbols that increase or decrease the indentation."),
      items: {
        type: "array",
        items: [
          {
            type: "string",
            description: nls.localize("schema.openBracket", "The opening bracket character or string sequence.")
          },
          {
            type: "string",
            description: nls.localize("schema.closeBracket", "The closing bracket character or string sequence.")
          }
        ]
      }
    },
    "editor.language.colorizedBracketPairs": {
      type: ["array", "null"],
      default: null,
      // We want to distinguish the empty array from not configured.
      description: nls.localize("schema.colorizedBracketPairs", "Defines the bracket pairs that are colorized by their nesting level if bracket pair colorization is enabled."),
      items: {
        type: "array",
        items: [
          {
            type: "string",
            description: nls.localize("schema.openBracket", "The opening bracket character or string sequence.")
          },
          {
            type: "string",
            description: nls.localize("schema.closeBracket", "The closing bracket character or string sequence.")
          }
        ]
      }
    },
    "diffEditor.maxComputationTime": {
      type: "number",
      default: diffEditorDefaultOptions.maxComputationTime,
      description: nls.localize("maxComputationTime", "Timeout in milliseconds after which diff computation is cancelled. Use 0 for no timeout.")
    },
    "diffEditor.maxFileSize": {
      type: "number",
      default: diffEditorDefaultOptions.maxFileSize,
      description: nls.localize("maxFileSize", "Maximum file size in MB for which to compute diffs. Use 0 for no limit.")
    },
    "diffEditor.renderSideBySide": {
      type: "boolean",
      default: diffEditorDefaultOptions.renderSideBySide,
      description: nls.localize("sideBySide", "Controls whether the diff editor shows the diff side by side or inline.")
    },
    "diffEditor.renderSideBySideInlineBreakpoint": {
      type: "number",
      default: diffEditorDefaultOptions.renderSideBySideInlineBreakpoint,
      description: nls.localize("renderSideBySideInlineBreakpoint", "If the diff editor width is smaller than this value, the inline view is used.")
    },
    "diffEditor.useInlineViewWhenSpaceIsLimited": {
      type: "boolean",
      default: diffEditorDefaultOptions.useInlineViewWhenSpaceIsLimited,
      description: nls.localize("useInlineViewWhenSpaceIsLimited", "If enabled and the editor width is too small, the inline view is used.")
    },
    "diffEditor.renderMarginRevertIcon": {
      type: "boolean",
      default: diffEditorDefaultOptions.renderMarginRevertIcon,
      description: nls.localize("renderMarginRevertIcon", "When enabled, the diff editor shows arrows in its glyph margin to revert changes.")
    },
    "diffEditor.renderGutterMenu": {
      type: "boolean",
      default: diffEditorDefaultOptions.renderGutterMenu,
      description: nls.localize("renderGutterMenu", "When enabled, the diff editor shows a special gutter for revert and stage actions.")
    },
    "diffEditor.ignoreTrimWhitespace": {
      type: "boolean",
      default: diffEditorDefaultOptions.ignoreTrimWhitespace,
      description: nls.localize("ignoreTrimWhitespace", "When enabled, the diff editor ignores changes in leading or trailing whitespace.")
    },
    "diffEditor.renderIndicators": {
      type: "boolean",
      default: diffEditorDefaultOptions.renderIndicators,
      description: nls.localize("renderIndicators", "Controls whether the diff editor shows +/- indicators for added/removed changes.")
    },
    "diffEditor.codeLens": {
      type: "boolean",
      default: diffEditorDefaultOptions.diffCodeLens,
      description: nls.localize("codeLens", "Controls whether the editor shows CodeLens.")
    },
    "diffEditor.wordWrap": {
      type: "string",
      enum: ["off", "on", "inherit"],
      default: diffEditorDefaultOptions.diffWordWrap,
      markdownEnumDescriptions: [
        nls.localize("wordWrap.off", "Lines will never wrap."),
        nls.localize("wordWrap.on", "Lines will wrap at the viewport width."),
        nls.localize("wordWrap.inherit", "Lines will wrap according to the {0} setting.", "`#editor.wordWrap#`")
      ]
    },
    "diffEditor.diffAlgorithm": {
      type: "string",
      enum: ["legacy", "advanced"],
      default: diffEditorDefaultOptions.diffAlgorithm,
      markdownEnumDescriptions: [
        nls.localize("diffAlgorithm.legacy", "Uses the legacy diffing algorithm."),
        nls.localize("diffAlgorithm.advanced", "Uses the advanced diffing algorithm.")
      ]
    },
    "diffEditor.hideUnchangedRegions.enabled": {
      type: "boolean",
      default: diffEditorDefaultOptions.hideUnchangedRegions.enabled,
      markdownDescription: nls.localize("hideUnchangedRegions.enabled", "Controls whether the diff editor shows unchanged regions.")
    },
    "diffEditor.hideUnchangedRegions.revealLineCount": {
      type: "integer",
      default: diffEditorDefaultOptions.hideUnchangedRegions.revealLineCount,
      markdownDescription: nls.localize("hideUnchangedRegions.revealLineCount", "Controls how many lines are used for unchanged regions."),
      minimum: 1
    },
    "diffEditor.hideUnchangedRegions.minimumLineCount": {
      type: "integer",
      default: diffEditorDefaultOptions.hideUnchangedRegions.minimumLineCount,
      markdownDescription: nls.localize("hideUnchangedRegions.minimumLineCount", "Controls how many lines are used as a minimum for unchanged regions."),
      minimum: 1
    },
    "diffEditor.hideUnchangedRegions.contextLineCount": {
      type: "integer",
      default: diffEditorDefaultOptions.hideUnchangedRegions.contextLineCount,
      markdownDescription: nls.localize("hideUnchangedRegions.contextLineCount", "Controls how many lines are used as context when comparing unchanged regions."),
      minimum: 1
    },
    "diffEditor.experimental.showMoves": {
      type: "boolean",
      default: diffEditorDefaultOptions.experimental.showMoves,
      markdownDescription: nls.localize("showMoves", "Controls whether the diff editor should show detected code moves.")
    },
    "diffEditor.experimental.showEmptyDecorations": {
      type: "boolean",
      default: diffEditorDefaultOptions.experimental.showEmptyDecorations,
      description: nls.localize("showEmptyDecorations", "Controls whether the diff editor shows empty decorations to see where characters got inserted or deleted.")
    },
    "diffEditor.experimental.useTrueInlineView": {
      type: "boolean",
      default: diffEditorDefaultOptions.experimental.useTrueInlineView,
      description: nls.localize("useTrueInlineView", "If enabled and the editor uses the inline view, word changes are rendered inline.")
    }
  }
};
function isConfigurationPropertySchema(x) {
  return typeof x.type !== "undefined" || typeof x.anyOf !== "undefined";
}
for (const editorOption of editorOptionsRegistry) {
  const schema = editorOption.schema;
  if (typeof schema !== "undefined") {
    if (isConfigurationPropertySchema(schema)) {
      editorConfiguration.properties[`editor.${editorOption.name}`] = schema;
    } else {
      for (const key in schema) {
        if (Object.hasOwnProperty.call(schema, key)) {
          editorConfiguration.properties[key] = schema[key];
        }
      }
    }
  }
}
let cachedEditorConfigurationKeys = null;
function getEditorConfigurationKeys() {
  if (cachedEditorConfigurationKeys === null) {
    cachedEditorConfigurationKeys = /* @__PURE__ */ Object.create(null);
    Object.keys(editorConfiguration.properties).forEach((prop) => {
      cachedEditorConfigurationKeys[prop] = true;
    });
  }
  return cachedEditorConfigurationKeys;
}
function isEditorConfigurationKey(key) {
  const editorConfigurationKeys = getEditorConfigurationKeys();
  return editorConfigurationKeys[`editor.${key}`] || false;
}
function isDiffEditorConfigurationKey(key) {
  const editorConfigurationKeys = getEditorConfigurationKeys();
  return editorConfigurationKeys[`diffEditor.${key}`] || false;
}
const configurationRegistry = Registry.as(Extensions.Configuration);
configurationRegistry.registerConfiguration(editorConfiguration);
async function registerEditorFontConfigurations(getFontSnippets) {
  const editorKeysWithFont = ["editor.fontFamily"];
  const fontSnippets = await getFontSnippets();
  for (const key of editorKeysWithFont) {
    if (editorConfiguration.properties && editorConfiguration.properties[key]) {
      editorConfiguration.properties[key].defaultSnippets = fontSnippets;
    }
  }
}
export {
  editorConfigurationBaseNode,
  isDiffEditorConfigurationKey,
  isEditorConfigurationKey,
  registerEditorFontConfigurations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JDb25maWd1cmF0aW9uU2NoZW1hLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgeyBJSlNPTlNjaGVtYVNuaXBwZXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCB7IGRpZmZFZGl0b3JEZWZhdWx0T3B0aW9ucyB9IGZyb20gJy4vZGlmZkVkaXRvci5qcyc7XG5pbXBvcnQgeyBlZGl0b3JPcHRpb25zUmVnaXN0cnkgfSBmcm9tICcuL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgRURJVE9SX01PREVMX0RFRkFVTFRTIH0gZnJvbSAnLi4vY29yZS90ZXh0TW9kZWxEZWZhdWx0cy5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25TY29wZSwgRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25Ob2RlLCBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcblxuZXhwb3J0IGNvbnN0IGVkaXRvckNvbmZpZ3VyYXRpb25CYXNlTm9kZSA9IE9iamVjdC5mcmVlemU8SUNvbmZpZ3VyYXRpb25Ob2RlPih7XG5cdGlkOiAnZWRpdG9yJyxcblx0b3JkZXI6IDUsXG5cdHR5cGU6ICdvYmplY3QnLFxuXHR0aXRsZTogbmxzLmxvY2FsaXplKCdlZGl0b3JDb25maWd1cmF0aW9uVGl0bGUnLCBcIkVkaXRvclwiKSxcblx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcbn0pO1xuXG5jb25zdCBlZGl0b3JDb25maWd1cmF0aW9uOiBJQ29uZmlndXJhdGlvbk5vZGUgPSB7XG5cdC4uLmVkaXRvckNvbmZpZ3VyYXRpb25CYXNlTm9kZSxcblx0cHJvcGVydGllczoge1xuXHRcdCdlZGl0b3IudGFiU2l6ZSc6IHtcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogRURJVE9SX01PREVMX0RFRkFVTFRTLnRhYlNpemUsXG5cdFx0XHRtaW5pbXVtOiAxLFxuXHRcdFx0bWF4aW11bTogMTYsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3RhYlNpemUnLCBcIlRoZSBudW1iZXIgb2Ygc3BhY2VzIGEgdGFiIGlzIGVxdWFsIHRvLiBUaGlzIHNldHRpbmcgaXMgb3ZlcnJpZGRlbiBiYXNlZCBvbiB0aGUgZmlsZSBjb250ZW50cyB3aGVuIHswfSBpcyBvbi5cIiwgJ2AjZWRpdG9yLmRldGVjdEluZGVudGF0aW9uI2AnKVxuXHRcdH0sXG5cdFx0J2VkaXRvci5pbmRlbnRTaXplJzoge1xuXHRcdFx0J2FueU9mJzogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZW51bTogWyd0YWJTaXplJ11cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHRcdG1pbmltdW06IDFcblx0XHRcdFx0fVxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICd0YWJTaXplJyxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnaW5kZW50U2l6ZScsIFwiVGhlIG51bWJlciBvZiBzcGFjZXMgdXNlZCBmb3IgaW5kZW50YXRpb24gb3IgYFxcXCJ0YWJTaXplXFxcImAgdG8gdXNlIHRoZSB2YWx1ZSBmcm9tIGAjZWRpdG9yLnRhYlNpemUjYC4gVGhpcyBzZXR0aW5nIGlzIG92ZXJyaWRkZW4gYmFzZWQgb24gdGhlIGZpbGUgY29udGVudHMgd2hlbiBgI2VkaXRvci5kZXRlY3RJbmRlbnRhdGlvbiNgIGlzIG9uLlwiKVxuXHRcdH0sXG5cdFx0J2VkaXRvci5pbnNlcnRTcGFjZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBFRElUT1JfTU9ERUxfREVGQVVMVFMuaW5zZXJ0U3BhY2VzLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdpbnNlcnRTcGFjZXMnLCBcIkluc2VydCBzcGFjZXMgd2hlbiBwcmVzc2luZyBgVGFiYC4gVGhpcyBzZXR0aW5nIGlzIG92ZXJyaWRkZW4gYmFzZWQgb24gdGhlIGZpbGUgY29udGVudHMgd2hlbiB7MH0gaXMgb24uXCIsICdgI2VkaXRvci5kZXRlY3RJbmRlbnRhdGlvbiNgJylcblx0XHR9LFxuXHRcdCdlZGl0b3IuZGV0ZWN0SW5kZW50YXRpb24nOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBFRElUT1JfTU9ERUxfREVGQVVMVFMuZGV0ZWN0SW5kZW50YXRpb24sXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2RldGVjdEluZGVudGF0aW9uJywgXCJDb250cm9scyB3aGV0aGVyIHswfSBhbmQgezF9IHdpbGwgYmUgYXV0b21hdGljYWxseSBkZXRlY3RlZCB3aGVuIGEgZmlsZSBpcyBvcGVuZWQgYmFzZWQgb24gdGhlIGZpbGUgY29udGVudHMuXCIsICdgI2VkaXRvci50YWJTaXplI2AnLCAnYCNlZGl0b3IuaW5zZXJ0U3BhY2VzI2AnKVxuXHRcdH0sXG5cdFx0J2VkaXRvci50cmltQXV0b1doaXRlc3BhY2UnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBFRElUT1JfTU9ERUxfREVGQVVMVFMudHJpbUF1dG9XaGl0ZXNwYWNlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndHJpbUF1dG9XaGl0ZXNwYWNlJywgXCJSZW1vdmUgdHJhaWxpbmcgYXV0byBpbnNlcnRlZCB3aGl0ZXNwYWNlLlwiKVxuXHRcdH0sXG5cdFx0J2VkaXRvci5sYXJnZUZpbGVPcHRpbWl6YXRpb25zJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogRURJVE9SX01PREVMX0RFRkFVTFRTLmxhcmdlRmlsZU9wdGltaXphdGlvbnMsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdsYXJnZUZpbGVPcHRpbWl6YXRpb25zJywgXCJTcGVjaWFsIGhhbmRsaW5nIGZvciBsYXJnZSBmaWxlcyB0byBkaXNhYmxlIGNlcnRhaW4gbWVtb3J5IGludGVuc2l2ZSBmZWF0dXJlcy5cIilcblx0XHR9LFxuXHRcdCdlZGl0b3Iud29yZEJhc2VkU3VnZ2VzdGlvbnMnOiB7XG5cdFx0XHRlbnVtOiBbJ29mZicsICdjdXJyZW50RG9jdW1lbnQnLCAnbWF0Y2hpbmdEb2N1bWVudHMnLCAnYWxsRG9jdW1lbnRzJ10sXG5cdFx0XHRkZWZhdWx0OiAnbWF0Y2hpbmdEb2N1bWVudHMnLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ3dvcmRCYXNlZFN1Z2dlc3Rpb25zLm9mZicsICdUdXJuIG9mZiBXb3JkIEJhc2VkIFN1Z2dlc3Rpb25zLicpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3dvcmRCYXNlZFN1Z2dlc3Rpb25zLmN1cnJlbnREb2N1bWVudCcsICdPbmx5IHN1Z2dlc3Qgd29yZHMgZnJvbSB0aGUgYWN0aXZlIGRvY3VtZW50LicpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3dvcmRCYXNlZFN1Z2dlc3Rpb25zLm1hdGNoaW5nRG9jdW1lbnRzJywgJ1N1Z2dlc3Qgd29yZHMgZnJvbSBhbGwgb3BlbiBkb2N1bWVudHMgb2YgdGhlIHNhbWUgbGFuZ3VhZ2UuJyksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnd29yZEJhc2VkU3VnZ2VzdGlvbnMuYWxsRG9jdW1lbnRzJywgJ1N1Z2dlc3Qgd29yZHMgZnJvbSBhbGwgb3BlbiBkb2N1bWVudHMuJylcblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd3b3JkQmFzZWRTdWdnZXN0aW9ucycsIFwiQ29udHJvbHMgd2hldGhlciBjb21wbGV0aW9ucyBzaG91bGQgYmUgY29tcHV0ZWQgYmFzZWQgb24gd29yZHMgaW4gdGhlIGRvY3VtZW50IGFuZCBmcm9tIHdoaWNoIGRvY3VtZW50cyB0aGV5IGFyZSBjb21wdXRlZC5cIilcblx0XHR9LFxuXHRcdCdlZGl0b3Iuc2VtYW50aWNIaWdobGlnaHRpbmcuZW5hYmxlZCc6IHtcblx0XHRcdGVudW06IFt0cnVlLCBmYWxzZSwgJ2NvbmZpZ3VyZWRCeVRoZW1lJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2VtYW50aWNIaWdobGlnaHRpbmcudHJ1ZScsICdTZW1hbnRpYyBoaWdobGlnaHRpbmcgZW5hYmxlZCBmb3IgYWxsIGNvbG9yIHRoZW1lcy4nKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdzZW1hbnRpY0hpZ2hsaWdodGluZy5mYWxzZScsICdTZW1hbnRpYyBoaWdobGlnaHRpbmcgZGlzYWJsZWQgZm9yIGFsbCBjb2xvciB0aGVtZXMuJyksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2VtYW50aWNIaWdobGlnaHRpbmcuY29uZmlndXJlZEJ5VGhlbWUnLCAnU2VtYW50aWMgaGlnaGxpZ2h0aW5nIGlzIGNvbmZpZ3VyZWQgYnkgdGhlIGN1cnJlbnQgY29sb3IgdGhlbWVcXCdzIGBzZW1hbnRpY0hpZ2hsaWdodGluZ2Agc2V0dGluZy4nKVxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICdjb25maWd1cmVkQnlUaGVtZScsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzZW1hbnRpY0hpZ2hsaWdodGluZy5lbmFibGVkJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBzZW1hbnRpY0hpZ2hsaWdodGluZyBpcyBzaG93biBmb3IgdGhlIGxhbmd1YWdlcyB0aGF0IHN1cHBvcnQgaXQuXCIpXG5cdFx0fSxcblx0XHQnZWRpdG9yLnN0YWJsZVBlZWsnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc3RhYmxlUGVlaycsIFwiS2VlcCBwZWVrIGVkaXRvcnMgb3BlbiBldmVuIHdoZW4gZG91YmxlLWNsaWNraW5nIHRoZWlyIGNvbnRlbnQgb3Igd2hlbiBoaXR0aW5nIGBFc2NhcGVgLlwiKVxuXHRcdH0sXG5cdFx0J2VkaXRvci5tYXhUb2tlbml6YXRpb25MaW5lTGVuZ3RoJzoge1xuXHRcdFx0dHlwZTogJ2ludGVnZXInLFxuXHRcdFx0ZGVmYXVsdDogMjBfMDAwLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbWF4VG9rZW5pemF0aW9uTGluZUxlbmd0aCcsIFwiTGluZXMgYWJvdmUgdGhpcyBsZW5ndGggd2lsbCBub3QgYmUgdG9rZW5pemVkIGZvciBwZXJmb3JtYW5jZSByZWFzb25zXCIpXG5cdFx0fSxcblx0XHQnZWRpdG9yLmV4cGVyaW1lbnRhbC5hc3luY1Rva2VuaXphdGlvbic6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3IuZXhwZXJpbWVudGFsLmFzeW5jVG9rZW5pemF0aW9uJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSB0b2tlbml6YXRpb24gc2hvdWxkIGhhcHBlbiBhc3luY2hyb25vdXNseSBvbiBhIHdlYiB3b3JrZXIuXCIpLFxuXHRcdFx0dGFnczogWydleHBlcmltZW50YWwnXSxcblx0XHR9LFxuXHRcdCdlZGl0b3IuZXhwZXJpbWVudGFsLmFzeW5jVG9rZW5pemF0aW9uTG9nZ2luZyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLmV4cGVyaW1lbnRhbC5hc3luY1Rva2VuaXphdGlvbkxvZ2dpbmcnLCBcIkNvbnRyb2xzIHdoZXRoZXIgYXN5bmMgdG9rZW5pemF0aW9uIHNob3VsZCBiZSBsb2dnZWQuIEZvciBkZWJ1Z2dpbmcgb25seS5cIiksXG5cdFx0fSxcblx0XHQnZWRpdG9yLmV4cGVyaW1lbnRhbC5hc3luY1Rva2VuaXphdGlvblZlcmlmaWNhdGlvbic6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLmV4cGVyaW1lbnRhbC5hc3luY1Rva2VuaXphdGlvblZlcmlmaWNhdGlvbicsIFwiQ29udHJvbHMgd2hldGhlciBhc3luYyB0b2tlbml6YXRpb24gc2hvdWxkIGJlIHZlcmlmaWVkIGFnYWluc3QgbGVnYWN5IGJhY2tncm91bmQgdG9rZW5pemF0aW9uLiBNaWdodCBzbG93IGRvd24gdG9rZW5pemF0aW9uLiBGb3IgZGVidWdnaW5nIG9ubHkuXCIpLFxuXHRcdFx0dGFnczogWydleHBlcmltZW50YWwnXSxcblx0XHR9LFxuXHRcdCdlZGl0b3IuZXhwZXJpbWVudGFsLnRyZWVTaXR0ZXJUZWxlbWV0cnknOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLmV4cGVyaW1lbnRhbC50cmVlU2l0dGVyVGVsZW1ldHJ5JywgXCJDb250cm9scyB3aGV0aGVyIHRyZWUgc2l0dGVyIHBhcnNpbmcgc2hvdWxkIGJlIHR1cm5lZCBvbiBhbmQgdGVsZW1ldHJ5IGNvbGxlY3RlZC4gU2V0dGluZyBgZWRpdG9yLmV4cGVyaW1lbnRhbC5wcmVmZXJUcmVlU2l0dGVyYCBmb3Igc3BlY2lmaWMgbGFuZ3VhZ2VzIHdpbGwgdGFrZSBwcmVjZWRlbmNlLlwiKSxcblx0XHRcdHRhZ3M6IFsnZXhwZXJpbWVudGFsJywgJ29uRXhQJ11cblx0XHR9LFxuXHRcdCdlZGl0b3IuZXhwZXJpbWVudGFsLnByZWZlclRyZWVTaXR0ZXIuY3NzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5leHBlcmltZW50YWwucHJlZmVyVHJlZVNpdHRlci5jc3MnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdHJlZSBzaXR0ZXIgcGFyc2luZyBzaG91bGQgYmUgdHVybmVkIG9uIGZvciBjc3MuIFRoaXMgd2lsbCB0YWtlIHByZWNlZGVuY2Ugb3ZlciBgZWRpdG9yLmV4cGVyaW1lbnRhbC50cmVlU2l0dGVyVGVsZW1ldHJ5YCBmb3IgY3NzLlwiKSxcblx0XHRcdHRhZ3M6IFsnZXhwZXJpbWVudGFsJywgJ29uRXhQJ11cblx0XHR9LFxuXHRcdCdlZGl0b3IuZXhwZXJpbWVudGFsLnByZWZlclRyZWVTaXR0ZXIudHlwZXNjcmlwdCc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3IuZXhwZXJpbWVudGFsLnByZWZlclRyZWVTaXR0ZXIudHlwZXNjcmlwdCcsIFwiQ29udHJvbHMgd2hldGhlciB0cmVlIHNpdHRlciBwYXJzaW5nIHNob3VsZCBiZSB0dXJuZWQgb24gZm9yIHR5cGVzY3JpcHQuIFRoaXMgd2lsbCB0YWtlIHByZWNlZGVuY2Ugb3ZlciBgZWRpdG9yLmV4cGVyaW1lbnRhbC50cmVlU2l0dGVyVGVsZW1ldHJ5YCBmb3IgdHlwZXNjcmlwdC5cIiksXG5cdFx0XHR0YWdzOiBbJ2V4cGVyaW1lbnRhbCcsICdvbkV4UCddXG5cdFx0fSxcblx0XHQnZWRpdG9yLmV4cGVyaW1lbnRhbC5wcmVmZXJUcmVlU2l0dGVyLmluaSc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3IuZXhwZXJpbWVudGFsLnByZWZlclRyZWVTaXR0ZXIuaW5pJywgXCJDb250cm9scyB3aGV0aGVyIHRyZWUgc2l0dGVyIHBhcnNpbmcgc2hvdWxkIGJlIHR1cm5lZCBvbiBmb3IgaW5pLiBUaGlzIHdpbGwgdGFrZSBwcmVjZWRlbmNlIG92ZXIgYGVkaXRvci5leHBlcmltZW50YWwudHJlZVNpdHRlclRlbGVtZXRyeWAgZm9yIGluaS5cIiksXG5cdFx0XHR0YWdzOiBbJ2V4cGVyaW1lbnRhbCcsICdvbkV4UCddXG5cdFx0fSxcblx0XHQnZWRpdG9yLmV4cGVyaW1lbnRhbC5wcmVmZXJUcmVlU2l0dGVyLnJlZ2V4Jzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5leHBlcmltZW50YWwucHJlZmVyVHJlZVNpdHRlci5yZWdleCcsIFwiQ29udHJvbHMgd2hldGhlciB0cmVlIHNpdHRlciBwYXJzaW5nIHNob3VsZCBiZSB0dXJuZWQgb24gZm9yIHJlZ2V4LiBUaGlzIHdpbGwgdGFrZSBwcmVjZWRlbmNlIG92ZXIgYGVkaXRvci5leHBlcmltZW50YWwudHJlZVNpdHRlclRlbGVtZXRyeWAgZm9yIHJlZ2V4LlwiKSxcblx0XHRcdHRhZ3M6IFsnZXhwZXJpbWVudGFsJywgJ29uRXhQJ11cblx0XHR9LFxuXHRcdCdlZGl0b3IubGFuZ3VhZ2UuYnJhY2tldHMnOiB7XG5cdFx0XHR0eXBlOiBbJ2FycmF5JywgJ251bGwnXSxcblx0XHRcdGRlZmF1bHQ6IG51bGwsIC8vIFdlIHdhbnQgdG8gZGlzdGluZ3Vpc2ggdGhlIGVtcHR5IGFycmF5IGZyb20gbm90IGNvbmZpZ3VyZWQuXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuYnJhY2tldHMnLCAnRGVmaW5lcyB0aGUgYnJhY2tldCBzeW1ib2xzIHRoYXQgaW5jcmVhc2Ugb3IgZGVjcmVhc2UgdGhlIGluZGVudGF0aW9uLicpLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0aXRlbXM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5vcGVuQnJhY2tldCcsICdUaGUgb3BlbmluZyBicmFja2V0IGNoYXJhY3RlciBvciBzdHJpbmcgc2VxdWVuY2UuJylcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmNsb3NlQnJhY2tldCcsICdUaGUgY2xvc2luZyBicmFja2V0IGNoYXJhY3RlciBvciBzdHJpbmcgc2VxdWVuY2UuJylcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9LFxuXHRcdCdlZGl0b3IubGFuZ3VhZ2UuY29sb3JpemVkQnJhY2tldFBhaXJzJzoge1xuXHRcdFx0dHlwZTogWydhcnJheScsICdudWxsJ10sXG5cdFx0XHRkZWZhdWx0OiBudWxsLCAvLyBXZSB3YW50IHRvIGRpc3Rpbmd1aXNoIHRoZSBlbXB0eSBhcnJheSBmcm9tIG5vdCBjb25maWd1cmVkLlxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmNvbG9yaXplZEJyYWNrZXRQYWlycycsICdEZWZpbmVzIHRoZSBicmFja2V0IHBhaXJzIHRoYXQgYXJlIGNvbG9yaXplZCBieSB0aGVpciBuZXN0aW5nIGxldmVsIGlmIGJyYWNrZXQgcGFpciBjb2xvcml6YXRpb24gaXMgZW5hYmxlZC4nKSxcblx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdGl0ZW1zOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEub3BlbkJyYWNrZXQnLCAnVGhlIG9wZW5pbmcgYnJhY2tldCBjaGFyYWN0ZXIgb3Igc3RyaW5nIHNlcXVlbmNlLicpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5jbG9zZUJyYWNrZXQnLCAnVGhlIGNsb3NpbmcgYnJhY2tldCBjaGFyYWN0ZXIgb3Igc3RyaW5nIHNlcXVlbmNlLicpXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0fSxcblx0XHQnZGlmZkVkaXRvci5tYXhDb21wdXRhdGlvblRpbWUnOiB7XG5cdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdGRlZmF1bHQ6IGRpZmZFZGl0b3JEZWZhdWx0T3B0aW9ucy5tYXhDb21wdXRhdGlvblRpbWUsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdtYXhDb21wdXRhdGlvblRpbWUnLCBcIlRpbWVvdXQgaW4gbWlsbGlzZWNvbmRzIGFmdGVyIHdoaWNoIGRpZmYgY29tcHV0YXRpb24gaXMgY2FuY2VsbGVkLiBVc2UgMCBmb3Igbm8gdGltZW91dC5cIilcblx0XHR9LFxuXHRcdCdkaWZmRWRpdG9yLm1heEZpbGVTaXplJzoge1xuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZWZhdWx0OiBkaWZmRWRpdG9yRGVmYXVsdE9wdGlvbnMubWF4RmlsZVNpemUsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdtYXhGaWxlU2l6ZScsIFwiTWF4aW11bSBmaWxlIHNpemUgaW4gTUIgZm9yIHdoaWNoIHRvIGNvbXB1dGUgZGlmZnMuIFVzZSAwIGZvciBubyBsaW1pdC5cIilcblx0XHR9LFxuXHRcdCdkaWZmRWRpdG9yLnJlbmRlclNpZGVCeVNpZGUnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBkaWZmRWRpdG9yRGVmYXVsdE9wdGlvbnMucmVuZGVyU2lkZUJ5U2lkZSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NpZGVCeVNpZGUnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGRpZmYgZWRpdG9yIHNob3dzIHRoZSBkaWZmIHNpZGUgYnkgc2lkZSBvciBpbmxpbmUuXCIpXG5cdFx0fSxcblx0XHQnZGlmZkVkaXRvci5yZW5kZXJTaWRlQnlTaWRlSW5saW5lQnJlYWtwb2ludCc6IHtcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogZGlmZkVkaXRvckRlZmF1bHRPcHRpb25zLnJlbmRlclNpZGVCeVNpZGVJbmxpbmVCcmVha3BvaW50LFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncmVuZGVyU2lkZUJ5U2lkZUlubGluZUJyZWFrcG9pbnQnLCBcIklmIHRoZSBkaWZmIGVkaXRvciB3aWR0aCBpcyBzbWFsbGVyIHRoYW4gdGhpcyB2YWx1ZSwgdGhlIGlubGluZSB2aWV3IGlzIHVzZWQuXCIpXG5cdFx0fSxcblx0XHQnZGlmZkVkaXRvci51c2VJbmxpbmVWaWV3V2hlblNwYWNlSXNMaW1pdGVkJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZGlmZkVkaXRvckRlZmF1bHRPcHRpb25zLnVzZUlubGluZVZpZXdXaGVuU3BhY2VJc0xpbWl0ZWQsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd1c2VJbmxpbmVWaWV3V2hlblNwYWNlSXNMaW1pdGVkJywgXCJJZiBlbmFibGVkIGFuZCB0aGUgZWRpdG9yIHdpZHRoIGlzIHRvbyBzbWFsbCwgdGhlIGlubGluZSB2aWV3IGlzIHVzZWQuXCIpXG5cdFx0fSxcblx0XHQnZGlmZkVkaXRvci5yZW5kZXJNYXJnaW5SZXZlcnRJY29uJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZGlmZkVkaXRvckRlZmF1bHRPcHRpb25zLnJlbmRlck1hcmdpblJldmVydEljb24sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdyZW5kZXJNYXJnaW5SZXZlcnRJY29uJywgXCJXaGVuIGVuYWJsZWQsIHRoZSBkaWZmIGVkaXRvciBzaG93cyBhcnJvd3MgaW4gaXRzIGdseXBoIG1hcmdpbiB0byByZXZlcnQgY2hhbmdlcy5cIilcblx0XHR9LFxuXHRcdCdkaWZmRWRpdG9yLnJlbmRlckd1dHRlck1lbnUnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBkaWZmRWRpdG9yRGVmYXVsdE9wdGlvbnMucmVuZGVyR3V0dGVyTWVudSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3JlbmRlckd1dHRlck1lbnUnLCBcIldoZW4gZW5hYmxlZCwgdGhlIGRpZmYgZWRpdG9yIHNob3dzIGEgc3BlY2lhbCBndXR0ZXIgZm9yIHJldmVydCBhbmQgc3RhZ2UgYWN0aW9ucy5cIilcblx0XHR9LFxuXHRcdCdkaWZmRWRpdG9yLmlnbm9yZVRyaW1XaGl0ZXNwYWNlJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZGlmZkVkaXRvckRlZmF1bHRPcHRpb25zLmlnbm9yZVRyaW1XaGl0ZXNwYWNlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnaWdub3JlVHJpbVdoaXRlc3BhY2UnLCBcIldoZW4gZW5hYmxlZCwgdGhlIGRpZmYgZWRpdG9yIGlnbm9yZXMgY2hhbmdlcyBpbiBsZWFkaW5nIG9yIHRyYWlsaW5nIHdoaXRlc3BhY2UuXCIpXG5cdFx0fSxcblx0XHQnZGlmZkVkaXRvci5yZW5kZXJJbmRpY2F0b3JzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZGlmZkVkaXRvckRlZmF1bHRPcHRpb25zLnJlbmRlckluZGljYXRvcnMsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdyZW5kZXJJbmRpY2F0b3JzJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBkaWZmIGVkaXRvciBzaG93cyArLy0gaW5kaWNhdG9ycyBmb3IgYWRkZWQvcmVtb3ZlZCBjaGFuZ2VzLlwiKVxuXHRcdH0sXG5cdFx0J2RpZmZFZGl0b3IuY29kZUxlbnMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBkaWZmRWRpdG9yRGVmYXVsdE9wdGlvbnMuZGlmZkNvZGVMZW5zLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29kZUxlbnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGVkaXRvciBzaG93cyBDb2RlTGVucy5cIilcblx0XHR9LFxuXHRcdCdkaWZmRWRpdG9yLndvcmRXcmFwJzoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ29mZicsICdvbicsICdpbmhlcml0J10sXG5cdFx0XHRkZWZhdWx0OiBkaWZmRWRpdG9yRGVmYXVsdE9wdGlvbnMuZGlmZldvcmRXcmFwLFxuXHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnd29yZFdyYXAub2ZmJywgXCJMaW5lcyB3aWxsIG5ldmVyIHdyYXAuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3dvcmRXcmFwLm9uJywgXCJMaW5lcyB3aWxsIHdyYXAgYXQgdGhlIHZpZXdwb3J0IHdpZHRoLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCd3b3JkV3JhcC5pbmhlcml0JywgXCJMaW5lcyB3aWxsIHdyYXAgYWNjb3JkaW5nIHRvIHRoZSB7MH0gc2V0dGluZy5cIiwgJ2AjZWRpdG9yLndvcmRXcmFwI2AnKSxcblx0XHRcdF1cblx0XHR9LFxuXHRcdCdkaWZmRWRpdG9yLmRpZmZBbGdvcml0aG0nOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnbGVnYWN5JywgJ2FkdmFuY2VkJ10sXG5cdFx0XHRkZWZhdWx0OiBkaWZmRWRpdG9yRGVmYXVsdE9wdGlvbnMuZGlmZkFsZ29yaXRobSxcblx0XHRcdG1hcmtkb3duRW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ2RpZmZBbGdvcml0aG0ubGVnYWN5JywgXCJVc2VzIHRoZSBsZWdhY3kgZGlmZmluZyBhbGdvcml0aG0uXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2RpZmZBbGdvcml0aG0uYWR2YW5jZWQnLCBcIlVzZXMgdGhlIGFkdmFuY2VkIGRpZmZpbmcgYWxnb3JpdGhtLlwiKSxcblx0XHRcdF1cblx0XHR9LFxuXHRcdCdkaWZmRWRpdG9yLmhpZGVVbmNoYW5nZWRSZWdpb25zLmVuYWJsZWQnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBkaWZmRWRpdG9yRGVmYXVsdE9wdGlvbnMuaGlkZVVuY2hhbmdlZFJlZ2lvbnMuZW5hYmxlZCxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnaGlkZVVuY2hhbmdlZFJlZ2lvbnMuZW5hYmxlZCcsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgZGlmZiBlZGl0b3Igc2hvd3MgdW5jaGFuZ2VkIHJlZ2lvbnMuXCIpLFxuXHRcdH0sXG5cdFx0J2RpZmZFZGl0b3IuaGlkZVVuY2hhbmdlZFJlZ2lvbnMucmV2ZWFsTGluZUNvdW50Jzoge1xuXHRcdFx0dHlwZTogJ2ludGVnZXInLFxuXHRcdFx0ZGVmYXVsdDogZGlmZkVkaXRvckRlZmF1bHRPcHRpb25zLmhpZGVVbmNoYW5nZWRSZWdpb25zLnJldmVhbExpbmVDb3VudCxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnaGlkZVVuY2hhbmdlZFJlZ2lvbnMucmV2ZWFsTGluZUNvdW50JywgXCJDb250cm9scyBob3cgbWFueSBsaW5lcyBhcmUgdXNlZCBmb3IgdW5jaGFuZ2VkIHJlZ2lvbnMuXCIpLFxuXHRcdFx0bWluaW11bTogMSxcblx0XHR9LFxuXHRcdCdkaWZmRWRpdG9yLmhpZGVVbmNoYW5nZWRSZWdpb25zLm1pbmltdW1MaW5lQ291bnQnOiB7XG5cdFx0XHR0eXBlOiAnaW50ZWdlcicsXG5cdFx0XHRkZWZhdWx0OiBkaWZmRWRpdG9yRGVmYXVsdE9wdGlvbnMuaGlkZVVuY2hhbmdlZFJlZ2lvbnMubWluaW11bUxpbmVDb3VudCxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnaGlkZVVuY2hhbmdlZFJlZ2lvbnMubWluaW11bUxpbmVDb3VudCcsIFwiQ29udHJvbHMgaG93IG1hbnkgbGluZXMgYXJlIHVzZWQgYXMgYSBtaW5pbXVtIGZvciB1bmNoYW5nZWQgcmVnaW9ucy5cIiksXG5cdFx0XHRtaW5pbXVtOiAxLFxuXHRcdH0sXG5cdFx0J2RpZmZFZGl0b3IuaGlkZVVuY2hhbmdlZFJlZ2lvbnMuY29udGV4dExpbmVDb3VudCc6IHtcblx0XHRcdHR5cGU6ICdpbnRlZ2VyJyxcblx0XHRcdGRlZmF1bHQ6IGRpZmZFZGl0b3JEZWZhdWx0T3B0aW9ucy5oaWRlVW5jaGFuZ2VkUmVnaW9ucy5jb250ZXh0TGluZUNvdW50LFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdoaWRlVW5jaGFuZ2VkUmVnaW9ucy5jb250ZXh0TGluZUNvdW50JywgXCJDb250cm9scyBob3cgbWFueSBsaW5lcyBhcmUgdXNlZCBhcyBjb250ZXh0IHdoZW4gY29tcGFyaW5nIHVuY2hhbmdlZCByZWdpb25zLlwiKSxcblx0XHRcdG1pbmltdW06IDEsXG5cdFx0fSxcblx0XHQnZGlmZkVkaXRvci5leHBlcmltZW50YWwuc2hvd01vdmVzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZGlmZkVkaXRvckRlZmF1bHRPcHRpb25zLmV4cGVyaW1lbnRhbC5zaG93TW92ZXMsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Nob3dNb3ZlcycsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgZGlmZiBlZGl0b3Igc2hvdWxkIHNob3cgZGV0ZWN0ZWQgY29kZSBtb3Zlcy5cIilcblx0XHR9LFxuXHRcdCdkaWZmRWRpdG9yLmV4cGVyaW1lbnRhbC5zaG93RW1wdHlEZWNvcmF0aW9ucyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGRpZmZFZGl0b3JEZWZhdWx0T3B0aW9ucy5leHBlcmltZW50YWwuc2hvd0VtcHR5RGVjb3JhdGlvbnMsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzaG93RW1wdHlEZWNvcmF0aW9ucycsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgZGlmZiBlZGl0b3Igc2hvd3MgZW1wdHkgZGVjb3JhdGlvbnMgdG8gc2VlIHdoZXJlIGNoYXJhY3RlcnMgZ290IGluc2VydGVkIG9yIGRlbGV0ZWQuXCIpLFxuXHRcdH0sXG5cdFx0J2RpZmZFZGl0b3IuZXhwZXJpbWVudGFsLnVzZVRydWVJbmxpbmVWaWV3Jzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZGlmZkVkaXRvckRlZmF1bHRPcHRpb25zLmV4cGVyaW1lbnRhbC51c2VUcnVlSW5saW5lVmlldyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3VzZVRydWVJbmxpbmVWaWV3JywgXCJJZiBlbmFibGVkIGFuZCB0aGUgZWRpdG9yIHVzZXMgdGhlIGlubGluZSB2aWV3LCB3b3JkIGNoYW5nZXMgYXJlIHJlbmRlcmVkIGlubGluZS5cIiksXG5cdFx0fSxcblx0fVxufTtcblxuZnVuY3Rpb24gaXNDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEoeDogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSB8IHsgW3BhdGg6IHN0cmluZ106IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgfSk6IHggaXMgSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSB7XG5cdHJldHVybiAodHlwZW9mIHgudHlwZSAhPT0gJ3VuZGVmaW5lZCcgfHwgdHlwZW9mIHguYW55T2YgIT09ICd1bmRlZmluZWQnKTtcbn1cblxuLy8gQWRkIHByb3BlcnRpZXMgZnJvbSB0aGUgRWRpdG9yIE9wdGlvbiBSZWdpc3RyeVxuZm9yIChjb25zdCBlZGl0b3JPcHRpb24gb2YgZWRpdG9yT3B0aW9uc1JlZ2lzdHJ5KSB7XG5cdGNvbnN0IHNjaGVtYSA9IGVkaXRvck9wdGlvbi5zY2hlbWE7XG5cdGlmICh0eXBlb2Ygc2NoZW1hICE9PSAndW5kZWZpbmVkJykge1xuXHRcdGlmIChpc0NvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYShzY2hlbWEpKSB7XG5cdFx0XHQvLyBUaGlzIGlzIGEgc2luZ2xlIHNjaGVtYSBjb250cmlidXRpb25cblx0XHRcdGVkaXRvckNvbmZpZ3VyYXRpb24ucHJvcGVydGllcyFbYGVkaXRvci4ke2VkaXRvck9wdGlvbi5uYW1lfWBdID0gc2NoZW1hO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBzY2hlbWEpIHtcblx0XHRcdFx0aWYgKE9iamVjdC5oYXNPd25Qcm9wZXJ0eS5jYWxsKHNjaGVtYSwga2V5KSkge1xuXHRcdFx0XHRcdGVkaXRvckNvbmZpZ3VyYXRpb24ucHJvcGVydGllcyFba2V5XSA9IHNjaGVtYVtrZXldO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmxldCBjYWNoZWRFZGl0b3JDb25maWd1cmF0aW9uS2V5czogeyBba2V5OiBzdHJpbmddOiBib29sZWFuIH0gfCBudWxsID0gbnVsbDtcbmZ1bmN0aW9uIGdldEVkaXRvckNvbmZpZ3VyYXRpb25LZXlzKCk6IHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9IHtcblx0aWYgKGNhY2hlZEVkaXRvckNvbmZpZ3VyYXRpb25LZXlzID09PSBudWxsKSB7XG5cdFx0Y2FjaGVkRWRpdG9yQ29uZmlndXJhdGlvbktleXMgPSA8eyBba2V5OiBzdHJpbmddOiBib29sZWFuIH0+T2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRPYmplY3Qua2V5cyhlZGl0b3JDb25maWd1cmF0aW9uLnByb3BlcnRpZXMhKS5mb3JFYWNoKChwcm9wKSA9PiB7XG5cdFx0XHRjYWNoZWRFZGl0b3JDb25maWd1cmF0aW9uS2V5cyFbcHJvcF0gPSB0cnVlO1xuXHRcdH0pO1xuXHR9XG5cdHJldHVybiBjYWNoZWRFZGl0b3JDb25maWd1cmF0aW9uS2V5cztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRWRpdG9yQ29uZmlndXJhdGlvbktleShrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRjb25zdCBlZGl0b3JDb25maWd1cmF0aW9uS2V5cyA9IGdldEVkaXRvckNvbmZpZ3VyYXRpb25LZXlzKCk7XG5cdHJldHVybiAoZWRpdG9yQ29uZmlndXJhdGlvbktleXNbYGVkaXRvci4ke2tleX1gXSB8fCBmYWxzZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0RpZmZFZGl0b3JDb25maWd1cmF0aW9uS2V5KGtleTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdGNvbnN0IGVkaXRvckNvbmZpZ3VyYXRpb25LZXlzID0gZ2V0RWRpdG9yQ29uZmlndXJhdGlvbktleXMoKTtcblx0cmV0dXJuIChlZGl0b3JDb25maWd1cmF0aW9uS2V5c1tgZGlmZkVkaXRvci4ke2tleX1gXSB8fCBmYWxzZSk7XG59XG5cbmNvbnN0IGNvbmZpZ3VyYXRpb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5jb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKGVkaXRvckNvbmZpZ3VyYXRpb24pO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVnaXN0ZXJFZGl0b3JGb250Q29uZmlndXJhdGlvbnMoZ2V0Rm9udFNuaXBwZXRzOiAoKSA9PiBQcm9taXNlPElKU09OU2NoZW1hU25pcHBldFtdPikge1xuXHRjb25zdCBlZGl0b3JLZXlzV2l0aEZvbnQgPSBbJ2VkaXRvci5mb250RmFtaWx5J107XG5cdGNvbnN0IGZvbnRTbmlwcGV0cyA9IGF3YWl0IGdldEZvbnRTbmlwcGV0cygpO1xuXHRmb3IgKGNvbnN0IGtleSBvZiBlZGl0b3JLZXlzV2l0aEZvbnQpIHtcblx0XHRpZiAoXG5cdFx0XHRlZGl0b3JDb25maWd1cmF0aW9uLnByb3BlcnRpZXMgJiYgZWRpdG9yQ29uZmlndXJhdGlvbi5wcm9wZXJ0aWVzW2tleV1cblx0XHQpIHtcblx0XHRcdGVkaXRvckNvbmZpZ3VyYXRpb24ucHJvcGVydGllc1trZXldLmRlZmF1bHRTbmlwcGV0cyA9IGZvbnRTbmlwcGV0cztcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNkJBQTZCO0FBQ3RDLFlBQVksU0FBUztB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
