import * as monarchCommon from "./monarchCommon.js";
function isArrayOf(elemType, obj) {
  if (!obj) {
    return false;
  }
  if (!Array.isArray(obj)) {
    return false;
  }
  for (const el of obj) {
    if (!elemType(el)) {
      return false;
    }
  }
  return true;
}
function bool(prop, defValue) {
  if (typeof prop === "boolean") {
    return prop;
  }
  return defValue;
}
function string(prop, defValue) {
  if (typeof prop === "string") {
    return prop;
  }
  return defValue;
}
function arrayToHash(array) {
  const result = {};
  for (const e of array) {
    result[e] = true;
  }
  return result;
}
function createKeywordMatcher(arr, caseInsensitive = false) {
  if (caseInsensitive) {
    arr = arr.map(function(x) {
      return x.toLowerCase();
    });
  }
  const hash = arrayToHash(arr);
  if (caseInsensitive) {
    return function(word) {
      return hash[word.toLowerCase()] !== void 0 && hash.hasOwnProperty(word.toLowerCase());
    };
  } else {
    return function(word) {
      return hash[word] !== void 0 && hash.hasOwnProperty(word);
    };
  }
}
function compileRegExp(lexer, str, handleSn) {
  str = str.replace(/@@/g, ``);
  let n = 0;
  let hadExpansion;
  do {
    hadExpansion = false;
    str = str.replace(/@(\w+)/g, function(s, attr) {
      hadExpansion = true;
      let sub = "";
      if (typeof lexer[attr] === "string") {
        sub = lexer[attr];
      } else if (lexer[attr] && lexer[attr] instanceof RegExp) {
        sub = lexer[attr].source;
      } else {
        if (lexer[attr] === void 0) {
          throw monarchCommon.createError(lexer, "language definition does not contain attribute '" + attr + "', used at: " + str);
        } else {
          throw monarchCommon.createError(lexer, "attribute reference '" + attr + "' must be a string, used at: " + str);
        }
      }
      return monarchCommon.empty(sub) ? "" : "(?:" + sub + ")";
    });
    n++;
  } while (hadExpansion && n < 5);
  str = str.replace(/\x01/g, "@");
  const flags = (lexer.ignoreCase ? "i" : "") + (lexer.unicode ? "u" : "");
  if (handleSn) {
    const match = str.match(/\$[sS](\d\d?)/g);
    if (match) {
      let lastState = null;
      let lastRegEx = null;
      return (state) => {
        if (lastRegEx && lastState === state) {
          return lastRegEx;
        }
        lastState = state;
        lastRegEx = new RegExp(monarchCommon.substituteMatchesRe(lexer, str, state), flags);
        return lastRegEx;
      };
    }
  }
  return new RegExp(str, flags);
}
function selectScrutinee(id, matches, state, num) {
  if (num < 0) {
    return id;
  }
  if (num < matches.length) {
    return matches[num];
  }
  if (num >= 100) {
    num = num - 100;
    const parts = state.split(".");
    parts.unshift(state);
    if (num < parts.length) {
      return parts[num];
    }
  }
  return null;
}
function createGuard(lexer, ruleName, tkey, val) {
  let scrut = -1;
  let oppat = tkey;
  let matches = tkey.match(/^\$(([sS]?)(\d\d?)|#)(.*)$/);
  if (matches) {
    if (matches[3]) {
      scrut = parseInt(matches[3]);
      if (matches[2]) {
        scrut = scrut + 100;
      }
    }
    oppat = matches[4];
  }
  let op = "~";
  let pat = oppat;
  if (!oppat || oppat.length === 0) {
    op = "!=";
    pat = "";
  } else if (/^\w*$/.test(pat)) {
    op = "==";
  } else {
    matches = oppat.match(/^(@|!@|~|!~|==|!=)(.*)$/);
    if (matches) {
      op = matches[1];
      pat = matches[2];
    }
  }
  let tester;
  if ((op === "~" || op === "!~") && /^(\w|\|)*$/.test(pat)) {
    const inWords = createKeywordMatcher(pat.split("|"), lexer.ignoreCase);
    tester = function(s) {
      return op === "~" ? inWords(s) : !inWords(s);
    };
  } else if (op === "@" || op === "!@") {
    const words = lexer[pat];
    if (!words) {
      throw monarchCommon.createError(lexer, "the @ match target '" + pat + "' is not defined, in rule: " + ruleName);
    }
    if (!isArrayOf(function(elem) {
      return typeof elem === "string";
    }, words)) {
      throw monarchCommon.createError(lexer, "the @ match target '" + pat + "' must be an array of strings, in rule: " + ruleName);
    }
    const inWords = createKeywordMatcher(words, lexer.ignoreCase);
    tester = function(s) {
      return op === "@" ? inWords(s) : !inWords(s);
    };
  } else if (op === "~" || op === "!~") {
    if (pat.indexOf("$") < 0) {
      const re = compileRegExp(lexer, "^" + pat + "$", false);
      tester = function(s) {
        return op === "~" ? re.test(s) : !re.test(s);
      };
    } else {
      tester = function(s, id, matches2, state) {
        const re = compileRegExp(lexer, "^" + monarchCommon.substituteMatches(lexer, pat, id, matches2, state) + "$", false);
        return re.test(s);
      };
    }
  } else {
    if (pat.indexOf("$") < 0) {
      const patx = monarchCommon.fixCase(lexer, pat);
      tester = function(s) {
        return op === "==" ? s === patx : s !== patx;
      };
    } else {
      const patx = monarchCommon.fixCase(lexer, pat);
      tester = function(s, id, matches2, state, eos) {
        const patexp = monarchCommon.substituteMatches(lexer, patx, id, matches2, state);
        return op === "==" ? s === patexp : s !== patexp;
      };
    }
  }
  if (scrut === -1) {
    return {
      name: tkey,
      value: val,
      test: function(id, matches2, state, eos) {
        return tester(id, id, matches2, state, eos);
      }
    };
  } else {
    return {
      name: tkey,
      value: val,
      test: function(id, matches2, state, eos) {
        const scrutinee = selectScrutinee(id, matches2, state, scrut);
        return tester(!scrutinee ? "" : scrutinee, id, matches2, state, eos);
      }
    };
  }
}
function compileAction(lexer, ruleName, action) {
  if (!action) {
    return { token: "" };
  } else if (typeof action === "string") {
    return action;
  } else if (action.token || action.token === "") {
    if (typeof action.token !== "string") {
      throw monarchCommon.createError(lexer, "a 'token' attribute must be of type string, in rule: " + ruleName);
    } else {
      const newAction = { token: action.token };
      if (action.token.indexOf("$") >= 0) {
        newAction.tokenSubst = true;
      }
      if (typeof action.bracket === "string") {
        if (action.bracket === "@open") {
          newAction.bracket = monarchCommon.MonarchBracket.Open;
        } else if (action.bracket === "@close") {
          newAction.bracket = monarchCommon.MonarchBracket.Close;
        } else {
          throw monarchCommon.createError(lexer, "a 'bracket' attribute must be either '@open' or '@close', in rule: " + ruleName);
        }
      }
      if (action.next) {
        if (typeof action.next !== "string") {
          throw monarchCommon.createError(lexer, "the next state must be a string value in rule: " + ruleName);
        } else {
          let next = action.next;
          if (!/^(@pop|@push|@popall)$/.test(next)) {
            if (next[0] === "@") {
              next = next.substr(1);
            }
            if (next.indexOf("$") < 0) {
              if (!monarchCommon.stateExists(lexer, monarchCommon.substituteMatches(lexer, next, "", [], ""))) {
                throw monarchCommon.createError(lexer, "the next state '" + action.next + "' is not defined in rule: " + ruleName);
              }
            }
          }
          newAction.next = next;
        }
      }
      if (typeof action.goBack === "number") {
        newAction.goBack = action.goBack;
      }
      if (typeof action.switchTo === "string") {
        newAction.switchTo = action.switchTo;
      }
      if (typeof action.log === "string") {
        newAction.log = action.log;
      }
      if (typeof action.nextEmbedded === "string") {
        newAction.nextEmbedded = action.nextEmbedded;
        lexer.usesEmbedded = true;
      }
      return newAction;
    }
  } else if (Array.isArray(action)) {
    const results = [];
    for (let i = 0, len = action.length; i < len; i++) {
      results[i] = compileAction(lexer, ruleName, action[i]);
    }
    return { group: results };
  } else if (action.cases) {
    const cases = [];
    for (const tkey in action.cases) {
      if (action.cases.hasOwnProperty(tkey)) {
        const val = compileAction(lexer, ruleName, action.cases[tkey]);
        if (tkey === "@default" || tkey === "@" || tkey === "") {
          cases.push({ test: void 0, value: val, name: tkey });
        } else if (tkey === "@eos") {
          cases.push({ test: function(id, matches, state, eos) {
            return eos;
          }, value: val, name: tkey });
        } else {
          cases.push(createGuard(lexer, ruleName, tkey, val));
        }
      }
    }
    const def = lexer.defaultToken;
    return {
      test: function(id, matches, state, eos) {
        for (const _case of cases) {
          const didmatch = !_case.test || _case.test(id, matches, state, eos);
          if (didmatch) {
            return _case.value;
          }
        }
        return def;
      }
    };
  } else {
    throw monarchCommon.createError(lexer, "an action must be a string, an object with a 'token' or 'cases' attribute, or an array of actions; in rule: " + ruleName);
  }
}
class Rule {
  constructor(name) {
    this.regex = new RegExp("");
    this.action = { token: "" };
    this.matchOnlyAtLineStart = false;
    this.name = "";
    this.name = name;
  }
  setRegex(lexer, re) {
    let sregex;
    if (typeof re === "string") {
      sregex = re;
    } else if (re instanceof RegExp) {
      sregex = re.source;
    } else {
      throw monarchCommon.createError(lexer, "rules must start with a match string or regular expression: " + this.name);
    }
    this.matchOnlyAtLineStart = sregex.length > 0 && sregex[0] === "^";
    this.name = this.name + ": " + sregex;
    this.regex = compileRegExp(lexer, "^(?:" + (this.matchOnlyAtLineStart ? sregex.substr(1) : sregex) + ")", true);
  }
  setAction(lexer, act) {
    this.action = compileAction(lexer, this.name, act);
  }
  resolveRegex(state) {
    if (this.regex instanceof RegExp) {
      return this.regex;
    } else {
      return this.regex(state);
    }
  }
}
function compile(languageId, json) {
  if (!json || typeof json !== "object") {
    throw new Error("Monarch: expecting a language definition object");
  }
  const lexer = {
    languageId,
    includeLF: bool(json.includeLF, false),
    noThrow: false,
    // raise exceptions during compilation
    maxStack: 100,
    start: typeof json.start === "string" ? json.start : null,
    ignoreCase: bool(json.ignoreCase, false),
    unicode: bool(json.unicode, false),
    tokenPostfix: string(json.tokenPostfix, "." + languageId),
    defaultToken: string(json.defaultToken, "source"),
    usesEmbedded: false,
    // becomes true if we find a nextEmbedded action
    stateNames: {},
    tokenizer: {},
    brackets: []
  };
  const lexerMin = json;
  lexerMin.languageId = languageId;
  lexerMin.includeLF = lexer.includeLF;
  lexerMin.ignoreCase = lexer.ignoreCase;
  lexerMin.unicode = lexer.unicode;
  lexerMin.noThrow = lexer.noThrow;
  lexerMin.usesEmbedded = lexer.usesEmbedded;
  lexerMin.stateNames = json.tokenizer;
  lexerMin.defaultToken = lexer.defaultToken;
  function addRules(state, newrules, rules) {
    for (const rule of rules) {
      let include = rule.include;
      if (include) {
        if (typeof include !== "string") {
          throw monarchCommon.createError(lexer, "an 'include' attribute must be a string at: " + state);
        }
        if (include[0] === "@") {
          include = include.substr(1);
        }
        if (!json.tokenizer[include]) {
          throw monarchCommon.createError(lexer, "include target '" + include + "' is not defined at: " + state);
        }
        addRules(state + "." + include, newrules, json.tokenizer[include]);
      } else {
        const newrule = new Rule(state);
        if (Array.isArray(rule) && rule.length >= 1 && rule.length <= 3) {
          newrule.setRegex(lexerMin, rule[0]);
          if (rule.length >= 3) {
            if (typeof rule[1] === "string") {
              newrule.setAction(lexerMin, { token: rule[1], next: rule[2] });
            } else if (typeof rule[1] === "object") {
              const rule1 = rule[1];
              rule1.next = rule[2];
              newrule.setAction(lexerMin, rule1);
            } else {
              throw monarchCommon.createError(lexer, "a next state as the last element of a rule can only be given if the action is either an object or a string, at: " + state);
            }
          } else {
            newrule.setAction(lexerMin, rule[1]);
          }
        } else {
          if (!rule.regex) {
            throw monarchCommon.createError(lexer, "a rule must either be an array, or an object with a 'regex' or 'include' field at: " + state);
          }
          if (rule.name) {
            if (typeof rule.name === "string") {
              newrule.name = rule.name;
            }
          }
          if (rule.matchOnlyAtStart) {
            newrule.matchOnlyAtLineStart = bool(rule.matchOnlyAtLineStart, false);
          }
          newrule.setRegex(lexerMin, rule.regex);
          newrule.setAction(lexerMin, rule.action);
        }
        newrules.push(newrule);
      }
    }
  }
  if (!json.tokenizer || typeof json.tokenizer !== "object") {
    throw monarchCommon.createError(lexer, "a language definition must define the 'tokenizer' attribute as an object");
  }
  lexer.tokenizer = [];
  for (const key in json.tokenizer) {
    if (json.tokenizer.hasOwnProperty(key)) {
      if (!lexer.start) {
        lexer.start = key;
      }
      const rules = json.tokenizer[key];
      lexer.tokenizer[key] = new Array();
      addRules("tokenizer." + key, lexer.tokenizer[key], rules);
    }
  }
  lexer.usesEmbedded = lexerMin.usesEmbedded;
  if (json.brackets) {
    if (!Array.isArray(json.brackets)) {
      throw monarchCommon.createError(lexer, "the 'brackets' attribute must be defined as an array");
    }
  } else {
    json.brackets = [
      { open: "{", close: "}", token: "delimiter.curly" },
      { open: "[", close: "]", token: "delimiter.square" },
      { open: "(", close: ")", token: "delimiter.parenthesis" },
      { open: "<", close: ">", token: "delimiter.angle" }
    ];
  }
  const brackets = [];
  for (const el of json.brackets) {
    let desc = el;
    if (desc && Array.isArray(desc) && desc.length === 3) {
      desc = { token: desc[2], open: desc[0], close: desc[1] };
    }
    if (desc.open === desc.close) {
      throw monarchCommon.createError(lexer, "open and close brackets in a 'brackets' attribute must be different: " + desc.open + "\n hint: use the 'bracket' attribute if matching on equal brackets is required.");
    }
    if (typeof desc.open === "string" && typeof desc.token === "string" && typeof desc.close === "string") {
      brackets.push({
        token: desc.token + lexer.tokenPostfix,
        open: monarchCommon.fixCase(lexer, desc.open),
        close: monarchCommon.fixCase(lexer, desc.close)
      });
    } else {
      throw monarchCommon.createError(lexer, "every element in the 'brackets' array must be a '{open,close,token}' object or array");
    }
  }
  lexer.brackets = brackets;
  lexer.noThrow = true;
  return lexer;
}
export {
  compile
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3Ivc3RhbmRhbG9uZS9jb21tb24vbW9uYXJjaC9tb25hcmNoQ29tcGlsZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbi8qXG4gKiBUaGlzIG1vZHVsZSBvbmx5IGV4cG9ydHMgJ2NvbXBpbGUnIHdoaWNoIGNvbXBpbGVzIGEgSlNPTiBsYW5ndWFnZSBkZWZpbml0aW9uXG4gKiBpbnRvIGEgdHlwZWQgYW5kIGNoZWNrZWQgSUxleGVyIGRlZmluaXRpb24uXG4gKi9cblxuaW1wb3J0ICogYXMgbW9uYXJjaENvbW1vbiBmcm9tICcuL21vbmFyY2hDb21tb24uanMnO1xuaW1wb3J0IHsgSU1vbmFyY2hMYW5ndWFnZSwgSU1vbmFyY2hMYW5ndWFnZUJyYWNrZXQgfSBmcm9tICcuL21vbmFyY2hUeXBlcy5qcyc7XG5cbi8qXG4gKiBUeXBlIGhlbHBlcnNcbiAqXG4gKiBOb3RlOiB0aGlzIGlzIGp1c3QgZm9yIHNhbml0eSBjaGVja3Mgb24gdGhlIEpTT04gZGVzY3JpcHRpb24gd2hpY2ggaXNcbiAqIGhlbHBmdWwgZm9yIHRoZSBwcm9ncmFtbWVyLiBObyBjaGVja3MgYXJlIGRvbmUgYW55bW9yZSBvbmNlIHRoZSBsZXhlciBpc1xuICogYWxyZWFkeSAnY29tcGlsZWQgYW5kIGNoZWNrZWQnLlxuICpcbiAqL1xuXG5mdW5jdGlvbiBpc0FycmF5T2YoZWxlbVR5cGU6ICh4OiBhbnkpID0+IGJvb2xlYW4sIG9iajogYW55KTogYm9vbGVhbiB7XG5cdGlmICghb2JqKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGlmICghKEFycmF5LmlzQXJyYXkob2JqKSkpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0Zm9yIChjb25zdCBlbCBvZiBvYmopIHtcblx0XHRpZiAoIShlbGVtVHlwZShlbCkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cdHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBib29sKHByb3A6IGFueSwgZGVmVmFsdWU6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0aWYgKHR5cGVvZiBwcm9wID09PSAnYm9vbGVhbicpIHtcblx0XHRyZXR1cm4gcHJvcDtcblx0fVxuXHRyZXR1cm4gZGVmVmFsdWU7XG59XG5cbmZ1bmN0aW9uIHN0cmluZyhwcm9wOiBhbnksIGRlZlZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRpZiAodHlwZW9mIChwcm9wKSA9PT0gJ3N0cmluZycpIHtcblx0XHRyZXR1cm4gcHJvcDtcblx0fVxuXHRyZXR1cm4gZGVmVmFsdWU7XG59XG5cblxuZnVuY3Rpb24gYXJyYXlUb0hhc2goYXJyYXk6IHN0cmluZ1tdKTogeyBbbmFtZTogc3RyaW5nXTogdHJ1ZSB9IHtcblx0Y29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcblx0Zm9yIChjb25zdCBlIG9mIGFycmF5KSB7XG5cdFx0cmVzdWx0W2VdID0gdHJ1ZTtcblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5cbmZ1bmN0aW9uIGNyZWF0ZUtleXdvcmRNYXRjaGVyKGFycjogc3RyaW5nW10sIGNhc2VJbnNlbnNpdGl2ZTogYm9vbGVhbiA9IGZhbHNlKTogKHN0cjogc3RyaW5nKSA9PiBib29sZWFuIHtcblx0aWYgKGNhc2VJbnNlbnNpdGl2ZSkge1xuXHRcdGFyciA9IGFyci5tYXAoZnVuY3Rpb24gKHgpIHsgcmV0dXJuIHgudG9Mb3dlckNhc2UoKTsgfSk7XG5cdH1cblx0Y29uc3QgaGFzaCA9IGFycmF5VG9IYXNoKGFycik7XG5cdGlmIChjYXNlSW5zZW5zaXRpdmUpIHtcblx0XHRyZXR1cm4gZnVuY3Rpb24gKHdvcmQpIHtcblx0XHRcdHJldHVybiBoYXNoW3dvcmQudG9Mb3dlckNhc2UoKV0gIT09IHVuZGVmaW5lZCAmJiBoYXNoLmhhc093blByb3BlcnR5KHdvcmQudG9Mb3dlckNhc2UoKSk7XG5cdFx0fTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gZnVuY3Rpb24gKHdvcmQpIHtcblx0XHRcdHJldHVybiBoYXNoW3dvcmRdICE9PSB1bmRlZmluZWQgJiYgaGFzaC5oYXNPd25Qcm9wZXJ0eSh3b3JkKTtcblx0XHR9O1xuXHR9XG59XG5cblxuLy8gTGV4ZXIgaGVscGVyc1xuXG4vKipcbiAqIENvbXBpbGVzIGEgcmVndWxhciBleHByZXNzaW9uIHN0cmluZywgYWRkaW5nIHRoZSAnaScgZmxhZyBpZiAnaWdub3JlQ2FzZScgaXMgc2V0LCBhbmQgdGhlICd1JyBmbGFnIGlmICd1bmljb2RlJyBpcyBzZXQuXG4gKiBBbHNvIHJlcGxhY2VzIEBcXHcrIG9yIHNlcXVlbmNlcyB3aXRoIHRoZSBjb250ZW50IG9mIHRoZSBzcGVjaWZpZWQgYXR0cmlidXRlXG4gKiBAXFx3KyByZXBsYWNlbWVudCBjYW4gYmUgYXZvaWRlZCBieSBlc2NhcGluZyBgQGAgc2lnbnMgd2l0aCBhbm90aGVyIGBAYCBzaWduLlxuICogQGV4YW1wbGUgL0BhdHRyLyB3aWxsIGJlIHJlcGxhY2VkIHdpdGggdGhlIHZhbHVlIG9mIGxleGVyW2F0dHJdXG4gKiBAZXhhbXBsZSAvQEB0ZXh0LyB3aWxsIG5vdCBiZSByZXBsYWNlZCBhbmQgd2lsbCBiZWNvbWUgL0B0ZXh0Ly5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZVJlZ0V4cDxTIGV4dGVuZHMgdHJ1ZSB8IGZhbHNlPihsZXhlcjogbW9uYXJjaENvbW1vbi5JTGV4ZXJNaW4sIHN0cjogc3RyaW5nLCBoYW5kbGVTbjogUyk6IFMgZXh0ZW5kcyB0cnVlID8gUmVnRXhwIHwgRHluYW1pY1JlZ0V4cCA6IFJlZ0V4cDtcbmZ1bmN0aW9uIGNvbXBpbGVSZWdFeHAobGV4ZXI6IG1vbmFyY2hDb21tb24uSUxleGVyTWluLCBzdHI6IHN0cmluZywgaGFuZGxlU246IHRydWUgfCBmYWxzZSk6IFJlZ0V4cCB8IER5bmFtaWNSZWdFeHAge1xuXHQvLyBAQCBtdXN0IGJlIGludGVycHJldGVkIGFzIGEgbGl0ZXJhbCBALCBzbyB3ZSByZXBsYWNlIGFsbCBvY2N1cmVuY2VzIG9mIEBAIHdpdGggYSBwbGFjZWhvbGRlciBjaGFyYWN0ZXJcblx0c3RyID0gc3RyLnJlcGxhY2UoL0BAL2csIGBcXHgwMWApO1xuXG5cdGxldCBuID0gMDtcblx0bGV0IGhhZEV4cGFuc2lvbjogYm9vbGVhbjtcblx0ZG8ge1xuXHRcdGhhZEV4cGFuc2lvbiA9IGZhbHNlO1xuXHRcdHN0ciA9IHN0ci5yZXBsYWNlKC9AKFxcdyspL2csIGZ1bmN0aW9uIChzLCBhdHRyPykge1xuXHRcdFx0aGFkRXhwYW5zaW9uID0gdHJ1ZTtcblx0XHRcdGxldCBzdWIgPSAnJztcblx0XHRcdGlmICh0eXBlb2YgKGxleGVyW2F0dHJdKSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0c3ViID0gbGV4ZXJbYXR0cl07XG5cdFx0XHR9IGVsc2UgaWYgKGxleGVyW2F0dHJdICYmIGxleGVyW2F0dHJdIGluc3RhbmNlb2YgUmVnRXhwKSB7XG5cdFx0XHRcdHN1YiA9IGxleGVyW2F0dHJdLnNvdXJjZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChsZXhlclthdHRyXSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGhyb3cgbW9uYXJjaENvbW1vbi5jcmVhdGVFcnJvcihsZXhlciwgJ2xhbmd1YWdlIGRlZmluaXRpb24gZG9lcyBub3QgY29udGFpbiBhdHRyaWJ1dGUgXFwnJyArIGF0dHIgKyAnXFwnLCB1c2VkIGF0OiAnICsgc3RyKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aHJvdyBtb25hcmNoQ29tbW9uLmNyZWF0ZUVycm9yKGxleGVyLCAnYXR0cmlidXRlIHJlZmVyZW5jZSBcXCcnICsgYXR0ciArICdcXCcgbXVzdCBiZSBhIHN0cmluZywgdXNlZCBhdDogJyArIHN0cik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiAobW9uYXJjaENvbW1vbi5lbXB0eShzdWIpID8gJycgOiAnKD86JyArIHN1YiArICcpJyk7XG5cdFx0fSk7XG5cdFx0bisrO1xuXHR9IHdoaWxlIChoYWRFeHBhbnNpb24gJiYgbiA8IDUpO1xuXG5cdC8vIGhhbmRsZSBlc2NhcGVkIEBAXG5cdHN0ciA9IHN0ci5yZXBsYWNlKC9cXHgwMS9nLCAnQCcpO1xuXG5cdGNvbnN0IGZsYWdzID0gKGxleGVyLmlnbm9yZUNhc2UgPyAnaScgOiAnJykgKyAobGV4ZXIudW5pY29kZSA/ICd1JyA6ICcnKTtcblxuXHQvLyBoYW5kbGUgJFNuXG5cdGlmIChoYW5kbGVTbikge1xuXHRcdGNvbnN0IG1hdGNoID0gc3RyLm1hdGNoKC9cXCRbc1NdKFxcZFxcZD8pL2cpO1xuXHRcdGlmIChtYXRjaCkge1xuXHRcdFx0bGV0IGxhc3RTdGF0ZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdFx0XHRsZXQgbGFzdFJlZ0V4OiBSZWdFeHAgfCBudWxsID0gbnVsbDtcblx0XHRcdHJldHVybiAoc3RhdGU6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRpZiAobGFzdFJlZ0V4ICYmIGxhc3RTdGF0ZSA9PT0gc3RhdGUpIHtcblx0XHRcdFx0XHRyZXR1cm4gbGFzdFJlZ0V4O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxhc3RTdGF0ZSA9IHN0YXRlO1xuXHRcdFx0XHRsYXN0UmVnRXggPSBuZXcgUmVnRXhwKG1vbmFyY2hDb21tb24uc3Vic3RpdHV0ZU1hdGNoZXNSZShsZXhlciwgc3RyLCBzdGF0ZSksIGZsYWdzKTtcblx0XHRcdFx0cmV0dXJuIGxhc3RSZWdFeDtcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG5ldyBSZWdFeHAoc3RyLCBmbGFncyk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgZ3VhcmQgZnVuY3Rpb25zIGZvciBjYXNlIG1hdGNoZXMuXG4gKiBUaGlzIGNvbXBpbGVzICdjYXNlcycgYXR0cmlidXRlcyBpbnRvIGVmZmljaWVudCBtYXRjaCBmdW5jdGlvbnMuXG4gKlxuICovXG5mdW5jdGlvbiBzZWxlY3RTY3J1dGluZWUoaWQ6IHN0cmluZywgbWF0Y2hlczogc3RyaW5nW10sIHN0YXRlOiBzdHJpbmcsIG51bTogbnVtYmVyKTogc3RyaW5nIHwgbnVsbCB7XG5cdGlmIChudW0gPCAwKSB7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdGlmIChudW0gPCBtYXRjaGVzLmxlbmd0aCkge1xuXHRcdHJldHVybiBtYXRjaGVzW251bV07XG5cdH1cblx0aWYgKG51bSA+PSAxMDApIHtcblx0XHRudW0gPSBudW0gLSAxMDA7XG5cdFx0Y29uc3QgcGFydHMgPSBzdGF0ZS5zcGxpdCgnLicpO1xuXHRcdHBhcnRzLnVuc2hpZnQoc3RhdGUpO1xuXHRcdGlmIChudW0gPCBwYXJ0cy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBwYXJ0c1tudW1dO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlR3VhcmQobGV4ZXI6IG1vbmFyY2hDb21tb24uSUxleGVyTWluLCBydWxlTmFtZTogc3RyaW5nLCB0a2V5OiBzdHJpbmcsIHZhbDogbW9uYXJjaENvbW1vbi5GdXp6eUFjdGlvbik6IG1vbmFyY2hDb21tb24uSUJyYW5jaCB7XG5cdC8vIGdldCB0aGUgc2NydXRpbmVlIGFuZCBwYXR0ZXJuXG5cdGxldCBzY3J1dCA9IC0xOyAvLyAtMTogJCEsIDAtOTk6ICRuLCAxMDArbjogJFNuXG5cdGxldCBvcHBhdCA9IHRrZXk7XG5cdGxldCBtYXRjaGVzID0gdGtleS5tYXRjaCgvXlxcJCgoW3NTXT8pKFxcZFxcZD8pfCMpKC4qKSQvKTtcblx0aWYgKG1hdGNoZXMpIHtcblx0XHRpZiAobWF0Y2hlc1szXSkgeyAvLyBpZiBkaWdpdHNcblx0XHRcdHNjcnV0ID0gcGFyc2VJbnQobWF0Y2hlc1szXSk7XG5cdFx0XHRpZiAobWF0Y2hlc1syXSkge1xuXHRcdFx0XHRzY3J1dCA9IHNjcnV0ICsgMTAwOyAvLyBpZiBbc1NdIHByZXNlbnRcblx0XHRcdH1cblx0XHR9XG5cdFx0b3BwYXQgPSBtYXRjaGVzWzRdO1xuXHR9XG5cdC8vIGdldCBvcGVyYXRvclxuXHRsZXQgb3AgPSAnfic7XG5cdGxldCBwYXQgPSBvcHBhdDtcblx0aWYgKCFvcHBhdCB8fCBvcHBhdC5sZW5ndGggPT09IDApIHtcblx0XHRvcCA9ICchPSc7XG5cdFx0cGF0ID0gJyc7XG5cdH1cblx0ZWxzZSBpZiAoL15cXHcqJC8udGVzdChwYXQpKSB7ICAvLyBqdXN0IGEgd29yZFxuXHRcdG9wID0gJz09Jztcblx0fVxuXHRlbHNlIHtcblx0XHRtYXRjaGVzID0gb3BwYXQubWF0Y2goL14oQHwhQHx+fCF+fD09fCE9KSguKikkLyk7XG5cdFx0aWYgKG1hdGNoZXMpIHtcblx0XHRcdG9wID0gbWF0Y2hlc1sxXTtcblx0XHRcdHBhdCA9IG1hdGNoZXNbMl07XG5cdFx0fVxuXHR9XG5cblx0Ly8gc2V0IHRoZSB0ZXN0ZXIgZnVuY3Rpb25cblx0bGV0IHRlc3RlcjogKHM6IHN0cmluZywgaWQ6IHN0cmluZywgbWF0Y2hlczogc3RyaW5nW10sIHN0YXRlOiBzdHJpbmcsIGVvczogYm9vbGVhbikgPT4gYm9vbGVhbjtcblxuXHQvLyBzcGVjaWFsIGNhc2UgYSByZWdleHAgdGhhdCBtYXRjaGVzIGp1c3Qgd29yZHNcblx0aWYgKChvcCA9PT0gJ34nIHx8IG9wID09PSAnIX4nKSAmJiAvXihcXHd8XFx8KSokLy50ZXN0KHBhdCkpIHtcblx0XHRjb25zdCBpbldvcmRzID0gY3JlYXRlS2V5d29yZE1hdGNoZXIocGF0LnNwbGl0KCd8JyksIGxleGVyLmlnbm9yZUNhc2UpO1xuXHRcdHRlc3RlciA9IGZ1bmN0aW9uIChzKSB7IHJldHVybiAob3AgPT09ICd+JyA/IGluV29yZHMocykgOiAhaW5Xb3JkcyhzKSk7IH07XG5cdH1cblx0ZWxzZSBpZiAob3AgPT09ICdAJyB8fCBvcCA9PT0gJyFAJykge1xuXHRcdGNvbnN0IHdvcmRzID0gbGV4ZXJbcGF0XTtcblx0XHRpZiAoIXdvcmRzKSB7XG5cdFx0XHR0aHJvdyBtb25hcmNoQ29tbW9uLmNyZWF0ZUVycm9yKGxleGVyLCAndGhlIEAgbWF0Y2ggdGFyZ2V0IFxcJycgKyBwYXQgKyAnXFwnIGlzIG5vdCBkZWZpbmVkLCBpbiBydWxlOiAnICsgcnVsZU5hbWUpO1xuXHRcdH1cblx0XHRpZiAoIShpc0FycmF5T2YoZnVuY3Rpb24gKGVsZW0pIHsgcmV0dXJuICh0eXBlb2YgKGVsZW0pID09PSAnc3RyaW5nJyk7IH0sIHdvcmRzKSkpIHtcblx0XHRcdHRocm93IG1vbmFyY2hDb21tb24uY3JlYXRlRXJyb3IobGV4ZXIsICd0aGUgQCBtYXRjaCB0YXJnZXQgXFwnJyArIHBhdCArICdcXCcgbXVzdCBiZSBhbiBhcnJheSBvZiBzdHJpbmdzLCBpbiBydWxlOiAnICsgcnVsZU5hbWUpO1xuXHRcdH1cblx0XHRjb25zdCBpbldvcmRzID0gY3JlYXRlS2V5d29yZE1hdGNoZXIod29yZHMsIGxleGVyLmlnbm9yZUNhc2UpO1xuXHRcdHRlc3RlciA9IGZ1bmN0aW9uIChzKSB7IHJldHVybiAob3AgPT09ICdAJyA/IGluV29yZHMocykgOiAhaW5Xb3JkcyhzKSk7IH07XG5cdH1cblx0ZWxzZSBpZiAob3AgPT09ICd+JyB8fCBvcCA9PT0gJyF+Jykge1xuXHRcdGlmIChwYXQuaW5kZXhPZignJCcpIDwgMCkge1xuXHRcdFx0Ly8gcHJlY29tcGlsZSByZWd1bGFyIGV4cHJlc3Npb25cblx0XHRcdGNvbnN0IHJlID0gY29tcGlsZVJlZ0V4cChsZXhlciwgJ14nICsgcGF0ICsgJyQnLCBmYWxzZSk7XG5cdFx0XHR0ZXN0ZXIgPSBmdW5jdGlvbiAocykgeyByZXR1cm4gKG9wID09PSAnficgPyByZS50ZXN0KHMpIDogIXJlLnRlc3QocykpOyB9O1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRlc3RlciA9IGZ1bmN0aW9uIChzLCBpZCwgbWF0Y2hlcywgc3RhdGUpIHtcblx0XHRcdFx0Y29uc3QgcmUgPSBjb21waWxlUmVnRXhwKGxleGVyLCAnXicgKyBtb25hcmNoQ29tbW9uLnN1YnN0aXR1dGVNYXRjaGVzKGxleGVyLCBwYXQsIGlkLCBtYXRjaGVzLCBzdGF0ZSkgKyAnJCcsIGZhbHNlKTtcblx0XHRcdFx0cmV0dXJuIHJlLnRlc3Qocyk7XG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXHRlbHNlIHsgLy8gaWYgKG9wPT09Jz09JyB8fCBvcD09PSchPScpIHtcblx0XHRpZiAocGF0LmluZGV4T2YoJyQnKSA8IDApIHtcblx0XHRcdGNvbnN0IHBhdHggPSBtb25hcmNoQ29tbW9uLmZpeENhc2UobGV4ZXIsIHBhdCk7XG5cdFx0XHR0ZXN0ZXIgPSBmdW5jdGlvbiAocykgeyByZXR1cm4gKG9wID09PSAnPT0nID8gcyA9PT0gcGF0eCA6IHMgIT09IHBhdHgpOyB9O1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGNvbnN0IHBhdHggPSBtb25hcmNoQ29tbW9uLmZpeENhc2UobGV4ZXIsIHBhdCk7XG5cdFx0XHR0ZXN0ZXIgPSBmdW5jdGlvbiAocywgaWQsIG1hdGNoZXMsIHN0YXRlLCBlb3MpIHtcblx0XHRcdFx0Y29uc3QgcGF0ZXhwID0gbW9uYXJjaENvbW1vbi5zdWJzdGl0dXRlTWF0Y2hlcyhsZXhlciwgcGF0eCwgaWQsIG1hdGNoZXMsIHN0YXRlKTtcblx0XHRcdFx0cmV0dXJuIChvcCA9PT0gJz09JyA/IHMgPT09IHBhdGV4cCA6IHMgIT09IHBhdGV4cCk7XG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXG5cdC8vIHJldHVybiB0aGUgYnJhbmNoIG9iamVjdFxuXHRpZiAoc2NydXQgPT09IC0xKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IHRrZXksIHZhbHVlOiB2YWwsIHRlc3Q6IGZ1bmN0aW9uIChpZCwgbWF0Y2hlcywgc3RhdGUsIGVvcykge1xuXHRcdFx0XHRyZXR1cm4gdGVzdGVyKGlkLCBpZCwgbWF0Y2hlcywgc3RhdGUsIGVvcyk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXHRlbHNlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGtleSwgdmFsdWU6IHZhbCwgdGVzdDogZnVuY3Rpb24gKGlkLCBtYXRjaGVzLCBzdGF0ZSwgZW9zKSB7XG5cdFx0XHRcdGNvbnN0IHNjcnV0aW5lZSA9IHNlbGVjdFNjcnV0aW5lZShpZCwgbWF0Y2hlcywgc3RhdGUsIHNjcnV0KTtcblx0XHRcdFx0cmV0dXJuIHRlc3Rlcighc2NydXRpbmVlID8gJycgOiBzY3J1dGluZWUsIGlkLCBtYXRjaGVzLCBzdGF0ZSwgZW9zKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG5cbi8qKlxuICogQ29tcGlsZXMgYW4gYWN0aW9uOiBpLmUuIG9wdGltaXplIHJlZ3VsYXIgZXhwcmVzc2lvbnMgYW5kIGNhc2UgbWF0Y2hlc1xuICogYW5kIGRvIG1hbnkgc2FuaXR5IGNoZWNrcy5cbiAqXG4gKiBUaGlzIGlzIGNhbGxlZCBvbmx5IGR1cmluZyBjb21waWxhdGlvbiBidXQgaWYgdGhlIGxleGVyIGRlZmluaXRpb25cbiAqIGNvbnRhaW5zIHVzZXIgZnVuY3Rpb25zIGFzIGFjdGlvbnMgKHdoaWNoIGlzIHVzdWFsbHkgbm90IGFsbG93ZWQpLCB0aGVuIHRoaXNcbiAqIG1heSBiZSBjYWxsZWQgZHVyaW5nIGxleGluZy4gSXQgaXMgaW1wb3J0YW50IHRoZXJlZm9yZSB0byBjb21waWxlIGNvbW1vbiBjYXNlcyBlZmZpY2llbnRseVxuICovXG5mdW5jdGlvbiBjb21waWxlQWN0aW9uKGxleGVyOiBtb25hcmNoQ29tbW9uLklMZXhlck1pbiwgcnVsZU5hbWU6IHN0cmluZywgYWN0aW9uOiBhbnkpOiBtb25hcmNoQ29tbW9uLkZ1enp5QWN0aW9uIHtcblx0aWYgKCFhY3Rpb24pIHtcblx0XHRyZXR1cm4geyB0b2tlbjogJycgfTtcblx0fVxuXHRlbHNlIGlmICh0eXBlb2YgKGFjdGlvbikgPT09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuIGFjdGlvbjsgLy8geyB0b2tlbjogYWN0aW9uIH07XG5cdH1cblx0ZWxzZSBpZiAoYWN0aW9uLnRva2VuIHx8IGFjdGlvbi50b2tlbiA9PT0gJycpIHtcblx0XHRpZiAodHlwZW9mIChhY3Rpb24udG9rZW4pICE9PSAnc3RyaW5nJykge1xuXHRcdFx0dGhyb3cgbW9uYXJjaENvbW1vbi5jcmVhdGVFcnJvcihsZXhlciwgJ2EgXFwndG9rZW5cXCcgYXR0cmlidXRlIG11c3QgYmUgb2YgdHlwZSBzdHJpbmcsIGluIHJ1bGU6ICcgKyBydWxlTmFtZSk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0Ly8gb25seSBjb3B5IHNwZWNpZmljIHR5cGVkIGZpZWxkcyAob25seSBoYXBwZW5zIG9uY2UgZHVyaW5nIGNvbXBpbGUgTGV4ZXIpXG5cdFx0XHRjb25zdCBuZXdBY3Rpb246IG1vbmFyY2hDb21tb24uSUFjdGlvbiA9IHsgdG9rZW46IGFjdGlvbi50b2tlbiB9O1xuXHRcdFx0aWYgKGFjdGlvbi50b2tlbi5pbmRleE9mKCckJykgPj0gMCkge1xuXHRcdFx0XHRuZXdBY3Rpb24udG9rZW5TdWJzdCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAodHlwZW9mIChhY3Rpb24uYnJhY2tldCkgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGlmIChhY3Rpb24uYnJhY2tldCA9PT0gJ0BvcGVuJykge1xuXHRcdFx0XHRcdG5ld0FjdGlvbi5icmFja2V0ID0gbW9uYXJjaENvbW1vbi5Nb25hcmNoQnJhY2tldC5PcGVuO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGFjdGlvbi5icmFja2V0ID09PSAnQGNsb3NlJykge1xuXHRcdFx0XHRcdG5ld0FjdGlvbi5icmFja2V0ID0gbW9uYXJjaENvbW1vbi5Nb25hcmNoQnJhY2tldC5DbG9zZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aHJvdyBtb25hcmNoQ29tbW9uLmNyZWF0ZUVycm9yKGxleGVyLCAnYSBcXCdicmFja2V0XFwnIGF0dHJpYnV0ZSBtdXN0IGJlIGVpdGhlciBcXCdAb3BlblxcJyBvciBcXCdAY2xvc2VcXCcsIGluIHJ1bGU6ICcgKyBydWxlTmFtZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChhY3Rpb24ubmV4dCkge1xuXHRcdFx0XHRpZiAodHlwZW9mIChhY3Rpb24ubmV4dCkgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbW9uYXJjaENvbW1vbi5jcmVhdGVFcnJvcihsZXhlciwgJ3RoZSBuZXh0IHN0YXRlIG11c3QgYmUgYSBzdHJpbmcgdmFsdWUgaW4gcnVsZTogJyArIHJ1bGVOYW1lKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRsZXQgbmV4dDogc3RyaW5nID0gYWN0aW9uLm5leHQ7XG5cdFx0XHRcdFx0aWYgKCEvXihAcG9wfEBwdXNofEBwb3BhbGwpJC8udGVzdChuZXh0KSkge1xuXHRcdFx0XHRcdFx0aWYgKG5leHRbMF0gPT09ICdAJykge1xuXHRcdFx0XHRcdFx0XHRuZXh0ID0gbmV4dC5zdWJzdHIoMSk7IC8vIHBlZWwgb2ZmIHN0YXJ0aW5nIEAgc2lnblxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKG5leHQuaW5kZXhPZignJCcpIDwgMCkgeyAgLy8gbm8gZG9sbGFyIHN1YnN0aXR1dGlvbiwgd2UgY2FuIGNoZWNrIGlmIHRoZSBzdGF0ZSBleGlzdHNcblx0XHRcdFx0XHRcdFx0aWYgKCFtb25hcmNoQ29tbW9uLnN0YXRlRXhpc3RzKGxleGVyLCBtb25hcmNoQ29tbW9uLnN1YnN0aXR1dGVNYXRjaGVzKGxleGVyLCBuZXh0LCAnJywgW10sICcnKSkpIHtcblx0XHRcdFx0XHRcdFx0XHR0aHJvdyBtb25hcmNoQ29tbW9uLmNyZWF0ZUVycm9yKGxleGVyLCAndGhlIG5leHQgc3RhdGUgXFwnJyArIGFjdGlvbi5uZXh0ICsgJ1xcJyBpcyBub3QgZGVmaW5lZCBpbiBydWxlOiAnICsgcnVsZU5hbWUpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG5ld0FjdGlvbi5uZXh0ID0gbmV4dDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiAoYWN0aW9uLmdvQmFjaykgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdG5ld0FjdGlvbi5nb0JhY2sgPSBhY3Rpb24uZ29CYWNrO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiAoYWN0aW9uLnN3aXRjaFRvKSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0bmV3QWN0aW9uLnN3aXRjaFRvID0gYWN0aW9uLnN3aXRjaFRvO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiAoYWN0aW9uLmxvZykgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdG5ld0FjdGlvbi5sb2cgPSBhY3Rpb24ubG9nO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiAoYWN0aW9uLm5leHRFbWJlZGRlZCkgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdG5ld0FjdGlvbi5uZXh0RW1iZWRkZWQgPSBhY3Rpb24ubmV4dEVtYmVkZGVkO1xuXHRcdFx0XHRsZXhlci51c2VzRW1iZWRkZWQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5ld0FjdGlvbjtcblx0XHR9XG5cdH1cblx0ZWxzZSBpZiAoQXJyYXkuaXNBcnJheShhY3Rpb24pKSB7XG5cdFx0Y29uc3QgcmVzdWx0czogbW9uYXJjaENvbW1vbi5GdXp6eUFjdGlvbltdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGFjdGlvbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0cmVzdWx0c1tpXSA9IGNvbXBpbGVBY3Rpb24obGV4ZXIsIHJ1bGVOYW1lLCBhY3Rpb25baV0pO1xuXHRcdH1cblx0XHRyZXR1cm4geyBncm91cDogcmVzdWx0cyB9O1xuXHR9XG5cdGVsc2UgaWYgKGFjdGlvbi5jYXNlcykge1xuXHRcdC8vIGJ1aWxkIGFuIGFycmF5IG9mIHRlc3QgY2FzZXNcblx0XHRjb25zdCBjYXNlczogbW9uYXJjaENvbW1vbi5JQnJhbmNoW10gPSBbXTtcblxuXHRcdC8vIGZvciBlYWNoIGNhc2UsIHB1c2ggYSB0ZXN0IGZ1bmN0aW9uIGFuZCByZXN1bHQgdmFsdWVcblx0XHRmb3IgKGNvbnN0IHRrZXkgaW4gYWN0aW9uLmNhc2VzKSB7XG5cdFx0XHRpZiAoYWN0aW9uLmNhc2VzLmhhc093blByb3BlcnR5KHRrZXkpKSB7XG5cdFx0XHRcdGNvbnN0IHZhbCA9IGNvbXBpbGVBY3Rpb24obGV4ZXIsIHJ1bGVOYW1lLCBhY3Rpb24uY2FzZXNbdGtleV0pO1xuXG5cdFx0XHRcdC8vIHdoYXQga2luZCBvZiBjYXNlXG5cdFx0XHRcdGlmICh0a2V5ID09PSAnQGRlZmF1bHQnIHx8IHRrZXkgPT09ICdAJyB8fCB0a2V5ID09PSAnJykge1xuXHRcdFx0XHRcdGNhc2VzLnB1c2goeyB0ZXN0OiB1bmRlZmluZWQsIHZhbHVlOiB2YWwsIG5hbWU6IHRrZXkgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSBpZiAodGtleSA9PT0gJ0Blb3MnKSB7XG5cdFx0XHRcdFx0Y2FzZXMucHVzaCh7IHRlc3Q6IGZ1bmN0aW9uIChpZCwgbWF0Y2hlcywgc3RhdGUsIGVvcykgeyByZXR1cm4gZW9zOyB9LCB2YWx1ZTogdmFsLCBuYW1lOiB0a2V5IH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGNhc2VzLnB1c2goY3JlYXRlR3VhcmQobGV4ZXIsIHJ1bGVOYW1lLCB0a2V5LCB2YWwpKTsgIC8vIGNhbGwgc2VwYXJhdGUgZnVuY3Rpb24gdG8gYXZvaWQgbG9jYWwgdmFyaWFibGUgY2FwdHVyZVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gY3JlYXRlIGEgbWF0Y2hpbmcgZnVuY3Rpb25cblx0XHRjb25zdCBkZWYgPSBsZXhlci5kZWZhdWx0VG9rZW47XG5cdFx0cmV0dXJuIHtcblx0XHRcdHRlc3Q6IGZ1bmN0aW9uIChpZCwgbWF0Y2hlcywgc3RhdGUsIGVvcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IF9jYXNlIG9mIGNhc2VzKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGlkbWF0Y2ggPSAoIV9jYXNlLnRlc3QgfHwgX2Nhc2UudGVzdChpZCwgbWF0Y2hlcywgc3RhdGUsIGVvcykpO1xuXHRcdFx0XHRcdGlmIChkaWRtYXRjaCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIF9jYXNlLnZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZGVmO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblx0ZWxzZSB7XG5cdFx0dGhyb3cgbW9uYXJjaENvbW1vbi5jcmVhdGVFcnJvcihsZXhlciwgJ2FuIGFjdGlvbiBtdXN0IGJlIGEgc3RyaW5nLCBhbiBvYmplY3Qgd2l0aCBhIFxcJ3Rva2VuXFwnIG9yIFxcJ2Nhc2VzXFwnIGF0dHJpYnV0ZSwgb3IgYW4gYXJyYXkgb2YgYWN0aW9uczsgaW4gcnVsZTogJyArIHJ1bGVOYW1lKTtcblx0fVxufVxuXG50eXBlIER5bmFtaWNSZWdFeHAgPSAoc3RhdGU6IHN0cmluZykgPT4gUmVnRXhwO1xuXG4vKipcbiAqIEhlbHBlciBjbGFzcyBmb3IgY3JlYXRpbmcgbWF0Y2hpbmcgcnVsZXNcbiAqL1xuY2xhc3MgUnVsZSBpbXBsZW1lbnRzIG1vbmFyY2hDb21tb24uSVJ1bGUge1xuXHRwcml2YXRlIHJlZ2V4OiBSZWdFeHAgfCBEeW5hbWljUmVnRXhwID0gbmV3IFJlZ0V4cCgnJyk7XG5cdHB1YmxpYyBhY3Rpb246IG1vbmFyY2hDb21tb24uRnV6enlBY3Rpb24gPSB7IHRva2VuOiAnJyB9O1xuXHRwdWJsaWMgbWF0Y2hPbmx5QXRMaW5lU3RhcnQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHVibGljIG5hbWU6IHN0cmluZyA9ICcnO1xuXG5cdGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZykge1xuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdH1cblxuXHRwdWJsaWMgc2V0UmVnZXgobGV4ZXI6IG1vbmFyY2hDb21tb24uSUxleGVyTWluLCByZTogc3RyaW5nIHwgUmVnRXhwKTogdm9pZCB7XG5cdFx0bGV0IHNyZWdleDogc3RyaW5nO1xuXHRcdGlmICh0eXBlb2YgKHJlKSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHNyZWdleCA9IHJlO1xuXHRcdH1cblx0XHRlbHNlIGlmIChyZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuXHRcdFx0c3JlZ2V4ID0gKDxSZWdFeHA+cmUpLnNvdXJjZTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR0aHJvdyBtb25hcmNoQ29tbW9uLmNyZWF0ZUVycm9yKGxleGVyLCAncnVsZXMgbXVzdCBzdGFydCB3aXRoIGEgbWF0Y2ggc3RyaW5nIG9yIHJlZ3VsYXIgZXhwcmVzc2lvbjogJyArIHRoaXMubmFtZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5tYXRjaE9ubHlBdExpbmVTdGFydCA9IChzcmVnZXgubGVuZ3RoID4gMCAmJiBzcmVnZXhbMF0gPT09ICdeJyk7XG5cdFx0dGhpcy5uYW1lID0gdGhpcy5uYW1lICsgJzogJyArIHNyZWdleDtcblx0XHR0aGlzLnJlZ2V4ID0gY29tcGlsZVJlZ0V4cChsZXhlciwgJ14oPzonICsgKHRoaXMubWF0Y2hPbmx5QXRMaW5lU3RhcnQgPyBzcmVnZXguc3Vic3RyKDEpIDogc3JlZ2V4KSArICcpJywgdHJ1ZSk7XG5cdH1cblxuXHRwdWJsaWMgc2V0QWN0aW9uKGxleGVyOiBtb25hcmNoQ29tbW9uLklMZXhlck1pbiwgYWN0OiBtb25hcmNoQ29tbW9uLklBY3Rpb24pIHtcblx0XHR0aGlzLmFjdGlvbiA9IGNvbXBpbGVBY3Rpb24obGV4ZXIsIHRoaXMubmFtZSwgYWN0KTtcblx0fVxuXG5cdHB1YmxpYyByZXNvbHZlUmVnZXgoc3RhdGU6IHN0cmluZyk6IFJlZ0V4cCB7XG5cdFx0aWYgKHRoaXMucmVnZXggaW5zdGFuY2VvZiBSZWdFeHApIHtcblx0XHRcdHJldHVybiB0aGlzLnJlZ2V4O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZWdleChzdGF0ZSk7XG5cdFx0fVxuXHR9XG59XG5cbi8qKlxuICogQ29tcGlsZXMgYSBqc29uIGRlc2NyaXB0aW9uIGZ1bmN0aW9uIGludG8ganNvbiB3aGVyZSBhbGwgcmVndWxhciBleHByZXNzaW9ucyxcbiAqIGNhc2UgbWF0Y2hlcyBldGMsIGFyZSBjb21waWxlZCBhbmQgYWxsIGluY2x1ZGUgcnVsZXMgYXJlIGV4cGFuZGVkLlxuICogV2UgYWxzbyBjb21waWxlIHRoZSBicmFja2V0IGRlZmluaXRpb25zLCBzdXBwbHkgZGVmYXVsdHMsIGFuZCBkbyBtYW55IHNhbml0eSBjaGVja3MuXG4gKiBJZiB0aGUgJ2pzb25TdHJpY3QnIHBhcmFtZXRlciBpcyAnZmFsc2UnLCB3ZSBhbGxvdyBhdCBjZXJ0YWluIGxvY2F0aW9uc1xuICogcmVndWxhciBleHByZXNzaW9uIG9iamVjdHMgYW5kIGZ1bmN0aW9ucyB0aGF0IGdldCBjYWxsZWQgZHVyaW5nIGxleGluZy5cbiAqIChDdXJyZW50bHkgd2UgaGF2ZSBubyBzYW1wbGVzIHRoYXQgbmVlZCB0aGlzIHNvIHBlcmhhcHMgd2Ugc2hvdWxkIGFsd2F5cyBoYXZlXG4gKiBqc29uU3RyaWN0IHRvIHRydWUpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZShsYW5ndWFnZUlkOiBzdHJpbmcsIGpzb246IElNb25hcmNoTGFuZ3VhZ2UpOiBtb25hcmNoQ29tbW9uLklMZXhlciB7XG5cdGlmICghanNvbiB8fCB0eXBlb2YgKGpzb24pICE9PSAnb2JqZWN0Jykge1xuXHRcdHRocm93IG5ldyBFcnJvcignTW9uYXJjaDogZXhwZWN0aW5nIGEgbGFuZ3VhZ2UgZGVmaW5pdGlvbiBvYmplY3QnKTtcblx0fVxuXG5cdC8vIENyZWF0ZSBvdXIgbGV4ZXJcblx0Y29uc3QgbGV4ZXI6IG1vbmFyY2hDb21tb24uSUxleGVyID0ge1xuXHRcdGxhbmd1YWdlSWQ6IGxhbmd1YWdlSWQsXG5cdFx0aW5jbHVkZUxGOiBib29sKGpzb24uaW5jbHVkZUxGLCBmYWxzZSksXG5cdFx0bm9UaHJvdzogZmFsc2UsIC8vIHJhaXNlIGV4Y2VwdGlvbnMgZHVyaW5nIGNvbXBpbGF0aW9uXG5cdFx0bWF4U3RhY2s6IDEwMCxcblx0XHRzdGFydDogKHR5cGVvZiBqc29uLnN0YXJ0ID09PSAnc3RyaW5nJyA/IGpzb24uc3RhcnQgOiBudWxsKSxcblx0XHRpZ25vcmVDYXNlOiBib29sKGpzb24uaWdub3JlQ2FzZSwgZmFsc2UpLFxuXHRcdHVuaWNvZGU6IGJvb2woanNvbi51bmljb2RlLCBmYWxzZSksXG5cdFx0dG9rZW5Qb3N0Zml4OiBzdHJpbmcoanNvbi50b2tlblBvc3RmaXgsICcuJyArIGxhbmd1YWdlSWQpLFxuXHRcdGRlZmF1bHRUb2tlbjogc3RyaW5nKGpzb24uZGVmYXVsdFRva2VuLCAnc291cmNlJyksXG5cdFx0dXNlc0VtYmVkZGVkOiBmYWxzZSwgLy8gYmVjb21lcyB0cnVlIGlmIHdlIGZpbmQgYSBuZXh0RW1iZWRkZWQgYWN0aW9uXG5cdFx0c3RhdGVOYW1lczoge30sXG5cdFx0dG9rZW5pemVyOiB7fSxcblx0XHRicmFja2V0czogW11cblx0fTtcblxuXHQvLyBGb3IgY2FsbGluZyBjb21waWxlQWN0aW9uIGxhdGVyIG9uXG5cdGNvbnN0IGxleGVyTWluOiBtb25hcmNoQ29tbW9uLklMZXhlck1pbiA9IDxhbnk+anNvbjtcblx0bGV4ZXJNaW4ubGFuZ3VhZ2VJZCA9IGxhbmd1YWdlSWQ7XG5cdGxleGVyTWluLmluY2x1ZGVMRiA9IGxleGVyLmluY2x1ZGVMRjtcblx0bGV4ZXJNaW4uaWdub3JlQ2FzZSA9IGxleGVyLmlnbm9yZUNhc2U7XG5cdGxleGVyTWluLnVuaWNvZGUgPSBsZXhlci51bmljb2RlO1xuXHRsZXhlck1pbi5ub1Rocm93ID0gbGV4ZXIubm9UaHJvdztcblx0bGV4ZXJNaW4udXNlc0VtYmVkZGVkID0gbGV4ZXIudXNlc0VtYmVkZGVkO1xuXHRsZXhlck1pbi5zdGF0ZU5hbWVzID0ganNvbi50b2tlbml6ZXI7XG5cdGxleGVyTWluLmRlZmF1bHRUb2tlbiA9IGxleGVyLmRlZmF1bHRUb2tlbjtcblxuXG5cdC8vIENvbXBpbGUgYW4gYXJyYXkgb2YgcnVsZXMgaW50byBuZXdydWxlcyB3aGVyZSBSZWdFeHAgb2JqZWN0cyBhcmUgY3JlYXRlZC5cblx0ZnVuY3Rpb24gYWRkUnVsZXMoc3RhdGU6IHN0cmluZywgbmV3cnVsZXM6IG1vbmFyY2hDb21tb24uSVJ1bGVbXSwgcnVsZXM6IGFueVtdKSB7XG5cdFx0Zm9yIChjb25zdCBydWxlIG9mIHJ1bGVzKSB7XG5cblx0XHRcdGxldCBpbmNsdWRlID0gcnVsZS5pbmNsdWRlO1xuXHRcdFx0aWYgKGluY2x1ZGUpIHtcblx0XHRcdFx0aWYgKHR5cGVvZiAoaW5jbHVkZSkgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbW9uYXJjaENvbW1vbi5jcmVhdGVFcnJvcihsZXhlciwgJ2FuIFxcJ2luY2x1ZGVcXCcgYXR0cmlidXRlIG11c3QgYmUgYSBzdHJpbmcgYXQ6ICcgKyBzdGF0ZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGluY2x1ZGVbMF0gPT09ICdAJykge1xuXHRcdFx0XHRcdGluY2x1ZGUgPSBpbmNsdWRlLnN1YnN0cigxKTsgLy8gcGVlbCBvZmYgc3RhcnRpbmcgQFxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghanNvbi50b2tlbml6ZXJbaW5jbHVkZV0pIHtcblx0XHRcdFx0XHR0aHJvdyBtb25hcmNoQ29tbW9uLmNyZWF0ZUVycm9yKGxleGVyLCAnaW5jbHVkZSB0YXJnZXQgXFwnJyArIGluY2x1ZGUgKyAnXFwnIGlzIG5vdCBkZWZpbmVkIGF0OiAnICsgc3RhdGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFkZFJ1bGVzKHN0YXRlICsgJy4nICsgaW5jbHVkZSwgbmV3cnVsZXMsIGpzb24udG9rZW5pemVyW2luY2x1ZGVdKTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRjb25zdCBuZXdydWxlID0gbmV3IFJ1bGUoc3RhdGUpO1xuXG5cdFx0XHRcdC8vIFNldCB1cCBuZXcgcnVsZSBhdHRyaWJ1dGVzXG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHJ1bGUpICYmIHJ1bGUubGVuZ3RoID49IDEgJiYgcnVsZS5sZW5ndGggPD0gMykge1xuXHRcdFx0XHRcdG5ld3J1bGUuc2V0UmVnZXgobGV4ZXJNaW4sIHJ1bGVbMF0pO1xuXHRcdFx0XHRcdGlmIChydWxlLmxlbmd0aCA+PSAzKSB7XG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIChydWxlWzFdKSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdFx0bmV3cnVsZS5zZXRBY3Rpb24obGV4ZXJNaW4sIHsgdG9rZW46IHJ1bGVbMV0sIG5leHQ6IHJ1bGVbMl0gfSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIGlmICh0eXBlb2YgKHJ1bGVbMV0pID09PSAnb2JqZWN0Jykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBydWxlMSA9IHJ1bGVbMV07XG5cdFx0XHRcdFx0XHRcdHJ1bGUxLm5leHQgPSBydWxlWzJdO1xuXHRcdFx0XHRcdFx0XHRuZXdydWxlLnNldEFjdGlvbihsZXhlck1pbiwgcnVsZTEpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRocm93IG1vbmFyY2hDb21tb24uY3JlYXRlRXJyb3IobGV4ZXIsICdhIG5leHQgc3RhdGUgYXMgdGhlIGxhc3QgZWxlbWVudCBvZiBhIHJ1bGUgY2FuIG9ubHkgYmUgZ2l2ZW4gaWYgdGhlIGFjdGlvbiBpcyBlaXRoZXIgYW4gb2JqZWN0IG9yIGEgc3RyaW5nLCBhdDogJyArIHN0YXRlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRuZXdydWxlLnNldEFjdGlvbihsZXhlck1pbiwgcnVsZVsxXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGlmICghcnVsZS5yZWdleCkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbW9uYXJjaENvbW1vbi5jcmVhdGVFcnJvcihsZXhlciwgJ2EgcnVsZSBtdXN0IGVpdGhlciBiZSBhbiBhcnJheSwgb3IgYW4gb2JqZWN0IHdpdGggYSBcXCdyZWdleFxcJyBvciBcXCdpbmNsdWRlXFwnIGZpZWxkIGF0OiAnICsgc3RhdGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAocnVsZS5uYW1lKSB7XG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIHJ1bGUubmFtZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdFx0bmV3cnVsZS5uYW1lID0gcnVsZS5uYW1lO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAocnVsZS5tYXRjaE9ubHlBdFN0YXJ0KSB7XG5cdFx0XHRcdFx0XHRuZXdydWxlLm1hdGNoT25seUF0TGluZVN0YXJ0ID0gYm9vbChydWxlLm1hdGNoT25seUF0TGluZVN0YXJ0LCBmYWxzZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG5ld3J1bGUuc2V0UmVnZXgobGV4ZXJNaW4sIHJ1bGUucmVnZXgpO1xuXHRcdFx0XHRcdG5ld3J1bGUuc2V0QWN0aW9uKGxleGVyTWluLCBydWxlLmFjdGlvbik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRuZXdydWxlcy5wdXNoKG5ld3J1bGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIGNvbXBpbGUgdGhlIHRva2VuaXplciBydWxlc1xuXHRpZiAoIWpzb24udG9rZW5pemVyIHx8IHR5cGVvZiAoanNvbi50b2tlbml6ZXIpICE9PSAnb2JqZWN0Jykge1xuXHRcdHRocm93IG1vbmFyY2hDb21tb24uY3JlYXRlRXJyb3IobGV4ZXIsICdhIGxhbmd1YWdlIGRlZmluaXRpb24gbXVzdCBkZWZpbmUgdGhlIFxcJ3Rva2VuaXplclxcJyBhdHRyaWJ1dGUgYXMgYW4gb2JqZWN0Jyk7XG5cdH1cblxuXHRsZXhlci50b2tlbml6ZXIgPSA8YW55PltdO1xuXHRmb3IgKGNvbnN0IGtleSBpbiBqc29uLnRva2VuaXplcikge1xuXHRcdGlmIChqc29uLnRva2VuaXplci5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG5cdFx0XHRpZiAoIWxleGVyLnN0YXJ0KSB7XG5cdFx0XHRcdGxleGVyLnN0YXJ0ID0ga2V5O1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBydWxlcyA9IGpzb24udG9rZW5pemVyW2tleV07XG5cdFx0XHRsZXhlci50b2tlbml6ZXJba2V5XSA9IG5ldyBBcnJheSgpO1xuXHRcdFx0YWRkUnVsZXMoJ3Rva2VuaXplci4nICsga2V5LCBsZXhlci50b2tlbml6ZXJba2V5XSwgcnVsZXMpO1xuXHRcdH1cblx0fVxuXHRsZXhlci51c2VzRW1iZWRkZWQgPSBsZXhlck1pbi51c2VzRW1iZWRkZWQ7ICAvLyBjYW4gYmUgc2V0IGR1cmluZyBjb21waWxlQWN0aW9uXG5cblx0Ly8gU2V0IHNpbXBsZSBicmFja2V0c1xuXHRpZiAoanNvbi5icmFja2V0cykge1xuXHRcdGlmICghKEFycmF5LmlzQXJyYXkoPGFueT5qc29uLmJyYWNrZXRzKSkpIHtcblx0XHRcdHRocm93IG1vbmFyY2hDb21tb24uY3JlYXRlRXJyb3IobGV4ZXIsICd0aGUgXFwnYnJhY2tldHNcXCcgYXR0cmlidXRlIG11c3QgYmUgZGVmaW5lZCBhcyBhbiBhcnJheScpO1xuXHRcdH1cblx0fVxuXHRlbHNlIHtcblx0XHRqc29uLmJyYWNrZXRzID0gW1xuXHRcdFx0eyBvcGVuOiAneycsIGNsb3NlOiAnfScsIHRva2VuOiAnZGVsaW1pdGVyLmN1cmx5JyB9LFxuXHRcdFx0eyBvcGVuOiAnWycsIGNsb3NlOiAnXScsIHRva2VuOiAnZGVsaW1pdGVyLnNxdWFyZScgfSxcblx0XHRcdHsgb3BlbjogJygnLCBjbG9zZTogJyknLCB0b2tlbjogJ2RlbGltaXRlci5wYXJlbnRoZXNpcycgfSxcblx0XHRcdHsgb3BlbjogJzwnLCBjbG9zZTogJz4nLCB0b2tlbjogJ2RlbGltaXRlci5hbmdsZScgfV07XG5cdH1cblx0Y29uc3QgYnJhY2tldHM6IElNb25hcmNoTGFuZ3VhZ2VCcmFja2V0W10gPSBbXTtcblx0Zm9yIChjb25zdCBlbCBvZiBqc29uLmJyYWNrZXRzKSB7XG5cdFx0bGV0IGRlc2M6IGFueSA9IGVsO1xuXHRcdGlmIChkZXNjICYmIEFycmF5LmlzQXJyYXkoZGVzYykgJiYgZGVzYy5sZW5ndGggPT09IDMpIHtcblx0XHRcdGRlc2MgPSB7IHRva2VuOiBkZXNjWzJdLCBvcGVuOiBkZXNjWzBdLCBjbG9zZTogZGVzY1sxXSB9O1xuXHRcdH1cblx0XHRpZiAoZGVzYy5vcGVuID09PSBkZXNjLmNsb3NlKSB7XG5cdFx0XHR0aHJvdyBtb25hcmNoQ29tbW9uLmNyZWF0ZUVycm9yKGxleGVyLCAnb3BlbiBhbmQgY2xvc2UgYnJhY2tldHMgaW4gYSBcXCdicmFja2V0c1xcJyBhdHRyaWJ1dGUgbXVzdCBiZSBkaWZmZXJlbnQ6ICcgKyBkZXNjLm9wZW4gK1xuXHRcdFx0XHQnXFxuIGhpbnQ6IHVzZSB0aGUgXFwnYnJhY2tldFxcJyBhdHRyaWJ1dGUgaWYgbWF0Y2hpbmcgb24gZXF1YWwgYnJhY2tldHMgaXMgcmVxdWlyZWQuJyk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgZGVzYy5vcGVuID09PSAnc3RyaW5nJyAmJiB0eXBlb2YgZGVzYy50b2tlbiA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIGRlc2MuY2xvc2UgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRicmFja2V0cy5wdXNoKHtcblx0XHRcdFx0dG9rZW46IGRlc2MudG9rZW4gKyBsZXhlci50b2tlblBvc3RmaXgsXG5cdFx0XHRcdG9wZW46IG1vbmFyY2hDb21tb24uZml4Q2FzZShsZXhlciwgZGVzYy5vcGVuKSxcblx0XHRcdFx0Y2xvc2U6IG1vbmFyY2hDb21tb24uZml4Q2FzZShsZXhlciwgZGVzYy5jbG9zZSlcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRocm93IG1vbmFyY2hDb21tb24uY3JlYXRlRXJyb3IobGV4ZXIsICdldmVyeSBlbGVtZW50IGluIHRoZSBcXCdicmFja2V0c1xcJyBhcnJheSBtdXN0IGJlIGEgXFwne29wZW4sY2xvc2UsdG9rZW59XFwnIG9iamVjdCBvciBhcnJheScpO1xuXHRcdH1cblx0fVxuXHRsZXhlci5icmFja2V0cyA9IGJyYWNrZXRzO1xuXG5cdC8vIERpc2FibGUgdGhyb3cgc28gdGhlIHN5bnRheCBoaWdobGlnaHRlciBnb2VzLCBubyBtYXR0ZXIgd2hhdFxuXHRsZXhlci5ub1Rocm93ID0gdHJ1ZTtcblx0cmV0dXJuIGxleGVyO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBVUEsWUFBWSxtQkFBbUI7QUFZL0IsU0FBUyxVQUFVLFVBQStCLEtBQW1CO0FBQ3BFLE1BQUksQ0FBQyxLQUFLO0FBQ1QsV0FBTztBQUFBLEVBQ1I7QUFDQSxNQUFJLENBQUUsTUFBTSxRQUFRLEdBQUcsR0FBSTtBQUMxQixXQUFPO0FBQUEsRUFDUjtBQUNBLGFBQVcsTUFBTSxLQUFLO0FBQ3JCLFFBQUksQ0FBRSxTQUFTLEVBQUUsR0FBSTtBQUNwQixhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFDQSxTQUFPO0FBQ1I7QUFFQSxTQUFTLEtBQUssTUFBVyxVQUE0QjtBQUNwRCxNQUFJLE9BQU8sU0FBUyxXQUFXO0FBQzlCLFdBQU87QUFBQSxFQUNSO0FBQ0EsU0FBTztBQUNSO0FBRUEsU0FBUyxPQUFPLE1BQVcsVUFBMEI7QUFDcEQsTUFBSSxPQUFRLFNBQVUsVUFBVTtBQUMvQixXQUFPO0FBQUEsRUFDUjtBQUNBLFNBQU87QUFDUjtBQUdBLFNBQVMsWUFBWSxPQUEyQztBQUMvRCxRQUFNLFNBQWMsQ0FBQztBQUNyQixhQUFXLEtBQUssT0FBTztBQUN0QixXQUFPLENBQUMs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
