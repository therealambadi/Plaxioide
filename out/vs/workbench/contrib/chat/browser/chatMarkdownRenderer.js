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
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { MarkdownRenderer } from "../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { REVEAL_IN_EXPLORER_COMMAND_ID } from "../../files/browser/fileConstants.js";
import { ITrustedDomainService } from "../../url/browser/trustedDomainService.js";
const allowedHtmlTags = [
  "b",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
  "a",
  "img",
  // TODO@roblourens when we sanitize attributes in markdown source, we can ban these elements at that step. microsoft/vscode-copilot#5091
  // Not in the official list, but used for codicons and other vscode markdown extensions
  "span",
  "div"
];
let ChatMarkdownRenderer = class extends MarkdownRenderer {
  constructor(options, languageService, openerService, trustedDomainService, hoverService, fileService, commandService) {
    super(options ?? {}, languageService, openerService);
    this.trustedDomainService = trustedDomainService;
    this.hoverService = hoverService;
    this.fileService = fileService;
    this.commandService = commandService;
  }
  render(markdown, options, markedOptions) {
    options = {
      ...options,
      remoteImageIsAllowed: (uri) => this.trustedDomainService.isValid(uri),
      sanitizerOptions: {
        replaceWithPlaintext: true,
        allowedTags: allowedHtmlTags
      }
    };
    const mdWithBody = markdown && markdown.supportHtml ? {
      ...markdown,
      // dompurify uses DOMParser, which strips leading comments. Wrapping it all in 'body' prevents this.
      // The \n\n prevents marked.js from parsing the body contents as just text in an 'html' token, instead of actual markdown.
      value: `<body>

${markdown.value}</body>`
    } : markdown;
    const result = super.render(mdWithBody, options, markedOptions);
    return this.attachCustomHover(result);
  }
  attachCustomHover(result) {
    const store = new DisposableStore();
    result.element.querySelectorAll("a").forEach((element) => {
      if (element.title) {
        const title = element.title;
        element.title = "";
        store.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), element, title));
      }
    });
    return {
      element: result.element,
      dispose: () => {
        result.dispose();
        store.dispose();
      }
    };
  }
  async openMarkdownLink(link, markdown) {
    try {
      const uri = URI.parse(link);
      if ((await this.fileService.stat(uri)).isDirectory) {
        return this.commandService.executeCommand(REVEAL_IN_EXPLORER_COMMAND_ID, uri);
      }
    } catch {
    }
    return super.openMarkdownLink(link, markdown);
  }
};
ChatMarkdownRenderer = __decorateClass([
  __decorateParam(1, ILanguageService),
  __decorateParam(2, IOpenerService),
  __decorateParam(3, ITrustedDomainService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IFileService),
  __decorateParam(6, ICommandService)
], ChatMarkdownRenderer);
export {
  ChatMarkdownRenderer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdE1hcmtkb3duUmVuZGVyZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBNYXJrZG93blJlbmRlck9wdGlvbnMsIE1hcmtlZE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElNYXJrZG93blJlbmRlcmVyT3B0aW9ucywgSU1hcmtkb3duUmVuZGVyUmVzdWx0LCBNYXJrZG93blJlbmRlcmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L21hcmtkb3duUmVuZGVyZXIvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgUkVWRUFMX0lOX0VYUExPUkVSX0NPTU1BTkRfSUQgfSBmcm9tICcuLi8uLi9maWxlcy9icm93c2VyL2ZpbGVDb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSVRydXN0ZWREb21haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXJsL2Jyb3dzZXIvdHJ1c3RlZERvbWFpblNlcnZpY2UuanMnO1xuXG5jb25zdCBhbGxvd2VkSHRtbFRhZ3MgPSBbXG5cdCdiJyxcblx0J2Jsb2NrcXVvdGUnLFxuXHQnYnInLFxuXHQnY29kZScsXG5cdCdlbScsXG5cdCdoMScsXG5cdCdoMicsXG5cdCdoMycsXG5cdCdoNCcsXG5cdCdoNScsXG5cdCdoNicsXG5cdCdocicsXG5cdCdpJyxcblx0J2xpJyxcblx0J29sJyxcblx0J3AnLFxuXHQncHJlJyxcblx0J3N0cm9uZycsXG5cdCdzdWInLFxuXHQnc3VwJyxcblx0J3RhYmxlJyxcblx0J3Rib2R5Jyxcblx0J3RkJyxcblx0J3RoJyxcblx0J3RoZWFkJyxcblx0J3RyJyxcblx0J3VsJyxcblx0J2EnLFxuXHQnaW1nJyxcblxuXHQvLyBUT0RPQHJvYmxvdXJlbnMgd2hlbiB3ZSBzYW5pdGl6ZSBhdHRyaWJ1dGVzIGluIG1hcmtkb3duIHNvdXJjZSwgd2UgY2FuIGJhbiB0aGVzZSBlbGVtZW50cyBhdCB0aGF0IHN0ZXAuIG1pY3Jvc29mdC92c2NvZGUtY29waWxvdCM1MDkxXG5cdC8vIE5vdCBpbiB0aGUgb2ZmaWNpYWwgbGlzdCwgYnV0IHVzZWQgZm9yIGNvZGljb25zIGFuZCBvdGhlciB2c2NvZGUgbWFya2Rvd24gZXh0ZW5zaW9uc1xuXHQnc3BhbicsXG5cdCdkaXYnLFxuXTtcblxuLyoqXG4gKiBUaGlzIHdyYXBzIHRoZSBNYXJrZG93blJlbmRlcmVyIGFuZCBhcHBsaWVzIHNhbml0aXplciBvcHRpb25zIG5lZWRlZCBmb3IgQ2hhdC5cbiAqL1xuZXhwb3J0IGNsYXNzIENoYXRNYXJrZG93blJlbmRlcmVyIGV4dGVuZHMgTWFya2Rvd25SZW5kZXJlciB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IElNYXJrZG93blJlbmRlcmVyT3B0aW9ucyB8IHVuZGVmaW5lZCxcblx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJVHJ1c3RlZERvbWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0cnVzdGVkRG9tYWluU2VydmljZTogSVRydXN0ZWREb21haW5TZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihvcHRpb25zID8/IHt9LCBsYW5ndWFnZVNlcnZpY2UsIG9wZW5lclNlcnZpY2UpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyKG1hcmtkb3duOiBJTWFya2Rvd25TdHJpbmcgfCB1bmRlZmluZWQsIG9wdGlvbnM/OiBNYXJrZG93blJlbmRlck9wdGlvbnMsIG1hcmtlZE9wdGlvbnM/OiBNYXJrZWRPcHRpb25zKTogSU1hcmtkb3duUmVuZGVyUmVzdWx0IHtcblx0XHRvcHRpb25zID0ge1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdHJlbW90ZUltYWdlSXNBbGxvd2VkOiAodXJpKSA9PiB0aGlzLnRydXN0ZWREb21haW5TZXJ2aWNlLmlzVmFsaWQodXJpKSxcblx0XHRcdHNhbml0aXplck9wdGlvbnM6IHtcblx0XHRcdFx0cmVwbGFjZVdpdGhQbGFpbnRleHQ6IHRydWUsXG5cdFx0XHRcdGFsbG93ZWRUYWdzOiBhbGxvd2VkSHRtbFRhZ3MsXG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IG1kV2l0aEJvZHk6IElNYXJrZG93blN0cmluZyB8IHVuZGVmaW5lZCA9IChtYXJrZG93biAmJiBtYXJrZG93bi5zdXBwb3J0SHRtbCkgP1xuXHRcdFx0e1xuXHRcdFx0XHQuLi5tYXJrZG93bixcblxuXHRcdFx0XHQvLyBkb21wdXJpZnkgdXNlcyBET01QYXJzZXIsIHdoaWNoIHN0cmlwcyBsZWFkaW5nIGNvbW1lbnRzLiBXcmFwcGluZyBpdCBhbGwgaW4gJ2JvZHknIHByZXZlbnRzIHRoaXMuXG5cdFx0XHRcdC8vIFRoZSBcXG5cXG4gcHJldmVudHMgbWFya2VkLmpzIGZyb20gcGFyc2luZyB0aGUgYm9keSBjb250ZW50cyBhcyBqdXN0IHRleHQgaW4gYW4gJ2h0bWwnIHRva2VuLCBpbnN0ZWFkIG9mIGFjdHVhbCBtYXJrZG93bi5cblx0XHRcdFx0dmFsdWU6IGA8Ym9keT5cXG5cXG4ke21hcmtkb3duLnZhbHVlfTwvYm9keT5gLFxuXHRcdFx0fVxuXHRcdFx0OiBtYXJrZG93bjtcblx0XHRjb25zdCByZXN1bHQgPSBzdXBlci5yZW5kZXIobWRXaXRoQm9keSwgb3B0aW9ucywgbWFya2VkT3B0aW9ucyk7XG5cdFx0cmV0dXJuIHRoaXMuYXR0YWNoQ3VzdG9tSG92ZXIocmVzdWx0KTtcblx0fVxuXG5cdHByaXZhdGUgYXR0YWNoQ3VzdG9tSG92ZXIocmVzdWx0OiBJTWFya2Rvd25SZW5kZXJSZXN1bHQpOiBJTWFya2Rvd25SZW5kZXJSZXN1bHQge1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHJlc3VsdC5lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2EnKS5mb3JFYWNoKChlbGVtZW50KSA9PiB7XG5cdFx0XHRpZiAoZWxlbWVudC50aXRsZSkge1xuXHRcdFx0XHRjb25zdCB0aXRsZSA9IGVsZW1lbnQudGl0bGU7XG5cdFx0XHRcdGVsZW1lbnQudGl0bGUgPSAnJztcblx0XHRcdFx0c3RvcmUuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdlbGVtZW50JyksIGVsZW1lbnQsIHRpdGxlKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWxlbWVudDogcmVzdWx0LmVsZW1lbnQsXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdHJlc3VsdC5kaXNwb3NlKCk7XG5cdFx0XHRcdHN0b3JlLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIG9wZW5NYXJrZG93bkxpbmsobGluazogc3RyaW5nLCBtYXJrZG93bjogSU1hcmtkb3duU3RyaW5nKSB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZShsaW5rKTtcblx0XHRcdGlmICgoYXdhaXQgdGhpcy5maWxlU2VydmljZS5zdGF0KHVyaSkpLmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKFJFVkVBTF9JTl9FWFBMT1JFUl9DT01NQU5EX0lELCB1cmkpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2gge1xuXHRcdFx0Ly8gbm9vcFxuXHRcdH1cblxuXHRcdHJldHVybiBzdXBlci5vcGVuTWFya2Rvd25MaW5rKGxpbmssIG1hcmtkb3duKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLCtCQUErQjtBQUV4QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFdBQVc7QUFDcEIsU0FBMEQsd0JBQXdCO0FBQ2xGLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsNkJBQTZCO0FBRXRDLE1BQU0sa0JBQWtCO0FBQUEsRUFDdkI7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUE7QUFBQTtBQUFBLEVBSUE7QUFBQSxFQUNBO0FBQ0Q7QUFLTyxJQUFNLHVCQUFOLGNBQW1DLGlCQUFpQjtBQUFBLEVBQzFELFlBQ0MsU0FDa0IsaUJBQ0YsZUFDd0Isc0JBQ1IsY0FDRCxhQUNHLGdCQUNqQztBQUNELFVBQU0sV0FBVyxDQUFDLEdBQUcsaUJBQWlCLGFBQWE7QUFMWDtBQUNSO0FBQ0Q7QUFDRztBQUFBLEVBR25DO0FBQUEsRUFFUyxPQUFPLFVBQXVDLFNBQWlDLGVBQXNEO0FBQzdJLGNBQVU7QUFBQSxNQUNULEdBQUc7QUFBQSxNQUNILHNCQUFzQixDQUFDLFFBQVEsS0FBSyxxQkFBcUIsUUFBUSxHQUFHO0FBQUEsTUFDcEUsa0JBQWtCO0FBQUEsUUFDakIsc0JBQXNCO0FBQUEsUUFDdEIsYUFBYTtBQUFBLE1BQ2Q7QUFBQSxJQUNEO0FBRUEsVUFBTSxhQUEyQyxZQUFZLFNBQVMsY0FDckU7QUFBQSxNQUNDLEdBQUc7QUFBQTtBQUFBO0FBQUEsTUFJSCxPQUFPO0FBQUE7QUFBQSxFQUFhLFNBQVMsS0FBSztBQUFBLElBQ25DLElBQ0U7QUFDSCxVQUFNLFNBQVMsTUFBTSxPQUFPLFlBQVksU0FBUyxhQUFhO0FBQzlELFdBQU8sS0FBSyxrQkFBa0IsTUFBTTtBQUFBLEVBQ3JDO0FBQUEsRUFFUSxrQkFBa0IsUUFBc0Q7QUFDL0UsVUFBTSxRQUFRLElBQUksZ0JBQWdCO0FBQ2xDLFdBQU8sUUFBUSxpQkFBaUIsR0FBRyxFQUFFLFFBQVEsQ0FBQyxZQUFZO0FBQ3pELFVBQUksUUFBUSxPQUFPO0FBQ2xCLGNBQU0sUUFBUSxRQUFRO0FBQ3RCLGdCQUFRLFFBQVE7QUFDaEIsY0FBTSxJQUFJLEtBQUssYUFBYSxrQkFBa0Isd0JBQXdCLFNBQVMsR0FBRyxTQUFTLEtBQUssQ0FBQztBQUFBLE1BQ2xHO0FBQUEsSUFDRCxDQUFDO0FBRUQsV0FBTztBQUFBLE1BQ04sU0FBUyxPQUFPO0FBQUEsTUFDaEIsU0FBUyxNQUFNO0FBQ2QsZUFBTyxRQUFRO0FBQ2YsY0FBTSxRQUFRO0FBQUEsTUFDZjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUF5QixpQkFBaUIsTUFBYyxVQUEyQjtBQUNsRixRQUFJO0FBQ0gsWUFBTSxNQUFNLElBQUksTUFBTSxJQUFJO0FBQzFCLFdBQUssTUFBTSxLQUFLLFlBQVksS0FBSyxHQUFHLEdBQUcsYUFBYTtBQUNuRCxlQUFPLEtBQUssZUFBZSxlQUFlLCtCQUErQixHQUFHO0FBQUEsTUFDN0U7QUFBQSxJQUNELFFBQVE7QUFBQSxJQUVSO0FBRUEsV0FBTyxNQUFNLGlCQUFpQixNQUFNLFFBQVE7QUFBQSxFQUM3QztBQUNEO0FBbkVhLHVCQUFOO0FBQUEsRUFHSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FSVTsiLAogICJuYW1lcyI6IFtdCn0K
