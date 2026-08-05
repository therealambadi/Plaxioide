import { RunOnceScheduler } from "../../../base/common/async.js";
import { Color } from "../../../base/common/color.js";
import { Emitter } from "../../../base/common/event.js";
import * as nls from "../../../nls.js";
import { Extensions as JSONExtensions } from "../../jsonschemas/common/jsonContributionRegistry.js";
import * as platform from "../../registry/common/platform.js";
const TOKEN_TYPE_WILDCARD = "*";
const TOKEN_CLASSIFIER_LANGUAGE_SEPARATOR = ":";
const CLASSIFIER_MODIFIER_SEPARATOR = ".";
const idPattern = "\\w+[-_\\w+]*";
const typeAndModifierIdPattern = `^${idPattern}$`;
const selectorPattern = `^(${idPattern}|\\*)(\\${CLASSIFIER_MODIFIER_SEPARATOR}${idPattern})*(${TOKEN_CLASSIFIER_LANGUAGE_SEPARATOR}${idPattern})?$`;
const fontStylePattern = "^(\\s*(italic|bold|underline|strikethrough))*\\s*$";
class TokenStyle {
  constructor(foreground, bold, underline, strikethrough, italic) {
    this.foreground = foreground;
    this.bold = bold;
    this.underline = underline;
    this.strikethrough = strikethrough;
    this.italic = italic;
  }
}
((TokenStyle2) => {
  function toJSONObject(style) {
    return {
      _foreground: style.foreground === void 0 ? null : Color.Format.CSS.formatHexA(style.foreground, true),
      _bold: style.bold === void 0 ? null : style.bold,
      _underline: style.underline === void 0 ? null : style.underline,
      _italic: style.italic === void 0 ? null : style.italic,
      _strikethrough: style.strikethrough === void 0 ? null : style.strikethrough
    };
  }
  TokenStyle2.toJSONObject = toJSONObject;
  function fromJSONObject(obj) {
    if (obj) {
      const boolOrUndef = (b) => typeof b === "boolean" ? b : void 0;
      const colorOrUndef = (s) => typeof s === "string" ? Color.fromHex(s) : void 0;
      return new TokenStyle2(
        colorOrUndef(obj._foreground),
        boolOrUndef(obj._bold),
        boolOrUndef(obj._underline),
        boolOrUndef(obj._strikethrough),
        boolOrUndef(obj._italic)
      );
    }
    return void 0;
  }
  TokenStyle2.fromJSONObject = fromJSONObject;
  function equals(s1, s2) {
    if (s1 === s2) {
      return true;
    }
    return s1 !== void 0 && s2 !== void 0 && (s1.foreground instanceof Color ? s1.foreground.equals(s2.foreground) : s2.foreground === void 0) && s1.bold === s2.bold && s1.underline === s2.underline && s1.strikethrough === s2.strikethrough && s1.italic === s2.italic;
  }
  TokenStyle2.equals = equals;
  function is(s) {
    return s instanceof TokenStyle2;
  }
  TokenStyle2.is = is;
  function fromData(data) {
    return new TokenStyle2(data.foreground, data.bold, data.underline, data.strikethrough, data.italic);
  }
  TokenStyle2.fromData = fromData;
  function fromSettings(foreground, fontStyle, bold, underline, strikethrough, italic) {
    let foregroundColor = void 0;
    if (foreground !== void 0) {
      foregroundColor = Color.fromHex(foreground);
    }
    if (fontStyle !== void 0) {
      bold = italic = underline = strikethrough = false;
      const expression = /italic|bold|underline|strikethrough/g;
      let match;
      while (match = expression.exec(fontStyle)) {
        switch (match[0]) {
          case "bold":
            bold = true;
            break;
          case "italic":
            italic = true;
            break;
          case "underline":
            underline = true;
            break;
          case "strikethrough":
            strikethrough = true;
            break;
        }
      }
    }
    return new TokenStyle2(foregroundColor, bold, underline, strikethrough, italic);
  }
  TokenStyle2.fromSettings = fromSettings;
})(TokenStyle || (TokenStyle = {}));
var SemanticTokenRule;
((SemanticTokenRule2) => {
  function fromJSONObject(registry, o) {
    if (o && typeof o._selector === "string" && o._style) {
      const style = TokenStyle.fromJSONObject(o._style);
      if (style) {
        try {
          return { selector: registry.parseTokenSelector(o._selector), style };
        } catch (_ignore) {
        }
      }
    }
    return void 0;
  }
  SemanticTokenRule2.fromJSONObject = fromJSONObject;
  function toJSONObject(rule) {
    return {
      _selector: rule.selector.id,
      _style: TokenStyle.toJSONObject(rule.style)
    };
  }
  SemanticTokenRule2.toJSONObject = toJSONObject;
  function equals(r1, r2) {
    if (r1 === r2) {
      return true;
    }
    return r1 !== void 0 && r2 !== void 0 && r1.selector && r2.selector && r1.selector.id === r2.selector.id && TokenStyle.equals(r1.style, r2.style);
  }
  SemanticTokenRule2.equals = equals;
  function is(r) {
    return r && r.selector && typeof r.selector.id === "string" && TokenStyle.is(r.style);
  }
  SemanticTokenRule2.is = is;
})(SemanticTokenRule || (SemanticTokenRule = {}));
const Extensions = {
  TokenClassificationContribution: "base.contributions.tokenClassification"
};
class TokenClassificationRegistry {
  constructor() {
    this._onDidChangeSchema = new Emitter();
    this.onDidChangeSchema = this._onDidChangeSchema.event;
    this.currentTypeNumber = 0;
    this.currentModifierBit = 1;
    this.tokenStylingDefaultRules = [];
    this.tokenStylingSchema = {
      type: "object",
      properties: {},
      patternProperties: {
        [selectorPattern]: getStylingSchemeEntry()
      },
      //errorMessage: nls.localize('schema.token.errors', 'Valid token selectors have the form (*|tokenType)(.tokenModifier)*(:tokenLanguage)?.'),
      additionalProperties: false,
      definitions: {
        style: {
          type: "object",
          description: nls.localize("schema.token.settings", "Colors and styles for the token."),
          properties: {
            foreground: {
              type: "string",
              description: nls.localize("schema.token.foreground", "Foreground color for the token."),
              format: "color-hex",
              default: "#ff0000"
            },
            background: {
              type: "string",
              deprecationMessage: nls.localize("schema.token.background.warning", "Token background colors are currently not supported.")
            },
            fontStyle: {
              type: "string",
              description: nls.localize("schema.token.fontStyle", "Sets the all font styles of the rule: 'italic', 'bold', 'underline' or 'strikethrough' or a combination. All styles that are not listed are unset. The empty string unsets all styles."),
              pattern: fontStylePattern,
              patternErrorMessage: nls.localize("schema.fontStyle.error", "Font style must be 'italic', 'bold', 'underline' or 'strikethrough' or a combination. The empty string unsets all styles."),
              defaultSnippets: [
                { label: nls.localize("schema.token.fontStyle.none", "None (clear inherited style)"), bodyText: '""' },
                { body: "italic" },
                { body: "bold" },
                { body: "underline" },
                { body: "strikethrough" },
                { body: "italic bold" },
                { body: "italic underline" },
                { body: "italic strikethrough" },
                { body: "bold underline" },
                { body: "bold strikethrough" },
                { body: "underline strikethrough" },
                { body: "italic bold underline" },
                { body: "italic bold strikethrough" },
                { body: "italic underline strikethrough" },
                { body: "bold underline strikethrough" },
                { body: "italic bold underline strikethrough" }
              ]
            },
            bold: {
              type: "boolean",
              description: nls.localize("schema.token.bold", "Sets or unsets the font style to bold. Note, the presence of 'fontStyle' overrides this setting.")
            },
            italic: {
              type: "boolean",
              description: nls.localize("schema.token.italic", "Sets or unsets the font style to italic. Note, the presence of 'fontStyle' overrides this setting.")
            },
            underline: {
              type: "boolean",
              description: nls.localize("schema.token.underline", "Sets or unsets the font style to underline. Note, the presence of 'fontStyle' overrides this setting.")
            },
            strikethrough: {
              type: "boolean",
              description: nls.localize("schema.token.strikethrough", "Sets or unsets the font style to strikethrough. Note, the presence of 'fontStyle' overrides this setting.")
            }
          },
          defaultSnippets: [{ body: { foreground: "${1:#FF0000}", fontStyle: "${2:bold}" } }]
        }
      }
    };
    this.tokenTypeById = /* @__PURE__ */ Object.create(null);
    this.tokenModifierById = /* @__PURE__ */ Object.create(null);
    this.typeHierarchy = /* @__PURE__ */ Object.create(null);
  }
  registerTokenType(id, description, superType, deprecationMessage) {
    if (!id.match(typeAndModifierIdPattern)) {
      throw new Error("Invalid token type id.");
    }
    if (superType && !superType.match(typeAndModifierIdPattern)) {
      throw new Error("Invalid token super type id.");
    }
    const num = this.currentTypeNumber++;
    const tokenStyleContribution = { num, id, superType, description, deprecationMessage };
    this.tokenTypeById[id] = tokenStyleContribution;
    const stylingSchemeEntry = getStylingSchemeEntry(description, deprecationMessage);
    this.tokenStylingSchema.properties[id] = stylingSchemeEntry;
    this.typeHierarchy = /* @__PURE__ */ Object.create(null);
  }
  registerTokenModifier(id, description, deprecationMessage) {
    if (!id.match(typeAndModifierIdPattern)) {
      throw new Error("Invalid token modifier id.");
    }
    const num = this.currentModifierBit;
    this.currentModifierBit = this.currentModifierBit * 2;
    const tokenStyleContribution = { num, id, description, deprecationMessage };
    this.tokenModifierById[id] = tokenStyleContribution;
    this.tokenStylingSchema.properties[`*.${id}`] = getStylingSchemeEntry(description, deprecationMessage);
  }
  parseTokenSelector(selectorString, language) {
    const selector = parseClassifierString(selectorString, language);
    if (!selector.type) {
      return {
        match: () => -1,
        id: "$invalid"
      };
    }
    return {
      match: (type, modifiers, language2) => {
        let score = 0;
        if (selector.language !== void 0) {
          if (selector.language !== language2) {
            return -1;
          }
          score += 10;
        }
        if (selector.type !== TOKEN_TYPE_WILDCARD) {
          const hierarchy = this.getTypeHierarchy(type);
          const level = hierarchy.indexOf(selector.type);
          if (level === -1) {
            return -1;
          }
          score += 100 - level;
        }
        for (const selectorModifier of selector.modifiers) {
          if (modifiers.indexOf(selectorModifier) === -1) {
            return -1;
          }
        }
        return score + selector.modifiers.length * 100;
      },
      id: `${[selector.type, ...selector.modifiers.sort()].join(".")}${selector.language !== void 0 ? ":" + selector.language : ""}`
    };
  }
  registerTokenStyleDefault(selector, defaults) {
    this.tokenStylingDefaultRules.push({ selector, defaults });
  }
  deregisterTokenStyleDefault(selector) {
    const selectorString = selector.id;
    this.tokenStylingDefaultRules = this.tokenStylingDefaultRules.filter((r) => r.selector.id !== selectorString);
  }
  deregisterTokenType(id) {
    delete this.tokenTypeById[id];
    delete this.tokenStylingSchema.properties[id];
    this.typeHierarchy = /* @__PURE__ */ Object.create(null);
  }
  deregisterTokenModifier(id) {
    delete this.tokenModifierById[id];
    delete this.tokenStylingSchema.properties[`*.${id}`];
  }
  getTokenTypes() {
    return Object.keys(this.tokenTypeById).map((id) => this.tokenTypeById[id]);
  }
  getTokenModifiers() {
    return Object.keys(this.tokenModifierById).map((id) => this.tokenModifierById[id]);
  }
  getTokenStylingSchema() {
    return this.tokenStylingSchema;
  }
  getTokenStylingDefaultRules() {
    return this.tokenStylingDefaultRules;
  }
  getTypeHierarchy(typeId) {
    let hierarchy = this.typeHierarchy[typeId];
    if (!hierarchy) {
      this.typeHierarchy[typeId] = hierarchy = [typeId];
      let type = this.tokenTypeById[typeId];
      while (type && type.superType) {
        hierarchy.push(type.superType);
        type = this.tokenTypeById[type.superType];
      }
    }
    return hierarchy;
  }
  toString() {
    const sorter = (a, b) => {
      const cat1 = a.indexOf(".") === -1 ? 0 : 1;
      const cat2 = b.indexOf(".") === -1 ? 0 : 1;
      if (cat1 !== cat2) {
        return cat1 - cat2;
      }
      return a.localeCompare(b);
    };
    return Object.keys(this.tokenTypeById).sort(sorter).map((k) => `- \`${k}\`: ${this.tokenTypeById[k].description}`).join("\n");
  }
}
const CHAR_LANGUAGE = TOKEN_CLASSIFIER_LANGUAGE_SEPARATOR.charCodeAt(0);
const CHAR_MODIFIER = CLASSIFIER_MODIFIER_SEPARATOR.charCodeAt(0);
function parseClassifierString(s, defaultLanguage) {
  let k = s.length;
  let language = defaultLanguage;
  const modifiers = [];
  for (let i = k - 1; i >= 0; i--) {
    const ch = s.charCodeAt(i);
    if (ch === CHAR_LANGUAGE || ch === CHAR_MODIFIER) {
      const segment = s.substring(i + 1, k);
      k = i;
      if (ch === CHAR_LANGUAGE) {
        language = segment;
      } else {
        modifiers.push(segment);
      }
    }
  }
  const type = s.substring(0, k);
  return { type, modifiers, language };
}
const tokenClassificationRegistry = createDefaultTokenClassificationRegistry();
platform.Registry.add(Extensions.TokenClassificationContribution, tokenClassificationRegistry);
function createDefaultTokenClassificationRegistry() {
  const registry = new TokenClassificationRegistry();
  function registerTokenType(id, description, scopesToProbe = [], superType, deprecationMessage) {
    registry.registerTokenType(id, description, superType, deprecationMessage);
    if (scopesToProbe) {
      registerTokenStyleDefault(id, scopesToProbe);
    }
    return id;
  }
  function registerTokenStyleDefault(selectorString, scopesToProbe) {
    try {
      const selector = registry.parseTokenSelector(selectorString);
      registry.registerTokenStyleDefault(selector, { scopesToProbe });
    } catch (e) {
      console.log(e);
    }
  }
  registerTokenType("comment", nls.localize("comment", "Style for comments."), [["comment"]]);
  registerTokenType("string", nls.localize("string", "Style for strings."), [["string"]]);
  registerTokenType("keyword", nls.localize("keyword", "Style for keywords."), [["keyword.control"]]);
  registerTokenType("number", nls.localize("number", "Style for numbers."), [["constant.numeric"]]);
  registerTokenType("regexp", nls.localize("regexp", "Style for expressions."), [["constant.regexp"]]);
  registerTokenType("operator", nls.localize("operator", "Style for operators."), [["keyword.operator"]]);
  registerTokenType("namespace", nls.localize("namespace", "Style for namespaces."), [["entity.name.namespace"]]);
  registerTokenType("type", nls.localize("type", "Style for types."), [["entity.name.type"], ["support.type"]]);
  registerTokenType("struct", nls.localize("struct", "Style for structs."), [["entity.name.type.struct"]]);
  registerTokenType("class", nls.localize("class", "Style for classes."), [["entity.name.type.class"], ["support.class"]]);
  registerTokenType("interface", nls.localize("interface", "Style for interfaces."), [["entity.name.type.interface"]]);
  registerTokenType("enum", nls.localize("enum", "Style for enums."), [["entity.name.type.enum"]]);
  registerTokenType("typeParameter", nls.localize("typeParameter", "Style for type parameters."), [["entity.name.type.parameter"]]);
  registerTokenType("function", nls.localize("function", "Style for functions"), [["entity.name.function"], ["support.function"]]);
  registerTokenType("member", nls.localize("member", "Style for member functions"), [], "method", "Deprecated use `method` instead");
  registerTokenType("method", nls.localize("method", "Style for method (member functions)"), [["entity.name.function.member"], ["support.function"]]);
  registerTokenType("macro", nls.localize("macro", "Style for macros."), [["entity.name.function.preprocessor"]]);
  registerTokenType("variable", nls.localize("variable", "Style for variables."), [["variable.other.readwrite"], ["entity.name.variable"]]);
  registerTokenType("parameter", nls.localize("parameter", "Style for parameters."), [["variable.parameter"]]);
  registerTokenType("property", nls.localize("property", "Style for properties."), [["variable.other.property"]]);
  registerTokenType("enumMember", nls.localize("enumMember", "Style for enum members."), [["variable.other.enummember"]]);
  registerTokenType("event", nls.localize("event", "Style for events."), [["variable.other.event"]]);
  registerTokenType("decorator", nls.localize("decorator", "Style for decorators & annotations."), [["entity.name.decorator"], ["entity.name.function"]]);
  registerTokenType("label", nls.localize("labels", "Style for labels. "), void 0);
  registry.registerTokenModifier("declaration", nls.localize("declaration", "Style for all symbol declarations."), void 0);
  registry.registerTokenModifier("documentation", nls.localize("documentation", "Style to use for references in documentation."), void 0);
  registry.registerTokenModifier("static", nls.localize("static", "Style to use for symbols that are static."), void 0);
  registry.registerTokenModifier("abstract", nls.localize("abstract", "Style to use for symbols that are abstract."), void 0);
  registry.registerTokenModifier("deprecated", nls.localize("deprecated", "Style to use for symbols that are deprecated."), void 0);
  registry.registerTokenModifier("modification", nls.localize("modification", "Style to use for write accesses."), void 0);
  registry.registerTokenModifier("async", nls.localize("async", "Style to use for symbols that are async."), void 0);
  registry.registerTokenModifier("readonly", nls.localize("readonly", "Style to use for symbols that are read-only."), void 0);
  registerTokenStyleDefault("variable.readonly", [["variable.other.constant"]]);
  registerTokenStyleDefault("property.readonly", [["variable.other.constant.property"]]);
  registerTokenStyleDefault("type.defaultLibrary", [["support.type"]]);
  registerTokenStyleDefault("class.defaultLibrary", [["support.class"]]);
  registerTokenStyleDefault("interface.defaultLibrary", [["support.class"]]);
  registerTokenStyleDefault("variable.defaultLibrary", [["support.variable"], ["support.other.variable"]]);
  registerTokenStyleDefault("variable.defaultLibrary.readonly", [["support.constant"]]);
  registerTokenStyleDefault("property.defaultLibrary", [["support.variable.property"]]);
  registerTokenStyleDefault("property.defaultLibrary.readonly", [["support.constant.property"]]);
  registerTokenStyleDefault("function.defaultLibrary", [["support.function"]]);
  registerTokenStyleDefault("member.defaultLibrary", [["support.function"]]);
  return registry;
}
function getTokenClassificationRegistry() {
  return tokenClassificationRegistry;
}
function getStylingSchemeEntry(description, deprecationMessage) {
  return {
    description,
    deprecationMessage,
    defaultSnippets: [{ body: "${1:#ff0000}" }],
    anyOf: [
      {
        type: "string",
        format: "color-hex"
      },
      {
        $ref: "#/definitions/style"
      }
    ]
  };
}
const tokenStylingSchemaId = "vscode://schemas/token-styling";
const schemaRegistry = platform.Registry.as(JSONExtensions.JSONContribution);
schemaRegistry.registerSchema(tokenStylingSchemaId, tokenClassificationRegistry.getTokenStylingSchema());
const delayer = new RunOnceScheduler(() => schemaRegistry.notifySchemaChanged(tokenStylingSchemaId), 200);
tokenClassificationRegistry.onDidChangeSchema(() => {
  if (!delayer.isScheduled()) {
    delayer.schedule();
  }
});
export {
  SemanticTokenRule,
  TokenStyle,
  getTokenClassificationRegistry,
  parseClassifierString,
  tokenStylingSchemaId,
  typeAndModifierIdPattern
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90aGVtZS9jb21tb24vdG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY29sb3IuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSwgSUpTT05TY2hlbWFNYXAgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucyBhcyBKU09ORXh0ZW5zaW9ucywgSUpTT05Db250cmlidXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uL2pzb25zY2hlbWFzL2NvbW1vbi9qc29uQ29udHJpYnV0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElDb2xvclRoZW1lIH0gZnJvbSAnLi90aGVtZVNlcnZpY2UuanMnO1xuXG5jb25zdCBUT0tFTl9UWVBFX1dJTERDQVJEID0gJyonO1xuY29uc3QgVE9LRU5fQ0xBU1NJRklFUl9MQU5HVUFHRV9TRVBBUkFUT1IgPSAnOic7XG5jb25zdCBDTEFTU0lGSUVSX01PRElGSUVSX1NFUEFSQVRPUiA9ICcuJztcblxuLy8gcXVhbGlmaWVkIHN0cmluZyBbdHlwZXwqXSgubW9kaWZpZXIpKigvbGFuZ3VhZ2UpIVxudHlwZSBUb2tlbkNsYXNzaWZpY2F0aW9uU3RyaW5nID0gc3RyaW5nO1xuXG5jb25zdCBpZFBhdHRlcm4gPSAnXFxcXHcrWy1fXFxcXHcrXSonO1xuZXhwb3J0IGNvbnN0IHR5cGVBbmRNb2RpZmllcklkUGF0dGVybiA9IGBeJHtpZFBhdHRlcm59JGA7XG5cbmNvbnN0IHNlbGVjdG9yUGF0dGVybiA9IGBeKCR7aWRQYXR0ZXJufXxcXFxcKikoXFxcXCR7Q0xBU1NJRklFUl9NT0RJRklFUl9TRVBBUkFUT1J9JHtpZFBhdHRlcm59KSooJHtUT0tFTl9DTEFTU0lGSUVSX0xBTkdVQUdFX1NFUEFSQVRPUn0ke2lkUGF0dGVybn0pPyRgO1xuXG5jb25zdCBmb250U3R5bGVQYXR0ZXJuID0gJ14oXFxcXHMqKGl0YWxpY3xib2xkfHVuZGVybGluZXxzdHJpa2V0aHJvdWdoKSkqXFxcXHMqJCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVG9rZW5TZWxlY3RvciB7XG5cdG1hdGNoKHR5cGU6IHN0cmluZywgbW9kaWZpZXJzOiBzdHJpbmdbXSwgbGFuZ3VhZ2U6IHN0cmluZyk6IG51bWJlcjtcblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUb2tlblR5cGVPck1vZGlmaWVyQ29udHJpYnV0aW9uIHtcblx0cmVhZG9ubHkgbnVtOiBudW1iZXI7XG5cdHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHN1cGVyVHlwZT86IHN0cmluZztcblx0cmVhZG9ubHkgZGVzY3JpcHRpb246IHN0cmluZztcblx0cmVhZG9ubHkgZGVwcmVjYXRpb25NZXNzYWdlPzogc3RyaW5nO1xufVxuXG5cbmV4cG9ydCBpbnRlcmZhY2UgVG9rZW5TdHlsZURhdGEge1xuXHRmb3JlZ3JvdW5kOiBDb2xvciB8IHVuZGVmaW5lZDtcblx0Ym9sZDogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0dW5kZXJsaW5lOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRzdHJpa2V0aHJvdWdoOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRpdGFsaWM6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBUb2tlblN0eWxlIGltcGxlbWVudHMgUmVhZG9ubHk8VG9rZW5TdHlsZURhdGE+IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGZvcmVncm91bmQ6IENvbG9yIHwgdW5kZWZpbmVkLFxuXHRcdHB1YmxpYyByZWFkb25seSBib2xkOiBib29sZWFuIHwgdW5kZWZpbmVkLFxuXHRcdHB1YmxpYyByZWFkb25seSB1bmRlcmxpbmU6IGJvb2xlYW4gfCB1bmRlZmluZWQsXG5cdFx0cHVibGljIHJlYWRvbmx5IHN0cmlrZXRocm91Z2g6IGJvb2xlYW4gfCB1bmRlZmluZWQsXG5cdFx0cHVibGljIHJlYWRvbmx5IGl0YWxpYzogYm9vbGVhbiB8IHVuZGVmaW5lZCxcblx0KSB7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBUb2tlblN0eWxlIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIHRvSlNPTk9iamVjdChzdHlsZTogVG9rZW5TdHlsZSk6IGFueSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdF9mb3JlZ3JvdW5kOiBzdHlsZS5mb3JlZ3JvdW5kID09PSB1bmRlZmluZWQgPyBudWxsIDogQ29sb3IuRm9ybWF0LkNTUy5mb3JtYXRIZXhBKHN0eWxlLmZvcmVncm91bmQsIHRydWUpLFxuXHRcdFx0X2JvbGQ6IHN0eWxlLmJvbGQgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBzdHlsZS5ib2xkLFxuXHRcdFx0X3VuZGVybGluZTogc3R5bGUudW5kZXJsaW5lID09PSB1bmRlZmluZWQgPyBudWxsIDogc3R5bGUudW5kZXJsaW5lLFxuXHRcdFx0X2l0YWxpYzogc3R5bGUuaXRhbGljID09PSB1bmRlZmluZWQgPyBudWxsIDogc3R5bGUuaXRhbGljLFxuXHRcdFx0X3N0cmlrZXRocm91Z2g6IHN0eWxlLnN0cmlrZXRocm91Z2ggPT09IHVuZGVmaW5lZCA/IG51bGwgOiBzdHlsZS5zdHJpa2V0aHJvdWdoLFxuXHRcdH07XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb21KU09OT2JqZWN0KG9iajogYW55KTogVG9rZW5TdHlsZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKG9iaikge1xuXHRcdFx0Y29uc3QgYm9vbE9yVW5kZWYgPSAoYjogYW55KSA9PiAodHlwZW9mIGIgPT09ICdib29sZWFuJykgPyBiIDogdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgY29sb3JPclVuZGVmID0gKHM6IGFueSkgPT4gKHR5cGVvZiBzID09PSAnc3RyaW5nJykgPyBDb2xvci5mcm9tSGV4KHMpIDogdW5kZWZpbmVkO1xuXHRcdFx0cmV0dXJuIG5ldyBUb2tlblN0eWxlKFxuXHRcdFx0XHRjb2xvck9yVW5kZWYob2JqLl9mb3JlZ3JvdW5kKSxcblx0XHRcdFx0Ym9vbE9yVW5kZWYob2JqLl9ib2xkKSxcblx0XHRcdFx0Ym9vbE9yVW5kZWYob2JqLl91bmRlcmxpbmUpLFxuXHRcdFx0XHRib29sT3JVbmRlZihvYmouX3N0cmlrZXRocm91Z2gpLFxuXHRcdFx0XHRib29sT3JVbmRlZihvYmouX2l0YWxpYylcblx0XHRcdCk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIGVxdWFscyhzMTogYW55LCBzMjogYW55KTogYm9vbGVhbiB7XG5cdFx0aWYgKHMxID09PSBzMikge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBzMSAhPT0gdW5kZWZpbmVkICYmIHMyICE9PSB1bmRlZmluZWRcblx0XHRcdCYmIChzMS5mb3JlZ3JvdW5kIGluc3RhbmNlb2YgQ29sb3IgPyBzMS5mb3JlZ3JvdW5kLmVxdWFscyhzMi5mb3JlZ3JvdW5kKSA6IHMyLmZvcmVncm91bmQgPT09IHVuZGVmaW5lZClcblx0XHRcdCYmIHMxLmJvbGQgPT09IHMyLmJvbGRcblx0XHRcdCYmIHMxLnVuZGVybGluZSA9PT0gczIudW5kZXJsaW5lXG5cdFx0XHQmJiBzMS5zdHJpa2V0aHJvdWdoID09PSBzMi5zdHJpa2V0aHJvdWdoXG5cdFx0XHQmJiBzMS5pdGFsaWMgPT09IHMyLml0YWxpYztcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gaXMoczogYW55KTogcyBpcyBUb2tlblN0eWxlIHtcblx0XHRyZXR1cm4gcyBpbnN0YW5jZW9mIFRva2VuU3R5bGU7XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb21EYXRhKGRhdGE6IHsgZm9yZWdyb3VuZDogQ29sb3IgfCB1bmRlZmluZWQ7IGJvbGQ6IGJvb2xlYW4gfCB1bmRlZmluZWQ7IHVuZGVybGluZTogYm9vbGVhbiB8IHVuZGVmaW5lZDsgc3RyaWtldGhyb3VnaDogYm9vbGVhbiB8IHVuZGVmaW5lZDsgaXRhbGljOiBib29sZWFuIHwgdW5kZWZpbmVkIH0pOiBUb2tlblN0eWxlIHtcblx0XHRyZXR1cm4gbmV3IFRva2VuU3R5bGUoZGF0YS5mb3JlZ3JvdW5kLCBkYXRhLmJvbGQsIGRhdGEudW5kZXJsaW5lLCBkYXRhLnN0cmlrZXRocm91Z2gsIGRhdGEuaXRhbGljKTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbVNldHRpbmdzKGZvcmVncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgZm9udFN0eWxlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBUb2tlblN0eWxlO1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbVNldHRpbmdzKGZvcmVncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgZm9udFN0eWxlOiBzdHJpbmcgfCB1bmRlZmluZWQsIGJvbGQ6IGJvb2xlYW4gfCB1bmRlZmluZWQsIHVuZGVybGluZTogYm9vbGVhbiB8IHVuZGVmaW5lZCwgc3RyaWtldGhyb3VnaDogYm9vbGVhbiB8IHVuZGVmaW5lZCwgaXRhbGljOiBib29sZWFuIHwgdW5kZWZpbmVkKTogVG9rZW5TdHlsZTtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb21TZXR0aW5ncyhmb3JlZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQsIGZvbnRTdHlsZTogc3RyaW5nIHwgdW5kZWZpbmVkLCBib2xkPzogYm9vbGVhbiwgdW5kZXJsaW5lPzogYm9vbGVhbiwgc3RyaWtldGhyb3VnaD86IGJvb2xlYW4sIGl0YWxpYz86IGJvb2xlYW4pOiBUb2tlblN0eWxlIHtcblx0XHRsZXQgZm9yZWdyb3VuZENvbG9yID0gdW5kZWZpbmVkO1xuXHRcdGlmIChmb3JlZ3JvdW5kICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGZvcmVncm91bmRDb2xvciA9IENvbG9yLmZyb21IZXgoZm9yZWdyb3VuZCk7XG5cdFx0fVxuXHRcdGlmIChmb250U3R5bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Ym9sZCA9IGl0YWxpYyA9IHVuZGVybGluZSA9IHN0cmlrZXRocm91Z2ggPSBmYWxzZTtcblx0XHRcdGNvbnN0IGV4cHJlc3Npb24gPSAvaXRhbGljfGJvbGR8dW5kZXJsaW5lfHN0cmlrZXRocm91Z2gvZztcblx0XHRcdGxldCBtYXRjaDtcblx0XHRcdHdoaWxlICgobWF0Y2ggPSBleHByZXNzaW9uLmV4ZWMoZm9udFN0eWxlKSkpIHtcblx0XHRcdFx0c3dpdGNoIChtYXRjaFswXSkge1xuXHRcdFx0XHRcdGNhc2UgJ2JvbGQnOiBib2xkID0gdHJ1ZTsgYnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnaXRhbGljJzogaXRhbGljID0gdHJ1ZTsgYnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAndW5kZXJsaW5lJzogdW5kZXJsaW5lID0gdHJ1ZTsgYnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnc3RyaWtldGhyb3VnaCc6IHN0cmlrZXRocm91Z2ggPSB0cnVlOyBicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFRva2VuU3R5bGUoZm9yZWdyb3VuZENvbG9yLCBib2xkLCB1bmRlcmxpbmUsIHN0cmlrZXRocm91Z2gsIGl0YWxpYyk7XG5cdH1cbn1cblxuZXhwb3J0IHR5cGUgUHJvYmVTY29wZSA9IHN0cmluZ1tdO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRva2VuU3R5bGVGdW5jdGlvbiB7XG5cdCh0aGVtZTogSUNvbG9yVGhlbWUpOiBUb2tlblN0eWxlIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRva2VuU3R5bGVEZWZhdWx0cyB7XG5cdHNjb3Blc1RvUHJvYmU/OiBQcm9iZVNjb3BlW107XG5cdGxpZ2h0PzogVG9rZW5TdHlsZVZhbHVlO1xuXHRkYXJrPzogVG9rZW5TdHlsZVZhbHVlO1xuXHRoY0Rhcms/OiBUb2tlblN0eWxlVmFsdWU7XG5cdGhjTGlnaHQ/OiBUb2tlblN0eWxlVmFsdWU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VtYW50aWNUb2tlbkRlZmF1bHRSdWxlIHtcblx0c2VsZWN0b3I6IFRva2VuU2VsZWN0b3I7XG5cdGRlZmF1bHRzOiBUb2tlblN0eWxlRGVmYXVsdHM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VtYW50aWNUb2tlblJ1bGUge1xuXHRzdHlsZTogVG9rZW5TdHlsZTtcblx0c2VsZWN0b3I6IFRva2VuU2VsZWN0b3I7XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgU2VtYW50aWNUb2tlblJ1bGUge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbUpTT05PYmplY3QocmVnaXN0cnk6IElUb2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnksIG86IGFueSk6IFNlbWFudGljVG9rZW5SdWxlIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAobyAmJiB0eXBlb2Ygby5fc2VsZWN0b3IgPT09ICdzdHJpbmcnICYmIG8uX3N0eWxlKSB7XG5cdFx0XHRjb25zdCBzdHlsZSA9IFRva2VuU3R5bGUuZnJvbUpTT05PYmplY3Qoby5fc3R5bGUpO1xuXHRcdFx0aWYgKHN0eWxlKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgc2VsZWN0b3I6IHJlZ2lzdHJ5LnBhcnNlVG9rZW5TZWxlY3RvcihvLl9zZWxlY3RvciksIHN0eWxlIH07XG5cdFx0XHRcdH0gY2F0Y2ggKF9pZ25vcmUpIHtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiB0b0pTT05PYmplY3QocnVsZTogU2VtYW50aWNUb2tlblJ1bGUpOiBhbnkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRfc2VsZWN0b3I6IHJ1bGUuc2VsZWN0b3IuaWQsXG5cdFx0XHRfc3R5bGU6IFRva2VuU3R5bGUudG9KU09OT2JqZWN0KHJ1bGUuc3R5bGUpXG5cdFx0fTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gZXF1YWxzKHIxOiBTZW1hbnRpY1Rva2VuUnVsZSB8IHVuZGVmaW5lZCwgcjI6IFNlbWFudGljVG9rZW5SdWxlIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHIxID09PSByMikge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiByMSAhPT0gdW5kZWZpbmVkICYmIHIyICE9PSB1bmRlZmluZWRcblx0XHRcdCYmIHIxLnNlbGVjdG9yICYmIHIyLnNlbGVjdG9yICYmIHIxLnNlbGVjdG9yLmlkID09PSByMi5zZWxlY3Rvci5pZFxuXHRcdFx0JiYgVG9rZW5TdHlsZS5lcXVhbHMocjEuc3R5bGUsIHIyLnN0eWxlKTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gaXMocjogYW55KTogciBpcyBTZW1hbnRpY1Rva2VuUnVsZSB7XG5cdFx0cmV0dXJuIHIgJiYgci5zZWxlY3RvciAmJiB0eXBlb2Ygci5zZWxlY3Rvci5pZCA9PT0gJ3N0cmluZycgJiYgVG9rZW5TdHlsZS5pcyhyLnN0eWxlKTtcblx0fVxufVxuXG4vKipcbiAqIEEgVG9rZW5TdHlsZSBWYWx1ZSBpcyBlaXRoZXIgYSB0b2tlbiBzdHlsZSBsaXRlcmFsLCBvciBhIFRva2VuQ2xhc3NpZmljYXRpb25TdHJpbmdcbiAqL1xuZXhwb3J0IHR5cGUgVG9rZW5TdHlsZVZhbHVlID0gVG9rZW5TdHlsZSB8IFRva2VuQ2xhc3NpZmljYXRpb25TdHJpbmc7XG5cbi8vIFRva2VuU3R5bGUgcmVnaXN0cnlcbmNvbnN0IEV4dGVuc2lvbnMgPSB7XG5cdFRva2VuQ2xhc3NpZmljYXRpb25Db250cmlidXRpb246ICdiYXNlLmNvbnRyaWJ1dGlvbnMudG9rZW5DbGFzc2lmaWNhdGlvbidcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeSB7XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTY2hlbWE6IEV2ZW50PHZvaWQ+O1xuXG5cdC8qKlxuXHQgKiBSZWdpc3RlciBhIHRva2VuIHR5cGUgdG8gdGhlIHJlZ2lzdHJ5LlxuXHQgKiBAcGFyYW0gaWQgVGhlIFRva2VuVHlwZSBpZCBhcyB1c2VkIGluIHRoZW1lIGRlc2NyaXB0aW9uIGZpbGVzXG5cdCAqIEBwYXJhbSBkZXNjcmlwdGlvbiB0aGUgZGVzY3JpcHRpb25cblx0ICovXG5cdHJlZ2lzdGVyVG9rZW5UeXBlKGlkOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcsIHN1cGVyVHlwZT86IHN0cmluZywgZGVwcmVjYXRpb25NZXNzYWdlPzogc3RyaW5nKTogdm9pZDtcblxuXHQvKipcblx0ICogUmVnaXN0ZXIgYSB0b2tlbiBtb2RpZmllciB0byB0aGUgcmVnaXN0cnkuXG5cdCAqIEBwYXJhbSBpZCBUaGUgVG9rZW5Nb2RpZmllciBpZCBhcyB1c2VkIGluIHRoZW1lIGRlc2NyaXB0aW9uIGZpbGVzXG5cdCAqIEBwYXJhbSBkZXNjcmlwdGlvbiB0aGUgZGVzY3JpcHRpb25cblx0ICovXG5cdHJlZ2lzdGVyVG9rZW5Nb2RpZmllcihpZDogc3RyaW5nLCBkZXNjcmlwdGlvbjogc3RyaW5nKTogdm9pZDtcblxuXHQvKipcblx0ICogUGFyc2VzIGEgdG9rZW4gc2VsZWN0b3IgZnJvbSBhIHNlbGVjdG9yIHN0cmluZy5cblx0ICogQHBhcmFtIHNlbGVjdG9yU3RyaW5nIHNlbGVjdG9yIHN0cmluZyBpbiB0aGUgZm9ybSAoKnx0eXBlKSgubW9kaWZpZXIpKlxuXHQgKiBAcGFyYW0gbGFuZ3VhZ2UgbGFuZ3VhZ2UgdG8gd2hpY2ggdGhlIHNlbGVjdG9yIGFwcGxpZXMgb3IgdW5kZWZpbmVkIGlmIHRoZSBzZWxlY3RvciBpcyBmb3IgYWxsIGxhbmd1YWZlXG5cdCAqIEByZXR1cm5zIHRoZSBwYXJzZXNkIHNlbGVjdG9yXG5cdCAqIEB0aHJvd3MgYW4gZXJyb3IgaWYgdGhlIHN0cmluZyBpcyBub3QgYSB2YWxpZCBzZWxlY3RvclxuXHQgKi9cblx0cGFyc2VUb2tlblNlbGVjdG9yKHNlbGVjdG9yU3RyaW5nOiBzdHJpbmcsIGxhbmd1YWdlPzogc3RyaW5nKTogVG9rZW5TZWxlY3RvcjtcblxuXHQvKipcblx0ICogUmVnaXN0ZXIgYSBUb2tlblN0eWxlIGRlZmF1bHQgdG8gdGhlIHJlZ2lzdHJ5LlxuXHQgKiBAcGFyYW0gc2VsZWN0b3IgVGhlIHJ1bGUgc2VsZWN0b3Jcblx0ICogQHBhcmFtIGRlZmF1bHRzIFRoZSBkZWZhdWx0IHZhbHVlc1xuXHQgKi9cblx0cmVnaXN0ZXJUb2tlblN0eWxlRGVmYXVsdChzZWxlY3RvcjogVG9rZW5TZWxlY3RvciwgZGVmYXVsdHM6IFRva2VuU3R5bGVEZWZhdWx0cyk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIERlcmVnaXN0ZXIgYSBUb2tlblN0eWxlIGRlZmF1bHQgdG8gdGhlIHJlZ2lzdHJ5LlxuXHQgKiBAcGFyYW0gc2VsZWN0b3IgVGhlIHJ1bGUgc2VsZWN0b3Jcblx0ICovXG5cdGRlcmVnaXN0ZXJUb2tlblN0eWxlRGVmYXVsdChzZWxlY3RvcjogVG9rZW5TZWxlY3Rvcik6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIERlcmVnaXN0ZXIgYSBUb2tlblR5cGUgZnJvbSB0aGUgcmVnaXN0cnkuXG5cdCAqL1xuXHRkZXJlZ2lzdGVyVG9rZW5UeXBlKGlkOiBzdHJpbmcpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBEZXJlZ2lzdGVyIGEgVG9rZW5Nb2RpZmllciBmcm9tIHRoZSByZWdpc3RyeS5cblx0ICovXG5cdGRlcmVnaXN0ZXJUb2tlbk1vZGlmaWVyKGlkOiBzdHJpbmcpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBHZXQgYWxsIFRva2VuVHlwZSBjb250cmlidXRpb25zXG5cdCAqL1xuXHRnZXRUb2tlblR5cGVzKCk6IFRva2VuVHlwZU9yTW9kaWZpZXJDb250cmlidXRpb25bXTtcblxuXHQvKipcblx0ICogR2V0IGFsbCBUb2tlbk1vZGlmaWVyIGNvbnRyaWJ1dGlvbnNcblx0ICovXG5cdGdldFRva2VuTW9kaWZpZXJzKCk6IFRva2VuVHlwZU9yTW9kaWZpZXJDb250cmlidXRpb25bXTtcblxuXHQvKipcblx0ICogVGhlIHN0eWxpbmcgcnVsZXMgdG8gdXNlZCB3aGVuIGEgc2NoZW1hIGRvZXMgbm90IGRlZmluZSBhbnkgc3R5bGluZyBydWxlcy5cblx0ICovXG5cdGdldFRva2VuU3R5bGluZ0RlZmF1bHRSdWxlcygpOiBTZW1hbnRpY1Rva2VuRGVmYXVsdFJ1bGVbXTtcblxuXHQvKipcblx0ICogSlNPTiBzY2hlbWEgZm9yIGFuIG9iamVjdCB0byBhc3NpZ24gc3R5bGluZyB0byB0b2tlbiBjbGFzc2lmaWNhdGlvbnNcblx0ICovXG5cdGdldFRva2VuU3R5bGluZ1NjaGVtYSgpOiBJSlNPTlNjaGVtYTtcbn1cblxuY2xhc3MgVG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5IGltcGxlbWVudHMgSVRva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTY2hlbWEgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVNjaGVtYTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZVNjaGVtYS5ldmVudDtcblxuXHRwcml2YXRlIGN1cnJlbnRUeXBlTnVtYmVyID0gMDtcblx0cHJpdmF0ZSBjdXJyZW50TW9kaWZpZXJCaXQgPSAxO1xuXG5cdHByaXZhdGUgdG9rZW5UeXBlQnlJZDogeyBba2V5OiBzdHJpbmddOiBUb2tlblR5cGVPck1vZGlmaWVyQ29udHJpYnV0aW9uIH07XG5cdHByaXZhdGUgdG9rZW5Nb2RpZmllckJ5SWQ6IHsgW2tleTogc3RyaW5nXTogVG9rZW5UeXBlT3JNb2RpZmllckNvbnRyaWJ1dGlvbiB9O1xuXG5cdHByaXZhdGUgdG9rZW5TdHlsaW5nRGVmYXVsdFJ1bGVzOiBTZW1hbnRpY1Rva2VuRGVmYXVsdFJ1bGVbXSA9IFtdO1xuXG5cdHByaXZhdGUgdHlwZUhpZXJhcmNoeTogeyBbaWQ6IHN0cmluZ106IHN0cmluZ1tdIH07XG5cblx0cHJpdmF0ZSB0b2tlblN0eWxpbmdTY2hlbWE6IElKU09OU2NoZW1hICYgeyBwcm9wZXJ0aWVzOiBJSlNPTlNjaGVtYU1hcDsgcGF0dGVyblByb3BlcnRpZXM6IElKU09OU2NoZW1hTWFwIH0gPSB7XG5cdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0cHJvcGVydGllczoge30sXG5cdFx0cGF0dGVyblByb3BlcnRpZXM6IHtcblx0XHRcdFtzZWxlY3RvclBhdHRlcm5dOiBnZXRTdHlsaW5nU2NoZW1lRW50cnkoKVxuXHRcdH0sXG5cdFx0Ly9lcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnc2NoZW1hLnRva2VuLmVycm9ycycsICdWYWxpZCB0b2tlbiBzZWxlY3RvcnMgaGF2ZSB0aGUgZm9ybSAoKnx0b2tlblR5cGUpKC50b2tlbk1vZGlmaWVyKSooOnRva2VuTGFuZ3VhZ2UpPy4nKSxcblx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0ZGVmaW5pdGlvbnM6IHtcblx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEudG9rZW4uc2V0dGluZ3MnLCAnQ29sb3JzIGFuZCBzdHlsZXMgZm9yIHRoZSB0b2tlbi4nKSxcblx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdGZvcmVncm91bmQ6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLnRva2VuLmZvcmVncm91bmQnLCAnRm9yZWdyb3VuZCBjb2xvciBmb3IgdGhlIHRva2VuLicpLFxuXHRcdFx0XHRcdFx0Zm9ybWF0OiAnY29sb3ItaGV4Jyxcblx0XHRcdFx0XHRcdGRlZmF1bHQ6ICcjZmYwMDAwJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0YmFja2dyb3VuZDoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXByZWNhdGlvbk1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnc2NoZW1hLnRva2VuLmJhY2tncm91bmQud2FybmluZycsICdUb2tlbiBiYWNrZ3JvdW5kIGNvbG9ycyBhcmUgY3VycmVudGx5IG5vdCBzdXBwb3J0ZWQuJylcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGZvbnRTdHlsZToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEudG9rZW4uZm9udFN0eWxlJywgJ1NldHMgdGhlIGFsbCBmb250IHN0eWxlcyBvZiB0aGUgcnVsZTogXFwnaXRhbGljXFwnLCBcXCdib2xkXFwnLCBcXCd1bmRlcmxpbmVcXCcgb3IgXFwnc3RyaWtldGhyb3VnaFxcJyBvciBhIGNvbWJpbmF0aW9uLiBBbGwgc3R5bGVzIHRoYXQgYXJlIG5vdCBsaXN0ZWQgYXJlIHVuc2V0LiBUaGUgZW1wdHkgc3RyaW5nIHVuc2V0cyBhbGwgc3R5bGVzLicpLFxuXHRcdFx0XHRcdFx0cGF0dGVybjogZm9udFN0eWxlUGF0dGVybixcblx0XHRcdFx0XHRcdHBhdHRlcm5FcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZvbnRTdHlsZS5lcnJvcicsICdGb250IHN0eWxlIG11c3QgYmUgXFwnaXRhbGljXFwnLCBcXCdib2xkXFwnLCBcXCd1bmRlcmxpbmVcXCcgb3IgXFwnc3RyaWtldGhyb3VnaFxcJyBvciBhIGNvbWJpbmF0aW9uLiBUaGUgZW1wdHkgc3RyaW5nIHVuc2V0cyBhbGwgc3R5bGVzLicpLFxuXHRcdFx0XHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbXG5cdFx0XHRcdFx0XHRcdHsgbGFiZWw6IG5scy5sb2NhbGl6ZSgnc2NoZW1hLnRva2VuLmZvbnRTdHlsZS5ub25lJywgJ05vbmUgKGNsZWFyIGluaGVyaXRlZCBzdHlsZSknKSwgYm9keVRleHQ6ICdcIlwiJyB9LFxuXHRcdFx0XHRcdFx0XHR7IGJvZHk6ICdpdGFsaWMnIH0sXG5cdFx0XHRcdFx0XHRcdHsgYm9keTogJ2JvbGQnIH0sXG5cdFx0XHRcdFx0XHRcdHsgYm9keTogJ3VuZGVybGluZScgfSxcblx0XHRcdFx0XHRcdFx0eyBib2R5OiAnc3RyaWtldGhyb3VnaCcgfSxcblx0XHRcdFx0XHRcdFx0eyBib2R5OiAnaXRhbGljIGJvbGQnIH0sXG5cdFx0XHRcdFx0XHRcdHsgYm9keTogJ2l0YWxpYyB1bmRlcmxpbmUnIH0sXG5cdFx0XHRcdFx0XHRcdHsgYm9keTogJ2l0YWxpYyBzdHJpa2V0aHJvdWdoJyB9LFxuXHRcdFx0XHRcdFx0XHR7IGJvZHk6ICdib2xkIHVuZGVybGluZScgfSxcblx0XHRcdFx0XHRcdFx0eyBib2R5OiAnYm9sZCBzdHJpa2V0aHJvdWdoJyB9LFxuXHRcdFx0XHRcdFx0XHR7IGJvZHk6ICd1bmRlcmxpbmUgc3RyaWtldGhyb3VnaCcgfSxcblx0XHRcdFx0XHRcdFx0eyBib2R5OiAnaXRhbGljIGJvbGQgdW5kZXJsaW5lJyB9LFxuXHRcdFx0XHRcdFx0XHR7IGJvZHk6ICdpdGFsaWMgYm9sZCBzdHJpa2V0aHJvdWdoJyB9LFxuXHRcdFx0XHRcdFx0XHR7IGJvZHk6ICdpdGFsaWMgdW5kZXJsaW5lIHN0cmlrZXRocm91Z2gnIH0sXG5cdFx0XHRcdFx0XHRcdHsgYm9keTogJ2JvbGQgdW5kZXJsaW5lIHN0cmlrZXRocm91Z2gnIH0sXG5cdFx0XHRcdFx0XHRcdHsgYm9keTogJ2l0YWxpYyBib2xkIHVuZGVybGluZSBzdHJpa2V0aHJvdWdoJyB9XG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRib2xkOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEudG9rZW4uYm9sZCcsICdTZXRzIG9yIHVuc2V0cyB0aGUgZm9udCBzdHlsZSB0byBib2xkLiBOb3RlLCB0aGUgcHJlc2VuY2Ugb2YgXFwnZm9udFN0eWxlXFwnIG92ZXJyaWRlcyB0aGlzIHNldHRpbmcuJyksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRpdGFsaWM6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS50b2tlbi5pdGFsaWMnLCAnU2V0cyBvciB1bnNldHMgdGhlIGZvbnQgc3R5bGUgdG8gaXRhbGljLiBOb3RlLCB0aGUgcHJlc2VuY2Ugb2YgXFwnZm9udFN0eWxlXFwnIG92ZXJyaWRlcyB0aGlzIHNldHRpbmcuJyksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR1bmRlcmxpbmU6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS50b2tlbi51bmRlcmxpbmUnLCAnU2V0cyBvciB1bnNldHMgdGhlIGZvbnQgc3R5bGUgdG8gdW5kZXJsaW5lLiBOb3RlLCB0aGUgcHJlc2VuY2Ugb2YgXFwnZm9udFN0eWxlXFwnIG92ZXJyaWRlcyB0aGlzIHNldHRpbmcuJyksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzdHJpa2V0aHJvdWdoOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEudG9rZW4uc3RyaWtldGhyb3VnaCcsICdTZXRzIG9yIHVuc2V0cyB0aGUgZm9udCBzdHlsZSB0byBzdHJpa2V0aHJvdWdoLiBOb3RlLCB0aGUgcHJlc2VuY2Ugb2YgXFwnZm9udFN0eWxlXFwnIG92ZXJyaWRlcyB0aGlzIHNldHRpbmcuJyksXG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBmb3JlZ3JvdW5kOiAnJHsxOiNGRjAwMDB9JywgZm9udFN0eWxlOiAnJHsyOmJvbGR9JyB9IH1dXG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMudG9rZW5UeXBlQnlJZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0dGhpcy50b2tlbk1vZGlmaWVyQnlJZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0dGhpcy50eXBlSGllcmFyY2h5ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlclRva2VuVHlwZShpZDogc3RyaW5nLCBkZXNjcmlwdGlvbjogc3RyaW5nLCBzdXBlclR5cGU/OiBzdHJpbmcsIGRlcHJlY2F0aW9uTWVzc2FnZT86IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICghaWQubWF0Y2godHlwZUFuZE1vZGlmaWVySWRQYXR0ZXJuKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHRva2VuIHR5cGUgaWQuJyk7XG5cdFx0fVxuXHRcdGlmIChzdXBlclR5cGUgJiYgIXN1cGVyVHlwZS5tYXRjaCh0eXBlQW5kTW9kaWZpZXJJZFBhdHRlcm4pKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdG9rZW4gc3VwZXIgdHlwZSBpZC4nKTtcblx0XHR9XG5cblx0XHRjb25zdCBudW0gPSB0aGlzLmN1cnJlbnRUeXBlTnVtYmVyKys7XG5cdFx0Y29uc3QgdG9rZW5TdHlsZUNvbnRyaWJ1dGlvbjogVG9rZW5UeXBlT3JNb2RpZmllckNvbnRyaWJ1dGlvbiA9IHsgbnVtLCBpZCwgc3VwZXJUeXBlLCBkZXNjcmlwdGlvbiwgZGVwcmVjYXRpb25NZXNzYWdlIH07XG5cdFx0dGhpcy50b2tlblR5cGVCeUlkW2lkXSA9IHRva2VuU3R5bGVDb250cmlidXRpb247XG5cblx0XHRjb25zdCBzdHlsaW5nU2NoZW1lRW50cnkgPSBnZXRTdHlsaW5nU2NoZW1lRW50cnkoZGVzY3JpcHRpb24sIGRlcHJlY2F0aW9uTWVzc2FnZSk7XG5cdFx0dGhpcy50b2tlblN0eWxpbmdTY2hlbWEucHJvcGVydGllc1tpZF0gPSBzdHlsaW5nU2NoZW1lRW50cnk7XG5cdFx0dGhpcy50eXBlSGllcmFyY2h5ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlclRva2VuTW9kaWZpZXIoaWQ6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZywgZGVwcmVjYXRpb25NZXNzYWdlPzogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCFpZC5tYXRjaCh0eXBlQW5kTW9kaWZpZXJJZFBhdHRlcm4pKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdG9rZW4gbW9kaWZpZXIgaWQuJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbnVtID0gdGhpcy5jdXJyZW50TW9kaWZpZXJCaXQ7XG5cdFx0dGhpcy5jdXJyZW50TW9kaWZpZXJCaXQgPSB0aGlzLmN1cnJlbnRNb2RpZmllckJpdCAqIDI7XG5cdFx0Y29uc3QgdG9rZW5TdHlsZUNvbnRyaWJ1dGlvbjogVG9rZW5UeXBlT3JNb2RpZmllckNvbnRyaWJ1dGlvbiA9IHsgbnVtLCBpZCwgZGVzY3JpcHRpb24sIGRlcHJlY2F0aW9uTWVzc2FnZSB9O1xuXHRcdHRoaXMudG9rZW5Nb2RpZmllckJ5SWRbaWRdID0gdG9rZW5TdHlsZUNvbnRyaWJ1dGlvbjtcblxuXHRcdHRoaXMudG9rZW5TdHlsaW5nU2NoZW1hLnByb3BlcnRpZXNbYCouJHtpZH1gXSA9IGdldFN0eWxpbmdTY2hlbWVFbnRyeShkZXNjcmlwdGlvbiwgZGVwcmVjYXRpb25NZXNzYWdlKTtcblx0fVxuXG5cdHB1YmxpYyBwYXJzZVRva2VuU2VsZWN0b3Ioc2VsZWN0b3JTdHJpbmc6IHN0cmluZywgbGFuZ3VhZ2U/OiBzdHJpbmcpOiBUb2tlblNlbGVjdG9yIHtcblx0XHRjb25zdCBzZWxlY3RvciA9IHBhcnNlQ2xhc3NpZmllclN0cmluZyhzZWxlY3RvclN0cmluZywgbGFuZ3VhZ2UpO1xuXG5cdFx0aWYgKCFzZWxlY3Rvci50eXBlKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRtYXRjaDogKCkgPT4gLTEsXG5cdFx0XHRcdGlkOiAnJGludmFsaWQnXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRtYXRjaDogKHR5cGU6IHN0cmluZywgbW9kaWZpZXJzOiBzdHJpbmdbXSwgbGFuZ3VhZ2U6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRsZXQgc2NvcmUgPSAwO1xuXHRcdFx0XHRpZiAoc2VsZWN0b3IubGFuZ3VhZ2UgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGlmIChzZWxlY3Rvci5sYW5ndWFnZSAhPT0gbGFuZ3VhZ2UpIHtcblx0XHRcdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c2NvcmUgKz0gMTA7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHNlbGVjdG9yLnR5cGUgIT09IFRPS0VOX1RZUEVfV0lMRENBUkQpIHtcblx0XHRcdFx0XHRjb25zdCBoaWVyYXJjaHkgPSB0aGlzLmdldFR5cGVIaWVyYXJjaHkodHlwZSk7XG5cdFx0XHRcdFx0Y29uc3QgbGV2ZWwgPSBoaWVyYXJjaHkuaW5kZXhPZihzZWxlY3Rvci50eXBlKTtcblx0XHRcdFx0XHRpZiAobGV2ZWwgPT09IC0xKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHNjb3JlICs9ICgxMDAgLSBsZXZlbCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gYWxsIHNlbGVjdG9yIG1vZGlmaWVycyBtdXN0IGJlIHByZXNlbnRcblx0XHRcdFx0Zm9yIChjb25zdCBzZWxlY3Rvck1vZGlmaWVyIG9mIHNlbGVjdG9yLm1vZGlmaWVycykge1xuXHRcdFx0XHRcdGlmIChtb2RpZmllcnMuaW5kZXhPZihzZWxlY3Rvck1vZGlmaWVyKSA9PT0gLTEpIHtcblx0XHRcdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHNjb3JlICsgc2VsZWN0b3IubW9kaWZpZXJzLmxlbmd0aCAqIDEwMDtcblx0XHRcdH0sXG5cdFx0XHRpZDogYCR7W3NlbGVjdG9yLnR5cGUsIC4uLnNlbGVjdG9yLm1vZGlmaWVycy5zb3J0KCldLmpvaW4oJy4nKX0ke3NlbGVjdG9yLmxhbmd1YWdlICE9PSB1bmRlZmluZWQgPyAnOicgKyBzZWxlY3Rvci5sYW5ndWFnZSA6ICcnfWBcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIHJlZ2lzdGVyVG9rZW5TdHlsZURlZmF1bHQoc2VsZWN0b3I6IFRva2VuU2VsZWN0b3IsIGRlZmF1bHRzOiBUb2tlblN0eWxlRGVmYXVsdHMpOiB2b2lkIHtcblx0XHR0aGlzLnRva2VuU3R5bGluZ0RlZmF1bHRSdWxlcy5wdXNoKHsgc2VsZWN0b3IsIGRlZmF1bHRzIH0pO1xuXHR9XG5cblx0cHVibGljIGRlcmVnaXN0ZXJUb2tlblN0eWxlRGVmYXVsdChzZWxlY3RvcjogVG9rZW5TZWxlY3Rvcik6IHZvaWQge1xuXHRcdGNvbnN0IHNlbGVjdG9yU3RyaW5nID0gc2VsZWN0b3IuaWQ7XG5cdFx0dGhpcy50b2tlblN0eWxpbmdEZWZhdWx0UnVsZXMgPSB0aGlzLnRva2VuU3R5bGluZ0RlZmF1bHRSdWxlcy5maWx0ZXIociA9PiByLnNlbGVjdG9yLmlkICE9PSBzZWxlY3RvclN0cmluZyk7XG5cdH1cblxuXHRwdWJsaWMgZGVyZWdpc3RlclRva2VuVHlwZShpZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0ZGVsZXRlIHRoaXMudG9rZW5UeXBlQnlJZFtpZF07XG5cdFx0ZGVsZXRlIHRoaXMudG9rZW5TdHlsaW5nU2NoZW1hLnByb3BlcnRpZXNbaWRdO1xuXHRcdHRoaXMudHlwZUhpZXJhcmNoeSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdH1cblxuXHRwdWJsaWMgZGVyZWdpc3RlclRva2VuTW9kaWZpZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGRlbGV0ZSB0aGlzLnRva2VuTW9kaWZpZXJCeUlkW2lkXTtcblx0XHRkZWxldGUgdGhpcy50b2tlblN0eWxpbmdTY2hlbWEucHJvcGVydGllc1tgKi4ke2lkfWBdO1xuXHR9XG5cblx0cHVibGljIGdldFRva2VuVHlwZXMoKTogVG9rZW5UeXBlT3JNb2RpZmllckNvbnRyaWJ1dGlvbltdIHtcblx0XHRyZXR1cm4gT2JqZWN0LmtleXModGhpcy50b2tlblR5cGVCeUlkKS5tYXAoaWQgPT4gdGhpcy50b2tlblR5cGVCeUlkW2lkXSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VG9rZW5Nb2RpZmllcnMoKTogVG9rZW5UeXBlT3JNb2RpZmllckNvbnRyaWJ1dGlvbltdIHtcblx0XHRyZXR1cm4gT2JqZWN0LmtleXModGhpcy50b2tlbk1vZGlmaWVyQnlJZCkubWFwKGlkID0+IHRoaXMudG9rZW5Nb2RpZmllckJ5SWRbaWRdKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRUb2tlblN0eWxpbmdTY2hlbWEoKTogSUpTT05TY2hlbWEge1xuXHRcdHJldHVybiB0aGlzLnRva2VuU3R5bGluZ1NjaGVtYTtcblx0fVxuXG5cdHB1YmxpYyBnZXRUb2tlblN0eWxpbmdEZWZhdWx0UnVsZXMoKTogU2VtYW50aWNUb2tlbkRlZmF1bHRSdWxlW10ge1xuXHRcdHJldHVybiB0aGlzLnRva2VuU3R5bGluZ0RlZmF1bHRSdWxlcztcblx0fVxuXG5cdHByaXZhdGUgZ2V0VHlwZUhpZXJhcmNoeSh0eXBlSWQ6IHN0cmluZyk6IHN0cmluZ1tdIHtcblx0XHRsZXQgaGllcmFyY2h5ID0gdGhpcy50eXBlSGllcmFyY2h5W3R5cGVJZF07XG5cdFx0aWYgKCFoaWVyYXJjaHkpIHtcblx0XHRcdHRoaXMudHlwZUhpZXJhcmNoeVt0eXBlSWRdID0gaGllcmFyY2h5ID0gW3R5cGVJZF07XG5cdFx0XHRsZXQgdHlwZSA9IHRoaXMudG9rZW5UeXBlQnlJZFt0eXBlSWRdO1xuXHRcdFx0d2hpbGUgKHR5cGUgJiYgdHlwZS5zdXBlclR5cGUpIHtcblx0XHRcdFx0aGllcmFyY2h5LnB1c2godHlwZS5zdXBlclR5cGUpO1xuXHRcdFx0XHR0eXBlID0gdGhpcy50b2tlblR5cGVCeUlkW3R5cGUuc3VwZXJUeXBlXTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGhpZXJhcmNoeTtcblx0fVxuXG5cblx0cHVibGljIHRvU3RyaW5nKCkge1xuXHRcdGNvbnN0IHNvcnRlciA9IChhOiBzdHJpbmcsIGI6IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc3QgY2F0MSA9IGEuaW5kZXhPZignLicpID09PSAtMSA/IDAgOiAxO1xuXHRcdFx0Y29uc3QgY2F0MiA9IGIuaW5kZXhPZignLicpID09PSAtMSA/IDAgOiAxO1xuXHRcdFx0aWYgKGNhdDEgIT09IGNhdDIpIHtcblx0XHRcdFx0cmV0dXJuIGNhdDEgLSBjYXQyO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGEubG9jYWxlQ29tcGFyZShiKTtcblx0XHR9O1xuXG5cdFx0cmV0dXJuIE9iamVjdC5rZXlzKHRoaXMudG9rZW5UeXBlQnlJZCkuc29ydChzb3J0ZXIpLm1hcChrID0+IGAtIFxcYCR7a31cXGA6ICR7dGhpcy50b2tlblR5cGVCeUlkW2tdLmRlc2NyaXB0aW9ufWApLmpvaW4oJ1xcbicpO1xuXHR9XG5cbn1cblxuY29uc3QgQ0hBUl9MQU5HVUFHRSA9IFRPS0VOX0NMQVNTSUZJRVJfTEFOR1VBR0VfU0VQQVJBVE9SLmNoYXJDb2RlQXQoMCk7XG5jb25zdCBDSEFSX01PRElGSUVSID0gQ0xBU1NJRklFUl9NT0RJRklFUl9TRVBBUkFUT1IuY2hhckNvZGVBdCgwKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ2xhc3NpZmllclN0cmluZyhzOiBzdHJpbmcsIGRlZmF1bHRMYW5ndWFnZTogc3RyaW5nKTogeyB0eXBlOiBzdHJpbmc7IG1vZGlmaWVyczogc3RyaW5nW107IGxhbmd1YWdlOiBzdHJpbmcgfTtcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNsYXNzaWZpZXJTdHJpbmcoczogc3RyaW5nLCBkZWZhdWx0TGFuZ3VhZ2U/OiBzdHJpbmcpOiB7IHR5cGU6IHN0cmluZzsgbW9kaWZpZXJzOiBzdHJpbmdbXTsgbGFuZ3VhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZCB9O1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ2xhc3NpZmllclN0cmluZyhzOiBzdHJpbmcsIGRlZmF1bHRMYW5ndWFnZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogeyB0eXBlOiBzdHJpbmc7IG1vZGlmaWVyczogc3RyaW5nW107IGxhbmd1YWdlOiBzdHJpbmcgfCB1bmRlZmluZWQgfSB7XG5cdGxldCBrID0gcy5sZW5ndGg7XG5cdGxldCBsYW5ndWFnZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gZGVmYXVsdExhbmd1YWdlO1xuXHRjb25zdCBtb2RpZmllcnMgPSBbXTtcblxuXHRmb3IgKGxldCBpID0gayAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0Y29uc3QgY2ggPSBzLmNoYXJDb2RlQXQoaSk7XG5cdFx0aWYgKGNoID09PSBDSEFSX0xBTkdVQUdFIHx8IGNoID09PSBDSEFSX01PRElGSUVSKSB7XG5cdFx0XHRjb25zdCBzZWdtZW50ID0gcy5zdWJzdHJpbmcoaSArIDEsIGspO1xuXHRcdFx0ayA9IGk7XG5cdFx0XHRpZiAoY2ggPT09IENIQVJfTEFOR1VBR0UpIHtcblx0XHRcdFx0bGFuZ3VhZ2UgPSBzZWdtZW50O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bW9kaWZpZXJzLnB1c2goc2VnbWVudCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGNvbnN0IHR5cGUgPSBzLnN1YnN0cmluZygwLCBrKTtcblx0cmV0dXJuIHsgdHlwZSwgbW9kaWZpZXJzLCBsYW5ndWFnZSB9O1xufVxuXG5cbmNvbnN0IHRva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeSA9IGNyZWF0ZURlZmF1bHRUb2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnkoKTtcbnBsYXRmb3JtLlJlZ2lzdHJ5LmFkZChFeHRlbnNpb25zLlRva2VuQ2xhc3NpZmljYXRpb25Db250cmlidXRpb24sIHRva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeSk7XG5cblxuZnVuY3Rpb24gY3JlYXRlRGVmYXVsdFRva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeSgpOiBUb2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnkge1xuXG5cdGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IFRva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeSgpO1xuXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyVG9rZW5UeXBlKGlkOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcsIHNjb3Blc1RvUHJvYmU6IFByb2JlU2NvcGVbXSA9IFtdLCBzdXBlclR5cGU/OiBzdHJpbmcsIGRlcHJlY2F0aW9uTWVzc2FnZT86IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0cmVnaXN0cnkucmVnaXN0ZXJUb2tlblR5cGUoaWQsIGRlc2NyaXB0aW9uLCBzdXBlclR5cGUsIGRlcHJlY2F0aW9uTWVzc2FnZSk7XG5cdFx0aWYgKHNjb3Blc1RvUHJvYmUpIHtcblx0XHRcdHJlZ2lzdGVyVG9rZW5TdHlsZURlZmF1bHQoaWQsIHNjb3Blc1RvUHJvYmUpO1xuXHRcdH1cblx0XHRyZXR1cm4gaWQ7XG5cdH1cblxuXHRmdW5jdGlvbiByZWdpc3RlclRva2VuU3R5bGVEZWZhdWx0KHNlbGVjdG9yU3RyaW5nOiBzdHJpbmcsIHNjb3Blc1RvUHJvYmU6IFByb2JlU2NvcGVbXSkge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzZWxlY3RvciA9IHJlZ2lzdHJ5LnBhcnNlVG9rZW5TZWxlY3RvcihzZWxlY3RvclN0cmluZyk7XG5cdFx0XHRyZWdpc3RyeS5yZWdpc3RlclRva2VuU3R5bGVEZWZhdWx0KHNlbGVjdG9yLCB7IHNjb3Blc1RvUHJvYmUgfSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5sb2coZSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gZGVmYXVsdCB0b2tlbiB0eXBlc1xuXG5cdHJlZ2lzdGVyVG9rZW5UeXBlKCdjb21tZW50JywgbmxzLmxvY2FsaXplKCdjb21tZW50JywgXCJTdHlsZSBmb3IgY29tbWVudHMuXCIpLCBbWydjb21tZW50J11dKTtcblx0cmVnaXN0ZXJUb2tlblR5cGUoJ3N0cmluZycsIG5scy5sb2NhbGl6ZSgnc3RyaW5nJywgXCJTdHlsZSBmb3Igc3RyaW5ncy5cIiksIFtbJ3N0cmluZyddXSk7XG5cdHJlZ2lzdGVyVG9rZW5UeXBlKCdrZXl3b3JkJywgbmxzLmxvY2FsaXplKCdrZXl3b3JkJywgXCJTdHlsZSBmb3Iga2V5d29yZHMuXCIpLCBbWydrZXl3b3JkLmNvbnRyb2wnXV0pO1xuXHRyZWdpc3RlclRva2VuVHlwZSgnbnVtYmVyJywgbmxzLmxvY2FsaXplKCdudW1iZXInLCBcIlN0eWxlIGZvciBudW1iZXJzLlwiKSwgW1snY29uc3RhbnQubnVtZXJpYyddXSk7XG5cdHJlZ2lzdGVyVG9rZW5UeXBlKCdyZWdleHAnLCBubHMubG9jYWxpemUoJ3JlZ2V4cCcsIFwiU3R5bGUgZm9yIGV4cHJlc3Npb25zLlwiKSwgW1snY29uc3RhbnQucmVnZXhwJ11dKTtcblx0cmVnaXN0ZXJUb2tlblR5cGUoJ29wZXJhdG9yJywgbmxzLmxvY2FsaXplKCdvcGVyYXRvcicsIFwiU3R5bGUgZm9yIG9wZXJhdG9ycy5cIiksIFtbJ2tleXdvcmQub3BlcmF0b3InXV0pO1xuXG5cdHJlZ2lzdGVyVG9rZW5UeXBlKCduYW1lc3BhY2UnLCBubHMubG9jYWxpemUoJ25hbWVzcGFjZScsIFwiU3R5bGUgZm9yIG5hbWVzcGFjZXMuXCIpLCBbWydlbnRpdHkubmFtZS5uYW1lc3BhY2UnXV0pO1xuXG5cdHJlZ2lzdGVyVG9rZW5UeXBlKCd0eXBlJywgbmxzLmxvY2FsaXplKCd0eXBlJywgXCJTdHlsZSBmb3IgdHlwZXMuXCIpLCBbWydlbnRpdHkubmFtZS50eXBlJ10sIFsnc3VwcG9ydC50eXBlJ11dKTtcblx0cmVnaXN0ZXJUb2tlblR5cGUoJ3N0cnVjdCcsIG5scy5sb2NhbGl6ZSgnc3RydWN0JywgXCJTdHlsZSBmb3Igc3RydWN0cy5cIiksIFtbJ2VudGl0eS5uYW1lLnR5cGUuc3RydWN0J11dKTtcblx0cmVnaXN0ZXJUb2tlblR5cGUoJ2NsYXNzJywgbmxzLmxvY2FsaXplKCdjbGFzcycsIFwiU3R5bGUgZm9yIGNsYXNzZXMuXCIpLCBbWydlbnRpdHkubmFtZS50eXBlLmNsYXNzJ10sIFsnc3VwcG9ydC5jbGFzcyddXSk7XG5cdHJlZ2lzdGVyVG9rZW5UeXBlKCdpbnRlcmZhY2UnLCBubHMubG9jYWxpemUoJ2ludGVyZmFjZScsIFwiU3R5bGUgZm9yIGludGVyZmFjZXMuXCIpLCBbWydlbnRpdHkubmFtZS50eXBlLmludGVyZmFjZSddXSk7XG5cdHJlZ2lzdGVyVG9rZW5UeXBlKCdlbnVtJywgbmxzLmxvY2FsaXplKCdlbnVtJywgXCJTdHlsZSBmb3IgZW51bXMuXCIpLCBbWydlbnRpdHkubmFtZS50eXBlLmVudW0nXV0pO1xuXHRyZWdpc3RlclRva2VuVHlwZSgndHlwZVBhcmFtZXRlcicsIG5scy5sb2NhbGl6ZSgndHlwZVBhcmFtZXRlcicsIFwiU3R5bGUgZm9yIHR5cGUgcGFyYW1ldGVycy5cIiksIFtbJ2VudGl0eS5uYW1lLnR5cGUucGFyYW1ldGVyJ11dKTtcblxuXHRyZWdpc3RlclRva2VuVHlwZSgnZnVuY3Rpb24nLCBubHMubG9jYWxpemUoJ2Z1bmN0aW9uJywgXCJTdHlsZSBmb3IgZnVuY3Rpb25zXCIpLCBbWydlbnRpdHkubmFtZS5mdW5jdGlvbiddLCBbJ3N1cHBvcnQuZnVuY3Rpb24nXV0pO1xuXHRyZWdpc3RlclRva2VuVHlwZSgnbWVtYmVyJywgbmxzLmxvY2FsaXplKCdtZW1iZXInLCBcIlN0eWxlIGZvciBtZW1iZXIgZnVuY3Rpb25zXCIpLCBbXSwgJ21ldGhvZCcsICdEZXByZWNhdGVkIHVzZSBgbWV0aG9kYCBpbnN0ZWFkJyk7XG5cdHJlZ2lzdGVyVG9rZW5UeXBlKCdtZXRob2QnLCBubHMubG9jYWxpemUoJ21ldGhvZCcsIFwiU3R5bGUgZm9yIG1ldGhvZCAobWVtYmVyIGZ1bmN0aW9ucylcIiksIFtbJ2VudGl0eS5uYW1lLmZ1bmN0aW9uLm1lbWJlciddLCBbJ3N1cHBvcnQuZnVuY3Rpb24nXV0pO1xuXHRyZWdpc3RlclRva2VuVHlwZSgnbWFjcm8nLCBubHMubG9jYWxpemUoJ21hY3JvJywgXCJTdHlsZSBmb3IgbWFjcm9zLlwiKSwgW1snZW50aXR5Lm5hbWUuZnVuY3Rpb24ucHJlcHJvY2Vzc29yJ11dKTtcblxuXHRyZWdpc3RlclRva2VuVHlwZSgndmFyaWFibGUnLCBubHMubG9jYWxpemUoJ3ZhcmlhYmxlJywgXCJTdHlsZSBmb3IgdmFyaWFibGVzLlwiKSwgW1sndmFyaWFibGUub3RoZXIucmVhZHdyaXRlJ10sIFsnZW50aXR5Lm5hbWUudmFyaWFibGUnXV0pO1xuXHRyZWdpc3RlclRva2VuVHlwZSgncGFyYW1ldGVyJywgbmxzLmxvY2FsaXplKCdwYXJhbWV0ZXInLCBcIlN0eWxlIGZvciBwYXJhbWV0ZXJzLlwiKSwgW1sndmFyaWFibGUucGFyYW1ldGVyJ11dKTtcblx0cmVnaXN0ZXJUb2tlblR5cGUoJ3Byb3BlcnR5JywgbmxzLmxvY2FsaXplKCdwcm9wZXJ0eScsIFwiU3R5bGUgZm9yIHByb3BlcnRpZXMuXCIpLCBbWyd2YXJpYWJsZS5vdGhlci5wcm9wZXJ0eSddXSk7XG5cdHJlZ2lzdGVyVG9rZW5UeXBlKCdlbnVtTWVtYmVyJywgbmxzLmxvY2FsaXplKCdlbnVtTWVtYmVyJywgXCJTdHlsZSBmb3IgZW51bSBtZW1iZXJzLlwiKSwgW1sndmFyaWFibGUub3RoZXIuZW51bW1lbWJlciddXSk7XG5cdHJlZ2lzdGVyVG9rZW5UeXBlKCdldmVudCcsIG5scy5sb2NhbGl6ZSgnZXZlbnQnLCBcIlN0eWxlIGZvciBldmVudHMuXCIpLCBbWyd2YXJpYWJsZS5vdGhlci5ldmVudCddXSk7XG5cdHJlZ2lzdGVyVG9rZW5UeXBlKCdkZWNvcmF0b3InLCBubHMubG9jYWxpemUoJ2RlY29yYXRvcicsIFwiU3R5bGUgZm9yIGRlY29yYXRvcnMgJiBhbm5vdGF0aW9ucy5cIiksIFtbJ2VudGl0eS5uYW1lLmRlY29yYXRvciddLCBbJ2VudGl0eS5uYW1lLmZ1bmN0aW9uJ11dKTtcblxuXHRyZWdpc3RlclRva2VuVHlwZSgnbGFiZWwnLCBubHMubG9jYWxpemUoJ2xhYmVscycsIFwiU3R5bGUgZm9yIGxhYmVscy4gXCIpLCB1bmRlZmluZWQpO1xuXG5cdC8vIGRlZmF1bHQgdG9rZW4gbW9kaWZpZXJzXG5cblx0cmVnaXN0cnkucmVnaXN0ZXJUb2tlbk1vZGlmaWVyKCdkZWNsYXJhdGlvbicsIG5scy5sb2NhbGl6ZSgnZGVjbGFyYXRpb24nLCBcIlN0eWxlIGZvciBhbGwgc3ltYm9sIGRlY2xhcmF0aW9ucy5cIiksIHVuZGVmaW5lZCk7XG5cdHJlZ2lzdHJ5LnJlZ2lzdGVyVG9rZW5Nb2RpZmllcignZG9jdW1lbnRhdGlvbicsIG5scy5sb2NhbGl6ZSgnZG9jdW1lbnRhdGlvbicsIFwiU3R5bGUgdG8gdXNlIGZvciByZWZlcmVuY2VzIGluIGRvY3VtZW50YXRpb24uXCIpLCB1bmRlZmluZWQpO1xuXHRyZWdpc3RyeS5yZWdpc3RlclRva2VuTW9kaWZpZXIoJ3N0YXRpYycsIG5scy5sb2NhbGl6ZSgnc3RhdGljJywgXCJTdHlsZSB0byB1c2UgZm9yIHN5bWJvbHMgdGhhdCBhcmUgc3RhdGljLlwiKSwgdW5kZWZpbmVkKTtcblx0cmVnaXN0cnkucmVnaXN0ZXJUb2tlbk1vZGlmaWVyKCdhYnN0cmFjdCcsIG5scy5sb2NhbGl6ZSgnYWJzdHJhY3QnLCBcIlN0eWxlIHRvIHVzZSBmb3Igc3ltYm9scyB0aGF0IGFyZSBhYnN0cmFjdC5cIiksIHVuZGVmaW5lZCk7XG5cdHJlZ2lzdHJ5LnJlZ2lzdGVyVG9rZW5Nb2RpZmllcignZGVwcmVjYXRlZCcsIG5scy5sb2NhbGl6ZSgnZGVwcmVjYXRlZCcsIFwiU3R5bGUgdG8gdXNlIGZvciBzeW1ib2xzIHRoYXQgYXJlIGRlcHJlY2F0ZWQuXCIpLCB1bmRlZmluZWQpO1xuXHRyZWdpc3RyeS5yZWdpc3RlclRva2VuTW9kaWZpZXIoJ21vZGlmaWNhdGlvbicsIG5scy5sb2NhbGl6ZSgnbW9kaWZpY2F0aW9uJywgXCJTdHlsZSB0byB1c2UgZm9yIHdyaXRlIGFjY2Vzc2VzLlwiKSwgdW5kZWZpbmVkKTtcblx0cmVnaXN0cnkucmVnaXN0ZXJUb2tlbk1vZGlmaWVyKCdhc3luYycsIG5scy5sb2NhbGl6ZSgnYXN5bmMnLCBcIlN0eWxlIHRvIHVzZSBmb3Igc3ltYm9scyB0aGF0IGFyZSBhc3luYy5cIiksIHVuZGVmaW5lZCk7XG5cdHJlZ2lzdHJ5LnJlZ2lzdGVyVG9rZW5Nb2RpZmllcigncmVhZG9ubHknLCBubHMubG9jYWxpemUoJ3JlYWRvbmx5JywgXCJTdHlsZSB0byB1c2UgZm9yIHN5bWJvbHMgdGhhdCBhcmUgcmVhZC1vbmx5LlwiKSwgdW5kZWZpbmVkKTtcblxuXG5cdHJlZ2lzdGVyVG9rZW5TdHlsZURlZmF1bHQoJ3ZhcmlhYmxlLnJlYWRvbmx5JywgW1sndmFyaWFibGUub3RoZXIuY29uc3RhbnQnXV0pO1xuXHRyZWdpc3RlclRva2VuU3R5bGVEZWZhdWx0KCdwcm9wZXJ0eS5yZWFkb25seScsIFtbJ3ZhcmlhYmxlLm90aGVyLmNvbnN0YW50LnByb3BlcnR5J11dKTtcblx0cmVnaXN0ZXJUb2tlblN0eWxlRGVmYXVsdCgndHlwZS5kZWZhdWx0TGlicmFyeScsIFtbJ3N1cHBvcnQudHlwZSddXSk7XG5cdHJlZ2lzdGVyVG9rZW5TdHlsZURlZmF1bHQoJ2NsYXNzLmRlZmF1bHRMaWJyYXJ5JywgW1snc3VwcG9ydC5jbGFzcyddXSk7XG5cdHJlZ2lzdGVyVG9rZW5TdHlsZURlZmF1bHQoJ2ludGVyZmFjZS5kZWZhdWx0TGlicmFyeScsIFtbJ3N1cHBvcnQuY2xhc3MnXV0pO1xuXHRyZWdpc3RlclRva2VuU3R5bGVEZWZhdWx0KCd2YXJpYWJsZS5kZWZhdWx0TGlicmFyeScsIFtbJ3N1cHBvcnQudmFyaWFibGUnXSwgWydzdXBwb3J0Lm90aGVyLnZhcmlhYmxlJ11dKTtcblx0cmVnaXN0ZXJUb2tlblN0eWxlRGVmYXVsdCgndmFyaWFibGUuZGVmYXVsdExpYnJhcnkucmVhZG9ubHknLCBbWydzdXBwb3J0LmNvbnN0YW50J11dKTtcblx0cmVnaXN0ZXJUb2tlblN0eWxlRGVmYXVsdCgncHJvcGVydHkuZGVmYXVsdExpYnJhcnknLCBbWydzdXBwb3J0LnZhcmlhYmxlLnByb3BlcnR5J11dKTtcblx0cmVnaXN0ZXJUb2tlblN0eWxlRGVmYXVsdCgncHJvcGVydHkuZGVmYXVsdExpYnJhcnkucmVhZG9ubHknLCBbWydzdXBwb3J0LmNvbnN0YW50LnByb3BlcnR5J11dKTtcblx0cmVnaXN0ZXJUb2tlblN0eWxlRGVmYXVsdCgnZnVuY3Rpb24uZGVmYXVsdExpYnJhcnknLCBbWydzdXBwb3J0LmZ1bmN0aW9uJ11dKTtcblx0cmVnaXN0ZXJUb2tlblN0eWxlRGVmYXVsdCgnbWVtYmVyLmRlZmF1bHRMaWJyYXJ5JywgW1snc3VwcG9ydC5mdW5jdGlvbiddXSk7XG5cdHJldHVybiByZWdpc3RyeTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFRva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeSgpOiBJVG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5IHtcblx0cmV0dXJuIHRva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeTtcbn1cblxuZnVuY3Rpb24gZ2V0U3R5bGluZ1NjaGVtZUVudHJ5KGRlc2NyaXB0aW9uPzogc3RyaW5nLCBkZXByZWNhdGlvbk1lc3NhZ2U/OiBzdHJpbmcpOiBJSlNPTlNjaGVtYSB7XG5cdHJldHVybiB7XG5cdFx0ZGVzY3JpcHRpb24sXG5cdFx0ZGVwcmVjYXRpb25NZXNzYWdlLFxuXHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogJyR7MTojZmYwMDAwfScgfV0sXG5cdFx0YW55T2Y6IFtcblx0XHRcdHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGZvcm1hdDogJ2NvbG9yLWhleCdcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3N0eWxlJ1xuXHRcdFx0fVxuXHRcdF1cblx0fTtcbn1cblxuZXhwb3J0IGNvbnN0IHRva2VuU3R5bGluZ1NjaGVtYUlkID0gJ3ZzY29kZTovL3NjaGVtYXMvdG9rZW4tc3R5bGluZyc7XG5cbmNvbnN0IHNjaGVtYVJlZ2lzdHJ5ID0gcGxhdGZvcm0uUmVnaXN0cnkuYXM8SUpTT05Db250cmlidXRpb25SZWdpc3RyeT4oSlNPTkV4dGVuc2lvbnMuSlNPTkNvbnRyaWJ1dGlvbik7XG5zY2hlbWFSZWdpc3RyeS5yZWdpc3RlclNjaGVtYSh0b2tlblN0eWxpbmdTY2hlbWFJZCwgdG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5LmdldFRva2VuU3R5bGluZ1NjaGVtYSgpKTtcblxuY29uc3QgZGVsYXllciA9IG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHNjaGVtYVJlZ2lzdHJ5Lm5vdGlmeVNjaGVtYUNoYW5nZWQodG9rZW5TdHlsaW5nU2NoZW1hSWQpLCAyMDApO1xudG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5Lm9uRGlkQ2hhbmdlU2NoZW1hKCgpID0+IHtcblx0aWYgKCFkZWxheWVyLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRkZWxheWVyLnNj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
