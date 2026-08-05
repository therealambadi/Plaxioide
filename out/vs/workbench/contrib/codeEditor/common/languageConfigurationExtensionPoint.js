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
import * as nls from "../../../../nls.js";
import { parse, getNodeType } from "../../../../base/common/json.js";
import * as types from "../../../../base/common/types.js";
import { IndentAction } from "../../../../editor/common/languages/languageConfiguration.js";
import { ILanguageConfigurationService } from "../../../../editor/common/languages/languageConfigurationRegistry.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { Extensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { getParseErrorMessage } from "../../../../base/common/jsonErrorMessages.js";
import { IExtensionResourceLoaderService } from "../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js";
import { hash } from "../../../../base/common/hash.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
function isStringArr(something) {
  if (!Array.isArray(something)) {
    return false;
  }
  for (let i = 0, len = something.length; i < len; i++) {
    if (typeof something[i] !== "string") {
      return false;
    }
  }
  return true;
}
function isCharacterPair(something) {
  return isStringArr(something) && something.length === 2;
}
let LanguageConfigurationFileHandler = class extends Disposable {
  constructor(_languageService, _extensionResourceLoaderService, _extensionService, _languageConfigurationService) {
    super();
    this._languageService = _languageService;
    this._extensionResourceLoaderService = _extensionResourceLoaderService;
    this._extensionService = _extensionService;
    this._languageConfigurationService = _languageConfigurationService;
    /**
     * A map from language id to a hash computed from the config files locations.
     */
    this._done = /* @__PURE__ */ new Map();
    this._register(this._languageService.onDidRequestBasicLanguageFeatures(async (languageIdentifier) => {
      this._extensionService.whenInstalledExtensionsRegistered().then(() => {
        this._loadConfigurationsForMode(languageIdentifier);
      });
    }));
    this._register(this._languageService.onDidChange(() => {
      for (const [languageId] of this._done) {
        this._loadConfigurationsForMode(languageId);
      }
    }));
  }
  async _loadConfigurationsForMode(languageId) {
    const configurationFiles = this._languageService.getConfigurationFiles(languageId);
    const configurationHash = hash(configurationFiles.map((uri) => uri.toString()));
    if (this._done.get(languageId) === configurationHash) {
      return;
    }
    this._done.set(languageId, configurationHash);
    const configs = await Promise.all(configurationFiles.map((configFile) => this._readConfigFile(configFile)));
    for (const config of configs) {
      this._handleConfig(languageId, config);
    }
  }
  async _readConfigFile(configFileLocation) {
    try {
      const contents = await this._extensionResourceLoaderService.readExtensionResource(configFileLocation);
      const errors = [];
      let configuration = parse(contents, errors);
      if (errors.length) {
        console.error(nls.localize("parseErrors", "Errors parsing {0}: {1}", configFileLocation.toString(), errors.map((e) => `[${e.offset}, ${e.length}] ${getParseErrorMessage(e.error)}`).join("\n")));
      }
      if (getNodeType(configuration) !== "object") {
        console.error(nls.localize("formatError", "{0}: Invalid format, JSON object expected.", configFileLocation.toString()));
        configuration = {};
      }
      return configuration;
    } catch (err) {
      console.error(err);
      return {};
    }
  }
  static _extractValidCommentRule(languageId, configuration) {
    const source = configuration.comments;
    if (typeof source === "undefined") {
      return void 0;
    }
    if (!types.isObject(source)) {
      console.warn(`[${languageId}]: language configuration: expected \`comments\` to be an object.`);
      return void 0;
    }
    let result = void 0;
    if (typeof source.lineComment !== "undefined") {
      if (typeof source.lineComment !== "string") {
        console.warn(`[${languageId}]: language configuration: expected \`comments.lineComment\` to be a string.`);
      } else {
        result = result || {};
        result.lineComment = source.lineComment;
      }
    }
    if (typeof source.blockComment !== "undefined") {
      if (!isCharacterPair(source.blockComment)) {
        console.warn(`[${languageId}]: language configuration: expected \`comments.blockComment\` to be an array of two strings.`);
      } else {
        result = result || {};
        result.blockComment = source.blockComment;
      }
    }
    return result;
  }
  static _extractValidBrackets(languageId, configuration) {
    const source = configuration.brackets;
    if (typeof source === "undefined") {
      return void 0;
    }
    if (!Array.isArray(source)) {
      console.warn(`[${languageId}]: language configuration: expected \`brackets\` to be an array.`);
      return void 0;
    }
    let result = void 0;
    for (let i = 0, len = source.length; i < len; i++) {
      const pair = source[i];
      if (!isCharacterPair(pair)) {
        console.warn(`[${languageId}]: language configuration: expected \`brackets[${i}]\` to be an array of two strings.`);
        continue;
      }
      result = result || [];
      result.push(pair);
    }
    return result;
  }
  static _extractValidAutoClosingPairs(languageId, configuration) {
    const source = configuration.autoClosingPairs;
    if (typeof source === "undefined") {
      return void 0;
    }
    if (!Array.isArray(source)) {
      console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs\` to be an array.`);
      return void 0;
    }
    let result = void 0;
    for (let i = 0, len = source.length; i < len; i++) {
      const pair = source[i];
      if (Array.isArray(pair)) {
        if (!isCharacterPair(pair)) {
          console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}]\` to be an array of two strings or an object.`);
          continue;
        }
        result = result || [];
        result.push({ open: pair[0], close: pair[1] });
      } else {
        if (!types.isObject(pair)) {
          console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}]\` to be an array of two strings or an object.`);
          continue;
        }
        if (typeof pair.open !== "string") {
          console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].open\` to be a string.`);
          continue;
        }
        if (typeof pair.close !== "string") {
          console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].close\` to be a string.`);
          continue;
        }
        if (typeof pair.notIn !== "undefined") {
          if (!isStringArr(pair.notIn)) {
            console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].notIn\` to be a string array.`);
            continue;
          }
        }
        result = result || [];
        result.push({ open: pair.open, close: pair.close, notIn: pair.notIn });
      }
    }
    return result;
  }
  static _extractValidSurroundingPairs(languageId, configuration) {
    const source = configuration.surroundingPairs;
    if (typeof source === "undefined") {
      return void 0;
    }
    if (!Array.isArray(source)) {
      console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs\` to be an array.`);
      return void 0;
    }
    let result = void 0;
    for (let i = 0, len = source.length; i < len; i++) {
      const pair = source[i];
      if (Array.isArray(pair)) {
        if (!isCharacterPair(pair)) {
          console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`);
          continue;
        }
        result = result || [];
        result.push({ open: pair[0], close: pair[1] });
      } else {
        if (!types.isObject(pair)) {
          console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`);
          continue;
        }
        if (typeof pair.open !== "string") {
          console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}].open\` to be a string.`);
          continue;
        }
        if (typeof pair.close !== "string") {
          console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}].close\` to be a string.`);
          continue;
        }
        result = result || [];
        result.push({ open: pair.open, close: pair.close });
      }
    }
    return result;
  }
  static _extractValidColorizedBracketPairs(languageId, configuration) {
    const source = configuration.colorizedBracketPairs;
    if (typeof source === "undefined") {
      return void 0;
    }
    if (!Array.isArray(source)) {
      console.warn(`[${languageId}]: language configuration: expected \`colorizedBracketPairs\` to be an array.`);
      return void 0;
    }
    const result = [];
    for (let i = 0, len = source.length; i < len; i++) {
      const pair = source[i];
      if (!isCharacterPair(pair)) {
        console.warn(`[${languageId}]: language configuration: expected \`colorizedBracketPairs[${i}]\` to be an array of two strings.`);
        continue;
      }
      result.push([pair[0], pair[1]]);
    }
    return result;
  }
  static _extractValidOnEnterRules(languageId, configuration) {
    const source = configuration.onEnterRules;
    if (typeof source === "undefined") {
      return void 0;
    }
    if (!Array.isArray(source)) {
      console.warn(`[${languageId}]: language configuration: expected \`onEnterRules\` to be an array.`);
      return void 0;
    }
    let result = void 0;
    for (let i = 0, len = source.length; i < len; i++) {
      const onEnterRule = source[i];
      if (!types.isObject(onEnterRule)) {
        console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}]\` to be an object.`);
        continue;
      }
      if (!types.isObject(onEnterRule.action)) {
        console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action\` to be an object.`);
        continue;
      }
      let indentAction;
      if (onEnterRule.action.indent === "none") {
        indentAction = IndentAction.None;
      } else if (onEnterRule.action.indent === "indent") {
        indentAction = IndentAction.Indent;
      } else if (onEnterRule.action.indent === "indentOutdent") {
        indentAction = IndentAction.IndentOutdent;
      } else if (onEnterRule.action.indent === "outdent") {
        indentAction = IndentAction.Outdent;
      } else {
        console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.indent\` to be 'none', 'indent', 'indentOutdent' or 'outdent'.`);
        continue;
      }
      const action = { indentAction };
      if (onEnterRule.action.appendText) {
        if (typeof onEnterRule.action.appendText === "string") {
          action.appendText = onEnterRule.action.appendText;
        } else {
          console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.appendText\` to be undefined or a string.`);
        }
      }
      if (onEnterRule.action.removeText) {
        if (typeof onEnterRule.action.removeText === "number") {
          action.removeText = onEnterRule.action.removeText;
        } else {
          console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.removeText\` to be undefined or a number.`);
        }
      }
      const beforeText = this._parseRegex(languageId, `onEnterRules[${i}].beforeText`, onEnterRule.beforeText);
      if (!beforeText) {
        continue;
      }
      const resultingOnEnterRule = { beforeText, action };
      if (onEnterRule.afterText) {
        const afterText = this._parseRegex(languageId, `onEnterRules[${i}].afterText`, onEnterRule.afterText);
        if (afterText) {
          resultingOnEnterRule.afterText = afterText;
        }
      }
      if (onEnterRule.previousLineText) {
        const previousLineText = this._parseRegex(languageId, `onEnterRules[${i}].previousLineText`, onEnterRule.previousLineText);
        if (previousLineText) {
          resultingOnEnterRule.previousLineText = previousLineText;
        }
      }
      result = result || [];
      result.push(resultingOnEnterRule);
    }
    return result;
  }
  static extractValidConfig(languageId, configuration) {
    const comments = this._extractValidCommentRule(languageId, configuration);
    const brackets = this._extractValidBrackets(languageId, configuration);
    const autoClosingPairs = this._extractValidAutoClosingPairs(languageId, configuration);
    const surroundingPairs = this._extractValidSurroundingPairs(languageId, configuration);
    const colorizedBracketPairs = this._extractValidColorizedBracketPairs(languageId, configuration);
    const autoCloseBefore = typeof configuration.autoCloseBefore === "string" ? configuration.autoCloseBefore : void 0;
    const wordPattern = configuration.wordPattern ? this._parseRegex(languageId, `wordPattern`, configuration.wordPattern) : void 0;
    const indentationRules = configuration.indentationRules ? this._mapIndentationRules(languageId, configuration.indentationRules) : void 0;
    let folding = void 0;
    if (configuration.folding) {
      const rawMarkers = configuration.folding.markers;
      const startMarker = rawMarkers && rawMarkers.start ? this._parseRegex(languageId, `folding.markers.start`, rawMarkers.start) : void 0;
      const endMarker = rawMarkers && rawMarkers.end ? this._parseRegex(languageId, `folding.markers.end`, rawMarkers.end) : void 0;
      const markers = startMarker && endMarker ? { start: startMarker, end: endMarker } : void 0;
      folding = {
        offSide: configuration.folding.offSide,
        markers
      };
    }
    const onEnterRules = this._extractValidOnEnterRules(languageId, configuration);
    const richEditConfig = {
      comments,
      brackets,
      wordPattern,
      indentationRules,
      onEnterRules,
      autoClosingPairs,
      surroundingPairs,
      colorizedBracketPairs,
      autoCloseBefore,
      folding,
      __electricCharacterSupport: void 0
    };
    return richEditConfig;
  }
  _handleConfig(languageId, configuration) {
    const richEditConfig = LanguageConfigurationFileHandler.extractValidConfig(languageId, configuration);
    this._languageConfigurationService.register(languageId, richEditConfig, 50);
  }
  static _parseRegex(languageId, confPath, value) {
    if (typeof value === "string") {
      try {
        return new RegExp(value, "");
      } catch (err) {
        console.warn(`[${languageId}]: Invalid regular expression in \`${confPath}\`: `, err);
        return void 0;
      }
    }
    if (types.isObject(value)) {
      if (typeof value.pattern !== "string") {
        console.warn(`[${languageId}]: language configuration: expected \`${confPath}.pattern\` to be a string.`);
        return void 0;
      }
      if (typeof value.flags !== "undefined" && typeof value.flags !== "string") {
        console.warn(`[${languageId}]: language configuration: expected \`${confPath}.flags\` to be a string.`);
        return void 0;
      }
      try {
        return new RegExp(value.pattern, value.flags);
      } catch (err) {
        console.warn(`[${languageId}]: Invalid regular expression in \`${confPath}\`: `, err);
        return void 0;
      }
    }
    console.warn(`[${languageId}]: language configuration: expected \`${confPath}\` to be a string or an object.`);
    return void 0;
  }
  static _mapIndentationRules(languageId, indentationRules) {
    const increaseIndentPattern = this._parseRegex(languageId, `indentationRules.increaseIndentPattern`, indentationRules.increaseIndentPattern);
    if (!increaseIndentPattern) {
      return void 0;
    }
    const decreaseIndentPattern = this._parseRegex(languageId, `indentationRules.decreaseIndentPattern`, indentationRules.decreaseIndentPattern);
    if (!decreaseIndentPattern) {
      return void 0;
    }
    const result = {
      increaseIndentPattern,
      decreaseIndentPattern
    };
    if (indentationRules.indentNextLinePattern) {
      result.indentNextLinePattern = this._parseRegex(languageId, `indentationRules.indentNextLinePattern`, indentationRules.indentNextLinePattern);
    }
    if (indentationRules.unIndentedLinePattern) {
      result.unIndentedLinePattern = this._parseRegex(languageId, `indentationRules.unIndentedLinePattern`, indentationRules.unIndentedLinePattern);
    }
    return result;
  }
};
LanguageConfigurationFileHandler = __decorateClass([
  __decorateParam(0, ILanguageService),
  __decorateParam(1, IExtensionResourceLoaderService),
  __decorateParam(2, IExtensionService),
  __decorateParam(3, ILanguageConfigurationService)
], LanguageConfigurationFileHandler);
const schemaId = "vscode://schemas/language-configuration";
const schema = {
  allowComments: true,
  allowTrailingCommas: true,
  default: {
    comments: {
      blockComment: ["/*", "*/"],
      lineComment: "//"
    },
    brackets: [["(", ")"], ["[", "]"], ["{", "}"]],
    autoClosingPairs: [["(", ")"], ["[", "]"], ["{", "}"]],
    surroundingPairs: [["(", ")"], ["[", "]"], ["{", "}"]]
  },
  definitions: {
    openBracket: {
      type: "string",
      description: nls.localize("schema.openBracket", "The opening bracket character or string sequence.")
    },
    closeBracket: {
      type: "string",
      description: nls.localize("schema.closeBracket", "The closing bracket character or string sequence.")
    },
    bracketPair: {
      type: "array",
      items: [{
        $ref: "#/definitions/openBracket"
      }, {
        $ref: "#/definitions/closeBracket"
      }]
    }
  },
  properties: {
    comments: {
      default: {
        blockComment: ["/*", "*/"],
        lineComment: "//"
      },
      description: nls.localize("schema.comments", "Defines the comment symbols"),
      type: "object",
      properties: {
        blockComment: {
          type: "array",
          description: nls.localize("schema.blockComments", "Defines how block comments are marked."),
          items: [{
            type: "string",
            description: nls.localize("schema.blockComment.begin", "The character sequence that starts a block comment.")
          }, {
            type: "string",
            description: nls.localize("schema.blockComment.end", "The character sequence that ends a block comment.")
          }]
        },
        lineComment: {
          type: "string",
          description: nls.localize("schema.lineComment", "The character sequence that starts a line comment.")
        }
      }
    },
    brackets: {
      default: [["(", ")"], ["[", "]"], ["{", "}"]],
      markdownDescription: nls.localize("schema.brackets", "Defines the bracket symbols that increase or decrease the indentation. When bracket pair colorization is enabled and {0} is not defined, this also defines the bracket pairs that are colorized by their nesting level.", "`colorizedBracketPairs`"),
      type: "array",
      items: {
        $ref: "#/definitions/bracketPair"
      }
    },
    colorizedBracketPairs: {
      default: [["(", ")"], ["[", "]"], ["{", "}"]],
      markdownDescription: nls.localize("schema.colorizedBracketPairs", "Defines the bracket pairs that are colorized by their nesting level if bracket pair colorization is enabled. Any brackets included here that are not included in {0} will be automatically included in {0}.", "`brackets`"),
      type: "array",
      items: {
        $ref: "#/definitions/bracketPair"
      }
    },
    autoClosingPairs: {
      default: [["(", ")"], ["[", "]"], ["{", "}"]],
      description: nls.localize("schema.autoClosingPairs", "Defines the bracket pairs. When a opening bracket is entered, the closing bracket is inserted automatically."),
      type: "array",
      items: {
        oneOf: [{
          $ref: "#/definitions/bracketPair"
        }, {
          type: "object",
          properties: {
            open: {
              $ref: "#/definitions/openBracket"
            },
            close: {
              $ref: "#/definitions/closeBracket"
            },
            notIn: {
              type: "array",
              description: nls.localize("schema.autoClosingPairs.notIn", "Defines a list of scopes where the auto pairs are disabled."),
              items: {
                enum: ["string", "comment"]
              }
            }
          }
        }]
      }
    },
    autoCloseBefore: {
      default: ";:.,=}])> \n	",
      description: nls.localize("schema.autoCloseBefore", "Defines what characters must be after the cursor in order for bracket or quote autoclosing to occur when using the 'languageDefined' autoclosing setting. This is typically the set of characters which can not start an expression."),
      type: "string"
    },
    surroundingPairs: {
      default: [["(", ")"], ["[", "]"], ["{", "}"]],
      description: nls.localize("schema.surroundingPairs", "Defines the bracket pairs that can be used to surround a selected string."),
      type: "array",
      items: {
        oneOf: [{
          $ref: "#/definitions/bracketPair"
        }, {
          type: "object",
          properties: {
            open: {
              $ref: "#/definitions/openBracket"
            },
            close: {
              $ref: "#/definitions/closeBracket"
            }
          }
        }]
      }
    },
    wordPattern: {
      default: "",
      description: nls.localize("schema.wordPattern", "Defines what is considered to be a word in the programming language."),
      type: ["string", "object"],
      properties: {
        pattern: {
          type: "string",
          description: nls.localize("schema.wordPattern.pattern", "The RegExp pattern used to match words."),
          default: ""
        },
        flags: {
          type: "string",
          description: nls.localize("schema.wordPattern.flags", "The RegExp flags used to match words."),
          default: "g",
          pattern: "^([gimuy]+)$",
          patternErrorMessage: nls.localize("schema.wordPattern.flags.errorMessage", "Must match the pattern `/^([gimuy]+)$/`.")
        }
      }
    },
    indentationRules: {
      default: {
        increaseIndentPattern: "",
        decreaseIndentPattern: ""
      },
      description: nls.localize("schema.indentationRules", "The language's indentation settings."),
      type: "object",
      properties: {
        increaseIndentPattern: {
          type: ["string", "object"],
          description: nls.localize("schema.indentationRules.increaseIndentPattern", "If a line matches this pattern, then all the lines after it should be indented once (until another rule matches)."),
          properties: {
            pattern: {
              type: "string",
              description: nls.localize("schema.indentationRules.increaseIndentPattern.pattern", "The RegExp pattern for increaseIndentPattern."),
              default: ""
            },
            flags: {
              type: "string",
              description: nls.localize("schema.indentationRules.increaseIndentPattern.flags", "The RegExp flags for increaseIndentPattern."),
              default: "",
              pattern: "^([gimuy]+)$",
              patternErrorMessage: nls.localize("schema.indentationRules.increaseIndentPattern.errorMessage", "Must match the pattern `/^([gimuy]+)$/`.")
            }
          }
        },
        decreaseIndentPattern: {
          type: ["string", "object"],
          description: nls.localize("schema.indentationRules.decreaseIndentPattern", "If a line matches this pattern, then all the lines after it should be unindented once (until another rule matches)."),
          properties: {
            pattern: {
              type: "string",
              description: nls.localize("schema.indentationRules.decreaseIndentPattern.pattern", "The RegExp pattern for decreaseIndentPattern."),
              default: ""
            },
            flags: {
              type: "string",
              description: nls.localize("schema.indentationRules.decreaseIndentPattern.flags", "The RegExp flags for decreaseIndentPattern."),
              default: "",
              pattern: "^([gimuy]+)$",
              patternErrorMessage: nls.localize("schema.indentationRules.decreaseIndentPattern.errorMessage", "Must match the pattern `/^([gimuy]+)$/`.")
            }
          }
        },
        indentNextLinePattern: {
          type: ["string", "object"],
          description: nls.localize("schema.indentationRules.indentNextLinePattern", "If a line matches this pattern, then **only the next line** after it should be indented once."),
          properties: {
            pattern: {
              type: "string",
              description: nls.localize("schema.indentationRules.indentNextLinePattern.pattern", "The RegExp pattern for indentNextLinePattern."),
              default: ""
            },
            flags: {
              type: "string",
              description: nls.localize("schema.indentationRules.indentNextLinePattern.flags", "The RegExp flags for indentNextLinePattern."),
              default: "",
              pattern: "^([gimuy]+)$",
              patternErrorMessage: nls.localize("schema.indentationRules.indentNextLinePattern.errorMessage", "Must match the pattern `/^([gimuy]+)$/`.")
            }
          }
        },
        unIndentedLinePattern: {
          type: ["string", "object"],
          description: nls.localize("schema.indentationRules.unIndentedLinePattern", "If a line matches this pattern, then its indentation should not be changed and it should not be evaluated against the other rules."),
          properties: {
            pattern: {
              type: "string",
              description: nls.localize("schema.indentationRules.unIndentedLinePattern.pattern", "The RegExp pattern for unIndentedLinePattern."),
              default: ""
            },
            flags: {
              type: "string",
              description: nls.localize("schema.indentationRules.unIndentedLinePattern.flags", "The RegExp flags for unIndentedLinePattern."),
              default: "",
              pattern: "^([gimuy]+)$",
              patternErrorMessage: nls.localize("schema.indentationRules.unIndentedLinePattern.errorMessage", "Must match the pattern `/^([gimuy]+)$/`.")
            }
          }
        }
      }
    },
    folding: {
      type: "object",
      description: nls.localize("schema.folding", "The language's folding settings."),
      properties: {
        offSide: {
          type: "boolean",
          description: nls.localize("schema.folding.offSide", "A language adheres to the off-side rule if blocks in that language are expressed by their indentation. If set, empty lines belong to the subsequent block.")
        },
        markers: {
          type: "object",
          description: nls.localize("schema.folding.markers", "Language specific folding markers such as '#region' and '#endregion'. The start and end regexes will be tested against the contents of all lines and must be designed efficiently"),
          properties: {
            start: {
              type: "string",
              description: nls.localize("schema.folding.markers.start", "The RegExp pattern for the start marker. The regexp must start with '^'.")
            },
            end: {
              type: "string",
              description: nls.localize("schema.folding.markers.end", "The RegExp pattern for the end marker. The regexp must start with '^'.")
            }
          }
        }
      }
    },
    onEnterRules: {
      type: "array",
      description: nls.localize("schema.onEnterRules", "The language's rules to be evaluated when pressing Enter."),
      items: {
        type: "object",
        description: nls.localize("schema.onEnterRules", "The language's rules to be evaluated when pressing Enter."),
        required: ["beforeText", "action"],
        properties: {
          beforeText: {
            type: ["string", "object"],
            description: nls.localize("schema.onEnterRules.beforeText", "This rule will only execute if the text before the cursor matches this regular expression."),
            properties: {
              pattern: {
                type: "string",
                description: nls.localize("schema.onEnterRules.beforeText.pattern", "The RegExp pattern for beforeText."),
                default: ""
              },
              flags: {
                type: "string",
                description: nls.localize("schema.onEnterRules.beforeText.flags", "The RegExp flags for beforeText."),
                default: "",
                pattern: "^([gimuy]+)$",
                patternErrorMessage: nls.localize("schema.onEnterRules.beforeText.errorMessage", "Must match the pattern `/^([gimuy]+)$/`.")
              }
            }
          },
          afterText: {
            type: ["string", "object"],
            description: nls.localize("schema.onEnterRules.afterText", "This rule will only execute if the text after the cursor matches this regular expression."),
            properties: {
              pattern: {
                type: "string",
                description: nls.localize("schema.onEnterRules.afterText.pattern", "The RegExp pattern for afterText."),
                default: ""
              },
              flags: {
                type: "string",
                description: nls.localize("schema.onEnterRules.afterText.flags", "The RegExp flags for afterText."),
                default: "",
                pattern: "^([gimuy]+)$",
                patternErrorMessage: nls.localize("schema.onEnterRules.afterText.errorMessage", "Must match the pattern `/^([gimuy]+)$/`.")
              }
            }
          },
          previousLineText: {
            type: ["string", "object"],
            description: nls.localize("schema.onEnterRules.previousLineText", "This rule will only execute if the text above the line matches this regular expression."),
            properties: {
              pattern: {
                type: "string",
                description: nls.localize("schema.onEnterRules.previousLineText.pattern", "The RegExp pattern for previousLineText."),
                default: ""
              },
              flags: {
                type: "string",
                description: nls.localize("schema.onEnterRules.previousLineText.flags", "The RegExp flags for previousLineText."),
                default: "",
                pattern: "^([gimuy]+)$",
                patternErrorMessage: nls.localize("schema.onEnterRules.previousLineText.errorMessage", "Must match the pattern `/^([gimuy]+)$/`.")
              }
            }
          },
          action: {
            type: ["string", "object"],
            description: nls.localize("schema.onEnterRules.action", "The action to execute."),
            required: ["indent"],
            default: { "indent": "indent" },
            properties: {
              indent: {
                type: "string",
                description: nls.localize("schema.onEnterRules.action.indent", "Describe what to do with the indentation"),
                default: "indent",
                enum: ["none", "indent", "indentOutdent", "outdent"],
                markdownEnumDescriptions: [
                  nls.localize("schema.onEnterRules.action.indent.none", "Insert new line and copy the previous line's indentation."),
                  nls.localize("schema.onEnterRules.action.indent.indent", "Insert new line and indent once (relative to the previous line's indentation)."),
                  nls.localize("schema.onEnterRules.action.indent.indentOutdent", "Insert two new lines:\n - the first one indented which will hold the cursor\n - the second one at the same indentation level"),
                  nls.localize("schema.onEnterRules.action.indent.outdent", "Insert new line and outdent once (relative to the previous line's indentation).")
                ]
              },
              appendText: {
                type: "string",
                description: nls.localize("schema.onEnterRules.action.appendText", "Describes text to be appended after the new line and after the indentation."),
                default: ""
              },
              removeText: {
                type: "number",
                description: nls.localize("schema.onEnterRules.action.removeText", "Describes the number of characters to remove from the new line's indentation."),
                default: 0
              }
            }
          }
        }
      }
    }
  }
};
const schemaRegistry = Registry.as(Extensions.JSONContribution);
schemaRegistry.registerSchema(schemaId, schema);
export {
  LanguageConfigurationFileHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2NvbW1vbi9sYW5ndWFnZUNvbmZpZ3VyYXRpb25FeHRlbnNpb25Qb2ludC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgUGFyc2VFcnJvciwgcGFyc2UsIGdldE5vZGVUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvbi5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0ICogYXMgdHlwZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IENoYXJhY3RlclBhaXIsIENvbW1lbnRSdWxlLCBFbnRlckFjdGlvbiwgRXhwbGljaXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24sIEZvbGRpbmdNYXJrZXJzLCBGb2xkaW5nUnVsZXMsIElBdXRvQ2xvc2luZ1BhaXIsIElBdXRvQ2xvc2luZ1BhaXJDb25kaXRpb25hbCwgSW5kZW50QWN0aW9uLCBJbmRlbnRhdGlvblJ1bGUsIE9uRW50ZXJSdWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMsIElKU09OQ29udHJpYnV0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9qc29uc2NoZW1hcy9jb21tb24vanNvbkNvbnRyaWJ1dGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBnZXRQYXJzZUVycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25FcnJvck1lc3NhZ2VzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25SZXNvdXJjZUxvYWRlci9jb21tb24vZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXIuanMnO1xuaW1wb3J0IHsgaGFzaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2hhc2guanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbmludGVyZmFjZSBJUmVnRXhwIHtcblx0cGF0dGVybjogc3RyaW5nO1xuXHRmbGFncz86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElJbmRlbnRhdGlvblJ1bGVzIHtcblx0ZGVjcmVhc2VJbmRlbnRQYXR0ZXJuOiBzdHJpbmcgfCBJUmVnRXhwO1xuXHRpbmNyZWFzZUluZGVudFBhdHRlcm46IHN0cmluZyB8IElSZWdFeHA7XG5cdGluZGVudE5leHRMaW5lUGF0dGVybj86IHN0cmluZyB8IElSZWdFeHA7XG5cdHVuSW5kZW50ZWRMaW5lUGF0dGVybj86IHN0cmluZyB8IElSZWdFeHA7XG59XG5cbmludGVyZmFjZSBJRW50ZXJBY3Rpb24ge1xuXHRpbmRlbnQ6ICdub25lJyB8ICdpbmRlbnQnIHwgJ2luZGVudE91dGRlbnQnIHwgJ291dGRlbnQnO1xuXHRhcHBlbmRUZXh0Pzogc3RyaW5nO1xuXHRyZW1vdmVUZXh0PzogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSU9uRW50ZXJSdWxlIHtcblx0YmVmb3JlVGV4dDogc3RyaW5nIHwgSVJlZ0V4cDtcblx0YWZ0ZXJUZXh0Pzogc3RyaW5nIHwgSVJlZ0V4cDtcblx0cHJldmlvdXNMaW5lVGV4dD86IHN0cmluZyB8IElSZWdFeHA7XG5cdGFjdGlvbjogSUVudGVyQWN0aW9uO1xufVxuXG4vKipcbiAqIFNlcmlhbGl6ZWQgZm9ybSBvZiBhIGxhbmd1YWdlIGNvbmZpZ3VyYXRpb25cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uIHtcblx0Y29tbWVudHM/OiBDb21tZW50UnVsZTtcblx0YnJhY2tldHM/OiBDaGFyYWN0ZXJQYWlyW107XG5cdGF1dG9DbG9zaW5nUGFpcnM/OiBBcnJheTxDaGFyYWN0ZXJQYWlyIHwgSUF1dG9DbG9zaW5nUGFpckNvbmRpdGlvbmFsPjtcblx0c3Vycm91bmRpbmdQYWlycz86IEFycmF5PENoYXJhY3RlclBhaXIgfCBJQXV0b0Nsb3NpbmdQYWlyPjtcblx0Y29sb3JpemVkQnJhY2tldFBhaXJzPzogQXJyYXk8Q2hhcmFjdGVyUGFpcj47XG5cdHdvcmRQYXR0ZXJuPzogc3RyaW5nIHwgSVJlZ0V4cDtcblx0aW5kZW50YXRpb25SdWxlcz86IElJbmRlbnRhdGlvblJ1bGVzO1xuXHRmb2xkaW5nPzoge1xuXHRcdG9mZlNpZGU/OiBib29sZWFuO1xuXHRcdG1hcmtlcnM/OiB7XG5cdFx0XHRzdGFydD86IHN0cmluZyB8IElSZWdFeHA7XG5cdFx0XHRlbmQ/OiBzdHJpbmcgfCBJUmVnRXhwO1xuXHRcdH07XG5cdH07XG5cdGF1dG9DbG9zZUJlZm9yZT86IHN0cmluZztcblx0b25FbnRlclJ1bGVzPzogSU9uRW50ZXJSdWxlW107XG59XG5cbmZ1bmN0aW9uIGlzU3RyaW5nQXJyKHNvbWV0aGluZzogc3RyaW5nW10gfCBudWxsKTogc29tZXRoaW5nIGlzIHN0cmluZ1tdIHtcblx0aWYgKCFBcnJheS5pc0FycmF5KHNvbWV0aGluZykpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHNvbWV0aGluZy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdGlmICh0eXBlb2Ygc29tZXRoaW5nW2ldICE9PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdHJ1ZTtcblxufVxuXG5mdW5jdGlvbiBpc0NoYXJhY3RlclBhaXIoc29tZXRoaW5nOiBDaGFyYWN0ZXJQYWlyIHwgbnVsbCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gKFxuXHRcdGlzU3RyaW5nQXJyKHNvbWV0aGluZylcblx0XHQmJiBzb21ldGhpbmcubGVuZ3RoID09PSAyXG5cdCk7XG59XG5cbmV4cG9ydCBjbGFzcyBMYW5ndWFnZUNvbmZpZ3VyYXRpb25GaWxlSGFuZGxlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdC8qKlxuXHQgKiBBIG1hcCBmcm9tIGxhbmd1YWdlIGlkIHRvIGEgaGFzaCBjb21wdXRlZCBmcm9tIHRoZSBjb25maWcgZmlsZXMgbG9jYXRpb25zLlxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSBfZG9uZSA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZTogSUV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLm9uRGlkUmVxdWVzdEJhc2ljTGFuZ3VhZ2VGZWF0dXJlcyhhc3luYyAobGFuZ3VhZ2VJZGVudGlmaWVyKSA9PiB7XG5cdFx0XHQvLyBNb2RlcyBjYW4gYmUgaW5zdGFudGlhdGVkIGJlZm9yZSB0aGUgZXh0ZW5zaW9uIHBvaW50cyBoYXZlIGZpbmlzaGVkIHJlZ2lzdGVyaW5nXG5cdFx0XHR0aGlzLl9leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9sb2FkQ29uZmlndXJhdGlvbnNGb3JNb2RlKGxhbmd1YWdlSWRlbnRpZmllcik7XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdC8vIHJlbG9hZCBsYW5ndWFnZSBjb25maWd1cmF0aW9ucyBhcyBuZWNlc3Nhcnlcblx0XHRcdGZvciAoY29uc3QgW2xhbmd1YWdlSWRdIG9mIHRoaXMuX2RvbmUpIHtcblx0XHRcdFx0dGhpcy5fbG9hZENvbmZpZ3VyYXRpb25zRm9yTW9kZShsYW5ndWFnZUlkKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9sb2FkQ29uZmlndXJhdGlvbnNGb3JNb2RlKGxhbmd1YWdlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25GaWxlcyA9IHRoaXMuX2xhbmd1YWdlU2VydmljZS5nZXRDb25maWd1cmF0aW9uRmlsZXMobGFuZ3VhZ2VJZCk7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvbkhhc2ggPSBoYXNoKGNvbmZpZ3VyYXRpb25GaWxlcy5tYXAodXJpID0+IHVyaS50b1N0cmluZygpKSk7XG5cblx0XHRpZiAodGhpcy5fZG9uZS5nZXQobGFuZ3VhZ2VJZCkgPT09IGNvbmZpZ3VyYXRpb25IYXNoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2RvbmUuc2V0KGxhbmd1YWdlSWQsIGNvbmZpZ3VyYXRpb25IYXNoKTtcblxuXHRcdGNvbnN0IGNvbmZpZ3MgPSBhd2FpdCBQcm9taXNlLmFsbChjb25maWd1cmF0aW9uRmlsZXMubWFwKGNvbmZpZ0ZpbGUgPT4gdGhpcy5fcmVhZENvbmZpZ0ZpbGUoY29uZmlnRmlsZSkpKTtcblx0XHRmb3IgKGNvbnN0IGNvbmZpZyBvZiBjb25maWdzKSB7XG5cdFx0XHR0aGlzLl9oYW5kbGVDb25maWcobGFuZ3VhZ2VJZCwgY29uZmlnKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZWFkQ29uZmlnRmlsZShjb25maWdGaWxlTG9jYXRpb246IFVSSSk6IFByb21pc2U8SUxhbmd1YWdlQ29uZmlndXJhdGlvbj4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjb250ZW50cyA9IGF3YWl0IHRoaXMuX2V4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZS5yZWFkRXh0ZW5zaW9uUmVzb3VyY2UoY29uZmlnRmlsZUxvY2F0aW9uKTtcblx0XHRcdGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG5cdFx0XHRsZXQgY29uZmlndXJhdGlvbiA9IDxJTGFuZ3VhZ2VDb25maWd1cmF0aW9uPnBhcnNlKGNvbnRlbnRzLCBlcnJvcnMpO1xuXHRcdFx0aWYgKGVycm9ycy5sZW5ndGgpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihubHMubG9jYWxpemUoJ3BhcnNlRXJyb3JzJywgXCJFcnJvcnMgcGFyc2luZyB7MH06IHsxfVwiLCBjb25maWdGaWxlTG9jYXRpb24udG9TdHJpbmcoKSwgZXJyb3JzLm1hcChlID0+IChgWyR7ZS5vZmZzZXR9LCAke2UubGVuZ3RofV0gJHtnZXRQYXJzZUVycm9yTWVzc2FnZShlLmVycm9yKX1gKSkuam9pbignXFxuJykpKTtcblx0XHRcdH1cblx0XHRcdGlmIChnZXROb2RlVHlwZShjb25maWd1cmF0aW9uKSAhPT0gJ29iamVjdCcpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihubHMubG9jYWxpemUoJ2Zvcm1hdEVycm9yJywgXCJ7MH06IEludmFsaWQgZm9ybWF0LCBKU09OIG9iamVjdCBleHBlY3RlZC5cIiwgY29uZmlnRmlsZUxvY2F0aW9uLnRvU3RyaW5nKCkpKTtcblx0XHRcdFx0Y29uZmlndXJhdGlvbiA9IHt9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb247XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGVycik7XG5cdFx0XHRyZXR1cm4ge307XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2V4dHJhY3RWYWxpZENvbW1lbnRSdWxlKGxhbmd1YWdlSWQ6IHN0cmluZywgY29uZmlndXJhdGlvbjogSUxhbmd1YWdlQ29uZmlndXJhdGlvbik6IENvbW1lbnRSdWxlIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBzb3VyY2UgPSBjb25maWd1cmF0aW9uLmNvbW1lbnRzO1xuXHRcdGlmICh0eXBlb2Ygc291cmNlID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKCF0eXBlcy5pc09iamVjdChzb3VyY2UpKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oYFske2xhbmd1YWdlSWR9XTogbGFuZ3VhZ2UgY29uZmlndXJhdGlvbjogZXhwZWN0ZWQgXFxgY29tbWVudHNcXGAgdG8gYmUgYW4gb2JqZWN0LmApO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRsZXQgcmVzdWx0OiBDb21tZW50UnVsZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAodHlwZW9mIHNvdXJjZS5saW5lQ29tbWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGlmICh0eXBlb2Ygc291cmNlLmxpbmVDb21tZW50ICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oYFske2xhbmd1YWdlSWR9XTogbGFuZ3VhZ2UgY29uZmlndXJhdGlvbjogZXhwZWN0ZWQgXFxgY29tbWVudHMubGluZUNvbW1lbnRcXGAgdG8gYmUgYSBzdHJpbmcuYCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQgPSByZXN1bHQgfHwge307XG5cdFx0XHRcdHJlc3VsdC5saW5lQ29tbWVudCA9IHNvdXJjZS5saW5lQ29tbWVudDtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBzb3VyY2UuYmxvY2tDb21tZW50ICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0aWYgKCFpc0NoYXJhY3RlclBhaXIoc291cmNlLmJsb2NrQ29tbWVudCkpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKGBbJHtsYW5ndWFnZUlkfV06IGxhbmd1YWdlIGNvbmZpZ3VyYXRpb246IGV4cGVjdGVkIFxcYGNvbW1lbnRzLmJsb2NrQ29tbWVudFxcYCB0byBiZSBhbiBhcnJheSBvZiB0d28gc3RyaW5ncy5gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdCA9IHJlc3VsdCB8fCB7fTtcblx0XHRcdFx0cmVzdWx0LmJsb2NrQ29tbWVudCA9IHNvdXJjZS5ibG9ja0NvbW1lbnQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZXh0cmFjdFZhbGlkQnJhY2tldHMobGFuZ3VhZ2VJZDogc3RyaW5nLCBjb25maWd1cmF0aW9uOiBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uKTogQ2hhcmFjdGVyUGFpcltdIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBzb3VyY2UgPSBjb25maWd1cmF0aW9uLmJyYWNrZXRzO1xuXHRcdGlmICh0eXBlb2Ygc291cmNlID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHNvdXJjZSkpIHtcblx0XHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGBicmFja2V0c1xcYCB0byBiZSBhbiBhcnJheS5gKTtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0bGV0IHJlc3VsdDogQ2hhcmFjdGVyUGFpcltdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBzb3VyY2UubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHBhaXIgPSBzb3VyY2VbaV07XG5cdFx0XHRpZiAoIWlzQ2hhcmFjdGVyUGFpcihwYWlyKSkge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oYFske2xhbmd1YWdlSWR9XTogbGFuZ3VhZ2UgY29uZmlndXJhdGlvbjogZXhwZWN0ZWQgXFxgYnJhY2tldHNbJHtpfV1cXGAgdG8gYmUgYW4gYXJyYXkgb2YgdHdvIHN0cmluZ3MuYCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXN1bHQgPSByZXN1bHQgfHwgW107XG5cdFx0XHRyZXN1bHQucHVzaChwYWlyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9leHRyYWN0VmFsaWRBdXRvQ2xvc2luZ1BhaXJzKGxhbmd1YWdlSWQ6IHN0cmluZywgY29uZmlndXJhdGlvbjogSUxhbmd1YWdlQ29uZmlndXJhdGlvbik6IElBdXRvQ2xvc2luZ1BhaXJDb25kaXRpb25hbFtdIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBzb3VyY2UgPSBjb25maWd1cmF0aW9uLmF1dG9DbG9zaW5nUGFpcnM7XG5cdFx0aWYgKHR5cGVvZiBzb3VyY2UgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoc291cmNlKSkge1xuXHRcdFx0Y29uc29sZS53YXJuKGBbJHtsYW5ndWFnZUlkfV06IGxhbmd1YWdlIGNvbmZpZ3VyYXRpb246IGV4cGVjdGVkIFxcYGF1dG9DbG9zaW5nUGFpcnNcXGAgdG8gYmUgYW4gYXJyYXkuYCk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGxldCByZXN1bHQ6IElBdXRvQ2xvc2luZ1BhaXJDb25kaXRpb25hbFtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBzb3VyY2UubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHBhaXIgPSBzb3VyY2VbaV07XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShwYWlyKSkge1xuXHRcdFx0XHRpZiAoIWlzQ2hhcmFjdGVyUGFpcihwYWlyKSkge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGBhdXRvQ2xvc2luZ1BhaXJzWyR7aX1dXFxgIHRvIGJlIGFuIGFycmF5IG9mIHR3byBzdHJpbmdzIG9yIGFuIG9iamVjdC5gKTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHQgPSByZXN1bHQgfHwgW107XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHsgb3BlbjogcGFpclswXSwgY2xvc2U6IHBhaXJbMV0gfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoIXR5cGVzLmlzT2JqZWN0KHBhaXIpKSB7XG5cdFx0XHRcdFx0Y29uc29sZS53YXJuKGBbJHtsYW5ndWFnZUlkfV06IGxhbmd1YWdlIGNvbmZpZ3VyYXRpb246IGV4cGVjdGVkIFxcYGF1dG9DbG9zaW5nUGFpcnNbJHtpfV1cXGAgdG8gYmUgYW4gYXJyYXkgb2YgdHdvIHN0cmluZ3Mgb3IgYW4gb2JqZWN0LmApO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0eXBlb2YgcGFpci5vcGVuICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGBhdXRvQ2xvc2luZ1BhaXJzWyR7aX1dLm9wZW5cXGAgdG8gYmUgYSBzdHJpbmcuYCk7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHR5cGVvZiBwYWlyLmNsb3NlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGBhdXRvQ2xvc2luZ1BhaXJzWyR7aX1dLmNsb3NlXFxgIHRvIGJlIGEgc3RyaW5nLmApO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0eXBlb2YgcGFpci5ub3RJbiAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRpZiAoIWlzU3RyaW5nQXJyKHBhaXIubm90SW4pKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oYFske2xhbmd1YWdlSWR9XTogbGFuZ3VhZ2UgY29uZmlndXJhdGlvbjogZXhwZWN0ZWQgXFxgYXV0b0Nsb3NpbmdQYWlyc1ske2l9XS5ub3RJblxcYCB0byBiZSBhIHN0cmluZyBhcnJheS5gKTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHQgPSByZXN1bHQgfHwgW107XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHsgb3BlbjogcGFpci5vcGVuLCBjbG9zZTogcGFpci5jbG9zZSwgbm90SW46IHBhaXIubm90SW4gfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZXh0cmFjdFZhbGlkU3Vycm91bmRpbmdQYWlycyhsYW5ndWFnZUlkOiBzdHJpbmcsIGNvbmZpZ3VyYXRpb246IElMYW5ndWFnZUNvbmZpZ3VyYXRpb24pOiBJQXV0b0Nsb3NpbmdQYWlyW10gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHNvdXJjZSA9IGNvbmZpZ3VyYXRpb24uc3Vycm91bmRpbmdQYWlycztcblx0XHRpZiAodHlwZW9mIHNvdXJjZSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmICghQXJyYXkuaXNBcnJheShzb3VyY2UpKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oYFske2xhbmd1YWdlSWR9XTogbGFuZ3VhZ2UgY29uZmlndXJhdGlvbjogZXhwZWN0ZWQgXFxgc3Vycm91bmRpbmdQYWlyc1xcYCB0byBiZSBhbiBhcnJheS5gKTtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0bGV0IHJlc3VsdDogSUF1dG9DbG9zaW5nUGFpcltdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBzb3VyY2UubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHBhaXIgPSBzb3VyY2VbaV07XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShwYWlyKSkge1xuXHRcdFx0XHRpZiAoIWlzQ2hhcmFjdGVyUGFpcihwYWlyKSkge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGBzdXJyb3VuZGluZ1BhaXJzWyR7aX1dXFxgIHRvIGJlIGFuIGFycmF5IG9mIHR3byBzdHJpbmdzIG9yIGFuIG9iamVjdC5gKTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHQgPSByZXN1bHQgfHwgW107XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHsgb3BlbjogcGFpclswXSwgY2xvc2U6IHBhaXJbMV0gfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoIXR5cGVzLmlzT2JqZWN0KHBhaXIpKSB7XG5cdFx0XHRcdFx0Y29uc29sZS53YXJuKGBbJHtsYW5ndWFnZUlkfV06IGxhbmd1YWdlIGNvbmZpZ3VyYXRpb246IGV4cGVjdGVkIFxcYHN1cnJvdW5kaW5nUGFpcnNbJHtpfV1cXGAgdG8gYmUgYW4gYXJyYXkgb2YgdHdvIHN0cmluZ3Mgb3IgYW4gb2JqZWN0LmApO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0eXBlb2YgcGFpci5vcGVuICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGBzdXJyb3VuZGluZ1BhaXJzWyR7aX1dLm9wZW5cXGAgdG8gYmUgYSBzdHJpbmcuYCk7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHR5cGVvZiBwYWlyLmNsb3NlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGBzdXJyb3VuZGluZ1BhaXJzWyR7aX1dLmNsb3NlXFxgIHRvIGJlIGEgc3RyaW5nLmApO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc3VsdCA9IHJlc3VsdCB8fCBbXTtcblx0XHRcdFx0cmVzdWx0LnB1c2goeyBvcGVuOiBwYWlyLm9wZW4sIGNsb3NlOiBwYWlyLmNsb3NlIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2V4dHJhY3RWYWxpZENvbG9yaXplZEJyYWNrZXRQYWlycyhsYW5ndWFnZUlkOiBzdHJpbmcsIGNvbmZpZ3VyYXRpb246IElMYW5ndWFnZUNvbmZpZ3VyYXRpb24pOiBDaGFyYWN0ZXJQYWlyW10gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHNvdXJjZSA9IGNvbmZpZ3VyYXRpb24uY29sb3JpemVkQnJhY2tldFBhaXJzO1xuXHRcdGlmICh0eXBlb2Ygc291cmNlID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHNvdXJjZSkpIHtcblx0XHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGBjb2xvcml6ZWRCcmFja2V0UGFpcnNcXGAgdG8gYmUgYW4gYXJyYXkuYCk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdDogQ2hhcmFjdGVyUGFpcltdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHNvdXJjZS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgcGFpciA9IHNvdXJjZVtpXTtcblx0XHRcdGlmICghaXNDaGFyYWN0ZXJQYWlyKHBhaXIpKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGBjb2xvcml6ZWRCcmFja2V0UGFpcnNbJHtpfV1cXGAgdG8gYmUgYW4gYXJyYXkgb2YgdHdvIHN0cmluZ3MuYCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0LnB1c2goW3BhaXJbMF0sIHBhaXJbMV1dKTtcblxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2V4dHJhY3RWYWxpZE9uRW50ZXJSdWxlcyhsYW5ndWFnZUlkOiBzdHJpbmcsIGNvbmZpZ3VyYXRpb246IElMYW5ndWFnZUNvbmZpZ3VyYXRpb24pOiBPbkVudGVyUnVsZVtdIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBzb3VyY2UgPSBjb25maWd1cmF0aW9uLm9uRW50ZXJSdWxlcztcblx0XHRpZiAodHlwZW9mIHNvdXJjZSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmICghQXJyYXkuaXNBcnJheShzb3VyY2UpKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oYFske2xhbmd1YWdlSWR9XTogbGFuZ3VhZ2UgY29uZmlndXJhdGlvbjogZXhwZWN0ZWQgXFxgb25FbnRlclJ1bGVzXFxgIHRvIGJlIGFuIGFycmF5LmApO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRsZXQgcmVzdWx0OiBPbkVudGVyUnVsZVtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBzb3VyY2UubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IG9uRW50ZXJSdWxlID0gc291cmNlW2ldO1xuXHRcdFx0aWYgKCF0eXBlcy5pc09iamVjdChvbkVudGVyUnVsZSkpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKGBbJHtsYW5ndWFnZUlkfV06IGxhbmd1YWdlIGNvbmZpZ3VyYXRpb246IGV4cGVjdGVkIFxcYG9uRW50ZXJSdWxlc1ske2l9XVxcYCB0byBiZSBhbiBvYmplY3QuYCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0eXBlcy5pc09iamVjdChvbkVudGVyUnVsZS5hY3Rpb24pKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGBvbkVudGVyUnVsZXNbJHtpfV0uYWN0aW9uXFxgIHRvIGJlIGFuIG9iamVjdC5gKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRsZXQgaW5kZW50QWN0aW9uOiBJbmRlbnRBY3Rpb247XG5cdFx0XHRpZiAob25FbnRlclJ1bGUuYWN0aW9uLmluZGVudCA9PT0gJ25vbmUnKSB7XG5cdFx0XHRcdGluZGVudEFjdGlvbiA9IEluZGVudEFjdGlvbi5Ob25lO1xuXHRcdFx0fSBlbHNlIGlmIChvbkVudGVyUnVsZS5hY3Rpb24uaW5kZW50ID09PSAnaW5kZW50Jykge1xuXHRcdFx0XHRpbmRlbnRBY3Rpb24gPSBJbmRlbnRBY3Rpb24uSW5kZW50O1xuXHRcdFx0fSBlbHNlIGlmIChvbkVudGVyUnVsZS5hY3Rpb24uaW5kZW50ID09PSAnaW5kZW50T3V0ZGVudCcpIHtcblx0XHRcdFx0aW5kZW50QWN0aW9uID0gSW5kZW50QWN0aW9uLkluZGVudE91dGRlbnQ7XG5cdFx0XHR9IGVsc2UgaWYgKG9uRW50ZXJSdWxlLmFjdGlvbi5pbmRlbnQgPT09ICdvdXRkZW50Jykge1xuXHRcdFx0XHRpbmRlbnRBY3Rpb24gPSBJbmRlbnRBY3Rpb24uT3V0ZGVudDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGBvbkVudGVyUnVsZXNbJHtpfV0uYWN0aW9uLmluZGVudFxcYCB0byBiZSAnbm9uZScsICdpbmRlbnQnLCAnaW5kZW50T3V0ZGVudCcgb3IgJ291dGRlbnQnLmApO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGFjdGlvbjogRW50ZXJBY3Rpb24gPSB7IGluZGVudEFjdGlvbiB9O1xuXHRcdFx0aWYgKG9uRW50ZXJSdWxlLmFjdGlvbi5hcHBlbmRUZXh0KSB7XG5cdFx0XHRcdGlmICh0eXBlb2Ygb25FbnRlclJ1bGUuYWN0aW9uLmFwcGVuZFRleHQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0YWN0aW9uLmFwcGVuZFRleHQgPSBvbkVudGVyUnVsZS5hY3Rpb24uYXBwZW5kVGV4dDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oYFske2xhbmd1YWdlSWR9XTogbGFuZ3VhZ2UgY29uZmlndXJhdGlvbjogZXhwZWN0ZWQgXFxgb25FbnRlclJ1bGVzWyR7aX1dLmFjdGlvbi5hcHBlbmRUZXh0XFxgIHRvIGJlIHVuZGVmaW5lZCBvciBhIHN0cmluZy5gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKG9uRW50ZXJSdWxlLmFjdGlvbi5yZW1vdmVUZXh0KSB7XG5cdFx0XHRcdGlmICh0eXBlb2Ygb25FbnRlclJ1bGUuYWN0aW9uLnJlbW92ZVRleHQgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0YWN0aW9uLnJlbW92ZVRleHQgPSBvbkVudGVyUnVsZS5hY3Rpb24ucmVtb3ZlVGV4dDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oYFske2xhbmd1YWdlSWR9XTogbGFuZ3VhZ2UgY29uZmlndXJhdGlvbjogZXhwZWN0ZWQgXFxgb25FbnRlclJ1bGVzWyR7aX1dLmFjdGlvbi5yZW1vdmVUZXh0XFxgIHRvIGJlIHVuZGVmaW5lZCBvciBhIG51bWJlci5gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYmVmb3JlVGV4dCA9IHRoaXMuX3BhcnNlUmVnZXgobGFuZ3VhZ2VJZCwgYG9uRW50ZXJSdWxlc1ske2l9XS5iZWZvcmVUZXh0YCwgb25FbnRlclJ1bGUuYmVmb3JlVGV4dCk7XG5cdFx0XHRpZiAoIWJlZm9yZVRleHQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZXN1bHRpbmdPbkVudGVyUnVsZTogT25FbnRlclJ1bGUgPSB7IGJlZm9yZVRleHQsIGFjdGlvbiB9O1xuXHRcdFx0aWYgKG9uRW50ZXJSdWxlLmFmdGVyVGV4dCkge1xuXHRcdFx0XHRjb25zdCBhZnRlclRleHQgPSB0aGlzLl9wYXJzZVJlZ2V4KGxhbmd1YWdlSWQsIGBvbkVudGVyUnVsZXNbJHtpfV0uYWZ0ZXJUZXh0YCwgb25FbnRlclJ1bGUuYWZ0ZXJUZXh0KTtcblx0XHRcdFx0aWYgKGFmdGVyVGV4dCkge1xuXHRcdFx0XHRcdHJlc3VsdGluZ09uRW50ZXJSdWxlLmFmdGVyVGV4dCA9IGFmdGVyVGV4dDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKG9uRW50ZXJSdWxlLnByZXZpb3VzTGluZVRleHQpIHtcblx0XHRcdFx0Y29uc3QgcHJldmlvdXNMaW5lVGV4dCA9IHRoaXMuX3BhcnNlUmVnZXgobGFuZ3VhZ2VJZCwgYG9uRW50ZXJSdWxlc1ske2l9XS5wcmV2aW91c0xpbmVUZXh0YCwgb25FbnRlclJ1bGUucHJldmlvdXNMaW5lVGV4dCk7XG5cdFx0XHRcdGlmIChwcmV2aW91c0xpbmVUZXh0KSB7XG5cdFx0XHRcdFx0cmVzdWx0aW5nT25FbnRlclJ1bGUucHJldmlvdXNMaW5lVGV4dCA9IHByZXZpb3VzTGluZVRleHQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJlc3VsdCA9IHJlc3VsdCB8fCBbXTtcblx0XHRcdHJlc3VsdC5wdXNoKHJlc3VsdGluZ09uRW50ZXJSdWxlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBleHRyYWN0VmFsaWRDb25maWcobGFuZ3VhZ2VJZDogc3RyaW5nLCBjb25maWd1cmF0aW9uOiBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uKTogRXhwbGljaXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24ge1xuXG5cdFx0Y29uc3QgY29tbWVudHMgPSB0aGlzLl9leHRyYWN0VmFsaWRDb21tZW50UnVsZShsYW5ndWFnZUlkLCBjb25maWd1cmF0aW9uKTtcblx0XHRjb25zdCBicmFja2V0cyA9IHRoaXMuX2V4dHJhY3RWYWxpZEJyYWNrZXRzKGxhbmd1YWdlSWQsIGNvbmZpZ3VyYXRpb24pO1xuXHRcdGNvbnN0IGF1dG9DbG9zaW5nUGFpcnMgPSB0aGlzLl9leHRyYWN0VmFsaWRBdXRvQ2xvc2luZ1BhaXJzKGxhbmd1YWdlSWQsIGNvbmZpZ3VyYXRpb24pO1xuXHRcdGNvbnN0IHN1cnJvdW5kaW5nUGFpcnMgPSB0aGlzLl9leHRyYWN0VmFsaWRTdXJyb3VuZGluZ1BhaXJzKGxhbmd1YWdlSWQsIGNvbmZpZ3VyYXRpb24pO1xuXHRcdGNvbnN0IGNvbG9yaXplZEJyYWNrZXRQYWlycyA9IHRoaXMuX2V4dHJhY3RWYWxpZENvbG9yaXplZEJyYWNrZXRQYWlycyhsYW5ndWFnZUlkLCBjb25maWd1cmF0aW9uKTtcblx0XHRjb25zdCBhdXRvQ2xvc2VCZWZvcmUgPSAodHlwZW9mIGNvbmZpZ3VyYXRpb24uYXV0b0Nsb3NlQmVmb3JlID09PSAnc3RyaW5nJyA/IGNvbmZpZ3VyYXRpb24uYXV0b0Nsb3NlQmVmb3JlIDogdW5kZWZpbmVkKTtcblx0XHRjb25zdCB3b3JkUGF0dGVybiA9IChjb25maWd1cmF0aW9uLndvcmRQYXR0ZXJuID8gdGhpcy5fcGFyc2VSZWdleChsYW5ndWFnZUlkLCBgd29yZFBhdHRlcm5gLCBjb25maWd1cmF0aW9uLndvcmRQYXR0ZXJuKSA6IHVuZGVmaW5lZCk7XG5cdFx0Y29uc3QgaW5kZW50YXRpb25SdWxlcyA9IChjb25maWd1cmF0aW9uLmluZGVudGF0aW9uUnVsZXMgPyB0aGlzLl9tYXBJbmRlbnRhdGlvblJ1bGVzKGxhbmd1YWdlSWQsIGNvbmZpZ3VyYXRpb24uaW5kZW50YXRpb25SdWxlcykgOiB1bmRlZmluZWQpO1xuXHRcdGxldCBmb2xkaW5nOiBGb2xkaW5nUnVsZXMgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGNvbmZpZ3VyYXRpb24uZm9sZGluZykge1xuXHRcdFx0Y29uc3QgcmF3TWFya2VycyA9IGNvbmZpZ3VyYXRpb24uZm9sZGluZy5tYXJrZXJzO1xuXHRcdFx0Y29uc3Qgc3RhcnRNYXJrZXIgPSAocmF3TWFya2VycyAmJiByYXdNYXJrZXJzLnN0YXJ0ID8gdGhpcy5fcGFyc2VSZWdleChsYW5ndWFnZUlkLCBgZm9sZGluZy5tYXJrZXJzLnN0YXJ0YCwgcmF3TWFya2Vycy5zdGFydCkgOiB1bmRlZmluZWQpO1xuXHRcdFx0Y29uc3QgZW5kTWFya2VyID0gKHJhd01hcmtlcnMgJiYgcmF3TWFya2Vycy5lbmQgPyB0aGlzLl9wYXJzZVJlZ2V4KGxhbmd1YWdlSWQsIGBmb2xkaW5nLm1hcmtlcnMuZW5kYCwgcmF3TWFya2Vycy5lbmQpIDogdW5kZWZpbmVkKTtcblx0XHRcdGNvbnN0IG1hcmtlcnM6IEZvbGRpbmdNYXJrZXJzIHwgdW5kZWZpbmVkID0gKHN0YXJ0TWFya2VyICYmIGVuZE1hcmtlciA/IHsgc3RhcnQ6IHN0YXJ0TWFya2VyLCBlbmQ6IGVuZE1hcmtlciB9IDogdW5kZWZpbmVkKTtcblx0XHRcdGZvbGRpbmcgPSB7XG5cdFx0XHRcdG9mZlNpZGU6IGNvbmZpZ3VyYXRpb24uZm9sZGluZy5vZmZTaWRlLFxuXHRcdFx0XHRtYXJrZXJzXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRjb25zdCBvbkVudGVyUnVsZXMgPSB0aGlzLl9leHRyYWN0VmFsaWRPbkVudGVyUnVsZXMobGFuZ3VhZ2VJZCwgY29uZmlndXJhdGlvbik7XG5cblx0XHRjb25zdCByaWNoRWRpdENvbmZpZzogRXhwbGljaXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHRjb21tZW50cyxcblx0XHRcdGJyYWNrZXRzLFxuXHRcdFx0d29yZFBhdHRlcm4sXG5cdFx0XHRpbmRlbnRhdGlvblJ1bGVzLFxuXHRcdFx0b25FbnRlclJ1bGVzLFxuXHRcdFx0YXV0b0Nsb3NpbmdQYWlycyxcblx0XHRcdHN1cnJvdW5kaW5nUGFpcnMsXG5cdFx0XHRjb2xvcml6ZWRCcmFja2V0UGFpcnMsXG5cdFx0XHRhdXRvQ2xvc2VCZWZvcmUsXG5cdFx0XHRmb2xkaW5nLFxuXHRcdFx0X19lbGVjdHJpY0NoYXJhY3RlclN1cHBvcnQ6IHVuZGVmaW5lZCxcblx0XHR9O1xuXHRcdHJldHVybiByaWNoRWRpdENvbmZpZztcblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZUNvbmZpZyhsYW5ndWFnZUlkOiBzdHJpbmcsIGNvbmZpZ3VyYXRpb246IElMYW5ndWFnZUNvbmZpZ3VyYXRpb24pOiB2b2lkIHtcblx0XHRjb25zdCByaWNoRWRpdENvbmZpZyA9IExhbmd1YWdlQ29uZmlndXJhdGlvbkZpbGVIYW5kbGVyLmV4dHJhY3RWYWxpZENvbmZpZyhsYW5ndWFnZUlkLCBjb25maWd1cmF0aW9uKTtcblx0XHR0aGlzLl9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKGxhbmd1YWdlSWQsIHJpY2hFZGl0Q29uZmlnLCA1MCk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfcGFyc2VSZWdleChsYW5ndWFnZUlkOiBzdHJpbmcsIGNvbmZQYXRoOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcgfCBJUmVnRXhwKTogUmVnRXhwIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuIG5ldyBSZWdFeHAodmFsdWUsICcnKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oYFske2xhbmd1YWdlSWR9XTogSW52YWxpZCByZWd1bGFyIGV4cHJlc3Npb24gaW4gXFxgJHtjb25mUGF0aH1cXGA6IGAsIGVycik7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICh0eXBlcy5pc09iamVjdCh2YWx1ZSkpIHtcblx0XHRcdGlmICh0eXBlb2YgdmFsdWUucGF0dGVybiAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKGBbJHtsYW5ndWFnZUlkfV06IGxhbmd1YWdlIGNvbmZpZ3VyYXRpb246IGV4cGVjdGVkIFxcYCR7Y29uZlBhdGh9LnBhdHRlcm5cXGAgdG8gYmUgYSBzdHJpbmcuYCk7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAodHlwZW9mIHZhbHVlLmZsYWdzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgdmFsdWUuZmxhZ3MgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGAke2NvbmZQYXRofS5mbGFnc1xcYCB0byBiZSBhIHN0cmluZy5gKTtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJldHVybiBuZXcgUmVnRXhwKHZhbHVlLnBhdHRlcm4sIHZhbHVlLmZsYWdzKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oYFske2xhbmd1YWdlSWR9XTogSW52YWxpZCByZWd1bGFyIGV4cHJlc3Npb24gaW4gXFxgJHtjb25mUGF0aH1cXGA6IGAsIGVycik7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnNvbGUud2FybihgWyR7bGFuZ3VhZ2VJZH1dOiBsYW5ndWFnZSBjb25maWd1cmF0aW9uOiBleHBlY3RlZCBcXGAke2NvbmZQYXRofVxcYCB0byBiZSBhIHN0cmluZyBvciBhbiBvYmplY3QuYCk7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9tYXBJbmRlbnRhdGlvblJ1bGVzKGxhbmd1YWdlSWQ6IHN0cmluZywgaW5kZW50YXRpb25SdWxlczogSUluZGVudGF0aW9uUnVsZXMpOiBJbmRlbnRhdGlvblJ1bGUgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGluY3JlYXNlSW5kZW50UGF0dGVybiA9IHRoaXMuX3BhcnNlUmVnZXgobGFuZ3VhZ2VJZCwgYGluZGVudGF0aW9uUnVsZXMuaW5jcmVhc2VJbmRlbnRQYXR0ZXJuYCwgaW5kZW50YXRpb25SdWxlcy5pbmNyZWFzZUluZGVudFBhdHRlcm4pO1xuXHRcdGlmICghaW5jcmVhc2VJbmRlbnRQYXR0ZXJuKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBkZWNyZWFzZUluZGVudFBhdHRlcm4gPSB0aGlzLl9wYXJzZVJlZ2V4KGxhbmd1YWdlSWQsIGBpbmRlbnRhdGlvblJ1bGVzLmRlY3JlYXNlSW5kZW50UGF0dGVybmAsIGluZGVudGF0aW9uUnVsZXMuZGVjcmVhc2VJbmRlbnRQYXR0ZXJuKTtcblx0XHRpZiAoIWRlY3JlYXNlSW5kZW50UGF0dGVybikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQ6IEluZGVudGF0aW9uUnVsZSA9IHtcblx0XHRcdGluY3JlYXNlSW5kZW50UGF0dGVybjogaW5jcmVhc2VJbmRlbnRQYXR0ZXJuLFxuXHRcdFx0ZGVjcmVhc2VJbmRlbnRQYXR0ZXJuOiBkZWNyZWFzZUluZGVudFBhdHRlcm5cblx0XHR9O1xuXG5cdFx0aWYgKGluZGVudGF0aW9uUnVsZXMuaW5kZW50TmV4dExpbmVQYXR0ZXJuKSB7XG5cdFx0XHRyZXN1bHQuaW5kZW50TmV4dExpbmVQYXR0ZXJuID0gdGhpcy5fcGFyc2VSZWdleChsYW5ndWFnZUlkLCBgaW5kZW50YXRpb25SdWxlcy5pbmRlbnROZXh0TGluZVBhdHRlcm5gLCBpbmRlbnRhdGlvblJ1bGVzLmluZGVudE5leHRMaW5lUGF0dGVybik7XG5cdFx0fVxuXHRcdGlmIChpbmRlbnRhdGlvblJ1bGVzLnVuSW5kZW50ZWRMaW5lUGF0dGVybikge1xuXHRcdFx0cmVzdWx0LnVuSW5kZW50ZWRMaW5lUGF0dGVybiA9IHRoaXMuX3BhcnNlUmVnZXgobGFuZ3VhZ2VJZCwgYGluZGVudGF0aW9uUnVsZXMudW5JbmRlbnRlZExpbmVQYXR0ZXJuYCwgaW5kZW50YXRpb25SdWxlcy51bkluZGVudGVkTGluZVBhdHRlcm4pO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuY29uc3Qgc2NoZW1hSWQgPSAndnNjb2RlOi8vc2NoZW1hcy9sYW5ndWFnZS1jb25maWd1cmF0aW9uJztcbmNvbnN0IHNjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdGFsbG93Q29tbWVudHM6IHRydWUsXG5cdGFsbG93VHJhaWxpbmdDb21tYXM6IHRydWUsXG5cdGRlZmF1bHQ6IHtcblx0XHRjb21tZW50czoge1xuXHRcdFx0YmxvY2tDb21tZW50OiBbJy8qJywgJyovJ10sXG5cdFx0XHRsaW5lQ29tbWVudDogJy8vJ1xuXHRcdH0sXG5cdFx0YnJhY2tldHM6IFtbJygnLCAnKSddLCBbJ1snLCAnXSddLCBbJ3snLCAnfSddXSxcblx0XHRhdXRvQ2xvc2luZ1BhaXJzOiBbWycoJywgJyknXSwgWydbJywgJ10nXSwgWyd7JywgJ30nXV0sXG5cdFx0c3Vycm91bmRpbmdQYWlyczogW1snKCcsICcpJ10sIFsnWycsICddJ10sIFsneycsICd9J11dXG5cdH0sXG5cdGRlZmluaXRpb25zOiB7XG5cdFx0b3BlbkJyYWNrZXQ6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLm9wZW5CcmFja2V0JywgJ1RoZSBvcGVuaW5nIGJyYWNrZXQgY2hhcmFjdGVyIG9yIHN0cmluZyBzZXF1ZW5jZS4nKVxuXHRcdH0sXG5cdFx0Y2xvc2VCcmFja2V0OiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5jbG9zZUJyYWNrZXQnLCAnVGhlIGNsb3NpbmcgYnJhY2tldCBjaGFyYWN0ZXIgb3Igc3RyaW5nIHNlcXVlbmNlLicpXG5cdFx0fSxcblx0XHRicmFja2V0UGFpcjoge1xuXHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdGl0ZW1zOiBbe1xuXHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9vcGVuQnJhY2tldCdcblx0XHRcdH0sIHtcblx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvY2xvc2VCcmFja2V0J1xuXHRcdFx0fV1cblx0XHR9XG5cdH0sXG5cdHByb3BlcnRpZXM6IHtcblx0XHRjb21tZW50czoge1xuXHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHRibG9ja0NvbW1lbnQ6IFsnLyonLCAnKi8nXSxcblx0XHRcdFx0bGluZUNvbW1lbnQ6ICcvLydcblx0XHRcdH0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuY29tbWVudHMnLCAnRGVmaW5lcyB0aGUgY29tbWVudCBzeW1ib2xzJyksXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0YmxvY2tDb21tZW50OiB7XG5cdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuYmxvY2tDb21tZW50cycsICdEZWZpbmVzIGhvdyBibG9jayBjb21tZW50cyBhcmUgbWFya2VkLicpLFxuXHRcdFx0XHRcdGl0ZW1zOiBbe1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuYmxvY2tDb21tZW50LmJlZ2luJywgJ1RoZSBjaGFyYWN0ZXIgc2VxdWVuY2UgdGhhdCBzdGFydHMgYSBibG9jayBjb21tZW50LicpXG5cdFx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuYmxvY2tDb21tZW50LmVuZCcsICdUaGUgY2hhcmFjdGVyIHNlcXVlbmNlIHRoYXQgZW5kcyBhIGJsb2NrIGNvbW1lbnQuJylcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRsaW5lQ29tbWVudDoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5saW5lQ29tbWVudCcsICdUaGUgY2hhcmFjdGVyIHNlcXVlbmNlIHRoYXQgc3RhcnRzIGEgbGluZSBjb21tZW50LicpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdGJyYWNrZXRzOiB7XG5cdFx0XHRkZWZhdWx0OiBbWycoJywgJyknXSwgWydbJywgJ10nXSwgWyd7JywgJ30nXV0sXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5icmFja2V0cycsICdEZWZpbmVzIHRoZSBicmFja2V0IHN5bWJvbHMgdGhhdCBpbmNyZWFzZSBvciBkZWNyZWFzZSB0aGUgaW5kZW50YXRpb24uIFdoZW4gYnJhY2tldCBwYWlyIGNvbG9yaXphdGlvbiBpcyBlbmFibGVkIGFuZCB7MH0gaXMgbm90IGRlZmluZWQsIHRoaXMgYWxzbyBkZWZpbmVzIHRoZSBicmFja2V0IHBhaXJzIHRoYXQgYXJlIGNvbG9yaXplZCBieSB0aGVpciBuZXN0aW5nIGxldmVsLicsICdcXGBjb2xvcml6ZWRCcmFja2V0UGFpcnNcXGAnKSxcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRpdGVtczoge1xuXHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9icmFja2V0UGFpcidcblx0XHRcdH1cblx0XHR9LFxuXHRcdGNvbG9yaXplZEJyYWNrZXRQYWlyczoge1xuXHRcdFx0ZGVmYXVsdDogW1snKCcsICcpJ10sIFsnWycsICddJ10sIFsneycsICd9J11dLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuY29sb3JpemVkQnJhY2tldFBhaXJzJywgJ0RlZmluZXMgdGhlIGJyYWNrZXQgcGFpcnMgdGhhdCBhcmUgY29sb3JpemVkIGJ5IHRoZWlyIG5lc3RpbmcgbGV2ZWwgaWYgYnJhY2tldCBwYWlyIGNvbG9yaXphdGlvbiBpcyBlbmFibGVkLiBBbnkgYnJhY2tldHMgaW5jbHVkZWQgaGVyZSB0aGF0IGFyZSBub3QgaW5jbHVkZWQgaW4gezB9IHdpbGwgYmUgYXV0b21hdGljYWxseSBpbmNsdWRlZCBpbiB7MH0uJywgJ1xcYGJyYWNrZXRzXFxgJyksXG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvYnJhY2tldFBhaXInXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRhdXRvQ2xvc2luZ1BhaXJzOiB7XG5cdFx0XHRkZWZhdWx0OiBbWycoJywgJyknXSwgWydbJywgJ10nXSwgWyd7JywgJ30nXV0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuYXV0b0Nsb3NpbmdQYWlycycsICdEZWZpbmVzIHRoZSBicmFja2V0IHBhaXJzLiBXaGVuIGEgb3BlbmluZyBicmFja2V0IGlzIGVudGVyZWQsIHRoZSBjbG9zaW5nIGJyYWNrZXQgaXMgaW5zZXJ0ZWQgYXV0b21hdGljYWxseS4nKSxcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRpdGVtczoge1xuXHRcdFx0XHRvbmVPZjogW3tcblx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9icmFja2V0UGFpcidcblx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdG9wZW46IHtcblx0XHRcdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvb3BlbkJyYWNrZXQnXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0Y2xvc2U6IHtcblx0XHRcdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvY2xvc2VCcmFja2V0J1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdG5vdEluOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5hdXRvQ2xvc2luZ1BhaXJzLm5vdEluJywgJ0RlZmluZXMgYSBsaXN0IG9mIHNjb3BlcyB3aGVyZSB0aGUgYXV0byBwYWlycyBhcmUgZGlzYWJsZWQuJyksXG5cdFx0XHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHRcdFx0ZW51bTogWydzdHJpbmcnLCAnY29tbWVudCddXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1dXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRhdXRvQ2xvc2VCZWZvcmU6IHtcblx0XHRcdGRlZmF1bHQ6ICc7Oi4sPX1dKT4gXFxuXFx0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5hdXRvQ2xvc2VCZWZvcmUnLCAnRGVmaW5lcyB3aGF0IGNoYXJhY3RlcnMgbXVzdCBiZSBhZnRlciB0aGUgY3Vyc29yIGluIG9yZGVyIGZvciBicmFja2V0IG9yIHF1b3RlIGF1dG9jbG9zaW5nIHRvIG9jY3VyIHdoZW4gdXNpbmcgdGhlIFxcJ2xhbmd1YWdlRGVmaW5lZFxcJyBhdXRvY2xvc2luZyBzZXR0aW5nLiBUaGlzIGlzIHR5cGljYWxseSB0aGUgc2V0IG9mIGNoYXJhY3RlcnMgd2hpY2ggY2FuIG5vdCBzdGFydCBhbiBleHByZXNzaW9uLicpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0fSxcblx0XHRzdXJyb3VuZGluZ1BhaXJzOiB7XG5cdFx0XHRkZWZhdWx0OiBbWycoJywgJyknXSwgWydbJywgJ10nXSwgWyd7JywgJ30nXV0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuc3Vycm91bmRpbmdQYWlycycsICdEZWZpbmVzIHRoZSBicmFja2V0IHBhaXJzIHRoYXQgY2FuIGJlIHVzZWQgdG8gc3Vycm91bmQgYSBzZWxlY3RlZCBzdHJpbmcuJyksXG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0b25lT2Y6IFt7XG5cdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvYnJhY2tldFBhaXInXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRvcGVuOiB7XG5cdFx0XHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL29wZW5CcmFja2V0J1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGNsb3NlOiB7XG5cdFx0XHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL2Nsb3NlQnJhY2tldCdcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1dXG5cdFx0XHR9XG5cdFx0fSxcblx0XHR3b3JkUGF0dGVybjoge1xuXHRcdFx0ZGVmYXVsdDogJycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEud29yZFBhdHRlcm4nLCAnRGVmaW5lcyB3aGF0IGlzIGNvbnNpZGVyZWQgdG8gYmUgYSB3b3JkIGluIHRoZSBwcm9ncmFtbWluZyBsYW5ndWFnZS4nKSxcblx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ29iamVjdCddLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRwYXR0ZXJuOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLndvcmRQYXR0ZXJuLnBhdHRlcm4nLCAnVGhlIFJlZ0V4cCBwYXR0ZXJuIHVzZWQgdG8gbWF0Y2ggd29yZHMuJyksXG5cdFx0XHRcdFx0ZGVmYXVsdDogJycsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGZsYWdzOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLndvcmRQYXR0ZXJuLmZsYWdzJywgJ1RoZSBSZWdFeHAgZmxhZ3MgdXNlZCB0byBtYXRjaCB3b3Jkcy4nKSxcblx0XHRcdFx0XHRkZWZhdWx0OiAnZycsXG5cdFx0XHRcdFx0cGF0dGVybjogJ14oW2dpbXV5XSspJCcsXG5cdFx0XHRcdFx0cGF0dGVybkVycm9yTWVzc2FnZTogbmxzLmxvY2FsaXplKCdzY2hlbWEud29yZFBhdHRlcm4uZmxhZ3MuZXJyb3JNZXNzYWdlJywgJ011c3QgbWF0Y2ggdGhlIHBhdHRlcm4gYC9eKFtnaW11eV0rKSQvYC4nKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRpbmRlbnRhdGlvblJ1bGVzOiB7XG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdGluY3JlYXNlSW5kZW50UGF0dGVybjogJycsXG5cdFx0XHRcdGRlY3JlYXNlSW5kZW50UGF0dGVybjogJydcblx0XHRcdH0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuaW5kZW50YXRpb25SdWxlcycsICdUaGUgbGFuZ3VhZ2VcXCdzIGluZGVudGF0aW9uIHNldHRpbmdzLicpLFxuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGluY3JlYXNlSW5kZW50UGF0dGVybjoge1xuXHRcdFx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ29iamVjdCddLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5pbmRlbnRhdGlvblJ1bGVzLmluY3JlYXNlSW5kZW50UGF0dGVybicsICdJZiBhIGxpbmUgbWF0Y2hlcyB0aGlzIHBhdHRlcm4sIHRoZW4gYWxsIHRoZSBsaW5lcyBhZnRlciBpdCBzaG91bGQgYmUgaW5kZW50ZWQgb25jZSAodW50aWwgYW5vdGhlciBydWxlIG1hdGNoZXMpLicpLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdHBhdHRlcm46IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5pbmRlbnRhdGlvblJ1bGVzLmluY3JlYXNlSW5kZW50UGF0dGVybi5wYXR0ZXJuJywgJ1RoZSBSZWdFeHAgcGF0dGVybiBmb3IgaW5jcmVhc2VJbmRlbnRQYXR0ZXJuLicpLFxuXHRcdFx0XHRcdFx0XHRkZWZhdWx0OiAnJyxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRmbGFnczoge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmluZGVudGF0aW9uUnVsZXMuaW5jcmVhc2VJbmRlbnRQYXR0ZXJuLmZsYWdzJywgJ1RoZSBSZWdFeHAgZmxhZ3MgZm9yIGluY3JlYXNlSW5kZW50UGF0dGVybi4nKSxcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogJycsXG5cdFx0XHRcdFx0XHRcdHBhdHRlcm46ICdeKFtnaW11eV0rKSQnLFxuXHRcdFx0XHRcdFx0XHRwYXR0ZXJuRXJyb3JNZXNzYWdlOiBubHMubG9jYWxpemUoJ3NjaGVtYS5pbmRlbnRhdGlvblJ1bGVzLmluY3JlYXNlSW5kZW50UGF0dGVybi5lcnJvck1lc3NhZ2UnLCAnTXVzdCBtYXRjaCB0aGUgcGF0dGVybiBgL14oW2dpbXV5XSspJC9gLicpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRkZWNyZWFzZUluZGVudFBhdHRlcm46IHtcblx0XHRcdFx0XHR0eXBlOiBbJ3N0cmluZycsICdvYmplY3QnXSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuaW5kZW50YXRpb25SdWxlcy5kZWNyZWFzZUluZGVudFBhdHRlcm4nLCAnSWYgYSBsaW5lIG1hdGNoZXMgdGhpcyBwYXR0ZXJuLCB0aGVuIGFsbCB0aGUgbGluZXMgYWZ0ZXIgaXQgc2hvdWxkIGJlIHVuaW5kZW50ZWQgb25jZSAodW50aWwgYW5vdGhlciBydWxlIG1hdGNoZXMpLicpLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdHBhdHRlcm46IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5pbmRlbnRhdGlvblJ1bGVzLmRlY3JlYXNlSW5kZW50UGF0dGVybi5wYXR0ZXJuJywgJ1RoZSBSZWdFeHAgcGF0dGVybiBmb3IgZGVjcmVhc2VJbmRlbnRQYXR0ZXJuLicpLFxuXHRcdFx0XHRcdFx0XHRkZWZhdWx0OiAnJyxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRmbGFnczoge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmluZGVudGF0aW9uUnVsZXMuZGVjcmVhc2VJbmRlbnRQYXR0ZXJuLmZsYWdzJywgJ1RoZSBSZWdFeHAgZmxhZ3MgZm9yIGRlY3JlYXNlSW5kZW50UGF0dGVybi4nKSxcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogJycsXG5cdFx0XHRcdFx0XHRcdHBhdHRlcm46ICdeKFtnaW11eV0rKSQnLFxuXHRcdFx0XHRcdFx0XHRwYXR0ZXJuRXJyb3JNZXNzYWdlOiBubHMubG9jYWxpemUoJ3NjaGVtYS5pbmRlbnRhdGlvblJ1bGVzLmRlY3JlYXNlSW5kZW50UGF0dGVybi5lcnJvck1lc3NhZ2UnLCAnTXVzdCBtYXRjaCB0aGUgcGF0dGVybiBgL14oW2dpbXV5XSspJC9gLicpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRpbmRlbnROZXh0TGluZVBhdHRlcm46IHtcblx0XHRcdFx0XHR0eXBlOiBbJ3N0cmluZycsICdvYmplY3QnXSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuaW5kZW50YXRpb25SdWxlcy5pbmRlbnROZXh0TGluZVBhdHRlcm4nLCAnSWYgYSBsaW5lIG1hdGNoZXMgdGhpcyBwYXR0ZXJuLCB0aGVuICoqb25seSB0aGUgbmV4dCBsaW5lKiogYWZ0ZXIgaXQgc2hvdWxkIGJlIGluZGVudGVkIG9uY2UuJyksXG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0cGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmluZGVudGF0aW9uUnVsZXMuaW5kZW50TmV4dExpbmVQYXR0ZXJuLnBhdHRlcm4nLCAnVGhlIFJlZ0V4cCBwYXR0ZXJuIGZvciBpbmRlbnROZXh0TGluZVBhdHRlcm4uJyksXG5cdFx0XHRcdFx0XHRcdGRlZmF1bHQ6ICcnLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGZsYWdzOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuaW5kZW50YXRpb25SdWxlcy5pbmRlbnROZXh0TGluZVBhdHRlcm4uZmxhZ3MnLCAnVGhlIFJlZ0V4cCBmbGFncyBmb3IgaW5kZW50TmV4dExpbmVQYXR0ZXJuLicpLFxuXHRcdFx0XHRcdFx0XHRkZWZhdWx0OiAnJyxcblx0XHRcdFx0XHRcdFx0cGF0dGVybjogJ14oW2dpbXV5XSspJCcsXG5cdFx0XHRcdFx0XHRcdHBhdHRlcm5FcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmluZGVudGF0aW9uUnVsZXMuaW5kZW50TmV4dExpbmVQYXR0ZXJuLmVycm9yTWVzc2FnZScsICdNdXN0IG1hdGNoIHRoZSBwYXR0ZXJuIGAvXihbZ2ltdXldKykkL2AuJylcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHVuSW5kZW50ZWRMaW5lUGF0dGVybjoge1xuXHRcdFx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ29iamVjdCddLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5pbmRlbnRhdGlvblJ1bGVzLnVuSW5kZW50ZWRMaW5lUGF0dGVybicsICdJZiBhIGxpbmUgbWF0Y2hlcyB0aGlzIHBhdHRlcm4sIHRoZW4gaXRzIGluZGVudGF0aW9uIHNob3VsZCBub3QgYmUgY2hhbmdlZCBhbmQgaXQgc2hvdWxkIG5vdCBiZSBldmFsdWF0ZWQgYWdhaW5zdCB0aGUgb3RoZXIgcnVsZXMuJyksXG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0cGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmluZGVudGF0aW9uUnVsZXMudW5JbmRlbnRlZExpbmVQYXR0ZXJuLnBhdHRlcm4nLCAnVGhlIFJlZ0V4cCBwYXR0ZXJuIGZvciB1bkluZGVudGVkTGluZVBhdHRlcm4uJyksXG5cdFx0XHRcdFx0XHRcdGRlZmF1bHQ6ICcnLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGZsYWdzOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuaW5kZW50YXRpb25SdWxlcy51bkluZGVudGVkTGluZVBhdHRlcm4uZmxhZ3MnLCAnVGhlIFJlZ0V4cCBmbGFncyBmb3IgdW5JbmRlbnRlZExpbmVQYXR0ZXJuLicpLFxuXHRcdFx0XHRcdFx0XHRkZWZhdWx0OiAnJyxcblx0XHRcdFx0XHRcdFx0cGF0dGVybjogJ14oW2dpbXV5XSspJCcsXG5cdFx0XHRcdFx0XHRcdHBhdHRlcm5FcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmluZGVudGF0aW9uUnVsZXMudW5JbmRlbnRlZExpbmVQYXR0ZXJuLmVycm9yTWVzc2FnZScsICdNdXN0IG1hdGNoIHRoZSBwYXR0ZXJuIGAvXihbZ2ltdXldKykkL2AuJylcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdGZvbGRpbmc6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZvbGRpbmcnLCAnVGhlIGxhbmd1YWdlXFwncyBmb2xkaW5nIHNldHRpbmdzLicpLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRvZmZTaWRlOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5mb2xkaW5nLm9mZlNpZGUnLCAnQSBsYW5ndWFnZSBhZGhlcmVzIHRvIHRoZSBvZmYtc2lkZSBydWxlIGlmIGJsb2NrcyBpbiB0aGF0IGxhbmd1YWdlIGFyZSBleHByZXNzZWQgYnkgdGhlaXIgaW5kZW50YXRpb24uIElmIHNldCwgZW1wdHkgbGluZXMgYmVsb25nIHRvIHRoZSBzdWJzZXF1ZW50IGJsb2NrLicpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRtYXJrZXJzOiB7XG5cdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZvbGRpbmcubWFya2VycycsICdMYW5ndWFnZSBzcGVjaWZpYyBmb2xkaW5nIG1hcmtlcnMgc3VjaCBhcyBcXCcjcmVnaW9uXFwnIGFuZCBcXCcjZW5kcmVnaW9uXFwnLiBUaGUgc3RhcnQgYW5kIGVuZCByZWdleGVzIHdpbGwgYmUgdGVzdGVkIGFnYWluc3QgdGhlIGNvbnRlbnRzIG9mIGFsbCBsaW5lcyBhbmQgbXVzdCBiZSBkZXNpZ25lZCBlZmZpY2llbnRseScpLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdHN0YXJ0OiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEuZm9sZGluZy5tYXJrZXJzLnN0YXJ0JywgJ1RoZSBSZWdFeHAgcGF0dGVybiBmb3IgdGhlIHN0YXJ0IG1hcmtlci4gVGhlIHJlZ2V4cCBtdXN0IHN0YXJ0IHdpdGggXFwnXlxcJy4nKVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGVuZDoge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLmZvbGRpbmcubWFya2Vycy5lbmQnLCAnVGhlIFJlZ0V4cCBwYXR0ZXJuIGZvciB0aGUgZW5kIG1hcmtlci4gVGhlIHJlZ2V4cCBtdXN0IHN0YXJ0IHdpdGggXFwnXlxcJy4nKVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdG9uRW50ZXJSdWxlczoge1xuXHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5vbkVudGVyUnVsZXMnLCAnVGhlIGxhbmd1YWdlXFwncyBydWxlcyB0byBiZSBldmFsdWF0ZWQgd2hlbiBwcmVzc2luZyBFbnRlci4nKSxcblx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEub25FbnRlclJ1bGVzJywgJ1RoZSBsYW5ndWFnZVxcJ3MgcnVsZXMgdG8gYmUgZXZhbHVhdGVkIHdoZW4gcHJlc3NpbmcgRW50ZXIuJyksXG5cdFx0XHRcdHJlcXVpcmVkOiBbJ2JlZm9yZVRleHQnLCAnYWN0aW9uJ10sXG5cdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRiZWZvcmVUZXh0OiB7XG5cdFx0XHRcdFx0XHR0eXBlOiBbJ3N0cmluZycsICdvYmplY3QnXSxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5vbkVudGVyUnVsZXMuYmVmb3JlVGV4dCcsICdUaGlzIHJ1bGUgd2lsbCBvbmx5IGV4ZWN1dGUgaWYgdGhlIHRleHQgYmVmb3JlIHRoZSBjdXJzb3IgbWF0Y2hlcyB0aGlzIHJlZ3VsYXIgZXhwcmVzc2lvbi4nKSxcblx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0cGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5vbkVudGVyUnVsZXMuYmVmb3JlVGV4dC5wYXR0ZXJuJywgJ1RoZSBSZWdFeHAgcGF0dGVybiBmb3IgYmVmb3JlVGV4dC4nKSxcblx0XHRcdFx0XHRcdFx0XHRkZWZhdWx0OiAnJyxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0ZmxhZ3M6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEub25FbnRlclJ1bGVzLmJlZm9yZVRleHQuZmxhZ3MnLCAnVGhlIFJlZ0V4cCBmbGFncyBmb3IgYmVmb3JlVGV4dC4nKSxcblx0XHRcdFx0XHRcdFx0XHRkZWZhdWx0OiAnJyxcblx0XHRcdFx0XHRcdFx0XHRwYXR0ZXJuOiAnXihbZ2ltdXldKykkJyxcblx0XHRcdFx0XHRcdFx0XHRwYXR0ZXJuRXJyb3JNZXNzYWdlOiBubHMubG9jYWxpemUoJ3NjaGVtYS5vbkVudGVyUnVsZXMuYmVmb3JlVGV4dC5lcnJvck1lc3NhZ2UnLCAnTXVzdCBtYXRjaCB0aGUgcGF0dGVybiBgL14oW2dpbXV5XSspJC9gLicpXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGFmdGVyVGV4dDoge1xuXHRcdFx0XHRcdFx0dHlwZTogWydzdHJpbmcnLCAnb2JqZWN0J10sXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEub25FbnRlclJ1bGVzLmFmdGVyVGV4dCcsICdUaGlzIHJ1bGUgd2lsbCBvbmx5IGV4ZWN1dGUgaWYgdGhlIHRleHQgYWZ0ZXIgdGhlIGN1cnNvciBtYXRjaGVzIHRoaXMgcmVndWxhciBleHByZXNzaW9uLicpLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRwYXR0ZXJuOiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLm9uRW50ZXJSdWxlcy5hZnRlclRleHQucGF0dGVybicsICdUaGUgUmVnRXhwIHBhdHRlcm4gZm9yIGFmdGVyVGV4dC4nKSxcblx0XHRcdFx0XHRcdFx0XHRkZWZhdWx0OiAnJyxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0ZmxhZ3M6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEub25FbnRlclJ1bGVzLmFmdGVyVGV4dC5mbGFncycsICdUaGUgUmVnRXhwIGZsYWdzIGZvciBhZnRlclRleHQuJyksXG5cdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogJycsXG5cdFx0XHRcdFx0XHRcdFx0cGF0dGVybjogJ14oW2dpbXV5XSspJCcsXG5cdFx0XHRcdFx0XHRcdFx0cGF0dGVybkVycm9yTWVzc2FnZTogbmxzLmxvY2FsaXplKCdzY2hlbWEub25FbnRlclJ1bGVzLmFmdGVyVGV4dC5lcnJvck1lc3NhZ2UnLCAnTXVzdCBtYXRjaCB0aGUgcGF0dGVybiBgL14oW2dpbXV5XSspJC9gLicpXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHByZXZpb3VzTGluZVRleHQ6IHtcblx0XHRcdFx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ29iamVjdCddLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLm9uRW50ZXJSdWxlcy5wcmV2aW91c0xpbmVUZXh0JywgJ1RoaXMgcnVsZSB3aWxsIG9ubHkgZXhlY3V0ZSBpZiB0aGUgdGV4dCBhYm92ZSB0aGUgbGluZSBtYXRjaGVzIHRoaXMgcmVndWxhciBleHByZXNzaW9uLicpLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRwYXR0ZXJuOiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLm9uRW50ZXJSdWxlcy5wcmV2aW91c0xpbmVUZXh0LnBhdHRlcm4nLCAnVGhlIFJlZ0V4cCBwYXR0ZXJuIGZvciBwcmV2aW91c0xpbmVUZXh0LicpLFxuXHRcdFx0XHRcdFx0XHRcdGRlZmF1bHQ6ICcnLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRmbGFnczoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5vbkVudGVyUnVsZXMucHJldmlvdXNMaW5lVGV4dC5mbGFncycsICdUaGUgUmVnRXhwIGZsYWdzIGZvciBwcmV2aW91c0xpbmVUZXh0LicpLFxuXHRcdFx0XHRcdFx0XHRcdGRlZmF1bHQ6ICcnLFxuXHRcdFx0XHRcdFx0XHRcdHBhdHRlcm46ICdeKFtnaW11eV0rKSQnLFxuXHRcdFx0XHRcdFx0XHRcdHBhdHRlcm5FcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnc2NoZW1hLm9uRW50ZXJSdWxlcy5wcmV2aW91c0xpbmVUZXh0LmVycm9yTWVzc2FnZScsICdNdXN0IG1hdGNoIHRoZSBwYXR0ZXJuIGAvXihbZ2ltdXldKykkL2AuJylcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0YWN0aW9uOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiBbJ3N0cmluZycsICdvYmplY3QnXSxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjaGVtYS5vbkVudGVyUnVsZXMuYWN0aW9uJywgJ1RoZSBhY3Rpb24gdG8gZXhlY3V0ZS4nKSxcblx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ2luZGVudCddLFxuXHRcdFx0XHRcdFx0ZGVmYXVsdDogeyAnaW5kZW50JzogJ2luZGVudCcgfSxcblx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0aW5kZW50OiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLm9uRW50ZXJSdWxlcy5hY3Rpb24uaW5kZW50JywgXCJEZXNjcmliZSB3aGF0IHRvIGRvIHdpdGggdGhlIGluZGVudGF0aW9uXCIpLFxuXHRcdFx0XHRcdFx0XHRcdGRlZmF1bHQ6ICdpbmRlbnQnLFxuXHRcdFx0XHRcdFx0XHRcdGVudW06IFsnbm9uZScsICdpbmRlbnQnLCAnaW5kZW50T3V0ZGVudCcsICdvdXRkZW50J10sXG5cdFx0XHRcdFx0XHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ3NjaGVtYS5vbkVudGVyUnVsZXMuYWN0aW9uLmluZGVudC5ub25lJywgXCJJbnNlcnQgbmV3IGxpbmUgYW5kIGNvcHkgdGhlIHByZXZpb3VzIGxpbmUncyBpbmRlbnRhdGlvbi5cIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ3NjaGVtYS5vbkVudGVyUnVsZXMuYWN0aW9uLmluZGVudC5pbmRlbnQnLCBcIkluc2VydCBuZXcgbGluZSBhbmQgaW5kZW50IG9uY2UgKHJlbGF0aXZlIHRvIHRoZSBwcmV2aW91cyBsaW5lJ3MgaW5kZW50YXRpb24pLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2NoZW1hLm9uRW50ZXJSdWxlcy5hY3Rpb24uaW5kZW50LmluZGVudE91dGRlbnQnLCBcIkluc2VydCB0d28gbmV3IGxpbmVzOlxcbiAtIHRoZSBmaXJzdCBvbmUgaW5kZW50ZWQgd2hpY2ggd2lsbCBob2xkIHRoZSBjdXJzb3JcXG4gLSB0aGUgc2Vjb25kIG9uZSBhdCB0aGUgc2FtZSBpbmRlbnRhdGlvbiBsZXZlbFwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2NoZW1hLm9uRW50ZXJSdWxlcy5hY3Rpb24uaW5kZW50Lm91dGRlbnQnLCBcIkluc2VydCBuZXcgbGluZSBhbmQgb3V0ZGVudCBvbmNlIChyZWxhdGl2ZSB0byB0aGUgcHJldmlvdXMgbGluZSdzIGluZGVudGF0aW9uKS5cIilcblx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGFwcGVuZFRleHQ6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY2hlbWEub25FbnRlclJ1bGVzLmFjdGlvbi5hcHBlbmRUZXh0JywgJ0Rlc2NyaWJlcyB0ZXh0IHRvIGJlIGFwcGVuZGVkIGFmdGVyIHRoZSBuZXcgbGluZSBhbmQgYWZ0ZXIgdGhlIGluZGVudGF0aW9uLicpLFxuXHRcdFx0XHRcdFx0XHRcdGRlZmF1bHQ6ICcnLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRyZW1vdmVUZXh0OiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NoZW1hLm9uRW50ZXJSdWxlcy5hY3Rpb24ucmVtb3ZlVGV4dCcsICdEZXNjcmliZXMgdGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIHRvIHJlbW92ZSBmcm9tIHRoZSBuZXcgbGluZVxcJ3MgaW5kZW50YXRpb24uJyksXG5cdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogMCxcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHR9XG59O1xuY29uc3Qgc2NoZW1hUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJSlNPTkNvbnRyaWJ1dGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkpTT05Db250cmlidXRpb24pO1xuc2NoZW1hUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWEoc2NoZW1hSWQsIHNjaGVtYSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFxQixPQUFPLG1CQUFtQjtBQUUvQyxZQUFZLFdBQVc7QUFFdkIsU0FBOEosb0JBQWtEO0FBQ2hOLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsa0JBQTZDO0FBQ3RELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMseUJBQXlCO0FB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
