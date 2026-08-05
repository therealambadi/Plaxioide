import { CharCode } from "../../../../base/common/charCode.js";
var TokenType = /* @__PURE__ */ ((TokenType2) => {
  TokenType2[TokenType2["Dollar"] = 0] = "Dollar";
  TokenType2[TokenType2["Colon"] = 1] = "Colon";
  TokenType2[TokenType2["Comma"] = 2] = "Comma";
  TokenType2[TokenType2["CurlyOpen"] = 3] = "CurlyOpen";
  TokenType2[TokenType2["CurlyClose"] = 4] = "CurlyClose";
  TokenType2[TokenType2["Backslash"] = 5] = "Backslash";
  TokenType2[TokenType2["Forwardslash"] = 6] = "Forwardslash";
  TokenType2[TokenType2["Pipe"] = 7] = "Pipe";
  TokenType2[TokenType2["Int"] = 8] = "Int";
  TokenType2[TokenType2["VariableName"] = 9] = "VariableName";
  TokenType2[TokenType2["Format"] = 10] = "Format";
  TokenType2[TokenType2["Plus"] = 11] = "Plus";
  TokenType2[TokenType2["Dash"] = 12] = "Dash";
  TokenType2[TokenType2["QuestionMark"] = 13] = "QuestionMark";
  TokenType2[TokenType2["EOF"] = 14] = "EOF";
  return TokenType2;
})(TokenType || {});
const _Scanner = class _Scanner {
  constructor() {
    this.value = "";
    this.pos = 0;
  }
  static isDigitCharacter(ch) {
    return ch >= CharCode.Digit0 && ch <= CharCode.Digit9;
  }
  static isVariableCharacter(ch) {
    return ch === CharCode.Underline || ch >= CharCode.a && ch <= CharCode.z || ch >= CharCode.A && ch <= CharCode.Z;
  }
  text(value) {
    this.value = value;
    this.pos = 0;
  }
  tokenText(token) {
    return this.value.substr(token.pos, token.len);
  }
  next() {
    if (this.pos >= this.value.length) {
      return { type: 14 /* EOF */, pos: this.pos, len: 0 };
    }
    const pos = this.pos;
    let len = 0;
    let ch = this.value.charCodeAt(pos);
    let type;
    type = _Scanner._table[ch];
    if (typeof type === "number") {
      this.pos += 1;
      return { type, pos, len: 1 };
    }
    if (_Scanner.isDigitCharacter(ch)) {
      type = 8 /* Int */;
      do {
        len += 1;
        ch = this.value.charCodeAt(pos + len);
      } while (_Scanner.isDigitCharacter(ch));
      this.pos += len;
      return { type, pos, len };
    }
    if (_Scanner.isVariableCharacter(ch)) {
      type = 9 /* VariableName */;
      do {
        ch = this.value.charCodeAt(pos + ++len);
      } while (_Scanner.isVariableCharacter(ch) || _Scanner.isDigitCharacter(ch));
      this.pos += len;
      return { type, pos, len };
    }
    type = 10 /* Format */;
    do {
      len += 1;
      ch = this.value.charCodeAt(pos + len);
    } while (!isNaN(ch) && typeof _Scanner._table[ch] === "undefined" && !_Scanner.isDigitCharacter(ch) && !_Scanner.isVariableCharacter(ch));
    this.pos += len;
    return { type, pos, len };
  }
};
_Scanner._table = {
  [CharCode.DollarSign]: 0 /* Dollar */,
  [CharCode.Colon]: 1 /* Colon */,
  [CharCode.Comma]: 2 /* Comma */,
  [CharCode.OpenCurlyBrace]: 3 /* CurlyOpen */,
  [CharCode.CloseCurlyBrace]: 4 /* CurlyClose */,
  [CharCode.Backslash]: 5 /* Backslash */,
  [CharCode.Slash]: 6 /* Forwardslash */,
  [CharCode.Pipe]: 7 /* Pipe */,
  [CharCode.Plus]: 11 /* Plus */,
  [CharCode.Dash]: 12 /* Dash */,
  [CharCode.QuestionMark]: 13 /* QuestionMark */
};
let Scanner = _Scanner;
class Marker {
  constructor() {
    this._children = [];
  }
  appendChild(child) {
    if (child instanceof Text && this._children[this._children.length - 1] instanceof Text) {
      this._children[this._children.length - 1].value += child.value;
    } else {
      child.parent = this;
      this._children.push(child);
    }
    return this;
  }
  replace(child, others) {
    const { parent } = child;
    const idx = parent.children.indexOf(child);
    const newChildren = parent.children.slice(0);
    newChildren.splice(idx, 1, ...others);
    parent._children = newChildren;
    (function _fixParent(children, parent2) {
      for (const child2 of children) {
        child2.parent = parent2;
        _fixParent(child2.children, child2);
      }
    })(others, parent);
  }
  get children() {
    return this._children;
  }
  get rightMostDescendant() {
    if (this._children.length > 0) {
      return this._children[this._children.length - 1].rightMostDescendant;
    }
    return this;
  }
  get snippet() {
    let candidate = this;
    while (true) {
      if (!candidate) {
        return void 0;
      }
      if (candidate instanceof TextmateSnippet) {
        return candidate;
      }
      candidate = candidate.parent;
    }
  }
  toString() {
    return this.children.reduce((prev, cur) => prev + cur.toString(), "");
  }
  len() {
    return 0;
  }
}
class Text extends Marker {
  constructor(value) {
    super();
    this.value = value;
  }
  static escape(value) {
    return value.replace(/\$|}|\\/g, "\\$&");
  }
  toString() {
    return this.value;
  }
  toTextmateString() {
    return Text.escape(this.value);
  }
  len() {
    return this.value.length;
  }
  clone() {
    return new Text(this.value);
  }
}
class TransformableMarker extends Marker {
}
class Placeholder extends TransformableMarker {
  constructor(index) {
    super();
    this.index = index;
  }
  static compareByIndex(a, b) {
    if (a.index === b.index) {
      return 0;
    } else if (a.isFinalTabstop) {
      return 1;
    } else if (b.isFinalTabstop) {
      return -1;
    } else if (a.index < b.index) {
      return -1;
    } else if (a.index > b.index) {
      return 1;
    } else {
      return 0;
    }
  }
  get isFinalTabstop() {
    return this.index === 0;
  }
  get choice() {
    return this._children.length === 1 && this._children[0] instanceof Choice ? this._children[0] : void 0;
  }
  toTextmateString() {
    let transformString = "";
    if (this.transform) {
      transformString = this.transform.toTextmateString();
    }
    if (this.children.length === 0 && !this.transform) {
      return `$${this.index}`;
    } else if (this.children.length === 0) {
      return `\${${this.index}${transformString}}`;
    } else if (this.choice) {
      return `\${${this.index}|${this.choice.toTextmateString()}|${transformString}}`;
    } else {
      return `\${${this.index}:${this.children.map((child) => child.toTextmateString()).join("")}${transformString}}`;
    }
  }
  clone() {
    const ret = new Placeholder(this.index);
    if (this.transform) {
      ret.transform = this.transform.clone();
    }
    ret._children = this.children.map((child) => child.clone());
    return ret;
  }
}
class Choice extends Marker {
  constructor() {
    super(...arguments);
    this.options = [];
  }
  appendChild(marker) {
    if (marker instanceof Text) {
      marker.parent = this;
      this.options.push(marker);
    }
    return this;
  }
  toString() {
    return this.options[0].value;
  }
  toTextmateString() {
    return this.options.map((option) => option.value.replace(/\||,|\\/g, "\\$&")).join(",");
  }
  len() {
    return this.options[0].len();
  }
  clone() {
    const ret = new Choice();
    this.options.forEach(ret.appendChild, ret);
    return ret;
  }
}
class Transform extends Marker {
  constructor() {
    super(...arguments);
    this.regexp = new RegExp("");
  }
  resolve(value) {
    const _this = this;
    let didMatch = false;
    let ret = value.replace(this.regexp, function() {
      didMatch = true;
      return _this._replace(Array.prototype.slice.call(arguments, 0, -2));
    });
    if (!didMatch && this._children.some((child) => child instanceof FormatString && Boolean(child.elseValue))) {
      ret = this._replace([]);
    }
    return ret;
  }
  _replace(groups) {
    let ret = "";
    for (const marker of this._children) {
      if (marker instanceof FormatString) {
        let value = groups[marker.index] || "";
        value = marker.resolve(value);
        ret += value;
      } else {
        ret += marker.toString();
      }
    }
    return ret;
  }
  toString() {
    return "";
  }
  toTextmateString() {
    return `/${this.regexp.source}/${this.children.map((c) => c.toTextmateString())}/${(this.regexp.ignoreCase ? "i" : "") + (this.regexp.global ? "g" : "")}`;
  }
  clone() {
    const ret = new Transform();
    ret.regexp = new RegExp(this.regexp.source, (this.regexp.ignoreCase ? "i" : "") + (this.regexp.global ? "g" : ""));
    ret._children = this.children.map((child) => child.clone());
    return ret;
  }
}
class FormatString extends Marker {
  constructor(index, shorthandName, ifValue, elseValue) {
    super();
    this.index = index;
    this.shorthandName = shorthandName;
    this.ifValue = ifValue;
    this.elseValue = elseValue;
  }
  resolve(value) {
    if (this.shorthandName === "upcase") {
      return !value ? "" : value.toLocaleUpperCase();
    } else if (this.shorthandName === "downcase") {
      return !value ? "" : value.toLocaleLowerCase();
    } else if (this.shorthandName === "capitalize") {
      return !value ? "" : value[0].toLocaleUpperCase() + value.substr(1);
    } else if (this.shorthandName === "pascalcase") {
      return !value ? "" : this._toPascalCase(value);
    } else if (this.shorthandName === "camelcase") {
      return !value ? "" : this._toCamelCase(value);
    } else if (Boolean(value) && typeof this.ifValue === "string") {
      return this.ifValue;
    } else if (!Boolean(value) && typeof this.elseValue === "string") {
      return this.elseValue;
    } else {
      return value || "";
    }
  }
  _toPascalCase(value) {
    const match = value.match(/[a-z0-9]+/gi);
    if (!match) {
      return value;
    }
    return match.map((word) => {
      return word.charAt(0).toUpperCase() + word.substr(1);
    }).join("");
  }
  _toCamelCase(value) {
    const match = value.match(/[a-z0-9]+/gi);
    if (!match) {
      return value;
    }
    return match.map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toLowerCase() + word.substr(1);
      }
      return word.charAt(0).toUpperCase() + word.substr(1);
    }).join("");
  }
  toTextmateString() {
    let value = "${";
    value += this.index;
    if (this.shorthandName) {
      value += `:/${this.shorthandName}`;
    } else if (this.ifValue && this.elseValue) {
      value += `:?${this.ifValue}:${this.elseValue}`;
    } else if (this.ifValue) {
      value += `:+${this.ifValue}`;
    } else if (this.elseValue) {
      value += `:-${this.elseValue}`;
    }
    value += "}";
    return value;
  }
  clone() {
    const ret = new FormatString(this.index, this.shorthandName, this.ifValue, this.elseValue);
    return ret;
  }
}
class Variable extends TransformableMarker {
  constructor(name) {
    super();
    this.name = name;
  }
  resolve(resolver) {
    let value = resolver.resolve(this);
    if (this.transform) {
      value = this.transform.resolve(value || "");
    }
    if (value !== void 0) {
      this._children = [new Text(value)];
      return true;
    }
    return false;
  }
  toTextmateString() {
    let transformString = "";
    if (this.transform) {
      transformString = this.transform.toTextmateString();
    }
    if (this.children.length === 0) {
      return `\${${this.name}${transformString}}`;
    } else {
      return `\${${this.name}:${this.children.map((child) => child.toTextmateString()).join("")}${transformString}}`;
    }
  }
  clone() {
    const ret = new Variable(this.name);
    if (this.transform) {
      ret.transform = this.transform.clone();
    }
    ret._children = this.children.map((child) => child.clone());
    return ret;
  }
}
function walk(marker, visitor) {
  const stack = [...marker];
  while (stack.length > 0) {
    const marker2 = stack.shift();
    const recurse = visitor(marker2);
    if (!recurse) {
      break;
    }
    stack.unshift(...marker2.children);
  }
}
class TextmateSnippet extends Marker {
  get placeholderInfo() {
    if (!this._placeholders) {
      const all = [];
      let last;
      this.walk(function(candidate) {
        if (candidate instanceof Placeholder) {
          all.push(candidate);
          last = !last || last.index < candidate.index ? candidate : last;
        }
        return true;
      });
      this._placeholders = { all, last };
    }
    return this._placeholders;
  }
  get placeholders() {
    const { all } = this.placeholderInfo;
    return all;
  }
  offset(marker) {
    let pos = 0;
    let found = false;
    this.walk((candidate) => {
      if (candidate === marker) {
        found = true;
        return false;
      }
      pos += candidate.len();
      return true;
    });
    if (!found) {
      return -1;
    }
    return pos;
  }
  fullLen(marker) {
    let ret = 0;
    walk([marker], (marker2) => {
      ret += marker2.len();
      return true;
    });
    return ret;
  }
  enclosingPlaceholders(placeholder) {
    const ret = [];
    let { parent } = placeholder;
    while (parent) {
      if (parent instanceof Placeholder) {
        ret.push(parent);
      }
      parent = parent.parent;
    }
    return ret;
  }
  resolveVariables(resolver) {
    this.walk((candidate) => {
      if (candidate instanceof Variable) {
        if (candidate.resolve(resolver)) {
          this._placeholders = void 0;
        }
      }
      return true;
    });
    return this;
  }
  appendChild(child) {
    this._placeholders = void 0;
    return super.appendChild(child);
  }
  replace(child, others) {
    this._placeholders = void 0;
    return super.replace(child, others);
  }
  toTextmateString() {
    return this.children.reduce((prev, cur) => prev + cur.toTextmateString(), "");
  }
  clone() {
    const ret = new TextmateSnippet();
    this._children = this.children.map((child) => child.clone());
    return ret;
  }
  walk(visitor) {
    walk(this.children, visitor);
  }
}
class SnippetParser {
  constructor() {
    this._scanner = new Scanner();
    this._token = { type: 14 /* EOF */, pos: 0, len: 0 };
  }
  static escape(value) {
    return value.replace(/\$|}|\\/g, "\\$&");
  }
  /**
   * Takes a snippet and returns the insertable string, e.g return the snippet-string
   * without any placeholder, tabstop, variables etc...
   */
  static asInsertText(value) {
    return new SnippetParser().parse(value).toString();
  }
  static guessNeedsClipboard(template) {
    return /\${?CLIPBOARD/.test(template);
  }
  parse(value, insertFinalTabstop, enforceFinalTabstop) {
    const snippet = new TextmateSnippet();
    this.parseFragment(value, snippet);
    this.ensureFinalTabstop(snippet, enforceFinalTabstop ?? false, insertFinalTabstop ?? false);
    return snippet;
  }
  parseFragment(value, snippet) {
    const offset = snippet.children.length;
    this._scanner.text(value);
    this._token = this._scanner.next();
    while (this._parse(snippet)) {
    }
    const placeholderDefaultValues = /* @__PURE__ */ new Map();
    const incompletePlaceholders = [];
    snippet.walk((marker) => {
      if (marker instanceof Placeholder) {
        if (marker.isFinalTabstop) {
          placeholderDefaultValues.set(0, void 0);
        } else if (!placeholderDefaultValues.has(marker.index) && marker.children.length > 0) {
          placeholderDefaultValues.set(marker.index, marker.children);
        } else {
          incompletePlaceholders.push(marker);
        }
      }
      return true;
    });
    const fillInIncompletePlaceholder = (placeholder, stack2) => {
      const defaultValues = placeholderDefaultValues.get(placeholder.index);
      if (!defaultValues) {
        return;
      }
      const clone = new Placeholder(placeholder.index);
      clone.transform = placeholder.transform;
      for (const child of defaultValues) {
        const newChild = child.clone();
        clone.appendChild(newChild);
        if (newChild instanceof Placeholder && placeholderDefaultValues.has(newChild.index) && !stack2.has(newChild.index)) {
          stack2.add(newChild.index);
          fillInIncompletePlaceholder(newChild, stack2);
          stack2.delete(newChild.index);
        }
      }
      snippet.replace(placeholder, [clone]);
    };
    const stack = /* @__PURE__ */ new Set();
    for (const placeholder of incompletePlaceholders) {
      fillInIncompletePlaceholder(placeholder, stack);
    }
    return snippet.children.slice(offset);
  }
  ensureFinalTabstop(snippet, enforceFinalTabstop, insertFinalTabstop) {
    if (enforceFinalTabstop || insertFinalTabstop && snippet.placeholders.length > 0) {
      const finalTabstop = snippet.placeholders.find((p) => p.index === 0);
      if (!finalTabstop) {
        snippet.appendChild(new Placeholder(0));
      }
    }
  }
  _accept(type, value) {
    if (type === void 0 || this._token.type === type) {
      const ret = !value ? true : this._scanner.tokenText(this._token);
      this._token = this._scanner.next();
      return ret;
    }
    return false;
  }
  _backTo(token) {
    this._scanner.pos = token.pos + token.len;
    this._token = token;
    return false;
  }
  _until(type) {
    const start = this._token;
    while (this._token.type !== type) {
      if (this._token.type === 14 /* EOF */) {
        return false;
      } else if (this._token.type === 5 /* Backslash */) {
        const nextToken = this._scanner.next();
        if (nextToken.type !== 0 /* Dollar */ && nextToken.type !== 4 /* CurlyClose */ && nextToken.type !== 5 /* Backslash */) {
          return false;
        }
      }
      this._token = this._scanner.next();
    }
    const value = this._scanner.value.substring(start.pos, this._token.pos).replace(/\\(\$|}|\\)/g, "$1");
    this._token = this._scanner.next();
    return value;
  }
  _parse(marker) {
    return this._parseEscaped(marker) || this._parseTabstopOrVariableName(marker) || this._parseComplexPlaceholder(marker) || this._parseComplexVariable(marker) || this._parseAnything(marker);
  }
  // \$, \\, \} -> just text
  _parseEscaped(marker) {
    let value;
    if (value = this._accept(5 /* Backslash */, true)) {
      value = this._accept(0 /* Dollar */, true) || this._accept(4 /* CurlyClose */, true) || this._accept(5 /* Backslash */, true) || value;
      marker.appendChild(new Text(value));
      return true;
    }
    return false;
  }
  // $foo -> variable, $1 -> tabstop
  _parseTabstopOrVariableName(parent) {
    let value;
    const token = this._token;
    const match = this._accept(0 /* Dollar */) && (value = this._accept(9 /* VariableName */, true) || this._accept(8 /* Int */, true));
    if (!match) {
      return this._backTo(token);
    }
    parent.appendChild(
      /^\d+$/.test(value) ? new Placeholder(Number(value)) : new Variable(value)
    );
    return true;
  }
  // ${1:<children>}, ${1} -> placeholder
  _parseComplexPlaceholder(parent) {
    let index;
    const token = this._token;
    const match = this._accept(0 /* Dollar */) && this._accept(3 /* CurlyOpen */) && (index = this._accept(8 /* Int */, true));
    if (!match) {
      return this._backTo(token);
    }
    const placeholder = new Placeholder(Number(index));
    if (this._accept(1 /* Colon */)) {
      while (true) {
        if (this._accept(4 /* CurlyClose */)) {
          parent.appendChild(placeholder);
          return true;
        }
        if (this._parse(placeholder)) {
          continue;
        }
        parent.appendChild(new Text("${" + index + ":"));
        placeholder.children.forEach(parent.appendChild, parent);
        return true;
      }
    } else if (placeholder.index > 0 && this._accept(7 /* Pipe */)) {
      const choice = new Choice();
      while (true) {
        if (this._parseChoiceElement(choice)) {
          if (this._accept(2 /* Comma */)) {
            continue;
          }
          if (this._accept(7 /* Pipe */)) {
            placeholder.appendChild(choice);
            if (this._accept(4 /* CurlyClose */)) {
              parent.appendChild(placeholder);
              return true;
            }
          }
        }
        this._backTo(token);
        return false;
      }
    } else if (this._accept(6 /* Forwardslash */)) {
      if (this._parseTransform(placeholder)) {
        parent.appendChild(placeholder);
        return true;
      }
      this._backTo(token);
      return false;
    } else if (this._accept(4 /* CurlyClose */)) {
      parent.appendChild(placeholder);
      return true;
    } else {
      return this._backTo(token);
    }
  }
  _parseChoiceElement(parent) {
    const token = this._token;
    const values = [];
    while (true) {
      if (this._token.type === 2 /* Comma */ || this._token.type === 7 /* Pipe */) {
        break;
      }
      let value;
      if (value = this._accept(5 /* Backslash */, true)) {
        value = this._accept(2 /* Comma */, true) || this._accept(7 /* Pipe */, true) || this._accept(5 /* Backslash */, true) || value;
      } else {
        value = this._accept(void 0, true);
      }
      if (!value) {
        this._backTo(token);
        return false;
      }
      values.push(value);
    }
    if (values.length === 0) {
      this._backTo(token);
      return false;
    }
    parent.appendChild(new Text(values.join("")));
    return true;
  }
  // ${foo:<children>}, ${foo} -> variable
  _parseComplexVariable(parent) {
    let name;
    const token = this._token;
    const match = this._accept(0 /* Dollar */) && this._accept(3 /* CurlyOpen */) && (name = this._accept(9 /* VariableName */, true));
    if (!match) {
      return this._backTo(token);
    }
    const variable = new Variable(name);
    if (this._accept(1 /* Colon */)) {
      while (true) {
        if (this._accept(4 /* CurlyClose */)) {
          parent.appendChild(variable);
          return true;
        }
        if (this._parse(variable)) {
          continue;
        }
        parent.appendChild(new Text("${" + name + ":"));
        variable.children.forEach(parent.appendChild, parent);
        return true;
      }
    } else if (this._accept(6 /* Forwardslash */)) {
      if (this._parseTransform(variable)) {
        parent.appendChild(variable);
        return true;
      }
      this._backTo(token);
      return false;
    } else if (this._accept(4 /* CurlyClose */)) {
      parent.appendChild(variable);
      return true;
    } else {
      return this._backTo(token);
    }
  }
  _parseTransform(parent) {
    const transform = new Transform();
    let regexValue = "";
    let regexOptions = "";
    while (true) {
      if (this._accept(6 /* Forwardslash */)) {
        break;
      }
      let escaped;
      if (escaped = this._accept(5 /* Backslash */, true)) {
        escaped = this._accept(6 /* Forwardslash */, true) || escaped;
        regexValue += escaped;
        continue;
      }
      if (this._token.type !== 14 /* EOF */) {
        regexValue += this._accept(void 0, true);
        continue;
      }
      return false;
    }
    while (true) {
      if (this._accept(6 /* Forwardslash */)) {
        break;
      }
      let escaped;
      if (escaped = this._accept(5 /* Backslash */, true)) {
        escaped = this._accept(5 /* Backslash */, true) || this._accept(6 /* Forwardslash */, true) || escaped;
        transform.appendChild(new Text(escaped));
        continue;
      }
      if (this._parseFormatString(transform) || this._parseAnything(transform)) {
        continue;
      }
      return false;
    }
    while (true) {
      if (this._accept(4 /* CurlyClose */)) {
        break;
      }
      if (this._token.type !== 14 /* EOF */) {
        regexOptions += this._accept(void 0, true);
        continue;
      }
      return false;
    }
    try {
      transform.regexp = new RegExp(regexValue, regexOptions);
    } catch (e) {
      return false;
    }
    parent.transform = transform;
    return true;
  }
  _parseFormatString(parent) {
    const token = this._token;
    if (!this._accept(0 /* Dollar */)) {
      return false;
    }
    let complex = false;
    if (this._accept(3 /* CurlyOpen */)) {
      complex = true;
    }
    const index = this._accept(8 /* Int */, true);
    if (!index) {
      this._backTo(token);
      return false;
    } else if (!complex) {
      parent.appendChild(new FormatString(Number(index)));
      return true;
    } else if (this._accept(4 /* CurlyClose */)) {
      parent.appendChild(new FormatString(Number(index)));
      return true;
    } else if (!this._accept(1 /* Colon */)) {
      this._backTo(token);
      return false;
    }
    if (this._accept(6 /* Forwardslash */)) {
      const shorthand = this._accept(9 /* VariableName */, true);
      if (!shorthand || !this._accept(4 /* CurlyClose */)) {
        this._backTo(token);
        return false;
      } else {
        parent.appendChild(new FormatString(Number(index), shorthand));
        return true;
      }
    } else if (this._accept(11 /* Plus */)) {
      const ifValue = this._until(4 /* CurlyClose */);
      if (ifValue) {
        parent.appendChild(new FormatString(Number(index), void 0, ifValue, void 0));
        return true;
      }
    } else if (this._accept(12 /* Dash */)) {
      const elseValue = this._until(4 /* CurlyClose */);
      if (elseValue) {
        parent.appendChild(new FormatString(Number(index), void 0, void 0, elseValue));
        return true;
      }
    } else if (this._accept(13 /* QuestionMark */)) {
      const ifValue = this._until(1 /* Colon */);
      if (ifValue) {
        const elseValue = this._until(4 /* CurlyClose */);
        if (elseValue) {
          parent.appendChild(new FormatString(Number(index), void 0, ifValue, elseValue));
          return true;
        }
      }
    } else {
      const elseValue = this._until(4 /* CurlyClose */);
      if (elseValue) {
        parent.appendChild(new FormatString(Number(index), void 0, void 0, elseValue));
        return true;
      }
    }
    this._backTo(token);
    return false;
  }
  _parseAnything(marker) {
    if (this._token.type !== 14 /* EOF */) {
      marker.appendChild(new Text(this._scanner.tokenText(this._token)));
      this._accept(void 0);
      return true;
    }
    return false;
  }
}
export {
  Choice,
  FormatString,
  Marker,
  Placeholder,
  Scanner,
  SnippetParser,
  Text,
  TextmateSnippet,
  TokenType,
  Transform,
  TransformableMarker,
  Variable
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldFBhcnNlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2hhckNvZGUuanMnO1xuXG5leHBvcnQgY29uc3QgZW51bSBUb2tlblR5cGUge1xuXHREb2xsYXIsXG5cdENvbG9uLFxuXHRDb21tYSxcblx0Q3VybHlPcGVuLFxuXHRDdXJseUNsb3NlLFxuXHRCYWNrc2xhc2gsXG5cdEZvcndhcmRzbGFzaCxcblx0UGlwZSxcblx0SW50LFxuXHRWYXJpYWJsZU5hbWUsXG5cdEZvcm1hdCxcblx0UGx1cyxcblx0RGFzaCxcblx0UXVlc3Rpb25NYXJrLFxuXHRFT0Zcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUb2tlbiB7XG5cdHR5cGU6IFRva2VuVHlwZTtcblx0cG9zOiBudW1iZXI7XG5cdGxlbjogbnVtYmVyO1xufVxuXG5cbmV4cG9ydCBjbGFzcyBTY2FubmVyIHtcblxuXHRwcml2YXRlIHN0YXRpYyBfdGFibGU6IHsgW2NoOiBudW1iZXJdOiBUb2tlblR5cGUgfSA9IHtcblx0XHRbQ2hhckNvZGUuRG9sbGFyU2lnbl06IFRva2VuVHlwZS5Eb2xsYXIsXG5cdFx0W0NoYXJDb2RlLkNvbG9uXTogVG9rZW5UeXBlLkNvbG9uLFxuXHRcdFtDaGFyQ29kZS5Db21tYV06IFRva2VuVHlwZS5Db21tYSxcblx0XHRbQ2hhckNvZGUuT3BlbkN1cmx5QnJhY2VdOiBUb2tlblR5cGUuQ3VybHlPcGVuLFxuXHRcdFtDaGFyQ29kZS5DbG9zZUN1cmx5QnJhY2VdOiBUb2tlblR5cGUuQ3VybHlDbG9zZSxcblx0XHRbQ2hhckNvZGUuQmFja3NsYXNoXTogVG9rZW5UeXBlLkJhY2tzbGFzaCxcblx0XHRbQ2hhckNvZGUuU2xhc2hdOiBUb2tlblR5cGUuRm9yd2FyZHNsYXNoLFxuXHRcdFtDaGFyQ29kZS5QaXBlXTogVG9rZW5UeXBlLlBpcGUsXG5cdFx0W0NoYXJDb2RlLlBsdXNdOiBUb2tlblR5cGUuUGx1cyxcblx0XHRbQ2hhckNvZGUuRGFzaF06IFRva2VuVHlwZS5EYXNoLFxuXHRcdFtDaGFyQ29kZS5RdWVzdGlvbk1hcmtdOiBUb2tlblR5cGUuUXVlc3Rpb25NYXJrLFxuXHR9O1xuXG5cdHN0YXRpYyBpc0RpZ2l0Q2hhcmFjdGVyKGNoOiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gY2ggPj0gQ2hhckNvZGUuRGlnaXQwICYmIGNoIDw9IENoYXJDb2RlLkRpZ2l0OTtcblx0fVxuXG5cdHN0YXRpYyBpc1ZhcmlhYmxlQ2hhcmFjdGVyKGNoOiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gY2ggPT09IENoYXJDb2RlLlVuZGVybGluZVxuXHRcdFx0fHwgKGNoID49IENoYXJDb2RlLmEgJiYgY2ggPD0gQ2hhckNvZGUueilcblx0XHRcdHx8IChjaCA+PSBDaGFyQ29kZS5BICYmIGNoIDw9IENoYXJDb2RlLlopO1xuXHR9XG5cblx0dmFsdWU6IHN0cmluZyA9ICcnO1xuXHRwb3M6IG51bWJlciA9IDA7XG5cblx0dGV4dCh2YWx1ZTogc3RyaW5nKSB7XG5cdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMucG9zID0gMDtcblx0fVxuXG5cdHRva2VuVGV4dCh0b2tlbjogVG9rZW4pOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnZhbHVlLnN1YnN0cih0b2tlbi5wb3MsIHRva2VuLmxlbik7XG5cdH1cblxuXHRuZXh0KCk6IFRva2VuIHtcblxuXHRcdGlmICh0aGlzLnBvcyA+PSB0aGlzLnZhbHVlLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHsgdHlwZTogVG9rZW5UeXBlLkVPRiwgcG9zOiB0aGlzLnBvcywgbGVuOiAwIH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgcG9zID0gdGhpcy5wb3M7XG5cdFx0bGV0IGxlbiA9IDA7XG5cdFx0bGV0IGNoID0gdGhpcy52YWx1ZS5jaGFyQ29kZUF0KHBvcyk7XG5cdFx0bGV0IHR5cGU6IFRva2VuVHlwZTtcblxuXHRcdC8vIHN0YXRpYyB0eXBlc1xuXHRcdHR5cGUgPSBTY2FubmVyLl90YWJsZVtjaF07XG5cdFx0aWYgKHR5cGVvZiB0eXBlID09PSAnbnVtYmVyJykge1xuXHRcdFx0dGhpcy5wb3MgKz0gMTtcblx0XHRcdHJldHVybiB7IHR5cGUsIHBvcywgbGVuOiAxIH07XG5cdFx0fVxuXG5cdFx0Ly8gbnVtYmVyXG5cdFx0aWYgKFNjYW5uZXIuaXNEaWdpdENoYXJhY3RlcihjaCkpIHtcblx0XHRcdHR5cGUgPSBUb2tlblR5cGUuSW50O1xuXHRcdFx0ZG8ge1xuXHRcdFx0XHRsZW4gKz0gMTtcblx0XHRcdFx0Y2ggPSB0aGlzLnZhbHVlLmNoYXJDb2RlQXQocG9zICsgbGVuKTtcblx0XHRcdH0gd2hpbGUgKFNjYW5uZXIuaXNEaWdpdENoYXJhY3RlcihjaCkpO1xuXG5cdFx0XHR0aGlzLnBvcyArPSBsZW47XG5cdFx0XHRyZXR1cm4geyB0eXBlLCBwb3MsIGxlbiB9O1xuXHRcdH1cblxuXHRcdC8vIHZhcmlhYmxlIG5hbWVcblx0XHRpZiAoU2Nhbm5lci5pc1ZhcmlhYmxlQ2hhcmFjdGVyKGNoKSkge1xuXHRcdFx0dHlwZSA9IFRva2VuVHlwZS5WYXJpYWJsZU5hbWU7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdGNoID0gdGhpcy52YWx1ZS5jaGFyQ29kZUF0KHBvcyArICgrK2xlbikpO1xuXHRcdFx0fSB3aGlsZSAoU2Nhbm5lci5pc1ZhcmlhYmxlQ2hhcmFjdGVyKGNoKSB8fCBTY2FubmVyLmlzRGlnaXRDaGFyYWN0ZXIoY2gpKTtcblxuXHRcdFx0dGhpcy5wb3MgKz0gbGVuO1xuXHRcdFx0cmV0dXJuIHsgdHlwZSwgcG9zLCBsZW4gfTtcblx0XHR9XG5cblxuXHRcdC8vIGZvcm1hdFxuXHRcdHR5cGUgPSBUb2tlblR5cGUuRm9ybWF0O1xuXHRcdGRvIHtcblx0XHRcdGxlbiArPSAxO1xuXHRcdFx0Y2ggPSB0aGlzLnZhbHVlLmNoYXJDb2RlQXQocG9zICsgbGVuKTtcblx0XHR9IHdoaWxlIChcblx0XHRcdCFpc05hTihjaClcblx0XHRcdCYmIHR5cGVvZiBTY2FubmVyLl90YWJsZVtjaF0gPT09ICd1bmRlZmluZWQnIC8vIG5vdCBzdGF0aWMgdG9rZW5cblx0XHRcdCYmICFTY2FubmVyLmlzRGlnaXRDaGFyYWN0ZXIoY2gpIC8vIG5vdCBudW1iZXJcblx0XHRcdCYmICFTY2FubmVyLmlzVmFyaWFibGVDaGFyYWN0ZXIoY2gpIC8vIG5vdCB2YXJpYWJsZVxuXHRcdCk7XG5cblx0XHR0aGlzLnBvcyArPSBsZW47XG5cdFx0cmV0dXJuIHsgdHlwZSwgcG9zLCBsZW4gfTtcblx0fVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgTWFya2VyIHtcblxuXHRyZWFkb25seSBfbWFya2VyQnJhbmQ6IGFueTtcblxuXHRwdWJsaWMgcGFyZW50ITogTWFya2VyO1xuXHRwcm90ZWN0ZWQgX2NoaWxkcmVuOiBNYXJrZXJbXSA9IFtdO1xuXG5cdGFwcGVuZENoaWxkKGNoaWxkOiBNYXJrZXIpOiB0aGlzIHtcblx0XHRpZiAoY2hpbGQgaW5zdGFuY2VvZiBUZXh0ICYmIHRoaXMuX2NoaWxkcmVuW3RoaXMuX2NoaWxkcmVuLmxlbmd0aCAtIDFdIGluc3RhbmNlb2YgVGV4dCkge1xuXHRcdFx0Ly8gdGhpcyBhbmQgcHJldmlvdXMgY2hpbGQgYXJlIHRleHQgLT4gbWVyZ2UgdGhlbVxuXHRcdFx0KDxUZXh0PnRoaXMuX2NoaWxkcmVuW3RoaXMuX2NoaWxkcmVuLmxlbmd0aCAtIDFdKS52YWx1ZSArPSBjaGlsZC52YWx1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gbm9ybWFsIGFkb3B0aW9uIG9mIGNoaWxkXG5cdFx0XHRjaGlsZC5wYXJlbnQgPSB0aGlzO1xuXHRcdFx0dGhpcy5fY2hpbGRyZW4ucHVzaChjaGlsZCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cmVwbGFjZShjaGlsZDogTWFya2VyLCBvdGhlcnM6IE1hcmtlcltdKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBwYXJlbnQgfSA9IGNoaWxkO1xuXHRcdGNvbnN0IGlkeCA9IHBhcmVudC5jaGlsZHJlbi5pbmRleE9mKGNoaWxkKTtcblx0XHRjb25zdCBuZXdDaGlsZHJlbiA9IHBhcmVudC5jaGlsZHJlbi5zbGljZSgwKTtcblx0XHRuZXdDaGlsZHJlbi5zcGxpY2UoaWR4LCAxLCAuLi5vdGhlcnMpO1xuXHRcdHBhcmVudC5fY2hpbGRyZW4gPSBuZXdDaGlsZHJlbjtcblxuXHRcdChmdW5jdGlvbiBfZml4UGFyZW50KGNoaWxkcmVuOiBNYXJrZXJbXSwgcGFyZW50OiBNYXJrZXIpIHtcblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcblx0XHRcdFx0Y2hpbGQucGFyZW50ID0gcGFyZW50O1xuXHRcdFx0XHRfZml4UGFyZW50KGNoaWxkLmNoaWxkcmVuLCBjaGlsZCk7XG5cdFx0XHR9XG5cdFx0fSkob3RoZXJzLCBwYXJlbnQpO1xuXHR9XG5cblx0Z2V0IGNoaWxkcmVuKCk6IE1hcmtlcltdIHtcblx0XHRyZXR1cm4gdGhpcy5fY2hpbGRyZW47XG5cdH1cblxuXHRnZXQgcmlnaHRNb3N0RGVzY2VuZGFudCgpOiBNYXJrZXIge1xuXHRcdGlmICh0aGlzLl9jaGlsZHJlbi5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY2hpbGRyZW5bdGhpcy5fY2hpbGRyZW4ubGVuZ3RoIC0gMV0ucmlnaHRNb3N0RGVzY2VuZGFudDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRnZXQgc25pcHBldCgpOiBUZXh0bWF0ZVNuaXBwZXQgfCB1bmRlZmluZWQge1xuXHRcdGxldCBjYW5kaWRhdGU6IE1hcmtlciA9IHRoaXM7XG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdGlmICghY2FuZGlkYXRlKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoY2FuZGlkYXRlIGluc3RhbmNlb2YgVGV4dG1hdGVTbmlwcGV0KSB7XG5cdFx0XHRcdHJldHVybiBjYW5kaWRhdGU7XG5cdFx0XHR9XG5cdFx0XHRjYW5kaWRhdGUgPSBjYW5kaWRhdGUucGFyZW50O1xuXHRcdH1cblx0fVxuXG5cdHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuY2hpbGRyZW4ucmVkdWNlKChwcmV2LCBjdXIpID0+IHByZXYgKyBjdXIudG9TdHJpbmcoKSwgJycpO1xuXHR9XG5cblx0YWJzdHJhY3QgdG9UZXh0bWF0ZVN0cmluZygpOiBzdHJpbmc7XG5cblx0bGVuKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRhYnN0cmFjdCBjbG9uZSgpOiBNYXJrZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBUZXh0IGV4dGVuZHMgTWFya2VyIHtcblxuXHRzdGF0aWMgZXNjYXBlKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiB2YWx1ZS5yZXBsYWNlKC9cXCR8fXxcXFxcL2csICdcXFxcJCYnKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogc3RyaW5nKSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXHRvdmVycmlkZSB0b1N0cmluZygpIHtcblx0XHRyZXR1cm4gdGhpcy52YWx1ZTtcblx0fVxuXHR0b1RleHRtYXRlU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFRleHQuZXNjYXBlKHRoaXMudmFsdWUpO1xuXHR9XG5cdG92ZXJyaWRlIGxlbigpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnZhbHVlLmxlbmd0aDtcblx0fVxuXHRjbG9uZSgpOiBUZXh0IHtcblx0XHRyZXR1cm4gbmV3IFRleHQodGhpcy52YWx1ZSk7XG5cdH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFRyYW5zZm9ybWFibGVNYXJrZXIgZXh0ZW5kcyBNYXJrZXIge1xuXHRwdWJsaWMgdHJhbnNmb3JtPzogVHJhbnNmb3JtO1xufVxuXG5leHBvcnQgY2xhc3MgUGxhY2Vob2xkZXIgZXh0ZW5kcyBUcmFuc2Zvcm1hYmxlTWFya2VyIHtcblx0c3RhdGljIGNvbXBhcmVCeUluZGV4KGE6IFBsYWNlaG9sZGVyLCBiOiBQbGFjZWhvbGRlcik6IG51bWJlciB7XG5cdFx0aWYgKGEuaW5kZXggPT09IGIuaW5kZXgpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH0gZWxzZSBpZiAoYS5pc0ZpbmFsVGFic3RvcCkge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fSBlbHNlIGlmIChiLmlzRmluYWxUYWJzdG9wKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fSBlbHNlIGlmIChhLmluZGV4IDwgYi5pbmRleCkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH0gZWxzZSBpZiAoYS5pbmRleCA+IGIuaW5kZXgpIHtcblx0XHRcdHJldHVybiAxO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdH1cblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgaW5kZXg6IG51bWJlcikge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRnZXQgaXNGaW5hbFRhYnN0b3AoKSB7XG5cdFx0cmV0dXJuIHRoaXMuaW5kZXggPT09IDA7XG5cdH1cblxuXHRnZXQgY2hvaWNlKCk6IENob2ljZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2NoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiB0aGlzLl9jaGlsZHJlblswXSBpbnN0YW5jZW9mIENob2ljZVxuXHRcdFx0PyB0aGlzLl9jaGlsZHJlblswXSBhcyBDaG9pY2Vcblx0XHRcdDogdW5kZWZpbmVkO1xuXHR9XG5cblx0dG9UZXh0bWF0ZVN0cmluZygpOiBzdHJpbmcge1xuXHRcdGxldCB0cmFuc2Zvcm1TdHJpbmcgPSAnJztcblx0XHRpZiAodGhpcy50cmFuc2Zvcm0pIHtcblx0XHRcdHRyYW5zZm9ybVN0cmluZyA9IHRoaXMudHJhbnNmb3JtLnRvVGV4dG1hdGVTdHJpbmcoKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuY2hpbGRyZW4ubGVuZ3RoID09PSAwICYmICF0aGlzLnRyYW5zZm9ybSkge1xuXHRcdFx0cmV0dXJuIGBcXCQke3RoaXMuaW5kZXh9YDtcblx0XHR9IGVsc2UgaWYgKHRoaXMuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gYFxcJHske3RoaXMuaW5kZXh9JHt0cmFuc2Zvcm1TdHJpbmd9fWA7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmNob2ljZSkge1xuXHRcdFx0cmV0dXJuIGBcXCR7JHt0aGlzLmluZGV4fXwke3RoaXMuY2hvaWNlLnRvVGV4dG1hdGVTdHJpbmcoKX18JHt0cmFuc2Zvcm1TdHJpbmd9fWA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBgXFwkeyR7dGhpcy5pbmRleH06JHt0aGlzLmNoaWxkcmVuLm1hcChjaGlsZCA9PiBjaGlsZC50b1RleHRtYXRlU3RyaW5nKCkpLmpvaW4oJycpfSR7dHJhbnNmb3JtU3RyaW5nfX1gO1xuXHRcdH1cblx0fVxuXG5cdGNsb25lKCk6IFBsYWNlaG9sZGVyIHtcblx0XHRjb25zdCByZXQgPSBuZXcgUGxhY2Vob2xkZXIodGhpcy5pbmRleCk7XG5cdFx0aWYgKHRoaXMudHJhbnNmb3JtKSB7XG5cdFx0XHRyZXQudHJhbnNmb3JtID0gdGhpcy50cmFuc2Zvcm0uY2xvbmUoKTtcblx0XHR9XG5cdFx0cmV0Ll9jaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW4ubWFwKGNoaWxkID0+IGNoaWxkLmNsb25lKCkpO1xuXHRcdHJldHVybiByZXQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENob2ljZSBleHRlbmRzIE1hcmtlciB7XG5cblx0cmVhZG9ubHkgb3B0aW9uczogVGV4dFtdID0gW107XG5cblx0b3ZlcnJpZGUgYXBwZW5kQ2hpbGQobWFya2VyOiBNYXJrZXIpOiB0aGlzIHtcblx0XHRpZiAobWFya2VyIGluc3RhbmNlb2YgVGV4dCkge1xuXHRcdFx0bWFya2VyLnBhcmVudCA9IHRoaXM7XG5cdFx0XHR0aGlzLm9wdGlvbnMucHVzaChtYXJrZXIpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdG92ZXJyaWRlIHRvU3RyaW5nKCkge1xuXHRcdHJldHVybiB0aGlzLm9wdGlvbnNbMF0udmFsdWU7XG5cdH1cblxuXHR0b1RleHRtYXRlU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMub3B0aW9uc1xuXHRcdFx0Lm1hcChvcHRpb24gPT4gb3B0aW9uLnZhbHVlLnJlcGxhY2UoL1xcfHwsfFxcXFwvZywgJ1xcXFwkJicpKVxuXHRcdFx0LmpvaW4oJywnKTtcblx0fVxuXG5cdG92ZXJyaWRlIGxlbigpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLm9wdGlvbnNbMF0ubGVuKCk7XG5cdH1cblxuXHRjbG9uZSgpOiBDaG9pY2Uge1xuXHRcdGNvbnN0IHJldCA9IG5ldyBDaG9pY2UoKTtcblx0XHR0aGlzLm9wdGlvbnMuZm9yRWFjaChyZXQuYXBwZW5kQ2hpbGQsIHJldCk7XG5cdFx0cmV0dXJuIHJldDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVHJhbnNmb3JtIGV4dGVuZHMgTWFya2VyIHtcblxuXHRyZWdleHA6IFJlZ0V4cCA9IG5ldyBSZWdFeHAoJycpO1xuXG5cdHJlc29sdmUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgX3RoaXMgPSB0aGlzO1xuXHRcdGxldCBkaWRNYXRjaCA9IGZhbHNlO1xuXHRcdGxldCByZXQgPSB2YWx1ZS5yZXBsYWNlKHRoaXMucmVnZXhwLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRkaWRNYXRjaCA9IHRydWU7XG5cdFx0XHRyZXR1cm4gX3RoaXMuX3JlcGxhY2UoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwLCAtMikpO1xuXHRcdH0pO1xuXHRcdC8vIHdoZW4gdGhlIHJlZ2V4IGRpZG4ndCBtYXRjaCBhbmQgd2hlbiB0aGUgdHJhbnNmb3JtIGhhc1xuXHRcdC8vIGVsc2UgYnJhbmNoZXMsIHRoZW4gcnVuIHRob3NlXG5cdFx0aWYgKCFkaWRNYXRjaCAmJiB0aGlzLl9jaGlsZHJlbi5zb21lKGNoaWxkID0+IGNoaWxkIGluc3RhbmNlb2YgRm9ybWF0U3RyaW5nICYmIEJvb2xlYW4oY2hpbGQuZWxzZVZhbHVlKSkpIHtcblx0XHRcdHJldCA9IHRoaXMuX3JlcGxhY2UoW10pO1xuXHRcdH1cblx0XHRyZXR1cm4gcmV0O1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVwbGFjZShncm91cHM6IHN0cmluZ1tdKTogc3RyaW5nIHtcblx0XHRsZXQgcmV0ID0gJyc7XG5cdFx0Zm9yIChjb25zdCBtYXJrZXIgb2YgdGhpcy5fY2hpbGRyZW4pIHtcblx0XHRcdGlmIChtYXJrZXIgaW5zdGFuY2VvZiBGb3JtYXRTdHJpbmcpIHtcblx0XHRcdFx0bGV0IHZhbHVlID0gZ3JvdXBzW21hcmtlci5pbmRleF0gfHwgJyc7XG5cdFx0XHRcdHZhbHVlID0gbWFya2VyLnJlc29sdmUodmFsdWUpO1xuXHRcdFx0XHRyZXQgKz0gdmFsdWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXQgKz0gbWFya2VyLnRvU3RyaW5nKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHRvdmVycmlkZSB0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdHRvVGV4dG1hdGVTdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYC8ke3RoaXMucmVnZXhwLnNvdXJjZX0vJHt0aGlzLmNoaWxkcmVuLm1hcChjID0+IGMudG9UZXh0bWF0ZVN0cmluZygpKX0vJHsodGhpcy5yZWdleHAuaWdub3JlQ2FzZSA/ICdpJyA6ICcnKSArICh0aGlzLnJlZ2V4cC5nbG9iYWwgPyAnZycgOiAnJyl9YDtcblx0fVxuXG5cdGNsb25lKCk6IFRyYW5zZm9ybSB7XG5cdFx0Y29uc3QgcmV0ID0gbmV3IFRyYW5zZm9ybSgpO1xuXHRcdHJldC5yZWdleHAgPSBuZXcgUmVnRXhwKHRoaXMucmVnZXhwLnNvdXJjZSwgJycgKyAodGhpcy5yZWdleHAuaWdub3JlQ2FzZSA/ICdpJyA6ICcnKSArICh0aGlzLnJlZ2V4cC5nbG9iYWwgPyAnZycgOiAnJykpO1xuXHRcdHJldC5fY2hpbGRyZW4gPSB0aGlzLmNoaWxkcmVuLm1hcChjaGlsZCA9PiBjaGlsZC5jbG9uZSgpKTtcblx0XHRyZXR1cm4gcmV0O1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIEZvcm1hdFN0cmluZyBleHRlbmRzIE1hcmtlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgaW5kZXg6IG51bWJlcixcblx0XHRyZWFkb25seSBzaG9ydGhhbmROYW1lPzogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IGlmVmFsdWU/OiBzdHJpbmcsXG5cdFx0cmVhZG9ubHkgZWxzZVZhbHVlPzogc3RyaW5nLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cmVzb2x2ZSh2YWx1ZT86IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMuc2hvcnRoYW5kTmFtZSA9PT0gJ3VwY2FzZScpIHtcblx0XHRcdHJldHVybiAhdmFsdWUgPyAnJyA6IHZhbHVlLnRvTG9jYWxlVXBwZXJDYXNlKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLnNob3J0aGFuZE5hbWUgPT09ICdkb3duY2FzZScpIHtcblx0XHRcdHJldHVybiAhdmFsdWUgPyAnJyA6IHZhbHVlLnRvTG9jYWxlTG93ZXJDYXNlKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLnNob3J0aGFuZE5hbWUgPT09ICdjYXBpdGFsaXplJykge1xuXHRcdFx0cmV0dXJuICF2YWx1ZSA/ICcnIDogKHZhbHVlWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyB2YWx1ZS5zdWJzdHIoMSkpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5zaG9ydGhhbmROYW1lID09PSAncGFzY2FsY2FzZScpIHtcblx0XHRcdHJldHVybiAhdmFsdWUgPyAnJyA6IHRoaXMuX3RvUGFzY2FsQ2FzZSh2YWx1ZSk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLnNob3J0aGFuZE5hbWUgPT09ICdjYW1lbGNhc2UnKSB7XG5cdFx0XHRyZXR1cm4gIXZhbHVlID8gJycgOiB0aGlzLl90b0NhbWVsQ2FzZSh2YWx1ZSk7XG5cdFx0fSBlbHNlIGlmIChCb29sZWFuKHZhbHVlKSAmJiB0eXBlb2YgdGhpcy5pZlZhbHVlID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuaWZWYWx1ZTtcblx0XHR9IGVsc2UgaWYgKCFCb29sZWFuKHZhbHVlKSAmJiB0eXBlb2YgdGhpcy5lbHNlVmFsdWUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5lbHNlVmFsdWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB2YWx1ZSB8fCAnJztcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF90b1Bhc2NhbENhc2UodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgbWF0Y2ggPSB2YWx1ZS5tYXRjaCgvW2EtejAtOV0rL2dpKTtcblx0XHRpZiAoIW1hdGNoKSB7XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fVxuXHRcdHJldHVybiBtYXRjaC5tYXAod29yZCA9PiB7XG5cdFx0XHRyZXR1cm4gd29yZC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHdvcmQuc3Vic3RyKDEpO1xuXHRcdH0pXG5cdFx0XHQuam9pbignJyk7XG5cdH1cblxuXHRwcml2YXRlIF90b0NhbWVsQ2FzZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRjb25zdCBtYXRjaCA9IHZhbHVlLm1hdGNoKC9bYS16MC05XSsvZ2kpO1xuXHRcdGlmICghbWF0Y2gpIHtcblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIG1hdGNoLm1hcCgod29yZCwgaW5kZXgpID0+IHtcblx0XHRcdGlmIChpbmRleCA9PT0gMCkge1xuXHRcdFx0XHRyZXR1cm4gd29yZC5jaGFyQXQoMCkudG9Mb3dlckNhc2UoKSArIHdvcmQuc3Vic3RyKDEpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHdvcmQuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB3b3JkLnN1YnN0cigxKTtcblx0XHR9KVxuXHRcdFx0LmpvaW4oJycpO1xuXHR9XG5cblx0dG9UZXh0bWF0ZVN0cmluZygpOiBzdHJpbmcge1xuXHRcdGxldCB2YWx1ZSA9ICckeyc7XG5cdFx0dmFsdWUgKz0gdGhpcy5pbmRleDtcblx0XHRpZiAodGhpcy5zaG9ydGhhbmROYW1lKSB7XG5cdFx0XHR2YWx1ZSArPSBgOi8ke3RoaXMuc2hvcnRoYW5kTmFtZX1gO1xuXG5cdFx0fSBlbHNlIGlmICh0aGlzLmlmVmFsdWUgJiYgdGhpcy5lbHNlVmFsdWUpIHtcblx0XHRcdHZhbHVlICs9IGA6PyR7dGhpcy5pZlZhbHVlfToke3RoaXMuZWxzZVZhbHVlfWA7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmlmVmFsdWUpIHtcblx0XHRcdHZhbHVlICs9IGA6KyR7dGhpcy5pZlZhbHVlfWA7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmVsc2VWYWx1ZSkge1xuXHRcdFx0dmFsdWUgKz0gYDotJHt0aGlzLmVsc2VWYWx1ZX1gO1xuXHRcdH1cblx0XHR2YWx1ZSArPSAnfSc7XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cblx0Y2xvbmUoKTogRm9ybWF0U3RyaW5nIHtcblx0XHRjb25zdCByZXQgPSBuZXcgRm9ybWF0U3RyaW5nKHRoaXMuaW5kZXgsIHRoaXMuc2hvcnRoYW5kTmFtZSwgdGhpcy5pZlZhbHVlLCB0aGlzLmVsc2VWYWx1ZSk7XG5cdFx0cmV0dXJuIHJldDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVmFyaWFibGUgZXh0ZW5kcyBUcmFuc2Zvcm1hYmxlTWFya2VyIHtcblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgbmFtZTogc3RyaW5nKSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHJlc29sdmUocmVzb2x2ZXI6IFZhcmlhYmxlUmVzb2x2ZXIpOiBib29sZWFuIHtcblx0XHRsZXQgdmFsdWUgPSByZXNvbHZlci5yZXNvbHZlKHRoaXMpO1xuXHRcdGlmICh0aGlzLnRyYW5zZm9ybSkge1xuXHRcdFx0dmFsdWUgPSB0aGlzLnRyYW5zZm9ybS5yZXNvbHZlKHZhbHVlIHx8ICcnKTtcblx0XHR9XG5cdFx0aWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX2NoaWxkcmVuID0gW25ldyBUZXh0KHZhbHVlKV07XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0dG9UZXh0bWF0ZVN0cmluZygpOiBzdHJpbmcge1xuXHRcdGxldCB0cmFuc2Zvcm1TdHJpbmcgPSAnJztcblx0XHRpZiAodGhpcy50cmFuc2Zvcm0pIHtcblx0XHRcdHRyYW5zZm9ybVN0cmluZyA9IHRoaXMudHJhbnNmb3JtLnRvVGV4dG1hdGVTdHJpbmcoKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gYFxcJHske3RoaXMubmFtZX0ke3RyYW5zZm9ybVN0cmluZ319YDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGBcXCR7JHt0aGlzLm5hbWV9OiR7dGhpcy5jaGlsZHJlbi5tYXAoY2hpbGQgPT4gY2hpbGQudG9UZXh0bWF0ZVN0cmluZygpKS5qb2luKCcnKX0ke3RyYW5zZm9ybVN0cmluZ319YDtcblx0XHR9XG5cdH1cblxuXHRjbG9uZSgpOiBWYXJpYWJsZSB7XG5cdFx0Y29uc3QgcmV0ID0gbmV3IFZhcmlhYmxlKHRoaXMubmFtZSk7XG5cdFx0aWYgKHRoaXMudHJhbnNmb3JtKSB7XG5cdFx0XHRyZXQudHJhbnNmb3JtID0gdGhpcy50cmFuc2Zvcm0uY2xvbmUoKTtcblx0XHR9XG5cdFx0cmV0Ll9jaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW4ubWFwKGNoaWxkID0+IGNoaWxkLmNsb25lKCkpO1xuXHRcdHJldHVybiByZXQ7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBWYXJpYWJsZVJlc29sdmVyIHtcblx0cmVzb2x2ZSh2YXJpYWJsZTogVmFyaWFibGUpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIHdhbGsobWFya2VyOiBNYXJrZXJbXSwgdmlzaXRvcjogKG1hcmtlcjogTWFya2VyKSA9PiBib29sZWFuKTogdm9pZCB7XG5cdGNvbnN0IHN0YWNrID0gWy4uLm1hcmtlcl07XG5cdHdoaWxlIChzdGFjay5sZW5ndGggPiAwKSB7XG5cdFx0Y29uc3QgbWFya2VyID0gc3RhY2suc2hpZnQoKSE7XG5cdFx0Y29uc3QgcmVjdXJzZSA9IHZpc2l0b3IobWFya2VyKTtcblx0XHRpZiAoIXJlY3Vyc2UpIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRzdGFjay51bnNoaWZ0KC4uLm1hcmtlci5jaGlsZHJlbik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRleHRtYXRlU25pcHBldCBleHRlbmRzIE1hcmtlciB7XG5cblx0cHJpdmF0ZSBfcGxhY2Vob2xkZXJzPzogeyBhbGw6IFBsYWNlaG9sZGVyW107IGxhc3Q/OiBQbGFjZWhvbGRlciB9O1xuXG5cdGdldCBwbGFjZWhvbGRlckluZm8oKSB7XG5cdFx0aWYgKCF0aGlzLl9wbGFjZWhvbGRlcnMpIHtcblx0XHRcdC8vIGZpbGwgaW4gcGxhY2Vob2xkZXJzXG5cdFx0XHRjb25zdCBhbGw6IFBsYWNlaG9sZGVyW10gPSBbXTtcblx0XHRcdGxldCBsYXN0OiBQbGFjZWhvbGRlciB8IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMud2FsayhmdW5jdGlvbiAoY2FuZGlkYXRlKSB7XG5cdFx0XHRcdGlmIChjYW5kaWRhdGUgaW5zdGFuY2VvZiBQbGFjZWhvbGRlcikge1xuXHRcdFx0XHRcdGFsbC5wdXNoKGNhbmRpZGF0ZSk7XG5cdFx0XHRcdFx0bGFzdCA9ICFsYXN0IHx8IGxhc3QuaW5kZXggPCBjYW5kaWRhdGUuaW5kZXggPyBjYW5kaWRhdGUgOiBsYXN0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLl9wbGFjZWhvbGRlcnMgPSB7IGFsbCwgbGFzdCB9O1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcGxhY2Vob2xkZXJzO1xuXHR9XG5cblx0Z2V0IHBsYWNlaG9sZGVycygpOiBQbGFjZWhvbGRlcltdIHtcblx0XHRjb25zdCB7IGFsbCB9ID0gdGhpcy5wbGFjZWhvbGRlckluZm87XG5cdFx0cmV0dXJuIGFsbDtcblx0fVxuXG5cdG9mZnNldChtYXJrZXI6IE1hcmtlcik6IG51bWJlciB7XG5cdFx0bGV0IHBvcyA9IDA7XG5cdFx0bGV0IGZvdW5kID0gZmFsc2U7XG5cdFx0dGhpcy53YWxrKGNhbmRpZGF0ZSA9PiB7XG5cdFx0XHRpZiAoY2FuZGlkYXRlID09PSBtYXJrZXIpIHtcblx0XHRcdFx0Zm91bmQgPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRwb3MgKz0gY2FuZGlkYXRlLmxlbigpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cblx0XHRpZiAoIWZvdW5kKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHRcdHJldHVybiBwb3M7XG5cdH1cblxuXHRmdWxsTGVuKG1hcmtlcjogTWFya2VyKTogbnVtYmVyIHtcblx0XHRsZXQgcmV0ID0gMDtcblx0XHR3YWxrKFttYXJrZXJdLCBtYXJrZXIgPT4ge1xuXHRcdFx0cmV0ICs9IG1hcmtlci5sZW4oKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0pO1xuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHRlbmNsb3NpbmdQbGFjZWhvbGRlcnMocGxhY2Vob2xkZXI6IFBsYWNlaG9sZGVyKTogUGxhY2Vob2xkZXJbXSB7XG5cdFx0Y29uc3QgcmV0OiBQbGFjZWhvbGRlcltdID0gW107XG5cdFx0bGV0IHsgcGFyZW50IH0gPSBwbGFjZWhvbGRlcjtcblx0XHR3aGlsZSAocGFyZW50KSB7XG5cdFx0XHRpZiAocGFyZW50IGluc3RhbmNlb2YgUGxhY2Vob2xkZXIpIHtcblx0XHRcdFx0cmV0LnB1c2gocGFyZW50KTtcblx0XHRcdH1cblx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG5cdFx0fVxuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHRyZXNvbHZlVmFyaWFibGVzKHJlc29sdmVyOiBWYXJpYWJsZVJlc29sdmVyKTogdGhpcyB7XG5cdFx0dGhpcy53YWxrKGNhbmRpZGF0ZSA9PiB7XG5cdFx0XHRpZiAoY2FuZGlkYXRlIGluc3RhbmNlb2YgVmFyaWFibGUpIHtcblx0XHRcdFx0aWYgKGNhbmRpZGF0ZS5yZXNvbHZlKHJlc29sdmVyKSkge1xuXHRcdFx0XHRcdHRoaXMuX3BsYWNlaG9sZGVycyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRvdmVycmlkZSBhcHBlbmRDaGlsZChjaGlsZDogTWFya2VyKSB7XG5cdFx0dGhpcy5fcGxhY2Vob2xkZXJzID0gdW5kZWZpbmVkO1xuXHRcdHJldHVybiBzdXBlci5hcHBlbmRDaGlsZChjaGlsZCk7XG5cdH1cblxuXHRvdmVycmlkZSByZXBsYWNlKGNoaWxkOiBNYXJrZXIsIG90aGVyczogTWFya2VyW10pOiB2b2lkIHtcblx0XHR0aGlzLl9wbGFjZWhvbGRlcnMgPSB1bmRlZmluZWQ7XG5cdFx0cmV0dXJuIHN1cGVyLnJlcGxhY2UoY2hpbGQsIG90aGVycyk7XG5cdH1cblxuXHR0b1RleHRtYXRlU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuY2hpbGRyZW4ucmVkdWNlKChwcmV2LCBjdXIpID0+IHByZXYgKyBjdXIudG9UZXh0bWF0ZVN0cmluZygpLCAnJyk7XG5cdH1cblxuXHRjbG9uZSgpOiBUZXh0bWF0ZVNuaXBwZXQge1xuXHRcdGNvbnN0IHJldCA9IG5ldyBUZXh0bWF0ZVNuaXBwZXQoKTtcblx0XHR0aGlzLl9jaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW4ubWFwKGNoaWxkID0+IGNoaWxkLmNsb25lKCkpO1xuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHR3YWxrKHZpc2l0b3I6IChtYXJrZXI6IE1hcmtlcikgPT4gYm9vbGVhbik6IHZvaWQge1xuXHRcdHdhbGsodGhpcy5jaGlsZHJlbiwgdmlzaXRvcik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNuaXBwZXRQYXJzZXIge1xuXG5cdHN0YXRpYyBlc2NhcGUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHZhbHVlLnJlcGxhY2UoL1xcJHx9fFxcXFwvZywgJ1xcXFwkJicpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRha2VzIGEgc25pcHBldCBhbmQgcmV0dXJucyB0aGUgaW5zZXJ0YWJsZSBzdHJpbmcsIGUuZyByZXR1cm4gdGhlIHNuaXBwZXQtc3RyaW5nXG5cdCAqIHdpdGhvdXQgYW55IHBsYWNlaG9sZGVyLCB0YWJzdG9wLCB2YXJpYWJsZXMgZXRjLi4uXG5cdCAqL1xuXHRzdGF0aWMgYXNJbnNlcnRUZXh0KHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKHZhbHVlKS50b1N0cmluZygpO1xuXHR9XG5cblx0c3RhdGljIGd1ZXNzTmVlZHNDbGlwYm9hcmQodGVtcGxhdGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAvXFwkez9DTElQQk9BUkQvLnRlc3QodGVtcGxhdGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2Nhbm5lcjogU2Nhbm5lciA9IG5ldyBTY2FubmVyKCk7XG5cdHByaXZhdGUgX3Rva2VuOiBUb2tlbiA9IHsgdHlwZTogVG9rZW5UeXBlLkVPRiwgcG9zOiAwLCBsZW46IDAgfTtcblxuXHRwYXJzZSh2YWx1ZTogc3RyaW5nLCBpbnNlcnRGaW5hbFRhYnN0b3A/OiBib29sZWFuLCBlbmZvcmNlRmluYWxUYWJzdG9wPzogYm9vbGVhbik6IFRleHRtYXRlU25pcHBldCB7XG5cdFx0Y29uc3Qgc25pcHBldCA9IG5ldyBUZXh0bWF0ZVNuaXBwZXQoKTtcblx0XHR0aGlzLnBhcnNlRnJhZ21lbnQodmFsdWUsIHNuaXBwZXQpO1xuXHRcdHRoaXMuZW5zdXJlRmluYWxUYWJzdG9wKHNuaXBwZXQsIGVuZm9yY2VGaW5hbFRhYnN0b3AgPz8gZmFsc2UsIGluc2VydEZpbmFsVGFic3RvcCA/PyBmYWxzZSk7XG5cdFx0cmV0dXJuIHNuaXBwZXQ7XG5cdH1cblxuXHRwYXJzZUZyYWdtZW50KHZhbHVlOiBzdHJpbmcsIHNuaXBwZXQ6IFRleHRtYXRlU25pcHBldCk6IHJlYWRvbmx5IE1hcmtlcltdIHtcblxuXHRcdGNvbnN0IG9mZnNldCA9IHNuaXBwZXQuY2hpbGRyZW4ubGVuZ3RoO1xuXHRcdHRoaXMuX3NjYW5uZXIudGV4dCh2YWx1ZSk7XG5cdFx0dGhpcy5fdG9rZW4gPSB0aGlzLl9zY2FubmVyLm5leHQoKTtcblx0XHR3aGlsZSAodGhpcy5fcGFyc2Uoc25pcHBldCkpIHtcblx0XHRcdC8vIG5vdGhpbmdcblx0XHR9XG5cblx0XHQvLyBmaWxsIGluIHZhbHVlcyBmb3IgcGxhY2Vob2xkZXJzLiB0aGUgZmlyc3QgcGxhY2Vob2xkZXIgb2YgYW4gaW5kZXhcblx0XHQvLyB0aGF0IGhhcyBhIHZhbHVlIGRlZmluZXMgdGhlIHZhbHVlIGZvciBhbGwgcGxhY2Vob2xkZXJzIHdpdGggdGhhdCBpbmRleFxuXHRcdGNvbnN0IHBsYWNlaG9sZGVyRGVmYXVsdFZhbHVlcyA9IG5ldyBNYXA8bnVtYmVyLCBNYXJrZXJbXSB8IHVuZGVmaW5lZD4oKTtcblx0XHRjb25zdCBpbmNvbXBsZXRlUGxhY2Vob2xkZXJzOiBQbGFjZWhvbGRlcltdID0gW107XG5cdFx0c25pcHBldC53YWxrKG1hcmtlciA9PiB7XG5cdFx0XHRpZiAobWFya2VyIGluc3RhbmNlb2YgUGxhY2Vob2xkZXIpIHtcblx0XHRcdFx0aWYgKG1hcmtlci5pc0ZpbmFsVGFic3RvcCkge1xuXHRcdFx0XHRcdHBsYWNlaG9sZGVyRGVmYXVsdFZhbHVlcy5zZXQoMCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fSBlbHNlIGlmICghcGxhY2Vob2xkZXJEZWZhdWx0VmFsdWVzLmhhcyhtYXJrZXIuaW5kZXgpICYmIG1hcmtlci5jaGlsZHJlbi5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0cGxhY2Vob2xkZXJEZWZhdWx0VmFsdWVzLnNldChtYXJrZXIuaW5kZXgsIG1hcmtlci5jaGlsZHJlbik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aW5jb21wbGV0ZVBsYWNlaG9sZGVycy5wdXNoKG1hcmtlcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZmlsbEluSW5jb21wbGV0ZVBsYWNlaG9sZGVyID0gKHBsYWNlaG9sZGVyOiBQbGFjZWhvbGRlciwgc3RhY2s6IFNldDxudW1iZXI+KSA9PiB7XG5cdFx0XHRjb25zdCBkZWZhdWx0VmFsdWVzID0gcGxhY2Vob2xkZXJEZWZhdWx0VmFsdWVzLmdldChwbGFjZWhvbGRlci5pbmRleCk7XG5cdFx0XHRpZiAoIWRlZmF1bHRWYWx1ZXMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY2xvbmUgPSBuZXcgUGxhY2Vob2xkZXIocGxhY2Vob2xkZXIuaW5kZXgpO1xuXHRcdFx0Y2xvbmUudHJhbnNmb3JtID0gcGxhY2Vob2xkZXIudHJhbnNmb3JtO1xuXHRcdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBkZWZhdWx0VmFsdWVzKSB7XG5cdFx0XHRcdGNvbnN0IG5ld0NoaWxkID0gY2hpbGQuY2xvbmUoKTtcblx0XHRcdFx0Y2xvbmUuYXBwZW5kQ2hpbGQobmV3Q2hpbGQpO1xuXG5cdFx0XHRcdC8vIFwicmVjdXJzZVwiIG9uIGNoaWxkcmVuIHRoYXQgYXJlIGFnYWluIHBsYWNlaG9sZGVyc1xuXHRcdFx0XHRpZiAobmV3Q2hpbGQgaW5zdGFuY2VvZiBQbGFjZWhvbGRlciAmJiBwbGFjZWhvbGRlckRlZmF1bHRWYWx1ZXMuaGFzKG5ld0NoaWxkLmluZGV4KSAmJiAhc3RhY2suaGFzKG5ld0NoaWxkLmluZGV4KSkge1xuXHRcdFx0XHRcdHN0YWNrLmFkZChuZXdDaGlsZC5pbmRleCk7XG5cdFx0XHRcdFx0ZmlsbEluSW5jb21wbGV0ZVBsYWNlaG9sZGVyKG5ld0NoaWxkLCBzdGFjayk7XG5cdFx0XHRcdFx0c3RhY2suZGVsZXRlKG5ld0NoaWxkLmluZGV4KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0c25pcHBldC5yZXBsYWNlKHBsYWNlaG9sZGVyLCBbY2xvbmVdKTtcblx0XHR9O1xuXG5cdFx0Y29uc3Qgc3RhY2sgPSBuZXcgU2V0PG51bWJlcj4oKTtcblx0XHRmb3IgKGNvbnN0IHBsYWNlaG9sZGVyIG9mIGluY29tcGxldGVQbGFjZWhvbGRlcnMpIHtcblx0XHRcdGZpbGxJbkluY29tcGxldGVQbGFjZWhvbGRlcihwbGFjZWhvbGRlciwgc3RhY2spO1xuXHRcdH1cblxuXHRcdHJldHVybiBzbmlwcGV0LmNoaWxkcmVuLnNsaWNlKG9mZnNldCk7XG5cdH1cblxuXHRlbnN1cmVGaW5hbFRhYnN0b3Aoc25pcHBldDogVGV4dG1hdGVTbmlwcGV0LCBlbmZvcmNlRmluYWxUYWJzdG9wOiBib29sZWFuLCBpbnNlcnRGaW5hbFRhYnN0b3A6IGJvb2xlYW4pIHtcblxuXHRcdGlmIChlbmZvcmNlRmluYWxUYWJzdG9wIHx8IGluc2VydEZpbmFsVGFic3RvcCAmJiBzbmlwcGV0LnBsYWNlaG9sZGVycy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBmaW5hbFRhYnN0b3AgPSBzbmlwcGV0LnBsYWNlaG9sZGVycy5maW5kKHAgPT4gcC5pbmRleCA9PT0gMCk7XG5cdFx0XHRpZiAoIWZpbmFsVGFic3RvcCkge1xuXHRcdFx0XHQvLyB0aGUgc25pcHBldCB1c2VzIHBsYWNlaG9sZGVycyBidXQgaGFzIG5vXG5cdFx0XHRcdC8vIGZpbmFsIHRhYnN0b3AgZGVmaW5lZCAtPiBpbnNlcnQgYXQgdGhlIGVuZFxuXHRcdFx0XHRzbmlwcGV0LmFwcGVuZENoaWxkKG5ldyBQbGFjZWhvbGRlcigwKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdH1cblxuXHRwcml2YXRlIF9hY2NlcHQodHlwZT86IFRva2VuVHlwZSk6IGJvb2xlYW47XG5cdHByaXZhdGUgX2FjY2VwdCh0eXBlOiBUb2tlblR5cGUgfCB1bmRlZmluZWQsIHZhbHVlOiB0cnVlKTogc3RyaW5nO1xuXHRwcml2YXRlIF9hY2NlcHQodHlwZTogVG9rZW5UeXBlLCB2YWx1ZT86IGJvb2xlYW4pOiBib29sZWFuIHwgc3RyaW5nIHtcblx0XHRpZiAodHlwZSA9PT0gdW5kZWZpbmVkIHx8IHRoaXMuX3Rva2VuLnR5cGUgPT09IHR5cGUpIHtcblx0XHRcdGNvbnN0IHJldCA9ICF2YWx1ZSA/IHRydWUgOiB0aGlzLl9zY2FubmVyLnRva2VuVGV4dCh0aGlzLl90b2tlbik7XG5cdFx0XHR0aGlzLl90b2tlbiA9IHRoaXMuX3NjYW5uZXIubmV4dCgpO1xuXHRcdFx0cmV0dXJuIHJldDtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfYmFja1RvKHRva2VuOiBUb2tlbik6IGZhbHNlIHtcblx0XHR0aGlzLl9zY2FubmVyLnBvcyA9IHRva2VuLnBvcyArIHRva2VuLmxlbjtcblx0XHR0aGlzLl90b2tlbiA9IHRva2VuO1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgX3VudGlsKHR5cGU6IFRva2VuVHlwZSk6IGZhbHNlIHwgc3RyaW5nIHtcblx0XHRjb25zdCBzdGFydCA9IHRoaXMuX3Rva2VuO1xuXHRcdHdoaWxlICh0aGlzLl90b2tlbi50eXBlICE9PSB0eXBlKSB7XG5cdFx0XHRpZiAodGhpcy5fdG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLkVPRikge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuX3Rva2VuLnR5cGUgPT09IFRva2VuVHlwZS5CYWNrc2xhc2gpIHtcblx0XHRcdFx0Y29uc3QgbmV4dFRva2VuID0gdGhpcy5fc2Nhbm5lci5uZXh0KCk7XG5cdFx0XHRcdGlmIChuZXh0VG9rZW4udHlwZSAhPT0gVG9rZW5UeXBlLkRvbGxhclxuXHRcdFx0XHRcdCYmIG5leHRUb2tlbi50eXBlICE9PSBUb2tlblR5cGUuQ3VybHlDbG9zZVxuXHRcdFx0XHRcdCYmIG5leHRUb2tlbi50eXBlICE9PSBUb2tlblR5cGUuQmFja3NsYXNoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl90b2tlbiA9IHRoaXMuX3NjYW5uZXIubmV4dCgpO1xuXHRcdH1cblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuX3NjYW5uZXIudmFsdWUuc3Vic3RyaW5nKHN0YXJ0LnBvcywgdGhpcy5fdG9rZW4ucG9zKS5yZXBsYWNlKC9cXFxcKFxcJHx9fFxcXFwpL2csICckMScpO1xuXHRcdHRoaXMuX3Rva2VuID0gdGhpcy5fc2Nhbm5lci5uZXh0KCk7XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBfcGFyc2UobWFya2VyOiBNYXJrZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fcGFyc2VFc2NhcGVkKG1hcmtlcilcblx0XHRcdHx8IHRoaXMuX3BhcnNlVGFic3RvcE9yVmFyaWFibGVOYW1lKG1hcmtlcilcblx0XHRcdHx8IHRoaXMuX3BhcnNlQ29tcGxleFBsYWNlaG9sZGVyKG1hcmtlcilcblx0XHRcdHx8IHRoaXMuX3BhcnNlQ29tcGxleFZhcmlhYmxlKG1hcmtlcilcblx0XHRcdHx8IHRoaXMuX3BhcnNlQW55dGhpbmcobWFya2VyKTtcblx0fVxuXG5cdC8vIFxcJCwgXFxcXCwgXFx9IC0+IGp1c3QgdGV4dFxuXHRwcml2YXRlIF9wYXJzZUVzY2FwZWQobWFya2VyOiBNYXJrZXIpOiBib29sZWFuIHtcblx0XHRsZXQgdmFsdWU6IHN0cmluZztcblx0XHRpZiAodmFsdWUgPSB0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLkJhY2tzbGFzaCwgdHJ1ZSkpIHtcblx0XHRcdC8vIHNhdyBhIGJhY2tzbGFzaCwgYXBwZW5kIGVzY2FwZWQgdG9rZW4gb3IgdGhhdCBiYWNrc2xhc2hcblx0XHRcdHZhbHVlID0gdGhpcy5fYWNjZXB0KFRva2VuVHlwZS5Eb2xsYXIsIHRydWUpXG5cdFx0XHRcdHx8IHRoaXMuX2FjY2VwdChUb2tlblR5cGUuQ3VybHlDbG9zZSwgdHJ1ZSlcblx0XHRcdFx0fHwgdGhpcy5fYWNjZXB0KFRva2VuVHlwZS5CYWNrc2xhc2gsIHRydWUpXG5cdFx0XHRcdHx8IHZhbHVlO1xuXG5cdFx0XHRtYXJrZXIuYXBwZW5kQ2hpbGQobmV3IFRleHQodmFsdWUpKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHQvLyAkZm9vIC0+IHZhcmlhYmxlLCAkMSAtPiB0YWJzdG9wXG5cdHByaXZhdGUgX3BhcnNlVGFic3RvcE9yVmFyaWFibGVOYW1lKHBhcmVudDogTWFya2VyKTogYm9vbGVhbiB7XG5cdFx0bGV0IHZhbHVlOiBzdHJpbmc7XG5cdFx0Y29uc3QgdG9rZW4gPSB0aGlzLl90b2tlbjtcblx0XHRjb25zdCBtYXRjaCA9IHRoaXMuX2FjY2VwdChUb2tlblR5cGUuRG9sbGFyKVxuXHRcdFx0JiYgKHZhbHVlID0gdGhpcy5fYWNjZXB0KFRva2VuVHlwZS5WYXJpYWJsZU5hbWUsIHRydWUpIHx8IHRoaXMuX2FjY2VwdChUb2tlblR5cGUuSW50LCB0cnVlKSk7XG5cblx0XHRpZiAoIW1hdGNoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYmFja1RvKHRva2VuKTtcblx0XHR9XG5cblx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQoL15cXGQrJC8udGVzdCh2YWx1ZSEpXG5cdFx0XHQ/IG5ldyBQbGFjZWhvbGRlcihOdW1iZXIodmFsdWUhKSlcblx0XHRcdDogbmV3IFZhcmlhYmxlKHZhbHVlISlcblx0XHQpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Ly8gJHsxOjxjaGlsZHJlbj59LCAkezF9IC0+IHBsYWNlaG9sZGVyXG5cdHByaXZhdGUgX3BhcnNlQ29tcGxleFBsYWNlaG9sZGVyKHBhcmVudDogTWFya2VyKTogYm9vbGVhbiB7XG5cdFx0bGV0IGluZGV4OiBzdHJpbmc7XG5cdFx0Y29uc3QgdG9rZW4gPSB0aGlzLl90b2tlbjtcblx0XHRjb25zdCBtYXRjaCA9IHRoaXMuX2FjY2VwdChUb2tlblR5cGUuRG9sbGFyKVxuXHRcdFx0JiYgdGhpcy5fYWNjZXB0KFRva2VuVHlwZS5DdXJseU9wZW4pXG5cdFx0XHQmJiAoaW5kZXggPSB0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLkludCwgdHJ1ZSkpO1xuXG5cdFx0aWYgKCFtYXRjaCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2JhY2tUbyh0b2tlbik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGxhY2Vob2xkZXIgPSBuZXcgUGxhY2Vob2xkZXIoTnVtYmVyKGluZGV4ISkpO1xuXG5cdFx0aWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuQ29sb24pKSB7XG5cdFx0XHQvLyAkezE6PGNoaWxkcmVuPn1cblx0XHRcdHdoaWxlICh0cnVlKSB7XG5cblx0XHRcdFx0Ly8gLi4ufSAtPiBkb25lXG5cdFx0XHRcdGlmICh0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLkN1cmx5Q2xvc2UpKSB7XG5cdFx0XHRcdFx0cGFyZW50LmFwcGVuZENoaWxkKHBsYWNlaG9sZGVyKTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLl9wYXJzZShwbGFjZWhvbGRlcikpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIGZhbGxiYWNrXG5cdFx0XHRcdHBhcmVudC5hcHBlbmRDaGlsZChuZXcgVGV4dCgnJHsnICsgaW5kZXghICsgJzonKSk7XG5cdFx0XHRcdHBsYWNlaG9sZGVyLmNoaWxkcmVuLmZvckVhY2gocGFyZW50LmFwcGVuZENoaWxkLCBwYXJlbnQpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKHBsYWNlaG9sZGVyLmluZGV4ID4gMCAmJiB0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLlBpcGUpKSB7XG5cdFx0XHQvLyAkezF8b25lLHR3byx0aHJlZXx9XG5cdFx0XHRjb25zdCBjaG9pY2UgPSBuZXcgQ2hvaWNlKCk7XG5cblx0XHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9wYXJzZUNob2ljZUVsZW1lbnQoY2hvaWNlKSkge1xuXG5cdFx0XHRcdFx0aWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuQ29tbWEpKSB7XG5cdFx0XHRcdFx0XHQvLyBvcHQsIC0+IG1vcmVcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICh0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLlBpcGUpKSB7XG5cdFx0XHRcdFx0XHRwbGFjZWhvbGRlci5hcHBlbmRDaGlsZChjaG9pY2UpO1xuXHRcdFx0XHRcdFx0aWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuQ3VybHlDbG9zZSkpIHtcblx0XHRcdFx0XHRcdFx0Ly8gLi58fSAtPiBkb25lXG5cdFx0XHRcdFx0XHRcdHBhcmVudC5hcHBlbmRDaGlsZChwbGFjZWhvbGRlcik7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX2JhY2tUbyh0b2tlbik7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdH0gZWxzZSBpZiAodGhpcy5fYWNjZXB0KFRva2VuVHlwZS5Gb3J3YXJkc2xhc2gpKSB7XG5cdFx0XHQvLyAkezEvPHJlZ2V4Pi88Zm9ybWF0Pi88b3B0aW9ucz59XG5cdFx0XHRpZiAodGhpcy5fcGFyc2VUcmFuc2Zvcm0ocGxhY2Vob2xkZXIpKSB7XG5cdFx0XHRcdHBhcmVudC5hcHBlbmRDaGlsZChwbGFjZWhvbGRlcik7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9iYWNrVG8odG9rZW4pO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXG5cdFx0fSBlbHNlIGlmICh0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLkN1cmx5Q2xvc2UpKSB7XG5cdFx0XHQvLyAkezF9XG5cdFx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQocGxhY2Vob2xkZXIpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gJHsxIDwtIG1pc3NpbmcgY3VybHkgb3IgY29sb25cblx0XHRcdHJldHVybiB0aGlzLl9iYWNrVG8odG9rZW4pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3BhcnNlQ2hvaWNlRWxlbWVudChwYXJlbnQ6IENob2ljZSk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHRva2VuID0gdGhpcy5fdG9rZW47XG5cdFx0Y29uc3QgdmFsdWVzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdGlmICh0aGlzLl90b2tlbi50eXBlID09PSBUb2tlblR5cGUuQ29tbWEgfHwgdGhpcy5fdG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLlBpcGUpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRsZXQgdmFsdWU6IHN0cmluZztcblx0XHRcdGlmICh2YWx1ZSA9IHRoaXMuX2FjY2VwdChUb2tlblR5cGUuQmFja3NsYXNoLCB0cnVlKSkge1xuXHRcdFx0XHQvLyBcXCwgXFx8LCBvciBcXFxcXG5cdFx0XHRcdHZhbHVlID0gdGhpcy5fYWNjZXB0KFRva2VuVHlwZS5Db21tYSwgdHJ1ZSlcblx0XHRcdFx0XHR8fCB0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLlBpcGUsIHRydWUpXG5cdFx0XHRcdFx0fHwgdGhpcy5fYWNjZXB0KFRva2VuVHlwZS5CYWNrc2xhc2gsIHRydWUpXG5cdFx0XHRcdFx0fHwgdmFsdWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YWx1ZSA9IHRoaXMuX2FjY2VwdCh1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF2YWx1ZSkge1xuXHRcdFx0XHQvLyBFT0Zcblx0XHRcdFx0dGhpcy5fYmFja1RvKHRva2VuKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0dmFsdWVzLnB1c2godmFsdWUpO1xuXHRcdH1cblxuXHRcdGlmICh2YWx1ZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLl9iYWNrVG8odG9rZW4pO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHBhcmVudC5hcHBlbmRDaGlsZChuZXcgVGV4dCh2YWx1ZXMuam9pbignJykpKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8vICR7Zm9vOjxjaGlsZHJlbj59LCAke2Zvb30gLT4gdmFyaWFibGVcblx0cHJpdmF0ZSBfcGFyc2VDb21wbGV4VmFyaWFibGUocGFyZW50OiBNYXJrZXIpOiBib29sZWFuIHtcblx0XHRsZXQgbmFtZTogc3RyaW5nO1xuXHRcdGNvbnN0IHRva2VuID0gdGhpcy5fdG9rZW47XG5cdFx0Y29uc3QgbWF0Y2ggPSB0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLkRvbGxhcilcblx0XHRcdCYmIHRoaXMuX2FjY2VwdChUb2tlblR5cGUuQ3VybHlPcGVuKVxuXHRcdFx0JiYgKG5hbWUgPSB0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLlZhcmlhYmxlTmFtZSwgdHJ1ZSkpO1xuXG5cdFx0aWYgKCFtYXRjaCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2JhY2tUbyh0b2tlbik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmFyaWFibGUgPSBuZXcgVmFyaWFibGUobmFtZSEpO1xuXG5cdFx0aWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuQ29sb24pKSB7XG5cdFx0XHQvLyAke2Zvbzo8Y2hpbGRyZW4+fVxuXHRcdFx0d2hpbGUgKHRydWUpIHtcblxuXHRcdFx0XHQvLyAuLi59IC0+IGRvbmVcblx0XHRcdFx0aWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuQ3VybHlDbG9zZSkpIHtcblx0XHRcdFx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQodmFyaWFibGUpO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRoaXMuX3BhcnNlKHZhcmlhYmxlKSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gZmFsbGJhY2tcblx0XHRcdFx0cGFyZW50LmFwcGVuZENoaWxkKG5ldyBUZXh0KCckeycgKyBuYW1lISArICc6JykpO1xuXHRcdFx0XHR2YXJpYWJsZS5jaGlsZHJlbi5mb3JFYWNoKHBhcmVudC5hcHBlbmRDaGlsZCwgcGFyZW50KTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHR9IGVsc2UgaWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuRm9yd2FyZHNsYXNoKSkge1xuXHRcdFx0Ly8gJHtmb28vPHJlZ2V4Pi88Zm9ybWF0Pi88b3B0aW9ucz59XG5cdFx0XHRpZiAodGhpcy5fcGFyc2VUcmFuc2Zvcm0odmFyaWFibGUpKSB7XG5cdFx0XHRcdHBhcmVudC5hcHBlbmRDaGlsZCh2YXJpYWJsZSk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9iYWNrVG8odG9rZW4pO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXG5cdFx0fSBlbHNlIGlmICh0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLkN1cmx5Q2xvc2UpKSB7XG5cdFx0XHQvLyAke2Zvb31cblx0XHRcdHBhcmVudC5hcHBlbmRDaGlsZCh2YXJpYWJsZSk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyAke2ZvbyA8LSBtaXNzaW5nIGN1cmx5IG9yIGNvbG9uXG5cdFx0XHRyZXR1cm4gdGhpcy5fYmFja1RvKHRva2VuKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9wYXJzZVRyYW5zZm9ybShwYXJlbnQ6IFRyYW5zZm9ybWFibGVNYXJrZXIpOiBib29sZWFuIHtcblx0XHQvLyAuLi48cmVnZXg+Lzxmb3JtYXQ+LzxvcHRpb25zPn1cblxuXHRcdGNvbnN0IHRyYW5zZm9ybSA9IG5ldyBUcmFuc2Zvcm0oKTtcblx0XHRsZXQgcmVnZXhWYWx1ZSA9ICcnO1xuXHRcdGxldCByZWdleE9wdGlvbnMgPSAnJztcblxuXHRcdC8vICgxKSAvcmVnZXhcblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0aWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuRm9yd2FyZHNsYXNoKSkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0bGV0IGVzY2FwZWQ6IHN0cmluZztcblx0XHRcdGlmIChlc2NhcGVkID0gdGhpcy5fYWNjZXB0KFRva2VuVHlwZS5CYWNrc2xhc2gsIHRydWUpKSB7XG5cdFx0XHRcdGVzY2FwZWQgPSB0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLkZvcndhcmRzbGFzaCwgdHJ1ZSkgfHwgZXNjYXBlZDtcblx0XHRcdFx0cmVnZXhWYWx1ZSArPSBlc2NhcGVkO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX3Rva2VuLnR5cGUgIT09IFRva2VuVHlwZS5FT0YpIHtcblx0XHRcdFx0cmVnZXhWYWx1ZSArPSB0aGlzLl9hY2NlcHQodW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gKDIpIC9mb3JtYXRcblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0aWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuRm9yd2FyZHNsYXNoKSkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0bGV0IGVzY2FwZWQ6IHN0cmluZztcblx0XHRcdGlmIChlc2NhcGVkID0gdGhpcy5fYWNjZXB0KFRva2VuVHlwZS5CYWNrc2xhc2gsIHRydWUpKSB7XG5cdFx0XHRcdGVzY2FwZWQgPSB0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLkJhY2tzbGFzaCwgdHJ1ZSkgfHwgdGhpcy5fYWNjZXB0KFRva2VuVHlwZS5Gb3J3YXJkc2xhc2gsIHRydWUpIHx8IGVzY2FwZWQ7XG5cdFx0XHRcdHRyYW5zZm9ybS5hcHBlbmRDaGlsZChuZXcgVGV4dChlc2NhcGVkKSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5fcGFyc2VGb3JtYXRTdHJpbmcodHJhbnNmb3JtKSB8fCB0aGlzLl9wYXJzZUFueXRoaW5nKHRyYW5zZm9ybSkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gKDMpIC9vcHRpb25cblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0aWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuQ3VybHlDbG9zZSkpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fdG9rZW4udHlwZSAhPT0gVG9rZW5UeXBlLkVPRikge1xuXHRcdFx0XHRyZWdleE9wdGlvbnMgKz0gdGhpcy5fYWNjZXB0KHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHR0cmFuc2Zvcm0ucmVnZXhwID0gbmV3IFJlZ0V4cChyZWdleFZhbHVlLCByZWdleE9wdGlvbnMpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdC8vIGludmFsaWQgcmVnZXhwXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cGFyZW50LnRyYW5zZm9ybSA9IHRyYW5zZm9ybTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgX3BhcnNlRm9ybWF0U3RyaW5nKHBhcmVudDogVHJhbnNmb3JtKTogYm9vbGVhbiB7XG5cblx0XHRjb25zdCB0b2tlbiA9IHRoaXMuX3Rva2VuO1xuXHRcdGlmICghdGhpcy5fYWNjZXB0KFRva2VuVHlwZS5Eb2xsYXIpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bGV0IGNvbXBsZXggPSBmYWxzZTtcblx0XHRpZiAodGhpcy5fYWNjZXB0KFRva2VuVHlwZS5DdXJseU9wZW4pKSB7XG5cdFx0XHRjb21wbGV4ID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBpbmRleCA9IHRoaXMuX2FjY2VwdChUb2tlblR5cGUuSW50LCB0cnVlKTtcblxuXHRcdGlmICghaW5kZXgpIHtcblx0XHRcdHRoaXMuX2JhY2tUbyh0b2tlbik7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cblx0XHR9IGVsc2UgaWYgKCFjb21wbGV4KSB7XG5cdFx0XHQvLyAkMVxuXHRcdFx0cGFyZW50LmFwcGVuZENoaWxkKG5ldyBGb3JtYXRTdHJpbmcoTnVtYmVyKGluZGV4KSkpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cblx0XHR9IGVsc2UgaWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuQ3VybHlDbG9zZSkpIHtcblx0XHRcdC8vICR7MX1cblx0XHRcdHBhcmVudC5hcHBlbmRDaGlsZChuZXcgRm9ybWF0U3RyaW5nKE51bWJlcihpbmRleCkpKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXG5cdFx0fSBlbHNlIGlmICghdGhpcy5fYWNjZXB0KFRva2VuVHlwZS5Db2xvbikpIHtcblx0XHRcdHRoaXMuX2JhY2tUbyh0b2tlbik7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuRm9yd2FyZHNsYXNoKSkge1xuXHRcdFx0Ly8gJHsxOi91cGNhc2V9XG5cdFx0XHRjb25zdCBzaG9ydGhhbmQgPSB0aGlzLl9hY2NlcHQoVG9rZW5UeXBlLlZhcmlhYmxlTmFtZSwgdHJ1ZSk7XG5cdFx0XHRpZiAoIXNob3J0aGFuZCB8fCAhdGhpcy5fYWNjZXB0KFRva2VuVHlwZS5DdXJseUNsb3NlKSkge1xuXHRcdFx0XHR0aGlzLl9iYWNrVG8odG9rZW4pO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQobmV3IEZvcm1hdFN0cmluZyhOdW1iZXIoaW5kZXgpLCBzaG9ydGhhbmQpKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHR9IGVsc2UgaWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuUGx1cykpIHtcblx0XHRcdC8vICR7MTorPGlmPn1cblx0XHRcdGNvbnN0IGlmVmFsdWUgPSB0aGlzLl91bnRpbChUb2tlblR5cGUuQ3VybHlDbG9zZSk7XG5cdFx0XHRpZiAoaWZWYWx1ZSkge1xuXHRcdFx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQobmV3IEZvcm1hdFN0cmluZyhOdW1iZXIoaW5kZXgpLCB1bmRlZmluZWQsIGlmVmFsdWUsIHVuZGVmaW5lZCkpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdH0gZWxzZSBpZiAodGhpcy5fYWNjZXB0KFRva2VuVHlwZS5EYXNoKSkge1xuXHRcdFx0Ly8gJHsyOi08ZWxzZT59XG5cdFx0XHRjb25zdCBlbHNlVmFsdWUgPSB0aGlzLl91bnRpbChUb2tlblR5cGUuQ3VybHlDbG9zZSk7XG5cdFx0XHRpZiAoZWxzZVZhbHVlKSB7XG5cdFx0XHRcdHBhcmVudC5hcHBlbmRDaGlsZChuZXcgRm9ybWF0U3RyaW5nKE51bWJlcihpbmRleCksIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBlbHNlVmFsdWUpKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHR9IGVsc2UgaWYgKHRoaXMuX2FjY2VwdChUb2tlblR5cGUuUXVlc3Rpb25NYXJrKSkge1xuXHRcdFx0Ly8gJHsyOj88aWY+OjxlbHNlPn1cblx0XHRcdGNvbnN0IGlmVmFsdWUgPSB0aGlzLl91bnRpbChUb2tlblR5cGUuQ29sb24pO1xuXHRcdFx0aWYgKGlmVmFsdWUpIHtcblx0XHRcdFx0Y29uc3QgZWxzZVZhbHVlID0gdGhpcy5fdW50aWwoVG9rZW5UeXBlLkN1cmx5Q2xvc2UpO1xuXHRcdFx0XHRpZiAoZWxzZVZhbHVlKSB7XG5cdFx0XHRcdFx0cGFyZW50LmFwcGVuZENoaWxkKG5ldyBGb3JtYXRTdHJpbmcoTnVtYmVyKGluZGV4KSwgdW5kZWZpbmVkLCBpZlZhbHVlLCBlbHNlVmFsdWUpKTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vICR7MTo8ZWxzZT59XG5cdFx0XHRjb25zdCBlbHNlVmFsdWUgPSB0aGlzLl91bnRpbChUb2tlblR5cGUuQ3VybHlDbG9zZSk7XG5cdFx0XHRpZiAoZWxzZVZhbHVlKSB7XG5cdFx0XHRcdHBhcmVudC5hcHBlbmRDaGlsZChuZXcgRm9ybWF0U3RyaW5nKE51bWJlcihpbmRleCksIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBlbHNlVmFsdWUpKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fYmFja1RvKHRva2VuKTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIF9wYXJzZUFueXRoaW5nKG1hcmtlcjogTWFya2VyKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX3Rva2VuLnR5cGUgIT09IFRva2VuVHlwZS5FT0YpIHtcblx0XHRcdG1hcmtlci5hcHBlbmRDaGlsZChuZXcgVGV4dCh0aGlzLl9zY2FubmVyLnRva2VuVGV4dCh0aGlzLl90b2tlbikpKTtcblx0XHRcdHRoaXMuX2FjY2VwdCh1bmRlZmluZWQpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFFbEIsSUFBVyxZQUFYLGtCQUFXQSxlQUFYO0FBQ04sRUFBQUEsc0JBQUE7QUFDQSxFQUFBQSxzQkFBQTtBQUNBLEVBQUFBLHNCQUFBO0FBQ0EsRUFBQUEsc0JBQUE7QUFDQSxFQUFBQSxzQkFBQTtBQUNBLEVBQUFBLHNCQUFBO0FBQ0EsRUFBQUEsc0JBQUE7QUFDQSxFQUFBQSxzQkFBQTtBQUNBLEVBQUFBLHNCQUFBO0FBQ0EsRUFBQUEsc0JBQUE7QUFDQSxFQUFBQSxzQkFBQTtBQUNBLEVBQUFBLHNCQUFBO0FBQ0EsRUFBQUEsc0JBQUE7QUFDQSxFQUFBQSxzQkFBQTtBQUNBLEVBQUFBLHNCQUFBO0FBZmlCLFNBQUFBO0FBQUEsR0FBQTtBQXlCWCxNQUFNLFdBQU4sTUFBTSxTQUFRO0FBQUEsRUFBZDtBQTBCTixpQkFBZ0I7QUFDaEIsZUFBYztBQUFBO0FBQUEsRUFYZCxPQUFPLGlCQUFpQixJQUFxQjtBQUM1QyxXQUFPLE1BQU0sU0FBUyxVQUFVLE1BQU0sU0FBUztBQUFBLEVBQ2hEO0FBQUEsRUFFQSxPQUFPLG9CQUFvQixJQUFxQjtBQUMvQyxXQUFPLE9BQU8sU0FBUyxhQUNsQixNQUFNLFNBQVMsS0FBSyxNQUFNLFNBQVMsS0FDbkMsTUFBTSxTQUFTLEtBQUssTUFBTSxTQUFTO0FBQUEsRUFDekM7QUFBQSxFQUtBLEtBQUssT0FBZTtBQUNuQixTQUFLLFFBQVE7QUFDYixTQUFLLE1BQU07QUFBQSxFQUNaO0FBQUEsRUFFQSxVQUFVLE9BQXNCO0FBQy9C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WUFBTSxZQUFZLEtBQUssUUFBUSxzQkFBd0IsSUFBSTtBQUMzRCxVQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssUUFBUSxrQkFBb0IsR0FBRztBQUN0RCxhQUFLLFFBQVEsS0FBSztBQUNsQixlQUFPO0FBQUEsTUFDUixPQUFPO0FBQ04sZUFBTyxZQUFZLElBQUksYUFBYSxPQUFPLEtBQUssR0FBRyxTQUFTLENBQUM7QUFDN0QsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUVELFdBQVcsS0FBSyxRQUFRLGFBQWMsR0FBRztBQUV4QyxZQUFNLFVBQVUsS0FBSyxPQUFPLGtCQUFvQjtBQUNoRCxVQUFJLFNBQVM7QUFDWixlQUFPLFlBQVksSUFBSSxhQUFhLE9BQU8sS0FBSyxHQUFHLFFBQVcsU0FBUyxNQUFTLENBQUM7QUFDakYsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUVELFdBQVcsS0FBSyxRQUFRLGFBQWMsR0FBRztBQUV4QyxZQUFNLFlBQVksS0FBSyxPQUFPLGtCQUFvQjtBQUNsRCxVQUFJLFdBQVc7QUFDZCxlQUFPLFlBQVksSUFBSSxhQUFhLE9BQU8sS0FBSyxHQUFHLFFBQVcsUUFBVyxTQUFTLENBQUM7QUFDbkYsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUVELFdBQVcsS0FBSyxRQUFRLHFCQUFzQixHQUFHO0FBRWhELFlBQU0sVUFBVSxLQUFLLE9BQU8sYUFBZTtBQUMzQyxVQUFJLFNBQVM7QUFDWixjQUFNLFlBQVksS0FBSyxPQUFPLGtCQUFvQjtBQUNsRCxZQUFJLFdBQVc7QUFDZCxpQkFBTyxZQUFZLElBQUksYUFBYSxPQUFPLEtBQUssR0FBRyxRQUFXLFNBQVMsU0FBUyxDQUFDO0FBQ2pGLGlCQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxJQUVELE9BQU87QUFFTixZQUFNLFlBQVksS0FBSyxPQUFPLGtCQUFvQjtBQUNsRCxVQUFJLFdBQVc7QUFDZCxlQUFPLFlBQVksSUFBSSxhQUFhLE9BQU8sS0FBSyxHQUFHLFFBQVcsUUFBVyxTQUFTLENBQUM7QUFDbkYsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBRUEsU0FBSyxRQUFRLEtBQUs7QUFDbEIsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGVBQWUsUUFBeUI7QUFDL0MsUUFBSSxLQUFLLE9BQU8sU0FBUyxjQUFlO0FBQ3ZDLGFBQU8sWUFBWSxJQUFJLEtBQUssS0FBSyxTQUFTLFVBQVUsS0FBSyxNQUFNLENBQUMsQ0FBQztBQUNqRSxXQUFLLFFBQVEsTUFBUztBQUN0QixhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7IiwKICAibmFtZXMiOiBbIlRva2VuVHlwZSIsICJwYXJlbnQiLCAiY2hpbGQiLCAibWFya2VyIiwgInN0YWNrIl0KfQo=
