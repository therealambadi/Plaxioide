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
import { transformOutgoingURIs } from "../../../base/common/uriIpc.js";
import { INativeMcpDiscoveryHelperService } from "../common/nativeMcpDiscoveryHelper.js";
let NativeMcpDiscoveryHelperChannel = class {
  constructor(getUriTransformer, nativeMcpDiscoveryHelperService) {
    this.getUriTransformer = getUriTransformer;
    this.nativeMcpDiscoveryHelperService = nativeMcpDiscoveryHelperService;
  }
  listen(context, event) {
    throw new Error("Invalid listen");
  }
  async call(context, command, args) {
    const uriTransformer = this.getUriTransformer?.(context);
    switch (command) {
      case "load": {
        const result = await this.nativeMcpDiscoveryHelperService.load();
        return uriTransformer ? transformOutgoingURIs(result, uriTransformer) : result;
      }
    }
    throw new Error("Invalid call");
  }
};
NativeMcpDiscoveryHelperChannel = __decorateClass([
  __decorateParam(1, INativeMcpDiscoveryHelperService)
], NativeMcpDiscoveryHelperChannel);
export {
  NativeMcpDiscoveryHelperChannel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9tY3Avbm9kZS9uYXRpdmVNY3BEaXNjb3ZlcnlIZWxwZXJDaGFubmVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJVVJJVHJhbnNmb3JtZXIsIHRyYW5zZm9ybU91dGdvaW5nVVJJcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaUlwYy5qcyc7XG5pbXBvcnQgeyBJU2VydmVyQ2hhbm5lbCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvcGFydHMvaXBjL2NvbW1vbi9pcGMuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZU1jcERpc2NvdmVyeUhlbHBlclNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbmF0aXZlTWNwRGlzY292ZXJ5SGVscGVyLmpzJztcblxuZXhwb3J0IGNsYXNzIE5hdGl2ZU1jcERpc2NvdmVyeUhlbHBlckNoYW5uZWwgaW1wbGVtZW50cyBJU2VydmVyQ2hhbm5lbCB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBnZXRVcmlUcmFuc2Zvcm1lcjogdW5kZWZpbmVkIHwgKChyZXF1ZXN0Q29udGV4dDogYW55KSA9PiBJVVJJVHJhbnNmb3JtZXIpLFxuXHRcdEBJTmF0aXZlTWNwRGlzY292ZXJ5SGVscGVyU2VydmljZSBwcml2YXRlIG5hdGl2ZU1jcERpc2NvdmVyeUhlbHBlclNlcnZpY2U6IElOYXRpdmVNY3BEaXNjb3ZlcnlIZWxwZXJTZXJ2aWNlXG5cdCkgeyB9XG5cblx0bGlzdGVuKGNvbnRleHQ6IGFueSwgZXZlbnQ6IHN0cmluZyk6IEV2ZW50PGFueT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsaXN0ZW4nKTtcblx0fVxuXG5cdGFzeW5jIGNhbGwoY29udGV4dDogYW55LCBjb21tYW5kOiBzdHJpbmcsIGFyZ3M/OiBhbnkpOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IHVyaVRyYW5zZm9ybWVyID0gdGhpcy5nZXRVcmlUcmFuc2Zvcm1lcj8uKGNvbnRleHQpO1xuXHRcdHN3aXRjaCAoY29tbWFuZCkge1xuXHRcdFx0Y2FzZSAnbG9hZCc6IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5uYXRpdmVNY3BEaXNjb3ZlcnlIZWxwZXJTZXJ2aWNlLmxvYWQoKTtcblx0XHRcdFx0cmV0dXJuIHVyaVRyYW5zZm9ybWVyID8gdHJhbnNmb3JtT3V0Z29pbmdVUklzKHJlc3VsdCwgdXJpVHJhbnNmb3JtZXIpIDogcmVzdWx0O1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY2FsbCcpO1xuXHR9XG59XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBMEIsNkJBQTZCO0FBRXZELFNBQVMsd0NBQXdDO0FBRTFDLElBQU0sa0NBQU4sTUFBZ0U7QUFBQSxFQUV0RSxZQUNTLG1CQUNrQyxpQ0FDekM7QUFGTztBQUNrQztBQUFBLEVBQ3ZDO0FBQUEsRUFFSixPQUFPLFNBQWMsT0FBMkI7QUFDL0MsVUFBTSxJQUFJLE1BQU0sZ0JBQWdCO0FBQUEsRUFDakM7QUFBQSxFQUVBLE1BQU0sS0FBSyxTQUFjLFNBQWlCLE1BQTBCO0FBQ25FLFVBQU0saUJBQWlCLEtBQUssb0JBQW9CLE9BQU87QUFDdkQsWUFBUSxTQUFTO0FBQUEsTUFDaEIsS0FBSyxRQUFRO0FBQ1osY0FBTSxTQUFTLE1BQU0sS0FBSyxnQ0FBZ0MsS0FBSztBQUMvRCxlQUFPLGlCQUFpQixzQkFBc0IsUUFBUSxjQUFjLElBQUk7QUFBQSxNQUN6RTtBQUFBLElBQ0Q7QUFDQSxVQUFNLElBQUksTUFBTSxjQUFjO0FBQUEsRUFDL0I7QUFDRDtBQXJCYSxrQ0FBTjtBQUFBLEVBSUo7QUFBQSxHQUpVOyIsCiAgIm5hbWVzIjogW10KfQo=
