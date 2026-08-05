import * as nls from "../../../../nls.js";
import * as paths from "../../../../base/common/path.js";
import * as resources from "../../../../base/common/resources.js";
import * as Json from "../../../../base/common/json.js";
import { ExtensionData } from "../common/workbenchThemeService.js";
import { getParseErrorMessage } from "../../../../base/common/jsonErrorMessages.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { fontColorRegex, fontSizeRegex } from "../../../../platform/theme/common/iconRegistry.js";
import * as css from "../../../../base/browser/cssValue.js";
import { fileIconSelectorEscape } from "../../../../editor/common/services/getIconClasses.js";
const _FileIconThemeData = class _FileIconThemeData {
  constructor(id, label, settingsId) {
    this.id = id;
    this.label = label;
    this.settingsId = settingsId;
    this.isLoaded = false;
    this.hasFileIcons = false;
    this.hasFolderIcons = false;
    this.hidesExplorerArrows = false;
  }
  ensureLoaded(themeLoader) {
    return !this.isLoaded ? this.load(themeLoader) : Promise.resolve(this.styleSheetContent);
  }
  reload(themeLoader) {
    return this.load(themeLoader);
  }
  load(themeLoader) {
    return themeLoader.load(this);
  }
  static fromExtensionTheme(iconTheme, iconThemeLocation, extensionData) {
    const id = extensionData.extensionId + "-" + iconTheme.id;
    const label = iconTheme.label || paths.basename(iconTheme.path);
    const settingsId = iconTheme.id;
    const themeData = new _FileIconThemeData(id, label, settingsId);
    themeData.description = iconTheme.description;
    themeData.location = iconThemeLocation;
    themeData.extensionData = extensionData;
    themeData.watch = iconTheme._watch;
    themeData.isLoaded = false;
    return themeData;
  }
  static get noIconTheme() {
    let themeData = _FileIconThemeData._noIconTheme;
    if (!themeData) {
      themeData = _FileIconThemeData._noIconTheme = new _FileIconThemeData("", "", null);
      themeData.hasFileIcons = false;
      themeData.hasFolderIcons = false;
      themeData.hidesExplorerArrows = false;
      themeData.isLoaded = true;
      themeData.extensionData = void 0;
      themeData.watch = false;
    }
    return themeData;
  }
  static createUnloadedTheme(id) {
    const themeData = new _FileIconThemeData(id, "", "__" + id);
    themeData.isLoaded = false;
    themeData.hasFileIcons = false;
    themeData.hasFolderIcons = false;
    themeData.hidesExplorerArrows = false;
    themeData.extensionData = void 0;
    themeData.watch = false;
    return themeData;
  }
  static fromStorageData(storageService) {
    const input = storageService.get(_FileIconThemeData.STORAGE_KEY, StorageScope.PROFILE);
    if (!input) {
      return void 0;
    }
    try {
      const data = JSON.parse(input);
      const theme = new _FileIconThemeData("", "", null);
      for (const key in data) {
        switch (key) {
          case "id":
          case "label":
          case "description":
          case "settingsId":
          case "styleSheetContent":
          case "hasFileIcons":
          case "hidesExplorerArrows":
          case "hasFolderIcons":
          case "watch":
            theme[key] = data[key];
            break;
          case "location":
            break;
          case "extensionData":
            theme.extensionData = ExtensionData.fromJSONObject(data.extensionData);
            break;
        }
      }
      return theme;
    } catch (e) {
      return void 0;
    }
  }
  toStorage(storageService) {
    const data = JSON.stringify({
      id: this.id,
      label: this.label,
      description: this.description,
      settingsId: this.settingsId,
      styleSheetContent: this.styleSheetContent,
      hasFileIcons: this.hasFileIcons,
      hasFolderIcons: this.hasFolderIcons,
      hidesExplorerArrows: this.hidesExplorerArrows,
      extensionData: ExtensionData.toJSONObject(this.extensionData),
      watch: this.watch
    });
    storageService.store(_FileIconThemeData.STORAGE_KEY, data, StorageScope.PROFILE, StorageTarget.MACHINE);
  }
};
_FileIconThemeData.STORAGE_KEY = "iconThemeData";
_FileIconThemeData._noIconTheme = null;
let FileIconThemeData = _FileIconThemeData;
class FileIconThemeLoader {
  constructor(fileService, languageService) {
    this.fileService = fileService;
    this.languageService = languageService;
  }
  load(data) {
    if (!data.location) {
      return Promise.resolve(data.styleSheetContent);
    }
    return this.loadIconThemeDocument(data.location).then((iconThemeDocument) => {
      const result = this.processIconThemeDocument(data.id, data.location, iconThemeDocument);
      data.styleSheetContent = result.content;
      data.hasFileIcons = result.hasFileIcons;
      data.hasFolderIcons = result.hasFolderIcons;
      data.hidesExplorerArrows = result.hidesExplorerArrows;
      data.isLoaded = true;
      return data.styleSheetContent;
    });
  }
  loadIconThemeDocument(location) {
    return this.fileService.readExtensionResource(location).then((content) => {
      const errors = [];
      const contentValue = Json.parse(content, errors);
      if (errors.length > 0) {
        return Promise.reject(new Error(nls.localize("error.cannotparseicontheme", "Problems parsing file icons file: {0}", errors.map((e) => getParseErrorMessage(e.error)).join(", "))));
      } else if (Json.getNodeType(contentValue) !== "object") {
        return Promise.reject(new Error(nls.localize("error.invalidformat", "Invalid format for file icons theme file: Object expected.")));
      }
      return Promise.resolve(contentValue);
    });
  }
  processIconThemeDocument(id, iconThemeDocumentLocation, iconThemeDocument) {
    const result = { content: "", hasFileIcons: false, hasFolderIcons: false, hidesExplorerArrows: !!iconThemeDocument.hidesExplorerArrows };
    let hasSpecificFileIcons = false;
    if (!iconThemeDocument.iconDefinitions) {
      return result;
    }
    const selectorByDefinitionId = {};
    const coveredLanguages = {};
    const iconThemeDocumentLocationDirname = resources.dirname(iconThemeDocumentLocation);
    function resolvePath(path) {
      return resources.joinPath(iconThemeDocumentLocationDirname, path);
    }
    function collectSelectors(associations, baseThemeClassName) {
      function addSelector(selector, defId) {
        if (defId) {
          let list = selectorByDefinitionId[defId];
          if (!list) {
            list = selectorByDefinitionId[defId] = new css.Builder();
          }
          list.push(selector);
        }
      }
      if (associations) {
        let qualifier = css.inline`.show-file-icons`;
        if (baseThemeClassName) {
          qualifier = css.inline`${baseThemeClassName} ${qualifier}`;
        }
        const expanded = css.inline`.monaco-tl-twistie.collapsible:not(.collapsed) + .monaco-tl-contents`;
        if (associations.folder) {
          addSelector(css.inline`${qualifier} .folder-icon::before`, associations.folder);
          result.hasFolderIcons = true;
        }
        if (associations.folderExpanded) {
          addSelector(css.inline`${qualifier} ${expanded} .folder-icon::before`, associations.folderExpanded);
          result.hasFolderIcons = true;
        }
        const rootFolder = associations.rootFolder || associations.folder;
        const rootFolderExpanded = associations.rootFolderExpanded || associations.folderExpanded;
        if (rootFolder) {
          addSelector(css.inline`${qualifier} .rootfolder-icon::before`, rootFolder);
          result.hasFolderIcons = true;
        }
        if (rootFolderExpanded) {
          addSelector(css.inline`${qualifier} ${expanded} .rootfolder-icon::before`, rootFolderExpanded);
          result.hasFolderIcons = true;
        }
        if (associations.file) {
          addSelector(css.inline`${qualifier} .file-icon::before`, associations.file);
          result.hasFileIcons = true;
        }
        const folderNames = associations.folderNames;
        if (folderNames) {
          for (const key in folderNames) {
            const selectors = new css.Builder();
            const name = handleParentFolder(key.toLowerCase(), selectors);
            selectors.push(css.inline`.${classSelectorPart(name)}-name-folder-icon`);
            addSelector(css.inline`${qualifier} ${selectors.join("")}.folder-icon::before`, folderNames[key]);
            result.hasFolderIcons = true;
          }
        }
        const folderNamesExpanded = associations.folderNamesExpanded;
        if (folderNamesExpanded) {
          for (const key in folderNamesExpanded) {
            const selectors = new css.Builder();
            const name = handleParentFolder(key.toLowerCase(), selectors);
            selectors.push(css.inline`.${classSelectorPart(name)}-name-folder-icon`);
            addSelector(css.inline`${qualifier} ${expanded} ${selectors.join("")}.folder-icon::before`, folderNamesExpanded[key]);
            result.hasFolderIcons = true;
          }
        }
        const rootFolderNames = associations.rootFolderNames;
        if (rootFolderNames) {
          for (const key in rootFolderNames) {
            const name = key.toLowerCase();
            addSelector(css.inline`${qualifier} .${classSelectorPart(name)}-root-name-folder-icon.rootfolder-icon::before`, rootFolderNames[key]);
            result.hasFolderIcons = true;
          }
        }
        const rootFolderNamesExpanded = associations.rootFolderNamesExpanded;
        if (rootFolderNamesExpanded) {
          for (const key in rootFolderNamesExpanded) {
            const name = key.toLowerCase();
            addSelector(css.inline`${qualifier} ${expanded} .${classSelectorPart(name)}-root-name-folder-icon.rootfolder-icon::before`, rootFolderNamesExpanded[key]);
            result.hasFolderIcons = true;
          }
        }
        const languageIds = associations.languageIds;
        if (languageIds) {
          if (!languageIds.jsonc && languageIds.json) {
            languageIds.jsonc = languageIds.json;
          }
          for (const languageId in languageIds) {
            addSelector(css.inline`${qualifier} .${classSelectorPart(languageId)}-lang-file-icon.file-icon::before`, languageIds[languageId]);
            result.hasFileIcons = true;
            hasSpecificFileIcons = true;
            coveredLanguages[languageId] = true;
          }
        }
        const fileExtensions = associations.fileExtensions;
        if (fileExtensions) {
          for (const key in fileExtensions) {
            const selectors = new css.Builder();
            const name = handleParentFolder(key.toLowerCase(), selectors);
            const segments = name.split(".");
            if (segments.length) {
              for (let i = 0; i < segments.length; i++) {
                selectors.push(css.inline`.${classSelectorPart(segments.slice(i).join("."))}-ext-file-icon`);
              }
              selectors.push(css.inline`.ext-file-icon`);
            }
            addSelector(css.inline`${qualifier} ${selectors.join("")}.file-icon::before`, fileExtensions[key]);
            result.hasFileIcons = true;
            hasSpecificFileIcons = true;
          }
        }
        const fileNames = associations.fileNames;
        if (fileNames) {
          for (const key in fileNames) {
            const selectors = new css.Builder();
            const fileName = handleParentFolder(key.toLowerCase(), selectors);
            selectors.push(css.inline`.${classSelectorPart(fileName)}-name-file-icon`);
            selectors.push(css.inline`.name-file-icon`);
            const segments = fileName.split(".");
            if (segments.length) {
              for (let i = 1; i < segments.length; i++) {
                selectors.push(css.inline`.${classSelectorPart(segments.slice(i).join("."))}-ext-file-icon`);
              }
              selectors.push(css.inline`.ext-file-icon`);
            }
            addSelector(css.inline`${qualifier} ${selectors.join("")}.file-icon::before`, fileNames[key]);
            result.hasFileIcons = true;
            hasSpecificFileIcons = true;
          }
        }
      }
    }
    collectSelectors(iconThemeDocument);
    collectSelectors(iconThemeDocument.light, css.inline`.vs`);
    collectSelectors(iconThemeDocument.highContrast, css.inline`.hc-black`);
    collectSelectors(iconThemeDocument.highContrast, css.inline`.hc-light`);
    if (!result.hasFileIcons && !result.hasFolderIcons) {
      return result;
    }
    const showLanguageModeIcons = iconThemeDocument.showLanguageModeIcons === true || hasSpecificFileIcons && iconThemeDocument.showLanguageModeIcons !== false;
    const cssRules = new css.Builder();
    const fonts = iconThemeDocument.fonts;
    const fontSizes = /* @__PURE__ */ new Map();
    if (Array.isArray(fonts)) {
      const defaultFontSize = this.tryNormalizeFontSize(fonts[0].size) || "150%";
      fonts.forEach((font) => {
        const fontSrcs = new css.Builder();
        fontSrcs.push(...font.src.map((l) => css.inline`${css.asCSSUrl(resolvePath(l.path))} format(${css.stringValue(l.format)})`));
        cssRules.push(css.inline`@font-face { src: ${fontSrcs.join(", ")}; font-family: ${css.stringValue(font.id)}; font-weight: ${css.identValue(font.weight)}; font-style: ${css.identValue(font.style)}; font-display: block; }`);
        const fontSize = this.tryNormalizeFontSize(font.size);
        if (fontSize !== void 0 && fontSize !== defaultFontSize) {
          fontSizes.set(font.id, fontSize);
        }
      });
      cssRules.push(css.inline`.show-file-icons .file-icon::before, .show-file-icons .folder-icon::before, .show-file-icons .rootfolder-icon::before { font-family: ${css.stringValue(fonts[0].id)}; font-size: ${css.sizeValue(defaultFontSize)}; }`);
    }
    const emQuad = css.stringValue("\\2001");
    for (const defId in selectorByDefinitionId) {
      const selectors = selectorByDefinitionId[defId];
      const definition = iconThemeDocument.iconDefinitions[defId];
      if (definition) {
        if (definition.iconPath) {
          cssRules.push(css.inline`${selectors.join(", ")} { content: ${emQuad}; background-image: ${css.asCSSUrl(resolvePath(definition.iconPath))}; }`);
        } else if (definition.fontCharacter || definition.fontColor) {
          const body = new css.Builder();
          if (definition.fontColor && definition.fontColor.match(fontColorRegex)) {
            body.push(css.inline`color: ${css.hexColorValue(definition.fontColor)};`);
          }
          if (definition.fontCharacter) {
            body.push(css.inline`content: ${css.stringValue(definition.fontCharacter)};`);
          }
          const fontSize = definition.fontSize ?? (definition.fontId ? fontSizes.get(definition.fontId) : void 0);
          if (fontSize && fontSize.match(fontSizeRegex)) {
            body.push(css.inline`font-size: ${css.sizeValue(fontSize)};`);
          }
          if (definition.fontId) {
            body.push(css.inline`font-family: ${css.stringValue(definition.fontId)};`);
          }
          if (showLanguageModeIcons) {
            body.push(css.inline`background-image: unset;`);
          }
          cssRules.push(css.inline`${selectors.join(", ")} { ${body.join(" ")} }`);
        }
      }
    }
    if (showLanguageModeIcons) {
      for (const languageId of this.languageService.getRegisteredLanguageIds()) {
        if (!coveredLanguages[languageId]) {
          const icon = this.languageService.getIcon(languageId);
          if (icon) {
            const selector = css.inline`.show-file-icons .${classSelectorPart(languageId)}-lang-file-icon.file-icon::before`;
            cssRules.push(css.inline`${selector} { content: ${emQuad}; background-image: ${css.asCSSUrl(icon.dark)}; }`);
            cssRules.push(css.inline`.vs ${selector} { content: ${emQuad}; background-image: ${css.asCSSUrl(icon.light)}; }`);
          }
        }
      }
    }
    result.content = cssRules.join("\n");
    return result;
  }
  /**
   * Try converting absolute font sizes to relative values.
   *
   * This allows them to be scaled nicely depending on where they are used.
   */
  tryNormalizeFontSize(size) {
    if (!size) {
      return void 0;
    }
    const defaultFontSizeInPx = 13;
    if (size.endsWith("px")) {
      const value = parseInt(size, 10);
      if (!isNaN(value)) {
        return Math.round(value / defaultFontSizeInPx * 100) + "%";
      }
    }
    return size;
  }
}
function handleParentFolder(key, selectors) {
  const lastIndexOfSlash = key.lastIndexOf("/");
  if (lastIndexOfSlash >= 0) {
    const parentFolder = key.substring(0, lastIndexOfSlash);
    selectors.push(css.inline`.${classSelectorPart(parentFolder)}-name-dir-icon`);
    return key.substring(lastIndexOfSlash + 1);
  }
  return key;
}
function classSelectorPart(str) {
  str = fileIconSelectorEscape(str);
  return css.className(str, true);
}
export {
  FileIconThemeData,
  FileIconThemeLoader
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2Jyb3dzZXIvZmlsZUljb25UaGVtZURhdGEudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyBwYXRocyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCAqIGFzIHJlc291cmNlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0ICogYXMgSnNvbiBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkRhdGEsIElUaGVtZUV4dGVuc2lvblBvaW50LCBJV29ya2JlbmNoRmlsZUljb25UaGVtZSB9IGZyb20gJy4uL2NvbW1vbi93b3JrYmVuY2hUaGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZ2V0UGFyc2VFcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uRXJyb3JNZXNzYWdlcy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvblJlc291cmNlTG9hZGVyL2NvbW1vbi9leHRlbnNpb25SZXNvdXJjZUxvYWRlci5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgZm9udENvbG9yUmVnZXgsIGZvbnRTaXplUmVnZXggfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCAqIGFzIGNzcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvY3NzVmFsdWUuanMnO1xuaW1wb3J0IHsgZmlsZUljb25TZWxlY3RvckVzY2FwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvZ2V0SWNvbkNsYXNzZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgRmlsZUljb25UaGVtZURhdGEgaW1wbGVtZW50cyBJV29ya2JlbmNoRmlsZUljb25UaGVtZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFNUT1JBR0VfS0VZID0gJ2ljb25UaGVtZURhdGEnO1xuXG5cdGlkOiBzdHJpbmc7XG5cdGxhYmVsOiBzdHJpbmc7XG5cdHNldHRpbmdzSWQ6IHN0cmluZyB8IG51bGw7XG5cdGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXHRoYXNGaWxlSWNvbnM6IGJvb2xlYW47XG5cdGhhc0ZvbGRlckljb25zOiBib29sZWFuO1xuXHRoaWRlc0V4cGxvcmVyQXJyb3dzOiBib29sZWFuO1xuXHRpc0xvYWRlZDogYm9vbGVhbjtcblx0bG9jYXRpb24/OiBVUkk7XG5cdGV4dGVuc2lvbkRhdGE/OiBFeHRlbnNpb25EYXRhO1xuXHR3YXRjaD86IGJvb2xlYW47XG5cblx0c3R5bGVTaGVldENvbnRlbnQ/OiBzdHJpbmc7XG5cblx0cHJpdmF0ZSBjb25zdHJ1Y3RvcihpZDogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBzZXR0aW5nc0lkOiBzdHJpbmcgfCBudWxsKSB7XG5cdFx0dGhpcy5pZCA9IGlkO1xuXHRcdHRoaXMubGFiZWwgPSBsYWJlbDtcblx0XHR0aGlzLnNldHRpbmdzSWQgPSBzZXR0aW5nc0lkO1xuXHRcdHRoaXMuaXNMb2FkZWQgPSBmYWxzZTtcblx0XHR0aGlzLmhhc0ZpbGVJY29ucyA9IGZhbHNlO1xuXHRcdHRoaXMuaGFzRm9sZGVySWNvbnMgPSBmYWxzZTtcblx0XHR0aGlzLmhpZGVzRXhwbG9yZXJBcnJvd3MgPSBmYWxzZTtcblx0fVxuXG5cdHB1YmxpYyBlbnN1cmVMb2FkZWQodGhlbWVMb2FkZXI6IEZpbGVJY29uVGhlbWVMb2FkZXIpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiAhdGhpcy5pc0xvYWRlZCA/IHRoaXMubG9hZCh0aGVtZUxvYWRlcikgOiBQcm9taXNlLnJlc29sdmUodGhpcy5zdHlsZVNoZWV0Q29udGVudCk7XG5cdH1cblxuXHRwdWJsaWMgcmVsb2FkKHRoZW1lTG9hZGVyOiBGaWxlSWNvblRoZW1lTG9hZGVyKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5sb2FkKHRoZW1lTG9hZGVyKTtcblx0fVxuXG5cdHByaXZhdGUgbG9hZCh0aGVtZUxvYWRlcjogRmlsZUljb25UaGVtZUxvYWRlcik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoZW1lTG9hZGVyLmxvYWQodGhpcyk7XG5cdH1cblxuXHRzdGF0aWMgZnJvbUV4dGVuc2lvblRoZW1lKGljb25UaGVtZTogSVRoZW1lRXh0ZW5zaW9uUG9pbnQsIGljb25UaGVtZUxvY2F0aW9uOiBVUkksIGV4dGVuc2lvbkRhdGE6IEV4dGVuc2lvbkRhdGEpOiBGaWxlSWNvblRoZW1lRGF0YSB7XG5cdFx0Y29uc3QgaWQgPSBleHRlbnNpb25EYXRhLmV4dGVuc2lvbklkICsgJy0nICsgaWNvblRoZW1lLmlkO1xuXHRcdGNvbnN0IGxhYmVsID0gaWNvblRoZW1lLmxhYmVsIHx8IHBhdGhzLmJhc2VuYW1lKGljb25UaGVtZS5wYXRoKTtcblx0XHRjb25zdCBzZXR0aW5nc0lkID0gaWNvblRoZW1lLmlkO1xuXG5cdFx0Y29uc3QgdGhlbWVEYXRhID0gbmV3IEZpbGVJY29uVGhlbWVEYXRhKGlkLCBsYWJlbCwgc2V0dGluZ3NJZCk7XG5cblx0XHR0aGVtZURhdGEuZGVzY3JpcHRpb24gPSBpY29uVGhlbWUuZGVzY3JpcHRpb247XG5cdFx0dGhlbWVEYXRhLmxvY2F0aW9uID0gaWNvblRoZW1lTG9jYXRpb247XG5cdFx0dGhlbWVEYXRhLmV4dGVuc2lvbkRhdGEgPSBleHRlbnNpb25EYXRhO1xuXHRcdHRoZW1lRGF0YS53YXRjaCA9IGljb25UaGVtZS5fd2F0Y2g7XG5cdFx0dGhlbWVEYXRhLmlzTG9hZGVkID0gZmFsc2U7XG5cdFx0cmV0dXJuIHRoZW1lRGF0YTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9ub0ljb25UaGVtZTogRmlsZUljb25UaGVtZURhdGEgfCBudWxsID0gbnVsbDtcblxuXHRzdGF0aWMgZ2V0IG5vSWNvblRoZW1lKCk6IEZpbGVJY29uVGhlbWVEYXRhIHtcblx0XHRsZXQgdGhlbWVEYXRhID0gRmlsZUljb25UaGVtZURhdGEuX25vSWNvblRoZW1lO1xuXHRcdGlmICghdGhlbWVEYXRhKSB7XG5cdFx0XHR0aGVtZURhdGEgPSBGaWxlSWNvblRoZW1lRGF0YS5fbm9JY29uVGhlbWUgPSBuZXcgRmlsZUljb25UaGVtZURhdGEoJycsICcnLCBudWxsKTtcblx0XHRcdHRoZW1lRGF0YS5oYXNGaWxlSWNvbnMgPSBmYWxzZTtcblx0XHRcdHRoZW1lRGF0YS5oYXNGb2xkZXJJY29ucyA9IGZhbHNlO1xuXHRcdFx0dGhlbWVEYXRhLmhpZGVzRXhwbG9yZXJBcnJvd3MgPSBmYWxzZTtcblx0XHRcdHRoZW1lRGF0YS5pc0xvYWRlZCA9IHRydWU7XG5cdFx0XHR0aGVtZURhdGEuZXh0ZW5zaW9uRGF0YSA9IHVuZGVmaW5lZDtcblx0XHRcdHRoZW1lRGF0YS53YXRjaCA9IGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhlbWVEYXRhO1xuXHR9XG5cblx0c3RhdGljIGNyZWF0ZVVubG9hZGVkVGhlbWUoaWQ6IHN0cmluZyk6IEZpbGVJY29uVGhlbWVEYXRhIHtcblx0XHRjb25zdCB0aGVtZURhdGEgPSBuZXcgRmlsZUljb25UaGVtZURhdGEoaWQsICcnLCAnX18nICsgaWQpO1xuXHRcdHRoZW1lRGF0YS5pc0xvYWRlZCA9IGZhbHNlO1xuXHRcdHRoZW1lRGF0YS5oYXNGaWxlSWNvbnMgPSBmYWxzZTtcblx0XHR0aGVtZURhdGEuaGFzRm9sZGVySWNvbnMgPSBmYWxzZTtcblx0XHR0aGVtZURhdGEuaGlkZXNFeHBsb3JlckFycm93cyA9IGZhbHNlO1xuXHRcdHRoZW1lRGF0YS5leHRlbnNpb25EYXRhID0gdW5kZWZpbmVkO1xuXHRcdHRoZW1lRGF0YS53YXRjaCA9IGZhbHNlO1xuXHRcdHJldHVybiB0aGVtZURhdGE7XG5cdH1cblxuXG5cdHN0YXRpYyBmcm9tU3RvcmFnZURhdGEoc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSk6IEZpbGVJY29uVGhlbWVEYXRhIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBpbnB1dCA9IHN0b3JhZ2VTZXJ2aWNlLmdldChGaWxlSWNvblRoZW1lRGF0YS5TVE9SQUdFX0tFWSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUpO1xuXHRcdGlmICghaW5wdXQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBkYXRhID0gSlNPTi5wYXJzZShpbnB1dCk7XG5cdFx0XHRjb25zdCB0aGVtZSA9IG5ldyBGaWxlSWNvblRoZW1lRGF0YSgnJywgJycsIG51bGwpO1xuXHRcdFx0Zm9yIChjb25zdCBrZXkgaW4gZGF0YSkge1xuXHRcdFx0XHRzd2l0Y2ggKGtleSkge1xuXHRcdFx0XHRcdGNhc2UgJ2lkJzpcblx0XHRcdFx0XHRjYXNlICdsYWJlbCc6XG5cdFx0XHRcdFx0Y2FzZSAnZGVzY3JpcHRpb24nOlxuXHRcdFx0XHRcdGNhc2UgJ3NldHRpbmdzSWQnOlxuXHRcdFx0XHRcdGNhc2UgJ3N0eWxlU2hlZXRDb250ZW50Jzpcblx0XHRcdFx0XHRjYXNlICdoYXNGaWxlSWNvbnMnOlxuXHRcdFx0XHRcdGNhc2UgJ2hpZGVzRXhwbG9yZXJBcnJvd3MnOlxuXHRcdFx0XHRcdGNhc2UgJ2hhc0ZvbGRlckljb25zJzpcblx0XHRcdFx0XHRjYXNlICd3YXRjaCc6XG5cdFx0XHRcdFx0XHQodGhlbWUgYXMgYW55KVtrZXldID0gZGF0YVtrZXldO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnbG9jYXRpb24nOlxuXHRcdFx0XHRcdFx0Ly8gaWdub3JlLCBubyBsb25nZXIgcmVzdG9yZVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnZXh0ZW5zaW9uRGF0YSc6XG5cdFx0XHRcdFx0XHR0aGVtZS5leHRlbnNpb25EYXRhID0gRXh0ZW5zaW9uRGF0YS5mcm9tSlNPTk9iamVjdChkYXRhLmV4dGVuc2lvbkRhdGEpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGVtZTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHRvU3RvcmFnZShzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlKSB7XG5cdFx0Y29uc3QgZGF0YSA9IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdGlkOiB0aGlzLmlkLFxuXHRcdFx0bGFiZWw6IHRoaXMubGFiZWwsXG5cdFx0XHRkZXNjcmlwdGlvbjogdGhpcy5kZXNjcmlwdGlvbixcblx0XHRcdHNldHRpbmdzSWQ6IHRoaXMuc2V0dGluZ3NJZCxcblx0XHRcdHN0eWxlU2hlZXRDb250ZW50OiB0aGlzLnN0eWxlU2hlZXRDb250ZW50LFxuXHRcdFx0aGFzRmlsZUljb25zOiB0aGlzLmhhc0ZpbGVJY29ucyxcblx0XHRcdGhhc0ZvbGRlckljb25zOiB0aGlzLmhhc0ZvbGRlckljb25zLFxuXHRcdFx0aGlkZXNFeHBsb3JlckFycm93czogdGhpcy5oaWRlc0V4cGxvcmVyQXJyb3dzLFxuXHRcdFx0ZXh0ZW5zaW9uRGF0YTogRXh0ZW5zaW9uRGF0YS50b0pTT05PYmplY3QodGhpcy5leHRlbnNpb25EYXRhKSxcblx0XHRcdHdhdGNoOiB0aGlzLndhdGNoXG5cdFx0fSk7XG5cdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoRmlsZUljb25UaGVtZURhdGEuU1RPUkFHRV9LRVksIGRhdGEsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJY29uRGVmaW5pdGlvbiB7XG5cdGljb25QYXRoOiBzdHJpbmc7XG5cdGZvbnRDb2xvcjogc3RyaW5nO1xuXHRmb250Q2hhcmFjdGVyOiBzdHJpbmc7XG5cdGZvbnRTaXplOiBzdHJpbmc7XG5cdGZvbnRJZDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgRm9udERlZmluaXRpb24ge1xuXHRpZDogc3RyaW5nO1xuXHR3ZWlnaHQ6IHN0cmluZztcblx0c3R5bGU6IHN0cmluZztcblx0c2l6ZTogc3RyaW5nO1xuXHRzcmM6IHsgcGF0aDogc3RyaW5nOyBmb3JtYXQ6IHN0cmluZyB9W107XG59XG5cbmludGVyZmFjZSBJY29uc0Fzc29jaWF0aW9uIHtcblx0Zm9sZGVyPzogc3RyaW5nO1xuXHRmaWxlPzogc3RyaW5nO1xuXHRmb2xkZXJFeHBhbmRlZD86IHN0cmluZztcblx0cm9vdEZvbGRlcj86IHN0cmluZztcblx0cm9vdEZvbGRlckV4cGFuZGVkPzogc3RyaW5nO1xuXHRyb290Rm9sZGVyTmFtZXM/OiB7IFtmb2xkZXJOYW1lOiBzdHJpbmddOiBzdHJpbmcgfTtcblx0cm9vdEZvbGRlck5hbWVzRXhwYW5kZWQ/OiB7IFtmb2xkZXJOYW1lOiBzdHJpbmddOiBzdHJpbmcgfTtcblx0Zm9sZGVyTmFtZXM/OiB7IFtmb2xkZXJOYW1lOiBzdHJpbmddOiBzdHJpbmcgfTtcblx0Zm9sZGVyTmFtZXNFeHBhbmRlZD86IHsgW2ZvbGRlck5hbWU6IHN0cmluZ106IHN0cmluZyB9O1xuXHRmaWxlRXh0ZW5zaW9ucz86IHsgW2V4dGVuc2lvbjogc3RyaW5nXTogc3RyaW5nIH07XG5cdGZpbGVOYW1lcz86IHsgW2ZpbGVOYW1lOiBzdHJpbmddOiBzdHJpbmcgfTtcblx0bGFuZ3VhZ2VJZHM/OiB7IFtsYW5ndWFnZUlkOiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuaW50ZXJmYWNlIEljb25UaGVtZURvY3VtZW50IGV4dGVuZHMgSWNvbnNBc3NvY2lhdGlvbiB7XG5cdGljb25EZWZpbml0aW9uczogeyBba2V5OiBzdHJpbmddOiBJY29uRGVmaW5pdGlvbiB9O1xuXHRmb250czogRm9udERlZmluaXRpb25bXTtcblx0bGlnaHQ/OiBJY29uc0Fzc29jaWF0aW9uO1xuXHRoaWdoQ29udHJhc3Q/OiBJY29uc0Fzc29jaWF0aW9uO1xuXHRoaWRlc0V4cGxvcmVyQXJyb3dzPzogYm9vbGVhbjtcblx0c2hvd0xhbmd1YWdlTW9kZUljb25zPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVJY29uVGhlbWVMb2FkZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElFeHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2Vcblx0KSB7XG5cdH1cblxuXHRwdWJsaWMgbG9hZChkYXRhOiBGaWxlSWNvblRoZW1lRGF0YSk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCFkYXRhLmxvY2F0aW9uKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGRhdGEuc3R5bGVTaGVldENvbnRlbnQpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5sb2FkSWNvblRoZW1lRG9jdW1lbnQoZGF0YS5sb2NhdGlvbikudGhlbihpY29uVGhlbWVEb2N1bWVudCA9PiB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSB0aGlzLnByb2Nlc3NJY29uVGhlbWVEb2N1bWVudChkYXRhLmlkLCBkYXRhLmxvY2F0aW9uISwgaWNvblRoZW1lRG9jdW1lbnQpO1xuXHRcdFx0ZGF0YS5zdHlsZVNoZWV0Q29udGVudCA9IHJlc3VsdC5jb250ZW50O1xuXHRcdFx0ZGF0YS5oYXNGaWxlSWNvbnMgPSByZXN1bHQuaGFzRmlsZUljb25zO1xuXHRcdFx0ZGF0YS5oYXNGb2xkZXJJY29ucyA9IHJlc3VsdC5oYXNGb2xkZXJJY29ucztcblx0XHRcdGRhdGEuaGlkZXNFeHBsb3JlckFycm93cyA9IHJlc3VsdC5oaWRlc0V4cGxvcmVyQXJyb3dzO1xuXHRcdFx0ZGF0YS5pc0xvYWRlZCA9IHRydWU7XG5cdFx0XHRyZXR1cm4gZGF0YS5zdHlsZVNoZWV0Q29udGVudDtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgbG9hZEljb25UaGVtZURvY3VtZW50KGxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPEljb25UaGVtZURvY3VtZW50PiB7XG5cdFx0cmV0dXJuIHRoaXMuZmlsZVNlcnZpY2UucmVhZEV4dGVuc2lvblJlc291cmNlKGxvY2F0aW9uKS50aGVuKChjb250ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBlcnJvcnM6IEpzb24uUGFyc2VFcnJvcltdID0gW107XG5cdFx0XHRjb25zdCBjb250ZW50VmFsdWUgPSBKc29uLnBhcnNlKGNvbnRlbnQsIGVycm9ycyk7XG5cdFx0XHRpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihubHMubG9jYWxpemUoJ2Vycm9yLmNhbm5vdHBhcnNlaWNvbnRoZW1lJywgXCJQcm9ibGVtcyBwYXJzaW5nIGZpbGUgaWNvbnMgZmlsZTogezB9XCIsIGVycm9ycy5tYXAoZSA9PiBnZXRQYXJzZUVycm9yTWVzc2FnZShlLmVycm9yKSkuam9pbignLCAnKSkpKTtcblx0XHRcdH0gZWxzZSBpZiAoSnNvbi5nZXROb2RlVHlwZShjb250ZW50VmFsdWUpICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKG5scy5sb2NhbGl6ZSgnZXJyb3IuaW52YWxpZGZvcm1hdCcsIFwiSW52YWxpZCBmb3JtYXQgZm9yIGZpbGUgaWNvbnMgdGhlbWUgZmlsZTogT2JqZWN0IGV4cGVjdGVkLlwiKSkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShjb250ZW50VmFsdWUpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBwcm9jZXNzSWNvblRoZW1lRG9jdW1lbnQoaWQ6IHN0cmluZywgaWNvblRoZW1lRG9jdW1lbnRMb2NhdGlvbjogVVJJLCBpY29uVGhlbWVEb2N1bWVudDogSWNvblRoZW1lRG9jdW1lbnQpOiB7IGNvbnRlbnQ6IHN0cmluZzsgaGFzRmlsZUljb25zOiBib29sZWFuOyBoYXNGb2xkZXJJY29uczogYm9vbGVhbjsgaGlkZXNFeHBsb3JlckFycm93czogYm9vbGVhbiB9IHtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IHsgY29udGVudDogJycsIGhhc0ZpbGVJY29uczogZmFsc2UsIGhhc0ZvbGRlckljb25zOiBmYWxzZSwgaGlkZXNFeHBsb3JlckFycm93czogISFpY29uVGhlbWVEb2N1bWVudC5oaWRlc0V4cGxvcmVyQXJyb3dzIH07XG5cblx0XHRsZXQgaGFzU3BlY2lmaWNGaWxlSWNvbnMgPSBmYWxzZTtcblxuXHRcdGlmICghaWNvblRoZW1lRG9jdW1lbnQuaWNvbkRlZmluaXRpb25zKSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0XHRjb25zdCBzZWxlY3RvckJ5RGVmaW5pdGlvbklkOiB7IFtkZWY6IHN0cmluZ106IGNzcy5CdWlsZGVyIH0gPSB7fTtcblx0XHRjb25zdCBjb3ZlcmVkTGFuZ3VhZ2VzOiB7IFtsYW5ndWFnZUlkOiBzdHJpbmddOiBib29sZWFuIH0gPSB7fTtcblxuXHRcdGNvbnN0IGljb25UaGVtZURvY3VtZW50TG9jYXRpb25EaXJuYW1lID0gcmVzb3VyY2VzLmRpcm5hbWUoaWNvblRoZW1lRG9jdW1lbnRMb2NhdGlvbik7XG5cdFx0ZnVuY3Rpb24gcmVzb2x2ZVBhdGgocGF0aDogc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gcmVzb3VyY2VzLmpvaW5QYXRoKGljb25UaGVtZURvY3VtZW50TG9jYXRpb25EaXJuYW1lLCBwYXRoKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjb2xsZWN0U2VsZWN0b3JzKGFzc29jaWF0aW9uczogSWNvbnNBc3NvY2lhdGlvbiB8IHVuZGVmaW5lZCwgYmFzZVRoZW1lQ2xhc3NOYW1lPzogY3NzLkNzc0ZyYWdtZW50KSB7XG5cdFx0XHRmdW5jdGlvbiBhZGRTZWxlY3RvcihzZWxlY3RvcjogY3NzLkNzc0ZyYWdtZW50LCBkZWZJZDogc3RyaW5nKSB7XG5cdFx0XHRcdGlmIChkZWZJZCkge1xuXHRcdFx0XHRcdGxldCBsaXN0ID0gc2VsZWN0b3JCeURlZmluaXRpb25JZFtkZWZJZF07XG5cdFx0XHRcdFx0aWYgKCFsaXN0KSB7XG5cdFx0XHRcdFx0XHRsaXN0ID0gc2VsZWN0b3JCeURlZmluaXRpb25JZFtkZWZJZF0gPSBuZXcgY3NzLkJ1aWxkZXIoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bGlzdC5wdXNoKHNlbGVjdG9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYXNzb2NpYXRpb25zKSB7XG5cdFx0XHRcdGxldCBxdWFsaWZpZXIgPSBjc3MuaW5saW5lYC5zaG93LWZpbGUtaWNvbnNgO1xuXHRcdFx0XHRpZiAoYmFzZVRoZW1lQ2xhc3NOYW1lKSB7XG5cdFx0XHRcdFx0cXVhbGlmaWVyID0gY3NzLmlubGluZWAke2Jhc2VUaGVtZUNsYXNzTmFtZX0gJHtxdWFsaWZpZXJ9YDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGV4cGFuZGVkID0gY3NzLmlubGluZWAubW9uYWNvLXRsLXR3aXN0aWUuY29sbGFwc2libGU6bm90KC5jb2xsYXBzZWQpICsgLm1vbmFjby10bC1jb250ZW50c2A7XG5cblx0XHRcdFx0aWYgKGFzc29jaWF0aW9ucy5mb2xkZXIpIHtcblx0XHRcdFx0XHRhZGRTZWxlY3Rvcihjc3MuaW5saW5lYCR7cXVhbGlmaWVyfSAuZm9sZGVyLWljb246OmJlZm9yZWAsIGFzc29jaWF0aW9ucy5mb2xkZXIpO1xuXHRcdFx0XHRcdHJlc3VsdC5oYXNGb2xkZXJJY29ucyA9IHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoYXNzb2NpYXRpb25zLmZvbGRlckV4cGFuZGVkKSB7XG5cdFx0XHRcdFx0YWRkU2VsZWN0b3IoY3NzLmlubGluZWAke3F1YWxpZmllcn0gJHtleHBhbmRlZH0gLmZvbGRlci1pY29uOjpiZWZvcmVgLCBhc3NvY2lhdGlvbnMuZm9sZGVyRXhwYW5kZWQpO1xuXHRcdFx0XHRcdHJlc3VsdC5oYXNGb2xkZXJJY29ucyA9IHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByb290Rm9sZGVyID0gYXNzb2NpYXRpb25zLnJvb3RGb2xkZXIgfHwgYXNzb2NpYXRpb25zLmZvbGRlcjtcblx0XHRcdFx0Y29uc3Qgcm9vdEZvbGRlckV4cGFuZGVkID0gYXNzb2NpYXRpb25zLnJvb3RGb2xkZXJFeHBhbmRlZCB8fCBhc3NvY2lhdGlvbnMuZm9sZGVyRXhwYW5kZWQ7XG5cblx0XHRcdFx0aWYgKHJvb3RGb2xkZXIpIHtcblx0XHRcdFx0XHRhZGRTZWxlY3Rvcihjc3MuaW5saW5lYCR7cXVhbGlmaWVyfSAucm9vdGZvbGRlci1pY29uOjpiZWZvcmVgLCByb290Rm9sZGVyKTtcblx0XHRcdFx0XHRyZXN1bHQuaGFzRm9sZGVySWNvbnMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHJvb3RGb2xkZXJFeHBhbmRlZCkge1xuXHRcdFx0XHRcdGFkZFNlbGVjdG9yKGNzcy5pbmxpbmVgJHtxdWFsaWZpZXJ9ICR7ZXhwYW5kZWR9IC5yb290Zm9sZGVyLWljb246OmJlZm9yZWAsIHJvb3RGb2xkZXJFeHBhbmRlZCk7XG5cdFx0XHRcdFx0cmVzdWx0Lmhhc0ZvbGRlckljb25zID0gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChhc3NvY2lhdGlvbnMuZmlsZSkge1xuXHRcdFx0XHRcdGFkZFNlbGVjdG9yKGNzcy5pbmxpbmVgJHtxdWFsaWZpZXJ9IC5maWxlLWljb246OmJlZm9yZWAsIGFzc29jaWF0aW9ucy5maWxlKTtcblx0XHRcdFx0XHRyZXN1bHQuaGFzRmlsZUljb25zID0gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGZvbGRlck5hbWVzID0gYXNzb2NpYXRpb25zLmZvbGRlck5hbWVzO1xuXHRcdFx0XHRpZiAoZm9sZGVyTmFtZXMpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBmb2xkZXJOYW1lcykge1xuXHRcdFx0XHRcdFx0Y29uc3Qgc2VsZWN0b3JzID0gbmV3IGNzcy5CdWlsZGVyKCk7XG5cdFx0XHRcdFx0XHRjb25zdCBuYW1lID0gaGFuZGxlUGFyZW50Rm9sZGVyKGtleS50b0xvd2VyQ2FzZSgpLCBzZWxlY3RvcnMpO1xuXHRcdFx0XHRcdFx0c2VsZWN0b3JzLnB1c2goY3NzLmlubGluZWAuJHtjbGFzc1NlbGVjdG9yUGFydChuYW1lKX0tbmFtZS1mb2xkZXItaWNvbmApO1xuXHRcdFx0XHRcdFx0YWRkU2VsZWN0b3IoY3NzLmlubGluZWAke3F1YWxpZmllcn0gJHtzZWxlY3RvcnMuam9pbignJyl9LmZvbGRlci1pY29uOjpiZWZvcmVgLCBmb2xkZXJOYW1lc1trZXldKTtcblx0XHRcdFx0XHRcdHJlc3VsdC5oYXNGb2xkZXJJY29ucyA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGZvbGRlck5hbWVzRXhwYW5kZWQgPSBhc3NvY2lhdGlvbnMuZm9sZGVyTmFtZXNFeHBhbmRlZDtcblx0XHRcdFx0aWYgKGZvbGRlck5hbWVzRXhwYW5kZWQpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBmb2xkZXJOYW1lc0V4cGFuZGVkKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBzZWxlY3RvcnMgPSBuZXcgY3NzLkJ1aWxkZXIoKTtcblx0XHRcdFx0XHRcdGNvbnN0IG5hbWUgPSBoYW5kbGVQYXJlbnRGb2xkZXIoa2V5LnRvTG93ZXJDYXNlKCksIHNlbGVjdG9ycyk7XG5cdFx0XHRcdFx0XHRzZWxlY3RvcnMucHVzaChjc3MuaW5saW5lYC4ke2NsYXNzU2VsZWN0b3JQYXJ0KG5hbWUpfS1uYW1lLWZvbGRlci1pY29uYCk7XG5cdFx0XHRcdFx0XHRhZGRTZWxlY3Rvcihjc3MuaW5saW5lYCR7cXVhbGlmaWVyfSAke2V4cGFuZGVkfSAke3NlbGVjdG9ycy5qb2luKCcnKX0uZm9sZGVyLWljb246OmJlZm9yZWAsIGZvbGRlck5hbWVzRXhwYW5kZWRba2V5XSk7XG5cdFx0XHRcdFx0XHRyZXN1bHQuaGFzRm9sZGVySWNvbnMgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHJvb3RGb2xkZXJOYW1lcyA9IGFzc29jaWF0aW9ucy5yb290Rm9sZGVyTmFtZXM7XG5cdFx0XHRcdGlmIChyb290Rm9sZGVyTmFtZXMpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGtleSBpbiByb290Rm9sZGVyTmFtZXMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG5hbWUgPSBrZXkudG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0XHRcdGFkZFNlbGVjdG9yKGNzcy5pbmxpbmVgJHtxdWFsaWZpZXJ9IC4ke2NsYXNzU2VsZWN0b3JQYXJ0KG5hbWUpfS1yb290LW5hbWUtZm9sZGVyLWljb24ucm9vdGZvbGRlci1pY29uOjpiZWZvcmVgLCByb290Rm9sZGVyTmFtZXNba2V5XSk7XG5cdFx0XHRcdFx0XHRyZXN1bHQuaGFzRm9sZGVySWNvbnMgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCByb290Rm9sZGVyTmFtZXNFeHBhbmRlZCA9IGFzc29jaWF0aW9ucy5yb290Rm9sZGVyTmFtZXNFeHBhbmRlZDtcblx0XHRcdFx0aWYgKHJvb3RGb2xkZXJOYW1lc0V4cGFuZGVkKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBrZXkgaW4gcm9vdEZvbGRlck5hbWVzRXhwYW5kZWQpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG5hbWUgPSBrZXkudG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0XHRcdGFkZFNlbGVjdG9yKGNzcy5pbmxpbmVgJHtxdWFsaWZpZXJ9ICR7ZXhwYW5kZWR9IC4ke2NsYXNzU2VsZWN0b3JQYXJ0KG5hbWUpfS1yb290LW5hbWUtZm9sZGVyLWljb24ucm9vdGZvbGRlci1pY29uOjpiZWZvcmVgLCByb290Rm9sZGVyTmFtZXNFeHBhbmRlZFtrZXldKTtcblx0XHRcdFx0XHRcdHJlc3VsdC5oYXNGb2xkZXJJY29ucyA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgbGFuZ3VhZ2VJZHMgPSBhc3NvY2lhdGlvbnMubGFuZ3VhZ2VJZHM7XG5cdFx0XHRcdGlmIChsYW5ndWFnZUlkcykge1xuXHRcdFx0XHRcdGlmICghbGFuZ3VhZ2VJZHMuanNvbmMgJiYgbGFuZ3VhZ2VJZHMuanNvbikge1xuXHRcdFx0XHRcdFx0bGFuZ3VhZ2VJZHMuanNvbmMgPSBsYW5ndWFnZUlkcy5qc29uO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmb3IgKGNvbnN0IGxhbmd1YWdlSWQgaW4gbGFuZ3VhZ2VJZHMpIHtcblx0XHRcdFx0XHRcdGFkZFNlbGVjdG9yKGNzcy5pbmxpbmVgJHtxdWFsaWZpZXJ9IC4ke2NsYXNzU2VsZWN0b3JQYXJ0KGxhbmd1YWdlSWQpfS1sYW5nLWZpbGUtaWNvbi5maWxlLWljb246OmJlZm9yZWAsIGxhbmd1YWdlSWRzW2xhbmd1YWdlSWRdKTtcblx0XHRcdFx0XHRcdHJlc3VsdC5oYXNGaWxlSWNvbnMgPSB0cnVlO1xuXHRcdFx0XHRcdFx0aGFzU3BlY2lmaWNGaWxlSWNvbnMgPSB0cnVlO1xuXHRcdFx0XHRcdFx0Y292ZXJlZExhbmd1YWdlc1tsYW5ndWFnZUlkXSA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGZpbGVFeHRlbnNpb25zID0gYXNzb2NpYXRpb25zLmZpbGVFeHRlbnNpb25zO1xuXHRcdFx0XHRpZiAoZmlsZUV4dGVuc2lvbnMpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBmaWxlRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRcdFx0Y29uc3Qgc2VsZWN0b3JzID0gbmV3IGNzcy5CdWlsZGVyKCk7XG5cdFx0XHRcdFx0XHRjb25zdCBuYW1lID0gaGFuZGxlUGFyZW50Rm9sZGVyKGtleS50b0xvd2VyQ2FzZSgpLCBzZWxlY3RvcnMpO1xuXHRcdFx0XHRcdFx0Y29uc3Qgc2VnbWVudHMgPSBuYW1lLnNwbGl0KCcuJyk7XG5cdFx0XHRcdFx0XHRpZiAoc2VnbWVudHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc2VnbWVudHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdFx0XHRzZWxlY3RvcnMucHVzaChjc3MuaW5saW5lYC4ke2NsYXNzU2VsZWN0b3JQYXJ0KHNlZ21lbnRzLnNsaWNlKGkpLmpvaW4oJy4nKSl9LWV4dC1maWxlLWljb25gKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRzZWxlY3RvcnMucHVzaChjc3MuaW5saW5lYC5leHQtZmlsZS1pY29uYCk7IC8vIGV4dHJhIHNlZ21lbnQgdG8gaW5jcmVhc2UgZmlsZS1leHQgc2NvcmVcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGFkZFNlbGVjdG9yKGNzcy5pbmxpbmVgJHtxdWFsaWZpZXJ9ICR7c2VsZWN0b3JzLmpvaW4oJycpfS5maWxlLWljb246OmJlZm9yZWAsIGZpbGVFeHRlbnNpb25zW2tleV0pO1xuXHRcdFx0XHRcdFx0cmVzdWx0Lmhhc0ZpbGVJY29ucyA9IHRydWU7XG5cdFx0XHRcdFx0XHRoYXNTcGVjaWZpY0ZpbGVJY29ucyA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGZpbGVOYW1lcyA9IGFzc29jaWF0aW9ucy5maWxlTmFtZXM7XG5cdFx0XHRcdGlmIChmaWxlTmFtZXMpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBmaWxlTmFtZXMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHNlbGVjdG9ycyA9IG5ldyBjc3MuQnVpbGRlcigpO1xuXHRcdFx0XHRcdFx0Y29uc3QgZmlsZU5hbWUgPSBoYW5kbGVQYXJlbnRGb2xkZXIoa2V5LnRvTG93ZXJDYXNlKCksIHNlbGVjdG9ycyk7XG5cdFx0XHRcdFx0XHRzZWxlY3RvcnMucHVzaChjc3MuaW5saW5lYC4ke2NsYXNzU2VsZWN0b3JQYXJ0KGZpbGVOYW1lKX0tbmFtZS1maWxlLWljb25gKTtcblx0XHRcdFx0XHRcdHNlbGVjdG9ycy5wdXNoKGNzcy5pbmxpbmVgLm5hbWUtZmlsZS1pY29uYCk7IC8vIGV4dHJhIHNlZ21lbnQgdG8gaW5jcmVhc2UgZmlsZS1uYW1lIHNjb3JlXG5cdFx0XHRcdFx0XHRjb25zdCBzZWdtZW50cyA9IGZpbGVOYW1lLnNwbGl0KCcuJyk7XG5cdFx0XHRcdFx0XHRpZiAoc2VnbWVudHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRcdGZvciAobGV0IGkgPSAxOyBpIDwgc2VnbWVudHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdFx0XHRzZWxlY3RvcnMucHVzaChjc3MuaW5saW5lYC4ke2NsYXNzU2VsZWN0b3JQYXJ0KHNlZ21lbnRzLnNsaWNlKGkpLmpvaW4oJy4nKSl9LWV4dC1maWxlLWljb25gKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRzZWxlY3RvcnMucHVzaChjc3MuaW5saW5lYC5leHQtZmlsZS1pY29uYCk7IC8vIGV4dHJhIHNlZ21lbnQgdG8gaW5jcmVhc2UgZmlsZS1leHQgc2NvcmVcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGFkZFNlbGVjdG9yKGNzcy5pbmxpbmVgJHtxdWFsaWZpZXJ9ICR7c2VsZWN0b3JzLmpvaW4oJycpfS5maWxlLWljb246OmJlZm9yZWAsIGZpbGVOYW1lc1trZXldKTtcblx0XHRcdFx0XHRcdHJlc3VsdC5oYXNGaWxlSWNvbnMgPSB0cnVlO1xuXHRcdFx0XHRcdFx0aGFzU3BlY2lmaWNGaWxlSWNvbnMgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRjb2xsZWN0U2VsZWN0b3JzKGljb25UaGVtZURvY3VtZW50KTtcblx0XHRjb2xsZWN0U2VsZWN0b3JzKGljb25UaGVtZURvY3VtZW50LmxpZ2h0LCBjc3MuaW5saW5lYC52c2ApO1xuXHRcdGNvbGxlY3RTZWxlY3RvcnMoaWNvblRoZW1lRG9jdW1lbnQuaGlnaENvbnRyYXN0LCBjc3MuaW5saW5lYC5oYy1ibGFja2ApO1xuXHRcdGNvbGxlY3RTZWxlY3RvcnMoaWNvblRoZW1lRG9jdW1lbnQuaGlnaENvbnRyYXN0LCBjc3MuaW5saW5lYC5oYy1saWdodGApO1xuXG5cdFx0aWYgKCFyZXN1bHQuaGFzRmlsZUljb25zICYmICFyZXN1bHQuaGFzRm9sZGVySWNvbnMpIHtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2hvd0xhbmd1YWdlTW9kZUljb25zID0gaWNvblRoZW1lRG9jdW1lbnQuc2hvd0xhbmd1YWdlTW9kZUljb25zID09PSB0cnVlIHx8IChoYXNTcGVjaWZpY0ZpbGVJY29ucyAmJiBpY29uVGhlbWVEb2N1bWVudC5zaG93TGFuZ3VhZ2VNb2RlSWNvbnMgIT09IGZhbHNlKTtcblxuXHRcdGNvbnN0IGNzc1J1bGVzID0gbmV3IGNzcy5CdWlsZGVyKCk7XG5cblx0XHRjb25zdCBmb250cyA9IGljb25UaGVtZURvY3VtZW50LmZvbnRzO1xuXHRcdGNvbnN0IGZvbnRTaXplcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoZm9udHMpKSB7XG5cdFx0XHRjb25zdCBkZWZhdWx0Rm9udFNpemUgPSB0aGlzLnRyeU5vcm1hbGl6ZUZvbnRTaXplKGZvbnRzWzBdLnNpemUpIHx8ICcxNTAlJztcblx0XHRcdGZvbnRzLmZvckVhY2goZm9udCA9PiB7XG5cdFx0XHRcdGNvbnN0IGZvbnRTcmNzID0gbmV3IGNzcy5CdWlsZGVyKCk7XG5cdFx0XHRcdGZvbnRTcmNzLnB1c2goLi4uZm9udC5zcmMubWFwKGwgPT4gY3NzLmlubGluZWAke2Nzcy5hc0NTU1VybChyZXNvbHZlUGF0aChsLnBhdGgpKX0gZm9ybWF0KCR7Y3NzLnN0cmluZ1ZhbHVlKGwuZm9ybWF0KX0pYCkpO1xuXHRcdFx0XHRjc3NSdWxlcy5wdXNoKGNzcy5pbmxpbmVgQGZvbnQtZmFjZSB7IHNyYzogJHtmb250U3Jjcy5qb2luKCcsICcpfTsgZm9udC1mYW1pbHk6ICR7Y3NzLnN0cmluZ1ZhbHVlKGZvbnQuaWQpfTsgZm9udC13ZWlnaHQ6ICR7Y3NzLmlkZW50VmFsdWUoZm9udC53ZWlnaHQpfTsgZm9udC1zdHlsZTogJHtjc3MuaWRlbnRWYWx1ZShmb250LnN0eWxlKX07IGZvbnQtZGlzcGxheTogYmxvY2s7IH1gKTtcblxuXHRcdFx0XHRjb25zdCBmb250U2l6ZSA9IHRoaXMudHJ5Tm9ybWFsaXplRm9udFNpemUoZm9udC5zaXplKTtcblx0XHRcdFx0aWYgKGZvbnRTaXplICE9PSB1bmRlZmluZWQgJiYgZm9udFNpemUgIT09IGRlZmF1bHRGb250U2l6ZSkge1xuXHRcdFx0XHRcdGZvbnRTaXplcy5zZXQoZm9udC5pZCwgZm9udFNpemUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGNzc1J1bGVzLnB1c2goY3NzLmlubGluZWAuc2hvdy1maWxlLWljb25zIC5maWxlLWljb246OmJlZm9yZSwgLnNob3ctZmlsZS1pY29ucyAuZm9sZGVyLWljb246OmJlZm9yZSwgLnNob3ctZmlsZS1pY29ucyAucm9vdGZvbGRlci1pY29uOjpiZWZvcmUgeyBmb250LWZhbWlseTogJHtjc3Muc3RyaW5nVmFsdWUoZm9udHNbMF0uaWQpfTsgZm9udC1zaXplOiAke2Nzcy5zaXplVmFsdWUoZGVmYXVsdEZvbnRTaXplKX07IH1gKTtcblx0XHR9XG5cblx0XHQvLyBVc2UgZW1RdWFkcyB0byBwcmV2ZW50IHRoZSBpY29uIGZyb20gY29sbGFwc2luZyB0byB6ZXJvIGhlaWdodCBmb3IgaW1hZ2UgaWNvbnNcblx0XHRjb25zdCBlbVF1YWQgPSBjc3Muc3RyaW5nVmFsdWUoJ1xcXFwyMDAxJyk7XG5cblx0XHRmb3IgKGNvbnN0IGRlZklkIGluIHNlbGVjdG9yQnlEZWZpbml0aW9uSWQpIHtcblx0XHRcdGNvbnN0IHNlbGVjdG9ycyA9IHNlbGVjdG9yQnlEZWZpbml0aW9uSWRbZGVmSWRdO1xuXHRcdFx0Y29uc3QgZGVmaW5pdGlvbiA9IGljb25UaGVtZURvY3VtZW50Lmljb25EZWZpbml0aW9uc1tkZWZJZF07XG5cdFx0XHRpZiAoZGVmaW5pdGlvbikge1xuXHRcdFx0XHRpZiAoZGVmaW5pdGlvbi5pY29uUGF0aCkge1xuXHRcdFx0XHRcdGNzc1J1bGVzLnB1c2goY3NzLmlubGluZWAke3NlbGVjdG9ycy5qb2luKCcsICcpfSB7IGNvbnRlbnQ6ICR7ZW1RdWFkfTsgYmFja2dyb3VuZC1pbWFnZTogJHtjc3MuYXNDU1NVcmwocmVzb2x2ZVBhdGgoZGVmaW5pdGlvbi5pY29uUGF0aCkpfTsgfWApO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGRlZmluaXRpb24uZm9udENoYXJhY3RlciB8fCBkZWZpbml0aW9uLmZvbnRDb2xvcikge1xuXHRcdFx0XHRcdGNvbnN0IGJvZHkgPSBuZXcgY3NzLkJ1aWxkZXIoKTtcblx0XHRcdFx0XHRpZiAoZGVmaW5pdGlvbi5mb250Q29sb3IgJiYgZGVmaW5pdGlvbi5mb250Q29sb3IubWF0Y2goZm9udENvbG9yUmVnZXgpKSB7XG5cdFx0XHRcdFx0XHRib2R5LnB1c2goY3NzLmlubGluZWBjb2xvcjogJHtjc3MuaGV4Q29sb3JWYWx1ZShkZWZpbml0aW9uLmZvbnRDb2xvcil9O2ApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZGVmaW5pdGlvbi5mb250Q2hhcmFjdGVyKSB7XG5cdFx0XHRcdFx0XHRib2R5LnB1c2goY3NzLmlubGluZWBjb250ZW50OiAke2Nzcy5zdHJpbmdWYWx1ZShkZWZpbml0aW9uLmZvbnRDaGFyYWN0ZXIpfTtgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgZm9udFNpemUgPSBkZWZpbml0aW9uLmZvbnRTaXplID8/IChkZWZpbml0aW9uLmZvbnRJZCA/IGZvbnRTaXplcy5nZXQoZGVmaW5pdGlvbi5mb250SWQpIDogdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRpZiAoZm9udFNpemUgJiYgZm9udFNpemUubWF0Y2goZm9udFNpemVSZWdleCkpIHtcblx0XHRcdFx0XHRcdGJvZHkucHVzaChjc3MuaW5saW5lYGZvbnQtc2l6ZTogJHtjc3Muc2l6ZVZhbHVlKGZvbnRTaXplKX07YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChkZWZpbml0aW9uLmZvbnRJZCkge1xuXHRcdFx0XHRcdFx0Ym9keS5wdXNoKGNzcy5pbmxpbmVgZm9udC1mYW1pbHk6ICR7Y3NzLnN0cmluZ1ZhbHVlKGRlZmluaXRpb24uZm9udElkKX07YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChzaG93TGFuZ3VhZ2VNb2RlSWNvbnMpIHtcblx0XHRcdFx0XHRcdGJvZHkucHVzaChjc3MuaW5saW5lYGJhY2tncm91bmQtaW1hZ2U6IHVuc2V0O2ApOyAvLyBwb3RlbnRpYWxseSBzZXQgYnkgdGhlIGxhbmd1YWdlIGRlZmF1bHRcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y3NzUnVsZXMucHVzaChjc3MuaW5saW5lYCR7c2VsZWN0b3JzLmpvaW4oJywgJyl9IHsgJHtib2R5LmpvaW4oJyAnKX0gfWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHNob3dMYW5ndWFnZU1vZGVJY29ucykge1xuXHRcdFx0Zm9yIChjb25zdCBsYW5ndWFnZUlkIG9mIHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmdldFJlZ2lzdGVyZWRMYW5ndWFnZUlkcygpKSB7XG5cdFx0XHRcdGlmICghY292ZXJlZExhbmd1YWdlc1tsYW5ndWFnZUlkXSkge1xuXHRcdFx0XHRcdGNvbnN0IGljb24gPSB0aGlzLmxhbmd1YWdlU2VydmljZS5nZXRJY29uKGxhbmd1YWdlSWQpO1xuXHRcdFx0XHRcdGlmIChpY29uKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBzZWxlY3RvciA9IGNzcy5pbmxpbmVgLnNob3ctZmlsZS1pY29ucyAuJHtjbGFzc1NlbGVjdG9yUGFydChsYW5ndWFnZUlkKX0tbGFuZy1maWxlLWljb24uZmlsZS1pY29uOjpiZWZvcmVgO1xuXHRcdFx0XHRcdFx0Y3NzUnVsZXMucHVzaChjc3MuaW5saW5lYCR7c2VsZWN0b3J9IHsgY29udGVudDogJHtlbVF1YWR9OyBiYWNrZ3JvdW5kLWltYWdlOiAke2Nzcy5hc0NTU1VybChpY29uLmRhcmspfTsgfWApO1xuXHRcdFx0XHRcdFx0Y3NzUnVsZXMucHVzaChjc3MuaW5saW5lYC52cyAke3NlbGVjdG9yfSB7IGNvbnRlbnQ6ICR7ZW1RdWFkfTsgYmFja2dyb3VuZC1pbWFnZTogJHtjc3MuYXNDU1NVcmwoaWNvbi5saWdodCl9OyB9YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmVzdWx0LmNvbnRlbnQgPSBjc3NSdWxlcy5qb2luKCdcXG4nKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0LyoqXG5cdCAqIFRyeSBjb252ZXJ0aW5nIGFic29sdXRlIGZvbnQgc2l6ZXMgdG8gcmVsYXRpdmUgdmFsdWVzLlxuXHQgKlxuXHQgKiBUaGlzIGFsbG93cyB0aGVtIHRvIGJlIHNjYWxlZCBuaWNlbHkgZGVwZW5kaW5nIG9uIHdoZXJlIHRoZXkgYXJlIHVzZWQuXG5cdCAqL1xuXHRwcml2YXRlIHRyeU5vcm1hbGl6ZUZvbnRTaXplKHNpemU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFzaXplKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlZmF1bHRGb250U2l6ZUluUHggPSAxMztcblxuXHRcdGlmIChzaXplLmVuZHNXaXRoKCdweCcpKSB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IHBhcnNlSW50KHNpemUsIDEwKTtcblx0XHRcdGlmICghaXNOYU4odmFsdWUpKSB7XG5cdFx0XHRcdHJldHVybiBNYXRoLnJvdW5kKCh2YWx1ZSAvIGRlZmF1bHRGb250U2l6ZUluUHgpICogMTAwKSArICclJztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gc2l6ZTtcblx0fVxufVxuXG5mdW5jdGlvbiBoYW5kbGVQYXJlbnRGb2xkZXIoa2V5OiBzdHJpbmcsIHNlbGVjdG9yczogY3NzLkJ1aWxkZXIpOiBzdHJpbmcge1xuXHRjb25zdCBsYXN0SW5kZXhPZlNsYXNoID0ga2V5Lmxhc3RJbmRleE9mKCcvJyk7XG5cdGlmIChsYXN0SW5kZXhPZlNsYXNoID49IDApIHtcblx0XHRjb25zdCBwYXJlbnRGb2xkZXIgPSBrZXkuc3Vic3RyaW5nKDAsIGxhc3RJbmRleE9mU2xhc2gpO1xuXHRcdHNlbGVjdG9ycy5wdXNoKGNzcy5pbmxpbmVgLiR7Y2xhc3NTZWxlY3RvclBhcnQocGFyZW50Rm9sZGVyKX0tbmFtZS1kaXItaWNvbmApO1xuXHRcdHJldHVybiBrZXkuc3Vic3RyaW5nKGxhc3RJbmRleE9mU2xhc2ggKyAxKTtcblx0fVxuXHRyZXR1cm4ga2V5O1xufVxuXG5mdW5jdGlvbiBjbGFzc1NlbGVjdG9yUGFydChzdHI6IHN0cmluZyk6IGNzcy5Dc3NGcmFnbWVudCB7XG5cdHN0ciA9IGZpbGVJY29uU2VsZWN0b3JFc2NhcGUoc3RyKTtcblx0cmV0dXJuIGNzcy5jbGFzc05hbWUoc3RyLCB0cnVlKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFlBQVksU0FBUztBQUNyQixZQUFZLFdBQVc7QUFDdkIsWUFBWSxlQUFlO0FBQzNCLFlBQVksVUFBVTtBQUN0QixTQUFTLHFCQUFvRTtBQUM3RSxTQUFTLDRCQUE0QjtBQUNyQyxTQUEwQixjQUFjLHFCQUFxQjtBQUc3RCxTQUFTLGdCQUFnQixxQkFBcUI7QUFDOUMsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsOEJBQThCO0FBRWhDLE1BQU0scUJBQU4sTUFBTSxtQkFBcUQ7QUFBQSxFQWtCekQsWUFBWSxJQUFZLE9BQWUsWUFBMkI7QUFDekUsU0FBSyxLQUFLO0FBQ1YsU0FBSyxRQUFRO0FBQ2IsU0FBSyxhQUFhO0FBQ2xCLFNBQUssV0FBVztBQUNoQixTQUFLLGVBQWU7QUFDcEIsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSyxzQkFBc0I7QUFBQSxFQUM1QjtBQUFBLEVBRU8sYUFBYSxhQUErRDtBQUNsRixXQUFPLENBQUMsS0FBSyxXQUFXLEtBQUssS0FBSyxXQUFXLElBQUksUUFBUSxRQUFRLEtBQUssaUJBQWlCO0FBQUEsRUFDeEY7QUFBQSxFQUVPLE9BQU8sYUFBK0Q7QUFDNUUsV0FBTyxLQUFLLEtBQUssV0FBVztBQUFBLEVBQzdCO0FBQUEsRUFFUSxLQUFLLGFBQStEO0FBQzNFLFdBQU8sWUFBWSxLQUFLLElBQUk7QUFBQSxFQUM3QjtBQUFBLEVBRUEsT0FBTyxtQkFBbUIsV0FBaUMsbUJBQXdCLGVBQWlE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
