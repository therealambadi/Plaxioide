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
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { distinct } from "../../../../base/common/arrays.js";
import { Queue, RunOnceScheduler, raceTimeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { canceled } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { normalizeDriveLetter } from "../../../../base/common/labels.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable, dispose } from "../../../../base/common/lifecycle.js";
import { mixin } from "../../../../base/common/objects.js";
import * as platform from "../../../../base/common/platform.js";
import * as resources from "../../../../base/common/resources.js";
import Severity from "../../../../base/common/severity.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ICustomEndpointTelemetryService, ITelemetryService, TelemetryLevel } from "../../../../platform/telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { ViewContainerLocation } from "../../../common/views.js";
import { RawDebugSession } from "./rawDebugSession.js";
import { IDebugService, State, VIEWLET_ID, isFrameDeemphasized } from "../common/debug.js";
import { ExpressionContainer, MemoryRegion, Thread } from "../common/debugModel.js";
import { Source } from "../common/debugSource.js";
import { filterExceptionsFromTelemetry } from "../common/debugUtils.js";
import { ReplModel } from "../common/replModel.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { getActiveWindow } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { isDefined } from "../../../../base/common/types.js";
import { ITestService } from "../../testing/common/testService.js";
import { ITestResultService } from "../../testing/common/testResultService.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
const TRIGGERED_BREAKPOINT_MAX_DELAY = 1500;
let DebugSession = class {
  constructor(id, _configuration, root, model, options, debugService, telemetryService, hostService, configurationService, paneCompositeService, workspaceContextService, productService, notificationService, lifecycleService, uriIdentityService, instantiationService, customEndpointTelemetryService, workbenchEnvironmentService, logService, testService, testResultService, accessibilityService) {
    this.id = id;
    this._configuration = _configuration;
    this.root = root;
    this.model = model;
    this.debugService = debugService;
    this.telemetryService = telemetryService;
    this.hostService = hostService;
    this.configurationService = configurationService;
    this.paneCompositeService = paneCompositeService;
    this.workspaceContextService = workspaceContextService;
    this.productService = productService;
    this.notificationService = notificationService;
    this.uriIdentityService = uriIdentityService;
    this.instantiationService = instantiationService;
    this.customEndpointTelemetryService = customEndpointTelemetryService;
    this.workbenchEnvironmentService = workbenchEnvironmentService;
    this.logService = logService;
    this.testService = testService;
    this.accessibilityService = accessibilityService;
    // used in tests
    this.initialized = false;
    this.sources = /* @__PURE__ */ new Map();
    this.threads = /* @__PURE__ */ new Map();
    this.threadIds = [];
    this.cancellationMap = /* @__PURE__ */ new Map();
    this.rawListeners = new DisposableStore();
    this.globalDisposables = new DisposableStore();
    this.stoppedDetails = [];
    this.statusQueue = this.rawListeners.add(new ThreadStatusScheduler());
    this._onDidChangeState = new Emitter();
    this._onDidEndAdapter = new Emitter();
    this._onDidLoadedSource = new Emitter();
    this._onDidCustomEvent = new Emitter();
    this._onDidProgressStart = new Emitter();
    this._onDidProgressUpdate = new Emitter();
    this._onDidProgressEnd = new Emitter();
    this._onDidInvalidMemory = new Emitter();
    this._onDidChangeREPLElements = new Emitter();
    this._onDidChangeName = new Emitter();
    this._options = options || {};
    this.parentSession = this._options.parentSession;
    if (this.hasSeparateRepl()) {
      this.repl = new ReplModel(this.configurationService);
    } else {
      this.repl = this.parentSession.repl;
    }
    const toDispose = this.globalDisposables;
    const replListener = toDispose.add(new MutableDisposable());
    replListener.value = this.repl.onDidChangeElements((e) => this._onDidChangeREPLElements.fire(e));
    if (lifecycleService) {
      toDispose.add(lifecycleService.onWillShutdown(() => {
        this.shutdown();
        dispose(toDispose);
      }));
    }
    this.correlatedTestRun = options?.testRun ? testResultService.getResult(options.testRun.runId) : this.parentSession?.correlatedTestRun;
    if (this.correlatedTestRun) {
      toDispose.add(this.correlatedTestRun.onComplete(() => this.terminate()));
    }
    const compoundRoot = this._options.compoundRoot;
    if (compoundRoot) {
      toDispose.add(compoundRoot.onDidSessionStop(() => this.terminate()));
    }
    this.passFocusScheduler = new RunOnceScheduler(() => {
      if (this.debugService.getModel().getSessions().some((s) => s.state === State.Stopped) || this.getAllThreads().some((t) => t.stopped)) {
        if (typeof this.lastContinuedThreadId === "number") {
          const thread = this.debugService.getViewModel().focusedThread;
          if (thread && thread.threadId === this.lastContinuedThreadId && !thread.stopped) {
            const toFocusThreadId = this.getStoppedDetails()?.threadId;
            const toFocusThread = typeof toFocusThreadId === "number" ? this.getThread(toFocusThreadId) : void 0;
            this.debugService.focusStackFrame(void 0, toFocusThread);
          }
        } else {
          const session = this.debugService.getViewModel().focusedSession;
          if (session && session.getId() === this.getId() && session.state !== State.Stopped) {
            this.debugService.focusStackFrame(void 0);
          }
        }
      }
    }, 800);
    const parent = this._options.parentSession;
    if (parent) {
      toDispose.add(parent.onDidEndAdapter(() => {
        if (!this.hasSeparateRepl() && this.raw?.isInShutdown === false) {
          this.repl = this.repl.clone();
          replListener.value = this.repl.onDidChangeElements((e) => this._onDidChangeREPLElements.fire(e));
          this.parentSession = void 0;
        }
      }));
    }
  }
  getId() {
    return this.id;
  }
  setSubId(subId) {
    this._subId = subId;
  }
  getMemory(memoryReference) {
    return new MemoryRegion(memoryReference, this);
  }
  get subId() {
    return this._subId;
  }
  get configuration() {
    return this._configuration.resolved;
  }
  get unresolvedConfiguration() {
    return this._configuration.unresolved;
  }
  get lifecycleManagedByParent() {
    return !!this._options.lifecycleManagedByParent;
  }
  get compact() {
    return !!this._options.compact;
  }
  get saveBeforeRestart() {
    return this._options.saveBeforeRestart ?? !this._options?.parentSession;
  }
  get compoundRoot() {
    return this._options.compoundRoot;
  }
  get suppressDebugStatusbar() {
    return this._options.suppressDebugStatusbar ?? false;
  }
  get suppressDebugToolbar() {
    return this._options.suppressDebugToolbar ?? false;
  }
  get suppressDebugView() {
    return this._options.suppressDebugView ?? false;
  }
  get autoExpandLazyVariables() {
    const screenReaderOptimized = this.accessibilityService.isScreenReaderOptimized();
    const value = this.configurationService.getValue("debug").autoExpandLazyVariables;
    return value === "auto" && screenReaderOptimized || value === "on";
  }
  setConfiguration(configuration) {
    this._configuration = configuration;
  }
  getLabel() {
    const includeRoot = this.workspaceContextService.getWorkspace().folders.length > 1;
    return includeRoot && this.root ? `${this.name} (${resources.basenameOrAuthority(this.root.uri)})` : this.name;
  }
  setName(name) {
    this._name = name;
    this._onDidChangeName.fire(name);
  }
  get name() {
    return this._name || this.configuration.name;
  }
  get state() {
    if (!this.initialized) {
      return State.Initializing;
    }
    if (!this.raw) {
      return State.Inactive;
    }
    const focusedThread = this.debugService.getViewModel().focusedThread;
    if (focusedThread && focusedThread.session === this) {
      return focusedThread.stopped ? State.Stopped : State.Running;
    }
    if (this.getAllThreads().some((t) => t.stopped)) {
      return State.Stopped;
    }
    return State.Running;
  }
  get capabilities() {
    return this.raw ? this.raw.capabilities : /* @__PURE__ */ Object.create(null);
  }
  //---- events
  get onDidChangeState() {
    return this._onDidChangeState.event;
  }
  get onDidEndAdapter() {
    return this._onDidEndAdapter.event;
  }
  get onDidChangeReplElements() {
    return this._onDidChangeREPLElements.event;
  }
  get onDidChangeName() {
    return this._onDidChangeName.event;
  }
  //---- DAP events
  get onDidCustomEvent() {
    return this._onDidCustomEvent.event;
  }
  get onDidLoadedSource() {
    return this._onDidLoadedSource.event;
  }
  get onDidProgressStart() {
    return this._onDidProgressStart.event;
  }
  get onDidProgressUpdate() {
    return this._onDidProgressUpdate.event;
  }
  get onDidProgressEnd() {
    return this._onDidProgressEnd.event;
  }
  get onDidInvalidateMemory() {
    return this._onDidInvalidMemory.event;
  }
  //---- DAP requests
  /**
   * create and initialize a new debug adapter for this session
   */
  async initialize(dbgr) {
    if (this.raw) {
      await this.shutdown();
    }
    try {
      const debugAdapter = await dbgr.createDebugAdapter(this);
      this.raw = this.instantiationService.createInstance(RawDebugSession, debugAdapter, dbgr, this.id, this.configuration.name);
      await this.raw.start();
      this.registerListeners();
      await this.raw.initialize({
        clientID: "vscode",
        clientName: this.productService.nameLong,
        adapterID: this.configuration.type,
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
        supportsVariableType: true,
        // #8858
        supportsVariablePaging: true,
        // #9537
        supportsRunInTerminalRequest: true,
        // #10574
        locale: platform.language,
        // #169114
        supportsProgressReporting: true,
        // #92253
        supportsInvalidatedEvent: true,
        // #106745
        supportsMemoryReferences: true,
        //#129684
        supportsArgsCanBeInterpretedByShell: true,
        // #149910
        supportsMemoryEvent: true,
        // #133643
        supportsStartDebuggingRequest: true,
        supportsANSIStyling: true
      });
      this.initialized = true;
      this._onDidChangeState.fire();
      this.rememberedCapabilities = this.raw.capabilities;
      this.debugService.setExceptionBreakpointsForSession(this, this.raw && this.raw.capabilities.exceptionBreakpointFilters || []);
      this.debugService.getModel().registerBreakpointModes(this.configuration.type, this.raw.capabilities.breakpointModes || []);
    } catch (err) {
      this.initialized = true;
      this._onDidChangeState.fire();
      await this.shutdown();
      throw err;
    }
  }
  /**
   * launch or attach to the debuggee
   */
  async launchOrAttach(config) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "launch or attach"));
    }
    if (this.parentSession && this.parentSession.state === State.Inactive) {
      throw canceled();
    }
    config.__sessionId = this.getId();
    try {
      await this.raw.launchOrAttach(config);
    } catch (err) {
      this.shutdown();
      throw err;
    }
  }
  /**
   * Terminate any linked test run.
   */
  cancelCorrelatedTestRun() {
    if (this.correlatedTestRun && !this.correlatedTestRun.completedAt) {
      this.didTerminateTestRun = true;
      this.testService.cancelTestRun(this.correlatedTestRun.id);
    }
  }
  /**
   * terminate the current debug adapter session
   */
  async terminate(restart = false) {
    if (!this.raw) {
      this.onDidExitAdapter();
    }
    this.cancelAllRequests();
    if (this._options.lifecycleManagedByParent && this.parentSession) {
      await this.parentSession.terminate(restart);
    } else if (this.correlatedTestRun && !this.correlatedTestRun.completedAt && !this.didTerminateTestRun) {
      this.cancelCorrelatedTestRun();
    } else if (this.raw) {
      if (this.raw.capabilities.supportsTerminateRequest && this._configuration.resolved.request === "launch") {
        await this.raw.terminate(restart);
      } else {
        await this.raw.disconnect({ restart, terminateDebuggee: true });
      }
    }
    if (!restart) {
      this._options.compoundRoot?.sessionStopped();
    }
  }
  /**
   * end the current debug adapter session
   */
  async disconnect(restart = false, suspend = false) {
    if (!this.raw) {
      this.onDidExitAdapter();
    }
    this.cancelAllRequests();
    if (this._options.lifecycleManagedByParent && this.parentSession) {
      await this.parentSession.disconnect(restart, suspend);
    } else if (this.raw) {
      await this.raw.disconnect({ restart, terminateDebuggee: false, suspendDebuggee: suspend });
    }
    if (!restart) {
      this._options.compoundRoot?.sessionStopped();
    }
  }
  /**
   * restart debug adapter session
   */
  async restart() {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "restart"));
    }
    this.cancelAllRequests();
    if (this._options.lifecycleManagedByParent && this.parentSession) {
      await this.parentSession.restart();
    } else {
      await this.raw.restart({ arguments: this.configuration });
    }
  }
  async sendBreakpoints(modelUri, breakpointsToSend, sourceModified) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "breakpoints"));
    }
    if (!this.raw.readyForBreakpoints) {
      return Promise.resolve(void 0);
    }
    const rawSource = this.getRawSource(modelUri);
    if (breakpointsToSend.length && !rawSource.adapterData) {
      rawSource.adapterData = breakpointsToSend[0].adapterData;
    }
    if (rawSource.path) {
      rawSource.path = normalizeDriveLetter(rawSource.path);
    }
    const response = await this.raw.setBreakpoints({
      source: rawSource,
      lines: breakpointsToSend.map((bp) => bp.sessionAgnosticData.lineNumber),
      breakpoints: breakpointsToSend.map((bp) => bp.toDAP()),
      sourceModified
    });
    if (response?.body) {
      const data = /* @__PURE__ */ new Map();
      for (let i = 0; i < breakpointsToSend.length; i++) {
        data.set(breakpointsToSend[i].getId(), response.body.breakpoints[i]);
      }
      this.model.setBreakpointSessionData(this.getId(), this.capabilities, data);
    }
  }
  async sendFunctionBreakpoints(fbpts) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "function breakpoints"));
    }
    if (this.raw.readyForBreakpoints) {
      const response = await this.raw.setFunctionBreakpoints({ breakpoints: fbpts.map((bp) => bp.toDAP()) });
      if (response?.body) {
        const data = /* @__PURE__ */ new Map();
        for (let i = 0; i < fbpts.length; i++) {
          data.set(fbpts[i].getId(), response.body.breakpoints[i]);
        }
        this.model.setBreakpointSessionData(this.getId(), this.capabilities, data);
      }
    }
  }
  async sendExceptionBreakpoints(exbpts) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "exception breakpoints"));
    }
    if (this.raw.readyForBreakpoints) {
      const args = this.capabilities.supportsExceptionFilterOptions ? {
        filters: [],
        filterOptions: exbpts.map((exb) => {
          if (exb.condition) {
            return { filterId: exb.filter, condition: exb.condition };
          }
          return { filterId: exb.filter };
        })
      } : { filters: exbpts.map((exb) => exb.filter) };
      const response = await this.raw.setExceptionBreakpoints(args);
      if (response?.body && response.body.breakpoints) {
        const data = /* @__PURE__ */ new Map();
        for (let i = 0; i < exbpts.length; i++) {
          data.set(exbpts[i].getId(), response.body.breakpoints[i]);
        }
        this.model.setBreakpointSessionData(this.getId(), this.capabilities, data);
      }
    }
  }
  dataBytesBreakpointInfo(address, bytes) {
    if (this.raw?.capabilities.supportsDataBreakpointBytes === false) {
      throw new Error(localize("sessionDoesNotSupporBytesBreakpoints", "Session does not support breakpoints with bytes"));
    }
    return this._dataBreakpointInfo({ name: address, bytes, asAddress: true });
  }
  dataBreakpointInfo(name, variablesReference) {
    return this._dataBreakpointInfo({ name, variablesReference });
  }
  async _dataBreakpointInfo(args) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "data breakpoints info"));
    }
    if (!this.raw.readyForBreakpoints) {
      throw new Error(localize("sessionNotReadyForBreakpoints", "Session is not ready for breakpoints"));
    }
    const response = await this.raw.dataBreakpointInfo(args);
    return response?.body;
  }
  async sendDataBreakpoints(dataBreakpoints) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "data breakpoints"));
    }
    if (this.raw.readyForBreakpoints) {
      const converted = await Promise.all(dataBreakpoints.map(async (bp) => {
        try {
          const dap = await bp.toDAP(this);
          return { dap, bp };
        } catch (e) {
          return { bp, message: e.message };
        }
      }));
      const response = await this.raw.setDataBreakpoints({ breakpoints: converted.map((d) => d.dap).filter(isDefined) });
      if (response?.body) {
        const data = /* @__PURE__ */ new Map();
        let i = 0;
        for (const dap of converted) {
          if (!dap.dap) {
            data.set(dap.bp.getId(), dap.message);
          } else if (i < response.body.breakpoints.length) {
            data.set(dap.bp.getId(), response.body.breakpoints[i++]);
          }
        }
        this.model.setBreakpointSessionData(this.getId(), this.capabilities, data);
      }
    }
  }
  async sendInstructionBreakpoints(instructionBreakpoints) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "instruction breakpoints"));
    }
    if (this.raw.readyForBreakpoints) {
      const response = await this.raw.setInstructionBreakpoints({ breakpoints: instructionBreakpoints.map((ib) => ib.toDAP()) });
      if (response?.body) {
        const data = /* @__PURE__ */ new Map();
        for (let i = 0; i < instructionBreakpoints.length; i++) {
          data.set(instructionBreakpoints[i].getId(), response.body.breakpoints[i]);
        }
        this.model.setBreakpointSessionData(this.getId(), this.capabilities, data);
      }
    }
  }
  async breakpointsLocations(uri, lineNumber) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "breakpoints locations"));
    }
    const source = this.getRawSource(uri);
    const response = await this.raw.breakpointLocations({ source, line: lineNumber });
    if (!response || !response.body || !response.body.breakpoints) {
      return [];
    }
    const positions = response.body.breakpoints.map((bp) => ({ lineNumber: bp.line, column: bp.column || 1 }));
    return distinct(positions, (p) => `${p.lineNumber}:${p.column}`);
  }
  getDebugProtocolBreakpoint(breakpointId) {
    return this.model.getDebugProtocolBreakpoint(breakpointId, this.getId());
  }
  customRequest(request, args) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", request));
    }
    return this.raw.custom(request, args);
  }
  stackTrace(threadId, startFrame, levels, token) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "stackTrace"));
    }
    const sessionToken = this.getNewCancellationToken(threadId, token);
    return this.raw.stackTrace({ threadId, startFrame, levels }, sessionToken);
  }
  async exceptionInfo(threadId) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "exceptionInfo"));
    }
    const response = await this.raw.exceptionInfo({ threadId });
    if (response) {
      return {
        id: response.body.exceptionId,
        description: response.body.description,
        breakMode: response.body.breakMode,
        details: response.body.details
      };
    }
    return void 0;
  }
  scopes(frameId, threadId) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "scopes"));
    }
    const token = this.getNewCancellationToken(threadId);
    return this.raw.scopes({ frameId }, token);
  }
  variables(variablesReference, threadId, filter, start, count) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "variables"));
    }
    const token = threadId ? this.getNewCancellationToken(threadId) : void 0;
    return this.raw.variables({ variablesReference, filter, start, count }, token);
  }
  evaluate(expression, frameId, context, location) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "evaluate"));
    }
    return this.raw.evaluate({ expression, frameId, context, line: location?.line, column: location?.column, source: location?.source });
  }
  async restartFrame(frameId, threadId) {
    await this.waitForTriggeredBreakpoints();
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "restartFrame"));
    }
    await this.raw.restartFrame({ frameId }, threadId);
  }
  setLastSteppingGranularity(threadId, granularity) {
    const thread = this.getThread(threadId);
    if (thread) {
      thread.lastSteppingGranularity = granularity;
    }
  }
  async next(threadId, granularity) {
    await this.waitForTriggeredBreakpoints();
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "next"));
    }
    this.setLastSteppingGranularity(threadId, granularity);
    await this.raw.next({ threadId, granularity });
  }
  async stepIn(threadId, targetId, granularity) {
    await this.waitForTriggeredBreakpoints();
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "stepIn"));
    }
    this.setLastSteppingGranularity(threadId, granularity);
    await this.raw.stepIn({ threadId, targetId, granularity });
  }
  async stepOut(threadId, granularity) {
    await this.waitForTriggeredBreakpoints();
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "stepOut"));
    }
    this.setLastSteppingGranularity(threadId, granularity);
    await this.raw.stepOut({ threadId, granularity });
  }
  async stepBack(threadId, granularity) {
    await this.waitForTriggeredBreakpoints();
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "stepBack"));
    }
    this.setLastSteppingGranularity(threadId, granularity);
    await this.raw.stepBack({ threadId, granularity });
  }
  async continue(threadId) {
    await this.waitForTriggeredBreakpoints();
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "continue"));
    }
    await this.raw.continue({ threadId });
  }
  async reverseContinue(threadId) {
    await this.waitForTriggeredBreakpoints();
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "reverse continue"));
    }
    await this.raw.reverseContinue({ threadId });
  }
  async pause(threadId) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "pause"));
    }
    await this.raw.pause({ threadId });
  }
  async terminateThreads(threadIds) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "terminateThreads"));
    }
    await this.raw.terminateThreads({ threadIds });
  }
  setVariable(variablesReference, name, value) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "setVariable"));
    }
    return this.raw.setVariable({ variablesReference, name, value });
  }
  setExpression(frameId, expression, value) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "setExpression"));
    }
    return this.raw.setExpression({ expression, value, frameId });
  }
  gotoTargets(source, line, column) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "gotoTargets"));
    }
    return this.raw.gotoTargets({ source, line, column });
  }
  goto(threadId, targetId) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "goto"));
    }
    return this.raw.goto({ threadId, targetId });
  }
  loadSource(resource) {
    if (!this.raw) {
      return Promise.reject(new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "loadSource")));
    }
    const source = this.getSourceForUri(resource);
    let rawSource;
    if (source) {
      rawSource = source.raw;
    } else {
      const data = Source.getEncodedDebugData(resource);
      rawSource = { path: data.path, sourceReference: data.sourceReference };
    }
    return this.raw.source({ sourceReference: rawSource.sourceReference || 0, source: rawSource });
  }
  async getLoadedSources() {
    if (!this.raw) {
      return Promise.reject(new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "getLoadedSources")));
    }
    const response = await this.raw.loadedSources({});
    if (response?.body && response.body.sources) {
      return response.body.sources.map((src) => this.getSource(src));
    } else {
      return [];
    }
  }
  async completions(frameId, threadId, text, position, token) {
    if (!this.raw) {
      return Promise.reject(new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "completions")));
    }
    const sessionCancelationToken = this.getNewCancellationToken(threadId, token);
    return this.raw.completions({
      frameId,
      text,
      column: position.column,
      line: position.lineNumber
    }, sessionCancelationToken);
  }
  async stepInTargets(frameId) {
    if (!this.raw) {
      return Promise.reject(new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "stepInTargets")));
    }
    const response = await this.raw.stepInTargets({ frameId });
    return response?.body.targets;
  }
  async cancel(progressId) {
    if (!this.raw) {
      return Promise.reject(new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "cancel")));
    }
    return this.raw.cancel({ progressId });
  }
  async disassemble(memoryReference, offset, instructionOffset, instructionCount) {
    if (!this.raw) {
      return Promise.reject(new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "disassemble")));
    }
    const response = await this.raw.disassemble({ memoryReference, offset, instructionOffset, instructionCount, resolveSymbols: true });
    return response?.body?.instructions;
  }
  readMemory(memoryReference, offset, count) {
    if (!this.raw) {
      return Promise.reject(new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "readMemory")));
    }
    return this.raw.readMemory({ count, memoryReference, offset });
  }
  writeMemory(memoryReference, offset, data, allowPartial) {
    if (!this.raw) {
      return Promise.reject(new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "disassemble")));
    }
    return this.raw.writeMemory({ memoryReference, offset, allowPartial, data });
  }
  async resolveLocationReference(locationReference) {
    if (!this.raw) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "locations"));
    }
    const location = await this.raw.locations({ locationReference });
    if (!location?.body) {
      throw new Error(localize("noDebugAdapter", "No debugger available, can not send '{0}'", "locations"));
    }
    const source = this.getSource(location.body.source);
    return { column: 1, ...location.body, source };
  }
  //---- threads
  getThread(threadId) {
    return this.threads.get(threadId);
  }
  getAllThreads() {
    const result = [];
    this.threadIds.forEach((threadId) => {
      const thread = this.threads.get(threadId);
      if (thread) {
        result.push(thread);
      }
    });
    return result;
  }
  clearThreads(removeThreads, reference = void 0) {
    if (reference !== void 0 && reference !== null) {
      const thread = this.threads.get(reference);
      if (thread) {
        thread.clearCallStack();
        thread.stoppedDetails = void 0;
        thread.stopped = false;
        if (removeThreads) {
          this.threads.delete(reference);
        }
      }
    } else {
      this.threads.forEach((thread) => {
        thread.clearCallStack();
        thread.stoppedDetails = void 0;
        thread.stopped = false;
      });
      if (removeThreads) {
        this.threads.clear();
        this.threadIds = [];
        ExpressionContainer.allValues.clear();
      }
    }
  }
  getStoppedDetails() {
    return this.stoppedDetails.length >= 1 ? this.stoppedDetails[0] : void 0;
  }
  rawUpdate(data) {
    this.threadIds = [];
    data.threads.forEach((thread) => {
      this.threadIds.push(thread.id);
      if (!this.threads.has(thread.id)) {
        this.threads.set(thread.id, new Thread(this, thread.name, thread.id));
      } else if (thread.name) {
        const oldThread = this.threads.get(thread.id);
        if (oldThread) {
          oldThread.name = thread.name;
        }
      }
    });
    this.threads.forEach((t) => {
      if (this.threadIds.indexOf(t.threadId) === -1) {
        this.threads.delete(t.threadId);
      }
    });
    const stoppedDetails = data.stoppedDetails;
    if (stoppedDetails) {
      if (stoppedDetails.allThreadsStopped) {
        this.threads.forEach((thread) => {
          thread.stoppedDetails = thread.threadId === stoppedDetails.threadId ? stoppedDetails : { reason: thread.stoppedDetails?.reason };
          thread.stopped = true;
          thread.clearCallStack();
        });
      } else {
        const thread = typeof stoppedDetails.threadId === "number" ? this.threads.get(stoppedDetails.threadId) : void 0;
        if (thread) {
          thread.stoppedDetails = stoppedDetails;
          thread.clearCallStack();
          thread.stopped = true;
        }
      }
    }
  }
  waitForTriggeredBreakpoints() {
    if (!this._waitToResume) {
      return;
    }
    return raceTimeout(
      this._waitToResume,
      TRIGGERED_BREAKPOINT_MAX_DELAY
    );
  }
  async fetchThreads(stoppedDetails) {
    if (this.raw) {
      const response = await this.raw.threads();
      if (response?.body && response.body.threads) {
        this.model.rawUpdate({
          sessionId: this.getId(),
          threads: response.body.threads,
          stoppedDetails
        });
      }
    }
  }
  initializeForTest(raw) {
    this.raw = raw;
    this.registerListeners();
  }
  //---- private
  registerListeners() {
    if (!this.raw) {
      return;
    }
    this.rawListeners.add(this.raw.onDidInitialize(async () => {
      aria.status(
        this.configuration.noDebug ? localize("debuggingStartedNoDebug", "Started running without debugging.") : localize("debuggingStarted", "Debugging started.")
      );
      const sendConfigurationDone = async () => {
        if (this.raw && this.raw.capabilities.supportsConfigurationDoneRequest) {
          try {
            await this.raw.configurationDone();
          } catch (e) {
            this.notificationService.error(e);
            this.raw?.disconnect({});
          }
        }
        return void 0;
      };
      try {
        await this.debugService.sendAllBreakpoints(this);
      } finally {
        await sendConfigurationDone();
        await this.fetchThreads();
      }
    }));
    const statusQueue = this.statusQueue;
    this.rawListeners.add(this.raw.onDidStop((event) => this.handleStop(event.body)));
    this.rawListeners.add(this.raw.onDidThread((event) => {
      statusQueue.cancel([event.body.threadId]);
      if (event.body.reason === "started") {
        if (!this.fetchThreadsScheduler) {
          this.fetchThreadsScheduler = new RunOnceScheduler(() => {
            this.fetchThreads();
          }, 100);
          this.rawListeners.add(this.fetchThreadsScheduler);
        }
        if (!this.fetchThreadsScheduler.isScheduled()) {
          this.fetchThreadsScheduler.schedule();
        }
      } else if (event.body.reason === "exited") {
        this.model.clearThreads(this.getId(), true, event.body.threadId);
        const viewModel = this.debugService.getViewModel();
        const focusedThread = viewModel.focusedThread;
        this.passFocusScheduler.cancel();
        if (focusedThread && event.body.threadId === focusedThread.threadId) {
          this.debugService.focusStackFrame(void 0, void 0, viewModel.focusedSession, { explicit: false });
        }
      }
    }));
    this.rawListeners.add(this.raw.onDidTerminateDebugee(async (event) => {
      aria.status(localize("debuggingStopped", "Debugging stopped."));
      if (event.body && event.body.restart) {
        await this.debugService.restartSession(this, event.body.restart);
      } else if (this.raw) {
        await this.raw.disconnect({ terminateDebuggee: false });
      }
    }));
    this.rawListeners.add(this.raw.onDidContinued((event) => {
      const allThreads = event.body.allThreadsContinued !== false;
      statusQueue.cancel(allThreads ? void 0 : [event.body.threadId]);
      const threadId = allThreads ? void 0 : event.body.threadId;
      if (typeof threadId === "number") {
        this.stoppedDetails = this.stoppedDetails.filter((sd) => sd.threadId !== threadId);
        const tokens = this.cancellationMap.get(threadId);
        this.cancellationMap.delete(threadId);
        tokens?.forEach((t) => t.dispose(true));
      } else {
        this.stoppedDetails = [];
        this.cancelAllRequests();
      }
      this.lastContinuedThreadId = threadId;
      this.passFocusScheduler.schedule();
      this.model.clearThreads(this.getId(), false, threadId);
      this._onDidChangeState.fire();
    }));
    const outputQueue = new Queue();
    this.rawListeners.add(this.raw.onDidOutput(async (event) => {
      const outputSeverity = event.body.category === "stderr" ? Severity.Error : event.body.category === "console" ? Severity.Warning : Severity.Info;
      if (event.body.variablesReference) {
        const source = event.body.source && event.body.line ? {
          lineNumber: event.body.line,
          column: event.body.column ? event.body.column : 1,
          source: this.getSource(event.body.source)
        } : void 0;
        const container = new ExpressionContainer(this, void 0, event.body.variablesReference, generateUuid());
        const children = container.getChildren();
        outputQueue.queue(async () => {
          const resolved = await children;
          if (resolved.length === 1) {
            this.appendToRepl({ output: event.body.output, expression: resolved[0], sev: outputSeverity, source }, event.body.category === "important");
            return;
          }
          resolved.forEach((child) => {
            child.name = null;
            this.appendToRepl({ output: "", expression: child, sev: outputSeverity, source }, event.body.category === "important");
          });
        });
        return;
      }
      outputQueue.queue(async () => {
        if (!event.body || !this.raw) {
          return;
        }
        if (event.body.category === "telemetry") {
          const telemetryEndpoint = this.raw.dbgr.getCustomTelemetryEndpoint();
          if (telemetryEndpoint && this.telemetryService.telemetryLevel !== TelemetryLevel.NONE) {
            let data = event.body.data;
            if (!telemetryEndpoint.sendErrorTelemetry && event.body.data) {
              data = filterExceptionsFromTelemetry(event.body.data);
            }
            this.customEndpointTelemetryService.publicLog(telemetryEndpoint, event.body.output, data);
          }
          return;
        }
        const source = event.body.source && event.body.line ? {
          lineNumber: event.body.line,
          column: event.body.column ? event.body.column : 1,
          source: this.getSource(event.body.source)
        } : void 0;
        if (event.body.group === "start" || event.body.group === "startCollapsed") {
          const expanded = event.body.group === "start";
          this.repl.startGroup(this, event.body.output || "", expanded, source);
          return;
        }
        if (event.body.group === "end") {
          this.repl.endGroup();
          if (!event.body.output) {
            return;
          }
        }
        if (typeof event.body.output === "string") {
          this.appendToRepl({ output: event.body.output, sev: outputSeverity, source }, event.body.category === "important");
        }
      });
    }));
    this.rawListeners.add(this.raw.onDidBreakpoint((event) => {
      const id = event.body && event.body.breakpoint ? event.body.breakpoint.id : void 0;
      const breakpoint = this.model.getBreakpoints().find((bp) => bp.getIdFromAdapter(this.getId()) === id);
      const functionBreakpoint = this.model.getFunctionBreakpoints().find((bp) => bp.getIdFromAdapter(this.getId()) === id);
      const dataBreakpoint = this.model.getDataBreakpoints().find((dbp) => dbp.getIdFromAdapter(this.getId()) === id);
      const exceptionBreakpoint = this.model.getExceptionBreakpoints().find((excbp) => excbp.getIdFromAdapter(this.getId()) === id);
      if (event.body.reason === "new" && event.body.breakpoint.source && event.body.breakpoint.line) {
        const source = this.getSource(event.body.breakpoint.source);
        const bps = this.model.addBreakpoints(source.uri, [{
          column: event.body.breakpoint.column,
          enabled: true,
          lineNumber: event.body.breakpoint.line
        }], false);
        if (bps.length === 1) {
          const data = /* @__PURE__ */ new Map([[bps[0].getId(), event.body.breakpoint]]);
          this.model.setBreakpointSessionData(this.getId(), this.capabilities, data);
        }
      }
      if (event.body.reason === "removed") {
        if (breakpoint) {
          this.model.removeBreakpoints([breakpoint]);
        }
        if (functionBreakpoint) {
          this.model.removeFunctionBreakpoints(functionBreakpoint.getId());
        }
        if (dataBreakpoint) {
          this.model.removeDataBreakpoints(dataBreakpoint.getId());
        }
      }
      if (event.body.reason === "changed") {
        if (breakpoint) {
          if (!breakpoint.column) {
            event.body.breakpoint.column = void 0;
          }
          const data = /* @__PURE__ */ new Map([[breakpoint.getId(), event.body.breakpoint]]);
          this.model.setBreakpointSessionData(this.getId(), this.capabilities, data);
        }
        if (functionBreakpoint) {
          const data = /* @__PURE__ */ new Map([[functionBreakpoint.getId(), event.body.breakpoint]]);
          this.model.setBreakpointSessionData(this.getId(), this.capabilities, data);
        }
        if (dataBreakpoint) {
          const data = /* @__PURE__ */ new Map([[dataBreakpoint.getId(), event.body.breakpoint]]);
          this.model.setBreakpointSessionData(this.getId(), this.capabilities, data);
        }
        if (exceptionBreakpoint) {
          const data = /* @__PURE__ */ new Map([[exceptionBreakpoint.getId(), event.body.breakpoint]]);
          this.model.setBreakpointSessionData(this.getId(), this.capabilities, data);
        }
      }
    }));
    this.rawListeners.add(this.raw.onDidLoadedSource((event) => {
      this._onDidLoadedSource.fire({
        reason: event.body.reason,
        source: this.getSource(event.body.source)
      });
    }));
    this.rawListeners.add(this.raw.onDidCustomEvent((event) => {
      this._onDidCustomEvent.fire(event);
    }));
    this.rawListeners.add(this.raw.onDidProgressStart((event) => {
      this._onDidProgressStart.fire(event);
    }));
    this.rawListeners.add(this.raw.onDidProgressUpdate((event) => {
      this._onDidProgressUpdate.fire(event);
    }));
    this.rawListeners.add(this.raw.onDidProgressEnd((event) => {
      this._onDidProgressEnd.fire(event);
    }));
    this.rawListeners.add(this.raw.onDidInvalidateMemory((event) => {
      this._onDidInvalidMemory.fire(event);
    }));
    this.rawListeners.add(this.raw.onDidInvalidated(async (event) => {
      const areas = event.body.areas || ["all"];
      if (areas.includes("threads") || areas.includes("stacks") || areas.includes("all")) {
        this.cancelAllRequests();
        this.model.clearThreads(this.getId(), true);
        const details = this.stoppedDetails;
        this.stoppedDetails.length = 1;
        await Promise.all(details.map((d) => this.handleStop(d)));
      }
      const viewModel = this.debugService.getViewModel();
      if (viewModel.focusedSession === this) {
        viewModel.updateViews();
      }
    }));
    this.rawListeners.add(this.raw.onDidExitAdapter((event) => this.onDidExitAdapter(event)));
  }
  async handleStop(event) {
    this.passFocusScheduler.cancel();
    this.stoppedDetails.push(event);
    if (event.hitBreakpointIds) {
      this._waitToResume = this.enableDependentBreakpoints(event.hitBreakpointIds);
    }
    this.statusQueue.run(
      this.fetchThreads(event).then(() => event.threadId === void 0 ? this.threadIds : [event.threadId]),
      async (threadId, token) => {
        const hasLotsOfThreads = event.threadId === void 0 && this.threadIds.length > 10;
        const focusedThread = this.debugService.getViewModel().focusedThread;
        const focusedThreadDoesNotExist = focusedThread !== void 0 && focusedThread.session === this && !this.threads.has(focusedThread.threadId);
        if (focusedThreadDoesNotExist) {
          this.debugService.focusStackFrame(void 0, void 0);
        }
        const thread = typeof threadId === "number" ? this.getThread(threadId) : void 0;
        if (thread) {
          const promises = this.model.refreshTopOfCallstack(
            thread,
            /* fetchFullStack= */
            !hasLotsOfThreads
          );
          const focus = async () => {
            if (focusedThreadDoesNotExist || !event.preserveFocusHint && thread.getCallStack().length) {
              const focusedStackFrame2 = this.debugService.getViewModel().focusedStackFrame;
              if (!focusedStackFrame2 || focusedStackFrame2.thread.session === this) {
                const preserveFocus = !this.configurationService.getValue("debug").focusEditorOnBreak;
                await this.debugService.focusStackFrame(void 0, thread, void 0, { preserveFocus });
              }
              if (thread.stoppedDetails && !token.isCancellationRequested) {
                if (thread.stoppedDetails.reason === "breakpoint" && this.configurationService.getValue("debug").openDebug === "openOnDebugBreak" && !this.suppressDebugView) {
                  await this.paneCompositeService.openPaneComposite(VIEWLET_ID, ViewContainerLocation.Sidebar);
                }
                if (this.configurationService.getValue("debug").focusWindowOnBreak && !this.workbenchEnvironmentService.extensionTestsLocationURI) {
                  const activeWindow = getActiveWindow();
                  if (!activeWindow.document.hasFocus()) {
                    await this.hostService.focus(mainWindow, {
                      force: true
                      /* Application may not be active */
                    });
                  }
                }
              }
            }
          };
          await promises.topCallStack;
          if (!event.hitBreakpointIds) {
            this._waitToResume = this.enableDependentBreakpoints(thread);
          }
          if (token.isCancellationRequested) {
            return;
          }
          focus();
          await promises.wholeCallStack;
          if (token.isCancellationRequested) {
            return;
          }
          const focusedStackFrame = this.debugService.getViewModel().focusedStackFrame;
          if (!focusedStackFrame || isFrameDeemphasized(focusedStackFrame)) {
            focus();
          }
        }
        this._onDidChangeState.fire();
      }
    );
  }
  async enableDependentBreakpoints(hitBreakpointIdsOrThread) {
    let breakpoints;
    if (Array.isArray(hitBreakpointIdsOrThread)) {
      breakpoints = this.model.getBreakpoints().filter((bp) => hitBreakpointIdsOrThread.includes(bp.getIdFromAdapter(this.id)));
    } else {
      const frame = hitBreakpointIdsOrThread.getTopStackFrame();
      if (frame === void 0) {
        return;
      }
      if (hitBreakpointIdsOrThread.stoppedDetails && hitBreakpointIdsOrThread.stoppedDetails.reason !== "breakpoint") {
        return;
      }
      breakpoints = this.getBreakpointsAtPosition(frame.source.uri, frame.range.startLineNumber, frame.range.endLineNumber, frame.range.startColumn, frame.range.endColumn);
    }
    const urisToResend = /* @__PURE__ */ new Set();
    this.model.getBreakpoints({ triggeredOnly: true, enabledOnly: true }).forEach((bp) => {
      breakpoints.forEach((cbp) => {
        if (bp.enabled && bp.triggeredBy === cbp.getId()) {
          bp.setSessionDidTrigger(this.getId());
          urisToResend.add(bp.uri.toString());
        }
      });
    });
    const results = [];
    urisToResend.forEach((uri) => results.push(this.debugService.sendBreakpoints(URI.parse(uri), void 0, this)));
    return Promise.all(results);
  }
  getBreakpointsAtPosition(uri, startLineNumber, endLineNumber, startColumn, endColumn) {
    return this.model.getBreakpoints({ uri }).filter((bp) => {
      if (bp.lineNumber < startLineNumber || bp.lineNumber > endLineNumber) {
        return false;
      }
      if (bp.column && (bp.column < startColumn || bp.column > endColumn)) {
        return false;
      }
      return true;
    });
  }
  onDidExitAdapter(event) {
    this.initialized = true;
    this.model.setBreakpointSessionData(this.getId(), this.capabilities, void 0);
    this.shutdown();
    this._onDidEndAdapter.fire(event);
  }
  // Disconnects and clears state. Session can be initialized again for a new connection.
  shutdown() {
    this.rawListeners.clear();
    if (this.raw) {
      this.raw.disconnect({});
      this.raw.dispose();
      this.raw = void 0;
    }
    this.fetchThreadsScheduler?.dispose();
    this.fetchThreadsScheduler = void 0;
    this.passFocusScheduler.cancel();
    this.passFocusScheduler.dispose();
    this.model.clearThreads(this.getId(), true);
    this._onDidChangeState.fire();
  }
  dispose() {
    this.cancelAllRequests();
    this.rawListeners.dispose();
    this.globalDisposables.dispose();
  }
  //---- sources
  getSourceForUri(uri) {
    return this.sources.get(this.uriIdentityService.asCanonicalUri(uri).toString());
  }
  getSource(raw) {
    let source = new Source(raw, this.getId(), this.uriIdentityService, this.logService);
    const uriKey = source.uri.toString();
    const found = this.sources.get(uriKey);
    if (found) {
      source = found;
      source.raw = mixin(source.raw, raw);
      if (source.raw && raw) {
        source.raw.presentationHint = raw.presentationHint;
      }
    } else {
      this.sources.set(uriKey, source);
    }
    return source;
  }
  getRawSource(uri) {
    const source = this.getSourceForUri(uri);
    if (source) {
      return source.raw;
    } else {
      const data = Source.getEncodedDebugData(uri);
      return { name: data.name, path: data.path, sourceReference: data.sourceReference };
    }
  }
  getNewCancellationToken(threadId, token) {
    const tokenSource = new CancellationTokenSource(token);
    const tokens = this.cancellationMap.get(threadId) || [];
    tokens.push(tokenSource);
    this.cancellationMap.set(threadId, tokens);
    return tokenSource.token;
  }
  cancelAllRequests() {
    this.cancellationMap.forEach((tokens) => tokens.forEach((t) => t.dispose(true)));
    this.cancellationMap.clear();
  }
  // REPL
  getReplElements() {
    return this.repl.getReplElements();
  }
  hasSeparateRepl() {
    return !this.parentSession || this._options.repl !== "mergeWithParent";
  }
  removeReplExpressions() {
    this.repl.removeReplExpressions();
  }
  async addReplExpression(stackFrame, expression) {
    await this.repl.addReplExpression(this, stackFrame, expression);
    this.debugService.getViewModel().updateViews();
  }
  appendToRepl(data, isImportant) {
    this.repl.appendToRepl(this, data);
    if (isImportant) {
      this.notificationService.notify({ message: data.output.toString(), severity: data.sev, source: this.name });
    }
  }
};
DebugSession = __decorateClass([
  __decorateParam(5, IDebugService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, IHostService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IPaneCompositePartService),
  __decorateParam(10, IWorkspaceContextService),
  __decorateParam(11, IProductService),
  __decorateParam(12, INotificationService),
  __decorateParam(13, ILifecycleService),
  __decorateParam(14, IUriIdentityService),
  __decorateParam(15, IInstantiationService),
  __decorateParam(16, ICustomEndpointTelemetryService),
  __decorateParam(17, IWorkbenchEnvironmentService),
  __decorateParam(18, ILogService),
  __decorateParam(19, ITestService),
  __decorateParam(20, ITestResultService),
  __decorateParam(21, IAccessibilityService)
], DebugSession);
class ThreadStatusScheduler extends Disposable {
  constructor() {
    super(...arguments);
    /**
     * An array of set of thread IDs. When a 'stopped' event is encountered, the
     * editor refreshes its thread IDs. In the meantime, the thread may change
     * state it again. So the editor puts a Set into this array when it starts
     * the refresh, and checks it after the refresh is finished, to see if
     * any of the threads it looked up should now be invalidated.
     */
    this.pendingCancellations = [];
    /**
     * Cancellation tokens for currently-running operations on threads.
     */
    this.threadOps = this._register(new DisposableMap());
  }
  /**
   * Runs the operation.
   * If thread is undefined it affects all threads.
   */
  async run(threadIdsP, operation) {
    const cancelledWhileLookingUpThreads = /* @__PURE__ */ new Set();
    this.pendingCancellations.push(cancelledWhileLookingUpThreads);
    const threadIds = await threadIdsP;
    for (let i = 0; i < this.pendingCancellations.length; i++) {
      const s = this.pendingCancellations[i];
      if (s === cancelledWhileLookingUpThreads) {
        this.pendingCancellations.splice(i, 1);
        break;
      } else {
        for (const threadId of threadIds) {
          s.add(threadId);
        }
      }
    }
    if (cancelledWhileLookingUpThreads.has(void 0)) {
      return;
    }
    await Promise.all(threadIds.map((threadId) => {
      if (cancelledWhileLookingUpThreads.has(threadId)) {
        return;
      }
      this.threadOps.get(threadId)?.cancel();
      const cts = new CancellationTokenSource();
      this.threadOps.set(threadId, cts);
      return operation(threadId, cts.token);
    }));
  }
  /**
   * Cancels all ongoing state operations on the given threads.
   * If threads is undefined it cancel all threads.
   */
  cancel(threadIds) {
    if (!threadIds) {
      for (const [_, op] of this.threadOps) {
        op.cancel();
      }
      this.threadOps.clearAndDisposeAll();
      for (const s of this.pendingCancellations) {
        s.add(void 0);
      }
    } else {
      for (const threadId of threadIds) {
        this.threadOps.get(threadId)?.cancel();
        this.threadOps.deleteAndDispose(threadId);
        for (const s of this.pendingCancellations) {
          s.add(threadId);
        }
      }
    }
  }
}
export {
  DebugSession,
  ThreadStatusScheduler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnU2Vzc2lvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGFyaWEgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBkaXN0aW5jdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBRdWV1ZSwgUnVuT25jZVNjaGVkdWxlciwgcmFjZVRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgY2FuY2VsZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBub3JtYWxpemVEcml2ZUxldHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlTWFwLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBtaXhpbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0ICogYXMgcmVzb3VyY2VzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uLCBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDdXN0b21FbmRwb2ludFRlbGVtZXRyeVNlcnZpY2UsIElUZWxlbWV0cnlTZXJ2aWNlLCBUZWxlbWV0cnlMZXZlbCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBJV29ya3NwYWNlRm9sZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgVmlld0NvbnRhaW5lckxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IFJhd0RlYnVnU2Vzc2lvbiB9IGZyb20gJy4vcmF3RGVidWdTZXNzaW9uLmpzJztcbmltcG9ydCB7IEFkYXB0ZXJFbmRFdmVudCwgSUJyZWFrcG9pbnQsIElDb25maWcsIElEYXRhQnJlYWtwb2ludCwgSURhdGFCcmVha3BvaW50SW5mb1Jlc3BvbnNlLCBJRGVidWdDb25maWd1cmF0aW9uLCBJRGVidWdMb2NhdGlvblJlZmVyZW5jZWQsIElEZWJ1Z1NlcnZpY2UsIElEZWJ1Z1Nlc3Npb24sIElEZWJ1Z1Nlc3Npb25PcHRpb25zLCBJRGVidWdnZXIsIElFeGNlcHRpb25CcmVha3BvaW50LCBJRXhjZXB0aW9uSW5mbywgSUZ1bmN0aW9uQnJlYWtwb2ludCwgSUluc3RydWN0aW9uQnJlYWtwb2ludCwgSU1lbW9yeVJlZ2lvbiwgSVJhd01vZGVsVXBkYXRlLCBJUmF3U3RvcHBlZERldGFpbHMsIElSZXBsRWxlbWVudCwgSVN0YWNrRnJhbWUsIElUaHJlYWQsIExvYWRlZFNvdXJjZUV2ZW50LCBTdGF0ZSwgVklFV0xFVF9JRCwgaXNGcmFtZURlZW1waGFzaXplZCB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0NvbXBvdW5kUm9vdCB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z0NvbXBvdW5kUm9vdC5qcyc7XG5pbXBvcnQgeyBEZWJ1Z01vZGVsLCBFeHByZXNzaW9uQ29udGFpbmVyLCBNZW1vcnlSZWdpb24sIFRocmVhZCB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z01vZGVsLmpzJztcbmltcG9ydCB7IFNvdXJjZSB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z1NvdXJjZS5qcyc7XG5pbXBvcnQgeyBmaWx0ZXJFeGNlcHRpb25zRnJvbVRlbGVtZXRyeSB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z1V0aWxzLmpzJztcbmltcG9ydCB7IElOZXdSZXBsRWxlbWVudERhdGEsIFJlcGxNb2RlbCB9IGZyb20gJy4uL2NvbW1vbi9yZXBsTW9kZWwuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcGFuZWNvbXBvc2l0ZS9icm93c2VyL3BhbmVjb21wb3NpdGUuanMnO1xuaW1wb3J0IHsgZ2V0QWN0aXZlV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBpc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJVGVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZXN0aW5nL2NvbW1vbi90ZXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVzdFJlc3VsdFNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZXN0aW5nL2NvbW1vbi90ZXN0UmVzdWx0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBMaXZlVGVzdFJlc3VsdCB9IGZyb20gJy4uLy4uL3Rlc3RpbmcvY29tbW9uL3Rlc3RSZXN1bHQuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5cbmNvbnN0IFRSSUdHRVJFRF9CUkVBS1BPSU5UX01BWF9ERUxBWSA9IDE1MDA7XG5cbmV4cG9ydCBjbGFzcyBEZWJ1Z1Nlc3Npb24gaW1wbGVtZW50cyBJRGVidWdTZXNzaW9uLCBJRGlzcG9zYWJsZSB7XG5cdHBhcmVudFNlc3Npb246IElEZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQ7XG5cdHJlbWVtYmVyZWRDYXBhYmlsaXRpZXM/OiBEZWJ1Z1Byb3RvY29sLkNhcGFiaWxpdGllcztcblxuXHRwcml2YXRlIF9zdWJJZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyYXc6IFJhd0RlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZDsgLy8gdXNlZCBpbiB0ZXN0c1xuXHRwcml2YXRlIGluaXRpYWxpemVkID0gZmFsc2U7XG5cdHByaXZhdGUgX29wdGlvbnM6IElEZWJ1Z1Nlc3Npb25PcHRpb25zO1xuXG5cdHByaXZhdGUgc291cmNlcyA9IG5ldyBNYXA8c3RyaW5nLCBTb3VyY2U+KCk7XG5cdHByaXZhdGUgdGhyZWFkcyA9IG5ldyBNYXA8bnVtYmVyLCBUaHJlYWQ+KCk7XG5cdHByaXZhdGUgdGhyZWFkSWRzOiBudW1iZXJbXSA9IFtdO1xuXHRwcml2YXRlIGNhbmNlbGxhdGlvbk1hcCA9IG5ldyBNYXA8bnVtYmVyLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZVtdPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHJhd0xpc3RlbmVycyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBnbG9iYWxEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSBmZXRjaFRocmVhZHNTY2hlZHVsZXI6IFJ1bk9uY2VTY2hlZHVsZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcGFzc0ZvY3VzU2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIGxhc3RDb250aW51ZWRUaHJlYWRJZDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlcGw6IFJlcGxNb2RlbDtcblx0cHJpdmF0ZSBzdG9wcGVkRGV0YWlsczogSVJhd1N0b3BwZWREZXRhaWxzW10gPSBbXTtcblx0cHJpdmF0ZSByZWFkb25seSBzdGF0dXNRdWV1ZSA9IHRoaXMucmF3TGlzdGVuZXJzLmFkZChuZXcgVGhyZWFkU3RhdHVzU2NoZWR1bGVyKCkpO1xuXG5cdC8qKiBUZXN0IHJ1biB0aGlzIGRlYnVnIHNlc3Npb24gd2FzIHNwYXduZWQgYnkgKi9cblx0cHVibGljIHJlYWRvbmx5IGNvcnJlbGF0ZWRUZXN0UnVuPzogTGl2ZVRlc3RSZXN1bHQ7XG5cdC8qKiBXaGV0aGVyIHdlIHRlcm1pbmF0ZWQgdGhlIGNvcnJlbGF0ZWQgcnVuIHlldC4gVXNlZCBzbyBhIDJuZCB0ZXJtaW5hdGUgcmVxdWVzdCBnb2VzIHRocm91Z2ggdG8gdGhlIHVuZGVybHlpbmcgc2Vzc2lvbi4gKi9cblx0cHJpdmF0ZSBkaWRUZXJtaW5hdGVUZXN0UnVuPzogYm9vbGVhbjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVN0YXRlID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRFbmRBZGFwdGVyID0gbmV3IEVtaXR0ZXI8QWRhcHRlckVuZEV2ZW50IHwgdW5kZWZpbmVkPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkTG9hZGVkU291cmNlID0gbmV3IEVtaXR0ZXI8TG9hZGVkU291cmNlRXZlbnQ+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ3VzdG9tRXZlbnQgPSBuZXcgRW1pdHRlcjxEZWJ1Z1Byb3RvY29sLkV2ZW50PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFByb2dyZXNzU3RhcnQgPSBuZXcgRW1pdHRlcjxEZWJ1Z1Byb3RvY29sLlByb2dyZXNzU3RhcnRFdmVudD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRQcm9ncmVzc1VwZGF0ZSA9IG5ldyBFbWl0dGVyPERlYnVnUHJvdG9jb2wuUHJvZ3Jlc3NVcGRhdGVFdmVudD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRQcm9ncmVzc0VuZCA9IG5ldyBFbWl0dGVyPERlYnVnUHJvdG9jb2wuUHJvZ3Jlc3NFbmRFdmVudD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRJbnZhbGlkTWVtb3J5ID0gbmV3IEVtaXR0ZXI8RGVidWdQcm90b2NvbC5NZW1vcnlFdmVudD4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVJFUExFbGVtZW50cyA9IG5ldyBFbWl0dGVyPElSZXBsRWxlbWVudCB8IHVuZGVmaW5lZD4oKTtcblxuXHRwcml2YXRlIF9uYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlTmFtZSA9IG5ldyBFbWl0dGVyPHN0cmluZz4oKTtcblxuXHQvKipcblx0ICogUHJvbWlzZSBzZXQgd2hpbGUgZW5hYmxpbmcgZGVwZW5kZW50IGJyZWFrcG9pbnRzIHRvIGJsb2NrIHRoZSBkZWJ1Z2dlclxuXHQgKiBmcm9tIGNvbnRpbnVpbmcgZnJvbSBhIHN0b3BwZWQgc3RhdGUuXG5cdCAqL1xuXHRwcml2YXRlIF93YWl0VG9SZXN1bWU/OiBQcm9taXNlPHVua25vd24+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgaWQ6IHN0cmluZyxcblx0XHRwcml2YXRlIF9jb25maWd1cmF0aW9uOiB7IHJlc29sdmVkOiBJQ29uZmlnOyB1bnJlc29sdmVkOiBJQ29uZmlnIHwgdW5kZWZpbmVkIH0sXG5cdFx0cHVibGljIHJvb3Q6IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSBtb2RlbDogRGVidWdNb2RlbCxcblx0XHRvcHRpb25zOiBJRGVidWdTZXNzaW9uT3B0aW9ucyB8IHVuZGVmaW5lZCxcblx0XHRASURlYnVnU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhbmVDb21wb3NpdGVTZXJ2aWNlOiBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBsaWZlY3ljbGVTZXJ2aWNlOiBJTGlmZWN5Y2xlU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUN1c3RvbUVuZHBvaW50VGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGN1c3RvbUVuZHBvaW50VGVsZW1ldHJ5U2VydmljZTogSUN1c3RvbUVuZHBvaW50VGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVRlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVzdFNlcnZpY2U6IElUZXN0U2VydmljZSxcblx0XHRASVRlc3RSZXN1bHRTZXJ2aWNlIHRlc3RSZXN1bHRTZXJ2aWNlOiBJVGVzdFJlc3VsdFNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX29wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHRcdHRoaXMucGFyZW50U2Vzc2lvbiA9IHRoaXMuX29wdGlvbnMucGFyZW50U2Vzc2lvbjtcblx0XHRpZiAodGhpcy5oYXNTZXBhcmF0ZVJlcGwoKSkge1xuXHRcdFx0dGhpcy5yZXBsID0gbmV3IFJlcGxNb2RlbCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yZXBsID0gKHRoaXMucGFyZW50U2Vzc2lvbiBhcyBEZWJ1Z1Nlc3Npb24pLnJlcGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9EaXNwb3NlID0gdGhpcy5nbG9iYWxEaXNwb3NhYmxlcztcblx0XHRjb25zdCByZXBsTGlzdGVuZXIgPSB0b0Rpc3Bvc2UuYWRkKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0XHRyZXBsTGlzdGVuZXIudmFsdWUgPSB0aGlzLnJlcGwub25EaWRDaGFuZ2VFbGVtZW50cygoZSkgPT4gdGhpcy5fb25EaWRDaGFuZ2VSRVBMRWxlbWVudHMuZmlyZShlKSk7XG5cdFx0aWYgKGxpZmVjeWNsZVNlcnZpY2UpIHtcblx0XHRcdHRvRGlzcG9zZS5hZGQobGlmZWN5Y2xlU2VydmljZS5vbldpbGxTaHV0ZG93bigoKSA9PiB7XG5cdFx0XHRcdHRoaXMuc2h1dGRvd24oKTtcblx0XHRcdFx0ZGlzcG9zZSh0b0Rpc3Bvc2UpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdC8vIENhc3QgaGVyZSwgaXQncyBub3QgcG9zc2libGUgdG8gcmVmZXJlbmNlIGEgaHlkcmF0ZWQgcmVzdWx0IGluIHRoaXMgY29kZSBwYXRoLlxuXHRcdHRoaXMuY29ycmVsYXRlZFRlc3RSdW4gPSBvcHRpb25zPy50ZXN0UnVuXG5cdFx0XHQ/ICh0ZXN0UmVzdWx0U2VydmljZS5nZXRSZXN1bHQob3B0aW9ucy50ZXN0UnVuLnJ1bklkKSBhcyBMaXZlVGVzdFJlc3VsdClcblx0XHRcdDogdGhpcy5wYXJlbnRTZXNzaW9uPy5jb3JyZWxhdGVkVGVzdFJ1bjtcblxuXHRcdGlmICh0aGlzLmNvcnJlbGF0ZWRUZXN0UnVuKSB7XG5cdFx0XHQvLyBMaXN0ZW4gdG8gdGhlIHRlc3QgY29tcGxldGluZyBiZWNhdXNlIHRoZSB1c2VyIG1pZ2h0IGhhdmUgdGFrZW4gdGhlIGNhbmNlbCBhY3Rpb24gcmF0aGVyIHRoYW4gc3RvcHBpbmcgdGhlIHNlc3Npb24uXG5cdFx0XHR0b0Rpc3Bvc2UuYWRkKHRoaXMuY29ycmVsYXRlZFRlc3RSdW4ub25Db21wbGV0ZSgoKSA9PiB0aGlzLnRlcm1pbmF0ZSgpKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29tcG91bmRSb290ID0gdGhpcy5fb3B0aW9ucy5jb21wb3VuZFJvb3Q7XG5cdFx0aWYgKGNvbXBvdW5kUm9vdCkge1xuXHRcdFx0dG9EaXNwb3NlLmFkZChjb21wb3VuZFJvb3Qub25EaWRTZXNzaW9uU3RvcCgoKSA9PiB0aGlzLnRlcm1pbmF0ZSgpKSk7XG5cdFx0fVxuXHRcdHRoaXMucGFzc0ZvY3VzU2NoZWR1bGVyID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4ge1xuXHRcdFx0Ly8gSWYgdGhlcmUgaXMgc29tZSBzZXNzaW9uIG9yIHRocmVhZCB0aGF0IGlzIHN0b3BwZWQgcGFzcyBmb2N1cyB0byBpdFxuXHRcdFx0aWYgKHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0U2Vzc2lvbnMoKS5zb21lKHMgPT4gcy5zdGF0ZSA9PT0gU3RhdGUuU3RvcHBlZCkgfHwgdGhpcy5nZXRBbGxUaHJlYWRzKCkuc29tZSh0ID0+IHQuc3RvcHBlZCkpIHtcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLmxhc3RDb250aW51ZWRUaHJlYWRJZCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkVGhyZWFkO1xuXHRcdFx0XHRcdGlmICh0aHJlYWQgJiYgdGhyZWFkLnRocmVhZElkID09PSB0aGlzLmxhc3RDb250aW51ZWRUaHJlYWRJZCAmJiAhdGhyZWFkLnN0b3BwZWQpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHRvRm9jdXNUaHJlYWRJZCA9IHRoaXMuZ2V0U3RvcHBlZERldGFpbHMoKT8udGhyZWFkSWQ7XG5cdFx0XHRcdFx0XHRjb25zdCB0b0ZvY3VzVGhyZWFkID0gdHlwZW9mIHRvRm9jdXNUaHJlYWRJZCA9PT0gJ251bWJlcicgPyB0aGlzLmdldFRocmVhZCh0b0ZvY3VzVGhyZWFkSWQpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UuZm9jdXNTdGFja0ZyYW1lKHVuZGVmaW5lZCwgdG9Gb2N1c1RocmVhZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHRcdFx0XHRpZiAoc2Vzc2lvbiAmJiBzZXNzaW9uLmdldElkKCkgPT09IHRoaXMuZ2V0SWQoKSAmJiBzZXNzaW9uLnN0YXRlICE9PSBTdGF0ZS5TdG9wcGVkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmRlYnVnU2VydmljZS5mb2N1c1N0YWNrRnJhbWUodW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LCA4MDApO1xuXG5cdFx0Y29uc3QgcGFyZW50ID0gdGhpcy5fb3B0aW9ucy5wYXJlbnRTZXNzaW9uO1xuXHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdHRvRGlzcG9zZS5hZGQocGFyZW50Lm9uRGlkRW5kQWRhcHRlcigoKSA9PiB7XG5cdFx0XHRcdC8vIGNvcHkgdGhlIHBhcmVudCByZXBsIGFuZCBnZXQgYSBuZXcgZGV0YWNoZWQgcmVwbCBmb3IgdGhpcyBjaGlsZCwgYW5kXG5cdFx0XHRcdC8vIHJlbW92ZSBpdHMgcGFyZW50LCBpZiBpdCdzIHN0aWxsIHJ1bm5pbmdcblx0XHRcdFx0aWYgKCF0aGlzLmhhc1NlcGFyYXRlUmVwbCgpICYmIHRoaXMucmF3Py5pc0luU2h1dGRvd24gPT09IGZhbHNlKSB7XG5cdFx0XHRcdFx0dGhpcy5yZXBsID0gdGhpcy5yZXBsLmNsb25lKCk7XG5cdFx0XHRcdFx0cmVwbExpc3RlbmVyLnZhbHVlID0gdGhpcy5yZXBsLm9uRGlkQ2hhbmdlRWxlbWVudHMoKGUpID0+IHRoaXMuX29uRGlkQ2hhbmdlUkVQTEVsZW1lbnRzLmZpcmUoZSkpO1xuXHRcdFx0XHRcdHRoaXMucGFyZW50U2Vzc2lvbiA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdGdldElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuaWQ7XG5cdH1cblxuXHRzZXRTdWJJZChzdWJJZDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fc3ViSWQgPSBzdWJJZDtcblx0fVxuXG5cdGdldE1lbW9yeShtZW1vcnlSZWZlcmVuY2U6IHN0cmluZyk6IElNZW1vcnlSZWdpb24ge1xuXHRcdHJldHVybiBuZXcgTWVtb3J5UmVnaW9uKG1lbW9yeVJlZmVyZW5jZSwgdGhpcyk7XG5cdH1cblxuXHRnZXQgc3ViSWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fc3ViSWQ7XG5cdH1cblxuXHRnZXQgY29uZmlndXJhdGlvbigpOiBJQ29uZmlnIHtcblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvbi5yZXNvbHZlZDtcblx0fVxuXG5cdGdldCB1bnJlc29sdmVkQ29uZmlndXJhdGlvbigpOiBJQ29uZmlnIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvbi51bnJlc29sdmVkO1xuXHR9XG5cblx0Z2V0IGxpZmVjeWNsZU1hbmFnZWRCeVBhcmVudCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLl9vcHRpb25zLmxpZmVjeWNsZU1hbmFnZWRCeVBhcmVudDtcblx0fVxuXG5cdGdldCBjb21wYWN0KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuX29wdGlvbnMuY29tcGFjdDtcblx0fVxuXG5cdGdldCBzYXZlQmVmb3JlUmVzdGFydCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fb3B0aW9ucy5zYXZlQmVmb3JlUmVzdGFydCA/PyAhdGhpcy5fb3B0aW9ucz8ucGFyZW50U2Vzc2lvbjtcblx0fVxuXG5cdGdldCBjb21wb3VuZFJvb3QoKTogRGVidWdDb21wb3VuZFJvb3QgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9vcHRpb25zLmNvbXBvdW5kUm9vdDtcblx0fVxuXG5cdGdldCBzdXBwcmVzc0RlYnVnU3RhdHVzYmFyKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9vcHRpb25zLnN1cHByZXNzRGVidWdTdGF0dXNiYXIgPz8gZmFsc2U7XG5cdH1cblxuXHRnZXQgc3VwcHJlc3NEZWJ1Z1Rvb2xiYXIoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX29wdGlvbnMuc3VwcHJlc3NEZWJ1Z1Rvb2xiYXIgPz8gZmFsc2U7XG5cdH1cblxuXHRnZXQgc3VwcHJlc3NEZWJ1Z1ZpZXcoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX29wdGlvbnMuc3VwcHJlc3NEZWJ1Z1ZpZXcgPz8gZmFsc2U7XG5cdH1cblxuXG5cdGdldCBhdXRvRXhwYW5kTGF6eVZhcmlhYmxlcygpOiBib29sZWFuIHtcblx0XHQvLyBUaGlzIHRpbnkgaGVscGVyIGF2b2lkcyBjb252ZXJ0aW5nIHRoZSBlbnRpcmUgZGVidWcgbW9kZWwgdG8gdXNlIHNlcnZpY2UgaW5qZWN0aW9uXG5cdFx0Y29uc3Qgc2NyZWVuUmVhZGVyT3B0aW1pemVkID0gdGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpO1xuXHRcdGNvbnN0IHZhbHVlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRGVidWdDb25maWd1cmF0aW9uPignZGVidWcnKS5hdXRvRXhwYW5kTGF6eVZhcmlhYmxlcztcblx0XHRyZXR1cm4gdmFsdWUgPT09ICdhdXRvJyAmJiBzY3JlZW5SZWFkZXJPcHRpbWl6ZWQgfHwgdmFsdWUgPT09ICdvbic7XG5cdH1cblxuXHRzZXRDb25maWd1cmF0aW9uKGNvbmZpZ3VyYXRpb246IHsgcmVzb2x2ZWQ6IElDb25maWc7IHVucmVzb2x2ZWQ6IElDb25maWcgfCB1bmRlZmluZWQgfSkge1xuXHRcdHRoaXMuX2NvbmZpZ3VyYXRpb24gPSBjb25maWd1cmF0aW9uO1xuXHR9XG5cblx0Z2V0TGFiZWwoKTogc3RyaW5nIHtcblx0XHRjb25zdCBpbmNsdWRlUm9vdCA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5sZW5ndGggPiAxO1xuXHRcdHJldHVybiBpbmNsdWRlUm9vdCAmJiB0aGlzLnJvb3QgPyBgJHt0aGlzLm5hbWV9ICgke3Jlc291cmNlcy5iYXNlbmFtZU9yQXV0aG9yaXR5KHRoaXMucm9vdC51cmkpfSlgIDogdGhpcy5uYW1lO1xuXHR9XG5cblx0c2V0TmFtZShuYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9uYW1lID0gbmFtZTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZU5hbWUuZmlyZShuYW1lKTtcblx0fVxuXG5cdGdldCBuYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX25hbWUgfHwgdGhpcy5jb25maWd1cmF0aW9uLm5hbWU7XG5cdH1cblxuXHRnZXQgc3RhdGUoKTogU3RhdGUge1xuXHRcdGlmICghdGhpcy5pbml0aWFsaXplZCkge1xuXHRcdFx0cmV0dXJuIFN0YXRlLkluaXRpYWxpemluZztcblx0XHR9XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0cmV0dXJuIFN0YXRlLkluYWN0aXZlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvY3VzZWRUaHJlYWQgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkVGhyZWFkO1xuXHRcdGlmIChmb2N1c2VkVGhyZWFkICYmIGZvY3VzZWRUaHJlYWQuc2Vzc2lvbiA9PT0gdGhpcykge1xuXHRcdFx0cmV0dXJuIGZvY3VzZWRUaHJlYWQuc3RvcHBlZCA/IFN0YXRlLlN0b3BwZWQgOiBTdGF0ZS5SdW5uaW5nO1xuXHRcdH1cblx0XHRpZiAodGhpcy5nZXRBbGxUaHJlYWRzKCkuc29tZSh0ID0+IHQuc3RvcHBlZCkpIHtcblx0XHRcdHJldHVybiBTdGF0ZS5TdG9wcGVkO1xuXHRcdH1cblxuXHRcdHJldHVybiBTdGF0ZS5SdW5uaW5nO1xuXHR9XG5cblx0Z2V0IGNhcGFiaWxpdGllcygpOiBEZWJ1Z1Byb3RvY29sLkNhcGFiaWxpdGllcyB7XG5cdFx0cmV0dXJuIHRoaXMucmF3ID8gdGhpcy5yYXcuY2FwYWJpbGl0aWVzIDogT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0fVxuXG5cdC8vLS0tLSBldmVudHNcblx0Z2V0IG9uRGlkQ2hhbmdlU3RhdGUoKTogRXZlbnQ8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmV2ZW50O1xuXHR9XG5cblx0Z2V0IG9uRGlkRW5kQWRhcHRlcigpOiBFdmVudDxBZGFwdGVyRW5kRXZlbnQgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRFbmRBZGFwdGVyLmV2ZW50O1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlUmVwbEVsZW1lbnRzKCk6IEV2ZW50PElSZXBsRWxlbWVudCB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZENoYW5nZVJFUExFbGVtZW50cy5ldmVudDtcblx0fVxuXG5cdGdldCBvbkRpZENoYW5nZU5hbWUoKTogRXZlbnQ8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIHRoaXMuX29uRGlkQ2hhbmdlTmFtZS5ldmVudDtcblx0fVxuXG5cdC8vLS0tLSBEQVAgZXZlbnRzXG5cblx0Z2V0IG9uRGlkQ3VzdG9tRXZlbnQoKTogRXZlbnQ8RGVidWdQcm90b2NvbC5FdmVudD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZEN1c3RvbUV2ZW50LmV2ZW50O1xuXHR9XG5cblx0Z2V0IG9uRGlkTG9hZGVkU291cmNlKCk6IEV2ZW50PExvYWRlZFNvdXJjZUV2ZW50PiB7XG5cdFx0cmV0dXJuIHRoaXMuX29uRGlkTG9hZGVkU291cmNlLmV2ZW50O1xuXHR9XG5cblx0Z2V0IG9uRGlkUHJvZ3Jlc3NTdGFydCgpOiBFdmVudDxEZWJ1Z1Byb3RvY29sLlByb2dyZXNzU3RhcnRFdmVudD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZFByb2dyZXNzU3RhcnQuZXZlbnQ7XG5cdH1cblxuXHRnZXQgb25EaWRQcm9ncmVzc1VwZGF0ZSgpOiBFdmVudDxEZWJ1Z1Byb3RvY29sLlByb2dyZXNzVXBkYXRlRXZlbnQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRQcm9ncmVzc1VwZGF0ZS5ldmVudDtcblx0fVxuXG5cdGdldCBvbkRpZFByb2dyZXNzRW5kKCk6IEV2ZW50PERlYnVnUHJvdG9jb2wuUHJvZ3Jlc3NFbmRFdmVudD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZFByb2dyZXNzRW5kLmV2ZW50O1xuXHR9XG5cblx0Z2V0IG9uRGlkSW52YWxpZGF0ZU1lbW9yeSgpOiBFdmVudDxEZWJ1Z1Byb3RvY29sLk1lbW9yeUV2ZW50PiB7XG5cdFx0cmV0dXJuIHRoaXMuX29uRGlkSW52YWxpZE1lbW9yeS5ldmVudDtcblx0fVxuXG5cdC8vLS0tLSBEQVAgcmVxdWVzdHNcblxuXHQvKipcblx0ICogY3JlYXRlIGFuZCBpbml0aWFsaXplIGEgbmV3IGRlYnVnIGFkYXB0ZXIgZm9yIHRoaXMgc2Vzc2lvblxuXHQgKi9cblx0YXN5bmMgaW5pdGlhbGl6ZShkYmdyOiBJRGVidWdnZXIpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdGlmICh0aGlzLnJhdykge1xuXHRcdFx0Ly8gaWYgdGhlcmUgd2FzIGFscmVhZHkgYSBjb25uZWN0aW9uIG1ha2Ugc3VyZSB0byByZW1vdmUgb2xkIGxpc3RlbmVyc1xuXHRcdFx0YXdhaXQgdGhpcy5zaHV0ZG93bigpO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBkZWJ1Z0FkYXB0ZXIgPSBhd2FpdCBkYmdyLmNyZWF0ZURlYnVnQWRhcHRlcih0aGlzKTtcblx0XHRcdHRoaXMucmF3ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSYXdEZWJ1Z1Nlc3Npb24sIGRlYnVnQWRhcHRlciwgZGJnciwgdGhpcy5pZCwgdGhpcy5jb25maWd1cmF0aW9uLm5hbWUpO1xuXG5cdFx0XHRhd2FpdCB0aGlzLnJhdy5zdGFydCgpO1xuXHRcdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHRcdFx0YXdhaXQgdGhpcy5yYXcuaW5pdGlhbGl6ZSh7XG5cdFx0XHRcdGNsaWVudElEOiAndnNjb2RlJyxcblx0XHRcdFx0Y2xpZW50TmFtZTogdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyxcblx0XHRcdFx0YWRhcHRlcklEOiB0aGlzLmNvbmZpZ3VyYXRpb24udHlwZSxcblx0XHRcdFx0cGF0aEZvcm1hdDogJ3BhdGgnLFxuXHRcdFx0XHRsaW5lc1N0YXJ0QXQxOiB0cnVlLFxuXHRcdFx0XHRjb2x1bW5zU3RhcnRBdDE6IHRydWUsXG5cdFx0XHRcdHN1cHBvcnRzVmFyaWFibGVUeXBlOiB0cnVlLCAvLyAjODg1OFxuXHRcdFx0XHRzdXBwb3J0c1ZhcmlhYmxlUGFnaW5nOiB0cnVlLCAvLyAjOTUzN1xuXHRcdFx0XHRzdXBwb3J0c1J1bkluVGVybWluYWxSZXF1ZXN0OiB0cnVlLCAvLyAjMTA1NzRcblx0XHRcdFx0bG9jYWxlOiBwbGF0Zm9ybS5sYW5ndWFnZSwgLy8gIzE2OTExNFxuXHRcdFx0XHRzdXBwb3J0c1Byb2dyZXNzUmVwb3J0aW5nOiB0cnVlLCAvLyAjOTIyNTNcblx0XHRcdFx0c3VwcG9ydHNJbnZhbGlkYXRlZEV2ZW50OiB0cnVlLCAvLyAjMTA2NzQ1XG5cdFx0XHRcdHN1cHBvcnRzTWVtb3J5UmVmZXJlbmNlczogdHJ1ZSwgLy8jMTI5Njg0XG5cdFx0XHRcdHN1cHBvcnRzQXJnc0NhbkJlSW50ZXJwcmV0ZWRCeVNoZWxsOiB0cnVlLCAvLyAjMTQ5OTEwXG5cdFx0XHRcdHN1cHBvcnRzTWVtb3J5RXZlbnQ6IHRydWUsIC8vICMxMzM2NDNcblx0XHRcdFx0c3VwcG9ydHNTdGFydERlYnVnZ2luZ1JlcXVlc3Q6IHRydWUsXG5cdFx0XHRcdHN1cHBvcnRzQU5TSVN0eWxpbmc6IHRydWUsXG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmZpcmUoKTtcblx0XHRcdHRoaXMucmVtZW1iZXJlZENhcGFiaWxpdGllcyA9IHRoaXMucmF3LmNhcGFiaWxpdGllcztcblx0XHRcdHRoaXMuZGVidWdTZXJ2aWNlLnNldEV4Y2VwdGlvbkJyZWFrcG9pbnRzRm9yU2Vzc2lvbih0aGlzLCAodGhpcy5yYXcgJiYgdGhpcy5yYXcuY2FwYWJpbGl0aWVzLmV4Y2VwdGlvbkJyZWFrcG9pbnRGaWx0ZXJzKSB8fCBbXSk7XG5cdFx0XHR0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLnJlZ2lzdGVyQnJlYWtwb2ludE1vZGVzKHRoaXMuY29uZmlndXJhdGlvbi50eXBlLCB0aGlzLnJhdy5jYXBhYmlsaXRpZXMuYnJlYWtwb2ludE1vZGVzIHx8IFtdKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKCk7XG5cdFx0XHRhd2FpdCB0aGlzLnNodXRkb3duKCk7XG5cdFx0XHR0aHJvdyBlcnI7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIGxhdW5jaCBvciBhdHRhY2ggdG8gdGhlIGRlYnVnZ2VlXG5cdCAqL1xuXHRhc3luYyBsYXVuY2hPckF0dGFjaChjb25maWc6IElDb25maWcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vRGVidWdBZGFwdGVyJywgXCJObyBkZWJ1Z2dlciBhdmFpbGFibGUsIGNhbiBub3Qgc2VuZCAnezB9J1wiLCAnbGF1bmNoIG9yIGF0dGFjaCcpKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMucGFyZW50U2Vzc2lvbiAmJiB0aGlzLnBhcmVudFNlc3Npb24uc3RhdGUgPT09IFN0YXRlLkluYWN0aXZlKSB7XG5cdFx0XHR0aHJvdyBjYW5jZWxlZCgpO1xuXHRcdH1cblxuXHRcdC8vIF9fc2Vzc2lvbklEIG9ubHkgdXNlZCBmb3IgRUggZGVidWdnaW5nIChidXQgd2UgYWRkIGl0IGFsd2F5cyBmb3Igbm93Li4uKVxuXHRcdGNvbmZpZy5fX3Nlc3Npb25JZCA9IHRoaXMuZ2V0SWQoKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5yYXcubGF1bmNoT3JBdHRhY2goY29uZmlnKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHRoaXMuc2h1dGRvd24oKTtcblx0XHRcdHRocm93IGVycjtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogVGVybWluYXRlIGFueSBsaW5rZWQgdGVzdCBydW4uXG5cdCAqL1xuXHRjYW5jZWxDb3JyZWxhdGVkVGVzdFJ1bigpIHtcblx0XHRpZiAodGhpcy5jb3JyZWxhdGVkVGVzdFJ1biAmJiAhdGhpcy5jb3JyZWxhdGVkVGVzdFJ1bi5jb21wbGV0ZWRBdCkge1xuXHRcdFx0dGhpcy5kaWRUZXJtaW5hdGVUZXN0UnVuID0gdHJ1ZTtcblx0XHRcdHRoaXMudGVzdFNlcnZpY2UuY2FuY2VsVGVzdFJ1bih0aGlzLmNvcnJlbGF0ZWRUZXN0UnVuLmlkKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogdGVybWluYXRlIHRoZSBjdXJyZW50IGRlYnVnIGFkYXB0ZXIgc2Vzc2lvblxuXHQgKi9cblx0YXN5bmMgdGVybWluYXRlKHJlc3RhcnQgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdC8vIEFkYXB0ZXIgd2VudCBkb3duIGJ1dCBpdCBkaWQgbm90IHNlbmQgYSAndGVybWluYXRlZCcgZXZlbnQsIHNpbXVsYXRlIGxpa2UgdGhlIGV2ZW50IGhhcyBiZWVuIHNlbnRcblx0XHRcdHRoaXMub25EaWRFeGl0QWRhcHRlcigpO1xuXHRcdH1cblxuXHRcdHRoaXMuY2FuY2VsQWxsUmVxdWVzdHMoKTtcblx0XHRpZiAodGhpcy5fb3B0aW9ucy5saWZlY3ljbGVNYW5hZ2VkQnlQYXJlbnQgJiYgdGhpcy5wYXJlbnRTZXNzaW9uKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnBhcmVudFNlc3Npb24udGVybWluYXRlKHJlc3RhcnQpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5jb3JyZWxhdGVkVGVzdFJ1biAmJiAhdGhpcy5jb3JyZWxhdGVkVGVzdFJ1bi5jb21wbGV0ZWRBdCAmJiAhdGhpcy5kaWRUZXJtaW5hdGVUZXN0UnVuKSB7XG5cdFx0XHR0aGlzLmNhbmNlbENvcnJlbGF0ZWRUZXN0UnVuKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLnJhdykge1xuXHRcdFx0aWYgKHRoaXMucmF3LmNhcGFiaWxpdGllcy5zdXBwb3J0c1Rlcm1pbmF0ZVJlcXVlc3QgJiYgdGhpcy5fY29uZmlndXJhdGlvbi5yZXNvbHZlZC5yZXF1ZXN0ID09PSAnbGF1bmNoJykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnJhdy50ZXJtaW5hdGUocmVzdGFydCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnJhdy5kaXNjb25uZWN0KHsgcmVzdGFydCwgdGVybWluYXRlRGVidWdnZWU6IHRydWUgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFyZXN0YXJ0KSB7XG5cdFx0XHR0aGlzLl9vcHRpb25zLmNvbXBvdW5kUm9vdD8uc2Vzc2lvblN0b3BwZWQoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogZW5kIHRoZSBjdXJyZW50IGRlYnVnIGFkYXB0ZXIgc2Vzc2lvblxuXHQgKi9cblx0YXN5bmMgZGlzY29ubmVjdChyZXN0YXJ0ID0gZmFsc2UsIHN1c3BlbmQgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdC8vIEFkYXB0ZXIgd2VudCBkb3duIGJ1dCBpdCBkaWQgbm90IHNlbmQgYSAndGVybWluYXRlZCcgZXZlbnQsIHNpbXVsYXRlIGxpa2UgdGhlIGV2ZW50IGhhcyBiZWVuIHNlbnRcblx0XHRcdHRoaXMub25EaWRFeGl0QWRhcHRlcigpO1xuXHRcdH1cblxuXHRcdHRoaXMuY2FuY2VsQWxsUmVxdWVzdHMoKTtcblx0XHRpZiAodGhpcy5fb3B0aW9ucy5saWZlY3ljbGVNYW5hZ2VkQnlQYXJlbnQgJiYgdGhpcy5wYXJlbnRTZXNzaW9uKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnBhcmVudFNlc3Npb24uZGlzY29ubmVjdChyZXN0YXJ0LCBzdXNwZW5kKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMucmF3KSB7XG5cdFx0XHQvLyBUT0RPIHRlcm1pbmF0ZURlYnVnZ2VlIHNob3VsZCBiZSB1bmRlZmluZWQgYnkgZGVmYXVsdD9cblx0XHRcdGF3YWl0IHRoaXMucmF3LmRpc2Nvbm5lY3QoeyByZXN0YXJ0LCB0ZXJtaW5hdGVEZWJ1Z2dlZTogZmFsc2UsIHN1c3BlbmREZWJ1Z2dlZTogc3VzcGVuZCB9KTtcblx0XHR9XG5cblx0XHRpZiAoIXJlc3RhcnQpIHtcblx0XHRcdHRoaXMuX29wdGlvbnMuY29tcG91bmRSb290Py5zZXNzaW9uU3RvcHBlZCgpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiByZXN0YXJ0IGRlYnVnIGFkYXB0ZXIgc2Vzc2lvblxuXHQgKi9cblx0YXN5bmMgcmVzdGFydCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vRGVidWdBZGFwdGVyJywgXCJObyBkZWJ1Z2dlciBhdmFpbGFibGUsIGNhbiBub3Qgc2VuZCAnezB9J1wiLCAncmVzdGFydCcpKTtcblx0XHR9XG5cblx0XHR0aGlzLmNhbmNlbEFsbFJlcXVlc3RzKCk7XG5cdFx0aWYgKHRoaXMuX29wdGlvbnMubGlmZWN5Y2xlTWFuYWdlZEJ5UGFyZW50ICYmIHRoaXMucGFyZW50U2Vzc2lvbikge1xuXHRcdFx0YXdhaXQgdGhpcy5wYXJlbnRTZXNzaW9uLnJlc3RhcnQoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXdhaXQgdGhpcy5yYXcucmVzdGFydCh7IGFyZ3VtZW50czogdGhpcy5jb25maWd1cmF0aW9uIH0pO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHNlbmRCcmVha3BvaW50cyhtb2RlbFVyaTogVVJJLCBicmVha3BvaW50c1RvU2VuZDogSUJyZWFrcG9pbnRbXSwgc291cmNlTW9kaWZpZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vRGVidWdBZGFwdGVyJywgXCJObyBkZWJ1Z2dlciBhdmFpbGFibGUsIGNhbiBub3Qgc2VuZCAnezB9J1wiLCAnYnJlYWtwb2ludHMnKSk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLnJhdy5yZWFkeUZvckJyZWFrcG9pbnRzKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmF3U291cmNlID0gdGhpcy5nZXRSYXdTb3VyY2UobW9kZWxVcmkpO1xuXHRcdGlmIChicmVha3BvaW50c1RvU2VuZC5sZW5ndGggJiYgIXJhd1NvdXJjZS5hZGFwdGVyRGF0YSkge1xuXHRcdFx0cmF3U291cmNlLmFkYXB0ZXJEYXRhID0gYnJlYWtwb2ludHNUb1NlbmRbMF0uYWRhcHRlckRhdGE7XG5cdFx0fVxuXHRcdC8vIE5vcm1hbGl6ZSBhbGwgZHJpdmUgbGV0dGVycyBnb2luZyBvdXQgZnJvbSB2c2NvZGUgdG8gZGVidWcgYWRhcHRlcnMgc28gd2UgYXJlIGNvbnNpc3RlbnQgd2l0aCBvdXIgcmVzb2x2aW5nICM0Mzk1OVxuXHRcdGlmIChyYXdTb3VyY2UucGF0aCkge1xuXHRcdFx0cmF3U291cmNlLnBhdGggPSBub3JtYWxpemVEcml2ZUxldHRlcihyYXdTb3VyY2UucGF0aCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJhdy5zZXRCcmVha3BvaW50cyh7XG5cdFx0XHRzb3VyY2U6IHJhd1NvdXJjZSxcblx0XHRcdGxpbmVzOiBicmVha3BvaW50c1RvU2VuZC5tYXAoYnAgPT4gYnAuc2Vzc2lvbkFnbm9zdGljRGF0YS5saW5lTnVtYmVyKSxcblx0XHRcdGJyZWFrcG9pbnRzOiBicmVha3BvaW50c1RvU2VuZC5tYXAoYnAgPT4gYnAudG9EQVAoKSksXG5cdFx0XHRzb3VyY2VNb2RpZmllZFxuXHRcdH0pO1xuXHRcdGlmIChyZXNwb25zZT8uYm9keSkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IG5ldyBNYXA8c3RyaW5nLCBEZWJ1Z1Byb3RvY29sLkJyZWFrcG9pbnQ+KCk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGJyZWFrcG9pbnRzVG9TZW5kLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGRhdGEuc2V0KGJyZWFrcG9pbnRzVG9TZW5kW2ldLmdldElkKCksIHJlc3BvbnNlLmJvZHkuYnJlYWtwb2ludHNbaV0pO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLm1vZGVsLnNldEJyZWFrcG9pbnRTZXNzaW9uRGF0YSh0aGlzLmdldElkKCksIHRoaXMuY2FwYWJpbGl0aWVzLCBkYXRhKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBzZW5kRnVuY3Rpb25CcmVha3BvaW50cyhmYnB0czogSUZ1bmN0aW9uQnJlYWtwb2ludFtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ2Z1bmN0aW9uIGJyZWFrcG9pbnRzJykpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnJhdy5yZWFkeUZvckJyZWFrcG9pbnRzKSB7XG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMucmF3LnNldEZ1bmN0aW9uQnJlYWtwb2ludHMoeyBicmVha3BvaW50czogZmJwdHMubWFwKGJwID0+IGJwLnRvREFQKCkpIH0pO1xuXHRcdFx0aWYgKHJlc3BvbnNlPy5ib2R5KSB7XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBuZXcgTWFwPHN0cmluZywgRGVidWdQcm90b2NvbC5CcmVha3BvaW50PigpO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGZicHRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0ZGF0YS5zZXQoZmJwdHNbaV0uZ2V0SWQoKSwgcmVzcG9uc2UuYm9keS5icmVha3BvaW50c1tpXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5tb2RlbC5zZXRCcmVha3BvaW50U2Vzc2lvbkRhdGEodGhpcy5nZXRJZCgpLCB0aGlzLmNhcGFiaWxpdGllcywgZGF0YSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgc2VuZEV4Y2VwdGlvbkJyZWFrcG9pbnRzKGV4YnB0czogSUV4Y2VwdGlvbkJyZWFrcG9pbnRbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm9EZWJ1Z0FkYXB0ZXInLCBcIk5vIGRlYnVnZ2VyIGF2YWlsYWJsZSwgY2FuIG5vdCBzZW5kICd7MH0nXCIsICdleGNlcHRpb24gYnJlYWtwb2ludHMnKSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMucmF3LnJlYWR5Rm9yQnJlYWtwb2ludHMpIHtcblx0XHRcdGNvbnN0IGFyZ3M6IERlYnVnUHJvdG9jb2wuU2V0RXhjZXB0aW9uQnJlYWtwb2ludHNBcmd1bWVudHMgPSB0aGlzLmNhcGFiaWxpdGllcy5zdXBwb3J0c0V4Y2VwdGlvbkZpbHRlck9wdGlvbnMgPyB7XG5cdFx0XHRcdGZpbHRlcnM6IFtdLFxuXHRcdFx0XHRmaWx0ZXJPcHRpb25zOiBleGJwdHMubWFwKGV4YiA9PiB7XG5cdFx0XHRcdFx0aWYgKGV4Yi5jb25kaXRpb24pIHtcblx0XHRcdFx0XHRcdHJldHVybiB7IGZpbHRlcklkOiBleGIuZmlsdGVyLCBjb25kaXRpb246IGV4Yi5jb25kaXRpb24gfTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4geyBmaWx0ZXJJZDogZXhiLmZpbHRlciB9O1xuXHRcdFx0XHR9KVxuXHRcdFx0fSA6IHsgZmlsdGVyczogZXhicHRzLm1hcChleGIgPT4gZXhiLmZpbHRlcikgfTtcblxuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJhdy5zZXRFeGNlcHRpb25CcmVha3BvaW50cyhhcmdzKTtcblx0XHRcdGlmIChyZXNwb25zZT8uYm9keSAmJiByZXNwb25zZS5ib2R5LmJyZWFrcG9pbnRzKSB7XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBuZXcgTWFwPHN0cmluZywgRGVidWdQcm90b2NvbC5CcmVha3BvaW50PigpO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGV4YnB0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGRhdGEuc2V0KGV4YnB0c1tpXS5nZXRJZCgpLCByZXNwb25zZS5ib2R5LmJyZWFrcG9pbnRzW2ldKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMubW9kZWwuc2V0QnJlYWtwb2ludFNlc3Npb25EYXRhKHRoaXMuZ2V0SWQoKSwgdGhpcy5jYXBhYmlsaXRpZXMsIGRhdGEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGRhdGFCeXRlc0JyZWFrcG9pbnRJbmZvKGFkZHJlc3M6IHN0cmluZywgYnl0ZXM6IG51bWJlcik6IFByb21pc2U8SURhdGFCcmVha3BvaW50SW5mb1Jlc3BvbnNlIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKHRoaXMucmF3Py5jYXBhYmlsaXRpZXMuc3VwcG9ydHNEYXRhQnJlYWtwb2ludEJ5dGVzID09PSBmYWxzZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdzZXNzaW9uRG9lc05vdFN1cHBvckJ5dGVzQnJlYWtwb2ludHMnLCBcIlNlc3Npb24gZG9lcyBub3Qgc3VwcG9ydCBicmVha3BvaW50cyB3aXRoIGJ5dGVzXCIpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fZGF0YUJyZWFrcG9pbnRJbmZvKHsgbmFtZTogYWRkcmVzcywgYnl0ZXMsIGFzQWRkcmVzczogdHJ1ZSB9KTtcblx0fVxuXG5cdGRhdGFCcmVha3BvaW50SW5mbyhuYW1lOiBzdHJpbmcsIHZhcmlhYmxlc1JlZmVyZW5jZT86IG51bWJlcik6IFByb21pc2U8eyBkYXRhSWQ6IHN0cmluZyB8IG51bGw7IGRlc2NyaXB0aW9uOiBzdHJpbmc7IGNhblBlcnNpc3Q/OiBib29sZWFuIH0gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fZGF0YUJyZWFrcG9pbnRJbmZvKHsgbmFtZSwgdmFyaWFibGVzUmVmZXJlbmNlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZGF0YUJyZWFrcG9pbnRJbmZvKGFyZ3M6IERlYnVnUHJvdG9jb2wuRGF0YUJyZWFrcG9pbnRJbmZvQXJndW1lbnRzKTogUHJvbWlzZTx7IGRhdGFJZDogc3RyaW5nIHwgbnVsbDsgZGVzY3JpcHRpb246IHN0cmluZzsgY2FuUGVyc2lzdD86IGJvb2xlYW4gfSB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm9EZWJ1Z0FkYXB0ZXInLCBcIk5vIGRlYnVnZ2VyIGF2YWlsYWJsZSwgY2FuIG5vdCBzZW5kICd7MH0nXCIsICdkYXRhIGJyZWFrcG9pbnRzIGluZm8nKSk7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5yYXcucmVhZHlGb3JCcmVha3BvaW50cykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdzZXNzaW9uTm90UmVhZHlGb3JCcmVha3BvaW50cycsIFwiU2Vzc2lvbiBpcyBub3QgcmVhZHkgZm9yIGJyZWFrcG9pbnRzXCIpKTtcblx0XHR9XG5cblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMucmF3LmRhdGFCcmVha3BvaW50SW5mbyhhcmdzKTtcblx0XHRyZXR1cm4gcmVzcG9uc2U/LmJvZHk7XG5cdH1cblxuXHRhc3luYyBzZW5kRGF0YUJyZWFrcG9pbnRzKGRhdGFCcmVha3BvaW50czogSURhdGFCcmVha3BvaW50W10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vRGVidWdBZGFwdGVyJywgXCJObyBkZWJ1Z2dlciBhdmFpbGFibGUsIGNhbiBub3Qgc2VuZCAnezB9J1wiLCAnZGF0YSBicmVha3BvaW50cycpKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5yYXcucmVhZHlGb3JCcmVha3BvaW50cykge1xuXHRcdFx0Y29uc3QgY29udmVydGVkID0gYXdhaXQgUHJvbWlzZS5hbGwoZGF0YUJyZWFrcG9pbnRzLm1hcChhc3luYyBicCA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgZGFwID0gYXdhaXQgYnAudG9EQVAodGhpcyk7XG5cdFx0XHRcdFx0cmV0dXJuIHsgZGFwLCBicCB9O1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgYnAsIG1lc3NhZ2U6IGUubWVzc2FnZSB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMucmF3LnNldERhdGFCcmVha3BvaW50cyh7IGJyZWFrcG9pbnRzOiBjb252ZXJ0ZWQubWFwKGQgPT4gZC5kYXApLmZpbHRlcihpc0RlZmluZWQpIH0pO1xuXHRcdFx0aWYgKHJlc3BvbnNlPy5ib2R5KSB7XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBuZXcgTWFwPHN0cmluZywgRGVidWdQcm90b2NvbC5CcmVha3BvaW50PigpO1xuXHRcdFx0XHRsZXQgaSA9IDA7XG5cdFx0XHRcdGZvciAoY29uc3QgZGFwIG9mIGNvbnZlcnRlZCkge1xuXHRcdFx0XHRcdGlmICghZGFwLmRhcCkge1xuXHRcdFx0XHRcdFx0ZGF0YS5zZXQoZGFwLmJwLmdldElkKCksIGRhcC5tZXNzYWdlKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGkgPCByZXNwb25zZS5ib2R5LmJyZWFrcG9pbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0ZGF0YS5zZXQoZGFwLmJwLmdldElkKCksIHJlc3BvbnNlLmJvZHkuYnJlYWtwb2ludHNbaSsrXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMubW9kZWwuc2V0QnJlYWtwb2ludFNlc3Npb25EYXRhKHRoaXMuZ2V0SWQoKSwgdGhpcy5jYXBhYmlsaXRpZXMsIGRhdGEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHNlbmRJbnN0cnVjdGlvbkJyZWFrcG9pbnRzKGluc3RydWN0aW9uQnJlYWtwb2ludHM6IElJbnN0cnVjdGlvbkJyZWFrcG9pbnRbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm9EZWJ1Z0FkYXB0ZXInLCBcIk5vIGRlYnVnZ2VyIGF2YWlsYWJsZSwgY2FuIG5vdCBzZW5kICd7MH0nXCIsICdpbnN0cnVjdGlvbiBicmVha3BvaW50cycpKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5yYXcucmVhZHlGb3JCcmVha3BvaW50cykge1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJhdy5zZXRJbnN0cnVjdGlvbkJyZWFrcG9pbnRzKHsgYnJlYWtwb2ludHM6IGluc3RydWN0aW9uQnJlYWtwb2ludHMubWFwKGliID0+IGliLnRvREFQKCkpIH0pO1xuXHRcdFx0aWYgKHJlc3BvbnNlPy5ib2R5KSB7XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBuZXcgTWFwPHN0cmluZywgRGVidWdQcm90b2NvbC5CcmVha3BvaW50PigpO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGluc3RydWN0aW9uQnJlYWtwb2ludHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRkYXRhLnNldChpbnN0cnVjdGlvbkJyZWFrcG9pbnRzW2ldLmdldElkKCksIHJlc3BvbnNlLmJvZHkuYnJlYWtwb2ludHNbaV0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMubW9kZWwuc2V0QnJlYWtwb2ludFNlc3Npb25EYXRhKHRoaXMuZ2V0SWQoKSwgdGhpcy5jYXBhYmlsaXRpZXMsIGRhdGEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGJyZWFrcG9pbnRzTG9jYXRpb25zKHVyaTogVVJJLCBsaW5lTnVtYmVyOiBudW1iZXIpOiBQcm9taXNlPElQb3NpdGlvbltdPiB7XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ2JyZWFrcG9pbnRzIGxvY2F0aW9ucycpKTtcblx0XHR9XG5cblx0XHRjb25zdCBzb3VyY2UgPSB0aGlzLmdldFJhd1NvdXJjZSh1cmkpO1xuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5yYXcuYnJlYWtwb2ludExvY2F0aW9ucyh7IHNvdXJjZSwgbGluZTogbGluZU51bWJlciB9KTtcblx0XHRpZiAoIXJlc3BvbnNlIHx8ICFyZXNwb25zZS5ib2R5IHx8ICFyZXNwb25zZS5ib2R5LmJyZWFrcG9pbnRzKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgcG9zaXRpb25zID0gcmVzcG9uc2UuYm9keS5icmVha3BvaW50cy5tYXAoYnAgPT4gKHsgbGluZU51bWJlcjogYnAubGluZSwgY29sdW1uOiBicC5jb2x1bW4gfHwgMSB9KSk7XG5cblx0XHRyZXR1cm4gZGlzdGluY3QocG9zaXRpb25zLCBwID0+IGAke3AubGluZU51bWJlcn06JHtwLmNvbHVtbn1gKTtcblx0fVxuXG5cdGdldERlYnVnUHJvdG9jb2xCcmVha3BvaW50KGJyZWFrcG9pbnRJZDogc3RyaW5nKTogRGVidWdQcm90b2NvbC5CcmVha3BvaW50IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXREZWJ1Z1Byb3RvY29sQnJlYWtwb2ludChicmVha3BvaW50SWQsIHRoaXMuZ2V0SWQoKSk7XG5cdH1cblxuXHRjdXN0b21SZXF1ZXN0KHJlcXVlc3Q6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLlJlc3BvbnNlIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgcmVxdWVzdCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnJhdy5jdXN0b20ocmVxdWVzdCwgYXJncyk7XG5cdH1cblxuXHRzdGFja1RyYWNlKHRocmVhZElkOiBudW1iZXIsIHN0YXJ0RnJhbWU6IG51bWJlciwgbGV2ZWxzOiBudW1iZXIsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8RGVidWdQcm90b2NvbC5TdGFja1RyYWNlUmVzcG9uc2UgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vRGVidWdBZGFwdGVyJywgXCJObyBkZWJ1Z2dlciBhdmFpbGFibGUsIGNhbiBub3Qgc2VuZCAnezB9J1wiLCAnc3RhY2tUcmFjZScpKTtcblx0XHR9XG5cblx0XHRjb25zdCBzZXNzaW9uVG9rZW4gPSB0aGlzLmdldE5ld0NhbmNlbGxhdGlvblRva2VuKHRocmVhZElkLCB0b2tlbik7XG5cdFx0cmV0dXJuIHRoaXMucmF3LnN0YWNrVHJhY2UoeyB0aHJlYWRJZCwgc3RhcnRGcmFtZSwgbGV2ZWxzIH0sIHNlc3Npb25Ub2tlbik7XG5cdH1cblxuXHRhc3luYyBleGNlcHRpb25JbmZvKHRocmVhZElkOiBudW1iZXIpOiBQcm9taXNlPElFeGNlcHRpb25JbmZvIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ2V4Y2VwdGlvbkluZm8nKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJhdy5leGNlcHRpb25JbmZvKHsgdGhyZWFkSWQgfSk7XG5cdFx0aWYgKHJlc3BvbnNlKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpZDogcmVzcG9uc2UuYm9keS5leGNlcHRpb25JZCxcblx0XHRcdFx0ZGVzY3JpcHRpb246IHJlc3BvbnNlLmJvZHkuZGVzY3JpcHRpb24sXG5cdFx0XHRcdGJyZWFrTW9kZTogcmVzcG9uc2UuYm9keS5icmVha01vZGUsXG5cdFx0XHRcdGRldGFpbHM6IHJlc3BvbnNlLmJvZHkuZGV0YWlsc1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0c2NvcGVzKGZyYW1lSWQ6IG51bWJlciwgdGhyZWFkSWQ6IG51bWJlcik6IFByb21pc2U8RGVidWdQcm90b2NvbC5TY29wZXNSZXNwb25zZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm9EZWJ1Z0FkYXB0ZXInLCBcIk5vIGRlYnVnZ2VyIGF2YWlsYWJsZSwgY2FuIG5vdCBzZW5kICd7MH0nXCIsICdzY29wZXMnKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9rZW4gPSB0aGlzLmdldE5ld0NhbmNlbGxhdGlvblRva2VuKHRocmVhZElkKTtcblx0XHRyZXR1cm4gdGhpcy5yYXcuc2NvcGVzKHsgZnJhbWVJZCB9LCB0b2tlbik7XG5cdH1cblxuXHR2YXJpYWJsZXModmFyaWFibGVzUmVmZXJlbmNlOiBudW1iZXIsIHRocmVhZElkOiBudW1iZXIgfCB1bmRlZmluZWQsIGZpbHRlcjogJ2luZGV4ZWQnIHwgJ25hbWVkJyB8IHVuZGVmaW5lZCwgc3RhcnQ6IG51bWJlciB8IHVuZGVmaW5lZCwgY291bnQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IFByb21pc2U8RGVidWdQcm90b2NvbC5WYXJpYWJsZXNSZXNwb25zZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm9EZWJ1Z0FkYXB0ZXInLCBcIk5vIGRlYnVnZ2VyIGF2YWlsYWJsZSwgY2FuIG5vdCBzZW5kICd7MH0nXCIsICd2YXJpYWJsZXMnKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9rZW4gPSB0aHJlYWRJZCA/IHRoaXMuZ2V0TmV3Q2FuY2VsbGF0aW9uVG9rZW4odGhyZWFkSWQpIDogdW5kZWZpbmVkO1xuXHRcdHJldHVybiB0aGlzLnJhdy52YXJpYWJsZXMoeyB2YXJpYWJsZXNSZWZlcmVuY2UsIGZpbHRlciwgc3RhcnQsIGNvdW50IH0sIHRva2VuKTtcblx0fVxuXG5cdGV2YWx1YXRlKGV4cHJlc3Npb246IHN0cmluZywgZnJhbWVJZDogbnVtYmVyLCBjb250ZXh0Pzogc3RyaW5nLCBsb2NhdGlvbj86IHsgbGluZTogbnVtYmVyOyBjb2x1bW46IG51bWJlcjsgc291cmNlOiBEZWJ1Z1Byb3RvY29sLlNvdXJjZSB9KTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLkV2YWx1YXRlUmVzcG9uc2UgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vRGVidWdBZGFwdGVyJywgXCJObyBkZWJ1Z2dlciBhdmFpbGFibGUsIGNhbiBub3Qgc2VuZCAnezB9J1wiLCAnZXZhbHVhdGUnKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucmF3LmV2YWx1YXRlKHsgZXhwcmVzc2lvbiwgZnJhbWVJZCwgY29udGV4dCwgbGluZTogbG9jYXRpb24/LmxpbmUsIGNvbHVtbjogbG9jYXRpb24/LmNvbHVtbiwgc291cmNlOiBsb2NhdGlvbj8uc291cmNlIH0pO1xuXHR9XG5cblx0YXN5bmMgcmVzdGFydEZyYW1lKGZyYW1lSWQ6IG51bWJlciwgdGhyZWFkSWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMud2FpdEZvclRyaWdnZXJlZEJyZWFrcG9pbnRzKCk7XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ3Jlc3RhcnRGcmFtZScpKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLnJhdy5yZXN0YXJ0RnJhbWUoeyBmcmFtZUlkIH0sIHRocmVhZElkKTtcblx0fVxuXG5cdHByaXZhdGUgc2V0TGFzdFN0ZXBwaW5nR3JhbnVsYXJpdHkodGhyZWFkSWQ6IG51bWJlciwgZ3JhbnVsYXJpdHk/OiBEZWJ1Z1Byb3RvY29sLlN0ZXBwaW5nR3JhbnVsYXJpdHkpIHtcblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLmdldFRocmVhZCh0aHJlYWRJZCk7XG5cdFx0aWYgKHRocmVhZCkge1xuXHRcdFx0dGhyZWFkLmxhc3RTdGVwcGluZ0dyYW51bGFyaXR5ID0gZ3JhbnVsYXJpdHk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgbmV4dCh0aHJlYWRJZDogbnVtYmVyLCBncmFudWxhcml0eT86IERlYnVnUHJvdG9jb2wuU3RlcHBpbmdHcmFudWxhcml0eSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMud2FpdEZvclRyaWdnZXJlZEJyZWFrcG9pbnRzKCk7XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ25leHQnKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRMYXN0U3RlcHBpbmdHcmFudWxhcml0eSh0aHJlYWRJZCwgZ3JhbnVsYXJpdHkpO1xuXHRcdGF3YWl0IHRoaXMucmF3Lm5leHQoeyB0aHJlYWRJZCwgZ3JhbnVsYXJpdHkgfSk7XG5cdH1cblxuXHRhc3luYyBzdGVwSW4odGhyZWFkSWQ6IG51bWJlciwgdGFyZ2V0SWQ/OiBudW1iZXIsIGdyYW51bGFyaXR5PzogRGVidWdQcm90b2NvbC5TdGVwcGluZ0dyYW51bGFyaXR5KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy53YWl0Rm9yVHJpZ2dlcmVkQnJlYWtwb2ludHMoKTtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vRGVidWdBZGFwdGVyJywgXCJObyBkZWJ1Z2dlciBhdmFpbGFibGUsIGNhbiBub3Qgc2VuZCAnezB9J1wiLCAnc3RlcEluJykpO1xuXHRcdH1cblxuXHRcdHRoaXMuc2V0TGFzdFN0ZXBwaW5nR3JhbnVsYXJpdHkodGhyZWFkSWQsIGdyYW51bGFyaXR5KTtcblx0XHRhd2FpdCB0aGlzLnJhdy5zdGVwSW4oeyB0aHJlYWRJZCwgdGFyZ2V0SWQsIGdyYW51bGFyaXR5IH0pO1xuXHR9XG5cblx0YXN5bmMgc3RlcE91dCh0aHJlYWRJZDogbnVtYmVyLCBncmFudWxhcml0eT86IERlYnVnUHJvdG9jb2wuU3RlcHBpbmdHcmFudWxhcml0eSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMud2FpdEZvclRyaWdnZXJlZEJyZWFrcG9pbnRzKCk7XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ3N0ZXBPdXQnKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRMYXN0U3RlcHBpbmdHcmFudWxhcml0eSh0aHJlYWRJZCwgZ3JhbnVsYXJpdHkpO1xuXHRcdGF3YWl0IHRoaXMucmF3LnN0ZXBPdXQoeyB0aHJlYWRJZCwgZ3JhbnVsYXJpdHkgfSk7XG5cdH1cblxuXHRhc3luYyBzdGVwQmFjayh0aHJlYWRJZDogbnVtYmVyLCBncmFudWxhcml0eT86IERlYnVnUHJvdG9jb2wuU3RlcHBpbmdHcmFudWxhcml0eSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMud2FpdEZvclRyaWdnZXJlZEJyZWFrcG9pbnRzKCk7XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ3N0ZXBCYWNrJykpO1xuXHRcdH1cblxuXHRcdHRoaXMuc2V0TGFzdFN0ZXBwaW5nR3JhbnVsYXJpdHkodGhyZWFkSWQsIGdyYW51bGFyaXR5KTtcblx0XHRhd2FpdCB0aGlzLnJhdy5zdGVwQmFjayh7IHRocmVhZElkLCBncmFudWxhcml0eSB9KTtcblx0fVxuXG5cdGFzeW5jIGNvbnRpbnVlKHRocmVhZElkOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLndhaXRGb3JUcmlnZ2VyZWRCcmVha3BvaW50cygpO1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm9EZWJ1Z0FkYXB0ZXInLCBcIk5vIGRlYnVnZ2VyIGF2YWlsYWJsZSwgY2FuIG5vdCBzZW5kICd7MH0nXCIsICdjb250aW51ZScpKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLnJhdy5jb250aW51ZSh7IHRocmVhZElkIH0pO1xuXHR9XG5cblx0YXN5bmMgcmV2ZXJzZUNvbnRpbnVlKHRocmVhZElkOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLndhaXRGb3JUcmlnZ2VyZWRCcmVha3BvaW50cygpO1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm9EZWJ1Z0FkYXB0ZXInLCBcIk5vIGRlYnVnZ2VyIGF2YWlsYWJsZSwgY2FuIG5vdCBzZW5kICd7MH0nXCIsICdyZXZlcnNlIGNvbnRpbnVlJykpO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMucmF3LnJldmVyc2VDb250aW51ZSh7IHRocmVhZElkIH0pO1xuXHR9XG5cblx0YXN5bmMgcGF1c2UodGhyZWFkSWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm9EZWJ1Z0FkYXB0ZXInLCBcIk5vIGRlYnVnZ2VyIGF2YWlsYWJsZSwgY2FuIG5vdCBzZW5kICd7MH0nXCIsICdwYXVzZScpKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLnJhdy5wYXVzZSh7IHRocmVhZElkIH0pO1xuXHR9XG5cblx0YXN5bmMgdGVybWluYXRlVGhyZWFkcyh0aHJlYWRJZHM/OiBudW1iZXJbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm9EZWJ1Z0FkYXB0ZXInLCBcIk5vIGRlYnVnZ2VyIGF2YWlsYWJsZSwgY2FuIG5vdCBzZW5kICd7MH0nXCIsICd0ZXJtaW5hdGVUaHJlYWRzJykpO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMucmF3LnRlcm1pbmF0ZVRocmVhZHMoeyB0aHJlYWRJZHMgfSk7XG5cdH1cblxuXHRzZXRWYXJpYWJsZSh2YXJpYWJsZXNSZWZlcmVuY2U6IG51bWJlciwgbmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLlNldFZhcmlhYmxlUmVzcG9uc2UgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vRGVidWdBZGFwdGVyJywgXCJObyBkZWJ1Z2dlciBhdmFpbGFibGUsIGNhbiBub3Qgc2VuZCAnezB9J1wiLCAnc2V0VmFyaWFibGUnKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucmF3LnNldFZhcmlhYmxlKHsgdmFyaWFibGVzUmVmZXJlbmNlLCBuYW1lLCB2YWx1ZSB9KTtcblx0fVxuXG5cdHNldEV4cHJlc3Npb24oZnJhbWVJZDogbnVtYmVyLCBleHByZXNzaW9uOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuU2V0RXhwcmVzc2lvblJlc3BvbnNlIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ3NldEV4cHJlc3Npb24nKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucmF3LnNldEV4cHJlc3Npb24oeyBleHByZXNzaW9uLCB2YWx1ZSwgZnJhbWVJZCB9KTtcblx0fVxuXG5cdGdvdG9UYXJnZXRzKHNvdXJjZTogRGVidWdQcm90b2NvbC5Tb3VyY2UsIGxpbmU6IG51bWJlciwgY29sdW1uPzogbnVtYmVyKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLkdvdG9UYXJnZXRzUmVzcG9uc2UgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vRGVidWdBZGFwdGVyJywgXCJObyBkZWJ1Z2dlciBhdmFpbGFibGUsIGNhbiBub3Qgc2VuZCAnezB9J1wiLCAnZ290b1RhcmdldHMnKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucmF3LmdvdG9UYXJnZXRzKHsgc291cmNlLCBsaW5lLCBjb2x1bW4gfSk7XG5cdH1cblxuXHRnb3RvKHRocmVhZElkOiBudW1iZXIsIHRhcmdldElkOiBudW1iZXIpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuR290b1Jlc3BvbnNlIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ2dvdG8nKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucmF3LmdvdG8oeyB0aHJlYWRJZCwgdGFyZ2V0SWQgfSk7XG5cdH1cblxuXHRsb2FkU291cmNlKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuU291cmNlUmVzcG9uc2UgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ2xvYWRTb3VyY2UnKSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNvdXJjZSA9IHRoaXMuZ2V0U291cmNlRm9yVXJpKHJlc291cmNlKTtcblx0XHRsZXQgcmF3U291cmNlOiBEZWJ1Z1Byb3RvY29sLlNvdXJjZTtcblx0XHRpZiAoc291cmNlKSB7XG5cdFx0XHRyYXdTb3VyY2UgPSBzb3VyY2UucmF3O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBjcmVhdGUgYSBTb3VyY2Vcblx0XHRcdGNvbnN0IGRhdGEgPSBTb3VyY2UuZ2V0RW5jb2RlZERlYnVnRGF0YShyZXNvdXJjZSk7XG5cdFx0XHRyYXdTb3VyY2UgPSB7IHBhdGg6IGRhdGEucGF0aCwgc291cmNlUmVmZXJlbmNlOiBkYXRhLnNvdXJjZVJlZmVyZW5jZSB9O1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnJhdy5zb3VyY2UoeyBzb3VyY2VSZWZlcmVuY2U6IHJhd1NvdXJjZS5zb3VyY2VSZWZlcmVuY2UgfHwgMCwgc291cmNlOiByYXdTb3VyY2UgfSk7XG5cdH1cblxuXHRhc3luYyBnZXRMb2FkZWRTb3VyY2VzKCk6IFByb21pc2U8U291cmNlW10+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ2dldExvYWRlZFNvdXJjZXMnKSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5yYXcubG9hZGVkU291cmNlcyh7fSk7XG5cdFx0aWYgKHJlc3BvbnNlPy5ib2R5ICYmIHJlc3BvbnNlLmJvZHkuc291cmNlcykge1xuXHRcdFx0cmV0dXJuIHJlc3BvbnNlLmJvZHkuc291cmNlcy5tYXAoc3JjID0+IHRoaXMuZ2V0U291cmNlKHNyYykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgY29tcGxldGlvbnMoZnJhbWVJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCB0aHJlYWRJZDogbnVtYmVyLCB0ZXh0OiBzdHJpbmcsIHBvc2l0aW9uOiBQb3NpdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLkNvbXBsZXRpb25zUmVzcG9uc2UgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ2NvbXBsZXRpb25zJykpKTtcblx0XHR9XG5cdFx0Y29uc3Qgc2Vzc2lvbkNhbmNlbGF0aW9uVG9rZW4gPSB0aGlzLmdldE5ld0NhbmNlbGxhdGlvblRva2VuKHRocmVhZElkLCB0b2tlbik7XG5cblx0XHRyZXR1cm4gdGhpcy5yYXcuY29tcGxldGlvbnMoe1xuXHRcdFx0ZnJhbWVJZCxcblx0XHRcdHRleHQsXG5cdFx0XHRjb2x1bW46IHBvc2l0aW9uLmNvbHVtbixcblx0XHRcdGxpbmU6IHBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0fSwgc2Vzc2lvbkNhbmNlbGF0aW9uVG9rZW4pO1xuXHR9XG5cblx0YXN5bmMgc3RlcEluVGFyZ2V0cyhmcmFtZUlkOiBudW1iZXIpOiBQcm9taXNlPHsgaWQ6IG51bWJlcjsgbGFiZWw6IHN0cmluZyB9W10gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ3N0ZXBJblRhcmdldHMnKSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5yYXcuc3RlcEluVGFyZ2V0cyh7IGZyYW1lSWQgfSk7XG5cdFx0cmV0dXJuIHJlc3BvbnNlPy5ib2R5LnRhcmdldHM7XG5cdH1cblxuXHRhc3luYyBjYW5jZWwocHJvZ3Jlc3NJZDogc3RyaW5nKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLkNhbmNlbFJlc3BvbnNlIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihsb2NhbGl6ZSgnbm9EZWJ1Z0FkYXB0ZXInLCBcIk5vIGRlYnVnZ2VyIGF2YWlsYWJsZSwgY2FuIG5vdCBzZW5kICd7MH0nXCIsICdjYW5jZWwnKSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnJhdy5jYW5jZWwoeyBwcm9ncmVzc0lkIH0pO1xuXHR9XG5cblx0YXN5bmMgZGlzYXNzZW1ibGUobWVtb3J5UmVmZXJlbmNlOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyLCBpbnN0cnVjdGlvbk9mZnNldDogbnVtYmVyLCBpbnN0cnVjdGlvbkNvdW50OiBudW1iZXIpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25bXSB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IobG9jYWxpemUoJ25vRGVidWdBZGFwdGVyJywgXCJObyBkZWJ1Z2dlciBhdmFpbGFibGUsIGNhbiBub3Qgc2VuZCAnezB9J1wiLCAnZGlzYXNzZW1ibGUnKSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5yYXcuZGlzYXNzZW1ibGUoeyBtZW1vcnlSZWZlcmVuY2UsIG9mZnNldCwgaW5zdHJ1Y3Rpb25PZmZzZXQsIGluc3RydWN0aW9uQ291bnQsIHJlc29sdmVTeW1ib2xzOiB0cnVlIH0pO1xuXHRcdHJldHVybiByZXNwb25zZT8uYm9keT8uaW5zdHJ1Y3Rpb25zO1xuXHR9XG5cblx0cmVhZE1lbW9yeShtZW1vcnlSZWZlcmVuY2U6IHN0cmluZywgb2Zmc2V0OiBudW1iZXIsIGNvdW50OiBudW1iZXIpOiBQcm9taXNlPERlYnVnUHJvdG9jb2wuUmVhZE1lbW9yeVJlc3BvbnNlIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLnJhdykge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihsb2NhbGl6ZSgnbm9EZWJ1Z0FkYXB0ZXInLCBcIk5vIGRlYnVnZ2VyIGF2YWlsYWJsZSwgY2FuIG5vdCBzZW5kICd7MH0nXCIsICdyZWFkTWVtb3J5JykpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5yYXcucmVhZE1lbW9yeSh7IGNvdW50LCBtZW1vcnlSZWZlcmVuY2UsIG9mZnNldCB9KTtcblx0fVxuXG5cdHdyaXRlTWVtb3J5KG1lbW9yeVJlZmVyZW5jZTogc3RyaW5nLCBvZmZzZXQ6IG51bWJlciwgZGF0YTogc3RyaW5nLCBhbGxvd1BhcnRpYWw/OiBib29sZWFuKTogUHJvbWlzZTxEZWJ1Z1Byb3RvY29sLldyaXRlTWVtb3J5UmVzcG9uc2UgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKGxvY2FsaXplKCdub0RlYnVnQWRhcHRlcicsIFwiTm8gZGVidWdnZXIgYXZhaWxhYmxlLCBjYW4gbm90IHNlbmQgJ3swfSdcIiwgJ2Rpc2Fzc2VtYmxlJykpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5yYXcud3JpdGVNZW1vcnkoeyBtZW1vcnlSZWZlcmVuY2UsIG9mZnNldCwgYWxsb3dQYXJ0aWFsLCBkYXRhIH0pO1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZUxvY2F0aW9uUmVmZXJlbmNlKGxvY2F0aW9uUmVmZXJlbmNlOiBudW1iZXIpOiBQcm9taXNlPElEZWJ1Z0xvY2F0aW9uUmVmZXJlbmNlZD4ge1xuXHRcdGlmICghdGhpcy5yYXcpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm9EZWJ1Z0FkYXB0ZXInLCBcIk5vIGRlYnVnZ2VyIGF2YWlsYWJsZSwgY2FuIG5vdCBzZW5kICd7MH0nXCIsICdsb2NhdGlvbnMnKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbG9jYXRpb24gPSBhd2FpdCB0aGlzLnJhdy5sb2NhdGlvbnMoeyBsb2NhdGlvblJlZmVyZW5jZSB9KTtcblx0XHRpZiAoIWxvY2F0aW9uPy5ib2R5KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vRGVidWdBZGFwdGVyJywgXCJObyBkZWJ1Z2dlciBhdmFpbGFibGUsIGNhbiBub3Qgc2VuZCAnezB9J1wiLCAnbG9jYXRpb25zJykpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNvdXJjZSA9IHRoaXMuZ2V0U291cmNlKGxvY2F0aW9uLmJvZHkuc291cmNlKTtcblx0XHRyZXR1cm4geyBjb2x1bW46IDEsIC4uLmxvY2F0aW9uLmJvZHksIHNvdXJjZSB9O1xuXHR9XG5cblx0Ly8tLS0tIHRocmVhZHNcblxuXHRnZXRUaHJlYWQodGhyZWFkSWQ6IG51bWJlcik6IFRocmVhZCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMudGhyZWFkcy5nZXQodGhyZWFkSWQpO1xuXHR9XG5cblx0Z2V0QWxsVGhyZWFkcygpOiBJVGhyZWFkW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogSVRocmVhZFtdID0gW107XG5cdFx0dGhpcy50aHJlYWRJZHMuZm9yRWFjaCgodGhyZWFkSWQpID0+IHtcblx0XHRcdGNvbnN0IHRocmVhZCA9IHRoaXMudGhyZWFkcy5nZXQodGhyZWFkSWQpO1xuXHRcdFx0aWYgKHRocmVhZCkge1xuXHRcdFx0XHRyZXN1bHQucHVzaCh0aHJlYWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRjbGVhclRocmVhZHMocmVtb3ZlVGhyZWFkczogYm9vbGVhbiwgcmVmZXJlbmNlOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAocmVmZXJlbmNlICE9PSB1bmRlZmluZWQgJiYgcmVmZXJlbmNlICE9PSBudWxsKSB7XG5cdFx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnRocmVhZHMuZ2V0KHJlZmVyZW5jZSk7XG5cdFx0XHRpZiAodGhyZWFkKSB7XG5cdFx0XHRcdHRocmVhZC5jbGVhckNhbGxTdGFjaygpO1xuXHRcdFx0XHR0aHJlYWQuc3RvcHBlZERldGFpbHMgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRocmVhZC5zdG9wcGVkID0gZmFsc2U7XG5cblx0XHRcdFx0aWYgKHJlbW92ZVRocmVhZHMpIHtcblx0XHRcdFx0XHR0aGlzLnRocmVhZHMuZGVsZXRlKHJlZmVyZW5jZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy50aHJlYWRzLmZvckVhY2godGhyZWFkID0+IHtcblx0XHRcdFx0dGhyZWFkLmNsZWFyQ2FsbFN0YWNrKCk7XG5cdFx0XHRcdHRocmVhZC5zdG9wcGVkRGV0YWlscyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhyZWFkLnN0b3BwZWQgPSBmYWxzZTtcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAocmVtb3ZlVGhyZWFkcykge1xuXHRcdFx0XHR0aGlzLnRocmVhZHMuY2xlYXIoKTtcblx0XHRcdFx0dGhpcy50aHJlYWRJZHMgPSBbXTtcblx0XHRcdFx0RXhwcmVzc2lvbkNvbnRhaW5lci5hbGxWYWx1ZXMuY2xlYXIoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXRTdG9wcGVkRGV0YWlscygpOiBJUmF3U3RvcHBlZERldGFpbHMgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnN0b3BwZWREZXRhaWxzLmxlbmd0aCA+PSAxID8gdGhpcy5zdG9wcGVkRGV0YWlsc1swXSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdHJhd1VwZGF0ZShkYXRhOiBJUmF3TW9kZWxVcGRhdGUpOiB2b2lkIHtcblx0XHR0aGlzLnRocmVhZElkcyA9IFtdO1xuXHRcdGRhdGEudGhyZWFkcy5mb3JFYWNoKHRocmVhZCA9PiB7XG5cdFx0XHR0aGlzLnRocmVhZElkcy5wdXNoKHRocmVhZC5pZCk7XG5cdFx0XHRpZiAoIXRoaXMudGhyZWFkcy5oYXModGhyZWFkLmlkKSkge1xuXHRcdFx0XHQvLyBBIG5ldyB0aHJlYWQgY2FtZSBpbiwgaW5pdGlhbGl6ZSBpdC5cblx0XHRcdFx0dGhpcy50aHJlYWRzLnNldCh0aHJlYWQuaWQsIG5ldyBUaHJlYWQodGhpcywgdGhyZWFkLm5hbWUsIHRocmVhZC5pZCkpO1xuXHRcdFx0fSBlbHNlIGlmICh0aHJlYWQubmFtZSkge1xuXHRcdFx0XHQvLyBKdXN0IHRoZSB0aHJlYWQgbmFtZSBnb3QgdXBkYXRlZCAjMTgyNDRcblx0XHRcdFx0Y29uc3Qgb2xkVGhyZWFkID0gdGhpcy50aHJlYWRzLmdldCh0aHJlYWQuaWQpO1xuXHRcdFx0XHRpZiAob2xkVGhyZWFkKSB7XG5cdFx0XHRcdFx0b2xkVGhyZWFkLm5hbWUgPSB0aHJlYWQubmFtZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMudGhyZWFkcy5mb3JFYWNoKHQgPT4ge1xuXHRcdFx0Ly8gUmVtb3ZlIGFsbCBvbGQgdGhyZWFkcyB3aGljaCBhcmUgbm8gbG9uZ2VyIHBhcnQgb2YgdGhlIHVwZGF0ZSAjNzU5ODBcblx0XHRcdGlmICh0aGlzLnRocmVhZElkcy5pbmRleE9mKHQudGhyZWFkSWQpID09PSAtMSkge1xuXHRcdFx0XHR0aGlzLnRocmVhZHMuZGVsZXRlKHQudGhyZWFkSWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgc3RvcHBlZERldGFpbHMgPSBkYXRhLnN0b3BwZWREZXRhaWxzO1xuXHRcdGlmIChzdG9wcGVkRGV0YWlscykge1xuXHRcdFx0Ly8gU2V0IHRoZSBhdmFpbGFiaWxpdHkgb2YgdGhlIHRocmVhZHMnIGNhbGxzdGFja3MgZGVwZW5kaW5nIG9uXG5cdFx0XHQvLyB3aGV0aGVyIHRoZSB0aHJlYWQgaXMgc3RvcHBlZCBvciBub3Rcblx0XHRcdGlmIChzdG9wcGVkRGV0YWlscy5hbGxUaHJlYWRzU3RvcHBlZCkge1xuXHRcdFx0XHR0aGlzLnRocmVhZHMuZm9yRWFjaCh0aHJlYWQgPT4ge1xuXHRcdFx0XHRcdHRocmVhZC5zdG9wcGVkRGV0YWlscyA9IHRocmVhZC50aHJlYWRJZCA9PT0gc3RvcHBlZERldGFpbHMudGhyZWFkSWQgPyBzdG9wcGVkRGV0YWlscyA6IHsgcmVhc29uOiB0aHJlYWQuc3RvcHBlZERldGFpbHM/LnJlYXNvbiB9O1xuXHRcdFx0XHRcdHRocmVhZC5zdG9wcGVkID0gdHJ1ZTtcblx0XHRcdFx0XHR0aHJlYWQuY2xlYXJDYWxsU3RhY2soKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCB0aHJlYWQgPSB0eXBlb2Ygc3RvcHBlZERldGFpbHMudGhyZWFkSWQgPT09ICdudW1iZXInID8gdGhpcy50aHJlYWRzLmdldChzdG9wcGVkRGV0YWlscy50aHJlYWRJZCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICh0aHJlYWQpIHtcblx0XHRcdFx0XHQvLyBPbmUgdGhyZWFkIGlzIHN0b3BwZWQsIG9ubHkgdXBkYXRlIHRoYXQgdGhyZWFkLlxuXHRcdFx0XHRcdHRocmVhZC5zdG9wcGVkRGV0YWlscyA9IHN0b3BwZWREZXRhaWxzO1xuXHRcdFx0XHRcdHRocmVhZC5jbGVhckNhbGxTdGFjaygpO1xuXHRcdFx0XHRcdHRocmVhZC5zdG9wcGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgd2FpdEZvclRyaWdnZXJlZEJyZWFrcG9pbnRzKCkge1xuXHRcdGlmICghdGhpcy5fd2FpdFRvUmVzdW1lKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJhY2VUaW1lb3V0KFxuXHRcdFx0dGhpcy5fd2FpdFRvUmVzdW1lLFxuXHRcdFx0VFJJR0dFUkVEX0JSRUFLUE9JTlRfTUFYX0RFTEFZXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZmV0Y2hUaHJlYWRzKHN0b3BwZWREZXRhaWxzPzogSVJhd1N0b3BwZWREZXRhaWxzKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMucmF3KSB7XG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMucmF3LnRocmVhZHMoKTtcblx0XHRcdGlmIChyZXNwb25zZT8uYm9keSAmJiByZXNwb25zZS5ib2R5LnRocmVhZHMpIHtcblx0XHRcdFx0dGhpcy5tb2RlbC5yYXdVcGRhdGUoe1xuXHRcdFx0XHRcdHNlc3Npb25JZDogdGhpcy5nZXRJZCgpLFxuXHRcdFx0XHRcdHRocmVhZHM6IHJlc3BvbnNlLmJvZHkudGhyZWFkcyxcblx0XHRcdFx0XHRzdG9wcGVkRGV0YWlsc1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpbml0aWFsaXplRm9yVGVzdChyYXc6IFJhd0RlYnVnU2Vzc2lvbik6IHZvaWQge1xuXHRcdHRoaXMucmF3ID0gcmF3O1xuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdC8vLS0tLSBwcml2YXRlXG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMucmF3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5yYXdMaXN0ZW5lcnMuYWRkKHRoaXMucmF3Lm9uRGlkSW5pdGlhbGl6ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRhcmlhLnN0YXR1cyhcblx0XHRcdFx0dGhpcy5jb25maWd1cmF0aW9uLm5vRGVidWdcblx0XHRcdFx0XHQ/IGxvY2FsaXplKCdkZWJ1Z2dpbmdTdGFydGVkTm9EZWJ1ZycsIFwiU3RhcnRlZCBydW5uaW5nIHdpdGhvdXQgZGVidWdnaW5nLlwiKVxuXHRcdFx0XHRcdDogbG9jYWxpemUoJ2RlYnVnZ2luZ1N0YXJ0ZWQnLCBcIkRlYnVnZ2luZyBzdGFydGVkLlwiKVxuXHRcdFx0KTtcblxuXHRcdFx0Y29uc3Qgc2VuZENvbmZpZ3VyYXRpb25Eb25lID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5yYXcgJiYgdGhpcy5yYXcuY2FwYWJpbGl0aWVzLnN1cHBvcnRzQ29uZmlndXJhdGlvbkRvbmVSZXF1ZXN0KSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucmF3LmNvbmZpZ3VyYXRpb25Eb25lKCk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0Ly8gRGlzY29ubmVjdCB0aGUgZGVidWcgc2Vzc2lvbiBvbiBjb25maWd1cmF0aW9uIGRvbmUgZXJyb3IgIzEwNTk2XG5cdFx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IoZSk7XG5cdFx0XHRcdFx0XHR0aGlzLnJhdz8uZGlzY29ubmVjdCh7fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH07XG5cblx0XHRcdC8vIFNlbmQgYWxsIGJyZWFrcG9pbnRzXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmRlYnVnU2VydmljZS5zZW5kQWxsQnJlYWtwb2ludHModGhpcyk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRhd2FpdCBzZW5kQ29uZmlndXJhdGlvbkRvbmUoKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5mZXRjaFRocmVhZHMoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblxuXHRcdGNvbnN0IHN0YXR1c1F1ZXVlID0gdGhpcy5zdGF0dXNRdWV1ZTtcblx0XHR0aGlzLnJhd0xpc3RlbmVycy5hZGQodGhpcy5yYXcub25EaWRTdG9wKGV2ZW50ID0+IHRoaXMuaGFuZGxlU3RvcChldmVudC5ib2R5KSkpO1xuXG5cdFx0dGhpcy5yYXdMaXN0ZW5lcnMuYWRkKHRoaXMucmF3Lm9uRGlkVGhyZWFkKGV2ZW50ID0+IHtcblx0XHRcdHN0YXR1c1F1ZXVlLmNhbmNlbChbZXZlbnQuYm9keS50aHJlYWRJZF0pO1xuXHRcdFx0aWYgKGV2ZW50LmJvZHkucmVhc29uID09PSAnc3RhcnRlZCcpIHtcblx0XHRcdFx0Ly8gZGVib3VuY2UgdG8gcmVkdWNlIHRocmVhZHNSZXF1ZXN0IGZyZXF1ZW5jeSBhbmQgaW1wcm92ZSBwZXJmb3JtYW5jZVxuXHRcdFx0XHRpZiAoIXRoaXMuZmV0Y2hUaHJlYWRzU2NoZWR1bGVyKSB7XG5cdFx0XHRcdFx0dGhpcy5mZXRjaFRocmVhZHNTY2hlZHVsZXIgPSBuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLmZldGNoVGhyZWFkcygpO1xuXHRcdFx0XHRcdH0sIDEwMCk7XG5cdFx0XHRcdFx0dGhpcy5yYXdMaXN0ZW5lcnMuYWRkKHRoaXMuZmV0Y2hUaHJlYWRzU2NoZWR1bGVyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXRoaXMuZmV0Y2hUaHJlYWRzU2NoZWR1bGVyLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdFx0XHR0aGlzLmZldGNoVGhyZWFkc1NjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGV2ZW50LmJvZHkucmVhc29uID09PSAnZXhpdGVkJykge1xuXHRcdFx0XHR0aGlzLm1vZGVsLmNsZWFyVGhyZWFkcyh0aGlzLmdldElkKCksIHRydWUsIGV2ZW50LmJvZHkudGhyZWFkSWQpO1xuXHRcdFx0XHRjb25zdCB2aWV3TW9kZWwgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKTtcblx0XHRcdFx0Y29uc3QgZm9jdXNlZFRocmVhZCA9IHZpZXdNb2RlbC5mb2N1c2VkVGhyZWFkO1xuXHRcdFx0XHR0aGlzLnBhc3NGb2N1c1NjaGVkdWxlci5jYW5jZWwoKTtcblx0XHRcdFx0aWYgKGZvY3VzZWRUaHJlYWQgJiYgZXZlbnQuYm9keS50aHJlYWRJZCA9PT0gZm9jdXNlZFRocmVhZC50aHJlYWRJZCkge1xuXHRcdFx0XHRcdC8vIERlLWZvY3VzIHRoZSB0aHJlYWQgaW4gY2FzZSBpdCB3YXMgZm9jdXNlZFxuXHRcdFx0XHRcdHRoaXMuZGVidWdTZXJ2aWNlLmZvY3VzU3RhY2tGcmFtZSh1bmRlZmluZWQsIHVuZGVmaW5lZCwgdmlld01vZGVsLmZvY3VzZWRTZXNzaW9uLCB7IGV4cGxpY2l0OiBmYWxzZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMucmF3TGlzdGVuZXJzLmFkZCh0aGlzLnJhdy5vbkRpZFRlcm1pbmF0ZURlYnVnZWUoYXN5bmMgZXZlbnQgPT4ge1xuXHRcdFx0YXJpYS5zdGF0dXMobG9jYWxpemUoJ2RlYnVnZ2luZ1N0b3BwZWQnLCBcIkRlYnVnZ2luZyBzdG9wcGVkLlwiKSk7XG5cdFx0XHRpZiAoZXZlbnQuYm9keSAmJiBldmVudC5ib2R5LnJlc3RhcnQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5kZWJ1Z1NlcnZpY2UucmVzdGFydFNlc3Npb24odGhpcywgZXZlbnQuYm9keS5yZXN0YXJ0KTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5yYXcpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5yYXcuZGlzY29ubmVjdCh7IHRlcm1pbmF0ZURlYnVnZ2VlOiBmYWxzZSB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLnJhd0xpc3RlbmVycy5hZGQodGhpcy5yYXcub25EaWRDb250aW51ZWQoZXZlbnQgPT4ge1xuXHRcdFx0Y29uc3QgYWxsVGhyZWFkcyA9IGV2ZW50LmJvZHkuYWxsVGhyZWFkc0NvbnRpbnVlZCAhPT0gZmFsc2U7XG5cblx0XHRcdHN0YXR1c1F1ZXVlLmNhbmNlbChhbGxUaHJlYWRzID8gdW5kZWZpbmVkIDogW2V2ZW50LmJvZHkudGhyZWFkSWRdKTtcblxuXHRcdFx0Y29uc3QgdGhyZWFkSWQgPSBhbGxUaHJlYWRzID8gdW5kZWZpbmVkIDogZXZlbnQuYm9keS50aHJlYWRJZDtcblx0XHRcdGlmICh0eXBlb2YgdGhyZWFkSWQgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdHRoaXMuc3RvcHBlZERldGFpbHMgPSB0aGlzLnN0b3BwZWREZXRhaWxzLmZpbHRlcihzZCA9PiBzZC50aHJlYWRJZCAhPT0gdGhyZWFkSWQpO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSB0aGlzLmNhbmNlbGxhdGlvbk1hcC5nZXQodGhyZWFkSWQpO1xuXHRcdFx0XHR0aGlzLmNhbmNlbGxhdGlvbk1hcC5kZWxldGUodGhyZWFkSWQpO1xuXHRcdFx0XHR0b2tlbnM/LmZvckVhY2godCA9PiB0LmRpc3Bvc2UodHJ1ZSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5zdG9wcGVkRGV0YWlscyA9IFtdO1xuXHRcdFx0XHR0aGlzLmNhbmNlbEFsbFJlcXVlc3RzKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmxhc3RDb250aW51ZWRUaHJlYWRJZCA9IHRocmVhZElkO1xuXHRcdFx0Ly8gV2UgbmVlZCB0byBwYXNzIGZvY3VzIHRvIG90aGVyIHNlc3Npb25zIC8gdGhyZWFkcyB3aXRoIGEgdGltZW91dCBpbiBjYXNlIGEgcXVpY2sgc3RvcCBldmVudCBvY2N1cnMgIzEzMDMyMVxuXHRcdFx0dGhpcy5wYXNzRm9jdXNTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdHRoaXMubW9kZWwuY2xlYXJUaHJlYWRzKHRoaXMuZ2V0SWQoKSwgZmFsc2UsIHRocmVhZElkKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSgpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG91dHB1dFF1ZXVlID0gbmV3IFF1ZXVlPHZvaWQ+KCk7XG5cdFx0dGhpcy5yYXdMaXN0ZW5lcnMuYWRkKHRoaXMucmF3Lm9uRGlkT3V0cHV0KGFzeW5jIGV2ZW50ID0+IHtcblx0XHRcdGNvbnN0IG91dHB1dFNldmVyaXR5ID0gZXZlbnQuYm9keS5jYXRlZ29yeSA9PT0gJ3N0ZGVycicgPyBTZXZlcml0eS5FcnJvciA6IGV2ZW50LmJvZHkuY2F0ZWdvcnkgPT09ICdjb25zb2xlJyA/IFNldmVyaXR5Lldhcm5pbmcgOiBTZXZlcml0eS5JbmZvO1xuXG5cdFx0XHQvLyBXaGVuIGEgdmFyaWFibGVzIGV2ZW50IGlzIHJlY2VpdmVkLCBleGVjdXRlIGltbWVkaWF0ZWx5IHRvIG9idGFpbiB0aGUgdmFyaWFibGVzIHZhbHVlICMxMjY5Njdcblx0XHRcdGlmIChldmVudC5ib2R5LnZhcmlhYmxlc1JlZmVyZW5jZSkge1xuXHRcdFx0XHRjb25zdCBzb3VyY2UgPSBldmVudC5ib2R5LnNvdXJjZSAmJiBldmVudC5ib2R5LmxpbmUgPyB7XG5cdFx0XHRcdFx0bGluZU51bWJlcjogZXZlbnQuYm9keS5saW5lLFxuXHRcdFx0XHRcdGNvbHVtbjogZXZlbnQuYm9keS5jb2x1bW4gPyBldmVudC5ib2R5LmNvbHVtbiA6IDEsXG5cdFx0XHRcdFx0c291cmNlOiB0aGlzLmdldFNvdXJjZShldmVudC5ib2R5LnNvdXJjZSlcblx0XHRcdFx0fSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0Y29uc3QgY29udGFpbmVyID0gbmV3IEV4cHJlc3Npb25Db250YWluZXIodGhpcywgdW5kZWZpbmVkLCBldmVudC5ib2R5LnZhcmlhYmxlc1JlZmVyZW5jZSwgZ2VuZXJhdGVVdWlkKCkpO1xuXHRcdFx0XHRjb25zdCBjaGlsZHJlbiA9IGNvbnRhaW5lci5nZXRDaGlsZHJlbigpO1xuXHRcdFx0XHQvLyB3ZSBzaG91bGQgcHV0IGFwcGVuZFRvUmVwbCBpbnRvIHF1ZXVlIHRvIG1ha2Ugc3VyZSB0aGUgbG9ncyB0byBiZSBkaXNwbGF5ZWQgaW4gY29ycmVjdCBvcmRlclxuXHRcdFx0XHQvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEyNjk2NyNpc3N1ZWNvbW1lbnQtODc0OTU0MjY5XG5cdFx0XHRcdG91dHB1dFF1ZXVlLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCByZXNvbHZlZCA9IGF3YWl0IGNoaWxkcmVuO1xuXHRcdFx0XHRcdC8vIEZvciBzaW5nbGUgbG9nZ2VkIHZhcmlhYmxlcywgdHJ5IHRvIHVzZSB0aGUgb3V0cHV0IGlmIHdlIGNhbiBzb1xuXHRcdFx0XHRcdC8vIHByZXNlbnQgYSBiZXR0ZXIgKGkuZS4gQU5TSS1hd2FyZSkgcmVwcmVzZW50YXRpb24gb2YgdGhlIG91dHB1dFxuXHRcdFx0XHRcdGlmIChyZXNvbHZlZC5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHRcdHRoaXMuYXBwZW5kVG9SZXBsKHsgb3V0cHV0OiBldmVudC5ib2R5Lm91dHB1dCwgZXhwcmVzc2lvbjogcmVzb2x2ZWRbMF0sIHNldjogb3V0cHV0U2V2ZXJpdHksIHNvdXJjZSB9LCBldmVudC5ib2R5LmNhdGVnb3J5ID09PSAnaW1wb3J0YW50Jyk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmVzb2x2ZWQuZm9yRWFjaCgoY2hpbGQpID0+IHtcblx0XHRcdFx0XHRcdC8vIFNpbmNlIHdlIGNhbiBub3QgZGlzcGxheSBtdWx0aXBsZSB0cmVlcyBpbiBhIHJvdywgd2UgYXJlIGRpc3BsYXlpbmcgdGhlc2UgdmFyaWFibGVzIG9uZSBhZnRlciB0aGUgb3RoZXIgKGlnbm9yaW5nIHRoZWlyIG5hbWVzKVxuXHRcdFx0XHRcdFx0KDxhbnk+Y2hpbGQpLm5hbWUgPSBudWxsO1xuXHRcdFx0XHRcdFx0dGhpcy5hcHBlbmRUb1JlcGwoeyBvdXRwdXQ6ICcnLCBleHByZXNzaW9uOiBjaGlsZCwgc2V2OiBvdXRwdXRTZXZlcml0eSwgc291cmNlIH0sIGV2ZW50LmJvZHkuY2F0ZWdvcnkgPT09ICdpbXBvcnRhbnQnKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG91dHB1dFF1ZXVlLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdFx0aWYgKCFldmVudC5ib2R5IHx8ICF0aGlzLnJhdykge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChldmVudC5ib2R5LmNhdGVnb3J5ID09PSAndGVsZW1ldHJ5Jykge1xuXHRcdFx0XHRcdC8vIG9ubHkgbG9nIHRlbGVtZXRyeSBldmVudHMgZnJvbSBkZWJ1ZyBhZGFwdGVyIGlmIHRoZSBkZWJ1ZyBleHRlbnNpb24gcHJvdmlkZWQgdGhlIHRlbGVtZXRyeSBrZXlcblx0XHRcdFx0XHQvLyBhbmQgdGhlIHVzZXIgb3B0ZWQgaW4gdGVsZW1ldHJ5XG5cdFx0XHRcdFx0Y29uc3QgdGVsZW1ldHJ5RW5kcG9pbnQgPSB0aGlzLnJhdy5kYmdyLmdldEN1c3RvbVRlbGVtZXRyeUVuZHBvaW50KCk7XG5cdFx0XHRcdFx0aWYgKHRlbGVtZXRyeUVuZHBvaW50ICYmIHRoaXMudGVsZW1ldHJ5U2VydmljZS50ZWxlbWV0cnlMZXZlbCAhPT0gVGVsZW1ldHJ5TGV2ZWwuTk9ORSkge1xuXHRcdFx0XHRcdFx0Ly8gX19HRFBSX19UT0RPX18gV2UncmUgc2VuZGluZyBldmVudHMgaW4gdGhlIG5hbWUgb2YgdGhlIGRlYnVnIGV4dGVuc2lvbiBhbmQgd2UgY2FuIG5vdCBlbnN1cmUgdGhhdCB0aG9zZSBhcmUgZGVjbGFyZWQgY29ycmVjdGx5LlxuXHRcdFx0XHRcdFx0bGV0IGRhdGEgPSBldmVudC5ib2R5LmRhdGE7XG5cdFx0XHRcdFx0XHRpZiAoIXRlbGVtZXRyeUVuZHBvaW50LnNlbmRFcnJvclRlbGVtZXRyeSAmJiBldmVudC5ib2R5LmRhdGEpIHtcblx0XHRcdFx0XHRcdFx0ZGF0YSA9IGZpbHRlckV4Y2VwdGlvbnNGcm9tVGVsZW1ldHJ5KGV2ZW50LmJvZHkuZGF0YSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHRoaXMuY3VzdG9tRW5kcG9pbnRUZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZyh0ZWxlbWV0cnlFbmRwb2ludCwgZXZlbnQuYm9keS5vdXRwdXQsIGRhdGEpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIE1ha2Ugc3VyZSB0byBhcHBlbmQgb3V0cHV0IGluIHRoZSBjb3JyZWN0IG9yZGVyIGJ5IHByb3Blcmx5IHdhaXRpbmcgb24gcHJlaXZvdXMgcHJvbWlzZXMgIzMzODIyXG5cdFx0XHRcdGNvbnN0IHNvdXJjZSA9IGV2ZW50LmJvZHkuc291cmNlICYmIGV2ZW50LmJvZHkubGluZSA/IHtcblx0XHRcdFx0XHRsaW5lTnVtYmVyOiBldmVudC5ib2R5LmxpbmUsXG5cdFx0XHRcdFx0Y29sdW1uOiBldmVudC5ib2R5LmNvbHVtbiA/IGV2ZW50LmJvZHkuY29sdW1uIDogMSxcblx0XHRcdFx0XHRzb3VyY2U6IHRoaXMuZ2V0U291cmNlKGV2ZW50LmJvZHkuc291cmNlKVxuXHRcdFx0XHR9IDogdW5kZWZpbmVkO1xuXG5cdFx0XHRcdGlmIChldmVudC5ib2R5Lmdyb3VwID09PSAnc3RhcnQnIHx8IGV2ZW50LmJvZHkuZ3JvdXAgPT09ICdzdGFydENvbGxhcHNlZCcpIHtcblx0XHRcdFx0XHRjb25zdCBleHBhbmRlZCA9IGV2ZW50LmJvZHkuZ3JvdXAgPT09ICdzdGFydCc7XG5cdFx0XHRcdFx0dGhpcy5yZXBsLnN0YXJ0R3JvdXAodGhpcywgZXZlbnQuYm9keS5vdXRwdXQgfHwgJycsIGV4cGFuZGVkLCBzb3VyY2UpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZXZlbnQuYm9keS5ncm91cCA9PT0gJ2VuZCcpIHtcblx0XHRcdFx0XHR0aGlzLnJlcGwuZW5kR3JvdXAoKTtcblx0XHRcdFx0XHRpZiAoIWV2ZW50LmJvZHkub3V0cHV0KSB7XG5cdFx0XHRcdFx0XHQvLyBPbmx5IHJldHVybiBpZiB0aGUgZW5kIGV2ZW50IGRvZXMgbm90IGhhdmUgYWRkaXRpb25hbCBvdXRwdXQgaW4gaXRcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodHlwZW9mIGV2ZW50LmJvZHkub3V0cHV0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdHRoaXMuYXBwZW5kVG9SZXBsKHsgb3V0cHV0OiBldmVudC5ib2R5Lm91dHB1dCwgc2V2OiBvdXRwdXRTZXZlcml0eSwgc291cmNlIH0sIGV2ZW50LmJvZHkuY2F0ZWdvcnkgPT09ICdpbXBvcnRhbnQnKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5yYXdMaXN0ZW5lcnMuYWRkKHRoaXMucmF3Lm9uRGlkQnJlYWtwb2ludChldmVudCA9PiB7XG5cdFx0XHRjb25zdCBpZCA9IGV2ZW50LmJvZHkgJiYgZXZlbnQuYm9keS5icmVha3BvaW50ID8gZXZlbnQuYm9keS5icmVha3BvaW50LmlkIDogdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgYnJlYWtwb2ludCA9IHRoaXMubW9kZWwuZ2V0QnJlYWtwb2ludHMoKS5maW5kKGJwID0+IGJwLmdldElkRnJvbUFkYXB0ZXIodGhpcy5nZXRJZCgpKSA9PT0gaWQpO1xuXHRcdFx0Y29uc3QgZnVuY3Rpb25CcmVha3BvaW50ID0gdGhpcy5tb2RlbC5nZXRGdW5jdGlvbkJyZWFrcG9pbnRzKCkuZmluZChicCA9PiBicC5nZXRJZEZyb21BZGFwdGVyKHRoaXMuZ2V0SWQoKSkgPT09IGlkKTtcblx0XHRcdGNvbnN0IGRhdGFCcmVha3BvaW50ID0gdGhpcy5tb2RlbC5nZXREYXRhQnJlYWtwb2ludHMoKS5maW5kKGRicCA9PiBkYnAuZ2V0SWRGcm9tQWRhcHRlcih0aGlzLmdldElkKCkpID09PSBpZCk7XG5cdFx0XHRjb25zdCBleGNlcHRpb25CcmVha3BvaW50ID0gdGhpcy5tb2RlbC5nZXRFeGNlcHRpb25CcmVha3BvaW50cygpLmZpbmQoZXhjYnAgPT4gZXhjYnAuZ2V0SWRGcm9tQWRhcHRlcih0aGlzLmdldElkKCkpID09PSBpZCk7XG5cblx0XHRcdGlmIChldmVudC5ib2R5LnJlYXNvbiA9PT0gJ25ldycgJiYgZXZlbnQuYm9keS5icmVha3BvaW50LnNvdXJjZSAmJiBldmVudC5ib2R5LmJyZWFrcG9pbnQubGluZSkge1xuXHRcdFx0XHRjb25zdCBzb3VyY2UgPSB0aGlzLmdldFNvdXJjZShldmVudC5ib2R5LmJyZWFrcG9pbnQuc291cmNlKTtcblx0XHRcdFx0Y29uc3QgYnBzID0gdGhpcy5tb2RlbC5hZGRCcmVha3BvaW50cyhzb3VyY2UudXJpLCBbe1xuXHRcdFx0XHRcdGNvbHVtbjogZXZlbnQuYm9keS5icmVha3BvaW50LmNvbHVtbixcblx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdGxpbmVOdW1iZXI6IGV2ZW50LmJvZHkuYnJlYWtwb2ludC5saW5lLFxuXHRcdFx0XHR9XSwgZmFsc2UpO1xuXHRcdFx0XHRpZiAoYnBzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdGNvbnN0IGRhdGEgPSBuZXcgTWFwPHN0cmluZywgRGVidWdQcm90b2NvbC5CcmVha3BvaW50PihbW2Jwc1swXS5nZXRJZCgpLCBldmVudC5ib2R5LmJyZWFrcG9pbnRdXSk7XG5cdFx0XHRcdFx0dGhpcy5tb2RlbC5zZXRCcmVha3BvaW50U2Vzc2lvbkRhdGEodGhpcy5nZXRJZCgpLCB0aGlzLmNhcGFiaWxpdGllcywgZGF0YSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGV2ZW50LmJvZHkucmVhc29uID09PSAncmVtb3ZlZCcpIHtcblx0XHRcdFx0aWYgKGJyZWFrcG9pbnQpIHtcblx0XHRcdFx0XHR0aGlzLm1vZGVsLnJlbW92ZUJyZWFrcG9pbnRzKFticmVha3BvaW50XSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGZ1bmN0aW9uQnJlYWtwb2ludCkge1xuXHRcdFx0XHRcdHRoaXMubW9kZWwucmVtb3ZlRnVuY3Rpb25CcmVha3BvaW50cyhmdW5jdGlvbkJyZWFrcG9pbnQuZ2V0SWQoKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGRhdGFCcmVha3BvaW50KSB7XG5cdFx0XHRcdFx0dGhpcy5tb2RlbC5yZW1vdmVEYXRhQnJlYWtwb2ludHMoZGF0YUJyZWFrcG9pbnQuZ2V0SWQoKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGV2ZW50LmJvZHkucmVhc29uID09PSAnY2hhbmdlZCcpIHtcblx0XHRcdFx0aWYgKGJyZWFrcG9pbnQpIHtcblx0XHRcdFx0XHRpZiAoIWJyZWFrcG9pbnQuY29sdW1uKSB7XG5cdFx0XHRcdFx0XHRldmVudC5ib2R5LmJyZWFrcG9pbnQuY29sdW1uID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBkYXRhID0gbmV3IE1hcDxzdHJpbmcsIERlYnVnUHJvdG9jb2wuQnJlYWtwb2ludD4oW1ticmVha3BvaW50LmdldElkKCksIGV2ZW50LmJvZHkuYnJlYWtwb2ludF1dKTtcblx0XHRcdFx0XHR0aGlzLm1vZGVsLnNldEJyZWFrcG9pbnRTZXNzaW9uRGF0YSh0aGlzLmdldElkKCksIHRoaXMuY2FwYWJpbGl0aWVzLCBkYXRhKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZnVuY3Rpb25CcmVha3BvaW50KSB7XG5cdFx0XHRcdFx0Y29uc3QgZGF0YSA9IG5ldyBNYXA8c3RyaW5nLCBEZWJ1Z1Byb3RvY29sLkJyZWFrcG9pbnQ+KFtbZnVuY3Rpb25CcmVha3BvaW50LmdldElkKCksIGV2ZW50LmJvZHkuYnJlYWtwb2ludF1dKTtcblx0XHRcdFx0XHR0aGlzLm1vZGVsLnNldEJyZWFrcG9pbnRTZXNzaW9uRGF0YSh0aGlzLmdldElkKCksIHRoaXMuY2FwYWJpbGl0aWVzLCBkYXRhKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZGF0YUJyZWFrcG9pbnQpIHtcblx0XHRcdFx0XHRjb25zdCBkYXRhID0gbmV3IE1hcDxzdHJpbmcsIERlYnVnUHJvdG9jb2wuQnJlYWtwb2ludD4oW1tkYXRhQnJlYWtwb2ludC5nZXRJZCgpLCBldmVudC5ib2R5LmJyZWFrcG9pbnRdXSk7XG5cdFx0XHRcdFx0dGhpcy5tb2RlbC5zZXRCcmVha3BvaW50U2Vzc2lvbkRhdGEodGhpcy5nZXRJZCgpLCB0aGlzLmNhcGFiaWxpdGllcywgZGF0YSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGV4Y2VwdGlvbkJyZWFrcG9pbnQpIHtcblx0XHRcdFx0XHRjb25zdCBkYXRhID0gbmV3IE1hcDxzdHJpbmcsIERlYnVnUHJvdG9jb2wuQnJlYWtwb2ludD4oW1tleGNlcHRpb25CcmVha3BvaW50LmdldElkKCksIGV2ZW50LmJvZHkuYnJlYWtwb2ludF1dKTtcblx0XHRcdFx0XHR0aGlzLm1vZGVsLnNldEJyZWFrcG9pbnRTZXNzaW9uRGF0YSh0aGlzLmdldElkKCksIHRoaXMuY2FwYWJpbGl0aWVzLCBkYXRhKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMucmF3TGlzdGVuZXJzLmFkZCh0aGlzLnJhdy5vbkRpZExvYWRlZFNvdXJjZShldmVudCA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZExvYWRlZFNvdXJjZS5maXJlKHtcblx0XHRcdFx0cmVhc29uOiBldmVudC5ib2R5LnJlYXNvbixcblx0XHRcdFx0c291cmNlOiB0aGlzLmdldFNvdXJjZShldmVudC5ib2R5LnNvdXJjZSlcblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMucmF3TGlzdGVuZXJzLmFkZCh0aGlzLnJhdy5vbkRpZEN1c3RvbUV2ZW50KGV2ZW50ID0+IHtcblx0XHRcdHRoaXMuX29uRGlkQ3VzdG9tRXZlbnQuZmlyZShldmVudCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5yYXdMaXN0ZW5lcnMuYWRkKHRoaXMucmF3Lm9uRGlkUHJvZ3Jlc3NTdGFydChldmVudCA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZFByb2dyZXNzU3RhcnQuZmlyZShldmVudCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMucmF3TGlzdGVuZXJzLmFkZCh0aGlzLnJhdy5vbkRpZFByb2dyZXNzVXBkYXRlKGV2ZW50ID0+IHtcblx0XHRcdHRoaXMuX29uRGlkUHJvZ3Jlc3NVcGRhdGUuZmlyZShldmVudCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMucmF3TGlzdGVuZXJzLmFkZCh0aGlzLnJhdy5vbkRpZFByb2dyZXNzRW5kKGV2ZW50ID0+IHtcblx0XHRcdHRoaXMuX29uRGlkUHJvZ3Jlc3NFbmQuZmlyZShldmVudCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMucmF3TGlzdGVuZXJzLmFkZCh0aGlzLnJhdy5vbkRpZEludmFsaWRhdGVNZW1vcnkoZXZlbnQgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRJbnZhbGlkTWVtb3J5LmZpcmUoZXZlbnQpO1xuXHRcdH0pKTtcblx0XHR0aGlzLnJhd0xpc3RlbmVycy5hZGQodGhpcy5yYXcub25EaWRJbnZhbGlkYXRlZChhc3luYyBldmVudCA9PiB7XG5cdFx0XHRjb25zdCBhcmVhcyA9IGV2ZW50LmJvZHkuYXJlYXMgfHwgWydhbGwnXTtcblx0XHRcdC8vIElmIGludmFsaWRhdGVkIGV2ZW50IG9ubHkgcmVxdWlyZXMgdG8gdXBkYXRlIHZhcmlhYmxlcyBvciB3YXRjaCwgZG8gdGhhdCwgb3RoZXJ3aXNlIHJlZmV0Y2ggdGhyZWFkcyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTA2NzQ1XG5cdFx0XHRpZiAoYXJlYXMuaW5jbHVkZXMoJ3RocmVhZHMnKSB8fCBhcmVhcy5pbmNsdWRlcygnc3RhY2tzJykgfHwgYXJlYXMuaW5jbHVkZXMoJ2FsbCcpKSB7XG5cdFx0XHRcdHRoaXMuY2FuY2VsQWxsUmVxdWVzdHMoKTtcblx0XHRcdFx0dGhpcy5tb2RlbC5jbGVhclRocmVhZHModGhpcy5nZXRJZCgpLCB0cnVlKTtcblxuXHRcdFx0XHRjb25zdCBkZXRhaWxzID0gdGhpcy5zdG9wcGVkRGV0YWlscztcblx0XHRcdFx0dGhpcy5zdG9wcGVkRGV0YWlscy5sZW5ndGggPSAxO1xuXHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChkZXRhaWxzLm1hcChkID0+IHRoaXMuaGFuZGxlU3RvcChkKSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB2aWV3TW9kZWwgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKTtcblx0XHRcdGlmICh2aWV3TW9kZWwuZm9jdXNlZFNlc3Npb24gPT09IHRoaXMpIHtcblx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZVZpZXdzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5yYXdMaXN0ZW5lcnMuYWRkKHRoaXMucmF3Lm9uRGlkRXhpdEFkYXB0ZXIoZXZlbnQgPT4gdGhpcy5vbkRpZEV4aXRBZGFwdGVyKGV2ZW50KSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVTdG9wKGV2ZW50OiBJUmF3U3RvcHBlZERldGFpbHMpIHtcblx0XHR0aGlzLnBhc3NGb2N1c1NjaGVkdWxlci5jYW5jZWwoKTtcblx0XHR0aGlzLnN0b3BwZWREZXRhaWxzLnB1c2goZXZlbnQpO1xuXG5cdFx0Ly8gZG8gdGhpcyB2ZXJ5IGVhZ2VybHkgaWYgd2UgaGF2ZSBoaXRCcmVha3BvaW50SWRzLCBzaW5jZSBpdCBtYXkgdGFrZSBhXG5cdFx0Ly8gbW9tZW50IGZvciBicmVha3BvaW50cyB0byBzZXQgYW5kIHdlIHdhbnQgdG8gZG8gb3VyIGJlc3QgdG8gbm90IG1pc3Ncblx0XHQvLyBhbnl0aGluZ1xuXHRcdGlmIChldmVudC5oaXRCcmVha3BvaW50SWRzKSB7XG5cdFx0XHR0aGlzLl93YWl0VG9SZXN1bWUgPSB0aGlzLmVuYWJsZURlcGVuZGVudEJyZWFrcG9pbnRzKGV2ZW50LmhpdEJyZWFrcG9pbnRJZHMpO1xuXHRcdH1cblxuXHRcdHRoaXMuc3RhdHVzUXVldWUucnVuKFxuXHRcdFx0dGhpcy5mZXRjaFRocmVhZHMoZXZlbnQpLnRoZW4oKCkgPT4gZXZlbnQudGhyZWFkSWQgPT09IHVuZGVmaW5lZCA/IHRoaXMudGhyZWFkSWRzIDogW2V2ZW50LnRocmVhZElkXSksXG5cdFx0XHRhc3luYyAodGhyZWFkSWQsIHRva2VuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGhhc0xvdHNPZlRocmVhZHMgPSBldmVudC50aHJlYWRJZCA9PT0gdW5kZWZpbmVkICYmIHRoaXMudGhyZWFkSWRzLmxlbmd0aCA+IDEwO1xuXG5cdFx0XHRcdC8vIElmIHRoZSBmb2N1cyBmb3IgdGhlIGN1cnJlbnQgc2Vzc2lvbiBpcyBvbiBhIG5vbi1leGlzdGVudCB0aHJlYWQsIGNsZWFyIHRoZSBmb2N1cy5cblx0XHRcdFx0Y29uc3QgZm9jdXNlZFRocmVhZCA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRUaHJlYWQ7XG5cdFx0XHRcdGNvbnN0IGZvY3VzZWRUaHJlYWREb2VzTm90RXhpc3QgPSBmb2N1c2VkVGhyZWFkICE9PSB1bmRlZmluZWQgJiYgZm9jdXNlZFRocmVhZC5zZXNzaW9uID09PSB0aGlzICYmICF0aGlzLnRocmVhZHMuaGFzKGZvY3VzZWRUaHJlYWQudGhyZWFkSWQpO1xuXHRcdFx0XHRpZiAoZm9jdXNlZFRocmVhZERvZXNOb3RFeGlzdCkge1xuXHRcdFx0XHRcdHRoaXMuZGVidWdTZXJ2aWNlLmZvY3VzU3RhY2tGcmFtZSh1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB0aHJlYWQgPSB0eXBlb2YgdGhyZWFkSWQgPT09ICdudW1iZXInID8gdGhpcy5nZXRUaHJlYWQodGhyZWFkSWQpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAodGhyZWFkKSB7XG5cdFx0XHRcdFx0Ly8gQ2FsbCBmZXRjaCBjYWxsIHN0YWNrIHR3aWNlLCB0aGUgZmlyc3Qgb25seSByZXR1cm4gdGhlIHRvcCBzdGFjayBmcmFtZS5cblx0XHRcdFx0XHQvLyBTZWNvbmQgcmV0cmlldmVzIHRoZSByZXN0IG9mIHRoZSBjYWxsIHN0YWNrLiBGb3IgcGVyZm9ybWFuY2UgcmVhc29ucyAjMjU2MDVcblx0XHRcdFx0XHQvLyBTZWNvbmQgY2FsbCBpcyBvbmx5IGRvbmUgaWYgdGhlcmUncyBmZXcgdGhyZWFkcyB0aGF0IHN0b3BwZWQgaW4gdGhpcyBldmVudC5cblx0XHRcdFx0XHRjb25zdCBwcm9taXNlcyA9IHRoaXMubW9kZWwucmVmcmVzaFRvcE9mQ2FsbHN0YWNrKDxUaHJlYWQ+dGhyZWFkLCAvKiBmZXRjaEZ1bGxTdGFjaz0gKi8haGFzTG90c09mVGhyZWFkcyk7XG5cdFx0XHRcdFx0Y29uc3QgZm9jdXMgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoZm9jdXNlZFRocmVhZERvZXNOb3RFeGlzdCB8fCAoIWV2ZW50LnByZXNlcnZlRm9jdXNIaW50ICYmIHRocmVhZC5nZXRDYWxsU3RhY2soKS5sZW5ndGgpKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGZvY3VzZWRTdGFja0ZyYW1lID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFN0YWNrRnJhbWU7XG5cdFx0XHRcdFx0XHRcdGlmICghZm9jdXNlZFN0YWNrRnJhbWUgfHwgZm9jdXNlZFN0YWNrRnJhbWUudGhyZWFkLnNlc3Npb24gPT09IHRoaXMpIHtcblx0XHRcdFx0XHRcdFx0XHQvLyBPbmx5IHRha2UgZm9jdXMgaWYgbm90aGluZyBpcyBmb2N1c2VkLCBvciBpZiB0aGUgZm9jdXMgaXMgYWxyZWFkeSBvbiB0aGUgY3VycmVudCBzZXNzaW9uXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgcHJlc2VydmVGb2N1cyA9ICF0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElEZWJ1Z0NvbmZpZ3VyYXRpb24+KCdkZWJ1ZycpLmZvY3VzRWRpdG9yT25CcmVhaztcblx0XHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmRlYnVnU2VydmljZS5mb2N1c1N0YWNrRnJhbWUodW5kZWZpbmVkLCB0aHJlYWQsIHVuZGVmaW5lZCwgeyBwcmVzZXJ2ZUZvY3VzIH0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0aWYgKHRocmVhZC5zdG9wcGVkRGV0YWlscyAmJiAhdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAodGhyZWFkLnN0b3BwZWREZXRhaWxzLnJlYXNvbiA9PT0gJ2JyZWFrcG9pbnQnICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SURlYnVnQ29uZmlndXJhdGlvbj4oJ2RlYnVnJykub3BlbkRlYnVnID09PSAnb3Blbk9uRGVidWdCcmVhaycgJiYgIXRoaXMuc3VwcHJlc3NEZWJ1Z1ZpZXcpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2Uub3BlblBhbmVDb21wb3NpdGUoVklFV0xFVF9JRCwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdGlmICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElEZWJ1Z0NvbmZpZ3VyYXRpb24+KCdkZWJ1ZycpLmZvY3VzV2luZG93T25CcmVhayAmJiAhdGhpcy53b3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UuZXh0ZW5zaW9uVGVzdHNMb2NhdGlvblVSSSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgYWN0aXZlV2luZG93ID0gZ2V0QWN0aXZlV2luZG93KCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoIWFjdGl2ZVdpbmRvdy5kb2N1bWVudC5oYXNGb2N1cygpKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuaG9zdFNlcnZpY2UuZm9jdXMobWFpbldpbmRvdywgeyBmb3JjZTogdHJ1ZSAvKiBBcHBsaWNhdGlvbiBtYXkgbm90IGJlIGFjdGl2ZSAqLyB9KTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0YXdhaXQgcHJvbWlzZXMudG9wQ2FsbFN0YWNrO1xuXG5cdFx0XHRcdFx0aWYgKCFldmVudC5oaXRCcmVha3BvaW50SWRzKSB7IC8vIGlmIGhpdEJyZWFrcG9pbnRJZHMgYXJlIHByZXNlbnQsIHRoaXMgaXMgaGFuZGxlZCBlYXJsaWVyIG9uXG5cdFx0XHRcdFx0XHR0aGlzLl93YWl0VG9SZXN1bWUgPSB0aGlzLmVuYWJsZURlcGVuZGVudEJyZWFrcG9pbnRzKHRocmVhZCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Zm9jdXMoKTtcblxuXHRcdFx0XHRcdGF3YWl0IHByb21pc2VzLndob2xlQ2FsbFN0YWNrO1xuXHRcdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IGZvY3VzZWRTdGFja0ZyYW1lID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFN0YWNrRnJhbWU7XG5cdFx0XHRcdFx0aWYgKCFmb2N1c2VkU3RhY2tGcmFtZSB8fCBpc0ZyYW1lRGVlbXBoYXNpemVkKGZvY3VzZWRTdGFja0ZyYW1lKSkge1xuXHRcdFx0XHRcdFx0Ly8gVGhlIHRvcCBzdGFjayBmcmFtZSBjYW4gYmUgZGVlbXBoZXNpemVkIHNvIHRyeSB0byBmb2N1cyBhZ2FpbiAjNjg2MTZcblx0XHRcdFx0XHRcdGZvY3VzKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSgpO1xuXHRcdFx0fSxcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBlbmFibGVEZXBlbmRlbnRCcmVha3BvaW50cyhoaXRCcmVha3BvaW50SWRzT3JUaHJlYWQ6IFRocmVhZCB8IG51bWJlcltdKSB7XG5cdFx0bGV0IGJyZWFrcG9pbnRzOiBJQnJlYWtwb2ludFtdO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KGhpdEJyZWFrcG9pbnRJZHNPclRocmVhZCkpIHtcblx0XHRcdGJyZWFrcG9pbnRzID0gdGhpcy5tb2RlbC5nZXRCcmVha3BvaW50cygpLmZpbHRlcihicCA9PiBoaXRCcmVha3BvaW50SWRzT3JUaHJlYWQuaW5jbHVkZXMoYnAuZ2V0SWRGcm9tQWRhcHRlcih0aGlzLmlkKSEpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZnJhbWUgPSBoaXRCcmVha3BvaW50SWRzT3JUaHJlYWQuZ2V0VG9wU3RhY2tGcmFtZSgpO1xuXHRcdFx0aWYgKGZyYW1lID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaGl0QnJlYWtwb2ludElkc09yVGhyZWFkLnN0b3BwZWREZXRhaWxzICYmIGhpdEJyZWFrcG9pbnRJZHNPclRocmVhZC5zdG9wcGVkRGV0YWlscy5yZWFzb24gIT09ICdicmVha3BvaW50Jykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGJyZWFrcG9pbnRzID0gdGhpcy5nZXRCcmVha3BvaW50c0F0UG9zaXRpb24oZnJhbWUuc291cmNlLnVyaSwgZnJhbWUucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBmcmFtZS5yYW5nZS5lbmRMaW5lTnVtYmVyLCBmcmFtZS5yYW5nZS5zdGFydENvbHVtbiwgZnJhbWUucmFuZ2UuZW5kQ29sdW1uKTtcblx0XHR9XG5cblx0XHQvLyBmaW5kIHRoZSBjdXJyZW50IGJyZWFrcG9pbnRzXG5cblx0XHQvLyBjaGVjayBpZiB0aGUgY3VycmVudCBicmVha3BvaW50cyBhcmUgZGVwZW5kZW5jaWVzLCBhbmQgaWYgc28gY29sbGVjdCBhbmQgc2VuZCB0aGUgZGVwZW5kZW50cyB0byBEQVxuXHRcdGNvbnN0IHVyaXNUb1Jlc2VuZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHRoaXMubW9kZWwuZ2V0QnJlYWtwb2ludHMoeyB0cmlnZ2VyZWRPbmx5OiB0cnVlLCBlbmFibGVkT25seTogdHJ1ZSB9KS5mb3JFYWNoKGJwID0+IHtcblx0XHRcdGJyZWFrcG9pbnRzLmZvckVhY2goY2JwID0+IHtcblx0XHRcdFx0aWYgKGJwLmVuYWJsZWQgJiYgYnAudHJpZ2dlcmVkQnkgPT09IGNicC5nZXRJZCgpKSB7XG5cdFx0XHRcdFx0YnAuc2V0U2Vzc2lvbkRpZFRyaWdnZXIodGhpcy5nZXRJZCgpKTtcblx0XHRcdFx0XHR1cmlzVG9SZXNlbmQuYWRkKGJwLnVyaS50b1N0cmluZygpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCByZXN1bHRzOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuXHRcdHVyaXNUb1Jlc2VuZC5mb3JFYWNoKCh1cmkpID0+IHJlc3VsdHMucHVzaCh0aGlzLmRlYnVnU2VydmljZS5zZW5kQnJlYWtwb2ludHMoVVJJLnBhcnNlKHVyaSksIHVuZGVmaW5lZCwgdGhpcykpKTtcblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwocmVzdWx0cyk7XG5cdH1cblxuXHRwcml2YXRlIGdldEJyZWFrcG9pbnRzQXRQb3NpdGlvbih1cmk6IFVSSSwgc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlciwgc3RhcnRDb2x1bW46IG51bWJlciwgZW5kQ29sdW1uOiBudW1iZXIpOiBJQnJlYWtwb2ludFtdIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRCcmVha3BvaW50cyh7IHVyaTogdXJpIH0pLmZpbHRlcihicCA9PiB7XG5cdFx0XHRpZiAoYnAubGluZU51bWJlciA8IHN0YXJ0TGluZU51bWJlciB8fCBicC5saW5lTnVtYmVyID4gZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChicC5jb2x1bW4gJiYgKGJwLmNvbHVtbiA8IHN0YXJ0Q29sdW1uIHx8IGJwLmNvbHVtbiA+IGVuZENvbHVtbikpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkRXhpdEFkYXB0ZXIoZXZlbnQ/OiBBZGFwdGVyRW5kRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcblx0XHR0aGlzLm1vZGVsLnNldEJyZWFrcG9pbnRTZXNzaW9uRGF0YSh0aGlzLmdldElkKCksIHRoaXMuY2FwYWJpbGl0aWVzLCB1bmRlZmluZWQpO1xuXHRcdHRoaXMuc2h1dGRvd24oKTtcblx0XHR0aGlzLl9vbkRpZEVuZEFkYXB0ZXIuZmlyZShldmVudCk7XG5cdH1cblxuXHQvLyBEaXNjb25uZWN0cyBhbmQgY2xlYXJzIHN0YXRlLiBTZXNzaW9uIGNhbiBiZSBpbml0aWFsaXplZCBhZ2FpbiBmb3IgYSBuZXcgY29ubmVjdGlvbi5cblx0cHJpdmF0ZSBzaHV0ZG93bigpOiB2b2lkIHtcblx0XHR0aGlzLnJhd0xpc3RlbmVycy5jbGVhcigpO1xuXHRcdGlmICh0aGlzLnJhdykge1xuXHRcdFx0Ly8gU2VuZCBvdXQgZGlzY29ubmVjdCBhbmQgaW1tZWRpYXRseSBkaXNwb3NlIChkbyBub3Qgd2FpdCBmb3IgcmVzcG9uc2UpICMxMjc0MThcblx0XHRcdHRoaXMucmF3LmRpc2Nvbm5lY3Qoe30pO1xuXHRcdFx0dGhpcy5yYXcuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5yYXcgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHRoaXMuZmV0Y2hUaHJlYWRzU2NoZWR1bGVyPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5mZXRjaFRocmVhZHNTY2hlZHVsZXIgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5wYXNzRm9jdXNTY2hlZHVsZXIuY2FuY2VsKCk7XG5cdFx0dGhpcy5wYXNzRm9jdXNTY2hlZHVsZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMubW9kZWwuY2xlYXJUaHJlYWRzKHRoaXMuZ2V0SWQoKSwgdHJ1ZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKCk7XG5cdH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpIHtcblx0XHR0aGlzLmNhbmNlbEFsbFJlcXVlc3RzKCk7XG5cdFx0dGhpcy5yYXdMaXN0ZW5lcnMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuZ2xvYmFsRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0Ly8tLS0tIHNvdXJjZXNcblxuXHRnZXRTb3VyY2VGb3JVcmkodXJpOiBVUkkpOiBTb3VyY2UgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnNvdXJjZXMuZ2V0KHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmFzQ2Fub25pY2FsVXJpKHVyaSkudG9TdHJpbmcoKSk7XG5cdH1cblxuXHRnZXRTb3VyY2UocmF3PzogRGVidWdQcm90b2NvbC5Tb3VyY2UpOiBTb3VyY2Uge1xuXHRcdGxldCBzb3VyY2UgPSBuZXcgU291cmNlKHJhdywgdGhpcy5nZXRJZCgpLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRjb25zdCB1cmlLZXkgPSBzb3VyY2UudXJpLnRvU3RyaW5nKCk7XG5cdFx0Y29uc3QgZm91bmQgPSB0aGlzLnNvdXJjZXMuZ2V0KHVyaUtleSk7XG5cdFx0aWYgKGZvdW5kKSB7XG5cdFx0XHRzb3VyY2UgPSBmb3VuZDtcblx0XHRcdC8vIG1lcmdlIGF0dHJpYnV0ZXMgb2YgbmV3IGludG8gZXhpc3Rpbmdcblx0XHRcdHNvdXJjZS5yYXcgPSBtaXhpbihzb3VyY2UucmF3LCByYXcpO1xuXHRcdFx0aWYgKHNvdXJjZS5yYXcgJiYgcmF3KSB7XG5cdFx0XHRcdC8vIEFsd2F5cyB0YWtlIHRoZSBsYXRlc3QgcHJlc2VudGF0aW9uIGhpbnQgZnJvbSBhZGFwdGVyICM0MjEzOVxuXHRcdFx0XHRzb3VyY2UucmF3LnByZXNlbnRhdGlvbkhpbnQgPSByYXcucHJlc2VudGF0aW9uSGludDtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zb3VyY2VzLnNldCh1cmlLZXksIHNvdXJjZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHNvdXJjZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UmF3U291cmNlKHVyaTogVVJJKTogRGVidWdQcm90b2NvbC5Tb3VyY2Uge1xuXHRcdGNvbnN0IHNvdXJjZSA9IHRoaXMuZ2V0U291cmNlRm9yVXJpKHVyaSk7XG5cdFx0aWYgKHNvdXJjZSkge1xuXHRcdFx0cmV0dXJuIHNvdXJjZS5yYXc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGRhdGEgPSBTb3VyY2UuZ2V0RW5jb2RlZERlYnVnRGF0YSh1cmkpO1xuXHRcdFx0cmV0dXJuIHsgbmFtZTogZGF0YS5uYW1lLCBwYXRoOiBkYXRhLnBhdGgsIHNvdXJjZVJlZmVyZW5jZTogZGF0YS5zb3VyY2VSZWZlcmVuY2UgfTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldE5ld0NhbmNlbGxhdGlvblRva2VuKHRocmVhZElkOiBudW1iZXIsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBDYW5jZWxsYXRpb25Ub2tlbiB7XG5cdFx0Y29uc3QgdG9rZW5Tb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UodG9rZW4pO1xuXHRcdGNvbnN0IHRva2VucyA9IHRoaXMuY2FuY2VsbGF0aW9uTWFwLmdldCh0aHJlYWRJZCkgfHwgW107XG5cdFx0dG9rZW5zLnB1c2godG9rZW5Tb3VyY2UpO1xuXHRcdHRoaXMuY2FuY2VsbGF0aW9uTWFwLnNldCh0aHJlYWRJZCwgdG9rZW5zKTtcblxuXHRcdHJldHVybiB0b2tlblNvdXJjZS50b2tlbjtcblx0fVxuXG5cdHByaXZhdGUgY2FuY2VsQWxsUmVxdWVzdHMoKTogdm9pZCB7XG5cdFx0dGhpcy5jYW5jZWxsYXRpb25NYXAuZm9yRWFjaCh0b2tlbnMgPT4gdG9rZW5zLmZvckVhY2godCA9PiB0LmRpc3Bvc2UodHJ1ZSkpKTtcblx0XHR0aGlzLmNhbmNlbGxhdGlvbk1hcC5jbGVhcigpO1xuXHR9XG5cblx0Ly8gUkVQTFxuXG5cdGdldFJlcGxFbGVtZW50cygpOiBJUmVwbEVsZW1lbnRbXSB7XG5cdFx0cmV0dXJuIHRoaXMucmVwbC5nZXRSZXBsRWxlbWVudHMoKTtcblx0fVxuXG5cdGhhc1NlcGFyYXRlUmVwbCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gIXRoaXMucGFyZW50U2Vzc2lvbiB8fCB0aGlzLl9vcHRpb25zLnJlcGwgIT09ICdtZXJnZVdpdGhQYXJlbnQnO1xuXHR9XG5cblx0cmVtb3ZlUmVwbEV4cHJlc3Npb25zKCk6IHZvaWQge1xuXHRcdHRoaXMucmVwbC5yZW1vdmVSZXBsRXhwcmVzc2lvbnMoKTtcblx0fVxuXG5cdGFzeW5jIGFkZFJlcGxFeHByZXNzaW9uKHN0YWNrRnJhbWU6IElTdGFja0ZyYW1lIHwgdW5kZWZpbmVkLCBleHByZXNzaW9uOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLnJlcGwuYWRkUmVwbEV4cHJlc3Npb24odGhpcywgc3RhY2tGcmFtZSwgZXhwcmVzc2lvbik7XG5cdFx0Ly8gRXZhbHVhdGUgYWxsIHdhdGNoIGV4cHJlc3Npb25zIGFuZCBmZXRjaCB2YXJpYWJsZXMgYWdhaW4gc2luY2UgcmVwbCBldmFsdWF0aW9uIG1pZ2h0IGhhdmUgY2hhbmdlZCBzb21lLlxuXHRcdHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLnVwZGF0ZVZpZXdzKCk7XG5cdH1cblxuXHRhcHBlbmRUb1JlcGwoZGF0YTogSU5ld1JlcGxFbGVtZW50RGF0YSwgaXNJbXBvcnRhbnQ/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5yZXBsLmFwcGVuZFRvUmVwbCh0aGlzLCBkYXRhKTtcblx0XHRpZiAoaXNJbXBvcnRhbnQpIHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoeyBtZXNzYWdlOiBkYXRhLm91dHB1dC50b1N0cmluZygpLCBzZXZlcml0eTogZGF0YS5zZXYsIHNvdXJjZTogdGhpcy5uYW1lIH0pO1xuXHRcdH1cblx0fVxufVxuXG4vKipcbiAqIEtlZXBzIHRyYWNrIG9mIGV2ZW50cyBmb3IgdGhyZWFkcywgYW5kIGNhbmNlbHMgYW55IHByZXZpb3VzIG9wZXJhdGlvbnMgZm9yXG4gKiBhIHRocmVhZCB3aGVuIHRoZSB0aHJlYWQgZ29lcyBpbnRvIGEgbmV3IHN0YXRlLiBDdXJyZW50bHksIHRoZSBvcGVyYXRpb25zIGEgdGhyZWFkIGhhcyBhcmU6XG4gKlxuICogLSBzdGFydGVkXG4gKiAtIHN0b3BwZWRcbiAqIC0gY29udGludWVcbiAqIC0gZXhpdGVkXG4gKlxuICogSW4gZWFjaCBjYXNlLCB0aGUgbmV3IHN0YXRlIHByZWVtcHRzIHRoZSBvbGQgc3RhdGUsIHNvIHdlIGRvbid0IG5lZWQgdG9cbiAqIHF1ZXVlIHdvcmssIGp1c3QgY2FuY2VsIG9sZCB3b3JrLiBJdCdzIHVwIHRvIHRoZSBjYWxsZXIgdG8gbWFrZSBzdXJlIHRoYXRcbiAqIG5vIFVJIGVmZmVjdHMgaGFwcGVuIGF0IHRoZSBwb2ludCB3aGVuIHRoZSBgdG9rZW5gIGlzIGNhbmNlbGxlZC5cbiAqL1xuZXhwb3J0IGNsYXNzIFRocmVhZFN0YXR1c1NjaGVkdWxlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHQvKipcblx0ICogQW4gYXJyYXkgb2Ygc2V0IG9mIHRocmVhZCBJRHMuIFdoZW4gYSAnc3RvcHBlZCcgZXZlbnQgaXMgZW5jb3VudGVyZWQsIHRoZVxuXHQgKiBlZGl0b3IgcmVmcmVzaGVzIGl0cyB0aHJlYWQgSURzLiBJbiB0aGUgbWVhbnRpbWUsIHRoZSB0aHJlYWQgbWF5IGNoYW5nZVxuXHQgKiBzdGF0ZSBpdCBhZ2Fpbi4gU28gdGhlIGVkaXRvciBwdXRzIGEgU2V0IGludG8gdGhpcyBhcnJheSB3aGVuIGl0IHN0YXJ0c1xuXHQgKiB0aGUgcmVmcmVzaCwgYW5kIGNoZWNrcyBpdCBhZnRlciB0aGUgcmVmcmVzaCBpcyBmaW5pc2hlZCwgdG8gc2VlIGlmXG5cdCAqIGFueSBvZiB0aGUgdGhyZWFkcyBpdCBsb29rZWQgdXAgc2hvdWxkIG5vdyBiZSBpbnZhbGlkYXRlZC5cblx0ICovXG5cdHByaXZhdGUgcGVuZGluZ0NhbmNlbGxhdGlvbnM6IFNldDxudW1iZXIgfCB1bmRlZmluZWQ+W10gPSBbXTtcblxuXHQvKipcblx0ICogQ2FuY2VsbGF0aW9uIHRva2VucyBmb3IgY3VycmVudGx5LXJ1bm5pbmcgb3BlcmF0aW9ucyBvbiB0aHJlYWRzLlxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSB0aHJlYWRPcHMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcDxudW1iZXIsIENhbmNlbGxhdGlvblRva2VuU291cmNlPigpKTtcblxuXHQvKipcblx0ICogUnVucyB0aGUgb3BlcmF0aW9uLlxuXHQgKiBJZiB0aHJlYWQgaXMgdW5kZWZpbmVkIGl0IGFmZmVjdHMgYWxsIHRocmVhZHMuXG5cdCAqL1xuXHRwdWJsaWMgYXN5bmMgcnVuKHRocmVhZElkc1A6IFByb21pc2U8bnVtYmVyW10+LCBvcGVyYXRpb246ICh0aHJlYWRJZDogbnVtYmVyLCBjdDogQ2FuY2VsbGF0aW9uVG9rZW4pID0+IFByb21pc2U8dW5rbm93bj4pIHtcblx0XHRjb25zdCBjYW5jZWxsZWRXaGlsZUxvb2tpbmdVcFRocmVhZHMgPSBuZXcgU2V0PG51bWJlciB8IHVuZGVmaW5lZD4oKTtcblx0XHR0aGlzLnBlbmRpbmdDYW5jZWxsYXRpb25zLnB1c2goY2FuY2VsbGVkV2hpbGVMb29raW5nVXBUaHJlYWRzKTtcblx0XHRjb25zdCB0aHJlYWRJZHMgPSBhd2FpdCB0aHJlYWRJZHNQO1xuXG5cdFx0Ly8gTm93IHRoYXQgd2UgZ290IG91ciB0aHJlYWRzLFxuXHRcdC8vIDEuIFJlbW92ZSBvdXIgcGVuZGluZyBzZXQsIGFuZFxuXHRcdC8vIDIuIENhbmNlbCBhbnkgc2xvd2VyIGNhbGxlcnMgd2hvIG1pZ2h0IGFsc28gaGF2ZSBmb3VuZCB0aGlzIHRocmVhZFxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wZW5kaW5nQ2FuY2VsbGF0aW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgcyA9IHRoaXMucGVuZGluZ0NhbmNlbGxhdGlvbnNbaV07XG5cdFx0XHRpZiAocyA9PT0gY2FuY2VsbGVkV2hpbGVMb29raW5nVXBUaHJlYWRzKSB7XG5cdFx0XHRcdHRoaXMucGVuZGluZ0NhbmNlbGxhdGlvbnMuc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZvciAoY29uc3QgdGhyZWFkSWQgb2YgdGhyZWFkSWRzKSB7XG5cdFx0XHRcdFx0cy5hZGQodGhyZWFkSWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGNhbmNlbGxlZFdoaWxlTG9va2luZ1VwVGhyZWFkcy5oYXModW5kZWZpbmVkKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKHRocmVhZElkcy5tYXAodGhyZWFkSWQgPT4ge1xuXHRcdFx0aWYgKGNhbmNlbGxlZFdoaWxlTG9va2luZ1VwVGhyZWFkcy5oYXModGhyZWFkSWQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMudGhyZWFkT3BzLmdldCh0aHJlYWRJZCk/LmNhbmNlbCgpO1xuXHRcdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0XHR0aGlzLnRocmVhZE9wcy5zZXQodGhyZWFkSWQsIGN0cyk7XG5cdFx0XHRyZXR1cm4gb3BlcmF0aW9uKHRocmVhZElkLCBjdHMudG9rZW4pO1xuXHRcdH0pKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDYW5jZWxzIGFsbCBvbmdvaW5nIHN0YXRlIG9wZXJhdGlvbnMgb24gdGhlIGdpdmVuIHRocmVhZHMuXG5cdCAqIElmIHRocmVhZHMgaXMgdW5kZWZpbmVkIGl0IGNhbmNlbCBhbGwgdGhyZWFkcy5cblx0ICovXG5cdHB1YmxpYyBjYW5jZWwodGhyZWFkSWRzPzogcmVhZG9ubHkgbnVtYmVyW10pIHtcblx0XHRpZiAoIXRocmVhZElkcykge1xuXHRcdFx0Zm9yIChjb25zdCBbXywgb3BdIG9mIHRoaXMudGhyZWFkT3BzKSB7XG5cdFx0XHRcdG9wLmNhbmNlbCgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy50aHJlYWRPcHMuY2xlYXJBbmREaXNwb3NlQWxsKCk7XG5cdFx0XHRmb3IgKGNvbnN0IHMgb2YgdGhpcy5wZW5kaW5nQ2FuY2VsbGF0aW9ucykge1xuXHRcdFx0XHRzLmFkZCh1bmRlZmluZWQpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRmb3IgKGNvbnN0IHRocmVhZElkIG9mIHRocmVhZElkcykge1xuXHRcdFx0XHR0aGlzLnRocmVhZE9wcy5nZXQodGhyZWFkSWQpPy5jYW5jZWwoKTtcblx0XHRcdFx0dGhpcy50aHJlYWRPcHMuZGVsZXRlQW5kRGlzcG9zZSh0aHJlYWRJZCk7XG5cdFx0XHRcdGZvciAoY29uc3QgcyBvZiB0aGlzLnBlbmRpbmdDYW5jZWxsYXRpb25zKSB7XG5cdFx0XHRcdFx0cy5hZGQodGhyZWFkSWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksVUFBVTtBQUN0QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLE9BQU8sa0JBQWtCLG1CQUFtQjtBQUNyRCxTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxlQUFzQjtBQUMvQixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLFlBQVksZUFBZSxpQkFBOEIsbUJBQW1CLGVBQWU7QUFDcEcsU0FBUyxhQUFhO0FBQ3RCLFlBQVksY0FBYztBQUMxQixZQUFZLGVBQWU7QUFDM0IsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsV0FBVztBQUNwQixTQUFTLG9CQUFvQjtBQUU3QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGlDQUFpQyxtQkFBbUIsc0JBQXNCO0FBQ25GLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0NBQWtEO0FBQzNELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQTZJLGVBQTZQLE9BQU8sWUFBWSwyQkFBMkI7QUFFeGIsU0FBcUIs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
