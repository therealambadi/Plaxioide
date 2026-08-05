import { implies, ContextKeyExprType, expressionsAreEqualWithConstantSubstitution } from "../../contextkey/common/contextkey.js";
var ResultKind = /* @__PURE__ */ ((ResultKind2) => {
  ResultKind2[ResultKind2["NoMatchingKb"] = 0] = "NoMatchingKb";
  ResultKind2[ResultKind2["MoreChordsNeeded"] = 1] = "MoreChordsNeeded";
  ResultKind2[ResultKind2["KbFound"] = 2] = "KbFound";
  return ResultKind2;
})(ResultKind || {});
const NoMatchingKb = { kind: 0 /* NoMatchingKb */ };
const MoreChordsNeeded = { kind: 1 /* MoreChordsNeeded */ };
function KbFound(commandId, commandArgs, isBubble) {
  return { kind: 2 /* KbFound */, commandId, commandArgs, isBubble };
}
class KeybindingResolver {
  constructor(defaultKeybindings, overrides, log) {
    this._log = log;
    this._defaultKeybindings = defaultKeybindings;
    this._defaultBoundCommands = /* @__PURE__ */ new Map();
    for (const defaultKeybinding of defaultKeybindings) {
      const command = defaultKeybinding.command;
      if (command && command.charAt(0) !== "-") {
        this._defaultBoundCommands.set(command, true);
      }
    }
    this._map = /* @__PURE__ */ new Map();
    this._lookupMap = /* @__PURE__ */ new Map();
    this._keybindings = KeybindingResolver.handleRemovals([].concat(defaultKeybindings).concat(overrides));
    for (let i = 0, len = this._keybindings.length; i < len; i++) {
      const k = this._keybindings[i];
      if (k.chords.length === 0) {
        continue;
      }
      const when = k.when?.substituteConstants();
      if (when && when.type === ContextKeyExprType.False) {
        continue;
      }
      this._addKeyPress(k.chords[0], k);
    }
  }
  static _isTargetedForRemoval(defaultKb, keypress, when) {
    if (keypress) {
      for (let i = 0; i < keypress.length; i++) {
        if (keypress[i] !== defaultKb.chords[i]) {
          return false;
        }
      }
    }
    if (when && when.type !== ContextKeyExprType.True) {
      if (!defaultKb.when) {
        return false;
      }
      if (!expressionsAreEqualWithConstantSubstitution(when, defaultKb.when)) {
        return false;
      }
    }
    return true;
  }
  /**
   * Looks for rules containing "-commandId" and removes them.
   */
  static handleRemovals(rules) {
    const removals = /* @__PURE__ */ new Map();
    for (let i = 0, len = rules.length; i < len; i++) {
      const rule = rules[i];
      if (rule.command && rule.command.charAt(0) === "-") {
        const command = rule.command.substring(1);
        if (!removals.has(command)) {
          removals.set(command, [rule]);
        } else {
          removals.get(command).push(rule);
        }
      }
    }
    if (removals.size === 0) {
      return rules;
    }
    const result = [];
    for (let i = 0, len = rules.length; i < len; i++) {
      const rule = rules[i];
      if (!rule.command || rule.command.length === 0) {
        result.push(rule);
        continue;
      }
      if (rule.command.charAt(0) === "-") {
        continue;
      }
      const commandRemovals = removals.get(rule.command);
      if (!commandRemovals || !rule.isDefault) {
        result.push(rule);
        continue;
      }
      let isRemoved = false;
      for (const commandRemoval of commandRemovals) {
        const when = commandRemoval.when;
        if (this._isTargetedForRemoval(rule, commandRemoval.chords, when)) {
          isRemoved = true;
          break;
        }
      }
      if (!isRemoved) {
        result.push(rule);
        continue;
      }
    }
    return result;
  }
  _addKeyPress(keypress, item) {
    const conflicts = this._map.get(keypress);
    if (typeof conflicts === "undefined") {
      this._map.set(keypress, [item]);
      this._addToLookupMap(item);
      return;
    }
    for (let i = conflicts.length - 1; i >= 0; i--) {
      const conflict = conflicts[i];
      if (conflict.command === item.command) {
        continue;
      }
      let isShorterKbPrefix = true;
      for (let i2 = 1; i2 < conflict.chords.length && i2 < item.chords.length; i2++) {
        if (conflict.chords[i2] !== item.chords[i2]) {
          isShorterKbPrefix = false;
          break;
        }
      }
      if (!isShorterKbPrefix) {
        continue;
      }
      if (KeybindingResolver.whenIsEntirelyIncluded(conflict.when, item.when)) {
        this._removeFromLookupMap(conflict);
      }
    }
    conflicts.push(item);
    this._addToLookupMap(item);
  }
  _addToLookupMap(item) {
    if (!item.command) {
      return;
    }
    let arr = this._lookupMap.get(item.command);
    if (typeof arr === "undefined") {
      arr = [item];
      this._lookupMap.set(item.command, arr);
    } else {
      arr.push(item);
    }
  }
  _removeFromLookupMap(item) {
    if (!item.command) {
      return;
    }
    const arr = this._lookupMap.get(item.command);
    if (typeof arr === "undefined") {
      return;
    }
    for (let i = 0, len = arr.length; i < len; i++) {
      if (arr[i] === item) {
        arr.splice(i, 1);
        return;
      }
    }
  }
  /**
   * Returns true if it is provable `a` implies `b`.
   */
  static whenIsEntirelyIncluded(a, b) {
    if (!b || b.type === ContextKeyExprType.True) {
      return true;
    }
    if (!a || a.type === ContextKeyExprType.True) {
      return false;
    }
    return implies(a, b);
  }
  getDefaultBoundCommands() {
    return this._defaultBoundCommands;
  }
  getDefaultKeybindings() {
    return this._defaultKeybindings;
  }
  getKeybindings() {
    return this._keybindings;
  }
  lookupKeybindings(commandId) {
    const items = this._lookupMap.get(commandId);
    if (typeof items === "undefined" || items.length === 0) {
      return [];
    }
    const result = [];
    let resultLen = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      result[resultLen++] = items[i];
    }
    return result;
  }
  lookupPrimaryKeybinding(commandId, context, enforceContextCheck = false) {
    const items = this._lookupMap.get(commandId);
    if (typeof items === "undefined" || items.length === 0) {
      return null;
    }
    if (items.length === 1 && !enforceContextCheck) {
      return items[0];
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (context.contextMatchesRules(item.when)) {
        return item;
      }
    }
    if (enforceContextCheck) {
      return null;
    }
    return items[items.length - 1];
  }
  /**
   * Looks up a keybinding trigged as a result of pressing a sequence of chords - `[...currentChords, keypress]`
   *
   * Example: resolving 3 chords pressed sequentially - `cmd+k cmd+p cmd+i`:
   * 	`currentChords = [ 'cmd+k' , 'cmd+p' ]` and `keypress = `cmd+i` - last pressed chord
   */
  resolve(context, currentChords, keypress) {
    const pressedChords = [...currentChords, keypress];
    this._log(`| Resolving ${pressedChords}`);
    const kbCandidates = this._map.get(pressedChords[0]);
    if (kbCandidates === void 0) {
      this._log(`\\ No keybinding entries.`);
      return NoMatchingKb;
    }
    let lookupMap = null;
    if (pressedChords.length < 2) {
      lookupMap = kbCandidates;
    } else {
      lookupMap = [];
      for (let i = 0, len = kbCandidates.length; i < len; i++) {
        const candidate = kbCandidates[i];
        if (pressedChords.length > candidate.chords.length) {
          continue;
        }
        let prefixMatches = true;
        for (let i2 = 1; i2 < pressedChords.length; i2++) {
          if (candidate.chords[i2] !== pressedChords[i2]) {
            prefixMatches = false;
            break;
          }
        }
        if (prefixMatches) {
          lookupMap.push(candidate);
        }
      }
    }
    const result = this._findCommand(context, lookupMap);
    if (!result) {
      this._log(`\\ From ${lookupMap.length} keybinding entries, no when clauses matched the context.`);
      return NoMatchingKb;
    }
    if (pressedChords.length < result.chords.length) {
      this._log(`\\ From ${lookupMap.length} keybinding entries, awaiting ${result.chords.length - pressedChords.length} more chord(s), when: ${printWhenExplanation(result.when)}, source: ${printSourceExplanation(result)}.`);
      return MoreChordsNeeded;
    }
    this._log(`\\ From ${lookupMap.length} keybinding entries, matched ${result.command}, when: ${printWhenExplanation(result.when)}, source: ${printSourceExplanation(result)}.`);
    return KbFound(result.command, result.commandArgs, result.bubble);
  }
  _findCommand(context, matches) {
    for (let i = matches.length - 1; i >= 0; i--) {
      const k = matches[i];
      if (!KeybindingResolver._contextMatchesRules(context, k.when)) {
        continue;
      }
      return k;
    }
    return null;
  }
  static _contextMatchesRules(context, rules) {
    if (!rules) {
      return true;
    }
    return rules.evaluate(context);
  }
}
function printWhenExplanation(when) {
  if (!when) {
    return `no when condition`;
  }
  return `${when.serialize()}`;
}
function printSourceExplanation(kb) {
  return kb.extensionId ? kb.isBuiltinExtension ? `built-in extension ${kb.extensionId}` : `user extension ${kb.extensionId}` : kb.isDefault ? `built-in` : `user`;
}
export {
  KeybindingResolver,
  NoMatchingKb,
  ResultKind
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nUmVzb2x2ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBpbXBsaWVzLCBDb250ZXh0S2V5RXhwcmVzc2lvbiwgQ29udGV4dEtleUV4cHJUeXBlLCBJQ29udGV4dCwgSUNvbnRleHRLZXlTZXJ2aWNlLCBleHByZXNzaW9uc0FyZUVxdWFsV2l0aENvbnN0YW50U3Vic3RpdHV0aW9uIH0gZnJvbSAnLi4vLi4vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBSZXNvbHZlZEtleWJpbmRpbmdJdGVtIH0gZnJvbSAnLi9yZXNvbHZlZEtleWJpbmRpbmdJdGVtLmpzJztcblxuLy8jcmVnaW9uIHJlc29sdXRpb24tcmVzdWx0XG5cbmV4cG9ydCBjb25zdCBlbnVtIFJlc3VsdEtpbmQge1xuXHQvKiogTm8ga2V5YmluZGluZyBmb3VuZCB0aGlzIHNlcXVlbmNlIG9mIGNob3JkcyAqL1xuXHROb01hdGNoaW5nS2IsXG5cblx0LyoqIFRoZXJlJ3JlIHNldmVyYWwga2V5YmluZGluZ3MgdGhhdCBoYXZlIHRoZSBnaXZlbiBzZXF1ZW5jZSBvZiBjaG9yZHMgYXMgYSBwcmVmaXggKi9cblx0TW9yZUNob3Jkc05lZWRlZCxcblxuXHQvKiogQSBzaW5nbGUga2V5YmluZGluZyBmb3VuZCB0byBiZSBkaXNwYXRjaGVkL2ludm9rZWQgKi9cblx0S2JGb3VuZFxufVxuXG5leHBvcnQgdHlwZSBSZXNvbHV0aW9uUmVzdWx0ID1cblx0fCB7IGtpbmQ6IFJlc3VsdEtpbmQuTm9NYXRjaGluZ0tiIH1cblx0fCB7IGtpbmQ6IFJlc3VsdEtpbmQuTW9yZUNob3Jkc05lZWRlZCB9XG5cdHwgeyBraW5kOiBSZXN1bHRLaW5kLktiRm91bmQ7IGNvbW1hbmRJZDogc3RyaW5nIHwgbnVsbDsgY29tbWFuZEFyZ3M6IGFueTsgaXNCdWJibGU6IGJvb2xlYW4gfTtcblxuXG4vLyB1dGlsIGRlZmluaXRpb25zIHRvIG1ha2Ugd29ya2luZyB3aXRoIHRoZSBhYm92ZSB0eXBlcyBlYXNpZXIgd2l0aGluIHRoaXMgbW9kdWxlOlxuXG5leHBvcnQgY29uc3QgTm9NYXRjaGluZ0tiOiBSZXNvbHV0aW9uUmVzdWx0ID0geyBraW5kOiBSZXN1bHRLaW5kLk5vTWF0Y2hpbmdLYiB9O1xuY29uc3QgTW9yZUNob3Jkc05lZWRlZDogUmVzb2x1dGlvblJlc3VsdCA9IHsga2luZDogUmVzdWx0S2luZC5Nb3JlQ2hvcmRzTmVlZGVkIH07XG5mdW5jdGlvbiBLYkZvdW5kKGNvbW1hbmRJZDogc3RyaW5nIHwgbnVsbCwgY29tbWFuZEFyZ3M6IGFueSwgaXNCdWJibGU6IGJvb2xlYW4pOiBSZXNvbHV0aW9uUmVzdWx0IHtcblx0cmV0dXJuIHsga2luZDogUmVzdWx0S2luZC5LYkZvdW5kLCBjb21tYW5kSWQsIGNvbW1hbmRBcmdzLCBpc0J1YmJsZSB9O1xufVxuXG4vLyNlbmRyZWdpb25cblxuLyoqXG4gKiBTdG9yZXMgbWFwcGluZ3MgZnJvbSBrZXliaW5kaW5ncyB0byBjb21tYW5kcyBhbmQgZnJvbSBjb21tYW5kcyB0byBrZXliaW5kaW5ncy5cbiAqIEdpdmVuIGEgc2VxdWVuY2Ugb2YgY2hvcmRzLCBgcmVzb2x2ZWBzIHdoaWNoIGtleWJpbmRpbmcgaXQgbWF0Y2hlc1xuICovXG5leHBvcnQgY2xhc3MgS2V5YmluZGluZ1Jlc29sdmVyIHtcblx0cHJpdmF0ZSByZWFkb25seSBfbG9nOiAoc3RyOiBzdHJpbmcpID0+IHZvaWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlZmF1bHRLZXliaW5kaW5nczogUmVzb2x2ZWRLZXliaW5kaW5nSXRlbVtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9rZXliaW5kaW5nczogUmVzb2x2ZWRLZXliaW5kaW5nSXRlbVtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWZhdWx0Qm91bmRDb21tYW5kczogTWFwPC8qIGNvbW1hbmRJZCAqLyBzdHJpbmcsIGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tYXA6IE1hcDwvKiAxc3QgY2hvcmQncyBrZXlwcmVzcyAqLyBzdHJpbmcsIFJlc29sdmVkS2V5YmluZGluZ0l0ZW1bXT47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xvb2t1cE1hcDogTWFwPC8qIGNvbW1hbmRJZCAqLyBzdHJpbmcsIFJlc29sdmVkS2V5YmluZGluZ0l0ZW1bXT47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0LyoqIGJ1aWx0LWluIGFuZCBleHRlbnNpb24tcHJvdmlkZWQga2V5YmluZGluZ3MgKi9cblx0XHRkZWZhdWx0S2V5YmluZGluZ3M6IFJlc29sdmVkS2V5YmluZGluZ0l0ZW1bXSxcblx0XHQvKiogdXNlcidzIGtleWJpbmRpbmdzICovXG5cdFx0b3ZlcnJpZGVzOiBSZXNvbHZlZEtleWJpbmRpbmdJdGVtW10sXG5cdFx0bG9nOiAoc3RyOiBzdHJpbmcpID0+IHZvaWRcblx0KSB7XG5cdFx0dGhpcy5fbG9nID0gbG9nO1xuXHRcdHRoaXMuX2RlZmF1bHRLZXliaW5kaW5ncyA9IGRlZmF1bHRLZXliaW5kaW5ncztcblxuXHRcdHRoaXMuX2RlZmF1bHRCb3VuZENvbW1hbmRzID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG5cdFx0Zm9yIChjb25zdCBkZWZhdWx0S2V5YmluZGluZyBvZiBkZWZhdWx0S2V5YmluZGluZ3MpIHtcblx0XHRcdGNvbnN0IGNvbW1hbmQgPSBkZWZhdWx0S2V5YmluZGluZy5jb21tYW5kO1xuXHRcdFx0aWYgKGNvbW1hbmQgJiYgY29tbWFuZC5jaGFyQXQoMCkgIT09ICctJykge1xuXHRcdFx0XHR0aGlzLl9kZWZhdWx0Qm91bmRDb21tYW5kcy5zZXQoY29tbWFuZCwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fbWFwID0gbmV3IE1hcDxzdHJpbmcsIFJlc29sdmVkS2V5YmluZGluZ0l0ZW1bXT4oKTtcblx0XHR0aGlzLl9sb29rdXBNYXAgPSBuZXcgTWFwPHN0cmluZywgUmVzb2x2ZWRLZXliaW5kaW5nSXRlbVtdPigpO1xuXG5cdFx0dGhpcy5fa2V5YmluZGluZ3MgPSBLZXliaW5kaW5nUmVzb2x2ZXIuaGFuZGxlUmVtb3ZhbHMoKFtdIGFzIFJlc29sdmVkS2V5YmluZGluZ0l0ZW1bXSkuY29uY2F0KGRlZmF1bHRLZXliaW5kaW5ncykuY29uY2F0KG92ZXJyaWRlcykpO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9rZXliaW5kaW5ncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgayA9IHRoaXMuX2tleWJpbmRpbmdzW2ldO1xuXHRcdFx0aWYgKGsuY2hvcmRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHQvLyB1bmJvdW5kXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBzdWJzdGl0dXRlIHdpdGggY29uc3RhbnRzIHRoYXQgYXJlIHJlZ2lzdGVyZWQgYWZ0ZXIgc3RhcnR1cCAtIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNzQyMTgjaXNzdWVjb21tZW50LTE0Mzc5NzIxMjdcblx0XHRcdGNvbnN0IHdoZW4gPSBrLndoZW4/LnN1YnN0aXR1dGVDb25zdGFudHMoKTtcblxuXHRcdFx0aWYgKHdoZW4gJiYgd2hlbi50eXBlID09PSBDb250ZXh0S2V5RXhwclR5cGUuRmFsc2UpIHtcblx0XHRcdFx0Ly8gd2hlbiBjb25kaXRpb24gaXMgZmFsc2Vcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2FkZEtleVByZXNzKGsuY2hvcmRzWzBdLCBrKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfaXNUYXJnZXRlZEZvclJlbW92YWwoZGVmYXVsdEtiOiBSZXNvbHZlZEtleWJpbmRpbmdJdGVtLCBrZXlwcmVzczogc3RyaW5nW10gfCBudWxsLCB3aGVuOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdGlmIChrZXlwcmVzcykge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBrZXlwcmVzcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAoa2V5cHJlc3NbaV0gIT09IGRlZmF1bHRLYi5jaG9yZHNbaV0pIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBgdHJ1ZWAgbWVhbnMgYWx3YXlzLCBhcyBkb2VzIGB1bmRlZmluZWRgXG5cdFx0Ly8gc28gd2Ugd2lsbCB0cmVhdCBgdHJ1ZWAgPT09IGB1bmRlZmluZWRgXG5cdFx0aWYgKHdoZW4gJiYgd2hlbi50eXBlICE9PSBDb250ZXh0S2V5RXhwclR5cGUuVHJ1ZSkge1xuXHRcdFx0aWYgKCFkZWZhdWx0S2Iud2hlbikge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWV4cHJlc3Npb25zQXJlRXF1YWxXaXRoQ29uc3RhbnRTdWJzdGl0dXRpb24od2hlbiwgZGVmYXVsdEtiLndoZW4pKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cblx0fVxuXG5cdC8qKlxuXHQgKiBMb29rcyBmb3IgcnVsZXMgY29udGFpbmluZyBcIi1jb21tYW5kSWRcIiBhbmQgcmVtb3ZlcyB0aGVtLlxuXHQgKi9cblx0cHVibGljIHN0YXRpYyBoYW5kbGVSZW1vdmFscyhydWxlczogUmVzb2x2ZWRLZXliaW5kaW5nSXRlbVtdKTogUmVzb2x2ZWRLZXliaW5kaW5nSXRlbVtdIHtcblx0XHQvLyBEbyBhIGZpcnN0IHBhc3MgYW5kIGNvbnN0cnVjdCBhIGhhc2gtbWFwIGZvciByZW1vdmFsc1xuXHRcdGNvbnN0IHJlbW92YWxzID0gbmV3IE1hcDwvKiBjb21tYW5kSWQgKi8gc3RyaW5nLCBSZXNvbHZlZEtleWJpbmRpbmdJdGVtW10+KCk7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHJ1bGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBydWxlID0gcnVsZXNbaV07XG5cdFx0XHRpZiAocnVsZS5jb21tYW5kICYmIHJ1bGUuY29tbWFuZC5jaGFyQXQoMCkgPT09ICctJykge1xuXHRcdFx0XHRjb25zdCBjb21tYW5kID0gcnVsZS5jb21tYW5kLnN1YnN0cmluZygxKTtcblx0XHRcdFx0aWYgKCFyZW1vdmFscy5oYXMoY29tbWFuZCkpIHtcblx0XHRcdFx0XHRyZW1vdmFscy5zZXQoY29tbWFuZCwgW3J1bGVdKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZW1vdmFscy5nZXQoY29tbWFuZCkhLnB1c2gocnVsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAocmVtb3ZhbHMuc2l6ZSA9PT0gMCkge1xuXHRcdFx0Ly8gVGhlcmUgYXJlIG5vIHJlbW92YWxzXG5cdFx0XHRyZXR1cm4gcnVsZXM7XG5cdFx0fVxuXG5cdFx0Ly8gRG8gYSBzZWNvbmQgcGFzcyBhbmQga2VlcCBvbmx5IG5vbi1yZW1vdmVkIGtleWJpbmRpbmdzXG5cdFx0Y29uc3QgcmVzdWx0OiBSZXNvbHZlZEtleWJpbmRpbmdJdGVtW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gcnVsZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHJ1bGUgPSBydWxlc1tpXTtcblxuXHRcdFx0aWYgKCFydWxlLmNvbW1hbmQgfHwgcnVsZS5jb21tYW5kLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRyZXN1bHQucHVzaChydWxlKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAocnVsZS5jb21tYW5kLmNoYXJBdCgwKSA9PT0gJy0nKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY29tbWFuZFJlbW92YWxzID0gcmVtb3ZhbHMuZ2V0KHJ1bGUuY29tbWFuZCk7XG5cdFx0XHRpZiAoIWNvbW1hbmRSZW1vdmFscyB8fCAhcnVsZS5pc0RlZmF1bHQpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gocnVsZSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0bGV0IGlzUmVtb3ZlZCA9IGZhbHNlO1xuXHRcdFx0Zm9yIChjb25zdCBjb21tYW5kUmVtb3ZhbCBvZiBjb21tYW5kUmVtb3ZhbHMpIHtcblx0XHRcdFx0Y29uc3Qgd2hlbiA9IGNvbW1hbmRSZW1vdmFsLndoZW47XG5cdFx0XHRcdGlmICh0aGlzLl9pc1RhcmdldGVkRm9yUmVtb3ZhbChydWxlLCBjb21tYW5kUmVtb3ZhbC5jaG9yZHMsIHdoZW4pKSB7XG5cdFx0XHRcdFx0aXNSZW1vdmVkID0gdHJ1ZTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFpc1JlbW92ZWQpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gocnVsZSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBfYWRkS2V5UHJlc3Moa2V5cHJlc3M6IHN0cmluZywgaXRlbTogUmVzb2x2ZWRLZXliaW5kaW5nSXRlbSk6IHZvaWQge1xuXG5cdFx0Y29uc3QgY29uZmxpY3RzID0gdGhpcy5fbWFwLmdldChrZXlwcmVzcyk7XG5cblx0XHRpZiAodHlwZW9mIGNvbmZsaWN0cyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdC8vIFRoZXJlIGlzIG5vIGNvbmZsaWN0IHNvIGZhclxuXHRcdFx0dGhpcy5fbWFwLnNldChrZXlwcmVzcywgW2l0ZW1dKTtcblx0XHRcdHRoaXMuX2FkZFRvTG9va3VwTWFwKGl0ZW0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGkgPSBjb25mbGljdHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGNvbnN0IGNvbmZsaWN0ID0gY29uZmxpY3RzW2ldO1xuXG5cdFx0XHRpZiAoY29uZmxpY3QuY29tbWFuZCA9PT0gaXRlbS5jb21tYW5kKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUZXN0IGlmIHRoZSBzaG9ydGVyIGtleWJpbmRpbmcgaXMgYSBwcmVmaXggb2YgdGhlIGxvbmdlciBvbmUuXG5cdFx0XHQvLyBJZiB0aGUgc2hvcnRlciBrZXliaW5kaW5nIGlzIGEgcHJlZml4LCBpdCBlZmZlY3RpdmVseSB3aWxsIHNoYWRvdyB0aGUgbG9uZ2VyIG9uZSBhbmQgaXMgY29uc2lkZXJlZCBhIGNvbmZsaWN0LlxuXHRcdFx0bGV0IGlzU2hvcnRlcktiUHJlZml4ID0gdHJ1ZTtcblx0XHRcdGZvciAobGV0IGkgPSAxOyBpIDwgY29uZmxpY3QuY2hvcmRzLmxlbmd0aCAmJiBpIDwgaXRlbS5jaG9yZHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGNvbmZsaWN0LmNob3Jkc1tpXSAhPT0gaXRlbS5jaG9yZHNbaV0pIHtcblx0XHRcdFx0XHQvLyBUaGUgaXRoIHN0ZXAgZG9lcyBub3QgY29uZmxpY3Rcblx0XHRcdFx0XHRpc1Nob3J0ZXJLYlByZWZpeCA9IGZhbHNlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWlzU2hvcnRlcktiUHJlZml4KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoS2V5YmluZGluZ1Jlc29sdmVyLndoZW5Jc0VudGlyZWx5SW5jbHVkZWQoY29uZmxpY3Qud2hlbiwgaXRlbS53aGVuKSkge1xuXHRcdFx0XHQvLyBgaXRlbWAgY29tcGxldGVseSBvdmVyd3JpdGVzIGBjb25mbGljdGBcblx0XHRcdFx0Ly8gUmVtb3ZlIGNvbmZsaWN0IGZyb20gdGhlIGxvb2t1cE1hcFxuXHRcdFx0XHR0aGlzLl9yZW1vdmVGcm9tTG9va3VwTWFwKGNvbmZsaWN0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25mbGljdHMucHVzaChpdGVtKTtcblx0XHR0aGlzLl9hZGRUb0xvb2t1cE1hcChpdGVtKTtcblx0fVxuXG5cdHByaXZhdGUgX2FkZFRvTG9va3VwTWFwKGl0ZW06IFJlc29sdmVkS2V5YmluZGluZ0l0ZW0pOiB2b2lkIHtcblx0XHRpZiAoIWl0ZW0uY29tbWFuZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBhcnIgPSB0aGlzLl9sb29rdXBNYXAuZ2V0KGl0ZW0uY29tbWFuZCk7XG5cdFx0aWYgKHR5cGVvZiBhcnIgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRhcnIgPSBbaXRlbV07XG5cdFx0XHR0aGlzLl9sb29rdXBNYXAuc2V0KGl0ZW0uY29tbWFuZCwgYXJyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXJyLnB1c2goaXRlbSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3ZlRnJvbUxvb2t1cE1hcChpdGVtOiBSZXNvbHZlZEtleWJpbmRpbmdJdGVtKTogdm9pZCB7XG5cdFx0aWYgKCFpdGVtLmNvbW1hbmQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgYXJyID0gdGhpcy5fbG9va3VwTWFwLmdldChpdGVtLmNvbW1hbmQpO1xuXHRcdGlmICh0eXBlb2YgYXJyID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRpZiAoYXJyW2ldID09PSBpdGVtKSB7XG5cdFx0XHRcdGFyci5zcGxpY2UoaSwgMSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0cnVlIGlmIGl0IGlzIHByb3ZhYmxlIGBhYCBpbXBsaWVzIGBiYC5cblx0ICovXG5cdHB1YmxpYyBzdGF0aWMgd2hlbklzRW50aXJlbHlJbmNsdWRlZChhOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IG51bGwgfCB1bmRlZmluZWQsIGI6IENvbnRleHRLZXlFeHByZXNzaW9uIHwgbnVsbCB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdGlmICghYiB8fCBiLnR5cGUgPT09IENvbnRleHRLZXlFeHByVHlwZS5UcnVlKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCFhIHx8IGEudHlwZSA9PT0gQ29udGV4dEtleUV4cHJUeXBlLlRydWUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gaW1wbGllcyhhLCBiKTtcblx0fVxuXG5cdHB1YmxpYyBnZXREZWZhdWx0Qm91bmRDb21tYW5kcygpOiBNYXA8c3RyaW5nLCBib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2RlZmF1bHRCb3VuZENvbW1hbmRzO1xuXHR9XG5cblx0cHVibGljIGdldERlZmF1bHRLZXliaW5kaW5ncygpOiByZWFkb25seSBSZXNvbHZlZEtleWJpbmRpbmdJdGVtW10ge1xuXHRcdHJldHVybiB0aGlzLl9kZWZhdWx0S2V5YmluZGluZ3M7XG5cdH1cblxuXHRwdWJsaWMgZ2V0S2V5YmluZGluZ3MoKTogcmVhZG9ubHkgUmVzb2x2ZWRLZXliaW5kaW5nSXRlbVtdIHtcblx0XHRyZXR1cm4gdGhpcy5fa2V5YmluZGluZ3M7XG5cdH1cblxuXHRwdWJsaWMgbG9va3VwS2V5YmluZGluZ3MoY29tbWFuZElkOiBzdHJpbmcpOiBSZXNvbHZlZEtleWJpbmRpbmdJdGVtW10ge1xuXHRcdGNvbnN0IGl0ZW1zID0gdGhpcy5fbG9va3VwTWFwLmdldChjb21tYW5kSWQpO1xuXHRcdGlmICh0eXBlb2YgaXRlbXMgPT09ICd1bmRlZmluZWQnIHx8IGl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdC8vIFJldmVyc2UgdG8gZ2V0IHRoZSBtb3N0IHNwZWNpZmljIGl0ZW0gZmlyc3Rcblx0XHRjb25zdCByZXN1bHQ6IFJlc29sdmVkS2V5YmluZGluZ0l0ZW1bXSA9IFtdO1xuXHRcdGxldCByZXN1bHRMZW4gPSAwO1xuXHRcdGZvciAobGV0IGkgPSBpdGVtcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IGl0ZW1zW2ldO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGxvb2t1cFByaW1hcnlLZXliaW5kaW5nKGNvbW1hbmRJZDogc3RyaW5nLCBjb250ZXh0OiBJQ29udGV4dEtleVNlcnZpY2UsIGVuZm9yY2VDb250ZXh0Q2hlY2sgPSBmYWxzZSk6IFJlc29sdmVkS2V5YmluZGluZ0l0ZW0gfCBudWxsIHtcblx0XHRjb25zdCBpdGVtcyA9IHRoaXMuX2xvb2t1cE1hcC5nZXQoY29tbWFuZElkKTtcblx0XHRpZiAodHlwZW9mIGl0ZW1zID09PSAndW5kZWZpbmVkJyB8fCBpdGVtcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAoaXRlbXMubGVuZ3RoID09PSAxICYmICFlbmZvcmNlQ29udGV4dENoZWNrKSB7XG5cdFx0XHRyZXR1cm4gaXRlbXNbMF07XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgaSA9IGl0ZW1zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCBpdGVtID0gaXRlbXNbaV07XG5cdFx0XHRpZiAoY29udGV4dC5jb250ZXh0TWF0Y2hlc1J1bGVzKGl0ZW0ud2hlbikpIHtcblx0XHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGVuZm9yY2VDb250ZXh0Q2hlY2spIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiBpdGVtc1tpdGVtcy5sZW5ndGggLSAxXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBMb29rcyB1cCBhIGtleWJpbmRpbmcgdHJpZ2dlZCBhcyBhIHJlc3VsdCBvZiBwcmVzc2luZyBhIHNlcXVlbmNlIG9mIGNob3JkcyAtIGBbLi4uY3VycmVudENob3Jkcywga2V5cHJlc3NdYFxuXHQgKlxuXHQgKiBFeGFtcGxlOiByZXNvbHZpbmcgMyBjaG9yZHMgcHJlc3NlZCBzZXF1ZW50aWFsbHkgLSBgY21kK2sgY21kK3AgY21kK2lgOlxuXHQgKiBcdGBjdXJyZW50Q2hvcmRzID0gWyAnY21kK2snICwgJ2NtZCtwJyBdYCBhbmQgYGtleXByZXNzID0gYGNtZCtpYCAtIGxhc3QgcHJlc3NlZCBjaG9yZFxuXHQgKi9cblx0cHVibGljIHJlc29sdmUoY29udGV4dDogSUNvbnRleHQsIGN1cnJlbnRDaG9yZHM6IHN0cmluZ1tdLCBrZXlwcmVzczogc3RyaW5nKTogUmVzb2x1dGlvblJlc3VsdCB7XG5cblx0XHRjb25zdCBwcmVzc2VkQ2hvcmRzID0gWy4uLmN1cnJlbnRDaG9yZHMsIGtleXByZXNzXTtcblxuXHRcdHRoaXMuX2xvZyhgfCBSZXNvbHZpbmcgJHtwcmVzc2VkQ2hvcmRzfWApO1xuXG5cdFx0Y29uc3Qga2JDYW5kaWRhdGVzID0gdGhpcy5fbWFwLmdldChwcmVzc2VkQ2hvcmRzWzBdKTtcblx0XHRpZiAoa2JDYW5kaWRhdGVzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdC8vIE5vIGJpbmRpbmdzIHdpdGggc3VjaCAwLXRoIGNob3JkXG5cdFx0XHR0aGlzLl9sb2coYFxcXFwgTm8ga2V5YmluZGluZyBlbnRyaWVzLmApO1xuXHRcdFx0cmV0dXJuIE5vTWF0Y2hpbmdLYjtcblx0XHR9XG5cblx0XHRsZXQgbG9va3VwTWFwOiBSZXNvbHZlZEtleWJpbmRpbmdJdGVtW10gfCBudWxsID0gbnVsbDtcblxuXHRcdGlmIChwcmVzc2VkQ2hvcmRzLmxlbmd0aCA8IDIpIHtcblx0XHRcdGxvb2t1cE1hcCA9IGtiQ2FuZGlkYXRlcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gRmV0Y2ggYWxsIGNob3JkIGJpbmRpbmdzIGZvciBgY3VycmVudENob3Jkc2Bcblx0XHRcdGxvb2t1cE1hcCA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGtiQ2FuZGlkYXRlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXG5cdFx0XHRcdGNvbnN0IGNhbmRpZGF0ZSA9IGtiQ2FuZGlkYXRlc1tpXTtcblxuXHRcdFx0XHRpZiAocHJlc3NlZENob3Jkcy5sZW5ndGggPiBjYW5kaWRhdGUuY2hvcmRzLmxlbmd0aCkgeyAvLyAjIG9mIHByZXNzZWQgY2hvcmRzIGNhbid0IGJlIGxlc3MgdGhhbiAjIG9mIGNob3JkcyBpbiBhIGtleWJpbmRpbmcgdG8gaW52b2tlXG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgcHJlZml4TWF0Y2hlcyA9IHRydWU7XG5cdFx0XHRcdGZvciAobGV0IGkgPSAxOyBpIDwgcHJlc3NlZENob3Jkcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGlmIChjYW5kaWRhdGUuY2hvcmRzW2ldICE9PSBwcmVzc2VkQ2hvcmRzW2ldKSB7XG5cdFx0XHRcdFx0XHRwcmVmaXhNYXRjaGVzID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHByZWZpeE1hdGNoZXMpIHtcblx0XHRcdFx0XHRsb29rdXBNYXAucHVzaChjYW5kaWRhdGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gY2hlY2sgdGhlcmUncyBhIGtleWJpbmRpbmcgd2l0aCBhIG1hdGNoaW5nIHdoZW4gY2xhdXNlXG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fZmluZENvbW1hbmQoY29udGV4dCwgbG9va3VwTWFwKTtcblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0dGhpcy5fbG9nKGBcXFxcIEZyb20gJHtsb29rdXBNYXAubGVuZ3RofSBrZXliaW5kaW5nIGVudHJpZXMsIG5vIHdoZW4gY2xhdXNlcyBtYXRjaGVkIHRoZSBjb250ZXh0LmApO1xuXHRcdFx0cmV0dXJuIE5vTWF0Y2hpbmdLYjtcblx0XHR9XG5cblx0XHQvLyBjaGVjayB3ZSBnb3QgYWxsIGNob3JkcyBuZWNlc3NhcnkgdG8gYmUgc3VyZSBhIHBhcnRpY3VsYXIga2V5YmluZGluZyBuZWVkcyB0byBiZSBpbnZva2VkXG5cdFx0aWYgKHByZXNzZWRDaG9yZHMubGVuZ3RoIDwgcmVzdWx0LmNob3Jkcy5sZW5ndGgpIHtcblx0XHRcdC8vIFRoZSBjaG9yZCBzZXF1ZW5jZSBpcyBub3QgY29tcGxldGVcblx0XHRcdHRoaXMuX2xvZyhgXFxcXCBGcm9tICR7bG9va3VwTWFwLmxlbmd0aH0ga2V5YmluZGluZyBlbnRyaWVzLCBhd2FpdGluZyAke3Jlc3VsdC5jaG9yZHMubGVuZ3RoIC0gcHJlc3NlZENob3Jkcy5sZW5ndGh9IG1vcmUgY2hvcmQocyksIHdoZW46ICR7cHJpbnRXaGVuRXhwbGFuYXRpb24ocmVzdWx0LndoZW4pfSwgc291cmNlOiAke3ByaW50U291cmNlRXhwbGFuYXRpb24ocmVzdWx0KX0uYCk7XG5cdFx0XHRyZXR1cm4gTW9yZUNob3Jkc05lZWRlZDtcblx0XHR9XG5cblx0XHR0aGlzLl9sb2coYFxcXFwgRnJvbSAke2xvb2t1cE1hcC5sZW5ndGh9IGtleWJpbmRpbmcgZW50cmllcywgbWF0Y2hlZCAke3Jlc3VsdC5jb21tYW5kfSwgd2hlbjogJHtwcmludFdoZW5FeHBsYW5hdGlvbihyZXN1bHQud2hlbil9LCBzb3VyY2U6ICR7cHJpbnRTb3VyY2VFeHBsYW5hdGlvbihyZXN1bHQpfS5gKTtcblxuXHRcdHJldHVybiBLYkZvdW5kKHJlc3VsdC5jb21tYW5kLCByZXN1bHQuY29tbWFuZEFyZ3MsIHJlc3VsdC5idWJibGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmluZENvbW1hbmQoY29udGV4dDogSUNvbnRleHQsIG1hdGNoZXM6IFJlc29sdmVkS2V5YmluZGluZ0l0ZW1bXSk6IFJlc29sdmVkS2V5YmluZGluZ0l0ZW0gfCBudWxsIHtcblx0XHRmb3IgKGxldCBpID0gbWF0Y2hlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0Y29uc3QgayA9IG1hdGNoZXNbaV07XG5cblx0XHRcdGlmICghS2V5YmluZGluZ1Jlc29sdmVyLl9jb250ZXh0TWF0Y2hlc1J1bGVzKGNvbnRleHQsIGsud2hlbikpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBrO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2NvbnRleHRNYXRjaGVzUnVsZXMoY29udGV4dDogSUNvbnRleHQsIHJ1bGVzOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IG51bGwgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRpZiAoIXJ1bGVzKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHJ1bGVzLmV2YWx1YXRlKGNvbnRleHQpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHByaW50V2hlbkV4cGxhbmF0aW9uKHdoZW46IENvbnRleHRLZXlFeHByZXNzaW9uIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcblx0aWYgKCF3aGVuKSB7XG5cdFx0cmV0dXJuIGBubyB3aGVuIGNvbmRpdGlvbmA7XG5cdH1cblx0cmV0dXJuIGAke3doZW4uc2VyaWFsaXplKCl9YDtcbn1cblxuZnVuY3Rpb24gcHJpbnRTb3VyY2VFeHBsYW5hdGlvbihrYjogUmVzb2x2ZWRLZXliaW5kaW5nSXRlbSk6IHN0cmluZyB7XG5cdHJldHVybiAoXG5cdFx0a2IuZXh0ZW5zaW9uSWRcblx0XHRcdD8gKGtiLmlzQnVpbHRpbkV4dGVuc2lvbiA/IGBidWlsdC1pbiBleHRlbnNpb24gJHtrYi5leHRlbnNpb25JZH1gIDogYHVzZXIgZXh0ZW5zaW9uICR7a2IuZXh0ZW5zaW9uSWR9YClcblx0XHRcdDogKGtiLmlzRGVmYXVsdCA/IGBidWlsdC1pbmAgOiBgdXNlcmApXG5cdCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFNBQStCLG9CQUFrRCxtREFBbUQ7QUFLdEksSUFBVyxhQUFYLGtCQUFXQSxnQkFBWDtBQUVOLEVBQUFBLHdCQUFBO0FBR0EsRUFBQUEsd0JBQUE7QUFHQSxFQUFBQSx3QkFBQTtBQVJpQixTQUFBQTtBQUFBLEdBQUE7QUFtQlgsTUFBTSxlQUFpQyxFQUFFLE1BQU0scUJBQXdCO0FBQzlFLE1BQU0sbUJBQXFDLEVBQUUsTUFBTSx5QkFBNEI7QUFDL0UsU0FBUyxRQUFRLFdBQTBCLGFBQWtCLFVBQXFDO0FBQ2pHLFNBQU8sRUFBRSxNQUFNLGlCQUFvQixXQUFXLGFBQWEsU0FBUztBQUNyRTtBQVFPLE1BQU0sbUJBQW1CO0FBQUEsRUFRL0IsWUFFQyxvQkFFQSxXQUNBLEtBQ0M7QUFDRCxTQUFLLE9BQU87QUFDWixTQUFLLHNCQUFzQjtBQUUzQixTQUFLLHdCQUF3QixvQkFBSSxJQUFxQjtBQUN0RCxlQUFXLHFCQUFxQixvQkFBb0I7QUFDbkQsWUFBTSxVQUFVLGtCQUFrQjtBQUNsQyxVQUFJLFdBQVcsUUFBUSxPQUFPLENBQUMsTUFBTSxLQUFLO0FBQ3pDLGFBQUssc0JBQXNCLElBQUksU0FBUyxJQUFJO0FBQUEsTUFDN0M7QUFBQSxJQUNEO0FBRUEsU0FBSyxPQUFPLG9CQUFJLElBQXNDO0FBQ3RELFNBQUssYUFBYSxvQkFBSSxJQUFzQztBQUU1RCxTQUFLLGVBQWUs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R0FBRztBQUM3Qyw0QkFBZ0I7QUFDaEI7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUNBLFlBQUksZUFBZTtBQUNsQixvQkFBVSxLQUFLLFNBQVM7QUFBQSxRQUN6QjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBR0EsVUFBTSxTQUFTLEtBQUssYUFBYSxTQUFTLFNBQVM7QUFDbkQsUUFBSSxDQUFDLFFBQVE7QUFDWixXQUFLLEtBQUssV0FBVyxVQUFVLE1BQU0sMkRBQTJEO0FBQ2hHLGFBQU87QUFBQSxJQUNSO0FBR0EsUUFBSSxjQUFjLFNBQVMsT0FBTyxPQUFPLFFBQVE7QUFFaEQsV0FBSyxLQUFLLFdBQVcsVUFBVSxNQUFNLGlDQUFpQyxPQUFPLE9BQU8sU0FBUyxjQUFjLE1BQU0seUJBQXlCLHFCQUFxQixPQUFPLElBQUksQ0FBQyxhQUFhLHVCQUF1QixNQUFNLENBQUMsR0FBRztBQUN6TixhQUFPO0FBQUEsSUFDUjtBQUVBLFNBQUssS0FBSyxXQUFXLFVBQVUsTUFBTSxnQ0FBZ0MsT0FBTyxPQUFPLFdBQVcscUJBQXFCLE9BQU8sSUFBSSxDQUFDLGFBQWEsdUJBQXVCLE1BQU0sQ0FBQyxHQUFHO0FBRTdLLFdBQU8sUUFBUSxPQUFPLFNBQVMsT0FBTyxhQUFhLE9BQU8sTUFBTTtBQUFBLEVBQ2pFO0FBQUEsRUFFUSxhQUFhLFNBQW1CLFNBQWtFO0FBQ3pHLGFBQVMsSUFBSSxRQUFRLFNBQVMsR0FBRyxLQUFLLEdBQUcsS0FBSztBQUM3QyxZQUFNLElBQUksUUFBUSxDQUFDO0FBRW5CLFVBQUksQ0FBQyxtQkFBbUIscUJBQXFCLFNBQVMsRUFBRSxJQUFJLEdBQUc7QUFDOUQ7QUFBQSxNQUNEO0FBRUEsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsT0FBZSxxQkFBcUIsU0FBbUIsT0FBeUQ7QUFDL0csUUFBSSxDQUFDLE9BQU87QUFDWCxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU8sTUFBTSxTQUFTLE9BQU87QUFBQSxFQUM5QjtBQUNEO0FBRUEsU0FBUyxxQkFBcUIsTUFBZ0Q7QUFDN0UsTUFBSSxDQUFDLE1BQU07QUFDVixXQUFPO0FBQUEsRUFDUjtBQUNBLFNBQU8sR0FBRyxLQUFLLFVBQVUsQ0FBQztBQUMzQjtBQUVBLFNBQVMsdUJBQXVCLElBQW9DO0FBQ25FLFNBQ0MsR0FBRyxjQUNDLEdBQUcscUJBQXFCLHNCQUFzQixHQUFHLFdBQVcsS0FBSyxrQkFBa0IsR0FBRyxXQUFXLEtBQ2pHLEdBQUcsWUFBWSxhQUFhO0FBRWxDOyIsCiAgIm5hbWVzIjogWyJSZXN1bHRLaW5kIiwgImkiXQp9Cg==
