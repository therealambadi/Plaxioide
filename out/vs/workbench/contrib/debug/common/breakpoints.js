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
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
let Breakpoints = class {
  constructor(breakpointContribution, contextKeyService) {
    this.breakpointContribution = breakpointContribution;
    this.contextKeyService = contextKeyService;
    this.breakpointsWhen = typeof breakpointContribution.when === "string" ? ContextKeyExpr.deserialize(breakpointContribution.when) : void 0;
  }
  get language() {
    return this.breakpointContribution.language;
  }
  get enabled() {
    return !this.breakpointsWhen || this.contextKeyService.contextMatchesRules(this.breakpointsWhen);
  }
};
Breakpoints = __decorateClass([
  __decorateParam(1, IContextKeyService)
], Breakpoints);
export {
  Breakpoints
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9jb21tb24vYnJlYWtwb2ludHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgQ29udGV4dEtleUV4cHJlc3Npb24sIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUJyZWFrcG9pbnRDb250cmlidXRpb24gfSBmcm9tICcuL2RlYnVnLmpzJztcblxuZXhwb3J0IGNsYXNzIEJyZWFrcG9pbnRzIHtcblxuXHRwcml2YXRlIGJyZWFrcG9pbnRzV2hlbjogQ29udGV4dEtleUV4cHJlc3Npb24gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBicmVha3BvaW50Q29udHJpYnV0aW9uOiBJQnJlYWtwb2ludENvbnRyaWJ1dGlvbixcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5icmVha3BvaW50c1doZW4gPSB0eXBlb2YgYnJlYWtwb2ludENvbnRyaWJ1dGlvbi53aGVuID09PSAnc3RyaW5nJyA/IENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKGJyZWFrcG9pbnRDb250cmlidXRpb24ud2hlbikgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXQgbGFuZ3VhZ2UoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5icmVha3BvaW50Q29udHJpYnV0aW9uLmxhbmd1YWdlO1xuXHR9XG5cblx0Z2V0IGVuYWJsZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICF0aGlzLmJyZWFrcG9pbnRzV2hlbiB8fCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXModGhpcy5icmVha3BvaW50c1doZW4pO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQXNDLDBCQUEwQjtBQUdsRSxJQUFNLGNBQU4sTUFBa0I7QUFBQSxFQUl4QixZQUNrQix3QkFDb0IsbUJBQ3BDO0FBRmdCO0FBQ29CO0FBRXJDLFNBQUssa0JBQWtCLE9BQU8sdUJBQXVCLFNBQVMsV0FBVyxlQUFlLFlBQVksdUJBQXVCLElBQUksSUFBSTtBQUFBLEVBQ3BJO0FBQUEsRUFFQSxJQUFJLFdBQW1CO0FBQ3RCLFdBQU8sS0FBSyx1QkFBdUI7QUFBQSxFQUNwQztBQUFBLEVBRUEsSUFBSSxVQUFtQjtBQUN0QixXQUFPLENBQUMsS0FBSyxtQkFBbUIsS0FBSyxrQkFBa0Isb0JBQW9CLEtBQUssZUFBZTtBQUFBLEVBQ2hHO0FBQ0Q7QUFsQmEsY0FBTjtBQUFBLEVBTUo7QUFBQSxHQU5VOyIsCiAgIm5hbWVzIjogW10KfQo=
