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
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ITelemetryService, TelemetryLevel } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { IWorkspaceTagsService, getHashedRemotesFromConfig as baseGetHashedRemotesFromConfig } from "../common/workspaceTags.js";
import { IDiagnosticsService } from "../../../../platform/diagnostics/common/diagnostics.js";
import { IRequestService } from "../../../../platform/request/common/request.js";
import { isWindows } from "../../../../base/common/platform.js";
import { AllowedSecondLevelDomains, getDomainsOfRemotes } from "../../../../platform/extensionManagement/common/configRemotes.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { hashAsync } from "../../../../base/common/hash.js";
async function getHashedRemotesFromConfig(text, stripEndingDotGit = false) {
  return baseGetHashedRemotesFromConfig(text, stripEndingDotGit, hashAsync);
}
let WorkspaceTags = class {
  constructor(fileService, contextService, telemetryService, requestService, textFileService, workspaceTagsService, diagnosticsService, productService, nativeHostService) {
    this.fileService = fileService;
    this.contextService = contextService;
    this.telemetryService = telemetryService;
    this.requestService = requestService;
    this.textFileService = textFileService;
    this.workspaceTagsService = workspaceTagsService;
    this.diagnosticsService = diagnosticsService;
    this.productService = productService;
    this.nativeHostService = nativeHostService;
    if (this.telemetryService.telemetryLevel === TelemetryLevel.USAGE) {
      this.report();
    }
  }
  async report() {
    this.reportWindowsEdition();
    this.workspaceTagsService.getTags().then((tags) => this.reportWorkspaceTags(tags), (error) => onUnexpectedError(error));
    this.reportCloudStats();
    this.reportProxyStats();
    this.getWorkspaceInformation().then((stats) => this.diagnosticsService.reportWorkspaceStats(stats));
  }
  async reportWindowsEdition() {
    if (!isWindows) {
      return;
    }
    let value = await this.nativeHostService.windowsGetStringRegKey("HKEY_LOCAL_MACHINE", "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion", "EditionID");
    if (value === void 0) {
      value = "Unknown";
    }
    this.telemetryService.publicLog2("windowsEdition", { edition: value });
  }
  async getWorkspaceInformation() {
    const workspace = this.contextService.getWorkspace();
    const state = this.contextService.getWorkbenchState();
    const telemetryId = await this.workspaceTagsService.getTelemetryWorkspaceId(workspace, state);
    return {
      id: workspace.id,
      telemetryId,
      rendererSessionId: this.telemetryService.sessionId,
      folders: workspace.folders,
      transient: workspace.transient,
      configuration: workspace.configuration
    };
  }
  reportWorkspaceTags(tags) {
    this.telemetryService.publicLog("workspce.tags", tags);
  }
  reportRemoteDomains(workspaceUris) {
    Promise.all(workspaceUris.map((workspaceUri) => {
      const path = workspaceUri.path;
      const uri = workspaceUri.with({ path: `${path !== "/" ? path : ""}/.git/config` });
      return this.fileService.exists(uri).then((exists) => {
        if (!exists) {
          return [];
        }
        return this.textFileService.read(uri, { acceptTextOnly: true }).then(
          (content) => getDomainsOfRemotes(content.value, AllowedSecondLevelDomains),
          (err) => []
          // ignore missing or binary file
        );
      });
    })).then((domains) => {
      const set = domains.reduce((set2, list2) => list2.reduce((set3, item) => set3.add(item), set2), /* @__PURE__ */ new Set());
      const list = [];
      set.forEach((item) => list.push(item));
      this.telemetryService.publicLog("workspace.remotes", { domains: list.sort() });
    }, onUnexpectedError);
  }
  reportRemotes(workspaceUris) {
    Promise.all(workspaceUris.map((workspaceUri) => {
      return this.workspaceTagsService.getHashedRemotesFromUri(workspaceUri, true);
    })).then(() => {
    }, onUnexpectedError);
  }
  /* __GDPR__FRAGMENT__
  	"AzureTags" : {
  		"node" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
  	}
  */
  reportAzureNode(workspaceUris, tags) {
    const uris = workspaceUris.map((workspaceUri) => {
      const path = workspaceUri.path;
      return workspaceUri.with({ path: `${path !== "/" ? path : ""}/node_modules` });
    });
    return this.fileService.resolveAll(uris.map((resource) => ({ resource }))).then(
      (results) => {
        const names = [].concat(...results.map((result) => result.success ? result.stat.children || [] : [])).map((c) => c.name);
        const referencesAzure = WorkspaceTags.searchArray(names, /azure/i);
        if (referencesAzure) {
          tags["node"] = true;
        }
        return tags;
      },
      (err) => {
        return tags;
      }
    );
  }
  static searchArray(arr, regEx) {
    return arr.some((v) => v.search(regEx) > -1) || void 0;
  }
  /* __GDPR__FRAGMENT__
  	"AzureTags" : {
  		"java" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
  	}
  */
  reportAzureJava(workspaceUris, tags) {
    return Promise.all(workspaceUris.map((workspaceUri) => {
      const path = workspaceUri.path;
      const uri = workspaceUri.with({ path: `${path !== "/" ? path : ""}/pom.xml` });
      return this.fileService.exists(uri).then((exists) => {
        if (!exists) {
          return false;
        }
        return this.textFileService.read(uri, { acceptTextOnly: true }).then(
          (content) => !!content.value.match(/azure/i),
          (err) => false
        );
      });
    })).then((javas) => {
      if (javas.indexOf(true) !== -1) {
        tags["java"] = true;
      }
      return tags;
    });
  }
  reportAzure(uris) {
    const tags = /* @__PURE__ */ Object.create(null);
    this.reportAzureNode(uris, tags).then((tags2) => {
      return this.reportAzureJava(uris, tags2);
    }).then((tags2) => {
      if (Object.keys(tags2).length) {
        this.telemetryService.publicLog("workspace.azure", tags2);
      }
    }).then(void 0, onUnexpectedError);
  }
  reportCloudStats() {
    const uris = this.contextService.getWorkspace().folders.map((folder) => folder.uri);
    if (uris.length && this.fileService) {
      this.reportRemoteDomains(uris);
      this.reportRemotes(uris);
      this.reportAzure(uris);
    }
  }
  reportProxyStats() {
    const downloadUrl = this.productService.downloadUrl;
    if (!downloadUrl) {
      return;
    }
    this.requestService.resolveProxy(downloadUrl).then((proxy) => {
      let type = proxy ? String(proxy).trim().split(/\s+/, 1)[0] : "EMPTY";
      if (["DIRECT", "PROXY", "HTTPS", "SOCKS", "EMPTY"].indexOf(type) === -1) {
        type = "UNKNOWN";
      }
    }).then(void 0, onUnexpectedError);
  }
};
WorkspaceTags = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IRequestService),
  __decorateParam(4, ITextFileService),
  __decorateParam(5, IWorkspaceTagsService),
  __decorateParam(6, IDiagnosticsService),
  __decorateParam(7, IProductService),
  __decorateParam(8, INativeHostService)
], WorkspaceTags);
export {
  WorkspaceTags,
  getHashedRemotesFromConfig
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YWdzL2VsZWN0cm9uLXNhbmRib3gvd29ya3NwYWNlVGFncy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UsIElGaWxlU3RhdCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSwgVGVsZW1ldHJ5TGV2ZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSVRleHRGaWxlU2VydmljZSwgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUYWdzU2VydmljZSwgVGFncywgZ2V0SGFzaGVkUmVtb3Rlc0Zyb21Db25maWcgYXMgYmFzZUdldEhhc2hlZFJlbW90ZXNGcm9tQ29uZmlnIH0gZnJvbSAnLi4vY29tbW9uL3dvcmtzcGFjZVRhZ3MuanMnO1xuaW1wb3J0IHsgSURpYWdub3N0aWNzU2VydmljZSwgSVdvcmtzcGFjZUluZm9ybWF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhZ25vc3RpY3MvY29tbW9uL2RpYWdub3N0aWNzLmpzJztcbmltcG9ydCB7IElSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgQWxsb3dlZFNlY29uZExldmVsRG9tYWlucywgZ2V0RG9tYWluc09mUmVtb3RlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2NvbmZpZ1JlbW90ZXMuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbmF0aXZlL2NvbW1vbi9uYXRpdmUuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaGFzaEFzeW5jIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRIYXNoZWRSZW1vdGVzRnJvbUNvbmZpZyh0ZXh0OiBzdHJpbmcsIHN0cmlwRW5kaW5nRG90R2l0OiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG5cdHJldHVybiBiYXNlR2V0SGFzaGVkUmVtb3Rlc0Zyb21Db25maWcodGV4dCwgc3RyaXBFbmRpbmdEb3RHaXQsIGhhc2hBc3luYyk7XG59XG5cbmV4cG9ydCBjbGFzcyBXb3Jrc3BhY2VUYWdzIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElSZXF1ZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlcXVlc3RTZXJ2aWNlOiBJUmVxdWVzdFNlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUYWdzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVRhZ3NTZXJ2aWNlOiBJV29ya3NwYWNlVGFnc1NlcnZpY2UsXG5cdFx0QElEaWFnbm9zdGljc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFnbm9zdGljc1NlcnZpY2U6IElEaWFnbm9zdGljc1NlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElOYXRpdmVIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5hdGl2ZUhvc3RTZXJ2aWNlOiBJTmF0aXZlSG9zdFNlcnZpY2Vcblx0KSB7XG5cdFx0aWYgKHRoaXMudGVsZW1ldHJ5U2VydmljZS50ZWxlbWV0cnlMZXZlbCA9PT0gVGVsZW1ldHJ5TGV2ZWwuVVNBR0UpIHtcblx0XHRcdHRoaXMucmVwb3J0KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXBvcnQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gV2luZG93cy1vbmx5IEVkaXRpb24gRXZlbnRcblx0XHR0aGlzLnJlcG9ydFdpbmRvd3NFZGl0aW9uKCk7XG5cblx0XHQvLyBXb3Jrc3BhY2UgVGFnc1xuXHRcdHRoaXMud29ya3NwYWNlVGFnc1NlcnZpY2UuZ2V0VGFncygpXG5cdFx0XHQudGhlbih0YWdzID0+IHRoaXMucmVwb3J0V29ya3NwYWNlVGFncyh0YWdzKSwgZXJyb3IgPT4gb25VbmV4cGVjdGVkRXJyb3IoZXJyb3IpKTtcblxuXHRcdC8vIENsb3VkIFN0YXRzXG5cdFx0dGhpcy5yZXBvcnRDbG91ZFN0YXRzKCk7XG5cblx0XHR0aGlzLnJlcG9ydFByb3h5U3RhdHMoKTtcblxuXHRcdHRoaXMuZ2V0V29ya3NwYWNlSW5mb3JtYXRpb24oKS50aGVuKHN0YXRzID0+IHRoaXMuZGlhZ25vc3RpY3NTZXJ2aWNlLnJlcG9ydFdvcmtzcGFjZVN0YXRzKHN0YXRzKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlcG9ydFdpbmRvd3NFZGl0aW9uKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IHZhbHVlID0gYXdhaXQgdGhpcy5uYXRpdmVIb3N0U2VydmljZS53aW5kb3dzR2V0U3RyaW5nUmVnS2V5KCdIS0VZX0xPQ0FMX01BQ0hJTkUnLCAnU09GVFdBUkVcXFxcTWljcm9zb2Z0XFxcXFdpbmRvd3MgTlRcXFxcQ3VycmVudFZlcnNpb24nLCAnRWRpdGlvbklEJyk7XG5cdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHZhbHVlID0gJ1Vua25vd24nO1xuXHRcdH1cblxuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPHsgZWRpdGlvbjogc3RyaW5nIH0sIHsgb3duZXI6ICdzYmF0dGVuJzsgY29tbWVudDogJ0luZm9ybWF0aW9uIGFib3V0IHRoZSBXaW5kb3dzIGVkaXRpb24uJzsgZWRpdGlvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0J1c2luZXNzSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgV2luZG93cyBlZGl0aW9uLicgfSB9Pignd2luZG93c0VkaXRpb24nLCB7IGVkaXRpb246IHZhbHVlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRXb3Jrc3BhY2VJbmZvcm1hdGlvbigpOiBQcm9taXNlPElXb3Jrc3BhY2VJbmZvcm1hdGlvbj4ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCk7XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCk7XG5cdFx0Y29uc3QgdGVsZW1ldHJ5SWQgPSBhd2FpdCB0aGlzLndvcmtzcGFjZVRhZ3NTZXJ2aWNlLmdldFRlbGVtZXRyeVdvcmtzcGFjZUlkKHdvcmtzcGFjZSwgc3RhdGUpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkOiB3b3Jrc3BhY2UuaWQsXG5cdFx0XHR0ZWxlbWV0cnlJZCxcblx0XHRcdHJlbmRlcmVyU2Vzc2lvbklkOiB0aGlzLnRlbGVtZXRyeVNlcnZpY2Uuc2Vzc2lvbklkLFxuXHRcdFx0Zm9sZGVyczogd29ya3NwYWNlLmZvbGRlcnMsXG5cdFx0XHR0cmFuc2llbnQ6IHdvcmtzcGFjZS50cmFuc2llbnQsXG5cdFx0XHRjb25maWd1cmF0aW9uOiB3b3Jrc3BhY2UuY29uZmlndXJhdGlvblxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHJlcG9ydFdvcmtzcGFjZVRhZ3ModGFnczogVGFncyk6IHZvaWQge1xuXHRcdC8qIF9fR0RQUl9fXG5cdFx0XHRcIndvcmtzcGNlLnRhZ3NcIiA6IHtcblx0XHRcdFx0XCJvd25lclwiOiBcImxyYW1vczE1XCIsXG5cdFx0XHRcdFwiJHtpbmNsdWRlfVwiOiBbXG5cdFx0XHRcdFx0XCIke1dvcmtzcGFjZVRhZ3N9XCJcblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdCovXG5cdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZygnd29ya3NwY2UudGFncycsIHRhZ3MpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXBvcnRSZW1vdGVEb21haW5zKHdvcmtzcGFjZVVyaXM6IFVSSVtdKTogdm9pZCB7XG5cdFx0UHJvbWlzZS5hbGw8c3RyaW5nW10+KHdvcmtzcGFjZVVyaXMubWFwKHdvcmtzcGFjZVVyaSA9PiB7XG5cdFx0XHRjb25zdCBwYXRoID0gd29ya3NwYWNlVXJpLnBhdGg7XG5cdFx0XHRjb25zdCB1cmkgPSB3b3Jrc3BhY2VVcmkud2l0aCh7IHBhdGg6IGAke3BhdGggIT09ICcvJyA/IHBhdGggOiAnJ30vLmdpdC9jb25maWdgIH0pO1xuXHRcdFx0cmV0dXJuIHRoaXMuZmlsZVNlcnZpY2UuZXhpc3RzKHVyaSkudGhlbihleGlzdHMgPT4ge1xuXHRcdFx0XHRpZiAoIWV4aXN0cykge1xuXHRcdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy50ZXh0RmlsZVNlcnZpY2UucmVhZCh1cmksIHsgYWNjZXB0VGV4dE9ubHk6IHRydWUgfSkudGhlbihcblx0XHRcdFx0XHRjb250ZW50ID0+IGdldERvbWFpbnNPZlJlbW90ZXMoY29udGVudC52YWx1ZSwgQWxsb3dlZFNlY29uZExldmVsRG9tYWlucyksXG5cdFx0XHRcdFx0ZXJyID0+IFtdIC8vIGlnbm9yZSBtaXNzaW5nIG9yIGJpbmFyeSBmaWxlXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHR9KSkudGhlbihkb21haW5zID0+IHtcblx0XHRcdGNvbnN0IHNldCA9IGRvbWFpbnMucmVkdWNlKChzZXQsIGxpc3QpID0+IGxpc3QucmVkdWNlKChzZXQsIGl0ZW0pID0+IHNldC5hZGQoaXRlbSksIHNldCksIG5ldyBTZXQ8c3RyaW5nPigpKTtcblx0XHRcdGNvbnN0IGxpc3Q6IHN0cmluZ1tdID0gW107XG5cdFx0XHRzZXQuZm9yRWFjaChpdGVtID0+IGxpc3QucHVzaChpdGVtKSk7XG5cdFx0XHQvKiBfX0dEUFJfX1xuXHRcdFx0XHRcIndvcmtzcGFjZS5yZW1vdGVzXCIgOiB7XG5cdFx0XHRcdFx0XCJvd25lclwiOiBcImxyYW1vczE1XCIsXG5cdFx0XHRcdFx0XCJkb21haW5zXCIgOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJTeXN0ZW1NZXRhRGF0YVwiLCBcInB1cnBvc2VcIjogXCJGZWF0dXJlSW5zaWdodFwiIH1cblx0XHRcdFx0fVxuXHRcdFx0Ki9cblx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2coJ3dvcmtzcGFjZS5yZW1vdGVzJywgeyBkb21haW5zOiBsaXN0LnNvcnQoKSB9KTtcblx0XHR9LCBvblVuZXhwZWN0ZWRFcnJvcik7XG5cdH1cblxuXHRwcml2YXRlIHJlcG9ydFJlbW90ZXMod29ya3NwYWNlVXJpczogVVJJW10pOiB2b2lkIHtcblx0XHRQcm9taXNlLmFsbDxzdHJpbmdbXT4od29ya3NwYWNlVXJpcy5tYXAod29ya3NwYWNlVXJpID0+IHtcblx0XHRcdHJldHVybiB0aGlzLndvcmtzcGFjZVRhZ3NTZXJ2aWNlLmdldEhhc2hlZFJlbW90ZXNGcm9tVXJpKHdvcmtzcGFjZVVyaSwgdHJ1ZSk7XG5cdFx0fSkpLnRoZW4oKCkgPT4geyB9LCBvblVuZXhwZWN0ZWRFcnJvcik7XG5cdH1cblxuXHQvKiBfX0dEUFJfX0ZSQUdNRU5UX19cblx0XHRcIkF6dXJlVGFnc1wiIDoge1xuXHRcdFx0XCJub2RlXCIgOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJTeXN0ZW1NZXRhRGF0YVwiLCBcInB1cnBvc2VcIjogXCJGZWF0dXJlSW5zaWdodFwiLCBcImlzTWVhc3VyZW1lbnRcIjogdHJ1ZSB9XG5cdFx0fVxuXHQqL1xuXHRwcml2YXRlIHJlcG9ydEF6dXJlTm9kZSh3b3Jrc3BhY2VVcmlzOiBVUklbXSwgdGFnczogVGFncyk6IFByb21pc2U8VGFncz4ge1xuXHRcdC8vIFRPRE86IHNob3VsZCBhbHNvIHdvcmsgZm9yIGBub2RlX21vZHVsZXNgIGZvbGRlcnMgc2V2ZXJhbCBsZXZlbHMgZG93blxuXHRcdGNvbnN0IHVyaXMgPSB3b3Jrc3BhY2VVcmlzLm1hcCh3b3Jrc3BhY2VVcmkgPT4ge1xuXHRcdFx0Y29uc3QgcGF0aCA9IHdvcmtzcGFjZVVyaS5wYXRoO1xuXHRcdFx0cmV0dXJuIHdvcmtzcGFjZVVyaS53aXRoKHsgcGF0aDogYCR7cGF0aCAhPT0gJy8nID8gcGF0aCA6ICcnfS9ub2RlX21vZHVsZXNgIH0pO1xuXHRcdH0pO1xuXHRcdHJldHVybiB0aGlzLmZpbGVTZXJ2aWNlLnJlc29sdmVBbGwodXJpcy5tYXAocmVzb3VyY2UgPT4gKHsgcmVzb3VyY2UgfSkpKS50aGVuKFxuXHRcdFx0cmVzdWx0cyA9PiB7XG5cdFx0XHRcdGNvbnN0IG5hbWVzID0gKDxJRmlsZVN0YXRbXT5bXSkuY29uY2F0KC4uLnJlc3VsdHMubWFwKHJlc3VsdCA9PiByZXN1bHQuc3VjY2VzcyA/IChyZXN1bHQuc3RhdCEuY2hpbGRyZW4gfHwgW10pIDogW10pKS5tYXAoYyA9PiBjLm5hbWUpO1xuXHRcdFx0XHRjb25zdCByZWZlcmVuY2VzQXp1cmUgPSBXb3Jrc3BhY2VUYWdzLnNlYXJjaEFycmF5KG5hbWVzLCAvYXp1cmUvaSk7XG5cdFx0XHRcdGlmIChyZWZlcmVuY2VzQXp1cmUpIHtcblx0XHRcdFx0XHR0YWdzWydub2RlJ10gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0YWdzO1xuXHRcdFx0fSxcblx0XHRcdGVyciA9PiB7XG5cdFx0XHRcdHJldHVybiB0YWdzO1xuXHRcdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBzZWFyY2hBcnJheShhcnI6IHN0cmluZ1tdLCByZWdFeDogUmVnRXhwKTogYm9vbGVhbiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIGFyci5zb21lKHYgPT4gdi5zZWFyY2gocmVnRXgpID4gLTEpIHx8IHVuZGVmaW5lZDtcblx0fVxuXG5cdC8qIF9fR0RQUl9fRlJBR01FTlRfX1xuXHRcdFwiQXp1cmVUYWdzXCIgOiB7XG5cdFx0XHRcImphdmFcIiA6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIkZlYXR1cmVJbnNpZ2h0XCIsIFwiaXNNZWFzdXJlbWVudFwiOiB0cnVlIH1cblx0XHR9XG5cdCovXG5cdHByaXZhdGUgcmVwb3J0QXp1cmVKYXZhKHdvcmtzcGFjZVVyaXM6IFVSSVtdLCB0YWdzOiBUYWdzKTogUHJvbWlzZTxUYWdzPiB7XG5cdFx0cmV0dXJuIFByb21pc2UuYWxsKHdvcmtzcGFjZVVyaXMubWFwKHdvcmtzcGFjZVVyaSA9PiB7XG5cdFx0XHRjb25zdCBwYXRoID0gd29ya3NwYWNlVXJpLnBhdGg7XG5cdFx0XHRjb25zdCB1cmkgPSB3b3Jrc3BhY2VVcmkud2l0aCh7IHBhdGg6IGAke3BhdGggIT09ICcvJyA/IHBhdGggOiAnJ30vcG9tLnhtbGAgfSk7XG5cdFx0XHRyZXR1cm4gdGhpcy5maWxlU2VydmljZS5leGlzdHModXJpKS50aGVuKGV4aXN0cyA9PiB7XG5cdFx0XHRcdGlmICghZXhpc3RzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLnRleHRGaWxlU2VydmljZS5yZWFkKHVyaSwgeyBhY2NlcHRUZXh0T25seTogdHJ1ZSB9KS50aGVuKFxuXHRcdFx0XHRcdGNvbnRlbnQgPT4gISFjb250ZW50LnZhbHVlLm1hdGNoKC9henVyZS9pKSxcblx0XHRcdFx0XHRlcnIgPT4gZmFsc2Vcblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH0pKS50aGVuKGphdmFzID0+IHtcblx0XHRcdGlmIChqYXZhcy5pbmRleE9mKHRydWUpICE9PSAtMSkge1xuXHRcdFx0XHR0YWdzWydqYXZhJ10gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRhZ3M7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlcG9ydEF6dXJlKHVyaXM6IFVSSVtdKSB7XG5cdFx0Y29uc3QgdGFnczogVGFncyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0dGhpcy5yZXBvcnRBenVyZU5vZGUodXJpcywgdGFncykudGhlbigodGFncykgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVwb3J0QXp1cmVKYXZhKHVyaXMsIHRhZ3MpO1xuXHRcdH0pLnRoZW4oKHRhZ3MpID0+IHtcblx0XHRcdGlmIChPYmplY3Qua2V5cyh0YWdzKS5sZW5ndGgpIHtcblx0XHRcdFx0LyogX19HRFBSX19cblx0XHRcdFx0XHRcIndvcmtzcGFjZS5henVyZVwiIDoge1xuXHRcdFx0XHRcdFx0XCJvd25lclwiOiBcImxyYW1vczE1XCIsXG5cdFx0XHRcdFx0XHRcIiR7aW5jbHVkZX1cIjogW1xuXHRcdFx0XHRcdFx0XHRcIiR7QXp1cmVUYWdzfVwiXG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHQqL1xuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nKCd3b3Jrc3BhY2UuYXp1cmUnLCB0YWdzKTtcblx0XHRcdH1cblx0XHR9KS50aGVuKHVuZGVmaW5lZCwgb25VbmV4cGVjdGVkRXJyb3IpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXBvcnRDbG91ZFN0YXRzKCk6IHZvaWQge1xuXHRcdGNvbnN0IHVyaXMgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMubWFwKGZvbGRlciA9PiBmb2xkZXIudXJpKTtcblx0XHRpZiAodXJpcy5sZW5ndGggJiYgdGhpcy5maWxlU2VydmljZSkge1xuXHRcdFx0dGhpcy5yZXBvcnRSZW1vdGVEb21haW5zKHVyaXMpO1xuXHRcdFx0dGhpcy5yZXBvcnRSZW1vdGVzKHVyaXMpO1xuXHRcdFx0dGhpcy5yZXBvcnRBenVyZSh1cmlzKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlcG9ydFByb3h5U3RhdHMoKSB7XG5cdFx0Y29uc3QgZG93bmxvYWRVcmwgPSB0aGlzLnByb2R1Y3RTZXJ2aWNlLmRvd25sb2FkVXJsO1xuXHRcdGlmICghZG93bmxvYWRVcmwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5yZXF1ZXN0U2VydmljZS5yZXNvbHZlUHJveHkoZG93bmxvYWRVcmwpXG5cdFx0XHQudGhlbihwcm94eSA9PiB7XG5cdFx0XHRcdGxldCB0eXBlID0gcHJveHkgPyBTdHJpbmcocHJveHkpLnRyaW0oKS5zcGxpdCgvXFxzKy8sIDEpWzBdIDogJ0VNUFRZJztcblx0XHRcdFx0aWYgKFsnRElSRUNUJywgJ1BST1hZJywgJ0hUVFBTJywgJ1NPQ0tTJywgJ0VNUFRZJ10uaW5kZXhPZih0eXBlKSA9PT0gLTEpIHtcblx0XHRcdFx0XHR0eXBlID0gJ1VOS05PV04nO1xuXHRcdFx0XHR9XG5cdFx0XHR9KS50aGVuKHVuZGVmaW5lZCwgb25VbmV4cGVjdGVkRXJyb3IpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMseUJBQXlCO0FBRWxDLFNBQVMsb0JBQStCO0FBQ3hDLFNBQVMsbUJBQW1CLHNCQUFzQjtBQUNsRCxTQUFTLGdDQUFnQztBQUV6QyxTQUFTLHdCQUF5QjtBQUNsQyxTQUFTLHVCQUE2Qiw4QkFBOEIsc0NBQXNDO0FBQzFHLFNBQVMsMkJBQWtEO0FBQzNELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMs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
