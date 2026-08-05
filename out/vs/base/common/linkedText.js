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
import { memoize } from "./decorators.js";
class LinkedText {
  constructor(nodes) {
    this.nodes = nodes;
  }
  toString() {
    return this.nodes.map((node) => typeof node === "string" ? node : node.label).join("");
  }
}
__decorateClass([
  memoize
], LinkedText.prototype, "toString", 1);
const LINK_REGEX = /\[([^\]]+)\]\(((?:https?:\/\/|command:|file:)[^\)\s]+)(?: (["'])(.+?)(\3))?\)/gi;
function parseLinkedText(text) {
  const result = [];
  let index = 0;
  let match;
  while (match = LINK_REGEX.exec(text)) {
    if (match.index - index > 0) {
      result.push(text.substring(index, match.index));
    }
    const [, label, href, , title] = match;
    if (title) {
      result.push({ label, href, title });
    } else {
      result.push({ label, href });
    }
    index = match.index + match[0].length;
  }
  if (index < text.length) {
    result.push(text.substring(index));
  }
  return new LinkedText(result);
}
export {
  LinkedText,
  parseLinkedText
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9saW5rZWRUZXh0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbWVtb2l6ZSB9IGZyb20gJy4vZGVjb3JhdG9ycy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmsge1xuXHRyZWFkb25seSBsYWJlbDogc3RyaW5nO1xuXHRyZWFkb25seSBocmVmOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHRpdGxlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBMaW5rZWRUZXh0Tm9kZSA9IHN0cmluZyB8IElMaW5rO1xuXG5leHBvcnQgY2xhc3MgTGlua2VkVGV4dCB7XG5cblx0Y29uc3RydWN0b3IocmVhZG9ubHkgbm9kZXM6IExpbmtlZFRleHROb2RlW10pIHsgfVxuXG5cdEBtZW1vaXplXG5cdHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMubm9kZXMubWFwKG5vZGUgPT4gdHlwZW9mIG5vZGUgPT09ICdzdHJpbmcnID8gbm9kZSA6IG5vZGUubGFiZWwpLmpvaW4oJycpO1xuXHR9XG59XG5cbmNvbnN0IExJTktfUkVHRVggPSAvXFxbKFteXFxdXSspXFxdXFwoKCg/Omh0dHBzPzpcXC9cXC98Y29tbWFuZDp8ZmlsZTopW15cXClcXHNdKykoPzogKFtcIiddKSguKz8pKFxcMykpP1xcKS9naTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTGlua2VkVGV4dCh0ZXh0OiBzdHJpbmcpOiBMaW5rZWRUZXh0IHtcblx0Y29uc3QgcmVzdWx0OiBMaW5rZWRUZXh0Tm9kZVtdID0gW107XG5cblx0bGV0IGluZGV4ID0gMDtcblx0bGV0IG1hdGNoOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuXG5cdHdoaWxlIChtYXRjaCA9IExJTktfUkVHRVguZXhlYyh0ZXh0KSkge1xuXHRcdGlmIChtYXRjaC5pbmRleCAtIGluZGV4ID4gMCkge1xuXHRcdFx0cmVzdWx0LnB1c2godGV4dC5zdWJzdHJpbmcoaW5kZXgsIG1hdGNoLmluZGV4KSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgWywgbGFiZWwsIGhyZWYsICwgdGl0bGVdID0gbWF0Y2g7XG5cblx0XHRpZiAodGl0bGUpIHtcblx0XHRcdHJlc3VsdC5wdXNoKHsgbGFiZWwsIGhyZWYsIHRpdGxlIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQucHVzaCh7IGxhYmVsLCBocmVmIH0pO1xuXHRcdH1cblxuXHRcdGluZGV4ID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGg7XG5cdH1cblxuXHRpZiAoaW5kZXggPCB0ZXh0Lmxlbmd0aCkge1xuXHRcdHJlc3VsdC5wdXNoKHRleHQuc3Vic3RyaW5nKGluZGV4KSk7XG5cdH1cblxuXHRyZXR1cm4gbmV3IExpbmtlZFRleHQocmVzdWx0KTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGVBQWU7QUFVakIsTUFBTSxXQUFXO0FBQUEsRUFFdkIsWUFBcUIsT0FBeUI7QUFBekI7QUFBQSxFQUEyQjtBQUFBLEVBR2hELFdBQW1CO0FBQ2xCLFdBQU8sS0FBSyxNQUFNLElBQUksVUFBUSxPQUFPLFNBQVMsV0FBVyxPQUFPLEtBQUssS0FBSyxFQUFFLEtBQUssRUFBRTtBQUFBLEVBQ3BGO0FBQ0Q7QUFIQztBQUFBLEVBREM7QUFBQSxHQUpXLFdBS1o7QUFLRCxNQUFNLGFBQWE7QUFFWixTQUFTLGdCQUFnQixNQUEwQjtBQUN6RCxRQUFNLFNBQTJCLENBQUM7QUFFbEMsTUFBSSxRQUFRO0FBQ1osTUFBSTtBQUVKLFNBQU8sUUFBUSxXQUFXLEtBQUssSUFBSSxHQUFHO0FBQ3JDLFFBQUksTUFBTSxRQUFRLFFBQVEsR0FBRztBQUM1QixhQUFPLEtBQUssS0FBSyxVQUFVLE9BQU8sTUFBTSxLQUFLLENBQUM7QUFBQSxJQUMvQztBQUVBLFVBQU0sQ0FBQyxFQUFFLE9BQU8sTUFBTSxFQUFFLEtBQUssSUFBSTtBQUVqQyxRQUFJLE9BQU87QUFDVixhQUFPLEtBQUssRUFBRSxPQUFPLE1BQU0sTUFBTSxDQUFDO0FBQUEsSUFDbkMsT0FBTztBQUNOLGFBQU8sS0FBSyxFQUFFLE9BQU8sS0FBSyxDQUFDO0FBQUEsSUFDNUI7QUFFQSxZQUFRLE1BQU0sUUFBUSxNQUFNLENBQUMsRUFBRTtBQUFBLEVBQ2hDO0FBRUEsTUFBSSxRQUFRLEtBQUssUUFBUTtBQUN4QixXQUFPLEtBQUssS0FBSyxVQUFVLEtBQUssQ0FBQztBQUFBLEVBQ2xDO0FBRUEsU0FBTyxJQUFJLFdBQVcsTUFBTTtBQUM3QjsiLAogICJuYW1lcyI6IFtdCn0K
