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
import { marked } from "../../../../base/common/marked/marked.js";
import { localize } from "../../../../nls.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { IAccessibleViewService } from "../../../../platform/accessibility/browser/accessibleView.js";
import { isRequestVM, isResponseVM } from "../common/chatViewModel.js";
let ChatAccessibilityProvider = class {
  constructor(_accessibleViewService) {
    this._accessibleViewService = _accessibleViewService;
  }
  getWidgetRole() {
    return "list";
  }
  getRole(element) {
    return "listitem";
  }
  getWidgetAriaLabel() {
    return localize("chat", "Chat");
  }
  getAriaLabel(element) {
    if (isRequestVM(element)) {
      return element.messageText;
    }
    if (isResponseVM(element)) {
      return this._getLabelWithInfo(element);
    }
    return "";
  }
  _getLabelWithInfo(element) {
    const accessibleViewHint = this._accessibleViewService.getOpenAriaHint(AccessibilityVerbositySettingId.Chat);
    let label = "";
    const toolInvocation = element.response.value.filter((v) => v.kind === "toolInvocation").filter((v) => !v.isComplete);
    let toolInvocationHint = "";
    if (toolInvocation.length) {
      const titles = toolInvocation.map((v) => v.confirmationMessages?.title).filter((v) => !!v);
      if (titles.length) {
        toolInvocationHint = localize("toolInvocationsHint", "Action required: {0} ", titles.join(", "));
      }
    }
    const tableCount = marked.lexer(element.response.toString()).filter((token) => token.type === "table")?.length ?? 0;
    let tableCountHint = "";
    switch (tableCount) {
      case 0:
        break;
      case 1:
        tableCountHint = localize("singleTableHint", "1 table ");
        break;
      default:
        tableCountHint = localize("multiTableHint", "{0} tables ", tableCount);
        break;
    }
    const fileTreeCount = element.response.value.filter((v) => v.kind === "treeData").length ?? 0;
    let fileTreeCountHint = "";
    switch (fileTreeCount) {
      case 0:
        break;
      case 1:
        fileTreeCountHint = localize("singleFileTreeHint", "1 file tree ");
        break;
      default:
        fileTreeCountHint = localize("multiFileTreeHint", "{0} file trees ", fileTreeCount);
        break;
    }
    const codeBlockCount = marked.lexer(element.response.toString()).filter((token) => token.type === "code")?.length ?? 0;
    switch (codeBlockCount) {
      case 0:
        label = accessibleViewHint ? localize("noCodeBlocksHint", "{0}{1}{2}{3} {4}", toolInvocationHint, fileTreeCountHint, tableCountHint, element.response.toString(), accessibleViewHint) : localize("noCodeBlocks", "{0} {1}", fileTreeCountHint, element.response.toString());
        break;
      case 1:
        label = accessibleViewHint ? localize("singleCodeBlockHint", "{0}{1}1 code block: {2} {3}{4}", toolInvocationHint, fileTreeCountHint, tableCountHint, element.response.toString(), accessibleViewHint) : localize("singleCodeBlock", "{0} 1 code block: {1}", fileTreeCountHint, element.response.toString());
        break;
      default:
        label = accessibleViewHint ? localize("multiCodeBlockHint", "{0}{1}{2} code blocks: {3}{4}", toolInvocationHint, fileTreeCountHint, tableCountHint, codeBlockCount, element.response.toString(), accessibleViewHint) : localize("multiCodeBlock", "{0} {1} code blocks", fileTreeCountHint, codeBlockCount, element.response.toString());
        break;
    }
    return label;
  }
};
ChatAccessibilityProvider = __decorateClass([
  __decorateParam(0, IAccessibleViewService)
], ChatAccessibilityProvider);
export {
  ChatAccessibilityProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEFjY2Vzc2liaWxpdHlQcm92aWRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEFyaWFSb2xlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgbWFya2VkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFya2VkL21hcmtlZC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2liaWxpdHlDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmxlVmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXcuanMnO1xuaW1wb3J0IHsgQ2hhdFRyZWVJdGVtIH0gZnJvbSAnLi9jaGF0LmpzJztcbmltcG9ydCB7IGlzUmVxdWVzdFZNLCBpc1Jlc3BvbnNlVk0sIElDaGF0UmVzcG9uc2VWaWV3TW9kZWwgfSBmcm9tICcuLi9jb21tb24vY2hhdFZpZXdNb2RlbC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBDaGF0QWNjZXNzaWJpbGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8Q2hhdFRyZWVJdGVtPiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElBY2Nlc3NpYmxlVmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJsZVZpZXdTZXJ2aWNlOiBJQWNjZXNzaWJsZVZpZXdTZXJ2aWNlXG5cdCkge1xuXHR9XG5cdGdldFdpZGdldFJvbGUoKTogQXJpYVJvbGUge1xuXHRcdHJldHVybiAnbGlzdCc7XG5cdH1cblxuXHRnZXRSb2xlKGVsZW1lbnQ6IENoYXRUcmVlSXRlbSk6IEFyaWFSb2xlIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gJ2xpc3RpdGVtJztcblx0fVxuXG5cdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnY2hhdCcsIFwiQ2hhdFwiKTtcblx0fVxuXG5cdGdldEFyaWFMYWJlbChlbGVtZW50OiBDaGF0VHJlZUl0ZW0pOiBzdHJpbmcge1xuXHRcdGlmIChpc1JlcXVlc3RWTShlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQubWVzc2FnZVRleHQ7XG5cdFx0fVxuXG5cdFx0aWYgKGlzUmVzcG9uc2VWTShlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2dldExhYmVsV2l0aEluZm8oZWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0TGFiZWxXaXRoSW5mbyhlbGVtZW50OiBJQ2hhdFJlc3BvbnNlVmlld01vZGVsKTogc3RyaW5nIHtcblx0XHRjb25zdCBhY2Nlc3NpYmxlVmlld0hpbnQgPSB0aGlzLl9hY2Nlc3NpYmxlVmlld1NlcnZpY2UuZ2V0T3BlbkFyaWFIaW50KEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuQ2hhdCk7XG5cdFx0bGV0IGxhYmVsOiBzdHJpbmcgPSAnJztcblxuXHRcdGNvbnN0IHRvb2xJbnZvY2F0aW9uID0gZWxlbWVudC5yZXNwb25zZS52YWx1ZS5maWx0ZXIodiA9PiB2LmtpbmQgPT09ICd0b29sSW52b2NhdGlvbicpLmZpbHRlcih2ID0+ICF2LmlzQ29tcGxldGUpO1xuXHRcdGxldCB0b29sSW52b2NhdGlvbkhpbnQgPSAnJztcblx0XHRpZiAodG9vbEludm9jYXRpb24ubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCB0aXRsZXMgPSB0b29sSW52b2NhdGlvbi5tYXAodiA9PiB2LmNvbmZpcm1hdGlvbk1lc3NhZ2VzPy50aXRsZSkuZmlsdGVyKHYgPT4gISF2KTtcblx0XHRcdGlmICh0aXRsZXMubGVuZ3RoKSB7XG5cdFx0XHRcdHRvb2xJbnZvY2F0aW9uSGludCA9IGxvY2FsaXplKCd0b29sSW52b2NhdGlvbnNIaW50JywgXCJBY3Rpb24gcmVxdWlyZWQ6IHswfSBcIiwgdGl0bGVzLmpvaW4oJywgJykpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCB0YWJsZUNvdW50ID0gbWFya2VkLmxleGVyKGVsZW1lbnQucmVzcG9uc2UudG9TdHJpbmcoKSkuZmlsdGVyKHRva2VuID0+IHRva2VuLnR5cGUgPT09ICd0YWJsZScpPy5sZW5ndGggPz8gMDtcblx0XHRsZXQgdGFibGVDb3VudEhpbnQgPSAnJztcblx0XHRzd2l0Y2ggKHRhYmxlQ291bnQpIHtcblx0XHRcdGNhc2UgMDpcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRhYmxlQ291bnRIaW50ID0gbG9jYWxpemUoJ3NpbmdsZVRhYmxlSGludCcsIFwiMSB0YWJsZSBcIik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGFibGVDb3VudEhpbnQgPSBsb2NhbGl6ZSgnbXVsdGlUYWJsZUhpbnQnLCBcInswfSB0YWJsZXMgXCIsIHRhYmxlQ291bnQpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRjb25zdCBmaWxlVHJlZUNvdW50ID0gZWxlbWVudC5yZXNwb25zZS52YWx1ZS5maWx0ZXIodiA9PiB2LmtpbmQgPT09ICd0cmVlRGF0YScpLmxlbmd0aCA/PyAwO1xuXHRcdGxldCBmaWxlVHJlZUNvdW50SGludCA9ICcnO1xuXHRcdHN3aXRjaCAoZmlsZVRyZWVDb3VudCkge1xuXHRcdFx0Y2FzZSAwOlxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0ZmlsZVRyZWVDb3VudEhpbnQgPSBsb2NhbGl6ZSgnc2luZ2xlRmlsZVRyZWVIaW50JywgXCIxIGZpbGUgdHJlZSBcIik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0ZmlsZVRyZWVDb3VudEhpbnQgPSBsb2NhbGl6ZSgnbXVsdGlGaWxlVHJlZUhpbnQnLCBcInswfSBmaWxlIHRyZWVzIFwiLCBmaWxlVHJlZUNvdW50KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdGNvbnN0IGNvZGVCbG9ja0NvdW50ID0gbWFya2VkLmxleGVyKGVsZW1lbnQucmVzcG9uc2UudG9TdHJpbmcoKSkuZmlsdGVyKHRva2VuID0+IHRva2VuLnR5cGUgPT09ICdjb2RlJyk/Lmxlbmd0aCA/PyAwO1xuXHRcdHN3aXRjaCAoY29kZUJsb2NrQ291bnQpIHtcblx0XHRcdGNhc2UgMDpcblx0XHRcdFx0bGFiZWwgPSBhY2Nlc3NpYmxlVmlld0hpbnQgPyBsb2NhbGl6ZSgnbm9Db2RlQmxvY2tzSGludCcsIFwiezB9ezF9ezJ9ezN9IHs0fVwiLCB0b29sSW52b2NhdGlvbkhpbnQsIGZpbGVUcmVlQ291bnRIaW50LCB0YWJsZUNvdW50SGludCwgZWxlbWVudC5yZXNwb25zZS50b1N0cmluZygpLCBhY2Nlc3NpYmxlVmlld0hpbnQpIDogbG9jYWxpemUoJ25vQ29kZUJsb2NrcycsIFwiezB9IHsxfVwiLCBmaWxlVHJlZUNvdW50SGludCwgZWxlbWVudC5yZXNwb25zZS50b1N0cmluZygpKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdGxhYmVsID0gYWNjZXNzaWJsZVZpZXdIaW50ID8gbG9jYWxpemUoJ3NpbmdsZUNvZGVCbG9ja0hpbnQnLCBcInswfXsxfTEgY29kZSBibG9jazogezJ9IHszfXs0fVwiLCB0b29sSW52b2NhdGlvbkhpbnQsIGZpbGVUcmVlQ291bnRIaW50LCB0YWJsZUNvdW50SGludCwgZWxlbWVudC5yZXNwb25zZS50b1N0cmluZygpLCBhY2Nlc3NpYmxlVmlld0hpbnQpIDogbG9jYWxpemUoJ3NpbmdsZUNvZGVCbG9jaycsIFwiezB9IDEgY29kZSBibG9jazogezF9XCIsIGZpbGVUcmVlQ291bnRIaW50LCBlbGVtZW50LnJlc3BvbnNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGxhYmVsID0gYWNjZXNzaWJsZVZpZXdIaW50ID8gbG9jYWxpemUoJ211bHRpQ29kZUJsb2NrSGludCcsIFwiezB9ezF9ezJ9IGNvZGUgYmxvY2tzOiB7M317NH1cIiwgdG9vbEludm9jYXRpb25IaW50LCBmaWxlVHJlZUNvdW50SGludCwgdGFibGVDb3VudEhpbnQsIGNvZGVCbG9ja0NvdW50LCBlbGVtZW50LnJlc3BvbnNlLnRvU3RyaW5nKCksIGFjY2Vzc2libGVWaWV3SGludCkgOiBsb2NhbGl6ZSgnbXVsdGlDb2RlQmxvY2snLCBcInswfSB7MX0gY29kZSBibG9ja3NcIiwgZmlsZVRyZWVDb3VudEhpbnQsIGNvZGVCbG9ja0NvdW50LCBlbGVtZW50LnJlc3BvbnNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdFx0cmV0dXJuIGxhYmVsO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU9BLFNBQVMsY0FBYztBQUN2QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHVDQUF1QztBQUNoRCxTQUFTLDhCQUE4QjtBQUV2QyxTQUFTLGFBQWEsb0JBQTRDO0FBRTNELElBQU0sNEJBQU4sTUFBb0Y7QUFBQSxFQUUxRixZQUMwQyx3QkFDeEM7QUFEd0M7QUFBQSxFQUUxQztBQUFBLEVBQ0EsZ0JBQTBCO0FBQ3pCLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxRQUFRLFNBQTZDO0FBQ3BELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxxQkFBNkI7QUFDNUIsV0FBTyxTQUFTLFFBQVEsTUFBTTtBQUFBLEVBQy9CO0FBQUEsRUFFQSxhQUFhLFNBQStCO0FBQzNDLFFBQUksWUFBWSxPQUFPLEdBQUc7QUFDekIsYUFBTyxRQUFRO0FBQUEsSUFDaEI7QUFFQSxRQUFJLGFBQWEsT0FBTyxHQUFHO0FBQzFCLGFBQU8sS0FBSyxrQkFBa0IsT0FBTztBQUFBLElBQ3RDO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGtCQUFrQixTQUF5QztBQUNsRSxVQUFNLHFCQUFxQixLQUFLLHVCQUF1QixnQkFBZ0IsZ0NBQWdDLElBQUk7QUFDM0csUUFBSSxRQUFnQjtBQUVwQixVQUFNLGlCQUFpQixRQUFRLFNBQVMsTUFBTSxPQUFPLE9BQUssRUFBRSxTQUFTLGdCQUFnQixFQUFFLE9BQU8sT0FBSyxDQUFDLEVBQUUsVUFBVTtBQUNoSCxRQUFJLHFCQUFxQjtBQUN6QixRQUFJLGVBQWUsUUFBUTtBQUMxQixZQUFNLFNBQVMsZUFBZSxJQUFJLE9BQUssRUFBRSxzQkFBc0IsS0FBSyxFQUFFLE9BQU8sT0FBSyxDQUFDLENBQUMsQ0FBQztBQUNyRixVQUFJLE9BQU8sUUFBUTtBQUNsQiw2QkFBcUIsU0FBUyx1QkFBdUIseUJBQXlCLE9BQU8sS0FBSyxJQUFJLENBQUM7QUFBQSxNQUNoRztBQUFBLElBQ0Q7QUFDQSxVQUFNLGFBQWEsT0FBTyxNQUFNLFFBQVEsU0FBUyxTQUFTLENBQUMsRUFBRSxPQUFPLFdBQVMsTUFBTSxTQUFTLE9BQU8sR0FBRyxVQUFVO0FBQ2hILFFBQUksaUJBQWlCO0FBQ3JCLFlBQVEsWUFBWTtBQUFBLE1BQ25CLEtBQUs7QUFDSjtBQUFBLE1BQ0QsS0FBSztBQUNKLHlCQUFpQixTQUFTLG1CQUFtQixVQUFVO0FBQ3ZEO0FBQUEsTUFDRDtBQUNDLHlCQUFpQixTQUFTLGtCQUFrQixlQUFlLFVBQVU7QUFDckU7QUFBQSxJQUNGO0FBRUEsVUFBTSxnQkFBZ0IsUUFBUSxTQUFTLE1BQU0sT0FBTyxPQUFLLEVBQUUsU0FBUyxVQUFVLEVBQUUsVUFBVTtBQUMxRixRQUFJLG9CQUFvQjtBQUN4QixZQUFRLGVBQWU7QUFBQSxNQUN0QixLQUFLO0FBQ0o7QUFBQSxNQUNELEtBQUs7QUFDSiw0QkFBb0IsU0FBUyxzQkFBc0IsY0FBYztBQUNqRTtBQUFBLE1BQ0Q7QUFDQyw0QkFBb0IsU0FBUyxxQkFBcUIsbUJBQW1CLGFBQWE7QUFDbEY7QUFBQSxJQUNGO0FBQ0EsVUFBTSxpQkFBaUIsT0FBTyxNQUFNLFFBQVEsU0FBUyxTQUFTLENBQUMsRUFBRSxPQUFPLFdBQVMsTUFBTSxTQUFTLE1BQU0sR0FBRyxVQUFVO0FBQ25ILFlBQVEsZ0JBQWdCO0FBQUEsTUFDdkIsS0FBSztBQUNKLGdCQUFRLHFCQUFxQixTQUFTLG9CQUFvQixvQkFBb0Isb0JBQW9CLG1CQUFtQixnQkFBZ0IsUUFBUSxTQUFTLFNBQVMsR0FBRyxrQkFBa0IsSUFBSSxTQUFTLGdCQUFnQixXQUFXLG1CQUFtQixRQUFRLFNBQVMsU0FBUyxDQUFDO0FBQzFRO0FBQUEsTUFDRCxLQUFLO0FBQ0osZ0JBQVEscUJBQXFCLFNBQVMsdUJBQXVCLGtDQUFrQyxvQkFBb0IsbUJBQW1CLGdCQUFnQixRQUFRLFNBQVMsU0FBUyxHQUFHLGtCQUFrQixJQUFJLFNBQVMsbUJBQW1CLHlCQUF5QixtQkFBbUIsUUFBUSxTQUFTLFNBQVMsQ0FBQztBQUM1UztBQUFBLE1BQ0Q7QUFDQyxnQkFBUSxxQkFBcUIsU0FBUyxzQkFBc0IsaUNBQWlDLG9CQUFvQixtQkFBbUIsZ0JBQWdCLGdCQUFnQixRQUFRLFNBQVMsU0FBUyxHQUFHLGtCQUFrQixJQUFJLFNBQVMsa0JBQWtCLHVCQUF1QixtQkFBbUIsZ0JBQWdCLFFBQVEsU0FBUyxTQUFTLENBQUM7QUFDdlU7QUFBQSxJQUNGO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQWpGYSw0QkFBTjtBQUFBLEVBR0o7QUFBQSxHQUhVOyIsCiAgIm5hbWVzIjogW10KfQo=
