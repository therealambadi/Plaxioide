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
import { $, addDisposableListener, append, clearNode, reset } from "../../../../base/browser/dom.js";
import { renderFormattedText } from "../../../../base/browser/formattedTextRenderer.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { Toggle } from "../../../../base/browser/ui/toggle/toggle.js";
import { coalesce, equals } from "../../../../base/common/arrays.js";
import { Delayer, Throttler } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { splitRecentLabel } from "../../../../base/common/labels.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { parse } from "../../../../base/common/marshalling.js";
import { Schemas, matchesScheme } from "../../../../base/common/network.js";
import { isMacintosh, OS } from "../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import "./media/gettingStarted.css";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { MarkdownRenderer } from "../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { localize } from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService, Verbosity } from "../../../../platform/label/common/label.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService, TelemetryLevel, firstSessionDateStorageKey } from "../../../../platform/telemetry/common/telemetry.js";
import { getTelemetryLevel } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { defaultButtonStyles, defaultKeybindingLabelStyles, defaultToggleStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IWorkspaceContextService, UNKNOWN_EMPTY_WINDOW_WORKSPACE } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspacesService, isRecentFolder, isRecentWorkspace } from "../../../../platform/workspaces/common/workspaces.js";
import { OpenRecentAction } from "../../../browser/actions/windowActions.js";
import { OpenFileFolderAction, OpenFolderAction, OpenFolderViaWorkspaceAction } from "../../../browser/actions/workspaceActions.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { WorkbenchStateContext } from "../../../common/contextkeys.js";
import { IWebviewService } from "../../webview/browser/webview.js";
import "./gettingStartedColors.js";
import { GettingStartedDetailsRenderer } from "./gettingStartedDetailsRenderer.js";
import { gettingStartedCheckedCodicon, gettingStartedUncheckedCodicon } from "./gettingStartedIcons.js";
import { GettingStartedInput } from "./gettingStartedInput.js";
import { IWalkthroughsService, hiddenEntriesConfigurationKey, parseDescription } from "./gettingStartedService.js";
import { restoreWalkthroughsConfigurationKey } from "./startupPage.js";
import { startEntries } from "../common/gettingStartedContent.js";
import { GroupDirection, GroupsOrder, IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IWorkbenchThemeService } from "../../../services/themes/common/workbenchThemeService.js";
import { GettingStartedIndexList } from "./gettingStartedList.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibleViewAction } from "../../accessibility/browser/accessibleViewActions.js";
import { KeybindingLabel } from "../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { ScrollbarVisibility } from "../../../../base/common/scrollable.js";
const SLIDE_TRANSITION_TIME_MS = 250;
const configurationKey = "workbench.startupEditor";
const allWalkthroughsHiddenContext = new RawContextKey("allWalkthroughsHidden", false);
const inWelcomeContext = new RawContextKey("inWelcome", false);
const parsedStartEntries = startEntries.map((e, i) => ({
  command: e.content.command,
  description: e.description,
  icon: { type: "icon", icon: e.icon },
  id: e.id,
  order: i,
  title: e.title,
  when: ContextKeyExpr.deserialize(e.when) ?? ContextKeyExpr.true()
}));
const REDUCED_MOTION_KEY = "workbench.welcomePage.preferReducedMotion";
let GettingStartedPage = class extends EditorPane {
  constructor(group, commandService, productService, keybindingService, gettingStartedService, configurationService, telemetryService, languageService, fileService, openerService, themeService, storageService, extensionService, instantiationService, notificationService, groupsService, contextService, quickInputService, workspacesService, labelService, hostService, webviewService, workspaceContextService, accessibilityService) {
    super(GettingStartedPage.ID, group, telemetryService, themeService, storageService);
    this.commandService = commandService;
    this.productService = productService;
    this.keybindingService = keybindingService;
    this.gettingStartedService = gettingStartedService;
    this.configurationService = configurationService;
    this.languageService = languageService;
    this.fileService = fileService;
    this.openerService = openerService;
    this.themeService = themeService;
    this.storageService = storageService;
    this.extensionService = extensionService;
    this.instantiationService = instantiationService;
    this.notificationService = notificationService;
    this.groupsService = groupsService;
    this.quickInputService = quickInputService;
    this.workspacesService = workspacesService;
    this.labelService = labelService;
    this.hostService = hostService;
    this.webviewService = webviewService;
    this.workspaceContextService = workspaceContextService;
    this.accessibilityService = accessibilityService;
    this.inProgressScroll = Promise.resolve();
    this.dispatchListeners = new DisposableStore();
    this.stepDisposables = new DisposableStore();
    this.detailsPageDisposables = new DisposableStore();
    this.mediaDisposables = new DisposableStore();
    this.buildSlideThrottle = new Throttler();
    this.hasScrolledToFirstCategory = false;
    this.showFeaturedWalkthrough = true;
    this.currentMediaComponent = void 0;
    this.currentMediaType = void 0;
    this.container = $(
      ".gettingStartedContainer",
      {
        role: "document",
        tabindex: 0,
        "aria-label": localize("welcomeAriaLabel", "Overview of how to get up to speed with your editor.")
      }
    );
    this.stepMediaComponent = $(".getting-started-media");
    this.stepMediaComponent.id = generateUuid();
    this.categoriesSlideDisposables = this._register(new DisposableStore());
    this.detailsRenderer = new GettingStartedDetailsRenderer(this.fileService, this.notificationService, this.extensionService, this.languageService);
    this.contextService = this._register(contextService.createScoped(this.container));
    inWelcomeContext.bindTo(this.contextService).set(true);
    this.gettingStartedCategories = this.gettingStartedService.getWalkthroughs();
    this._register(this.dispatchListeners);
    this.buildSlideThrottle = new Throttler();
    const rerender = () => {
      this.gettingStartedCategories = this.gettingStartedService.getWalkthroughs();
      if (this.currentWalkthrough) {
        const existingSteps = this.currentWalkthrough.steps.map((step) => step.id);
        const newCategory = this.gettingStartedCategories.find((category) => this.currentWalkthrough?.id === category.id);
        if (newCategory) {
          const newSteps = newCategory.steps.map((step) => step.id);
          if (!equals(newSteps, existingSteps)) {
            this.buildSlideThrottle.queue(() => this.buildCategoriesSlide());
          }
        }
      } else {
        this.buildSlideThrottle.queue(() => this.buildCategoriesSlide());
      }
    };
    this._register(this.gettingStartedService.onDidAddWalkthrough(rerender));
    this._register(this.gettingStartedService.onDidRemoveWalkthrough(rerender));
    this.recentlyOpened = this.workspacesService.getRecentlyOpened();
    this._register(workspacesService.onDidChangeRecentlyOpened(() => {
      this.recentlyOpened = workspacesService.getRecentlyOpened();
      rerender();
    }));
    this._register(this.gettingStartedService.onDidChangeWalkthrough((category) => {
      const ourCategory = this.gettingStartedCategories.find((c) => c.id === category.id);
      if (!ourCategory) {
        return;
      }
      ourCategory.title = category.title;
      ourCategory.description = category.description;
      this.container.querySelectorAll(`[x-category-title-for="${category.id}"]`).forEach((step) => step.innerText = ourCategory.title);
      this.container.querySelectorAll(`[x-category-description-for="${category.id}"]`).forEach((step) => step.innerText = ourCategory.description);
    }));
    this._register(this.gettingStartedService.onDidProgressStep((step) => {
      const category = this.gettingStartedCategories.find((category2) => category2.id === step.category);
      if (!category) {
        throw Error("Could not find category with ID: " + step.category);
      }
      const ourStep = category.steps.find((_step) => _step.id === step.id);
      if (!ourStep) {
        throw Error("Could not find step with ID: " + step.id);
      }
      const stats = this.getWalkthroughCompletionStats(category);
      if (!ourStep.done && stats.stepsComplete === stats.stepsTotal - 1) {
        this.hideCategory(category.id);
      }
      this._register(this.configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(REDUCED_MOTION_KEY)) {
          this.container.classList.toggle("animatable", this.shouldAnimate());
        }
      }));
      ourStep.done = step.done;
      if (category.id === this.currentWalkthrough?.id) {
        const badgeelements = assertIsDefined(this.window.document.querySelectorAll(`[data-done-step-id="${step.id}"]`));
        badgeelements.forEach((badgeelement) => {
          if (step.done) {
            badgeelement.setAttribute("aria-checked", "true");
            badgeelement.parentElement?.setAttribute("aria-checked", "true");
            badgeelement.classList.remove(...ThemeIcon.asClassNameArray(gettingStartedUncheckedCodicon));
            badgeelement.classList.add("complete", ...ThemeIcon.asClassNameArray(gettingStartedCheckedCodicon));
            badgeelement.setAttribute("aria-label", localize("stepDone", "Checkbox for Step {0}: Completed", step.title));
          } else {
            badgeelement.setAttribute("aria-checked", "false");
            badgeelement.parentElement?.setAttribute("aria-checked", "false");
            badgeelement.classList.remove("complete", ...ThemeIcon.asClassNameArray(gettingStartedCheckedCodicon));
            badgeelement.classList.add(...ThemeIcon.asClassNameArray(gettingStartedUncheckedCodicon));
            badgeelement.setAttribute("aria-label", localize("stepNotDone", "Checkbox for Step {0}: Not completed", step.title));
          }
        });
      }
      this.updateCategoryProgress();
    }));
    this._register(this.storageService.onWillSaveState((e) => {
      if (e.reason !== WillSaveStateReason.SHUTDOWN) {
        return;
      }
      if (this.workspaceContextService.getWorkspace().folders.length !== 0) {
        return;
      }
      if (!this.editorInput || !this.currentWalkthrough || !this.editorInput.selectedCategory || !this.editorInput.selectedStep) {
        return;
      }
      const editorPane = this.groupsService.activeGroup.activeEditorPane;
      if (!(editorPane instanceof GettingStartedPage)) {
        return;
      }
      const restoreData = { folder: UNKNOWN_EMPTY_WINDOW_WORKSPACE.id, category: this.editorInput.selectedCategory, step: this.editorInput.selectedStep };
      this.storageService.store(
        restoreWalkthroughsConfigurationKey,
        JSON.stringify(restoreData),
        StorageScope.PROFILE,
        StorageTarget.MACHINE
      );
    }));
  }
  // remove when 'workbench.welcomePage.preferReducedMotion' deprecated
  shouldAnimate() {
    if (this.configurationService.getValue(REDUCED_MOTION_KEY)) {
      return false;
    }
    if (this.accessibilityService.isMotionReduced()) {
      return false;
    }
    return true;
  }
  getWalkthroughCompletionStats(walkthrough) {
    const activeSteps = walkthrough.steps.filter((s) => this.contextService.contextMatchesRules(s.when));
    return {
      stepsComplete: activeSteps.filter((s) => s.done).length,
      stepsTotal: activeSteps.length
    };
  }
  async setInput(newInput, options, context, token) {
    this.container.classList.remove("animatable");
    this.editorInput = newInput;
    await super.setInput(newInput, options, context, token);
    await this.buildCategoriesSlide();
    if (this.shouldAnimate()) {
      setTimeout(() => this.container.classList.add("animatable"), 0);
    }
  }
  async makeCategoryVisibleWhenAvailable(categoryID, stepId) {
    this.scrollToCategory(categoryID, stepId);
  }
  registerDispatchListeners() {
    this.dispatchListeners.clear();
    this.container.querySelectorAll("[x-dispatch]").forEach((element) => {
      const dispatch = element.getAttribute("x-dispatch") ?? "";
      let command, argument;
      if (dispatch.startsWith("openLink:https")) {
        [command, argument] = ["openLink", dispatch.replace("openLink:", "")];
      } else {
        [command, argument] = dispatch.split(":");
      }
      if (command) {
        this.dispatchListeners.add(addDisposableListener(element, "click", (e) => {
          e.stopPropagation();
          this.runDispatchCommand(command, argument);
        }));
        this.dispatchListeners.add(addDisposableListener(element, "keyup", (e) => {
          const keyboardEvent = new StandardKeyboardEvent(e);
          e.stopPropagation();
          switch (keyboardEvent.keyCode) {
            case KeyCode.Enter:
            case KeyCode.Space:
              this.runDispatchCommand(command, argument);
              return;
          }
        }));
      }
    });
  }
  async runDispatchCommand(command, argument) {
    this.commandService.executeCommand("workbench.action.keepEditor");
    this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command, argument, walkthroughId: this.currentWalkthrough?.id });
    switch (command) {
      case "scrollPrev": {
        this.scrollPrev();
        break;
      }
      case "skip": {
        this.runSkip();
        break;
      }
      case "showMoreRecents": {
        this.commandService.executeCommand(OpenRecentAction.ID);
        break;
      }
      case "seeAllWalkthroughs": {
        await this.openWalkthroughSelector();
        break;
      }
      case "openFolder": {
        if (this.contextService.contextMatchesRules(ContextKeyExpr.and(WorkbenchStateContext.isEqualTo("workspace")))) {
          this.commandService.executeCommand(OpenFolderViaWorkspaceAction.ID);
        } else {
          this.commandService.executeCommand(isMacintosh ? "workbench.action.files.openFileFolder" : "workbench.action.files.openFolder");
        }
        break;
      }
      case "selectCategory": {
        this.scrollToCategory(argument);
        this.gettingStartedService.markWalkthroughOpened(argument);
        break;
      }
      case "selectStartEntry": {
        const selected = startEntries.find((e) => e.id === argument);
        if (selected) {
          this.runStepCommand(selected.content.command);
        } else {
          throw Error("could not find start entry with id: " + argument);
        }
        break;
      }
      case "hideCategory": {
        this.hideCategory(argument);
        break;
      }
      // Use selectTask over selectStep to keep telemetry consistant:https://github.com/microsoft/vscode/issues/122256
      case "selectTask": {
        this.selectStep(argument);
        break;
      }
      case "toggleStepCompletion": {
        this.toggleStepCompletion(argument);
        break;
      }
      case "allDone": {
        this.markAllStepsComplete();
        break;
      }
      case "nextSection": {
        const next = this.currentWalkthrough?.next;
        if (next) {
          this.prevWalkthrough = this.currentWalkthrough;
          this.scrollToCategory(next);
        } else {
          console.error("Error scrolling to next section of", this.currentWalkthrough);
        }
        break;
      }
      case "openLink": {
        this.openerService.open(argument);
        break;
      }
      default: {
        console.error("Dispatch to", command, argument, "not defined");
        break;
      }
    }
  }
  hideCategory(categoryId) {
    const selectedCategory = this.gettingStartedCategories.find((category) => category.id === categoryId);
    if (!selectedCategory) {
      throw Error("Could not find category with ID " + categoryId);
    }
    this.setHiddenCategories([...this.getHiddenCategories().add(categoryId)]);
    this.gettingStartedList?.rerender();
  }
  markAllStepsComplete() {
    if (this.currentWalkthrough) {
      this.currentWalkthrough?.steps.forEach((step) => {
        if (!step.done) {
          this.gettingStartedService.progressStep(step.id);
        }
      });
      this.hideCategory(this.currentWalkthrough?.id);
      this.scrollPrev();
    } else {
      throw Error("No walkthrough opened");
    }
  }
  toggleStepCompletion(argument) {
    const stepToggle = assertIsDefined(this.currentWalkthrough?.steps.find((step) => step.id === argument));
    if (stepToggle.done) {
      this.gettingStartedService.deprogressStep(argument);
    } else {
      this.gettingStartedService.progressStep(argument);
    }
  }
  async openWalkthroughSelector() {
    const selection = await this.quickInputService.pick(this.gettingStartedCategories.filter((c) => this.contextService.contextMatchesRules(c.when)).map((x) => ({
      id: x.id,
      label: x.title,
      detail: x.description,
      description: x.source
    })), { canPickMany: false, matchOnDescription: true, matchOnDetail: true, title: localize("pickWalkthroughs", "Open Walkthrough...") });
    if (selection) {
      this.runDispatchCommand("selectCategory", selection.id);
    }
  }
  getHiddenCategories() {
    return new Set(JSON.parse(this.storageService.get(hiddenEntriesConfigurationKey, StorageScope.PROFILE, "[]")));
  }
  setHiddenCategories(hidden) {
    this.storageService.store(
      hiddenEntriesConfigurationKey,
      JSON.stringify(hidden),
      StorageScope.PROFILE,
      StorageTarget.USER
    );
  }
  async buildMediaComponent(stepId, forceRebuild = false) {
    if (!this.currentWalkthrough) {
      throw Error("no walkthrough selected");
    }
    const stepToExpand = assertIsDefined(this.currentWalkthrough.steps.find((step) => step.id === stepId));
    if (!forceRebuild && this.currentMediaComponent === stepId) {
      return;
    }
    this.currentMediaComponent = stepId;
    this.stepDisposables.clear();
    this.stepDisposables.add({
      dispose: () => {
        this.currentMediaComponent = void 0;
      }
    });
    if (this.currentMediaType !== stepToExpand.media.type) {
      this.currentMediaType = stepToExpand.media.type;
      this.mediaDisposables.add(toDisposable(() => {
        this.currentMediaType = void 0;
      }));
      clearNode(this.stepMediaComponent);
      if (stepToExpand.media.type === "svg") {
        this.webview = this.mediaDisposables.add(this.webviewService.createWebviewElement({ title: void 0, options: { disableServiceWorker: true }, contentOptions: {}, extension: void 0 }));
        this.webview.mountTo(this.stepMediaComponent, this.window);
      } else if (stepToExpand.media.type === "markdown") {
        this.webview = this.mediaDisposables.add(this.webviewService.createWebviewElement({ options: {}, contentOptions: { localResourceRoots: [stepToExpand.media.root], allowScripts: true }, title: "", extension: void 0 }));
        this.webview.mountTo(this.stepMediaComponent, this.window);
      } else if (stepToExpand.media.type === "video") {
        this.webview = this.mediaDisposables.add(this.webviewService.createWebviewElement({ options: {}, contentOptions: { localResourceRoots: [stepToExpand.media.root], allowScripts: true }, title: "", extension: void 0 }));
        this.webview.mountTo(this.stepMediaComponent, this.window);
      }
    }
    if (stepToExpand.media.type === "image") {
      this.stepsContent.classList.add("image");
      this.stepsContent.classList.remove("markdown");
      this.stepsContent.classList.remove("video");
      const media = stepToExpand.media;
      const mediaElement = $("img");
      clearNode(this.stepMediaComponent);
      this.stepMediaComponent.appendChild(mediaElement);
      mediaElement.setAttribute("alt", media.altText);
      this.updateMediaSourceForColorMode(mediaElement, media.path);
      this.stepDisposables.add(addDisposableListener(this.stepMediaComponent, "click", () => {
        const hrefs = stepToExpand.description.map((lt) => lt.nodes.filter((node) => typeof node !== "string").map((node) => node.href)).flat();
        if (hrefs.length === 1) {
          const href = hrefs[0];
          if (href.startsWith("http")) {
            this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "runStepAction", argument: href, walkthroughId: this.currentWalkthrough?.id });
            this.openerService.open(href);
          }
        }
      }));
      this.stepDisposables.add(this.themeService.onDidColorThemeChange(() => this.updateMediaSourceForColorMode(mediaElement, media.path)));
    } else if (stepToExpand.media.type === "svg") {
      this.stepsContent.classList.add("image");
      this.stepsContent.classList.remove("markdown");
      this.stepsContent.classList.remove("video");
      const media = stepToExpand.media;
      this.webview.setHtml(await this.detailsRenderer.renderSVG(media.path));
      let isDisposed = false;
      this.stepDisposables.add(toDisposable(() => {
        isDisposed = true;
      }));
      this.stepDisposables.add(this.themeService.onDidColorThemeChange(async () => {
        const body = await this.detailsRenderer.renderSVG(media.path);
        if (!isDisposed) {
          this.webview.setHtml(body);
        }
      }));
      this.stepDisposables.add(addDisposableListener(this.stepMediaComponent, "click", () => {
        const hrefs = stepToExpand.description.map((lt) => lt.nodes.filter((node) => typeof node !== "string").map((node) => node.href)).flat();
        if (hrefs.length === 1) {
          const href = hrefs[0];
          if (href.startsWith("http")) {
            this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "runStepAction", argument: href, walkthroughId: this.currentWalkthrough?.id });
            this.openerService.open(href);
          }
        }
      }));
      this.stepDisposables.add(this.webview.onDidClickLink((link) => {
        if (matchesScheme(link, Schemas.https) || matchesScheme(link, Schemas.http) || matchesScheme(link, Schemas.command)) {
          this.openerService.open(link, { allowCommands: true });
        }
      }));
    } else if (stepToExpand.media.type === "markdown") {
      this.stepsContent.classList.remove("image");
      this.stepsContent.classList.add("markdown");
      this.stepsContent.classList.remove("video");
      const media = stepToExpand.media;
      const rawHTML = await this.detailsRenderer.renderMarkdown(media.path, media.base);
      this.webview.setHtml(rawHTML);
      const serializedContextKeyExprs = rawHTML.match(/checked-on=\"([^'][^"]*)\"/g)?.map((attr) => attr.slice('checked-on="'.length, -1).replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
      const postTrueKeysMessage = () => {
        const enabledContextKeys = serializedContextKeyExprs?.filter((expr) => this.contextService.contextMatchesRules(ContextKeyExpr.deserialize(expr)));
        if (enabledContextKeys) {
          this.webview.postMessage({
            enabledContextKeys
          });
        }
      };
      if (serializedContextKeyExprs) {
        const contextKeyExprs = coalesce(serializedContextKeyExprs.map((expr) => ContextKeyExpr.deserialize(expr)));
        const watchingKeys = new Set(contextKeyExprs.flatMap((expr) => expr.keys()));
        this.stepDisposables.add(this.contextService.onDidChangeContext((e) => {
          if (e.affectsSome(watchingKeys)) {
            postTrueKeysMessage();
          }
        }));
      }
      let isDisposed = false;
      this.stepDisposables.add(toDisposable(() => {
        isDisposed = true;
      }));
      this.stepDisposables.add(this.webview.onDidClickLink((link) => {
        if (matchesScheme(link, Schemas.https) || matchesScheme(link, Schemas.http) || matchesScheme(link, Schemas.command)) {
          const toSide = link.startsWith("command:toSide:");
          if (toSide) {
            link = link.replace("command:toSide:", "command:");
            this.focusSideEditorGroup();
          }
          this.openerService.open(link, { allowCommands: true, openToSide: toSide });
        }
      }));
      if (rawHTML.indexOf("<code>") >= 0) {
        this.stepDisposables.add(this.themeService.onDidColorThemeChange(async () => {
          const body = await this.detailsRenderer.renderMarkdown(media.path, media.base);
          if (!isDisposed) {
            this.webview.setHtml(body);
            postTrueKeysMessage();
          }
        }));
      }
      const layoutDelayer = new Delayer(50);
      this.layoutMarkdown = () => {
        layoutDelayer.trigger(() => {
          this.webview.postMessage({ layoutMeNow: true });
        });
      };
      this.stepDisposables.add(layoutDelayer);
      this.stepDisposables.add({ dispose: () => this.layoutMarkdown = void 0 });
      postTrueKeysMessage();
      this.stepDisposables.add(this.webview.onMessage(async (e) => {
        const message = e.message;
        if (message.startsWith("command:")) {
          this.openerService.open(message, { allowCommands: true });
        } else if (message.startsWith("setTheme:")) {
          const themeId = message.slice("setTheme:".length);
          const theme = (await this.themeService.getColorThemes()).find((theme2) => theme2.settingsId === themeId);
          if (theme) {
            this.themeService.setColorTheme(theme.id, ConfigurationTarget.USER);
          }
        } else {
          console.error("Unexpected message", message);
        }
      }));
    } else if (stepToExpand.media.type === "video") {
      this.stepsContent.classList.add("video");
      this.stepsContent.classList.remove("markdown");
      this.stepsContent.classList.remove("image");
      const media = stepToExpand.media;
      const themeType = this.themeService.getColorTheme().type;
      const videoPath = media.path[themeType];
      const videoPoster = media.poster ? media.poster[themeType] : void 0;
      const altText = media.altText ? media.altText : localize("videoAltText", "Video for {0}", stepToExpand.title);
      const rawHTML = await this.detailsRenderer.renderVideo(videoPath, videoPoster, altText);
      this.webview.setHtml(rawHTML);
      let isDisposed = false;
      this.stepDisposables.add(toDisposable(() => {
        isDisposed = true;
      }));
      this.stepDisposables.add(this.themeService.onDidColorThemeChange(async () => {
        const themeType2 = this.themeService.getColorTheme().type;
        const videoPath2 = media.path[themeType2];
        const videoPoster2 = media.poster ? media.poster[themeType2] : void 0;
        const body = await this.detailsRenderer.renderVideo(videoPath2, videoPoster2, altText);
        if (!isDisposed) {
          this.webview.setHtml(body);
        }
      }));
    }
  }
  async selectStepLoose(id) {
    if (id.startsWith(`${this.editorInput.selectedCategory}#`)) {
      this.selectStep(id);
    } else {
      const toSelect = this.editorInput.selectedCategory + "#" + id;
      this.selectStep(toSelect);
    }
  }
  provideScreenReaderUpdate() {
    if (this.configurationService.getValue(AccessibilityVerbositySettingId.Walkthrough)) {
      const kbLabel = this.keybindingService.lookupKeybinding(AccessibleViewAction.id)?.getAriaLabel();
      return kbLabel ? localize("acessibleViewHint", "Inspect this in the accessible view ({0}).\n", kbLabel) : localize("acessibleViewHintNoKbOpen", "Inspect this in the accessible view via the command Open Accessible View which is currently not triggerable via keybinding.\n");
    }
    return "";
  }
  async selectStep(id, delayFocus = true) {
    if (id) {
      let stepElement = this.container.querySelector(`[data-step-id="${id}"]`);
      if (!stepElement) {
        stepElement = this.container.querySelector(`[data-step-id]`);
        if (!stepElement) {
          return;
        }
        id = assertIsDefined(stepElement.getAttribute("data-step-id"));
      }
      stepElement.parentElement?.querySelectorAll(".expanded").forEach((node) => {
        if (node.getAttribute("data-step-id") !== id) {
          node.classList.remove("expanded");
          node.setAttribute("aria-expanded", "false");
          const codiconElement2 = node.querySelector(".codicon");
          if (codiconElement2) {
            codiconElement2.removeAttribute("tabindex");
          }
        }
      });
      setTimeout(() => stepElement.focus(), delayFocus && this.shouldAnimate() ? SLIDE_TRANSITION_TIME_MS : 0);
      this.editorInput.selectedStep = id;
      stepElement.classList.add("expanded");
      stepElement.setAttribute("aria-expanded", "true");
      this.buildMediaComponent(id, true);
      const codiconElement = stepElement.querySelector(".codicon");
      if (codiconElement) {
        codiconElement.setAttribute("tabindex", "0");
      }
      this.gettingStartedService.progressByEvent("stepSelected:" + id);
      const step = this.currentWalkthrough?.steps?.find((step2) => step2.id === id);
      if (step) {
        stepElement.setAttribute("aria-label", `${this.provideScreenReaderUpdate()} ${step.title}`);
      }
    } else {
      this.editorInput.selectedStep = void 0;
    }
    this.detailsPageScrollbar?.scanDomNode();
    this.detailsScrollbar?.scanDomNode();
  }
  updateMediaSourceForColorMode(element, sources) {
    const themeType = this.themeService.getColorTheme().type;
    const src = sources[themeType].toString(true).replace(/ /g, "%20");
    element.srcset = src.toLowerCase().endsWith(".svg") ? src : src + " 1.5x";
  }
  createEditor(parent) {
    if (this.detailsPageScrollbar) {
      this.detailsPageScrollbar.dispose();
    }
    if (this.categoriesPageScrollbar) {
      this.categoriesPageScrollbar.dispose();
    }
    this.categoriesSlide = $(".gettingStartedSlideCategories.gettingStartedSlide");
    const prevButton = $("button.prev-button.button-link", { "x-dispatch": "scrollPrev" }, $("span.scroll-button.codicon.codicon-chevron-left"), $("span.moreText", {}, localize("goBack", "Go Back")));
    this.stepsSlide = $(".gettingStartedSlideDetails.gettingStartedSlide", {}, prevButton);
    this.stepsContent = $(".gettingStartedDetailsContent", {});
    this.detailsPageScrollbar = this._register(new DomScrollableElement(this.stepsContent, { className: "full-height-scrollable", vertical: ScrollbarVisibility.Hidden }));
    this.categoriesPageScrollbar = this._register(new DomScrollableElement(this.categoriesSlide, { className: "full-height-scrollable categoriesScrollbar", vertical: ScrollbarVisibility.Hidden }));
    this.stepsSlide.appendChild(this.detailsPageScrollbar.getDomNode());
    const gettingStartedPage = $(".gettingStarted", {}, this.categoriesPageScrollbar.getDomNode(), this.stepsSlide);
    this.container.appendChild(gettingStartedPage);
    this.categoriesPageScrollbar.scanDomNode();
    this.detailsPageScrollbar.scanDomNode();
    parent.appendChild(this.container);
  }
  async buildCategoriesSlide() {
    this.categoriesSlideDisposables.clear();
    const showOnStartupCheckbox = new Toggle({
      icon: Codicon.check,
      actionClassName: "getting-started-checkbox",
      isChecked: this.configurationService.getValue(configurationKey) === "welcomePage",
      title: localize("checkboxTitle", "When checked, this page will be shown on startup."),
      ...defaultToggleStyles
    });
    showOnStartupCheckbox.domNode.id = "showOnStartup";
    const showOnStartupLabel = $("label.caption", { for: "showOnStartup" }, localize("welcomePage.showOnStartup", "Show welcome page on startup"));
    const onShowOnStartupChanged = () => {
      if (showOnStartupCheckbox.checked) {
        this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "showOnStartupChecked", argument: void 0, walkthroughId: this.currentWalkthrough?.id });
        this.configurationService.updateValue(configurationKey, "welcomePage");
      } else {
        this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "showOnStartupUnchecked", argument: void 0, walkthroughId: this.currentWalkthrough?.id });
        this.configurationService.updateValue(configurationKey, "none");
      }
    };
    this.categoriesSlideDisposables.add(showOnStartupCheckbox);
    this.categoriesSlideDisposables.add(showOnStartupCheckbox.onChange(() => {
      onShowOnStartupChanged();
    }));
    this.categoriesSlideDisposables.add(addDisposableListener(showOnStartupLabel, "click", () => {
      showOnStartupCheckbox.checked = !showOnStartupCheckbox.checked;
      onShowOnStartupChanged();
    }));
    const header = $(
      ".header",
      {},
      $("h1.product-name.caption", {}, this.productService.nameLong),
      $("p.subtitle.description", {}, localize({ key: "gettingStarted.editingEvolved", comment: ["Shown as subtitle on the Welcome page."] }, "Editing evolved"))
    );
    const leftColumn = $(".categories-column.categories-column-left", {});
    const rightColumn = $(".categories-column.categories-column-right", {});
    const startList = this.buildStartList();
    const recentList = this.buildRecentlyOpenedList();
    const gettingStartedList = this.buildGettingStartedWalkthroughsList();
    const footer = $(
      ".footer",
      {},
      $(
        "p.showOnStartup",
        {},
        showOnStartupCheckbox.domNode,
        showOnStartupLabel
      )
    );
    const layoutLists = () => {
      if (gettingStartedList.itemCount) {
        this.container.classList.remove("noWalkthroughs");
        reset(rightColumn, gettingStartedList.getDomElement());
      } else {
        this.container.classList.add("noWalkthroughs");
        reset(rightColumn);
      }
      setTimeout(() => this.categoriesPageScrollbar?.scanDomNode(), 50);
      layoutRecentList();
    };
    const layoutRecentList = () => {
      if (this.container.classList.contains("noWalkthroughs")) {
        recentList.setLimit(10);
        reset(leftColumn, startList.getDomElement());
        reset(rightColumn, recentList.getDomElement());
      } else {
        recentList.setLimit(5);
        reset(leftColumn, startList.getDomElement(), recentList.getDomElement());
      }
    };
    gettingStartedList.onDidChange(layoutLists);
    layoutLists();
    reset(this.categoriesSlide, $(".gettingStartedCategoriesContainer", {}, header, leftColumn, rightColumn, footer));
    this.categoriesPageScrollbar?.scanDomNode();
    this.updateCategoryProgress();
    this.registerDispatchListeners();
    if (this.editorInput.selectedCategory) {
      this.currentWalkthrough = this.gettingStartedCategories.find((category) => category.id === this.editorInput.selectedCategory);
      if (!this.currentWalkthrough) {
        this.gettingStartedCategories = this.gettingStartedService.getWalkthroughs();
        this.currentWalkthrough = this.gettingStartedCategories.find((category) => category.id === this.editorInput.selectedCategory);
        if (this.currentWalkthrough) {
          this.buildCategorySlide(this.editorInput.selectedCategory, this.editorInput.selectedStep);
          this.setSlide("details");
          return;
        }
      } else {
        this.buildCategorySlide(this.editorInput.selectedCategory, this.editorInput.selectedStep);
        this.setSlide("details");
        return;
      }
    }
    const someStepsComplete = this.gettingStartedCategories.some((category) => category.steps.find((s) => s.done));
    if (this.editorInput.showTelemetryNotice && this.productService.openToWelcomeMainPage) {
      const telemetryNotice = $("p.telemetry-notice");
      this.buildTelemetryFooter(telemetryNotice);
      footer.appendChild(telemetryNotice);
    } else if (!this.productService.openToWelcomeMainPage && !someStepsComplete && !this.hasScrolledToFirstCategory && this.showFeaturedWalkthrough) {
      const firstSessionDateString = this.storageService.get(firstSessionDateStorageKey, StorageScope.APPLICATION) || (/* @__PURE__ */ new Date()).toUTCString();
      const daysSinceFirstSession = (+/* @__PURE__ */ new Date() - +new Date(firstSessionDateString)) / 1e3 / 60 / 60 / 24;
      const fistContentBehaviour = daysSinceFirstSession < 1 ? "openToFirstCategory" : "index";
      if (fistContentBehaviour === "openToFirstCategory") {
        const first = this.gettingStartedCategories.filter((c) => !c.when || this.contextService.contextMatchesRules(c.when))[0];
        if (first) {
          this.hasScrolledToFirstCategory = true;
          this.currentWalkthrough = first;
          this.editorInput.selectedCategory = this.currentWalkthrough?.id;
          this.editorInput.walkthroughPageTitle = this.currentWalkthrough.walkthroughPageTitle;
          this.buildCategorySlide(this.editorInput.selectedCategory, void 0);
          this.setSlide(
            "details",
            true
            /* firstLaunch */
          );
          return;
        }
      }
    }
    this.setSlide("categories");
  }
  buildRecentlyOpenedList() {
    const renderRecent = (recent) => {
      let fullPath;
      let windowOpenable;
      if (isRecentFolder(recent)) {
        windowOpenable = { folderUri: recent.folderUri };
        fullPath = recent.label || this.labelService.getWorkspaceLabel(recent.folderUri, { verbose: Verbosity.LONG });
      } else {
        fullPath = recent.label || this.labelService.getWorkspaceLabel(recent.workspace, { verbose: Verbosity.LONG });
        windowOpenable = { workspaceUri: recent.workspace.configPath };
      }
      const { name, parentPath } = splitRecentLabel(fullPath);
      const li = $("li");
      const link = $("button.button-link");
      link.innerText = name;
      link.title = fullPath;
      link.setAttribute("aria-label", localize("welcomePage.openFolderWithPath", "Open folder {0} with path {1}", name, parentPath));
      link.addEventListener("click", (e) => {
        this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "openRecent", argument: void 0, walkthroughId: this.currentWalkthrough?.id });
        this.hostService.openWindow([windowOpenable], {
          forceNewWindow: e.ctrlKey || e.metaKey,
          remoteAuthority: recent.remoteAuthority || null
          // local window if remoteAuthority is not set or can not be deducted from the openable
        });
        e.preventDefault();
        e.stopPropagation();
      });
      li.appendChild(link);
      const span = $("span");
      span.classList.add("path");
      span.classList.add("detail");
      span.innerText = parentPath;
      span.title = fullPath;
      li.appendChild(span);
      return li;
    };
    if (this.recentlyOpenedList) {
      this.recentlyOpenedList.dispose();
    }
    const recentlyOpenedList = this.recentlyOpenedList = new GettingStartedIndexList(
      {
        title: localize("recent", "Recent"),
        klass: "recently-opened",
        limit: 5,
        empty: $(
          ".empty-recent",
          {},
          localize("noRecents", "You have no recent folders,"),
          $("button.button-link", { "x-dispatch": "openFolder" }, localize("openFolder", "open a folder")),
          localize("toStart", "to start.")
        ),
        more: $(
          ".more",
          {},
          $(
            "button.button-link",
            {
              "x-dispatch": "showMoreRecents",
              title: localize("show more recents", "Show All Recent Folders {0}", this.getKeybindingLabel(OpenRecentAction.ID))
            },
            localize("showAll", "More...")
          )
        ),
        renderElement: renderRecent,
        contextService: this.contextService
      }
    );
    recentlyOpenedList.onDidChange(() => this.registerDispatchListeners());
    this.recentlyOpened.then(({ workspaces }) => {
      const workspacesWithID = workspaces.filter((recent) => !this.workspaceContextService.isCurrentWorkspace(isRecentWorkspace(recent) ? recent.workspace : recent.folderUri)).map((recent) => ({ ...recent, id: isRecentWorkspace(recent) ? recent.workspace.id : recent.folderUri.toString() }));
      const updateEntries = () => {
        recentlyOpenedList.setEntries(workspacesWithID);
      };
      updateEntries();
      recentlyOpenedList.register(this.labelService.onDidChangeFormatters(() => updateEntries()));
    }).catch(onUnexpectedError);
    return recentlyOpenedList;
  }
  buildStartList() {
    const renderStartEntry = (entry) => $(
      "li",
      {},
      $(
        "button.button-link",
        {
          "x-dispatch": "selectStartEntry:" + entry.id,
          title: entry.description + " " + this.getKeybindingLabel(entry.command)
        },
        this.iconWidgetFor(entry),
        $("span", {}, entry.title)
      )
    );
    if (this.startList) {
      this.startList.dispose();
    }
    const startList = this.startList = new GettingStartedIndexList(
      {
        title: localize("start", "Start"),
        klass: "start-container",
        limit: 10,
        renderElement: renderStartEntry,
        rankElement: (e) => -e.order,
        contextService: this.contextService
      }
    );
    startList.setEntries(parsedStartEntries);
    startList.onDidChange(() => this.registerDispatchListeners());
    return startList;
  }
  buildGettingStartedWalkthroughsList() {
    const renderGetttingStaredWalkthrough = (category) => {
      const renderNewBadge = (category.newItems || category.newEntry) && !category.isFeatured;
      const newBadge = $(".new-badge", {});
      if (category.newEntry) {
        reset(newBadge, $(".new-category", {}, localize("new", "New")));
      } else if (category.newItems) {
        reset(newBadge, $(".new-items", {}, localize({ key: "newItems", comment: ["Shown when a list of items has changed based on an update from a remote source"] }, "Updated")));
      }
      const featuredBadge = $(".featured-badge", {});
      const descriptionContent = $(".description-content", {});
      if (category.isFeatured && this.showFeaturedWalkthrough) {
        reset(featuredBadge, $(".featured", {}, $("span.featured-icon.codicon.codicon-star-full")));
        reset(descriptionContent, ...renderLabelWithIcons(category.description));
      }
      const titleContent = $("h3.category-title.max-lines-3", { "x-category-title-for": category.id });
      reset(titleContent, ...renderLabelWithIcons(category.title));
      return $(
        "button.getting-started-category" + (category.isFeatured && this.showFeaturedWalkthrough ? ".featured" : ""),
        {
          "x-dispatch": "selectCategory:" + category.id,
          "title": category.description
        },
        featuredBadge,
        $(
          ".main-content",
          {},
          this.iconWidgetFor(category),
          titleContent,
          renderNewBadge ? newBadge : $(".no-badge"),
          $("a.codicon.codicon-close.hide-category-button", {
            "tabindex": 0,
            "x-dispatch": "hideCategory:" + category.id,
            "title": localize("close", "Hide"),
            "role": "button",
            "aria-label": localize("closeAriaLabel", "Hide")
          })
        ),
        descriptionContent,
        $(
          ".category-progress",
          { "x-data-category-id": category.id },
          $(
            ".progress-bar-outer",
            { "role": "progressbar" },
            $(".progress-bar-inner")
          )
        )
      );
    };
    if (this.gettingStartedList) {
      this.gettingStartedList.dispose();
    }
    const rankWalkthrough = (e) => {
      let rank = e.order;
      if (e.isFeatured) {
        rank += 7;
      }
      if (e.newEntry) {
        rank += 3;
      }
      if (e.newItems) {
        rank += 2;
      }
      if (e.recencyBonus) {
        rank += 4 * e.recencyBonus;
      }
      if (this.getHiddenCategories().has(e.id)) {
        rank = null;
      }
      return rank;
    };
    const gettingStartedList = this.gettingStartedList = new GettingStartedIndexList(
      {
        title: localize("walkthroughs", "Walkthroughs"),
        klass: "getting-started",
        limit: 5,
        footer: $("span.button-link.see-all-walkthroughs", { "x-dispatch": "seeAllWalkthroughs", "tabindex": 0 }, localize("showAll", "More...")),
        renderElement: renderGetttingStaredWalkthrough,
        rankElement: rankWalkthrough,
        contextService: this.contextService
      }
    );
    gettingStartedList.onDidChange(() => {
      const hidden = this.getHiddenCategories();
      const someWalkthroughsHidden = hidden.size || gettingStartedList.itemCount < this.gettingStartedCategories.filter((c) => this.contextService.contextMatchesRules(c.when)).length;
      this.container.classList.toggle("someWalkthroughsHidden", !!someWalkthroughsHidden);
      this.registerDispatchListeners();
      allWalkthroughsHiddenContext.bindTo(this.contextService).set(gettingStartedList.itemCount === 0);
      this.updateCategoryProgress();
    });
    gettingStartedList.setEntries(this.gettingStartedCategories);
    allWalkthroughsHiddenContext.bindTo(this.contextService).set(gettingStartedList.itemCount === 0);
    return gettingStartedList;
  }
  layout(size) {
    this.detailsScrollbar?.scanDomNode();
    this.categoriesPageScrollbar?.scanDomNode();
    this.detailsPageScrollbar?.scanDomNode();
    this.startList?.layout(size);
    this.gettingStartedList?.layout(size);
    this.recentlyOpenedList?.layout(size);
    if (this.editorInput?.selectedStep && this.currentMediaType) {
      this.mediaDisposables.clear();
      this.stepDisposables.clear();
      this.buildMediaComponent(this.editorInput.selectedStep);
    }
    this.layoutMarkdown?.();
    this.container.classList.toggle("height-constrained", size.height <= 600);
    this.container.classList.toggle("width-constrained", size.width <= 400);
    this.container.classList.toggle("width-semi-constrained", size.width <= 950);
    this.categoriesPageScrollbar?.scanDomNode();
    this.detailsPageScrollbar?.scanDomNode();
    this.detailsScrollbar?.scanDomNode();
  }
  updateCategoryProgress() {
    this.window.document.querySelectorAll(".category-progress").forEach((element) => {
      const categoryID = element.getAttribute("x-data-category-id");
      const category = this.gettingStartedCategories.find((category2) => category2.id === categoryID);
      if (!category) {
        throw Error("Could not find category with ID " + categoryID);
      }
      const stats = this.getWalkthroughCompletionStats(category);
      const bar = assertIsDefined(element.querySelector(".progress-bar-inner"));
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuenow", "" + stats.stepsComplete);
      bar.setAttribute("aria-valuemax", "" + stats.stepsTotal);
      const progress = stats.stepsComplete / stats.stepsTotal * 100;
      bar.style.width = `${progress}%`;
      element.parentElement.classList.toggle("no-progress", stats.stepsComplete === 0);
      if (stats.stepsTotal === stats.stepsComplete) {
        bar.title = localize("gettingStarted.allStepsComplete", "All {0} steps complete!", stats.stepsComplete);
      } else {
        bar.title = localize("gettingStarted.someStepsComplete", "{0} of {1} steps complete", stats.stepsComplete, stats.stepsTotal);
      }
    });
  }
  async scrollToCategory(categoryID, stepId) {
    if (!this.gettingStartedCategories.some((c) => c.id === categoryID)) {
      this.gettingStartedCategories = this.gettingStartedService.getWalkthroughs();
    }
    const ourCategory = this.gettingStartedCategories.find((c) => c.id === categoryID);
    if (!ourCategory) {
      throw Error("Could not find category with ID: " + categoryID);
    }
    this.inProgressScroll = this.inProgressScroll.then(async () => {
      reset(this.stepsContent);
      this.editorInput.selectedCategory = categoryID;
      this.editorInput.selectedStep = stepId;
      this.editorInput.walkthroughPageTitle = ourCategory.walkthroughPageTitle;
      this.currentWalkthrough = ourCategory;
      this.buildCategorySlide(categoryID, stepId);
      this.setSlide("details");
    });
  }
  iconWidgetFor(category) {
    const widget = category.icon.type === "icon" ? $(ThemeIcon.asCSSSelector(category.icon.icon)) : $("img.category-icon", { src: category.icon.path });
    widget.classList.add("icon-widget");
    return widget;
  }
  focusSideEditorGroup() {
    const fullSize = this.groupsService.getPart(this.group).contentDimension;
    if (!fullSize || fullSize.width <= 700) {
      return;
    }
    if (this.groupsService.count === 1) {
      const sideGroup = this.groupsService.addGroup(this.groupsService.groups[0], GroupDirection.RIGHT);
      this.groupsService.activateGroup(sideGroup);
      const gettingStartedSize = Math.floor(fullSize.width / 2);
      const gettingStartedGroup = this.groupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).find((group) => group.activeEditor instanceof GettingStartedInput);
      this.groupsService.setSize(assertIsDefined(gettingStartedGroup), { width: gettingStartedSize, height: fullSize.height });
    }
    const nonGettingStartedGroup = this.groupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).find((group) => !(group.activeEditor instanceof GettingStartedInput));
    if (nonGettingStartedGroup) {
      this.groupsService.activateGroup(nonGettingStartedGroup);
      nonGettingStartedGroup.focus();
    }
  }
  runStepCommand(href) {
    const isCommand = href.startsWith("command:");
    const toSide = href.startsWith("command:toSide:");
    const command = href.replace(/command:(toSide:)?/, "command:");
    this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "runStepAction", argument: href, walkthroughId: this.currentWalkthrough?.id });
    if (toSide) {
      this.focusSideEditorGroup();
    }
    if (isCommand) {
      const commandURI = URI.parse(command);
      let args = [];
      try {
        args = parse(decodeURIComponent(commandURI.query));
      } catch {
        try {
          args = parse(commandURI.query);
        } catch {
        }
      }
      if (!Array.isArray(args)) {
        args = [args];
      }
      if ((commandURI.path === OpenFileFolderAction.ID.toString() || commandURI.path === OpenFolderAction.ID.toString()) && this.workspaceContextService.getWorkspace().folders.length === 0) {
        const selectedStepIndex = this.currentWalkthrough?.steps.findIndex((step) => step.id === this.editorInput.selectedStep);
        if (selectedStepIndex !== void 0 && selectedStepIndex > -1 && this.currentWalkthrough?.steps.slice(selectedStepIndex + 1).some((step) => !step.done)) {
          const restoreData = { folder: UNKNOWN_EMPTY_WINDOW_WORKSPACE.id, category: this.editorInput.selectedCategory, step: this.editorInput.selectedStep };
          this.storageService.store(
            restoreWalkthroughsConfigurationKey,
            JSON.stringify(restoreData),
            StorageScope.PROFILE,
            StorageTarget.MACHINE
          );
        }
      }
      this.commandService.executeCommand(commandURI.path, ...args).then((result) => {
        const toOpen = result?.openFolder;
        if (toOpen) {
          if (!URI.isUri(toOpen)) {
            console.warn("Warn: Running walkthrough command", href, "yielded non-URI `openFolder` result", toOpen, ". It will be disregarded.");
            return;
          }
          const restoreData = { folder: toOpen.toString(), category: this.editorInput.selectedCategory, step: this.editorInput.selectedStep };
          this.storageService.store(
            restoreWalkthroughsConfigurationKey,
            JSON.stringify(restoreData),
            StorageScope.PROFILE,
            StorageTarget.MACHINE
          );
          this.hostService.openWindow([{ folderUri: toOpen }]);
        }
      });
    } else {
      this.openerService.open(command, { allowCommands: true });
    }
    if (!isCommand && (href.startsWith("https://") || href.startsWith("http://"))) {
      this.gettingStartedService.progressByEvent("onLink:" + href);
    }
  }
  buildMarkdownDescription(container, text) {
    while (container.firstChild) {
      container.firstChild.remove();
    }
    for (const linkedText of text) {
      if (linkedText.nodes.length === 1 && typeof linkedText.nodes[0] !== "string") {
        const node = linkedText.nodes[0];
        const buttonContainer = append(container, $(".button-container"));
        const button = new Button(buttonContainer, { title: node.title, supportIcons: true, ...defaultButtonStyles });
        const isCommand = node.href.startsWith("command:");
        const command = node.href.replace(/command:(toSide:)?/, "command:");
        button.label = node.label;
        button.onDidClick((e) => {
          e.stopPropagation();
          e.preventDefault();
          this.runStepCommand(node.href);
        }, null, this.detailsPageDisposables);
        if (isCommand) {
          const keybinding = this.getKeyBinding(command);
          if (keybinding) {
            const shortcutMessage = $("span.shortcut-message", {}, localize("gettingStarted.keyboardTip", "Tip: Use keyboard shortcut "));
            container.appendChild(shortcutMessage);
            const label = new KeybindingLabel(shortcutMessage, OS, { ...defaultKeybindingLabelStyles });
            label.set(keybinding);
            this.detailsPageDisposables.add(label);
          }
        }
        this.detailsPageDisposables.add(button);
      } else {
        const p = append(container, $("p"));
        for (const node of linkedText.nodes) {
          if (typeof node === "string") {
            const labelWithIcon = renderLabelWithIcons(node);
            for (const element of labelWithIcon) {
              if (typeof element === "string") {
                p.appendChild(renderFormattedText(element, { inline: true, renderCodeSegments: true }));
              } else {
                p.appendChild(element);
              }
            }
          } else {
            const nodeWithTitle = matchesScheme(node.href, Schemas.http) || matchesScheme(node.href, Schemas.https) ? { ...node, title: node.href } : node;
            const link = this.instantiationService.createInstance(Link, p, nodeWithTitle, { opener: (href) => this.runStepCommand(href) });
            this.detailsPageDisposables.add(link);
          }
        }
      }
    }
    return container;
  }
  clearInput() {
    this.stepDisposables.clear();
    super.clearInput();
  }
  buildCategorySlide(categoryID, selectedStep) {
    if (this.detailsScrollbar) {
      this.detailsScrollbar.dispose();
    }
    this.extensionService.whenInstalledExtensionsRegistered().then(() => {
      this.extensionService.activateByEvent(`onWalkthrough:${categoryID.replace(/[^#]+#/, "")}`);
    });
    this.detailsPageDisposables.clear();
    this.mediaDisposables.clear();
    const category = this.gettingStartedCategories.find((category2) => category2.id === categoryID);
    if (!category) {
      throw Error("could not find category with ID " + categoryID);
    }
    const descriptionContainer = $(".category-description.description.max-lines-3", { "x-category-description-for": category.id });
    this.buildMarkdownDescription(descriptionContainer, parseDescription(category.description));
    const categoryDescriptorComponent = $(
      ".getting-started-category",
      {},
      $(
        ".category-description-container",
        {},
        $("h2.category-title.max-lines-3", { "x-category-title-for": category.id }, ...renderLabelWithIcons(category.title)),
        descriptionContainer
      )
    );
    const stepListContainer = $(".step-list-container");
    this.detailsPageDisposables.add(addDisposableListener(stepListContainer, "keydown", (e) => {
      const event = new StandardKeyboardEvent(e);
      const currentStepIndex = () => category.steps.findIndex((e2) => e2.id === this.editorInput.selectedStep);
      if (event.keyCode === KeyCode.UpArrow) {
        const toExpand2 = category.steps.filter((step, index) => index < currentStepIndex() && this.contextService.contextMatchesRules(step.when));
        if (toExpand2.length) {
          this.selectStep(toExpand2[toExpand2.length - 1].id, false);
        }
      }
      if (event.keyCode === KeyCode.DownArrow) {
        const toExpand2 = category.steps.find((step, index) => index > currentStepIndex() && this.contextService.contextMatchesRules(step.when));
        if (toExpand2) {
          this.selectStep(toExpand2.id, false);
        }
      }
    }));
    let renderedSteps = void 0;
    const contextKeysToWatch = new Set(category.steps.flatMap((step) => step.when.keys()));
    const buildStepList = () => {
      category.steps.sort((a, b) => a.order - b.order);
      const toRender = category.steps.filter((step) => this.contextService.contextMatchesRules(step.when));
      if (equals(renderedSteps, toRender, (a, b) => a.id === b.id)) {
        return;
      }
      renderedSteps = toRender;
      reset(stepListContainer, ...renderedSteps.map((step) => {
        const codicon = $(
          ".codicon" + (step.done ? ".complete" + ThemeIcon.asCSSSelector(gettingStartedCheckedCodicon) : ThemeIcon.asCSSSelector(gettingStartedUncheckedCodicon)),
          {
            "data-done-step-id": step.id,
            "x-dispatch": "toggleStepCompletion:" + step.id,
            "role": "checkbox",
            "aria-checked": step.done ? "true" : "false",
            "aria-label": step.done ? localize("stepDone", "Checkbox for Step {0}: Completed", step.title) : localize("stepNotDone", "Checkbox for Step {0}: Not completed", step.title)
          }
        );
        const container = $(".step-description-container", { "x-step-description-for": step.id });
        this.buildMarkdownDescription(container, step.description);
        const stepTitle = $("h3.step-title.max-lines-3", { "x-step-title-for": step.id });
        reset(stepTitle, ...renderLabelWithIcons(step.title));
        const stepDescription = $(
          ".step-container",
          {},
          stepTitle,
          container
        );
        if (step.media.type === "image") {
          stepDescription.appendChild(
            $(".image-description", { "aria-label": localize("imageShowing", "Image showing {0}", step.media.altText) })
          );
        } else if (step.media.type === "video") {
          stepDescription.appendChild(
            $(".video-description", { "aria-label": localize("videoShowing", "Video showing {0}", step.media.altText) })
          );
        }
        return $(
          "button.getting-started-step",
          {
            "x-dispatch": "selectTask:" + step.id,
            "data-step-id": step.id,
            "aria-expanded": "false",
            "aria-checked": step.done ? "true" : "false",
            "role": "button"
          },
          codicon,
          stepDescription
        );
      }));
    };
    buildStepList();
    this.detailsPageDisposables.add(this.contextService.onDidChangeContext((e) => {
      if (e.affectsSome(contextKeysToWatch) && this.currentWalkthrough) {
        buildStepList();
        this.registerDispatchListeners();
        this.selectStep(this.editorInput.selectedStep, false);
      }
    }));
    const showNextCategory = this.gettingStartedCategories.find((_category) => _category.id === category.next);
    const stepsContainer = $(
      ".getting-started-detail-container",
      { "role": "list" },
      stepListContainer,
      $(
        ".done-next-container",
        {},
        $("button.button-link.all-done", { "x-dispatch": "allDone" }, $("span.codicon.codicon-check-all"), localize("allDone", "Mark Done")),
        ...showNextCategory ? [$("button.button-link.next", { "x-dispatch": "nextSection" }, localize("nextOne", "Next Section"), $("span.codicon.codicon-arrow-right"))] : []
      )
    );
    this.detailsScrollbar = this._register(new DomScrollableElement(stepsContainer, { className: "steps-container" }));
    const stepListComponent = this.detailsScrollbar.getDomNode();
    const categoryFooter = $(".getting-started-footer");
    if (this.editorInput.showTelemetryNotice && getTelemetryLevel(this.configurationService) !== TelemetryLevel.NONE && this.productService.enableTelemetry) {
      this.buildTelemetryFooter(categoryFooter);
    }
    reset(this.stepsContent, categoryDescriptorComponent, stepListComponent, this.stepMediaComponent, categoryFooter);
    const toExpand = category.steps.find((step) => this.contextService.contextMatchesRules(step.when) && !step.done) ?? category.steps[0];
    this.selectStep(selectedStep ?? toExpand.id, !selectedStep);
    this.detailsScrollbar.scanDomNode();
    this.detailsPageScrollbar?.scanDomNode();
    this.registerDispatchListeners();
  }
  buildTelemetryFooter(parent) {
    const mdRenderer = this.instantiationService.createInstance(MarkdownRenderer, {});
    const privacyStatementCopy = localize("privacy statement", "privacy statement");
    const privacyStatementButton = `[${privacyStatementCopy}](command:workbench.action.openPrivacyStatementUrl)`;
    const optOutCopy = localize("optOut", "opt out");
    const optOutButton = `[${optOutCopy}](command:settings.filterByTelemetry)`;
    const text = localize(
      { key: "footer", comment: ['fist substitution is "vs code", second is "privacy statement", third is "opt out".'] },
      "{0} collects usage data. Read our {1} and learn how to {2}.",
      this.productService.nameShort,
      privacyStatementButton,
      optOutButton
    );
    parent.append(mdRenderer.render({ value: text, isTrusted: true }).element);
  }
  getKeybindingLabel(command) {
    command = command.replace(/^command:/, "");
    const label = this.keybindingService.lookupKeybinding(command)?.getLabel();
    if (!label) {
      return "";
    } else {
      return `(${label})`;
    }
  }
  getKeyBinding(command) {
    command = command.replace(/^command:/, "");
    return this.keybindingService.lookupKeybinding(command);
  }
  async scrollPrev() {
    this.inProgressScroll = this.inProgressScroll.then(async () => {
      if (this.prevWalkthrough && this.prevWalkthrough !== this.currentWalkthrough) {
        this.currentWalkthrough = this.prevWalkthrough;
        this.prevWalkthrough = void 0;
        this.makeCategoryVisibleWhenAvailable(this.currentWalkthrough.id);
      } else {
        this.currentWalkthrough = void 0;
        this.editorInput.selectedCategory = void 0;
        this.editorInput.selectedStep = void 0;
        this.editorInput.showTelemetryNotice = false;
        this.editorInput.walkthroughPageTitle = void 0;
        if (this.gettingStartedCategories.length !== this.gettingStartedList?.itemCount) {
          this.buildCategoriesSlide();
        }
        this.selectStep(void 0);
        this.setSlide("categories");
        this.container.focus();
      }
    });
  }
  runSkip() {
    this.commandService.executeCommand("workbench.action.closeActiveEditor");
  }
  escape() {
    if (this.editorInput.selectedCategory) {
      this.scrollPrev();
    } else {
      this.runSkip();
    }
  }
  setSlide(toEnable, firstLaunch = false) {
    const slideManager = assertIsDefined(this.container.querySelector(".gettingStarted"));
    if (toEnable === "categories") {
      slideManager.classList.remove("showDetails");
      slideManager.classList.add("showCategories");
      this.container.querySelector(".prev-button.button-link").style.display = "none";
      this.container.querySelector(".gettingStartedSlideDetails").querySelectorAll("button").forEach((button) => button.disabled = true);
      this.container.querySelector(".gettingStartedSlideCategories").querySelectorAll("button").forEach((button) => button.disabled = false);
      this.container.querySelector(".gettingStartedSlideCategories").querySelectorAll("input").forEach((button) => button.disabled = false);
    } else {
      slideManager.classList.add("showDetails");
      slideManager.classList.remove("showCategories");
      const prevButton = this.container.querySelector(".prev-button.button-link");
      prevButton.style.display = this.editorInput.showWelcome || this.prevWalkthrough ? "block" : "none";
      const moreTextElement = prevButton.querySelector(".moreText");
      moreTextElement.textContent = firstLaunch ? localize("welcome", "Welcome") : localize("goBack", "Go Back");
      this.container.querySelector(".gettingStartedSlideDetails").querySelectorAll("button").forEach((button) => button.disabled = false);
      this.container.querySelector(".gettingStartedSlideCategories").querySelectorAll("button").forEach((button) => button.disabled = true);
      this.container.querySelector(".gettingStartedSlideCategories").querySelectorAll("input").forEach((button) => button.disabled = true);
    }
  }
  focus() {
    super.focus();
    const active = this.container.ownerDocument.activeElement;
    let parent = this.container.parentElement;
    while (parent && parent !== active) {
      parent = parent.parentElement;
    }
    if (parent) {
      this.container.focus();
    }
  }
};
GettingStartedPage.ID = "gettingStartedPage";
GettingStartedPage = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IProductService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IWalkthroughsService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, ILanguageService),
  __decorateParam(8, IFileService),
  __decorateParam(9, IOpenerService),
  __decorateParam(10, IWorkbenchThemeService),
  __decorateParam(11, IStorageService),
  __decorateParam(12, IExtensionService),
  __decorateParam(13, IInstantiationService),
  __decorateParam(14, INotificationService),
  __decorateParam(15, IEditorGroupsService),
  __decorateParam(16, IContextKeyService),
  __decorateParam(17, IQuickInputService),
  __decorateParam(18, IWorkspacesService),
  __decorateParam(19, ILabelService),
  __decorateParam(20, IHostService),
  __decorateParam(21, IWebviewService),
  __decorateParam(22, IWorkspaceContextService),
  __decorateParam(23, IAccessibilityService)
], GettingStartedPage);
class GettingStartedInputSerializer {
  canSerialize(editorInput) {
    return true;
  }
  serialize(editorInput) {
    return JSON.stringify({ selectedCategory: editorInput.selectedCategory, selectedStep: editorInput.selectedStep });
  }
  deserialize(instantiationService, serializedEditorInput) {
    return instantiationService.invokeFunction((accessor) => {
      try {
        const { selectedCategory, selectedStep } = JSON.parse(serializedEditorInput);
        return new GettingStartedInput({ selectedCategory, selectedStep });
      } catch {
      }
      return new GettingStartedInput({});
    });
  }
}
export {
  GettingStartedInputSerializer,
  GettingStartedPage,
  allWalkthroughsHiddenContext,
  inWelcomeContext
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lR2V0dGluZ1N0YXJ0ZWQvYnJvd3Nlci9nZXR0aW5nU3RhcnRlZC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7ICQsIERpbWVuc2lvbiwgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBhcHBlbmQsIGNsZWFyTm9kZSwgcmVzZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IHJlbmRlckZvcm1hdHRlZFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZm9ybWF0dGVkVGV4dFJlbmRlcmVyLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IHJlbmRlckxhYmVsV2l0aEljb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IERvbVNjcm9sbGFibGVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Njcm9sbGJhci9zY3JvbGxhYmxlRWxlbWVudC5qcyc7XG5pbXBvcnQgeyBUb2dnbGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdG9nZ2xlL3RvZ2dsZS5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSwgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IERlbGF5ZXIsIFRocm90dGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgc3BsaXRSZWNlbnRMYWJlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJTGluaywgTGlua2VkVGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpbmtlZFRleHQuanMnO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzLCBtYXRjaGVzU2NoZW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCwgT1MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0ICcuL21lZGlhL2dldHRpbmdTdGFydGVkLmNzcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9tYXJrZG93blJlbmRlcmVyL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBDb250ZXh0S2V5RXhwcmVzc2lvbiwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSwgVmVyYm9zaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgTGluayB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9icm93c2VyL2xpbmsuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0LCBXaWxsU2F2ZVN0YXRlUmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSwgVGVsZW1ldHJ5TGV2ZWwsIGZpcnN0U2Vzc2lvbkRhdGVTdG9yYWdlS2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgZ2V0VGVsZW1ldHJ5TGV2ZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcbmltcG9ydCB7IGRlZmF1bHRCdXR0b25TdHlsZXMsIGRlZmF1bHRLZXliaW5kaW5nTGFiZWxTdHlsZXMsIGRlZmF1bHRUb2dnbGVTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgSVdpbmRvd09wZW5hYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBVTktOT1dOX0VNUFRZX1dJTkRPV19XT1JLU1BBQ0UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJUmVjZW50Rm9sZGVyLCBJUmVjZW50V29ya3NwYWNlLCBJUmVjZW50bHlPcGVuZWQsIElXb3Jrc3BhY2VzU2VydmljZSwgaXNSZWNlbnRGb2xkZXIsIGlzUmVjZW50V29ya3NwYWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlcy9jb21tb24vd29ya3NwYWNlcy5qcyc7XG5pbXBvcnQgeyBPcGVuUmVjZW50QWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9hY3Rpb25zL3dpbmRvd0FjdGlvbnMuanMnO1xuaW1wb3J0IHsgT3BlbkZpbGVGb2xkZXJBY3Rpb24sIE9wZW5Gb2xkZXJBY3Rpb24sIE9wZW5Gb2xkZXJWaWFXb3Jrc3BhY2VBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2FjdGlvbnMvd29ya3NwYWNlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFuZS5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hTdGF0ZUNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wZW5Db250ZXh0LCBJRWRpdG9yU2VyaWFsaXplciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSVdlYnZpZXdFbGVtZW50LCBJV2Vidmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi93ZWJ2aWV3L2Jyb3dzZXIvd2Vidmlldy5qcyc7XG5pbXBvcnQgJy4vZ2V0dGluZ1N0YXJ0ZWRDb2xvcnMuanMnO1xuaW1wb3J0IHsgR2V0dGluZ1N0YXJ0ZWREZXRhaWxzUmVuZGVyZXIgfSBmcm9tICcuL2dldHRpbmdTdGFydGVkRGV0YWlsc1JlbmRlcmVyLmpzJztcbmltcG9ydCB7IGdldHRpbmdTdGFydGVkQ2hlY2tlZENvZGljb24sIGdldHRpbmdTdGFydGVkVW5jaGVja2VkQ29kaWNvbiB9IGZyb20gJy4vZ2V0dGluZ1N0YXJ0ZWRJY29ucy5qcyc7XG5pbXBvcnQgeyBHZXR0aW5nU3RhcnRlZElucHV0IH0gZnJvbSAnLi9nZXR0aW5nU3RhcnRlZElucHV0LmpzJztcbmltcG9ydCB7IElSZXNvbHZlZFdhbGt0aHJvdWdoLCBJUmVzb2x2ZWRXYWxrdGhyb3VnaFN0ZXAsIElXYWxrdGhyb3VnaHNTZXJ2aWNlLCBoaWRkZW5FbnRyaWVzQ29uZmlndXJhdGlvbktleSwgcGFyc2VEZXNjcmlwdGlvbiB9IGZyb20gJy4vZ2V0dGluZ1N0YXJ0ZWRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlc3RvcmVXYWxrdGhyb3VnaHNDb25maWd1cmF0aW9uVmFsdWUsIHJlc3RvcmVXYWxrdGhyb3VnaHNDb25maWd1cmF0aW9uS2V5IH0gZnJvbSAnLi9zdGFydHVwUGFnZS5qcyc7XG5pbXBvcnQgeyBzdGFydEVudHJpZXMgfSBmcm9tICcuLi9jb21tb24vZ2V0dGluZ1N0YXJ0ZWRDb250ZW50LmpzJztcbmltcG9ydCB7IEdyb3VwRGlyZWN0aW9uLCBHcm91cHNPcmRlciwgSUVkaXRvckdyb3VwLCBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaFRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RoZW1lcy9jb21tb24vd29ya2JlbmNoVGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEdldHRpbmdTdGFydGVkSW5kZXhMaXN0IH0gZnJvbSAnLi9nZXR0aW5nU3RhcnRlZExpc3QuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZCB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmxlVmlld0FjdGlvbiB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmxlVmlld0FjdGlvbnMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ0xhYmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2tleWJpbmRpbmdMYWJlbC9rZXliaW5kaW5nTGFiZWwuanMnO1xuaW1wb3J0IHsgU2Nyb2xsYmFyVmlzaWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Njcm9sbGFibGUuanMnO1xuXG5jb25zdCBTTElERV9UUkFOU0lUSU9OX1RJTUVfTVMgPSAyNTA7XG5jb25zdCBjb25maWd1cmF0aW9uS2V5ID0gJ3dvcmtiZW5jaC5zdGFydHVwRWRpdG9yJztcblxuZXhwb3J0IGNvbnN0IGFsbFdhbGt0aHJvdWdoc0hpZGRlbkNvbnRleHQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignYWxsV2Fsa3Rocm91Z2hzSGlkZGVuJywgZmFsc2UpO1xuZXhwb3J0IGNvbnN0IGluV2VsY29tZUNvbnRleHQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignaW5XZWxjb21lJywgZmFsc2UpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElXZWxjb21lUGFnZVN0YXJ0RW50cnkge1xuXHRpZDogc3RyaW5nO1xuXHR0aXRsZTogc3RyaW5nO1xuXHRkZXNjcmlwdGlvbjogc3RyaW5nO1xuXHRjb21tYW5kOiBzdHJpbmc7XG5cdG9yZGVyOiBudW1iZXI7XG5cdGljb246IHsgdHlwZTogJ2ljb24nOyBpY29uOiBUaGVtZUljb24gfTtcblx0d2hlbjogQ29udGV4dEtleUV4cHJlc3Npb247XG59XG5cbmNvbnN0IHBhcnNlZFN0YXJ0RW50cmllczogSVdlbGNvbWVQYWdlU3RhcnRFbnRyeVtdID0gc3RhcnRFbnRyaWVzLm1hcCgoZSwgaSkgPT4gKHtcblx0Y29tbWFuZDogZS5jb250ZW50LmNvbW1hbmQsXG5cdGRlc2NyaXB0aW9uOiBlLmRlc2NyaXB0aW9uLFxuXHRpY29uOiB7IHR5cGU6ICdpY29uJywgaWNvbjogZS5pY29uIH0sXG5cdGlkOiBlLmlkLFxuXHRvcmRlcjogaSxcblx0dGl0bGU6IGUudGl0bGUsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKGUud2hlbikgPz8gQ29udGV4dEtleUV4cHIudHJ1ZSgpXG59KSk7XG5cbnR5cGUgR2V0dGluZ1N0YXJ0ZWRBY3Rpb25DbGFzc2lmaWNhdGlvbiA9IHtcblx0Y29tbWFuZDogeyBjbGFzc2lmaWNhdGlvbjogJ1B1YmxpY05vblBlcnNvbmFsRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgY29tbWFuZCBiZWluZyBleGVjdXRlZCBvbiB0aGUgZ2V0dGluZyBzdGFydGVkIHBhZ2UuJyB9O1xuXHR3YWxrdGhyb3VnaElkOiB7IGNsYXNzaWZpY2F0aW9uOiAnUHVibGljTm9uUGVyc29uYWxEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSB3YWxrdGhyb3VnaCB3aGljaCB0aGUgY29tbWFuZCBpcyBpbicgfTtcblx0YXJndW1lbnQ6IHsgY2xhc3NpZmljYXRpb246ICdQdWJsaWNOb25QZXJzb25hbERhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGFyZ3VtZW50cyBiZWluZyBwYXNzZWQgdG8gdGhlIGNvbW1hbmQnIH07XG5cdG93bmVyOiAnbHJhbW9zMTUnO1xuXHRjb21tZW50OiAnSGVscCB1bmRlcnN0YW5kIHdoYXQgYWN0aW9ucyBhcmUgbW9zdCBjb21tb25seSB0YWtlbiBvbiB0aGUgZ2V0dGluZyBzdGFydGVkIHBhZ2UnO1xufTtcblxudHlwZSBHZXR0aW5nU3RhcnRlZEFjdGlvbkV2ZW50ID0ge1xuXHRjb21tYW5kOiBzdHJpbmc7XG5cdHdhbGt0aHJvdWdoSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0YXJndW1lbnQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbn07XG5cbnR5cGUgUmVjZW50RW50cnkgPSAoSVJlY2VudEZvbGRlciB8IElSZWNlbnRXb3Jrc3BhY2UpICYgeyBpZDogc3RyaW5nIH07XG5cbmNvbnN0IFJFRFVDRURfTU9USU9OX0tFWSA9ICd3b3JrYmVuY2gud2VsY29tZVBhZ2UucHJlZmVyUmVkdWNlZE1vdGlvbic7XG5leHBvcnQgY2xhc3MgR2V0dGluZ1N0YXJ0ZWRQYWdlIGV4dGVuZHMgRWRpdG9yUGFuZSB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdnZXR0aW5nU3RhcnRlZFBhZ2UnO1xuXG5cdHByaXZhdGUgZWRpdG9ySW5wdXQhOiBHZXR0aW5nU3RhcnRlZElucHV0O1xuXHRwcml2YXRlIGluUHJvZ3Jlc3NTY3JvbGwgPSBQcm9taXNlLnJlc29sdmUoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3BhdGNoTGlzdGVuZXJzOiBEaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgc3RlcERpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGV0YWlsc1BhZ2VEaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1lZGlhRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHQvLyBFbnN1cmUgdGhhdCB0aGUgdGhlc2UgYXJlIGluaXRpYWxpemVkIGJlZm9yZSB1c2UuXG5cdC8vIEN1cnJlbnRseSBpbml0aWFsaXplZCBiZWZvcmUgdXNlIGluIGJ1aWxkQ2F0ZWdvcmllc1NsaWRlIGFuZCBzY3JvbGxUb0NhdGVnb3J5XG5cdHByaXZhdGUgcmVjZW50bHlPcGVuZWQhOiBQcm9taXNlPElSZWNlbnRseU9wZW5lZD47XG5cdHByaXZhdGUgZ2V0dGluZ1N0YXJ0ZWRDYXRlZ29yaWVzITogSVJlc29sdmVkV2Fsa3Rocm91Z2hbXTtcblxuXHRwcml2YXRlIGN1cnJlbnRXYWxrdGhyb3VnaDogSVJlc29sdmVkV2Fsa3Rocm91Z2ggfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcHJldldhbGt0aHJvdWdoOiBJUmVzb2x2ZWRXYWxrdGhyb3VnaCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGNhdGVnb3JpZXNQYWdlU2Nyb2xsYmFyOiBEb21TY3JvbGxhYmxlRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBkZXRhaWxzUGFnZVNjcm9sbGJhcjogRG9tU2Nyb2xsYWJsZUVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBkZXRhaWxzU2Nyb2xsYmFyOiBEb21TY3JvbGxhYmxlRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGJ1aWxkU2xpZGVUaHJvdHRsZTogVGhyb3R0bGVyID0gbmV3IFRocm90dGxlcigpO1xuXG5cdHByaXZhdGUgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIGNvbnRleHRTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2U7XG5cblx0cHJpdmF0ZSBoYXNTY3JvbGxlZFRvRmlyc3RDYXRlZ29yeSA9IGZhbHNlO1xuXHRwcml2YXRlIHJlY2VudGx5T3BlbmVkTGlzdD86IEdldHRpbmdTdGFydGVkSW5kZXhMaXN0PFJlY2VudEVudHJ5Pjtcblx0cHJpdmF0ZSBzdGFydExpc3Q/OiBHZXR0aW5nU3RhcnRlZEluZGV4TGlzdDxJV2VsY29tZVBhZ2VTdGFydEVudHJ5Pjtcblx0cHJpdmF0ZSBnZXR0aW5nU3RhcnRlZExpc3Q/OiBHZXR0aW5nU3RhcnRlZEluZGV4TGlzdDxJUmVzb2x2ZWRXYWxrdGhyb3VnaD47XG5cblx0cHJpdmF0ZSBzdGVwc1NsaWRlITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgY2F0ZWdvcmllc1NsaWRlITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgc3RlcHNDb250ZW50ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgc3RlcE1lZGlhQ29tcG9uZW50ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgd2VidmlldyE6IElXZWJ2aWV3RWxlbWVudDtcblxuXHRwcml2YXRlIGxheW91dE1hcmtkb3duOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBkZXRhaWxzUmVuZGVyZXI6IEdldHRpbmdTdGFydGVkRGV0YWlsc1JlbmRlcmVyO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY2F0ZWdvcmllc1NsaWRlRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0cHJpdmF0ZSBzaG93RmVhdHVyZWRXYWxrdGhyb3VnaCA9IHRydWU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Z3JvdXA6IElFZGl0b3JHcm91cCxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASVdhbGt0aHJvdWdoc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBnZXR0aW5nU3RhcnRlZFNlcnZpY2U6IElXYWxrdGhyb3VnaHNTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASVdvcmtiZW5jaFRoZW1lU2VydmljZSBwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVhZG9ubHkgdGhlbWVTZXJ2aWNlOiBJV29ya2JlbmNoVGhlbWVTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGdyb3Vwc1NlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dFNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASVdvcmtzcGFjZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlc1NlcnZpY2U6IElXb3Jrc3BhY2VzU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVdlYnZpZXdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd2Vidmlld1NlcnZpY2U6IElXZWJ2aWV3U2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZVxuXHQpIHtcblxuXHRcdHN1cGVyKEdldHRpbmdTdGFydGVkUGFnZS5JRCwgZ3JvdXAsIHRlbGVtZXRyeVNlcnZpY2UsIHRoZW1lU2VydmljZSwgc3RvcmFnZVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5jb250YWluZXIgPSAkKCcuZ2V0dGluZ1N0YXJ0ZWRDb250YWluZXInLFxuXHRcdFx0e1xuXHRcdFx0XHRyb2xlOiAnZG9jdW1lbnQnLFxuXHRcdFx0XHR0YWJpbmRleDogMCxcblx0XHRcdFx0J2FyaWEtbGFiZWwnOiBsb2NhbGl6ZSgnd2VsY29tZUFyaWFMYWJlbCcsIFwiT3ZlcnZpZXcgb2YgaG93IHRvIGdldCB1cCB0byBzcGVlZCB3aXRoIHlvdXIgZWRpdG9yLlwiKVxuXHRcdFx0fSk7XG5cdFx0dGhpcy5zdGVwTWVkaWFDb21wb25lbnQgPSAkKCcuZ2V0dGluZy1zdGFydGVkLW1lZGlhJyk7XG5cdFx0dGhpcy5zdGVwTWVkaWFDb21wb25lbnQuaWQgPSBnZW5lcmF0ZVV1aWQoKTtcblxuXHRcdHRoaXMuY2F0ZWdvcmllc1NsaWRlRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdFx0dGhpcy5kZXRhaWxzUmVuZGVyZXIgPSBuZXcgR2V0dGluZ1N0YXJ0ZWREZXRhaWxzUmVuZGVyZXIodGhpcy5maWxlU2VydmljZSwgdGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLCB0aGlzLmV4dGVuc2lvblNlcnZpY2UsIHRoaXMubGFuZ3VhZ2VTZXJ2aWNlKTtcblxuXHRcdHRoaXMuY29udGV4dFNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcihjb250ZXh0U2VydmljZS5jcmVhdGVTY29wZWQodGhpcy5jb250YWluZXIpKTtcblx0XHRpbldlbGNvbWVDb250ZXh0LmJpbmRUbyh0aGlzLmNvbnRleHRTZXJ2aWNlKS5zZXQodHJ1ZSk7XG5cblx0XHR0aGlzLmdldHRpbmdTdGFydGVkQ2F0ZWdvcmllcyA9IHRoaXMuZ2V0dGluZ1N0YXJ0ZWRTZXJ2aWNlLmdldFdhbGt0aHJvdWdocygpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kaXNwYXRjaExpc3RlbmVycyk7XG5cdFx0dGhpcy5idWlsZFNsaWRlVGhyb3R0bGUgPSBuZXcgVGhyb3R0bGVyKCk7XG5cblx0XHRjb25zdCByZXJlbmRlciA9ICgpID0+IHtcblx0XHRcdHRoaXMuZ2V0dGluZ1N0YXJ0ZWRDYXRlZ29yaWVzID0gdGhpcy5nZXR0aW5nU3RhcnRlZFNlcnZpY2UuZ2V0V2Fsa3Rocm91Z2hzKCk7XG5cdFx0XHRpZiAodGhpcy5jdXJyZW50V2Fsa3Rocm91Z2gpIHtcblx0XHRcdFx0Y29uc3QgZXhpc3RpbmdTdGVwcyA9IHRoaXMuY3VycmVudFdhbGt0aHJvdWdoLnN0ZXBzLm1hcChzdGVwID0+IHN0ZXAuaWQpO1xuXHRcdFx0XHRjb25zdCBuZXdDYXRlZ29yeSA9IHRoaXMuZ2V0dGluZ1N0YXJ0ZWRDYXRlZ29yaWVzLmZpbmQoY2F0ZWdvcnkgPT4gdGhpcy5jdXJyZW50V2Fsa3Rocm91Z2g/LmlkID09PSBjYXRlZ29yeS5pZCk7XG5cdFx0XHRcdGlmIChuZXdDYXRlZ29yeSkge1xuXHRcdFx0XHRcdGNvbnN0IG5ld1N0ZXBzID0gbmV3Q2F0ZWdvcnkuc3RlcHMubWFwKHN0ZXAgPT4gc3RlcC5pZCk7XG5cdFx0XHRcdFx0aWYgKCFlcXVhbHMobmV3U3RlcHMsIGV4aXN0aW5nU3RlcHMpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmJ1aWxkU2xpZGVUaHJvdHRsZS5xdWV1ZSgoKSA9PiB0aGlzLmJ1aWxkQ2F0ZWdvcmllc1NsaWRlKCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5idWlsZFNsaWRlVGhyb3R0bGUucXVldWUoKCkgPT4gdGhpcy5idWlsZENhdGVnb3JpZXNTbGlkZSgpKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5nZXR0aW5nU3RhcnRlZFNlcnZpY2Uub25EaWRBZGRXYWxrdGhyb3VnaChyZXJlbmRlcikpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZ2V0dGluZ1N0YXJ0ZWRTZXJ2aWNlLm9uRGlkUmVtb3ZlV2Fsa3Rocm91Z2gocmVyZW5kZXIpKTtcblxuXHRcdHRoaXMucmVjZW50bHlPcGVuZWQgPSB0aGlzLndvcmtzcGFjZXNTZXJ2aWNlLmdldFJlY2VudGx5T3BlbmVkKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIod29ya3NwYWNlc1NlcnZpY2Uub25EaWRDaGFuZ2VSZWNlbnRseU9wZW5lZCgoKSA9PiB7XG5cdFx0XHR0aGlzLnJlY2VudGx5T3BlbmVkID0gd29ya3NwYWNlc1NlcnZpY2UuZ2V0UmVjZW50bHlPcGVuZWQoKTtcblx0XHRcdHJlcmVuZGVyKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5nZXR0aW5nU3RhcnRlZFNlcnZpY2Uub25EaWRDaGFuZ2VXYWxrdGhyb3VnaChjYXRlZ29yeSA9PiB7XG5cdFx0XHRjb25zdCBvdXJDYXRlZ29yeSA9IHRoaXMuZ2V0dGluZ1N0YXJ0ZWRDYXRlZ29yaWVzLmZpbmQoYyA9PiBjLmlkID09PSBjYXRlZ29yeS5pZCk7XG5cdFx0XHRpZiAoIW91ckNhdGVnb3J5KSB7IHJldHVybjsgfVxuXG5cdFx0XHRvdXJDYXRlZ29yeS50aXRsZSA9IGNhdGVnb3J5LnRpdGxlO1xuXHRcdFx0b3VyQ2F0ZWdvcnkuZGVzY3JpcHRpb24gPSBjYXRlZ29yeS5kZXNjcmlwdGlvbjtcblxuXHRcdFx0dGhpcy5jb250YWluZXIucXVlcnlTZWxlY3RvckFsbDxIVE1MRGl2RWxlbWVudD4oYFt4LWNhdGVnb3J5LXRpdGxlLWZvcj1cIiR7Y2F0ZWdvcnkuaWR9XCJdYCkuZm9yRWFjaChzdGVwID0+IChzdGVwIGFzIEhUTUxEaXZFbGVtZW50KS5pbm5lclRleHQgPSBvdXJDYXRlZ29yeS50aXRsZSk7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsPEhUTUxEaXZFbGVtZW50PihgW3gtY2F0ZWdvcnktZGVzY3JpcHRpb24tZm9yPVwiJHtjYXRlZ29yeS5pZH1cIl1gKS5mb3JFYWNoKHN0ZXAgPT4gKHN0ZXAgYXMgSFRNTERpdkVsZW1lbnQpLmlubmVyVGV4dCA9IG91ckNhdGVnb3J5LmRlc2NyaXB0aW9uKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmdldHRpbmdTdGFydGVkU2VydmljZS5vbkRpZFByb2dyZXNzU3RlcChzdGVwID0+IHtcblx0XHRcdGNvbnN0IGNhdGVnb3J5ID0gdGhpcy5nZXR0aW5nU3RhcnRlZENhdGVnb3JpZXMuZmluZChjYXRlZ29yeSA9PiBjYXRlZ29yeS5pZCA9PT0gc3RlcC5jYXRlZ29yeSk7XG5cdFx0XHRpZiAoIWNhdGVnb3J5KSB7IHRocm93IEVycm9yKCdDb3VsZCBub3QgZmluZCBjYXRlZ29yeSB3aXRoIElEOiAnICsgc3RlcC5jYXRlZ29yeSk7IH1cblx0XHRcdGNvbnN0IG91clN0ZXAgPSBjYXRlZ29yeS5zdGVwcy5maW5kKF9zdGVwID0+IF9zdGVwLmlkID09PSBzdGVwLmlkKTtcblx0XHRcdGlmICghb3VyU3RlcCkge1xuXHRcdFx0XHR0aHJvdyBFcnJvcignQ291bGQgbm90IGZpbmQgc3RlcCB3aXRoIElEOiAnICsgc3RlcC5pZCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHN0YXRzID0gdGhpcy5nZXRXYWxrdGhyb3VnaENvbXBsZXRpb25TdGF0cyhjYXRlZ29yeSk7XG5cdFx0XHRpZiAoIW91clN0ZXAuZG9uZSAmJiBzdGF0cy5zdGVwc0NvbXBsZXRlID09PSBzdGF0cy5zdGVwc1RvdGFsIC0gMSkge1xuXHRcdFx0XHR0aGlzLmhpZGVDYXRlZ29yeShjYXRlZ29yeS5pZCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihSRURVQ0VEX01PVElPTl9LRVkpKSB7XG5cdFx0XHRcdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnYW5pbWF0YWJsZScsIHRoaXMuc2hvdWxkQW5pbWF0ZSgpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0b3VyU3RlcC5kb25lID0gc3RlcC5kb25lO1xuXG5cdFx0XHRpZiAoY2F0ZWdvcnkuaWQgPT09IHRoaXMuY3VycmVudFdhbGt0aHJvdWdoPy5pZCkge1xuXHRcdFx0XHRjb25zdCBiYWRnZWVsZW1lbnRzID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMud2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYFtkYXRhLWRvbmUtc3RlcC1pZD1cIiR7c3RlcC5pZH1cIl1gKSk7XG5cdFx0XHRcdGJhZGdlZWxlbWVudHMuZm9yRWFjaChiYWRnZWVsZW1lbnQgPT4ge1xuXHRcdFx0XHRcdGlmIChzdGVwLmRvbmUpIHtcblx0XHRcdFx0XHRcdGJhZGdlZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcsICd0cnVlJyk7XG5cdFx0XHRcdFx0XHRiYWRnZWVsZW1lbnQucGFyZW50RWxlbWVudD8uc2V0QXR0cmlidXRlKCdhcmlhLWNoZWNrZWQnLCAndHJ1ZScpO1xuXHRcdFx0XHRcdFx0YmFkZ2VlbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoZ2V0dGluZ1N0YXJ0ZWRVbmNoZWNrZWRDb2RpY29uKSk7XG5cdFx0XHRcdFx0XHRiYWRnZWVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnY29tcGxldGUnLCAuLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShnZXR0aW5nU3RhcnRlZENoZWNrZWRDb2RpY29uKSk7XG5cdFx0XHRcdFx0XHRiYWRnZWVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgbG9jYWxpemUoJ3N0ZXBEb25lJywgXCJDaGVja2JveCBmb3IgU3RlcCB7MH06IENvbXBsZXRlZFwiLCBzdGVwLnRpdGxlKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0YmFkZ2VlbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJywgJ2ZhbHNlJyk7XG5cdFx0XHRcdFx0XHRiYWRnZWVsZW1lbnQucGFyZW50RWxlbWVudD8uc2V0QXR0cmlidXRlKCdhcmlhLWNoZWNrZWQnLCAnZmFsc2UnKTtcblx0XHRcdFx0XHRcdGJhZGdlZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdjb21wbGV0ZScsIC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KGdldHRpbmdTdGFydGVkQ2hlY2tlZENvZGljb24pKTtcblx0XHRcdFx0XHRcdGJhZGdlZWxlbWVudC5jbGFzc0xpc3QuYWRkKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KGdldHRpbmdTdGFydGVkVW5jaGVja2VkQ29kaWNvbikpO1xuXHRcdFx0XHRcdFx0YmFkZ2VlbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGxvY2FsaXplKCdzdGVwTm90RG9uZScsIFwiQ2hlY2tib3ggZm9yIFN0ZXAgezB9OiBOb3QgY29tcGxldGVkXCIsIHN0ZXAudGl0bGUpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy51cGRhdGVDYXRlZ29yeVByb2dyZXNzKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zdG9yYWdlU2VydmljZS5vbldpbGxTYXZlU3RhdGUoKGUpID0+IHtcblx0XHRcdGlmIChlLnJlYXNvbiAhPT0gV2lsbFNhdmVTdGF0ZVJlYXNvbi5TSFVURE9XTikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLmVkaXRvcklucHV0IHx8ICF0aGlzLmN1cnJlbnRXYWxrdGhyb3VnaCB8fCAhdGhpcy5lZGl0b3JJbnB1dC5zZWxlY3RlZENhdGVnb3J5IHx8ICF0aGlzLmVkaXRvcklucHV0LnNlbGVjdGVkU3RlcCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSB0aGlzLmdyb3Vwc1NlcnZpY2UuYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdGlmICghKGVkaXRvclBhbmUgaW5zdGFuY2VvZiBHZXR0aW5nU3RhcnRlZFBhZ2UpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2F2ZSB0aGUgc3RhdGUgb2YgdGhlIHdhbGt0aHJvdWdoIHNvIHdlIGNhbiByZXN0b3JlIGl0IG9uIHJlbG9hZFxuXHRcdFx0Y29uc3QgcmVzdG9yZURhdGE6IFJlc3RvcmVXYWxrdGhyb3VnaHNDb25maWd1cmF0aW9uVmFsdWUgPSB7IGZvbGRlcjogVU5LTk9XTl9FTVBUWV9XSU5ET1dfV09SS1NQQUNFLmlkLCBjYXRlZ29yeTogdGhpcy5lZGl0b3JJbnB1dC5zZWxlY3RlZENhdGVnb3J5LCBzdGVwOiB0aGlzLmVkaXRvcklucHV0LnNlbGVjdGVkU3RlcCB9O1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShcblx0XHRcdFx0cmVzdG9yZVdhbGt0aHJvdWdoc0NvbmZpZ3VyYXRpb25LZXksXG5cdFx0XHRcdEpTT04uc3RyaW5naWZ5KHJlc3RvcmVEYXRhKSxcblx0XHRcdFx0U3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0Ly8gcmVtb3ZlIHdoZW4gJ3dvcmtiZW5jaC53ZWxjb21lUGFnZS5wcmVmZXJSZWR1Y2VkTW90aW9uJyBkZXByZWNhdGVkXG5cdHByaXZhdGUgc2hvdWxkQW5pbWF0ZSgpIHtcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShSRURVQ0VEX01PVElPTl9LRVkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICh0aGlzLmFjY2Vzc2liaWxpdHlTZXJ2aWNlLmlzTW90aW9uUmVkdWNlZCgpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRXYWxrdGhyb3VnaENvbXBsZXRpb25TdGF0cyh3YWxrdGhyb3VnaDogSVJlc29sdmVkV2Fsa3Rocm91Z2gpOiB7IHN0ZXBzQ29tcGxldGU6IG51bWJlcjsgc3RlcHNUb3RhbDogbnVtYmVyIH0ge1xuXHRcdGNvbnN0IGFjdGl2ZVN0ZXBzID0gd2Fsa3Rocm91Z2guc3RlcHMuZmlsdGVyKHMgPT4gdGhpcy5jb250ZXh0U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKHMud2hlbikpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRzdGVwc0NvbXBsZXRlOiBhY3RpdmVTdGVwcy5maWx0ZXIocyA9PiBzLmRvbmUpLmxlbmd0aCxcblx0XHRcdHN0ZXBzVG90YWw6IGFjdGl2ZVN0ZXBzLmxlbmd0aCxcblx0XHR9O1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgc2V0SW5wdXQobmV3SW5wdXQ6IEdldHRpbmdTdGFydGVkSW5wdXQsIG9wdGlvbnM6IElFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkLCBjb250ZXh0OiBJRWRpdG9yT3BlbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2FuaW1hdGFibGUnKTtcblx0XHR0aGlzLmVkaXRvcklucHV0ID0gbmV3SW5wdXQ7XG5cdFx0YXdhaXQgc3VwZXIuc2V0SW5wdXQobmV3SW5wdXQsIG9wdGlvbnMsIGNvbnRleHQsIHRva2VuKTtcblx0XHRhd2FpdCB0aGlzLmJ1aWxkQ2F0ZWdvcmllc1NsaWRlKCk7XG5cdFx0aWYgKHRoaXMuc2hvdWxkQW5pbWF0ZSgpKSB7XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2FuaW1hdGFibGUnKSwgMCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgbWFrZUNhdGVnb3J5VmlzaWJsZVdoZW5BdmFpbGFibGUoY2F0ZWdvcnlJRDogc3RyaW5nLCBzdGVwSWQ/OiBzdHJpbmcpIHtcblx0XHR0aGlzLnNjcm9sbFRvQ2F0ZWdvcnkoY2F0ZWdvcnlJRCwgc3RlcElkKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJEaXNwYXRjaExpc3RlbmVycygpIHtcblx0XHR0aGlzLmRpc3BhdGNoTGlzdGVuZXJzLmNsZWFyKCk7XG5cblx0XHR0aGlzLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCdbeC1kaXNwYXRjaF0nKS5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuXHRcdFx0Y29uc3QgZGlzcGF0Y2ggPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgneC1kaXNwYXRjaCcpID8/ICcnO1xuXHRcdFx0bGV0IGNvbW1hbmQsIGFyZ3VtZW50O1xuXHRcdFx0aWYgKGRpc3BhdGNoLnN0YXJ0c1dpdGgoJ29wZW5MaW5rOmh0dHBzJykpIHtcblx0XHRcdFx0W2NvbW1hbmQsIGFyZ3VtZW50XSA9IFsnb3BlbkxpbmsnLCBkaXNwYXRjaC5yZXBsYWNlKCdvcGVuTGluazonLCAnJyldO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0W2NvbW1hbmQsIGFyZ3VtZW50XSA9IGRpc3BhdGNoLnNwbGl0KCc6Jyk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoY29tbWFuZCkge1xuXHRcdFx0XHR0aGlzLmRpc3BhdGNoTGlzdGVuZXJzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIoZWxlbWVudCwgJ2NsaWNrJywgKGUpID0+IHtcblx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdHRoaXMucnVuRGlzcGF0Y2hDb21tYW5kKGNvbW1hbmQsIGFyZ3VtZW50KTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHR0aGlzLmRpc3BhdGNoTGlzdGVuZXJzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIoZWxlbWVudCwgJ2tleXVwJywgKGUpID0+IHtcblx0XHRcdFx0XHRjb25zdCBrZXlib2FyZEV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdHN3aXRjaCAoa2V5Ym9hcmRFdmVudC5rZXlDb2RlKSB7XG5cdFx0XHRcdFx0XHRjYXNlIEtleUNvZGUuRW50ZXI6XG5cdFx0XHRcdFx0XHRjYXNlIEtleUNvZGUuU3BhY2U6XG5cdFx0XHRcdFx0XHRcdHRoaXMucnVuRGlzcGF0Y2hDb21tYW5kKGNvbW1hbmQsIGFyZ3VtZW50KTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW5EaXNwYXRjaENvbW1hbmQoY29tbWFuZDogc3RyaW5nLCBhcmd1bWVudDogc3RyaW5nKSB7XG5cdFx0dGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi5rZWVwRWRpdG9yJyk7XG5cdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8R2V0dGluZ1N0YXJ0ZWRBY3Rpb25FdmVudCwgR2V0dGluZ1N0YXJ0ZWRBY3Rpb25DbGFzc2lmaWNhdGlvbj4oJ2dldHRpbmdTdGFydGVkLkFjdGlvbkV4ZWN1dGVkJywgeyBjb21tYW5kLCBhcmd1bWVudCwgd2Fsa3Rocm91Z2hJZDogdGhpcy5jdXJyZW50V2Fsa3Rocm91Z2g/LmlkIH0pO1xuXHRcdHN3aXRjaCAoY29tbWFuZCkge1xuXHRcdFx0Y2FzZSAnc2Nyb2xsUHJldic6IHtcblx0XHRcdFx0dGhpcy5zY3JvbGxQcmV2KCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnc2tpcCc6IHtcblx0XHRcdFx0dGhpcy5ydW5Ta2lwKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnc2hvd01vcmVSZWNlbnRzJzoge1xuXHRcdFx0XHR0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKE9wZW5SZWNlbnRBY3Rpb24uSUQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ3NlZUFsbFdhbGt0aHJvdWdocyc6IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5vcGVuV2Fsa3Rocm91Z2hTZWxlY3RvcigpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ29wZW5Gb2xkZXInOiB7XG5cdFx0XHRcdGlmICh0aGlzLmNvbnRleHRTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMoQ29udGV4dEtleUV4cHIuYW5kKFdvcmtiZW5jaFN0YXRlQ29udGV4dC5pc0VxdWFsVG8oJ3dvcmtzcGFjZScpKSkpIHtcblx0XHRcdFx0XHR0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKE9wZW5Gb2xkZXJWaWFXb3Jrc3BhY2VBY3Rpb24uSUQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoaXNNYWNpbnRvc2ggPyAnd29ya2JlbmNoLmFjdGlvbi5maWxlcy5vcGVuRmlsZUZvbGRlcicgOiAnd29ya2JlbmNoLmFjdGlvbi5maWxlcy5vcGVuRm9sZGVyJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdzZWxlY3RDYXRlZ29yeSc6IHtcblx0XHRcdFx0dGhpcy5zY3JvbGxUb0NhdGVnb3J5KGFyZ3VtZW50KTtcblx0XHRcdFx0dGhpcy5nZXR0aW5nU3RhcnRlZFNlcnZpY2UubWFya1dhbGt0aHJvdWdoT3BlbmVkKGFyZ3VtZW50KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdzZWxlY3RTdGFydEVudHJ5Jzoge1xuXHRcdFx0XHRjb25zdCBzZWxlY3RlZCA9IHN0YXJ0RW50cmllcy5maW5kKGUgPT4gZS5pZCA9PT0gYXJndW1lbnQpO1xuXHRcdFx0XHRpZiAoc2VsZWN0ZWQpIHtcblx0XHRcdFx0XHR0aGlzLnJ1blN0ZXBDb21tYW5kKHNlbGVjdGVkLmNvbnRlbnQuY29tbWFuZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhyb3cgRXJyb3IoJ2NvdWxkIG5vdCBmaW5kIHN0YXJ0IGVudHJ5IHdpdGggaWQ6ICcgKyBhcmd1bWVudCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdoaWRlQ2F0ZWdvcnknOiB7XG5cdFx0XHRcdHRoaXMuaGlkZUNhdGVnb3J5KGFyZ3VtZW50KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHQvLyBVc2Ugc2VsZWN0VGFzayBvdmVyIHNlbGVjdFN0ZXAgdG8ga2VlcCB0ZWxlbWV0cnkgY29uc2lzdGFudDpodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTIyMjU2XG5cdFx0XHRjYXNlICdzZWxlY3RUYXNrJzoge1xuXHRcdFx0XHR0aGlzLnNlbGVjdFN0ZXAoYXJndW1lbnQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ3RvZ2dsZVN0ZXBDb21wbGV0aW9uJzoge1xuXHRcdFx0XHR0aGlzLnRvZ2dsZVN0ZXBDb21wbGV0aW9uKGFyZ3VtZW50KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdhbGxEb25lJzoge1xuXHRcdFx0XHR0aGlzLm1hcmtBbGxTdGVwc0NvbXBsZXRlKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnbmV4dFNlY3Rpb24nOiB7XG5cdFx0XHRcdGNvbnN0IG5leHQgPSB0aGlzLmN1cnJlbnRXYWxrdGhyb3VnaD8ubmV4dDtcblx0XHRcdFx0aWYgKG5leHQpIHtcblx0XHRcdFx0XHR0aGlzLnByZXZXYWxrdGhyb3VnaCA9IHRoaXMuY3VycmVudFdhbGt0aHJvdWdoO1xuXHRcdFx0XHRcdHRoaXMuc2Nyb2xsVG9DYXRlZ29yeShuZXh0KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCdFcnJvciBzY3JvbGxpbmcgdG8gbmV4dCBzZWN0aW9uIG9mJywgdGhpcy5jdXJyZW50V2Fsa3Rocm91Z2gpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnb3BlbkxpbmsnOiB7XG5cdFx0XHRcdHRoaXMub3BlbmVyU2VydmljZS5vcGVuKGFyZ3VtZW50KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoJ0Rpc3BhdGNoIHRvJywgY29tbWFuZCwgYXJndW1lbnQsICdub3QgZGVmaW5lZCcpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhpZGVDYXRlZ29yeShjYXRlZ29yeUlkOiBzdHJpbmcpIHtcblx0XHRjb25zdCBzZWxlY3RlZENhdGVnb3J5ID0gdGhpcy5nZXR0aW5nU3RhcnRlZENhdGVnb3JpZXMuZmluZChjYXRlZ29yeSA9PiBjYXRlZ29yeS5pZCA9PT0gY2F0ZWdvcnlJZCk7XG5cdFx0aWYgKCFzZWxlY3RlZENhdGVnb3J5KSB7IHRocm93IEVycm9yKCdDb3VsZCBub3QgZmluZCBjYXRlZ29yeSB3aXRoIElEICcgKyBjYXRlZ29yeUlkKTsgfVxuXHRcdHRoaXMuc2V0SGlkZGVuQ2F0ZWdvcmllcyhbLi4udGhpcy5nZXRIaWRkZW5DYXRlZ29yaWVzKCkuYWRkKGNhdGVnb3J5SWQpXSk7XG5cdFx0dGhpcy5nZXR0aW5nU3RhcnRlZExpc3Q/LnJlcmVuZGVyKCk7XG5cdH1cblxuXHRwcml2YXRlIG1hcmtBbGxTdGVwc0NvbXBsZXRlKCkge1xuXHRcdGlmICh0aGlzLmN1cnJlbnRXYWxrdGhyb3VnaCkge1xuXHRcdFx0dGhpcy5jdXJyZW50V2Fsa3Rocm91Z2g/LnN0ZXBzLmZvckVhY2goc3RlcCA9PiB7XG5cdFx0XHRcdGlmICghc3RlcC5kb25lKSB7XG5cdFx0XHRcdFx0dGhpcy5nZXR0aW5nU3RhcnRlZFNlcnZpY2UucHJvZ3Jlc3NTdGVwKHN0ZXAuaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuaGlkZUNhdGVnb3J5KHRoaXMuY3VycmVudFdhbGt0aHJvdWdoPy5pZCk7XG5cdFx0XHR0aGlzLnNjcm9sbFByZXYoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgRXJyb3IoJ05vIHdhbGt0aHJvdWdoIG9wZW5lZCcpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdG9nZ2xlU3RlcENvbXBsZXRpb24oYXJndW1lbnQ6IHN0cmluZykge1xuXHRcdGNvbnN0IHN0ZXBUb2dnbGUgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5jdXJyZW50V2Fsa3Rocm91Z2g/LnN0ZXBzLmZpbmQoc3RlcCA9PiBzdGVwLmlkID09PSBhcmd1bWVudCkpO1xuXHRcdGlmIChzdGVwVG9nZ2xlLmRvbmUpIHtcblx0XHRcdHRoaXMuZ2V0dGluZ1N0YXJ0ZWRTZXJ2aWNlLmRlcHJvZ3Jlc3NTdGVwKGFyZ3VtZW50KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5nZXR0aW5nU3RhcnRlZFNlcnZpY2UucHJvZ3Jlc3NTdGVwKGFyZ3VtZW50KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9wZW5XYWxrdGhyb3VnaFNlbGVjdG9yKCkge1xuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IGF3YWl0IHRoaXMucXVpY2tJbnB1dFNlcnZpY2UucGljayh0aGlzLmdldHRpbmdTdGFydGVkQ2F0ZWdvcmllc1xuXHRcdFx0LmZpbHRlcihjID0+IHRoaXMuY29udGV4dFNlcnZpY2UuY29udGV4dE1hdGNoZXNSdWxlcyhjLndoZW4pKVxuXHRcdFx0Lm1hcCh4ID0+ICh7XG5cdFx0XHRcdGlkOiB4LmlkLFxuXHRcdFx0XHRsYWJlbDogeC50aXRsZSxcblx0XHRcdFx0ZGV0YWlsOiB4LmRlc2NyaXB0aW9uLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogeC5zb3VyY2UsXG5cdFx0XHR9KSksIHsgY2FuUGlja01hbnk6IGZhbHNlLCBtYXRjaE9uRGVzY3JpcHRpb246IHRydWUsIG1hdGNoT25EZXRhaWw6IHRydWUsIHRpdGxlOiBsb2NhbGl6ZSgncGlja1dhbGt0aHJvdWdocycsIFwiT3BlbiBXYWxrdGhyb3VnaC4uLlwiKSB9KTtcblx0XHRpZiAoc2VsZWN0aW9uKSB7XG5cdFx0XHR0aGlzLnJ1bkRpc3BhdGNoQ29tbWFuZCgnc2VsZWN0Q2F0ZWdvcnknLCBzZWxlY3Rpb24uaWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0SGlkZGVuQ2F0ZWdvcmllcygpOiBTZXQ8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIG5ldyBTZXQoSlNPTi5wYXJzZSh0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChoaWRkZW5FbnRyaWVzQ29uZmlndXJhdGlvbktleSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsICdbXScpKSk7XG5cdH1cblxuXHRwcml2YXRlIHNldEhpZGRlbkNhdGVnb3JpZXMoaGlkZGVuOiBzdHJpbmdbXSkge1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoXG5cdFx0XHRoaWRkZW5FbnRyaWVzQ29uZmlndXJhdGlvbktleSxcblx0XHRcdEpTT04uc3RyaW5naWZ5KGhpZGRlbiksXG5cdFx0XHRTdG9yYWdlU2NvcGUuUFJPRklMRSxcblx0XHRcdFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdH1cblxuXHRwcml2YXRlIGN1cnJlbnRNZWRpYUNvbXBvbmVudDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGN1cnJlbnRNZWRpYVR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBhc3luYyBidWlsZE1lZGlhQ29tcG9uZW50KHN0ZXBJZDogc3RyaW5nLCBmb3JjZVJlYnVpbGQ6IGJvb2xlYW4gPSBmYWxzZSkge1xuXHRcdGlmICghdGhpcy5jdXJyZW50V2Fsa3Rocm91Z2gpIHtcblx0XHRcdHRocm93IEVycm9yKCdubyB3YWxrdGhyb3VnaCBzZWxlY3RlZCcpO1xuXHRcdH1cblx0XHRjb25zdCBzdGVwVG9FeHBhbmQgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5jdXJyZW50V2Fsa3Rocm91Z2guc3RlcHMuZmluZChzdGVwID0+IHN0ZXAuaWQgPT09IHN0ZXBJZCkpO1xuXG5cdFx0aWYgKCFmb3JjZVJlYnVpbGQgJiYgdGhpcy5jdXJyZW50TWVkaWFDb21wb25lbnQgPT09IHN0ZXBJZCkgeyByZXR1cm47IH1cblx0XHR0aGlzLmN1cnJlbnRNZWRpYUNvbXBvbmVudCA9IHN0ZXBJZDtcblxuXHRcdHRoaXMuc3RlcERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHR0aGlzLnN0ZXBEaXNwb3NhYmxlcy5hZGQoe1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmN1cnJlbnRNZWRpYUNvbXBvbmVudCA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlmICh0aGlzLmN1cnJlbnRNZWRpYVR5cGUgIT09IHN0ZXBUb0V4cGFuZC5tZWRpYS50eXBlKSB7XG5cblx0XHRcdHRoaXMuY3VycmVudE1lZGlhVHlwZSA9IHN0ZXBUb0V4cGFuZC5tZWRpYS50eXBlO1xuXG5cdFx0XHR0aGlzLm1lZGlhRGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuY3VycmVudE1lZGlhVHlwZSA9IHVuZGVmaW5lZDtcblx0XHRcdH0pKTtcblxuXHRcdFx0Y2xlYXJOb2RlKHRoaXMuc3RlcE1lZGlhQ29tcG9uZW50KTtcblxuXHRcdFx0aWYgKHN0ZXBUb0V4cGFuZC5tZWRpYS50eXBlID09PSAnc3ZnJykge1xuXHRcdFx0XHR0aGlzLndlYnZpZXcgPSB0aGlzLm1lZGlhRGlzcG9zYWJsZXMuYWRkKHRoaXMud2Vidmlld1NlcnZpY2UuY3JlYXRlV2Vidmlld0VsZW1lbnQoeyB0aXRsZTogdW5kZWZpbmVkLCBvcHRpb25zOiB7IGRpc2FibGVTZXJ2aWNlV29ya2VyOiB0cnVlIH0sIGNvbnRlbnRPcHRpb25zOiB7fSwgZXh0ZW5zaW9uOiB1bmRlZmluZWQgfSkpO1xuXHRcdFx0XHR0aGlzLndlYnZpZXcubW91bnRUbyh0aGlzLnN0ZXBNZWRpYUNvbXBvbmVudCwgdGhpcy53aW5kb3cpO1xuXHRcdFx0fSBlbHNlIGlmIChzdGVwVG9FeHBhbmQubWVkaWEudHlwZSA9PT0gJ21hcmtkb3duJykge1xuXHRcdFx0XHR0aGlzLndlYnZpZXcgPSB0aGlzLm1lZGlhRGlzcG9zYWJsZXMuYWRkKHRoaXMud2Vidmlld1NlcnZpY2UuY3JlYXRlV2Vidmlld0VsZW1lbnQoeyBvcHRpb25zOiB7fSwgY29udGVudE9wdGlvbnM6IHsgbG9jYWxSZXNvdXJjZVJvb3RzOiBbc3RlcFRvRXhwYW5kLm1lZGlhLnJvb3RdLCBhbGxvd1NjcmlwdHM6IHRydWUgfSwgdGl0bGU6ICcnLCBleHRlbnNpb246IHVuZGVmaW5lZCB9KSk7XG5cdFx0XHRcdHRoaXMud2Vidmlldy5tb3VudFRvKHRoaXMuc3RlcE1lZGlhQ29tcG9uZW50LCB0aGlzLndpbmRvdyk7XG5cdFx0XHR9IGVsc2UgaWYgKHN0ZXBUb0V4cGFuZC5tZWRpYS50eXBlID09PSAndmlkZW8nKSB7XG5cdFx0XHRcdHRoaXMud2VidmlldyA9IHRoaXMubWVkaWFEaXNwb3NhYmxlcy5hZGQodGhpcy53ZWJ2aWV3U2VydmljZS5jcmVhdGVXZWJ2aWV3RWxlbWVudCh7IG9wdGlvbnM6IHt9LCBjb250ZW50T3B0aW9uczogeyBsb2NhbFJlc291cmNlUm9vdHM6IFtzdGVwVG9FeHBhbmQubWVkaWEucm9vdF0sIGFsbG93U2NyaXB0czogdHJ1ZSB9LCB0aXRsZTogJycsIGV4dGVuc2lvbjogdW5kZWZpbmVkIH0pKTtcblx0XHRcdFx0dGhpcy53ZWJ2aWV3Lm1vdW50VG8odGhpcy5zdGVwTWVkaWFDb21wb25lbnQsIHRoaXMud2luZG93KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoc3RlcFRvRXhwYW5kLm1lZGlhLnR5cGUgPT09ICdpbWFnZScpIHtcblxuXHRcdFx0dGhpcy5zdGVwc0NvbnRlbnQuY2xhc3NMaXN0LmFkZCgnaW1hZ2UnKTtcblx0XHRcdHRoaXMuc3RlcHNDb250ZW50LmNsYXNzTGlzdC5yZW1vdmUoJ21hcmtkb3duJyk7XG5cdFx0XHR0aGlzLnN0ZXBzQ29udGVudC5jbGFzc0xpc3QucmVtb3ZlKCd2aWRlbycpO1xuXG5cdFx0XHRjb25zdCBtZWRpYSA9IHN0ZXBUb0V4cGFuZC5tZWRpYTtcblx0XHRcdGNvbnN0IG1lZGlhRWxlbWVudCA9ICQ8SFRNTEltYWdlRWxlbWVudD4oJ2ltZycpO1xuXHRcdFx0Y2xlYXJOb2RlKHRoaXMuc3RlcE1lZGlhQ29tcG9uZW50KTtcblx0XHRcdHRoaXMuc3RlcE1lZGlhQ29tcG9uZW50LmFwcGVuZENoaWxkKG1lZGlhRWxlbWVudCk7XG5cdFx0XHRtZWRpYUVsZW1lbnQuc2V0QXR0cmlidXRlKCdhbHQnLCBtZWRpYS5hbHRUZXh0KTtcblx0XHRcdHRoaXMudXBkYXRlTWVkaWFTb3VyY2VGb3JDb2xvck1vZGUobWVkaWFFbGVtZW50LCBtZWRpYS5wYXRoKTtcblxuXHRcdFx0dGhpcy5zdGVwRGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnN0ZXBNZWRpYUNvbXBvbmVudCwgJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBocmVmcyA9IHN0ZXBUb0V4cGFuZC5kZXNjcmlwdGlvbi5tYXAobHQgPT4gbHQubm9kZXMuZmlsdGVyKChub2RlKTogbm9kZSBpcyBJTGluayA9PiB0eXBlb2Ygbm9kZSAhPT0gJ3N0cmluZycpLm1hcChub2RlID0+IG5vZGUuaHJlZikpLmZsYXQoKTtcblx0XHRcdFx0aWYgKGhyZWZzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdGNvbnN0IGhyZWYgPSBocmVmc1swXTtcblx0XHRcdFx0XHRpZiAoaHJlZi5zdGFydHNXaXRoKCdodHRwJykpIHtcblx0XHRcdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPEdldHRpbmdTdGFydGVkQWN0aW9uRXZlbnQsIEdldHRpbmdTdGFydGVkQWN0aW9uQ2xhc3NpZmljYXRpb24+KCdnZXR0aW5nU3RhcnRlZC5BY3Rpb25FeGVjdXRlZCcsIHsgY29tbWFuZDogJ3J1blN0ZXBBY3Rpb24nLCBhcmd1bWVudDogaHJlZiwgd2Fsa3Rocm91Z2hJZDogdGhpcy5jdXJyZW50V2Fsa3Rocm91Z2g/LmlkIH0pO1xuXHRcdFx0XHRcdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oaHJlZik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdHRoaXMuc3RlcERpc3Bvc2FibGVzLmFkZCh0aGlzLnRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UoKCkgPT4gdGhpcy51cGRhdGVNZWRpYVNvdXJjZUZvckNvbG9yTW9kZShtZWRpYUVsZW1lbnQsIG1lZGlhLnBhdGgpKSk7XG5cblx0XHR9XG5cdFx0ZWxzZSBpZiAoc3RlcFRvRXhwYW5kLm1lZGlhLnR5cGUgPT09ICdzdmcnKSB7XG5cdFx0XHR0aGlzLnN0ZXBzQ29udGVudC5jbGFzc0xpc3QuYWRkKCdpbWFnZScpO1xuXHRcdFx0dGhpcy5zdGVwc0NvbnRlbnQuY2xhc3NMaXN0LnJlbW92ZSgnbWFya2Rvd24nKTtcblx0XHRcdHRoaXMuc3RlcHNDb250ZW50LmNsYXNzTGlzdC5yZW1vdmUoJ3ZpZGVvJyk7XG5cblx0XHRcdGNvbnN0IG1lZGlhID0gc3RlcFRvRXhwYW5kLm1lZGlhO1xuXHRcdFx0dGhpcy53ZWJ2aWV3LnNldEh0bWwoYXdhaXQgdGhpcy5kZXRhaWxzUmVuZGVyZXIucmVuZGVyU1ZHKG1lZGlhLnBhdGgpKTtcblxuXHRcdFx0bGV0IGlzRGlzcG9zZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMuc3RlcERpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4geyBpc0Rpc3Bvc2VkID0gdHJ1ZTsgfSkpO1xuXG5cdFx0XHR0aGlzLnN0ZXBEaXNwb3NhYmxlcy5hZGQodGhpcy50aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKGFzeW5jICgpID0+IHtcblx0XHRcdFx0Ly8gUmVuZGVyIGFnYWluIHNpbmNlIGNvbG9yIHZhcnMgY2hhbmdlXG5cdFx0XHRcdGNvbnN0IGJvZHkgPSBhd2FpdCB0aGlzLmRldGFpbHNSZW5kZXJlci5yZW5kZXJTVkcobWVkaWEucGF0aCk7XG5cdFx0XHRcdGlmICghaXNEaXNwb3NlZCkgeyAvLyBNYWtlIHN1cmUgd2Ugd2VyZW4ndCBkaXNwb3NlZCBvZiBpbiB0aGUgbWVhbnRpbWVcblx0XHRcdFx0XHR0aGlzLndlYnZpZXcuc2V0SHRtbChib2R5KTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLnN0ZXBEaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuc3RlcE1lZGlhQ29tcG9uZW50LCAnY2xpY2snLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGhyZWZzID0gc3RlcFRvRXhwYW5kLmRlc2NyaXB0aW9uLm1hcChsdCA9PiBsdC5ub2Rlcy5maWx0ZXIoKG5vZGUpOiBub2RlIGlzIElMaW5rID0+IHR5cGVvZiBub2RlICE9PSAnc3RyaW5nJykubWFwKG5vZGUgPT4gbm9kZS5ocmVmKSkuZmxhdCgpO1xuXHRcdFx0XHRpZiAoaHJlZnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0Y29uc3QgaHJlZiA9IGhyZWZzWzBdO1xuXHRcdFx0XHRcdGlmIChocmVmLnN0YXJ0c1dpdGgoJ2h0dHAnKSkge1xuXHRcdFx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8R2V0dGluZ1N0YXJ0ZWRBY3Rpb25FdmVudCwgR2V0dGluZ1N0YXJ0ZWRBY3Rpb25DbGFzc2lmaWNhdGlvbj4oJ2dldHRpbmdTdGFydGVkLkFjdGlvbkV4ZWN1dGVkJywgeyBjb21tYW5kOiAncnVuU3RlcEFjdGlvbicsIGFyZ3VtZW50OiBocmVmLCB3YWxrdGhyb3VnaElkOiB0aGlzLmN1cnJlbnRXYWxrdGhyb3VnaD8uaWQgfSk7XG5cdFx0XHRcdFx0XHR0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihocmVmKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy5zdGVwRGlzcG9zYWJsZXMuYWRkKHRoaXMud2Vidmlldy5vbkRpZENsaWNrTGluayhsaW5rID0+IHtcblx0XHRcdFx0aWYgKG1hdGNoZXNTY2hlbWUobGluaywgU2NoZW1hcy5odHRwcykgfHwgbWF0Y2hlc1NjaGVtZShsaW5rLCBTY2hlbWFzLmh0dHApIHx8IChtYXRjaGVzU2NoZW1lKGxpbmssIFNjaGVtYXMuY29tbWFuZCkpKSB7XG5cdFx0XHRcdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4obGluaywgeyBhbGxvd0NvbW1hbmRzOiB0cnVlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHR9XG5cdFx0ZWxzZSBpZiAoc3RlcFRvRXhwYW5kLm1lZGlhLnR5cGUgPT09ICdtYXJrZG93bicpIHtcblxuXHRcdFx0dGhpcy5zdGVwc0NvbnRlbnQuY2xhc3NMaXN0LnJlbW92ZSgnaW1hZ2UnKTtcblx0XHRcdHRoaXMuc3RlcHNDb250ZW50LmNsYXNzTGlzdC5hZGQoJ21hcmtkb3duJyk7XG5cdFx0XHR0aGlzLnN0ZXBzQ29udGVudC5jbGFzc0xpc3QucmVtb3ZlKCd2aWRlbycpO1xuXG5cdFx0XHRjb25zdCBtZWRpYSA9IHN0ZXBUb0V4cGFuZC5tZWRpYTtcblxuXHRcdFx0Y29uc3QgcmF3SFRNTCA9IGF3YWl0IHRoaXMuZGV0YWlsc1JlbmRlcmVyLnJlbmRlck1hcmtkb3duKG1lZGlhLnBhdGgsIG1lZGlhLmJhc2UpO1xuXHRcdFx0dGhpcy53ZWJ2aWV3LnNldEh0bWwocmF3SFRNTCk7XG5cblx0XHRcdGNvbnN0IHNlcmlhbGl6ZWRDb250ZXh0S2V5RXhwcnMgPSByYXdIVE1MLm1hdGNoKC9jaGVja2VkLW9uPVxcXCIoW14nXVteXCJdKilcXFwiL2cpPy5tYXAoYXR0ciA9PiBhdHRyLnNsaWNlKCdjaGVja2VkLW9uPVwiJy5sZW5ndGgsIC0xKVxuXHRcdFx0XHQucmVwbGFjZSgvJiMzOTsvZywgJ1xcJycpXG5cdFx0XHRcdC5yZXBsYWNlKC8mYW1wOy9nLCAnJicpKTtcblxuXHRcdFx0Y29uc3QgcG9zdFRydWVLZXlzTWVzc2FnZSA9ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgZW5hYmxlZENvbnRleHRLZXlzID0gc2VyaWFsaXplZENvbnRleHRLZXlFeHBycz8uZmlsdGVyKGV4cHIgPT4gdGhpcy5jb250ZXh0U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKGV4cHIpKSk7XG5cdFx0XHRcdGlmIChlbmFibGVkQ29udGV4dEtleXMpIHtcblx0XHRcdFx0XHR0aGlzLndlYnZpZXcucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0XHRcdFx0ZW5hYmxlZENvbnRleHRLZXlzXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdGlmIChzZXJpYWxpemVkQ29udGV4dEtleUV4cHJzKSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRleHRLZXlFeHBycyA9IGNvYWxlc2NlKHNlcmlhbGl6ZWRDb250ZXh0S2V5RXhwcnMubWFwKGV4cHIgPT4gQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUoZXhwcikpKTtcblx0XHRcdFx0Y29uc3Qgd2F0Y2hpbmdLZXlzID0gbmV3IFNldChjb250ZXh0S2V5RXhwcnMuZmxhdE1hcChleHByID0+IGV4cHIua2V5cygpKSk7XG5cblx0XHRcdFx0dGhpcy5zdGVwRGlzcG9zYWJsZXMuYWRkKHRoaXMuY29udGV4dFNlcnZpY2Uub25EaWRDaGFuZ2VDb250ZXh0KGUgPT4ge1xuXHRcdFx0XHRcdGlmIChlLmFmZmVjdHNTb21lKHdhdGNoaW5nS2V5cykpIHsgcG9zdFRydWVLZXlzTWVzc2FnZSgpOyB9XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGlzRGlzcG9zZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMuc3RlcERpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4geyBpc0Rpc3Bvc2VkID0gdHJ1ZTsgfSkpO1xuXG5cdFx0XHR0aGlzLnN0ZXBEaXNwb3NhYmxlcy5hZGQodGhpcy53ZWJ2aWV3Lm9uRGlkQ2xpY2tMaW5rKGxpbmsgPT4ge1xuXHRcdFx0XHRpZiAobWF0Y2hlc1NjaGVtZShsaW5rLCBTY2hlbWFzLmh0dHBzKSB8fCBtYXRjaGVzU2NoZW1lKGxpbmssIFNjaGVtYXMuaHR0cCkgfHwgKG1hdGNoZXNTY2hlbWUobGluaywgU2NoZW1hcy5jb21tYW5kKSkpIHtcblx0XHRcdFx0XHRjb25zdCB0b1NpZGUgPSBsaW5rLnN0YXJ0c1dpdGgoJ2NvbW1hbmQ6dG9TaWRlOicpO1xuXHRcdFx0XHRcdGlmICh0b1NpZGUpIHtcblx0XHRcdFx0XHRcdGxpbmsgPSBsaW5rLnJlcGxhY2UoJ2NvbW1hbmQ6dG9TaWRlOicsICdjb21tYW5kOicpO1xuXHRcdFx0XHRcdFx0dGhpcy5mb2N1c1NpZGVFZGl0b3JHcm91cCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihsaW5rLCB7IGFsbG93Q29tbWFuZHM6IHRydWUsIG9wZW5Ub1NpZGU6IHRvU2lkZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRpZiAocmF3SFRNTC5pbmRleE9mKCc8Y29kZT4nKSA+PSAwKSB7XG5cdFx0XHRcdC8vIFJlbmRlciBhZ2FpbiB3aGVuIFRoZW1lIGNoYW5nZXMgc2luY2Ugc3ludGF4IGhpZ2hsaWdodGluZyBvZiBjb2RlIGJsb2NrcyBtYXkgaGF2ZSBjaGFuZ2VkXG5cdFx0XHRcdHRoaXMuc3RlcERpc3Bvc2FibGVzLmFkZCh0aGlzLnRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGJvZHkgPSBhd2FpdCB0aGlzLmRldGFpbHNSZW5kZXJlci5yZW5kZXJNYXJrZG93bihtZWRpYS5wYXRoLCBtZWRpYS5iYXNlKTtcblx0XHRcdFx0XHRpZiAoIWlzRGlzcG9zZWQpIHsgLy8gTWFrZSBzdXJlIHdlIHdlcmVuJ3QgZGlzcG9zZWQgb2YgaW4gdGhlIG1lYW50aW1lXG5cdFx0XHRcdFx0XHR0aGlzLndlYnZpZXcuc2V0SHRtbChib2R5KTtcblx0XHRcdFx0XHRcdHBvc3RUcnVlS2V5c01lc3NhZ2UoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbGF5b3V0RGVsYXllciA9IG5ldyBEZWxheWVyKDUwKTtcblxuXHRcdFx0dGhpcy5sYXlvdXRNYXJrZG93biA9ICgpID0+IHtcblx0XHRcdFx0bGF5b3V0RGVsYXllci50cmlnZ2VyKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLndlYnZpZXcucG9zdE1lc3NhZ2UoeyBsYXlvdXRNZU5vdzogdHJ1ZSB9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLnN0ZXBEaXNwb3NhYmxlcy5hZGQobGF5b3V0RGVsYXllcik7XG5cdFx0XHR0aGlzLnN0ZXBEaXNwb3NhYmxlcy5hZGQoeyBkaXNwb3NlOiAoKSA9PiB0aGlzLmxheW91dE1hcmtkb3duID0gdW5kZWZpbmVkIH0pO1xuXG5cdFx0XHRwb3N0VHJ1ZUtleXNNZXNzYWdlKCk7XG5cblx0XHRcdHRoaXMuc3RlcERpc3Bvc2FibGVzLmFkZCh0aGlzLndlYnZpZXcub25NZXNzYWdlKGFzeW5jIGUgPT4ge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlOiBzdHJpbmcgPSBlLm1lc3NhZ2UgYXMgc3RyaW5nO1xuXHRcdFx0XHRpZiAobWVzc2FnZS5zdGFydHNXaXRoKCdjb21tYW5kOicpKSB7XG5cdFx0XHRcdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4obWVzc2FnZSwgeyBhbGxvd0NvbW1hbmRzOiB0cnVlIH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG1lc3NhZ2Uuc3RhcnRzV2l0aCgnc2V0VGhlbWU6JykpIHtcblx0XHRcdFx0XHRjb25zdCB0aGVtZUlkID0gbWVzc2FnZS5zbGljZSgnc2V0VGhlbWU6Jy5sZW5ndGgpO1xuXHRcdFx0XHRcdGNvbnN0IHRoZW1lID0gKGF3YWl0IHRoaXMudGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWVzKCkpLmZpbmQodGhlbWUgPT4gdGhlbWUuc2V0dGluZ3NJZCA9PT0gdGhlbWVJZCk7XG5cdFx0XHRcdFx0aWYgKHRoZW1lKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnRoZW1lU2VydmljZS5zZXRDb2xvclRoZW1lKHRoZW1lLmlkLCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCdVbmV4cGVjdGVkIG1lc3NhZ2UnLCBtZXNzYWdlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblx0XHRlbHNlIGlmIChzdGVwVG9FeHBhbmQubWVkaWEudHlwZSA9PT0gJ3ZpZGVvJykge1xuXHRcdFx0dGhpcy5zdGVwc0NvbnRlbnQuY2xhc3NMaXN0LmFkZCgndmlkZW8nKTtcblx0XHRcdHRoaXMuc3RlcHNDb250ZW50LmNsYXNzTGlzdC5yZW1vdmUoJ21hcmtkb3duJyk7XG5cdFx0XHR0aGlzLnN0ZXBzQ29udGVudC5jbGFzc0xpc3QucmVtb3ZlKCdpbWFnZScpO1xuXG5cdFx0XHRjb25zdCBtZWRpYSA9IHN0ZXBUb0V4cGFuZC5tZWRpYTtcblxuXHRcdFx0Y29uc3QgdGhlbWVUeXBlID0gdGhpcy50aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLnR5cGU7XG5cdFx0XHRjb25zdCB2aWRlb1BhdGggPSBtZWRpYS5wYXRoW3RoZW1lVHlwZV07XG5cdFx0XHRjb25zdCB2aWRlb1Bvc3RlciA9IG1lZGlhLnBvc3RlciA/IG1lZGlhLnBvc3Rlclt0aGVtZVR5cGVdIDogdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgYWx0VGV4dCA9IG1lZGlhLmFsdFRleHQgPyBtZWRpYS5hbHRUZXh0IDogbG9jYWxpemUoJ3ZpZGVvQWx0VGV4dCcsIFwiVmlkZW8gZm9yIHswfVwiLCBzdGVwVG9FeHBhbmQudGl0bGUpO1xuXHRcdFx0Y29uc3QgcmF3SFRNTCA9IGF3YWl0IHRoaXMuZGV0YWlsc1JlbmRlcmVyLnJlbmRlclZpZGVvKHZpZGVvUGF0aCwgdmlkZW9Qb3N0ZXIsIGFsdFRleHQpO1xuXHRcdFx0dGhpcy53ZWJ2aWV3LnNldEh0bWwocmF3SFRNTCk7XG5cblx0XHRcdGxldCBpc0Rpc3Bvc2VkID0gZmFsc2U7XG5cdFx0XHR0aGlzLnN0ZXBEaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHsgaXNEaXNwb3NlZCA9IHRydWU7IH0pKTtcblxuXHRcdFx0dGhpcy5zdGVwRGlzcG9zYWJsZXMuYWRkKHRoaXMudGhlbWVTZXJ2aWNlLm9uRGlkQ29sb3JUaGVtZUNoYW5nZShhc3luYyAoKSA9PiB7XG5cdFx0XHRcdC8vIFJlbmRlciBhZ2FpbiBzaW5jZSBjb2xvciB2YXJzIGNoYW5nZVxuXHRcdFx0XHRjb25zdCB0aGVtZVR5cGUgPSB0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkudHlwZTtcblx0XHRcdFx0Y29uc3QgdmlkZW9QYXRoID0gbWVkaWEucGF0aFt0aGVtZVR5cGVdO1xuXHRcdFx0XHRjb25zdCB2aWRlb1Bvc3RlciA9IG1lZGlhLnBvc3RlciA/IG1lZGlhLnBvc3Rlclt0aGVtZVR5cGVdIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBib2R5ID0gYXdhaXQgdGhpcy5kZXRhaWxzUmVuZGVyZXIucmVuZGVyVmlkZW8odmlkZW9QYXRoLCB2aWRlb1Bvc3RlciwgYWx0VGV4dCk7XG5cblx0XHRcdFx0aWYgKCFpc0Rpc3Bvc2VkKSB7IC8vIE1ha2Ugc3VyZSB3ZSB3ZXJlbid0IGRpc3Bvc2VkIG9mIGluIHRoZSBtZWFudGltZVxuXHRcdFx0XHRcdHRoaXMud2Vidmlldy5zZXRIdG1sKGJvZHkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgc2VsZWN0U3RlcExvb3NlKGlkOiBzdHJpbmcpIHtcblx0XHQvLyBBbGxvdyBwYXNzaW5nIGluIGlkIHdpdGggYSBjYXRlZ29yeSBhcHBlbmRlZCBvciB3aXRoIGp1c3QgdGhlIGlkIG9mIHRoZSBzdGVwXG5cdFx0aWYgKGlkLnN0YXJ0c1dpdGgoYCR7dGhpcy5lZGl0b3JJbnB1dC5zZWxlY3RlZENhdGVnb3J5fSNgKSkge1xuXHRcdFx0dGhpcy5zZWxlY3RTdGVwKGlkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgdG9TZWxlY3QgPSB0aGlzLmVkaXRvcklucHV0LnNlbGVjdGVkQ2F0ZWdvcnkgKyAnIycgKyBpZDtcblx0XHRcdHRoaXMuc2VsZWN0U3RlcCh0b1NlbGVjdCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBwcm92aWRlU2NyZWVuUmVhZGVyVXBkYXRlKCk6IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5XYWxrdGhyb3VnaCkpIHtcblx0XHRcdGNvbnN0IGtiTGFiZWwgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoQWNjZXNzaWJsZVZpZXdBY3Rpb24uaWQpPy5nZXRBcmlhTGFiZWwoKTtcblx0XHRcdHJldHVybiBrYkxhYmVsID8gbG9jYWxpemUoJ2FjZXNzaWJsZVZpZXdIaW50JywgXCJJbnNwZWN0IHRoaXMgaW4gdGhlIGFjY2Vzc2libGUgdmlldyAoezB9KS5cXG5cIiwga2JMYWJlbCkgOiBsb2NhbGl6ZSgnYWNlc3NpYmxlVmlld0hpbnROb0tiT3BlbicsIFwiSW5zcGVjdCB0aGlzIGluIHRoZSBhY2Nlc3NpYmxlIHZpZXcgdmlhIHRoZSBjb21tYW5kIE9wZW4gQWNjZXNzaWJsZSBWaWV3IHdoaWNoIGlzIGN1cnJlbnRseSBub3QgdHJpZ2dlcmFibGUgdmlhIGtleWJpbmRpbmcuXFxuXCIpO1xuXHRcdH1cblx0XHRyZXR1cm4gJyc7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNlbGVjdFN0ZXAoaWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgZGVsYXlGb2N1cyA9IHRydWUpIHtcblx0XHRpZiAoaWQpIHtcblx0XHRcdGxldCBzdGVwRWxlbWVudCA9IHRoaXMuY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3I8SFRNTERpdkVsZW1lbnQ+KGBbZGF0YS1zdGVwLWlkPVwiJHtpZH1cIl1gKTtcblx0XHRcdGlmICghc3RlcEVsZW1lbnQpIHtcblx0XHRcdFx0Ly8gU2VsZWN0ZWQgYW4gZWxlbWVudCB0aGF0IGlzIG5vdCBpbi1jb250ZXh0LCBqdXN0IGZhbGxiYWNrIHRvIHdoYXRldmVyLlxuXHRcdFx0XHRzdGVwRWxlbWVudCA9IHRoaXMuY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3I8SFRNTERpdkVsZW1lbnQ+KGBbZGF0YS1zdGVwLWlkXWApO1xuXHRcdFx0XHRpZiAoIXN0ZXBFbGVtZW50KSB7XG5cdFx0XHRcdFx0Ly8gTm8gc3RlcHMgYXJvdW5kLi4uIGp1c3QgaWdub3JlLlxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZCA9IGFzc2VydElzRGVmaW5lZChzdGVwRWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3RlcC1pZCcpKTtcblx0XHRcdH1cblx0XHRcdHN0ZXBFbGVtZW50LnBhcmVudEVsZW1lbnQ/LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KCcuZXhwYW5kZWQnKS5mb3JFYWNoKG5vZGUgPT4ge1xuXHRcdFx0XHRpZiAobm9kZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3RlcC1pZCcpICE9PSBpZCkge1xuXHRcdFx0XHRcdG5vZGUuY2xhc3NMaXN0LnJlbW92ZSgnZXhwYW5kZWQnKTtcblx0XHRcdFx0XHRub2RlLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xuXHRcdFx0XHRcdGNvbnN0IGNvZGljb25FbGVtZW50ID0gbm9kZS5xdWVyeVNlbGVjdG9yKCcuY29kaWNvbicpO1xuXHRcdFx0XHRcdGlmIChjb2RpY29uRWxlbWVudCkge1xuXHRcdFx0XHRcdFx0Y29kaWNvbkVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCd0YWJpbmRleCcpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IChzdGVwRWxlbWVudCBhcyBIVE1MRWxlbWVudCkuZm9jdXMoKSwgZGVsYXlGb2N1cyAmJiB0aGlzLnNob3VsZEFuaW1hdGUoKSA/IFNMSURFX1RSQU5TSVRJT05fVElNRV9NUyA6IDApO1xuXG5cdFx0XHR0aGlzLmVkaXRvcklucHV0LnNlbGVjdGVkU3RlcCA9IGlkO1xuXG5cdFx0XHRzdGVwRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdleHBhbmRlZCcpO1xuXHRcdFx0c3RlcEVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ3RydWUnKTtcblx0XHRcdHRoaXMuYnVpbGRNZWRpYUNvbXBvbmVudChpZCwgdHJ1ZSk7XG5cdFx0XHRjb25zdCBjb2RpY29uRWxlbWVudCA9IHN0ZXBFbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb2RpY29uJyk7XG5cdFx0XHRpZiAoY29kaWNvbkVsZW1lbnQpIHtcblx0XHRcdFx0Y29kaWNvbkVsZW1lbnQuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmdldHRpbmdTdGFydGVkU2VydmljZS5wcm9ncmVzc0J5RXZlbnQoJ3N0ZXBTZWxlY3RlZDonICsgaWQpO1xuXHRcdFx0Y29uc3Qgc3RlcCA9IHRoaXMuY3VycmVudFdhbGt0aHJvdWdoPy5zdGVwcz8uZmluZChzdGVwID0+IHN0ZXAuaWQgPT09IGlkKTtcblx0XHRcdGlmIChzdGVwKSB7XG5cdFx0XHRcdHN0ZXBFbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGAke3RoaXMucHJvdmlkZVNjcmVlblJlYWRlclVwZGF0ZSgpfSAke3N0ZXAudGl0bGV9YCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZWRpdG9ySW5wdXQuc2VsZWN0ZWRTdGVwID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHRoaXMuZGV0YWlsc1BhZ2VTY3JvbGxiYXI/LnNjYW5Eb21Ob2RlKCk7XG5cdFx0dGhpcy5kZXRhaWxzU2Nyb2xsYmFyPy5zY2FuRG9tTm9kZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVNZWRpYVNvdXJjZUZvckNvbG9yTW9kZShlbGVtZW50OiBIVE1MSW1hZ2VFbGVtZW50LCBzb3VyY2VzOiB7IGhjRGFyazogVVJJOyBoY0xpZ2h0OiBVUkk7IGRhcms6IFVSSTsgbGlnaHQ6IFVSSSB9KSB7XG5cdFx0Y29uc3QgdGhlbWVUeXBlID0gdGhpcy50aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLnR5cGU7XG5cdFx0Y29uc3Qgc3JjID0gc291cmNlc1t0aGVtZVR5cGVdLnRvU3RyaW5nKHRydWUpLnJlcGxhY2UoLyAvZywgJyUyMCcpO1xuXHRcdGVsZW1lbnQuc3Jjc2V0ID0gc3JjLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoJy5zdmcnKSA/IHNyYyA6IChzcmMgKyAnIDEuNXgnKTtcblx0fVxuXG5cdHByb3RlY3RlZCBjcmVhdGVFZGl0b3IocGFyZW50OiBIVE1MRWxlbWVudCkge1xuXHRcdGlmICh0aGlzLmRldGFpbHNQYWdlU2Nyb2xsYmFyKSB7IHRoaXMuZGV0YWlsc1BhZ2VTY3JvbGxiYXIuZGlzcG9zZSgpOyB9XG5cdFx0aWYgKHRoaXMuY2F0ZWdvcmllc1BhZ2VTY3JvbGxiYXIpIHsgdGhpcy5jYXRlZ29yaWVzUGFnZVNjcm9sbGJhci5kaXNwb3NlKCk7IH1cblxuXHRcdHRoaXMuY2F0ZWdvcmllc1NsaWRlID0gJCgnLmdldHRpbmdTdGFydGVkU2xpZGVDYXRlZ29yaWVzLmdldHRpbmdTdGFydGVkU2xpZGUnKTtcblxuXHRcdGNvbnN0IHByZXZCdXR0b24gPSAkKCdidXR0b24ucHJldi1idXR0b24uYnV0dG9uLWxpbmsnLCB7ICd4LWRpc3BhdGNoJzogJ3Njcm9sbFByZXYnIH0sICQoJ3NwYW4uc2Nyb2xsLWJ1dHRvbi5jb2RpY29uLmNvZGljb24tY2hldnJvbi1sZWZ0JyksICQoJ3NwYW4ubW9yZVRleHQnLCB7fSwgbG9jYWxpemUoJ2dvQmFjaycsIFwiR28gQmFja1wiKSkpO1xuXHRcdHRoaXMuc3RlcHNTbGlkZSA9ICQoJy5nZXR0aW5nU3RhcnRlZFNsaWRlRGV0YWlscy5nZXR0aW5nU3RhcnRlZFNsaWRlJywge30sIHByZXZCdXR0b24pO1xuXG5cdFx0dGhpcy5zdGVwc0NvbnRlbnQgPSAkKCcuZ2V0dGluZ1N0YXJ0ZWREZXRhaWxzQ29udGVudCcsIHt9KTtcblxuXHRcdHRoaXMuZGV0YWlsc1BhZ2VTY3JvbGxiYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tU2Nyb2xsYWJsZUVsZW1lbnQodGhpcy5zdGVwc0NvbnRlbnQsIHsgY2xhc3NOYW1lOiAnZnVsbC1oZWlnaHQtc2Nyb2xsYWJsZScsIHZlcnRpY2FsOiBTY3JvbGxiYXJWaXNpYmlsaXR5LkhpZGRlbiB9KSk7XG5cdFx0dGhpcy5jYXRlZ29yaWVzUGFnZVNjcm9sbGJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEb21TY3JvbGxhYmxlRWxlbWVudCh0aGlzLmNhdGVnb3JpZXNTbGlkZSwgeyBjbGFzc05hbWU6ICdmdWxsLWhlaWdodC1zY3JvbGxhYmxlIGNhdGVnb3JpZXNTY3JvbGxiYXInLCB2ZXJ0aWNhbDogU2Nyb2xsYmFyVmlzaWJpbGl0eS5IaWRkZW4gfSkpO1xuXG5cdFx0dGhpcy5zdGVwc1NsaWRlLmFwcGVuZENoaWxkKHRoaXMuZGV0YWlsc1BhZ2VTY3JvbGxiYXIuZ2V0RG9tTm9kZSgpKTtcblxuXHRcdGNvbnN0IGdldHRpbmdTdGFydGVkUGFnZSA9ICQoJy5nZXR0aW5nU3RhcnRlZCcsIHt9LCB0aGlzLmNhdGVnb3JpZXNQYWdlU2Nyb2xsYmFyLmdldERvbU5vZGUoKSwgdGhpcy5zdGVwc1NsaWRlKTtcblx0XHR0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZChnZXR0aW5nU3RhcnRlZFBhZ2UpO1xuXG5cdFx0dGhpcy5jYXRlZ29yaWVzUGFnZVNjcm9sbGJhci5zY2FuRG9tTm9kZSgpO1xuXHRcdHRoaXMuZGV0YWlsc1BhZ2VTY3JvbGxiYXIuc2NhbkRvbU5vZGUoKTtcblxuXHRcdHBhcmVudC5hcHBlbmRDaGlsZCh0aGlzLmNvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGJ1aWxkQ2F0ZWdvcmllc1NsaWRlKCkge1xuXG5cdFx0dGhpcy5jYXRlZ29yaWVzU2xpZGVEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdGNvbnN0IHNob3dPblN0YXJ0dXBDaGVja2JveCA9IG5ldyBUb2dnbGUoe1xuXHRcdFx0aWNvbjogQ29kaWNvbi5jaGVjayxcblx0XHRcdGFjdGlvbkNsYXNzTmFtZTogJ2dldHRpbmctc3RhcnRlZC1jaGVja2JveCcsXG5cdFx0XHRpc0NoZWNrZWQ6IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoY29uZmlndXJhdGlvbktleSkgPT09ICd3ZWxjb21lUGFnZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2NoZWNrYm94VGl0bGUnLCBcIldoZW4gY2hlY2tlZCwgdGhpcyBwYWdlIHdpbGwgYmUgc2hvd24gb24gc3RhcnR1cC5cIiksXG5cdFx0XHQuLi5kZWZhdWx0VG9nZ2xlU3R5bGVzXG5cdFx0fSk7XG5cdFx0c2hvd09uU3RhcnR1cENoZWNrYm94LmRvbU5vZGUuaWQgPSAnc2hvd09uU3RhcnR1cCc7XG5cdFx0Y29uc3Qgc2hvd09uU3RhcnR1cExhYmVsID0gJCgnbGFiZWwuY2FwdGlvbicsIHsgZm9yOiAnc2hvd09uU3RhcnR1cCcgfSwgbG9jYWxpemUoJ3dlbGNvbWVQYWdlLnNob3dPblN0YXJ0dXAnLCBcIlNob3cgd2VsY29tZSBwYWdlIG9uIHN0YXJ0dXBcIikpO1xuXHRcdGNvbnN0IG9uU2hvd09uU3RhcnR1cENoYW5nZWQgPSAoKSA9PiB7XG5cdFx0XHRpZiAoc2hvd09uU3RhcnR1cENoZWNrYm94LmNoZWNrZWQpIHtcblx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8R2V0dGluZ1N0YXJ0ZWRBY3Rpb25FdmVudCwgR2V0dGluZ1N0YXJ0ZWRBY3Rpb25DbGFzc2lmaWNhdGlvbj4oJ2dldHRpbmdTdGFydGVkLkFjdGlvbkV4ZWN1dGVkJywgeyBjb21tYW5kOiAnc2hvd09uU3RhcnR1cENoZWNrZWQnLCBhcmd1bWVudDogdW5kZWZpbmVkLCB3YWxrdGhyb3VnaElkOiB0aGlzLmN1cnJlbnRXYWxrdGhyb3VnaD8uaWQgfSk7XG5cdFx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoY29uZmlndXJhdGlvbktleSwgJ3dlbGNvbWVQYWdlJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxHZXR0aW5nU3RhcnRlZEFjdGlvbkV2ZW50LCBHZXR0aW5nU3RhcnRlZEFjdGlvbkNsYXNzaWZpY2F0aW9uPignZ2V0dGluZ1N0YXJ0ZWQuQWN0aW9uRXhlY3V0ZWQnLCB7IGNvbW1hbmQ6ICdzaG93T25TdGFydHVwVW5jaGVja2VkJywgYXJndW1lbnQ6IHVuZGVmaW5lZCwgd2Fsa3Rocm91Z2hJZDogdGhpcy5jdXJyZW50V2Fsa3Rocm91Z2g/LmlkIH0pO1xuXHRcdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGNvbmZpZ3VyYXRpb25LZXksICdub25lJyk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHR0aGlzLmNhdGVnb3JpZXNTbGlkZURpc3Bvc2FibGVzLmFkZChzaG93T25TdGFydHVwQ2hlY2tib3gpO1xuXHRcdHRoaXMuY2F0ZWdvcmllc1NsaWRlRGlzcG9zYWJsZXMuYWRkKHNob3dPblN0YXJ0dXBDaGVja2JveC5vbkNoYW5nZSgoKSA9PiB7XG5cdFx0XHRvblNob3dPblN0YXJ0dXBDaGFuZ2VkKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuY2F0ZWdvcmllc1NsaWRlRGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihzaG93T25TdGFydHVwTGFiZWwsICdjbGljaycsICgpID0+IHtcblx0XHRcdHNob3dPblN0YXJ0dXBDaGVja2JveC5jaGVja2VkID0gIXNob3dPblN0YXJ0dXBDaGVja2JveC5jaGVja2VkO1xuXHRcdFx0b25TaG93T25TdGFydHVwQ2hhbmdlZCgpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGhlYWRlciA9ICQoJy5oZWFkZXInLCB7fSxcblx0XHRcdCQoJ2gxLnByb2R1Y3QtbmFtZS5jYXB0aW9uJywge30sIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZUxvbmcpLFxuXHRcdFx0JCgncC5zdWJ0aXRsZS5kZXNjcmlwdGlvbicsIHt9LCBsb2NhbGl6ZSh7IGtleTogJ2dldHRpbmdTdGFydGVkLmVkaXRpbmdFdm9sdmVkJywgY29tbWVudDogWydTaG93biBhcyBzdWJ0aXRsZSBvbiB0aGUgV2VsY29tZSBwYWdlLiddIH0sIFwiRWRpdGluZyBldm9sdmVkXCIpKVxuXHRcdCk7XG5cblx0XHRjb25zdCBsZWZ0Q29sdW1uID0gJCgnLmNhdGVnb3JpZXMtY29sdW1uLmNhdGVnb3JpZXMtY29sdW1uLWxlZnQnLCB7fSwpO1xuXHRcdGNvbnN0IHJpZ2h0Q29sdW1uID0gJCgnLmNhdGVnb3JpZXMtY29sdW1uLmNhdGVnb3JpZXMtY29sdW1uLXJpZ2h0Jywge30sKTtcblxuXHRcdGNvbnN0IHN0YXJ0TGlzdCA9IHRoaXMuYnVpbGRTdGFydExpc3QoKTtcblx0XHRjb25zdCByZWNlbnRMaXN0ID0gdGhpcy5idWlsZFJlY2VudGx5T3BlbmVkTGlzdCgpO1xuXHRcdGNvbnN0IGdldHRpbmdTdGFydGVkTGlzdCA9IHRoaXMuYnVpbGRHZXR0aW5nU3RhcnRlZFdhbGt0aHJvdWdoc0xpc3QoKTtcblxuXHRcdGNvbnN0IGZvb3RlciA9ICQoJy5mb290ZXInLCB7fSxcblx0XHRcdCQoJ3Auc2hvd09uU3RhcnR1cCcsIHt9LFxuXHRcdFx0XHRzaG93T25TdGFydHVwQ2hlY2tib3guZG9tTm9kZSxcblx0XHRcdFx0c2hvd09uU3RhcnR1cExhYmVsLFxuXHRcdFx0KSk7XG5cblx0XHRjb25zdCBsYXlvdXRMaXN0cyA9ICgpID0+IHtcblx0XHRcdGlmIChnZXR0aW5nU3RhcnRlZExpc3QuaXRlbUNvdW50KSB7XG5cdFx0XHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ25vV2Fsa3Rocm91Z2hzJyk7XG5cdFx0XHRcdHJlc2V0KHJpZ2h0Q29sdW1uLCBnZXR0aW5nU3RhcnRlZExpc3QuZ2V0RG9tRWxlbWVudCgpKTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdub1dhbGt0aHJvdWdocycpO1xuXHRcdFx0XHRyZXNldChyaWdodENvbHVtbik7XG5cdFx0XHR9XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHRoaXMuY2F0ZWdvcmllc1BhZ2VTY3JvbGxiYXI/LnNjYW5Eb21Ob2RlKCksIDUwKTtcblx0XHRcdGxheW91dFJlY2VudExpc3QoKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgbGF5b3V0UmVjZW50TGlzdCA9ICgpID0+IHtcblx0XHRcdGlmICh0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoJ25vV2Fsa3Rocm91Z2hzJykpIHtcblx0XHRcdFx0cmVjZW50TGlzdC5zZXRMaW1pdCgxMCk7XG5cdFx0XHRcdHJlc2V0KGxlZnRDb2x1bW4sIHN0YXJ0TGlzdC5nZXREb21FbGVtZW50KCkpO1xuXHRcdFx0XHRyZXNldChyaWdodENvbHVtbiwgcmVjZW50TGlzdC5nZXREb21FbGVtZW50KCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVjZW50TGlzdC5zZXRMaW1pdCg1KTtcblx0XHRcdFx0cmVzZXQobGVmdENvbHVtbiwgc3RhcnRMaXN0LmdldERvbUVsZW1lbnQoKSwgcmVjZW50TGlzdC5nZXREb21FbGVtZW50KCkpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRnZXR0aW5nU3RhcnRlZExpc3Qub25EaWRDaGFuZ2UobGF5b3V0TGlzdHMpO1xuXHRcdGxheW91dExpc3RzKCk7XG5cblx0XHRyZXNldCh0aGlzLmNhdGVnb3JpZXNTbGlkZSwgJCgnLmdldHRpbmdTdGFydGVkQ2F0ZWdvcmllc0NvbnRhaW5lcicsIHt9LCBoZWFkZXIsIGxlZnRDb2x1bW4sIHJpZ2h0Q29sdW1uLCBmb290ZXIsKSk7XG5cdFx0dGhpcy5jYXRlZ29yaWVzUGFnZVNjcm9sbGJhcj8uc2NhbkRvbU5vZGUoKTtcblxuXHRcdHRoaXMudXBkYXRlQ2F0ZWdvcnlQcm9ncmVzcygpO1xuXHRcdHRoaXMucmVnaXN0ZXJEaXNwYXRjaExpc3RlbmVycygpO1xuXG5cdFx0aWYgKHRoaXMuZWRpdG9ySW5wdXQuc2VsZWN0ZWRDYXRlZ29yeSkge1xuXHRcdFx0dGhpcy5jdXJyZW50V2Fsa3Rocm91Z2ggPSB0aGlzLmdldHRpbmdTdGFydGVkQ2F0ZWdvcmllcy5maW5kKGNhdGVnb3J5ID0+IGNhdGVnb3J5LmlkID09PSB0aGlzLmVkaXRvcklucHV0LnNlbGVjdGVkQ2F0ZWdvcnkpO1xuXG5cdFx0XHRpZiAoIXRoaXMuY3VycmVudFdhbGt0aHJvdWdoKSB7XG5cdFx0XHRcdHRoaXMuZ2V0dGluZ1N0YXJ0ZWRDYXRlZ29yaWVzID0gdGhpcy5nZXR0aW5nU3RhcnRlZFNlcnZpY2UuZ2V0V2Fsa3Rocm91Z2hzKCk7XG5cdFx0XHRcdHRoaXMuY3VycmVudFdhbGt0aHJvdWdoID0gdGhpcy5nZXR0aW5nU3RhcnRlZENhdGVnb3JpZXMuZmluZChjYXRlZ29yeSA9PiBjYXRlZ29yeS5pZCA9PT0gdGhpcy5lZGl0b3JJbnB1dC5zZWxlY3RlZENhdGVnb3J5KTtcblx0XHRcdFx0aWYgKHRoaXMuY3VycmVudFdhbGt0aHJvdWdoKSB7XG5cdFx0XHRcdFx0dGhpcy5idWlsZENhdGVnb3J5U2xpZGUodGhpcy5lZGl0b3JJbnB1dC5zZWxlY3RlZENhdGVnb3J5LCB0aGlzLmVkaXRvcklucHV0LnNlbGVjdGVkU3RlcCk7XG5cdFx0XHRcdFx0dGhpcy5zZXRTbGlkZSgnZGV0YWlscycpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHRoaXMuYnVpbGRDYXRlZ29yeVNsaWRlKHRoaXMuZWRpdG9ySW5wdXQuc2VsZWN0ZWRDYXRlZ29yeSwgdGhpcy5lZGl0b3JJbnB1dC5zZWxlY3RlZFN0ZXApO1xuXHRcdFx0XHR0aGlzLnNldFNsaWRlKCdkZXRhaWxzJyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBzb21lU3RlcHNDb21wbGV0ZSA9IHRoaXMuZ2V0dGluZ1N0YXJ0ZWRDYXRlZ29yaWVzLnNvbWUoY2F0ZWdvcnkgPT4gY2F0ZWdvcnkuc3RlcHMuZmluZChzID0+IHMuZG9uZSkpO1xuXHRcdGlmICh0aGlzLmVkaXRvcklucHV0LnNob3dUZWxlbWV0cnlOb3RpY2UgJiYgdGhpcy5wcm9kdWN0U2VydmljZS5vcGVuVG9XZWxjb21lTWFpblBhZ2UpIHtcblx0XHRcdGNvbnN0IHRlbGVtZXRyeU5vdGljZSA9ICQoJ3AudGVsZW1ldHJ5LW5vdGljZScpO1xuXHRcdFx0dGhpcy5idWlsZFRlbGVtZXRyeUZvb3Rlcih0ZWxlbWV0cnlOb3RpY2UpO1xuXHRcdFx0Zm9vdGVyLmFwcGVuZENoaWxkKHRlbGVtZXRyeU5vdGljZSk7XG5cdFx0fSBlbHNlIGlmICghdGhpcy5wcm9kdWN0U2VydmljZS5vcGVuVG9XZWxjb21lTWFpblBhZ2UgJiYgIXNvbWVTdGVwc0NvbXBsZXRlICYmICF0aGlzLmhhc1Njcm9sbGVkVG9GaXJzdENhdGVnb3J5ICYmIHRoaXMuc2hvd0ZlYXR1cmVkV2Fsa3Rocm91Z2gpIHtcblx0XHRcdGNvbnN0IGZpcnN0U2Vzc2lvbkRhdGVTdHJpbmcgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChmaXJzdFNlc3Npb25EYXRlU3RvcmFnZUtleSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKSB8fCBuZXcgRGF0ZSgpLnRvVVRDU3RyaW5nKCk7XG5cdFx0XHRjb25zdCBkYXlzU2luY2VGaXJzdFNlc3Npb24gPSAoKCtuZXcgRGF0ZSgpKSAtICgrbmV3IERhdGUoZmlyc3RTZXNzaW9uRGF0ZVN0cmluZykpKSAvIDEwMDAgLyA2MCAvIDYwIC8gMjQ7XG5cdFx0XHRjb25zdCBmaXN0Q29udGVudEJlaGF2aW91ciA9IGRheXNTaW5jZUZpcnN0U2Vzc2lvbiA8IDEgPyAnb3BlblRvRmlyc3RDYXRlZ29yeScgOiAnaW5kZXgnO1xuXG5cdFx0XHRpZiAoZmlzdENvbnRlbnRCZWhhdmlvdXIgPT09ICdvcGVuVG9GaXJzdENhdGVnb3J5Jykge1xuXHRcdFx0XHRjb25zdCBmaXJzdCA9IHRoaXMuZ2V0dGluZ1N0YXJ0ZWRDYXRlZ29yaWVzLmZpbHRlcihjID0+ICFjLndoZW4gfHwgdGhpcy5jb250ZXh0U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKGMud2hlbikpWzBdO1xuXHRcdFx0XHRpZiAoZmlyc3QpIHtcblx0XHRcdFx0XHR0aGlzLmhhc1Njcm9sbGVkVG9GaXJzdENhdGVnb3J5ID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLmN1cnJlbnRXYWxrdGhyb3VnaCA9IGZpcnN0O1xuXHRcdFx0XHRcdHRoaXMuZWRpdG9ySW5wdXQuc2VsZWN0ZWRDYXRlZ29yeSA9IHRoaXMuY3VycmVudFdhbGt0aHJvdWdoPy5pZDtcblx0XHRcdFx0XHR0aGlzLmVkaXRvcklucHV0LndhbGt0aHJvdWdoUGFnZVRpdGxlID0gdGhpcy5jdXJyZW50V2Fsa3Rocm91Z2gud2Fsa3Rocm91Z2hQYWdlVGl0bGU7XG5cdFx0XHRcdFx0dGhpcy5idWlsZENhdGVnb3J5U2xpZGUodGhpcy5lZGl0b3JJbnB1dC5zZWxlY3RlZENhdGVnb3J5LCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdHRoaXMuc2V0U2xpZGUoJ2RldGFpbHMnLCB0cnVlIC8qIGZpcnN0TGF1bmNoICovKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnNldFNsaWRlKCdjYXRlZ29yaWVzJyk7XG5cdH1cblxuXHRwcml2YXRlIGJ1aWxkUmVjZW50bHlPcGVuZWRMaXN0KCk6IEdldHRpbmdTdGFydGVkSW5kZXhMaXN0PFJlY2VudEVudHJ5PiB7XG5cdFx0Y29uc3QgcmVuZGVyUmVjZW50ID0gKHJlY2VudDogUmVjZW50RW50cnkpID0+IHtcblx0XHRcdGxldCBmdWxsUGF0aDogc3RyaW5nO1xuXHRcdFx0bGV0IHdpbmRvd09wZW5hYmxlOiBJV2luZG93T3BlbmFibGU7XG5cdFx0XHRpZiAoaXNSZWNlbnRGb2xkZXIocmVjZW50KSkge1xuXHRcdFx0XHR3aW5kb3dPcGVuYWJsZSA9IHsgZm9sZGVyVXJpOiByZWNlbnQuZm9sZGVyVXJpIH07XG5cdFx0XHRcdGZ1bGxQYXRoID0gcmVjZW50LmxhYmVsIHx8IHRoaXMubGFiZWxTZXJ2aWNlLmdldFdvcmtzcGFjZUxhYmVsKHJlY2VudC5mb2xkZXJVcmksIHsgdmVyYm9zZTogVmVyYm9zaXR5LkxPTkcgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRmdWxsUGF0aCA9IHJlY2VudC5sYWJlbCB8fCB0aGlzLmxhYmVsU2VydmljZS5nZXRXb3Jrc3BhY2VMYWJlbChyZWNlbnQud29ya3NwYWNlLCB7IHZlcmJvc2U6IFZlcmJvc2l0eS5MT05HIH0pO1xuXHRcdFx0XHR3aW5kb3dPcGVuYWJsZSA9IHsgd29ya3NwYWNlVXJpOiByZWNlbnQud29ya3NwYWNlLmNvbmZpZ1BhdGggfTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgeyBuYW1lLCBwYXJlbnRQYXRoIH0gPSBzcGxpdFJlY2VudExhYmVsKGZ1bGxQYXRoKTtcblxuXHRcdFx0Y29uc3QgbGkgPSAkKCdsaScpO1xuXHRcdFx0Y29uc3QgbGluayA9ICQoJ2J1dHRvbi5idXR0b24tbGluaycpO1xuXG5cdFx0XHRsaW5rLmlubmVyVGV4dCA9IG5hbWU7XG5cdFx0XHRsaW5rLnRpdGxlID0gZnVsbFBhdGg7XG5cdFx0XHRsaW5rLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGxvY2FsaXplKCd3ZWxjb21lUGFnZS5vcGVuRm9sZGVyV2l0aFBhdGgnLCBcIk9wZW4gZm9sZGVyIHswfSB3aXRoIHBhdGggezF9XCIsIG5hbWUsIHBhcmVudFBhdGgpKTtcblx0XHRcdGxpbmsuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcblx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8R2V0dGluZ1N0YXJ0ZWRBY3Rpb25FdmVudCwgR2V0dGluZ1N0YXJ0ZWRBY3Rpb25DbGFzc2lmaWNhdGlvbj4oJ2dldHRpbmdTdGFydGVkLkFjdGlvbkV4ZWN1dGVkJywgeyBjb21tYW5kOiAnb3BlblJlY2VudCcsIGFyZ3VtZW50OiB1bmRlZmluZWQsIHdhbGt0aHJvdWdoSWQ6IHRoaXMuY3VycmVudFdhbGt0aHJvdWdoPy5pZCB9KTtcblx0XHRcdFx0dGhpcy5ob3N0U2VydmljZS5vcGVuV2luZG93KFt3aW5kb3dPcGVuYWJsZV0sIHtcblx0XHRcdFx0XHRmb3JjZU5ld1dpbmRvdzogZS5jdHJsS2V5IHx8IGUubWV0YUtleSxcblx0XHRcdFx0XHRyZW1vdGVBdXRob3JpdHk6IHJlY2VudC5yZW1vdGVBdXRob3JpdHkgfHwgbnVsbCAvLyBsb2NhbCB3aW5kb3cgaWYgcmVtb3RlQXV0aG9yaXR5IGlzIG5vdCBzZXQgb3IgY2FuIG5vdCBiZSBkZWR1Y3RlZCBmcm9tIHRoZSBvcGVuYWJsZVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0fSk7XG5cdFx0XHRsaS5hcHBlbmRDaGlsZChsaW5rKTtcblxuXHRcdFx0Y29uc3Qgc3BhbiA9ICQoJ3NwYW4nKTtcblx0XHRcdHNwYW4uY2xhc3NMaXN0LmFkZCgncGF0aCcpO1xuXHRcdFx0c3Bhbi5jbGFzc0xpc3QuYWRkKCdkZXRhaWwnKTtcblx0XHRcdHNwYW4uaW5uZXJUZXh0ID0gcGFyZW50UGF0aDtcblx0XHRcdHNwYW4udGl0bGUgPSBmdWxsUGF0aDtcblx0XHRcdGxpLmFwcGVuZENoaWxkKHNwYW4pO1xuXG5cdFx0XHRyZXR1cm4gbGk7XG5cdFx0fTtcblxuXHRcdGlmICh0aGlzLnJlY2VudGx5T3BlbmVkTGlzdCkgeyB0aGlzLnJlY2VudGx5T3BlbmVkTGlzdC5kaXNwb3NlKCk7IH1cblxuXHRcdGNvbnN0IHJlY2VudGx5T3BlbmVkTGlzdCA9IHRoaXMucmVjZW50bHlPcGVuZWRMaXN0ID0gbmV3IEdldHRpbmdTdGFydGVkSW5kZXhMaXN0KFxuXHRcdFx0e1xuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3JlY2VudCcsIFwiUmVjZW50XCIpLFxuXHRcdFx0XHRrbGFzczogJ3JlY2VudGx5LW9wZW5lZCcsXG5cdFx0XHRcdGxpbWl0OiA1LFxuXHRcdFx0XHRlbXB0eTogJCgnLmVtcHR5LXJlY2VudCcsIHt9LFxuXHRcdFx0XHRcdGxvY2FsaXplKCdub1JlY2VudHMnLCBcIllvdSBoYXZlIG5vIHJlY2VudCBmb2xkZXJzLFwiKSxcblx0XHRcdFx0XHQkKCdidXR0b24uYnV0dG9uLWxpbmsnLCB7ICd4LWRpc3BhdGNoJzogJ29wZW5Gb2xkZXInIH0sIGxvY2FsaXplKCdvcGVuRm9sZGVyJywgXCJvcGVuIGEgZm9sZGVyXCIpKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgndG9TdGFydCcsIFwidG8gc3RhcnQuXCIpKSxcblxuXHRcdFx0XHRtb3JlOiAkKCcubW9yZScsIHt9LFxuXHRcdFx0XHRcdCQoJ2J1dHRvbi5idXR0b24tbGluaycsXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdCd4LWRpc3BhdGNoJzogJ3Nob3dNb3JlUmVjZW50cycsXG5cdFx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc2hvdyBtb3JlIHJlY2VudHMnLCBcIlNob3cgQWxsIFJlY2VudCBGb2xkZXJzIHswfVwiLCB0aGlzLmdldEtleWJpbmRpbmdMYWJlbChPcGVuUmVjZW50QWN0aW9uLklEKSlcblx0XHRcdFx0XHRcdH0sIGxvY2FsaXplKCdzaG93QWxsJywgXCJNb3JlLi4uXCIpKSksXG5cdFx0XHRcdHJlbmRlckVsZW1lbnQ6IHJlbmRlclJlY2VudCxcblx0XHRcdFx0Y29udGV4dFNlcnZpY2U6IHRoaXMuY29udGV4dFNlcnZpY2Vcblx0XHRcdH0pO1xuXG5cdFx0cmVjZW50bHlPcGVuZWRMaXN0Lm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMucmVnaXN0ZXJEaXNwYXRjaExpc3RlbmVycygpKTtcblx0XHR0aGlzLnJlY2VudGx5T3BlbmVkLnRoZW4oKHsgd29ya3NwYWNlcyB9KSA9PiB7XG5cdFx0XHQvLyBGaWx0ZXIgb3V0IHRoZSBjdXJyZW50IHdvcmtzcGFjZVxuXHRcdFx0Y29uc3Qgd29ya3NwYWNlc1dpdGhJRCA9IHdvcmtzcGFjZXNcblx0XHRcdFx0LmZpbHRlcihyZWNlbnQgPT4gIXRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuaXNDdXJyZW50V29ya3NwYWNlKGlzUmVjZW50V29ya3NwYWNlKHJlY2VudCkgPyByZWNlbnQud29ya3NwYWNlIDogcmVjZW50LmZvbGRlclVyaSkpXG5cdFx0XHRcdC5tYXAocmVjZW50ID0+ICh7IC4uLnJlY2VudCwgaWQ6IGlzUmVjZW50V29ya3NwYWNlKHJlY2VudCkgPyByZWNlbnQud29ya3NwYWNlLmlkIDogcmVjZW50LmZvbGRlclVyaS50b1N0cmluZygpIH0pKTtcblxuXHRcdFx0Y29uc3QgdXBkYXRlRW50cmllcyA9ICgpID0+IHtcblx0XHRcdFx0cmVjZW50bHlPcGVuZWRMaXN0LnNldEVudHJpZXMod29ya3NwYWNlc1dpdGhJRCk7XG5cdFx0XHR9O1xuXG5cdFx0XHR1cGRhdGVFbnRyaWVzKCk7XG5cdFx0XHRyZWNlbnRseU9wZW5lZExpc3QucmVnaXN0ZXIodGhpcy5sYWJlbFNlcnZpY2Uub25EaWRDaGFuZ2VGb3JtYXR0ZXJzKCgpID0+IHVwZGF0ZUVudHJpZXMoKSkpO1xuXHRcdH0pLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKTtcblxuXHRcdHJldHVybiByZWNlbnRseU9wZW5lZExpc3Q7XG5cdH1cblxuXHRwcml2YXRlIGJ1aWxkU3RhcnRMaXN0KCk6IEdldHRpbmdTdGFydGVkSW5kZXhMaXN0PElXZWxjb21lUGFnZVN0YXJ0RW50cnk+IHtcblx0XHRjb25zdCByZW5kZXJTdGFydEVudHJ5ID0gKGVudHJ5OiBJV2VsY29tZVBhZ2VTdGFydEVudHJ5KTogSFRNTEVsZW1lbnQgPT5cblx0XHRcdCQoJ2xpJyxcblx0XHRcdFx0e30sICQoJ2J1dHRvbi5idXR0b24tbGluaycsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0J3gtZGlzcGF0Y2gnOiAnc2VsZWN0U3RhcnRFbnRyeTonICsgZW50cnkuaWQsXG5cdFx0XHRcdFx0XHR0aXRsZTogZW50cnkuZGVzY3JpcHRpb24gKyAnICcgKyB0aGlzLmdldEtleWJpbmRpbmdMYWJlbChlbnRyeS5jb21tYW5kKSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHRoaXMuaWNvbldpZGdldEZvcihlbnRyeSksXG5cdFx0XHRcdFx0JCgnc3BhbicsIHt9LCBlbnRyeS50aXRsZSkpKTtcblxuXHRcdGlmICh0aGlzLnN0YXJ0TGlzdCkgeyB0aGlzLnN0YXJ0TGlzdC5kaXNwb3NlKCk7IH1cblxuXHRcdGNvbnN0IHN0YXJ0TGlzdCA9IHRoaXMuc3RhcnRMaXN0ID0gbmV3IEdldHRpbmdTdGFydGVkSW5kZXhMaXN0KFxuXHRcdFx0e1xuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3N0YXJ0JywgXCJTdGFydFwiKSxcblx0XHRcdFx0a2xhc3M6ICdzdGFydC1jb250YWluZXInLFxuXHRcdFx0XHRsaW1pdDogMTAsXG5cdFx0XHRcdHJlbmRlckVsZW1lbnQ6IHJlbmRlclN0YXJ0RW50cnksXG5cdFx0XHRcdHJhbmtFbGVtZW50OiBlID0+IC1lLm9yZGVyLFxuXHRcdFx0XHRjb250ZXh0U2VydmljZTogdGhpcy5jb250ZXh0U2VydmljZVxuXHRcdFx0fSk7XG5cblx0XHRzdGFydExpc3Quc2V0RW50cmllcyhwYXJzZWRTdGFydEVudHJpZXMpO1xuXHRcdHN0YXJ0TGlzdC5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLnJlZ2lzdGVyRGlzcGF0Y2hMaXN0ZW5lcnMoKSk7XG5cdFx0cmV0dXJuIHN0YXJ0TGlzdDtcblx0fVxuXG5cdHByaXZhdGUgYnVpbGRHZXR0aW5nU3RhcnRlZFdhbGt0aHJvdWdoc0xpc3QoKTogR2V0dGluZ1N0YXJ0ZWRJbmRleExpc3Q8SVJlc29sdmVkV2Fsa3Rocm91Z2g+IHtcblxuXHRcdGNvbnN0IHJlbmRlckdldHR0aW5nU3RhcmVkV2Fsa3Rocm91Z2ggPSAoY2F0ZWdvcnk6IElSZXNvbHZlZFdhbGt0aHJvdWdoKTogSFRNTEVsZW1lbnQgPT4ge1xuXG5cdFx0XHRjb25zdCByZW5kZXJOZXdCYWRnZSA9IChjYXRlZ29yeS5uZXdJdGVtcyB8fCBjYXRlZ29yeS5uZXdFbnRyeSkgJiYgIWNhdGVnb3J5LmlzRmVhdHVyZWQ7XG5cdFx0XHRjb25zdCBuZXdCYWRnZSA9ICQoJy5uZXctYmFkZ2UnLCB7fSk7XG5cdFx0XHRpZiAoY2F0ZWdvcnkubmV3RW50cnkpIHtcblx0XHRcdFx0cmVzZXQobmV3QmFkZ2UsICQoJy5uZXctY2F0ZWdvcnknLCB7fSwgbG9jYWxpemUoJ25ldycsIFwiTmV3XCIpKSk7XG5cdFx0XHR9IGVsc2UgaWYgKGNhdGVnb3J5Lm5ld0l0ZW1zKSB7XG5cdFx0XHRcdHJlc2V0KG5ld0JhZGdlLCAkKCcubmV3LWl0ZW1zJywge30sIGxvY2FsaXplKHsga2V5OiAnbmV3SXRlbXMnLCBjb21tZW50OiBbJ1Nob3duIHdoZW4gYSBsaXN0IG9mIGl0ZW1zIGhhcyBjaGFuZ2VkIGJhc2VkIG9uIGFuIHVwZGF0ZSBmcm9tIGEgcmVtb3RlIHNvdXJjZSddIH0sIFwiVXBkYXRlZFwiKSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBmZWF0dXJlZEJhZGdlID0gJCgnLmZlYXR1cmVkLWJhZGdlJywge30pO1xuXHRcdFx0Y29uc3QgZGVzY3JpcHRpb25Db250ZW50ID0gJCgnLmRlc2NyaXB0aW9uLWNvbnRlbnQnLCB7fSwpO1xuXG5cdFx0XHRpZiAoY2F0ZWdvcnkuaXNGZWF0dXJlZCAmJiB0aGlzLnNob3dGZWF0dXJlZFdhbGt0aHJvdWdoKSB7XG5cdFx0XHRcdHJlc2V0KGZlYXR1cmVkQmFkZ2UsICQoJy5mZWF0dXJlZCcsIHt9LCAkKCdzcGFuLmZlYXR1cmVkLWljb24uY29kaWNvbi5jb2RpY29uLXN0YXItZnVsbCcpKSk7XG5cdFx0XHRcdHJlc2V0KGRlc2NyaXB0aW9uQ29udGVudCwgLi4ucmVuZGVyTGFiZWxXaXRoSWNvbnMoY2F0ZWdvcnkuZGVzY3JpcHRpb24pKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdGl0bGVDb250ZW50ID0gJCgnaDMuY2F0ZWdvcnktdGl0bGUubWF4LWxpbmVzLTMnLCB7ICd4LWNhdGVnb3J5LXRpdGxlLWZvcic6IGNhdGVnb3J5LmlkIH0pO1xuXHRcdFx0cmVzZXQodGl0bGVDb250ZW50LCAuLi5yZW5kZXJMYWJlbFdpdGhJY29ucyhjYXRlZ29yeS50aXRsZSkpO1xuXG5cdFx0XHRyZXR1cm4gJCgnYnV0dG9uLmdldHRpbmctc3RhcnRlZC1jYXRlZ29yeScgKyAoY2F0ZWdvcnkuaXNGZWF0dXJlZCAmJiB0aGlzLnNob3dGZWF0dXJlZFdhbGt0aHJvdWdoID8gJy5mZWF0dXJlZCcgOiAnJyksXG5cdFx0XHRcdHtcblx0XHRcdFx0XHQneC1kaXNwYXRjaCc6ICdzZWxlY3RDYXRlZ29yeTonICsgY2F0ZWdvcnkuaWQsXG5cdFx0XHRcdFx0J3RpdGxlJzogY2F0ZWdvcnkuZGVzY3JpcHRpb25cblx0XHRcdFx0fSxcblx0XHRcdFx0ZmVhdHVyZWRCYWRnZSxcblx0XHRcdFx0JCgnLm1haW4tY29udGVudCcsIHt9LFxuXHRcdFx0XHRcdHRoaXMuaWNvbldpZGdldEZvcihjYXRlZ29yeSksXG5cdFx0XHRcdFx0dGl0bGVDb250ZW50LFxuXHRcdFx0XHRcdHJlbmRlck5ld0JhZGdlID8gbmV3QmFkZ2UgOiAkKCcubm8tYmFkZ2UnKSxcblx0XHRcdFx0XHQkKCdhLmNvZGljb24uY29kaWNvbi1jbG9zZS5oaWRlLWNhdGVnb3J5LWJ1dHRvbicsIHtcblx0XHRcdFx0XHRcdCd0YWJpbmRleCc6IDAsXG5cdFx0XHRcdFx0XHQneC1kaXNwYXRjaCc6ICdoaWRlQ2F0ZWdvcnk6JyArIGNhdGVnb3J5LmlkLFxuXHRcdFx0XHRcdFx0J3RpdGxlJzogbG9jYWxpemUoJ2Nsb3NlJywgXCJIaWRlXCIpLFxuXHRcdFx0XHRcdFx0J3JvbGUnOiAnYnV0dG9uJyxcblx0XHRcdFx0XHRcdCdhcmlhLWxhYmVsJzogbG9jYWxpemUoJ2Nsb3NlQXJpYUxhYmVsJywgXCJIaWRlXCIpLFxuXHRcdFx0XHRcdH0pLFxuXHRcdFx0XHQpLFxuXHRcdFx0XHRkZXNjcmlwdGlvbkNvbnRlbnQsXG5cdFx0XHRcdCQoJy5jYXRlZ29yeS1wcm9ncmVzcycsIHsgJ3gtZGF0YS1jYXRlZ29yeS1pZCc6IGNhdGVnb3J5LmlkLCB9LFxuXHRcdFx0XHRcdCQoJy5wcm9ncmVzcy1iYXItb3V0ZXInLCB7ICdyb2xlJzogJ3Byb2dyZXNzYmFyJyB9LFxuXHRcdFx0XHRcdFx0JCgnLnByb2dyZXNzLWJhci1pbm5lcicpKSkpO1xuXHRcdH07XG5cblx0XHRpZiAodGhpcy5nZXR0aW5nU3RhcnRlZExpc3QpIHsgdGhpcy5nZXR0aW5nU3RhcnRlZExpc3QuZGlzcG9zZSgpOyB9XG5cblx0XHRjb25zdCByYW5rV2Fsa3Rocm91Z2ggPSAoZTogSVJlc29sdmVkV2Fsa3Rocm91Z2gpID0+IHtcblx0XHRcdGxldCByYW5rOiBudW1iZXIgfCBudWxsID0gZS5vcmRlcjtcblxuXHRcdFx0aWYgKGUuaXNGZWF0dXJlZCkgeyByYW5rICs9IDc7IH1cblx0XHRcdGlmIChlLm5ld0VudHJ5KSB7IHJhbmsgKz0gMzsgfVxuXHRcdFx0aWYgKGUubmV3SXRlbXMpIHsgcmFuayArPSAyOyB9XG5cdFx0XHRpZiAoZS5yZWNlbmN5Qm9udXMpIHsgcmFuayArPSA0ICogZS5yZWNlbmN5Qm9udXM7IH1cblxuXHRcdFx0aWYgKHRoaXMuZ2V0SGlkZGVuQ2F0ZWdvcmllcygpLmhhcyhlLmlkKSkgeyByYW5rID0gbnVsbDsgfVxuXHRcdFx0cmV0dXJuIHJhbms7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGdldHRpbmdTdGFydGVkTGlzdCA9IHRoaXMuZ2V0dGluZ1N0YXJ0ZWRMaXN0ID0gbmV3IEdldHRpbmdTdGFydGVkSW5kZXhMaXN0KFxuXHRcdFx0e1xuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dhbGt0aHJvdWdocycsIFwiV2Fsa3Rocm91Z2hzXCIpLFxuXHRcdFx0XHRrbGFzczogJ2dldHRpbmctc3RhcnRlZCcsXG5cdFx0XHRcdGxpbWl0OiA1LFxuXHRcdFx0XHRmb290ZXI6ICQoJ3NwYW4uYnV0dG9uLWxpbmsuc2VlLWFsbC13YWxrdGhyb3VnaHMnLCB7ICd4LWRpc3BhdGNoJzogJ3NlZUFsbFdhbGt0aHJvdWdocycsICd0YWJpbmRleCc6IDAgfSwgbG9jYWxpemUoJ3Nob3dBbGwnLCBcIk1vcmUuLi5cIikpLFxuXHRcdFx0XHRyZW5kZXJFbGVtZW50OiByZW5kZXJHZXR0dGluZ1N0YXJlZFdhbGt0aHJvdWdoLFxuXHRcdFx0XHRyYW5rRWxlbWVudDogcmFua1dhbGt0aHJvdWdoLFxuXHRcdFx0XHRjb250ZXh0U2VydmljZTogdGhpcy5jb250ZXh0U2VydmljZSxcblx0XHRcdH0pO1xuXG5cdFx0Z2V0dGluZ1N0YXJ0ZWRMaXN0Lm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdGNvbnN0IGhpZGRlbiA9IHRoaXMuZ2V0SGlkZGVuQ2F0ZWdvcmllcygpO1xuXHRcdFx0Y29uc3Qgc29tZVdhbGt0aHJvdWdoc0hpZGRlbiA9IGhpZGRlbi5zaXplIHx8IGdldHRpbmdTdGFydGVkTGlzdC5pdGVtQ291bnQgPCB0aGlzLmdldHRpbmdTdGFydGVkQ2F0ZWdvcmllcy5maWx0ZXIoYyA9PiB0aGlzLmNvbnRleHRTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMoYy53aGVuKSkubGVuZ3RoO1xuXHRcdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnc29tZVdhbGt0aHJvdWdoc0hpZGRlbicsICEhc29tZVdhbGt0aHJvdWdoc0hpZGRlbik7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyRGlzcGF0Y2hMaXN0ZW5lcnMoKTtcblx0XHRcdGFsbFdhbGt0aHJvdWdoc0hpZGRlbkNvbnRleHQuYmluZFRvKHRoaXMuY29udGV4dFNlcnZpY2UpLnNldChnZXR0aW5nU3RhcnRlZExpc3QuaXRlbUNvdW50ID09PSAwKTtcblx0XHRcdHRoaXMudXBkYXRlQ2F0ZWdvcnlQcm9ncmVzcygpO1xuXHRcdH0pO1xuXG5cdFx0Z2V0dGluZ1N0YXJ0ZWRMaXN0LnNldEVudHJpZXModGhpcy5nZXR0aW5nU3RhcnRlZENhdGVnb3JpZXMpO1xuXHRcdGFsbFdhbGt0aHJvdWdoc0hpZGRlbkNvbnRleHQuYmluZFRvKHRoaXMuY29udGV4dFNlcnZpY2UpLnNldChnZXR0aW5nU3RhcnRlZExpc3QuaXRlbUNvdW50ID09PSAwKTtcblxuXHRcdHJldHVybiBnZXR0aW5nU3RhcnRlZExpc3Q7XG5cdH1cblxuXHRsYXlvdXQoc2l6ZTogRGltZW5zaW9uKSB7XG5cdFx0dGhpcy5kZXRhaWxzU2Nyb2xsYmFyPy5zY2FuRG9tTm9kZSgpO1xuXG5cdFx0dGhpcy5jYXRlZ29yaWVzUGFnZVNjcm9sbGJhcj8uc2NhbkRvbU5vZGUoKTtcblx0XHR0aGlzLmRldGFpbHNQYWdlU2Nyb2xsYmFyPy5zY2FuRG9tTm9kZSgpO1xuXG5cdFx0dGhpcy5zdGFydExpc3Q/LmxheW91dChzaXplKTtcblx0XHR0aGlzLmdldHRpbmdTdGFydGVkTGlzdD8ubGF5b3V0KHNpemUpO1xuXHRcdHRoaXMucmVjZW50bHlPcGVuZWRMaXN0Py5sYXlvdXQoc2l6ZSk7XG5cblx0XHRpZiAodGhpcy5lZGl0b3JJbnB1dD8uc2VsZWN0ZWRTdGVwICYmIHRoaXMuY3VycmVudE1lZGlhVHlwZSkge1xuXHRcdFx0dGhpcy5tZWRpYURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHR0aGlzLnN0ZXBEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdFx0dGhpcy5idWlsZE1lZGlhQ29tcG9uZW50KHRoaXMuZWRpdG9ySW5wdXQuc2VsZWN0ZWRTdGVwKTtcblx0XHR9XG5cblx0XHR0aGlzLmxheW91dE1hcmtkb3duPy4oKTtcblxuXHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2hlaWdodC1jb25zdHJhaW5lZCcsIHNpemUuaGVpZ2h0IDw9IDYwMCk7XG5cdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnd2lkdGgtY29uc3RyYWluZWQnLCBzaXplLndpZHRoIDw9IDQwMCk7XG5cdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnd2lkdGgtc2VtaS1jb25zdHJhaW5lZCcsIHNpemUud2lkdGggPD0gOTUwKTtcblxuXHRcdHRoaXMuY2F0ZWdvcmllc1BhZ2VTY3JvbGxiYXI/LnNjYW5Eb21Ob2RlKCk7XG5cdFx0dGhpcy5kZXRhaWxzUGFnZVNjcm9sbGJhcj8uc2NhbkRvbU5vZGUoKTtcblx0XHR0aGlzLmRldGFpbHNTY3JvbGxiYXI/LnNjYW5Eb21Ob2RlKCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNhdGVnb3J5UHJvZ3Jlc3MoKSB7XG5cdFx0dGhpcy53aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmNhdGVnb3J5LXByb2dyZXNzJykuZm9yRWFjaChlbGVtZW50ID0+IHtcblx0XHRcdGNvbnN0IGNhdGVnb3J5SUQgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgneC1kYXRhLWNhdGVnb3J5LWlkJyk7XG5cdFx0XHRjb25zdCBjYXRlZ29yeSA9IHRoaXMuZ2V0dGluZ1N0YXJ0ZWRDYXRlZ29yaWVzLmZpbmQoY2F0ZWdvcnkgPT4gY2F0ZWdvcnkuaWQgPT09IGNhdGVnb3J5SUQpO1xuXHRcdFx0aWYgKCFjYXRlZ29yeSkgeyB0aHJvdyBFcnJvcignQ291bGQgbm90IGZpbmQgY2F0ZWdvcnkgd2l0aCBJRCAnICsgY2F0ZWdvcnlJRCk7IH1cblxuXHRcdFx0Y29uc3Qgc3RhdHMgPSB0aGlzLmdldFdhbGt0aHJvdWdoQ29tcGxldGlvblN0YXRzKGNhdGVnb3J5KTtcblxuXHRcdFx0Y29uc3QgYmFyID0gYXNzZXJ0SXNEZWZpbmVkKGVsZW1lbnQucXVlcnlTZWxlY3RvcignLnByb2dyZXNzLWJhci1pbm5lcicpKSBhcyBIVE1MRGl2RWxlbWVudDtcblx0XHRcdGJhci5zZXRBdHRyaWJ1dGUoJ2FyaWEtdmFsdWVtaW4nLCAnMCcpO1xuXHRcdFx0YmFyLnNldEF0dHJpYnV0ZSgnYXJpYS12YWx1ZW5vdycsICcnICsgc3RhdHMuc3RlcHNDb21wbGV0ZSk7XG5cdFx0XHRiYXIuc2V0QXR0cmlidXRlKCdhcmlhLXZhbHVlbWF4JywgJycgKyBzdGF0cy5zdGVwc1RvdGFsKTtcblx0XHRcdGNvbnN0IHByb2dyZXNzID0gKHN0YXRzLnN0ZXBzQ29tcGxldGUgLyBzdGF0cy5zdGVwc1RvdGFsKSAqIDEwMDtcblx0XHRcdGJhci5zdHlsZS53aWR0aCA9IGAke3Byb2dyZXNzfSVgO1xuXG5cdFx0XHQoZWxlbWVudC5wYXJlbnRFbGVtZW50IGFzIEhUTUxFbGVtZW50KS5jbGFzc0xpc3QudG9nZ2xlKCduby1wcm9ncmVzcycsIHN0YXRzLnN0ZXBzQ29tcGxldGUgPT09IDApO1xuXG5cdFx0XHRpZiAoc3RhdHMuc3RlcHNUb3RhbCA9PT0gc3RhdHMuc3RlcHNDb21wbGV0ZSkge1xuXHRcdFx0XHRiYXIudGl0bGUgPSBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuYWxsU3RlcHNDb21wbGV0ZScsIFwiQWxsIHswfSBzdGVwcyBjb21wbGV0ZSFcIiwgc3RhdHMuc3RlcHNDb21wbGV0ZSk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0YmFyLnRpdGxlID0gbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnNvbWVTdGVwc0NvbXBsZXRlJywgXCJ7MH0gb2YgezF9IHN0ZXBzIGNvbXBsZXRlXCIsIHN0YXRzLnN0ZXBzQ29tcGxldGUsIHN0YXRzLnN0ZXBzVG90YWwpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzY3JvbGxUb0NhdGVnb3J5KGNhdGVnb3J5SUQ6IHN0cmluZywgc3RlcElkPzogc3RyaW5nKSB7XG5cblx0XHRpZiAoIXRoaXMuZ2V0dGluZ1N0YXJ0ZWRDYXRlZ29yaWVzLnNvbWUoYyA9PiBjLmlkID09PSBjYXRlZ29yeUlEKSkge1xuXHRcdFx0dGhpcy5nZXR0aW5nU3RhcnRlZENhdGVnb3JpZXMgPSB0aGlzLmdldHRpbmdTdGFydGVkU2VydmljZS5nZXRXYWxrdGhyb3VnaHMoKTtcblx0XHR9XG5cblx0XHRjb25zdCBvdXJDYXRlZ29yeSA9IHRoaXMuZ2V0dGluZ1N0YXJ0ZWRDYXRlZ29yaWVzLmZpbmQoYyA9PiBjLmlkID09PSBjYXRlZ29yeUlEKTtcblx0XHRpZiAoIW91ckNhdGVnb3J5KSB7XG5cdFx0XHR0aHJvdyBFcnJvcignQ291bGQgbm90IGZpbmQgY2F0ZWdvcnkgd2l0aCBJRDogJyArIGNhdGVnb3J5SUQpO1xuXHRcdH1cblxuXHRcdHRoaXMuaW5Qcm9ncmVzc1Njcm9sbCA9IHRoaXMuaW5Qcm9ncmVzc1Njcm9sbC50aGVuKGFzeW5jICgpID0+IHtcblx0XHRcdHJlc2V0KHRoaXMuc3RlcHNDb250ZW50KTtcblx0XHRcdHRoaXMuZWRpdG9ySW5wdXQuc2VsZWN0ZWRDYXRlZ29yeSA9IGNhdGVnb3J5SUQ7XG5cdFx0XHR0aGlzLmVkaXRvcklucHV0LnNlbGVjdGVkU3RlcCA9IHN0ZXBJZDtcblx0XHRcdHRoaXMuZWRpdG9ySW5wdXQud2Fsa3Rocm91Z2hQYWdlVGl0bGUgPSBvdXJDYXRlZ29yeS53YWxrdGhyb3VnaFBhZ2VUaXRsZTtcblx0XHRcdHRoaXMuY3VycmVudFdhbGt0aHJvdWdoID0gb3VyQ2F0ZWdvcnk7XG5cdFx0XHR0aGlzLmJ1aWxkQ2F0ZWdvcnlTbGlkZShjYXRlZ29yeUlELCBzdGVwSWQpO1xuXHRcdFx0dGhpcy5zZXRTbGlkZSgnZGV0YWlscycpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBpY29uV2lkZ2V0Rm9yKGNhdGVnb3J5OiBJUmVzb2x2ZWRXYWxrdGhyb3VnaCB8IHsgaWNvbjogeyB0eXBlOiAnaWNvbic7IGljb246IFRoZW1lSWNvbiB9IH0pIHtcblx0XHRjb25zdCB3aWRnZXQgPSBjYXRlZ29yeS5pY29uLnR5cGUgPT09ICdpY29uJyA/ICQoVGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoY2F0ZWdvcnkuaWNvbi5pY29uKSkgOiAkKCdpbWcuY2F0ZWdvcnktaWNvbicsIHsgc3JjOiBjYXRlZ29yeS5pY29uLnBhdGggfSk7XG5cdFx0d2lkZ2V0LmNsYXNzTGlzdC5hZGQoJ2ljb24td2lkZ2V0Jyk7XG5cdFx0cmV0dXJuIHdpZGdldDtcblx0fVxuXG5cdHByaXZhdGUgZm9jdXNTaWRlRWRpdG9yR3JvdXAoKSB7XG5cdFx0Y29uc3QgZnVsbFNpemUgPSB0aGlzLmdyb3Vwc1NlcnZpY2UuZ2V0UGFydCh0aGlzLmdyb3VwKS5jb250ZW50RGltZW5zaW9uO1xuXHRcdGlmICghZnVsbFNpemUgfHwgZnVsbFNpemUud2lkdGggPD0gNzAwKSB7IHJldHVybjsgfVxuXHRcdGlmICh0aGlzLmdyb3Vwc1NlcnZpY2UuY291bnQgPT09IDEpIHtcblx0XHRcdGNvbnN0IHNpZGVHcm91cCA9IHRoaXMuZ3JvdXBzU2VydmljZS5hZGRHcm91cCh0aGlzLmdyb3Vwc1NlcnZpY2UuZ3JvdXBzWzBdLCBHcm91cERpcmVjdGlvbi5SSUdIVCk7XG5cdFx0XHR0aGlzLmdyb3Vwc1NlcnZpY2UuYWN0aXZhdGVHcm91cChzaWRlR3JvdXApO1xuXG5cdFx0XHRjb25zdCBnZXR0aW5nU3RhcnRlZFNpemUgPSBNYXRoLmZsb29yKGZ1bGxTaXplLndpZHRoIC8gMik7XG5cblx0XHRcdGNvbnN0IGdldHRpbmdTdGFydGVkR3JvdXAgPSB0aGlzLmdyb3Vwc1NlcnZpY2UuZ2V0R3JvdXBzKEdyb3Vwc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKS5maW5kKGdyb3VwID0+IChncm91cC5hY3RpdmVFZGl0b3IgaW5zdGFuY2VvZiBHZXR0aW5nU3RhcnRlZElucHV0KSk7XG5cdFx0XHR0aGlzLmdyb3Vwc1NlcnZpY2Uuc2V0U2l6ZShhc3NlcnRJc0RlZmluZWQoZ2V0dGluZ1N0YXJ0ZWRHcm91cCksIHsgd2lkdGg6IGdldHRpbmdTdGFydGVkU2l6ZSwgaGVpZ2h0OiBmdWxsU2l6ZS5oZWlnaHQgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm9uR2V0dGluZ1N0YXJ0ZWRHcm91cCA9IHRoaXMuZ3JvdXBzU2VydmljZS5nZXRHcm91cHMoR3JvdXBzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmZpbmQoZ3JvdXAgPT4gIShncm91cC5hY3RpdmVFZGl0b3IgaW5zdGFuY2VvZiBHZXR0aW5nU3RhcnRlZElucHV0KSk7XG5cdFx0aWYgKG5vbkdldHRpbmdTdGFydGVkR3JvdXApIHtcblx0XHRcdHRoaXMuZ3JvdXBzU2VydmljZS5hY3RpdmF0ZUdyb3VwKG5vbkdldHRpbmdTdGFydGVkR3JvdXApO1xuXHRcdFx0bm9uR2V0dGluZ1N0YXJ0ZWRHcm91cC5mb2N1cygpO1xuXHRcdH1cblx0fVxuXHRwcml2YXRlIHJ1blN0ZXBDb21tYW5kKGhyZWY6IHN0cmluZykge1xuXG5cdFx0Y29uc3QgaXNDb21tYW5kID0gaHJlZi5zdGFydHNXaXRoKCdjb21tYW5kOicpO1xuXHRcdGNvbnN0IHRvU2lkZSA9IGhyZWYuc3RhcnRzV2l0aCgnY29tbWFuZDp0b1NpZGU6Jyk7XG5cdFx0Y29uc3QgY29tbWFuZCA9IGhyZWYucmVwbGFjZSgvY29tbWFuZDoodG9TaWRlOik/LywgJ2NvbW1hbmQ6Jyk7XG5cblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxHZXR0aW5nU3RhcnRlZEFjdGlvbkV2ZW50LCBHZXR0aW5nU3RhcnRlZEFjdGlvbkNsYXNzaWZpY2F0aW9uPignZ2V0dGluZ1N0YXJ0ZWQuQWN0aW9uRXhlY3V0ZWQnLCB7IGNvbW1hbmQ6ICdydW5TdGVwQWN0aW9uJywgYXJndW1lbnQ6IGhyZWYsIHdhbGt0aHJvdWdoSWQ6IHRoaXMuY3VycmVudFdhbGt0aHJvdWdoPy5pZCB9KTtcblxuXHRcdGlmICh0b1NpZGUpIHtcblx0XHRcdHRoaXMuZm9jdXNTaWRlRWRpdG9yR3JvdXAoKTtcblx0XHR9XG5cdFx0aWYgKGlzQ29tbWFuZCkge1xuXHRcdFx0Y29uc3QgY29tbWFuZFVSSSA9IFVSSS5wYXJzZShjb21tYW5kKTtcblxuXHRcdFx0Ly8gZXhlY3V0ZSBhcyBjb21tYW5kXG5cdFx0XHRsZXQgYXJnczogYW55ID0gW107XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhcmdzID0gcGFyc2UoZGVjb2RlVVJJQ29tcG9uZW50KGNvbW1hbmRVUkkucXVlcnkpKTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHQvLyBpZ25vcmUgYW5kIHJldHJ5XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXJncyA9IHBhcnNlKGNvbW1hbmRVUkkucXVlcnkpO1xuXHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHQvLyBpZ25vcmUgZXJyb3Jcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KGFyZ3MpKSB7XG5cdFx0XHRcdGFyZ3MgPSBbYXJnc107XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIGEgc3RlcCBpcyByZXF1ZXN0aW5nIHRoZSBPcGVuRm9sZGVyIGFjdGlvbiB0byBiZSBleGVjdXRlZCBpbiBhbiBlbXB0eSB3b3Jrc3BhY2UuLi5cblx0XHRcdGlmICgoY29tbWFuZFVSSS5wYXRoID09PSBPcGVuRmlsZUZvbGRlckFjdGlvbi5JRC50b1N0cmluZygpIHx8XG5cdFx0XHRcdGNvbW1hbmRVUkkucGF0aCA9PT0gT3BlbkZvbGRlckFjdGlvbi5JRC50b1N0cmluZygpKSAmJlxuXHRcdFx0XHR0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMubGVuZ3RoID09PSAwKSB7XG5cblx0XHRcdFx0Y29uc3Qgc2VsZWN0ZWRTdGVwSW5kZXggPSB0aGlzLmN1cnJlbnRXYWxrdGhyb3VnaD8uc3RlcHMuZmluZEluZGV4KHN0ZXAgPT4gc3RlcC5pZCA9PT0gdGhpcy5lZGl0b3JJbnB1dC5zZWxlY3RlZFN0ZXApO1xuXG5cdFx0XHRcdC8vIGFuZCB0aGVyZSBhcmUgYSBmZXcgbW9yZSBzdGVwcyBhZnRlciB0aGlzIHN0ZXAgd2hpY2ggYXJlIHlldCB0byBiZSBjb21wbGV0ZWQuLi5cblx0XHRcdFx0aWYgKHNlbGVjdGVkU3RlcEluZGV4ICE9PSB1bmRlZmluZWQgJiZcblx0XHRcdFx0XHRzZWxlY3RlZFN0ZXBJbmRleCA+IC0xICYmXG5cdFx0XHRcdFx0dGhpcy5jdXJyZW50V2Fsa3Rocm91Z2g/LnN0ZXBzLnNsaWNlKHNlbGVjdGVkU3RlcEluZGV4ICsgMSkuc29tZShzdGVwID0+ICFzdGVwLmRvbmUpKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzdG9yZURhdGE6IFJlc3RvcmVXYWxrdGhyb3VnaHNDb25maWd1cmF0aW9uVmFsdWUgPSB7IGZvbGRlcjogVU5LTk9XTl9FTVBUWV9XSU5ET1dfV09SS1NQQUNFLmlkLCBjYXRlZ29yeTogdGhpcy5lZGl0b3JJbnB1dC5zZWxlY3RlZENhdGVnb3J5LCBzdGVwOiB0aGlzLmVkaXRvcklucHV0LnNlbGVjdGVkU3RlcCB9O1xuXG5cdFx0XHRcdFx0Ly8gc2F2ZSBzdGF0ZSB0byByZXN0b3JlIGFmdGVyIHJlbG9hZFxuXHRcdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoXG5cdFx0XHRcdFx0XHRyZXN0b3JlV2Fsa3Rocm91Z2hzQ29uZmlndXJhdGlvbktleSxcblx0XHRcdFx0XHRcdEpTT04uc3RyaW5naWZ5KHJlc3RvcmVEYXRhKSxcblx0XHRcdFx0XHRcdFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZFVSSS5wYXRoLCAuLi5hcmdzKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRcdGNvbnN0IHRvT3BlbjogVVJJID0gcmVzdWx0Py5vcGVuRm9sZGVyO1xuXHRcdFx0XHRpZiAodG9PcGVuKSB7XG5cdFx0XHRcdFx0aWYgKCFVUkkuaXNVcmkodG9PcGVuKSkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS53YXJuKCdXYXJuOiBSdW5uaW5nIHdhbGt0aHJvdWdoIGNvbW1hbmQnLCBocmVmLCAneWllbGRlZCBub24tVVJJIGBvcGVuRm9sZGVyYCByZXN1bHQnLCB0b09wZW4sICcuIEl0IHdpbGwgYmUgZGlzcmVnYXJkZWQuJyk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHJlc3RvcmVEYXRhOiBSZXN0b3JlV2Fsa3Rocm91Z2hzQ29uZmlndXJhdGlvblZhbHVlID0geyBmb2xkZXI6IHRvT3Blbi50b1N0cmluZygpLCBjYXRlZ29yeTogdGhpcy5lZGl0b3JJbnB1dC5zZWxlY3RlZENhdGVnb3J5LCBzdGVwOiB0aGlzLmVkaXRvcklucHV0LnNlbGVjdGVkU3RlcCB9O1xuXHRcdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoXG5cdFx0XHRcdFx0XHRyZXN0b3JlV2Fsa3Rocm91Z2hzQ29uZmlndXJhdGlvbktleSxcblx0XHRcdFx0XHRcdEpTT04uc3RyaW5naWZ5KHJlc3RvcmVEYXRhKSxcblx0XHRcdFx0XHRcdFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdFx0XHRcdHRoaXMuaG9zdFNlcnZpY2Uub3BlbldpbmRvdyhbeyBmb2xkZXJVcmk6IHRvT3BlbiB9XSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm9wZW5lclNlcnZpY2Uub3Blbihjb21tYW5kLCB7IGFsbG93Q29tbWFuZHM6IHRydWUgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFpc0NvbW1hbmQgJiYgKGhyZWYuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSB8fCBocmVmLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSkpIHtcblx0XHRcdHRoaXMuZ2V0dGluZ1N0YXJ0ZWRTZXJ2aWNlLnByb2dyZXNzQnlFdmVudCgnb25MaW5rOicgKyBocmVmKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGJ1aWxkTWFya2Rvd25EZXNjcmlwdGlvbihjb250YWluZXI6IEhUTUxFbGVtZW50LCB0ZXh0OiBMaW5rZWRUZXh0W10pIHtcblx0XHR3aGlsZSAoY29udGFpbmVyLmZpcnN0Q2hpbGQpIHsgY29udGFpbmVyLmZpcnN0Q2hpbGQucmVtb3ZlKCk7IH1cblxuXHRcdGZvciAoY29uc3QgbGlua2VkVGV4dCBvZiB0ZXh0KSB7XG5cdFx0XHRpZiAobGlua2VkVGV4dC5ub2Rlcy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGxpbmtlZFRleHQubm9kZXNbMF0gIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGNvbnN0IG5vZGUgPSBsaW5rZWRUZXh0Lm5vZGVzWzBdO1xuXHRcdFx0XHRjb25zdCBidXR0b25Db250YWluZXIgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcuYnV0dG9uLWNvbnRhaW5lcicpKTtcblx0XHRcdFx0Y29uc3QgYnV0dG9uID0gbmV3IEJ1dHRvbihidXR0b25Db250YWluZXIsIHsgdGl0bGU6IG5vZGUudGl0bGUsIHN1cHBvcnRJY29uczogdHJ1ZSwgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcyB9KTtcblxuXHRcdFx0XHRjb25zdCBpc0NvbW1hbmQgPSBub2RlLmhyZWYuc3RhcnRzV2l0aCgnY29tbWFuZDonKTtcblx0XHRcdFx0Y29uc3QgY29tbWFuZCA9IG5vZGUuaHJlZi5yZXBsYWNlKC9jb21tYW5kOih0b1NpZGU6KT8vLCAnY29tbWFuZDonKTtcblxuXHRcdFx0XHRidXR0b24ubGFiZWwgPSBub2RlLmxhYmVsO1xuXHRcdFx0XHRidXR0b24ub25EaWRDbGljayhlID0+IHtcblx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHR0aGlzLnJ1blN0ZXBDb21tYW5kKG5vZGUuaHJlZik7XG5cdFx0XHRcdH0sIG51bGwsIHRoaXMuZGV0YWlsc1BhZ2VEaXNwb3NhYmxlcyk7XG5cblx0XHRcdFx0aWYgKGlzQ29tbWFuZCkge1xuXHRcdFx0XHRcdGNvbnN0IGtleWJpbmRpbmcgPSB0aGlzLmdldEtleUJpbmRpbmcoY29tbWFuZCk7XG5cdFx0XHRcdFx0aWYgKGtleWJpbmRpbmcpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHNob3J0Y3V0TWVzc2FnZSA9ICQoJ3NwYW4uc2hvcnRjdXQtbWVzc2FnZScsIHt9LCBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQua2V5Ym9hcmRUaXAnLCAnVGlwOiBVc2Uga2V5Ym9hcmQgc2hvcnRjdXQgJykpO1xuXHRcdFx0XHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHNob3J0Y3V0TWVzc2FnZSk7XG5cdFx0XHRcdFx0XHRjb25zdCBsYWJlbCA9IG5ldyBLZXliaW5kaW5nTGFiZWwoc2hvcnRjdXRNZXNzYWdlLCBPUywgeyAuLi5kZWZhdWx0S2V5YmluZGluZ0xhYmVsU3R5bGVzIH0pO1xuXHRcdFx0XHRcdFx0bGFiZWwuc2V0KGtleWJpbmRpbmcpO1xuXHRcdFx0XHRcdFx0dGhpcy5kZXRhaWxzUGFnZURpc3Bvc2FibGVzLmFkZChsYWJlbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5kZXRhaWxzUGFnZURpc3Bvc2FibGVzLmFkZChidXR0b24pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgcCA9IGFwcGVuZChjb250YWluZXIsICQoJ3AnKSk7XG5cdFx0XHRcdGZvciAoY29uc3Qgbm9kZSBvZiBsaW5rZWRUZXh0Lm5vZGVzKSB7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBub2RlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGFiZWxXaXRoSWNvbiA9IHJlbmRlckxhYmVsV2l0aEljb25zKG5vZGUpO1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIGxhYmVsV2l0aEljb24pIHtcblx0XHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBlbGVtZW50ID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0XHRcdHAuYXBwZW5kQ2hpbGQocmVuZGVyRm9ybWF0dGVkVGV4dChlbGVtZW50LCB7IGlubGluZTogdHJ1ZSwgcmVuZGVyQ29kZVNlZ21lbnRzOiB0cnVlIH0pKTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRwLmFwcGVuZENoaWxkKGVsZW1lbnQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnN0IG5vZGVXaXRoVGl0bGU6IElMaW5rID0gbWF0Y2hlc1NjaGVtZShub2RlLmhyZWYsIFNjaGVtYXMuaHR0cCkgfHwgbWF0Y2hlc1NjaGVtZShub2RlLmhyZWYsIFNjaGVtYXMuaHR0cHMpID8geyAuLi5ub2RlLCB0aXRsZTogbm9kZS5ocmVmIH0gOiBub2RlO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGluayA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTGluaywgcCwgbm9kZVdpdGhUaXRsZSwgeyBvcGVuZXI6IChocmVmKSA9PiB0aGlzLnJ1blN0ZXBDb21tYW5kKGhyZWYpIH0pO1xuXHRcdFx0XHRcdFx0dGhpcy5kZXRhaWxzUGFnZURpc3Bvc2FibGVzLmFkZChsaW5rKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGNvbnRhaW5lcjtcblx0fVxuXG5cdG92ZXJyaWRlIGNsZWFySW5wdXQoKSB7XG5cdFx0dGhpcy5zdGVwRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRzdXBlci5jbGVhcklucHV0KCk7XG5cdH1cblxuXHRwcml2YXRlIGJ1aWxkQ2F0ZWdvcnlTbGlkZShjYXRlZ29yeUlEOiBzdHJpbmcsIHNlbGVjdGVkU3RlcD86IHN0cmluZykge1xuXHRcdGlmICh0aGlzLmRldGFpbHNTY3JvbGxiYXIpIHsgdGhpcy5kZXRhaWxzU2Nyb2xsYmFyLmRpc3Bvc2UoKTsgfVxuXG5cdFx0dGhpcy5leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpLnRoZW4oKCkgPT4ge1xuXHRcdFx0Ly8gUmVtb3ZlIGludGVybmFsIGV4dGVuc2lvbiBpZCBzcGVjaWZpZXIgZnJvbSBleHBvc2VkIGlkJ3Ncblx0XHRcdHRoaXMuZXh0ZW5zaW9uU2VydmljZS5hY3RpdmF0ZUJ5RXZlbnQoYG9uV2Fsa3Rocm91Z2g6JHtjYXRlZ29yeUlELnJlcGxhY2UoL1teI10rIy8sICcnKX1gKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuZGV0YWlsc1BhZ2VEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMubWVkaWFEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0Y29uc3QgY2F0ZWdvcnkgPSB0aGlzLmdldHRpbmdTdGFydGVkQ2F0ZWdvcmllcy5maW5kKGNhdGVnb3J5ID0+IGNhdGVnb3J5LmlkID09PSBjYXRlZ29yeUlEKTtcblx0XHRpZiAoIWNhdGVnb3J5KSB7XG5cdFx0XHR0aHJvdyBFcnJvcignY291bGQgbm90IGZpbmQgY2F0ZWdvcnkgd2l0aCBJRCAnICsgY2F0ZWdvcnlJRCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVzY3JpcHRpb25Db250YWluZXIgPSAkKCcuY2F0ZWdvcnktZGVzY3JpcHRpb24uZGVzY3JpcHRpb24ubWF4LWxpbmVzLTMnLCB7ICd4LWNhdGVnb3J5LWRlc2NyaXB0aW9uLWZvcic6IGNhdGVnb3J5LmlkIH0pO1xuXHRcdHRoaXMuYnVpbGRNYXJrZG93bkRlc2NyaXB0aW9uKGRlc2NyaXB0aW9uQ29udGFpbmVyLCBwYXJzZURlc2NyaXB0aW9uKGNhdGVnb3J5LmRlc2NyaXB0aW9uKSk7XG5cblx0XHRjb25zdCBjYXRlZ29yeURlc2NyaXB0b3JDb21wb25lbnQgPVxuXHRcdFx0JCgnLmdldHRpbmctc3RhcnRlZC1jYXRlZ29yeScsXG5cdFx0XHRcdHt9LFxuXHRcdFx0XHQkKCcuY2F0ZWdvcnktZGVzY3JpcHRpb24tY29udGFpbmVyJywge30sXG5cdFx0XHRcdFx0JCgnaDIuY2F0ZWdvcnktdGl0bGUubWF4LWxpbmVzLTMnLCB7ICd4LWNhdGVnb3J5LXRpdGxlLWZvcic6IGNhdGVnb3J5LmlkIH0sIC4uLnJlbmRlckxhYmVsV2l0aEljb25zKGNhdGVnb3J5LnRpdGxlKSksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb25Db250YWluZXIpKTtcblxuXHRcdGNvbnN0IHN0ZXBMaXN0Q29udGFpbmVyID0gJCgnLnN0ZXAtbGlzdC1jb250YWluZXInKTtcblxuXHRcdHRoaXMuZGV0YWlsc1BhZ2VEaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHN0ZXBMaXN0Q29udGFpbmVyLCAna2V5ZG93bicsIChlKSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRjb25zdCBjdXJyZW50U3RlcEluZGV4ID0gKCkgPT5cblx0XHRcdFx0Y2F0ZWdvcnkuc3RlcHMuZmluZEluZGV4KGUgPT4gZS5pZCA9PT0gdGhpcy5lZGl0b3JJbnB1dC5zZWxlY3RlZFN0ZXApO1xuXG5cdFx0XHRpZiAoZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZS5VcEFycm93KSB7XG5cdFx0XHRcdGNvbnN0IHRvRXhwYW5kID0gY2F0ZWdvcnkuc3RlcHMuZmlsdGVyKChzdGVwLCBpbmRleCkgPT4gaW5kZXggPCBjdXJyZW50U3RlcEluZGV4KCkgJiYgdGhpcy5jb250ZXh0U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKHN0ZXAud2hlbikpO1xuXHRcdFx0XHRpZiAodG9FeHBhbmQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhpcy5zZWxlY3RTdGVwKHRvRXhwYW5kW3RvRXhwYW5kLmxlbmd0aCAtIDFdLmlkLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChldmVudC5rZXlDb2RlID09PSBLZXlDb2RlLkRvd25BcnJvdykge1xuXHRcdFx0XHRjb25zdCB0b0V4cGFuZCA9IGNhdGVnb3J5LnN0ZXBzLmZpbmQoKHN0ZXAsIGluZGV4KSA9PiBpbmRleCA+IGN1cnJlbnRTdGVwSW5kZXgoKSAmJiB0aGlzLmNvbnRleHRTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMoc3RlcC53aGVuKSk7XG5cdFx0XHRcdGlmICh0b0V4cGFuZCkge1xuXHRcdFx0XHRcdHRoaXMuc2VsZWN0U3RlcCh0b0V4cGFuZC5pZCwgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0bGV0IHJlbmRlcmVkU3RlcHM6IElSZXNvbHZlZFdhbGt0aHJvdWdoU3RlcFtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgY29udGV4dEtleXNUb1dhdGNoID0gbmV3IFNldChjYXRlZ29yeS5zdGVwcy5mbGF0TWFwKHN0ZXAgPT4gc3RlcC53aGVuLmtleXMoKSkpO1xuXG5cdFx0Y29uc3QgYnVpbGRTdGVwTGlzdCA9ICgpID0+IHtcblxuXHRcdFx0Y2F0ZWdvcnkuc3RlcHMuc29ydCgoYSwgYikgPT4gYS5vcmRlciAtIGIub3JkZXIpO1xuXHRcdFx0Y29uc3QgdG9SZW5kZXIgPSBjYXRlZ29yeS5zdGVwc1xuXHRcdFx0XHQuZmlsdGVyKHN0ZXAgPT4gdGhpcy5jb250ZXh0U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKHN0ZXAud2hlbikpO1xuXG5cdFx0XHRpZiAoZXF1YWxzKHJlbmRlcmVkU3RlcHMsIHRvUmVuZGVyLCAoYSwgYikgPT4gYS5pZCA9PT0gYi5pZCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRyZW5kZXJlZFN0ZXBzID0gdG9SZW5kZXI7XG5cblx0XHRcdHJlc2V0KHN0ZXBMaXN0Q29udGFpbmVyLCAuLi5yZW5kZXJlZFN0ZXBzXG5cdFx0XHRcdC5tYXAoc3RlcCA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgY29kaWNvbiA9ICQoJy5jb2RpY29uJyArIChzdGVwLmRvbmUgPyAnLmNvbXBsZXRlJyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGdldHRpbmdTdGFydGVkQ2hlY2tlZENvZGljb24pIDogVGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoZ2V0dGluZ1N0YXJ0ZWRVbmNoZWNrZWRDb2RpY29uKSksXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdCdkYXRhLWRvbmUtc3RlcC1pZCc6IHN0ZXAuaWQsXG5cdFx0XHRcdFx0XHRcdCd4LWRpc3BhdGNoJzogJ3RvZ2dsZVN0ZXBDb21wbGV0aW9uOicgKyBzdGVwLmlkLFxuXHRcdFx0XHRcdFx0XHQncm9sZSc6ICdjaGVja2JveCcsXG5cdFx0XHRcdFx0XHRcdCdhcmlhLWNoZWNrZWQnOiBzdGVwLmRvbmUgPyAndHJ1ZScgOiAnZmFsc2UnLFxuXHRcdFx0XHRcdFx0XHQnYXJpYS1sYWJlbCc6IHN0ZXAuZG9uZVxuXHRcdFx0XHRcdFx0XHRcdD8gbG9jYWxpemUoJ3N0ZXBEb25lJywgXCJDaGVja2JveCBmb3IgU3RlcCB7MH06IENvbXBsZXRlZFwiLCBzdGVwLnRpdGxlKVxuXHRcdFx0XHRcdFx0XHRcdDogbG9jYWxpemUoJ3N0ZXBOb3REb25lJywgXCJDaGVja2JveCBmb3IgU3RlcCB7MH06IE5vdCBjb21wbGV0ZWRcIiwgc3RlcC50aXRsZSksXG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGNvbnN0IGNvbnRhaW5lciA9ICQoJy5zdGVwLWRlc2NyaXB0aW9uLWNvbnRhaW5lcicsIHsgJ3gtc3RlcC1kZXNjcmlwdGlvbi1mb3InOiBzdGVwLmlkIH0pO1xuXHRcdFx0XHRcdHRoaXMuYnVpbGRNYXJrZG93bkRlc2NyaXB0aW9uKGNvbnRhaW5lciwgc3RlcC5kZXNjcmlwdGlvbik7XG5cblx0XHRcdFx0XHRjb25zdCBzdGVwVGl0bGUgPSAkKCdoMy5zdGVwLXRpdGxlLm1heC1saW5lcy0zJywgeyAneC1zdGVwLXRpdGxlLWZvcic6IHN0ZXAuaWQgfSk7XG5cdFx0XHRcdFx0cmVzZXQoc3RlcFRpdGxlLCAuLi5yZW5kZXJMYWJlbFdpdGhJY29ucyhzdGVwLnRpdGxlKSk7XG5cblx0XHRcdFx0XHRjb25zdCBzdGVwRGVzY3JpcHRpb24gPSAkKCcuc3RlcC1jb250YWluZXInLCB7fSxcblx0XHRcdFx0XHRcdHN0ZXBUaXRsZSxcblx0XHRcdFx0XHRcdGNvbnRhaW5lcixcblx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0aWYgKHN0ZXAubWVkaWEudHlwZSA9PT0gJ2ltYWdlJykge1xuXHRcdFx0XHRcdFx0c3RlcERlc2NyaXB0aW9uLmFwcGVuZENoaWxkKFxuXHRcdFx0XHRcdFx0XHQkKCcuaW1hZ2UtZGVzY3JpcHRpb24nLCB7ICdhcmlhLWxhYmVsJzogbG9jYWxpemUoJ2ltYWdlU2hvd2luZycsIFwiSW1hZ2Ugc2hvd2luZyB7MH1cIiwgc3RlcC5tZWRpYS5hbHRUZXh0KSB9KSxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzdGVwLm1lZGlhLnR5cGUgPT09ICd2aWRlbycpIHtcblx0XHRcdFx0XHRcdHN0ZXBEZXNjcmlwdGlvbi5hcHBlbmRDaGlsZChcblx0XHRcdFx0XHRcdFx0JCgnLnZpZGVvLWRlc2NyaXB0aW9uJywgeyAnYXJpYS1sYWJlbCc6IGxvY2FsaXplKCd2aWRlb1Nob3dpbmcnLCBcIlZpZGVvIHNob3dpbmcgezB9XCIsIHN0ZXAubWVkaWEuYWx0VGV4dCkgfSksXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiAkKCdidXR0b24uZ2V0dGluZy1zdGFydGVkLXN0ZXAnLFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHQneC1kaXNwYXRjaCc6ICdzZWxlY3RUYXNrOicgKyBzdGVwLmlkLFxuXHRcdFx0XHRcdFx0XHQnZGF0YS1zdGVwLWlkJzogc3RlcC5pZCxcblx0XHRcdFx0XHRcdFx0J2FyaWEtZXhwYW5kZWQnOiAnZmFsc2UnLFxuXHRcdFx0XHRcdFx0XHQnYXJpYS1jaGVja2VkJzogc3RlcC5kb25lID8gJ3RydWUnIDogJ2ZhbHNlJyxcblx0XHRcdFx0XHRcdFx0J3JvbGUnOiAnYnV0dG9uJyxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRjb2RpY29uLFxuXHRcdFx0XHRcdFx0c3RlcERlc2NyaXB0aW9uKTtcblx0XHRcdFx0fSkpO1xuXHRcdH07XG5cblx0XHRidWlsZFN0ZXBMaXN0KCk7XG5cblx0XHR0aGlzLmRldGFpbHNQYWdlRGlzcG9zYWJsZXMuYWRkKHRoaXMuY29udGV4dFNlcnZpY2Uub25EaWRDaGFuZ2VDb250ZXh0KGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c1NvbWUoY29udGV4dEtleXNUb1dhdGNoKSAmJiB0aGlzLmN1cnJlbnRXYWxrdGhyb3VnaCkge1xuXHRcdFx0XHRidWlsZFN0ZXBMaXN0KCk7XG5cdFx0XHRcdHRoaXMucmVnaXN0ZXJEaXNwYXRjaExpc3RlbmVycygpO1xuXHRcdFx0XHR0aGlzLnNlbGVjdFN0ZXAodGhpcy5lZGl0b3JJbnB1dC5zZWxlY3RlZFN0ZXAsIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBzaG93TmV4dENhdGVnb3J5ID0gdGhpcy5nZXR0aW5nU3RhcnRlZENhdGVnb3JpZXMuZmluZChfY2F0ZWdvcnkgPT4gX2NhdGVnb3J5LmlkID09PSBjYXRlZ29yeS5uZXh0KTtcblxuXHRcdGNvbnN0IHN0ZXBzQ29udGFpbmVyID0gJChcblx0XHRcdCcuZ2V0dGluZy1zdGFydGVkLWRldGFpbC1jb250YWluZXInLCB7ICdyb2xlJzogJ2xpc3QnIH0sXG5cdFx0XHRzdGVwTGlzdENvbnRhaW5lcixcblx0XHRcdCQoJy5kb25lLW5leHQtY29udGFpbmVyJywge30sXG5cdFx0XHRcdCQoJ2J1dHRvbi5idXR0b24tbGluay5hbGwtZG9uZScsIHsgJ3gtZGlzcGF0Y2gnOiAnYWxsRG9uZScgfSwgJCgnc3Bhbi5jb2RpY29uLmNvZGljb24tY2hlY2stYWxsJyksIGxvY2FsaXplKCdhbGxEb25lJywgXCJNYXJrIERvbmVcIikpLFxuXHRcdFx0XHQuLi4oc2hvd05leHRDYXRlZ29yeVxuXHRcdFx0XHRcdD8gWyQoJ2J1dHRvbi5idXR0b24tbGluay5uZXh0JywgeyAneC1kaXNwYXRjaCc6ICduZXh0U2VjdGlvbicgfSwgbG9jYWxpemUoJ25leHRPbmUnLCBcIk5leHQgU2VjdGlvblwiKSwgJCgnc3Bhbi5jb2RpY29uLmNvZGljb24tYXJyb3ctcmlnaHQnKSldXG5cdFx0XHRcdFx0OiBbXSksXG5cdFx0XHQpXG5cdFx0KTtcblx0XHR0aGlzLmRldGFpbHNTY3JvbGxiYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tU2Nyb2xsYWJsZUVsZW1lbnQoc3RlcHNDb250YWluZXIsIHsgY2xhc3NOYW1lOiAnc3RlcHMtY29udGFpbmVyJyB9KSk7XG5cdFx0Y29uc3Qgc3RlcExpc3RDb21wb25lbnQgPSB0aGlzLmRldGFpbHNTY3JvbGxiYXIuZ2V0RG9tTm9kZSgpO1xuXG5cdFx0Y29uc3QgY2F0ZWdvcnlGb290ZXIgPSAkKCcuZ2V0dGluZy1zdGFydGVkLWZvb3RlcicpO1xuXHRcdGlmICh0aGlzLmVkaXRvcklucHV0LnNob3dUZWxlbWV0cnlOb3RpY2UgJiYgZ2V0VGVsZW1ldHJ5TGV2ZWwodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkgIT09IFRlbGVtZXRyeUxldmVsLk5PTkUgJiYgdGhpcy5wcm9kdWN0U2VydmljZS5lbmFibGVUZWxlbWV0cnkpIHtcblx0XHRcdHRoaXMuYnVpbGRUZWxlbWV0cnlGb290ZXIoY2F0ZWdvcnlGb290ZXIpO1xuXHRcdH1cblxuXHRcdHJlc2V0KHRoaXMuc3RlcHNDb250ZW50LCBjYXRlZ29yeURlc2NyaXB0b3JDb21wb25lbnQsIHN0ZXBMaXN0Q29tcG9uZW50LCB0aGlzLnN0ZXBNZWRpYUNvbXBvbmVudCwgY2F0ZWdvcnlGb290ZXIpO1xuXG5cdFx0Y29uc3QgdG9FeHBhbmQgPSBjYXRlZ29yeS5zdGVwcy5maW5kKHN0ZXAgPT4gdGhpcy5jb250ZXh0U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKHN0ZXAud2hlbikgJiYgIXN0ZXAuZG9uZSkgPz8gY2F0ZWdvcnkuc3RlcHNbMF07XG5cdFx0dGhpcy5zZWxlY3RTdGVwKHNlbGVjdGVkU3RlcCA/PyB0b0V4cGFuZC5pZCwgIXNlbGVjdGVkU3RlcCk7XG5cblx0XHR0aGlzLmRldGFpbHNTY3JvbGxiYXIuc2NhbkRvbU5vZGUoKTtcblx0XHR0aGlzLmRldGFpbHNQYWdlU2Nyb2xsYmFyPy5zY2FuRG9tTm9kZSgpO1xuXG5cdFx0dGhpcy5yZWdpc3RlckRpc3BhdGNoTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIGJ1aWxkVGVsZW1ldHJ5Rm9vdGVyKHBhcmVudDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBtZFJlbmRlcmVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZG93blJlbmRlcmVyLCB7fSk7XG5cblx0XHRjb25zdCBwcml2YWN5U3RhdGVtZW50Q29weSA9IGxvY2FsaXplKCdwcml2YWN5IHN0YXRlbWVudCcsIFwicHJpdmFjeSBzdGF0ZW1lbnRcIik7XG5cdFx0Y29uc3QgcHJpdmFjeVN0YXRlbWVudEJ1dHRvbiA9IGBbJHtwcml2YWN5U3RhdGVtZW50Q29weX1dKGNvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi5vcGVuUHJpdmFjeVN0YXRlbWVudFVybClgO1xuXG5cdFx0Y29uc3Qgb3B0T3V0Q29weSA9IGxvY2FsaXplKCdvcHRPdXQnLCBcIm9wdCBvdXRcIik7XG5cdFx0Y29uc3Qgb3B0T3V0QnV0dG9uID0gYFske29wdE91dENvcHl9XShjb21tYW5kOnNldHRpbmdzLmZpbHRlckJ5VGVsZW1ldHJ5KWA7XG5cblx0XHRjb25zdCB0ZXh0ID0gbG9jYWxpemUoeyBrZXk6ICdmb290ZXInLCBjb21tZW50OiBbJ2Zpc3Qgc3Vic3RpdHV0aW9uIGlzIFwidnMgY29kZVwiLCBzZWNvbmQgaXMgXCJwcml2YWN5IHN0YXRlbWVudFwiLCB0aGlyZCBpcyBcIm9wdCBvdXRcIi4nXSB9LFxuXHRcdFx0XCJ7MH0gY29sbGVjdHMgdXNhZ2UgZGF0YS4gUmVhZCBvdXIgezF9IGFuZCBsZWFybiBob3cgdG8gezJ9LlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVTaG9ydCwgcHJpdmFjeVN0YXRlbWVudEJ1dHRvbiwgb3B0T3V0QnV0dG9uKTtcblxuXHRcdHBhcmVudC5hcHBlbmQobWRSZW5kZXJlci5yZW5kZXIoeyB2YWx1ZTogdGV4dCwgaXNUcnVzdGVkOiB0cnVlIH0pLmVsZW1lbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRLZXliaW5kaW5nTGFiZWwoY29tbWFuZDogc3RyaW5nKSB7XG5cdFx0Y29tbWFuZCA9IGNvbW1hbmQucmVwbGFjZSgvXmNvbW1hbmQ6LywgJycpO1xuXHRcdGNvbnN0IGxhYmVsID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGNvbW1hbmQpPy5nZXRMYWJlbCgpO1xuXHRcdGlmICghbGFiZWwpIHsgcmV0dXJuICcnOyB9XG5cdFx0ZWxzZSB7XG5cdFx0XHRyZXR1cm4gYCgke2xhYmVsfSlgO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0S2V5QmluZGluZyhjb21tYW5kOiBzdHJpbmcpIHtcblx0XHRjb21tYW5kID0gY29tbWFuZC5yZXBsYWNlKC9eY29tbWFuZDovLCAnJyk7XG5cdFx0cmV0dXJuIHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhjb21tYW5kKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2Nyb2xsUHJldigpIHtcblx0XHR0aGlzLmluUHJvZ3Jlc3NTY3JvbGwgPSB0aGlzLmluUHJvZ3Jlc3NTY3JvbGwudGhlbihhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5wcmV2V2Fsa3Rocm91Z2ggJiYgdGhpcy5wcmV2V2Fsa3Rocm91Z2ggIT09IHRoaXMuY3VycmVudFdhbGt0aHJvdWdoKSB7XG5cdFx0XHRcdHRoaXMuY3VycmVudFdhbGt0aHJvdWdoID0gdGhpcy5wcmV2V2Fsa3Rocm91Z2g7XG5cdFx0XHRcdHRoaXMucHJldldhbGt0aHJvdWdoID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLm1ha2VDYXRlZ29yeVZpc2libGVXaGVuQXZhaWxhYmxlKHRoaXMuY3VycmVudFdhbGt0aHJvdWdoLmlkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuY3VycmVudFdhbGt0aHJvdWdoID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLmVkaXRvcklucHV0LnNlbGVjdGVkQ2F0ZWdvcnkgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuZWRpdG9ySW5wdXQuc2VsZWN0ZWRTdGVwID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLmVkaXRvcklucHV0LnNob3dUZWxlbWV0cnlOb3RpY2UgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy5lZGl0b3JJbnB1dC53YWxrdGhyb3VnaFBhZ2VUaXRsZSA9IHVuZGVmaW5lZDtcblxuXHRcdFx0XHRpZiAodGhpcy5nZXR0aW5nU3RhcnRlZENhdGVnb3JpZXMubGVuZ3RoICE9PSB0aGlzLmdldHRpbmdTdGFydGVkTGlzdD8uaXRlbUNvdW50KSB7XG5cdFx0XHRcdFx0Ly8gZXh0ZW5zaW9ucyBtYXkgaGF2ZSBjaGFuZ2VkIGluIHRoZSB0aW1lIHNpbmNlIHdlIGxhc3QgZGlzcGxheWVkIHRoZSB3YWxrdGhyb3VnaCBsaXN0XG5cdFx0XHRcdFx0Ly8gcmVidWlsZCB0aGUgbGlzdFxuXHRcdFx0XHRcdHRoaXMuYnVpbGRDYXRlZ29yaWVzU2xpZGUoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuc2VsZWN0U3RlcCh1bmRlZmluZWQpO1xuXHRcdFx0XHR0aGlzLnNldFNsaWRlKCdjYXRlZ29yaWVzJyk7XG5cdFx0XHRcdHRoaXMuY29udGFpbmVyLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJ1blNraXAoKSB7XG5cdFx0dGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi5jbG9zZUFjdGl2ZUVkaXRvcicpO1xuXHR9XG5cblx0ZXNjYXBlKCkge1xuXHRcdGlmICh0aGlzLmVkaXRvcklucHV0LnNlbGVjdGVkQ2F0ZWdvcnkpIHtcblx0XHRcdHRoaXMuc2Nyb2xsUHJldigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnJ1blNraXAoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldFNsaWRlKHRvRW5hYmxlOiAnZGV0YWlscycgfCAnY2F0ZWdvcmllcycsIGZpcnN0TGF1bmNoOiBib29sZWFuID0gZmFsc2UpIHtcblx0XHRjb25zdCBzbGlkZU1hbmFnZXIgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5jb250YWluZXIucXVlcnlTZWxlY3RvcignLmdldHRpbmdTdGFydGVkJykpO1xuXHRcdGlmICh0b0VuYWJsZSA9PT0gJ2NhdGVnb3JpZXMnKSB7XG5cdFx0XHRzbGlkZU1hbmFnZXIuY2xhc3NMaXN0LnJlbW92ZSgnc2hvd0RldGFpbHMnKTtcblx0XHRcdHNsaWRlTWFuYWdlci5jbGFzc0xpc3QuYWRkKCdzaG93Q2F0ZWdvcmllcycpO1xuXHRcdFx0dGhpcy5jb250YWluZXIucXVlcnlTZWxlY3RvcjxIVE1MQnV0dG9uRWxlbWVudD4oJy5wcmV2LWJ1dHRvbi5idXR0b24tbGluaycpIS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0dGhpcy5jb250YWluZXIucXVlcnlTZWxlY3RvcignLmdldHRpbmdTdGFydGVkU2xpZGVEZXRhaWxzJykhLnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbicpLmZvckVhY2goYnV0dG9uID0+IGJ1dHRvbi5kaXNhYmxlZCA9IHRydWUpO1xuXHRcdFx0dGhpcy5jb250YWluZXIucXVlcnlTZWxlY3RvcignLmdldHRpbmdTdGFydGVkU2xpZGVDYXRlZ29yaWVzJykhLnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbicpLmZvckVhY2goYnV0dG9uID0+IGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlKTtcblx0XHRcdHRoaXMuY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5nZXR0aW5nU3RhcnRlZFNsaWRlQ2F0ZWdvcmllcycpIS5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCcpLmZvckVhY2goYnV0dG9uID0+IGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2xpZGVNYW5hZ2VyLmNsYXNzTGlzdC5hZGQoJ3Nob3dEZXRhaWxzJyk7XG5cdFx0XHRzbGlkZU1hbmFnZXIuY2xhc3NMaXN0LnJlbW92ZSgnc2hvd0NhdGVnb3JpZXMnKTtcblx0XHRcdGNvbnN0IHByZXZCdXR0b24gPSB0aGlzLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yPEhUTUxCdXR0b25FbGVtZW50PignLnByZXYtYnV0dG9uLmJ1dHRvbi1saW5rJyk7XG5cdFx0XHRwcmV2QnV0dG9uIS5zdHlsZS5kaXNwbGF5ID0gdGhpcy5lZGl0b3JJbnB1dC5zaG93V2VsY29tZSB8fCB0aGlzLnByZXZXYWxrdGhyb3VnaCA/ICdibG9jaycgOiAnbm9uZSc7XG5cblx0XHRcdGNvbnN0IG1vcmVUZXh0RWxlbWVudCA9IHByZXZCdXR0b24hLnF1ZXJ5U2VsZWN0b3IoJy5tb3JlVGV4dCcpO1xuXHRcdFx0bW9yZVRleHRFbGVtZW50IS50ZXh0Q29udGVudCA9IGZpcnN0TGF1bmNoID8gbG9jYWxpemUoJ3dlbGNvbWUnLCBcIldlbGNvbWVcIikgOiBsb2NhbGl6ZSgnZ29CYWNrJywgXCJHbyBCYWNrXCIpO1xuXG5cdFx0XHR0aGlzLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcuZ2V0dGluZ1N0YXJ0ZWRTbGlkZURldGFpbHMnKSEucXVlcnlTZWxlY3RvckFsbCgnYnV0dG9uJykuZm9yRWFjaChidXR0b24gPT4gYnV0dG9uLmRpc2FibGVkID0gZmFsc2UpO1xuXHRcdFx0dGhpcy5jb250YWluZXIucXVlcnlTZWxlY3RvcignLmdldHRpbmdTdGFydGVkU2xpZGVDYXRlZ29yaWVzJykhLnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbicpLmZvckVhY2goYnV0dG9uID0+IGJ1dHRvbi5kaXNhYmxlZCA9IHRydWUpO1xuXHRcdFx0dGhpcy5jb250YWluZXIucXVlcnlTZWxlY3RvcignLmdldHRpbmdTdGFydGVkU2xpZGVDYXRlZ29yaWVzJykhLnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0JykuZm9yRWFjaChidXR0b24gPT4gYnV0dG9uLmRpc2FibGVkID0gdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZm9jdXMoKSB7XG5cdFx0c3VwZXIuZm9jdXMoKTtcblxuXHRcdGNvbnN0IGFjdGl2ZSA9IHRoaXMuY29udGFpbmVyLm93bmVyRG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcblxuXHRcdGxldCBwYXJlbnQgPSB0aGlzLmNvbnRhaW5lci5wYXJlbnRFbGVtZW50O1xuXHRcdHdoaWxlIChwYXJlbnQgJiYgcGFyZW50ICE9PSBhY3RpdmUpIHtcblx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnRFbGVtZW50O1xuXHRcdH1cblxuXHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdC8vIE9ubHkgc2V0IGZvY3VzIGlmIHRoZXJlIGlzIG5vIG90aGVyIGZvY3VlZCBlbGVtZW50IG91dHNpZGUgdGhpcyBjaGFpbi5cblx0XHRcdC8vIFRoaXMgcHJldmVudHMgdXMgZnJvbSBzdGVhbGluZyBiYWNrIGZvY3VzIGZyb20gb3RoZXIgZm9jdXNlZCBlbGVtZW50cyBzdWNoIGFzIHF1aWNrIHBpY2sgZHVlIHRvIGRlbGF5ZWQgbG9hZC5cblx0XHRcdHRoaXMuY29udGFpbmVyLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBHZXR0aW5nU3RhcnRlZElucHV0U2VyaWFsaXplciBpbXBsZW1lbnRzIElFZGl0b3JTZXJpYWxpemVyIHtcblx0cHVibGljIGNhblNlcmlhbGl6ZShlZGl0b3JJbnB1dDogR2V0dGluZ1N0YXJ0ZWRJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIHNlcmlhbGl6ZShlZGl0b3JJbnB1dDogR2V0dGluZ1N0YXJ0ZWRJbnB1dCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc2VsZWN0ZWRDYXRlZ29yeTogZWRpdG9ySW5wdXQuc2VsZWN0ZWRDYXRlZ29yeSwgc2VsZWN0ZWRTdGVwOiBlZGl0b3JJbnB1dC5zZWxlY3RlZFN0ZXAgfSk7XG5cdH1cblxuXHRwdWJsaWMgZGVzZXJpYWxpemUoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSwgc2VyaWFsaXplZEVkaXRvcklucHV0OiBzdHJpbmcpOiBHZXR0aW5nU3RhcnRlZElucHV0IHtcblxuXHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCB7IHNlbGVjdGVkQ2F0ZWdvcnksIHNlbGVjdGVkU3RlcCB9ID0gSlNPTi5wYXJzZShzZXJpYWxpemVkRWRpdG9ySW5wdXQpO1xuXHRcdFx0XHRyZXR1cm4gbmV3IEdldHRpbmdTdGFydGVkSW5wdXQoeyBzZWxlY3RlZENhdGVnb3J5LCBzZWxlY3RlZFN0ZXAgfSk7XG5cdFx0XHR9IGNhdGNoIHsgfVxuXHRcdFx0cmV0dXJuIG5ldyBHZXR0aW5nU3RhcnRlZElucHV0KHt9KTtcblxuXHRcdH0pO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsR0FBYyx1QkFBdUIsUUFBUSxXQUFXLGFBQWE7QUFDOUUsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsY0FBYztBQUN2QixTQUFTLFVBQVUsY0FBYztBQUNqQyxTQUFTLFNBQVMsaUJBQWlCO0FBRW5DLFNBQVMsZUFBZTtBQUN4QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxpQkFBaUIsb0JBQW9CO0FBRTlDLFNBQVMsYUFBYTtBQUN0QixTQUFTLFNBQVMscUJBQXFCO0FBQ3ZDLFNBQVMsYUFBYSxVQUFVO0FBQ2hDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsV0FBVztBQUNwQixTQUFTLG9CQUFvQjtBQUM3QixPQUFPO0FBQ1AsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxxQkFBcUIsNkJBQTZCO0FBQzNELFNBQVMsZ0JBQXNDLG9CQUFvQixxQkFBcUI7QUFFeEYsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBMEI7QUFDbkMs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QUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQXpFVTtBQWlnRE4sTUFBTSw4QkFBMkQ7QUFBQSxFQUNoRSxhQUFhLGFBQTJDO0FBQzlELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxVQUFVLGFBQTBDO0FBQzFELFdBQU8sS0FBSyxVQUFVLEVBQUUsa0JBQWtCLFlBQVksa0JBQWtCLGNBQWMsWUFBWSxhQUFhLENBQUM7QUFBQSxFQUNqSDtBQUFBLEVBRU8sWUFBWSxzQkFBNkMsdUJBQW9EO0FBRW5ILFdBQU8scUJBQXFCLGVBQWUsY0FBWTtBQUN0RCxVQUFJO0FBQ0gsY0FBTSxFQUFFLGtCQUFrQixhQUFhLElBQUksS0FBSyxNQUFNLHFCQUFxQjtBQUMzRSxlQUFPLElBQUksb0JBQW9CLEVBQUUsa0JBQWtCLGFBQWEsQ0FBQztBQUFBLE1BQ2xFLFFBQVE7QUFBQSxNQUFFO0FBQ1YsYUFBTyxJQUFJLG9CQUFvQixDQUFDLENBQUM7QUFBQSxJQUVsQyxDQUFDO0FBQUEsRUFDRjtBQUNEOyIsCiAgIm5hbWVzIjogWyJjYXRlZ29yeSIsICJ0aGVtZSIsICJ0aGVtZVR5cGUiLCAidmlkZW9QYXRoIiwgInZpZGVvUG9zdGVyIiwgImNvZGljb25FbGVtZW50IiwgInN0ZXAiLCAiZSIsICJ0b0V4cGFuZCJdCn0K
