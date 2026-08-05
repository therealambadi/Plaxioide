import * as nls from "../../nls.js";
import { URI } from "../../base/common/uri.js";
import { ICodeEditorService } from "./services/codeEditorService.js";
import { Position } from "../common/core/position.js";
import { IModelService } from "../common/services/model.js";
import { ITextModelService } from "../common/services/resolverService.js";
import { MenuId, MenuRegistry, Action2 } from "../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService } from "../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../platform/keybinding/common/keybindingsRegistry.js";
import { Registry } from "../../platform/registry/common/platform.js";
import { ITelemetryService } from "../../platform/telemetry/common/telemetry.js";
import { assertType } from "../../base/common/types.js";
import { KeyMod, KeyCode } from "../../base/common/keyCodes.js";
import { ILogService } from "../../platform/log/common/log.js";
import { getActiveElement } from "../../base/browser/dom.js";
var EditorContributionInstantiation = /* @__PURE__ */ ((EditorContributionInstantiation2) => {
  EditorContributionInstantiation2[EditorContributionInstantiation2["Eager"] = 0] = "Eager";
  EditorContributionInstantiation2[EditorContributionInstantiation2["AfterFirstRender"] = 1] = "AfterFirstRender";
  EditorContributionInstantiation2[EditorContributionInstantiation2["BeforeFirstInteraction"] = 2] = "BeforeFirstInteraction";
  EditorContributionInstantiation2[EditorContributionInstantiation2["Eventually"] = 3] = "Eventually";
  EditorContributionInstantiation2[EditorContributionInstantiation2["Lazy"] = 4] = "Lazy";
  return EditorContributionInstantiation2;
})(EditorContributionInstantiation || {});
class Command {
  constructor(opts) {
    this.id = opts.id;
    this.precondition = opts.precondition;
    this._kbOpts = opts.kbOpts;
    this._menuOpts = opts.menuOpts;
    this.metadata = opts.metadata;
  }
  register() {
    if (Array.isArray(this._menuOpts)) {
      this._menuOpts.forEach(this._registerMenuItem, this);
    } else if (this._menuOpts) {
      this._registerMenuItem(this._menuOpts);
    }
    if (this._kbOpts) {
      const kbOptsArr = Array.isArray(this._kbOpts) ? this._kbOpts : [this._kbOpts];
      for (const kbOpts of kbOptsArr) {
        let kbWhen = kbOpts.kbExpr;
        if (this.precondition) {
          if (kbWhen) {
            kbWhen = ContextKeyExpr.and(kbWhen, this.precondition);
          } else {
            kbWhen = this.precondition;
          }
        }
        const desc = {
          id: this.id,
          weight: kbOpts.weight,
          args: kbOpts.args,
          when: kbWhen,
          primary: kbOpts.primary,
          secondary: kbOpts.secondary,
          win: kbOpts.win,
          linux: kbOpts.linux,
          mac: kbOpts.mac
        };
        KeybindingsRegistry.registerKeybindingRule(desc);
      }
    }
    CommandsRegistry.registerCommand({
      id: this.id,
      handler: (accessor, args) => this.runCommand(accessor, args),
      metadata: this.metadata
    });
  }
  _registerMenuItem(item) {
    MenuRegistry.appendMenuItem(item.menuId, {
      group: item.group,
      command: {
        id: this.id,
        title: item.title,
        icon: item.icon,
        precondition: this.precondition
      },
      when: item.when,
      order: item.order
    });
  }
}
class MultiCommand extends Command {
  constructor() {
    super(...arguments);
    this._implementations = [];
  }
  /**
   * A higher priority gets to be looked at first
   */
  addImplementation(priority, name, implementation, when) {
    this._implementations.push({ priority, name, implementation, when });
    this._implementations.sort((a, b) => b.priority - a.priority);
    return {
      dispose: () => {
        for (let i = 0; i < this._implementations.length; i++) {
          if (this._implementations[i].implementation === implementation) {
            this._implementations.splice(i, 1);
            return;
          }
        }
      }
    };
  }
  runCommand(accessor, args) {
    const logService = accessor.get(ILogService);
    const contextKeyService = accessor.get(IContextKeyService);
    logService.trace(`Executing Command '${this.id}' which has ${this._implementations.length} bound.`);
    for (const impl of this._implementations) {
      if (impl.when) {
        const context = contextKeyService.getContext(getActiveElement());
        const value = impl.when.evaluate(context);
        if (!value) {
          continue;
        }
      }
      const result = impl.implementation(accessor, args);
      if (result) {
        logService.trace(`Command '${this.id}' was handled by '${impl.name}'.`);
        if (typeof result === "boolean") {
          return;
        }
        return result;
      }
    }
    logService.trace(`The Command '${this.id}' was not handled by any implementation.`);
  }
}
class ProxyCommand extends Command {
  constructor(command, opts) {
    super(opts);
    this.command = command;
  }
  runCommand(accessor, args) {
    return this.command.runCommand(accessor, args);
  }
}
class EditorCommand extends Command {
  /**
   * Create a command class that is bound to a certain editor contribution.
   */
  static bindToContribution(controllerGetter) {
    return class EditorControllerCommandImpl extends EditorCommand {
      constructor(opts) {
        super(opts);
        this._callback = opts.handler;
      }
      runEditorCommand(accessor, editor, args) {
        const controller = controllerGetter(editor);
        if (controller) {
          this._callback(controller, args);
        }
      }
    };
  }
  static runEditorCommand(accessor, args, precondition, runner) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const editor = codeEditorService.getFocusedCodeEditor() || codeEditorService.getActiveCodeEditor();
    if (!editor) {
      return;
    }
    return editor.invokeWithinContext((editorAccessor) => {
      const kbService = editorAccessor.get(IContextKeyService);
      if (!kbService.contextMatchesRules(precondition ?? void 0)) {
        return;
      }
      return runner(editorAccessor, editor, args);
    });
  }
  runCommand(accessor, args) {
    return EditorCommand.runEditorCommand(accessor, args, this.precondition, (accessor2, editor, args2) => this.runEditorCommand(accessor2, editor, args2));
  }
}
class EditorAction extends EditorCommand {
  static convertOptions(opts) {
    let menuOpts;
    if (Array.isArray(opts.menuOpts)) {
      menuOpts = opts.menuOpts;
    } else if (opts.menuOpts) {
      menuOpts = [opts.menuOpts];
    } else {
      menuOpts = [];
    }
    function withDefaults(item) {
      if (!item.menuId) {
        item.menuId = MenuId.EditorContext;
      }
      if (!item.title) {
        item.title = typeof opts.label === "string" ? opts.label : opts.label.value;
      }
      item.when = ContextKeyExpr.and(opts.precondition, item.when);
      return item;
    }
    if (Array.isArray(opts.contextMenuOpts)) {
      menuOpts.push(...opts.contextMenuOpts.map(withDefaults));
    } else if (opts.contextMenuOpts) {
      menuOpts.push(withDefaults(opts.contextMenuOpts));
    }
    opts.menuOpts = menuOpts;
    return opts;
  }
  constructor(opts) {
    super(EditorAction.convertOptions(opts));
    if (typeof opts.label === "string") {
      this.label = opts.label;
      this.alias = opts.alias ?? opts.label;
    } else {
      this.label = opts.label.value;
      this.alias = opts.alias ?? opts.label.original;
    }
  }
  runEditorCommand(accessor, editor, args) {
    this.reportTelemetry(accessor, editor);
    return this.run(accessor, editor, args || {});
  }
  reportTelemetry(accessor, editor) {
    accessor.get(ITelemetryService).publicLog2("editorActionInvoked", { name: this.label, id: this.id });
  }
}
class MultiEditorAction extends EditorAction {
  constructor() {
    super(...arguments);
    this._implementations = [];
  }
  /**
   * A higher priority gets to be looked at first
   */
  addImplementation(priority, implementation) {
    this._implementations.push([priority, implementation]);
    this._implementations.sort((a, b) => b[0] - a[0]);
    return {
      dispose: () => {
        for (let i = 0; i < this._implementations.length; i++) {
          if (this._implementations[i][1] === implementation) {
            this._implementations.splice(i, 1);
            return;
          }
        }
      }
    };
  }
  run(accessor, editor, args) {
    for (const impl of this._implementations) {
      const result = impl[1](accessor, editor, args);
      if (result) {
        if (typeof result === "boolean") {
          return;
        }
        return result;
      }
    }
  }
}
class EditorAction2 extends Action2 {
  run(accessor, ...args) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const editor = codeEditorService.getFocusedCodeEditor() || codeEditorService.getActiveCodeEditor();
    if (!editor) {
      return;
    }
    return editor.invokeWithinContext((editorAccessor) => {
      const kbService = editorAccessor.get(IContextKeyService);
      const logService = editorAccessor.get(ILogService);
      const enabled = kbService.contextMatchesRules(this.desc.precondition ?? void 0);
      if (!enabled) {
        logService.debug(`[EditorAction2] NOT running command because its precondition is FALSE`, this.desc.id, this.desc.precondition?.serialize());
        return;
      }
      return this.runEditorCommand(editorAccessor, editor, ...args);
    });
  }
}
function registerModelAndPositionCommand(id, handler) {
  CommandsRegistry.registerCommand(id, function(accessor, ...args) {
    const instaService = accessor.get(IInstantiationService);
    const [resource, position] = args;
    assertType(URI.isUri(resource));
    assertType(Position.isIPosition(position));
    const model = accessor.get(IModelService).getModel(resource);
    if (model) {
      const editorPosition = Position.lift(position);
      return instaService.invokeFunction(handler, model, editorPosition, ...args.slice(2));
    }
    return accessor.get(ITextModelService).createModelReference(resource).then((reference) => {
      return new Promise((resolve, reject) => {
        try {
          const result = instaService.invokeFunction(handler, reference.object.textEditorModel, Position.lift(position), args.slice(2));
          resolve(result);
        } catch (err) {
          reject(err);
        }
      }).finally(() => {
        reference.dispose();
      });
    });
  });
}
function registerEditorCommand(editorCommand) {
  EditorContributionRegistry.INSTANCE.registerEditorCommand(editorCommand);
  return editorCommand;
}
function registerEditorAction(ctor) {
  const action = new ctor();
  EditorContributionRegistry.INSTANCE.registerEditorAction(action);
  return action;
}
function registerMultiEditorAction(action) {
  EditorContributionRegistry.INSTANCE.registerEditorAction(action);
  return action;
}
function registerInstantiatedEditorAction(editorAction) {
  EditorContributionRegistry.INSTANCE.registerEditorAction(editorAction);
}
function registerEditorContribution(id, ctor, instantiation) {
  EditorContributionRegistry.INSTANCE.registerEditorContribution(id, ctor, instantiation);
}
function registerDiffEditorContribution(id, ctor) {
  EditorContributionRegistry.INSTANCE.registerDiffEditorContribution(id, ctor);
}
var EditorExtensionsRegistry;
((EditorExtensionsRegistry2) => {
  function getEditorCommand(commandId) {
    return EditorContributionRegistry.INSTANCE.getEditorCommand(commandId);
  }
  EditorExtensionsRegistry2.getEditorCommand = getEditorCommand;
  function getEditorActions() {
    return EditorContributionRegistry.INSTANCE.getEditorActions();
  }
  EditorExtensionsRegistry2.getEditorActions = getEditorActions;
  function getEditorContributions() {
    return EditorContributionRegistry.INSTANCE.getEditorContributions();
  }
  EditorExtensionsRegistry2.getEditorContributions = getEditorContributions;
  function getSomeEditorContributions(ids) {
    return EditorContributionRegistry.INSTANCE.getEditorContributions().filter((c) => ids.indexOf(c.id) >= 0);
  }
  EditorExtensionsRegistry2.getSomeEditorContributions = getSomeEditorContributions;
  function getDiffEditorContributions() {
    return EditorContributionRegistry.INSTANCE.getDiffEditorContributions();
  }
  EditorExtensionsRegistry2.getDiffEditorContributions = getDiffEditorContributions;
})(EditorExtensionsRegistry || (EditorExtensionsRegistry = {}));
const Extensions = {
  EditorCommonContributions: "editor.contributions"
};
const _EditorContributionRegistry = class _EditorContributionRegistry {
  constructor() {
    this.editorContributions = [];
    this.diffEditorContributions = [];
    this.editorActions = [];
    this.editorCommands = /* @__PURE__ */ Object.create(null);
  }
  registerEditorContribution(id, ctor, instantiation) {
    this.editorContributions.push({ id, ctor, instantiation });
  }
  getEditorContributions() {
    return this.editorContributions.slice(0);
  }
  registerDiffEditorContribution(id, ctor) {
    this.diffEditorContributions.push({ id, ctor });
  }
  getDiffEditorContributions() {
    return this.diffEditorContributions.slice(0);
  }
  registerEditorAction(action) {
    action.register();
    this.editorActions.push(action);
  }
  getEditorActions() {
    return this.editorActions;
  }
  registerEditorCommand(editorCommand) {
    editorCommand.register();
    this.editorCommands[editorCommand.id] = editorCommand;
  }
  getEditorCommand(commandId) {
    return this.editorCommands[commandId] || null;
  }
};
_EditorContributionRegistry.INSTANCE = new _EditorContributionRegistry();
let EditorContributionRegistry = _EditorContributionRegistry;
Registry.add(Extensions.EditorCommonContributions, EditorContributionRegistry.INSTANCE);
function registerCommand(command) {
  command.register();
  return command;
}
const UndoCommand = registerCommand(new MultiCommand({
  id: "undo",
  precondition: void 0,
  kbOpts: {
    weight: KeybindingWeight.EditorCore,
    primary: KeyMod.CtrlCmd | KeyCode.KeyZ
  },
  menuOpts: [{
    menuId: MenuId.MenubarEditMenu,
    group: "1_do",
    title: nls.localize({ key: "miUndo", comment: ["&& denotes a mnemonic"] }, "&&Undo"),
    order: 1
  }, {
    menuId: MenuId.CommandPalette,
    group: "",
    title: nls.localize("undo", "Undo"),
    order: 1
  }, {
    menuId: MenuId.SimpleEditorContext,
    group: "1_do",
    title: nls.localize("undo", "Undo"),
    order: 1
  }]
}));
registerCommand(new ProxyCommand(UndoCommand, { id: "default:undo", precondition: void 0 }));
const RedoCommand = registerCommand(new MultiCommand({
  id: "redo",
  precondition: void 0,
  kbOpts: {
    weight: KeybindingWeight.EditorCore,
    primary: KeyMod.CtrlCmd | KeyCode.KeyY,
    secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ],
    mac: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ }
  },
  menuOpts: [{
    menuId: MenuId.MenubarEditMenu,
    group: "1_do",
    title: nls.localize({ key: "miRedo", comment: ["&& denotes a mnemonic"] }, "&&Redo"),
    order: 2
  }, {
    menuId: MenuId.CommandPalette,
    group: "",
    title: nls.localize("redo", "Redo"),
    order: 1
  }, {
    menuId: MenuId.SimpleEditorContext,
    group: "1_do",
    title: nls.localize("redo", "Redo"),
    order: 2
  }]
}));
registerCommand(new ProxyCommand(RedoCommand, { id: "default:redo", precondition: void 0 }));
const SelectAllCommand = registerCommand(new MultiCommand({
  id: "editor.action.selectAll",
  precondition: void 0,
  kbOpts: {
    weight: KeybindingWeight.EditorCore,
    kbExpr: null,
    primary: KeyMod.CtrlCmd | KeyCode.KeyA
  },
  menuOpts: [{
    menuId: MenuId.MenubarSelectionMenu,
    group: "1_basic",
    title: nls.localize({ key: "miSelectAll", comment: ["&& denotes a mnemonic"] }, "&&Select All"),
    order: 1
  }, {
    menuId: MenuId.CommandPalette,
    group: "",
    title: nls.localize("selectAll", "Select All"),
    order: 1
  }, {
    menuId: MenuId.SimpleEditorContext,
    group: "9_select",
    title: nls.localize("selectAll", "Select All"),
    order: 1
  }]
}));
export {
  Command,
  EditorAction,
  EditorAction2,
  EditorCommand,
  EditorContributionInstantiation,
  EditorExtensionsRegistry,
  MultiCommand,
  MultiEditorAction,
  ProxyCommand,
  RedoCommand,
  SelectAllCommand,
  UndoCommand,
  registerDiffEditorContribution,
  registerEditorAction,
  registerEditorCommand,
  registerEditorContribution,
  registerInstantiatedEditorAction,
  registerModelAndPositionCommand,
  registerMultiEditorAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIElEaWZmRWRpdG9yIH0gZnJvbSAnLi9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4vc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uLCBJRGlmZkVkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBNZW51SWQsIE1lbnVSZWdpc3RyeSwgQWN0aW9uMiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSwgSUNvbW1hbmRNZXRhZGF0YSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlLCBDb250ZXh0S2V5RXhwcmVzc2lvbiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciBhcyBJbnN0YW50aWF0aW9uU2VydmljZXNBY2Nlc3NvciwgQnJhbmRlZFNlcnZpY2UsIElJbnN0YW50aWF0aW9uU2VydmljZSwgSUNvbnN0cnVjdG9yU2lnbmF0dXJlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ3MsIEtleWJpbmRpbmdzUmVnaXN0cnksIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgYXNzZXJ0VHlwZSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBLZXlNb2QsIEtleUNvZGUgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IGdldEFjdGl2ZUVsZW1lbnQgfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcblxuZXhwb3J0IHR5cGUgU2VydmljZXNBY2Nlc3NvciA9IEluc3RhbnRpYXRpb25TZXJ2aWNlc0FjY2Vzc29yO1xuZXhwb3J0IHR5cGUgRWRpdG9yQ29udHJpYnV0aW9uQ3RvciA9IElDb25zdHJ1Y3RvclNpZ25hdHVyZTxJRWRpdG9yQ29udHJpYnV0aW9uLCBbSUNvZGVFZGl0b3JdPjtcbmV4cG9ydCB0eXBlIERpZmZFZGl0b3JDb250cmlidXRpb25DdG9yID0gSUNvbnN0cnVjdG9yU2lnbmF0dXJlPElEaWZmRWRpdG9yQ29udHJpYnV0aW9uLCBbSURpZmZFZGl0b3JdPjtcblxuZXhwb3J0IGNvbnN0IGVudW0gRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbiB7XG5cdC8qKlxuXHQgKiBUaGUgY29udHJpYnV0aW9uIGlzIGNyZWF0ZWQgZWFnZXJseSB3aGVuIHRoZSB7QGxpbmtjb2RlIElDb2RlRWRpdG9yfSBpcyBpbnN0YW50aWF0ZWQuXG5cdCAqIE9ubHkgRWFnZXIgY29udHJpYnV0aW9ucyBjYW4gcGFydGljaXBhdGUgaW4gc2F2aW5nIG9yIHJlc3RvcmluZyBvZiB2aWV3IHN0YXRlLlxuXHQgKi9cblx0RWFnZXIsXG5cblx0LyoqXG5cdCAqIFRoZSBjb250cmlidXRpb24gaXMgY3JlYXRlZCBhdCB0aGUgbGF0ZXN0IDUwbXMgYWZ0ZXIgdGhlIGZpcnN0IHJlbmRlciBhZnRlciBhdHRhY2hpbmcgYSB0ZXh0IG1vZGVsLlxuXHQgKiBJZiB0aGUgY29udHJpYnV0aW9uIGlzIGV4cGxpY2l0bHkgcmVxdWVzdGVkIHZpYSBgZ2V0Q29udHJpYnV0aW9uYCwgaXQgd2lsbCBiZSBpbnN0YW50aWF0ZWQgc29vbmVyLlxuXHQgKiBJZiB0aGVyZSBpcyBpZGxlIHRpbWUgYXZhaWxhYmxlLCBpdCB3aWxsIGJlIGluc3RhbnRpYXRlZCBzb29uZXIuXG5cdCAqL1xuXHRBZnRlckZpcnN0UmVuZGVyLFxuXG5cdC8qKlxuXHQgKiBUaGUgY29udHJpYnV0aW9uIGlzIGNyZWF0ZWQgYmVmb3JlIHRoZSBlZGl0b3IgZW1pdHMgZXZlbnRzIHByb2R1Y2VkIGJ5IHVzZXIgaW50ZXJhY3Rpb24gKG1vdXNlIGV2ZW50cywga2V5Ym9hcmQgZXZlbnRzKS5cblx0ICogSWYgdGhlIGNvbnRyaWJ1dGlvbiBpcyBleHBsaWNpdGx5IHJlcXVlc3RlZCB2aWEgYGdldENvbnRyaWJ1dGlvbmAsIGl0IHdpbGwgYmUgaW5zdGFudGlhdGVkIHNvb25lci5cblx0ICogSWYgdGhlcmUgaXMgaWRsZSB0aW1lIGF2YWlsYWJsZSwgaXQgd2lsbCBiZSBpbnN0YW50aWF0ZWQgc29vbmVyLlxuXHQgKi9cblx0QmVmb3JlRmlyc3RJbnRlcmFjdGlvbixcblxuXHQvKipcblx0ICogVGhlIGNvbnRyaWJ1dGlvbiBpcyBjcmVhdGVkIHdoZW4gdGhlcmUgaXMgaWRsZSB0aW1lIGF2YWlsYWJsZSwgYXQgdGhlIGxhdGVzdCA1MDAwbXMgYWZ0ZXIgdGhlIGVkaXRvciBjcmVhdGlvbi5cblx0ICogSWYgdGhlIGNvbnRyaWJ1dGlvbiBpcyBleHBsaWNpdGx5IHJlcXVlc3RlZCB2aWEgYGdldENvbnRyaWJ1dGlvbmAsIGl0IHdpbGwgYmUgaW5zdGFudGlhdGVkIHNvb25lci5cblx0ICovXG5cdEV2ZW50dWFsbHksXG5cblx0LyoqXG5cdCAqIFRoZSBjb250cmlidXRpb24gaXMgY3JlYXRlZCBvbmx5IHdoZW4gZXhwbGljaXRseSByZXF1ZXN0ZWQgdmlhIGBnZXRDb250cmlidXRpb25gLlxuXHQgKi9cblx0TGF6eSxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRWRpdG9yQ29udHJpYnV0aW9uRGVzY3JpcHRpb24ge1xuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXHRyZWFkb25seSBjdG9yOiBFZGl0b3JDb250cmlidXRpb25DdG9yO1xuXHRyZWFkb25seSBpbnN0YW50aWF0aW9uOiBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEaWZmRWRpdG9yQ29udHJpYnV0aW9uRGVzY3JpcHRpb24ge1xuXHRpZDogc3RyaW5nO1xuXHRjdG9yOiBEaWZmRWRpdG9yQ29udHJpYnV0aW9uQ3Rvcjtcbn1cblxuLy8jcmVnaW9uIENvbW1hbmRcblxuZXhwb3J0IGludGVyZmFjZSBJQ29tbWFuZEtleWJpbmRpbmdzT3B0aW9ucyBleHRlbmRzIElLZXliaW5kaW5ncyB7XG5cdGtiRXhwcj86IENvbnRleHRLZXlFeHByZXNzaW9uIHwgbnVsbDtcblx0d2VpZ2h0OiBudW1iZXI7XG5cdC8qKlxuXHQgKiB0aGUgZGVmYXVsdCBrZXliaW5kaW5nIGFyZ3VtZW50c1xuXHQgKi9cblx0YXJncz86IGFueTtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbW1hbmRNZW51T3B0aW9ucyB7XG5cdG1lbnVJZDogTWVudUlkO1xuXHRncm91cDogc3RyaW5nO1xuXHRvcmRlcjogbnVtYmVyO1xuXHR3aGVuPzogQ29udGV4dEtleUV4cHJlc3Npb247XG5cdHRpdGxlOiBzdHJpbmc7XG5cdGljb24/OiBUaGVtZUljb247XG59XG5leHBvcnQgaW50ZXJmYWNlIElDb21tYW5kT3B0aW9ucyB7XG5cdGlkOiBzdHJpbmc7XG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHJlc3Npb24gfCB1bmRlZmluZWQ7XG5cdGtiT3B0cz86IElDb21tYW5kS2V5YmluZGluZ3NPcHRpb25zIHwgSUNvbW1hbmRLZXliaW5kaW5nc09wdGlvbnNbXTtcblx0bWV0YWRhdGE/OiBJQ29tbWFuZE1ldGFkYXRhO1xuXHRtZW51T3B0cz86IElDb21tYW5kTWVudU9wdGlvbnMgfCBJQ29tbWFuZE1lbnVPcHRpb25zW107XG59XG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQ29tbWFuZCB7XG5cdHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nO1xuXHRwdWJsaWMgcmVhZG9ubHkgcHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfa2JPcHRzOiBJQ29tbWFuZEtleWJpbmRpbmdzT3B0aW9ucyB8IElDb21tYW5kS2V5YmluZGluZ3NPcHRpb25zW10gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX21lbnVPcHRzOiBJQ29tbWFuZE1lbnVPcHRpb25zIHwgSUNvbW1hbmRNZW51T3B0aW9uc1tdIHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgcmVhZG9ubHkgbWV0YWRhdGE6IElDb21tYW5kTWV0YWRhdGEgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3Iob3B0czogSUNvbW1hbmRPcHRpb25zKSB7XG5cdFx0dGhpcy5pZCA9IG9wdHMuaWQ7XG5cdFx0dGhpcy5wcmVjb25kaXRpb24gPSBvcHRzLnByZWNvbmRpdGlvbjtcblx0XHR0aGlzLl9rYk9wdHMgPSBvcHRzLmtiT3B0cztcblx0XHR0aGlzLl9tZW51T3B0cyA9IG9wdHMubWVudU9wdHM7XG5cdFx0dGhpcy5tZXRhZGF0YSA9IG9wdHMubWV0YWRhdGE7XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXIoKTogdm9pZCB7XG5cblx0XHRpZiAoQXJyYXkuaXNBcnJheSh0aGlzLl9tZW51T3B0cykpIHtcblx0XHRcdHRoaXMuX21lbnVPcHRzLmZvckVhY2godGhpcy5fcmVnaXN0ZXJNZW51SXRlbSwgdGhpcyk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9tZW51T3B0cykge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXJNZW51SXRlbSh0aGlzLl9tZW51T3B0cyk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2tiT3B0cykge1xuXHRcdFx0Y29uc3Qga2JPcHRzQXJyID0gQXJyYXkuaXNBcnJheSh0aGlzLl9rYk9wdHMpID8gdGhpcy5fa2JPcHRzIDogW3RoaXMuX2tiT3B0c107XG5cdFx0XHRmb3IgKGNvbnN0IGtiT3B0cyBvZiBrYk9wdHNBcnIpIHtcblx0XHRcdFx0bGV0IGtiV2hlbiA9IGtiT3B0cy5rYkV4cHI7XG5cdFx0XHRcdGlmICh0aGlzLnByZWNvbmRpdGlvbikge1xuXHRcdFx0XHRcdGlmIChrYldoZW4pIHtcblx0XHRcdFx0XHRcdGtiV2hlbiA9IENvbnRleHRLZXlFeHByLmFuZChrYldoZW4sIHRoaXMucHJlY29uZGl0aW9uKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0a2JXaGVuID0gdGhpcy5wcmVjb25kaXRpb247XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgZGVzYyA9IHtcblx0XHRcdFx0XHRpZDogdGhpcy5pZCxcblx0XHRcdFx0XHR3ZWlnaHQ6IGtiT3B0cy53ZWlnaHQsXG5cdFx0XHRcdFx0YXJnczoga2JPcHRzLmFyZ3MsXG5cdFx0XHRcdFx0d2hlbjoga2JXaGVuLFxuXHRcdFx0XHRcdHByaW1hcnk6IGtiT3B0cy5wcmltYXJ5LFxuXHRcdFx0XHRcdHNlY29uZGFyeToga2JPcHRzLnNlY29uZGFyeSxcblx0XHRcdFx0XHR3aW46IGtiT3B0cy53aW4sXG5cdFx0XHRcdFx0bGludXg6IGtiT3B0cy5saW51eCxcblx0XHRcdFx0XHRtYWM6IGtiT3B0cy5tYWMsXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlcktleWJpbmRpbmdSdWxlKGRlc2MpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0XHRcdGlkOiB0aGlzLmlkLFxuXHRcdFx0aGFuZGxlcjogKGFjY2Vzc29yLCBhcmdzKSA9PiB0aGlzLnJ1bkNvbW1hbmQoYWNjZXNzb3IsIGFyZ3MpLFxuXHRcdFx0bWV0YWRhdGE6IHRoaXMubWV0YWRhdGFcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZ2lzdGVyTWVudUl0ZW0oaXRlbTogSUNvbW1hbmRNZW51T3B0aW9ucyk6IHZvaWQge1xuXHRcdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShpdGVtLm1lbnVJZCwge1xuXHRcdFx0Z3JvdXA6IGl0ZW0uZ3JvdXAsXG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkOiB0aGlzLmlkLFxuXHRcdFx0XHR0aXRsZTogaXRlbS50aXRsZSxcblx0XHRcdFx0aWNvbjogaXRlbS5pY29uLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IHRoaXMucHJlY29uZGl0aW9uXG5cdFx0XHR9LFxuXHRcdFx0d2hlbjogaXRlbS53aGVuLFxuXHRcdFx0b3JkZXI6IGl0ZW0ub3JkZXJcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhYnN0cmFjdCBydW5Db21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzOiBhbnkpOiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbn1cblxuLy8jZW5kcmVnaW9uIENvbW1hbmRcblxuLy8jcmVnaW9uIE11bHRpcGxleGluZ0NvbW1hbmRcblxuLyoqXG4gKiBQb3RlbnRpYWwgb3ZlcnJpZGUgZm9yIGEgY29tbWFuZC5cbiAqXG4gKiBAcmV0dXJuIGB0cnVlYCBvciBhIFByb21pc2UgaWYgdGhlIGNvbW1hbmQgd2FzIHN1Y2Nlc3NmdWxseSBydW4uIFRoaXMgc3RvcHMgb3RoZXIgb3ZlcnJpZGVzIGZyb20gYmVpbmcgZXhlY3V0ZWQuXG4gKi9cbmV4cG9ydCB0eXBlIENvbW1hbmRJbXBsZW1lbnRhdGlvbiA9IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnczogdW5rbm93bikgPT4gYm9vbGVhbiB8IFByb21pc2U8dm9pZD47XG5cbmludGVyZmFjZSBJQ29tbWFuZEltcGxlbWVudGF0aW9uUmVnaXN0cmF0aW9uIHtcblx0cHJpb3JpdHk6IG51bWJlcjtcblx0bmFtZTogc3RyaW5nO1xuXHRpbXBsZW1lbnRhdGlvbjogQ29tbWFuZEltcGxlbWVudGF0aW9uO1xuXHR3aGVuPzogQ29udGV4dEtleUV4cHJlc3Npb247XG59XG5cbmV4cG9ydCBjbGFzcyBNdWx0aUNvbW1hbmQgZXh0ZW5kcyBDb21tYW5kIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pbXBsZW1lbnRhdGlvbnM6IElDb21tYW5kSW1wbGVtZW50YXRpb25SZWdpc3RyYXRpb25bXSA9IFtdO1xuXG5cdC8qKlxuXHQgKiBBIGhpZ2hlciBwcmlvcml0eSBnZXRzIHRvIGJlIGxvb2tlZCBhdCBmaXJzdFxuXHQgKi9cblx0cHVibGljIGFkZEltcGxlbWVudGF0aW9uKHByaW9yaXR5OiBudW1iZXIsIG5hbWU6IHN0cmluZywgaW1wbGVtZW50YXRpb246IENvbW1hbmRJbXBsZW1lbnRhdGlvbiwgd2hlbj86IENvbnRleHRLZXlFeHByZXNzaW9uKTogSURpc3Bvc2FibGUge1xuXHRcdHRoaXMuX2ltcGxlbWVudGF0aW9ucy5wdXNoKHsgcHJpb3JpdHksIG5hbWUsIGltcGxlbWVudGF0aW9uLCB3aGVuIH0pO1xuXHRcdHRoaXMuX2ltcGxlbWVudGF0aW9ucy5zb3J0KChhLCBiKSA9PiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9pbXBsZW1lbnRhdGlvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRpZiAodGhpcy5faW1wbGVtZW50YXRpb25zW2ldLmltcGxlbWVudGF0aW9uID09PSBpbXBsZW1lbnRhdGlvbikge1xuXHRcdFx0XHRcdFx0dGhpcy5faW1wbGVtZW50YXRpb25zLnNwbGljZShpLCAxKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHVibGljIHJ1bkNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M6IGFueSk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKTtcblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGxvZ1NlcnZpY2UudHJhY2UoYEV4ZWN1dGluZyBDb21tYW5kICcke3RoaXMuaWR9JyB3aGljaCBoYXMgJHt0aGlzLl9pbXBsZW1lbnRhdGlvbnMubGVuZ3RofSBib3VuZC5gKTtcblx0XHRmb3IgKGNvbnN0IGltcGwgb2YgdGhpcy5faW1wbGVtZW50YXRpb25zKSB7XG5cdFx0XHRpZiAoaW1wbC53aGVuKSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRleHQgPSBjb250ZXh0S2V5U2VydmljZS5nZXRDb250ZXh0KGdldEFjdGl2ZUVsZW1lbnQoKSk7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gaW1wbC53aGVuLmV2YWx1YXRlKGNvbnRleHQpO1xuXHRcdFx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlc3VsdCA9IGltcGwuaW1wbGVtZW50YXRpb24oYWNjZXNzb3IsIGFyZ3MpO1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRsb2dTZXJ2aWNlLnRyYWNlKGBDb21tYW5kICcke3RoaXMuaWR9JyB3YXMgaGFuZGxlZCBieSAnJHtpbXBsLm5hbWV9Jy5gKTtcblx0XHRcdFx0aWYgKHR5cGVvZiByZXN1bHQgPT09ICdib29sZWFuJykge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRsb2dTZXJ2aWNlLnRyYWNlKGBUaGUgQ29tbWFuZCAnJHt0aGlzLmlkfScgd2FzIG5vdCBoYW5kbGVkIGJ5IGFueSBpbXBsZW1lbnRhdGlvbi5gKTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLyoqXG4gKiBBIGNvbW1hbmQgdGhhdCBkZWxlZ2F0ZXMgdG8gYW5vdGhlciBjb21tYW5kJ3MgaW1wbGVtZW50YXRpb24uXG4gKlxuICogVGhpcyBsZXRzIGRpZmZlcmVudCBjb21tYW5kcyBiZSByZWdpc3RlcmVkIGJ1dCBzaGFyZSB0aGUgc2FtZSBpbXBsZW1lbnRhdGlvblxuICovXG5leHBvcnQgY2xhc3MgUHJveHlDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZDogQ29tbWFuZCxcblx0XHRvcHRzOiBJQ29tbWFuZE9wdGlvbnNcblx0KSB7XG5cdFx0c3VwZXIob3B0cyk7XG5cdH1cblxuXHRwdWJsaWMgcnVuQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnczogYW55KTogdm9pZCB8IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmNvbW1hbmQucnVuQ29tbWFuZChhY2Nlc3NvciwgYXJncyk7XG5cdH1cbn1cblxuLy8jcmVnaW9uIEVkaXRvckNvbW1hbmRcblxuZXhwb3J0IGludGVyZmFjZSBJQ29udHJpYnV0aW9uQ29tbWFuZE9wdGlvbnM8VD4gZXh0ZW5kcyBJQ29tbWFuZE9wdGlvbnMge1xuXHRoYW5kbGVyOiAoY29udHJvbGxlcjogVCwgYXJnczogYW55KSA9PiB2b2lkO1xufVxuZXhwb3J0IGludGVyZmFjZSBFZGl0b3JDb250cm9sbGVyQ29tbWFuZDxUIGV4dGVuZHMgSUVkaXRvckNvbnRyaWJ1dGlvbj4ge1xuXHRuZXcob3B0czogSUNvbnRyaWJ1dGlvbkNvbW1hbmRPcHRpb25zPFQ+KTogRWRpdG9yQ29tbWFuZDtcbn1cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBFZGl0b3JDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBhIGNvbW1hbmQgY2xhc3MgdGhhdCBpcyBib3VuZCB0byBhIGNlcnRhaW4gZWRpdG9yIGNvbnRyaWJ1dGlvbi5cblx0ICovXG5cdHB1YmxpYyBzdGF0aWMgYmluZFRvQ29udHJpYnV0aW9uPFQgZXh0ZW5kcyBJRWRpdG9yQ29udHJpYnV0aW9uPihjb250cm9sbGVyR2V0dGVyOiAoZWRpdG9yOiBJQ29kZUVkaXRvcikgPT4gVCB8IG51bGwpOiBFZGl0b3JDb250cm9sbGVyQ29tbWFuZDxUPiB7XG5cdFx0cmV0dXJuIGNsYXNzIEVkaXRvckNvbnRyb2xsZXJDb21tYW5kSW1wbCBleHRlbmRzIEVkaXRvckNvbW1hbmQge1xuXHRcdFx0cHJpdmF0ZSByZWFkb25seSBfY2FsbGJhY2s6IChjb250cm9sbGVyOiBULCBhcmdzOiBhbnkpID0+IHZvaWQ7XG5cblx0XHRcdGNvbnN0cnVjdG9yKG9wdHM6IElDb250cmlidXRpb25Db21tYW5kT3B0aW9uczxUPikge1xuXHRcdFx0XHRzdXBlcihvcHRzKTtcblxuXHRcdFx0XHR0aGlzLl9jYWxsYmFjayA9IG9wdHMuaGFuZGxlcjtcblx0XHRcdH1cblxuXHRcdFx0cHVibGljIHJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IGFueSk6IHZvaWQge1xuXHRcdFx0XHRjb25zdCBjb250cm9sbGVyID0gY29udHJvbGxlckdldHRlcihlZGl0b3IpO1xuXHRcdFx0XHRpZiAoY29udHJvbGxlcikge1xuXHRcdFx0XHRcdHRoaXMuX2NhbGxiYWNrKGNvbnRyb2xsZXIsIGFyZ3MpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgcnVuRWRpdG9yQ29tbWFuZChcblx0XHRhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcixcblx0XHRhcmdzOiBhbnksXG5cdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHVuZGVmaW5lZCxcblx0XHRydW5uZXI6IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciB8IG51bGwsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IGFueSkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD5cblx0KTogdm9pZCB8IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvZGVFZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb2RlRWRpdG9yU2VydmljZSk7XG5cblx0XHQvLyBGaW5kIHRoZSBlZGl0b3Igd2l0aCB0ZXh0IGZvY3VzIG9yIGFjdGl2ZVxuXHRcdGNvbnN0IGVkaXRvciA9IGNvZGVFZGl0b3JTZXJ2aWNlLmdldEZvY3VzZWRDb2RlRWRpdG9yKCkgfHwgY29kZUVkaXRvclNlcnZpY2UuZ2V0QWN0aXZlQ29kZUVkaXRvcigpO1xuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHQvLyB3ZWxsLCBhdCBsZWFzdCB3ZSB0cmllZC4uLlxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJldHVybiBlZGl0b3IuaW52b2tlV2l0aGluQ29udGV4dCgoZWRpdG9yQWNjZXNzb3IpID0+IHtcblx0XHRcdGNvbnN0IGtiU2VydmljZSA9IGVkaXRvckFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0aWYgKCFrYlNlcnZpY2UuY29udGV4dE1hdGNoZXNSdWxlcyhwcmVjb25kaXRpb24gPz8gdW5kZWZpbmVkKSkge1xuXHRcdFx0XHQvLyBwcmVjb25kaXRpb24gZG9lcyBub3QgaG9sZFxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBydW5uZXIoZWRpdG9yQWNjZXNzb3IsIGVkaXRvciwgYXJncyk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnczogYW55KTogdm9pZCB8IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBFZGl0b3JDb21tYW5kLnJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3IsIGFyZ3MsIHRoaXMucHJlY29uZGl0aW9uLCAoYWNjZXNzb3IsIGVkaXRvciwgYXJncykgPT4gdGhpcy5ydW5FZGl0b3JDb21tYW5kKGFjY2Vzc29yLCBlZGl0b3IsIGFyZ3MpKTtcblx0fVxuXG5cdHB1YmxpYyBhYnN0cmFjdCBydW5FZGl0b3JDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yIHwgbnVsbCwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogdm9pZCB8IFByb21pc2U8dm9pZD47XG59XG5cbi8vI2VuZHJlZ2lvbiBFZGl0b3JDb21tYW5kXG5cbi8vI3JlZ2lvbiBFZGl0b3JBY3Rpb25cblxuZXhwb3J0IGludGVyZmFjZSBJRWRpdG9yQWN0aW9uQ29udGV4dE1lbnVPcHRpb25zIHtcblx0Z3JvdXA6IHN0cmluZztcblx0b3JkZXI6IG51bWJlcjtcblx0d2hlbj86IENvbnRleHRLZXlFeHByZXNzaW9uO1xuXHRtZW51SWQ/OiBNZW51SWQ7XG59XG5leHBvcnQgdHlwZSBJQWN0aW9uT3B0aW9ucyA9IElDb21tYW5kT3B0aW9ucyAmIHtcblx0Y29udGV4dE1lbnVPcHRzPzogSUVkaXRvckFjdGlvbkNvbnRleHRNZW51T3B0aW9ucyB8IElFZGl0b3JBY3Rpb25Db250ZXh0TWVudU9wdGlvbnNbXTtcbn0gJiAoe1xuXHRsYWJlbDogbmxzLklMb2NhbGl6ZWRTdHJpbmc7XG5cdGFsaWFzPzogc3RyaW5nO1xufSB8IHtcblx0bGFiZWw6IHN0cmluZztcblx0YWxpYXM6IHN0cmluZztcbn0pO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRWRpdG9yQWN0aW9uIGV4dGVuZHMgRWRpdG9yQ29tbWFuZCB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgY29udmVydE9wdGlvbnMob3B0czogSUFjdGlvbk9wdGlvbnMpOiBJQ29tbWFuZE9wdGlvbnMge1xuXG5cdFx0bGV0IG1lbnVPcHRzOiBJQ29tbWFuZE1lbnVPcHRpb25zW107XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkob3B0cy5tZW51T3B0cykpIHtcblx0XHRcdG1lbnVPcHRzID0gb3B0cy5tZW51T3B0cztcblx0XHR9IGVsc2UgaWYgKG9wdHMubWVudU9wdHMpIHtcblx0XHRcdG1lbnVPcHRzID0gW29wdHMubWVudU9wdHNdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtZW51T3B0cyA9IFtdO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHdpdGhEZWZhdWx0cyhpdGVtOiBQYXJ0aWFsPElDb21tYW5kTWVudU9wdGlvbnM+KTogSUNvbW1hbmRNZW51T3B0aW9ucyB7XG5cdFx0XHRpZiAoIWl0ZW0ubWVudUlkKSB7XG5cdFx0XHRcdGl0ZW0ubWVudUlkID0gTWVudUlkLkVkaXRvckNvbnRleHQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWl0ZW0udGl0bGUpIHtcblx0XHRcdFx0aXRlbS50aXRsZSA9IHR5cGVvZiBvcHRzLmxhYmVsID09PSAnc3RyaW5nJyA/IG9wdHMubGFiZWwgOiBvcHRzLmxhYmVsLnZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0aXRlbS53aGVuID0gQ29udGV4dEtleUV4cHIuYW5kKG9wdHMucHJlY29uZGl0aW9uLCBpdGVtLndoZW4pO1xuXHRcdFx0cmV0dXJuIDxJQ29tbWFuZE1lbnVPcHRpb25zPml0ZW07XG5cdFx0fVxuXG5cdFx0aWYgKEFycmF5LmlzQXJyYXkob3B0cy5jb250ZXh0TWVudU9wdHMpKSB7XG5cdFx0XHRtZW51T3B0cy5wdXNoKC4uLm9wdHMuY29udGV4dE1lbnVPcHRzLm1hcCh3aXRoRGVmYXVsdHMpKTtcblx0XHR9IGVsc2UgaWYgKG9wdHMuY29udGV4dE1lbnVPcHRzKSB7XG5cdFx0XHRtZW51T3B0cy5wdXNoKHdpdGhEZWZhdWx0cyhvcHRzLmNvbnRleHRNZW51T3B0cykpO1xuXHRcdH1cblxuXHRcdG9wdHMubWVudU9wdHMgPSBtZW51T3B0cztcblx0XHRyZXR1cm4gPElDb21tYW5kT3B0aW9ucz5vcHRzO1xuXHR9XG5cblx0cHVibGljIHJlYWRvbmx5IGxhYmVsOiBzdHJpbmc7XG5cdHB1YmxpYyByZWFkb25seSBhbGlhczogc3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKG9wdHM6IElBY3Rpb25PcHRpb25zKSB7XG5cdFx0c3VwZXIoRWRpdG9yQWN0aW9uLmNvbnZlcnRPcHRpb25zKG9wdHMpKTtcblx0XHRpZiAodHlwZW9mIG9wdHMubGFiZWwgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLmxhYmVsID0gb3B0cy5sYWJlbDtcblx0XHRcdHRoaXMuYWxpYXMgPSBvcHRzLmFsaWFzID8/IG9wdHMubGFiZWw7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubGFiZWwgPSBvcHRzLmxhYmVsLnZhbHVlO1xuXHRcdFx0dGhpcy5hbGlhcyA9IG9wdHMuYWxpYXMgPz8gb3B0cy5sYWJlbC5vcmlnaW5hbDtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogdm9pZCB8IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMucmVwb3J0VGVsZW1ldHJ5KGFjY2Vzc29yLCBlZGl0b3IpO1xuXHRcdHJldHVybiB0aGlzLnJ1bihhY2Nlc3NvciwgZWRpdG9yLCBhcmdzIHx8IHt9KTtcblx0fVxuXG5cdHByb3RlY3RlZCByZXBvcnRUZWxlbWV0cnkoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpIHtcblx0XHR0eXBlIEVkaXRvckFjdGlvbkludm9rZWRDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdG93bmVyOiAnYWxleGRpbWEnO1xuXHRcdFx0Y29tbWVudDogJ0FuIGVkaXRvciBhY3Rpb24gaGFzIGJlZW4gaW52b2tlZC4nO1xuXHRcdFx0bmFtZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBsYWJlbCBvZiB0aGUgYWN0aW9uIHRoYXQgd2FzIGludm9rZWQuJyB9O1xuXHRcdFx0aWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgaWRlbnRpZmllciBvZiB0aGUgYWN0aW9uIHRoYXQgd2FzIGludm9rZWQuJyB9O1xuXHRcdH07XG5cdFx0dHlwZSBFZGl0b3JBY3Rpb25JbnZva2VkRXZlbnQgPSB7XG5cdFx0XHRuYW1lOiBzdHJpbmc7XG5cdFx0XHRpZDogc3RyaW5nO1xuXHRcdH07XG5cdFx0YWNjZXNzb3IuZ2V0KElUZWxlbWV0cnlTZXJ2aWNlKS5wdWJsaWNMb2cyPEVkaXRvckFjdGlvbkludm9rZWRFdmVudCwgRWRpdG9yQWN0aW9uSW52b2tlZENsYXNzaWZpY2F0aW9uPignZWRpdG9yQWN0aW9uSW52b2tlZCcsIHsgbmFtZTogdGhpcy5sYWJlbCwgaWQ6IHRoaXMuaWQgfSk7XG5cdH1cblxuXHRwdWJsaWMgYWJzdHJhY3QgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yLCBhcmdzOiBhbnkpOiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IHR5cGUgRWRpdG9yQWN0aW9uSW1wbGVtZW50YXRpb24gPSAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IGFueSkgPT4gYm9vbGVhbiB8IFByb21pc2U8dm9pZD47XG5cbmV4cG9ydCBjbGFzcyBNdWx0aUVkaXRvckFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaW1wbGVtZW50YXRpb25zOiBbbnVtYmVyLCBFZGl0b3JBY3Rpb25JbXBsZW1lbnRhdGlvbl1bXSA9IFtdO1xuXG5cdC8qKlxuXHQgKiBBIGhpZ2hlciBwcmlvcml0eSBnZXRzIHRvIGJlIGxvb2tlZCBhdCBmaXJzdFxuXHQgKi9cblx0cHVibGljIGFkZEltcGxlbWVudGF0aW9uKHByaW9yaXR5OiBudW1iZXIsIGltcGxlbWVudGF0aW9uOiBFZGl0b3JBY3Rpb25JbXBsZW1lbnRhdGlvbik6IElEaXNwb3NhYmxlIHtcblx0XHR0aGlzLl9pbXBsZW1lbnRhdGlvbnMucHVzaChbcHJpb3JpdHksIGltcGxlbWVudGF0aW9uXSk7XG5cdFx0dGhpcy5faW1wbGVtZW50YXRpb25zLnNvcnQoKGEsIGIpID0+IGJbMF0gLSBhWzBdKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2ltcGxlbWVudGF0aW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGlmICh0aGlzLl9pbXBsZW1lbnRhdGlvbnNbaV1bMV0gPT09IGltcGxlbWVudGF0aW9uKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9pbXBsZW1lbnRhdGlvbnMuc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yLCBhcmdzOiBhbnkpOiB2b2lkIHwgUHJvbWlzZTx2b2lkPiB7XG5cdFx0Zm9yIChjb25zdCBpbXBsIG9mIHRoaXMuX2ltcGxlbWVudGF0aW9ucykge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gaW1wbFsxXShhY2Nlc3NvciwgZWRpdG9yLCBhcmdzKTtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0aWYgKHR5cGVvZiByZXN1bHQgPT09ICdib29sZWFuJykge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG59XG5cbi8vI2VuZHJlZ2lvbiBFZGl0b3JBY3Rpb25cblxuLy8jcmVnaW9uIEVkaXRvckFjdGlvbjJcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEVkaXRvckFjdGlvbjIgZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0Ly8gRmluZCB0aGUgZWRpdG9yIHdpdGggdGV4dCBmb2N1cyBvciBhY3RpdmVcblx0XHRjb25zdCBjb2RlRWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvciA9IGNvZGVFZGl0b3JTZXJ2aWNlLmdldEZvY3VzZWRDb2RlRWRpdG9yKCkgfHwgY29kZUVkaXRvclNlcnZpY2UuZ2V0QWN0aXZlQ29kZUVkaXRvcigpO1xuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHQvLyB3ZWxsLCBhdCBsZWFzdCB3ZSB0cmllZC4uLlxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQvLyBwcmVjb25kaXRpb24gZG9lcyBob2xkXG5cdFx0cmV0dXJuIGVkaXRvci5pbnZva2VXaXRoaW5Db250ZXh0KChlZGl0b3JBY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y29uc3Qga2JTZXJ2aWNlID0gZWRpdG9yQWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0XHRjb25zdCBsb2dTZXJ2aWNlID0gZWRpdG9yQWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGVuYWJsZWQgPSBrYlNlcnZpY2UuY29udGV4dE1hdGNoZXNSdWxlcyh0aGlzLmRlc2MucHJlY29uZGl0aW9uID8/IHVuZGVmaW5lZCk7XG5cdFx0XHRpZiAoIWVuYWJsZWQpIHtcblx0XHRcdFx0bG9nU2VydmljZS5kZWJ1ZyhgW0VkaXRvckFjdGlvbjJdIE5PVCBydW5uaW5nIGNvbW1hbmQgYmVjYXVzZSBpdHMgcHJlY29uZGl0aW9uIGlzIEZBTFNFYCwgdGhpcy5kZXNjLmlkLCB0aGlzLmRlc2MucHJlY29uZGl0aW9uPy5zZXJpYWxpemUoKSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzLnJ1bkVkaXRvckNvbW1hbmQoZWRpdG9yQWNjZXNzb3IsIGVkaXRvciwgLi4uYXJncyk7XG5cdFx0fSk7XG5cdH1cblxuXHRhYnN0cmFjdCBydW5FZGl0b3JDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yLCAuLi5hcmdzOiBhbnlbXSk6IGFueTtcbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vIC0tLSBSZWdpc3RyYXRpb24gb2YgY29tbWFuZHMgYW5kIGFjdGlvbnNcblxuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJNb2RlbEFuZFBvc2l0aW9uQ29tbWFuZChpZDogc3RyaW5nLCBoYW5kbGVyOiAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24sIC4uLmFyZ3M6IGFueVtdKSA9PiBhbnkpIHtcblx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoaWQsIGZ1bmN0aW9uIChhY2Nlc3NvciwgLi4uYXJncykge1xuXG5cdFx0Y29uc3QgaW5zdGFTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cblx0XHRjb25zdCBbcmVzb3VyY2UsIHBvc2l0aW9uXSA9IGFyZ3M7XG5cdFx0YXNzZXJ0VHlwZShVUkkuaXNVcmkocmVzb3VyY2UpKTtcblx0XHRhc3NlcnRUeXBlKFBvc2l0aW9uLmlzSVBvc2l0aW9uKHBvc2l0aW9uKSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGFjY2Vzc29yLmdldChJTW9kZWxTZXJ2aWNlKS5nZXRNb2RlbChyZXNvdXJjZSk7XG5cdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHRjb25zdCBlZGl0b3JQb3NpdGlvbiA9IFBvc2l0aW9uLmxpZnQocG9zaXRpb24pO1xuXHRcdFx0cmV0dXJuIGluc3RhU2VydmljZS5pbnZva2VGdW5jdGlvbihoYW5kbGVyLCBtb2RlbCwgZWRpdG9yUG9zaXRpb24sIC4uLmFyZ3Muc2xpY2UoMikpO1xuXHRcdH1cblxuXHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSVRleHRNb2RlbFNlcnZpY2UpLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKHJlc291cmNlKS50aGVuKHJlZmVyZW5jZSA9PiB7XG5cdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGluc3RhU2VydmljZS5pbnZva2VGdW5jdGlvbihoYW5kbGVyLCByZWZlcmVuY2Uub2JqZWN0LnRleHRFZGl0b3JNb2RlbCwgUG9zaXRpb24ubGlmdChwb3NpdGlvbiksIGFyZ3Muc2xpY2UoMikpO1xuXHRcdFx0XHRcdHJlc29sdmUocmVzdWx0KTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0cmVqZWN0KGVycik7XG5cdFx0XHRcdH1cblx0XHRcdH0pLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0XHRyZWZlcmVuY2UuZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJFZGl0b3JDb21tYW5kPFQgZXh0ZW5kcyBFZGl0b3JDb21tYW5kPihlZGl0b3JDb21tYW5kOiBUKTogVCB7XG5cdEVkaXRvckNvbnRyaWJ1dGlvblJlZ2lzdHJ5LklOU1RBTkNFLnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChlZGl0b3JDb21tYW5kKTtcblx0cmV0dXJuIGVkaXRvckNvbW1hbmQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckVkaXRvckFjdGlvbjxUIGV4dGVuZHMgRWRpdG9yQWN0aW9uPihjdG9yOiB7IG5ldygpOiBUIH0pOiBUIHtcblx0Y29uc3QgYWN0aW9uID0gbmV3IGN0b3IoKTtcblx0RWRpdG9yQ29udHJpYnV0aW9uUmVnaXN0cnkuSU5TVEFOQ0UucmVnaXN0ZXJFZGl0b3JBY3Rpb24oYWN0aW9uKTtcblx0cmV0dXJuIGFjdGlvbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyTXVsdGlFZGl0b3JBY3Rpb248VCBleHRlbmRzIE11bHRpRWRpdG9yQWN0aW9uPihhY3Rpb246IFQpOiBUIHtcblx0RWRpdG9yQ29udHJpYnV0aW9uUmVnaXN0cnkuSU5TVEFOQ0UucmVnaXN0ZXJFZGl0b3JBY3Rpb24oYWN0aW9uKTtcblx0cmV0dXJuIGFjdGlvbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVySW5zdGFudGlhdGVkRWRpdG9yQWN0aW9uKGVkaXRvckFjdGlvbjogRWRpdG9yQWN0aW9uKTogdm9pZCB7XG5cdEVkaXRvckNvbnRyaWJ1dGlvblJlZ2lzdHJ5LklOU1RBTkNFLnJlZ2lzdGVyRWRpdG9yQWN0aW9uKGVkaXRvckFjdGlvbik7XG59XG5cbi8qKlxuICogUmVnaXN0ZXJzIGFuIGVkaXRvciBjb250cmlidXRpb24uIEVkaXRvciBjb250cmlidXRpb25zIGhhdmUgYSBsaWZlY3ljbGUgd2hpY2ggaXMgYm91bmRcbiAqIHRvIGEgc3BlY2lmaWMgY29kZSBlZGl0b3IgaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbjxTZXJ2aWNlcyBleHRlbmRzIEJyYW5kZWRTZXJ2aWNlW10+KGlkOiBzdHJpbmcsIGN0b3I6IHsgbmV3KGVkaXRvcjogSUNvZGVFZGl0b3IsIC4uLnNlcnZpY2VzOiBTZXJ2aWNlcyk6IElFZGl0b3JDb250cmlidXRpb24gfSwgaW5zdGFudGlhdGlvbjogRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbik6IHZvaWQge1xuXHRFZGl0b3JDb250cmlidXRpb25SZWdpc3RyeS5JTlNUQU5DRS5yZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbihpZCwgY3RvciwgaW5zdGFudGlhdGlvbik7XG59XG5cbi8qKlxuICogUmVnaXN0ZXJzIGEgZGlmZiBlZGl0b3IgY29udHJpYnV0aW9uLiBEaWZmIGVkaXRvciBjb250cmlidXRpb25zIGhhdmUgYSBsaWZlY3ljbGUgd2hpY2hcbiAqIGlzIGJvdW5kIHRvIGEgc3BlY2lmaWMgZGlmZiBlZGl0b3IgaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckRpZmZFZGl0b3JDb250cmlidXRpb248U2VydmljZXMgZXh0ZW5kcyBCcmFuZGVkU2VydmljZVtdPihpZDogc3RyaW5nLCBjdG9yOiB7IG5ldyhlZGl0b3I6IElEaWZmRWRpdG9yLCAuLi5zZXJ2aWNlczogU2VydmljZXMpOiBJRWRpdG9yQ29udHJpYnV0aW9uIH0pOiB2b2lkIHtcblx0RWRpdG9yQ29udHJpYnV0aW9uUmVnaXN0cnkuSU5TVEFOQ0UucmVnaXN0ZXJEaWZmRWRpdG9yQ29udHJpYnV0aW9uKGlkLCBjdG9yKTtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBFZGl0b3JFeHRlbnNpb25zUmVnaXN0cnkge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBnZXRFZGl0b3JDb21tYW5kKGNvbW1hbmRJZDogc3RyaW5nKTogRWRpdG9yQ29tbWFuZCB7XG5cdFx0cmV0dXJuIEVkaXRvckNvbnRyaWJ1dGlvblJlZ2lzdHJ5LklOU1RBTkNFLmdldEVkaXRvckNvbW1hbmQoY29tbWFuZElkKTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBnZXRFZGl0b3JBY3Rpb25zKCk6IEl0ZXJhYmxlPEVkaXRvckFjdGlvbj4ge1xuXHRcdHJldHVybiBFZGl0b3JDb250cmlidXRpb25SZWdpc3RyeS5JTlNUQU5DRS5nZXRFZGl0b3JBY3Rpb25zKCk7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZ2V0RWRpdG9yQ29udHJpYnV0aW9ucygpOiBJRWRpdG9yQ29udHJpYnV0aW9uRGVzY3JpcHRpb25bXSB7XG5cdFx0cmV0dXJuIEVkaXRvckNvbnRyaWJ1dGlvblJlZ2lzdHJ5LklOU1RBTkNFLmdldEVkaXRvckNvbnRyaWJ1dGlvbnMoKTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBnZXRTb21lRWRpdG9yQ29udHJpYnV0aW9ucyhpZHM6IHN0cmluZ1tdKTogSUVkaXRvckNvbnRyaWJ1dGlvbkRlc2NyaXB0aW9uW10ge1xuXHRcdHJldHVybiBFZGl0b3JDb250cmlidXRpb25SZWdpc3RyeS5JTlNUQU5DRS5nZXRFZGl0b3JDb250cmlidXRpb25zKCkuZmlsdGVyKGMgPT4gaWRzLmluZGV4T2YoYy5pZCkgPj0gMCk7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZ2V0RGlmZkVkaXRvckNvbnRyaWJ1dGlvbnMoKTogSURpZmZFZGl0b3JDb250cmlidXRpb25EZXNjcmlwdGlvbltdIHtcblx0XHRyZXR1cm4gRWRpdG9yQ29udHJpYnV0aW9uUmVnaXN0cnkuSU5TVEFOQ0UuZ2V0RGlmZkVkaXRvckNvbnRyaWJ1dGlvbnMoKTtcblx0fVxufVxuXG4vLyBFZGl0b3IgZXh0ZW5zaW9uIHBvaW50c1xuY29uc3QgRXh0ZW5zaW9ucyA9IHtcblx0RWRpdG9yQ29tbW9uQ29udHJpYnV0aW9uczogJ2VkaXRvci5jb250cmlidXRpb25zJ1xufTtcblxuY2xhc3MgRWRpdG9yQ29udHJpYnV0aW9uUmVnaXN0cnkge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSU5TVEFOQ0UgPSBuZXcgRWRpdG9yQ29udHJpYnV0aW9uUmVnaXN0cnkoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvckNvbnRyaWJ1dGlvbnM6IElFZGl0b3JDb250cmlidXRpb25EZXNjcmlwdGlvbltdID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgZGlmZkVkaXRvckNvbnRyaWJ1dGlvbnM6IElEaWZmRWRpdG9yQ29udHJpYnV0aW9uRGVzY3JpcHRpb25bXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvckFjdGlvbnM6IEVkaXRvckFjdGlvbltdID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yQ29tbWFuZHM6IHsgW2NvbW1hbmRJZDogc3RyaW5nXTogRWRpdG9yQ29tbWFuZCB9ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbjxTZXJ2aWNlcyBleHRlbmRzIEJyYW5kZWRTZXJ2aWNlW10+KGlkOiBzdHJpbmcsIGN0b3I6IHsgbmV3KGVkaXRvcjogSUNvZGVFZGl0b3IsIC4uLnNlcnZpY2VzOiBTZXJ2aWNlcyk6IElFZGl0b3JDb250cmlidXRpb24gfSwgaW5zdGFudGlhdGlvbjogRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbik6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yQ29udHJpYnV0aW9ucy5wdXNoKHsgaWQsIGN0b3I6IGN0b3IgYXMgRWRpdG9yQ29udHJpYnV0aW9uQ3RvciwgaW5zdGFudGlhdGlvbiB9KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRFZGl0b3JDb250cmlidXRpb25zKCk6IElFZGl0b3JDb250cmlidXRpb25EZXNjcmlwdGlvbltdIHtcblx0XHRyZXR1cm4gdGhpcy5lZGl0b3JDb250cmlidXRpb25zLnNsaWNlKDApO1xuXHR9XG5cblx0cHVibGljIHJlZ2lzdGVyRGlmZkVkaXRvckNvbnRyaWJ1dGlvbjxTZXJ2aWNlcyBleHRlbmRzIEJyYW5kZWRTZXJ2aWNlW10+KGlkOiBzdHJpbmcsIGN0b3I6IHsgbmV3KGVkaXRvcjogSURpZmZFZGl0b3IsIC4uLnNlcnZpY2VzOiBTZXJ2aWNlcyk6IElFZGl0b3JDb250cmlidXRpb24gfSk6IHZvaWQge1xuXHRcdHRoaXMuZGlmZkVkaXRvckNvbnRyaWJ1dGlvbnMucHVzaCh7IGlkLCBjdG9yOiBjdG9yIGFzIERpZmZFZGl0b3JDb250cmlidXRpb25DdG9yIH0pO1xuXHR9XG5cblx0cHVibGljIGdldERpZmZFZGl0b3JDb250cmlidXRpb25zKCk6IElEaWZmRWRpdG9yQ29udHJpYnV0aW9uRGVzY3JpcHRpb25bXSB7XG5cdFx0cmV0dXJuIHRoaXMuZGlmZkVkaXRvckNvbnRyaWJ1dGlvbnMuc2xpY2UoMCk7XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXJFZGl0b3JBY3Rpb24oYWN0aW9uOiBFZGl0b3JBY3Rpb24pIHtcblx0XHRhY3Rpb24ucmVnaXN0ZXIoKTtcblx0XHR0aGlzLmVkaXRvckFjdGlvbnMucHVzaChhY3Rpb24pO1xuXHR9XG5cblx0cHVibGljIGdldEVkaXRvckFjdGlvbnMoKTogSXRlcmFibGU8RWRpdG9yQWN0aW9uPiB7XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9yQWN0aW9ucztcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlckVkaXRvckNvbW1hbmQoZWRpdG9yQ29tbWFuZDogRWRpdG9yQ29tbWFuZCkge1xuXHRcdGVkaXRvckNvbW1hbmQucmVnaXN0ZXIoKTtcblx0XHR0aGlzLmVkaXRvckNvbW1hbmRzW2VkaXRvckNvbW1hbmQuaWRdID0gZWRpdG9yQ29tbWFuZDtcblx0fVxuXG5cdHB1YmxpYyBnZXRFZGl0b3JDb21tYW5kKGNvbW1hbmRJZDogc3RyaW5nKTogRWRpdG9yQ29tbWFuZCB7XG5cdFx0cmV0dXJuICh0aGlzLmVkaXRvckNvbW1hbmRzW2NvbW1hbmRJZF0gfHwgbnVsbCk7XG5cdH1cblxufVxuUmVnaXN0cnkuYWRkKEV4dGVuc2lvbnMuRWRpdG9yQ29tbW9uQ29udHJpYnV0aW9ucywgRWRpdG9yQ29udHJpYnV0aW9uUmVnaXN0cnkuSU5TVEFOQ0UpO1xuXG5mdW5jdGlvbiByZWdpc3RlckNvbW1hbmQ8VCBleHRlbmRzIENvbW1hbmQ+KGNvbW1hbmQ6IFQpOiBUIHtcblx0Y29tbWFuZC5yZWdpc3RlcigpO1xuXHRyZXR1cm4gY29tbWFuZDtcbn1cblxuZXhwb3J0IGNvbnN0IFVuZG9Db21tYW5kID0gcmVnaXN0ZXJDb21tYW5kKG5ldyBNdWx0aUNvbW1hbmQoe1xuXHRpZDogJ3VuZG8nLFxuXHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0a2JPcHRzOiB7XG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvcmUsXG5cdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVpcblx0fSxcblx0bWVudU9wdHM6IFt7XG5cdFx0bWVudUlkOiBNZW51SWQuTWVudWJhckVkaXRNZW51LFxuXHRcdGdyb3VwOiAnMV9kbycsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pVW5kbycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlVuZG9cIiksXG5cdFx0b3JkZXI6IDFcblx0fSwge1xuXHRcdG1lbnVJZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdGdyb3VwOiAnJyxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCd1bmRvJywgXCJVbmRvXCIpLFxuXHRcdG9yZGVyOiAxXG5cdH0sIHtcblx0XHRtZW51SWQ6IE1lbnVJZC5TaW1wbGVFZGl0b3JDb250ZXh0LFxuXHRcdGdyb3VwOiAnMV9kbycsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgndW5kbycsIFwiVW5kb1wiKSxcblx0XHRvcmRlcjogMVxuXHR9XVxufSkpO1xuXG5yZWdpc3RlckNvbW1hbmQobmV3IFByb3h5Q29tbWFuZChVbmRvQ29tbWFuZCwgeyBpZDogJ2RlZmF1bHQ6dW5kbycsIHByZWNvbmRpdGlvbjogdW5kZWZpbmVkIH0pKTtcblxuZXhwb3J0IGNvbnN0IFJlZG9Db21tYW5kID0gcmVnaXN0ZXJDb21tYW5kKG5ldyBNdWx0aUNvbW1hbmQoe1xuXHRpZDogJ3JlZG8nLFxuXHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0a2JPcHRzOiB7XG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvcmUsXG5cdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVksXG5cdFx0c2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleVpdLFxuXHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5WiB9XG5cdH0sXG5cdG1lbnVPcHRzOiBbe1xuXHRcdG1lbnVJZDogTWVudUlkLk1lbnViYXJFZGl0TWVudSxcblx0XHRncm91cDogJzFfZG8nLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaVJlZG8nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZSZWRvXCIpLFxuXHRcdG9yZGVyOiAyXG5cdH0sIHtcblx0XHRtZW51SWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRncm91cDogJycsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgncmVkbycsIFwiUmVkb1wiKSxcblx0XHRvcmRlcjogMVxuXHR9LCB7XG5cdFx0bWVudUlkOiBNZW51SWQuU2ltcGxlRWRpdG9yQ29udGV4dCxcblx0XHRncm91cDogJzFfZG8nLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ3JlZG8nLCBcIlJlZG9cIiksXG5cdFx0b3JkZXI6IDJcblx0fV1cbn0pKTtcblxucmVnaXN0ZXJDb21tYW5kKG5ldyBQcm94eUNvbW1hbmQoUmVkb0NvbW1hbmQsIHsgaWQ6ICdkZWZhdWx0OnJlZG8nLCBwcmVjb25kaXRpb246IHVuZGVmaW5lZCB9KSk7XG5cbmV4cG9ydCBjb25zdCBTZWxlY3RBbGxDb21tYW5kID0gcmVnaXN0ZXJDb21tYW5kKG5ldyBNdWx0aUNvbW1hbmQoe1xuXHRpZDogJ2VkaXRvci5hY3Rpb24uc2VsZWN0QWxsJyxcblx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdGtiT3B0czoge1xuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb3JlLFxuXHRcdGtiRXhwcjogbnVsbCxcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5QVxuXHR9LFxuXHRtZW51T3B0czogW3tcblx0XHRtZW51SWQ6IE1lbnVJZC5NZW51YmFyU2VsZWN0aW9uTWVudSxcblx0XHRncm91cDogJzFfYmFzaWMnLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaVNlbGVjdEFsbCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlNlbGVjdCBBbGxcIiksXG5cdFx0b3JkZXI6IDFcblx0fSwge1xuXHRcdG1lbnVJZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdGdyb3VwOiAnJyxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdzZWxlY3RBbGwnLCBcIlNlbGVjdCBBbGxcIiksXG5cdFx0b3JkZXI6IDFcblx0fSwge1xuXHRcdG1lbnVJZDogTWVudUlkLlNpbXBsZUVkaXRvckNvbnRleHQsXG5cdFx0Z3JvdXA6ICc5X3NlbGVjdCcsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnc2VsZWN0QWxsJywgXCJTZWxlY3QgQWxsXCIpLFxuXHRcdG9yZGVyOiAxXG5cdH1dXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxXQUFXO0FBRXBCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsZ0JBQWdCO0FBR3pCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsUUFBUSxjQUFjLGVBQWU7QUFDOUMsU0FBUyx3QkFBMEM7QUFDbkQsU0FBUyxnQkFBZ0IsMEJBQWdEO0FBQ3pFLFNBQTRFLDZCQUFvRDtBQUNoSSxTQUF1QixxQkFBcUIsd0JBQXdCO0FBQ3BFLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsa0JBQWtCO0FBRzNCLFNBQVMsUUFBUSxlQUFlO0FBQ2hDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsd0JBQXdCO0FBTTFCLElBQVcsa0NBQVgsa0JBQVdBLHFDQUFYO0FBS04sRUFBQUEsa0VBQUE7QUFPQSxFQUFBQSxrRUFBQTtBQU9BLEVBQUFBLGtFQUFBO0FBTUEsRUFB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
