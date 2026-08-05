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
import { Emitter } from "../../../base/common/event.js";
import { MainContext } from "./extHost.protocol.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { URI } from "../../../base/common/uri.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { DisposableStore, Disposable, MutableDisposable } from "../../../base/common/lifecycle.js";
import { Disposable as VSCodeDisposable, EnvironmentVariableMutatorType } from "./extHostTypes.js";
import { localize } from "../../../nls.js";
import { NotSupportedError } from "../../../base/common/errors.js";
import { serializeEnvironmentDescriptionMap, serializeEnvironmentVariableCollection } from "../../../platform/terminal/common/environmentVariableShared.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { ProcessPropertyType } from "../../../platform/terminal/common/terminal.js";
import { TerminalDataBufferer } from "../../../platform/terminal/common/terminalDataBuffering.js";
import { ThemeColor } from "../../../base/common/themables.js";
import { Promises } from "../../../base/common/async.js";
import { TerminalCompletionList, TerminalQuickFix, ViewColumn } from "./extHostTypeConverters.js";
import { IExtHostCommands } from "./extHostCommands.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
const IExtHostTerminalService = createDecorator("IExtHostTerminalService");
class ExtHostTerminal extends Disposable {
  constructor(_proxy, _id, _creationOptions, _name) {
    super();
    this._proxy = _proxy;
    this._id = _id;
    this._creationOptions = _creationOptions;
    this._name = _name;
    this._disposed = false;
    this._state = { isInteractedWith: false, shell: void 0 };
    this.isOpen = false;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this._creationOptions = Object.freeze(this._creationOptions);
    this._pidPromise = new Promise((c) => this._pidPromiseComplete = c);
    const that = this;
    this.value = {
      get name() {
        return that._name || "";
      },
      get processId() {
        return that._pidPromise;
      },
      get creationOptions() {
        return that._creationOptions;
      },
      get exitStatus() {
        return that._exitStatus;
      },
      get state() {
        return that._state;
      },
      get selection() {
        return that._selection;
      },
      get shellIntegration() {
        return that.shellIntegration;
      },
      sendText(text, shouldExecute = true) {
        that._checkDisposed();
        that._proxy.$sendText(that._id, text, shouldExecute);
      },
      show(preserveFocus) {
        that._checkDisposed();
        that._proxy.$show(that._id, preserveFocus);
      },
      hide() {
        that._checkDisposed();
        that._proxy.$hide(that._id);
      },
      dispose() {
        if (!that._disposed) {
          that._disposed = true;
          that._proxy.$dispose(that._id);
        }
      },
      get dimensions() {
        if (that._cols === void 0 || that._rows === void 0) {
          return void 0;
        }
        return {
          columns: that._cols,
          rows: that._rows
        };
      }
    };
  }
  dispose() {
    this._onWillDispose.fire();
    super.dispose();
  }
  async create(options, internalOptions) {
    if (typeof this._id !== "string") {
      throw new Error("Terminal has already been created");
    }
    await this._proxy.$createTerminal(this._id, {
      name: options.name,
      shellPath: options.shellPath ?? void 0,
      shellArgs: options.shellArgs ?? void 0,
      cwd: options.cwd ?? internalOptions?.cwd ?? void 0,
      env: options.env ?? void 0,
      icon: asTerminalIcon(options.iconPath) ?? void 0,
      color: ThemeColor.isThemeColor(options.color) ? options.color.id : void 0,
      initialText: options.message ?? void 0,
      strictEnv: options.strictEnv ?? void 0,
      hideFromUser: options.hideFromUser ?? void 0,
      forceShellIntegration: internalOptions?.forceShellIntegration ?? void 0,
      isFeatureTerminal: internalOptions?.isFeatureTerminal ?? void 0,
      isExtensionOwnedTerminal: true,
      useShellEnvironment: internalOptions?.useShellEnvironment ?? void 0,
      location: internalOptions?.location || this._serializeParentTerminal(options.location, internalOptions?.resolvedExtHostIdentifier),
      isTransient: options.isTransient ?? void 0
    });
  }
  async createExtensionTerminal(location, internalOptions, parentTerminal, iconPath, color) {
    if (typeof this._id !== "string") {
      throw new Error("Terminal has already been created");
    }
    await this._proxy.$createTerminal(this._id, {
      name: this._name,
      isExtensionCustomPtyTerminal: true,
      icon: iconPath,
      color: ThemeColor.isThemeColor(color) ? color.id : void 0,
      location: internalOptions?.location || this._serializeParentTerminal(location, parentTerminal),
      isTransient: true
    });
    if (typeof this._id === "string") {
      throw new Error("Terminal creation failed");
    }
    return this._id;
  }
  _serializeParentTerminal(location, parentTerminal) {
    if (typeof location === "object") {
      if ("parentTerminal" in location && location.parentTerminal && parentTerminal) {
        return { parentTerminal };
      }
      if ("viewColumn" in location) {
        return { viewColumn: ViewColumn.from(location.viewColumn), preserveFocus: location.preserveFocus };
      }
      return void 0;
    }
    return location;
  }
  _checkDisposed() {
    if (this._disposed) {
      throw new Error("Terminal has already been disposed");
    }
  }
  set name(name) {
    this._name = name;
  }
  setExitStatus(code, reason) {
    this._exitStatus = Object.freeze({ code, reason });
  }
  setDimensions(cols, rows) {
    if (cols === this._cols && rows === this._rows) {
      return false;
    }
    if (cols === 0 || rows === 0) {
      return false;
    }
    this._cols = cols;
    this._rows = rows;
    return true;
  }
  setInteractedWith() {
    if (!this._state.isInteractedWith) {
      this._state = {
        ...this._state,
        isInteractedWith: true
      };
      return true;
    }
    return false;
  }
  setShellType(shellType) {
    if (this._state.shell !== shellType) {
      this._state = {
        ...this._state,
        shell: shellType
      };
      return true;
    }
    return false;
  }
  setSelection(selection) {
    this._selection = selection;
  }
  _setProcessId(processId) {
    if (this._pidPromiseComplete) {
      this._pidPromiseComplete(processId);
      this._pidPromiseComplete = void 0;
    } else {
      this._pidPromise.then((pid) => {
        if (pid !== processId) {
          this._pidPromise = Promise.resolve(processId);
        }
      });
    }
  }
}
class ExtHostPseudoterminal {
  constructor(_pty) {
    this._pty = _pty;
    this.id = 0;
    this.shouldPersist = false;
    this._onProcessData = new Emitter();
    this.onProcessData = this._onProcessData.event;
    this._onProcessReady = new Emitter();
    this._onDidChangeProperty = new Emitter();
    this.onDidChangeProperty = this._onDidChangeProperty.event;
    this._onProcessExit = new Emitter();
    this.onProcessExit = this._onProcessExit.event;
  }
  get onProcessReady() {
    return this._onProcessReady.event;
  }
  refreshProperty(property) {
    throw new Error(`refreshProperty is not suppported in extension owned terminals. property: ${property}`);
  }
  updateProperty(property, value) {
    throw new Error(`updateProperty is not suppported in extension owned terminals. property: ${property}, value: ${value}`);
  }
  async start() {
    return void 0;
  }
  shutdown() {
    this._pty.close();
  }
  input(data) {
    this._pty.handleInput?.(data);
  }
  resize(cols, rows) {
    this._pty.setDimensions?.({ columns: cols, rows });
  }
  clearBuffer() {
  }
  async processBinary(data) {
  }
  acknowledgeDataEvent(charCount) {
  }
  async setUnicodeVersion(version) {
  }
  getInitialCwd() {
    return Promise.resolve("");
  }
  getCwd() {
    return Promise.resolve("");
  }
  startSendingEvents(initialDimensions) {
    this._pty.onDidWrite((e) => this._onProcessData.fire(e));
    this._pty.onDidClose?.((e = void 0) => {
      this._onProcessExit.fire(e === void 0 ? void 0 : e);
    });
    this._pty.onDidOverrideDimensions?.((e) => {
      if (e) {
        this._onDidChangeProperty.fire({ type: ProcessPropertyType.OverrideDimensions, value: { cols: e.columns, rows: e.rows } });
      }
    });
    this._pty.onDidChangeName?.((title) => {
      this._onDidChangeProperty.fire({ type: ProcessPropertyType.Title, value: title });
    });
    this._pty.open(initialDimensions ? initialDimensions : void 0);
    if (initialDimensions) {
      this._pty.setDimensions?.(initialDimensions);
    }
    this._onProcessReady.fire({ pid: -1, cwd: "", windowsPty: void 0 });
  }
}
let nextLinkId = 1;
let BaseExtHostTerminalService = class extends Disposable {
  constructor(supportsProcesses, _extHostCommands, extHostRpc) {
    super();
    this._extHostCommands = _extHostCommands;
    this._terminals = [];
    this._terminalProcesses = /* @__PURE__ */ new Map();
    this._terminalProcessDisposables = {};
    this._extensionTerminalAwaitingStart = {};
    this._getTerminalPromises = {};
    this._environmentVariableCollections = /* @__PURE__ */ new Map();
    this._lastQuickFixCommands = this._register(new MutableDisposable());
    this._linkProviders = /* @__PURE__ */ new Set();
    this._completionProviders = /* @__PURE__ */ new Map();
    this._profileProviders = /* @__PURE__ */ new Map();
    this._quickFixProviders = /* @__PURE__ */ new Map();
    this._terminalLinkCache = /* @__PURE__ */ new Map();
    this._terminalLinkCancellationSource = /* @__PURE__ */ new Map();
    this._onDidCloseTerminal = new Emitter();
    this.onDidCloseTerminal = this._onDidCloseTerminal.event;
    this._onDidOpenTerminal = new Emitter();
    this.onDidOpenTerminal = this._onDidOpenTerminal.event;
    this._onDidChangeActiveTerminal = new Emitter();
    this.onDidChangeActiveTerminal = this._onDidChangeActiveTerminal.event;
    this._onDidChangeTerminalDimensions = new Emitter();
    this.onDidChangeTerminalDimensions = this._onDidChangeTerminalDimensions.event;
    this._onDidChangeTerminalState = new Emitter();
    this.onDidChangeTerminalState = this._onDidChangeTerminalState.event;
    this._onDidChangeShell = new Emitter();
    this.onDidChangeShell = this._onDidChangeShell.event;
    this._onDidWriteTerminalData = new Emitter({
      onWillAddFirstListener: () => this._proxy.$startSendingDataEvents(),
      onDidRemoveLastListener: () => this._proxy.$stopSendingDataEvents()
    });
    this.onDidWriteTerminalData = this._onDidWriteTerminalData.event;
    this._onDidExecuteCommand = new Emitter({
      onWillAddFirstListener: () => this._proxy.$startSendingCommandEvents(),
      onDidRemoveLastListener: () => this._proxy.$stopSendingCommandEvents()
    });
    this.onDidExecuteTerminalCommand = this._onDidExecuteCommand.event;
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadTerminalService);
    this._bufferer = new TerminalDataBufferer(this._proxy.$sendProcessData);
    this._proxy.$registerProcessSupport(supportsProcesses);
    this._extHostCommands.registerArgumentProcessor({
      processArgument: (arg) => {
        const deserialize = (arg2) => {
          const cast = arg2;
          return this.getTerminalById(cast.instanceId)?.value;
        };
        switch (arg?.$mid) {
          case MarshalledId.TerminalContext:
            return deserialize(arg);
          default: {
            if (Array.isArray(arg)) {
              for (let i = 0; i < arg.length; i++) {
                if (arg[i].$mid === MarshalledId.TerminalContext) {
                  arg[i] = deserialize(arg[i]);
                } else {
                  break;
                }
              }
            }
            return arg;
          }
        }
      }
    });
    this._register({
      dispose: () => {
        for (const [_, terminalProcess] of this._terminalProcesses) {
          terminalProcess.shutdown(true);
        }
      }
    });
  }
  get activeTerminal() {
    return this._activeTerminal?.value;
  }
  get terminals() {
    return this._terminals.map((term) => term.value);
  }
  getDefaultShell(useAutomationShell) {
    const profile = useAutomationShell ? this._defaultAutomationProfile : this._defaultProfile;
    return profile?.path || "";
  }
  getDefaultShellArgs(useAutomationShell) {
    const profile = useAutomationShell ? this._defaultAutomationProfile : this._defaultProfile;
    return profile?.args || [];
  }
  createExtensionTerminal(options, internalOptions) {
    const terminal = new ExtHostTerminal(this._proxy, generateUuid(), options, options.name);
    const p = new ExtHostPseudoterminal(options.pty);
    terminal.createExtensionTerminal(options.location, internalOptions, this._serializeParentTerminal(options, internalOptions).resolvedExtHostIdentifier, asTerminalIcon(options.iconPath), asTerminalColor(options.color)).then((id) => {
      const disposable = this._setupExtHostProcessListeners(id, p);
      this._terminalProcessDisposables[id] = disposable;
    });
    this._terminals.push(terminal);
    return terminal.value;
  }
  _serializeParentTerminal(options, internalOptions) {
    internalOptions = internalOptions ? internalOptions : {};
    if (options.location && typeof options.location === "object" && "parentTerminal" in options.location) {
      const parentTerminal = options.location.parentTerminal;
      if (parentTerminal) {
        const parentExtHostTerminal = this._terminals.find((t) => t.value === parentTerminal);
        if (parentExtHostTerminal) {
          internalOptions.resolvedExtHostIdentifier = parentExtHostTerminal._id;
        }
      }
    } else if (options.location && typeof options.location !== "object") {
      internalOptions.location = options.location;
    } else if (internalOptions.location && typeof internalOptions.location === "object" && "splitActiveTerminal" in internalOptions.location) {
      internalOptions.location = { splitActiveTerminal: true };
    }
    return internalOptions;
  }
  attachPtyToTerminal(id, pty) {
    const terminal = this.getTerminalById(id);
    if (!terminal) {
      throw new Error(`Cannot resolve terminal with id ${id} for virtual process`);
    }
    const p = new ExtHostPseudoterminal(pty);
    const disposable = this._setupExtHostProcessListeners(id, p);
    this._terminalProcessDisposables[id] = disposable;
  }
  async $acceptActiveTerminalChanged(id) {
    const original = this._activeTerminal;
    if (id === null) {
      this._activeTerminal = void 0;
      if (original !== this._activeTerminal) {
        this._onDidChangeActiveTerminal.fire(this._activeTerminal);
      }
      return;
    }
    const terminal = this.getTerminalById(id);
    if (terminal) {
      this._activeTerminal = terminal;
      if (original !== this._activeTerminal) {
        this._onDidChangeActiveTerminal.fire(this._activeTerminal.value);
      }
    }
  }
  async $acceptTerminalProcessData(id, data) {
    const terminal = this.getTerminalById(id);
    if (terminal) {
      this._onDidWriteTerminalData.fire({ terminal: terminal.value, data });
    }
  }
  async $acceptTerminalDimensions(id, cols, rows) {
    const terminal = this.getTerminalById(id);
    if (terminal) {
      if (terminal.setDimensions(cols, rows)) {
        this._onDidChangeTerminalDimensions.fire({
          terminal: terminal.value,
          dimensions: terminal.value.dimensions
        });
      }
    }
  }
  async $acceptDidExecuteCommand(id, command) {
    const terminal = this.getTerminalById(id);
    if (terminal) {
      this._onDidExecuteCommand.fire({ terminal: terminal.value, ...command });
    }
  }
  async $acceptTerminalMaximumDimensions(id, cols, rows) {
    this._terminalProcesses.get(id)?.resize(cols, rows);
  }
  async $acceptTerminalTitleChange(id, name) {
    const terminal = this.getTerminalById(id);
    if (terminal) {
      terminal.name = name;
    }
  }
  async $acceptTerminalClosed(id, exitCode, exitReason) {
    const index = this._getTerminalObjectIndexById(this._terminals, id);
    if (index !== null) {
      const terminal = this._terminals.splice(index, 1)[0];
      terminal.setExitStatus(exitCode, exitReason);
      this._onDidCloseTerminal.fire(terminal.value);
    }
  }
  $acceptTerminalOpened(id, extHostTerminalId, name, shellLaunchConfigDto) {
    if (extHostTerminalId) {
      const index = this._getTerminalObjectIndexById(this._terminals, extHostTerminalId);
      if (index !== null) {
        this._terminals[index]._id = id;
        this._onDidOpenTerminal.fire(this.terminals[index]);
        this._terminals[index].isOpen = true;
        return;
      }
    }
    const creationOptions = {
      name: shellLaunchConfigDto.name,
      shellPath: shellLaunchConfigDto.executable,
      shellArgs: shellLaunchConfigDto.args,
      cwd: typeof shellLaunchConfigDto.cwd === "string" ? shellLaunchConfigDto.cwd : URI.revive(shellLaunchConfigDto.cwd),
      env: shellLaunchConfigDto.env,
      hideFromUser: shellLaunchConfigDto.hideFromUser
    };
    const terminal = new ExtHostTerminal(this._proxy, id, creationOptions, name);
    this._terminals.push(terminal);
    this._onDidOpenTerminal.fire(terminal.value);
    terminal.isOpen = true;
  }
  async $acceptTerminalProcessId(id, processId) {
    const terminal = this.getTerminalById(id);
    terminal?._setProcessId(processId);
  }
  async $startExtensionTerminal(id, initialDimensions) {
    const terminal = this.getTerminalById(id);
    if (!terminal) {
      return { message: localize("launchFail.idMissingOnExtHost", "Could not find the terminal with id {0} on the extension host", id) };
    }
    if (!terminal.isOpen) {
      await new Promise((r) => {
        const listener = this.onDidOpenTerminal(async (e) => {
          if (e === terminal.value) {
            listener.dispose();
            r();
          }
        });
      });
    }
    const terminalProcess = this._terminalProcesses.get(id);
    if (terminalProcess) {
      terminalProcess.startSendingEvents(initialDimensions);
    } else {
      this._extensionTerminalAwaitingStart[id] = { initialDimensions };
    }
    return void 0;
  }
  _setupExtHostProcessListeners(id, p) {
    const disposables = new DisposableStore();
    disposables.add(p.onProcessReady((e) => this._proxy.$sendProcessReady(id, e.pid, e.cwd, e.windowsPty)));
    disposables.add(p.onDidChangeProperty((property) => this._proxy.$sendProcessProperty(id, property)));
    this._bufferer.startBuffering(id, p.onProcessData);
    disposables.add(p.onProcessExit((exitCode) => this._onProcessExit(id, exitCode)));
    this._terminalProcesses.set(id, p);
    const awaitingStart = this._extensionTerminalAwaitingStart[id];
    if (awaitingStart && p instanceof ExtHostPseudoterminal) {
      p.startSendingEvents(awaitingStart.initialDimensions);
      delete this._extensionTerminalAwaitingStart[id];
    }
    return disposables;
  }
  $acceptProcessAckDataEvent(id, charCount) {
    this._terminalProcesses.get(id)?.acknowledgeDataEvent(charCount);
  }
  $acceptProcessInput(id, data) {
    this._terminalProcesses.get(id)?.input(data);
  }
  $acceptTerminalInteraction(id) {
    const terminal = this.getTerminalById(id);
    if (terminal?.setInteractedWith()) {
      this._onDidChangeTerminalState.fire(terminal.value);
    }
  }
  $acceptTerminalSelection(id, selection) {
    this.getTerminalById(id)?.setSelection(selection);
  }
  $acceptProcessResize(id, cols, rows) {
    try {
      this._terminalProcesses.get(id)?.resize(cols, rows);
    } catch (error) {
      if (error.code !== "EPIPE" && error.code !== "ERR_IPC_CHANNEL_CLOSED") {
        throw error;
      }
    }
  }
  $acceptProcessShutdown(id, immediate) {
    this._terminalProcesses.get(id)?.shutdown(immediate);
  }
  $acceptProcessRequestInitialCwd(id) {
    this._terminalProcesses.get(id)?.getInitialCwd().then((initialCwd) => this._proxy.$sendProcessProperty(id, { type: ProcessPropertyType.InitialCwd, value: initialCwd }));
  }
  $acceptProcessRequestCwd(id) {
    this._terminalProcesses.get(id)?.getCwd().then((cwd) => this._proxy.$sendProcessProperty(id, { type: ProcessPropertyType.Cwd, value: cwd }));
  }
  $acceptProcessRequestLatency(id) {
    return Promise.resolve(id);
  }
  registerProfileProvider(extension, id, provider) {
    if (this._profileProviders.has(id)) {
      throw new Error(`Terminal profile provider "${id}" already registered`);
    }
    this._profileProviders.set(id, provider);
    this._proxy.$registerProfileProvider(id, extension.identifier.value);
    return new VSCodeDisposable(() => {
      this._profileProviders.delete(id);
      this._proxy.$unregisterProfileProvider(id);
    });
  }
  registerTerminalCompletionProvider(extension, provider, ...triggerCharacters) {
    if (this._completionProviders.has(provider.id)) {
      throw new Error(`Terminal completion provider "${provider.id}" already registered`);
    }
    this._completionProviders.set(provider.id, provider);
    this._proxy.$registerCompletionProvider(provider.id, extension.identifier.value, ...triggerCharacters);
    return new VSCodeDisposable(() => {
      this._completionProviders.delete(provider.id);
      this._proxy.$unregisterCompletionProvider(provider.id);
    });
  }
  async $provideTerminalCompletions(id, options) {
    const token = new CancellationTokenSource().token;
    if (token.isCancellationRequested || !this.activeTerminal) {
      return void 0;
    }
    const provider = this._completionProviders.get(id);
    if (!provider) {
      return;
    }
    const completions = await provider.provideTerminalCompletions(this.activeTerminal, options, token);
    if (completions === null || completions === void 0) {
      return void 0;
    }
    return TerminalCompletionList.from(completions);
  }
  $acceptTerminalShellType(id, shellType) {
    const terminal = this.getTerminalById(id);
    if (terminal?.setShellType(shellType)) {
      this._onDidChangeTerminalState.fire(terminal.value);
    }
  }
  registerTerminalQuickFixProvider(id, extensionId, provider) {
    if (this._quickFixProviders.has(id)) {
      throw new Error(`Terminal quick fix provider "${id}" is already registered`);
    }
    this._quickFixProviders.set(id, provider);
    this._proxy.$registerQuickFixProvider(id, extensionId);
    return new VSCodeDisposable(() => {
      this._quickFixProviders.delete(id);
      this._proxy.$unregisterQuickFixProvider(id);
    });
  }
  async $provideTerminalQuickFixes(id, matchResult) {
    const token = new CancellationTokenSource().token;
    if (token.isCancellationRequested) {
      return;
    }
    const provider = this._quickFixProviders.get(id);
    if (!provider) {
      return;
    }
    const quickFixes = await provider.provideTerminalQuickFixes(matchResult, token);
    if (quickFixes === null || Array.isArray(quickFixes) && quickFixes.length === 0) {
      return void 0;
    }
    const store = new DisposableStore();
    this._lastQuickFixCommands.value = store;
    if (!Array.isArray(quickFixes)) {
      return quickFixes ? TerminalQuickFix.from(quickFixes, this._extHostCommands.converter, store) : void 0;
    }
    const result = [];
    for (const fix of quickFixes) {
      const converted = TerminalQuickFix.from(fix, this._extHostCommands.converter, store);
      if (converted) {
        result.push(converted);
      }
    }
    return result;
  }
  async $createContributedProfileTerminal(id, options) {
    const token = new CancellationTokenSource().token;
    let profile = await this._profileProviders.get(id)?.provideTerminalProfile(token);
    if (token.isCancellationRequested) {
      return;
    }
    if (profile && !("options" in profile)) {
      profile = { options: profile };
    }
    if (!profile || !("options" in profile)) {
      throw new Error(`No terminal profile options provided for id "${id}"`);
    }
    if ("pty" in profile.options) {
      this.createExtensionTerminal(profile.options, options);
      return;
    }
    this.createTerminalFromOptions(profile.options, options);
  }
  registerLinkProvider(provider) {
    this._linkProviders.add(provider);
    if (this._linkProviders.size === 1) {
      this._proxy.$startLinkProvider();
    }
    return new VSCodeDisposable(() => {
      this._linkProviders.delete(provider);
      if (this._linkProviders.size === 0) {
        this._proxy.$stopLinkProvider();
      }
    });
  }
  async $provideLinks(terminalId, line) {
    const terminal = this.getTerminalById(terminalId);
    if (!terminal) {
      return [];
    }
    this._terminalLinkCache.delete(terminalId);
    const oldToken = this._terminalLinkCancellationSource.get(terminalId);
    oldToken?.dispose(true);
    const cancellationSource = new CancellationTokenSource();
    this._terminalLinkCancellationSource.set(terminalId, cancellationSource);
    const result = [];
    const context = { terminal: terminal.value, line };
    const promises = [];
    for (const provider of this._linkProviders) {
      promises.push(Promises.withAsyncBody(async (r) => {
        cancellationSource.token.onCancellationRequested(() => r({ provider, links: [] }));
        const links = await provider.provideTerminalLinks(context, cancellationSource.token) || [];
        if (!cancellationSource.token.isCancellationRequested) {
          r({ provider, links });
        }
      }));
    }
    const provideResults = await Promise.all(promises);
    if (cancellationSource.token.isCancellationRequested) {
      return [];
    }
    const cacheLinkMap = /* @__PURE__ */ new Map();
    for (const provideResult of provideResults) {
      if (provideResult && provideResult.links.length > 0) {
        result.push(...provideResult.links.map((providerLink) => {
          const link = {
            id: nextLinkId++,
            startIndex: providerLink.startIndex,
            length: providerLink.length,
            label: providerLink.tooltip
          };
          cacheLinkMap.set(link.id, {
            provider: provideResult.provider,
            link: providerLink
          });
          return link;
        }));
      }
    }
    this._terminalLinkCache.set(terminalId, cacheLinkMap);
    return result;
  }
  $activateLink(terminalId, linkId) {
    const cachedLink = this._terminalLinkCache.get(terminalId)?.get(linkId);
    if (!cachedLink) {
      return;
    }
    cachedLink.provider.handleTerminalLink(cachedLink.link);
  }
  _onProcessExit(id, exitCode) {
    this._bufferer.stopBuffering(id);
    this._terminalProcesses.delete(id);
    delete this._extensionTerminalAwaitingStart[id];
    const processDiposable = this._terminalProcessDisposables[id];
    if (processDiposable) {
      processDiposable.dispose();
      delete this._terminalProcessDisposables[id];
    }
    this._proxy.$sendProcessExit(id, exitCode);
  }
  getTerminalById(id) {
    return this._getTerminalObjectById(this._terminals, id);
  }
  getTerminalIdByApiObject(terminal) {
    const index = this._terminals.findIndex((item) => {
      return item.value === terminal;
    });
    return index >= 0 ? index : null;
  }
  _getTerminalObjectById(array, id) {
    const index = this._getTerminalObjectIndexById(array, id);
    return index !== null ? array[index] : null;
  }
  _getTerminalObjectIndexById(array, id) {
    const index = array.findIndex((item) => {
      return item._id === id;
    });
    return index >= 0 ? index : null;
  }
  getEnvironmentVariableCollection(extension) {
    let collection = this._environmentVariableCollections.get(extension.identifier.value);
    if (!collection) {
      collection = this._register(new UnifiedEnvironmentVariableCollection());
      this._setEnvironmentVariableCollection(extension.identifier.value, collection);
    }
    return collection.getScopedEnvironmentVariableCollection(void 0);
  }
  _syncEnvironmentVariableCollection(extensionIdentifier, collection) {
    const serialized = serializeEnvironmentVariableCollection(collection.map);
    const serializedDescription = serializeEnvironmentDescriptionMap(collection.descriptionMap);
    this._proxy.$setEnvironmentVariableCollection(extensionIdentifier, collection.persistent, serialized.length === 0 ? void 0 : serialized, serializedDescription);
  }
  $initEnvironmentVariableCollections(collections) {
    collections.forEach((entry) => {
      const extensionIdentifier = entry[0];
      const collection = this._register(new UnifiedEnvironmentVariableCollection(entry[1]));
      this._setEnvironmentVariableCollection(extensionIdentifier, collection);
    });
  }
  $acceptDefaultProfile(profile, automationProfile) {
    const oldProfile = this._defaultProfile;
    this._defaultProfile = profile;
    this._defaultAutomationProfile = automationProfile;
    if (oldProfile?.path !== profile.path) {
      this._onDidChangeShell.fire(profile.path);
    }
  }
  _setEnvironmentVariableCollection(extensionIdentifier, collection) {
    this._environmentVariableCollections.set(extensionIdentifier, collection);
    this._register(collection.onDidChangeCollection(() => {
      this._syncEnvironmentVariableCollection(extensionIdentifier, collection);
    }));
  }
};
BaseExtHostTerminalService = __decorateClass([
  __decorateParam(1, IExtHostCommands),
  __decorateParam(2, IExtHostRpcService)
], BaseExtHostTerminalService);
class UnifiedEnvironmentVariableCollection extends Disposable {
  constructor(serialized) {
    super();
    this.map = /* @__PURE__ */ new Map();
    this.scopedCollections = /* @__PURE__ */ new Map();
    this.descriptionMap = /* @__PURE__ */ new Map();
    this._persistent = true;
    this._onDidChangeCollection = new Emitter();
    this.map = new Map(serialized);
  }
  get persistent() {
    return this._persistent;
  }
  set persistent(value) {
    this._persistent = value;
    this._onDidChangeCollection.fire();
  }
  get onDidChangeCollection() {
    return this._onDidChangeCollection && this._onDidChangeCollection.event;
  }
  getScopedEnvironmentVariableCollection(scope) {
    const scopedCollectionKey = this.getScopeKey(scope);
    let scopedCollection = this.scopedCollections.get(scopedCollectionKey);
    if (!scopedCollection) {
      scopedCollection = new ScopedEnvironmentVariableCollection(this, scope);
      this.scopedCollections.set(scopedCollectionKey, scopedCollection);
      this._register(scopedCollection.onDidChangeCollection(() => this._onDidChangeCollection.fire()));
    }
    return scopedCollection;
  }
  replace(variable, value, options, scope) {
    this._setIfDiffers(variable, { value, type: EnvironmentVariableMutatorType.Replace, options: options ?? { applyAtProcessCreation: true }, scope });
  }
  append(variable, value, options, scope) {
    this._setIfDiffers(variable, { value, type: EnvironmentVariableMutatorType.Append, options: options ?? { applyAtProcessCreation: true }, scope });
  }
  prepend(variable, value, options, scope) {
    this._setIfDiffers(variable, { value, type: EnvironmentVariableMutatorType.Prepend, options: options ?? { applyAtProcessCreation: true }, scope });
  }
  _setIfDiffers(variable, mutator) {
    if (mutator.options && mutator.options.applyAtProcessCreation === false && !mutator.options.applyAtShellIntegration) {
      throw new Error("EnvironmentVariableMutatorOptions must apply at either process creation or shell integration");
    }
    const key = this.getKey(variable, mutator.scope);
    const current = this.map.get(key);
    const newOptions = mutator.options ? {
      applyAtProcessCreation: mutator.options.applyAtProcessCreation ?? false,
      applyAtShellIntegration: mutator.options.applyAtShellIntegration ?? false
    } : {
      applyAtProcessCreation: true
    };
    if (!current || current.value !== mutator.value || current.type !== mutator.type || current.options?.applyAtProcessCreation !== newOptions.applyAtProcessCreation || current.options?.applyAtShellIntegration !== newOptions.applyAtShellIntegration || current.scope?.workspaceFolder?.index !== mutator.scope?.workspaceFolder?.index) {
      const key2 = this.getKey(variable, mutator.scope);
      const value = {
        variable,
        ...mutator,
        options: newOptions
      };
      this.map.set(key2, value);
      this._onDidChangeCollection.fire();
    }
  }
  get(variable, scope) {
    const key = this.getKey(variable, scope);
    const value = this.map.get(key);
    return value ? convertMutator(value) : void 0;
  }
  getKey(variable, scope) {
    const scopeKey = this.getScopeKey(scope);
    return scopeKey.length ? `${variable}:::${scopeKey}` : variable;
  }
  getScopeKey(scope) {
    return this.getWorkspaceKey(scope?.workspaceFolder) ?? "";
  }
  getWorkspaceKey(workspaceFolder) {
    return workspaceFolder ? workspaceFolder.uri.toString() : void 0;
  }
  getVariableMap(scope) {
    const map = /* @__PURE__ */ new Map();
    for (const [_, value] of this.map) {
      if (this.getScopeKey(value.scope) === this.getScopeKey(scope)) {
        map.set(value.variable, convertMutator(value));
      }
    }
    return map;
  }
  delete(variable, scope) {
    const key = this.getKey(variable, scope);
    this.map.delete(key);
    this._onDidChangeCollection.fire();
  }
  clear(scope) {
    if (scope?.workspaceFolder) {
      for (const [key, mutator] of this.map) {
        if (mutator.scope?.workspaceFolder?.index === scope.workspaceFolder.index) {
          this.map.delete(key);
        }
      }
      this.clearDescription(scope);
    } else {
      this.map.clear();
      this.descriptionMap.clear();
    }
    this._onDidChangeCollection.fire();
  }
  setDescription(description, scope) {
    const key = this.getScopeKey(scope);
    const current = this.descriptionMap.get(key);
    if (!current || current.description !== description) {
      let descriptionStr;
      if (typeof description === "string") {
        descriptionStr = description;
      } else {
        descriptionStr = description?.value.split("\n\n")[0];
      }
      const value = { description: descriptionStr, scope };
      this.descriptionMap.set(key, value);
      this._onDidChangeCollection.fire();
    }
  }
  getDescription(scope) {
    const key = this.getScopeKey(scope);
    return this.descriptionMap.get(key)?.description;
  }
  clearDescription(scope) {
    const key = this.getScopeKey(scope);
    this.descriptionMap.delete(key);
  }
}
class ScopedEnvironmentVariableCollection {
  constructor(collection, scope) {
    this.collection = collection;
    this.scope = scope;
    this._onDidChangeCollection = new Emitter();
  }
  get persistent() {
    return this.collection.persistent;
  }
  set persistent(value) {
    this.collection.persistent = value;
  }
  get onDidChangeCollection() {
    return this._onDidChangeCollection && this._onDidChangeCollection.event;
  }
  getScoped(scope) {
    return this.collection.getScopedEnvironmentVariableCollection(scope);
  }
  replace(variable, value, options) {
    this.collection.replace(variable, value, options, this.scope);
  }
  append(variable, value, options) {
    this.collection.append(variable, value, options, this.scope);
  }
  prepend(variable, value, options) {
    this.collection.prepend(variable, value, options, this.scope);
  }
  get(variable) {
    return this.collection.get(variable, this.scope);
  }
  forEach(callback, thisArg) {
    this.collection.getVariableMap(this.scope).forEach((value, variable) => callback.call(thisArg, variable, value, this), this.scope);
  }
  [Symbol.iterator]() {
    return this.collection.getVariableMap(this.scope).entries();
  }
  delete(variable) {
    this.collection.delete(variable, this.scope);
    this._onDidChangeCollection.fire(void 0);
  }
  clear() {
    this.collection.clear(this.scope);
  }
  set description(description) {
    this.collection.setDescription(description, this.scope);
  }
  get description() {
    return this.collection.getDescription(this.scope);
  }
}
let WorkerExtHostTerminalService = class extends BaseExtHostTerminalService {
  constructor(extHostCommands, extHostRpc) {
    super(false, extHostCommands, extHostRpc);
  }
  createTerminal(name, shellPath, shellArgs) {
    throw new NotSupportedError();
  }
  createTerminalFromOptions(options, internalOptions) {
    throw new NotSupportedError();
  }
};
WorkerExtHostTerminalService = __decorateClass([
  __decorateParam(0, IExtHostCommands),
  __decorateParam(1, IExtHostRpcService)
], WorkerExtHostTerminalService);
function asTerminalIcon(iconPath) {
  if (!iconPath || typeof iconPath === "string") {
    return void 0;
  }
  if (!("id" in iconPath)) {
    return iconPath;
  }
  return {
    id: iconPath.id,
    color: iconPath.color
  };
}
function asTerminalColor(color) {
  return ThemeColor.isThemeColor(color) ? color : void 0;
}
function convertMutator(mutator) {
  const newMutator = { ...mutator };
  delete newMutator.scope;
  newMutator.options = newMutator.options ?? void 0;
  delete newMutator.variable;
  return newMutator;
}
export {
  BaseExtHostTerminalService,
  ExtHostTerminal,
  IExtHostTerminalService,
  WorkerExtHostTerminalService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VGVybWluYWxTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRXh0SG9zdFRlcm1pbmFsU2VydmljZVNoYXBlLCBNYWluQ29udGV4dCwgTWFpblRocmVhZFRlcm1pbmFsU2VydmljZVNoYXBlLCBJVGVybWluYWxEaW1lbnNpb25zRHRvLCBJVGVybWluYWxMaW5rRHRvLCBFeHRIb3N0VGVybWluYWxJZGVudGlmaWVyLCBJQ29tbWFuZER0bywgSVRlcm1pbmFsUXVpY2tGaXhPcGVuZXJEdG8sIElUZXJtaW5hbFF1aWNrRml4VGVybWluYWxDb21tYW5kRHRvLCBUZXJtaW5hbENvbW1hbmRNYXRjaFJlc3VsdER0bywgSVRlcm1pbmFsQ29tbWFuZER0bywgSVRlcm1pbmFsQ29tcGxldGlvbkNvbnRleHREdG8sIFRlcm1pbmFsQ29tcGxldGlvbkxpc3REdG8gfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RScGNTZXJ2aWNlIH0gZnJvbSAnLi9leHRIb3N0UnBjU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIGFzIFZTQ29kZURpc3Bvc2FibGUsIEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZSwgVGVybWluYWxFeGl0UmVhc29uLCBUZXJtaW5hbENvbXBsZXRpb25JdGVtIH0gZnJvbSAnLi9leHRIb3N0VHlwZXMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBOb3RTdXBwb3J0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBzZXJpYWxpemVFbnZpcm9ubWVudERlc2NyaXB0aW9uTWFwLCBzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9lbnZpcm9ubWVudFZhcmlhYmxlU2hhcmVkLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uRGVzY3JpcHRpb24sIElFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvciwgSVNlcmlhbGl6YWJsZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2Vudmlyb25tZW50VmFyaWFibGUuanMnO1xuaW1wb3J0IHsgSUNyZWF0ZUNvbnRyaWJ1dGVkVGVybWluYWxQcm9maWxlT3B0aW9ucywgSVByb2Nlc3NSZWFkeUV2ZW50LCBJU2hlbGxMYXVuY2hDb25maWdEdG8sIElUZXJtaW5hbENoaWxkUHJvY2VzcywgSVRlcm1pbmFsTGF1bmNoRXJyb3IsIElUZXJtaW5hbFByb2ZpbGUsIFRlcm1pbmFsSWNvbiwgVGVybWluYWxMb2NhdGlvbiwgSVByb2Nlc3NQcm9wZXJ0eSwgUHJvY2Vzc1Byb3BlcnR5VHlwZSwgSVByb2Nlc3NQcm9wZXJ0eU1hcCwgVGVybWluYWxTaGVsbFR5cGUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxEYXRhQnVmZmVyZXIgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxEYXRhQnVmZmVyaW5nLmpzJztcbmltcG9ydCB7IFRoZW1lQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgUHJvbWlzZXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JHcm91cENvbHVtbiB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBDb2x1bW4uanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb21wbGV0aW9uTGlzdCwgVGVybWluYWxRdWlja0ZpeCwgVmlld0NvbHVtbiB9IGZyb20gJy4vZXh0SG9zdFR5cGVDb252ZXJ0ZXJzLmpzJztcbmltcG9ydCB7IElFeHRIb3N0Q29tbWFuZHMgfSBmcm9tICcuL2V4dEhvc3RDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBNYXJzaGFsbGVkSWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZ0lkcy5qcyc7XG5pbXBvcnQgeyBJU2VyaWFsaXplZFRlcm1pbmFsSW5zdGFuY2VDb250ZXh0IH0gZnJvbSAnLi4vLi4vY29udHJpYi90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElFeHRIb3N0VGVybWluYWxTZXJ2aWNlIGV4dGVuZHMgRXh0SG9zdFRlcm1pbmFsU2VydmljZVNoYXBlLCBJRGlzcG9zYWJsZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGFjdGl2ZVRlcm1pbmFsOiB2c2NvZGUuVGVybWluYWwgfCB1bmRlZmluZWQ7XG5cdHRlcm1pbmFsczogdnNjb2RlLlRlcm1pbmFsW107XG5cblx0cmVhZG9ubHkgb25EaWRDbG9zZVRlcm1pbmFsOiBFdmVudDx2c2NvZGUuVGVybWluYWw+O1xuXHRyZWFkb25seSBvbkRpZE9wZW5UZXJtaW5hbDogRXZlbnQ8dnNjb2RlLlRlcm1pbmFsPjtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVUZXJtaW5hbDogRXZlbnQ8dnNjb2RlLlRlcm1pbmFsIHwgdW5kZWZpbmVkPjtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VUZXJtaW5hbERpbWVuc2lvbnM6IEV2ZW50PHZzY29kZS5UZXJtaW5hbERpbWVuc2lvbnNDaGFuZ2VFdmVudD47XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVGVybWluYWxTdGF0ZTogRXZlbnQ8dnNjb2RlLlRlcm1pbmFsPjtcblx0cmVhZG9ubHkgb25EaWRXcml0ZVRlcm1pbmFsRGF0YTogRXZlbnQ8dnNjb2RlLlRlcm1pbmFsRGF0YVdyaXRlRXZlbnQ+O1xuXHRyZWFkb25seSBvbkRpZEV4ZWN1dGVUZXJtaW5hbENvbW1hbmQ6IEV2ZW50PHZzY29kZS5UZXJtaW5hbEV4ZWN1dGVkQ29tbWFuZD47XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2hlbGw6IEV2ZW50PHN0cmluZz47XG5cblx0Y3JlYXRlVGVybWluYWwobmFtZT86IHN0cmluZywgc2hlbGxQYXRoPzogc3RyaW5nLCBzaGVsbEFyZ3M/OiByZWFkb25seSBzdHJpbmdbXSB8IHN0cmluZyk6IHZzY29kZS5UZXJtaW5hbDtcblx0Y3JlYXRlVGVybWluYWxGcm9tT3B0aW9ucyhvcHRpb25zOiB2c2NvZGUuVGVybWluYWxPcHRpb25zLCBpbnRlcm5hbE9wdGlvbnM/OiBJVGVybWluYWxJbnRlcm5hbE9wdGlvbnMpOiB2c2NvZGUuVGVybWluYWw7XG5cdGNyZWF0ZUV4dGVuc2lvblRlcm1pbmFsKG9wdGlvbnM6IHZzY29kZS5FeHRlbnNpb25UZXJtaW5hbE9wdGlvbnMpOiB2c2NvZGUuVGVybWluYWw7XG5cdGF0dGFjaFB0eVRvVGVybWluYWwoaWQ6IG51bWJlciwgcHR5OiB2c2NvZGUuUHNldWRvdGVybWluYWwpOiB2b2lkO1xuXHRnZXREZWZhdWx0U2hlbGwodXNlQXV0b21hdGlvblNoZWxsOiBib29sZWFuKTogc3RyaW5nO1xuXHRnZXREZWZhdWx0U2hlbGxBcmdzKHVzZUF1dG9tYXRpb25TaGVsbDogYm9vbGVhbik6IHN0cmluZ1tdIHwgc3RyaW5nO1xuXHRyZWdpc3RlckxpbmtQcm92aWRlcihwcm92aWRlcjogdnNjb2RlLlRlcm1pbmFsTGlua1Byb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGU7XG5cdHJlZ2lzdGVyUHJvZmlsZVByb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBpZDogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLlRlcm1pbmFsUHJvZmlsZVByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGU7XG5cdHJlZ2lzdGVyVGVybWluYWxRdWlja0ZpeFByb3ZpZGVyKGlkOiBzdHJpbmcsIGV4dGVuc2lvbklkOiBzdHJpbmcsIHByb3ZpZGVyOiB2c2NvZGUuVGVybWluYWxRdWlja0ZpeFByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGU7XG5cdGdldEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogSUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uO1xuXHRnZXRUZXJtaW5hbEJ5SWQoaWQ6IG51bWJlcik6IEV4dEhvc3RUZXJtaW5hbCB8IG51bGw7XG5cdGdldFRlcm1pbmFsSWRCeUFwaU9iamVjdChhcGlUZXJtaW5hbDogdnNjb2RlLlRlcm1pbmFsKTogbnVtYmVyIHwgbnVsbDtcblx0cmVnaXN0ZXJUZXJtaW5hbENvbXBsZXRpb25Qcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgcHJvdmlkZXI6IHZzY29kZS5UZXJtaW5hbENvbXBsZXRpb25Qcm92aWRlcjx2c2NvZGUuVGVybWluYWxDb21wbGV0aW9uSXRlbT4sIC4uLnRyaWdnZXJDaGFyYWN0ZXJzOiBzdHJpbmdbXSk6IHZzY29kZS5EaXNwb3NhYmxlO1xufVxuXG5pbnRlcmZhY2UgSUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uIGV4dGVuZHMgdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uIHtcblx0Z2V0U2NvcGVkKHNjb3BlOiB2c2NvZGUuRW52aXJvbm1lbnRWYXJpYWJsZVNjb3BlKTogdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUZXJtaW5hbEludGVybmFsT3B0aW9ucyB7XG5cdGN3ZD86IHN0cmluZyB8IFVSSTtcblx0aXNGZWF0dXJlVGVybWluYWw/OiBib29sZWFuO1xuXHRmb3JjZVNoZWxsSW50ZWdyYXRpb24/OiBib29sZWFuO1xuXHR1c2VTaGVsbEVudmlyb25tZW50PzogYm9vbGVhbjtcblx0cmVzb2x2ZWRFeHRIb3N0SWRlbnRpZmllcj86IEV4dEhvc3RUZXJtaW5hbElkZW50aWZpZXI7XG5cdC8qKlxuXHQgKiBUaGlzIGxvY2F0aW9uIGlzIGRpZmZlcmVudCBmcm9tIHRoZSBBUEkgbG9jYXRpb24gYmVjYXVzZSBpdCBjYW4gaW5jbHVkZSBzcGxpdEFjdGl2ZVRlcm1pbmFsLFxuXHQgKiBhIHByb3BlcnR5IHdlIHJlc29sdmUgaW50ZXJuYWxseVxuXHQgKi9cblx0bG9jYXRpb24/OiBUZXJtaW5hbExvY2F0aW9uIHwgeyB2aWV3Q29sdW1uOiBudW1iZXI7IHByZXNlcnZlU3RhdGU/OiBib29sZWFuIH0gfCB7IHNwbGl0QWN0aXZlVGVybWluYWw6IGJvb2xlYW4gfTtcbn1cblxuZXhwb3J0IGNvbnN0IElFeHRIb3N0VGVybWluYWxTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElFeHRIb3N0VGVybWluYWxTZXJ2aWNlPignSUV4dEhvc3RUZXJtaW5hbFNlcnZpY2UnKTtcblxuZXhwb3J0IGNsYXNzIEV4dEhvc3RUZXJtaW5hbCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIF9kaXNwb3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9waWRQcm9taXNlOiBQcm9taXNlPG51bWJlciB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgX2NvbHM6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfcGlkUHJvbWlzZUNvbXBsZXRlOiAoKHZhbHVlOiBudW1iZXIgfCB1bmRlZmluZWQpID0+IGFueSkgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3Jvd3M6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZXhpdFN0YXR1czogdnNjb2RlLlRlcm1pbmFsRXhpdFN0YXR1cyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfc3RhdGU6IHZzY29kZS5UZXJtaW5hbFN0YXRlID0geyBpc0ludGVyYWN0ZWRXaXRoOiBmYWxzZSwgc2hlbGw6IHVuZGVmaW5lZCB9O1xuXHRwcml2YXRlIF9zZWxlY3Rpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRzaGVsbEludGVncmF0aW9uOiB2c2NvZGUuVGVybWluYWxTaGVsbEludGVncmF0aW9uIHwgdW5kZWZpbmVkO1xuXG5cdHB1YmxpYyBpc09wZW46IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRyZWFkb25seSB2YWx1ZTogdnNjb2RlLlRlcm1pbmFsO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25XaWxsRGlzcG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxEaXNwb3NlID0gdGhpcy5fb25XaWxsRGlzcG9zZS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIF9wcm94eTogTWFpblRocmVhZFRlcm1pbmFsU2VydmljZVNoYXBlLFxuXHRcdHB1YmxpYyBfaWQ6IEV4dEhvc3RUZXJtaW5hbElkZW50aWZpZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY3JlYXRpb25PcHRpb25zOiB2c2NvZGUuVGVybWluYWxPcHRpb25zIHwgdnNjb2RlLkV4dGVuc2lvblRlcm1pbmFsT3B0aW9ucyxcblx0XHRwcml2YXRlIF9uYW1lPzogc3RyaW5nLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fY3JlYXRpb25PcHRpb25zID0gT2JqZWN0LmZyZWV6ZSh0aGlzLl9jcmVhdGlvbk9wdGlvbnMpO1xuXHRcdHRoaXMuX3BpZFByb21pc2UgPSBuZXcgUHJvbWlzZTxudW1iZXIgfCB1bmRlZmluZWQ+KGMgPT4gdGhpcy5fcGlkUHJvbWlzZUNvbXBsZXRlID0gYyk7XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLnZhbHVlID0ge1xuXHRcdFx0Z2V0IG5hbWUoKTogc3RyaW5nIHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX25hbWUgfHwgJyc7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHByb2Nlc3NJZCgpOiBQcm9taXNlPG51bWJlciB8IHVuZGVmaW5lZD4ge1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5fcGlkUHJvbWlzZTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgY3JlYXRpb25PcHRpb25zKCk6IFJlYWRvbmx5PHZzY29kZS5UZXJtaW5hbE9wdGlvbnMgfCB2c2NvZGUuRXh0ZW5zaW9uVGVybWluYWxPcHRpb25zPiB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9jcmVhdGlvbk9wdGlvbnM7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IGV4aXRTdGF0dXMoKTogdnNjb2RlLlRlcm1pbmFsRXhpdFN0YXR1cyB8IHVuZGVmaW5lZCB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9leGl0U3RhdHVzO1xuXHRcdFx0fSxcblx0XHRcdGdldCBzdGF0ZSgpOiB2c2NvZGUuVGVybWluYWxTdGF0ZSB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9zdGF0ZTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgc2VsZWN0aW9uKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9zZWxlY3Rpb247XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHNoZWxsSW50ZWdyYXRpb24oKTogdnNjb2RlLlRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0XHRcdHJldHVybiB0aGF0LnNoZWxsSW50ZWdyYXRpb247XG5cdFx0XHR9LFxuXHRcdFx0c2VuZFRleHQodGV4dDogc3RyaW5nLCBzaG91bGRFeGVjdXRlOiBib29sZWFuID0gdHJ1ZSk6IHZvaWQge1xuXHRcdFx0XHR0aGF0Ll9jaGVja0Rpc3Bvc2VkKCk7XG5cdFx0XHRcdHRoYXQuX3Byb3h5LiRzZW5kVGV4dCh0aGF0Ll9pZCwgdGV4dCwgc2hvdWxkRXhlY3V0ZSk7XG5cdFx0XHR9LFxuXHRcdFx0c2hvdyhwcmVzZXJ2ZUZvY3VzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0XHRcdHRoYXQuX2NoZWNrRGlzcG9zZWQoKTtcblx0XHRcdFx0dGhhdC5fcHJveHkuJHNob3codGhhdC5faWQsIHByZXNlcnZlRm9jdXMpO1xuXHRcdFx0fSxcblx0XHRcdGhpZGUoKTogdm9pZCB7XG5cdFx0XHRcdHRoYXQuX2NoZWNrRGlzcG9zZWQoKTtcblx0XHRcdFx0dGhhdC5fcHJveHkuJGhpZGUodGhhdC5faWQpO1xuXHRcdFx0fSxcblx0XHRcdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0XHRcdGlmICghdGhhdC5fZGlzcG9zZWQpIHtcblx0XHRcdFx0XHR0aGF0Ll9kaXNwb3NlZCA9IHRydWU7XG5cdFx0XHRcdFx0dGhhdC5fcHJveHkuJGRpc3Bvc2UodGhhdC5faWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IGRpbWVuc2lvbnMoKTogdnNjb2RlLlRlcm1pbmFsRGltZW5zaW9ucyB8IHVuZGVmaW5lZCB7XG5cdFx0XHRcdGlmICh0aGF0Ll9jb2xzID09PSB1bmRlZmluZWQgfHwgdGhhdC5fcm93cyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGNvbHVtbnM6IHRoYXQuX2NvbHMsXG5cdFx0XHRcdFx0cm93czogdGhhdC5fcm93c1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX29uV2lsbERpc3Bvc2UuZmlyZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBjcmVhdGUoXG5cdFx0b3B0aW9uczogdnNjb2RlLlRlcm1pbmFsT3B0aW9ucyxcblx0XHRpbnRlcm5hbE9wdGlvbnM/OiBJVGVybWluYWxJbnRlcm5hbE9wdGlvbnMsXG5cdCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5faWQgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Rlcm1pbmFsIGhhcyBhbHJlYWR5IGJlZW4gY3JlYXRlZCcpO1xuXHRcdH1cblx0XHRhd2FpdCB0aGlzLl9wcm94eS4kY3JlYXRlVGVybWluYWwodGhpcy5faWQsIHtcblx0XHRcdG5hbWU6IG9wdGlvbnMubmFtZSxcblx0XHRcdHNoZWxsUGF0aDogb3B0aW9ucy5zaGVsbFBhdGggPz8gdW5kZWZpbmVkLFxuXHRcdFx0c2hlbGxBcmdzOiBvcHRpb25zLnNoZWxsQXJncyA/PyB1bmRlZmluZWQsXG5cdFx0XHRjd2Q6IG9wdGlvbnMuY3dkID8/IGludGVybmFsT3B0aW9ucz8uY3dkID8/IHVuZGVmaW5lZCxcblx0XHRcdGVudjogb3B0aW9ucy5lbnYgPz8gdW5kZWZpbmVkLFxuXHRcdFx0aWNvbjogYXNUZXJtaW5hbEljb24ob3B0aW9ucy5pY29uUGF0aCkgPz8gdW5kZWZpbmVkLFxuXHRcdFx0Y29sb3I6IFRoZW1lQ29sb3IuaXNUaGVtZUNvbG9yKG9wdGlvbnMuY29sb3IpID8gb3B0aW9ucy5jb2xvci5pZCA6IHVuZGVmaW5lZCxcblx0XHRcdGluaXRpYWxUZXh0OiBvcHRpb25zLm1lc3NhZ2UgPz8gdW5kZWZpbmVkLFxuXHRcdFx0c3RyaWN0RW52OiBvcHRpb25zLnN0cmljdEVudiA/PyB1bmRlZmluZWQsXG5cdFx0XHRoaWRlRnJvbVVzZXI6IG9wdGlvbnMuaGlkZUZyb21Vc2VyID8/IHVuZGVmaW5lZCxcblx0XHRcdGZvcmNlU2hlbGxJbnRlZ3JhdGlvbjogaW50ZXJuYWxPcHRpb25zPy5mb3JjZVNoZWxsSW50ZWdyYXRpb24gPz8gdW5kZWZpbmVkLFxuXHRcdFx0aXNGZWF0dXJlVGVybWluYWw6IGludGVybmFsT3B0aW9ucz8uaXNGZWF0dXJlVGVybWluYWwgPz8gdW5kZWZpbmVkLFxuXHRcdFx0aXNFeHRlbnNpb25Pd25lZFRlcm1pbmFsOiB0cnVlLFxuXHRcdFx0dXNlU2hlbGxFbnZpcm9ubWVudDogaW50ZXJuYWxPcHRpb25zPy51c2VTaGVsbEVudmlyb25tZW50ID8/IHVuZGVmaW5lZCxcblx0XHRcdGxvY2F0aW9uOiBpbnRlcm5hbE9wdGlvbnM/LmxvY2F0aW9uIHx8IHRoaXMuX3NlcmlhbGl6ZVBhcmVudFRlcm1pbmFsKG9wdGlvbnMubG9jYXRpb24sIGludGVybmFsT3B0aW9ucz8ucmVzb2x2ZWRFeHRIb3N0SWRlbnRpZmllciksXG5cdFx0XHRpc1RyYW5zaWVudDogb3B0aW9ucy5pc1RyYW5zaWVudCA/PyB1bmRlZmluZWQsXG5cdFx0fSk7XG5cdH1cblxuXG5cdHB1YmxpYyBhc3luYyBjcmVhdGVFeHRlbnNpb25UZXJtaW5hbChsb2NhdGlvbj86IFRlcm1pbmFsTG9jYXRpb24gfCB2c2NvZGUuVGVybWluYWxFZGl0b3JMb2NhdGlvbk9wdGlvbnMgfCB2c2NvZGUuVGVybWluYWxTcGxpdExvY2F0aW9uT3B0aW9ucywgaW50ZXJuYWxPcHRpb25zPzogSVRlcm1pbmFsSW50ZXJuYWxPcHRpb25zLCBwYXJlbnRUZXJtaW5hbD86IEV4dEhvc3RUZXJtaW5hbElkZW50aWZpZXIsIGljb25QYXRoPzogVGVybWluYWxJY29uLCBjb2xvcj86IFRoZW1lQ29sb3IpOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5faWQgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Rlcm1pbmFsIGhhcyBhbHJlYWR5IGJlZW4gY3JlYXRlZCcpO1xuXHRcdH1cblx0XHRhd2FpdCB0aGlzLl9wcm94eS4kY3JlYXRlVGVybWluYWwodGhpcy5faWQsIHtcblx0XHRcdG5hbWU6IHRoaXMuX25hbWUsXG5cdFx0XHRpc0V4dGVuc2lvbkN1c3RvbVB0eVRlcm1pbmFsOiB0cnVlLFxuXHRcdFx0aWNvbjogaWNvblBhdGgsXG5cdFx0XHRjb2xvcjogVGhlbWVDb2xvci5pc1RoZW1lQ29sb3IoY29sb3IpID8gY29sb3IuaWQgOiB1bmRlZmluZWQsXG5cdFx0XHRsb2NhdGlvbjogaW50ZXJuYWxPcHRpb25zPy5sb2NhdGlvbiB8fCB0aGlzLl9zZXJpYWxpemVQYXJlbnRUZXJtaW5hbChsb2NhdGlvbiwgcGFyZW50VGVybWluYWwpLFxuXHRcdFx0aXNUcmFuc2llbnQ6IHRydWVcblx0XHR9KTtcblx0XHQvLyBBdCB0aGlzIHBvaW50LCB0aGUgaWQgaGFzIGJlZW4gc2V0IHZpYSBgJGFjY2VwdFRlcm1pbmFsT3BlbmVkYFxuXHRcdGlmICh0eXBlb2YgdGhpcy5faWQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Rlcm1pbmFsIGNyZWF0aW9uIGZhaWxlZCcpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5faWQ7XG5cdH1cblxuXHRwcml2YXRlIF9zZXJpYWxpemVQYXJlbnRUZXJtaW5hbChsb2NhdGlvbj86IFRlcm1pbmFsTG9jYXRpb24gfCB2c2NvZGUuVGVybWluYWxFZGl0b3JMb2NhdGlvbk9wdGlvbnMgfCB2c2NvZGUuVGVybWluYWxTcGxpdExvY2F0aW9uT3B0aW9ucywgcGFyZW50VGVybWluYWw/OiBFeHRIb3N0VGVybWluYWxJZGVudGlmaWVyKTogVGVybWluYWxMb2NhdGlvbiB8IHsgdmlld0NvbHVtbjogRWRpdG9yR3JvdXBDb2x1bW47IHByZXNlcnZlRm9jdXM/OiBib29sZWFuIH0gfCB7IHBhcmVudFRlcm1pbmFsOiBFeHRIb3N0VGVybWluYWxJZGVudGlmaWVyIH0gfCB1bmRlZmluZWQge1xuXHRcdGlmICh0eXBlb2YgbG9jYXRpb24gPT09ICdvYmplY3QnKSB7XG5cdFx0XHRpZiAoJ3BhcmVudFRlcm1pbmFsJyBpbiBsb2NhdGlvbiAmJiBsb2NhdGlvbi5wYXJlbnRUZXJtaW5hbCAmJiBwYXJlbnRUZXJtaW5hbCkge1xuXHRcdFx0XHRyZXR1cm4geyBwYXJlbnRUZXJtaW5hbCB9O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoJ3ZpZXdDb2x1bW4nIGluIGxvY2F0aW9uKSB7XG5cdFx0XHRcdHJldHVybiB7IHZpZXdDb2x1bW46IFZpZXdDb2x1bW4uZnJvbShsb2NhdGlvbi52aWV3Q29sdW1uKSwgcHJlc2VydmVGb2N1czogbG9jYXRpb24ucHJlc2VydmVGb2N1cyB9O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiBsb2NhdGlvbjtcblx0fVxuXG5cdHByaXZhdGUgX2NoZWNrRGlzcG9zZWQoKSB7XG5cdFx0aWYgKHRoaXMuX2Rpc3Bvc2VkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Rlcm1pbmFsIGhhcyBhbHJlYWR5IGJlZW4gZGlzcG9zZWQnKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc2V0IG5hbWUobmFtZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5fbmFtZSA9IG5hbWU7XG5cdH1cblxuXHRwdWJsaWMgc2V0RXhpdFN0YXR1cyhjb2RlOiBudW1iZXIgfCB1bmRlZmluZWQsIHJlYXNvbjogVGVybWluYWxFeGl0UmVhc29uKSB7XG5cdFx0dGhpcy5fZXhpdFN0YXR1cyA9IE9iamVjdC5mcmVlemUoeyBjb2RlLCByZWFzb24gfSk7XG5cdH1cblxuXHRwdWJsaWMgc2V0RGltZW5zaW9ucyhjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGlmIChjb2xzID09PSB0aGlzLl9jb2xzICYmIHJvd3MgPT09IHRoaXMuX3Jvd3MpIHtcblx0XHRcdC8vIE5vdGhpbmcgY2hhbmdlZFxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoY29scyA9PT0gMCB8fCByb3dzID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHRoaXMuX2NvbHMgPSBjb2xzO1xuXHRcdHRoaXMuX3Jvd3MgPSByb3dzO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIHNldEludGVyYWN0ZWRXaXRoKCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5fc3RhdGUuaXNJbnRlcmFjdGVkV2l0aCkge1xuXHRcdFx0dGhpcy5fc3RhdGUgPSB7XG5cdFx0XHRcdC4uLnRoaXMuX3N0YXRlLFxuXHRcdFx0XHRpc0ludGVyYWN0ZWRXaXRoOiB0cnVlXG5cdFx0XHR9O1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHB1YmxpYyBzZXRTaGVsbFR5cGUoc2hlbGxUeXBlOiBUZXJtaW5hbFNoZWxsVHlwZSB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXG5cdFx0aWYgKHRoaXMuX3N0YXRlLnNoZWxsICE9PSBzaGVsbFR5cGUpIHtcblx0XHRcdHRoaXMuX3N0YXRlID0ge1xuXHRcdFx0XHQuLi50aGlzLl9zdGF0ZSxcblx0XHRcdFx0c2hlbGw6IHNoZWxsVHlwZVxuXHRcdFx0fTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgc2V0U2VsZWN0aW9uKHNlbGVjdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fc2VsZWN0aW9uID0gc2VsZWN0aW9uO1xuXHR9XG5cblx0cHVibGljIF9zZXRQcm9jZXNzSWQocHJvY2Vzc0lkOiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHQvLyBUaGUgZXZlbnQgbWF5IGZpcmUgMiB0aW1lcyB3aGVuIHRoZSBwYW5lbCBpcyByZXN0b3JlZFxuXHRcdGlmICh0aGlzLl9waWRQcm9taXNlQ29tcGxldGUpIHtcblx0XHRcdHRoaXMuX3BpZFByb21pc2VDb21wbGV0ZShwcm9jZXNzSWQpO1xuXHRcdFx0dGhpcy5fcGlkUHJvbWlzZUNvbXBsZXRlID0gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBSZWNyZWF0ZSB0aGUgcHJvbWlzZSBpZiB0aGlzIGlzIHRoZSBudGggcHJvY2Vzc0lkIHNldCAoZS5nLiByZXVzZWQgdGFzayB0ZXJtaW5hbHMpXG5cdFx0XHR0aGlzLl9waWRQcm9taXNlLnRoZW4ocGlkID0+IHtcblx0XHRcdFx0aWYgKHBpZCAhPT0gcHJvY2Vzc0lkKSB7XG5cdFx0XHRcdFx0dGhpcy5fcGlkUHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZShwcm9jZXNzSWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgRXh0SG9zdFBzZXVkb3Rlcm1pbmFsIGltcGxlbWVudHMgSVRlcm1pbmFsQ2hpbGRQcm9jZXNzIHtcblx0cmVhZG9ubHkgaWQgPSAwO1xuXHRyZWFkb25seSBzaG91bGRQZXJzaXN0ID0gZmFsc2U7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25Qcm9jZXNzRGF0YSA9IG5ldyBFbWl0dGVyPHN0cmluZz4oKTtcblx0cHVibGljIHJlYWRvbmx5IG9uUHJvY2Vzc0RhdGE6IEV2ZW50PHN0cmluZz4gPSB0aGlzLl9vblByb2Nlc3NEYXRhLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblByb2Nlc3NSZWFkeSA9IG5ldyBFbWl0dGVyPElQcm9jZXNzUmVhZHlFdmVudD4oKTtcblx0cHVibGljIGdldCBvblByb2Nlc3NSZWFkeSgpOiBFdmVudDxJUHJvY2Vzc1JlYWR5RXZlbnQ+IHsgcmV0dXJuIHRoaXMuX29uUHJvY2Vzc1JlYWR5LmV2ZW50OyB9XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUHJvcGVydHkgPSBuZXcgRW1pdHRlcjxJUHJvY2Vzc1Byb3BlcnR5PGFueT4+KCk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZVByb3BlcnR5ID0gdGhpcy5fb25EaWRDaGFuZ2VQcm9wZXJ0eS5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25Qcm9jZXNzRXhpdCA9IG5ldyBFbWl0dGVyPG51bWJlciB8IHVuZGVmaW5lZD4oKTtcblx0cHVibGljIHJlYWRvbmx5IG9uUHJvY2Vzc0V4aXQ6IEV2ZW50PG51bWJlciB8IHVuZGVmaW5lZD4gPSB0aGlzLl9vblByb2Nlc3NFeGl0LmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgX3B0eTogdnNjb2RlLlBzZXVkb3Rlcm1pbmFsKSB7IH1cblxuXHRyZWZyZXNoUHJvcGVydHk8VCBleHRlbmRzIFByb2Nlc3NQcm9wZXJ0eVR5cGU+KHByb3BlcnR5OiBQcm9jZXNzUHJvcGVydHlUeXBlKTogUHJvbWlzZTxJUHJvY2Vzc1Byb3BlcnR5TWFwW1RdPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGByZWZyZXNoUHJvcGVydHkgaXMgbm90IHN1cHBwb3J0ZWQgaW4gZXh0ZW5zaW9uIG93bmVkIHRlcm1pbmFscy4gcHJvcGVydHk6ICR7cHJvcGVydHl9YCk7XG5cdH1cblxuXHR1cGRhdGVQcm9wZXJ0eTxUIGV4dGVuZHMgUHJvY2Vzc1Byb3BlcnR5VHlwZT4ocHJvcGVydHk6IFByb2Nlc3NQcm9wZXJ0eVR5cGUsIHZhbHVlOiBJUHJvY2Vzc1Byb3BlcnR5TWFwW1RdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGB1cGRhdGVQcm9wZXJ0eSBpcyBub3Qgc3VwcHBvcnRlZCBpbiBleHRlbnNpb24gb3duZWQgdGVybWluYWxzLiBwcm9wZXJ0eTogJHtwcm9wZXJ0eX0sIHZhbHVlOiAke3ZhbHVlfWApO1xuXHR9XG5cblx0YXN5bmMgc3RhcnQoKTogUHJvbWlzZTx1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0c2h1dGRvd24oKTogdm9pZCB7XG5cdFx0dGhpcy5fcHR5LmNsb3NlKCk7XG5cdH1cblxuXHRpbnB1dChkYXRhOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9wdHkuaGFuZGxlSW5wdXQ/LihkYXRhKTtcblx0fVxuXG5cdHJlc2l6ZShjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3B0eS5zZXREaW1lbnNpb25zPy4oeyBjb2x1bW5zOiBjb2xzLCByb3dzIH0pO1xuXHR9XG5cblx0Y2xlYXJCdWZmZXIoKTogdm9pZCB8IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIG5vLW9wXG5cdH1cblxuXHRhc3luYyBwcm9jZXNzQmluYXJ5KGRhdGE6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIE5vLW9wLCBwcm9jZXNzQmluYXJ5IGlzIG5vdCBzdXBwb3J0ZWQgaW4gZXh0ZW5zaW9uIG93bmVkIHRlcm1pbmFscy5cblx0fVxuXG5cdGFja25vd2xlZGdlRGF0YUV2ZW50KGNoYXJDb3VudDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Ly8gTm8tb3AsIGZsb3cgY29udHJvbCBpcyBub3Qgc3VwcG9ydGVkIGluIGV4dGVuc2lvbiBvd25lZCB0ZXJtaW5hbHMuIElmIHRoaXMgaXMgZXZlclxuXHRcdC8vIGltcGxlbWVudGVkIGl0IHdpbGwgbmVlZCBuZXcgcGF1c2UgYW5kIHJlc3VtZSBWUyBDb2RlIEFQSXMuXG5cdH1cblxuXHRhc3luYyBzZXRVbmljb2RlVmVyc2lvbih2ZXJzaW9uOiAnNicgfCAnMTEnKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gTm8tb3AsIHh0ZXJtLWhlYWRsZXNzIGlzbid0IHVzZWQgZm9yIGV4dGVuc2lvbiBvd25lZCB0ZXJtaW5hbHMuXG5cdH1cblxuXHRnZXRJbml0aWFsQ3dkKCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgnJyk7XG5cdH1cblxuXHRnZXRDd2QoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCcnKTtcblx0fVxuXG5cdHN0YXJ0U2VuZGluZ0V2ZW50cyhpbml0aWFsRGltZW5zaW9uczogSVRlcm1pbmFsRGltZW5zaW9uc0R0byB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdC8vIEF0dGFjaCB0aGUgbGlzdGVuZXJzXG5cdFx0dGhpcy5fcHR5Lm9uRGlkV3JpdGUoZSA9PiB0aGlzLl9vblByb2Nlc3NEYXRhLmZpcmUoZSkpO1xuXHRcdHRoaXMuX3B0eS5vbkRpZENsb3NlPy4oKGU6IG51bWJlciB8IHZvaWQgPSB1bmRlZmluZWQpID0+IHtcblx0XHRcdHRoaXMuX29uUHJvY2Vzc0V4aXQuZmlyZShlID09PSB2b2lkIDAgPyB1bmRlZmluZWQgOiBlKTtcblx0XHR9KTtcblx0XHR0aGlzLl9wdHkub25EaWRPdmVycmlkZURpbWVuc2lvbnM/LihlID0+IHtcblx0XHRcdGlmIChlKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlUHJvcGVydHkuZmlyZSh7IHR5cGU6IFByb2Nlc3NQcm9wZXJ0eVR5cGUuT3ZlcnJpZGVEaW1lbnNpb25zLCB2YWx1ZTogeyBjb2xzOiBlLmNvbHVtbnMsIHJvd3M6IGUucm93cyB9IH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuX3B0eS5vbkRpZENoYW5nZU5hbWU/Lih0aXRsZSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVByb3BlcnR5LmZpcmUoeyB0eXBlOiBQcm9jZXNzUHJvcGVydHlUeXBlLlRpdGxlLCB2YWx1ZTogdGl0bGUgfSk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9wdHkub3Blbihpbml0aWFsRGltZW5zaW9ucyA/IGluaXRpYWxEaW1lbnNpb25zIDogdW5kZWZpbmVkKTtcblxuXHRcdGlmIChpbml0aWFsRGltZW5zaW9ucykge1xuXHRcdFx0dGhpcy5fcHR5LnNldERpbWVuc2lvbnM/Lihpbml0aWFsRGltZW5zaW9ucyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25Qcm9jZXNzUmVhZHkuZmlyZSh7IHBpZDogLTEsIGN3ZDogJycsIHdpbmRvd3NQdHk6IHVuZGVmaW5lZCB9KTtcblx0fVxufVxuXG5sZXQgbmV4dExpbmtJZCA9IDE7XG5cbmludGVyZmFjZSBJQ2FjaGVkTGlua0VudHJ5IHtcblx0cHJvdmlkZXI6IHZzY29kZS5UZXJtaW5hbExpbmtQcm92aWRlcjtcblx0bGluazogdnNjb2RlLlRlcm1pbmFsTGluaztcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VFeHRIb3N0VGVybWluYWxTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFeHRIb3N0VGVybWluYWxTZXJ2aWNlLCBFeHRIb3N0VGVybWluYWxTZXJ2aWNlU2hhcGUge1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcm90ZWN0ZWQgX3Byb3h5OiBNYWluVGhyZWFkVGVybWluYWxTZXJ2aWNlU2hhcGU7XG5cdHByb3RlY3RlZCBfYWN0aXZlVGVybWluYWw6IEV4dEhvc3RUZXJtaW5hbCB8IHVuZGVmaW5lZDtcblx0cHJvdGVjdGVkIF90ZXJtaW5hbHM6IEV4dEhvc3RUZXJtaW5hbFtdID0gW107XG5cdHByb3RlY3RlZCBfdGVybWluYWxQcm9jZXNzZXM6IE1hcDxudW1iZXIsIElUZXJtaW5hbENoaWxkUHJvY2Vzcz4gPSBuZXcgTWFwKCk7XG5cdHByb3RlY3RlZCBfdGVybWluYWxQcm9jZXNzRGlzcG9zYWJsZXM6IHsgW2lkOiBudW1iZXJdOiBJRGlzcG9zYWJsZSB9ID0ge307XG5cdHByb3RlY3RlZCBfZXh0ZW5zaW9uVGVybWluYWxBd2FpdGluZ1N0YXJ0OiB7IFtpZDogbnVtYmVyXTogeyBpbml0aWFsRGltZW5zaW9uczogSVRlcm1pbmFsRGltZW5zaW9uc0R0byB8IHVuZGVmaW5lZCB9IHwgdW5kZWZpbmVkIH0gPSB7fTtcblx0cHJvdGVjdGVkIF9nZXRUZXJtaW5hbFByb21pc2VzOiB7IFtpZDogbnVtYmVyXTogUHJvbWlzZTxFeHRIb3N0VGVybWluYWwgfCB1bmRlZmluZWQ+IH0gPSB7fTtcblx0cHJvdGVjdGVkIF9lbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbnM6IE1hcDxzdHJpbmcsIFVuaWZpZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbj4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgX2RlZmF1bHRQcm9maWxlOiBJVGVybWluYWxQcm9maWxlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9kZWZhdWx0QXV0b21hdGlvblByb2ZpbGU6IElUZXJtaW5hbFByb2ZpbGUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xhc3RRdWlja0ZpeENvbW1hbmRzOiBNdXRhYmxlRGlzcG9zYWJsZTxJRGlzcG9zYWJsZT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYnVmZmVyZXI6IFRlcm1pbmFsRGF0YUJ1ZmZlcmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9saW5rUHJvdmlkZXJzOiBTZXQ8dnNjb2RlLlRlcm1pbmFsTGlua1Byb3ZpZGVyPiA9IG5ldyBTZXQoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfY29tcGxldGlvblByb3ZpZGVyczogTWFwPHN0cmluZywgdnNjb2RlLlRlcm1pbmFsQ29tcGxldGlvblByb3ZpZGVyPHZzY29kZS5UZXJtaW5hbENvbXBsZXRpb25JdGVtPj4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb2ZpbGVQcm92aWRlcnM6IE1hcDxzdHJpbmcsIHZzY29kZS5UZXJtaW5hbFByb2ZpbGVQcm92aWRlcj4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3F1aWNrRml4UHJvdmlkZXJzOiBNYXA8c3RyaW5nLCB2c2NvZGUuVGVybWluYWxRdWlja0ZpeFByb3ZpZGVyPiA9IG5ldyBNYXAoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxMaW5rQ2FjaGU6IE1hcDxudW1iZXIsIE1hcDxudW1iZXIsIElDYWNoZWRMaW5rRW50cnk+PiA9IG5ldyBNYXAoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxMaW5rQ2FuY2VsbGF0aW9uU291cmNlOiBNYXA8bnVtYmVyLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZT4gPSBuZXcgTWFwKCk7XG5cblx0cHVibGljIGdldCBhY3RpdmVUZXJtaW5hbCgpOiB2c2NvZGUuVGVybWluYWwgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fYWN0aXZlVGVybWluYWw/LnZhbHVlOyB9XG5cdHB1YmxpYyBnZXQgdGVybWluYWxzKCk6IHZzY29kZS5UZXJtaW5hbFtdIHsgcmV0dXJuIHRoaXMuX3Rlcm1pbmFscy5tYXAodGVybSA9PiB0ZXJtLnZhbHVlKTsgfVxuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDbG9zZVRlcm1pbmFsID0gbmV3IEVtaXR0ZXI8dnNjb2RlLlRlcm1pbmFsPigpO1xuXHRyZWFkb25seSBvbkRpZENsb3NlVGVybWluYWwgPSB0aGlzLl9vbkRpZENsb3NlVGVybWluYWwuZXZlbnQ7XG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRPcGVuVGVybWluYWwgPSBuZXcgRW1pdHRlcjx2c2NvZGUuVGVybWluYWw+KCk7XG5cdHJlYWRvbmx5IG9uRGlkT3BlblRlcm1pbmFsID0gdGhpcy5fb25EaWRPcGVuVGVybWluYWwuZXZlbnQ7XG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2VBY3RpdmVUZXJtaW5hbCA9IG5ldyBFbWl0dGVyPHZzY29kZS5UZXJtaW5hbCB8IHVuZGVmaW5lZD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVUZXJtaW5hbCA9IHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlVGVybWluYWwuZXZlbnQ7XG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2VUZXJtaW5hbERpbWVuc2lvbnMgPSBuZXcgRW1pdHRlcjx2c2NvZGUuVGVybWluYWxEaW1lbnNpb25zQ2hhbmdlRXZlbnQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVGVybWluYWxEaW1lbnNpb25zID0gdGhpcy5fb25EaWRDaGFuZ2VUZXJtaW5hbERpbWVuc2lvbnMuZXZlbnQ7XG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2VUZXJtaW5hbFN0YXRlID0gbmV3IEVtaXR0ZXI8dnNjb2RlLlRlcm1pbmFsPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVRlcm1pbmFsU3RhdGUgPSB0aGlzLl9vbkRpZENoYW5nZVRlcm1pbmFsU3RhdGUuZXZlbnQ7XG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2VTaGVsbCA9IG5ldyBFbWl0dGVyPHN0cmluZz4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTaGVsbCA9IHRoaXMuX29uRGlkQ2hhbmdlU2hlbGwuZXZlbnQ7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZFdyaXRlVGVybWluYWxEYXRhID0gbmV3IEVtaXR0ZXI8dnNjb2RlLlRlcm1pbmFsRGF0YVdyaXRlRXZlbnQ+KHtcblx0XHRvbldpbGxBZGRGaXJzdExpc3RlbmVyOiAoKSA9PiB0aGlzLl9wcm94eS4kc3RhcnRTZW5kaW5nRGF0YUV2ZW50cygpLFxuXHRcdG9uRGlkUmVtb3ZlTGFzdExpc3RlbmVyOiAoKSA9PiB0aGlzLl9wcm94eS4kc3RvcFNlbmRpbmdEYXRhRXZlbnRzKClcblx0fSk7XG5cdHJlYWRvbmx5IG9uRGlkV3JpdGVUZXJtaW5hbERhdGEgPSB0aGlzLl9vbkRpZFdyaXRlVGVybWluYWxEYXRhLmV2ZW50O1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkRXhlY3V0ZUNvbW1hbmQgPSBuZXcgRW1pdHRlcjx2c2NvZGUuVGVybWluYWxFeGVjdXRlZENvbW1hbmQ+KHtcblx0XHRvbldpbGxBZGRGaXJzdExpc3RlbmVyOiAoKSA9PiB0aGlzLl9wcm94eS4kc3RhcnRTZW5kaW5nQ29tbWFuZEV2ZW50cygpLFxuXHRcdG9uRGlkUmVtb3ZlTGFzdExpc3RlbmVyOiAoKSA9PiB0aGlzLl9wcm94eS4kc3RvcFNlbmRpbmdDb21tYW5kRXZlbnRzKClcblx0fSk7XG5cdHJlYWRvbmx5IG9uRGlkRXhlY3V0ZVRlcm1pbmFsQ29tbWFuZCA9IHRoaXMuX29uRGlkRXhlY3V0ZUNvbW1hbmQuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0c3VwcG9ydHNQcm9jZXNzZXM6IGJvb2xlYW4sXG5cdFx0QElFeHRIb3N0Q29tbWFuZHMgcHJpdmF0ZSByZWFkb25seSBfZXh0SG9zdENvbW1hbmRzOiBJRXh0SG9zdENvbW1hbmRzLFxuXHRcdEBJRXh0SG9zdFJwY1NlcnZpY2UgZXh0SG9zdFJwYzogSUV4dEhvc3RScGNTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcHJveHkgPSBleHRIb3N0UnBjLmdldFByb3h5KE1haW5Db250ZXh0Lk1haW5UaHJlYWRUZXJtaW5hbFNlcnZpY2UpO1xuXHRcdHRoaXMuX2J1ZmZlcmVyID0gbmV3IFRlcm1pbmFsRGF0YUJ1ZmZlcmVyKHRoaXMuX3Byb3h5LiRzZW5kUHJvY2Vzc0RhdGEpO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlclByb2Nlc3NTdXBwb3J0KHN1cHBvcnRzUHJvY2Vzc2VzKTtcblx0XHR0aGlzLl9leHRIb3N0Q29tbWFuZHMucmVnaXN0ZXJBcmd1bWVudFByb2Nlc3Nvcih7XG5cdFx0XHRwcm9jZXNzQXJndW1lbnQ6IGFyZyA9PiB7XG5cdFx0XHRcdGNvbnN0IGRlc2VyaWFsaXplID0gKGFyZzogYW55KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgY2FzdCA9IGFyZyBhcyBJU2VyaWFsaXplZFRlcm1pbmFsSW5zdGFuY2VDb250ZXh0O1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmdldFRlcm1pbmFsQnlJZChjYXN0Lmluc3RhbmNlSWQpPy52YWx1ZTtcblx0XHRcdFx0fTtcblx0XHRcdFx0c3dpdGNoIChhcmc/LiRtaWQpIHtcblx0XHRcdFx0XHRjYXNlIE1hcnNoYWxsZWRJZC5UZXJtaW5hbENvbnRleHQ6IHJldHVybiBkZXNlcmlhbGl6ZShhcmcpO1xuXHRcdFx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0XHRcdC8vIERvIGFycmF5IHRyYW5zZm9ybWF0aW9uIGluIHBsYWNlIGFzIHRoaXMgaXMgYSBob3QgcGF0aFxuXHRcdFx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xuXHRcdFx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGFyZy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChhcmdbaV0uJG1pZCA9PT0gTWFyc2hhbGxlZElkLlRlcm1pbmFsQ29udGV4dCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0YXJnW2ldID0gZGVzZXJpYWxpemUoYXJnW2ldKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly8gUHJvYmFibHkgc29tZXRoaW5nIGVsc2UsIHNvIGV4aXQgZWFybHlcblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIGFyZztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih7XG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3QgW18sIHRlcm1pbmFsUHJvY2Vzc10gb2YgdGhpcy5fdGVybWluYWxQcm9jZXNzZXMpIHtcblx0XHRcdFx0XHR0ZXJtaW5hbFByb2Nlc3Muc2h1dGRvd24odHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhYnN0cmFjdCBjcmVhdGVUZXJtaW5hbChuYW1lPzogc3RyaW5nLCBzaGVsbFBhdGg/OiBzdHJpbmcsIHNoZWxsQXJncz86IHN0cmluZ1tdIHwgc3RyaW5nKTogdnNjb2RlLlRlcm1pbmFsO1xuXHRwdWJsaWMgYWJzdHJhY3QgY3JlYXRlVGVybWluYWxGcm9tT3B0aW9ucyhvcHRpb25zOiB2c2NvZGUuVGVybWluYWxPcHRpb25zLCBpbnRlcm5hbE9wdGlvbnM/OiBJVGVybWluYWxJbnRlcm5hbE9wdGlvbnMpOiB2c2NvZGUuVGVybWluYWw7XG5cblx0cHVibGljIGdldERlZmF1bHRTaGVsbCh1c2VBdXRvbWF0aW9uU2hlbGw6IGJvb2xlYW4pOiBzdHJpbmcge1xuXHRcdGNvbnN0IHByb2ZpbGUgPSB1c2VBdXRvbWF0aW9uU2hlbGwgPyB0aGlzLl9kZWZhdWx0QXV0b21hdGlvblByb2ZpbGUgOiB0aGlzLl9kZWZhdWx0UHJvZmlsZTtcblx0XHRyZXR1cm4gcHJvZmlsZT8ucGF0aCB8fCAnJztcblx0fVxuXG5cdHB1YmxpYyBnZXREZWZhdWx0U2hlbGxBcmdzKHVzZUF1dG9tYXRpb25TaGVsbDogYm9vbGVhbik6IHN0cmluZ1tdIHwgc3RyaW5nIHtcblx0XHRjb25zdCBwcm9maWxlID0gdXNlQXV0b21hdGlvblNoZWxsID8gdGhpcy5fZGVmYXVsdEF1dG9tYXRpb25Qcm9maWxlIDogdGhpcy5fZGVmYXVsdFByb2ZpbGU7XG5cdFx0cmV0dXJuIHByb2ZpbGU/LmFyZ3MgfHwgW107XG5cdH1cblxuXHRwdWJsaWMgY3JlYXRlRXh0ZW5zaW9uVGVybWluYWwob3B0aW9uczogdnNjb2RlLkV4dGVuc2lvblRlcm1pbmFsT3B0aW9ucywgaW50ZXJuYWxPcHRpb25zPzogSVRlcm1pbmFsSW50ZXJuYWxPcHRpb25zKTogdnNjb2RlLlRlcm1pbmFsIHtcblx0XHRjb25zdCB0ZXJtaW5hbCA9IG5ldyBFeHRIb3N0VGVybWluYWwodGhpcy5fcHJveHksIGdlbmVyYXRlVXVpZCgpLCBvcHRpb25zLCBvcHRpb25zLm5hbWUpO1xuXHRcdGNvbnN0IHAgPSBuZXcgRXh0SG9zdFBzZXVkb3Rlcm1pbmFsKG9wdGlvbnMucHR5KTtcblx0XHR0ZXJtaW5hbC5jcmVhdGVFeHRlbnNpb25UZXJtaW5hbChvcHRpb25zLmxvY2F0aW9uLCBpbnRlcm5hbE9wdGlvbnMsIHRoaXMuX3NlcmlhbGl6ZVBhcmVudFRlcm1pbmFsKG9wdGlvbnMsIGludGVybmFsT3B0aW9ucykucmVzb2x2ZWRFeHRIb3N0SWRlbnRpZmllciwgYXNUZXJtaW5hbEljb24ob3B0aW9ucy5pY29uUGF0aCksIGFzVGVybWluYWxDb2xvcihvcHRpb25zLmNvbG9yKSkudGhlbihpZCA9PiB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gdGhpcy5fc2V0dXBFeHRIb3N0UHJvY2Vzc0xpc3RlbmVycyhpZCwgcCk7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbFByb2Nlc3NEaXNwb3NhYmxlc1tpZF0gPSBkaXNwb3NhYmxlO1xuXHRcdH0pO1xuXHRcdHRoaXMuX3Rlcm1pbmFscy5wdXNoKHRlcm1pbmFsKTtcblx0XHRyZXR1cm4gdGVybWluYWwudmFsdWU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3NlcmlhbGl6ZVBhcmVudFRlcm1pbmFsKG9wdGlvbnM6IHZzY29kZS5UZXJtaW5hbE9wdGlvbnMsIGludGVybmFsT3B0aW9ucz86IElUZXJtaW5hbEludGVybmFsT3B0aW9ucyk6IElUZXJtaW5hbEludGVybmFsT3B0aW9ucyB7XG5cdFx0aW50ZXJuYWxPcHRpb25zID0gaW50ZXJuYWxPcHRpb25zID8gaW50ZXJuYWxPcHRpb25zIDoge307XG5cdFx0aWYgKG9wdGlvbnMubG9jYXRpb24gJiYgdHlwZW9mIG9wdGlvbnMubG9jYXRpb24gPT09ICdvYmplY3QnICYmICdwYXJlbnRUZXJtaW5hbCcgaW4gb3B0aW9ucy5sb2NhdGlvbikge1xuXHRcdFx0Y29uc3QgcGFyZW50VGVybWluYWwgPSBvcHRpb25zLmxvY2F0aW9uLnBhcmVudFRlcm1pbmFsO1xuXHRcdFx0aWYgKHBhcmVudFRlcm1pbmFsKSB7XG5cdFx0XHRcdGNvbnN0IHBhcmVudEV4dEhvc3RUZXJtaW5hbCA9IHRoaXMuX3Rlcm1pbmFscy5maW5kKHQgPT4gdC52YWx1ZSA9PT0gcGFyZW50VGVybWluYWwpO1xuXHRcdFx0XHRpZiAocGFyZW50RXh0SG9zdFRlcm1pbmFsKSB7XG5cdFx0XHRcdFx0aW50ZXJuYWxPcHRpb25zLnJlc29sdmVkRXh0SG9zdElkZW50aWZpZXIgPSBwYXJlbnRFeHRIb3N0VGVybWluYWwuX2lkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChvcHRpb25zLmxvY2F0aW9uICYmIHR5cGVvZiBvcHRpb25zLmxvY2F0aW9uICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0aW50ZXJuYWxPcHRpb25zLmxvY2F0aW9uID0gb3B0aW9ucy5sb2NhdGlvbjtcblx0XHR9IGVsc2UgaWYgKGludGVybmFsT3B0aW9ucy5sb2NhdGlvbiAmJiB0eXBlb2YgaW50ZXJuYWxPcHRpb25zLmxvY2F0aW9uID09PSAnb2JqZWN0JyAmJiAnc3BsaXRBY3RpdmVUZXJtaW5hbCcgaW4gaW50ZXJuYWxPcHRpb25zLmxvY2F0aW9uKSB7XG5cdFx0XHRpbnRlcm5hbE9wdGlvbnMubG9jYXRpb24gPSB7IHNwbGl0QWN0aXZlVGVybWluYWw6IHRydWUgfTtcblx0XHR9XG5cdFx0cmV0dXJuIGludGVybmFsT3B0aW9ucztcblx0fVxuXG5cdHB1YmxpYyBhdHRhY2hQdHlUb1Rlcm1pbmFsKGlkOiBudW1iZXIsIHB0eTogdnNjb2RlLlBzZXVkb3Rlcm1pbmFsKTogdm9pZCB7XG5cdFx0Y29uc3QgdGVybWluYWwgPSB0aGlzLmdldFRlcm1pbmFsQnlJZChpZCk7XG5cdFx0aWYgKCF0ZXJtaW5hbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgcmVzb2x2ZSB0ZXJtaW5hbCB3aXRoIGlkICR7aWR9IGZvciB2aXJ0dWFsIHByb2Nlc3NgKTtcblx0XHR9XG5cdFx0Y29uc3QgcCA9IG5ldyBFeHRIb3N0UHNldWRvdGVybWluYWwocHR5KTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gdGhpcy5fc2V0dXBFeHRIb3N0UHJvY2Vzc0xpc3RlbmVycyhpZCwgcCk7XG5cdFx0dGhpcy5fdGVybWluYWxQcm9jZXNzRGlzcG9zYWJsZXNbaWRdID0gZGlzcG9zYWJsZTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkYWNjZXB0QWN0aXZlVGVybWluYWxDaGFuZ2VkKGlkOiBudW1iZXIgfCBudWxsKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0aGlzLl9hY3RpdmVUZXJtaW5hbDtcblx0XHRpZiAoaWQgPT09IG51bGwpIHtcblx0XHRcdHRoaXMuX2FjdGl2ZVRlcm1pbmFsID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKG9yaWdpbmFsICE9PSB0aGlzLl9hY3RpdmVUZXJtaW5hbCkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZVRlcm1pbmFsLmZpcmUodGhpcy5fYWN0aXZlVGVybWluYWwpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCB0ZXJtaW5hbCA9IHRoaXMuZ2V0VGVybWluYWxCeUlkKGlkKTtcblx0XHRpZiAodGVybWluYWwpIHtcblx0XHRcdHRoaXMuX2FjdGl2ZVRlcm1pbmFsID0gdGVybWluYWw7XG5cdFx0XHRpZiAob3JpZ2luYWwgIT09IHRoaXMuX2FjdGl2ZVRlcm1pbmFsKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlVGVybWluYWwuZmlyZSh0aGlzLl9hY3RpdmVUZXJtaW5hbC52YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jICRhY2NlcHRUZXJtaW5hbFByb2Nlc3NEYXRhKGlkOiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRlcm1pbmFsID0gdGhpcy5nZXRUZXJtaW5hbEJ5SWQoaWQpO1xuXHRcdGlmICh0ZXJtaW5hbCkge1xuXHRcdFx0dGhpcy5fb25EaWRXcml0ZVRlcm1pbmFsRGF0YS5maXJlKHsgdGVybWluYWw6IHRlcm1pbmFsLnZhbHVlLCBkYXRhIH0pO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkYWNjZXB0VGVybWluYWxEaW1lbnNpb25zKGlkOiBudW1iZXIsIGNvbHM6IG51bWJlciwgcm93czogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdGVybWluYWwgPSB0aGlzLmdldFRlcm1pbmFsQnlJZChpZCk7XG5cdFx0aWYgKHRlcm1pbmFsKSB7XG5cdFx0XHRpZiAodGVybWluYWwuc2V0RGltZW5zaW9ucyhjb2xzLCByb3dzKSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVRlcm1pbmFsRGltZW5zaW9ucy5maXJlKHtcblx0XHRcdFx0XHR0ZXJtaW5hbDogdGVybWluYWwudmFsdWUsXG5cdFx0XHRcdFx0ZGltZW5zaW9uczogdGVybWluYWwudmFsdWUuZGltZW5zaW9ucyBhcyB2c2NvZGUuVGVybWluYWxEaW1lbnNpb25zXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkYWNjZXB0RGlkRXhlY3V0ZUNvbW1hbmQoaWQ6IG51bWJlciwgY29tbWFuZDogSVRlcm1pbmFsQ29tbWFuZER0byk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRlcm1pbmFsID0gdGhpcy5nZXRUZXJtaW5hbEJ5SWQoaWQpO1xuXHRcdGlmICh0ZXJtaW5hbCkge1xuXHRcdFx0dGhpcy5fb25EaWRFeGVjdXRlQ29tbWFuZC5maXJlKHsgdGVybWluYWw6IHRlcm1pbmFsLnZhbHVlLCAuLi5jb21tYW5kIH0pO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkYWNjZXB0VGVybWluYWxNYXhpbXVtRGltZW5zaW9ucyhpZDogbnVtYmVyLCBjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIEV4dGVuc2lvbiBwdHkgdGVybWluYWwgb25seSAtIHdoZW4gdmlydHVhbCBwcm9jZXNzIHJlc2l6ZSBmaXJlcyBpdCBtZWFucyB0aGF0IHRoZVxuXHRcdC8vIHRlcm1pbmFsJ3MgbWF4aW11bSBkaW1lbnNpb25zIGNoYW5nZWRcblx0XHR0aGlzLl90ZXJtaW5hbFByb2Nlc3Nlcy5nZXQoaWQpPy5yZXNpemUoY29scywgcm93cyk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJGFjY2VwdFRlcm1pbmFsVGl0bGVDaGFuZ2UoaWQ6IG51bWJlciwgbmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdGVybWluYWwgPSB0aGlzLmdldFRlcm1pbmFsQnlJZChpZCk7XG5cdFx0aWYgKHRlcm1pbmFsKSB7XG5cdFx0XHR0ZXJtaW5hbC5uYW1lID0gbmFtZTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJGFjY2VwdFRlcm1pbmFsQ2xvc2VkKGlkOiBudW1iZXIsIGV4aXRDb2RlOiBudW1iZXIgfCB1bmRlZmluZWQsIGV4aXRSZWFzb246IFRlcm1pbmFsRXhpdFJlYXNvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0VGVybWluYWxPYmplY3RJbmRleEJ5SWQodGhpcy5fdGVybWluYWxzLCBpZCk7XG5cdFx0aWYgKGluZGV4ICE9PSBudWxsKSB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbCA9IHRoaXMuX3Rlcm1pbmFscy5zcGxpY2UoaW5kZXgsIDEpWzBdO1xuXHRcdFx0dGVybWluYWwuc2V0RXhpdFN0YXR1cyhleGl0Q29kZSwgZXhpdFJlYXNvbik7XG5cdFx0XHR0aGlzLl9vbkRpZENsb3NlVGVybWluYWwuZmlyZSh0ZXJtaW5hbC52YWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljICRhY2NlcHRUZXJtaW5hbE9wZW5lZChpZDogbnVtYmVyLCBleHRIb3N0VGVybWluYWxJZDogc3RyaW5nIHwgdW5kZWZpbmVkLCBuYW1lOiBzdHJpbmcsIHNoZWxsTGF1bmNoQ29uZmlnRHRvOiBJU2hlbGxMYXVuY2hDb25maWdEdG8pOiB2b2lkIHtcblx0XHRpZiAoZXh0SG9zdFRlcm1pbmFsSWQpIHtcblx0XHRcdC8vIFJlc29sdmUgd2l0aCB0aGUgcmVuZGVyZXIgZ2VuZXJhdGVkIGlkXG5cdFx0XHRjb25zdCBpbmRleCA9IHRoaXMuX2dldFRlcm1pbmFsT2JqZWN0SW5kZXhCeUlkKHRoaXMuX3Rlcm1pbmFscywgZXh0SG9zdFRlcm1pbmFsSWQpO1xuXHRcdFx0aWYgKGluZGV4ICE9PSBudWxsKSB7XG5cdFx0XHRcdC8vIFRoZSB0ZXJtaW5hbCBoYXMgYWxyZWFkeSBiZWVuIGNyZWF0ZWQgKHZpYSBjcmVhdGVUZXJtaW5hbCopLCBvbmx5IGZpcmUgdGhlIGV2ZW50XG5cdFx0XHRcdHRoaXMuX3Rlcm1pbmFsc1tpbmRleF0uX2lkID0gaWQ7XG5cdFx0XHRcdHRoaXMuX29uRGlkT3BlblRlcm1pbmFsLmZpcmUodGhpcy50ZXJtaW5hbHNbaW5kZXhdKTtcblx0XHRcdFx0dGhpcy5fdGVybWluYWxzW2luZGV4XS5pc09wZW4gPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3JlYXRpb25PcHRpb25zOiB2c2NvZGUuVGVybWluYWxPcHRpb25zID0ge1xuXHRcdFx0bmFtZTogc2hlbGxMYXVuY2hDb25maWdEdG8ubmFtZSxcblx0XHRcdHNoZWxsUGF0aDogc2hlbGxMYXVuY2hDb25maWdEdG8uZXhlY3V0YWJsZSxcblx0XHRcdHNoZWxsQXJnczogc2hlbGxMYXVuY2hDb25maWdEdG8uYXJncyxcblx0XHRcdGN3ZDogdHlwZW9mIHNoZWxsTGF1bmNoQ29uZmlnRHRvLmN3ZCA9PT0gJ3N0cmluZycgPyBzaGVsbExhdW5jaENvbmZpZ0R0by5jd2QgOiBVUkkucmV2aXZlKHNoZWxsTGF1bmNoQ29uZmlnRHRvLmN3ZCksXG5cdFx0XHRlbnY6IHNoZWxsTGF1bmNoQ29uZmlnRHRvLmVudixcblx0XHRcdGhpZGVGcm9tVXNlcjogc2hlbGxMYXVuY2hDb25maWdEdG8uaGlkZUZyb21Vc2VyXG5cdFx0fTtcblx0XHRjb25zdCB0ZXJtaW5hbCA9IG5ldyBFeHRIb3N0VGVybWluYWwodGhpcy5fcHJveHksIGlkLCBjcmVhdGlvbk9wdGlvbnMsIG5hbWUpO1xuXHRcdHRoaXMuX3Rlcm1pbmFscy5wdXNoKHRlcm1pbmFsKTtcblx0XHR0aGlzLl9vbkRpZE9wZW5UZXJtaW5hbC5maXJlKHRlcm1pbmFsLnZhbHVlKTtcblx0XHR0ZXJtaW5hbC5pc09wZW4gPSB0cnVlO1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRhY2NlcHRUZXJtaW5hbFByb2Nlc3NJZChpZDogbnVtYmVyLCBwcm9jZXNzSWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRlcm1pbmFsID0gdGhpcy5nZXRUZXJtaW5hbEJ5SWQoaWQpO1xuXHRcdHRlcm1pbmFsPy5fc2V0UHJvY2Vzc0lkKHByb2Nlc3NJZCk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJHN0YXJ0RXh0ZW5zaW9uVGVybWluYWwoaWQ6IG51bWJlciwgaW5pdGlhbERpbWVuc2lvbnM6IElUZXJtaW5hbERpbWVuc2lvbnNEdG8gfCB1bmRlZmluZWQpOiBQcm9taXNlPElUZXJtaW5hbExhdW5jaEVycm9yIHwgdW5kZWZpbmVkPiB7XG5cdFx0Ly8gTWFrZSBzdXJlIHRoZSBFeHRIb3N0VGVybWluYWwgZXhpc3RzIHNvIG9uRGlkT3BlblRlcm1pbmFsIGhhcyBmaXJlZCBiZWZvcmUgd2UgY2FsbFxuXHRcdC8vIFBzZXVkb3Rlcm1pbmFsLnN0YXJ0XG5cdFx0Y29uc3QgdGVybWluYWwgPSB0aGlzLmdldFRlcm1pbmFsQnlJZChpZCk7XG5cdFx0aWYgKCF0ZXJtaW5hbCkge1xuXHRcdFx0cmV0dXJuIHsgbWVzc2FnZTogbG9jYWxpemUoJ2xhdW5jaEZhaWwuaWRNaXNzaW5nT25FeHRIb3N0JywgXCJDb3VsZCBub3QgZmluZCB0aGUgdGVybWluYWwgd2l0aCBpZCB7MH0gb24gdGhlIGV4dGVuc2lvbiBob3N0XCIsIGlkKSB9O1xuXHRcdH1cblxuXHRcdC8vIFdhaXQgZm9yIG9uRGlkT3BlblRlcm1pbmFsIHRvIGZpcmVcblx0XHRpZiAoIXRlcm1pbmFsLmlzT3Blbikge1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ociA9PiB7XG5cdFx0XHRcdC8vIEVuc3VyZSBvcGVuIGlzIGNhbGxlZCBhZnRlciBvbkRpZE9wZW5UZXJtaW5hbFxuXHRcdFx0XHRjb25zdCBsaXN0ZW5lciA9IHRoaXMub25EaWRPcGVuVGVybWluYWwoYXN5bmMgZSA9PiB7XG5cdFx0XHRcdFx0aWYgKGUgPT09IHRlcm1pbmFsLnZhbHVlKSB7XG5cdFx0XHRcdFx0XHRsaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRyKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRlcm1pbmFsUHJvY2VzcyA9IHRoaXMuX3Rlcm1pbmFsUHJvY2Vzc2VzLmdldChpZCk7XG5cdFx0aWYgKHRlcm1pbmFsUHJvY2Vzcykge1xuXHRcdFx0KHRlcm1pbmFsUHJvY2VzcyBhcyBFeHRIb3N0UHNldWRvdGVybWluYWwpLnN0YXJ0U2VuZGluZ0V2ZW50cyhpbml0aWFsRGltZW5zaW9ucyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIERlZmVyIHN0YXJ0U2VuZGluZ0V2ZW50cyBjYWxsIHRvIHdoZW4gX3NldHVwRXh0SG9zdFByb2Nlc3NMaXN0ZW5lcnMgaXMgY2FsbGVkXG5cdFx0XHR0aGlzLl9leHRlbnNpb25UZXJtaW5hbEF3YWl0aW5nU3RhcnRbaWRdID0geyBpbml0aWFsRGltZW5zaW9ucyB9O1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3NldHVwRXh0SG9zdFByb2Nlc3NMaXN0ZW5lcnMoaWQ6IG51bWJlciwgcDogSVRlcm1pbmFsQ2hpbGRQcm9jZXNzKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChwLm9uUHJvY2Vzc1JlYWR5KGUgPT4gdGhpcy5fcHJveHkuJHNlbmRQcm9jZXNzUmVhZHkoaWQsIGUucGlkLCBlLmN3ZCwgZS53aW5kb3dzUHR5KSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChwLm9uRGlkQ2hhbmdlUHJvcGVydHkocHJvcGVydHkgPT4gdGhpcy5fcHJveHkuJHNlbmRQcm9jZXNzUHJvcGVydHkoaWQsIHByb3BlcnR5KSkpO1xuXG5cdFx0Ly8gQnVmZmVyIGRhdGEgZXZlbnRzIHRvIHJlZHVjZSB0aGUgYW1vdW50IG9mIG1lc3NhZ2VzIGdvaW5nIHRvIHRoZSByZW5kZXJlclxuXHRcdHRoaXMuX2J1ZmZlcmVyLnN0YXJ0QnVmZmVyaW5nKGlkLCBwLm9uUHJvY2Vzc0RhdGEpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChwLm9uUHJvY2Vzc0V4aXQoZXhpdENvZGUgPT4gdGhpcy5fb25Qcm9jZXNzRXhpdChpZCwgZXhpdENvZGUpKSk7XG5cdFx0dGhpcy5fdGVybWluYWxQcm9jZXNzZXMuc2V0KGlkLCBwKTtcblxuXHRcdGNvbnN0IGF3YWl0aW5nU3RhcnQgPSB0aGlzLl9leHRlbnNpb25UZXJtaW5hbEF3YWl0aW5nU3RhcnRbaWRdO1xuXHRcdGlmIChhd2FpdGluZ1N0YXJ0ICYmIHAgaW5zdGFuY2VvZiBFeHRIb3N0UHNldWRvdGVybWluYWwpIHtcblx0XHRcdHAuc3RhcnRTZW5kaW5nRXZlbnRzKGF3YWl0aW5nU3RhcnQuaW5pdGlhbERpbWVuc2lvbnMpO1xuXHRcdFx0ZGVsZXRlIHRoaXMuX2V4dGVuc2lvblRlcm1pbmFsQXdhaXRpbmdTdGFydFtpZF07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGRpc3Bvc2FibGVzO1xuXHR9XG5cblx0cHVibGljICRhY2NlcHRQcm9jZXNzQWNrRGF0YUV2ZW50KGlkOiBudW1iZXIsIGNoYXJDb3VudDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fdGVybWluYWxQcm9jZXNzZXMuZ2V0KGlkKT8uYWNrbm93bGVkZ2VEYXRhRXZlbnQoY2hhckNvdW50KTtcblx0fVxuXG5cdHB1YmxpYyAkYWNjZXB0UHJvY2Vzc0lucHV0KGlkOiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3Rlcm1pbmFsUHJvY2Vzc2VzLmdldChpZCk/LmlucHV0KGRhdGEpO1xuXHR9XG5cblx0cHVibGljICRhY2NlcHRUZXJtaW5hbEludGVyYWN0aW9uKGlkOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCB0ZXJtaW5hbCA9IHRoaXMuZ2V0VGVybWluYWxCeUlkKGlkKTtcblx0XHRpZiAodGVybWluYWw/LnNldEludGVyYWN0ZWRXaXRoKCkpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVGVybWluYWxTdGF0ZS5maXJlKHRlcm1pbmFsLnZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgJGFjY2VwdFRlcm1pbmFsU2VsZWN0aW9uKGlkOiBudW1iZXIsIHNlbGVjdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5nZXRUZXJtaW5hbEJ5SWQoaWQpPy5zZXRTZWxlY3Rpb24oc2VsZWN0aW9uKTtcblx0fVxuXG5cdHB1YmxpYyAkYWNjZXB0UHJvY2Vzc1Jlc2l6ZShpZDogbnVtYmVyLCBjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlcik6IHZvaWQge1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbFByb2Nlc3Nlcy5nZXQoaWQpPy5yZXNpemUoY29scywgcm93cyk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIFdlIHRyaWVkIHRvIHdyaXRlIHRvIGEgY2xvc2VkIHBpcGUgLyBjaGFubmVsLlxuXHRcdFx0aWYgKGVycm9yLmNvZGUgIT09ICdFUElQRScgJiYgZXJyb3IuY29kZSAhPT0gJ0VSUl9JUENfQ0hBTk5FTF9DTE9TRUQnKSB7XG5cdFx0XHRcdHRocm93IChlcnJvcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljICRhY2NlcHRQcm9jZXNzU2h1dGRvd24oaWQ6IG51bWJlciwgaW1tZWRpYXRlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fdGVybWluYWxQcm9jZXNzZXMuZ2V0KGlkKT8uc2h1dGRvd24oaW1tZWRpYXRlKTtcblx0fVxuXG5cdHB1YmxpYyAkYWNjZXB0UHJvY2Vzc1JlcXVlc3RJbml0aWFsQ3dkKGlkOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl90ZXJtaW5hbFByb2Nlc3Nlcy5nZXQoaWQpPy5nZXRJbml0aWFsQ3dkKCkudGhlbihpbml0aWFsQ3dkID0+IHRoaXMuX3Byb3h5LiRzZW5kUHJvY2Vzc1Byb3BlcnR5KGlkLCB7IHR5cGU6IFByb2Nlc3NQcm9wZXJ0eVR5cGUuSW5pdGlhbEN3ZCwgdmFsdWU6IGluaXRpYWxDd2QgfSkpO1xuXHR9XG5cblx0cHVibGljICRhY2NlcHRQcm9jZXNzUmVxdWVzdEN3ZChpZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fdGVybWluYWxQcm9jZXNzZXMuZ2V0KGlkKT8uZ2V0Q3dkKCkudGhlbihjd2QgPT4gdGhpcy5fcHJveHkuJHNlbmRQcm9jZXNzUHJvcGVydHkoaWQsIHsgdHlwZTogUHJvY2Vzc1Byb3BlcnR5VHlwZS5Dd2QsIHZhbHVlOiBjd2QgfSkpO1xuXHR9XG5cblx0cHVibGljICRhY2NlcHRQcm9jZXNzUmVxdWVzdExhdGVuY3koaWQ6IG51bWJlcik6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShpZCk7XG5cdH1cblxuXG5cdHB1YmxpYyByZWdpc3RlclByb2ZpbGVQcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgaWQ6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5UZXJtaW5hbFByb2ZpbGVQcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRpZiAodGhpcy5fcHJvZmlsZVByb3ZpZGVycy5oYXMoaWQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFRlcm1pbmFsIHByb2ZpbGUgcHJvdmlkZXIgXCIke2lkfVwiIGFscmVhZHkgcmVnaXN0ZXJlZGApO1xuXHRcdH1cblx0XHR0aGlzLl9wcm9maWxlUHJvdmlkZXJzLnNldChpZCwgcHJvdmlkZXIpO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlclByb2ZpbGVQcm92aWRlcihpZCwgZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWUpO1xuXHRcdHJldHVybiBuZXcgVlNDb2RlRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9wcm9maWxlUHJvdmlkZXJzLmRlbGV0ZShpZCk7XG5cdFx0XHR0aGlzLl9wcm94eS4kdW5yZWdpc3RlclByb2ZpbGVQcm92aWRlcihpZCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXJUZXJtaW5hbENvbXBsZXRpb25Qcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgcHJvdmlkZXI6IHZzY29kZS5UZXJtaW5hbENvbXBsZXRpb25Qcm92aWRlcjxUZXJtaW5hbENvbXBsZXRpb25JdGVtPiwgLi4udHJpZ2dlckNoYXJhY3RlcnM6IHN0cmluZ1tdKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGlmICh0aGlzLl9jb21wbGV0aW9uUHJvdmlkZXJzLmhhcyhwcm92aWRlci5pZCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVGVybWluYWwgY29tcGxldGlvbiBwcm92aWRlciBcIiR7cHJvdmlkZXIuaWR9XCIgYWxyZWFkeSByZWdpc3RlcmVkYCk7XG5cdFx0fVxuXHRcdHRoaXMuX2NvbXBsZXRpb25Qcm92aWRlcnMuc2V0KHByb3ZpZGVyLmlkLCBwcm92aWRlcik7XG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVyQ29tcGxldGlvblByb3ZpZGVyKHByb3ZpZGVyLmlkLCBleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSwgLi4udHJpZ2dlckNoYXJhY3RlcnMpO1xuXHRcdHJldHVybiBuZXcgVlNDb2RlRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jb21wbGV0aW9uUHJvdmlkZXJzLmRlbGV0ZShwcm92aWRlci5pZCk7XG5cdFx0XHR0aGlzLl9wcm94eS4kdW5yZWdpc3RlckNvbXBsZXRpb25Qcm92aWRlcihwcm92aWRlci5pZCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJHByb3ZpZGVUZXJtaW5hbENvbXBsZXRpb25zKGlkOiBzdHJpbmcsIG9wdGlvbnM6IElUZXJtaW5hbENvbXBsZXRpb25Db250ZXh0RHRvKTogUHJvbWlzZTxUZXJtaW5hbENvbXBsZXRpb25MaXN0RHRvIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgdG9rZW4gPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKS50b2tlbjtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQgfHwgIXRoaXMuYWN0aXZlVGVybWluYWwpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9jb21wbGV0aW9uUHJvdmlkZXJzLmdldChpZCk7XG5cdFx0aWYgKCFwcm92aWRlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZVRlcm1pbmFsQ29tcGxldGlvbnModGhpcy5hY3RpdmVUZXJtaW5hbCwgb3B0aW9ucywgdG9rZW4pO1xuXHRcdGlmIChjb21wbGV0aW9ucyA9PT0gbnVsbCB8fCBjb21wbGV0aW9ucyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gVGVybWluYWxDb21wbGV0aW9uTGlzdC5mcm9tKGNvbXBsZXRpb25zKTtcblx0fVxuXG5cdHB1YmxpYyAkYWNjZXB0VGVybWluYWxTaGVsbFR5cGUoaWQ6IG51bWJlciwgc2hlbGxUeXBlOiBUZXJtaW5hbFNoZWxsVHlwZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IHRlcm1pbmFsID0gdGhpcy5nZXRUZXJtaW5hbEJ5SWQoaWQpO1xuXHRcdGlmICh0ZXJtaW5hbD8uc2V0U2hlbGxUeXBlKHNoZWxsVHlwZSkpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVGVybWluYWxTdGF0ZS5maXJlKHRlcm1pbmFsLnZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXJUZXJtaW5hbFF1aWNrRml4UHJvdmlkZXIoaWQ6IHN0cmluZywgZXh0ZW5zaW9uSWQ6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5UZXJtaW5hbFF1aWNrRml4UHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0aWYgKHRoaXMuX3F1aWNrRml4UHJvdmlkZXJzLmhhcyhpZCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVGVybWluYWwgcXVpY2sgZml4IHByb3ZpZGVyIFwiJHtpZH1cIiBpcyBhbHJlYWR5IHJlZ2lzdGVyZWRgKTtcblx0XHR9XG5cdFx0dGhpcy5fcXVpY2tGaXhQcm92aWRlcnMuc2V0KGlkLCBwcm92aWRlcik7XG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVyUXVpY2tGaXhQcm92aWRlcihpZCwgZXh0ZW5zaW9uSWQpO1xuXHRcdHJldHVybiBuZXcgVlNDb2RlRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9xdWlja0ZpeFByb3ZpZGVycy5kZWxldGUoaWQpO1xuXHRcdFx0dGhpcy5fcHJveHkuJHVucmVnaXN0ZXJRdWlja0ZpeFByb3ZpZGVyKGlkKTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkcHJvdmlkZVRlcm1pbmFsUXVpY2tGaXhlcyhpZDogc3RyaW5nLCBtYXRjaFJlc3VsdDogVGVybWluYWxDb21tYW5kTWF0Y2hSZXN1bHREdG8pOiBQcm9taXNlPChJVGVybWluYWxRdWlja0ZpeFRlcm1pbmFsQ29tbWFuZER0byB8IElUZXJtaW5hbFF1aWNrRml4T3BlbmVyRHRvIHwgSUNvbW1hbmREdG8pW10gfCBJVGVybWluYWxRdWlja0ZpeFRlcm1pbmFsQ29tbWFuZER0byB8IElUZXJtaW5hbFF1aWNrRml4T3BlbmVyRHRvIHwgSUNvbW1hbmREdG8gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB0b2tlbiA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpLnRva2VuO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuX3F1aWNrRml4UHJvdmlkZXJzLmdldChpZCk7XG5cdFx0aWYgKCFwcm92aWRlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBxdWlja0ZpeGVzID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZVRlcm1pbmFsUXVpY2tGaXhlcyhtYXRjaFJlc3VsdCwgdG9rZW4pO1xuXHRcdGlmIChxdWlja0ZpeGVzID09PSBudWxsIHx8IChBcnJheS5pc0FycmF5KHF1aWNrRml4ZXMpICYmIHF1aWNrRml4ZXMubGVuZ3RoID09PSAwKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0aGlzLl9sYXN0UXVpY2tGaXhDb21tYW5kcy52YWx1ZSA9IHN0b3JlO1xuXG5cdFx0Ly8gU2luZ2xlXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHF1aWNrRml4ZXMpKSB7XG5cdFx0XHRyZXR1cm4gcXVpY2tGaXhlcyA/IFRlcm1pbmFsUXVpY2tGaXguZnJvbShxdWlja0ZpeGVzLCB0aGlzLl9leHRIb3N0Q29tbWFuZHMuY29udmVydGVyLCBzdG9yZSkgOiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gTWFueVxuXHRcdGNvbnN0IHJlc3VsdCA9IFtdO1xuXHRcdGZvciAoY29uc3QgZml4IG9mIHF1aWNrRml4ZXMpIHtcblx0XHRcdGNvbnN0IGNvbnZlcnRlZCA9IFRlcm1pbmFsUXVpY2tGaXguZnJvbShmaXgsIHRoaXMuX2V4dEhvc3RDb21tYW5kcy5jb252ZXJ0ZXIsIHN0b3JlKTtcblx0XHRcdGlmIChjb252ZXJ0ZWQpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goY29udmVydGVkKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkY3JlYXRlQ29udHJpYnV0ZWRQcm9maWxlVGVybWluYWwoaWQ6IHN0cmluZywgb3B0aW9uczogSUNyZWF0ZUNvbnRyaWJ1dGVkVGVybWluYWxQcm9maWxlT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRva2VuID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCkudG9rZW47XG5cdFx0bGV0IHByb2ZpbGUgPSBhd2FpdCB0aGlzLl9wcm9maWxlUHJvdmlkZXJzLmdldChpZCk/LnByb3ZpZGVUZXJtaW5hbFByb2ZpbGUodG9rZW4pO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAocHJvZmlsZSAmJiAhKCdvcHRpb25zJyBpbiBwcm9maWxlKSkge1xuXHRcdFx0cHJvZmlsZSA9IHsgb3B0aW9uczogcHJvZmlsZSB9O1xuXHRcdH1cblxuXHRcdGlmICghcHJvZmlsZSB8fCAhKCdvcHRpb25zJyBpbiBwcm9maWxlKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBObyB0ZXJtaW5hbCBwcm9maWxlIG9wdGlvbnMgcHJvdmlkZWQgZm9yIGlkIFwiJHtpZH1cImApO1xuXHRcdH1cblxuXHRcdGlmICgncHR5JyBpbiBwcm9maWxlLm9wdGlvbnMpIHtcblx0XHRcdHRoaXMuY3JlYXRlRXh0ZW5zaW9uVGVybWluYWwocHJvZmlsZS5vcHRpb25zLCBvcHRpb25zKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5jcmVhdGVUZXJtaW5hbEZyb21PcHRpb25zKHByb2ZpbGUub3B0aW9ucywgb3B0aW9ucyk7XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXJMaW5rUHJvdmlkZXIocHJvdmlkZXI6IHZzY29kZS5UZXJtaW5hbExpbmtQcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHR0aGlzLl9saW5rUHJvdmlkZXJzLmFkZChwcm92aWRlcik7XG5cdFx0aWYgKHRoaXMuX2xpbmtQcm92aWRlcnMuc2l6ZSA9PT0gMSkge1xuXHRcdFx0dGhpcy5fcHJveHkuJHN0YXJ0TGlua1Byb3ZpZGVyKCk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgVlNDb2RlRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9saW5rUHJvdmlkZXJzLmRlbGV0ZShwcm92aWRlcik7XG5cdFx0XHRpZiAodGhpcy5fbGlua1Byb3ZpZGVycy5zaXplID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRzdG9wTGlua1Byb3ZpZGVyKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJHByb3ZpZGVMaW5rcyh0ZXJtaW5hbElkOiBudW1iZXIsIGxpbmU6IHN0cmluZyk6IFByb21pc2U8SVRlcm1pbmFsTGlua0R0b1tdPiB7XG5cdFx0Y29uc3QgdGVybWluYWwgPSB0aGlzLmdldFRlcm1pbmFsQnlJZCh0ZXJtaW5hbElkKTtcblx0XHRpZiAoIXRlcm1pbmFsKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Ly8gRGlzY2FyZCBhbnkgY2FjaGVkIGxpbmtzIHRoZSB0ZXJtaW5hbCBoYXMgYmVlbiBob2xkaW5nLCBjdXJyZW50bHkgYWxsIGxpbmtzIGFyZSByZWxlYXNlZFxuXHRcdC8vIHdoZW4gbmV3IGxpbmtzIGFyZSBwcm92aWRlZC5cblx0XHR0aGlzLl90ZXJtaW5hbExpbmtDYWNoZS5kZWxldGUodGVybWluYWxJZCk7XG5cblx0XHRjb25zdCBvbGRUb2tlbiA9IHRoaXMuX3Rlcm1pbmFsTGlua0NhbmNlbGxhdGlvblNvdXJjZS5nZXQodGVybWluYWxJZCk7XG5cdFx0b2xkVG9rZW4/LmRpc3Bvc2UodHJ1ZSk7XG5cdFx0Y29uc3QgY2FuY2VsbGF0aW9uU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0dGhpcy5fdGVybWluYWxMaW5rQ2FuY2VsbGF0aW9uU291cmNlLnNldCh0ZXJtaW5hbElkLCBjYW5jZWxsYXRpb25Tb3VyY2UpO1xuXG5cdFx0Y29uc3QgcmVzdWx0OiBJVGVybWluYWxMaW5rRHRvW10gPSBbXTtcblx0XHRjb25zdCBjb250ZXh0OiB2c2NvZGUuVGVybWluYWxMaW5rQ29udGV4dCA9IHsgdGVybWluYWw6IHRlcm1pbmFsLnZhbHVlLCBsaW5lIH07XG5cdFx0Y29uc3QgcHJvbWlzZXM6IHZzY29kZS5Qcm92aWRlclJlc3VsdDx7IHByb3ZpZGVyOiB2c2NvZGUuVGVybWluYWxMaW5rUHJvdmlkZXI7IGxpbmtzOiB2c2NvZGUuVGVybWluYWxMaW5rW10gfT5bXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBwcm92aWRlciBvZiB0aGlzLl9saW5rUHJvdmlkZXJzKSB7XG5cdFx0XHRwcm9taXNlcy5wdXNoKFByb21pc2VzLndpdGhBc3luY0JvZHkoYXN5bmMgciA9PiB7XG5cdFx0XHRcdGNhbmNlbGxhdGlvblNvdXJjZS50b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiByKHsgcHJvdmlkZXIsIGxpbmtzOiBbXSB9KSk7XG5cdFx0XHRcdGNvbnN0IGxpbmtzID0gKGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVUZXJtaW5hbExpbmtzKGNvbnRleHQsIGNhbmNlbGxhdGlvblNvdXJjZS50b2tlbikpIHx8IFtdO1xuXHRcdFx0XHRpZiAoIWNhbmNlbGxhdGlvblNvdXJjZS50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHIoeyBwcm92aWRlciwgbGlua3MgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHRjb25zdCBwcm92aWRlUmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcblxuXHRcdGlmIChjYW5jZWxsYXRpb25Tb3VyY2UudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBjYWNoZUxpbmtNYXAgPSBuZXcgTWFwPG51bWJlciwgSUNhY2hlZExpbmtFbnRyeT4oKTtcblx0XHRmb3IgKGNvbnN0IHByb3ZpZGVSZXN1bHQgb2YgcHJvdmlkZVJlc3VsdHMpIHtcblx0XHRcdGlmIChwcm92aWRlUmVzdWx0ICYmIHByb3ZpZGVSZXN1bHQubGlua3MubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRyZXN1bHQucHVzaCguLi5wcm92aWRlUmVzdWx0LmxpbmtzLm1hcChwcm92aWRlckxpbmsgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGxpbmsgPSB7XG5cdFx0XHRcdFx0XHRpZDogbmV4dExpbmtJZCsrLFxuXHRcdFx0XHRcdFx0c3RhcnRJbmRleDogcHJvdmlkZXJMaW5rLnN0YXJ0SW5kZXgsXG5cdFx0XHRcdFx0XHRsZW5ndGg6IHByb3ZpZGVyTGluay5sZW5ndGgsXG5cdFx0XHRcdFx0XHRsYWJlbDogcHJvdmlkZXJMaW5rLnRvb2x0aXBcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdGNhY2hlTGlua01hcC5zZXQobGluay5pZCwge1xuXHRcdFx0XHRcdFx0cHJvdmlkZXI6IHByb3ZpZGVSZXN1bHQucHJvdmlkZXIsXG5cdFx0XHRcdFx0XHRsaW5rOiBwcm92aWRlckxpbmtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRyZXR1cm4gbGluaztcblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3Rlcm1pbmFsTGlua0NhY2hlLnNldCh0ZXJtaW5hbElkLCBjYWNoZUxpbmtNYXApO1xuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdCRhY3RpdmF0ZUxpbmsodGVybWluYWxJZDogbnVtYmVyLCBsaW5rSWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGNhY2hlZExpbmsgPSB0aGlzLl90ZXJtaW5hbExpbmtDYWNoZS5nZXQodGVybWluYWxJZCk/LmdldChsaW5rSWQpO1xuXHRcdGlmICghY2FjaGVkTGluaykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjYWNoZWRMaW5rLnByb3ZpZGVyLmhhbmRsZVRlcm1pbmFsTGluayhjYWNoZWRMaW5rLmxpbmspO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25Qcm9jZXNzRXhpdChpZDogbnVtYmVyLCBleGl0Q29kZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fYnVmZmVyZXIuc3RvcEJ1ZmZlcmluZyhpZCk7XG5cblx0XHQvLyBSZW1vdmUgcHJvY2VzcyByZWZlcmVuY2Vcblx0XHR0aGlzLl90ZXJtaW5hbFByb2Nlc3Nlcy5kZWxldGUoaWQpO1xuXHRcdGRlbGV0ZSB0aGlzLl9leHRlbnNpb25UZXJtaW5hbEF3YWl0aW5nU3RhcnRbaWRdO1xuXG5cdFx0Ly8gQ2xlYW4gdXAgcHJvY2VzcyBkaXNwb3NhYmxlc1xuXHRcdGNvbnN0IHByb2Nlc3NEaXBvc2FibGUgPSB0aGlzLl90ZXJtaW5hbFByb2Nlc3NEaXNwb3NhYmxlc1tpZF07XG5cdFx0aWYgKHByb2Nlc3NEaXBvc2FibGUpIHtcblx0XHRcdHByb2Nlc3NEaXBvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0ZGVsZXRlIHRoaXMuX3Rlcm1pbmFsUHJvY2Vzc0Rpc3Bvc2FibGVzW2lkXTtcblx0XHR9XG5cdFx0Ly8gU2VuZCBleGl0IGV2ZW50IHRvIG1haW4gc2lkZVxuXHRcdHRoaXMuX3Byb3h5LiRzZW5kUHJvY2Vzc0V4aXQoaWQsIGV4aXRDb2RlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRUZXJtaW5hbEJ5SWQoaWQ6IG51bWJlcik6IEV4dEhvc3RUZXJtaW5hbCB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9nZXRUZXJtaW5hbE9iamVjdEJ5SWQodGhpcy5fdGVybWluYWxzLCBpZCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VGVybWluYWxJZEJ5QXBpT2JqZWN0KHRlcm1pbmFsOiB2c2NvZGUuVGVybWluYWwpOiBudW1iZXIgfCBudWxsIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMuX3Rlcm1pbmFscy5maW5kSW5kZXgoaXRlbSA9PiB7XG5cdFx0XHRyZXR1cm4gaXRlbS52YWx1ZSA9PT0gdGVybWluYWw7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGluZGV4ID49IDAgPyBpbmRleCA6IG51bGw7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRUZXJtaW5hbE9iamVjdEJ5SWQ8VCBleHRlbmRzIEV4dEhvc3RUZXJtaW5hbD4oYXJyYXk6IFRbXSwgaWQ6IG51bWJlcik6IFQgfCBudWxsIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMuX2dldFRlcm1pbmFsT2JqZWN0SW5kZXhCeUlkKGFycmF5LCBpZCk7XG5cdFx0cmV0dXJuIGluZGV4ICE9PSBudWxsID8gYXJyYXlbaW5kZXhdIDogbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgX2dldFRlcm1pbmFsT2JqZWN0SW5kZXhCeUlkPFQgZXh0ZW5kcyBFeHRIb3N0VGVybWluYWw+KGFycmF5OiBUW10sIGlkOiBFeHRIb3N0VGVybWluYWxJZGVudGlmaWVyKTogbnVtYmVyIHwgbnVsbCB7XG5cdFx0Y29uc3QgaW5kZXggPSBhcnJheS5maW5kSW5kZXgoaXRlbSA9PiB7XG5cdFx0XHRyZXR1cm4gaXRlbS5faWQgPT09IGlkO1xuXHRcdH0pO1xuXHRcdHJldHVybiBpbmRleCA+PSAwID8gaW5kZXggOiBudWxsO1xuXHR9XG5cblx0cHVibGljIGdldEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogSUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uIHtcblx0XHRsZXQgY29sbGVjdGlvbiA9IHRoaXMuX2Vudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9ucy5nZXQoZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWUpO1xuXHRcdGlmICghY29sbGVjdGlvbikge1xuXHRcdFx0Y29sbGVjdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBVbmlmaWVkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oKSk7XG5cdFx0XHR0aGlzLl9zZXRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSwgY29sbGVjdGlvbik7XG5cdFx0fVxuXHRcdHJldHVybiBjb2xsZWN0aW9uLmdldFNjb3BlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIF9zeW5jRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oZXh0ZW5zaW9uSWRlbnRpZmllcjogc3RyaW5nLCBjb2xsZWN0aW9uOiBVbmlmaWVkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24pOiB2b2lkIHtcblx0XHRjb25zdCBzZXJpYWxpemVkID0gc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oY29sbGVjdGlvbi5tYXApO1xuXHRcdGNvbnN0IHNlcmlhbGl6ZWREZXNjcmlwdGlvbiA9IHNlcmlhbGl6ZUVudmlyb25tZW50RGVzY3JpcHRpb25NYXAoY29sbGVjdGlvbi5kZXNjcmlwdGlvbk1hcCk7XG5cdFx0dGhpcy5fcHJveHkuJHNldEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKGV4dGVuc2lvbklkZW50aWZpZXIsIGNvbGxlY3Rpb24ucGVyc2lzdGVudCwgc2VyaWFsaXplZC5sZW5ndGggPT09IDAgPyB1bmRlZmluZWQgOiBzZXJpYWxpemVkLCBzZXJpYWxpemVkRGVzY3JpcHRpb24pO1xuXHR9XG5cblx0cHVibGljICRpbml0RW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb25zKGNvbGxlY3Rpb25zOiBbc3RyaW5nLCBJU2VyaWFsaXphYmxlRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb25dW10pOiB2b2lkIHtcblx0XHRjb2xsZWN0aW9ucy5mb3JFYWNoKGVudHJ5ID0+IHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbklkZW50aWZpZXIgPSBlbnRyeVswXTtcblx0XHRcdGNvbnN0IGNvbGxlY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgVW5pZmllZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKGVudHJ5WzFdKSk7XG5cdFx0XHR0aGlzLl9zZXRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihleHRlbnNpb25JZGVudGlmaWVyLCBjb2xsZWN0aW9uKTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyAkYWNjZXB0RGVmYXVsdFByb2ZpbGUocHJvZmlsZTogSVRlcm1pbmFsUHJvZmlsZSwgYXV0b21hdGlvblByb2ZpbGU6IElUZXJtaW5hbFByb2ZpbGUpOiB2b2lkIHtcblx0XHRjb25zdCBvbGRQcm9maWxlID0gdGhpcy5fZGVmYXVsdFByb2ZpbGU7XG5cdFx0dGhpcy5fZGVmYXVsdFByb2ZpbGUgPSBwcm9maWxlO1xuXHRcdHRoaXMuX2RlZmF1bHRBdXRvbWF0aW9uUHJvZmlsZSA9IGF1dG9tYXRpb25Qcm9maWxlO1xuXHRcdGlmIChvbGRQcm9maWxlPy5wYXRoICE9PSBwcm9maWxlLnBhdGgpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU2hlbGwuZmlyZShwcm9maWxlLnBhdGgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NldEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKGV4dGVuc2lvbklkZW50aWZpZXI6IHN0cmluZywgY29sbGVjdGlvbjogVW5pZmllZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKTogdm9pZCB7XG5cdFx0dGhpcy5fZW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb25zLnNldChleHRlbnNpb25JZGVudGlmaWVyLCBjb2xsZWN0aW9uKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb2xsZWN0aW9uLm9uRGlkQ2hhbmdlQ29sbGVjdGlvbigoKSA9PiB7XG5cdFx0XHQvLyBXaGVuIGFueSBjb2xsZWN0aW9uIHZhbHVlIGNoYW5nZXMgc2VuZCB0aGlzIGltbWVkaWF0ZWx5LCB0aGlzIGlzIGRvbmUgdG8gZW5zdXJlXG5cdFx0XHQvLyBmb2xsb3dpbmcgY2FsbHMgdG8gY3JlYXRlVGVybWluYWwgd2lsbCBiZSBjcmVhdGVkIHdpdGggdGhlIG5ldyBlbnZpcm9ubWVudC4gSXQgd2lsbFxuXHRcdFx0Ly8gcmVzdWx0IGluIG1vcmUgbm9pc2UgYnkgc2VuZGluZyBtdWx0aXBsZSB1cGRhdGVzIHdoZW4gY2FsbGVkIGJ1dCBjb2xsZWN0aW9ucyBhcmVcblx0XHRcdC8vIGV4cGVjdGVkIHRvIGJlIHNtYWxsLlxuXHRcdFx0dGhpcy5fc3luY0Vudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKGV4dGVuc2lvbklkZW50aWZpZXIsIGNvbGxlY3Rpb24pO1xuXHRcdH0pKTtcblx0fVxufVxuXG4vKipcbiAqIFVuaWZpZWQgZW52aXJvbm1lbnQgdmFyaWFibGUgY29sbGVjdGlvbiBjYXJyeWluZyBpbmZvcm1hdGlvbiBmb3IgYWxsIHNjb3BlcywgZm9yIGEgc3BlY2lmaWMgZXh0ZW5zaW9uLlxuICovXG5jbGFzcyBVbmlmaWVkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cmVhZG9ubHkgbWFwOiBNYXA8c3RyaW5nLCBJRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3I+ID0gbmV3IE1hcCgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHNjb3BlZENvbGxlY3Rpb25zOiBNYXA8c3RyaW5nLCBTY29wZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbj4gPSBuZXcgTWFwKCk7XG5cdHJlYWRvbmx5IGRlc2NyaXB0aW9uTWFwOiBNYXA8c3RyaW5nLCBJRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb25EZXNjcmlwdGlvbj4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgX3BlcnNpc3RlbnQ6IGJvb2xlYW4gPSB0cnVlO1xuXG5cdHB1YmxpYyBnZXQgcGVyc2lzdGVudCgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX3BlcnNpc3RlbnQ7IH1cblx0cHVibGljIHNldCBwZXJzaXN0ZW50KHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fcGVyc2lzdGVudCA9IHZhbHVlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29sbGVjdGlvbi5maXJlKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ29sbGVjdGlvbjogRW1pdHRlcjx2b2lkPiA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdGdldCBvbkRpZENoYW5nZUNvbGxlY3Rpb24oKTogRXZlbnQ8dm9pZD4geyByZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VDb2xsZWN0aW9uICYmIHRoaXMuX29uRGlkQ2hhbmdlQ29sbGVjdGlvbi5ldmVudDsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHNlcmlhbGl6ZWQ/OiBJU2VyaWFsaXphYmxlRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb25cblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLm1hcCA9IG5ldyBNYXAoc2VyaWFsaXplZCk7XG5cdH1cblxuXHRnZXRTY29wZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihzY29wZTogdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVTY29wZSB8IHVuZGVmaW5lZCk6IElFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbiB7XG5cdFx0Y29uc3Qgc2NvcGVkQ29sbGVjdGlvbktleSA9IHRoaXMuZ2V0U2NvcGVLZXkoc2NvcGUpO1xuXHRcdGxldCBzY29wZWRDb2xsZWN0aW9uID0gdGhpcy5zY29wZWRDb2xsZWN0aW9ucy5nZXQoc2NvcGVkQ29sbGVjdGlvbktleSk7XG5cdFx0aWYgKCFzY29wZWRDb2xsZWN0aW9uKSB7XG5cdFx0XHRzY29wZWRDb2xsZWN0aW9uID0gbmV3IFNjb3BlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKHRoaXMsIHNjb3BlKTtcblx0XHRcdHRoaXMuc2NvcGVkQ29sbGVjdGlvbnMuc2V0KHNjb3BlZENvbGxlY3Rpb25LZXksIHNjb3BlZENvbGxlY3Rpb24pO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoc2NvcGVkQ29sbGVjdGlvbi5vbkRpZENoYW5nZUNvbGxlY3Rpb24oKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VDb2xsZWN0aW9uLmZpcmUoKSkpO1xuXHRcdH1cblx0XHRyZXR1cm4gc2NvcGVkQ29sbGVjdGlvbjtcblx0fVxuXG5cdHJlcGxhY2UodmFyaWFibGU6IHN0cmluZywgdmFsdWU6IHN0cmluZywgb3B0aW9uczogdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCwgc2NvcGU6IHZzY29kZS5FbnZpcm9ubWVudFZhcmlhYmxlU2NvcGUgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLl9zZXRJZkRpZmZlcnModmFyaWFibGUsIHsgdmFsdWUsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5SZXBsYWNlLCBvcHRpb25zOiBvcHRpb25zID8/IHsgYXBwbHlBdFByb2Nlc3NDcmVhdGlvbjogdHJ1ZSB9LCBzY29wZSB9KTtcblx0fVxuXG5cdGFwcGVuZCh2YXJpYWJsZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBvcHRpb25zOiB2c2NvZGUuRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JPcHRpb25zIHwgdW5kZWZpbmVkLCBzY29wZTogdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVTY29wZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX3NldElmRGlmZmVycyh2YXJpYWJsZSwgeyB2YWx1ZSwgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLkFwcGVuZCwgb3B0aW9uczogb3B0aW9ucyA/PyB7IGFwcGx5QXRQcm9jZXNzQ3JlYXRpb246IHRydWUgfSwgc2NvcGUgfSk7XG5cdH1cblxuXHRwcmVwZW5kKHZhcmlhYmxlOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIG9wdGlvbnM6IHZzY29kZS5FbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvck9wdGlvbnMgfCB1bmRlZmluZWQsIHNjb3BlOiB2c2NvZGUuRW52aXJvbm1lbnRWYXJpYWJsZVNjb3BlIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fc2V0SWZEaWZmZXJzKHZhcmlhYmxlLCB7IHZhbHVlLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUHJlcGVuZCwgb3B0aW9uczogb3B0aW9ucyA/PyB7IGFwcGx5QXRQcm9jZXNzQ3JlYXRpb246IHRydWUgfSwgc2NvcGUgfSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRJZkRpZmZlcnModmFyaWFibGU6IHN0cmluZywgbXV0YXRvcjogdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yICYgeyBzY29wZTogdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVTY29wZSB8IHVuZGVmaW5lZCB9KTogdm9pZCB7XG5cdFx0aWYgKG11dGF0b3Iub3B0aW9ucyAmJiBtdXRhdG9yLm9wdGlvbnMuYXBwbHlBdFByb2Nlc3NDcmVhdGlvbiA9PT0gZmFsc2UgJiYgIW11dGF0b3Iub3B0aW9ucy5hcHBseUF0U2hlbGxJbnRlZ3JhdGlvbikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvck9wdGlvbnMgbXVzdCBhcHBseSBhdCBlaXRoZXIgcHJvY2VzcyBjcmVhdGlvbiBvciBzaGVsbCBpbnRlZ3JhdGlvbicpO1xuXHRcdH1cblx0XHRjb25zdCBrZXkgPSB0aGlzLmdldEtleSh2YXJpYWJsZSwgbXV0YXRvci5zY29wZSk7XG5cdFx0Y29uc3QgY3VycmVudCA9IHRoaXMubWFwLmdldChrZXkpO1xuXHRcdGNvbnN0IG5ld09wdGlvbnMgPSBtdXRhdG9yLm9wdGlvbnMgPyB7XG5cdFx0XHRhcHBseUF0UHJvY2Vzc0NyZWF0aW9uOiBtdXRhdG9yLm9wdGlvbnMuYXBwbHlBdFByb2Nlc3NDcmVhdGlvbiA/PyBmYWxzZSxcblx0XHRcdGFwcGx5QXRTaGVsbEludGVncmF0aW9uOiBtdXRhdG9yLm9wdGlvbnMuYXBwbHlBdFNoZWxsSW50ZWdyYXRpb24gPz8gZmFsc2UsXG5cdFx0fSA6IHtcblx0XHRcdGFwcGx5QXRQcm9jZXNzQ3JlYXRpb246IHRydWVcblx0XHR9O1xuXHRcdGlmIChcblx0XHRcdCFjdXJyZW50IHx8XG5cdFx0XHRjdXJyZW50LnZhbHVlICE9PSBtdXRhdG9yLnZhbHVlIHx8XG5cdFx0XHRjdXJyZW50LnR5cGUgIT09IG11dGF0b3IudHlwZSB8fFxuXHRcdFx0Y3VycmVudC5vcHRpb25zPy5hcHBseUF0UHJvY2Vzc0NyZWF0aW9uICE9PSBuZXdPcHRpb25zLmFwcGx5QXRQcm9jZXNzQ3JlYXRpb24gfHxcblx0XHRcdGN1cnJlbnQub3B0aW9ucz8uYXBwbHlBdFNoZWxsSW50ZWdyYXRpb24gIT09IG5ld09wdGlvbnMuYXBwbHlBdFNoZWxsSW50ZWdyYXRpb24gfHxcblx0XHRcdGN1cnJlbnQuc2NvcGU/LndvcmtzcGFjZUZvbGRlcj8uaW5kZXggIT09IG11dGF0b3Iuc2NvcGU/LndvcmtzcGFjZUZvbGRlcj8uaW5kZXhcblx0XHQpIHtcblx0XHRcdGNvbnN0IGtleSA9IHRoaXMuZ2V0S2V5KHZhcmlhYmxlLCBtdXRhdG9yLnNjb3BlKTtcblx0XHRcdGNvbnN0IHZhbHVlOiBJRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3IgPSB7XG5cdFx0XHRcdHZhcmlhYmxlLFxuXHRcdFx0XHQuLi5tdXRhdG9yLFxuXHRcdFx0XHRvcHRpb25zOiBuZXdPcHRpb25zXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5tYXAuc2V0KGtleSwgdmFsdWUpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb2xsZWN0aW9uLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRnZXQodmFyaWFibGU6IHN0cmluZywgc2NvcGU6IHZzY29kZS5FbnZpcm9ubWVudFZhcmlhYmxlU2NvcGUgfCB1bmRlZmluZWQpOiB2c2NvZGUuRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3IgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGtleSA9IHRoaXMuZ2V0S2V5KHZhcmlhYmxlLCBzY29wZSk7XG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLm1hcC5nZXQoa2V5KTtcblx0XHQvLyBUT0RPOiBTZXQgb3B0aW9ucyB0byBkZWZhdWx0cyBpZiBuZWVkZWRcblx0XHRyZXR1cm4gdmFsdWUgPyBjb252ZXJ0TXV0YXRvcih2YWx1ZSkgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGdldEtleSh2YXJpYWJsZTogc3RyaW5nLCBzY29wZTogdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVTY29wZSB8IHVuZGVmaW5lZCkge1xuXHRcdGNvbnN0IHNjb3BlS2V5ID0gdGhpcy5nZXRTY29wZUtleShzY29wZSk7XG5cdFx0cmV0dXJuIHNjb3BlS2V5Lmxlbmd0aCA/IGAke3ZhcmlhYmxlfTo6OiR7c2NvcGVLZXl9YCA6IHZhcmlhYmxlO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTY29wZUtleShzY29wZTogdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVTY29wZSB8IHVuZGVmaW5lZCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0V29ya3NwYWNlS2V5KHNjb3BlPy53b3Jrc3BhY2VGb2xkZXIpID8/ICcnO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRXb3Jrc3BhY2VLZXkod29ya3NwYWNlRm9sZGVyOiB2c2NvZGUuV29ya3NwYWNlRm9sZGVyIHwgdW5kZWZpbmVkKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gd29ya3NwYWNlRm9sZGVyID8gd29ya3NwYWNlRm9sZGVyLnVyaS50b1N0cmluZygpIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIGdldFZhcmlhYmxlTWFwKHNjb3BlOiB2c2NvZGUuRW52aXJvbm1lbnRWYXJpYWJsZVNjb3BlIHwgdW5kZWZpbmVkKTogTWFwPHN0cmluZywgdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yPiB7XG5cdFx0Y29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIHZzY29kZS5FbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvcj4oKTtcblx0XHRmb3IgKGNvbnN0IFtfLCB2YWx1ZV0gb2YgdGhpcy5tYXApIHtcblx0XHRcdGlmICh0aGlzLmdldFNjb3BlS2V5KHZhbHVlLnNjb3BlKSA9PT0gdGhpcy5nZXRTY29wZUtleShzY29wZSkpIHtcblx0XHRcdFx0bWFwLnNldCh2YWx1ZS52YXJpYWJsZSwgY29udmVydE11dGF0b3IodmFsdWUpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG1hcDtcblx0fVxuXG5cdGRlbGV0ZSh2YXJpYWJsZTogc3RyaW5nLCBzY29wZTogdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVTY29wZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IGtleSA9IHRoaXMuZ2V0S2V5KHZhcmlhYmxlLCBzY29wZSk7XG5cdFx0dGhpcy5tYXAuZGVsZXRlKGtleSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb2xsZWN0aW9uLmZpcmUoKTtcblx0fVxuXG5cdGNsZWFyKHNjb3BlOiB2c2NvZGUuRW52aXJvbm1lbnRWYXJpYWJsZVNjb3BlIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKHNjb3BlPy53b3Jrc3BhY2VGb2xkZXIpIHtcblx0XHRcdGZvciAoY29uc3QgW2tleSwgbXV0YXRvcl0gb2YgdGhpcy5tYXApIHtcblx0XHRcdFx0aWYgKG11dGF0b3Iuc2NvcGU/LndvcmtzcGFjZUZvbGRlcj8uaW5kZXggPT09IHNjb3BlLndvcmtzcGFjZUZvbGRlci5pbmRleCkge1xuXHRcdFx0XHRcdHRoaXMubWFwLmRlbGV0ZShrZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmNsZWFyRGVzY3JpcHRpb24oc2NvcGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm1hcC5jbGVhcigpO1xuXHRcdFx0dGhpcy5kZXNjcmlwdGlvbk1hcC5jbGVhcigpO1xuXHRcdH1cblx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbGxlY3Rpb24uZmlyZSgpO1xuXHR9XG5cblx0c2V0RGVzY3JpcHRpb24oZGVzY3JpcHRpb246IHN0cmluZyB8IHZzY29kZS5NYXJrZG93blN0cmluZyB8IHVuZGVmaW5lZCwgc2NvcGU6IHZzY29kZS5FbnZpcm9ubWVudFZhcmlhYmxlU2NvcGUgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBrZXkgPSB0aGlzLmdldFNjb3BlS2V5KHNjb3BlKTtcblx0XHRjb25zdCBjdXJyZW50ID0gdGhpcy5kZXNjcmlwdGlvbk1hcC5nZXQoa2V5KTtcblx0XHRpZiAoIWN1cnJlbnQgfHwgY3VycmVudC5kZXNjcmlwdGlvbiAhPT0gZGVzY3JpcHRpb24pIHtcblx0XHRcdGxldCBkZXNjcmlwdGlvblN0cjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHR5cGVvZiBkZXNjcmlwdGlvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0ZGVzY3JpcHRpb25TdHIgPSBkZXNjcmlwdGlvbjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIE9ubHkgdGFrZSB0aGUgZGVzY3JpcHRpb24gYmVmb3JlIHRoZSBmaXJzdCBgXFxuXFxuYCwgc28gdGhhdCB0aGUgZGVzY3JpcHRpb24gZG9lc24ndCBtZXNzIHVwIHRoZSBVSVxuXHRcdFx0XHRkZXNjcmlwdGlvblN0ciA9IGRlc2NyaXB0aW9uPy52YWx1ZS5zcGxpdCgnXFxuXFxuJylbMF07XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB2YWx1ZTogSUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uRGVzY3JpcHRpb24gPSB7IGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvblN0ciwgc2NvcGUgfTtcblx0XHRcdHRoaXMuZGVzY3JpcHRpb25NYXAuc2V0KGtleSwgdmFsdWUpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb2xsZWN0aW9uLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0RGVzY3JpcHRpb24oc2NvcGU6IHZzY29kZS5FbnZpcm9ubWVudFZhcmlhYmxlU2NvcGUgfCB1bmRlZmluZWQpOiBzdHJpbmcgfCB2c2NvZGUuTWFya2Rvd25TdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGtleSA9IHRoaXMuZ2V0U2NvcGVLZXkoc2NvcGUpO1xuXHRcdHJldHVybiB0aGlzLmRlc2NyaXB0aW9uTWFwLmdldChrZXkpPy5kZXNjcmlwdGlvbjtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXJEZXNjcmlwdGlvbihzY29wZTogdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVTY29wZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IGtleSA9IHRoaXMuZ2V0U2NvcGVLZXkoc2NvcGUpO1xuXHRcdHRoaXMuZGVzY3JpcHRpb25NYXAuZGVsZXRlKGtleSk7XG5cdH1cbn1cblxuY2xhc3MgU2NvcGVkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gaW1wbGVtZW50cyBJRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24ge1xuXHRwdWJsaWMgZ2V0IHBlcnNpc3RlbnQoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLmNvbGxlY3Rpb24ucGVyc2lzdGVudDsgfVxuXHRwdWJsaWMgc2V0IHBlcnNpc3RlbnQodmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLmNvbGxlY3Rpb24ucGVyc2lzdGVudCA9IHZhbHVlO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbGxlY3Rpb24gPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRnZXQgb25EaWRDaGFuZ2VDb2xsZWN0aW9uKCk6IEV2ZW50PHZvaWQ+IHsgcmV0dXJuIHRoaXMuX29uRGlkQ2hhbmdlQ29sbGVjdGlvbiAmJiB0aGlzLl9vbkRpZENoYW5nZUNvbGxlY3Rpb24uZXZlbnQ7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbGxlY3Rpb246IFVuaWZpZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IHNjb3BlOiB2c2NvZGUuRW52aXJvbm1lbnRWYXJpYWJsZVNjb3BlIHwgdW5kZWZpbmVkXG5cdCkge1xuXHR9XG5cblx0Z2V0U2NvcGVkKHNjb3BlOiB2c2NvZGUuRW52aXJvbm1lbnRWYXJpYWJsZVNjb3BlIHwgdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIHRoaXMuY29sbGVjdGlvbi5nZXRTY29wZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihzY29wZSk7XG5cdH1cblxuXHRyZXBsYWNlKHZhcmlhYmxlOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIG9wdGlvbnM/OiB2c2NvZGUuRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JPcHRpb25zIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5jb2xsZWN0aW9uLnJlcGxhY2UodmFyaWFibGUsIHZhbHVlLCBvcHRpb25zLCB0aGlzLnNjb3BlKTtcblx0fVxuXG5cdGFwcGVuZCh2YXJpYWJsZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBvcHRpb25zPzogdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuY29sbGVjdGlvbi5hcHBlbmQodmFyaWFibGUsIHZhbHVlLCBvcHRpb25zLCB0aGlzLnNjb3BlKTtcblx0fVxuXG5cdHByZXBlbmQodmFyaWFibGU6IHN0cmluZywgdmFsdWU6IHN0cmluZywgb3B0aW9ucz86IHZzY29kZS5FbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvck9wdGlvbnMgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLmNvbGxlY3Rpb24ucHJlcGVuZCh2YXJpYWJsZSwgdmFsdWUsIG9wdGlvbnMsIHRoaXMuc2NvcGUpO1xuXHR9XG5cblx0Z2V0KHZhcmlhYmxlOiBzdHJpbmcpOiB2c2NvZGUuRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3IgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmNvbGxlY3Rpb24uZ2V0KHZhcmlhYmxlLCB0aGlzLnNjb3BlKTtcblx0fVxuXG5cdGZvckVhY2goY2FsbGJhY2s6ICh2YXJpYWJsZTogc3RyaW5nLCBtdXRhdG9yOiB2c2NvZGUuRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3IsIGNvbGxlY3Rpb246IHZzY29kZS5FbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbikgPT4gYW55LCB0aGlzQXJnPzogYW55KTogdm9pZCB7XG5cdFx0dGhpcy5jb2xsZWN0aW9uLmdldFZhcmlhYmxlTWFwKHRoaXMuc2NvcGUpLmZvckVhY2goKHZhbHVlLCB2YXJpYWJsZSkgPT4gY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB2YXJpYWJsZSwgdmFsdWUsIHRoaXMpLCB0aGlzLnNjb3BlKTtcblx0fVxuXG5cdFtTeW1ib2wuaXRlcmF0b3JdKCk6IEl0ZXJhYmxlSXRlcmF0b3I8W3ZhcmlhYmxlOiBzdHJpbmcsIG11dGF0b3I6IHZzY29kZS5FbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvcl0+IHtcblx0XHRyZXR1cm4gdGhpcy5jb2xsZWN0aW9uLmdldFZhcmlhYmxlTWFwKHRoaXMuc2NvcGUpLmVudHJpZXMoKTtcblx0fVxuXG5cdGRlbGV0ZSh2YXJpYWJsZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5jb2xsZWN0aW9uLmRlbGV0ZSh2YXJpYWJsZSwgdGhpcy5zY29wZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb2xsZWN0aW9uLmZpcmUodW5kZWZpbmVkKTtcblx0fVxuXG5cdGNsZWFyKCk6IHZvaWQge1xuXHRcdHRoaXMuY29sbGVjdGlvbi5jbGVhcih0aGlzLnNjb3BlKTtcblx0fVxuXG5cdHNldCBkZXNjcmlwdGlvbihkZXNjcmlwdGlvbjogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5jb2xsZWN0aW9uLnNldERlc2NyaXB0aW9uKGRlc2NyaXB0aW9uLCB0aGlzLnNjb3BlKTtcblx0fVxuXG5cdGdldCBkZXNjcmlwdGlvbigpOiBzdHJpbmcgfCB2c2NvZGUuTWFya2Rvd25TdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmNvbGxlY3Rpb24uZ2V0RGVzY3JpcHRpb24odGhpcy5zY29wZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFdvcmtlckV4dEhvc3RUZXJtaW5hbFNlcnZpY2UgZXh0ZW5kcyBCYXNlRXh0SG9zdFRlcm1pbmFsU2VydmljZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0SG9zdENvbW1hbmRzIGV4dEhvc3RDb21tYW5kczogSUV4dEhvc3RDb21tYW5kcyxcblx0XHRASUV4dEhvc3RScGNTZXJ2aWNlIGV4dEhvc3RScGM6IElFeHRIb3N0UnBjU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihmYWxzZSwgZXh0SG9zdENvbW1hbmRzLCBleHRIb3N0UnBjKTtcblx0fVxuXG5cdHB1YmxpYyBjcmVhdGVUZXJtaW5hbChuYW1lPzogc3RyaW5nLCBzaGVsbFBhdGg/OiBzdHJpbmcsIHNoZWxsQXJncz86IHN0cmluZ1tdIHwgc3RyaW5nKTogdnNjb2RlLlRlcm1pbmFsIHtcblx0XHR0aHJvdyBuZXcgTm90U3VwcG9ydGVkRXJyb3IoKTtcblx0fVxuXG5cdHB1YmxpYyBjcmVhdGVUZXJtaW5hbEZyb21PcHRpb25zKG9wdGlvbnM6IHZzY29kZS5UZXJtaW5hbE9wdGlvbnMsIGludGVybmFsT3B0aW9ucz86IElUZXJtaW5hbEludGVybmFsT3B0aW9ucyk6IHZzY29kZS5UZXJtaW5hbCB7XG5cdFx0dGhyb3cgbmV3IE5vdFN1cHBvcnRlZEVycm9yKCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gYXNUZXJtaW5hbEljb24oaWNvblBhdGg/OiB2c2NvZGUuVXJpIHwgeyBsaWdodDogdnNjb2RlLlVyaTsgZGFyazogdnNjb2RlLlVyaSB9IHwgdnNjb2RlLlRoZW1lSWNvbik6IFRlcm1pbmFsSWNvbiB8IHVuZGVmaW5lZCB7XG5cdGlmICghaWNvblBhdGggfHwgdHlwZW9mIGljb25QYXRoID09PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRpZiAoISgnaWQnIGluIGljb25QYXRoKSkge1xuXHRcdHJldHVybiBpY29uUGF0aDtcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0aWQ6IGljb25QYXRoLmlkLFxuXHRcdGNvbG9yOiBpY29uUGF0aC5jb2xvciBhcyBUaGVtZUNvbG9yXG5cdH07XG59XG5cbmZ1bmN0aW9uIGFzVGVybWluYWxDb2xvcihjb2xvcj86IHZzY29kZS5UaGVtZUNvbG9yKTogVGhlbWVDb2xvciB8IHVuZGVmaW5lZCB7XG5cdHJldHVybiBUaGVtZUNvbG9yLmlzVGhlbWVDb2xvcihjb2xvcikgPyBjb2xvciBhcyBUaGVtZUNvbG9yIDogdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0TXV0YXRvcihtdXRhdG9yOiBJRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3IpOiB2c2NvZGUuRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3Ige1xuXHRjb25zdCBuZXdNdXRhdG9yID0geyAuLi5tdXRhdG9yIH07XG5cdGRlbGV0ZSBuZXdNdXRhdG9yLnNjb3BlO1xuXHRuZXdNdXRhdG9yLm9wdGlvbnMgPSBuZXdNdXRhdG9yLm9wdGlvbnMgPz8gdW5kZWZpbmVkO1xuXHRkZWxldGUgKG5ld011dGF0b3IgYXMgYW55KS52YXJpYWJsZTtcblx0cmV0dXJuIG5ld011dGF0b3IgYXMgdnNjb2RlLkVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFnQixlQUFlO0FBQy9CLFNBQXNDLG1CQUFvVDtBQUMxVixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFdBQVc7QUFDcEIsU0FBUywwQkFBMEI7QUFDbkMsU0FBc0IsaUJBQWlCLFlBQVkseUJBQXlCO0FBQzVFLFNBQVMsY0FBYyxrQkFBa0Isc0NBQWtGO0FBRTNILFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsb0NBQW9DLDhDQUE4QztBQUMzRixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLG9CQUFvQjtBQUU3QixTQUErTSwyQkFBbUU7QUFDbFIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyx3QkFBd0Isa0JBQWtCLGtCQUFrQjtBQUNyRSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG9CQUFvQjtBQW1EdEIsTUFBTSwwQkFBMEIsZ0JBQXlDLHlCQUF5QjtBQUVsRyxNQUFNLHdCQUF3QixXQUFXO0FBQUEsRUFtQi9DLFlBQ1MsUUFDRCxLQUNVLGtCQUNULE9BQ1A7QUFDRCxVQUFNO0FBTEU7QUFDRDtBQUNVO0FBQ1Q7QUF0QlQsU0FBUSxZQUFxQjtBQU03QixTQUFRLFNBQStCLEVBQUUsa0JBQWtCLE9BQU8sT0FBTyxPQUFVO0FBS25G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LENBQUMsT0FBTyxhQUFhLFNBQVMsS0FBSyxTQUFTLFVBQVUsT0FBTyxJQUFJLEdBQUcsS0FBSyxLQUFLO0FBQUEsRUFDbEk7QUFBQSxFQUVBLENBQUMsT0FBTyxRQUFRLElBQXNGO0FBQ3JHLFdBQU8sS0FBSyxXQUFXLGVBQWUsS0FBSyxLQUFLLEVBQUUsUUFBUTtBQUFBLEVBQzNEO0FBQUEsRUFFQSxPQUFPLFVBQXdCO0FBQzlCLFNBQUssV0FBVyxPQUFPLFVBQVUsS0FBSyxLQUFLO0FBQzNDLFNBQUssdUJBQXVCLEtBQUssTUFBUztBQUFBLEVBQzNDO0FBQUEsRUFFQSxRQUFjO0FBQ2IsU0FBSyxXQUFXLE1BQU0sS0FBSyxLQUFLO0FBQUEsRUFDakM7QUFBQSxFQUVBLElBQUksWUFBWSxhQUF5RDtBQUN4RSxTQUFLLFdBQVcsZUFBZSxhQUFhLEtBQUssS0FBSztBQUFBLEVBQ3ZEO0FBQUEsRUFFQSxJQUFJLGNBQTBEO0FBQzdELFdBQU8sS0FBSyxXQUFXLGVBQWUsS0FBSyxLQUFLO0FBQUEsRUFDakQ7QUFDRDtBQUVPLElBQU0sK0JBQU4sY0FBMkMsMkJBQTJCO0FBQUEsRUFDNUUsWUFDbUIsaUJBQ0UsWUFDbkI7QUFDRCxVQUFNLE9BQU8saUJBQWlCLFVBQVU7QUFBQSxFQUN6QztBQUFBLEVBRU8sZUFBZSxNQUFlLFdBQW9CLFdBQWdEO0FBQ3hHLFVBQU0sSUFBSSxrQkFBa0I7QUFBQSxFQUM3QjtBQUFBLEVBRU8sMEJBQTBCLFNBQWlDLGlCQUE2RDtBQUM5SCxVQUFNLElBQUksa0JBQWtCO0FBQUEsRUFDN0I7QUFDRDtBQWZhLCtCQUFOO0FBQUEsRUFFSjtBQUFBLEVBQ0E7QUFBQSxHQUhVO0FBaUJiLFNBQVMsZUFBZSxVQUE4RztBQUNySSxNQUFJLENBQUMsWUFBWSxPQUFPLGFBQWEsVUFBVTtBQUM5QyxXQUFPO0FBQUEsRUFDUjtBQUVBLE1BQUksRUFBRSxRQUFRLFdBQVc7QUFDeEIsV0FBTztBQUFBLEVBQ1I7QUFFQSxTQUFPO0FBQUEsSUFDTixJQUFJLFNBQVM7QUFBQSxJQUNiLE9BQU8sU0FBUztBQUFBLEVBQ2pCO0FBQ0Q7QUFFQSxTQUFTLGdCQUFnQixPQUFtRDtBQUMzRSxTQUFPLFdBQVcsYUFBYSxLQUFLLElBQUksUUFBc0I7QUFDL0Q7QUFFQSxTQUFTLGVBQWUsU0FBeUU7QUFDaEcsUUFBTSxhQUFhLEVBQUUsR0FBRyxRQUFRO0FBQ2hDLFNBQU8sV0FBVztBQUNsQixhQUFXLFVBQVUsV0FBVyxXQUFXO0FBQzNDLFNBQVEsV0FBbUI7QUFDM0IsU0FBTztBQUNSOyIsCiAgIm5hbWVzIjogWyJhcmciLCAia2V5Il0KfQo=
