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
import { $, isHTMLInputElement, isHTMLTextAreaElement, reset, windowOpenNoOpener } from "../../../../base/browser/dom.js";
import { createStyleSheet } from "../../../../base/browser/domStylesheets.js";
import { Button, unthemedButtonStyles } from "../../../../base/browser/ui/button/button.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { Delayer, RunOnceScheduler } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { groupBy } from "../../../../base/common/collections.js";
import { debounce } from "../../../../base/common/decorators.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isLinuxSnap, isMacintosh } from "../../../../base/common/platform.js";
import { joinPath } from "../../../../base/common/resources.js";
import { escape } from "../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { getIconsStyleSheet } from "../../../../platform/theme/browser/iconsStyleSheet.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IIssueFormService, IssueType } from "../common/issue.js";
import { normalizeGitHubUrl } from "../common/issueReporterUtil.js";
import { IssueReporterModel } from "./issueReporterModel.js";
const MAX_URL_LENGTH = 7500;
const MAX_EXTENSION_DATA_LENGTH = 6e4;
var IssueSource = /* @__PURE__ */ ((IssueSource2) => {
  IssueSource2["VSCode"] = "vscode";
  IssueSource2["Extension"] = "extension";
  IssueSource2["Marketplace"] = "marketplace";
  IssueSource2["Unknown"] = "unknown";
  return IssueSource2;
})(IssueSource || {});
let BaseIssueReporterService = class extends Disposable {
  constructor(disableExtensions, data, os, product, window, isWeb, issueFormService, themeService, fileService, fileDialogService) {
    super();
    this.disableExtensions = disableExtensions;
    this.data = data;
    this.os = os;
    this.product = product;
    this.window = window;
    this.isWeb = isWeb;
    this.issueFormService = issueFormService;
    this.themeService = themeService;
    this.fileService = fileService;
    this.fileDialogService = fileDialogService;
    this.receivedSystemInfo = false;
    this.numberOfSearchResultsDisplayed = 0;
    this.receivedPerformanceInfo = false;
    this.shouldQueueSearch = false;
    this.hasBeenSubmitted = false;
    this.openReporter = false;
    this.loadingExtensionData = false;
    this.selectedExtension = "";
    this.delayedSubmit = new Delayer(300);
    this.nonGitHubIssueUrl = false;
    this.needsUpdate = false;
    this.acknowledged = false;
    const targetExtension = data.extensionId ? data.enabledExtensions.find((extension) => extension.id.toLocaleLowerCase() === data.extensionId?.toLocaleLowerCase()) : void 0;
    this.issueReporterModel = new IssueReporterModel({
      ...data,
      issueType: data.issueType || IssueType.Bug,
      versionInfo: {
        vscodeVersion: `${product.nameShort} ${!!product.darwinUniversalAssetId ? `${product.version} (Universal)` : product.version} (${product.commit || "Commit unknown"}, ${product.date || "Date unknown"})`,
        os: `${this.os.type} ${this.os.arch} ${this.os.release}${isLinuxSnap ? " snap" : ""}`
      },
      extensionsDisabled: !!this.disableExtensions,
      fileOnExtension: data.extensionId ? !targetExtension?.isBuiltin : void 0,
      selectedExtension: targetExtension
    });
    const fileOnMarketplace = data.issueSource === "marketplace" /* Marketplace */;
    const fileOnProduct = data.issueSource === "vscode" /* VSCode */;
    this.issueReporterModel.update({ fileOnMarketplace, fileOnProduct });
    const issueReporterElement = this.getElementById("issue-reporter");
    if (issueReporterElement) {
      this.previewButton = this._register(new Button(issueReporterElement, unthemedButtonStyles));
      const issueRepoName = document.createElement("a");
      issueReporterElement.appendChild(issueRepoName);
      issueRepoName.id = "show-repo-name";
      issueRepoName.classList.add("hidden");
      this.updatePreviewButtonState();
    }
    const issueTitle = data.issueTitle;
    if (issueTitle) {
      const issueTitleElement = this.getElementById("issue-title");
      if (issueTitleElement) {
        issueTitleElement.value = issueTitle;
      }
    }
    const issueBody = data.issueBody;
    if (issueBody) {
      const description = this.getElementById("description");
      if (description) {
        description.value = issueBody;
        this.issueReporterModel.update({ issueDescription: issueBody });
      }
    }
    if (this.window.document.documentElement.lang !== "en") {
      show(this.getElementById("english"));
    }
    const codiconStyleSheet = createStyleSheet();
    codiconStyleSheet.id = "codiconStyles";
    const iconsStyleSheet = this._register(getIconsStyleSheet(this.themeService));
    function updateAll() {
      codiconStyleSheet.textContent = iconsStyleSheet.getCSS();
    }
    const delayer = new RunOnceScheduler(updateAll, 0);
    this._register(iconsStyleSheet.onDidChange(() => delayer.schedule()));
    delayer.schedule();
    this.handleExtensionData(data.enabledExtensions);
    this.setUpTypes();
    this.applyStyles(data.styles);
    if ((data.data || data.uri) && targetExtension) {
      this.updateExtensionStatus(targetExtension);
    }
  }
  render() {
    this.renderBlocks();
  }
  setInitialFocus() {
    const { fileOnExtension } = this.issueReporterModel.getData();
    if (fileOnExtension) {
      const issueTitle = this.window.document.getElementById("issue-title");
      issueTitle?.focus();
    } else {
      const issueType = this.window.document.getElementById("issue-type");
      issueType?.focus();
    }
  }
  // TODO @justschen: After migration to Aux Window, switch to dedicated css.
  applyStyles(styles) {
    const styleTag = document.createElement("style");
    const content = [];
    if (styles.inputBackground) {
      content.push(`input[type="text"], textarea, select, .issues-container > .issue > .issue-state, .block-info { background-color: ${styles.inputBackground} !important; }`);
    }
    if (styles.backgroundColor) {
      content.push(`.monaco-workbench { background-color: ${styles.backgroundColor} !important; }`);
      content.push(`.issue-reporter-body::-webkit-scrollbar-track { background-color: ${styles.backgroundColor}; }`);
    }
    if (styles.inputBorder) {
      content.push(`input[type="text"], textarea, select { border: 1px solid ${styles.inputBorder}; }`);
    } else {
      content.push(`input[type="text"], textarea, select { border: 1px solid transparent; }`);
    }
    if (styles.inputForeground) {
      content.push(`input[type="text"], textarea, select, .issues-container > .issue > .issue-state, .block-info { color: ${styles.inputForeground} !important; }`);
    }
    if (styles.inputErrorBorder) {
      content.push(`.invalid-input, .invalid-input:focus, .validation-error { border: 1px solid ${styles.inputErrorBorder} !important; }`);
      content.push(`.required-input { color: ${styles.inputErrorBorder}; }`);
    }
    if (styles.inputErrorBackground) {
      content.push(`.validation-error { background: ${styles.inputErrorBackground}; }`);
    }
    if (styles.inputErrorForeground) {
      content.push(`.validation-error { color: ${styles.inputErrorForeground}; }`);
    }
    if (styles.inputActiveBorder) {
      content.push(`input[type='text']:focus, textarea:focus, select:focus, summary:focus, button:focus, a:focus, .workbenchCommand:focus  { border: 1px solid ${styles.inputActiveBorder}; outline-style: none; }`);
    }
    if (styles.textLinkColor) {
      content.push(`a, .workbenchCommand { color: ${styles.textLinkColor}; }`);
    }
    if (styles.textLinkColor) {
      content.push(`a { color: ${styles.textLinkColor}; }`);
    }
    if (styles.textLinkActiveForeground) {
      content.push(`a:hover, .workbenchCommand:hover { color: ${styles.textLinkActiveForeground}; }`);
    }
    if (styles.sliderActiveColor) {
      content.push(`.issue-reporter-body::-webkit-scrollbar-thumb:active { background-color: ${styles.sliderActiveColor}; }`);
    }
    if (styles.sliderHoverColor) {
      content.push(`.issue-reporter-body::-webkit-scrollbar-thumb { background-color: ${styles.sliderHoverColor}; }`);
      content.push(`.issue-reporter-body::--webkit-scrollbar-thumb:hover { background-color: ${styles.sliderHoverColor}; }`);
    }
    if (styles.buttonBackground) {
      content.push(`.monaco-text-button { background-color: ${styles.buttonBackground} !important; }`);
    }
    if (styles.buttonForeground) {
      content.push(`.monaco-text-button { color: ${styles.buttonForeground} !important; }`);
    }
    if (styles.buttonHoverBackground) {
      content.push(`.monaco-text-button:not(.disabled):hover, .monaco-text-button:focus { background-color: ${styles.buttonHoverBackground} !important; }`);
    }
    styleTag.textContent = content.join("\n");
    this.window.document.head.appendChild(styleTag);
    this.window.document.body.style.color = styles.color || "";
  }
  async updateIssueReporterUri(extension) {
    try {
      if (extension.uri) {
        const uri = URI.revive(extension.uri);
        extension.bugsUrl = uri.toString();
      }
    } catch (e) {
      this.renderBlocks();
    }
  }
  handleExtensionData(extensions) {
    const installedExtensions = extensions.filter((x) => !x.isBuiltin);
    const { nonThemes, themes } = groupBy(installedExtensions, (ext) => {
      return ext.isTheme ? "themes" : "nonThemes";
    });
    const numberOfThemeExtesions = themes && themes.length;
    this.issueReporterModel.update({ numberOfThemeExtesions, enabledNonThemeExtesions: nonThemes, allExtensions: installedExtensions });
    this.updateExtensionTable(nonThemes, numberOfThemeExtesions);
    if (this.disableExtensions || installedExtensions.length === 0) {
      this.getElementById("disableExtensions").disabled = true;
    }
    this.updateExtensionSelector(installedExtensions);
  }
  updateExtensionSelector(extensions) {
    const extensionOptions = extensions.map((extension) => {
      return {
        name: extension.displayName || extension.name || "",
        id: extension.id
      };
    });
    extensionOptions.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (aName > bName) {
        return 1;
      }
      if (aName < bName) {
        return -1;
      }
      return 0;
    });
    const makeOption = (extension, selectedExtension) => {
      const selected = selectedExtension && extension.id === selectedExtension.id;
      return $("option", {
        "value": extension.id,
        "selected": selected || ""
      }, extension.name);
    };
    const extensionsSelector = this.getElementById("extension-selector");
    if (extensionsSelector) {
      const { selectedExtension } = this.issueReporterModel.getData();
      reset(extensionsSelector, this.makeOption("", localize("selectExtension", "Select extension"), true), ...extensionOptions.map((extension) => makeOption(extension, selectedExtension)));
      if (!selectedExtension) {
        extensionsSelector.selectedIndex = 0;
      }
      this.addEventListener("extension-selector", "change", async (e) => {
        this.clearExtensionData();
        const selectedExtensionId = e.target.value;
        this.selectedExtension = selectedExtensionId;
        const extensions2 = this.issueReporterModel.getData().allExtensions;
        const matches = extensions2.filter((extension) => extension.id === selectedExtensionId);
        if (matches.length) {
          this.issueReporterModel.update({ selectedExtension: matches[0] });
          const selectedExtension2 = this.issueReporterModel.getData().selectedExtension;
          if (selectedExtension2) {
            const iconElement = document.createElement("span");
            iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.loading), "codicon-modifier-spin");
            this.setLoading(iconElement);
            const openReporterData = await this.sendReporterMenu(selectedExtension2);
            if (openReporterData) {
              if (this.selectedExtension === selectedExtensionId) {
                this.removeLoading(iconElement, true);
                this.data = openReporterData;
              }
            } else {
              if (!this.loadingExtensionData) {
                iconElement.classList.remove(...ThemeIcon.asClassNameArray(Codicon.loading), "codicon-modifier-spin");
              }
              this.removeLoading(iconElement);
              this.clearExtensionData();
              selectedExtension2.data = void 0;
              selectedExtension2.uri = void 0;
            }
            if (this.selectedExtension === selectedExtensionId) {
              this.updateExtensionStatus(matches[0]);
              this.openReporter = false;
            }
          } else {
            this.issueReporterModel.update({ selectedExtension: void 0 });
            this.clearSearchResults();
            this.clearExtensionData();
            this.validateSelectedExtension();
            this.updateExtensionStatus(matches[0]);
          }
        }
      });
    }
    this.addEventListener("problem-source", "change", (_) => {
      this.clearExtensionData();
      this.validateSelectedExtension();
    });
  }
  async sendReporterMenu(extension) {
    try {
      const data = await this.issueFormService.sendReporterMenu(extension.id);
      return data;
    } catch (e) {
      console.error(e);
      return void 0;
    }
  }
  updateAcknowledgementState() {
    const acknowledgementCheckbox = this.getElementById("includeAcknowledgement");
    if (acknowledgementCheckbox) {
      this.acknowledged = acknowledgementCheckbox.checked;
      this.updatePreviewButtonState();
    }
  }
  setEventHandlers() {
    ["includeSystemInfo", "includeProcessInfo", "includeWorkspaceInfo", "includeExtensions", "includeExperiments", "includeExtensionData"].forEach((elementId) => {
      this.addEventListener(elementId, "click", (event) => {
        event.stopPropagation();
        this.issueReporterModel.update({ [elementId]: !this.issueReporterModel.getData()[elementId] });
      });
    });
    this.addEventListener("includeAcknowledgement", "click", (event) => {
      event.stopPropagation();
      this.updateAcknowledgementState();
    });
    const showInfoElements = this.window.document.getElementsByClassName("showInfo");
    for (let i = 0; i < showInfoElements.length; i++) {
      const showInfo = showInfoElements.item(i);
      showInfo.addEventListener("click", (e) => {
        e.preventDefault();
        const label = e.target;
        if (label) {
          const containingElement = label.parentElement && label.parentElement.parentElement;
          const info = containingElement && containingElement.lastElementChild;
          if (info && info.classList.contains("hidden")) {
            show(info);
            label.textContent = localize("hide", "hide");
          } else {
            hide(info);
            label.textContent = localize("show", "show");
          }
        }
      });
    }
    this.addEventListener("issue-source", "change", (e) => {
      const value = e.target.value;
      const problemSourceHelpText = this.getElementById("problem-source-help-text");
      if (value === "") {
        this.issueReporterModel.update({ fileOnExtension: void 0 });
        show(problemSourceHelpText);
        this.clearSearchResults();
        this.render();
        return;
      } else {
        hide(problemSourceHelpText);
      }
      const descriptionTextArea = this.getElementById("issue-title");
      if (value === "vscode" /* VSCode */) {
        descriptionTextArea.placeholder = localize("vscodePlaceholder", "E.g Workbench is missing problems panel");
      } else if (value === "extension" /* Extension */) {
        descriptionTextArea.placeholder = localize("extensionPlaceholder", "E.g. Missing alt text on extension readme image");
      } else if (value === "marketplace" /* Marketplace */) {
        descriptionTextArea.placeholder = localize("marketplacePlaceholder", "E.g Cannot disable installed extension");
      } else {
        descriptionTextArea.placeholder = localize("undefinedPlaceholder", "Please enter a title");
      }
      let fileOnExtension, fileOnMarketplace = false;
      if (value === "extension" /* Extension */) {
        fileOnExtension = true;
      } else if (value === "marketplace" /* Marketplace */) {
        fileOnMarketplace = true;
      }
      this.issueReporterModel.update({ fileOnExtension, fileOnMarketplace });
      this.render();
      const title = this.getElementById("issue-title").value;
      this.searchIssues(title, fileOnExtension, fileOnMarketplace);
    });
    this.addEventListener("description", "input", (e) => {
      const issueDescription = e.target.value;
      this.issueReporterModel.update({ issueDescription });
      if (this.issueReporterModel.fileOnExtension() === false) {
        const title = this.getElementById("issue-title").value;
        this.searchVSCodeIssues(title, issueDescription);
      }
    });
    this.addEventListener("issue-title", "input", (_) => {
      const titleElement = this.getElementById("issue-title");
      if (titleElement) {
        const title = titleElement.value;
        this.issueReporterModel.update({ issueTitle: title });
      }
    });
    this.addEventListener("issue-title", "input", (e) => {
      const title = e.target.value;
      const lengthValidationMessage = this.getElementById("issue-title-length-validation-error");
      const issueUrl = this.getIssueUrl();
      if (title && this.getIssueUrlWithTitle(title, issueUrl).length > MAX_URL_LENGTH) {
        show(lengthValidationMessage);
      } else {
        hide(lengthValidationMessage);
      }
      const issueSource = this.getElementById("issue-source");
      if (!issueSource || issueSource.value === "") {
        return;
      }
      const { fileOnExtension, fileOnMarketplace } = this.issueReporterModel.getData();
      this.searchIssues(title, fileOnExtension, fileOnMarketplace);
    });
    this._register(this.previewButton.onDidClick(async () => {
      this.delayedSubmit.trigger(async () => {
        this.createIssue();
      });
    }));
    this.addEventListener("disableExtensions", "click", () => {
      this.issueFormService.reloadWithExtensionsDisabled();
    });
    this.addEventListener("extensionBugsLink", "click", (e) => {
      const url = e.target.innerText;
      windowOpenNoOpener(url);
    });
    this.addEventListener("disableExtensions", "keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" || e.key === " ") {
        this.issueFormService.reloadWithExtensionsDisabled();
      }
    });
    this.window.document.onkeydown = async (e) => {
      const cmdOrCtrlKey = isMacintosh ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrlKey && e.key === "Enter") {
        this.delayedSubmit.trigger(async () => {
          if (await this.createIssue()) {
            this.close();
          }
        });
      }
      if (cmdOrCtrlKey && e.key === "w") {
        e.stopPropagation();
        e.preventDefault();
        const issueTitle = this.getElementById("issue-title").value;
        const { issueDescription } = this.issueReporterModel.getData();
        if (!this.hasBeenSubmitted && (issueTitle || issueDescription)) {
          this.issueFormService.showConfirmCloseDialog();
        } else {
          this.close();
        }
      }
      if (isMacintosh) {
        if (cmdOrCtrlKey && e.key === "a" && e.target) {
          if (isHTMLInputElement(e.target) || isHTMLTextAreaElement(e.target)) {
            e.target.select();
          }
        }
      }
    };
  }
  updatePerformanceInfo(info) {
    this.issueReporterModel.update(info);
    this.receivedPerformanceInfo = true;
    const state = this.issueReporterModel.getData();
    this.updateProcessInfo(state);
    this.updateWorkspaceInfo(state);
    this.updatePreviewButtonState();
  }
  updatePreviewButtonState() {
    if (!this.acknowledged && this.needsUpdate) {
      this.previewButton.label = localize("acknowledge", "Confirm Version Acknowledgement");
      this.previewButton.enabled = false;
    } else if (this.isPreviewEnabled()) {
      if (this.data.githubAccessToken) {
        this.previewButton.label = localize("createOnGitHub", "Create on GitHub");
      } else {
        this.previewButton.label = localize("previewOnGitHub", "Preview on GitHub");
      }
      this.previewButton.enabled = true;
    } else {
      this.previewButton.enabled = false;
      this.previewButton.label = localize("loadingData", "Loading data...");
    }
    const issueRepoName = this.getElementById("show-repo-name");
    const selectedExtension = this.issueReporterModel.getData().selectedExtension;
    if (selectedExtension && selectedExtension.uri) {
      const urlString = URI.revive(selectedExtension.uri).toString();
      issueRepoName.href = urlString;
      issueRepoName.addEventListener("click", (e) => this.openLink(e));
      issueRepoName.addEventListener("auxclick", (e) => this.openLink(e));
      const gitHubInfo = this.parseGitHubUrl(urlString);
      issueRepoName.textContent = gitHubInfo ? gitHubInfo.owner + "/" + gitHubInfo.repositoryName : urlString;
      Object.assign(issueRepoName.style, {
        alignSelf: "flex-end",
        display: "block",
        fontSize: "13px",
        marginBottom: "10px",
        padding: "4px 0px",
        textDecoration: "none",
        width: "auto"
      });
      show(issueRepoName);
    } else {
      issueRepoName.removeAttribute("style");
      hide(issueRepoName);
    }
    this.getExtensionGitHubUrl();
  }
  isPreviewEnabled() {
    const issueType = this.issueReporterModel.getData().issueType;
    if (this.loadingExtensionData) {
      return false;
    }
    if (this.isWeb) {
      if (issueType === IssueType.FeatureRequest || issueType === IssueType.PerformanceIssue || issueType === IssueType.Bug) {
        return true;
      }
    } else {
      if (issueType === IssueType.Bug && this.receivedSystemInfo) {
        return true;
      }
      if (issueType === IssueType.PerformanceIssue && this.receivedSystemInfo && this.receivedPerformanceInfo) {
        return true;
      }
      if (issueType === IssueType.FeatureRequest) {
        return true;
      }
    }
    return false;
  }
  getExtensionRepositoryUrl() {
    const selectedExtension = this.issueReporterModel.getData().selectedExtension;
    return selectedExtension && selectedExtension.repositoryUrl;
  }
  getExtensionBugsUrl() {
    const selectedExtension = this.issueReporterModel.getData().selectedExtension;
    return selectedExtension && selectedExtension.bugsUrl;
  }
  searchVSCodeIssues(title, issueDescription) {
    if (title) {
      this.searchDuplicates(title, issueDescription);
    } else {
      this.clearSearchResults();
    }
  }
  searchIssues(title, fileOnExtension, fileOnMarketplace) {
    if (fileOnExtension) {
      return this.searchExtensionIssues(title);
    }
    if (fileOnMarketplace) {
      return this.searchMarketplaceIssues(title);
    }
    const description = this.issueReporterModel.getData().issueDescription;
    this.searchVSCodeIssues(title, description);
  }
  searchExtensionIssues(title) {
    const url = this.getExtensionGitHubUrl();
    if (title) {
      const matches = /^https?:\/\/github\.com\/(.*)/.exec(url);
      if (matches && matches.length) {
        const repo = matches[1];
        return this.searchGitHub(repo, title);
      }
      if (this.issueReporterModel.getData().selectedExtension) {
        this.clearSearchResults();
        return this.displaySearchResults([]);
      }
    }
    this.clearSearchResults();
  }
  searchMarketplaceIssues(title) {
    if (title) {
      const gitHubInfo = this.parseGitHubUrl(this.product.reportMarketplaceIssueUrl);
      if (gitHubInfo) {
        return this.searchGitHub(`${gitHubInfo.owner}/${gitHubInfo.repositoryName}`, title);
      }
    }
  }
  async close() {
    await this.issueFormService.closeReporter();
  }
  clearSearchResults() {
    const similarIssues = this.getElementById("similar-issues");
    similarIssues.innerText = "";
    this.numberOfSearchResultsDisplayed = 0;
  }
  searchGitHub(repo, title) {
    const query = `is:issue+repo:${repo}+${title}`;
    const similarIssues = this.getElementById("similar-issues");
    fetch(`https://api.github.com/search/issues?q=${query}`).then((response) => {
      response.json().then((result) => {
        similarIssues.innerText = "";
        if (result && result.items) {
          this.displaySearchResults(result.items);
        } else {
          const message = $("div.list-title");
          message.textContent = localize("rateLimited", "GitHub query limit exceeded. Please wait.");
          similarIssues.appendChild(message);
          const resetTime = response.headers.get("X-RateLimit-Reset");
          const timeToWait = resetTime ? parseInt(resetTime) - Math.floor(Date.now() / 1e3) : 1;
          if (this.shouldQueueSearch) {
            this.shouldQueueSearch = false;
            setTimeout(() => {
              this.searchGitHub(repo, title);
              this.shouldQueueSearch = true;
            }, timeToWait * 1e3);
          }
        }
      }).catch((_) => {
        console.warn("Timeout or query limit exceeded");
      });
    }).catch((_) => {
      console.warn("Error fetching GitHub issues");
    });
  }
  searchDuplicates(title, body) {
    const url = "https://vscode-probot.westus.cloudapp.azure.com:7890/duplicate_candidates";
    const init = {
      method: "POST",
      body: JSON.stringify({
        title,
        body
      }),
      headers: new Headers({
        "Content-Type": "application/json"
      })
    };
    fetch(url, init).then((response) => {
      response.json().then((result) => {
        this.clearSearchResults();
        if (result && result.candidates) {
          this.displaySearchResults(result.candidates);
        } else {
          throw new Error("Unexpected response, no candidates property");
        }
      }).catch((_) => {
      });
    }).catch((_) => {
    });
  }
  displaySearchResults(results) {
    const similarIssues = this.getElementById("similar-issues");
    if (results.length) {
      const issues = $("div.issues-container");
      const issuesText = $("div.list-title");
      issuesText.textContent = localize("similarIssues", "Similar issues");
      this.numberOfSearchResultsDisplayed = results.length < 5 ? results.length : 5;
      for (let i = 0; i < this.numberOfSearchResultsDisplayed; i++) {
        const issue = results[i];
        const link = $("a.issue-link", { href: issue.html_url });
        link.textContent = issue.title;
        link.title = issue.title;
        link.addEventListener("click", (e) => this.openLink(e));
        link.addEventListener("auxclick", (e) => this.openLink(e));
        let issueState;
        let item;
        if (issue.state) {
          issueState = $("span.issue-state");
          const issueIcon = $("span.issue-icon");
          issueIcon.appendChild(renderIcon(issue.state === "open" ? Codicon.issueOpened : Codicon.issueClosed));
          const issueStateLabel = $("span.issue-state.label");
          issueStateLabel.textContent = issue.state === "open" ? localize("open", "Open") : localize("closed", "Closed");
          issueState.title = issue.state === "open" ? localize("open", "Open") : localize("closed", "Closed");
          issueState.appendChild(issueIcon);
          issueState.appendChild(issueStateLabel);
          item = $("div.issue", void 0, issueState, link);
        } else {
          item = $("div.issue", void 0, link);
        }
        issues.appendChild(item);
      }
      similarIssues.appendChild(issuesText);
      similarIssues.appendChild(issues);
    } else {
      const message = $("div.list-title");
      message.textContent = localize("noSimilarIssues", "No similar issues found");
      similarIssues.appendChild(message);
    }
  }
  setUpTypes() {
    const makeOption = (issueType2, description) => $("option", { "value": issueType2.valueOf() }, escape(description));
    const typeSelect = this.getElementById("issue-type");
    const { issueType } = this.issueReporterModel.getData();
    reset(
      typeSelect,
      makeOption(IssueType.Bug, localize("bugReporter", "Bug Report")),
      makeOption(IssueType.FeatureRequest, localize("featureRequest", "Feature Request")),
      makeOption(IssueType.PerformanceIssue, localize("performanceIssue", "Performance Issue (freeze, slow, crash)"))
    );
    typeSelect.value = issueType.toString();
    this.setSourceOptions();
  }
  makeOption(value, description, disabled) {
    const option = document.createElement("option");
    option.disabled = disabled;
    option.value = value;
    option.textContent = description;
    return option;
  }
  setSourceOptions() {
    const sourceSelect = this.getElementById("issue-source");
    const { issueType, fileOnExtension, selectedExtension, fileOnMarketplace, fileOnProduct } = this.issueReporterModel.getData();
    let selected = sourceSelect.selectedIndex;
    if (selected === -1) {
      if (fileOnExtension !== void 0) {
        selected = fileOnExtension ? 2 : 1;
      } else if (selectedExtension?.isBuiltin) {
        selected = 1;
      } else if (fileOnMarketplace) {
        selected = 3;
      } else if (fileOnProduct) {
        selected = 1;
      }
    }
    sourceSelect.innerText = "";
    sourceSelect.append(this.makeOption("", localize("selectSource", "Select source"), true));
    sourceSelect.append(this.makeOption("vscode" /* VSCode */, localize("vscode", "Visual Studio Code"), false));
    sourceSelect.append(this.makeOption("extension" /* Extension */, localize("extension", "A VS Code extension"), false));
    if (this.product.reportMarketplaceIssueUrl) {
      sourceSelect.append(this.makeOption("marketplace" /* Marketplace */, localize("marketplace", "Extensions Marketplace"), false));
    }
    if (issueType !== IssueType.FeatureRequest) {
      sourceSelect.append(this.makeOption("unknown" /* Unknown */, localize("unknown", "Don't know"), false));
    }
    if (selected !== -1 && selected < sourceSelect.options.length) {
      sourceSelect.selectedIndex = selected;
    } else {
      sourceSelect.selectedIndex = 0;
      hide(this.getElementById("problem-source-help-text"));
    }
  }
  async renderBlocks() {
    const { issueType, fileOnExtension, fileOnMarketplace, selectedExtension } = this.issueReporterModel.getData();
    const blockContainer = this.getElementById("block-container");
    const systemBlock = this.window.document.querySelector(".block-system");
    const processBlock = this.window.document.querySelector(".block-process");
    const workspaceBlock = this.window.document.querySelector(".block-workspace");
    const extensionsBlock = this.window.document.querySelector(".block-extensions");
    const experimentsBlock = this.window.document.querySelector(".block-experiments");
    const extensionDataBlock = this.window.document.querySelector(".block-extension-data");
    const problemSource = this.getElementById("problem-source");
    const descriptionTitle = this.getElementById("issue-description-label");
    const descriptionSubtitle = this.getElementById("issue-description-subtitle");
    const extensionSelector = this.getElementById("extension-selection");
    const downloadExtensionDataLink = this.getElementById("extension-data-download");
    const titleTextArea = this.getElementById("issue-title-container");
    const descriptionTextArea = this.getElementById("description");
    const extensionDataTextArea = this.getElementById("extension-data");
    hide(blockContainer);
    hide(systemBlock);
    hide(processBlock);
    hide(workspaceBlock);
    hide(extensionsBlock);
    hide(experimentsBlock);
    hide(extensionSelector);
    hide(extensionDataTextArea);
    hide(extensionDataBlock);
    hide(downloadExtensionDataLink);
    show(problemSource);
    show(titleTextArea);
    show(descriptionTextArea);
    if (fileOnExtension) {
      show(extensionSelector);
    }
    const extensionData = this.issueReporterModel.getData().extensionData;
    if (extensionData && extensionData.length > MAX_EXTENSION_DATA_LENGTH) {
      show(downloadExtensionDataLink);
      const date = /* @__PURE__ */ new Date();
      const formattedDate = date.toISOString().split("T")[0];
      const formattedTime = date.toTimeString().split(" ")[0].replace(/:/g, "-");
      const fileName = `extensionData_${formattedDate}_${formattedTime}.md`;
      const handleLinkClick = async () => {
        const downloadPath = await this.fileDialogService.showSaveDialog({
          title: localize("saveExtensionData", "Save Extension Data"),
          availableFileSystems: [Schemas.file],
          defaultUri: joinPath(await this.fileDialogService.defaultFilePath(Schemas.file), fileName)
        });
        if (downloadPath) {
          await this.fileService.writeFile(downloadPath, VSBuffer.fromString(extensionData));
        }
      };
      downloadExtensionDataLink.addEventListener("click", handleLinkClick);
      this._register({
        dispose: () => downloadExtensionDataLink.removeEventListener("click", handleLinkClick)
      });
    }
    if (selectedExtension && this.nonGitHubIssueUrl) {
      hide(titleTextArea);
      hide(descriptionTextArea);
      reset(descriptionTitle, localize("handlesIssuesElsewhere", "This extension handles issues outside of VS Code"));
      reset(descriptionSubtitle, localize("elsewhereDescription", "The '{0}' extension prefers to use an external issue reporter. To be taken to that issue reporting experience, click the button below.", selectedExtension.displayName));
      this.previewButton.label = localize("openIssueReporter", "Open External Issue Reporter");
      return;
    }
    if (fileOnExtension && selectedExtension?.data) {
      const data = selectedExtension?.data;
      extensionDataTextArea.innerText = data.toString();
      extensionDataTextArea.readOnly = true;
      show(extensionDataBlock);
    }
    if (fileOnExtension && this.openReporter) {
      extensionDataTextArea.readOnly = true;
      setTimeout(() => {
        if (this.openReporter) {
          show(extensionDataBlock);
        }
      }, 100);
      show(extensionDataBlock);
    }
    if (issueType === IssueType.Bug) {
      if (!fileOnMarketplace) {
        show(blockContainer);
        show(systemBlock);
        show(experimentsBlock);
        if (!fileOnExtension) {
          show(extensionsBlock);
        }
      }
      reset(descriptionTitle, localize("stepsToReproduce", "Steps to Reproduce") + " ", $("span.required-input", void 0, "*"));
      reset(descriptionSubtitle, localize("bugDescription", "Share the steps needed to reliably reproduce the problem. Please include actual and expected results. We support GitHub-flavored Markdown. You will be able to edit your issue and add screenshots when we preview it on GitHub."));
    } else if (issueType === IssueType.PerformanceIssue) {
      if (!fileOnMarketplace) {
        show(blockContainer);
        show(systemBlock);
        show(processBlock);
        show(workspaceBlock);
        show(experimentsBlock);
      }
      if (fileOnExtension) {
        show(extensionSelector);
      } else if (!fileOnMarketplace) {
        show(extensionsBlock);
      }
      reset(descriptionTitle, localize("stepsToReproduce", "Steps to Reproduce") + " ", $("span.required-input", void 0, "*"));
      reset(descriptionSubtitle, localize("performanceIssueDesciption", "When did this performance issue happen? Does it occur on startup or after a specific series of actions? We support GitHub-flavored Markdown. You will be able to edit your issue and add screenshots when we preview it on GitHub."));
    } else if (issueType === IssueType.FeatureRequest) {
      reset(descriptionTitle, localize("description", "Description") + " ", $("span.required-input", void 0, "*"));
      reset(descriptionSubtitle, localize("featureRequestDescription", "Please describe the feature you would like to see. We support GitHub-flavored Markdown. You will be able to edit your issue and add screenshots when we preview it on GitHub."));
    }
  }
  validateInput(inputId) {
    const inputElement = this.getElementById(inputId);
    const inputValidationMessage = this.getElementById(`${inputId}-empty-error`);
    const descriptionShortMessage = this.getElementById(`description-short-error`);
    if (inputId === "description" && this.nonGitHubIssueUrl && this.data.extensionId) {
      return true;
    } else if (!inputElement.value) {
      inputElement.classList.add("invalid-input");
      inputValidationMessage?.classList.remove("hidden");
      descriptionShortMessage?.classList.add("hidden");
      return false;
    } else if (inputId === "description" && inputElement.value.length < 10) {
      inputElement.classList.add("invalid-input");
      descriptionShortMessage?.classList.remove("hidden");
      inputValidationMessage?.classList.add("hidden");
      return false;
    } else {
      inputElement.classList.remove("invalid-input");
      inputValidationMessage?.classList.add("hidden");
      if (inputId === "description") {
        descriptionShortMessage?.classList.add("hidden");
      }
      return true;
    }
  }
  validateInputs() {
    let isValid = true;
    ["issue-title", "description", "issue-source"].forEach((elementId) => {
      isValid = this.validateInput(elementId) && isValid;
    });
    if (this.issueReporterModel.fileOnExtension()) {
      isValid = this.validateInput("extension-selector") && isValid;
    }
    return isValid;
  }
  async submitToGitHub(issueTitle, issueBody, gitHubDetails) {
    const url = `https://api.github.com/repos/${gitHubDetails.owner}/${gitHubDetails.repositoryName}/issues`;
    const init = {
      method: "POST",
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody
      }),
      headers: new Headers({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.data.githubAccessToken}`,
        "User-Agent": "request"
      })
    };
    const response = await fetch(url, init);
    if (!response.ok) {
      console.error("Invalid GitHub URL provided.");
      return false;
    }
    const result = await response.json();
    mainWindow.open(result.html_url, "_blank");
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
    if (this.data.githubAccessToken && gitHubDetails) {
      return this.submitToGitHub(issueTitle, issueBody, gitHubDetails);
    }
    const baseUrl = this.getIssueUrlWithTitle(this.getElementById("issue-title").value, issueUrl);
    let url = baseUrl + `&body=${encodeURIComponent(issueBody)}`;
    if (url.length > MAX_URL_LENGTH) {
      try {
        url = await this.writeToClipboard(baseUrl, issueBody);
      } catch (_) {
        console.error("Writing to clipboard failed");
        return false;
      }
    }
    this.window.open(url, "_blank");
    return true;
  }
  async writeToClipboard(baseUrl, issueBody) {
    const shouldWrite = await this.issueFormService.showClipboardDialog();
    if (!shouldWrite) {
      throw new CancellationError();
    }
    return baseUrl + `&body=${encodeURIComponent(localize("pasteData", "We have written the needed data into your clipboard because it was too large to send. Please paste."))}`;
  }
  getIssueUrl() {
    return this.issueReporterModel.fileOnExtension() ? this.getExtensionGitHubUrl() : this.issueReporterModel.getData().fileOnMarketplace ? this.product.reportMarketplaceIssueUrl : this.product.reportIssueUrl;
  }
  parseGitHubUrl(url) {
    const match = /^https?:\/\/github\.com\/([^\/]*)\/([^\/]*).*/.exec(url);
    if (match && match.length) {
      return {
        owner: match[1],
        repositoryName: match[2]
      };
    } else {
      console.error("No GitHub issues match");
    }
    return void 0;
  }
  getExtensionGitHubUrl() {
    let repositoryUrl = "";
    const bugsUrl = this.getExtensionBugsUrl();
    const extensionUrl = this.getExtensionRepositoryUrl();
    if (bugsUrl && bugsUrl.match(/^https?:\/\/github\.com\/([^\/]*)\/([^\/]*)\/?(\/issues)?$/)) {
      repositoryUrl = normalizeGitHubUrl(bugsUrl);
    } else if (extensionUrl && extensionUrl.match(/^https?:\/\/github\.com\/([^\/]*)\/([^\/]*)$/)) {
      repositoryUrl = normalizeGitHubUrl(extensionUrl);
    } else {
      this.nonGitHubIssueUrl = true;
      repositoryUrl = bugsUrl || extensionUrl || "";
    }
    return repositoryUrl;
  }
  getIssueUrlWithTitle(issueTitle, repositoryUrl) {
    if (this.issueReporterModel.fileOnExtension()) {
      repositoryUrl = repositoryUrl + "/issues/new";
    }
    const queryStringPrefix = repositoryUrl.indexOf("?") === -1 ? "?" : "&";
    return `${repositoryUrl}${queryStringPrefix}title=${encodeURIComponent(issueTitle)}`;
  }
  clearExtensionData() {
    this.nonGitHubIssueUrl = false;
    this.issueReporterModel.update({ extensionData: void 0 });
    this.data.issueBody = this.data.issueBody || "";
    this.data.data = void 0;
    this.data.uri = void 0;
  }
  async updateExtensionStatus(extension) {
    this.issueReporterModel.update({ selectedExtension: extension });
    const template = this.data.issueBody;
    if (template) {
      const descriptionTextArea = this.getElementById("description");
      const descriptionText = descriptionTextArea.value;
      if (descriptionText === "" || !descriptionText.includes(template.toString())) {
        const fullTextArea = descriptionText + (descriptionText === "" ? "" : "\n") + template.toString();
        descriptionTextArea.value = fullTextArea;
        this.issueReporterModel.update({ issueDescription: fullTextArea });
      }
    }
    const data = this.data.data;
    if (data) {
      this.issueReporterModel.update({ extensionData: data });
      extension.data = data;
      const extensionDataBlock = this.window.document.querySelector(".block-extension-data");
      show(extensionDataBlock);
      this.renderBlocks();
    }
    const uri = this.data.uri;
    if (uri) {
      extension.uri = uri;
      this.updateIssueReporterUri(extension);
    }
    this.validateSelectedExtension();
    const title = this.getElementById("issue-title").value;
    this.searchExtensionIssues(title);
    this.updatePreviewButtonState();
    this.renderBlocks();
  }
  validateSelectedExtension() {
    const extensionValidationMessage = this.getElementById("extension-selection-validation-error");
    const extensionValidationNoUrlsMessage = this.getElementById("extension-selection-validation-error-no-url");
    hide(extensionValidationMessage);
    hide(extensionValidationNoUrlsMessage);
    const extension = this.issueReporterModel.getData().selectedExtension;
    if (!extension) {
      this.previewButton.enabled = true;
      return;
    }
    if (this.loadingExtensionData) {
      return;
    }
    const hasValidGitHubUrl = this.getExtensionGitHubUrl();
    if (hasValidGitHubUrl) {
      this.previewButton.enabled = true;
    } else {
      this.setExtensionValidationMessage();
      this.previewButton.enabled = false;
    }
  }
  setLoading(element) {
    this.openReporter = true;
    this.loadingExtensionData = true;
    this.updatePreviewButtonState();
    const extensionDataCaption = this.getElementById("extension-id");
    hide(extensionDataCaption);
    const extensionDataCaption2 = Array.from(this.window.document.querySelectorAll(".ext-parens"));
    extensionDataCaption2.forEach((extensionDataCaption22) => hide(extensionDataCaption22));
    const showLoading = this.getElementById("ext-loading");
    show(showLoading);
    while (showLoading.firstChild) {
      showLoading.firstChild.remove();
    }
    showLoading.append(element);
    this.renderBlocks();
  }
  removeLoading(element, fromReporter = false) {
    this.openReporter = fromReporter;
    this.loadingExtensionData = false;
    this.updatePreviewButtonState();
    const extensionDataCaption = this.getElementById("extension-id");
    show(extensionDataCaption);
    const extensionDataCaption2 = Array.from(this.window.document.querySelectorAll(".ext-parens"));
    extensionDataCaption2.forEach((extensionDataCaption22) => show(extensionDataCaption22));
    const hideLoading = this.getElementById("ext-loading");
    hide(hideLoading);
    if (hideLoading.firstChild) {
      element.remove();
    }
    this.renderBlocks();
  }
  setExtensionValidationMessage() {
    const extensionValidationMessage = this.getElementById("extension-selection-validation-error");
    const extensionValidationNoUrlsMessage = this.getElementById("extension-selection-validation-error-no-url");
    const bugsUrl = this.getExtensionBugsUrl();
    if (bugsUrl) {
      show(extensionValidationMessage);
      const link = this.getElementById("extensionBugsLink");
      link.textContent = bugsUrl;
      return;
    }
    const extensionUrl = this.getExtensionRepositoryUrl();
    if (extensionUrl) {
      show(extensionValidationMessage);
      const link = this.getElementById("extensionBugsLink");
      link.textContent = extensionUrl;
      return;
    }
    show(extensionValidationNoUrlsMessage);
  }
  updateProcessInfo(state) {
    const target = this.window.document.querySelector(".block-process .block-info");
    if (target) {
      reset(target, $("code", void 0, state.processInfo ?? ""));
    }
  }
  updateWorkspaceInfo(state) {
    this.window.document.querySelector(".block-workspace .block-info code").textContent = "\n" + state.workspaceInfo;
  }
  updateExtensionTable(extensions, numThemeExtensions) {
    const target = this.window.document.querySelector(".block-extensions .block-info");
    if (target) {
      if (this.disableExtensions) {
        reset(target, localize("disabledExtensions", "Extensions are disabled"));
        return;
      }
      const themeExclusionStr = numThemeExtensions ? `
(${numThemeExtensions} theme extensions excluded)` : "";
      extensions = extensions || [];
      if (!extensions.length) {
        target.innerText = "Extensions: none" + themeExclusionStr;
        return;
      }
      reset(target, this.getExtensionTableHtml(extensions), document.createTextNode(themeExclusionStr));
    }
  }
  getExtensionTableHtml(extensions) {
    return $(
      "table",
      void 0,
      $(
        "tr",
        void 0,
        $("th", void 0, "Extension"),
        $("th", void 0, "Author (truncated)"),
        $("th", void 0, "Version")
      ),
      ...extensions.map((extension) => $(
        "tr",
        void 0,
        $("td", void 0, extension.name),
        $("td", void 0, extension.publisher?.substr(0, 3) ?? "N/A"),
        $("td", void 0, extension.version)
      ))
    );
  }
  openLink(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.which < 3) {
      windowOpenNoOpener(event.target.href);
    }
  }
  getElementById(elementId) {
    const element = this.window.document.getElementById(elementId);
    if (element) {
      return element;
    } else {
      return void 0;
    }
  }
  addEventListener(elementId, eventType, handler) {
    const element = this.getElementById(elementId);
    element?.addEventListener(eventType, handler);
  }
};
__decorateClass([
  debounce(300)
], BaseIssueReporterService.prototype, "searchGitHub", 1);
__decorateClass([
  debounce(300)
], BaseIssueReporterService.prototype, "searchDuplicates", 1);
BaseIssueReporterService = __decorateClass([
  __decorateParam(6, IIssueFormService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IFileService),
  __decorateParam(9, IFileDialogService)
], BaseIssueReporterService);
function hide(el) {
  el?.classList.add("hidden");
}
function show(el) {
  el?.classList.remove("hidden");
}
export {
  BaseIssueReporterService,
  hide,
  show
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pc3N1ZS9icm93c2VyL2Jhc2VJc3N1ZVJlcG9ydGVyU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgeyAkLCBpc0hUTUxJbnB1dEVsZW1lbnQsIGlzSFRNTFRleHRBcmVhRWxlbWVudCwgcmVzZXQsIHdpbmRvd09wZW5Ob09wZW5lciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgY3JlYXRlU3R5bGVTaGVldCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb21TdHlsZXNoZWV0cy5qcyc7XG5pbXBvcnQgeyBCdXR0b24sIHVudGhlbWVkQnV0dG9uU3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2J1dHRvbi9idXR0b24uanMnO1xuaW1wb3J0IHsgcmVuZGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBEZWxheWVyLCBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IGdyb3VwQnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBkZWJvdW5jZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4U25hcCwgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdENvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGVzY2FwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRmlsZURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBnZXRJY29uc1N0eWxlU2hlZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2ljb25zU3R5bGVTaGVldC5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSXNzdWVGb3JtU2VydmljZSwgSXNzdWVSZXBvcnRlckRhdGEsIElzc3VlUmVwb3J0ZXJFeHRlbnNpb25EYXRhLCBJc3N1ZVJlcG9ydGVyU3R5bGVzLCBJc3N1ZVR5cGUgfSBmcm9tICcuLi9jb21tb24vaXNzdWUuanMnO1xuaW1wb3J0IHsgbm9ybWFsaXplR2l0SHViVXJsIH0gZnJvbSAnLi4vY29tbW9uL2lzc3VlUmVwb3J0ZXJVdGlsLmpzJztcbmltcG9ydCB7IElzc3VlUmVwb3J0ZXJNb2RlbCwgSXNzdWVSZXBvcnRlckRhdGEgYXMgSXNzdWVSZXBvcnRlck1vZGVsRGF0YSB9IGZyb20gJy4vaXNzdWVSZXBvcnRlck1vZGVsLmpzJztcblxuY29uc3QgTUFYX1VSTF9MRU5HVEggPSA3NTAwO1xuXG4vLyBHaXRodWIgQVBJIGFuZCBpc3N1ZXMgb24gd2ViIGhhcyBhIGxpbWl0IG9mIDY1NTM2LiBJZiBleHRlbnNpb24gZGF0YSBpcyB0b28gbGFyZ2UsIHdlIHdpbGwgYWxsb3cgdXNlcnMgdG8gZG93bmxhb2QgYW5kIGF0dGFjaCBpdCBhcyBhIGZpbGUuXG4vLyBXZSByb3VuZCBkb3duIHRvIGJlIHNhZmUuXG4vLyByZWYgaHR0cHM6Ly9naXRodWIuY29tL2dpdGh1Yi9pc3N1ZXMvaXNzdWVzLzEyODU4XG5cbmNvbnN0IE1BWF9FWFRFTlNJT05fREFUQV9MRU5HVEggPSA2MDAwMDtcblxuaW50ZXJmYWNlIFNlYXJjaFJlc3VsdCB7XG5cdGh0bWxfdXJsOiBzdHJpbmc7XG5cdHRpdGxlOiBzdHJpbmc7XG5cdHN0YXRlPzogc3RyaW5nO1xufVxuXG5lbnVtIElzc3VlU291cmNlIHtcblx0VlNDb2RlID0gJ3ZzY29kZScsXG5cdEV4dGVuc2lvbiA9ICdleHRlbnNpb24nLFxuXHRNYXJrZXRwbGFjZSA9ICdtYXJrZXRwbGFjZScsXG5cdFVua25vd24gPSAndW5rbm93bidcbn1cblxuXG5leHBvcnQgY2xhc3MgQmFzZUlzc3VlUmVwb3J0ZXJTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHB1YmxpYyBpc3N1ZVJlcG9ydGVyTW9kZWw6IElzc3VlUmVwb3J0ZXJNb2RlbDtcblx0cHVibGljIHJlY2VpdmVkU3lzdGVtSW5mbyA9IGZhbHNlO1xuXHRwdWJsaWMgbnVtYmVyT2ZTZWFyY2hSZXN1bHRzRGlzcGxheWVkID0gMDtcblx0cHVibGljIHJlY2VpdmVkUGVyZm9ybWFuY2VJbmZvID0gZmFsc2U7XG5cdHB1YmxpYyBzaG91bGRRdWV1ZVNlYXJjaCA9IGZhbHNlO1xuXHRwdWJsaWMgaGFzQmVlblN1Ym1pdHRlZCA9IGZhbHNlO1xuXHRwdWJsaWMgb3BlblJlcG9ydGVyID0gZmFsc2U7XG5cdHB1YmxpYyBsb2FkaW5nRXh0ZW5zaW9uRGF0YSA9IGZhbHNlO1xuXHRwdWJsaWMgc2VsZWN0ZWRFeHRlbnNpb24gPSAnJztcblx0cHVibGljIGRlbGF5ZWRTdWJtaXQgPSBuZXcgRGVsYXllcjx2b2lkPigzMDApO1xuXHRwdWJsaWMgcHJldmlld0J1dHRvbiE6IEJ1dHRvbjtcblx0cHVibGljIG5vbkdpdEh1Yklzc3VlVXJsID0gZmFsc2U7XG5cdHB1YmxpYyBuZWVkc1VwZGF0ZSA9IGZhbHNlO1xuXHRwdWJsaWMgYWNrbm93bGVkZ2VkID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIGRpc2FibGVFeHRlbnNpb25zOiBib29sZWFuLFxuXHRcdHB1YmxpYyBkYXRhOiBJc3N1ZVJlcG9ydGVyRGF0YSxcblx0XHRwdWJsaWMgb3M6IHtcblx0XHRcdHR5cGU6IHN0cmluZztcblx0XHRcdGFyY2g6IHN0cmluZztcblx0XHRcdHJlbGVhc2U6IHN0cmluZztcblx0XHR9LFxuXHRcdHB1YmxpYyBwcm9kdWN0OiBJUHJvZHVjdENvbmZpZ3VyYXRpb24sXG5cdFx0cHVibGljIHJlYWRvbmx5IHdpbmRvdzogV2luZG93LFxuXHRcdHB1YmxpYyByZWFkb25seSBpc1dlYjogYm9vbGVhbixcblx0XHRASUlzc3VlRm9ybVNlcnZpY2UgcHVibGljIHJlYWRvbmx5IGlzc3VlRm9ybVNlcnZpY2U6IElJc3N1ZUZvcm1TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHB1YmxpYyByZWFkb25seSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwdWJsaWMgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUZpbGVEaWFsb2dTZXJ2aWNlIHB1YmxpYyByZWFkb25seSBmaWxlRGlhbG9nU2VydmljZTogSUZpbGVEaWFsb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdGNvbnN0IHRhcmdldEV4dGVuc2lvbiA9IGRhdGEuZXh0ZW5zaW9uSWQgPyBkYXRhLmVuYWJsZWRFeHRlbnNpb25zLmZpbmQoZXh0ZW5zaW9uID0+IGV4dGVuc2lvbi5pZC50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBkYXRhLmV4dGVuc2lvbklkPy50b0xvY2FsZUxvd2VyQ2FzZSgpKSA6IHVuZGVmaW5lZDtcblx0XHR0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbCA9IG5ldyBJc3N1ZVJlcG9ydGVyTW9kZWwoe1xuXHRcdFx0Li4uZGF0YSxcblx0XHRcdGlzc3VlVHlwZTogZGF0YS5pc3N1ZVR5cGUgfHwgSXNzdWVUeXBlLkJ1Zyxcblx0XHRcdHZlcnNpb25JbmZvOiB7XG5cdFx0XHRcdHZzY29kZVZlcnNpb246IGAke3Byb2R1Y3QubmFtZVNob3J0fSAkeyEhcHJvZHVjdC5kYXJ3aW5Vbml2ZXJzYWxBc3NldElkID8gYCR7cHJvZHVjdC52ZXJzaW9ufSAoVW5pdmVyc2FsKWAgOiBwcm9kdWN0LnZlcnNpb259ICgke3Byb2R1Y3QuY29tbWl0IHx8ICdDb21taXQgdW5rbm93bid9LCAke3Byb2R1Y3QuZGF0ZSB8fCAnRGF0ZSB1bmtub3duJ30pYCxcblx0XHRcdFx0b3M6IGAke3RoaXMub3MudHlwZX0gJHt0aGlzLm9zLmFyY2h9ICR7dGhpcy5vcy5yZWxlYXNlfSR7aXNMaW51eFNuYXAgPyAnIHNuYXAnIDogJyd9YFxuXHRcdFx0fSxcblx0XHRcdGV4dGVuc2lvbnNEaXNhYmxlZDogISF0aGlzLmRpc2FibGVFeHRlbnNpb25zLFxuXHRcdFx0ZmlsZU9uRXh0ZW5zaW9uOiBkYXRhLmV4dGVuc2lvbklkID8gIXRhcmdldEV4dGVuc2lvbj8uaXNCdWlsdGluIDogdW5kZWZpbmVkLFxuXHRcdFx0c2VsZWN0ZWRFeHRlbnNpb246IHRhcmdldEV4dGVuc2lvblxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZmlsZU9uTWFya2V0cGxhY2UgPSBkYXRhLmlzc3VlU291cmNlID09PSBJc3N1ZVNvdXJjZS5NYXJrZXRwbGFjZTtcblx0XHRjb25zdCBmaWxlT25Qcm9kdWN0ID0gZGF0YS5pc3N1ZVNvdXJjZSA9PT0gSXNzdWVTb3VyY2UuVlNDb2RlO1xuXHRcdHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLnVwZGF0ZSh7IGZpbGVPbk1hcmtldHBsYWNlLCBmaWxlT25Qcm9kdWN0IH0pO1xuXG5cdFx0Ly9UT0RPOiBIYW5kbGUgY2FzZSB3aGVyZSBleHRlbnNpb24gaXMgbm90IGFjdGl2YXRlZFxuXHRcdGNvbnN0IGlzc3VlUmVwb3J0ZXJFbGVtZW50ID0gdGhpcy5nZXRFbGVtZW50QnlJZCgnaXNzdWUtcmVwb3J0ZXInKTtcblx0XHRpZiAoaXNzdWVSZXBvcnRlckVsZW1lbnQpIHtcblx0XHRcdHRoaXMucHJldmlld0J1dHRvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCdXR0b24oaXNzdWVSZXBvcnRlckVsZW1lbnQsIHVudGhlbWVkQnV0dG9uU3R5bGVzKSk7XG5cdFx0XHRjb25zdCBpc3N1ZVJlcG9OYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuXHRcdFx0aXNzdWVSZXBvcnRlckVsZW1lbnQuYXBwZW5kQ2hpbGQoaXNzdWVSZXBvTmFtZSk7XG5cdFx0XHRpc3N1ZVJlcG9OYW1lLmlkID0gJ3Nob3ctcmVwby1uYW1lJztcblx0XHRcdGlzc3VlUmVwb05hbWUuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG5cdFx0XHR0aGlzLnVwZGF0ZVByZXZpZXdCdXR0b25TdGF0ZSgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzc3VlVGl0bGUgPSBkYXRhLmlzc3VlVGl0bGU7XG5cdFx0aWYgKGlzc3VlVGl0bGUpIHtcblx0XHRcdGNvbnN0IGlzc3VlVGl0bGVFbGVtZW50ID0gdGhpcy5nZXRFbGVtZW50QnlJZDxIVE1MSW5wdXRFbGVtZW50PignaXNzdWUtdGl0bGUnKTtcblx0XHRcdGlmIChpc3N1ZVRpdGxlRWxlbWVudCkge1xuXHRcdFx0XHRpc3N1ZVRpdGxlRWxlbWVudC52YWx1ZSA9IGlzc3VlVGl0bGU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNzdWVCb2R5ID0gZGF0YS5pc3N1ZUJvZHk7XG5cdFx0aWYgKGlzc3VlQm9keSkge1xuXHRcdFx0Y29uc3QgZGVzY3JpcHRpb24gPSB0aGlzLmdldEVsZW1lbnRCeUlkPEhUTUxUZXh0QXJlYUVsZW1lbnQ+KCdkZXNjcmlwdGlvbicpO1xuXHRcdFx0aWYgKGRlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uLnZhbHVlID0gaXNzdWVCb2R5O1xuXHRcdFx0XHR0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC51cGRhdGUoeyBpc3N1ZURlc2NyaXB0aW9uOiBpc3N1ZUJvZHkgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMud2luZG93LmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5sYW5nICE9PSAnZW4nKSB7XG5cdFx0XHRzaG93KHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2VuZ2xpc2gnKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29kaWNvblN0eWxlU2hlZXQgPSBjcmVhdGVTdHlsZVNoZWV0KCk7XG5cdFx0Y29kaWNvblN0eWxlU2hlZXQuaWQgPSAnY29kaWNvblN0eWxlcyc7XG5cblx0XHRjb25zdCBpY29uc1N0eWxlU2hlZXQgPSB0aGlzLl9yZWdpc3RlcihnZXRJY29uc1N0eWxlU2hlZXQodGhpcy50aGVtZVNlcnZpY2UpKTtcblx0XHRmdW5jdGlvbiB1cGRhdGVBbGwoKSB7XG5cdFx0XHRjb2RpY29uU3R5bGVTaGVldC50ZXh0Q29udGVudCA9IGljb25zU3R5bGVTaGVldC5nZXRDU1MoKTtcblx0XHR9XG5cblx0XHRjb25zdCBkZWxheWVyID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIodXBkYXRlQWxsLCAwKTtcblx0XHR0aGlzLl9yZWdpc3RlcihpY29uc1N0eWxlU2hlZXQub25EaWRDaGFuZ2UoKCkgPT4gZGVsYXllci5zY2hlZHVsZSgpKSk7XG5cdFx0ZGVsYXllci5zY2hlZHVsZSgpO1xuXG5cdFx0dGhpcy5oYW5kbGVFeHRlbnNpb25EYXRhKGRhdGEuZW5hYmxlZEV4dGVuc2lvbnMpO1xuXHRcdHRoaXMuc2V0VXBUeXBlcygpO1xuXHRcdHRoaXMuYXBwbHlTdHlsZXMoZGF0YS5zdHlsZXMpO1xuXG5cdFx0Ly8gSGFuZGxlIGNhc2Ugd2hlcmUgZXh0ZW5zaW9uIGlzIHByZS1zZWxlY3RlZCB0aHJvdWdoIHRoZSBjb21tYW5kXG5cdFx0aWYgKChkYXRhLmRhdGEgfHwgZGF0YS51cmkpICYmIHRhcmdldEV4dGVuc2lvbikge1xuXHRcdFx0dGhpcy51cGRhdGVFeHRlbnNpb25TdGF0dXModGFyZ2V0RXh0ZW5zaW9uKTtcblx0XHR9XG5cdH1cblxuXHRyZW5kZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5yZW5kZXJCbG9ja3MoKTtcblx0fVxuXG5cdHNldEluaXRpYWxGb2N1cygpIHtcblx0XHRjb25zdCB7IGZpbGVPbkV4dGVuc2lvbiB9ID0gdGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZ2V0RGF0YSgpO1xuXHRcdGlmIChmaWxlT25FeHRlbnNpb24pIHtcblx0XHRcdGNvbnN0IGlzc3VlVGl0bGUgPSB0aGlzLndpbmRvdy5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaXNzdWUtdGl0bGUnKTtcblx0XHRcdGlzc3VlVGl0bGU/LmZvY3VzKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGlzc3VlVHlwZSA9IHRoaXMud2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpc3N1ZS10eXBlJyk7XG5cdFx0XHRpc3N1ZVR5cGU/LmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gVE9ETyBAanVzdHNjaGVuOiBBZnRlciBtaWdyYXRpb24gdG8gQXV4IFdpbmRvdywgc3dpdGNoIHRvIGRlZGljYXRlZCBjc3MuXG5cdHByaXZhdGUgYXBwbHlTdHlsZXMoc3R5bGVzOiBJc3N1ZVJlcG9ydGVyU3R5bGVzKSB7XG5cdFx0Y29uc3Qgc3R5bGVUYWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuXHRcdGNvbnN0IGNvbnRlbnQ6IHN0cmluZ1tdID0gW107XG5cblx0XHRpZiAoc3R5bGVzLmlucHV0QmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGBpbnB1dFt0eXBlPVwidGV4dFwiXSwgdGV4dGFyZWEsIHNlbGVjdCwgLmlzc3Vlcy1jb250YWluZXIgPiAuaXNzdWUgPiAuaXNzdWUtc3RhdGUsIC5ibG9jay1pbmZvIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMuaW5wdXRCYWNrZ3JvdW5kfSAhaW1wb3J0YW50OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5iYWNrZ3JvdW5kQ29sb3IpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby13b3JrYmVuY2ggeyBiYWNrZ3JvdW5kLWNvbG9yOiAke3N0eWxlcy5iYWNrZ3JvdW5kQ29sb3J9ICFpbXBvcnRhbnQ7IH1gKTtcblx0XHRcdGNvbnRlbnQucHVzaChgLmlzc3VlLXJlcG9ydGVyLWJvZHk6Oi13ZWJraXQtc2Nyb2xsYmFyLXRyYWNrIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMuYmFja2dyb3VuZENvbG9yfTsgfWApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMuaW5wdXRCb3JkZXIpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgaW5wdXRbdHlwZT1cInRleHRcIl0sIHRleHRhcmVhLCBzZWxlY3QgeyBib3JkZXI6IDFweCBzb2xpZCAke3N0eWxlcy5pbnB1dEJvcmRlcn07IH1gKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29udGVudC5wdXNoKGBpbnB1dFt0eXBlPVwidGV4dFwiXSwgdGV4dGFyZWEsIHNlbGVjdCB7IGJvcmRlcjogMXB4IHNvbGlkIHRyYW5zcGFyZW50OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5pbnB1dEZvcmVncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgaW5wdXRbdHlwZT1cInRleHRcIl0sIHRleHRhcmVhLCBzZWxlY3QsIC5pc3N1ZXMtY29udGFpbmVyID4gLmlzc3VlID4gLmlzc3VlLXN0YXRlLCAuYmxvY2staW5mbyB7IGNvbG9yOiAke3N0eWxlcy5pbnB1dEZvcmVncm91bmR9ICFpbXBvcnRhbnQ7IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmlucHV0RXJyb3JCb3JkZXIpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLmludmFsaWQtaW5wdXQsIC5pbnZhbGlkLWlucHV0OmZvY3VzLCAudmFsaWRhdGlvbi1lcnJvciB7IGJvcmRlcjogMXB4IHNvbGlkICR7c3R5bGVzLmlucHV0RXJyb3JCb3JkZXJ9ICFpbXBvcnRhbnQ7IH1gKTtcblx0XHRcdGNvbnRlbnQucHVzaChgLnJlcXVpcmVkLWlucHV0IHsgY29sb3I6ICR7c3R5bGVzLmlucHV0RXJyb3JCb3JkZXJ9OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5pbnB1dEVycm9yQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAudmFsaWRhdGlvbi1lcnJvciB7IGJhY2tncm91bmQ6ICR7c3R5bGVzLmlucHV0RXJyb3JCYWNrZ3JvdW5kfTsgfWApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMuaW5wdXRFcnJvckZvcmVncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLnZhbGlkYXRpb24tZXJyb3IgeyBjb2xvcjogJHtzdHlsZXMuaW5wdXRFcnJvckZvcmVncm91bmR9OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5pbnB1dEFjdGl2ZUJvcmRlcikge1xuXHRcdFx0Y29udGVudC5wdXNoKGBpbnB1dFt0eXBlPSd0ZXh0J106Zm9jdXMsIHRleHRhcmVhOmZvY3VzLCBzZWxlY3Q6Zm9jdXMsIHN1bW1hcnk6Zm9jdXMsIGJ1dHRvbjpmb2N1cywgYTpmb2N1cywgLndvcmtiZW5jaENvbW1hbmQ6Zm9jdXMgIHsgYm9yZGVyOiAxcHggc29saWQgJHtzdHlsZXMuaW5wdXRBY3RpdmVCb3JkZXJ9OyBvdXRsaW5lLXN0eWxlOiBub25lOyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy50ZXh0TGlua0NvbG9yKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYGEsIC53b3JrYmVuY2hDb21tYW5kIHsgY29sb3I6ICR7c3R5bGVzLnRleHRMaW5rQ29sb3J9OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy50ZXh0TGlua0NvbG9yKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYGEgeyBjb2xvcjogJHtzdHlsZXMudGV4dExpbmtDb2xvcn07IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLnRleHRMaW5rQWN0aXZlRm9yZWdyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGBhOmhvdmVyLCAud29ya2JlbmNoQ29tbWFuZDpob3ZlciB7IGNvbG9yOiAke3N0eWxlcy50ZXh0TGlua0FjdGl2ZUZvcmVncm91bmR9OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5zbGlkZXJBY3RpdmVDb2xvcikge1xuXHRcdFx0Y29udGVudC5wdXNoKGAuaXNzdWUtcmVwb3J0ZXItYm9keTo6LXdlYmtpdC1zY3JvbGxiYXItdGh1bWI6YWN0aXZlIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMuc2xpZGVyQWN0aXZlQ29sb3J9OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5zbGlkZXJIb3ZlckNvbG9yKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5pc3N1ZS1yZXBvcnRlci1ib2R5Ojotd2Via2l0LXNjcm9sbGJhci10aHVtYiB7IGJhY2tncm91bmQtY29sb3I6ICR7c3R5bGVzLnNsaWRlckhvdmVyQ29sb3J9OyB9YCk7XG5cdFx0XHRjb250ZW50LnB1c2goYC5pc3N1ZS1yZXBvcnRlci1ib2R5OjotLXdlYmtpdC1zY3JvbGxiYXItdGh1bWI6aG92ZXIgeyBiYWNrZ3JvdW5kLWNvbG9yOiAke3N0eWxlcy5zbGlkZXJIb3ZlckNvbG9yfTsgfWApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMuYnV0dG9uQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLXRleHQtYnV0dG9uIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMuYnV0dG9uQmFja2dyb3VuZH0gIWltcG9ydGFudDsgfWApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMuYnV0dG9uRm9yZWdyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLXRleHQtYnV0dG9uIHsgY29sb3I6ICR7c3R5bGVzLmJ1dHRvbkZvcmVncm91bmR9ICFpbXBvcnRhbnQ7IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmJ1dHRvbkhvdmVyQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLXRleHQtYnV0dG9uOm5vdCguZGlzYWJsZWQpOmhvdmVyLCAubW9uYWNvLXRleHQtYnV0dG9uOmZvY3VzIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMuYnV0dG9uSG92ZXJCYWNrZ3JvdW5kfSAhaW1wb3J0YW50OyB9YCk7XG5cdFx0fVxuXG5cdFx0c3R5bGVUYWcudGV4dENvbnRlbnQgPSBjb250ZW50LmpvaW4oJ1xcbicpO1xuXHRcdHRoaXMud2luZG93LmRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGVUYWcpO1xuXHRcdHRoaXMud2luZG93LmRvY3VtZW50LmJvZHkuc3R5bGUuY29sb3IgPSBzdHlsZXMuY29sb3IgfHwgJyc7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZUlzc3VlUmVwb3J0ZXJVcmkoZXh0ZW5zaW9uOiBJc3N1ZVJlcG9ydGVyRXh0ZW5zaW9uRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uLnVyaSkge1xuXHRcdFx0XHRjb25zdCB1cmkgPSBVUkkucmV2aXZlKGV4dGVuc2lvbi51cmkpO1xuXHRcdFx0XHRleHRlbnNpb24uYnVnc1VybCA9IHVyaS50b1N0cmluZygpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMucmVuZGVyQmxvY2tzKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVFeHRlbnNpb25EYXRhKGV4dGVuc2lvbnM6IElzc3VlUmVwb3J0ZXJFeHRlbnNpb25EYXRhW10pIHtcblx0XHRjb25zdCBpbnN0YWxsZWRFeHRlbnNpb25zID0gZXh0ZW5zaW9ucy5maWx0ZXIoeCA9PiAheC5pc0J1aWx0aW4pO1xuXHRcdGNvbnN0IHsgbm9uVGhlbWVzLCB0aGVtZXMgfSA9IGdyb3VwQnkoaW5zdGFsbGVkRXh0ZW5zaW9ucywgZXh0ID0+IHtcblx0XHRcdHJldHVybiBleHQuaXNUaGVtZSA/ICd0aGVtZXMnIDogJ25vblRoZW1lcyc7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBudW1iZXJPZlRoZW1lRXh0ZXNpb25zID0gdGhlbWVzICYmIHRoZW1lcy5sZW5ndGg7XG5cdFx0dGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwudXBkYXRlKHsgbnVtYmVyT2ZUaGVtZUV4dGVzaW9ucywgZW5hYmxlZE5vblRoZW1lRXh0ZXNpb25zOiBub25UaGVtZXMsIGFsbEV4dGVuc2lvbnM6IGluc3RhbGxlZEV4dGVuc2lvbnMgfSk7XG5cdFx0dGhpcy51cGRhdGVFeHRlbnNpb25UYWJsZShub25UaGVtZXMsIG51bWJlck9mVGhlbWVFeHRlc2lvbnMpO1xuXHRcdGlmICh0aGlzLmRpc2FibGVFeHRlbnNpb25zIHx8IGluc3RhbGxlZEV4dGVuc2lvbnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHQoPEhUTUxCdXR0b25FbGVtZW50PnRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2Rpc2FibGVFeHRlbnNpb25zJykpLmRpc2FibGVkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZUV4dGVuc2lvblNlbGVjdG9yKGluc3RhbGxlZEV4dGVuc2lvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVFeHRlbnNpb25TZWxlY3RvcihleHRlbnNpb25zOiBJc3N1ZVJlcG9ydGVyRXh0ZW5zaW9uRGF0YVtdKTogdm9pZCB7XG5cdFx0aW50ZXJmYWNlIElPcHRpb24ge1xuXHRcdFx0bmFtZTogc3RyaW5nO1xuXHRcdFx0aWQ6IHN0cmluZztcblx0XHR9XG5cblx0XHRjb25zdCBleHRlbnNpb25PcHRpb25zOiBJT3B0aW9uW10gPSBleHRlbnNpb25zLm1hcChleHRlbnNpb24gPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bmFtZTogZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5uYW1lIHx8ICcnLFxuXHRcdFx0XHRpZDogZXh0ZW5zaW9uLmlkXG5cdFx0XHR9O1xuXHRcdH0pO1xuXG5cdFx0Ly8gU29ydCBleHRlbnNpb25zIGJ5IG5hbWVcblx0XHRleHRlbnNpb25PcHRpb25zLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGNvbnN0IGFOYW1lID0gYS5uYW1lLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRjb25zdCBiTmFtZSA9IGIubmFtZS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0aWYgKGFOYW1lID4gYk5hbWUpIHtcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhTmFtZSA8IGJOYW1lKSB7XG5cdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBtYWtlT3B0aW9uID0gKGV4dGVuc2lvbjogSU9wdGlvbiwgc2VsZWN0ZWRFeHRlbnNpb24/OiBJc3N1ZVJlcG9ydGVyRXh0ZW5zaW9uRGF0YSk6IEhUTUxPcHRpb25FbGVtZW50ID0+IHtcblx0XHRcdGNvbnN0IHNlbGVjdGVkID0gc2VsZWN0ZWRFeHRlbnNpb24gJiYgZXh0ZW5zaW9uLmlkID09PSBzZWxlY3RlZEV4dGVuc2lvbi5pZDtcblx0XHRcdHJldHVybiAkPEhUTUxPcHRpb25FbGVtZW50Pignb3B0aW9uJywge1xuXHRcdFx0XHQndmFsdWUnOiBleHRlbnNpb24uaWQsXG5cdFx0XHRcdCdzZWxlY3RlZCc6IHNlbGVjdGVkIHx8ICcnXG5cdFx0XHR9LCBleHRlbnNpb24ubmFtZSk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbnNTZWxlY3RvciA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQ8SFRNTFNlbGVjdEVsZW1lbnQ+KCdleHRlbnNpb24tc2VsZWN0b3InKTtcblx0XHRpZiAoZXh0ZW5zaW9uc1NlbGVjdG9yKSB7XG5cdFx0XHRjb25zdCB7IHNlbGVjdGVkRXh0ZW5zaW9uIH0gPSB0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC5nZXREYXRhKCk7XG5cdFx0XHRyZXNldChleHRlbnNpb25zU2VsZWN0b3IsIHRoaXMubWFrZU9wdGlvbignJywgbG9jYWxpemUoJ3NlbGVjdEV4dGVuc2lvbicsIFwiU2VsZWN0IGV4dGVuc2lvblwiKSwgdHJ1ZSksIC4uLmV4dGVuc2lvbk9wdGlvbnMubWFwKGV4dGVuc2lvbiA9PiBtYWtlT3B0aW9uKGV4dGVuc2lvbiwgc2VsZWN0ZWRFeHRlbnNpb24pKSk7XG5cblx0XHRcdGlmICghc2VsZWN0ZWRFeHRlbnNpb24pIHtcblx0XHRcdFx0ZXh0ZW5zaW9uc1NlbGVjdG9yLnNlbGVjdGVkSW5kZXggPSAwO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2V4dGVuc2lvbi1zZWxlY3RvcicsICdjaGFuZ2UnLCBhc3luYyAoZTogRXZlbnQpID0+IHtcblx0XHRcdFx0dGhpcy5jbGVhckV4dGVuc2lvbkRhdGEoKTtcblx0XHRcdFx0Y29uc3Qgc2VsZWN0ZWRFeHRlbnNpb25JZCA9ICg8SFRNTElucHV0RWxlbWVudD5lLnRhcmdldCkudmFsdWU7XG5cdFx0XHRcdHRoaXMuc2VsZWN0ZWRFeHRlbnNpb24gPSBzZWxlY3RlZEV4dGVuc2lvbklkO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25zID0gdGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZ2V0RGF0YSgpLmFsbEV4dGVuc2lvbnM7XG5cdFx0XHRcdGNvbnN0IG1hdGNoZXMgPSBleHRlbnNpb25zLmZpbHRlcihleHRlbnNpb24gPT4gZXh0ZW5zaW9uLmlkID09PSBzZWxlY3RlZEV4dGVuc2lvbklkKTtcblx0XHRcdFx0aWYgKG1hdGNoZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwudXBkYXRlKHsgc2VsZWN0ZWRFeHRlbnNpb246IG1hdGNoZXNbMF0gfSk7XG5cdFx0XHRcdFx0Y29uc3Qgc2VsZWN0ZWRFeHRlbnNpb24gPSB0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC5nZXREYXRhKCkuc2VsZWN0ZWRFeHRlbnNpb247XG5cdFx0XHRcdFx0aWYgKHNlbGVjdGVkRXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBpY29uRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0XHRcdFx0XHRcdGljb25FbGVtZW50LmNsYXNzTGlzdC5hZGQoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoQ29kaWNvbi5sb2FkaW5nKSwgJ2NvZGljb24tbW9kaWZpZXItc3BpbicpO1xuXHRcdFx0XHRcdFx0dGhpcy5zZXRMb2FkaW5nKGljb25FbGVtZW50KTtcblx0XHRcdFx0XHRcdGNvbnN0IG9wZW5SZXBvcnRlckRhdGEgPSBhd2FpdCB0aGlzLnNlbmRSZXBvcnRlck1lbnUoc2VsZWN0ZWRFeHRlbnNpb24pO1xuXHRcdFx0XHRcdFx0aWYgKG9wZW5SZXBvcnRlckRhdGEpIHtcblx0XHRcdFx0XHRcdFx0aWYgKHRoaXMuc2VsZWN0ZWRFeHRlbnNpb24gPT09IHNlbGVjdGVkRXh0ZW5zaW9uSWQpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnJlbW92ZUxvYWRpbmcoaWNvbkVsZW1lbnQsIHRydWUpO1xuXHRcdFx0XHRcdFx0XHRcdC8vIHRoaXMuY29uZmlndXJhdGlvbi5kYXRhID0gb3BlblJlcG9ydGVyRGF0YTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmRhdGEgPSBvcGVuUmVwb3J0ZXJEYXRhO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdC8vIGVsc2UgaWYgKHRoaXMuc2VsZWN0ZWRFeHRlbnNpb24gIT09IHNlbGVjdGVkRXh0ZW5zaW9uSWQpIHtcblx0XHRcdFx0XHRcdFx0Ly8gfVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGlmICghdGhpcy5sb2FkaW5nRXh0ZW5zaW9uRGF0YSkge1xuXHRcdFx0XHRcdFx0XHRcdGljb25FbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoQ29kaWNvbi5sb2FkaW5nKSwgJ2NvZGljb24tbW9kaWZpZXItc3BpbicpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTG9hZGluZyhpY29uRWxlbWVudCk7XG5cdFx0XHRcdFx0XHRcdC8vIGlmIG5vdCB1c2luZyBjb21tYW5kLCBzaG91bGQgaGF2ZSBubyBjb25maWd1cmF0aW9uIGRhdGEgaW4gZmllbGRzIHdlIGNhcmUgYWJvdXQgYW5kIGNoZWNrIGxhdGVyLlxuXHRcdFx0XHRcdFx0XHR0aGlzLmNsZWFyRXh0ZW5zaW9uRGF0YSgpO1xuXG5cdFx0XHRcdFx0XHRcdC8vIGNhc2Ugd2hlbiBwcmV2aW91cyBleHRlbnNpb24gd2FzIG9wZW5lZCBmcm9tIG5vcm1hbCBvcGVuSXNzdWVSZXBvcnRlciBjb21tYW5kXG5cdFx0XHRcdFx0XHRcdHNlbGVjdGVkRXh0ZW5zaW9uLmRhdGEgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRcdHNlbGVjdGVkRXh0ZW5zaW9uLnVyaSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICh0aGlzLnNlbGVjdGVkRXh0ZW5zaW9uID09PSBzZWxlY3RlZEV4dGVuc2lvbklkKSB7XG5cdFx0XHRcdFx0XHRcdC8vIHJlcG9wdWxhdGVzIHRoZSBmaWVsZHMgd2l0aCB0aGUgbmV3IGRhdGEgZ2l2ZW4gdGhlIHNlbGVjdGVkIGV4dGVuc2lvbi5cblx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGVFeHRlbnNpb25TdGF0dXMobWF0Y2hlc1swXSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMub3BlblJlcG9ydGVyID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLnVwZGF0ZSh7IHNlbGVjdGVkRXh0ZW5zaW9uOiB1bmRlZmluZWQgfSk7XG5cdFx0XHRcdFx0XHR0aGlzLmNsZWFyU2VhcmNoUmVzdWx0cygpO1xuXHRcdFx0XHRcdFx0dGhpcy5jbGVhckV4dGVuc2lvbkRhdGEoKTtcblx0XHRcdFx0XHRcdHRoaXMudmFsaWRhdGVTZWxlY3RlZEV4dGVuc2lvbigpO1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVFeHRlbnNpb25TdGF0dXMobWF0Y2hlc1swXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2JsZW0tc291cmNlJywgJ2NoYW5nZScsIChfKSA9PiB7XG5cdFx0XHR0aGlzLmNsZWFyRXh0ZW5zaW9uRGF0YSgpO1xuXHRcdFx0dGhpcy52YWxpZGF0ZVNlbGVjdGVkRXh0ZW5zaW9uKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNlbmRSZXBvcnRlck1lbnUoZXh0ZW5zaW9uOiBJc3N1ZVJlcG9ydGVyRXh0ZW5zaW9uRGF0YSk6IFByb21pc2U8SXNzdWVSZXBvcnRlckRhdGEgfCB1bmRlZmluZWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuaXNzdWVGb3JtU2VydmljZS5zZW5kUmVwb3J0ZXJNZW51KGV4dGVuc2lvbi5pZCk7XG5cdFx0XHRyZXR1cm4gZGF0YTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGUpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUFja25vd2xlZGdlbWVudFN0YXRlKCkge1xuXHRcdGNvbnN0IGFja25vd2xlZGdlbWVudENoZWNrYm94ID0gdGhpcy5nZXRFbGVtZW50QnlJZDxIVE1MSW5wdXRFbGVtZW50PignaW5jbHVkZUFja25vd2xlZGdlbWVudCcpO1xuXHRcdGlmIChhY2tub3dsZWRnZW1lbnRDaGVja2JveCkge1xuXHRcdFx0dGhpcy5hY2tub3dsZWRnZWQgPSBhY2tub3dsZWRnZW1lbnRDaGVja2JveC5jaGVja2VkO1xuXHRcdFx0dGhpcy51cGRhdGVQcmV2aWV3QnV0dG9uU3RhdGUoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc2V0RXZlbnRIYW5kbGVycygpOiB2b2lkIHtcblx0XHQoWydpbmNsdWRlU3lzdGVtSW5mbycsICdpbmNsdWRlUHJvY2Vzc0luZm8nLCAnaW5jbHVkZVdvcmtzcGFjZUluZm8nLCAnaW5jbHVkZUV4dGVuc2lvbnMnLCAnaW5jbHVkZUV4cGVyaW1lbnRzJywgJ2luY2x1ZGVFeHRlbnNpb25EYXRhJ10gYXMgY29uc3QpLmZvckVhY2goZWxlbWVudElkID0+IHtcblx0XHRcdHRoaXMuYWRkRXZlbnRMaXN0ZW5lcihlbGVtZW50SWQsICdjbGljaycsIChldmVudDogRXZlbnQpID0+IHtcblx0XHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLnVwZGF0ZSh7IFtlbGVtZW50SWRdOiAhdGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZ2V0RGF0YSgpW2VsZW1lbnRJZF0gfSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignaW5jbHVkZUFja25vd2xlZGdlbWVudCcsICdjbGljaycsIChldmVudDogRXZlbnQpID0+IHtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0dGhpcy51cGRhdGVBY2tub3dsZWRnZW1lbnRTdGF0ZSgpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgc2hvd0luZm9FbGVtZW50cyA9IHRoaXMud2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3Nob3dJbmZvJyk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzaG93SW5mb0VsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBzaG93SW5mbyA9IHNob3dJbmZvRWxlbWVudHMuaXRlbShpKSE7XG5cdFx0XHQoc2hvd0luZm8gYXMgSFRNTEFuY2hvckVsZW1lbnQpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRjb25zdCBsYWJlbCA9ICg8SFRNTERpdkVsZW1lbnQ+ZS50YXJnZXQpO1xuXHRcdFx0XHRpZiAobGFiZWwpIHtcblx0XHRcdFx0XHRjb25zdCBjb250YWluaW5nRWxlbWVudCA9IGxhYmVsLnBhcmVudEVsZW1lbnQgJiYgbGFiZWwucGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50O1xuXHRcdFx0XHRcdGNvbnN0IGluZm8gPSBjb250YWluaW5nRWxlbWVudCAmJiBjb250YWluaW5nRWxlbWVudC5sYXN0RWxlbWVudENoaWxkO1xuXHRcdFx0XHRcdGlmIChpbmZvICYmIGluZm8uY2xhc3NMaXN0LmNvbnRhaW5zKCdoaWRkZW4nKSkge1xuXHRcdFx0XHRcdFx0c2hvdyhpbmZvKTtcblx0XHRcdFx0XHRcdGxhYmVsLnRleHRDb250ZW50ID0gbG9jYWxpemUoJ2hpZGUnLCBcImhpZGVcIik7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGhpZGUoaW5mbyk7XG5cdFx0XHRcdFx0XHRsYWJlbC50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdzaG93JywgXCJzaG93XCIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5hZGRFdmVudExpc3RlbmVyKCdpc3N1ZS1zb3VyY2UnLCAnY2hhbmdlJywgKGU6IEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9ICg8SFRNTElucHV0RWxlbWVudD5lLnRhcmdldCkudmFsdWU7XG5cdFx0XHRjb25zdCBwcm9ibGVtU291cmNlSGVscFRleHQgPSB0aGlzLmdldEVsZW1lbnRCeUlkKCdwcm9ibGVtLXNvdXJjZS1oZWxwLXRleHQnKSE7XG5cdFx0XHRpZiAodmFsdWUgPT09ICcnKSB7XG5cdFx0XHRcdHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLnVwZGF0ZSh7IGZpbGVPbkV4dGVuc2lvbjogdW5kZWZpbmVkIH0pO1xuXHRcdFx0XHRzaG93KHByb2JsZW1Tb3VyY2VIZWxwVGV4dCk7XG5cdFx0XHRcdHRoaXMuY2xlYXJTZWFyY2hSZXN1bHRzKCk7XG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGhpZGUocHJvYmxlbVNvdXJjZUhlbHBUZXh0KTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGVzY3JpcHRpb25UZXh0QXJlYSA9IDxIVE1MSW5wdXRFbGVtZW50PnRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2lzc3VlLXRpdGxlJyk7XG5cdFx0XHRpZiAodmFsdWUgPT09IElzc3VlU291cmNlLlZTQ29kZSkge1xuXHRcdFx0XHRkZXNjcmlwdGlvblRleHRBcmVhLnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ3ZzY29kZVBsYWNlaG9sZGVyJywgXCJFLmcgV29ya2JlbmNoIGlzIG1pc3NpbmcgcHJvYmxlbXMgcGFuZWxcIik7XG5cdFx0XHR9IGVsc2UgaWYgKHZhbHVlID09PSBJc3N1ZVNvdXJjZS5FeHRlbnNpb24pIHtcblx0XHRcdFx0ZGVzY3JpcHRpb25UZXh0QXJlYS5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCdleHRlbnNpb25QbGFjZWhvbGRlcicsIFwiRS5nLiBNaXNzaW5nIGFsdCB0ZXh0IG9uIGV4dGVuc2lvbiByZWFkbWUgaW1hZ2VcIik7XG5cdFx0XHR9IGVsc2UgaWYgKHZhbHVlID09PSBJc3N1ZVNvdXJjZS5NYXJrZXRwbGFjZSkge1xuXHRcdFx0XHRkZXNjcmlwdGlvblRleHRBcmVhLnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ21hcmtldHBsYWNlUGxhY2Vob2xkZXInLCBcIkUuZyBDYW5ub3QgZGlzYWJsZSBpbnN0YWxsZWQgZXh0ZW5zaW9uXCIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGVzY3JpcHRpb25UZXh0QXJlYS5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCd1bmRlZmluZWRQbGFjZWhvbGRlcicsIFwiUGxlYXNlIGVudGVyIGEgdGl0bGVcIik7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBmaWxlT25FeHRlbnNpb24sIGZpbGVPbk1hcmtldHBsYWNlID0gZmFsc2U7XG5cdFx0XHRpZiAodmFsdWUgPT09IElzc3VlU291cmNlLkV4dGVuc2lvbikge1xuXHRcdFx0XHRmaWxlT25FeHRlbnNpb24gPSB0cnVlO1xuXHRcdFx0fSBlbHNlIGlmICh2YWx1ZSA9PT0gSXNzdWVTb3VyY2UuTWFya2V0cGxhY2UpIHtcblx0XHRcdFx0ZmlsZU9uTWFya2V0cGxhY2UgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC51cGRhdGUoeyBmaWxlT25FeHRlbnNpb24sIGZpbGVPbk1hcmtldHBsYWNlIH0pO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdFx0Y29uc3QgdGl0bGUgPSAoPEhUTUxJbnB1dEVsZW1lbnQ+dGhpcy5nZXRFbGVtZW50QnlJZCgnaXNzdWUtdGl0bGUnKSkudmFsdWU7XG5cdFx0XHR0aGlzLnNlYXJjaElzc3Vlcyh0aXRsZSwgZmlsZU9uRXh0ZW5zaW9uLCBmaWxlT25NYXJrZXRwbGFjZSk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2Rlc2NyaXB0aW9uJywgJ2lucHV0JywgKGU6IEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBpc3N1ZURlc2NyaXB0aW9uID0gKDxIVE1MSW5wdXRFbGVtZW50PmUudGFyZ2V0KS52YWx1ZTtcblx0XHRcdHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLnVwZGF0ZSh7IGlzc3VlRGVzY3JpcHRpb24gfSk7XG5cblx0XHRcdC8vIE9ubHkgc2VhcmNoIGZvciBleHRlbnNpb24gaXNzdWVzIG9uIHRpdGxlIGNoYW5nZVxuXHRcdFx0aWYgKHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLmZpbGVPbkV4dGVuc2lvbigpID09PSBmYWxzZSkge1xuXHRcdFx0XHRjb25zdCB0aXRsZSA9ICg8SFRNTElucHV0RWxlbWVudD50aGlzLmdldEVsZW1lbnRCeUlkKCdpc3N1ZS10aXRsZScpKS52YWx1ZTtcblx0XHRcdFx0dGhpcy5zZWFyY2hWU0NvZGVJc3N1ZXModGl0bGUsIGlzc3VlRGVzY3JpcHRpb24pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5hZGRFdmVudExpc3RlbmVyKCdpc3N1ZS10aXRsZScsICdpbnB1dCcsIF8gPT4ge1xuXHRcdFx0Y29uc3QgdGl0bGVFbGVtZW50ID0gdGhpcy5nZXRFbGVtZW50QnlJZCgnaXNzdWUtdGl0bGUnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuXHRcdFx0aWYgKHRpdGxlRWxlbWVudCkge1xuXHRcdFx0XHRjb25zdCB0aXRsZSA9IHRpdGxlRWxlbWVudC52YWx1ZTtcblx0XHRcdFx0dGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwudXBkYXRlKHsgaXNzdWVUaXRsZTogdGl0bGUgfSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2lzc3VlLXRpdGxlJywgJ2lucHV0JywgKGU6IEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCB0aXRsZSA9ICg8SFRNTElucHV0RWxlbWVudD5lLnRhcmdldCkudmFsdWU7XG5cdFx0XHRjb25zdCBsZW5ndGhWYWxpZGF0aW9uTWVzc2FnZSA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2lzc3VlLXRpdGxlLWxlbmd0aC12YWxpZGF0aW9uLWVycm9yJyk7XG5cdFx0XHRjb25zdCBpc3N1ZVVybCA9IHRoaXMuZ2V0SXNzdWVVcmwoKTtcblx0XHRcdGlmICh0aXRsZSAmJiB0aGlzLmdldElzc3VlVXJsV2l0aFRpdGxlKHRpdGxlLCBpc3N1ZVVybCkubGVuZ3RoID4gTUFYX1VSTF9MRU5HVEgpIHtcblx0XHRcdFx0c2hvdyhsZW5ndGhWYWxpZGF0aW9uTWVzc2FnZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRoaWRlKGxlbmd0aFZhbGlkYXRpb25NZXNzYWdlKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGlzc3VlU291cmNlID0gdGhpcy5nZXRFbGVtZW50QnlJZDxIVE1MU2VsZWN0RWxlbWVudD4oJ2lzc3VlLXNvdXJjZScpO1xuXHRcdFx0aWYgKCFpc3N1ZVNvdXJjZSB8fCBpc3N1ZVNvdXJjZS52YWx1ZSA9PT0gJycpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB7IGZpbGVPbkV4dGVuc2lvbiwgZmlsZU9uTWFya2V0cGxhY2UgfSA9IHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLmdldERhdGEoKTtcblx0XHRcdHRoaXMuc2VhcmNoSXNzdWVzKHRpdGxlLCBmaWxlT25FeHRlbnNpb24sIGZpbGVPbk1hcmtldHBsYWNlKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucHJldmlld0J1dHRvbi5vbkRpZENsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdHRoaXMuZGVsYXllZFN1Ym1pdC50cmlnZ2VyKGFzeW5jICgpID0+IHtcblx0XHRcdFx0dGhpcy5jcmVhdGVJc3N1ZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5hZGRFdmVudExpc3RlbmVyKCdkaXNhYmxlRXh0ZW5zaW9ucycsICdjbGljaycsICgpID0+IHtcblx0XHRcdHRoaXMuaXNzdWVGb3JtU2VydmljZS5yZWxvYWRXaXRoRXh0ZW5zaW9uc0Rpc2FibGVkKCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2V4dGVuc2lvbkJ1Z3NMaW5rJywgJ2NsaWNrJywgKGU6IEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCB1cmwgPSAoPEhUTUxFbGVtZW50PmUudGFyZ2V0KS5pbm5lclRleHQ7XG5cdFx0XHR3aW5kb3dPcGVuTm9PcGVuZXIodXJsKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignZGlzYWJsZUV4dGVuc2lvbnMnLCAna2V5ZG93bicsIChlOiBFdmVudCkgPT4ge1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdGlmICgoZSBhcyBLZXlib2FyZEV2ZW50KS5rZXkgPT09ICdFbnRlcicgfHwgKGUgYXMgS2V5Ym9hcmRFdmVudCkua2V5ID09PSAnICcpIHtcblx0XHRcdFx0dGhpcy5pc3N1ZUZvcm1TZXJ2aWNlLnJlbG9hZFdpdGhFeHRlbnNpb25zRGlzYWJsZWQoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMud2luZG93LmRvY3VtZW50Lm9ua2V5ZG93biA9IGFzeW5jIChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBjbWRPckN0cmxLZXkgPSBpc01hY2ludG9zaCA/IGUubWV0YUtleSA6IGUuY3RybEtleTtcblx0XHRcdC8vIENtZC9DdHJsK0VudGVyIHByZXZpZXdzIGlzc3VlIGFuZCBjbG9zZXMgd2luZG93XG5cdFx0XHRpZiAoY21kT3JDdHJsS2V5ICYmIGUua2V5ID09PSAnRW50ZXInKSB7XG5cdFx0XHRcdHRoaXMuZGVsYXllZFN1Ym1pdC50cmlnZ2VyKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRpZiAoYXdhaXQgdGhpcy5jcmVhdGVJc3N1ZSgpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ21kL0N0cmwgKyB3IGNsb3NlcyBpc3N1ZSB3aW5kb3dcblx0XHRcdGlmIChjbWRPckN0cmxLZXkgJiYgZS5rZXkgPT09ICd3Jykge1xuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0Y29uc3QgaXNzdWVUaXRsZSA9ICg8SFRNTElucHV0RWxlbWVudD50aGlzLmdldEVsZW1lbnRCeUlkKCdpc3N1ZS10aXRsZScpKSEudmFsdWU7XG5cdFx0XHRcdGNvbnN0IHsgaXNzdWVEZXNjcmlwdGlvbiB9ID0gdGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZ2V0RGF0YSgpO1xuXHRcdFx0XHRpZiAoIXRoaXMuaGFzQmVlblN1Ym1pdHRlZCAmJiAoaXNzdWVUaXRsZSB8fCBpc3N1ZURlc2NyaXB0aW9uKSkge1xuXHRcdFx0XHRcdC8vIGZpcmUgYW5kIGZvcmdldFxuXHRcdFx0XHRcdHRoaXMuaXNzdWVGb3JtU2VydmljZS5zaG93Q29uZmlybUNsb3NlRGlhbG9nKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFdpdGggbGF0ZXN0IGVsZWN0cm9uIHVwZ3JhZGUsIGNtZCthIGlzIG5vIGxvbmdlciBwcm9wYWdhdGluZyBjb3JyZWN0bHkgZm9yIGlucHV0cyBpbiB0aGlzIHdpbmRvdyBvbiBtYWNcblx0XHRcdC8vIE1hbnVhbGx5IHBlcmZvcm0gdGhlIHNlbGVjdGlvblxuXHRcdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRcdGlmIChjbWRPckN0cmxLZXkgJiYgZS5rZXkgPT09ICdhJyAmJiBlLnRhcmdldCkge1xuXHRcdFx0XHRcdGlmIChpc0hUTUxJbnB1dEVsZW1lbnQoZS50YXJnZXQpIHx8IGlzSFRNTFRleHRBcmVhRWxlbWVudChlLnRhcmdldCkpIHtcblx0XHRcdFx0XHRcdCg8SFRNTElucHV0RWxlbWVudD5lLnRhcmdldCkuc2VsZWN0KCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyB1cGRhdGVQZXJmb3JtYW5jZUluZm8oaW5mbzogUGFydGlhbDxJc3N1ZVJlcG9ydGVyRGF0YT4pIHtcblx0XHR0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC51cGRhdGUoaW5mbyk7XG5cdFx0dGhpcy5yZWNlaXZlZFBlcmZvcm1hbmNlSW5mbyA9IHRydWU7XG5cblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLmdldERhdGEoKTtcblx0XHR0aGlzLnVwZGF0ZVByb2Nlc3NJbmZvKHN0YXRlKTtcblx0XHR0aGlzLnVwZGF0ZVdvcmtzcGFjZUluZm8oc3RhdGUpO1xuXHRcdHRoaXMudXBkYXRlUHJldmlld0J1dHRvblN0YXRlKCk7XG5cdH1cblxuXHRwdWJsaWMgdXBkYXRlUHJldmlld0J1dHRvblN0YXRlKCkge1xuXG5cdFx0aWYgKCF0aGlzLmFja25vd2xlZGdlZCAmJiB0aGlzLm5lZWRzVXBkYXRlKSB7XG5cdFx0XHR0aGlzLnByZXZpZXdCdXR0b24ubGFiZWwgPSBsb2NhbGl6ZSgnYWNrbm93bGVkZ2UnLCBcIkNvbmZpcm0gVmVyc2lvbiBBY2tub3dsZWRnZW1lbnRcIik7XG5cdFx0XHR0aGlzLnByZXZpZXdCdXR0b24uZW5hYmxlZCA9IGZhbHNlO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5pc1ByZXZpZXdFbmFibGVkKCkpIHtcblx0XHRcdGlmICh0aGlzLmRhdGEuZ2l0aHViQWNjZXNzVG9rZW4pIHtcblx0XHRcdFx0dGhpcy5wcmV2aWV3QnV0dG9uLmxhYmVsID0gbG9jYWxpemUoJ2NyZWF0ZU9uR2l0SHViJywgXCJDcmVhdGUgb24gR2l0SHViXCIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5wcmV2aWV3QnV0dG9uLmxhYmVsID0gbG9jYWxpemUoJ3ByZXZpZXdPbkdpdEh1YicsIFwiUHJldmlldyBvbiBHaXRIdWJcIik7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnByZXZpZXdCdXR0b24uZW5hYmxlZCA9IHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucHJldmlld0J1dHRvbi5lbmFibGVkID0gZmFsc2U7XG5cdFx0XHR0aGlzLnByZXZpZXdCdXR0b24ubGFiZWwgPSBsb2NhbGl6ZSgnbG9hZGluZ0RhdGEnLCBcIkxvYWRpbmcgZGF0YS4uLlwiKTtcblx0XHR9XG5cblx0XHRjb25zdCBpc3N1ZVJlcG9OYW1lID0gdGhpcy5nZXRFbGVtZW50QnlJZCgnc2hvdy1yZXBvLW5hbWUnKSEgYXMgSFRNTEFuY2hvckVsZW1lbnQ7XG5cdFx0Y29uc3Qgc2VsZWN0ZWRFeHRlbnNpb24gPSB0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC5nZXREYXRhKCkuc2VsZWN0ZWRFeHRlbnNpb247XG5cdFx0aWYgKHNlbGVjdGVkRXh0ZW5zaW9uICYmIHNlbGVjdGVkRXh0ZW5zaW9uLnVyaSkge1xuXHRcdFx0Y29uc3QgdXJsU3RyaW5nID0gVVJJLnJldml2ZShzZWxlY3RlZEV4dGVuc2lvbi51cmkpLnRvU3RyaW5nKCk7XG5cdFx0XHRpc3N1ZVJlcG9OYW1lLmhyZWYgPSB1cmxTdHJpbmc7XG5cdFx0XHRpc3N1ZVJlcG9OYW1lLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHRoaXMub3BlbkxpbmsoZSkpO1xuXHRcdFx0aXNzdWVSZXBvTmFtZS5hZGRFdmVudExpc3RlbmVyKCdhdXhjbGljaycsIChlKSA9PiB0aGlzLm9wZW5MaW5rKDxNb3VzZUV2ZW50PmUpKTtcblx0XHRcdGNvbnN0IGdpdEh1YkluZm8gPSB0aGlzLnBhcnNlR2l0SHViVXJsKHVybFN0cmluZyk7XG5cdFx0XHRpc3N1ZVJlcG9OYW1lLnRleHRDb250ZW50ID0gZ2l0SHViSW5mbyA/IGdpdEh1YkluZm8ub3duZXIgKyAnLycgKyBnaXRIdWJJbmZvLnJlcG9zaXRvcnlOYW1lIDogdXJsU3RyaW5nO1xuXHRcdFx0T2JqZWN0LmFzc2lnbihpc3N1ZVJlcG9OYW1lLnN0eWxlLCB7XG5cdFx0XHRcdGFsaWduU2VsZjogJ2ZsZXgtZW5kJyxcblx0XHRcdFx0ZGlzcGxheTogJ2Jsb2NrJyxcblx0XHRcdFx0Zm9udFNpemU6ICcxM3B4Jyxcblx0XHRcdFx0bWFyZ2luQm90dG9tOiAnMTBweCcsXG5cdFx0XHRcdHBhZGRpbmc6ICc0cHggMHB4Jyxcblx0XHRcdFx0dGV4dERlY29yYXRpb246ICdub25lJyxcblx0XHRcdFx0d2lkdGg6ICdhdXRvJ1xuXHRcdFx0fSk7XG5cdFx0XHRzaG93KGlzc3VlUmVwb05hbWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBjbGVhciBzdHlsZXNcblx0XHRcdGlzc3VlUmVwb05hbWUucmVtb3ZlQXR0cmlidXRlKCdzdHlsZScpO1xuXHRcdFx0aGlkZShpc3N1ZVJlcG9OYW1lKTtcblx0XHR9XG5cblx0XHQvLyBJbml0aWFsIGNoZWNrIHdoZW4gZmlyc3Qgb3BlbmVkLlxuXHRcdHRoaXMuZ2V0RXh0ZW5zaW9uR2l0SHViVXJsKCk7XG5cdH1cblxuXHRwcml2YXRlIGlzUHJldmlld0VuYWJsZWQoKSB7XG5cdFx0Y29uc3QgaXNzdWVUeXBlID0gdGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZ2V0RGF0YSgpLmlzc3VlVHlwZTtcblxuXHRcdGlmICh0aGlzLmxvYWRpbmdFeHRlbnNpb25EYXRhKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaXNXZWIpIHtcblx0XHRcdGlmIChpc3N1ZVR5cGUgPT09IElzc3VlVHlwZS5GZWF0dXJlUmVxdWVzdCB8fCBpc3N1ZVR5cGUgPT09IElzc3VlVHlwZS5QZXJmb3JtYW5jZUlzc3VlIHx8IGlzc3VlVHlwZSA9PT0gSXNzdWVUeXBlLkJ1Zykge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGlzc3VlVHlwZSA9PT0gSXNzdWVUeXBlLkJ1ZyAmJiB0aGlzLnJlY2VpdmVkU3lzdGVtSW5mbykge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGlzc3VlVHlwZSA9PT0gSXNzdWVUeXBlLlBlcmZvcm1hbmNlSXNzdWUgJiYgdGhpcy5yZWNlaXZlZFN5c3RlbUluZm8gJiYgdGhpcy5yZWNlaXZlZFBlcmZvcm1hbmNlSW5mbykge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGlzc3VlVHlwZSA9PT0gSXNzdWVUeXBlLkZlYXR1cmVSZXF1ZXN0KSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RXh0ZW5zaW9uUmVwb3NpdG9yeVVybCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHNlbGVjdGVkRXh0ZW5zaW9uID0gdGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZ2V0RGF0YSgpLnNlbGVjdGVkRXh0ZW5zaW9uO1xuXHRcdHJldHVybiBzZWxlY3RlZEV4dGVuc2lvbiAmJiBzZWxlY3RlZEV4dGVuc2lvbi5yZXBvc2l0b3J5VXJsO1xuXHR9XG5cblx0cHVibGljIGdldEV4dGVuc2lvbkJ1Z3NVcmwoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBzZWxlY3RlZEV4dGVuc2lvbiA9IHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLmdldERhdGEoKS5zZWxlY3RlZEV4dGVuc2lvbjtcblx0XHRyZXR1cm4gc2VsZWN0ZWRFeHRlbnNpb24gJiYgc2VsZWN0ZWRFeHRlbnNpb24uYnVnc1VybDtcblx0fVxuXG5cdHB1YmxpYyBzZWFyY2hWU0NvZGVJc3N1ZXModGl0bGU6IHN0cmluZywgaXNzdWVEZXNjcmlwdGlvbj86IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICh0aXRsZSkge1xuXHRcdFx0dGhpcy5zZWFyY2hEdXBsaWNhdGVzKHRpdGxlLCBpc3N1ZURlc2NyaXB0aW9uKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5jbGVhclNlYXJjaFJlc3VsdHMoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc2VhcmNoSXNzdWVzKHRpdGxlOiBzdHJpbmcsIGZpbGVPbkV4dGVuc2lvbjogYm9vbGVhbiB8IHVuZGVmaW5lZCwgZmlsZU9uTWFya2V0cGxhY2U6IGJvb2xlYW4gfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoZmlsZU9uRXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zZWFyY2hFeHRlbnNpb25Jc3N1ZXModGl0bGUpO1xuXHRcdH1cblxuXHRcdGlmIChmaWxlT25NYXJrZXRwbGFjZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuc2VhcmNoTWFya2V0cGxhY2VJc3N1ZXModGl0bGUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlc2NyaXB0aW9uID0gdGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZ2V0RGF0YSgpLmlzc3VlRGVzY3JpcHRpb247XG5cdFx0dGhpcy5zZWFyY2hWU0NvZGVJc3N1ZXModGl0bGUsIGRlc2NyaXB0aW9uKTtcblx0fVxuXG5cdHByaXZhdGUgc2VhcmNoRXh0ZW5zaW9uSXNzdWVzKHRpdGxlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCB1cmwgPSB0aGlzLmdldEV4dGVuc2lvbkdpdEh1YlVybCgpO1xuXHRcdGlmICh0aXRsZSkge1xuXHRcdFx0Y29uc3QgbWF0Y2hlcyA9IC9eaHR0cHM/OlxcL1xcL2dpdGh1YlxcLmNvbVxcLyguKikvLmV4ZWModXJsKTtcblx0XHRcdGlmIChtYXRjaGVzICYmIG1hdGNoZXMubGVuZ3RoKSB7XG5cdFx0XHRcdGNvbnN0IHJlcG8gPSBtYXRjaGVzWzFdO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZWFyY2hHaXRIdWIocmVwbywgdGl0bGUpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiB0aGUgZXh0ZW5zaW9uIGhhcyBubyByZXBvc2l0b3J5LCBkaXNwbGF5IGVtcHR5IHNlYXJjaCByZXN1bHRzXG5cdFx0XHRpZiAodGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZ2V0RGF0YSgpLnNlbGVjdGVkRXh0ZW5zaW9uKSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJTZWFyY2hSZXN1bHRzKCk7XG5cdFx0XHRcdHJldHVybiB0aGlzLmRpc3BsYXlTZWFyY2hSZXN1bHRzKFtdKTtcblxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuY2xlYXJTZWFyY2hSZXN1bHRzKCk7XG5cdH1cblxuXHRwcml2YXRlIHNlYXJjaE1hcmtldHBsYWNlSXNzdWVzKHRpdGxlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGl0bGUpIHtcblx0XHRcdGNvbnN0IGdpdEh1YkluZm8gPSB0aGlzLnBhcnNlR2l0SHViVXJsKHRoaXMucHJvZHVjdC5yZXBvcnRNYXJrZXRwbGFjZUlzc3VlVXJsISk7XG5cdFx0XHRpZiAoZ2l0SHViSW5mbykge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZWFyY2hHaXRIdWIoYCR7Z2l0SHViSW5mby5vd25lcn0vJHtnaXRIdWJJbmZvLnJlcG9zaXRvcnlOYW1lfWAsIHRpdGxlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgY2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5pc3N1ZUZvcm1TZXJ2aWNlLmNsb3NlUmVwb3J0ZXIoKTtcblx0fVxuXG5cdHB1YmxpYyBjbGVhclNlYXJjaFJlc3VsdHMoKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2ltaWxhcklzc3VlcyA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ3NpbWlsYXItaXNzdWVzJykhO1xuXHRcdHNpbWlsYXJJc3N1ZXMuaW5uZXJUZXh0ID0gJyc7XG5cdFx0dGhpcy5udW1iZXJPZlNlYXJjaFJlc3VsdHNEaXNwbGF5ZWQgPSAwO1xuXHR9XG5cblx0QGRlYm91bmNlKDMwMClcblx0cHJpdmF0ZSBzZWFyY2hHaXRIdWIocmVwbzogc3RyaW5nLCB0aXRsZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgcXVlcnkgPSBgaXM6aXNzdWUrcmVwbzoke3JlcG99KyR7dGl0bGV9YDtcblx0XHRjb25zdCBzaW1pbGFySXNzdWVzID0gdGhpcy5nZXRFbGVtZW50QnlJZCgnc2ltaWxhci1pc3N1ZXMnKSE7XG5cblx0XHRmZXRjaChgaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9zZWFyY2gvaXNzdWVzP3E9JHtxdWVyeX1gKS50aGVuKChyZXNwb25zZSkgPT4ge1xuXHRcdFx0cmVzcG9uc2UuanNvbigpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0c2ltaWxhcklzc3Vlcy5pbm5lclRleHQgPSAnJztcblx0XHRcdFx0aWYgKHJlc3VsdCAmJiByZXN1bHQuaXRlbXMpIHtcblx0XHRcdFx0XHR0aGlzLmRpc3BsYXlTZWFyY2hSZXN1bHRzKHJlc3VsdC5pdGVtcyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gSWYgdGhlIGl0ZW1zIHByb3BlcnR5IGlzbid0IHByZXNlbnQsIHRoZSByYXRlIGxpbWl0IGhhcyBiZWVuIGhpdFxuXHRcdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSAkKCdkaXYubGlzdC10aXRsZScpO1xuXHRcdFx0XHRcdG1lc3NhZ2UudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgncmF0ZUxpbWl0ZWQnLCBcIkdpdEh1YiBxdWVyeSBsaW1pdCBleGNlZWRlZC4gUGxlYXNlIHdhaXQuXCIpO1xuXHRcdFx0XHRcdHNpbWlsYXJJc3N1ZXMuYXBwZW5kQ2hpbGQobWVzc2FnZSk7XG5cblx0XHRcdFx0XHRjb25zdCByZXNldFRpbWUgPSByZXNwb25zZS5oZWFkZXJzLmdldCgnWC1SYXRlTGltaXQtUmVzZXQnKTtcblx0XHRcdFx0XHRjb25zdCB0aW1lVG9XYWl0ID0gcmVzZXRUaW1lID8gcGFyc2VJbnQocmVzZXRUaW1lKSAtIE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApIDogMTtcblx0XHRcdFx0XHRpZiAodGhpcy5zaG91bGRRdWV1ZVNlYXJjaCkge1xuXHRcdFx0XHRcdFx0dGhpcy5zaG91bGRRdWV1ZVNlYXJjaCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuc2VhcmNoR2l0SHViKHJlcG8sIHRpdGxlKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5zaG91bGRRdWV1ZVNlYXJjaCA9IHRydWU7XG5cdFx0XHRcdFx0XHR9LCB0aW1lVG9XYWl0ICogMTAwMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KS5jYXRjaChfID0+IHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdUaW1lb3V0IG9yIHF1ZXJ5IGxpbWl0IGV4Y2VlZGVkJyk7XG5cdFx0XHR9KTtcblx0XHR9KS5jYXRjaChfID0+IHtcblx0XHRcdGNvbnNvbGUud2FybignRXJyb3IgZmV0Y2hpbmcgR2l0SHViIGlzc3VlcycpO1xuXHRcdH0pO1xuXHR9XG5cblx0QGRlYm91bmNlKDMwMClcblx0cHJpdmF0ZSBzZWFyY2hEdXBsaWNhdGVzKHRpdGxlOiBzdHJpbmcsIGJvZHk/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCB1cmwgPSAnaHR0cHM6Ly92c2NvZGUtcHJvYm90Lndlc3R1cy5jbG91ZGFwcC5henVyZS5jb206Nzg5MC9kdXBsaWNhdGVfY2FuZGlkYXRlcyc7XG5cdFx0Y29uc3QgaW5pdCA9IHtcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHR0aXRsZSxcblx0XHRcdFx0Ym9keVxuXHRcdFx0fSksXG5cdFx0XHRoZWFkZXJzOiBuZXcgSGVhZGVycyh7XG5cdFx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcblx0XHRcdH0pXG5cdFx0fTtcblxuXHRcdGZldGNoKHVybCwgaW5pdCkudGhlbigocmVzcG9uc2UpID0+IHtcblx0XHRcdHJlc3BvbnNlLmpzb24oKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRcdHRoaXMuY2xlYXJTZWFyY2hSZXN1bHRzKCk7XG5cblx0XHRcdFx0aWYgKHJlc3VsdCAmJiByZXN1bHQuY2FuZGlkYXRlcykge1xuXHRcdFx0XHRcdHRoaXMuZGlzcGxheVNlYXJjaFJlc3VsdHMocmVzdWx0LmNhbmRpZGF0ZXMpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCByZXNwb25zZSwgbm8gY2FuZGlkYXRlcyBwcm9wZXJ0eScpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KS5jYXRjaChfID0+IHtcblx0XHRcdFx0Ly8gSWdub3JlXG5cdFx0XHR9KTtcblx0XHR9KS5jYXRjaChfID0+IHtcblx0XHRcdC8vIElnbm9yZVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBkaXNwbGF5U2VhcmNoUmVzdWx0cyhyZXN1bHRzOiBTZWFyY2hSZXN1bHRbXSkge1xuXHRcdGNvbnN0IHNpbWlsYXJJc3N1ZXMgPSB0aGlzLmdldEVsZW1lbnRCeUlkKCdzaW1pbGFyLWlzc3VlcycpITtcblx0XHRpZiAocmVzdWx0cy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IGlzc3VlcyA9ICQoJ2Rpdi5pc3N1ZXMtY29udGFpbmVyJyk7XG5cdFx0XHRjb25zdCBpc3N1ZXNUZXh0ID0gJCgnZGl2Lmxpc3QtdGl0bGUnKTtcblx0XHRcdGlzc3Vlc1RleHQudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnc2ltaWxhcklzc3VlcycsIFwiU2ltaWxhciBpc3N1ZXNcIik7XG5cblx0XHRcdHRoaXMubnVtYmVyT2ZTZWFyY2hSZXN1bHRzRGlzcGxheWVkID0gcmVzdWx0cy5sZW5ndGggPCA1ID8gcmVzdWx0cy5sZW5ndGggOiA1O1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm51bWJlck9mU2VhcmNoUmVzdWx0c0Rpc3BsYXllZDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGlzc3VlID0gcmVzdWx0c1tpXTtcblx0XHRcdFx0Y29uc3QgbGluayA9ICQoJ2EuaXNzdWUtbGluaycsIHsgaHJlZjogaXNzdWUuaHRtbF91cmwgfSk7XG5cdFx0XHRcdGxpbmsudGV4dENvbnRlbnQgPSBpc3N1ZS50aXRsZTtcblx0XHRcdFx0bGluay50aXRsZSA9IGlzc3VlLnRpdGxlO1xuXHRcdFx0XHRsaW5rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHRoaXMub3BlbkxpbmsoZSkpO1xuXHRcdFx0XHRsaW5rLmFkZEV2ZW50TGlzdGVuZXIoJ2F1eGNsaWNrJywgKGUpID0+IHRoaXMub3BlbkxpbmsoPE1vdXNlRXZlbnQ+ZSkpO1xuXG5cdFx0XHRcdGxldCBpc3N1ZVN0YXRlOiBIVE1MRWxlbWVudDtcblx0XHRcdFx0bGV0IGl0ZW06IEhUTUxFbGVtZW50O1xuXHRcdFx0XHRpZiAoaXNzdWUuc3RhdGUpIHtcblx0XHRcdFx0XHRpc3N1ZVN0YXRlID0gJCgnc3Bhbi5pc3N1ZS1zdGF0ZScpO1xuXG5cdFx0XHRcdFx0Y29uc3QgaXNzdWVJY29uID0gJCgnc3Bhbi5pc3N1ZS1pY29uJyk7XG5cdFx0XHRcdFx0aXNzdWVJY29uLmFwcGVuZENoaWxkKHJlbmRlckljb24oaXNzdWUuc3RhdGUgPT09ICdvcGVuJyA/IENvZGljb24uaXNzdWVPcGVuZWQgOiBDb2RpY29uLmlzc3VlQ2xvc2VkKSk7XG5cblx0XHRcdFx0XHRjb25zdCBpc3N1ZVN0YXRlTGFiZWwgPSAkKCdzcGFuLmlzc3VlLXN0YXRlLmxhYmVsJyk7XG5cdFx0XHRcdFx0aXNzdWVTdGF0ZUxhYmVsLnRleHRDb250ZW50ID0gaXNzdWUuc3RhdGUgPT09ICdvcGVuJyA/IGxvY2FsaXplKCdvcGVuJywgXCJPcGVuXCIpIDogbG9jYWxpemUoJ2Nsb3NlZCcsIFwiQ2xvc2VkXCIpO1xuXG5cdFx0XHRcdFx0aXNzdWVTdGF0ZS50aXRsZSA9IGlzc3VlLnN0YXRlID09PSAnb3BlbicgPyBsb2NhbGl6ZSgnb3BlbicsIFwiT3BlblwiKSA6IGxvY2FsaXplKCdjbG9zZWQnLCBcIkNsb3NlZFwiKTtcblx0XHRcdFx0XHRpc3N1ZVN0YXRlLmFwcGVuZENoaWxkKGlzc3VlSWNvbik7XG5cdFx0XHRcdFx0aXNzdWVTdGF0ZS5hcHBlbmRDaGlsZChpc3N1ZVN0YXRlTGFiZWwpO1xuXG5cdFx0XHRcdFx0aXRlbSA9ICQoJ2Rpdi5pc3N1ZScsIHVuZGVmaW5lZCwgaXNzdWVTdGF0ZSwgbGluayk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aXRlbSA9ICQoJ2Rpdi5pc3N1ZScsIHVuZGVmaW5lZCwgbGluayk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpc3N1ZXMuYXBwZW5kQ2hpbGQoaXRlbSk7XG5cdFx0XHR9XG5cblx0XHRcdHNpbWlsYXJJc3N1ZXMuYXBwZW5kQ2hpbGQoaXNzdWVzVGV4dCk7XG5cdFx0XHRzaW1pbGFySXNzdWVzLmFwcGVuZENoaWxkKGlzc3Vlcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSAkKCdkaXYubGlzdC10aXRsZScpO1xuXHRcdFx0bWVzc2FnZS50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdub1NpbWlsYXJJc3N1ZXMnLCBcIk5vIHNpbWlsYXIgaXNzdWVzIGZvdW5kXCIpO1xuXHRcdFx0c2ltaWxhcklzc3Vlcy5hcHBlbmRDaGlsZChtZXNzYWdlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldFVwVHlwZXMoKTogdm9pZCB7XG5cdFx0Y29uc3QgbWFrZU9wdGlvbiA9IChpc3N1ZVR5cGU6IElzc3VlVHlwZSwgZGVzY3JpcHRpb246IHN0cmluZykgPT4gJCgnb3B0aW9uJywgeyAndmFsdWUnOiBpc3N1ZVR5cGUudmFsdWVPZigpIH0sIGVzY2FwZShkZXNjcmlwdGlvbikpO1xuXG5cdFx0Y29uc3QgdHlwZVNlbGVjdCA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2lzc3VlLXR5cGUnKSEgYXMgSFRNTFNlbGVjdEVsZW1lbnQ7XG5cdFx0Y29uc3QgeyBpc3N1ZVR5cGUgfSA9IHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLmdldERhdGEoKTtcblx0XHRyZXNldCh0eXBlU2VsZWN0LFxuXHRcdFx0bWFrZU9wdGlvbihJc3N1ZVR5cGUuQnVnLCBsb2NhbGl6ZSgnYnVnUmVwb3J0ZXInLCBcIkJ1ZyBSZXBvcnRcIikpLFxuXHRcdFx0bWFrZU9wdGlvbihJc3N1ZVR5cGUuRmVhdHVyZVJlcXVlc3QsIGxvY2FsaXplKCdmZWF0dXJlUmVxdWVzdCcsIFwiRmVhdHVyZSBSZXF1ZXN0XCIpKSxcblx0XHRcdG1ha2VPcHRpb24oSXNzdWVUeXBlLlBlcmZvcm1hbmNlSXNzdWUsIGxvY2FsaXplKCdwZXJmb3JtYW5jZUlzc3VlJywgXCJQZXJmb3JtYW5jZSBJc3N1ZSAoZnJlZXplLCBzbG93LCBjcmFzaClcIikpXG5cdFx0KTtcblxuXHRcdHR5cGVTZWxlY3QudmFsdWUgPSBpc3N1ZVR5cGUudG9TdHJpbmcoKTtcblxuXHRcdHRoaXMuc2V0U291cmNlT3B0aW9ucygpO1xuXHR9XG5cblx0cHVibGljIG1ha2VPcHRpb24odmFsdWU6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZywgZGlzYWJsZWQ6IGJvb2xlYW4pOiBIVE1MT3B0aW9uRWxlbWVudCB7XG5cdFx0Y29uc3Qgb3B0aW9uOiBIVE1MT3B0aW9uRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpO1xuXHRcdG9wdGlvbi5kaXNhYmxlZCA9IGRpc2FibGVkO1xuXHRcdG9wdGlvbi52YWx1ZSA9IHZhbHVlO1xuXHRcdG9wdGlvbi50ZXh0Q29udGVudCA9IGRlc2NyaXB0aW9uO1xuXG5cdFx0cmV0dXJuIG9wdGlvbjtcblx0fVxuXG5cdHB1YmxpYyBzZXRTb3VyY2VPcHRpb25zKCk6IHZvaWQge1xuXHRcdGNvbnN0IHNvdXJjZVNlbGVjdCA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2lzc3VlLXNvdXJjZScpISBhcyBIVE1MU2VsZWN0RWxlbWVudDtcblx0XHRjb25zdCB7IGlzc3VlVHlwZSwgZmlsZU9uRXh0ZW5zaW9uLCBzZWxlY3RlZEV4dGVuc2lvbiwgZmlsZU9uTWFya2V0cGxhY2UsIGZpbGVPblByb2R1Y3QgfSA9IHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLmdldERhdGEoKTtcblx0XHRsZXQgc2VsZWN0ZWQgPSBzb3VyY2VTZWxlY3Quc2VsZWN0ZWRJbmRleDtcblx0XHRpZiAoc2VsZWN0ZWQgPT09IC0xKSB7XG5cdFx0XHRpZiAoZmlsZU9uRXh0ZW5zaW9uICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0c2VsZWN0ZWQgPSBmaWxlT25FeHRlbnNpb24gPyAyIDogMTtcblx0XHRcdH0gZWxzZSBpZiAoc2VsZWN0ZWRFeHRlbnNpb24/LmlzQnVpbHRpbikge1xuXHRcdFx0XHRzZWxlY3RlZCA9IDE7XG5cdFx0XHR9IGVsc2UgaWYgKGZpbGVPbk1hcmtldHBsYWNlKSB7XG5cdFx0XHRcdHNlbGVjdGVkID0gMztcblx0XHRcdH0gZWxzZSBpZiAoZmlsZU9uUHJvZHVjdCkge1xuXHRcdFx0XHRzZWxlY3RlZCA9IDE7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0c291cmNlU2VsZWN0LmlubmVyVGV4dCA9ICcnO1xuXHRcdHNvdXJjZVNlbGVjdC5hcHBlbmQodGhpcy5tYWtlT3B0aW9uKCcnLCBsb2NhbGl6ZSgnc2VsZWN0U291cmNlJywgXCJTZWxlY3Qgc291cmNlXCIpLCB0cnVlKSk7XG5cdFx0c291cmNlU2VsZWN0LmFwcGVuZCh0aGlzLm1ha2VPcHRpb24oSXNzdWVTb3VyY2UuVlNDb2RlLCBsb2NhbGl6ZSgndnNjb2RlJywgXCJWaXN1YWwgU3R1ZGlvIENvZGVcIiksIGZhbHNlKSk7XG5cdFx0c291cmNlU2VsZWN0LmFwcGVuZCh0aGlzLm1ha2VPcHRpb24oSXNzdWVTb3VyY2UuRXh0ZW5zaW9uLCBsb2NhbGl6ZSgnZXh0ZW5zaW9uJywgXCJBIFZTIENvZGUgZXh0ZW5zaW9uXCIpLCBmYWxzZSkpO1xuXHRcdGlmICh0aGlzLnByb2R1Y3QucmVwb3J0TWFya2V0cGxhY2VJc3N1ZVVybCkge1xuXHRcdFx0c291cmNlU2VsZWN0LmFwcGVuZCh0aGlzLm1ha2VPcHRpb24oSXNzdWVTb3VyY2UuTWFya2V0cGxhY2UsIGxvY2FsaXplKCdtYXJrZXRwbGFjZScsIFwiRXh0ZW5zaW9ucyBNYXJrZXRwbGFjZVwiKSwgZmFsc2UpKTtcblx0XHR9XG5cblx0XHRpZiAoaXNzdWVUeXBlICE9PSBJc3N1ZVR5cGUuRmVhdHVyZVJlcXVlc3QpIHtcblx0XHRcdHNvdXJjZVNlbGVjdC5hcHBlbmQodGhpcy5tYWtlT3B0aW9uKElzc3VlU291cmNlLlVua25vd24sIGxvY2FsaXplKCd1bmtub3duJywgXCJEb24ndCBrbm93XCIpLCBmYWxzZSkpO1xuXHRcdH1cblxuXHRcdGlmIChzZWxlY3RlZCAhPT0gLTEgJiYgc2VsZWN0ZWQgPCBzb3VyY2VTZWxlY3Qub3B0aW9ucy5sZW5ndGgpIHtcblx0XHRcdHNvdXJjZVNlbGVjdC5zZWxlY3RlZEluZGV4ID0gc2VsZWN0ZWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNvdXJjZVNlbGVjdC5zZWxlY3RlZEluZGV4ID0gMDtcblx0XHRcdGhpZGUodGhpcy5nZXRFbGVtZW50QnlJZCgncHJvYmxlbS1zb3VyY2UtaGVscC10ZXh0JykpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhc3luYyByZW5kZXJCbG9ja3MoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gRGVwZW5kaW5nIG9uIElzc3VlIFR5cGUsIHdlIHJlbmRlciBkaWZmZXJlbnQgYmxvY2tzIGFuZCB0ZXh0XG5cdFx0Y29uc3QgeyBpc3N1ZVR5cGUsIGZpbGVPbkV4dGVuc2lvbiwgZmlsZU9uTWFya2V0cGxhY2UsIHNlbGVjdGVkRXh0ZW5zaW9uIH0gPSB0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC5nZXREYXRhKCk7XG5cdFx0Y29uc3QgYmxvY2tDb250YWluZXIgPSB0aGlzLmdldEVsZW1lbnRCeUlkKCdibG9jay1jb250YWluZXInKTtcblx0XHRjb25zdCBzeXN0ZW1CbG9jayA9IHRoaXMud2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5ibG9jay1zeXN0ZW0nKTtcblx0XHRjb25zdCBwcm9jZXNzQmxvY2sgPSB0aGlzLndpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuYmxvY2stcHJvY2VzcycpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZUJsb2NrID0gdGhpcy53aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmJsb2NrLXdvcmtzcGFjZScpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNCbG9jayA9IHRoaXMud2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5ibG9jay1leHRlbnNpb25zJyk7XG5cdFx0Y29uc3QgZXhwZXJpbWVudHNCbG9jayA9IHRoaXMud2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5ibG9jay1leHBlcmltZW50cycpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbkRhdGFCbG9jayA9IHRoaXMud2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5ibG9jay1leHRlbnNpb24tZGF0YScpO1xuXG5cdFx0Y29uc3QgcHJvYmxlbVNvdXJjZSA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ3Byb2JsZW0tc291cmNlJykhO1xuXHRcdGNvbnN0IGRlc2NyaXB0aW9uVGl0bGUgPSB0aGlzLmdldEVsZW1lbnRCeUlkKCdpc3N1ZS1kZXNjcmlwdGlvbi1sYWJlbCcpITtcblx0XHRjb25zdCBkZXNjcmlwdGlvblN1YnRpdGxlID0gdGhpcy5nZXRFbGVtZW50QnlJZCgnaXNzdWUtZGVzY3JpcHRpb24tc3VidGl0bGUnKSE7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uU2VsZWN0b3IgPSB0aGlzLmdldEVsZW1lbnRCeUlkKCdleHRlbnNpb24tc2VsZWN0aW9uJykhO1xuXHRcdGNvbnN0IGRvd25sb2FkRXh0ZW5zaW9uRGF0YUxpbmsgPSA8SFRNTEFuY2hvckVsZW1lbnQ+dGhpcy5nZXRFbGVtZW50QnlJZCgnZXh0ZW5zaW9uLWRhdGEtZG93bmxvYWQnKSE7XG5cblx0XHRjb25zdCB0aXRsZVRleHRBcmVhID0gdGhpcy5nZXRFbGVtZW50QnlJZCgnaXNzdWUtdGl0bGUtY29udGFpbmVyJykhO1xuXHRcdGNvbnN0IGRlc2NyaXB0aW9uVGV4dEFyZWEgPSB0aGlzLmdldEVsZW1lbnRCeUlkKCdkZXNjcmlwdGlvbicpITtcblx0XHRjb25zdCBleHRlbnNpb25EYXRhVGV4dEFyZWEgPSB0aGlzLmdldEVsZW1lbnRCeUlkKCdleHRlbnNpb24tZGF0YScpITtcblxuXHRcdC8vIEhpZGUgYWxsIGJ5IGRlZmF1bHRcblx0XHRoaWRlKGJsb2NrQ29udGFpbmVyKTtcblx0XHRoaWRlKHN5c3RlbUJsb2NrKTtcblx0XHRoaWRlKHByb2Nlc3NCbG9jayk7XG5cdFx0aGlkZSh3b3Jrc3BhY2VCbG9jayk7XG5cdFx0aGlkZShleHRlbnNpb25zQmxvY2spO1xuXHRcdGhpZGUoZXhwZXJpbWVudHNCbG9jayk7XG5cdFx0aGlkZShleHRlbnNpb25TZWxlY3Rvcik7XG5cdFx0aGlkZShleHRlbnNpb25EYXRhVGV4dEFyZWEpO1xuXHRcdGhpZGUoZXh0ZW5zaW9uRGF0YUJsb2NrKTtcblx0XHRoaWRlKGRvd25sb2FkRXh0ZW5zaW9uRGF0YUxpbmspO1xuXG5cdFx0c2hvdyhwcm9ibGVtU291cmNlKTtcblx0XHRzaG93KHRpdGxlVGV4dEFyZWEpO1xuXHRcdHNob3coZGVzY3JpcHRpb25UZXh0QXJlYSk7XG5cblx0XHRpZiAoZmlsZU9uRXh0ZW5zaW9uKSB7XG5cdFx0XHRzaG93KGV4dGVuc2lvblNlbGVjdG9yKTtcblx0XHR9XG5cblx0XHRjb25zdCBleHRlbnNpb25EYXRhID0gdGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZ2V0RGF0YSgpLmV4dGVuc2lvbkRhdGE7XG5cdFx0aWYgKGV4dGVuc2lvbkRhdGEgJiYgZXh0ZW5zaW9uRGF0YS5sZW5ndGggPiBNQVhfRVhURU5TSU9OX0RBVEFfTEVOR1RIKSB7XG5cdFx0XHRzaG93KGRvd25sb2FkRXh0ZW5zaW9uRGF0YUxpbmspO1xuXHRcdFx0Y29uc3QgZGF0ZSA9IG5ldyBEYXRlKCk7XG5cdFx0XHRjb25zdCBmb3JtYXR0ZWREYXRlID0gZGF0ZS50b0lTT1N0cmluZygpLnNwbGl0KCdUJylbMF07IC8vIFlZWVktTU0tRERcblx0XHRcdGNvbnN0IGZvcm1hdHRlZFRpbWUgPSBkYXRlLnRvVGltZVN0cmluZygpLnNwbGl0KCcgJylbMF0ucmVwbGFjZSgvOi9nLCAnLScpOyAvLyBISC1NTS1TU1xuXHRcdFx0Y29uc3QgZmlsZU5hbWUgPSBgZXh0ZW5zaW9uRGF0YV8ke2Zvcm1hdHRlZERhdGV9XyR7Zm9ybWF0dGVkVGltZX0ubWRgO1xuXHRcdFx0Y29uc3QgaGFuZGxlTGlua0NsaWNrID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBkb3dubG9hZFBhdGggPSBhd2FpdCB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLnNob3dTYXZlRGlhbG9nKHtcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3NhdmVFeHRlbnNpb25EYXRhJywgXCJTYXZlIEV4dGVuc2lvbiBEYXRhXCIpLFxuXHRcdFx0XHRcdGF2YWlsYWJsZUZpbGVTeXN0ZW1zOiBbU2NoZW1hcy5maWxlXSxcblx0XHRcdFx0XHRkZWZhdWx0VXJpOiBqb2luUGF0aChhd2FpdCB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLmRlZmF1bHRGaWxlUGF0aChTY2hlbWFzLmZpbGUpLCBmaWxlTmFtZSksXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmIChkb3dubG9hZFBhdGgpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLndyaXRlRmlsZShkb3dubG9hZFBhdGgsIFZTQnVmZmVyLmZyb21TdHJpbmcoZXh0ZW5zaW9uRGF0YSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRkb3dubG9hZEV4dGVuc2lvbkRhdGFMaW5rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgaGFuZGxlTGlua0NsaWNrKTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoe1xuXHRcdFx0XHRkaXNwb3NlOiAoKSA9PiBkb3dubG9hZEV4dGVuc2lvbkRhdGFMaW5rLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgaGFuZGxlTGlua0NsaWNrKVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKHNlbGVjdGVkRXh0ZW5zaW9uICYmIHRoaXMubm9uR2l0SHViSXNzdWVVcmwpIHtcblx0XHRcdGhpZGUodGl0bGVUZXh0QXJlYSk7XG5cdFx0XHRoaWRlKGRlc2NyaXB0aW9uVGV4dEFyZWEpO1xuXHRcdFx0cmVzZXQoZGVzY3JpcHRpb25UaXRsZSwgbG9jYWxpemUoJ2hhbmRsZXNJc3N1ZXNFbHNld2hlcmUnLCBcIlRoaXMgZXh0ZW5zaW9uIGhhbmRsZXMgaXNzdWVzIG91dHNpZGUgb2YgVlMgQ29kZVwiKSk7XG5cdFx0XHRyZXNldChkZXNjcmlwdGlvblN1YnRpdGxlLCBsb2NhbGl6ZSgnZWxzZXdoZXJlRGVzY3JpcHRpb24nLCBcIlRoZSAnezB9JyBleHRlbnNpb24gcHJlZmVycyB0byB1c2UgYW4gZXh0ZXJuYWwgaXNzdWUgcmVwb3J0ZXIuIFRvIGJlIHRha2VuIHRvIHRoYXQgaXNzdWUgcmVwb3J0aW5nIGV4cGVyaWVuY2UsIGNsaWNrIHRoZSBidXR0b24gYmVsb3cuXCIsIHNlbGVjdGVkRXh0ZW5zaW9uLmRpc3BsYXlOYW1lKSk7XG5cdFx0XHR0aGlzLnByZXZpZXdCdXR0b24ubGFiZWwgPSBsb2NhbGl6ZSgnb3Blbklzc3VlUmVwb3J0ZXInLCBcIk9wZW4gRXh0ZXJuYWwgSXNzdWUgUmVwb3J0ZXJcIik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGZpbGVPbkV4dGVuc2lvbiAmJiBzZWxlY3RlZEV4dGVuc2lvbj8uZGF0YSkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IHNlbGVjdGVkRXh0ZW5zaW9uPy5kYXRhO1xuXHRcdFx0KGV4dGVuc2lvbkRhdGFUZXh0QXJlYSBhcyBIVE1MRWxlbWVudCkuaW5uZXJUZXh0ID0gZGF0YS50b1N0cmluZygpO1xuXHRcdFx0KGV4dGVuc2lvbkRhdGFUZXh0QXJlYSBhcyBIVE1MVGV4dEFyZWFFbGVtZW50KS5yZWFkT25seSA9IHRydWU7XG5cdFx0XHRzaG93KGV4dGVuc2lvbkRhdGFCbG9jayk7XG5cdFx0fVxuXG5cdFx0Ly8gb25seSBpZiB3ZSBrbm93IGNvbWVzIGZyb20gdGhlIG9wZW4gcmVwb3J0ZXIgY29tbWFuZFxuXHRcdGlmIChmaWxlT25FeHRlbnNpb24gJiYgdGhpcy5vcGVuUmVwb3J0ZXIpIHtcblx0XHRcdChleHRlbnNpb25EYXRhVGV4dEFyZWEgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkucmVhZE9ubHkgPSB0cnVlO1xuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdC8vIGRlbGF5IHRvIG1ha2Ugc3VyZSBmcm9tIGNvbW1hbmQgb3Igbm90XG5cdFx0XHRcdGlmICh0aGlzLm9wZW5SZXBvcnRlcikge1xuXHRcdFx0XHRcdHNob3coZXh0ZW5zaW9uRGF0YUJsb2NrKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgMTAwKTtcblx0XHRcdHNob3coZXh0ZW5zaW9uRGF0YUJsb2NrKTtcblx0XHR9XG5cblx0XHRpZiAoaXNzdWVUeXBlID09PSBJc3N1ZVR5cGUuQnVnKSB7XG5cdFx0XHRpZiAoIWZpbGVPbk1hcmtldHBsYWNlKSB7XG5cdFx0XHRcdHNob3coYmxvY2tDb250YWluZXIpO1xuXHRcdFx0XHRzaG93KHN5c3RlbUJsb2NrKTtcblx0XHRcdFx0c2hvdyhleHBlcmltZW50c0Jsb2NrKTtcblx0XHRcdFx0aWYgKCFmaWxlT25FeHRlbnNpb24pIHtcblx0XHRcdFx0XHRzaG93KGV4dGVuc2lvbnNCbG9jayk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmVzZXQoZGVzY3JpcHRpb25UaXRsZSwgbG9jYWxpemUoJ3N0ZXBzVG9SZXByb2R1Y2UnLCBcIlN0ZXBzIHRvIFJlcHJvZHVjZVwiKSArICcgJywgJCgnc3Bhbi5yZXF1aXJlZC1pbnB1dCcsIHVuZGVmaW5lZCwgJyonKSk7XG5cdFx0XHRyZXNldChkZXNjcmlwdGlvblN1YnRpdGxlLCBsb2NhbGl6ZSgnYnVnRGVzY3JpcHRpb24nLCBcIlNoYXJlIHRoZSBzdGVwcyBuZWVkZWQgdG8gcmVsaWFibHkgcmVwcm9kdWNlIHRoZSBwcm9ibGVtLiBQbGVhc2UgaW5jbHVkZSBhY3R1YWwgYW5kIGV4cGVjdGVkIHJlc3VsdHMuIFdlIHN1cHBvcnQgR2l0SHViLWZsYXZvcmVkIE1hcmtkb3duLiBZb3Ugd2lsbCBiZSBhYmxlIHRvIGVkaXQgeW91ciBpc3N1ZSBhbmQgYWRkIHNjcmVlbnNob3RzIHdoZW4gd2UgcHJldmlldyBpdCBvbiBHaXRIdWIuXCIpKTtcblx0XHR9IGVsc2UgaWYgKGlzc3VlVHlwZSA9PT0gSXNzdWVUeXBlLlBlcmZvcm1hbmNlSXNzdWUpIHtcblx0XHRcdGlmICghZmlsZU9uTWFya2V0cGxhY2UpIHtcblx0XHRcdFx0c2hvdyhibG9ja0NvbnRhaW5lcik7XG5cdFx0XHRcdHNob3coc3lzdGVtQmxvY2spO1xuXHRcdFx0XHRzaG93KHByb2Nlc3NCbG9jayk7XG5cdFx0XHRcdHNob3cod29ya3NwYWNlQmxvY2spO1xuXHRcdFx0XHRzaG93KGV4cGVyaW1lbnRzQmxvY2spO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZmlsZU9uRXh0ZW5zaW9uKSB7XG5cdFx0XHRcdHNob3coZXh0ZW5zaW9uU2VsZWN0b3IpO1xuXHRcdFx0fSBlbHNlIGlmICghZmlsZU9uTWFya2V0cGxhY2UpIHtcblx0XHRcdFx0c2hvdyhleHRlbnNpb25zQmxvY2spO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXNldChkZXNjcmlwdGlvblRpdGxlLCBsb2NhbGl6ZSgnc3RlcHNUb1JlcHJvZHVjZScsIFwiU3RlcHMgdG8gUmVwcm9kdWNlXCIpICsgJyAnLCAkKCdzcGFuLnJlcXVpcmVkLWlucHV0JywgdW5kZWZpbmVkLCAnKicpKTtcblx0XHRcdHJlc2V0KGRlc2NyaXB0aW9uU3VidGl0bGUsIGxvY2FsaXplKCdwZXJmb3JtYW5jZUlzc3VlRGVzY2lwdGlvbicsIFwiV2hlbiBkaWQgdGhpcyBwZXJmb3JtYW5jZSBpc3N1ZSBoYXBwZW4/IERvZXMgaXQgb2NjdXIgb24gc3RhcnR1cCBvciBhZnRlciBhIHNwZWNpZmljIHNlcmllcyBvZiBhY3Rpb25zPyBXZSBzdXBwb3J0IEdpdEh1Yi1mbGF2b3JlZCBNYXJrZG93bi4gWW91IHdpbGwgYmUgYWJsZSB0byBlZGl0IHlvdXIgaXNzdWUgYW5kIGFkZCBzY3JlZW5zaG90cyB3aGVuIHdlIHByZXZpZXcgaXQgb24gR2l0SHViLlwiKSk7XG5cdFx0fSBlbHNlIGlmIChpc3N1ZVR5cGUgPT09IElzc3VlVHlwZS5GZWF0dXJlUmVxdWVzdCkge1xuXHRcdFx0cmVzZXQoZGVzY3JpcHRpb25UaXRsZSwgbG9jYWxpemUoJ2Rlc2NyaXB0aW9uJywgXCJEZXNjcmlwdGlvblwiKSArICcgJywgJCgnc3Bhbi5yZXF1aXJlZC1pbnB1dCcsIHVuZGVmaW5lZCwgJyonKSk7XG5cdFx0XHRyZXNldChkZXNjcmlwdGlvblN1YnRpdGxlLCBsb2NhbGl6ZSgnZmVhdHVyZVJlcXVlc3REZXNjcmlwdGlvbicsIFwiUGxlYXNlIGRlc2NyaWJlIHRoZSBmZWF0dXJlIHlvdSB3b3VsZCBsaWtlIHRvIHNlZS4gV2Ugc3VwcG9ydCBHaXRIdWItZmxhdm9yZWQgTWFya2Rvd24uIFlvdSB3aWxsIGJlIGFibGUgdG8gZWRpdCB5b3VyIGlzc3VlIGFuZCBhZGQgc2NyZWVuc2hvdHMgd2hlbiB3ZSBwcmV2aWV3IGl0IG9uIEdpdEh1Yi5cIikpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZUlucHV0KGlucHV0SWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGlucHV0RWxlbWVudCA9ICg8SFRNTElucHV0RWxlbWVudD50aGlzLmdldEVsZW1lbnRCeUlkKGlucHV0SWQpKTtcblx0XHRjb25zdCBpbnB1dFZhbGlkYXRpb25NZXNzYWdlID0gdGhpcy5nZXRFbGVtZW50QnlJZChgJHtpbnB1dElkfS1lbXB0eS1lcnJvcmApO1xuXHRcdGNvbnN0IGRlc2NyaXB0aW9uU2hvcnRNZXNzYWdlID0gdGhpcy5nZXRFbGVtZW50QnlJZChgZGVzY3JpcHRpb24tc2hvcnQtZXJyb3JgKTtcblx0XHRpZiAoaW5wdXRJZCA9PT0gJ2Rlc2NyaXB0aW9uJyAmJiB0aGlzLm5vbkdpdEh1Yklzc3VlVXJsICYmIHRoaXMuZGF0YS5leHRlbnNpb25JZCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIGlmICghaW5wdXRFbGVtZW50LnZhbHVlKSB7XG5cdFx0XHRpbnB1dEVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnaW52YWxpZC1pbnB1dCcpO1xuXHRcdFx0aW5wdXRWYWxpZGF0aW9uTWVzc2FnZT8uY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XG5cdFx0XHRkZXNjcmlwdGlvblNob3J0TWVzc2FnZT8uY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSBlbHNlIGlmIChpbnB1dElkID09PSAnZGVzY3JpcHRpb24nICYmIGlucHV0RWxlbWVudC52YWx1ZS5sZW5ndGggPCAxMCkge1xuXHRcdFx0aW5wdXRFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2ludmFsaWQtaW5wdXQnKTtcblx0XHRcdGRlc2NyaXB0aW9uU2hvcnRNZXNzYWdlPy5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcblx0XHRcdGlucHV0VmFsaWRhdGlvbk1lc3NhZ2U/LmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpbnB1dEVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaW52YWxpZC1pbnB1dCcpO1xuXHRcdFx0aW5wdXRWYWxpZGF0aW9uTWVzc2FnZT8uY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG5cdFx0XHRpZiAoaW5wdXRJZCA9PT0gJ2Rlc2NyaXB0aW9uJykge1xuXHRcdFx0XHRkZXNjcmlwdGlvblNob3J0TWVzc2FnZT8uY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgdmFsaWRhdGVJbnB1dHMoKTogYm9vbGVhbiB7XG5cdFx0bGV0IGlzVmFsaWQgPSB0cnVlO1xuXHRcdFsnaXNzdWUtdGl0bGUnLCAnZGVzY3JpcHRpb24nLCAnaXNzdWUtc291cmNlJ10uZm9yRWFjaChlbGVtZW50SWQgPT4ge1xuXHRcdFx0aXNWYWxpZCA9IHRoaXMudmFsaWRhdGVJbnB1dChlbGVtZW50SWQpICYmIGlzVmFsaWQ7XG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZmlsZU9uRXh0ZW5zaW9uKCkpIHtcblx0XHRcdGlzVmFsaWQgPSB0aGlzLnZhbGlkYXRlSW5wdXQoJ2V4dGVuc2lvbi1zZWxlY3RvcicpICYmIGlzVmFsaWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGlzVmFsaWQ7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgc3VibWl0VG9HaXRIdWIoaXNzdWVUaXRsZTogc3RyaW5nLCBpc3N1ZUJvZHk6IHN0cmluZywgZ2l0SHViRGV0YWlsczogeyBvd25lcjogc3RyaW5nOyByZXBvc2l0b3J5TmFtZTogc3RyaW5nIH0pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCB1cmwgPSBgaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy8ke2dpdEh1YkRldGFpbHMub3duZXJ9LyR7Z2l0SHViRGV0YWlscy5yZXBvc2l0b3J5TmFtZX0vaXNzdWVzYDtcblx0XHRjb25zdCBpbml0ID0ge1xuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRcdHRpdGxlOiBpc3N1ZVRpdGxlLFxuXHRcdFx0XHRib2R5OiBpc3N1ZUJvZHlcblx0XHRcdH0pLFxuXHRcdFx0aGVhZGVyczogbmV3IEhlYWRlcnMoe1xuXHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuXHRcdFx0XHQnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHt0aGlzLmRhdGEuZ2l0aHViQWNjZXNzVG9rZW59YCxcblx0XHRcdFx0J1VzZXItQWdlbnQnOiAncmVxdWVzdCdcblx0XHRcdH0pXG5cdFx0fTtcblxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCBpbml0KTtcblx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKCdJbnZhbGlkIEdpdEh1YiBVUkwgcHJvdmlkZWQuJyk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRtYWluV2luZG93Lm9wZW4ocmVzdWx0Lmh0bWxfdXJsLCAnX2JsYW5rJyk7XG5cdFx0dGhpcy5jbG9zZSgpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGNyZWF0ZUlzc3VlKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IHNlbGVjdGVkRXh0ZW5zaW9uID0gdGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZ2V0RGF0YSgpLnNlbGVjdGVkRXh0ZW5zaW9uO1xuXHRcdGNvbnN0IGhhc1VyaSA9IHRoaXMubm9uR2l0SHViSXNzdWVVcmw7XG5cdFx0Ly8gU2hvcnQgY2lyY3VpdCBpZiB0aGUgZXh0ZW5zaW9uIHByb3ZpZGVzIGEgY3VzdG9tIGlzc3VlIGhhbmRsZXJcblx0XHRpZiAoaGFzVXJpKSB7XG5cdFx0XHRjb25zdCB1cmwgPSB0aGlzLmdldEV4dGVuc2lvbkJ1Z3NVcmwoKTtcblx0XHRcdGlmICh1cmwpIHtcblx0XHRcdFx0dGhpcy5oYXNCZWVuU3VibWl0dGVkID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLnZhbGlkYXRlSW5wdXRzKCkpIHtcblx0XHRcdC8vIElmIGlucHV0cyBhcmUgaW52YWxpZCwgc2V0IGZvY3VzIHRvIHRoZSBmaXJzdCBvbmUgYW5kIGFkZCBsaXN0ZW5lcnMgb24gdGhlbVxuXHRcdFx0Ly8gdG8gZGV0ZWN0IGZ1cnRoZXIgY2hhbmdlc1xuXHRcdFx0Y29uc3QgaW52YWxpZElucHV0ID0gdGhpcy53aW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnaW52YWxpZC1pbnB1dCcpO1xuXHRcdFx0aWYgKGludmFsaWRJbnB1dC5sZW5ndGgpIHtcblx0XHRcdFx0KDxIVE1MSW5wdXRFbGVtZW50PmludmFsaWRJbnB1dFswXSkuZm9jdXMoKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5hZGRFdmVudExpc3RlbmVyKCdpc3N1ZS10aXRsZScsICdpbnB1dCcsIF8gPT4ge1xuXHRcdFx0XHR0aGlzLnZhbGlkYXRlSW5wdXQoJ2lzc3VlLXRpdGxlJyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5hZGRFdmVudExpc3RlbmVyKCdkZXNjcmlwdGlvbicsICdpbnB1dCcsIF8gPT4ge1xuXHRcdFx0XHR0aGlzLnZhbGlkYXRlSW5wdXQoJ2Rlc2NyaXB0aW9uJyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5hZGRFdmVudExpc3RlbmVyKCdpc3N1ZS1zb3VyY2UnLCAnY2hhbmdlJywgXyA9PiB7XG5cdFx0XHRcdHRoaXMudmFsaWRhdGVJbnB1dCgnaXNzdWUtc291cmNlJyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLmZpbGVPbkV4dGVuc2lvbigpKSB7XG5cdFx0XHRcdHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignZXh0ZW5zaW9uLXNlbGVjdG9yJywgJ2NoYW5nZScsIF8gPT4ge1xuXHRcdFx0XHRcdHRoaXMudmFsaWRhdGVJbnB1dCgnZXh0ZW5zaW9uLXNlbGVjdG9yJyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5oYXNCZWVuU3VibWl0dGVkID0gdHJ1ZTtcblxuXHRcdGNvbnN0IGlzc3VlVGl0bGUgPSAoPEhUTUxJbnB1dEVsZW1lbnQ+dGhpcy5nZXRFbGVtZW50QnlJZCgnaXNzdWUtdGl0bGUnKSkudmFsdWU7XG5cdFx0Y29uc3QgaXNzdWVCb2R5ID0gdGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuc2VyaWFsaXplKCk7XG5cblx0XHRsZXQgaXNzdWVVcmwgPSB0aGlzLmdldElzc3VlVXJsKCk7XG5cdFx0aWYgKCFpc3N1ZVVybCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcignTm8gaXNzdWUgdXJsIGZvdW5kJyk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHNlbGVjdGVkRXh0ZW5zaW9uPy51cmkpIHtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5yZXZpdmUoc2VsZWN0ZWRFeHRlbnNpb24udXJpKTtcblx0XHRcdGlzc3VlVXJsID0gdXJpLnRvU3RyaW5nKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZ2l0SHViRGV0YWlscyA9IHRoaXMucGFyc2VHaXRIdWJVcmwoaXNzdWVVcmwpO1xuXHRcdGlmICh0aGlzLmRhdGEuZ2l0aHViQWNjZXNzVG9rZW4gJiYgZ2l0SHViRGV0YWlscykge1xuXHRcdFx0cmV0dXJuIHRoaXMuc3VibWl0VG9HaXRIdWIoaXNzdWVUaXRsZSwgaXNzdWVCb2R5LCBnaXRIdWJEZXRhaWxzKTtcblx0XHR9XG5cblx0XHRjb25zdCBiYXNlVXJsID0gdGhpcy5nZXRJc3N1ZVVybFdpdGhUaXRsZSgoPEhUTUxJbnB1dEVsZW1lbnQ+dGhpcy5nZXRFbGVtZW50QnlJZCgnaXNzdWUtdGl0bGUnKSkudmFsdWUsIGlzc3VlVXJsKTtcblx0XHRsZXQgdXJsID0gYmFzZVVybCArIGAmYm9keT0ke2VuY29kZVVSSUNvbXBvbmVudChpc3N1ZUJvZHkpfWA7XG5cblx0XHRpZiAodXJsLmxlbmd0aCA+IE1BWF9VUkxfTEVOR1RIKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR1cmwgPSBhd2FpdCB0aGlzLndyaXRlVG9DbGlwYm9hcmQoYmFzZVVybCwgaXNzdWVCb2R5KTtcblx0XHRcdH0gY2F0Y2ggKF8pIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcignV3JpdGluZyB0byBjbGlwYm9hcmQgZmFpbGVkJyk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLndpbmRvdy5vcGVuKHVybCwgJ19ibGFuaycpO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgd3JpdGVUb0NsaXBib2FyZChiYXNlVXJsOiBzdHJpbmcsIGlzc3VlQm9keTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBzaG91bGRXcml0ZSA9IGF3YWl0IHRoaXMuaXNzdWVGb3JtU2VydmljZS5zaG93Q2xpcGJvYXJkRGlhbG9nKCk7XG5cdFx0aWYgKCFzaG91bGRXcml0ZSkge1xuXHRcdFx0dGhyb3cgbmV3IENhbmNlbGxhdGlvbkVycm9yKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGJhc2VVcmwgKyBgJmJvZHk9JHtlbmNvZGVVUklDb21wb25lbnQobG9jYWxpemUoJ3Bhc3RlRGF0YScsIFwiV2UgaGF2ZSB3cml0dGVuIHRoZSBuZWVkZWQgZGF0YSBpbnRvIHlvdXIgY2xpcGJvYXJkIGJlY2F1c2UgaXQgd2FzIHRvbyBsYXJnZSB0byBzZW5kLiBQbGVhc2UgcGFzdGUuXCIpKX1gO1xuXHR9XG5cblx0cHVibGljIGdldElzc3VlVXJsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLmZpbGVPbkV4dGVuc2lvbigpXG5cdFx0XHQ/IHRoaXMuZ2V0RXh0ZW5zaW9uR2l0SHViVXJsKClcblx0XHRcdDogdGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwuZ2V0RGF0YSgpLmZpbGVPbk1hcmtldHBsYWNlXG5cdFx0XHRcdD8gdGhpcy5wcm9kdWN0LnJlcG9ydE1hcmtldHBsYWNlSXNzdWVVcmwhXG5cdFx0XHRcdDogdGhpcy5wcm9kdWN0LnJlcG9ydElzc3VlVXJsITtcblx0fVxuXG5cdHB1YmxpYyBwYXJzZUdpdEh1YlVybCh1cmw6IHN0cmluZyk6IHVuZGVmaW5lZCB8IHsgcmVwb3NpdG9yeU5hbWU6IHN0cmluZzsgb3duZXI6IHN0cmluZyB9IHtcblx0XHQvLyBBc3N1bWVzIGEgR2l0SHViIHVybCB0byBhIHBhcnRpY3VsYXIgcmVwbywgaHR0cHM6Ly9naXRodWIuY29tL3JlcG9zaXRvcnlOYW1lL293bmVyLlxuXHRcdC8vIFJlcG9zaXRvcnkgbmFtZSBhbmQgb3duZXIgY2Fubm90IGNvbnRhaW4gJy8nXG5cdFx0Y29uc3QgbWF0Y2ggPSAvXmh0dHBzPzpcXC9cXC9naXRodWJcXC5jb21cXC8oW15cXC9dKilcXC8oW15cXC9dKikuKi8uZXhlYyh1cmwpO1xuXHRcdGlmIChtYXRjaCAmJiBtYXRjaC5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdG93bmVyOiBtYXRjaFsxXSxcblx0XHRcdFx0cmVwb3NpdG9yeU5hbWU6IG1hdGNoWzJdXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKCdObyBHaXRIdWIgaXNzdWVzIG1hdGNoJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RXh0ZW5zaW9uR2l0SHViVXJsKCk6IHN0cmluZyB7XG5cdFx0bGV0IHJlcG9zaXRvcnlVcmwgPSAnJztcblx0XHRjb25zdCBidWdzVXJsID0gdGhpcy5nZXRFeHRlbnNpb25CdWdzVXJsKCk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uVXJsID0gdGhpcy5nZXRFeHRlbnNpb25SZXBvc2l0b3J5VXJsKCk7XG5cdFx0Ly8gSWYgZ2l2ZW4sIHRyeSB0byBtYXRjaCB0aGUgZXh0ZW5zaW9uJ3MgYnVnIHVybFxuXHRcdGlmIChidWdzVXJsICYmIGJ1Z3NVcmwubWF0Y2goL15odHRwcz86XFwvXFwvZ2l0aHViXFwuY29tXFwvKFteXFwvXSopXFwvKFteXFwvXSopXFwvPyhcXC9pc3N1ZXMpPyQvKSkge1xuXHRcdFx0Ly8gbWF0Y2hlcyBleGFjdGx5OiBodHRwczovL2dpdGh1Yi5jb20vb3duZXIvcmVwby9pc3N1ZXNcblx0XHRcdHJlcG9zaXRvcnlVcmwgPSBub3JtYWxpemVHaXRIdWJVcmwoYnVnc1VybCk7XG5cdFx0fSBlbHNlIGlmIChleHRlbnNpb25VcmwgJiYgZXh0ZW5zaW9uVXJsLm1hdGNoKC9eaHR0cHM/OlxcL1xcL2dpdGh1YlxcLmNvbVxcLyhbXlxcL10qKVxcLyhbXlxcL10qKSQvKSkge1xuXHRcdFx0Ly8gbWF0Y2hlcyBleGFjdGx5OiBodHRwczovL2dpdGh1Yi5jb20vb3duZXIvcmVwb1xuXHRcdFx0cmVwb3NpdG9yeVVybCA9IG5vcm1hbGl6ZUdpdEh1YlVybChleHRlbnNpb25VcmwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm5vbkdpdEh1Yklzc3VlVXJsID0gdHJ1ZTtcblx0XHRcdHJlcG9zaXRvcnlVcmwgPSBidWdzVXJsIHx8IGV4dGVuc2lvblVybCB8fCAnJztcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVwb3NpdG9yeVVybDtcblx0fVxuXG5cdHB1YmxpYyBnZXRJc3N1ZVVybFdpdGhUaXRsZShpc3N1ZVRpdGxlOiBzdHJpbmcsIHJlcG9zaXRvcnlVcmw6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLmZpbGVPbkV4dGVuc2lvbigpKSB7XG5cdFx0XHRyZXBvc2l0b3J5VXJsID0gcmVwb3NpdG9yeVVybCArICcvaXNzdWVzL25ldyc7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcXVlcnlTdHJpbmdQcmVmaXggPSByZXBvc2l0b3J5VXJsLmluZGV4T2YoJz8nKSA9PT0gLTEgPyAnPycgOiAnJic7XG5cdFx0cmV0dXJuIGAke3JlcG9zaXRvcnlVcmx9JHtxdWVyeVN0cmluZ1ByZWZpeH10aXRsZT0ke2VuY29kZVVSSUNvbXBvbmVudChpc3N1ZVRpdGxlKX1gO1xuXHR9XG5cblx0cHVibGljIGNsZWFyRXh0ZW5zaW9uRGF0YSgpOiB2b2lkIHtcblx0XHR0aGlzLm5vbkdpdEh1Yklzc3VlVXJsID0gZmFsc2U7XG5cdFx0dGhpcy5pc3N1ZVJlcG9ydGVyTW9kZWwudXBkYXRlKHsgZXh0ZW5zaW9uRGF0YTogdW5kZWZpbmVkIH0pO1xuXHRcdHRoaXMuZGF0YS5pc3N1ZUJvZHkgPSB0aGlzLmRhdGEuaXNzdWVCb2R5IHx8ICcnO1xuXHRcdHRoaXMuZGF0YS5kYXRhID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuZGF0YS51cmkgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgdXBkYXRlRXh0ZW5zaW9uU3RhdHVzKGV4dGVuc2lvbjogSXNzdWVSZXBvcnRlckV4dGVuc2lvbkRhdGEpIHtcblx0XHR0aGlzLmlzc3VlUmVwb3J0ZXJNb2RlbC51cGRhdGUoeyBzZWxlY3RlZEV4dGVuc2lvbjogZXh0ZW5zaW9uIH0pO1xuXG5cdFx0Ly8gdXNlcyB0aGlzLmNvbmZpZ3V1cmF0aW9uLmRhdGEgdG8gZW5zdXJlIHRoYXQgZGF0YSBpcyBjb21pbmcgZnJvbSBgb3BlblJlcG9ydGVyYCBjb21tYW5kLlxuXHRcdGNvbnN0IHRlbXBsYXRlID0gdGhpcy5kYXRhLmlzc3VlQm9keTtcblx0XHRpZiAodGVtcGxhdGUpIHtcblx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uVGV4dEFyZWEgPSB0aGlzLmdldEVsZW1lbnRCeUlkKCdkZXNjcmlwdGlvbicpITtcblx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uVGV4dCA9IChkZXNjcmlwdGlvblRleHRBcmVhIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQpLnZhbHVlO1xuXHRcdFx0aWYgKGRlc2NyaXB0aW9uVGV4dCA9PT0gJycgfHwgIWRlc2NyaXB0aW9uVGV4dC5pbmNsdWRlcyh0ZW1wbGF0ZS50b1N0cmluZygpKSkge1xuXHRcdFx0XHRjb25zdCBmdWxsVGV4dEFyZWEgPSBkZXNjcmlwdGlvblRleHQgKyAoZGVzY3JpcHRpb25UZXh0ID09PSAnJyA/ICcnIDogJ1xcbicpICsgdGVtcGxhdGUudG9TdHJpbmcoKTtcblx0XHRcdFx0KGRlc2NyaXB0aW9uVGV4dEFyZWEgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkudmFsdWUgPSBmdWxsVGV4dEFyZWE7XG5cdFx0XHRcdHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLnVwZGF0ZSh7IGlzc3VlRGVzY3JpcHRpb246IGZ1bGxUZXh0QXJlYSB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBkYXRhID0gdGhpcy5kYXRhLmRhdGE7XG5cdFx0aWYgKGRhdGEpIHtcblx0XHRcdHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLnVwZGF0ZSh7IGV4dGVuc2lvbkRhdGE6IGRhdGEgfSk7XG5cdFx0XHRleHRlbnNpb24uZGF0YSA9IGRhdGE7XG5cdFx0XHRjb25zdCBleHRlbnNpb25EYXRhQmxvY2sgPSB0aGlzLndpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuYmxvY2stZXh0ZW5zaW9uLWRhdGEnKSE7XG5cdFx0XHRzaG93KGV4dGVuc2lvbkRhdGFCbG9jayk7XG5cdFx0XHR0aGlzLnJlbmRlckJsb2NrcygpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVyaSA9IHRoaXMuZGF0YS51cmk7XG5cdFx0aWYgKHVyaSkge1xuXHRcdFx0ZXh0ZW5zaW9uLnVyaSA9IHVyaTtcblx0XHRcdHRoaXMudXBkYXRlSXNzdWVSZXBvcnRlclVyaShleHRlbnNpb24pO1xuXHRcdH1cblxuXHRcdHRoaXMudmFsaWRhdGVTZWxlY3RlZEV4dGVuc2lvbigpO1xuXHRcdGNvbnN0IHRpdGxlID0gKDxIVE1MSW5wdXRFbGVtZW50PnRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2lzc3VlLXRpdGxlJykpLnZhbHVlO1xuXHRcdHRoaXMuc2VhcmNoRXh0ZW5zaW9uSXNzdWVzKHRpdGxlKTtcblxuXHRcdHRoaXMudXBkYXRlUHJldmlld0J1dHRvblN0YXRlKCk7XG5cdFx0dGhpcy5yZW5kZXJCbG9ja3MoKTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZVNlbGVjdGVkRXh0ZW5zaW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IGV4dGVuc2lvblZhbGlkYXRpb25NZXNzYWdlID0gdGhpcy5nZXRFbGVtZW50QnlJZCgnZXh0ZW5zaW9uLXNlbGVjdGlvbi12YWxpZGF0aW9uLWVycm9yJykhO1xuXHRcdGNvbnN0IGV4dGVuc2lvblZhbGlkYXRpb25Ob1VybHNNZXNzYWdlID0gdGhpcy5nZXRFbGVtZW50QnlJZCgnZXh0ZW5zaW9uLXNlbGVjdGlvbi12YWxpZGF0aW9uLWVycm9yLW5vLXVybCcpITtcblx0XHRoaWRlKGV4dGVuc2lvblZhbGlkYXRpb25NZXNzYWdlKTtcblx0XHRoaWRlKGV4dGVuc2lvblZhbGlkYXRpb25Ob1VybHNNZXNzYWdlKTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbiA9IHRoaXMuaXNzdWVSZXBvcnRlck1vZGVsLmdldERhdGEoKS5zZWxlY3RlZEV4dGVuc2lvbjtcblx0XHRpZiAoIWV4dGVuc2lvbikge1xuXHRcdFx0dGhpcy5wcmV2aWV3QnV0dG9uLmVuYWJsZWQgPSB0cnVlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmxvYWRpbmdFeHRlbnNpb25EYXRhKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzVmFsaWRHaXRIdWJVcmwgPSB0aGlzLmdldEV4dGVuc2lvbkdpdEh1YlVybCgpO1xuXHRcdGlmIChoYXNWYWxpZEdpdEh1YlVybCkge1xuXHRcdFx0dGhpcy5wcmV2aWV3QnV0dG9uLmVuYWJsZWQgPSB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNldEV4dGVuc2lvblZhbGlkYXRpb25NZXNzYWdlKCk7XG5cdFx0XHR0aGlzLnByZXZpZXdCdXR0b24uZW5hYmxlZCA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBzZXRMb2FkaW5nKGVsZW1lbnQ6IEhUTUxFbGVtZW50KSB7XG5cdFx0Ly8gU2hvdyBsb2FkaW5nXG5cdFx0dGhpcy5vcGVuUmVwb3J0ZXIgPSB0cnVlO1xuXHRcdHRoaXMubG9hZGluZ0V4dGVuc2lvbkRhdGEgPSB0cnVlO1xuXHRcdHRoaXMudXBkYXRlUHJldmlld0J1dHRvblN0YXRlKCk7XG5cblx0XHRjb25zdCBleHRlbnNpb25EYXRhQ2FwdGlvbiA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2V4dGVuc2lvbi1pZCcpITtcblx0XHRoaWRlKGV4dGVuc2lvbkRhdGFDYXB0aW9uKTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbkRhdGFDYXB0aW9uMiA9IEFycmF5LmZyb20odGhpcy53aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmV4dC1wYXJlbnMnKSk7XG5cdFx0ZXh0ZW5zaW9uRGF0YUNhcHRpb24yLmZvckVhY2goZXh0ZW5zaW9uRGF0YUNhcHRpb24yID0+IGhpZGUoZXh0ZW5zaW9uRGF0YUNhcHRpb24yKSk7XG5cblx0XHRjb25zdCBzaG93TG9hZGluZyA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2V4dC1sb2FkaW5nJykhO1xuXHRcdHNob3coc2hvd0xvYWRpbmcpO1xuXHRcdHdoaWxlIChzaG93TG9hZGluZy5maXJzdENoaWxkKSB7XG5cdFx0XHRzaG93TG9hZGluZy5maXJzdENoaWxkLnJlbW92ZSgpO1xuXHRcdH1cblx0XHRzaG93TG9hZGluZy5hcHBlbmQoZWxlbWVudCk7XG5cblx0XHR0aGlzLnJlbmRlckJsb2NrcygpO1xuXHR9XG5cblx0cHVibGljIHJlbW92ZUxvYWRpbmcoZWxlbWVudDogSFRNTEVsZW1lbnQsIGZyb21SZXBvcnRlcjogYm9vbGVhbiA9IGZhbHNlKSB7XG5cdFx0dGhpcy5vcGVuUmVwb3J0ZXIgPSBmcm9tUmVwb3J0ZXI7XG5cdFx0dGhpcy5sb2FkaW5nRXh0ZW5zaW9uRGF0YSA9IGZhbHNlO1xuXHRcdHRoaXMudXBkYXRlUHJldmlld0J1dHRvblN0YXRlKCk7XG5cblx0XHRjb25zdCBleHRlbnNpb25EYXRhQ2FwdGlvbiA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2V4dGVuc2lvbi1pZCcpITtcblx0XHRzaG93KGV4dGVuc2lvbkRhdGFDYXB0aW9uKTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbkRhdGFDYXB0aW9uMiA9IEFycmF5LmZyb20odGhpcy53aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmV4dC1wYXJlbnMnKSk7XG5cdFx0ZXh0ZW5zaW9uRGF0YUNhcHRpb24yLmZvckVhY2goZXh0ZW5zaW9uRGF0YUNhcHRpb24yID0+IHNob3coZXh0ZW5zaW9uRGF0YUNhcHRpb24yKSk7XG5cblx0XHRjb25zdCBoaWRlTG9hZGluZyA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2V4dC1sb2FkaW5nJykhO1xuXHRcdGhpZGUoaGlkZUxvYWRpbmcpO1xuXHRcdGlmIChoaWRlTG9hZGluZy5maXJzdENoaWxkKSB7XG5cdFx0XHRlbGVtZW50LnJlbW92ZSgpO1xuXHRcdH1cblx0XHR0aGlzLnJlbmRlckJsb2NrcygpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRFeHRlbnNpb25WYWxpZGF0aW9uTWVzc2FnZSgpOiB2b2lkIHtcblx0XHRjb25zdCBleHRlbnNpb25WYWxpZGF0aW9uTWVzc2FnZSA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2V4dGVuc2lvbi1zZWxlY3Rpb24tdmFsaWRhdGlvbi1lcnJvcicpITtcblx0XHRjb25zdCBleHRlbnNpb25WYWxpZGF0aW9uTm9VcmxzTWVzc2FnZSA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2V4dGVuc2lvbi1zZWxlY3Rpb24tdmFsaWRhdGlvbi1lcnJvci1uby11cmwnKSE7XG5cdFx0Y29uc3QgYnVnc1VybCA9IHRoaXMuZ2V0RXh0ZW5zaW9uQnVnc1VybCgpO1xuXHRcdGlmIChidWdzVXJsKSB7XG5cdFx0XHRzaG93KGV4dGVuc2lvblZhbGlkYXRpb25NZXNzYWdlKTtcblx0XHRcdGNvbnN0IGxpbmsgPSB0aGlzLmdldEVsZW1lbnRCeUlkKCdleHRlbnNpb25CdWdzTGluaycpITtcblx0XHRcdGxpbmsudGV4dENvbnRlbnQgPSBidWdzVXJsO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4dGVuc2lvblVybCA9IHRoaXMuZ2V0RXh0ZW5zaW9uUmVwb3NpdG9yeVVybCgpO1xuXHRcdGlmIChleHRlbnNpb25VcmwpIHtcblx0XHRcdHNob3coZXh0ZW5zaW9uVmFsaWRhdGlvbk1lc3NhZ2UpO1xuXHRcdFx0Y29uc3QgbGluayA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoJ2V4dGVuc2lvbkJ1Z3NMaW5rJyk7XG5cdFx0XHRsaW5rIS50ZXh0Q29udGVudCA9IGV4dGVuc2lvblVybDtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzaG93KGV4dGVuc2lvblZhbGlkYXRpb25Ob1VybHNNZXNzYWdlKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlUHJvY2Vzc0luZm8oc3RhdGU6IElzc3VlUmVwb3J0ZXJNb2RlbERhdGEpIHtcblx0XHRjb25zdCB0YXJnZXQgPSB0aGlzLndpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuYmxvY2stcHJvY2VzcyAuYmxvY2staW5mbycpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGlmICh0YXJnZXQpIHtcblx0XHRcdHJlc2V0KHRhcmdldCwgJCgnY29kZScsIHVuZGVmaW5lZCwgc3RhdGUucHJvY2Vzc0luZm8gPz8gJycpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVdvcmtzcGFjZUluZm8oc3RhdGU6IElzc3VlUmVwb3J0ZXJNb2RlbERhdGEpIHtcblx0XHR0aGlzLndpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuYmxvY2std29ya3NwYWNlIC5ibG9jay1pbmZvIGNvZGUnKSEudGV4dENvbnRlbnQgPSAnXFxuJyArIHN0YXRlLndvcmtzcGFjZUluZm87XG5cdH1cblxuXHRwdWJsaWMgdXBkYXRlRXh0ZW5zaW9uVGFibGUoZXh0ZW5zaW9uczogSXNzdWVSZXBvcnRlckV4dGVuc2lvbkRhdGFbXSwgbnVtVGhlbWVFeHRlbnNpb25zOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCB0YXJnZXQgPSB0aGlzLndpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmJsb2NrLWV4dGVuc2lvbnMgLmJsb2NrLWluZm8nKTtcblx0XHRpZiAodGFyZ2V0KSB7XG5cdFx0XHRpZiAodGhpcy5kaXNhYmxlRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRyZXNldCh0YXJnZXQsIGxvY2FsaXplKCdkaXNhYmxlZEV4dGVuc2lvbnMnLCBcIkV4dGVuc2lvbnMgYXJlIGRpc2FibGVkXCIpKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0aGVtZUV4Y2x1c2lvblN0ciA9IG51bVRoZW1lRXh0ZW5zaW9ucyA/IGBcXG4oJHtudW1UaGVtZUV4dGVuc2lvbnN9IHRoZW1lIGV4dGVuc2lvbnMgZXhjbHVkZWQpYCA6ICcnO1xuXHRcdFx0ZXh0ZW5zaW9ucyA9IGV4dGVuc2lvbnMgfHwgW107XG5cblx0XHRcdGlmICghZXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0dGFyZ2V0LmlubmVyVGV4dCA9ICdFeHRlbnNpb25zOiBub25lJyArIHRoZW1lRXhjbHVzaW9uU3RyO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHJlc2V0KHRhcmdldCwgdGhpcy5nZXRFeHRlbnNpb25UYWJsZUh0bWwoZXh0ZW5zaW9ucyksIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRoZW1lRXhjbHVzaW9uU3RyKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRFeHRlbnNpb25UYWJsZUh0bWwoZXh0ZW5zaW9uczogSXNzdWVSZXBvcnRlckV4dGVuc2lvbkRhdGFbXSk6IEhUTUxUYWJsZUVsZW1lbnQge1xuXHRcdHJldHVybiAkKCd0YWJsZScsIHVuZGVmaW5lZCxcblx0XHRcdCQoJ3RyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHQkKCd0aCcsIHVuZGVmaW5lZCwgJ0V4dGVuc2lvbicpLFxuXHRcdFx0XHQkKCd0aCcsIHVuZGVmaW5lZCwgJ0F1dGhvciAodHJ1bmNhdGVkKScgYXMgc3RyaW5nKSxcblx0XHRcdFx0JCgndGgnLCB1bmRlZmluZWQsICdWZXJzaW9uJylcblx0XHRcdCksXG5cdFx0XHQuLi5leHRlbnNpb25zLm1hcChleHRlbnNpb24gPT4gJCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdCQoJ3RkJywgdW5kZWZpbmVkLCBleHRlbnNpb24ubmFtZSksXG5cdFx0XHRcdCQoJ3RkJywgdW5kZWZpbmVkLCBleHRlbnNpb24ucHVibGlzaGVyPy5zdWJzdHIoMCwgMykgPz8gJ04vQScpLFxuXHRcdFx0XHQkKCd0ZCcsIHVuZGVmaW5lZCwgZXh0ZW5zaW9uLnZlcnNpb24pXG5cdFx0XHQpKVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIG9wZW5MaW5rKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHQvLyBFeGNsdWRlIHJpZ2h0IGNsaWNrXG5cdFx0aWYgKGV2ZW50LndoaWNoIDwgMykge1xuXHRcdFx0d2luZG93T3Blbk5vT3BlbmVyKCg8SFRNTEFuY2hvckVsZW1lbnQ+ZXZlbnQudGFyZ2V0KS5ocmVmKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0RWxlbWVudEJ5SWQ8VCBleHRlbmRzIEhUTUxFbGVtZW50ID0gSFRNTEVsZW1lbnQ+KGVsZW1lbnRJZDogc3RyaW5nKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IHRoaXMud2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGVsZW1lbnRJZCkgYXMgVCB8IHVuZGVmaW5lZDtcblx0XHRpZiAoZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFkZEV2ZW50TGlzdGVuZXIoZWxlbWVudElkOiBzdHJpbmcsIGV2ZW50VHlwZTogc3RyaW5nLCBoYW5kbGVyOiAoZXZlbnQ6IEV2ZW50KSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0RWxlbWVudEJ5SWQoZWxlbWVudElkKTtcblx0XHRlbGVtZW50Py5hZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgaGFuZGxlcik7XG5cdH1cbn1cblxuLy8gaGVscGVyIGZ1bmN0aW9uc1xuXG5leHBvcnQgZnVuY3Rpb24gaGlkZShlbDogRWxlbWVudCB8IHVuZGVmaW5lZCB8IG51bGwpIHtcblx0ZWw/LmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHNob3coZWw6IEVsZW1lbnQgfCB1bmRlZmluZWQgfCBudWxsKSB7XG5cdGVsPy5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBSUEsU0FBUyxHQUFHLG9CQUFvQix1QkFBdUIsT0FBTywwQkFBMEI7QUFDeEYsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxRQUFRLDRCQUE0QjtBQUM3QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLFNBQVMsd0JBQXdCO0FBQzFDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBZTtB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QUFTO0FBQ1osYUFBTztBQUFBLElBQ1IsT0FBTztBQUNOLGFBQU87QUFBQSxJQUNSO0FBQUEsRUFDRDtBQUFBLEVBRU8saUJBQWlCLFdBQW1CLFdBQW1CLFNBQXVDO0FBQ3BHLFVBQU0sVUFBVSxLQUFLLGVBQWUsU0FBUztBQUM3QyxhQUFTLGlCQUFpQixXQUFXLE9BQU87QUFBQSxFQUM3QztBQUNEO0FBdHNCUztBQUFBLEVBRFAsU0FBUyxHQUFHO0FBQUEsR0EzcEJELHlCQTRwQko7QUFrQ0E7QUFBQSxFQURQLFNBQVMsR0FBRztBQUFBLEdBN3JCRCx5QkE4ckJKO0FBOXJCSSwyQkFBTjtBQUFBLEVBMkJKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0E5QlU7QUFzMkNOLFNBQVMsS0FBSyxJQUFnQztBQUNwRCxNQUFJLFVBQVUsSUFBSSxRQUFRO0FBQzNCO0FBQ08sU0FBUyxLQUFLLElBQWdDO0FBQ3BELE1BQUksVUFBVSxPQUFPLFFBQVE7QUFDOUI7IiwKICAibmFtZXMiOiBbIklzc3VlU291cmNlIiwgImV4dGVuc2lvbnMiLCAic2VsZWN0ZWRFeHRlbnNpb24iLCAiaXNzdWVUeXBlIiwgInVybCIsICJleHRlbnNpb25EYXRhQ2FwdGlvbjIiXQp9Cg==
