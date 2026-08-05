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
import { URI } from "../../../../base/common/uri.js";
import { TextResourceEditorInput } from "../../../common/editor/textResourceEditorInput.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { ILifecycleService, LifecyclePhase, StartupKindToString } from "../../../services/lifecycle/common/lifecycle.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITimerService } from "../../../services/timer/browser/timerService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { writeTransientState } from "../../codeEditor/browser/toggleWordWrap.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ByteSize, IFileService } from "../../../../platform/files/common/files.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { ITerminalService } from "../../terminal/browser/terminal.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions, getWorkbenchContribution } from "../../../common/contributions.js";
import { ICustomEditorLabelService } from "../../../services/editor/common/customEditorLabelService.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
let PerfviewContrib = class {
  constructor(_instaService, textModelResolverService) {
    this._instaService = _instaService;
    this._inputUri = URI.from({ scheme: "perf", path: "Startup Performance" });
    this._registration = textModelResolverService.registerTextModelContentProvider("perf", _instaService.createInstance(PerfModelContentProvider));
  }
  static get() {
    return getWorkbenchContribution(PerfviewContrib.ID);
  }
  dispose() {
    this._registration.dispose();
  }
  getInputUri() {
    return this._inputUri;
  }
  getEditorInput() {
    return this._instaService.createInstance(PerfviewInput);
  }
};
PerfviewContrib.ID = "workbench.contrib.perfview";
PerfviewContrib = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ITextModelService)
], PerfviewContrib);
let PerfviewInput = class extends TextResourceEditorInput {
  get typeId() {
    return PerfviewInput.Id;
  }
  constructor(textModelResolverService, textFileService, editorService, fileService, labelService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService) {
    super(
      PerfviewContrib.get().getInputUri(),
      localize("name", "Startup Performance"),
      void 0,
      void 0,
      void 0,
      textModelResolverService,
      textFileService,
      editorService,
      fileService,
      labelService,
      filesConfigurationService,
      textResourceConfigurationService,
      customEditorLabelService
    );
  }
};
PerfviewInput.Id = "PerfviewInput";
PerfviewInput = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IFileService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, IFilesConfigurationService),
  __decorateParam(6, ITextResourceConfigurationService),
  __decorateParam(7, ICustomEditorLabelService)
], PerfviewInput);
let PerfModelContentProvider = class {
  constructor(_modelService, _languageService, _editorService, _lifecycleService, _timerService, _extensionService, _productService, _remoteAgentService, _terminalService) {
    this._modelService = _modelService;
    this._languageService = _languageService;
    this._editorService = _editorService;
    this._lifecycleService = _lifecycleService;
    this._timerService = _timerService;
    this._extensionService = _extensionService;
    this._productService = _productService;
    this._remoteAgentService = _remoteAgentService;
    this._terminalService = _terminalService;
    this._modelDisposables = [];
  }
  provideTextContent(resource) {
    if (!this._model || this._model.isDisposed()) {
      dispose(this._modelDisposables);
      const langId = this._languageService.createById("markdown");
      this._model = this._modelService.getModel(resource) || this._modelService.createModel("Loading...", langId, resource);
      this._modelDisposables.push(langId.onDidChange((e) => {
        this._model?.setLanguage(e);
      }));
      this._modelDisposables.push(this._extensionService.onDidChangeExtensionsStatus(this._updateModel, this));
      writeTransientState(this._model, { wordWrapOverride: "off" }, this._editorService);
    }
    this._updateModel();
    return Promise.resolve(this._model);
  }
  _updateModel() {
    Promise.all([
      this._timerService.whenReady(),
      this._lifecycleService.when(LifecyclePhase.Eventually),
      this._extensionService.whenInstalledExtensionsRegistered(),
      // The terminal service never connects to the pty host on the web
      isWeb && !this._remoteAgentService.getConnection()?.remoteAuthority ? Promise.resolve() : this._terminalService.whenConnected
    ]).then(() => {
      if (this._model && !this._model.isDisposed()) {
        const md = new MarkdownBuilder();
        this._addSummary(md);
        md.blank();
        this._addSummaryTable(md);
        md.blank();
        this._addExtensionsTable(md);
        md.blank();
        this._addPerfMarksTable("Terminal Stats", md, this._timerService.getPerformanceMarks().find((e) => e[0] === "renderer")?.[1].filter((e) => e.name.startsWith("code/terminal/")));
        md.blank();
        this._addWorkbenchContributionsPerfMarksTable(md);
        md.blank();
        this._addRawPerfMarks(md);
        md.blank();
        this._addResourceTimingStats(md);
        this._model.setValue(md.value);
      }
    });
  }
  _addSummary(md) {
    const metrics = this._timerService.startupMetrics;
    md.heading(2, "System Info");
    md.li(`${this._productService.nameShort}: ${this._productService.version} (${this._productService.commit || "0000000"})`);
    md.li(`OS: ${metrics.platform}(${metrics.release})`);
    if (metrics.cpus) {
      md.li(`CPUs: ${metrics.cpus.model}(${metrics.cpus.count} x ${metrics.cpus.speed})`);
    }
    if (typeof metrics.totalmem === "number" && typeof metrics.freemem === "number") {
      md.li(`Memory(System): ${(metrics.totalmem / ByteSize.GB).toFixed(2)} GB(${(metrics.freemem / ByteSize.GB).toFixed(2)}GB free)`);
    }
    if (metrics.meminfo) {
      md.li(`Memory(Process): ${(metrics.meminfo.workingSetSize / ByteSize.KB).toFixed(2)} MB working set(${(metrics.meminfo.privateBytes / ByteSize.KB).toFixed(2)}MB private, ${(metrics.meminfo.sharedBytes / ByteSize.KB).toFixed(2)}MB shared)`);
    }
    md.li(`VM(likelihood): ${metrics.isVMLikelyhood}%`);
    md.li(`Initial Startup: ${metrics.initialStartup}`);
    md.li(`Has ${metrics.windowCount - 1} other windows`);
    md.li(`Screen Reader Active: ${metrics.hasAccessibilitySupport}`);
    md.li(`Empty Workspace: ${metrics.emptyWorkbench}`);
  }
  _addSummaryTable(md) {
    const metrics = this._timerService.startupMetrics;
    const contribTimings = Registry.as(WorkbenchExtensions.Workbench).timings;
    const table = [];
    table.push(["start => app.isReady", metrics.timers.ellapsedAppReady, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["nls:start => nls:end", metrics.timers.ellapsedNlsGeneration, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["import(main.js)", metrics.timers.ellapsedLoadMainBundle, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["run main.js", metrics.timers.ellapsedRunMainBundle, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["start crash reporter", metrics.timers.ellapsedCrashReporter, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["serve main IPC handle", metrics.timers.ellapsedMainServer, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["create window", metrics.timers.ellapsedWindowCreate, "[main]", `initial startup: ${metrics.initialStartup}, ${metrics.initialStartup ? `state: ${metrics.timers.ellapsedWindowRestoreState}ms, widget: ${metrics.timers.ellapsedBrowserWindowCreate}ms, show: ${metrics.timers.ellapsedWindowMaximize}ms` : ""}`]);
    table.push(["app.isReady => window.loadUrl()", metrics.timers.ellapsedWindowLoad, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["window.loadUrl() => begin to import(workbench.desktop.main.js)", metrics.timers.ellapsedWindowLoadToRequire, "[main->renderer]", StartupKindToString(metrics.windowKind)]);
    table.push(["import(workbench.desktop.main.js)", metrics.timers.ellapsedRequire, "[renderer]", `cached data: ${metrics.didUseCachedData ? "YES" : "NO"}`]);
    table.push(["wait for window config", metrics.timers.ellapsedWaitForWindowConfig, "[renderer]", void 0]);
    table.push(["init storage (global & workspace)", metrics.timers.ellapsedStorageInit, "[renderer]", void 0]);
    table.push(["init workspace service", metrics.timers.ellapsedWorkspaceServiceInit, "[renderer]", void 0]);
    if (isWeb) {
      table.push(["init settings and global state from settings sync service", metrics.timers.ellapsedRequiredUserDataInit, "[renderer]", void 0]);
      table.push(["init keybindings, snippets & extensions from settings sync service", metrics.timers.ellapsedOtherUserDataInit, "[renderer]", void 0]);
    }
    table.push(["register extensions & spawn extension host", metrics.timers.ellapsedExtensions, "[renderer]", void 0]);
    table.push(["restore viewlet", metrics.timers.ellapsedViewletRestore, "[renderer]", metrics.viewletId]);
    table.push(["restore panel", metrics.timers.ellapsedPanelRestore, "[renderer]", metrics.panelId]);
    table.push(["restore & resolve visible editors", metrics.timers.ellapsedEditorRestore, "[renderer]", `${metrics.editorIds.length}: ${metrics.editorIds.join(", ")}`]);
    table.push(["create workbench contributions", metrics.timers.ellapsedWorkbenchContributions, "[renderer]", `${(contribTimings.get(LifecyclePhase.Starting)?.length ?? 0) + (contribTimings.get(LifecyclePhase.Starting)?.length ?? 0)} blocking startup`]);
    table.push(["overall workbench load", metrics.timers.ellapsedWorkbench, "[renderer]", void 0]);
    table.push(["workbench ready", metrics.ellapsed, "[main->renderer]", void 0]);
    table.push(["renderer ready", metrics.timers.ellapsedRenderer, "[renderer]", void 0]);
    table.push(["shared process connection ready", metrics.timers.ellapsedSharedProcesConnected, "[renderer->sharedprocess]", void 0]);
    table.push(["extensions registered", metrics.timers.ellapsedExtensionsReady, "[renderer]", void 0]);
    md.heading(2, "Performance Marks");
    md.table(["What", "Duration", "Process", "Info"], table);
  }
  _addExtensionsTable(md) {
    const eager = [];
    const normal = [];
    const extensionsStatus = this._extensionService.getExtensionsStatus();
    for (const id in extensionsStatus) {
      const { activationTimes: times } = extensionsStatus[id];
      if (!times) {
        continue;
      }
      if (times.activationReason.startup) {
        eager.push([id, times.activationReason.startup, times.codeLoadingTime, times.activateCallTime, times.activateResolvedTime, times.activationReason.activationEvent, times.activationReason.extensionId.value]);
      } else {
        normal.push([id, times.activationReason.startup, times.codeLoadingTime, times.activateCallTime, times.activateResolvedTime, times.activationReason.activationEvent, times.activationReason.extensionId.value]);
      }
    }
    const table = eager.concat(normal);
    if (table.length > 0) {
      md.heading(2, "Extension Activation Stats");
      md.table(
        ["Extension", "Eager", "Load Code", "Call Activate", "Finish Activate", "Event", "By"],
        table
      );
    }
  }
  _addPerfMarksTable(name, md, marks) {
    if (!marks) {
      return;
    }
    const table = [];
    let lastStartTime = -1;
    let total = 0;
    for (const { name: name2, startTime } of marks) {
      const delta = lastStartTime !== -1 ? startTime - lastStartTime : 0;
      total += delta;
      table.push([name2, Math.round(startTime), Math.round(delta), Math.round(total)]);
      lastStartTime = startTime;
    }
    if (name) {
      md.heading(2, name);
    }
    md.table(["Name", "Timestamp", "Delta", "Total"], table);
  }
  _addWorkbenchContributionsPerfMarksTable(md) {
    md.heading(2, "Workbench Contributions Blocking Restore");
    const timings = Registry.as(WorkbenchExtensions.Workbench).timings;
    md.li(`Total (LifecyclePhase.Starting): ${timings.get(LifecyclePhase.Starting)?.length} (${timings.get(LifecyclePhase.Starting)?.reduce((p, c) => p + c[1], 0)}ms)`);
    md.li(`Total (LifecyclePhase.Ready): ${timings.get(LifecyclePhase.Ready)?.length} (${timings.get(LifecyclePhase.Ready)?.reduce((p, c) => p + c[1], 0)}ms)`);
    md.blank();
    const marks = this._timerService.getPerformanceMarks().find((e) => e[0] === "renderer")?.[1].filter(
      (e) => e.name.startsWith("code/willCreateWorkbenchContribution/1") || e.name.startsWith("code/didCreateWorkbenchContribution/1") || e.name.startsWith("code/willCreateWorkbenchContribution/2") || e.name.startsWith("code/didCreateWorkbenchContribution/2")
    );
    this._addPerfMarksTable(void 0, md, marks);
  }
  _addRawPerfMarks(md) {
    for (const [source, marks] of this._timerService.getPerformanceMarks()) {
      md.heading(2, `Raw Perf Marks: ${source}`);
      md.value += "```\n";
      md.value += `Name	Timestamp	Delta	Total
`;
      let lastStartTime = -1;
      let total = 0;
      for (const { name, startTime } of marks) {
        const delta = lastStartTime !== -1 ? startTime - lastStartTime : 0;
        total += delta;
        md.value += `${name}	${startTime}	${delta}	${total}
`;
        lastStartTime = startTime;
      }
      md.value += "```\n";
    }
  }
  _addResourceTimingStats(md) {
    const stats = performance.getEntriesByType("resource").map((entry) => {
      return [entry.name, entry.duration];
    });
    if (!stats.length) {
      return;
    }
    md.heading(2, "Resource Timing Stats");
    md.table(["Name", "Duration"], stats);
  }
};
PerfModelContentProvider = __decorateClass([
  __decorateParam(0, IModelService),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, ICodeEditorService),
  __decorateParam(3, ILifecycleService),
  __decorateParam(4, ITimerService),
  __decorateParam(5, IExtensionService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IRemoteAgentService),
  __decorateParam(8, ITerminalService)
], PerfModelContentProvider);
class MarkdownBuilder {
  constructor() {
    this.value = "";
  }
  heading(level, value) {
    this.value += `${"#".repeat(level)} ${value}

`;
    return this;
  }
  blank() {
    this.value += "\n";
    return this;
  }
  li(value) {
    this.value += `* ${value}
`;
    return this;
  }
  table(header, rows) {
    this.value += this.toMarkdownTable(header, rows);
  }
  toMarkdownTable(header, rows) {
    let result = "";
    const lengths = [];
    header.forEach((cell, ci) => {
      lengths[ci] = cell.length;
    });
    rows.forEach((row) => {
      row.forEach((cell, ci) => {
        if (typeof cell === "undefined") {
          cell = row[ci] = "-";
        }
        const len = cell.toString().length;
        lengths[ci] = Math.max(len, lengths[ci]);
      });
    });
    header.forEach((cell, ci) => {
      result += `| ${cell + " ".repeat(lengths[ci] - cell.toString().length)} `;
    });
    result += "|\n";
    header.forEach((_cell, ci) => {
      result += `| ${"-".repeat(lengths[ci])} `;
    });
    result += "|\n";
    rows.forEach((row) => {
      row.forEach((cell, ci) => {
        if (typeof cell !== "undefined") {
          result += `| ${cell + " ".repeat(lengths[ci] - cell.toString().length)} `;
        }
      });
      result += "|\n";
    });
    return result;
  }
}
export {
  PerfviewContrib,
  PerfviewInput
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wZXJmb3JtYW5jZS9icm93c2VyL3BlcmZ2aWV3RWRpdG9yLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFRleHRSZXNvdXJjZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci90ZXh0UmVzb3VyY2VFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsU2VydmljZSwgSVRleHRNb2RlbENvbnRlbnRQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlLCBMaWZlY3ljbGVQaGFzZSwgU3RhcnR1cEtpbmRUb1N0cmluZyB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElUaW1lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90aW1lci9icm93c2VyL3RpbWVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIGRpc3Bvc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgd3JpdGVUcmFuc2llbnRTdGF0ZSB9IGZyb20gJy4uLy4uL2NvZGVFZGl0b3IvYnJvd3Nlci90b2dnbGVXb3JkV3JhcC5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGV4dEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBCeXRlU2l6ZSwgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgaXNXZWIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2ZpbGVzQ29uZmlndXJhdGlvbi9jb21tb24vZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgKiBhcyBwZXJmIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BlcmZvcm1hbmNlLmpzJztcbmltcG9ydCB7IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvdGV4dFJlc291cmNlQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIFdvcmtiZW5jaEV4dGVuc2lvbnMsIGdldFdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElDdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2N1c3RvbUVkaXRvckxhYmVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuXG5leHBvcnQgY2xhc3MgUGVyZnZpZXdDb250cmliIHtcblxuXHRzdGF0aWMgZ2V0KCkge1xuXHRcdHJldHVybiBnZXRXb3JrYmVuY2hDb250cmlidXRpb248UGVyZnZpZXdDb250cmliPihQZXJmdmlld0NvbnRyaWIuSUQpO1xuXHR9XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLnBlcmZ2aWV3JztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pbnB1dFVyaSA9IFVSSS5mcm9tKHsgc2NoZW1lOiAncGVyZicsIHBhdGg6ICdTdGFydHVwIFBlcmZvcm1hbmNlJyB9KTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVnaXN0cmF0aW9uOiBJRGlzcG9zYWJsZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSB0ZXh0TW9kZWxSZXNvbHZlclNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbiA9IHRleHRNb2RlbFJlc29sdmVyU2VydmljZS5yZWdpc3RlclRleHRNb2RlbENvbnRlbnRQcm92aWRlcigncGVyZicsIF9pbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUGVyZk1vZGVsQ29udGVudFByb3ZpZGVyKSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbi5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXRJbnB1dFVyaSgpOiBVUkkge1xuXHRcdHJldHVybiB0aGlzLl9pbnB1dFVyaTtcblx0fVxuXG5cdGdldEVkaXRvcklucHV0KCk6IFBlcmZ2aWV3SW5wdXQge1xuXHRcdHJldHVybiB0aGlzLl9pbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUGVyZnZpZXdJbnB1dCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFBlcmZ2aWV3SW5wdXQgZXh0ZW5kcyBUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElkID0gJ1BlcmZ2aWV3SW5wdXQnO1xuXG5cdG92ZXJyaWRlIGdldCB0eXBlSWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gUGVyZnZpZXdJbnB1dC5JZDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSB0ZXh0TW9kZWxSZXNvbHZlclNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJVGV4dEZpbGVTZXJ2aWNlIHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgZmlsZXNDb25maWd1cmF0aW9uU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB0ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZTogSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlIGN1c3RvbUVkaXRvckxhYmVsU2VydmljZTogSUN1c3RvbUVkaXRvckxhYmVsU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihcblx0XHRcdFBlcmZ2aWV3Q29udHJpYi5nZXQoKS5nZXRJbnB1dFVyaSgpLFxuXHRcdFx0bG9jYWxpemUoJ25hbWUnLCBcIlN0YXJ0dXAgUGVyZm9ybWFuY2VcIiksXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR0ZXh0TW9kZWxSZXNvbHZlclNlcnZpY2UsXG5cdFx0XHR0ZXh0RmlsZVNlcnZpY2UsXG5cdFx0XHRlZGl0b3JTZXJ2aWNlLFxuXHRcdFx0ZmlsZVNlcnZpY2UsXG5cdFx0XHRsYWJlbFNlcnZpY2UsXG5cdFx0XHRmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdFx0dGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRjdXN0b21FZGl0b3JMYWJlbFNlcnZpY2Vcblx0XHQpO1xuXHR9XG59XG5cbmNsYXNzIFBlcmZNb2RlbENvbnRlbnRQcm92aWRlciBpbXBsZW1lbnRzIElUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIge1xuXG5cdHByaXZhdGUgX21vZGVsOiBJVGV4dE1vZGVsIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9tb2RlbERpc3Bvc2FibGVzOiBJRGlzcG9zYWJsZVtdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASUNvZGVFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASUxpZmVjeWNsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElUaW1lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGltZXJTZXJ2aWNlOiBJVGltZXJTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Byb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsU2VydmljZTogSVRlcm1pbmFsU2VydmljZVxuXHQpIHsgfVxuXG5cdHByb3ZpZGVUZXh0Q29udGVudChyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxJVGV4dE1vZGVsPiB7XG5cblx0XHRpZiAoIXRoaXMuX21vZGVsIHx8IHRoaXMuX21vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0ZGlzcG9zZSh0aGlzLl9tb2RlbERpc3Bvc2FibGVzKTtcblx0XHRcdGNvbnN0IGxhbmdJZCA9IHRoaXMuX2xhbmd1YWdlU2VydmljZS5jcmVhdGVCeUlkKCdtYXJrZG93bicpO1xuXHRcdFx0dGhpcy5fbW9kZWwgPSB0aGlzLl9tb2RlbFNlcnZpY2UuZ2V0TW9kZWwocmVzb3VyY2UpIHx8IHRoaXMuX21vZGVsU2VydmljZS5jcmVhdGVNb2RlbCgnTG9hZGluZy4uLicsIGxhbmdJZCwgcmVzb3VyY2UpO1xuXG5cdFx0XHR0aGlzLl9tb2RlbERpc3Bvc2FibGVzLnB1c2gobGFuZ0lkLm9uRGlkQ2hhbmdlKGUgPT4ge1xuXHRcdFx0XHR0aGlzLl9tb2RlbD8uc2V0TGFuZ3VhZ2UoZSk7XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9tb2RlbERpc3Bvc2FibGVzLnB1c2godGhpcy5fZXh0ZW5zaW9uU2VydmljZS5vbkRpZENoYW5nZUV4dGVuc2lvbnNTdGF0dXModGhpcy5fdXBkYXRlTW9kZWwsIHRoaXMpKTtcblxuXHRcdFx0d3JpdGVUcmFuc2llbnRTdGF0ZSh0aGlzLl9tb2RlbCwgeyB3b3JkV3JhcE92ZXJyaWRlOiAnb2ZmJyB9LCB0aGlzLl9lZGl0b3JTZXJ2aWNlKTtcblx0XHR9XG5cdFx0dGhpcy5fdXBkYXRlTW9kZWwoKTtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX21vZGVsKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZU1vZGVsKCk6IHZvaWQge1xuXG5cdFx0UHJvbWlzZS5hbGwoW1xuXHRcdFx0dGhpcy5fdGltZXJTZXJ2aWNlLndoZW5SZWFkeSgpLFxuXHRcdFx0dGhpcy5fbGlmZWN5Y2xlU2VydmljZS53aGVuKExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpLFxuXHRcdFx0dGhpcy5fZXh0ZW5zaW9uU2VydmljZS53aGVuSW5zdGFsbGVkRXh0ZW5zaW9uc1JlZ2lzdGVyZWQoKSxcblx0XHRcdC8vIFRoZSB0ZXJtaW5hbCBzZXJ2aWNlIG5ldmVyIGNvbm5lY3RzIHRvIHRoZSBwdHkgaG9zdCBvbiB0aGUgd2ViXG5cdFx0XHRpc1dlYiAmJiAhdGhpcy5fcmVtb3RlQWdlbnRTZXJ2aWNlLmdldENvbm5lY3Rpb24oKT8ucmVtb3RlQXV0aG9yaXR5ID8gUHJvbWlzZS5yZXNvbHZlKCkgOiB0aGlzLl90ZXJtaW5hbFNlcnZpY2Uud2hlbkNvbm5lY3RlZFxuXHRcdF0pLnRoZW4oKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX21vZGVsICYmICF0aGlzLl9tb2RlbC5pc0Rpc3Bvc2VkKCkpIHtcblxuXHRcdFx0XHRjb25zdCBtZCA9IG5ldyBNYXJrZG93bkJ1aWxkZXIoKTtcblx0XHRcdFx0dGhpcy5fYWRkU3VtbWFyeShtZCk7XG5cdFx0XHRcdG1kLmJsYW5rKCk7XG5cdFx0XHRcdHRoaXMuX2FkZFN1bW1hcnlUYWJsZShtZCk7XG5cdFx0XHRcdG1kLmJsYW5rKCk7XG5cdFx0XHRcdHRoaXMuX2FkZEV4dGVuc2lvbnNUYWJsZShtZCk7XG5cdFx0XHRcdG1kLmJsYW5rKCk7XG5cdFx0XHRcdHRoaXMuX2FkZFBlcmZNYXJrc1RhYmxlKCdUZXJtaW5hbCBTdGF0cycsIG1kLCB0aGlzLl90aW1lclNlcnZpY2UuZ2V0UGVyZm9ybWFuY2VNYXJrcygpLmZpbmQoZSA9PiBlWzBdID09PSAncmVuZGVyZXInKT8uWzFdLmZpbHRlcihlID0+IGUubmFtZS5zdGFydHNXaXRoKCdjb2RlL3Rlcm1pbmFsLycpKSk7XG5cdFx0XHRcdG1kLmJsYW5rKCk7XG5cdFx0XHRcdHRoaXMuX2FkZFdvcmtiZW5jaENvbnRyaWJ1dGlvbnNQZXJmTWFya3NUYWJsZShtZCk7XG5cdFx0XHRcdG1kLmJsYW5rKCk7XG5cdFx0XHRcdHRoaXMuX2FkZFJhd1BlcmZNYXJrcyhtZCk7XG5cdFx0XHRcdG1kLmJsYW5rKCk7XG5cdFx0XHRcdHRoaXMuX2FkZFJlc291cmNlVGltaW5nU3RhdHMobWQpO1xuXG5cdFx0XHRcdHRoaXMuX21vZGVsLnNldFZhbHVlKG1kLnZhbHVlKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHR9XG5cblx0cHJpdmF0ZSBfYWRkU3VtbWFyeShtZDogTWFya2Rvd25CdWlsZGVyKTogdm9pZCB7XG5cdFx0Y29uc3QgbWV0cmljcyA9IHRoaXMuX3RpbWVyU2VydmljZS5zdGFydHVwTWV0cmljcztcblx0XHRtZC5oZWFkaW5nKDIsICdTeXN0ZW0gSW5mbycpO1xuXHRcdG1kLmxpKGAke3RoaXMuX3Byb2R1Y3RTZXJ2aWNlLm5hbWVTaG9ydH06ICR7dGhpcy5fcHJvZHVjdFNlcnZpY2UudmVyc2lvbn0gKCR7dGhpcy5fcHJvZHVjdFNlcnZpY2UuY29tbWl0IHx8ICcwMDAwMDAwJ30pYCk7XG5cdFx0bWQubGkoYE9TOiAke21ldHJpY3MucGxhdGZvcm19KCR7bWV0cmljcy5yZWxlYXNlfSlgKTtcblx0XHRpZiAobWV0cmljcy5jcHVzKSB7XG5cdFx0XHRtZC5saShgQ1BVczogJHttZXRyaWNzLmNwdXMubW9kZWx9KCR7bWV0cmljcy5jcHVzLmNvdW50fSB4ICR7bWV0cmljcy5jcHVzLnNwZWVkfSlgKTtcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBtZXRyaWNzLnRvdGFsbWVtID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgbWV0cmljcy5mcmVlbWVtID09PSAnbnVtYmVyJykge1xuXHRcdFx0bWQubGkoYE1lbW9yeShTeXN0ZW0pOiAkeyhtZXRyaWNzLnRvdGFsbWVtIC8gKEJ5dGVTaXplLkdCKSkudG9GaXhlZCgyKX0gR0IoJHsobWV0cmljcy5mcmVlbWVtIC8gKEJ5dGVTaXplLkdCKSkudG9GaXhlZCgyKX1HQiBmcmVlKWApO1xuXHRcdH1cblx0XHRpZiAobWV0cmljcy5tZW1pbmZvKSB7XG5cdFx0XHRtZC5saShgTWVtb3J5KFByb2Nlc3MpOiAkeyhtZXRyaWNzLm1lbWluZm8ud29ya2luZ1NldFNpemUgLyBCeXRlU2l6ZS5LQikudG9GaXhlZCgyKX0gTUIgd29ya2luZyBzZXQoJHsobWV0cmljcy5tZW1pbmZvLnByaXZhdGVCeXRlcyAvIEJ5dGVTaXplLktCKS50b0ZpeGVkKDIpfU1CIHByaXZhdGUsICR7KG1ldHJpY3MubWVtaW5mby5zaGFyZWRCeXRlcyAvIEJ5dGVTaXplLktCKS50b0ZpeGVkKDIpfU1CIHNoYXJlZClgKTtcblx0XHR9XG5cdFx0bWQubGkoYFZNKGxpa2VsaWhvb2QpOiAke21ldHJpY3MuaXNWTUxpa2VseWhvb2R9JWApO1xuXHRcdG1kLmxpKGBJbml0aWFsIFN0YXJ0dXA6ICR7bWV0cmljcy5pbml0aWFsU3RhcnR1cH1gKTtcblx0XHRtZC5saShgSGFzICR7bWV0cmljcy53aW5kb3dDb3VudCAtIDF9IG90aGVyIHdpbmRvd3NgKTtcblx0XHRtZC5saShgU2NyZWVuIFJlYWRlciBBY3RpdmU6ICR7bWV0cmljcy5oYXNBY2Nlc3NpYmlsaXR5U3VwcG9ydH1gKTtcblx0XHRtZC5saShgRW1wdHkgV29ya3NwYWNlOiAke21ldHJpY3MuZW1wdHlXb3JrYmVuY2h9YCk7XG5cdH1cblxuXHRwcml2YXRlIF9hZGRTdW1tYXJ5VGFibGUobWQ6IE1hcmtkb3duQnVpbGRlcik6IHZvaWQge1xuXG5cdFx0Y29uc3QgbWV0cmljcyA9IHRoaXMuX3RpbWVyU2VydmljZS5zdGFydHVwTWV0cmljcztcblx0XHRjb25zdCBjb250cmliVGltaW5ncyA9IFJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKS50aW1pbmdzO1xuXG5cdFx0Y29uc3QgdGFibGU6IEFycmF5PEFycmF5PHN0cmluZyB8IG51bWJlciB8IHVuZGVmaW5lZD4+ID0gW107XG5cdFx0dGFibGUucHVzaChbJ3N0YXJ0ID0+IGFwcC5pc1JlYWR5JywgbWV0cmljcy50aW1lcnMuZWxsYXBzZWRBcHBSZWFkeSwgJ1ttYWluXScsIGBpbml0aWFsIHN0YXJ0dXA6ICR7bWV0cmljcy5pbml0aWFsU3RhcnR1cH1gXSk7XG5cdFx0dGFibGUucHVzaChbJ25sczpzdGFydCA9PiBubHM6ZW5kJywgbWV0cmljcy50aW1lcnMuZWxsYXBzZWRObHNHZW5lcmF0aW9uLCAnW21haW5dJywgYGluaXRpYWwgc3RhcnR1cDogJHttZXRyaWNzLmluaXRpYWxTdGFydHVwfWBdKTtcblx0XHR0YWJsZS5wdXNoKFsnaW1wb3J0KG1haW4uanMpJywgbWV0cmljcy50aW1lcnMuZWxsYXBzZWRMb2FkTWFpbkJ1bmRsZSwgJ1ttYWluXScsIGBpbml0aWFsIHN0YXJ0dXA6ICR7bWV0cmljcy5pbml0aWFsU3RhcnR1cH1gXSk7XG5cdFx0dGFibGUucHVzaChbJ3J1biBtYWluLmpzJywgbWV0cmljcy50aW1lcnMuZWxsYXBzZWRSdW5NYWluQnVuZGxlLCAnW21haW5dJywgYGluaXRpYWwgc3RhcnR1cDogJHttZXRyaWNzLmluaXRpYWxTdGFydHVwfWBdKTtcblx0XHR0YWJsZS5wdXNoKFsnc3RhcnQgY3Jhc2ggcmVwb3J0ZXInLCBtZXRyaWNzLnRpbWVycy5lbGxhcHNlZENyYXNoUmVwb3J0ZXIsICdbbWFpbl0nLCBgaW5pdGlhbCBzdGFydHVwOiAke21ldHJpY3MuaW5pdGlhbFN0YXJ0dXB9YF0pO1xuXHRcdHRhYmxlLnB1c2goWydzZXJ2ZSBtYWluIElQQyBoYW5kbGUnLCBtZXRyaWNzLnRpbWVycy5lbGxhcHNlZE1haW5TZXJ2ZXIsICdbbWFpbl0nLCBgaW5pdGlhbCBzdGFydHVwOiAke21ldHJpY3MuaW5pdGlhbFN0YXJ0dXB9YF0pO1xuXHRcdHRhYmxlLnB1c2goWydjcmVhdGUgd2luZG93JywgbWV0cmljcy50aW1lcnMuZWxsYXBzZWRXaW5kb3dDcmVhdGUsICdbbWFpbl0nLCBgaW5pdGlhbCBzdGFydHVwOiAke21ldHJpY3MuaW5pdGlhbFN0YXJ0dXB9LCAke21ldHJpY3MuaW5pdGlhbFN0YXJ0dXAgPyBgc3RhdGU6ICR7bWV0cmljcy50aW1lcnMuZWxsYXBzZWRXaW5kb3dSZXN0b3JlU3RhdGV9bXMsIHdpZGdldDogJHttZXRyaWNzLnRpbWVycy5lbGxhcHNlZEJyb3dzZXJXaW5kb3dDcmVhdGV9bXMsIHNob3c6ICR7bWV0cmljcy50aW1lcnMuZWxsYXBzZWRXaW5kb3dNYXhpbWl6ZX1tc2AgOiAnJ31gXSk7XG5cdFx0dGFibGUucHVzaChbJ2FwcC5pc1JlYWR5ID0+IHdpbmRvdy5sb2FkVXJsKCknLCBtZXRyaWNzLnRpbWVycy5lbGxhcHNlZFdpbmRvd0xvYWQsICdbbWFpbl0nLCBgaW5pdGlhbCBzdGFydHVwOiAke21ldHJpY3MuaW5pdGlhbFN0YXJ0dXB9YF0pO1xuXHRcdHRhYmxlLnB1c2goWyd3aW5kb3cubG9hZFVybCgpID0+IGJlZ2luIHRvIGltcG9ydCh3b3JrYmVuY2guZGVza3RvcC5tYWluLmpzKScsIG1ldHJpY3MudGltZXJzLmVsbGFwc2VkV2luZG93TG9hZFRvUmVxdWlyZSwgJ1ttYWluLT5yZW5kZXJlcl0nLCBTdGFydHVwS2luZFRvU3RyaW5nKG1ldHJpY3Mud2luZG93S2luZCldKTtcblx0XHR0YWJsZS5wdXNoKFsnaW1wb3J0KHdvcmtiZW5jaC5kZXNrdG9wLm1haW4uanMpJywgbWV0cmljcy50aW1lcnMuZWxsYXBzZWRSZXF1aXJlLCAnW3JlbmRlcmVyXScsIGBjYWNoZWQgZGF0YTogJHsobWV0cmljcy5kaWRVc2VDYWNoZWREYXRhID8gJ1lFUycgOiAnTk8nKX1gXSk7XG5cdFx0dGFibGUucHVzaChbJ3dhaXQgZm9yIHdpbmRvdyBjb25maWcnLCBtZXRyaWNzLnRpbWVycy5lbGxhcHNlZFdhaXRGb3JXaW5kb3dDb25maWcsICdbcmVuZGVyZXJdJywgdW5kZWZpbmVkXSk7XG5cdFx0dGFibGUucHVzaChbJ2luaXQgc3RvcmFnZSAoZ2xvYmFsICYgd29ya3NwYWNlKScsIG1ldHJpY3MudGltZXJzLmVsbGFwc2VkU3RvcmFnZUluaXQsICdbcmVuZGVyZXJdJywgdW5kZWZpbmVkXSk7XG5cdFx0dGFibGUucHVzaChbJ2luaXQgd29ya3NwYWNlIHNlcnZpY2UnLCBtZXRyaWNzLnRpbWVycy5lbGxhcHNlZFdvcmtzcGFjZVNlcnZpY2VJbml0LCAnW3JlbmRlcmVyXScsIHVuZGVmaW5lZF0pO1xuXHRcdGlmIChpc1dlYikge1xuXHRcdFx0dGFibGUucHVzaChbJ2luaXQgc2V0dGluZ3MgYW5kIGdsb2JhbCBzdGF0ZSBmcm9tIHNldHRpbmdzIHN5bmMgc2VydmljZScsIG1ldHJpY3MudGltZXJzLmVsbGFwc2VkUmVxdWlyZWRVc2VyRGF0YUluaXQsICdbcmVuZGVyZXJdJywgdW5kZWZpbmVkXSk7XG5cdFx0XHR0YWJsZS5wdXNoKFsnaW5pdCBrZXliaW5kaW5ncywgc25pcHBldHMgJiBleHRlbnNpb25zIGZyb20gc2V0dGluZ3Mgc3luYyBzZXJ2aWNlJywgbWV0cmljcy50aW1lcnMuZWxsYXBzZWRPdGhlclVzZXJEYXRhSW5pdCwgJ1tyZW5kZXJlcl0nLCB1bmRlZmluZWRdKTtcblx0XHR9XG5cdFx0dGFibGUucHVzaChbJ3JlZ2lzdGVyIGV4dGVuc2lvbnMgJiBzcGF3biBleHRlbnNpb24gaG9zdCcsIG1ldHJpY3MudGltZXJzLmVsbGFwc2VkRXh0ZW5zaW9ucywgJ1tyZW5kZXJlcl0nLCB1bmRlZmluZWRdKTtcblx0XHR0YWJsZS5wdXNoKFsncmVzdG9yZSB2aWV3bGV0JywgbWV0cmljcy50aW1lcnMuZWxsYXBzZWRWaWV3bGV0UmVzdG9yZSwgJ1tyZW5kZXJlcl0nLCBtZXRyaWNzLnZpZXdsZXRJZF0pO1xuXHRcdHRhYmxlLnB1c2goWydyZXN0b3JlIHBhbmVsJywgbWV0cmljcy50aW1lcnMuZWxsYXBzZWRQYW5lbFJlc3RvcmUsICdbcmVuZGVyZXJdJywgbWV0cmljcy5wYW5lbElkXSk7XG5cdFx0dGFibGUucHVzaChbJ3Jlc3RvcmUgJiByZXNvbHZlIHZpc2libGUgZWRpdG9ycycsIG1ldHJpY3MudGltZXJzLmVsbGFwc2VkRWRpdG9yUmVzdG9yZSwgJ1tyZW5kZXJlcl0nLCBgJHttZXRyaWNzLmVkaXRvcklkcy5sZW5ndGh9OiAke21ldHJpY3MuZWRpdG9ySWRzLmpvaW4oJywgJyl9YF0pO1xuXHRcdHRhYmxlLnB1c2goWydjcmVhdGUgd29ya2JlbmNoIGNvbnRyaWJ1dGlvbnMnLCBtZXRyaWNzLnRpbWVycy5lbGxhcHNlZFdvcmtiZW5jaENvbnRyaWJ1dGlvbnMsICdbcmVuZGVyZXJdJywgYCR7KGNvbnRyaWJUaW1pbmdzLmdldChMaWZlY3ljbGVQaGFzZS5TdGFydGluZyk/Lmxlbmd0aCA/PyAwKSArIChjb250cmliVGltaW5ncy5nZXQoTGlmZWN5Y2xlUGhhc2UuU3RhcnRpbmcpPy5sZW5ndGggPz8gMCl9IGJsb2NraW5nIHN0YXJ0dXBgXSk7XG5cdFx0dGFibGUucHVzaChbJ292ZXJhbGwgd29ya2JlbmNoIGxvYWQnLCBtZXRyaWNzLnRpbWVycy5lbGxhcHNlZFdvcmtiZW5jaCwgJ1tyZW5kZXJlcl0nLCB1bmRlZmluZWRdKTtcblx0XHR0YWJsZS5wdXNoKFsnd29ya2JlbmNoIHJlYWR5JywgbWV0cmljcy5lbGxhcHNlZCwgJ1ttYWluLT5yZW5kZXJlcl0nLCB1bmRlZmluZWRdKTtcblx0XHR0YWJsZS5wdXNoKFsncmVuZGVyZXIgcmVhZHknLCBtZXRyaWNzLnRpbWVycy5lbGxhcHNlZFJlbmRlcmVyLCAnW3JlbmRlcmVyXScsIHVuZGVmaW5lZF0pO1xuXHRcdHRhYmxlLnB1c2goWydzaGFyZWQgcHJvY2VzcyBjb25uZWN0aW9uIHJlYWR5JywgbWV0cmljcy50aW1lcnMuZWxsYXBzZWRTaGFyZWRQcm9jZXNDb25uZWN0ZWQsICdbcmVuZGVyZXItPnNoYXJlZHByb2Nlc3NdJywgdW5kZWZpbmVkXSk7XG5cdFx0dGFibGUucHVzaChbJ2V4dGVuc2lvbnMgcmVnaXN0ZXJlZCcsIG1ldHJpY3MudGltZXJzLmVsbGFwc2VkRXh0ZW5zaW9uc1JlYWR5LCAnW3JlbmRlcmVyXScsIHVuZGVmaW5lZF0pO1xuXG5cdFx0bWQuaGVhZGluZygyLCAnUGVyZm9ybWFuY2UgTWFya3MnKTtcblx0XHRtZC50YWJsZShbJ1doYXQnLCAnRHVyYXRpb24nLCAnUHJvY2VzcycsICdJbmZvJ10sIHRhYmxlKTtcblx0fVxuXG5cdHByaXZhdGUgX2FkZEV4dGVuc2lvbnNUYWJsZShtZDogTWFya2Rvd25CdWlsZGVyKTogdm9pZCB7XG5cblx0XHRjb25zdCBlYWdlcjogKHsgdG9TdHJpbmcoKTogc3RyaW5nIH0pW11bXSA9IFtdO1xuXHRcdGNvbnN0IG5vcm1hbDogKHsgdG9TdHJpbmcoKTogc3RyaW5nIH0pW11bXSA9IFtdO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNTdGF0dXMgPSB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLmdldEV4dGVuc2lvbnNTdGF0dXMoKTtcblx0XHRmb3IgKGNvbnN0IGlkIGluIGV4dGVuc2lvbnNTdGF0dXMpIHtcblx0XHRcdGNvbnN0IHsgYWN0aXZhdGlvblRpbWVzOiB0aW1lcyB9ID0gZXh0ZW5zaW9uc1N0YXR1c1tpZF07XG5cdFx0XHRpZiAoIXRpbWVzKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRpbWVzLmFjdGl2YXRpb25SZWFzb24uc3RhcnR1cCkge1xuXHRcdFx0XHRlYWdlci5wdXNoKFtpZCwgdGltZXMuYWN0aXZhdGlvblJlYXNvbi5zdGFydHVwLCB0aW1lcy5jb2RlTG9hZGluZ1RpbWUsIHRpbWVzLmFjdGl2YXRlQ2FsbFRpbWUsIHRpbWVzLmFjdGl2YXRlUmVzb2x2ZWRUaW1lLCB0aW1lcy5hY3RpdmF0aW9uUmVhc29uLmFjdGl2YXRpb25FdmVudCwgdGltZXMuYWN0aXZhdGlvblJlYXNvbi5leHRlbnNpb25JZC52YWx1ZV0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bm9ybWFsLnB1c2goW2lkLCB0aW1lcy5hY3RpdmF0aW9uUmVhc29uLnN0YXJ0dXAsIHRpbWVzLmNvZGVMb2FkaW5nVGltZSwgdGltZXMuYWN0aXZhdGVDYWxsVGltZSwgdGltZXMuYWN0aXZhdGVSZXNvbHZlZFRpbWUsIHRpbWVzLmFjdGl2YXRpb25SZWFzb24uYWN0aXZhdGlvbkV2ZW50LCB0aW1lcy5hY3RpdmF0aW9uUmVhc29uLmV4dGVuc2lvbklkLnZhbHVlXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGFibGUgPSBlYWdlci5jb25jYXQobm9ybWFsKTtcblx0XHRpZiAodGFibGUubGVuZ3RoID4gMCkge1xuXHRcdFx0bWQuaGVhZGluZygyLCAnRXh0ZW5zaW9uIEFjdGl2YXRpb24gU3RhdHMnKTtcblx0XHRcdG1kLnRhYmxlKFxuXHRcdFx0XHRbJ0V4dGVuc2lvbicsICdFYWdlcicsICdMb2FkIENvZGUnLCAnQ2FsbCBBY3RpdmF0ZScsICdGaW5pc2ggQWN0aXZhdGUnLCAnRXZlbnQnLCAnQnknXSxcblx0XHRcdFx0dGFibGVcblx0XHRcdCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfYWRkUGVyZk1hcmtzVGFibGUobmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkLCBtZDogTWFya2Rvd25CdWlsZGVyLCBtYXJrczogcmVhZG9ubHkgcGVyZi5QZXJmb3JtYW5jZU1hcmtbXSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICghbWFya3MpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgdGFibGU6IEFycmF5PEFycmF5PHN0cmluZyB8IG51bWJlciB8IHVuZGVmaW5lZD4+ID0gW107XG5cdFx0bGV0IGxhc3RTdGFydFRpbWUgPSAtMTtcblx0XHRsZXQgdG90YWwgPSAwO1xuXHRcdGZvciAoY29uc3QgeyBuYW1lLCBzdGFydFRpbWUgfSBvZiBtYXJrcykge1xuXHRcdFx0Y29uc3QgZGVsdGEgPSBsYXN0U3RhcnRUaW1lICE9PSAtMSA/IHN0YXJ0VGltZSAtIGxhc3RTdGFydFRpbWUgOiAwO1xuXHRcdFx0dG90YWwgKz0gZGVsdGE7XG5cdFx0XHR0YWJsZS5wdXNoKFtuYW1lLCBNYXRoLnJvdW5kKHN0YXJ0VGltZSksIE1hdGgucm91bmQoZGVsdGEpLCBNYXRoLnJvdW5kKHRvdGFsKV0pO1xuXHRcdFx0bGFzdFN0YXJ0VGltZSA9IHN0YXJ0VGltZTtcblx0XHR9XG5cdFx0aWYgKG5hbWUpIHtcblx0XHRcdG1kLmhlYWRpbmcoMiwgbmFtZSk7XG5cdFx0fVxuXHRcdG1kLnRhYmxlKFsnTmFtZScsICdUaW1lc3RhbXAnLCAnRGVsdGEnLCAnVG90YWwnXSwgdGFibGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWRkV29ya2JlbmNoQ29udHJpYnV0aW9uc1BlcmZNYXJrc1RhYmxlKG1kOiBNYXJrZG93bkJ1aWxkZXIpOiB2b2lkIHtcblx0XHRtZC5oZWFkaW5nKDIsICdXb3JrYmVuY2ggQ29udHJpYnV0aW9ucyBCbG9ja2luZyBSZXN0b3JlJyk7XG5cblx0XHRjb25zdCB0aW1pbmdzID0gUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpLnRpbWluZ3M7XG5cdFx0bWQubGkoYFRvdGFsIChMaWZlY3ljbGVQaGFzZS5TdGFydGluZyk6ICR7dGltaW5ncy5nZXQoTGlmZWN5Y2xlUGhhc2UuU3RhcnRpbmcpPy5sZW5ndGh9ICgke3RpbWluZ3MuZ2V0KExpZmVjeWNsZVBoYXNlLlN0YXJ0aW5nKT8ucmVkdWNlKChwLCBjKSA9PiBwICsgY1sxXSwgMCl9bXMpYCk7XG5cdFx0bWQubGkoYFRvdGFsIChMaWZlY3ljbGVQaGFzZS5SZWFkeSk6ICR7dGltaW5ncy5nZXQoTGlmZWN5Y2xlUGhhc2UuUmVhZHkpPy5sZW5ndGh9ICgke3RpbWluZ3MuZ2V0KExpZmVjeWNsZVBoYXNlLlJlYWR5KT8ucmVkdWNlKChwLCBjKSA9PiBwICsgY1sxXSwgMCl9bXMpYCk7XG5cdFx0bWQuYmxhbmsoKTtcblxuXHRcdGNvbnN0IG1hcmtzID0gdGhpcy5fdGltZXJTZXJ2aWNlLmdldFBlcmZvcm1hbmNlTWFya3MoKS5maW5kKGUgPT4gZVswXSA9PT0gJ3JlbmRlcmVyJyk/LlsxXS5maWx0ZXIoZSA9PlxuXHRcdFx0ZS5uYW1lLnN0YXJ0c1dpdGgoJ2NvZGUvd2lsbENyZWF0ZVdvcmtiZW5jaENvbnRyaWJ1dGlvbi8xJykgfHxcblx0XHRcdGUubmFtZS5zdGFydHNXaXRoKCdjb2RlL2RpZENyZWF0ZVdvcmtiZW5jaENvbnRyaWJ1dGlvbi8xJykgfHxcblx0XHRcdGUubmFtZS5zdGFydHNXaXRoKCdjb2RlL3dpbGxDcmVhdGVXb3JrYmVuY2hDb250cmlidXRpb24vMicpIHx8XG5cdFx0XHRlLm5hbWUuc3RhcnRzV2l0aCgnY29kZS9kaWRDcmVhdGVXb3JrYmVuY2hDb250cmlidXRpb24vMicpXG5cdFx0KTtcblx0XHR0aGlzLl9hZGRQZXJmTWFya3NUYWJsZSh1bmRlZmluZWQsIG1kLCBtYXJrcyk7XG5cdH1cblxuXHRwcml2YXRlIF9hZGRSYXdQZXJmTWFya3MobWQ6IE1hcmtkb3duQnVpbGRlcik6IHZvaWQge1xuXG5cdFx0Zm9yIChjb25zdCBbc291cmNlLCBtYXJrc10gb2YgdGhpcy5fdGltZXJTZXJ2aWNlLmdldFBlcmZvcm1hbmNlTWFya3MoKSkge1xuXHRcdFx0bWQuaGVhZGluZygyLCBgUmF3IFBlcmYgTWFya3M6ICR7c291cmNlfWApO1xuXHRcdFx0bWQudmFsdWUgKz0gJ2BgYFxcbic7XG5cdFx0XHRtZC52YWx1ZSArPSBgTmFtZVxcdFRpbWVzdGFtcFxcdERlbHRhXFx0VG90YWxcXG5gO1xuXHRcdFx0bGV0IGxhc3RTdGFydFRpbWUgPSAtMTtcblx0XHRcdGxldCB0b3RhbCA9IDA7XG5cdFx0XHRmb3IgKGNvbnN0IHsgbmFtZSwgc3RhcnRUaW1lIH0gb2YgbWFya3MpIHtcblx0XHRcdFx0Y29uc3QgZGVsdGEgPSBsYXN0U3RhcnRUaW1lICE9PSAtMSA/IHN0YXJ0VGltZSAtIGxhc3RTdGFydFRpbWUgOiAwO1xuXHRcdFx0XHR0b3RhbCArPSBkZWx0YTtcblx0XHRcdFx0bWQudmFsdWUgKz0gYCR7bmFtZX1cXHQke3N0YXJ0VGltZX1cXHQke2RlbHRhfVxcdCR7dG90YWx9XFxuYDtcblx0XHRcdFx0bGFzdFN0YXJ0VGltZSA9IHN0YXJ0VGltZTtcblx0XHRcdH1cblx0XHRcdG1kLnZhbHVlICs9ICdgYGBcXG4nO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2FkZFJlc291cmNlVGltaW5nU3RhdHMobWQ6IE1hcmtkb3duQnVpbGRlcikge1xuXHRcdGNvbnN0IHN0YXRzID0gcGVyZm9ybWFuY2UuZ2V0RW50cmllc0J5VHlwZSgncmVzb3VyY2UnKS5tYXAoZW50cnkgPT4ge1xuXHRcdFx0cmV0dXJuIFtlbnRyeS5uYW1lLCBlbnRyeS5kdXJhdGlvbl07XG5cdFx0fSk7XG5cdFx0aWYgKCFzdGF0cy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bWQuaGVhZGluZygyLCAnUmVzb3VyY2UgVGltaW5nIFN0YXRzJyk7XG5cdFx0bWQudGFibGUoWydOYW1lJywgJ0R1cmF0aW9uJ10sIHN0YXRzKTtcblx0fVxufVxuXG5jbGFzcyBNYXJrZG93bkJ1aWxkZXIge1xuXG5cdHZhbHVlOiBzdHJpbmcgPSAnJztcblxuXHRoZWFkaW5nKGxldmVsOiBudW1iZXIsIHZhbHVlOiBzdHJpbmcpOiB0aGlzIHtcblx0XHR0aGlzLnZhbHVlICs9IGAkeycjJy5yZXBlYXQobGV2ZWwpfSAke3ZhbHVlfVxcblxcbmA7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRibGFuaygpIHtcblx0XHR0aGlzLnZhbHVlICs9ICdcXG4nO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0bGkodmFsdWU6IHN0cmluZykge1xuXHRcdHRoaXMudmFsdWUgKz0gYCogJHt2YWx1ZX1cXG5gO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0dGFibGUoaGVhZGVyOiBzdHJpbmdbXSwgcm93czogQXJyYXk8QXJyYXk8eyB0b1N0cmluZygpOiBzdHJpbmcgfSB8IHVuZGVmaW5lZD4+KSB7XG5cdFx0dGhpcy52YWx1ZSArPSB0aGlzLnRvTWFya2Rvd25UYWJsZShoZWFkZXIsIHJvd3MpO1xuXHR9XG5cblx0cHJpdmF0ZSB0b01hcmtkb3duVGFibGUoaGVhZGVyOiBzdHJpbmdbXSwgcm93czogQXJyYXk8QXJyYXk8eyB0b1N0cmluZygpOiBzdHJpbmcgfSB8IHVuZGVmaW5lZD4+KTogc3RyaW5nIHtcblx0XHRsZXQgcmVzdWx0ID0gJyc7XG5cblx0XHRjb25zdCBsZW5ndGhzOiBudW1iZXJbXSA9IFtdO1xuXHRcdGhlYWRlci5mb3JFYWNoKChjZWxsLCBjaSkgPT4ge1xuXHRcdFx0bGVuZ3Roc1tjaV0gPSBjZWxsLmxlbmd0aDtcblx0XHR9KTtcblx0XHRyb3dzLmZvckVhY2gocm93ID0+IHtcblx0XHRcdHJvdy5mb3JFYWNoKChjZWxsLCBjaSkgPT4ge1xuXHRcdFx0XHRpZiAodHlwZW9mIGNlbGwgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRcdFx0Y2VsbCA9IHJvd1tjaV0gPSAnLSc7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgbGVuID0gY2VsbC50b1N0cmluZygpLmxlbmd0aDtcblx0XHRcdFx0bGVuZ3Roc1tjaV0gPSBNYXRoLm1heChsZW4sIGxlbmd0aHNbY2ldKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0Ly8gaGVhZGVyXG5cdFx0aGVhZGVyLmZvckVhY2goKGNlbGwsIGNpKSA9PiB7IHJlc3VsdCArPSBgfCAke2NlbGwgKyAnICcucmVwZWF0KGxlbmd0aHNbY2ldIC0gY2VsbC50b1N0cmluZygpLmxlbmd0aCl9IGA7IH0pO1xuXHRcdHJlc3VsdCArPSAnfFxcbic7XG5cdFx0aGVhZGVyLmZvckVhY2goKF9jZWxsLCBjaSkgPT4geyByZXN1bHQgKz0gYHwgJHsnLScucmVwZWF0KGxlbmd0aHNbY2ldKX0gYDsgfSk7XG5cdFx0cmVzdWx0ICs9ICd8XFxuJztcblxuXHRcdC8vIGNlbGxzXG5cdFx0cm93cy5mb3JFYWNoKHJvdyA9PiB7XG5cdFx0XHRyb3cuZm9yRWFjaCgoY2VsbCwgY2kpID0+IHtcblx0XHRcdFx0aWYgKHR5cGVvZiBjZWxsICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRcdHJlc3VsdCArPSBgfCAke2NlbGwgKyAnICcucmVwZWF0KGxlbmd0aHNbY2ldIC0gY2VsbC50b1N0cmluZygpLmxlbmd0aCl9IGA7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0cmVzdWx0ICs9ICd8XFxuJztcblx0XHR9KTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMseUJBQW9EO0FBRTdELFNBQVMsbUJBQW1CLGdCQUFnQiwyQkFBMkI7QUFDdkUsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBc0IsZUFBZTtBQUNyQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHVCQUF1QjtBQUNo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
