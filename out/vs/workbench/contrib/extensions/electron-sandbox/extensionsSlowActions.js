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
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Action } from "../../../../base/common/actions.js";
import { URI } from "../../../../base/common/uri.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { localize } from "../../../../nls.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { IRequestService, asText } from "../../../../platform/request/common/request.js";
import { joinPath } from "../../../../base/common/resources.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-sandbox/environmentService.js";
import { Utils } from "../../../../platform/profiling/common/profiling.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
class RepoInfo {
  static fromExtension(desc) {
    let result;
    if (desc.bugs && typeof desc.bugs.url === "string") {
      const base = URI.parse(desc.bugs.url);
      const match = /\/([^/]+)\/([^/]+)\/issues\/?$/.exec(desc.bugs.url);
      if (match) {
        result = {
          base: base.with({ path: null, fragment: null, query: null }).toString(true),
          owner: match[1],
          repo: match[2]
        };
      }
    }
    if (!result && desc.repository && typeof desc.repository.url === "string") {
      const base = URI.parse(desc.repository.url);
      const match = /\/([^/]+)\/([^/]+)(\.git)?$/.exec(desc.repository.url);
      if (match) {
        result = {
          base: base.with({ path: null, fragment: null, query: null }).toString(true),
          owner: match[1],
          repo: match[2]
        };
      }
    }
    if (result && result.base.indexOf("github") === -1) {
      result = void 0;
    }
    return result;
  }
}
let SlowExtensionAction = class extends Action {
  constructor(extension, profile, _instantiationService) {
    super("report.slow", localize("cmd.reportOrShow", "Performance Issue"), "extension-action report-issue");
    this.extension = extension;
    this.profile = profile;
    this._instantiationService = _instantiationService;
    this.enabled = Boolean(RepoInfo.fromExtension(extension));
  }
  async run() {
    const action = await this._instantiationService.invokeFunction(createSlowExtensionAction, this.extension, this.profile);
    if (action) {
      await action.run();
    }
  }
};
SlowExtensionAction = __decorateClass([
  __decorateParam(2, IInstantiationService)
], SlowExtensionAction);
async function createSlowExtensionAction(accessor, extension, profile) {
  const info = RepoInfo.fromExtension(extension);
  if (!info) {
    return void 0;
  }
  const requestService = accessor.get(IRequestService);
  const instaService = accessor.get(IInstantiationService);
  const url = `https://api.github.com/search/issues?q=is:issue+state:open+in:title+repo:${info.owner}/${info.repo}+%22Extension+causes+high+cpu+load%22`;
  let res;
  try {
    res = await requestService.request({ url }, CancellationToken.None);
  } catch {
    return void 0;
  }
  const rawText = await asText(res);
  if (!rawText) {
    return void 0;
  }
  const data = JSON.parse(rawText);
  if (!data || typeof data.total_count !== "number") {
    return void 0;
  } else if (data.total_count === 0) {
    return instaService.createInstance(ReportExtensionSlowAction, extension, info, profile);
  } else {
    return instaService.createInstance(ShowExtensionSlowAction, extension, info, profile);
  }
}
let ReportExtensionSlowAction = class extends Action {
  constructor(extension, repoInfo, profile, _dialogService, _openerService, _productService, _nativeHostService, _environmentService, _fileService) {
    super("report.slow", localize("cmd.report", "Report Issue"));
    this.extension = extension;
    this.repoInfo = repoInfo;
    this.profile = profile;
    this._dialogService = _dialogService;
    this._openerService = _openerService;
    this._productService = _productService;
    this._nativeHostService = _nativeHostService;
    this._environmentService = _environmentService;
    this._fileService = _fileService;
  }
  async run() {
    const data = Utils.rewriteAbsolutePaths(this.profile.data, "pii_removed");
    const path = joinPath(this._environmentService.tmpDir, `${this.extension.identifier.value}-unresponsive.cpuprofile.txt`);
    await this._fileService.writeFile(path, VSBuffer.fromString(JSON.stringify(data, void 0, 4)));
    const os = await this._nativeHostService.getOSProperties();
    const title = encodeURIComponent("Extension causes high cpu load");
    const osVersion = `${os.type} ${os.arch} ${os.release}`;
    const message = `:warning: Make sure to **attach** this file from your *home*-directory:
:warning:\`${path}\`

Find more details here: https://github.com/microsoft/vscode/wiki/Explain-extension-causes-high-cpu-load`;
    const body = encodeURIComponent(`- Issue Type: \`Performance\`
- Extension Name: \`${this.extension.name}\`
- Extension Version: \`${this.extension.version}\`
- OS Version: \`${osVersion}\`
- VS Code version: \`${this._productService.version}\`

${message}`);
    const url = `${this.repoInfo.base}/${this.repoInfo.owner}/${this.repoInfo.repo}/issues/new/?body=${body}&title=${title}`;
    this._openerService.open(URI.parse(url));
    this._dialogService.info(
      localize("attach.title", "Did you attach the CPU-Profile?"),
      localize("attach.msg", "This is a reminder to make sure that you have not forgotten to attach '{0}' to the issue you have just created.", path.fsPath)
    );
  }
};
ReportExtensionSlowAction = __decorateClass([
  __decorateParam(3, IDialogService),
  __decorateParam(4, IOpenerService),
  __decorateParam(5, IProductService),
  __decorateParam(6, INativeHostService),
  __decorateParam(7, INativeWorkbenchEnvironmentService),
  __decorateParam(8, IFileService)
], ReportExtensionSlowAction);
let ShowExtensionSlowAction = class extends Action {
  constructor(extension, repoInfo, profile, _dialogService, _openerService, _environmentService, _fileService) {
    super("show.slow", localize("cmd.show", "Show Issues"));
    this.extension = extension;
    this.repoInfo = repoInfo;
    this.profile = profile;
    this._dialogService = _dialogService;
    this._openerService = _openerService;
    this._environmentService = _environmentService;
    this._fileService = _fileService;
  }
  async run() {
    const data = Utils.rewriteAbsolutePaths(this.profile.data, "pii_removed");
    const path = joinPath(this._environmentService.tmpDir, `${this.extension.identifier.value}-unresponsive.cpuprofile.txt`);
    await this._fileService.writeFile(path, VSBuffer.fromString(JSON.stringify(data, void 0, 4)));
    const url = `${this.repoInfo.base}/${this.repoInfo.owner}/${this.repoInfo.repo}/issues?utf8=\u2713&q=is%3Aissue+state%3Aopen+%22Extension+causes+high+cpu+load%22`;
    this._openerService.open(URI.parse(url));
    this._dialogService.info(
      localize("attach.title", "Did you attach the CPU-Profile?"),
      localize("attach.msg2", "This is a reminder to make sure that you have not forgotten to attach '{0}' to an existing performance issue.", path.fsPath)
    );
  }
};
ShowExtensionSlowAction = __decorateClass([
  __decorateParam(3, IDialogService),
  __decorateParam(4, IOpenerService),
  __decorateParam(5, INativeWorkbenchEnvironmentService),
  __decorateParam(6, IFileService)
], ShowExtensionSlowAction);
export {
  SlowExtensionAction,
  createSlowExtensionAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2VsZWN0cm9uLXNhbmRib3gvZXh0ZW5zaW9uc1Nsb3dBY3Rpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uSG9zdFByb2ZpbGUgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSVJlcXVlc3RTZXJ2aWNlLCBhc1RleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZXF1ZXN0L2NvbW1vbi9yZXF1ZXN0LmpzJztcbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElOYXRpdmVIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25hdGl2ZS9jb21tb24vbmF0aXZlLmpzJztcbmltcG9ydCB7IElOYXRpdmVXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9lbGVjdHJvbi1zYW5kYm94L2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2ZpbGluZy9jb21tb24vcHJvZmlsaW5nLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBJUmVxdWVzdENvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3BhcnRzL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuXG5hYnN0cmFjdCBjbGFzcyBSZXBvSW5mbyB7XG5cdGFic3RyYWN0IGdldCBiYXNlKCk6IHN0cmluZztcblx0YWJzdHJhY3QgZ2V0IG93bmVyKCk6IHN0cmluZztcblx0YWJzdHJhY3QgZ2V0IHJlcG8oKTogc3RyaW5nO1xuXG5cdHN0YXRpYyBmcm9tRXh0ZW5zaW9uKGRlc2M6IElFeHRlbnNpb25EZXNjcmlwdGlvbik6IFJlcG9JbmZvIHwgdW5kZWZpbmVkIHtcblxuXHRcdGxldCByZXN1bHQ6IFJlcG9JbmZvIHwgdW5kZWZpbmVkO1xuXG5cdFx0Ly8gc2NoZW1lOmF1dGgvT1dORVIvUkVQTy9pc3N1ZXMvXG5cdFx0aWYgKGRlc2MuYnVncyAmJiB0eXBlb2YgZGVzYy5idWdzLnVybCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGNvbnN0IGJhc2UgPSBVUkkucGFyc2UoZGVzYy5idWdzLnVybCk7XG5cdFx0XHRjb25zdCBtYXRjaCA9IC9cXC8oW14vXSspXFwvKFteL10rKVxcL2lzc3Vlc1xcLz8kLy5leGVjKGRlc2MuYnVncy51cmwpO1xuXHRcdFx0aWYgKG1hdGNoKSB7XG5cdFx0XHRcdHJlc3VsdCA9IHtcblx0XHRcdFx0XHRiYXNlOiBiYXNlLndpdGgoeyBwYXRoOiBudWxsLCBmcmFnbWVudDogbnVsbCwgcXVlcnk6IG51bGwgfSkudG9TdHJpbmcodHJ1ZSksXG5cdFx0XHRcdFx0b3duZXI6IG1hdGNoWzFdLFxuXHRcdFx0XHRcdHJlcG86IG1hdGNoWzJdXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8vIHNjaGVtZTphdXRoL09XTkVSL1JFUE8uZ2l0XG5cdFx0aWYgKCFyZXN1bHQgJiYgZGVzYy5yZXBvc2l0b3J5ICYmIHR5cGVvZiBkZXNjLnJlcG9zaXRvcnkudXJsID09PSAnc3RyaW5nJykge1xuXHRcdFx0Y29uc3QgYmFzZSA9IFVSSS5wYXJzZShkZXNjLnJlcG9zaXRvcnkudXJsKTtcblx0XHRcdGNvbnN0IG1hdGNoID0gL1xcLyhbXi9dKylcXC8oW14vXSspKFxcLmdpdCk/JC8uZXhlYyhkZXNjLnJlcG9zaXRvcnkudXJsKTtcblx0XHRcdGlmIChtYXRjaCkge1xuXHRcdFx0XHRyZXN1bHQgPSB7XG5cdFx0XHRcdFx0YmFzZTogYmFzZS53aXRoKHsgcGF0aDogbnVsbCwgZnJhZ21lbnQ6IG51bGwsIHF1ZXJ5OiBudWxsIH0pLnRvU3RyaW5nKHRydWUpLFxuXHRcdFx0XHRcdG93bmVyOiBtYXRjaFsxXSxcblx0XHRcdFx0XHRyZXBvOiBtYXRjaFsyXVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGZvciBub3cgb25seSBHSCBpcyBzdXBwb3J0ZWRcblx0XHRpZiAocmVzdWx0ICYmIHJlc3VsdC5iYXNlLmluZGV4T2YoJ2dpdGh1YicpID09PSAtMSkge1xuXHRcdFx0cmVzdWx0ID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNsb3dFeHRlbnNpb25BY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdHJlYWRvbmx5IHByb2ZpbGU6IElFeHRlbnNpb25Ib3N0UHJvZmlsZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCdyZXBvcnQuc2xvdycsIGxvY2FsaXplKCdjbWQucmVwb3J0T3JTaG93JywgXCJQZXJmb3JtYW5jZSBJc3N1ZVwiKSwgJ2V4dGVuc2lvbi1hY3Rpb24gcmVwb3J0LWlzc3VlJyk7XG5cdFx0dGhpcy5lbmFibGVkID0gQm9vbGVhbihSZXBvSW5mby5mcm9tRXh0ZW5zaW9uKGV4dGVuc2lvbikpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGFjdGlvbiA9IGF3YWl0IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGNyZWF0ZVNsb3dFeHRlbnNpb25BY3Rpb24sIHRoaXMuZXh0ZW5zaW9uLCB0aGlzLnByb2ZpbGUpO1xuXHRcdGlmIChhY3Rpb24pIHtcblx0XHRcdGF3YWl0IGFjdGlvbi5ydW4oKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNsb3dFeHRlbnNpb25BY3Rpb24oXG5cdGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLFxuXHRleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbixcblx0cHJvZmlsZTogSUV4dGVuc2lvbkhvc3RQcm9maWxlXG4pOiBQcm9taXNlPEFjdGlvbiB8IHVuZGVmaW5lZD4ge1xuXG5cdGNvbnN0IGluZm8gPSBSZXBvSW5mby5mcm9tRXh0ZW5zaW9uKGV4dGVuc2lvbik7XG5cdGlmICghaW5mbykge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRjb25zdCByZXF1ZXN0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUmVxdWVzdFNlcnZpY2UpO1xuXHRjb25zdCBpbnN0YVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0Y29uc3QgdXJsID0gYGh0dHBzOi8vYXBpLmdpdGh1Yi5jb20vc2VhcmNoL2lzc3Vlcz9xPWlzOmlzc3VlK3N0YXRlOm9wZW4raW46dGl0bGUrcmVwbzoke2luZm8ub3duZXJ9LyR7aW5mby5yZXBvfSslMjJFeHRlbnNpb24rY2F1c2VzK2hpZ2grY3B1K2xvYWQlMjJgO1xuXHRsZXQgcmVzOiBJUmVxdWVzdENvbnRleHQ7XG5cdHRyeSB7XG5cdFx0cmVzID0gYXdhaXQgcmVxdWVzdFNlcnZpY2UucmVxdWVzdCh7IHVybCB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0fSBjYXRjaCB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRjb25zdCByYXdUZXh0ID0gYXdhaXQgYXNUZXh0KHJlcyk7XG5cdGlmICghcmF3VGV4dCkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRjb25zdCBkYXRhID0gPHsgdG90YWxfY291bnQ6IG51bWJlciB9PkpTT04ucGFyc2UocmF3VGV4dCk7XG5cdGlmICghZGF0YSB8fCB0eXBlb2YgZGF0YS50b3RhbF9jb3VudCAhPT0gJ251bWJlcicpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9IGVsc2UgaWYgKGRhdGEudG90YWxfY291bnQgPT09IDApIHtcblx0XHRyZXR1cm4gaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlcG9ydEV4dGVuc2lvblNsb3dBY3Rpb24sIGV4dGVuc2lvbiwgaW5mbywgcHJvZmlsZSk7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTaG93RXh0ZW5zaW9uU2xvd0FjdGlvbiwgZXh0ZW5zaW9uLCBpbmZvLCBwcm9maWxlKTtcblx0fVxufVxuXG5jbGFzcyBSZXBvcnRFeHRlbnNpb25TbG93QWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRyZWFkb25seSByZXBvSW5mbzogUmVwb0luZm8sXG5cdFx0cmVhZG9ubHkgcHJvZmlsZTogSUV4dGVuc2lvbkhvc3RQcm9maWxlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9kaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJTmF0aXZlSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbmF0aXZlSG9zdFNlcnZpY2U6IElOYXRpdmVIb3N0U2VydmljZSxcblx0XHRASU5hdGl2ZVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lbnZpcm9ubWVudFNlcnZpY2U6IElOYXRpdmVXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigncmVwb3J0LnNsb3cnLCBsb2NhbGl6ZSgnY21kLnJlcG9ydCcsIFwiUmVwb3J0IElzc3VlXCIpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIHJld3JpdGUgcGlpIChwYXRocykgYW5kIHN0b3JlIG9uIGRpc2tcblx0XHRjb25zdCBkYXRhID0gVXRpbHMucmV3cml0ZUFic29sdXRlUGF0aHModGhpcy5wcm9maWxlLmRhdGEsICdwaWlfcmVtb3ZlZCcpO1xuXHRcdGNvbnN0IHBhdGggPSBqb2luUGF0aCh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UudG1wRGlyLCBgJHt0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlfS11bnJlc3BvbnNpdmUuY3B1cHJvZmlsZS50eHRgKTtcblx0XHRhd2FpdCB0aGlzLl9maWxlU2VydmljZS53cml0ZUZpbGUocGF0aCwgVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeShkYXRhLCB1bmRlZmluZWQsIDQpKSk7XG5cblx0XHQvLyBidWlsZCBpc3N1ZVxuXHRcdGNvbnN0IG9zID0gYXdhaXQgdGhpcy5fbmF0aXZlSG9zdFNlcnZpY2UuZ2V0T1NQcm9wZXJ0aWVzKCk7XG5cdFx0Y29uc3QgdGl0bGUgPSBlbmNvZGVVUklDb21wb25lbnQoJ0V4dGVuc2lvbiBjYXVzZXMgaGlnaCBjcHUgbG9hZCcpO1xuXHRcdGNvbnN0IG9zVmVyc2lvbiA9IGAke29zLnR5cGV9ICR7b3MuYXJjaH0gJHtvcy5yZWxlYXNlfWA7XG5cdFx0Y29uc3QgbWVzc2FnZSA9IGA6d2FybmluZzogTWFrZSBzdXJlIHRvICoqYXR0YWNoKiogdGhpcyBmaWxlIGZyb20geW91ciAqaG9tZSotZGlyZWN0b3J5Olxcbjp3YXJuaW5nOlxcYCR7cGF0aH1cXGBcXG5cXG5GaW5kIG1vcmUgZGV0YWlscyBoZXJlOiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS93aWtpL0V4cGxhaW4tZXh0ZW5zaW9uLWNhdXNlcy1oaWdoLWNwdS1sb2FkYDtcblx0XHRjb25zdCBib2R5ID0gZW5jb2RlVVJJQ29tcG9uZW50KGAtIElzc3VlIFR5cGU6IFxcYFBlcmZvcm1hbmNlXFxgXG4tIEV4dGVuc2lvbiBOYW1lOiBcXGAke3RoaXMuZXh0ZW5zaW9uLm5hbWV9XFxgXG4tIEV4dGVuc2lvbiBWZXJzaW9uOiBcXGAke3RoaXMuZXh0ZW5zaW9uLnZlcnNpb259XFxgXG4tIE9TIFZlcnNpb246IFxcYCR7b3NWZXJzaW9ufVxcYFxuLSBWUyBDb2RlIHZlcnNpb246IFxcYCR7dGhpcy5fcHJvZHVjdFNlcnZpY2UudmVyc2lvbn1cXGBcXG5cXG4ke21lc3NhZ2V9YCk7XG5cblx0XHRjb25zdCB1cmwgPSBgJHt0aGlzLnJlcG9JbmZvLmJhc2V9LyR7dGhpcy5yZXBvSW5mby5vd25lcn0vJHt0aGlzLnJlcG9JbmZvLnJlcG99L2lzc3Vlcy9uZXcvP2JvZHk9JHtib2R5fSZ0aXRsZT0ke3RpdGxlfWA7XG5cdFx0dGhpcy5fb3BlbmVyU2VydmljZS5vcGVuKFVSSS5wYXJzZSh1cmwpKTtcblxuXHRcdHRoaXMuX2RpYWxvZ1NlcnZpY2UuaW5mbyhcblx0XHRcdGxvY2FsaXplKCdhdHRhY2gudGl0bGUnLCBcIkRpZCB5b3UgYXR0YWNoIHRoZSBDUFUtUHJvZmlsZT9cIiksXG5cdFx0XHRsb2NhbGl6ZSgnYXR0YWNoLm1zZycsIFwiVGhpcyBpcyBhIHJlbWluZGVyIHRvIG1ha2Ugc3VyZSB0aGF0IHlvdSBoYXZlIG5vdCBmb3Jnb3R0ZW4gdG8gYXR0YWNoICd7MH0nIHRvIHRoZSBpc3N1ZSB5b3UgaGF2ZSBqdXN0IGNyZWF0ZWQuXCIsIHBhdGguZnNQYXRoKVxuXHRcdCk7XG5cdH1cbn1cblxuY2xhc3MgU2hvd0V4dGVuc2lvblNsb3dBY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdHJlYWRvbmx5IHJlcG9JbmZvOiBSZXBvSW5mbyxcblx0XHRyZWFkb25seSBwcm9maWxlOiBJRXh0ZW5zaW9uSG9zdFByb2ZpbGUsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2RpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9vcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASU5hdGl2ZVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lbnZpcm9ubWVudFNlcnZpY2U6IElOYXRpdmVXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXG5cdCkge1xuXHRcdHN1cGVyKCdzaG93LnNsb3cnLCBsb2NhbGl6ZSgnY21kLnNob3cnLCBcIlNob3cgSXNzdWVzXCIpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIHJld3JpdGUgcGlpIChwYXRocykgYW5kIHN0b3JlIG9uIGRpc2tcblx0XHRjb25zdCBkYXRhID0gVXRpbHMucmV3cml0ZUFic29sdXRlUGF0aHModGhpcy5wcm9maWxlLmRhdGEsICdwaWlfcmVtb3ZlZCcpO1xuXHRcdGNvbnN0IHBhdGggPSBqb2luUGF0aCh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UudG1wRGlyLCBgJHt0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlfS11bnJlc3BvbnNpdmUuY3B1cHJvZmlsZS50eHRgKTtcblx0XHRhd2FpdCB0aGlzLl9maWxlU2VydmljZS53cml0ZUZpbGUocGF0aCwgVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeShkYXRhLCB1bmRlZmluZWQsIDQpKSk7XG5cblx0XHQvLyBzaG93IGlzc3Vlc1xuXHRcdGNvbnN0IHVybCA9IGAke3RoaXMucmVwb0luZm8uYmFzZX0vJHt0aGlzLnJlcG9JbmZvLm93bmVyfS8ke3RoaXMucmVwb0luZm8ucmVwb30vaXNzdWVzP3V0Zjg9XHUyNzEzJnE9aXMlM0Fpc3N1ZStzdGF0ZSUzQW9wZW4rJTIyRXh0ZW5zaW9uK2NhdXNlcytoaWdoK2NwdStsb2FkJTIyYDtcblx0XHR0aGlzLl9vcGVuZXJTZXJ2aWNlLm9wZW4oVVJJLnBhcnNlKHVybCkpO1xuXG5cdFx0dGhpcy5fZGlhbG9nU2VydmljZS5pbmZvKFxuXHRcdFx0bG9jYWxpemUoJ2F0dGFjaC50aXRsZScsIFwiRGlkIHlvdSBhdHRhY2ggdGhlIENQVS1Qcm9maWxlP1wiKSxcblx0XHRcdGxvY2FsaXplKCdhdHRhY2gubXNnMicsIFwiVGhpcyBpcyBhIHJlbWluZGVyIHRvIG1ha2Ugc3VyZSB0aGF0IHlvdSBoYXZlIG5vdCBmb3Jnb3R0ZW4gdG8gYXR0YWNoICd7MH0nIHRvIGFuIGV4aXN0aW5nIHBlcmZvcm1hbmNlIGlzc3VlLlwiLCBwYXRoLmZzUGF0aClcblx0XHQp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
