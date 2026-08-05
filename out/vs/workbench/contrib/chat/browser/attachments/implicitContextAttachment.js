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
import * as dom from "../../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { basename, dirname } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { localize } from "../../../../../nls.js";
import { getFlatContextMenuActions } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId } from "../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { FileKind, IFileService } from "../../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { ResourceContextKey } from "../../../../common/contextkeys.js";
let ImplicitContextAttachmentWidget = class extends Disposable {
  constructor(attachment, resourceLabels, contextKeyService, contextMenuService, hoverService, labelService, menuService, fileService, languageService, modelService) {
    super();
    this.attachment = attachment;
    this.resourceLabels = resourceLabels;
    this.contextKeyService = contextKeyService;
    this.contextMenuService = contextMenuService;
    this.hoverService = hoverService;
    this.labelService = labelService;
    this.menuService = menuService;
    this.fileService = fileService;
    this.languageService = languageService;
    this.modelService = modelService;
    this.renderDisposables = this._register(new DisposableStore());
    this.domNode = dom.$(".chat-attached-context-attachment.show-file-icons.implicit");
    this.render();
  }
  render() {
    dom.clearNode(this.domNode);
    this.renderDisposables.clear();
    this.domNode.classList.toggle("disabled", !this.attachment.enabled);
    const label = this.resourceLabels.create(this.domNode, { supportIcons: true });
    const file = URI.isUri(this.attachment.value) ? this.attachment.value : this.attachment.value.uri;
    const range = URI.isUri(this.attachment.value) || !this.attachment.isSelection ? void 0 : this.attachment.value.range;
    const fileBasename = basename(file);
    const fileDirname = dirname(file);
    const friendlyName = `${fileBasename} ${fileDirname}`;
    const ariaLabel = range ? localize("chat.fileAttachmentWithRange", "Attached file, {0}, line {1} to line {2}", friendlyName, range.startLineNumber, range.endLineNumber) : localize("chat.fileAttachment", "Attached file, {0}", friendlyName);
    const uriLabel = this.labelService.getUriLabel(file, { relative: true });
    const currentFile = localize("openEditor", "Current file context");
    const inactive = localize("enableHint", "disabled");
    const currentFileHint = currentFile + (this.attachment.enabled ? "" : ` (${inactive})`);
    const title = `${currentFileHint}
${uriLabel}`;
    label.setFile(file, {
      fileKind: FileKind.FILE,
      hidePath: true,
      range,
      title
    });
    this.domNode.ariaLabel = ariaLabel;
    this.domNode.tabIndex = 0;
    const hintElement = dom.append(this.domNode, dom.$("span.chat-implicit-hint", void 0, "Current file"));
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), hintElement, title));
    const buttonMsg = this.attachment.enabled ? localize("disable", "Disable current file context") : localize("enable", "Enable current file context");
    const toggleButton = this.renderDisposables.add(new Button(this.domNode, { supportIcons: true, title: buttonMsg }));
    toggleButton.icon = this.attachment.enabled ? Codicon.eye : Codicon.eyeClosed;
    this.renderDisposables.add(toggleButton.onDidClick((e) => {
      e.stopPropagation();
      this.attachment.enabled = !this.attachment.enabled;
    }));
    const scopedContextKeyService = this.renderDisposables.add(this.contextKeyService.createScoped(this.domNode));
    const resourceContextKey = this.renderDisposables.add(new ResourceContextKey(scopedContextKeyService, this.fileService, this.languageService, this.modelService));
    resourceContextKey.set(file);
    this.renderDisposables.add(dom.addDisposableListener(this.domNode, dom.EventType.CONTEXT_MENU, async (domEvent) => {
      const event = new StandardMouseEvent(dom.getWindow(domEvent), domEvent);
      dom.EventHelper.stop(domEvent, true);
      this.contextMenuService.showContextMenu({
        contextKeyService: scopedContextKeyService,
        getAnchor: () => event,
        getActions: () => {
          const menu = this.menuService.getMenuActions(MenuId.ChatInputResourceAttachmentContext, scopedContextKeyService, { arg: file });
          return getFlatContextMenuActions(menu);
        }
      });
    }));
  }
};
ImplicitContextAttachmentWidget = __decorateClass([
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IMenuService),
  __decorateParam(7, IFileService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, IModelService)
], ImplicitContextAttachmentWidget);
export {
  ImplicitContextAttachmentWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYXR0YWNobWVudHMvaW1wbGljaXRDb250ZXh0QXR0YWNobWVudC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBnZXRGbGF0Q29udGV4dE1lbnVBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IElNZW51U2VydmljZSwgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IEZpbGVLaW5kLCBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUxhYmVscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvbGFiZWxzLmpzJztcbmltcG9ydCB7IFJlc291cmNlQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFJlcXVlc3RJbXBsaWNpdFZhcmlhYmxlRW50cnkgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdE1vZGVsLmpzJztcblxuZXhwb3J0IGNsYXNzIEltcGxpY2l0Q29udGV4dEF0dGFjaG1lbnRXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHVibGljIHJlYWRvbmx5IGRvbU5vZGU6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcmVuZGVyRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYXR0YWNobWVudDogSUNoYXRSZXF1ZXN0SW1wbGljaXRWYXJpYWJsZUVudHJ5LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcmVzb3VyY2VMYWJlbHM6IFJlc291cmNlTGFiZWxzLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5kb21Ob2RlID0gZG9tLiQoJy5jaGF0LWF0dGFjaGVkLWNvbnRleHQtYXR0YWNobWVudC5zaG93LWZpbGUtaWNvbnMuaW1wbGljaXQnKTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXIoKSB7XG5cdFx0ZG9tLmNsZWFyTm9kZSh0aGlzLmRvbU5vZGUpO1xuXHRcdHRoaXMucmVuZGVyRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdkaXNhYmxlZCcsICF0aGlzLmF0dGFjaG1lbnQuZW5hYmxlZCk7XG5cdFx0Y29uc3QgbGFiZWwgPSB0aGlzLnJlc291cmNlTGFiZWxzLmNyZWF0ZSh0aGlzLmRvbU5vZGUsIHsgc3VwcG9ydEljb25zOiB0cnVlIH0pO1xuXHRcdGNvbnN0IGZpbGUgPSBVUkkuaXNVcmkodGhpcy5hdHRhY2htZW50LnZhbHVlKSA/IHRoaXMuYXR0YWNobWVudC52YWx1ZSA6IHRoaXMuYXR0YWNobWVudC52YWx1ZSEudXJpO1xuXHRcdGNvbnN0IHJhbmdlID0gVVJJLmlzVXJpKHRoaXMuYXR0YWNobWVudC52YWx1ZSkgfHwgIXRoaXMuYXR0YWNobWVudC5pc1NlbGVjdGlvbiA/IHVuZGVmaW5lZCA6IHRoaXMuYXR0YWNobWVudC52YWx1ZSEucmFuZ2U7XG5cblx0XHRjb25zdCBmaWxlQmFzZW5hbWUgPSBiYXNlbmFtZShmaWxlKTtcblx0XHRjb25zdCBmaWxlRGlybmFtZSA9IGRpcm5hbWUoZmlsZSk7XG5cdFx0Y29uc3QgZnJpZW5kbHlOYW1lID0gYCR7ZmlsZUJhc2VuYW1lfSAke2ZpbGVEaXJuYW1lfWA7XG5cdFx0Y29uc3QgYXJpYUxhYmVsID0gcmFuZ2UgPyBsb2NhbGl6ZSgnY2hhdC5maWxlQXR0YWNobWVudFdpdGhSYW5nZScsIFwiQXR0YWNoZWQgZmlsZSwgezB9LCBsaW5lIHsxfSB0byBsaW5lIHsyfVwiLCBmcmllbmRseU5hbWUsIHJhbmdlLnN0YXJ0TGluZU51bWJlciwgcmFuZ2UuZW5kTGluZU51bWJlcikgOiBsb2NhbGl6ZSgnY2hhdC5maWxlQXR0YWNobWVudCcsIFwiQXR0YWNoZWQgZmlsZSwgezB9XCIsIGZyaWVuZGx5TmFtZSk7XG5cblx0XHRjb25zdCB1cmlMYWJlbCA9IHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGZpbGUsIHsgcmVsYXRpdmU6IHRydWUgfSk7XG5cdFx0Y29uc3QgY3VycmVudEZpbGUgPSBsb2NhbGl6ZSgnb3BlbkVkaXRvcicsIFwiQ3VycmVudCBmaWxlIGNvbnRleHRcIik7XG5cdFx0Y29uc3QgaW5hY3RpdmUgPSBsb2NhbGl6ZSgnZW5hYmxlSGludCcsIFwiZGlzYWJsZWRcIik7XG5cdFx0Y29uc3QgY3VycmVudEZpbGVIaW50ID0gY3VycmVudEZpbGUgKyAodGhpcy5hdHRhY2htZW50LmVuYWJsZWQgPyAnJyA6IGAgKCR7aW5hY3RpdmV9KWApO1xuXHRcdGNvbnN0IHRpdGxlID0gYCR7Y3VycmVudEZpbGVIaW50fVxcbiR7dXJpTGFiZWx9YDtcblx0XHRsYWJlbC5zZXRGaWxlKGZpbGUsIHtcblx0XHRcdGZpbGVLaW5kOiBGaWxlS2luZC5GSUxFLFxuXHRcdFx0aGlkZVBhdGg6IHRydWUsXG5cdFx0XHRyYW5nZSxcblx0XHRcdHRpdGxlXG5cdFx0fSk7XG5cdFx0dGhpcy5kb21Ob2RlLmFyaWFMYWJlbCA9IGFyaWFMYWJlbDtcblx0XHR0aGlzLmRvbU5vZGUudGFiSW5kZXggPSAwO1xuXHRcdGNvbnN0IGhpbnRFbGVtZW50ID0gZG9tLmFwcGVuZCh0aGlzLmRvbU5vZGUsIGRvbS4kKCdzcGFuLmNoYXQtaW1wbGljaXQtaGludCcsIHVuZGVmaW5lZCwgJ0N1cnJlbnQgZmlsZScpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnZWxlbWVudCcpLCBoaW50RWxlbWVudCwgdGl0bGUpKTtcblxuXHRcdGNvbnN0IGJ1dHRvbk1zZyA9IHRoaXMuYXR0YWNobWVudC5lbmFibGVkID8gbG9jYWxpemUoJ2Rpc2FibGUnLCBcIkRpc2FibGUgY3VycmVudCBmaWxlIGNvbnRleHRcIikgOiBsb2NhbGl6ZSgnZW5hYmxlJywgXCJFbmFibGUgY3VycmVudCBmaWxlIGNvbnRleHRcIik7XG5cdFx0Y29uc3QgdG9nZ2xlQnV0dG9uID0gdGhpcy5yZW5kZXJEaXNwb3NhYmxlcy5hZGQobmV3IEJ1dHRvbih0aGlzLmRvbU5vZGUsIHsgc3VwcG9ydEljb25zOiB0cnVlLCB0aXRsZTogYnV0dG9uTXNnIH0pKTtcblx0XHR0b2dnbGVCdXR0b24uaWNvbiA9IHRoaXMuYXR0YWNobWVudC5lbmFibGVkID8gQ29kaWNvbi5leWUgOiBDb2RpY29uLmV5ZUNsb3NlZDtcblx0XHR0aGlzLnJlbmRlckRpc3Bvc2FibGVzLmFkZCh0b2dnbGVCdXR0b24ub25EaWRDbGljaygoZSkgPT4ge1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTsgLy8gcHJldmVudCBpdCBmcm9tIHRyaWdnZXJpbmcgdGhlIGNsaWNrIGhhbmRsZXIgb24gdGhlIHBhcmVudCBpbW1lZGlhdGVseSBhZnRlciByZXJlbmRlcmluZ1xuXHRcdFx0dGhpcy5hdHRhY2htZW50LmVuYWJsZWQgPSAhdGhpcy5hdHRhY2htZW50LmVuYWJsZWQ7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gQ29udGV4dCBtZW51XG5cdFx0Y29uc3Qgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UgPSB0aGlzLnJlbmRlckRpc3Bvc2FibGVzLmFkZCh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZCh0aGlzLmRvbU5vZGUpKTtcblxuXHRcdGNvbnN0IHJlc291cmNlQ29udGV4dEtleSA9IHRoaXMucmVuZGVyRGlzcG9zYWJsZXMuYWRkKG5ldyBSZXNvdXJjZUNvbnRleHRLZXkoc2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIHRoaXMuZmlsZVNlcnZpY2UsIHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLCB0aGlzLm1vZGVsU2VydmljZSkpO1xuXHRcdHJlc291cmNlQ29udGV4dEtleS5zZXQoZmlsZSk7XG5cblx0XHR0aGlzLnJlbmRlckRpc3Bvc2FibGVzLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZG9tTm9kZSwgZG9tLkV2ZW50VHlwZS5DT05URVhUX01FTlUsIGFzeW5jIGRvbUV2ZW50ID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkTW91c2VFdmVudChkb20uZ2V0V2luZG93KGRvbUV2ZW50KSwgZG9tRXZlbnQpO1xuXHRcdFx0ZG9tLkV2ZW50SGVscGVyLnN0b3AoZG9tRXZlbnQsIHRydWUpO1xuXG5cdFx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0XHRjb250ZXh0S2V5U2VydmljZTogc2NvcGVkQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRcdGdldEFuY2hvcjogKCkgPT4gZXZlbnQsXG5cdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtZW51ID0gdGhpcy5tZW51U2VydmljZS5nZXRNZW51QWN0aW9ucyhNZW51SWQuQ2hhdElucHV0UmVzb3VyY2VBdHRhY2htZW50Q29udGV4dCwgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIHsgYXJnOiBmaWxlIH0pO1xuXHRcdFx0XHRcdHJldHVybiBnZXRGbGF0Q29udGV4dE1lbnVBY3Rpb25zKG1lbnUpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGNBQWM7QUFDdkIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSx1QkFBdUI7QUFDNUMsU0FBUyxVQUFVLGVBQWU7QUFDbEMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsY0FBYyxjQUFjO0FBQ3JDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsVUFBVSxvQkFBb0I7QUFDdkMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxxQkFBcUI7QUFFOUIsU0FBUywwQkFBMEI7QUFHNUIsSUFBTSxrQ0FBTixjQUE4QyxXQUFXO0FBQUEsRUFLL0QsWUFDa0IsWUFDQSxnQkFDb0IsbUJBQ0Msb0JBQ04sY0FDQSxjQUNELGFBQ0EsYUFDSSxpQkFDSCxjQUMvQjtBQUNELFVBQU07QUFYVztBQUNBO0FBQ29CO0FBQ0M7QUFDTjtBQUNBO0FBQ0Q7QUFDQTtBQUNJO0FBQ0g7QUFaakMsU0FBaUIsb0JBQW9CLEtBQUssVUFBVSxJQUFJLGdCQUFnQixDQUFDO0FBZ0J4RSxTQUFLLFVBQVUsSUFBSSxFQUFFLDREQUE0RDtBQUNqRixTQUFLLE9BQU87QUFBQSxFQUNiO0FBQUEsRUFFUSxTQUFTO0FBQ2hCLFFBQUksVUFBVSxLQUFLLE9BQU87QUFDMUIsU0FBSyxrQkFBa0IsTUFBTTtBQUU3QixTQUFLLFFBQVEsVUFBVSxPQUFPLFlBQVksQ0FBQyxLQUFLLFdBQVcsT0FBTztBQUNsRSxVQUFNLFFBQVEsS0FBSyxlQUFlLE9BQU8sS0FBSyxTQUFTLEVBQUUsY0FBYyxLQUFLLENBQUM7QUFDN0UsVUFBTSxPQUFPLElBQUksTUFBTSxLQUFLLFdBQVcsS0FBSyxJQUFJLEtBQUssV0FBVyxRQUFRLEtBQUssV0FBVyxNQUFPO0FBQy9GLFVBQU0sUUFBUSxJQUFJLE1BQU0sS0FBSyxXQUFXLEtBQUssS0FBSyxDQUFDLEtBQUssV0FBVyxjQUFjLFNBQVksS0FBSyxXQUFXLE1BQU87QUFFcEgsVUFBTSxlQUFlLFNBQVMsSUFBSTtBQUNsQyxVQUFNLGNBQWMsUUFBUSxJQUFJO0FBQ2hDLFVBQU0sZUFBZSxHQUFHLFlBQVksSUFBSSxXQUFXO0FBQ25ELFVBQU0sWUFBWSxRQUFRLFNBQVMsZ0NBQWdDLDRDQUE0QyxjQUFjLE1BQU0saUJBQWlCLE1BQU0sYUFBYSxJQUFJLFNBQVMsdUJBQXVCLHNCQUFzQixZQUFZO0FBRTdPLFVBQU0sV0FBVyxLQUFLLGFBQWEsWUFBWSxNQUFNLEVBQUUsVUFBVSxLQUFLLENBQUM7QUFDdkUsVUFBTSxjQUFjLFNBQVMsY0FBYyxzQkFBc0I7QUFDakUsVUFBTSxXQUFXLFNBQVMsY0FBYyxVQUFVO0FBQ2xELFVBQU0sa0JBQWtCLGVBQWUsS0FBSyxXQUFXLFVBQVUsS0FBSyxLQUFLLFFBQVE7QUFDbkYsVUFBTSxRQUFRLEdBQUcsZUFBZTtBQUFBLEVBQUssUUFBUTtBQUM3QyxVQUFNLFFBQVEsTUFBTTtBQUFBLE1BQ25CLFVBQVUsU0FBUztBQUFBLE1BQ25CLFVBQVU7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLElBQ0QsQ0FBQztBQUNELFNBQUssUUFBUSxZQUFZO0FBQ3pCLFNBQUssUUFBUSxXQUFXO0FBQ3hCLFVBQU0sY0FBYyxJQUFJLE9BQU8sS0FBSyxTQUFTLElBQUksRUFBRSwyQkFBMkIsUUFBVyxjQUFjLENBQUM7QUFDeEcsU0FBSyxVQUFVLEtBQUssYUFBYSxrQkFBa0Isd0JBQXdCLFNBQVMsR0FBRyxhQUFhLEtBQUssQ0FBQztBQUUxRyxVQUFNLFlBQVksS0FBSyxXQUFXLFVBQVUsU0FBUyxXQUFXLDhCQUE4QixJQUFJLFNBQVMsVUFBVSw2QkFBNkI7QUFDbEosVUFBTSxlQUFlLEtBQUssa0JBQWtCLElBQUksSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFLGNBQWMsTUFBTSxPQUFPLFVBQVUsQ0FBQyxDQUFDO0FBQ2xILGlCQUFhLE9BQU8sS0FBSyxXQUFXLFVBQVUsUUFBUSxNQUFNLFFBQVE7QUFDcEUsU0FBSyxrQkFBa0IsSUFBSSxhQUFhLFdBQVcsQ0FBQyxNQUFNO0FBQ3pELFFBQUUsZ0JBQWdCO0FBQ2xCLFdBQUssV0FBVyxVQUFVLENBQUMsS0FBSyxXQUFXO0FBQUEsSUFDNUMsQ0FBQyxDQUFDO0FBR0YsVUFBTSwwQkFBMEIsS0FBSyxrQkFBa0IsSUFBSSxLQUFLLGtCQUFrQixhQUFhLEtBQUssT0FBTyxDQUFDO0FBRTVHLFVBQU0scUJBQXFCLEtBQUssa0JBQWtCLElBQUksSUFBSSxtQkFBbUIseUJBQXlCLEtBQUssYUFBYSxLQUFLLGlCQUFpQixLQUFLLFlBQVksQ0FBQztBQUNoSyx1QkFBbUIsSUFBSSxJQUFJO0FBRTNCLFNBQUssa0JBQWtCLElBQUksSUFBSSxzQkFBc0IsS0FBSyxTQUFTLElBQUksVUFBVSxjQUFjLE9BQU0sYUFBWTtBQUNoSCxZQUFNLFFBQVEsSUFBSSxtQkFBbUIsSUFBSSxVQUFVLFFBQVEsR0FBRyxRQUFRO0FBQ3RFLFVBQUksWUFBWSxLQUFLLFVBQVUsSUFBSTtBQUVuQyxXQUFLLG1CQUFtQixnQkFBZ0I7QUFBQSxRQUN2QyxtQkFBbUI7QUFBQSxRQUNuQixXQUFXLE1BQU07QUFBQSxRQUNqQixZQUFZLE1BQU07QUFDakIsZ0JBQU0sT0FBTyxLQUFLLFlBQVksZUFBZSxPQUFPLG9DQUFvQyx5QkFBeUIsRUFBRSxLQUFLLEtBQUssQ0FBQztBQUM5SCxpQkFBTywwQkFBMEIsSUFBSTtBQUFBLFFBQ3RDO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDLENBQUM7QUFBQSxFQUNIO0FBQ0Q7QUFqRmEsa0NBQU47QUFBQSxFQVFKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBZlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
