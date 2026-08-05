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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ILanguagePackService } from "../../../../platform/languagePacks/common/languagePacks.js";
let LocalizationsUpdater = class extends Disposable {
  constructor(localizationsService) {
    super();
    this.localizationsService = localizationsService;
    this.updateLocalizations();
  }
  updateLocalizations() {
    this.localizationsService.update();
  }
};
LocalizationsUpdater = __decorateClass([
  __decorateParam(0, ILanguagePackService)
], LocalizationsUpdater);
export {
  LocalizationsUpdater
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9jb2RlL2VsZWN0cm9uLXV0aWxpdHkvc2hhcmVkUHJvY2Vzcy9jb250cmliL2xvY2FsaXphdGlvbnNVcGRhdGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VQYWNrU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhbmd1YWdlUGFja3MvY29tbW9uL2xhbmd1YWdlUGFja3MuanMnO1xuaW1wb3J0IHsgTmF0aXZlTGFuZ3VhZ2VQYWNrU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhbmd1YWdlUGFja3Mvbm9kZS9sYW5ndWFnZVBhY2tzLmpzJztcblxuZXhwb3J0IGNsYXNzIExvY2FsaXphdGlvbnNVcGRhdGVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMYW5ndWFnZVBhY2tTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9jYWxpemF0aW9uc1NlcnZpY2U6IE5hdGl2ZUxhbmd1YWdlUGFja1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMudXBkYXRlTG9jYWxpemF0aW9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVMb2NhbGl6YXRpb25zKCk6IHZvaWQge1xuXHRcdHRoaXMubG9jYWxpemF0aW9uc1NlcnZpY2UudXBkYXRlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyw0QkFBNEI7QUFHOUIsSUFBTSx1QkFBTixjQUFtQyxXQUFXO0FBQUEsRUFFcEQsWUFDd0Msc0JBQ3RDO0FBQ0QsVUFBTTtBQUZpQztBQUl2QyxTQUFLLG9CQUFvQjtBQUFBLEVBQzFCO0FBQUEsRUFFUSxzQkFBNEI7QUFDbkMsU0FBSyxxQkFBcUIsT0FBTztBQUFBLEVBQ2xDO0FBQ0Q7QUFiYSx1QkFBTjtBQUFBLEVBR0o7QUFBQSxHQUhVOyIsCiAgIm5hbWVzIjogW10KfQo=
