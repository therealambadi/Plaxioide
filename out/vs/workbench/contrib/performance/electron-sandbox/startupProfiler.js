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
import { localize } from "../../../../nls.js";
import { dirname, basename } from "../../../../base/common/resources.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-sandbox/environmentService.js";
import { ILifecycleService, LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { PerfviewContrib } from "../browser/perfviewEditor.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { URI } from "../../../../base/common/uri.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
let StartupProfiler = class {
  constructor(_dialogService, _environmentService, _textModelResolverService, _clipboardService, lifecycleService, extensionService, _openerService, _nativeHostService, _productService, _fileService, _labelService) {
    this._dialogService = _dialogService;
    this._environmentService = _environmentService;
    this._textModelResolverService = _textModelResolverService;
    this._clipboardService = _clipboardService;
    this._openerService = _openerService;
    this._nativeHostService = _nativeHostService;
    this._productService = _productService;
    this._fileService = _fileService;
    this._labelService = _labelService;
    Promise.all([
      lifecycleService.when(LifecyclePhase.Eventually),
      extensionService.whenInstalledExtensionsRegistered()
    ]).then(() => {
      this._stopProfiling();
    });
  }
  _stopProfiling() {
    if (!this._environmentService.args["prof-startup-prefix"]) {
      return;
    }
    const profileFilenamePrefix = URI.file(this._environmentService.args["prof-startup-prefix"]);
    const dir = dirname(profileFilenamePrefix);
    const prefix = basename(profileFilenamePrefix);
    const removeArgs = ["--prof-startup"];
    const markerFile = this._fileService.readFile(profileFilenamePrefix).then((value) => removeArgs.push(...value.toString().split("|"))).then(() => this._fileService.del(profileFilenamePrefix, { recursive: true })).then(() => new Promise((resolve) => {
      const check = () => {
        this._fileService.exists(profileFilenamePrefix).then((exists) => {
          if (exists) {
            resolve();
          } else {
            setTimeout(check, 500);
          }
        });
      };
      check();
    })).then(() => this._fileService.del(profileFilenamePrefix, { recursive: true }));
    markerFile.then(() => {
      return this._fileService.resolve(dir).then((stat) => {
        return (stat.children ? stat.children.filter((value) => value.resource.path.includes(prefix)) : []).map((stat2) => stat2.resource);
      });
    }).then((files) => {
      const profileFiles = files.reduce((prev, cur) => `${prev}${this._labelService.getUriLabel(cur)}
`, "\n");
      return this._dialogService.confirm({
        type: "info",
        message: localize("prof.message", "Successfully created profiles."),
        detail: localize("prof.detail", "Please create an issue and manually attach the following files:\n{0}", profileFiles),
        primaryButton: localize({ key: "prof.restartAndFileIssue", comment: ["&& denotes a mnemonic"] }, "&&Create Issue and Restart"),
        cancelButton: localize("prof.restart", "Restart")
      }).then((res) => {
        if (res.confirmed) {
          Promise.all([
            this._nativeHostService.showItemInFolder(files[0].fsPath),
            this._createPerfIssue(files.map((file) => basename(file)))
          ]).then(() => {
            return this._dialogService.confirm({
              type: "info",
              message: localize("prof.thanks", "Thanks for helping us."),
              detail: localize("prof.detail.restart", "A final restart is required to continue to use '{0}'. Again, thank you for your contribution.", this._productService.nameLong),
              primaryButton: localize({ key: "prof.restart.button", comment: ["&& denotes a mnemonic"] }, "&&Restart")
            }).then((res2) => {
              if (res2.confirmed) {
                this._nativeHostService.relaunch({ removeArgs });
              }
            });
          });
        } else {
          this._nativeHostService.relaunch({ removeArgs });
        }
      });
    });
  }
  async _createPerfIssue(files) {
    const reportIssueUrl = this._productService.reportIssueUrl;
    if (!reportIssueUrl) {
      return;
    }
    const contrib = PerfviewContrib.get();
    const ref = await this._textModelResolverService.createModelReference(contrib.getInputUri());
    try {
      await this._clipboardService.writeText(ref.object.textEditorModel.getValue());
    } finally {
      ref.dispose();
    }
    const body = `
1. :warning: We have copied additional data to your clipboard. Make sure to **paste** here. :warning:
1. :warning: Make sure to **attach** these files from your *home*-directory: :warning:
${files.map((file) => `-\`${file}\``).join("\n")}
`;
    const baseUrl = reportIssueUrl;
    const queryStringPrefix = baseUrl.indexOf("?") === -1 ? "?" : "&";
    this._openerService.open(URI.parse(`${baseUrl}${queryStringPrefix}body=${encodeURIComponent(body)}`));
  }
};
StartupProfiler = __decorateClass([
  __decorateParam(0, IDialogService),
  __decorateParam(1, INativeWorkbenchEnvironmentService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, IClipboardService),
  __decorateParam(4, ILifecycleService),
  __decorateParam(5, IExtensionService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, INativeHostService),
  __decorateParam(8, IProductService),
  __decorateParam(9, IFileService),
  __decorateParam(10, ILabelService)
], StartupProfiler);
export {
  StartupProfiler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wZXJmb3JtYW5jZS9lbGVjdHJvbi1zYW5kYm94L3N0YXJ0dXBQcm9maWxlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBkaXJuYW1lLCBiYXNlbmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvZWxlY3Ryb24tc2FuZGJveC9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UsIExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUGVyZnZpZXdDb250cmliIH0gZnJvbSAnLi4vYnJvd3Nlci9wZXJmdmlld0VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbmF0aXZlL2NvbW1vbi9uYXRpdmUuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuXG5leHBvcnQgY2xhc3MgU3RhcnR1cFByb2ZpbGVyIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2RpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJTmF0aXZlV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2Vudmlyb25tZW50U2VydmljZTogSU5hdGl2ZVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASUNsaXBib2FyZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElOYXRpdmVIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9uYXRpdmVIb3N0U2VydmljZTogSU5hdGl2ZUhvc3RTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2ZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHQpIHtcblx0XHQvLyB3YWl0IGZvciBldmVyeXRoaW5nIHRvIGJlIHJlYWR5XG5cdFx0UHJvbWlzZS5hbGwoW1xuXHRcdFx0bGlmZWN5Y2xlU2VydmljZS53aGVuKExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpLFxuXHRcdFx0ZXh0ZW5zaW9uU2VydmljZS53aGVuSW5zdGFsbGVkRXh0ZW5zaW9uc1JlZ2lzdGVyZWQoKVxuXHRcdF0pLnRoZW4oKCkgPT4ge1xuXHRcdFx0dGhpcy5fc3RvcFByb2ZpbGluZygpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3RvcFByb2ZpbGluZygpOiB2b2lkIHtcblxuXHRcdGlmICghdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmFyZ3NbJ3Byb2Ytc3RhcnR1cC1wcmVmaXgnXSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBwcm9maWxlRmlsZW5hbWVQcmVmaXggPSBVUkkuZmlsZSh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuYXJnc1sncHJvZi1zdGFydHVwLXByZWZpeCddKTtcblxuXHRcdGNvbnN0IGRpciA9IGRpcm5hbWUocHJvZmlsZUZpbGVuYW1lUHJlZml4KTtcblx0XHRjb25zdCBwcmVmaXggPSBiYXNlbmFtZShwcm9maWxlRmlsZW5hbWVQcmVmaXgpO1xuXG5cdFx0Y29uc3QgcmVtb3ZlQXJnczogc3RyaW5nW10gPSBbJy0tcHJvZi1zdGFydHVwJ107XG5cdFx0Y29uc3QgbWFya2VyRmlsZSA9IHRoaXMuX2ZpbGVTZXJ2aWNlLnJlYWRGaWxlKHByb2ZpbGVGaWxlbmFtZVByZWZpeCkudGhlbih2YWx1ZSA9PiByZW1vdmVBcmdzLnB1c2goLi4udmFsdWUudG9TdHJpbmcoKS5zcGxpdCgnfCcpKSlcblx0XHRcdC50aGVuKCgpID0+IHRoaXMuX2ZpbGVTZXJ2aWNlLmRlbChwcm9maWxlRmlsZW5hbWVQcmVmaXgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pKSAvLyAoMSkgZGVsZXRlIHRoZSBmaWxlIHRvIHRlbGwgdGhlIG1haW4gcHJvY2VzcyB0byBzdG9wIHByb2ZpbGluZ1xuXHRcdFx0LnRoZW4oKCkgPT4gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7IC8vICgyKSB3YWl0IGZvciBtYWluIHRoYXQgcmVjcmVhdGVzIHRoZSBmYWlsIHRvIHNpZ25hbCBwcm9maWxpbmcgaGFzIHN0b3BwZWRcblx0XHRcdFx0Y29uc3QgY2hlY2sgPSAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fZmlsZVNlcnZpY2UuZXhpc3RzKHByb2ZpbGVGaWxlbmFtZVByZWZpeCkudGhlbihleGlzdHMgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGV4aXN0cykge1xuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRzZXRUaW1lb3V0KGNoZWNrLCA1MDApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHRjaGVjaygpO1xuXHRcdFx0fSkpXG5cdFx0XHQudGhlbigoKSA9PiB0aGlzLl9maWxlU2VydmljZS5kZWwocHJvZmlsZUZpbGVuYW1lUHJlZml4LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KSk7IC8vICgzKSBmaW5hbGx5IGRlbGV0ZSB0aGUgZmlsZSBhZ2FpblxuXG5cdFx0bWFya2VyRmlsZS50aGVuKCgpID0+IHtcblx0XHRcdHJldHVybiB0aGlzLl9maWxlU2VydmljZS5yZXNvbHZlKGRpcikudGhlbihzdGF0ID0+IHtcblx0XHRcdFx0cmV0dXJuIChzdGF0LmNoaWxkcmVuID8gc3RhdC5jaGlsZHJlbi5maWx0ZXIodmFsdWUgPT4gdmFsdWUucmVzb3VyY2UucGF0aC5pbmNsdWRlcyhwcmVmaXgpKSA6IFtdKS5tYXAoc3RhdCA9PiBzdGF0LnJlc291cmNlKTtcblx0XHRcdH0pO1xuXHRcdH0pLnRoZW4oZmlsZXMgPT4ge1xuXHRcdFx0Y29uc3QgcHJvZmlsZUZpbGVzID0gZmlsZXMucmVkdWNlKChwcmV2LCBjdXIpID0+IGAke3ByZXZ9JHt0aGlzLl9sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoY3VyKX1cXG5gLCAnXFxuJyk7XG5cblx0XHRcdHJldHVybiB0aGlzLl9kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHR0eXBlOiAnaW5mbycsXG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdwcm9mLm1lc3NhZ2UnLCBcIlN1Y2Nlc3NmdWxseSBjcmVhdGVkIHByb2ZpbGVzLlwiKSxcblx0XHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgncHJvZi5kZXRhaWwnLCBcIlBsZWFzZSBjcmVhdGUgYW4gaXNzdWUgYW5kIG1hbnVhbGx5IGF0dGFjaCB0aGUgZm9sbG93aW5nIGZpbGVzOlxcbnswfVwiLCBwcm9maWxlRmlsZXMpLFxuXHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSh7IGtleTogJ3Byb2YucmVzdGFydEFuZEZpbGVJc3N1ZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkNyZWF0ZSBJc3N1ZSBhbmQgUmVzdGFydFwiKSxcblx0XHRcdFx0Y2FuY2VsQnV0dG9uOiBsb2NhbGl6ZSgncHJvZi5yZXN0YXJ0JywgXCJSZXN0YXJ0XCIpXG5cdFx0XHR9KS50aGVuKHJlcyA9PiB7XG5cdFx0XHRcdGlmIChyZXMuY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0UHJvbWlzZS5hbGw8YW55PihbXG5cdFx0XHRcdFx0XHR0aGlzLl9uYXRpdmVIb3N0U2VydmljZS5zaG93SXRlbUluRm9sZGVyKGZpbGVzWzBdLmZzUGF0aCksXG5cdFx0XHRcdFx0XHR0aGlzLl9jcmVhdGVQZXJmSXNzdWUoZmlsZXMubWFwKGZpbGUgPT4gYmFzZW5hbWUoZmlsZSkpKVxuXHRcdFx0XHRcdF0pLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdFx0Ly8ga2VlcCB3aW5kb3cgc3RhYmxlIHVudGlsIHJlc3RhcnQgaXMgc2VsZWN0ZWRcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLl9kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnaW5mbycsXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdwcm9mLnRoYW5rcycsIFwiVGhhbmtzIGZvciBoZWxwaW5nIHVzLlwiKSxcblx0XHRcdFx0XHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgncHJvZi5kZXRhaWwucmVzdGFydCcsIFwiQSBmaW5hbCByZXN0YXJ0IGlzIHJlcXVpcmVkIHRvIGNvbnRpbnVlIHRvIHVzZSAnezB9Jy4gQWdhaW4sIHRoYW5rIHlvdSBmb3IgeW91ciBjb250cmlidXRpb24uXCIsIHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLm5hbWVMb25nKSxcblx0XHRcdFx0XHRcdFx0cHJpbWFyeUJ1dHRvbjogbG9jYWxpemUoeyBrZXk6ICdwcm9mLnJlc3RhcnQuYnV0dG9uJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUmVzdGFydFwiKVxuXHRcdFx0XHRcdFx0fSkudGhlbihyZXMgPT4ge1xuXHRcdFx0XHRcdFx0XHQvLyBub3cgd2UgYXJlIHJlYWR5IHRvIHJlc3RhcnRcblx0XHRcdFx0XHRcdFx0aWYgKHJlcy5jb25maXJtZWQpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLl9uYXRpdmVIb3N0U2VydmljZS5yZWxhdW5jaCh7IHJlbW92ZUFyZ3MgfSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gc2ltcGx5IHJlc3RhcnRcblx0XHRcdFx0XHR0aGlzLl9uYXRpdmVIb3N0U2VydmljZS5yZWxhdW5jaCh7IHJlbW92ZUFyZ3MgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfY3JlYXRlUGVyZklzc3VlKGZpbGVzOiBzdHJpbmdbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJlcG9ydElzc3VlVXJsID0gdGhpcy5fcHJvZHVjdFNlcnZpY2UucmVwb3J0SXNzdWVVcmw7XG5cdFx0aWYgKCFyZXBvcnRJc3N1ZVVybCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRyaWIgPSBQZXJmdmlld0NvbnRyaWIuZ2V0KCk7XG5cdFx0Y29uc3QgcmVmID0gYXdhaXQgdGhpcy5fdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKGNvbnRyaWIuZ2V0SW5wdXRVcmkoKSk7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuX2NsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsLmdldFZhbHVlKCkpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGJvZHkgPSBgXG4xLiA6d2FybmluZzogV2UgaGF2ZSBjb3BpZWQgYWRkaXRpb25hbCBkYXRhIHRvIHlvdXIgY2xpcGJvYXJkLiBNYWtlIHN1cmUgdG8gKipwYXN0ZSoqIGhlcmUuIDp3YXJuaW5nOlxuMS4gOndhcm5pbmc6IE1ha2Ugc3VyZSB0byAqKmF0dGFjaCoqIHRoZXNlIGZpbGVzIGZyb20geW91ciAqaG9tZSotZGlyZWN0b3J5OiA6d2FybmluZzpcXG4ke2ZpbGVzLm1hcChmaWxlID0+IGAtXFxgJHtmaWxlfVxcYGApLmpvaW4oJ1xcbicpfVxuYDtcblxuXHRcdGNvbnN0IGJhc2VVcmwgPSByZXBvcnRJc3N1ZVVybDtcblx0XHRjb25zdCBxdWVyeVN0cmluZ1ByZWZpeCA9IGJhc2VVcmwuaW5kZXhPZignPycpID09PSAtMSA/ICc/JyA6ICcmJztcblxuXHRcdHRoaXMuX29wZW5lclNlcnZpY2Uub3BlbihVUkkucGFyc2UoYCR7YmFzZVVybH0ke3F1ZXJ5U3RyaW5nUHJlZml4fWJvZHk9JHtlbmNvZGVVUklDb21wb25lbnQoYm9keSl9YCkpO1xuXHR9XG59XG4iXSwKICAi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
