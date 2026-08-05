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
import { PixelRatio } from "../../../../base/browser/pixelRatio.js";
import { $, addStandardDisposableListener, append } from "../../../../base/browser/dom.js";
import { binarySearch2 } from "../../../../base/common/arrays.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, dispose } from "../../../../base/common/lifecycle.js";
import { isAbsolute } from "../../../../base/common/path.js";
import { Constants } from "../../../../base/common/uint.js";
import { URI } from "../../../../base/common/uri.js";
import { applyFontInfo } from "../../../../editor/browser/config/domFontInfo.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { BareFontInfo } from "../../../../editor/common/config/fontInfo.js";
import { Range } from "../../../../editor/common/core/range.js";
import { StringBuilder } from "../../../../editor/common/core/stringBuilder.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { TextEditorSelectionRevealType } from "../../../../platform/editor/common/editor.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchTable } from "../../../../platform/list/browser/listService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { editorBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { focusedStackFrameColor, topStackFrameColor } from "./callStackEditorContribution.js";
import * as icons from "./debugIcons.js";
import { CONTEXT_LANGUAGE_SUPPORTS_DISASSEMBLE_REQUEST, DISASSEMBLY_VIEW_ID, IDebugService, State } from "../common/debug.js";
import { InstructionBreakpoint } from "../common/debugModel.js";
import { getUriFromSource } from "../common/debugSource.js";
import { isUri, sourcesEqual } from "../common/debugUtils.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
const disassemblyNotAvailable = {
  allowBreakpoint: false,
  isBreakpointSet: false,
  isBreakpointEnabled: false,
  instructionReference: "",
  instructionOffset: 0,
  instructionReferenceOffset: 0,
  address: 0n,
  instruction: {
    address: "-1",
    instruction: localize("instructionNotAvailable", "Disassembly not available.")
  }
};
let DisassemblyView = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, _configurationService, _instantiationService, _debugService) {
    super(DISASSEMBLY_VIEW_ID, group, telemetryService, themeService, storageService);
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._debugService = _debugService;
    this._instructionBpList = [];
    this._enableSourceCodeRender = true;
    this._loadingLock = false;
    this._referenceToMemoryAddress = /* @__PURE__ */ new Map();
    this._disassembledInstructions = void 0;
    this._onDidChangeStackFrame = this._register(new Emitter({ leakWarningThreshold: 1e3 }));
    this._previousDebuggingState = _debugService.state;
    this._register(_configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("debug")) {
        const newValue = this._configurationService.getValue("debug").disassemblyView.showSourceCode;
        if (this._enableSourceCodeRender !== newValue) {
          this._enableSourceCodeRender = newValue;
        } else {
          this._disassembledInstructions?.rerender();
        }
      }
    }));
  }
  get fontInfo() {
    if (!this._fontInfo) {
      this._fontInfo = this.createFontInfo();
      this._register(this._configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("editor")) {
          this._fontInfo = this.createFontInfo();
        }
      }));
    }
    return this._fontInfo;
  }
  createFontInfo() {
    return BareFontInfo.createFromRawSettings(this._configurationService.getValue("editor"), PixelRatio.getInstance(this.window).value);
  }
  get currentInstructionAddresses() {
    return this._debugService.getModel().getSessions(false).map((session) => session.getAllThreads()).reduce((prev, curr) => prev.concat(curr), []).map((thread) => thread.getTopStackFrame()).map((frame) => frame?.instructionPointerReference).map((ref) => ref ? this.getReferenceAddress(ref) : void 0);
  }
  // Instruction reference of the top stack frame of the focused stack
  get focusedCurrentInstructionReference() {
    return this._debugService.getViewModel().focusedStackFrame?.thread.getTopStackFrame()?.instructionPointerReference;
  }
  get focusedCurrentInstructionAddress() {
    const ref = this.focusedCurrentInstructionReference;
    return ref ? this.getReferenceAddress(ref) : void 0;
  }
  get focusedInstructionReference() {
    return this._debugService.getViewModel().focusedStackFrame?.instructionPointerReference;
  }
  get focusedInstructionAddress() {
    const ref = this.focusedInstructionReference;
    return ref ? this.getReferenceAddress(ref) : void 0;
  }
  get isSourceCodeRender() {
    return this._enableSourceCodeRender;
  }
  get debugSession() {
    return this._debugService.getViewModel().focusedSession;
  }
  get onDidChangeStackFrame() {
    return this._onDidChangeStackFrame.event;
  }
  get focusedAddressAndOffset() {
    const element = this._disassembledInstructions?.getFocusedElements()[0];
    if (!element) {
      return void 0;
    }
    const reference = element.instructionReference;
    const offset = Number(element.address - this.getReferenceAddress(reference));
    return { reference, offset, address: element.address };
  }
  createEditor(parent) {
    this._enableSourceCodeRender = this._configurationService.getValue("debug").disassemblyView.showSourceCode;
    const lineHeight = this.fontInfo.lineHeight;
    const thisOM = this;
    const delegate = new class {
      constructor() {
        this.headerRowHeight = 0;
      }
      // No header
      getHeight(row) {
        if (thisOM.isSourceCodeRender && row.showSourceLocation && row.instruction.location?.path && row.instruction.line) {
          if (row.instruction.endLine) {
            return lineHeight * (row.instruction.endLine - row.instruction.line + 2);
          } else {
            return lineHeight * 2;
          }
        }
        return lineHeight;
      }
    }();
    const instructionRenderer = this._register(this._instantiationService.createInstance(InstructionRenderer, this));
    this._disassembledInstructions = this._register(this._instantiationService.createInstance(
      WorkbenchTable,
      "DisassemblyView",
      parent,
      delegate,
      [
        {
          label: "",
          tooltip: "",
          weight: 0,
          minimumWidth: this.fontInfo.lineHeight,
          maximumWidth: this.fontInfo.lineHeight,
          templateId: BreakpointRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("disassemblyTableColumnLabel", "instructions"),
          tooltip: "",
          weight: 0.3,
          templateId: InstructionRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        }
      ],
      [
        this._instantiationService.createInstance(BreakpointRenderer, this),
        instructionRenderer
      ],
      {
        identityProvider: { getId: (e) => e.instruction.address },
        horizontalScrolling: false,
        overrideStyles: {
          listBackground: editorBackground
        },
        multipleSelectionSupport: false,
        setRowLineHeight: false,
        openOnSingleClick: false,
        accessibilityProvider: new AccessibilityProvider(),
        mouseSupport: false
      }
    ));
    this._disassembledInstructions.domNode.classList.add("disassembly-view");
    if (this.focusedInstructionReference) {
      this.reloadDisassembly(this.focusedInstructionReference, 0);
    }
    this._register(this._disassembledInstructions.onDidScroll((e) => {
      if (this._loadingLock) {
        return;
      }
      if (e.oldScrollTop > e.scrollTop && e.scrollTop < e.height) {
        this._loadingLock = true;
        const prevTop = Math.floor(e.scrollTop / this.fontInfo.lineHeight);
        this.scrollUp_LoadDisassembledInstructions(DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD).then((loaded) => {
          if (loaded > 0) {
            this._disassembledInstructions.reveal(prevTop + loaded, 0);
          }
          this._loadingLock = false;
        });
      } else if (e.oldScrollTop < e.scrollTop && e.scrollTop + e.height > e.scrollHeight - e.height) {
        this._loadingLock = true;
        this.scrollDown_LoadDisassembledInstructions(DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD).then(() => {
          this._loadingLock = false;
        });
      }
    }));
    this._register(this._debugService.getViewModel().onDidFocusStackFrame(({ stackFrame }) => {
      if (this._disassembledInstructions && stackFrame?.instructionPointerReference) {
        this.goToInstructionAndOffset(stackFrame.instructionPointerReference, 0);
      }
      this._onDidChangeStackFrame.fire();
    }));
    this._register(this._debugService.getModel().onDidChangeBreakpoints((bpEvent) => {
      if (bpEvent && this._disassembledInstructions) {
        let changed = false;
        bpEvent.added?.forEach((bp) => {
          if (bp instanceof InstructionBreakpoint) {
            const index = this.getIndexFromReferenceAndOffset(bp.instructionReference, bp.offset);
            if (index >= 0) {
              this._disassembledInstructions.row(index).isBreakpointSet = true;
              this._disassembledInstructions.row(index).isBreakpointEnabled = bp.enabled;
              changed = true;
            }
          }
        });
        bpEvent.removed?.forEach((bp) => {
          if (bp instanceof InstructionBreakpoint) {
            const index = this.getIndexFromReferenceAndOffset(bp.instructionReference, bp.offset);
            if (index >= 0) {
              this._disassembledInstructions.row(index).isBreakpointSet = false;
              changed = true;
            }
          }
        });
        bpEvent.changed?.forEach((bp) => {
          if (bp instanceof InstructionBreakpoint) {
            const index = this.getIndexFromReferenceAndOffset(bp.instructionReference, bp.offset);
            if (index >= 0) {
              if (this._disassembledInstructions.row(index).isBreakpointEnabled !== bp.enabled) {
                this._disassembledInstructions.row(index).isBreakpointEnabled = bp.enabled;
                changed = true;
              }
            }
          }
        });
        this._instructionBpList = this._debugService.getModel().getInstructionBreakpoints();
        for (const bp of this._instructionBpList) {
          this.primeMemoryReference(bp.instructionReference);
        }
        if (changed) {
          this._onDidChangeStackFrame.fire();
        }
      }
    }));
    this._register(this._debugService.onDidChangeState((e) => {
      if ((e === State.Running || e === State.Stopped) && (this._previousDebuggingState !== State.Running && this._previousDebuggingState !== State.Stopped)) {
        this.clear();
        this._enableSourceCodeRender = this._configurationService.getValue("debug").disassemblyView.showSourceCode;
      }
      this._previousDebuggingState = e;
      this._onDidChangeStackFrame.fire();
    }));
  }
  layout(dimension) {
    this._disassembledInstructions?.layout(dimension.height);
  }
  async goToInstructionAndOffset(instructionReference, offset, focus) {
    let addr = this._referenceToMemoryAddress.get(instructionReference);
    if (addr === void 0) {
      await this.loadDisassembledInstructions(instructionReference, 0, -DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD, DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD * 2);
      addr = this._referenceToMemoryAddress.get(instructionReference);
    }
    if (addr) {
      this.goToAddress(addr + BigInt(offset), focus);
    }
  }
  /** Gets the address associated with the instruction reference. */
  getReferenceAddress(instructionReference) {
    return this._referenceToMemoryAddress.get(instructionReference);
  }
  /**
   * Go to the address provided. If no address is provided, reveal the address of the currently focused stack frame. Returns false if that address is not available.
   */
  goToAddress(address, focus) {
    if (!this._disassembledInstructions) {
      return false;
    }
    if (!address) {
      return false;
    }
    const index = this.getIndexFromAddress(address);
    if (index >= 0) {
      this._disassembledInstructions.reveal(index);
      if (focus) {
        this._disassembledInstructions.domFocus();
        this._disassembledInstructions.setFocus([index]);
      }
      return true;
    }
    return false;
  }
  async scrollUp_LoadDisassembledInstructions(instructionCount) {
    const first = this._disassembledInstructions?.row(0);
    if (first) {
      return this.loadDisassembledInstructions(
        first.instructionReference,
        first.instructionReferenceOffset,
        first.instructionOffset - instructionCount,
        instructionCount
      );
    }
    return 0;
  }
  async scrollDown_LoadDisassembledInstructions(instructionCount) {
    const last = this._disassembledInstructions?.row(this._disassembledInstructions?.length - 1);
    if (last) {
      return this.loadDisassembledInstructions(
        last.instructionReference,
        last.instructionReferenceOffset,
        last.instructionOffset + 1,
        instructionCount
      );
    }
    return 0;
  }
  /**
   * Sets the memory reference address. We don't just loadDisassembledInstructions
   * for this, since we can't really deal with discontiguous ranges (we can't
   * detect _if_ a range is discontiguous since we don't know how much memory
   * comes between instructions.)
   */
  async primeMemoryReference(instructionReference) {
    if (this._referenceToMemoryAddress.has(instructionReference)) {
      return true;
    }
    const s = await this.debugSession?.disassemble(instructionReference, 0, 0, 1);
    if (s && s.length > 0) {
      try {
        this._referenceToMemoryAddress.set(instructionReference, BigInt(s[0].address));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
  /** Loads disasembled instructions. Returns the number of instructions that were loaded. */
  async loadDisassembledInstructions(instructionReference, offset, instructionOffset, instructionCount) {
    const session = this.debugSession;
    const resultEntries = await session?.disassemble(instructionReference, offset, instructionOffset, instructionCount);
    if (!this._referenceToMemoryAddress.has(instructionReference) && instructionOffset !== 0) {
      await this.loadDisassembledInstructions(instructionReference, 0, 0, DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD);
    }
    if (session && resultEntries && this._disassembledInstructions) {
      const newEntries = [];
      let lastLocation;
      let lastLine;
      for (let i = 0; i < resultEntries.length; i++) {
        const instruction = resultEntries[i];
        const thisInstructionOffset = instructionOffset + i;
        if (instruction.location) {
          lastLocation = instruction.location;
          lastLine = void 0;
        }
        if (instruction.line) {
          const currentLine = {
            startLineNumber: instruction.line,
            startColumn: instruction.column ?? 0,
            endLineNumber: instruction.endLine ?? instruction.line,
            endColumn: instruction.endColumn ?? 0
          };
          if (!Range.equalsRange(currentLine, lastLine ?? null)) {
            lastLine = currentLine;
            instruction.location = lastLocation;
          }
        }
        let address;
        try {
          address = BigInt(instruction.address);
        } catch {
          console.error(`Could not parse disassembly address ${instruction.address} (in ${JSON.stringify(instruction)})`);
          continue;
        }
        const entry = {
          allowBreakpoint: true,
          isBreakpointSet: false,
          isBreakpointEnabled: false,
          instructionReference,
          instructionReferenceOffset: offset,
          instructionOffset: thisInstructionOffset,
          instruction,
          address
        };
        newEntries.push(entry);
        if (offset === 0 && thisInstructionOffset === 0) {
          this._referenceToMemoryAddress.set(instructionReference, address);
        }
      }
      if (newEntries.length === 0) {
        return 0;
      }
      const refBaseAddress = this._referenceToMemoryAddress.get(instructionReference);
      const bps = this._instructionBpList.map((p) => {
        const base = this._referenceToMemoryAddress.get(p.instructionReference);
        if (!base) {
          return void 0;
        }
        return {
          enabled: p.enabled,
          address: base + BigInt(p.offset || 0)
        };
      });
      if (refBaseAddress !== void 0) {
        for (const entry of newEntries) {
          const bp = bps.find((p) => p?.address === entry.address);
          if (bp) {
            entry.isBreakpointSet = true;
            entry.isBreakpointEnabled = bp.enabled;
          }
        }
      }
      const da = this._disassembledInstructions;
      if (da.length === 1 && this._disassembledInstructions.row(0) === disassemblyNotAvailable) {
        da.splice(0, 1);
      }
      const firstAddr = newEntries[0].address;
      const lastAddr = newEntries[newEntries.length - 1].address;
      const startN = binarySearch2(da.length, (i) => Number(da.row(i).address - firstAddr));
      const start = startN < 0 ? ~startN : startN;
      const endN = binarySearch2(da.length, (i) => Number(da.row(i).address - lastAddr));
      const end = endN < 0 ? ~endN : endN + 1;
      const toDelete = end - start;
      let lastLocated;
      for (let i = start - 1; i >= 0; i--) {
        const { instruction } = da.row(i);
        if (instruction.location && instruction.line !== void 0) {
          lastLocated = instruction;
          break;
        }
      }
      const shouldShowLocation = (instruction) => instruction.line !== void 0 && instruction.location !== void 0 && (!lastLocated || !sourcesEqual(instruction.location, lastLocated.location) || instruction.line !== lastLocated.line);
      for (const entry of newEntries) {
        if (shouldShowLocation(entry.instruction)) {
          entry.showSourceLocation = true;
          lastLocated = entry.instruction;
        }
      }
      da.splice(start, toDelete, newEntries);
      return newEntries.length - toDelete;
    }
    return 0;
  }
  getIndexFromReferenceAndOffset(instructionReference, offset) {
    const addr = this._referenceToMemoryAddress.get(instructionReference);
    if (addr === void 0) {
      return -1;
    }
    return this.getIndexFromAddress(addr + BigInt(offset));
  }
  getIndexFromAddress(address) {
    const disassembledInstructions = this._disassembledInstructions;
    if (disassembledInstructions && disassembledInstructions.length > 0) {
      return binarySearch2(disassembledInstructions.length, (index) => {
        const row = disassembledInstructions.row(index);
        return Number(row.address - address);
      });
    }
    return -1;
  }
  /**
   * Clears the table and reload instructions near the target address
   */
  reloadDisassembly(instructionReference, offset) {
    if (!this._disassembledInstructions) {
      return;
    }
    this._loadingLock = true;
    this.clear();
    this._instructionBpList = this._debugService.getModel().getInstructionBreakpoints();
    this.loadDisassembledInstructions(instructionReference, offset, -DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD * 4, DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD * 8).then(() => {
      if (this._disassembledInstructions.length > 0) {
        const targetIndex = Math.floor(this._disassembledInstructions.length / 2);
        this._disassembledInstructions.reveal(targetIndex, 0.5);
        this._disassembledInstructions.domFocus();
        this._disassembledInstructions.setFocus([targetIndex]);
      }
      this._loadingLock = false;
    });
  }
  clear() {
    this._referenceToMemoryAddress.clear();
    this._disassembledInstructions?.splice(0, this._disassembledInstructions.length, [disassemblyNotAvailable]);
  }
};
DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD = 50;
DisassemblyView = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IDebugService)
], DisassemblyView);
let BreakpointRenderer = class {
  constructor(_disassemblyView, _debugService) {
    this._disassemblyView = _disassemblyView;
    this._debugService = _debugService;
    this.templateId = BreakpointRenderer.TEMPLATE_ID;
    this._breakpointIcon = "codicon-" + icons.breakpoint.regular.id;
    this._breakpointDisabledIcon = "codicon-" + icons.breakpoint.disabled.id;
    this._breakpointHintIcon = "codicon-" + icons.debugBreakpointHint.id;
    this._debugStackframe = "codicon-" + icons.debugStackframe.id;
    this._debugStackframeFocused = "codicon-" + icons.debugStackframeFocused.id;
  }
  renderTemplate(container) {
    container.style.alignSelf = "flex-end";
    const icon = append(container, $(".codicon"));
    icon.style.display = "flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";
    icon.style.height = this._disassemblyView.fontInfo.lineHeight + "px";
    const currentElement = { element: void 0 };
    const disposables = [
      this._disassemblyView.onDidChangeStackFrame(() => this.rerenderDebugStackframe(icon, currentElement.element)),
      addStandardDisposableListener(container, "mouseover", () => {
        if (currentElement.element?.allowBreakpoint) {
          icon.classList.add(this._breakpointHintIcon);
        }
      }),
      addStandardDisposableListener(container, "mouseout", () => {
        if (currentElement.element?.allowBreakpoint) {
          icon.classList.remove(this._breakpointHintIcon);
        }
      }),
      addStandardDisposableListener(container, "click", () => {
        if (currentElement.element?.allowBreakpoint) {
          icon.classList.add(this._breakpointHintIcon);
          const reference = currentElement.element.instructionReference;
          const offset = Number(currentElement.element.address - this._disassemblyView.getReferenceAddress(reference));
          if (currentElement.element.isBreakpointSet) {
            this._debugService.removeInstructionBreakpoints(reference, offset);
          } else if (currentElement.element.allowBreakpoint && !currentElement.element.isBreakpointSet) {
            this._debugService.addInstructionBreakpoint({ instructionReference: reference, offset, address: currentElement.element.address, canPersist: false });
          }
        }
      })
    ];
    return { currentElement, icon, disposables };
  }
  renderElement(element, index, templateData, height) {
    templateData.currentElement.element = element;
    this.rerenderDebugStackframe(templateData.icon, element);
  }
  disposeTemplate(templateData) {
    dispose(templateData.disposables);
    templateData.disposables = [];
  }
  rerenderDebugStackframe(icon, element) {
    if (element?.address === this._disassemblyView.focusedCurrentInstructionAddress) {
      icon.classList.add(this._debugStackframe);
    } else if (element?.address === this._disassemblyView.focusedInstructionAddress) {
      icon.classList.add(this._debugStackframeFocused);
    } else {
      icon.classList.remove(this._debugStackframe);
      icon.classList.remove(this._debugStackframeFocused);
    }
    icon.classList.remove(this._breakpointHintIcon);
    if (element?.isBreakpointSet) {
      if (element.isBreakpointEnabled) {
        icon.classList.add(this._breakpointIcon);
        icon.classList.remove(this._breakpointDisabledIcon);
      } else {
        icon.classList.remove(this._breakpointIcon);
        icon.classList.add(this._breakpointDisabledIcon);
      }
    } else {
      icon.classList.remove(this._breakpointIcon);
      icon.classList.remove(this._breakpointDisabledIcon);
    }
  }
};
BreakpointRenderer.TEMPLATE_ID = "breakpoint";
BreakpointRenderer = __decorateClass([
  __decorateParam(1, IDebugService)
], BreakpointRenderer);
let InstructionRenderer = class extends Disposable {
  constructor(_disassemblyView, themeService, editorService, textModelService, uriService, logService) {
    super();
    this._disassemblyView = _disassemblyView;
    this.editorService = editorService;
    this.textModelService = textModelService;
    this.uriService = uriService;
    this.logService = logService;
    this.templateId = InstructionRenderer.TEMPLATE_ID;
    this._topStackFrameColor = themeService.getColorTheme().getColor(topStackFrameColor);
    this._focusedStackFrameColor = themeService.getColorTheme().getColor(focusedStackFrameColor);
    this._register(themeService.onDidColorThemeChange((e) => {
      this._topStackFrameColor = e.getColor(topStackFrameColor);
      this._focusedStackFrameColor = e.getColor(focusedStackFrameColor);
    }));
  }
  renderTemplate(container) {
    const sourcecode = append(container, $(".sourcecode"));
    const instruction = append(container, $(".instruction"));
    this.applyFontInfo(sourcecode);
    this.applyFontInfo(instruction);
    const currentElement = { element: void 0 };
    const cellDisposable = [];
    const disposables = [
      this._disassemblyView.onDidChangeStackFrame(() => this.rerenderBackground(instruction, sourcecode, currentElement.element)),
      addStandardDisposableListener(sourcecode, "dblclick", () => this.openSourceCode(currentElement.element?.instruction))
    ];
    return { currentElement, instruction, sourcecode, cellDisposable, disposables };
  }
  renderElement(element, index, templateData, height) {
    this.renderElementInner(element, index, templateData, height);
  }
  async renderElementInner(element, index, templateData, height) {
    templateData.currentElement.element = element;
    const instruction = element.instruction;
    templateData.sourcecode.innerText = "";
    const sb = new StringBuilder(1e3);
    if (this._disassemblyView.isSourceCodeRender && element.showSourceLocation && instruction.location?.path && instruction.line !== void 0) {
      const sourceURI = this.getUriFromSource(instruction);
      if (sourceURI) {
        let textModel = void 0;
        const sourceSB = new StringBuilder(1e4);
        const ref = await this.textModelService.createModelReference(sourceURI);
        if (templateData.currentElement.element !== element) {
          return;
        }
        textModel = ref.object.textEditorModel;
        templateData.cellDisposable.push(ref);
        if (textModel && templateData.currentElement.element === element) {
          let lineNumber = instruction.line;
          while (lineNumber && lineNumber >= 1 && lineNumber <= textModel.getLineCount()) {
            const lineContent = textModel.getLineContent(lineNumber);
            sourceSB.appendString(`  ${lineNumber}: `);
            sourceSB.appendString(lineContent + "\n");
            if (instruction.endLine && lineNumber < instruction.endLine) {
              lineNumber++;
              continue;
            }
            break;
          }
          templateData.sourcecode.innerText = sourceSB.build();
        }
      }
    }
    let spacesToAppend = 10;
    if (instruction.address !== "-1") {
      sb.appendString(instruction.address);
      if (instruction.address.length < InstructionRenderer.INSTRUCTION_ADDR_MIN_LENGTH) {
        spacesToAppend = InstructionRenderer.INSTRUCTION_ADDR_MIN_LENGTH - instruction.address.length;
      }
      for (let i = 0; i < spacesToAppend; i++) {
        sb.appendString(" ");
      }
    }
    if (instruction.instructionBytes) {
      sb.appendString(instruction.instructionBytes);
      spacesToAppend = 10;
      if (instruction.instructionBytes.length < InstructionRenderer.INSTRUCTION_BYTES_MIN_LENGTH) {
        spacesToAppend = InstructionRenderer.INSTRUCTION_BYTES_MIN_LENGTH - instruction.instructionBytes.length;
      }
      for (let i = 0; i < spacesToAppend; i++) {
        sb.appendString(" ");
      }
    }
    sb.appendString(instruction.instruction);
    templateData.instruction.innerText = sb.build();
    this.rerenderBackground(templateData.instruction, templateData.sourcecode, element);
  }
  disposeElement(element, index, templateData, height) {
    dispose(templateData.cellDisposable);
    templateData.cellDisposable = [];
  }
  disposeTemplate(templateData) {
    dispose(templateData.disposables);
    templateData.disposables = [];
  }
  rerenderBackground(instruction, sourceCode, element) {
    if (element && this._disassemblyView.currentInstructionAddresses.includes(element.address)) {
      instruction.style.background = this._topStackFrameColor?.toString() || "transparent";
    } else if (element?.address === this._disassemblyView.focusedInstructionAddress) {
      instruction.style.background = this._focusedStackFrameColor?.toString() || "transparent";
    } else {
      instruction.style.background = "transparent";
    }
  }
  openSourceCode(instruction) {
    if (instruction) {
      const sourceURI = this.getUriFromSource(instruction);
      const selection = instruction.endLine ? {
        startLineNumber: instruction.line,
        endLineNumber: instruction.endLine,
        startColumn: instruction.column || 1,
        endColumn: instruction.endColumn || Constants.MAX_SAFE_SMALL_INTEGER
      } : {
        startLineNumber: instruction.line,
        endLineNumber: instruction.line,
        startColumn: instruction.column || 1,
        endColumn: instruction.endColumn || Constants.MAX_SAFE_SMALL_INTEGER
      };
      this.editorService.openEditor({
        resource: sourceURI,
        description: localize("editorOpenedFromDisassemblyDescription", "from disassembly"),
        options: {
          preserveFocus: false,
          selection,
          revealIfOpened: true,
          selectionRevealType: TextEditorSelectionRevealType.CenterIfOutsideViewport,
          pinned: false
        }
      });
    }
  }
  getUriFromSource(instruction) {
    const path = instruction.location.path;
    if (path && isUri(path)) {
      return this.uriService.asCanonicalUri(URI.parse(path));
    }
    if (path && isAbsolute(path)) {
      return this.uriService.asCanonicalUri(URI.file(path));
    }
    return getUriFromSource(instruction.location, instruction.location.path, this._disassemblyView.debugSession.getId(), this.uriService, this.logService);
  }
  applyFontInfo(element) {
    applyFontInfo(element, this._disassemblyView.fontInfo);
    element.style.whiteSpace = "pre";
  }
};
InstructionRenderer.TEMPLATE_ID = "instruction";
InstructionRenderer.INSTRUCTION_ADDR_MIN_LENGTH = 25;
InstructionRenderer.INSTRUCTION_BYTES_MIN_LENGTH = 30;
InstructionRenderer = __decorateClass([
  __decorateParam(1, IThemeService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, ITextModelService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, ILogService)
], InstructionRenderer);
class AccessibilityProvider {
  getWidgetAriaLabel() {
    return localize("disassemblyView", "Disassembly View");
  }
  getAriaLabel(element) {
    let label = "";
    const instruction = element.instruction;
    if (instruction.address !== "-1") {
      label += `${localize("instructionAddress", "Address")}: ${instruction.address}`;
    }
    if (instruction.instructionBytes) {
      label += `, ${localize("instructionBytes", "Bytes")}: ${instruction.instructionBytes}`;
    }
    label += `, ${localize(`instructionText`, "Instruction")}: ${instruction.instruction}`;
    return label;
  }
}
let DisassemblyViewContribution = class {
  constructor(editorService, debugService, contextKeyService) {
    contextKeyService.bufferChangeEvents(() => {
      this._languageSupportsDisassembleRequest = CONTEXT_LANGUAGE_SUPPORTS_DISASSEMBLE_REQUEST.bindTo(contextKeyService);
    });
    const onDidActiveEditorChangeListener = () => {
      if (this._onDidChangeModelLanguage) {
        this._onDidChangeModelLanguage.dispose();
        this._onDidChangeModelLanguage = void 0;
      }
      const activeTextEditorControl = editorService.activeTextEditorControl;
      if (isCodeEditor(activeTextEditorControl)) {
        const language = activeTextEditorControl.getModel()?.getLanguageId();
        this._languageSupportsDisassembleRequest?.set(!!language && debugService.getAdapterManager().someDebuggerInterestedInLanguage(language));
        this._onDidChangeModelLanguage = activeTextEditorControl.onDidChangeModelLanguage((e) => {
          this._languageSupportsDisassembleRequest?.set(debugService.getAdapterManager().someDebuggerInterestedInLanguage(e.newLanguage));
        });
      } else {
        this._languageSupportsDisassembleRequest?.set(false);
      }
    };
    onDidActiveEditorChangeListener();
    this._onDidActiveEditorChangeListener = editorService.onDidActiveEditorChange(onDidActiveEditorChangeListener);
  }
  dispose() {
    this._onDidActiveEditorChangeListener.dispose();
    this._onDidChangeModelLanguage?.dispose();
  }
};
DisassemblyViewContribution = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IDebugService),
  __decorateParam(2, IContextKeyService)
], DisassemblyViewContribution);
export {
  DisassemblyView,
  DisassemblyViewContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2Rpc2Fzc2VtYmx5Vmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFBpeGVsUmF0aW8gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvcGl4ZWxSYXRpby5qcyc7XG5pbXBvcnQgeyAkLCBEaW1lbnNpb24sIGFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyLCBhcHBlbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBJVGFibGVSZW5kZXJlciwgSVRhYmxlVmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RhYmxlL3RhYmxlLmpzJztcbmltcG9ydCB7IGJpbmFyeVNlYXJjaDIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIGRpc3Bvc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNBYnNvbHV0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgQ29uc3RhbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdWludC5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgYXBwbHlGb250SW5mbyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2NvbmZpZy9kb21Gb250SW5mby5qcyc7XG5pbXBvcnQgeyBpc0NvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEJhcmVGb250SW5mbyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2ZvbnRJbmZvLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU3RyaW5nQnVpbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9zdHJpbmdCdWlsZGVyLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBUZXh0RWRpdG9yU2VsZWN0aW9uUmV2ZWFsVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoVGFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgZWRpdG9yQmFja2dyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvclBhbmUuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IGZvY3VzZWRTdGFja0ZyYW1lQ29sb3IsIHRvcFN0YWNrRnJhbWVDb2xvciB9IGZyb20gJy4vY2FsbFN0YWNrRWRpdG9yQ29udHJpYnV0aW9uLmpzJztcbmltcG9ydCAqIGFzIGljb25zIGZyb20gJy4vZGVidWdJY29ucy5qcyc7XG5pbXBvcnQgeyBDT05URVhUX0xBTkdVQUdFX1NVUFBPUlRTX0RJU0FTU0VNQkxFX1JFUVVFU1QsIERJU0FTU0VNQkxZX1ZJRVdfSUQsIElEZWJ1Z0NvbmZpZ3VyYXRpb24sIElEZWJ1Z1NlcnZpY2UsIElEZWJ1Z1Nlc3Npb24sIElJbnN0cnVjdGlvbkJyZWFrcG9pbnQsIFN0YXRlIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCB7IEluc3RydWN0aW9uQnJlYWtwb2ludCB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z01vZGVsLmpzJztcbmltcG9ydCB7IGdldFVyaUZyb21Tb3VyY2UgfSBmcm9tICcuLi9jb21tb24vZGVidWdTb3VyY2UuanMnO1xuaW1wb3J0IHsgaXNVcmksIHNvdXJjZXNFcXVhbCB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z1V0aWxzLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5cbmludGVyZmFjZSBJRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25FbnRyeSB7XG5cdGFsbG93QnJlYWtwb2ludDogYm9vbGVhbjtcblx0aXNCcmVha3BvaW50U2V0OiBib29sZWFuO1xuXHRpc0JyZWFrcG9pbnRFbmFibGVkOiBib29sZWFuO1xuXHQvKiogSW5zdHJ1Y3Rpb24gcmVmZXJlbmNlIGZyb20gdGhlIERBICovXG5cdGluc3RydWN0aW9uUmVmZXJlbmNlOiBzdHJpbmc7XG5cdC8qKiBPZmZzZXQgZnJvbSB0aGUgaW5zdHJ1Y3Rpb25SZWZlcmVuY2UgdGhhdCdzIHRoZSBiYXNpcyBmb3IgdGhlIGBpbnN0cnVjdGlvbk9mZnNldGAgKi9cblx0aW5zdHJ1Y3Rpb25SZWZlcmVuY2VPZmZzZXQ6IG51bWJlcjtcblx0LyoqIFRoZSBudW1iZXIgb2YgaW5zdHJ1Y3Rpb25zICgrLy0pIGF3YXkgZnJvbSB0aGUgaW5zdHJ1Y3Rpb25SZWZlcmVuY2UgYW5kIGluc3RydWN0aW9uUmVmZXJlbmNlT2Zmc2V0IHRoaXMgaW5zdHJ1Y3Rpb24gbGllcyAqL1xuXHRpbnN0cnVjdGlvbk9mZnNldDogbnVtYmVyO1xuXHQvKiogV2hldGhlciB0aGlzIGlzIHRoZSBmaXJzdCBpbnN0cnVjdGlvbiBvbiB0aGUgdGFyZ2V0IGxpbmUuICovXG5cdHNob3dTb3VyY2VMb2NhdGlvbj86IGJvb2xlYW47XG5cdC8qKiBPcmlnaW5hbCBpbnN0cnVjdGlvbiBmcm9tIHRoZSBkZWJ1Z2dlciAqL1xuXHRpbnN0cnVjdGlvbjogRGVidWdQcm90b2NvbC5EaXNhc3NlbWJsZWRJbnN0cnVjdGlvbjtcblx0LyoqIFBhcnNlZCBpbnN0cnVjdGlvbiBhZGRyZXNzICovXG5cdGFkZHJlc3M6IGJpZ2ludDtcbn1cblxuXG4vLyBTcGVjaWFsIGVudHJ5IGFzIGEgcGxhY2Vob2xlciB3aGVuIGRpc2Fzc2VtYmx5IGlzIG5vdCBhdmFpbGFibGVcbmNvbnN0IGRpc2Fzc2VtYmx5Tm90QXZhaWxhYmxlOiBJRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25FbnRyeSA9IHtcblx0YWxsb3dCcmVha3BvaW50OiBmYWxzZSxcblx0aXNCcmVha3BvaW50U2V0OiBmYWxzZSxcblx0aXNCcmVha3BvaW50RW5hYmxlZDogZmFsc2UsXG5cdGluc3RydWN0aW9uUmVmZXJlbmNlOiAnJyxcblx0aW5zdHJ1Y3Rpb25PZmZzZXQ6IDAsXG5cdGluc3RydWN0aW9uUmVmZXJlbmNlT2Zmc2V0OiAwLFxuXHRhZGRyZXNzOiAwbixcblx0aW5zdHJ1Y3Rpb246IHtcblx0XHRhZGRyZXNzOiAnLTEnLFxuXHRcdGluc3RydWN0aW9uOiBsb2NhbGl6ZSgnaW5zdHJ1Y3Rpb25Ob3RBdmFpbGFibGUnLCBcIkRpc2Fzc2VtYmx5IG5vdCBhdmFpbGFibGUuXCIpXG5cdH0sXG59O1xuXG5leHBvcnQgY2xhc3MgRGlzYXNzZW1ibHlWaWV3IGV4dGVuZHMgRWRpdG9yUGFuZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTlVNX0lOU1RSVUNUSU9OU19UT19MT0FEID0gNTA7XG5cblx0Ly8gVXNlZCBpbiBpbnN0cnVjdGlvbiByZW5kZXJlclxuXHRwcml2YXRlIF9mb250SW5mbzogQmFyZUZvbnRJbmZvIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9kaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnM6IFdvcmtiZW5jaFRhYmxlPElEaXNhc3NlbWJsZWRJbnN0cnVjdGlvbkVudHJ5PiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VTdGFja0ZyYW1lOiBFbWl0dGVyPHZvaWQ+O1xuXHRwcml2YXRlIF9wcmV2aW91c0RlYnVnZ2luZ1N0YXRlOiBTdGF0ZTtcblx0cHJpdmF0ZSBfaW5zdHJ1Y3Rpb25CcExpc3Q6IHJlYWRvbmx5IElJbnN0cnVjdGlvbkJyZWFrcG9pbnRbXSA9IFtdO1xuXHRwcml2YXRlIF9lbmFibGVTb3VyY2VDb2RlUmVuZGVyOiBib29sZWFuID0gdHJ1ZTtcblx0cHJpdmF0ZSBfbG9hZGluZ0xvY2s6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVmZXJlbmNlVG9NZW1vcnlBZGRyZXNzID0gbmV3IE1hcDxzdHJpbmcsIGJpZ2ludD4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRncm91cDogSUVkaXRvckdyb3VwLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElEZWJ1Z1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihESVNBU1NFTUJMWV9WSUVXX0lELCBncm91cCwgdGVsZW1ldHJ5U2VydmljZSwgdGhlbWVTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSk7XG5cblx0XHR0aGlzLl9kaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGFja0ZyYW1lID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oeyBsZWFrV2FybmluZ1RocmVzaG9sZDogMTAwMCB9KSk7XG5cdFx0dGhpcy5fcHJldmlvdXNEZWJ1Z2dpbmdTdGF0ZSA9IF9kZWJ1Z1NlcnZpY2Uuc3RhdGU7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdkZWJ1ZycpKSB7XG5cdFx0XHRcdC8vIHNob3cvaGlkZSBzb3VyY2UgY29kZSByZXF1aXJlcyBjaGFuZ2luZyBoZWlnaHQgd2hpY2ggV29ya2JlbmNoVGFibGUgZG9lc24ndCBzdXBwb3J0IGR5bmFtaWMgaGVpZ2h0LCB0aHVzIGZvcmNlIGEgdG90YWwgcmVsb2FkLlxuXHRcdFx0XHRjb25zdCBuZXdWYWx1ZSA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElEZWJ1Z0NvbmZpZ3VyYXRpb24+KCdkZWJ1ZycpLmRpc2Fzc2VtYmx5Vmlldy5zaG93U291cmNlQ29kZTtcblx0XHRcdFx0aWYgKHRoaXMuX2VuYWJsZVNvdXJjZUNvZGVSZW5kZXIgIT09IG5ld1ZhbHVlKSB7XG5cdFx0XHRcdFx0dGhpcy5fZW5hYmxlU291cmNlQ29kZVJlbmRlciA9IG5ld1ZhbHVlO1xuXHRcdFx0XHRcdC8vIHRvZG86IHRyaWdnZXIgcmVyZW5kZXJcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl9kaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnM/LnJlcmVuZGVyKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRnZXQgZm9udEluZm8oKSB7XG5cdFx0aWYgKCF0aGlzLl9mb250SW5mbykge1xuXHRcdFx0dGhpcy5fZm9udEluZm8gPSB0aGlzLmNyZWF0ZUZvbnRJbmZvKCk7XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2VkaXRvcicpKSB7XG5cdFx0XHRcdFx0dGhpcy5fZm9udEluZm8gPSB0aGlzLmNyZWF0ZUZvbnRJbmZvKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fZm9udEluZm87XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUZvbnRJbmZvKCkge1xuXHRcdHJldHVybiBCYXJlRm9udEluZm8uY3JlYXRlRnJvbVJhd1NldHRpbmdzKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdlZGl0b3InKSwgUGl4ZWxSYXRpby5nZXRJbnN0YW5jZSh0aGlzLndpbmRvdykudmFsdWUpO1xuXHR9XG5cblx0Z2V0IGN1cnJlbnRJbnN0cnVjdGlvbkFkZHJlc3NlcygpIHtcblx0XHRyZXR1cm4gdGhpcy5fZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0U2Vzc2lvbnMoZmFsc2UpLlxuXHRcdFx0bWFwKHNlc3Npb24gPT4gc2Vzc2lvbi5nZXRBbGxUaHJlYWRzKCkpLlxuXHRcdFx0cmVkdWNlKChwcmV2LCBjdXJyKSA9PiBwcmV2LmNvbmNhdChjdXJyKSwgW10pLlxuXHRcdFx0bWFwKHRocmVhZCA9PiB0aHJlYWQuZ2V0VG9wU3RhY2tGcmFtZSgpKS5cblx0XHRcdG1hcChmcmFtZSA9PiBmcmFtZT8uaW5zdHJ1Y3Rpb25Qb2ludGVyUmVmZXJlbmNlKS5cblx0XHRcdG1hcChyZWYgPT4gcmVmID8gdGhpcy5nZXRSZWZlcmVuY2VBZGRyZXNzKHJlZikgOiB1bmRlZmluZWQpO1xuXHR9XG5cblx0Ly8gSW5zdHJ1Y3Rpb24gcmVmZXJlbmNlIG9mIHRoZSB0b3Agc3RhY2sgZnJhbWUgb2YgdGhlIGZvY3VzZWQgc3RhY2tcblx0Z2V0IGZvY3VzZWRDdXJyZW50SW5zdHJ1Y3Rpb25SZWZlcmVuY2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU3RhY2tGcmFtZT8udGhyZWFkLmdldFRvcFN0YWNrRnJhbWUoKT8uaW5zdHJ1Y3Rpb25Qb2ludGVyUmVmZXJlbmNlO1xuXHR9XG5cblx0Z2V0IGZvY3VzZWRDdXJyZW50SW5zdHJ1Y3Rpb25BZGRyZXNzKCkge1xuXHRcdGNvbnN0IHJlZiA9IHRoaXMuZm9jdXNlZEN1cnJlbnRJbnN0cnVjdGlvblJlZmVyZW5jZTtcblx0XHRyZXR1cm4gcmVmID8gdGhpcy5nZXRSZWZlcmVuY2VBZGRyZXNzKHJlZikgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXQgZm9jdXNlZEluc3RydWN0aW9uUmVmZXJlbmNlKCkge1xuXHRcdHJldHVybiB0aGlzLl9kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFN0YWNrRnJhbWU/Lmluc3RydWN0aW9uUG9pbnRlclJlZmVyZW5jZTtcblx0fVxuXG5cdGdldCBmb2N1c2VkSW5zdHJ1Y3Rpb25BZGRyZXNzKCkge1xuXHRcdGNvbnN0IHJlZiA9IHRoaXMuZm9jdXNlZEluc3RydWN0aW9uUmVmZXJlbmNlO1xuXHRcdHJldHVybiByZWYgPyB0aGlzLmdldFJlZmVyZW5jZUFkZHJlc3MocmVmKSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldCBpc1NvdXJjZUNvZGVSZW5kZXIoKSB7IHJldHVybiB0aGlzLl9lbmFibGVTb3VyY2VDb2RlUmVuZGVyOyB9XG5cblx0Z2V0IGRlYnVnU2Vzc2lvbigpOiBJRGVidWdTZXNzaW9uIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTZXNzaW9uO1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlU3RhY2tGcmFtZSgpIHsgcmV0dXJuIHRoaXMuX29uRGlkQ2hhbmdlU3RhY2tGcmFtZS5ldmVudDsgfVxuXG5cdGdldCBmb2N1c2VkQWRkcmVzc0FuZE9mZnNldCgpIHtcblx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zPy5nZXRGb2N1c2VkRWxlbWVudHMoKVswXTtcblx0XHRpZiAoIWVsZW1lbnQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVmZXJlbmNlID0gZWxlbWVudC5pbnN0cnVjdGlvblJlZmVyZW5jZTtcblx0XHRjb25zdCBvZmZzZXQgPSBOdW1iZXIoZWxlbWVudC5hZGRyZXNzIC0gdGhpcy5nZXRSZWZlcmVuY2VBZGRyZXNzKHJlZmVyZW5jZSkhKTtcblx0XHRyZXR1cm4geyByZWZlcmVuY2UsIG9mZnNldCwgYWRkcmVzczogZWxlbWVudC5hZGRyZXNzIH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgY3JlYXRlRWRpdG9yKHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9lbmFibGVTb3VyY2VDb2RlUmVuZGVyID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SURlYnVnQ29uZmlndXJhdGlvbj4oJ2RlYnVnJykuZGlzYXNzZW1ibHlWaWV3LnNob3dTb3VyY2VDb2RlO1xuXHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLmZvbnRJbmZvLmxpbmVIZWlnaHQ7XG5cdFx0Y29uc3QgdGhpc09NID0gdGhpcztcblx0XHRjb25zdCBkZWxlZ2F0ZSA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElUYWJsZVZpcnR1YWxEZWxlZ2F0ZTxJRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25FbnRyeT4ge1xuXHRcdFx0aGVhZGVyUm93SGVpZ2h0OiBudW1iZXIgPSAwOyAvLyBObyBoZWFkZXJcblx0XHRcdGdldEhlaWdodChyb3c6IElEaXNhc3NlbWJsZWRJbnN0cnVjdGlvbkVudHJ5KTogbnVtYmVyIHtcblx0XHRcdFx0aWYgKHRoaXNPTS5pc1NvdXJjZUNvZGVSZW5kZXIgJiYgcm93LnNob3dTb3VyY2VMb2NhdGlvbiAmJiByb3cuaW5zdHJ1Y3Rpb24ubG9jYXRpb24/LnBhdGggJiYgcm93Lmluc3RydWN0aW9uLmxpbmUpIHtcblx0XHRcdFx0XHQvLyBpbnN0cnVjdGlvbiBsaW5lICsgc291cmNlIGxpbmVzXG5cdFx0XHRcdFx0aWYgKHJvdy5pbnN0cnVjdGlvbi5lbmRMaW5lKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbGluZUhlaWdodCAqIChyb3cuaW5zdHJ1Y3Rpb24uZW5kTGluZSAtIHJvdy5pbnN0cnVjdGlvbi5saW5lICsgMik7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIHNvdXJjZSBpcyBvbmx5IGEgc2luZ2xlIGxpbmUuXG5cdFx0XHRcdFx0XHRyZXR1cm4gbGluZUhlaWdodCAqIDI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8ganVzdCBpbnN0cnVjdGlvbiBsaW5lXG5cdFx0XHRcdHJldHVybiBsaW5lSGVpZ2h0O1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBpbnN0cnVjdGlvblJlbmRlcmVyID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5zdHJ1Y3Rpb25SZW5kZXJlciwgdGhpcykpO1xuXG5cdFx0dGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoVGFibGUsXG5cdFx0XHQnRGlzYXNzZW1ibHlWaWV3JywgcGFyZW50LCBkZWxlZ2F0ZSxcblx0XHRcdFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiAnJyxcblx0XHRcdFx0XHR0b29sdGlwOiAnJyxcblx0XHRcdFx0XHR3ZWlnaHQ6IDAsXG5cdFx0XHRcdFx0bWluaW11bVdpZHRoOiB0aGlzLmZvbnRJbmZvLmxpbmVIZWlnaHQsXG5cdFx0XHRcdFx0bWF4aW11bVdpZHRoOiB0aGlzLmZvbnRJbmZvLmxpbmVIZWlnaHQsXG5cdFx0XHRcdFx0dGVtcGxhdGVJZDogQnJlYWtwb2ludFJlbmRlcmVyLlRFTVBMQVRFX0lELFxuXHRcdFx0XHRcdHByb2plY3Qocm93OiBJRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25FbnRyeSk6IElEaXNhc3NlbWJsZWRJbnN0cnVjdGlvbkVudHJ5IHsgcmV0dXJuIHJvdzsgfVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdkaXNhc3NlbWJseVRhYmxlQ29sdW1uTGFiZWwnLCBcImluc3RydWN0aW9uc1wiKSxcblx0XHRcdFx0XHR0b29sdGlwOiAnJyxcblx0XHRcdFx0XHR3ZWlnaHQ6IDAuMyxcblx0XHRcdFx0XHR0ZW1wbGF0ZUlkOiBJbnN0cnVjdGlvblJlbmRlcmVyLlRFTVBMQVRFX0lELFxuXHRcdFx0XHRcdHByb2plY3Qocm93OiBJRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25FbnRyeSk6IElEaXNhc3NlbWJsZWRJbnN0cnVjdGlvbkVudHJ5IHsgcmV0dXJuIHJvdzsgfVxuXHRcdFx0XHR9LFxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQnJlYWtwb2ludFJlbmRlcmVyLCB0aGlzKSxcblx0XHRcdFx0aW5zdHJ1Y3Rpb25SZW5kZXJlcixcblx0XHRcdF0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkZW50aXR5UHJvdmlkZXI6IHsgZ2V0SWQ6IChlOiBJRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25FbnRyeSkgPT4gZS5pbnN0cnVjdGlvbi5hZGRyZXNzIH0sXG5cdFx0XHRcdGhvcml6b250YWxTY3JvbGxpbmc6IGZhbHNlLFxuXHRcdFx0XHRvdmVycmlkZVN0eWxlczoge1xuXHRcdFx0XHRcdGxpc3RCYWNrZ3JvdW5kOiBlZGl0b3JCYWNrZ3JvdW5kXG5cdFx0XHRcdH0sXG5cdFx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdHNldFJvd0xpbmVIZWlnaHQ6IGZhbHNlLFxuXHRcdFx0XHRvcGVuT25TaW5nbGVDbGljazogZmFsc2UsXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogbmV3IEFjY2Vzc2liaWxpdHlQcm92aWRlcigpLFxuXHRcdFx0XHRtb3VzZVN1cHBvcnQ6IGZhbHNlXG5cdFx0XHR9XG5cdFx0KSkgYXMgV29ya2JlbmNoVGFibGU8SURpc2Fzc2VtYmxlZEluc3RydWN0aW9uRW50cnk+O1xuXG5cdFx0dGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zLmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnZGlzYXNzZW1ibHktdmlldycpO1xuXG5cdFx0aWYgKHRoaXMuZm9jdXNlZEluc3RydWN0aW9uUmVmZXJlbmNlKSB7XG5cdFx0XHR0aGlzLnJlbG9hZERpc2Fzc2VtYmx5KHRoaXMuZm9jdXNlZEluc3RydWN0aW9uUmVmZXJlbmNlLCAwKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9kaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMub25EaWRTY3JvbGwoZSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fbG9hZGluZ0xvY2spIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5vbGRTY3JvbGxUb3AgPiBlLnNjcm9sbFRvcCAmJiBlLnNjcm9sbFRvcCA8IGUuaGVpZ2h0KSB7XG5cdFx0XHRcdHRoaXMuX2xvYWRpbmdMb2NrID0gdHJ1ZTtcblx0XHRcdFx0Y29uc3QgcHJldlRvcCA9IE1hdGguZmxvb3IoZS5zY3JvbGxUb3AgLyB0aGlzLmZvbnRJbmZvLmxpbmVIZWlnaHQpO1xuXHRcdFx0XHR0aGlzLnNjcm9sbFVwX0xvYWREaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMoRGlzYXNzZW1ibHlWaWV3Lk5VTV9JTlNUUlVDVElPTlNfVE9fTE9BRCkudGhlbigobG9hZGVkKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGxvYWRlZCA+IDApIHtcblx0XHRcdFx0XHRcdHRoaXMuX2Rpc2Fzc2VtYmxlZEluc3RydWN0aW9ucyEucmV2ZWFsKHByZXZUb3AgKyBsb2FkZWQsIDApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLl9sb2FkaW5nTG9jayA9IGZhbHNlO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSBpZiAoZS5vbGRTY3JvbGxUb3AgPCBlLnNjcm9sbFRvcCAmJiBlLnNjcm9sbFRvcCArIGUuaGVpZ2h0ID4gZS5zY3JvbGxIZWlnaHQgLSBlLmhlaWdodCkge1xuXHRcdFx0XHR0aGlzLl9sb2FkaW5nTG9jayA9IHRydWU7XG5cdFx0XHRcdHRoaXMuc2Nyb2xsRG93bl9Mb2FkRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zKERpc2Fzc2VtYmx5Vmlldy5OVU1fSU5TVFJVQ1RJT05TX1RPX0xPQUQpLnRoZW4oKCkgPT4geyB0aGlzLl9sb2FkaW5nTG9jayA9IGZhbHNlOyB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkub25EaWRGb2N1c1N0YWNrRnJhbWUoKHsgc3RhY2tGcmFtZSB9KSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zICYmIHN0YWNrRnJhbWU/Lmluc3RydWN0aW9uUG9pbnRlclJlZmVyZW5jZSkge1xuXHRcdFx0XHR0aGlzLmdvVG9JbnN0cnVjdGlvbkFuZE9mZnNldChzdGFja0ZyYW1lLmluc3RydWN0aW9uUG9pbnRlclJlZmVyZW5jZSwgMCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVN0YWNrRnJhbWUuZmlyZSgpO1xuXHRcdH0pKTtcblxuXHRcdC8vIHJlZnJlc2ggYnJlYWtwb2ludHMgdmlld1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2RlYnVnU2VydmljZS5nZXRNb2RlbCgpLm9uRGlkQ2hhbmdlQnJlYWtwb2ludHMoYnBFdmVudCA9PiB7XG5cdFx0XHRpZiAoYnBFdmVudCAmJiB0aGlzLl9kaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMpIHtcblx0XHRcdFx0Ly8gZHJhdyB2aWV3YWJsZSBCUFxuXHRcdFx0XHRsZXQgY2hhbmdlZCA9IGZhbHNlO1xuXHRcdFx0XHRicEV2ZW50LmFkZGVkPy5mb3JFYWNoKChicCkgPT4ge1xuXHRcdFx0XHRcdGlmIChicCBpbnN0YW5jZW9mIEluc3RydWN0aW9uQnJlYWtwb2ludCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLmdldEluZGV4RnJvbVJlZmVyZW5jZUFuZE9mZnNldChicC5pbnN0cnVjdGlvblJlZmVyZW5jZSwgYnAub2Zmc2V0KTtcblx0XHRcdFx0XHRcdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX2Rpc2Fzc2VtYmxlZEluc3RydWN0aW9ucyEucm93KGluZGV4KS5pc0JyZWFrcG9pbnRTZXQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9kaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMhLnJvdyhpbmRleCkuaXNCcmVha3BvaW50RW5hYmxlZCA9IGJwLmVuYWJsZWQ7XG5cdFx0XHRcdFx0XHRcdGNoYW5nZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0YnBFdmVudC5yZW1vdmVkPy5mb3JFYWNoKChicCkgPT4ge1xuXHRcdFx0XHRcdGlmIChicCBpbnN0YW5jZW9mIEluc3RydWN0aW9uQnJlYWtwb2ludCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLmdldEluZGV4RnJvbVJlZmVyZW5jZUFuZE9mZnNldChicC5pbnN0cnVjdGlvblJlZmVyZW5jZSwgYnAub2Zmc2V0KTtcblx0XHRcdFx0XHRcdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX2Rpc2Fzc2VtYmxlZEluc3RydWN0aW9ucyEucm93KGluZGV4KS5pc0JyZWFrcG9pbnRTZXQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0Y2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRicEV2ZW50LmNoYW5nZWQ/LmZvckVhY2goKGJwKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGJwIGluc3RhbmNlb2YgSW5zdHJ1Y3Rpb25CcmVha3BvaW50KSB7XG5cdFx0XHRcdFx0XHRjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXhGcm9tUmVmZXJlbmNlQW5kT2Zmc2V0KGJwLmluc3RydWN0aW9uUmVmZXJlbmNlLCBicC5vZmZzZXQpO1xuXHRcdFx0XHRcdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdFx0XHRcdFx0aWYgKHRoaXMuX2Rpc2Fzc2VtYmxlZEluc3RydWN0aW9ucyEucm93KGluZGV4KS5pc0JyZWFrcG9pbnRFbmFibGVkICE9PSBicC5lbmFibGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zIS5yb3coaW5kZXgpLmlzQnJlYWtwb2ludEVuYWJsZWQgPSBicC5lbmFibGVkO1xuXHRcdFx0XHRcdFx0XHRcdGNoYW5nZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyBnZXQgYW4gdXBkYXRlZCBsaXN0IHNvIHRoYXQgaXRlbXMgYmV5b25kIHRoZSBjdXJyZW50IHJhbmdlIHdvdWxkIHJlbmRlciB3aGVuIHJlYWNoZWQuXG5cdFx0XHRcdHRoaXMuX2luc3RydWN0aW9uQnBMaXN0ID0gdGhpcy5fZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0SW5zdHJ1Y3Rpb25CcmVha3BvaW50cygpO1xuXG5cdFx0XHRcdC8vIGJyZWFrcG9pbnRzIHJlc3RvcmVkIGZyb20gYSBwcmV2aW91cyBzZXNzaW9uIGNhbiBiZSBiYXNlZCBvbiBtZW1vcnlcblx0XHRcdFx0Ly8gcmVmZXJlbmNlcyB0aGF0IG1heSBubyBsb25nZXIgZXhpc3QgaW4gdGhlIGN1cnJlbnQgc2Vzc2lvbi4gUmVxdWVzdFxuXHRcdFx0XHQvLyB0aG9zZSBpbnN0cnVjdGlvbnMgdG8gYmUgbG9hZGVkIHNvIHRoZSBCUCBjYW4gYmUgZGlzcGxheWVkLlxuXHRcdFx0XHRmb3IgKGNvbnN0IGJwIG9mIHRoaXMuX2luc3RydWN0aW9uQnBMaXN0KSB7XG5cdFx0XHRcdFx0dGhpcy5wcmltZU1lbW9yeVJlZmVyZW5jZShicC5pbnN0cnVjdGlvblJlZmVyZW5jZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY2hhbmdlZCkge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhY2tGcmFtZS5maXJlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9kZWJ1Z1NlcnZpY2Uub25EaWRDaGFuZ2VTdGF0ZShlID0+IHtcblx0XHRcdGlmICgoZSA9PT0gU3RhdGUuUnVubmluZyB8fCBlID09PSBTdGF0ZS5TdG9wcGVkKSAmJlxuXHRcdFx0XHQodGhpcy5fcHJldmlvdXNEZWJ1Z2dpbmdTdGF0ZSAhPT0gU3RhdGUuUnVubmluZyAmJiB0aGlzLl9wcmV2aW91c0RlYnVnZ2luZ1N0YXRlICE9PSBTdGF0ZS5TdG9wcGVkKSkge1xuXHRcdFx0XHQvLyBKdXN0IHN0YXJ0ZWQgZGVidWdnaW5nLCBjbGVhciB0aGUgdmlld1xuXHRcdFx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0XHRcdHRoaXMuX2VuYWJsZVNvdXJjZUNvZGVSZW5kZXIgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRGVidWdDb25maWd1cmF0aW9uPignZGVidWcnKS5kaXNhc3NlbWJseVZpZXcuc2hvd1NvdXJjZUNvZGU7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3ByZXZpb3VzRGVidWdnaW5nU3RhdGUgPSBlO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGFja0ZyYW1lLmZpcmUoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRsYXlvdXQoZGltZW5zaW9uOiBEaW1lbnNpb24pOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnM/LmxheW91dChkaW1lbnNpb24uaGVpZ2h0KTtcblx0fVxuXG5cdGFzeW5jIGdvVG9JbnN0cnVjdGlvbkFuZE9mZnNldChpbnN0cnVjdGlvblJlZmVyZW5jZTogc3RyaW5nLCBvZmZzZXQ6IG51bWJlciwgZm9jdXM/OiBib29sZWFuKSB7XG5cdFx0bGV0IGFkZHIgPSB0aGlzLl9yZWZlcmVuY2VUb01lbW9yeUFkZHJlc3MuZ2V0KGluc3RydWN0aW9uUmVmZXJlbmNlKTtcblx0XHRpZiAoYWRkciA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmxvYWREaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMoaW5zdHJ1Y3Rpb25SZWZlcmVuY2UsIDAsIC1EaXNhc3NlbWJseVZpZXcuTlVNX0lOU1RSVUNUSU9OU19UT19MT0FELCBEaXNhc3NlbWJseVZpZXcuTlVNX0lOU1RSVUNUSU9OU19UT19MT0FEICogMik7XG5cdFx0XHRhZGRyID0gdGhpcy5fcmVmZXJlbmNlVG9NZW1vcnlBZGRyZXNzLmdldChpbnN0cnVjdGlvblJlZmVyZW5jZSk7XG5cdFx0fVxuXG5cdFx0aWYgKGFkZHIpIHtcblx0XHRcdHRoaXMuZ29Ub0FkZHJlc3MoYWRkciArIEJpZ0ludChvZmZzZXQpLCBmb2N1cyk7XG5cdFx0fVxuXHR9XG5cblx0LyoqIEdldHMgdGhlIGFkZHJlc3MgYXNzb2NpYXRlZCB3aXRoIHRoZSBpbnN0cnVjdGlvbiByZWZlcmVuY2UuICovXG5cdGdldFJlZmVyZW5jZUFkZHJlc3MoaW5zdHJ1Y3Rpb25SZWZlcmVuY2U6IHN0cmluZykge1xuXHRcdHJldHVybiB0aGlzLl9yZWZlcmVuY2VUb01lbW9yeUFkZHJlc3MuZ2V0KGluc3RydWN0aW9uUmVmZXJlbmNlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHbyB0byB0aGUgYWRkcmVzcyBwcm92aWRlZC4gSWYgbm8gYWRkcmVzcyBpcyBwcm92aWRlZCwgcmV2ZWFsIHRoZSBhZGRyZXNzIG9mIHRoZSBjdXJyZW50bHkgZm9jdXNlZCBzdGFjayBmcmFtZS4gUmV0dXJucyBmYWxzZSBpZiB0aGF0IGFkZHJlc3MgaXMgbm90IGF2YWlsYWJsZS5cblx0ICovXG5cdHByaXZhdGUgZ29Ub0FkZHJlc3MoYWRkcmVzczogYmlnaW50LCBmb2N1cz86IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuX2Rpc2Fzc2VtYmxlZEluc3RydWN0aW9ucykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICghYWRkcmVzcykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJbmRleEZyb21BZGRyZXNzKGFkZHJlc3MpO1xuXHRcdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0XHR0aGlzLl9kaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMucmV2ZWFsKGluZGV4KTtcblxuXHRcdFx0aWYgKGZvY3VzKSB7XG5cdFx0XHRcdHRoaXMuX2Rpc2Fzc2VtYmxlZEluc3RydWN0aW9ucy5kb21Gb2N1cygpO1xuXHRcdFx0XHR0aGlzLl9kaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMuc2V0Rm9jdXMoW2luZGV4XSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNjcm9sbFVwX0xvYWREaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMoaW5zdHJ1Y3Rpb25Db3VudDogbnVtYmVyKTogUHJvbWlzZTxudW1iZXI+IHtcblx0XHRjb25zdCBmaXJzdCA9IHRoaXMuX2Rpc2Fzc2VtYmxlZEluc3RydWN0aW9ucz8ucm93KDApO1xuXHRcdGlmIChmaXJzdCkge1xuXHRcdFx0cmV0dXJuIHRoaXMubG9hZERpc2Fzc2VtYmxlZEluc3RydWN0aW9ucyhcblx0XHRcdFx0Zmlyc3QuaW5zdHJ1Y3Rpb25SZWZlcmVuY2UsXG5cdFx0XHRcdGZpcnN0Lmluc3RydWN0aW9uUmVmZXJlbmNlT2Zmc2V0LFxuXHRcdFx0XHRmaXJzdC5pbnN0cnVjdGlvbk9mZnNldCAtIGluc3RydWN0aW9uQ291bnQsXG5cdFx0XHRcdGluc3RydWN0aW9uQ291bnQsXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdHJldHVybiAwO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzY3JvbGxEb3duX0xvYWREaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMoaW5zdHJ1Y3Rpb25Db3VudDogbnVtYmVyKTogUHJvbWlzZTxudW1iZXI+IHtcblx0XHRjb25zdCBsYXN0ID0gdGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zPy5yb3codGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zPy5sZW5ndGggLSAxKTtcblx0XHRpZiAobGFzdCkge1xuXHRcdFx0cmV0dXJuIHRoaXMubG9hZERpc2Fzc2VtYmxlZEluc3RydWN0aW9ucyhcblx0XHRcdFx0bGFzdC5pbnN0cnVjdGlvblJlZmVyZW5jZSxcblx0XHRcdFx0bGFzdC5pbnN0cnVjdGlvblJlZmVyZW5jZU9mZnNldCxcblx0XHRcdFx0bGFzdC5pbnN0cnVjdGlvbk9mZnNldCArIDEsXG5cdFx0XHRcdGluc3RydWN0aW9uQ291bnQsXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdHJldHVybiAwO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIG1lbW9yeSByZWZlcmVuY2UgYWRkcmVzcy4gV2UgZG9uJ3QganVzdCBsb2FkRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zXG5cdCAqIGZvciB0aGlzLCBzaW5jZSB3ZSBjYW4ndCByZWFsbHkgZGVhbCB3aXRoIGRpc2NvbnRpZ3VvdXMgcmFuZ2VzICh3ZSBjYW4ndFxuXHQgKiBkZXRlY3QgX2lmXyBhIHJhbmdlIGlzIGRpc2NvbnRpZ3VvdXMgc2luY2Ugd2UgZG9uJ3Qga25vdyBob3cgbXVjaCBtZW1vcnlcblx0ICogY29tZXMgYmV0d2VlbiBpbnN0cnVjdGlvbnMuKVxuXHQgKi9cblx0cHJpdmF0ZSBhc3luYyBwcmltZU1lbW9yeVJlZmVyZW5jZShpbnN0cnVjdGlvblJlZmVyZW5jZTogc3RyaW5nKSB7XG5cdFx0aWYgKHRoaXMuX3JlZmVyZW5jZVRvTWVtb3J5QWRkcmVzcy5oYXMoaW5zdHJ1Y3Rpb25SZWZlcmVuY2UpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBzID0gYXdhaXQgdGhpcy5kZWJ1Z1Nlc3Npb24/LmRpc2Fzc2VtYmxlKGluc3RydWN0aW9uUmVmZXJlbmNlLCAwLCAwLCAxKTtcblx0XHRpZiAocyAmJiBzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMuX3JlZmVyZW5jZVRvTWVtb3J5QWRkcmVzcy5zZXQoaW5zdHJ1Y3Rpb25SZWZlcmVuY2UsIEJpZ0ludChzWzBdLmFkZHJlc3MpKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8qKiBMb2FkcyBkaXNhc2VtYmxlZCBpbnN0cnVjdGlvbnMuIFJldHVybnMgdGhlIG51bWJlciBvZiBpbnN0cnVjdGlvbnMgdGhhdCB3ZXJlIGxvYWRlZC4gKi9cblx0cHJpdmF0ZSBhc3luYyBsb2FkRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zKGluc3RydWN0aW9uUmVmZXJlbmNlOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyLCBpbnN0cnVjdGlvbk9mZnNldDogbnVtYmVyLCBpbnN0cnVjdGlvbkNvdW50OiBudW1iZXIpOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmRlYnVnU2Vzc2lvbjtcblx0XHRjb25zdCByZXN1bHRFbnRyaWVzID0gYXdhaXQgc2Vzc2lvbj8uZGlzYXNzZW1ibGUoaW5zdHJ1Y3Rpb25SZWZlcmVuY2UsIG9mZnNldCwgaW5zdHJ1Y3Rpb25PZmZzZXQsIGluc3RydWN0aW9uQ291bnQpO1xuXG5cdFx0Ly8gRW5zdXJlIHdlIGFsd2F5cyBsb2FkIHRoZSBiYXNlbGluZSBpbnN0cnVjdGlvbnMgc28gd2Uga25vdyB3aGF0IGFkZHJlc3MgdGhlIGluc3RydWN0aW9uUmVmZXJlbmNlIHJlZmVycyB0by5cblx0XHRpZiAoIXRoaXMuX3JlZmVyZW5jZVRvTWVtb3J5QWRkcmVzcy5oYXMoaW5zdHJ1Y3Rpb25SZWZlcmVuY2UpICYmIGluc3RydWN0aW9uT2Zmc2V0ICE9PSAwKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmxvYWREaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMoaW5zdHJ1Y3Rpb25SZWZlcmVuY2UsIDAsIDAsIERpc2Fzc2VtYmx5Vmlldy5OVU1fSU5TVFJVQ1RJT05TX1RPX0xPQUQpO1xuXHRcdH1cblxuXHRcdGlmIChzZXNzaW9uICYmIHJlc3VsdEVudHJpZXMgJiYgdGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zKSB7XG5cdFx0XHRjb25zdCBuZXdFbnRyaWVzOiBJRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25FbnRyeVtdID0gW107XG5cblx0XHRcdGxldCBsYXN0TG9jYXRpb246IERlYnVnUHJvdG9jb2wuU291cmNlIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IGxhc3RMaW5lOiBJUmFuZ2UgfCB1bmRlZmluZWQ7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdEVudHJpZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgaW5zdHJ1Y3Rpb24gPSByZXN1bHRFbnRyaWVzW2ldO1xuXHRcdFx0XHRjb25zdCB0aGlzSW5zdHJ1Y3Rpb25PZmZzZXQgPSBpbnN0cnVjdGlvbk9mZnNldCArIGk7XG5cblx0XHRcdFx0Ly8gRm9yd2FyZCBmaWxsIHRoZSBtaXNzaW5nIGxvY2F0aW9uIGFzIGRldGFpbGVkIGluIHRoZSBEQVAgc3BlYy5cblx0XHRcdFx0aWYgKGluc3RydWN0aW9uLmxvY2F0aW9uKSB7XG5cdFx0XHRcdFx0bGFzdExvY2F0aW9uID0gaW5zdHJ1Y3Rpb24ubG9jYXRpb247XG5cdFx0XHRcdFx0bGFzdExpbmUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaW5zdHJ1Y3Rpb24ubGluZSkge1xuXHRcdFx0XHRcdGNvbnN0IGN1cnJlbnRMaW5lOiBJUmFuZ2UgPSB7XG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IGluc3RydWN0aW9uLmxpbmUsXG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogaW5zdHJ1Y3Rpb24uY29sdW1uID8/IDAsXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiBpbnN0cnVjdGlvbi5lbmRMaW5lID8/IGluc3RydWN0aW9uLmxpbmUsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IGluc3RydWN0aW9uLmVuZENvbHVtbiA/PyAwLFxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHQvLyBBZGQgbG9jYXRpb24gb25seSB0byB0aGUgZmlyc3QgdW5pcXVlIHJhbmdlLiBUaGlzIHdpbGwgZ2l2ZSB0aGUgYXBwZWFyYW5jZSBvZiBncm91cGluZyBvZiBpbnN0cnVjdGlvbnMuXG5cdFx0XHRcdFx0aWYgKCFSYW5nZS5lcXVhbHNSYW5nZShjdXJyZW50TGluZSwgbGFzdExpbmUgPz8gbnVsbCkpIHtcblx0XHRcdFx0XHRcdGxhc3RMaW5lID0gY3VycmVudExpbmU7XG5cdFx0XHRcdFx0XHRpbnN0cnVjdGlvbi5sb2NhdGlvbiA9IGxhc3RMb2NhdGlvbjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgYWRkcmVzczogYmlnaW50O1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGFkZHJlc3MgPSBCaWdJbnQoaW5zdHJ1Y3Rpb24uYWRkcmVzcyk7XG5cdFx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoYENvdWxkIG5vdCBwYXJzZSBkaXNhc3NlbWJseSBhZGRyZXNzICR7aW5zdHJ1Y3Rpb24uYWRkcmVzc30gKGluICR7SlNPTi5zdHJpbmdpZnkoaW5zdHJ1Y3Rpb24pfSlgKTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGVudHJ5OiBJRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25FbnRyeSA9IHtcblx0XHRcdFx0XHRhbGxvd0JyZWFrcG9pbnQ6IHRydWUsXG5cdFx0XHRcdFx0aXNCcmVha3BvaW50U2V0OiBmYWxzZSxcblx0XHRcdFx0XHRpc0JyZWFrcG9pbnRFbmFibGVkOiBmYWxzZSxcblx0XHRcdFx0XHRpbnN0cnVjdGlvblJlZmVyZW5jZSxcblx0XHRcdFx0XHRpbnN0cnVjdGlvblJlZmVyZW5jZU9mZnNldDogb2Zmc2V0LFxuXHRcdFx0XHRcdGluc3RydWN0aW9uT2Zmc2V0OiB0aGlzSW5zdHJ1Y3Rpb25PZmZzZXQsXG5cdFx0XHRcdFx0aW5zdHJ1Y3Rpb24sXG5cdFx0XHRcdFx0YWRkcmVzcyxcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRuZXdFbnRyaWVzLnB1c2goZW50cnkpO1xuXG5cdFx0XHRcdC8vIGlmIHdlIGp1c3QgbG9hZGVkIHRoZSBmaXJzdCBpbnN0cnVjdGlvbiBmb3IgdGhpcyByZWZlcmVuY2UsIG1hcmsgaXRzIGFkZHJlc3MuXG5cdFx0XHRcdGlmIChvZmZzZXQgPT09IDAgJiYgdGhpc0luc3RydWN0aW9uT2Zmc2V0ID09PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5fcmVmZXJlbmNlVG9NZW1vcnlBZGRyZXNzLnNldChpbnN0cnVjdGlvblJlZmVyZW5jZSwgYWRkcmVzcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKG5ld0VudHJpZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZWZCYXNlQWRkcmVzcyA9IHRoaXMuX3JlZmVyZW5jZVRvTWVtb3J5QWRkcmVzcy5nZXQoaW5zdHJ1Y3Rpb25SZWZlcmVuY2UpO1xuXHRcdFx0Y29uc3QgYnBzID0gdGhpcy5faW5zdHJ1Y3Rpb25CcExpc3QubWFwKHAgPT4ge1xuXHRcdFx0XHRjb25zdCBiYXNlID0gdGhpcy5fcmVmZXJlbmNlVG9NZW1vcnlBZGRyZXNzLmdldChwLmluc3RydWN0aW9uUmVmZXJlbmNlKTtcblx0XHRcdFx0aWYgKCFiYXNlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGVuYWJsZWQ6IHAuZW5hYmxlZCxcblx0XHRcdFx0XHRhZGRyZXNzOiBiYXNlICsgQmlnSW50KHAub2Zmc2V0IHx8IDApLFxuXHRcdFx0XHR9O1xuXHRcdFx0fSk7XG5cblx0XHRcdGlmIChyZWZCYXNlQWRkcmVzcyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgZW50cnkgb2YgbmV3RW50cmllcykge1xuXHRcdFx0XHRcdGNvbnN0IGJwID0gYnBzLmZpbmQocCA9PiBwPy5hZGRyZXNzID09PSBlbnRyeS5hZGRyZXNzKTtcblx0XHRcdFx0XHRpZiAoYnApIHtcblx0XHRcdFx0XHRcdGVudHJ5LmlzQnJlYWtwb2ludFNldCA9IHRydWU7XG5cdFx0XHRcdFx0XHRlbnRyeS5pc0JyZWFrcG9pbnRFbmFibGVkID0gYnAuZW5hYmxlZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGEgPSB0aGlzLl9kaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnM7XG5cdFx0XHRpZiAoZGEubGVuZ3RoID09PSAxICYmIHRoaXMuX2Rpc2Fzc2VtYmxlZEluc3RydWN0aW9ucy5yb3coMCkgPT09IGRpc2Fzc2VtYmx5Tm90QXZhaWxhYmxlKSB7XG5cdFx0XHRcdGRhLnNwbGljZSgwLCAxKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZmlyc3RBZGRyID0gbmV3RW50cmllc1swXS5hZGRyZXNzO1xuXHRcdFx0Y29uc3QgbGFzdEFkZHIgPSBuZXdFbnRyaWVzW25ld0VudHJpZXMubGVuZ3RoIC0gMV0uYWRkcmVzcztcblxuXHRcdFx0Y29uc3Qgc3RhcnROID0gYmluYXJ5U2VhcmNoMihkYS5sZW5ndGgsIGkgPT4gTnVtYmVyKGRhLnJvdyhpKS5hZGRyZXNzIC0gZmlyc3RBZGRyKSk7XG5cdFx0XHRjb25zdCBzdGFydCA9IHN0YXJ0TiA8IDAgPyB+c3RhcnROIDogc3RhcnROO1xuXHRcdFx0Y29uc3QgZW5kTiA9IGJpbmFyeVNlYXJjaDIoZGEubGVuZ3RoLCBpID0+IE51bWJlcihkYS5yb3coaSkuYWRkcmVzcyAtIGxhc3RBZGRyKSk7XG5cdFx0XHRjb25zdCBlbmQgPSBlbmROIDwgMCA/IH5lbmROIDogZW5kTiArIDE7XG5cdFx0XHRjb25zdCB0b0RlbGV0ZSA9IGVuZCAtIHN0YXJ0O1xuXG5cdFx0XHQvLyBHbyB0aHJvdWdoIGV2ZXJ5dGhpbmcgd2UncmUgYWJvdXQgdG8gYWRkLCBhbmQgb25seSBzaG93IHRoZSBzb3VyY2Vcblx0XHRcdC8vIGxvY2F0aW9uIGlmIGl0J3MgZGlmZmVyZW50IGZyb20gdGhlIHByZXZpb3VzIG9uZSwgXCJncm91cGluZ1wiIGluc3RydWN0aW9ucyBieSBsaW5lXG5cdFx0XHRsZXQgbGFzdExvY2F0ZWQ6IHVuZGVmaW5lZCB8IERlYnVnUHJvdG9jb2wuRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb247XG5cdFx0XHRmb3IgKGxldCBpID0gc3RhcnQgLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0XHRjb25zdCB7IGluc3RydWN0aW9uIH0gPSBkYS5yb3coaSk7XG5cdFx0XHRcdGlmIChpbnN0cnVjdGlvbi5sb2NhdGlvbiAmJiBpbnN0cnVjdGlvbi5saW5lICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRsYXN0TG9jYXRlZCA9IGluc3RydWN0aW9uO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHNob3VsZFNob3dMb2NhdGlvbiA9IChpbnN0cnVjdGlvbjogRGVidWdQcm90b2NvbC5EaXNhc3NlbWJsZWRJbnN0cnVjdGlvbikgPT5cblx0XHRcdFx0aW5zdHJ1Y3Rpb24ubGluZSAhPT0gdW5kZWZpbmVkICYmIGluc3RydWN0aW9uLmxvY2F0aW9uICE9PSB1bmRlZmluZWQgJiZcblx0XHRcdFx0KCFsYXN0TG9jYXRlZCB8fCAhc291cmNlc0VxdWFsKGluc3RydWN0aW9uLmxvY2F0aW9uLCBsYXN0TG9jYXRlZC5sb2NhdGlvbikgfHwgaW5zdHJ1Y3Rpb24ubGluZSAhPT0gbGFzdExvY2F0ZWQubGluZSk7XG5cblx0XHRcdGZvciAoY29uc3QgZW50cnkgb2YgbmV3RW50cmllcykge1xuXHRcdFx0XHRpZiAoc2hvdWxkU2hvd0xvY2F0aW9uKGVudHJ5Lmluc3RydWN0aW9uKSkge1xuXHRcdFx0XHRcdGVudHJ5LnNob3dTb3VyY2VMb2NhdGlvbiA9IHRydWU7XG5cdFx0XHRcdFx0bGFzdExvY2F0ZWQgPSBlbnRyeS5pbnN0cnVjdGlvbjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRkYS5zcGxpY2Uoc3RhcnQsIHRvRGVsZXRlLCBuZXdFbnRyaWVzKTtcblxuXHRcdFx0cmV0dXJuIG5ld0VudHJpZXMubGVuZ3RoIC0gdG9EZWxldGU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRwcml2YXRlIGdldEluZGV4RnJvbVJlZmVyZW5jZUFuZE9mZnNldChpbnN0cnVjdGlvblJlZmVyZW5jZTogc3RyaW5nLCBvZmZzZXQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3QgYWRkciA9IHRoaXMuX3JlZmVyZW5jZVRvTWVtb3J5QWRkcmVzcy5nZXQoaW5zdHJ1Y3Rpb25SZWZlcmVuY2UpO1xuXHRcdGlmIChhZGRyID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5nZXRJbmRleEZyb21BZGRyZXNzKGFkZHIgKyBCaWdJbnQob2Zmc2V0KSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEluZGV4RnJvbUFkZHJlc3MoYWRkcmVzczogYmlnaW50KTogbnVtYmVyIHtcblx0XHRjb25zdCBkaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMgPSB0aGlzLl9kaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnM7XG5cdFx0aWYgKGRpc2Fzc2VtYmxlZEluc3RydWN0aW9ucyAmJiBkaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuIGJpbmFyeVNlYXJjaDIoZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zLmxlbmd0aCwgaW5kZXggPT4ge1xuXHRcdFx0XHRjb25zdCByb3cgPSBkaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMucm93KGluZGV4KTtcblx0XHRcdFx0cmV0dXJuIE51bWJlcihyb3cuYWRkcmVzcyAtIGFkZHJlc3MpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIC0xO1xuXHR9XG5cblx0LyoqXG5cdCAqIENsZWFycyB0aGUgdGFibGUgYW5kIHJlbG9hZCBpbnN0cnVjdGlvbnMgbmVhciB0aGUgdGFyZ2V0IGFkZHJlc3Ncblx0ICovXG5cdHByaXZhdGUgcmVsb2FkRGlzYXNzZW1ibHkoaW5zdHJ1Y3Rpb25SZWZlcmVuY2U6IHN0cmluZywgb2Zmc2V0OiBudW1iZXIpIHtcblx0XHRpZiAoIXRoaXMuX2Rpc2Fzc2VtYmxlZEluc3RydWN0aW9ucykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2xvYWRpbmdMb2NrID0gdHJ1ZTsgLy8gc3RvcCBzY3JvbGxpbmcgZHVyaW5nIHRoZSBsb2FkLlxuXHRcdHRoaXMuY2xlYXIoKTtcblx0XHR0aGlzLl9pbnN0cnVjdGlvbkJwTGlzdCA9IHRoaXMuX2RlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldEluc3RydWN0aW9uQnJlYWtwb2ludHMoKTtcblx0XHR0aGlzLmxvYWREaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMoaW5zdHJ1Y3Rpb25SZWZlcmVuY2UsIG9mZnNldCwgLURpc2Fzc2VtYmx5Vmlldy5OVU1fSU5TVFJVQ1RJT05TX1RPX0xPQUQgKiA0LCBEaXNhc3NlbWJseVZpZXcuTlVNX0lOU1RSVUNUSU9OU19UT19MT0FEICogOCkudGhlbigoKSA9PiB7XG5cdFx0XHQvLyBvbiBsb2FkLCBzZXQgdGhlIHRhcmdldCBpbnN0cnVjdGlvbiBpbiB0aGUgbWlkZGxlIG9mIHRoZSBwYWdlLlxuXHRcdFx0aWYgKHRoaXMuX2Rpc2Fzc2VtYmxlZEluc3RydWN0aW9ucyEubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjb25zdCB0YXJnZXRJbmRleCA9IE1hdGguZmxvb3IodGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zIS5sZW5ndGggLyAyKTtcblx0XHRcdFx0dGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zIS5yZXZlYWwodGFyZ2V0SW5kZXgsIDAuNSk7XG5cblx0XHRcdFx0Ly8gQWx3YXlzIGZvY3VzIHRoZSB0YXJnZXQgYWRkcmVzcyBvbiByZWxvYWQsIG9yIGFycm93IGtleSBuYXZpZ2F0aW9uIHdvdWxkIGxvb2sgdGVycmlibGVcblx0XHRcdFx0dGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zIS5kb21Gb2N1cygpO1xuXHRcdFx0XHR0aGlzLl9kaXNhc3NlbWJsZWRJbnN0cnVjdGlvbnMhLnNldEZvY3VzKFt0YXJnZXRJbmRleF0pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbG9hZGluZ0xvY2sgPSBmYWxzZTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXIoKSB7XG5cdFx0dGhpcy5fcmVmZXJlbmNlVG9NZW1vcnlBZGRyZXNzLmNsZWFyKCk7XG5cdFx0dGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zPy5zcGxpY2UoMCwgdGhpcy5fZGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25zLmxlbmd0aCwgW2Rpc2Fzc2VtYmx5Tm90QXZhaWxhYmxlXSk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElCcmVha3BvaW50Q29sdW1uVGVtcGxhdGVEYXRhIHtcblx0Y3VycmVudEVsZW1lbnQ6IHsgZWxlbWVudD86IElEaXNhc3NlbWJsZWRJbnN0cnVjdGlvbkVudHJ5IH07XG5cdGljb246IEhUTUxFbGVtZW50O1xuXHRkaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXTtcbn1cblxuY2xhc3MgQnJlYWtwb2ludFJlbmRlcmVyIGltcGxlbWVudHMgSVRhYmxlUmVuZGVyZXI8SURpc2Fzc2VtYmxlZEluc3RydWN0aW9uRW50cnksIElCcmVha3BvaW50Q29sdW1uVGVtcGxhdGVEYXRhPiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFRFTVBMQVRFX0lEID0gJ2JyZWFrcG9pbnQnO1xuXG5cdHRlbXBsYXRlSWQ6IHN0cmluZyA9IEJyZWFrcG9pbnRSZW5kZXJlci5URU1QTEFURV9JRDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9icmVha3BvaW50SWNvbiA9ICdjb2RpY29uLScgKyBpY29ucy5icmVha3BvaW50LnJlZ3VsYXIuaWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2JyZWFrcG9pbnREaXNhYmxlZEljb24gPSAnY29kaWNvbi0nICsgaWNvbnMuYnJlYWtwb2ludC5kaXNhYmxlZC5pZDtcblx0cHJpdmF0ZSByZWFkb25seSBfYnJlYWtwb2ludEhpbnRJY29uID0gJ2NvZGljb24tJyArIGljb25zLmRlYnVnQnJlYWtwb2ludEhpbnQuaWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlYnVnU3RhY2tmcmFtZSA9ICdjb2RpY29uLScgKyBpY29ucy5kZWJ1Z1N0YWNrZnJhbWUuaWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlYnVnU3RhY2tmcmFtZUZvY3VzZWQgPSAnY29kaWNvbi0nICsgaWNvbnMuZGVidWdTdGFja2ZyYW1lRm9jdXNlZC5pZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kaXNhc3NlbWJseVZpZXc6IERpc2Fzc2VtYmx5Vmlldyxcblx0XHRASURlYnVnU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9kZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2Vcblx0KSB7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSUJyZWFrcG9pbnRDb2x1bW5UZW1wbGF0ZURhdGEge1xuXHRcdC8vIGFsaWduIGZyb20gdGhlIGJvdHRvbSBzbyB0aGF0IGl0IGxpbmVzIHVwIHdpdGggaW5zdHJ1Y3Rpb24gd2hlbiBzb3VyY2UgY29kZSBpcyBwcmVzZW50LlxuXHRcdGNvbnRhaW5lci5zdHlsZS5hbGlnblNlbGYgPSAnZmxleC1lbmQnO1xuXG5cdFx0Y29uc3QgaWNvbiA9IGFwcGVuZChjb250YWluZXIsICQoJy5jb2RpY29uJykpO1xuXHRcdGljb24uc3R5bGUuZGlzcGxheSA9ICdmbGV4Jztcblx0XHRpY29uLnN0eWxlLmFsaWduSXRlbXMgPSAnY2VudGVyJztcblx0XHRpY29uLnN0eWxlLmp1c3RpZnlDb250ZW50ID0gJ2NlbnRlcic7XG5cdFx0aWNvbi5zdHlsZS5oZWlnaHQgPSB0aGlzLl9kaXNhc3NlbWJseVZpZXcuZm9udEluZm8ubGluZUhlaWdodCArICdweCc7XG5cblx0XHRjb25zdCBjdXJyZW50RWxlbWVudDogeyBlbGVtZW50PzogSURpc2Fzc2VtYmxlZEluc3RydWN0aW9uRW50cnkgfSA9IHsgZWxlbWVudDogdW5kZWZpbmVkIH07XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IFtcblx0XHRcdHRoaXMuX2Rpc2Fzc2VtYmx5Vmlldy5vbkRpZENoYW5nZVN0YWNrRnJhbWUoKCkgPT4gdGhpcy5yZXJlbmRlckRlYnVnU3RhY2tmcmFtZShpY29uLCBjdXJyZW50RWxlbWVudC5lbGVtZW50KSksXG5cdFx0XHRhZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihjb250YWluZXIsICdtb3VzZW92ZXInLCAoKSA9PiB7XG5cdFx0XHRcdGlmIChjdXJyZW50RWxlbWVudC5lbGVtZW50Py5hbGxvd0JyZWFrcG9pbnQpIHtcblx0XHRcdFx0XHRpY29uLmNsYXNzTGlzdC5hZGQodGhpcy5fYnJlYWtwb2ludEhpbnRJY29uKTtcblx0XHRcdFx0fVxuXHRcdFx0fSksXG5cdFx0XHRhZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihjb250YWluZXIsICdtb3VzZW91dCcsICgpID0+IHtcblx0XHRcdFx0aWYgKGN1cnJlbnRFbGVtZW50LmVsZW1lbnQ/LmFsbG93QnJlYWtwb2ludCkge1xuXHRcdFx0XHRcdGljb24uY2xhc3NMaXN0LnJlbW92ZSh0aGlzLl9icmVha3BvaW50SGludEljb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSxcblx0XHRcdGFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKGNvbnRhaW5lciwgJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHRpZiAoY3VycmVudEVsZW1lbnQuZWxlbWVudD8uYWxsb3dCcmVha3BvaW50KSB7XG5cdFx0XHRcdFx0Ly8gY2xpY2sgc2hvdyBoaW50IHdoaWxlIHdhaXRpbmcgZm9yIEJQIHRvIHJlc29sdmUuXG5cdFx0XHRcdFx0aWNvbi5jbGFzc0xpc3QuYWRkKHRoaXMuX2JyZWFrcG9pbnRIaW50SWNvbik7XG5cdFx0XHRcdFx0Y29uc3QgcmVmZXJlbmNlID0gY3VycmVudEVsZW1lbnQuZWxlbWVudC5pbnN0cnVjdGlvblJlZmVyZW5jZTtcblx0XHRcdFx0XHRjb25zdCBvZmZzZXQgPSBOdW1iZXIoY3VycmVudEVsZW1lbnQuZWxlbWVudC5hZGRyZXNzIC0gdGhpcy5fZGlzYXNzZW1ibHlWaWV3LmdldFJlZmVyZW5jZUFkZHJlc3MocmVmZXJlbmNlKSEpO1xuXHRcdFx0XHRcdGlmIChjdXJyZW50RWxlbWVudC5lbGVtZW50LmlzQnJlYWtwb2ludFNldCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fZGVidWdTZXJ2aWNlLnJlbW92ZUluc3RydWN0aW9uQnJlYWtwb2ludHMocmVmZXJlbmNlLCBvZmZzZXQpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoY3VycmVudEVsZW1lbnQuZWxlbWVudC5hbGxvd0JyZWFrcG9pbnQgJiYgIWN1cnJlbnRFbGVtZW50LmVsZW1lbnQuaXNCcmVha3BvaW50U2V0KSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9kZWJ1Z1NlcnZpY2UuYWRkSW5zdHJ1Y3Rpb25CcmVha3BvaW50KHsgaW5zdHJ1Y3Rpb25SZWZlcmVuY2U6IHJlZmVyZW5jZSwgb2Zmc2V0LCBhZGRyZXNzOiBjdXJyZW50RWxlbWVudC5lbGVtZW50LmFkZHJlc3MsIGNhblBlcnNpc3Q6IGZhbHNlIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHRdO1xuXG5cdFx0cmV0dXJuIHsgY3VycmVudEVsZW1lbnQsIGljb24sIGRpc3Bvc2FibGVzIH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGVsZW1lbnQ6IElEaXNhc3NlbWJsZWRJbnN0cnVjdGlvbkVudHJ5LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElCcmVha3BvaW50Q29sdW1uVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5jdXJyZW50RWxlbWVudC5lbGVtZW50ID0gZWxlbWVudDtcblx0XHR0aGlzLnJlcmVuZGVyRGVidWdTdGFja2ZyYW1lKHRlbXBsYXRlRGF0YS5pY29uLCBlbGVtZW50KTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElCcmVha3BvaW50Q29sdW1uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0ZGlzcG9zZSh0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMpO1xuXHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcyA9IFtdO1xuXHR9XG5cblx0cHJpdmF0ZSByZXJlbmRlckRlYnVnU3RhY2tmcmFtZShpY29uOiBIVE1MRWxlbWVudCwgZWxlbWVudD86IElEaXNhc3NlbWJsZWRJbnN0cnVjdGlvbkVudHJ5KSB7XG5cdFx0aWYgKGVsZW1lbnQ/LmFkZHJlc3MgPT09IHRoaXMuX2Rpc2Fzc2VtYmx5Vmlldy5mb2N1c2VkQ3VycmVudEluc3RydWN0aW9uQWRkcmVzcykge1xuXHRcdFx0aWNvbi5jbGFzc0xpc3QuYWRkKHRoaXMuX2RlYnVnU3RhY2tmcmFtZSk7XG5cdFx0fSBlbHNlIGlmIChlbGVtZW50Py5hZGRyZXNzID09PSB0aGlzLl9kaXNhc3NlbWJseVZpZXcuZm9jdXNlZEluc3RydWN0aW9uQWRkcmVzcykge1xuXHRcdFx0aWNvbi5jbGFzc0xpc3QuYWRkKHRoaXMuX2RlYnVnU3RhY2tmcmFtZUZvY3VzZWQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpY29uLmNsYXNzTGlzdC5yZW1vdmUodGhpcy5fZGVidWdTdGFja2ZyYW1lKTtcblx0XHRcdGljb24uY2xhc3NMaXN0LnJlbW92ZSh0aGlzLl9kZWJ1Z1N0YWNrZnJhbWVGb2N1c2VkKTtcblx0XHR9XG5cblx0XHRpY29uLmNsYXNzTGlzdC5yZW1vdmUodGhpcy5fYnJlYWtwb2ludEhpbnRJY29uKTtcblxuXHRcdGlmIChlbGVtZW50Py5pc0JyZWFrcG9pbnRTZXQpIHtcblx0XHRcdGlmIChlbGVtZW50LmlzQnJlYWtwb2ludEVuYWJsZWQpIHtcblx0XHRcdFx0aWNvbi5jbGFzc0xpc3QuYWRkKHRoaXMuX2JyZWFrcG9pbnRJY29uKTtcblx0XHRcdFx0aWNvbi5jbGFzc0xpc3QucmVtb3ZlKHRoaXMuX2JyZWFrcG9pbnREaXNhYmxlZEljb24pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWNvbi5jbGFzc0xpc3QucmVtb3ZlKHRoaXMuX2JyZWFrcG9pbnRJY29uKTtcblx0XHRcdFx0aWNvbi5jbGFzc0xpc3QuYWRkKHRoaXMuX2JyZWFrcG9pbnREaXNhYmxlZEljb24pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpY29uLmNsYXNzTGlzdC5yZW1vdmUodGhpcy5fYnJlYWtwb2ludEljb24pO1xuXHRcdFx0aWNvbi5jbGFzc0xpc3QucmVtb3ZlKHRoaXMuX2JyZWFrcG9pbnREaXNhYmxlZEljb24pO1xuXHRcdH1cblx0fVxufVxuXG5pbnRlcmZhY2UgSUluc3RydWN0aW9uQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0Y3VycmVudEVsZW1lbnQ6IHsgZWxlbWVudD86IElEaXNhc3NlbWJsZWRJbnN0cnVjdGlvbkVudHJ5IH07XG5cdC8vIFRPRE86IGhvdmVyIHdpZGdldD9cblx0aW5zdHJ1Y3Rpb246IEhUTUxFbGVtZW50O1xuXHRzb3VyY2Vjb2RlOiBIVE1MRWxlbWVudDtcblx0Ly8gZGlzcG9zZWQgd2hlbiBjZWxsIGlzIGNsb3NlZC5cblx0Y2VsbERpc3Bvc2FibGU6IElEaXNwb3NhYmxlW107XG5cdC8vIGRpc3Bvc2VkIHdoZW4gdGVtcGxhdGUgaXMgY2xvc2VkLlxuXHRkaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXTtcbn1cblxuY2xhc3MgSW5zdHJ1Y3Rpb25SZW5kZXJlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGFibGVSZW5kZXJlcjxJRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25FbnRyeSwgSUluc3RydWN0aW9uQ29sdW1uVGVtcGxhdGVEYXRhPiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFRFTVBMQVRFX0lEID0gJ2luc3RydWN0aW9uJztcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBJTlNUUlVDVElPTl9BRERSX01JTl9MRU5HVEggPSAyNTtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgSU5TVFJVQ1RJT05fQllURVNfTUlOX0xFTkdUSCA9IDMwO1xuXG5cdHRlbXBsYXRlSWQ6IHN0cmluZyA9IEluc3RydWN0aW9uUmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cblx0cHJpdmF0ZSBfdG9wU3RhY2tGcmFtZUNvbG9yOiBDb2xvciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZm9jdXNlZFN0YWNrRnJhbWVDb2xvcjogQ29sb3IgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGlzYXNzZW1ibHlWaWV3OiBEaXNhc3NlbWJseVZpZXcsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpU2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3RvcFN0YWNrRnJhbWVDb2xvciA9IHRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkuZ2V0Q29sb3IodG9wU3RhY2tGcmFtZUNvbG9yKTtcblx0XHR0aGlzLl9mb2N1c2VkU3RhY2tGcmFtZUNvbG9yID0gdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKS5nZXRDb2xvcihmb2N1c2VkU3RhY2tGcmFtZUNvbG9yKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UoZSA9PiB7XG5cdFx0XHR0aGlzLl90b3BTdGFja0ZyYW1lQ29sb3IgPSBlLmdldENvbG9yKHRvcFN0YWNrRnJhbWVDb2xvcik7XG5cdFx0XHR0aGlzLl9mb2N1c2VkU3RhY2tGcmFtZUNvbG9yID0gZS5nZXRDb2xvcihmb2N1c2VkU3RhY2tGcmFtZUNvbG9yKTtcblx0XHR9KSk7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSUluc3RydWN0aW9uQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBzb3VyY2Vjb2RlID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNvdXJjZWNvZGUnKSk7XG5cdFx0Y29uc3QgaW5zdHJ1Y3Rpb24gPSBhcHBlbmQoY29udGFpbmVyLCAkKCcuaW5zdHJ1Y3Rpb24nKSk7XG5cdFx0dGhpcy5hcHBseUZvbnRJbmZvKHNvdXJjZWNvZGUpO1xuXHRcdHRoaXMuYXBwbHlGb250SW5mbyhpbnN0cnVjdGlvbik7XG5cdFx0Y29uc3QgY3VycmVudEVsZW1lbnQ6IHsgZWxlbWVudD86IElEaXNhc3NlbWJsZWRJbnN0cnVjdGlvbkVudHJ5IH0gPSB7IGVsZW1lbnQ6IHVuZGVmaW5lZCB9O1xuXHRcdGNvbnN0IGNlbGxEaXNwb3NhYmxlOiBJRGlzcG9zYWJsZVtdID0gW107XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IFtcblx0XHRcdHRoaXMuX2Rpc2Fzc2VtYmx5Vmlldy5vbkRpZENoYW5nZVN0YWNrRnJhbWUoKCkgPT4gdGhpcy5yZXJlbmRlckJhY2tncm91bmQoaW5zdHJ1Y3Rpb24sIHNvdXJjZWNvZGUsIGN1cnJlbnRFbGVtZW50LmVsZW1lbnQpKSxcblx0XHRcdGFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKHNvdXJjZWNvZGUsICdkYmxjbGljaycsICgpID0+IHRoaXMub3BlblNvdXJjZUNvZGUoY3VycmVudEVsZW1lbnQuZWxlbWVudD8uaW5zdHJ1Y3Rpb24pKSxcblx0XHRdO1xuXG5cdFx0cmV0dXJuIHsgY3VycmVudEVsZW1lbnQsIGluc3RydWN0aW9uLCBzb3VyY2Vjb2RlLCBjZWxsRGlzcG9zYWJsZSwgZGlzcG9zYWJsZXMgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSURpc2Fzc2VtYmxlZEluc3RydWN0aW9uRW50cnksIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUluc3RydWN0aW9uQ29sdW1uVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyRWxlbWVudElubmVyKGVsZW1lbnQsIGluZGV4LCB0ZW1wbGF0ZURhdGEsIGhlaWdodCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlbmRlckVsZW1lbnRJbm5lcihlbGVtZW50OiBJRGlzYXNzZW1ibGVkSW5zdHJ1Y3Rpb25FbnRyeSwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJSW5zdHJ1Y3Rpb25Db2x1bW5UZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGVtcGxhdGVEYXRhLmN1cnJlbnRFbGVtZW50LmVsZW1lbnQgPSBlbGVtZW50O1xuXHRcdGNvbnN0IGluc3RydWN0aW9uID0gZWxlbWVudC5pbnN0cnVjdGlvbjtcblx0XHR0ZW1wbGF0ZURhdGEuc291cmNlY29kZS5pbm5lclRleHQgPSAnJztcblx0XHRjb25zdCBzYiA9IG5ldyBTdHJpbmdCdWlsZGVyKDEwMDApO1xuXG5cdFx0aWYgKHRoaXMuX2Rpc2Fzc2VtYmx5Vmlldy5pc1NvdXJjZUNvZGVSZW5kZXIgJiYgZWxlbWVudC5zaG93U291cmNlTG9jYXRpb24gJiYgaW5zdHJ1Y3Rpb24ubG9jYXRpb24/LnBhdGggJiYgaW5zdHJ1Y3Rpb24ubGluZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBzb3VyY2VVUkkgPSB0aGlzLmdldFVyaUZyb21Tb3VyY2UoaW5zdHJ1Y3Rpb24pO1xuXG5cdFx0XHRpZiAoc291cmNlVVJJKSB7XG5cdFx0XHRcdGxldCB0ZXh0TW9kZWw6IElUZXh0TW9kZWwgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnN0IHNvdXJjZVNCID0gbmV3IFN0cmluZ0J1aWxkZXIoMTAwMDApO1xuXHRcdFx0XHRjb25zdCByZWYgPSBhd2FpdCB0aGlzLnRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2Uoc291cmNlVVJJKTtcblx0XHRcdFx0aWYgKHRlbXBsYXRlRGF0YS5jdXJyZW50RWxlbWVudC5lbGVtZW50ICE9PSBlbGVtZW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuOyAvLyBhdm9pZCBhIHJhY2UsICMxOTI4MzFcblx0XHRcdFx0fVxuXHRcdFx0XHR0ZXh0TW9kZWwgPSByZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbDtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmNlbGxEaXNwb3NhYmxlLnB1c2gocmVmKTtcblxuXHRcdFx0XHQvLyB0ZW1wbGF0ZURhdGEgY291bGQgaGF2ZSBtb3ZlZCBvbiBkdXJpbmcgYXN5bmMuICBEb3VibGUgY2hlY2sgaWYgaXQgaXMgc3RpbGwgdGhlIHNhbWUgc291cmNlLlxuXHRcdFx0XHRpZiAodGV4dE1vZGVsICYmIHRlbXBsYXRlRGF0YS5jdXJyZW50RWxlbWVudC5lbGVtZW50ID09PSBlbGVtZW50KSB7XG5cdFx0XHRcdFx0bGV0IGxpbmVOdW1iZXIgPSBpbnN0cnVjdGlvbi5saW5lO1xuXG5cdFx0XHRcdFx0d2hpbGUgKGxpbmVOdW1iZXIgJiYgbGluZU51bWJlciA+PSAxICYmIGxpbmVOdW1iZXIgPD0gdGV4dE1vZGVsLmdldExpbmVDb3VudCgpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBsaW5lQ29udGVudCA9IHRleHRNb2RlbC5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyKTtcblx0XHRcdFx0XHRcdHNvdXJjZVNCLmFwcGVuZFN0cmluZyhgICAke2xpbmVOdW1iZXJ9OiBgKTtcblx0XHRcdFx0XHRcdHNvdXJjZVNCLmFwcGVuZFN0cmluZyhsaW5lQ29udGVudCArICdcXG4nKTtcblxuXHRcdFx0XHRcdFx0aWYgKGluc3RydWN0aW9uLmVuZExpbmUgJiYgbGluZU51bWJlciA8IGluc3RydWN0aW9uLmVuZExpbmUpIHtcblx0XHRcdFx0XHRcdFx0bGluZU51bWJlcisrO1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGVtcGxhdGVEYXRhLnNvdXJjZWNvZGUuaW5uZXJUZXh0ID0gc291cmNlU0IuYnVpbGQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxldCBzcGFjZXNUb0FwcGVuZCA9IDEwO1xuXG5cdFx0aWYgKGluc3RydWN0aW9uLmFkZHJlc3MgIT09ICctMScpIHtcblx0XHRcdHNiLmFwcGVuZFN0cmluZyhpbnN0cnVjdGlvbi5hZGRyZXNzKTtcblx0XHRcdGlmIChpbnN0cnVjdGlvbi5hZGRyZXNzLmxlbmd0aCA8IEluc3RydWN0aW9uUmVuZGVyZXIuSU5TVFJVQ1RJT05fQUREUl9NSU5fTEVOR1RIKSB7XG5cdFx0XHRcdHNwYWNlc1RvQXBwZW5kID0gSW5zdHJ1Y3Rpb25SZW5kZXJlci5JTlNUUlVDVElPTl9BRERSX01JTl9MRU5HVEggLSBpbnN0cnVjdGlvbi5hZGRyZXNzLmxlbmd0aDtcblx0XHRcdH1cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc3BhY2VzVG9BcHBlbmQ7IGkrKykge1xuXHRcdFx0XHRzYi5hcHBlbmRTdHJpbmcoJyAnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaW5zdHJ1Y3Rpb24uaW5zdHJ1Y3Rpb25CeXRlcykge1xuXHRcdFx0c2IuYXBwZW5kU3RyaW5nKGluc3RydWN0aW9uLmluc3RydWN0aW9uQnl0ZXMpO1xuXHRcdFx0c3BhY2VzVG9BcHBlbmQgPSAxMDtcblx0XHRcdGlmIChpbnN0cnVjdGlvbi5pbnN0cnVjdGlvbkJ5dGVzLmxlbmd0aCA8IEluc3RydWN0aW9uUmVuZGVyZXIuSU5TVFJVQ1RJT05fQllURVNfTUlOX0xFTkdUSCkge1xuXHRcdFx0XHRzcGFjZXNUb0FwcGVuZCA9IEluc3RydWN0aW9uUmVuZGVyZXIuSU5TVFJVQ1RJT05fQllURVNfTUlOX0xFTkdUSCAtIGluc3RydWN0aW9uLmluc3RydWN0aW9uQnl0ZXMubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzcGFjZXNUb0FwcGVuZDsgaSsrKSB7XG5cdFx0XHRcdHNiLmFwcGVuZFN0cmluZygnICcpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHNiLmFwcGVuZFN0cmluZyhpbnN0cnVjdGlvbi5pbnN0cnVjdGlvbik7XG5cdFx0dGVtcGxhdGVEYXRhLmluc3RydWN0aW9uLmlubmVyVGV4dCA9IHNiLmJ1aWxkKCk7XG5cblx0XHR0aGlzLnJlcmVuZGVyQmFja2dyb3VuZCh0ZW1wbGF0ZURhdGEuaW5zdHJ1Y3Rpb24sIHRlbXBsYXRlRGF0YS5zb3VyY2Vjb2RlLCBlbGVtZW50KTtcblx0fVxuXG5cdGRpc3Bvc2VFbGVtZW50KGVsZW1lbnQ6IElEaXNhc3NlbWJsZWRJbnN0cnVjdGlvbkVudHJ5LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElJbnN0cnVjdGlvbkNvbHVtblRlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRkaXNwb3NlKHRlbXBsYXRlRGF0YS5jZWxsRGlzcG9zYWJsZSk7XG5cdFx0dGVtcGxhdGVEYXRhLmNlbGxEaXNwb3NhYmxlID0gW107XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJSW5zdHJ1Y3Rpb25Db2x1bW5UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRkaXNwb3NlKHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcyk7XG5cdFx0dGVtcGxhdGVEYXRhLmRpc3Bvc2FibGVzID0gW107XG5cdH1cblxuXHRwcml2YXRlIHJlcmVuZGVyQmFja2dyb3VuZChpbnN0cnVjdGlvbjogSFRNTEVsZW1lbnQsIHNvdXJjZUNvZGU6IEhUTUxFbGVtZW50LCBlbGVtZW50PzogSURpc2Fzc2VtYmxlZEluc3RydWN0aW9uRW50cnkpIHtcblx0XHRpZiAoZWxlbWVudCAmJiB0aGlzLl9kaXNhc3NlbWJseVZpZXcuY3VycmVudEluc3RydWN0aW9uQWRkcmVzc2VzLmluY2x1ZGVzKGVsZW1lbnQuYWRkcmVzcykpIHtcblx0XHRcdGluc3RydWN0aW9uLnN0eWxlLmJhY2tncm91bmQgPSB0aGlzLl90b3BTdGFja0ZyYW1lQ29sb3I/LnRvU3RyaW5nKCkgfHwgJ3RyYW5zcGFyZW50Jztcblx0XHR9IGVsc2UgaWYgKGVsZW1lbnQ/LmFkZHJlc3MgPT09IHRoaXMuX2Rpc2Fzc2VtYmx5Vmlldy5mb2N1c2VkSW5zdHJ1Y3Rpb25BZGRyZXNzKSB7XG5cdFx0XHRpbnN0cnVjdGlvbi5zdHlsZS5iYWNrZ3JvdW5kID0gdGhpcy5fZm9jdXNlZFN0YWNrRnJhbWVDb2xvcj8udG9TdHJpbmcoKSB8fCAndHJhbnNwYXJlbnQnO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpbnN0cnVjdGlvbi5zdHlsZS5iYWNrZ3JvdW5kID0gJ3RyYW5zcGFyZW50Jztcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9wZW5Tb3VyY2VDb2RlKGluc3RydWN0aW9uOiBEZWJ1Z1Byb3RvY29sLkRpc2Fzc2VtYmxlZEluc3RydWN0aW9uIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKGluc3RydWN0aW9uKSB7XG5cdFx0XHRjb25zdCBzb3VyY2VVUkkgPSB0aGlzLmdldFVyaUZyb21Tb3VyY2UoaW5zdHJ1Y3Rpb24pO1xuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gaW5zdHJ1Y3Rpb24uZW5kTGluZSA/IHtcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBpbnN0cnVjdGlvbi5saW5lISxcblx0XHRcdFx0ZW5kTGluZU51bWJlcjogaW5zdHJ1Y3Rpb24uZW5kTGluZSxcblx0XHRcdFx0c3RhcnRDb2x1bW46IGluc3RydWN0aW9uLmNvbHVtbiB8fCAxLFxuXHRcdFx0XHRlbmRDb2x1bW46IGluc3RydWN0aW9uLmVuZENvbHVtbiB8fCBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUixcblx0XHRcdH0gOiB7XG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogaW5zdHJ1Y3Rpb24ubGluZSEsXG5cdFx0XHRcdGVuZExpbmVOdW1iZXI6IGluc3RydWN0aW9uLmxpbmUhLFxuXHRcdFx0XHRzdGFydENvbHVtbjogaW5zdHJ1Y3Rpb24uY29sdW1uIHx8IDEsXG5cdFx0XHRcdGVuZENvbHVtbjogaW5zdHJ1Y3Rpb24uZW5kQ29sdW1uIHx8IENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSLFxuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRyZXNvdXJjZTogc291cmNlVVJJLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2VkaXRvck9wZW5lZEZyb21EaXNhc3NlbWJseURlc2NyaXB0aW9uJywgXCJmcm9tIGRpc2Fzc2VtYmx5XCIpLFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0cHJlc2VydmVGb2N1czogZmFsc2UsXG5cdFx0XHRcdFx0c2VsZWN0aW9uOiBzZWxlY3Rpb24sXG5cdFx0XHRcdFx0cmV2ZWFsSWZPcGVuZWQ6IHRydWUsXG5cdFx0XHRcdFx0c2VsZWN0aW9uUmV2ZWFsVHlwZTogVGV4dEVkaXRvclNlbGVjdGlvblJldmVhbFR5cGUuQ2VudGVySWZPdXRzaWRlVmlld3BvcnQsXG5cdFx0XHRcdFx0cGlubmVkOiBmYWxzZSxcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRVcmlGcm9tU291cmNlKGluc3RydWN0aW9uOiBEZWJ1Z1Byb3RvY29sLkRpc2Fzc2VtYmxlZEluc3RydWN0aW9uKTogVVJJIHtcblx0XHQvLyBUcnkgdG8gcmVzb2x2ZSBwYXRoIGJlZm9yZSBjb25zdWx0aW5nIHRoZSBkZWJ1Z1Nlc3Npb24uXG5cdFx0Y29uc3QgcGF0aCA9IGluc3RydWN0aW9uLmxvY2F0aW9uIS5wYXRoO1xuXHRcdGlmIChwYXRoICYmIGlzVXJpKHBhdGgpKSB7XHQvLyBwYXRoIGxvb2tzIGxpa2UgYSB1cmlcblx0XHRcdHJldHVybiB0aGlzLnVyaVNlcnZpY2UuYXNDYW5vbmljYWxVcmkoVVJJLnBhcnNlKHBhdGgpKTtcblx0XHR9XG5cdFx0Ly8gYXNzdW1lIGEgZmlsZXN5c3RlbSBwYXRoXG5cdFx0aWYgKHBhdGggJiYgaXNBYnNvbHV0ZShwYXRoKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMudXJpU2VydmljZS5hc0Nhbm9uaWNhbFVyaShVUkkuZmlsZShwYXRoKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGdldFVyaUZyb21Tb3VyY2UoaW5zdHJ1Y3Rpb24ubG9jYXRpb24hLCBpbnN0cnVjdGlvbi5sb2NhdGlvbiEucGF0aCwgdGhpcy5fZGlzYXNzZW1ibHlWaWV3LmRlYnVnU2Vzc2lvbiEuZ2V0SWQoKSwgdGhpcy51cmlTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBseUZvbnRJbmZvKGVsZW1lbnQ6IEhUTUxFbGVtZW50KSB7XG5cdFx0YXBwbHlGb250SW5mbyhlbGVtZW50LCB0aGlzLl9kaXNhc3NlbWJseVZpZXcuZm9udEluZm8pO1xuXHRcdGVsZW1lbnQuc3R5bGUud2hpdGVTcGFjZSA9ICdwcmUnO1xuXHR9XG59XG5cbmNsYXNzIEFjY2Vzc2liaWxpdHlQcm92aWRlciBpbXBsZW1lbnRzIElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPElEaXNhc3NlbWJsZWRJbnN0cnVjdGlvbkVudHJ5PiB7XG5cblx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdkaXNhc3NlbWJseVZpZXcnLCBcIkRpc2Fzc2VtYmx5IFZpZXdcIik7XG5cdH1cblxuXHRnZXRBcmlhTGFiZWwoZWxlbWVudDogSURpc2Fzc2VtYmxlZEluc3RydWN0aW9uRW50cnkpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRsZXQgbGFiZWwgPSAnJztcblxuXHRcdGNvbnN0IGluc3RydWN0aW9uID0gZWxlbWVudC5pbnN0cnVjdGlvbjtcblx0XHRpZiAoaW5zdHJ1Y3Rpb24uYWRkcmVzcyAhPT0gJy0xJykge1xuXHRcdFx0bGFiZWwgKz0gYCR7bG9jYWxpemUoJ2luc3RydWN0aW9uQWRkcmVzcycsIFwiQWRkcmVzc1wiKX06ICR7aW5zdHJ1Y3Rpb24uYWRkcmVzc31gO1xuXHRcdH1cblx0XHRpZiAoaW5zdHJ1Y3Rpb24uaW5zdHJ1Y3Rpb25CeXRlcykge1xuXHRcdFx0bGFiZWwgKz0gYCwgJHtsb2NhbGl6ZSgnaW5zdHJ1Y3Rpb25CeXRlcycsIFwiQnl0ZXNcIil9OiAke2luc3RydWN0aW9uLmluc3RydWN0aW9uQnl0ZXN9YDtcblx0XHR9XG5cdFx0bGFiZWwgKz0gYCwgJHtsb2NhbGl6ZShgaW5zdHJ1Y3Rpb25UZXh0YCwgXCJJbnN0cnVjdGlvblwiKX06ICR7aW5zdHJ1Y3Rpb24uaW5zdHJ1Y3Rpb259YDtcblxuXHRcdHJldHVybiBsYWJlbDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGlzYXNzZW1ibHlWaWV3Q29udHJpYnV0aW9uIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRBY3RpdmVFZGl0b3JDaGFuZ2VMaXN0ZW5lcjogSURpc3Bvc2FibGU7XG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlTW9kZWxMYW5ndWFnZTogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2xhbmd1YWdlU3VwcG9ydHNEaXNhc3NlbWJsZVJlcXVlc3Q6IElDb250ZXh0S2V5PGJvb2xlYW4+IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRWRpdG9yU2VydmljZSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASURlYnVnU2VydmljZSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlXG5cdCkge1xuXHRcdGNvbnRleHRLZXlTZXJ2aWNlLmJ1ZmZlckNoYW5nZUV2ZW50cygoKSA9PiB7XG5cdFx0XHR0aGlzLl9sYW5ndWFnZVN1cHBvcnRzRGlzYXNzZW1ibGVSZXF1ZXN0ID0gQ09OVEVYVF9MQU5HVUFHRV9TVVBQT1JUU19ESVNBU1NFTUJMRV9SRVFVRVNULmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBvbkRpZEFjdGl2ZUVkaXRvckNoYW5nZUxpc3RlbmVyID0gKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX29uRGlkQ2hhbmdlTW9kZWxMYW5ndWFnZSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2UuZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2UgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGFjdGl2ZVRleHRFZGl0b3JDb250cm9sID0gZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yQ29udHJvbDtcblx0XHRcdGlmIChpc0NvZGVFZGl0b3IoYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpKSB7XG5cdFx0XHRcdGNvbnN0IGxhbmd1YWdlID0gYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wuZ2V0TW9kZWwoKT8uZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdFx0XHQvLyBUT0RPOiBpbnN0ZWFkIG9mIHVzaW5nIGlkRGVidWdnZXJJbnRlcmVzdGVkSW5MYW5ndWFnZSwgaGF2ZSBhIHNwZWNpZmljIGV4dCBwb2ludCBmb3IgbGFuZ3VhZ2VzXG5cdFx0XHRcdC8vIHN1cHBvcnQgZGlzYXNzZW1ibHlcblx0XHRcdFx0dGhpcy5fbGFuZ3VhZ2VTdXBwb3J0c0Rpc2Fzc2VtYmxlUmVxdWVzdD8uc2V0KCEhbGFuZ3VhZ2UgJiYgZGVidWdTZXJ2aWNlLmdldEFkYXB0ZXJNYW5hZ2VyKCkuc29tZURlYnVnZ2VySW50ZXJlc3RlZEluTGFuZ3VhZ2UobGFuZ3VhZ2UpKTtcblxuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2UgPSBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2UoZSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fbGFuZ3VhZ2VTdXBwb3J0c0Rpc2Fzc2VtYmxlUmVxdWVzdD8uc2V0KGRlYnVnU2VydmljZS5nZXRBZGFwdGVyTWFuYWdlcigpLnNvbWVEZWJ1Z2dlckludGVyZXN0ZWRJbkxhbmd1YWdlKGUubmV3TGFuZ3VhZ2UpKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9sYW5ndWFnZVN1cHBvcnRzRGlzYXNzZW1ibGVSZXF1ZXN0Py5zZXQoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRvbkRpZEFjdGl2ZUVkaXRvckNoYW5nZUxpc3RlbmVyKCk7XG5cdFx0dGhpcy5fb25EaWRBY3RpdmVFZGl0b3JDaGFuZ2VMaXN0ZW5lciA9IGVkaXRvclNlcnZpY2Uub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2Uob25EaWRBY3RpdmVFZGl0b3JDaGFuZ2VMaXN0ZW5lcik7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlTW9kZWxMYW5ndWFnZT8uZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsR0FBYywrQkFBK0IsY0FBYztBQUdwRSxTQUFTLHFCQUFxQjtBQUU5QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUF5QixlQUFlO0FBQ2pELFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsV0FBVztBQUNwQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG9CQUFvQjtBQUM3QixTQUFpQixhQUFhO0FBQzlCLFNBQVMscUJBQXFCO0FBRTlCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQXNCLDBCQUEwQjtBQUNoRCxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGtCQUFrQjtBQUUzQixTQUFTLHdCQUF3QiwwQkFBMEI7QUFDM0QsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsK0NBQStDLHFCQUEwQyxlQUFzRCxhQUFhO0FBQ3JLLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsT0FBTyxvQkFBb0I7QUFDcEMsU0FBUyxzQkFBc0I7QUF1Qi9CLE1BQU0s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
