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
import { localize } from "../../../../../../nls.js";
import { URI } from "../../../../../../base/common/uri.js";
import * as dom from "../../../../../../base/browser/dom.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { ResourceContextKey } from "../../../../../common/contextkeys.js";
import { Button } from "../../../../../../base/browser/ui/button/button.js";
import { basename, dirname } from "../../../../../../base/common/resources.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import { StandardMouseEvent } from "../../../../../../base/browser/mouseEvent.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { ILanguageService } from "../../../../../../editor/common/languages/language.js";
import { FileKind, IFileService } from "../../../../../../platform/files/common/files.js";
import { IMenuService, MenuId } from "../../../../../../platform/actions/common/actions.js";
import { getCleanPromptName } from "../../../../../../platform/prompts/common/constants.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { getDefaultHoverDelegate } from "../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { getFlatContextMenuActions } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
let PromptAttachmentWidget = class extends Disposable {
  constructor(model, resourceLabels, contextKeyService, contextMenuService, hoverService, labelService, menuService, fileService, languageService, modelService) {
    super();
    this.model = model;
    this.resourceLabels = resourceLabels;
    this.contextKeyService = contextKeyService;
    this.contextMenuService = contextMenuService;
    this.hoverService = hoverService;
    this.labelService = labelService;
    this.menuService = menuService;
    this.fileService = fileService;
    this.languageService = languageService;
    this.modelService = modelService;
    /**
     * Event that fires when the object is disposed.
     *
     * See {@linkcode onDispose}.
     */
    this._onDispose = this._register(new Emitter());
    /**
     * Temporary disposables used for rendering purposes.
     */
    this.renderDisposables = this._register(new DisposableStore());
    this.domNode = dom.$(".chat-prompt-attachment.chat-attached-context-attachment.show-file-icons.implicit");
    this.render = this.render.bind(this);
    this.dispose = this.dispose.bind(this);
    this.model.onUpdate(this.render);
    this.model.onDispose(this.dispose);
    this.render();
  }
  /**
   * Get the `URI` associated with the model reference.
   */
  get uri() {
    return this.model.reference.uri;
  }
  /**
   * Subscribe to the `onDispose` event.
   * @param callback Function to invoke on dispose.
   */
  onDispose(callback) {
    this._register(this._onDispose.event(callback));
    return this;
  }
  /**
   * Render this widget.
   */
  render() {
    dom.clearNode(this.domNode);
    this.renderDisposables.clear();
    this.domNode.classList.remove("warning", "error", "disabled");
    const { topError } = this.model;
    const label = this.resourceLabels.create(this.domNode, { supportIcons: true });
    const file = this.model.reference.uri;
    const fileBasename = basename(file);
    const fileDirname = dirname(file);
    const friendlyName = `${fileBasename} ${fileDirname}`;
    const ariaLabel = localize("chat.promptAttachment", "Prompt attachment, {0}", friendlyName);
    const uriLabel = this.labelService.getUriLabel(file, { relative: true });
    const promptLabel = localize("prompt", "Prompt");
    let title = `${promptLabel} ${uriLabel}`;
    if (topError) {
      const { errorSubject: subject } = topError;
      const isError = subject === "root";
      this.domNode.classList.add(
        isError ? "error" : "warning"
      );
      const severity = isError ? localize("error", "Error") : localize("warning", "Warning");
      title += `
[${severity}]: ${topError.localizedMessage}`;
    }
    const fileWithoutExtension = getCleanPromptName(file);
    label.setFile(URI.file(fileWithoutExtension), {
      fileKind: FileKind.FILE,
      hidePath: true,
      range: void 0,
      title,
      icon: ThemeIcon.fromId(Codicon.bookmark.id),
      extraClasses: []
    });
    this.domNode.ariaLabel = ariaLabel;
    this.domNode.tabIndex = 0;
    const hintElement = dom.append(this.domNode, dom.$("span.chat-implicit-hint", void 0, promptLabel));
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), hintElement, title));
    const removeButton = this.renderDisposables.add(
      new Button(
        this.domNode,
        {
          supportIcons: true,
          title: localize("remove", "Remove")
        }
      )
    );
    removeButton.icon = Codicon.close;
    this.renderDisposables.add(removeButton.onDidClick((e) => {
      e.stopPropagation();
      this.model.dispose();
    }));
    const scopedContextKeyService = this.renderDisposables.add(this.contextKeyService.createScoped(this.domNode));
    const resourceContextKey = this.renderDisposables.add(
      new ResourceContextKey(scopedContextKeyService, this.fileService, this.languageService, this.modelService)
    );
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
  dispose() {
    this._onDispose.fire();
    super.dispose();
  }
};
PromptAttachmentWidget = __decorateClass([
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IMenuService),
  __decorateParam(7, IFileService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, IModelService)
], PromptAttachmentWidget);
export {
  PromptAttachmentWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYXR0YWNobWVudHMvcHJvbXB0QXR0YWNobWVudHMvcHJvbXB0QXR0YWNobWVudFdpZGdldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VMYWJlbHMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9icm93c2VyL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFJlc291cmNlQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgRmlsZUtpbmQsIElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgZ2V0Q2xlYW5Qcm9tcHROYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvbXB0cy9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgQ2hhdFByb21wdEF0dGFjaG1lbnRNb2RlbCB9IGZyb20gJy4uLy4uL2NoYXRBdHRhY2htZW50TW9kZWwvY2hhdFByb21wdEF0dGFjaG1lbnRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBnZXRGbGF0Q29udGV4dE1lbnVBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcblxuLyoqXG4gKiBXaWRnZXQgZm9yIGEgc2luZ2xlIHByb21wdCBpbnN0cnVjdGlvbnMgYXR0YWNobWVudC5cbiAqL1xuZXhwb3J0IGNsYXNzIFByb21wdEF0dGFjaG1lbnRXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0LyoqXG5cdCAqIFRoZSByb290IERPTSBub2RlIG9mIHRoZSB3aWRnZXQuXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgZG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cblx0LyoqXG5cdCAqIEdldCB0aGUgYFVSSWAgYXNzb2NpYXRlZCB3aXRoIHRoZSBtb2RlbCByZWZlcmVuY2UuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IHVyaSgpOiBVUkkge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLnJlZmVyZW5jZS51cmk7XG5cdH1cblxuXHQvKipcblx0ICogRXZlbnQgdGhhdCBmaXJlcyB3aGVuIHRoZSBvYmplY3QgaXMgZGlzcG9zZWQuXG5cdCAqXG5cdCAqIFNlZSB7QGxpbmtjb2RlIG9uRGlzcG9zZX0uXG5cdCAqL1xuXHRwcm90ZWN0ZWQgX29uRGlzcG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHQvKipcblx0ICogU3Vic2NyaWJlIHRvIHRoZSBgb25EaXNwb3NlYCBldmVudC5cblx0ICogQHBhcmFtIGNhbGxiYWNrIEZ1bmN0aW9uIHRvIGludm9rZSBvbiBkaXNwb3NlLlxuXHQgKi9cblx0cHVibGljIG9uRGlzcG9zZShjYWxsYmFjazogKCkgPT4gdW5rbm93bik6IHRoaXMge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX29uRGlzcG9zZS5ldmVudChjYWxsYmFjaykpO1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHQvKipcblx0ICogVGVtcG9yYXJ5IGRpc3Bvc2FibGVzIHVzZWQgZm9yIHJlbmRlcmluZyBwdXJwb3Nlcy5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgcmVuZGVyRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbW9kZWw6IENoYXRQcm9tcHRBdHRhY2htZW50TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSByZXNvdXJjZUxhYmVsczogUmVzb3VyY2VMYWJlbHMsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmRvbU5vZGUgPSBkb20uJCgnLmNoYXQtcHJvbXB0LWF0dGFjaG1lbnQuY2hhdC1hdHRhY2hlZC1jb250ZXh0LWF0dGFjaG1lbnQuc2hvdy1maWxlLWljb25zLmltcGxpY2l0Jyk7XG5cblx0XHR0aGlzLnJlbmRlciA9IHRoaXMucmVuZGVyLmJpbmQodGhpcyk7XG5cdFx0dGhpcy5kaXNwb3NlID0gdGhpcy5kaXNwb3NlLmJpbmQodGhpcyk7XG5cblx0XHR0aGlzLm1vZGVsLm9uVXBkYXRlKHRoaXMucmVuZGVyKTtcblx0XHR0aGlzLm1vZGVsLm9uRGlzcG9zZSh0aGlzLmRpc3Bvc2UpO1xuXG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgdGhpcyB3aWRnZXQuXG5cdCAqL1xuXHRwcml2YXRlIHJlbmRlcigpIHtcblx0XHRkb20uY2xlYXJOb2RlKHRoaXMuZG9tTm9kZSk7XG5cdFx0dGhpcy5yZW5kZXJEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QucmVtb3ZlKCd3YXJuaW5nJywgJ2Vycm9yJywgJ2Rpc2FibGVkJyk7XG5cblx0XHRjb25zdCB7IHRvcEVycm9yIH0gPSB0aGlzLm1vZGVsO1xuXG5cdFx0Y29uc3QgbGFiZWwgPSB0aGlzLnJlc291cmNlTGFiZWxzLmNyZWF0ZSh0aGlzLmRvbU5vZGUsIHsgc3VwcG9ydEljb25zOiB0cnVlIH0pO1xuXHRcdGNvbnN0IGZpbGUgPSB0aGlzLm1vZGVsLnJlZmVyZW5jZS51cmk7XG5cblx0XHRjb25zdCBmaWxlQmFzZW5hbWUgPSBiYXNlbmFtZShmaWxlKTtcblx0XHRjb25zdCBmaWxlRGlybmFtZSA9IGRpcm5hbWUoZmlsZSk7XG5cdFx0Y29uc3QgZnJpZW5kbHlOYW1lID0gYCR7ZmlsZUJhc2VuYW1lfSAke2ZpbGVEaXJuYW1lfWA7XG5cdFx0Y29uc3QgYXJpYUxhYmVsID0gbG9jYWxpemUoJ2NoYXQucHJvbXB0QXR0YWNobWVudCcsIFwiUHJvbXB0IGF0dGFjaG1lbnQsIHswfVwiLCBmcmllbmRseU5hbWUpO1xuXG5cdFx0Y29uc3QgdXJpTGFiZWwgPSB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChmaWxlLCB7IHJlbGF0aXZlOiB0cnVlIH0pO1xuXHRcdGNvbnN0IHByb21wdExhYmVsID0gbG9jYWxpemUoJ3Byb21wdCcsIFwiUHJvbXB0XCIpO1xuXG5cdFx0bGV0IHRpdGxlID0gYCR7cHJvbXB0TGFiZWx9ICR7dXJpTGFiZWx9YDtcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBzb21lIGVycm9ycy93YXJuaW5nIGR1cmluZyB0aGUgcHJvY2VzcyBvZiByZXNvbHZpbmdcblx0XHQvLyBhdHRhY2htZW50IHJlZmVyZW5jZXMgKGluY2x1ZGluZyBhbGwgdGhlIG5lc3RlZCBjaGlsZCByZWZlcmVuY2VzKSxcblx0XHQvLyBhZGQgdGhlIGlzc3VlIGRldGFpbHMgaW4gdGhlIGhvdmVyIHRpdGxlIGZvciB0aGUgYXR0YWNobWVudCwgb25lXG5cdFx0Ly8gZXJyb3Ivd2FybmluZyBhdCBhIHRpbWUgYmVjYXVzZSB0aGVyZSBpcyBhIGxpbWl0ZWQgc3BhY2UgYXZhaWxhYmxlXG5cdFx0aWYgKHRvcEVycm9yKSB7XG5cdFx0XHRjb25zdCB7IGVycm9yU3ViamVjdDogc3ViamVjdCB9ID0gdG9wRXJyb3I7XG5cdFx0XHRjb25zdCBpc0Vycm9yID0gKHN1YmplY3QgPT09ICdyb290Jyk7XG5cblx0XHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QuYWRkKFxuXHRcdFx0XHQoaXNFcnJvcikgPyAnZXJyb3InIDogJ3dhcm5pbmcnLFxuXHRcdFx0KTtcblxuXHRcdFx0Y29uc3Qgc2V2ZXJpdHkgPSAoaXNFcnJvcilcblx0XHRcdFx0PyBsb2NhbGl6ZSgnZXJyb3InLCBcIkVycm9yXCIpXG5cdFx0XHRcdDogbG9jYWxpemUoJ3dhcm5pbmcnLCBcIldhcm5pbmdcIik7XG5cblx0XHRcdHRpdGxlICs9IGBcXG5bJHtzZXZlcml0eX1dOiAke3RvcEVycm9yLmxvY2FsaXplZE1lc3NhZ2V9YDtcblx0XHR9XG5cblx0XHRjb25zdCBmaWxlV2l0aG91dEV4dGVuc2lvbiA9IGdldENsZWFuUHJvbXB0TmFtZShmaWxlKTtcblx0XHRsYWJlbC5zZXRGaWxlKFVSSS5maWxlKGZpbGVXaXRob3V0RXh0ZW5zaW9uKSwge1xuXHRcdFx0ZmlsZUtpbmQ6IEZpbGVLaW5kLkZJTEUsXG5cdFx0XHRoaWRlUGF0aDogdHJ1ZSxcblx0XHRcdHJhbmdlOiB1bmRlZmluZWQsXG5cdFx0XHR0aXRsZSxcblx0XHRcdGljb246IFRoZW1lSWNvbi5mcm9tSWQoQ29kaWNvbi5ib29rbWFyay5pZCksXG5cdFx0XHRleHRyYUNsYXNzZXM6IFtdLFxuXHRcdH0pO1xuXHRcdHRoaXMuZG9tTm9kZS5hcmlhTGFiZWwgPSBhcmlhTGFiZWw7XG5cdFx0dGhpcy5kb21Ob2RlLnRhYkluZGV4ID0gMDtcblxuXHRcdGNvbnN0IGhpbnRFbGVtZW50ID0gZG9tLmFwcGVuZCh0aGlzLmRvbU5vZGUsIGRvbS4kKCdzcGFuLmNoYXQtaW1wbGljaXQtaGludCcsIHVuZGVmaW5lZCwgcHJvbXB0TGFiZWwpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnZWxlbWVudCcpLCBoaW50RWxlbWVudCwgdGl0bGUpKTtcblxuXHRcdC8vIGNyZWF0ZSB0aGUgYHJlbW92ZWAgYnV0dG9uXG5cdFx0Y29uc3QgcmVtb3ZlQnV0dG9uID0gdGhpcy5yZW5kZXJEaXNwb3NhYmxlcy5hZGQoXG5cdFx0XHRuZXcgQnV0dG9uKFxuXHRcdFx0XHR0aGlzLmRvbU5vZGUsXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzdXBwb3J0SWNvbnM6IHRydWUsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdyZW1vdmUnLCBcIlJlbW92ZVwiKSxcblx0XHRcdFx0fSxcblx0XHRcdCksXG5cdFx0KTtcblxuXHRcdHJlbW92ZUJ1dHRvbi5pY29uID0gQ29kaWNvbi5jbG9zZTtcblx0XHR0aGlzLnJlbmRlckRpc3Bvc2FibGVzLmFkZChyZW1vdmVCdXR0b24ub25EaWRDbGljaygoZSkgPT4ge1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHRoaXMubW9kZWwuZGlzcG9zZSgpO1xuXHRcdH0pKTtcblxuXHRcdC8vIGNvbnRleHQgbWVudVxuXHRcdGNvbnN0IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5yZW5kZXJEaXNwb3NhYmxlcy5hZGQodGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQodGhpcy5kb21Ob2RlKSk7XG5cblx0XHRjb25zdCByZXNvdXJjZUNvbnRleHRLZXkgPSB0aGlzLnJlbmRlckRpc3Bvc2FibGVzLmFkZChcblx0XHRcdG5ldyBSZXNvdXJjZUNvbnRleHRLZXkoc2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIHRoaXMuZmlsZVNlcnZpY2UsIHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLCB0aGlzLm1vZGVsU2VydmljZSksXG5cdFx0KTtcblx0XHRyZXNvdXJjZUNvbnRleHRLZXkuc2V0KGZpbGUpO1xuXG5cdFx0dGhpcy5yZW5kZXJEaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmRvbU5vZGUsIGRvbS5FdmVudFR5cGUuQ09OVEVYVF9NRU5VLCBhc3luYyBkb21FdmVudCA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoZG9tLmdldFdpbmRvdyhkb21FdmVudCksIGRvbUV2ZW50KTtcblx0XHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGRvbUV2ZW50LCB0cnVlKTtcblxuXHRcdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdFx0Y29udGV4dEtleVNlcnZpY2U6IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0XHRnZXRBbmNob3I6ICgpID0+IGV2ZW50LFxuXHRcdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbWVudSA9IHRoaXMubWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMoTWVudUlkLkNoYXRJbnB1dFJlc291cmNlQXR0YWNobWVudENvbnRleHQsIHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLCB7IGFyZzogZmlsZSB9KTtcblx0XHRcdFx0XHRyZXR1cm4gZ2V0RmxhdENvbnRleHRNZW51QWN0aW9ucyhtZW51KTtcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlzcG9zZS5maXJlKCk7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
