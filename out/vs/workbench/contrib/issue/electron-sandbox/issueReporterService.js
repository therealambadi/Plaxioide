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
import { $, reset } from "../../../../base/browser/dom.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { Schemas } from "../../../../base/common/network.js";
import { joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { isRemoteDiagnosticError } from "../../../../platform/diagnostics/common/diagnostics.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IProcessMainService } from "../../../../platform/process/common/process.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IUpdateService, StateType } from "../../../../platform/update/common/update.js";
import { applyZoom } from "../../../../platform/window/electron-sandbox/window.js";
import { BaseIssueReporterService } from "../browser/baseIssueReporterService.js";
import { IIssueFormService, IssueType } from "../common/issue.js";
const MAX_URL_LENGTH = 7500;
const MAX_GITHUB_API_LENGTH = 65500;
let IssueReporter = class extends BaseIssueReporterService {
  constructor(disableExtensions, data, os, product, window, nativeHostService, issueFormService, processMainService, themeService, fileService, fileDialogService, updateService) {
    super(disableExtensions, data, os, product, window, false, issueFormService, themeService, fileService, fileDialogService);
    this.nativeHostService = nativeHostService;
    this.updateService = updateService;
    this.processMainService = processMainService;
    this.processMainService.$getSystemInfo().then((info) => {
      this.issueReporterModel.update({ systemInfo: info });
      this.receivedSystemInfo = true;
      this.updateSystemInfo(this.issueReporterModel.getData());
      this.updatePreviewButtonState();
    });
    if (this.data.issueType === IssueType.PerformanceIssue) {
      this.processMainService.$getPerformanceInfo().then((info) => {
        this.updatePerformanceInfo(info);
      });
    }
    this.checkForUpdates();
    this.setEventHandlers();
    applyZoom(this.data.zoomLevel, this.window);
    this.updateExperimentsInfo(this.data.experiments);
    this.updateRestrictedMode(this.data.restrictedMode);
    this.updateUnsupportedMode(this.data.isUnsupported);
  }
  async checkForUpdates() {
    const updateState = this.updateService.state;
    if (updateState.type === StateType.Ready || updateState.type === StateType.Downloaded) {
      this.needsUpdate = true;
      const includeAcknowledgement = this.getElementById("version-acknowledgements");
      const updateBanner = this.getElementById("update-banner");
      if (updateBanner && includeAcknowledgement) {
        includeAcknowledgement.classList.remove("hidden");
        updateBanner.classList.remove("hidden");
        updateBanner.textContent = localize("updateAvailable", "A new version of {0} is available.", this.product.nameLong);
      }
    }
  }
  setEventHandlers() {
    super.setEventHandlers();
    this.addEventListener("issue-type", "change", (event) => {
      const issueType = parseInt(event.target.value);
      this.issueReporterModel.update({ issueType });
      if (issueType === IssueType.PerformanceIssue && !this.receivedPerformanceInfo) {
        this.processMainService.$getPerformanceInfo().then((info) => {
          this.updatePerformanceInfo(info);
        });
      }
      const descriptionTextArea = this.getElementById("issue-title");
      if (descriptionTextArea) {
        descriptionTextArea.placeholder = localize("undefinedPlaceholder", "Please enter a title");
      }
      this.updatePreviewButtonState();
      this.setSourceOptions();
      this.render();
    });
  }
  async submitToGitHub(issueTitle, issueBody, gitHubDetails) {
    if (issueBody.length > MAX_GITHUB_API_LENGTH) {
      const extensionData = this.issueReporterModel.getData().extensionData;
      if (extensionData) {
        issueBody = issueBody.replace(extensionData, "");
        const date = /* @__PURE__ */ new Date();
        const formattedDate = date.toISOString().split("T")[0];
        const formattedTime = date.toTimeString().split(" ")[0].replace(/:/g, "-");
        const fileName = `extensionData_${formattedDate}_${formattedTime}.md`;
        try {
          const downloadPath = await this.fileDialogService.showSaveDialog({
            title: localize("saveExtensionData", "Save Extension Data"),
            availableFileSystems: [Schemas.file],
            defaultUri: joinPath(await this.fileDialogService.defaultFilePath(Schemas.file), fileName)
          });
          if (downloadPath) {
            await this.fileService.writeFile(downloadPath, VSBuffer.fromString(extensionData));
          }
        } catch (e) {
          console.error("Writing extension data to file failed");
          return false;
        }
      } else {
        console.error("Issue body too large to submit to GitHub");
        return false;
      }
    }
    const url = `https://api.github.com/repos/${gitHubDetails.owner}/${gitHubDetails.repositoryName}/issues`;
    const init = {
      method: "POST",
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody
      }),
      headers: new Headers({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.data.githubAccessToken}`
      })
    };
    const response = await fetch(url, init);
    if (!response.ok) {
      console.error("Invalid GitHub URL provided.");
      return false;
    }
    const result = await response.json();
    await this.nativeHostService.openExternal(result.html_url);
    this.close();
    return true;
  }
  async createIssue() {
    const selectedExtension = this.issueReporterModel.getData().selectedExtension;
    const hasUri = this.nonGitHubIssueUrl;
    if (hasUri) {
      const url2 = this.getExtensionBugsUrl();
      if (url2) {
        this.hasBeenSubmitted = true;
        await this.nativeHostService.openExternal(url2);
        return true;
      }
    }
    if (!this.validateInputs()) {
      const invalidInput = this.window.document.getElementsByClassName("invalid-input");
      if (invalidInput.length) {
        invalidInput[0].focus();
      }
      this.addEventListener("issue-title", "input", (_) => {
        this.validateInput("issue-title");
      });
      this.addEventListener("description", "input", (_) => {
        this.validateInput("description");
      });
      this.addEventListener("issue-source", "change", (_) => {
        this.validateInput("issue-source");
      });
      if (this.issueReporterModel.fileOnExtension()) {
        this.addEventListener("extension-selector", "change", (_) => {
          this.validateInput("extension-selector");
          this.validateInput("description");
        });
      }
      return false;
    }
    this.hasBeenSubmitted = true;
    const issueTitle = this.getElementById("issue-title").value;
    const issueBody = this.issueReporterModel.serialize();
    let issueUrl = this.getIssueUrl();
    if (!issueUrl) {
      console.error("No issue url found");
      return false;
    }
    if (selectedExtension?.uri) {
      const uri = URI.revive(selectedExtension.uri);
      issueUrl = uri.toString();
    }
    const gitHubDetails = this.parseGitHubUrl(issueUrl);
    const baseUrl = this.getIssueUrlWithTitle(this.getElementById("issue-title").value, issueUrl);
    let url = baseUrl + `&body=${encodeURIComponent(issueBody)}`;
    if (this.data.githubAccessToken && gitHubDetails) {
      if (await this.submitToGitHub(issueTitle, issueBody, gitHubDetails)) {
        return true;
      }
    }
    try {
      if (url.length > MAX_URL_LENGTH || issueBody.length > MAX_GITHUB_API_LENGTH) {
        url = await this.writeToClipboard(baseUrl, issueBody);
      }
    } catch (_) {
      console.error("Writing to clipboard failed");
      return false;
    }
    await this.nativeHostService.openExternal(url);
    return true;
  }
  async writeToClipboard(baseUrl, issueBody) {
    const shouldWrite = await this.issueFormService.showClipboardDialog();
    if (!shouldWrite) {
      throw new CancellationError();
    }
    await this.nativeHostService.writeClipboardText(issueBody);
    return baseUrl + `&body=${encodeURIComponent(localize("pasteData", "We have written the needed data into your clipboard because it was too large to send. Please paste."))}`;
  }
  updateSystemInfo(state) {
    const target = this.window.document.querySelector(".block-system .block-info");
    if (target) {
      const systemInfo = state.systemInfo;
      const renderedDataTable = $(
        "table",
        void 0,
        $(
          "tr",
          void 0,
          $("td", void 0, "CPUs"),
          $("td", void 0, systemInfo.cpus || "")
        ),
        $(
          "tr",
          void 0,
          $("td", void 0, "GPU Status"),
          $("td", void 0, Object.keys(systemInfo.gpuStatus).map((key) => `${key}: ${systemInfo.gpuStatus[key]}`).join("\n"))
        ),
        $(
          "tr",
          void 0,
          $("td", void 0, "Load (avg)"),
          $("td", void 0, systemInfo.load || "")
        ),
        $(
          "tr",
          void 0,
          $("td", void 0, "Memory (System)"),
          $("td", void 0, systemInfo.memory)
        ),
        $(
          "tr",
          void 0,
          $("td", void 0, "Process Argv"),
          $("td", void 0, systemInfo.processArgs)
        ),
        $(
          "tr",
          void 0,
          $("td", void 0, "Screen Reader"),
          $("td", void 0, systemInfo.screenReader)
        ),
        $(
          "tr",
          void 0,
          $("td", void 0, "VM"),
          $("td", void 0, systemInfo.vmHint)
        )
      );
      reset(target, renderedDataTable);
      systemInfo.remoteData.forEach((remote) => {
        target.appendChild($("hr"));
        if (isRemoteDiagnosticError(remote)) {
          const remoteDataTable = $(
            "table",
            void 0,
            $(
              "tr",
              void 0,
              $("td", void 0, "Remote"),
              $("td", void 0, remote.hostName)
            ),
            $(
              "tr",
              void 0,
              $("td", void 0, ""),
              $("td", void 0, remote.errorMessage)
            )
          );
          target.appendChild(remoteDataTable);
        } else {
          const remoteDataTable = $(
            "table",
            void 0,
            $(
              "tr",
              void 0,
              $("td", void 0, "Remote"),
              $("td", void 0, remote.latency ? `${remote.hostName} (latency: ${remote.latency.current.toFixed(2)}ms last, ${remote.latency.average.toFixed(2)}ms average)` : remote.hostName)
            ),
            $(
              "tr",
              void 0,
              $("td", void 0, "OS"),
              $("td", void 0, remote.machineInfo.os)
            ),
            $(
              "tr",
              void 0,
              $("td", void 0, "CPUs"),
              $("td", void 0, remote.machineInfo.cpus || "")
            ),
            $(
              "tr",
              void 0,
              $("td", void 0, "Memory (System)"),
              $("td", void 0, remote.machineInfo.memory)
            ),
            $(
              "tr",
              void 0,
              $("td", void 0, "VM"),
              $("td", void 0, remote.machineInfo.vmHint)
            )
          );
          target.appendChild(remoteDataTable);
        }
      });
    }
  }
  updateRestrictedMode(restrictedMode) {
    this.issueReporterModel.update({ restrictedMode });
  }
  updateUnsupportedMode(isUnsupported) {
    this.issueReporterModel.update({ isUnsupported });
  }
  updateExperimentsInfo(experimentInfo) {
    this.issueReporterModel.update({ experimentInfo });
    const target = this.window.document.querySelector(".block-experiments .block-info");
    if (target) {
      target.textContent = experimentInfo ? experimentInfo : localize("noCurrentExperiments", "No current experiments.");
    }
  }
};
IssueReporter = __decorateClass([
  __decorateParam(5, INativeHostService),
  __decorateParam(6, IIssueFormService),
  __decorateParam(7, IProcessMainService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IFileService),
  __decorateParam(10, IFileDialogService),
  __decorateParam(11, IUpdateService)
], IssueReporter);
export {
  IssueReporter
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pc3N1ZS9lbGVjdHJvbi1zYW5kYm94L2lzc3VlUmVwb3J0ZXJTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCB7ICQsIHJlc2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdENvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBpc1JlbW90ZURpYWdub3N0aWNFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWdub3N0aWNzL2NvbW1vbi9kaWFnbm9zdGljcy5qcyc7XG5pbXBvcnQgeyBJRmlsZURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9uYXRpdmUvY29tbW9uL25hdGl2ZS5qcyc7XG5pbXBvcnQgeyBJUHJvY2Vzc01haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvY2Vzcy9jb21tb24vcHJvY2Vzcy5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVXBkYXRlU2VydmljZSwgU3RhdGVUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXBkYXRlL2NvbW1vbi91cGRhdGUuanMnO1xuaW1wb3J0IHsgYXBwbHlab29tIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2VsZWN0cm9uLXNhbmRib3gvd2luZG93LmpzJztcbmltcG9ydCB7IEJhc2VJc3N1ZVJlcG9ydGVyU2VydmljZSB9IGZyb20gJy4uL2Jyb3dzZXIvYmFzZUlzc3VlUmVwb3J0ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElzc3VlUmVwb3J0ZXJEYXRhIGFzIElzc3VlUmVwb3J0ZXJNb2RlbERhdGEgfSBmcm9tICcuLi9icm93c2VyL2lzc3VlUmVwb3J0ZXJNb2RlbC5qcyc7XG5pbXBvcnQgeyBJSXNzdWVGb3JtU2VydmljZSwgSXNzdWVSZXBvcnRlckRhdGEsIElzc3VlVHlwZSB9IGZyb20gJy4uL2NvbW1vbi9pc3N1ZS5qcyc7XG5cbi8vIEdpdEh1YiBoYXMgbGV0IHVzIGtub3cgdGhhdCB3ZSBjb3VsZCB1cCBvdXIgbGltaXQgaGVyZSB0byA4ay4gV2UgY2hvc2UgNzUwMCB0byBwbGF5IGl0IHNhZmUuXG4vLyByZWYgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE1OTE5MVxuY29uc3QgTUFYX1VSTF9MRU5HVEggPSA3NTAwO1xuXG4vLyBHaXRodWIgQVBJIGFuZCBpc3N1ZXMgb24gd2ViIGhhcyBhIGxpbWl0IG9mIDY1NTM2LiBXZSBjaG9zZSA2NTUwMCB0byBwbGF5IGl0IHNhZmUuXG4vLyByZWYgaHR0cHM6Ly9naXRodWIuY29tL2dpdGh1Yi9pc3N1ZXMvaXNzdWVzLzEyODU4XG5jb25zdCBNQVhfR0lUSFVCX0FQSV9MRU5HVEggPSA2NTUwMDtcblxuXG5leHBvcnQgY2xhc3MgSXNzdWVSZXBvcnRlciBleHRlbmRzIEJhc2VJc3N1ZVJlcG9ydGVyU2VydmljZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgcHJvY2Vzc01haW5TZXJ2aWNlOiBJUHJvY2Vzc01haW5TZXJ2aWNlO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRkaXNhYmxlRXh0ZW5zaW9uczogYm9vbGVhbixcblx0XHRkYXRhOiBJc3N1ZVJlcG9ydGVyRGF0YSxcblx0XHRvczoge1xuXHRcdFx0dHlwZTogc3RyaW5nO1xuXHRcdFx0YXJjaDogc3RyaW5nO1xuXHRcdFx0cmVsZWFzZTogc3RyaW5nO1xuXHRcdH0sXG5cdFx0cHJvZHVjdDogSVByb2R1Y3RDb25maWd1cmF0aW9uLFxuXHRcdHdpbmRvdzogV2luZG93LFxuXHRcdEBJTmF0aXZlSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBuYXRpdmVIb3N0U2VydmljZTogSU5hdGl2ZUhvc3RTZXJ2aWNlLFxuXHRcdEBJSXNzdWVGb3JtU2VydmljZSBpc3N1ZUZvcm1TZXJ2aWNlOiBJSXNzdWVGb3JtU2VydmljZSxcblx0XHRASVByb2Nlc3NNYWluU2VydmljZSBwcm9jZXNzTWFpblNlcnZpY2U6IElQcm9jZXNzTWFpblNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUZpbGVEaWFsb2dTZXJ2aWNlIGZpbGVEaWFsb2dTZXJ2aWNlOiBJRmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0QElVcGRhdGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXBkYXRlU2VydmljZTogSVVwZGF0ZVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoZGlzYWJsZUV4dGVuc2lvbnMsIGRhdGEsIG9zLCBwcm9kdWN0LCB3aW5kb3csIGZhbHNlLCBpc3N1ZUZvcm1TZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGZpbGVTZXJ2aWNlLCBmaWxlRGlhbG9nU2VydmljZSk7XG5cdFx0dGhpcy5wcm9jZXNzTWFpblNlcnZpY2UgPSBwcm9jZXNzTWFpblNlcnZpY2U7XG5cdFx0dGhpcy5wcm9jZXNzTWFpblNlcnZpY2UuJGdldFN5c3RlbUluZm8oKS50aGVuKGluZm8gPT4ge1xuXHRcdFx0dGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwudXBkYXRlKHsgc3lzdGVtSW5mbzogaW5mbyB9KTtcblx0XHRcdHRoaXMucmVjZWl2ZWRTeXN0ZW1JbmZvID0gdHJ1ZTtcblxuXHRcdFx0dGhpcy51cGRhdGVTeXN0ZW1JbmZvKHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLmdldERhdGEoKSk7XG5cdFx0XHR0aGlzLnVwZGF0ZVByZXZpZXdCdXR0b25TdGF0ZSgpO1xuXHRcdH0pO1xuXHRcdGlmICh0aGlzLmRhdGEuaXNzdWVUeXBlID09PSBJc3N1ZVR5cGUuUGVyZm9ybWFuY2VJc3N1ZSkge1xuXHRcdFx0dGhpcy5wcm9jZXNzTWFpblNlcnZpY2UuJGdldFBlcmZvcm1hbmNlSW5mbygpLnRoZW4oaW5mbyA9PiB7XG5cdFx0XHRcdHRoaXMudXBkYXRlUGVyZm9ybWFuY2VJbmZvKGluZm8gYXMgUGFydGlhbDxJc3N1ZVJlcG9ydGVyRGF0YT4pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5jaGVja0ZvclVwZGF0ZXMoKTtcblx0XHR0aGlzLnNldEV2ZW50SGFuZGxlcnMoKTtcblx0XHRhcHBseVpvb20odGhpcy5kYXRhLnpvb21MZXZlbCwgdGhpcy53aW5kb3cpO1xuXHRcdHRoaXMudXBkYXRlRXhwZXJpbWVudHNJbmZvKHRoaXMuZGF0YS5leHBlcmltZW50cyk7XG5cdFx0dGhpcy51cGRhdGVSZXN0cmljdGVkTW9kZSh0aGlzLmRhdGEucmVzdHJpY3RlZE1vZGUpO1xuXHRcdHRoaXMudXBkYXRlVW5zdXBwb3J0ZWRNb2RlKHRoaXMuZGF0YS5pc1Vuc3VwcG9ydGVkKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY2hlY2tGb3JVcGRhdGVzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHVwZGF0ZVN0YXRlID0gdGhpcy51cGRhdGVTZXJ2aWNlLnN0YXRlO1xuXHRcdGlmICh1cGRhdGVTdGF0ZS50eXBlID09PSBTdGF0ZVR5cGUuUmVhZHkgfHwgdXBkYXRlU3RhdGUudHlwZSA9PT0gU3RhdGVUeXBlLkRvd25sb2FkZWQpIHtcblx0XHRcdHRoaXMubmVlZHNVcGRhdGUgPSB0cnVlO1xuXHRcdFx0Y29uc3QgaW5jbHVkZUFja25vd2xlZGdlbWVudCA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ3ZlcnNpb24tYWNrbm93bGVkZ2VtZW50cycpO1xuXHRcdFx0Y29uc3QgdXBkYXRlQmFubmVyID0gdGhpcy5nZXRFbGVtZW50QnlJZCgndXBkYXRlLWJhbm5lcicpO1xuXHRcdFx0aWYgKHVwZGF0ZUJhbm5lciAmJiBpbmNsdWRlQWNrbm93bGVkZ2VtZW50KSB7XG5cdFx0XHRcdGluY2x1ZGVBY2tub3dsZWRnZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XG5cdFx0XHRcdHVwZGF0ZUJhbm5lci5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcblx0XHRcdFx0dXBkYXRlQmFubmVyLnRleHRDb250ZW50ID0gbG9jYWxpemUoJ3VwZGF0ZUF2YWlsYWJsZScsIFwiQSBuZXcgdmVyc2lvbiBvZiB7MH0gaXMgYXZhaWxhYmxlLlwiLCB0aGlzLnByb2R1Y3QubmFtZUxvbmcpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBzZXRFdmVudEhhbmRsZXJzKCk6IHZvaWQge1xuXHRcdHN1cGVyLnNldEV2ZW50SGFuZGxlcnMoKTtcblxuXHRcdHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignaXNzdWUtdHlwZScsICdjaGFuZ2UnLCAoZXZlbnQ6IEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBpc3N1ZVR5cGUgPSBwYXJzZUludCgoPEhUTUxJbnB1dEVsZW1lbnQ+ZXZlbnQudGFyZ2V0KS52YWx1ZSk7XG5cdFx0XHR0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC51cGRhdGUoeyBpc3N1ZVR5cGU6IGlzc3VlVHlwZSB9KTtcblx0XHRcdGlmIChpc3N1ZVR5cGUgPT09IElzc3VlVHlwZS5QZXJmb3JtYW5jZUlzc3VlICYmICF0aGlzLnJlY2VpdmVkUGVyZm9ybWFuY2VJbmZvKSB7XG5cdFx0XHRcdHRoaXMucHJvY2Vzc01haW5TZXJ2aWNlLiRnZXRQZXJmb3JtYW5jZUluZm8oKS50aGVuKGluZm8gPT4ge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlUGVyZm9ybWFuY2VJbmZvKGluZm8gYXMgUGFydGlhbDxJc3N1ZVJlcG9ydGVyRGF0YT4pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVzZXRzIHBsYWNlaG9sZGVyXG5cdFx0XHRjb25zdCBkZXNjcmlwdGlvblRleHRBcmVhID0gPEhUTUxJbnB1dEVsZW1lbnQ+dGhpcy5nZXRFbGVtZW50QnlJZCgnaXNzdWUtdGl0bGUnKTtcblx0XHRcdGlmIChkZXNjcmlwdGlvblRleHRBcmVhKSB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uVGV4dEFyZWEucGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgndW5kZWZpbmVkUGxhY2Vob2xkZXInLCBcIlBsZWFzZSBlbnRlciBhIHRpdGxlXCIpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnVwZGF0ZVByZXZpZXdCdXR0b25TdGF0ZSgpO1xuXHRcdFx0dGhpcy5zZXRTb3VyY2VPcHRpb25zKCk7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGFzeW5jIHN1Ym1pdFRvR2l0SHViKGlzc3VlVGl0bGU6IHN0cmluZywgaXNzdWVCb2R5OiBzdHJpbmcsIGdpdEh1YkRldGFpbHM6IHsgb3duZXI6IHN0cmluZzsgcmVwb3NpdG9yeU5hbWU6IHN0cmluZyB9KTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKGlzc3VlQm9keS5sZW5ndGggPiBNQVhfR0lUSFVCX0FQSV9MRU5HVEgpIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbkRhdGEgPSB0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC5nZXREYXRhKCkuZXh0ZW5zaW9uRGF0YTtcblx0XHRcdGlmIChleHRlbnNpb25EYXRhKSB7XG5cdFx0XHRcdGlzc3VlQm9keSA9IGlzc3VlQm9keS5yZXBsYWNlKGV4dGVuc2lvbkRhdGEsICcnKTtcblx0XHRcdFx0Y29uc3QgZGF0ZSA9IG5ldyBEYXRlKCk7XG5cdFx0XHRcdGNvbnN0IGZvcm1hdHRlZERhdGUgPSBkYXRlLnRvSVNPU3RyaW5nKCkuc3BsaXQoJ1QnKVswXTsgLy8gWVlZWS1NTS1ERFxuXHRcdFx0XHRjb25zdCBmb3JtYXR0ZWRUaW1lID0gZGF0ZS50b1RpbWVTdHJpbmcoKS5zcGxpdCgnICcpWzBdLnJlcGxhY2UoLzovZywgJy0nKTsgLy8gSEgtTU0tU1Ncblx0XHRcdFx0Y29uc3QgZmlsZU5hbWUgPSBgZXh0ZW5zaW9uRGF0YV8ke2Zvcm1hdHRlZERhdGV9XyR7Zm9ybWF0dGVkVGltZX0ubWRgO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IGRvd25sb2FkUGF0aCA9IGF3YWl0IHRoaXMuZmlsZURpYWxvZ1NlcnZpY2Uuc2hvd1NhdmVEaWFsb2coe1xuXHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzYXZlRXh0ZW5zaW9uRGF0YScsIFwiU2F2ZSBFeHRlbnNpb24gRGF0YVwiKSxcblx0XHRcdFx0XHRcdGF2YWlsYWJsZUZpbGVTeXN0ZW1zOiBbU2NoZW1hcy5maWxlXSxcblx0XHRcdFx0XHRcdGRlZmF1bHRVcmk6IGpvaW5QYXRoKGF3YWl0IHRoaXMuZmlsZURpYWxvZ1NlcnZpY2UuZGVmYXVsdEZpbGVQYXRoKFNjaGVtYXMuZmlsZSksIGZpbGVOYW1lKSxcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGlmIChkb3dubG9hZFBhdGgpIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2Uud3JpdGVGaWxlKGRvd25sb2FkUGF0aCwgVlNCdWZmZXIuZnJvbVN0cmluZyhleHRlbnNpb25EYXRhKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcignV3JpdGluZyBleHRlbnNpb24gZGF0YSB0byBmaWxlIGZhaWxlZCcpO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcignSXNzdWUgYm9keSB0b28gbGFyZ2UgdG8gc3VibWl0IHRvIEdpdEh1YicpO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHVybCA9IGBodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zLyR7Z2l0SHViRGV0YWlscy5vd25lcn0vJHtnaXRIdWJEZXRhaWxzLnJlcG9zaXRvcnlOYW1lfS9pc3N1ZXNgO1xuXHRcdGNvbnN0IGluaXQgPSB7XG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0dGl0bGU6IGlzc3VlVGl0bGUsXG5cdFx0XHRcdGJvZHk6IGlzc3VlQm9keVxuXHRcdFx0fSksXG5cdFx0XHRoZWFkZXJzOiBuZXcgSGVhZGVycyh7XG5cdFx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHRcdCdBdXRob3JpemF0aW9uJzogYEJlYXJlciAke3RoaXMuZGF0YS5naXRodWJBY2Nlc3NUb2tlbn1gXG5cdFx0XHR9KVxuXHRcdH07XG5cblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwgaW5pdCk7XG5cdFx0aWYgKCFyZXNwb25zZS5vaykge1xuXHRcdFx0Y29uc29sZS5lcnJvcignSW52YWxpZCBHaXRIdWIgVVJMIHByb3ZpZGVkLicpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cdFx0YXdhaXQgdGhpcy5uYXRpdmVIb3N0U2VydmljZS5vcGVuRXh0ZXJuYWwocmVzdWx0Lmh0bWxfdXJsKTtcblx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgYXN5bmMgY3JlYXRlSXNzdWUoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3Qgc2VsZWN0ZWRFeHRlbnNpb24gPSB0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC5nZXREYXRhKCkuc2VsZWN0ZWRFeHRlbnNpb247XG5cdFx0Y29uc3QgaGFzVXJpID0gdGhpcy5ub25HaXRIdWJJc3N1ZVVybDtcblx0XHQvLyBTaG9ydCBjaXJjdWl0IGlmIHRoZSBleHRlbnNpb24gcHJvdmlkZXMgYSBjdXN0b20gaXNzdWUgaGFuZGxlclxuXHRcdGlmIChoYXNVcmkpIHtcblx0XHRcdGNvbnN0IHVybCA9IHRoaXMuZ2V0RXh0ZW5zaW9uQnVnc1VybCgpO1xuXHRcdFx0aWYgKHVybCkge1xuXHRcdFx0XHR0aGlzLmhhc0JlZW5TdWJtaXR0ZWQgPSB0cnVlO1xuXHRcdFx0XHRhd2FpdCB0aGlzLm5hdGl2ZUhvc3RTZXJ2aWNlLm9wZW5FeHRlcm5hbCh1cmwpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIXRoaXMudmFsaWRhdGVJbnB1dHMoKSkge1xuXHRcdFx0Ly8gSWYgaW5wdXRzIGFyZSBpbnZhbGlkLCBzZXQgZm9jdXMgdG8gdGhlIGZpcnN0IG9uZSBhbmQgYWRkIGxpc3RlbmVycyBvbiB0aGVtXG5cdFx0XHQvLyB0byBkZXRlY3QgZnVydGhlciBjaGFuZ2VzXG5cdFx0XHRjb25zdCBpbnZhbGlkSW5wdXQgPSB0aGlzLndpbmRvdy5kb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdpbnZhbGlkLWlucHV0Jyk7XG5cdFx0XHRpZiAoaW52YWxpZElucHV0Lmxlbmd0aCkge1xuXHRcdFx0XHQoPEhUTUxJbnB1dEVsZW1lbnQ+aW52YWxpZElucHV0WzBdKS5mb2N1cygpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2lzc3VlLXRpdGxlJywgJ2lucHV0JywgXyA9PiB7XG5cdFx0XHRcdHRoaXMudmFsaWRhdGVJbnB1dCgnaXNzdWUtdGl0bGUnKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2Rlc2NyaXB0aW9uJywgJ2lucHV0JywgXyA9PiB7XG5cdFx0XHRcdHRoaXMudmFsaWRhdGVJbnB1dCgnZGVzY3JpcHRpb24nKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2lzc3VlLXNvdXJjZScsICdjaGFuZ2UnLCBfID0+IHtcblx0XHRcdFx0dGhpcy52YWxpZGF0ZUlucHV0KCdpc3N1ZS1zb3VyY2UnKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAodGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZmlsZU9uRXh0ZW5zaW9uKCkpIHtcblx0XHRcdFx0dGhpcy5hZGRFdmVudExpc3RlbmVyKCdleHRlbnNpb24tc2VsZWN0b3InLCAnY2hhbmdlJywgXyA9PiB7XG5cdFx0XHRcdFx0dGhpcy52YWxpZGF0ZUlucHV0KCdleHRlbnNpb24tc2VsZWN0b3InKTtcblx0XHRcdFx0XHR0aGlzLnZhbGlkYXRlSW5wdXQoJ2Rlc2NyaXB0aW9uJyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5oYXNCZWVuU3VibWl0dGVkID0gdHJ1ZTtcblxuXHRcdGNvbnN0IGlzc3VlVGl0bGUgPSAoPEhUTUxJbnB1dEVsZW1lbnQ+dGhpcy5nZXRFbGVtZW50QnlJZCgnaXNzdWUtdGl0bGUnKSkudmFsdWU7XG5cdFx0Y29uc3QgaXNzdWVCb2R5ID0gdGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuc2VyaWFsaXplKCk7XG5cblx0XHRsZXQgaXNzdWVVcmwgPSB0aGlzLmdldElzc3VlVXJsKCk7XG5cdFx0aWYgKCFpc3N1ZVVybCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcignTm8gaXNzdWUgdXJsIGZvdW5kJyk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHNlbGVjdGVkRXh0ZW5zaW9uPy51cmkpIHtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5yZXZpdmUoc2VsZWN0ZWRFeHRlbnNpb24udXJpKTtcblx0XHRcdGlzc3VlVXJsID0gdXJpLnRvU3RyaW5nKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZ2l0SHViRGV0YWlscyA9IHRoaXMucGFyc2VHaXRIdWJVcmwoaXNzdWVVcmwpO1xuXG5cdFx0Y29uc3QgYmFzZVVybCA9IHRoaXMuZ2V0SXNzdWVVcmxXaXRoVGl0bGUoKDxIVE1MSW5wdXRFbGVtZW50PnRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2lzc3VlLXRpdGxlJykpLnZhbHVlLCBpc3N1ZVVybCk7XG5cdFx0bGV0IHVybCA9IGJhc2VVcmwgKyBgJmJvZHk9JHtlbmNvZGVVUklDb21wb25lbnQoaXNzdWVCb2R5KX1gO1xuXG5cdFx0aWYgKHRoaXMuZGF0YS5naXRodWJBY2Nlc3NUb2tlbiAmJiBnaXRIdWJEZXRhaWxzKSB7XG5cdFx0XHRpZiAoYXdhaXQgdGhpcy5zdWJtaXRUb0dpdEh1Yihpc3N1ZVRpdGxlLCBpc3N1ZUJvZHksIGdpdEh1YkRldGFpbHMpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRpZiAodXJsLmxlbmd0aCA+IE1BWF9VUkxfTEVOR1RIIHx8IGlzc3VlQm9keS5sZW5ndGggPiBNQVhfR0lUSFVCX0FQSV9MRU5HVEgpIHtcblx0XHRcdFx0dXJsID0gYXdhaXQgdGhpcy53cml0ZVRvQ2xpcGJvYXJkKGJhc2VVcmwsIGlzc3VlQm9keSk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoXykge1xuXHRcdFx0Y29uc29sZS5lcnJvcignV3JpdGluZyB0byBjbGlwYm9hcmQgZmFpbGVkJyk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5uYXRpdmVIb3N0U2VydmljZS5vcGVuRXh0ZXJuYWwodXJsKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBhc3luYyB3cml0ZVRvQ2xpcGJvYXJkKGJhc2VVcmw6IHN0cmluZywgaXNzdWVCb2R5OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IHNob3VsZFdyaXRlID0gYXdhaXQgdGhpcy5pc3N1ZUZvcm1TZXJ2aWNlLnNob3dDbGlwYm9hcmREaWFsb2coKTtcblx0XHRpZiAoIXNob3VsZFdyaXRlKSB7XG5cdFx0XHR0aHJvdyBuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLm5hdGl2ZUhvc3RTZXJ2aWNlLndyaXRlQ2xpcGJvYXJkVGV4dChpc3N1ZUJvZHkpO1xuXG5cdFx0cmV0dXJuIGJhc2VVcmwgKyBgJmJvZHk9JHtlbmNvZGVVUklDb21wb25lbnQobG9jYWxpemUoJ3Bhc3RlRGF0YScsIFwiV2UgaGF2ZSB3cml0dGVuIHRoZSBuZWVkZWQgZGF0YSBpbnRvIHlvdXIgY2xpcGJvYXJkIGJlY2F1c2UgaXQgd2FzIHRvbyBsYXJnZSB0byBzZW5kLiBQbGVhc2UgcGFzdGUuXCIpKX1gO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTeXN0ZW1JbmZvKHN0YXRlOiBJc3N1ZVJlcG9ydGVyTW9kZWxEYXRhKSB7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gdGhpcy53aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5ibG9jay1zeXN0ZW0gLmJsb2NrLWluZm8nKTtcblxuXHRcdGlmICh0YXJnZXQpIHtcblx0XHRcdGNvbnN0IHN5c3RlbUluZm8gPSBzdGF0ZS5zeXN0ZW1JbmZvITtcblx0XHRcdGNvbnN0IHJlbmRlcmVkRGF0YVRhYmxlID0gJCgndGFibGUnLCB1bmRlZmluZWQsXG5cdFx0XHRcdCQoJ3RyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdCQoJ3RkJywgdW5kZWZpbmVkLCAnQ1BVcycpLFxuXHRcdFx0XHRcdCQoJ3RkJywgdW5kZWZpbmVkLCBzeXN0ZW1JbmZvLmNwdXMgfHwgJycpXG5cdFx0XHRcdCksXG5cdFx0XHRcdCQoJ3RyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdCQoJ3RkJywgdW5kZWZpbmVkLCAnR1BVIFN0YXR1cycgYXMgc3RyaW5nKSxcblx0XHRcdFx0XHQkKCd0ZCcsIHVuZGVmaW5lZCwgT2JqZWN0LmtleXMoc3lzdGVtSW5mby5ncHVTdGF0dXMpLm1hcChrZXkgPT4gYCR7a2V5fTogJHtzeXN0ZW1JbmZvLmdwdVN0YXR1c1trZXldfWApLmpvaW4oJ1xcbicpKVxuXHRcdFx0XHQpLFxuXHRcdFx0XHQkKCd0cicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHQkKCd0ZCcsIHVuZGVmaW5lZCwgJ0xvYWQgKGF2ZyknIGFzIHN0cmluZyksXG5cdFx0XHRcdFx0JCgndGQnLCB1bmRlZmluZWQsIHN5c3RlbUluZm8ubG9hZCB8fCAnJylcblx0XHRcdFx0KSxcblx0XHRcdFx0JCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgndGQnLCB1bmRlZmluZWQsICdNZW1vcnkgKFN5c3RlbSknIGFzIHN0cmluZyksXG5cdFx0XHRcdFx0JCgndGQnLCB1bmRlZmluZWQsIHN5c3RlbUluZm8ubWVtb3J5KVxuXHRcdFx0XHQpLFxuXHRcdFx0XHQkKCd0cicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHQkKCd0ZCcsIHVuZGVmaW5lZCwgJ1Byb2Nlc3MgQXJndicgYXMgc3RyaW5nKSxcblx0XHRcdFx0XHQkKCd0ZCcsIHVuZGVmaW5lZCwgc3lzdGVtSW5mby5wcm9jZXNzQXJncylcblx0XHRcdFx0KSxcblx0XHRcdFx0JCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgndGQnLCB1bmRlZmluZWQsICdTY3JlZW4gUmVhZGVyJyBhcyBzdHJpbmcpLFxuXHRcdFx0XHRcdCQoJ3RkJywgdW5kZWZpbmVkLCBzeXN0ZW1JbmZvLnNjcmVlblJlYWRlcilcblx0XHRcdFx0KSxcblx0XHRcdFx0JCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgndGQnLCB1bmRlZmluZWQsICdWTScpLFxuXHRcdFx0XHRcdCQoJ3RkJywgdW5kZWZpbmVkLCBzeXN0ZW1JbmZvLnZtSGludClcblx0XHRcdFx0KVxuXHRcdFx0KTtcblx0XHRcdHJlc2V0KHRhcmdldCwgcmVuZGVyZWREYXRhVGFibGUpO1xuXG5cdFx0XHRzeXN0ZW1JbmZvLnJlbW90ZURhdGEuZm9yRWFjaChyZW1vdGUgPT4ge1xuXHRcdFx0XHR0YXJnZXQuYXBwZW5kQ2hpbGQoJDxIVE1MSFJFbGVtZW50PignaHInKSk7XG5cdFx0XHRcdGlmIChpc1JlbW90ZURpYWdub3N0aWNFcnJvcihyZW1vdGUpKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVtb3RlRGF0YVRhYmxlID0gJCgndGFibGUnLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHQkKCd0cicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0JCgndGQnLCB1bmRlZmluZWQsICdSZW1vdGUnKSxcblx0XHRcdFx0XHRcdFx0JCgndGQnLCB1bmRlZmluZWQsIHJlbW90ZS5ob3N0TmFtZSlcblx0XHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0XHQkKCd0cicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0JCgndGQnLCB1bmRlZmluZWQsICcnKSxcblx0XHRcdFx0XHRcdFx0JCgndGQnLCB1bmRlZmluZWQsIHJlbW90ZS5lcnJvck1lc3NhZ2UpXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR0YXJnZXQuYXBwZW5kQ2hpbGQocmVtb3RlRGF0YVRhYmxlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCByZW1vdGVEYXRhVGFibGUgPSAkKCd0YWJsZScsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdCQoJ3RyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHQkKCd0ZCcsIHVuZGVmaW5lZCwgJ1JlbW90ZScpLFxuXHRcdFx0XHRcdFx0XHQkKCd0ZCcsIHVuZGVmaW5lZCwgcmVtb3RlLmxhdGVuY3kgPyBgJHtyZW1vdGUuaG9zdE5hbWV9IChsYXRlbmN5OiAke3JlbW90ZS5sYXRlbmN5LmN1cnJlbnQudG9GaXhlZCgyKX1tcyBsYXN0LCAke3JlbW90ZS5sYXRlbmN5LmF2ZXJhZ2UudG9GaXhlZCgyKX1tcyBhdmVyYWdlKWAgOiByZW1vdGUuaG9zdE5hbWUpXG5cdFx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdFx0JCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdCQoJ3RkJywgdW5kZWZpbmVkLCAnT1MnKSxcblx0XHRcdFx0XHRcdFx0JCgndGQnLCB1bmRlZmluZWQsIHJlbW90ZS5tYWNoaW5lSW5mby5vcylcblx0XHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0XHQkKCd0cicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0JCgndGQnLCB1bmRlZmluZWQsICdDUFVzJyksXG5cdFx0XHRcdFx0XHRcdCQoJ3RkJywgdW5kZWZpbmVkLCByZW1vdGUubWFjaGluZUluZm8uY3B1cyB8fCAnJylcblx0XHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0XHQkKCd0cicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0JCgndGQnLCB1bmRlZmluZWQsICdNZW1vcnkgKFN5c3RlbSknIGFzIHN0cmluZyksXG5cdFx0XHRcdFx0XHRcdCQoJ3RkJywgdW5kZWZpbmVkLCByZW1vdGUubWFjaGluZUluZm8ubWVtb3J5KVxuXHRcdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRcdCQoJ3RyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHQkKCd0ZCcsIHVuZGVmaW5lZCwgJ1ZNJyksXG5cdFx0XHRcdFx0XHRcdCQoJ3RkJywgdW5kZWZpbmVkLCByZW1vdGUubWFjaGluZUluZm8udm1IaW50KVxuXHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0dGFyZ2V0LmFwcGVuZENoaWxkKHJlbW90ZURhdGFUYWJsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlUmVzdHJpY3RlZE1vZGUocmVzdHJpY3RlZE1vZGU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC51cGRhdGUoeyByZXN0cmljdGVkTW9kZSB9KTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVW5zdXBwb3J0ZWRNb2RlKGlzVW5zdXBwb3J0ZWQ6IGJvb2xlYW4pIHtcblx0XHR0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC51cGRhdGUoeyBpc1Vuc3VwcG9ydGVkIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVFeHBlcmltZW50c0luZm8oZXhwZXJpbWVudEluZm86IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLnVwZGF0ZSh7IGV4cGVyaW1lbnRJbmZvIH0pO1xuXHRcdGNvbnN0IHRhcmdldCA9IHRoaXMud2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuYmxvY2stZXhwZXJpbWVudHMgLmJsb2NrLWluZm8nKTtcblx0XHRpZiAodGFyZ2V0KSB7XG5cdFx0XHR0YXJnZXQudGV4dENvbnRlbnQgPSBleHBlcmltZW50SW5mbyA/IGV4cGVyaW1lbnRJbmZvIDogbG9jYWxpemUoJ25vQ3VycmVudEV4cGVyaW1lbnRzJywgXCJObyBjdXJyZW50IGV4cGVyaW1lbnRzLlwiKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBSUEsU0FBUyxHQUFHLGFBQWE7QUFDekIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBRXhCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsV0FBVztBQUNwQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdCQUFnQixpQkFBaUI7QUFDMUMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBUyxtQkFBc0MsaUJBQWlCO0FBSWhFLE1BQU0saUJBQWlCO0FBSXZCLE1BQU0sd0JBQXdCO0FBR3ZCLElBQU0sZ0JBQU4sY0FBNEIseUJBQXlCO0FBQUEsRUFFM0QsWUFDQyxtQkFDQSxNQUNBLElBS0EsU0FDQSxRQUNxQyxtQkFDbEIsa0JBQ0Usb0JBQ04sY0FDRCxhQUNNLG1CQUNhLGVBQ2hDO0FBQ0QsVUFBTSxtQkFBbUIsTUFBTSxJQUFJLFNBQVMsUUFBUSxPQUFPLGtCQUFrQixjQUFjLGFBQWEsaUJBQWlCO0FBUnBGO0FBTUo7QUFHakMsU0FBSyxx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
