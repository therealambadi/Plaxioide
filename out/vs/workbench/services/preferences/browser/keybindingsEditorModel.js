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
import { distinct, coalesce } from "../../../../base/common/arrays.js";
import * as strings from "../../../../base/common/strings.js";
import { Language } from "../../../../base/common/platform.js";
import { or, matchesContiguousSubString, matchesPrefix, matchesCamelCase, matchesWords } from "../../../../base/common/filters.js";
import { AriaLabelProvider, UserSettingsLabelProvider, UILabelProvider } from "../../../../base/common/keybindingLabels.js";
import { MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { EditorModel } from "../../../common/editor/editorModel.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ResolvedKeybindingItem } from "../../../../platform/keybinding/common/resolvedKeybindingItem.js";
import { getAllUnboundCommands } from "../../keybinding/browser/unboundCommands.js";
import { isEmptyObject, isString } from "../../../../base/common/types.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { ExtensionIdentifier, ExtensionIdentifierMap } from "../../../../platform/extensions/common/extensions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
const KEYBINDING_ENTRY_TEMPLATE_ID = "keybinding.entry.template";
const SOURCE_SYSTEM = localize("default", "System");
const SOURCE_EXTENSION = localize("extension", "Extension");
const SOURCE_USER = localize("user", "User");
function createKeybindingCommandQuery(commandId, when) {
  const whenPart = when ? ` +when:${when}` : "";
  return `@command:${commandId}${whenPart}`;
}
const wordFilter = or(matchesPrefix, matchesWords, matchesContiguousSubString);
const COMMAND_REGEX = /@command:\s*([^\+]+)/i;
const WHEN_REGEX = /\+when:\s*(.+)/i;
const SOURCE_REGEX = /@source:\s*(user|default|system|extension)/i;
const EXTENSION_REGEX = /@ext:\s*((".+")|([^\s]+))/i;
const KEYBINDING_REGEX = /@keybinding:\s*((\".+\")|(\S+))/i;
let KeybindingsEditorModel = class extends EditorModel {
  constructor(os, keybindingsService, extensionService) {
    super();
    this.keybindingsService = keybindingsService;
    this.extensionService = extensionService;
    this._keybindingItems = [];
    this._keybindingItemsSortedByPrecedence = [];
    this.modifierLabels = {
      ui: UILabelProvider.modifierLabels[os],
      aria: AriaLabelProvider.modifierLabels[os],
      user: UserSettingsLabelProvider.modifierLabels[os]
    };
  }
  fetch(searchValue, sortByPrecedence = false) {
    let keybindingItems = sortByPrecedence ? this._keybindingItemsSortedByPrecedence : this._keybindingItems;
    const commandIdMatches = COMMAND_REGEX.exec(searchValue);
    if (commandIdMatches && commandIdMatches[1]) {
      const command = commandIdMatches[1].trim();
      let filteredKeybindingItems = keybindingItems.filter((k) => k.command === command);
      if (filteredKeybindingItems.length) {
        const whenMatches = WHEN_REGEX.exec(searchValue);
        if (whenMatches && whenMatches[1]) {
          const whenValue = whenMatches[1].trim();
          filteredKeybindingItems = this.filterByWhen(filteredKeybindingItems, command, whenValue);
        }
      }
      return filteredKeybindingItems.map((keybindingItem) => ({ id: KeybindingsEditorModel.getId(keybindingItem), keybindingItem, templateId: KEYBINDING_ENTRY_TEMPLATE_ID }));
    }
    if (SOURCE_REGEX.test(searchValue)) {
      keybindingItems = this.filterBySource(keybindingItems, searchValue);
      searchValue = searchValue.replace(SOURCE_REGEX, "");
    } else {
      const extensionMatches = EXTENSION_REGEX.exec(searchValue);
      if (extensionMatches && (extensionMatches[2] || extensionMatches[3])) {
        const extensionId = extensionMatches[2] ? extensionMatches[2].substring(1, extensionMatches[2].length - 1) : extensionMatches[3];
        keybindingItems = this.filterByExtension(keybindingItems, extensionId);
        searchValue = searchValue.replace(EXTENSION_REGEX, "");
      } else {
        const keybindingMatches = KEYBINDING_REGEX.exec(searchValue);
        if (keybindingMatches && (keybindingMatches[2] || keybindingMatches[3])) {
          searchValue = keybindingMatches[2] || `"${keybindingMatches[3]}"`;
        }
      }
    }
    searchValue = searchValue.trim();
    if (!searchValue) {
      return keybindingItems.map((keybindingItem) => ({ id: KeybindingsEditorModel.getId(keybindingItem), keybindingItem, templateId: KEYBINDING_ENTRY_TEMPLATE_ID }));
    }
    return this.filterByText(keybindingItems, searchValue);
  }
  filterBySource(keybindingItems, searchValue) {
    if (/@source:\s*default/i.test(searchValue) || /@source:\s*system/i.test(searchValue)) {
      return keybindingItems.filter((k) => k.source === SOURCE_SYSTEM);
    }
    if (/@source:\s*user/i.test(searchValue)) {
      return keybindingItems.filter((k) => k.source === SOURCE_USER);
    }
    if (/@source:\s*extension/i.test(searchValue)) {
      return keybindingItems.filter((k) => !isString(k.source) || k.source === SOURCE_EXTENSION);
    }
    return keybindingItems;
  }
  filterByExtension(keybindingItems, extension) {
    extension = extension.toLowerCase().trim();
    return keybindingItems.filter((k) => !isString(k.source) && (ExtensionIdentifier.equals(k.source.identifier, extension) || k.source.displayName?.toLowerCase() === extension.toLowerCase()));
  }
  filterByText(keybindingItems, searchValue) {
    const quoteAtFirstChar = searchValue.charAt(0) === '"';
    const quoteAtLastChar = searchValue.charAt(searchValue.length - 1) === '"';
    const completeMatch = quoteAtFirstChar && quoteAtLastChar;
    if (quoteAtFirstChar) {
      searchValue = searchValue.substring(1);
    }
    if (quoteAtLastChar) {
      searchValue = searchValue.substring(0, searchValue.length - 1);
    }
    searchValue = searchValue.trim();
    const result = [];
    const words = searchValue.split(" ");
    const keybindingWords = this.splitKeybindingWords(words);
    for (const keybindingItem of keybindingItems) {
      const keybindingMatches = new KeybindingItemMatches(this.modifierLabels, keybindingItem, searchValue, words, keybindingWords, completeMatch);
      if (keybindingMatches.commandIdMatches || keybindingMatches.commandLabelMatches || keybindingMatches.commandDefaultLabelMatches || keybindingMatches.sourceMatches || keybindingMatches.whenMatches || keybindingMatches.keybindingMatches || keybindingMatches.extensionIdMatches || keybindingMatches.extensionLabelMatches) {
        result.push({
          id: KeybindingsEditorModel.getId(keybindingItem),
          templateId: KEYBINDING_ENTRY_TEMPLATE_ID,
          commandLabelMatches: keybindingMatches.commandLabelMatches || void 0,
          commandDefaultLabelMatches: keybindingMatches.commandDefaultLabelMatches || void 0,
          keybindingItem,
          keybindingMatches: keybindingMatches.keybindingMatches || void 0,
          commandIdMatches: keybindingMatches.commandIdMatches || void 0,
          sourceMatches: keybindingMatches.sourceMatches || void 0,
          whenMatches: keybindingMatches.whenMatches || void 0,
          extensionIdMatches: keybindingMatches.extensionIdMatches || void 0,
          extensionLabelMatches: keybindingMatches.extensionLabelMatches || void 0
        });
      }
    }
    return result;
  }
  filterByWhen(keybindingItems, command, when) {
    if (keybindingItems.length === 0) {
      return [];
    }
    const keybindingItemsWithWhen = keybindingItems.filter((k) => k.when === when);
    if (keybindingItemsWithWhen.length) {
      return keybindingItemsWithWhen;
    }
    const commandLabel = keybindingItems[0].commandLabel;
    const keybindingItem = new ResolvedKeybindingItem(void 0, command, null, ContextKeyExpr.deserialize(when), false, null, false);
    const actionLabels = /* @__PURE__ */ new Map([[command, commandLabel]]);
    return [KeybindingsEditorModel.toKeybindingEntry(command, keybindingItem, actionLabels, this.getExtensionsMapping())];
  }
  splitKeybindingWords(wordsSeparatedBySpaces) {
    const result = [];
    for (const word of wordsSeparatedBySpaces) {
      result.push(...coalesce(word.split("+")));
    }
    return result;
  }
  async resolve(actionLabels = /* @__PURE__ */ new Map()) {
    const extensions = this.getExtensionsMapping();
    this._keybindingItemsSortedByPrecedence = [];
    const boundCommands = /* @__PURE__ */ new Map();
    for (const keybinding of this.keybindingsService.getKeybindings()) {
      if (keybinding.command) {
        this._keybindingItemsSortedByPrecedence.push(KeybindingsEditorModel.toKeybindingEntry(keybinding.command, keybinding, actionLabels, extensions));
        boundCommands.set(keybinding.command, true);
      }
    }
    const commandsWithDefaultKeybindings = this.keybindingsService.getDefaultKeybindings().map((keybinding) => keybinding.command);
    for (const command of getAllUnboundCommands(boundCommands)) {
      const keybindingItem = new ResolvedKeybindingItem(void 0, command, null, void 0, commandsWithDefaultKeybindings.indexOf(command) === -1, null, false);
      this._keybindingItemsSortedByPrecedence.push(KeybindingsEditorModel.toKeybindingEntry(command, keybindingItem, actionLabels, extensions));
    }
    this._keybindingItemsSortedByPrecedence = distinct(this._keybindingItemsSortedByPrecedence, (keybindingItem) => KeybindingsEditorModel.getId(keybindingItem));
    this._keybindingItems = this._keybindingItemsSortedByPrecedence.slice(0).sort((a, b) => KeybindingsEditorModel.compareKeybindingData(a, b));
    return super.resolve();
  }
  static getId(keybindingItem) {
    return keybindingItem.command + (keybindingItem?.keybinding?.getAriaLabel() ?? "") + keybindingItem.when + (isString(keybindingItem.source) ? keybindingItem.source : keybindingItem.source.identifier.value);
  }
  getExtensionsMapping() {
    const extensions = new ExtensionIdentifierMap();
    for (const extension of this.extensionService.extensions) {
      extensions.set(extension.identifier, extension);
    }
    return extensions;
  }
  static compareKeybindingData(a, b) {
    if (a.keybinding && !b.keybinding) {
      return -1;
    }
    if (b.keybinding && !a.keybinding) {
      return 1;
    }
    if (a.commandLabel && !b.commandLabel) {
      return -1;
    }
    if (b.commandLabel && !a.commandLabel) {
      return 1;
    }
    if (a.commandLabel && b.commandLabel) {
      if (a.commandLabel !== b.commandLabel) {
        return a.commandLabel.localeCompare(b.commandLabel);
      }
    }
    if (a.command === b.command) {
      return a.keybindingItem.isDefault ? 1 : -1;
    }
    return a.command.localeCompare(b.command);
  }
  static toKeybindingEntry(command, keybindingItem, actions, extensions) {
    const menuCommand = MenuRegistry.getCommand(command);
    const editorActionLabel = actions.get(command);
    let source = SOURCE_USER;
    if (keybindingItem.isDefault) {
      const extensionId = keybindingItem.extensionId ?? (keybindingItem.resolvedKeybinding ? void 0 : menuCommand?.source?.id);
      source = extensionId ? extensions.get(extensionId) ?? SOURCE_EXTENSION : SOURCE_SYSTEM;
    }
    return {
      keybinding: keybindingItem.resolvedKeybinding,
      keybindingItem,
      command,
      commandLabel: KeybindingsEditorModel.getCommandLabel(menuCommand, editorActionLabel),
      commandDefaultLabel: KeybindingsEditorModel.getCommandDefaultLabel(menuCommand),
      when: keybindingItem.when ? keybindingItem.when.serialize() : "",
      source
    };
  }
  static getCommandDefaultLabel(menuCommand) {
    if (!Language.isDefaultVariant()) {
      if (menuCommand && menuCommand.title && menuCommand.title.original) {
        const category = menuCommand.category ? menuCommand.category.original : void 0;
        const title = menuCommand.title.original;
        return category ? localize("cat.title", "{0}: {1}", category, title) : title;
      }
    }
    return null;
  }
  static getCommandLabel(menuCommand, editorActionLabel) {
    if (menuCommand) {
      const category = menuCommand.category ? typeof menuCommand.category === "string" ? menuCommand.category : menuCommand.category.value : void 0;
      const title = typeof menuCommand.title === "string" ? menuCommand.title : menuCommand.title.value;
      return category ? localize("cat.title", "{0}: {1}", category, title) : title;
    }
    if (editorActionLabel) {
      return editorActionLabel;
    }
    return "";
  }
};
KeybindingsEditorModel = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IExtensionService)
], KeybindingsEditorModel);
class KeybindingItemMatches {
  constructor(modifierLabels, keybindingItem, searchValue, words, keybindingWords, completeMatch) {
    this.modifierLabels = modifierLabels;
    this.commandIdMatches = null;
    this.commandLabelMatches = null;
    this.commandDefaultLabelMatches = null;
    this.sourceMatches = null;
    this.whenMatches = null;
    this.keybindingMatches = null;
    this.extensionIdMatches = null;
    this.extensionLabelMatches = null;
    if (!completeMatch) {
      this.commandIdMatches = this.matches(searchValue, keybindingItem.command, or(matchesWords, matchesCamelCase), words);
      this.commandLabelMatches = keybindingItem.commandLabel ? this.matches(searchValue, keybindingItem.commandLabel, (word, wordToMatchAgainst) => matchesWords(word, keybindingItem.commandLabel, true), words) : null;
      this.commandDefaultLabelMatches = keybindingItem.commandDefaultLabel ? this.matches(searchValue, keybindingItem.commandDefaultLabel, (word, wordToMatchAgainst) => matchesWords(word, keybindingItem.commandDefaultLabel, true), words) : null;
      this.whenMatches = keybindingItem.when ? this.matches(null, keybindingItem.when, or(matchesWords, matchesCamelCase), words) : null;
      if (isString(keybindingItem.source)) {
        this.sourceMatches = this.matches(searchValue, keybindingItem.source, (word, wordToMatchAgainst) => matchesWords(word, keybindingItem.source, true), words);
      } else {
        this.extensionLabelMatches = keybindingItem.source.displayName ? this.matches(searchValue, keybindingItem.source.displayName, (word, wordToMatchAgainst) => matchesWords(word, keybindingItem.commandLabel, true), words) : null;
      }
    }
    this.keybindingMatches = keybindingItem.keybinding ? this.matchesKeybinding(keybindingItem.keybinding, searchValue, keybindingWords, completeMatch) : null;
  }
  matches(searchValue, wordToMatchAgainst, wordMatchesFilter, words) {
    let matches = searchValue ? wordFilter(searchValue, wordToMatchAgainst) : null;
    if (!matches) {
      matches = this.matchesWords(words, wordToMatchAgainst, wordMatchesFilter);
    }
    if (matches) {
      matches = this.filterAndSort(matches);
    }
    return matches;
  }
  matchesWords(words, wordToMatchAgainst, wordMatchesFilter) {
    let matches = [];
    for (const word of words) {
      const wordMatches = wordMatchesFilter(word, wordToMatchAgainst);
      if (wordMatches) {
        matches = [...matches || [], ...wordMatches];
      } else {
        matches = null;
        break;
      }
    }
    return matches;
  }
  filterAndSort(matches) {
    return distinct(matches, (a) => a.start + "." + a.end).filter((match) => !matches.some((m) => !(m.start === match.start && m.end === match.end) && (m.start <= match.start && m.end >= match.end))).sort((a, b) => a.start - b.start);
  }
  matchesKeybinding(keybinding, searchValue, words, completeMatch) {
    const [firstPart, chordPart] = keybinding.getChords();
    const userSettingsLabel = keybinding.getUserSettingsLabel();
    const ariaLabel = keybinding.getAriaLabel();
    const label = keybinding.getLabel();
    if (userSettingsLabel && strings.compareIgnoreCase(searchValue, userSettingsLabel) === 0 || ariaLabel && strings.compareIgnoreCase(searchValue, ariaLabel) === 0 || label && strings.compareIgnoreCase(searchValue, label) === 0) {
      return {
        firstPart: this.createCompleteMatch(firstPart),
        chordPart: this.createCompleteMatch(chordPart)
      };
    }
    const firstPartMatch = {};
    let chordPartMatch = {};
    const matchedWords = [];
    const firstPartMatchedWords = [];
    let chordPartMatchedWords = [];
    let matchFirstPart = true;
    for (let index = 0; index < words.length; index++) {
      const word = words[index];
      let firstPartMatched = false;
      let chordPartMatched = false;
      matchFirstPart = matchFirstPart && !firstPartMatch.keyCode;
      let matchChordPart = !chordPartMatch.keyCode;
      if (matchFirstPart) {
        firstPartMatched = this.matchPart(firstPart, firstPartMatch, word, completeMatch);
        if (firstPartMatch.keyCode) {
          for (const cordPartMatchedWordIndex of chordPartMatchedWords) {
            if (firstPartMatchedWords.indexOf(cordPartMatchedWordIndex) === -1) {
              matchedWords.splice(matchedWords.indexOf(cordPartMatchedWordIndex), 1);
            }
          }
          chordPartMatch = {};
          chordPartMatchedWords = [];
          matchChordPart = false;
        }
      }
      if (matchChordPart) {
        chordPartMatched = this.matchPart(chordPart, chordPartMatch, word, completeMatch);
      }
      if (firstPartMatched) {
        firstPartMatchedWords.push(index);
      }
      if (chordPartMatched) {
        chordPartMatchedWords.push(index);
      }
      if (firstPartMatched || chordPartMatched) {
        matchedWords.push(index);
      }
      matchFirstPart = matchFirstPart && this.isModifier(word);
    }
    if (matchedWords.length !== words.length) {
      return null;
    }
    if (completeMatch) {
      if (!this.isCompleteMatch(firstPart, firstPartMatch)) {
        return null;
      }
      if (!isEmptyObject(chordPartMatch) && !this.isCompleteMatch(chordPart, chordPartMatch)) {
        return null;
      }
    }
    return this.hasAnyMatch(firstPartMatch) || this.hasAnyMatch(chordPartMatch) ? { firstPart: firstPartMatch, chordPart: chordPartMatch } : null;
  }
  matchPart(chord, match, word, completeMatch) {
    let matched = false;
    if (this.matchesMetaModifier(chord, word)) {
      matched = true;
      match.metaKey = true;
    }
    if (this.matchesCtrlModifier(chord, word)) {
      matched = true;
      match.ctrlKey = true;
    }
    if (this.matchesShiftModifier(chord, word)) {
      matched = true;
      match.shiftKey = true;
    }
    if (this.matchesAltModifier(chord, word)) {
      matched = true;
      match.altKey = true;
    }
    if (this.matchesKeyCode(chord, word, completeMatch)) {
      match.keyCode = true;
      matched = true;
    }
    return matched;
  }
  matchesKeyCode(chord, word, completeMatch) {
    if (!chord) {
      return false;
    }
    const ariaLabel = chord.keyAriaLabel || "";
    if (completeMatch || ariaLabel.length === 1 || word.length === 1) {
      if (strings.compareIgnoreCase(ariaLabel, word) === 0) {
        return true;
      }
    } else {
      if (matchesContiguousSubString(word, ariaLabel)) {
        return true;
      }
    }
    return false;
  }
  matchesMetaModifier(chord, word) {
    if (!chord) {
      return false;
    }
    if (!chord.metaKey) {
      return false;
    }
    return this.wordMatchesMetaModifier(word);
  }
  matchesCtrlModifier(chord, word) {
    if (!chord) {
      return false;
    }
    if (!chord.ctrlKey) {
      return false;
    }
    return this.wordMatchesCtrlModifier(word);
  }
  matchesShiftModifier(chord, word) {
    if (!chord) {
      return false;
    }
    if (!chord.shiftKey) {
      return false;
    }
    return this.wordMatchesShiftModifier(word);
  }
  matchesAltModifier(chord, word) {
    if (!chord) {
      return false;
    }
    if (!chord.altKey) {
      return false;
    }
    return this.wordMatchesAltModifier(word);
  }
  hasAnyMatch(keybindingMatch) {
    return !!keybindingMatch.altKey || !!keybindingMatch.ctrlKey || !!keybindingMatch.metaKey || !!keybindingMatch.shiftKey || !!keybindingMatch.keyCode;
  }
  isCompleteMatch(chord, match) {
    if (!chord) {
      return true;
    }
    if (!match.keyCode) {
      return false;
    }
    if (chord.metaKey && !match.metaKey) {
      return false;
    }
    if (chord.altKey && !match.altKey) {
      return false;
    }
    if (chord.ctrlKey && !match.ctrlKey) {
      return false;
    }
    if (chord.shiftKey && !match.shiftKey) {
      return false;
    }
    return true;
  }
  createCompleteMatch(chord) {
    const match = {};
    if (chord) {
      match.keyCode = true;
      if (chord.metaKey) {
        match.metaKey = true;
      }
      if (chord.altKey) {
        match.altKey = true;
      }
      if (chord.ctrlKey) {
        match.ctrlKey = true;
      }
      if (chord.shiftKey) {
        match.shiftKey = true;
      }
    }
    return match;
  }
  isModifier(word) {
    if (this.wordMatchesAltModifier(word)) {
      return true;
    }
    if (this.wordMatchesCtrlModifier(word)) {
      return true;
    }
    if (this.wordMatchesMetaModifier(word)) {
      return true;
    }
    if (this.wordMatchesShiftModifier(word)) {
      return true;
    }
    return false;
  }
  wordMatchesAltModifier(word) {
    if (strings.equalsIgnoreCase(this.modifierLabels.ui.altKey, word)) {
      return true;
    }
    if (strings.equalsIgnoreCase(this.modifierLabels.aria.altKey, word)) {
      return true;
    }
    if (strings.equalsIgnoreCase(this.modifierLabels.user.altKey, word)) {
      return true;
    }
    if (strings.equalsIgnoreCase(localize("option", "option"), word)) {
      return true;
    }
    return false;
  }
  wordMatchesCtrlModifier(word) {
    if (strings.equalsIgnoreCase(this.modifierLabels.ui.ctrlKey, word)) {
      return true;
    }
    if (strings.equalsIgnoreCase(this.modifierLabels.aria.ctrlKey, word)) {
      return true;
    }
    if (strings.equalsIgnoreCase(this.modifierLabels.user.ctrlKey, word)) {
      return true;
    }
    return false;
  }
  wordMatchesMetaModifier(word) {
    if (strings.equalsIgnoreCase(this.modifierLabels.ui.metaKey, word)) {
      return true;
    }
    if (strings.equalsIgnoreCase(this.modifierLabels.aria.metaKey, word)) {
      return true;
    }
    if (strings.equalsIgnoreCase(this.modifierLabels.user.metaKey, word)) {
      return true;
    }
    if (strings.equalsIgnoreCase(localize("meta", "meta"), word)) {
      return true;
    }
    return false;
  }
  wordMatchesShiftModifier(word) {
    if (strings.equalsIgnoreCase(this.modifierLabels.ui.shiftKey, word)) {
      return true;
    }
    if (strings.equalsIgnoreCase(this.modifierLabels.aria.shiftKey, word)) {
      return true;
    }
    if (strings.equalsIgnoreCase(this.modifierLabels.user.shiftKey, word)) {
      return true;
    }
    return false;
  }
}
export {
  KEYBINDING_ENTRY_TEMPLATE_ID,
  KeybindingsEditorModel,
  createKeybindingCommandQuery
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvcHJlZmVyZW5jZXMvYnJvd3Nlci9rZXliaW5kaW5nc0VkaXRvck1vZGVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgZGlzdGluY3QsIGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBPcGVyYXRpbmdTeXN0ZW0sIExhbmd1YWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSU1hdGNoLCBJRmlsdGVyLCBvciwgbWF0Y2hlc0NvbnRpZ3VvdXNTdWJTdHJpbmcsIG1hdGNoZXNQcmVmaXgsIG1hdGNoZXNDYW1lbENhc2UsIG1hdGNoZXNXb3JkcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0IHsgUmVzb2x2ZWRLZXliaW5kaW5nLCBSZXNvbHZlZENob3JkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5YmluZGluZ3MuanMnO1xuaW1wb3J0IHsgQXJpYUxhYmVsUHJvdmlkZXIsIFVzZXJTZXR0aW5nc0xhYmVsUHJvdmlkZXIsIFVJTGFiZWxQcm92aWRlciwgTW9kaWZpZXJMYWJlbHMgYXMgTW9kTGFiZWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5YmluZGluZ0xhYmVscy5qcyc7XG5pbXBvcnQgeyBNZW51UmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IEVkaXRvck1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JNb2RlbC5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IFJlc29sdmVkS2V5YmluZGluZ0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9yZXNvbHZlZEtleWJpbmRpbmdJdGVtLmpzJztcbmltcG9ydCB7IGdldEFsbFVuYm91bmRDb21tYW5kcyB9IGZyb20gJy4uLy4uL2tleWJpbmRpbmcvYnJvd3Nlci91bmJvdW5kQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdJdGVtRW50cnksIEtleWJpbmRpbmdNYXRjaGVzLCBLZXliaW5kaW5nTWF0Y2gsIElLZXliaW5kaW5nSXRlbSB9IGZyb20gJy4uL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZEFjdGlvbiwgSUxvY2FsaXplZFN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcbmltcG9ydCB7IGlzRW1wdHlPYmplY3QsIGlzU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIsIEV4dGVuc2lvbklkZW50aWZpZXJNYXAsIElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcblxuZXhwb3J0IGNvbnN0IEtFWUJJTkRJTkdfRU5UUllfVEVNUExBVEVfSUQgPSAna2V5YmluZGluZy5lbnRyeS50ZW1wbGF0ZSc7XG5cbmNvbnN0IFNPVVJDRV9TWVNURU0gPSBsb2NhbGl6ZSgnZGVmYXVsdCcsIFwiU3lzdGVtXCIpO1xuY29uc3QgU09VUkNFX0VYVEVOU0lPTiA9IGxvY2FsaXplKCdleHRlbnNpb24nLCBcIkV4dGVuc2lvblwiKTtcbmNvbnN0IFNPVVJDRV9VU0VSID0gbG9jYWxpemUoJ3VzZXInLCBcIlVzZXJcIik7XG5cbmludGVyZmFjZSBNb2RpZmllckxhYmVscyB7XG5cdHVpOiBNb2RMYWJlbHM7XG5cdGFyaWE6IE1vZExhYmVscztcblx0dXNlcjogTW9kTGFiZWxzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlS2V5YmluZGluZ0NvbW1hbmRRdWVyeShjb21tYW5kSWQ6IHN0cmluZywgd2hlbj86IHN0cmluZyk6IHN0cmluZyB7XG5cdGNvbnN0IHdoZW5QYXJ0ID0gd2hlbiA/IGAgK3doZW46JHt3aGVufWAgOiAnJztcblx0cmV0dXJuIGBAY29tbWFuZDoke2NvbW1hbmRJZH0ke3doZW5QYXJ0fWA7XG59XG5cbmNvbnN0IHdvcmRGaWx0ZXIgPSBvcihtYXRjaGVzUHJlZml4LCBtYXRjaGVzV29yZHMsIG1hdGNoZXNDb250aWd1b3VzU3ViU3RyaW5nKTtcbmNvbnN0IENPTU1BTkRfUkVHRVggPSAvQGNvbW1hbmQ6XFxzKihbXlxcK10rKS9pO1xuY29uc3QgV0hFTl9SRUdFWCA9IC9cXCt3aGVuOlxccyooLispL2k7XG5jb25zdCBTT1VSQ0VfUkVHRVggPSAvQHNvdXJjZTpcXHMqKHVzZXJ8ZGVmYXVsdHxzeXN0ZW18ZXh0ZW5zaW9uKS9pO1xuY29uc3QgRVhURU5TSU9OX1JFR0VYID0gL0BleHQ6XFxzKigoXCIuK1wiKXwoW15cXHNdKykpL2k7XG5jb25zdCBLRVlCSU5ESU5HX1JFR0VYID0gL0BrZXliaW5kaW5nOlxccyooKFxcXCIuK1xcXCIpfChcXFMrKSkvaTtcblxuZXhwb3J0IGNsYXNzIEtleWJpbmRpbmdzRWRpdG9yTW9kZWwgZXh0ZW5kcyBFZGl0b3JNb2RlbCB7XG5cblx0cHJpdmF0ZSBfa2V5YmluZGluZ0l0ZW1zOiBJS2V5YmluZGluZ0l0ZW1bXTtcblx0cHJpdmF0ZSBfa2V5YmluZGluZ0l0ZW1zU29ydGVkQnlQcmVjZWRlbmNlOiBJS2V5YmluZGluZ0l0ZW1bXTtcblx0cHJpdmF0ZSBtb2RpZmllckxhYmVsczogTW9kaWZpZXJMYWJlbHM7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3M6IE9wZXJhdGluZ1N5c3RlbSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkga2V5YmluZGluZ3NTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fa2V5YmluZGluZ0l0ZW1zID0gW107XG5cdFx0dGhpcy5fa2V5YmluZGluZ0l0ZW1zU29ydGVkQnlQcmVjZWRlbmNlID0gW107XG5cdFx0dGhpcy5tb2RpZmllckxhYmVscyA9IHtcblx0XHRcdHVpOiBVSUxhYmVsUHJvdmlkZXIubW9kaWZpZXJMYWJlbHNbb3NdLFxuXHRcdFx0YXJpYTogQXJpYUxhYmVsUHJvdmlkZXIubW9kaWZpZXJMYWJlbHNbb3NdLFxuXHRcdFx0dXNlcjogVXNlclNldHRpbmdzTGFiZWxQcm92aWRlci5tb2RpZmllckxhYmVsc1tvc11cblx0XHR9O1xuXHR9XG5cblx0ZmV0Y2goc2VhcmNoVmFsdWU6IHN0cmluZywgc29ydEJ5UHJlY2VkZW5jZTogYm9vbGVhbiA9IGZhbHNlKTogSUtleWJpbmRpbmdJdGVtRW50cnlbXSB7XG5cdFx0bGV0IGtleWJpbmRpbmdJdGVtcyA9IHNvcnRCeVByZWNlZGVuY2UgPyB0aGlzLl9rZXliaW5kaW5nSXRlbXNTb3J0ZWRCeVByZWNlZGVuY2UgOiB0aGlzLl9rZXliaW5kaW5nSXRlbXM7XG5cblx0XHQvLyBAY29tbWFuZDpDT01NQU5EX0lEXG5cdFx0Y29uc3QgY29tbWFuZElkTWF0Y2hlcyA9IENPTU1BTkRfUkVHRVguZXhlYyhzZWFyY2hWYWx1ZSk7XG5cdFx0aWYgKGNvbW1hbmRJZE1hdGNoZXMgJiYgY29tbWFuZElkTWF0Y2hlc1sxXSkge1xuXHRcdFx0Y29uc3QgY29tbWFuZCA9IGNvbW1hbmRJZE1hdGNoZXNbMV0udHJpbSgpO1xuXHRcdFx0bGV0IGZpbHRlcmVkS2V5YmluZGluZ0l0ZW1zID0ga2V5YmluZGluZ0l0ZW1zLmZpbHRlcihrID0+IGsuY29tbWFuZCA9PT0gY29tbWFuZCk7XG5cblx0XHRcdC8vICt3aGVuOldIRU5fRVhQUkVTU0lPTlxuXHRcdFx0aWYgKGZpbHRlcmVkS2V5YmluZGluZ0l0ZW1zLmxlbmd0aCkge1xuXHRcdFx0XHRjb25zdCB3aGVuTWF0Y2hlcyA9IFdIRU5fUkVHRVguZXhlYyhzZWFyY2hWYWx1ZSk7XG5cdFx0XHRcdGlmICh3aGVuTWF0Y2hlcyAmJiB3aGVuTWF0Y2hlc1sxXSkge1xuXHRcdFx0XHRcdGNvbnN0IHdoZW5WYWx1ZSA9IHdoZW5NYXRjaGVzWzFdLnRyaW0oKTtcblx0XHRcdFx0XHRmaWx0ZXJlZEtleWJpbmRpbmdJdGVtcyA9IHRoaXMuZmlsdGVyQnlXaGVuKGZpbHRlcmVkS2V5YmluZGluZ0l0ZW1zLCBjb21tYW5kLCB3aGVuVmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBmaWx0ZXJlZEtleWJpbmRpbmdJdGVtcy5tYXAoKGtleWJpbmRpbmdJdGVtKTogSUtleWJpbmRpbmdJdGVtRW50cnkgPT4gKHsgaWQ6IEtleWJpbmRpbmdzRWRpdG9yTW9kZWwuZ2V0SWQoa2V5YmluZGluZ0l0ZW0pLCBrZXliaW5kaW5nSXRlbSwgdGVtcGxhdGVJZDogS0VZQklORElOR19FTlRSWV9URU1QTEFURV9JRCB9KSk7XG5cdFx0fVxuXG5cdFx0Ly8gQHNvdXJjZTpTT1VSQ0Vcblx0XHRpZiAoU09VUkNFX1JFR0VYLnRlc3Qoc2VhcmNoVmFsdWUpKSB7XG5cdFx0XHRrZXliaW5kaW5nSXRlbXMgPSB0aGlzLmZpbHRlckJ5U291cmNlKGtleWJpbmRpbmdJdGVtcywgc2VhcmNoVmFsdWUpO1xuXHRcdFx0c2VhcmNoVmFsdWUgPSBzZWFyY2hWYWx1ZS5yZXBsYWNlKFNPVVJDRV9SRUdFWCwgJycpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBAZXh0OkVYVEVOU0lPTl9JRFxuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uTWF0Y2hlcyA9IEVYVEVOU0lPTl9SRUdFWC5leGVjKHNlYXJjaFZhbHVlKTtcblx0XHRcdGlmIChleHRlbnNpb25NYXRjaGVzICYmIChleHRlbnNpb25NYXRjaGVzWzJdIHx8IGV4dGVuc2lvbk1hdGNoZXNbM10pKSB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbklkID0gZXh0ZW5zaW9uTWF0Y2hlc1syXSA/IGV4dGVuc2lvbk1hdGNoZXNbMl0uc3Vic3RyaW5nKDEsIGV4dGVuc2lvbk1hdGNoZXNbMl0ubGVuZ3RoIC0gMSkgOiBleHRlbnNpb25NYXRjaGVzWzNdO1xuXHRcdFx0XHRrZXliaW5kaW5nSXRlbXMgPSB0aGlzLmZpbHRlckJ5RXh0ZW5zaW9uKGtleWJpbmRpbmdJdGVtcywgZXh0ZW5zaW9uSWQpO1xuXHRcdFx0XHRzZWFyY2hWYWx1ZSA9IHNlYXJjaFZhbHVlLnJlcGxhY2UoRVhURU5TSU9OX1JFR0VYLCAnJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBAa2V5YmluZGluZzpLRVlCSU5ESU5HXG5cdFx0XHRcdGNvbnN0IGtleWJpbmRpbmdNYXRjaGVzID0gS0VZQklORElOR19SRUdFWC5leGVjKHNlYXJjaFZhbHVlKTtcblx0XHRcdFx0aWYgKGtleWJpbmRpbmdNYXRjaGVzICYmIChrZXliaW5kaW5nTWF0Y2hlc1syXSB8fCBrZXliaW5kaW5nTWF0Y2hlc1szXSkpIHtcblx0XHRcdFx0XHRzZWFyY2hWYWx1ZSA9IGtleWJpbmRpbmdNYXRjaGVzWzJdIHx8IGBcIiR7a2V5YmluZGluZ01hdGNoZXNbM119XCJgO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0c2VhcmNoVmFsdWUgPSBzZWFyY2hWYWx1ZS50cmltKCk7XG5cdFx0aWYgKCFzZWFyY2hWYWx1ZSkge1xuXHRcdFx0cmV0dXJuIGtleWJpbmRpbmdJdGVtcy5tYXAoKGtleWJpbmRpbmdJdGVtKTogSUtleWJpbmRpbmdJdGVtRW50cnkgPT4gKHsgaWQ6IEtleWJpbmRpbmdzRWRpdG9yTW9kZWwuZ2V0SWQoa2V5YmluZGluZ0l0ZW0pLCBrZXliaW5kaW5nSXRlbSwgdGVtcGxhdGVJZDogS0VZQklORElOR19FTlRSWV9URU1QTEFURV9JRCB9KSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZmlsdGVyQnlUZXh0KGtleWJpbmRpbmdJdGVtcywgc2VhcmNoVmFsdWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaWx0ZXJCeVNvdXJjZShrZXliaW5kaW5nSXRlbXM6IElLZXliaW5kaW5nSXRlbVtdLCBzZWFyY2hWYWx1ZTogc3RyaW5nKTogSUtleWJpbmRpbmdJdGVtW10ge1xuXHRcdGlmICgvQHNvdXJjZTpcXHMqZGVmYXVsdC9pLnRlc3Qoc2VhcmNoVmFsdWUpIHx8IC9Ac291cmNlOlxccypzeXN0ZW0vaS50ZXN0KHNlYXJjaFZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIGtleWJpbmRpbmdJdGVtcy5maWx0ZXIoayA9PiBrLnNvdXJjZSA9PT0gU09VUkNFX1NZU1RFTSk7XG5cdFx0fVxuXHRcdGlmICgvQHNvdXJjZTpcXHMqdXNlci9pLnRlc3Qoc2VhcmNoVmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4ga2V5YmluZGluZ0l0ZW1zLmZpbHRlcihrID0+IGsuc291cmNlID09PSBTT1VSQ0VfVVNFUik7XG5cdFx0fVxuXHRcdGlmICgvQHNvdXJjZTpcXHMqZXh0ZW5zaW9uL2kudGVzdChzZWFyY2hWYWx1ZSkpIHtcblx0XHRcdHJldHVybiBrZXliaW5kaW5nSXRlbXMuZmlsdGVyKGsgPT4gIWlzU3RyaW5nKGsuc291cmNlKSB8fCBrLnNvdXJjZSA9PT0gU09VUkNFX0VYVEVOU0lPTik7XG5cdFx0fVxuXHRcdHJldHVybiBrZXliaW5kaW5nSXRlbXM7XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlckJ5RXh0ZW5zaW9uKGtleWJpbmRpbmdJdGVtczogSUtleWJpbmRpbmdJdGVtW10sIGV4dGVuc2lvbjogc3RyaW5nKTogSUtleWJpbmRpbmdJdGVtW10ge1xuXHRcdGV4dGVuc2lvbiA9IGV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcblx0XHRyZXR1cm4ga2V5YmluZGluZ0l0ZW1zLmZpbHRlcihrID0+ICFpc1N0cmluZyhrLnNvdXJjZSkgJiYgKEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKGsuc291cmNlLmlkZW50aWZpZXIsIGV4dGVuc2lvbikgfHwgay5zb3VyY2UuZGlzcGxheU5hbWU/LnRvTG93ZXJDYXNlKCkgPT09IGV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpKSk7XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlckJ5VGV4dChrZXliaW5kaW5nSXRlbXM6IElLZXliaW5kaW5nSXRlbVtdLCBzZWFyY2hWYWx1ZTogc3RyaW5nKTogSUtleWJpbmRpbmdJdGVtRW50cnlbXSB7XG5cdFx0Y29uc3QgcXVvdGVBdEZpcnN0Q2hhciA9IHNlYXJjaFZhbHVlLmNoYXJBdCgwKSA9PT0gJ1wiJztcblx0XHRjb25zdCBxdW90ZUF0TGFzdENoYXIgPSBzZWFyY2hWYWx1ZS5jaGFyQXQoc2VhcmNoVmFsdWUubGVuZ3RoIC0gMSkgPT09ICdcIic7XG5cdFx0Y29uc3QgY29tcGxldGVNYXRjaCA9IHF1b3RlQXRGaXJzdENoYXIgJiYgcXVvdGVBdExhc3RDaGFyO1xuXHRcdGlmIChxdW90ZUF0Rmlyc3RDaGFyKSB7XG5cdFx0XHRzZWFyY2hWYWx1ZSA9IHNlYXJjaFZhbHVlLnN1YnN0cmluZygxKTtcblx0XHR9XG5cdFx0aWYgKHF1b3RlQXRMYXN0Q2hhcikge1xuXHRcdFx0c2VhcmNoVmFsdWUgPSBzZWFyY2hWYWx1ZS5zdWJzdHJpbmcoMCwgc2VhcmNoVmFsdWUubGVuZ3RoIC0gMSk7XG5cdFx0fVxuXHRcdHNlYXJjaFZhbHVlID0gc2VhcmNoVmFsdWUudHJpbSgpO1xuXG5cdFx0Y29uc3QgcmVzdWx0OiBJS2V5YmluZGluZ0l0ZW1FbnRyeVtdID0gW107XG5cdFx0Y29uc3Qgd29yZHMgPSBzZWFyY2hWYWx1ZS5zcGxpdCgnICcpO1xuXHRcdGNvbnN0IGtleWJpbmRpbmdXb3JkcyA9IHRoaXMuc3BsaXRLZXliaW5kaW5nV29yZHMod29yZHMpO1xuXHRcdGZvciAoY29uc3Qga2V5YmluZGluZ0l0ZW0gb2Yga2V5YmluZGluZ0l0ZW1zKSB7XG5cdFx0XHRjb25zdCBrZXliaW5kaW5nTWF0Y2hlcyA9IG5ldyBLZXliaW5kaW5nSXRlbU1hdGNoZXModGhpcy5tb2RpZmllckxhYmVscywga2V5YmluZGluZ0l0ZW0sIHNlYXJjaFZhbHVlLCB3b3Jkcywga2V5YmluZGluZ1dvcmRzLCBjb21wbGV0ZU1hdGNoKTtcblx0XHRcdGlmIChrZXliaW5kaW5nTWF0Y2hlcy5jb21tYW5kSWRNYXRjaGVzXG5cdFx0XHRcdHx8IGtleWJpbmRpbmdNYXRjaGVzLmNvbW1hbmRMYWJlbE1hdGNoZXNcblx0XHRcdFx0fHwga2V5YmluZGluZ01hdGNoZXMuY29tbWFuZERlZmF1bHRMYWJlbE1hdGNoZXNcblx0XHRcdFx0fHwga2V5YmluZGluZ01hdGNoZXMuc291cmNlTWF0Y2hlc1xuXHRcdFx0XHR8fCBrZXliaW5kaW5nTWF0Y2hlcy53aGVuTWF0Y2hlc1xuXHRcdFx0XHR8fCBrZXliaW5kaW5nTWF0Y2hlcy5rZXliaW5kaW5nTWF0Y2hlc1xuXHRcdFx0XHR8fCBrZXliaW5kaW5nTWF0Y2hlcy5leHRlbnNpb25JZE1hdGNoZXNcblx0XHRcdFx0fHwga2V5YmluZGluZ01hdGNoZXMuZXh0ZW5zaW9uTGFiZWxNYXRjaGVzXG5cdFx0XHQpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0XHRcdGlkOiBLZXliaW5kaW5nc0VkaXRvck1vZGVsLmdldElkKGtleWJpbmRpbmdJdGVtKSxcblx0XHRcdFx0XHR0ZW1wbGF0ZUlkOiBLRVlCSU5ESU5HX0VOVFJZX1RFTVBMQVRFX0lELFxuXHRcdFx0XHRcdGNvbW1hbmRMYWJlbE1hdGNoZXM6IGtleWJpbmRpbmdNYXRjaGVzLmNvbW1hbmRMYWJlbE1hdGNoZXMgfHwgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGNvbW1hbmREZWZhdWx0TGFiZWxNYXRjaGVzOiBrZXliaW5kaW5nTWF0Y2hlcy5jb21tYW5kRGVmYXVsdExhYmVsTWF0Y2hlcyB8fCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0a2V5YmluZGluZ0l0ZW0sXG5cdFx0XHRcdFx0a2V5YmluZGluZ01hdGNoZXM6IGtleWJpbmRpbmdNYXRjaGVzLmtleWJpbmRpbmdNYXRjaGVzIHx8IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRjb21tYW5kSWRNYXRjaGVzOiBrZXliaW5kaW5nTWF0Y2hlcy5jb21tYW5kSWRNYXRjaGVzIHx8IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRzb3VyY2VNYXRjaGVzOiBrZXliaW5kaW5nTWF0Y2hlcy5zb3VyY2VNYXRjaGVzIHx8IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR3aGVuTWF0Y2hlczoga2V5YmluZGluZ01hdGNoZXMud2hlbk1hdGNoZXMgfHwgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGV4dGVuc2lvbklkTWF0Y2hlczoga2V5YmluZGluZ01hdGNoZXMuZXh0ZW5zaW9uSWRNYXRjaGVzIHx8IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRleHRlbnNpb25MYWJlbE1hdGNoZXM6IGtleWJpbmRpbmdNYXRjaGVzLmV4dGVuc2lvbkxhYmVsTWF0Y2hlcyB8fCB1bmRlZmluZWRcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlckJ5V2hlbihrZXliaW5kaW5nSXRlbXM6IElLZXliaW5kaW5nSXRlbVtdLCBjb21tYW5kOiBzdHJpbmcsIHdoZW46IHN0cmluZyk6IElLZXliaW5kaW5nSXRlbVtdIHtcblx0XHRpZiAoa2V5YmluZGluZ0l0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIGlmIGEga2V5YmluZGluZyB3aXRoIHRoZSBzYW1lIGNvbW1hbmQgaWQgYW5kIHdoZW4gY2xhdXNlIGV4aXN0c1xuXHRcdGNvbnN0IGtleWJpbmRpbmdJdGVtc1dpdGhXaGVuID0ga2V5YmluZGluZ0l0ZW1zLmZpbHRlcihrID0+IGsud2hlbiA9PT0gd2hlbik7XG5cdFx0aWYgKGtleWJpbmRpbmdJdGVtc1dpdGhXaGVuLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIGtleWJpbmRpbmdJdGVtc1dpdGhXaGVuO1xuXHRcdH1cblxuXHRcdC8vIENyZWF0ZSBhIG5ldyBlbnRyeSB3aXRoIHRoZSB3aGVuIGNsYXVzZSB3aGljaCBkb2VzIG5vdCBsaXZlIGluIHRoZSBtb2RlbFxuXHRcdC8vIFdlIGNhbiByZXVzZSBzb21lIG9mIHRoZSBwcm9wZXJ0aWVzIGZyb20gdGhlIHNhbWUgY29tbWFuZCB3aXRoIGRpZmZlcmVudCB3aGVuIGNsYXVzZVxuXHRcdGNvbnN0IGNvbW1hbmRMYWJlbCA9IGtleWJpbmRpbmdJdGVtc1swXS5jb21tYW5kTGFiZWw7XG5cblx0XHRjb25zdCBrZXliaW5kaW5nSXRlbSA9IG5ldyBSZXNvbHZlZEtleWJpbmRpbmdJdGVtKHVuZGVmaW5lZCwgY29tbWFuZCwgbnVsbCwgQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUod2hlbiksIGZhbHNlLCBudWxsLCBmYWxzZSk7XG5cdFx0Y29uc3QgYWN0aW9uTGFiZWxzID0gbmV3IE1hcChbW2NvbW1hbmQsIGNvbW1hbmRMYWJlbF1dKTtcblx0XHRyZXR1cm4gW0tleWJpbmRpbmdzRWRpdG9yTW9kZWwudG9LZXliaW5kaW5nRW50cnkoY29tbWFuZCwga2V5YmluZGluZ0l0ZW0sIGFjdGlvbkxhYmVscywgdGhpcy5nZXRFeHRlbnNpb25zTWFwcGluZygpKV07XG5cdH1cblxuXHRwcml2YXRlIHNwbGl0S2V5YmluZGluZ1dvcmRzKHdvcmRzU2VwYXJhdGVkQnlTcGFjZXM6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHdvcmQgb2Ygd29yZHNTZXBhcmF0ZWRCeVNwYWNlcykge1xuXHRcdFx0cmVzdWx0LnB1c2goLi4uY29hbGVzY2Uod29yZC5zcGxpdCgnKycpKSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyByZXNvbHZlKGFjdGlvbkxhYmVscyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBleHRlbnNpb25zID0gdGhpcy5nZXRFeHRlbnNpb25zTWFwcGluZygpO1xuXG5cdFx0dGhpcy5fa2V5YmluZGluZ0l0ZW1zU29ydGVkQnlQcmVjZWRlbmNlID0gW107XG5cdFx0Y29uc3QgYm91bmRDb21tYW5kczogTWFwPHN0cmluZywgYm9vbGVhbj4gPSBuZXcgTWFwPHN0cmluZywgYm9vbGVhbj4oKTtcblx0XHRmb3IgKGNvbnN0IGtleWJpbmRpbmcgb2YgdGhpcy5rZXliaW5kaW5nc1NlcnZpY2UuZ2V0S2V5YmluZGluZ3MoKSkge1xuXHRcdFx0aWYgKGtleWJpbmRpbmcuY29tbWFuZCkgeyAvLyBTa2lwIGtleWJpbmRpbmdzIHdpdGhvdXQgY29tbWFuZHNcblx0XHRcdFx0dGhpcy5fa2V5YmluZGluZ0l0ZW1zU29ydGVkQnlQcmVjZWRlbmNlLnB1c2goS2V5YmluZGluZ3NFZGl0b3JNb2RlbC50b0tleWJpbmRpbmdFbnRyeShrZXliaW5kaW5nLmNvbW1hbmQsIGtleWJpbmRpbmcsIGFjdGlvbkxhYmVscywgZXh0ZW5zaW9ucykpO1xuXHRcdFx0XHRib3VuZENvbW1hbmRzLnNldChrZXliaW5kaW5nLmNvbW1hbmQsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGNvbW1hbmRzV2l0aERlZmF1bHRLZXliaW5kaW5ncyA9IHRoaXMua2V5YmluZGluZ3NTZXJ2aWNlLmdldERlZmF1bHRLZXliaW5kaW5ncygpLm1hcChrZXliaW5kaW5nID0+IGtleWJpbmRpbmcuY29tbWFuZCk7XG5cdFx0Zm9yIChjb25zdCBjb21tYW5kIG9mIGdldEFsbFVuYm91bmRDb21tYW5kcyhib3VuZENvbW1hbmRzKSkge1xuXHRcdFx0Y29uc3Qga2V5YmluZGluZ0l0ZW0gPSBuZXcgUmVzb2x2ZWRLZXliaW5kaW5nSXRlbSh1bmRlZmluZWQsIGNvbW1hbmQsIG51bGwsIHVuZGVmaW5lZCwgY29tbWFuZHNXaXRoRGVmYXVsdEtleWJpbmRpbmdzLmluZGV4T2YoY29tbWFuZCkgPT09IC0xLCBudWxsLCBmYWxzZSk7XG5cdFx0XHR0aGlzLl9rZXliaW5kaW5nSXRlbXNTb3J0ZWRCeVByZWNlZGVuY2UucHVzaChLZXliaW5kaW5nc0VkaXRvck1vZGVsLnRvS2V5YmluZGluZ0VudHJ5KGNvbW1hbmQsIGtleWJpbmRpbmdJdGVtLCBhY3Rpb25MYWJlbHMsIGV4dGVuc2lvbnMpKTtcblx0XHR9XG5cdFx0dGhpcy5fa2V5YmluZGluZ0l0ZW1zU29ydGVkQnlQcmVjZWRlbmNlID0gZGlzdGluY3QodGhpcy5fa2V5YmluZGluZ0l0ZW1zU29ydGVkQnlQcmVjZWRlbmNlLCBrZXliaW5kaW5nSXRlbSA9PiBLZXliaW5kaW5nc0VkaXRvck1vZGVsLmdldElkKGtleWJpbmRpbmdJdGVtKSk7XG5cdFx0dGhpcy5fa2V5YmluZGluZ0l0ZW1zID0gdGhpcy5fa2V5YmluZGluZ0l0ZW1zU29ydGVkQnlQcmVjZWRlbmNlLnNsaWNlKDApLnNvcnQoKGEsIGIpID0+IEtleWJpbmRpbmdzRWRpdG9yTW9kZWwuY29tcGFyZUtleWJpbmRpbmdEYXRhKGEsIGIpKTtcblxuXHRcdHJldHVybiBzdXBlci5yZXNvbHZlKCk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBnZXRJZChrZXliaW5kaW5nSXRlbTogSUtleWJpbmRpbmdJdGVtKTogc3RyaW5nIHtcblx0XHRyZXR1cm4ga2V5YmluZGluZ0l0ZW0uY29tbWFuZCArIChrZXliaW5kaW5nSXRlbT8ua2V5YmluZGluZz8uZ2V0QXJpYUxhYmVsKCkgPz8gJycpICsga2V5YmluZGluZ0l0ZW0ud2hlbiArIChpc1N0cmluZyhrZXliaW5kaW5nSXRlbS5zb3VyY2UpID8ga2V5YmluZGluZ0l0ZW0uc291cmNlIDoga2V5YmluZGluZ0l0ZW0uc291cmNlLmlkZW50aWZpZXIudmFsdWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRFeHRlbnNpb25zTWFwcGluZygpOiBFeHRlbnNpb25JZGVudGlmaWVyTWFwPElFeHRlbnNpb25EZXNjcmlwdGlvbj4ge1xuXHRcdGNvbnN0IGV4dGVuc2lvbnMgPSBuZXcgRXh0ZW5zaW9uSWRlbnRpZmllck1hcDxJRXh0ZW5zaW9uRGVzY3JpcHRpb24+KCk7XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgdGhpcy5leHRlbnNpb25TZXJ2aWNlLmV4dGVuc2lvbnMpIHtcblx0XHRcdGV4dGVuc2lvbnMuc2V0KGV4dGVuc2lvbi5pZGVudGlmaWVyLCBleHRlbnNpb24pO1xuXHRcdH1cblx0XHRyZXR1cm4gZXh0ZW5zaW9ucztcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIGNvbXBhcmVLZXliaW5kaW5nRGF0YShhOiBJS2V5YmluZGluZ0l0ZW0sIGI6IElLZXliaW5kaW5nSXRlbSk6IG51bWJlciB7XG5cdFx0aWYgKGEua2V5YmluZGluZyAmJiAhYi5rZXliaW5kaW5nKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHRcdGlmIChiLmtleWJpbmRpbmcgJiYgIWEua2V5YmluZGluZykge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fVxuXHRcdGlmIChhLmNvbW1hbmRMYWJlbCAmJiAhYi5jb21tYW5kTGFiZWwpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cdFx0aWYgKGIuY29tbWFuZExhYmVsICYmICFhLmNvbW1hbmRMYWJlbCkge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fVxuXHRcdGlmIChhLmNvbW1hbmRMYWJlbCAmJiBiLmNvbW1hbmRMYWJlbCkge1xuXHRcdFx0aWYgKGEuY29tbWFuZExhYmVsICE9PSBiLmNvbW1hbmRMYWJlbCkge1xuXHRcdFx0XHRyZXR1cm4gYS5jb21tYW5kTGFiZWwubG9jYWxlQ29tcGFyZShiLmNvbW1hbmRMYWJlbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChhLmNvbW1hbmQgPT09IGIuY29tbWFuZCkge1xuXHRcdFx0cmV0dXJuIGEua2V5YmluZGluZ0l0ZW0uaXNEZWZhdWx0ID8gMSA6IC0xO1xuXHRcdH1cblx0XHRyZXR1cm4gYS5jb21tYW5kLmxvY2FsZUNvbXBhcmUoYi5jb21tYW5kKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIHRvS2V5YmluZGluZ0VudHJ5KGNvbW1hbmQ6IHN0cmluZywga2V5YmluZGluZ0l0ZW06IFJlc29sdmVkS2V5YmluZGluZ0l0ZW0sIGFjdGlvbnM6IE1hcDxzdHJpbmcsIHN0cmluZz4sIGV4dGVuc2lvbnM6IEV4dGVuc2lvbklkZW50aWZpZXJNYXA8SUV4dGVuc2lvbkRlc2NyaXB0aW9uPik6IElLZXliaW5kaW5nSXRlbSB7XG5cdFx0Y29uc3QgbWVudUNvbW1hbmQgPSBNZW51UmVnaXN0cnkuZ2V0Q29tbWFuZChjb21tYW5kKTtcblx0XHRjb25zdCBlZGl0b3JBY3Rpb25MYWJlbCA9IGFjdGlvbnMuZ2V0KGNvbW1hbmQpO1xuXHRcdGxldCBzb3VyY2U6IHN0cmluZyB8IElFeHRlbnNpb25EZXNjcmlwdGlvbiA9IFNPVVJDRV9VU0VSO1xuXHRcdGlmIChrZXliaW5kaW5nSXRlbS5pc0RlZmF1bHQpIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbklkID0ga2V5YmluZGluZ0l0ZW0uZXh0ZW5zaW9uSWQgPz8gKGtleWJpbmRpbmdJdGVtLnJlc29sdmVkS2V5YmluZGluZyA/IHVuZGVmaW5lZCA6IG1lbnVDb21tYW5kPy5zb3VyY2U/LmlkKTtcblx0XHRcdHNvdXJjZSA9IGV4dGVuc2lvbklkID8gZXh0ZW5zaW9ucy5nZXQoZXh0ZW5zaW9uSWQpID8/IFNPVVJDRV9FWFRFTlNJT04gOiBTT1VSQ0VfU1lTVEVNO1xuXHRcdH1cblx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbG9jYWwvY29kZS1uby1kYW5nZXJvdXMtdHlwZS1hc3NlcnRpb25zXG5cdFx0cmV0dXJuIDxJS2V5YmluZGluZ0l0ZW0+e1xuXHRcdFx0a2V5YmluZGluZzoga2V5YmluZGluZ0l0ZW0ucmVzb2x2ZWRLZXliaW5kaW5nLFxuXHRcdFx0a2V5YmluZGluZ0l0ZW0sXG5cdFx0XHRjb21tYW5kLFxuXHRcdFx0Y29tbWFuZExhYmVsOiBLZXliaW5kaW5nc0VkaXRvck1vZGVsLmdldENvbW1hbmRMYWJlbChtZW51Q29tbWFuZCwgZWRpdG9yQWN0aW9uTGFiZWwpLFxuXHRcdFx0Y29tbWFuZERlZmF1bHRMYWJlbDogS2V5YmluZGluZ3NFZGl0b3JNb2RlbC5nZXRDb21tYW5kRGVmYXVsdExhYmVsKG1lbnVDb21tYW5kKSxcblx0XHRcdHdoZW46IGtleWJpbmRpbmdJdGVtLndoZW4gPyBrZXliaW5kaW5nSXRlbS53aGVuLnNlcmlhbGl6ZSgpIDogJycsXG5cdFx0XHRzb3VyY2VcblxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBnZXRDb21tYW5kRGVmYXVsdExhYmVsKG1lbnVDb21tYW5kOiBJQ29tbWFuZEFjdGlvbiB8IHVuZGVmaW5lZCk6IHN0cmluZyB8IG51bGwge1xuXHRcdGlmICghTGFuZ3VhZ2UuaXNEZWZhdWx0VmFyaWFudCgpKSB7XG5cdFx0XHRpZiAobWVudUNvbW1hbmQgJiYgbWVudUNvbW1hbmQudGl0bGUgJiYgKDxJTG9jYWxpemVkU3RyaW5nPm1lbnVDb21tYW5kLnRpdGxlKS5vcmlnaW5hbCkge1xuXHRcdFx0XHRjb25zdCBjYXRlZ29yeTogc3RyaW5nIHwgdW5kZWZpbmVkID0gbWVudUNvbW1hbmQuY2F0ZWdvcnkgPyAoPElMb2NhbGl6ZWRTdHJpbmc+bWVudUNvbW1hbmQuY2F0ZWdvcnkpLm9yaWdpbmFsIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCB0aXRsZSA9ICg8SUxvY2FsaXplZFN0cmluZz5tZW51Q29tbWFuZC50aXRsZSkub3JpZ2luYWw7XG5cdFx0XHRcdHJldHVybiBjYXRlZ29yeSA/IGxvY2FsaXplKCdjYXQudGl0bGUnLCBcInswfTogezF9XCIsIGNhdGVnb3J5LCB0aXRsZSkgOiB0aXRsZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBnZXRDb21tYW5kTGFiZWwobWVudUNvbW1hbmQ6IElDb21tYW5kQWN0aW9uIHwgdW5kZWZpbmVkLCBlZGl0b3JBY3Rpb25MYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcblx0XHRpZiAobWVudUNvbW1hbmQpIHtcblx0XHRcdGNvbnN0IGNhdGVnb3J5OiBzdHJpbmcgfCB1bmRlZmluZWQgPSBtZW51Q29tbWFuZC5jYXRlZ29yeSA/IHR5cGVvZiBtZW51Q29tbWFuZC5jYXRlZ29yeSA9PT0gJ3N0cmluZycgPyBtZW51Q29tbWFuZC5jYXRlZ29yeSA6IG1lbnVDb21tYW5kLmNhdGVnb3J5LnZhbHVlIDogdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgdGl0bGUgPSB0eXBlb2YgbWVudUNvbW1hbmQudGl0bGUgPT09ICdzdHJpbmcnID8gbWVudUNvbW1hbmQudGl0bGUgOiBtZW51Q29tbWFuZC50aXRsZS52YWx1ZTtcblx0XHRcdHJldHVybiBjYXRlZ29yeSA/IGxvY2FsaXplKCdjYXQudGl0bGUnLCBcInswfTogezF9XCIsIGNhdGVnb3J5LCB0aXRsZSkgOiB0aXRsZTtcblx0XHR9XG5cblx0XHRpZiAoZWRpdG9yQWN0aW9uTGFiZWwpIHtcblx0XHRcdHJldHVybiBlZGl0b3JBY3Rpb25MYWJlbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gJyc7XG5cdH1cbn1cblxuY2xhc3MgS2V5YmluZGluZ0l0ZW1NYXRjaGVzIHtcblxuXHRyZWFkb25seSBjb21tYW5kSWRNYXRjaGVzOiBJTWF0Y2hbXSB8IG51bGwgPSBudWxsO1xuXHRyZWFkb25seSBjb21tYW5kTGFiZWxNYXRjaGVzOiBJTWF0Y2hbXSB8IG51bGwgPSBudWxsO1xuXHRyZWFkb25seSBjb21tYW5kRGVmYXVsdExhYmVsTWF0Y2hlczogSU1hdGNoW10gfCBudWxsID0gbnVsbDtcblx0cmVhZG9ubHkgc291cmNlTWF0Y2hlczogSU1hdGNoW10gfCBudWxsID0gbnVsbDtcblx0cmVhZG9ubHkgd2hlbk1hdGNoZXM6IElNYXRjaFtdIHwgbnVsbCA9IG51bGw7XG5cdHJlYWRvbmx5IGtleWJpbmRpbmdNYXRjaGVzOiBLZXliaW5kaW5nTWF0Y2hlcyB8IG51bGwgPSBudWxsO1xuXHRyZWFkb25seSBleHRlbnNpb25JZE1hdGNoZXM6IElNYXRjaFtdIHwgbnVsbCA9IG51bGw7XG5cdHJlYWRvbmx5IGV4dGVuc2lvbkxhYmVsTWF0Y2hlczogSU1hdGNoW10gfCBudWxsID0gbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIG1vZGlmaWVyTGFiZWxzOiBNb2RpZmllckxhYmVscywga2V5YmluZGluZ0l0ZW06IElLZXliaW5kaW5nSXRlbSwgc2VhcmNoVmFsdWU6IHN0cmluZywgd29yZHM6IHN0cmluZ1tdLCBrZXliaW5kaW5nV29yZHM6IHN0cmluZ1tdLCBjb21wbGV0ZU1hdGNoOiBib29sZWFuKSB7XG5cdFx0aWYgKCFjb21wbGV0ZU1hdGNoKSB7XG5cdFx0XHR0aGlzLmNvbW1hbmRJZE1hdGNoZXMgPSB0aGlzLm1hdGNoZXMoc2VhcmNoVmFsdWUsIGtleWJpbmRpbmdJdGVtLmNvbW1hbmQsIG9yKG1hdGNoZXNXb3JkcywgbWF0Y2hlc0NhbWVsQ2FzZSksIHdvcmRzKTtcblx0XHRcdHRoaXMuY29tbWFuZExhYmVsTWF0Y2hlcyA9IGtleWJpbmRpbmdJdGVtLmNvbW1hbmRMYWJlbCA/IHRoaXMubWF0Y2hlcyhzZWFyY2hWYWx1ZSwga2V5YmluZGluZ0l0ZW0uY29tbWFuZExhYmVsLCAod29yZCwgd29yZFRvTWF0Y2hBZ2FpbnN0KSA9PiBtYXRjaGVzV29yZHMod29yZCwga2V5YmluZGluZ0l0ZW0uY29tbWFuZExhYmVsLCB0cnVlKSwgd29yZHMpIDogbnVsbDtcblx0XHRcdHRoaXMuY29tbWFuZERlZmF1bHRMYWJlbE1hdGNoZXMgPSBrZXliaW5kaW5nSXRlbS5jb21tYW5kRGVmYXVsdExhYmVsID8gdGhpcy5tYXRjaGVzKHNlYXJjaFZhbHVlLCBrZXliaW5kaW5nSXRlbS5jb21tYW5kRGVmYXVsdExhYmVsLCAod29yZCwgd29yZFRvTWF0Y2hBZ2FpbnN0KSA9PiBtYXRjaGVzV29yZHMod29yZCwga2V5YmluZGluZ0l0ZW0uY29tbWFuZERlZmF1bHRMYWJlbCwgdHJ1ZSksIHdvcmRzKSA6IG51bGw7XG5cdFx0XHR0aGlzLndoZW5NYXRjaGVzID0ga2V5YmluZGluZ0l0ZW0ud2hlbiA/IHRoaXMubWF0Y2hlcyhudWxsLCBrZXliaW5kaW5nSXRlbS53aGVuLCBvcihtYXRjaGVzV29yZHMsIG1hdGNoZXNDYW1lbENhc2UpLCB3b3JkcykgOiBudWxsO1xuXHRcdFx0aWYgKGlzU3RyaW5nKGtleWJpbmRpbmdJdGVtLnNvdXJjZSkpIHtcblx0XHRcdFx0dGhpcy5zb3VyY2VNYXRjaGVzID0gdGhpcy5tYXRjaGVzKHNlYXJjaFZhbHVlLCBrZXliaW5kaW5nSXRlbS5zb3VyY2UsICh3b3JkLCB3b3JkVG9NYXRjaEFnYWluc3QpID0+IG1hdGNoZXNXb3Jkcyh3b3JkLCBrZXliaW5kaW5nSXRlbS5zb3VyY2UgYXMgc3RyaW5nLCB0cnVlKSwgd29yZHMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5leHRlbnNpb25MYWJlbE1hdGNoZXMgPSBrZXliaW5kaW5nSXRlbS5zb3VyY2UuZGlzcGxheU5hbWUgPyB0aGlzLm1hdGNoZXMoc2VhcmNoVmFsdWUsIGtleWJpbmRpbmdJdGVtLnNvdXJjZS5kaXNwbGF5TmFtZSwgKHdvcmQsIHdvcmRUb01hdGNoQWdhaW5zdCkgPT4gbWF0Y2hlc1dvcmRzKHdvcmQsIGtleWJpbmRpbmdJdGVtLmNvbW1hbmRMYWJlbCwgdHJ1ZSksIHdvcmRzKSA6IG51bGw7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMua2V5YmluZGluZ01hdGNoZXMgPSBrZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nID8gdGhpcy5tYXRjaGVzS2V5YmluZGluZyhrZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nLCBzZWFyY2hWYWx1ZSwga2V5YmluZGluZ1dvcmRzLCBjb21wbGV0ZU1hdGNoKSA6IG51bGw7XG5cdH1cblxuXHRwcml2YXRlIG1hdGNoZXMoc2VhcmNoVmFsdWU6IHN0cmluZyB8IG51bGwsIHdvcmRUb01hdGNoQWdhaW5zdDogc3RyaW5nLCB3b3JkTWF0Y2hlc0ZpbHRlcjogSUZpbHRlciwgd29yZHM6IHN0cmluZ1tdKTogSU1hdGNoW10gfCBudWxsIHtcblx0XHRsZXQgbWF0Y2hlcyA9IHNlYXJjaFZhbHVlID8gd29yZEZpbHRlcihzZWFyY2hWYWx1ZSwgd29yZFRvTWF0Y2hBZ2FpbnN0KSA6IG51bGw7XG5cdFx0aWYgKCFtYXRjaGVzKSB7XG5cdFx0XHRtYXRjaGVzID0gdGhpcy5tYXRjaGVzV29yZHMod29yZHMsIHdvcmRUb01hdGNoQWdhaW5zdCwgd29yZE1hdGNoZXNGaWx0ZXIpO1xuXHRcdH1cblx0XHRpZiAobWF0Y2hlcykge1xuXHRcdFx0bWF0Y2hlcyA9IHRoaXMuZmlsdGVyQW5kU29ydChtYXRjaGVzKTtcblx0XHR9XG5cdFx0cmV0dXJuIG1hdGNoZXM7XG5cdH1cblxuXHRwcml2YXRlIG1hdGNoZXNXb3Jkcyh3b3Jkczogc3RyaW5nW10sIHdvcmRUb01hdGNoQWdhaW5zdDogc3RyaW5nLCB3b3JkTWF0Y2hlc0ZpbHRlcjogSUZpbHRlcik6IElNYXRjaFtdIHwgbnVsbCB7XG5cdFx0bGV0IG1hdGNoZXM6IElNYXRjaFtdIHwgbnVsbCA9IFtdO1xuXHRcdGZvciAoY29uc3Qgd29yZCBvZiB3b3Jkcykge1xuXHRcdFx0Y29uc3Qgd29yZE1hdGNoZXMgPSB3b3JkTWF0Y2hlc0ZpbHRlcih3b3JkLCB3b3JkVG9NYXRjaEFnYWluc3QpO1xuXHRcdFx0aWYgKHdvcmRNYXRjaGVzKSB7XG5cdFx0XHRcdG1hdGNoZXMgPSBbLi4uKG1hdGNoZXMgfHwgW10pLCAuLi53b3JkTWF0Y2hlc107XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtYXRjaGVzID0gbnVsbDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBtYXRjaGVzO1xuXHR9XG5cblx0cHJpdmF0ZSBmaWx0ZXJBbmRTb3J0KG1hdGNoZXM6IElNYXRjaFtdKTogSU1hdGNoW10ge1xuXHRcdHJldHVybiBkaXN0aW5jdChtYXRjaGVzLCAoYSA9PiBhLnN0YXJ0ICsgJy4nICsgYS5lbmQpKS5maWx0ZXIobWF0Y2ggPT4gIW1hdGNoZXMuc29tZShtID0+ICEobS5zdGFydCA9PT0gbWF0Y2guc3RhcnQgJiYgbS5lbmQgPT09IG1hdGNoLmVuZCkgJiYgKG0uc3RhcnQgPD0gbWF0Y2guc3RhcnQgJiYgbS5lbmQgPj0gbWF0Y2guZW5kKSkpLnNvcnQoKGEsIGIpID0+IGEuc3RhcnQgLSBiLnN0YXJ0KTtcblx0fVxuXG5cdHByaXZhdGUgbWF0Y2hlc0tleWJpbmRpbmcoa2V5YmluZGluZzogUmVzb2x2ZWRLZXliaW5kaW5nLCBzZWFyY2hWYWx1ZTogc3RyaW5nLCB3b3Jkczogc3RyaW5nW10sIGNvbXBsZXRlTWF0Y2g6IGJvb2xlYW4pOiBLZXliaW5kaW5nTWF0Y2hlcyB8IG51bGwge1xuXHRcdGNvbnN0IFtmaXJzdFBhcnQsIGNob3JkUGFydF0gPSBrZXliaW5kaW5nLmdldENob3JkcygpO1xuXG5cdFx0Y29uc3QgdXNlclNldHRpbmdzTGFiZWwgPSBrZXliaW5kaW5nLmdldFVzZXJTZXR0aW5nc0xhYmVsKCk7XG5cdFx0Y29uc3QgYXJpYUxhYmVsID0ga2V5YmluZGluZy5nZXRBcmlhTGFiZWwoKTtcblx0XHRjb25zdCBsYWJlbCA9IGtleWJpbmRpbmcuZ2V0TGFiZWwoKTtcblx0XHRpZiAoKHVzZXJTZXR0aW5nc0xhYmVsICYmIHN0cmluZ3MuY29tcGFyZUlnbm9yZUNhc2Uoc2VhcmNoVmFsdWUsIHVzZXJTZXR0aW5nc0xhYmVsKSA9PT0gMClcblx0XHRcdHx8IChhcmlhTGFiZWwgJiYgc3RyaW5ncy5jb21wYXJlSWdub3JlQ2FzZShzZWFyY2hWYWx1ZSwgYXJpYUxhYmVsKSA9PT0gMClcblx0XHRcdHx8IChsYWJlbCAmJiBzdHJpbmdzLmNvbXBhcmVJZ25vcmVDYXNlKHNlYXJjaFZhbHVlLCBsYWJlbCkgPT09IDApKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRmaXJzdFBhcnQ6IHRoaXMuY3JlYXRlQ29tcGxldGVNYXRjaChmaXJzdFBhcnQpLFxuXHRcdFx0XHRjaG9yZFBhcnQ6IHRoaXMuY3JlYXRlQ29tcGxldGVNYXRjaChjaG9yZFBhcnQpXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpcnN0UGFydE1hdGNoOiBLZXliaW5kaW5nTWF0Y2ggPSB7fTtcblx0XHRsZXQgY2hvcmRQYXJ0TWF0Y2g6IEtleWJpbmRpbmdNYXRjaCA9IHt9O1xuXG5cdFx0Y29uc3QgbWF0Y2hlZFdvcmRzOiBudW1iZXJbXSA9IFtdO1xuXHRcdGNvbnN0IGZpcnN0UGFydE1hdGNoZWRXb3JkczogbnVtYmVyW10gPSBbXTtcblx0XHRsZXQgY2hvcmRQYXJ0TWF0Y2hlZFdvcmRzOiBudW1iZXJbXSA9IFtdO1xuXHRcdGxldCBtYXRjaEZpcnN0UGFydCA9IHRydWU7XG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHdvcmRzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0Y29uc3Qgd29yZCA9IHdvcmRzW2luZGV4XTtcblx0XHRcdGxldCBmaXJzdFBhcnRNYXRjaGVkID0gZmFsc2U7XG5cdFx0XHRsZXQgY2hvcmRQYXJ0TWF0Y2hlZCA9IGZhbHNlO1xuXG5cdFx0XHRtYXRjaEZpcnN0UGFydCA9IG1hdGNoRmlyc3RQYXJ0ICYmICFmaXJzdFBhcnRNYXRjaC5rZXlDb2RlO1xuXHRcdFx0bGV0IG1hdGNoQ2hvcmRQYXJ0ID0gIWNob3JkUGFydE1hdGNoLmtleUNvZGU7XG5cblx0XHRcdGlmIChtYXRjaEZpcnN0UGFydCkge1xuXHRcdFx0XHRmaXJzdFBhcnRNYXRjaGVkID0gdGhpcy5tYXRjaFBhcnQoZmlyc3RQYXJ0LCBmaXJzdFBhcnRNYXRjaCwgd29yZCwgY29tcGxldGVNYXRjaCk7XG5cdFx0XHRcdGlmIChmaXJzdFBhcnRNYXRjaC5rZXlDb2RlKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBjb3JkUGFydE1hdGNoZWRXb3JkSW5kZXggb2YgY2hvcmRQYXJ0TWF0Y2hlZFdvcmRzKSB7XG5cdFx0XHRcdFx0XHRpZiAoZmlyc3RQYXJ0TWF0Y2hlZFdvcmRzLmluZGV4T2YoY29yZFBhcnRNYXRjaGVkV29yZEluZGV4KSA9PT0gLTEpIHtcblx0XHRcdFx0XHRcdFx0bWF0Y2hlZFdvcmRzLnNwbGljZShtYXRjaGVkV29yZHMuaW5kZXhPZihjb3JkUGFydE1hdGNoZWRXb3JkSW5kZXgpLCAxKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2hvcmRQYXJ0TWF0Y2ggPSB7fTtcblx0XHRcdFx0XHRjaG9yZFBhcnRNYXRjaGVkV29yZHMgPSBbXTtcblx0XHRcdFx0XHRtYXRjaENob3JkUGFydCA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChtYXRjaENob3JkUGFydCkge1xuXHRcdFx0XHRjaG9yZFBhcnRNYXRjaGVkID0gdGhpcy5tYXRjaFBhcnQoY2hvcmRQYXJ0LCBjaG9yZFBhcnRNYXRjaCwgd29yZCwgY29tcGxldGVNYXRjaCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChmaXJzdFBhcnRNYXRjaGVkKSB7XG5cdFx0XHRcdGZpcnN0UGFydE1hdGNoZWRXb3Jkcy5wdXNoKGluZGV4KTtcblx0XHRcdH1cblx0XHRcdGlmIChjaG9yZFBhcnRNYXRjaGVkKSB7XG5cdFx0XHRcdGNob3JkUGFydE1hdGNoZWRXb3Jkcy5wdXNoKGluZGV4KTtcblx0XHRcdH1cblx0XHRcdGlmIChmaXJzdFBhcnRNYXRjaGVkIHx8IGNob3JkUGFydE1hdGNoZWQpIHtcblx0XHRcdFx0bWF0Y2hlZFdvcmRzLnB1c2goaW5kZXgpO1xuXHRcdFx0fVxuXG5cdFx0XHRtYXRjaEZpcnN0UGFydCA9IG1hdGNoRmlyc3RQYXJ0ICYmIHRoaXMuaXNNb2RpZmllcih3b3JkKTtcblx0XHR9XG5cdFx0aWYgKG1hdGNoZWRXb3Jkcy5sZW5ndGggIT09IHdvcmRzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlmIChjb21wbGV0ZU1hdGNoKSB7XG5cdFx0XHRpZiAoIXRoaXMuaXNDb21wbGV0ZU1hdGNoKGZpcnN0UGFydCwgZmlyc3RQYXJ0TWF0Y2gpKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFpc0VtcHR5T2JqZWN0KGNob3JkUGFydE1hdGNoKSAmJiAhdGhpcy5pc0NvbXBsZXRlTWF0Y2goY2hvcmRQYXJ0LCBjaG9yZFBhcnRNYXRjaCkpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmhhc0FueU1hdGNoKGZpcnN0UGFydE1hdGNoKSB8fCB0aGlzLmhhc0FueU1hdGNoKGNob3JkUGFydE1hdGNoKSA/IHsgZmlyc3RQYXJ0OiBmaXJzdFBhcnRNYXRjaCwgY2hvcmRQYXJ0OiBjaG9yZFBhcnRNYXRjaCB9IDogbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgbWF0Y2hQYXJ0KGNob3JkOiBSZXNvbHZlZENob3JkIHwgbnVsbCwgbWF0Y2g6IEtleWJpbmRpbmdNYXRjaCwgd29yZDogc3RyaW5nLCBjb21wbGV0ZU1hdGNoOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0bGV0IG1hdGNoZWQgPSBmYWxzZTtcblx0XHRpZiAodGhpcy5tYXRjaGVzTWV0YU1vZGlmaWVyKGNob3JkLCB3b3JkKSkge1xuXHRcdFx0bWF0Y2hlZCA9IHRydWU7XG5cdFx0XHRtYXRjaC5tZXRhS2V5ID0gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMubWF0Y2hlc0N0cmxNb2RpZmllcihjaG9yZCwgd29yZCkpIHtcblx0XHRcdG1hdGNoZWQgPSB0cnVlO1xuXHRcdFx0bWF0Y2guY3RybEtleSA9IHRydWU7XG5cdFx0fVxuXHRcdGlmICh0aGlzLm1hdGNoZXNTaGlmdE1vZGlmaWVyKGNob3JkLCB3b3JkKSkge1xuXHRcdFx0bWF0Y2hlZCA9IHRydWU7XG5cdFx0XHRtYXRjaC5zaGlmdEtleSA9IHRydWU7XG5cdFx0fVxuXHRcdGlmICh0aGlzLm1hdGNoZXNBbHRNb2RpZmllcihjaG9yZCwgd29yZCkpIHtcblx0XHRcdG1hdGNoZWQgPSB0cnVlO1xuXHRcdFx0bWF0Y2guYWx0S2V5ID0gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMubWF0Y2hlc0tleUNvZGUoY2hvcmQsIHdvcmQsIGNvbXBsZXRlTWF0Y2gpKSB7XG5cdFx0XHRtYXRjaC5rZXlDb2RlID0gdHJ1ZTtcblx0XHRcdG1hdGNoZWQgPSB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gbWF0Y2hlZDtcblx0fVxuXG5cdHByaXZhdGUgbWF0Y2hlc0tleUNvZGUoY2hvcmQ6IFJlc29sdmVkQ2hvcmQgfCBudWxsLCB3b3JkOiBzdHJpbmcsIGNvbXBsZXRlTWF0Y2g6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRpZiAoIWNob3JkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IGFyaWFMYWJlbDogc3RyaW5nID0gY2hvcmQua2V5QXJpYUxhYmVsIHx8ICcnO1xuXHRcdGlmIChjb21wbGV0ZU1hdGNoIHx8IGFyaWFMYWJlbC5sZW5ndGggPT09IDEgfHwgd29yZC5sZW5ndGggPT09IDEpIHtcblx0XHRcdGlmIChzdHJpbmdzLmNvbXBhcmVJZ25vcmVDYXNlKGFyaWFMYWJlbCwgd29yZCkgPT09IDApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChtYXRjaGVzQ29udGlndW91c1N1YlN0cmluZyh3b3JkLCBhcmlhTGFiZWwpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIG1hdGNoZXNNZXRhTW9kaWZpZXIoY2hvcmQ6IFJlc29sdmVkQ2hvcmQgfCBudWxsLCB3b3JkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRpZiAoIWNob3JkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICghY2hvcmQubWV0YUtleSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy53b3JkTWF0Y2hlc01ldGFNb2RpZmllcih3b3JkKTtcblx0fVxuXG5cdHByaXZhdGUgbWF0Y2hlc0N0cmxNb2RpZmllcihjaG9yZDogUmVzb2x2ZWRDaG9yZCB8IG51bGwsIHdvcmQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGlmICghY2hvcmQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCFjaG9yZC5jdHJsS2V5KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLndvcmRNYXRjaGVzQ3RybE1vZGlmaWVyKHdvcmQpO1xuXHR9XG5cblx0cHJpdmF0ZSBtYXRjaGVzU2hpZnRNb2RpZmllcihjaG9yZDogUmVzb2x2ZWRDaG9yZCB8IG51bGwsIHdvcmQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGlmICghY2hvcmQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCFjaG9yZC5zaGlmdEtleSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy53b3JkTWF0Y2hlc1NoaWZ0TW9kaWZpZXIod29yZCk7XG5cdH1cblxuXHRwcml2YXRlIG1hdGNoZXNBbHRNb2RpZmllcihjaG9yZDogUmVzb2x2ZWRDaG9yZCB8IG51bGwsIHdvcmQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGlmICghY2hvcmQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCFjaG9yZC5hbHRLZXkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMud29yZE1hdGNoZXNBbHRNb2RpZmllcih3b3JkKTtcblx0fVxuXG5cdHByaXZhdGUgaGFzQW55TWF0Y2goa2V5YmluZGluZ01hdGNoOiBLZXliaW5kaW5nTWF0Y2gpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISFrZXliaW5kaW5nTWF0Y2guYWx0S2V5IHx8XG5cdFx0XHQhIWtleWJpbmRpbmdNYXRjaC5jdHJsS2V5IHx8XG5cdFx0XHQhIWtleWJpbmRpbmdNYXRjaC5tZXRhS2V5IHx8XG5cdFx0XHQhIWtleWJpbmRpbmdNYXRjaC5zaGlmdEtleSB8fFxuXHRcdFx0ISFrZXliaW5kaW5nTWF0Y2gua2V5Q29kZTtcblx0fVxuXG5cdHByaXZhdGUgaXNDb21wbGV0ZU1hdGNoKGNob3JkOiBSZXNvbHZlZENob3JkIHwgbnVsbCwgbWF0Y2g6IEtleWJpbmRpbmdNYXRjaCk6IGJvb2xlYW4ge1xuXHRcdGlmICghY2hvcmQpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIW1hdGNoLmtleUNvZGUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKGNob3JkLm1ldGFLZXkgJiYgIW1hdGNoLm1ldGFLZXkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKGNob3JkLmFsdEtleSAmJiAhbWF0Y2guYWx0S2V5KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmIChjaG9yZC5jdHJsS2V5ICYmICFtYXRjaC5jdHJsS2V5KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmIChjaG9yZC5zaGlmdEtleSAmJiAhbWF0Y2guc2hpZnRLZXkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUNvbXBsZXRlTWF0Y2goY2hvcmQ6IFJlc29sdmVkQ2hvcmQgfCBudWxsKTogS2V5YmluZGluZ01hdGNoIHtcblx0XHRjb25zdCBtYXRjaDogS2V5YmluZGluZ01hdGNoID0ge307XG5cdFx0aWYgKGNob3JkKSB7XG5cdFx0XHRtYXRjaC5rZXlDb2RlID0gdHJ1ZTtcblx0XHRcdGlmIChjaG9yZC5tZXRhS2V5KSB7XG5cdFx0XHRcdG1hdGNoLm1ldGFLZXkgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNob3JkLmFsdEtleSkge1xuXHRcdFx0XHRtYXRjaC5hbHRLZXkgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNob3JkLmN0cmxLZXkpIHtcblx0XHRcdFx0bWF0Y2guY3RybEtleSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoY2hvcmQuc2hpZnRLZXkpIHtcblx0XHRcdFx0bWF0Y2guc2hpZnRLZXkgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbWF0Y2g7XG5cdH1cblxuXHRwcml2YXRlIGlzTW9kaWZpZXIod29yZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMud29yZE1hdGNoZXNBbHRNb2RpZmllcih3b3JkKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICh0aGlzLndvcmRNYXRjaGVzQ3RybE1vZGlmaWVyKHdvcmQpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMud29yZE1hdGNoZXNNZXRhTW9kaWZpZXIod29yZCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAodGhpcy53b3JkTWF0Y2hlc1NoaWZ0TW9kaWZpZXIod29yZCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIHdvcmRNYXRjaGVzQWx0TW9kaWZpZXIod29yZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKHN0cmluZ3MuZXF1YWxzSWdub3JlQ2FzZSh0aGlzLm1vZGlmaWVyTGFiZWxzLnVpLmFsdEtleSwgd29yZCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoc3RyaW5ncy5lcXVhbHNJZ25vcmVDYXNlKHRoaXMubW9kaWZpZXJMYWJlbHMuYXJpYS5hbHRLZXksIHdvcmQpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHN0cmluZ3MuZXF1YWxzSWdub3JlQ2FzZSh0aGlzLm1vZGlmaWVyTGFiZWxzLnVzZXIuYWx0S2V5LCB3b3JkKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmIChzdHJpbmdzLmVxdWFsc0lnbm9yZUNhc2UobG9jYWxpemUoJ29wdGlvbicsIFwib3B0aW9uXCIpLCB3b3JkKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgd29yZE1hdGNoZXNDdHJsTW9kaWZpZXIod29yZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKHN0cmluZ3MuZXF1YWxzSWdub3JlQ2FzZSh0aGlzLm1vZGlmaWVyTGFiZWxzLnVpLmN0cmxLZXksIHdvcmQpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHN0cmluZ3MuZXF1YWxzSWdub3JlQ2FzZSh0aGlzLm1vZGlmaWVyTGFiZWxzLmFyaWEuY3RybEtleSwgd29yZCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoc3RyaW5ncy5lcXVhbHNJZ25vcmVDYXNlKHRoaXMubW9kaWZpZXJMYWJlbHMudXNlci5jdHJsS2V5LCB3b3JkKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgd29yZE1hdGNoZXNNZXRhTW9kaWZpZXIod29yZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKHN0cmluZ3MuZXF1YWxzSWdub3JlQ2FzZSh0aGlzLm1vZGlmaWVyTGFiZWxzLnVpLm1ldGFLZXksIHdvcmQpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHN0cmluZ3MuZXF1YWxzSWdub3JlQ2FzZSh0aGlzLm1vZGlmaWVyTGFiZWxzLmFyaWEubWV0YUtleSwgd29yZCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoc3RyaW5ncy5lcXVhbHNJZ25vcmVDYXNlKHRoaXMubW9kaWZpZXJMYWJlbHMudXNlci5tZXRhS2V5LCB3b3JkKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmIChzdHJpbmdzLmVxdWFsc0lnbm9yZUNhc2UobG9jYWxpemUoJ21ldGEnLCBcIm1ldGFcIiksIHdvcmQpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSB3b3JkTWF0Y2hlc1NoaWZ0TW9kaWZpZXIod29yZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKHN0cmluZ3MuZXF1YWxzSWdub3JlQ2FzZSh0aGlzLm1vZGlmaWVyTGFiZWxzLnVpLnNoaWZ0S2V5LCB3b3JkKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmIChzdHJpbmdzLmVxdWFsc0lnbm9yZUNhc2UodGhpcy5tb2RpZmllckxhYmVscy5hcmlhLnNoaWZ0S2V5LCB3b3JkKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmIChzdHJpbmdzLmVxdWFsc0lnbm9yZUNhc2UodGhpcy5tb2RpZmllckxhYmVscy51c2VyLnNoaWZ0S2V5LCB3b3JkKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFVBQVUsZ0JBQWdCO0FBQ25DLFlBQVksYUFBYTtBQUN6QixTQUEwQixnQkFBZ0I7QUFDMUMsU0FBMEIsSUFBSSw0QkFBNEIsZUFBZSxrQkFBa0Isb0JBQW9CO0FBRS9HLFNBQVMsbUJBQW1CLDJCQUEyQix1QkFBb0Q7QUFDM0csU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyw2QkFBNkI7QUFHdEMsU0FBUyxlQUFlLGdCQUFnQjtBQUN4QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQiw4QkFBcUQ7QUFDbkYsU0FBUyxzQkFBc0I7QUFFeEIsTUFBTSwrQkFBK0I7QUFFNUMsTUFBTSxnQkFBZ0IsU0FBUyxXQUFXLFFBQVE7QUFDbEQsTUFBTSxtQkFBbUIsU0FBUyxhQUFhLFdBQVc7QUFDMUQsTUFBTSxjQUFjLFNBQVMsUUFBUSxNQUFNO0FBUXBDLFNBQVMsNkJBQTZCLFdBQW1CLE1BQXVCO0FBQ3RG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
