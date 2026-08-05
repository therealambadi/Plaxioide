var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { createMatches } from "../../../../../base/common/filters.js";
import { HighlightedLabel } from "../../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { Range } from "../../../../../editor/common/core/range.js";
import * as dom from "../../../../../base/browser/dom.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { TextModel } from "../../../../../editor/common/model/textModel.js";
import { BulkFileOperations, BulkFileOperationType } from "./bulkEditPreview.js";
import { FileKind } from "../../../../../platform/files/common/files.js";
import { localize } from "../../../../../nls.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IconLabel } from "../../../../../base/browser/ui/iconLabel/iconLabel.js";
import { basename } from "../../../../../base/common/resources.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { compare } from "../../../../../base/common/strings.js";
import { URI } from "../../../../../base/common/uri.js";
import { ResourceFileEdit } from "../../../../../editor/browser/services/bulkEditService.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../../editor/common/languages/modesRegistry.js";
import { SnippetParser } from "../../../../../editor/contrib/snippet/browser/snippetParser.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import * as css from "../../../../../base/browser/cssValue.js";
class CategoryElement {
  constructor(parent, category) {
    this.parent = parent;
    this.category = category;
  }
  isChecked() {
    const model = this.parent;
    let checked = true;
    for (const file of this.category.fileOperations) {
      for (const edit of file.originalEdits.values()) {
        checked = checked && model.checked.isChecked(edit);
      }
    }
    return checked;
  }
  setChecked(value) {
    const model = this.parent;
    for (const file of this.category.fileOperations) {
      for (const edit of file.originalEdits.values()) {
        model.checked.updateChecked(edit, value);
      }
    }
  }
}
class FileElement {
  constructor(parent, edit) {
    this.parent = parent;
    this.edit = edit;
  }
  isChecked() {
    const model = this.parent instanceof CategoryElement ? this.parent.parent : this.parent;
    let checked = true;
    if (this.edit.type === BulkFileOperationType.TextEdit) {
      checked = !this.edit.textEdits.every((edit) => !model.checked.isChecked(edit.textEdit));
    }
    for (const edit of this.edit.originalEdits.values()) {
      if (edit instanceof ResourceFileEdit) {
        checked = checked && model.checked.isChecked(edit);
      }
    }
    if (this.parent instanceof CategoryElement && this.edit.type === BulkFileOperationType.TextEdit) {
      for (const category of model.categories) {
        for (const file of category.fileOperations) {
          if (file.uri.toString() === this.edit.uri.toString()) {
            for (const edit of file.originalEdits.values()) {
              if (edit instanceof ResourceFileEdit) {
                checked = checked && model.checked.isChecked(edit);
              }
            }
          }
        }
      }
    }
    return checked;
  }
  setChecked(value) {
    const model = this.parent instanceof CategoryElement ? this.parent.parent : this.parent;
    for (const edit of this.edit.originalEdits.values()) {
      model.checked.updateChecked(edit, value);
    }
    if (this.parent instanceof CategoryElement && this.edit.type !== BulkFileOperationType.TextEdit) {
      for (const category of model.categories) {
        for (const file of category.fileOperations) {
          if (file.uri.toString() === this.edit.uri.toString()) {
            for (const edit of file.originalEdits.values()) {
              model.checked.updateChecked(edit, value);
            }
          }
        }
      }
    }
  }
  isDisabled() {
    if (this.parent instanceof CategoryElement && this.edit.type === BulkFileOperationType.TextEdit) {
      const model = this.parent.parent;
      let checked = true;
      for (const category of model.categories) {
        for (const file of category.fileOperations) {
          if (file.uri.toString() === this.edit.uri.toString()) {
            for (const edit of file.originalEdits.values()) {
              if (edit instanceof ResourceFileEdit) {
                checked = checked && model.checked.isChecked(edit);
              }
            }
          }
        }
      }
      return !checked;
    }
    return false;
  }
}
class TextEditElement {
  constructor(parent, idx, edit, prefix, selecting, inserting, suffix) {
    this.parent = parent;
    this.idx = idx;
    this.edit = edit;
    this.prefix = prefix;
    this.selecting = selecting;
    this.inserting = inserting;
    this.suffix = suffix;
  }
  isChecked() {
    let model = this.parent.parent;
    if (model instanceof CategoryElement) {
      model = model.parent;
    }
    return model.checked.isChecked(this.edit.textEdit);
  }
  setChecked(value) {
    let model = this.parent.parent;
    if (model instanceof CategoryElement) {
      model = model.parent;
    }
    model.checked.updateChecked(this.edit.textEdit, value);
    if (value) {
      for (const edit of this.parent.edit.originalEdits.values()) {
        if (edit instanceof ResourceFileEdit) {
          model.checked.updateChecked(edit, value);
        }
      }
    }
  }
  isDisabled() {
    return this.parent.isDisabled();
  }
}
let BulkEditDataSource = class {
  constructor(_textModelService, _instantiationService) {
    this._textModelService = _textModelService;
    this._instantiationService = _instantiationService;
    this.groupByFile = true;
  }
  hasChildren(element) {
    if (element instanceof FileElement) {
      return element.edit.textEdits.length > 0;
    }
    if (element instanceof TextEditElement) {
      return false;
    }
    return true;
  }
  async getChildren(element) {
    if (element instanceof BulkFileOperations) {
      return this.groupByFile ? element.fileOperations.map((op) => new FileElement(element, op)) : element.categories.map((cat) => new CategoryElement(element, cat));
    }
    if (element instanceof CategoryElement) {
      return Array.from(element.category.fileOperations, (op) => new FileElement(element, op));
    }
    if (element instanceof FileElement && element.edit.textEdits.length > 0) {
      let textModel;
      let textModelDisposable;
      try {
        const ref = await this._textModelService.createModelReference(element.edit.uri);
        textModel = ref.object.textEditorModel;
        textModelDisposable = ref;
      } catch {
        textModel = this._instantiationService.createInstance(TextModel, "", PLAINTEXT_LANGUAGE_ID, TextModel.DEFAULT_CREATION_OPTIONS, null);
        textModelDisposable = textModel;
      }
      const result = element.edit.textEdits.map((edit, idx) => {
        const range = textModel.validateRange(edit.textEdit.textEdit.range);
        const startTokens = textModel.tokenization.getLineTokens(range.startLineNumber);
        let prefixLen = 23;
        for (let idx2 = startTokens.findTokenIndexAtOffset(range.startColumn - 1) - 1; prefixLen < 50 && idx2 >= 0; idx2--) {
          prefixLen = range.startColumn - startTokens.getStartOffset(idx2);
        }
        const endTokens = textModel.tokenization.getLineTokens(range.endLineNumber);
        let suffixLen = 0;
        for (let idx2 = endTokens.findTokenIndexAtOffset(range.endColumn - 1); suffixLen < 50 && idx2 < endTokens.getCount(); idx2++) {
          suffixLen += endTokens.getEndOffset(idx2) - endTokens.getStartOffset(idx2);
        }
        return new TextEditElement(
          element,
          idx,
          edit,
          textModel.getValueInRange(new Range(range.startLineNumber, range.startColumn - prefixLen, range.startLineNumber, range.startColumn)),
          textModel.getValueInRange(range),
          !edit.textEdit.textEdit.insertAsSnippet ? edit.textEdit.textEdit.text : SnippetParser.asInsertText(edit.textEdit.textEdit.text),
          textModel.getValueInRange(new Range(range.endLineNumber, range.endColumn, range.endLineNumber, range.endColumn + suffixLen))
        );
      });
      textModelDisposable.dispose();
      return result;
    }
    return [];
  }
};
BulkEditDataSource = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, IInstantiationService)
], BulkEditDataSource);
class BulkEditSorter {
  compare(a, b) {
    if (a instanceof FileElement && b instanceof FileElement) {
      return compareBulkFileOperations(a.edit, b.edit);
    }
    if (a instanceof TextEditElement && b instanceof TextEditElement) {
      return Range.compareRangesUsingStarts(a.edit.textEdit.textEdit.range, b.edit.textEdit.textEdit.range);
    }
    return 0;
  }
}
function compareBulkFileOperations(a, b) {
  return compare(a.uri.toString(), b.uri.toString());
}
let BulkEditAccessibilityProvider = class {
  constructor(_labelService) {
    this._labelService = _labelService;
  }
  getWidgetAriaLabel() {
    return localize("bulkEdit", "Bulk Edit");
  }
  getRole(_element) {
    return "checkbox";
  }
  getAriaLabel(element) {
    if (element instanceof FileElement) {
      if (element.edit.textEdits.length > 0) {
        if (element.edit.type & BulkFileOperationType.Rename && element.edit.newUri) {
          return localize(
            "aria.renameAndEdit",
            "Renaming {0} to {1}, also making text edits",
            this._labelService.getUriLabel(element.edit.uri, { relative: true }),
            this._labelService.getUriLabel(element.edit.newUri, { relative: true })
          );
        } else if (element.edit.type & BulkFileOperationType.Create) {
          return localize(
            "aria.createAndEdit",
            "Creating {0}, also making text edits",
            this._labelService.getUriLabel(element.edit.uri, { relative: true })
          );
        } else if (element.edit.type & BulkFileOperationType.Delete) {
          return localize(
            "aria.deleteAndEdit",
            "Deleting {0}, also making text edits",
            this._labelService.getUriLabel(element.edit.uri, { relative: true })
          );
        } else {
          return localize(
            "aria.editOnly",
            "{0}, making text edits",
            this._labelService.getUriLabel(element.edit.uri, { relative: true })
          );
        }
      } else {
        if (element.edit.type & BulkFileOperationType.Rename && element.edit.newUri) {
          return localize(
            "aria.rename",
            "Renaming {0} to {1}",
            this._labelService.getUriLabel(element.edit.uri, { relative: true }),
            this._labelService.getUriLabel(element.edit.newUri, { relative: true })
          );
        } else if (element.edit.type & BulkFileOperationType.Create) {
          return localize(
            "aria.create",
            "Creating {0}",
            this._labelService.getUriLabel(element.edit.uri, { relative: true })
          );
        } else if (element.edit.type & BulkFileOperationType.Delete) {
          return localize(
            "aria.delete",
            "Deleting {0}",
            this._labelService.getUriLabel(element.edit.uri, { relative: true })
          );
        }
      }
    }
    if (element instanceof TextEditElement) {
      if (element.selecting.length > 0 && element.inserting.length > 0) {
        return localize("aria.replace", "line {0}, replacing {1} with {2}", element.edit.textEdit.textEdit.range.startLineNumber, element.selecting, element.inserting);
      } else if (element.selecting.length > 0 && element.inserting.length === 0) {
        return localize("aria.del", "line {0}, removing {1}", element.edit.textEdit.textEdit.range.startLineNumber, element.selecting);
      } else if (element.selecting.length === 0 && element.inserting.length > 0) {
        return localize("aria.insert", "line {0}, inserting {1}", element.edit.textEdit.textEdit.range.startLineNumber, element.selecting);
      }
    }
    return null;
  }
};
BulkEditAccessibilityProvider = __decorateClass([
  __decorateParam(0, ILabelService)
], BulkEditAccessibilityProvider);
class BulkEditIdentityProvider {
  getId(element) {
    if (element instanceof FileElement) {
      return element.edit.uri + (element.parent instanceof CategoryElement ? JSON.stringify(element.parent.category.metadata) : "");
    } else if (element instanceof TextEditElement) {
      return element.parent.edit.uri.toString() + element.idx;
    } else {
      return JSON.stringify(element.category.metadata);
    }
  }
}
class CategoryElementTemplate {
  constructor(container) {
    container.classList.add("category");
    this.icon = document.createElement("div");
    container.appendChild(this.icon);
    this.label = new IconLabel(container);
  }
}
let CategoryElementRenderer = class {
  constructor(_themeService) {
    this._themeService = _themeService;
    this.templateId = CategoryElementRenderer.id;
  }
  renderTemplate(container) {
    return new CategoryElementTemplate(container);
  }
  renderElement(node, _index, template) {
    template.icon.style.setProperty("--background-dark", null);
    template.icon.style.setProperty("--background-light", null);
    template.icon.style.color = "";
    const { metadata } = node.element.category;
    if (ThemeIcon.isThemeIcon(metadata.iconPath)) {
      const className = ThemeIcon.asClassName(metadata.iconPath);
      template.icon.className = className ? `theme-icon ${className}` : "";
      template.icon.style.color = metadata.iconPath.color ? this._themeService.getColorTheme().getColor(metadata.iconPath.color.id)?.toString() ?? "" : "";
    } else if (URI.isUri(metadata.iconPath)) {
      template.icon.className = "uri-icon";
      template.icon.style.setProperty("--background-dark", css.asCSSUrl(metadata.iconPath));
      template.icon.style.setProperty("--background-light", css.asCSSUrl(metadata.iconPath));
    } else if (metadata.iconPath) {
      template.icon.className = "uri-icon";
      template.icon.style.setProperty("--background-dark", css.asCSSUrl(metadata.iconPath.dark));
      template.icon.style.setProperty("--background-light", css.asCSSUrl(metadata.iconPath.light));
    }
    template.label.setLabel(metadata.label, metadata.description, {
      descriptionMatches: createMatches(node.filterData)
    });
  }
  disposeTemplate(template) {
    template.label.dispose();
  }
};
CategoryElementRenderer.id = "CategoryElementRenderer";
CategoryElementRenderer = __decorateClass([
  __decorateParam(0, IThemeService)
], CategoryElementRenderer);
let FileElementTemplate = class {
  constructor(container, resourceLabels, _labelService) {
    this._labelService = _labelService;
    this._disposables = new DisposableStore();
    this._localDisposables = new DisposableStore();
    this._checkbox = document.createElement("input");
    this._checkbox.className = "edit-checkbox";
    this._checkbox.type = "checkbox";
    this._checkbox.setAttribute("role", "checkbox");
    container.appendChild(this._checkbox);
    this._label = resourceLabels.create(container, { supportHighlights: true });
    this._details = document.createElement("span");
    this._details.className = "details";
    container.appendChild(this._details);
  }
  dispose() {
    this._localDisposables.dispose();
    this._disposables.dispose();
    this._label.dispose();
  }
  set(element, score) {
    this._localDisposables.clear();
    this._checkbox.checked = element.isChecked();
    this._checkbox.disabled = element.isDisabled();
    this._localDisposables.add(dom.addDisposableListener(this._checkbox, "change", () => {
      element.setChecked(this._checkbox.checked);
    }));
    if (element.edit.type & BulkFileOperationType.Rename && element.edit.newUri) {
      this._label.setResource({
        resource: element.edit.uri,
        name: localize("rename.label", "{0} \u2192 {1}", this._labelService.getUriLabel(element.edit.uri, { relative: true }), this._labelService.getUriLabel(element.edit.newUri, { relative: true }))
      }, {
        fileDecorations: { colors: true, badges: false }
      });
      this._details.innerText = localize("detail.rename", "(renaming)");
    } else {
      const options = {
        matches: createMatches(score),
        fileKind: FileKind.FILE,
        fileDecorations: { colors: true, badges: false },
        extraClasses: []
      };
      if (element.edit.type & BulkFileOperationType.Create) {
        this._details.innerText = localize("detail.create", "(creating)");
      } else if (element.edit.type & BulkFileOperationType.Delete) {
        this._details.innerText = localize("detail.del", "(deleting)");
        options.extraClasses.push("delete");
      } else {
        this._details.innerText = "";
      }
      this._label.setFile(element.edit.uri, options);
    }
  }
};
FileElementTemplate = __decorateClass([
  __decorateParam(2, ILabelService)
], FileElementTemplate);
let FileElementRenderer = class {
  constructor(_resourceLabels, _labelService) {
    this._resourceLabels = _resourceLabels;
    this._labelService = _labelService;
    this.templateId = FileElementRenderer.id;
  }
  renderTemplate(container) {
    return new FileElementTemplate(container, this._resourceLabels, this._labelService);
  }
  renderElement(node, _index, template) {
    template.set(node.element, node.filterData);
  }
  disposeTemplate(template) {
    template.dispose();
  }
};
FileElementRenderer.id = "FileElementRenderer";
FileElementRenderer = __decorateClass([
  __decorateParam(1, ILabelService)
], FileElementRenderer);
let TextEditElementTemplate = class {
  constructor(container, _themeService) {
    this._themeService = _themeService;
    this._disposables = new DisposableStore();
    this._localDisposables = new DisposableStore();
    container.classList.add("textedit");
    this._checkbox = document.createElement("input");
    this._checkbox.className = "edit-checkbox";
    this._checkbox.type = "checkbox";
    this._checkbox.setAttribute("role", "checkbox");
    container.appendChild(this._checkbox);
    this._icon = document.createElement("div");
    container.appendChild(this._icon);
    this._label = this._disposables.add(new HighlightedLabel(container));
  }
  dispose() {
    this._localDisposables.dispose();
    this._disposables.dispose();
  }
  set(element) {
    this._localDisposables.clear();
    this._localDisposables.add(dom.addDisposableListener(this._checkbox, "change", (e) => {
      element.setChecked(this._checkbox.checked);
      e.preventDefault();
    }));
    if (element.parent.isChecked()) {
      this._checkbox.checked = element.isChecked();
      this._checkbox.disabled = element.isDisabled();
    } else {
      this._checkbox.checked = element.isChecked();
      this._checkbox.disabled = element.isDisabled();
    }
    let value = "";
    value += element.prefix;
    value += element.selecting;
    value += element.inserting;
    value += element.suffix;
    const selectHighlight = { start: element.prefix.length, end: element.prefix.length + element.selecting.length, extraClasses: ["remove"] };
    const insertHighlight = { start: selectHighlight.end, end: selectHighlight.end + element.inserting.length, extraClasses: ["insert"] };
    let title;
    const { metadata } = element.edit.textEdit;
    if (metadata && metadata.description) {
      title = localize("title", "{0} - {1}", metadata.label, metadata.description);
    } else if (metadata) {
      title = metadata.label;
    }
    const iconPath = metadata?.iconPath;
    if (!iconPath) {
      this._icon.style.display = "none";
    } else {
      this._icon.style.display = "block";
      this._icon.style.setProperty("--background-dark", null);
      this._icon.style.setProperty("--background-light", null);
      if (ThemeIcon.isThemeIcon(iconPath)) {
        const className = ThemeIcon.asClassName(iconPath);
        this._icon.className = className ? `theme-icon ${className}` : "";
        this._icon.style.color = iconPath.color ? this._themeService.getColorTheme().getColor(iconPath.color.id)?.toString() ?? "" : "";
      } else if (URI.isUri(iconPath)) {
        this._icon.className = "uri-icon";
        this._icon.style.setProperty("--background-dark", css.asCSSUrl(iconPath));
        this._icon.style.setProperty("--background-light", css.asCSSUrl(iconPath));
      } else {
        this._icon.className = "uri-icon";
        this._icon.style.setProperty("--background-dark", css.asCSSUrl(iconPath.dark));
        this._icon.style.setProperty("--background-light", css.asCSSUrl(iconPath.light));
      }
    }
    this._label.set(value, [selectHighlight, insertHighlight], title, true);
    this._icon.title = title || "";
  }
};
TextEditElementTemplate = __decorateClass([
  __decorateParam(1, IThemeService)
], TextEditElementTemplate);
let TextEditElementRenderer = class {
  constructor(_themeService) {
    this._themeService = _themeService;
    this.templateId = TextEditElementRenderer.id;
  }
  renderTemplate(container) {
    return new TextEditElementTemplate(container, this._themeService);
  }
  renderElement({ element }, _index, template) {
    template.set(element);
  }
  disposeTemplate(_template) {
  }
};
TextEditElementRenderer.id = "TextEditElementRenderer";
TextEditElementRenderer = __decorateClass([
  __decorateParam(0, IThemeService)
], TextEditElementRenderer);
class BulkEditDelegate {
  getHeight() {
    return 23;
  }
  getTemplateId(element) {
    if (element instanceof FileElement) {
      return FileElementRenderer.id;
    } else if (element instanceof TextEditElement) {
      return TextEditElementRenderer.id;
    } else {
      return CategoryElementRenderer.id;
    }
  }
}
class BulkEditNaviLabelProvider {
  getKeyboardNavigationLabel(element) {
    if (element instanceof FileElement) {
      return basename(element.edit.uri);
    } else if (element instanceof CategoryElement) {
      return element.category.metadata.label;
    }
    return void 0;
  }
}
export {
  BulkEditAccessibilityProvider,
  BulkEditDataSource,
  BulkEditDelegate,
  BulkEditIdentityProvider,
  BulkEditNaviLabelProvider,
  BulkEditSorter,
  CategoryElement,
  CategoryElementRenderer,
  FileElement,
  FileElementRenderer,
  TextEditElement,
  TextEditElementRenderer,
  compareBulkFileOperations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9idWxrRWRpdC9icm93c2VyL3ByZXZpZXcvYnVsa0VkaXRUcmVlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSUFzeW5jRGF0YVNvdXJjZSwgSVRyZWVSZW5kZXJlciwgSVRyZWVOb2RlLCBJVHJlZVNvcnRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBGdXp6eVNjb3JlLCBjcmVhdGVNYXRjaGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBJUmVzb3VyY2VMYWJlbCwgUmVzb3VyY2VMYWJlbHMgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBIaWdobGlnaHRlZExhYmVsLCBJSGlnaGxpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hpZ2hsaWdodGVkbGFiZWwvaGlnaGxpZ2h0ZWRMYWJlbC5qcyc7XG5pbXBvcnQgeyBJSWRlbnRpdHlQcm92aWRlciwgSUxpc3RWaXJ0dWFsRGVsZWdhdGUsIElLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IEJ1bGtGaWxlT3BlcmF0aW9ucywgQnVsa0ZpbGVPcGVyYXRpb24sIEJ1bGtGaWxlT3BlcmF0aW9uVHlwZSwgQnVsa1RleHRFZGl0LCBCdWxrQ2F0ZWdvcnkgfSBmcm9tICcuL2J1bGtFZGl0UHJldmlldy5qcyc7XG5pbXBvcnQgeyBGaWxlS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB0eXBlIHsgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IEljb25MYWJlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVsLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBjb21wYXJlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VGaWxlRWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9tb2Rlc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFNuaXBwZXRQYXJzZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldFBhcnNlci5qcyc7XG5pbXBvcnQgeyBBcmlhUm9sZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgKiBhcyBjc3MgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Nzc1ZhbHVlLmpzJztcblxuLy8gLS0tIFZJRVcgTU9ERUxcblxuZXhwb3J0IGludGVyZmFjZSBJQ2hlY2thYmxlIHtcblx0aXNDaGVja2VkKCk6IGJvb2xlYW47XG5cdHNldENoZWNrZWQodmFsdWU6IGJvb2xlYW4pOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgQ2F0ZWdvcnlFbGVtZW50IGltcGxlbWVudHMgSUNoZWNrYWJsZSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgcGFyZW50OiBCdWxrRmlsZU9wZXJhdGlvbnMsXG5cdFx0cmVhZG9ubHkgY2F0ZWdvcnk6IEJ1bGtDYXRlZ29yeVxuXHQpIHsgfVxuXG5cdGlzQ2hlY2tlZCgpOiBib29sZWFuIHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMucGFyZW50O1xuXHRcdGxldCBjaGVja2VkID0gdHJ1ZTtcblx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgdGhpcy5jYXRlZ29yeS5maWxlT3BlcmF0aW9ucykge1xuXHRcdFx0Zm9yIChjb25zdCBlZGl0IG9mIGZpbGUub3JpZ2luYWxFZGl0cy52YWx1ZXMoKSkge1xuXHRcdFx0XHRjaGVja2VkID0gY2hlY2tlZCAmJiBtb2RlbC5jaGVja2VkLmlzQ2hlY2tlZChlZGl0KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGNoZWNrZWQ7XG5cdH1cblxuXHRzZXRDaGVja2VkKHZhbHVlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLnBhcmVudDtcblx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgdGhpcy5jYXRlZ29yeS5maWxlT3BlcmF0aW9ucykge1xuXHRcdFx0Zm9yIChjb25zdCBlZGl0IG9mIGZpbGUub3JpZ2luYWxFZGl0cy52YWx1ZXMoKSkge1xuXHRcdFx0XHRtb2RlbC5jaGVja2VkLnVwZGF0ZUNoZWNrZWQoZWRpdCwgdmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRmlsZUVsZW1lbnQgaW1wbGVtZW50cyBJQ2hlY2thYmxlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBwYXJlbnQ6IENhdGVnb3J5RWxlbWVudCB8IEJ1bGtGaWxlT3BlcmF0aW9ucyxcblx0XHRyZWFkb25seSBlZGl0OiBCdWxrRmlsZU9wZXJhdGlvblxuXHQpIHsgfVxuXG5cdGlzQ2hlY2tlZCgpOiBib29sZWFuIHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMucGFyZW50IGluc3RhbmNlb2YgQ2F0ZWdvcnlFbGVtZW50ID8gdGhpcy5wYXJlbnQucGFyZW50IDogdGhpcy5wYXJlbnQ7XG5cblx0XHRsZXQgY2hlY2tlZCA9IHRydWU7XG5cblx0XHQvLyBvbmx5IHRleHQgZWRpdCBjaGlsZHJlbiAtPiByZWZsZWN0IGNoaWxkcmVuIHN0YXRlXG5cdFx0aWYgKHRoaXMuZWRpdC50eXBlID09PSBCdWxrRmlsZU9wZXJhdGlvblR5cGUuVGV4dEVkaXQpIHtcblx0XHRcdGNoZWNrZWQgPSAhdGhpcy5lZGl0LnRleHRFZGl0cy5ldmVyeShlZGl0ID0+ICFtb2RlbC5jaGVja2VkLmlzQ2hlY2tlZChlZGl0LnRleHRFZGl0KSk7XG5cdFx0fVxuXG5cdFx0Ly8gbXVsdGlwbGUgZmlsZSBlZGl0cyAtPiByZWZsZWN0IHNpbmdsZSBzdGF0ZVxuXHRcdGZvciAoY29uc3QgZWRpdCBvZiB0aGlzLmVkaXQub3JpZ2luYWxFZGl0cy52YWx1ZXMoKSkge1xuXHRcdFx0aWYgKGVkaXQgaW5zdGFuY2VvZiBSZXNvdXJjZUZpbGVFZGl0KSB7XG5cdFx0XHRcdGNoZWNrZWQgPSBjaGVja2VkICYmIG1vZGVsLmNoZWNrZWQuaXNDaGVja2VkKGVkaXQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIG11bHRpcGxlIGNhdGVnb3JpZXMgYW5kIHRleHQgY2hhbmdlIC0+IHJlYWQgYWxsIGVsZW1lbnRzXG5cdFx0aWYgKHRoaXMucGFyZW50IGluc3RhbmNlb2YgQ2F0ZWdvcnlFbGVtZW50ICYmIHRoaXMuZWRpdC50eXBlID09PSBCdWxrRmlsZU9wZXJhdGlvblR5cGUuVGV4dEVkaXQpIHtcblx0XHRcdGZvciAoY29uc3QgY2F0ZWdvcnkgb2YgbW9kZWwuY2F0ZWdvcmllcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgY2F0ZWdvcnkuZmlsZU9wZXJhdGlvbnMpIHtcblx0XHRcdFx0XHRpZiAoZmlsZS51cmkudG9TdHJpbmcoKSA9PT0gdGhpcy5lZGl0LnVyaS50b1N0cmluZygpKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGVkaXQgb2YgZmlsZS5vcmlnaW5hbEVkaXRzLnZhbHVlcygpKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChlZGl0IGluc3RhbmNlb2YgUmVzb3VyY2VGaWxlRWRpdCkge1xuXHRcdFx0XHRcdFx0XHRcdGNoZWNrZWQgPSBjaGVja2VkICYmIG1vZGVsLmNoZWNrZWQuaXNDaGVja2VkKGVkaXQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNoZWNrZWQ7XG5cdH1cblxuXHRzZXRDaGVja2VkKHZhbHVlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLnBhcmVudCBpbnN0YW5jZW9mIENhdGVnb3J5RWxlbWVudCA/IHRoaXMucGFyZW50LnBhcmVudCA6IHRoaXMucGFyZW50O1xuXHRcdGZvciAoY29uc3QgZWRpdCBvZiB0aGlzLmVkaXQub3JpZ2luYWxFZGl0cy52YWx1ZXMoKSkge1xuXHRcdFx0bW9kZWwuY2hlY2tlZC51cGRhdGVDaGVja2VkKGVkaXQsIHZhbHVlKTtcblx0XHR9XG5cblx0XHQvLyBtdWx0aXBsZSBjYXRlZ29yaWVzIGFuZCBmaWxlIGNoYW5nZSAtPiB1cGRhdGUgYWxsIGVsZW1lbnRzXG5cdFx0aWYgKHRoaXMucGFyZW50IGluc3RhbmNlb2YgQ2F0ZWdvcnlFbGVtZW50ICYmIHRoaXMuZWRpdC50eXBlICE9PSBCdWxrRmlsZU9wZXJhdGlvblR5cGUuVGV4dEVkaXQpIHtcblx0XHRcdGZvciAoY29uc3QgY2F0ZWdvcnkgb2YgbW9kZWwuY2F0ZWdvcmllcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgY2F0ZWdvcnkuZmlsZU9wZXJhdGlvbnMpIHtcblx0XHRcdFx0XHRpZiAoZmlsZS51cmkudG9TdHJpbmcoKSA9PT0gdGhpcy5lZGl0LnVyaS50b1N0cmluZygpKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGVkaXQgb2YgZmlsZS5vcmlnaW5hbEVkaXRzLnZhbHVlcygpKSB7XG5cdFx0XHRcdFx0XHRcdG1vZGVsLmNoZWNrZWQudXBkYXRlQ2hlY2tlZChlZGl0LCB2YWx1ZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aXNEaXNhYmxlZCgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5wYXJlbnQgaW5zdGFuY2VvZiBDYXRlZ29yeUVsZW1lbnQgJiYgdGhpcy5lZGl0LnR5cGUgPT09IEJ1bGtGaWxlT3BlcmF0aW9uVHlwZS5UZXh0RWRpdCkge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLnBhcmVudC5wYXJlbnQ7XG5cdFx0XHRsZXQgY2hlY2tlZCA9IHRydWU7XG5cdFx0XHRmb3IgKGNvbnN0IGNhdGVnb3J5IG9mIG1vZGVsLmNhdGVnb3JpZXMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBmaWxlIG9mIGNhdGVnb3J5LmZpbGVPcGVyYXRpb25zKSB7XG5cdFx0XHRcdFx0aWYgKGZpbGUudXJpLnRvU3RyaW5nKCkgPT09IHRoaXMuZWRpdC51cmkudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBlZGl0IG9mIGZpbGUub3JpZ2luYWxFZGl0cy52YWx1ZXMoKSkge1xuXHRcdFx0XHRcdFx0XHRpZiAoZWRpdCBpbnN0YW5jZW9mIFJlc291cmNlRmlsZUVkaXQpIHtcblx0XHRcdFx0XHRcdFx0XHRjaGVja2VkID0gY2hlY2tlZCAmJiBtb2RlbC5jaGVja2VkLmlzQ2hlY2tlZChlZGl0KTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuICFjaGVja2VkO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRleHRFZGl0RWxlbWVudCBpbXBsZW1lbnRzIElDaGVja2FibGUge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHBhcmVudDogRmlsZUVsZW1lbnQsXG5cdFx0cmVhZG9ubHkgaWR4OiBudW1iZXIsXG5cdFx0cmVhZG9ubHkgZWRpdDogQnVsa1RleHRFZGl0LFxuXHRcdHJlYWRvbmx5IHByZWZpeDogc3RyaW5nLCByZWFkb25seSBzZWxlY3Rpbmc6IHN0cmluZywgcmVhZG9ubHkgaW5zZXJ0aW5nOiBzdHJpbmcsIHJlYWRvbmx5IHN1ZmZpeDogc3RyaW5nXG5cdCkgeyB9XG5cblx0aXNDaGVja2VkKCk6IGJvb2xlYW4ge1xuXHRcdGxldCBtb2RlbCA9IHRoaXMucGFyZW50LnBhcmVudDtcblx0XHRpZiAobW9kZWwgaW5zdGFuY2VvZiBDYXRlZ29yeUVsZW1lbnQpIHtcblx0XHRcdG1vZGVsID0gbW9kZWwucGFyZW50O1xuXHRcdH1cblx0XHRyZXR1cm4gbW9kZWwuY2hlY2tlZC5pc0NoZWNrZWQodGhpcy5lZGl0LnRleHRFZGl0KTtcblx0fVxuXG5cdHNldENoZWNrZWQodmFsdWU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRsZXQgbW9kZWwgPSB0aGlzLnBhcmVudC5wYXJlbnQ7XG5cdFx0aWYgKG1vZGVsIGluc3RhbmNlb2YgQ2F0ZWdvcnlFbGVtZW50KSB7XG5cdFx0XHRtb2RlbCA9IG1vZGVsLnBhcmVudDtcblx0XHR9XG5cblx0XHQvLyBjaGVjay91bmNoZWNrIHRoaXMgZWxlbWVudFxuXHRcdG1vZGVsLmNoZWNrZWQudXBkYXRlQ2hlY2tlZCh0aGlzLmVkaXQudGV4dEVkaXQsIHZhbHVlKTtcblxuXHRcdC8vIG1ha2Ugc3VyZSBwYXJlbnQgaXMgY2hlY2tlZCB3aGVuIHRoaXMgZWxlbWVudCBpcyBjaGVja2VkLi4uXG5cdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVkaXQgb2YgdGhpcy5wYXJlbnQuZWRpdC5vcmlnaW5hbEVkaXRzLnZhbHVlcygpKSB7XG5cdFx0XHRcdGlmIChlZGl0IGluc3RhbmNlb2YgUmVzb3VyY2VGaWxlRWRpdCkge1xuXHRcdFx0XHRcdCg8QnVsa0ZpbGVPcGVyYXRpb25zPm1vZGVsKS5jaGVja2VkLnVwZGF0ZUNoZWNrZWQoZWRpdCwgdmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aXNEaXNhYmxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5wYXJlbnQuaXNEaXNhYmxlZCgpO1xuXHR9XG59XG5cbmV4cG9ydCB0eXBlIEJ1bGtFZGl0RWxlbWVudCA9IENhdGVnb3J5RWxlbWVudCB8IEZpbGVFbGVtZW50IHwgVGV4dEVkaXRFbGVtZW50O1xuXG4vLyAtLS0gREFUQSBTT1VSQ0VcblxuZXhwb3J0IGNsYXNzIEJ1bGtFZGl0RGF0YVNvdXJjZSBpbXBsZW1lbnRzIElBc3luY0RhdGFTb3VyY2U8QnVsa0ZpbGVPcGVyYXRpb25zLCBCdWxrRWRpdEVsZW1lbnQ+IHtcblxuXHRwdWJsaWMgZ3JvdXBCeUZpbGU6IGJvb2xlYW4gPSB0cnVlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkgeyB9XG5cblx0aGFzQ2hpbGRyZW4oZWxlbWVudDogQnVsa0ZpbGVPcGVyYXRpb25zIHwgQnVsa0VkaXRFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBGaWxlRWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQuZWRpdC50ZXh0RWRpdHMubGVuZ3RoID4gMDtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBUZXh0RWRpdEVsZW1lbnQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRhc3luYyBnZXRDaGlsZHJlbihlbGVtZW50OiBCdWxrRmlsZU9wZXJhdGlvbnMgfCBCdWxrRWRpdEVsZW1lbnQpOiBQcm9taXNlPEJ1bGtFZGl0RWxlbWVudFtdPiB7XG5cblx0XHQvLyByb290IC0+IGZpbGUvdGV4dCBlZGl0c1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgQnVsa0ZpbGVPcGVyYXRpb25zKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5ncm91cEJ5RmlsZVxuXHRcdFx0XHQ/IGVsZW1lbnQuZmlsZU9wZXJhdGlvbnMubWFwKG9wID0+IG5ldyBGaWxlRWxlbWVudChlbGVtZW50LCBvcCkpXG5cdFx0XHRcdDogZWxlbWVudC5jYXRlZ29yaWVzLm1hcChjYXQgPT4gbmV3IENhdGVnb3J5RWxlbWVudChlbGVtZW50LCBjYXQpKTtcblx0XHR9XG5cblx0XHQvLyBjYXRlZ29yeVxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgQ2F0ZWdvcnlFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gQXJyYXkuZnJvbShlbGVtZW50LmNhdGVnb3J5LmZpbGVPcGVyYXRpb25zLCBvcCA9PiBuZXcgRmlsZUVsZW1lbnQoZWxlbWVudCwgb3ApKTtcblx0XHR9XG5cblx0XHQvLyBmaWxlOiB0ZXh0IGVkaXRcblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEZpbGVFbGVtZW50ICYmIGVsZW1lbnQuZWRpdC50ZXh0RWRpdHMubGVuZ3RoID4gMCkge1xuXHRcdFx0Ly8gY29uc3QgcHJldmlld1VyaSA9IEJ1bGtFZGl0UHJldmlld1Byb3ZpZGVyLmFzUHJldmlld1VyaShlbGVtZW50LmVkaXQucmVzb3VyY2UpO1xuXHRcdFx0bGV0IHRleHRNb2RlbDogSVRleHRNb2RlbDtcblx0XHRcdGxldCB0ZXh0TW9kZWxEaXNwb3NhYmxlOiBJRGlzcG9zYWJsZTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHJlZiA9IGF3YWl0IHRoaXMuX3RleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoZWxlbWVudC5lZGl0LnVyaSk7XG5cdFx0XHRcdHRleHRNb2RlbCA9IHJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsO1xuXHRcdFx0XHR0ZXh0TW9kZWxEaXNwb3NhYmxlID0gcmVmO1xuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdHRleHRNb2RlbCA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRNb2RlbCwgJycsIFBMQUlOVEVYVF9MQU5HVUFHRV9JRCwgVGV4dE1vZGVsLkRFRkFVTFRfQ1JFQVRJT05fT1BUSU9OUywgbnVsbCk7XG5cdFx0XHRcdHRleHRNb2RlbERpc3Bvc2FibGUgPSB0ZXh0TW9kZWw7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IGVsZW1lbnQuZWRpdC50ZXh0RWRpdHMubWFwKChlZGl0LCBpZHgpID0+IHtcblx0XHRcdFx0Y29uc3QgcmFuZ2UgPSB0ZXh0TW9kZWwudmFsaWRhdGVSYW5nZShlZGl0LnRleHRFZGl0LnRleHRFZGl0LnJhbmdlKTtcblxuXHRcdFx0XHQvL3ByZWZpeC1tYXRoXG5cdFx0XHRcdGNvbnN0IHN0YXJ0VG9rZW5zID0gdGV4dE1vZGVsLnRva2VuaXphdGlvbi5nZXRMaW5lVG9rZW5zKHJhbmdlLnN0YXJ0TGluZU51bWJlcik7XG5cdFx0XHRcdGxldCBwcmVmaXhMZW4gPSAyMzsgLy8gZGVmYXVsdCB2YWx1ZSBmb3IgdGhlIG5vIHRva2Vucy9ncmFtbWFyIGNhc2Vcblx0XHRcdFx0Zm9yIChsZXQgaWR4ID0gc3RhcnRUb2tlbnMuZmluZFRva2VuSW5kZXhBdE9mZnNldChyYW5nZS5zdGFydENvbHVtbiAtIDEpIC0gMTsgcHJlZml4TGVuIDwgNTAgJiYgaWR4ID49IDA7IGlkeC0tKSB7XG5cdFx0XHRcdFx0cHJlZml4TGVuID0gcmFuZ2Uuc3RhcnRDb2x1bW4gLSBzdGFydFRva2Vucy5nZXRTdGFydE9mZnNldChpZHgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9zdWZmaXgtbWF0aFxuXHRcdFx0XHRjb25zdCBlbmRUb2tlbnMgPSB0ZXh0TW9kZWwudG9rZW5pemF0aW9uLmdldExpbmVUb2tlbnMocmFuZ2UuZW5kTGluZU51bWJlcik7XG5cdFx0XHRcdGxldCBzdWZmaXhMZW4gPSAwO1xuXHRcdFx0XHRmb3IgKGxldCBpZHggPSBlbmRUb2tlbnMuZmluZFRva2VuSW5kZXhBdE9mZnNldChyYW5nZS5lbmRDb2x1bW4gLSAxKTsgc3VmZml4TGVuIDwgNTAgJiYgaWR4IDwgZW5kVG9rZW5zLmdldENvdW50KCk7IGlkeCsrKSB7XG5cdFx0XHRcdFx0c3VmZml4TGVuICs9IGVuZFRva2Vucy5nZXRFbmRPZmZzZXQoaWR4KSAtIGVuZFRva2Vucy5nZXRTdGFydE9mZnNldChpZHgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIG5ldyBUZXh0RWRpdEVsZW1lbnQoXG5cdFx0XHRcdFx0ZWxlbWVudCxcblx0XHRcdFx0XHRpZHgsXG5cdFx0XHRcdFx0ZWRpdCxcblx0XHRcdFx0XHR0ZXh0TW9kZWwuZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZShyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uIC0gcHJlZml4TGVuLCByYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uKSksXG5cdFx0XHRcdFx0dGV4dE1vZGVsLmdldFZhbHVlSW5SYW5nZShyYW5nZSksXG5cdFx0XHRcdFx0IWVkaXQudGV4dEVkaXQudGV4dEVkaXQuaW5zZXJ0QXNTbmlwcGV0ID8gZWRpdC50ZXh0RWRpdC50ZXh0RWRpdC50ZXh0IDogU25pcHBldFBhcnNlci5hc0luc2VydFRleHQoZWRpdC50ZXh0RWRpdC50ZXh0RWRpdC50ZXh0KSxcblx0XHRcdFx0XHR0ZXh0TW9kZWwuZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZShyYW5nZS5lbmRMaW5lTnVtYmVyLCByYW5nZS5lbmRDb2x1bW4sIHJhbmdlLmVuZExpbmVOdW1iZXIsIHJhbmdlLmVuZENvbHVtbiArIHN1ZmZpeExlbikpXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGV4dE1vZGVsRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblxuXHRcdHJldHVybiBbXTtcblx0fVxufVxuXG5cbmV4cG9ydCBjbGFzcyBCdWxrRWRpdFNvcnRlciBpbXBsZW1lbnRzIElUcmVlU29ydGVyPEJ1bGtFZGl0RWxlbWVudD4ge1xuXG5cdGNvbXBhcmUoYTogQnVsa0VkaXRFbGVtZW50LCBiOiBCdWxrRWRpdEVsZW1lbnQpOiBudW1iZXIge1xuXHRcdGlmIChhIGluc3RhbmNlb2YgRmlsZUVsZW1lbnQgJiYgYiBpbnN0YW5jZW9mIEZpbGVFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gY29tcGFyZUJ1bGtGaWxlT3BlcmF0aW9ucyhhLmVkaXQsIGIuZWRpdCk7XG5cdFx0fVxuXG5cdFx0aWYgKGEgaW5zdGFuY2VvZiBUZXh0RWRpdEVsZW1lbnQgJiYgYiBpbnN0YW5jZW9mIFRleHRFZGl0RWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyhhLmVkaXQudGV4dEVkaXQudGV4dEVkaXQucmFuZ2UsIGIuZWRpdC50ZXh0RWRpdC50ZXh0RWRpdC5yYW5nZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIDA7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBhcmVCdWxrRmlsZU9wZXJhdGlvbnMoYTogQnVsa0ZpbGVPcGVyYXRpb24sIGI6IEJ1bGtGaWxlT3BlcmF0aW9uKTogbnVtYmVyIHtcblx0cmV0dXJuIGNvbXBhcmUoYS51cmkudG9TdHJpbmcoKSwgYi51cmkudG9TdHJpbmcoKSk7XG59XG5cbi8vIC0tLSBBQ0NFU1NJXG5cbmV4cG9ydCBjbGFzcyBCdWxrRWRpdEFjY2Vzc2liaWxpdHlQcm92aWRlciBpbXBsZW1lbnRzIElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPEJ1bGtFZGl0RWxlbWVudD4ge1xuXG5cdGNvbnN0cnVjdG9yKEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSkgeyB9XG5cblx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdidWxrRWRpdCcsIFwiQnVsayBFZGl0XCIpO1xuXHR9XG5cblx0Z2V0Um9sZShfZWxlbWVudDogQnVsa0VkaXRFbGVtZW50KTogQXJpYVJvbGUge1xuXHRcdHJldHVybiAnY2hlY2tib3gnO1xuXHR9XG5cblx0Z2V0QXJpYUxhYmVsKGVsZW1lbnQ6IEJ1bGtFZGl0RWxlbWVudCk6IHN0cmluZyB8IG51bGwge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgRmlsZUVsZW1lbnQpIHtcblx0XHRcdGlmIChlbGVtZW50LmVkaXQudGV4dEVkaXRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0aWYgKGVsZW1lbnQuZWRpdC50eXBlICYgQnVsa0ZpbGVPcGVyYXRpb25UeXBlLlJlbmFtZSAmJiBlbGVtZW50LmVkaXQubmV3VXJpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKFxuXHRcdFx0XHRcdFx0J2FyaWEucmVuYW1lQW5kRWRpdCcsIFwiUmVuYW1pbmcgezB9IHRvIHsxfSwgYWxzbyBtYWtpbmcgdGV4dCBlZGl0c1wiLFxuXHRcdFx0XHRcdFx0dGhpcy5fbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGVsZW1lbnQuZWRpdC51cmksIHsgcmVsYXRpdmU6IHRydWUgfSksIHRoaXMuX2xhYmVsU2VydmljZS5nZXRVcmlMYWJlbChlbGVtZW50LmVkaXQubmV3VXJpLCB7IHJlbGF0aXZlOiB0cnVlIH0pXG5cdFx0XHRcdFx0KTtcblxuXHRcdFx0XHR9IGVsc2UgaWYgKGVsZW1lbnQuZWRpdC50eXBlICYgQnVsa0ZpbGVPcGVyYXRpb25UeXBlLkNyZWF0ZSkge1xuXHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZShcblx0XHRcdFx0XHRcdCdhcmlhLmNyZWF0ZUFuZEVkaXQnLCBcIkNyZWF0aW5nIHswfSwgYWxzbyBtYWtpbmcgdGV4dCBlZGl0c1wiLFxuXHRcdFx0XHRcdFx0dGhpcy5fbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGVsZW1lbnQuZWRpdC51cmksIHsgcmVsYXRpdmU6IHRydWUgfSlcblx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudC5lZGl0LnR5cGUgJiBCdWxrRmlsZU9wZXJhdGlvblR5cGUuRGVsZXRlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKFxuXHRcdFx0XHRcdFx0J2FyaWEuZGVsZXRlQW5kRWRpdCcsIFwiRGVsZXRpbmcgezB9LCBhbHNvIG1ha2luZyB0ZXh0IGVkaXRzXCIsXG5cdFx0XHRcdFx0XHR0aGlzLl9sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoZWxlbWVudC5lZGl0LnVyaSwgeyByZWxhdGl2ZTogdHJ1ZSB9KSxcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZShcblx0XHRcdFx0XHRcdCdhcmlhLmVkaXRPbmx5JywgXCJ7MH0sIG1ha2luZyB0ZXh0IGVkaXRzXCIsXG5cdFx0XHRcdFx0XHR0aGlzLl9sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoZWxlbWVudC5lZGl0LnVyaSwgeyByZWxhdGl2ZTogdHJ1ZSB9KSxcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChlbGVtZW50LmVkaXQudHlwZSAmIEJ1bGtGaWxlT3BlcmF0aW9uVHlwZS5SZW5hbWUgJiYgZWxlbWVudC5lZGl0Lm5ld1VyaSkge1xuXHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZShcblx0XHRcdFx0XHRcdCdhcmlhLnJlbmFtZScsIFwiUmVuYW1pbmcgezB9IHRvIHsxfVwiLFxuXHRcdFx0XHRcdFx0dGhpcy5fbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGVsZW1lbnQuZWRpdC51cmksIHsgcmVsYXRpdmU6IHRydWUgfSksIHRoaXMuX2xhYmVsU2VydmljZS5nZXRVcmlMYWJlbChlbGVtZW50LmVkaXQubmV3VXJpLCB7IHJlbGF0aXZlOiB0cnVlIH0pXG5cdFx0XHRcdFx0KTtcblxuXHRcdFx0XHR9IGVsc2UgaWYgKGVsZW1lbnQuZWRpdC50eXBlICYgQnVsa0ZpbGVPcGVyYXRpb25UeXBlLkNyZWF0ZSkge1xuXHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZShcblx0XHRcdFx0XHRcdCdhcmlhLmNyZWF0ZScsIFwiQ3JlYXRpbmcgezB9XCIsXG5cdFx0XHRcdFx0XHR0aGlzLl9sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoZWxlbWVudC5lZGl0LnVyaSwgeyByZWxhdGl2ZTogdHJ1ZSB9KVxuXHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0fSBlbHNlIGlmIChlbGVtZW50LmVkaXQudHlwZSAmIEJ1bGtGaWxlT3BlcmF0aW9uVHlwZS5EZWxldGUpIHtcblx0XHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoXG5cdFx0XHRcdFx0XHQnYXJpYS5kZWxldGUnLCBcIkRlbGV0aW5nIHswfVwiLFxuXHRcdFx0XHRcdFx0dGhpcy5fbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGVsZW1lbnQuZWRpdC51cmksIHsgcmVsYXRpdmU6IHRydWUgfSksXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgVGV4dEVkaXRFbGVtZW50KSB7XG5cdFx0XHRpZiAoZWxlbWVudC5zZWxlY3RpbmcubGVuZ3RoID4gMCAmJiBlbGVtZW50Lmluc2VydGluZy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdC8vIGVkaXQ6IHJlcGxhY2Vcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdhcmlhLnJlcGxhY2UnLCBcImxpbmUgezB9LCByZXBsYWNpbmcgezF9IHdpdGggezJ9XCIsIGVsZW1lbnQuZWRpdC50ZXh0RWRpdC50ZXh0RWRpdC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIGVsZW1lbnQuc2VsZWN0aW5nLCBlbGVtZW50Lmluc2VydGluZyk7XG5cdFx0XHR9IGVsc2UgaWYgKGVsZW1lbnQuc2VsZWN0aW5nLmxlbmd0aCA+IDAgJiYgZWxlbWVudC5pbnNlcnRpbmcubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdC8vIGVkaXQ6IGRlbGV0ZVxuXHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ2FyaWEuZGVsJywgXCJsaW5lIHswfSwgcmVtb3ZpbmcgezF9XCIsIGVsZW1lbnQuZWRpdC50ZXh0RWRpdC50ZXh0RWRpdC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIGVsZW1lbnQuc2VsZWN0aW5nKTtcblx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudC5zZWxlY3RpbmcubGVuZ3RoID09PSAwICYmIGVsZW1lbnQuaW5zZXJ0aW5nLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Ly8gZWRpdDogaW5zZXJ0XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgnYXJpYS5pbnNlcnQnLCBcImxpbmUgezB9LCBpbnNlcnRpbmcgezF9XCIsIGVsZW1lbnQuZWRpdC50ZXh0RWRpdC50ZXh0RWRpdC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIGVsZW1lbnQuc2VsZWN0aW5nKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuXG4vLyAtLS0gSURFTlRcblxuZXhwb3J0IGNsYXNzIEJ1bGtFZGl0SWRlbnRpdHlQcm92aWRlciBpbXBsZW1lbnRzIElJZGVudGl0eVByb3ZpZGVyPEJ1bGtFZGl0RWxlbWVudD4ge1xuXG5cdGdldElkKGVsZW1lbnQ6IEJ1bGtFZGl0RWxlbWVudCk6IHsgdG9TdHJpbmcoKTogc3RyaW5nIH0ge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgRmlsZUVsZW1lbnQpIHtcblx0XHRcdHJldHVybiBlbGVtZW50LmVkaXQudXJpICsgKGVsZW1lbnQucGFyZW50IGluc3RhbmNlb2YgQ2F0ZWdvcnlFbGVtZW50ID8gSlNPTi5zdHJpbmdpZnkoZWxlbWVudC5wYXJlbnQuY2F0ZWdvcnkubWV0YWRhdGEpIDogJycpO1xuXHRcdH0gZWxzZSBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFRleHRFZGl0RWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQucGFyZW50LmVkaXQudXJpLnRvU3RyaW5nKCkgKyBlbGVtZW50LmlkeDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KGVsZW1lbnQuY2F0ZWdvcnkubWV0YWRhdGEpO1xuXHRcdH1cblx0fVxufVxuXG4vLyAtLS0gUkVOREVSRVJcblxuY2xhc3MgQ2F0ZWdvcnlFbGVtZW50VGVtcGxhdGUge1xuXG5cdHJlYWRvbmx5IGljb246IEhUTUxEaXZFbGVtZW50O1xuXHRyZWFkb25seSBsYWJlbDogSWNvbkxhYmVsO1xuXG5cdGNvbnN0cnVjdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnY2F0ZWdvcnknKTtcblx0XHR0aGlzLmljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5pY29uKTtcblx0XHR0aGlzLmxhYmVsID0gbmV3IEljb25MYWJlbChjb250YWluZXIpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDYXRlZ29yeUVsZW1lbnRSZW5kZXJlciBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8Q2F0ZWdvcnlFbGVtZW50LCBGdXp6eVNjb3JlLCBDYXRlZ29yeUVsZW1lbnRUZW1wbGF0ZT4ge1xuXG5cdHN0YXRpYyByZWFkb25seSBpZDogc3RyaW5nID0gJ0NhdGVnb3J5RWxlbWVudFJlbmRlcmVyJztcblxuXHRyZWFkb25seSB0ZW1wbGF0ZUlkOiBzdHJpbmcgPSBDYXRlZ29yeUVsZW1lbnRSZW5kZXJlci5pZDtcblxuXHRjb25zdHJ1Y3RvcihASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UpIHsgfVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBDYXRlZ29yeUVsZW1lbnRUZW1wbGF0ZSB7XG5cdFx0cmV0dXJuIG5ldyBDYXRlZ29yeUVsZW1lbnRUZW1wbGF0ZShjb250YWluZXIpO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8Q2F0ZWdvcnlFbGVtZW50LCBGdXp6eVNjb3JlPiwgX2luZGV4OiBudW1iZXIsIHRlbXBsYXRlOiBDYXRlZ29yeUVsZW1lbnRUZW1wbGF0ZSk6IHZvaWQge1xuXG5cdFx0dGVtcGxhdGUuaWNvbi5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1iYWNrZ3JvdW5kLWRhcmsnLCBudWxsKTtcblx0XHR0ZW1wbGF0ZS5pY29uLnN0eWxlLnNldFByb3BlcnR5KCctLWJhY2tncm91bmQtbGlnaHQnLCBudWxsKTtcblx0XHR0ZW1wbGF0ZS5pY29uLnN0eWxlLmNvbG9yID0gJyc7XG5cblx0XHRjb25zdCB7IG1ldGFkYXRhIH0gPSBub2RlLmVsZW1lbnQuY2F0ZWdvcnk7XG5cdFx0aWYgKFRoZW1lSWNvbi5pc1RoZW1lSWNvbihtZXRhZGF0YS5pY29uUGF0aCkpIHtcblx0XHRcdC8vIGNzc1xuXHRcdFx0Y29uc3QgY2xhc3NOYW1lID0gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKG1ldGFkYXRhLmljb25QYXRoKTtcblx0XHRcdHRlbXBsYXRlLmljb24uY2xhc3NOYW1lID0gY2xhc3NOYW1lID8gYHRoZW1lLWljb24gJHtjbGFzc05hbWV9YCA6ICcnO1xuXHRcdFx0dGVtcGxhdGUuaWNvbi5zdHlsZS5jb2xvciA9IG1ldGFkYXRhLmljb25QYXRoLmNvbG9yID8gdGhpcy5fdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKS5nZXRDb2xvcihtZXRhZGF0YS5pY29uUGF0aC5jb2xvci5pZCk/LnRvU3RyaW5nKCkgPz8gJycgOiAnJztcblxuXG5cdFx0fSBlbHNlIGlmIChVUkkuaXNVcmkobWV0YWRhdGEuaWNvblBhdGgpKSB7XG5cdFx0XHQvLyBiYWNrZ3JvdW5kLWltYWdlXG5cdFx0XHR0ZW1wbGF0ZS5pY29uLmNsYXNzTmFtZSA9ICd1cmktaWNvbic7XG5cdFx0XHR0ZW1wbGF0ZS5pY29uLnN0eWxlLnNldFByb3BlcnR5KCctLWJhY2tncm91bmQtZGFyaycsIGNzcy5hc0NTU1VybChtZXRhZGF0YS5pY29uUGF0aCkpO1xuXHRcdFx0dGVtcGxhdGUuaWNvbi5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1iYWNrZ3JvdW5kLWxpZ2h0JywgY3NzLmFzQ1NTVXJsKG1ldGFkYXRhLmljb25QYXRoKSk7XG5cblx0XHR9IGVsc2UgaWYgKG1ldGFkYXRhLmljb25QYXRoKSB7XG5cdFx0XHQvLyBiYWNrZ3JvdW5kLWltYWdlXG5cdFx0XHR0ZW1wbGF0ZS5pY29uLmNsYXNzTmFtZSA9ICd1cmktaWNvbic7XG5cdFx0XHR0ZW1wbGF0ZS5pY29uLnN0eWxlLnNldFByb3BlcnR5KCctLWJhY2tncm91bmQtZGFyaycsIGNzcy5hc0NTU1VybChtZXRhZGF0YS5pY29uUGF0aC5kYXJrKSk7XG5cdFx0XHR0ZW1wbGF0ZS5pY29uLnN0eWxlLnNldFByb3BlcnR5KCctLWJhY2tncm91bmQtbGlnaHQnLCBjc3MuYXNDU1NVcmwobWV0YWRhdGEuaWNvblBhdGgubGlnaHQpKTtcblx0XHR9XG5cblx0XHR0ZW1wbGF0ZS5sYWJlbC5zZXRMYWJlbChtZXRhZGF0YS5sYWJlbCwgbWV0YWRhdGEuZGVzY3JpcHRpb24sIHtcblx0XHRcdGRlc2NyaXB0aW9uTWF0Y2hlczogY3JlYXRlTWF0Y2hlcyhub2RlLmZpbHRlckRhdGEpLFxuXHRcdH0pO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlOiBDYXRlZ29yeUVsZW1lbnRUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlLmxhYmVsLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBGaWxlRWxlbWVudFRlbXBsYXRlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbG9jYWxEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jaGVja2JveDogSFRNTElucHV0RWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfbGFiZWw6IElSZXNvdXJjZUxhYmVsO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZXRhaWxzOiBIVE1MU3BhbkVsZW1lbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRyZXNvdXJjZUxhYmVsczogUmVzb3VyY2VMYWJlbHMsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHQpIHtcblxuXHRcdHRoaXMuX2NoZWNrYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcblx0XHR0aGlzLl9jaGVja2JveC5jbGFzc05hbWUgPSAnZWRpdC1jaGVja2JveCc7XG5cdFx0dGhpcy5fY2hlY2tib3gudHlwZSA9ICdjaGVja2JveCc7XG5cdFx0dGhpcy5fY2hlY2tib3guc2V0QXR0cmlidXRlKCdyb2xlJywgJ2NoZWNrYm94Jyk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2NoZWNrYm94KTtcblxuXHRcdHRoaXMuX2xhYmVsID0gcmVzb3VyY2VMYWJlbHMuY3JlYXRlKGNvbnRhaW5lciwgeyBzdXBwb3J0SGlnaGxpZ2h0czogdHJ1ZSB9KTtcblxuXHRcdHRoaXMuX2RldGFpbHMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0dGhpcy5fZGV0YWlscy5jbGFzc05hbWUgPSAnZGV0YWlscyc7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2RldGFpbHMpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9sb2NhbERpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fbGFiZWwuZGlzcG9zZSgpO1xuXHR9XG5cblx0c2V0KGVsZW1lbnQ6IEZpbGVFbGVtZW50LCBzY29yZTogRnV6enlTY29yZSB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2xvY2FsRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdHRoaXMuX2NoZWNrYm94LmNoZWNrZWQgPSBlbGVtZW50LmlzQ2hlY2tlZCgpO1xuXHRcdHRoaXMuX2NoZWNrYm94LmRpc2FibGVkID0gZWxlbWVudC5pc0Rpc2FibGVkKCk7XG5cdFx0dGhpcy5fbG9jYWxEaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9jaGVja2JveCwgJ2NoYW5nZScsICgpID0+IHtcblx0XHRcdGVsZW1lbnQuc2V0Q2hlY2tlZCh0aGlzLl9jaGVja2JveC5jaGVja2VkKTtcblx0XHR9KSk7XG5cblx0XHRpZiAoZWxlbWVudC5lZGl0LnR5cGUgJiBCdWxrRmlsZU9wZXJhdGlvblR5cGUuUmVuYW1lICYmIGVsZW1lbnQuZWRpdC5uZXdVcmkpIHtcblx0XHRcdC8vIHJlbmFtZTogb2xkTmFtZSBcdTIxOTIgbmV3TmFtZVxuXHRcdFx0dGhpcy5fbGFiZWwuc2V0UmVzb3VyY2Uoe1xuXHRcdFx0XHRyZXNvdXJjZTogZWxlbWVudC5lZGl0LnVyaSxcblx0XHRcdFx0bmFtZTogbG9jYWxpemUoJ3JlbmFtZS5sYWJlbCcsIFwiezB9IFx1MjE5MiB7MX1cIiwgdGhpcy5fbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGVsZW1lbnQuZWRpdC51cmksIHsgcmVsYXRpdmU6IHRydWUgfSksIHRoaXMuX2xhYmVsU2VydmljZS5nZXRVcmlMYWJlbChlbGVtZW50LmVkaXQubmV3VXJpLCB7IHJlbGF0aXZlOiB0cnVlIH0pKSxcblx0XHRcdH0sIHtcblx0XHRcdFx0ZmlsZURlY29yYXRpb25zOiB7IGNvbG9yczogdHJ1ZSwgYmFkZ2VzOiBmYWxzZSB9XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5fZGV0YWlscy5pbm5lclRleHQgPSBsb2NhbGl6ZSgnZGV0YWlsLnJlbmFtZScsIFwiKHJlbmFtaW5nKVwiKTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBjcmVhdGUsIGRlbGV0ZSwgZWRpdDogTkFNRVxuXHRcdFx0Y29uc3Qgb3B0aW9ucyA9IHtcblx0XHRcdFx0bWF0Y2hlczogY3JlYXRlTWF0Y2hlcyhzY29yZSksXG5cdFx0XHRcdGZpbGVLaW5kOiBGaWxlS2luZC5GSUxFLFxuXHRcdFx0XHRmaWxlRGVjb3JhdGlvbnM6IHsgY29sb3JzOiB0cnVlLCBiYWRnZXM6IGZhbHNlIH0sXG5cdFx0XHRcdGV4dHJhQ2xhc3NlczogPHN0cmluZ1tdPltdXG5cdFx0XHR9O1xuXHRcdFx0aWYgKGVsZW1lbnQuZWRpdC50eXBlICYgQnVsa0ZpbGVPcGVyYXRpb25UeXBlLkNyZWF0ZSkge1xuXHRcdFx0XHR0aGlzLl9kZXRhaWxzLmlubmVyVGV4dCA9IGxvY2FsaXplKCdkZXRhaWwuY3JlYXRlJywgXCIoY3JlYXRpbmcpXCIpO1xuXHRcdFx0fSBlbHNlIGlmIChlbGVtZW50LmVkaXQudHlwZSAmIEJ1bGtGaWxlT3BlcmF0aW9uVHlwZS5EZWxldGUpIHtcblx0XHRcdFx0dGhpcy5fZGV0YWlscy5pbm5lclRleHQgPSBsb2NhbGl6ZSgnZGV0YWlsLmRlbCcsIFwiKGRlbGV0aW5nKVwiKTtcblx0XHRcdFx0b3B0aW9ucy5leHRyYUNsYXNzZXMucHVzaCgnZGVsZXRlJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9kZXRhaWxzLmlubmVyVGV4dCA9ICcnO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbGFiZWwuc2V0RmlsZShlbGVtZW50LmVkaXQudXJpLCBvcHRpb25zKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVFbGVtZW50UmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPEZpbGVFbGVtZW50LCBGdXp6eVNjb3JlLCBGaWxlRWxlbWVudFRlbXBsYXRlPiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IGlkOiBzdHJpbmcgPSAnRmlsZUVsZW1lbnRSZW5kZXJlcic7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZDogc3RyaW5nID0gRmlsZUVsZW1lbnRSZW5kZXJlci5pZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9yZXNvdXJjZUxhYmVsczogUmVzb3VyY2VMYWJlbHMsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBGaWxlRWxlbWVudFRlbXBsYXRlIHtcblx0XHRyZXR1cm4gbmV3IEZpbGVFbGVtZW50VGVtcGxhdGUoY29udGFpbmVyLCB0aGlzLl9yZXNvdXJjZUxhYmVscywgdGhpcy5fbGFiZWxTZXJ2aWNlKTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQobm9kZTogSVRyZWVOb2RlPEZpbGVFbGVtZW50LCBGdXp6eVNjb3JlPiwgX2luZGV4OiBudW1iZXIsIHRlbXBsYXRlOiBGaWxlRWxlbWVudFRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGUuc2V0KG5vZGUuZWxlbWVudCwgbm9kZS5maWx0ZXJEYXRhKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZTogRmlsZUVsZW1lbnRUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBUZXh0RWRpdEVsZW1lbnRUZW1wbGF0ZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xvY2FsRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY2hlY2tib3g6IEhUTUxJbnB1dEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2ljb246IEhUTUxEaXZFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sYWJlbDogSGlnaGxpZ2h0ZWRMYWJlbDtcblxuXHRjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UpIHtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgndGV4dGVkaXQnKTtcblxuXHRcdHRoaXMuX2NoZWNrYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcblx0XHR0aGlzLl9jaGVja2JveC5jbGFzc05hbWUgPSAnZWRpdC1jaGVja2JveCc7XG5cdFx0dGhpcy5fY2hlY2tib3gudHlwZSA9ICdjaGVja2JveCc7XG5cdFx0dGhpcy5fY2hlY2tib3guc2V0QXR0cmlidXRlKCdyb2xlJywgJ2NoZWNrYm94Jyk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2NoZWNrYm94KTtcblxuXHRcdHRoaXMuX2ljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5faWNvbik7XG5cblx0XHR0aGlzLl9sYWJlbCA9IHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChuZXcgSGlnaGxpZ2h0ZWRMYWJlbChjb250YWluZXIpKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fbG9jYWxEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0c2V0KGVsZW1lbnQ6IFRleHRFZGl0RWxlbWVudCkge1xuXHRcdHRoaXMuX2xvY2FsRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdHRoaXMuX2xvY2FsRGlzcG9zYWJsZXMuYWRkKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fY2hlY2tib3gsICdjaGFuZ2UnLCBlID0+IHtcblx0XHRcdGVsZW1lbnQuc2V0Q2hlY2tlZCh0aGlzLl9jaGVja2JveC5jaGVja2VkKTtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHR9KSk7XG5cdFx0aWYgKGVsZW1lbnQucGFyZW50LmlzQ2hlY2tlZCgpKSB7XG5cdFx0XHR0aGlzLl9jaGVja2JveC5jaGVja2VkID0gZWxlbWVudC5pc0NoZWNrZWQoKTtcblx0XHRcdHRoaXMuX2NoZWNrYm94LmRpc2FibGVkID0gZWxlbWVudC5pc0Rpc2FibGVkKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2NoZWNrYm94LmNoZWNrZWQgPSBlbGVtZW50LmlzQ2hlY2tlZCgpO1xuXHRcdFx0dGhpcy5fY2hlY2tib3guZGlzYWJsZWQgPSBlbGVtZW50LmlzRGlzYWJsZWQoKTtcblx0XHR9XG5cblx0XHRsZXQgdmFsdWUgPSAnJztcblx0XHR2YWx1ZSArPSBlbGVtZW50LnByZWZpeDtcblx0XHR2YWx1ZSArPSBlbGVtZW50LnNlbGVjdGluZztcblx0XHR2YWx1ZSArPSBlbGVtZW50Lmluc2VydGluZztcblx0XHR2YWx1ZSArPSBlbGVtZW50LnN1ZmZpeDtcblxuXHRcdGNvbnN0IHNlbGVjdEhpZ2hsaWdodDogSUhpZ2hsaWdodCA9IHsgc3RhcnQ6IGVsZW1lbnQucHJlZml4Lmxlbmd0aCwgZW5kOiBlbGVtZW50LnByZWZpeC5sZW5ndGggKyBlbGVtZW50LnNlbGVjdGluZy5sZW5ndGgsIGV4dHJhQ2xhc3NlczogWydyZW1vdmUnXSB9O1xuXHRcdGNvbnN0IGluc2VydEhpZ2hsaWdodDogSUhpZ2hsaWdodCA9IHsgc3RhcnQ6IHNlbGVjdEhpZ2hsaWdodC5lbmQsIGVuZDogc2VsZWN0SGlnaGxpZ2h0LmVuZCArIGVsZW1lbnQuaW5zZXJ0aW5nLmxlbmd0aCwgZXh0cmFDbGFzc2VzOiBbJ2luc2VydCddIH07XG5cblx0XHRsZXQgdGl0bGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCB7IG1ldGFkYXRhIH0gPSBlbGVtZW50LmVkaXQudGV4dEVkaXQ7XG5cdFx0aWYgKG1ldGFkYXRhICYmIG1ldGFkYXRhLmRlc2NyaXB0aW9uKSB7XG5cdFx0XHR0aXRsZSA9IGxvY2FsaXplKCd0aXRsZScsIFwiezB9IC0gezF9XCIsIG1ldGFkYXRhLmxhYmVsLCBtZXRhZGF0YS5kZXNjcmlwdGlvbik7XG5cdFx0fSBlbHNlIGlmIChtZXRhZGF0YSkge1xuXHRcdFx0dGl0bGUgPSBtZXRhZGF0YS5sYWJlbDtcblx0XHR9XG5cblx0XHRjb25zdCBpY29uUGF0aCA9IG1ldGFkYXRhPy5pY29uUGF0aDtcblx0XHRpZiAoIWljb25QYXRoKSB7XG5cdFx0XHR0aGlzLl9pY29uLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2ljb24uc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cblx0XHRcdHRoaXMuX2ljb24uc3R5bGUuc2V0UHJvcGVydHkoJy0tYmFja2dyb3VuZC1kYXJrJywgbnVsbCk7XG5cdFx0XHR0aGlzLl9pY29uLnN0eWxlLnNldFByb3BlcnR5KCctLWJhY2tncm91bmQtbGlnaHQnLCBudWxsKTtcblxuXHRcdFx0aWYgKFRoZW1lSWNvbi5pc1RoZW1lSWNvbihpY29uUGF0aCkpIHtcblx0XHRcdFx0Ly8gY3NzXG5cdFx0XHRcdGNvbnN0IGNsYXNzTmFtZSA9IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShpY29uUGF0aCk7XG5cdFx0XHRcdHRoaXMuX2ljb24uY2xhc3NOYW1lID0gY2xhc3NOYW1lID8gYHRoZW1lLWljb24gJHtjbGFzc05hbWV9YCA6ICcnO1xuXHRcdFx0XHR0aGlzLl9pY29uLnN0eWxlLmNvbG9yID0gaWNvblBhdGguY29sb3IgPyB0aGlzLl90aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLmdldENvbG9yKGljb25QYXRoLmNvbG9yLmlkKT8udG9TdHJpbmcoKSA/PyAnJyA6ICcnO1xuXG5cblx0XHRcdH0gZWxzZSBpZiAoVVJJLmlzVXJpKGljb25QYXRoKSkge1xuXHRcdFx0XHQvLyBiYWNrZ3JvdW5kLWltYWdlXG5cdFx0XHRcdHRoaXMuX2ljb24uY2xhc3NOYW1lID0gJ3VyaS1pY29uJztcblx0XHRcdFx0dGhpcy5faWNvbi5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1iYWNrZ3JvdW5kLWRhcmsnLCBjc3MuYXNDU1NVcmwoaWNvblBhdGgpKTtcblx0XHRcdFx0dGhpcy5faWNvbi5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1iYWNrZ3JvdW5kLWxpZ2h0JywgY3NzLmFzQ1NTVXJsKGljb25QYXRoKSk7XG5cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGJhY2tncm91bmQtaW1hZ2Vcblx0XHRcdFx0dGhpcy5faWNvbi5jbGFzc05hbWUgPSAndXJpLWljb24nO1xuXHRcdFx0XHR0aGlzLl9pY29uLnN0eWxlLnNldFByb3BlcnR5KCctLWJhY2tncm91bmQtZGFyaycsIGNzcy5hc0NTU1VybChpY29uUGF0aC5kYXJrKSk7XG5cdFx0XHRcdHRoaXMuX2ljb24uc3R5bGUuc2V0UHJvcGVydHkoJy0tYmFja2dyb3VuZC1saWdodCcsIGNzcy5hc0NTU1VybChpY29uUGF0aC5saWdodCkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2xhYmVsLnNldCh2YWx1ZSwgW3NlbGVjdEhpZ2hsaWdodCwgaW5zZXJ0SGlnaGxpZ2h0XSwgdGl0bGUsIHRydWUpO1xuXHRcdHRoaXMuX2ljb24udGl0bGUgPSB0aXRsZSB8fCAnJztcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGV4dEVkaXRFbGVtZW50UmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFRleHRFZGl0RWxlbWVudCwgRnV6enlTY29yZSwgVGV4dEVkaXRFbGVtZW50VGVtcGxhdGU+IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgaWQgPSAnVGV4dEVkaXRFbGVtZW50UmVuZGVyZXInO1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZyA9IFRleHRFZGl0RWxlbWVudFJlbmRlcmVyLmlkO1xuXG5cdGNvbnN0cnVjdG9yKEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSkgeyB9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IFRleHRFZGl0RWxlbWVudFRlbXBsYXRlIHtcblx0XHRyZXR1cm4gbmV3IFRleHRFZGl0RWxlbWVudFRlbXBsYXRlKGNvbnRhaW5lciwgdGhpcy5fdGhlbWVTZXJ2aWNlKTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoeyBlbGVtZW50IH06IElUcmVlTm9kZTxUZXh0RWRpdEVsZW1lbnQsIEZ1enp5U2NvcmU+LCBfaW5kZXg6IG51bWJlciwgdGVtcGxhdGU6IFRleHRFZGl0RWxlbWVudFRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGUuc2V0KGVsZW1lbnQpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKF90ZW1wbGF0ZTogVGV4dEVkaXRFbGVtZW50VGVtcGxhdGUpOiB2b2lkIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVsa0VkaXREZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPEJ1bGtFZGl0RWxlbWVudD4ge1xuXG5cdGdldEhlaWdodCgpOiBudW1iZXIge1xuXHRcdHJldHVybiAyMztcblx0fVxuXG5cdGdldFRlbXBsYXRlSWQoZWxlbWVudDogQnVsa0VkaXRFbGVtZW50KTogc3RyaW5nIHtcblxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgRmlsZUVsZW1lbnQpIHtcblx0XHRcdHJldHVybiBGaWxlRWxlbWVudFJlbmRlcmVyLmlkO1xuXHRcdH0gZWxzZSBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFRleHRFZGl0RWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIFRleHRFZGl0RWxlbWVudFJlbmRlcmVyLmlkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gQ2F0ZWdvcnlFbGVtZW50UmVuZGVyZXIuaWQ7XG5cdFx0fVxuXHR9XG59XG5cblxuZXhwb3J0IGNsYXNzIEJ1bGtFZGl0TmF2aUxhYmVsUHJvdmlkZXIgaW1wbGVtZW50cyBJS2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcjxCdWxrRWRpdEVsZW1lbnQ+IHtcblxuXHRnZXRLZXlib2FyZE5hdmlnYXRpb25MYWJlbChlbGVtZW50OiBCdWxrRWRpdEVsZW1lbnQpIHtcblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEZpbGVFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gYmFzZW5hbWUoZWxlbWVudC5lZGl0LnVyaSk7XG5cdFx0fSBlbHNlIGlmIChlbGVtZW50IGluc3RhbmNlb2YgQ2F0ZWdvcnlFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC5jYXRlZ29yeS5tZXRhZGF0YS5sYWJlbDtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFxQixxQkFBcUI7QUFFMUMsU0FBUyx3QkFBb0M7QUFFN0MsU0FBUyxhQUFhO0FBQ3RCLFlBQVksU0FBUztBQUVyQixT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
