import * as nls from "../../../../nls.js";
import * as types from "../../../../base/common/types.js";
import * as resources from "../../../../base/common/resources.js";
import { ExtensionsRegistry } from "../../extensions/common/extensionsRegistry.js";
import { ExtensionData } from "./workbenchThemeService.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Extensions } from "../../extensionManagement/common/extensionFeatures.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { ThemeTypeSelector } from "../../../../platform/theme/common/theme.js";
function registerColorThemeExtensionPoint() {
  return ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: "themes",
    jsonSchema: {
      description: nls.localize("vscode.extension.contributes.themes", "Contributes textmate color themes."),
      type: "array",
      items: {
        type: "object",
        defaultSnippets: [{ body: { label: "${1:label}", id: "${2:id}", uiTheme: ThemeTypeSelector.VS_DARK, path: "./themes/${3:id}.tmTheme." } }],
        properties: {
          id: {
            description: nls.localize("vscode.extension.contributes.themes.id", "Id of the color theme as used in the user settings."),
            type: "string"
          },
          label: {
            description: nls.localize("vscode.extension.contributes.themes.label", "Label of the color theme as shown in the UI."),
            type: "string"
          },
          uiTheme: {
            description: nls.localize("vscode.extension.contributes.themes.uiTheme", "Base theme defining the colors around the editor: 'vs' is the light color theme, 'vs-dark' is the dark color theme. 'hc-black' is the dark high contrast theme, 'hc-light' is the light high contrast theme."),
            enum: [ThemeTypeSelector.VS, ThemeTypeSelector.VS_DARK, ThemeTypeSelector.HC_BLACK, ThemeTypeSelector.HC_LIGHT]
          },
          path: {
            description: nls.localize("vscode.extension.contributes.themes.path", "Path of the tmTheme file. The path is relative to the extension folder and is typically './colorthemes/awesome-color-theme.json'."),
            type: "string"
          }
        },
        required: ["path", "uiTheme"]
      }
    }
  });
}
function registerFileIconThemeExtensionPoint() {
  return ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: "iconThemes",
    jsonSchema: {
      description: nls.localize("vscode.extension.contributes.iconThemes", "Contributes file icon themes."),
      type: "array",
      items: {
        type: "object",
        defaultSnippets: [{ body: { id: "${1:id}", label: "${2:label}", path: "./fileicons/${3:id}-icon-theme.json" } }],
        properties: {
          id: {
            description: nls.localize("vscode.extension.contributes.iconThemes.id", "Id of the file icon theme as used in the user settings."),
            type: "string"
          },
          label: {
            description: nls.localize("vscode.extension.contributes.iconThemes.label", "Label of the file icon theme as shown in the UI."),
            type: "string"
          },
          path: {
            description: nls.localize("vscode.extension.contributes.iconThemes.path", "Path of the file icon theme definition file. The path is relative to the extension folder and is typically './fileicons/awesome-icon-theme.json'."),
            type: "string"
          }
        },
        required: ["path", "id"]
      }
    }
  });
}
function registerProductIconThemeExtensionPoint() {
  return ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: "productIconThemes",
    jsonSchema: {
      description: nls.localize("vscode.extension.contributes.productIconThemes", "Contributes product icon themes."),
      type: "array",
      items: {
        type: "object",
        defaultSnippets: [{ body: { id: "${1:id}", label: "${2:label}", path: "./producticons/${3:id}-product-icon-theme.json" } }],
        properties: {
          id: {
            description: nls.localize("vscode.extension.contributes.productIconThemes.id", "Id of the product icon theme as used in the user settings."),
            type: "string"
          },
          label: {
            description: nls.localize("vscode.extension.contributes.productIconThemes.label", "Label of the product icon theme as shown in the UI."),
            type: "string"
          },
          path: {
            description: nls.localize("vscode.extension.contributes.productIconThemes.path", "Path of the product icon theme definition file. The path is relative to the extension folder and is typically './producticons/awesome-product-icon-theme.json'."),
            type: "string"
          }
        },
        required: ["path", "id"]
      }
    }
  });
}
class ThemeDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "markdown";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.themes || !!manifest.contributes?.iconThemes || !!manifest.contributes?.productIconThemes;
  }
  render(manifest) {
    const markdown = new MarkdownString();
    if (manifest.contributes?.themes) {
      markdown.appendMarkdown(`### ${nls.localize("color themes", "Color Themes")}

`);
      for (const theme of manifest.contributes.themes) {
        markdown.appendMarkdown(`- ${theme.label}
`);
      }
    }
    if (manifest.contributes?.iconThemes) {
      markdown.appendMarkdown(`### ${nls.localize("file icon themes", "File Icon Themes")}

`);
      for (const theme of manifest.contributes.iconThemes) {
        markdown.appendMarkdown(`- ${theme.label}
`);
      }
    }
    if (manifest.contributes?.productIconThemes) {
      markdown.appendMarkdown(`### ${nls.localize("product icon themes", "Product Icon Themes")}

`);
      for (const theme of manifest.contributes.productIconThemes) {
        markdown.appendMarkdown(`- ${theme.label}
`);
      }
    }
    return {
      data: markdown,
      dispose: () => {
      }
    };
  }
}
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "themes",
  label: nls.localize("themes", "Themes"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(ThemeDataRenderer)
});
class ThemeRegistry {
  constructor(themesExtPoint, create, idRequired = false, builtInTheme = void 0) {
    this.themesExtPoint = themesExtPoint;
    this.create = create;
    this.idRequired = idRequired;
    this.builtInTheme = builtInTheme;
    this.onDidChangeEmitter = new Emitter();
    this.onDidChange = this.onDidChangeEmitter.event;
    this.extensionThemes = [];
    this.initialize();
  }
  dispose() {
    this.themesExtPoint.setHandler(() => {
    });
  }
  initialize() {
    this.themesExtPoint.setHandler((extensions, delta) => {
      const previousIds = {};
      const added = [];
      for (const theme of this.extensionThemes) {
        previousIds[theme.id] = theme;
      }
      this.extensionThemes.length = 0;
      for (const ext of extensions) {
        const extensionData = ExtensionData.fromName(ext.description.publisher, ext.description.name, ext.description.isBuiltin);
        this.onThemes(extensionData, ext.description.extensionLocation, ext.value, this.extensionThemes, ext.collector);
      }
      for (const theme of this.extensionThemes) {
        if (!previousIds[theme.id]) {
          added.push(theme);
        } else {
          delete previousIds[theme.id];
        }
      }
      const removed = Object.values(previousIds);
      this.onDidChangeEmitter.fire({ themes: this.extensionThemes, added, removed });
    });
  }
  onThemes(extensionData, extensionLocation, themeContributions, resultingThemes = [], log) {
    if (!Array.isArray(themeContributions)) {
      log?.error(nls.localize(
        "reqarray",
        "Extension point `{0}` must be an array.",
        this.themesExtPoint.name
      ));
      return resultingThemes;
    }
    themeContributions.forEach((theme) => {
      if (!theme.path || !types.isString(theme.path)) {
        log?.error(nls.localize(
          "reqpath",
          "Expected string in `contributes.{0}.path`. Provided value: {1}",
          this.themesExtPoint.name,
          String(theme.path)
        ));
        return;
      }
      if (this.idRequired && (!theme.id || !types.isString(theme.id))) {
        log?.error(nls.localize(
          "reqid",
          "Expected string in `contributes.{0}.id`. Provided value: {1}",
          this.themesExtPoint.name,
          String(theme.id)
        ));
        return;
      }
      const themeLocation = resources.joinPath(extensionLocation, theme.path);
      if (!resources.isEqualOrParent(themeLocation, extensionLocation)) {
        log?.warn(nls.localize("invalid.path.1", "Expected `contributes.{0}.path` ({1}) to be included inside extension's folder ({2}). This might make the extension non-portable.", this.themesExtPoint.name, themeLocation.path, extensionLocation.path));
      }
      const themeData = this.create(theme, themeLocation, extensionData);
      resultingThemes.push(themeData);
    });
    return resultingThemes;
  }
  findThemeById(themeId) {
    if (this.builtInTheme && this.builtInTheme.id === themeId) {
      return this.builtInTheme;
    }
    const allThemes = this.getThemes();
    for (const t of allThemes) {
      if (t.id === themeId) {
        return t;
      }
    }
    return void 0;
  }
  findThemeBySettingsId(settingsId, defaultSettingsId) {
    if (this.builtInTheme && this.builtInTheme.settingsId === settingsId) {
      return this.builtInTheme;
    }
    const allThemes = this.getThemes();
    let defaultTheme = void 0;
    for (const t of allThemes) {
      if (t.settingsId === settingsId) {
        return t;
      }
      if (t.settingsId === defaultSettingsId) {
        defaultTheme = t;
      }
    }
    return defaultTheme;
  }
  findThemeByExtensionLocation(extLocation) {
    if (extLocation) {
      return this.getThemes().filter((t) => t.location && resources.isEqualOrParent(t.location, extLocation));
    }
    return [];
  }
  getThemes() {
    return this.extensionThemes;
  }
  getMarketplaceThemes(manifest, extensionLocation, extensionData) {
    const themes = manifest?.contributes?.[this.themesExtPoint.name];
    if (Array.isArray(themes)) {
      return this.onThemes(extensionData, extensionLocation, themes);
    }
    return [];
  }
}
export {
  ThemeRegistry,
  registerColorThemeExtensionPoint,
  registerFileIconThemeExtensionPoint,
  registerProductIconThemeExtensionPoint
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2NvbW1vbi90aGVtZUV4dGVuc2lvblBvaW50cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuXG5pbXBvcnQgKiBhcyB0eXBlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgKiBhcyByZXNvdXJjZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbk1lc3NhZ2VDb2xsZWN0b3IsIElFeHRlbnNpb25Qb2ludCwgRXh0ZW5zaW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkRhdGEsIElUaGVtZUV4dGVuc2lvblBvaW50IH0gZnJvbSAnLi93b3JrYmVuY2hUaGVtZVNlcnZpY2UuanMnO1xuXG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zLCBJRXh0ZW5zaW9uRmVhdHVyZU1hcmtkb3duUmVuZGVyZXIsIElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5LCBJUmVuZGVyZWREYXRhIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmlmZXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcsIE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBUaGVtZVR5cGVTZWxlY3RvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZS5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckNvbG9yVGhlbWVFeHRlbnNpb25Qb2ludCgpIHtcblx0cmV0dXJuIEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PElUaGVtZUV4dGVuc2lvblBvaW50W10+KHtcblx0XHRleHRlbnNpb25Qb2ludDogJ3RoZW1lcycsXG5cdFx0anNvblNjaGVtYToge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy50aGVtZXMnLCAnQ29udHJpYnV0ZXMgdGV4dG1hdGUgY29sb3IgdGhlbWVzLicpLFxuXHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IHsgbGFiZWw6ICckezE6bGFiZWx9JywgaWQ6ICckezI6aWR9JywgdWlUaGVtZTogVGhlbWVUeXBlU2VsZWN0b3IuVlNfREFSSywgcGF0aDogJy4vdGhlbWVzLyR7MzppZH0udG1UaGVtZS4nIH0gfV0sXG5cdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRpZDoge1xuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy50aGVtZXMuaWQnLCAnSWQgb2YgdGhlIGNvbG9yIHRoZW1lIGFzIHVzZWQgaW4gdGhlIHVzZXIgc2V0dGluZ3MuJyksXG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0bGFiZWw6IHtcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudGhlbWVzLmxhYmVsJywgJ0xhYmVsIG9mIHRoZSBjb2xvciB0aGVtZSBhcyBzaG93biBpbiB0aGUgVUkuJyksXG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dWlUaGVtZToge1xuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy50aGVtZXMudWlUaGVtZScsICdCYXNlIHRoZW1lIGRlZmluaW5nIHRoZSBjb2xvcnMgYXJvdW5kIHRoZSBlZGl0b3I6IFxcJ3ZzXFwnIGlzIHRoZSBsaWdodCBjb2xvciB0aGVtZSwgXFwndnMtZGFya1xcJyBpcyB0aGUgZGFyayBjb2xvciB0aGVtZS4gXFwnaGMtYmxhY2tcXCcgaXMgdGhlIGRhcmsgaGlnaCBjb250cmFzdCB0aGVtZSwgXFwnaGMtbGlnaHRcXCcgaXMgdGhlIGxpZ2h0IGhpZ2ggY29udHJhc3QgdGhlbWUuJyksXG5cdFx0XHRcdFx0XHRlbnVtOiBbVGhlbWVUeXBlU2VsZWN0b3IuVlMsIFRoZW1lVHlwZVNlbGVjdG9yLlZTX0RBUkssIFRoZW1lVHlwZVNlbGVjdG9yLkhDX0JMQUNLLCBUaGVtZVR5cGVTZWxlY3Rvci5IQ19MSUdIVF1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHBhdGg6IHtcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudGhlbWVzLnBhdGgnLCAnUGF0aCBvZiB0aGUgdG1UaGVtZSBmaWxlLiBUaGUgcGF0aCBpcyByZWxhdGl2ZSB0byB0aGUgZXh0ZW5zaW9uIGZvbGRlciBhbmQgaXMgdHlwaWNhbGx5IFxcJy4vY29sb3J0aGVtZXMvYXdlc29tZS1jb2xvci10aGVtZS5qc29uXFwnLicpLFxuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlcXVpcmVkOiBbJ3BhdGgnLCAndWlUaGVtZSddXG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn1cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckZpbGVJY29uVGhlbWVFeHRlbnNpb25Qb2ludCgpIHtcblx0cmV0dXJuIEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PElUaGVtZUV4dGVuc2lvblBvaW50W10+KHtcblx0XHRleHRlbnNpb25Qb2ludDogJ2ljb25UaGVtZXMnLFxuXHRcdGpzb25TY2hlbWE6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuaWNvblRoZW1lcycsICdDb250cmlidXRlcyBmaWxlIGljb24gdGhlbWVzLicpLFxuXHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IHsgaWQ6ICckezE6aWR9JywgbGFiZWw6ICckezI6bGFiZWx9JywgcGF0aDogJy4vZmlsZWljb25zLyR7MzppZH0taWNvbi10aGVtZS5qc29uJyB9IH1dLFxuXHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0aWQ6IHtcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuaWNvblRoZW1lcy5pZCcsICdJZCBvZiB0aGUgZmlsZSBpY29uIHRoZW1lIGFzIHVzZWQgaW4gdGhlIHVzZXIgc2V0dGluZ3MuJyksXG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0bGFiZWw6IHtcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuaWNvblRoZW1lcy5sYWJlbCcsICdMYWJlbCBvZiB0aGUgZmlsZSBpY29uIHRoZW1lIGFzIHNob3duIGluIHRoZSBVSS4nKSxcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRwYXRoOiB7XG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmljb25UaGVtZXMucGF0aCcsICdQYXRoIG9mIHRoZSBmaWxlIGljb24gdGhlbWUgZGVmaW5pdGlvbiBmaWxlLiBUaGUgcGF0aCBpcyByZWxhdGl2ZSB0byB0aGUgZXh0ZW5zaW9uIGZvbGRlciBhbmQgaXMgdHlwaWNhbGx5IFxcJy4vZmlsZWljb25zL2F3ZXNvbWUtaWNvbi10aGVtZS5qc29uXFwnLicpLFxuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlcXVpcmVkOiBbJ3BhdGgnLCAnaWQnXVxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclByb2R1Y3RJY29uVGhlbWVFeHRlbnNpb25Qb2ludCgpIHtcblx0cmV0dXJuIEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PElUaGVtZUV4dGVuc2lvblBvaW50W10+KHtcblx0XHRleHRlbnNpb25Qb2ludDogJ3Byb2R1Y3RJY29uVGhlbWVzJyxcblx0XHRqc29uU2NoZW1hOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnByb2R1Y3RJY29uVGhlbWVzJywgJ0NvbnRyaWJ1dGVzIHByb2R1Y3QgaWNvbiB0aGVtZXMuJyksXG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBpZDogJyR7MTppZH0nLCBsYWJlbDogJyR7MjpsYWJlbH0nLCBwYXRoOiAnLi9wcm9kdWN0aWNvbnMvJHszOmlkfS1wcm9kdWN0LWljb24tdGhlbWUuanNvbicgfSB9XSxcblx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdGlkOiB7XG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnByb2R1Y3RJY29uVGhlbWVzLmlkJywgJ0lkIG9mIHRoZSBwcm9kdWN0IGljb24gdGhlbWUgYXMgdXNlZCBpbiB0aGUgdXNlciBzZXR0aW5ncy4nKSxcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRsYWJlbDoge1xuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5wcm9kdWN0SWNvblRoZW1lcy5sYWJlbCcsICdMYWJlbCBvZiB0aGUgcHJvZHVjdCBpY29uIHRoZW1lIGFzIHNob3duIGluIHRoZSBVSS4nKSxcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRwYXRoOiB7XG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnByb2R1Y3RJY29uVGhlbWVzLnBhdGgnLCAnUGF0aCBvZiB0aGUgcHJvZHVjdCBpY29uIHRoZW1lIGRlZmluaXRpb24gZmlsZS4gVGhlIHBhdGggaXMgcmVsYXRpdmUgdG8gdGhlIGV4dGVuc2lvbiBmb2xkZXIgYW5kIGlzIHR5cGljYWxseSBcXCcuL3Byb2R1Y3RpY29ucy9hd2Vzb21lLXByb2R1Y3QtaWNvbi10aGVtZS5qc29uXFwnLicpLFxuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlcXVpcmVkOiBbJ3BhdGgnLCAnaWQnXVxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG59XG5cbmNsYXNzIFRoZW1lRGF0YVJlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFeHRlbnNpb25GZWF0dXJlTWFya2Rvd25SZW5kZXJlciB7XG5cblx0cmVhZG9ubHkgdHlwZSA9ICdtYXJrZG93bic7XG5cblx0c2hvdWxkUmVuZGVyKG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISFtYW5pZmVzdC5jb250cmlidXRlcz8udGhlbWVzIHx8ICEhbWFuaWZlc3QuY29udHJpYnV0ZXM/Lmljb25UaGVtZXMgfHwgISFtYW5pZmVzdC5jb250cmlidXRlcz8ucHJvZHVjdEljb25UaGVtZXM7XG5cdH1cblxuXHRyZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IElSZW5kZXJlZERhdGE8SU1hcmtkb3duU3RyaW5nPiB7XG5cdFx0Y29uc3QgbWFya2Rvd24gPSBuZXcgTWFya2Rvd25TdHJpbmcoKTtcblx0XHRpZiAobWFuaWZlc3QuY29udHJpYnV0ZXM/LnRoZW1lcykge1xuXHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYCMjIyAke25scy5sb2NhbGl6ZSgnY29sb3IgdGhlbWVzJywgXCJDb2xvciBUaGVtZXNcIil9XFxuXFxuYCk7XG5cdFx0XHRmb3IgKGNvbnN0IHRoZW1lIG9mIG1hbmlmZXN0LmNvbnRyaWJ1dGVzLnRoZW1lcykge1xuXHRcdFx0XHRtYXJrZG93bi5hcHBlbmRNYXJrZG93bihgLSAke3RoZW1lLmxhYmVsfVxcbmApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAobWFuaWZlc3QuY29udHJpYnV0ZXM/Lmljb25UaGVtZXMpIHtcblx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAjIyMgJHtubHMubG9jYWxpemUoJ2ZpbGUgaWNvbiB0aGVtZXMnLCBcIkZpbGUgSWNvbiBUaGVtZXNcIil9XFxuXFxuYCk7XG5cdFx0XHRmb3IgKGNvbnN0IHRoZW1lIG9mIG1hbmlmZXN0LmNvbnRyaWJ1dGVzLmljb25UaGVtZXMpIHtcblx0XHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYC0gJHt0aGVtZS5sYWJlbH1cXG5gKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKG1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5wcm9kdWN0SWNvblRoZW1lcykge1xuXHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYCMjIyAke25scy5sb2NhbGl6ZSgncHJvZHVjdCBpY29uIHRoZW1lcycsIFwiUHJvZHVjdCBJY29uIFRoZW1lc1wiKX1cXG5cXG5gKTtcblx0XHRcdGZvciAoY29uc3QgdGhlbWUgb2YgbWFuaWZlc3QuY29udHJpYnV0ZXMucHJvZHVjdEljb25UaGVtZXMpIHtcblx0XHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYC0gJHt0aGVtZS5sYWJlbH1cXG5gKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRhdGE6IG1hcmtkb3duLFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4geyAvKiBub29wICovIH1cblx0XHR9O1xuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5PihFeHRlbnNpb25zLkV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnkpLnJlZ2lzdGVyRXh0ZW5zaW9uRmVhdHVyZSh7XG5cdGlkOiAndGhlbWVzJyxcblx0bGFiZWw6IG5scy5sb2NhbGl6ZSgndGhlbWVzJywgXCJUaGVtZXNcIiksXG5cdGFjY2Vzczoge1xuXHRcdGNhblRvZ2dsZTogZmFsc2Vcblx0fSxcblx0cmVuZGVyZXI6IG5ldyBTeW5jRGVzY3JpcHRvcihUaGVtZURhdGFSZW5kZXJlciksXG59KTtcblxuZXhwb3J0IGludGVyZmFjZSBUaGVtZUNoYW5nZUV2ZW50PFQ+IHtcblx0dGhlbWVzOiBUW107XG5cdGFkZGVkOiBUW107XG5cdHJlbW92ZWQ6IFRbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGhlbWVEYXRhIHtcblx0aWQ6IHN0cmluZztcblx0c2V0dGluZ3NJZDogc3RyaW5nIHwgbnVsbDtcblx0bG9jYXRpb24/OiBVUkk7XG59XG5cbmV4cG9ydCBjbGFzcyBUaGVtZVJlZ2lzdHJ5PFQgZXh0ZW5kcyBJVGhlbWVEYXRhPiBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIGV4dGVuc2lvblRoZW1lczogVFtdO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgb25EaWRDaGFuZ2VFbWl0dGVyID0gbmV3IEVtaXR0ZXI8VGhlbWVDaGFuZ2VFdmVudDxUPj4oKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDxUaGVtZUNoYW5nZUV2ZW50PFQ+PiA9IHRoaXMub25EaWRDaGFuZ2VFbWl0dGVyLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdGhlbWVzRXh0UG9pbnQ6IElFeHRlbnNpb25Qb2ludDxJVGhlbWVFeHRlbnNpb25Qb2ludFtdPixcblx0XHRwcml2YXRlIGNyZWF0ZTogKHRoZW1lOiBJVGhlbWVFeHRlbnNpb25Qb2ludCwgdGhlbWVMb2NhdGlvbjogVVJJLCBleHRlbnNpb25EYXRhOiBFeHRlbnNpb25EYXRhKSA9PiBULFxuXHRcdHByaXZhdGUgaWRSZXF1aXJlZCA9IGZhbHNlLFxuXHRcdHByaXZhdGUgYnVpbHRJblRoZW1lOiBUIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkXG5cdCkge1xuXHRcdHRoaXMuZXh0ZW5zaW9uVGhlbWVzID0gW107XG5cdFx0dGhpcy5pbml0aWFsaXplKCk7XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMudGhlbWVzRXh0UG9pbnQuc2V0SGFuZGxlcigoKSA9PiB7IH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBpbml0aWFsaXplKCkge1xuXHRcdHRoaXMudGhlbWVzRXh0UG9pbnQuc2V0SGFuZGxlcigoZXh0ZW5zaW9ucywgZGVsdGEpID0+IHtcblx0XHRcdGNvbnN0IHByZXZpb3VzSWRzOiB7IFtrZXk6IHN0cmluZ106IFQgfSA9IHt9O1xuXG5cdFx0XHRjb25zdCBhZGRlZDogVFtdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IHRoZW1lIG9mIHRoaXMuZXh0ZW5zaW9uVGhlbWVzKSB7XG5cdFx0XHRcdHByZXZpb3VzSWRzW3RoZW1lLmlkXSA9IHRoZW1lO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5leHRlbnNpb25UaGVtZXMubGVuZ3RoID0gMDtcblx0XHRcdGZvciAoY29uc3QgZXh0IG9mIGV4dGVuc2lvbnMpIHtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uRGF0YSA9IEV4dGVuc2lvbkRhdGEuZnJvbU5hbWUoZXh0LmRlc2NyaXB0aW9uLnB1Ymxpc2hlciwgZXh0LmRlc2NyaXB0aW9uLm5hbWUsIGV4dC5kZXNjcmlwdGlvbi5pc0J1aWx0aW4pO1xuXHRcdFx0XHR0aGlzLm9uVGhlbWVzKGV4dGVuc2lvbkRhdGEsIGV4dC5kZXNjcmlwdGlvbi5leHRlbnNpb25Mb2NhdGlvbiwgZXh0LnZhbHVlLCB0aGlzLmV4dGVuc2lvblRoZW1lcywgZXh0LmNvbGxlY3Rvcik7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IHRoZW1lIG9mIHRoaXMuZXh0ZW5zaW9uVGhlbWVzKSB7XG5cdFx0XHRcdGlmICghcHJldmlvdXNJZHNbdGhlbWUuaWRdKSB7XG5cdFx0XHRcdFx0YWRkZWQucHVzaCh0aGVtZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGVsZXRlIHByZXZpb3VzSWRzW3RoZW1lLmlkXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcmVtb3ZlZCA9IE9iamVjdC52YWx1ZXMocHJldmlvdXNJZHMpO1xuXHRcdFx0dGhpcy5vbkRpZENoYW5nZUVtaXR0ZXIuZmlyZSh7IHRoZW1lczogdGhpcy5leHRlbnNpb25UaGVtZXMsIGFkZGVkLCByZW1vdmVkIH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBvblRoZW1lcyhleHRlbnNpb25EYXRhOiBFeHRlbnNpb25EYXRhLCBleHRlbnNpb25Mb2NhdGlvbjogVVJJLCB0aGVtZUNvbnRyaWJ1dGlvbnM6IElUaGVtZUV4dGVuc2lvblBvaW50W10sIHJlc3VsdGluZ1RoZW1lczogVFtdID0gW10sIGxvZz86IEV4dGVuc2lvbk1lc3NhZ2VDb2xsZWN0b3IpOiBUW10ge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheSh0aGVtZUNvbnRyaWJ1dGlvbnMpKSB7XG5cdFx0XHRsb2c/LmVycm9yKG5scy5sb2NhbGl6ZShcblx0XHRcdFx0J3JlcWFycmF5Jyxcblx0XHRcdFx0XCJFeHRlbnNpb24gcG9pbnQgYHswfWAgbXVzdCBiZSBhbiBhcnJheS5cIixcblx0XHRcdFx0dGhpcy50aGVtZXNFeHRQb2ludC5uYW1lXG5cdFx0XHQpKTtcblx0XHRcdHJldHVybiByZXN1bHRpbmdUaGVtZXM7XG5cdFx0fVxuXHRcdHRoZW1lQ29udHJpYnV0aW9ucy5mb3JFYWNoKHRoZW1lID0+IHtcblx0XHRcdGlmICghdGhlbWUucGF0aCB8fCAhdHlwZXMuaXNTdHJpbmcodGhlbWUucGF0aCkpIHtcblx0XHRcdFx0bG9nPy5lcnJvcihubHMubG9jYWxpemUoXG5cdFx0XHRcdFx0J3JlcXBhdGgnLFxuXHRcdFx0XHRcdFwiRXhwZWN0ZWQgc3RyaW5nIGluIGBjb250cmlidXRlcy57MH0ucGF0aGAuIFByb3ZpZGVkIHZhbHVlOiB7MX1cIixcblx0XHRcdFx0XHR0aGlzLnRoZW1lc0V4dFBvaW50Lm5hbWUsXG5cdFx0XHRcdFx0U3RyaW5nKHRoZW1lLnBhdGgpXG5cdFx0XHRcdCkpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5pZFJlcXVpcmVkICYmICghdGhlbWUuaWQgfHwgIXR5cGVzLmlzU3RyaW5nKHRoZW1lLmlkKSkpIHtcblx0XHRcdFx0bG9nPy5lcnJvcihubHMubG9jYWxpemUoXG5cdFx0XHRcdFx0J3JlcWlkJyxcblx0XHRcdFx0XHRcIkV4cGVjdGVkIHN0cmluZyBpbiBgY29udHJpYnV0ZXMuezB9LmlkYC4gUHJvdmlkZWQgdmFsdWU6IHsxfVwiLFxuXHRcdFx0XHRcdHRoaXMudGhlbWVzRXh0UG9pbnQubmFtZSxcblx0XHRcdFx0XHRTdHJpbmcodGhlbWUuaWQpXG5cdFx0XHRcdCkpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRoZW1lTG9jYXRpb24gPSByZXNvdXJjZXMuam9pblBhdGgoZXh0ZW5zaW9uTG9jYXRpb24sIHRoZW1lLnBhdGgpO1xuXHRcdFx0aWYgKCFyZXNvdXJjZXMuaXNFcXVhbE9yUGFyZW50KHRoZW1lTG9jYXRpb24sIGV4dGVuc2lvbkxvY2F0aW9uKSkge1xuXHRcdFx0XHRsb2c/Lndhcm4obmxzLmxvY2FsaXplKCdpbnZhbGlkLnBhdGguMScsIFwiRXhwZWN0ZWQgYGNvbnRyaWJ1dGVzLnswfS5wYXRoYCAoezF9KSB0byBiZSBpbmNsdWRlZCBpbnNpZGUgZXh0ZW5zaW9uJ3MgZm9sZGVyICh7Mn0pLiBUaGlzIG1pZ2h0IG1ha2UgdGhlIGV4dGVuc2lvbiBub24tcG9ydGFibGUuXCIsIHRoaXMudGhlbWVzRXh0UG9pbnQubmFtZSwgdGhlbWVMb2NhdGlvbi5wYXRoLCBleHRlbnNpb25Mb2NhdGlvbi5wYXRoKSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRoZW1lRGF0YSA9IHRoaXMuY3JlYXRlKHRoZW1lLCB0aGVtZUxvY2F0aW9uLCBleHRlbnNpb25EYXRhKTtcblx0XHRcdHJlc3VsdGluZ1RoZW1lcy5wdXNoKHRoZW1lRGF0YSk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHJlc3VsdGluZ1RoZW1lcztcblx0fVxuXG5cdHB1YmxpYyBmaW5kVGhlbWVCeUlkKHRoZW1lSWQ6IHN0cmluZyk6IFQgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLmJ1aWx0SW5UaGVtZSAmJiB0aGlzLmJ1aWx0SW5UaGVtZS5pZCA9PT0gdGhlbWVJZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuYnVpbHRJblRoZW1lO1xuXHRcdH1cblx0XHRjb25zdCBhbGxUaGVtZXMgPSB0aGlzLmdldFRoZW1lcygpO1xuXHRcdGZvciAoY29uc3QgdCBvZiBhbGxUaGVtZXMpIHtcblx0XHRcdGlmICh0LmlkID09PSB0aGVtZUlkKSB7XG5cdFx0XHRcdHJldHVybiB0O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIGZpbmRUaGVtZUJ5U2V0dGluZ3NJZChzZXR0aW5nc0lkOiBzdHJpbmcgfCBudWxsLCBkZWZhdWx0U2V0dGluZ3NJZD86IHN0cmluZyk6IFQgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLmJ1aWx0SW5UaGVtZSAmJiB0aGlzLmJ1aWx0SW5UaGVtZS5zZXR0aW5nc0lkID09PSBzZXR0aW5nc0lkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5idWlsdEluVGhlbWU7XG5cdFx0fVxuXHRcdGNvbnN0IGFsbFRoZW1lcyA9IHRoaXMuZ2V0VGhlbWVzKCk7XG5cdFx0bGV0IGRlZmF1bHRUaGVtZTogVCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRmb3IgKGNvbnN0IHQgb2YgYWxsVGhlbWVzKSB7XG5cdFx0XHRpZiAodC5zZXR0aW5nc0lkID09PSBzZXR0aW5nc0lkKSB7XG5cdFx0XHRcdHJldHVybiB0O1xuXHRcdFx0fVxuXHRcdFx0aWYgKHQuc2V0dGluZ3NJZCA9PT0gZGVmYXVsdFNldHRpbmdzSWQpIHtcblx0XHRcdFx0ZGVmYXVsdFRoZW1lID0gdDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGRlZmF1bHRUaGVtZTtcblx0fVxuXG5cdHB1YmxpYyBmaW5kVGhlbWVCeUV4dGVuc2lvbkxvY2F0aW9uKGV4dExvY2F0aW9uOiBVUkkgfCB1bmRlZmluZWQpOiBUW10ge1xuXHRcdGlmIChleHRMb2NhdGlvbikge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0VGhlbWVzKCkuZmlsdGVyKHQgPT4gdC5sb2NhdGlvbiAmJiByZXNvdXJjZXMuaXNFcXVhbE9yUGFyZW50KHQubG9jYXRpb24sIGV4dExvY2F0aW9uKSk7XG5cdFx0fVxuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdHB1YmxpYyBnZXRUaGVtZXMoKTogVFtdIHtcblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25UaGVtZXM7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TWFya2V0cGxhY2VUaGVtZXMobWFuaWZlc3Q6IGFueSwgZXh0ZW5zaW9uTG9jYXRpb246IFVSSSwgZXh0ZW5zaW9uRGF0YTogRXh0ZW5zaW9uRGF0YSk6IFRbXSB7XG5cdFx0Y29uc3QgdGhlbWVzID0gbWFuaWZlc3Q/LmNvbnRyaWJ1dGVzPy5bdGhpcy50aGVtZXNFeHRQb2ludC5uYW1lXTtcblx0XHRpZiAoQXJyYXkuaXNBcnJheSh0aGVtZXMpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5vblRoZW1lcyhleHRlbnNpb25EYXRhLCBleHRlbnNpb25Mb2NhdGlvbiwgdGhlbWVzKTtcblx0XHR9XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUVyQixZQUFZLFdBQVc7QUFDdkIsWUFBWSxlQUFlO0FBQzNCLFNBQXFELDBCQUEwQjtBQUMvRSxTQUFTLHFCQUEyQztBQUVwRCxTQUFnQixlQUFlO0FBRS9CLFNBQVMsa0JBQStCO0FBQ3hDLFNBQVMsa0JBQWdHO0FBRXpHLFNBQTBCLHNCQUFzQjtBQUNoRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHlCQUF5QjtBQUUzQixTQUFTLG1DQUFtQztBQUNsRCxTQUFPLG1CQUFtQix1QkFBK0M7QUFBQSxJQUN4RSxnQkFBZ0I7QUFBQSxJQUNoQixZQUFZO0FBQUEsTUFDWCxhQUFhLElBQUksU0FBUyx1Q0FBdUMsb0NBQW9DO0FBQUEsTUFDckcsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLFFBQ04sTUFBTTtBQUFBLFFBQ04saUJBQWlCLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxjQUFjLElBQUksV0FBVyxTQUFTLGtCQUFrQixTQUFTLE1BQU0sNEJBQTRCLEVBQUUsQ0FBQztBQUFBLFFBQ3pJLFlBQVk7QUFBQSxVQUNYLElBQUk7QUFBQSxZQUNILGFBQWEsSUFBSSxTQUFTLDBDQUEwQyxxREFBcUQ7QUFBQSxZQUN6SCxNQUFNO0FBQUEsVUFDUDtBQUFBLFVBQ0EsT0FBTztBQUFBLFlBQ04sYUFBYSxJQUFJLFNBQVMsNkNBQTZDLDhDQUE4QztBQUFBLFlBQ3JILE1BQU07QUFBQSxVQUNQO0FBQUEsVUFDQSxTQUFTO0FBQUEsWUFDUixhQUFhLElBQUksU0FBUywrQ0FBK0MsOE1BQXNOO0FBQUEsWUFDL1IsTUFBTSxDQUFDLGtCQUFrQixJQUFJLGtCQUFrQixTQUFTLGtCQUFrQixVQUFVLGtCQUFrQixRQUFRO0FBQUEsVUFDL0c7QUFBQSxVQUNBLE1BQU07QUFBQSxZQUNMLGFBQWEsSUFBSSxTQUFTLDRDQUE0QyxtSUFBcUk7QUFBQSxZQUMzTSxNQUFNO0FBQUEsVUFDUDtBQUFBLFFBQ0Q7QUFBQSxRQUNBLFVBQVUsQ0FBQyxRQUFRLFNBQVM7QUFBQSxNQUM3QjtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFDRjtBQUNPLFNBQVMsc0NBQXNDO0FBQ3JELFNBQU8sbUJBQW1CLHVCQUErQztBQUFBLElBQ3hFLGdCQUFnQjtBQUFBLElBQ2hCLFlBQVk7QUFBQSxNQUNYLGFBQWEsSUFBSSxTQUFTLDJDQUEyQywrQkFBK0I7QUFBQSxNQUNwRyxNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsUUFDTixNQUFNO0FBQUEsUUFDTixpQkFBaUIsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLFdBQVcsT0FBTyxjQUFjLE1BQU0sc0NBQXNDLEVBQUUsQ0FBQztBQUFBLFFBQy9HLFlBQVk7QUFBQSxVQUNYLElBQUk7QUFBQSxZQUNILGFBQWEsSUFBSSxTQUFTLDhDQUE4Qyx5REFBeUQ7QUFBQSxZQUNqSSxNQUFNO0FBQUEsVUFDUDtBQUFBLFVBQ0EsT0FBTztBQUFBLFlBQ04sYUFBYSxJQUFJLFNBQVMsaURBQWlELGtEQUFrRDtBQUFBLFlBQzdILE1BQU07QUFBQSxVQUNQO0FBQUEsVUFDQSxNQUFNO0FBQUEsWUFDTCxhQUFhLElBQUksU0FBUyxnREFBZ0QsbUpBQXFKO0FBQUEsWUFDL04sTUFBTTtBQUFBLFVBQ1A7QUFBQSxRQUNEO0FBQUEsUUFDQSxVQUFVLENBQUMsUUFBUSxJQUFJO0FBQUEsTUFDeEI7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBQ0Y7QUFFTyxTQUFTLHlDQUF5QztBQUN4RCxTQUFPLG1CQUFtQix1QkFBK0M7QUFBQSxJQUN4RSxnQkFBZ0I7QUFBQSxJQUNoQixZQUFZO0FBQUEsTUFDWCxhQUFhLElBQUksU0FBUyxrREFBa0Qsa0NBQWtDO0FBQUEsTUFDOUcsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLFFBQ04sTUFBTTtBQUFBLFFBQ04saUJBQWlCLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxXQUFXLE9BQU8sY0FBYyxNQUFNLGlEQUFpRCxFQUFFLENBQUM7QUFBQSxRQUMxSCxZQUFZO0FBQUEsVUFDWCxJQUFJO0FBQUEsWUFDSCxhQUFhLElBQUksU0FBUyxxREFBcUQsNERBQTREO0FBQUEsWUFDM0ksTUFBTTtBQUFBLFVBQ1A7QUFBQSxVQUNBLE9BQU87QUFBQSxZQUNOLGFBQWEsSUFBSSxTQUFTLHdEQUF3RCxxREFBcUQ7QUFBQSxZQUN2SSxNQUFNO0FBQUEsVUFDUDtBQUFBLFVBQ0EsTUFBTTtBQUFBLFlBQ0wsYUFBYSxJQUFJLFNBQVMsdURBQXVELGlLQUFtSztBQUFBLFlBQ3BQLE1BQU07QUFBQSxVQUNQO0FBQUEsUUFDRDtBQUFBLFFBQ0EsVUFBVSxDQUFDLFFBQVEsSUFBSTtBQUFBLE1BQ3hCO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUNGO0FBRUEsTUFBTSwwQkFBMEIsV0FBd0Q7QUFBQSxFQUF4RjtBQUFBO0FBRUMsU0FBUyxPQUFPO0FBQUE7QUFBQSxFQUVoQixhQUFhLFVBQXVDO0FBQ25ELFdBQU8sQ0FBQyxDQUFDLFNBQVMsYUFBYSxVQUFVLENBQUMsQ0FBQyxTQUFTLGFBQWEsY0FBYyxDQUFDLENBQUMsU0FBUyxhQUFhO0FBQUEsRUFDeEc7QUFBQSxFQUVBLE9BQU8sVUFBOEQ7QUFDcEUsVUFBTSxXQUFXLElBQUksZUFBZTtBQUNwQyxRQUFJLFNBQVMsYUFBYSxRQUFRO0FBQ2pDLGVBQVMsZUFBZSxPQUFPLElBQUksU0FBUyxnQkFBZ0IsY0FBYyxDQUFDO0FBQUE7QUFBQSxDQUFNO0FBQ2pGLGlCQUFXLFNBQVMsU0FBUyxZQUFZLFFBQVE7QUFDaEQsaUJBQVMsZUFBZSxLQUFLLE1BQU0sS0FBSztBQUFBLENBQUk7QUFBQSxNQUM3QztBQUFBLElBQ0Q7QUFDQSxRQUFJLFNBQVMsYUFBYSxZQUFZO0FBQ3JDLGVBQVMsZUFBZSxPQUFPLElBQUksU0FBUyxvQkFBb0Isa0JBQWtCLENBQUM7QUFBQTtBQUFBLENBQU07QUFDekYsaUJBQVcsU0FBUyxTQUFTLFlBQVksWUFBWTtBQUNwRCxpQkFBUyxlQUFlLEtBQUssTUFBTSxLQUFLO0FBQUEsQ0FBSTtBQUFBLE1BQzdDO0FBQUEsSUFDRDtBQUNBLFFBQUksU0FBUyxhQUFhLG1CQUFtQjtBQUM1QyxlQUFTLGVBQWUsT0FBTyxJQUFJLFNBQVMsdUJBQXVCLHFCQUFxQixDQUFDO0FBQUE7QUFBQSxDQUFNO0FBQy9GLGlCQUFXLFNBQVMsU0FBUyxZQUFZLG1CQUFtQjtBQUMzRCxpQkFBUyxlQUFlLEtBQUssTUFBTSxLQUFLO0FBQUEsQ0FBSTtBQUFBLE1BQzdDO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLFNBQVMsTUFBTTtBQUFBLE1BQWE7QUFBQSxJQUM3QjtBQUFBLEVBQ0Q7QUFDRDtBQUVBLFNBQVMsR0FBK0IsV0FBVyx5QkFBeUIsRUFBRSx5QkFBeUI7QUFBQSxFQUN0RyxJQUFJO0FBQUEsRUFDSixPQUFPLElBQUksU0FBUyxVQUFVLFFBQVE7QUFBQSxFQUN0QyxRQUFRO0FBQUEsSUFDUCxXQUFXO0FBQUEsRUFDWjtBQUFBLEVBQ0EsVUFBVSxJQUFJLGVBQWUsaUJBQWlCO0FBQy9DLENBQUM7QUFjTSxNQUFNLGNBQTJEO0FBQUEsRUFPdkUsWUFDa0IsZ0JBQ1QsUUFDQSxhQUFhLE9BQ2IsZUFBOEIsUUFDckM7QUFKZ0I7QUFDVDtBQUNBO0FBQ0E7QUFQVCxTQUFpQixxQkFBcUIsSUFBSSxRQUE2QjtBQUN2RSxTQUFnQixjQUEwQyxLQUFLLG1CQUFtQjtBQVFqRixTQUFLLGtCQUFrQixDQUFDO0FBQ3hCLFNBQUssV0FBVztBQUFBLEVBQ2pCO0FBQUEsRUFFQSxVQUFVO0FBQ1QsU0FBSyxlQUFlLFdBQVcsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUFBLEVBQ3pDO0FBQUEsRUFFUSxhQUFhO0FBQ3BCLFNBQUssZUFBZSxXQUFXLENBQUMsWUFBWSxVQUFVO0FBQ3JELFlBQU0sY0FBb0MsQ0FBQztBQUUzQyxZQUFNLFFBQWEsQ0FBQztBQUNwQixpQkFBVyxTQUFTLEtBQUssaUJBQWlCO0FBQ3pDLG9CQUFZLE1BQU0sRUFBRSxJQUFJO0FBQUEsTUFDekI7QUFDQSxXQUFLLGdCQUFnQixTQUFTO0FBQzlCLGlCQUFXLE9BQU8sWUFBWTtBQUM3QixjQUFNLGdCQUFnQixjQUFjLFNBQVMsSUFBSSxZQUFZLFdBQVcsSUFBSSxZQUFZLE1BQU0sSUFBSSxZQUFZLFNBQVM7QUFDdkgsYUFBSyxTQUFTLGVBQWUsSUFBSSxZQUFZLG1CQUFtQixJQUFJLE9BQU8sS0FBSyxpQkFBaUIsSUFBSSxTQUFTO0FBQUEsTUFDL0c7QUFDQSxpQkFBVyxTQUFTLEtBQUssaUJBQWlCO0FBQ3pDLFlBQUksQ0FBQyxZQUFZLE1BQU0sRUFBRSxHQUFHO0FBQzNCLGdCQUFNLEtBQUssS0FBSztBQUFBLFFBQ2pCLE9BQU87QUFDTixpQkFBTyxZQUFZLE1BQU0sRUFBRTtBQUFBLFFBQzVCO0FBQUEsTUFDRDtBQUNBLFlBQU0sVUFBVSxPQUFPLE9BQU8sV0FBVztBQUN6QyxXQUFLLG1CQUFtQixLQUFLLEVBQUUsUUFBUSxLQUFLLGlCQUFpQixPQUFPLFFBQVEsQ0FBQztBQUFBLElBQzlFLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFUSxTQUFTLGVBQThCLG1CQUF3QixvQkFBNEMsa0JBQXVCLENBQUMsR0FBRyxLQUFzQztBQUNuTCxRQUFJLENBQUMsTUFBTSxRQUFRLGtCQUFrQixHQUFHO0FBQ3ZDLFdBQUssTUFBTSxJQUFJO0FBQUEsUUFDZDtBQUFBLFFBQ0E7QUFBQSxRQUNBLEtBQUssZUFBZTtBQUFBLE1BQ3JCLENBQUM7QUFDRCxhQUFPO0FBQUEsSUFDUjtBQUNBLHVCQUFtQixRQUFRLFdBQVM7QUFDbkMsVUFBSSxDQUFDLE1BQU0sUUFBUSxDQUFDLE1BQU0sU0FBUyxNQUFNLElBQUksR0FBRztBQUMvQyxhQUFLLE1BQU0sSUFBSTtBQUFBLFVBQ2Q7QUFBQSxVQUNBO0FBQUEsVUFDQSxLQUFLLGVBQWU7QUFBQSxVQUNwQixPQUFPLE1BQU0sSUFBSTtBQUFBLFFBQ2xCLENBQUM7QUFDRDtBQUFBLE1BQ0Q7QUFDQSxVQUFJLEtBQUssZUFBZSxDQUFDLE1BQU0sTUFBTSxDQUFDLE1BQU0sU0FBUyxNQUFNLEVBQUUsSUFBSTtBQUNoRSxhQUFLLE1BQU0sSUFBSTtBQUFBLFVBQ2Q7QUFBQSxVQUNBO0FBQUEsVUFDQSxLQUFLLGVBQWU7QUFBQSxVQUNwQixPQUFPLE1BQU0sRUFBRTtBQUFBLFFBQ2hCLENBQUM7QUFDRDtBQUFBLE1BQ0Q7QUFFQSxZQUFNLGdCQUFnQixVQUFVLFNBQVMsbUJBQW1CLE1BQU0sSUFBSTtBQUN0RSxVQUFJLENBQUMsVUFBVSxnQkFBZ0IsZUFBZSxpQkFBaUIsR0FBRztBQUNqRSxhQUFLLEtBQUssSUFBSSxTQUFTLGtCQUFrQixxSUFBcUksS0FBSyxlQUFlLE1BQU0sY0FBYyxNQUFNLGtCQUFrQixJQUFJLENBQUM7QUFBQSxNQUNwUDtBQUVBLFlBQU0sWUFBWSxLQUFLLE9BQU8sT0FBTyxlQUFlLGFBQWE7QUFDakUsc0JBQWdCLEtBQUssU0FBUztBQUFBLElBQy9CLENBQUM7QUFDRCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRU8sY0FBYyxTQUFnQztBQUNwRCxRQUFJLEtBQUssZ0JBQWdCLEtBQUssYUFBYSxPQUFPLFNBQVM7QUFDMUQsYUFBTyxLQUFLO0FBQUEsSUFDYjtBQUNBLFVBQU0sWUFBWSxLQUFLLFVBQVU7QUFDakMsZUFBVyxLQUFLLFdBQVc7QUFDMUIsVUFBSSxFQUFFLE9BQU8sU0FBUztBQUNyQixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRU8sc0JBQXNCLFlBQTJCLG1CQUEyQztBQUNsRyxRQUFJLEtBQUssZ0JBQWdCLEtBQUssYUFBYSxlQUFlLFlBQVk7QUFDckUsYUFBTyxLQUFLO0FBQUEsSUFDYjtBQUNBLFVBQU0sWUFBWSxLQUFLLFVBQVU7QUFDakMsUUFBSSxlQUE4QjtBQUNsQyxlQUFXLEtBQUssV0FBVztBQUMxQixVQUFJLEVBQUUsZUFBZSxZQUFZO0FBQ2hDLGVBQU87QUFBQSxNQUNSO0FBQ0EsVUFBSSxFQUFFLGVBQWUsbUJBQW1CO0FBQ3ZDLHVCQUFlO0FBQUEsTUFDaEI7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLDZCQUE2QixhQUFtQztBQUN0RSxRQUFJLGFBQWE7QUFDaEIsYUFBTyxLQUFLLFVBQVUsRUFBRSxPQUFPLE9BQUssRUFBRSxZQUFZLFVBQVUsZ0JBQWdCLEVBQUUsVUFBVSxXQUFXLENBQUM7QUFBQSxJQUNyRztBQUNBLFdBQU8sQ0FBQztBQUFBLEVBQ1Q7QUFBQSxFQUVPLFlBQWlCO0FBQ3ZCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVPLHFCQUFxQixVQUFlLG1CQUF3QixlQUFtQztBQUNyRyxVQUFNLFNBQVMsVUFBVSxjQUFjLEtBQUssZUFBZSxJQUFJO0FBQy9ELFFBQUksTUFBTSxRQUFRLE1BQU0sR0FBRztBQUMxQixhQUFPLEtBQUssU0FBUyxlQUFlLG1CQUFtQixNQUFNO0FBQUEsSUFDOUQ7QUFDQSxXQUFPLENBQUM7QUFBQSxFQUNUO0FBRUQ7IiwKICAibmFtZXMiOiBbXQp9Cg==
