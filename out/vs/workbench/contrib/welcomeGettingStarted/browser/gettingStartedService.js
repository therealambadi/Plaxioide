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
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Emitter } from "../../../../base/common/event.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Memento } from "../../../common/memento.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IUserDataSyncEnablementService } from "../../../../platform/userDataSync/common/userDataSync.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { URI } from "../../../../base/common/uri.js";
import { joinPath } from "../../../../base/common/resources.js";
import { FileAccess } from "../../../../base/common/network.js";
import { EXTENSION_INSTALL_DEP_PACK_CONTEXT, EXTENSION_INSTALL_SKIP_WALKTHROUGH_CONTEXT, IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { walkthroughs } from "../common/gettingStartedContent.js";
import { IWorkbenchAssignmentService } from "../../../services/assignment/common/assignmentService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { parseLinkedText } from "../../../../base/common/linkedText.js";
import { walkthroughsExtensionPoint } from "./gettingStartedExtensionPoint.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { dirname } from "../../../../base/common/path.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { localize, localize2 } from "../../../../nls.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { checkGlobFileExists } from "../../../services/extensions/common/workspaceContains.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { DefaultIconPath } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { asWebviewUri } from "../../webview/common/webview.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
const HasMultipleNewFileEntries = new RawContextKey("hasMultipleNewFileEntries", false);
const IWalkthroughsService = createDecorator("walkthroughsService");
const hiddenEntriesConfigurationKey = "workbench.welcomePage.hiddenCategories";
const walkthroughMetadataConfigurationKey = "workbench.welcomePage.walkthroughMetadata";
const BUILT_IN_SOURCE = localize("builtin", "Built-In");
const DAYS = 24 * 60 * 60 * 1e3;
const NEW_WALKTHROUGH_TIME = 7 * DAYS;
let WalkthroughsService = class extends Disposable {
  constructor(storageService, commandService, instantiationService, workspaceContextService, contextService, userDataSyncEnablementService, configurationService, extensionManagementService, hostService, viewsService, telemetryService, tasExperimentService, productService, layoutService) {
    super();
    this.storageService = storageService;
    this.commandService = commandService;
    this.instantiationService = instantiationService;
    this.workspaceContextService = workspaceContextService;
    this.contextService = contextService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.configurationService = configurationService;
    this.extensionManagementService = extensionManagementService;
    this.hostService = hostService;
    this.viewsService = viewsService;
    this.telemetryService = telemetryService;
    this.tasExperimentService = tasExperimentService;
    this.productService = productService;
    this.layoutService = layoutService;
    this._onDidAddWalkthrough = new Emitter();
    this.onDidAddWalkthrough = this._onDidAddWalkthrough.event;
    this._onDidRemoveWalkthrough = new Emitter();
    this.onDidRemoveWalkthrough = this._onDidRemoveWalkthrough.event;
    this._onDidChangeWalkthrough = new Emitter();
    this.onDidChangeWalkthrough = this._onDidChangeWalkthrough.event;
    this._onDidProgressStep = new Emitter();
    this.onDidProgressStep = this._onDidProgressStep.event;
    this.sessionEvents = /* @__PURE__ */ new Set();
    this.completionListeners = /* @__PURE__ */ new Map();
    this.gettingStartedContributions = /* @__PURE__ */ new Map();
    this.steps = /* @__PURE__ */ new Map();
    this.sessionInstalledExtensions = /* @__PURE__ */ new Set();
    this.categoryVisibilityContextKeys = /* @__PURE__ */ new Set();
    this.stepCompletionContextKeyExpressions = /* @__PURE__ */ new Set();
    this.stepCompletionContextKeys = /* @__PURE__ */ new Set();
    this.metadata = new Map(
      JSON.parse(
        this.storageService.get(walkthroughMetadataConfigurationKey, StorageScope.PROFILE, "[]")
      )
    );
    this.memento = new Memento("gettingStartedService", this.storageService);
    this.stepProgress = this.memento.getMemento(StorageScope.PROFILE, StorageTarget.USER);
    this.initCompletionEventListeners();
    HasMultipleNewFileEntries.bindTo(this.contextService).set(false);
    this.registerWalkthroughs();
  }
  registerWalkthroughs() {
    walkthroughs.forEach(async (category, index) => {
      this._registerWalkthrough({
        ...category,
        icon: { type: "icon", icon: category.icon },
        order: walkthroughs.length - index,
        source: BUILT_IN_SOURCE,
        when: ContextKeyExpr.deserialize(category.when) ?? ContextKeyExpr.true(),
        steps: category.content.steps.map((step, index2) => {
          return {
            ...step,
            completionEvents: step.completionEvents ?? [],
            description: parseDescription(step.description),
            category: category.id,
            order: index2,
            when: ContextKeyExpr.deserialize(step.when) ?? ContextKeyExpr.true(),
            media: step.media.type === "image" ? {
              type: "image",
              altText: step.media.altText,
              path: convertInternalMediaPathsToBrowserURIs(step.media.path)
            } : step.media.type === "svg" ? {
              type: "svg",
              altText: step.media.altText,
              path: convertInternalMediaPathToFileURI(step.media.path).with({ query: JSON.stringify({ moduleId: "vs/workbench/contrib/welcomeGettingStarted/common/media/" + step.media.path }) })
            } : step.media.type === "markdown" ? {
              type: "markdown",
              path: convertInternalMediaPathToFileURI(step.media.path).with({ query: JSON.stringify({ moduleId: "vs/workbench/contrib/welcomeGettingStarted/common/media/" + step.media.path }) }),
              base: FileAccess.asFileUri("vs/workbench/contrib/welcomeGettingStarted/common/media/"),
              root: FileAccess.asFileUri("vs/workbench/contrib/welcomeGettingStarted/common/media/")
            } : {
              type: "video",
              path: convertRelativeMediaPathsToWebviewURIs(FileAccess.asFileUri("vs/workbench/contrib/welcomeGettingStarted/common/media/"), step.media.path),
              altText: step.media.altText,
              root: FileAccess.asFileUri("vs/workbench/contrib/welcomeGettingStarted/common/media/"),
              poster: step.media.poster ? convertRelativeMediaPathsToWebviewURIs(FileAccess.asFileUri("vs/workbench/contrib/welcomeGettingStarted/common/media/"), step.media.poster) : void 0
            }
          };
        })
      });
    });
    walkthroughsExtensionPoint.setHandler((_, { added, removed }) => {
      added.map((e) => this.registerExtensionWalkthroughContributions(e.description));
      removed.map((e) => this.unregisterExtensionWalkthroughContributions(e.description));
    });
  }
  initCompletionEventListeners() {
    this._register(this.commandService.onDidExecuteCommand((command) => this.progressByEvent(`onCommand:${command.commandId}`)));
    this.extensionManagementService.getInstalled().then((installed) => {
      installed.forEach((ext) => this.progressByEvent(`extensionInstalled:${ext.identifier.id.toLowerCase()}`));
    });
    this._register(this.extensionManagementService.onDidInstallExtensions((result) => {
      if (result.some((e) => ExtensionIdentifier.equals(this.productService.defaultChatAgent?.extensionId, e.identifier.id) && !e?.context?.[EXTENSION_INSTALL_SKIP_WALKTHROUGH_CONTEXT])) {
        result.forEach((e) => {
          this.sessionInstalledExtensions.add(e.identifier.id.toLowerCase());
          this.progressByEvent(`extensionInstalled:${e.identifier.id.toLowerCase()}`);
        });
        return;
      }
      for (const e of result) {
        const skipWalkthrough = e?.context?.[EXTENSION_INSTALL_SKIP_WALKTHROUGH_CONTEXT] || e?.context?.[EXTENSION_INSTALL_DEP_PACK_CONTEXT];
        if (!skipWalkthrough) {
          this.sessionInstalledExtensions.add(e.identifier.id.toLowerCase());
        }
        this.progressByEvent(`extensionInstalled:${e.identifier.id.toLowerCase()}`);
      }
    }));
    this._register(this.contextService.onDidChangeContext((event) => {
      if (event.affectsSome(this.stepCompletionContextKeys)) {
        this.stepCompletionContextKeyExpressions.forEach((expression) => {
          if (event.affectsSome(new Set(expression.keys())) && this.contextService.contextMatchesRules(expression)) {
            this.progressByEvent(`onContext:` + expression.serialize());
          }
        });
      }
    }));
    this._register(this.viewsService.onDidChangeViewVisibility((e) => {
      if (e.visible) {
        this.progressByEvent("onView:" + e.id);
      }
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      e.affectedKeys.forEach((key) => {
        this.progressByEvent("onSettingChanged:" + key);
      });
    }));
    if (this.userDataSyncEnablementService.isEnabled()) {
      this.progressByEvent("onEvent:sync-enabled");
    }
    this._register(this.userDataSyncEnablementService.onDidChangeEnablement(() => {
      if (this.userDataSyncEnablementService.isEnabled()) {
        this.progressByEvent("onEvent:sync-enabled");
      }
    }));
  }
  markWalkthroughOpened(id) {
    const walkthrough = this.gettingStartedContributions.get(id);
    const prior = this.metadata.get(id);
    if (prior && walkthrough) {
      this.metadata.set(id, { ...prior, manaullyOpened: true, stepIDs: walkthrough.steps.map((s) => s.id) });
    }
    this.storageService.store(walkthroughMetadataConfigurationKey, JSON.stringify([...this.metadata.entries()]), StorageScope.PROFILE, StorageTarget.USER);
  }
  async registerExtensionWalkthroughContributions(extension) {
    const convertExtensionPathToFileURI = (path) => path.startsWith("https://") ? URI.parse(path, true) : FileAccess.uriToFileUri(joinPath(extension.extensionLocation, path));
    const convertExtensionRelativePathsToBrowserURIs = (path) => {
      const convertPath = (path2) => path2.startsWith("https://") ? URI.parse(path2, true) : FileAccess.uriToBrowserUri(joinPath(extension.extensionLocation, path2));
      if (typeof path === "string") {
        const converted = convertPath(path);
        return { hcDark: converted, hcLight: converted, dark: converted, light: converted };
      } else {
        return {
          hcDark: convertPath(path.hc),
          hcLight: convertPath(path.hcLight ?? path.light),
          light: convertPath(path.light),
          dark: convertPath(path.dark)
        };
      }
    };
    if (!extension.contributes?.walkthroughs?.length) {
      return;
    }
    let sectionToOpen;
    let sectionToOpenIndex = Math.min();
    await Promise.all(extension.contributes?.walkthroughs?.map(async (walkthrough, index) => {
      const categoryID = extension.identifier.value + "#" + walkthrough.id;
      const isNewlyInstalled = !this.metadata.get(categoryID);
      if (isNewlyInstalled) {
        this.metadata.set(categoryID, { firstSeen: +/* @__PURE__ */ new Date(), stepIDs: walkthrough.steps?.map((s) => s.id) ?? [], manaullyOpened: false });
      }
      const override = await Promise.race([
        this.tasExperimentService?.getTreatment(`gettingStarted.overrideCategory.${extension.identifier.value + "." + walkthrough.id}.when`),
        new Promise((resolve) => setTimeout(() => resolve(walkthrough.when), 5e3))
      ]);
      if (this.sessionInstalledExtensions.has(extension.identifier.value.toLowerCase()) && this.contextService.contextMatchesRules(ContextKeyExpr.deserialize(override ?? walkthrough.when) ?? ContextKeyExpr.true())) {
        this.sessionInstalledExtensions.delete(extension.identifier.value.toLowerCase());
        if (index < sectionToOpenIndex && isNewlyInstalled) {
          sectionToOpen = categoryID;
          sectionToOpenIndex = index;
        }
      }
      const steps = (walkthrough.steps ?? []).map((step, index2) => {
        const description = parseDescription(step.description || "");
        const fullyQualifiedID = extension.identifier.value + "#" + walkthrough.id + "#" + step.id;
        let media;
        if (!step.media) {
          throw Error("missing media in walkthrough step: " + walkthrough.id + "@" + step.id);
        }
        if (step.media.image) {
          const altText = step.media.altText;
          if (altText === void 0) {
            console.error("Walkthrough item:", fullyQualifiedID, "is missing altText for its media element.");
          }
          media = { type: "image", altText, path: convertExtensionRelativePathsToBrowserURIs(step.media.image) };
        } else if (step.media.markdown) {
          media = {
            type: "markdown",
            path: convertExtensionPathToFileURI(step.media.markdown),
            base: convertExtensionPathToFileURI(dirname(step.media.markdown)),
            root: FileAccess.uriToFileUri(extension.extensionLocation)
          };
        } else if (step.media.svg) {
          media = {
            type: "svg",
            path: convertExtensionPathToFileURI(step.media.svg),
            altText: step.media.svg
          };
        } else if (step.media.video) {
          const baseURI = FileAccess.uriToFileUri(extension.extensionLocation);
          media = {
            type: "video",
            path: convertRelativeMediaPathsToWebviewURIs(baseURI, step.media.video),
            root: FileAccess.uriToFileUri(extension.extensionLocation),
            altText: step.media.altText,
            poster: step.media.poster ? convertRelativeMediaPathsToWebviewURIs(baseURI, step.media.poster) : void 0
          };
        } else {
          throw new Error("Unknown walkthrough format detected for " + fullyQualifiedID);
        }
        return {
          description,
          media,
          completionEvents: step.completionEvents?.filter((x) => typeof x === "string") ?? [],
          id: fullyQualifiedID,
          title: step.title,
          when: ContextKeyExpr.deserialize(step.when) ?? ContextKeyExpr.true(),
          category: categoryID,
          order: index2
        };
      });
      let isFeatured = false;
      if (walkthrough.featuredFor) {
        const folders = this.workspaceContextService.getWorkspace().folders.map((f) => f.uri);
        const token = new CancellationTokenSource();
        setTimeout(() => token.cancel(), 2e3);
        isFeatured = await this.instantiationService.invokeFunction((a) => checkGlobFileExists(a, folders, walkthrough.featuredFor, token.token));
      }
      const iconStr = walkthrough.icon ?? extension.icon;
      const walkthoughDescriptor = {
        description: walkthrough.description,
        title: walkthrough.title,
        id: categoryID,
        isFeatured,
        source: extension.displayName ?? extension.name,
        order: 0,
        walkthroughPageTitle: extension.displayName ?? extension.name,
        steps,
        icon: {
          type: "image",
          path: iconStr ? FileAccess.uriToBrowserUri(joinPath(extension.extensionLocation, iconStr)).toString(true) : DefaultIconPath
        },
        when: ContextKeyExpr.deserialize(override ?? walkthrough.when) ?? ContextKeyExpr.true()
      };
      this._registerWalkthrough(walkthoughDescriptor);
      this._onDidAddWalkthrough.fire(this.resolveWalkthrough(walkthoughDescriptor));
    }));
    this.storageService.store(walkthroughMetadataConfigurationKey, JSON.stringify([...this.metadata.entries()]), StorageScope.PROFILE, StorageTarget.USER);
    const hadLastFoucs = await this.hostService.hadLastFocus();
    if (hadLastFoucs && sectionToOpen && this.configurationService.getValue("workbench.welcomePage.walkthroughs.openOnInstall")) {
      this.telemetryService.publicLog2("gettingStarted.didAutoOpenWalkthrough", { id: sectionToOpen });
      this.commandService.executeCommand("workbench.action.openWalkthrough", sectionToOpen, {
        inactive: this.layoutService.hasFocus(Parts.EDITOR_PART)
        // do not steal the active editor away
      });
    }
  }
  unregisterExtensionWalkthroughContributions(extension) {
    if (!extension.contributes?.walkthroughs?.length) {
      return;
    }
    extension.contributes?.walkthroughs?.forEach((section) => {
      const categoryID = extension.identifier.value + "#" + section.id;
      section.steps.forEach((step) => {
        const fullyQualifiedID = extension.identifier.value + "#" + section.id + "#" + step.id;
        this.steps.delete(fullyQualifiedID);
      });
      this.gettingStartedContributions.delete(categoryID);
      this._onDidRemoveWalkthrough.fire(categoryID);
    });
  }
  getWalkthrough(id) {
    const walkthrough = this.gettingStartedContributions.get(id);
    if (!walkthrough) {
      throw Error("Trying to get unknown walkthrough: " + id);
    }
    return this.resolveWalkthrough(walkthrough);
  }
  getWalkthroughs() {
    const registeredCategories = [...this.gettingStartedContributions.values()];
    const categoriesWithCompletion = registeredCategories.map((category) => {
      return {
        ...category,
        content: {
          type: "steps",
          steps: category.steps
        }
      };
    }).filter((category) => category.content.type !== "steps" || category.content.steps.length).map((category) => this.resolveWalkthrough(category));
    return categoriesWithCompletion;
  }
  resolveWalkthrough(category) {
    const stepsWithProgress = category.steps.map((step) => this.getStepProgress(step));
    const hasOpened = this.metadata.get(category.id)?.manaullyOpened;
    const firstSeenDate = this.metadata.get(category.id)?.firstSeen;
    const isNew = firstSeenDate && firstSeenDate > +/* @__PURE__ */ new Date() - NEW_WALKTHROUGH_TIME;
    const lastStepIDs = this.metadata.get(category.id)?.stepIDs;
    const rawCategory = this.gettingStartedContributions.get(category.id);
    if (!rawCategory) {
      throw Error("Could not find walkthrough with id " + category.id);
    }
    const currentStepIds = rawCategory.steps.map((s) => s.id);
    const hasNewSteps = lastStepIDs && (currentStepIds.length !== lastStepIDs.length || currentStepIds.some((id, index) => id !== lastStepIDs[index]));
    let recencyBonus = 0;
    if (firstSeenDate) {
      const currentDate = +/* @__PURE__ */ new Date();
      const timeSinceFirstSeen = currentDate - firstSeenDate;
      recencyBonus = Math.max(0, (NEW_WALKTHROUGH_TIME - timeSinceFirstSeen) / NEW_WALKTHROUGH_TIME);
    }
    return {
      ...category,
      recencyBonus,
      steps: stepsWithProgress,
      newItems: !!hasNewSteps,
      newEntry: !!(isNew && !hasOpened)
    };
  }
  getStepProgress(step) {
    return {
      ...step,
      done: false,
      ...this.stepProgress[step.id]
    };
  }
  progressStep(id) {
    const oldProgress = this.stepProgress[id];
    if (!oldProgress || oldProgress.done !== true) {
      this.stepProgress[id] = { done: true };
      this.memento.saveMemento();
      const step = this.getStep(id);
      if (!step) {
        throw Error("Tried to progress unknown step");
      }
      this._onDidProgressStep.fire(this.getStepProgress(step));
    }
  }
  deprogressStep(id) {
    delete this.stepProgress[id];
    this.memento.saveMemento();
    const step = this.getStep(id);
    this._onDidProgressStep.fire(this.getStepProgress(step));
  }
  progressByEvent(event) {
    if (this.sessionEvents.has(event)) {
      return;
    }
    this.sessionEvents.add(event);
    this.completionListeners.get(event)?.forEach((id) => this.progressStep(id));
  }
  registerWalkthrough(walkthoughDescriptor) {
    this._registerWalkthrough({
      ...walkthoughDescriptor,
      steps: walkthoughDescriptor.steps.map((step) => ({ ...step, description: parseDescription(step.description) }))
    });
  }
  _registerWalkthrough(walkthroughDescriptor) {
    const oldCategory = this.gettingStartedContributions.get(walkthroughDescriptor.id);
    if (oldCategory) {
      console.error(`Skipping attempt to overwrite walkthrough. (${walkthroughDescriptor.id})`);
      return;
    }
    this.gettingStartedContributions.set(walkthroughDescriptor.id, walkthroughDescriptor);
    walkthroughDescriptor.steps.forEach((step) => {
      if (this.steps.has(step.id)) {
        throw Error("Attempting to register step with id " + step.id + " twice. Second is dropped.");
      }
      this.steps.set(step.id, step);
      step.when.keys().forEach((key) => this.categoryVisibilityContextKeys.add(key));
      this.registerDoneListeners(step);
    });
    walkthroughDescriptor.when.keys().forEach((key) => this.categoryVisibilityContextKeys.add(key));
  }
  registerDoneListeners(step) {
    if (step.doneOn) {
      console.error(`wakthrough step`, step, `uses deprecated 'doneOn' property. Adopt 'completionEvents' to silence this warning`);
      return;
    }
    if (!step.completionEvents.length) {
      step.completionEvents = coalesce(
        step.description.filter((linkedText) => linkedText.nodes.length === 1).flatMap((linkedText) => linkedText.nodes.filter((node) => typeof node !== "string").map(({ href }) => {
          if (href.startsWith("command:")) {
            return "onCommand:" + href.slice("command:".length, href.includes("?") ? href.indexOf("?") : void 0);
          }
          if (href.startsWith("https://") || href.startsWith("http://")) {
            return "onLink:" + href;
          }
          return void 0;
        }))
      );
    }
    if (!step.completionEvents.length) {
      step.completionEvents.push("stepSelected");
    }
    for (let event of step.completionEvents) {
      const [_, eventType, argument] = /^([^:]*):?(.*)$/.exec(event) ?? [];
      if (!eventType) {
        console.error(`Unknown completionEvent ${event} when registering step ${step.id}`);
        continue;
      }
      switch (eventType) {
        case "onLink":
        case "onEvent":
        case "onView":
        case "onSettingChanged":
          break;
        case "onContext": {
          const expression = ContextKeyExpr.deserialize(argument);
          if (expression) {
            this.stepCompletionContextKeyExpressions.add(expression);
            expression.keys().forEach((key) => this.stepCompletionContextKeys.add(key));
            event = eventType + ":" + expression.serialize();
            if (this.contextService.contextMatchesRules(expression)) {
              this.sessionEvents.add(event);
            }
          } else {
            console.error("Unable to parse context key expression:", expression, "in walkthrough step", step.id);
          }
          break;
        }
        case "onStepSelected":
        case "stepSelected":
          event = "stepSelected:" + step.id;
          break;
        case "onCommand":
          event = eventType + ":" + argument.replace(/^toSide:/, "");
          break;
        case "onExtensionInstalled":
        case "extensionInstalled":
          event = "extensionInstalled:" + argument.toLowerCase();
          break;
        default:
          console.error(`Unknown completionEvent ${event} when registering step ${step.id}`);
          continue;
      }
      this.registerCompletionListener(event, step);
    }
  }
  registerCompletionListener(event, step) {
    if (!this.completionListeners.has(event)) {
      this.completionListeners.set(event, /* @__PURE__ */ new Set());
    }
    this.completionListeners.get(event)?.add(step.id);
  }
  getStep(id) {
    const step = this.steps.get(id);
    if (!step) {
      throw Error("Attempting to access step which does not exist in registry " + id);
    }
    return step;
  }
};
WalkthroughsService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IUserDataSyncEnablementService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IExtensionManagementService),
  __decorateParam(8, IHostService),
  __decorateParam(9, IViewsService),
  __decorateParam(10, ITelemetryService),
  __decorateParam(11, IWorkbenchAssignmentService),
  __decorateParam(12, IProductService),
  __decorateParam(13, IWorkbenchLayoutService)
], WalkthroughsService);
const parseDescription = (desc) => desc.split("\n").filter((x) => x).map((text) => parseLinkedText(text));
const convertInternalMediaPathToFileURI = (path) => path.startsWith("https://") ? URI.parse(path, true) : FileAccess.asFileUri(`vs/workbench/contrib/welcomeGettingStarted/common/media/${path}`);
const convertInternalMediaPathToBrowserURI = (path) => path.startsWith("https://") ? URI.parse(path, true) : FileAccess.asBrowserUri(`vs/workbench/contrib/welcomeGettingStarted/common/media/${path}`);
const convertInternalMediaPathsToBrowserURIs = (path) => {
  if (typeof path === "string") {
    const converted = convertInternalMediaPathToBrowserURI(path);
    return { hcDark: converted, hcLight: converted, dark: converted, light: converted };
  } else {
    return {
      hcDark: convertInternalMediaPathToBrowserURI(path.hc),
      hcLight: convertInternalMediaPathToBrowserURI(path.hcLight ?? path.light),
      light: convertInternalMediaPathToBrowserURI(path.light),
      dark: convertInternalMediaPathToBrowserURI(path.dark)
    };
  }
};
const convertRelativeMediaPathsToWebviewURIs = (basePath, path) => {
  const convertPath = (path2) => path2.startsWith("https://") ? URI.parse(path2, true) : asWebviewUri(joinPath(basePath, path2));
  if (typeof path === "string") {
    const converted = convertPath(path);
    return { hcDark: converted, hcLight: converted, dark: converted, light: converted };
  } else {
    return {
      hcDark: convertPath(path.hc),
      hcLight: convertPath(path.hcLight ?? path.light),
      light: convertPath(path.light),
      dark: convertPath(path.dark)
    };
  }
};
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "resetGettingStartedProgress",
      category: localize2("developer", "Developer"),
      title: localize2("resetWelcomePageWalkthroughProgress", "Reset Welcome Page Walkthrough Progress"),
      f1: true,
      metadata: {
        description: localize2("resetGettingStartedProgressDescription", "Reset the progress of all Walkthrough steps on the Welcome Page to make them appear as if they are being viewed for the first time, providing a fresh start to the getting started experience.")
      }
    });
  }
  run(accessor) {
    const gettingStartedService = accessor.get(IWalkthroughsService);
    const storageService = accessor.get(IStorageService);
    storageService.store(
      hiddenEntriesConfigurationKey,
      JSON.stringify([]),
      StorageScope.PROFILE,
      StorageTarget.USER
    );
    storageService.store(
      walkthroughMetadataConfigurationKey,
      JSON.stringify([]),
      StorageScope.PROFILE,
      StorageTarget.USER
    );
    const memento = new Memento("gettingStartedService", accessor.get(IStorageService));
    const record = memento.getMemento(StorageScope.PROFILE, StorageTarget.USER);
    for (const key in record) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        try {
          gettingStartedService.deprogressStep(key);
        } catch (e) {
          console.error(e);
        }
      }
    }
    memento.saveMemento();
  }
});
registerSingleton(IWalkthroughsService, WalkthroughsService, InstantiationType.Delayed);
export {
  HasMultipleNewFileEntries,
  IWalkthroughsService,
  WalkthroughsService,
  convertInternalMediaPathToFileURI,
  hiddenEntriesConfigurationKey,
  parseDescription,
  walkthroughMetadataConfigurationKey
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lR2V0dGluZ1N0YXJ0ZWQvYnJvd3Nlci9nZXR0aW5nU3RhcnRlZFNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IsIElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgTWVtZW50byB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tZW1lbnRvLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBDb250ZXh0S2V5RXhwcmVzc2lvbiwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhU3luYy9jb21tb24vdXNlckRhdGFTeW5jLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIsIElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IEZpbGVBY2Nlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IEVYVEVOU0lPTl9JTlNUQUxMX0RFUF9QQUNLX0NPTlRFWFQsIEVYVEVOU0lPTl9JTlNUQUxMX1NLSVBfV0FMS1RIUk9VR0hfQ09OVEVYVCwgSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgd2Fsa3Rocm91Z2hzIH0gZnJvbSAnLi4vY29tbW9uL2dldHRpbmdTdGFydGVkQ29udGVudC5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9hc3NpZ25tZW50L2NvbW1vbi9hc3NpZ25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMaW5rLCBMaW5rZWRUZXh0LCBwYXJzZUxpbmtlZFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saW5rZWRUZXh0LmpzJztcbmltcG9ydCB7IHdhbGt0aHJvdWdoc0V4dGVuc2lvblBvaW50IH0gZnJvbSAnLi9nZXR0aW5nU3RhcnRlZEV4dGVuc2lvblBvaW50LmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgZGlybmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgY29hbGVzY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IGNoZWNrR2xvYkZpbGVFeGlzdHMgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi93b3Jrc3BhY2VDb250YWlucy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBEZWZhdWx0SWNvblBhdGggfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGFzV2Vidmlld1VyaSB9IGZyb20gJy4uLy4uL3dlYnZpZXcvY29tbW9uL3dlYnZpZXcuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UsIFBhcnRzIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5cbmV4cG9ydCBjb25zdCBIYXNNdWx0aXBsZU5ld0ZpbGVFbnRyaWVzID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2hhc011bHRpcGxlTmV3RmlsZUVudHJpZXMnLCBmYWxzZSk7XG5cbmV4cG9ydCBjb25zdCBJV2Fsa3Rocm91Z2hzU2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJV2Fsa3Rocm91Z2hzU2VydmljZT4oJ3dhbGt0aHJvdWdoc1NlcnZpY2UnKTtcblxuZXhwb3J0IGNvbnN0IGhpZGRlbkVudHJpZXNDb25maWd1cmF0aW9uS2V5ID0gJ3dvcmtiZW5jaC53ZWxjb21lUGFnZS5oaWRkZW5DYXRlZ29yaWVzJztcblxuZXhwb3J0IGNvbnN0IHdhbGt0aHJvdWdoTWV0YWRhdGFDb25maWd1cmF0aW9uS2V5ID0gJ3dvcmtiZW5jaC53ZWxjb21lUGFnZS53YWxrdGhyb3VnaE1ldGFkYXRhJztcbmV4cG9ydCB0eXBlIFdhbGt0aHJvdWdoTWV0YURhdGFUeXBlID0gTWFwPHN0cmluZywgeyBmaXJzdFNlZW46IG51bWJlcjsgc3RlcElEczogc3RyaW5nW107IG1hbmF1bGx5T3BlbmVkOiBib29sZWFuIH0+O1xuXG5jb25zdCBCVUlMVF9JTl9TT1VSQ0UgPSBsb2NhbGl6ZSgnYnVpbHRpbicsIFwiQnVpbHQtSW5cIik7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdhbGt0aHJvdWdoIHtcblx0aWQ6IHN0cmluZztcblx0dGl0bGU6IHN0cmluZztcblx0ZGVzY3JpcHRpb246IHN0cmluZztcblx0b3JkZXI6IG51bWJlcjtcblx0c291cmNlOiBzdHJpbmc7XG5cdGlzRmVhdHVyZWQ6IGJvb2xlYW47XG5cdG5leHQ/OiBzdHJpbmc7XG5cdHdoZW46IENvbnRleHRLZXlFeHByZXNzaW9uO1xuXHRzdGVwczogSVdhbGt0aHJvdWdoU3RlcFtdO1xuXHRpY29uOlxuXHR8IHsgdHlwZTogJ2ljb24nOyBpY29uOiBUaGVtZUljb24gfVxuXHR8IHsgdHlwZTogJ2ltYWdlJzsgcGF0aDogc3RyaW5nIH07XG5cdHdhbGt0aHJvdWdoUGFnZVRpdGxlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIElXYWxrdGhyb3VnaExvb3NlID0gT21pdDxJV2Fsa3Rocm91Z2gsICdzdGVwcyc+ICYgeyBzdGVwczogKE9taXQ8SVdhbGt0aHJvdWdoU3RlcCwgJ2Rlc2NyaXB0aW9uJz4gJiB7IGRlc2NyaXB0aW9uOiBzdHJpbmcgfSlbXSB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIElSZXNvbHZlZFdhbGt0aHJvdWdoIGV4dGVuZHMgSVdhbGt0aHJvdWdoIHtcblx0c3RlcHM6IElSZXNvbHZlZFdhbGt0aHJvdWdoU3RlcFtdO1xuXHRuZXdJdGVtczogYm9vbGVhbjtcblx0cmVjZW5jeUJvbnVzOiBudW1iZXI7XG5cdG5ld0VudHJ5OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElXYWxrdGhyb3VnaFN0ZXAge1xuXHRpZDogc3RyaW5nO1xuXHR0aXRsZTogc3RyaW5nO1xuXHRkZXNjcmlwdGlvbjogTGlua2VkVGV4dFtdO1xuXHRjYXRlZ29yeTogc3RyaW5nO1xuXHR3aGVuOiBDb250ZXh0S2V5RXhwcmVzc2lvbjtcblx0b3JkZXI6IG51bWJlcjtcblx0Y29tcGxldGlvbkV2ZW50czogc3RyaW5nW107XG5cdG1lZGlhOlxuXHR8IHsgdHlwZTogJ2ltYWdlJzsgcGF0aDogeyBoY0Rhcms6IFVSSTsgaGNMaWdodDogVVJJOyBsaWdodDogVVJJOyBkYXJrOiBVUkkgfTsgYWx0VGV4dDogc3RyaW5nIH1cblx0fCB7IHR5cGU6ICdzdmcnOyBwYXRoOiBVUkk7IGFsdFRleHQ6IHN0cmluZyB9XG5cdHwgeyB0eXBlOiAnbWFya2Rvd24nOyBwYXRoOiBVUkk7IGJhc2U6IFVSSTsgcm9vdDogVVJJIH1cblx0fCB7IHR5cGU6ICd2aWRlbyc7IHBhdGg6IHsgaGNEYXJrOiBVUkk7IGhjTGlnaHQ6IFVSSTsgbGlnaHQ6IFVSSTsgZGFyazogVVJJIH07IHBvc3Rlcj86IHsgaGNEYXJrOiBVUkk7IGhjTGlnaHQ6IFVSSTsgbGlnaHQ6IFVSSTsgZGFyazogVVJJIH07IHJvb3Q6IFVSSTsgYWx0VGV4dDogc3RyaW5nIH07XG59XG5cbnR5cGUgU3RlcFByb2dyZXNzID0geyBkb25lOiBib29sZWFuIH07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlc29sdmVkV2Fsa3Rocm91Z2hTdGVwIGV4dGVuZHMgSVdhbGt0aHJvdWdoU3RlcCwgU3RlcFByb2dyZXNzIHsgfVxuXG5leHBvcnQgaW50ZXJmYWNlIElXYWxrdGhyb3VnaHNTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHJlYWRvbmx5IG9uRGlkQWRkV2Fsa3Rocm91Z2g6IEV2ZW50PElSZXNvbHZlZFdhbGt0aHJvdWdoPjtcblx0cmVhZG9ubHkgb25EaWRSZW1vdmVXYWxrdGhyb3VnaDogRXZlbnQ8c3RyaW5nPjtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VXYWxrdGhyb3VnaDogRXZlbnQ8SVJlc29sdmVkV2Fsa3Rocm91Z2g+O1xuXHRyZWFkb25seSBvbkRpZFByb2dyZXNzU3RlcDogRXZlbnQ8SVJlc29sdmVkV2Fsa3Rocm91Z2hTdGVwPjtcblxuXHRnZXRXYWxrdGhyb3VnaHMoKTogSVJlc29sdmVkV2Fsa3Rocm91Z2hbXTtcblx0Z2V0V2Fsa3Rocm91Z2goaWQ6IHN0cmluZyk6IElSZXNvbHZlZFdhbGt0aHJvdWdoO1xuXG5cdHJlZ2lzdGVyV2Fsa3Rocm91Z2goZGVzY3JpcHRvcjogSVdhbGt0aHJvdWdoTG9vc2UpOiB2b2lkO1xuXG5cdHByb2dyZXNzQnlFdmVudChldmVudE5hbWU6IHN0cmluZyk6IHZvaWQ7XG5cdHByb2dyZXNzU3RlcChpZDogc3RyaW5nKTogdm9pZDtcblx0ZGVwcm9ncmVzc1N0ZXAoaWQ6IHN0cmluZyk6IHZvaWQ7XG5cblx0bWFya1dhbGt0aHJvdWdoT3BlbmVkKGlkOiBzdHJpbmcpOiB2b2lkO1xufVxuXG4vLyBTaG93IHdhbGt0aHJvdWdoIGFzIFwibmV3XCIgZm9yIDcgZGF5cyBhZnRlciBmaXJzdCBpbnN0YWxsXG5jb25zdCBEQVlTID0gMjQgKiA2MCAqIDYwICogMTAwMDtcbmNvbnN0IE5FV19XQUxLVEhST1VHSF9USU1FID0gNyAqIERBWVM7XG5cbmV4cG9ydCBjbGFzcyBXYWxrdGhyb3VnaHNTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXYWxrdGhyb3VnaHNTZXJ2aWNlIHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRBZGRXYWxrdGhyb3VnaCA9IG5ldyBFbWl0dGVyPElSZXNvbHZlZFdhbGt0aHJvdWdoPigpO1xuXHRyZWFkb25seSBvbkRpZEFkZFdhbGt0aHJvdWdoOiBFdmVudDxJUmVzb2x2ZWRXYWxrdGhyb3VnaD4gPSB0aGlzLl9vbkRpZEFkZFdhbGt0aHJvdWdoLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlbW92ZVdhbGt0aHJvdWdoID0gbmV3IEVtaXR0ZXI8c3RyaW5nPigpO1xuXHRyZWFkb25seSBvbkRpZFJlbW92ZVdhbGt0aHJvdWdoOiBFdmVudDxzdHJpbmc+ID0gdGhpcy5fb25EaWRSZW1vdmVXYWxrdGhyb3VnaC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VXYWxrdGhyb3VnaCA9IG5ldyBFbWl0dGVyPElSZXNvbHZlZFdhbGt0aHJvdWdoPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVdhbGt0aHJvdWdoOiBFdmVudDxJUmVzb2x2ZWRXYWxrdGhyb3VnaD4gPSB0aGlzLl9vbkRpZENoYW5nZVdhbGt0aHJvdWdoLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFByb2dyZXNzU3RlcCA9IG5ldyBFbWl0dGVyPElSZXNvbHZlZFdhbGt0aHJvdWdoU3RlcD4oKTtcblx0cmVhZG9ubHkgb25EaWRQcm9ncmVzc1N0ZXA6IEV2ZW50PElSZXNvbHZlZFdhbGt0aHJvdWdoU3RlcD4gPSB0aGlzLl9vbkRpZFByb2dyZXNzU3RlcC5ldmVudDtcblxuXHRwcml2YXRlIG1lbWVudG86IE1lbWVudG87XG5cdHByaXZhdGUgc3RlcFByb2dyZXNzOiBSZWNvcmQ8c3RyaW5nLCBTdGVwUHJvZ3Jlc3MgfCB1bmRlZmluZWQ+O1xuXG5cdHByaXZhdGUgc2Vzc2lvbkV2ZW50cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRwcml2YXRlIGNvbXBsZXRpb25MaXN0ZW5lcnMgPSBuZXcgTWFwPHN0cmluZywgU2V0PHN0cmluZz4+KCk7XG5cblx0cHJpdmF0ZSBnZXR0aW5nU3RhcnRlZENvbnRyaWJ1dGlvbnMgPSBuZXcgTWFwPHN0cmluZywgSVdhbGt0aHJvdWdoPigpO1xuXHRwcml2YXRlIHN0ZXBzID0gbmV3IE1hcDxzdHJpbmcsIElXYWxrdGhyb3VnaFN0ZXA+KCk7XG5cblx0cHJpdmF0ZSBzZXNzaW9uSW5zdGFsbGVkRXh0ZW5zaW9uczogU2V0PHN0cmluZz4gPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuXHRwcml2YXRlIGNhdGVnb3J5VmlzaWJpbGl0eUNvbnRleHRLZXlzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdHByaXZhdGUgc3RlcENvbXBsZXRpb25Db250ZXh0S2V5RXhwcmVzc2lvbnMgPSBuZXcgU2V0PENvbnRleHRLZXlFeHByZXNzaW9uPigpO1xuXHRwcml2YXRlIHN0ZXBDb21wbGV0aW9uQ29udGV4dEtleXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuXHRwcml2YXRlIG1ldGFkYXRhOiBXYWxrdGhyb3VnaE1ldGFEYXRhVHlwZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2U6IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVZpZXdzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHZpZXdzU2VydmljZTogSVZpZXdzU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEFzc2lnbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGFzRXhwZXJpbWVudFNlcnZpY2U6IElXb3JrYmVuY2hBc3NpZ25tZW50U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMubWV0YWRhdGEgPSBuZXcgTWFwKFxuXHRcdFx0SlNPTi5wYXJzZShcblx0XHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5nZXQod2Fsa3Rocm91Z2hNZXRhZGF0YUNvbmZpZ3VyYXRpb25LZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCAnW10nKSkpO1xuXG5cdFx0dGhpcy5tZW1lbnRvID0gbmV3IE1lbWVudG8oJ2dldHRpbmdTdGFydGVkU2VydmljZScsIHRoaXMuc3RvcmFnZVNlcnZpY2UpO1xuXHRcdHRoaXMuc3RlcFByb2dyZXNzID0gdGhpcy5tZW1lbnRvLmdldE1lbWVudG8oU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cblx0XHR0aGlzLmluaXRDb21wbGV0aW9uRXZlbnRMaXN0ZW5lcnMoKTtcblxuXHRcdEhhc011bHRpcGxlTmV3RmlsZUVudHJpZXMuYmluZFRvKHRoaXMuY29udGV4dFNlcnZpY2UpLnNldChmYWxzZSk7XG5cdFx0dGhpcy5yZWdpc3RlcldhbGt0aHJvdWdocygpO1xuXG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyV2Fsa3Rocm91Z2hzKCkge1xuXG5cdFx0d2Fsa3Rocm91Z2hzLmZvckVhY2goYXN5bmMgKGNhdGVnb3J5LCBpbmRleCkgPT4ge1xuXG5cdFx0XHR0aGlzLl9yZWdpc3RlcldhbGt0aHJvdWdoKHtcblx0XHRcdFx0Li4uY2F0ZWdvcnksXG5cdFx0XHRcdGljb246IHsgdHlwZTogJ2ljb24nLCBpY29uOiBjYXRlZ29yeS5pY29uIH0sXG5cdFx0XHRcdG9yZGVyOiB3YWxrdGhyb3VnaHMubGVuZ3RoIC0gaW5kZXgsXG5cdFx0XHRcdHNvdXJjZTogQlVJTFRfSU5fU09VUkNFLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShjYXRlZ29yeS53aGVuKSA/PyBDb250ZXh0S2V5RXhwci50cnVlKCksXG5cdFx0XHRcdHN0ZXBzOlxuXHRcdFx0XHRcdGNhdGVnb3J5LmNvbnRlbnQuc3RlcHMubWFwKChzdGVwLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRcdFx0cmV0dXJuICh7XG5cdFx0XHRcdFx0XHRcdC4uLnN0ZXAsXG5cdFx0XHRcdFx0XHRcdGNvbXBsZXRpb25FdmVudHM6IHN0ZXAuY29tcGxldGlvbkV2ZW50cyA/PyBbXSxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IHBhcnNlRGVzY3JpcHRpb24oc3RlcC5kZXNjcmlwdGlvbiksXG5cdFx0XHRcdFx0XHRcdGNhdGVnb3J5OiBjYXRlZ29yeS5pZCxcblx0XHRcdFx0XHRcdFx0b3JkZXI6IGluZGV4LFxuXHRcdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShzdGVwLndoZW4pID8/IENvbnRleHRLZXlFeHByLnRydWUoKSxcblx0XHRcdFx0XHRcdFx0bWVkaWE6IHN0ZXAubWVkaWEudHlwZSA9PT0gJ2ltYWdlJ1xuXHRcdFx0XHRcdFx0XHRcdD8ge1xuXHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ2ltYWdlJyxcblx0XHRcdFx0XHRcdFx0XHRcdGFsdFRleHQ6IHN0ZXAubWVkaWEuYWx0VGV4dCxcblx0XHRcdFx0XHRcdFx0XHRcdHBhdGg6IGNvbnZlcnRJbnRlcm5hbE1lZGlhUGF0aHNUb0Jyb3dzZXJVUklzKHN0ZXAubWVkaWEucGF0aClcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0OiBzdGVwLm1lZGlhLnR5cGUgPT09ICdzdmcnXG5cdFx0XHRcdFx0XHRcdFx0XHQ/IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N2ZycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGFsdFRleHQ6IHN0ZXAubWVkaWEuYWx0VGV4dCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0cGF0aDogY29udmVydEludGVybmFsTWVkaWFQYXRoVG9GaWxlVVJJKHN0ZXAubWVkaWEucGF0aCkud2l0aCh7IHF1ZXJ5OiBKU09OLnN0cmluZ2lmeSh7IG1vZHVsZUlkOiAndnMvd29ya2JlbmNoL2NvbnRyaWIvd2VsY29tZUdldHRpbmdTdGFydGVkL2NvbW1vbi9tZWRpYS8nICsgc3RlcC5tZWRpYS5wYXRoIH0pIH0pXG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHQ6IHN0ZXAubWVkaWEudHlwZSA9PT0gJ21hcmtkb3duJ1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQ/IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnbWFya2Rvd24nLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHBhdGg6IGNvbnZlcnRJbnRlcm5hbE1lZGlhUGF0aFRvRmlsZVVSSShzdGVwLm1lZGlhLnBhdGgpLndpdGgoeyBxdWVyeTogSlNPTi5zdHJpbmdpZnkoeyBtb2R1bGVJZDogJ3ZzL3dvcmtiZW5jaC9jb250cmliL3dlbGNvbWVHZXR0aW5nU3RhcnRlZC9jb21tb24vbWVkaWEvJyArIHN0ZXAubWVkaWEucGF0aCB9KSB9KSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRiYXNlOiBGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvd29ya2JlbmNoL2NvbnRyaWIvd2VsY29tZUdldHRpbmdTdGFydGVkL2NvbW1vbi9tZWRpYS8nKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRyb290OiBGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvd29ya2JlbmNoL2NvbnRyaWIvd2VsY29tZUdldHRpbmdTdGFydGVkL2NvbW1vbi9tZWRpYS8nKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHQ6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAndmlkZW8nLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHBhdGg6IGNvbnZlcnRSZWxhdGl2ZU1lZGlhUGF0aHNUb1dlYnZpZXdVUklzKEZpbGVBY2Nlc3MuYXNGaWxlVXJpKCd2cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lR2V0dGluZ1N0YXJ0ZWQvY29tbW9uL21lZGlhLycpLCBzdGVwLm1lZGlhLnBhdGgpLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGFsdFRleHQ6IHN0ZXAubWVkaWEuYWx0VGV4dCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRyb290OiBGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvd29ya2JlbmNoL2NvbnRyaWIvd2VsY29tZUdldHRpbmdTdGFydGVkL2NvbW1vbi9tZWRpYS8nKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRwb3N0ZXI6IHN0ZXAubWVkaWEucG9zdGVyID8gY29udmVydFJlbGF0aXZlTWVkaWFQYXRoc1RvV2Vidmlld1VSSXMoRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoJ3ZzL3dvcmtiZW5jaC9jb250cmliL3dlbGNvbWVHZXR0aW5nU3RhcnRlZC9jb21tb24vbWVkaWEvJyksIHN0ZXAubWVkaWEucG9zdGVyKSA6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0d2Fsa3Rocm91Z2hzRXh0ZW5zaW9uUG9pbnQuc2V0SGFuZGxlcigoXywgeyBhZGRlZCwgcmVtb3ZlZCB9KSA9PiB7XG5cdFx0XHRhZGRlZC5tYXAoZSA9PiB0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uV2Fsa3Rocm91Z2hDb250cmlidXRpb25zKGUuZGVzY3JpcHRpb24pKTtcblx0XHRcdHJlbW92ZWQubWFwKGUgPT4gdGhpcy51bnJlZ2lzdGVyRXh0ZW5zaW9uV2Fsa3Rocm91Z2hDb250cmlidXRpb25zKGUuZGVzY3JpcHRpb24pKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgaW5pdENvbXBsZXRpb25FdmVudExpc3RlbmVycygpIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbW1hbmRTZXJ2aWNlLm9uRGlkRXhlY3V0ZUNvbW1hbmQoY29tbWFuZCA9PiB0aGlzLnByb2dyZXNzQnlFdmVudChgb25Db21tYW5kOiR7Y29tbWFuZC5jb21tYW5kSWR9YCkpKTtcblxuXHRcdHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0SW5zdGFsbGVkKCkudGhlbihpbnN0YWxsZWQgPT4ge1xuXHRcdFx0aW5zdGFsbGVkLmZvckVhY2goZXh0ID0+IHRoaXMucHJvZ3Jlc3NCeUV2ZW50KGBleHRlbnNpb25JbnN0YWxsZWQ6JHtleHQuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpfWApKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2Uub25EaWRJbnN0YWxsRXh0ZW5zaW9ucygocmVzdWx0KSA9PiB7XG5cblx0XHRcdGlmIChyZXN1bHQuc29tZShlID0+IEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKHRoaXMucHJvZHVjdFNlcnZpY2UuZGVmYXVsdENoYXRBZ2VudD8uZXh0ZW5zaW9uSWQsIGUuaWRlbnRpZmllci5pZCkgJiYgIWU/LmNvbnRleHQ/LltFWFRFTlNJT05fSU5TVEFMTF9TS0lQX1dBTEtUSFJPVUdIX0NPTlRFWFRdKSkge1xuXHRcdFx0XHRyZXN1bHQuZm9yRWFjaChlID0+IHtcblx0XHRcdFx0XHR0aGlzLnNlc3Npb25JbnN0YWxsZWRFeHRlbnNpb25zLmFkZChlLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRcdFx0dGhpcy5wcm9ncmVzc0J5RXZlbnQoYGV4dGVuc2lvbkluc3RhbGxlZDoke2UuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpfWApO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IGUgb2YgcmVzdWx0KSB7XG5cdFx0XHRcdGNvbnN0IHNraXBXYWxrdGhyb3VnaCA9IGU/LmNvbnRleHQ/LltFWFRFTlNJT05fSU5TVEFMTF9TS0lQX1dBTEtUSFJPVUdIX0NPTlRFWFRdIHx8IGU/LmNvbnRleHQ/LltFWFRFTlNJT05fSU5TVEFMTF9ERVBfUEFDS19DT05URVhUXTtcblx0XHRcdFx0Ly8gSWYgdGhlIHdpbmRvdyBoYWQgbGFzdCBmb2N1cyBhbmQgdGhlIGluc3RhbGwgZGlkbid0IHNwZWNpZnkgdG8gc2tpcCB0aGUgd2Fsa3Rocm91Z2hcblx0XHRcdFx0Ly8gVGhlbiBhZGQgaXQgdG8gdGhlIHNlc3Npb25JbnN0YWxsRXh0ZW5zaW9ucyB0byBiZSBvcGVuZWRcblx0XHRcdFx0aWYgKCFza2lwV2Fsa3Rocm91Z2gpIHtcblx0XHRcdFx0XHR0aGlzLnNlc3Npb25JbnN0YWxsZWRFeHRlbnNpb25zLmFkZChlLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5wcm9ncmVzc0J5RXZlbnQoYGV4dGVuc2lvbkluc3RhbGxlZDoke2UuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpfWApO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29udGV4dFNlcnZpY2Uub25EaWRDaGFuZ2VDb250ZXh0KGV2ZW50ID0+IHtcblx0XHRcdGlmIChldmVudC5hZmZlY3RzU29tZSh0aGlzLnN0ZXBDb21wbGV0aW9uQ29udGV4dEtleXMpKSB7XG5cdFx0XHRcdHRoaXMuc3RlcENvbXBsZXRpb25Db250ZXh0S2V5RXhwcmVzc2lvbnMuZm9yRWFjaChleHByZXNzaW9uID0+IHtcblx0XHRcdFx0XHRpZiAoZXZlbnQuYWZmZWN0c1NvbWUobmV3IFNldChleHByZXNzaW9uLmtleXMoKSkpICYmIHRoaXMuY29udGV4dFNlcnZpY2UuY29udGV4dE1hdGNoZXNSdWxlcyhleHByZXNzaW9uKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5wcm9ncmVzc0J5RXZlbnQoYG9uQ29udGV4dDpgICsgZXhwcmVzc2lvbi5zZXJpYWxpemUoKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnZpZXdzU2VydmljZS5vbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5KGUgPT4ge1xuXHRcdFx0aWYgKGUudmlzaWJsZSkgeyB0aGlzLnByb2dyZXNzQnlFdmVudCgnb25WaWV3OicgKyBlLmlkKTsgfVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0ZS5hZmZlY3RlZEtleXMuZm9yRWFjaChrZXkgPT4geyB0aGlzLnByb2dyZXNzQnlFdmVudCgnb25TZXR0aW5nQ2hhbmdlZDonICsga2V5KTsgfSk7XG5cdFx0fSkpO1xuXG5cdFx0aWYgKHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKCkpIHsgdGhpcy5wcm9ncmVzc0J5RXZlbnQoJ29uRXZlbnQ6c3luYy1lbmFibGVkJyk7IH1cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlRW5hYmxlbWVudCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQoKSkgeyB0aGlzLnByb2dyZXNzQnlFdmVudCgnb25FdmVudDpzeW5jLWVuYWJsZWQnKTsgfVxuXHRcdH0pKTtcblx0fVxuXG5cdG1hcmtXYWxrdGhyb3VnaE9wZW5lZChpZDogc3RyaW5nKSB7XG5cdFx0Y29uc3Qgd2Fsa3Rocm91Z2ggPSB0aGlzLmdldHRpbmdTdGFydGVkQ29udHJpYnV0aW9ucy5nZXQoaWQpO1xuXHRcdGNvbnN0IHByaW9yID0gdGhpcy5tZXRhZGF0YS5nZXQoaWQpO1xuXHRcdGlmIChwcmlvciAmJiB3YWxrdGhyb3VnaCkge1xuXHRcdFx0dGhpcy5tZXRhZGF0YS5zZXQoaWQsIHsgLi4ucHJpb3IsIG1hbmF1bGx5T3BlbmVkOiB0cnVlLCBzdGVwSURzOiB3YWxrdGhyb3VnaC5zdGVwcy5tYXAocyA9PiBzLmlkKSB9KTtcblx0XHR9XG5cblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKHdhbGt0aHJvdWdoTWV0YWRhdGFDb25maWd1cmF0aW9uS2V5LCBKU09OLnN0cmluZ2lmeShbLi4udGhpcy5tZXRhZGF0YS5lbnRyaWVzKCldKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlZ2lzdGVyRXh0ZW5zaW9uV2Fsa3Rocm91Z2hDb250cmlidXRpb25zKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKSB7XG5cdFx0Y29uc3QgY29udmVydEV4dGVuc2lvblBhdGhUb0ZpbGVVUkkgPSAocGF0aDogc3RyaW5nKSA9PiBwYXRoLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJylcblx0XHRcdD8gVVJJLnBhcnNlKHBhdGgsIHRydWUpXG5cdFx0XHQ6IEZpbGVBY2Nlc3MudXJpVG9GaWxlVXJpKGpvaW5QYXRoKGV4dGVuc2lvbi5leHRlbnNpb25Mb2NhdGlvbiwgcGF0aCkpO1xuXG5cdFx0Y29uc3QgY29udmVydEV4dGVuc2lvblJlbGF0aXZlUGF0aHNUb0Jyb3dzZXJVUklzID0gKHBhdGg6IHN0cmluZyB8IHsgaGM6IHN0cmluZzsgaGNMaWdodD86IHN0cmluZzsgZGFyazogc3RyaW5nOyBsaWdodDogc3RyaW5nIH0pOiB7IGhjRGFyazogVVJJOyBoY0xpZ2h0OiBVUkk7IGRhcms6IFVSSTsgbGlnaHQ6IFVSSSB9ID0+IHtcblx0XHRcdGNvbnN0IGNvbnZlcnRQYXRoID0gKHBhdGg6IHN0cmluZykgPT4gcGF0aC5zdGFydHNXaXRoKCdodHRwczovLycpXG5cdFx0XHRcdD8gVVJJLnBhcnNlKHBhdGgsIHRydWUpXG5cdFx0XHRcdDogRmlsZUFjY2Vzcy51cmlUb0Jyb3dzZXJVcmkoam9pblBhdGgoZXh0ZW5zaW9uLmV4dGVuc2lvbkxvY2F0aW9uLCBwYXRoKSk7XG5cblx0XHRcdGlmICh0eXBlb2YgcGF0aCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Y29uc3QgY29udmVydGVkID0gY29udmVydFBhdGgocGF0aCk7XG5cdFx0XHRcdHJldHVybiB7IGhjRGFyazogY29udmVydGVkLCBoY0xpZ2h0OiBjb252ZXJ0ZWQsIGRhcms6IGNvbnZlcnRlZCwgbGlnaHQ6IGNvbnZlcnRlZCB9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRoY0Rhcms6IGNvbnZlcnRQYXRoKHBhdGguaGMpLFxuXHRcdFx0XHRcdGhjTGlnaHQ6IGNvbnZlcnRQYXRoKHBhdGguaGNMaWdodCA/PyBwYXRoLmxpZ2h0KSxcblx0XHRcdFx0XHRsaWdodDogY29udmVydFBhdGgocGF0aC5saWdodCksXG5cdFx0XHRcdFx0ZGFyazogY29udmVydFBhdGgocGF0aC5kYXJrKVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRpZiAoIShleHRlbnNpb24uY29udHJpYnV0ZXM/LndhbGt0aHJvdWdocz8ubGVuZ3RoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBzZWN0aW9uVG9PcGVuOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHNlY3Rpb25Ub09wZW5JbmRleCA9IE1hdGgubWluKCk7IC8vICcrSW5maW5pdHknO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKGV4dGVuc2lvbi5jb250cmlidXRlcz8ud2Fsa3Rocm91Z2hzPy5tYXAoYXN5bmMgKHdhbGt0aHJvdWdoLCBpbmRleCkgPT4ge1xuXHRcdFx0Y29uc3QgY2F0ZWdvcnlJRCA9IGV4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlICsgJyMnICsgd2Fsa3Rocm91Z2guaWQ7XG5cblx0XHRcdGNvbnN0IGlzTmV3bHlJbnN0YWxsZWQgPSAhdGhpcy5tZXRhZGF0YS5nZXQoY2F0ZWdvcnlJRCk7XG5cdFx0XHRpZiAoaXNOZXdseUluc3RhbGxlZCkge1xuXHRcdFx0XHR0aGlzLm1ldGFkYXRhLnNldChjYXRlZ29yeUlELCB7IGZpcnN0U2VlbjogK25ldyBEYXRlKCksIHN0ZXBJRHM6IHdhbGt0aHJvdWdoLnN0ZXBzPy5tYXAocyA9PiBzLmlkKSA/PyBbXSwgbWFuYXVsbHlPcGVuZWQ6IGZhbHNlIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBvdmVycmlkZSA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHRcdHRoaXMudGFzRXhwZXJpbWVudFNlcnZpY2U/LmdldFRyZWF0bWVudDxzdHJpbmc+KGBnZXR0aW5nU3RhcnRlZC5vdmVycmlkZUNhdGVnb3J5LiR7ZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWUgKyAnLicgKyB3YWxrdGhyb3VnaC5pZH0ud2hlbmApLFxuXHRcdFx0XHRuZXcgUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+KHJlc29sdmUgPT4gc2V0VGltZW91dCgoKSA9PiByZXNvbHZlKHdhbGt0aHJvdWdoLndoZW4pLCA1MDAwKSlcblx0XHRcdF0pO1xuXG5cdFx0XHRpZiAodGhpcy5zZXNzaW9uSW5zdGFsbGVkRXh0ZW5zaW9ucy5oYXMoZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWUudG9Mb3dlckNhc2UoKSlcblx0XHRcdFx0JiYgdGhpcy5jb250ZXh0U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKG92ZXJyaWRlID8/IHdhbGt0aHJvdWdoLndoZW4pID8/IENvbnRleHRLZXlFeHByLnRydWUoKSlcblx0XHRcdCkge1xuXHRcdFx0XHR0aGlzLnNlc3Npb25JbnN0YWxsZWRFeHRlbnNpb25zLmRlbGV0ZShleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZS50b0xvd2VyQ2FzZSgpKTtcblx0XHRcdFx0aWYgKGluZGV4IDwgc2VjdGlvblRvT3BlbkluZGV4ICYmIGlzTmV3bHlJbnN0YWxsZWQpIHtcblx0XHRcdFx0XHRzZWN0aW9uVG9PcGVuID0gY2F0ZWdvcnlJRDtcblx0XHRcdFx0XHRzZWN0aW9uVG9PcGVuSW5kZXggPSBpbmRleDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzdGVwcyA9ICh3YWxrdGhyb3VnaC5zdGVwcyA/PyBbXSkubWFwKChzdGVwLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRjb25zdCBkZXNjcmlwdGlvbiA9IHBhcnNlRGVzY3JpcHRpb24oc3RlcC5kZXNjcmlwdGlvbiB8fCAnJyk7XG5cdFx0XHRcdGNvbnN0IGZ1bGx5UXVhbGlmaWVkSUQgPSBleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSArICcjJyArIHdhbGt0aHJvdWdoLmlkICsgJyMnICsgc3RlcC5pZDtcblxuXHRcdFx0XHRsZXQgbWVkaWE6IElXYWxrdGhyb3VnaFN0ZXBbJ21lZGlhJ107XG5cblx0XHRcdFx0aWYgKCFzdGVwLm1lZGlhKSB7XG5cdFx0XHRcdFx0dGhyb3cgRXJyb3IoJ21pc3NpbmcgbWVkaWEgaW4gd2Fsa3Rocm91Z2ggc3RlcDogJyArIHdhbGt0aHJvdWdoLmlkICsgJ0AnICsgc3RlcC5pZCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoc3RlcC5tZWRpYS5pbWFnZSkge1xuXHRcdFx0XHRcdGNvbnN0IGFsdFRleHQgPSBzdGVwLm1lZGlhLmFsdFRleHQ7XG5cdFx0XHRcdFx0aWYgKGFsdFRleHQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcignV2Fsa3Rocm91Z2ggaXRlbTonLCBmdWxseVF1YWxpZmllZElELCAnaXMgbWlzc2luZyBhbHRUZXh0IGZvciBpdHMgbWVkaWEgZWxlbWVudC4nKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bWVkaWEgPSB7IHR5cGU6ICdpbWFnZScsIGFsdFRleHQsIHBhdGg6IGNvbnZlcnRFeHRlbnNpb25SZWxhdGl2ZVBhdGhzVG9Ccm93c2VyVVJJcyhzdGVwLm1lZGlhLmltYWdlKSB9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKHN0ZXAubWVkaWEubWFya2Rvd24pIHtcblx0XHRcdFx0XHRtZWRpYSA9IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdtYXJrZG93bicsXG5cdFx0XHRcdFx0XHRwYXRoOiBjb252ZXJ0RXh0ZW5zaW9uUGF0aFRvRmlsZVVSSShzdGVwLm1lZGlhLm1hcmtkb3duKSxcblx0XHRcdFx0XHRcdGJhc2U6IGNvbnZlcnRFeHRlbnNpb25QYXRoVG9GaWxlVVJJKGRpcm5hbWUoc3RlcC5tZWRpYS5tYXJrZG93bikpLFxuXHRcdFx0XHRcdFx0cm9vdDogRmlsZUFjY2Vzcy51cmlUb0ZpbGVVcmkoZXh0ZW5zaW9uLmV4dGVuc2lvbkxvY2F0aW9uKSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKHN0ZXAubWVkaWEuc3ZnKSB7XG5cdFx0XHRcdFx0bWVkaWEgPSB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3ZnJyxcblx0XHRcdFx0XHRcdHBhdGg6IGNvbnZlcnRFeHRlbnNpb25QYXRoVG9GaWxlVVJJKHN0ZXAubWVkaWEuc3ZnKSxcblx0XHRcdFx0XHRcdGFsdFRleHQ6IHN0ZXAubWVkaWEuc3ZnLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSBpZiAoc3RlcC5tZWRpYS52aWRlbykge1xuXHRcdFx0XHRcdGNvbnN0IGJhc2VVUkkgPSBGaWxlQWNjZXNzLnVyaVRvRmlsZVVyaShleHRlbnNpb24uZXh0ZW5zaW9uTG9jYXRpb24pO1xuXHRcdFx0XHRcdG1lZGlhID0ge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3ZpZGVvJyxcblx0XHRcdFx0XHRcdHBhdGg6IGNvbnZlcnRSZWxhdGl2ZU1lZGlhUGF0aHNUb1dlYnZpZXdVUklzKGJhc2VVUkksIHN0ZXAubWVkaWEudmlkZW8pLFxuXHRcdFx0XHRcdFx0cm9vdDogRmlsZUFjY2Vzcy51cmlUb0ZpbGVVcmkoZXh0ZW5zaW9uLmV4dGVuc2lvbkxvY2F0aW9uKSxcblx0XHRcdFx0XHRcdGFsdFRleHQ6IHN0ZXAubWVkaWEuYWx0VGV4dCxcblx0XHRcdFx0XHRcdHBvc3Rlcjogc3RlcC5tZWRpYS5wb3N0ZXIgPyBjb252ZXJ0UmVsYXRpdmVNZWRpYVBhdGhzVG9XZWJ2aWV3VVJJcyhiYXNlVVJJLCBzdGVwLm1lZGlhLnBvc3RlcikgOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gVGhyb3cgZXJyb3IgZm9yIHVua25vd24gd2Fsa3Rocm91Z2ggZm9ybWF0XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignVW5rbm93biB3YWxrdGhyb3VnaCBmb3JtYXQgZGV0ZWN0ZWQgZm9yICcgKyBmdWxseVF1YWxpZmllZElEKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiAoe1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uLFxuXHRcdFx0XHRcdG1lZGlhLFxuXHRcdFx0XHRcdGNvbXBsZXRpb25FdmVudHM6IHN0ZXAuY29tcGxldGlvbkV2ZW50cz8uZmlsdGVyKHggPT4gdHlwZW9mIHggPT09ICdzdHJpbmcnKSA/PyBbXSxcblx0XHRcdFx0XHRpZDogZnVsbHlRdWFsaWZpZWRJRCxcblx0XHRcdFx0XHR0aXRsZTogc3RlcC50aXRsZSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShzdGVwLndoZW4pID8/IENvbnRleHRLZXlFeHByLnRydWUoKSxcblx0XHRcdFx0XHRjYXRlZ29yeTogY2F0ZWdvcnlJRCxcblx0XHRcdFx0XHRvcmRlcjogaW5kZXgsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdGxldCBpc0ZlYXR1cmVkID0gZmFsc2U7XG5cdFx0XHRpZiAod2Fsa3Rocm91Z2guZmVhdHVyZWRGb3IpIHtcblx0XHRcdFx0Y29uc3QgZm9sZGVycyA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5tYXAoZiA9PiBmLnVyaSk7XG5cdFx0XHRcdGNvbnN0IHRva2VuID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4gdG9rZW4uY2FuY2VsKCksIDIwMDApO1xuXHRcdFx0XHRpc0ZlYXR1cmVkID0gYXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhID0+IGNoZWNrR2xvYkZpbGVFeGlzdHMoYSwgZm9sZGVycywgd2Fsa3Rocm91Z2guZmVhdHVyZWRGb3IhLCB0b2tlbi50b2tlbikpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpY29uU3RyID0gd2Fsa3Rocm91Z2guaWNvbiA/PyBleHRlbnNpb24uaWNvbjtcblx0XHRcdGNvbnN0IHdhbGt0aG91Z2hEZXNjcmlwdG9yOiBJV2Fsa3Rocm91Z2ggPSB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiB3YWxrdGhyb3VnaC5kZXNjcmlwdGlvbixcblx0XHRcdFx0dGl0bGU6IHdhbGt0aHJvdWdoLnRpdGxlLFxuXHRcdFx0XHRpZDogY2F0ZWdvcnlJRCxcblx0XHRcdFx0aXNGZWF0dXJlZCxcblx0XHRcdFx0c291cmNlOiBleHRlbnNpb24uZGlzcGxheU5hbWUgPz8gZXh0ZW5zaW9uLm5hbWUsXG5cdFx0XHRcdG9yZGVyOiAwLFxuXHRcdFx0XHR3YWxrdGhyb3VnaFBhZ2VUaXRsZTogZXh0ZW5zaW9uLmRpc3BsYXlOYW1lID8/IGV4dGVuc2lvbi5uYW1lLFxuXHRcdFx0XHRzdGVwcyxcblx0XHRcdFx0aWNvbjoge1xuXHRcdFx0XHRcdHR5cGU6ICdpbWFnZScsXG5cdFx0XHRcdFx0cGF0aDogaWNvblN0clxuXHRcdFx0XHRcdFx0PyBGaWxlQWNjZXNzLnVyaVRvQnJvd3NlclVyaShqb2luUGF0aChleHRlbnNpb24uZXh0ZW5zaW9uTG9jYXRpb24sIGljb25TdHIpKS50b1N0cmluZyh0cnVlKVxuXHRcdFx0XHRcdFx0OiBEZWZhdWx0SWNvblBhdGhcblx0XHRcdFx0fSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUob3ZlcnJpZGUgPz8gd2Fsa3Rocm91Z2gud2hlbikgPz8gQ29udGV4dEtleUV4cHIudHJ1ZSgpLFxuXHRcdFx0fSBhcyBjb25zdDtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXJXYWxrdGhyb3VnaCh3YWxrdGhvdWdoRGVzY3JpcHRvcik7XG5cblx0XHRcdHRoaXMuX29uRGlkQWRkV2Fsa3Rocm91Z2guZmlyZSh0aGlzLnJlc29sdmVXYWxrdGhyb3VnaCh3YWxrdGhvdWdoRGVzY3JpcHRvcikpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUod2Fsa3Rocm91Z2hNZXRhZGF0YUNvbmZpZ3VyYXRpb25LZXksIEpTT04uc3RyaW5naWZ5KFsuLi50aGlzLm1ldGFkYXRhLmVudHJpZXMoKV0pLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblxuXHRcdGNvbnN0IGhhZExhc3RGb3VjcyA9IGF3YWl0IHRoaXMuaG9zdFNlcnZpY2UuaGFkTGFzdEZvY3VzKCk7XG5cdFx0aWYgKGhhZExhc3RGb3VjcyAmJiBzZWN0aW9uVG9PcGVuICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8c3RyaW5nPignd29ya2JlbmNoLndlbGNvbWVQYWdlLndhbGt0aHJvdWdocy5vcGVuT25JbnN0YWxsJykpIHtcblx0XHRcdHR5cGUgR2V0dGluZ1N0YXJ0ZWRBdXRvT3BlbkNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRvd25lcjogJ2xyYW1vczE1Jztcblx0XHRcdFx0Y29tbWVudDogJ1doZW4gYSB3YWxrdGhyb3VnaCBpcyBvcGVuZWQgdXBvbiBleHRlbnNpb24gaW5zdGFsbGF0aW9uJztcblx0XHRcdFx0aWQ6IHtcblx0XHRcdFx0XHRjbGFzc2lmaWNhdGlvbjogJ1B1YmxpY05vblBlcnNvbmFsRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7XG5cdFx0XHRcdFx0b3duZXI6ICdscmFtb3MxNSc7XG5cdFx0XHRcdFx0Y29tbWVudDogJ1VzZWQgdG8gdW5kZXJzdGFuZCB3aGF0IHdhbGt0aHJvdWdocyBhcmUgY29uc3VsdGVkIG1vc3QgZnJlcXVlbnRseSc7XG5cdFx0XHRcdH07XG5cdFx0XHR9O1xuXHRcdFx0dHlwZSBHZXR0aW5nU3RhcnRlZEF1dG9PcGVuRXZlbnQgPSB7XG5cdFx0XHRcdGlkOiBzdHJpbmc7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8R2V0dGluZ1N0YXJ0ZWRBdXRvT3BlbkV2ZW50LCBHZXR0aW5nU3RhcnRlZEF1dG9PcGVuQ2xhc3NpZmljYXRpb24+KCdnZXR0aW5nU3RhcnRlZC5kaWRBdXRvT3BlbldhbGt0aHJvdWdoJywgeyBpZDogc2VjdGlvblRvT3BlbiB9KTtcblx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3dvcmtiZW5jaC5hY3Rpb24ub3BlbldhbGt0aHJvdWdoJywgc2VjdGlvblRvT3Blbiwge1xuXHRcdFx0XHRpbmFjdGl2ZTogdGhpcy5sYXlvdXRTZXJ2aWNlLmhhc0ZvY3VzKFBhcnRzLkVESVRPUl9QQVJUKSAvLyBkbyBub3Qgc3RlYWwgdGhlIGFjdGl2ZSBlZGl0b3IgYXdheVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1bnJlZ2lzdGVyRXh0ZW5zaW9uV2Fsa3Rocm91Z2hDb250cmlidXRpb25zKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKSB7XG5cdFx0aWYgKCEoZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzPy53YWxrdGhyb3VnaHM/Lmxlbmd0aCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRleHRlbnNpb24uY29udHJpYnV0ZXM/LndhbGt0aHJvdWdocz8uZm9yRWFjaChzZWN0aW9uID0+IHtcblx0XHRcdGNvbnN0IGNhdGVnb3J5SUQgPSBleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSArICcjJyArIHNlY3Rpb24uaWQ7XG5cdFx0XHRzZWN0aW9uLnN0ZXBzLmZvckVhY2goc3RlcCA9PiB7XG5cdFx0XHRcdGNvbnN0IGZ1bGx5UXVhbGlmaWVkSUQgPSBleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSArICcjJyArIHNlY3Rpb24uaWQgKyAnIycgKyBzdGVwLmlkO1xuXHRcdFx0XHR0aGlzLnN0ZXBzLmRlbGV0ZShmdWxseVF1YWxpZmllZElEKTtcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5nZXR0aW5nU3RhcnRlZENvbnRyaWJ1dGlvbnMuZGVsZXRlKGNhdGVnb3J5SUQpO1xuXHRcdFx0dGhpcy5fb25EaWRSZW1vdmVXYWxrdGhyb3VnaC5maXJlKGNhdGVnb3J5SUQpO1xuXHRcdH0pO1xuXHR9XG5cblx0Z2V0V2Fsa3Rocm91Z2goaWQ6IHN0cmluZyk6IElSZXNvbHZlZFdhbGt0aHJvdWdoIHtcblxuXHRcdGNvbnN0IHdhbGt0aHJvdWdoID0gdGhpcy5nZXR0aW5nU3RhcnRlZENvbnRyaWJ1dGlvbnMuZ2V0KGlkKTtcblx0XHRpZiAoIXdhbGt0aHJvdWdoKSB7IHRocm93IEVycm9yKCdUcnlpbmcgdG8gZ2V0IHVua25vd24gd2Fsa3Rocm91Z2g6ICcgKyBpZCk7IH1cblx0XHRyZXR1cm4gdGhpcy5yZXNvbHZlV2Fsa3Rocm91Z2god2Fsa3Rocm91Z2gpO1xuXHR9XG5cblx0Z2V0V2Fsa3Rocm91Z2hzKCk6IElSZXNvbHZlZFdhbGt0aHJvdWdoW10ge1xuXG5cdFx0Y29uc3QgcmVnaXN0ZXJlZENhdGVnb3JpZXMgPSBbLi4udGhpcy5nZXR0aW5nU3RhcnRlZENvbnRyaWJ1dGlvbnMudmFsdWVzKCldO1xuXHRcdGNvbnN0IGNhdGVnb3JpZXNXaXRoQ29tcGxldGlvbiA9IHJlZ2lzdGVyZWRDYXRlZ29yaWVzXG5cdFx0XHQubWFwKGNhdGVnb3J5ID0+IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHQuLi5jYXRlZ29yeSxcblx0XHRcdFx0XHRjb250ZW50OiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RlcHMnIGFzIGNvbnN0LFxuXHRcdFx0XHRcdFx0c3RlcHM6IGNhdGVnb3J5LnN0ZXBzXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fSlcblx0XHRcdC5maWx0ZXIoY2F0ZWdvcnkgPT4gY2F0ZWdvcnkuY29udGVudC50eXBlICE9PSAnc3RlcHMnIHx8IGNhdGVnb3J5LmNvbnRlbnQuc3RlcHMubGVuZ3RoKVxuXHRcdFx0Lm1hcChjYXRlZ29yeSA9PiB0aGlzLnJlc29sdmVXYWxrdGhyb3VnaChjYXRlZ29yeSkpO1xuXG5cdFx0cmV0dXJuIGNhdGVnb3JpZXNXaXRoQ29tcGxldGlvbjtcblx0fVxuXG5cdHByaXZhdGUgcmVzb2x2ZVdhbGt0aHJvdWdoKGNhdGVnb3J5OiBJV2Fsa3Rocm91Z2gpOiBJUmVzb2x2ZWRXYWxrdGhyb3VnaCB7XG5cblx0XHRjb25zdCBzdGVwc1dpdGhQcm9ncmVzcyA9IGNhdGVnb3J5LnN0ZXBzLm1hcChzdGVwID0+IHRoaXMuZ2V0U3RlcFByb2dyZXNzKHN0ZXApKTtcblxuXHRcdGNvbnN0IGhhc09wZW5lZCA9IHRoaXMubWV0YWRhdGEuZ2V0KGNhdGVnb3J5LmlkKT8ubWFuYXVsbHlPcGVuZWQ7XG5cdFx0Y29uc3QgZmlyc3RTZWVuRGF0ZSA9IHRoaXMubWV0YWRhdGEuZ2V0KGNhdGVnb3J5LmlkKT8uZmlyc3RTZWVuO1xuXHRcdGNvbnN0IGlzTmV3ID0gZmlyc3RTZWVuRGF0ZSAmJiBmaXJzdFNlZW5EYXRlID4gKCtuZXcgRGF0ZSgpIC0gTkVXX1dBTEtUSFJPVUdIX1RJTUUpO1xuXG5cdFx0Y29uc3QgbGFzdFN0ZXBJRHMgPSB0aGlzLm1ldGFkYXRhLmdldChjYXRlZ29yeS5pZCk/LnN0ZXBJRHM7XG5cdFx0Y29uc3QgcmF3Q2F0ZWdvcnkgPSB0aGlzLmdldHRpbmdTdGFydGVkQ29udHJpYnV0aW9ucy5nZXQoY2F0ZWdvcnkuaWQpO1xuXHRcdGlmICghcmF3Q2F0ZWdvcnkpIHsgdGhyb3cgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdhbGt0aHJvdWdoIHdpdGggaWQgJyArIGNhdGVnb3J5LmlkKTsgfVxuXG5cdFx0Y29uc3QgY3VycmVudFN0ZXBJZHM6IHN0cmluZ1tdID0gcmF3Q2F0ZWdvcnkuc3RlcHMubWFwKHMgPT4gcy5pZCk7XG5cblx0XHRjb25zdCBoYXNOZXdTdGVwcyA9IGxhc3RTdGVwSURzICYmIChjdXJyZW50U3RlcElkcy5sZW5ndGggIT09IGxhc3RTdGVwSURzLmxlbmd0aCB8fCBjdXJyZW50U3RlcElkcy5zb21lKChpZCwgaW5kZXgpID0+IGlkICE9PSBsYXN0U3RlcElEc1tpbmRleF0pKTtcblxuXHRcdGxldCByZWNlbmN5Qm9udXMgPSAwO1xuXHRcdGlmIChmaXJzdFNlZW5EYXRlKSB7XG5cdFx0XHRjb25zdCBjdXJyZW50RGF0ZSA9ICtuZXcgRGF0ZSgpO1xuXHRcdFx0Y29uc3QgdGltZVNpbmNlRmlyc3RTZWVuID0gY3VycmVudERhdGUgLSBmaXJzdFNlZW5EYXRlO1xuXHRcdFx0cmVjZW5jeUJvbnVzID0gTWF0aC5tYXgoMCwgKE5FV19XQUxLVEhST1VHSF9USU1FIC0gdGltZVNpbmNlRmlyc3RTZWVuKSAvIE5FV19XQUxLVEhST1VHSF9USU1FKTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4uY2F0ZWdvcnksXG5cdFx0XHRyZWNlbmN5Qm9udXMsXG5cdFx0XHRzdGVwczogc3RlcHNXaXRoUHJvZ3Jlc3MsXG5cdFx0XHRuZXdJdGVtczogISFoYXNOZXdTdGVwcyxcblx0XHRcdG5ld0VudHJ5OiAhIShpc05ldyAmJiAhaGFzT3BlbmVkKSxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTdGVwUHJvZ3Jlc3Moc3RlcDogSVdhbGt0aHJvdWdoU3RlcCk6IElSZXNvbHZlZFdhbGt0aHJvdWdoU3RlcCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdC4uLnN0ZXAsXG5cdFx0XHRkb25lOiBmYWxzZSxcblx0XHRcdC4uLnRoaXMuc3RlcFByb2dyZXNzW3N0ZXAuaWRdXG5cdFx0fTtcblx0fVxuXG5cdHByb2dyZXNzU3RlcChpZDogc3RyaW5nKSB7XG5cdFx0Y29uc3Qgb2xkUHJvZ3Jlc3MgPSB0aGlzLnN0ZXBQcm9ncmVzc1tpZF07XG5cdFx0aWYgKCFvbGRQcm9ncmVzcyB8fCBvbGRQcm9ncmVzcy5kb25lICE9PSB0cnVlKSB7XG5cdFx0XHR0aGlzLnN0ZXBQcm9ncmVzc1tpZF0gPSB7IGRvbmU6IHRydWUgfTtcblx0XHRcdHRoaXMubWVtZW50by5zYXZlTWVtZW50bygpO1xuXHRcdFx0Y29uc3Qgc3RlcCA9IHRoaXMuZ2V0U3RlcChpZCk7XG5cdFx0XHRpZiAoIXN0ZXApIHsgdGhyb3cgRXJyb3IoJ1RyaWVkIHRvIHByb2dyZXNzIHVua25vd24gc3RlcCcpOyB9XG5cblx0XHRcdHRoaXMuX29uRGlkUHJvZ3Jlc3NTdGVwLmZpcmUodGhpcy5nZXRTdGVwUHJvZ3Jlc3Moc3RlcCkpO1xuXHRcdH1cblx0fVxuXG5cdGRlcHJvZ3Jlc3NTdGVwKGlkOiBzdHJpbmcpIHtcblx0XHRkZWxldGUgdGhpcy5zdGVwUHJvZ3Jlc3NbaWRdO1xuXHRcdHRoaXMubWVtZW50by5zYXZlTWVtZW50bygpO1xuXHRcdGNvbnN0IHN0ZXAgPSB0aGlzLmdldFN0ZXAoaWQpO1xuXHRcdHRoaXMuX29uRGlkUHJvZ3Jlc3NTdGVwLmZpcmUodGhpcy5nZXRTdGVwUHJvZ3Jlc3Moc3RlcCkpO1xuXHR9XG5cblx0cHJvZ3Jlc3NCeUV2ZW50KGV2ZW50OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zZXNzaW9uRXZlbnRzLmhhcyhldmVudCkpIHsgcmV0dXJuOyB9XG5cblx0XHR0aGlzLnNlc3Npb25FdmVudHMuYWRkKGV2ZW50KTtcblx0XHR0aGlzLmNvbXBsZXRpb25MaXN0ZW5lcnMuZ2V0KGV2ZW50KT8uZm9yRWFjaChpZCA9PiB0aGlzLnByb2dyZXNzU3RlcChpZCkpO1xuXHR9XG5cblx0cmVnaXN0ZXJXYWxrdGhyb3VnaCh3YWxrdGhvdWdoRGVzY3JpcHRvcjogSVdhbGt0aHJvdWdoTG9vc2UpIHtcblx0XHR0aGlzLl9yZWdpc3RlcldhbGt0aHJvdWdoKHtcblx0XHRcdC4uLndhbGt0aG91Z2hEZXNjcmlwdG9yLFxuXHRcdFx0c3RlcHM6IHdhbGt0aG91Z2hEZXNjcmlwdG9yLnN0ZXBzLm1hcChzdGVwID0+ICh7IC4uLnN0ZXAsIGRlc2NyaXB0aW9uOiBwYXJzZURlc2NyaXB0aW9uKHN0ZXAuZGVzY3JpcHRpb24pIH0pKVxuXHRcdH0pO1xuXHR9XG5cblx0X3JlZ2lzdGVyV2Fsa3Rocm91Z2god2Fsa3Rocm91Z2hEZXNjcmlwdG9yOiBJV2Fsa3Rocm91Z2gpOiB2b2lkIHtcblx0XHRjb25zdCBvbGRDYXRlZ29yeSA9IHRoaXMuZ2V0dGluZ1N0YXJ0ZWRDb250cmlidXRpb25zLmdldCh3YWxrdGhyb3VnaERlc2NyaXB0b3IuaWQpO1xuXHRcdGlmIChvbGRDYXRlZ29yeSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihgU2tpcHBpbmcgYXR0ZW1wdCB0byBvdmVyd3JpdGUgd2Fsa3Rocm91Z2guICgke3dhbGt0aHJvdWdoRGVzY3JpcHRvci5pZH0pYCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5nZXR0aW5nU3RhcnRlZENvbnRyaWJ1dGlvbnMuc2V0KHdhbGt0aHJvdWdoRGVzY3JpcHRvci5pZCwgd2Fsa3Rocm91Z2hEZXNjcmlwdG9yKTtcblxuXHRcdHdhbGt0aHJvdWdoRGVzY3JpcHRvci5zdGVwcy5mb3JFYWNoKHN0ZXAgPT4ge1xuXHRcdFx0aWYgKHRoaXMuc3RlcHMuaGFzKHN0ZXAuaWQpKSB7IHRocm93IEVycm9yKCdBdHRlbXB0aW5nIHRvIHJlZ2lzdGVyIHN0ZXAgd2l0aCBpZCAnICsgc3RlcC5pZCArICcgdHdpY2UuIFNlY29uZCBpcyBkcm9wcGVkLicpOyB9XG5cdFx0XHR0aGlzLnN0ZXBzLnNldChzdGVwLmlkLCBzdGVwKTtcblx0XHRcdHN0ZXAud2hlbi5rZXlzKCkuZm9yRWFjaChrZXkgPT4gdGhpcy5jYXRlZ29yeVZpc2liaWxpdHlDb250ZXh0S2V5cy5hZGQoa2V5KSk7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyRG9uZUxpc3RlbmVycyhzdGVwKTtcblx0XHR9KTtcblxuXHRcdHdhbGt0aHJvdWdoRGVzY3JpcHRvci53aGVuLmtleXMoKS5mb3JFYWNoKGtleSA9PiB0aGlzLmNhdGVnb3J5VmlzaWJpbGl0eUNvbnRleHRLZXlzLmFkZChrZXkpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJEb25lTGlzdGVuZXJzKHN0ZXA6IElXYWxrdGhyb3VnaFN0ZXApIHtcblx0XHRpZiAoKHN0ZXAgYXMgYW55KS5kb25lT24pIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoYHdha3Rocm91Z2ggc3RlcGAsIHN0ZXAsIGB1c2VzIGRlcHJlY2F0ZWQgJ2RvbmVPbicgcHJvcGVydHkuIEFkb3B0ICdjb21wbGV0aW9uRXZlbnRzJyB0byBzaWxlbmNlIHRoaXMgd2FybmluZ2ApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghc3RlcC5jb21wbGV0aW9uRXZlbnRzLmxlbmd0aCkge1xuXHRcdFx0c3RlcC5jb21wbGV0aW9uRXZlbnRzID0gY29hbGVzY2UoXG5cdFx0XHRcdHN0ZXAuZGVzY3JpcHRpb25cblx0XHRcdFx0XHQuZmlsdGVyKGxpbmtlZFRleHQgPT4gbGlua2VkVGV4dC5ub2Rlcy5sZW5ndGggPT09IDEpIC8vIG9ubHkgYnV0dG9uc1xuXHRcdFx0XHRcdC5mbGF0TWFwKGxpbmtlZFRleHQgPT5cblx0XHRcdFx0XHRcdGxpbmtlZFRleHQubm9kZXNcblx0XHRcdFx0XHRcdFx0LmZpbHRlcigoKG5vZGUpOiBub2RlIGlzIElMaW5rID0+IHR5cGVvZiBub2RlICE9PSAnc3RyaW5nJykpXG5cdFx0XHRcdFx0XHRcdC5tYXAoKHsgaHJlZiB9KSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGhyZWYuc3RhcnRzV2l0aCgnY29tbWFuZDonKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuICdvbkNvbW1hbmQ6JyArIGhyZWYuc2xpY2UoJ2NvbW1hbmQ6Jy5sZW5ndGgsIGhyZWYuaW5jbHVkZXMoJz8nKSA/IGhyZWYuaW5kZXhPZignPycpIDogdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGhyZWYuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSB8fCBocmVmLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuICdvbkxpbms6JyArIGhyZWY7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRcdH0pKSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFzdGVwLmNvbXBsZXRpb25FdmVudHMubGVuZ3RoKSB7XG5cdFx0XHRzdGVwLmNvbXBsZXRpb25FdmVudHMucHVzaCgnc3RlcFNlbGVjdGVkJyk7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgZXZlbnQgb2Ygc3RlcC5jb21wbGV0aW9uRXZlbnRzKSB7XG5cdFx0XHRjb25zdCBbXywgZXZlbnRUeXBlLCBhcmd1bWVudF0gPSAvXihbXjpdKik6PyguKikkLy5leGVjKGV2ZW50KSA/PyBbXTtcblxuXHRcdFx0aWYgKCFldmVudFR5cGUpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihgVW5rbm93biBjb21wbGV0aW9uRXZlbnQgJHtldmVudH0gd2hlbiByZWdpc3RlcmluZyBzdGVwICR7c3RlcC5pZH1gKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHN3aXRjaCAoZXZlbnRUeXBlKSB7XG5cdFx0XHRcdGNhc2UgJ29uTGluayc6IGNhc2UgJ29uRXZlbnQnOiBjYXNlICdvblZpZXcnOiBjYXNlICdvblNldHRpbmdDaGFuZ2VkJzpcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnb25Db250ZXh0Jzoge1xuXHRcdFx0XHRcdGNvbnN0IGV4cHJlc3Npb24gPSBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShhcmd1bWVudCk7XG5cdFx0XHRcdFx0aWYgKGV4cHJlc3Npb24pIHtcblx0XHRcdFx0XHRcdHRoaXMuc3RlcENvbXBsZXRpb25Db250ZXh0S2V5RXhwcmVzc2lvbnMuYWRkKGV4cHJlc3Npb24pO1xuXHRcdFx0XHRcdFx0ZXhwcmVzc2lvbi5rZXlzKCkuZm9yRWFjaChrZXkgPT4gdGhpcy5zdGVwQ29tcGxldGlvbkNvbnRleHRLZXlzLmFkZChrZXkpKTtcblx0XHRcdFx0XHRcdGV2ZW50ID0gZXZlbnRUeXBlICsgJzonICsgZXhwcmVzc2lvbi5zZXJpYWxpemUoKTtcblx0XHRcdFx0XHRcdGlmICh0aGlzLmNvbnRleHRTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMoZXhwcmVzc2lvbikpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5zZXNzaW9uRXZlbnRzLmFkZChldmVudCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBwYXJzZSBjb250ZXh0IGtleSBleHByZXNzaW9uOicsIGV4cHJlc3Npb24sICdpbiB3YWxrdGhyb3VnaCBzdGVwJywgc3RlcC5pZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ29uU3RlcFNlbGVjdGVkJzogY2FzZSAnc3RlcFNlbGVjdGVkJzpcblx0XHRcdFx0XHRldmVudCA9ICdzdGVwU2VsZWN0ZWQ6JyArIHN0ZXAuaWQ7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ29uQ29tbWFuZCc6XG5cdFx0XHRcdFx0ZXZlbnQgPSBldmVudFR5cGUgKyAnOicgKyBhcmd1bWVudC5yZXBsYWNlKC9edG9TaWRlOi8sICcnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnb25FeHRlbnNpb25JbnN0YWxsZWQnOiBjYXNlICdleHRlbnNpb25JbnN0YWxsZWQnOlxuXHRcdFx0XHRcdGV2ZW50ID0gJ2V4dGVuc2lvbkluc3RhbGxlZDonICsgYXJndW1lbnQudG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKGBVbmtub3duIGNvbXBsZXRpb25FdmVudCAke2V2ZW50fSB3aGVuIHJlZ2lzdGVyaW5nIHN0ZXAgJHtzdGVwLmlkfWApO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnJlZ2lzdGVyQ29tcGxldGlvbkxpc3RlbmVyKGV2ZW50LCBzdGVwKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyQ29tcGxldGlvbkxpc3RlbmVyKGV2ZW50OiBzdHJpbmcsIHN0ZXA6IElXYWxrdGhyb3VnaFN0ZXApIHtcblx0XHRpZiAoIXRoaXMuY29tcGxldGlvbkxpc3RlbmVycy5oYXMoZXZlbnQpKSB7XG5cdFx0XHR0aGlzLmNvbXBsZXRpb25MaXN0ZW5lcnMuc2V0KGV2ZW50LCBuZXcgU2V0KCkpO1xuXHRcdH1cblx0XHR0aGlzLmNvbXBsZXRpb25MaXN0ZW5lcnMuZ2V0KGV2ZW50KT8uYWRkKHN0ZXAuaWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTdGVwKGlkOiBzdHJpbmcpOiBJV2Fsa3Rocm91Z2hTdGVwIHtcblx0XHRjb25zdCBzdGVwID0gdGhpcy5zdGVwcy5nZXQoaWQpO1xuXHRcdGlmICghc3RlcCkgeyB0aHJvdyBFcnJvcignQXR0ZW1wdGluZyB0byBhY2Nlc3Mgc3RlcCB3aGljaCBkb2VzIG5vdCBleGlzdCBpbiByZWdpc3RyeSAnICsgaWQpOyB9XG5cdFx0cmV0dXJuIHN0ZXA7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IHBhcnNlRGVzY3JpcHRpb24gPSAoZGVzYzogc3RyaW5nKTogTGlua2VkVGV4dFtdID0+IGRlc2Muc3BsaXQoJ1xcbicpLmZpbHRlcih4ID0+IHgpLm1hcCh0ZXh0ID0+IHBhcnNlTGlua2VkVGV4dCh0ZXh0KSk7XG5cbmV4cG9ydCBjb25zdCBjb252ZXJ0SW50ZXJuYWxNZWRpYVBhdGhUb0ZpbGVVUkkgPSAocGF0aDogc3RyaW5nKSA9PiBwYXRoLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJylcblx0PyBVUkkucGFyc2UocGF0aCwgdHJ1ZSlcblx0OiBGaWxlQWNjZXNzLmFzRmlsZVVyaShgdnMvd29ya2JlbmNoL2NvbnRyaWIvd2VsY29tZUdldHRpbmdTdGFydGVkL2NvbW1vbi9tZWRpYS8ke3BhdGh9YCk7XG5cbmNvbnN0IGNvbnZlcnRJbnRlcm5hbE1lZGlhUGF0aFRvQnJvd3NlclVSSSA9IChwYXRoOiBzdHJpbmcpID0+IHBhdGguc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKVxuXHQ/IFVSSS5wYXJzZShwYXRoLCB0cnVlKVxuXHQ6IEZpbGVBY2Nlc3MuYXNCcm93c2VyVXJpKGB2cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lR2V0dGluZ1N0YXJ0ZWQvY29tbW9uL21lZGlhLyR7cGF0aH1gKTtcbmNvbnN0IGNvbnZlcnRJbnRlcm5hbE1lZGlhUGF0aHNUb0Jyb3dzZXJVUklzID0gKHBhdGg6IHN0cmluZyB8IHsgaGM6IHN0cmluZzsgaGNMaWdodD86IHN0cmluZzsgZGFyazogc3RyaW5nOyBsaWdodDogc3RyaW5nIH0pOiB7IGhjRGFyazogVVJJOyBoY0xpZ2h0OiBVUkk7IGRhcms6IFVSSTsgbGlnaHQ6IFVSSSB9ID0+IHtcblx0aWYgKHR5cGVvZiBwYXRoID09PSAnc3RyaW5nJykge1xuXHRcdGNvbnN0IGNvbnZlcnRlZCA9IGNvbnZlcnRJbnRlcm5hbE1lZGlhUGF0aFRvQnJvd3NlclVSSShwYXRoKTtcblx0XHRyZXR1cm4geyBoY0Rhcms6IGNvbnZlcnRlZCwgaGNMaWdodDogY29udmVydGVkLCBkYXJrOiBjb252ZXJ0ZWQsIGxpZ2h0OiBjb252ZXJ0ZWQgfTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aGNEYXJrOiBjb252ZXJ0SW50ZXJuYWxNZWRpYVBhdGhUb0Jyb3dzZXJVUkkocGF0aC5oYyksXG5cdFx0XHRoY0xpZ2h0OiBjb252ZXJ0SW50ZXJuYWxNZWRpYVBhdGhUb0Jyb3dzZXJVUkkocGF0aC5oY0xpZ2h0ID8/IHBhdGgubGlnaHQpLFxuXHRcdFx0bGlnaHQ6IGNvbnZlcnRJbnRlcm5hbE1lZGlhUGF0aFRvQnJvd3NlclVSSShwYXRoLmxpZ2h0KSxcblx0XHRcdGRhcms6IGNvbnZlcnRJbnRlcm5hbE1lZGlhUGF0aFRvQnJvd3NlclVSSShwYXRoLmRhcmspXG5cdFx0fTtcblx0fVxufTtcblxuY29uc3QgY29udmVydFJlbGF0aXZlTWVkaWFQYXRoc1RvV2Vidmlld1VSSXMgPSAoYmFzZVBhdGg6IFVSSSwgcGF0aDogc3RyaW5nIHwgeyBoYzogc3RyaW5nOyBoY0xpZ2h0Pzogc3RyaW5nOyBkYXJrOiBzdHJpbmc7IGxpZ2h0OiBzdHJpbmcgfSk6IHsgaGNEYXJrOiBVUkk7IGhjTGlnaHQ6IFVSSTsgZGFyazogVVJJOyBsaWdodDogVVJJIH0gPT4ge1xuXHRjb25zdCBjb252ZXJ0UGF0aCA9IChwYXRoOiBzdHJpbmcpID0+IHBhdGguc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKVxuXHRcdD8gVVJJLnBhcnNlKHBhdGgsIHRydWUpXG5cdFx0OiBhc1dlYnZpZXdVcmkoam9pblBhdGgoYmFzZVBhdGgsIHBhdGgpKTtcblxuXHRpZiAodHlwZW9mIHBhdGggPT09ICdzdHJpbmcnKSB7XG5cdFx0Y29uc3QgY29udmVydGVkID0gY29udmVydFBhdGgocGF0aCk7XG5cdFx0cmV0dXJuIHsgaGNEYXJrOiBjb252ZXJ0ZWQsIGhjTGlnaHQ6IGNvbnZlcnRlZCwgZGFyazogY29udmVydGVkLCBsaWdodDogY29udmVydGVkIH07XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGhjRGFyazogY29udmVydFBhdGgocGF0aC5oYyksXG5cdFx0XHRoY0xpZ2h0OiBjb252ZXJ0UGF0aChwYXRoLmhjTGlnaHQgPz8gcGF0aC5saWdodCksXG5cdFx0XHRsaWdodDogY29udmVydFBhdGgocGF0aC5saWdodCksXG5cdFx0XHRkYXJrOiBjb252ZXJ0UGF0aChwYXRoLmRhcmspXG5cdFx0fTtcblx0fVxufTtcblxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdyZXNldEdldHRpbmdTdGFydGVkUHJvZ3Jlc3MnLFxuXHRcdFx0Y2F0ZWdvcnk6IGxvY2FsaXplMignZGV2ZWxvcGVyJywgXCJEZXZlbG9wZXJcIiksXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdyZXNldFdlbGNvbWVQYWdlV2Fsa3Rocm91Z2hQcm9ncmVzcycsIFwiUmVzZXQgV2VsY29tZSBQYWdlIFdhbGt0aHJvdWdoIFByb2dyZXNzXCIpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUyKCdyZXNldEdldHRpbmdTdGFydGVkUHJvZ3Jlc3NEZXNjcmlwdGlvbicsICdSZXNldCB0aGUgcHJvZ3Jlc3Mgb2YgYWxsIFdhbGt0aHJvdWdoIHN0ZXBzIG9uIHRoZSBXZWxjb21lIFBhZ2UgdG8gbWFrZSB0aGVtIGFwcGVhciBhcyBpZiB0aGV5IGFyZSBiZWluZyB2aWV3ZWQgZm9yIHRoZSBmaXJzdCB0aW1lLCBwcm92aWRpbmcgYSBmcmVzaCBzdGFydCB0byB0aGUgZ2V0dGluZyBzdGFydGVkIGV4cGVyaWVuY2UuJyksXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCBnZXR0aW5nU3RhcnRlZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdhbGt0aHJvdWdoc1NlcnZpY2UpO1xuXHRcdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElTdG9yYWdlU2VydmljZSk7XG5cblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZShcblx0XHRcdGhpZGRlbkVudHJpZXNDb25maWd1cmF0aW9uS2V5LFxuXHRcdFx0SlNPTi5zdHJpbmdpZnkoW10pLFxuXHRcdFx0U3RvcmFnZVNjb3BlLlBST0ZJTEUsXG5cdFx0XHRTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXG5cdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoXG5cdFx0XHR3YWxrdGhyb3VnaE1ldGFkYXRhQ29uZmlndXJhdGlvbktleSxcblx0XHRcdEpTT04uc3RyaW5naWZ5KFtdKSxcblx0XHRcdFN0b3JhZ2VTY29wZS5QUk9GSUxFLFxuXHRcdFx0U3RvcmFnZVRhcmdldC5VU0VSKTtcblxuXHRcdGNvbnN0IG1lbWVudG8gPSBuZXcgTWVtZW50bygnZ2V0dGluZ1N0YXJ0ZWRTZXJ2aWNlJywgYWNjZXNzb3IuZ2V0KElTdG9yYWdlU2VydmljZSkpO1xuXHRcdGNvbnN0IHJlY29yZCA9IG1lbWVudG8uZ2V0TWVtZW50byhTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHRmb3IgKGNvbnN0IGtleSBpbiByZWNvcmQpIHtcblx0XHRcdGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocmVjb3JkLCBrZXkpKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Z2V0dGluZ1N0YXJ0ZWRTZXJ2aWNlLmRlcHJvZ3Jlc3NTdGVwKGtleSk7XG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdG1lbWVudG8uc2F2ZU1lbWVudG8oKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElXYWxrdGhyb3VnaHNTZXJ2aWNlLCBXYWxrdGhyb3VnaHNTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxpQkFBaUIsNkJBQStDO0FBQ3pFLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsU0FBUyx1QkFBdUI7QUFDekMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxnQkFBc0Msb0JBQW9CLHFCQUFxQjtBQUN4RixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHNDQUFzQztBQUMvQyxTQUFTLDJCQUFrRDtBQUMzRCxTQUFTLFdBQVc7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxrQkFBa0I7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
