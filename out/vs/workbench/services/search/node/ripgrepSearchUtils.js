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
import { ILogService } from "../../../../platform/log/common/log.js";
import { SearchRange } from "../common/search.js";
import * as searchExtTypes from "../common/searchExtTypes.js";
function anchorGlob(glob) {
  return glob.startsWith("**") || glob.startsWith("/") ? glob : `/${glob}`;
}
function rangeToSearchRange(range) {
  return new SearchRange(range.start.line, range.start.character, range.end.line, range.end.character);
}
function searchRangeToRange(range) {
  return new searchExtTypes.Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
}
let OutputChannel = class {
  constructor(prefix, logService) {
    this.prefix = prefix;
    this.logService = logService;
  }
  appendLine(msg) {
    this.logService.debug(`${this.prefix}#search`, msg);
  }
};
OutputChannel = __decorateClass([
  __decorateParam(1, ILogService)
], OutputChannel);
export {
  OutputChannel,
  anchorGlob,
  rangeToSearchRange,
  searchRangeToRange
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL25vZGUvcmlwZ3JlcFNlYXJjaFV0aWxzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBTZWFyY2hSYW5nZSB9IGZyb20gJy4uL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0ICogYXMgc2VhcmNoRXh0VHlwZXMgZnJvbSAnLi4vY29tbW9uL3NlYXJjaEV4dFR5cGVzLmpzJztcblxuZXhwb3J0IHR5cGUgTWF5YmU8VD4gPSBUIHwgbnVsbCB8IHVuZGVmaW5lZDtcblxuZXhwb3J0IGZ1bmN0aW9uIGFuY2hvckdsb2IoZ2xvYjogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIGdsb2Iuc3RhcnRzV2l0aCgnKionKSB8fCBnbG9iLnN0YXJ0c1dpdGgoJy8nKSA/IGdsb2IgOiBgLyR7Z2xvYn1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmFuZ2VUb1NlYXJjaFJhbmdlKHJhbmdlOiBzZWFyY2hFeHRUeXBlcy5SYW5nZSk6IFNlYXJjaFJhbmdlIHtcblx0cmV0dXJuIG5ldyBTZWFyY2hSYW5nZShyYW5nZS5zdGFydC5saW5lLCByYW5nZS5zdGFydC5jaGFyYWN0ZXIsIHJhbmdlLmVuZC5saW5lLCByYW5nZS5lbmQuY2hhcmFjdGVyKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlYXJjaFJhbmdlVG9SYW5nZShyYW5nZTogU2VhcmNoUmFuZ2UpOiBzZWFyY2hFeHRUeXBlcy5SYW5nZSB7XG5cdHJldHVybiBuZXcgc2VhcmNoRXh0VHlwZXMuUmFuZ2UocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCByYW5nZS5zdGFydENvbHVtbiwgcmFuZ2UuZW5kTGluZU51bWJlciwgcmFuZ2UuZW5kQ29sdW1uKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJT3V0cHV0Q2hhbm5lbCB7XG5cdGFwcGVuZExpbmUobXNnOiBzdHJpbmcpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgT3V0cHV0Q2hhbm5lbCBpbXBsZW1lbnRzIElPdXRwdXRDaGFubmVsIHtcblx0Y29uc3RydWN0b3IocHJpdmF0ZSBwcmVmaXg6IHN0cmluZywgQElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UpIHsgfVxuXG5cdGFwcGVuZExpbmUobXNnOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UuZGVidWcoYCR7dGhpcy5wcmVmaXh9I3NlYXJjaGAsIG1zZyk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxtQkFBbUI7QUFDNUIsWUFBWSxvQkFBb0I7QUFJekIsU0FBUyxXQUFXLE1BQXNCO0FBQ2hELFNBQU8sS0FBSyxXQUFXLElBQUksS0FBSyxLQUFLLFdBQVcsR0FBRyxJQUFJLE9BQU8sSUFBSSxJQUFJO0FBQ3ZFO0FBRU8sU0FBUyxtQkFBbUIsT0FBMEM7QUFDNUUsU0FBTyxJQUFJLFlBQVksTUFBTSxNQUFNLE1BQU0sTUFBTSxNQUFNLFdBQVcsTUFBTSxJQUFJLE1BQU0sTUFBTSxJQUFJLFNBQVM7QUFDcEc7QUFFTyxTQUFTLG1CQUFtQixPQUEwQztBQUM1RSxTQUFPLElBQUksZUFBZSxNQUFNLE1BQU0saUJBQWlCLE1BQU0sYUFBYSxNQUFNLGVBQWUsTUFBTSxTQUFTO0FBQy9HO0FBTU8sSUFBTSxnQkFBTixNQUE4QztBQUFBLEVBQ3BELFlBQW9CLFFBQThDLFlBQXlCO0FBQXZFO0FBQThDO0FBQUEsRUFBMkI7QUFBQSxFQUU3RixXQUFXLEtBQW1CO0FBQzdCLFNBQUssV0FBVyxNQUFNLEdBQUcsS0FBSyxNQUFNLFdBQVcsR0FBRztBQUFBLEVBQ25EO0FBQ0Q7QUFOYSxnQkFBTjtBQUFBLEVBQytCO0FBQUEsR0FEekI7IiwKICAibmFtZXMiOiBbXQp9Cg==
