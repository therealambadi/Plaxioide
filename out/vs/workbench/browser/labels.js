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
import { localize } from "../../nls.js";
import { URI } from "../../base/common/uri.js";
import { dirname, isEqual, basenameOrAuthority } from "../../base/common/resources.js";
import { IconLabel } from "../../base/browser/ui/iconLabel/iconLabel.js";
import { ILanguageService } from "../../editor/common/languages/language.js";
import { IWorkspaceContextService } from "../../platform/workspace/common/workspace.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { IModelService } from "../../editor/common/services/model.js";
import { ITextFileService } from "../services/textfile/common/textfiles.js";
import { IDecorationsService } from "../services/decorations/common/decorations.js";
import { Schemas } from "../../base/common/network.js";
import { FileKind, FILES_ASSOCIATIONS_CONFIG } from "../../platform/files/common/files.js";
import { IThemeService } from "../../platform/theme/common/themeService.js";
import { Event, Emitter } from "../../base/common/event.js";
import { ILabelService } from "../../platform/label/common/label.js";
import { getIconClasses } from "../../editor/common/services/getIconClasses.js";
import { Disposable, dispose, MutableDisposable } from "../../base/common/lifecycle.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { normalizeDriveLetter } from "../../base/common/labels.js";
import { INotebookDocumentService, extractCellOutputDetails } from "../services/notebook/common/notebookDocumentService.js";
function toResource(props) {
  if (!props || !props.resource) {
    return void 0;
  }
  if (URI.isUri(props.resource)) {
    return props.resource;
  }
  return props.resource.primary;
}
const DEFAULT_LABELS_CONTAINER = {
  onDidChangeVisibility: Event.None
};
let ResourceLabels = class extends Disposable {
  constructor(container, instantiationService, configurationService, modelService, workspaceService, languageService, decorationsService, themeService, labelService, textFileService) {
    super();
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.modelService = modelService;
    this.workspaceService = workspaceService;
    this.languageService = languageService;
    this.decorationsService = decorationsService;
    this.themeService = themeService;
    this.labelService = labelService;
    this.textFileService = textFileService;
    this._onDidChangeDecorations = this._register(new Emitter());
    this.onDidChangeDecorations = this._onDidChangeDecorations.event;
    this.widgets = [];
    this.labels = [];
    this.registerListeners(container);
  }
  registerListeners(container) {
    this._register(container.onDidChangeVisibility((visible) => {
      this.widgets.forEach((widget) => widget.notifyVisibilityChanged(visible));
    }));
    this._register(this.languageService.onDidChange(() => this.widgets.forEach((widget) => widget.notifyExtensionsRegistered())));
    this._register(this.modelService.onModelLanguageChanged((e) => {
      if (!e.model.uri) {
        return;
      }
      this.widgets.forEach((widget) => widget.notifyModelLanguageChanged(e.model));
    }));
    this._register(this.modelService.onModelAdded((model) => {
      if (!model.uri) {
        return;
      }
      this.widgets.forEach((widget) => widget.notifyModelAdded(model));
    }));
    this._register(this.workspaceService.onDidChangeWorkspaceFolders(() => {
      this.widgets.forEach((widget) => widget.notifyWorkspaceFoldersChange());
    }));
    this._register(this.decorationsService.onDidChangeDecorations((e) => {
      let notifyDidChangeDecorations = false;
      this.widgets.forEach((widget) => {
        if (widget.notifyFileDecorationsChanges(e)) {
          notifyDidChangeDecorations = true;
        }
      });
      if (notifyDidChangeDecorations) {
        this._onDidChangeDecorations.fire();
      }
    }));
    this._register(this.themeService.onDidColorThemeChange(() => this.widgets.forEach((widget) => widget.notifyThemeChange())));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(FILES_ASSOCIATIONS_CONFIG)) {
        this.widgets.forEach((widget) => widget.notifyFileAssociationsChange());
      }
    }));
    this._register(this.labelService.onDidChangeFormatters((e) => {
      this.widgets.forEach((widget) => widget.notifyFormattersChange(e.scheme));
    }));
    this._register(this.textFileService.untitled.onDidChangeLabel((model) => {
      this.widgets.forEach((widget) => widget.notifyUntitledLabelChange(model.resource));
    }));
  }
  get(index) {
    return this.labels[index];
  }
  create(container, options) {
    const widget = this.instantiationService.createInstance(ResourceLabelWidget, container, options);
    const label = {
      element: widget.element,
      onDidRender: widget.onDidRender,
      setLabel: (label2, description, options2) => widget.setLabel(label2, description, options2),
      setResource: (label2, options2) => widget.setResource(label2, options2),
      setFile: (resource, options2) => widget.setFile(resource, options2),
      clear: () => widget.clear(),
      dispose: () => this.disposeWidget(widget)
    };
    this.labels.push(label);
    this.widgets.push(widget);
    return label;
  }
  disposeWidget(widget) {
    const index = this.widgets.indexOf(widget);
    if (index > -1) {
      this.widgets.splice(index, 1);
      this.labels.splice(index, 1);
    }
    dispose(widget);
  }
  clear() {
    this.widgets = dispose(this.widgets);
    this.labels = [];
  }
  dispose() {
    super.dispose();
    this.clear();
  }
};
ResourceLabels = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IModelService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, ILanguageService),
  __decorateParam(6, IDecorationsService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, ILabelService),
  __decorateParam(9, ITextFileService)
], ResourceLabels);
let ResourceLabel = class extends ResourceLabels {
  get element() {
    return this.label;
  }
  constructor(container, options, instantiationService, configurationService, modelService, workspaceService, languageService, decorationsService, themeService, labelService, textFileService) {
    super(DEFAULT_LABELS_CONTAINER, instantiationService, configurationService, modelService, workspaceService, languageService, decorationsService, themeService, labelService, textFileService);
    this.label = this._register(this.create(container, options));
  }
};
ResourceLabel = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IModelService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, ILanguageService),
  __decorateParam(7, IDecorationsService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, ITextFileService)
], ResourceLabel);
var Redraw = /* @__PURE__ */ ((Redraw2) => {
  Redraw2[Redraw2["Basic"] = 1] = "Basic";
  Redraw2[Redraw2["Full"] = 2] = "Full";
  return Redraw2;
})(Redraw || {});
let ResourceLabelWidget = class extends IconLabel {
  constructor(container, options, languageService, modelService, decorationsService, labelService, textFileService, contextService, notebookDocumentService) {
    super(container, options);
    this.languageService = languageService;
    this.modelService = modelService;
    this.decorationsService = decorationsService;
    this.labelService = labelService;
    this.textFileService = textFileService;
    this.contextService = contextService;
    this.notebookDocumentService = notebookDocumentService;
    this._onDidRender = this._register(new Emitter());
    this.onDidRender = this._onDidRender.event;
    this.label = void 0;
    this.decoration = this._register(new MutableDisposable());
    this.options = void 0;
    this.computedIconClasses = void 0;
    this.computedLanguageId = void 0;
    this.computedPathLabel = void 0;
    this.computedWorkspaceFolderLabel = void 0;
    this.needsRedraw = void 0;
    this.isHidden = false;
  }
  notifyVisibilityChanged(visible) {
    if (visible === this.isHidden) {
      this.isHidden = !visible;
      if (visible && this.needsRedraw) {
        this.render({
          updateIcon: this.needsRedraw === 2 /* Full */,
          updateDecoration: this.needsRedraw === 2 /* Full */
        });
        this.needsRedraw = void 0;
      }
    }
  }
  notifyModelLanguageChanged(model) {
    this.handleModelEvent(model);
  }
  notifyModelAdded(model) {
    this.handleModelEvent(model);
  }
  handleModelEvent(model) {
    const resource = toResource(this.label);
    if (!resource) {
      return;
    }
    if (isEqual(model.uri, resource)) {
      if (this.computedLanguageId !== model.getLanguageId()) {
        this.computedLanguageId = model.getLanguageId();
        this.render({ updateIcon: true, updateDecoration: false });
      }
    }
  }
  notifyFileDecorationsChanges(e) {
    if (!this.options) {
      return false;
    }
    const resource = toResource(this.label);
    if (!resource) {
      return false;
    }
    if (this.options.fileDecorations && e.affectsResource(resource)) {
      return this.render({ updateIcon: false, updateDecoration: true });
    }
    return false;
  }
  notifyExtensionsRegistered() {
    this.render({ updateIcon: true, updateDecoration: false });
  }
  notifyThemeChange() {
    this.render({ updateIcon: false, updateDecoration: false });
  }
  notifyFileAssociationsChange() {
    this.render({ updateIcon: true, updateDecoration: false });
  }
  notifyFormattersChange(scheme) {
    if (toResource(this.label)?.scheme === scheme) {
      this.render({ updateIcon: false, updateDecoration: false });
    }
  }
  notifyUntitledLabelChange(resource) {
    if (isEqual(resource, toResource(this.label))) {
      this.render({ updateIcon: false, updateDecoration: false });
    }
  }
  notifyWorkspaceFoldersChange() {
    if (typeof this.computedWorkspaceFolderLabel === "string") {
      const resource = toResource(this.label);
      if (URI.isUri(resource) && this.label?.name === this.computedWorkspaceFolderLabel) {
        this.setFile(resource, this.options);
      }
    }
  }
  setFile(resource, options) {
    const hideLabel = options?.hideLabel;
    let name;
    if (!hideLabel) {
      if (options?.fileKind === FileKind.ROOT_FOLDER) {
        const workspaceFolder = this.contextService.getWorkspaceFolder(resource);
        if (workspaceFolder) {
          name = workspaceFolder.name;
          this.computedWorkspaceFolderLabel = name;
        }
      }
      if (!name) {
        name = normalizeDriveLetter(basenameOrAuthority(resource));
      }
    }
    let description;
    if (!options?.hidePath) {
      const descriptionCandidate = this.labelService.getUriLabel(dirname(resource), { relative: true });
      if (descriptionCandidate && descriptionCandidate !== ".") {
        description = descriptionCandidate;
      }
    }
    this.setResource({ resource, name, description, range: options?.range }, options);
  }
  setResource(label, options = /* @__PURE__ */ Object.create(null)) {
    const resource = toResource(label);
    const isSideBySideEditor = label?.resource && !URI.isUri(label.resource);
    if (!options.forceLabel && !isSideBySideEditor && resource?.scheme === Schemas.untitled) {
      const untitledModel = this.textFileService.untitled.get(resource);
      if (untitledModel && !untitledModel.hasAssociatedFilePath) {
        if (typeof label.name === "string") {
          label.name = untitledModel.name;
        }
        if (typeof label.description === "string") {
          const untitledDescription = untitledModel.resource.path;
          if (label.name !== untitledDescription) {
            label.description = untitledDescription;
          } else {
            label.description = void 0;
          }
        }
        const untitledTitle = untitledModel.resource.path;
        if (untitledModel.name !== untitledTitle) {
          options.title = `${untitledModel.name} \u2022 ${untitledTitle}`;
        } else {
          options.title = untitledTitle;
        }
      }
    }
    if (!options.forceLabel && !isSideBySideEditor && resource?.scheme === Schemas.vscodeNotebookCell) {
      const notebookDocument = this.notebookDocumentService.getNotebook(resource);
      const cellIndex = notebookDocument?.getCellIndex(resource);
      if (notebookDocument && cellIndex !== void 0 && typeof label.name === "string") {
        options.title = localize("notebookCellLabel", "{0} \u2022 Cell {1}", label.name, `${cellIndex + 1}`);
      }
      if (typeof label.name === "string" && notebookDocument && cellIndex !== void 0 && typeof label.name === "string") {
        label.name = localize("notebookCellLabel", "{0} \u2022 Cell {1}", label.name, `${cellIndex + 1}`);
      }
    }
    if (!options.forceLabel && !isSideBySideEditor && resource?.scheme === Schemas.vscodeNotebookCellOutput) {
      const notebookDocument = this.notebookDocumentService.getNotebook(resource);
      const outputUriData = extractCellOutputDetails(resource);
      if (outputUriData?.cellFragment) {
        if (!outputUriData.notebook) {
          return;
        }
        const cellUri = outputUriData.notebook.with({
          scheme: Schemas.vscodeNotebookCell,
          fragment: outputUriData.cellFragment
        });
        const cellIndex = notebookDocument?.getCellIndex(cellUri);
        const outputIndex = outputUriData.outputIndex;
        if (cellIndex !== void 0 && outputIndex !== void 0 && typeof label.name === "string") {
          label.name = localize(
            "notebookCellOutputLabel",
            "{0} \u2022 Cell {1} \u2022 Output {2}",
            label.name,
            `${cellIndex + 1}`,
            `${outputIndex + 1}`
          );
        } else if (cellIndex !== void 0 && typeof label.name === "string") {
          label.name = localize(
            "notebookCellOutputLabelSimple",
            "{0} \u2022 Cell {1} \u2022 Output",
            label.name,
            `${cellIndex + 1}`
          );
        }
      }
    }
    const hasResourceChanged = this.hasResourceChanged(label);
    const hasPathLabelChanged = hasResourceChanged || this.hasPathLabelChanged(label);
    const hasFileKindChanged = this.hasFileKindChanged(options);
    const hasIconChanged = this.hasIconChanged(options);
    this.label = label;
    this.options = options;
    if (hasResourceChanged) {
      this.computedLanguageId = void 0;
    }
    if (hasPathLabelChanged) {
      this.computedPathLabel = void 0;
    }
    this.render({
      updateIcon: hasResourceChanged || hasFileKindChanged || hasIconChanged,
      updateDecoration: hasResourceChanged || hasFileKindChanged
    });
  }
  hasFileKindChanged(newOptions) {
    const newFileKind = newOptions?.fileKind;
    const oldFileKind = this.options?.fileKind;
    return newFileKind !== oldFileKind;
  }
  hasResourceChanged(newLabel) {
    const newResource = toResource(newLabel);
    const oldResource = toResource(this.label);
    if (newResource && oldResource) {
      return newResource.toString() !== oldResource.toString();
    }
    if (!newResource && !oldResource) {
      return false;
    }
    return true;
  }
  hasPathLabelChanged(newLabel) {
    const newResource = toResource(newLabel);
    return !!newResource && this.computedPathLabel !== this.labelService.getUriLabel(newResource);
  }
  hasIconChanged(newOptions) {
    return this.options?.icon !== newOptions?.icon;
  }
  clear() {
    this.label = void 0;
    this.options = void 0;
    this.computedLanguageId = void 0;
    this.computedIconClasses = void 0;
    this.computedPathLabel = void 0;
    this.setLabel("");
  }
  render(options) {
    if (this.isHidden) {
      if (this.needsRedraw !== 2 /* Full */) {
        this.needsRedraw = options.updateIcon || options.updateDecoration ? 2 /* Full */ : 1 /* Basic */;
      }
      return false;
    }
    if (options.updateIcon) {
      this.computedIconClasses = void 0;
    }
    if (!this.label) {
      return false;
    }
    const iconLabelOptions = {
      title: "",
      italic: this.options?.italic,
      strikethrough: this.options?.strikethrough,
      matches: this.options?.matches,
      descriptionMatches: this.options?.descriptionMatches,
      extraClasses: [],
      separator: this.options?.separator,
      domId: this.options?.domId,
      disabledCommand: this.options?.disabledCommand,
      labelEscapeNewLines: this.options?.labelEscapeNewLines,
      descriptionTitle: this.options?.descriptionTitle
    };
    const resource = toResource(this.label);
    if (this.options?.title !== void 0) {
      iconLabelOptions.title = this.options.title;
    }
    if (resource && resource.scheme !== Schemas.data && (!this.options?.title || typeof this.options.title !== "string" && !this.options.title.markdownNotSupportedFallback)) {
      if (!this.computedPathLabel) {
        this.computedPathLabel = this.labelService.getUriLabel(resource);
      }
      if (!iconLabelOptions.title || typeof iconLabelOptions.title === "string") {
        iconLabelOptions.title = this.computedPathLabel;
      } else if (!iconLabelOptions.title.markdownNotSupportedFallback) {
        iconLabelOptions.title.markdownNotSupportedFallback = this.computedPathLabel;
      }
    }
    if (this.options && !this.options.hideIcon) {
      if (!this.computedIconClasses) {
        this.computedIconClasses = getIconClasses(this.modelService, this.languageService, resource, this.options.fileKind, this.options.icon);
      }
      if (URI.isUri(this.options.icon)) {
        iconLabelOptions.iconPath = this.options.icon;
      }
      iconLabelOptions.extraClasses = this.computedIconClasses.slice(0);
    }
    if (this.options?.extraClasses) {
      iconLabelOptions.extraClasses.push(...this.options.extraClasses);
    }
    if (this.options?.fileDecorations && resource) {
      if (options.updateDecoration) {
        this.decoration.value = this.decorationsService.getDecoration(resource, this.options.fileKind !== FileKind.FILE);
      }
      const decoration = this.decoration.value;
      if (decoration) {
        if (decoration.tooltip) {
          if (typeof iconLabelOptions.title === "string") {
            iconLabelOptions.title = `${iconLabelOptions.title} \u2022 ${decoration.tooltip}`;
          } else if (typeof iconLabelOptions.title?.markdown === "string") {
            const title = `${iconLabelOptions.title.markdown} \u2022 ${decoration.tooltip}`;
            iconLabelOptions.title = { markdown: title, markdownNotSupportedFallback: title };
          }
        }
        if (decoration.strikethrough) {
          iconLabelOptions.strikethrough = true;
        }
        if (this.options.fileDecorations.colors) {
          iconLabelOptions.extraClasses.push(decoration.labelClassName);
        }
        if (this.options.fileDecorations.badges) {
          iconLabelOptions.extraClasses.push(decoration.badgeClassName);
          iconLabelOptions.extraClasses.push(decoration.iconClassName);
        }
      }
    }
    if (this.label.range) {
      iconLabelOptions.suffix = this.label.range.startLineNumber !== this.label.range.endLineNumber ? `:${this.label.range.startLineNumber}-${this.label.range.endLineNumber}` : `:${this.label.range.startLineNumber}`;
    }
    this.setLabel(this.label.name ?? "", this.label.description, iconLabelOptions);
    this._onDidRender.fire();
    return true;
  }
  dispose() {
    super.dispose();
    this.label = void 0;
    this.options = void 0;
    this.computedLanguageId = void 0;
    this.computedIconClasses = void 0;
    this.computedPathLabel = void 0;
    this.computedWorkspaceFolderLabel = void 0;
  }
};
ResourceLabelWidget = __decorateClass([
  __decorateParam(2, ILanguageService),
  __decorateParam(3, IModelService),
  __decorateParam(4, IDecorationsService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, ITextFileService),
  __decorateParam(7, IWorkspaceContextService),
  __decorateParam(8, INotebookDocumentService)
], ResourceLabelWidget);
export {
  DEFAULT_LABELS_CONTAINER,
  ResourceLabel,
  ResourceLabels
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9sYWJlbHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZGlybmFtZSwgaXNFcXVhbCwgYmFzZW5hbWVPckF1dGhvcml0eSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJY29uTGFiZWwsIElJY29uTGFiZWxWYWx1ZU9wdGlvbnMsIElJY29uTGFiZWxDcmVhdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaWNvbkxhYmVsL2ljb25MYWJlbC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJVGV4dEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBJRGVjb3JhdGlvbiwgSURlY29yYXRpb25zU2VydmljZSwgSVJlc291cmNlRGVjb3JhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSAnLi4vc2VydmljZXMvZGVjb3JhdGlvbnMvY29tbW9uL2RlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IEZpbGVLaW5kLCBGSUxFU19BU1NPQ0lBVElPTlNfQ09ORklHIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBnZXRJY29uQ2xhc3NlcyB9IGZyb20gJy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvZ2V0SWNvbkNsYXNzZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgbm9ybWFsaXplRHJpdmVMZXR0ZXIgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9sYWJlbHMuanMnO1xuaW1wb3J0IHsgSVJhbmdlIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tEb2N1bWVudFNlcnZpY2UsIGV4dHJhY3RDZWxsT3V0cHV0RGV0YWlscyB9IGZyb20gJy4uL3NlcnZpY2VzL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0RvY3VtZW50U2VydmljZS5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlc291cmNlTGFiZWxQcm9wcyB7XG5cdHJlc291cmNlPzogVVJJIHwgeyBwcmltYXJ5PzogVVJJOyBzZWNvbmRhcnk/OiBVUkkgfTtcblx0bmFtZT86IHN0cmluZyB8IHN0cmluZ1tdO1xuXHRyYW5nZT86IElSYW5nZTtcblx0ZGVzY3JpcHRpb24/OiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIHRvUmVzb3VyY2UocHJvcHM6IElSZXNvdXJjZUxhYmVsUHJvcHMgfCB1bmRlZmluZWQpOiBVUkkgfCB1bmRlZmluZWQge1xuXHRpZiAoIXByb3BzIHx8ICFwcm9wcy5yZXNvdXJjZSkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRpZiAoVVJJLmlzVXJpKHByb3BzLnJlc291cmNlKSkge1xuXHRcdHJldHVybiBwcm9wcy5yZXNvdXJjZTtcblx0fVxuXG5cdHJldHVybiBwcm9wcy5yZXNvdXJjZS5wcmltYXJ5O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZXNvdXJjZUxhYmVsT3B0aW9ucyBleHRlbmRzIElJY29uTGFiZWxWYWx1ZU9wdGlvbnMge1xuXG5cdC8qKlxuXHQgKiBBIGhpbnQgdG8gdGhlIGZpbGUga2luZCBvZiB0aGUgcmVzb3VyY2UuXG5cdCAqL1xuXHRmaWxlS2luZD86IEZpbGVLaW5kO1xuXG5cdC8qKlxuXHQgKiBGaWxlIGRlY29yYXRpb25zIHRvIHVzZSBmb3IgdGhlIGxhYmVsLlxuXHQgKi9cblx0cmVhZG9ubHkgZmlsZURlY29yYXRpb25zPzogeyBjb2xvcnM6IGJvb2xlYW47IGJhZGdlczogYm9vbGVhbiB9O1xuXG5cdC8qKlxuXHQgKiBXaWxsIHRha2UgdGhlIHByb3ZpZGVkIGxhYmVsIGFzIGlzIGFuZCBlLmcuIG5vdCBvdmVycmlkZSBpdCBmb3IgdW50aXRsZWQgZmlsZXMuXG5cdCAqL1xuXHRyZWFkb25seSBmb3JjZUxhYmVsPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogVXNlcyB0aGUgcHJvdmlkZWQgaWNvbiBpbnN0ZWFkIG9mIGRlcml2aW5nIGEgcmVzb3VyY2UgaWNvbi5cblx0ICovXG5cdHJlYWRvbmx5IGljb24/OiBUaGVtZUljb24gfCBVUkk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVMYWJlbE9wdGlvbnMgZXh0ZW5kcyBJUmVzb3VyY2VMYWJlbE9wdGlvbnMge1xuXHRoaWRlTGFiZWw/OiBib29sZWFuO1xuXHRoaWRlUGF0aD86IGJvb2xlYW47XG5cdHJhbmdlPzogSVJhbmdlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZXNvdXJjZUxhYmVsIGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXG5cdHJlYWRvbmx5IGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXG5cdHJlYWRvbmx5IG9uRGlkUmVuZGVyOiBFdmVudDx2b2lkPjtcblxuXHQvKipcblx0ICogTW9zdCBnZW5lcmljIHdheSB0byBhcHBseSBhIGxhYmVsIHdpdGggcmF3IGluZm9ybWF0aW9uLlxuXHQgKi9cblx0c2V0TGFiZWwobGFiZWw/OiBzdHJpbmcsIGRlc2NyaXB0aW9uPzogc3RyaW5nLCBvcHRpb25zPzogSUljb25MYWJlbFZhbHVlT3B0aW9ucyk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIENvbnZlbmllbnQgbWV0aG9kIHRvIGFwcGx5IGEgbGFiZWwgYnkgcGFzc2luZyBhIHJlc291cmNlIGFsb25nLlxuXHQgKlxuXHQgKiBOb3RlOiBmb3IgZmlsZSByZXNvdXJjZXMgY29uc2lkZXIgdG8gdXNlIHRoZSAjc2V0RmlsZSgpIG1ldGhvZCBpbnN0ZWFkLlxuXHQgKi9cblx0c2V0UmVzb3VyY2UobGFiZWw6IElSZXNvdXJjZUxhYmVsUHJvcHMsIG9wdGlvbnM/OiBJUmVzb3VyY2VMYWJlbE9wdGlvbnMpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBDb252ZW5pZW50IG1ldGhvZCB0byByZW5kZXIgYSBmaWxlIGxhYmVsIGJhc2VkIG9uIGEgcmVzb3VyY2UuXG5cdCAqL1xuXHRzZXRGaWxlKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJRmlsZUxhYmVsT3B0aW9ucyk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIFJlc2V0cyB0aGUgbGFiZWwgdG8gYmUgZW1wdHkuXG5cdCAqL1xuXHRjbGVhcigpOiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZXNvdXJjZUxhYmVsc0NvbnRhaW5lciB7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlzaWJpbGl0eTogRXZlbnQ8Ym9vbGVhbj47XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0xBQkVMU19DT05UQUlORVI6IElSZXNvdXJjZUxhYmVsc0NvbnRhaW5lciA9IHtcblx0b25EaWRDaGFuZ2VWaXNpYmlsaXR5OiBFdmVudC5Ob25lXG59O1xuXG5leHBvcnQgY2xhc3MgUmVzb3VyY2VMYWJlbHMgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZURlY29yYXRpb25zID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRGVjb3JhdGlvbnMgPSB0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zLmV2ZW50O1xuXG5cdHByaXZhdGUgd2lkZ2V0czogUmVzb3VyY2VMYWJlbFdpZGdldFtdID0gW107XG5cdHByaXZhdGUgbGFiZWxzOiBJUmVzb3VyY2VMYWJlbFtdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y29udGFpbmVyOiBJUmVzb3VyY2VMYWJlbHNDb250YWluZXIsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASURlY29yYXRpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRlY29yYXRpb25zU2VydmljZTogSURlY29yYXRpb25zU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASVRleHRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycyhjb250YWluZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycyhjb250YWluZXI6IElSZXNvdXJjZUxhYmVsc0NvbnRhaW5lcik6IHZvaWQge1xuXG5cdFx0Ly8gbm90aWZ5IHdoZW4gdmlzaWJpbGl0eSBjaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29udGFpbmVyLm9uRGlkQ2hhbmdlVmlzaWJpbGl0eSh2aXNpYmxlID0+IHtcblx0XHRcdHRoaXMud2lkZ2V0cy5mb3JFYWNoKHdpZGdldCA9PiB3aWRnZXQubm90aWZ5VmlzaWJpbGl0eUNoYW5nZWQodmlzaWJsZSkpO1xuXHRcdH0pKTtcblxuXHRcdC8vIG5vdGlmeSB3aGVuIGV4dGVuc2lvbnMgYXJlIHJlZ2lzdGVyZWQgd2l0aCBwb3RlbnRpYWxseSBuZXcgbGFuZ3VhZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5sYW5ndWFnZVNlcnZpY2Uub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy53aWRnZXRzLmZvckVhY2god2lkZ2V0ID0+IHdpZGdldC5ub3RpZnlFeHRlbnNpb25zUmVnaXN0ZXJlZCgpKSkpO1xuXG5cdFx0Ly8gbm90aWZ5IHdoZW4gbW9kZWwgbGFuZ3VhZ2UgY2hhbmdlc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubW9kZWxTZXJ2aWNlLm9uTW9kZWxMYW5ndWFnZUNoYW5nZWQoZSA9PiB7XG5cdFx0XHRpZiAoIWUubW9kZWwudXJpKSB7XG5cdFx0XHRcdHJldHVybjsgLy8gd2UgbmVlZCB0aGUgcmVzb3VyY2UgdG8gY29tcGFyZVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLndpZGdldHMuZm9yRWFjaCh3aWRnZXQgPT4gd2lkZ2V0Lm5vdGlmeU1vZGVsTGFuZ3VhZ2VDaGFuZ2VkKGUubW9kZWwpKTtcblx0XHR9KSk7XG5cblx0XHQvLyBub3RpZnkgd2hlbiBtb2RlbCBpcyBhZGRlZFxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubW9kZWxTZXJ2aWNlLm9uTW9kZWxBZGRlZChtb2RlbCA9PiB7XG5cdFx0XHRpZiAoIW1vZGVsLnVyaSkge1xuXHRcdFx0XHRyZXR1cm47IC8vIHdlIG5lZWQgdGhlIHJlc291cmNlIHRvIGNvbXBhcmVcblx0XHRcdH1cblxuXHRcdFx0dGhpcy53aWRnZXRzLmZvckVhY2god2lkZ2V0ID0+IHdpZGdldC5ub3RpZnlNb2RlbEFkZGVkKG1vZGVsKSk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gbm90aWZ5IHdoZW4gd29ya3NwYWNlIGZvbGRlcnMgY2hhbmdlc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud29ya3NwYWNlU2VydmljZS5vbkRpZENoYW5nZVdvcmtzcGFjZUZvbGRlcnMoKCkgPT4ge1xuXHRcdFx0dGhpcy53aWRnZXRzLmZvckVhY2god2lkZ2V0ID0+IHdpZGdldC5ub3RpZnlXb3Jrc3BhY2VGb2xkZXJzQ2hhbmdlKCkpO1xuXHRcdH0pKTtcblxuXHRcdC8vIG5vdGlmeSB3aGVuIGZpbGUgZGVjb3JhdGlvbiBjaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWNvcmF0aW9uc1NlcnZpY2Uub25EaWRDaGFuZ2VEZWNvcmF0aW9ucyhlID0+IHtcblx0XHRcdGxldCBub3RpZnlEaWRDaGFuZ2VEZWNvcmF0aW9ucyA9IGZhbHNlO1xuXHRcdFx0dGhpcy53aWRnZXRzLmZvckVhY2god2lkZ2V0ID0+IHtcblx0XHRcdFx0aWYgKHdpZGdldC5ub3RpZnlGaWxlRGVjb3JhdGlvbnNDaGFuZ2VzKGUpKSB7XG5cdFx0XHRcdFx0bm90aWZ5RGlkQ2hhbmdlRGVjb3JhdGlvbnMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKG5vdGlmeURpZENoYW5nZURlY29yYXRpb25zKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIG5vdGlmeSB3aGVuIHRoZW1lIGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UoKCkgPT4gdGhpcy53aWRnZXRzLmZvckVhY2god2lkZ2V0ID0+IHdpZGdldC5ub3RpZnlUaGVtZUNoYW5nZSgpKSkpO1xuXG5cdFx0Ly8gbm90aWZ5IHdoZW4gZmlsZXMuYXNzb2NpYXRpb25zIGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKEZJTEVTX0FTU09DSUFUSU9OU19DT05GSUcpKSB7XG5cdFx0XHRcdHRoaXMud2lkZ2V0cy5mb3JFYWNoKHdpZGdldCA9PiB3aWRnZXQubm90aWZ5RmlsZUFzc29jaWF0aW9uc0NoYW5nZSgpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBub3RpZnkgd2hlbiBsYWJlbCBmb3JtYXR0ZXJzIGNoYW5nZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFiZWxTZXJ2aWNlLm9uRGlkQ2hhbmdlRm9ybWF0dGVycyhlID0+IHtcblx0XHRcdHRoaXMud2lkZ2V0cy5mb3JFYWNoKHdpZGdldCA9PiB3aWRnZXQubm90aWZ5Rm9ybWF0dGVyc0NoYW5nZShlLnNjaGVtZSkpO1xuXHRcdH0pKTtcblxuXHRcdC8vIG5vdGlmeSB3aGVuIHVudGl0bGVkIGxhYmVscyBjaGFuZ2Vcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRleHRGaWxlU2VydmljZS51bnRpdGxlZC5vbkRpZENoYW5nZUxhYmVsKG1vZGVsID0+IHtcblx0XHRcdHRoaXMud2lkZ2V0cy5mb3JFYWNoKHdpZGdldCA9PiB3aWRnZXQubm90aWZ5VW50aXRsZWRMYWJlbENoYW5nZShtb2RlbC5yZXNvdXJjZSkpO1xuXHRcdH0pKTtcblx0fVxuXG5cdGdldChpbmRleDogbnVtYmVyKTogSVJlc291cmNlTGFiZWwge1xuXHRcdHJldHVybiB0aGlzLmxhYmVsc1tpbmRleF07XG5cdH1cblxuXHRjcmVhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgb3B0aW9ucz86IElJY29uTGFiZWxDcmVhdGlvbk9wdGlvbnMpOiBJUmVzb3VyY2VMYWJlbCB7XG5cdFx0Y29uc3Qgd2lkZ2V0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZUxhYmVsV2lkZ2V0LCBjb250YWluZXIsIG9wdGlvbnMpO1xuXG5cdFx0Ly8gT25seSBleHBvc2UgYSBoYW5kbGUgdG8gdGhlIG91dHNpZGVcblx0XHRjb25zdCBsYWJlbDogSVJlc291cmNlTGFiZWwgPSB7XG5cdFx0XHRlbGVtZW50OiB3aWRnZXQuZWxlbWVudCxcblx0XHRcdG9uRGlkUmVuZGVyOiB3aWRnZXQub25EaWRSZW5kZXIsXG5cdFx0XHRzZXRMYWJlbDogKGxhYmVsOiBzdHJpbmcsIGRlc2NyaXB0aW9uPzogc3RyaW5nLCBvcHRpb25zPzogSUljb25MYWJlbFZhbHVlT3B0aW9ucykgPT4gd2lkZ2V0LnNldExhYmVsKGxhYmVsLCBkZXNjcmlwdGlvbiwgb3B0aW9ucyksXG5cdFx0XHRzZXRSZXNvdXJjZTogKGxhYmVsOiBJUmVzb3VyY2VMYWJlbFByb3BzLCBvcHRpb25zPzogSVJlc291cmNlTGFiZWxPcHRpb25zKSA9PiB3aWRnZXQuc2V0UmVzb3VyY2UobGFiZWwsIG9wdGlvbnMpLFxuXHRcdFx0c2V0RmlsZTogKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJRmlsZUxhYmVsT3B0aW9ucykgPT4gd2lkZ2V0LnNldEZpbGUocmVzb3VyY2UsIG9wdGlvbnMpLFxuXHRcdFx0Y2xlYXI6ICgpID0+IHdpZGdldC5jbGVhcigpLFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4gdGhpcy5kaXNwb3NlV2lkZ2V0KHdpZGdldClcblx0XHR9O1xuXG5cdFx0Ly8gU3RvcmVcblx0XHR0aGlzLmxhYmVscy5wdXNoKGxhYmVsKTtcblx0XHR0aGlzLndpZGdldHMucHVzaCh3aWRnZXQpO1xuXG5cdFx0cmV0dXJuIGxhYmVsO1xuXHR9XG5cblx0cHJpdmF0ZSBkaXNwb3NlV2lkZ2V0KHdpZGdldDogUmVzb3VyY2VMYWJlbFdpZGdldCk6IHZvaWQge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy53aWRnZXRzLmluZGV4T2Yod2lkZ2V0KTtcblx0XHRpZiAoaW5kZXggPiAtMSkge1xuXHRcdFx0dGhpcy53aWRnZXRzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHR0aGlzLmxhYmVscy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdH1cblxuXHRcdGRpc3Bvc2Uod2lkZ2V0KTtcblx0fVxuXG5cdGNsZWFyKCk6IHZvaWQge1xuXHRcdHRoaXMud2lkZ2V0cyA9IGRpc3Bvc2UodGhpcy53aWRnZXRzKTtcblx0XHR0aGlzLmxhYmVscyA9IFtdO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLmNsZWFyKCk7XG5cdH1cbn1cblxuLyoqXG4gKiBOb3RlOiBwbGVhc2UgY29uc2lkZXIgdG8gdXNlIGBSZXNvdXJjZUxhYmVsc2AgaWYgeW91IGFyZSBpbiBuZWVkXG4gKiBvZiBtb3JlIHRoYW4gb25lIGxhYmVsIGZvciB5b3VyIHdpZGdldC5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlc291cmNlTGFiZWwgZXh0ZW5kcyBSZXNvdXJjZUxhYmVscyB7XG5cblx0cHJpdmF0ZSBsYWJlbDogSVJlc291cmNlTGFiZWw7XG5cdGdldCBlbGVtZW50KCk6IElSZXNvdXJjZUxhYmVsIHsgcmV0dXJuIHRoaXMubGFiZWw7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdG9wdGlvbnM6IElJY29uTGFiZWxDcmVhdGlvbk9wdGlvbnMgfCB1bmRlZmluZWQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB3b3Jrc3BhY2VTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJRGVjb3JhdGlvbnNTZXJ2aWNlIGRlY29yYXRpb25zU2VydmljZTogSURlY29yYXRpb25zU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJVGV4dEZpbGVTZXJ2aWNlIHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihERUZBVUxUX0xBQkVMU19DT05UQUlORVIsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgbW9kZWxTZXJ2aWNlLCB3b3Jrc3BhY2VTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UsIGRlY29yYXRpb25zU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBsYWJlbFNlcnZpY2UsIHRleHRGaWxlU2VydmljZSk7XG5cblx0XHR0aGlzLmxhYmVsID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5jcmVhdGUoY29udGFpbmVyLCBvcHRpb25zKSk7XG5cdH1cbn1cblxuZW51bSBSZWRyYXcge1xuXHRCYXNpYyA9IDEsXG5cdEZ1bGwgPSAyXG59XG5cbmNsYXNzIFJlc291cmNlTGFiZWxXaWRnZXQgZXh0ZW5kcyBJY29uTGFiZWwge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVuZGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmVuZGVyID0gdGhpcy5fb25EaWRSZW5kZXIuZXZlbnQ7XG5cblx0cHJpdmF0ZSBsYWJlbDogSVJlc291cmNlTGFiZWxQcm9wcyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBkZWNvcmF0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElEZWNvcmF0aW9uPigpKTtcblx0cHJpdmF0ZSBvcHRpb25zOiBJUmVzb3VyY2VMYWJlbE9wdGlvbnMgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBjb21wdXRlZEljb25DbGFzc2VzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjb21wdXRlZExhbmd1YWdlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjb21wdXRlZFBhdGhMYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNvbXB1dGVkV29ya3NwYWNlRm9sZGVyTGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIG5lZWRzUmVkcmF3OiBSZWRyYXcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgaXNIaWRkZW46IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdG9wdGlvbnM6IElJY29uTGFiZWxDcmVhdGlvbk9wdGlvbnMgfCB1bmRlZmluZWQsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElEZWNvcmF0aW9uc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkZWNvcmF0aW9uc1NlcnZpY2U6IElEZWNvcmF0aW9uc1NlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElOb3RlYm9va0RvY3VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRG9jdW1lbnRTZXJ2aWNlOiBJTm90ZWJvb2tEb2N1bWVudFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoY29udGFpbmVyLCBvcHRpb25zKTtcblx0fVxuXG5cdG5vdGlmeVZpc2liaWxpdHlDaGFuZ2VkKHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodmlzaWJsZSA9PT0gdGhpcy5pc0hpZGRlbikge1xuXHRcdFx0dGhpcy5pc0hpZGRlbiA9ICF2aXNpYmxlO1xuXG5cdFx0XHRpZiAodmlzaWJsZSAmJiB0aGlzLm5lZWRzUmVkcmF3KSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyKHtcblx0XHRcdFx0XHR1cGRhdGVJY29uOiB0aGlzLm5lZWRzUmVkcmF3ID09PSBSZWRyYXcuRnVsbCxcblx0XHRcdFx0XHR1cGRhdGVEZWNvcmF0aW9uOiB0aGlzLm5lZWRzUmVkcmF3ID09PSBSZWRyYXcuRnVsbFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLm5lZWRzUmVkcmF3ID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdG5vdGlmeU1vZGVsTGFuZ3VhZ2VDaGFuZ2VkKG1vZGVsOiBJVGV4dE1vZGVsKTogdm9pZCB7XG5cdFx0dGhpcy5oYW5kbGVNb2RlbEV2ZW50KG1vZGVsKTtcblx0fVxuXG5cdG5vdGlmeU1vZGVsQWRkZWQobW9kZWw6IElUZXh0TW9kZWwpOiB2b2lkIHtcblx0XHR0aGlzLmhhbmRsZU1vZGVsRXZlbnQobW9kZWwpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVNb2RlbEV2ZW50KG1vZGVsOiBJVGV4dE1vZGVsKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlKHRoaXMubGFiZWwpO1xuXHRcdGlmICghcmVzb3VyY2UpIHtcblx0XHRcdHJldHVybjsgLy8gb25seSB1cGRhdGUgaWYgcmVzb3VyY2UgZXhpc3RzXG5cdFx0fVxuXG5cdFx0aWYgKGlzRXF1YWwobW9kZWwudXJpLCByZXNvdXJjZSkpIHtcblx0XHRcdGlmICh0aGlzLmNvbXB1dGVkTGFuZ3VhZ2VJZCAhPT0gbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpKSB7XG5cdFx0XHRcdHRoaXMuY29tcHV0ZWRMYW5ndWFnZUlkID0gbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdFx0XHR0aGlzLnJlbmRlcih7IHVwZGF0ZUljb246IHRydWUsIHVwZGF0ZURlY29yYXRpb246IGZhbHNlIH0pOyAvLyB1cGRhdGUgaWYgdGhlIGxhbmd1YWdlIGlkIG9mIHRoZSBtb2RlbCBoYXMgY2hhbmdlZCBmcm9tIG91ciBsYXN0IGtub3duIHN0YXRlXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0bm90aWZ5RmlsZURlY29yYXRpb25zQ2hhbmdlcyhlOiBJUmVzb3VyY2VEZWNvcmF0aW9uQ2hhbmdlRXZlbnQpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMub3B0aW9ucykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZSh0aGlzLmxhYmVsKTtcblx0XHRpZiAoIXJlc291cmNlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5maWxlRGVjb3JhdGlvbnMgJiYgZS5hZmZlY3RzUmVzb3VyY2UocmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZW5kZXIoeyB1cGRhdGVJY29uOiBmYWxzZSwgdXBkYXRlRGVjb3JhdGlvbjogdHJ1ZSB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRub3RpZnlFeHRlbnNpb25zUmVnaXN0ZXJlZCgpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlcih7IHVwZGF0ZUljb246IHRydWUsIHVwZGF0ZURlY29yYXRpb246IGZhbHNlIH0pO1xuXHR9XG5cblx0bm90aWZ5VGhlbWVDaGFuZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy5yZW5kZXIoeyB1cGRhdGVJY29uOiBmYWxzZSwgdXBkYXRlRGVjb3JhdGlvbjogZmFsc2UgfSk7XG5cdH1cblxuXHRub3RpZnlGaWxlQXNzb2NpYXRpb25zQ2hhbmdlKCk6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyKHsgdXBkYXRlSWNvbjogdHJ1ZSwgdXBkYXRlRGVjb3JhdGlvbjogZmFsc2UgfSk7XG5cdH1cblxuXHRub3RpZnlGb3JtYXR0ZXJzQ2hhbmdlKHNjaGVtZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKHRvUmVzb3VyY2UodGhpcy5sYWJlbCk/LnNjaGVtZSA9PT0gc2NoZW1lKSB7XG5cdFx0XHR0aGlzLnJlbmRlcih7IHVwZGF0ZUljb246IGZhbHNlLCB1cGRhdGVEZWNvcmF0aW9uOiBmYWxzZSB9KTtcblx0XHR9XG5cdH1cblxuXHRub3RpZnlVbnRpdGxlZExhYmVsQ2hhbmdlKHJlc291cmNlOiBVUkkpOiB2b2lkIHtcblx0XHRpZiAoaXNFcXVhbChyZXNvdXJjZSwgdG9SZXNvdXJjZSh0aGlzLmxhYmVsKSkpIHtcblx0XHRcdHRoaXMucmVuZGVyKHsgdXBkYXRlSWNvbjogZmFsc2UsIHVwZGF0ZURlY29yYXRpb246IGZhbHNlIH0pO1xuXHRcdH1cblx0fVxuXG5cdG5vdGlmeVdvcmtzcGFjZUZvbGRlcnNDaGFuZ2UoKTogdm9pZCB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLmNvbXB1dGVkV29ya3NwYWNlRm9sZGVyTGFiZWwgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UodGhpcy5sYWJlbCk7XG5cdFx0XHRpZiAoVVJJLmlzVXJpKHJlc291cmNlKSAmJiB0aGlzLmxhYmVsPy5uYW1lID09PSB0aGlzLmNvbXB1dGVkV29ya3NwYWNlRm9sZGVyTGFiZWwpIHtcblx0XHRcdFx0dGhpcy5zZXRGaWxlKHJlc291cmNlLCB0aGlzLm9wdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHNldEZpbGUocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElGaWxlTGFiZWxPcHRpb25zKTogdm9pZCB7XG5cdFx0Y29uc3QgaGlkZUxhYmVsID0gb3B0aW9ucz8uaGlkZUxhYmVsO1xuXHRcdGxldCBuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKCFoaWRlTGFiZWwpIHtcblx0XHRcdGlmIChvcHRpb25zPy5maWxlS2luZCA9PT0gRmlsZUtpbmQuUk9PVF9GT0xERVIpIHtcblx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVyID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2VGb2xkZXIocmVzb3VyY2UpO1xuXHRcdFx0XHRpZiAod29ya3NwYWNlRm9sZGVyKSB7XG5cdFx0XHRcdFx0bmFtZSA9IHdvcmtzcGFjZUZvbGRlci5uYW1lO1xuXHRcdFx0XHRcdHRoaXMuY29tcHV0ZWRXb3Jrc3BhY2VGb2xkZXJMYWJlbCA9IG5hbWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCFuYW1lKSB7XG5cdFx0XHRcdG5hbWUgPSBub3JtYWxpemVEcml2ZUxldHRlcihiYXNlbmFtZU9yQXV0aG9yaXR5KHJlc291cmNlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKCFvcHRpb25zPy5oaWRlUGF0aCkge1xuXHRcdFx0Y29uc3QgZGVzY3JpcHRpb25DYW5kaWRhdGUgPSB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChkaXJuYW1lKHJlc291cmNlKSwgeyByZWxhdGl2ZTogdHJ1ZSB9KTtcblx0XHRcdGlmIChkZXNjcmlwdGlvbkNhbmRpZGF0ZSAmJiBkZXNjcmlwdGlvbkNhbmRpZGF0ZSAhPT0gJy4nKSB7XG5cdFx0XHRcdC8vIG9taXQgZGVzY3JpcHRpb24gaWYgaXRzIG5vdCBzaWduaWZpY2FudDogYSByZWxhdGl2ZSBwYXRoXG5cdFx0XHRcdC8vIG9mICcuJyBqdXN0IGluZGljYXRlcyB0aGF0IHRoZXJlIGlzIG5vIHBhcmVudCB0byB0aGUgcGF0aFxuXHRcdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjA4NjkyXG5cdFx0XHRcdGRlc2NyaXB0aW9uID0gZGVzY3JpcHRpb25DYW5kaWRhdGU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRSZXNvdXJjZSh7IHJlc291cmNlLCBuYW1lLCBkZXNjcmlwdGlvbiwgcmFuZ2U6IG9wdGlvbnM/LnJhbmdlIH0sIG9wdGlvbnMpO1xuXHR9XG5cblx0c2V0UmVzb3VyY2UobGFiZWw6IElSZXNvdXJjZUxhYmVsUHJvcHMsIG9wdGlvbnM6IElSZXNvdXJjZUxhYmVsT3B0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCkpOiB2b2lkIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UobGFiZWwpO1xuXHRcdGNvbnN0IGlzU2lkZUJ5U2lkZUVkaXRvciA9IGxhYmVsPy5yZXNvdXJjZSAmJiAhVVJJLmlzVXJpKGxhYmVsLnJlc291cmNlKTtcblxuXHRcdGlmICghb3B0aW9ucy5mb3JjZUxhYmVsICYmICFpc1NpZGVCeVNpZGVFZGl0b3IgJiYgcmVzb3VyY2U/LnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCkge1xuXHRcdFx0Ly8gVW50aXRsZWQgbGFiZWxzIGFyZSB2ZXJ5IGR5bmFtaWMgYmVjYXVzZSB0aGV5IG1heSBjaGFuZ2Vcblx0XHRcdC8vIHdoZW5ldmVyIHRoZSBjb250ZW50IGNoYW5nZXMgKHVubGVzcyBhIHBhdGggaXMgYXNzb2NpYXRlZCkuXG5cdFx0XHQvLyBBcyBzdWNoIHdlIGFsd2F5cyBhc2sgdGhlIGFjdHVhbCBlZGl0b3IgZm9yIGl0J3MgbmFtZSBhbmRcblx0XHRcdC8vIGRlc2NyaXB0aW9uIHRvIGdldCBsYXRlc3QgaW4gY2FzZSBuYW1lL2Rlc2NyaXB0aW9uIGFyZVxuXHRcdFx0Ly8gcHJvdmlkZWQuIElmIHRoZXkgYXJlIG5vdCBwcm92aWRlZCBmcm9tIHRoZSBsYWJlbCB3ZSBnb3Rcblx0XHRcdC8vIHdlIGFzc3VtZSB0aGF0IHRoZSBjbGllbnQgZG9lcyBub3Qgd2FudCB0byBkaXNwbGF5IHRoZW1cblx0XHRcdC8vIGFuZCBhcyBzdWNoIGRvIG5vdCBvdmVycmlkZS5cblx0XHRcdC8vXG5cdFx0XHQvLyBXZSBkbyBub3QgdG91Y2ggdGhlIGxhYmVsIGlmIGl0IHJlcHJlc2VudHMgYSBwcmltYXJ5LXNlY29uZGFyeVxuXHRcdFx0Ly8gYmVjYXVzZSBpbiB0aGF0IGNhc2Ugd2UgZXhwZWN0IGl0IHRvIGNhcnJ5IGEgcHJvcGVyIGxhYmVsXG5cdFx0XHQvLyBhbmQgZGVzY3JpcHRpb24uXG5cdFx0XHRjb25zdCB1bnRpdGxlZE1vZGVsID0gdGhpcy50ZXh0RmlsZVNlcnZpY2UudW50aXRsZWQuZ2V0KHJlc291cmNlKTtcblx0XHRcdGlmICh1bnRpdGxlZE1vZGVsICYmICF1bnRpdGxlZE1vZGVsLmhhc0Fzc29jaWF0ZWRGaWxlUGF0aCkge1xuXHRcdFx0XHRpZiAodHlwZW9mIGxhYmVsLm5hbWUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0bGFiZWwubmFtZSA9IHVudGl0bGVkTW9kZWwubmFtZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0eXBlb2YgbGFiZWwuZGVzY3JpcHRpb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0Y29uc3QgdW50aXRsZWREZXNjcmlwdGlvbiA9IHVudGl0bGVkTW9kZWwucmVzb3VyY2UucGF0aDtcblx0XHRcdFx0XHRpZiAobGFiZWwubmFtZSAhPT0gdW50aXRsZWREZXNjcmlwdGlvbikge1xuXHRcdFx0XHRcdFx0bGFiZWwuZGVzY3JpcHRpb24gPSB1bnRpdGxlZERlc2NyaXB0aW9uO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRsYWJlbC5kZXNjcmlwdGlvbiA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB1bnRpdGxlZFRpdGxlID0gdW50aXRsZWRNb2RlbC5yZXNvdXJjZS5wYXRoO1xuXHRcdFx0XHRpZiAodW50aXRsZWRNb2RlbC5uYW1lICE9PSB1bnRpdGxlZFRpdGxlKSB7XG5cdFx0XHRcdFx0b3B0aW9ucy50aXRsZSA9IGAke3VudGl0bGVkTW9kZWwubmFtZX0gXHUyMDIyICR7dW50aXRsZWRUaXRsZX1gO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG9wdGlvbnMudGl0bGUgPSB1bnRpdGxlZFRpdGxlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFvcHRpb25zLmZvcmNlTGFiZWwgJiYgIWlzU2lkZUJ5U2lkZUVkaXRvciAmJiByZXNvdXJjZT8uc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbCkge1xuXHRcdFx0Ly8gTm90ZWJvb2sgY2VsbHMgYXJlIGVtYmVkZWQgaW4gYSBub3RlYm9vayBkb2N1bWVudFxuXHRcdFx0Ly8gQXMgc3VjaCB3ZSBhbHdheXMgYXNrIHRoZSBhY3R1YWwgbm90ZWJvb2sgZG9jdW1lbnRcblx0XHRcdC8vIGZvciBpdHMgcG9zaXRpb24gaW4gdGhlIGRvY3VtZW50LlxuXHRcdFx0Y29uc3Qgbm90ZWJvb2tEb2N1bWVudCA9IHRoaXMubm90ZWJvb2tEb2N1bWVudFNlcnZpY2UuZ2V0Tm90ZWJvb2socmVzb3VyY2UpO1xuXHRcdFx0Y29uc3QgY2VsbEluZGV4ID0gbm90ZWJvb2tEb2N1bWVudD8uZ2V0Q2VsbEluZGV4KHJlc291cmNlKTtcblx0XHRcdGlmIChub3RlYm9va0RvY3VtZW50ICYmIGNlbGxJbmRleCAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBsYWJlbC5uYW1lID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRvcHRpb25zLnRpdGxlID0gbG9jYWxpemUoJ25vdGVib29rQ2VsbExhYmVsJywgXCJ7MH0gXHUyMDIyIENlbGwgezF9XCIsIGxhYmVsLm5hbWUsIGAke2NlbGxJbmRleCArIDF9YCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0eXBlb2YgbGFiZWwubmFtZSA9PT0gJ3N0cmluZycgJiYgbm90ZWJvb2tEb2N1bWVudCAmJiBjZWxsSW5kZXggIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgbGFiZWwubmFtZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0bGFiZWwubmFtZSA9IGxvY2FsaXplKCdub3RlYm9va0NlbGxMYWJlbCcsIFwiezB9IFx1MjAyMiBDZWxsIHsxfVwiLCBsYWJlbC5uYW1lLCBgJHtjZWxsSW5kZXggKyAxfWApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghb3B0aW9ucy5mb3JjZUxhYmVsICYmICFpc1NpZGVCeVNpZGVFZGl0b3IgJiYgcmVzb3VyY2U/LnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGxPdXRwdXQpIHtcblx0XHRcdGNvbnN0IG5vdGVib29rRG9jdW1lbnQgPSB0aGlzLm5vdGVib29rRG9jdW1lbnRTZXJ2aWNlLmdldE5vdGVib29rKHJlc291cmNlKTtcblx0XHRcdGNvbnN0IG91dHB1dFVyaURhdGEgPSBleHRyYWN0Q2VsbE91dHB1dERldGFpbHMocmVzb3VyY2UpO1xuXHRcdFx0aWYgKG91dHB1dFVyaURhdGE/LmNlbGxGcmFnbWVudCkge1xuXHRcdFx0XHRpZiAoIW91dHB1dFVyaURhdGEubm90ZWJvb2spIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgY2VsbFVyaSA9IG91dHB1dFVyaURhdGEubm90ZWJvb2sud2l0aCh7XG5cdFx0XHRcdFx0c2NoZW1lOiBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbCxcblx0XHRcdFx0XHRmcmFnbWVudDogb3V0cHV0VXJpRGF0YS5jZWxsRnJhZ21lbnRcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNvbnN0IGNlbGxJbmRleCA9IG5vdGVib29rRG9jdW1lbnQ/LmdldENlbGxJbmRleChjZWxsVXJpKTtcblx0XHRcdFx0Y29uc3Qgb3V0cHV0SW5kZXggPSBvdXRwdXRVcmlEYXRhLm91dHB1dEluZGV4O1xuXG5cdFx0XHRcdGlmIChjZWxsSW5kZXggIT09IHVuZGVmaW5lZCAmJiBvdXRwdXRJbmRleCAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBsYWJlbC5uYW1lID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGxhYmVsLm5hbWUgPSBsb2NhbGl6ZShcblx0XHRcdFx0XHRcdCdub3RlYm9va0NlbGxPdXRwdXRMYWJlbCcsXG5cdFx0XHRcdFx0XHRcInswfSBcdTIwMjIgQ2VsbCB7MX0gXHUyMDIyIE91dHB1dCB7Mn1cIixcblx0XHRcdFx0XHRcdGxhYmVsLm5hbWUsXG5cdFx0XHRcdFx0XHRgJHtjZWxsSW5kZXggKyAxfWAsXG5cdFx0XHRcdFx0XHRgJHtvdXRwdXRJbmRleCArIDF9YFxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoY2VsbEluZGV4ICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGxhYmVsLm5hbWUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0bGFiZWwubmFtZSA9IGxvY2FsaXplKFxuXHRcdFx0XHRcdFx0J25vdGVib29rQ2VsbE91dHB1dExhYmVsU2ltcGxlJyxcblx0XHRcdFx0XHRcdFwiezB9IFx1MjAyMiBDZWxsIHsxfSBcdTIwMjIgT3V0cHV0XCIsXG5cdFx0XHRcdFx0XHRsYWJlbC5uYW1lLFxuXHRcdFx0XHRcdFx0YCR7Y2VsbEluZGV4ICsgMX1gXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGhhc1Jlc291cmNlQ2hhbmdlZCA9IHRoaXMuaGFzUmVzb3VyY2VDaGFuZ2VkKGxhYmVsKTtcblx0XHRjb25zdCBoYXNQYXRoTGFiZWxDaGFuZ2VkID0gaGFzUmVzb3VyY2VDaGFuZ2VkIHx8IHRoaXMuaGFzUGF0aExhYmVsQ2hhbmdlZChsYWJlbCk7XG5cdFx0Y29uc3QgaGFzRmlsZUtpbmRDaGFuZ2VkID0gdGhpcy5oYXNGaWxlS2luZENoYW5nZWQob3B0aW9ucyk7XG5cdFx0Y29uc3QgaGFzSWNvbkNoYW5nZWQgPSB0aGlzLmhhc0ljb25DaGFuZ2VkKG9wdGlvbnMpO1xuXG5cdFx0dGhpcy5sYWJlbCA9IGxhYmVsO1xuXHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cblx0XHRpZiAoaGFzUmVzb3VyY2VDaGFuZ2VkKSB7XG5cdFx0XHR0aGlzLmNvbXB1dGVkTGFuZ3VhZ2VJZCA9IHVuZGVmaW5lZDsgLy8gcmVzZXQgY29tcHV0ZWQgbGFuZ3VhZ2Ugc2luY2UgcmVzb3VyY2UgY2hhbmdlZFxuXHRcdH1cblxuXHRcdGlmIChoYXNQYXRoTGFiZWxDaGFuZ2VkKSB7XG5cdFx0XHR0aGlzLmNvbXB1dGVkUGF0aExhYmVsID0gdW5kZWZpbmVkOyAvLyByZXNldCBwYXRoIGxhYmVsIGR1ZSB0byByZXNvdXJjZS9wYXRoLWxhYmVsIGNoYW5nZVxuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyKHtcblx0XHRcdHVwZGF0ZUljb246IGhhc1Jlc291cmNlQ2hhbmdlZCB8fCBoYXNGaWxlS2luZENoYW5nZWQgfHwgaGFzSWNvbkNoYW5nZWQsXG5cdFx0XHR1cGRhdGVEZWNvcmF0aW9uOiBoYXNSZXNvdXJjZUNoYW5nZWQgfHwgaGFzRmlsZUtpbmRDaGFuZ2VkXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGhhc0ZpbGVLaW5kQ2hhbmdlZChuZXdPcHRpb25zPzogSVJlc291cmNlTGFiZWxPcHRpb25zKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgbmV3RmlsZUtpbmQgPSBuZXdPcHRpb25zPy5maWxlS2luZDtcblx0XHRjb25zdCBvbGRGaWxlS2luZCA9IHRoaXMub3B0aW9ucz8uZmlsZUtpbmQ7XG5cblx0XHRyZXR1cm4gbmV3RmlsZUtpbmQgIT09IG9sZEZpbGVLaW5kOyAvLyBzYW1lIHJlc291cmNlIGJ1dCBkaWZmZXJlbnQga2luZCAoZmlsZSwgZm9sZGVyKVxuXHR9XG5cblx0cHJpdmF0ZSBoYXNSZXNvdXJjZUNoYW5nZWQobmV3TGFiZWw6IElSZXNvdXJjZUxhYmVsUHJvcHMpOiBib29sZWFuIHtcblx0XHRjb25zdCBuZXdSZXNvdXJjZSA9IHRvUmVzb3VyY2UobmV3TGFiZWwpO1xuXHRcdGNvbnN0IG9sZFJlc291cmNlID0gdG9SZXNvdXJjZSh0aGlzLmxhYmVsKTtcblxuXHRcdGlmIChuZXdSZXNvdXJjZSAmJiBvbGRSZXNvdXJjZSkge1xuXHRcdFx0cmV0dXJuIG5ld1Jlc291cmNlLnRvU3RyaW5nKCkgIT09IG9sZFJlc291cmNlLnRvU3RyaW5nKCk7XG5cdFx0fVxuXG5cdFx0aWYgKCFuZXdSZXNvdXJjZSAmJiAhb2xkUmVzb3VyY2UpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgaGFzUGF0aExhYmVsQ2hhbmdlZChuZXdMYWJlbDogSVJlc291cmNlTGFiZWxQcm9wcyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IG5ld1Jlc291cmNlID0gdG9SZXNvdXJjZShuZXdMYWJlbCk7XG5cblx0XHRyZXR1cm4gISFuZXdSZXNvdXJjZSAmJiB0aGlzLmNvbXB1dGVkUGF0aExhYmVsICE9PSB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChuZXdSZXNvdXJjZSk7XG5cdH1cblxuXHRwcml2YXRlIGhhc0ljb25DaGFuZ2VkKG5ld09wdGlvbnM/OiBJUmVzb3VyY2VMYWJlbE9wdGlvbnMpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5vcHRpb25zPy5pY29uICE9PSBuZXdPcHRpb25zPy5pY29uO1xuXHR9XG5cblx0Y2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5sYWJlbCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLm9wdGlvbnMgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5jb21wdXRlZExhbmd1YWdlSWQgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5jb21wdXRlZEljb25DbGFzc2VzID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuY29tcHV0ZWRQYXRoTGFiZWwgPSB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLnNldExhYmVsKCcnKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyKG9wdGlvbnM6IHsgdXBkYXRlSWNvbjogYm9vbGVhbjsgdXBkYXRlRGVjb3JhdGlvbjogYm9vbGVhbiB9KTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuaXNIaWRkZW4pIHtcblx0XHRcdGlmICh0aGlzLm5lZWRzUmVkcmF3ICE9PSBSZWRyYXcuRnVsbCkge1xuXHRcdFx0XHR0aGlzLm5lZWRzUmVkcmF3ID0gKG9wdGlvbnMudXBkYXRlSWNvbiB8fCBvcHRpb25zLnVwZGF0ZURlY29yYXRpb24pID8gUmVkcmF3LkZ1bGwgOiBSZWRyYXcuQmFzaWM7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy51cGRhdGVJY29uKSB7XG5cdFx0XHR0aGlzLmNvbXB1dGVkSWNvbkNsYXNzZXMgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmxhYmVsKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaWNvbkxhYmVsT3B0aW9uczogSUljb25MYWJlbFZhbHVlT3B0aW9ucyAmIHsgZXh0cmFDbGFzc2VzOiBzdHJpbmdbXSB9ID0ge1xuXHRcdFx0dGl0bGU6ICcnLFxuXHRcdFx0aXRhbGljOiB0aGlzLm9wdGlvbnM/Lml0YWxpYyxcblx0XHRcdHN0cmlrZXRocm91Z2g6IHRoaXMub3B0aW9ucz8uc3RyaWtldGhyb3VnaCxcblx0XHRcdG1hdGNoZXM6IHRoaXMub3B0aW9ucz8ubWF0Y2hlcyxcblx0XHRcdGRlc2NyaXB0aW9uTWF0Y2hlczogdGhpcy5vcHRpb25zPy5kZXNjcmlwdGlvbk1hdGNoZXMsXG5cdFx0XHRleHRyYUNsYXNzZXM6IFtdLFxuXHRcdFx0c2VwYXJhdG9yOiB0aGlzLm9wdGlvbnM/LnNlcGFyYXRvcixcblx0XHRcdGRvbUlkOiB0aGlzLm9wdGlvbnM/LmRvbUlkLFxuXHRcdFx0ZGlzYWJsZWRDb21tYW5kOiB0aGlzLm9wdGlvbnM/LmRpc2FibGVkQ29tbWFuZCxcblx0XHRcdGxhYmVsRXNjYXBlTmV3TGluZXM6IHRoaXMub3B0aW9ucz8ubGFiZWxFc2NhcGVOZXdMaW5lcyxcblx0XHRcdGRlc2NyaXB0aW9uVGl0bGU6IHRoaXMub3B0aW9ucz8uZGVzY3JpcHRpb25UaXRsZSxcblx0XHR9O1xuXG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlKHRoaXMubGFiZWwpO1xuXG5cdFx0aWYgKHRoaXMub3B0aW9ucz8udGl0bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aWNvbkxhYmVsT3B0aW9ucy50aXRsZSA9IHRoaXMub3B0aW9ucy50aXRsZTtcblx0XHR9XG5cblx0XHRpZiAocmVzb3VyY2UgJiYgcmVzb3VyY2Uuc2NoZW1lICE9PSBTY2hlbWFzLmRhdGEgLyogZG8gbm90IGFjY2lkZW50YWxseSBpbmxpbmUgRGF0YSBVUklzICovXG5cdFx0XHQmJiAoXG5cdFx0XHRcdCghdGhpcy5vcHRpb25zPy50aXRsZSlcblx0XHRcdFx0fHwgKCh0eXBlb2YgdGhpcy5vcHRpb25zLnRpdGxlICE9PSAnc3RyaW5nJykgJiYgIXRoaXMub3B0aW9ucy50aXRsZS5tYXJrZG93bk5vdFN1cHBvcnRlZEZhbGxiYWNrKVxuXHRcdFx0KSkge1xuXG5cdFx0XHRpZiAoIXRoaXMuY29tcHV0ZWRQYXRoTGFiZWwpIHtcblx0XHRcdFx0dGhpcy5jb21wdXRlZFBhdGhMYWJlbCA9IHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHJlc291cmNlKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFpY29uTGFiZWxPcHRpb25zLnRpdGxlIHx8ICh0eXBlb2YgaWNvbkxhYmVsT3B0aW9ucy50aXRsZSA9PT0gJ3N0cmluZycpKSB7XG5cdFx0XHRcdGljb25MYWJlbE9wdGlvbnMudGl0bGUgPSB0aGlzLmNvbXB1dGVkUGF0aExhYmVsO1xuXHRcdFx0fSBlbHNlIGlmICghaWNvbkxhYmVsT3B0aW9ucy50aXRsZS5tYXJrZG93bk5vdFN1cHBvcnRlZEZhbGxiYWNrKSB7XG5cdFx0XHRcdGljb25MYWJlbE9wdGlvbnMudGl0bGUubWFya2Rvd25Ob3RTdXBwb3J0ZWRGYWxsYmFjayA9IHRoaXMuY29tcHV0ZWRQYXRoTGFiZWw7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3B0aW9ucyAmJiAhdGhpcy5vcHRpb25zLmhpZGVJY29uKSB7XG5cdFx0XHRpZiAoIXRoaXMuY29tcHV0ZWRJY29uQ2xhc3Nlcykge1xuXHRcdFx0XHR0aGlzLmNvbXB1dGVkSWNvbkNsYXNzZXMgPSBnZXRJY29uQ2xhc3Nlcyh0aGlzLm1vZGVsU2VydmljZSwgdGhpcy5sYW5ndWFnZVNlcnZpY2UsIHJlc291cmNlLCB0aGlzLm9wdGlvbnMuZmlsZUtpbmQsIHRoaXMub3B0aW9ucy5pY29uKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKFVSSS5pc1VyaSh0aGlzLm9wdGlvbnMuaWNvbikpIHtcblx0XHRcdFx0aWNvbkxhYmVsT3B0aW9ucy5pY29uUGF0aCA9IHRoaXMub3B0aW9ucy5pY29uO1xuXHRcdFx0fVxuXG5cdFx0XHRpY29uTGFiZWxPcHRpb25zLmV4dHJhQ2xhc3NlcyA9IHRoaXMuY29tcHV0ZWRJY29uQ2xhc3Nlcy5zbGljZSgwKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5vcHRpb25zPy5leHRyYUNsYXNzZXMpIHtcblx0XHRcdGljb25MYWJlbE9wdGlvbnMuZXh0cmFDbGFzc2VzLnB1c2goLi4udGhpcy5vcHRpb25zLmV4dHJhQ2xhc3Nlcyk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3B0aW9ucz8uZmlsZURlY29yYXRpb25zICYmIHJlc291cmNlKSB7XG5cdFx0XHRpZiAob3B0aW9ucy51cGRhdGVEZWNvcmF0aW9uKSB7XG5cdFx0XHRcdHRoaXMuZGVjb3JhdGlvbi52YWx1ZSA9IHRoaXMuZGVjb3JhdGlvbnNTZXJ2aWNlLmdldERlY29yYXRpb24ocmVzb3VyY2UsIHRoaXMub3B0aW9ucy5maWxlS2luZCAhPT0gRmlsZUtpbmQuRklMRSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRlY29yYXRpb24gPSB0aGlzLmRlY29yYXRpb24udmFsdWU7XG5cdFx0XHRpZiAoZGVjb3JhdGlvbikge1xuXHRcdFx0XHRpZiAoZGVjb3JhdGlvbi50b29sdGlwKSB7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBpY29uTGFiZWxPcHRpb25zLnRpdGxlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0aWNvbkxhYmVsT3B0aW9ucy50aXRsZSA9IGAke2ljb25MYWJlbE9wdGlvbnMudGl0bGV9IFx1MjAyMiAke2RlY29yYXRpb24udG9vbHRpcH1gO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIGljb25MYWJlbE9wdGlvbnMudGl0bGU/Lm1hcmtkb3duID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0Y29uc3QgdGl0bGUgPSBgJHtpY29uTGFiZWxPcHRpb25zLnRpdGxlLm1hcmtkb3dufSBcdTIwMjIgJHtkZWNvcmF0aW9uLnRvb2x0aXB9YDtcblx0XHRcdFx0XHRcdGljb25MYWJlbE9wdGlvbnMudGl0bGUgPSB7IG1hcmtkb3duOiB0aXRsZSwgbWFya2Rvd25Ob3RTdXBwb3J0ZWRGYWxsYmFjazogdGl0bGUgfTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZGVjb3JhdGlvbi5zdHJpa2V0aHJvdWdoKSB7XG5cdFx0XHRcdFx0aWNvbkxhYmVsT3B0aW9ucy5zdHJpa2V0aHJvdWdoID0gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLm9wdGlvbnMuZmlsZURlY29yYXRpb25zLmNvbG9ycykge1xuXHRcdFx0XHRcdGljb25MYWJlbE9wdGlvbnMuZXh0cmFDbGFzc2VzLnB1c2goZGVjb3JhdGlvbi5sYWJlbENsYXNzTmFtZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5vcHRpb25zLmZpbGVEZWNvcmF0aW9ucy5iYWRnZXMpIHtcblx0XHRcdFx0XHRpY29uTGFiZWxPcHRpb25zLmV4dHJhQ2xhc3Nlcy5wdXNoKGRlY29yYXRpb24uYmFkZ2VDbGFzc05hbWUpO1xuXHRcdFx0XHRcdGljb25MYWJlbE9wdGlvbnMuZXh0cmFDbGFzc2VzLnB1c2goZGVjb3JhdGlvbi5pY29uQ2xhc3NOYW1lKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmxhYmVsLnJhbmdlKSB7XG5cdFx0XHRpY29uTGFiZWxPcHRpb25zLnN1ZmZpeCA9IHRoaXMubGFiZWwucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICE9PSB0aGlzLmxhYmVsLnJhbmdlLmVuZExpbmVOdW1iZXIgP1xuXHRcdFx0XHRgOiR7dGhpcy5sYWJlbC5yYW5nZS5zdGFydExpbmVOdW1iZXJ9LSR7dGhpcy5sYWJlbC5yYW5nZS5lbmRMaW5lTnVtYmVyfWAgOlxuXHRcdFx0XHRgOiR7dGhpcy5sYWJlbC5yYW5nZS5zdGFydExpbmVOdW1iZXJ9YDtcblx0XHR9XG5cblx0XHR0aGlzLnNldExhYmVsKHRoaXMubGFiZWwubmFtZSA/PyAnJywgdGhpcy5sYWJlbC5kZXNjcmlwdGlvbiwgaWNvbkxhYmVsT3B0aW9ucyk7XG5cblx0XHR0aGlzLl9vbkRpZFJlbmRlci5maXJlKCk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXG5cdFx0dGhpcy5sYWJlbCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLm9wdGlvbnMgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5jb21wdXRlZExhbmd1YWdlSWQgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5jb21wdXRlZEljb25DbGFzc2VzID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuY29tcHV0ZWRQYXRoTGFiZWwgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5jb21wdXRlZFdvcmtzcGFjZUZvbGRlckxhYmVsID0gdW5kZWZpbmVkO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsV0FBVztBQUNwQixTQUFTLFNBQVMsU0FBUywyQkFBMkI7QUFDdEQsU0FBUyxpQkFBb0U7QUFDN0UsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx3QkFBd0I7QUFDakMsU0FBc0IsMkJBQTJEO0FBQ2pGLFNBQVMsZUFBZTtBQUN4QixTQUFTLFVBQVUsaUNBQWlDO0FBRXBELFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsT0FBTyxlQUFlO0FBQy9CLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsWUFBWSxTQUFzQix5QkFBeUI7QUFDcEUsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw0QkFBNEI7QUFHckMsU0FBUywwQkFBMEIsZ0NBQWdDO0FBU25FLFNBQVMsV0FBVyxPQUF5RDtBQUM1RSxNQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sVUFBVTtBQUM5QixXQUFPO0FBQUEsRUFDUjtBQUVBLE1BQUksSUFBSSxNQUFNLE1BQU0sUUFBUSxHQUFHO0FBQzlCLFdBQU8sTUFBTTtBQUFBLEVBQ2Q7QUFFQSxTQUFPLE1B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QUssV0FBVztBQUNuQyxVQUFJLFlBQVk7QUFDZixZQUFJLFdBQVcsU0FBUztBQUN2QixjQUFJLE9BQU8saUJBQWlCLFVBQVUsVUFBVTtBQUMvQyw2QkFBaUIsUUFBUSxHQUFHLGlCQUFpQixLQUFLLFdBQU0sV0FBVyxPQUFPO0FBQUEsVUFDM0UsV0FBVyxPQUFPLGlCQUFpQixPQUFPLGFBQWEsVUFBVTtBQUNoRSxrQkFBTSxRQUFRLEdBQUcsaUJBQWlCLE1BQU0sUUFBUSxXQUFNLFdBQVcsT0FBTztBQUN4RSw2QkFBaUIsUUFBUSxFQUFFLFVBQVUsT0FBTyw4QkFBOEIsTUFBTTtBQUFBLFVBQ2pGO0FBQUEsUUFDRDtBQUVBLFlBQUksV0FBVyxlQUFlO0FBQzdCLDJCQUFpQixnQkFBZ0I7QUFBQSxRQUNsQztBQUVBLFlBQUksS0FBSyxRQUFRLGdCQUFnQixRQUFRO0FBQ3hDLDJCQUFpQixhQUFhLEtBQUssV0FBVyxjQUFjO0FBQUEsUUFDN0Q7QUFFQSxZQUFJLEtBQUssUUFBUSxnQkFBZ0IsUUFBUTtBQUN4QywyQkFBaUIsYUFBYSxLQUFLLFdBQVcsY0FBYztBQUM1RCwyQkFBaUIsYUFBYSxLQUFLLFdBQVcsYUFBYTtBQUFBLFFBQzVEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxRQUFJLEtBQUssTUFBTSxPQUFPO0FBQ3JCLHVCQUFpQixTQUFTLEtBQUssTUFBTSxNQUFNLG9CQUFvQixLQUFLLE1BQU0sTUFBTSxnQkFDL0UsSUFBSSxLQUFLLE1BQU0sTUFBTSxlQUFlLElBQUksS0FBSyxNQUFNLE1BQU0sYUFBYSxLQUN0RSxJQUFJLEtBQUssTUFBTSxNQUFNLGVBQWU7QUFBQSxJQUN0QztBQUVBLFNBQUssU0FBUyxLQUFLLE1BQU0sUUFBUSxJQUFJLEtBQUssTUFBTSxhQUFhLGdCQUFnQjtBQUU3RSxTQUFLLGFBQWEsS0FBSztBQUV2QixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVMsVUFBZ0I7QUFDeEIsVUFBTSxRQUFRO0FBRWQsU0FBSyxRQUFRO0FBQ2IsU0FBSyxVQUFVO0FBQ2YsU0FBSyxxQkFBcUI7QUFDMUIsU0FBSyxzQkFBc0I7QUFDM0IsU0FBSyxvQkFBb0I7QUFDekIsU0FBSywrQkFBK0I7QUFBQSxFQUNyQztBQUNEO0FBemFNLHNCQUFOO0FBQUEsRUFvQkc7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQTFCRzsiLAogICJuYW1lcyI6IFsibGFiZWwiLCAib3B0aW9ucyIsICJSZWRyYXciXQp9Cg==
