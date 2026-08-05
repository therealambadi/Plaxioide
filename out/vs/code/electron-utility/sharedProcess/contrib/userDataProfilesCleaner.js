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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
let UserDataProfilesCleaner = class extends Disposable {
  constructor(userDataProfilesService) {
    super();
    const scheduler = this._register(new RunOnceScheduler(
      () => {
        userDataProfilesService.cleanUp();
      },
      10 * 1e3
      /* after 10s */
    ));
    scheduler.schedule();
  }
};
UserDataProfilesCleaner = __decorateClass([
  __decorateParam(0, IUserDataProfilesService)
], UserDataProfilesCleaner);
export {
  UserDataProfilesCleaner
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9jb2RlL2VsZWN0cm9uLXV0aWxpdHkvc2hhcmVkUHJvY2Vzcy9jb250cmliL3VzZXJEYXRhUHJvZmlsZXNDbGVhbmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuXG5leHBvcnQgY2xhc3MgVXNlckRhdGFQcm9maWxlc0NsZWFuZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IHNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmNsZWFuVXAoKTtcblx0XHR9LCAxMCAqIDEwMDAgLyogYWZ0ZXIgMTBzICovKSk7XG5cdFx0c2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxnQ0FBZ0M7QUFFbEMsSUFBTSwwQkFBTixjQUFzQyxXQUFXO0FBQUEsRUFFdkQsWUFDMkIseUJBQ3pCO0FBQ0QsVUFBTTtBQUVOLFVBQU0sWUFBWSxLQUFLLFVBQVUsSUFBSTtBQUFBLE1BQWlCLE1BQU07QUFDM0QsZ0NBQXdCLFFBQVE7QUFBQSxNQUNqQztBQUFBLE1BQUcsS0FBSztBQUFBO0FBQUEsSUFBb0IsQ0FBQztBQUM3QixjQUFVLFNBQVM7QUFBQSxFQUNwQjtBQUNEO0FBWmEsMEJBQU47QUFBQSxFQUdKO0FBQUEsR0FIVTsiLAogICJuYW1lcyI6IFtdCn0K
