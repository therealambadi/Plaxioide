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
import { isLinux } from "../../../../base/common/platform.js";
import { parse } from "../../../../base/common/jsonc.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { IJSONEditingService } from "../../../services/configuration/common/jsonEditing.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
let EncryptionContribution = class {
  constructor(jsonEditingService, environmentService, fileService, storageService) {
    this.jsonEditingService = jsonEditingService;
    this.environmentService = environmentService;
    this.fileService = fileService;
    this.storageService = storageService;
    this.migrateToGnomeLibsecret();
  }
  /**
   * Migrate the user from using the gnome or gnome-keyring password-store to gnome-libsecret.
   * TODO@TylerLeonhardt: This migration can be removed in 3 months or so and then storage
   * can be cleaned up.
   */
  async migrateToGnomeLibsecret() {
    if (!isLinux || this.storageService.getBoolean("encryption.migratedToGnomeLibsecret", StorageScope.APPLICATION, false)) {
      return;
    }
    try {
      const content = await this.fileService.readFile(this.environmentService.argvResource);
      const argv = parse(content.value.toString());
      if (argv["password-store"] === "gnome" || argv["password-store"] === "gnome-keyring") {
        this.jsonEditingService.write(this.environmentService.argvResource, [{ path: ["password-store"], value: "gnome-libsecret" }], true);
      }
      this.storageService.store("encryption.migratedToGnomeLibsecret", true, StorageScope.APPLICATION, StorageTarget.USER);
    } catch (error) {
      console.error(error);
    }
  }
};
EncryptionContribution = __decorateClass([
  __decorateParam(0, IJSONEditingService),
  __decorateParam(1, IEnvironmentService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IStorageService)
], EncryptionContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(EncryptionContribution, LifecyclePhase.Eventually);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9lbmNyeXB0aW9uL2VsZWN0cm9uLXNhbmRib3gvZW5jcnlwdGlvbi5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBpc0xpbnV4IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uYy5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBXb3JrYmVuY2hFeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSUpTT05FZGl0aW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb24vY29tbW9uL2pzb25FZGl0aW5nLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5jbGFzcyBFbmNyeXB0aW9uQ29udHJpYnV0aW9uIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSlNPTkVkaXRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkganNvbkVkaXRpbmdTZXJ2aWNlOiBJSlNPTkVkaXRpbmdTZXJ2aWNlLFxuXHRcdEBJRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMubWlncmF0ZVRvR25vbWVMaWJzZWNyZXQoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBNaWdyYXRlIHRoZSB1c2VyIGZyb20gdXNpbmcgdGhlIGdub21lIG9yIGdub21lLWtleXJpbmcgcGFzc3dvcmQtc3RvcmUgdG8gZ25vbWUtbGlic2VjcmV0LlxuXHQgKiBUT0RPQFR5bGVyTGVvbmhhcmR0OiBUaGlzIG1pZ3JhdGlvbiBjYW4gYmUgcmVtb3ZlZCBpbiAzIG1vbnRocyBvciBzbyBhbmQgdGhlbiBzdG9yYWdlXG5cdCAqIGNhbiBiZSBjbGVhbmVkIHVwLlxuXHQgKi9cblx0cHJpdmF0ZSBhc3luYyBtaWdyYXRlVG9Hbm9tZUxpYnNlY3JldCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIWlzTGludXggfHwgdGhpcy5zdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKCdlbmNyeXB0aW9uLm1pZ3JhdGVkVG9Hbm9tZUxpYnNlY3JldCcsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgZmFsc2UpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZSh0aGlzLmVudmlyb25tZW50U2VydmljZS5hcmd2UmVzb3VyY2UpO1xuXHRcdFx0Y29uc3QgYXJndiA9IHBhcnNlPHsgJ3Bhc3N3b3JkLXN0b3JlJz86IHN0cmluZyB9Pihjb250ZW50LnZhbHVlLnRvU3RyaW5nKCkpO1xuXHRcdFx0aWYgKGFyZ3ZbJ3Bhc3N3b3JkLXN0b3JlJ10gPT09ICdnbm9tZScgfHwgYXJndlsncGFzc3dvcmQtc3RvcmUnXSA9PT0gJ2dub21lLWtleXJpbmcnKSB7XG5cdFx0XHRcdHRoaXMuanNvbkVkaXRpbmdTZXJ2aWNlLndyaXRlKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmFyZ3ZSZXNvdXJjZSwgW3sgcGF0aDogWydwYXNzd29yZC1zdG9yZSddLCB2YWx1ZTogJ2dub21lLWxpYnNlY3JldCcgfV0sIHRydWUpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZSgnZW5jcnlwdGlvbi5taWdyYXRlZFRvR25vbWVMaWJzZWNyZXQnLCB0cnVlLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxufVxuXG5SZWdpc3RyeS5hczxJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLldvcmtiZW5jaCkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oRW5jcnlwdGlvbkNvbnRyaWJ1dGlvbiwgTGlmZWN5Y2xlUGhhc2UuRXZlbnR1YWxseSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLGFBQWE7QUFDdEIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBa0UsY0FBYywyQkFBMkI7QUFDM0csU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxzQkFBc0I7QUFFL0IsSUFBTSx5QkFBTixNQUErRDtBQUFBLEVBQzlELFlBQ3VDLG9CQUNBLG9CQUNQLGFBQ0csZ0JBQ2pDO0FBSnFDO0FBQ0E7QUFDUDtBQUNHO0FBRWxDLFNBQUssd0JBQXdCO0FBQUEsRUFDOUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPQSxNQUFjLDBCQUF5QztBQUN0RCxRQUFJLENBQUMsV0FBVyxLQUFLLGVBQWUsV0FBVyx1Q0FBdUMsYUFBYSxhQUFhLEtBQUssR0FBRztBQUN2SDtBQUFBLElBQ0Q7QUFDQSxRQUFJO0FBQ0gsWUFBTSxVQUFVLE1BQU0sS0FBSyxZQUFZLFNBQVMsS0FBSyxtQkFBbUIsWUFBWTtBQUNwRixZQUFNLE9BQU8sTUFBcUMsUUFBUSxNQUFNLFNBQVMsQ0FBQztBQUMxRSxVQUFJLEtBQUssZ0JBQWdCLE1BQU0sV0FBVyxLQUFLLGdCQUFnQixNQUFNLGlCQUFpQjtBQUNyRixhQUFLLG1CQUFtQixNQUFNLEtBQUssbUJBQW1CLGNBQWMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxnQkFBZ0IsR0FBRyxPQUFPLGtCQUFrQixDQUFDLEdBQUcsSUFBSTtBQUFBLE1BQ25JO0FBQ0EsV0FBSyxlQUFlLE1BQU0sdUNBQXVDLE1BQU0sYUFBYSxhQUFhLGNBQWMsSUFBSTtBQUFBLElBQ3BILFNBQVMsT0FBTztBQUNmLGNBQVEsTUFBTSxLQUFLO0FBQUEsSUFDcEI7QUFBQSxFQUNEO0FBQ0Q7QUE5Qk0seUJBQU47QUFBQSxFQUVHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FMRztBQWdDTixTQUFTLEdBQW9DLG9CQUFvQixTQUFTLEVBQUUsOEJBQThCLHdCQUF3QixlQUFlLFVBQVU7IiwKICAibmFtZXMiOiBbXQp9Cg==
