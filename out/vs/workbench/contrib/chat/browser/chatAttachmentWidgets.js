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
import * as dom from "../../../../base/browser/dom.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { $, addDisposableListener } from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { FileKind } from "../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IThemeService, FolderThemeIcon } from "../../../../platform/theme/common/themeService.js";
import { revealInSideBarCommand } from "../../files/browser/fileActions.contribution.js";
import { ILanguageModelsService } from "../common/languageModels.js";
import { hookUpResourceAttachmentDragAndContextMenu, hookUpSymbolAttachmentDragAndContextMenu } from "./chatContentParts/chatAttachmentsContentPart.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { basename, dirname } from "../../../../base/common/path.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
let AbstractChatAttachmentWidget = class extends Disposable {
  constructor(attachment, shouldFocusClearButton, container, contextResourceLabels, hoverDelegate, currentLanguageModel, commandService, openerService) {
    super();
    this.attachment = attachment;
    this.shouldFocusClearButton = shouldFocusClearButton;
    this.hoverDelegate = hoverDelegate;
    this.currentLanguageModel = currentLanguageModel;
    this.commandService = commandService;
    this.openerService = openerService;
    this._onDidDelete = this._register(new Emitter());
    this.element = dom.append(container, $(".chat-attached-context-attachment.show-file-icons"));
    this.label = contextResourceLabels.create(this.element, { supportIcons: true, hoverDelegate, hoverTargetOverride: this.element });
    this._register(this.label);
    this.element.tabIndex = 0;
  }
  get onDidDelete() {
    return this._onDidDelete.event;
  }
  modelSupportsVision() {
    return this.currentLanguageModel?.metadata.capabilities?.vision ?? false;
  }
  attachClearButton() {
    const clearButton = new Button(this.element, {
      supportIcons: true,
      hoverDelegate: this.hoverDelegate,
      title: localize("chat.attachment.clearButton", "Remove from context")
    });
    clearButton.icon = Codicon.close;
    this._register(clearButton);
    this._register(Event.once(clearButton.onDidClick)((e) => {
      this._onDidDelete.fire(e);
    }));
    if (this.shouldFocusClearButton) {
      clearButton.focus();
    }
  }
  addResourceOpenHandlers(resource, range) {
    this.element.style.cursor = "pointer";
    this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, (e) => {
      dom.EventHelper.stop(e, true);
      if (this.attachment.isDirectory) {
        this.openResource(resource, true);
      } else {
        this.openResource(resource, false, range);
      }
    }));
    this._register(dom.addDisposableListener(this.element, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        dom.EventHelper.stop(e, true);
        if (this.attachment.isDirectory) {
          this.openResource(resource, true);
        } else {
          this.openResource(resource, false, range);
        }
      }
    }));
  }
  openResource(resource, isDirectory, range) {
    if (isDirectory) {
      this.commandService.executeCommand(revealInSideBarCommand.id, resource);
      return;
    }
    const openTextEditorOptions = range ? { selection: range } : void 0;
    const options = {
      fromUserGesture: true,
      editorOptions: openTextEditorOptions
    };
    this.openerService.open(resource, options);
  }
};
AbstractChatAttachmentWidget = __decorateClass([
  __decorateParam(6, ICommandService),
  __decorateParam(7, IOpenerService)
], AbstractChatAttachmentWidget);
let FileAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(resource, range, attachment, currentLanguageModel, shouldFocusClearButton, container, contextResourceLabels, hoverDelegate, commandService, openerService, themeService, hoverService, languageModelsService, instantiationService) {
    super(attachment, shouldFocusClearButton, container, contextResourceLabels, hoverDelegate, currentLanguageModel, commandService, openerService);
    this.themeService = themeService;
    this.hoverService = hoverService;
    this.languageModelsService = languageModelsService;
    this.instantiationService = instantiationService;
    const fileBasename = basename(resource.path);
    const fileDirname = dirname(resource.path);
    const friendlyName = `${fileBasename} ${fileDirname}`;
    const ariaLabel = range ? localize("chat.fileAttachmentWithRange", "Attached file, {0}, line {1} to line {2}", friendlyName, range.startLineNumber, range.endLineNumber) : localize("chat.fileAttachment", "Attached file, {0}", friendlyName);
    this.element.ariaLabel = ariaLabel;
    if (attachment.isOmitted) {
      this.renderOmittedWarning(friendlyName, ariaLabel, hoverDelegate);
    } else {
      const fileOptions = { hidePath: true };
      this.label.setFile(resource, attachment.isFile ? {
        ...fileOptions,
        fileKind: FileKind.FILE,
        range
      } : {
        ...fileOptions,
        fileKind: FileKind.FOLDER,
        icon: !this.themeService.getFileIconTheme().hasFolderIcons ? FolderThemeIcon : void 0
      });
    }
    this.instantiationService.invokeFunction((accessor) => {
      this._register(hookUpResourceAttachmentDragAndContextMenu(accessor, this.element, resource));
    });
    this.addResourceOpenHandlers(resource, range);
    this.attachClearButton();
  }
  renderOmittedWarning(friendlyName, ariaLabel, hoverDelegate) {
    const pillIcon = dom.$("div.chat-attached-context-pill", {}, dom.$("span.codicon.codicon-warning"));
    const textLabel = dom.$("span.chat-attached-context-custom-text", {}, friendlyName);
    this.element.appendChild(pillIcon);
    this.element.appendChild(textLabel);
    const hoverElement = dom.$("div.chat-attached-context-hover");
    hoverElement.setAttribute("aria-label", ariaLabel);
    this.element.classList.add("warning");
    hoverElement.textContent = localize("chat.fileAttachmentHover", "{0} does not support this {1} type.", this.currentLanguageModel ? this.languageModelsService.lookupLanguageModel(this.currentLanguageModel.identifier)?.name : this.currentLanguageModel, "file");
    this._register(this.hoverService.setupManagedHover(hoverDelegate, this.element, hoverElement, { trapFocus: true }));
  }
};
FileAttachmentWidget = __decorateClass([
  __decorateParam(8, ICommandService),
  __decorateParam(9, IOpenerService),
  __decorateParam(10, IThemeService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, ILanguageModelsService),
  __decorateParam(13, IInstantiationService)
], FileAttachmentWidget);
let ImageAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(resource, attachment, currentLanguageModel, shouldFocusClearButton, container, contextResourceLabels, hoverDelegate, commandService, openerService, hoverService, languageModelsService, telemetryService) {
    super(attachment, shouldFocusClearButton, container, contextResourceLabels, hoverDelegate, currentLanguageModel, commandService, openerService);
    this.hoverService = hoverService;
    this.languageModelsService = languageModelsService;
    this.telemetryService = telemetryService;
    const ariaLabel = localize("chat.imageAttachment", "Attached image, {0}", attachment.name);
    this.element.ariaLabel = ariaLabel;
    this.element.style.position = "relative";
    if (attachment.references) {
      this.element.style.cursor = "pointer";
      const clickHandler = () => {
        if (attachment.references && URI.isUri(attachment.references[0].reference)) {
          this.openResource(attachment.references[0].reference, false, void 0);
        }
      };
      this._register(addDisposableListener(this.element, "click", clickHandler));
    }
    const pillIcon = dom.$("div.chat-attached-context-pill", {}, dom.$(this.modelSupportsVision() ? "span.codicon.codicon-file-media" : "span.codicon.codicon-warning"));
    const textLabel = dom.$("span.chat-attached-context-custom-text", {}, attachment.name);
    this.element.appendChild(pillIcon);
    this.element.appendChild(textLabel);
    const hoverElement = dom.$("div.chat-attached-context-hover");
    hoverElement.setAttribute("aria-label", ariaLabel);
    const currentLanguageModelName = this.currentLanguageModel ? this.languageModelsService.lookupLanguageModel(this.currentLanguageModel.identifier)?.name ?? this.currentLanguageModel.identifier : "unknown";
    const supportsVision = this.modelSupportsVision();
    this.telemetryService.publicLog2("copilot.attachImage", {
      currentModel: currentLanguageModelName,
      supportsVision
    });
    if (!supportsVision && this.currentLanguageModel) {
      this.element.classList.add("warning");
      hoverElement.textContent = localize("chat.fileAttachmentHover", "{0} does not support this {1} type.", currentLanguageModelName, "image");
      this._register(this.hoverService.setupManagedHover(hoverDelegate, this.element, hoverElement, { trapFocus: true }));
    } else {
      const buffer = attachment.value;
      this.createImageElements(buffer, this.element, hoverElement);
      this._register(this.hoverService.setupManagedHover(hoverDelegate, this.element, hoverElement, { trapFocus: false }));
    }
    if (resource) {
      this.addResourceOpenHandlers(resource, void 0);
    }
    this.attachClearButton();
  }
  createImageElements(buffer, widget, hoverElement) {
    const blob = new Blob([buffer], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const pillImg = dom.$("img.chat-attached-context-pill-image", { src: url, alt: "" });
    const pill = dom.$("div.chat-attached-context-pill", {}, pillImg);
    const existingPill = widget.querySelector(".chat-attached-context-pill");
    if (existingPill) {
      existingPill.replaceWith(pill);
    }
    const hoverImage = dom.$("img.chat-attached-context-image", { src: url, alt: "" });
    hoverElement.appendChild(hoverImage);
    hoverImage.onload = () => {
      URL.revokeObjectURL(url);
    };
    hoverImage.onerror = () => {
      const pillIcon = dom.$("div.chat-attached-context-pill", {}, dom.$("span.codicon.codicon-file-media"));
      const pill2 = dom.$("div.chat-attached-context-pill", {}, pillIcon);
      const existingPill2 = widget.querySelector(".chat-attached-context-pill");
      if (existingPill2) {
        existingPill2.replaceWith(pill2);
      }
    };
  }
};
ImageAttachmentWidget = __decorateClass([
  __decorateParam(7, ICommandService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, ILanguageModelsService),
  __decorateParam(11, ITelemetryService)
], ImageAttachmentWidget);
let PasteAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(attachment, currentLanguageModel, shouldFocusClearButton, container, contextResourceLabels, hoverDelegate, commandService, openerService, hoverService, instantiationService) {
    super(attachment, shouldFocusClearButton, container, contextResourceLabels, hoverDelegate, currentLanguageModel, commandService, openerService);
    this.hoverService = hoverService;
    this.instantiationService = instantiationService;
    const ariaLabel = localize("chat.attachment", "Attached context, {0}", attachment.name);
    this.element.ariaLabel = ariaLabel;
    const classNames = ["file-icon", `${attachment.language}-lang-file-icon`];
    let resource;
    let range;
    if (attachment.copiedFrom) {
      resource = attachment.copiedFrom.uri;
      range = attachment.copiedFrom.range;
      const filename = basename(resource.path);
      this.label.setLabel(filename, void 0, { extraClasses: classNames });
    } else {
      this.label.setLabel(attachment.fileName, void 0, { extraClasses: classNames });
    }
    this.element.appendChild(dom.$("span.attachment-additional-info", {}, `Pasted ${attachment.pastedLines}`));
    this.element.style.position = "relative";
    const sourceUri = attachment.copiedFrom?.uri;
    const hoverContent = {
      markdown: {
        value: `${sourceUri ? this.instantiationService.invokeFunction((accessor) => accessor.get(ILabelService).getUriLabel(sourceUri, { relative: true })) : attachment.fileName}

---

\`\`\`${attachment.language}

${attachment.code}
\`\`\``
      },
      markdownNotSupportedFallback: attachment.code
    };
    this._register(this.hoverService.setupManagedHover(hoverDelegate, this.element, hoverContent, { trapFocus: true }));
    const copiedFromResource = attachment.copiedFrom?.uri;
    if (copiedFromResource) {
      this._register(this.instantiationService.invokeFunction((accessor) => hookUpResourceAttachmentDragAndContextMenu(accessor, this.element, copiedFromResource)));
      this.addResourceOpenHandlers(copiedFromResource, range);
    }
    this.attachClearButton();
  }
};
PasteAttachmentWidget = __decorateClass([
  __decorateParam(6, ICommandService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IHoverService),
  __decorateParam(9, IInstantiationService)
], PasteAttachmentWidget);
let DefaultChatAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(resource, range, attachment, currentLanguageModel, shouldFocusClearButton, container, contextResourceLabels, hoverDelegate, commandService, openerService, contextKeyService, instantiationService) {
    super(attachment, shouldFocusClearButton, container, contextResourceLabels, hoverDelegate, currentLanguageModel, commandService, openerService);
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    const attachmentLabel = attachment.fullName ?? attachment.name;
    const withIcon = attachment.icon?.id ? `$(${attachment.icon.id}) ${attachmentLabel}` : attachmentLabel;
    this.label.setLabel(withIcon, void 0);
    this.element.ariaLabel = localize("chat.attachment", "Attached context, {0}", attachment.name);
    if (attachment.kind === "diagnostic") {
      if (attachment.filterUri) {
        resource = attachment.filterUri ? URI.revive(attachment.filterUri) : void 0;
        range = attachment.filterRange;
      } else {
        this.element.style.cursor = "pointer";
        this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, () => {
          this.commandService.executeCommand("workbench.panel.markers.view.focus");
        }));
      }
    }
    if (attachment.kind === "symbol") {
      const scopedContextKeyService = this._register(this.contextKeyService.createScoped(this.element));
      this._register(this.instantiationService.invokeFunction((accessor) => hookUpSymbolAttachmentDragAndContextMenu(accessor, this.element, scopedContextKeyService, { ...attachment, kind: attachment.symbolKind }, MenuId.ChatInputSymbolAttachmentContext)));
    }
    if (resource) {
      this.addResourceOpenHandlers(resource, range);
    }
    this.attachClearButton();
  }
};
DefaultChatAttachmentWidget = __decorateClass([
  __decorateParam(8, ICommandService),
  __decorateParam(9, IOpenerService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IInstantiationService)
], DefaultChatAttachmentWidget);
export {
  DefaultChatAttachmentWidget,
  FileAttachmentWidget,
  ImageAttachmentWidget,
  PasteAttachmentWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEF0dGFjaG1lbnRXaWRnZXRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyAkLCBhZGREaXNwb3NhYmxlTGlzdGVuZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IElIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGUuanMnO1xuaW1wb3J0IHsgSU1hbmFnZWRIb3ZlclRvb2x0aXBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJVGV4dEVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBGaWxlS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UsIE9wZW5JbnRlcm5hbE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlLCBGb2xkZXJUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElSZXNvdXJjZUxhYmVsLCBSZXNvdXJjZUxhYmVscywgSUZpbGVMYWJlbE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2xhYmVscy5qcyc7XG5pbXBvcnQgeyByZXZlYWxJblNpZGVCYXJDb21tYW5kIH0gZnJvbSAnLi4vLi4vZmlsZXMvYnJvd3Nlci9maWxlQWN0aW9ucy5jb250cmlidXRpb24uanMnO1xuaW1wb3J0IHsgSUNoYXRSZXF1ZXN0UGFzdGVWYXJpYWJsZUVudHJ5LCBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5IH0gZnJvbSAnLi4vY29tbW9uL2NoYXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VNb2RlbENoYXRNZXRhZGF0YUFuZElkZW50aWZpZXIsIElMYW5ndWFnZU1vZGVsc1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbGFuZ3VhZ2VNb2RlbHMuanMnO1xuaW1wb3J0IHsgaG9va1VwUmVzb3VyY2VBdHRhY2htZW50RHJhZ0FuZENvbnRleHRNZW51LCBob29rVXBTeW1ib2xBdHRhY2htZW50RHJhZ0FuZENvbnRleHRNZW51IH0gZnJvbSAnLi9jaGF0Q29udGVudFBhcnRzL2NoYXRBdHRhY2htZW50c0NvbnRlbnRQYXJ0LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuXG5hYnN0cmFjdCBjbGFzcyBBYnN0cmFjdENoYXRBdHRhY2htZW50V2lkZ2V0IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHB1YmxpYyByZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudDtcblx0cHVibGljIHJlYWRvbmx5IGxhYmVsOiBJUmVzb3VyY2VMYWJlbDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZERlbGV0ZTogRW1pdHRlcjxnbG9iYWxUaGlzLkV2ZW50PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGdsb2JhbFRoaXMuRXZlbnQ+KCkpO1xuXHRnZXQgb25EaWREZWxldGUoKTogRXZlbnQ8Z2xvYmFsVGhpcy5FdmVudD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZERlbGV0ZS5ldmVudDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYXR0YWNobWVudDogSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHNob3VsZEZvY3VzQ2xlYXJCdXR0b246IGJvb2xlYW4sXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRjb250ZXh0UmVzb3VyY2VMYWJlbHM6IFJlc291cmNlTGFiZWxzLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBob3ZlckRlbGVnYXRlOiBJSG92ZXJEZWxlZ2F0ZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgY3VycmVudExhbmd1YWdlTW9kZWw6IElMYW5ndWFnZU1vZGVsQ2hhdE1ldGFkYXRhQW5kSWRlbnRpZmllciB8IHVuZGVmaW5lZCxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5lbGVtZW50ID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5jaGF0LWF0dGFjaGVkLWNvbnRleHQtYXR0YWNobWVudC5zaG93LWZpbGUtaWNvbnMnKSk7XG5cdFx0dGhpcy5sYWJlbCA9IGNvbnRleHRSZXNvdXJjZUxhYmVscy5jcmVhdGUodGhpcy5lbGVtZW50LCB7IHN1cHBvcnRJY29uczogdHJ1ZSwgaG92ZXJEZWxlZ2F0ZSwgaG92ZXJUYXJnZXRPdmVycmlkZTogdGhpcy5lbGVtZW50IH0pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFiZWwpO1xuXHRcdHRoaXMuZWxlbWVudC50YWJJbmRleCA9IDA7XG5cdH1cblxuXHRwcm90ZWN0ZWQgbW9kZWxTdXBwb3J0c1Zpc2lvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5jdXJyZW50TGFuZ3VhZ2VNb2RlbD8ubWV0YWRhdGEuY2FwYWJpbGl0aWVzPy52aXNpb24gPz8gZmFsc2U7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXR0YWNoQ2xlYXJCdXR0b24oKSB7XG5cdFx0Y29uc3QgY2xlYXJCdXR0b24gPSBuZXcgQnV0dG9uKHRoaXMuZWxlbWVudCwge1xuXHRcdFx0c3VwcG9ydEljb25zOiB0cnVlLFxuXHRcdFx0aG92ZXJEZWxlZ2F0ZTogdGhpcy5ob3ZlckRlbGVnYXRlLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjaGF0LmF0dGFjaG1lbnQuY2xlYXJCdXR0b24nLCBcIlJlbW92ZSBmcm9tIGNvbnRleHRcIilcblx0XHR9KTtcblx0XHRjbGVhckJ1dHRvbi5pY29uID0gQ29kaWNvbi5jbG9zZTtcblx0XHR0aGlzLl9yZWdpc3RlcihjbGVhckJ1dHRvbik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQub25jZShjbGVhckJ1dHRvbi5vbkRpZENsaWNrKSgoZSkgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWREZWxldGUuZmlyZShlKTtcblx0XHR9KSk7XG5cdFx0aWYgKHRoaXMuc2hvdWxkRm9jdXNDbGVhckJ1dHRvbikge1xuXHRcdFx0Y2xlYXJCdXR0b24uZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWRkUmVzb3VyY2VPcGVuSGFuZGxlcnMocmVzb3VyY2U6IFVSSSwgcmFuZ2U6IElSYW5nZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuZWxlbWVudC5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssIChlOiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblx0XHRcdGlmICh0aGlzLmF0dGFjaG1lbnQuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0dGhpcy5vcGVuUmVzb3VyY2UocmVzb3VyY2UsIHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5vcGVuUmVzb3VyY2UocmVzb3VyY2UsIGZhbHNlLCByYW5nZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIGRvbS5FdmVudFR5cGUuS0VZX0RPV04sIChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuRW50ZXIpIHx8IGV2ZW50LmVxdWFscyhLZXlDb2RlLlNwYWNlKSkge1xuXHRcdFx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblx0XHRcdFx0aWYgKHRoaXMuYXR0YWNobWVudC5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdHRoaXMub3BlblJlc291cmNlKHJlc291cmNlLCB0cnVlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLm9wZW5SZXNvdXJjZShyZXNvdXJjZSwgZmFsc2UsIHJhbmdlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvcGVuUmVzb3VyY2UocmVzb3VyY2U6IFVSSSwgaXNEaXJlY3Rvcnk6IHRydWUpOiB2b2lkO1xuXHRwcm90ZWN0ZWQgb3BlblJlc291cmNlKHJlc291cmNlOiBVUkksIGlzRGlyZWN0b3J5OiBmYWxzZSwgcmFuZ2U6IElSYW5nZSB8IHVuZGVmaW5lZCk6IHZvaWQ7XG5cdHByb3RlY3RlZCBvcGVuUmVzb3VyY2UocmVzb3VyY2U6IFVSSSwgaXNEaXJlY3Rvcnk/OiBib29sZWFuLCByYW5nZT86IElSYW5nZSk6IHZvaWQge1xuXHRcdGlmIChpc0RpcmVjdG9yeSkge1xuXHRcdFx0Ly8gUmV2ZWFsIERpcmVjdG9yeSBpbiBleHBsb3JlclxuXHRcdFx0dGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChyZXZlYWxJblNpZGVCYXJDb21tYW5kLmlkLCByZXNvdXJjZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gT3BlbiBmaWxlIGluIGVkaXRvclxuXHRcdGNvbnN0IG9wZW5UZXh0RWRpdG9yT3B0aW9uczogSVRleHRFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkID0gcmFuZ2UgPyB7IHNlbGVjdGlvbjogcmFuZ2UgfSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBvcHRpb25zOiBPcGVuSW50ZXJuYWxPcHRpb25zID0ge1xuXHRcdFx0ZnJvbVVzZXJHZXN0dXJlOiB0cnVlLFxuXHRcdFx0ZWRpdG9yT3B0aW9uczogb3BlblRleHRFZGl0b3JPcHRpb25zLFxuXHRcdH07XG5cdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4ocmVzb3VyY2UsIG9wdGlvbnMpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBGaWxlQXR0YWNobWVudFdpZGdldCBleHRlbmRzIEFic3RyYWN0Q2hhdEF0dGFjaG1lbnRXaWRnZXQge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlc291cmNlOiBVUkksXG5cdFx0cmFuZ2U6IElSYW5nZSB8IHVuZGVmaW5lZCxcblx0XHRhdHRhY2htZW50OiBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5LFxuXHRcdGN1cnJlbnRMYW5ndWFnZU1vZGVsOiBJTGFuZ3VhZ2VNb2RlbENoYXRNZXRhZGF0YUFuZElkZW50aWZpZXIgfCB1bmRlZmluZWQsXG5cdFx0c2hvdWxkRm9jdXNDbGVhckJ1dHRvbjogYm9vbGVhbixcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdGNvbnRleHRSZXNvdXJjZUxhYmVsczogUmVzb3VyY2VMYWJlbHMsXG5cdFx0aG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGUsXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUxhbmd1YWdlTW9kZWxzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlTW9kZWxzU2VydmljZTogSUxhbmd1YWdlTW9kZWxzU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoYXR0YWNobWVudCwgc2hvdWxkRm9jdXNDbGVhckJ1dHRvbiwgY29udGFpbmVyLCBjb250ZXh0UmVzb3VyY2VMYWJlbHMsIGhvdmVyRGVsZWdhdGUsIGN1cnJlbnRMYW5ndWFnZU1vZGVsLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSk7XG5cblx0XHRjb25zdCBmaWxlQmFzZW5hbWUgPSBiYXNlbmFtZShyZXNvdXJjZS5wYXRoKTtcblx0XHRjb25zdCBmaWxlRGlybmFtZSA9IGRpcm5hbWUocmVzb3VyY2UucGF0aCk7XG5cdFx0Y29uc3QgZnJpZW5kbHlOYW1lID0gYCR7ZmlsZUJhc2VuYW1lfSAke2ZpbGVEaXJuYW1lfWA7XG5cdFx0Y29uc3QgYXJpYUxhYmVsID0gcmFuZ2UgPyBsb2NhbGl6ZSgnY2hhdC5maWxlQXR0YWNobWVudFdpdGhSYW5nZScsIFwiQXR0YWNoZWQgZmlsZSwgezB9LCBsaW5lIHsxfSB0byBsaW5lIHsyfVwiLCBmcmllbmRseU5hbWUsIHJhbmdlLnN0YXJ0TGluZU51bWJlciwgcmFuZ2UuZW5kTGluZU51bWJlcikgOiBsb2NhbGl6ZSgnY2hhdC5maWxlQXR0YWNobWVudCcsIFwiQXR0YWNoZWQgZmlsZSwgezB9XCIsIGZyaWVuZGx5TmFtZSk7XG5cdFx0dGhpcy5lbGVtZW50LmFyaWFMYWJlbCA9IGFyaWFMYWJlbDtcblxuXHRcdGlmIChhdHRhY2htZW50LmlzT21pdHRlZCkge1xuXHRcdFx0dGhpcy5yZW5kZXJPbWl0dGVkV2FybmluZyhmcmllbmRseU5hbWUsIGFyaWFMYWJlbCwgaG92ZXJEZWxlZ2F0ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGZpbGVPcHRpb25zOiBJRmlsZUxhYmVsT3B0aW9ucyA9IHsgaGlkZVBhdGg6IHRydWUgfTtcblx0XHRcdHRoaXMubGFiZWwuc2V0RmlsZShyZXNvdXJjZSwgYXR0YWNobWVudC5pc0ZpbGUgPyB7XG5cdFx0XHRcdC4uLmZpbGVPcHRpb25zLFxuXHRcdFx0XHRmaWxlS2luZDogRmlsZUtpbmQuRklMRSxcblx0XHRcdFx0cmFuZ2UsXG5cdFx0XHR9IDoge1xuXHRcdFx0XHQuLi5maWxlT3B0aW9ucyxcblx0XHRcdFx0ZmlsZUtpbmQ6IEZpbGVLaW5kLkZPTERFUixcblx0XHRcdFx0aWNvbjogIXRoaXMudGhlbWVTZXJ2aWNlLmdldEZpbGVJY29uVGhlbWUoKS5oYXNGb2xkZXJJY29ucyA/IEZvbGRlclRoZW1lSWNvbiA6IHVuZGVmaW5lZFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcihob29rVXBSZXNvdXJjZUF0dGFjaG1lbnREcmFnQW5kQ29udGV4dE1lbnUoYWNjZXNzb3IsIHRoaXMuZWxlbWVudCwgcmVzb3VyY2UpKTtcblx0XHR9KTtcblx0XHR0aGlzLmFkZFJlc291cmNlT3BlbkhhbmRsZXJzKHJlc291cmNlLCByYW5nZSk7XG5cblx0XHR0aGlzLmF0dGFjaENsZWFyQnV0dG9uKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck9taXR0ZWRXYXJuaW5nKGZyaWVuZGx5TmFtZTogc3RyaW5nLCBhcmlhTGFiZWw6IHN0cmluZywgaG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGUpIHtcblx0XHRjb25zdCBwaWxsSWNvbiA9IGRvbS4kKCdkaXYuY2hhdC1hdHRhY2hlZC1jb250ZXh0LXBpbGwnLCB7fSwgZG9tLiQoJ3NwYW4uY29kaWNvbi5jb2RpY29uLXdhcm5pbmcnKSk7XG5cdFx0Y29uc3QgdGV4dExhYmVsID0gZG9tLiQoJ3NwYW4uY2hhdC1hdHRhY2hlZC1jb250ZXh0LWN1c3RvbS10ZXh0Jywge30sIGZyaWVuZGx5TmFtZSk7XG5cdFx0dGhpcy5lbGVtZW50LmFwcGVuZENoaWxkKHBpbGxJY29uKTtcblx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQodGV4dExhYmVsKTtcblxuXHRcdGNvbnN0IGhvdmVyRWxlbWVudCA9IGRvbS4kKCdkaXYuY2hhdC1hdHRhY2hlZC1jb250ZXh0LWhvdmVyJyk7XG5cdFx0aG92ZXJFbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGFyaWFMYWJlbCk7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3dhcm5pbmcnKTtcblxuXHRcdGhvdmVyRWxlbWVudC50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdjaGF0LmZpbGVBdHRhY2htZW50SG92ZXInLCBcInswfSBkb2VzIG5vdCBzdXBwb3J0IHRoaXMgezF9IHR5cGUuXCIsIHRoaXMuY3VycmVudExhbmd1YWdlTW9kZWwgPyB0aGlzLmxhbmd1YWdlTW9kZWxzU2VydmljZS5sb29rdXBMYW5ndWFnZU1vZGVsKHRoaXMuY3VycmVudExhbmd1YWdlTW9kZWwuaWRlbnRpZmllcik/Lm5hbWUgOiB0aGlzLmN1cnJlbnRMYW5ndWFnZU1vZGVsLCAnZmlsZScpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGhvdmVyRGVsZWdhdGUsIHRoaXMuZWxlbWVudCwgaG92ZXJFbGVtZW50LCB7IHRyYXBGb2N1czogdHJ1ZSB9KSk7XG5cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW1hZ2VBdHRhY2htZW50V2lkZ2V0IGV4dGVuZHMgQWJzdHJhY3RDaGF0QXR0YWNobWVudFdpZGdldCB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCxcblx0XHRhdHRhY2htZW50OiBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5LFxuXHRcdGN1cnJlbnRMYW5ndWFnZU1vZGVsOiBJTGFuZ3VhZ2VNb2RlbENoYXRNZXRhZGF0YUFuZElkZW50aWZpZXIgfCB1bmRlZmluZWQsXG5cdFx0c2hvdWxkRm9jdXNDbGVhckJ1dHRvbjogYm9vbGVhbixcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdGNvbnRleHRSZXNvdXJjZUxhYmVsczogUmVzb3VyY2VMYWJlbHMsXG5cdFx0aG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGUsXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUxhbmd1YWdlTW9kZWxzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlTW9kZWxzU2VydmljZTogSUxhbmd1YWdlTW9kZWxzU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoYXR0YWNobWVudCwgc2hvdWxkRm9jdXNDbGVhckJ1dHRvbiwgY29udGFpbmVyLCBjb250ZXh0UmVzb3VyY2VMYWJlbHMsIGhvdmVyRGVsZWdhdGUsIGN1cnJlbnRMYW5ndWFnZU1vZGVsLCBjb21tYW5kU2VydmljZSwgb3BlbmVyU2VydmljZSk7XG5cblx0XHRjb25zdCBhcmlhTGFiZWwgPSBsb2NhbGl6ZSgnY2hhdC5pbWFnZUF0dGFjaG1lbnQnLCBcIkF0dGFjaGVkIGltYWdlLCB7MH1cIiwgYXR0YWNobWVudC5uYW1lKTtcblx0XHR0aGlzLmVsZW1lbnQuYXJpYUxhYmVsID0gYXJpYUxhYmVsO1xuXHRcdHRoaXMuZWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG5cblx0XHRpZiAoYXR0YWNobWVudC5yZWZlcmVuY2VzKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuXHRcdFx0Y29uc3QgY2xpY2tIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0XHRpZiAoYXR0YWNobWVudC5yZWZlcmVuY2VzICYmIFVSSS5pc1VyaShhdHRhY2htZW50LnJlZmVyZW5jZXNbMF0ucmVmZXJlbmNlKSkge1xuXHRcdFx0XHRcdHRoaXMub3BlblJlc291cmNlKGF0dGFjaG1lbnQucmVmZXJlbmNlc1swXS5yZWZlcmVuY2UsIGZhbHNlLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZWxlbWVudCwgJ2NsaWNrJywgY2xpY2tIYW5kbGVyKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGlsbEljb24gPSBkb20uJCgnZGl2LmNoYXQtYXR0YWNoZWQtY29udGV4dC1waWxsJywge30sIGRvbS4kKHRoaXMubW9kZWxTdXBwb3J0c1Zpc2lvbigpID8gJ3NwYW4uY29kaWNvbi5jb2RpY29uLWZpbGUtbWVkaWEnIDogJ3NwYW4uY29kaWNvbi5jb2RpY29uLXdhcm5pbmcnKSk7XG5cdFx0Y29uc3QgdGV4dExhYmVsID0gZG9tLiQoJ3NwYW4uY2hhdC1hdHRhY2hlZC1jb250ZXh0LWN1c3RvbS10ZXh0Jywge30sIGF0dGFjaG1lbnQubmFtZSk7XG5cdFx0dGhpcy5lbGVtZW50LmFwcGVuZENoaWxkKHBpbGxJY29uKTtcblx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQodGV4dExhYmVsKTtcblxuXHRcdGNvbnN0IGhvdmVyRWxlbWVudCA9IGRvbS4kKCdkaXYuY2hhdC1hdHRhY2hlZC1jb250ZXh0LWhvdmVyJyk7XG5cdFx0aG92ZXJFbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGFyaWFMYWJlbCk7XG5cblx0XHR0eXBlIEF0dGFjaEltYWdlRXZlbnQgPSB7XG5cdFx0XHRjdXJyZW50TW9kZWw6IHN0cmluZztcblx0XHRcdHN1cHBvcnRzVmlzaW9uOiBib29sZWFuO1xuXHRcdH07XG5cdFx0dHlwZSBBdHRhY2hJbWFnZUV2ZW50Q2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRjdXJyZW50TW9kZWw6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgbW9kZWwgYXQgdGhlIHBvaW50IG9mIGF0dGFjaGluZyB0aGUgaW1hZ2UuJyB9O1xuXHRcdFx0c3VwcG9ydHNWaXNpb246IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGV0aGVyIHRoZSBjdXJyZW50IG1vZGVsIHN1cHBvcnRzIHZpc2lvbiBvciBub3QuJyB9O1xuXHRcdFx0b3duZXI6ICdqdXN0c2NoZW4nO1xuXHRcdFx0Y29tbWVudDogJ0V2ZW50IHVzZWQgdG8gZ2FpbiBpbnNpZ2h0cyB3aGVuIGltYWdlcyBhcmUgYXR0YWNoZWQsIGFuZCBpZiB0aGUgbW9kZWwgc3VwcG9ydGVkIHZpc2lvbiBvciBub3QuJztcblx0XHR9O1xuXG5cdFx0Y29uc3QgY3VycmVudExhbmd1YWdlTW9kZWxOYW1lID0gdGhpcy5jdXJyZW50TGFuZ3VhZ2VNb2RlbCA/IHRoaXMubGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlLmxvb2t1cExhbmd1YWdlTW9kZWwodGhpcy5jdXJyZW50TGFuZ3VhZ2VNb2RlbC5pZGVudGlmaWVyKT8ubmFtZSA/PyB0aGlzLmN1cnJlbnRMYW5ndWFnZU1vZGVsLmlkZW50aWZpZXIgOiAndW5rbm93bic7XG5cdFx0Y29uc3Qgc3VwcG9ydHNWaXNpb24gPSB0aGlzLm1vZGVsU3VwcG9ydHNWaXNpb24oKTtcblxuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPEF0dGFjaEltYWdlRXZlbnQsIEF0dGFjaEltYWdlRXZlbnRDbGFzc2lmaWNhdGlvbj4oJ2NvcGlsb3QuYXR0YWNoSW1hZ2UnLCB7XG5cdFx0XHRjdXJyZW50TW9kZWw6IGN1cnJlbnRMYW5ndWFnZU1vZGVsTmFtZSxcblx0XHRcdHN1cHBvcnRzVmlzaW9uOiBzdXBwb3J0c1Zpc2lvblxuXHRcdH0pO1xuXG5cdFx0aWYgKCFzdXBwb3J0c1Zpc2lvbiAmJiB0aGlzLmN1cnJlbnRMYW5ndWFnZU1vZGVsKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnd2FybmluZycpO1xuXHRcdFx0aG92ZXJFbGVtZW50LnRleHRDb250ZW50ID0gbG9jYWxpemUoJ2NoYXQuZmlsZUF0dGFjaG1lbnRIb3ZlcicsIFwiezB9IGRvZXMgbm90IHN1cHBvcnQgdGhpcyB7MX0gdHlwZS5cIiwgY3VycmVudExhbmd1YWdlTW9kZWxOYW1lLCAnaW1hZ2UnKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGhvdmVyRGVsZWdhdGUsIHRoaXMuZWxlbWVudCwgaG92ZXJFbGVtZW50LCB7IHRyYXBGb2N1czogdHJ1ZSB9KSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IGF0dGFjaG1lbnQudmFsdWUgYXMgVWludDhBcnJheTtcblx0XHRcdHRoaXMuY3JlYXRlSW1hZ2VFbGVtZW50cyhidWZmZXIsIHRoaXMuZWxlbWVudCwgaG92ZXJFbGVtZW50KTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGhvdmVyRGVsZWdhdGUsIHRoaXMuZWxlbWVudCwgaG92ZXJFbGVtZW50LCB7IHRyYXBGb2N1czogZmFsc2UgfSkpO1xuXHRcdH1cblxuXHRcdGlmIChyZXNvdXJjZSkge1xuXHRcdFx0dGhpcy5hZGRSZXNvdXJjZU9wZW5IYW5kbGVycyhyZXNvdXJjZSwgdW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHR0aGlzLmF0dGFjaENsZWFyQnV0dG9uKCk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUltYWdlRWxlbWVudHMoYnVmZmVyOiBBcnJheUJ1ZmZlciB8IFVpbnQ4QXJyYXksIHdpZGdldDogSFRNTEVsZW1lbnQsIGhvdmVyRWxlbWVudDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBibG9iID0gbmV3IEJsb2IoW2J1ZmZlcl0sIHsgdHlwZTogJ2ltYWdlL3BuZycgfSk7XG5cdFx0Y29uc3QgdXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcblx0XHRjb25zdCBwaWxsSW1nID0gZG9tLiQoJ2ltZy5jaGF0LWF0dGFjaGVkLWNvbnRleHQtcGlsbC1pbWFnZScsIHsgc3JjOiB1cmwsIGFsdDogJycgfSk7XG5cdFx0Y29uc3QgcGlsbCA9IGRvbS4kKCdkaXYuY2hhdC1hdHRhY2hlZC1jb250ZXh0LXBpbGwnLCB7fSwgcGlsbEltZyk7XG5cblx0XHRjb25zdCBleGlzdGluZ1BpbGwgPSB3aWRnZXQucXVlcnlTZWxlY3RvcignLmNoYXQtYXR0YWNoZWQtY29udGV4dC1waWxsJyk7XG5cdFx0aWYgKGV4aXN0aW5nUGlsbCkge1xuXHRcdFx0ZXhpc3RpbmdQaWxsLnJlcGxhY2VXaXRoKHBpbGwpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhvdmVySW1hZ2UgPSBkb20uJCgnaW1nLmNoYXQtYXR0YWNoZWQtY29udGV4dC1pbWFnZScsIHsgc3JjOiB1cmwsIGFsdDogJycgfSk7XG5cblx0XHQvLyBVcGRhdGUgaG92ZXIgaW1hZ2Vcblx0XHRob3ZlckVsZW1lbnQuYXBwZW5kQ2hpbGQoaG92ZXJJbWFnZSk7XG5cblx0XHRob3ZlckltYWdlLm9ubG9hZCA9ICgpID0+IHtcblx0XHRcdFVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcblx0XHR9O1xuXG5cdFx0aG92ZXJJbWFnZS5vbmVycm9yID0gKCkgPT4ge1xuXHRcdFx0Ly8gcmVzZXQgdG8gb3JpZ2luYWwgaWNvbiBvbiBlcnJvciBvciBpbnZhbGlkIGltYWdlXG5cdFx0XHRjb25zdCBwaWxsSWNvbiA9IGRvbS4kKCdkaXYuY2hhdC1hdHRhY2hlZC1jb250ZXh0LXBpbGwnLCB7fSwgZG9tLiQoJ3NwYW4uY29kaWNvbi5jb2RpY29uLWZpbGUtbWVkaWEnKSk7XG5cdFx0XHRjb25zdCBwaWxsID0gZG9tLiQoJ2Rpdi5jaGF0LWF0dGFjaGVkLWNvbnRleHQtcGlsbCcsIHt9LCBwaWxsSWNvbik7XG5cdFx0XHRjb25zdCBleGlzdGluZ1BpbGwgPSB3aWRnZXQucXVlcnlTZWxlY3RvcignLmNoYXQtYXR0YWNoZWQtY29udGV4dC1waWxsJyk7XG5cdFx0XHRpZiAoZXhpc3RpbmdQaWxsKSB7XG5cdFx0XHRcdGV4aXN0aW5nUGlsbC5yZXBsYWNlV2l0aChwaWxsKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXN0ZUF0dGFjaG1lbnRXaWRnZXQgZXh0ZW5kcyBBYnN0cmFjdENoYXRBdHRhY2htZW50V2lkZ2V0IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRhdHRhY2htZW50OiBJQ2hhdFJlcXVlc3RQYXN0ZVZhcmlhYmxlRW50cnksXG5cdFx0Y3VycmVudExhbmd1YWdlTW9kZWw6IElMYW5ndWFnZU1vZGVsQ2hhdE1ldGFkYXRhQW5kSWRlbnRpZmllciB8IHVuZGVmaW5lZCxcblx0XHRzaG91bGRGb2N1c0NsZWFyQnV0dG9uOiBib29sZWFuLFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0Y29udGV4dFJlc291cmNlTGFiZWxzOiBSZXNvdXJjZUxhYmVscyxcblx0XHRob3ZlckRlbGVnYXRlOiBJSG92ZXJEZWxlZ2F0ZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihhdHRhY2htZW50LCBzaG91bGRGb2N1c0NsZWFyQnV0dG9uLCBjb250YWluZXIsIGNvbnRleHRSZXNvdXJjZUxhYmVscywgaG92ZXJEZWxlZ2F0ZSwgY3VycmVudExhbmd1YWdlTW9kZWwsIGNvbW1hbmRTZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGFyaWFMYWJlbCA9IGxvY2FsaXplKCdjaGF0LmF0dGFjaG1lbnQnLCBcIkF0dGFjaGVkIGNvbnRleHQsIHswfVwiLCBhdHRhY2htZW50Lm5hbWUpO1xuXHRcdHRoaXMuZWxlbWVudC5hcmlhTGFiZWwgPSBhcmlhTGFiZWw7XG5cblx0XHRjb25zdCBjbGFzc05hbWVzID0gWydmaWxlLWljb24nLCBgJHthdHRhY2htZW50Lmxhbmd1YWdlfS1sYW5nLWZpbGUtaWNvbmBdO1xuXHRcdGxldCByZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkO1xuXHRcdGxldCByYW5nZTogSVJhbmdlIHwgdW5kZWZpbmVkO1xuXG5cdFx0aWYgKGF0dGFjaG1lbnQuY29waWVkRnJvbSkge1xuXHRcdFx0cmVzb3VyY2UgPSBhdHRhY2htZW50LmNvcGllZEZyb20udXJpO1xuXHRcdFx0cmFuZ2UgPSBhdHRhY2htZW50LmNvcGllZEZyb20ucmFuZ2U7XG5cdFx0XHRjb25zdCBmaWxlbmFtZSA9IGJhc2VuYW1lKHJlc291cmNlLnBhdGgpO1xuXHRcdFx0dGhpcy5sYWJlbC5zZXRMYWJlbChmaWxlbmFtZSwgdW5kZWZpbmVkLCB7IGV4dHJhQ2xhc3NlczogY2xhc3NOYW1lcyB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5sYWJlbC5zZXRMYWJlbChhdHRhY2htZW50LmZpbGVOYW1lLCB1bmRlZmluZWQsIHsgZXh0cmFDbGFzc2VzOiBjbGFzc05hbWVzIH0pO1xuXHRcdH1cblx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQoZG9tLiQoJ3NwYW4uYXR0YWNobWVudC1hZGRpdGlvbmFsLWluZm8nLCB7fSwgYFBhc3RlZCAke2F0dGFjaG1lbnQucGFzdGVkTGluZXN9YCkpO1xuXG5cdFx0dGhpcy5lbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcblxuXHRcdGNvbnN0IHNvdXJjZVVyaSA9IGF0dGFjaG1lbnQuY29waWVkRnJvbT8udXJpO1xuXHRcdGNvbnN0IGhvdmVyQ29udGVudDogSU1hbmFnZWRIb3ZlclRvb2x0aXBNYXJrZG93blN0cmluZyA9IHtcblx0XHRcdG1hcmtkb3duOiB7XG5cdFx0XHRcdHZhbHVlOiBgJHtzb3VyY2VVcmkgPyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IGFjY2Vzc29yLmdldChJTGFiZWxTZXJ2aWNlKS5nZXRVcmlMYWJlbChzb3VyY2VVcmksIHsgcmVsYXRpdmU6IHRydWUgfSkpIDogYXR0YWNobWVudC5maWxlTmFtZX1cXG5cXG4tLS1cXG5cXG5cXGBcXGBcXGAke2F0dGFjaG1lbnQubGFuZ3VhZ2V9XFxuXFxuJHthdHRhY2htZW50LmNvZGV9XFxuXFxgXFxgXFxgYCxcblx0XHRcdH0sXG5cdFx0XHRtYXJrZG93bk5vdFN1cHBvcnRlZEZhbGxiYWNrOiBhdHRhY2htZW50LmNvZGUsXG5cdFx0fTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3Zlcihob3ZlckRlbGVnYXRlLCB0aGlzLmVsZW1lbnQsIGhvdmVyQ29udGVudCwgeyB0cmFwRm9jdXM6IHRydWUgfSkpO1xuXG5cdFx0Y29uc3QgY29waWVkRnJvbVJlc291cmNlID0gYXR0YWNobWVudC5jb3BpZWRGcm9tPy51cmk7XG5cdFx0aWYgKGNvcGllZEZyb21SZXNvdXJjZSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBob29rVXBSZXNvdXJjZUF0dGFjaG1lbnREcmFnQW5kQ29udGV4dE1lbnUoYWNjZXNzb3IsIHRoaXMuZWxlbWVudCwgY29waWVkRnJvbVJlc291cmNlKSkpO1xuXHRcdFx0dGhpcy5hZGRSZXNvdXJjZU9wZW5IYW5kbGVycyhjb3BpZWRGcm9tUmVzb3VyY2UsIHJhbmdlKTtcblx0XHR9XG5cblx0XHR0aGlzLmF0dGFjaENsZWFyQnV0dG9uKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRDaGF0QXR0YWNobWVudFdpZGdldCBleHRlbmRzIEFic3RyYWN0Q2hhdEF0dGFjaG1lbnRXaWRnZXQge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkLFxuXHRcdHJhbmdlOiBJUmFuZ2UgfCB1bmRlZmluZWQsXG5cdFx0YXR0YWNobWVudDogSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSxcblx0XHRjdXJyZW50TGFuZ3VhZ2VNb2RlbDogSUxhbmd1YWdlTW9kZWxDaGF0TWV0YWRhdGFBbmRJZGVudGlmaWVyIHwgdW5kZWZpbmVkLFxuXHRcdHNob3VsZEZvY3VzQ2xlYXJCdXR0b246IGJvb2xlYW4sXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRjb250ZXh0UmVzb3VyY2VMYWJlbHM6IFJlc291cmNlTGFiZWxzLFxuXHRcdGhvdmVyRGVsZWdhdGU6IElIb3ZlckRlbGVnYXRlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGF0dGFjaG1lbnQsIHNob3VsZEZvY3VzQ2xlYXJCdXR0b24sIGNvbnRhaW5lciwgY29udGV4dFJlc291cmNlTGFiZWxzLCBob3ZlckRlbGVnYXRlLCBjdXJyZW50TGFuZ3VhZ2VNb2RlbCwgY29tbWFuZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgYXR0YWNobWVudExhYmVsID0gYXR0YWNobWVudC5mdWxsTmFtZSA/PyBhdHRhY2htZW50Lm5hbWU7XG5cdFx0Y29uc3Qgd2l0aEljb24gPSBhdHRhY2htZW50Lmljb24/LmlkID8gYCQoJHthdHRhY2htZW50Lmljb24uaWR9KSAke2F0dGFjaG1lbnRMYWJlbH1gIDogYXR0YWNobWVudExhYmVsO1xuXHRcdHRoaXMubGFiZWwuc2V0TGFiZWwod2l0aEljb24sIHVuZGVmaW5lZCk7XG5cdFx0dGhpcy5lbGVtZW50LmFyaWFMYWJlbCA9IGxvY2FsaXplKCdjaGF0LmF0dGFjaG1lbnQnLCBcIkF0dGFjaGVkIGNvbnRleHQsIHswfVwiLCBhdHRhY2htZW50Lm5hbWUpO1xuXG5cdFx0aWYgKGF0dGFjaG1lbnQua2luZCA9PT0gJ2RpYWdub3N0aWMnKSB7XG5cdFx0XHRpZiAoYXR0YWNobWVudC5maWx0ZXJVcmkpIHtcblx0XHRcdFx0cmVzb3VyY2UgPSBhdHRhY2htZW50LmZpbHRlclVyaSA/IFVSSS5yZXZpdmUoYXR0YWNobWVudC5maWx0ZXJVcmkpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRyYW5nZSA9IGF0dGFjaG1lbnQuZmlsdGVyUmFuZ2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZWxlbWVudCwgZG9tLkV2ZW50VHlwZS5DTElDSywgKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3dvcmtiZW5jaC5wYW5lbC5tYXJrZXJzLnZpZXcuZm9jdXMnKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChhdHRhY2htZW50LmtpbmQgPT09ICdzeW1ib2wnKSB7XG5cdFx0XHRjb25zdCBzY29wZWRDb250ZXh0S2V5U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKHRoaXMuZWxlbWVudCkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBob29rVXBTeW1ib2xBdHRhY2htZW50RHJhZ0FuZENvbnRleHRNZW51KGFjY2Vzc29yLCB0aGlzLmVsZW1lbnQsIHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLCB7IC4uLmF0dGFjaG1lbnQsIGtpbmQ6IGF0dGFjaG1lbnQuc3ltYm9sS2luZCB9LCBNZW51SWQuQ2hhdElucHV0U3ltYm9sQXR0YWNobWVudENvbnRleHQpKSk7XG5cdFx0fVxuXG5cdFx0aWYgKHJlc291cmNlKSB7XG5cdFx0XHR0aGlzLmFkZFJlc291cmNlT3BlbkhhbmRsZXJzKHJlc291cmNlLCByYW5nZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5hdHRhY2hDbGVhckJ1dHRvbigpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLEdBQUcsNkJBQTZCO0FBQ3pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsY0FBYztBQUd2QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsc0JBQTJDO0FBQ3BELFNBQVMsZUFBZSx1QkFB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
