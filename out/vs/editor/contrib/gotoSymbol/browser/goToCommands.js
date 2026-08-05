var _a, _b, _c, _d, _e, _f, _g, _h;
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { createCancelablePromise, raceCancellation } from "../../../../base/common/async.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { assertType } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { CodeEditorStateFlag, EditorStateCancellationTokenSource } from "../../editorState/browser/editorState.js";
import { isCodeEditor } from "../../../browser/editorBrowser.js";
import { EditorAction2 } from "../../../browser/editorExtensions.js";
import { ICodeEditorService } from "../../../browser/services/codeEditorService.js";
import { EmbeddedCodeEditorWidget } from "../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import * as corePosition from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { isLocationLink } from "../../../common/languages.js";
import { ReferencesController } from "./peek/referencesController.js";
import { ReferencesModel } from "./referencesModel.js";
import { ISymbolNavigationService } from "./symbolNavigation.js";
import { MessageController } from "../../message/browser/messageController.js";
import { PeekContext } from "../../peekView/browser/peekView.js";
import * as nls from "../../../../nls.js";
import { MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { TextEditorSelectionRevealType, TextEditorSelectionSource } from "../../../../platform/editor/common/editor.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IEditorProgressService } from "../../../../platform/progress/common/progress.js";
import { getDeclarationsAtPosition, getDefinitionsAtPosition, getImplementationsAtPosition, getReferencesAtPosition, getTypeDefinitionsAtPosition } from "./goToSymbol.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { IsWebContext } from "../../../../platform/contextkey/common/contextkeys.js";
MenuRegistry.appendMenuItem(MenuId.EditorContext, {
  submenu: MenuId.EditorContextPeek,
  title: nls.localize("peek.submenu", "Peek"),
  group: "navigation",
  order: 100
});
class SymbolNavigationAnchor {
  constructor(model, position) {
    this.model = model;
    this.position = position;
  }
  static is(thing) {
    if (!thing || typeof thing !== "object") {
      return false;
    }
    if (thing instanceof SymbolNavigationAnchor) {
      return true;
    }
    if (corePosition.Position.isIPosition(thing.position) && thing.model) {
      return true;
    }
    return false;
  }
}
const _SymbolNavigationAction = class _SymbolNavigationAction extends EditorAction2 {
  static all() {
    return _SymbolNavigationAction._allSymbolNavigationCommands.values();
  }
  static _patchConfig(opts) {
    const result = { ...opts, f1: true };
    if (result.menu) {
      for (const item of Iterable.wrap(result.menu)) {
        if (item.id === MenuId.EditorContext || item.id === MenuId.EditorContextPeek) {
          item.when = ContextKeyExpr.and(opts.precondition, item.when);
        }
      }
    }
    return result;
  }
  constructor(configuration, opts) {
    super(_SymbolNavigationAction._patchConfig(opts));
    this.configuration = configuration;
    _SymbolNavigationAction._allSymbolNavigationCommands.set(opts.id, this);
  }
  runEditorCommand(accessor, editor, arg, range) {
    if (!editor.hasModel()) {
      return Promise.resolve(void 0);
    }
    const notificationService = accessor.get(INotificationService);
    const editorService = accessor.get(ICodeEditorService);
    const progressService = accessor.get(IEditorProgressService);
    const symbolNavService = accessor.get(ISymbolNavigationService);
    const languageFeaturesService = accessor.get(ILanguageFeaturesService);
    const instaService = accessor.get(IInstantiationService);
    const model = editor.getModel();
    const position = editor.getPosition();
    const anchor = SymbolNavigationAnchor.is(arg) ? arg : new SymbolNavigationAnchor(model, position);
    const cts = new EditorStateCancellationTokenSource(editor, CodeEditorStateFlag.Value | CodeEditorStateFlag.Position);
    const promise = raceCancellation(this._getLocationModel(languageFeaturesService, anchor.model, anchor.position, cts.token), cts.token).then(async (references) => {
      if (!references || cts.token.isCancellationRequested) {
        return;
      }
      alert(references.ariaMessage);
      let altAction;
      if (references.referenceAt(model.uri, position)) {
        const altActionId = this._getAlternativeCommand(editor);
        if (altActionId !== void 0 && !_SymbolNavigationAction._activeAlternativeCommands.has(altActionId) && _SymbolNavigationAction._allSymbolNavigationCommands.has(altActionId)) {
          altAction = _SymbolNavigationAction._allSymbolNavigationCommands.get(altActionId);
        }
      }
      const referenceCount = references.references.length;
      if (referenceCount === 0) {
        if (!this.configuration.muteMessage) {
          const info = model.getWordAtPosition(position);
          MessageController.get(editor)?.showMessage(this._getNoResultFoundMessage(info), position);
        }
      } else if (referenceCount === 1 && altAction) {
        _SymbolNavigationAction._activeAlternativeCommands.add(this.desc.id);
        instaService.invokeFunction((accessor2) => altAction.runEditorCommand(accessor2, editor, arg, range).finally(() => {
          _SymbolNavigationAction._activeAlternativeCommands.delete(this.desc.id);
        }));
      } else {
        return this._onResult(editorService, symbolNavService, editor, references, range);
      }
    }, (err) => {
      notificationService.error(err);
    }).finally(() => {
      cts.dispose();
    });
    progressService.showWhile(promise, 250);
    return promise;
  }
  async _onResult(editorService, symbolNavService, editor, model, range) {
    const gotoLocation = this._getGoToPreference(editor);
    if (!(editor instanceof EmbeddedCodeEditorWidget) && (this.configuration.openInPeek || gotoLocation === "peek" && model.references.length > 1)) {
      this._openInPeek(editor, model, range);
    } else {
      const next = model.firstReference();
      const peek = model.references.length > 1 && gotoLocation === "gotoAndPeek";
      const targetEditor = await this._openReference(editor, editorService, next, this.configuration.openToSide, !peek);
      if (peek && targetEditor) {
        this._openInPeek(targetEditor, model, range);
      } else {
        model.dispose();
      }
      if (gotoLocation === "goto") {
        symbolNavService.put(next);
      }
    }
  }
  async _openReference(editor, editorService, reference, sideBySide, highlight) {
    let range = void 0;
    if (isLocationLink(reference)) {
      range = reference.targetSelectionRange;
    }
    if (!range) {
      range = reference.range;
    }
    if (!range) {
      return void 0;
    }
    const targetEditor = await editorService.openCodeEditor({
      resource: reference.uri,
      options: {
        selection: Range.collapseToStart(range),
        selectionRevealType: TextEditorSelectionRevealType.NearTopIfOutsideViewport,
        selectionSource: TextEditorSelectionSource.JUMP
      }
    }, editor, sideBySide);
    if (!targetEditor) {
      return void 0;
    }
    if (highlight) {
      const modelNow = targetEditor.getModel();
      const decorations = targetEditor.createDecorationsCollection([{ range, options: { description: "symbol-navigate-action-highlight", className: "symbolHighlight" } }]);
      setTimeout(() => {
        if (targetEditor.getModel() === modelNow) {
          decorations.clear();
        }
      }, 350);
    }
    return targetEditor;
  }
  _openInPeek(target, model, range) {
    const controller = ReferencesController.get(target);
    if (controller && target.hasModel()) {
      controller.toggleWidget(range ?? target.getSelection(), createCancelablePromise((_) => Promise.resolve(model)), this.configuration.openInPeek);
    } else {
      model.dispose();
    }
  }
};
_SymbolNavigationAction._allSymbolNavigationCommands = /* @__PURE__ */ new Map();
_SymbolNavigationAction._activeAlternativeCommands = /* @__PURE__ */ new Set();
let SymbolNavigationAction = _SymbolNavigationAction;
class DefinitionAction extends SymbolNavigationAction {
  async _getLocationModel(languageFeaturesService, model, position, token) {
    return new ReferencesModel(await getDefinitionsAtPosition(languageFeaturesService.definitionProvider, model, position, false, token), nls.localize("def.title", "Definitions"));
  }
  _getNoResultFoundMessage(info) {
    return info && info.word ? nls.localize("noResultWord", "No definition found for '{0}'", info.word) : nls.localize("generic.noResults", "No definition found");
  }
  _getAlternativeCommand(editor) {
    return editor.getOption(EditorOption.gotoLocation).alternativeDefinitionCommand;
  }
  _getGoToPreference(editor) {
    return editor.getOption(EditorOption.gotoLocation).multipleDefinitions;
  }
}
registerAction2((_a = class extends DefinitionAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: false,
      muteMessage: false
    }, {
      id: _a.id,
      title: {
        ...nls.localize2("actions.goToDecl.label", "Go to Definition"),
        mnemonicTitle: nls.localize({ key: "miGotoDefinition", comment: ["&& denotes a mnemonic"] }, "Go to &&Definition")
      },
      precondition: EditorContextKeys.hasDefinitionProvider,
      keybinding: [{
        when: EditorContextKeys.editorTextFocus,
        primary: KeyCode.F12,
        weight: KeybindingWeight.EditorContrib
      }, {
        when: ContextKeyExpr.and(EditorContextKeys.editorTextFocus, IsWebContext),
        primary: KeyMod.CtrlCmd | KeyCode.F12,
        weight: KeybindingWeight.EditorContrib
      }],
      menu: [{
        id: MenuId.EditorContext,
        group: "navigation",
        order: 1.1
      }, {
        id: MenuId.MenubarGoMenu,
        precondition: null,
        group: "4_symbol_nav",
        order: 2
      }]
    });
    CommandsRegistry.registerCommandAlias("editor.action.goToDeclaration", _a.id);
  }
}, _a.id = "editor.action.revealDefinition", _a));
registerAction2((_b = class extends DefinitionAction {
  constructor() {
    super({
      openToSide: true,
      openInPeek: false,
      muteMessage: false
    }, {
      id: _b.id,
      title: nls.localize2("actions.goToDeclToSide.label", "Open Definition to the Side"),
      precondition: ContextKeyExpr.and(
        EditorContextKeys.hasDefinitionProvider,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      ),
      keybinding: [{
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.F12),
        weight: KeybindingWeight.EditorContrib
      }, {
        when: ContextKeyExpr.and(EditorContextKeys.editorTextFocus, IsWebContext),
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.F12),
        weight: KeybindingWeight.EditorContrib
      }]
    });
    CommandsRegistry.registerCommandAlias("editor.action.openDeclarationToTheSide", _b.id);
  }
}, _b.id = "editor.action.revealDefinitionAside", _b));
registerAction2((_c = class extends DefinitionAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: true,
      muteMessage: false
    }, {
      id: _c.id,
      title: nls.localize2("actions.previewDecl.label", "Peek Definition"),
      precondition: ContextKeyExpr.and(
        EditorContextKeys.hasDefinitionProvider,
        PeekContext.notInPeekEditor,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      ),
      keybinding: {
        when: EditorContextKeys.editorTextFocus,
        primary: KeyMod.Alt | KeyCode.F12,
        linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.F10 },
        weight: KeybindingWeight.EditorContrib
      },
      menu: {
        id: MenuId.EditorContextPeek,
        group: "peek",
        order: 2
      }
    });
    CommandsRegistry.registerCommandAlias("editor.action.previewDeclaration", _c.id);
  }
}, _c.id = "editor.action.peekDefinition", _c));
class DeclarationAction extends SymbolNavigationAction {
  async _getLocationModel(languageFeaturesService, model, position, token) {
    return new ReferencesModel(await getDeclarationsAtPosition(languageFeaturesService.declarationProvider, model, position, false, token), nls.localize("decl.title", "Declarations"));
  }
  _getNoResultFoundMessage(info) {
    return info && info.word ? nls.localize("decl.noResultWord", "No declaration found for '{0}'", info.word) : nls.localize("decl.generic.noResults", "No declaration found");
  }
  _getAlternativeCommand(editor) {
    return editor.getOption(EditorOption.gotoLocation).alternativeDeclarationCommand;
  }
  _getGoToPreference(editor) {
    return editor.getOption(EditorOption.gotoLocation).multipleDeclarations;
  }
}
registerAction2((_d = class extends DeclarationAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: false,
      muteMessage: false
    }, {
      id: _d.id,
      title: {
        ...nls.localize2("actions.goToDeclaration.label", "Go to Declaration"),
        mnemonicTitle: nls.localize({ key: "miGotoDeclaration", comment: ["&& denotes a mnemonic"] }, "Go to &&Declaration")
      },
      precondition: ContextKeyExpr.and(
        EditorContextKeys.hasDeclarationProvider,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      ),
      menu: [{
        id: MenuId.EditorContext,
        group: "navigation",
        order: 1.3
      }, {
        id: MenuId.MenubarGoMenu,
        precondition: null,
        group: "4_symbol_nav",
        order: 3
      }]
    });
  }
  _getNoResultFoundMessage(info) {
    return info && info.word ? nls.localize("decl.noResultWord", "No declaration found for '{0}'", info.word) : nls.localize("decl.generic.noResults", "No declaration found");
  }
}, _d.id = "editor.action.revealDeclaration", _d));
registerAction2(class PeekDeclarationAction extends DeclarationAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: true,
      muteMessage: false
    }, {
      id: "editor.action.peekDeclaration",
      title: nls.localize2("actions.peekDecl.label", "Peek Declaration"),
      precondition: ContextKeyExpr.and(
        EditorContextKeys.hasDeclarationProvider,
        PeekContext.notInPeekEditor,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      ),
      menu: {
        id: MenuId.EditorContextPeek,
        group: "peek",
        order: 3
      }
    });
  }
});
class TypeDefinitionAction extends SymbolNavigationAction {
  async _getLocationModel(languageFeaturesService, model, position, token) {
    return new ReferencesModel(await getTypeDefinitionsAtPosition(languageFeaturesService.typeDefinitionProvider, model, position, false, token), nls.localize("typedef.title", "Type Definitions"));
  }
  _getNoResultFoundMessage(info) {
    return info && info.word ? nls.localize("goToTypeDefinition.noResultWord", "No type definition found for '{0}'", info.word) : nls.localize("goToTypeDefinition.generic.noResults", "No type definition found");
  }
  _getAlternativeCommand(editor) {
    return editor.getOption(EditorOption.gotoLocation).alternativeTypeDefinitionCommand;
  }
  _getGoToPreference(editor) {
    return editor.getOption(EditorOption.gotoLocation).multipleTypeDefinitions;
  }
}
registerAction2((_e = class extends TypeDefinitionAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: false,
      muteMessage: false
    }, {
      id: _e.ID,
      title: {
        ...nls.localize2("actions.goToTypeDefinition.label", "Go to Type Definition"),
        mnemonicTitle: nls.localize({ key: "miGotoTypeDefinition", comment: ["&& denotes a mnemonic"] }, "Go to &&Type Definition")
      },
      precondition: EditorContextKeys.hasTypeDefinitionProvider,
      keybinding: {
        when: EditorContextKeys.editorTextFocus,
        primary: 0,
        weight: KeybindingWeight.EditorContrib
      },
      menu: [{
        id: MenuId.EditorContext,
        group: "navigation",
        order: 1.4
      }, {
        id: MenuId.MenubarGoMenu,
        precondition: null,
        group: "4_symbol_nav",
        order: 3
      }]
    });
  }
}, _e.ID = "editor.action.goToTypeDefinition", _e));
registerAction2((_f = class extends TypeDefinitionAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: true,
      muteMessage: false
    }, {
      id: _f.ID,
      title: nls.localize2("actions.peekTypeDefinition.label", "Peek Type Definition"),
      precondition: ContextKeyExpr.and(
        EditorContextKeys.hasTypeDefinitionProvider,
        PeekContext.notInPeekEditor,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      ),
      menu: {
        id: MenuId.EditorContextPeek,
        group: "peek",
        order: 4
      }
    });
  }
}, _f.ID = "editor.action.peekTypeDefinition", _f));
class ImplementationAction extends SymbolNavigationAction {
  async _getLocationModel(languageFeaturesService, model, position, token) {
    return new ReferencesModel(await getImplementationsAtPosition(languageFeaturesService.implementationProvider, model, position, false, token), nls.localize("impl.title", "Implementations"));
  }
  _getNoResultFoundMessage(info) {
    return info && info.word ? nls.localize("goToImplementation.noResultWord", "No implementation found for '{0}'", info.word) : nls.localize("goToImplementation.generic.noResults", "No implementation found");
  }
  _getAlternativeCommand(editor) {
    return editor.getOption(EditorOption.gotoLocation).alternativeImplementationCommand;
  }
  _getGoToPreference(editor) {
    return editor.getOption(EditorOption.gotoLocation).multipleImplementations;
  }
}
registerAction2((_g = class extends ImplementationAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: false,
      muteMessage: false
    }, {
      id: _g.ID,
      title: {
        ...nls.localize2("actions.goToImplementation.label", "Go to Implementations"),
        mnemonicTitle: nls.localize({ key: "miGotoImplementation", comment: ["&& denotes a mnemonic"] }, "Go to &&Implementations")
      },
      precondition: EditorContextKeys.hasImplementationProvider,
      keybinding: {
        when: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyCode.F12,
        weight: KeybindingWeight.EditorContrib
      },
      menu: [{
        id: MenuId.EditorContext,
        group: "navigation",
        order: 1.45
      }, {
        id: MenuId.MenubarGoMenu,
        precondition: null,
        group: "4_symbol_nav",
        order: 4
      }]
    });
  }
}, _g.ID = "editor.action.goToImplementation", _g));
registerAction2((_h = class extends ImplementationAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: true,
      muteMessage: false
    }, {
      id: _h.ID,
      title: nls.localize2("actions.peekImplementation.label", "Peek Implementations"),
      precondition: ContextKeyExpr.and(
        EditorContextKeys.hasImplementationProvider,
        PeekContext.notInPeekEditor,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      ),
      keybinding: {
        when: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.F12,
        weight: KeybindingWeight.EditorContrib
      },
      menu: {
        id: MenuId.EditorContextPeek,
        group: "peek",
        order: 5
      }
    });
  }
}, _h.ID = "editor.action.peekImplementation", _h));
class ReferencesAction extends SymbolNavigationAction {
  _getNoResultFoundMessage(info) {
    return info ? nls.localize("references.no", "No references found for '{0}'", info.word) : nls.localize("references.noGeneric", "No references found");
  }
  _getAlternativeCommand(editor) {
    return editor.getOption(EditorOption.gotoLocation).alternativeReferenceCommand;
  }
  _getGoToPreference(editor) {
    return editor.getOption(EditorOption.gotoLocation).multipleReferences;
  }
}
registerAction2(class GoToReferencesAction extends ReferencesAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: false,
      muteMessage: false
    }, {
      id: "editor.action.goToReferences",
      title: {
        ...nls.localize2("goToReferences.label", "Go to References"),
        mnemonicTitle: nls.localize({ key: "miGotoReference", comment: ["&& denotes a mnemonic"] }, "Go to &&References")
      },
      precondition: ContextKeyExpr.and(
        EditorContextKeys.hasReferenceProvider,
        PeekContext.notInPeekEditor,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      ),
      keybinding: {
        when: EditorContextKeys.editorTextFocus,
        primary: KeyMod.Shift | KeyCode.F12,
        weight: KeybindingWeight.EditorContrib
      },
      menu: [{
        id: MenuId.EditorContext,
        group: "navigation",
        order: 1.45
      }, {
        id: MenuId.MenubarGoMenu,
        precondition: null,
        group: "4_symbol_nav",
        order: 5
      }]
    });
  }
  async _getLocationModel(languageFeaturesService, model, position, token) {
    return new ReferencesModel(await getReferencesAtPosition(languageFeaturesService.referenceProvider, model, position, true, false, token), nls.localize("ref.title", "References"));
  }
});
registerAction2(class PeekReferencesAction extends ReferencesAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: true,
      muteMessage: false
    }, {
      id: "editor.action.referenceSearch.trigger",
      title: nls.localize2("references.action.label", "Peek References"),
      precondition: ContextKeyExpr.and(
        EditorContextKeys.hasReferenceProvider,
        PeekContext.notInPeekEditor,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      ),
      menu: {
        id: MenuId.EditorContextPeek,
        group: "peek",
        order: 6
      }
    });
  }
  async _getLocationModel(languageFeaturesService, model, position, token) {
    return new ReferencesModel(await getReferencesAtPosition(languageFeaturesService.referenceProvider, model, position, false, false, token), nls.localize("ref.title", "References"));
  }
});
class GenericGoToLocationAction extends SymbolNavigationAction {
  constructor(config, _references, _gotoMultipleBehaviour) {
    super(config, {
      id: "editor.action.goToLocation",
      title: nls.localize2("label.generic", "Go to Any Symbol"),
      precondition: ContextKeyExpr.and(
        PeekContext.notInPeekEditor,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      )
    });
    this._references = _references;
    this._gotoMultipleBehaviour = _gotoMultipleBehaviour;
  }
  async _getLocationModel(languageFeaturesService, _model, _position, _token) {
    return new ReferencesModel(this._references, nls.localize("generic.title", "Locations"));
  }
  _getNoResultFoundMessage(info) {
    return info && nls.localize("generic.noResult", "No results for '{0}'", info.word) || "";
  }
  _getGoToPreference(editor) {
    return this._gotoMultipleBehaviour ?? editor.getOption(EditorOption.gotoLocation).multipleReferences;
  }
  _getAlternativeCommand() {
    return void 0;
  }
}
CommandsRegistry.registerCommand({
  id: "editor.action.goToLocations",
  metadata: {
    description: "Go to locations from a position in a file",
    args: [
      { name: "uri", description: "The text document in which to start", constraint: URI },
      { name: "position", description: "The position at which to start", constraint: corePosition.Position.isIPosition },
      { name: "locations", description: "An array of locations.", constraint: Array },
      { name: "multiple", description: "Define what to do when having multiple results, either `peek`, `gotoAndPeek`, or `goto`" },
      { name: "noResultsMessage", description: "Human readable message that shows when locations is empty." }
    ]
  },
  handler: async (accessor, resource, position, references, multiple, noResultsMessage, openInPeek) => {
    assertType(URI.isUri(resource));
    assertType(corePosition.Position.isIPosition(position));
    assertType(Array.isArray(references));
    assertType(typeof multiple === "undefined" || typeof multiple === "string");
    assertType(typeof openInPeek === "undefined" || typeof openInPeek === "boolean");
    const editorService = accessor.get(ICodeEditorService);
    const editor = await editorService.openCodeEditor({ resource }, editorService.getFocusedCodeEditor());
    if (isCodeEditor(editor)) {
      editor.setPosition(position);
      editor.revealPositionInCenterIfOutsideViewport(position, ScrollType.Smooth);
      return editor.invokeWithinContext((accessor2) => {
        const command = new class extends GenericGoToLocationAction {
          _getNoResultFoundMessage(info) {
            return noResultsMessage || super._getNoResultFoundMessage(info);
          }
        }({
          muteMessage: !Boolean(noResultsMessage),
          openInPeek: Boolean(openInPeek),
          openToSide: false
        }, references, multiple);
        accessor2.get(IInstantiationService).invokeFunction(command.run.bind(command), editor);
      });
    }
  }
});
CommandsRegistry.registerCommand({
  id: "editor.action.peekLocations",
  metadata: {
    description: "Peek locations from a position in a file",
    args: [
      { name: "uri", description: "The text document in which to start", constraint: URI },
      { name: "position", description: "The position at which to start", constraint: corePosition.Position.isIPosition },
      { name: "locations", description: "An array of locations.", constraint: Array },
      { name: "multiple", description: "Define what to do when having multiple results, either `peek`, `gotoAndPeek`, or `goto`" }
    ]
  },
  handler: async (accessor, resource, position, references, multiple) => {
    accessor.get(ICommandService).executeCommand("editor.action.goToLocations", resource, position, references, multiple, void 0, true);
  }
});
CommandsRegistry.registerCommand({
  id: "editor.action.findReferences",
  handler: (accessor, resource, position) => {
    assertType(URI.isUri(resource));
    assertType(corePosition.Position.isIPosition(position));
    const languageFeaturesService = accessor.get(ILanguageFeaturesService);
    const codeEditorService = accessor.get(ICodeEditorService);
    return codeEditorService.openCodeEditor({ resource }, codeEditorService.getFocusedCodeEditor()).then((control) => {
      if (!isCodeEditor(control) || !control.hasModel()) {
        return void 0;
      }
      const controller = ReferencesController.get(control);
      if (!controller) {
        return void 0;
      }
      const references = createCancelablePromise((token) => getReferencesAtPosition(languageFeaturesService.referenceProvider, control.getModel(), corePosition.Position.lift(position), false, false, token).then((references2) => new ReferencesModel(references2, nls.localize("ref.title", "References"))));
      const range = new Range(position.lineNumber, position.column, position.lineNumber, position.column);
      return Promise.resolve(controller.toggleWidget(range, references, false));
    });
  }
});
CommandsRegistry.registerCommandAlias("editor.action.showReferences", "editor.action.peekLocations");
export {
  DefinitionAction,
  SymbolNavigationAction,
  SymbolNavigationAnchor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9nb3RvU3ltYm9sL2Jyb3dzZXIvZ29Ub0NvbW1hbmRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYWxlcnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYXJpYS9hcmlhLmpzJztcbmltcG9ydCB7IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlLCByYWNlQ2FuY2VsbGF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5Q2hvcmQsIEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IGFzc2VydFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvclN0YXRlRmxhZywgRWRpdG9yU3RhdGVDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uL2VkaXRvclN0YXRlL2Jyb3dzZXIvZWRpdG9yU3RhdGUuanMnO1xuaW1wb3J0IHsgSUFjdGl2ZUNvZGVFZGl0b3IsIElDb2RlRWRpdG9yLCBpc0NvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQWN0aW9uMiwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVtYmVkZGVkQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvZW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiwgR29Ub0xvY2F0aW9uVmFsdWVzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCAqIGFzIGNvcmVQb3NpdGlvbiBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2Nyb2xsVHlwZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBpc0xvY2F0aW9uTGluaywgTG9jYXRpb24sIExvY2F0aW9uTGluayB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgUmVmZXJlbmNlc0NvbnRyb2xsZXIgfSBmcm9tICcuL3BlZWsvcmVmZXJlbmNlc0NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgUmVmZXJlbmNlc01vZGVsIH0gZnJvbSAnLi9yZWZlcmVuY2VzTW9kZWwuanMnO1xuaW1wb3J0IHsgSVN5bWJvbE5hdmlnYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi9zeW1ib2xOYXZpZ2F0aW9uLmpzJztcbmltcG9ydCB7IE1lc3NhZ2VDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vbWVzc2FnZS9icm93c2VyL21lc3NhZ2VDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IFBlZWtDb250ZXh0IH0gZnJvbSAnLi4vLi4vcGVla1ZpZXcvYnJvd3Nlci9wZWVrVmlldy5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElBY3Rpb24yRjFSZXF1aXJlZE9wdGlvbnMsIElBY3Rpb24yT3B0aW9ucywgSVN1Ym1lbnVJdGVtLCBNZW51SWQsIE1lbnVSZWdpc3RyeSwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5LCBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFRleHRFZGl0b3JTZWxlY3Rpb25SZXZlYWxUeXBlLCBUZXh0RWRpdG9yU2VsZWN0aW9uU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JQcm9ncmVzc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgZ2V0RGVjbGFyYXRpb25zQXRQb3NpdGlvbiwgZ2V0RGVmaW5pdGlvbnNBdFBvc2l0aW9uLCBnZXRJbXBsZW1lbnRhdGlvbnNBdFBvc2l0aW9uLCBnZXRSZWZlcmVuY2VzQXRQb3NpdGlvbiwgZ2V0VHlwZURlZmluaXRpb25zQXRQb3NpdGlvbiB9IGZyb20gJy4vZ29Ub1N5bWJvbC5qcyc7XG5pbXBvcnQgeyBJV29yZEF0UG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS93b3JkSGVscGVyLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgSXNXZWJDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleXMuanMnO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvckNvbnRleHQsIHtcblx0c3VibWVudTogTWVudUlkLkVkaXRvckNvbnRleHRQZWVrLFxuXHR0aXRsZTogbmxzLmxvY2FsaXplKCdwZWVrLnN1Ym1lbnUnLCBcIlBlZWtcIiksXG5cdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdG9yZGVyOiAxMDBcbn0gc2F0aXNmaWVzIElTdWJtZW51SXRlbSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3ltYm9sTmF2aWdhdGlvbkFjdGlvbkNvbmZpZyB7XG5cdG9wZW5Ub1NpZGU6IGJvb2xlYW47XG5cdG9wZW5JblBlZWs6IGJvb2xlYW47XG5cdG11dGVNZXNzYWdlOiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgU3ltYm9sTmF2aWdhdGlvbkFuY2hvciB7XG5cblx0c3RhdGljIGlzKHRoaW5nOiBhbnkpOiB0aGluZyBpcyBTeW1ib2xOYXZpZ2F0aW9uQW5jaG9yIHtcblx0XHRpZiAoIXRoaW5nIHx8IHR5cGVvZiB0aGluZyAhPT0gJ29iamVjdCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKHRoaW5nIGluc3RhbmNlb2YgU3ltYm9sTmF2aWdhdGlvbkFuY2hvcikge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmIChjb3JlUG9zaXRpb24uUG9zaXRpb24uaXNJUG9zaXRpb24oKDxTeW1ib2xOYXZpZ2F0aW9uQW5jaG9yPnRoaW5nKS5wb3NpdGlvbikgJiYgKDxTeW1ib2xOYXZpZ2F0aW9uQW5jaG9yPnRoaW5nKS5tb2RlbCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IG1vZGVsOiBJVGV4dE1vZGVsLCByZWFkb25seSBwb3NpdGlvbjogY29yZVBvc2l0aW9uLlBvc2l0aW9uKSB7IH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFN5bWJvbE5hdmlnYXRpb25BY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24yIHtcblxuXHRwcml2YXRlIHN0YXRpYyBfYWxsU3ltYm9sTmF2aWdhdGlvbkNvbW1hbmRzID0gbmV3IE1hcDxzdHJpbmcsIFN5bWJvbE5hdmlnYXRpb25BY3Rpb24+KCk7XG5cdHByaXZhdGUgc3RhdGljIF9hY3RpdmVBbHRlcm5hdGl2ZUNvbW1hbmRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0c3RhdGljIGFsbCgpOiBJdGVyYWJsZUl0ZXJhdG9yPFN5bWJvbE5hdmlnYXRpb25BY3Rpb24+IHtcblx0XHRyZXR1cm4gU3ltYm9sTmF2aWdhdGlvbkFjdGlvbi5fYWxsU3ltYm9sTmF2aWdhdGlvbkNvbW1hbmRzLnZhbHVlcygpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3BhdGNoQ29uZmlnKG9wdHM6IElBY3Rpb24yT3B0aW9ucyAmIElBY3Rpb24yRjFSZXF1aXJlZE9wdGlvbnMpOiBJQWN0aW9uMk9wdGlvbnMge1xuXHRcdGNvbnN0IHJlc3VsdCA9IHsgLi4ub3B0cywgZjE6IHRydWUgfTtcblx0XHQvLyBwYXRjaCBjb250ZXh0IG1lbnUgd2hlbiBjbGF1c2Vcblx0XHRpZiAocmVzdWx0Lm1lbnUpIHtcblx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiBJdGVyYWJsZS53cmFwKHJlc3VsdC5tZW51KSkge1xuXHRcdFx0XHRpZiAoaXRlbS5pZCA9PT0gTWVudUlkLkVkaXRvckNvbnRleHQgfHwgaXRlbS5pZCA9PT0gTWVudUlkLkVkaXRvckNvbnRleHRQZWVrKSB7XG5cdFx0XHRcdFx0aXRlbS53aGVuID0gQ29udGV4dEtleUV4cHIuYW5kKG9wdHMucHJlY29uZGl0aW9uLCBpdGVtLndoZW4pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiA8dHlwZW9mIG9wdHM+cmVzdWx0O1xuXHR9XG5cblx0cmVhZG9ubHkgY29uZmlndXJhdGlvbjogU3ltYm9sTmF2aWdhdGlvbkFjdGlvbkNvbmZpZztcblxuXHRjb25zdHJ1Y3Rvcihjb25maWd1cmF0aW9uOiBTeW1ib2xOYXZpZ2F0aW9uQWN0aW9uQ29uZmlnLCBvcHRzOiBJQWN0aW9uMk9wdGlvbnMgJiBJQWN0aW9uMkYxUmVxdWlyZWRPcHRpb25zKSB7XG5cdFx0c3VwZXIoU3ltYm9sTmF2aWdhdGlvbkFjdGlvbi5fcGF0Y2hDb25maWcob3B0cykpO1xuXHRcdHRoaXMuY29uZmlndXJhdGlvbiA9IGNvbmZpZ3VyYXRpb247XG5cdFx0U3ltYm9sTmF2aWdhdGlvbkFjdGlvbi5fYWxsU3ltYm9sTmF2aWdhdGlvbkNvbW1hbmRzLnNldChvcHRzLmlkLCB0aGlzKTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZz86IFN5bWJvbE5hdmlnYXRpb25BbmNob3IgfCB1bmtub3duLCByYW5nZT86IFJhbmdlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdH1cblx0XHRjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RpZmljYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb2RlRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgcHJvZ3Jlc3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JQcm9ncmVzc1NlcnZpY2UpO1xuXHRcdGNvbnN0IHN5bWJvbE5hdlNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVN5bWJvbE5hdmlnYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGluc3RhU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRjb25zdCBwb3NpdGlvbiA9IGVkaXRvci5nZXRQb3NpdGlvbigpO1xuXHRcdGNvbnN0IGFuY2hvciA9IFN5bWJvbE5hdmlnYXRpb25BbmNob3IuaXMoYXJnKSA/IGFyZyA6IG5ldyBTeW1ib2xOYXZpZ2F0aW9uQW5jaG9yKG1vZGVsLCBwb3NpdGlvbik7XG5cblx0XHRjb25zdCBjdHMgPSBuZXcgRWRpdG9yU3RhdGVDYW5jZWxsYXRpb25Ub2tlblNvdXJjZShlZGl0b3IsIENvZGVFZGl0b3JTdGF0ZUZsYWcuVmFsdWUgfCBDb2RlRWRpdG9yU3RhdGVGbGFnLlBvc2l0aW9uKTtcblxuXHRcdGNvbnN0IHByb21pc2UgPSByYWNlQ2FuY2VsbGF0aW9uKHRoaXMuX2dldExvY2F0aW9uTW9kZWwobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsIGFuY2hvci5tb2RlbCwgYW5jaG9yLnBvc2l0aW9uLCBjdHMudG9rZW4pLCBjdHMudG9rZW4pLnRoZW4oYXN5bmMgcmVmZXJlbmNlcyA9PiB7XG5cblx0XHRcdGlmICghcmVmZXJlbmNlcyB8fCBjdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRhbGVydChyZWZlcmVuY2VzLmFyaWFNZXNzYWdlKTtcblxuXHRcdFx0bGV0IGFsdEFjdGlvbjogU3ltYm9sTmF2aWdhdGlvbkFjdGlvbiB8IG51bGwgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAocmVmZXJlbmNlcy5yZWZlcmVuY2VBdChtb2RlbC51cmksIHBvc2l0aW9uKSkge1xuXHRcdFx0XHRjb25zdCBhbHRBY3Rpb25JZCA9IHRoaXMuX2dldEFsdGVybmF0aXZlQ29tbWFuZChlZGl0b3IpO1xuXHRcdFx0XHRpZiAoYWx0QWN0aW9uSWQgIT09IHVuZGVmaW5lZCAmJiAhU3ltYm9sTmF2aWdhdGlvbkFjdGlvbi5fYWN0aXZlQWx0ZXJuYXRpdmVDb21tYW5kcy5oYXMoYWx0QWN0aW9uSWQpICYmIFN5bWJvbE5hdmlnYXRpb25BY3Rpb24uX2FsbFN5bWJvbE5hdmlnYXRpb25Db21tYW5kcy5oYXMoYWx0QWN0aW9uSWQpKSB7XG5cdFx0XHRcdFx0YWx0QWN0aW9uID0gU3ltYm9sTmF2aWdhdGlvbkFjdGlvbi5fYWxsU3ltYm9sTmF2aWdhdGlvbkNvbW1hbmRzLmdldChhbHRBY3Rpb25JZCkhO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlZmVyZW5jZUNvdW50ID0gcmVmZXJlbmNlcy5yZWZlcmVuY2VzLmxlbmd0aDtcblxuXHRcdFx0aWYgKHJlZmVyZW5jZUNvdW50ID09PSAwKSB7XG5cdFx0XHRcdC8vIG5vIHJlc3VsdCAtPiBzaG93IG1lc3NhZ2Vcblx0XHRcdFx0aWYgKCF0aGlzLmNvbmZpZ3VyYXRpb24ubXV0ZU1lc3NhZ2UpIHtcblx0XHRcdFx0XHRjb25zdCBpbmZvID0gbW9kZWwuZ2V0V29yZEF0UG9zaXRpb24ocG9zaXRpb24pO1xuXHRcdFx0XHRcdE1lc3NhZ2VDb250cm9sbGVyLmdldChlZGl0b3IpPy5zaG93TWVzc2FnZSh0aGlzLl9nZXROb1Jlc3VsdEZvdW5kTWVzc2FnZShpbmZvKSwgcG9zaXRpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHJlZmVyZW5jZUNvdW50ID09PSAxICYmIGFsdEFjdGlvbikge1xuXHRcdFx0XHQvLyBhbHJlYWR5IGF0IHRoZSBvbmx5IHJlc3VsdCwgcnVuIGFsdGVybmF0aXZlXG5cdFx0XHRcdFN5bWJvbE5hdmlnYXRpb25BY3Rpb24uX2FjdGl2ZUFsdGVybmF0aXZlQ29tbWFuZHMuYWRkKHRoaXMuZGVzYy5pZCk7XG5cdFx0XHRcdGluc3RhU2VydmljZS5pbnZva2VGdW5jdGlvbigoYWNjZXNzb3IpID0+IGFsdEFjdGlvbi5ydW5FZGl0b3JDb21tYW5kKGFjY2Vzc29yLCBlZGl0b3IsIGFyZywgcmFuZ2UpLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0XHRcdFN5bWJvbE5hdmlnYXRpb25BY3Rpb24uX2FjdGl2ZUFsdGVybmF0aXZlQ29tbWFuZHMuZGVsZXRlKHRoaXMuZGVzYy5pZCk7XG5cdFx0XHRcdH0pKTtcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gbm9ybWFsIHJlc3VsdHMgaGFuZGxpbmdcblx0XHRcdFx0cmV0dXJuIHRoaXMuX29uUmVzdWx0KGVkaXRvclNlcnZpY2UsIHN5bWJvbE5hdlNlcnZpY2UsIGVkaXRvciwgcmVmZXJlbmNlcywgcmFuZ2UpO1xuXHRcdFx0fVxuXG5cdFx0fSwgKGVycikgPT4ge1xuXHRcdFx0Ly8gcmVwb3J0IGFuIGVycm9yXG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0fSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRjdHMuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0cHJvZ3Jlc3NTZXJ2aWNlLnNob3dXaGlsZShwcm9taXNlLCAyNTApO1xuXHRcdHJldHVybiBwcm9taXNlO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IF9nZXRMb2NhdGlvbk1vZGVsKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsIG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogY29yZVBvc2l0aW9uLlBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFJlZmVyZW5jZXNNb2RlbCB8IHVuZGVmaW5lZD47XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IF9nZXROb1Jlc3VsdEZvdW5kTWVzc2FnZShpbmZvOiBJV29yZEF0UG9zaXRpb24gfCBudWxsKTogc3RyaW5nO1xuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBfZ2V0QWx0ZXJuYXRpdmVDb21tYW5kKGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IF9nZXRHb1RvUHJlZmVyZW5jZShlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yKTogR29Ub0xvY2F0aW9uVmFsdWVzO1xuXG5cdHByaXZhdGUgYXN5bmMgX29uUmVzdWx0KGVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSwgc3ltYm9sTmF2U2VydmljZTogSVN5bWJvbE5hdmlnYXRpb25TZXJ2aWNlLCBlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yLCBtb2RlbDogUmVmZXJlbmNlc01vZGVsLCByYW5nZT86IFJhbmdlKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHRjb25zdCBnb3RvTG9jYXRpb24gPSB0aGlzLl9nZXRHb1RvUHJlZmVyZW5jZShlZGl0b3IpO1xuXHRcdGlmICghKGVkaXRvciBpbnN0YW5jZW9mIEVtYmVkZGVkQ29kZUVkaXRvcldpZGdldCkgJiYgKHRoaXMuY29uZmlndXJhdGlvbi5vcGVuSW5QZWVrIHx8IChnb3RvTG9jYXRpb24gPT09ICdwZWVrJyAmJiBtb2RlbC5yZWZlcmVuY2VzLmxlbmd0aCA+IDEpKSkge1xuXHRcdFx0dGhpcy5fb3BlbkluUGVlayhlZGl0b3IsIG1vZGVsLCByYW5nZSk7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbmV4dCA9IG1vZGVsLmZpcnN0UmVmZXJlbmNlKCkhO1xuXHRcdFx0Y29uc3QgcGVlayA9IG1vZGVsLnJlZmVyZW5jZXMubGVuZ3RoID4gMSAmJiBnb3RvTG9jYXRpb24gPT09ICdnb3RvQW5kUGVlayc7XG5cdFx0XHRjb25zdCB0YXJnZXRFZGl0b3IgPSBhd2FpdCB0aGlzLl9vcGVuUmVmZXJlbmNlKGVkaXRvciwgZWRpdG9yU2VydmljZSwgbmV4dCwgdGhpcy5jb25maWd1cmF0aW9uLm9wZW5Ub1NpZGUsICFwZWVrKTtcblx0XHRcdGlmIChwZWVrICYmIHRhcmdldEVkaXRvcikge1xuXHRcdFx0XHR0aGlzLl9vcGVuSW5QZWVrKHRhcmdldEVkaXRvciwgbW9kZWwsIHJhbmdlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8ga2VlcCByZW1haW5pbmcgbG9jYXRpb25zIGFyb3VuZCB3aGVuIHVzaW5nXG5cdFx0XHQvLyAnZ290byctbW9kZVxuXHRcdFx0aWYgKGdvdG9Mb2NhdGlvbiA9PT0gJ2dvdG8nKSB7XG5cdFx0XHRcdHN5bWJvbE5hdlNlcnZpY2UucHV0KG5leHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX29wZW5SZWZlcmVuY2UoZWRpdG9yOiBJQ29kZUVkaXRvciwgZWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLCByZWZlcmVuY2U6IExvY2F0aW9uIHwgTG9jYXRpb25MaW5rLCBzaWRlQnlTaWRlOiBib29sZWFuLCBoaWdobGlnaHQ6IGJvb2xlYW4pOiBQcm9taXNlPElDb2RlRWRpdG9yIHwgdW5kZWZpbmVkPiB7XG5cdFx0Ly8gcmFuZ2UgaXMgdGhlIHRhcmdldC1zZWxlY3Rpb24tcmFuZ2Ugd2hlbiB3ZSBoYXZlIG9uZVxuXHRcdC8vIGFuZCB0aGUgZmFsbGJhY2sgaXMgdGhlICdmdWxsJyByYW5nZVxuXHRcdGxldCByYW5nZTogSVJhbmdlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmIChpc0xvY2F0aW9uTGluayhyZWZlcmVuY2UpKSB7XG5cdFx0XHRyYW5nZSA9IHJlZmVyZW5jZS50YXJnZXRTZWxlY3Rpb25SYW5nZTtcblx0XHR9XG5cdFx0aWYgKCFyYW5nZSkge1xuXHRcdFx0cmFuZ2UgPSByZWZlcmVuY2UucmFuZ2U7XG5cdFx0fVxuXHRcdGlmICghcmFuZ2UpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGFyZ2V0RWRpdG9yID0gYXdhaXQgZWRpdG9yU2VydmljZS5vcGVuQ29kZUVkaXRvcih7XG5cdFx0XHRyZXNvdXJjZTogcmVmZXJlbmNlLnVyaSxcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0c2VsZWN0aW9uOiBSYW5nZS5jb2xsYXBzZVRvU3RhcnQocmFuZ2UpLFxuXHRcdFx0XHRzZWxlY3Rpb25SZXZlYWxUeXBlOiBUZXh0RWRpdG9yU2VsZWN0aW9uUmV2ZWFsVHlwZS5OZWFyVG9wSWZPdXRzaWRlVmlld3BvcnQsXG5cdFx0XHRcdHNlbGVjdGlvblNvdXJjZTogVGV4dEVkaXRvclNlbGVjdGlvblNvdXJjZS5KVU1QXG5cdFx0XHR9XG5cdFx0fSwgZWRpdG9yLCBzaWRlQnlTaWRlKTtcblxuXHRcdGlmICghdGFyZ2V0RWRpdG9yKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmIChoaWdobGlnaHQpIHtcblx0XHRcdGNvbnN0IG1vZGVsTm93ID0gdGFyZ2V0RWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRjb25zdCBkZWNvcmF0aW9ucyA9IHRhcmdldEVkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oW3sgcmFuZ2UsIG9wdGlvbnM6IHsgZGVzY3JpcHRpb246ICdzeW1ib2wtbmF2aWdhdGUtYWN0aW9uLWhpZ2hsaWdodCcsIGNsYXNzTmFtZTogJ3N5bWJvbEhpZ2hsaWdodCcgfSB9XSk7XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0aWYgKHRhcmdldEVkaXRvci5nZXRNb2RlbCgpID09PSBtb2RlbE5vdykge1xuXHRcdFx0XHRcdGRlY29yYXRpb25zLmNsZWFyKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDM1MCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRhcmdldEVkaXRvcjtcblx0fVxuXG5cdHByaXZhdGUgX29wZW5JblBlZWsodGFyZ2V0OiBJQ29kZUVkaXRvciwgbW9kZWw6IFJlZmVyZW5jZXNNb2RlbCwgcmFuZ2U/OiBSYW5nZSkge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBSZWZlcmVuY2VzQ29udHJvbGxlci5nZXQodGFyZ2V0KTtcblx0XHRpZiAoY29udHJvbGxlciAmJiB0YXJnZXQuaGFzTW9kZWwoKSkge1xuXHRcdFx0Y29udHJvbGxlci50b2dnbGVXaWRnZXQocmFuZ2UgPz8gdGFyZ2V0LmdldFNlbGVjdGlvbigpLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZShfID0+IFByb21pc2UucmVzb2x2ZShtb2RlbCkpLCB0aGlzLmNvbmZpZ3VyYXRpb24ub3BlbkluUGVlayk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH1cbn1cblxuLy8jcmVnaW9uIC0tLSBERUZJTklUSU9OXG5cbmV4cG9ydCBjbGFzcyBEZWZpbml0aW9uQWN0aW9uIGV4dGVuZHMgU3ltYm9sTmF2aWdhdGlvbkFjdGlvbiB7XG5cblx0cHJvdGVjdGVkIGFzeW5jIF9nZXRMb2NhdGlvbk1vZGVsKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsIG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogY29yZVBvc2l0aW9uLlBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFJlZmVyZW5jZXNNb2RlbD4ge1xuXHRcdHJldHVybiBuZXcgUmVmZXJlbmNlc01vZGVsKGF3YWl0IGdldERlZmluaXRpb25zQXRQb3NpdGlvbihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kZWZpbml0aW9uUHJvdmlkZXIsIG1vZGVsLCBwb3NpdGlvbiwgZmFsc2UsIHRva2VuKSwgbmxzLmxvY2FsaXplKCdkZWYudGl0bGUnLCAnRGVmaW5pdGlvbnMnKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldE5vUmVzdWx0Rm91bmRNZXNzYWdlKGluZm86IElXb3JkQXRQb3NpdGlvbiB8IG51bGwpOiBzdHJpbmcge1xuXHRcdHJldHVybiBpbmZvICYmIGluZm8ud29yZFxuXHRcdFx0PyBubHMubG9jYWxpemUoJ25vUmVzdWx0V29yZCcsIFwiTm8gZGVmaW5pdGlvbiBmb3VuZCBmb3IgJ3swfSdcIiwgaW5mby53b3JkKVxuXHRcdFx0OiBubHMubG9jYWxpemUoJ2dlbmVyaWMubm9SZXN1bHRzJywgXCJObyBkZWZpbml0aW9uIGZvdW5kXCIpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRBbHRlcm5hdGl2ZUNvbW1hbmQoZWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvcik6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmdvdG9Mb2NhdGlvbikuYWx0ZXJuYXRpdmVEZWZpbml0aW9uQ29tbWFuZDtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0R29Ub1ByZWZlcmVuY2UoZWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvcik6IEdvVG9Mb2NhdGlvblZhbHVlcyB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmdvdG9Mb2NhdGlvbikubXVsdGlwbGVEZWZpbml0aW9ucztcblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgR29Ub0RlZmluaXRpb25BY3Rpb24gZXh0ZW5kcyBEZWZpbml0aW9uQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgaWQgPSAnZWRpdG9yLmFjdGlvbi5yZXZlYWxEZWZpbml0aW9uJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRvcGVuVG9TaWRlOiBmYWxzZSxcblx0XHRcdG9wZW5JblBlZWs6IGZhbHNlLFxuXHRcdFx0bXV0ZU1lc3NhZ2U6IGZhbHNlXG5cdFx0fSwge1xuXHRcdFx0aWQ6IEdvVG9EZWZpbml0aW9uQWN0aW9uLmlkLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubmxzLmxvY2FsaXplMignYWN0aW9ucy5nb1RvRGVjbC5sYWJlbCcsIFwiR28gdG8gRGVmaW5pdGlvblwiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbmxzLmxvY2FsaXplKHsga2V5OiAnbWlHb3RvRGVmaW5pdGlvbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJHbyB0byAmJkRlZmluaXRpb25cIiksXG5cdFx0XHR9LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy5oYXNEZWZpbml0aW9uUHJvdmlkZXIsXG5cdFx0XHRrZXliaW5kaW5nOiBbe1xuXHRcdFx0XHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRjEyLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSwge1xuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLCBJc1dlYkNvbnRleHQpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRjEyLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fV0sXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAxLjFcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyR29NZW51LFxuXHRcdFx0XHRwcmVjb25kaXRpb246IG51bGwsXG5cdFx0XHRcdGdyb3VwOiAnNF9zeW1ib2xfbmF2Jyxcblx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQWxpYXMoJ2VkaXRvci5hY3Rpb24uZ29Ub0RlY2xhcmF0aW9uJywgR29Ub0RlZmluaXRpb25BY3Rpb24uaWQpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIE9wZW5EZWZpbml0aW9uVG9TaWRlQWN0aW9uIGV4dGVuZHMgRGVmaW5pdGlvbkFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IGlkID0gJ2VkaXRvci5hY3Rpb24ucmV2ZWFsRGVmaW5pdGlvbkFzaWRlJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRvcGVuVG9TaWRlOiB0cnVlLFxuXHRcdFx0b3BlbkluUGVlazogZmFsc2UsXG5cdFx0XHRtdXRlTWVzc2FnZTogZmFsc2Vcblx0XHR9LCB7XG5cdFx0XHRpZDogT3BlbkRlZmluaXRpb25Ub1NpZGVBY3Rpb24uaWQsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignYWN0aW9ucy5nb1RvRGVjbFRvU2lkZS5sYWJlbCcsIFwiT3BlbiBEZWZpbml0aW9uIHRvIHRoZSBTaWRlXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmhhc0RlZmluaXRpb25Qcm92aWRlcixcblx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMuaXNJbkVtYmVkZGVkRWRpdG9yLnRvTmVnYXRlZCgpKSxcblx0XHRcdGtleWJpbmRpbmc6IFt7XG5cdFx0XHRcdHdoZW46IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleUNvZGUuRjEyKSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH0sIHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cywgSXNXZWJDb250ZXh0KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5GMTIpLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fV1cblx0XHR9KTtcblx0XHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFsaWFzKCdlZGl0b3IuYWN0aW9uLm9wZW5EZWNsYXJhdGlvblRvVGhlU2lkZScsIE9wZW5EZWZpbml0aW9uVG9TaWRlQWN0aW9uLmlkKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBQZWVrRGVmaW5pdGlvbkFjdGlvbiBleHRlbmRzIERlZmluaXRpb25BY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBpZCA9ICdlZGl0b3IuYWN0aW9uLnBlZWtEZWZpbml0aW9uJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRvcGVuVG9TaWRlOiBmYWxzZSxcblx0XHRcdG9wZW5JblBlZWs6IHRydWUsXG5cdFx0XHRtdXRlTWVzc2FnZTogZmFsc2Vcblx0XHR9LCB7XG5cdFx0XHRpZDogUGVla0RlZmluaXRpb25BY3Rpb24uaWQsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignYWN0aW9ucy5wcmV2aWV3RGVjbC5sYWJlbCcsIFwiUGVlayBEZWZpbml0aW9uXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmhhc0RlZmluaXRpb25Qcm92aWRlcixcblx0XHRcdFx0UGVla0NvbnRleHQubm90SW5QZWVrRWRpdG9yLFxuXHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5pc0luRW1iZWRkZWRFZGl0b3IudG9OZWdhdGVkKClcblx0XHRcdCksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdoZW46IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuRjEyLFxuXHRcdFx0XHRsaW51eDogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRjEwIH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRleHRQZWVrLFxuXHRcdFx0XHRncm91cDogJ3BlZWsnLFxuXHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQWxpYXMoJ2VkaXRvci5hY3Rpb24ucHJldmlld0RlY2xhcmF0aW9uJywgUGVla0RlZmluaXRpb25BY3Rpb24uaWQpO1xuXHR9XG59KTtcblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiAtLS0gREVDTEFSQVRJT05cblxuY2xhc3MgRGVjbGFyYXRpb25BY3Rpb24gZXh0ZW5kcyBTeW1ib2xOYXZpZ2F0aW9uQWN0aW9uIHtcblxuXHRwcm90ZWN0ZWQgYXN5bmMgX2dldExvY2F0aW9uTW9kZWwobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSwgbW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBjb3JlUG9zaXRpb24uUG9zaXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8UmVmZXJlbmNlc01vZGVsPiB7XG5cdFx0cmV0dXJuIG5ldyBSZWZlcmVuY2VzTW9kZWwoYXdhaXQgZ2V0RGVjbGFyYXRpb25zQXRQb3NpdGlvbihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kZWNsYXJhdGlvblByb3ZpZGVyLCBtb2RlbCwgcG9zaXRpb24sIGZhbHNlLCB0b2tlbiksIG5scy5sb2NhbGl6ZSgnZGVjbC50aXRsZScsICdEZWNsYXJhdGlvbnMnKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldE5vUmVzdWx0Rm91bmRNZXNzYWdlKGluZm86IElXb3JkQXRQb3NpdGlvbiB8IG51bGwpOiBzdHJpbmcge1xuXHRcdHJldHVybiBpbmZvICYmIGluZm8ud29yZFxuXHRcdFx0PyBubHMubG9jYWxpemUoJ2RlY2wubm9SZXN1bHRXb3JkJywgXCJObyBkZWNsYXJhdGlvbiBmb3VuZCBmb3IgJ3swfSdcIiwgaW5mby53b3JkKVxuXHRcdFx0OiBubHMubG9jYWxpemUoJ2RlY2wuZ2VuZXJpYy5ub1Jlc3VsdHMnLCBcIk5vIGRlY2xhcmF0aW9uIGZvdW5kXCIpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRBbHRlcm5hdGl2ZUNvbW1hbmQoZWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvcik6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmdvdG9Mb2NhdGlvbikuYWx0ZXJuYXRpdmVEZWNsYXJhdGlvbkNvbW1hbmQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldEdvVG9QcmVmZXJlbmNlKGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IpOiBHb1RvTG9jYXRpb25WYWx1ZXMge1xuXHRcdHJldHVybiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5nb3RvTG9jYXRpb24pLm11bHRpcGxlRGVjbGFyYXRpb25zO1xuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBHb1RvRGVjbGFyYXRpb25BY3Rpb24gZXh0ZW5kcyBEZWNsYXJhdGlvbkFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IGlkID0gJ2VkaXRvci5hY3Rpb24ucmV2ZWFsRGVjbGFyYXRpb24nO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdG9wZW5Ub1NpZGU6IGZhbHNlLFxuXHRcdFx0b3BlbkluUGVlazogZmFsc2UsXG5cdFx0XHRtdXRlTWVzc2FnZTogZmFsc2Vcblx0XHR9LCB7XG5cdFx0XHRpZDogR29Ub0RlY2xhcmF0aW9uQWN0aW9uLmlkLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubmxzLmxvY2FsaXplMignYWN0aW9ucy5nb1RvRGVjbGFyYXRpb24ubGFiZWwnLCBcIkdvIHRvIERlY2xhcmF0aW9uXCIpLFxuXHRcdFx0XHRtbmVtb25pY1RpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUdvdG9EZWNsYXJhdGlvbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJHbyB0byAmJkRlY2xhcmF0aW9uXCIpLFxuXHRcdFx0fSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5oYXNEZWNsYXJhdGlvblByb3ZpZGVyLFxuXHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5pc0luRW1iZWRkZWRFZGl0b3IudG9OZWdhdGVkKClcblx0XHRcdCksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAxLjNcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyR29NZW51LFxuXHRcdFx0XHRwcmVjb25kaXRpb246IG51bGwsXG5cdFx0XHRcdGdyb3VwOiAnNF9zeW1ib2xfbmF2Jyxcblx0XHRcdFx0b3JkZXI6IDMsXG5cdFx0XHR9XSxcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfZ2V0Tm9SZXN1bHRGb3VuZE1lc3NhZ2UoaW5mbzogSVdvcmRBdFBvc2l0aW9uIHwgbnVsbCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGluZm8gJiYgaW5mby53b3JkXG5cdFx0XHQ/IG5scy5sb2NhbGl6ZSgnZGVjbC5ub1Jlc3VsdFdvcmQnLCBcIk5vIGRlY2xhcmF0aW9uIGZvdW5kIGZvciAnezB9J1wiLCBpbmZvLndvcmQpXG5cdFx0XHQ6IG5scy5sb2NhbGl6ZSgnZGVjbC5nZW5lcmljLm5vUmVzdWx0cycsIFwiTm8gZGVjbGFyYXRpb24gZm91bmRcIik7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUGVla0RlY2xhcmF0aW9uQWN0aW9uIGV4dGVuZHMgRGVjbGFyYXRpb25BY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRvcGVuVG9TaWRlOiBmYWxzZSxcblx0XHRcdG9wZW5JblBlZWs6IHRydWUsXG5cdFx0XHRtdXRlTWVzc2FnZTogZmFsc2Vcblx0XHR9LCB7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24ucGVla0RlY2xhcmF0aW9uJyxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdhY3Rpb25zLnBlZWtEZWNsLmxhYmVsJywgXCJQZWVrIERlY2xhcmF0aW9uXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmhhc0RlY2xhcmF0aW9uUHJvdmlkZXIsXG5cdFx0XHRcdFBlZWtDb250ZXh0Lm5vdEluUGVla0VkaXRvcixcblx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMuaXNJbkVtYmVkZGVkRWRpdG9yLnRvTmVnYXRlZCgpXG5cdFx0XHQpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRleHRQZWVrLFxuXHRcdFx0XHRncm91cDogJ3BlZWsnLFxuXHRcdFx0XHRvcmRlcjogM1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59KTtcblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiAtLS0gVFlQRSBERUZJTklUSU9OXG5cbmNsYXNzIFR5cGVEZWZpbml0aW9uQWN0aW9uIGV4dGVuZHMgU3ltYm9sTmF2aWdhdGlvbkFjdGlvbiB7XG5cblx0cHJvdGVjdGVkIGFzeW5jIF9nZXRMb2NhdGlvbk1vZGVsKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsIG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogY29yZVBvc2l0aW9uLlBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFJlZmVyZW5jZXNNb2RlbD4ge1xuXHRcdHJldHVybiBuZXcgUmVmZXJlbmNlc01vZGVsKGF3YWl0IGdldFR5cGVEZWZpbml0aW9uc0F0UG9zaXRpb24obGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UudHlwZURlZmluaXRpb25Qcm92aWRlciwgbW9kZWwsIHBvc2l0aW9uLCBmYWxzZSwgdG9rZW4pLCBubHMubG9jYWxpemUoJ3R5cGVkZWYudGl0bGUnLCAnVHlwZSBEZWZpbml0aW9ucycpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0Tm9SZXN1bHRGb3VuZE1lc3NhZ2UoaW5mbzogSVdvcmRBdFBvc2l0aW9uIHwgbnVsbCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGluZm8gJiYgaW5mby53b3JkXG5cdFx0XHQ/IG5scy5sb2NhbGl6ZSgnZ29Ub1R5cGVEZWZpbml0aW9uLm5vUmVzdWx0V29yZCcsIFwiTm8gdHlwZSBkZWZpbml0aW9uIGZvdW5kIGZvciAnezB9J1wiLCBpbmZvLndvcmQpXG5cdFx0XHQ6IG5scy5sb2NhbGl6ZSgnZ29Ub1R5cGVEZWZpbml0aW9uLmdlbmVyaWMubm9SZXN1bHRzJywgXCJObyB0eXBlIGRlZmluaXRpb24gZm91bmRcIik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldEFsdGVybmF0aXZlQ29tbWFuZChlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZ290b0xvY2F0aW9uKS5hbHRlcm5hdGl2ZVR5cGVEZWZpbml0aW9uQ29tbWFuZDtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0R29Ub1ByZWZlcmVuY2UoZWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvcik6IEdvVG9Mb2NhdGlvblZhbHVlcyB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmdvdG9Mb2NhdGlvbikubXVsdGlwbGVUeXBlRGVmaW5pdGlvbnM7XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEdvVG9UeXBlRGVmaW5pdGlvbkFjdGlvbiBleHRlbmRzIFR5cGVEZWZpbml0aW9uQWN0aW9uIHtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ2VkaXRvci5hY3Rpb24uZ29Ub1R5cGVEZWZpbml0aW9uJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRvcGVuVG9TaWRlOiBmYWxzZSxcblx0XHRcdG9wZW5JblBlZWs6IGZhbHNlLFxuXHRcdFx0bXV0ZU1lc3NhZ2U6IGZhbHNlXG5cdFx0fSwge1xuXHRcdFx0aWQ6IEdvVG9UeXBlRGVmaW5pdGlvbkFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdC4uLm5scy5sb2NhbGl6ZTIoJ2FjdGlvbnMuZ29Ub1R5cGVEZWZpbml0aW9uLmxhYmVsJywgXCJHbyB0byBUeXBlIERlZmluaXRpb25cIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pR290b1R5cGVEZWZpbml0aW9uJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkdvIHRvICYmVHlwZSBEZWZpbml0aW9uXCIpLFxuXHRcdFx0fSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMuaGFzVHlwZURlZmluaXRpb25Qcm92aWRlcixcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiAwLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDEuNFxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJHb01lbnUsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogbnVsbCxcblx0XHRcdFx0Z3JvdXA6ICc0X3N5bWJvbF9uYXYnLFxuXHRcdFx0XHRvcmRlcjogMyxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUGVla1R5cGVEZWZpbml0aW9uQWN0aW9uIGV4dGVuZHMgVHlwZURlZmluaXRpb25BY3Rpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmFjdGlvbi5wZWVrVHlwZURlZmluaXRpb24nO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdG9wZW5Ub1NpZGU6IGZhbHNlLFxuXHRcdFx0b3BlbkluUGVlazogdHJ1ZSxcblx0XHRcdG11dGVNZXNzYWdlOiBmYWxzZVxuXHRcdH0sIHtcblx0XHRcdGlkOiBQZWVrVHlwZURlZmluaXRpb25BY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignYWN0aW9ucy5wZWVrVHlwZURlZmluaXRpb24ubGFiZWwnLCBcIlBlZWsgVHlwZSBEZWZpbml0aW9uXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmhhc1R5cGVEZWZpbml0aW9uUHJvdmlkZXIsXG5cdFx0XHRcdFBlZWtDb250ZXh0Lm5vdEluUGVla0VkaXRvcixcblx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMuaXNJbkVtYmVkZGVkRWRpdG9yLnRvTmVnYXRlZCgpXG5cdFx0XHQpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRleHRQZWVrLFxuXHRcdFx0XHRncm91cDogJ3BlZWsnLFxuXHRcdFx0XHRvcmRlcjogNFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59KTtcblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiAtLS0gSU1QTEVNRU5UQVRJT05cblxuY2xhc3MgSW1wbGVtZW50YXRpb25BY3Rpb24gZXh0ZW5kcyBTeW1ib2xOYXZpZ2F0aW9uQWN0aW9uIHtcblxuXHRwcm90ZWN0ZWQgYXN5bmMgX2dldExvY2F0aW9uTW9kZWwobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSwgbW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBjb3JlUG9zaXRpb24uUG9zaXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8UmVmZXJlbmNlc01vZGVsPiB7XG5cdFx0cmV0dXJuIG5ldyBSZWZlcmVuY2VzTW9kZWwoYXdhaXQgZ2V0SW1wbGVtZW50YXRpb25zQXRQb3NpdGlvbihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5pbXBsZW1lbnRhdGlvblByb3ZpZGVyLCBtb2RlbCwgcG9zaXRpb24sIGZhbHNlLCB0b2tlbiksIG5scy5sb2NhbGl6ZSgnaW1wbC50aXRsZScsICdJbXBsZW1lbnRhdGlvbnMnKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldE5vUmVzdWx0Rm91bmRNZXNzYWdlKGluZm86IElXb3JkQXRQb3NpdGlvbiB8IG51bGwpOiBzdHJpbmcge1xuXHRcdHJldHVybiBpbmZvICYmIGluZm8ud29yZFxuXHRcdFx0PyBubHMubG9jYWxpemUoJ2dvVG9JbXBsZW1lbnRhdGlvbi5ub1Jlc3VsdFdvcmQnLCBcIk5vIGltcGxlbWVudGF0aW9uIGZvdW5kIGZvciAnezB9J1wiLCBpbmZvLndvcmQpXG5cdFx0XHQ6IG5scy5sb2NhbGl6ZSgnZ29Ub0ltcGxlbWVudGF0aW9uLmdlbmVyaWMubm9SZXN1bHRzJywgXCJObyBpbXBsZW1lbnRhdGlvbiBmb3VuZFwiKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0QWx0ZXJuYXRpdmVDb21tYW5kKGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IpOiBzdHJpbmcge1xuXHRcdHJldHVybiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5nb3RvTG9jYXRpb24pLmFsdGVybmF0aXZlSW1wbGVtZW50YXRpb25Db21tYW5kO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRHb1RvUHJlZmVyZW5jZShlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yKTogR29Ub0xvY2F0aW9uVmFsdWVzIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZ290b0xvY2F0aW9uKS5tdWx0aXBsZUltcGxlbWVudGF0aW9ucztcblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgR29Ub0ltcGxlbWVudGF0aW9uQWN0aW9uIGV4dGVuZHMgSW1wbGVtZW50YXRpb25BY3Rpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmFjdGlvbi5nb1RvSW1wbGVtZW50YXRpb24nO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdG9wZW5Ub1NpZGU6IGZhbHNlLFxuXHRcdFx0b3BlbkluUGVlazogZmFsc2UsXG5cdFx0XHRtdXRlTWVzc2FnZTogZmFsc2Vcblx0XHR9LCB7XG5cdFx0XHRpZDogR29Ub0ltcGxlbWVudGF0aW9uQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubmxzLmxvY2FsaXplMignYWN0aW9ucy5nb1RvSW1wbGVtZW50YXRpb24ubGFiZWwnLCBcIkdvIHRvIEltcGxlbWVudGF0aW9uc1wiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbmxzLmxvY2FsaXplKHsga2V5OiAnbWlHb3RvSW1wbGVtZW50YXRpb24nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiR28gdG8gJiZJbXBsZW1lbnRhdGlvbnNcIiksXG5cdFx0XHR9LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy5oYXNJbXBsZW1lbnRhdGlvblByb3ZpZGVyLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5GMTIsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JDb250ZXh0LFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMS40NVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJHb01lbnUsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogbnVsbCxcblx0XHRcdFx0Z3JvdXA6ICc0X3N5bWJvbF9uYXYnLFxuXHRcdFx0XHRvcmRlcjogNCxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUGVla0ltcGxlbWVudGF0aW9uQWN0aW9uIGV4dGVuZHMgSW1wbGVtZW50YXRpb25BY3Rpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmFjdGlvbi5wZWVrSW1wbGVtZW50YXRpb24nO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdG9wZW5Ub1NpZGU6IGZhbHNlLFxuXHRcdFx0b3BlbkluUGVlazogdHJ1ZSxcblx0XHRcdG11dGVNZXNzYWdlOiBmYWxzZVxuXHRcdH0sIHtcblx0XHRcdGlkOiBQZWVrSW1wbGVtZW50YXRpb25BY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignYWN0aW9ucy5wZWVrSW1wbGVtZW50YXRpb24ubGFiZWwnLCBcIlBlZWsgSW1wbGVtZW50YXRpb25zXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmhhc0ltcGxlbWVudGF0aW9uUHJvdmlkZXIsXG5cdFx0XHRcdFBlZWtDb250ZXh0Lm5vdEluUGVla0VkaXRvcixcblx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMuaXNJbkVtYmVkZGVkRWRpdG9yLnRvTmVnYXRlZCgpXG5cdFx0XHQpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5GMTIsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRleHRQZWVrLFxuXHRcdFx0XHRncm91cDogJ3BlZWsnLFxuXHRcdFx0XHRvcmRlcjogNVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59KTtcblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiAtLS0gUkVGRVJFTkNFU1xuXG5hYnN0cmFjdCBjbGFzcyBSZWZlcmVuY2VzQWN0aW9uIGV4dGVuZHMgU3ltYm9sTmF2aWdhdGlvbkFjdGlvbiB7XG5cblx0cHJvdGVjdGVkIF9nZXROb1Jlc3VsdEZvdW5kTWVzc2FnZShpbmZvOiBJV29yZEF0UG9zaXRpb24gfCBudWxsKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gaW5mb1xuXHRcdFx0PyBubHMubG9jYWxpemUoJ3JlZmVyZW5jZXMubm8nLCBcIk5vIHJlZmVyZW5jZXMgZm91bmQgZm9yICd7MH0nXCIsIGluZm8ud29yZClcblx0XHRcdDogbmxzLmxvY2FsaXplKCdyZWZlcmVuY2VzLm5vR2VuZXJpYycsIFwiTm8gcmVmZXJlbmNlcyBmb3VuZFwiKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0QWx0ZXJuYXRpdmVDb21tYW5kKGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IpOiBzdHJpbmcge1xuXHRcdHJldHVybiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5nb3RvTG9jYXRpb24pLmFsdGVybmF0aXZlUmVmZXJlbmNlQ29tbWFuZDtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0R29Ub1ByZWZlcmVuY2UoZWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvcik6IEdvVG9Mb2NhdGlvblZhbHVlcyB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmdvdG9Mb2NhdGlvbikubXVsdGlwbGVSZWZlcmVuY2VzO1xuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBHb1RvUmVmZXJlbmNlc0FjdGlvbiBleHRlbmRzIFJlZmVyZW5jZXNBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdG9wZW5Ub1NpZGU6IGZhbHNlLFxuXHRcdFx0b3BlbkluUGVlazogZmFsc2UsXG5cdFx0XHRtdXRlTWVzc2FnZTogZmFsc2Vcblx0XHR9LCB7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uZ29Ub1JlZmVyZW5jZXMnLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubmxzLmxvY2FsaXplMignZ29Ub1JlZmVyZW5jZXMubGFiZWwnLCBcIkdvIHRvIFJlZmVyZW5jZXNcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pR290b1JlZmVyZW5jZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJHbyB0byAmJlJlZmVyZW5jZXNcIiksXG5cdFx0XHR9LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmhhc1JlZmVyZW5jZVByb3ZpZGVyLFxuXHRcdFx0XHRQZWVrQ29udGV4dC5ub3RJblBlZWtFZGl0b3IsXG5cdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmlzSW5FbWJlZGRlZEVkaXRvci50b05lZ2F0ZWQoKVxuXHRcdFx0KSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkYxMixcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAxLjQ1XG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuTWVudWJhckdvTWVudSxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBudWxsLFxuXHRcdFx0XHRncm91cDogJzRfc3ltYm9sX25hdicsXG5cdFx0XHRcdG9yZGVyOiA1LFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBfZ2V0TG9jYXRpb25Nb2RlbChsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLCBtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IGNvcmVQb3NpdGlvbi5Qb3NpdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxSZWZlcmVuY2VzTW9kZWw+IHtcblx0XHRyZXR1cm4gbmV3IFJlZmVyZW5jZXNNb2RlbChhd2FpdCBnZXRSZWZlcmVuY2VzQXRQb3NpdGlvbihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5yZWZlcmVuY2VQcm92aWRlciwgbW9kZWwsIHBvc2l0aW9uLCB0cnVlLCBmYWxzZSwgdG9rZW4pLCBubHMubG9jYWxpemUoJ3JlZi50aXRsZScsICdSZWZlcmVuY2VzJykpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFBlZWtSZWZlcmVuY2VzQWN0aW9uIGV4dGVuZHMgUmVmZXJlbmNlc0FjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0b3BlblRvU2lkZTogZmFsc2UsXG5cdFx0XHRvcGVuSW5QZWVrOiB0cnVlLFxuXHRcdFx0bXV0ZU1lc3NhZ2U6IGZhbHNlXG5cdFx0fSwge1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLnJlZmVyZW5jZVNlYXJjaC50cmlnZ2VyJyxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdyZWZlcmVuY2VzLmFjdGlvbi5sYWJlbCcsIFwiUGVlayBSZWZlcmVuY2VzXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmhhc1JlZmVyZW5jZVByb3ZpZGVyLFxuXHRcdFx0XHRQZWVrQ29udGV4dC5ub3RJblBlZWtFZGl0b3IsXG5cdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmlzSW5FbWJlZGRlZEVkaXRvci50b05lZ2F0ZWQoKVxuXHRcdFx0KSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JDb250ZXh0UGVlayxcblx0XHRcdFx0Z3JvdXA6ICdwZWVrJyxcblx0XHRcdFx0b3JkZXI6IDZcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBfZ2V0TG9jYXRpb25Nb2RlbChsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLCBtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IGNvcmVQb3NpdGlvbi5Qb3NpdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxSZWZlcmVuY2VzTW9kZWw+IHtcblx0XHRyZXR1cm4gbmV3IFJlZmVyZW5jZXNNb2RlbChhd2FpdCBnZXRSZWZlcmVuY2VzQXRQb3NpdGlvbihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5yZWZlcmVuY2VQcm92aWRlciwgbW9kZWwsIHBvc2l0aW9uLCBmYWxzZSwgZmFsc2UsIHRva2VuKSwgbmxzLmxvY2FsaXplKCdyZWYudGl0bGUnLCAnUmVmZXJlbmNlcycpKTtcblx0fVxufSk7XG5cbi8vI2VuZHJlZ2lvblxuXG5cbi8vI3JlZ2lvbiAtLS0gR0VORVJJQyBnb3RvIHN5bWJvbHMgY29tbWFuZFxuXG5jbGFzcyBHZW5lcmljR29Ub0xvY2F0aW9uQWN0aW9uIGV4dGVuZHMgU3ltYm9sTmF2aWdhdGlvbkFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y29uZmlnOiBTeW1ib2xOYXZpZ2F0aW9uQWN0aW9uQ29uZmlnLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3JlZmVyZW5jZXM6IExvY2F0aW9uW10sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZ290b011bHRpcGxlQmVoYXZpb3VyOiBHb1RvTG9jYXRpb25WYWx1ZXMgfCB1bmRlZmluZWQsXG5cdCkge1xuXHRcdHN1cGVyKGNvbmZpZywge1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLmdvVG9Mb2NhdGlvbicsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignbGFiZWwuZ2VuZXJpYycsIFwiR28gdG8gQW55IFN5bWJvbFwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRQZWVrQ29udGV4dC5ub3RJblBlZWtFZGl0b3IsXG5cdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmlzSW5FbWJlZGRlZEVkaXRvci50b05lZ2F0ZWQoKVxuXHRcdFx0KSxcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBfZ2V0TG9jYXRpb25Nb2RlbChsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLCBfbW9kZWw6IElUZXh0TW9kZWwsIF9wb3NpdGlvbjogY29yZVBvc2l0aW9uLlBvc2l0aW9uLCBfdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxSZWZlcmVuY2VzTW9kZWwgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gbmV3IFJlZmVyZW5jZXNNb2RlbCh0aGlzLl9yZWZlcmVuY2VzLCBubHMubG9jYWxpemUoJ2dlbmVyaWMudGl0bGUnLCAnTG9jYXRpb25zJykpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXROb1Jlc3VsdEZvdW5kTWVzc2FnZShpbmZvOiBJV29yZEF0UG9zaXRpb24gfCBudWxsKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gaW5mbyAmJiBubHMubG9jYWxpemUoJ2dlbmVyaWMubm9SZXN1bHQnLCBcIk5vIHJlc3VsdHMgZm9yICd7MH0nXCIsIGluZm8ud29yZCkgfHwgJyc7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldEdvVG9QcmVmZXJlbmNlKGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IpOiBHb1RvTG9jYXRpb25WYWx1ZXMge1xuXHRcdHJldHVybiB0aGlzLl9nb3RvTXVsdGlwbGVCZWhhdmlvdXIgPz8gZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZ290b0xvY2F0aW9uKS5tdWx0aXBsZVJlZmVyZW5jZXM7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldEFsdGVybmF0aXZlQ29tbWFuZCgpOiB1bmRlZmluZWQge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogJ2VkaXRvci5hY3Rpb24uZ29Ub0xvY2F0aW9ucycsXG5cdG1ldGFkYXRhOiB7XG5cdFx0ZGVzY3JpcHRpb246ICdHbyB0byBsb2NhdGlvbnMgZnJvbSBhIHBvc2l0aW9uIGluIGEgZmlsZScsXG5cdFx0YXJnczogW1xuXHRcdFx0eyBuYW1lOiAndXJpJywgZGVzY3JpcHRpb246ICdUaGUgdGV4dCBkb2N1bWVudCBpbiB3aGljaCB0byBzdGFydCcsIGNvbnN0cmFpbnQ6IFVSSSB9LFxuXHRcdFx0eyBuYW1lOiAncG9zaXRpb24nLCBkZXNjcmlwdGlvbjogJ1RoZSBwb3NpdGlvbiBhdCB3aGljaCB0byBzdGFydCcsIGNvbnN0cmFpbnQ6IGNvcmVQb3NpdGlvbi5Qb3NpdGlvbi5pc0lQb3NpdGlvbiB9LFxuXHRcdFx0eyBuYW1lOiAnbG9jYXRpb25zJywgZGVzY3JpcHRpb246ICdBbiBhcnJheSBvZiBsb2NhdGlvbnMuJywgY29uc3RyYWludDogQXJyYXkgfSxcblx0XHRcdHsgbmFtZTogJ211bHRpcGxlJywgZGVzY3JpcHRpb246ICdEZWZpbmUgd2hhdCB0byBkbyB3aGVuIGhhdmluZyBtdWx0aXBsZSByZXN1bHRzLCBlaXRoZXIgYHBlZWtgLCBgZ290b0FuZFBlZWtgLCBvciBgZ290b2AnIH0sXG5cdFx0XHR7IG5hbWU6ICdub1Jlc3VsdHNNZXNzYWdlJywgZGVzY3JpcHRpb246ICdIdW1hbiByZWFkYWJsZSBtZXNzYWdlIHRoYXQgc2hvd3Mgd2hlbiBsb2NhdGlvbnMgaXMgZW1wdHkuJyB9LFxuXHRcdF1cblx0fSxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCByZXNvdXJjZTogYW55LCBwb3NpdGlvbjogYW55LCByZWZlcmVuY2VzOiBhbnksIG11bHRpcGxlPzogYW55LCBub1Jlc3VsdHNNZXNzYWdlPzogc3RyaW5nLCBvcGVuSW5QZWVrPzogYm9vbGVhbikgPT4ge1xuXHRcdGFzc2VydFR5cGUoVVJJLmlzVXJpKHJlc291cmNlKSk7XG5cdFx0YXNzZXJ0VHlwZShjb3JlUG9zaXRpb24uUG9zaXRpb24uaXNJUG9zaXRpb24ocG9zaXRpb24pKTtcblx0XHRhc3NlcnRUeXBlKEFycmF5LmlzQXJyYXkocmVmZXJlbmNlcykpO1xuXHRcdGFzc2VydFR5cGUodHlwZW9mIG11bHRpcGxlID09PSAndW5kZWZpbmVkJyB8fCB0eXBlb2YgbXVsdGlwbGUgPT09ICdzdHJpbmcnKTtcblx0XHRhc3NlcnRUeXBlKHR5cGVvZiBvcGVuSW5QZWVrID09PSAndW5kZWZpbmVkJyB8fCB0eXBlb2Ygb3BlbkluUGVlayA9PT0gJ2Jvb2xlYW4nKTtcblxuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvZGVFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3IgPSBhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5Db2RlRWRpdG9yKHsgcmVzb3VyY2UgfSwgZWRpdG9yU2VydmljZS5nZXRGb2N1c2VkQ29kZUVkaXRvcigpKTtcblxuXHRcdGlmIChpc0NvZGVFZGl0b3IoZWRpdG9yKSkge1xuXHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRcdGVkaXRvci5yZXZlYWxQb3NpdGlvbkluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQocG9zaXRpb24sIFNjcm9sbFR5cGUuU21vb3RoKTtcblxuXHRcdFx0cmV0dXJuIGVkaXRvci5pbnZva2VXaXRoaW5Db250ZXh0KGFjY2Vzc29yID0+IHtcblx0XHRcdFx0Y29uc3QgY29tbWFuZCA9IG5ldyBjbGFzcyBleHRlbmRzIEdlbmVyaWNHb1RvTG9jYXRpb25BY3Rpb24ge1xuXHRcdFx0XHRcdHByb3RlY3RlZCBvdmVycmlkZSBfZ2V0Tm9SZXN1bHRGb3VuZE1lc3NhZ2UoaW5mbzogSVdvcmRBdFBvc2l0aW9uIHwgbnVsbCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5vUmVzdWx0c01lc3NhZ2UgfHwgc3VwZXIuX2dldE5vUmVzdWx0Rm91bmRNZXNzYWdlKGluZm8pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSh7XG5cdFx0XHRcdFx0bXV0ZU1lc3NhZ2U6ICFCb29sZWFuKG5vUmVzdWx0c01lc3NhZ2UpLFxuXHRcdFx0XHRcdG9wZW5JblBlZWs6IEJvb2xlYW4ob3BlbkluUGVlayksXG5cdFx0XHRcdFx0b3BlblRvU2lkZTogZmFsc2Vcblx0XHRcdFx0fSwgcmVmZXJlbmNlcywgbXVsdGlwbGUgYXMgR29Ub0xvY2F0aW9uVmFsdWVzKTtcblxuXHRcdFx0XHRhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKS5pbnZva2VGdW5jdGlvbihjb21tYW5kLnJ1bi5iaW5kKGNvbW1hbmQpLCBlZGl0b3IpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogJ2VkaXRvci5hY3Rpb24ucGVla0xvY2F0aW9ucycsXG5cdG1ldGFkYXRhOiB7XG5cdFx0ZGVzY3JpcHRpb246ICdQZWVrIGxvY2F0aW9ucyBmcm9tIGEgcG9zaXRpb24gaW4gYSBmaWxlJyxcblx0XHRhcmdzOiBbXG5cdFx0XHR7IG5hbWU6ICd1cmknLCBkZXNjcmlwdGlvbjogJ1RoZSB0ZXh0IGRvY3VtZW50IGluIHdoaWNoIHRvIHN0YXJ0JywgY29uc3RyYWludDogVVJJIH0sXG5cdFx0XHR7IG5hbWU6ICdwb3NpdGlvbicsIGRlc2NyaXB0aW9uOiAnVGhlIHBvc2l0aW9uIGF0IHdoaWNoIHRvIHN0YXJ0JywgY29uc3RyYWludDogY29yZVBvc2l0aW9uLlBvc2l0aW9uLmlzSVBvc2l0aW9uIH0sXG5cdFx0XHR7IG5hbWU6ICdsb2NhdGlvbnMnLCBkZXNjcmlwdGlvbjogJ0FuIGFycmF5IG9mIGxvY2F0aW9ucy4nLCBjb25zdHJhaW50OiBBcnJheSB9LFxuXHRcdFx0eyBuYW1lOiAnbXVsdGlwbGUnLCBkZXNjcmlwdGlvbjogJ0RlZmluZSB3aGF0IHRvIGRvIHdoZW4gaGF2aW5nIG11bHRpcGxlIHJlc3VsdHMsIGVpdGhlciBgcGVla2AsIGBnb3RvQW5kUGVla2AsIG9yIGBnb3RvYCcgfSxcblx0XHRdXG5cdH0sXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcmVzb3VyY2U6IGFueSwgcG9zaXRpb246IGFueSwgcmVmZXJlbmNlczogYW55LCBtdWx0aXBsZT86IGFueSkgPT4ge1xuXHRcdGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpLmV4ZWN1dGVDb21tYW5kKCdlZGl0b3IuYWN0aW9uLmdvVG9Mb2NhdGlvbnMnLCByZXNvdXJjZSwgcG9zaXRpb24sIHJlZmVyZW5jZXMsIG11bHRpcGxlLCB1bmRlZmluZWQsIHRydWUpO1xuXHR9XG59KTtcblxuLy8jZW5kcmVnaW9uXG5cblxuLy8jcmVnaW9uIC0tLSBSRUZFUkVOQ0Ugc2VhcmNoIHNwZWNpYWwgY29tbWFuZHNcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogJ2VkaXRvci5hY3Rpb24uZmluZFJlZmVyZW5jZXMnLFxuXHRoYW5kbGVyOiAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHJlc291cmNlOiBhbnksIHBvc2l0aW9uOiBhbnkpID0+IHtcblx0XHRhc3NlcnRUeXBlKFVSSS5pc1VyaShyZXNvdXJjZSkpO1xuXHRcdGFzc2VydFR5cGUoY29yZVBvc2l0aW9uLlBvc2l0aW9uLmlzSVBvc2l0aW9uKHBvc2l0aW9uKSk7XG5cblx0XHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNvZGVFZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb2RlRWRpdG9yU2VydmljZSk7XG5cdFx0cmV0dXJuIGNvZGVFZGl0b3JTZXJ2aWNlLm9wZW5Db2RlRWRpdG9yKHsgcmVzb3VyY2UgfSwgY29kZUVkaXRvclNlcnZpY2UuZ2V0Rm9jdXNlZENvZGVFZGl0b3IoKSkudGhlbihjb250cm9sID0+IHtcblx0XHRcdGlmICghaXNDb2RlRWRpdG9yKGNvbnRyb2wpIHx8ICFjb250cm9sLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29udHJvbGxlciA9IFJlZmVyZW5jZXNDb250cm9sbGVyLmdldChjb250cm9sKTtcblx0XHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZWZlcmVuY2VzID0gY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UodG9rZW4gPT4gZ2V0UmVmZXJlbmNlc0F0UG9zaXRpb24obGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UucmVmZXJlbmNlUHJvdmlkZXIsIGNvbnRyb2wuZ2V0TW9kZWwoKSwgY29yZVBvc2l0aW9uLlBvc2l0aW9uLmxpZnQocG9zaXRpb24pLCBmYWxzZSwgZmFsc2UsIHRva2VuKS50aGVuKHJlZmVyZW5jZXMgPT4gbmV3IFJlZmVyZW5jZXNNb2RlbChyZWZlcmVuY2VzLCBubHMubG9jYWxpemUoJ3JlZi50aXRsZScsICdSZWZlcmVuY2VzJykpKSk7XG5cdFx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4sIHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbik7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGNvbnRyb2xsZXIudG9nZ2xlV2lkZ2V0KHJhbmdlLCByZWZlcmVuY2VzLCBmYWxzZSkpO1xuXHRcdH0pO1xuXHR9XG59KTtcblxuLy8gdXNlIE5FVyBjb21tYW5kXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFsaWFzKCdlZGl0b3IuYWN0aW9uLnNob3dSZWZlcmVuY2VzJywgJ2VkaXRvci5hY3Rpb24ucGVla0xvY2F0aW9ucycpO1xuXG4vLyNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICJBQUFBO0FBS0EsU0FBUyxhQUFhO0FBQ3RCLFNBQVMseUJBQXlCLHdCQUF3QjtBQUUxRCxTQUFTLFVBQVUsU0FBUyxjQUFjO0FBQzFDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsV0FBVztBQUNwQixTQUFTLHFCQUFxQiwwQ0FBMEM7QUFDeEUsU0FBeUMsb0JBQW9CO0FBQzdELFNBQVMscUJBQXVDO0FBQ2hELFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsb0JBQXdDO0FBQ2pELFlBQVksa0JBQWtCO0FBQzlCLFNBQWlCLGFBQWE7QUFDOUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyx5QkFBeUI7QUFFbEMsU0FBUyxzQkFBOEM7QUFDdkQsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxtQkFBbUI7QUFDNUIsWUFBWSxTQUFTO0FBQ3JCLFNBQW1FLFFB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
