import * as arrays from "../../../base/common/arrays.js";
import * as objects from "../../../base/common/objects.js";
import * as platform from "../../../base/common/platform.js";
import { ScrollbarVisibility } from "../../../base/common/scrollable.js";
import { Constants } from "../../../base/common/uint.js";
import { EDITOR_MODEL_DEFAULTS } from "../core/textModelDefaults.js";
import { USUAL_WORD_SEPARATORS } from "../core/wordHelper.js";
import * as nls from "../../../nls.js";
import { AccessibilitySupport } from "../../../platform/accessibility/common/accessibility.js";
import product from "../../../platform/product/common/product.js";
var EditorAutoIndentStrategy = /* @__PURE__ */ ((EditorAutoIndentStrategy2) => {
  EditorAutoIndentStrategy2[EditorAutoIndentStrategy2["None"] = 0] = "None";
  EditorAutoIndentStrategy2[EditorAutoIndentStrategy2["Keep"] = 1] = "Keep";
  EditorAutoIndentStrategy2[EditorAutoIndentStrategy2["Brackets"] = 2] = "Brackets";
  EditorAutoIndentStrategy2[EditorAutoIndentStrategy2["Advanced"] = 3] = "Advanced";
  EditorAutoIndentStrategy2[EditorAutoIndentStrategy2["Full"] = 4] = "Full";
  return EditorAutoIndentStrategy2;
})(EditorAutoIndentStrategy || {});
const MINIMAP_GUTTER_WIDTH = 8;
class ConfigurationChangedEvent {
  /**
   * @internal
   */
  constructor(values) {
    this._values = values;
  }
  hasChanged(id) {
    return this._values[id];
  }
}
class ComputeOptionsMemory {
  constructor() {
    this.stableMinimapLayoutInput = null;
    this.stableFitMaxMinimapScale = 0;
    this.stableFitRemainingWidth = 0;
  }
}
class BaseEditorOption {
  constructor(id, name, defaultValue, schema) {
    this.id = id;
    this.name = name;
    this.defaultValue = defaultValue;
    this.schema = schema;
  }
  applyUpdate(value, update) {
    return applyUpdate(value, update);
  }
  compute(env, options, value) {
    return value;
  }
}
class ApplyUpdateResult {
  constructor(newValue, didChange) {
    this.newValue = newValue;
    this.didChange = didChange;
  }
}
function applyUpdate(value, update) {
  if (typeof value !== "object" || typeof update !== "object" || !value || !update) {
    return new ApplyUpdateResult(update, value !== update);
  }
  if (Array.isArray(value) || Array.isArray(update)) {
    const arrayEquals = Array.isArray(value) && Array.isArray(update) && arrays.equals(value, update);
    return new ApplyUpdateResult(update, !arrayEquals);
  }
  let didChange = false;
  for (const key in update) {
    if (update.hasOwnProperty(key)) {
      const result = applyUpdate(value[key], update[key]);
      if (result.didChange) {
        value[key] = result.newValue;
        didChange = true;
      }
    }
  }
  return new ApplyUpdateResult(value, didChange);
}
class ComputedEditorOption {
  constructor(id) {
    this.schema = void 0;
    this.id = id;
    this.name = "_never_";
    this.defaultValue = void 0;
  }
  applyUpdate(value, update) {
    return applyUpdate(value, update);
  }
  validate(input) {
    return this.defaultValue;
  }
}
class SimpleEditorOption {
  constructor(id, name, defaultValue, schema) {
    this.id = id;
    this.name = name;
    this.defaultValue = defaultValue;
    this.schema = schema;
  }
  applyUpdate(value, update) {
    return applyUpdate(value, update);
  }
  validate(input) {
    if (typeof input === "undefined") {
      return this.defaultValue;
    }
    return input;
  }
  compute(env, options, value) {
    return value;
  }
}
function boolean(value, defaultValue) {
  if (typeof value === "undefined") {
    return defaultValue;
  }
  if (value === "false") {
    return false;
  }
  return Boolean(value);
}
class EditorBooleanOption extends SimpleEditorOption {
  constructor(id, name, defaultValue, schema = void 0) {
    if (typeof schema !== "undefined") {
      schema.type = "boolean";
      schema.default = defaultValue;
    }
    super(id, name, defaultValue, schema);
  }
  validate(input) {
    return boolean(input, this.defaultValue);
  }
}
function clampedInt(value, defaultValue, minimum, maximum) {
  if (typeof value === "undefined") {
    return defaultValue;
  }
  let r = parseInt(value, 10);
  if (isNaN(r)) {
    return defaultValue;
  }
  r = Math.max(minimum, r);
  r = Math.min(maximum, r);
  return r | 0;
}
class EditorIntOption extends SimpleEditorOption {
  static clampedInt(value, defaultValue, minimum, maximum) {
    return clampedInt(value, defaultValue, minimum, maximum);
  }
  constructor(id, name, defaultValue, minimum, maximum, schema = void 0) {
    if (typeof schema !== "undefined") {
      schema.type = "integer";
      schema.default = defaultValue;
      schema.minimum = minimum;
      schema.maximum = maximum;
    }
    super(id, name, defaultValue, schema);
    this.minimum = minimum;
    this.maximum = maximum;
  }
  validate(input) {
    return EditorIntOption.clampedInt(input, this.defaultValue, this.minimum, this.maximum);
  }
}
function clampedFloat(value, defaultValue, minimum, maximum) {
  if (typeof value === "undefined") {
    return defaultValue;
  }
  const r = EditorFloatOption.float(value, defaultValue);
  return EditorFloatOption.clamp(r, minimum, maximum);
}
class EditorFloatOption extends SimpleEditorOption {
  static clamp(n, min, max) {
    if (n < min) {
      return min;
    }
    if (n > max) {
      return max;
    }
    return n;
  }
  static float(value, defaultValue) {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "undefined") {
      return defaultValue;
    }
    const r = parseFloat(value);
    return isNaN(r) ? defaultValue : r;
  }
  constructor(id, name, defaultValue, validationFn, schema) {
    if (typeof schema !== "undefined") {
      schema.type = "number";
      schema.default = defaultValue;
    }
    super(id, name, defaultValue, schema);
    this.validationFn = validationFn;
  }
  validate(input) {
    return this.validationFn(EditorFloatOption.float(input, this.defaultValue));
  }
}
class EditorStringOption extends SimpleEditorOption {
  static string(value, defaultValue) {
    if (typeof value !== "string") {
      return defaultValue;
    }
    return value;
  }
  constructor(id, name, defaultValue, schema = void 0) {
    if (typeof schema !== "undefined") {
      schema.type = "string";
      schema.default = defaultValue;
    }
    super(id, name, defaultValue, schema);
  }
  validate(input) {
    return EditorStringOption.string(input, this.defaultValue);
  }
}
function stringSet(value, defaultValue, allowedValues, renamedValues) {
  if (typeof value !== "string") {
    return defaultValue;
  }
  if (renamedValues && value in renamedValues) {
    return renamedValues[value];
  }
  if (allowedValues.indexOf(value) === -1) {
    return defaultValue;
  }
  return value;
}
class EditorStringEnumOption extends SimpleEditorOption {
  constructor(id, name, defaultValue, allowedValues, schema = void 0) {
    if (typeof schema !== "undefined") {
      schema.type = "string";
      schema.enum = allowedValues;
      schema.default = defaultValue;
    }
    super(id, name, defaultValue, schema);
    this._allowedValues = allowedValues;
  }
  validate(input) {
    return stringSet(input, this.defaultValue, this._allowedValues);
  }
}
class EditorEnumOption extends BaseEditorOption {
  constructor(id, name, defaultValue, defaultStringValue, allowedValues, convert, schema = void 0) {
    if (typeof schema !== "undefined") {
      schema.type = "string";
      schema.enum = allowedValues;
      schema.default = defaultStringValue;
    }
    super(id, name, defaultValue, schema);
    this._allowedValues = allowedValues;
    this._convert = convert;
  }
  validate(input) {
    if (typeof input !== "string") {
      return this.defaultValue;
    }
    if (this._allowedValues.indexOf(input) === -1) {
      return this.defaultValue;
    }
    return this._convert(input);
  }
}
function _autoIndentFromString(autoIndent) {
  switch (autoIndent) {
    case "none":
      return 0 /* None */;
    case "keep":
      return 1 /* Keep */;
    case "brackets":
      return 2 /* Brackets */;
    case "advanced":
      return 3 /* Advanced */;
    case "full":
      return 4 /* Full */;
  }
}
class EditorAccessibilitySupport extends BaseEditorOption {
  constructor() {
    super(
      2 /* accessibilitySupport */,
      "accessibilitySupport",
      AccessibilitySupport.Unknown,
      {
        type: "string",
        enum: ["auto", "on", "off"],
        enumDescriptions: [
          nls.localize("accessibilitySupport.auto", "Use platform APIs to detect when a Screen Reader is attached."),
          nls.localize("accessibilitySupport.on", "Optimize for usage with a Screen Reader."),
          nls.localize("accessibilitySupport.off", "Assume a screen reader is not attached.")
        ],
        default: "auto",
        tags: ["accessibility"],
        description: nls.localize("accessibilitySupport", "Controls if the UI should run in a mode where it is optimized for screen readers.")
      }
    );
  }
  validate(input) {
    switch (input) {
      case "auto":
        return AccessibilitySupport.Unknown;
      case "off":
        return AccessibilitySupport.Disabled;
      case "on":
        return AccessibilitySupport.Enabled;
    }
    return this.defaultValue;
  }
  compute(env, options, value) {
    if (value === AccessibilitySupport.Unknown) {
      return env.accessibilitySupport;
    }
    return value;
  }
}
class EditorComments extends BaseEditorOption {
  constructor() {
    const defaults = {
      insertSpace: true,
      ignoreEmptyLines: true
    };
    super(
      23 /* comments */,
      "comments",
      defaults,
      {
        "editor.comments.insertSpace": {
          type: "boolean",
          default: defaults.insertSpace,
          description: nls.localize("comments.insertSpace", "Controls whether a space character is inserted when commenting.")
        },
        "editor.comments.ignoreEmptyLines": {
          type: "boolean",
          default: defaults.ignoreEmptyLines,
          description: nls.localize("comments.ignoreEmptyLines", "Controls if empty lines should be ignored with toggle, add or remove actions for line comments.")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      insertSpace: boolean(input.insertSpace, this.defaultValue.insertSpace),
      ignoreEmptyLines: boolean(input.ignoreEmptyLines, this.defaultValue.ignoreEmptyLines)
    };
  }
}
var TextEditorCursorBlinkingStyle = /* @__PURE__ */ ((TextEditorCursorBlinkingStyle2) => {
  TextEditorCursorBlinkingStyle2[TextEditorCursorBlinkingStyle2["Hidden"] = 0] = "Hidden";
  TextEditorCursorBlinkingStyle2[TextEditorCursorBlinkingStyle2["Blink"] = 1] = "Blink";
  TextEditorCursorBlinkingStyle2[TextEditorCursorBlinkingStyle2["Smooth"] = 2] = "Smooth";
  TextEditorCursorBlinkingStyle2[TextEditorCursorBlinkingStyle2["Phase"] = 3] = "Phase";
  TextEditorCursorBlinkingStyle2[TextEditorCursorBlinkingStyle2["Expand"] = 4] = "Expand";
  TextEditorCursorBlinkingStyle2[TextEditorCursorBlinkingStyle2["Solid"] = 5] = "Solid";
  return TextEditorCursorBlinkingStyle2;
})(TextEditorCursorBlinkingStyle || {});
function cursorBlinkingStyleFromString(cursorBlinkingStyle) {
  switch (cursorBlinkingStyle) {
    case "blink":
      return 1 /* Blink */;
    case "smooth":
      return 2 /* Smooth */;
    case "phase":
      return 3 /* Phase */;
    case "expand":
      return 4 /* Expand */;
    case "solid":
      return 5 /* Solid */;
  }
}
var TextEditorCursorStyle = /* @__PURE__ */ ((TextEditorCursorStyle2) => {
  TextEditorCursorStyle2[TextEditorCursorStyle2["Line"] = 1] = "Line";
  TextEditorCursorStyle2[TextEditorCursorStyle2["Block"] = 2] = "Block";
  TextEditorCursorStyle2[TextEditorCursorStyle2["Underline"] = 3] = "Underline";
  TextEditorCursorStyle2[TextEditorCursorStyle2["LineThin"] = 4] = "LineThin";
  TextEditorCursorStyle2[TextEditorCursorStyle2["BlockOutline"] = 5] = "BlockOutline";
  TextEditorCursorStyle2[TextEditorCursorStyle2["UnderlineThin"] = 6] = "UnderlineThin";
  return TextEditorCursorStyle2;
})(TextEditorCursorStyle || {});
function cursorStyleToString(cursorStyle) {
  switch (cursorStyle) {
    case 1 /* Line */:
      return "line";
    case 2 /* Block */:
      return "block";
    case 3 /* Underline */:
      return "underline";
    case 4 /* LineThin */:
      return "line-thin";
    case 5 /* BlockOutline */:
      return "block-outline";
    case 6 /* UnderlineThin */:
      return "underline-thin";
  }
}
function cursorStyleFromString(cursorStyle) {
  switch (cursorStyle) {
    case "line":
      return 1 /* Line */;
    case "block":
      return 2 /* Block */;
    case "underline":
      return 3 /* Underline */;
    case "line-thin":
      return 4 /* LineThin */;
    case "block-outline":
      return 5 /* BlockOutline */;
    case "underline-thin":
      return 6 /* UnderlineThin */;
  }
}
class EditorClassName extends ComputedEditorOption {
  constructor() {
    super(148 /* editorClassName */);
  }
  compute(env, options, _) {
    const classNames = ["monaco-editor"];
    if (options.get(41 /* extraEditorClassName */)) {
      classNames.push(options.get(41 /* extraEditorClassName */));
    }
    if (env.extraEditorClassName) {
      classNames.push(env.extraEditorClassName);
    }
    if (options.get(75 /* mouseStyle */) === "default") {
      classNames.push("mouse-default");
    } else if (options.get(75 /* mouseStyle */) === "copy") {
      classNames.push("mouse-copy");
    }
    if (options.get(116 /* showUnused */)) {
      classNames.push("showUnused");
    }
    if (options.get(145 /* showDeprecated */)) {
      classNames.push("showDeprecated");
    }
    return classNames.join(" ");
  }
}
class EditorEmptySelectionClipboard extends EditorBooleanOption {
  constructor() {
    super(
      38 /* emptySelectionClipboard */,
      "emptySelectionClipboard",
      true,
      { description: nls.localize("emptySelectionClipboard", "Controls whether copying without a selection copies the current line.") }
    );
  }
  compute(env, options, value) {
    return value && env.emptySelectionClipboard;
  }
}
class EditorFind extends BaseEditorOption {
  constructor() {
    const defaults = {
      cursorMoveOnType: true,
      seedSearchStringFromSelection: "always",
      autoFindInSelection: "never",
      globalFindClipboard: false,
      addExtraSpaceOnTop: true,
      loop: true,
      history: "workspace",
      replaceHistory: "workspace"
    };
    super(
      43 /* find */,
      "find",
      defaults,
      {
        "editor.find.cursorMoveOnType": {
          type: "boolean",
          default: defaults.cursorMoveOnType,
          description: nls.localize("find.cursorMoveOnType", "Controls whether the cursor should jump to find matches while typing.")
        },
        "editor.find.seedSearchStringFromSelection": {
          type: "string",
          enum: ["never", "always", "selection"],
          default: defaults.seedSearchStringFromSelection,
          enumDescriptions: [
            nls.localize("editor.find.seedSearchStringFromSelection.never", "Never seed search string from the editor selection."),
            nls.localize("editor.find.seedSearchStringFromSelection.always", "Always seed search string from the editor selection, including word at cursor position."),
            nls.localize("editor.find.seedSearchStringFromSelection.selection", "Only seed search string from the editor selection.")
          ],
          description: nls.localize("find.seedSearchStringFromSelection", "Controls whether the search string in the Find Widget is seeded from the editor selection.")
        },
        "editor.find.autoFindInSelection": {
          type: "string",
          enum: ["never", "always", "multiline"],
          default: defaults.autoFindInSelection,
          enumDescriptions: [
            nls.localize("editor.find.autoFindInSelection.never", "Never turn on Find in Selection automatically (default)."),
            nls.localize("editor.find.autoFindInSelection.always", "Always turn on Find in Selection automatically."),
            nls.localize("editor.find.autoFindInSelection.multiline", "Turn on Find in Selection automatically when multiple lines of content are selected.")
          ],
          description: nls.localize("find.autoFindInSelection", "Controls the condition for turning on Find in Selection automatically.")
        },
        "editor.find.globalFindClipboard": {
          type: "boolean",
          default: defaults.globalFindClipboard,
          description: nls.localize("find.globalFindClipboard", "Controls whether the Find Widget should read or modify the shared find clipboard on macOS."),
          included: platform.isMacintosh
        },
        "editor.find.addExtraSpaceOnTop": {
          type: "boolean",
          default: defaults.addExtraSpaceOnTop,
          description: nls.localize("find.addExtraSpaceOnTop", "Controls whether the Find Widget should add extra lines on top of the editor. When true, you can scroll beyond the first line when the Find Widget is visible.")
        },
        "editor.find.loop": {
          type: "boolean",
          default: defaults.loop,
          description: nls.localize("find.loop", "Controls whether the search automatically restarts from the beginning (or the end) when no further matches can be found.")
        },
        "editor.find.history": {
          type: "string",
          enum: ["never", "workspace"],
          default: "workspace",
          enumDescriptions: [
            nls.localize("editor.find.history.never", "Do not store search history from the find widget."),
            nls.localize("editor.find.history.workspace", "Store search history across the active workspace")
          ],
          description: nls.localize("find.history", "Controls how the find widget history should be stored")
        },
        "editor.find.replaceHistory": {
          type: "string",
          enum: ["never", "workspace"],
          default: "workspace",
          enumDescriptions: [
            nls.localize("editor.find.replaceHistory.never", "Do not store history from the replace widget."),
            nls.localize("editor.find.replaceHistory.workspace", "Store replace history across the active workspace")
          ],
          description: nls.localize("find.replaceHistory", "Controls how the replace widget history should be stored")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      cursorMoveOnType: boolean(input.cursorMoveOnType, this.defaultValue.cursorMoveOnType),
      seedSearchStringFromSelection: typeof _input.seedSearchStringFromSelection === "boolean" ? _input.seedSearchStringFromSelection ? "always" : "never" : stringSet(input.seedSearchStringFromSelection, this.defaultValue.seedSearchStringFromSelection, ["never", "always", "selection"]),
      autoFindInSelection: typeof _input.autoFindInSelection === "boolean" ? _input.autoFindInSelection ? "always" : "never" : stringSet(input.autoFindInSelection, this.defaultValue.autoFindInSelection, ["never", "always", "multiline"]),
      globalFindClipboard: boolean(input.globalFindClipboard, this.defaultValue.globalFindClipboard),
      addExtraSpaceOnTop: boolean(input.addExtraSpaceOnTop, this.defaultValue.addExtraSpaceOnTop),
      loop: boolean(input.loop, this.defaultValue.loop),
      history: stringSet(input.history, this.defaultValue.history, ["never", "workspace"]),
      replaceHistory: stringSet(input.replaceHistory, this.defaultValue.replaceHistory, ["never", "workspace"])
    };
  }
}
const _EditorFontLigatures = class _EditorFontLigatures extends BaseEditorOption {
  constructor() {
    super(
      53 /* fontLigatures */,
      "fontLigatures",
      _EditorFontLigatures.OFF,
      {
        anyOf: [
          {
            type: "boolean",
            description: nls.localize("fontLigatures", "Enables/Disables font ligatures ('calt' and 'liga' font features). Change this to a string for fine-grained control of the 'font-feature-settings' CSS property.")
          },
          {
            type: "string",
            description: nls.localize("fontFeatureSettings", "Explicit 'font-feature-settings' CSS property. A boolean can be passed instead if one only needs to turn on/off ligatures.")
          }
        ],
        description: nls.localize("fontLigaturesGeneral", "Configures font ligatures or font features. Can be either a boolean to enable/disable ligatures or a string for the value of the CSS 'font-feature-settings' property."),
        default: false
      }
    );
  }
  validate(input) {
    if (typeof input === "undefined") {
      return this.defaultValue;
    }
    if (typeof input === "string") {
      if (input === "false" || input.length === 0) {
        return _EditorFontLigatures.OFF;
      }
      if (input === "true") {
        return _EditorFontLigatures.ON;
      }
      return input;
    }
    if (Boolean(input)) {
      return _EditorFontLigatures.ON;
    }
    return _EditorFontLigatures.OFF;
  }
};
_EditorFontLigatures.OFF = '"liga" off, "calt" off';
_EditorFontLigatures.ON = '"liga" on, "calt" on';
let EditorFontLigatures = _EditorFontLigatures;
const _EditorFontVariations = class _EditorFontVariations extends BaseEditorOption {
  constructor() {
    super(
      56 /* fontVariations */,
      "fontVariations",
      _EditorFontVariations.OFF,
      {
        anyOf: [
          {
            type: "boolean",
            description: nls.localize("fontVariations", "Enables/Disables the translation from font-weight to font-variation-settings. Change this to a string for fine-grained control of the 'font-variation-settings' CSS property.")
          },
          {
            type: "string",
            description: nls.localize("fontVariationSettings", "Explicit 'font-variation-settings' CSS property. A boolean can be passed instead if one only needs to translate font-weight to font-variation-settings.")
          }
        ],
        description: nls.localize("fontVariationsGeneral", "Configures font variations. Can be either a boolean to enable/disable the translation from font-weight to font-variation-settings or a string for the value of the CSS 'font-variation-settings' property."),
        default: false
      }
    );
  }
  validate(input) {
    if (typeof input === "undefined") {
      return this.defaultValue;
    }
    if (typeof input === "string") {
      if (input === "false") {
        return _EditorFontVariations.OFF;
      }
      if (input === "true") {
        return _EditorFontVariations.TRANSLATE;
      }
      return input;
    }
    if (Boolean(input)) {
      return _EditorFontVariations.TRANSLATE;
    }
    return _EditorFontVariations.OFF;
  }
  compute(env, options, value) {
    return env.fontInfo.fontVariationSettings;
  }
};
// Text is laid out using default settings.
_EditorFontVariations.OFF = "normal";
// Translate `fontWeight` config to the `font-variation-settings` CSS property.
_EditorFontVariations.TRANSLATE = "translate";
let EditorFontVariations = _EditorFontVariations;
class EditorFontInfo extends ComputedEditorOption {
  constructor() {
    super(52 /* fontInfo */);
  }
  compute(env, options, _) {
    return env.fontInfo;
  }
}
class EffectiveCursorStyle extends ComputedEditorOption {
  constructor() {
    super(147 /* effectiveCursorStyle */);
  }
  compute(env, options, _) {
    return env.inputMode === "overtype" ? options.get(84 /* overtypeCursorStyle */) : options.get(28 /* cursorStyle */);
  }
}
class EffectiveExperimentalEditContextEnabled extends ComputedEditorOption {
  constructor() {
    super(156 /* effectiveExperimentalEditContextEnabled */);
  }
  compute(env, options) {
    const editContextSupported = typeof globalThis.EditContext === "function";
    return editContextSupported && options.get(37 /* experimentalEditContextEnabled */);
  }
}
class EditorFontSize extends SimpleEditorOption {
  constructor() {
    super(
      54 /* fontSize */,
      "fontSize",
      EDITOR_FONT_DEFAULTS.fontSize,
      {
        type: "number",
        minimum: 6,
        maximum: 100,
        default: EDITOR_FONT_DEFAULTS.fontSize,
        description: nls.localize("fontSize", "Controls the font size in pixels.")
      }
    );
  }
  validate(input) {
    const r = EditorFloatOption.float(input, this.defaultValue);
    if (r === 0) {
      return EDITOR_FONT_DEFAULTS.fontSize;
    }
    return EditorFloatOption.clamp(r, 6, 100);
  }
  compute(env, options, value) {
    return env.fontInfo.fontSize;
  }
}
const _EditorFontWeight = class _EditorFontWeight extends BaseEditorOption {
  constructor() {
    super(
      55 /* fontWeight */,
      "fontWeight",
      EDITOR_FONT_DEFAULTS.fontWeight,
      {
        anyOf: [
          {
            type: "number",
            minimum: _EditorFontWeight.MINIMUM_VALUE,
            maximum: _EditorFontWeight.MAXIMUM_VALUE,
            errorMessage: nls.localize("fontWeightErrorMessage", 'Only "normal" and "bold" keywords or numbers between 1 and 1000 are allowed.')
          },
          {
            type: "string",
            pattern: "^(normal|bold|1000|[1-9][0-9]{0,2})$"
          },
          {
            enum: _EditorFontWeight.SUGGESTION_VALUES
          }
        ],
        default: EDITOR_FONT_DEFAULTS.fontWeight,
        description: nls.localize("fontWeight", 'Controls the font weight. Accepts "normal" and "bold" keywords or numbers between 1 and 1000.')
      }
    );
  }
  validate(input) {
    if (input === "normal" || input === "bold") {
      return input;
    }
    return String(EditorIntOption.clampedInt(input, EDITOR_FONT_DEFAULTS.fontWeight, _EditorFontWeight.MINIMUM_VALUE, _EditorFontWeight.MAXIMUM_VALUE));
  }
};
_EditorFontWeight.SUGGESTION_VALUES = ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
_EditorFontWeight.MINIMUM_VALUE = 1;
_EditorFontWeight.MAXIMUM_VALUE = 1e3;
let EditorFontWeight = _EditorFontWeight;
class EditorGoToLocation extends BaseEditorOption {
  constructor() {
    const defaults = {
      multiple: "peek",
      multipleDefinitions: "peek",
      multipleTypeDefinitions: "peek",
      multipleDeclarations: "peek",
      multipleImplementations: "peek",
      multipleReferences: "peek",
      multipleTests: "peek",
      alternativeDefinitionCommand: "editor.action.goToReferences",
      alternativeTypeDefinitionCommand: "editor.action.goToReferences",
      alternativeDeclarationCommand: "editor.action.goToReferences",
      alternativeImplementationCommand: "",
      alternativeReferenceCommand: "",
      alternativeTestsCommand: ""
    };
    const jsonSubset = {
      type: "string",
      enum: ["peek", "gotoAndPeek", "goto"],
      default: defaults.multiple,
      enumDescriptions: [
        nls.localize("editor.gotoLocation.multiple.peek", "Show Peek view of the results (default)"),
        nls.localize("editor.gotoLocation.multiple.gotoAndPeek", "Go to the primary result and show a Peek view"),
        nls.localize("editor.gotoLocation.multiple.goto", "Go to the primary result and enable Peek-less navigation to others")
      ]
    };
    const alternativeCommandOptions = ["", "editor.action.referenceSearch.trigger", "editor.action.goToReferences", "editor.action.peekImplementation", "editor.action.goToImplementation", "editor.action.peekTypeDefinition", "editor.action.goToTypeDefinition", "editor.action.peekDeclaration", "editor.action.revealDeclaration", "editor.action.peekDefinition", "editor.action.revealDefinitionAside", "editor.action.revealDefinition"];
    super(
      60 /* gotoLocation */,
      "gotoLocation",
      defaults,
      {
        "editor.gotoLocation.multiple": {
          deprecationMessage: nls.localize("editor.gotoLocation.multiple.deprecated", "This setting is deprecated, please use separate settings like 'editor.editor.gotoLocation.multipleDefinitions' or 'editor.editor.gotoLocation.multipleImplementations' instead.")
        },
        "editor.gotoLocation.multipleDefinitions": {
          description: nls.localize("editor.editor.gotoLocation.multipleDefinitions", "Controls the behavior the 'Go to Definition'-command when multiple target locations exist."),
          ...jsonSubset
        },
        "editor.gotoLocation.multipleTypeDefinitions": {
          description: nls.localize("editor.editor.gotoLocation.multipleTypeDefinitions", "Controls the behavior the 'Go to Type Definition'-command when multiple target locations exist."),
          ...jsonSubset
        },
        "editor.gotoLocation.multipleDeclarations": {
          description: nls.localize("editor.editor.gotoLocation.multipleDeclarations", "Controls the behavior the 'Go to Declaration'-command when multiple target locations exist."),
          ...jsonSubset
        },
        "editor.gotoLocation.multipleImplementations": {
          description: nls.localize("editor.editor.gotoLocation.multipleImplemenattions", "Controls the behavior the 'Go to Implementations'-command when multiple target locations exist."),
          ...jsonSubset
        },
        "editor.gotoLocation.multipleReferences": {
          description: nls.localize("editor.editor.gotoLocation.multipleReferences", "Controls the behavior the 'Go to References'-command when multiple target locations exist."),
          ...jsonSubset
        },
        "editor.gotoLocation.alternativeDefinitionCommand": {
          type: "string",
          default: defaults.alternativeDefinitionCommand,
          enum: alternativeCommandOptions,
          description: nls.localize("alternativeDefinitionCommand", "Alternative command id that is being executed when the result of 'Go to Definition' is the current location.")
        },
        "editor.gotoLocation.alternativeTypeDefinitionCommand": {
          type: "string",
          default: defaults.alternativeTypeDefinitionCommand,
          enum: alternativeCommandOptions,
          description: nls.localize("alternativeTypeDefinitionCommand", "Alternative command id that is being executed when the result of 'Go to Type Definition' is the current location.")
        },
        "editor.gotoLocation.alternativeDeclarationCommand": {
          type: "string",
          default: defaults.alternativeDeclarationCommand,
          enum: alternativeCommandOptions,
          description: nls.localize("alternativeDeclarationCommand", "Alternative command id that is being executed when the result of 'Go to Declaration' is the current location.")
        },
        "editor.gotoLocation.alternativeImplementationCommand": {
          type: "string",
          default: defaults.alternativeImplementationCommand,
          enum: alternativeCommandOptions,
          description: nls.localize("alternativeImplementationCommand", "Alternative command id that is being executed when the result of 'Go to Implementation' is the current location.")
        },
        "editor.gotoLocation.alternativeReferenceCommand": {
          type: "string",
          default: defaults.alternativeReferenceCommand,
          enum: alternativeCommandOptions,
          description: nls.localize("alternativeReferenceCommand", "Alternative command id that is being executed when the result of 'Go to Reference' is the current location.")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      multiple: stringSet(input.multiple, this.defaultValue.multiple, ["peek", "gotoAndPeek", "goto"]),
      multipleDefinitions: input.multipleDefinitions ?? stringSet(input.multipleDefinitions, "peek", ["peek", "gotoAndPeek", "goto"]),
      multipleTypeDefinitions: input.multipleTypeDefinitions ?? stringSet(input.multipleTypeDefinitions, "peek", ["peek", "gotoAndPeek", "goto"]),
      multipleDeclarations: input.multipleDeclarations ?? stringSet(input.multipleDeclarations, "peek", ["peek", "gotoAndPeek", "goto"]),
      multipleImplementations: input.multipleImplementations ?? stringSet(input.multipleImplementations, "peek", ["peek", "gotoAndPeek", "goto"]),
      multipleReferences: input.multipleReferences ?? stringSet(input.multipleReferences, "peek", ["peek", "gotoAndPeek", "goto"]),
      multipleTests: input.multipleTests ?? stringSet(input.multipleTests, "peek", ["peek", "gotoAndPeek", "goto"]),
      alternativeDefinitionCommand: EditorStringOption.string(input.alternativeDefinitionCommand, this.defaultValue.alternativeDefinitionCommand),
      alternativeTypeDefinitionCommand: EditorStringOption.string(input.alternativeTypeDefinitionCommand, this.defaultValue.alternativeTypeDefinitionCommand),
      alternativeDeclarationCommand: EditorStringOption.string(input.alternativeDeclarationCommand, this.defaultValue.alternativeDeclarationCommand),
      alternativeImplementationCommand: EditorStringOption.string(input.alternativeImplementationCommand, this.defaultValue.alternativeImplementationCommand),
      alternativeReferenceCommand: EditorStringOption.string(input.alternativeReferenceCommand, this.defaultValue.alternativeReferenceCommand),
      alternativeTestsCommand: EditorStringOption.string(input.alternativeTestsCommand, this.defaultValue.alternativeTestsCommand)
    };
  }
}
class EditorHover extends BaseEditorOption {
  constructor() {
    const defaults = {
      enabled: true,
      delay: 300,
      hidingDelay: 300,
      sticky: true,
      above: true
    };
    super(
      62 /* hover */,
      "hover",
      defaults,
      {
        "editor.hover.enabled": {
          type: "boolean",
          default: defaults.enabled,
          description: nls.localize("hover.enabled", "Controls whether the hover is shown.")
        },
        "editor.hover.delay": {
          type: "number",
          default: defaults.delay,
          minimum: 0,
          maximum: 1e4,
          description: nls.localize("hover.delay", "Controls the delay in milliseconds after which the hover is shown.")
        },
        "editor.hover.sticky": {
          type: "boolean",
          default: defaults.sticky,
          description: nls.localize("hover.sticky", "Controls whether the hover should remain visible when mouse is moved over it.")
        },
        "editor.hover.hidingDelay": {
          type: "integer",
          minimum: 0,
          default: defaults.hidingDelay,
          description: nls.localize("hover.hidingDelay", "Controls the delay in milliseconds after which the hover is hidden. Requires `editor.hover.sticky` to be enabled.")
        },
        "editor.hover.above": {
          type: "boolean",
          default: defaults.above,
          description: nls.localize("hover.above", "Prefer showing hovers above the line, if there's space.")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      enabled: boolean(input.enabled, this.defaultValue.enabled),
      delay: EditorIntOption.clampedInt(input.delay, this.defaultValue.delay, 0, 1e4),
      sticky: boolean(input.sticky, this.defaultValue.sticky),
      hidingDelay: EditorIntOption.clampedInt(input.hidingDelay, this.defaultValue.hidingDelay, 0, 6e5),
      above: boolean(input.above, this.defaultValue.above)
    };
  }
}
var RenderMinimap = /* @__PURE__ */ ((RenderMinimap2) => {
  RenderMinimap2[RenderMinimap2["None"] = 0] = "None";
  RenderMinimap2[RenderMinimap2["Text"] = 1] = "Text";
  RenderMinimap2[RenderMinimap2["Blocks"] = 2] = "Blocks";
  return RenderMinimap2;
})(RenderMinimap || {});
class EditorLayoutInfoComputer extends ComputedEditorOption {
  constructor() {
    super(151 /* layoutInfo */);
  }
  compute(env, options, _) {
    return EditorLayoutInfoComputer.computeLayout(options, {
      memory: env.memory,
      outerWidth: env.outerWidth,
      outerHeight: env.outerHeight,
      isDominatedByLongLines: env.isDominatedByLongLines,
      lineHeight: env.fontInfo.lineHeight,
      viewLineCount: env.viewLineCount,
      lineNumbersDigitCount: env.lineNumbersDigitCount,
      typicalHalfwidthCharacterWidth: env.fontInfo.typicalHalfwidthCharacterWidth,
      maxDigitWidth: env.fontInfo.maxDigitWidth,
      pixelRatio: env.pixelRatio,
      glyphMarginDecorationLaneCount: env.glyphMarginDecorationLaneCount
    });
  }
  static computeContainedMinimapLineCount(input) {
    const typicalViewportLineCount = input.height / input.lineHeight;
    const extraLinesBeforeFirstLine = Math.floor(input.paddingTop / input.lineHeight);
    let extraLinesBeyondLastLine = Math.floor(input.paddingBottom / input.lineHeight);
    if (input.scrollBeyondLastLine) {
      extraLinesBeyondLastLine = Math.max(extraLinesBeyondLastLine, typicalViewportLineCount - 1);
    }
    const desiredRatio = (extraLinesBeforeFirstLine + input.viewLineCount + extraLinesBeyondLastLine) / (input.pixelRatio * input.height);
    const minimapLineCount = Math.floor(input.viewLineCount / desiredRatio);
    return { typicalViewportLineCount, extraLinesBeforeFirstLine, extraLinesBeyondLastLine, desiredRatio, minimapLineCount };
  }
  static _computeMinimapLayout(input, memory) {
    const outerWidth = input.outerWidth;
    const outerHeight = input.outerHeight;
    const pixelRatio = input.pixelRatio;
    if (!input.minimap.enabled) {
      return {
        renderMinimap: 0 /* None */,
        minimapLeft: 0,
        minimapWidth: 0,
        minimapHeightIsEditorHeight: false,
        minimapIsSampling: false,
        minimapScale: 1,
        minimapLineHeight: 1,
        minimapCanvasInnerWidth: 0,
        minimapCanvasInnerHeight: Math.floor(pixelRatio * outerHeight),
        minimapCanvasOuterWidth: 0,
        minimapCanvasOuterHeight: outerHeight
      };
    }
    const stableMinimapLayoutInput = memory.stableMinimapLayoutInput;
    const couldUseMemory = stableMinimapLayoutInput && input.outerHeight === stableMinimapLayoutInput.outerHeight && input.lineHeight === stableMinimapLayoutInput.lineHeight && input.typicalHalfwidthCharacterWidth === stableMinimapLayoutInput.typicalHalfwidthCharacterWidth && input.pixelRatio === stableMinimapLayoutInput.pixelRatio && input.scrollBeyondLastLine === stableMinimapLayoutInput.scrollBeyondLastLine && input.paddingTop === stableMinimapLayoutInput.paddingTop && input.paddingBottom === stableMinimapLayoutInput.paddingBottom && input.minimap.enabled === stableMinimapLayoutInput.minimap.enabled && input.minimap.side === stableMinimapLayoutInput.minimap.side && input.minimap.size === stableMinimapLayoutInput.minimap.size && input.minimap.showSlider === stableMinimapLayoutInput.minimap.showSlider && input.minimap.renderCharacters === stableMinimapLayoutInput.minimap.renderCharacters && input.minimap.maxColumn === stableMinimapLayoutInput.minimap.maxColumn && input.minimap.scale === stableMinimapLayoutInput.minimap.scale && input.verticalScrollbarWidth === stableMinimapLayoutInput.verticalScrollbarWidth && input.isViewportWrapping === stableMinimapLayoutInput.isViewportWrapping;
    const lineHeight = input.lineHeight;
    const typicalHalfwidthCharacterWidth = input.typicalHalfwidthCharacterWidth;
    const scrollBeyondLastLine = input.scrollBeyondLastLine;
    const minimapRenderCharacters = input.minimap.renderCharacters;
    let minimapScale = pixelRatio >= 2 ? Math.round(input.minimap.scale * 2) : input.minimap.scale;
    const minimapMaxColumn = input.minimap.maxColumn;
    const minimapSize = input.minimap.size;
    const minimapSide = input.minimap.side;
    const verticalScrollbarWidth = input.verticalScrollbarWidth;
    const viewLineCount = input.viewLineCount;
    const remainingWidth = input.remainingWidth;
    const isViewportWrapping = input.isViewportWrapping;
    const baseCharHeight = minimapRenderCharacters ? 2 : 3;
    let minimapCanvasInnerHeight = Math.floor(pixelRatio * outerHeight);
    const minimapCanvasOuterHeight = minimapCanvasInnerHeight / pixelRatio;
    let minimapHeightIsEditorHeight = false;
    let minimapIsSampling = false;
    let minimapLineHeight = baseCharHeight * minimapScale;
    let minimapCharWidth = minimapScale / pixelRatio;
    let minimapWidthMultiplier = 1;
    if (minimapSize === "fill" || minimapSize === "fit") {
      const { typicalViewportLineCount, extraLinesBeforeFirstLine, extraLinesBeyondLastLine, desiredRatio, minimapLineCount } = EditorLayoutInfoComputer.computeContainedMinimapLineCount({
        viewLineCount,
        scrollBeyondLastLine,
        paddingTop: input.paddingTop,
        paddingBottom: input.paddingBottom,
        height: outerHeight,
        lineHeight,
        pixelRatio
      });
      const ratio = viewLineCount / minimapLineCount;
      if (ratio > 1) {
        minimapHeightIsEditorHeight = true;
        minimapIsSampling = true;
        minimapScale = 1;
        minimapLineHeight = 1;
        minimapCharWidth = minimapScale / pixelRatio;
      } else {
        let fitBecomesFill = false;
        let maxMinimapScale = minimapScale + 1;
        if (minimapSize === "fit") {
          const effectiveMinimapHeight = Math.ceil((extraLinesBeforeFirstLine + viewLineCount + extraLinesBeyondLastLine) * minimapLineHeight);
          if (isViewportWrapping && couldUseMemory && remainingWidth <= memory.stableFitRemainingWidth) {
            fitBecomesFill = true;
            maxMinimapScale = memory.stableFitMaxMinimapScale;
          } else {
            fitBecomesFill = effectiveMinimapHeight > minimapCanvasInnerHeight;
          }
        }
        if (minimapSize === "fill" || fitBecomesFill) {
          minimapHeightIsEditorHeight = true;
          const configuredMinimapScale = minimapScale;
          minimapLineHeight = Math.min(lineHeight * pixelRatio, Math.max(1, Math.floor(1 / desiredRatio)));
          if (isViewportWrapping && couldUseMemory && remainingWidth <= memory.stableFitRemainingWidth) {
            maxMinimapScale = memory.stableFitMaxMinimapScale;
          }
          minimapScale = Math.min(maxMinimapScale, Math.max(1, Math.floor(minimapLineHeight / baseCharHeight)));
          if (minimapScale > configuredMinimapScale) {
            minimapWidthMultiplier = Math.min(2, minimapScale / configuredMinimapScale);
          }
          minimapCharWidth = minimapScale / pixelRatio / minimapWidthMultiplier;
          minimapCanvasInnerHeight = Math.ceil(Math.max(typicalViewportLineCount, extraLinesBeforeFirstLine + viewLineCount + extraLinesBeyondLastLine) * minimapLineHeight);
          if (isViewportWrapping) {
            memory.stableMinimapLayoutInput = input;
            memory.stableFitRemainingWidth = remainingWidth;
            memory.stableFitMaxMinimapScale = minimapScale;
          } else {
            memory.stableMinimapLayoutInput = null;
            memory.stableFitRemainingWidth = 0;
          }
        }
      }
    }
    const minimapMaxWidth = Math.floor(minimapMaxColumn * minimapCharWidth);
    const minimapWidth = Math.min(minimapMaxWidth, Math.max(0, Math.floor((remainingWidth - verticalScrollbarWidth - 2) * minimapCharWidth / (typicalHalfwidthCharacterWidth + minimapCharWidth))) + MINIMAP_GUTTER_WIDTH);
    let minimapCanvasInnerWidth = Math.floor(pixelRatio * minimapWidth);
    const minimapCanvasOuterWidth = minimapCanvasInnerWidth / pixelRatio;
    minimapCanvasInnerWidth = Math.floor(minimapCanvasInnerWidth * minimapWidthMultiplier);
    const renderMinimap = minimapRenderCharacters ? 1 /* Text */ : 2 /* Blocks */;
    const minimapLeft = minimapSide === "left" ? 0 : outerWidth - minimapWidth - verticalScrollbarWidth;
    return {
      renderMinimap,
      minimapLeft,
      minimapWidth,
      minimapHeightIsEditorHeight,
      minimapIsSampling,
      minimapScale,
      minimapLineHeight,
      minimapCanvasInnerWidth,
      minimapCanvasInnerHeight,
      minimapCanvasOuterWidth,
      minimapCanvasOuterHeight
    };
  }
  static computeLayout(options, env) {
    const outerWidth = env.outerWidth | 0;
    const outerHeight = env.outerHeight | 0;
    const lineHeight = env.lineHeight | 0;
    const lineNumbersDigitCount = env.lineNumbersDigitCount | 0;
    const typicalHalfwidthCharacterWidth = env.typicalHalfwidthCharacterWidth;
    const maxDigitWidth = env.maxDigitWidth;
    const pixelRatio = env.pixelRatio;
    const viewLineCount = env.viewLineCount;
    const wordWrapOverride2 = options.get(142 /* wordWrapOverride2 */);
    const wordWrapOverride1 = wordWrapOverride2 === "inherit" ? options.get(141 /* wordWrapOverride1 */) : wordWrapOverride2;
    const wordWrap = wordWrapOverride1 === "inherit" ? options.get(137 /* wordWrap */) : wordWrapOverride1;
    const wordWrapColumn = options.get(140 /* wordWrapColumn */);
    const isDominatedByLongLines = env.isDominatedByLongLines;
    const showGlyphMargin = options.get(59 /* glyphMargin */);
    const showLineNumbers = options.get(69 /* lineNumbers */).renderType !== 0 /* Off */;
    const lineNumbersMinChars = options.get(70 /* lineNumbersMinChars */);
    const scrollBeyondLastLine = options.get(110 /* scrollBeyondLastLine */);
    const padding = options.get(88 /* padding */);
    const minimap = options.get(74 /* minimap */);
    const scrollbar = options.get(108 /* scrollbar */);
    const verticalScrollbarWidth = scrollbar.verticalScrollbarSize;
    const verticalScrollbarHasArrows = scrollbar.verticalHasArrows;
    const scrollbarArrowSize = scrollbar.arrowSize;
    const horizontalScrollbarHeight = scrollbar.horizontalScrollbarSize;
    const folding = options.get(45 /* folding */);
    const showFoldingDecoration = options.get(115 /* showFoldingControls */) !== "never";
    let lineDecorationsWidth = options.get(67 /* lineDecorationsWidth */);
    if (folding && showFoldingDecoration) {
      lineDecorationsWidth += 16;
    }
    let lineNumbersWidth = 0;
    if (showLineNumbers) {
      const digitCount = Math.max(lineNumbersDigitCount, lineNumbersMinChars);
      lineNumbersWidth = Math.round(digitCount * maxDigitWidth);
    }
    let glyphMarginWidth = 0;
    if (showGlyphMargin) {
      glyphMarginWidth = lineHeight * env.glyphMarginDecorationLaneCount;
    }
    let glyphMarginLeft = 0;
    let lineNumbersLeft = glyphMarginLeft + glyphMarginWidth;
    let decorationsLeft = lineNumbersLeft + lineNumbersWidth;
    let contentLeft = decorationsLeft + lineDecorationsWidth;
    const remainingWidth = outerWidth - glyphMarginWidth - lineNumbersWidth - lineDecorationsWidth;
    let isWordWrapMinified = false;
    let isViewportWrapping = false;
    let wrappingColumn = -1;
    if (wordWrapOverride1 === "inherit" && isDominatedByLongLines) {
      isWordWrapMinified = true;
      isViewportWrapping = true;
    } else if (wordWrap === "on" || wordWrap === "bounded") {
      isViewportWrapping = true;
    } else if (wordWrap === "wordWrapColumn") {
      wrappingColumn = wordWrapColumn;
    }
    const minimapLayout = EditorLayoutInfoComputer._computeMinimapLayout({
      outerWidth,
      outerHeight,
      lineHeight,
      typicalHalfwidthCharacterWidth,
      pixelRatio,
      scrollBeyondLastLine,
      paddingTop: padding.top,
      paddingBottom: padding.bottom,
      minimap,
      verticalScrollbarWidth,
      viewLineCount,
      remainingWidth,
      isViewportWrapping
    }, env.memory || new ComputeOptionsMemory());
    if (minimapLayout.renderMinimap !== 0 /* None */ && minimapLayout.minimapLeft === 0) {
      glyphMarginLeft += minimapLayout.minimapWidth;
      lineNumbersLeft += minimapLayout.minimapWidth;
      decorationsLeft += minimapLayout.minimapWidth;
      contentLeft += minimapLayout.minimapWidth;
    }
    const contentWidth = remainingWidth - minimapLayout.minimapWidth;
    const viewportColumn = Math.max(1, Math.floor((contentWidth - verticalScrollbarWidth - 2) / typicalHalfwidthCharacterWidth));
    const verticalArrowSize = verticalScrollbarHasArrows ? scrollbarArrowSize : 0;
    if (isViewportWrapping) {
      wrappingColumn = Math.max(1, viewportColumn);
      if (wordWrap === "bounded") {
        wrappingColumn = Math.min(wrappingColumn, wordWrapColumn);
      }
    }
    return {
      width: outerWidth,
      height: outerHeight,
      glyphMarginLeft,
      glyphMarginWidth,
      glyphMarginDecorationLaneCount: env.glyphMarginDecorationLaneCount,
      lineNumbersLeft,
      lineNumbersWidth,
      decorationsLeft,
      decorationsWidth: lineDecorationsWidth,
      contentLeft,
      contentWidth,
      minimap: minimapLayout,
      viewportColumn,
      isWordWrapMinified,
      isViewportWrapping,
      wrappingColumn,
      verticalScrollbarWidth,
      horizontalScrollbarHeight,
      overviewRuler: {
        top: verticalArrowSize,
        width: verticalScrollbarWidth,
        height: outerHeight - 2 * verticalArrowSize,
        right: 0
      }
    };
  }
}
class WrappingStrategy extends BaseEditorOption {
  constructor() {
    super(
      144 /* wrappingStrategy */,
      "wrappingStrategy",
      "simple",
      {
        "editor.wrappingStrategy": {
          enumDescriptions: [
            nls.localize("wrappingStrategy.simple", "Assumes that all characters are of the same width. This is a fast algorithm that works correctly for monospace fonts and certain scripts (like Latin characters) where glyphs are of equal width."),
            nls.localize("wrappingStrategy.advanced", "Delegates wrapping points computation to the browser. This is a slow algorithm, that might cause freezes for large files, but it works correctly in all cases.")
          ],
          type: "string",
          enum: ["simple", "advanced"],
          default: "simple",
          description: nls.localize("wrappingStrategy", "Controls the algorithm that computes wrapping points. Note that when in accessibility mode, advanced will be used for the best experience.")
        }
      }
    );
  }
  validate(input) {
    return stringSet(input, "simple", ["simple", "advanced"]);
  }
  compute(env, options, value) {
    const accessibilitySupport = options.get(2 /* accessibilitySupport */);
    if (accessibilitySupport === AccessibilitySupport.Enabled) {
      return "advanced";
    }
    return value;
  }
}
var ShowLightbulbIconMode = /* @__PURE__ */ ((ShowLightbulbIconMode2) => {
  ShowLightbulbIconMode2["Off"] = "off";
  ShowLightbulbIconMode2["OnCode"] = "onCode";
  ShowLightbulbIconMode2["On"] = "on";
  return ShowLightbulbIconMode2;
})(ShowLightbulbIconMode || {});
class EditorLightbulb extends BaseEditorOption {
  constructor() {
    const defaults = { enabled: "onCode" /* OnCode */ };
    super(
      66 /* lightbulb */,
      "lightbulb",
      defaults,
      {
        "editor.lightbulb.enabled": {
          type: "string",
          enum: ["off" /* Off */, "onCode" /* OnCode */, "on" /* On */],
          default: defaults.enabled,
          enumDescriptions: [
            nls.localize("editor.lightbulb.enabled.off", "Disable the code action menu."),
            nls.localize("editor.lightbulb.enabled.onCode", "Show the code action menu when the cursor is on lines with code."),
            nls.localize("editor.lightbulb.enabled.on", "Show the code action menu when the cursor is on lines with code or on empty lines.")
          ],
          description: nls.localize("enabled", "Enables the Code Action lightbulb in the editor.")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      enabled: stringSet(input.enabled, this.defaultValue.enabled, ["off" /* Off */, "onCode" /* OnCode */, "on" /* On */])
    };
  }
}
class EditorStickyScroll extends BaseEditorOption {
  constructor() {
    const defaults = { enabled: true, maxLineCount: 5, defaultModel: "outlineModel", scrollWithEditor: true };
    super(
      120 /* stickyScroll */,
      "stickyScroll",
      defaults,
      {
        "editor.stickyScroll.enabled": {
          type: "boolean",
          default: defaults.enabled,
          description: nls.localize("editor.stickyScroll.enabled", "Shows the nested current scopes during the scroll at the top of the editor.")
        },
        "editor.stickyScroll.maxLineCount": {
          type: "number",
          default: defaults.maxLineCount,
          minimum: 1,
          maximum: 20,
          description: nls.localize("editor.stickyScroll.maxLineCount", "Defines the maximum number of sticky lines to show.")
        },
        "editor.stickyScroll.defaultModel": {
          type: "string",
          enum: ["outlineModel", "foldingProviderModel", "indentationModel"],
          default: defaults.defaultModel,
          description: nls.localize("editor.stickyScroll.defaultModel", "Defines the model to use for determining which lines to stick. If the outline model does not exist, it will fall back on the folding provider model which falls back on the indentation model. This order is respected in all three cases.")
        },
        "editor.stickyScroll.scrollWithEditor": {
          type: "boolean",
          default: defaults.scrollWithEditor,
          description: nls.localize("editor.stickyScroll.scrollWithEditor", "Enable scrolling of Sticky Scroll with the editor's horizontal scrollbar.")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      enabled: boolean(input.enabled, this.defaultValue.enabled),
      maxLineCount: EditorIntOption.clampedInt(input.maxLineCount, this.defaultValue.maxLineCount, 1, 20),
      defaultModel: stringSet(input.defaultModel, this.defaultValue.defaultModel, ["outlineModel", "foldingProviderModel", "indentationModel"]),
      scrollWithEditor: boolean(input.scrollWithEditor, this.defaultValue.scrollWithEditor)
    };
  }
}
class EditorInlayHints extends BaseEditorOption {
  constructor() {
    const defaults = { enabled: "on", fontSize: 0, fontFamily: "", padding: false, maximumLength: 43 };
    super(
      146 /* inlayHints */,
      "inlayHints",
      defaults,
      {
        "editor.inlayHints.enabled": {
          type: "string",
          default: defaults.enabled,
          description: nls.localize("inlayHints.enable", "Enables the inlay hints in the editor."),
          enum: ["on", "onUnlessPressed", "offUnlessPressed", "off"],
          markdownEnumDescriptions: [
            nls.localize("editor.inlayHints.on", "Inlay hints are enabled"),
            nls.localize("editor.inlayHints.onUnlessPressed", "Inlay hints are showing by default and hide when holding {0}", platform.isMacintosh ? `Ctrl+Option` : `Ctrl+Alt`),
            nls.localize("editor.inlayHints.offUnlessPressed", "Inlay hints are hidden by default and show when holding {0}", platform.isMacintosh ? `Ctrl+Option` : `Ctrl+Alt`),
            nls.localize("editor.inlayHints.off", "Inlay hints are disabled")
          ]
        },
        "editor.inlayHints.fontSize": {
          type: "number",
          default: defaults.fontSize,
          markdownDescription: nls.localize("inlayHints.fontSize", "Controls font size of inlay hints in the editor. As default the {0} is used when the configured value is less than {1} or greater than the editor font size.", "`#editor.fontSize#`", "`5`")
        },
        "editor.inlayHints.fontFamily": {
          type: "string",
          default: defaults.fontFamily,
          markdownDescription: nls.localize("inlayHints.fontFamily", "Controls font family of inlay hints in the editor. When set to empty, the {0} is used.", "`#editor.fontFamily#`")
        },
        "editor.inlayHints.padding": {
          type: "boolean",
          default: defaults.padding,
          description: nls.localize("inlayHints.padding", "Enables the padding around the inlay hints in the editor.")
        },
        "editor.inlayHints.maximumLength": {
          type: "number",
          default: defaults.maximumLength,
          markdownDescription: nls.localize("inlayHints.maximumLength", "Maximum overall length of inlay hints, for a single line, before they get truncated by the editor. Set to `0` to never truncate")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    if (typeof input.enabled === "boolean") {
      input.enabled = input.enabled ? "on" : "off";
    }
    return {
      enabled: stringSet(input.enabled, this.defaultValue.enabled, ["on", "off", "offUnlessPressed", "onUnlessPressed"]),
      fontSize: EditorIntOption.clampedInt(input.fontSize, this.defaultValue.fontSize, 0, 100),
      fontFamily: EditorStringOption.string(input.fontFamily, this.defaultValue.fontFamily),
      padding: boolean(input.padding, this.defaultValue.padding),
      maximumLength: EditorIntOption.clampedInt(input.maximumLength, this.defaultValue.maximumLength, 0, Number.MAX_SAFE_INTEGER)
    };
  }
}
class EditorLineDecorationsWidth extends BaseEditorOption {
  constructor() {
    super(67 /* lineDecorationsWidth */, "lineDecorationsWidth", 10);
  }
  validate(input) {
    if (typeof input === "string" && /^\d+(\.\d+)?ch$/.test(input)) {
      const multiple = parseFloat(input.substring(0, input.length - 2));
      return -multiple;
    } else {
      return EditorIntOption.clampedInt(input, this.defaultValue, 0, 1e3);
    }
  }
  compute(env, options, value) {
    if (value < 0) {
      return EditorIntOption.clampedInt(-value * env.fontInfo.typicalHalfwidthCharacterWidth, this.defaultValue, 0, 1e3);
    } else {
      return value;
    }
  }
}
class EditorLineHeight extends EditorFloatOption {
  constructor() {
    super(
      68 /* lineHeight */,
      "lineHeight",
      EDITOR_FONT_DEFAULTS.lineHeight,
      (x) => EditorFloatOption.clamp(x, 0, 150),
      { markdownDescription: nls.localize("lineHeight", "Controls the line height. \n - Use 0 to automatically compute the line height from the font size.\n - Values between 0 and 8 will be used as a multiplier with the font size.\n - Values greater than or equal to 8 will be used as effective values.") }
    );
  }
  compute(env, options, value) {
    return env.fontInfo.lineHeight;
  }
}
class EditorMinimap extends BaseEditorOption {
  constructor() {
    const defaults = {
      enabled: true,
      size: "proportional",
      side: "right",
      showSlider: "mouseover",
      autohide: false,
      renderCharacters: true,
      maxColumn: 120,
      scale: 1,
      showRegionSectionHeaders: true,
      showMarkSectionHeaders: true,
      markSectionHeaderRegex: "\\bMARK:\\s*(?<separator>-?)\\s*(?<label>.*)$",
      sectionHeaderFontSize: 9,
      sectionHeaderLetterSpacing: 1
    };
    super(
      74 /* minimap */,
      "minimap",
      defaults,
      {
        "editor.minimap.enabled": {
          type: "boolean",
          default: defaults.enabled,
          description: nls.localize("minimap.enabled", "Controls whether the minimap is shown.")
        },
        "editor.minimap.autohide": {
          type: "boolean",
          default: defaults.autohide,
          description: nls.localize("minimap.autohide", "Controls whether the minimap is hidden automatically.")
        },
        "editor.minimap.size": {
          type: "string",
          enum: ["proportional", "fill", "fit"],
          enumDescriptions: [
            nls.localize("minimap.size.proportional", "The minimap has the same size as the editor contents (and might scroll)."),
            nls.localize("minimap.size.fill", "The minimap will stretch or shrink as necessary to fill the height of the editor (no scrolling)."),
            nls.localize("minimap.size.fit", "The minimap will shrink as necessary to never be larger than the editor (no scrolling).")
          ],
          default: defaults.size,
          description: nls.localize("minimap.size", "Controls the size of the minimap.")
        },
        "editor.minimap.side": {
          type: "string",
          enum: ["left", "right"],
          default: defaults.side,
          description: nls.localize("minimap.side", "Controls the side where to render the minimap.")
        },
        "editor.minimap.showSlider": {
          type: "string",
          enum: ["always", "mouseover"],
          default: defaults.showSlider,
          description: nls.localize("minimap.showSlider", "Controls when the minimap slider is shown.")
        },
        "editor.minimap.scale": {
          type: "number",
          default: defaults.scale,
          minimum: 1,
          maximum: 3,
          enum: [1, 2, 3],
          description: nls.localize("minimap.scale", "Scale of content drawn in the minimap: 1, 2 or 3.")
        },
        "editor.minimap.renderCharacters": {
          type: "boolean",
          default: defaults.renderCharacters,
          description: nls.localize("minimap.renderCharacters", "Render the actual characters on a line as opposed to color blocks.")
        },
        "editor.minimap.maxColumn": {
          type: "number",
          default: defaults.maxColumn,
          description: nls.localize("minimap.maxColumn", "Limit the width of the minimap to render at most a certain number of columns.")
        },
        "editor.minimap.showRegionSectionHeaders": {
          type: "boolean",
          default: defaults.showRegionSectionHeaders,
          description: nls.localize("minimap.showRegionSectionHeaders", "Controls whether named regions are shown as section headers in the minimap.")
        },
        "editor.minimap.showMarkSectionHeaders": {
          type: "boolean",
          default: defaults.showMarkSectionHeaders,
          description: nls.localize("minimap.showMarkSectionHeaders", "Controls whether MARK: comments are shown as section headers in the minimap.")
        },
        "editor.minimap.markSectionHeaderRegex": {
          type: "string",
          default: defaults.markSectionHeaderRegex,
          description: nls.localize("minimap.markSectionHeaderRegex", "Defines the regular expression used to find section headers in comments. The regex must contain a named match group `label` (written as `(?<label>.+)`) that encapsulates the section header, otherwise it will not work. Optionally you can include another match group named `separator`. Use \\n in the pattern to match multi-line headers.")
        },
        "editor.minimap.sectionHeaderFontSize": {
          type: "number",
          default: defaults.sectionHeaderFontSize,
          description: nls.localize("minimap.sectionHeaderFontSize", "Controls the font size of section headers in the minimap.")
        },
        "editor.minimap.sectionHeaderLetterSpacing": {
          type: "number",
          default: defaults.sectionHeaderLetterSpacing,
          description: nls.localize("minimap.sectionHeaderLetterSpacing", "Controls the amount of space (in pixels) between characters of section header. This helps the readability of the header in small font sizes.")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    let markSectionHeaderRegex = this.defaultValue.markSectionHeaderRegex;
    const inputRegex = _input.markSectionHeaderRegex;
    if (typeof inputRegex === "string") {
      try {
        new RegExp(inputRegex, "d");
        markSectionHeaderRegex = inputRegex;
      } catch {
      }
    }
    return {
      enabled: boolean(input.enabled, this.defaultValue.enabled),
      autohide: boolean(input.autohide, this.defaultValue.autohide),
      size: stringSet(input.size, this.defaultValue.size, ["proportional", "fill", "fit"]),
      side: stringSet(input.side, this.defaultValue.side, ["right", "left"]),
      showSlider: stringSet(input.showSlider, this.defaultValue.showSlider, ["always", "mouseover"]),
      renderCharacters: boolean(input.renderCharacters, this.defaultValue.renderCharacters),
      scale: EditorIntOption.clampedInt(input.scale, 1, 1, 3),
      maxColumn: EditorIntOption.clampedInt(input.maxColumn, this.defaultValue.maxColumn, 1, 1e4),
      showRegionSectionHeaders: boolean(input.showRegionSectionHeaders, this.defaultValue.showRegionSectionHeaders),
      showMarkSectionHeaders: boolean(input.showMarkSectionHeaders, this.defaultValue.showMarkSectionHeaders),
      markSectionHeaderRegex,
      sectionHeaderFontSize: EditorFloatOption.clamp(input.sectionHeaderFontSize ?? this.defaultValue.sectionHeaderFontSize, 4, 32),
      sectionHeaderLetterSpacing: EditorFloatOption.clamp(input.sectionHeaderLetterSpacing ?? this.defaultValue.sectionHeaderLetterSpacing, 0, 5)
    };
  }
}
function _multiCursorModifierFromString(multiCursorModifier) {
  if (multiCursorModifier === "ctrlCmd") {
    return platform.isMacintosh ? "metaKey" : "ctrlKey";
  }
  return "altKey";
}
class EditorPadding extends BaseEditorOption {
  constructor() {
    super(
      88 /* padding */,
      "padding",
      { top: 0, bottom: 0 },
      {
        "editor.padding.top": {
          type: "number",
          default: 0,
          minimum: 0,
          maximum: 1e3,
          description: nls.localize("padding.top", "Controls the amount of space between the top edge of the editor and the first line.")
        },
        "editor.padding.bottom": {
          type: "number",
          default: 0,
          minimum: 0,
          maximum: 1e3,
          description: nls.localize("padding.bottom", "Controls the amount of space between the bottom edge of the editor and the last line.")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      top: EditorIntOption.clampedInt(input.top, 0, 0, 1e3),
      bottom: EditorIntOption.clampedInt(input.bottom, 0, 0, 1e3)
    };
  }
}
class EditorParameterHints extends BaseEditorOption {
  constructor() {
    const defaults = {
      enabled: true,
      cycle: true
    };
    super(
      90 /* parameterHints */,
      "parameterHints",
      defaults,
      {
        "editor.parameterHints.enabled": {
          type: "boolean",
          default: defaults.enabled,
          description: nls.localize("parameterHints.enabled", "Enables a pop-up that shows parameter documentation and type information as you type.")
        },
        "editor.parameterHints.cycle": {
          type: "boolean",
          default: defaults.cycle,
          description: nls.localize("parameterHints.cycle", "Controls whether the parameter hints menu cycles or closes when reaching the end of the list.")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      enabled: boolean(input.enabled, this.defaultValue.enabled),
      cycle: boolean(input.cycle, this.defaultValue.cycle)
    };
  }
}
class EditorPixelRatio extends ComputedEditorOption {
  constructor() {
    super(149 /* pixelRatio */);
  }
  compute(env, options, _) {
    return env.pixelRatio;
  }
}
class PlaceholderOption extends BaseEditorOption {
  constructor() {
    super(92 /* placeholder */, "placeholder", void 0);
  }
  validate(input) {
    if (typeof input === "undefined") {
      return this.defaultValue;
    }
    if (typeof input === "string") {
      return input;
    }
    return this.defaultValue;
  }
}
class EditorQuickSuggestions extends BaseEditorOption {
  constructor() {
    const defaults = {
      other: "on",
      comments: "off",
      strings: "on"
      // Void changed this setting
    };
    const types = [
      { type: "boolean" },
      {
        type: "string",
        enum: ["on", "inline", "off"],
        enumDescriptions: [nls.localize("on", "Quick suggestions show inside the suggest widget"), nls.localize("inline", "Quick suggestions show as ghost text"), nls.localize("off", "Quick suggestions are disabled")]
      }
    ];
    super(94 /* quickSuggestions */, "quickSuggestions", defaults, {
      type: "object",
      additionalProperties: false,
      properties: {
        strings: {
          anyOf: types,
          default: defaults.strings,
          description: nls.localize("quickSuggestions.strings", "Enable quick suggestions inside strings.")
        },
        comments: {
          anyOf: types,
          default: defaults.comments,
          description: nls.localize("quickSuggestions.comments", "Enable quick suggestions inside comments.")
        },
        other: {
          anyOf: types,
          default: defaults.other,
          description: nls.localize("quickSuggestions.other", "Enable quick suggestions outside of strings and comments.")
        }
      },
      default: defaults,
      markdownDescription: nls.localize("quickSuggestions", "Controls whether suggestions should automatically show up while typing. This can be controlled for typing in comments, strings, and other code. Quick suggestion can be configured to show as ghost text or with the suggest widget. Also be aware of the {0}-setting which controls if suggestions are triggered by special characters.", "`#editor.suggestOnTriggerCharacters#`")
    });
    this.defaultValue = defaults;
  }
  validate(input) {
    if (typeof input === "boolean") {
      const value = input ? "on" : "off";
      return { comments: value, strings: value, other: value };
    }
    if (!input || typeof input !== "object") {
      return this.defaultValue;
    }
    const { other, comments, strings } = input;
    const allowedValues = ["on", "inline", "off"];
    let validatedOther;
    let validatedComments;
    let validatedStrings;
    if (typeof other === "boolean") {
      validatedOther = other ? "on" : "off";
    } else {
      validatedOther = stringSet(other, this.defaultValue.other, allowedValues);
    }
    if (typeof comments === "boolean") {
      validatedComments = comments ? "on" : "off";
    } else {
      validatedComments = stringSet(comments, this.defaultValue.comments, allowedValues);
    }
    if (typeof strings === "boolean") {
      validatedStrings = strings ? "on" : "off";
    } else {
      validatedStrings = stringSet(strings, this.defaultValue.strings, allowedValues);
    }
    return {
      other: validatedOther,
      comments: validatedComments,
      strings: validatedStrings
    };
  }
}
var RenderLineNumbersType = /* @__PURE__ */ ((RenderLineNumbersType2) => {
  RenderLineNumbersType2[RenderLineNumbersType2["Off"] = 0] = "Off";
  RenderLineNumbersType2[RenderLineNumbersType2["On"] = 1] = "On";
  RenderLineNumbersType2[RenderLineNumbersType2["Relative"] = 2] = "Relative";
  RenderLineNumbersType2[RenderLineNumbersType2["Interval"] = 3] = "Interval";
  RenderLineNumbersType2[RenderLineNumbersType2["Custom"] = 4] = "Custom";
  return RenderLineNumbersType2;
})(RenderLineNumbersType || {});
class EditorRenderLineNumbersOption extends BaseEditorOption {
  constructor() {
    super(
      69 /* lineNumbers */,
      "lineNumbers",
      { renderType: 1 /* On */, renderFn: null },
      {
        type: "string",
        enum: ["off", "on", "relative", "interval"],
        enumDescriptions: [
          nls.localize("lineNumbers.off", "Line numbers are not rendered."),
          nls.localize("lineNumbers.on", "Line numbers are rendered as absolute number."),
          nls.localize("lineNumbers.relative", "Line numbers are rendered as distance in lines to cursor position."),
          nls.localize("lineNumbers.interval", "Line numbers are rendered every 10 lines.")
        ],
        default: "on",
        description: nls.localize("lineNumbers", "Controls the display of line numbers.")
      }
    );
  }
  validate(lineNumbers) {
    let renderType = this.defaultValue.renderType;
    let renderFn = this.defaultValue.renderFn;
    if (typeof lineNumbers !== "undefined") {
      if (typeof lineNumbers === "function") {
        renderType = 4 /* Custom */;
        renderFn = lineNumbers;
      } else if (lineNumbers === "interval") {
        renderType = 3 /* Interval */;
      } else if (lineNumbers === "relative") {
        renderType = 2 /* Relative */;
      } else if (lineNumbers === "on") {
        renderType = 1 /* On */;
      } else {
        renderType = 0 /* Off */;
      }
    }
    return {
      renderType,
      renderFn
    };
  }
}
function filterValidationDecorations(options) {
  const renderValidationDecorations = options.get(103 /* renderValidationDecorations */);
  if (renderValidationDecorations === "editable") {
    return options.get(96 /* readOnly */);
  }
  return renderValidationDecorations === "on" ? false : true;
}
class EditorRulers extends BaseEditorOption {
  constructor() {
    const defaults = [];
    const columnSchema = { type: "number", description: nls.localize("rulers.size", "Number of monospace characters at which this editor ruler will render.") };
    super(
      107 /* rulers */,
      "rulers",
      defaults,
      {
        type: "array",
        items: {
          anyOf: [
            columnSchema,
            {
              type: [
                "object"
              ],
              properties: {
                column: columnSchema,
                color: {
                  type: "string",
                  description: nls.localize("rulers.color", "Color of this editor ruler."),
                  format: "color-hex"
                }
              }
            }
          ]
        },
        default: defaults,
        description: nls.localize("rulers", "Render vertical rulers after a certain number of monospace characters. Use multiple values for multiple rulers. No rulers are drawn if array is empty.")
      }
    );
  }
  validate(input) {
    if (Array.isArray(input)) {
      const rulers = [];
      for (const _element of input) {
        if (typeof _element === "number") {
          rulers.push({
            column: EditorIntOption.clampedInt(_element, 0, 0, 1e4),
            color: null
          });
        } else if (_element && typeof _element === "object") {
          const element = _element;
          rulers.push({
            column: EditorIntOption.clampedInt(element.column, 0, 0, 1e4),
            color: element.color
          });
        }
      }
      rulers.sort((a, b) => a.column - b.column);
      return rulers;
    }
    return this.defaultValue;
  }
}
class ReadonlyMessage extends BaseEditorOption {
  constructor() {
    const defaults = void 0;
    super(
      97 /* readOnlyMessage */,
      "readOnlyMessage",
      defaults
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    return _input;
  }
}
function _scrollbarVisibilityFromString(visibility, defaultValue) {
  if (typeof visibility !== "string") {
    return defaultValue;
  }
  switch (visibility) {
    case "hidden":
      return ScrollbarVisibility.Hidden;
    case "visible":
      return ScrollbarVisibility.Visible;
    default:
      return ScrollbarVisibility.Auto;
  }
}
class EditorScrollbar extends BaseEditorOption {
  constructor() {
    const defaults = {
      vertical: ScrollbarVisibility.Auto,
      horizontal: ScrollbarVisibility.Auto,
      arrowSize: 11,
      useShadows: true,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      horizontalScrollbarSize: 12,
      horizontalSliderSize: 12,
      verticalScrollbarSize: 14,
      verticalSliderSize: 14,
      handleMouseWheel: true,
      alwaysConsumeMouseWheel: true,
      scrollByPage: false,
      ignoreHorizontalScrollbarInContentHeight: false
    };
    super(
      108 /* scrollbar */,
      "scrollbar",
      defaults,
      {
        "editor.scrollbar.vertical": {
          type: "string",
          enum: ["auto", "visible", "hidden"],
          enumDescriptions: [
            nls.localize("scrollbar.vertical.auto", "The vertical scrollbar will be visible only when necessary."),
            nls.localize("scrollbar.vertical.visible", "The vertical scrollbar will always be visible."),
            nls.localize("scrollbar.vertical.fit", "The vertical scrollbar will always be hidden.")
          ],
          default: "auto",
          description: nls.localize("scrollbar.vertical", "Controls the visibility of the vertical scrollbar.")
        },
        "editor.scrollbar.horizontal": {
          type: "string",
          enum: ["auto", "visible", "hidden"],
          enumDescriptions: [
            nls.localize("scrollbar.horizontal.auto", "The horizontal scrollbar will be visible only when necessary."),
            nls.localize("scrollbar.horizontal.visible", "The horizontal scrollbar will always be visible."),
            nls.localize("scrollbar.horizontal.fit", "The horizontal scrollbar will always be hidden.")
          ],
          default: "auto",
          description: nls.localize("scrollbar.horizontal", "Controls the visibility of the horizontal scrollbar.")
        },
        "editor.scrollbar.verticalScrollbarSize": {
          type: "number",
          default: defaults.verticalScrollbarSize,
          description: nls.localize("scrollbar.verticalScrollbarSize", "The width of the vertical scrollbar.")
        },
        "editor.scrollbar.horizontalScrollbarSize": {
          type: "number",
          default: defaults.horizontalScrollbarSize,
          description: nls.localize("scrollbar.horizontalScrollbarSize", "The height of the horizontal scrollbar.")
        },
        "editor.scrollbar.scrollByPage": {
          type: "boolean",
          default: defaults.scrollByPage,
          description: nls.localize("scrollbar.scrollByPage", "Controls whether clicks scroll by page or jump to click position.")
        },
        "editor.scrollbar.ignoreHorizontalScrollbarInContentHeight": {
          type: "boolean",
          default: defaults.ignoreHorizontalScrollbarInContentHeight,
          description: nls.localize("scrollbar.ignoreHorizontalScrollbarInContentHeight", "When set, the horizontal scrollbar will not increase the size of the editor's content.")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    const horizontalScrollbarSize = EditorIntOption.clampedInt(input.horizontalScrollbarSize, this.defaultValue.horizontalScrollbarSize, 0, 1e3);
    const verticalScrollbarSize = EditorIntOption.clampedInt(input.verticalScrollbarSize, this.defaultValue.verticalScrollbarSize, 0, 1e3);
    return {
      arrowSize: EditorIntOption.clampedInt(input.arrowSize, this.defaultValue.arrowSize, 0, 1e3),
      vertical: _scrollbarVisibilityFromString(input.vertical, this.defaultValue.vertical),
      horizontal: _scrollbarVisibilityFromString(input.horizontal, this.defaultValue.horizontal),
      useShadows: boolean(input.useShadows, this.defaultValue.useShadows),
      verticalHasArrows: boolean(input.verticalHasArrows, this.defaultValue.verticalHasArrows),
      horizontalHasArrows: boolean(input.horizontalHasArrows, this.defaultValue.horizontalHasArrows),
      handleMouseWheel: boolean(input.handleMouseWheel, this.defaultValue.handleMouseWheel),
      alwaysConsumeMouseWheel: boolean(input.alwaysConsumeMouseWheel, this.defaultValue.alwaysConsumeMouseWheel),
      horizontalScrollbarSize,
      horizontalSliderSize: EditorIntOption.clampedInt(input.horizontalSliderSize, horizontalScrollbarSize, 0, 1e3),
      verticalScrollbarSize,
      verticalSliderSize: EditorIntOption.clampedInt(input.verticalSliderSize, verticalScrollbarSize, 0, 1e3),
      scrollByPage: boolean(input.scrollByPage, this.defaultValue.scrollByPage),
      ignoreHorizontalScrollbarInContentHeight: boolean(input.ignoreHorizontalScrollbarInContentHeight, this.defaultValue.ignoreHorizontalScrollbarInContentHeight)
    };
  }
}
const inUntrustedWorkspace = "inUntrustedWorkspace";
const unicodeHighlightConfigKeys = {
  allowedCharacters: "editor.unicodeHighlight.allowedCharacters",
  invisibleCharacters: "editor.unicodeHighlight.invisibleCharacters",
  nonBasicASCII: "editor.unicodeHighlight.nonBasicASCII",
  ambiguousCharacters: "editor.unicodeHighlight.ambiguousCharacters",
  includeComments: "editor.unicodeHighlight.includeComments",
  includeStrings: "editor.unicodeHighlight.includeStrings",
  allowedLocales: "editor.unicodeHighlight.allowedLocales"
};
class UnicodeHighlight extends BaseEditorOption {
  constructor() {
    const defaults = {
      nonBasicASCII: inUntrustedWorkspace,
      invisibleCharacters: true,
      ambiguousCharacters: true,
      includeComments: inUntrustedWorkspace,
      includeStrings: true,
      allowedCharacters: {},
      allowedLocales: { _os: true, _vscode: true }
    };
    super(
      130 /* unicodeHighlighting */,
      "unicodeHighlight",
      defaults,
      {
        [unicodeHighlightConfigKeys.nonBasicASCII]: {
          restricted: true,
          type: ["boolean", "string"],
          enum: [true, false, inUntrustedWorkspace],
          default: defaults.nonBasicASCII,
          description: nls.localize("unicodeHighlight.nonBasicASCII", "Controls whether all non-basic ASCII characters are highlighted. Only characters between U+0020 and U+007E, tab, line-feed and carriage-return are considered basic ASCII.")
        },
        [unicodeHighlightConfigKeys.invisibleCharacters]: {
          restricted: true,
          type: "boolean",
          default: defaults.invisibleCharacters,
          description: nls.localize("unicodeHighlight.invisibleCharacters", "Controls whether characters that just reserve space or have no width at all are highlighted.")
        },
        [unicodeHighlightConfigKeys.ambiguousCharacters]: {
          restricted: true,
          type: "boolean",
          default: defaults.ambiguousCharacters,
          description: nls.localize("unicodeHighlight.ambiguousCharacters", "Controls whether characters are highlighted that can be confused with basic ASCII characters, except those that are common in the current user locale.")
        },
        [unicodeHighlightConfigKeys.includeComments]: {
          restricted: true,
          type: ["boolean", "string"],
          enum: [true, false, inUntrustedWorkspace],
          default: defaults.includeComments,
          description: nls.localize("unicodeHighlight.includeComments", "Controls whether characters in comments should also be subject to Unicode highlighting.")
        },
        [unicodeHighlightConfigKeys.includeStrings]: {
          restricted: true,
          type: ["boolean", "string"],
          enum: [true, false, inUntrustedWorkspace],
          default: defaults.includeStrings,
          description: nls.localize("unicodeHighlight.includeStrings", "Controls whether characters in strings should also be subject to Unicode highlighting.")
        },
        [unicodeHighlightConfigKeys.allowedCharacters]: {
          restricted: true,
          type: "object",
          default: defaults.allowedCharacters,
          description: nls.localize("unicodeHighlight.allowedCharacters", "Defines allowed characters that are not being highlighted."),
          additionalProperties: {
            type: "boolean"
          }
        },
        [unicodeHighlightConfigKeys.allowedLocales]: {
          restricted: true,
          type: "object",
          additionalProperties: {
            type: "boolean"
          },
          default: defaults.allowedLocales,
          description: nls.localize("unicodeHighlight.allowedLocales", "Unicode characters that are common in allowed locales are not being highlighted.")
        }
      }
    );
  }
  applyUpdate(value, update) {
    let didChange = false;
    if (update.allowedCharacters && value) {
      if (!objects.equals(value.allowedCharacters, update.allowedCharacters)) {
        value = { ...value, allowedCharacters: update.allowedCharacters };
        didChange = true;
      }
    }
    if (update.allowedLocales && value) {
      if (!objects.equals(value.allowedLocales, update.allowedLocales)) {
        value = { ...value, allowedLocales: update.allowedLocales };
        didChange = true;
      }
    }
    const result = super.applyUpdate(value, update);
    if (didChange) {
      return new ApplyUpdateResult(result.newValue, true);
    }
    return result;
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      nonBasicASCII: primitiveSet(input.nonBasicASCII, inUntrustedWorkspace, [true, false, inUntrustedWorkspace]),
      invisibleCharacters: boolean(input.invisibleCharacters, this.defaultValue.invisibleCharacters),
      ambiguousCharacters: boolean(input.ambiguousCharacters, this.defaultValue.ambiguousCharacters),
      includeComments: primitiveSet(input.includeComments, inUntrustedWorkspace, [true, false, inUntrustedWorkspace]),
      includeStrings: primitiveSet(input.includeStrings, inUntrustedWorkspace, [true, false, inUntrustedWorkspace]),
      allowedCharacters: this.validateBooleanMap(_input.allowedCharacters, this.defaultValue.allowedCharacters),
      allowedLocales: this.validateBooleanMap(_input.allowedLocales, this.defaultValue.allowedLocales)
    };
  }
  validateBooleanMap(map, defaultValue) {
    if (typeof map !== "object" || !map) {
      return defaultValue;
    }
    const result = {};
    for (const [key, value] of Object.entries(map)) {
      if (value === true) {
        result[key] = true;
      }
    }
    return result;
  }
}
class InlineEditorSuggest extends BaseEditorOption {
  constructor() {
    const defaults = {
      enabled: true,
      mode: "subwordSmart",
      showToolbar: "onHover",
      suppressSuggestions: false,
      keepOnBlur: false,
      fontFamily: "default",
      syntaxHighlightingEnabled: true,
      edits: {
        enabled: true,
        showCollapsed: false,
        renderSideBySide: "auto",
        allowCodeShifting: "always",
        useMultiLineGhostText: true
      }
    };
    super(
      64 /* inlineSuggest */,
      "inlineSuggest",
      defaults,
      {
        "editor.inlineSuggest.enabled": {
          type: "boolean",
          default: defaults.enabled,
          description: nls.localize("inlineSuggest.enabled", "Controls whether to automatically show inline suggestions in the editor.")
        },
        "editor.inlineSuggest.showToolbar": {
          type: "string",
          default: defaults.showToolbar,
          enum: ["always", "onHover", "never"],
          enumDescriptions: [
            nls.localize("inlineSuggest.showToolbar.always", "Show the inline suggestion toolbar whenever an inline suggestion is shown."),
            nls.localize("inlineSuggest.showToolbar.onHover", "Show the inline suggestion toolbar when hovering over an inline suggestion."),
            nls.localize("inlineSuggest.showToolbar.never", "Never show the inline suggestion toolbar.")
          ],
          description: nls.localize("inlineSuggest.showToolbar", "Controls when to show the inline suggestion toolbar.")
        },
        "editor.inlineSuggest.syntaxHighlightingEnabled": {
          type: "boolean",
          default: defaults.syntaxHighlightingEnabled,
          description: nls.localize("inlineSuggest.syntaxHighlightingEnabled", "Controls whether to show syntax highlighting for inline suggestions in the editor.")
        },
        "editor.inlineSuggest.suppressSuggestions": {
          type: "boolean",
          default: defaults.suppressSuggestions,
          description: nls.localize("inlineSuggest.suppressSuggestions", "Controls how inline suggestions interact with the suggest widget. If enabled, the suggest widget is not shown automatically when inline suggestions are available.")
        },
        "editor.inlineSuggest.fontFamily": {
          type: "string",
          default: defaults.fontFamily,
          description: nls.localize("inlineSuggest.fontFamily", "Controls the font family of the inline suggestions.")
        },
        "editor.inlineSuggest.edits.allowCodeShifting": {
          type: "string",
          default: defaults.edits.allowCodeShifting,
          description: nls.localize("inlineSuggest.edits.allowCodeShifting", "Controls whether showing a suggestion will shift the code to make space for the suggestion inline."),
          enum: ["always", "horizontal", "never"],
          tags: ["nextEditSuggestions"]
        },
        "editor.inlineSuggest.edits.renderSideBySide": {
          type: "string",
          default: defaults.edits.renderSideBySide,
          description: nls.localize("inlineSuggest.edits.renderSideBySide", "Controls whether larger suggestions can be shown side by side."),
          enum: ["auto", "never"],
          enumDescriptions: [
            nls.localize("editor.inlineSuggest.edits.renderSideBySide.auto", "Larger suggestions will show side by side if there is enough space, otherwise they will be shown below."),
            nls.localize("editor.inlineSuggest.edits.renderSideBySide.never", "Larger suggestions are never shown side by side and will always be shown below.")
          ],
          tags: ["nextEditSuggestions"]
        },
        "editor.inlineSuggest.edits.showCollapsed": {
          type: "boolean",
          default: defaults.edits.showCollapsed,
          description: nls.localize("inlineSuggest.edits.showCollapsed", "Controls whether the suggestion will show as collapsed until jumping to it."),
          tags: ["nextEditSuggestions"]
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      enabled: boolean(input.enabled, this.defaultValue.enabled),
      mode: stringSet(input.mode, this.defaultValue.mode, ["prefix", "subword", "subwordSmart"]),
      showToolbar: stringSet(input.showToolbar, this.defaultValue.showToolbar, ["always", "onHover", "never"]),
      suppressSuggestions: boolean(input.suppressSuggestions, this.defaultValue.suppressSuggestions),
      keepOnBlur: boolean(input.keepOnBlur, this.defaultValue.keepOnBlur),
      fontFamily: EditorStringOption.string(input.fontFamily, this.defaultValue.fontFamily),
      syntaxHighlightingEnabled: boolean(input.syntaxHighlightingEnabled, this.defaultValue.syntaxHighlightingEnabled),
      edits: {
        enabled: boolean(input.edits?.enabled, this.defaultValue.edits.enabled),
        showCollapsed: boolean(input.edits?.showCollapsed, this.defaultValue.edits.showCollapsed),
        allowCodeShifting: stringSet(input.edits?.allowCodeShifting, this.defaultValue.edits.allowCodeShifting, ["always", "horizontal", "never"]),
        renderSideBySide: stringSet(input.edits?.renderSideBySide, this.defaultValue.edits.renderSideBySide, ["never", "auto"]),
        useMultiLineGhostText: boolean(input.edits?.useMultiLineGhostText, this.defaultValue.edits.useMultiLineGhostText)
      }
    };
  }
}
class BracketPairColorization extends BaseEditorOption {
  constructor() {
    const defaults = {
      enabled: EDITOR_MODEL_DEFAULTS.bracketPairColorizationOptions.enabled,
      independentColorPoolPerBracketType: EDITOR_MODEL_DEFAULTS.bracketPairColorizationOptions.independentColorPoolPerBracketType
    };
    super(
      15 /* bracketPairColorization */,
      "bracketPairColorization",
      defaults,
      {
        "editor.bracketPairColorization.enabled": {
          type: "boolean",
          default: defaults.enabled,
          markdownDescription: nls.localize("bracketPairColorization.enabled", "Controls whether bracket pair colorization is enabled or not. Use {0} to override the bracket highlight colors.", "`#workbench.colorCustomizations#`")
        },
        "editor.bracketPairColorization.independentColorPoolPerBracketType": {
          type: "boolean",
          default: defaults.independentColorPoolPerBracketType,
          description: nls.localize("bracketPairColorization.independentColorPoolPerBracketType", "Controls whether each bracket type has its own independent color pool.")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      enabled: boolean(input.enabled, this.defaultValue.enabled),
      independentColorPoolPerBracketType: boolean(input.independentColorPoolPerBracketType, this.defaultValue.independentColorPoolPerBracketType)
    };
  }
}
class GuideOptions extends BaseEditorOption {
  constructor() {
    const defaults = {
      bracketPairs: false,
      bracketPairsHorizontal: "active",
      highlightActiveBracketPair: true,
      indentation: true,
      highlightActiveIndentation: true
    };
    super(
      16 /* guides */,
      "guides",
      defaults,
      {
        "editor.guides.bracketPairs": {
          type: ["boolean", "string"],
          enum: [true, "active", false],
          enumDescriptions: [
            nls.localize("editor.guides.bracketPairs.true", "Enables bracket pair guides."),
            nls.localize("editor.guides.bracketPairs.active", "Enables bracket pair guides only for the active bracket pair."),
            nls.localize("editor.guides.bracketPairs.false", "Disables bracket pair guides.")
          ],
          default: defaults.bracketPairs,
          description: nls.localize("editor.guides.bracketPairs", "Controls whether bracket pair guides are enabled or not.")
        },
        "editor.guides.bracketPairsHorizontal": {
          type: ["boolean", "string"],
          enum: [true, "active", false],
          enumDescriptions: [
            nls.localize("editor.guides.bracketPairsHorizontal.true", "Enables horizontal guides as addition to vertical bracket pair guides."),
            nls.localize("editor.guides.bracketPairsHorizontal.active", "Enables horizontal guides only for the active bracket pair."),
            nls.localize("editor.guides.bracketPairsHorizontal.false", "Disables horizontal bracket pair guides.")
          ],
          default: defaults.bracketPairsHorizontal,
          description: nls.localize("editor.guides.bracketPairsHorizontal", "Controls whether horizontal bracket pair guides are enabled or not.")
        },
        "editor.guides.highlightActiveBracketPair": {
          type: "boolean",
          default: defaults.highlightActiveBracketPair,
          description: nls.localize("editor.guides.highlightActiveBracketPair", "Controls whether the editor should highlight the active bracket pair.")
        },
        "editor.guides.indentation": {
          type: "boolean",
          default: defaults.indentation,
          description: nls.localize("editor.guides.indentation", "Controls whether the editor should render indent guides.")
        },
        "editor.guides.highlightActiveIndentation": {
          type: ["boolean", "string"],
          enum: [true, "always", false],
          enumDescriptions: [
            nls.localize("editor.guides.highlightActiveIndentation.true", "Highlights the active indent guide."),
            nls.localize("editor.guides.highlightActiveIndentation.always", "Highlights the active indent guide even if bracket guides are highlighted."),
            nls.localize("editor.guides.highlightActiveIndentation.false", "Do not highlight the active indent guide.")
          ],
          default: defaults.highlightActiveIndentation,
          description: nls.localize("editor.guides.highlightActiveIndentation", "Controls whether the editor should highlight the active indent guide.")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      bracketPairs: primitiveSet(input.bracketPairs, this.defaultValue.bracketPairs, [true, false, "active"]),
      bracketPairsHorizontal: primitiveSet(input.bracketPairsHorizontal, this.defaultValue.bracketPairsHorizontal, [true, false, "active"]),
      highlightActiveBracketPair: boolean(input.highlightActiveBracketPair, this.defaultValue.highlightActiveBracketPair),
      indentation: boolean(input.indentation, this.defaultValue.indentation),
      highlightActiveIndentation: primitiveSet(input.highlightActiveIndentation, this.defaultValue.highlightActiveIndentation, [true, false, "always"])
    };
  }
}
function primitiveSet(value, defaultValue, allowedValues) {
  const idx = allowedValues.indexOf(value);
  if (idx === -1) {
    return defaultValue;
  }
  return allowedValues[idx];
}
class EditorSuggest extends BaseEditorOption {
  constructor() {
    const defaults = {
      insertMode: "insert",
      filterGraceful: true,
      snippetsPreventQuickSuggestions: false,
      localityBonus: false,
      shareSuggestSelections: false,
      selectionMode: "always",
      showIcons: true,
      showStatusBar: false,
      preview: false,
      previewMode: "subwordSmart",
      showInlineDetails: true,
      showMethods: true,
      showFunctions: true,
      showConstructors: true,
      showDeprecated: true,
      matchOnWordStartOnly: true,
      showFields: true,
      showVariables: true,
      showClasses: true,
      showStructs: true,
      showInterfaces: true,
      showModules: true,
      showProperties: true,
      showEvents: true,
      showOperators: true,
      showUnits: true,
      showValues: true,
      showConstants: true,
      showEnums: true,
      showEnumMembers: true,
      showKeywords: true,
      showWords: true,
      showColors: true,
      showFiles: true,
      showReferences: true,
      showFolders: true,
      showTypeParameters: true,
      showSnippets: true,
      showUsers: true,
      showIssues: true
    };
    super(
      123 /* suggest */,
      "suggest",
      defaults,
      {
        "editor.suggest.insertMode": {
          type: "string",
          enum: ["insert", "replace"],
          enumDescriptions: [
            nls.localize("suggest.insertMode.insert", "Insert suggestion without overwriting text right of the cursor."),
            nls.localize("suggest.insertMode.replace", "Insert suggestion and overwrite text right of the cursor.")
          ],
          default: defaults.insertMode,
          description: nls.localize("suggest.insertMode", "Controls whether words are overwritten when accepting completions. Note that this depends on extensions opting into this feature.")
        },
        "editor.suggest.filterGraceful": {
          type: "boolean",
          default: defaults.filterGraceful,
          description: nls.localize("suggest.filterGraceful", "Controls whether filtering and sorting suggestions accounts for small typos.")
        },
        "editor.suggest.localityBonus": {
          type: "boolean",
          default: defaults.localityBonus,
          description: nls.localize("suggest.localityBonus", "Controls whether sorting favors words that appear close to the cursor.")
        },
        "editor.suggest.shareSuggestSelections": {
          type: "boolean",
          default: defaults.shareSuggestSelections,
          markdownDescription: nls.localize("suggest.shareSuggestSelections", "Controls whether remembered suggestion selections are shared between multiple workspaces and windows (needs `#editor.suggestSelection#`).")
        },
        "editor.suggest.selectionMode": {
          type: "string",
          enum: ["always", "never", "whenTriggerCharacter", "whenQuickSuggestion"],
          enumDescriptions: [
            nls.localize("suggest.insertMode.always", "Always select a suggestion when automatically triggering IntelliSense."),
            nls.localize("suggest.insertMode.never", "Never select a suggestion when automatically triggering IntelliSense."),
            nls.localize("suggest.insertMode.whenTriggerCharacter", "Select a suggestion only when triggering IntelliSense from a trigger character."),
            nls.localize("suggest.insertMode.whenQuickSuggestion", "Select a suggestion only when triggering IntelliSense as you type.")
          ],
          default: defaults.selectionMode,
          markdownDescription: nls.localize("suggest.selectionMode", "Controls whether a suggestion is selected when the widget shows. Note that this only applies to automatically triggered suggestions ({0} and {1}) and that a suggestion is always selected when explicitly invoked, e.g via `Ctrl+Space`.", "`#editor.quickSuggestions#`", "`#editor.suggestOnTriggerCharacters#`")
        },
        "editor.suggest.snippetsPreventQuickSuggestions": {
          type: "boolean",
          default: defaults.snippetsPreventQuickSuggestions,
          description: nls.localize("suggest.snippetsPreventQuickSuggestions", "Controls whether an active snippet prevents quick suggestions.")
        },
        "editor.suggest.showIcons": {
          type: "boolean",
          default: defaults.showIcons,
          description: nls.localize("suggest.showIcons", "Controls whether to show or hide icons in suggestions.")
        },
        "editor.suggest.showStatusBar": {
          type: "boolean",
          default: defaults.showStatusBar,
          description: nls.localize("suggest.showStatusBar", "Controls the visibility of the status bar at the bottom of the suggest widget.")
        },
        "editor.suggest.preview": {
          type: "boolean",
          default: defaults.preview,
          description: nls.localize("suggest.preview", "Controls whether to preview the suggestion outcome in the editor.")
        },
        "editor.suggest.showInlineDetails": {
          type: "boolean",
          default: defaults.showInlineDetails,
          description: nls.localize("suggest.showInlineDetails", "Controls whether suggest details show inline with the label or only in the details widget.")
        },
        "editor.suggest.maxVisibleSuggestions": {
          type: "number",
          deprecationMessage: nls.localize("suggest.maxVisibleSuggestions.dep", "This setting is deprecated. The suggest widget can now be resized.")
        },
        "editor.suggest.filteredTypes": {
          type: "object",
          deprecationMessage: nls.localize("deprecated", "This setting is deprecated, please use separate settings like 'editor.suggest.showKeywords' or 'editor.suggest.showSnippets' instead.")
        },
        "editor.suggest.showMethods": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showMethods", "When enabled IntelliSense shows `method`-suggestions.")
        },
        "editor.suggest.showFunctions": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showFunctions", "When enabled IntelliSense shows `function`-suggestions.")
        },
        "editor.suggest.showConstructors": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showConstructors", "When enabled IntelliSense shows `constructor`-suggestions.")
        },
        "editor.suggest.showDeprecated": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showDeprecated", "When enabled IntelliSense shows `deprecated`-suggestions.")
        },
        "editor.suggest.matchOnWordStartOnly": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.matchOnWordStartOnly", "When enabled IntelliSense filtering requires that the first character matches on a word start. For example, `c` on `Console` or `WebContext` but _not_ on `description`. When disabled IntelliSense will show more results but still sorts them by match quality.")
        },
        "editor.suggest.showFields": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showFields", "When enabled IntelliSense shows `field`-suggestions.")
        },
        "editor.suggest.showVariables": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showVariables", "When enabled IntelliSense shows `variable`-suggestions.")
        },
        "editor.suggest.showClasses": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showClasss", "When enabled IntelliSense shows `class`-suggestions.")
        },
        "editor.suggest.showStructs": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showStructs", "When enabled IntelliSense shows `struct`-suggestions.")
        },
        "editor.suggest.showInterfaces": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showInterfaces", "When enabled IntelliSense shows `interface`-suggestions.")
        },
        "editor.suggest.showModules": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showModules", "When enabled IntelliSense shows `module`-suggestions.")
        },
        "editor.suggest.showProperties": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showPropertys", "When enabled IntelliSense shows `property`-suggestions.")
        },
        "editor.suggest.showEvents": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showEvents", "When enabled IntelliSense shows `event`-suggestions.")
        },
        "editor.suggest.showOperators": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showOperators", "When enabled IntelliSense shows `operator`-suggestions.")
        },
        "editor.suggest.showUnits": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showUnits", "When enabled IntelliSense shows `unit`-suggestions.")
        },
        "editor.suggest.showValues": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showValues", "When enabled IntelliSense shows `value`-suggestions.")
        },
        "editor.suggest.showConstants": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showConstants", "When enabled IntelliSense shows `constant`-suggestions.")
        },
        "editor.suggest.showEnums": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showEnums", "When enabled IntelliSense shows `enum`-suggestions.")
        },
        "editor.suggest.showEnumMembers": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showEnumMembers", "When enabled IntelliSense shows `enumMember`-suggestions.")
        },
        "editor.suggest.showKeywords": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showKeywords", "When enabled IntelliSense shows `keyword`-suggestions.")
        },
        "editor.suggest.showWords": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showTexts", "When enabled IntelliSense shows `text`-suggestions.")
        },
        "editor.suggest.showColors": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showColors", "When enabled IntelliSense shows `color`-suggestions.")
        },
        "editor.suggest.showFiles": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showFiles", "When enabled IntelliSense shows `file`-suggestions.")
        },
        "editor.suggest.showReferences": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showReferences", "When enabled IntelliSense shows `reference`-suggestions.")
        },
        "editor.suggest.showCustomcolors": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showCustomcolors", "When enabled IntelliSense shows `customcolor`-suggestions.")
        },
        "editor.suggest.showFolders": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showFolders", "When enabled IntelliSense shows `folder`-suggestions.")
        },
        "editor.suggest.showTypeParameters": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showTypeParameters", "When enabled IntelliSense shows `typeParameter`-suggestions.")
        },
        "editor.suggest.showSnippets": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showSnippets", "When enabled IntelliSense shows `snippet`-suggestions.")
        },
        "editor.suggest.showUsers": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showUsers", "When enabled IntelliSense shows `user`-suggestions.")
        },
        "editor.suggest.showIssues": {
          type: "boolean",
          default: true,
          markdownDescription: nls.localize("editor.suggest.showIssues", "When enabled IntelliSense shows `issues`-suggestions.")
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      insertMode: stringSet(input.insertMode, this.defaultValue.insertMode, ["insert", "replace"]),
      filterGraceful: boolean(input.filterGraceful, this.defaultValue.filterGraceful),
      snippetsPreventQuickSuggestions: boolean(input.snippetsPreventQuickSuggestions, this.defaultValue.filterGraceful),
      localityBonus: boolean(input.localityBonus, this.defaultValue.localityBonus),
      shareSuggestSelections: boolean(input.shareSuggestSelections, this.defaultValue.shareSuggestSelections),
      selectionMode: stringSet(input.selectionMode, this.defaultValue.selectionMode, ["always", "never", "whenQuickSuggestion", "whenTriggerCharacter"]),
      showIcons: boolean(input.showIcons, this.defaultValue.showIcons),
      showStatusBar: boolean(input.showStatusBar, this.defaultValue.showStatusBar),
      preview: boolean(input.preview, this.defaultValue.preview),
      previewMode: stringSet(input.previewMode, this.defaultValue.previewMode, ["prefix", "subword", "subwordSmart"]),
      showInlineDetails: boolean(input.showInlineDetails, this.defaultValue.showInlineDetails),
      showMethods: boolean(input.showMethods, this.defaultValue.showMethods),
      showFunctions: boolean(input.showFunctions, this.defaultValue.showFunctions),
      showConstructors: boolean(input.showConstructors, this.defaultValue.showConstructors),
      showDeprecated: boolean(input.showDeprecated, this.defaultValue.showDeprecated),
      matchOnWordStartOnly: boolean(input.matchOnWordStartOnly, this.defaultValue.matchOnWordStartOnly),
      showFields: boolean(input.showFields, this.defaultValue.showFields),
      showVariables: boolean(input.showVariables, this.defaultValue.showVariables),
      showClasses: boolean(input.showClasses, this.defaultValue.showClasses),
      showStructs: boolean(input.showStructs, this.defaultValue.showStructs),
      showInterfaces: boolean(input.showInterfaces, this.defaultValue.showInterfaces),
      showModules: boolean(input.showModules, this.defaultValue.showModules),
      showProperties: boolean(input.showProperties, this.defaultValue.showProperties),
      showEvents: boolean(input.showEvents, this.defaultValue.showEvents),
      showOperators: boolean(input.showOperators, this.defaultValue.showOperators),
      showUnits: boolean(input.showUnits, this.defaultValue.showUnits),
      showValues: boolean(input.showValues, this.defaultValue.showValues),
      showConstants: boolean(input.showConstants, this.defaultValue.showConstants),
      showEnums: boolean(input.showEnums, this.defaultValue.showEnums),
      showEnumMembers: boolean(input.showEnumMembers, this.defaultValue.showEnumMembers),
      showKeywords: boolean(input.showKeywords, this.defaultValue.showKeywords),
      showWords: boolean(input.showWords, this.defaultValue.showWords),
      showColors: boolean(input.showColors, this.defaultValue.showColors),
      showFiles: boolean(input.showFiles, this.defaultValue.showFiles),
      showReferences: boolean(input.showReferences, this.defaultValue.showReferences),
      showFolders: boolean(input.showFolders, this.defaultValue.showFolders),
      showTypeParameters: boolean(input.showTypeParameters, this.defaultValue.showTypeParameters),
      showSnippets: boolean(input.showSnippets, this.defaultValue.showSnippets),
      showUsers: boolean(input.showUsers, this.defaultValue.showUsers),
      showIssues: boolean(input.showIssues, this.defaultValue.showIssues)
    };
  }
}
class SmartSelect extends BaseEditorOption {
  constructor() {
    super(
      118 /* smartSelect */,
      "smartSelect",
      {
        selectLeadingAndTrailingWhitespace: true,
        selectSubwords: true
      },
      {
        "editor.smartSelect.selectLeadingAndTrailingWhitespace": {
          description: nls.localize("selectLeadingAndTrailingWhitespace", "Whether leading and trailing whitespace should always be selected."),
          default: true,
          type: "boolean"
        },
        "editor.smartSelect.selectSubwords": {
          description: nls.localize("selectSubwords", "Whether subwords (like 'foo' in 'fooBar' or 'foo_bar') should be selected."),
          default: true,
          type: "boolean"
        }
      }
    );
  }
  validate(input) {
    if (!input || typeof input !== "object") {
      return this.defaultValue;
    }
    return {
      selectLeadingAndTrailingWhitespace: boolean(input.selectLeadingAndTrailingWhitespace, this.defaultValue.selectLeadingAndTrailingWhitespace),
      selectSubwords: boolean(input.selectSubwords, this.defaultValue.selectSubwords)
    };
  }
}
class WordSegmenterLocales extends BaseEditorOption {
  constructor() {
    const defaults = [];
    super(
      135 /* wordSegmenterLocales */,
      "wordSegmenterLocales",
      defaults,
      {
        anyOf: [
          {
            description: nls.localize("wordSegmenterLocales", "Locales to be used for word segmentation when doing word related navigations or operations. Specify the BCP 47 language tag of the word you wish to recognize (e.g., ja, zh-CN, zh-Hant-TW, etc.)."),
            type: "string"
          },
          {
            description: nls.localize("wordSegmenterLocales", "Locales to be used for word segmentation when doing word related navigations or operations. Specify the BCP 47 language tag of the word you wish to recognize (e.g., ja, zh-CN, zh-Hant-TW, etc.)."),
            type: "array",
            items: {
              type: "string"
            }
          }
        ]
      }
    );
  }
  validate(input) {
    if (typeof input === "string") {
      input = [input];
    }
    if (Array.isArray(input)) {
      const validLocales = [];
      for (const locale of input) {
        if (typeof locale === "string") {
          try {
            if (Intl.Segmenter.supportedLocalesOf(locale).length > 0) {
              validLocales.push(locale);
            }
          } catch {
          }
        }
      }
      return validLocales;
    }
    return this.defaultValue;
  }
}
var WrappingIndent = /* @__PURE__ */ ((WrappingIndent2) => {
  WrappingIndent2[WrappingIndent2["None"] = 0] = "None";
  WrappingIndent2[WrappingIndent2["Same"] = 1] = "Same";
  WrappingIndent2[WrappingIndent2["Indent"] = 2] = "Indent";
  WrappingIndent2[WrappingIndent2["DeepIndent"] = 3] = "DeepIndent";
  return WrappingIndent2;
})(WrappingIndent || {});
class WrappingIndentOption extends BaseEditorOption {
  constructor() {
    super(
      143 /* wrappingIndent */,
      "wrappingIndent",
      1 /* Same */,
      {
        "editor.wrappingIndent": {
          type: "string",
          enum: ["none", "same", "indent", "deepIndent"],
          enumDescriptions: [
            nls.localize("wrappingIndent.none", "No indentation. Wrapped lines begin at column 1."),
            nls.localize("wrappingIndent.same", "Wrapped lines get the same indentation as the parent."),
            nls.localize("wrappingIndent.indent", "Wrapped lines get +1 indentation toward the parent."),
            nls.localize("wrappingIndent.deepIndent", "Wrapped lines get +2 indentation toward the parent.")
          ],
          description: nls.localize("wrappingIndent", "Controls the indentation of wrapped lines."),
          default: "same"
        }
      }
    );
  }
  validate(input) {
    switch (input) {
      case "none":
        return 0 /* None */;
      case "same":
        return 1 /* Same */;
      case "indent":
        return 2 /* Indent */;
      case "deepIndent":
        return 3 /* DeepIndent */;
    }
    return 1 /* Same */;
  }
  compute(env, options, value) {
    const accessibilitySupport = options.get(2 /* accessibilitySupport */);
    if (accessibilitySupport === AccessibilitySupport.Enabled) {
      return 0 /* None */;
    }
    return value;
  }
}
class EditorWrappingInfoComputer extends ComputedEditorOption {
  constructor() {
    super(152 /* wrappingInfo */);
  }
  compute(env, options, _) {
    const layoutInfo = options.get(151 /* layoutInfo */);
    return {
      isDominatedByLongLines: env.isDominatedByLongLines,
      isWordWrapMinified: layoutInfo.isWordWrapMinified,
      isViewportWrapping: layoutInfo.isViewportWrapping,
      wrappingColumn: layoutInfo.wrappingColumn
    };
  }
}
class EditorDropIntoEditor extends BaseEditorOption {
  constructor() {
    const defaults = { enabled: true, showDropSelector: "afterDrop" };
    super(
      36 /* dropIntoEditor */,
      "dropIntoEditor",
      defaults,
      {
        "editor.dropIntoEditor.enabled": {
          type: "boolean",
          default: defaults.enabled,
          markdownDescription: nls.localize("dropIntoEditor.enabled", "Controls whether you can drag and drop a file into a text editor by holding down the `Shift` key (instead of opening the file in an editor).")
        },
        "editor.dropIntoEditor.showDropSelector": {
          type: "string",
          markdownDescription: nls.localize("dropIntoEditor.showDropSelector", "Controls if a widget is shown when dropping files into the editor. This widget lets you control how the file is dropped."),
          enum: [
            "afterDrop",
            "never"
          ],
          enumDescriptions: [
            nls.localize("dropIntoEditor.showDropSelector.afterDrop", "Show the drop selector widget after a file is dropped into the editor."),
            nls.localize("dropIntoEditor.showDropSelector.never", "Never show the drop selector widget. Instead the default drop provider is always used.")
          ],
          default: "afterDrop"
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      enabled: boolean(input.enabled, this.defaultValue.enabled),
      showDropSelector: stringSet(input.showDropSelector, this.defaultValue.showDropSelector, ["afterDrop", "never"])
    };
  }
}
class EditorPasteAs extends BaseEditorOption {
  constructor() {
    const defaults = { enabled: true, showPasteSelector: "afterPaste" };
    super(
      89 /* pasteAs */,
      "pasteAs",
      defaults,
      {
        "editor.pasteAs.enabled": {
          type: "boolean",
          default: defaults.enabled,
          markdownDescription: nls.localize("pasteAs.enabled", "Controls whether you can paste content in different ways.")
        },
        "editor.pasteAs.showPasteSelector": {
          type: "string",
          markdownDescription: nls.localize("pasteAs.showPasteSelector", "Controls if a widget is shown when pasting content in to the editor. This widget lets you control how the file is pasted."),
          enum: [
            "afterPaste",
            "never"
          ],
          enumDescriptions: [
            nls.localize("pasteAs.showPasteSelector.afterPaste", "Show the paste selector widget after content is pasted into the editor."),
            nls.localize("pasteAs.showPasteSelector.never", "Never show the paste selector widget. Instead the default pasting behavior is always used.")
          ],
          default: "afterPaste"
        }
      }
    );
  }
  validate(_input) {
    if (!_input || typeof _input !== "object") {
      return this.defaultValue;
    }
    const input = _input;
    return {
      enabled: boolean(input.enabled, this.defaultValue.enabled),
      showPasteSelector: stringSet(input.showPasteSelector, this.defaultValue.showPasteSelector, ["afterPaste", "never"])
    };
  }
}
const DEFAULT_WINDOWS_FONT_FAMILY = "Consolas, 'Courier New', monospace";
const DEFAULT_MAC_FONT_FAMILY = "Menlo, Monaco, 'Courier New', monospace";
const DEFAULT_LINUX_FONT_FAMILY = "'Droid Sans Mono', 'monospace', monospace";
const EDITOR_FONT_DEFAULTS = {
  fontFamily: platform.isMacintosh ? DEFAULT_MAC_FONT_FAMILY : platform.isLinux ? DEFAULT_LINUX_FONT_FAMILY : DEFAULT_WINDOWS_FONT_FAMILY,
  fontWeight: "normal",
  fontSize: platform.isMacintosh ? 12 : 14,
  lineHeight: 0,
  letterSpacing: 0
};
const editorOptionsRegistry = [];
function register(option) {
  editorOptionsRegistry[option.id] = option;
  return option;
}
var EditorOption = /* @__PURE__ */ ((EditorOption2) => {
  EditorOption2[EditorOption2["acceptSuggestionOnCommitCharacter"] = 0] = "acceptSuggestionOnCommitCharacter";
  EditorOption2[EditorOption2["acceptSuggestionOnEnter"] = 1] = "acceptSuggestionOnEnter";
  EditorOption2[EditorOption2["accessibilitySupport"] = 2] = "accessibilitySupport";
  EditorOption2[EditorOption2["accessibilityPageSize"] = 3] = "accessibilityPageSize";
  EditorOption2[EditorOption2["ariaLabel"] = 4] = "ariaLabel";
  EditorOption2[EditorOption2["ariaRequired"] = 5] = "ariaRequired";
  EditorOption2[EditorOption2["autoClosingBrackets"] = 6] = "autoClosingBrackets";
  EditorOption2[EditorOption2["autoClosingComments"] = 7] = "autoClosingComments";
  EditorOption2[EditorOption2["screenReaderAnnounceInlineSuggestion"] = 8] = "screenReaderAnnounceInlineSuggestion";
  EditorOption2[EditorOption2["autoClosingDelete"] = 9] = "autoClosingDelete";
  EditorOption2[EditorOption2["autoClosingOvertype"] = 10] = "autoClosingOvertype";
  EditorOption2[EditorOption2["autoClosingQuotes"] = 11] = "autoClosingQuotes";
  EditorOption2[EditorOption2["autoIndent"] = 12] = "autoIndent";
  EditorOption2[EditorOption2["automaticLayout"] = 13] = "automaticLayout";
  EditorOption2[EditorOption2["autoSurround"] = 14] = "autoSurround";
  EditorOption2[EditorOption2["bracketPairColorization"] = 15] = "bracketPairColorization";
  EditorOption2[EditorOption2["guides"] = 16] = "guides";
  EditorOption2[EditorOption2["codeLens"] = 17] = "codeLens";
  EditorOption2[EditorOption2["codeLensFontFamily"] = 18] = "codeLensFontFamily";
  EditorOption2[EditorOption2["codeLensFontSize"] = 19] = "codeLensFontSize";
  EditorOption2[EditorOption2["colorDecorators"] = 20] = "colorDecorators";
  EditorOption2[EditorOption2["colorDecoratorsLimit"] = 21] = "colorDecoratorsLimit";
  EditorOption2[EditorOption2["columnSelection"] = 22] = "columnSelection";
  EditorOption2[EditorOption2["comments"] = 23] = "comments";
  EditorOption2[EditorOption2["contextmenu"] = 24] = "contextmenu";
  EditorOption2[EditorOption2["copyWithSyntaxHighlighting"] = 25] = "copyWithSyntaxHighlighting";
  EditorOption2[EditorOption2["cursorBlinking"] = 26] = "cursorBlinking";
  EditorOption2[EditorOption2["cursorSmoothCaretAnimation"] = 27] = "cursorSmoothCaretAnimation";
  EditorOption2[EditorOption2["cursorStyle"] = 28] = "cursorStyle";
  EditorOption2[EditorOption2["cursorSurroundingLines"] = 29] = "cursorSurroundingLines";
  EditorOption2[EditorOption2["cursorSurroundingLinesStyle"] = 30] = "cursorSurroundingLinesStyle";
  EditorOption2[EditorOption2["cursorWidth"] = 31] = "cursorWidth";
  EditorOption2[EditorOption2["disableLayerHinting"] = 32] = "disableLayerHinting";
  EditorOption2[EditorOption2["disableMonospaceOptimizations"] = 33] = "disableMonospaceOptimizations";
  EditorOption2[EditorOption2["domReadOnly"] = 34] = "domReadOnly";
  EditorOption2[EditorOption2["dragAndDrop"] = 35] = "dragAndDrop";
  EditorOption2[EditorOption2["dropIntoEditor"] = 36] = "dropIntoEditor";
  EditorOption2[EditorOption2["experimentalEditContextEnabled"] = 37] = "experimentalEditContextEnabled";
  EditorOption2[EditorOption2["emptySelectionClipboard"] = 38] = "emptySelectionClipboard";
  EditorOption2[EditorOption2["experimentalGpuAcceleration"] = 39] = "experimentalGpuAcceleration";
  EditorOption2[EditorOption2["experimentalWhitespaceRendering"] = 40] = "experimentalWhitespaceRendering";
  EditorOption2[EditorOption2["extraEditorClassName"] = 41] = "extraEditorClassName";
  EditorOption2[EditorOption2["fastScrollSensitivity"] = 42] = "fastScrollSensitivity";
  EditorOption2[EditorOption2["find"] = 43] = "find";
  EditorOption2[EditorOption2["fixedOverflowWidgets"] = 44] = "fixedOverflowWidgets";
  EditorOption2[EditorOption2["folding"] = 45] = "folding";
  EditorOption2[EditorOption2["foldingStrategy"] = 46] = "foldingStrategy";
  EditorOption2[EditorOption2["foldingHighlight"] = 47] = "foldingHighlight";
  EditorOption2[EditorOption2["foldingImportsByDefault"] = 48] = "foldingImportsByDefault";
  EditorOption2[EditorOption2["foldingMaximumRegions"] = 49] = "foldingMaximumRegions";
  EditorOption2[EditorOption2["unfoldOnClickAfterEndOfLine"] = 50] = "unfoldOnClickAfterEndOfLine";
  EditorOption2[EditorOption2["fontFamily"] = 51] = "fontFamily";
  EditorOption2[EditorOption2["fontInfo"] = 52] = "fontInfo";
  EditorOption2[EditorOption2["fontLigatures"] = 53] = "fontLigatures";
  EditorOption2[EditorOption2["fontSize"] = 54] = "fontSize";
  EditorOption2[EditorOption2["fontWeight"] = 55] = "fontWeight";
  EditorOption2[EditorOption2["fontVariations"] = 56] = "fontVariations";
  EditorOption2[EditorOption2["formatOnPaste"] = 57] = "formatOnPaste";
  EditorOption2[EditorOption2["formatOnType"] = 58] = "formatOnType";
  EditorOption2[EditorOption2["glyphMargin"] = 59] = "glyphMargin";
  EditorOption2[EditorOption2["gotoLocation"] = 60] = "gotoLocation";
  EditorOption2[EditorOption2["hideCursorInOverviewRuler"] = 61] = "hideCursorInOverviewRuler";
  EditorOption2[EditorOption2["hover"] = 62] = "hover";
  EditorOption2[EditorOption2["inDiffEditor"] = 63] = "inDiffEditor";
  EditorOption2[EditorOption2["inlineSuggest"] = 64] = "inlineSuggest";
  EditorOption2[EditorOption2["letterSpacing"] = 65] = "letterSpacing";
  EditorOption2[EditorOption2["lightbulb"] = 66] = "lightbulb";
  EditorOption2[EditorOption2["lineDecorationsWidth"] = 67] = "lineDecorationsWidth";
  EditorOption2[EditorOption2["lineHeight"] = 68] = "lineHeight";
  EditorOption2[EditorOption2["lineNumbers"] = 69] = "lineNumbers";
  EditorOption2[EditorOption2["lineNumbersMinChars"] = 70] = "lineNumbersMinChars";
  EditorOption2[EditorOption2["linkedEditing"] = 71] = "linkedEditing";
  EditorOption2[EditorOption2["links"] = 72] = "links";
  EditorOption2[EditorOption2["matchBrackets"] = 73] = "matchBrackets";
  EditorOption2[EditorOption2["minimap"] = 74] = "minimap";
  EditorOption2[EditorOption2["mouseStyle"] = 75] = "mouseStyle";
  EditorOption2[EditorOption2["mouseWheelScrollSensitivity"] = 76] = "mouseWheelScrollSensitivity";
  EditorOption2[EditorOption2["mouseWheelZoom"] = 77] = "mouseWheelZoom";
  EditorOption2[EditorOption2["multiCursorMergeOverlapping"] = 78] = "multiCursorMergeOverlapping";
  EditorOption2[EditorOption2["multiCursorModifier"] = 79] = "multiCursorModifier";
  EditorOption2[EditorOption2["multiCursorPaste"] = 80] = "multiCursorPaste";
  EditorOption2[EditorOption2["multiCursorLimit"] = 81] = "multiCursorLimit";
  EditorOption2[EditorOption2["occurrencesHighlight"] = 82] = "occurrencesHighlight";
  EditorOption2[EditorOption2["occurrencesHighlightDelay"] = 83] = "occurrencesHighlightDelay";
  EditorOption2[EditorOption2["overtypeCursorStyle"] = 84] = "overtypeCursorStyle";
  EditorOption2[EditorOption2["overtypeOnPaste"] = 85] = "overtypeOnPaste";
  EditorOption2[EditorOption2["overviewRulerBorder"] = 86] = "overviewRulerBorder";
  EditorOption2[EditorOption2["overviewRulerLanes"] = 87] = "overviewRulerLanes";
  EditorOption2[EditorOption2["padding"] = 88] = "padding";
  EditorOption2[EditorOption2["pasteAs"] = 89] = "pasteAs";
  EditorOption2[EditorOption2["parameterHints"] = 90] = "parameterHints";
  EditorOption2[EditorOption2["peekWidgetDefaultFocus"] = 91] = "peekWidgetDefaultFocus";
  EditorOption2[EditorOption2["placeholder"] = 92] = "placeholder";
  EditorOption2[EditorOption2["definitionLinkOpensInPeek"] = 93] = "definitionLinkOpensInPeek";
  EditorOption2[EditorOption2["quickSuggestions"] = 94] = "quickSuggestions";
  EditorOption2[EditorOption2["quickSuggestionsDelay"] = 95] = "quickSuggestionsDelay";
  EditorOption2[EditorOption2["readOnly"] = 96] = "readOnly";
  EditorOption2[EditorOption2["readOnlyMessage"] = 97] = "readOnlyMessage";
  EditorOption2[EditorOption2["renameOnType"] = 98] = "renameOnType";
  EditorOption2[EditorOption2["renderControlCharacters"] = 99] = "renderControlCharacters";
  EditorOption2[EditorOption2["renderFinalNewline"] = 100] = "renderFinalNewline";
  EditorOption2[EditorOption2["renderLineHighlight"] = 101] = "renderLineHighlight";
  EditorOption2[EditorOption2["renderLineHighlightOnlyWhenFocus"] = 102] = "renderLineHighlightOnlyWhenFocus";
  EditorOption2[EditorOption2["renderValidationDecorations"] = 103] = "renderValidationDecorations";
  EditorOption2[EditorOption2["renderWhitespace"] = 104] = "renderWhitespace";
  EditorOption2[EditorOption2["revealHorizontalRightPadding"] = 105] = "revealHorizontalRightPadding";
  EditorOption2[EditorOption2["roundedSelection"] = 106] = "roundedSelection";
  EditorOption2[EditorOption2["rulers"] = 107] = "rulers";
  EditorOption2[EditorOption2["scrollbar"] = 108] = "scrollbar";
  EditorOption2[EditorOption2["scrollBeyondLastColumn"] = 109] = "scrollBeyondLastColumn";
  EditorOption2[EditorOption2["scrollBeyondLastLine"] = 110] = "scrollBeyondLastLine";
  EditorOption2[EditorOption2["scrollPredominantAxis"] = 111] = "scrollPredominantAxis";
  EditorOption2[EditorOption2["selectionClipboard"] = 112] = "selectionClipboard";
  EditorOption2[EditorOption2["selectionHighlight"] = 113] = "selectionHighlight";
  EditorOption2[EditorOption2["selectOnLineNumbers"] = 114] = "selectOnLineNumbers";
  EditorOption2[EditorOption2["showFoldingControls"] = 115] = "showFoldingControls";
  EditorOption2[EditorOption2["showUnused"] = 116] = "showUnused";
  EditorOption2[EditorOption2["snippetSuggestions"] = 117] = "snippetSuggestions";
  EditorOption2[EditorOption2["smartSelect"] = 118] = "smartSelect";
  EditorOption2[EditorOption2["smoothScrolling"] = 119] = "smoothScrolling";
  EditorOption2[EditorOption2["stickyScroll"] = 120] = "stickyScroll";
  EditorOption2[EditorOption2["stickyTabStops"] = 121] = "stickyTabStops";
  EditorOption2[EditorOption2["stopRenderingLineAfter"] = 122] = "stopRenderingLineAfter";
  EditorOption2[EditorOption2["suggest"] = 123] = "suggest";
  EditorOption2[EditorOption2["suggestFontSize"] = 124] = "suggestFontSize";
  EditorOption2[EditorOption2["suggestLineHeight"] = 125] = "suggestLineHeight";
  EditorOption2[EditorOption2["suggestOnTriggerCharacters"] = 126] = "suggestOnTriggerCharacters";
  EditorOption2[EditorOption2["suggestSelection"] = 127] = "suggestSelection";
  EditorOption2[EditorOption2["tabCompletion"] = 128] = "tabCompletion";
  EditorOption2[EditorOption2["tabIndex"] = 129] = "tabIndex";
  EditorOption2[EditorOption2["unicodeHighlighting"] = 130] = "unicodeHighlighting";
  EditorOption2[EditorOption2["unusualLineTerminators"] = 131] = "unusualLineTerminators";
  EditorOption2[EditorOption2["useShadowDOM"] = 132] = "useShadowDOM";
  EditorOption2[EditorOption2["useTabStops"] = 133] = "useTabStops";
  EditorOption2[EditorOption2["wordBreak"] = 134] = "wordBreak";
  EditorOption2[EditorOption2["wordSegmenterLocales"] = 135] = "wordSegmenterLocales";
  EditorOption2[EditorOption2["wordSeparators"] = 136] = "wordSeparators";
  EditorOption2[EditorOption2["wordWrap"] = 137] = "wordWrap";
  EditorOption2[EditorOption2["wordWrapBreakAfterCharacters"] = 138] = "wordWrapBreakAfterCharacters";
  EditorOption2[EditorOption2["wordWrapBreakBeforeCharacters"] = 139] = "wordWrapBreakBeforeCharacters";
  EditorOption2[EditorOption2["wordWrapColumn"] = 140] = "wordWrapColumn";
  EditorOption2[EditorOption2["wordWrapOverride1"] = 141] = "wordWrapOverride1";
  EditorOption2[EditorOption2["wordWrapOverride2"] = 142] = "wordWrapOverride2";
  EditorOption2[EditorOption2["wrappingIndent"] = 143] = "wrappingIndent";
  EditorOption2[EditorOption2["wrappingStrategy"] = 144] = "wrappingStrategy";
  EditorOption2[EditorOption2["showDeprecated"] = 145] = "showDeprecated";
  EditorOption2[EditorOption2["inlayHints"] = 146] = "inlayHints";
  EditorOption2[EditorOption2["effectiveCursorStyle"] = 147] = "effectiveCursorStyle";
  EditorOption2[EditorOption2["editorClassName"] = 148] = "editorClassName";
  EditorOption2[EditorOption2["pixelRatio"] = 149] = "pixelRatio";
  EditorOption2[EditorOption2["tabFocusMode"] = 150] = "tabFocusMode";
  EditorOption2[EditorOption2["layoutInfo"] = 151] = "layoutInfo";
  EditorOption2[EditorOption2["wrappingInfo"] = 152] = "wrappingInfo";
  EditorOption2[EditorOption2["defaultColorDecorators"] = 153] = "defaultColorDecorators";
  EditorOption2[EditorOption2["colorDecoratorsActivatedOn"] = 154] = "colorDecoratorsActivatedOn";
  EditorOption2[EditorOption2["inlineCompletionsAccessibilityVerbose"] = 155] = "inlineCompletionsAccessibilityVerbose";
  EditorOption2[EditorOption2["effectiveExperimentalEditContextEnabled"] = 156] = "effectiveExperimentalEditContextEnabled";
  return EditorOption2;
})(EditorOption || {});
const EditorOptions = {
  acceptSuggestionOnCommitCharacter: register(new EditorBooleanOption(
    0 /* acceptSuggestionOnCommitCharacter */,
    "acceptSuggestionOnCommitCharacter",
    true,
    { markdownDescription: nls.localize("acceptSuggestionOnCommitCharacter", "Controls whether suggestions should be accepted on commit characters. For example, in JavaScript, the semi-colon (`;`) can be a commit character that accepts a suggestion and types that character.") }
  )),
  acceptSuggestionOnEnter: register(new EditorStringEnumOption(
    1 /* acceptSuggestionOnEnter */,
    "acceptSuggestionOnEnter",
    "on",
    ["on", "smart", "off"],
    {
      markdownEnumDescriptions: [
        "",
        nls.localize("acceptSuggestionOnEnterSmart", "Only accept a suggestion with `Enter` when it makes a textual change."),
        ""
      ],
      markdownDescription: nls.localize("acceptSuggestionOnEnter", "Controls whether suggestions should be accepted on `Enter`, in addition to `Tab`. Helps to avoid ambiguity between inserting new lines or accepting suggestions.")
    }
  )),
  accessibilitySupport: register(new EditorAccessibilitySupport()),
  accessibilityPageSize: register(new EditorIntOption(
    3 /* accessibilityPageSize */,
    "accessibilityPageSize",
    500,
    1,
    Constants.MAX_SAFE_SMALL_INTEGER,
    {
      description: nls.localize("accessibilityPageSize", "Controls the number of lines in the editor that can be read out by a screen reader at once. When we detect a screen reader we automatically set the default to be 500. Warning: this has a performance implication for numbers larger than the default."),
      tags: ["accessibility"]
    }
  )),
  ariaLabel: register(new EditorStringOption(
    4 /* ariaLabel */,
    "ariaLabel",
    nls.localize("editorViewAccessibleLabel", "Editor content")
  )),
  ariaRequired: register(new EditorBooleanOption(
    5 /* ariaRequired */,
    "ariaRequired",
    false,
    void 0
  )),
  screenReaderAnnounceInlineSuggestion: register(new EditorBooleanOption(
    8 /* screenReaderAnnounceInlineSuggestion */,
    "screenReaderAnnounceInlineSuggestion",
    true,
    {
      description: nls.localize("screenReaderAnnounceInlineSuggestion", "Control whether inline suggestions are announced by a screen reader."),
      tags: ["accessibility"]
    }
  )),
  autoClosingBrackets: register(new EditorStringEnumOption(
    6 /* autoClosingBrackets */,
    "autoClosingBrackets",
    "languageDefined",
    ["always", "languageDefined", "beforeWhitespace", "never"],
    {
      enumDescriptions: [
        "",
        nls.localize("editor.autoClosingBrackets.languageDefined", "Use language configurations to determine when to autoclose brackets."),
        nls.localize("editor.autoClosingBrackets.beforeWhitespace", "Autoclose brackets only when the cursor is to the left of whitespace."),
        ""
      ],
      description: nls.localize("autoClosingBrackets", "Controls whether the editor should automatically close brackets after the user adds an opening bracket.")
    }
  )),
  autoClosingComments: register(new EditorStringEnumOption(
    7 /* autoClosingComments */,
    "autoClosingComments",
    "languageDefined",
    ["always", "languageDefined", "beforeWhitespace", "never"],
    {
      enumDescriptions: [
        "",
        nls.localize("editor.autoClosingComments.languageDefined", "Use language configurations to determine when to autoclose comments."),
        nls.localize("editor.autoClosingComments.beforeWhitespace", "Autoclose comments only when the cursor is to the left of whitespace."),
        ""
      ],
      description: nls.localize("autoClosingComments", "Controls whether the editor should automatically close comments after the user adds an opening comment.")
    }
  )),
  autoClosingDelete: register(new EditorStringEnumOption(
    9 /* autoClosingDelete */,
    "autoClosingDelete",
    "auto",
    ["always", "auto", "never"],
    {
      enumDescriptions: [
        "",
        nls.localize("editor.autoClosingDelete.auto", "Remove adjacent closing quotes or brackets only if they were automatically inserted."),
        ""
      ],
      description: nls.localize("autoClosingDelete", "Controls whether the editor should remove adjacent closing quotes or brackets when deleting.")
    }
  )),
  autoClosingOvertype: register(new EditorStringEnumOption(
    10 /* autoClosingOvertype */,
    "autoClosingOvertype",
    "auto",
    ["always", "auto", "never"],
    {
      enumDescriptions: [
        "",
        nls.localize("editor.autoClosingOvertype.auto", "Type over closing quotes or brackets only if they were automatically inserted."),
        ""
      ],
      description: nls.localize("autoClosingOvertype", "Controls whether the editor should type over closing quotes or brackets.")
    }
  )),
  autoClosingQuotes: register(new EditorStringEnumOption(
    11 /* autoClosingQuotes */,
    "autoClosingQuotes",
    "languageDefined",
    ["always", "languageDefined", "beforeWhitespace", "never"],
    {
      enumDescriptions: [
        "",
        nls.localize("editor.autoClosingQuotes.languageDefined", "Use language configurations to determine when to autoclose quotes."),
        nls.localize("editor.autoClosingQuotes.beforeWhitespace", "Autoclose quotes only when the cursor is to the left of whitespace."),
        ""
      ],
      description: nls.localize("autoClosingQuotes", "Controls whether the editor should automatically close quotes after the user adds an opening quote.")
    }
  )),
  autoIndent: register(new EditorEnumOption(
    12 /* autoIndent */,
    "autoIndent",
    4 /* Full */,
    "full",
    ["none", "keep", "brackets", "advanced", "full"],
    _autoIndentFromString,
    {
      enumDescriptions: [
        nls.localize("editor.autoIndent.none", "The editor will not insert indentation automatically."),
        nls.localize("editor.autoIndent.keep", "The editor will keep the current line's indentation."),
        nls.localize("editor.autoIndent.brackets", "The editor will keep the current line's indentation and honor language defined brackets."),
        nls.localize("editor.autoIndent.advanced", "The editor will keep the current line's indentation, honor language defined brackets and invoke special onEnterRules defined by languages."),
        nls.localize("editor.autoIndent.full", "The editor will keep the current line's indentation, honor language defined brackets, invoke special onEnterRules defined by languages, and honor indentationRules defined by languages.")
      ],
      description: nls.localize("autoIndent", "Controls whether the editor should automatically adjust the indentation when users type, paste, move or indent lines.")
    }
  )),
  automaticLayout: register(new EditorBooleanOption(
    13 /* automaticLayout */,
    "automaticLayout",
    false
  )),
  autoSurround: register(new EditorStringEnumOption(
    14 /* autoSurround */,
    "autoSurround",
    "languageDefined",
    ["languageDefined", "quotes", "brackets", "never"],
    {
      enumDescriptions: [
        nls.localize("editor.autoSurround.languageDefined", "Use language configurations to determine when to automatically surround selections."),
        nls.localize("editor.autoSurround.quotes", "Surround with quotes but not brackets."),
        nls.localize("editor.autoSurround.brackets", "Surround with brackets but not quotes."),
        ""
      ],
      description: nls.localize("autoSurround", "Controls whether the editor should automatically surround selections when typing quotes or brackets.")
    }
  )),
  bracketPairColorization: register(new BracketPairColorization()),
  bracketPairGuides: register(new GuideOptions()),
  stickyTabStops: register(new EditorBooleanOption(
    121 /* stickyTabStops */,
    "stickyTabStops",
    false,
    { description: nls.localize("stickyTabStops", "Emulate selection behavior of tab characters when using spaces for indentation. Selection will stick to tab stops.") }
  )),
  codeLens: register(new EditorBooleanOption(
    17 /* codeLens */,
    "codeLens",
    true,
    { description: nls.localize("codeLens", "Controls whether the editor shows CodeLens.") }
  )),
  codeLensFontFamily: register(new EditorStringOption(
    18 /* codeLensFontFamily */,
    "codeLensFontFamily",
    "",
    { description: nls.localize("codeLensFontFamily", "Controls the font family for CodeLens.") }
  )),
  codeLensFontSize: register(new EditorIntOption(19 /* codeLensFontSize */, "codeLensFontSize", 0, 0, 100, {
    type: "number",
    default: 0,
    minimum: 0,
    maximum: 100,
    markdownDescription: nls.localize("codeLensFontSize", "Controls the font size in pixels for CodeLens. When set to 0, 90% of `#editor.fontSize#` is used.")
  })),
  colorDecorators: register(new EditorBooleanOption(
    20 /* colorDecorators */,
    "colorDecorators",
    true,
    { description: nls.localize("colorDecorators", "Controls whether the editor should render the inline color decorators and color picker.") }
  )),
  colorDecoratorActivatedOn: register(new EditorStringEnumOption(154 /* colorDecoratorsActivatedOn */, "colorDecoratorsActivatedOn", "clickAndHover", ["clickAndHover", "hover", "click"], {
    enumDescriptions: [
      nls.localize("editor.colorDecoratorActivatedOn.clickAndHover", "Make the color picker appear both on click and hover of the color decorator"),
      nls.localize("editor.colorDecoratorActivatedOn.hover", "Make the color picker appear on hover of the color decorator"),
      nls.localize("editor.colorDecoratorActivatedOn.click", "Make the color picker appear on click of the color decorator")
    ],
    description: nls.localize("colorDecoratorActivatedOn", "Controls the condition to make a color picker appear from a color decorator.")
  })),
  colorDecoratorsLimit: register(new EditorIntOption(
    21 /* colorDecoratorsLimit */,
    "colorDecoratorsLimit",
    500,
    1,
    1e6,
    {
      markdownDescription: nls.localize("colorDecoratorsLimit", "Controls the max number of color decorators that can be rendered in an editor at once.")
    }
  )),
  columnSelection: register(new EditorBooleanOption(
    22 /* columnSelection */,
    "columnSelection",
    false,
    { description: nls.localize("columnSelection", "Enable that the selection with the mouse and keys is doing column selection.") }
  )),
  comments: register(new EditorComments()),
  contextmenu: register(new EditorBooleanOption(
    24 /* contextmenu */,
    "contextmenu",
    true
  )),
  copyWithSyntaxHighlighting: register(new EditorBooleanOption(
    25 /* copyWithSyntaxHighlighting */,
    "copyWithSyntaxHighlighting",
    true,
    { description: nls.localize("copyWithSyntaxHighlighting", "Controls whether syntax highlighting should be copied into the clipboard.") }
  )),
  cursorBlinking: register(new EditorEnumOption(
    26 /* cursorBlinking */,
    "cursorBlinking",
    1 /* Blink */,
    "blink",
    ["blink", "smooth", "phase", "expand", "solid"],
    cursorBlinkingStyleFromString,
    { description: nls.localize("cursorBlinking", "Control the cursor animation style.") }
  )),
  cursorSmoothCaretAnimation: register(new EditorStringEnumOption(
    27 /* cursorSmoothCaretAnimation */,
    "cursorSmoothCaretAnimation",
    "off",
    ["off", "explicit", "on"],
    {
      enumDescriptions: [
        nls.localize("cursorSmoothCaretAnimation.off", "Smooth caret animation is disabled."),
        nls.localize("cursorSmoothCaretAnimation.explicit", "Smooth caret animation is enabled only when the user moves the cursor with an explicit gesture."),
        nls.localize("cursorSmoothCaretAnimation.on", "Smooth caret animation is always enabled.")
      ],
      description: nls.localize("cursorSmoothCaretAnimation", "Controls whether the smooth caret animation should be enabled.")
    }
  )),
  cursorStyle: register(new EditorEnumOption(
    28 /* cursorStyle */,
    "cursorStyle",
    1 /* Line */,
    "line",
    ["line", "block", "underline", "line-thin", "block-outline", "underline-thin"],
    cursorStyleFromString,
    { description: nls.localize("cursorStyle", "Controls the cursor style in insert input mode.") }
  )),
  overtypeCursorStyle: register(new EditorEnumOption(
    84 /* overtypeCursorStyle */,
    "overtypeCursorStyle",
    2 /* Block */,
    "block",
    ["line", "block", "underline", "line-thin", "block-outline", "underline-thin"],
    cursorStyleFromString,
    { description: nls.localize("overtypeCursorStyle", "Controls the cursor style in overtype input mode.") }
  )),
  cursorSurroundingLines: register(new EditorIntOption(
    29 /* cursorSurroundingLines */,
    "cursorSurroundingLines",
    0,
    0,
    Constants.MAX_SAFE_SMALL_INTEGER,
    { description: nls.localize("cursorSurroundingLines", "Controls the minimal number of visible leading lines (minimum 0) and trailing lines (minimum 1) surrounding the cursor. Known as 'scrollOff' or 'scrollOffset' in some other editors.") }
  )),
  cursorSurroundingLinesStyle: register(new EditorStringEnumOption(
    30 /* cursorSurroundingLinesStyle */,
    "cursorSurroundingLinesStyle",
    "default",
    ["default", "all"],
    {
      enumDescriptions: [
        nls.localize("cursorSurroundingLinesStyle.default", "`cursorSurroundingLines` is enforced only when triggered via the keyboard or API."),
        nls.localize("cursorSurroundingLinesStyle.all", "`cursorSurroundingLines` is enforced always.")
      ],
      markdownDescription: nls.localize("cursorSurroundingLinesStyle", "Controls when `#editor.cursorSurroundingLines#` should be enforced.")
    }
  )),
  cursorWidth: register(new EditorIntOption(
    31 /* cursorWidth */,
    "cursorWidth",
    0,
    0,
    Constants.MAX_SAFE_SMALL_INTEGER,
    { markdownDescription: nls.localize("cursorWidth", "Controls the width of the cursor when `#editor.cursorStyle#` is set to `line`.") }
  )),
  disableLayerHinting: register(new EditorBooleanOption(
    32 /* disableLayerHinting */,
    "disableLayerHinting",
    false
  )),
  disableMonospaceOptimizations: register(new EditorBooleanOption(
    33 /* disableMonospaceOptimizations */,
    "disableMonospaceOptimizations",
    false
  )),
  domReadOnly: register(new EditorBooleanOption(
    34 /* domReadOnly */,
    "domReadOnly",
    false
  )),
  dragAndDrop: register(new EditorBooleanOption(
    35 /* dragAndDrop */,
    "dragAndDrop",
    true,
    { description: nls.localize("dragAndDrop", "Controls whether the editor should allow moving selections via drag and drop.") }
  )),
  emptySelectionClipboard: register(new EditorEmptySelectionClipboard()),
  dropIntoEditor: register(new EditorDropIntoEditor()),
  experimentalEditContextEnabled: register(new EditorBooleanOption(
    37 /* experimentalEditContextEnabled */,
    "experimentalEditContextEnabled",
    product.quality !== "stable",
    {
      description: nls.localize("experimentalEditContextEnabled", "Sets whether the new experimental edit context should be used instead of the text area."),
      included: platform.isChrome || platform.isEdge || platform.isNative
    }
  )),
  stickyScroll: register(new EditorStickyScroll()),
  experimentalGpuAcceleration: register(new EditorStringEnumOption(
    39 /* experimentalGpuAcceleration */,
    "experimentalGpuAcceleration",
    "off",
    ["off", "on"],
    {
      tags: ["experimental"],
      enumDescriptions: [
        nls.localize("experimentalGpuAcceleration.off", "Use regular DOM-based rendering."),
        nls.localize("experimentalGpuAcceleration.on", "Use GPU acceleration.")
      ],
      description: nls.localize("experimentalGpuAcceleration", "Controls whether to use the experimental GPU acceleration to render the editor.")
    }
  )),
  experimentalWhitespaceRendering: register(new EditorStringEnumOption(
    40 /* experimentalWhitespaceRendering */,
    "experimentalWhitespaceRendering",
    "svg",
    ["svg", "font", "off"],
    {
      enumDescriptions: [
        nls.localize("experimentalWhitespaceRendering.svg", "Use a new rendering method with svgs."),
        nls.localize("experimentalWhitespaceRendering.font", "Use a new rendering method with font characters."),
        nls.localize("experimentalWhitespaceRendering.off", "Use the stable rendering method.")
      ],
      description: nls.localize("experimentalWhitespaceRendering", "Controls whether whitespace is rendered with a new, experimental method.")
    }
  )),
  extraEditorClassName: register(new EditorStringOption(
    41 /* extraEditorClassName */,
    "extraEditorClassName",
    ""
  )),
  fastScrollSensitivity: register(new EditorFloatOption(
    42 /* fastScrollSensitivity */,
    "fastScrollSensitivity",
    5,
    (x) => x <= 0 ? 5 : x,
    { markdownDescription: nls.localize("fastScrollSensitivity", "Scrolling speed multiplier when pressing `Alt`.") }
  )),
  find: register(new EditorFind()),
  fixedOverflowWidgets: register(new EditorBooleanOption(
    44 /* fixedOverflowWidgets */,
    "fixedOverflowWidgets",
    false
  )),
  folding: register(new EditorBooleanOption(
    45 /* folding */,
    "folding",
    true,
    { description: nls.localize("folding", "Controls whether the editor has code folding enabled.") }
  )),
  foldingStrategy: register(new EditorStringEnumOption(
    46 /* foldingStrategy */,
    "foldingStrategy",
    "auto",
    ["auto", "indentation"],
    {
      enumDescriptions: [
        nls.localize("foldingStrategy.auto", "Use a language-specific folding strategy if available, else the indentation-based one."),
        nls.localize("foldingStrategy.indentation", "Use the indentation-based folding strategy.")
      ],
      description: nls.localize("foldingStrategy", "Controls the strategy for computing folding ranges.")
    }
  )),
  foldingHighlight: register(new EditorBooleanOption(
    47 /* foldingHighlight */,
    "foldingHighlight",
    true,
    { description: nls.localize("foldingHighlight", "Controls whether the editor should highlight folded ranges.") }
  )),
  foldingImportsByDefault: register(new EditorBooleanOption(
    48 /* foldingImportsByDefault */,
    "foldingImportsByDefault",
    false,
    { description: nls.localize("foldingImportsByDefault", "Controls whether the editor automatically collapses import ranges.") }
  )),
  foldingMaximumRegions: register(new EditorIntOption(
    49 /* foldingMaximumRegions */,
    "foldingMaximumRegions",
    5e3,
    10,
    65e3,
    // limit must be less than foldingRanges MAX_FOLDING_REGIONS
    { description: nls.localize("foldingMaximumRegions", "The maximum number of foldable regions. Increasing this value may result in the editor becoming less responsive when the current source has a large number of foldable regions.") }
  )),
  unfoldOnClickAfterEndOfLine: register(new EditorBooleanOption(
    50 /* unfoldOnClickAfterEndOfLine */,
    "unfoldOnClickAfterEndOfLine",
    false,
    { description: nls.localize("unfoldOnClickAfterEndOfLine", "Controls whether clicking on the empty content after a folded line will unfold the line.") }
  )),
  fontFamily: register(new EditorStringOption(
    51 /* fontFamily */,
    "fontFamily",
    EDITOR_FONT_DEFAULTS.fontFamily,
    { description: nls.localize("fontFamily", "Controls the font family.") }
  )),
  fontInfo: register(new EditorFontInfo()),
  fontLigatures2: register(new EditorFontLigatures()),
  fontSize: register(new EditorFontSize()),
  fontWeight: register(new EditorFontWeight()),
  fontVariations: register(new EditorFontVariations()),
  formatOnPaste: register(new EditorBooleanOption(
    57 /* formatOnPaste */,
    "formatOnPaste",
    false,
    { description: nls.localize("formatOnPaste", "Controls whether the editor should automatically format the pasted content. A formatter must be available and the formatter should be able to format a range in a document.") }
  )),
  formatOnType: register(new EditorBooleanOption(
    58 /* formatOnType */,
    "formatOnType",
    false,
    { description: nls.localize("formatOnType", "Controls whether the editor should automatically format the line after typing.") }
  )),
  glyphMargin: register(new EditorBooleanOption(
    59 /* glyphMargin */,
    "glyphMargin",
    true,
    { description: nls.localize("glyphMargin", "Controls whether the editor should render the vertical glyph margin. Glyph margin is mostly used for debugging.") }
  )),
  gotoLocation: register(new EditorGoToLocation()),
  hideCursorInOverviewRuler: register(new EditorBooleanOption(
    61 /* hideCursorInOverviewRuler */,
    "hideCursorInOverviewRuler",
    false,
    { description: nls.localize("hideCursorInOverviewRuler", "Controls whether the cursor should be hidden in the overview ruler.") }
  )),
  hover: register(new EditorHover()),
  inDiffEditor: register(new EditorBooleanOption(
    63 /* inDiffEditor */,
    "inDiffEditor",
    false
  )),
  letterSpacing: register(new EditorFloatOption(
    65 /* letterSpacing */,
    "letterSpacing",
    EDITOR_FONT_DEFAULTS.letterSpacing,
    (x) => EditorFloatOption.clamp(x, -5, 20),
    { description: nls.localize("letterSpacing", "Controls the letter spacing in pixels.") }
  )),
  lightbulb: register(new EditorLightbulb()),
  lineDecorationsWidth: register(new EditorLineDecorationsWidth()),
  lineHeight: register(new EditorLineHeight()),
  lineNumbers: register(new EditorRenderLineNumbersOption()),
  lineNumbersMinChars: register(new EditorIntOption(
    70 /* lineNumbersMinChars */,
    "lineNumbersMinChars",
    5,
    1,
    300
  )),
  linkedEditing: register(new EditorBooleanOption(
    71 /* linkedEditing */,
    "linkedEditing",
    false,
    { description: nls.localize("linkedEditing", "Controls whether the editor has linked editing enabled. Depending on the language, related symbols such as HTML tags, are updated while editing.") }
  )),
  links: register(new EditorBooleanOption(
    72 /* links */,
    "links",
    true,
    { description: nls.localize("links", "Controls whether the editor should detect links and make them clickable.") }
  )),
  matchBrackets: register(new EditorStringEnumOption(
    73 /* matchBrackets */,
    "matchBrackets",
    "always",
    ["always", "near", "never"],
    { description: nls.localize("matchBrackets", "Highlight matching brackets.") }
  )),
  minimap: register(new EditorMinimap()),
  mouseStyle: register(new EditorStringEnumOption(
    75 /* mouseStyle */,
    "mouseStyle",
    "text",
    ["text", "default", "copy"]
  )),
  mouseWheelScrollSensitivity: register(new EditorFloatOption(
    76 /* mouseWheelScrollSensitivity */,
    "mouseWheelScrollSensitivity",
    1,
    (x) => x === 0 ? 1 : x,
    { markdownDescription: nls.localize("mouseWheelScrollSensitivity", "A multiplier to be used on the `deltaX` and `deltaY` of mouse wheel scroll events.") }
  )),
  mouseWheelZoom: register(new EditorBooleanOption(
    77 /* mouseWheelZoom */,
    "mouseWheelZoom",
    false,
    {
      markdownDescription: platform.isMacintosh ? nls.localize("mouseWheelZoom.mac", "Zoom the font of the editor when using mouse wheel and holding `Cmd`.") : nls.localize("mouseWheelZoom", "Zoom the font of the editor when using mouse wheel and holding `Ctrl`.")
    }
  )),
  multiCursorMergeOverlapping: register(new EditorBooleanOption(
    78 /* multiCursorMergeOverlapping */,
    "multiCursorMergeOverlapping",
    true,
    { description: nls.localize("multiCursorMergeOverlapping", "Merge multiple cursors when they are overlapping.") }
  )),
  multiCursorModifier: register(new EditorEnumOption(
    79 /* multiCursorModifier */,
    "multiCursorModifier",
    "altKey",
    "alt",
    ["ctrlCmd", "alt"],
    _multiCursorModifierFromString,
    {
      markdownEnumDescriptions: [
        nls.localize("multiCursorModifier.ctrlCmd", "Maps to `Control` on Windows and Linux and to `Command` on macOS."),
        nls.localize("multiCursorModifier.alt", "Maps to `Alt` on Windows and Linux and to `Option` on macOS.")
      ],
      markdownDescription: nls.localize({
        key: "multiCursorModifier",
        comment: [
          "- `ctrlCmd` refers to a value the setting can take and should not be localized.",
          "- `Control` and `Command` refer to the modifier keys Ctrl or Cmd on the keyboard and can be localized."
        ]
      }, "The modifier to be used to add multiple cursors with the mouse. The Go to Definition and Open Link mouse gestures will adapt such that they do not conflict with the [multicursor modifier](https://code.visualstudio.com/docs/editor/codebasics#_multicursor-modifier).")
    }
  )),
  multiCursorPaste: register(new EditorStringEnumOption(
    80 /* multiCursorPaste */,
    "multiCursorPaste",
    "spread",
    ["spread", "full"],
    {
      markdownEnumDescriptions: [
        nls.localize("multiCursorPaste.spread", "Each cursor pastes a single line of the text."),
        nls.localize("multiCursorPaste.full", "Each cursor pastes the full text.")
      ],
      markdownDescription: nls.localize("multiCursorPaste", "Controls pasting when the line count of the pasted text matches the cursor count.")
    }
  )),
  multiCursorLimit: register(new EditorIntOption(
    81 /* multiCursorLimit */,
    "multiCursorLimit",
    1e4,
    1,
    1e5,
    {
      markdownDescription: nls.localize("multiCursorLimit", "Controls the max number of cursors that can be in an active editor at once.")
    }
  )),
  occurrencesHighlight: register(new EditorStringEnumOption(
    82 /* occurrencesHighlight */,
    "occurrencesHighlight",
    "singleFile",
    ["off", "singleFile", "multiFile"],
    {
      markdownEnumDescriptions: [
        nls.localize("occurrencesHighlight.off", "Does not highlight occurrences."),
        nls.localize("occurrencesHighlight.singleFile", "Highlights occurrences only in the current file."),
        nls.localize("occurrencesHighlight.multiFile", "Experimental: Highlights occurrences across all valid open files.")
      ],
      markdownDescription: nls.localize("occurrencesHighlight", "Controls whether occurrences should be highlighted across open files.")
    }
  )),
  occurrencesHighlightDelay: register(new EditorIntOption(
    83 /* occurrencesHighlightDelay */,
    "occurrencesHighlightDelay",
    0,
    0,
    2e3,
    {
      description: nls.localize("occurrencesHighlightDelay", "Controls the delay in milliseconds after which occurrences are highlighted."),
      tags: ["preview"]
    }
  )),
  overtypeOnPaste: register(new EditorBooleanOption(
    85 /* overtypeOnPaste */,
    "overtypeOnPaste",
    true,
    { description: nls.localize("overtypeOnPaste", "Controls whether pasting should overtype.") }
  )),
  overviewRulerBorder: register(new EditorBooleanOption(
    86 /* overviewRulerBorder */,
    "overviewRulerBorder",
    true,
    { description: nls.localize("overviewRulerBorder", "Controls whether a border should be drawn around the overview ruler.") }
  )),
  overviewRulerLanes: register(new EditorIntOption(
    87 /* overviewRulerLanes */,
    "overviewRulerLanes",
    3,
    0,
    3
  )),
  padding: register(new EditorPadding()),
  pasteAs: register(new EditorPasteAs()),
  parameterHints: register(new EditorParameterHints()),
  peekWidgetDefaultFocus: register(new EditorStringEnumOption(
    91 /* peekWidgetDefaultFocus */,
    "peekWidgetDefaultFocus",
    "tree",
    ["tree", "editor"],
    {
      enumDescriptions: [
        nls.localize("peekWidgetDefaultFocus.tree", "Focus the tree when opening peek"),
        nls.localize("peekWidgetDefaultFocus.editor", "Focus the editor when opening peek")
      ],
      description: nls.localize("peekWidgetDefaultFocus", "Controls whether to focus the inline editor or the tree in the peek widget.")
    }
  )),
  placeholder: register(new PlaceholderOption()),
  definitionLinkOpensInPeek: register(new EditorBooleanOption(
    93 /* definitionLinkOpensInPeek */,
    "definitionLinkOpensInPeek",
    false,
    { description: nls.localize("definitionLinkOpensInPeek", "Controls whether the Go to Definition mouse gesture always opens the peek widget.") }
  )),
  quickSuggestions: register(new EditorQuickSuggestions()),
  quickSuggestionsDelay: register(new EditorIntOption(
    95 /* quickSuggestionsDelay */,
    "quickSuggestionsDelay",
    10,
    0,
    Constants.MAX_SAFE_SMALL_INTEGER,
    { description: nls.localize("quickSuggestionsDelay", "Controls the delay in milliseconds after which quick suggestions will show up.") }
  )),
  readOnly: register(new EditorBooleanOption(
    96 /* readOnly */,
    "readOnly",
    false
  )),
  readOnlyMessage: register(new ReadonlyMessage()),
  renameOnType: register(new EditorBooleanOption(
    98 /* renameOnType */,
    "renameOnType",
    false,
    { description: nls.localize("renameOnType", "Controls whether the editor auto renames on type."), markdownDeprecationMessage: nls.localize("renameOnTypeDeprecate", "Deprecated, use `editor.linkedEditing` instead.") }
  )),
  renderControlCharacters: register(new EditorBooleanOption(
    99 /* renderControlCharacters */,
    "renderControlCharacters",
    true,
    { description: nls.localize("renderControlCharacters", "Controls whether the editor should render control characters."), restricted: true }
  )),
  renderFinalNewline: register(new EditorStringEnumOption(
    100 /* renderFinalNewline */,
    "renderFinalNewline",
    platform.isLinux ? "dimmed" : "on",
    ["off", "on", "dimmed"],
    { description: nls.localize("renderFinalNewline", "Render last line number when the file ends with a newline.") }
  )),
  renderLineHighlight: register(new EditorStringEnumOption(
    101 /* renderLineHighlight */,
    "renderLineHighlight",
    "line",
    ["none", "gutter", "line", "all"],
    {
      enumDescriptions: [
        "",
        "",
        "",
        nls.localize("renderLineHighlight.all", "Highlights both the gutter and the current line.")
      ],
      description: nls.localize("renderLineHighlight", "Controls how the editor should render the current line highlight.")
    }
  )),
  renderLineHighlightOnlyWhenFocus: register(new EditorBooleanOption(
    102 /* renderLineHighlightOnlyWhenFocus */,
    "renderLineHighlightOnlyWhenFocus",
    false,
    { description: nls.localize("renderLineHighlightOnlyWhenFocus", "Controls if the editor should render the current line highlight only when the editor is focused.") }
  )),
  renderValidationDecorations: register(new EditorStringEnumOption(
    103 /* renderValidationDecorations */,
    "renderValidationDecorations",
    "editable",
    ["editable", "on", "off"]
  )),
  renderWhitespace: register(new EditorStringEnumOption(
    104 /* renderWhitespace */,
    "renderWhitespace",
    "selection",
    ["none", "boundary", "selection", "trailing", "all"],
    {
      enumDescriptions: [
        "",
        nls.localize("renderWhitespace.boundary", "Render whitespace characters except for single spaces between words."),
        nls.localize("renderWhitespace.selection", "Render whitespace characters only on selected text."),
        nls.localize("renderWhitespace.trailing", "Render only trailing whitespace characters."),
        ""
      ],
      description: nls.localize("renderWhitespace", "Controls how the editor should render whitespace characters.")
    }
  )),
  revealHorizontalRightPadding: register(new EditorIntOption(
    105 /* revealHorizontalRightPadding */,
    "revealHorizontalRightPadding",
    15,
    0,
    1e3
  )),
  roundedSelection: register(new EditorBooleanOption(
    106 /* roundedSelection */,
    "roundedSelection",
    true,
    { description: nls.localize("roundedSelection", "Controls whether selections should have rounded corners.") }
  )),
  rulers: register(new EditorRulers()),
  scrollbar: register(new EditorScrollbar()),
  scrollBeyondLastColumn: register(new EditorIntOption(
    109 /* scrollBeyondLastColumn */,
    "scrollBeyondLastColumn",
    4,
    0,
    Constants.MAX_SAFE_SMALL_INTEGER,
    { description: nls.localize("scrollBeyondLastColumn", "Controls the number of extra characters beyond which the editor will scroll horizontally.") }
  )),
  scrollBeyondLastLine: register(new EditorBooleanOption(
    110 /* scrollBeyondLastLine */,
    "scrollBeyondLastLine",
    true,
    { description: nls.localize("scrollBeyondLastLine", "Controls whether the editor will scroll beyond the last line.") }
  )),
  scrollPredominantAxis: register(new EditorBooleanOption(
    111 /* scrollPredominantAxis */,
    "scrollPredominantAxis",
    true,
    { description: nls.localize("scrollPredominantAxis", "Scroll only along the predominant axis when scrolling both vertically and horizontally at the same time. Prevents horizontal drift when scrolling vertically on a trackpad.") }
  )),
  selectionClipboard: register(new EditorBooleanOption(
    112 /* selectionClipboard */,
    "selectionClipboard",
    true,
    {
      description: nls.localize("selectionClipboard", "Controls whether the Linux primary clipboard should be supported."),
      included: platform.isLinux
    }
  )),
  selectionHighlight: register(new EditorBooleanOption(
    113 /* selectionHighlight */,
    "selectionHighlight",
    true,
    { description: nls.localize("selectionHighlight", "Controls whether the editor should highlight matches similar to the selection.") }
  )),
  selectOnLineNumbers: register(new EditorBooleanOption(
    114 /* selectOnLineNumbers */,
    "selectOnLineNumbers",
    true
  )),
  showFoldingControls: register(new EditorStringEnumOption(
    115 /* showFoldingControls */,
    "showFoldingControls",
    "mouseover",
    ["always", "never", "mouseover"],
    {
      enumDescriptions: [
        nls.localize("showFoldingControls.always", "Always show the folding controls."),
        nls.localize("showFoldingControls.never", "Never show the folding controls and reduce the gutter size."),
        nls.localize("showFoldingControls.mouseover", "Only show the folding controls when the mouse is over the gutter.")
      ],
      description: nls.localize("showFoldingControls", "Controls when the folding controls on the gutter are shown.")
    }
  )),
  showUnused: register(new EditorBooleanOption(
    116 /* showUnused */,
    "showUnused",
    true,
    { description: nls.localize("showUnused", "Controls fading out of unused code.") }
  )),
  showDeprecated: register(new EditorBooleanOption(
    145 /* showDeprecated */,
    "showDeprecated",
    true,
    { description: nls.localize("showDeprecated", "Controls strikethrough deprecated variables.") }
  )),
  inlayHints: register(new EditorInlayHints()),
  snippetSuggestions: register(new EditorStringEnumOption(
    117 /* snippetSuggestions */,
    "snippetSuggestions",
    "inline",
    ["top", "bottom", "inline", "none"],
    {
      enumDescriptions: [
        nls.localize("snippetSuggestions.top", "Show snippet suggestions on top of other suggestions."),
        nls.localize("snippetSuggestions.bottom", "Show snippet suggestions below other suggestions."),
        nls.localize("snippetSuggestions.inline", "Show snippets suggestions with other suggestions."),
        nls.localize("snippetSuggestions.none", "Do not show snippet suggestions.")
      ],
      description: nls.localize("snippetSuggestions", "Controls whether snippets are shown with other suggestions and how they are sorted.")
    }
  )),
  smartSelect: register(new SmartSelect()),
  smoothScrolling: register(new EditorBooleanOption(
    119 /* smoothScrolling */,
    "smoothScrolling",
    false,
    { description: nls.localize("smoothScrolling", "Controls whether the editor will scroll using an animation.") }
  )),
  stopRenderingLineAfter: register(new EditorIntOption(
    122 /* stopRenderingLineAfter */,
    "stopRenderingLineAfter",
    1e4,
    -1,
    Constants.MAX_SAFE_SMALL_INTEGER
  )),
  suggest: register(new EditorSuggest()),
  inlineSuggest: register(new InlineEditorSuggest()),
  inlineCompletionsAccessibilityVerbose: register(new EditorBooleanOption(
    155 /* inlineCompletionsAccessibilityVerbose */,
    "inlineCompletionsAccessibilityVerbose",
    false,
    { description: nls.localize("inlineCompletionsAccessibilityVerbose", "Controls whether the accessibility hint should be provided to screen reader users when an inline completion is shown.") }
  )),
  suggestFontSize: register(new EditorIntOption(
    124 /* suggestFontSize */,
    "suggestFontSize",
    0,
    0,
    1e3,
    { markdownDescription: nls.localize("suggestFontSize", "Font size for the suggest widget. When set to {0}, the value of {1} is used.", "`0`", "`#editor.fontSize#`") }
  )),
  suggestLineHeight: register(new EditorIntOption(
    125 /* suggestLineHeight */,
    "suggestLineHeight",
    0,
    0,
    1e3,
    { markdownDescription: nls.localize("suggestLineHeight", "Line height for the suggest widget. When set to {0}, the value of {1} is used. The minimum value is 8.", "`0`", "`#editor.lineHeight#`") }
  )),
  suggestOnTriggerCharacters: register(new EditorBooleanOption(
    126 /* suggestOnTriggerCharacters */,
    "suggestOnTriggerCharacters",
    true,
    { description: nls.localize("suggestOnTriggerCharacters", "Controls whether suggestions should automatically show up when typing trigger characters.") }
  )),
  suggestSelection: register(new EditorStringEnumOption(
    127 /* suggestSelection */,
    "suggestSelection",
    "first",
    ["first", "recentlyUsed", "recentlyUsedByPrefix"],
    {
      markdownEnumDescriptions: [
        nls.localize("suggestSelection.first", "Always select the first suggestion."),
        nls.localize("suggestSelection.recentlyUsed", "Select recent suggestions unless further typing selects one, e.g. `console.| -> console.log` because `log` has been completed recently."),
        nls.localize("suggestSelection.recentlyUsedByPrefix", "Select suggestions based on previous prefixes that have completed those suggestions, e.g. `co -> console` and `con -> const`.")
      ],
      description: nls.localize("suggestSelection", "Controls how suggestions are pre-selected when showing the suggest list.")
    }
  )),
  tabCompletion: register(new EditorStringEnumOption(
    128 /* tabCompletion */,
    "tabCompletion",
    "off",
    ["on", "off", "onlySnippets"],
    {
      enumDescriptions: [
        nls.localize("tabCompletion.on", "Tab complete will insert the best matching suggestion when pressing tab."),
        nls.localize("tabCompletion.off", "Disable tab completions."),
        nls.localize("tabCompletion.onlySnippets", "Tab complete snippets when their prefix match. Works best when 'quickSuggestions' aren't enabled.")
      ],
      description: nls.localize("tabCompletion", "Enables tab completions.")
    }
  )),
  tabIndex: register(new EditorIntOption(
    129 /* tabIndex */,
    "tabIndex",
    0,
    -1,
    Constants.MAX_SAFE_SMALL_INTEGER
  )),
  unicodeHighlight: register(new UnicodeHighlight()),
  unusualLineTerminators: register(new EditorStringEnumOption(
    131 /* unusualLineTerminators */,
    "unusualLineTerminators",
    "prompt",
    ["auto", "off", "prompt"],
    {
      enumDescriptions: [
        nls.localize("unusualLineTerminators.auto", "Unusual line terminators are automatically removed."),
        nls.localize("unusualLineTerminators.off", "Unusual line terminators are ignored."),
        nls.localize("unusualLineTerminators.prompt", "Unusual line terminators prompt to be removed.")
      ],
      description: nls.localize("unusualLineTerminators", "Remove unusual line terminators that might cause problems.")
    }
  )),
  useShadowDOM: register(new EditorBooleanOption(
    132 /* useShadowDOM */,
    "useShadowDOM",
    true
  )),
  useTabStops: register(new EditorBooleanOption(
    133 /* useTabStops */,
    "useTabStops",
    true,
    { description: nls.localize("useTabStops", "Spaces and tabs are inserted and deleted in alignment with tab stops.") }
  )),
  wordBreak: register(new EditorStringEnumOption(
    134 /* wordBreak */,
    "wordBreak",
    "normal",
    ["normal", "keepAll"],
    {
      markdownEnumDescriptions: [
        nls.localize("wordBreak.normal", "Use the default line break rule."),
        nls.localize("wordBreak.keepAll", "Word breaks should not be used for Chinese/Japanese/Korean (CJK) text. Non-CJK text behavior is the same as for normal.")
      ],
      description: nls.localize("wordBreak", "Controls the word break rules used for Chinese/Japanese/Korean (CJK) text.")
    }
  )),
  wordSegmenterLocales: register(new WordSegmenterLocales()),
  wordSeparators: register(new EditorStringOption(
    136 /* wordSeparators */,
    "wordSeparators",
    USUAL_WORD_SEPARATORS,
    { description: nls.localize("wordSeparators", "Characters that will be used as word separators when doing word related navigations or operations.") }
  )),
  wordWrap: register(new EditorStringEnumOption(
    137 /* wordWrap */,
    "wordWrap",
    "off",
    ["off", "on", "wordWrapColumn", "bounded"],
    {
      markdownEnumDescriptions: [
        nls.localize("wordWrap.off", "Lines will never wrap."),
        nls.localize("wordWrap.on", "Lines will wrap at the viewport width."),
        nls.localize({
          key: "wordWrap.wordWrapColumn",
          comment: [
            "- `editor.wordWrapColumn` refers to a different setting and should not be localized."
          ]
        }, "Lines will wrap at `#editor.wordWrapColumn#`."),
        nls.localize({
          key: "wordWrap.bounded",
          comment: [
            "- viewport means the edge of the visible window size.",
            "- `editor.wordWrapColumn` refers to a different setting and should not be localized."
          ]
        }, "Lines will wrap at the minimum of viewport and `#editor.wordWrapColumn#`.")
      ],
      description: nls.localize({
        key: "wordWrap",
        comment: [
          "- 'off', 'on', 'wordWrapColumn' and 'bounded' refer to values the setting can take and should not be localized.",
          "- `editor.wordWrapColumn` refers to a different setting and should not be localized."
        ]
      }, "Controls how lines should wrap.")
    }
  )),
  wordWrapBreakAfterCharacters: register(new EditorStringOption(
    138 /* wordWrapBreakAfterCharacters */,
    "wordWrapBreakAfterCharacters",
    // allow-any-unicode-next-line
    " 	})]?|/&.,;\xA2\xB0\u2032\u2033\u2030\u2103\u3001\u3002\uFF61\uFF64\uFFE0\uFF0C\uFF0E\uFF1A\uFF1B\uFF1F\uFF01\uFF05\u30FB\uFF65\u309D\u309E\u30FD\u30FE\u30FC\u30A1\u30A3\u30A5\u30A7\u30A9\u30C3\u30E3\u30E5\u30E7\u30EE\u30F5\u30F6\u3041\u3043\u3045\u3047\u3049\u3063\u3083\u3085\u3087\u308E\u3095\u3096\u31F0\u31F1\u31F2\u31F3\u31F4\u31F5\u31F6\u31F7\u31F8\u31F9\u31FA\u31FB\u31FC\u31FD\u31FE\u31FF\u3005\u303B\uFF67\uFF68\uFF69\uFF6A\uFF6B\uFF6C\uFF6D\uFF6E\uFF6F\uFF70\u201D\u3009\u300B\u300D\u300F\u3011\u3015\uFF09\uFF3D\uFF5D\uFF63"
  )),
  wordWrapBreakBeforeCharacters: register(new EditorStringOption(
    139 /* wordWrapBreakBeforeCharacters */,
    "wordWrapBreakBeforeCharacters",
    // allow-any-unicode-next-line
    "([{\u2018\u201C\u3008\u300A\u300C\u300E\u3010\u3014\uFF08\uFF3B\uFF5B\uFF62\xA3\xA5\uFF04\uFFE1\uFFE5+\uFF0B"
  )),
  wordWrapColumn: register(new EditorIntOption(
    140 /* wordWrapColumn */,
    "wordWrapColumn",
    80,
    1,
    Constants.MAX_SAFE_SMALL_INTEGER,
    {
      markdownDescription: nls.localize({
        key: "wordWrapColumn",
        comment: [
          "- `editor.wordWrap` refers to a different setting and should not be localized.",
          "- 'wordWrapColumn' and 'bounded' refer to values the different setting can take and should not be localized."
        ]
      }, "Controls the wrapping column of the editor when `#editor.wordWrap#` is `wordWrapColumn` or `bounded`.")
    }
  )),
  wordWrapOverride1: register(new EditorStringEnumOption(
    141 /* wordWrapOverride1 */,
    "wordWrapOverride1",
    "inherit",
    ["off", "on", "inherit"]
  )),
  wordWrapOverride2: register(new EditorStringEnumOption(
    142 /* wordWrapOverride2 */,
    "wordWrapOverride2",
    "inherit",
    ["off", "on", "inherit"]
  )),
  // Leave these at the end (because they have dependencies!)
  effectiveCursorStyle: register(new EffectiveCursorStyle()),
  editorClassName: register(new EditorClassName()),
  defaultColorDecorators: register(new EditorStringEnumOption(
    153 /* defaultColorDecorators */,
    "defaultColorDecorators",
    "auto",
    ["auto", "always", "never"],
    {
      enumDescriptions: [
        nls.localize("editor.defaultColorDecorators.auto", "Show default color decorators only when no extension provides colors decorators."),
        nls.localize("editor.defaultColorDecorators.always", "Always show default color decorators."),
        nls.localize("editor.defaultColorDecorators.never", "Never show default color decorators.")
      ],
      description: nls.localize("defaultColorDecorators", "Controls whether inline color decorations should be shown using the default document color provider.")
    }
  )),
  pixelRatio: register(new EditorPixelRatio()),
  tabFocusMode: register(new EditorBooleanOption(
    150 /* tabFocusMode */,
    "tabFocusMode",
    false,
    { markdownDescription: nls.localize("tabFocusMode", "Controls whether the editor receives tabs or defers them to the workbench for navigation.") }
  )),
  layoutInfo: register(new EditorLayoutInfoComputer()),
  wrappingInfo: register(new EditorWrappingInfoComputer()),
  wrappingIndent: register(new WrappingIndentOption()),
  wrappingStrategy: register(new WrappingStrategy()),
  effectiveExperimentalEditContextEnabled: register(new EffectiveExperimentalEditContextEnabled())
};
export {
  ApplyUpdateResult,
  ComputeOptionsMemory,
  ConfigurationChangedEvent,
  EDITOR_FONT_DEFAULTS,
  EditorAutoIndentStrategy,
  EditorFontLigatures,
  EditorFontVariations,
  EditorLayoutInfoComputer,
  EditorOption,
  EditorOptions,
  MINIMAP_GUTTER_WIDTH,
  RenderLineNumbersType,
  RenderMinimap,
  ShowLightbulbIconMode,
  TextEditorCursorBlinkingStyle,
  TextEditorCursorStyle,
  WrappingIndent,
  boolean,
  clampedFloat,
  clampedInt,
  cursorBlinkingStyleFromString,
  cursorStyleFromString,
  cursorStyleToString,
  editorOptionsRegistry,
  filterValidationDecorations,
  inUntrustedWorkspace,
  stringSet,
  unicodeHighlightConfigKeys
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgYXJyYXlzIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0ICogYXMgb2JqZWN0cyBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFNjcm9sbGJhclZpc2liaWxpdHkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zY3JvbGxhYmxlLmpzJztcbmltcG9ydCB7IENvbnN0YW50cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VpbnQuanMnO1xuaW1wb3J0IHsgRm9udEluZm8gfSBmcm9tICcuL2ZvbnRJbmZvLmpzJztcbmltcG9ydCB7IEVESVRPUl9NT0RFTF9ERUZBVUxUUyB9IGZyb20gJy4uL2NvcmUvdGV4dE1vZGVsRGVmYXVsdHMuanMnO1xuaW1wb3J0IHsgVVNVQUxfV09SRF9TRVBBUkFUT1JTIH0gZnJvbSAnLi4vY29yZS93b3JkSGVscGVyLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVN1cHBvcnQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHByb2R1Y3QgZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdC5qcyc7XG5cbi8vI3JlZ2lvbiB0eXBlZCBvcHRpb25zXG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciBhdXRvIGNsb3NpbmcgcXVvdGVzIGFuZCBicmFja2V0c1xuICovXG5leHBvcnQgdHlwZSBFZGl0b3JBdXRvQ2xvc2luZ1N0cmF0ZWd5ID0gJ2Fsd2F5cycgfCAnbGFuZ3VhZ2VEZWZpbmVkJyB8ICdiZWZvcmVXaGl0ZXNwYWNlJyB8ICduZXZlcic7XG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciBhdXRvIHdyYXBwaW5nIHF1b3RlcyBhbmQgYnJhY2tldHNcbiAqL1xuZXhwb3J0IHR5cGUgRWRpdG9yQXV0b1N1cnJvdW5kU3RyYXRlZ3kgPSAnbGFuZ3VhZ2VEZWZpbmVkJyB8ICdxdW90ZXMnIHwgJ2JyYWNrZXRzJyB8ICduZXZlcic7XG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0eXBpbmcgb3ZlciBjbG9zaW5nIHF1b3RlcyBvciBicmFja2V0c1xuICovXG5leHBvcnQgdHlwZSBFZGl0b3JBdXRvQ2xvc2luZ0VkaXRTdHJhdGVneSA9ICdhbHdheXMnIHwgJ2F1dG8nIHwgJ25ldmVyJztcblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIGF1dG8gaW5kZW50YXRpb24gaW4gdGhlIGVkaXRvclxuICovXG5leHBvcnQgY29uc3QgZW51bSBFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kge1xuXHROb25lID0gMCxcblx0S2VlcCA9IDEsXG5cdEJyYWNrZXRzID0gMixcblx0QWR2YW5jZWQgPSAzLFxuXHRGdWxsID0gNFxufVxuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGVkaXRvci5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJRWRpdG9yT3B0aW9ucyB7XG5cdC8qKlxuXHQgKiBUaGlzIGVkaXRvciBpcyB1c2VkIGluc2lkZSBhIGRpZmYgZWRpdG9yLlxuXHQgKi9cblx0aW5EaWZmRWRpdG9yPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFRoZSBhcmlhIGxhYmVsIGZvciB0aGUgZWRpdG9yJ3MgdGV4dGFyZWEgKHdoZW4gaXQgaXMgZm9jdXNlZCkuXG5cdCAqL1xuXHRhcmlhTGFiZWw/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdGhlIGFyaWEtcmVxdWlyZWQgYXR0cmlidXRlIHNob3VsZCBiZSBzZXQgb24gdGhlIGVkaXRvcnMgdGV4dGFyZWEuXG5cdCAqL1xuXHRhcmlhUmVxdWlyZWQ/OiBib29sZWFuO1xuXHQvKipcblx0ICogQ29udHJvbCB3aGV0aGVyIGEgc2NyZWVuIHJlYWRlciBhbm5vdW5jZXMgaW5saW5lIHN1Z2dlc3Rpb24gY29udGVudCBpbW1lZGlhdGVseS5cblx0ICovXG5cdHNjcmVlblJlYWRlckFubm91bmNlSW5saW5lU3VnZ2VzdGlvbj86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBUaGUgYHRhYmluZGV4YCBwcm9wZXJ0eSBvZiB0aGUgZWRpdG9yJ3MgdGV4dGFyZWFcblx0ICovXG5cdHRhYkluZGV4PzogbnVtYmVyO1xuXHQvKipcblx0ICogUmVuZGVyIHZlcnRpY2FsIGxpbmVzIGF0IHRoZSBzcGVjaWZpZWQgY29sdW1ucy5cblx0ICogRGVmYXVsdHMgdG8gZW1wdHkgYXJyYXkuXG5cdCAqL1xuXHRydWxlcnM/OiAobnVtYmVyIHwgSVJ1bGVyT3B0aW9uKVtdO1xuXHQvKipcblx0ICogTG9jYWxlcyB1c2VkIGZvciBzZWdtZW50aW5nIGxpbmVzIGludG8gd29yZHMgd2hlbiBkb2luZyB3b3JkIHJlbGF0ZWQgbmF2aWdhdGlvbnMgb3Igb3BlcmF0aW9ucy5cblx0ICpcblx0ICogU3BlY2lmeSB0aGUgQkNQIDQ3IGxhbmd1YWdlIHRhZyBvZiB0aGUgd29yZCB5b3Ugd2lzaCB0byByZWNvZ25pemUgKGUuZy4sIGphLCB6aC1DTiwgemgtSGFudC1UVywgZXRjLikuXG5cdCAqIERlZmF1bHRzIHRvIGVtcHR5IGFycmF5XG5cdCAqL1xuXHR3b3JkU2VnbWVudGVyTG9jYWxlcz86IHN0cmluZyB8IHN0cmluZ1tdO1xuXHQvKipcblx0ICogQSBzdHJpbmcgY29udGFpbmluZyB0aGUgd29yZCBzZXBhcmF0b3JzIHVzZWQgd2hlbiBkb2luZyB3b3JkIG5hdmlnYXRpb24uXG5cdCAqIERlZmF1bHRzIHRvIGB+IUAjJCVeJiooKS09K1t7XX1cXFxcfDs6XFwnXCIsLjw+Lz9cblx0ICovXG5cdHdvcmRTZXBhcmF0b3JzPzogc3RyaW5nO1xuXHQvKipcblx0ICogRW5hYmxlIExpbnV4IHByaW1hcnkgY2xpcGJvYXJkLlxuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0c2VsZWN0aW9uQ2xpcGJvYXJkPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIENvbnRyb2wgdGhlIHJlbmRlcmluZyBvZiBsaW5lIG51bWJlcnMuXG5cdCAqIElmIGl0IGlzIGEgZnVuY3Rpb24sIGl0IHdpbGwgYmUgaW52b2tlZCB3aGVuIHJlbmRlcmluZyBhIGxpbmUgbnVtYmVyIGFuZCB0aGUgcmV0dXJuIHZhbHVlIHdpbGwgYmUgcmVuZGVyZWQuXG5cdCAqIE90aGVyd2lzZSwgaWYgaXQgaXMgYSB0cnV0aHksIGxpbmUgbnVtYmVycyB3aWxsIGJlIHJlbmRlcmVkIG5vcm1hbGx5IChlcXVpdmFsZW50IG9mIHVzaW5nIGFuIGlkZW50aXR5IGZ1bmN0aW9uKS5cblx0ICogT3RoZXJ3aXNlLCBsaW5lIG51bWJlcnMgd2lsbCBub3QgYmUgcmVuZGVyZWQuXG5cdCAqIERlZmF1bHRzIHRvIGBvbmAuXG5cdCAqL1xuXHRsaW5lTnVtYmVycz86IExpbmVOdW1iZXJzVHlwZTtcblx0LyoqXG5cdCAqIENvbnRyb2xzIHRoZSBtaW5pbWFsIG51bWJlciBvZiB2aXNpYmxlIGxlYWRpbmcgYW5kIHRyYWlsaW5nIGxpbmVzIHN1cnJvdW5kaW5nIHRoZSBjdXJzb3IuXG5cdCAqIERlZmF1bHRzIHRvIDAuXG5cdCovXG5cdGN1cnNvclN1cnJvdW5kaW5nTGluZXM/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGVuIGBjdXJzb3JTdXJyb3VuZGluZ0xpbmVzYCBzaG91bGQgYmUgZW5mb3JjZWRcblx0ICogRGVmYXVsdHMgdG8gYGRlZmF1bHRgLCBgY3Vyc29yU3Vycm91bmRpbmdMaW5lc2AgaXMgbm90IGVuZm9yY2VkIHdoZW4gY3Vyc29yIHBvc2l0aW9uIGlzIGNoYW5nZWRcblx0ICogYnkgbW91c2UuXG5cdCovXG5cdGN1cnNvclN1cnJvdW5kaW5nTGluZXNTdHlsZT86ICdkZWZhdWx0JyB8ICdhbGwnO1xuXHQvKipcblx0ICogUmVuZGVyIGxhc3QgbGluZSBudW1iZXIgd2hlbiB0aGUgZmlsZSBlbmRzIHdpdGggYSBuZXdsaW5lLlxuXHQgKiBEZWZhdWx0cyB0byAnb24nIGZvciBXaW5kb3dzIGFuZCBtYWNPUyBhbmQgJ2RpbW1lZCcgZm9yIExpbnV4LlxuXHQqL1xuXHRyZW5kZXJGaW5hbE5ld2xpbmU/OiAnb24nIHwgJ29mZicgfCAnZGltbWVkJztcblx0LyoqXG5cdCAqIFJlbW92ZSB1bnVzdWFsIGxpbmUgdGVybWluYXRvcnMgbGlrZSBMSU5FIFNFUEFSQVRPUiAoTFMpLCBQQVJBR1JBUEggU0VQQVJBVE9SIChQUykuXG5cdCAqIERlZmF1bHRzIHRvICdwcm9tcHQnLlxuXHQgKi9cblx0dW51c3VhbExpbmVUZXJtaW5hdG9ycz86ICdhdXRvJyB8ICdvZmYnIHwgJ3Byb21wdCc7XG5cdC8qKlxuXHQgKiBTaG91bGQgdGhlIGNvcnJlc3BvbmRpbmcgbGluZSBiZSBzZWxlY3RlZCB3aGVuIGNsaWNraW5nIG9uIHRoZSBsaW5lIG51bWJlcj9cblx0ICogRGVmYXVsdHMgdG8gdHJ1ZS5cblx0ICovXG5cdHNlbGVjdE9uTGluZU51bWJlcnM/OiBib29sZWFuO1xuXHQvKipcblx0ICogQ29udHJvbCB0aGUgd2lkdGggb2YgbGluZSBudW1iZXJzLCBieSByZXNlcnZpbmcgaG9yaXpvbnRhbCBzcGFjZSBmb3IgcmVuZGVyaW5nIGF0IGxlYXN0IGFuIGFtb3VudCBvZiBkaWdpdHMuXG5cdCAqIERlZmF1bHRzIHRvIDUuXG5cdCAqL1xuXHRsaW5lTnVtYmVyc01pbkNoYXJzPzogbnVtYmVyO1xuXHQvKipcblx0ICogRW5hYmxlIHRoZSByZW5kZXJpbmcgb2YgdGhlIGdseXBoIG1hcmdpbi5cblx0ICogRGVmYXVsdHMgdG8gdHJ1ZSBpbiB2c2NvZGUgYW5kIHRvIGZhbHNlIGluIG1vbmFjby1lZGl0b3IuXG5cdCAqL1xuXHRnbHlwaE1hcmdpbj86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBUaGUgd2lkdGggcmVzZXJ2ZWQgZm9yIGxpbmUgZGVjb3JhdGlvbnMgKGluIHB4KS5cblx0ICogTGluZSBkZWNvcmF0aW9ucyBhcmUgcGxhY2VkIGJldHdlZW4gbGluZSBudW1iZXJzIGFuZCB0aGUgZWRpdG9yIGNvbnRlbnQuXG5cdCAqIFlvdSBjYW4gcGFzcyBpbiBhIHN0cmluZyBpbiB0aGUgZm9ybWF0IGZsb2F0aW5nIHBvaW50IGZvbGxvd2VkIGJ5IFwiY2hcIi4gZS5nLiAxLjNjaC5cblx0ICogRGVmYXVsdHMgdG8gMTAuXG5cdCAqL1xuXHRsaW5lRGVjb3JhdGlvbnNXaWR0aD86IG51bWJlciB8IHN0cmluZztcblx0LyoqXG5cdCAqIFdoZW4gcmV2ZWFsaW5nIHRoZSBjdXJzb3IsIGEgdmlydHVhbCBwYWRkaW5nIChweCkgaXMgYWRkZWQgdG8gdGhlIGN1cnNvciwgdHVybmluZyBpdCBpbnRvIGEgcmVjdGFuZ2xlLlxuXHQgKiBUaGlzIHZpcnR1YWwgcGFkZGluZyBlbnN1cmVzIHRoYXQgdGhlIGN1cnNvciBnZXRzIHJldmVhbGVkIGJlZm9yZSBoaXR0aW5nIHRoZSBlZGdlIG9mIHRoZSB2aWV3cG9ydC5cblx0ICogRGVmYXVsdHMgdG8gMzAgKHB4KS5cblx0ICovXG5cdHJldmVhbEhvcml6b250YWxSaWdodFBhZGRpbmc/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBSZW5kZXIgdGhlIGVkaXRvciBzZWxlY3Rpb24gd2l0aCByb3VuZGVkIGJvcmRlcnMuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRyb3VuZGVkU2VsZWN0aW9uPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIENsYXNzIG5hbWUgdG8gYmUgYWRkZWQgdG8gdGhlIGVkaXRvci5cblx0ICovXG5cdGV4dHJhRWRpdG9yQ2xhc3NOYW1lPzogc3RyaW5nO1xuXHQvKipcblx0ICogU2hvdWxkIHRoZSBlZGl0b3IgYmUgcmVhZCBvbmx5LiBTZWUgYWxzbyBgZG9tUmVhZE9ubHlgLlxuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0ICovXG5cdHJlYWRPbmx5PzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFRoZSBtZXNzYWdlIHRvIGRpc3BsYXkgd2hlbiB0aGUgZWRpdG9yIGlzIHJlYWRvbmx5LlxuXHQgKi9cblx0cmVhZE9ubHlNZXNzYWdlPzogSU1hcmtkb3duU3RyaW5nO1xuXHQvKipcblx0ICogU2hvdWxkIHRoZSB0ZXh0YXJlYSB1c2VkIGZvciBpbnB1dCB1c2UgdGhlIERPTSBgcmVhZG9ubHlgIGF0dHJpYnV0ZS5cblx0ICogRGVmYXVsdHMgdG8gZmFsc2UuXG5cdCAqL1xuXHRkb21SZWFkT25seT86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBFbmFibGUgbGlua2VkIGVkaXRpbmcuXG5cdCAqIERlZmF1bHRzIHRvIGZhbHNlLlxuXHQgKi9cblx0bGlua2VkRWRpdGluZz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBkZXByZWNhdGVkLCB1c2UgbGlua2VkRWRpdGluZyBpbnN0ZWFkXG5cdCAqL1xuXHRyZW5hbWVPblR5cGU/OiBib29sZWFuO1xuXHQvKipcblx0ICogU2hvdWxkIHRoZSBlZGl0b3IgcmVuZGVyIHZhbGlkYXRpb24gZGVjb3JhdGlvbnMuXG5cdCAqIERlZmF1bHRzIHRvIGVkaXRhYmxlLlxuXHQgKi9cblx0cmVuZGVyVmFsaWRhdGlvbkRlY29yYXRpb25zPzogJ2VkaXRhYmxlJyB8ICdvbicgfCAnb2ZmJztcblx0LyoqXG5cdCAqIENvbnRyb2wgdGhlIGJlaGF2aW9yIGFuZCByZW5kZXJpbmcgb2YgdGhlIHNjcm9sbGJhcnMuXG5cdCAqL1xuXHRzY3JvbGxiYXI/OiBJRWRpdG9yU2Nyb2xsYmFyT3B0aW9ucztcblx0LyoqXG5cdCAqIENvbnRyb2wgdGhlIGJlaGF2aW9yIG9mIHN0aWNreSBzY3JvbGwgb3B0aW9uc1xuXHQgKi9cblx0c3RpY2t5U2Nyb2xsPzogSUVkaXRvclN0aWNreVNjcm9sbE9wdGlvbnM7XG5cdC8qKlxuXHQgKiBDb250cm9sIHRoZSBiZWhhdmlvciBhbmQgcmVuZGVyaW5nIG9mIHRoZSBtaW5pbWFwLlxuXHQgKi9cblx0bWluaW1hcD86IElFZGl0b3JNaW5pbWFwT3B0aW9ucztcblx0LyoqXG5cdCAqIENvbnRyb2wgdGhlIGJlaGF2aW9yIG9mIHRoZSBmaW5kIHdpZGdldC5cblx0ICovXG5cdGZpbmQ/OiBJRWRpdG9yRmluZE9wdGlvbnM7XG5cdC8qKlxuXHQgKiBEaXNwbGF5IG92ZXJmbG93IHdpZGdldHMgYXMgYGZpeGVkYC5cblx0ICogRGVmYXVsdHMgdG8gYGZhbHNlYC5cblx0ICovXG5cdGZpeGVkT3ZlcmZsb3dXaWRnZXRzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFRoZSBudW1iZXIgb2YgdmVydGljYWwgbGFuZXMgdGhlIG92ZXJ2aWV3IHJ1bGVyIHNob3VsZCByZW5kZXIuXG5cdCAqIERlZmF1bHRzIHRvIDMuXG5cdCAqL1xuXHRvdmVydmlld1J1bGVyTGFuZXM/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBDb250cm9scyBpZiBhIGJvcmRlciBzaG91bGQgYmUgZHJhd24gYXJvdW5kIHRoZSBvdmVydmlldyBydWxlci5cblx0ICogRGVmYXVsdHMgdG8gYHRydWVgLlxuXHQgKi9cblx0b3ZlcnZpZXdSdWxlckJvcmRlcj86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBDb250cm9sIHRoZSBjdXJzb3IgYW5pbWF0aW9uIHN0eWxlLCBwb3NzaWJsZSB2YWx1ZXMgYXJlICdibGluaycsICdzbW9vdGgnLCAncGhhc2UnLCAnZXhwYW5kJyBhbmQgJ3NvbGlkJy5cblx0ICogRGVmYXVsdHMgdG8gJ2JsaW5rJy5cblx0ICovXG5cdGN1cnNvckJsaW5raW5nPzogJ2JsaW5rJyB8ICdzbW9vdGgnIHwgJ3BoYXNlJyB8ICdleHBhbmQnIHwgJ3NvbGlkJztcblx0LyoqXG5cdCAqIFpvb20gdGhlIGZvbnQgaW4gdGhlIGVkaXRvciB3aGVuIHVzaW5nIHRoZSBtb3VzZSB3aGVlbCBpbiBjb21iaW5hdGlvbiB3aXRoIGhvbGRpbmcgQ3RybC5cblx0ICogRGVmYXVsdHMgdG8gZmFsc2UuXG5cdCAqL1xuXHRtb3VzZVdoZWVsWm9vbT86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBDb250cm9sIHRoZSBtb3VzZSBwb2ludGVyIHN0eWxlLCBlaXRoZXIgJ3RleHQnIG9yICdkZWZhdWx0JyBvciAnY29weSdcblx0ICogRGVmYXVsdHMgdG8gJ3RleHQnXG5cdCAqL1xuXHRtb3VzZVN0eWxlPzogJ3RleHQnIHwgJ2RlZmF1bHQnIHwgJ2NvcHknO1xuXHQvKipcblx0ICogRW5hYmxlIHNtb290aCBjYXJldCBhbmltYXRpb24uXG5cdCAqIERlZmF1bHRzIHRvICdvZmYnLlxuXHQgKi9cblx0Y3Vyc29yU21vb3RoQ2FyZXRBbmltYXRpb24/OiAnb2ZmJyB8ICdleHBsaWNpdCcgfCAnb24nO1xuXHQvKipcblx0ICogQ29udHJvbCB0aGUgY3Vyc29yIHN0eWxlIGluIGluc2VydCBtb2RlLlxuXHQgKiBEZWZhdWx0cyB0byAnbGluZScuXG5cdCAqL1xuXHRjdXJzb3JTdHlsZT86ICdsaW5lJyB8ICdibG9jaycgfCAndW5kZXJsaW5lJyB8ICdsaW5lLXRoaW4nIHwgJ2Jsb2NrLW91dGxpbmUnIHwgJ3VuZGVybGluZS10aGluJztcblx0LyoqXG5cdCAqIENvbnRyb2wgdGhlIGN1cnNvciBzdHlsZSBpbiBvdmVydHlwZSBtb2RlLlxuXHQgKiBEZWZhdWx0cyB0byAnYmxvY2snLlxuXHQgKi9cblx0b3ZlcnR5cGVDdXJzb3JTdHlsZT86ICdsaW5lJyB8ICdibG9jaycgfCAndW5kZXJsaW5lJyB8ICdsaW5lLXRoaW4nIHwgJ2Jsb2NrLW91dGxpbmUnIHwgJ3VuZGVybGluZS10aGluJztcblx0LyoqXG5cdCAqICBDb250cm9scyB3aGV0aGVyIHBhc3RlIGluIG92ZXJ0eXBlIG1vZGUgc2hvdWxkIG92ZXJ3cml0ZSBvciBpbnNlcnQuXG5cdCAqL1xuXHRvdmVydHlwZU9uUGFzdGU/OiBib29sZWFuO1xuXHQvKipcblx0ICogQ29udHJvbCB0aGUgd2lkdGggb2YgdGhlIGN1cnNvciB3aGVuIGN1cnNvclN0eWxlIGlzIHNldCB0byAnbGluZSdcblx0ICovXG5cdGN1cnNvcldpZHRoPzogbnVtYmVyO1xuXHQvKipcblx0ICogRW5hYmxlIGZvbnQgbGlnYXR1cmVzLlxuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0ICovXG5cdGZvbnRMaWdhdHVyZXM/OiBib29sZWFuIHwgc3RyaW5nO1xuXHQvKipcblx0ICogRW5hYmxlIGZvbnQgdmFyaWF0aW9ucy5cblx0ICogRGVmYXVsdHMgdG8gZmFsc2UuXG5cdCAqL1xuXHRmb250VmFyaWF0aW9ucz86IGJvb2xlYW4gfCBzdHJpbmc7XG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRvIHVzZSBkZWZhdWx0IGNvbG9yIGRlY29yYXRpb25zIG9yIG5vdCB1c2luZyB0aGUgZGVmYXVsdCBkb2N1bWVudCBjb2xvciBwcm92aWRlclxuXHQgKi9cblx0ZGVmYXVsdENvbG9yRGVjb3JhdG9ycz86ICdhdXRvJyB8ICdhbHdheXMnIHwgJ25ldmVyJztcblx0LyoqXG5cdCAqIERpc2FibGUgdGhlIHVzZSBvZiBgdHJhbnNmb3JtOiB0cmFuc2xhdGUzZCgwcHgsIDBweCwgMHB4KWAgZm9yIHRoZSBlZGl0b3IgbWFyZ2luIGFuZCBsaW5lcyBsYXllcnMuXG5cdCAqIFRoZSB1c2FnZSBvZiBgdHJhbnNmb3JtOiB0cmFuc2xhdGUzZCgwcHgsIDBweCwgMHB4KWAgYWN0cyBhcyBhIGhpbnQgZm9yIGJyb3dzZXJzIHRvIGNyZWF0ZSBhbiBleHRyYSBsYXllci5cblx0ICogRGVmYXVsdHMgdG8gZmFsc2UuXG5cdCAqL1xuXHRkaXNhYmxlTGF5ZXJIaW50aW5nPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIERpc2FibGUgdGhlIG9wdGltaXphdGlvbnMgZm9yIG1vbm9zcGFjZSBmb250cy5cblx0ICogRGVmYXVsdHMgdG8gZmFsc2UuXG5cdCAqL1xuXHRkaXNhYmxlTW9ub3NwYWNlT3B0aW1pemF0aW9ucz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBTaG91bGQgdGhlIGN1cnNvciBiZSBoaWRkZW4gaW4gdGhlIG92ZXJ2aWV3IHJ1bGVyLlxuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0ICovXG5cdGhpZGVDdXJzb3JJbk92ZXJ2aWV3UnVsZXI/OiBib29sZWFuO1xuXHQvKipcblx0ICogRW5hYmxlIHRoYXQgc2Nyb2xsaW5nIGNhbiBnbyBvbmUgc2NyZWVuIHNpemUgYWZ0ZXIgdGhlIGxhc3QgbGluZS5cblx0ICogRGVmYXVsdHMgdG8gdHJ1ZS5cblx0ICovXG5cdHNjcm9sbEJleW9uZExhc3RMaW5lPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIEVuYWJsZSB0aGF0IHNjcm9sbGluZyBjYW4gZ28gYmV5b25kIHRoZSBsYXN0IGNvbHVtbiBieSBhIG51bWJlciBvZiBjb2x1bW5zLlxuXHQgKiBEZWZhdWx0cyB0byA1LlxuXHQgKi9cblx0c2Nyb2xsQmV5b25kTGFzdENvbHVtbj86IG51bWJlcjtcblx0LyoqXG5cdCAqIEVuYWJsZSB0aGF0IHRoZSBlZGl0b3IgYW5pbWF0ZXMgc2Nyb2xsaW5nIHRvIGEgcG9zaXRpb24uXG5cdCAqIERlZmF1bHRzIHRvIGZhbHNlLlxuXHQgKi9cblx0c21vb3RoU2Nyb2xsaW5nPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIEVuYWJsZSB0aGF0IHRoZSBlZGl0b3Igd2lsbCBpbnN0YWxsIGEgUmVzaXplT2JzZXJ2ZXIgdG8gY2hlY2sgaWYgaXRzIGNvbnRhaW5lciBkb20gbm9kZSBzaXplIGhhcyBjaGFuZ2VkLlxuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0ICovXG5cdGF1dG9tYXRpY0xheW91dD86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBDb250cm9sIHRoZSB3cmFwcGluZyBvZiB0aGUgZWRpdG9yLlxuXHQgKiBXaGVuIGB3b3JkV3JhcGAgPSBcIm9mZlwiLCB0aGUgbGluZXMgd2lsbCBuZXZlciB3cmFwLlxuXHQgKiBXaGVuIGB3b3JkV3JhcGAgPSBcIm9uXCIsIHRoZSBsaW5lcyB3aWxsIHdyYXAgYXQgdGhlIHZpZXdwb3J0IHdpZHRoLlxuXHQgKiBXaGVuIGB3b3JkV3JhcGAgPSBcIndvcmRXcmFwQ29sdW1uXCIsIHRoZSBsaW5lcyB3aWxsIHdyYXAgYXQgYHdvcmRXcmFwQ29sdW1uYC5cblx0ICogV2hlbiBgd29yZFdyYXBgID0gXCJib3VuZGVkXCIsIHRoZSBsaW5lcyB3aWxsIHdyYXAgYXQgbWluKHZpZXdwb3J0IHdpZHRoLCB3b3JkV3JhcENvbHVtbikuXG5cdCAqIERlZmF1bHRzIHRvIFwib2ZmXCIuXG5cdCAqL1xuXHR3b3JkV3JhcD86ICdvZmYnIHwgJ29uJyB8ICd3b3JkV3JhcENvbHVtbicgfCAnYm91bmRlZCc7XG5cdC8qKlxuXHQgKiBPdmVycmlkZSB0aGUgYHdvcmRXcmFwYCBzZXR0aW5nLlxuXHQgKi9cblx0d29yZFdyYXBPdmVycmlkZTE/OiAnb2ZmJyB8ICdvbicgfCAnaW5oZXJpdCc7XG5cdC8qKlxuXHQgKiBPdmVycmlkZSB0aGUgYHdvcmRXcmFwT3ZlcnJpZGUxYCBzZXR0aW5nLlxuXHQgKi9cblx0d29yZFdyYXBPdmVycmlkZTI/OiAnb2ZmJyB8ICdvbicgfCAnaW5oZXJpdCc7XG5cdC8qKlxuXHQgKiBDb250cm9sIHRoZSB3cmFwcGluZyBvZiB0aGUgZWRpdG9yLlxuXHQgKiBXaGVuIGB3b3JkV3JhcGAgPSBcIm9mZlwiLCB0aGUgbGluZXMgd2lsbCBuZXZlciB3cmFwLlxuXHQgKiBXaGVuIGB3b3JkV3JhcGAgPSBcIm9uXCIsIHRoZSBsaW5lcyB3aWxsIHdyYXAgYXQgdGhlIHZpZXdwb3J0IHdpZHRoLlxuXHQgKiBXaGVuIGB3b3JkV3JhcGAgPSBcIndvcmRXcmFwQ29sdW1uXCIsIHRoZSBsaW5lcyB3aWxsIHdyYXAgYXQgYHdvcmRXcmFwQ29sdW1uYC5cblx0ICogV2hlbiBgd29yZFdyYXBgID0gXCJib3VuZGVkXCIsIHRoZSBsaW5lcyB3aWxsIHdyYXAgYXQgbWluKHZpZXdwb3J0IHdpZHRoLCB3b3JkV3JhcENvbHVtbikuXG5cdCAqIERlZmF1bHRzIHRvIDgwLlxuXHQgKi9cblx0d29yZFdyYXBDb2x1bW4/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBDb250cm9sIGluZGVudGF0aW9uIG9mIHdyYXBwZWQgbGluZXMuIENhbiBiZTogJ25vbmUnLCAnc2FtZScsICdpbmRlbnQnIG9yICdkZWVwSW5kZW50Jy5cblx0ICogRGVmYXVsdHMgdG8gJ3NhbWUnIGluIHZzY29kZSBhbmQgdG8gJ25vbmUnIGluIG1vbmFjby1lZGl0b3IuXG5cdCAqL1xuXHR3cmFwcGluZ0luZGVudD86ICdub25lJyB8ICdzYW1lJyB8ICdpbmRlbnQnIHwgJ2RlZXBJbmRlbnQnO1xuXHQvKipcblx0ICogQ29udHJvbHMgdGhlIHdyYXBwaW5nIHN0cmF0ZWd5IHRvIHVzZS5cblx0ICogRGVmYXVsdHMgdG8gJ3NpbXBsZScuXG5cdCAqL1xuXHR3cmFwcGluZ1N0cmF0ZWd5PzogJ3NpbXBsZScgfCAnYWR2YW5jZWQnO1xuXHQvKipcblx0ICogQ29uZmlndXJlIHdvcmQgd3JhcHBpbmcgY2hhcmFjdGVycy4gQSBicmVhayB3aWxsIGJlIGludHJvZHVjZWQgYmVmb3JlIHRoZXNlIGNoYXJhY3RlcnMuXG5cdCAqL1xuXHR3b3JkV3JhcEJyZWFrQmVmb3JlQ2hhcmFjdGVycz86IHN0cmluZztcblx0LyoqXG5cdCAqIENvbmZpZ3VyZSB3b3JkIHdyYXBwaW5nIGNoYXJhY3RlcnMuIEEgYnJlYWsgd2lsbCBiZSBpbnRyb2R1Y2VkIGFmdGVyIHRoZXNlIGNoYXJhY3RlcnMuXG5cdCAqL1xuXHR3b3JkV3JhcEJyZWFrQWZ0ZXJDaGFyYWN0ZXJzPzogc3RyaW5nO1xuXHQvKipcblx0ICogU2V0cyB3aGV0aGVyIGxpbmUgYnJlYWtzIGFwcGVhciB3aGVyZXZlciB0aGUgdGV4dCB3b3VsZCBvdGhlcndpc2Ugb3ZlcmZsb3cgaXRzIGNvbnRlbnQgYm94LlxuXHQgKiBXaGVuIHdvcmRCcmVhayA9ICdub3JtYWwnLCBVc2UgdGhlIGRlZmF1bHQgbGluZSBicmVhayBydWxlLlxuXHQgKiBXaGVuIHdvcmRCcmVhayA9ICdrZWVwQWxsJywgV29yZCBicmVha3Mgc2hvdWxkIG5vdCBiZSB1c2VkIGZvciBDaGluZXNlL0phcGFuZXNlL0tvcmVhbiAoQ0pLKSB0ZXh0LiBOb24tQ0pLIHRleHQgYmVoYXZpb3IgaXMgdGhlIHNhbWUgYXMgZm9yIG5vcm1hbC5cblx0ICovXG5cdHdvcmRCcmVhaz86ICdub3JtYWwnIHwgJ2tlZXBBbGwnO1xuXHQvKipcblx0ICogUGVyZm9ybWFuY2UgZ3VhcmQ6IFN0b3AgcmVuZGVyaW5nIGEgbGluZSBhZnRlciB4IGNoYXJhY3RlcnMuXG5cdCAqIERlZmF1bHRzIHRvIDEwMDAwLlxuXHQgKiBVc2UgLTEgdG8gbmV2ZXIgc3RvcCByZW5kZXJpbmdcblx0ICovXG5cdHN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXI/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBDb25maWd1cmUgdGhlIGVkaXRvcidzIGhvdmVyLlxuXHQgKi9cblx0aG92ZXI/OiBJRWRpdG9ySG92ZXJPcHRpb25zO1xuXHQvKipcblx0ICogRW5hYmxlIGRldGVjdGluZyBsaW5rcyBhbmQgbWFraW5nIHRoZW0gY2xpY2thYmxlLlxuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0bGlua3M/OiBib29sZWFuO1xuXHQvKipcblx0ICogRW5hYmxlIGlubGluZSBjb2xvciBkZWNvcmF0b3JzIGFuZCBjb2xvciBwaWNrZXIgcmVuZGVyaW5nLlxuXHQgKi9cblx0Y29sb3JEZWNvcmF0b3JzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoYXQgaXMgdGhlIGNvbmRpdGlvbiB0byBzcGF3biBhIGNvbG9yIHBpY2tlciBmcm9tIGEgY29sb3IgZGVjdG9yYXRvclxuXHQgKi9cblx0Y29sb3JEZWNvcmF0b3JzQWN0aXZhdGVkT24/OiAnY2xpY2tBbmRIb3ZlcicgfCAnY2xpY2snIHwgJ2hvdmVyJztcblx0LyoqXG5cdCAqIENvbnRyb2xzIHRoZSBtYXggbnVtYmVyIG9mIGNvbG9yIGRlY29yYXRvcnMgdGhhdCBjYW4gYmUgcmVuZGVyZWQgaW4gYW4gZWRpdG9yIGF0IG9uY2UuXG5cdCAqL1xuXHRjb2xvckRlY29yYXRvcnNMaW1pdD86IG51bWJlcjtcblx0LyoqXG5cdCAqIENvbnRyb2wgdGhlIGJlaGF2aW91ciBvZiBjb21tZW50cyBpbiB0aGUgZWRpdG9yLlxuXHQgKi9cblx0Y29tbWVudHM/OiBJRWRpdG9yQ29tbWVudHNPcHRpb25zO1xuXHQvKipcblx0ICogRW5hYmxlIGN1c3RvbSBjb250ZXh0bWVudS5cblx0ICogRGVmYXVsdHMgdG8gdHJ1ZS5cblx0ICovXG5cdGNvbnRleHRtZW51PzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIEEgbXVsdGlwbGllciB0byBiZSB1c2VkIG9uIHRoZSBgZGVsdGFYYCBhbmQgYGRlbHRhWWAgb2YgbW91c2Ugd2hlZWwgc2Nyb2xsIGV2ZW50cy5cblx0ICogRGVmYXVsdHMgdG8gMS5cblx0ICovXG5cdG1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eT86IG51bWJlcjtcblx0LyoqXG5cdCAqIEZhc3RTY3JvbGxpbmcgbXVsaXRwbGllciBzcGVlZCB3aGVuIHByZXNzaW5nIGBBbHRgXG5cdCAqIERlZmF1bHRzIHRvIDUuXG5cdCAqL1xuXHRmYXN0U2Nyb2xsU2Vuc2l0aXZpdHk/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBFbmFibGUgdGhhdCB0aGUgZWRpdG9yIHNjcm9sbHMgb25seSB0aGUgcHJlZG9taW5hbnQgYXhpcy4gUHJldmVudHMgaG9yaXpvbnRhbCBkcmlmdCB3aGVuIHNjcm9sbGluZyB2ZXJ0aWNhbGx5IG9uIGEgdHJhY2twYWQuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRzY3JvbGxQcmVkb21pbmFudEF4aXM/OiBib29sZWFuO1xuXHQvKipcblx0ICogRW5hYmxlIHRoYXQgdGhlIHNlbGVjdGlvbiB3aXRoIHRoZSBtb3VzZSBhbmQga2V5cyBpcyBkb2luZyBjb2x1bW4gc2VsZWN0aW9uLlxuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0ICovXG5cdGNvbHVtblNlbGVjdGlvbj86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBUaGUgbW9kaWZpZXIgdG8gYmUgdXNlZCB0byBhZGQgbXVsdGlwbGUgY3Vyc29ycyB3aXRoIHRoZSBtb3VzZS5cblx0ICogRGVmYXVsdHMgdG8gJ2FsdCdcblx0ICovXG5cdG11bHRpQ3Vyc29yTW9kaWZpZXI/OiAnY3RybENtZCcgfCAnYWx0Jztcblx0LyoqXG5cdCAqIE1lcmdlIG92ZXJsYXBwaW5nIHNlbGVjdGlvbnMuXG5cdCAqIERlZmF1bHRzIHRvIHRydWVcblx0ICovXG5cdG11bHRpQ3Vyc29yTWVyZ2VPdmVybGFwcGluZz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBDb25maWd1cmUgdGhlIGJlaGF2aW91ciB3aGVuIHBhc3RpbmcgYSB0ZXh0IHdpdGggdGhlIGxpbmUgY291bnQgZXF1YWwgdG8gdGhlIGN1cnNvciBjb3VudC5cblx0ICogRGVmYXVsdHMgdG8gJ3NwcmVhZCcuXG5cdCAqL1xuXHRtdWx0aUN1cnNvclBhc3RlPzogJ3NwcmVhZCcgfCAnZnVsbCc7XG5cdC8qKlxuXHQgKiBDb250cm9scyB0aGUgbWF4IG51bWJlciBvZiB0ZXh0IGN1cnNvcnMgdGhhdCBjYW4gYmUgaW4gYW4gYWN0aXZlIGVkaXRvciBhdCBvbmNlLlxuXHQgKi9cblx0bXVsdGlDdXJzb3JMaW1pdD86IG51bWJlcjtcblx0LyoqXG5cdCAqIENvbmZpZ3VyZSB0aGUgZWRpdG9yJ3MgYWNjZXNzaWJpbGl0eSBzdXBwb3J0LlxuXHQgKiBEZWZhdWx0cyB0byAnYXV0bycuIEl0IGlzIGJlc3QgdG8gbGVhdmUgdGhpcyB0byAnYXV0bycuXG5cdCAqL1xuXHRhY2Nlc3NpYmlsaXR5U3VwcG9ydD86ICdhdXRvJyB8ICdvZmYnIHwgJ29uJztcblx0LyoqXG5cdCAqIENvbnRyb2xzIHRoZSBudW1iZXIgb2YgbGluZXMgaW4gdGhlIGVkaXRvciB0aGF0IGNhbiBiZSByZWFkIG91dCBieSBhIHNjcmVlbiByZWFkZXJcblx0ICovXG5cdGFjY2Vzc2liaWxpdHlQYWdlU2l6ZT86IG51bWJlcjtcblx0LyoqXG5cdCAqIFN1Z2dlc3Qgb3B0aW9ucy5cblx0ICovXG5cdHN1Z2dlc3Q/OiBJU3VnZ2VzdE9wdGlvbnM7XG5cdGlubGluZVN1Z2dlc3Q/OiBJSW5saW5lU3VnZ2VzdE9wdGlvbnM7XG5cdC8qKlxuXHQgKiBTbWFydCBzZWxlY3Qgb3B0aW9ucy5cblx0ICovXG5cdHNtYXJ0U2VsZWN0PzogSVNtYXJ0U2VsZWN0T3B0aW9ucztcblx0LyoqXG5cdCAqXG5cdCAqL1xuXHRnb3RvTG9jYXRpb24/OiBJR290b0xvY2F0aW9uT3B0aW9ucztcblx0LyoqXG5cdCAqIEVuYWJsZSBxdWljayBzdWdnZXN0aW9ucyAoc2hhZG93IHN1Z2dlc3Rpb25zKVxuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0cXVpY2tTdWdnZXN0aW9ucz86IGJvb2xlYW4gfCBJUXVpY2tTdWdnZXN0aW9uc09wdGlvbnM7XG5cdC8qKlxuXHQgKiBRdWljayBzdWdnZXN0aW9ucyBzaG93IGRlbGF5IChpbiBtcylcblx0ICogRGVmYXVsdHMgdG8gMTAgKG1zKVxuXHQgKi9cblx0cXVpY2tTdWdnZXN0aW9uc0RlbGF5PzogbnVtYmVyO1xuXHQvKipcblx0ICogQ29udHJvbHMgdGhlIHNwYWNpbmcgYXJvdW5kIHRoZSBlZGl0b3IuXG5cdCAqL1xuXHRwYWRkaW5nPzogSUVkaXRvclBhZGRpbmdPcHRpb25zO1xuXHQvKipcblx0ICogUGFyYW1ldGVyIGhpbnQgb3B0aW9ucy5cblx0ICovXG5cdHBhcmFtZXRlckhpbnRzPzogSUVkaXRvclBhcmFtZXRlckhpbnRPcHRpb25zO1xuXHQvKipcblx0ICogT3B0aW9ucyBmb3IgYXV0byBjbG9zaW5nIGJyYWNrZXRzLlxuXHQgKiBEZWZhdWx0cyB0byBsYW5ndWFnZSBkZWZpbmVkIGJlaGF2aW9yLlxuXHQgKi9cblx0YXV0b0Nsb3NpbmdCcmFja2V0cz86IEVkaXRvckF1dG9DbG9zaW5nU3RyYXRlZ3k7XG5cdC8qKlxuXHQgKiBPcHRpb25zIGZvciBhdXRvIGNsb3NpbmcgY29tbWVudHMuXG5cdCAqIERlZmF1bHRzIHRvIGxhbmd1YWdlIGRlZmluZWQgYmVoYXZpb3IuXG5cdCAqL1xuXHRhdXRvQ2xvc2luZ0NvbW1lbnRzPzogRWRpdG9yQXV0b0Nsb3NpbmdTdHJhdGVneTtcblx0LyoqXG5cdCAqIE9wdGlvbnMgZm9yIGF1dG8gY2xvc2luZyBxdW90ZXMuXG5cdCAqIERlZmF1bHRzIHRvIGxhbmd1YWdlIGRlZmluZWQgYmVoYXZpb3IuXG5cdCAqL1xuXHRhdXRvQ2xvc2luZ1F1b3Rlcz86IEVkaXRvckF1dG9DbG9zaW5nU3RyYXRlZ3k7XG5cdC8qKlxuXHQgKiBPcHRpb25zIGZvciBwcmVzc2luZyBiYWNrc3BhY2UgbmVhciBxdW90ZXMgb3IgYnJhY2tldCBwYWlycy5cblx0ICovXG5cdGF1dG9DbG9zaW5nRGVsZXRlPzogRWRpdG9yQXV0b0Nsb3NpbmdFZGl0U3RyYXRlZ3k7XG5cdC8qKlxuXHQgKiBPcHRpb25zIGZvciB0eXBpbmcgb3ZlciBjbG9zaW5nIHF1b3RlcyBvciBicmFja2V0cy5cblx0ICovXG5cdGF1dG9DbG9zaW5nT3ZlcnR5cGU/OiBFZGl0b3JBdXRvQ2xvc2luZ0VkaXRTdHJhdGVneTtcblx0LyoqXG5cdCAqIE9wdGlvbnMgZm9yIGF1dG8gc3Vycm91bmRpbmcuXG5cdCAqIERlZmF1bHRzIHRvIGFsd2F5cyBhbGxvd2luZyBhdXRvIHN1cnJvdW5kaW5nLlxuXHQgKi9cblx0YXV0b1N1cnJvdW5kPzogRWRpdG9yQXV0b1N1cnJvdW5kU3RyYXRlZ3k7XG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSBlZGl0b3Igc2hvdWxkIGF1dG9tYXRpY2FsbHkgYWRqdXN0IHRoZSBpbmRlbnRhdGlvbiB3aGVuIHVzZXJzIHR5cGUsIHBhc3RlLCBtb3ZlIG9yIGluZGVudCBsaW5lcy5cblx0ICogRGVmYXVsdHMgdG8gYWR2YW5jZWQuXG5cdCAqL1xuXHRhdXRvSW5kZW50PzogJ25vbmUnIHwgJ2tlZXAnIHwgJ2JyYWNrZXRzJyB8ICdhZHZhbmNlZCcgfCAnZnVsbCc7XG5cdC8qKlxuXHQgKiBFbXVsYXRlIHNlbGVjdGlvbiBiZWhhdmlvdXIgb2YgdGFiIGNoYXJhY3RlcnMgd2hlbiB1c2luZyBzcGFjZXMgZm9yIGluZGVudGF0aW9uLlxuXHQgKiBUaGlzIG1lYW5zIHNlbGVjdGlvbiB3aWxsIHN0aWNrIHRvIHRhYiBzdG9wcy5cblx0ICovXG5cdHN0aWNreVRhYlN0b3BzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIEVuYWJsZSBmb3JtYXQgb24gdHlwZS5cblx0ICogRGVmYXVsdHMgdG8gZmFsc2UuXG5cdCAqL1xuXHRmb3JtYXRPblR5cGU/OiBib29sZWFuO1xuXHQvKipcblx0ICogRW5hYmxlIGZvcm1hdCBvbiBwYXN0ZS5cblx0ICogRGVmYXVsdHMgdG8gZmFsc2UuXG5cdCAqL1xuXHRmb3JtYXRPblBhc3RlPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIENvbnRyb2xzIGlmIHRoZSBlZGl0b3Igc2hvdWxkIGFsbG93IHRvIG1vdmUgc2VsZWN0aW9ucyB2aWEgZHJhZyBhbmQgZHJvcC5cblx0ICogRGVmYXVsdHMgdG8gZmFsc2UuXG5cdCAqL1xuXHRkcmFnQW5kRHJvcD86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBFbmFibGUgdGhlIHN1Z2dlc3Rpb24gYm94IHRvIHBvcC11cCBvbiB0cmlnZ2VyIGNoYXJhY3RlcnMuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRzdWdnZXN0T25UcmlnZ2VyQ2hhcmFjdGVycz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBBY2NlcHQgc3VnZ2VzdGlvbnMgb24gRU5URVIuXG5cdCAqIERlZmF1bHRzIHRvICdvbicuXG5cdCAqL1xuXHRhY2NlcHRTdWdnZXN0aW9uT25FbnRlcj86ICdvbicgfCAnc21hcnQnIHwgJ29mZic7XG5cdC8qKlxuXHQgKiBBY2NlcHQgc3VnZ2VzdGlvbnMgb24gcHJvdmlkZXIgZGVmaW5lZCBjaGFyYWN0ZXJzLlxuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0YWNjZXB0U3VnZ2VzdGlvbk9uQ29tbWl0Q2hhcmFjdGVyPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIEVuYWJsZSBzbmlwcGV0IHN1Z2dlc3Rpb25zLiBEZWZhdWx0IHRvICd0cnVlJy5cblx0ICovXG5cdHNuaXBwZXRTdWdnZXN0aW9ucz86ICd0b3AnIHwgJ2JvdHRvbScgfCAnaW5saW5lJyB8ICdub25lJztcblx0LyoqXG5cdCAqIENvcHlpbmcgd2l0aG91dCBhIHNlbGVjdGlvbiBjb3BpZXMgdGhlIGN1cnJlbnQgbGluZS5cblx0ICovXG5cdGVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFN5bnRheCBoaWdobGlnaHRpbmcgaXMgY29waWVkLlxuXHQgKi9cblx0Y29weVdpdGhTeW50YXhIaWdobGlnaHRpbmc/OiBib29sZWFuO1xuXHQvKipcblx0ICogVGhlIGhpc3RvcnkgbW9kZSBmb3Igc3VnZ2VzdGlvbnMuXG5cdCAqL1xuXHRzdWdnZXN0U2VsZWN0aW9uPzogJ2ZpcnN0JyB8ICdyZWNlbnRseVVzZWQnIHwgJ3JlY2VudGx5VXNlZEJ5UHJlZml4Jztcblx0LyoqXG5cdCAqIFRoZSBmb250IHNpemUgZm9yIHRoZSBzdWdnZXN0IHdpZGdldC5cblx0ICogRGVmYXVsdHMgdG8gdGhlIGVkaXRvciBmb250IHNpemUuXG5cdCAqL1xuXHRzdWdnZXN0Rm9udFNpemU/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBUaGUgbGluZSBoZWlnaHQgZm9yIHRoZSBzdWdnZXN0IHdpZGdldC5cblx0ICogRGVmYXVsdHMgdG8gdGhlIGVkaXRvciBsaW5lIGhlaWdodC5cblx0ICovXG5cdHN1Z2dlc3RMaW5lSGVpZ2h0PzogbnVtYmVyO1xuXHQvKipcblx0ICogRW5hYmxlIHRhYiBjb21wbGV0aW9uLlxuXHQgKi9cblx0dGFiQ29tcGxldGlvbj86ICdvbicgfCAnb2ZmJyB8ICdvbmx5U25pcHBldHMnO1xuXHQvKipcblx0ICogRW5hYmxlIHNlbGVjdGlvbiBoaWdobGlnaHQuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRzZWxlY3Rpb25IaWdobGlnaHQ/OiBib29sZWFuO1xuXHQvKipcblx0ICogRW5hYmxlIHNlbWFudGljIG9jY3VycmVuY2VzIGhpZ2hsaWdodC5cblx0ICogRGVmYXVsdHMgdG8gJ3NpbmdsZUZpbGUnLlxuXHQgKiAnb2ZmJyBkaXNhYmxlcyBvY2N1cnJlbmNlIGhpZ2hsaWdodGluZ1xuXHQgKiAnc2luZ2xlRmlsZScgdHJpZ2dlcnMgb2NjdXJyZW5jZSBoaWdobGlnaHRpbmcgaW4gdGhlIGN1cnJlbnQgZG9jdW1lbnRcblx0ICogJ211bHRpRmlsZScgIHRyaWdnZXJzIG9jY3VycmVuY2UgaGlnaGxpZ2h0aW5nIGFjcm9zcyB2YWxpZCBvcGVuIGRvY3VtZW50c1xuXHQgKi9cblx0b2NjdXJyZW5jZXNIaWdobGlnaHQ/OiAnb2ZmJyB8ICdzaW5nbGVGaWxlJyB8ICdtdWx0aUZpbGUnO1xuXHQvKipcblx0ICogQ29udHJvbHMgZGVsYXkgZm9yIG9jY3VycmVuY2VzIGhpZ2hsaWdodGluZ1xuXHQgKiBEZWZhdWx0cyB0byAyNTAuXG5cdCAqIE1pbmltdW0gdmFsdWUgaXMgMFxuXHQgKiBNYXhpbXVtIHZhbHVlIGlzIDIwMDBcblx0ICovXG5cdG9jY3VycmVuY2VzSGlnaGxpZ2h0RGVsYXk/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBTaG93IGNvZGUgbGVuc1xuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0Y29kZUxlbnM/OiBib29sZWFuO1xuXHQvKipcblx0ICogQ29kZSBsZW5zIGZvbnQgZmFtaWx5LiBEZWZhdWx0cyB0byBlZGl0b3IgZm9udCBmYW1pbHkuXG5cdCAqL1xuXHRjb2RlTGVuc0ZvbnRGYW1pbHk/OiBzdHJpbmc7XG5cdC8qKlxuXHQgKiBDb2RlIGxlbnMgZm9udCBzaXplLiBEZWZhdWx0IHRvIDkwJSBvZiB0aGUgZWRpdG9yIGZvbnQgc2l6ZVxuXHQgKi9cblx0Y29kZUxlbnNGb250U2l6ZT86IG51bWJlcjtcblx0LyoqXG5cdCAqIENvbnRyb2wgdGhlIGJlaGF2aW9yIGFuZCByZW5kZXJpbmcgb2YgdGhlIGNvZGUgYWN0aW9uIGxpZ2h0YnVsYi5cblx0ICovXG5cdGxpZ2h0YnVsYj86IElFZGl0b3JMaWdodGJ1bGJPcHRpb25zO1xuXHQvKipcblx0ICogVGltZW91dCBmb3IgcnVubmluZyBjb2RlIGFjdGlvbnMgb24gc2F2ZS5cblx0ICovXG5cdGNvZGVBY3Rpb25zT25TYXZlVGltZW91dD86IG51bWJlcjtcblx0LyoqXG5cdCAqIEVuYWJsZSBjb2RlIGZvbGRpbmcuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRmb2xkaW5nPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFNlbGVjdHMgdGhlIGZvbGRpbmcgc3RyYXRlZ3kuICdhdXRvJyB1c2VzIHRoZSBzdHJhdGVnaWVzIGNvbnRyaWJ1dGVkIGZvciB0aGUgY3VycmVudCBkb2N1bWVudCwgJ2luZGVudGF0aW9uJyB1c2VzIHRoZSBpbmRlbnRhdGlvbiBiYXNlZCBmb2xkaW5nIHN0cmF0ZWd5LlxuXHQgKiBEZWZhdWx0cyB0byAnYXV0bycuXG5cdCAqL1xuXHRmb2xkaW5nU3RyYXRlZ3k/OiAnYXV0bycgfCAnaW5kZW50YXRpb24nO1xuXHQvKipcblx0ICogRW5hYmxlIGhpZ2hsaWdodCBmb3IgZm9sZGVkIHJlZ2lvbnMuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRmb2xkaW5nSGlnaGxpZ2h0PzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIEF1dG8gZm9sZCBpbXBvcnRzIGZvbGRpbmcgcmVnaW9ucy5cblx0ICogRGVmYXVsdHMgdG8gdHJ1ZS5cblx0ICovXG5cdGZvbGRpbmdJbXBvcnRzQnlEZWZhdWx0PzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIE1heGltdW0gbnVtYmVyIG9mIGZvbGRhYmxlIHJlZ2lvbnMuXG5cdCAqIERlZmF1bHRzIHRvIDUwMDAuXG5cdCAqL1xuXHRmb2xkaW5nTWF4aW11bVJlZ2lvbnM/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSBmb2xkIGFjdGlvbnMgaW4gdGhlIGd1dHRlciBzdGF5IGFsd2F5cyB2aXNpYmxlIG9yIGhpZGUgdW5sZXNzIHRoZSBtb3VzZSBpcyBvdmVyIHRoZSBndXR0ZXIuXG5cdCAqIERlZmF1bHRzIHRvICdtb3VzZW92ZXInLlxuXHQgKi9cblx0c2hvd0ZvbGRpbmdDb250cm9scz86ICdhbHdheXMnIHwgJ25ldmVyJyB8ICdtb3VzZW92ZXInO1xuXHQvKipcblx0ICogQ29udHJvbHMgd2hldGhlciBjbGlja2luZyBvbiB0aGUgZW1wdHkgY29udGVudCBhZnRlciBhIGZvbGRlZCBsaW5lIHdpbGwgdW5mb2xkIHRoZSBsaW5lLlxuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0ICovXG5cdHVuZm9sZE9uQ2xpY2tBZnRlckVuZE9mTGluZT86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBFbmFibGUgaGlnaGxpZ2h0aW5nIG9mIG1hdGNoaW5nIGJyYWNrZXRzLlxuXHQgKiBEZWZhdWx0cyB0byAnYWx3YXlzJy5cblx0ICovXG5cdG1hdGNoQnJhY2tldHM/OiAnbmV2ZXInIHwgJ25lYXInIHwgJ2Fsd2F5cyc7XG5cdC8qKlxuXHQgKiBFbmFibGUgZXhwZXJpbWVudGFsIHJlbmRlcmluZyB1c2luZyBXZWJHUFUuXG5cdCAqIERlZmF1bHRzIHRvICdvZmYnLlxuXHQgKi9cblx0ZXhwZXJpbWVudGFsR3B1QWNjZWxlcmF0aW9uPzogJ29uJyB8ICdvZmYnO1xuXHQvKipcblx0ICogRW5hYmxlIGV4cGVyaW1lbnRhbCB3aGl0ZXNwYWNlIHJlbmRlcmluZy5cblx0ICogRGVmYXVsdHMgdG8gJ3N2ZycuXG5cdCAqL1xuXHRleHBlcmltZW50YWxXaGl0ZXNwYWNlUmVuZGVyaW5nPzogJ3N2ZycgfCAnZm9udCcgfCAnb2ZmJztcblx0LyoqXG5cdCAqIEVuYWJsZSByZW5kZXJpbmcgb2Ygd2hpdGVzcGFjZS5cblx0ICogRGVmYXVsdHMgdG8gJ3NlbGVjdGlvbicuXG5cdCAqL1xuXHRyZW5kZXJXaGl0ZXNwYWNlPzogJ25vbmUnIHwgJ2JvdW5kYXJ5JyB8ICdzZWxlY3Rpb24nIHwgJ3RyYWlsaW5nJyB8ICdhbGwnO1xuXHQvKipcblx0ICogRW5hYmxlIHJlbmRlcmluZyBvZiBjb250cm9sIGNoYXJhY3RlcnMuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRyZW5kZXJDb250cm9sQ2hhcmFjdGVycz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBFbmFibGUgcmVuZGVyaW5nIG9mIGN1cnJlbnQgbGluZSBoaWdobGlnaHQuXG5cdCAqIERlZmF1bHRzIHRvIGFsbC5cblx0ICovXG5cdHJlbmRlckxpbmVIaWdobGlnaHQ/OiAnbm9uZScgfCAnZ3V0dGVyJyB8ICdsaW5lJyB8ICdhbGwnO1xuXHQvKipcblx0ICogQ29udHJvbCBpZiB0aGUgY3VycmVudCBsaW5lIGhpZ2hsaWdodCBzaG91bGQgYmUgcmVuZGVyZWQgb25seSB0aGUgZWRpdG9yIGlzIGZvY3VzZWQuXG5cdCAqIERlZmF1bHRzIHRvIGZhbHNlLlxuXHQgKi9cblx0cmVuZGVyTGluZUhpZ2hsaWdodE9ubHlXaGVuRm9jdXM/OiBib29sZWFuO1xuXHQvKipcblx0ICogSW5zZXJ0aW5nIGFuZCBkZWxldGluZyB3aGl0ZXNwYWNlIGZvbGxvd3MgdGFiIHN0b3BzLlxuXHQgKi9cblx0dXNlVGFiU3RvcHM/OiBib29sZWFuO1xuXHQvKipcblx0ICogVGhlIGZvbnQgZmFtaWx5XG5cdCAqL1xuXHRmb250RmFtaWx5Pzogc3RyaW5nO1xuXHQvKipcblx0ICogVGhlIGZvbnQgd2VpZ2h0XG5cdCAqL1xuXHRmb250V2VpZ2h0Pzogc3RyaW5nO1xuXHQvKipcblx0ICogVGhlIGZvbnQgc2l6ZVxuXHQgKi9cblx0Zm9udFNpemU/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBUaGUgbGluZSBoZWlnaHRcblx0ICovXG5cdGxpbmVIZWlnaHQ/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBUaGUgbGV0dGVyIHNwYWNpbmdcblx0ICovXG5cdGxldHRlclNwYWNpbmc/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBDb250cm9scyBmYWRpbmcgb3V0IG9mIHVudXNlZCB2YXJpYWJsZXMuXG5cdCAqL1xuXHRzaG93VW51c2VkPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdG8gZm9jdXMgdGhlIGlubGluZSBlZGl0b3IgaW4gdGhlIHBlZWsgd2lkZ2V0IGJ5IGRlZmF1bHQuXG5cdCAqIERlZmF1bHRzIHRvIGZhbHNlLlxuXHQgKi9cblx0cGVla1dpZGdldERlZmF1bHRGb2N1cz86ICd0cmVlJyB8ICdlZGl0b3InO1xuXG5cdC8qKlxuXHQgKiBTZXRzIGEgcGxhY2Vob2xkZXIgZm9yIHRoZSBlZGl0b3IuXG5cdCAqIElmIHNldCwgdGhlIHBsYWNlaG9sZGVyIGlzIHNob3duIGlmIHRoZSBlZGl0b3IgaXMgZW1wdHkuXG5cdCovXG5cdHBsYWNlaG9sZGVyPzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSBkZWZpbml0aW9uIGxpbmsgb3BlbnMgZWxlbWVudCBpbiB0aGUgcGVlayB3aWRnZXQuXG5cdCAqIERlZmF1bHRzIHRvIGZhbHNlLlxuXHQgKi9cblx0ZGVmaW5pdGlvbkxpbmtPcGVuc0luUGVlaz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBDb250cm9scyBzdHJpa2V0aHJvdWdoIGRlcHJlY2F0ZWQgdmFyaWFibGVzLlxuXHQgKi9cblx0c2hvd0RlcHJlY2F0ZWQ/OiBib29sZWFuO1xuXHQvKipcblx0ICogQ29udHJvbHMgd2hldGhlciBzdWdnZXN0aW9ucyBhbGxvdyBtYXRjaGVzIGluIHRoZSBtaWRkbGUgb2YgdGhlIHdvcmQgaW5zdGVhZCBvZiBvbmx5IGF0IHRoZSBiZWdpbm5pbmdcblx0ICovXG5cdG1hdGNoT25Xb3JkU3RhcnRPbmx5PzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIENvbnRyb2wgdGhlIGJlaGF2aW9yIGFuZCByZW5kZXJpbmcgb2YgdGhlIGlubGluZSBoaW50cy5cblx0ICovXG5cdGlubGF5SGludHM/OiBJRWRpdG9ySW5sYXlIaW50c09wdGlvbnM7XG5cdC8qKlxuXHQgKiBDb250cm9sIGlmIHRoZSBlZGl0b3Igc2hvdWxkIHVzZSBzaGFkb3cgRE9NLlxuXHQgKi9cblx0dXNlU2hhZG93RE9NPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIENvbnRyb2xzIHRoZSBiZWhhdmlvciBvZiBlZGl0b3IgZ3VpZGVzLlxuXHQqL1xuXHRndWlkZXM/OiBJR3VpZGVzT3B0aW9ucztcblxuXHQvKipcblx0ICogQ29udHJvbHMgdGhlIGJlaGF2aW9yIG9mIHRoZSB1bmljb2RlIGhpZ2hsaWdodCBmZWF0dXJlXG5cdCAqIChieSBkZWZhdWx0LCBhbWJpZ3VvdXMgYW5kIGludmlzaWJsZSBjaGFyYWN0ZXJzIGFyZSBoaWdobGlnaHRlZCkuXG5cdCAqL1xuXHR1bmljb2RlSGlnaGxpZ2h0PzogSVVuaWNvZGVIaWdobGlnaHRPcHRpb25zO1xuXG5cdC8qKlxuXHQgKiBDb25maWd1cmVzIGJyYWNrZXQgcGFpciBjb2xvcml6YXRpb24gKGRpc2FibGVkIGJ5IGRlZmF1bHQpLlxuXHQqL1xuXHRicmFja2V0UGFpckNvbG9yaXphdGlvbj86IElCcmFja2V0UGFpckNvbG9yaXphdGlvbk9wdGlvbnM7XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIGRyb3BwaW5nIGludG8gdGhlIGVkaXRvciBmcm9tIGFuIGV4dGVybmFsIHNvdXJjZS5cblx0ICpcblx0ICogV2hlbiBlbmFibGVkLCB0aGlzIHNob3dzIGEgcHJldmlldyBvZiB0aGUgZHJvcCBsb2NhdGlvbiBhbmQgdHJpZ2dlcnMgYW4gYG9uRHJvcEludG9FZGl0b3JgIGV2ZW50LlxuXHQgKi9cblx0ZHJvcEludG9FZGl0b3I/OiBJRHJvcEludG9FZGl0b3JPcHRpb25zO1xuXG5cdC8qKlxuXHQgKiBTZXRzIHdoZXRoZXIgdGhlIG5ldyBleHBlcmltZW50YWwgZWRpdCBjb250ZXh0IHNob3VsZCBiZSB1c2VkIGluc3RlYWQgb2YgdGhlIHRleHQgYXJlYS5cblx0ICovXG5cdGV4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZD86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIHN1cHBvcnQgZm9yIGNoYW5naW5nIGhvdyBjb250ZW50IGlzIHBhc3RlZCBpbnRvIHRoZSBlZGl0b3IuXG5cdCAqL1xuXHRwYXN0ZUFzPzogSVBhc3RlQXNPcHRpb25zO1xuXG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSBlZGl0b3IgLyB0ZXJtaW5hbCByZWNlaXZlcyB0YWJzIG9yIGRlZmVycyB0aGVtIHRvIHRoZSB3b3JrYmVuY2ggZm9yIG5hdmlnYXRpb24uXG5cdCAqL1xuXHR0YWJGb2N1c01vZGU/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSBhY2Nlc3NpYmlsaXR5IGhpbnQgc2hvdWxkIGJlIHByb3ZpZGVkIHRvIHNjcmVlbiByZWFkZXIgdXNlcnMgd2hlbiBhbiBpbmxpbmUgY29tcGxldGlvbiBpcyBzaG93bi5cblx0ICovXG5cdGlubGluZUNvbXBsZXRpb25zQWNjZXNzaWJpbGl0eVZlcmJvc2U/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICogVGhlIHdpZHRoIG9mIHRoZSBtaW5pbWFwIGd1dHRlciwgaW4gcGl4ZWxzLlxuICovXG5leHBvcnQgY29uc3QgTUlOSU1BUF9HVVRURVJfV0lEVEggPSA4O1xuXG5leHBvcnQgaW50ZXJmYWNlIElEaWZmRWRpdG9yQmFzZU9wdGlvbnMge1xuXHQvKipcblx0ICogQWxsb3cgdGhlIHVzZXIgdG8gcmVzaXplIHRoZSBkaWZmIGVkaXRvciBzcGxpdCB2aWV3LlxuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0ZW5hYmxlU3BsaXRWaWV3UmVzaXppbmc/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBUaGUgZGVmYXVsdCByYXRpbyB3aGVuIHJlbmRlcmluZyBzaWRlLWJ5LXNpZGUgZWRpdG9ycy5cblx0ICogTXVzdCBiZSBhIG51bWJlciBiZXR3ZWVuIDAgYW5kIDEsIG1pbiBzaXplcyBhcHBseS5cblx0ICogRGVmYXVsdHMgdG8gMC41XG5cdCAqL1xuXHRzcGxpdFZpZXdEZWZhdWx0UmF0aW8/OiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIFJlbmRlciB0aGUgZGlmZmVyZW5jZXMgaW4gdHdvIHNpZGUtYnktc2lkZSBlZGl0b3JzLlxuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0cmVuZGVyU2lkZUJ5U2lkZT86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFdoZW4gYHJlbmRlclNpZGVCeVNpZGVgIGlzIGVuYWJsZWQsIGB1c2VJbmxpbmVWaWV3V2hlblNwYWNlSXNMaW1pdGVkYCBpcyBzZXQsXG5cdCAqIGFuZCB0aGUgZGlmZiBlZGl0b3IgaGFzIGEgd2lkdGggbGVzcyB0aGFuIGByZW5kZXJTaWRlQnlTaWRlSW5saW5lQnJlYWtwb2ludGAsIHRoZSBpbmxpbmUgdmlldyBpcyB1c2VkLlxuXHQgKi9cblx0cmVuZGVyU2lkZUJ5U2lkZUlubGluZUJyZWFrcG9pbnQ/OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cblx0LyoqXG5cdCAqIFdoZW4gYHJlbmRlclNpZGVCeVNpZGVgIGlzIGVuYWJsZWQsIGB1c2VJbmxpbmVWaWV3V2hlblNwYWNlSXNMaW1pdGVkYCBpcyBzZXQsXG5cdCAqIGFuZCB0aGUgZGlmZiBlZGl0b3IgaGFzIGEgd2lkdGggbGVzcyB0aGFuIGByZW5kZXJTaWRlQnlTaWRlSW5saW5lQnJlYWtwb2ludGAsIHRoZSBpbmxpbmUgdmlldyBpcyB1c2VkLlxuXHQgKi9cblx0dXNlSW5saW5lVmlld1doZW5TcGFjZUlzTGltaXRlZD86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIElmIHNldCwgdGhlIGRpZmYgZWRpdG9yIGlzIG9wdGltaXplZCBmb3Igc21hbGwgdmlld3MuXG5cdCAqIERlZmF1bHRzIHRvIGBmYWxzZWAuXG5cdCovXG5cdGNvbXBhY3RNb2RlPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogVGltZW91dCBpbiBtaWxsaXNlY29uZHMgYWZ0ZXIgd2hpY2ggZGlmZiBjb21wdXRhdGlvbiBpcyBjYW5jZWxsZWQuXG5cdCAqIERlZmF1bHRzIHRvIDUwMDAuXG5cdCAqL1xuXHRtYXhDb21wdXRhdGlvblRpbWU/OiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIE1heGltdW0gc3VwcG9ydGVkIGZpbGUgc2l6ZSBpbiBNQi5cblx0ICogRGVmYXVsdHMgdG8gNTAuXG5cdCAqL1xuXHRtYXhGaWxlU2l6ZT86IG51bWJlcjtcblxuXHQvKipcblx0ICogQ29tcHV0ZSB0aGUgZGlmZiBieSBpZ25vcmluZyBsZWFkaW5nL3RyYWlsaW5nIHdoaXRlc3BhY2Vcblx0ICogRGVmYXVsdHMgdG8gdHJ1ZS5cblx0ICovXG5cdGlnbm9yZVRyaW1XaGl0ZXNwYWNlPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogUmVuZGVyICsvLSBpbmRpY2F0b3JzIGZvciBhZGRlZC9kZWxldGVkIGNoYW5nZXMuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRyZW5kZXJJbmRpY2F0b3JzPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogU2hvd3MgaWNvbnMgaW4gdGhlIGdseXBoIG1hcmdpbiB0byByZXZlcnQgY2hhbmdlcy5cblx0ICogRGVmYXVsdCB0byB0cnVlLlxuXHQgKi9cblx0cmVuZGVyTWFyZ2luUmV2ZXJ0SWNvbj86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIEluZGljYXRlcyBpZiB0aGUgZ3V0dGVyIG1lbnUgc2hvdWxkIGJlIHJlbmRlcmVkLlxuXHQqL1xuXHRyZW5kZXJHdXR0ZXJNZW51PzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogT3JpZ2luYWwgbW9kZWwgc2hvdWxkIGJlIGVkaXRhYmxlP1xuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0ICovXG5cdG9yaWdpbmFsRWRpdGFibGU/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBTaG91bGQgdGhlIGRpZmYgZWRpdG9yIGVuYWJsZSBjb2RlIGxlbnM/XG5cdCAqIERlZmF1bHRzIHRvIGZhbHNlLlxuXHQgKi9cblx0ZGlmZkNvZGVMZW5zPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogSXMgdGhlIGRpZmYgZWRpdG9yIHNob3VsZCByZW5kZXIgb3ZlcnZpZXcgcnVsZXJcblx0ICogRGVmYXVsdHMgdG8gdHJ1ZVxuXHQgKi9cblx0cmVuZGVyT3ZlcnZpZXdSdWxlcj86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIENvbnRyb2wgdGhlIHdyYXBwaW5nIG9mIHRoZSBkaWZmIGVkaXRvci5cblx0ICovXG5cdGRpZmZXb3JkV3JhcD86ICdvZmYnIHwgJ29uJyB8ICdpbmhlcml0JztcblxuXHQvKipcblx0ICogRGlmZiBBbGdvcml0aG1cblx0Ki9cblx0ZGlmZkFsZ29yaXRobT86ICdsZWdhY3knIHwgJ2FkdmFuY2VkJztcblxuXHQvKipcblx0ICogV2hldGhlciB0aGUgZGlmZiBlZGl0b3IgYXJpYSBsYWJlbCBzaG91bGQgYmUgdmVyYm9zZS5cblx0ICovXG5cdGFjY2Vzc2liaWxpdHlWZXJib3NlPzogYm9vbGVhbjtcblxuXHRleHBlcmltZW50YWw/OiB7XG5cdFx0LyoqXG5cdFx0ICogRGVmYXVsdHMgdG8gZmFsc2UuXG5cdFx0ICovXG5cdFx0c2hvd01vdmVzPzogYm9vbGVhbjtcblxuXHRcdHNob3dFbXB0eURlY29yYXRpb25zPzogYm9vbGVhbjtcblxuXHRcdC8qKlxuXHRcdCAqIE9ubHkgYXBwbGllcyB3aGVuIGByZW5kZXJTaWRlQnlTaWRlYCBpcyBzZXQgdG8gZmFsc2UuXG5cdFx0Ki9cblx0XHR1c2VUcnVlSW5saW5lVmlldz86IGJvb2xlYW47XG5cdH07XG5cblx0LyoqXG5cdCAqIElzIHRoZSBkaWZmIGVkaXRvciBpbnNpZGUgYW5vdGhlciBlZGl0b3Jcblx0ICogRGVmYXVsdHMgdG8gZmFsc2Vcblx0ICovXG5cdGlzSW5FbWJlZGRlZEVkaXRvcj86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIElmIHRoZSBkaWZmIGVkaXRvciBzaG91bGQgb25seSBzaG93IHRoZSBkaWZmZXJlbmNlIHJldmlldyBtb2RlLlxuXHQgKi9cblx0b25seVNob3dBY2Nlc3NpYmxlRGlmZlZpZXdlcj86IGJvb2xlYW47XG5cblx0aGlkZVVuY2hhbmdlZFJlZ2lvbnM/OiB7XG5cdFx0ZW5hYmxlZD86IGJvb2xlYW47XG5cdFx0cmV2ZWFsTGluZUNvdW50PzogbnVtYmVyO1xuXHRcdG1pbmltdW1MaW5lQ291bnQ/OiBudW1iZXI7XG5cdFx0Y29udGV4dExpbmVDb3VudD86IG51bWJlcjtcblx0fTtcbn1cblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBkaWZmIGVkaXRvci5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJRGlmZkVkaXRvck9wdGlvbnMgZXh0ZW5kcyBJRWRpdG9yT3B0aW9ucywgSURpZmZFZGl0b3JCYXNlT3B0aW9ucyB7XG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCB0eXBlIFZhbGlkRGlmZkVkaXRvckJhc2VPcHRpb25zID0gUmVhZG9ubHk8UmVxdWlyZWQ8SURpZmZFZGl0b3JCYXNlT3B0aW9ucz4+O1xuXG4vLyNlbmRyZWdpb25cblxuLyoqXG4gKiBBbiBldmVudCBkZXNjcmliaW5nIHRoYXQgdGhlIGNvbmZpZ3VyYXRpb24gb2YgdGhlIGVkaXRvciBoYXMgY2hhbmdlZC5cbiAqL1xuZXhwb3J0IGNsYXNzIENvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQge1xuXHRwcml2YXRlIHJlYWRvbmx5IF92YWx1ZXM6IGJvb2xlYW5bXTtcblx0LyoqXG5cdCAqIEBpbnRlcm5hbFxuXHQgKi9cblx0Y29uc3RydWN0b3IodmFsdWVzOiBib29sZWFuW10pIHtcblx0XHR0aGlzLl92YWx1ZXMgPSB2YWx1ZXM7XG5cdH1cblx0cHVibGljIGhhc0NoYW5nZWQoaWQ6IEVkaXRvck9wdGlvbik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl92YWx1ZXNbaWRdO1xuXHR9XG59XG5cbi8qKlxuICogQWxsIGNvbXB1dGVkIGVkaXRvciBvcHRpb25zLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElDb21wdXRlZEVkaXRvck9wdGlvbnMge1xuXHRnZXQ8VCBleHRlbmRzIEVkaXRvck9wdGlvbj4oaWQ6IFQpOiBGaW5kQ29tcHV0ZWRFZGl0b3JPcHRpb25WYWx1ZUJ5SWQ8VD47XG59XG5cbi8vI3JlZ2lvbiBJRWRpdG9yT3B0aW9uXG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSUVudmlyb25tZW50YWxPcHRpb25zIHtcblx0cmVhZG9ubHkgbWVtb3J5OiBDb21wdXRlT3B0aW9uc01lbW9yeSB8IG51bGw7XG5cdHJlYWRvbmx5IG91dGVyV2lkdGg6IG51bWJlcjtcblx0cmVhZG9ubHkgb3V0ZXJIZWlnaHQ6IG51bWJlcjtcblx0cmVhZG9ubHkgZm9udEluZm86IEZvbnRJbmZvO1xuXHRyZWFkb25seSBleHRyYUVkaXRvckNsYXNzTmFtZTogc3RyaW5nO1xuXHRyZWFkb25seSBpc0RvbWluYXRlZEJ5TG9uZ0xpbmVzOiBib29sZWFuO1xuXHRyZWFkb25seSB2aWV3TGluZUNvdW50OiBudW1iZXI7XG5cdHJlYWRvbmx5IGxpbmVOdW1iZXJzRGlnaXRDb3VudDogbnVtYmVyO1xuXHRyZWFkb25seSBlbXB0eVNlbGVjdGlvbkNsaXBib2FyZDogYm9vbGVhbjtcblx0cmVhZG9ubHkgcGl4ZWxSYXRpbzogbnVtYmVyO1xuXHRyZWFkb25seSB0YWJGb2N1c01vZGU6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGlucHV0TW9kZTogJ2luc2VydCcgfCAnb3ZlcnR5cGUnO1xuXHRyZWFkb25seSBhY2Nlc3NpYmlsaXR5U3VwcG9ydDogQWNjZXNzaWJpbGl0eVN1cHBvcnQ7XG5cdHJlYWRvbmx5IGdseXBoTWFyZ2luRGVjb3JhdGlvbkxhbmVDb3VudDogbnVtYmVyO1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgY2xhc3MgQ29tcHV0ZU9wdGlvbnNNZW1vcnkge1xuXG5cdHB1YmxpYyBzdGFibGVNaW5pbWFwTGF5b3V0SW5wdXQ6IElNaW5pbWFwTGF5b3V0SW5wdXQgfCBudWxsO1xuXHRwdWJsaWMgc3RhYmxlRml0TWF4TWluaW1hcFNjYWxlOiBudW1iZXI7XG5cdHB1YmxpYyBzdGFibGVGaXRSZW1haW5pbmdXaWR0aDogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuc3RhYmxlTWluaW1hcExheW91dElucHV0ID0gbnVsbDtcblx0XHR0aGlzLnN0YWJsZUZpdE1heE1pbmltYXBTY2FsZSA9IDA7XG5cdFx0dGhpcy5zdGFibGVGaXRSZW1haW5pbmdXaWR0aCA9IDA7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRWRpdG9yT3B0aW9uPEsgZXh0ZW5kcyBFZGl0b3JPcHRpb24sIFY+IHtcblx0cmVhZG9ubHkgaWQ6IEs7XG5cdHJlYWRvbmx5IG5hbWU6IHN0cmluZztcblx0ZGVmYXVsdFZhbHVlOiBWO1xuXHQvKipcblx0ICogQGludGVybmFsXG5cdCAqL1xuXHRyZWFkb25seSBzY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgfCB7IFtwYXRoOiBzdHJpbmddOiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hIH0gfCB1bmRlZmluZWQ7XG5cdC8qKlxuXHQgKiBAaW50ZXJuYWxcblx0ICovXG5cdHZhbGlkYXRlKGlucHV0OiBhbnkpOiBWO1xuXHQvKipcblx0ICogQGludGVybmFsXG5cdCAqL1xuXHRjb21wdXRlKGVudjogSUVudmlyb25tZW50YWxPcHRpb25zLCBvcHRpb25zOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zLCB2YWx1ZTogVik6IFY7XG5cblx0LyoqXG5cdCAqIE1pZ2h0IG1vZGlmeSBgdmFsdWVgLlxuXHQqL1xuXHRhcHBseVVwZGF0ZSh2YWx1ZTogViB8IHVuZGVmaW5lZCwgdXBkYXRlOiBWKTogQXBwbHlVcGRhdGVSZXN1bHQ8Vj47XG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbnR5cGUgUG9zc2libGVLZXlOYW1lMDxWPiA9IHsgW0sgaW4ga2V5b2YgSUVkaXRvck9wdGlvbnNdOiBJRWRpdG9yT3B0aW9uc1tLXSBleHRlbmRzIFYgfCB1bmRlZmluZWQgPyBLIDogbmV2ZXIgfVtrZXlvZiBJRWRpdG9yT3B0aW9uc107XG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG50eXBlIFBvc3NpYmxlS2V5TmFtZTxWPiA9IE5vbk51bGxhYmxlPFBvc3NpYmxlS2V5TmFtZTA8Vj4+O1xuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5hYnN0cmFjdCBjbGFzcyBCYXNlRWRpdG9yT3B0aW9uPEsgZXh0ZW5kcyBFZGl0b3JPcHRpb24sIFQsIFY+IGltcGxlbWVudHMgSUVkaXRvck9wdGlvbjxLLCBWPiB7XG5cblx0cHVibGljIHJlYWRvbmx5IGlkOiBLO1xuXHRwdWJsaWMgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuXHRwdWJsaWMgcmVhZG9ubHkgZGVmYXVsdFZhbHVlOiBWO1xuXHRwdWJsaWMgcmVhZG9ubHkgc2NoZW1hOiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hIHwgeyBbcGF0aDogc3RyaW5nXTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSB9IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKGlkOiBLLCBuYW1lOiBQb3NzaWJsZUtleU5hbWU8VD4sIGRlZmF1bHRWYWx1ZTogViwgc2NoZW1hPzogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSB8IHsgW3BhdGg6IHN0cmluZ106IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgfSkge1xuXHRcdHRoaXMuaWQgPSBpZDtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMuZGVmYXVsdFZhbHVlID0gZGVmYXVsdFZhbHVlO1xuXHRcdHRoaXMuc2NoZW1hID0gc2NoZW1hO1xuXHR9XG5cblx0cHVibGljIGFwcGx5VXBkYXRlKHZhbHVlOiBWIHwgdW5kZWZpbmVkLCB1cGRhdGU6IFYpOiBBcHBseVVwZGF0ZVJlc3VsdDxWPiB7XG5cdFx0cmV0dXJuIGFwcGx5VXBkYXRlKHZhbHVlLCB1cGRhdGUpO1xuXHR9XG5cblx0cHVibGljIGFic3RyYWN0IHZhbGlkYXRlKGlucHV0OiBhbnkpOiBWO1xuXG5cdHB1YmxpYyBjb21wdXRlKGVudjogSUVudmlyb25tZW50YWxPcHRpb25zLCBvcHRpb25zOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zLCB2YWx1ZTogVik6IFYge1xuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQXBwbHlVcGRhdGVSZXN1bHQ8VD4ge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgbmV3VmFsdWU6IFQsXG5cdFx0cHVibGljIHJlYWRvbmx5IGRpZENoYW5nZTogYm9vbGVhblxuXHQpIHsgfVxufVxuXG5mdW5jdGlvbiBhcHBseVVwZGF0ZTxUPih2YWx1ZTogVCB8IHVuZGVmaW5lZCwgdXBkYXRlOiBUKTogQXBwbHlVcGRhdGVSZXN1bHQ8VD4ge1xuXHRpZiAodHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JyB8fCB0eXBlb2YgdXBkYXRlICE9PSAnb2JqZWN0JyB8fCAhdmFsdWUgfHwgIXVwZGF0ZSkge1xuXHRcdHJldHVybiBuZXcgQXBwbHlVcGRhdGVSZXN1bHQodXBkYXRlLCB2YWx1ZSAhPT0gdXBkYXRlKTtcblx0fVxuXHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgfHwgQXJyYXkuaXNBcnJheSh1cGRhdGUpKSB7XG5cdFx0Y29uc3QgYXJyYXlFcXVhbHMgPSBBcnJheS5pc0FycmF5KHZhbHVlKSAmJiBBcnJheS5pc0FycmF5KHVwZGF0ZSkgJiYgYXJyYXlzLmVxdWFscyh2YWx1ZSwgdXBkYXRlKTtcblx0XHRyZXR1cm4gbmV3IEFwcGx5VXBkYXRlUmVzdWx0KHVwZGF0ZSwgIWFycmF5RXF1YWxzKTtcblx0fVxuXHRsZXQgZGlkQ2hhbmdlID0gZmFsc2U7XG5cdGZvciAoY29uc3Qga2V5IGluIHVwZGF0ZSkge1xuXHRcdGlmICgodXBkYXRlIGFzIFQgJiBvYmplY3QpLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGFwcGx5VXBkYXRlKHZhbHVlW2tleV0sIHVwZGF0ZVtrZXldKTtcblx0XHRcdGlmIChyZXN1bHQuZGlkQ2hhbmdlKSB7XG5cdFx0XHRcdHZhbHVlW2tleV0gPSByZXN1bHQubmV3VmFsdWU7XG5cdFx0XHRcdGRpZENoYW5nZSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiBuZXcgQXBwbHlVcGRhdGVSZXN1bHQodmFsdWUsIGRpZENoYW5nZSk7XG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmFic3RyYWN0IGNsYXNzIENvbXB1dGVkRWRpdG9yT3B0aW9uPEsgZXh0ZW5kcyBFZGl0b3JPcHRpb24sIFY+IGltcGxlbWVudHMgSUVkaXRvck9wdGlvbjxLLCBWPiB7XG5cblx0cHVibGljIHJlYWRvbmx5IGlkOiBLO1xuXHRwdWJsaWMgcmVhZG9ubHkgbmFtZTogJ19uZXZlcl8nO1xuXHRwdWJsaWMgcmVhZG9ubHkgZGVmYXVsdFZhbHVlOiBWO1xuXHRwdWJsaWMgcmVhZG9ubHkgc2NoZW1hOiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKGlkOiBLKSB7XG5cdFx0dGhpcy5pZCA9IGlkO1xuXHRcdHRoaXMubmFtZSA9ICdfbmV2ZXJfJztcblx0XHR0aGlzLmRlZmF1bHRWYWx1ZSA9IDxhbnk+dW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIGFwcGx5VXBkYXRlKHZhbHVlOiBWIHwgdW5kZWZpbmVkLCB1cGRhdGU6IFYpOiBBcHBseVVwZGF0ZVJlc3VsdDxWPiB7XG5cdFx0cmV0dXJuIGFwcGx5VXBkYXRlKHZhbHVlLCB1cGRhdGUpO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKGlucHV0OiBhbnkpOiBWIHtcblx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0VmFsdWU7XG5cdH1cblxuXHRwdWJsaWMgYWJzdHJhY3QgY29tcHV0ZShlbnY6IElFbnZpcm9ubWVudGFsT3B0aW9ucywgb3B0aW9uczogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucywgdmFsdWU6IFYpOiBWO1xufVxuXG5jbGFzcyBTaW1wbGVFZGl0b3JPcHRpb248SyBleHRlbmRzIEVkaXRvck9wdGlvbiwgVj4gaW1wbGVtZW50cyBJRWRpdG9yT3B0aW9uPEssIFY+IHtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaWQ6IEs7XG5cdHB1YmxpYyByZWFkb25seSBuYW1lOiBQb3NzaWJsZUtleU5hbWU8Vj47XG5cdHB1YmxpYyByZWFkb25seSBkZWZhdWx0VmFsdWU6IFY7XG5cdHB1YmxpYyByZWFkb25seSBzY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoaWQ6IEssIG5hbWU6IFBvc3NpYmxlS2V5TmFtZTxWPiwgZGVmYXVsdFZhbHVlOiBWLCBzY2hlbWE/OiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hKSB7XG5cdFx0dGhpcy5pZCA9IGlkO1xuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0dGhpcy5kZWZhdWx0VmFsdWUgPSBkZWZhdWx0VmFsdWU7XG5cdFx0dGhpcy5zY2hlbWEgPSBzY2hlbWE7XG5cdH1cblxuXHRwdWJsaWMgYXBwbHlVcGRhdGUodmFsdWU6IFYgfCB1bmRlZmluZWQsIHVwZGF0ZTogVik6IEFwcGx5VXBkYXRlUmVzdWx0PFY+IHtcblx0XHRyZXR1cm4gYXBwbHlVcGRhdGUodmFsdWUsIHVwZGF0ZSk7XG5cdH1cblxuXHRwdWJsaWMgdmFsaWRhdGUoaW5wdXQ6IGFueSk6IFYge1xuXHRcdGlmICh0eXBlb2YgaW5wdXQgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0VmFsdWU7XG5cdFx0fVxuXHRcdHJldHVybiBpbnB1dCBhcyBhbnk7XG5cdH1cblxuXHRwdWJsaWMgY29tcHV0ZShlbnY6IElFbnZpcm9ubWVudGFsT3B0aW9ucywgb3B0aW9uczogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucywgdmFsdWU6IFYpOiBWIHtcblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJvb2xlYW4odmFsdWU6IGFueSwgZGVmYXVsdFZhbHVlOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdGlmICh0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0cmV0dXJuIGRlZmF1bHRWYWx1ZTtcblx0fVxuXHRpZiAodmFsdWUgPT09ICdmYWxzZScpIHtcblx0XHQvLyB0cmVhdCB0aGUgc3RyaW5nICdmYWxzZScgYXMgZmFsc2Vcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0cmV0dXJuIEJvb2xlYW4odmFsdWUpO1xufVxuXG5jbGFzcyBFZGl0b3JCb29sZWFuT3B0aW9uPEsgZXh0ZW5kcyBFZGl0b3JPcHRpb24+IGV4dGVuZHMgU2ltcGxlRWRpdG9yT3B0aW9uPEssIGJvb2xlYW4+IHtcblxuXHRjb25zdHJ1Y3RvcihpZDogSywgbmFtZTogUG9zc2libGVLZXlOYW1lPGJvb2xlYW4+LCBkZWZhdWx0VmFsdWU6IGJvb2xlYW4sIHNjaGVtYTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0eXBlb2Ygc2NoZW1hICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0c2NoZW1hLnR5cGUgPSAnYm9vbGVhbic7XG5cdFx0XHRzY2hlbWEuZGVmYXVsdCA9IGRlZmF1bHRWYWx1ZTtcblx0XHR9XG5cdFx0c3VwZXIoaWQsIG5hbWUsIGRlZmF1bHRWYWx1ZSwgc2NoZW1hKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSB2YWxpZGF0ZShpbnB1dDogYW55KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGJvb2xlYW4oaW5wdXQsIHRoaXMuZGVmYXVsdFZhbHVlKTtcblx0fVxufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xhbXBlZEludDxUPih2YWx1ZTogYW55LCBkZWZhdWx0VmFsdWU6IFQsIG1pbmltdW06IG51bWJlciwgbWF4aW11bTogbnVtYmVyKTogbnVtYmVyIHwgVCB7XG5cdGlmICh0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0cmV0dXJuIGRlZmF1bHRWYWx1ZTtcblx0fVxuXHRsZXQgciA9IHBhcnNlSW50KHZhbHVlLCAxMCk7XG5cdGlmIChpc05hTihyKSkge1xuXHRcdHJldHVybiBkZWZhdWx0VmFsdWU7XG5cdH1cblx0ciA9IE1hdGgubWF4KG1pbmltdW0sIHIpO1xuXHRyID0gTWF0aC5taW4obWF4aW11bSwgcik7XG5cdHJldHVybiByIHwgMDtcbn1cblxuY2xhc3MgRWRpdG9ySW50T3B0aW9uPEsgZXh0ZW5kcyBFZGl0b3JPcHRpb24+IGV4dGVuZHMgU2ltcGxlRWRpdG9yT3B0aW9uPEssIG51bWJlcj4ge1xuXG5cdHB1YmxpYyBzdGF0aWMgY2xhbXBlZEludDxUPih2YWx1ZTogYW55LCBkZWZhdWx0VmFsdWU6IFQsIG1pbmltdW06IG51bWJlciwgbWF4aW11bTogbnVtYmVyKTogbnVtYmVyIHwgVCB7XG5cdFx0cmV0dXJuIGNsYW1wZWRJbnQodmFsdWUsIGRlZmF1bHRWYWx1ZSwgbWluaW11bSwgbWF4aW11bSk7XG5cdH1cblxuXHRwdWJsaWMgcmVhZG9ubHkgbWluaW11bTogbnVtYmVyO1xuXHRwdWJsaWMgcmVhZG9ubHkgbWF4aW11bTogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKGlkOiBLLCBuYW1lOiBQb3NzaWJsZUtleU5hbWU8bnVtYmVyPiwgZGVmYXVsdFZhbHVlOiBudW1iZXIsIG1pbmltdW06IG51bWJlciwgbWF4aW11bTogbnVtYmVyLCBzY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQpIHtcblx0XHRpZiAodHlwZW9mIHNjaGVtYSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHNjaGVtYS50eXBlID0gJ2ludGVnZXInO1xuXHRcdFx0c2NoZW1hLmRlZmF1bHQgPSBkZWZhdWx0VmFsdWU7XG5cdFx0XHRzY2hlbWEubWluaW11bSA9IG1pbmltdW07XG5cdFx0XHRzY2hlbWEubWF4aW11bSA9IG1heGltdW07XG5cdFx0fVxuXHRcdHN1cGVyKGlkLCBuYW1lLCBkZWZhdWx0VmFsdWUsIHNjaGVtYSk7XG5cdFx0dGhpcy5taW5pbXVtID0gbWluaW11bTtcblx0XHR0aGlzLm1heGltdW0gPSBtYXhpbXVtO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHZhbGlkYXRlKGlucHV0OiBhbnkpOiBudW1iZXIge1xuXHRcdHJldHVybiBFZGl0b3JJbnRPcHRpb24uY2xhbXBlZEludChpbnB1dCwgdGhpcy5kZWZhdWx0VmFsdWUsIHRoaXMubWluaW11bSwgdGhpcy5tYXhpbXVtKTtcblx0fVxufVxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsYW1wZWRGbG9hdDxUIGV4dGVuZHMgbnVtYmVyPih2YWx1ZTogYW55LCBkZWZhdWx0VmFsdWU6IFQsIG1pbmltdW06IG51bWJlciwgbWF4aW11bTogbnVtYmVyKTogbnVtYmVyIHwgVCB7XG5cdGlmICh0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0cmV0dXJuIGRlZmF1bHRWYWx1ZTtcblx0fVxuXHRjb25zdCByID0gRWRpdG9yRmxvYXRPcHRpb24uZmxvYXQodmFsdWUsIGRlZmF1bHRWYWx1ZSk7XG5cdHJldHVybiBFZGl0b3JGbG9hdE9wdGlvbi5jbGFtcChyLCBtaW5pbXVtLCBtYXhpbXVtKTtcbn1cblxuY2xhc3MgRWRpdG9yRmxvYXRPcHRpb248SyBleHRlbmRzIEVkaXRvck9wdGlvbj4gZXh0ZW5kcyBTaW1wbGVFZGl0b3JPcHRpb248SywgbnVtYmVyPiB7XG5cblx0cHVibGljIHN0YXRpYyBjbGFtcChuOiBudW1iZXIsIG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKG4gPCBtaW4pIHtcblx0XHRcdHJldHVybiBtaW47XG5cdFx0fVxuXHRcdGlmIChuID4gbWF4KSB7XG5cdFx0XHRyZXR1cm4gbWF4O1xuXHRcdH1cblx0XHRyZXR1cm4gbjtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZmxvYXQodmFsdWU6IGFueSwgZGVmYXVsdFZhbHVlOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRjb25zdCByID0gcGFyc2VGbG9hdCh2YWx1ZSk7XG5cdFx0cmV0dXJuIChpc05hTihyKSA/IGRlZmF1bHRWYWx1ZSA6IHIpO1xuXHR9XG5cblx0cHVibGljIHJlYWRvbmx5IHZhbGlkYXRpb25GbjogKHZhbHVlOiBudW1iZXIpID0+IG51bWJlcjtcblxuXHRjb25zdHJ1Y3RvcihpZDogSywgbmFtZTogUG9zc2libGVLZXlOYW1lPG51bWJlcj4sIGRlZmF1bHRWYWx1ZTogbnVtYmVyLCB2YWxpZGF0aW9uRm46ICh2YWx1ZTogbnVtYmVyKSA9PiBudW1iZXIsIHNjaGVtYT86IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEpIHtcblx0XHRpZiAodHlwZW9mIHNjaGVtYSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHNjaGVtYS50eXBlID0gJ251bWJlcic7XG5cdFx0XHRzY2hlbWEuZGVmYXVsdCA9IGRlZmF1bHRWYWx1ZTtcblx0XHR9XG5cdFx0c3VwZXIoaWQsIG5hbWUsIGRlZmF1bHRWYWx1ZSwgc2NoZW1hKTtcblx0XHR0aGlzLnZhbGlkYXRpb25GbiA9IHZhbGlkYXRpb25Gbjtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSB2YWxpZGF0ZShpbnB1dDogYW55KTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy52YWxpZGF0aW9uRm4oRWRpdG9yRmxvYXRPcHRpb24uZmxvYXQoaW5wdXQsIHRoaXMuZGVmYXVsdFZhbHVlKSk7XG5cdH1cbn1cblxuY2xhc3MgRWRpdG9yU3RyaW5nT3B0aW9uPEsgZXh0ZW5kcyBFZGl0b3JPcHRpb24+IGV4dGVuZHMgU2ltcGxlRWRpdG9yT3B0aW9uPEssIHN0cmluZz4ge1xuXG5cdHB1YmxpYyBzdGF0aWMgc3RyaW5nKHZhbHVlOiBhbnksIGRlZmF1bHRWYWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIGRlZmF1bHRWYWx1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoaWQ6IEssIG5hbWU6IFBvc3NpYmxlS2V5TmFtZTxzdHJpbmc+LCBkZWZhdWx0VmFsdWU6IHN0cmluZywgc2NoZW1hOiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHR5cGVvZiBzY2hlbWEgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRzY2hlbWEudHlwZSA9ICdzdHJpbmcnO1xuXHRcdFx0c2NoZW1hLmRlZmF1bHQgPSBkZWZhdWx0VmFsdWU7XG5cdFx0fVxuXHRcdHN1cGVyKGlkLCBuYW1lLCBkZWZhdWx0VmFsdWUsIHNjaGVtYSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgdmFsaWRhdGUoaW5wdXQ6IGFueSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIEVkaXRvclN0cmluZ09wdGlvbi5zdHJpbmcoaW5wdXQsIHRoaXMuZGVmYXVsdFZhbHVlKTtcblx0fVxufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgZnVuY3Rpb24gc3RyaW5nU2V0PFQ+KHZhbHVlOiBUIHwgdW5kZWZpbmVkLCBkZWZhdWx0VmFsdWU6IFQsIGFsbG93ZWRWYWx1ZXM6IFJlYWRvbmx5QXJyYXk8VD4sIHJlbmFtZWRWYWx1ZXM/OiBSZWNvcmQ8c3RyaW5nLCBUPik6IFQge1xuXHRpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiBkZWZhdWx0VmFsdWU7XG5cdH1cblx0aWYgKHJlbmFtZWRWYWx1ZXMgJiYgdmFsdWUgaW4gcmVuYW1lZFZhbHVlcykge1xuXHRcdHJldHVybiByZW5hbWVkVmFsdWVzW3ZhbHVlXTtcblx0fVxuXHRpZiAoYWxsb3dlZFZhbHVlcy5pbmRleE9mKHZhbHVlKSA9PT0gLTEpIHtcblx0XHRyZXR1cm4gZGVmYXVsdFZhbHVlO1xuXHR9XG5cdHJldHVybiB2YWx1ZTtcbn1cblxuY2xhc3MgRWRpdG9yU3RyaW5nRW51bU9wdGlvbjxLIGV4dGVuZHMgRWRpdG9yT3B0aW9uLCBWIGV4dGVuZHMgc3RyaW5nPiBleHRlbmRzIFNpbXBsZUVkaXRvck9wdGlvbjxLLCBWPiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWxsb3dlZFZhbHVlczogUmVhZG9ubHlBcnJheTxWPjtcblxuXHRjb25zdHJ1Y3RvcihpZDogSywgbmFtZTogUG9zc2libGVLZXlOYW1lPFY+LCBkZWZhdWx0VmFsdWU6IFYsIGFsbG93ZWRWYWx1ZXM6IFJlYWRvbmx5QXJyYXk8Vj4sIHNjaGVtYTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0eXBlb2Ygc2NoZW1hICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0c2NoZW1hLnR5cGUgPSAnc3RyaW5nJztcblx0XHRcdHNjaGVtYS5lbnVtID0gPGFueT5hbGxvd2VkVmFsdWVzO1xuXHRcdFx0c2NoZW1hLmRlZmF1bHQgPSBkZWZhdWx0VmFsdWU7XG5cdFx0fVxuXHRcdHN1cGVyKGlkLCBuYW1lLCBkZWZhdWx0VmFsdWUsIHNjaGVtYSk7XG5cdFx0dGhpcy5fYWxsb3dlZFZhbHVlcyA9IGFsbG93ZWRWYWx1ZXM7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgdmFsaWRhdGUoaW5wdXQ6IGFueSk6IFYge1xuXHRcdHJldHVybiBzdHJpbmdTZXQ8Vj4oaW5wdXQsIHRoaXMuZGVmYXVsdFZhbHVlLCB0aGlzLl9hbGxvd2VkVmFsdWVzKTtcblx0fVxufVxuXG5jbGFzcyBFZGl0b3JFbnVtT3B0aW9uPEsgZXh0ZW5kcyBFZGl0b3JPcHRpb24sIFQgZXh0ZW5kcyBzdHJpbmcsIFY+IGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxLLCBULCBWPiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWxsb3dlZFZhbHVlczogVFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jb252ZXJ0OiAodmFsdWU6IFQpID0+IFY7XG5cblx0Y29uc3RydWN0b3IoaWQ6IEssIG5hbWU6IFBvc3NpYmxlS2V5TmFtZTxUPiwgZGVmYXVsdFZhbHVlOiBWLCBkZWZhdWx0U3RyaW5nVmFsdWU6IHN0cmluZywgYWxsb3dlZFZhbHVlczogVFtdLCBjb252ZXJ0OiAodmFsdWU6IFQpID0+IFYsIHNjaGVtYTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0eXBlb2Ygc2NoZW1hICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0c2NoZW1hLnR5cGUgPSAnc3RyaW5nJztcblx0XHRcdHNjaGVtYS5lbnVtID0gYWxsb3dlZFZhbHVlcztcblx0XHRcdHNjaGVtYS5kZWZhdWx0ID0gZGVmYXVsdFN0cmluZ1ZhbHVlO1xuXHRcdH1cblx0XHRzdXBlcihpZCwgbmFtZSwgZGVmYXVsdFZhbHVlLCBzY2hlbWEpO1xuXHRcdHRoaXMuX2FsbG93ZWRWYWx1ZXMgPSBhbGxvd2VkVmFsdWVzO1xuXHRcdHRoaXMuX2NvbnZlcnQgPSBjb252ZXJ0O1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKGlucHV0OiBhbnkpOiBWIHtcblx0XHRpZiAodHlwZW9mIGlucHV0ICE9PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fYWxsb3dlZFZhbHVlcy5pbmRleE9mKDxUPmlucHV0KSA9PT0gLTEpIHtcblx0XHRcdHJldHVybiB0aGlzLmRlZmF1bHRWYWx1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnZlcnQoPGFueT5pbnB1dCk7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBhdXRvSW5kZW50XG5cbmZ1bmN0aW9uIF9hdXRvSW5kZW50RnJvbVN0cmluZyhhdXRvSW5kZW50OiAnbm9uZScgfCAna2VlcCcgfCAnYnJhY2tldHMnIHwgJ2FkdmFuY2VkJyB8ICdmdWxsJyk6IEVkaXRvckF1dG9JbmRlbnRTdHJhdGVneSB7XG5cdHN3aXRjaCAoYXV0b0luZGVudCkge1xuXHRcdGNhc2UgJ25vbmUnOiByZXR1cm4gRWRpdG9yQXV0b0luZGVudFN0cmF0ZWd5Lk5vbmU7XG5cdFx0Y2FzZSAna2VlcCc6IHJldHVybiBFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kuS2VlcDtcblx0XHRjYXNlICdicmFja2V0cyc6IHJldHVybiBFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kuQnJhY2tldHM7XG5cdFx0Y2FzZSAnYWR2YW5jZWQnOiByZXR1cm4gRWRpdG9yQXV0b0luZGVudFN0cmF0ZWd5LkFkdmFuY2VkO1xuXHRcdGNhc2UgJ2Z1bGwnOiByZXR1cm4gRWRpdG9yQXV0b0luZGVudFN0cmF0ZWd5LkZ1bGw7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBhY2Nlc3NpYmlsaXR5U3VwcG9ydFxuXG5jbGFzcyBFZGl0b3JBY2Nlc3NpYmlsaXR5U3VwcG9ydCBleHRlbmRzIEJhc2VFZGl0b3JPcHRpb248RWRpdG9yT3B0aW9uLmFjY2Vzc2liaWxpdHlTdXBwb3J0LCAnYXV0bycgfCAnb2ZmJyB8ICdvbicsIEFjY2Vzc2liaWxpdHlTdXBwb3J0PiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHRFZGl0b3JPcHRpb24uYWNjZXNzaWJpbGl0eVN1cHBvcnQsICdhY2Nlc3NpYmlsaXR5U3VwcG9ydCcsIEFjY2Vzc2liaWxpdHlTdXBwb3J0LlVua25vd24sXG5cdFx0XHR7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRlbnVtOiBbJ2F1dG8nLCAnb24nLCAnb2ZmJ10sXG5cdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2FjY2Vzc2liaWxpdHlTdXBwb3J0LmF1dG8nLCBcIlVzZSBwbGF0Zm9ybSBBUElzIHRvIGRldGVjdCB3aGVuIGEgU2NyZWVuIFJlYWRlciBpcyBhdHRhY2hlZC5cIiksXG5cdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U3VwcG9ydC5vbicsIFwiT3B0aW1pemUgZm9yIHVzYWdlIHdpdGggYSBTY3JlZW4gUmVhZGVyLlwiKSxcblx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2FjY2Vzc2liaWxpdHlTdXBwb3J0Lm9mZicsIFwiQXNzdW1lIGEgc2NyZWVuIHJlYWRlciBpcyBub3QgYXR0YWNoZWQuXCIpLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRkZWZhdWx0OiAnYXV0bycsXG5cdFx0XHRcdHRhZ3M6IFsnYWNjZXNzaWJpbGl0eSddLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U3VwcG9ydCcsIFwiQ29udHJvbHMgaWYgdGhlIFVJIHNob3VsZCBydW4gaW4gYSBtb2RlIHdoZXJlIGl0IGlzIG9wdGltaXplZCBmb3Igc2NyZWVuIHJlYWRlcnMuXCIpXG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShpbnB1dDogYW55KTogQWNjZXNzaWJpbGl0eVN1cHBvcnQge1xuXHRcdHN3aXRjaCAoaW5wdXQpIHtcblx0XHRcdGNhc2UgJ2F1dG8nOiByZXR1cm4gQWNjZXNzaWJpbGl0eVN1cHBvcnQuVW5rbm93bjtcblx0XHRcdGNhc2UgJ29mZic6IHJldHVybiBBY2Nlc3NpYmlsaXR5U3VwcG9ydC5EaXNhYmxlZDtcblx0XHRcdGNhc2UgJ29uJzogcmV0dXJuIEFjY2Vzc2liaWxpdHlTdXBwb3J0LkVuYWJsZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmRlZmF1bHRWYWx1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBjb21wdXRlKGVudjogSUVudmlyb25tZW50YWxPcHRpb25zLCBvcHRpb25zOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zLCB2YWx1ZTogQWNjZXNzaWJpbGl0eVN1cHBvcnQpOiBBY2Nlc3NpYmlsaXR5U3VwcG9ydCB7XG5cdFx0aWYgKHZhbHVlID09PSBBY2Nlc3NpYmlsaXR5U3VwcG9ydC5Vbmtub3duKSB7XG5cdFx0XHQvLyBUaGUgZWRpdG9yIHJlYWRzIHRoZSBgYWNjZXNzaWJpbGl0eVN1cHBvcnRgIGZyb20gdGhlIGVudmlyb25tZW50XG5cdFx0XHRyZXR1cm4gZW52LmFjY2Vzc2liaWxpdHlTdXBwb3J0O1xuXHRcdH1cblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBjb21tZW50c1xuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgZWRpdG9yIGNvbW1lbnRzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSUVkaXRvckNvbW1lbnRzT3B0aW9ucyB7XG5cdC8qKlxuXHQgKiBJbnNlcnQgYSBzcGFjZSBhZnRlciB0aGUgbGluZSBjb21tZW50IHRva2VuIGFuZCBpbnNpZGUgdGhlIGJsb2NrIGNvbW1lbnRzIHRva2Vucy5cblx0ICogRGVmYXVsdHMgdG8gdHJ1ZS5cblx0ICovXG5cdGluc2VydFNwYWNlPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIElnbm9yZSBlbXB0eSBsaW5lcyB3aGVuIGluc2VydGluZyBsaW5lIGNvbW1lbnRzLlxuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0aWdub3JlRW1wdHlMaW5lcz86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCB0eXBlIEVkaXRvckNvbW1lbnRzT3B0aW9ucyA9IFJlYWRvbmx5PFJlcXVpcmVkPElFZGl0b3JDb21tZW50c09wdGlvbnM+PjtcblxuY2xhc3MgRWRpdG9yQ29tbWVudHMgZXh0ZW5kcyBCYXNlRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi5jb21tZW50cywgSUVkaXRvckNvbW1lbnRzT3B0aW9ucywgRWRpdG9yQ29tbWVudHNPcHRpb25zPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0Y29uc3QgZGVmYXVsdHM6IEVkaXRvckNvbW1lbnRzT3B0aW9ucyA9IHtcblx0XHRcdGluc2VydFNwYWNlOiB0cnVlLFxuXHRcdFx0aWdub3JlRW1wdHlMaW5lczogdHJ1ZSxcblx0XHR9O1xuXHRcdHN1cGVyKFxuXHRcdFx0RWRpdG9yT3B0aW9uLmNvbW1lbnRzLCAnY29tbWVudHMnLCBkZWZhdWx0cyxcblx0XHRcdHtcblx0XHRcdFx0J2VkaXRvci5jb21tZW50cy5pbnNlcnRTcGFjZSc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuaW5zZXJ0U3BhY2UsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29tbWVudHMuaW5zZXJ0U3BhY2UnLCBcIkNvbnRyb2xzIHdoZXRoZXIgYSBzcGFjZSBjaGFyYWN0ZXIgaXMgaW5zZXJ0ZWQgd2hlbiBjb21tZW50aW5nLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLmNvbW1lbnRzLmlnbm9yZUVtcHR5TGluZXMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmlnbm9yZUVtcHR5TGluZXMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29tbWVudHMuaWdub3JlRW1wdHlMaW5lcycsICdDb250cm9scyBpZiBlbXB0eSBsaW5lcyBzaG91bGQgYmUgaWdub3JlZCB3aXRoIHRvZ2dsZSwgYWRkIG9yIHJlbW92ZSBhY3Rpb25zIGZvciBsaW5lIGNvbW1lbnRzLicpXG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShfaW5wdXQ6IGFueSk6IEVkaXRvckNvbW1lbnRzT3B0aW9ucyB7XG5cdFx0aWYgKCFfaW5wdXQgfHwgdHlwZW9mIF9pbnB1dCAhPT0gJ29iamVjdCcpIHtcblx0XHRcdHJldHVybiB0aGlzLmRlZmF1bHRWYWx1ZTtcblx0XHR9XG5cdFx0Y29uc3QgaW5wdXQgPSBfaW5wdXQgYXMgSUVkaXRvckNvbW1lbnRzT3B0aW9ucztcblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5zZXJ0U3BhY2U6IGJvb2xlYW4oaW5wdXQuaW5zZXJ0U3BhY2UsIHRoaXMuZGVmYXVsdFZhbHVlLmluc2VydFNwYWNlKSxcblx0XHRcdGlnbm9yZUVtcHR5TGluZXM6IGJvb2xlYW4oaW5wdXQuaWdub3JlRW1wdHlMaW5lcywgdGhpcy5kZWZhdWx0VmFsdWUuaWdub3JlRW1wdHlMaW5lcyksXG5cdFx0fTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIGN1cnNvckJsaW5raW5nXG5cbi8qKlxuICogVGhlIGtpbmQgb2YgYW5pbWF0aW9uIGluIHdoaWNoIHRoZSBlZGl0b3IncyBjdXJzb3Igc2hvdWxkIGJlIHJlbmRlcmVkLlxuICovXG5leHBvcnQgY29uc3QgZW51bSBUZXh0RWRpdG9yQ3Vyc29yQmxpbmtpbmdTdHlsZSB7XG5cdC8qKlxuXHQgKiBIaWRkZW5cblx0ICovXG5cdEhpZGRlbiA9IDAsXG5cdC8qKlxuXHQgKiBCbGlua2luZ1xuXHQgKi9cblx0QmxpbmsgPSAxLFxuXHQvKipcblx0ICogQmxpbmtpbmcgd2l0aCBzbW9vdGggZmFkaW5nXG5cdCAqL1xuXHRTbW9vdGggPSAyLFxuXHQvKipcblx0ICogQmxpbmtpbmcgd2l0aCBwcm9sb25nZWQgZmlsbGVkIHN0YXRlIGFuZCBzbW9vdGggZmFkaW5nXG5cdCAqL1xuXHRQaGFzZSA9IDMsXG5cdC8qKlxuXHQgKiBFeHBhbmQgY29sbGFwc2UgYW5pbWF0aW9uIG9uIHRoZSB5IGF4aXNcblx0ICovXG5cdEV4cGFuZCA9IDQsXG5cdC8qKlxuXHQgKiBOby1CbGlua2luZ1xuXHQgKi9cblx0U29saWQgPSA1XG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjdXJzb3JCbGlua2luZ1N0eWxlRnJvbVN0cmluZyhjdXJzb3JCbGlua2luZ1N0eWxlOiAnYmxpbmsnIHwgJ3Ntb290aCcgfCAncGhhc2UnIHwgJ2V4cGFuZCcgfCAnc29saWQnKTogVGV4dEVkaXRvckN1cnNvckJsaW5raW5nU3R5bGUge1xuXHRzd2l0Y2ggKGN1cnNvckJsaW5raW5nU3R5bGUpIHtcblx0XHRjYXNlICdibGluayc6IHJldHVybiBUZXh0RWRpdG9yQ3Vyc29yQmxpbmtpbmdTdHlsZS5CbGluaztcblx0XHRjYXNlICdzbW9vdGgnOiByZXR1cm4gVGV4dEVkaXRvckN1cnNvckJsaW5raW5nU3R5bGUuU21vb3RoO1xuXHRcdGNhc2UgJ3BoYXNlJzogcmV0dXJuIFRleHRFZGl0b3JDdXJzb3JCbGlua2luZ1N0eWxlLlBoYXNlO1xuXHRcdGNhc2UgJ2V4cGFuZCc6IHJldHVybiBUZXh0RWRpdG9yQ3Vyc29yQmxpbmtpbmdTdHlsZS5FeHBhbmQ7XG5cdFx0Y2FzZSAnc29saWQnOiByZXR1cm4gVGV4dEVkaXRvckN1cnNvckJsaW5raW5nU3R5bGUuU29saWQ7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBjdXJzb3JTdHlsZVxuXG4vKipcbiAqIFRoZSBzdHlsZSBpbiB3aGljaCB0aGUgZWRpdG9yJ3MgY3Vyc29yIHNob3VsZCBiZSByZW5kZXJlZC5cbiAqL1xuZXhwb3J0IGVudW0gVGV4dEVkaXRvckN1cnNvclN0eWxlIHtcblx0LyoqXG5cdCAqIEFzIGEgdmVydGljYWwgbGluZSAoc2l0dGluZyBiZXR3ZWVuIHR3byBjaGFyYWN0ZXJzKS5cblx0ICovXG5cdExpbmUgPSAxLFxuXHQvKipcblx0ICogQXMgYSBibG9jayAoc2l0dGluZyBvbiB0b3Agb2YgYSBjaGFyYWN0ZXIpLlxuXHQgKi9cblx0QmxvY2sgPSAyLFxuXHQvKipcblx0ICogQXMgYSBob3Jpem9udGFsIGxpbmUgKHNpdHRpbmcgdW5kZXIgYSBjaGFyYWN0ZXIpLlxuXHQgKi9cblx0VW5kZXJsaW5lID0gMyxcblx0LyoqXG5cdCAqIEFzIGEgdGhpbiB2ZXJ0aWNhbCBsaW5lIChzaXR0aW5nIGJldHdlZW4gdHdvIGNoYXJhY3RlcnMpLlxuXHQgKi9cblx0TGluZVRoaW4gPSA0LFxuXHQvKipcblx0ICogQXMgYW4gb3V0bGluZWQgYmxvY2sgKHNpdHRpbmcgb24gdG9wIG9mIGEgY2hhcmFjdGVyKS5cblx0ICovXG5cdEJsb2NrT3V0bGluZSA9IDUsXG5cdC8qKlxuXHQgKiBBcyBhIHRoaW4gaG9yaXpvbnRhbCBsaW5lIChzaXR0aW5nIHVuZGVyIGEgY2hhcmFjdGVyKS5cblx0ICovXG5cdFVuZGVybGluZVRoaW4gPSA2XG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjdXJzb3JTdHlsZVRvU3RyaW5nKGN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUpOiAnbGluZScgfCAnYmxvY2snIHwgJ3VuZGVybGluZScgfCAnbGluZS10aGluJyB8ICdibG9jay1vdXRsaW5lJyB8ICd1bmRlcmxpbmUtdGhpbicge1xuXHRzd2l0Y2ggKGN1cnNvclN0eWxlKSB7XG5cdFx0Y2FzZSBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZTogcmV0dXJuICdsaW5lJztcblx0XHRjYXNlIFRleHRFZGl0b3JDdXJzb3JTdHlsZS5CbG9jazogcmV0dXJuICdibG9jayc7XG5cdFx0Y2FzZSBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuVW5kZXJsaW5lOiByZXR1cm4gJ3VuZGVybGluZSc7XG5cdFx0Y2FzZSBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZVRoaW46IHJldHVybiAnbGluZS10aGluJztcblx0XHRjYXNlIFRleHRFZGl0b3JDdXJzb3JTdHlsZS5CbG9ja091dGxpbmU6IHJldHVybiAnYmxvY2stb3V0bGluZSc7XG5cdFx0Y2FzZSBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuVW5kZXJsaW5lVGhpbjogcmV0dXJuICd1bmRlcmxpbmUtdGhpbic7XG5cdH1cbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGN1cnNvclN0eWxlRnJvbVN0cmluZyhjdXJzb3JTdHlsZTogJ2xpbmUnIHwgJ2Jsb2NrJyB8ICd1bmRlcmxpbmUnIHwgJ2xpbmUtdGhpbicgfCAnYmxvY2stb3V0bGluZScgfCAndW5kZXJsaW5lLXRoaW4nKTogVGV4dEVkaXRvckN1cnNvclN0eWxlIHtcblx0c3dpdGNoIChjdXJzb3JTdHlsZSkge1xuXHRcdGNhc2UgJ2xpbmUnOiByZXR1cm4gVGV4dEVkaXRvckN1cnNvclN0eWxlLkxpbmU7XG5cdFx0Y2FzZSAnYmxvY2snOiByZXR1cm4gVGV4dEVkaXRvckN1cnNvclN0eWxlLkJsb2NrO1xuXHRcdGNhc2UgJ3VuZGVybGluZSc6IHJldHVybiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuVW5kZXJsaW5lO1xuXHRcdGNhc2UgJ2xpbmUtdGhpbic6IHJldHVybiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuTGluZVRoaW47XG5cdFx0Y2FzZSAnYmxvY2stb3V0bGluZSc6IHJldHVybiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUuQmxvY2tPdXRsaW5lO1xuXHRcdGNhc2UgJ3VuZGVybGluZS10aGluJzogcmV0dXJuIFRleHRFZGl0b3JDdXJzb3JTdHlsZS5VbmRlcmxpbmVUaGluO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gZWRpdG9yQ2xhc3NOYW1lXG5cbmNsYXNzIEVkaXRvckNsYXNzTmFtZSBleHRlbmRzIENvbXB1dGVkRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi5lZGl0b3JDbGFzc05hbWUsIHN0cmluZz4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKEVkaXRvck9wdGlvbi5lZGl0b3JDbGFzc05hbWUpO1xuXHR9XG5cblx0cHVibGljIGNvbXB1dGUoZW52OiBJRW52aXJvbm1lbnRhbE9wdGlvbnMsIG9wdGlvbnM6IElDb21wdXRlZEVkaXRvck9wdGlvbnMsIF86IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgY2xhc3NOYW1lcyA9IFsnbW9uYWNvLWVkaXRvciddO1xuXHRcdGlmIChvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZXh0cmFFZGl0b3JDbGFzc05hbWUpKSB7XG5cdFx0XHRjbGFzc05hbWVzLnB1c2gob3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmV4dHJhRWRpdG9yQ2xhc3NOYW1lKSk7XG5cdFx0fVxuXHRcdGlmIChlbnYuZXh0cmFFZGl0b3JDbGFzc05hbWUpIHtcblx0XHRcdGNsYXNzTmFtZXMucHVzaChlbnYuZXh0cmFFZGl0b3JDbGFzc05hbWUpO1xuXHRcdH1cblx0XHRpZiAob3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLm1vdXNlU3R5bGUpID09PSAnZGVmYXVsdCcpIHtcblx0XHRcdGNsYXNzTmFtZXMucHVzaCgnbW91c2UtZGVmYXVsdCcpO1xuXHRcdH0gZWxzZSBpZiAob3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLm1vdXNlU3R5bGUpID09PSAnY29weScpIHtcblx0XHRcdGNsYXNzTmFtZXMucHVzaCgnbW91c2UtY29weScpO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zLmdldChFZGl0b3JPcHRpb24uc2hvd1VudXNlZCkpIHtcblx0XHRcdGNsYXNzTmFtZXMucHVzaCgnc2hvd1VudXNlZCcpO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zLmdldChFZGl0b3JPcHRpb24uc2hvd0RlcHJlY2F0ZWQpKSB7XG5cdFx0XHRjbGFzc05hbWVzLnB1c2goJ3Nob3dEZXByZWNhdGVkJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNsYXNzTmFtZXMuam9pbignICcpO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gZW1wdHlTZWxlY3Rpb25DbGlwYm9hcmRcblxuY2xhc3MgRWRpdG9yRW1wdHlTZWxlY3Rpb25DbGlwYm9hcmQgZXh0ZW5kcyBFZGl0b3JCb29sZWFuT3B0aW9uPEVkaXRvck9wdGlvbi5lbXB0eVNlbGVjdGlvbkNsaXBib2FyZD4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0RWRpdG9yT3B0aW9uLmVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkLCAnZW1wdHlTZWxlY3Rpb25DbGlwYm9hcmQnLCB0cnVlLFxuXHRcdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlbXB0eVNlbGVjdGlvbkNsaXBib2FyZCcsIFwiQ29udHJvbHMgd2hldGhlciBjb3B5aW5nIHdpdGhvdXQgYSBzZWxlY3Rpb24gY29waWVzIHRoZSBjdXJyZW50IGxpbmUuXCIpIH1cblx0XHQpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGNvbXB1dGUoZW52OiBJRW52aXJvbm1lbnRhbE9wdGlvbnMsIG9wdGlvbnM6IElDb21wdXRlZEVkaXRvck9wdGlvbnMsIHZhbHVlOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHZhbHVlICYmIGVudi5lbXB0eVNlbGVjdGlvbkNsaXBib2FyZDtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIGZpbmRcblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIGVkaXRvciBmaW5kIHdpZGdldFxuICovXG5leHBvcnQgaW50ZXJmYWNlIElFZGl0b3JGaW5kT3B0aW9ucyB7XG5cdC8qKlxuXHQqIENvbnRyb2xzIHdoZXRoZXIgdGhlIGN1cnNvciBzaG91bGQgbW92ZSB0byBmaW5kIG1hdGNoZXMgd2hpbGUgdHlwaW5nLlxuXHQqL1xuXHRjdXJzb3JNb3ZlT25UeXBlPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIENvbnRyb2xzIGlmIHdlIHNlZWQgc2VhcmNoIHN0cmluZyBpbiB0aGUgRmluZCBXaWRnZXQgd2l0aCBlZGl0b3Igc2VsZWN0aW9uLlxuXHQgKi9cblx0c2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb24/OiAnbmV2ZXInIHwgJ2Fsd2F5cycgfCAnc2VsZWN0aW9uJztcblx0LyoqXG5cdCAqIENvbnRyb2xzIGlmIEZpbmQgaW4gU2VsZWN0aW9uIGZsYWcgaXMgdHVybmVkIG9uIGluIHRoZSBlZGl0b3IuXG5cdCAqL1xuXHRhdXRvRmluZEluU2VsZWN0aW9uPzogJ25ldmVyJyB8ICdhbHdheXMnIHwgJ211bHRpbGluZSc7XG5cdC8qXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIEZpbmQgV2lkZ2V0IHNob3VsZCBhZGQgZXh0cmEgbGluZXMgb24gdG9wIG9mIHRoZSBlZGl0b3IuXG5cdCAqL1xuXHRhZGRFeHRyYVNwYWNlT25Ub3A/OiBib29sZWFuO1xuXHQvKipcblx0ICogQGludGVybmFsXG5cdCAqIENvbnRyb2xzIGlmIHRoZSBGaW5kIFdpZGdldCBzaG91bGQgcmVhZCBvciBtb2RpZnkgdGhlIHNoYXJlZCBmaW5kIGNsaXBib2FyZCBvbiBtYWNPU1xuXHQgKi9cblx0Z2xvYmFsRmluZENsaXBib2FyZD86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSBzZWFyY2ggcmVzdWx0IGFuZCBkaWZmIHJlc3VsdCBhdXRvbWF0aWNhbGx5IHJlc3RhcnRzIGZyb20gdGhlIGJlZ2lubmluZyAob3IgdGhlIGVuZCkgd2hlbiBubyBmdXJ0aGVyIG1hdGNoZXMgY2FuIGJlIGZvdW5kXG5cdCAqL1xuXHRsb29wPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIEBpbnRlcm5hbFxuXHQgKiBDb250cm9scyBob3cgdGhlIGZpbmQgd2lkZ2V0IHNlYXJjaCBoaXN0b3J5IHNob3VsZCBiZSBzdG9yZWRcblx0ICovXG5cdGhpc3Rvcnk/OiAnbmV2ZXInIHwgJ3dvcmtzcGFjZSc7XG5cdC8qKlxuXHQgKiBAaW50ZXJuYWxcblx0ICogQ29udHJvbHMgaG93IHRoZSByZXBsYWNlIHdpZGdldCBzZWFyY2ggaGlzdG9yeSBzaG91bGQgYmUgc3RvcmVkXG5cdCAqL1xuXHRyZXBsYWNlSGlzdG9yeT86ICduZXZlcicgfCAnd29ya3NwYWNlJztcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IHR5cGUgRWRpdG9yRmluZE9wdGlvbnMgPSBSZWFkb25seTxSZXF1aXJlZDxJRWRpdG9yRmluZE9wdGlvbnM+PjtcblxuY2xhc3MgRWRpdG9yRmluZCBleHRlbmRzIEJhc2VFZGl0b3JPcHRpb248RWRpdG9yT3B0aW9uLmZpbmQsIElFZGl0b3JGaW5kT3B0aW9ucywgRWRpdG9yRmluZE9wdGlvbnM+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBkZWZhdWx0czogRWRpdG9yRmluZE9wdGlvbnMgPSB7XG5cdFx0XHRjdXJzb3JNb3ZlT25UeXBlOiB0cnVlLFxuXHRcdFx0c2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb246ICdhbHdheXMnLFxuXHRcdFx0YXV0b0ZpbmRJblNlbGVjdGlvbjogJ25ldmVyJyxcblx0XHRcdGdsb2JhbEZpbmRDbGlwYm9hcmQ6IGZhbHNlLFxuXHRcdFx0YWRkRXh0cmFTcGFjZU9uVG9wOiB0cnVlLFxuXHRcdFx0bG9vcDogdHJ1ZSxcblx0XHRcdGhpc3Rvcnk6ICd3b3Jrc3BhY2UnLFxuXHRcdFx0cmVwbGFjZUhpc3Rvcnk6ICd3b3Jrc3BhY2UnLFxuXHRcdH07XG5cdFx0c3VwZXIoXG5cdFx0XHRFZGl0b3JPcHRpb24uZmluZCwgJ2ZpbmQnLCBkZWZhdWx0cyxcblx0XHRcdHtcblx0XHRcdFx0J2VkaXRvci5maW5kLmN1cnNvck1vdmVPblR5cGUnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmN1cnNvck1vdmVPblR5cGUsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZmluZC5jdXJzb3JNb3ZlT25UeXBlJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBjdXJzb3Igc2hvdWxkIGp1bXAgdG8gZmluZCBtYXRjaGVzIHdoaWxlIHR5cGluZy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5maW5kLnNlZWRTZWFyY2hTdHJpbmdGcm9tU2VsZWN0aW9uJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGVudW06IFsnbmV2ZXInLCAnYWx3YXlzJywgJ3NlbGVjdGlvbiddLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLnNlZWRTZWFyY2hTdHJpbmdGcm9tU2VsZWN0aW9uLFxuXHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmZpbmQuc2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb24ubmV2ZXInLCAnTmV2ZXIgc2VlZCBzZWFyY2ggc3RyaW5nIGZyb20gdGhlIGVkaXRvciBzZWxlY3Rpb24uJyksXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5maW5kLnNlZWRTZWFyY2hTdHJpbmdGcm9tU2VsZWN0aW9uLmFsd2F5cycsICdBbHdheXMgc2VlZCBzZWFyY2ggc3RyaW5nIGZyb20gdGhlIGVkaXRvciBzZWxlY3Rpb24sIGluY2x1ZGluZyB3b3JkIGF0IGN1cnNvciBwb3NpdGlvbi4nKSxcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmZpbmQuc2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb24uc2VsZWN0aW9uJywgJ09ubHkgc2VlZCBzZWFyY2ggc3RyaW5nIGZyb20gdGhlIGVkaXRvciBzZWxlY3Rpb24uJylcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2ZpbmQuc2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb24nLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIHNlYXJjaCBzdHJpbmcgaW4gdGhlIEZpbmQgV2lkZ2V0IGlzIHNlZWRlZCBmcm9tIHRoZSBlZGl0b3Igc2VsZWN0aW9uLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLmZpbmQuYXV0b0ZpbmRJblNlbGVjdGlvbic6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRlbnVtOiBbJ25ldmVyJywgJ2Fsd2F5cycsICdtdWx0aWxpbmUnXSxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5hdXRvRmluZEluU2VsZWN0aW9uLFxuXHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmZpbmQuYXV0b0ZpbmRJblNlbGVjdGlvbi5uZXZlcicsICdOZXZlciB0dXJuIG9uIEZpbmQgaW4gU2VsZWN0aW9uIGF1dG9tYXRpY2FsbHkgKGRlZmF1bHQpLicpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuZmluZC5hdXRvRmluZEluU2VsZWN0aW9uLmFsd2F5cycsICdBbHdheXMgdHVybiBvbiBGaW5kIGluIFNlbGVjdGlvbiBhdXRvbWF0aWNhbGx5LicpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuZmluZC5hdXRvRmluZEluU2VsZWN0aW9uLm11bHRpbGluZScsICdUdXJuIG9uIEZpbmQgaW4gU2VsZWN0aW9uIGF1dG9tYXRpY2FsbHkgd2hlbiBtdWx0aXBsZSBsaW5lcyBvZiBjb250ZW50IGFyZSBzZWxlY3RlZC4nKVxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZmluZC5hdXRvRmluZEluU2VsZWN0aW9uJywgXCJDb250cm9scyB0aGUgY29uZGl0aW9uIGZvciB0dXJuaW5nIG9uIEZpbmQgaW4gU2VsZWN0aW9uIGF1dG9tYXRpY2FsbHkuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuZmluZC5nbG9iYWxGaW5kQ2xpcGJvYXJkJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5nbG9iYWxGaW5kQ2xpcGJvYXJkLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2ZpbmQuZ2xvYmFsRmluZENsaXBib2FyZCcsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgRmluZCBXaWRnZXQgc2hvdWxkIHJlYWQgb3IgbW9kaWZ5IHRoZSBzaGFyZWQgZmluZCBjbGlwYm9hcmQgb24gbWFjT1MuXCIpLFxuXHRcdFx0XHRcdGluY2x1ZGVkOiBwbGF0Zm9ybS5pc01hY2ludG9zaFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLmZpbmQuYWRkRXh0cmFTcGFjZU9uVG9wJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5hZGRFeHRyYVNwYWNlT25Ub3AsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZmluZC5hZGRFeHRyYVNwYWNlT25Ub3AnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIEZpbmQgV2lkZ2V0IHNob3VsZCBhZGQgZXh0cmEgbGluZXMgb24gdG9wIG9mIHRoZSBlZGl0b3IuIFdoZW4gdHJ1ZSwgeW91IGNhbiBzY3JvbGwgYmV5b25kIHRoZSBmaXJzdCBsaW5lIHdoZW4gdGhlIEZpbmQgV2lkZ2V0IGlzIHZpc2libGUuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuZmluZC5sb29wJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5sb29wLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2ZpbmQubG9vcCcsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgc2VhcmNoIGF1dG9tYXRpY2FsbHkgcmVzdGFydHMgZnJvbSB0aGUgYmVnaW5uaW5nIChvciB0aGUgZW5kKSB3aGVuIG5vIGZ1cnRoZXIgbWF0Y2hlcyBjYW4gYmUgZm91bmQuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuZmluZC5oaXN0b3J5Jzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGVudW06IFsnbmV2ZXInLCAnd29ya3NwYWNlJ10sXG5cdFx0XHRcdFx0ZGVmYXVsdDogJ3dvcmtzcGFjZScsXG5cdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuZmluZC5oaXN0b3J5Lm5ldmVyJywgJ0RvIG5vdCBzdG9yZSBzZWFyY2ggaGlzdG9yeSBmcm9tIHRoZSBmaW5kIHdpZGdldC4nKSxcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmZpbmQuaGlzdG9yeS53b3Jrc3BhY2UnLCAnU3RvcmUgc2VhcmNoIGhpc3RvcnkgYWNyb3NzIHRoZSBhY3RpdmUgd29ya3NwYWNlJyksXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdmaW5kLmhpc3RvcnknLCBcIkNvbnRyb2xzIGhvdyB0aGUgZmluZCB3aWRnZXQgaGlzdG9yeSBzaG91bGQgYmUgc3RvcmVkXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuZmluZC5yZXBsYWNlSGlzdG9yeSc6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRlbnVtOiBbJ25ldmVyJywgJ3dvcmtzcGFjZSddLFxuXHRcdFx0XHRcdGRlZmF1bHQ6ICd3b3Jrc3BhY2UnLFxuXHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmZpbmQucmVwbGFjZUhpc3RvcnkubmV2ZXInLCAnRG8gbm90IHN0b3JlIGhpc3RvcnkgZnJvbSB0aGUgcmVwbGFjZSB3aWRnZXQuJyksXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5maW5kLnJlcGxhY2VIaXN0b3J5LndvcmtzcGFjZScsICdTdG9yZSByZXBsYWNlIGhpc3RvcnkgYWNyb3NzIHRoZSBhY3RpdmUgd29ya3NwYWNlJyksXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdmaW5kLnJlcGxhY2VIaXN0b3J5JywgXCJDb250cm9scyBob3cgdGhlIHJlcGxhY2Ugd2lkZ2V0IGhpc3Rvcnkgc2hvdWxkIGJlIHN0b3JlZFwiKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShfaW5wdXQ6IGFueSk6IEVkaXRvckZpbmRPcHRpb25zIHtcblx0XHRpZiAoIV9pbnB1dCB8fCB0eXBlb2YgX2lucHV0ICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRjb25zdCBpbnB1dCA9IF9pbnB1dCBhcyBJRWRpdG9yRmluZE9wdGlvbnM7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGN1cnNvck1vdmVPblR5cGU6IGJvb2xlYW4oaW5wdXQuY3Vyc29yTW92ZU9uVHlwZSwgdGhpcy5kZWZhdWx0VmFsdWUuY3Vyc29yTW92ZU9uVHlwZSksXG5cdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbjogdHlwZW9mIF9pbnB1dC5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiA9PT0gJ2Jvb2xlYW4nXG5cdFx0XHRcdD8gKF9pbnB1dC5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiA/ICdhbHdheXMnIDogJ25ldmVyJylcblx0XHRcdFx0OiBzdHJpbmdTZXQ8J25ldmVyJyB8ICdhbHdheXMnIHwgJ3NlbGVjdGlvbic+KGlucHV0LnNlZWRTZWFyY2hTdHJpbmdGcm9tU2VsZWN0aW9uLCB0aGlzLmRlZmF1bHRWYWx1ZS5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiwgWyduZXZlcicsICdhbHdheXMnLCAnc2VsZWN0aW9uJ10pLFxuXHRcdFx0YXV0b0ZpbmRJblNlbGVjdGlvbjogdHlwZW9mIF9pbnB1dC5hdXRvRmluZEluU2VsZWN0aW9uID09PSAnYm9vbGVhbidcblx0XHRcdFx0PyAoX2lucHV0LmF1dG9GaW5kSW5TZWxlY3Rpb24gPyAnYWx3YXlzJyA6ICduZXZlcicpXG5cdFx0XHRcdDogc3RyaW5nU2V0PCduZXZlcicgfCAnYWx3YXlzJyB8ICdtdWx0aWxpbmUnPihpbnB1dC5hdXRvRmluZEluU2VsZWN0aW9uLCB0aGlzLmRlZmF1bHRWYWx1ZS5hdXRvRmluZEluU2VsZWN0aW9uLCBbJ25ldmVyJywgJ2Fsd2F5cycsICdtdWx0aWxpbmUnXSksXG5cdFx0XHRnbG9iYWxGaW5kQ2xpcGJvYXJkOiBib29sZWFuKGlucHV0Lmdsb2JhbEZpbmRDbGlwYm9hcmQsIHRoaXMuZGVmYXVsdFZhbHVlLmdsb2JhbEZpbmRDbGlwYm9hcmQpLFxuXHRcdFx0YWRkRXh0cmFTcGFjZU9uVG9wOiBib29sZWFuKGlucHV0LmFkZEV4dHJhU3BhY2VPblRvcCwgdGhpcy5kZWZhdWx0VmFsdWUuYWRkRXh0cmFTcGFjZU9uVG9wKSxcblx0XHRcdGxvb3A6IGJvb2xlYW4oaW5wdXQubG9vcCwgdGhpcy5kZWZhdWx0VmFsdWUubG9vcCksXG5cdFx0XHRoaXN0b3J5OiBzdHJpbmdTZXQ8J25ldmVyJyB8ICd3b3Jrc3BhY2UnPihpbnB1dC5oaXN0b3J5LCB0aGlzLmRlZmF1bHRWYWx1ZS5oaXN0b3J5LCBbJ25ldmVyJywgJ3dvcmtzcGFjZSddKSxcblx0XHRcdHJlcGxhY2VIaXN0b3J5OiBzdHJpbmdTZXQ8J25ldmVyJyB8ICd3b3Jrc3BhY2UnPihpbnB1dC5yZXBsYWNlSGlzdG9yeSwgdGhpcy5kZWZhdWx0VmFsdWUucmVwbGFjZUhpc3RvcnksIFsnbmV2ZXInLCAnd29ya3NwYWNlJ10pLFxuXHRcdH07XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBmb250TGlnYXR1cmVzXG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCBjbGFzcyBFZGl0b3JGb250TGlnYXR1cmVzIGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24uZm9udExpZ2F0dXJlcywgYm9vbGVhbiB8IHN0cmluZywgc3RyaW5nPiB7XG5cblx0cHVibGljIHN0YXRpYyBPRkYgPSAnXCJsaWdhXCIgb2ZmLCBcImNhbHRcIiBvZmYnO1xuXHRwdWJsaWMgc3RhdGljIE9OID0gJ1wibGlnYVwiIG9uLCBcImNhbHRcIiBvbic7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHRFZGl0b3JPcHRpb24uZm9udExpZ2F0dXJlcywgJ2ZvbnRMaWdhdHVyZXMnLCBFZGl0b3JGb250TGlnYXR1cmVzLk9GRixcblx0XHRcdHtcblx0XHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdmb250TGlnYXR1cmVzJywgXCJFbmFibGVzL0Rpc2FibGVzIGZvbnQgbGlnYXR1cmVzICgnY2FsdCcgYW5kICdsaWdhJyBmb250IGZlYXR1cmVzKS4gQ2hhbmdlIHRoaXMgdG8gYSBzdHJpbmcgZm9yIGZpbmUtZ3JhaW5lZCBjb250cm9sIG9mIHRoZSAnZm9udC1mZWF0dXJlLXNldHRpbmdzJyBDU1MgcHJvcGVydHkuXCIpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdmb250RmVhdHVyZVNldHRpbmdzJywgXCJFeHBsaWNpdCAnZm9udC1mZWF0dXJlLXNldHRpbmdzJyBDU1MgcHJvcGVydHkuIEEgYm9vbGVhbiBjYW4gYmUgcGFzc2VkIGluc3RlYWQgaWYgb25lIG9ubHkgbmVlZHMgdG8gdHVybiBvbi9vZmYgbGlnYXR1cmVzLlwiKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZm9udExpZ2F0dXJlc0dlbmVyYWwnLCBcIkNvbmZpZ3VyZXMgZm9udCBsaWdhdHVyZXMgb3IgZm9udCBmZWF0dXJlcy4gQ2FuIGJlIGVpdGhlciBhIGJvb2xlYW4gdG8gZW5hYmxlL2Rpc2FibGUgbGlnYXR1cmVzIG9yIGEgc3RyaW5nIGZvciB0aGUgdmFsdWUgb2YgdGhlIENTUyAnZm9udC1mZWF0dXJlLXNldHRpbmdzJyBwcm9wZXJ0eS5cIiksXG5cdFx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShpbnB1dDogYW55KTogc3RyaW5nIHtcblx0XHRpZiAodHlwZW9mIGlucHV0ID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0aWYgKGlucHV0ID09PSAnZmFsc2UnIHx8IGlucHV0Lmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRyZXR1cm4gRWRpdG9yRm9udExpZ2F0dXJlcy5PRkY7XG5cdFx0XHR9XG5cdFx0XHRpZiAoaW5wdXQgPT09ICd0cnVlJykge1xuXHRcdFx0XHRyZXR1cm4gRWRpdG9yRm9udExpZ2F0dXJlcy5PTjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBpbnB1dDtcblx0XHR9XG5cdFx0aWYgKEJvb2xlYW4oaW5wdXQpKSB7XG5cdFx0XHRyZXR1cm4gRWRpdG9yRm9udExpZ2F0dXJlcy5PTjtcblx0XHR9XG5cdFx0cmV0dXJuIEVkaXRvckZvbnRMaWdhdHVyZXMuT0ZGO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gZm9udFZhcmlhdGlvbnNcblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGNsYXNzIEVkaXRvckZvbnRWYXJpYXRpb25zIGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24uZm9udFZhcmlhdGlvbnMsIGJvb2xlYW4gfCBzdHJpbmcsIHN0cmluZz4ge1xuXHQvLyBUZXh0IGlzIGxhaWQgb3V0IHVzaW5nIGRlZmF1bHQgc2V0dGluZ3MuXG5cdHB1YmxpYyBzdGF0aWMgT0ZGID0gJ25vcm1hbCc7XG5cblx0Ly8gVHJhbnNsYXRlIGBmb250V2VpZ2h0YCBjb25maWcgdG8gdGhlIGBmb250LXZhcmlhdGlvbi1zZXR0aW5nc2AgQ1NTIHByb3BlcnR5LlxuXHRwdWJsaWMgc3RhdGljIFRSQU5TTEFURSA9ICd0cmFuc2xhdGUnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0RWRpdG9yT3B0aW9uLmZvbnRWYXJpYXRpb25zLCAnZm9udFZhcmlhdGlvbnMnLCBFZGl0b3JGb250VmFyaWF0aW9ucy5PRkYsXG5cdFx0XHR7XG5cdFx0XHRcdGFueU9mOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZm9udFZhcmlhdGlvbnMnLCBcIkVuYWJsZXMvRGlzYWJsZXMgdGhlIHRyYW5zbGF0aW9uIGZyb20gZm9udC13ZWlnaHQgdG8gZm9udC12YXJpYXRpb24tc2V0dGluZ3MuIENoYW5nZSB0aGlzIHRvIGEgc3RyaW5nIGZvciBmaW5lLWdyYWluZWQgY29udHJvbCBvZiB0aGUgJ2ZvbnQtdmFyaWF0aW9uLXNldHRpbmdzJyBDU1MgcHJvcGVydHkuXCIpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdmb250VmFyaWF0aW9uU2V0dGluZ3MnLCBcIkV4cGxpY2l0ICdmb250LXZhcmlhdGlvbi1zZXR0aW5ncycgQ1NTIHByb3BlcnR5LiBBIGJvb2xlYW4gY2FuIGJlIHBhc3NlZCBpbnN0ZWFkIGlmIG9uZSBvbmx5IG5lZWRzIHRvIHRyYW5zbGF0ZSBmb250LXdlaWdodCB0byBmb250LXZhcmlhdGlvbi1zZXR0aW5ncy5cIilcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2ZvbnRWYXJpYXRpb25zR2VuZXJhbCcsIFwiQ29uZmlndXJlcyBmb250IHZhcmlhdGlvbnMuIENhbiBiZSBlaXRoZXIgYSBib29sZWFuIHRvIGVuYWJsZS9kaXNhYmxlIHRoZSB0cmFuc2xhdGlvbiBmcm9tIGZvbnQtd2VpZ2h0IHRvIGZvbnQtdmFyaWF0aW9uLXNldHRpbmdzIG9yIGEgc3RyaW5nIGZvciB0aGUgdmFsdWUgb2YgdGhlIENTUyAnZm9udC12YXJpYXRpb24tc2V0dGluZ3MnIHByb3BlcnR5LlwiKSxcblx0XHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKGlucHV0OiBhbnkpOiBzdHJpbmcge1xuXHRcdGlmICh0eXBlb2YgaW5wdXQgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0VmFsdWU7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRpZiAoaW5wdXQgPT09ICdmYWxzZScpIHtcblx0XHRcdFx0cmV0dXJuIEVkaXRvckZvbnRWYXJpYXRpb25zLk9GRjtcblx0XHRcdH1cblx0XHRcdGlmIChpbnB1dCA9PT0gJ3RydWUnKSB7XG5cdFx0XHRcdHJldHVybiBFZGl0b3JGb250VmFyaWF0aW9ucy5UUkFOU0xBVEU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaW5wdXQ7XG5cdFx0fVxuXHRcdGlmIChCb29sZWFuKGlucHV0KSkge1xuXHRcdFx0cmV0dXJuIEVkaXRvckZvbnRWYXJpYXRpb25zLlRSQU5TTEFURTtcblx0XHR9XG5cdFx0cmV0dXJuIEVkaXRvckZvbnRWYXJpYXRpb25zLk9GRjtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBjb21wdXRlKGVudjogSUVudmlyb25tZW50YWxPcHRpb25zLCBvcHRpb25zOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zLCB2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcblx0XHQvLyBUaGUgdmFsdWUgaXMgY29tcHV0ZWQgZnJvbSB0aGUgZm9udFdlaWdodCBpZiBpdCBpcyB0cnVlLlxuXHRcdC8vIFNvIHRha2UgdGhlIHJlc3VsdCBmcm9tIGVudi5mb250SW5mb1xuXHRcdHJldHVybiBlbnYuZm9udEluZm8uZm9udFZhcmlhdGlvblNldHRpbmdzO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gZm9udEluZm9cblxuY2xhc3MgRWRpdG9yRm9udEluZm8gZXh0ZW5kcyBDb21wdXRlZEVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24uZm9udEluZm8sIEZvbnRJbmZvPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoRWRpdG9yT3B0aW9uLmZvbnRJbmZvKTtcblx0fVxuXG5cdHB1YmxpYyBjb21wdXRlKGVudjogSUVudmlyb25tZW50YWxPcHRpb25zLCBvcHRpb25zOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zLCBfOiBGb250SW5mbyk6IEZvbnRJbmZvIHtcblx0XHRyZXR1cm4gZW52LmZvbnRJbmZvO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gZWZmZWN0aXZlQ3Vyc29yU3R5bGVcblxuY2xhc3MgRWZmZWN0aXZlQ3Vyc29yU3R5bGUgZXh0ZW5kcyBDb21wdXRlZEVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24uZWZmZWN0aXZlQ3Vyc29yU3R5bGUsIFRleHRFZGl0b3JDdXJzb3JTdHlsZT4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKEVkaXRvck9wdGlvbi5lZmZlY3RpdmVDdXJzb3JTdHlsZSk7XG5cdH1cblxuXHRwdWJsaWMgY29tcHV0ZShlbnY6IElFbnZpcm9ubWVudGFsT3B0aW9ucywgb3B0aW9uczogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucywgXzogVGV4dEVkaXRvckN1cnNvclN0eWxlKTogVGV4dEVkaXRvckN1cnNvclN0eWxlIHtcblx0XHRyZXR1cm4gZW52LmlucHV0TW9kZSA9PT0gJ292ZXJ0eXBlJyA/XG5cdFx0XHRvcHRpb25zLmdldChFZGl0b3JPcHRpb24ub3ZlcnR5cGVDdXJzb3JTdHlsZSkgOlxuXHRcdFx0b3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmN1cnNvclN0eWxlKTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIGVmZmVjdGl2ZUV4cGVyaW1lbnRhbEVkaXRDb250ZXh0XG5cbmNsYXNzIEVmZmVjdGl2ZUV4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZCBleHRlbmRzIENvbXB1dGVkRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi5lZmZlY3RpdmVFeHBlcmltZW50YWxFZGl0Q29udGV4dEVuYWJsZWQsIGJvb2xlYW4+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihFZGl0b3JPcHRpb24uZWZmZWN0aXZlRXhwZXJpbWVudGFsRWRpdENvbnRleHRFbmFibGVkKTtcblx0fVxuXG5cdHB1YmxpYyBjb21wdXRlKGVudjogSUVudmlyb25tZW50YWxPcHRpb25zLCBvcHRpb25zOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZWRpdENvbnRleHRTdXBwb3J0ZWQgPSB0eXBlb2YgKGdsb2JhbFRoaXMgYXMgYW55KS5FZGl0Q29udGV4dCA9PT0gJ2Z1bmN0aW9uJztcblx0XHRyZXR1cm4gZWRpdENvbnRleHRTdXBwb3J0ZWQgJiYgb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmV4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZCk7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBmb250U2l6ZVxuXG5jbGFzcyBFZGl0b3JGb250U2l6ZSBleHRlbmRzIFNpbXBsZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24uZm9udFNpemUsIG51bWJlcj4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0RWRpdG9yT3B0aW9uLmZvbnRTaXplLCAnZm9udFNpemUnLCBFRElUT1JfRk9OVF9ERUZBVUxUUy5mb250U2l6ZSxcblx0XHRcdHtcblx0XHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRcdG1pbmltdW06IDYsXG5cdFx0XHRcdG1heGltdW06IDEwMCxcblx0XHRcdFx0ZGVmYXVsdDogRURJVE9SX0ZPTlRfREVGQVVMVFMuZm9udFNpemUsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2ZvbnRTaXplJywgXCJDb250cm9scyB0aGUgZm9udCBzaXplIGluIHBpeGVscy5cIilcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHZhbGlkYXRlKGlucHV0OiBhbnkpOiBudW1iZXIge1xuXHRcdGNvbnN0IHIgPSBFZGl0b3JGbG9hdE9wdGlvbi5mbG9hdChpbnB1dCwgdGhpcy5kZWZhdWx0VmFsdWUpO1xuXHRcdGlmIChyID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gRURJVE9SX0ZPTlRfREVGQVVMVFMuZm9udFNpemU7XG5cdFx0fVxuXHRcdHJldHVybiBFZGl0b3JGbG9hdE9wdGlvbi5jbGFtcChyLCA2LCAxMDApO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBjb21wdXRlKGVudjogSUVudmlyb25tZW50YWxPcHRpb25zLCBvcHRpb25zOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zLCB2YWx1ZTogbnVtYmVyKTogbnVtYmVyIHtcblx0XHQvLyBUaGUgZmluYWwgZm9udFNpemUgcmVzcGVjdHMgdGhlIGVkaXRvciB6b29tIGxldmVsLlxuXHRcdC8vIFNvIHRha2UgdGhlIHJlc3VsdCBmcm9tIGVudi5mb250SW5mb1xuXHRcdHJldHVybiBlbnYuZm9udEluZm8uZm9udFNpemU7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBmb250V2VpZ2h0XG5cbmNsYXNzIEVkaXRvckZvbnRXZWlnaHQgZXh0ZW5kcyBCYXNlRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi5mb250V2VpZ2h0LCBzdHJpbmcsIHN0cmluZz4ge1xuXHRwcml2YXRlIHN0YXRpYyBTVUdHRVNUSU9OX1ZBTFVFUyA9IFsnbm9ybWFsJywgJ2JvbGQnLCAnMTAwJywgJzIwMCcsICczMDAnLCAnNDAwJywgJzUwMCcsICc2MDAnLCAnNzAwJywgJzgwMCcsICc5MDAnXTtcblx0cHJpdmF0ZSBzdGF0aWMgTUlOSU1VTV9WQUxVRSA9IDE7XG5cdHByaXZhdGUgc3RhdGljIE1BWElNVU1fVkFMVUUgPSAxMDAwO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0RWRpdG9yT3B0aW9uLmZvbnRXZWlnaHQsICdmb250V2VpZ2h0JywgRURJVE9SX0ZPTlRfREVGQVVMVFMuZm9udFdlaWdodCxcblx0XHRcdHtcblx0XHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdFx0XHRcdG1pbmltdW06IEVkaXRvckZvbnRXZWlnaHQuTUlOSU1VTV9WQUxVRSxcblx0XHRcdFx0XHRcdG1heGltdW06IEVkaXRvckZvbnRXZWlnaHQuTUFYSU1VTV9WQUxVRSxcblx0XHRcdFx0XHRcdGVycm9yTWVzc2FnZTogbmxzLmxvY2FsaXplKCdmb250V2VpZ2h0RXJyb3JNZXNzYWdlJywgXCJPbmx5IFxcXCJub3JtYWxcXFwiIGFuZCBcXFwiYm9sZFxcXCIga2V5d29yZHMgb3IgbnVtYmVycyBiZXR3ZWVuIDEgYW5kIDEwMDAgYXJlIGFsbG93ZWQuXCIpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdHBhdHRlcm46ICdeKG5vcm1hbHxib2xkfDEwMDB8WzEtOV1bMC05XXswLDJ9KSQnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRlbnVtOiBFZGl0b3JGb250V2VpZ2h0LlNVR0dFU1RJT05fVkFMVUVTXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRkZWZhdWx0OiBFRElUT1JfRk9OVF9ERUZBVUxUUy5mb250V2VpZ2h0LFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdmb250V2VpZ2h0JywgXCJDb250cm9scyB0aGUgZm9udCB3ZWlnaHQuIEFjY2VwdHMgXFxcIm5vcm1hbFxcXCIgYW5kIFxcXCJib2xkXFxcIiBrZXl3b3JkcyBvciBudW1iZXJzIGJldHdlZW4gMSBhbmQgMTAwMC5cIilcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKGlucHV0OiBhbnkpOiBzdHJpbmcge1xuXHRcdGlmIChpbnB1dCA9PT0gJ25vcm1hbCcgfHwgaW5wdXQgPT09ICdib2xkJykge1xuXHRcdFx0cmV0dXJuIGlucHV0O1xuXHRcdH1cblx0XHRyZXR1cm4gU3RyaW5nKEVkaXRvckludE9wdGlvbi5jbGFtcGVkSW50KGlucHV0LCBFRElUT1JfRk9OVF9ERUZBVUxUUy5mb250V2VpZ2h0LCBFZGl0b3JGb250V2VpZ2h0Lk1JTklNVU1fVkFMVUUsIEVkaXRvckZvbnRXZWlnaHQuTUFYSU1VTV9WQUxVRSkpO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gZ290b0xvY2F0aW9uXG5cbmV4cG9ydCB0eXBlIEdvVG9Mb2NhdGlvblZhbHVlcyA9ICdwZWVrJyB8ICdnb3RvQW5kUGVlaycgfCAnZ290byc7XG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciBnbyB0byBsb2NhdGlvblxuICovXG5leHBvcnQgaW50ZXJmYWNlIElHb3RvTG9jYXRpb25PcHRpb25zIHtcblxuXHRtdWx0aXBsZT86IEdvVG9Mb2NhdGlvblZhbHVlcztcblxuXHRtdWx0aXBsZURlZmluaXRpb25zPzogR29Ub0xvY2F0aW9uVmFsdWVzO1xuXHRtdWx0aXBsZVR5cGVEZWZpbml0aW9ucz86IEdvVG9Mb2NhdGlvblZhbHVlcztcblx0bXVsdGlwbGVEZWNsYXJhdGlvbnM/OiBHb1RvTG9jYXRpb25WYWx1ZXM7XG5cdG11bHRpcGxlSW1wbGVtZW50YXRpb25zPzogR29Ub0xvY2F0aW9uVmFsdWVzO1xuXHRtdWx0aXBsZVJlZmVyZW5jZXM/OiBHb1RvTG9jYXRpb25WYWx1ZXM7XG5cdG11bHRpcGxlVGVzdHM/OiBHb1RvTG9jYXRpb25WYWx1ZXM7XG5cblx0YWx0ZXJuYXRpdmVEZWZpbml0aW9uQ29tbWFuZD86IHN0cmluZztcblx0YWx0ZXJuYXRpdmVUeXBlRGVmaW5pdGlvbkNvbW1hbmQ/OiBzdHJpbmc7XG5cdGFsdGVybmF0aXZlRGVjbGFyYXRpb25Db21tYW5kPzogc3RyaW5nO1xuXHRhbHRlcm5hdGl2ZUltcGxlbWVudGF0aW9uQ29tbWFuZD86IHN0cmluZztcblx0YWx0ZXJuYXRpdmVSZWZlcmVuY2VDb21tYW5kPzogc3RyaW5nO1xuXHRhbHRlcm5hdGl2ZVRlc3RzQ29tbWFuZD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IHR5cGUgR29Ub0xvY2F0aW9uT3B0aW9ucyA9IFJlYWRvbmx5PFJlcXVpcmVkPElHb3RvTG9jYXRpb25PcHRpb25zPj47XG5cbmNsYXNzIEVkaXRvckdvVG9Mb2NhdGlvbiBleHRlbmRzIEJhc2VFZGl0b3JPcHRpb248RWRpdG9yT3B0aW9uLmdvdG9Mb2NhdGlvbiwgSUdvdG9Mb2NhdGlvbk9wdGlvbnMsIEdvVG9Mb2NhdGlvbk9wdGlvbnM+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBkZWZhdWx0czogR29Ub0xvY2F0aW9uT3B0aW9ucyA9IHtcblx0XHRcdG11bHRpcGxlOiAncGVlaycsXG5cdFx0XHRtdWx0aXBsZURlZmluaXRpb25zOiAncGVlaycsXG5cdFx0XHRtdWx0aXBsZVR5cGVEZWZpbml0aW9uczogJ3BlZWsnLFxuXHRcdFx0bXVsdGlwbGVEZWNsYXJhdGlvbnM6ICdwZWVrJyxcblx0XHRcdG11bHRpcGxlSW1wbGVtZW50YXRpb25zOiAncGVlaycsXG5cdFx0XHRtdWx0aXBsZVJlZmVyZW5jZXM6ICdwZWVrJyxcblx0XHRcdG11bHRpcGxlVGVzdHM6ICdwZWVrJyxcblx0XHRcdGFsdGVybmF0aXZlRGVmaW5pdGlvbkNvbW1hbmQ6ICdlZGl0b3IuYWN0aW9uLmdvVG9SZWZlcmVuY2VzJyxcblx0XHRcdGFsdGVybmF0aXZlVHlwZURlZmluaXRpb25Db21tYW5kOiAnZWRpdG9yLmFjdGlvbi5nb1RvUmVmZXJlbmNlcycsXG5cdFx0XHRhbHRlcm5hdGl2ZURlY2xhcmF0aW9uQ29tbWFuZDogJ2VkaXRvci5hY3Rpb24uZ29Ub1JlZmVyZW5jZXMnLFxuXHRcdFx0YWx0ZXJuYXRpdmVJbXBsZW1lbnRhdGlvbkNvbW1hbmQ6ICcnLFxuXHRcdFx0YWx0ZXJuYXRpdmVSZWZlcmVuY2VDb21tYW5kOiAnJyxcblx0XHRcdGFsdGVybmF0aXZlVGVzdHNDb21tYW5kOiAnJyxcblx0XHR9O1xuXHRcdGNvbnN0IGpzb25TdWJzZXQ6IElKU09OU2NoZW1hID0ge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ3BlZWsnLCAnZ290b0FuZFBlZWsnLCAnZ290byddLFxuXHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMubXVsdGlwbGUsXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmdvdG9Mb2NhdGlvbi5tdWx0aXBsZS5wZWVrJywgJ1Nob3cgUGVlayB2aWV3IG9mIHRoZSByZXN1bHRzIChkZWZhdWx0KScpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5nb3RvTG9jYXRpb24ubXVsdGlwbGUuZ290b0FuZFBlZWsnLCAnR28gdG8gdGhlIHByaW1hcnkgcmVzdWx0IGFuZCBzaG93IGEgUGVlayB2aWV3JyksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmdvdG9Mb2NhdGlvbi5tdWx0aXBsZS5nb3RvJywgJ0dvIHRvIHRoZSBwcmltYXJ5IHJlc3VsdCBhbmQgZW5hYmxlIFBlZWstbGVzcyBuYXZpZ2F0aW9uIHRvIG90aGVycycpXG5cdFx0XHRdXG5cdFx0fTtcblx0XHRjb25zdCBhbHRlcm5hdGl2ZUNvbW1hbmRPcHRpb25zID0gWycnLCAnZWRpdG9yLmFjdGlvbi5yZWZlcmVuY2VTZWFyY2gudHJpZ2dlcicsICdlZGl0b3IuYWN0aW9uLmdvVG9SZWZlcmVuY2VzJywgJ2VkaXRvci5hY3Rpb24ucGVla0ltcGxlbWVudGF0aW9uJywgJ2VkaXRvci5hY3Rpb24uZ29Ub0ltcGxlbWVudGF0aW9uJywgJ2VkaXRvci5hY3Rpb24ucGVla1R5cGVEZWZpbml0aW9uJywgJ2VkaXRvci5hY3Rpb24uZ29Ub1R5cGVEZWZpbml0aW9uJywgJ2VkaXRvci5hY3Rpb24ucGVla0RlY2xhcmF0aW9uJywgJ2VkaXRvci5hY3Rpb24ucmV2ZWFsRGVjbGFyYXRpb24nLCAnZWRpdG9yLmFjdGlvbi5wZWVrRGVmaW5pdGlvbicsICdlZGl0b3IuYWN0aW9uLnJldmVhbERlZmluaXRpb25Bc2lkZScsICdlZGl0b3IuYWN0aW9uLnJldmVhbERlZmluaXRpb24nXTtcblx0XHRzdXBlcihcblx0XHRcdEVkaXRvck9wdGlvbi5nb3RvTG9jYXRpb24sICdnb3RvTG9jYXRpb24nLCBkZWZhdWx0cyxcblx0XHRcdHtcblx0XHRcdFx0J2VkaXRvci5nb3RvTG9jYXRpb24ubXVsdGlwbGUnOiB7XG5cdFx0XHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBubHMubG9jYWxpemUoJ2VkaXRvci5nb3RvTG9jYXRpb24ubXVsdGlwbGUuZGVwcmVjYXRlZCcsIFwiVGhpcyBzZXR0aW5nIGlzIGRlcHJlY2F0ZWQsIHBsZWFzZSB1c2Ugc2VwYXJhdGUgc2V0dGluZ3MgbGlrZSAnZWRpdG9yLmVkaXRvci5nb3RvTG9jYXRpb24ubXVsdGlwbGVEZWZpbml0aW9ucycgb3IgJ2VkaXRvci5lZGl0b3IuZ290b0xvY2F0aW9uLm11bHRpcGxlSW1wbGVtZW50YXRpb25zJyBpbnN0ZWFkLlwiKSxcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5nb3RvTG9jYXRpb24ubXVsdGlwbGVEZWZpbml0aW9ucyc6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3IuZWRpdG9yLmdvdG9Mb2NhdGlvbi5tdWx0aXBsZURlZmluaXRpb25zJywgXCJDb250cm9scyB0aGUgYmVoYXZpb3IgdGhlICdHbyB0byBEZWZpbml0aW9uJy1jb21tYW5kIHdoZW4gbXVsdGlwbGUgdGFyZ2V0IGxvY2F0aW9ucyBleGlzdC5cIiksXG5cdFx0XHRcdFx0Li4uanNvblN1YnNldCxcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5nb3RvTG9jYXRpb24ubXVsdGlwbGVUeXBlRGVmaW5pdGlvbnMnOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLmVkaXRvci5nb3RvTG9jYXRpb24ubXVsdGlwbGVUeXBlRGVmaW5pdGlvbnMnLCBcIkNvbnRyb2xzIHRoZSBiZWhhdmlvciB0aGUgJ0dvIHRvIFR5cGUgRGVmaW5pdGlvbictY29tbWFuZCB3aGVuIG11bHRpcGxlIHRhcmdldCBsb2NhdGlvbnMgZXhpc3QuXCIpLFxuXHRcdFx0XHRcdC4uLmpzb25TdWJzZXQsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuZ290b0xvY2F0aW9uLm11bHRpcGxlRGVjbGFyYXRpb25zJzoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5lZGl0b3IuZ290b0xvY2F0aW9uLm11bHRpcGxlRGVjbGFyYXRpb25zJywgXCJDb250cm9scyB0aGUgYmVoYXZpb3IgdGhlICdHbyB0byBEZWNsYXJhdGlvbictY29tbWFuZCB3aGVuIG11bHRpcGxlIHRhcmdldCBsb2NhdGlvbnMgZXhpc3QuXCIpLFxuXHRcdFx0XHRcdC4uLmpzb25TdWJzZXQsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuZ290b0xvY2F0aW9uLm11bHRpcGxlSW1wbGVtZW50YXRpb25zJzoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5lZGl0b3IuZ290b0xvY2F0aW9uLm11bHRpcGxlSW1wbGVtZW5hdHRpb25zJywgXCJDb250cm9scyB0aGUgYmVoYXZpb3IgdGhlICdHbyB0byBJbXBsZW1lbnRhdGlvbnMnLWNvbW1hbmQgd2hlbiBtdWx0aXBsZSB0YXJnZXQgbG9jYXRpb25zIGV4aXN0LlwiKSxcblx0XHRcdFx0XHQuLi5qc29uU3Vic2V0LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLmdvdG9Mb2NhdGlvbi5tdWx0aXBsZVJlZmVyZW5jZXMnOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLmVkaXRvci5nb3RvTG9jYXRpb24ubXVsdGlwbGVSZWZlcmVuY2VzJywgXCJDb250cm9scyB0aGUgYmVoYXZpb3IgdGhlICdHbyB0byBSZWZlcmVuY2VzJy1jb21tYW5kIHdoZW4gbXVsdGlwbGUgdGFyZ2V0IGxvY2F0aW9ucyBleGlzdC5cIiksXG5cdFx0XHRcdFx0Li4uanNvblN1YnNldCxcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5nb3RvTG9jYXRpb24uYWx0ZXJuYXRpdmVEZWZpbml0aW9uQ29tbWFuZCc6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5hbHRlcm5hdGl2ZURlZmluaXRpb25Db21tYW5kLFxuXHRcdFx0XHRcdGVudW06IGFsdGVybmF0aXZlQ29tbWFuZE9wdGlvbnMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnYWx0ZXJuYXRpdmVEZWZpbml0aW9uQ29tbWFuZCcsIFwiQWx0ZXJuYXRpdmUgY29tbWFuZCBpZCB0aGF0IGlzIGJlaW5nIGV4ZWN1dGVkIHdoZW4gdGhlIHJlc3VsdCBvZiAnR28gdG8gRGVmaW5pdGlvbicgaXMgdGhlIGN1cnJlbnQgbG9jYXRpb24uXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuZ290b0xvY2F0aW9uLmFsdGVybmF0aXZlVHlwZURlZmluaXRpb25Db21tYW5kJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmFsdGVybmF0aXZlVHlwZURlZmluaXRpb25Db21tYW5kLFxuXHRcdFx0XHRcdGVudW06IGFsdGVybmF0aXZlQ29tbWFuZE9wdGlvbnMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnYWx0ZXJuYXRpdmVUeXBlRGVmaW5pdGlvbkNvbW1hbmQnLCBcIkFsdGVybmF0aXZlIGNvbW1hbmQgaWQgdGhhdCBpcyBiZWluZyBleGVjdXRlZCB3aGVuIHRoZSByZXN1bHQgb2YgJ0dvIHRvIFR5cGUgRGVmaW5pdGlvbicgaXMgdGhlIGN1cnJlbnQgbG9jYXRpb24uXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuZ290b0xvY2F0aW9uLmFsdGVybmF0aXZlRGVjbGFyYXRpb25Db21tYW5kJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmFsdGVybmF0aXZlRGVjbGFyYXRpb25Db21tYW5kLFxuXHRcdFx0XHRcdGVudW06IGFsdGVybmF0aXZlQ29tbWFuZE9wdGlvbnMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnYWx0ZXJuYXRpdmVEZWNsYXJhdGlvbkNvbW1hbmQnLCBcIkFsdGVybmF0aXZlIGNvbW1hbmQgaWQgdGhhdCBpcyBiZWluZyBleGVjdXRlZCB3aGVuIHRoZSByZXN1bHQgb2YgJ0dvIHRvIERlY2xhcmF0aW9uJyBpcyB0aGUgY3VycmVudCBsb2NhdGlvbi5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5nb3RvTG9jYXRpb24uYWx0ZXJuYXRpdmVJbXBsZW1lbnRhdGlvbkNvbW1hbmQnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuYWx0ZXJuYXRpdmVJbXBsZW1lbnRhdGlvbkNvbW1hbmQsXG5cdFx0XHRcdFx0ZW51bTogYWx0ZXJuYXRpdmVDb21tYW5kT3B0aW9ucyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdhbHRlcm5hdGl2ZUltcGxlbWVudGF0aW9uQ29tbWFuZCcsIFwiQWx0ZXJuYXRpdmUgY29tbWFuZCBpZCB0aGF0IGlzIGJlaW5nIGV4ZWN1dGVkIHdoZW4gdGhlIHJlc3VsdCBvZiAnR28gdG8gSW1wbGVtZW50YXRpb24nIGlzIHRoZSBjdXJyZW50IGxvY2F0aW9uLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLmdvdG9Mb2NhdGlvbi5hbHRlcm5hdGl2ZVJlZmVyZW5jZUNvbW1hbmQnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuYWx0ZXJuYXRpdmVSZWZlcmVuY2VDb21tYW5kLFxuXHRcdFx0XHRcdGVudW06IGFsdGVybmF0aXZlQ29tbWFuZE9wdGlvbnMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnYWx0ZXJuYXRpdmVSZWZlcmVuY2VDb21tYW5kJywgXCJBbHRlcm5hdGl2ZSBjb21tYW5kIGlkIHRoYXQgaXMgYmVpbmcgZXhlY3V0ZWQgd2hlbiB0aGUgcmVzdWx0IG9mICdHbyB0byBSZWZlcmVuY2UnIGlzIHRoZSBjdXJyZW50IGxvY2F0aW9uLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgdmFsaWRhdGUoX2lucHV0OiBhbnkpOiBHb1RvTG9jYXRpb25PcHRpb25zIHtcblx0XHRpZiAoIV9pbnB1dCB8fCB0eXBlb2YgX2lucHV0ICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRjb25zdCBpbnB1dCA9IF9pbnB1dCBhcyBJR290b0xvY2F0aW9uT3B0aW9ucztcblx0XHRyZXR1cm4ge1xuXHRcdFx0bXVsdGlwbGU6IHN0cmluZ1NldDxHb1RvTG9jYXRpb25WYWx1ZXM+KGlucHV0Lm11bHRpcGxlLCB0aGlzLmRlZmF1bHRWYWx1ZS5tdWx0aXBsZSwgWydwZWVrJywgJ2dvdG9BbmRQZWVrJywgJ2dvdG8nXSksXG5cdFx0XHRtdWx0aXBsZURlZmluaXRpb25zOiBpbnB1dC5tdWx0aXBsZURlZmluaXRpb25zID8/IHN0cmluZ1NldDxHb1RvTG9jYXRpb25WYWx1ZXM+KGlucHV0Lm11bHRpcGxlRGVmaW5pdGlvbnMsICdwZWVrJywgWydwZWVrJywgJ2dvdG9BbmRQZWVrJywgJ2dvdG8nXSksXG5cdFx0XHRtdWx0aXBsZVR5cGVEZWZpbml0aW9uczogaW5wdXQubXVsdGlwbGVUeXBlRGVmaW5pdGlvbnMgPz8gc3RyaW5nU2V0PEdvVG9Mb2NhdGlvblZhbHVlcz4oaW5wdXQubXVsdGlwbGVUeXBlRGVmaW5pdGlvbnMsICdwZWVrJywgWydwZWVrJywgJ2dvdG9BbmRQZWVrJywgJ2dvdG8nXSksXG5cdFx0XHRtdWx0aXBsZURlY2xhcmF0aW9uczogaW5wdXQubXVsdGlwbGVEZWNsYXJhdGlvbnMgPz8gc3RyaW5nU2V0PEdvVG9Mb2NhdGlvblZhbHVlcz4oaW5wdXQubXVsdGlwbGVEZWNsYXJhdGlvbnMsICdwZWVrJywgWydwZWVrJywgJ2dvdG9BbmRQZWVrJywgJ2dvdG8nXSksXG5cdFx0XHRtdWx0aXBsZUltcGxlbWVudGF0aW9uczogaW5wdXQubXVsdGlwbGVJbXBsZW1lbnRhdGlvbnMgPz8gc3RyaW5nU2V0PEdvVG9Mb2NhdGlvblZhbHVlcz4oaW5wdXQubXVsdGlwbGVJbXBsZW1lbnRhdGlvbnMsICdwZWVrJywgWydwZWVrJywgJ2dvdG9BbmRQZWVrJywgJ2dvdG8nXSksXG5cdFx0XHRtdWx0aXBsZVJlZmVyZW5jZXM6IGlucHV0Lm11bHRpcGxlUmVmZXJlbmNlcyA/PyBzdHJpbmdTZXQ8R29Ub0xvY2F0aW9uVmFsdWVzPihpbnB1dC5tdWx0aXBsZVJlZmVyZW5jZXMsICdwZWVrJywgWydwZWVrJywgJ2dvdG9BbmRQZWVrJywgJ2dvdG8nXSksXG5cdFx0XHRtdWx0aXBsZVRlc3RzOiBpbnB1dC5tdWx0aXBsZVRlc3RzID8/IHN0cmluZ1NldDxHb1RvTG9jYXRpb25WYWx1ZXM+KGlucHV0Lm11bHRpcGxlVGVzdHMsICdwZWVrJywgWydwZWVrJywgJ2dvdG9BbmRQZWVrJywgJ2dvdG8nXSksXG5cdFx0XHRhbHRlcm5hdGl2ZURlZmluaXRpb25Db21tYW5kOiBFZGl0b3JTdHJpbmdPcHRpb24uc3RyaW5nKGlucHV0LmFsdGVybmF0aXZlRGVmaW5pdGlvbkNvbW1hbmQsIHRoaXMuZGVmYXVsdFZhbHVlLmFsdGVybmF0aXZlRGVmaW5pdGlvbkNvbW1hbmQpLFxuXHRcdFx0YWx0ZXJuYXRpdmVUeXBlRGVmaW5pdGlvbkNvbW1hbmQ6IEVkaXRvclN0cmluZ09wdGlvbi5zdHJpbmcoaW5wdXQuYWx0ZXJuYXRpdmVUeXBlRGVmaW5pdGlvbkNvbW1hbmQsIHRoaXMuZGVmYXVsdFZhbHVlLmFsdGVybmF0aXZlVHlwZURlZmluaXRpb25Db21tYW5kKSxcblx0XHRcdGFsdGVybmF0aXZlRGVjbGFyYXRpb25Db21tYW5kOiBFZGl0b3JTdHJpbmdPcHRpb24uc3RyaW5nKGlucHV0LmFsdGVybmF0aXZlRGVjbGFyYXRpb25Db21tYW5kLCB0aGlzLmRlZmF1bHRWYWx1ZS5hbHRlcm5hdGl2ZURlY2xhcmF0aW9uQ29tbWFuZCksXG5cdFx0XHRhbHRlcm5hdGl2ZUltcGxlbWVudGF0aW9uQ29tbWFuZDogRWRpdG9yU3RyaW5nT3B0aW9uLnN0cmluZyhpbnB1dC5hbHRlcm5hdGl2ZUltcGxlbWVudGF0aW9uQ29tbWFuZCwgdGhpcy5kZWZhdWx0VmFsdWUuYWx0ZXJuYXRpdmVJbXBsZW1lbnRhdGlvbkNvbW1hbmQpLFxuXHRcdFx0YWx0ZXJuYXRpdmVSZWZlcmVuY2VDb21tYW5kOiBFZGl0b3JTdHJpbmdPcHRpb24uc3RyaW5nKGlucHV0LmFsdGVybmF0aXZlUmVmZXJlbmNlQ29tbWFuZCwgdGhpcy5kZWZhdWx0VmFsdWUuYWx0ZXJuYXRpdmVSZWZlcmVuY2VDb21tYW5kKSxcblx0XHRcdGFsdGVybmF0aXZlVGVzdHNDb21tYW5kOiBFZGl0b3JTdHJpbmdPcHRpb24uc3RyaW5nKGlucHV0LmFsdGVybmF0aXZlVGVzdHNDb21tYW5kLCB0aGlzLmRlZmF1bHRWYWx1ZS5hbHRlcm5hdGl2ZVRlc3RzQ29tbWFuZCksXG5cdFx0fTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIGhvdmVyXG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciBlZGl0b3IgaG92ZXJcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJRWRpdG9ySG92ZXJPcHRpb25zIHtcblx0LyoqXG5cdCAqIEVuYWJsZSB0aGUgaG92ZXIuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRlbmFibGVkPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIERlbGF5IGZvciBzaG93aW5nIHRoZSBob3Zlci5cblx0ICogRGVmYXVsdHMgdG8gMzAwLlxuXHQgKi9cblx0ZGVsYXk/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBJcyB0aGUgaG92ZXIgc3RpY2t5IHN1Y2ggdGhhdCBpdCBjYW4gYmUgY2xpY2tlZCBhbmQgaXRzIGNvbnRlbnRzIHNlbGVjdGVkP1xuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0c3RpY2t5PzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIENvbnRyb2xzIGhvdyBsb25nIHRoZSBob3ZlciBpcyB2aXNpYmxlIGFmdGVyIHlvdSBob3ZlcmVkIG91dCBvZiBpdC5cblx0ICogUmVxdWlyZSBzdGlja3kgc2V0dGluZyB0byBiZSB0cnVlLlxuXHQgKi9cblx0aGlkaW5nRGVsYXk/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBTaG91bGQgdGhlIGhvdmVyIGJlIHNob3duIGFib3ZlIHRoZSBsaW5lIGlmIHBvc3NpYmxlP1xuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0ICovXG5cdGFib3ZlPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IHR5cGUgRWRpdG9ySG92ZXJPcHRpb25zID0gUmVhZG9ubHk8UmVxdWlyZWQ8SUVkaXRvckhvdmVyT3B0aW9ucz4+O1xuXG5jbGFzcyBFZGl0b3JIb3ZlciBleHRlbmRzIEJhc2VFZGl0b3JPcHRpb248RWRpdG9yT3B0aW9uLmhvdmVyLCBJRWRpdG9ySG92ZXJPcHRpb25zLCBFZGl0b3JIb3Zlck9wdGlvbnM+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBkZWZhdWx0czogRWRpdG9ySG92ZXJPcHRpb25zID0ge1xuXHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdGRlbGF5OiAzMDAsXG5cdFx0XHRoaWRpbmdEZWxheTogMzAwLFxuXHRcdFx0c3RpY2t5OiB0cnVlLFxuXHRcdFx0YWJvdmU6IHRydWUsXG5cdFx0fTtcblx0XHRzdXBlcihcblx0XHRcdEVkaXRvck9wdGlvbi5ob3ZlciwgJ2hvdmVyJywgZGVmYXVsdHMsXG5cdFx0XHR7XG5cdFx0XHRcdCdlZGl0b3IuaG92ZXIuZW5hYmxlZCc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuZW5hYmxlZCxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdob3Zlci5lbmFibGVkJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBob3ZlciBpcyBzaG93bi5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5ob3Zlci5kZWxheSc6IHtcblx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5kZWxheSxcblx0XHRcdFx0XHRtaW5pbXVtOiAwLFxuXHRcdFx0XHRcdG1heGltdW06IDEwMDAwLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2hvdmVyLmRlbGF5JywgXCJDb250cm9scyB0aGUgZGVsYXkgaW4gbWlsbGlzZWNvbmRzIGFmdGVyIHdoaWNoIHRoZSBob3ZlciBpcyBzaG93bi5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5ob3Zlci5zdGlja3knOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLnN0aWNreSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdob3Zlci5zdGlja3knLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGhvdmVyIHNob3VsZCByZW1haW4gdmlzaWJsZSB3aGVuIG1vdXNlIGlzIG1vdmVkIG92ZXIgaXQuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuaG92ZXIuaGlkaW5nRGVsYXknOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2ludGVnZXInLFxuXHRcdFx0XHRcdG1pbmltdW06IDAsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuaGlkaW5nRGVsYXksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnaG92ZXIuaGlkaW5nRGVsYXknLCBcIkNvbnRyb2xzIHRoZSBkZWxheSBpbiBtaWxsaXNlY29uZHMgYWZ0ZXIgd2hpY2ggdGhlIGhvdmVyIGlzIGhpZGRlbi4gUmVxdWlyZXMgYGVkaXRvci5ob3Zlci5zdGlja3lgIHRvIGJlIGVuYWJsZWQuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuaG92ZXIuYWJvdmUnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmFib3ZlLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2hvdmVyLmFib3ZlJywgXCJQcmVmZXIgc2hvd2luZyBob3ZlcnMgYWJvdmUgdGhlIGxpbmUsIGlmIHRoZXJlJ3Mgc3BhY2UuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShfaW5wdXQ6IGFueSk6IEVkaXRvckhvdmVyT3B0aW9ucyB7XG5cdFx0aWYgKCFfaW5wdXQgfHwgdHlwZW9mIF9pbnB1dCAhPT0gJ29iamVjdCcpIHtcblx0XHRcdHJldHVybiB0aGlzLmRlZmF1bHRWYWx1ZTtcblx0XHR9XG5cdFx0Y29uc3QgaW5wdXQgPSBfaW5wdXQgYXMgSUVkaXRvckhvdmVyT3B0aW9ucztcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZW5hYmxlZDogYm9vbGVhbihpbnB1dC5lbmFibGVkLCB0aGlzLmRlZmF1bHRWYWx1ZS5lbmFibGVkKSxcblx0XHRcdGRlbGF5OiBFZGl0b3JJbnRPcHRpb24uY2xhbXBlZEludChpbnB1dC5kZWxheSwgdGhpcy5kZWZhdWx0VmFsdWUuZGVsYXksIDAsIDEwMDAwKSxcblx0XHRcdHN0aWNreTogYm9vbGVhbihpbnB1dC5zdGlja3ksIHRoaXMuZGVmYXVsdFZhbHVlLnN0aWNreSksXG5cdFx0XHRoaWRpbmdEZWxheTogRWRpdG9ySW50T3B0aW9uLmNsYW1wZWRJbnQoaW5wdXQuaGlkaW5nRGVsYXksIHRoaXMuZGVmYXVsdFZhbHVlLmhpZGluZ0RlbGF5LCAwLCA2MDAwMDApLFxuXHRcdFx0YWJvdmU6IGJvb2xlYW4oaW5wdXQuYWJvdmUsIHRoaXMuZGVmYXVsdFZhbHVlLmFib3ZlKSxcblx0XHR9O1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gbGF5b3V0SW5mb1xuXG4vKipcbiAqIEEgZGVzY3JpcHRpb24gZm9yIHRoZSBvdmVydmlldyBydWxlciBwb3NpdGlvbi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBPdmVydmlld1J1bGVyUG9zaXRpb24ge1xuXHQvKipcblx0ICogV2lkdGggb2YgdGhlIG92ZXJ2aWV3IHJ1bGVyXG5cdCAqL1xuXHRyZWFkb25seSB3aWR0aDogbnVtYmVyO1xuXHQvKipcblx0ICogSGVpZ2h0IG9mIHRoZSBvdmVydmlldyBydWxlclxuXHQgKi9cblx0cmVhZG9ubHkgaGVpZ2h0OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBUb3AgcG9zaXRpb24gZm9yIHRoZSBvdmVydmlldyBydWxlclxuXHQgKi9cblx0cmVhZG9ubHkgdG9wOiBudW1iZXI7XG5cdC8qKlxuXHQgKiBSaWdodCBwb3NpdGlvbiBmb3IgdGhlIG92ZXJ2aWV3IHJ1bGVyXG5cdCAqL1xuXHRyZWFkb25seSByaWdodDogbnVtYmVyO1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBSZW5kZXJNaW5pbWFwIHtcblx0Tm9uZSA9IDAsXG5cdFRleHQgPSAxLFxuXHRCbG9ja3MgPSAyLFxufVxuXG4vKipcbiAqIFRoZSBpbnRlcm5hbCBsYXlvdXQgZGV0YWlscyBvZiB0aGUgZWRpdG9yLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEVkaXRvckxheW91dEluZm8ge1xuXG5cdC8qKlxuXHQgKiBGdWxsIGVkaXRvciB3aWR0aC5cblx0ICovXG5cdHJlYWRvbmx5IHdpZHRoOiBudW1iZXI7XG5cdC8qKlxuXHQgKiBGdWxsIGVkaXRvciBoZWlnaHQuXG5cdCAqL1xuXHRyZWFkb25seSBoZWlnaHQ6IG51bWJlcjtcblxuXHQvKipcblx0ICogTGVmdCBwb3NpdGlvbiBmb3IgdGhlIGdseXBoIG1hcmdpbi5cblx0ICovXG5cdHJlYWRvbmx5IGdseXBoTWFyZ2luTGVmdDogbnVtYmVyO1xuXHQvKipcblx0ICogVGhlIHdpZHRoIG9mIHRoZSBnbHlwaCBtYXJnaW4uXG5cdCAqL1xuXHRyZWFkb25seSBnbHlwaE1hcmdpbldpZHRoOiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIFRoZSBudW1iZXIgb2YgZGVjb3JhdGlvbiBsYW5lcyB0byByZW5kZXIgaW4gdGhlIGdseXBoIG1hcmdpbi5cblx0ICovXG5cdHJlYWRvbmx5IGdseXBoTWFyZ2luRGVjb3JhdGlvbkxhbmVDb3VudDogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBMZWZ0IHBvc2l0aW9uIGZvciB0aGUgbGluZSBudW1iZXJzLlxuXHQgKi9cblx0cmVhZG9ubHkgbGluZU51bWJlcnNMZWZ0OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBUaGUgd2lkdGggb2YgdGhlIGxpbmUgbnVtYmVycy5cblx0ICovXG5cdHJlYWRvbmx5IGxpbmVOdW1iZXJzV2lkdGg6IG51bWJlcjtcblxuXHQvKipcblx0ICogTGVmdCBwb3NpdGlvbiBmb3IgdGhlIGxpbmUgZGVjb3JhdGlvbnMuXG5cdCAqL1xuXHRyZWFkb25seSBkZWNvcmF0aW9uc0xlZnQ6IG51bWJlcjtcblx0LyoqXG5cdCAqIFRoZSB3aWR0aCBvZiB0aGUgbGluZSBkZWNvcmF0aW9ucy5cblx0ICovXG5cdHJlYWRvbmx5IGRlY29yYXRpb25zV2lkdGg6IG51bWJlcjtcblxuXHQvKipcblx0ICogTGVmdCBwb3NpdGlvbiBmb3IgdGhlIGNvbnRlbnQgKGFjdHVhbCB0ZXh0KVxuXHQgKi9cblx0cmVhZG9ubHkgY29udGVudExlZnQ6IG51bWJlcjtcblx0LyoqXG5cdCAqIFRoZSB3aWR0aCBvZiB0aGUgY29udGVudCAoYWN0dWFsIHRleHQpXG5cdCAqL1xuXHRyZWFkb25seSBjb250ZW50V2lkdGg6IG51bWJlcjtcblxuXHQvKipcblx0ICogTGF5b3V0IGluZm9ybWF0aW9uIGZvciB0aGUgbWluaW1hcFxuXHQgKi9cblx0cmVhZG9ubHkgbWluaW1hcDogRWRpdG9yTWluaW1hcExheW91dEluZm87XG5cblx0LyoqXG5cdCAqIFRoZSBudW1iZXIgb2YgY29sdW1ucyAob2YgdHlwaWNhbCBjaGFyYWN0ZXJzKSBmaXR0aW5nIG9uIGEgdmlld3BvcnQgbGluZS5cblx0ICovXG5cdHJlYWRvbmx5IHZpZXdwb3J0Q29sdW1uOiBudW1iZXI7XG5cblx0cmVhZG9ubHkgaXNXb3JkV3JhcE1pbmlmaWVkOiBib29sZWFuO1xuXHRyZWFkb25seSBpc1ZpZXdwb3J0V3JhcHBpbmc6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHdyYXBwaW5nQ29sdW1uOiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIFRoZSB3aWR0aCBvZiB0aGUgdmVydGljYWwgc2Nyb2xsYmFyLlxuXHQgKi9cblx0cmVhZG9ubHkgdmVydGljYWxTY3JvbGxiYXJXaWR0aDogbnVtYmVyO1xuXHQvKipcblx0ICogVGhlIGhlaWdodCBvZiB0aGUgaG9yaXpvbnRhbCBzY3JvbGxiYXIuXG5cdCAqL1xuXHRyZWFkb25seSBob3Jpem9udGFsU2Nyb2xsYmFySGVpZ2h0OiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIFRoZSBwb3NpdGlvbiBvZiB0aGUgb3ZlcnZpZXcgcnVsZXIuXG5cdCAqL1xuXHRyZWFkb25seSBvdmVydmlld1J1bGVyOiBPdmVydmlld1J1bGVyUG9zaXRpb247XG59XG5cbi8qKlxuICogVGhlIGludGVybmFsIGxheW91dCBkZXRhaWxzIG9mIHRoZSBlZGl0b3IuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRWRpdG9yTWluaW1hcExheW91dEluZm8ge1xuXHRyZWFkb25seSByZW5kZXJNaW5pbWFwOiBSZW5kZXJNaW5pbWFwO1xuXHRyZWFkb25seSBtaW5pbWFwTGVmdDogbnVtYmVyO1xuXHRyZWFkb25seSBtaW5pbWFwV2lkdGg6IG51bWJlcjtcblx0cmVhZG9ubHkgbWluaW1hcEhlaWdodElzRWRpdG9ySGVpZ2h0OiBib29sZWFuO1xuXHRyZWFkb25seSBtaW5pbWFwSXNTYW1wbGluZzogYm9vbGVhbjtcblx0cmVhZG9ubHkgbWluaW1hcFNjYWxlOiBudW1iZXI7XG5cdHJlYWRvbmx5IG1pbmltYXBMaW5lSGVpZ2h0OiBudW1iZXI7XG5cdHJlYWRvbmx5IG1pbmltYXBDYW52YXNJbm5lcldpZHRoOiBudW1iZXI7XG5cdHJlYWRvbmx5IG1pbmltYXBDYW52YXNJbm5lckhlaWdodDogbnVtYmVyO1xuXHRyZWFkb25seSBtaW5pbWFwQ2FudmFzT3V0ZXJXaWR0aDogbnVtYmVyO1xuXHRyZWFkb25seSBtaW5pbWFwQ2FudmFzT3V0ZXJIZWlnaHQ6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBFZGl0b3JMYXlvdXRJbmZvQ29tcHV0ZXJFbnYge1xuXHRyZWFkb25seSBtZW1vcnk6IENvbXB1dGVPcHRpb25zTWVtb3J5IHwgbnVsbDtcblx0cmVhZG9ubHkgb3V0ZXJXaWR0aDogbnVtYmVyO1xuXHRyZWFkb25seSBvdXRlckhlaWdodDogbnVtYmVyO1xuXHRyZWFkb25seSBpc0RvbWluYXRlZEJ5TG9uZ0xpbmVzOiBib29sZWFuO1xuXHRyZWFkb25seSBsaW5lSGVpZ2h0OiBudW1iZXI7XG5cdHJlYWRvbmx5IHZpZXdMaW5lQ291bnQ6IG51bWJlcjtcblx0cmVhZG9ubHkgbGluZU51bWJlcnNEaWdpdENvdW50OiBudW1iZXI7XG5cdHJlYWRvbmx5IHR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aDogbnVtYmVyO1xuXHRyZWFkb25seSBtYXhEaWdpdFdpZHRoOiBudW1iZXI7XG5cdHJlYWRvbmx5IHBpeGVsUmF0aW86IG51bWJlcjtcblx0cmVhZG9ubHkgZ2x5cGhNYXJnaW5EZWNvcmF0aW9uTGFuZUNvdW50OiBudW1iZXI7XG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSUVkaXRvckxheW91dENvbXB1dGVySW5wdXQge1xuXHRyZWFkb25seSBvdXRlcldpZHRoOiBudW1iZXI7XG5cdHJlYWRvbmx5IG91dGVySGVpZ2h0OiBudW1iZXI7XG5cdHJlYWRvbmx5IGlzRG9taW5hdGVkQnlMb25nTGluZXM6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGxpbmVIZWlnaHQ6IG51bWJlcjtcblx0cmVhZG9ubHkgbGluZU51bWJlcnNEaWdpdENvdW50OiBudW1iZXI7XG5cdHJlYWRvbmx5IHR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aDogbnVtYmVyO1xuXHRyZWFkb25seSBtYXhEaWdpdFdpZHRoOiBudW1iZXI7XG5cdHJlYWRvbmx5IHBpeGVsUmF0aW86IG51bWJlcjtcblx0cmVhZG9ubHkgZ2x5cGhNYXJnaW46IGJvb2xlYW47XG5cdHJlYWRvbmx5IGxpbmVEZWNvcmF0aW9uc1dpZHRoOiBzdHJpbmcgfCBudW1iZXI7XG5cdHJlYWRvbmx5IGZvbGRpbmc6IGJvb2xlYW47XG5cdHJlYWRvbmx5IG1pbmltYXA6IFJlYWRvbmx5PFJlcXVpcmVkPElFZGl0b3JNaW5pbWFwT3B0aW9ucz4+O1xuXHRyZWFkb25seSBzY3JvbGxiYXI6IEludGVybmFsRWRpdG9yU2Nyb2xsYmFyT3B0aW9ucztcblx0cmVhZG9ubHkgbGluZU51bWJlcnM6IEludGVybmFsRWRpdG9yUmVuZGVyTGluZU51bWJlcnNPcHRpb25zO1xuXHRyZWFkb25seSBsaW5lTnVtYmVyc01pbkNoYXJzOiBudW1iZXI7XG5cdHJlYWRvbmx5IHNjcm9sbEJleW9uZExhc3RMaW5lOiBib29sZWFuO1xuXHRyZWFkb25seSB3b3JkV3JhcDogJ3dvcmRXcmFwQ29sdW1uJyB8ICdvbicgfCAnb2ZmJyB8ICdib3VuZGVkJztcblx0cmVhZG9ubHkgd29yZFdyYXBDb2x1bW46IG51bWJlcjtcblx0cmVhZG9ubHkgd29yZFdyYXBNaW5pZmllZDogYm9vbGVhbjtcblx0cmVhZG9ubHkgYWNjZXNzaWJpbGl0eVN1cHBvcnQ6IEFjY2Vzc2liaWxpdHlTdXBwb3J0O1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgaW50ZXJmYWNlIElNaW5pbWFwTGF5b3V0SW5wdXQge1xuXHRyZWFkb25seSBvdXRlcldpZHRoOiBudW1iZXI7XG5cdHJlYWRvbmx5IG91dGVySGVpZ2h0OiBudW1iZXI7XG5cdHJlYWRvbmx5IGxpbmVIZWlnaHQ6IG51bWJlcjtcblx0cmVhZG9ubHkgdHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoOiBudW1iZXI7XG5cdHJlYWRvbmx5IHBpeGVsUmF0aW86IG51bWJlcjtcblx0cmVhZG9ubHkgc2Nyb2xsQmV5b25kTGFzdExpbmU6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHBhZGRpbmdUb3A6IG51bWJlcjtcblx0cmVhZG9ubHkgcGFkZGluZ0JvdHRvbTogbnVtYmVyO1xuXHRyZWFkb25seSBtaW5pbWFwOiBSZWFkb25seTxSZXF1aXJlZDxJRWRpdG9yTWluaW1hcE9wdGlvbnM+Pjtcblx0cmVhZG9ubHkgdmVydGljYWxTY3JvbGxiYXJXaWR0aDogbnVtYmVyO1xuXHRyZWFkb25seSB2aWV3TGluZUNvdW50OiBudW1iZXI7XG5cdHJlYWRvbmx5IHJlbWFpbmluZ1dpZHRoOiBudW1iZXI7XG5cdHJlYWRvbmx5IGlzVmlld3BvcnRXcmFwcGluZzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGNsYXNzIEVkaXRvckxheW91dEluZm9Db21wdXRlciBleHRlbmRzIENvbXB1dGVkRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvLCBFZGl0b3JMYXlvdXRJbmZvPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pO1xuXHR9XG5cblx0cHVibGljIGNvbXB1dGUoZW52OiBJRW52aXJvbm1lbnRhbE9wdGlvbnMsIG9wdGlvbnM6IElDb21wdXRlZEVkaXRvck9wdGlvbnMsIF86IEVkaXRvckxheW91dEluZm8pOiBFZGl0b3JMYXlvdXRJbmZvIHtcblx0XHRyZXR1cm4gRWRpdG9yTGF5b3V0SW5mb0NvbXB1dGVyLmNvbXB1dGVMYXlvdXQob3B0aW9ucywge1xuXHRcdFx0bWVtb3J5OiBlbnYubWVtb3J5LFxuXHRcdFx0b3V0ZXJXaWR0aDogZW52Lm91dGVyV2lkdGgsXG5cdFx0XHRvdXRlckhlaWdodDogZW52Lm91dGVySGVpZ2h0LFxuXHRcdFx0aXNEb21pbmF0ZWRCeUxvbmdMaW5lczogZW52LmlzRG9taW5hdGVkQnlMb25nTGluZXMsXG5cdFx0XHRsaW5lSGVpZ2h0OiBlbnYuZm9udEluZm8ubGluZUhlaWdodCxcblx0XHRcdHZpZXdMaW5lQ291bnQ6IGVudi52aWV3TGluZUNvdW50LFxuXHRcdFx0bGluZU51bWJlcnNEaWdpdENvdW50OiBlbnYubGluZU51bWJlcnNEaWdpdENvdW50LFxuXHRcdFx0dHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoOiBlbnYuZm9udEluZm8udHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoLFxuXHRcdFx0bWF4RGlnaXRXaWR0aDogZW52LmZvbnRJbmZvLm1heERpZ2l0V2lkdGgsXG5cdFx0XHRwaXhlbFJhdGlvOiBlbnYucGl4ZWxSYXRpbyxcblx0XHRcdGdseXBoTWFyZ2luRGVjb3JhdGlvbkxhbmVDb3VudDogZW52LmdseXBoTWFyZ2luRGVjb3JhdGlvbkxhbmVDb3VudFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBjb21wdXRlQ29udGFpbmVkTWluaW1hcExpbmVDb3VudChpbnB1dDoge1xuXHRcdHZpZXdMaW5lQ291bnQ6IG51bWJlcjtcblx0XHRzY3JvbGxCZXlvbmRMYXN0TGluZTogYm9vbGVhbjtcblx0XHRwYWRkaW5nVG9wOiBudW1iZXI7XG5cdFx0cGFkZGluZ0JvdHRvbTogbnVtYmVyO1xuXHRcdGhlaWdodDogbnVtYmVyO1xuXHRcdGxpbmVIZWlnaHQ6IG51bWJlcjtcblx0XHRwaXhlbFJhdGlvOiBudW1iZXI7XG5cdH0pOiB7IHR5cGljYWxWaWV3cG9ydExpbmVDb3VudDogbnVtYmVyOyBleHRyYUxpbmVzQmVmb3JlRmlyc3RMaW5lOiBudW1iZXI7IGV4dHJhTGluZXNCZXlvbmRMYXN0TGluZTogbnVtYmVyOyBkZXNpcmVkUmF0aW86IG51bWJlcjsgbWluaW1hcExpbmVDb3VudDogbnVtYmVyIH0ge1xuXHRcdGNvbnN0IHR5cGljYWxWaWV3cG9ydExpbmVDb3VudCA9IGlucHV0LmhlaWdodCAvIGlucHV0LmxpbmVIZWlnaHQ7XG5cdFx0Y29uc3QgZXh0cmFMaW5lc0JlZm9yZUZpcnN0TGluZSA9IE1hdGguZmxvb3IoaW5wdXQucGFkZGluZ1RvcCAvIGlucHV0LmxpbmVIZWlnaHQpO1xuXHRcdGxldCBleHRyYUxpbmVzQmV5b25kTGFzdExpbmUgPSBNYXRoLmZsb29yKGlucHV0LnBhZGRpbmdCb3R0b20gLyBpbnB1dC5saW5lSGVpZ2h0KTtcblx0XHRpZiAoaW5wdXQuc2Nyb2xsQmV5b25kTGFzdExpbmUpIHtcblx0XHRcdGV4dHJhTGluZXNCZXlvbmRMYXN0TGluZSA9IE1hdGgubWF4KGV4dHJhTGluZXNCZXlvbmRMYXN0TGluZSwgdHlwaWNhbFZpZXdwb3J0TGluZUNvdW50IC0gMSk7XG5cdFx0fVxuXHRcdGNvbnN0IGRlc2lyZWRSYXRpbyA9IChleHRyYUxpbmVzQmVmb3JlRmlyc3RMaW5lICsgaW5wdXQudmlld0xpbmVDb3VudCArIGV4dHJhTGluZXNCZXlvbmRMYXN0TGluZSkgLyAoaW5wdXQucGl4ZWxSYXRpbyAqIGlucHV0LmhlaWdodCk7XG5cdFx0Y29uc3QgbWluaW1hcExpbmVDb3VudCA9IE1hdGguZmxvb3IoaW5wdXQudmlld0xpbmVDb3VudCAvIGRlc2lyZWRSYXRpbyk7XG5cdFx0cmV0dXJuIHsgdHlwaWNhbFZpZXdwb3J0TGluZUNvdW50LCBleHRyYUxpbmVzQmVmb3JlRmlyc3RMaW5lLCBleHRyYUxpbmVzQmV5b25kTGFzdExpbmUsIGRlc2lyZWRSYXRpbywgbWluaW1hcExpbmVDb3VudCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2NvbXB1dGVNaW5pbWFwTGF5b3V0KGlucHV0OiBJTWluaW1hcExheW91dElucHV0LCBtZW1vcnk6IENvbXB1dGVPcHRpb25zTWVtb3J5KTogRWRpdG9yTWluaW1hcExheW91dEluZm8ge1xuXHRcdGNvbnN0IG91dGVyV2lkdGggPSBpbnB1dC5vdXRlcldpZHRoO1xuXHRcdGNvbnN0IG91dGVySGVpZ2h0ID0gaW5wdXQub3V0ZXJIZWlnaHQ7XG5cdFx0Y29uc3QgcGl4ZWxSYXRpbyA9IGlucHV0LnBpeGVsUmF0aW87XG5cblx0XHRpZiAoIWlucHV0Lm1pbmltYXAuZW5hYmxlZCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cmVuZGVyTWluaW1hcDogUmVuZGVyTWluaW1hcC5Ob25lLFxuXHRcdFx0XHRtaW5pbWFwTGVmdDogMCxcblx0XHRcdFx0bWluaW1hcFdpZHRoOiAwLFxuXHRcdFx0XHRtaW5pbWFwSGVpZ2h0SXNFZGl0b3JIZWlnaHQ6IGZhbHNlLFxuXHRcdFx0XHRtaW5pbWFwSXNTYW1wbGluZzogZmFsc2UsXG5cdFx0XHRcdG1pbmltYXBTY2FsZTogMSxcblx0XHRcdFx0bWluaW1hcExpbmVIZWlnaHQ6IDEsXG5cdFx0XHRcdG1pbmltYXBDYW52YXNJbm5lcldpZHRoOiAwLFxuXHRcdFx0XHRtaW5pbWFwQ2FudmFzSW5uZXJIZWlnaHQ6IE1hdGguZmxvb3IocGl4ZWxSYXRpbyAqIG91dGVySGVpZ2h0KSxcblx0XHRcdFx0bWluaW1hcENhbnZhc091dGVyV2lkdGg6IDAsXG5cdFx0XHRcdG1pbmltYXBDYW52YXNPdXRlckhlaWdodDogb3V0ZXJIZWlnaHQsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIENhbiB1c2UgbWVtb3J5IGlmIG9ubHkgdGhlIGB2aWV3TGluZUNvdW50YCBhbmQgYHJlbWFpbmluZ1dpZHRoYCBoYXZlIGNoYW5nZWRcblx0XHRjb25zdCBzdGFibGVNaW5pbWFwTGF5b3V0SW5wdXQgPSBtZW1vcnkuc3RhYmxlTWluaW1hcExheW91dElucHV0O1xuXHRcdGNvbnN0IGNvdWxkVXNlTWVtb3J5ID0gKFxuXHRcdFx0c3RhYmxlTWluaW1hcExheW91dElucHV0XG5cdFx0XHQvLyAmJiBpbnB1dC5vdXRlcldpZHRoID09PSBsYXN0TWluaW1hcExheW91dElucHV0Lm91dGVyV2lkdGggISEhIElOVEVOVElPTkFMIE9NSVRURURcblx0XHRcdCYmIGlucHV0Lm91dGVySGVpZ2h0ID09PSBzdGFibGVNaW5pbWFwTGF5b3V0SW5wdXQub3V0ZXJIZWlnaHRcblx0XHRcdCYmIGlucHV0LmxpbmVIZWlnaHQgPT09IHN0YWJsZU1pbmltYXBMYXlvdXRJbnB1dC5saW5lSGVpZ2h0XG5cdFx0XHQmJiBpbnB1dC50eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGggPT09IHN0YWJsZU1pbmltYXBMYXlvdXRJbnB1dC50eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGhcblx0XHRcdCYmIGlucHV0LnBpeGVsUmF0aW8gPT09IHN0YWJsZU1pbmltYXBMYXlvdXRJbnB1dC5waXhlbFJhdGlvXG5cdFx0XHQmJiBpbnB1dC5zY3JvbGxCZXlvbmRMYXN0TGluZSA9PT0gc3RhYmxlTWluaW1hcExheW91dElucHV0LnNjcm9sbEJleW9uZExhc3RMaW5lXG5cdFx0XHQmJiBpbnB1dC5wYWRkaW5nVG9wID09PSBzdGFibGVNaW5pbWFwTGF5b3V0SW5wdXQucGFkZGluZ1RvcFxuXHRcdFx0JiYgaW5wdXQucGFkZGluZ0JvdHRvbSA9PT0gc3RhYmxlTWluaW1hcExheW91dElucHV0LnBhZGRpbmdCb3R0b21cblx0XHRcdCYmIGlucHV0Lm1pbmltYXAuZW5hYmxlZCA9PT0gc3RhYmxlTWluaW1hcExheW91dElucHV0Lm1pbmltYXAuZW5hYmxlZFxuXHRcdFx0JiYgaW5wdXQubWluaW1hcC5zaWRlID09PSBzdGFibGVNaW5pbWFwTGF5b3V0SW5wdXQubWluaW1hcC5zaWRlXG5cdFx0XHQmJiBpbnB1dC5taW5pbWFwLnNpemUgPT09IHN0YWJsZU1pbmltYXBMYXlvdXRJbnB1dC5taW5pbWFwLnNpemVcblx0XHRcdCYmIGlucHV0Lm1pbmltYXAuc2hvd1NsaWRlciA9PT0gc3RhYmxlTWluaW1hcExheW91dElucHV0Lm1pbmltYXAuc2hvd1NsaWRlclxuXHRcdFx0JiYgaW5wdXQubWluaW1hcC5yZW5kZXJDaGFyYWN0ZXJzID09PSBzdGFibGVNaW5pbWFwTGF5b3V0SW5wdXQubWluaW1hcC5yZW5kZXJDaGFyYWN0ZXJzXG5cdFx0XHQmJiBpbnB1dC5taW5pbWFwLm1heENvbHVtbiA9PT0gc3RhYmxlTWluaW1hcExheW91dElucHV0Lm1pbmltYXAubWF4Q29sdW1uXG5cdFx0XHQmJiBpbnB1dC5taW5pbWFwLnNjYWxlID09PSBzdGFibGVNaW5pbWFwTGF5b3V0SW5wdXQubWluaW1hcC5zY2FsZVxuXHRcdFx0JiYgaW5wdXQudmVydGljYWxTY3JvbGxiYXJXaWR0aCA9PT0gc3RhYmxlTWluaW1hcExheW91dElucHV0LnZlcnRpY2FsU2Nyb2xsYmFyV2lkdGhcblx0XHRcdC8vICYmIGlucHV0LnZpZXdMaW5lQ291bnQgPT09IGxhc3RNaW5pbWFwTGF5b3V0SW5wdXQudmlld0xpbmVDb3VudCAhISEgSU5URU5USU9OQUwgT01JVFRFRFxuXHRcdFx0Ly8gJiYgaW5wdXQucmVtYWluaW5nV2lkdGggPT09IGxhc3RNaW5pbWFwTGF5b3V0SW5wdXQucmVtYWluaW5nV2lkdGggISEhIElOVEVOVElPTkFMIE9NSVRURURcblx0XHRcdCYmIGlucHV0LmlzVmlld3BvcnRXcmFwcGluZyA9PT0gc3RhYmxlTWluaW1hcExheW91dElucHV0LmlzVmlld3BvcnRXcmFwcGluZ1xuXHRcdCk7XG5cblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gaW5wdXQubGluZUhlaWdodDtcblx0XHRjb25zdCB0eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGggPSBpbnB1dC50eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGg7XG5cdFx0Y29uc3Qgc2Nyb2xsQmV5b25kTGFzdExpbmUgPSBpbnB1dC5zY3JvbGxCZXlvbmRMYXN0TGluZTtcblx0XHRjb25zdCBtaW5pbWFwUmVuZGVyQ2hhcmFjdGVycyA9IGlucHV0Lm1pbmltYXAucmVuZGVyQ2hhcmFjdGVycztcblx0XHRsZXQgbWluaW1hcFNjYWxlID0gKHBpeGVsUmF0aW8gPj0gMiA/IE1hdGgucm91bmQoaW5wdXQubWluaW1hcC5zY2FsZSAqIDIpIDogaW5wdXQubWluaW1hcC5zY2FsZSk7XG5cdFx0Y29uc3QgbWluaW1hcE1heENvbHVtbiA9IGlucHV0Lm1pbmltYXAubWF4Q29sdW1uO1xuXHRcdGNvbnN0IG1pbmltYXBTaXplID0gaW5wdXQubWluaW1hcC5zaXplO1xuXHRcdGNvbnN0IG1pbmltYXBTaWRlID0gaW5wdXQubWluaW1hcC5zaWRlO1xuXHRcdGNvbnN0IHZlcnRpY2FsU2Nyb2xsYmFyV2lkdGggPSBpbnB1dC52ZXJ0aWNhbFNjcm9sbGJhcldpZHRoO1xuXHRcdGNvbnN0IHZpZXdMaW5lQ291bnQgPSBpbnB1dC52aWV3TGluZUNvdW50O1xuXHRcdGNvbnN0IHJlbWFpbmluZ1dpZHRoID0gaW5wdXQucmVtYWluaW5nV2lkdGg7XG5cdFx0Y29uc3QgaXNWaWV3cG9ydFdyYXBwaW5nID0gaW5wdXQuaXNWaWV3cG9ydFdyYXBwaW5nO1xuXG5cdFx0Y29uc3QgYmFzZUNoYXJIZWlnaHQgPSBtaW5pbWFwUmVuZGVyQ2hhcmFjdGVycyA/IDIgOiAzO1xuXHRcdGxldCBtaW5pbWFwQ2FudmFzSW5uZXJIZWlnaHQgPSBNYXRoLmZsb29yKHBpeGVsUmF0aW8gKiBvdXRlckhlaWdodCk7XG5cdFx0Y29uc3QgbWluaW1hcENhbnZhc091dGVySGVpZ2h0ID0gbWluaW1hcENhbnZhc0lubmVySGVpZ2h0IC8gcGl4ZWxSYXRpbztcblx0XHRsZXQgbWluaW1hcEhlaWdodElzRWRpdG9ySGVpZ2h0ID0gZmFsc2U7XG5cdFx0bGV0IG1pbmltYXBJc1NhbXBsaW5nID0gZmFsc2U7XG5cdFx0bGV0IG1pbmltYXBMaW5lSGVpZ2h0ID0gYmFzZUNoYXJIZWlnaHQgKiBtaW5pbWFwU2NhbGU7XG5cdFx0bGV0IG1pbmltYXBDaGFyV2lkdGggPSBtaW5pbWFwU2NhbGUgLyBwaXhlbFJhdGlvO1xuXHRcdGxldCBtaW5pbWFwV2lkdGhNdWx0aXBsaWVyOiBudW1iZXIgPSAxO1xuXG5cdFx0aWYgKG1pbmltYXBTaXplID09PSAnZmlsbCcgfHwgbWluaW1hcFNpemUgPT09ICdmaXQnKSB7XG5cdFx0XHRjb25zdCB7IHR5cGljYWxWaWV3cG9ydExpbmVDb3VudCwgZXh0cmFMaW5lc0JlZm9yZUZpcnN0TGluZSwgZXh0cmFMaW5lc0JleW9uZExhc3RMaW5lLCBkZXNpcmVkUmF0aW8sIG1pbmltYXBMaW5lQ291bnQgfSA9IEVkaXRvckxheW91dEluZm9Db21wdXRlci5jb21wdXRlQ29udGFpbmVkTWluaW1hcExpbmVDb3VudCh7XG5cdFx0XHRcdHZpZXdMaW5lQ291bnQ6IHZpZXdMaW5lQ291bnQsXG5cdFx0XHRcdHNjcm9sbEJleW9uZExhc3RMaW5lOiBzY3JvbGxCZXlvbmRMYXN0TGluZSxcblx0XHRcdFx0cGFkZGluZ1RvcDogaW5wdXQucGFkZGluZ1RvcCxcblx0XHRcdFx0cGFkZGluZ0JvdHRvbTogaW5wdXQucGFkZGluZ0JvdHRvbSxcblx0XHRcdFx0aGVpZ2h0OiBvdXRlckhlaWdodCxcblx0XHRcdFx0bGluZUhlaWdodDogbGluZUhlaWdodCxcblx0XHRcdFx0cGl4ZWxSYXRpbzogcGl4ZWxSYXRpb1xuXHRcdFx0fSk7XG5cdFx0XHQvLyByYXRpbyBpcyBpbnRlbnRpb25hbGx5IG5vdCBwYXJ0IG9mIHRoZSBsYXlvdXQgdG8gYXZvaWQgdGhlIGxheW91dCBjaGFuZ2luZyBhbGwgdGhlIHRpbWVcblx0XHRcdC8vIHdoZW4gZG9pbmcgc2FtcGxpbmdcblx0XHRcdGNvbnN0IHJhdGlvID0gdmlld0xpbmVDb3VudCAvIG1pbmltYXBMaW5lQ291bnQ7XG5cblx0XHRcdGlmIChyYXRpbyA+IDEpIHtcblx0XHRcdFx0bWluaW1hcEhlaWdodElzRWRpdG9ySGVpZ2h0ID0gdHJ1ZTtcblx0XHRcdFx0bWluaW1hcElzU2FtcGxpbmcgPSB0cnVlO1xuXHRcdFx0XHRtaW5pbWFwU2NhbGUgPSAxO1xuXHRcdFx0XHRtaW5pbWFwTGluZUhlaWdodCA9IDE7XG5cdFx0XHRcdG1pbmltYXBDaGFyV2lkdGggPSBtaW5pbWFwU2NhbGUgLyBwaXhlbFJhdGlvO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGV0IGZpdEJlY29tZXNGaWxsID0gZmFsc2U7XG5cdFx0XHRcdGxldCBtYXhNaW5pbWFwU2NhbGUgPSBtaW5pbWFwU2NhbGUgKyAxO1xuXG5cdFx0XHRcdGlmIChtaW5pbWFwU2l6ZSA9PT0gJ2ZpdCcpIHtcblx0XHRcdFx0XHRjb25zdCBlZmZlY3RpdmVNaW5pbWFwSGVpZ2h0ID0gTWF0aC5jZWlsKChleHRyYUxpbmVzQmVmb3JlRmlyc3RMaW5lICsgdmlld0xpbmVDb3VudCArIGV4dHJhTGluZXNCZXlvbmRMYXN0TGluZSkgKiBtaW5pbWFwTGluZUhlaWdodCk7XG5cdFx0XHRcdFx0aWYgKGlzVmlld3BvcnRXcmFwcGluZyAmJiBjb3VsZFVzZU1lbW9yeSAmJiByZW1haW5pbmdXaWR0aCA8PSBtZW1vcnkuc3RhYmxlRml0UmVtYWluaW5nV2lkdGgpIHtcblx0XHRcdFx0XHRcdC8vIFRoZXJlIGlzIGEgbG9vcCB3aGVuIHVzaW5nIGBmaXRgIGFuZCB2aWV3cG9ydCB3cmFwcGluZzpcblx0XHRcdFx0XHRcdC8vIC0gdmlldyBsaW5lIGNvdW50IGltcGFjdHMgbWluaW1hcCBsYXlvdXRcblx0XHRcdFx0XHRcdC8vIC0gbWluaW1hcCBsYXlvdXQgaW1wYWN0cyB2aWV3cG9ydCB3aWR0aFxuXHRcdFx0XHRcdFx0Ly8gLSB2aWV3cG9ydCB3aWR0aCBpbXBhY3RzIHZpZXcgbGluZSBjb3VudFxuXHRcdFx0XHRcdFx0Ly8gVG8gYnJlYWsgdGhlIGxvb3AsIG9uY2Ugd2UgZ28gdG8gYSBzbWFsbGVyIG1pbmltYXAgc2NhbGUsIHdlIHRyeSB0byBzdGljayB3aXRoIGl0LlxuXHRcdFx0XHRcdFx0Zml0QmVjb21lc0ZpbGwgPSB0cnVlO1xuXHRcdFx0XHRcdFx0bWF4TWluaW1hcFNjYWxlID0gbWVtb3J5LnN0YWJsZUZpdE1heE1pbmltYXBTY2FsZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Zml0QmVjb21lc0ZpbGwgPSAoZWZmZWN0aXZlTWluaW1hcEhlaWdodCA+IG1pbmltYXBDYW52YXNJbm5lckhlaWdodCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKG1pbmltYXBTaXplID09PSAnZmlsbCcgfHwgZml0QmVjb21lc0ZpbGwpIHtcblx0XHRcdFx0XHRtaW5pbWFwSGVpZ2h0SXNFZGl0b3JIZWlnaHQgPSB0cnVlO1xuXHRcdFx0XHRcdGNvbnN0IGNvbmZpZ3VyZWRNaW5pbWFwU2NhbGUgPSBtaW5pbWFwU2NhbGU7XG5cdFx0XHRcdFx0bWluaW1hcExpbmVIZWlnaHQgPSBNYXRoLm1pbihsaW5lSGVpZ2h0ICogcGl4ZWxSYXRpbywgTWF0aC5tYXgoMSwgTWF0aC5mbG9vcigxIC8gZGVzaXJlZFJhdGlvKSkpO1xuXHRcdFx0XHRcdGlmIChpc1ZpZXdwb3J0V3JhcHBpbmcgJiYgY291bGRVc2VNZW1vcnkgJiYgcmVtYWluaW5nV2lkdGggPD0gbWVtb3J5LnN0YWJsZUZpdFJlbWFpbmluZ1dpZHRoKSB7XG5cdFx0XHRcdFx0XHQvLyBUaGVyZSBpcyBhIGxvb3Agd2hlbiB1c2luZyBgZmlsbGAgYW5kIHZpZXdwb3J0IHdyYXBwaW5nOlxuXHRcdFx0XHRcdFx0Ly8gLSB2aWV3IGxpbmUgY291bnQgaW1wYWN0cyBtaW5pbWFwIGxheW91dFxuXHRcdFx0XHRcdFx0Ly8gLSBtaW5pbWFwIGxheW91dCBpbXBhY3RzIHZpZXdwb3J0IHdpZHRoXG5cdFx0XHRcdFx0XHQvLyAtIHZpZXdwb3J0IHdpZHRoIGltcGFjdHMgdmlldyBsaW5lIGNvdW50XG5cdFx0XHRcdFx0XHQvLyBUbyBicmVhayB0aGUgbG9vcCwgb25jZSB3ZSBnbyB0byBhIHNtYWxsZXIgbWluaW1hcCBzY2FsZSwgd2UgdHJ5IHRvIHN0aWNrIHdpdGggaXQuXG5cdFx0XHRcdFx0XHRtYXhNaW5pbWFwU2NhbGUgPSBtZW1vcnkuc3RhYmxlRml0TWF4TWluaW1hcFNjYWxlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRtaW5pbWFwU2NhbGUgPSBNYXRoLm1pbihtYXhNaW5pbWFwU2NhbGUsIE1hdGgubWF4KDEsIE1hdGguZmxvb3IobWluaW1hcExpbmVIZWlnaHQgLyBiYXNlQ2hhckhlaWdodCkpKTtcblx0XHRcdFx0XHRpZiAobWluaW1hcFNjYWxlID4gY29uZmlndXJlZE1pbmltYXBTY2FsZSkge1xuXHRcdFx0XHRcdFx0bWluaW1hcFdpZHRoTXVsdGlwbGllciA9IE1hdGgubWluKDIsIG1pbmltYXBTY2FsZSAvIGNvbmZpZ3VyZWRNaW5pbWFwU2NhbGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRtaW5pbWFwQ2hhcldpZHRoID0gbWluaW1hcFNjYWxlIC8gcGl4ZWxSYXRpbyAvIG1pbmltYXBXaWR0aE11bHRpcGxpZXI7XG5cdFx0XHRcdFx0bWluaW1hcENhbnZhc0lubmVySGVpZ2h0ID0gTWF0aC5jZWlsKChNYXRoLm1heCh0eXBpY2FsVmlld3BvcnRMaW5lQ291bnQsIGV4dHJhTGluZXNCZWZvcmVGaXJzdExpbmUgKyB2aWV3TGluZUNvdW50ICsgZXh0cmFMaW5lc0JleW9uZExhc3RMaW5lKSkgKiBtaW5pbWFwTGluZUhlaWdodCk7XG5cdFx0XHRcdFx0aWYgKGlzVmlld3BvcnRXcmFwcGluZykge1xuXHRcdFx0XHRcdFx0Ly8gcmVtZW1iZXIgZm9yIG5leHQgdGltZVxuXHRcdFx0XHRcdFx0bWVtb3J5LnN0YWJsZU1pbmltYXBMYXlvdXRJbnB1dCA9IGlucHV0O1xuXHRcdFx0XHRcdFx0bWVtb3J5LnN0YWJsZUZpdFJlbWFpbmluZ1dpZHRoID0gcmVtYWluaW5nV2lkdGg7XG5cdFx0XHRcdFx0XHRtZW1vcnkuc3RhYmxlRml0TWF4TWluaW1hcFNjYWxlID0gbWluaW1hcFNjYWxlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRtZW1vcnkuc3RhYmxlTWluaW1hcExheW91dElucHV0ID0gbnVsbDtcblx0XHRcdFx0XHRcdG1lbW9yeS5zdGFibGVGaXRSZW1haW5pbmdXaWR0aCA9IDA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gR2l2ZW46XG5cdFx0Ly8gKGxlYXZpbmcgMnB4IGZvciB0aGUgY3Vyc29yIHRvIGhhdmUgc3BhY2UgYWZ0ZXIgdGhlIGxhc3QgY2hhcmFjdGVyKVxuXHRcdC8vIHZpZXdwb3J0Q29sdW1uID0gKGNvbnRlbnRXaWR0aCAtIHZlcnRpY2FsU2Nyb2xsYmFyV2lkdGggLSAyKSAvIHR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aFxuXHRcdC8vIG1pbmltYXBXaWR0aCA9IHZpZXdwb3J0Q29sdW1uICogbWluaW1hcENoYXJXaWR0aFxuXHRcdC8vIGNvbnRlbnRXaWR0aCA9IHJlbWFpbmluZ1dpZHRoIC0gbWluaW1hcFdpZHRoXG5cdFx0Ly8gV2hhdCBhcmUgZ29vZCB2YWx1ZXMgZm9yIGNvbnRlbnRXaWR0aCBhbmQgbWluaW1hcFdpZHRoID9cblxuXHRcdC8vIG1pbmltYXBXaWR0aCA9ICgoY29udGVudFdpZHRoIC0gdmVydGljYWxTY3JvbGxiYXJXaWR0aCAtIDIpIC8gdHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoKSAqIG1pbmltYXBDaGFyV2lkdGhcblx0XHQvLyB0eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGggKiBtaW5pbWFwV2lkdGggPSAoY29udGVudFdpZHRoIC0gdmVydGljYWxTY3JvbGxiYXJXaWR0aCAtIDIpICogbWluaW1hcENoYXJXaWR0aFxuXHRcdC8vIHR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCAqIG1pbmltYXBXaWR0aCA9IChyZW1haW5pbmdXaWR0aCAtIG1pbmltYXBXaWR0aCAtIHZlcnRpY2FsU2Nyb2xsYmFyV2lkdGggLSAyKSAqIG1pbmltYXBDaGFyV2lkdGhcblx0XHQvLyAodHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoICsgbWluaW1hcENoYXJXaWR0aCkgKiBtaW5pbWFwV2lkdGggPSAocmVtYWluaW5nV2lkdGggLSB2ZXJ0aWNhbFNjcm9sbGJhcldpZHRoIC0gMikgKiBtaW5pbWFwQ2hhcldpZHRoXG5cdFx0Ly8gbWluaW1hcFdpZHRoID0gKChyZW1haW5pbmdXaWR0aCAtIHZlcnRpY2FsU2Nyb2xsYmFyV2lkdGggLSAyKSAqIG1pbmltYXBDaGFyV2lkdGgpIC8gKHR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCArIG1pbmltYXBDaGFyV2lkdGgpXG5cblx0XHRjb25zdCBtaW5pbWFwTWF4V2lkdGggPSBNYXRoLmZsb29yKG1pbmltYXBNYXhDb2x1bW4gKiBtaW5pbWFwQ2hhcldpZHRoKTtcblx0XHRjb25zdCBtaW5pbWFwV2lkdGggPSBNYXRoLm1pbihtaW5pbWFwTWF4V2lkdGgsIE1hdGgubWF4KDAsIE1hdGguZmxvb3IoKChyZW1haW5pbmdXaWR0aCAtIHZlcnRpY2FsU2Nyb2xsYmFyV2lkdGggLSAyKSAqIG1pbmltYXBDaGFyV2lkdGgpIC8gKHR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCArIG1pbmltYXBDaGFyV2lkdGgpKSkgKyBNSU5JTUFQX0dVVFRFUl9XSURUSCk7XG5cblx0XHRsZXQgbWluaW1hcENhbnZhc0lubmVyV2lkdGggPSBNYXRoLmZsb29yKHBpeGVsUmF0aW8gKiBtaW5pbWFwV2lkdGgpO1xuXHRcdGNvbnN0IG1pbmltYXBDYW52YXNPdXRlcldpZHRoID0gbWluaW1hcENhbnZhc0lubmVyV2lkdGggLyBwaXhlbFJhdGlvO1xuXHRcdG1pbmltYXBDYW52YXNJbm5lcldpZHRoID0gTWF0aC5mbG9vcihtaW5pbWFwQ2FudmFzSW5uZXJXaWR0aCAqIG1pbmltYXBXaWR0aE11bHRpcGxpZXIpO1xuXG5cdFx0Y29uc3QgcmVuZGVyTWluaW1hcCA9IChtaW5pbWFwUmVuZGVyQ2hhcmFjdGVycyA/IFJlbmRlck1pbmltYXAuVGV4dCA6IFJlbmRlck1pbmltYXAuQmxvY2tzKTtcblx0XHRjb25zdCBtaW5pbWFwTGVmdCA9IChtaW5pbWFwU2lkZSA9PT0gJ2xlZnQnID8gMCA6IChvdXRlcldpZHRoIC0gbWluaW1hcFdpZHRoIC0gdmVydGljYWxTY3JvbGxiYXJXaWR0aCkpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlbmRlck1pbmltYXAsXG5cdFx0XHRtaW5pbWFwTGVmdCxcblx0XHRcdG1pbmltYXBXaWR0aCxcblx0XHRcdG1pbmltYXBIZWlnaHRJc0VkaXRvckhlaWdodCxcblx0XHRcdG1pbmltYXBJc1NhbXBsaW5nLFxuXHRcdFx0bWluaW1hcFNjYWxlLFxuXHRcdFx0bWluaW1hcExpbmVIZWlnaHQsXG5cdFx0XHRtaW5pbWFwQ2FudmFzSW5uZXJXaWR0aCxcblx0XHRcdG1pbmltYXBDYW52YXNJbm5lckhlaWdodCxcblx0XHRcdG1pbmltYXBDYW52YXNPdXRlcldpZHRoLFxuXHRcdFx0bWluaW1hcENhbnZhc091dGVySGVpZ2h0LFxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGNvbXB1dGVMYXlvdXQob3B0aW9uczogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucywgZW52OiBFZGl0b3JMYXlvdXRJbmZvQ29tcHV0ZXJFbnYpOiBFZGl0b3JMYXlvdXRJbmZvIHtcblx0XHRjb25zdCBvdXRlcldpZHRoID0gZW52Lm91dGVyV2lkdGggfCAwO1xuXHRcdGNvbnN0IG91dGVySGVpZ2h0ID0gZW52Lm91dGVySGVpZ2h0IHwgMDtcblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gZW52LmxpbmVIZWlnaHQgfCAwO1xuXHRcdGNvbnN0IGxpbmVOdW1iZXJzRGlnaXRDb3VudCA9IGVudi5saW5lTnVtYmVyc0RpZ2l0Q291bnQgfCAwO1xuXHRcdGNvbnN0IHR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCA9IGVudi50eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGg7XG5cdFx0Y29uc3QgbWF4RGlnaXRXaWR0aCA9IGVudi5tYXhEaWdpdFdpZHRoO1xuXHRcdGNvbnN0IHBpeGVsUmF0aW8gPSBlbnYucGl4ZWxSYXRpbztcblx0XHRjb25zdCB2aWV3TGluZUNvdW50ID0gZW52LnZpZXdMaW5lQ291bnQ7XG5cblx0XHRjb25zdCB3b3JkV3JhcE92ZXJyaWRlMiA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53b3JkV3JhcE92ZXJyaWRlMik7XG5cdFx0Y29uc3Qgd29yZFdyYXBPdmVycmlkZTEgPSAod29yZFdyYXBPdmVycmlkZTIgPT09ICdpbmhlcml0JyA/IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53b3JkV3JhcE92ZXJyaWRlMSkgOiB3b3JkV3JhcE92ZXJyaWRlMik7XG5cdFx0Y29uc3Qgd29yZFdyYXAgPSAod29yZFdyYXBPdmVycmlkZTEgPT09ICdpbmhlcml0JyA/IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53b3JkV3JhcCkgOiB3b3JkV3JhcE92ZXJyaWRlMSk7XG5cblx0XHRjb25zdCB3b3JkV3JhcENvbHVtbiA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53b3JkV3JhcENvbHVtbik7XG5cdFx0Y29uc3QgaXNEb21pbmF0ZWRCeUxvbmdMaW5lcyA9IGVudi5pc0RvbWluYXRlZEJ5TG9uZ0xpbmVzO1xuXG5cdFx0Y29uc3Qgc2hvd0dseXBoTWFyZ2luID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmdseXBoTWFyZ2luKTtcblx0XHRjb25zdCBzaG93TGluZU51bWJlcnMgPSAob3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxpbmVOdW1iZXJzKS5yZW5kZXJUeXBlICE9PSBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT2ZmKTtcblx0XHRjb25zdCBsaW5lTnVtYmVyc01pbkNoYXJzID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxpbmVOdW1iZXJzTWluQ2hhcnMpO1xuXHRcdGNvbnN0IHNjcm9sbEJleW9uZExhc3RMaW5lID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnNjcm9sbEJleW9uZExhc3RMaW5lKTtcblx0XHRjb25zdCBwYWRkaW5nID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnBhZGRpbmcpO1xuXHRcdGNvbnN0IG1pbmltYXAgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ubWluaW1hcCk7XG5cblx0XHRjb25zdCBzY3JvbGxiYXIgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uc2Nyb2xsYmFyKTtcblx0XHRjb25zdCB2ZXJ0aWNhbFNjcm9sbGJhcldpZHRoID0gc2Nyb2xsYmFyLnZlcnRpY2FsU2Nyb2xsYmFyU2l6ZTtcblx0XHRjb25zdCB2ZXJ0aWNhbFNjcm9sbGJhckhhc0Fycm93cyA9IHNjcm9sbGJhci52ZXJ0aWNhbEhhc0Fycm93cztcblx0XHRjb25zdCBzY3JvbGxiYXJBcnJvd1NpemUgPSBzY3JvbGxiYXIuYXJyb3dTaXplO1xuXHRcdGNvbnN0IGhvcml6b250YWxTY3JvbGxiYXJIZWlnaHQgPSBzY3JvbGxiYXIuaG9yaXpvbnRhbFNjcm9sbGJhclNpemU7XG5cblx0XHRjb25zdCBmb2xkaW5nID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmZvbGRpbmcpO1xuXHRcdGNvbnN0IHNob3dGb2xkaW5nRGVjb3JhdGlvbiA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5zaG93Rm9sZGluZ0NvbnRyb2xzKSAhPT0gJ25ldmVyJztcblxuXHRcdGxldCBsaW5lRGVjb3JhdGlvbnNXaWR0aCA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5saW5lRGVjb3JhdGlvbnNXaWR0aCk7XG5cdFx0aWYgKGZvbGRpbmcgJiYgc2hvd0ZvbGRpbmdEZWNvcmF0aW9uKSB7XG5cdFx0XHRsaW5lRGVjb3JhdGlvbnNXaWR0aCArPSAxNjtcblx0XHR9XG5cblx0XHRsZXQgbGluZU51bWJlcnNXaWR0aCA9IDA7XG5cdFx0aWYgKHNob3dMaW5lTnVtYmVycykge1xuXHRcdFx0Y29uc3QgZGlnaXRDb3VudCA9IE1hdGgubWF4KGxpbmVOdW1iZXJzRGlnaXRDb3VudCwgbGluZU51bWJlcnNNaW5DaGFycyk7XG5cdFx0XHRsaW5lTnVtYmVyc1dpZHRoID0gTWF0aC5yb3VuZChkaWdpdENvdW50ICogbWF4RGlnaXRXaWR0aCk7XG5cdFx0fVxuXG5cdFx0bGV0IGdseXBoTWFyZ2luV2lkdGggPSAwO1xuXHRcdGlmIChzaG93R2x5cGhNYXJnaW4pIHtcblx0XHRcdGdseXBoTWFyZ2luV2lkdGggPSBsaW5lSGVpZ2h0ICogZW52LmdseXBoTWFyZ2luRGVjb3JhdGlvbkxhbmVDb3VudDtcblx0XHR9XG5cblx0XHRsZXQgZ2x5cGhNYXJnaW5MZWZ0ID0gMDtcblx0XHRsZXQgbGluZU51bWJlcnNMZWZ0ID0gZ2x5cGhNYXJnaW5MZWZ0ICsgZ2x5cGhNYXJnaW5XaWR0aDtcblx0XHRsZXQgZGVjb3JhdGlvbnNMZWZ0ID0gbGluZU51bWJlcnNMZWZ0ICsgbGluZU51bWJlcnNXaWR0aDtcblx0XHRsZXQgY29udGVudExlZnQgPSBkZWNvcmF0aW9uc0xlZnQgKyBsaW5lRGVjb3JhdGlvbnNXaWR0aDtcblxuXHRcdGNvbnN0IHJlbWFpbmluZ1dpZHRoID0gb3V0ZXJXaWR0aCAtIGdseXBoTWFyZ2luV2lkdGggLSBsaW5lTnVtYmVyc1dpZHRoIC0gbGluZURlY29yYXRpb25zV2lkdGg7XG5cblx0XHRsZXQgaXNXb3JkV3JhcE1pbmlmaWVkID0gZmFsc2U7XG5cdFx0bGV0IGlzVmlld3BvcnRXcmFwcGluZyA9IGZhbHNlO1xuXHRcdGxldCB3cmFwcGluZ0NvbHVtbiA9IC0xO1xuXG5cdFx0aWYgKHdvcmRXcmFwT3ZlcnJpZGUxID09PSAnaW5oZXJpdCcgJiYgaXNEb21pbmF0ZWRCeUxvbmdMaW5lcykge1xuXHRcdFx0Ly8gRm9yY2Ugdmlld3BvcnQgd2lkdGggd3JhcHBpbmcgaWYgbW9kZWwgaXMgZG9taW5hdGVkIGJ5IGxvbmcgbGluZXNcblx0XHRcdGlzV29yZFdyYXBNaW5pZmllZCA9IHRydWU7XG5cdFx0XHRpc1ZpZXdwb3J0V3JhcHBpbmcgPSB0cnVlO1xuXHRcdH0gZWxzZSBpZiAod29yZFdyYXAgPT09ICdvbicgfHwgd29yZFdyYXAgPT09ICdib3VuZGVkJykge1xuXHRcdFx0aXNWaWV3cG9ydFdyYXBwaW5nID0gdHJ1ZTtcblx0XHR9IGVsc2UgaWYgKHdvcmRXcmFwID09PSAnd29yZFdyYXBDb2x1bW4nKSB7XG5cdFx0XHR3cmFwcGluZ0NvbHVtbiA9IHdvcmRXcmFwQ29sdW1uO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1pbmltYXBMYXlvdXQgPSBFZGl0b3JMYXlvdXRJbmZvQ29tcHV0ZXIuX2NvbXB1dGVNaW5pbWFwTGF5b3V0KHtcblx0XHRcdG91dGVyV2lkdGg6IG91dGVyV2lkdGgsXG5cdFx0XHRvdXRlckhlaWdodDogb3V0ZXJIZWlnaHQsXG5cdFx0XHRsaW5lSGVpZ2h0OiBsaW5lSGVpZ2h0LFxuXHRcdFx0dHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoOiB0eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGgsXG5cdFx0XHRwaXhlbFJhdGlvOiBwaXhlbFJhdGlvLFxuXHRcdFx0c2Nyb2xsQmV5b25kTGFzdExpbmU6IHNjcm9sbEJleW9uZExhc3RMaW5lLFxuXHRcdFx0cGFkZGluZ1RvcDogcGFkZGluZy50b3AsXG5cdFx0XHRwYWRkaW5nQm90dG9tOiBwYWRkaW5nLmJvdHRvbSxcblx0XHRcdG1pbmltYXA6IG1pbmltYXAsXG5cdFx0XHR2ZXJ0aWNhbFNjcm9sbGJhcldpZHRoOiB2ZXJ0aWNhbFNjcm9sbGJhcldpZHRoLFxuXHRcdFx0dmlld0xpbmVDb3VudDogdmlld0xpbmVDb3VudCxcblx0XHRcdHJlbWFpbmluZ1dpZHRoOiByZW1haW5pbmdXaWR0aCxcblx0XHRcdGlzVmlld3BvcnRXcmFwcGluZzogaXNWaWV3cG9ydFdyYXBwaW5nLFxuXHRcdH0sIGVudi5tZW1vcnkgfHwgbmV3IENvbXB1dGVPcHRpb25zTWVtb3J5KCkpO1xuXG5cdFx0aWYgKG1pbmltYXBMYXlvdXQucmVuZGVyTWluaW1hcCAhPT0gUmVuZGVyTWluaW1hcC5Ob25lICYmIG1pbmltYXBMYXlvdXQubWluaW1hcExlZnQgPT09IDApIHtcblx0XHRcdC8vIHRoZSBtaW5pbWFwIGlzIHJlbmRlcmVkIHRvIHRoZSBsZWZ0LCBzbyBtb3ZlIGV2ZXJ5dGhpbmcgdG8gdGhlIHJpZ2h0XG5cdFx0XHRnbHlwaE1hcmdpbkxlZnQgKz0gbWluaW1hcExheW91dC5taW5pbWFwV2lkdGg7XG5cdFx0XHRsaW5lTnVtYmVyc0xlZnQgKz0gbWluaW1hcExheW91dC5taW5pbWFwV2lkdGg7XG5cdFx0XHRkZWNvcmF0aW9uc0xlZnQgKz0gbWluaW1hcExheW91dC5taW5pbWFwV2lkdGg7XG5cdFx0XHRjb250ZW50TGVmdCArPSBtaW5pbWFwTGF5b3V0Lm1pbmltYXBXaWR0aDtcblx0XHR9XG5cdFx0Y29uc3QgY29udGVudFdpZHRoID0gcmVtYWluaW5nV2lkdGggLSBtaW5pbWFwTGF5b3V0Lm1pbmltYXBXaWR0aDtcblxuXHRcdC8vIChsZWF2aW5nIDJweCBmb3IgdGhlIGN1cnNvciB0byBoYXZlIHNwYWNlIGFmdGVyIHRoZSBsYXN0IGNoYXJhY3Rlcilcblx0XHRjb25zdCB2aWV3cG9ydENvbHVtbiA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3IoKGNvbnRlbnRXaWR0aCAtIHZlcnRpY2FsU2Nyb2xsYmFyV2lkdGggLSAyKSAvIHR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCkpO1xuXG5cdFx0Y29uc3QgdmVydGljYWxBcnJvd1NpemUgPSAodmVydGljYWxTY3JvbGxiYXJIYXNBcnJvd3MgPyBzY3JvbGxiYXJBcnJvd1NpemUgOiAwKTtcblxuXHRcdGlmIChpc1ZpZXdwb3J0V3JhcHBpbmcpIHtcblx0XHRcdC8vIGNvbXB1dGUgdGhlIGFjdHVhbCB3cmFwcGluZ0NvbHVtblxuXHRcdFx0d3JhcHBpbmdDb2x1bW4gPSBNYXRoLm1heCgxLCB2aWV3cG9ydENvbHVtbik7XG5cdFx0XHRpZiAod29yZFdyYXAgPT09ICdib3VuZGVkJykge1xuXHRcdFx0XHR3cmFwcGluZ0NvbHVtbiA9IE1hdGgubWluKHdyYXBwaW5nQ29sdW1uLCB3b3JkV3JhcENvbHVtbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHdpZHRoOiBvdXRlcldpZHRoLFxuXHRcdFx0aGVpZ2h0OiBvdXRlckhlaWdodCxcblxuXHRcdFx0Z2x5cGhNYXJnaW5MZWZ0OiBnbHlwaE1hcmdpbkxlZnQsXG5cdFx0XHRnbHlwaE1hcmdpbldpZHRoOiBnbHlwaE1hcmdpbldpZHRoLFxuXHRcdFx0Z2x5cGhNYXJnaW5EZWNvcmF0aW9uTGFuZUNvdW50OiBlbnYuZ2x5cGhNYXJnaW5EZWNvcmF0aW9uTGFuZUNvdW50LFxuXG5cdFx0XHRsaW5lTnVtYmVyc0xlZnQ6IGxpbmVOdW1iZXJzTGVmdCxcblx0XHRcdGxpbmVOdW1iZXJzV2lkdGg6IGxpbmVOdW1iZXJzV2lkdGgsXG5cblx0XHRcdGRlY29yYXRpb25zTGVmdDogZGVjb3JhdGlvbnNMZWZ0LFxuXHRcdFx0ZGVjb3JhdGlvbnNXaWR0aDogbGluZURlY29yYXRpb25zV2lkdGgsXG5cblx0XHRcdGNvbnRlbnRMZWZ0OiBjb250ZW50TGVmdCxcblx0XHRcdGNvbnRlbnRXaWR0aDogY29udGVudFdpZHRoLFxuXG5cdFx0XHRtaW5pbWFwOiBtaW5pbWFwTGF5b3V0LFxuXG5cdFx0XHR2aWV3cG9ydENvbHVtbjogdmlld3BvcnRDb2x1bW4sXG5cblx0XHRcdGlzV29yZFdyYXBNaW5pZmllZDogaXNXb3JkV3JhcE1pbmlmaWVkLFxuXHRcdFx0aXNWaWV3cG9ydFdyYXBwaW5nOiBpc1ZpZXdwb3J0V3JhcHBpbmcsXG5cdFx0XHR3cmFwcGluZ0NvbHVtbjogd3JhcHBpbmdDb2x1bW4sXG5cblx0XHRcdHZlcnRpY2FsU2Nyb2xsYmFyV2lkdGg6IHZlcnRpY2FsU2Nyb2xsYmFyV2lkdGgsXG5cdFx0XHRob3Jpem9udGFsU2Nyb2xsYmFySGVpZ2h0OiBob3Jpem9udGFsU2Nyb2xsYmFySGVpZ2h0LFxuXG5cdFx0XHRvdmVydmlld1J1bGVyOiB7XG5cdFx0XHRcdHRvcDogdmVydGljYWxBcnJvd1NpemUsXG5cdFx0XHRcdHdpZHRoOiB2ZXJ0aWNhbFNjcm9sbGJhcldpZHRoLFxuXHRcdFx0XHRoZWlnaHQ6IChvdXRlckhlaWdodCAtIDIgKiB2ZXJ0aWNhbEFycm93U2l6ZSksXG5cdFx0XHRcdHJpZ2h0OiAwXG5cdFx0XHR9XG5cdFx0fTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIFdyYXBwaW5nU3RyYXRlZ3lcbmNsYXNzIFdyYXBwaW5nU3RyYXRlZ3kgZXh0ZW5kcyBCYXNlRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi53cmFwcGluZ1N0cmF0ZWd5LCAnc2ltcGxlJyB8ICdhZHZhbmNlZCcsICdzaW1wbGUnIHwgJ2FkdmFuY2VkJz4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKEVkaXRvck9wdGlvbi53cmFwcGluZ1N0cmF0ZWd5LCAnd3JhcHBpbmdTdHJhdGVneScsICdzaW1wbGUnLFxuXHRcdFx0e1xuXHRcdFx0XHQnZWRpdG9yLndyYXBwaW5nU3RyYXRlZ3knOiB7XG5cdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCd3cmFwcGluZ1N0cmF0ZWd5LnNpbXBsZScsIFwiQXNzdW1lcyB0aGF0IGFsbCBjaGFyYWN0ZXJzIGFyZSBvZiB0aGUgc2FtZSB3aWR0aC4gVGhpcyBpcyBhIGZhc3QgYWxnb3JpdGhtIHRoYXQgd29ya3MgY29ycmVjdGx5IGZvciBtb25vc3BhY2UgZm9udHMgYW5kIGNlcnRhaW4gc2NyaXB0cyAobGlrZSBMYXRpbiBjaGFyYWN0ZXJzKSB3aGVyZSBnbHlwaHMgYXJlIG9mIGVxdWFsIHdpZHRoLlwiKSxcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnd3JhcHBpbmdTdHJhdGVneS5hZHZhbmNlZCcsIFwiRGVsZWdhdGVzIHdyYXBwaW5nIHBvaW50cyBjb21wdXRhdGlvbiB0byB0aGUgYnJvd3Nlci4gVGhpcyBpcyBhIHNsb3cgYWxnb3JpdGhtLCB0aGF0IG1pZ2h0IGNhdXNlIGZyZWV6ZXMgZm9yIGxhcmdlIGZpbGVzLCBidXQgaXQgd29ya3MgY29ycmVjdGx5IGluIGFsbCBjYXNlcy5cIilcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGVudW06IFsnc2ltcGxlJywgJ2FkdmFuY2VkJ10sXG5cdFx0XHRcdFx0ZGVmYXVsdDogJ3NpbXBsZScsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnd3JhcHBpbmdTdHJhdGVneScsIFwiQ29udHJvbHMgdGhlIGFsZ29yaXRobSB0aGF0IGNvbXB1dGVzIHdyYXBwaW5nIHBvaW50cy4gTm90ZSB0aGF0IHdoZW4gaW4gYWNjZXNzaWJpbGl0eSBtb2RlLCBhZHZhbmNlZCB3aWxsIGJlIHVzZWQgZm9yIHRoZSBiZXN0IGV4cGVyaWVuY2UuXCIpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKGlucHV0OiBhbnkpOiAnc2ltcGxlJyB8ICdhZHZhbmNlZCcge1xuXHRcdHJldHVybiBzdHJpbmdTZXQ8J3NpbXBsZScgfCAnYWR2YW5jZWQnPihpbnB1dCwgJ3NpbXBsZScsIFsnc2ltcGxlJywgJ2FkdmFuY2VkJ10pO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGNvbXB1dGUoZW52OiBJRW52aXJvbm1lbnRhbE9wdGlvbnMsIG9wdGlvbnM6IElDb21wdXRlZEVkaXRvck9wdGlvbnMsIHZhbHVlOiAnc2ltcGxlJyB8ICdhZHZhbmNlZCcpOiAnc2ltcGxlJyB8ICdhZHZhbmNlZCcge1xuXHRcdGNvbnN0IGFjY2Vzc2liaWxpdHlTdXBwb3J0ID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmFjY2Vzc2liaWxpdHlTdXBwb3J0KTtcblx0XHRpZiAoYWNjZXNzaWJpbGl0eVN1cHBvcnQgPT09IEFjY2Vzc2liaWxpdHlTdXBwb3J0LkVuYWJsZWQpIHtcblx0XHRcdC8vIGlmIHdlIGtub3cgZm9yIGEgZmFjdCB0aGF0IGEgc2NyZWVuIHJlYWRlciBpcyBhdHRhY2hlZCwgd2Ugc3dpdGNoIG91ciBzdHJhdGVneSB0byBhZHZhbmNlZCB0b1xuXHRcdFx0Ly8gaGVscCB0aGF0IHRoZSBlZGl0b3IncyB3cmFwcGluZyBwb2ludHMgbWF0Y2ggdGhlIHRleHRhcmVhJ3Mgd3JhcHBpbmcgcG9pbnRzXG5cdFx0XHRyZXR1cm4gJ2FkdmFuY2VkJztcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG59XG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIGxpZ2h0YnVsYlxuXG5leHBvcnQgZW51bSBTaG93TGlnaHRidWxiSWNvbk1vZGUge1xuXHRPZmYgPSAnb2ZmJyxcblx0T25Db2RlID0gJ29uQ29kZScsXG5cdE9uID0gJ29uJ1xufVxuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgZWRpdG9yIGxpZ2h0YnVsYlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElFZGl0b3JMaWdodGJ1bGJPcHRpb25zIHtcblx0LyoqXG5cdCAqIEVuYWJsZSB0aGUgbGlnaHRidWxiIGNvZGUgYWN0aW9uLlxuXHQgKiBUaGUgdGhyZWUgcG9zc2libGUgdmFsdWVzIGFyZSBgb2ZmYCwgYG9uYCBhbmQgYG9uQ29kZWAgYW5kIHRoZSBkZWZhdWx0IGlzIGBvbkNvZGVgLlxuXHQgKiBgb2ZmYCBkaXNhYmxlcyB0aGUgY29kZSBhY3Rpb24gbWVudS5cblx0ICogYG9uYCBzaG93cyB0aGUgY29kZSBhY3Rpb24gbWVudSBvbiBjb2RlIGFuZCBvbiBlbXB0eSBsaW5lcy5cblx0ICogYG9uQ29kZWAgc2hvd3MgdGhlIGNvZGUgYWN0aW9uIG1lbnUgb24gY29kZSBvbmx5LlxuXHQgKi9cblx0ZW5hYmxlZD86IFNob3dMaWdodGJ1bGJJY29uTW9kZTtcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IHR5cGUgRWRpdG9yTGlnaHRidWxiT3B0aW9ucyA9IFJlYWRvbmx5PFJlcXVpcmVkPElFZGl0b3JMaWdodGJ1bGJPcHRpb25zPj47XG5cbmNsYXNzIEVkaXRvckxpZ2h0YnVsYiBleHRlbmRzIEJhc2VFZGl0b3JPcHRpb248RWRpdG9yT3B0aW9uLmxpZ2h0YnVsYiwgSUVkaXRvckxpZ2h0YnVsYk9wdGlvbnMsIEVkaXRvckxpZ2h0YnVsYk9wdGlvbnM+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBkZWZhdWx0czogRWRpdG9yTGlnaHRidWxiT3B0aW9ucyA9IHsgZW5hYmxlZDogU2hvd0xpZ2h0YnVsYkljb25Nb2RlLk9uQ29kZSB9O1xuXHRcdHN1cGVyKFxuXHRcdFx0RWRpdG9yT3B0aW9uLmxpZ2h0YnVsYiwgJ2xpZ2h0YnVsYicsIGRlZmF1bHRzLFxuXHRcdFx0e1xuXHRcdFx0XHQnZWRpdG9yLmxpZ2h0YnVsYi5lbmFibGVkJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGVudW06IFtTaG93TGlnaHRidWxiSWNvbk1vZGUuT2ZmLCBTaG93TGlnaHRidWxiSWNvbk1vZGUuT25Db2RlLCBTaG93TGlnaHRidWxiSWNvbk1vZGUuT25dLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmVuYWJsZWQsXG5cdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IubGlnaHRidWxiLmVuYWJsZWQub2ZmJywgJ0Rpc2FibGUgdGhlIGNvZGUgYWN0aW9uIG1lbnUuJyksXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5saWdodGJ1bGIuZW5hYmxlZC5vbkNvZGUnLCAnU2hvdyB0aGUgY29kZSBhY3Rpb24gbWVudSB3aGVuIHRoZSBjdXJzb3IgaXMgb24gbGluZXMgd2l0aCBjb2RlLicpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IubGlnaHRidWxiLmVuYWJsZWQub24nLCAnU2hvdyB0aGUgY29kZSBhY3Rpb24gbWVudSB3aGVuIHRoZSBjdXJzb3IgaXMgb24gbGluZXMgd2l0aCBjb2RlIG9yIG9uIGVtcHR5IGxpbmVzLicpLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZW5hYmxlZCcsIFwiRW5hYmxlcyB0aGUgQ29kZSBBY3Rpb24gbGlnaHRidWxiIGluIHRoZSBlZGl0b3IuXCIpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKF9pbnB1dDogYW55KTogRWRpdG9yTGlnaHRidWxiT3B0aW9ucyB7XG5cdFx0aWYgKCFfaW5wdXQgfHwgdHlwZW9mIF9pbnB1dCAhPT0gJ29iamVjdCcpIHtcblx0XHRcdHJldHVybiB0aGlzLmRlZmF1bHRWYWx1ZTtcblx0XHR9XG5cdFx0Y29uc3QgaW5wdXQgPSBfaW5wdXQgYXMgSUVkaXRvckxpZ2h0YnVsYk9wdGlvbnM7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGVuYWJsZWQ6IHN0cmluZ1NldChpbnB1dC5lbmFibGVkLCB0aGlzLmRlZmF1bHRWYWx1ZS5lbmFibGVkLCBbU2hvd0xpZ2h0YnVsYkljb25Nb2RlLk9mZiwgU2hvd0xpZ2h0YnVsYkljb25Nb2RlLk9uQ29kZSwgU2hvd0xpZ2h0YnVsYkljb25Nb2RlLk9uXSlcblx0XHR9O1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gc3RpY2t5U2Nyb2xsXG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVkaXRvclN0aWNreVNjcm9sbE9wdGlvbnMge1xuXHQvKipcblx0ICogRW5hYmxlIHRoZSBzdGlja3kgc2Nyb2xsXG5cdCAqL1xuXHRlbmFibGVkPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIE1heGltdW0gbnVtYmVyIG9mIHN0aWNreSBsaW5lcyB0byBzaG93XG5cdCAqL1xuXHRtYXhMaW5lQ291bnQ/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBNb2RlbCB0byBjaG9vc2UgZm9yIHN0aWNreSBzY3JvbGwgYnkgZGVmYXVsdFxuXHQgKi9cblx0ZGVmYXVsdE1vZGVsPzogJ291dGxpbmVNb2RlbCcgfCAnZm9sZGluZ1Byb3ZpZGVyTW9kZWwnIHwgJ2luZGVudGF0aW9uTW9kZWwnO1xuXHQvKipcblx0ICogRGVmaW5lIHdoZXRoZXIgdG8gc2Nyb2xsIHN0aWNreSBzY3JvbGwgd2l0aCBlZGl0b3IgaG9yaXpvbnRhbCBzY3JvbGxiYWVcblx0ICovXG5cdHNjcm9sbFdpdGhFZGl0b3I/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgdHlwZSBFZGl0b3JTdGlja3lTY3JvbGxPcHRpb25zID0gUmVhZG9ubHk8UmVxdWlyZWQ8SUVkaXRvclN0aWNreVNjcm9sbE9wdGlvbnM+PjtcblxuY2xhc3MgRWRpdG9yU3RpY2t5U2Nyb2xsIGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24uc3RpY2t5U2Nyb2xsLCBJRWRpdG9yU3RpY2t5U2Nyb2xsT3B0aW9ucywgRWRpdG9yU3RpY2t5U2Nyb2xsT3B0aW9ucz4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IGRlZmF1bHRzOiBFZGl0b3JTdGlja3lTY3JvbGxPcHRpb25zID0geyBlbmFibGVkOiB0cnVlLCBtYXhMaW5lQ291bnQ6IDUsIGRlZmF1bHRNb2RlbDogJ291dGxpbmVNb2RlbCcsIHNjcm9sbFdpdGhFZGl0b3I6IHRydWUgfTtcblx0XHRzdXBlcihcblx0XHRcdEVkaXRvck9wdGlvbi5zdGlja3lTY3JvbGwsICdzdGlja3lTY3JvbGwnLCBkZWZhdWx0cyxcblx0XHRcdHtcblx0XHRcdFx0J2VkaXRvci5zdGlja3lTY3JvbGwuZW5hYmxlZCc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuZW5hYmxlZCxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3RpY2t5U2Nyb2xsLmVuYWJsZWQnLCBcIlNob3dzIHRoZSBuZXN0ZWQgY3VycmVudCBzY29wZXMgZHVyaW5nIHRoZSBzY3JvbGwgYXQgdGhlIHRvcCBvZiB0aGUgZWRpdG9yLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN0aWNreVNjcm9sbC5tYXhMaW5lQ291bnQnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMubWF4TGluZUNvdW50LFxuXHRcdFx0XHRcdG1pbmltdW06IDEsXG5cdFx0XHRcdFx0bWF4aW11bTogMjAsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLnN0aWNreVNjcm9sbC5tYXhMaW5lQ291bnQnLCBcIkRlZmluZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIHN0aWNreSBsaW5lcyB0byBzaG93LlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN0aWNreVNjcm9sbC5kZWZhdWx0TW9kZWwnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZW51bTogWydvdXRsaW5lTW9kZWwnLCAnZm9sZGluZ1Byb3ZpZGVyTW9kZWwnLCAnaW5kZW50YXRpb25Nb2RlbCddLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmRlZmF1bHRNb2RlbCxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3RpY2t5U2Nyb2xsLmRlZmF1bHRNb2RlbCcsIFwiRGVmaW5lcyB0aGUgbW9kZWwgdG8gdXNlIGZvciBkZXRlcm1pbmluZyB3aGljaCBsaW5lcyB0byBzdGljay4gSWYgdGhlIG91dGxpbmUgbW9kZWwgZG9lcyBub3QgZXhpc3QsIGl0IHdpbGwgZmFsbCBiYWNrIG9uIHRoZSBmb2xkaW5nIHByb3ZpZGVyIG1vZGVsIHdoaWNoIGZhbGxzIGJhY2sgb24gdGhlIGluZGVudGF0aW9uIG1vZGVsLiBUaGlzIG9yZGVyIGlzIHJlc3BlY3RlZCBpbiBhbGwgdGhyZWUgY2FzZXMuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3RpY2t5U2Nyb2xsLnNjcm9sbFdpdGhFZGl0b3InOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLnNjcm9sbFdpdGhFZGl0b3IsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLnN0aWNreVNjcm9sbC5zY3JvbGxXaXRoRWRpdG9yJywgXCJFbmFibGUgc2Nyb2xsaW5nIG9mIFN0aWNreSBTY3JvbGwgd2l0aCB0aGUgZWRpdG9yJ3MgaG9yaXpvbnRhbCBzY3JvbGxiYXIuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShfaW5wdXQ6IGFueSk6IEVkaXRvclN0aWNreVNjcm9sbE9wdGlvbnMge1xuXHRcdGlmICghX2lucHV0IHx8IHR5cGVvZiBfaW5wdXQgIT09ICdvYmplY3QnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0VmFsdWU7XG5cdFx0fVxuXHRcdGNvbnN0IGlucHV0ID0gX2lucHV0IGFzIElFZGl0b3JTdGlja3lTY3JvbGxPcHRpb25zO1xuXHRcdHJldHVybiB7XG5cdFx0XHRlbmFibGVkOiBib29sZWFuKGlucHV0LmVuYWJsZWQsIHRoaXMuZGVmYXVsdFZhbHVlLmVuYWJsZWQpLFxuXHRcdFx0bWF4TGluZUNvdW50OiBFZGl0b3JJbnRPcHRpb24uY2xhbXBlZEludChpbnB1dC5tYXhMaW5lQ291bnQsIHRoaXMuZGVmYXVsdFZhbHVlLm1heExpbmVDb3VudCwgMSwgMjApLFxuXHRcdFx0ZGVmYXVsdE1vZGVsOiBzdHJpbmdTZXQ8J291dGxpbmVNb2RlbCcgfCAnZm9sZGluZ1Byb3ZpZGVyTW9kZWwnIHwgJ2luZGVudGF0aW9uTW9kZWwnPihpbnB1dC5kZWZhdWx0TW9kZWwsIHRoaXMuZGVmYXVsdFZhbHVlLmRlZmF1bHRNb2RlbCwgWydvdXRsaW5lTW9kZWwnLCAnZm9sZGluZ1Byb3ZpZGVyTW9kZWwnLCAnaW5kZW50YXRpb25Nb2RlbCddKSxcblx0XHRcdHNjcm9sbFdpdGhFZGl0b3I6IGJvb2xlYW4oaW5wdXQuc2Nyb2xsV2l0aEVkaXRvciwgdGhpcy5kZWZhdWx0VmFsdWUuc2Nyb2xsV2l0aEVkaXRvcilcblx0XHR9O1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gaW5sYXlIaW50c1xuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgZWRpdG9yIGlubGF5SGludHNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJRWRpdG9ySW5sYXlIaW50c09wdGlvbnMge1xuXHQvKipcblx0ICogRW5hYmxlIHRoZSBpbmxpbmUgaGludHMuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRlbmFibGVkPzogJ29uJyB8ICdvZmYnIHwgJ29mZlVubGVzc1ByZXNzZWQnIHwgJ29uVW5sZXNzUHJlc3NlZCc7XG5cblx0LyoqXG5cdCAqIEZvbnQgc2l6ZSBvZiBpbmxpbmUgaGludHMuXG5cdCAqIERlZmF1bHQgdG8gOTAlIG9mIHRoZSBlZGl0b3IgZm9udCBzaXplLlxuXHQgKi9cblx0Zm9udFNpemU/OiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIEZvbnQgZmFtaWx5IG9mIGlubGluZSBoaW50cy5cblx0ICogRGVmYXVsdHMgdG8gZWRpdG9yIGZvbnQgZmFtaWx5LlxuXHQgKi9cblx0Zm9udEZhbWlseT86IHN0cmluZztcblxuXHQvKipcblx0ICogRW5hYmxlcyB0aGUgcGFkZGluZyBhcm91bmQgdGhlIGlubGF5IGhpbnQuXG5cdCAqIERlZmF1bHRzIHRvIGZhbHNlLlxuXHQgKi9cblx0cGFkZGluZz86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIE1heGltdW0gbGVuZ3RoIGZvciBpbmxheSBoaW50cyBwZXIgbGluZVxuXHQgKiBTZXQgdG8gMCB0byBoYXZlIGFuIHVubGltaXRlZCBsZW5ndGguXG5cdCAqL1xuXHRtYXhpbXVtTGVuZ3RoPzogbnVtYmVyO1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgdHlwZSBFZGl0b3JJbmxheUhpbnRzT3B0aW9ucyA9IFJlYWRvbmx5PFJlcXVpcmVkPElFZGl0b3JJbmxheUhpbnRzT3B0aW9ucz4+O1xuXG5jbGFzcyBFZGl0b3JJbmxheUhpbnRzIGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24uaW5sYXlIaW50cywgSUVkaXRvcklubGF5SGludHNPcHRpb25zLCBFZGl0b3JJbmxheUhpbnRzT3B0aW9ucz4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IGRlZmF1bHRzOiBFZGl0b3JJbmxheUhpbnRzT3B0aW9ucyA9IHsgZW5hYmxlZDogJ29uJywgZm9udFNpemU6IDAsIGZvbnRGYW1pbHk6ICcnLCBwYWRkaW5nOiBmYWxzZSwgbWF4aW11bUxlbmd0aDogNDMgfTtcblx0XHRzdXBlcihcblx0XHRcdEVkaXRvck9wdGlvbi5pbmxheUhpbnRzLCAnaW5sYXlIaW50cycsIGRlZmF1bHRzLFxuXHRcdFx0e1xuXHRcdFx0XHQnZWRpdG9yLmlubGF5SGludHMuZW5hYmxlZCc6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5lbmFibGVkLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2lubGF5SGludHMuZW5hYmxlJywgXCJFbmFibGVzIHRoZSBpbmxheSBoaW50cyBpbiB0aGUgZWRpdG9yLlwiKSxcblx0XHRcdFx0XHRlbnVtOiBbJ29uJywgJ29uVW5sZXNzUHJlc3NlZCcsICdvZmZVbmxlc3NQcmVzc2VkJywgJ29mZiddLFxuXHRcdFx0XHRcdG1hcmtkb3duRW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuaW5sYXlIaW50cy5vbicsIFwiSW5sYXkgaGludHMgYXJlIGVuYWJsZWRcIiksXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5pbmxheUhpbnRzLm9uVW5sZXNzUHJlc3NlZCcsIFwiSW5sYXkgaGludHMgYXJlIHNob3dpbmcgYnkgZGVmYXVsdCBhbmQgaGlkZSB3aGVuIGhvbGRpbmcgezB9XCIsIHBsYXRmb3JtLmlzTWFjaW50b3NoID8gYEN0cmwrT3B0aW9uYCA6IGBDdHJsK0FsdGApLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuaW5sYXlIaW50cy5vZmZVbmxlc3NQcmVzc2VkJywgXCJJbmxheSBoaW50cyBhcmUgaGlkZGVuIGJ5IGRlZmF1bHQgYW5kIHNob3cgd2hlbiBob2xkaW5nIHswfVwiLCBwbGF0Zm9ybS5pc01hY2ludG9zaCA/IGBDdHJsK09wdGlvbmAgOiBgQ3RybCtBbHRgKSxcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmlubGF5SGludHMub2ZmJywgXCJJbmxheSBoaW50cyBhcmUgZGlzYWJsZWRcIiksXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5pbmxheUhpbnRzLmZvbnRTaXplJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmZvbnRTaXplLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnaW5sYXlIaW50cy5mb250U2l6ZScsIFwiQ29udHJvbHMgZm9udCBzaXplIG9mIGlubGF5IGhpbnRzIGluIHRoZSBlZGl0b3IuIEFzIGRlZmF1bHQgdGhlIHswfSBpcyB1c2VkIHdoZW4gdGhlIGNvbmZpZ3VyZWQgdmFsdWUgaXMgbGVzcyB0aGFuIHsxfSBvciBncmVhdGVyIHRoYW4gdGhlIGVkaXRvciBmb250IHNpemUuXCIsICdgI2VkaXRvci5mb250U2l6ZSNgJywgJ2A1YCcpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuaW5sYXlIaW50cy5mb250RmFtaWx5Jzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmZvbnRGYW1pbHksXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdpbmxheUhpbnRzLmZvbnRGYW1pbHknLCBcIkNvbnRyb2xzIGZvbnQgZmFtaWx5IG9mIGlubGF5IGhpbnRzIGluIHRoZSBlZGl0b3IuIFdoZW4gc2V0IHRvIGVtcHR5LCB0aGUgezB9IGlzIHVzZWQuXCIsICdgI2VkaXRvci5mb250RmFtaWx5I2AnKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLmlubGF5SGludHMucGFkZGluZyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMucGFkZGluZyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdpbmxheUhpbnRzLnBhZGRpbmcnLCBcIkVuYWJsZXMgdGhlIHBhZGRpbmcgYXJvdW5kIHRoZSBpbmxheSBoaW50cyBpbiB0aGUgZWRpdG9yLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLmlubGF5SGludHMubWF4aW11bUxlbmd0aCc6IHtcblx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5tYXhpbXVtTGVuZ3RoLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnaW5sYXlIaW50cy5tYXhpbXVtTGVuZ3RoJywgXCJNYXhpbXVtIG92ZXJhbGwgbGVuZ3RoIG9mIGlubGF5IGhpbnRzLCBmb3IgYSBzaW5nbGUgbGluZSwgYmVmb3JlIHRoZXkgZ2V0IHRydW5jYXRlZCBieSB0aGUgZWRpdG9yLiBTZXQgdG8gYDBgIHRvIG5ldmVyIHRydW5jYXRlXCIpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKF9pbnB1dDogYW55KTogRWRpdG9ySW5sYXlIaW50c09wdGlvbnMge1xuXHRcdGlmICghX2lucHV0IHx8IHR5cGVvZiBfaW5wdXQgIT09ICdvYmplY3QnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0VmFsdWU7XG5cdFx0fVxuXHRcdGNvbnN0IGlucHV0ID0gX2lucHV0IGFzIElFZGl0b3JJbmxheUhpbnRzT3B0aW9ucztcblx0XHRpZiAodHlwZW9mIGlucHV0LmVuYWJsZWQgPT09ICdib29sZWFuJykge1xuXHRcdFx0aW5wdXQuZW5hYmxlZCA9IGlucHV0LmVuYWJsZWQgPyAnb24nIDogJ29mZic7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRlbmFibGVkOiBzdHJpbmdTZXQ8J29uJyB8ICdvZmYnIHwgJ29mZlVubGVzc1ByZXNzZWQnIHwgJ29uVW5sZXNzUHJlc3NlZCc+KGlucHV0LmVuYWJsZWQsIHRoaXMuZGVmYXVsdFZhbHVlLmVuYWJsZWQsIFsnb24nLCAnb2ZmJywgJ29mZlVubGVzc1ByZXNzZWQnLCAnb25Vbmxlc3NQcmVzc2VkJ10pLFxuXHRcdFx0Zm9udFNpemU6IEVkaXRvckludE9wdGlvbi5jbGFtcGVkSW50KGlucHV0LmZvbnRTaXplLCB0aGlzLmRlZmF1bHRWYWx1ZS5mb250U2l6ZSwgMCwgMTAwKSxcblx0XHRcdGZvbnRGYW1pbHk6IEVkaXRvclN0cmluZ09wdGlvbi5zdHJpbmcoaW5wdXQuZm9udEZhbWlseSwgdGhpcy5kZWZhdWx0VmFsdWUuZm9udEZhbWlseSksXG5cdFx0XHRwYWRkaW5nOiBib29sZWFuKGlucHV0LnBhZGRpbmcsIHRoaXMuZGVmYXVsdFZhbHVlLnBhZGRpbmcpLFxuXHRcdFx0bWF4aW11bUxlbmd0aDogRWRpdG9ySW50T3B0aW9uLmNsYW1wZWRJbnQoaW5wdXQubWF4aW11bUxlbmd0aCwgdGhpcy5kZWZhdWx0VmFsdWUubWF4aW11bUxlbmd0aCwgMCwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpLFxuXHRcdH07XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBsaW5lRGVjb3JhdGlvbnNXaWR0aFxuXG5jbGFzcyBFZGl0b3JMaW5lRGVjb3JhdGlvbnNXaWR0aCBleHRlbmRzIEJhc2VFZGl0b3JPcHRpb248RWRpdG9yT3B0aW9uLmxpbmVEZWNvcmF0aW9uc1dpZHRoLCBudW1iZXIgfCBzdHJpbmcsIG51bWJlcj4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKEVkaXRvck9wdGlvbi5saW5lRGVjb3JhdGlvbnNXaWR0aCwgJ2xpbmVEZWNvcmF0aW9uc1dpZHRoJywgMTApO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKGlucHV0OiBhbnkpOiBudW1iZXIge1xuXHRcdGlmICh0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnICYmIC9eXFxkKyhcXC5cXGQrKT9jaCQvLnRlc3QoaW5wdXQpKSB7XG5cdFx0XHRjb25zdCBtdWx0aXBsZSA9IHBhcnNlRmxvYXQoaW5wdXQuc3Vic3RyaW5nKDAsIGlucHV0Lmxlbmd0aCAtIDIpKTtcblx0XHRcdHJldHVybiAtbXVsdGlwbGU7IC8vIG5lZ2F0aXZlIG51bWJlcnMgc2lnbmFsIGEgbXVsdGlwbGVcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIEVkaXRvckludE9wdGlvbi5jbGFtcGVkSW50KGlucHV0LCB0aGlzLmRlZmF1bHRWYWx1ZSwgMCwgMTAwMCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGNvbXB1dGUoZW52OiBJRW52aXJvbm1lbnRhbE9wdGlvbnMsIG9wdGlvbnM6IElDb21wdXRlZEVkaXRvck9wdGlvbnMsIHZhbHVlOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGlmICh2YWx1ZSA8IDApIHtcblx0XHRcdC8vIG5lZ2F0aXZlIG51bWJlcnMgc2lnbmFsIGEgbXVsdGlwbGVcblx0XHRcdHJldHVybiBFZGl0b3JJbnRPcHRpb24uY2xhbXBlZEludCgtdmFsdWUgKiBlbnYuZm9udEluZm8udHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoLCB0aGlzLmRlZmF1bHRWYWx1ZSwgMCwgMTAwMCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBsaW5lSGVpZ2h0XG5cbmNsYXNzIEVkaXRvckxpbmVIZWlnaHQgZXh0ZW5kcyBFZGl0b3JGbG9hdE9wdGlvbjxFZGl0b3JPcHRpb24ubGluZUhlaWdodD4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0RWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQsICdsaW5lSGVpZ2h0Jyxcblx0XHRcdEVESVRPUl9GT05UX0RFRkFVTFRTLmxpbmVIZWlnaHQsXG5cdFx0XHR4ID0+IEVkaXRvckZsb2F0T3B0aW9uLmNsYW1wKHgsIDAsIDE1MCksXG5cdFx0XHR7IG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbGluZUhlaWdodCcsIFwiQ29udHJvbHMgdGhlIGxpbmUgaGVpZ2h0LiBcXG4gLSBVc2UgMCB0byBhdXRvbWF0aWNhbGx5IGNvbXB1dGUgdGhlIGxpbmUgaGVpZ2h0IGZyb20gdGhlIGZvbnQgc2l6ZS5cXG4gLSBWYWx1ZXMgYmV0d2VlbiAwIGFuZCA4IHdpbGwgYmUgdXNlZCBhcyBhIG11bHRpcGxpZXIgd2l0aCB0aGUgZm9udCBzaXplLlxcbiAtIFZhbHVlcyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gOCB3aWxsIGJlIHVzZWQgYXMgZWZmZWN0aXZlIHZhbHVlcy5cIikgfVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgY29tcHV0ZShlbnY6IElFbnZpcm9ubWVudGFsT3B0aW9ucywgb3B0aW9uczogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucywgdmFsdWU6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Ly8gVGhlIGxpbmVIZWlnaHQgaXMgY29tcHV0ZWQgZnJvbSB0aGUgZm9udFNpemUgaWYgaXQgaXMgMC5cblx0XHQvLyBNb3Jlb3ZlciwgdGhlIGZpbmFsIGxpbmVIZWlnaHQgcmVzcGVjdHMgdGhlIGVkaXRvciB6b29tIGxldmVsLlxuXHRcdC8vIFNvIHRha2UgdGhlIHJlc3VsdCBmcm9tIGVudi5mb250SW5mb1xuXHRcdHJldHVybiBlbnYuZm9udEluZm8ubGluZUhlaWdodDtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIG1pbmltYXBcblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIGVkaXRvciBtaW5pbWFwXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSUVkaXRvck1pbmltYXBPcHRpb25zIHtcblx0LyoqXG5cdCAqIEVuYWJsZSB0aGUgcmVuZGVyaW5nIG9mIHRoZSBtaW5pbWFwLlxuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0ZW5hYmxlZD86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBDb250cm9sIHRoZSByZW5kZXJpbmcgb2YgbWluaW1hcC5cblx0ICovXG5cdGF1dG9oaWRlPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIENvbnRyb2wgdGhlIHNpZGUgb2YgdGhlIG1pbmltYXAgaW4gZWRpdG9yLlxuXHQgKiBEZWZhdWx0cyB0byAncmlnaHQnLlxuXHQgKi9cblx0c2lkZT86ICdyaWdodCcgfCAnbGVmdCc7XG5cdC8qKlxuXHQgKiBDb250cm9sIHRoZSBtaW5pbWFwIHJlbmRlcmluZyBtb2RlLlxuXHQgKiBEZWZhdWx0cyB0byAnYWN0dWFsJy5cblx0ICovXG5cdHNpemU/OiAncHJvcG9ydGlvbmFsJyB8ICdmaWxsJyB8ICdmaXQnO1xuXHQvKipcblx0ICogQ29udHJvbCB0aGUgcmVuZGVyaW5nIG9mIHRoZSBtaW5pbWFwIHNsaWRlci5cblx0ICogRGVmYXVsdHMgdG8gJ21vdXNlb3ZlcicuXG5cdCAqL1xuXHRzaG93U2xpZGVyPzogJ2Fsd2F5cycgfCAnbW91c2VvdmVyJztcblx0LyoqXG5cdCAqIFJlbmRlciB0aGUgYWN0dWFsIHRleHQgb24gYSBsaW5lIChhcyBvcHBvc2VkIHRvIGNvbG9yIGJsb2NrcykuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRyZW5kZXJDaGFyYWN0ZXJzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIExpbWl0IHRoZSB3aWR0aCBvZiB0aGUgbWluaW1hcCB0byByZW5kZXIgYXQgbW9zdCBhIGNlcnRhaW4gbnVtYmVyIG9mIGNvbHVtbnMuXG5cdCAqIERlZmF1bHRzIHRvIDEyMC5cblx0ICovXG5cdG1heENvbHVtbj86IG51bWJlcjtcblx0LyoqXG5cdCAqIFJlbGF0aXZlIHNpemUgb2YgdGhlIGZvbnQgaW4gdGhlIG1pbmltYXAuIERlZmF1bHRzIHRvIDEuXG5cdCAqL1xuXHRzY2FsZT86IG51bWJlcjtcblx0LyoqXG5cdCAqIFdoZXRoZXIgdG8gc2hvdyBuYW1lZCByZWdpb25zIGFzIHNlY3Rpb24gaGVhZGVycy4gRGVmYXVsdHMgdG8gdHJ1ZS5cblx0ICovXG5cdHNob3dSZWdpb25TZWN0aW9uSGVhZGVycz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBXaGV0aGVyIHRvIHNob3cgTUFSSzogY29tbWVudHMgYXMgc2VjdGlvbiBoZWFkZXJzLiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0c2hvd01hcmtTZWN0aW9uSGVhZGVycz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBXaGVuIHNwZWNpZmllZCwgaXMgdXNlZCB0byBjcmVhdGUgYSBjdXN0b20gc2VjdGlvbiBoZWFkZXIgcGFyc2VyIHJlZ2V4cC5cblx0ICogTXVzdCBjb250YWluIGEgbWF0Y2ggZ3JvdXAgbmFtZWQgJ2xhYmVsJyAod3JpdHRlbiBhcyAoPzxsYWJlbD4uKykpIHRoYXQgZW5jYXBzdWxhdGVzIHRoZSBzZWN0aW9uIGhlYWRlci5cblx0ICogT3B0aW9uYWxseSBjYW4gaW5jbHVkZSBhbm90aGVyIG1hdGNoIGdyb3VwIG5hbWVkICdzZXBhcmF0b3InLlxuXHQgKiBUbyBtYXRjaCBtdWx0aS1saW5lIGhlYWRlcnMgbGlrZTpcblx0ICogICAvLyA9PT09PT09PT09XG5cdCAqICAgLy8gTXkgU2VjdGlvblxuXHQgKiAgIC8vID09PT09PT09PT1cblx0ICogVXNlIGEgcGF0dGVybiBsaWtlOiBePXszLH1cXG5eXFwvXFwvICooPzxsYWJlbD5bXlxcbl0qPylcXG5ePXszLH0kXG5cdCAqL1xuXHRtYXJrU2VjdGlvbkhlYWRlclJlZ2V4Pzogc3RyaW5nO1xuXHQvKipcblx0ICogRm9udCBzaXplIG9mIHNlY3Rpb24gaGVhZGVycy4gRGVmYXVsdHMgdG8gOS5cblx0ICovXG5cdHNlY3Rpb25IZWFkZXJGb250U2l6ZT86IG51bWJlcjtcblx0LyoqXG5cdCAqIFNwYWNpbmcgYmV0d2VlbiB0aGUgc2VjdGlvbiBoZWFkZXIgY2hhcmFjdGVycyAoaW4gQ1NTIHB4KS4gRGVmYXVsdHMgdG8gMS5cblx0ICovXG5cdHNlY3Rpb25IZWFkZXJMZXR0ZXJTcGFjaW5nPzogbnVtYmVyO1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgdHlwZSBFZGl0b3JNaW5pbWFwT3B0aW9ucyA9IFJlYWRvbmx5PFJlcXVpcmVkPElFZGl0b3JNaW5pbWFwT3B0aW9ucz4+O1xuXG5jbGFzcyBFZGl0b3JNaW5pbWFwIGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24ubWluaW1hcCwgSUVkaXRvck1pbmltYXBPcHRpb25zLCBFZGl0b3JNaW5pbWFwT3B0aW9ucz4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IGRlZmF1bHRzOiBFZGl0b3JNaW5pbWFwT3B0aW9ucyA9IHtcblx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRzaXplOiAncHJvcG9ydGlvbmFsJyxcblx0XHRcdHNpZGU6ICdyaWdodCcsXG5cdFx0XHRzaG93U2xpZGVyOiAnbW91c2VvdmVyJyxcblx0XHRcdGF1dG9oaWRlOiBmYWxzZSxcblx0XHRcdHJlbmRlckNoYXJhY3RlcnM6IHRydWUsXG5cdFx0XHRtYXhDb2x1bW46IDEyMCxcblx0XHRcdHNjYWxlOiAxLFxuXHRcdFx0c2hvd1JlZ2lvblNlY3Rpb25IZWFkZXJzOiB0cnVlLFxuXHRcdFx0c2hvd01hcmtTZWN0aW9uSGVhZGVyczogdHJ1ZSxcblx0XHRcdG1hcmtTZWN0aW9uSGVhZGVyUmVnZXg6ICdcXFxcYk1BUks6XFxcXHMqKD88c2VwYXJhdG9yPlxcLT8pXFxcXHMqKD88bGFiZWw+LiopJCcsXG5cdFx0XHRzZWN0aW9uSGVhZGVyRm9udFNpemU6IDksXG5cdFx0XHRzZWN0aW9uSGVhZGVyTGV0dGVyU3BhY2luZzogMSxcblx0XHR9O1xuXHRcdHN1cGVyKFxuXHRcdFx0RWRpdG9yT3B0aW9uLm1pbmltYXAsICdtaW5pbWFwJywgZGVmYXVsdHMsXG5cdFx0XHR7XG5cdFx0XHRcdCdlZGl0b3IubWluaW1hcC5lbmFibGVkJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5lbmFibGVkLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ21pbmltYXAuZW5hYmxlZCcsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgbWluaW1hcCBpcyBzaG93bi5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5taW5pbWFwLmF1dG9oaWRlJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5hdXRvaGlkZSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdtaW5pbWFwLmF1dG9oaWRlJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBtaW5pbWFwIGlzIGhpZGRlbiBhdXRvbWF0aWNhbGx5LlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLm1pbmltYXAuc2l6ZSc6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRlbnVtOiBbJ3Byb3BvcnRpb25hbCcsICdmaWxsJywgJ2ZpdCddLFxuXHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnbWluaW1hcC5zaXplLnByb3BvcnRpb25hbCcsIFwiVGhlIG1pbmltYXAgaGFzIHRoZSBzYW1lIHNpemUgYXMgdGhlIGVkaXRvciBjb250ZW50cyAoYW5kIG1pZ2h0IHNjcm9sbCkuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdtaW5pbWFwLnNpemUuZmlsbCcsIFwiVGhlIG1pbmltYXAgd2lsbCBzdHJldGNoIG9yIHNocmluayBhcyBuZWNlc3NhcnkgdG8gZmlsbCB0aGUgaGVpZ2h0IG9mIHRoZSBlZGl0b3IgKG5vIHNjcm9sbGluZykuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdtaW5pbWFwLnNpemUuZml0JywgXCJUaGUgbWluaW1hcCB3aWxsIHNocmluayBhcyBuZWNlc3NhcnkgdG8gbmV2ZXIgYmUgbGFyZ2VyIHRoYW4gdGhlIGVkaXRvciAobm8gc2Nyb2xsaW5nKS5cIiksXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5zaXplLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ21pbmltYXAuc2l6ZScsIFwiQ29udHJvbHMgdGhlIHNpemUgb2YgdGhlIG1pbmltYXAuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IubWluaW1hcC5zaWRlJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGVudW06IFsnbGVmdCcsICdyaWdodCddLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLnNpZGUsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbWluaW1hcC5zaWRlJywgXCJDb250cm9scyB0aGUgc2lkZSB3aGVyZSB0byByZW5kZXIgdGhlIG1pbmltYXAuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IubWluaW1hcC5zaG93U2xpZGVyJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGVudW06IFsnYWx3YXlzJywgJ21vdXNlb3ZlciddLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLnNob3dTbGlkZXIsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbWluaW1hcC5zaG93U2xpZGVyJywgXCJDb250cm9scyB3aGVuIHRoZSBtaW5pbWFwIHNsaWRlciBpcyBzaG93bi5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5taW5pbWFwLnNjYWxlJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLnNjYWxlLFxuXHRcdFx0XHRcdG1pbmltdW06IDEsXG5cdFx0XHRcdFx0bWF4aW11bTogMyxcblx0XHRcdFx0XHRlbnVtOiBbMSwgMiwgM10sXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbWluaW1hcC5zY2FsZScsIFwiU2NhbGUgb2YgY29udGVudCBkcmF3biBpbiB0aGUgbWluaW1hcDogMSwgMiBvciAzLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLm1pbmltYXAucmVuZGVyQ2hhcmFjdGVycyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMucmVuZGVyQ2hhcmFjdGVycyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdtaW5pbWFwLnJlbmRlckNoYXJhY3RlcnMnLCBcIlJlbmRlciB0aGUgYWN0dWFsIGNoYXJhY3RlcnMgb24gYSBsaW5lIGFzIG9wcG9zZWQgdG8gY29sb3IgYmxvY2tzLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLm1pbmltYXAubWF4Q29sdW1uJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLm1heENvbHVtbixcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdtaW5pbWFwLm1heENvbHVtbicsIFwiTGltaXQgdGhlIHdpZHRoIG9mIHRoZSBtaW5pbWFwIHRvIHJlbmRlciBhdCBtb3N0IGEgY2VydGFpbiBudW1iZXIgb2YgY29sdW1ucy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5taW5pbWFwLnNob3dSZWdpb25TZWN0aW9uSGVhZGVycyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuc2hvd1JlZ2lvblNlY3Rpb25IZWFkZXJzLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ21pbmltYXAuc2hvd1JlZ2lvblNlY3Rpb25IZWFkZXJzJywgXCJDb250cm9scyB3aGV0aGVyIG5hbWVkIHJlZ2lvbnMgYXJlIHNob3duIGFzIHNlY3Rpb24gaGVhZGVycyBpbiB0aGUgbWluaW1hcC5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5taW5pbWFwLnNob3dNYXJrU2VjdGlvbkhlYWRlcnMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLnNob3dNYXJrU2VjdGlvbkhlYWRlcnMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbWluaW1hcC5zaG93TWFya1NlY3Rpb25IZWFkZXJzJywgXCJDb250cm9scyB3aGV0aGVyIE1BUks6IGNvbW1lbnRzIGFyZSBzaG93biBhcyBzZWN0aW9uIGhlYWRlcnMgaW4gdGhlIG1pbmltYXAuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IubWluaW1hcC5tYXJrU2VjdGlvbkhlYWRlclJlZ2V4Jzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLm1hcmtTZWN0aW9uSGVhZGVyUmVnZXgsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbWluaW1hcC5tYXJrU2VjdGlvbkhlYWRlclJlZ2V4JywgXCJEZWZpbmVzIHRoZSByZWd1bGFyIGV4cHJlc3Npb24gdXNlZCB0byBmaW5kIHNlY3Rpb24gaGVhZGVycyBpbiBjb21tZW50cy4gVGhlIHJlZ2V4IG11c3QgY29udGFpbiBhIG5hbWVkIG1hdGNoIGdyb3VwIGBsYWJlbGAgKHdyaXR0ZW4gYXMgYCg/PGxhYmVsPi4rKWApIHRoYXQgZW5jYXBzdWxhdGVzIHRoZSBzZWN0aW9uIGhlYWRlciwgb3RoZXJ3aXNlIGl0IHdpbGwgbm90IHdvcmsuIE9wdGlvbmFsbHkgeW91IGNhbiBpbmNsdWRlIGFub3RoZXIgbWF0Y2ggZ3JvdXAgbmFtZWQgYHNlcGFyYXRvcmAuIFVzZSBcXFxcbiBpbiB0aGUgcGF0dGVybiB0byBtYXRjaCBtdWx0aS1saW5lIGhlYWRlcnMuXCIpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLm1pbmltYXAuc2VjdGlvbkhlYWRlckZvbnRTaXplJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLnNlY3Rpb25IZWFkZXJGb250U2l6ZSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdtaW5pbWFwLnNlY3Rpb25IZWFkZXJGb250U2l6ZScsIFwiQ29udHJvbHMgdGhlIGZvbnQgc2l6ZSBvZiBzZWN0aW9uIGhlYWRlcnMgaW4gdGhlIG1pbmltYXAuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IubWluaW1hcC5zZWN0aW9uSGVhZGVyTGV0dGVyU3BhY2luZyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5zZWN0aW9uSGVhZGVyTGV0dGVyU3BhY2luZyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdtaW5pbWFwLnNlY3Rpb25IZWFkZXJMZXR0ZXJTcGFjaW5nJywgXCJDb250cm9scyB0aGUgYW1vdW50IG9mIHNwYWNlIChpbiBwaXhlbHMpIGJldHdlZW4gY2hhcmFjdGVycyBvZiBzZWN0aW9uIGhlYWRlci4gVGhpcyBoZWxwcyB0aGUgcmVhZGFiaWxpdHkgb2YgdGhlIGhlYWRlciBpbiBzbWFsbCBmb250IHNpemVzLlwiKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShfaW5wdXQ6IGFueSk6IEVkaXRvck1pbmltYXBPcHRpb25zIHtcblx0XHRpZiAoIV9pbnB1dCB8fCB0eXBlb2YgX2lucHV0ICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRjb25zdCBpbnB1dCA9IF9pbnB1dCBhcyBJRWRpdG9yTWluaW1hcE9wdGlvbnM7XG5cblx0XHQvLyBWYWxpZGF0ZSBtYXJrIHNlY3Rpb24gaGVhZGVyIHJlZ2V4XG5cdFx0bGV0IG1hcmtTZWN0aW9uSGVhZGVyUmVnZXggPSB0aGlzLmRlZmF1bHRWYWx1ZS5tYXJrU2VjdGlvbkhlYWRlclJlZ2V4O1xuXHRcdGNvbnN0IGlucHV0UmVnZXggPSBfaW5wdXQubWFya1NlY3Rpb25IZWFkZXJSZWdleDtcblx0XHRpZiAodHlwZW9mIGlucHV0UmVnZXggPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRuZXcgUmVnRXhwKGlucHV0UmVnZXgsICdkJyk7XG5cdFx0XHRcdG1hcmtTZWN0aW9uSGVhZGVyUmVnZXggPSBpbnB1dFJlZ2V4O1xuXHRcdFx0fSBjYXRjaCB7IH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZW5hYmxlZDogYm9vbGVhbihpbnB1dC5lbmFibGVkLCB0aGlzLmRlZmF1bHRWYWx1ZS5lbmFibGVkKSxcblx0XHRcdGF1dG9oaWRlOiBib29sZWFuKGlucHV0LmF1dG9oaWRlLCB0aGlzLmRlZmF1bHRWYWx1ZS5hdXRvaGlkZSksXG5cdFx0XHRzaXplOiBzdHJpbmdTZXQ8J3Byb3BvcnRpb25hbCcgfCAnZmlsbCcgfCAnZml0Jz4oaW5wdXQuc2l6ZSwgdGhpcy5kZWZhdWx0VmFsdWUuc2l6ZSwgWydwcm9wb3J0aW9uYWwnLCAnZmlsbCcsICdmaXQnXSksXG5cdFx0XHRzaWRlOiBzdHJpbmdTZXQ8J3JpZ2h0JyB8ICdsZWZ0Jz4oaW5wdXQuc2lkZSwgdGhpcy5kZWZhdWx0VmFsdWUuc2lkZSwgWydyaWdodCcsICdsZWZ0J10pLFxuXHRcdFx0c2hvd1NsaWRlcjogc3RyaW5nU2V0PCdhbHdheXMnIHwgJ21vdXNlb3Zlcic+KGlucHV0LnNob3dTbGlkZXIsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dTbGlkZXIsIFsnYWx3YXlzJywgJ21vdXNlb3ZlciddKSxcblx0XHRcdHJlbmRlckNoYXJhY3RlcnM6IGJvb2xlYW4oaW5wdXQucmVuZGVyQ2hhcmFjdGVycywgdGhpcy5kZWZhdWx0VmFsdWUucmVuZGVyQ2hhcmFjdGVycyksXG5cdFx0XHRzY2FsZTogRWRpdG9ySW50T3B0aW9uLmNsYW1wZWRJbnQoaW5wdXQuc2NhbGUsIDEsIDEsIDMpLFxuXHRcdFx0bWF4Q29sdW1uOiBFZGl0b3JJbnRPcHRpb24uY2xhbXBlZEludChpbnB1dC5tYXhDb2x1bW4sIHRoaXMuZGVmYXVsdFZhbHVlLm1heENvbHVtbiwgMSwgMTAwMDApLFxuXHRcdFx0c2hvd1JlZ2lvblNlY3Rpb25IZWFkZXJzOiBib29sZWFuKGlucHV0LnNob3dSZWdpb25TZWN0aW9uSGVhZGVycywgdGhpcy5kZWZhdWx0VmFsdWUuc2hvd1JlZ2lvblNlY3Rpb25IZWFkZXJzKSxcblx0XHRcdHNob3dNYXJrU2VjdGlvbkhlYWRlcnM6IGJvb2xlYW4oaW5wdXQuc2hvd01hcmtTZWN0aW9uSGVhZGVycywgdGhpcy5kZWZhdWx0VmFsdWUuc2hvd01hcmtTZWN0aW9uSGVhZGVycyksXG5cdFx0XHRtYXJrU2VjdGlvbkhlYWRlclJlZ2V4OiBtYXJrU2VjdGlvbkhlYWRlclJlZ2V4LFxuXHRcdFx0c2VjdGlvbkhlYWRlckZvbnRTaXplOiBFZGl0b3JGbG9hdE9wdGlvbi5jbGFtcChpbnB1dC5zZWN0aW9uSGVhZGVyRm9udFNpemUgPz8gdGhpcy5kZWZhdWx0VmFsdWUuc2VjdGlvbkhlYWRlckZvbnRTaXplLCA0LCAzMiksXG5cdFx0XHRzZWN0aW9uSGVhZGVyTGV0dGVyU3BhY2luZzogRWRpdG9yRmxvYXRPcHRpb24uY2xhbXAoaW5wdXQuc2VjdGlvbkhlYWRlckxldHRlclNwYWNpbmcgPz8gdGhpcy5kZWZhdWx0VmFsdWUuc2VjdGlvbkhlYWRlckxldHRlclNwYWNpbmcsIDAsIDUpLFxuXHRcdH07XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBtdWx0aUN1cnNvck1vZGlmaWVyXG5cbmZ1bmN0aW9uIF9tdWx0aUN1cnNvck1vZGlmaWVyRnJvbVN0cmluZyhtdWx0aUN1cnNvck1vZGlmaWVyOiAnY3RybENtZCcgfCAnYWx0Jyk6ICdhbHRLZXknIHwgJ21ldGFLZXknIHwgJ2N0cmxLZXknIHtcblx0aWYgKG11bHRpQ3Vyc29yTW9kaWZpZXIgPT09ICdjdHJsQ21kJykge1xuXHRcdHJldHVybiAocGxhdGZvcm0uaXNNYWNpbnRvc2ggPyAnbWV0YUtleScgOiAnY3RybEtleScpO1xuXHR9XG5cdHJldHVybiAnYWx0S2V5Jztcbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBwYWRkaW5nXG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciBlZGl0b3IgcGFkZGluZ1xuICovXG5leHBvcnQgaW50ZXJmYWNlIElFZGl0b3JQYWRkaW5nT3B0aW9ucyB7XG5cdC8qKlxuXHQgKiBTcGFjaW5nIGJldHdlZW4gdG9wIGVkZ2Ugb2YgZWRpdG9yIGFuZCBmaXJzdCBsaW5lLlxuXHQgKi9cblx0dG9wPzogbnVtYmVyO1xuXHQvKipcblx0ICogU3BhY2luZyBiZXR3ZWVuIGJvdHRvbSBlZGdlIG9mIGVkaXRvciBhbmQgbGFzdCBsaW5lLlxuXHQgKi9cblx0Ym90dG9tPzogbnVtYmVyO1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgdHlwZSBJbnRlcm5hbEVkaXRvclBhZGRpbmdPcHRpb25zID0gUmVhZG9ubHk8UmVxdWlyZWQ8SUVkaXRvclBhZGRpbmdPcHRpb25zPj47XG5cbmNsYXNzIEVkaXRvclBhZGRpbmcgZXh0ZW5kcyBCYXNlRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi5wYWRkaW5nLCBJRWRpdG9yUGFkZGluZ09wdGlvbnMsIEludGVybmFsRWRpdG9yUGFkZGluZ09wdGlvbnM+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihcblx0XHRcdEVkaXRvck9wdGlvbi5wYWRkaW5nLCAncGFkZGluZycsIHsgdG9wOiAwLCBib3R0b206IDAgfSxcblx0XHRcdHtcblx0XHRcdFx0J2VkaXRvci5wYWRkaW5nLnRvcCc6IHtcblx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdFx0XHRkZWZhdWx0OiAwLFxuXHRcdFx0XHRcdG1pbmltdW06IDAsXG5cdFx0XHRcdFx0bWF4aW11bTogMTAwMCxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdwYWRkaW5nLnRvcCcsIFwiQ29udHJvbHMgdGhlIGFtb3VudCBvZiBzcGFjZSBiZXR3ZWVuIHRoZSB0b3AgZWRnZSBvZiB0aGUgZWRpdG9yIGFuZCB0aGUgZmlyc3QgbGluZS5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5wYWRkaW5nLmJvdHRvbSc6IHtcblx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdFx0XHRkZWZhdWx0OiAwLFxuXHRcdFx0XHRcdG1pbmltdW06IDAsXG5cdFx0XHRcdFx0bWF4aW11bTogMTAwMCxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdwYWRkaW5nLmJvdHRvbScsIFwiQ29udHJvbHMgdGhlIGFtb3VudCBvZiBzcGFjZSBiZXR3ZWVuIHRoZSBib3R0b20gZWRnZSBvZiB0aGUgZWRpdG9yIGFuZCB0aGUgbGFzdCBsaW5lLlwiKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShfaW5wdXQ6IGFueSk6IEludGVybmFsRWRpdG9yUGFkZGluZ09wdGlvbnMge1xuXHRcdGlmICghX2lucHV0IHx8IHR5cGVvZiBfaW5wdXQgIT09ICdvYmplY3QnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0VmFsdWU7XG5cdFx0fVxuXHRcdGNvbnN0IGlucHV0ID0gX2lucHV0IGFzIElFZGl0b3JQYWRkaW5nT3B0aW9ucztcblxuXHRcdHJldHVybiB7XG5cdFx0XHR0b3A6IEVkaXRvckludE9wdGlvbi5jbGFtcGVkSW50KGlucHV0LnRvcCwgMCwgMCwgMTAwMCksXG5cdFx0XHRib3R0b206IEVkaXRvckludE9wdGlvbi5jbGFtcGVkSW50KGlucHV0LmJvdHRvbSwgMCwgMCwgMTAwMClcblx0XHR9O1xuXHR9XG59XG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIHBhcmFtZXRlckhpbnRzXG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciBwYXJhbWV0ZXIgaGludHNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJRWRpdG9yUGFyYW1ldGVySGludE9wdGlvbnMge1xuXHQvKipcblx0ICogRW5hYmxlIHBhcmFtZXRlciBoaW50cy5cblx0ICogRGVmYXVsdHMgdG8gdHJ1ZS5cblx0ICovXG5cdGVuYWJsZWQ/OiBib29sZWFuO1xuXHQvKipcblx0ICogRW5hYmxlIGN5Y2xpbmcgb2YgcGFyYW1ldGVyIGhpbnRzLlxuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0ICovXG5cdGN5Y2xlPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IHR5cGUgSW50ZXJuYWxQYXJhbWV0ZXJIaW50T3B0aW9ucyA9IFJlYWRvbmx5PFJlcXVpcmVkPElFZGl0b3JQYXJhbWV0ZXJIaW50T3B0aW9ucz4+O1xuXG5jbGFzcyBFZGl0b3JQYXJhbWV0ZXJIaW50cyBleHRlbmRzIEJhc2VFZGl0b3JPcHRpb248RWRpdG9yT3B0aW9uLnBhcmFtZXRlckhpbnRzLCBJRWRpdG9yUGFyYW1ldGVySGludE9wdGlvbnMsIEludGVybmFsUGFyYW1ldGVySGludE9wdGlvbnM+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBkZWZhdWx0czogSW50ZXJuYWxQYXJhbWV0ZXJIaW50T3B0aW9ucyA9IHtcblx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRjeWNsZTogdHJ1ZVxuXHRcdH07XG5cdFx0c3VwZXIoXG5cdFx0XHRFZGl0b3JPcHRpb24ucGFyYW1ldGVySGludHMsICdwYXJhbWV0ZXJIaW50cycsIGRlZmF1bHRzLFxuXHRcdFx0e1xuXHRcdFx0XHQnZWRpdG9yLnBhcmFtZXRlckhpbnRzLmVuYWJsZWQnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmVuYWJsZWQsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncGFyYW1ldGVySGludHMuZW5hYmxlZCcsIFwiRW5hYmxlcyBhIHBvcC11cCB0aGF0IHNob3dzIHBhcmFtZXRlciBkb2N1bWVudGF0aW9uIGFuZCB0eXBlIGluZm9ybWF0aW9uIGFzIHlvdSB0eXBlLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnBhcmFtZXRlckhpbnRzLmN5Y2xlJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5jeWNsZSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdwYXJhbWV0ZXJIaW50cy5jeWNsZScsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgcGFyYW1ldGVyIGhpbnRzIG1lbnUgY3ljbGVzIG9yIGNsb3NlcyB3aGVuIHJlYWNoaW5nIHRoZSBlbmQgb2YgdGhlIGxpc3QuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShfaW5wdXQ6IGFueSk6IEludGVybmFsUGFyYW1ldGVySGludE9wdGlvbnMge1xuXHRcdGlmICghX2lucHV0IHx8IHR5cGVvZiBfaW5wdXQgIT09ICdvYmplY3QnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0VmFsdWU7XG5cdFx0fVxuXHRcdGNvbnN0IGlucHV0ID0gX2lucHV0IGFzIElFZGl0b3JQYXJhbWV0ZXJIaW50T3B0aW9ucztcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZW5hYmxlZDogYm9vbGVhbihpbnB1dC5lbmFibGVkLCB0aGlzLmRlZmF1bHRWYWx1ZS5lbmFibGVkKSxcblx0XHRcdGN5Y2xlOiBib29sZWFuKGlucHV0LmN5Y2xlLCB0aGlzLmRlZmF1bHRWYWx1ZS5jeWNsZSlcblx0XHR9O1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gcGl4ZWxSYXRpb1xuXG5jbGFzcyBFZGl0b3JQaXhlbFJhdGlvIGV4dGVuZHMgQ29tcHV0ZWRFZGl0b3JPcHRpb248RWRpdG9yT3B0aW9uLnBpeGVsUmF0aW8sIG51bWJlcj4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKEVkaXRvck9wdGlvbi5waXhlbFJhdGlvKTtcblx0fVxuXG5cdHB1YmxpYyBjb21wdXRlKGVudjogSUVudmlyb25tZW50YWxPcHRpb25zLCBvcHRpb25zOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zLCBfOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiBlbnYucGl4ZWxSYXRpbztcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uXG5cbmNsYXNzIFBsYWNlaG9sZGVyT3B0aW9uIGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24ucGxhY2Vob2xkZXIsIHN0cmluZyB8IHVuZGVmaW5lZCwgc3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKEVkaXRvck9wdGlvbi5wbGFjZWhvbGRlciwgJ3BsYWNlaG9sZGVyJywgdW5kZWZpbmVkKTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShpbnB1dDogYW55KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodHlwZW9mIGlucHV0ID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIGlucHV0O1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0VmFsdWU7XG5cdH1cbn1cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gcXVpY2tTdWdnZXN0aW9uc1xuXG5leHBvcnQgdHlwZSBRdWlja1N1Z2dlc3Rpb25zVmFsdWUgPSAnb24nIHwgJ2lubGluZScgfCAnb2ZmJztcblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHF1aWNrIHN1Z2dlc3Rpb25zXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVF1aWNrU3VnZ2VzdGlvbnNPcHRpb25zIHtcblx0b3RoZXI/OiBib29sZWFuIHwgUXVpY2tTdWdnZXN0aW9uc1ZhbHVlO1xuXHRjb21tZW50cz86IGJvb2xlYW4gfCBRdWlja1N1Z2dlc3Rpb25zVmFsdWU7XG5cdHN0cmluZ3M/OiBib29sZWFuIHwgUXVpY2tTdWdnZXN0aW9uc1ZhbHVlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEludGVybmFsUXVpY2tTdWdnZXN0aW9uc09wdGlvbnMge1xuXHRyZWFkb25seSBvdGhlcjogUXVpY2tTdWdnZXN0aW9uc1ZhbHVlO1xuXHRyZWFkb25seSBjb21tZW50czogUXVpY2tTdWdnZXN0aW9uc1ZhbHVlO1xuXHRyZWFkb25seSBzdHJpbmdzOiBRdWlja1N1Z2dlc3Rpb25zVmFsdWU7XG59XG5cbmNsYXNzIEVkaXRvclF1aWNrU3VnZ2VzdGlvbnMgZXh0ZW5kcyBCYXNlRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi5xdWlja1N1Z2dlc3Rpb25zLCBib29sZWFuIHwgSVF1aWNrU3VnZ2VzdGlvbnNPcHRpb25zLCBJbnRlcm5hbFF1aWNrU3VnZ2VzdGlvbnNPcHRpb25zPiB7XG5cblx0cHVibGljIG92ZXJyaWRlIHJlYWRvbmx5IGRlZmF1bHRWYWx1ZTogSW50ZXJuYWxRdWlja1N1Z2dlc3Rpb25zT3B0aW9ucztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBkZWZhdWx0czogSW50ZXJuYWxRdWlja1N1Z2dlc3Rpb25zT3B0aW9ucyA9IHtcblx0XHRcdG90aGVyOiAnb24nLFxuXHRcdFx0Y29tbWVudHM6ICdvZmYnLFxuXHRcdFx0c3RyaW5nczogJ29uJyAvLyBWb2lkIGNoYW5nZWQgdGhpcyBzZXR0aW5nXG5cdFx0fTtcblx0XHRjb25zdCB0eXBlczogSUpTT05TY2hlbWFbXSA9IFtcblx0XHRcdHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdFx0XHR7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRlbnVtOiBbJ29uJywgJ2lubGluZScsICdvZmYnXSxcblx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW25scy5sb2NhbGl6ZSgnb24nLCBcIlF1aWNrIHN1Z2dlc3Rpb25zIHNob3cgaW5zaWRlIHRoZSBzdWdnZXN0IHdpZGdldFwiKSwgbmxzLmxvY2FsaXplKCdpbmxpbmUnLCBcIlF1aWNrIHN1Z2dlc3Rpb25zIHNob3cgYXMgZ2hvc3QgdGV4dFwiKSwgbmxzLmxvY2FsaXplKCdvZmYnLCBcIlF1aWNrIHN1Z2dlc3Rpb25zIGFyZSBkaXNhYmxlZFwiKV1cblx0XHRcdH1cblx0XHRdO1xuXHRcdHN1cGVyKEVkaXRvck9wdGlvbi5xdWlja1N1Z2dlc3Rpb25zLCAncXVpY2tTdWdnZXN0aW9ucycsIGRlZmF1bHRzLCB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0c3RyaW5nczoge1xuXHRcdFx0XHRcdGFueU9mOiB0eXBlcyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5zdHJpbmdzLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3F1aWNrU3VnZ2VzdGlvbnMuc3RyaW5ncycsIFwiRW5hYmxlIHF1aWNrIHN1Z2dlc3Rpb25zIGluc2lkZSBzdHJpbmdzLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjb21tZW50czoge1xuXHRcdFx0XHRcdGFueU9mOiB0eXBlcyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5jb21tZW50cyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdxdWlja1N1Z2dlc3Rpb25zLmNvbW1lbnRzJywgXCJFbmFibGUgcXVpY2sgc3VnZ2VzdGlvbnMgaW5zaWRlIGNvbW1lbnRzLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRvdGhlcjoge1xuXHRcdFx0XHRcdGFueU9mOiB0eXBlcyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5vdGhlcixcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdxdWlja1N1Z2dlc3Rpb25zLm90aGVyJywgXCJFbmFibGUgcXVpY2sgc3VnZ2VzdGlvbnMgb3V0c2lkZSBvZiBzdHJpbmdzIGFuZCBjb21tZW50cy5cIilcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRkZWZhdWx0OiBkZWZhdWx0cyxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncXVpY2tTdWdnZXN0aW9ucycsIFwiQ29udHJvbHMgd2hldGhlciBzdWdnZXN0aW9ucyBzaG91bGQgYXV0b21hdGljYWxseSBzaG93IHVwIHdoaWxlIHR5cGluZy4gVGhpcyBjYW4gYmUgY29udHJvbGxlZCBmb3IgdHlwaW5nIGluIGNvbW1lbnRzLCBzdHJpbmdzLCBhbmQgb3RoZXIgY29kZS4gUXVpY2sgc3VnZ2VzdGlvbiBjYW4gYmUgY29uZmlndXJlZCB0byBzaG93IGFzIGdob3N0IHRleHQgb3Igd2l0aCB0aGUgc3VnZ2VzdCB3aWRnZXQuIEFsc28gYmUgYXdhcmUgb2YgdGhlIHswfS1zZXR0aW5nIHdoaWNoIGNvbnRyb2xzIGlmIHN1Z2dlc3Rpb25zIGFyZSB0cmlnZ2VyZWQgYnkgc3BlY2lhbCBjaGFyYWN0ZXJzLlwiLCAnYCNlZGl0b3Iuc3VnZ2VzdE9uVHJpZ2dlckNoYXJhY3RlcnMjYCcpXG5cdFx0fSk7XG5cdFx0dGhpcy5kZWZhdWx0VmFsdWUgPSBkZWZhdWx0cztcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShpbnB1dDogYW55KTogSW50ZXJuYWxRdWlja1N1Z2dlc3Rpb25zT3B0aW9ucyB7XG5cdFx0aWYgKHR5cGVvZiBpbnB1dCA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHQvLyBib29sZWFuIC0+IGFsbCBvbi9vZmZcblx0XHRcdGNvbnN0IHZhbHVlID0gaW5wdXQgPyAnb24nIDogJ29mZic7XG5cdFx0XHRyZXR1cm4geyBjb21tZW50czogdmFsdWUsIHN0cmluZ3M6IHZhbHVlLCBvdGhlcjogdmFsdWUgfTtcblx0XHR9XG5cdFx0aWYgKCFpbnB1dCB8fCB0eXBlb2YgaW5wdXQgIT09ICdvYmplY3QnKSB7XG5cdFx0XHQvLyBpbnZhbGlkIG9iamVjdFxuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgb3RoZXIsIGNvbW1lbnRzLCBzdHJpbmdzIH0gPSAoPElRdWlja1N1Z2dlc3Rpb25zT3B0aW9ucz5pbnB1dCk7XG5cdFx0Y29uc3QgYWxsb3dlZFZhbHVlczogUXVpY2tTdWdnZXN0aW9uc1ZhbHVlW10gPSBbJ29uJywgJ2lubGluZScsICdvZmYnXTtcblx0XHRsZXQgdmFsaWRhdGVkT3RoZXI6IFF1aWNrU3VnZ2VzdGlvbnNWYWx1ZTtcblx0XHRsZXQgdmFsaWRhdGVkQ29tbWVudHM6IFF1aWNrU3VnZ2VzdGlvbnNWYWx1ZTtcblx0XHRsZXQgdmFsaWRhdGVkU3RyaW5nczogUXVpY2tTdWdnZXN0aW9uc1ZhbHVlO1xuXG5cdFx0aWYgKHR5cGVvZiBvdGhlciA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHR2YWxpZGF0ZWRPdGhlciA9IG90aGVyID8gJ29uJyA6ICdvZmYnO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR2YWxpZGF0ZWRPdGhlciA9IHN0cmluZ1NldChvdGhlciwgdGhpcy5kZWZhdWx0VmFsdWUub3RoZXIsIGFsbG93ZWRWYWx1ZXMpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGNvbW1lbnRzID09PSAnYm9vbGVhbicpIHtcblx0XHRcdHZhbGlkYXRlZENvbW1lbnRzID0gY29tbWVudHMgPyAnb24nIDogJ29mZic7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhbGlkYXRlZENvbW1lbnRzID0gc3RyaW5nU2V0KGNvbW1lbnRzLCB0aGlzLmRlZmF1bHRWYWx1ZS5jb21tZW50cywgYWxsb3dlZFZhbHVlcyk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2Ygc3RyaW5ncyA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHR2YWxpZGF0ZWRTdHJpbmdzID0gc3RyaW5ncyA/ICdvbicgOiAnb2ZmJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0dmFsaWRhdGVkU3RyaW5ncyA9IHN0cmluZ1NldChzdHJpbmdzLCB0aGlzLmRlZmF1bHRWYWx1ZS5zdHJpbmdzLCBhbGxvd2VkVmFsdWVzKTtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdG90aGVyOiB2YWxpZGF0ZWRPdGhlcixcblx0XHRcdGNvbW1lbnRzOiB2YWxpZGF0ZWRDb21tZW50cyxcblx0XHRcdHN0cmluZ3M6IHZhbGlkYXRlZFN0cmluZ3Ncblx0XHR9O1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gcmVuZGVyTGluZU51bWJlcnNcblxuZXhwb3J0IHR5cGUgTGluZU51bWJlcnNUeXBlID0gJ29uJyB8ICdvZmYnIHwgJ3JlbGF0aXZlJyB8ICdpbnRlcnZhbCcgfCAoKGxpbmVOdW1iZXI6IG51bWJlcikgPT4gc3RyaW5nKTtcblxuZXhwb3J0IGNvbnN0IGVudW0gUmVuZGVyTGluZU51bWJlcnNUeXBlIHtcblx0T2ZmID0gMCxcblx0T24gPSAxLFxuXHRSZWxhdGl2ZSA9IDIsXG5cdEludGVydmFsID0gMyxcblx0Q3VzdG9tID0gNFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEludGVybmFsRWRpdG9yUmVuZGVyTGluZU51bWJlcnNPcHRpb25zIHtcblx0cmVhZG9ubHkgcmVuZGVyVHlwZTogUmVuZGVyTGluZU51bWJlcnNUeXBlO1xuXHRyZWFkb25seSByZW5kZXJGbjogKChsaW5lTnVtYmVyOiBudW1iZXIpID0+IHN0cmluZykgfCBudWxsO1xufVxuXG5jbGFzcyBFZGl0b3JSZW5kZXJMaW5lTnVtYmVyc09wdGlvbiBleHRlbmRzIEJhc2VFZGl0b3JPcHRpb248RWRpdG9yT3B0aW9uLmxpbmVOdW1iZXJzLCBMaW5lTnVtYmVyc1R5cGUsIEludGVybmFsRWRpdG9yUmVuZGVyTGluZU51bWJlcnNPcHRpb25zPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHRFZGl0b3JPcHRpb24ubGluZU51bWJlcnMsICdsaW5lTnVtYmVycycsIHsgcmVuZGVyVHlwZTogUmVuZGVyTGluZU51bWJlcnNUeXBlLk9uLCByZW5kZXJGbjogbnVsbCB9LFxuXHRcdFx0e1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0ZW51bTogWydvZmYnLCAnb24nLCAncmVsYXRpdmUnLCAnaW50ZXJ2YWwnXSxcblx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnbGluZU51bWJlcnMub2ZmJywgXCJMaW5lIG51bWJlcnMgYXJlIG5vdCByZW5kZXJlZC5cIiksXG5cdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdsaW5lTnVtYmVycy5vbicsIFwiTGluZSBudW1iZXJzIGFyZSByZW5kZXJlZCBhcyBhYnNvbHV0ZSBudW1iZXIuXCIpLFxuXHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnbGluZU51bWJlcnMucmVsYXRpdmUnLCBcIkxpbmUgbnVtYmVycyBhcmUgcmVuZGVyZWQgYXMgZGlzdGFuY2UgaW4gbGluZXMgdG8gY3Vyc29yIHBvc2l0aW9uLlwiKSxcblx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2xpbmVOdW1iZXJzLmludGVydmFsJywgXCJMaW5lIG51bWJlcnMgYXJlIHJlbmRlcmVkIGV2ZXJ5IDEwIGxpbmVzLlwiKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRkZWZhdWx0OiAnb24nLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdsaW5lTnVtYmVycycsIFwiQ29udHJvbHMgdGhlIGRpc3BsYXkgb2YgbGluZSBudW1iZXJzLlwiKVxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgdmFsaWRhdGUobGluZU51bWJlcnM6IGFueSk6IEludGVybmFsRWRpdG9yUmVuZGVyTGluZU51bWJlcnNPcHRpb25zIHtcblx0XHRsZXQgcmVuZGVyVHlwZTogUmVuZGVyTGluZU51bWJlcnNUeXBlID0gdGhpcy5kZWZhdWx0VmFsdWUucmVuZGVyVHlwZTtcblx0XHRsZXQgcmVuZGVyRm46ICgobGluZU51bWJlcjogbnVtYmVyKSA9PiBzdHJpbmcpIHwgbnVsbCA9IHRoaXMuZGVmYXVsdFZhbHVlLnJlbmRlckZuO1xuXG5cdFx0aWYgKHR5cGVvZiBsaW5lTnVtYmVycyAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGlmICh0eXBlb2YgbGluZU51bWJlcnMgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0cmVuZGVyVHlwZSA9IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5DdXN0b207XG5cdFx0XHRcdHJlbmRlckZuID0gbGluZU51bWJlcnM7XG5cdFx0XHR9IGVsc2UgaWYgKGxpbmVOdW1iZXJzID09PSAnaW50ZXJ2YWwnKSB7XG5cdFx0XHRcdHJlbmRlclR5cGUgPSBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuSW50ZXJ2YWw7XG5cdFx0XHR9IGVsc2UgaWYgKGxpbmVOdW1iZXJzID09PSAncmVsYXRpdmUnKSB7XG5cdFx0XHRcdHJlbmRlclR5cGUgPSBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuUmVsYXRpdmU7XG5cdFx0XHR9IGVsc2UgaWYgKGxpbmVOdW1iZXJzID09PSAnb24nKSB7XG5cdFx0XHRcdHJlbmRlclR5cGUgPSBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT247XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZW5kZXJUeXBlID0gUmVuZGVyTGluZU51bWJlcnNUeXBlLk9mZjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVuZGVyVHlwZSxcblx0XHRcdHJlbmRlckZuXG5cdFx0fTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIHJlbmRlclZhbGlkYXRpb25EZWNvcmF0aW9uc1xuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgZnVuY3Rpb24gZmlsdGVyVmFsaWRhdGlvbkRlY29yYXRpb25zKG9wdGlvbnM6IElDb21wdXRlZEVkaXRvck9wdGlvbnMpOiBib29sZWFuIHtcblx0Y29uc3QgcmVuZGVyVmFsaWRhdGlvbkRlY29yYXRpb25zID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnJlbmRlclZhbGlkYXRpb25EZWNvcmF0aW9ucyk7XG5cdGlmIChyZW5kZXJWYWxpZGF0aW9uRGVjb3JhdGlvbnMgPT09ICdlZGl0YWJsZScpIHtcblx0XHRyZXR1cm4gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnJlYWRPbmx5KTtcblx0fVxuXHRyZXR1cm4gcmVuZGVyVmFsaWRhdGlvbkRlY29yYXRpb25zID09PSAnb24nID8gZmFsc2UgOiB0cnVlO1xufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIHJ1bGVyc1xuXG5leHBvcnQgaW50ZXJmYWNlIElSdWxlck9wdGlvbiB7XG5cdHJlYWRvbmx5IGNvbHVtbjogbnVtYmVyO1xuXHRyZWFkb25seSBjb2xvcjogc3RyaW5nIHwgbnVsbDtcbn1cblxuY2xhc3MgRWRpdG9yUnVsZXJzIGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24ucnVsZXJzLCAobnVtYmVyIHwgSVJ1bGVyT3B0aW9uKVtdLCBJUnVsZXJPcHRpb25bXT4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IGRlZmF1bHRzOiBJUnVsZXJPcHRpb25bXSA9IFtdO1xuXHRcdGNvbnN0IGNvbHVtblNjaGVtYTogSUpTT05TY2hlbWEgPSB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdydWxlcnMuc2l6ZScsIFwiTnVtYmVyIG9mIG1vbm9zcGFjZSBjaGFyYWN0ZXJzIGF0IHdoaWNoIHRoaXMgZWRpdG9yIHJ1bGVyIHdpbGwgcmVuZGVyLlwiKSB9O1xuXHRcdHN1cGVyKFxuXHRcdFx0RWRpdG9yT3B0aW9uLnJ1bGVycywgJ3J1bGVycycsIGRlZmF1bHRzLFxuXHRcdFx0e1xuXHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdGFueU9mOiBbXG5cdFx0XHRcdFx0XHRjb2x1bW5TY2hlbWEsXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHR5cGU6IFtcblx0XHRcdFx0XHRcdFx0XHQnb2JqZWN0J1xuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0Y29sdW1uOiBjb2x1bW5TY2hlbWEsXG5cdFx0XHRcdFx0XHRcdFx0Y29sb3I6IHtcblx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncnVsZXJzLmNvbG9yJywgXCJDb2xvciBvZiB0aGlzIGVkaXRvciBydWxlci5cIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRmb3JtYXQ6ICdjb2xvci1oZXgnXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncnVsZXJzJywgXCJSZW5kZXIgdmVydGljYWwgcnVsZXJzIGFmdGVyIGEgY2VydGFpbiBudW1iZXIgb2YgbW9ub3NwYWNlIGNoYXJhY3RlcnMuIFVzZSBtdWx0aXBsZSB2YWx1ZXMgZm9yIG11bHRpcGxlIHJ1bGVycy4gTm8gcnVsZXJzIGFyZSBkcmF3biBpZiBhcnJheSBpcyBlbXB0eS5cIilcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKGlucHV0OiBhbnkpOiBJUnVsZXJPcHRpb25bXSB7XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoaW5wdXQpKSB7XG5cdFx0XHRjb25zdCBydWxlcnM6IElSdWxlck9wdGlvbltdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IF9lbGVtZW50IG9mIGlucHV0KSB7XG5cdFx0XHRcdGlmICh0eXBlb2YgX2VsZW1lbnQgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0cnVsZXJzLnB1c2goe1xuXHRcdFx0XHRcdFx0Y29sdW1uOiBFZGl0b3JJbnRPcHRpb24uY2xhbXBlZEludChfZWxlbWVudCwgMCwgMCwgMTAwMDApLFxuXHRcdFx0XHRcdFx0Y29sb3I6IG51bGxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIGlmIChfZWxlbWVudCAmJiB0eXBlb2YgX2VsZW1lbnQgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWxlbWVudCA9IF9lbGVtZW50IGFzIElSdWxlck9wdGlvbjtcblx0XHRcdFx0XHRydWxlcnMucHVzaCh7XG5cdFx0XHRcdFx0XHRjb2x1bW46IEVkaXRvckludE9wdGlvbi5jbGFtcGVkSW50KGVsZW1lbnQuY29sdW1uLCAwLCAwLCAxMDAwMCksXG5cdFx0XHRcdFx0XHRjb2xvcjogZWxlbWVudC5jb2xvclxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRydWxlcnMuc29ydCgoYSwgYikgPT4gYS5jb2x1bW4gLSBiLmNvbHVtbik7XG5cdFx0XHRyZXR1cm4gcnVsZXJzO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0VmFsdWU7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiByZWFkb25seVxuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgcmVhZG9ubHkgbWVzc2FnZVxuICovXG5jbGFzcyBSZWFkb25seU1lc3NhZ2UgZXh0ZW5kcyBCYXNlRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi5yZWFkT25seU1lc3NhZ2UsIElNYXJrZG93blN0cmluZyB8IHVuZGVmaW5lZCwgSU1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IGRlZmF1bHRzID0gdW5kZWZpbmVkO1xuXG5cdFx0c3VwZXIoXG5cdFx0XHRFZGl0b3JPcHRpb24ucmVhZE9ubHlNZXNzYWdlLCAncmVhZE9ubHlNZXNzYWdlJywgZGVmYXVsdHNcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKF9pbnB1dDogYW55KTogSU1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIV9pbnB1dCB8fCB0eXBlb2YgX2lucHV0ICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRyZXR1cm4gX2lucHV0IGFzIElNYXJrZG93blN0cmluZztcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIHNjcm9sbGJhclxuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgZWRpdG9yIHNjcm9sbGJhcnNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJRWRpdG9yU2Nyb2xsYmFyT3B0aW9ucyB7XG5cdC8qKlxuXHQgKiBUaGUgc2l6ZSBvZiBhcnJvd3MgKGlmIGRpc3BsYXllZCkuXG5cdCAqIERlZmF1bHRzIHRvIDExLlxuXHQgKiAqKk5PVEUqKjogVGhpcyBvcHRpb24gY2Fubm90IGJlIHVwZGF0ZWQgdXNpbmcgYHVwZGF0ZU9wdGlvbnMoKWBcblx0ICovXG5cdGFycm93U2l6ZT86IG51bWJlcjtcblx0LyoqXG5cdCAqIFJlbmRlciB2ZXJ0aWNhbCBzY3JvbGxiYXIuXG5cdCAqIERlZmF1bHRzIHRvICdhdXRvJy5cblx0ICovXG5cdHZlcnRpY2FsPzogJ2F1dG8nIHwgJ3Zpc2libGUnIHwgJ2hpZGRlbic7XG5cdC8qKlxuXHQgKiBSZW5kZXIgaG9yaXpvbnRhbCBzY3JvbGxiYXIuXG5cdCAqIERlZmF1bHRzIHRvICdhdXRvJy5cblx0ICovXG5cdGhvcml6b250YWw/OiAnYXV0bycgfCAndmlzaWJsZScgfCAnaGlkZGVuJztcblx0LyoqXG5cdCAqIENhc3QgaG9yaXpvbnRhbCBhbmQgdmVydGljYWwgc2hhZG93cyB3aGVuIHRoZSBjb250ZW50IGlzIHNjcm9sbGVkLlxuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKiAqKk5PVEUqKjogVGhpcyBvcHRpb24gY2Fubm90IGJlIHVwZGF0ZWQgdXNpbmcgYHVwZGF0ZU9wdGlvbnMoKWBcblx0ICovXG5cdHVzZVNoYWRvd3M/OiBib29sZWFuO1xuXHQvKipcblx0ICogUmVuZGVyIGFycm93cyBhdCB0aGUgdG9wIGFuZCBib3R0b20gb2YgdGhlIHZlcnRpY2FsIHNjcm9sbGJhci5cblx0ICogRGVmYXVsdHMgdG8gZmFsc2UuXG5cdCAqICoqTk9URSoqOiBUaGlzIG9wdGlvbiBjYW5ub3QgYmUgdXBkYXRlZCB1c2luZyBgdXBkYXRlT3B0aW9ucygpYFxuXHQgKi9cblx0dmVydGljYWxIYXNBcnJvd3M/OiBib29sZWFuO1xuXHQvKipcblx0ICogUmVuZGVyIGFycm93cyBhdCB0aGUgbGVmdCBhbmQgcmlnaHQgb2YgdGhlIGhvcml6b250YWwgc2Nyb2xsYmFyLlxuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0ICogKipOT1RFKio6IFRoaXMgb3B0aW9uIGNhbm5vdCBiZSB1cGRhdGVkIHVzaW5nIGB1cGRhdGVPcHRpb25zKClgXG5cdCAqL1xuXHRob3Jpem9udGFsSGFzQXJyb3dzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIExpc3RlbiB0byBtb3VzZSB3aGVlbCBldmVudHMgYW5kIHJlYWN0IHRvIHRoZW0gYnkgc2Nyb2xsaW5nLlxuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0aGFuZGxlTW91c2VXaGVlbD86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBBbHdheXMgY29uc3VtZSBtb3VzZSB3aGVlbCBldmVudHMgKGFsd2F5cyBjYWxsIHByZXZlbnREZWZhdWx0KCkgYW5kIHN0b3BQcm9wYWdhdGlvbigpIG9uIHRoZSBicm93c2VyIGV2ZW50cykuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqICoqTk9URSoqOiBUaGlzIG9wdGlvbiBjYW5ub3QgYmUgdXBkYXRlZCB1c2luZyBgdXBkYXRlT3B0aW9ucygpYFxuXHQgKi9cblx0YWx3YXlzQ29uc3VtZU1vdXNlV2hlZWw/OiBib29sZWFuO1xuXHQvKipcblx0ICogSGVpZ2h0IGluIHBpeGVscyBmb3IgdGhlIGhvcml6b250YWwgc2Nyb2xsYmFyLlxuXHQgKiBEZWZhdWx0cyB0byAxMCAocHgpLlxuXHQgKi9cblx0aG9yaXpvbnRhbFNjcm9sbGJhclNpemU/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBXaWR0aCBpbiBwaXhlbHMgZm9yIHRoZSB2ZXJ0aWNhbCBzY3JvbGxiYXIuXG5cdCAqIERlZmF1bHRzIHRvIDEwIChweCkuXG5cdCAqL1xuXHR2ZXJ0aWNhbFNjcm9sbGJhclNpemU/OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBXaWR0aCBpbiBwaXhlbHMgZm9yIHRoZSB2ZXJ0aWNhbCBzbGlkZXIuXG5cdCAqIERlZmF1bHRzIHRvIGB2ZXJ0aWNhbFNjcm9sbGJhclNpemVgLlxuXHQgKiAqKk5PVEUqKjogVGhpcyBvcHRpb24gY2Fubm90IGJlIHVwZGF0ZWQgdXNpbmcgYHVwZGF0ZU9wdGlvbnMoKWBcblx0ICovXG5cdHZlcnRpY2FsU2xpZGVyU2l6ZT86IG51bWJlcjtcblx0LyoqXG5cdCAqIEhlaWdodCBpbiBwaXhlbHMgZm9yIHRoZSBob3Jpem9udGFsIHNsaWRlci5cblx0ICogRGVmYXVsdHMgdG8gYGhvcml6b250YWxTY3JvbGxiYXJTaXplYC5cblx0ICogKipOT1RFKio6IFRoaXMgb3B0aW9uIGNhbm5vdCBiZSB1cGRhdGVkIHVzaW5nIGB1cGRhdGVPcHRpb25zKClgXG5cdCAqL1xuXHRob3Jpem9udGFsU2xpZGVyU2l6ZT86IG51bWJlcjtcblx0LyoqXG5cdCAqIFNjcm9sbCBndXR0ZXIgY2xpY2tzIG1vdmUgYnkgcGFnZSB2cyBqdW1wIHRvIHBvc2l0aW9uLlxuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0ICovXG5cdHNjcm9sbEJ5UGFnZT86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFdoZW4gc2V0LCB0aGUgaG9yaXpvbnRhbCBzY3JvbGxiYXIgd2lsbCBub3QgaW5jcmVhc2UgY29udGVudCBoZWlnaHQuXG5cdCAqIERlZmF1bHRzIHRvIGZhbHNlLlxuXHQgKi9cblx0aWdub3JlSG9yaXpvbnRhbFNjcm9sbGJhckluQ29udGVudEhlaWdodD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW50ZXJuYWxFZGl0b3JTY3JvbGxiYXJPcHRpb25zIHtcblx0cmVhZG9ubHkgYXJyb3dTaXplOiBudW1iZXI7XG5cdHJlYWRvbmx5IHZlcnRpY2FsOiBTY3JvbGxiYXJWaXNpYmlsaXR5O1xuXHRyZWFkb25seSBob3Jpem9udGFsOiBTY3JvbGxiYXJWaXNpYmlsaXR5O1xuXHRyZWFkb25seSB1c2VTaGFkb3dzOiBib29sZWFuO1xuXHRyZWFkb25seSB2ZXJ0aWNhbEhhc0Fycm93czogYm9vbGVhbjtcblx0cmVhZG9ubHkgaG9yaXpvbnRhbEhhc0Fycm93czogYm9vbGVhbjtcblx0cmVhZG9ubHkgaGFuZGxlTW91c2VXaGVlbDogYm9vbGVhbjtcblx0cmVhZG9ubHkgYWx3YXlzQ29uc3VtZU1vdXNlV2hlZWw6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGhvcml6b250YWxTY3JvbGxiYXJTaXplOiBudW1iZXI7XG5cdHJlYWRvbmx5IGhvcml6b250YWxTbGlkZXJTaXplOiBudW1iZXI7XG5cdHJlYWRvbmx5IHZlcnRpY2FsU2Nyb2xsYmFyU2l6ZTogbnVtYmVyO1xuXHRyZWFkb25seSB2ZXJ0aWNhbFNsaWRlclNpemU6IG51bWJlcjtcblx0cmVhZG9ubHkgc2Nyb2xsQnlQYWdlOiBib29sZWFuO1xuXHRyZWFkb25seSBpZ25vcmVIb3Jpem9udGFsU2Nyb2xsYmFySW5Db250ZW50SGVpZ2h0OiBib29sZWFuO1xufVxuXG5mdW5jdGlvbiBfc2Nyb2xsYmFyVmlzaWJpbGl0eUZyb21TdHJpbmcodmlzaWJpbGl0eTogc3RyaW5nIHwgdW5kZWZpbmVkLCBkZWZhdWx0VmFsdWU6IFNjcm9sbGJhclZpc2liaWxpdHkpOiBTY3JvbGxiYXJWaXNpYmlsaXR5IHtcblx0aWYgKHR5cGVvZiB2aXNpYmlsaXR5ICE9PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiBkZWZhdWx0VmFsdWU7XG5cdH1cblx0c3dpdGNoICh2aXNpYmlsaXR5KSB7XG5cdFx0Y2FzZSAnaGlkZGVuJzogcmV0dXJuIFNjcm9sbGJhclZpc2liaWxpdHkuSGlkZGVuO1xuXHRcdGNhc2UgJ3Zpc2libGUnOiByZXR1cm4gU2Nyb2xsYmFyVmlzaWJpbGl0eS5WaXNpYmxlO1xuXHRcdGRlZmF1bHQ6IHJldHVybiBTY3JvbGxiYXJWaXNpYmlsaXR5LkF1dG87XG5cdH1cbn1cblxuY2xhc3MgRWRpdG9yU2Nyb2xsYmFyIGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24uc2Nyb2xsYmFyLCBJRWRpdG9yU2Nyb2xsYmFyT3B0aW9ucywgSW50ZXJuYWxFZGl0b3JTY3JvbGxiYXJPcHRpb25zPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0Y29uc3QgZGVmYXVsdHM6IEludGVybmFsRWRpdG9yU2Nyb2xsYmFyT3B0aW9ucyA9IHtcblx0XHRcdHZlcnRpY2FsOiBTY3JvbGxiYXJWaXNpYmlsaXR5LkF1dG8sXG5cdFx0XHRob3Jpem9udGFsOiBTY3JvbGxiYXJWaXNpYmlsaXR5LkF1dG8sXG5cdFx0XHRhcnJvd1NpemU6IDExLFxuXHRcdFx0dXNlU2hhZG93czogdHJ1ZSxcblx0XHRcdHZlcnRpY2FsSGFzQXJyb3dzOiBmYWxzZSxcblx0XHRcdGhvcml6b250YWxIYXNBcnJvd3M6IGZhbHNlLFxuXHRcdFx0aG9yaXpvbnRhbFNjcm9sbGJhclNpemU6IDEyLFxuXHRcdFx0aG9yaXpvbnRhbFNsaWRlclNpemU6IDEyLFxuXHRcdFx0dmVydGljYWxTY3JvbGxiYXJTaXplOiAxNCxcblx0XHRcdHZlcnRpY2FsU2xpZGVyU2l6ZTogMTQsXG5cdFx0XHRoYW5kbGVNb3VzZVdoZWVsOiB0cnVlLFxuXHRcdFx0YWx3YXlzQ29uc3VtZU1vdXNlV2hlZWw6IHRydWUsXG5cdFx0XHRzY3JvbGxCeVBhZ2U6IGZhbHNlLFxuXHRcdFx0aWdub3JlSG9yaXpvbnRhbFNjcm9sbGJhckluQ29udGVudEhlaWdodDogZmFsc2UsXG5cdFx0fTtcblx0XHRzdXBlcihcblx0XHRcdEVkaXRvck9wdGlvbi5zY3JvbGxiYXIsICdzY3JvbGxiYXInLCBkZWZhdWx0cyxcblx0XHRcdHtcblx0XHRcdFx0J2VkaXRvci5zY3JvbGxiYXIudmVydGljYWwnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZW51bTogWydhdXRvJywgJ3Zpc2libGUnLCAnaGlkZGVuJ10sXG5cdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdzY3JvbGxiYXIudmVydGljYWwuYXV0bycsIFwiVGhlIHZlcnRpY2FsIHNjcm9sbGJhciB3aWxsIGJlIHZpc2libGUgb25seSB3aGVuIG5lY2Vzc2FyeS5cIiksXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ3Njcm9sbGJhci52ZXJ0aWNhbC52aXNpYmxlJywgXCJUaGUgdmVydGljYWwgc2Nyb2xsYmFyIHdpbGwgYWx3YXlzIGJlIHZpc2libGUuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdzY3JvbGxiYXIudmVydGljYWwuZml0JywgXCJUaGUgdmVydGljYWwgc2Nyb2xsYmFyIHdpbGwgYWx3YXlzIGJlIGhpZGRlbi5cIiksXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRkZWZhdWx0OiAnYXV0bycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2Nyb2xsYmFyLnZlcnRpY2FsJywgXCJDb250cm9scyB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgdmVydGljYWwgc2Nyb2xsYmFyLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnNjcm9sbGJhci5ob3Jpem9udGFsJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGVudW06IFsnYXV0bycsICd2aXNpYmxlJywgJ2hpZGRlbiddLFxuXHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2Nyb2xsYmFyLmhvcml6b250YWwuYXV0bycsIFwiVGhlIGhvcml6b250YWwgc2Nyb2xsYmFyIHdpbGwgYmUgdmlzaWJsZSBvbmx5IHdoZW4gbmVjZXNzYXJ5LlwiKSxcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2Nyb2xsYmFyLmhvcml6b250YWwudmlzaWJsZScsIFwiVGhlIGhvcml6b250YWwgc2Nyb2xsYmFyIHdpbGwgYWx3YXlzIGJlIHZpc2libGUuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdzY3JvbGxiYXIuaG9yaXpvbnRhbC5maXQnLCBcIlRoZSBob3Jpem9udGFsIHNjcm9sbGJhciB3aWxsIGFsd2F5cyBiZSBoaWRkZW4uXCIpLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0ZGVmYXVsdDogJ2F1dG8nLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Njcm9sbGJhci5ob3Jpem9udGFsJywgXCJDb250cm9scyB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgaG9yaXpvbnRhbCBzY3JvbGxiYXIuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc2Nyb2xsYmFyLnZlcnRpY2FsU2Nyb2xsYmFyU2l6ZSc6IHtcblx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy52ZXJ0aWNhbFNjcm9sbGJhclNpemUsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2Nyb2xsYmFyLnZlcnRpY2FsU2Nyb2xsYmFyU2l6ZScsIFwiVGhlIHdpZHRoIG9mIHRoZSB2ZXJ0aWNhbCBzY3JvbGxiYXIuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc2Nyb2xsYmFyLmhvcml6b250YWxTY3JvbGxiYXJTaXplJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmhvcml6b250YWxTY3JvbGxiYXJTaXplLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Njcm9sbGJhci5ob3Jpem9udGFsU2Nyb2xsYmFyU2l6ZScsIFwiVGhlIGhlaWdodCBvZiB0aGUgaG9yaXpvbnRhbCBzY3JvbGxiYXIuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc2Nyb2xsYmFyLnNjcm9sbEJ5UGFnZSc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuc2Nyb2xsQnlQYWdlLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Njcm9sbGJhci5zY3JvbGxCeVBhZ2UnLCBcIkNvbnRyb2xzIHdoZXRoZXIgY2xpY2tzIHNjcm9sbCBieSBwYWdlIG9yIGp1bXAgdG8gY2xpY2sgcG9zaXRpb24uXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc2Nyb2xsYmFyLmlnbm9yZUhvcml6b250YWxTY3JvbGxiYXJJbkNvbnRlbnRIZWlnaHQnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmlnbm9yZUhvcml6b250YWxTY3JvbGxiYXJJbkNvbnRlbnRIZWlnaHQsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2Nyb2xsYmFyLmlnbm9yZUhvcml6b250YWxTY3JvbGxiYXJJbkNvbnRlbnRIZWlnaHQnLCBcIldoZW4gc2V0LCB0aGUgaG9yaXpvbnRhbCBzY3JvbGxiYXIgd2lsbCBub3QgaW5jcmVhc2UgdGhlIHNpemUgb2YgdGhlIGVkaXRvcidzIGNvbnRlbnQuXCIpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKF9pbnB1dDogYW55KTogSW50ZXJuYWxFZGl0b3JTY3JvbGxiYXJPcHRpb25zIHtcblx0XHRpZiAoIV9pbnB1dCB8fCB0eXBlb2YgX2lucHV0ICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRjb25zdCBpbnB1dCA9IF9pbnB1dCBhcyBJRWRpdG9yU2Nyb2xsYmFyT3B0aW9ucztcblx0XHRjb25zdCBob3Jpem9udGFsU2Nyb2xsYmFyU2l6ZSA9IEVkaXRvckludE9wdGlvbi5jbGFtcGVkSW50KGlucHV0Lmhvcml6b250YWxTY3JvbGxiYXJTaXplLCB0aGlzLmRlZmF1bHRWYWx1ZS5ob3Jpem9udGFsU2Nyb2xsYmFyU2l6ZSwgMCwgMTAwMCk7XG5cdFx0Y29uc3QgdmVydGljYWxTY3JvbGxiYXJTaXplID0gRWRpdG9ySW50T3B0aW9uLmNsYW1wZWRJbnQoaW5wdXQudmVydGljYWxTY3JvbGxiYXJTaXplLCB0aGlzLmRlZmF1bHRWYWx1ZS52ZXJ0aWNhbFNjcm9sbGJhclNpemUsIDAsIDEwMDApO1xuXHRcdHJldHVybiB7XG5cdFx0XHRhcnJvd1NpemU6IEVkaXRvckludE9wdGlvbi5jbGFtcGVkSW50KGlucHV0LmFycm93U2l6ZSwgdGhpcy5kZWZhdWx0VmFsdWUuYXJyb3dTaXplLCAwLCAxMDAwKSxcblx0XHRcdHZlcnRpY2FsOiBfc2Nyb2xsYmFyVmlzaWJpbGl0eUZyb21TdHJpbmcoaW5wdXQudmVydGljYWwsIHRoaXMuZGVmYXVsdFZhbHVlLnZlcnRpY2FsKSxcblx0XHRcdGhvcml6b250YWw6IF9zY3JvbGxiYXJWaXNpYmlsaXR5RnJvbVN0cmluZyhpbnB1dC5ob3Jpem9udGFsLCB0aGlzLmRlZmF1bHRWYWx1ZS5ob3Jpem9udGFsKSxcblx0XHRcdHVzZVNoYWRvd3M6IGJvb2xlYW4oaW5wdXQudXNlU2hhZG93cywgdGhpcy5kZWZhdWx0VmFsdWUudXNlU2hhZG93cyksXG5cdFx0XHR2ZXJ0aWNhbEhhc0Fycm93czogYm9vbGVhbihpbnB1dC52ZXJ0aWNhbEhhc0Fycm93cywgdGhpcy5kZWZhdWx0VmFsdWUudmVydGljYWxIYXNBcnJvd3MpLFxuXHRcdFx0aG9yaXpvbnRhbEhhc0Fycm93czogYm9vbGVhbihpbnB1dC5ob3Jpem9udGFsSGFzQXJyb3dzLCB0aGlzLmRlZmF1bHRWYWx1ZS5ob3Jpem9udGFsSGFzQXJyb3dzKSxcblx0XHRcdGhhbmRsZU1vdXNlV2hlZWw6IGJvb2xlYW4oaW5wdXQuaGFuZGxlTW91c2VXaGVlbCwgdGhpcy5kZWZhdWx0VmFsdWUuaGFuZGxlTW91c2VXaGVlbCksXG5cdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogYm9vbGVhbihpbnB1dC5hbHdheXNDb25zdW1lTW91c2VXaGVlbCwgdGhpcy5kZWZhdWx0VmFsdWUuYWx3YXlzQ29uc3VtZU1vdXNlV2hlZWwpLFxuXHRcdFx0aG9yaXpvbnRhbFNjcm9sbGJhclNpemU6IGhvcml6b250YWxTY3JvbGxiYXJTaXplLFxuXHRcdFx0aG9yaXpvbnRhbFNsaWRlclNpemU6IEVkaXRvckludE9wdGlvbi5jbGFtcGVkSW50KGlucHV0Lmhvcml6b250YWxTbGlkZXJTaXplLCBob3Jpem9udGFsU2Nyb2xsYmFyU2l6ZSwgMCwgMTAwMCksXG5cdFx0XHR2ZXJ0aWNhbFNjcm9sbGJhclNpemU6IHZlcnRpY2FsU2Nyb2xsYmFyU2l6ZSxcblx0XHRcdHZlcnRpY2FsU2xpZGVyU2l6ZTogRWRpdG9ySW50T3B0aW9uLmNsYW1wZWRJbnQoaW5wdXQudmVydGljYWxTbGlkZXJTaXplLCB2ZXJ0aWNhbFNjcm9sbGJhclNpemUsIDAsIDEwMDApLFxuXHRcdFx0c2Nyb2xsQnlQYWdlOiBib29sZWFuKGlucHV0LnNjcm9sbEJ5UGFnZSwgdGhpcy5kZWZhdWx0VmFsdWUuc2Nyb2xsQnlQYWdlKSxcblx0XHRcdGlnbm9yZUhvcml6b250YWxTY3JvbGxiYXJJbkNvbnRlbnRIZWlnaHQ6IGJvb2xlYW4oaW5wdXQuaWdub3JlSG9yaXpvbnRhbFNjcm9sbGJhckluQ29udGVudEhlaWdodCwgdGhpcy5kZWZhdWx0VmFsdWUuaWdub3JlSG9yaXpvbnRhbFNjcm9sbGJhckluQ29udGVudEhlaWdodCksXG5cdFx0fTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIFVuaWNvZGVIaWdobGlnaHRcblxuZXhwb3J0IHR5cGUgSW5VbnRydXN0ZWRXb3Jrc3BhY2UgPSAnaW5VbnRydXN0ZWRXb3Jrc3BhY2UnO1xuXG4vKipcbiAqIEBpbnRlcm5hbFxuKi9cbmV4cG9ydCBjb25zdCBpblVudHJ1c3RlZFdvcmtzcGFjZTogSW5VbnRydXN0ZWRXb3Jrc3BhY2UgPSAnaW5VbnRydXN0ZWRXb3Jrc3BhY2UnO1xuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdW5pY29kZSBoaWdobGlnaHRpbmcuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVVuaWNvZGVIaWdobGlnaHRPcHRpb25zIHtcblxuXHQvKipcblx0ICogQ29udHJvbHMgd2hldGhlciBhbGwgbm9uLWJhc2ljIEFTQ0lJIGNoYXJhY3RlcnMgYXJlIGhpZ2hsaWdodGVkLiBPbmx5IGNoYXJhY3RlcnMgYmV0d2VlbiBVKzAwMjAgYW5kIFUrMDA3RSwgdGFiLCBsaW5lLWZlZWQgYW5kIGNhcnJpYWdlLXJldHVybiBhcmUgY29uc2lkZXJlZCBiYXNpYyBBU0NJSS5cblx0ICovXG5cdG5vbkJhc2ljQVNDSUk/OiBib29sZWFuIHwgSW5VbnRydXN0ZWRXb3Jrc3BhY2U7XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgY2hhcmFjdGVycyB0aGF0IGp1c3QgcmVzZXJ2ZSBzcGFjZSBvciBoYXZlIG5vIHdpZHRoIGF0IGFsbCBhcmUgaGlnaGxpZ2h0ZWQuXG5cdCAqL1xuXHRpbnZpc2libGVDaGFyYWN0ZXJzPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogQ29udHJvbHMgd2hldGhlciBjaGFyYWN0ZXJzIGFyZSBoaWdobGlnaHRlZCB0aGF0IGNhbiBiZSBjb25mdXNlZCB3aXRoIGJhc2ljIEFTQ0lJIGNoYXJhY3RlcnMsIGV4Y2VwdCB0aG9zZSB0aGF0IGFyZSBjb21tb24gaW4gdGhlIGN1cnJlbnQgdXNlciBsb2NhbGUuXG5cdCAqL1xuXHRhbWJpZ3VvdXNDaGFyYWN0ZXJzPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogQ29udHJvbHMgd2hldGhlciBjaGFyYWN0ZXJzIGluIGNvbW1lbnRzIHNob3VsZCBhbHNvIGJlIHN1YmplY3QgdG8gdW5pY29kZSBoaWdobGlnaHRpbmcuXG5cdCAqL1xuXHRpbmNsdWRlQ29tbWVudHM/OiBib29sZWFuIHwgSW5VbnRydXN0ZWRXb3Jrc3BhY2U7XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgY2hhcmFjdGVycyBpbiBzdHJpbmdzIHNob3VsZCBhbHNvIGJlIHN1YmplY3QgdG8gdW5pY29kZSBoaWdobGlnaHRpbmcuXG5cdCAqL1xuXHRpbmNsdWRlU3RyaW5ncz86IGJvb2xlYW4gfCBJblVudHJ1c3RlZFdvcmtzcGFjZTtcblxuXHQvKipcblx0ICogRGVmaW5lcyBhbGxvd2VkIGNoYXJhY3RlcnMgdGhhdCBhcmUgbm90IGJlaW5nIGhpZ2hsaWdodGVkLlxuXHQgKi9cblx0YWxsb3dlZENoYXJhY3RlcnM/OiBSZWNvcmQ8c3RyaW5nLCB0cnVlPjtcblxuXHQvKipcblx0ICogVW5pY29kZSBjaGFyYWN0ZXJzIHRoYXQgYXJlIGNvbW1vbiBpbiBhbGxvd2VkIGxvY2FsZXMgYXJlIG5vdCBiZWluZyBoaWdobGlnaHRlZC5cblx0ICovXG5cdGFsbG93ZWRMb2NhbGVzPzogUmVjb3JkPHN0cmluZyB8ICdfb3MnIHwgJ192c2NvZGUnLCB0cnVlPjtcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IHR5cGUgSW50ZXJuYWxVbmljb2RlSGlnaGxpZ2h0T3B0aW9ucyA9IFJlcXVpcmVkPFJlYWRvbmx5PElVbmljb2RlSGlnaGxpZ2h0T3B0aW9ucz4+O1xuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgY29uc3QgdW5pY29kZUhpZ2hsaWdodENvbmZpZ0tleXMgPSB7XG5cdGFsbG93ZWRDaGFyYWN0ZXJzOiAnZWRpdG9yLnVuaWNvZGVIaWdobGlnaHQuYWxsb3dlZENoYXJhY3RlcnMnLFxuXHRpbnZpc2libGVDaGFyYWN0ZXJzOiAnZWRpdG9yLnVuaWNvZGVIaWdobGlnaHQuaW52aXNpYmxlQ2hhcmFjdGVycycsXG5cdG5vbkJhc2ljQVNDSUk6ICdlZGl0b3IudW5pY29kZUhpZ2hsaWdodC5ub25CYXNpY0FTQ0lJJyxcblx0YW1iaWd1b3VzQ2hhcmFjdGVyczogJ2VkaXRvci51bmljb2RlSGlnaGxpZ2h0LmFtYmlndW91c0NoYXJhY3RlcnMnLFxuXHRpbmNsdWRlQ29tbWVudHM6ICdlZGl0b3IudW5pY29kZUhpZ2hsaWdodC5pbmNsdWRlQ29tbWVudHMnLFxuXHRpbmNsdWRlU3RyaW5nczogJ2VkaXRvci51bmljb2RlSGlnaGxpZ2h0LmluY2x1ZGVTdHJpbmdzJyxcblx0YWxsb3dlZExvY2FsZXM6ICdlZGl0b3IudW5pY29kZUhpZ2hsaWdodC5hbGxvd2VkTG9jYWxlcycsXG59O1xuXG5jbGFzcyBVbmljb2RlSGlnaGxpZ2h0IGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24udW5pY29kZUhpZ2hsaWdodGluZywgSVVuaWNvZGVIaWdobGlnaHRPcHRpb25zLCBJbnRlcm5hbFVuaWNvZGVIaWdobGlnaHRPcHRpb25zPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IGRlZmF1bHRzOiBJbnRlcm5hbFVuaWNvZGVIaWdobGlnaHRPcHRpb25zID0ge1xuXHRcdFx0bm9uQmFzaWNBU0NJSTogaW5VbnRydXN0ZWRXb3Jrc3BhY2UsXG5cdFx0XHRpbnZpc2libGVDaGFyYWN0ZXJzOiB0cnVlLFxuXHRcdFx0YW1iaWd1b3VzQ2hhcmFjdGVyczogdHJ1ZSxcblx0XHRcdGluY2x1ZGVDb21tZW50czogaW5VbnRydXN0ZWRXb3Jrc3BhY2UsXG5cdFx0XHRpbmNsdWRlU3RyaW5nczogdHJ1ZSxcblx0XHRcdGFsbG93ZWRDaGFyYWN0ZXJzOiB7fSxcblx0XHRcdGFsbG93ZWRMb2NhbGVzOiB7IF9vczogdHJ1ZSwgX3ZzY29kZTogdHJ1ZSB9LFxuXHRcdH07XG5cblx0XHRzdXBlcihcblx0XHRcdEVkaXRvck9wdGlvbi51bmljb2RlSGlnaGxpZ2h0aW5nLCAndW5pY29kZUhpZ2hsaWdodCcsIGRlZmF1bHRzLFxuXHRcdFx0e1xuXHRcdFx0XHRbdW5pY29kZUhpZ2hsaWdodENvbmZpZ0tleXMubm9uQmFzaWNBU0NJSV06IHtcblx0XHRcdFx0XHRyZXN0cmljdGVkOiB0cnVlLFxuXHRcdFx0XHRcdHR5cGU6IFsnYm9vbGVhbicsICdzdHJpbmcnXSxcblx0XHRcdFx0XHRlbnVtOiBbdHJ1ZSwgZmFsc2UsIGluVW50cnVzdGVkV29ya3NwYWNlXSxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5ub25CYXNpY0FTQ0lJLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3VuaWNvZGVIaWdobGlnaHQubm9uQmFzaWNBU0NJSScsIFwiQ29udHJvbHMgd2hldGhlciBhbGwgbm9uLWJhc2ljIEFTQ0lJIGNoYXJhY3RlcnMgYXJlIGhpZ2hsaWdodGVkLiBPbmx5IGNoYXJhY3RlcnMgYmV0d2VlbiBVKzAwMjAgYW5kIFUrMDA3RSwgdGFiLCBsaW5lLWZlZWQgYW5kIGNhcnJpYWdlLXJldHVybiBhcmUgY29uc2lkZXJlZCBiYXNpYyBBU0NJSS5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0W3VuaWNvZGVIaWdobGlnaHRDb25maWdLZXlzLmludmlzaWJsZUNoYXJhY3RlcnNdOiB7XG5cdFx0XHRcdFx0cmVzdHJpY3RlZDogdHJ1ZSxcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuaW52aXNpYmxlQ2hhcmFjdGVycyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd1bmljb2RlSGlnaGxpZ2h0LmludmlzaWJsZUNoYXJhY3RlcnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgY2hhcmFjdGVycyB0aGF0IGp1c3QgcmVzZXJ2ZSBzcGFjZSBvciBoYXZlIG5vIHdpZHRoIGF0IGFsbCBhcmUgaGlnaGxpZ2h0ZWQuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdFt1bmljb2RlSGlnaGxpZ2h0Q29uZmlnS2V5cy5hbWJpZ3VvdXNDaGFyYWN0ZXJzXToge1xuXHRcdFx0XHRcdHJlc3RyaWN0ZWQ6IHRydWUsXG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmFtYmlndW91c0NoYXJhY3RlcnMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndW5pY29kZUhpZ2hsaWdodC5hbWJpZ3VvdXNDaGFyYWN0ZXJzJywgXCJDb250cm9scyB3aGV0aGVyIGNoYXJhY3RlcnMgYXJlIGhpZ2hsaWdodGVkIHRoYXQgY2FuIGJlIGNvbmZ1c2VkIHdpdGggYmFzaWMgQVNDSUkgY2hhcmFjdGVycywgZXhjZXB0IHRob3NlIHRoYXQgYXJlIGNvbW1vbiBpbiB0aGUgY3VycmVudCB1c2VyIGxvY2FsZS5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0W3VuaWNvZGVIaWdobGlnaHRDb25maWdLZXlzLmluY2x1ZGVDb21tZW50c106IHtcblx0XHRcdFx0XHRyZXN0cmljdGVkOiB0cnVlLFxuXHRcdFx0XHRcdHR5cGU6IFsnYm9vbGVhbicsICdzdHJpbmcnXSxcblx0XHRcdFx0XHRlbnVtOiBbdHJ1ZSwgZmFsc2UsIGluVW50cnVzdGVkV29ya3NwYWNlXSxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5pbmNsdWRlQ29tbWVudHMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndW5pY29kZUhpZ2hsaWdodC5pbmNsdWRlQ29tbWVudHMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgY2hhcmFjdGVycyBpbiBjb21tZW50cyBzaG91bGQgYWxzbyBiZSBzdWJqZWN0IHRvIFVuaWNvZGUgaGlnaGxpZ2h0aW5nLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRbdW5pY29kZUhpZ2hsaWdodENvbmZpZ0tleXMuaW5jbHVkZVN0cmluZ3NdOiB7XG5cdFx0XHRcdFx0cmVzdHJpY3RlZDogdHJ1ZSxcblx0XHRcdFx0XHR0eXBlOiBbJ2Jvb2xlYW4nLCAnc3RyaW5nJ10sXG5cdFx0XHRcdFx0ZW51bTogW3RydWUsIGZhbHNlLCBpblVudHJ1c3RlZFdvcmtzcGFjZV0sXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuaW5jbHVkZVN0cmluZ3MsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndW5pY29kZUhpZ2hsaWdodC5pbmNsdWRlU3RyaW5ncycsIFwiQ29udHJvbHMgd2hldGhlciBjaGFyYWN0ZXJzIGluIHN0cmluZ3Mgc2hvdWxkIGFsc28gYmUgc3ViamVjdCB0byBVbmljb2RlIGhpZ2hsaWdodGluZy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0W3VuaWNvZGVIaWdobGlnaHRDb25maWdLZXlzLmFsbG93ZWRDaGFyYWN0ZXJzXToge1xuXHRcdFx0XHRcdHJlc3RyaWN0ZWQ6IHRydWUsXG5cdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuYWxsb3dlZENoYXJhY3RlcnMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndW5pY29kZUhpZ2hsaWdodC5hbGxvd2VkQ2hhcmFjdGVycycsIFwiRGVmaW5lcyBhbGxvd2VkIGNoYXJhY3RlcnMgdGhhdCBhcmUgbm90IGJlaW5nIGhpZ2hsaWdodGVkLlwiKSxcblx0XHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRbdW5pY29kZUhpZ2hsaWdodENvbmZpZ0tleXMuYWxsb3dlZExvY2FsZXNdOiB7XG5cdFx0XHRcdFx0cmVzdHJpY3RlZDogdHJ1ZSxcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5hbGxvd2VkTG9jYWxlcyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd1bmljb2RlSGlnaGxpZ2h0LmFsbG93ZWRMb2NhbGVzJywgXCJVbmljb2RlIGNoYXJhY3RlcnMgdGhhdCBhcmUgY29tbW9uIGluIGFsbG93ZWQgbG9jYWxlcyBhcmUgbm90IGJlaW5nIGhpZ2hsaWdodGVkLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgYXBwbHlVcGRhdGUodmFsdWU6IFJlcXVpcmVkPFJlYWRvbmx5PElVbmljb2RlSGlnaGxpZ2h0T3B0aW9ucz4+IHwgdW5kZWZpbmVkLCB1cGRhdGU6IFJlcXVpcmVkPFJlYWRvbmx5PElVbmljb2RlSGlnaGxpZ2h0T3B0aW9ucz4+KTogQXBwbHlVcGRhdGVSZXN1bHQ8UmVxdWlyZWQ8UmVhZG9ubHk8SVVuaWNvZGVIaWdobGlnaHRPcHRpb25zPj4+IHtcblx0XHRsZXQgZGlkQ2hhbmdlID0gZmFsc2U7XG5cdFx0aWYgKHVwZGF0ZS5hbGxvd2VkQ2hhcmFjdGVycyAmJiB2YWx1ZSkge1xuXHRcdFx0Ly8gVHJlYXQgYWxsb3dlZENoYXJhY3RlcnMgYXRvbWljYWxseVxuXHRcdFx0aWYgKCFvYmplY3RzLmVxdWFscyh2YWx1ZS5hbGxvd2VkQ2hhcmFjdGVycywgdXBkYXRlLmFsbG93ZWRDaGFyYWN0ZXJzKSkge1xuXHRcdFx0XHR2YWx1ZSA9IHsgLi4udmFsdWUsIGFsbG93ZWRDaGFyYWN0ZXJzOiB1cGRhdGUuYWxsb3dlZENoYXJhY3RlcnMgfTtcblx0XHRcdFx0ZGlkQ2hhbmdlID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHVwZGF0ZS5hbGxvd2VkTG9jYWxlcyAmJiB2YWx1ZSkge1xuXHRcdFx0Ly8gVHJlYXQgYWxsb3dlZExvY2FsZXMgYXRvbWljYWxseVxuXHRcdFx0aWYgKCFvYmplY3RzLmVxdWFscyh2YWx1ZS5hbGxvd2VkTG9jYWxlcywgdXBkYXRlLmFsbG93ZWRMb2NhbGVzKSkge1xuXHRcdFx0XHR2YWx1ZSA9IHsgLi4udmFsdWUsIGFsbG93ZWRMb2NhbGVzOiB1cGRhdGUuYWxsb3dlZExvY2FsZXMgfTtcblx0XHRcdFx0ZGlkQ2hhbmdlID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBzdXBlci5hcHBseVVwZGF0ZSh2YWx1ZSwgdXBkYXRlKTtcblx0XHRpZiAoZGlkQ2hhbmdlKSB7XG5cdFx0XHRyZXR1cm4gbmV3IEFwcGx5VXBkYXRlUmVzdWx0KHJlc3VsdC5uZXdWYWx1ZSwgdHJ1ZSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgdmFsaWRhdGUoX2lucHV0OiBhbnkpOiBJbnRlcm5hbFVuaWNvZGVIaWdobGlnaHRPcHRpb25zIHtcblx0XHRpZiAoIV9pbnB1dCB8fCB0eXBlb2YgX2lucHV0ICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRjb25zdCBpbnB1dCA9IF9pbnB1dCBhcyBJVW5pY29kZUhpZ2hsaWdodE9wdGlvbnM7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5vbkJhc2ljQVNDSUk6IHByaW1pdGl2ZVNldDxib29sZWFuIHwgSW5VbnRydXN0ZWRXb3Jrc3BhY2U+KGlucHV0Lm5vbkJhc2ljQVNDSUksIGluVW50cnVzdGVkV29ya3NwYWNlLCBbdHJ1ZSwgZmFsc2UsIGluVW50cnVzdGVkV29ya3NwYWNlXSksXG5cdFx0XHRpbnZpc2libGVDaGFyYWN0ZXJzOiBib29sZWFuKGlucHV0LmludmlzaWJsZUNoYXJhY3RlcnMsIHRoaXMuZGVmYXVsdFZhbHVlLmludmlzaWJsZUNoYXJhY3RlcnMpLFxuXHRcdFx0YW1iaWd1b3VzQ2hhcmFjdGVyczogYm9vbGVhbihpbnB1dC5hbWJpZ3VvdXNDaGFyYWN0ZXJzLCB0aGlzLmRlZmF1bHRWYWx1ZS5hbWJpZ3VvdXNDaGFyYWN0ZXJzKSxcblx0XHRcdGluY2x1ZGVDb21tZW50czogcHJpbWl0aXZlU2V0PGJvb2xlYW4gfCBJblVudHJ1c3RlZFdvcmtzcGFjZT4oaW5wdXQuaW5jbHVkZUNvbW1lbnRzLCBpblVudHJ1c3RlZFdvcmtzcGFjZSwgW3RydWUsIGZhbHNlLCBpblVudHJ1c3RlZFdvcmtzcGFjZV0pLFxuXHRcdFx0aW5jbHVkZVN0cmluZ3M6IHByaW1pdGl2ZVNldDxib29sZWFuIHwgSW5VbnRydXN0ZWRXb3Jrc3BhY2U+KGlucHV0LmluY2x1ZGVTdHJpbmdzLCBpblVudHJ1c3RlZFdvcmtzcGFjZSwgW3RydWUsIGZhbHNlLCBpblVudHJ1c3RlZFdvcmtzcGFjZV0pLFxuXHRcdFx0YWxsb3dlZENoYXJhY3RlcnM6IHRoaXMudmFsaWRhdGVCb29sZWFuTWFwKF9pbnB1dC5hbGxvd2VkQ2hhcmFjdGVycywgdGhpcy5kZWZhdWx0VmFsdWUuYWxsb3dlZENoYXJhY3RlcnMpLFxuXHRcdFx0YWxsb3dlZExvY2FsZXM6IHRoaXMudmFsaWRhdGVCb29sZWFuTWFwKF9pbnB1dC5hbGxvd2VkTG9jYWxlcywgdGhpcy5kZWZhdWx0VmFsdWUuYWxsb3dlZExvY2FsZXMpLFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHZhbGlkYXRlQm9vbGVhbk1hcChtYXA6IHVua25vd24sIGRlZmF1bHRWYWx1ZTogUmVjb3JkPHN0cmluZywgdHJ1ZT4pOiBSZWNvcmQ8c3RyaW5nLCB0cnVlPiB7XG5cdFx0aWYgKCh0eXBlb2YgbWFwICE9PSAnb2JqZWN0JykgfHwgIW1hcCkge1xuXHRcdFx0cmV0dXJuIGRlZmF1bHRWYWx1ZTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCB0cnVlPiA9IHt9O1xuXHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKG1hcCkpIHtcblx0XHRcdGlmICh2YWx1ZSA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRyZXN1bHRba2V5XSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBpbmxpbmVTdWdnZXN0XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUlubGluZVN1Z2dlc3RPcHRpb25zIHtcblx0LyoqXG5cdCAqIEVuYWJsZSBvciBkaXNhYmxlIHRoZSByZW5kZXJpbmcgb2YgYXV0b21hdGljIGlubGluZSBjb21wbGV0aW9ucy5cblx0Ki9cblx0ZW5hYmxlZD86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIENvbmZpZ3VyZXMgdGhlIG1vZGUuXG5cdCAqIFVzZSBgcHJlZml4YCB0byBvbmx5IHNob3cgZ2hvc3QgdGV4dCBpZiB0aGUgdGV4dCB0byByZXBsYWNlIGlzIGEgcHJlZml4IG9mIHRoZSBzdWdnZXN0aW9uIHRleHQuXG5cdCAqIFVzZSBgc3Vid29yZGAgdG8gb25seSBzaG93IGdob3N0IHRleHQgaWYgdGhlIHJlcGxhY2UgdGV4dCBpcyBhIHN1YndvcmQgb2YgdGhlIHN1Z2dlc3Rpb24gdGV4dC5cblx0ICogVXNlIGBzdWJ3b3JkU21hcnRgIHRvIG9ubHkgc2hvdyBnaG9zdCB0ZXh0IGlmIHRoZSByZXBsYWNlIHRleHQgaXMgYSBzdWJ3b3JkIG9mIHRoZSBzdWdnZXN0aW9uIHRleHQsIGJ1dCB0aGUgc3Vid29yZCBtdXN0IHN0YXJ0IGFmdGVyIHRoZSBjdXJzb3IgcG9zaXRpb24uXG5cdCAqIERlZmF1bHRzIHRvIGBwcmVmaXhgLlxuXHQqL1xuXHRtb2RlPzogJ3ByZWZpeCcgfCAnc3Vid29yZCcgfCAnc3Vid29yZFNtYXJ0JztcblxuXHRzaG93VG9vbGJhcj86ICdhbHdheXMnIHwgJ29uSG92ZXInIHwgJ25ldmVyJztcblxuXHRzeW50YXhIaWdobGlnaHRpbmdFbmFibGVkPzogYm9vbGVhbjtcblxuXHRzdXBwcmVzc1N1Z2dlc3Rpb25zPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogRG9lcyBub3QgY2xlYXIgYWN0aXZlIGlubGluZSBzdWdnZXN0aW9ucyB3aGVuIHRoZSBlZGl0b3IgbG9zZXMgZm9jdXMuXG5cdCAqL1xuXHRrZWVwT25CbHVyPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogRm9udCBmYW1pbHkgZm9yIGlubGluZSBzdWdnZXN0aW9ucy5cblx0ICovXG5cdGZvbnRGYW1pbHk/OiBzdHJpbmcgfCAnZGVmYXVsdCc7XG5cblx0ZWRpdHM/OiB7XG5cdFx0YWxsb3dDb2RlU2hpZnRpbmc/OiAnYWx3YXlzJyB8ICdob3Jpem9udGFsJyB8ICduZXZlcic7XG5cblx0XHRyZW5kZXJTaWRlQnlTaWRlPzogJ25ldmVyJyB8ICdhdXRvJztcblxuXHRcdHNob3dDb2xsYXBzZWQ/OiBib29sZWFuO1xuXG5cdFx0LyoqXG5cdFx0KiBAaW50ZXJuYWxcblx0XHQqL1xuXHRcdGVuYWJsZWQ/OiBib29sZWFuO1xuXHRcdC8qKlxuXHRcdCogQGludGVybmFsXG5cdFx0Ki9cblx0XHR1c2VNdWx0aUxpbmVHaG9zdFRleHQ/OiBib29sZWFuO1xuXHR9O1xufVxuXG50eXBlIFJlcXVpcmVkUmVjdXJzaXZlPFQ+ID0ge1xuXHRbUCBpbiBrZXlvZiBUXS0/OiBUW1BdIGV4dGVuZHMgb2JqZWN0IHwgdW5kZWZpbmVkID8gUmVxdWlyZWRSZWN1cnNpdmU8VFtQXT4gOiBUW1BdO1xufTtcblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IHR5cGUgSW50ZXJuYWxJbmxpbmVTdWdnZXN0T3B0aW9ucyA9IFJlYWRvbmx5PFJlcXVpcmVkUmVjdXJzaXZlPElJbmxpbmVTdWdnZXN0T3B0aW9ucz4+O1xuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgaW5saW5lIHN1Z2dlc3Rpb25zXG4gKi9cbmNsYXNzIElubGluZUVkaXRvclN1Z2dlc3QgZXh0ZW5kcyBCYXNlRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi5pbmxpbmVTdWdnZXN0LCBJSW5saW5lU3VnZ2VzdE9wdGlvbnMsIEludGVybmFsSW5saW5lU3VnZ2VzdE9wdGlvbnM+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0Y29uc3QgZGVmYXVsdHM6IEludGVybmFsSW5saW5lU3VnZ2VzdE9wdGlvbnMgPSB7XG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0bW9kZTogJ3N1YndvcmRTbWFydCcsXG5cdFx0XHRzaG93VG9vbGJhcjogJ29uSG92ZXInLFxuXHRcdFx0c3VwcHJlc3NTdWdnZXN0aW9uczogZmFsc2UsXG5cdFx0XHRrZWVwT25CbHVyOiBmYWxzZSxcblx0XHRcdGZvbnRGYW1pbHk6ICdkZWZhdWx0Jyxcblx0XHRcdHN5bnRheEhpZ2hsaWdodGluZ0VuYWJsZWQ6IHRydWUsXG5cdFx0XHRlZGl0czoge1xuXHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRzaG93Q29sbGFwc2VkOiBmYWxzZSxcblx0XHRcdFx0cmVuZGVyU2lkZUJ5U2lkZTogJ2F1dG8nLFxuXHRcdFx0XHRhbGxvd0NvZGVTaGlmdGluZzogJ2Fsd2F5cycsXG5cdFx0XHRcdHVzZU11bHRpTGluZUdob3N0VGV4dDogdHJ1ZVxuXHRcdFx0fSxcblx0XHR9O1xuXG5cdFx0c3VwZXIoXG5cdFx0XHRFZGl0b3JPcHRpb24uaW5saW5lU3VnZ2VzdCwgJ2lubGluZVN1Z2dlc3QnLCBkZWZhdWx0cyxcblx0XHRcdHtcblx0XHRcdFx0J2VkaXRvci5pbmxpbmVTdWdnZXN0LmVuYWJsZWQnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmVuYWJsZWQsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnaW5saW5lU3VnZ2VzdC5lbmFibGVkJywgXCJDb250cm9scyB3aGV0aGVyIHRvIGF1dG9tYXRpY2FsbHkgc2hvdyBpbmxpbmUgc3VnZ2VzdGlvbnMgaW4gdGhlIGVkaXRvci5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5pbmxpbmVTdWdnZXN0LnNob3dUb29sYmFyJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLnNob3dUb29sYmFyLFxuXHRcdFx0XHRcdGVudW06IFsnYWx3YXlzJywgJ29uSG92ZXInLCAnbmV2ZXInXSxcblx0XHRcdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2lubGluZVN1Z2dlc3Quc2hvd1Rvb2xiYXIuYWx3YXlzJywgXCJTaG93IHRoZSBpbmxpbmUgc3VnZ2VzdGlvbiB0b29sYmFyIHdoZW5ldmVyIGFuIGlubGluZSBzdWdnZXN0aW9uIGlzIHNob3duLlwiKSxcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnaW5saW5lU3VnZ2VzdC5zaG93VG9vbGJhci5vbkhvdmVyJywgXCJTaG93IHRoZSBpbmxpbmUgc3VnZ2VzdGlvbiB0b29sYmFyIHdoZW4gaG92ZXJpbmcgb3ZlciBhbiBpbmxpbmUgc3VnZ2VzdGlvbi5cIiksXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2lubGluZVN1Z2dlc3Quc2hvd1Rvb2xiYXIubmV2ZXInLCBcIk5ldmVyIHNob3cgdGhlIGlubGluZSBzdWdnZXN0aW9uIHRvb2xiYXIuXCIpLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnaW5saW5lU3VnZ2VzdC5zaG93VG9vbGJhcicsIFwiQ29udHJvbHMgd2hlbiB0byBzaG93IHRoZSBpbmxpbmUgc3VnZ2VzdGlvbiB0b29sYmFyLlwiKSxcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5pbmxpbmVTdWdnZXN0LnN5bnRheEhpZ2hsaWdodGluZ0VuYWJsZWQnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLnN5bnRheEhpZ2hsaWdodGluZ0VuYWJsZWQsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnaW5saW5lU3VnZ2VzdC5zeW50YXhIaWdobGlnaHRpbmdFbmFibGVkJywgXCJDb250cm9scyB3aGV0aGVyIHRvIHNob3cgc3ludGF4IGhpZ2hsaWdodGluZyBmb3IgaW5saW5lIHN1Z2dlc3Rpb25zIGluIHRoZSBlZGl0b3IuXCIpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLmlubGluZVN1Z2dlc3Quc3VwcHJlc3NTdWdnZXN0aW9ucyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuc3VwcHJlc3NTdWdnZXN0aW9ucyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdpbmxpbmVTdWdnZXN0LnN1cHByZXNzU3VnZ2VzdGlvbnMnLCBcIkNvbnRyb2xzIGhvdyBpbmxpbmUgc3VnZ2VzdGlvbnMgaW50ZXJhY3Qgd2l0aCB0aGUgc3VnZ2VzdCB3aWRnZXQuIElmIGVuYWJsZWQsIHRoZSBzdWdnZXN0IHdpZGdldCBpcyBub3Qgc2hvd24gYXV0b21hdGljYWxseSB3aGVuIGlubGluZSBzdWdnZXN0aW9ucyBhcmUgYXZhaWxhYmxlLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLmlubGluZVN1Z2dlc3QuZm9udEZhbWlseSc6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5mb250RmFtaWx5LFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2lubGluZVN1Z2dlc3QuZm9udEZhbWlseScsIFwiQ29udHJvbHMgdGhlIGZvbnQgZmFtaWx5IG9mIHRoZSBpbmxpbmUgc3VnZ2VzdGlvbnMuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuaW5saW5lU3VnZ2VzdC5lZGl0cy5hbGxvd0NvZGVTaGlmdGluZyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5lZGl0cy5hbGxvd0NvZGVTaGlmdGluZyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdpbmxpbmVTdWdnZXN0LmVkaXRzLmFsbG93Q29kZVNoaWZ0aW5nJywgXCJDb250cm9scyB3aGV0aGVyIHNob3dpbmcgYSBzdWdnZXN0aW9uIHdpbGwgc2hpZnQgdGhlIGNvZGUgdG8gbWFrZSBzcGFjZSBmb3IgdGhlIHN1Z2dlc3Rpb24gaW5saW5lLlwiKSxcblx0XHRcdFx0XHRlbnVtOiBbJ2Fsd2F5cycsICdob3Jpem9udGFsJywgJ25ldmVyJ10sXG5cdFx0XHRcdFx0dGFnczogWyduZXh0RWRpdFN1Z2dlc3Rpb25zJ11cblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5pbmxpbmVTdWdnZXN0LmVkaXRzLnJlbmRlclNpZGVCeVNpZGUnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuZWRpdHMucmVuZGVyU2lkZUJ5U2lkZSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdpbmxpbmVTdWdnZXN0LmVkaXRzLnJlbmRlclNpZGVCeVNpZGUnLCBcIkNvbnRyb2xzIHdoZXRoZXIgbGFyZ2VyIHN1Z2dlc3Rpb25zIGNhbiBiZSBzaG93biBzaWRlIGJ5IHNpZGUuXCIpLFxuXHRcdFx0XHRcdGVudW06IFsnYXV0bycsICduZXZlciddLFxuXHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmlubGluZVN1Z2dlc3QuZWRpdHMucmVuZGVyU2lkZUJ5U2lkZS5hdXRvJywgXCJMYXJnZXIgc3VnZ2VzdGlvbnMgd2lsbCBzaG93IHNpZGUgYnkgc2lkZSBpZiB0aGVyZSBpcyBlbm91Z2ggc3BhY2UsIG90aGVyd2lzZSB0aGV5IHdpbGwgYmUgc2hvd24gYmVsb3cuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuaW5saW5lU3VnZ2VzdC5lZGl0cy5yZW5kZXJTaWRlQnlTaWRlLm5ldmVyJywgXCJMYXJnZXIgc3VnZ2VzdGlvbnMgYXJlIG5ldmVyIHNob3duIHNpZGUgYnkgc2lkZSBhbmQgd2lsbCBhbHdheXMgYmUgc2hvd24gYmVsb3cuXCIpLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0dGFnczogWyduZXh0RWRpdFN1Z2dlc3Rpb25zJ11cblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5pbmxpbmVTdWdnZXN0LmVkaXRzLnNob3dDb2xsYXBzZWQnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmVkaXRzLnNob3dDb2xsYXBzZWQsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnaW5saW5lU3VnZ2VzdC5lZGl0cy5zaG93Q29sbGFwc2VkJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBzdWdnZXN0aW9uIHdpbGwgc2hvdyBhcyBjb2xsYXBzZWQgdW50aWwganVtcGluZyB0byBpdC5cIiksXG5cdFx0XHRcdFx0dGFnczogWyduZXh0RWRpdFN1Z2dlc3Rpb25zJ11cblx0XHRcdFx0fSxcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKF9pbnB1dDogYW55KTogSW50ZXJuYWxJbmxpbmVTdWdnZXN0T3B0aW9ucyB7XG5cdFx0aWYgKCFfaW5wdXQgfHwgdHlwZW9mIF9pbnB1dCAhPT0gJ29iamVjdCcpIHtcblx0XHRcdHJldHVybiB0aGlzLmRlZmF1bHRWYWx1ZTtcblx0XHR9XG5cdFx0Y29uc3QgaW5wdXQgPSBfaW5wdXQgYXMgSUlubGluZVN1Z2dlc3RPcHRpb25zO1xuXHRcdHJldHVybiB7XG5cdFx0XHRlbmFibGVkOiBib29sZWFuKGlucHV0LmVuYWJsZWQsIHRoaXMuZGVmYXVsdFZhbHVlLmVuYWJsZWQpLFxuXHRcdFx0bW9kZTogc3RyaW5nU2V0KGlucHV0Lm1vZGUsIHRoaXMuZGVmYXVsdFZhbHVlLm1vZGUsIFsncHJlZml4JywgJ3N1YndvcmQnLCAnc3Vid29yZFNtYXJ0J10pLFxuXHRcdFx0c2hvd1Rvb2xiYXI6IHN0cmluZ1NldChpbnB1dC5zaG93VG9vbGJhciwgdGhpcy5kZWZhdWx0VmFsdWUuc2hvd1Rvb2xiYXIsIFsnYWx3YXlzJywgJ29uSG92ZXInLCAnbmV2ZXInXSksXG5cdFx0XHRzdXBwcmVzc1N1Z2dlc3Rpb25zOiBib29sZWFuKGlucHV0LnN1cHByZXNzU3VnZ2VzdGlvbnMsIHRoaXMuZGVmYXVsdFZhbHVlLnN1cHByZXNzU3VnZ2VzdGlvbnMpLFxuXHRcdFx0a2VlcE9uQmx1cjogYm9vbGVhbihpbnB1dC5rZWVwT25CbHVyLCB0aGlzLmRlZmF1bHRWYWx1ZS5rZWVwT25CbHVyKSxcblx0XHRcdGZvbnRGYW1pbHk6IEVkaXRvclN0cmluZ09wdGlvbi5zdHJpbmcoaW5wdXQuZm9udEZhbWlseSwgdGhpcy5kZWZhdWx0VmFsdWUuZm9udEZhbWlseSksXG5cdFx0XHRzeW50YXhIaWdobGlnaHRpbmdFbmFibGVkOiBib29sZWFuKGlucHV0LnN5bnRheEhpZ2hsaWdodGluZ0VuYWJsZWQsIHRoaXMuZGVmYXVsdFZhbHVlLnN5bnRheEhpZ2hsaWdodGluZ0VuYWJsZWQpLFxuXHRcdFx0ZWRpdHM6IHtcblx0XHRcdFx0ZW5hYmxlZDogYm9vbGVhbihpbnB1dC5lZGl0cz8uZW5hYmxlZCwgdGhpcy5kZWZhdWx0VmFsdWUuZWRpdHMuZW5hYmxlZCksXG5cdFx0XHRcdHNob3dDb2xsYXBzZWQ6IGJvb2xlYW4oaW5wdXQuZWRpdHM/LnNob3dDb2xsYXBzZWQsIHRoaXMuZGVmYXVsdFZhbHVlLmVkaXRzLnNob3dDb2xsYXBzZWQpLFxuXHRcdFx0XHRhbGxvd0NvZGVTaGlmdGluZzogc3RyaW5nU2V0KGlucHV0LmVkaXRzPy5hbGxvd0NvZGVTaGlmdGluZywgdGhpcy5kZWZhdWx0VmFsdWUuZWRpdHMuYWxsb3dDb2RlU2hpZnRpbmcsIFsnYWx3YXlzJywgJ2hvcml6b250YWwnLCAnbmV2ZXInXSksXG5cdFx0XHRcdHJlbmRlclNpZGVCeVNpZGU6IHN0cmluZ1NldChpbnB1dC5lZGl0cz8ucmVuZGVyU2lkZUJ5U2lkZSwgdGhpcy5kZWZhdWx0VmFsdWUuZWRpdHMucmVuZGVyU2lkZUJ5U2lkZSwgWyduZXZlcicsICdhdXRvJ10pLFxuXHRcdFx0XHR1c2VNdWx0aUxpbmVHaG9zdFRleHQ6IGJvb2xlYW4oaW5wdXQuZWRpdHM/LnVzZU11bHRpTGluZUdob3N0VGV4dCwgdGhpcy5kZWZhdWx0VmFsdWUuZWRpdHMudXNlTXVsdGlMaW5lR2hvc3RUZXh0KSxcblx0XHRcdH0sXG5cdFx0fTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIGJyYWNrZXRQYWlyQ29sb3JpemF0aW9uXG5cbmV4cG9ydCBpbnRlcmZhY2UgSUJyYWNrZXRQYWlyQ29sb3JpemF0aW9uT3B0aW9ucyB7XG5cdC8qKlxuXHQgKiBFbmFibGUgb3IgZGlzYWJsZSBicmFja2V0IHBhaXIgY29sb3JpemF0aW9uLlxuXHQqL1xuXHRlbmFibGVkPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogVXNlIGluZGVwZW5kZW50IGNvbG9yIHBvb2wgcGVyIGJyYWNrZXQgdHlwZS5cblx0Ki9cblx0aW5kZXBlbmRlbnRDb2xvclBvb2xQZXJCcmFja2V0VHlwZT86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCB0eXBlIEludGVybmFsQnJhY2tldFBhaXJDb2xvcml6YXRpb25PcHRpb25zID0gUmVhZG9ubHk8UmVxdWlyZWQ8SUJyYWNrZXRQYWlyQ29sb3JpemF0aW9uT3B0aW9ucz4+O1xuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgaW5saW5lIHN1Z2dlc3Rpb25zXG4gKi9cbmNsYXNzIEJyYWNrZXRQYWlyQ29sb3JpemF0aW9uIGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24uYnJhY2tldFBhaXJDb2xvcml6YXRpb24sIElCcmFja2V0UGFpckNvbG9yaXphdGlvbk9wdGlvbnMsIEludGVybmFsQnJhY2tldFBhaXJDb2xvcml6YXRpb25PcHRpb25zPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IGRlZmF1bHRzOiBJbnRlcm5hbEJyYWNrZXRQYWlyQ29sb3JpemF0aW9uT3B0aW9ucyA9IHtcblx0XHRcdGVuYWJsZWQ6IEVESVRPUl9NT0RFTF9ERUZBVUxUUy5icmFja2V0UGFpckNvbG9yaXphdGlvbk9wdGlvbnMuZW5hYmxlZCxcblx0XHRcdGluZGVwZW5kZW50Q29sb3JQb29sUGVyQnJhY2tldFR5cGU6IEVESVRPUl9NT0RFTF9ERUZBVUxUUy5icmFja2V0UGFpckNvbG9yaXphdGlvbk9wdGlvbnMuaW5kZXBlbmRlbnRDb2xvclBvb2xQZXJCcmFja2V0VHlwZSxcblx0XHR9O1xuXG5cdFx0c3VwZXIoXG5cdFx0XHRFZGl0b3JPcHRpb24uYnJhY2tldFBhaXJDb2xvcml6YXRpb24sICdicmFja2V0UGFpckNvbG9yaXphdGlvbicsIGRlZmF1bHRzLFxuXHRcdFx0e1xuXHRcdFx0XHQnZWRpdG9yLmJyYWNrZXRQYWlyQ29sb3JpemF0aW9uLmVuYWJsZWQnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmVuYWJsZWQsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdicmFja2V0UGFpckNvbG9yaXphdGlvbi5lbmFibGVkJywgXCJDb250cm9scyB3aGV0aGVyIGJyYWNrZXQgcGFpciBjb2xvcml6YXRpb24gaXMgZW5hYmxlZCBvciBub3QuIFVzZSB7MH0gdG8gb3ZlcnJpZGUgdGhlIGJyYWNrZXQgaGlnaGxpZ2h0IGNvbG9ycy5cIiwgJ2Ajd29ya2JlbmNoLmNvbG9yQ3VzdG9taXphdGlvbnMjYCcpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuYnJhY2tldFBhaXJDb2xvcml6YXRpb24uaW5kZXBlbmRlbnRDb2xvclBvb2xQZXJCcmFja2V0VHlwZSc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuaW5kZXBlbmRlbnRDb2xvclBvb2xQZXJCcmFja2V0VHlwZSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdicmFja2V0UGFpckNvbG9yaXphdGlvbi5pbmRlcGVuZGVudENvbG9yUG9vbFBlckJyYWNrZXRUeXBlJywgXCJDb250cm9scyB3aGV0aGVyIGVhY2ggYnJhY2tldCB0eXBlIGhhcyBpdHMgb3duIGluZGVwZW5kZW50IGNvbG9yIHBvb2wuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShfaW5wdXQ6IGFueSk6IEludGVybmFsQnJhY2tldFBhaXJDb2xvcml6YXRpb25PcHRpb25zIHtcblx0XHRpZiAoIV9pbnB1dCB8fCB0eXBlb2YgX2lucHV0ICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRjb25zdCBpbnB1dCA9IF9pbnB1dCBhcyBJQnJhY2tldFBhaXJDb2xvcml6YXRpb25PcHRpb25zO1xuXHRcdHJldHVybiB7XG5cdFx0XHRlbmFibGVkOiBib29sZWFuKGlucHV0LmVuYWJsZWQsIHRoaXMuZGVmYXVsdFZhbHVlLmVuYWJsZWQpLFxuXHRcdFx0aW5kZXBlbmRlbnRDb2xvclBvb2xQZXJCcmFja2V0VHlwZTogYm9vbGVhbihpbnB1dC5pbmRlcGVuZGVudENvbG9yUG9vbFBlckJyYWNrZXRUeXBlLCB0aGlzLmRlZmF1bHRWYWx1ZS5pbmRlcGVuZGVudENvbG9yUG9vbFBlckJyYWNrZXRUeXBlKSxcblx0XHR9O1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gZ3VpZGVzXG5cbmV4cG9ydCBpbnRlcmZhY2UgSUd1aWRlc09wdGlvbnMge1xuXHQvKipcblx0ICogRW5hYmxlIHJlbmRlcmluZyBvZiBicmFja2V0IHBhaXIgZ3VpZGVzLlxuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0Ki9cblx0YnJhY2tldFBhaXJzPzogYm9vbGVhbiB8ICdhY3RpdmUnO1xuXG5cdC8qKlxuXHQgKiBFbmFibGUgcmVuZGVyaW5nIG9mIHZlcnRpY2FsIGJyYWNrZXQgcGFpciBndWlkZXMuXG5cdCAqIERlZmF1bHRzIHRvICdhY3RpdmUnLlxuXHQgKi9cblx0YnJhY2tldFBhaXJzSG9yaXpvbnRhbD86IGJvb2xlYW4gfCAnYWN0aXZlJztcblxuXHQvKipcblx0ICogRW5hYmxlIGhpZ2hsaWdodGluZyBvZiB0aGUgYWN0aXZlIGJyYWNrZXQgcGFpci5cblx0ICogRGVmYXVsdHMgdG8gdHJ1ZS5cblx0Ki9cblx0aGlnaGxpZ2h0QWN0aXZlQnJhY2tldFBhaXI/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBFbmFibGUgcmVuZGVyaW5nIG9mIGluZGVudCBndWlkZXMuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRpbmRlbnRhdGlvbj86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIEVuYWJsZSBoaWdobGlnaHRpbmcgb2YgdGhlIGFjdGl2ZSBpbmRlbnQgZ3VpZGUuXG5cdCAqIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRoaWdobGlnaHRBY3RpdmVJbmRlbnRhdGlvbj86IGJvb2xlYW4gfCAnYWx3YXlzJztcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IHR5cGUgSW50ZXJuYWxHdWlkZXNPcHRpb25zID0gUmVhZG9ubHk8UmVxdWlyZWQ8SUd1aWRlc09wdGlvbnM+PjtcblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIGlubGluZSBzdWdnZXN0aW9uc1xuICovXG5jbGFzcyBHdWlkZU9wdGlvbnMgZXh0ZW5kcyBCYXNlRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi5ndWlkZXMsIElHdWlkZXNPcHRpb25zLCBJbnRlcm5hbEd1aWRlc09wdGlvbnM+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0Y29uc3QgZGVmYXVsdHM6IEludGVybmFsR3VpZGVzT3B0aW9ucyA9IHtcblx0XHRcdGJyYWNrZXRQYWlyczogZmFsc2UsXG5cdFx0XHRicmFja2V0UGFpcnNIb3Jpem9udGFsOiAnYWN0aXZlJyxcblx0XHRcdGhpZ2hsaWdodEFjdGl2ZUJyYWNrZXRQYWlyOiB0cnVlLFxuXG5cdFx0XHRpbmRlbnRhdGlvbjogdHJ1ZSxcblx0XHRcdGhpZ2hsaWdodEFjdGl2ZUluZGVudGF0aW9uOiB0cnVlXG5cdFx0fTtcblxuXHRcdHN1cGVyKFxuXHRcdFx0RWRpdG9yT3B0aW9uLmd1aWRlcywgJ2d1aWRlcycsIGRlZmF1bHRzLFxuXHRcdFx0e1xuXHRcdFx0XHQnZWRpdG9yLmd1aWRlcy5icmFja2V0UGFpcnMnOiB7XG5cdFx0XHRcdFx0dHlwZTogWydib29sZWFuJywgJ3N0cmluZyddLFxuXHRcdFx0XHRcdGVudW06IFt0cnVlLCAnYWN0aXZlJywgZmFsc2VdLFxuXHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmd1aWRlcy5icmFja2V0UGFpcnMudHJ1ZScsIFwiRW5hYmxlcyBicmFja2V0IHBhaXIgZ3VpZGVzLlwiKSxcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmd1aWRlcy5icmFja2V0UGFpcnMuYWN0aXZlJywgXCJFbmFibGVzIGJyYWNrZXQgcGFpciBndWlkZXMgb25seSBmb3IgdGhlIGFjdGl2ZSBicmFja2V0IHBhaXIuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuZ3VpZGVzLmJyYWNrZXRQYWlycy5mYWxzZScsIFwiRGlzYWJsZXMgYnJhY2tldCBwYWlyIGd1aWRlcy5cIiksXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5icmFja2V0UGFpcnMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLmd1aWRlcy5icmFja2V0UGFpcnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgYnJhY2tldCBwYWlyIGd1aWRlcyBhcmUgZW5hYmxlZCBvciBub3QuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuZ3VpZGVzLmJyYWNrZXRQYWlyc0hvcml6b250YWwnOiB7XG5cdFx0XHRcdFx0dHlwZTogWydib29sZWFuJywgJ3N0cmluZyddLFxuXHRcdFx0XHRcdGVudW06IFt0cnVlLCAnYWN0aXZlJywgZmFsc2VdLFxuXHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmd1aWRlcy5icmFja2V0UGFpcnNIb3Jpem9udGFsLnRydWUnLCBcIkVuYWJsZXMgaG9yaXpvbnRhbCBndWlkZXMgYXMgYWRkaXRpb24gdG8gdmVydGljYWwgYnJhY2tldCBwYWlyIGd1aWRlcy5cIiksXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5ndWlkZXMuYnJhY2tldFBhaXJzSG9yaXpvbnRhbC5hY3RpdmUnLCBcIkVuYWJsZXMgaG9yaXpvbnRhbCBndWlkZXMgb25seSBmb3IgdGhlIGFjdGl2ZSBicmFja2V0IHBhaXIuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuZ3VpZGVzLmJyYWNrZXRQYWlyc0hvcml6b250YWwuZmFsc2UnLCBcIkRpc2FibGVzIGhvcml6b250YWwgYnJhY2tldCBwYWlyIGd1aWRlcy5cIiksXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5icmFja2V0UGFpcnNIb3Jpem9udGFsLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5ndWlkZXMuYnJhY2tldFBhaXJzSG9yaXpvbnRhbCcsIFwiQ29udHJvbHMgd2hldGhlciBob3Jpem9udGFsIGJyYWNrZXQgcGFpciBndWlkZXMgYXJlIGVuYWJsZWQgb3Igbm90LlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLmd1aWRlcy5oaWdobGlnaHRBY3RpdmVCcmFja2V0UGFpcic6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuaGlnaGxpZ2h0QWN0aXZlQnJhY2tldFBhaXIsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLmd1aWRlcy5oaWdobGlnaHRBY3RpdmVCcmFja2V0UGFpcicsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgZWRpdG9yIHNob3VsZCBoaWdobGlnaHQgdGhlIGFjdGl2ZSBicmFja2V0IHBhaXIuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuZ3VpZGVzLmluZGVudGF0aW9uJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5pbmRlbnRhdGlvbixcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3IuZ3VpZGVzLmluZGVudGF0aW9uJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBlZGl0b3Igc2hvdWxkIHJlbmRlciBpbmRlbnQgZ3VpZGVzLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLmd1aWRlcy5oaWdobGlnaHRBY3RpdmVJbmRlbnRhdGlvbic6IHtcblx0XHRcdFx0XHR0eXBlOiBbJ2Jvb2xlYW4nLCAnc3RyaW5nJ10sXG5cdFx0XHRcdFx0ZW51bTogW3RydWUsICdhbHdheXMnLCBmYWxzZV0sXG5cdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuZ3VpZGVzLmhpZ2hsaWdodEFjdGl2ZUluZGVudGF0aW9uLnRydWUnLCBcIkhpZ2hsaWdodHMgdGhlIGFjdGl2ZSBpbmRlbnQgZ3VpZGUuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuZ3VpZGVzLmhpZ2hsaWdodEFjdGl2ZUluZGVudGF0aW9uLmFsd2F5cycsIFwiSGlnaGxpZ2h0cyB0aGUgYWN0aXZlIGluZGVudCBndWlkZSBldmVuIGlmIGJyYWNrZXQgZ3VpZGVzIGFyZSBoaWdobGlnaHRlZC5cIiksXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5ndWlkZXMuaGlnaGxpZ2h0QWN0aXZlSW5kZW50YXRpb24uZmFsc2UnLCBcIkRvIG5vdCBoaWdobGlnaHQgdGhlIGFjdGl2ZSBpbmRlbnQgZ3VpZGUuXCIpLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuaGlnaGxpZ2h0QWN0aXZlSW5kZW50YXRpb24sXG5cblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3IuZ3VpZGVzLmhpZ2hsaWdodEFjdGl2ZUluZGVudGF0aW9uJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBlZGl0b3Igc2hvdWxkIGhpZ2hsaWdodCB0aGUgYWN0aXZlIGluZGVudCBndWlkZS5cIilcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgdmFsaWRhdGUoX2lucHV0OiBhbnkpOiBJbnRlcm5hbEd1aWRlc09wdGlvbnMge1xuXHRcdGlmICghX2lucHV0IHx8IHR5cGVvZiBfaW5wdXQgIT09ICdvYmplY3QnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0VmFsdWU7XG5cdFx0fVxuXHRcdGNvbnN0IGlucHV0ID0gX2lucHV0IGFzIElHdWlkZXNPcHRpb25zO1xuXHRcdHJldHVybiB7XG5cdFx0XHRicmFja2V0UGFpcnM6IHByaW1pdGl2ZVNldChpbnB1dC5icmFja2V0UGFpcnMsIHRoaXMuZGVmYXVsdFZhbHVlLmJyYWNrZXRQYWlycywgW3RydWUsIGZhbHNlLCAnYWN0aXZlJ10pLFxuXHRcdFx0YnJhY2tldFBhaXJzSG9yaXpvbnRhbDogcHJpbWl0aXZlU2V0KGlucHV0LmJyYWNrZXRQYWlyc0hvcml6b250YWwsIHRoaXMuZGVmYXVsdFZhbHVlLmJyYWNrZXRQYWlyc0hvcml6b250YWwsIFt0cnVlLCBmYWxzZSwgJ2FjdGl2ZSddKSxcblx0XHRcdGhpZ2hsaWdodEFjdGl2ZUJyYWNrZXRQYWlyOiBib29sZWFuKGlucHV0LmhpZ2hsaWdodEFjdGl2ZUJyYWNrZXRQYWlyLCB0aGlzLmRlZmF1bHRWYWx1ZS5oaWdobGlnaHRBY3RpdmVCcmFja2V0UGFpciksXG5cblx0XHRcdGluZGVudGF0aW9uOiBib29sZWFuKGlucHV0LmluZGVudGF0aW9uLCB0aGlzLmRlZmF1bHRWYWx1ZS5pbmRlbnRhdGlvbiksXG5cdFx0XHRoaWdobGlnaHRBY3RpdmVJbmRlbnRhdGlvbjogcHJpbWl0aXZlU2V0KGlucHV0LmhpZ2hsaWdodEFjdGl2ZUluZGVudGF0aW9uLCB0aGlzLmRlZmF1bHRWYWx1ZS5oaWdobGlnaHRBY3RpdmVJbmRlbnRhdGlvbiwgW3RydWUsIGZhbHNlLCAnYWx3YXlzJ10pLFxuXHRcdH07XG5cdH1cbn1cblxuZnVuY3Rpb24gcHJpbWl0aXZlU2V0PFQgZXh0ZW5kcyBzdHJpbmcgfCBib29sZWFuPih2YWx1ZTogdW5rbm93biwgZGVmYXVsdFZhbHVlOiBULCBhbGxvd2VkVmFsdWVzOiBUW10pOiBUIHtcblx0Y29uc3QgaWR4ID0gYWxsb3dlZFZhbHVlcy5pbmRleE9mKHZhbHVlIGFzIGFueSk7XG5cdGlmIChpZHggPT09IC0xKSB7XG5cdFx0cmV0dXJuIGRlZmF1bHRWYWx1ZTtcblx0fVxuXHRyZXR1cm4gYWxsb3dlZFZhbHVlc1tpZHhdO1xufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIHN1Z2dlc3RcblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIGVkaXRvciBzdWdnZXN0IHdpZGdldFxuICovXG5leHBvcnQgaW50ZXJmYWNlIElTdWdnZXN0T3B0aW9ucyB7XG5cdC8qKlxuXHQgKiBPdmVyd3JpdGUgd29yZCBlbmRzIG9uIGFjY2VwdC4gRGVmYXVsdCB0byBmYWxzZS5cblx0ICovXG5cdGluc2VydE1vZGU/OiAnaW5zZXJ0JyB8ICdyZXBsYWNlJztcblx0LyoqXG5cdCAqIEVuYWJsZSBncmFjZWZ1bCBtYXRjaGluZy4gRGVmYXVsdHMgdG8gdHJ1ZS5cblx0ICovXG5cdGZpbHRlckdyYWNlZnVsPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFByZXZlbnQgcXVpY2sgc3VnZ2VzdGlvbnMgd2hlbiBhIHNuaXBwZXQgaXMgYWN0aXZlLiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0c25pcHBldHNQcmV2ZW50UXVpY2tTdWdnZXN0aW9ucz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBGYXZvcnMgd29yZHMgdGhhdCBhcHBlYXIgY2xvc2UgdG8gdGhlIGN1cnNvci5cblx0ICovXG5cdGxvY2FsaXR5Qm9udXM/OiBib29sZWFuO1xuXHQvKipcblx0ICogRW5hYmxlIHVzaW5nIGdsb2JhbCBzdG9yYWdlIGZvciByZW1lbWJlcmluZyBzdWdnZXN0aW9ucy5cblx0ICovXG5cdHNoYXJlU3VnZ2VzdFNlbGVjdGlvbnM/OiBib29sZWFuO1xuXHQvKipcblx0ICogU2VsZWN0IHN1Z2dlc3Rpb25zIHdoZW4gdHJpZ2dlcmVkIHZpYSBxdWljayBzdWdnZXN0IG9yIHRyaWdnZXIgY2hhcmFjdGVyc1xuXHQgKi9cblx0c2VsZWN0aW9uTW9kZT86ICdhbHdheXMnIHwgJ25ldmVyJyB8ICd3aGVuVHJpZ2dlckNoYXJhY3RlcicgfCAnd2hlblF1aWNrU3VnZ2VzdGlvbic7XG5cdC8qKlxuXHQgKiBFbmFibGUgb3IgZGlzYWJsZSBpY29ucyBpbiBzdWdnZXN0aW9ucy4gRGVmYXVsdHMgdG8gdHJ1ZS5cblx0ICovXG5cdHNob3dJY29ucz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBFbmFibGUgb3IgZGlzYWJsZSB0aGUgc3VnZ2VzdCBzdGF0dXMgYmFyLlxuXHQgKi9cblx0c2hvd1N0YXR1c0Jhcj86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBFbmFibGUgb3IgZGlzYWJsZSB0aGUgcmVuZGVyaW5nIG9mIHRoZSBzdWdnZXN0aW9uIHByZXZpZXcuXG5cdCAqL1xuXHRwcmV2aWV3PzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIENvbmZpZ3VyZXMgdGhlIG1vZGUgb2YgdGhlIHByZXZpZXcuXG5cdCovXG5cdHByZXZpZXdNb2RlPzogJ3ByZWZpeCcgfCAnc3Vid29yZCcgfCAnc3Vid29yZFNtYXJ0Jztcblx0LyoqXG5cdCAqIFNob3cgZGV0YWlscyBpbmxpbmUgd2l0aCB0aGUgbGFiZWwuIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRzaG93SW5saW5lRGV0YWlscz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBTaG93IG1ldGhvZC1zdWdnZXN0aW9ucy5cblx0ICovXG5cdHNob3dNZXRob2RzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFNob3cgZnVuY3Rpb24tc3VnZ2VzdGlvbnMuXG5cdCAqL1xuXHRzaG93RnVuY3Rpb25zPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFNob3cgY29uc3RydWN0b3Itc3VnZ2VzdGlvbnMuXG5cdCAqL1xuXHRzaG93Q29uc3RydWN0b3JzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFNob3cgZGVwcmVjYXRlZC1zdWdnZXN0aW9ucy5cblx0ICovXG5cdHNob3dEZXByZWNhdGVkPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgc3VnZ2VzdGlvbnMgYWxsb3cgbWF0Y2hlcyBpbiB0aGUgbWlkZGxlIG9mIHRoZSB3b3JkIGluc3RlYWQgb2Ygb25seSBhdCB0aGUgYmVnaW5uaW5nXG5cdCAqL1xuXHRtYXRjaE9uV29yZFN0YXJ0T25seT86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBTaG93IGZpZWxkLXN1Z2dlc3Rpb25zLlxuXHQgKi9cblx0c2hvd0ZpZWxkcz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBTaG93IHZhcmlhYmxlLXN1Z2dlc3Rpb25zLlxuXHQgKi9cblx0c2hvd1ZhcmlhYmxlcz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBTaG93IGNsYXNzLXN1Z2dlc3Rpb25zLlxuXHQgKi9cblx0c2hvd0NsYXNzZXM/OiBib29sZWFuO1xuXHQvKipcblx0ICogU2hvdyBzdHJ1Y3Qtc3VnZ2VzdGlvbnMuXG5cdCAqL1xuXHRzaG93U3RydWN0cz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBTaG93IGludGVyZmFjZS1zdWdnZXN0aW9ucy5cblx0ICovXG5cdHNob3dJbnRlcmZhY2VzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFNob3cgbW9kdWxlLXN1Z2dlc3Rpb25zLlxuXHQgKi9cblx0c2hvd01vZHVsZXM/OiBib29sZWFuO1xuXHQvKipcblx0ICogU2hvdyBwcm9wZXJ0eS1zdWdnZXN0aW9ucy5cblx0ICovXG5cdHNob3dQcm9wZXJ0aWVzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFNob3cgZXZlbnQtc3VnZ2VzdGlvbnMuXG5cdCAqL1xuXHRzaG93RXZlbnRzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFNob3cgb3BlcmF0b3Itc3VnZ2VzdGlvbnMuXG5cdCAqL1xuXHRzaG93T3BlcmF0b3JzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFNob3cgdW5pdC1zdWdnZXN0aW9ucy5cblx0ICovXG5cdHNob3dVbml0cz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBTaG93IHZhbHVlLXN1Z2dlc3Rpb25zLlxuXHQgKi9cblx0c2hvd1ZhbHVlcz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBTaG93IGNvbnN0YW50LXN1Z2dlc3Rpb25zLlxuXHQgKi9cblx0c2hvd0NvbnN0YW50cz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBTaG93IGVudW0tc3VnZ2VzdGlvbnMuXG5cdCAqL1xuXHRzaG93RW51bXM/OiBib29sZWFuO1xuXHQvKipcblx0ICogU2hvdyBlbnVtTWVtYmVyLXN1Z2dlc3Rpb25zLlxuXHQgKi9cblx0c2hvd0VudW1NZW1iZXJzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFNob3cga2V5d29yZC1zdWdnZXN0aW9ucy5cblx0ICovXG5cdHNob3dLZXl3b3Jkcz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBTaG93IHRleHQtc3VnZ2VzdGlvbnMuXG5cdCAqL1xuXHRzaG93V29yZHM/OiBib29sZWFuO1xuXHQvKipcblx0ICogU2hvdyBjb2xvci1zdWdnZXN0aW9ucy5cblx0ICovXG5cdHNob3dDb2xvcnM/OiBib29sZWFuO1xuXHQvKipcblx0ICogU2hvdyBmaWxlLXN1Z2dlc3Rpb25zLlxuXHQgKi9cblx0c2hvd0ZpbGVzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFNob3cgcmVmZXJlbmNlLXN1Z2dlc3Rpb25zLlxuXHQgKi9cblx0c2hvd1JlZmVyZW5jZXM/OiBib29sZWFuO1xuXHQvKipcblx0ICogU2hvdyBmb2xkZXItc3VnZ2VzdGlvbnMuXG5cdCAqL1xuXHRzaG93Rm9sZGVycz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBTaG93IHR5cGVQYXJhbWV0ZXItc3VnZ2VzdGlvbnMuXG5cdCAqL1xuXHRzaG93VHlwZVBhcmFtZXRlcnM/OiBib29sZWFuO1xuXHQvKipcblx0ICogU2hvdyBpc3N1ZS1zdWdnZXN0aW9ucy5cblx0ICovXG5cdHNob3dJc3N1ZXM/OiBib29sZWFuO1xuXHQvKipcblx0ICogU2hvdyB1c2VyLXN1Z2dlc3Rpb25zLlxuXHQgKi9cblx0c2hvd1VzZXJzPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFNob3cgc25pcHBldC1zdWdnZXN0aW9ucy5cblx0ICovXG5cdHNob3dTbmlwcGV0cz86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCB0eXBlIEludGVybmFsU3VnZ2VzdE9wdGlvbnMgPSBSZWFkb25seTxSZXF1aXJlZDxJU3VnZ2VzdE9wdGlvbnM+PjtcblxuY2xhc3MgRWRpdG9yU3VnZ2VzdCBleHRlbmRzIEJhc2VFZGl0b3JPcHRpb248RWRpdG9yT3B0aW9uLnN1Z2dlc3QsIElTdWdnZXN0T3B0aW9ucywgSW50ZXJuYWxTdWdnZXN0T3B0aW9ucz4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IGRlZmF1bHRzOiBJbnRlcm5hbFN1Z2dlc3RPcHRpb25zID0ge1xuXHRcdFx0aW5zZXJ0TW9kZTogJ2luc2VydCcsXG5cdFx0XHRmaWx0ZXJHcmFjZWZ1bDogdHJ1ZSxcblx0XHRcdHNuaXBwZXRzUHJldmVudFF1aWNrU3VnZ2VzdGlvbnM6IGZhbHNlLFxuXHRcdFx0bG9jYWxpdHlCb251czogZmFsc2UsXG5cdFx0XHRzaGFyZVN1Z2dlc3RTZWxlY3Rpb25zOiBmYWxzZSxcblx0XHRcdHNlbGVjdGlvbk1vZGU6ICdhbHdheXMnLFxuXHRcdFx0c2hvd0ljb25zOiB0cnVlLFxuXHRcdFx0c2hvd1N0YXR1c0JhcjogZmFsc2UsXG5cdFx0XHRwcmV2aWV3OiBmYWxzZSxcblx0XHRcdHByZXZpZXdNb2RlOiAnc3Vid29yZFNtYXJ0Jyxcblx0XHRcdHNob3dJbmxpbmVEZXRhaWxzOiB0cnVlLFxuXHRcdFx0c2hvd01ldGhvZHM6IHRydWUsXG5cdFx0XHRzaG93RnVuY3Rpb25zOiB0cnVlLFxuXHRcdFx0c2hvd0NvbnN0cnVjdG9yczogdHJ1ZSxcblx0XHRcdHNob3dEZXByZWNhdGVkOiB0cnVlLFxuXHRcdFx0bWF0Y2hPbldvcmRTdGFydE9ubHk6IHRydWUsXG5cdFx0XHRzaG93RmllbGRzOiB0cnVlLFxuXHRcdFx0c2hvd1ZhcmlhYmxlczogdHJ1ZSxcblx0XHRcdHNob3dDbGFzc2VzOiB0cnVlLFxuXHRcdFx0c2hvd1N0cnVjdHM6IHRydWUsXG5cdFx0XHRzaG93SW50ZXJmYWNlczogdHJ1ZSxcblx0XHRcdHNob3dNb2R1bGVzOiB0cnVlLFxuXHRcdFx0c2hvd1Byb3BlcnRpZXM6IHRydWUsXG5cdFx0XHRzaG93RXZlbnRzOiB0cnVlLFxuXHRcdFx0c2hvd09wZXJhdG9yczogdHJ1ZSxcblx0XHRcdHNob3dVbml0czogdHJ1ZSxcblx0XHRcdHNob3dWYWx1ZXM6IHRydWUsXG5cdFx0XHRzaG93Q29uc3RhbnRzOiB0cnVlLFxuXHRcdFx0c2hvd0VudW1zOiB0cnVlLFxuXHRcdFx0c2hvd0VudW1NZW1iZXJzOiB0cnVlLFxuXHRcdFx0c2hvd0tleXdvcmRzOiB0cnVlLFxuXHRcdFx0c2hvd1dvcmRzOiB0cnVlLFxuXHRcdFx0c2hvd0NvbG9yczogdHJ1ZSxcblx0XHRcdHNob3dGaWxlczogdHJ1ZSxcblx0XHRcdHNob3dSZWZlcmVuY2VzOiB0cnVlLFxuXHRcdFx0c2hvd0ZvbGRlcnM6IHRydWUsXG5cdFx0XHRzaG93VHlwZVBhcmFtZXRlcnM6IHRydWUsXG5cdFx0XHRzaG93U25pcHBldHM6IHRydWUsXG5cdFx0XHRzaG93VXNlcnM6IHRydWUsXG5cdFx0XHRzaG93SXNzdWVzOiB0cnVlLFxuXHRcdH07XG5cdFx0c3VwZXIoXG5cdFx0XHRFZGl0b3JPcHRpb24uc3VnZ2VzdCwgJ3N1Z2dlc3QnLCBkZWZhdWx0cyxcblx0XHRcdHtcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0Lmluc2VydE1vZGUnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZW51bTogWydpbnNlcnQnLCAncmVwbGFjZSddLFxuXHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnc3VnZ2VzdC5pbnNlcnRNb2RlLmluc2VydCcsIFwiSW5zZXJ0IHN1Z2dlc3Rpb24gd2l0aG91dCBvdmVyd3JpdGluZyB0ZXh0IHJpZ2h0IG9mIHRoZSBjdXJzb3IuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdzdWdnZXN0Lmluc2VydE1vZGUucmVwbGFjZScsIFwiSW5zZXJ0IHN1Z2dlc3Rpb24gYW5kIG92ZXJ3cml0ZSB0ZXh0IHJpZ2h0IG9mIHRoZSBjdXJzb3IuXCIpLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuaW5zZXJ0TW9kZSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzdWdnZXN0Lmluc2VydE1vZGUnLCBcIkNvbnRyb2xzIHdoZXRoZXIgd29yZHMgYXJlIG92ZXJ3cml0dGVuIHdoZW4gYWNjZXB0aW5nIGNvbXBsZXRpb25zLiBOb3RlIHRoYXQgdGhpcyBkZXBlbmRzIG9uIGV4dGVuc2lvbnMgb3B0aW5nIGludG8gdGhpcyBmZWF0dXJlLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3QuZmlsdGVyR3JhY2VmdWwnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmZpbHRlckdyYWNlZnVsLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3N1Z2dlc3QuZmlsdGVyR3JhY2VmdWwnLCBcIkNvbnRyb2xzIHdoZXRoZXIgZmlsdGVyaW5nIGFuZCBzb3J0aW5nIHN1Z2dlc3Rpb25zIGFjY291bnRzIGZvciBzbWFsbCB0eXBvcy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0LmxvY2FsaXR5Qm9udXMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLmxvY2FsaXR5Qm9udXMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc3VnZ2VzdC5sb2NhbGl0eUJvbnVzJywgXCJDb250cm9scyB3aGV0aGVyIHNvcnRpbmcgZmF2b3JzIHdvcmRzIHRoYXQgYXBwZWFyIGNsb3NlIHRvIHRoZSBjdXJzb3IuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5zaGFyZVN1Z2dlc3RTZWxlY3Rpb25zJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5zaGFyZVN1Z2dlc3RTZWxlY3Rpb25zLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc3VnZ2VzdC5zaGFyZVN1Z2dlc3RTZWxlY3Rpb25zJywgXCJDb250cm9scyB3aGV0aGVyIHJlbWVtYmVyZWQgc3VnZ2VzdGlvbiBzZWxlY3Rpb25zIGFyZSBzaGFyZWQgYmV0d2VlbiBtdWx0aXBsZSB3b3Jrc3BhY2VzIGFuZCB3aW5kb3dzIChuZWVkcyBgI2VkaXRvci5zdWdnZXN0U2VsZWN0aW9uI2ApLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2VsZWN0aW9uTW9kZSc6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRlbnVtOiBbJ2Fsd2F5cycsICduZXZlcicsICd3aGVuVHJpZ2dlckNoYXJhY3RlcicsICd3aGVuUXVpY2tTdWdnZXN0aW9uJ10sXG5cdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdzdWdnZXN0Lmluc2VydE1vZGUuYWx3YXlzJywgXCJBbHdheXMgc2VsZWN0IGEgc3VnZ2VzdGlvbiB3aGVuIGF1dG9tYXRpY2FsbHkgdHJpZ2dlcmluZyBJbnRlbGxpU2Vuc2UuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdzdWdnZXN0Lmluc2VydE1vZGUubmV2ZXInLCBcIk5ldmVyIHNlbGVjdCBhIHN1Z2dlc3Rpb24gd2hlbiBhdXRvbWF0aWNhbGx5IHRyaWdnZXJpbmcgSW50ZWxsaVNlbnNlLlwiKSxcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnc3VnZ2VzdC5pbnNlcnRNb2RlLndoZW5UcmlnZ2VyQ2hhcmFjdGVyJywgXCJTZWxlY3QgYSBzdWdnZXN0aW9uIG9ubHkgd2hlbiB0cmlnZ2VyaW5nIEludGVsbGlTZW5zZSBmcm9tIGEgdHJpZ2dlciBjaGFyYWN0ZXIuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdzdWdnZXN0Lmluc2VydE1vZGUud2hlblF1aWNrU3VnZ2VzdGlvbicsIFwiU2VsZWN0IGEgc3VnZ2VzdGlvbiBvbmx5IHdoZW4gdHJpZ2dlcmluZyBJbnRlbGxpU2Vuc2UgYXMgeW91IHR5cGUuXCIpLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuc2VsZWN0aW9uTW9kZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3N1Z2dlc3Quc2VsZWN0aW9uTW9kZScsIFwiQ29udHJvbHMgd2hldGhlciBhIHN1Z2dlc3Rpb24gaXMgc2VsZWN0ZWQgd2hlbiB0aGUgd2lkZ2V0IHNob3dzLiBOb3RlIHRoYXQgdGhpcyBvbmx5IGFwcGxpZXMgdG8gYXV0b21hdGljYWxseSB0cmlnZ2VyZWQgc3VnZ2VzdGlvbnMgKHswfSBhbmQgezF9KSBhbmQgdGhhdCBhIHN1Z2dlc3Rpb24gaXMgYWx3YXlzIHNlbGVjdGVkIHdoZW4gZXhwbGljaXRseSBpbnZva2VkLCBlLmcgdmlhIGBDdHJsK1NwYWNlYC5cIiwgJ2AjZWRpdG9yLnF1aWNrU3VnZ2VzdGlvbnMjYCcsICdgI2VkaXRvci5zdWdnZXN0T25UcmlnZ2VyQ2hhcmFjdGVycyNgJylcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0LnNuaXBwZXRzUHJldmVudFF1aWNrU3VnZ2VzdGlvbnMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGRlZmF1bHRzLnNuaXBwZXRzUHJldmVudFF1aWNrU3VnZ2VzdGlvbnMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc3VnZ2VzdC5zbmlwcGV0c1ByZXZlbnRRdWlja1N1Z2dlc3Rpb25zJywgXCJDb250cm9scyB3aGV0aGVyIGFuIGFjdGl2ZSBzbmlwcGV0IHByZXZlbnRzIHF1aWNrIHN1Z2dlc3Rpb25zLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2hvd0ljb25zJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5zaG93SWNvbnMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc3VnZ2VzdC5zaG93SWNvbnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdG8gc2hvdyBvciBoaWRlIGljb25zIGluIHN1Z2dlc3Rpb25zLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2hvd1N0YXR1c0Jhcic6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuc2hvd1N0YXR1c0Jhcixcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzdWdnZXN0LnNob3dTdGF0dXNCYXInLCBcIkNvbnRyb2xzIHRoZSB2aXNpYmlsaXR5IG9mIHRoZSBzdGF0dXMgYmFyIGF0IHRoZSBib3R0b20gb2YgdGhlIHN1Z2dlc3Qgd2lkZ2V0LlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3QucHJldmlldyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMucHJldmlldyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzdWdnZXN0LnByZXZpZXcnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdG8gcHJldmlldyB0aGUgc3VnZ2VzdGlvbiBvdXRjb21lIGluIHRoZSBlZGl0b3IuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5zaG93SW5saW5lRGV0YWlscyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdHMuc2hvd0lubGluZURldGFpbHMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc3VnZ2VzdC5zaG93SW5saW5lRGV0YWlscycsIFwiQ29udHJvbHMgd2hldGhlciBzdWdnZXN0IGRldGFpbHMgc2hvdyBpbmxpbmUgd2l0aCB0aGUgbGFiZWwgb3Igb25seSBpbiB0aGUgZGV0YWlscyB3aWRnZXQuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5tYXhWaXNpYmxlU3VnZ2VzdGlvbnMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBubHMubG9jYWxpemUoJ3N1Z2dlc3QubWF4VmlzaWJsZVN1Z2dlc3Rpb25zLmRlcCcsIFwiVGhpcyBzZXR0aW5nIGlzIGRlcHJlY2F0ZWQuIFRoZSBzdWdnZXN0IHdpZGdldCBjYW4gbm93IGJlIHJlc2l6ZWQuXCIpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3QuZmlsdGVyZWRUeXBlcyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRkZXByZWNhdGlvbk1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnZGVwcmVjYXRlZCcsIFwiVGhpcyBzZXR0aW5nIGlzIGRlcHJlY2F0ZWQsIHBsZWFzZSB1c2Ugc2VwYXJhdGUgc2V0dGluZ3MgbGlrZSAnZWRpdG9yLnN1Z2dlc3Quc2hvd0tleXdvcmRzJyBvciAnZWRpdG9yLnN1Z2dlc3Quc2hvd1NuaXBwZXRzJyBpbnN0ZWFkLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2hvd01ldGhvZHMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3VnZ2VzdC5zaG93TWV0aG9kcycsIFwiV2hlbiBlbmFibGVkIEludGVsbGlTZW5zZSBzaG93cyBgbWV0aG9kYC1zdWdnZXN0aW9ucy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0LnNob3dGdW5jdGlvbnMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3VnZ2VzdC5zaG93RnVuY3Rpb25zJywgXCJXaGVuIGVuYWJsZWQgSW50ZWxsaVNlbnNlIHNob3dzIGBmdW5jdGlvbmAtc3VnZ2VzdGlvbnMuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5zaG93Q29uc3RydWN0b3JzJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLnN1Z2dlc3Quc2hvd0NvbnN0cnVjdG9ycycsIFwiV2hlbiBlbmFibGVkIEludGVsbGlTZW5zZSBzaG93cyBgY29uc3RydWN0b3JgLXN1Z2dlc3Rpb25zLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2hvd0RlcHJlY2F0ZWQnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3VnZ2VzdC5zaG93RGVwcmVjYXRlZCcsIFwiV2hlbiBlbmFibGVkIEludGVsbGlTZW5zZSBzaG93cyBgZGVwcmVjYXRlZGAtc3VnZ2VzdGlvbnMuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5tYXRjaE9uV29yZFN0YXJ0T25seSc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5zdWdnZXN0Lm1hdGNoT25Xb3JkU3RhcnRPbmx5JywgXCJXaGVuIGVuYWJsZWQgSW50ZWxsaVNlbnNlIGZpbHRlcmluZyByZXF1aXJlcyB0aGF0IHRoZSBmaXJzdCBjaGFyYWN0ZXIgbWF0Y2hlcyBvbiBhIHdvcmQgc3RhcnQuIEZvciBleGFtcGxlLCBgY2Agb24gYENvbnNvbGVgIG9yIGBXZWJDb250ZXh0YCBidXQgX25vdF8gb24gYGRlc2NyaXB0aW9uYC4gV2hlbiBkaXNhYmxlZCBJbnRlbGxpU2Vuc2Ugd2lsbCBzaG93IG1vcmUgcmVzdWx0cyBidXQgc3RpbGwgc29ydHMgdGhlbSBieSBtYXRjaCBxdWFsaXR5LlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2hvd0ZpZWxkcyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5zdWdnZXN0LnNob3dGaWVsZHMnLCBcIldoZW4gZW5hYmxlZCBJbnRlbGxpU2Vuc2Ugc2hvd3MgYGZpZWxkYC1zdWdnZXN0aW9ucy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0LnNob3dWYXJpYWJsZXMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3VnZ2VzdC5zaG93VmFyaWFibGVzJywgXCJXaGVuIGVuYWJsZWQgSW50ZWxsaVNlbnNlIHNob3dzIGB2YXJpYWJsZWAtc3VnZ2VzdGlvbnMuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5zaG93Q2xhc3Nlcyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5zdWdnZXN0LnNob3dDbGFzc3MnLCBcIldoZW4gZW5hYmxlZCBJbnRlbGxpU2Vuc2Ugc2hvd3MgYGNsYXNzYC1zdWdnZXN0aW9ucy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0LnNob3dTdHJ1Y3RzJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLnN1Z2dlc3Quc2hvd1N0cnVjdHMnLCBcIldoZW4gZW5hYmxlZCBJbnRlbGxpU2Vuc2Ugc2hvd3MgYHN0cnVjdGAtc3VnZ2VzdGlvbnMuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5zaG93SW50ZXJmYWNlcyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5zdWdnZXN0LnNob3dJbnRlcmZhY2VzJywgXCJXaGVuIGVuYWJsZWQgSW50ZWxsaVNlbnNlIHNob3dzIGBpbnRlcmZhY2VgLXN1Z2dlc3Rpb25zLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2hvd01vZHVsZXMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3VnZ2VzdC5zaG93TW9kdWxlcycsIFwiV2hlbiBlbmFibGVkIEludGVsbGlTZW5zZSBzaG93cyBgbW9kdWxlYC1zdWdnZXN0aW9ucy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0LnNob3dQcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLnN1Z2dlc3Quc2hvd1Byb3BlcnR5cycsIFwiV2hlbiBlbmFibGVkIEludGVsbGlTZW5zZSBzaG93cyBgcHJvcGVydHlgLXN1Z2dlc3Rpb25zLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2hvd0V2ZW50cyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5zdWdnZXN0LnNob3dFdmVudHMnLCBcIldoZW4gZW5hYmxlZCBJbnRlbGxpU2Vuc2Ugc2hvd3MgYGV2ZW50YC1zdWdnZXN0aW9ucy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0LnNob3dPcGVyYXRvcnMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3VnZ2VzdC5zaG93T3BlcmF0b3JzJywgXCJXaGVuIGVuYWJsZWQgSW50ZWxsaVNlbnNlIHNob3dzIGBvcGVyYXRvcmAtc3VnZ2VzdGlvbnMuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5zaG93VW5pdHMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3VnZ2VzdC5zaG93VW5pdHMnLCBcIldoZW4gZW5hYmxlZCBJbnRlbGxpU2Vuc2Ugc2hvd3MgYHVuaXRgLXN1Z2dlc3Rpb25zLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2hvd1ZhbHVlcyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5zdWdnZXN0LnNob3dWYWx1ZXMnLCBcIldoZW4gZW5hYmxlZCBJbnRlbGxpU2Vuc2Ugc2hvd3MgYHZhbHVlYC1zdWdnZXN0aW9ucy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0LnNob3dDb25zdGFudHMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3VnZ2VzdC5zaG93Q29uc3RhbnRzJywgXCJXaGVuIGVuYWJsZWQgSW50ZWxsaVNlbnNlIHNob3dzIGBjb25zdGFudGAtc3VnZ2VzdGlvbnMuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5zaG93RW51bXMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3VnZ2VzdC5zaG93RW51bXMnLCBcIldoZW4gZW5hYmxlZCBJbnRlbGxpU2Vuc2Ugc2hvd3MgYGVudW1gLXN1Z2dlc3Rpb25zLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2hvd0VudW1NZW1iZXJzJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLnN1Z2dlc3Quc2hvd0VudW1NZW1iZXJzJywgXCJXaGVuIGVuYWJsZWQgSW50ZWxsaVNlbnNlIHNob3dzIGBlbnVtTWVtYmVyYC1zdWdnZXN0aW9ucy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0LnNob3dLZXl3b3Jkcyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5zdWdnZXN0LnNob3dLZXl3b3JkcycsIFwiV2hlbiBlbmFibGVkIEludGVsbGlTZW5zZSBzaG93cyBga2V5d29yZGAtc3VnZ2VzdGlvbnMuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5zaG93V29yZHMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3VnZ2VzdC5zaG93VGV4dHMnLCBcIldoZW4gZW5hYmxlZCBJbnRlbGxpU2Vuc2Ugc2hvd3MgYHRleHRgLXN1Z2dlc3Rpb25zLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2hvd0NvbG9ycyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5zdWdnZXN0LnNob3dDb2xvcnMnLCBcIldoZW4gZW5hYmxlZCBJbnRlbGxpU2Vuc2Ugc2hvd3MgYGNvbG9yYC1zdWdnZXN0aW9ucy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0LnNob3dGaWxlcyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5zdWdnZXN0LnNob3dGaWxlcycsIFwiV2hlbiBlbmFibGVkIEludGVsbGlTZW5zZSBzaG93cyBgZmlsZWAtc3VnZ2VzdGlvbnMuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5zaG93UmVmZXJlbmNlcyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5zdWdnZXN0LnNob3dSZWZlcmVuY2VzJywgXCJXaGVuIGVuYWJsZWQgSW50ZWxsaVNlbnNlIHNob3dzIGByZWZlcmVuY2VgLXN1Z2dlc3Rpb25zLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2hvd0N1c3RvbWNvbG9ycyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5zdWdnZXN0LnNob3dDdXN0b21jb2xvcnMnLCBcIldoZW4gZW5hYmxlZCBJbnRlbGxpU2Vuc2Ugc2hvd3MgYGN1c3RvbWNvbG9yYC1zdWdnZXN0aW9ucy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0LnNob3dGb2xkZXJzJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLnN1Z2dlc3Quc2hvd0ZvbGRlcnMnLCBcIldoZW4gZW5hYmxlZCBJbnRlbGxpU2Vuc2Ugc2hvd3MgYGZvbGRlcmAtc3VnZ2VzdGlvbnMuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5zaG93VHlwZVBhcmFtZXRlcnMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3Iuc3VnZ2VzdC5zaG93VHlwZVBhcmFtZXRlcnMnLCBcIldoZW4gZW5hYmxlZCBJbnRlbGxpU2Vuc2Ugc2hvd3MgYHR5cGVQYXJhbWV0ZXJgLXN1Z2dlc3Rpb25zLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnN1Z2dlc3Quc2hvd1NuaXBwZXRzJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLnN1Z2dlc3Quc2hvd1NuaXBwZXRzJywgXCJXaGVuIGVuYWJsZWQgSW50ZWxsaVNlbnNlIHNob3dzIGBzbmlwcGV0YC1zdWdnZXN0aW9ucy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VkaXRvci5zdWdnZXN0LnNob3dVc2Vycyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5zdWdnZXN0LnNob3dVc2VycycsIFwiV2hlbiBlbmFibGVkIEludGVsbGlTZW5zZSBzaG93cyBgdXNlcmAtc3VnZ2VzdGlvbnMuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3Iuc3VnZ2VzdC5zaG93SXNzdWVzJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yLnN1Z2dlc3Quc2hvd0lzc3VlcycsIFwiV2hlbiBlbmFibGVkIEludGVsbGlTZW5zZSBzaG93cyBgaXNzdWVzYC1zdWdnZXN0aW9ucy5cIilcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgdmFsaWRhdGUoX2lucHV0OiBhbnkpOiBJbnRlcm5hbFN1Z2dlc3RPcHRpb25zIHtcblx0XHRpZiAoIV9pbnB1dCB8fCB0eXBlb2YgX2lucHV0ICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRjb25zdCBpbnB1dCA9IF9pbnB1dCBhcyBJU3VnZ2VzdE9wdGlvbnM7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGluc2VydE1vZGU6IHN0cmluZ1NldChpbnB1dC5pbnNlcnRNb2RlLCB0aGlzLmRlZmF1bHRWYWx1ZS5pbnNlcnRNb2RlLCBbJ2luc2VydCcsICdyZXBsYWNlJ10pLFxuXHRcdFx0ZmlsdGVyR3JhY2VmdWw6IGJvb2xlYW4oaW5wdXQuZmlsdGVyR3JhY2VmdWwsIHRoaXMuZGVmYXVsdFZhbHVlLmZpbHRlckdyYWNlZnVsKSxcblx0XHRcdHNuaXBwZXRzUHJldmVudFF1aWNrU3VnZ2VzdGlvbnM6IGJvb2xlYW4oaW5wdXQuc25pcHBldHNQcmV2ZW50UXVpY2tTdWdnZXN0aW9ucywgdGhpcy5kZWZhdWx0VmFsdWUuZmlsdGVyR3JhY2VmdWwpLFxuXHRcdFx0bG9jYWxpdHlCb251czogYm9vbGVhbihpbnB1dC5sb2NhbGl0eUJvbnVzLCB0aGlzLmRlZmF1bHRWYWx1ZS5sb2NhbGl0eUJvbnVzKSxcblx0XHRcdHNoYXJlU3VnZ2VzdFNlbGVjdGlvbnM6IGJvb2xlYW4oaW5wdXQuc2hhcmVTdWdnZXN0U2VsZWN0aW9ucywgdGhpcy5kZWZhdWx0VmFsdWUuc2hhcmVTdWdnZXN0U2VsZWN0aW9ucyksXG5cdFx0XHRzZWxlY3Rpb25Nb2RlOiBzdHJpbmdTZXQoaW5wdXQuc2VsZWN0aW9uTW9kZSwgdGhpcy5kZWZhdWx0VmFsdWUuc2VsZWN0aW9uTW9kZSwgWydhbHdheXMnLCAnbmV2ZXInLCAnd2hlblF1aWNrU3VnZ2VzdGlvbicsICd3aGVuVHJpZ2dlckNoYXJhY3RlciddKSxcblx0XHRcdHNob3dJY29uczogYm9vbGVhbihpbnB1dC5zaG93SWNvbnMsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dJY29ucyksXG5cdFx0XHRzaG93U3RhdHVzQmFyOiBib29sZWFuKGlucHV0LnNob3dTdGF0dXNCYXIsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dTdGF0dXNCYXIpLFxuXHRcdFx0cHJldmlldzogYm9vbGVhbihpbnB1dC5wcmV2aWV3LCB0aGlzLmRlZmF1bHRWYWx1ZS5wcmV2aWV3KSxcblx0XHRcdHByZXZpZXdNb2RlOiBzdHJpbmdTZXQoaW5wdXQucHJldmlld01vZGUsIHRoaXMuZGVmYXVsdFZhbHVlLnByZXZpZXdNb2RlLCBbJ3ByZWZpeCcsICdzdWJ3b3JkJywgJ3N1YndvcmRTbWFydCddKSxcblx0XHRcdHNob3dJbmxpbmVEZXRhaWxzOiBib29sZWFuKGlucHV0LnNob3dJbmxpbmVEZXRhaWxzLCB0aGlzLmRlZmF1bHRWYWx1ZS5zaG93SW5saW5lRGV0YWlscyksXG5cdFx0XHRzaG93TWV0aG9kczogYm9vbGVhbihpbnB1dC5zaG93TWV0aG9kcywgdGhpcy5kZWZhdWx0VmFsdWUuc2hvd01ldGhvZHMpLFxuXHRcdFx0c2hvd0Z1bmN0aW9uczogYm9vbGVhbihpbnB1dC5zaG93RnVuY3Rpb25zLCB0aGlzLmRlZmF1bHRWYWx1ZS5zaG93RnVuY3Rpb25zKSxcblx0XHRcdHNob3dDb25zdHJ1Y3RvcnM6IGJvb2xlYW4oaW5wdXQuc2hvd0NvbnN0cnVjdG9ycywgdGhpcy5kZWZhdWx0VmFsdWUuc2hvd0NvbnN0cnVjdG9ycyksXG5cdFx0XHRzaG93RGVwcmVjYXRlZDogYm9vbGVhbihpbnB1dC5zaG93RGVwcmVjYXRlZCwgdGhpcy5kZWZhdWx0VmFsdWUuc2hvd0RlcHJlY2F0ZWQpLFxuXHRcdFx0bWF0Y2hPbldvcmRTdGFydE9ubHk6IGJvb2xlYW4oaW5wdXQubWF0Y2hPbldvcmRTdGFydE9ubHksIHRoaXMuZGVmYXVsdFZhbHVlLm1hdGNoT25Xb3JkU3RhcnRPbmx5KSxcblx0XHRcdHNob3dGaWVsZHM6IGJvb2xlYW4oaW5wdXQuc2hvd0ZpZWxkcywgdGhpcy5kZWZhdWx0VmFsdWUuc2hvd0ZpZWxkcyksXG5cdFx0XHRzaG93VmFyaWFibGVzOiBib29sZWFuKGlucHV0LnNob3dWYXJpYWJsZXMsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dWYXJpYWJsZXMpLFxuXHRcdFx0c2hvd0NsYXNzZXM6IGJvb2xlYW4oaW5wdXQuc2hvd0NsYXNzZXMsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dDbGFzc2VzKSxcblx0XHRcdHNob3dTdHJ1Y3RzOiBib29sZWFuKGlucHV0LnNob3dTdHJ1Y3RzLCB0aGlzLmRlZmF1bHRWYWx1ZS5zaG93U3RydWN0cyksXG5cdFx0XHRzaG93SW50ZXJmYWNlczogYm9vbGVhbihpbnB1dC5zaG93SW50ZXJmYWNlcywgdGhpcy5kZWZhdWx0VmFsdWUuc2hvd0ludGVyZmFjZXMpLFxuXHRcdFx0c2hvd01vZHVsZXM6IGJvb2xlYW4oaW5wdXQuc2hvd01vZHVsZXMsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dNb2R1bGVzKSxcblx0XHRcdHNob3dQcm9wZXJ0aWVzOiBib29sZWFuKGlucHV0LnNob3dQcm9wZXJ0aWVzLCB0aGlzLmRlZmF1bHRWYWx1ZS5zaG93UHJvcGVydGllcyksXG5cdFx0XHRzaG93RXZlbnRzOiBib29sZWFuKGlucHV0LnNob3dFdmVudHMsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dFdmVudHMpLFxuXHRcdFx0c2hvd09wZXJhdG9yczogYm9vbGVhbihpbnB1dC5zaG93T3BlcmF0b3JzLCB0aGlzLmRlZmF1bHRWYWx1ZS5zaG93T3BlcmF0b3JzKSxcblx0XHRcdHNob3dVbml0czogYm9vbGVhbihpbnB1dC5zaG93VW5pdHMsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dVbml0cyksXG5cdFx0XHRzaG93VmFsdWVzOiBib29sZWFuKGlucHV0LnNob3dWYWx1ZXMsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dWYWx1ZXMpLFxuXHRcdFx0c2hvd0NvbnN0YW50czogYm9vbGVhbihpbnB1dC5zaG93Q29uc3RhbnRzLCB0aGlzLmRlZmF1bHRWYWx1ZS5zaG93Q29uc3RhbnRzKSxcblx0XHRcdHNob3dFbnVtczogYm9vbGVhbihpbnB1dC5zaG93RW51bXMsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dFbnVtcyksXG5cdFx0XHRzaG93RW51bU1lbWJlcnM6IGJvb2xlYW4oaW5wdXQuc2hvd0VudW1NZW1iZXJzLCB0aGlzLmRlZmF1bHRWYWx1ZS5zaG93RW51bU1lbWJlcnMpLFxuXHRcdFx0c2hvd0tleXdvcmRzOiBib29sZWFuKGlucHV0LnNob3dLZXl3b3JkcywgdGhpcy5kZWZhdWx0VmFsdWUuc2hvd0tleXdvcmRzKSxcblx0XHRcdHNob3dXb3JkczogYm9vbGVhbihpbnB1dC5zaG93V29yZHMsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dXb3JkcyksXG5cdFx0XHRzaG93Q29sb3JzOiBib29sZWFuKGlucHV0LnNob3dDb2xvcnMsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dDb2xvcnMpLFxuXHRcdFx0c2hvd0ZpbGVzOiBib29sZWFuKGlucHV0LnNob3dGaWxlcywgdGhpcy5kZWZhdWx0VmFsdWUuc2hvd0ZpbGVzKSxcblx0XHRcdHNob3dSZWZlcmVuY2VzOiBib29sZWFuKGlucHV0LnNob3dSZWZlcmVuY2VzLCB0aGlzLmRlZmF1bHRWYWx1ZS5zaG93UmVmZXJlbmNlcyksXG5cdFx0XHRzaG93Rm9sZGVyczogYm9vbGVhbihpbnB1dC5zaG93Rm9sZGVycywgdGhpcy5kZWZhdWx0VmFsdWUuc2hvd0ZvbGRlcnMpLFxuXHRcdFx0c2hvd1R5cGVQYXJhbWV0ZXJzOiBib29sZWFuKGlucHV0LnNob3dUeXBlUGFyYW1ldGVycywgdGhpcy5kZWZhdWx0VmFsdWUuc2hvd1R5cGVQYXJhbWV0ZXJzKSxcblx0XHRcdHNob3dTbmlwcGV0czogYm9vbGVhbihpbnB1dC5zaG93U25pcHBldHMsIHRoaXMuZGVmYXVsdFZhbHVlLnNob3dTbmlwcGV0cyksXG5cdFx0XHRzaG93VXNlcnM6IGJvb2xlYW4oaW5wdXQuc2hvd1VzZXJzLCB0aGlzLmRlZmF1bHRWYWx1ZS5zaG93VXNlcnMpLFxuXHRcdFx0c2hvd0lzc3VlczogYm9vbGVhbihpbnB1dC5zaG93SXNzdWVzLCB0aGlzLmRlZmF1bHRWYWx1ZS5zaG93SXNzdWVzKSxcblx0XHR9O1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gc21hcnQgc2VsZWN0XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNtYXJ0U2VsZWN0T3B0aW9ucyB7XG5cdHNlbGVjdExlYWRpbmdBbmRUcmFpbGluZ1doaXRlc3BhY2U/OiBib29sZWFuO1xuXHRzZWxlY3RTdWJ3b3Jkcz86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCB0eXBlIFNtYXJ0U2VsZWN0T3B0aW9ucyA9IFJlYWRvbmx5PFJlcXVpcmVkPElTbWFydFNlbGVjdE9wdGlvbnM+PjtcblxuY2xhc3MgU21hcnRTZWxlY3QgZXh0ZW5kcyBCYXNlRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi5zbWFydFNlbGVjdCwgSVNtYXJ0U2VsZWN0T3B0aW9ucywgU21hcnRTZWxlY3RPcHRpb25zPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHRFZGl0b3JPcHRpb24uc21hcnRTZWxlY3QsICdzbWFydFNlbGVjdCcsXG5cdFx0XHR7XG5cdFx0XHRcdHNlbGVjdExlYWRpbmdBbmRUcmFpbGluZ1doaXRlc3BhY2U6IHRydWUsXG5cdFx0XHRcdHNlbGVjdFN1YndvcmRzOiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0J2VkaXRvci5zbWFydFNlbGVjdC5zZWxlY3RMZWFkaW5nQW5kVHJhaWxpbmdXaGl0ZXNwYWNlJzoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlbGVjdExlYWRpbmdBbmRUcmFpbGluZ1doaXRlc3BhY2UnLCBcIldoZXRoZXIgbGVhZGluZyBhbmQgdHJhaWxpbmcgd2hpdGVzcGFjZSBzaG91bGQgYWx3YXlzIGJlIHNlbGVjdGVkLlwiKSxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZWRpdG9yLnNtYXJ0U2VsZWN0LnNlbGVjdFN1YndvcmRzJzoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlbGVjdFN1YndvcmRzJywgXCJXaGV0aGVyIHN1YndvcmRzIChsaWtlICdmb28nIGluICdmb29CYXInIG9yICdmb29fYmFyJykgc2hvdWxkIGJlIHNlbGVjdGVkLlwiKSxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJ1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShpbnB1dDogYW55KTogUmVhZG9ubHk8UmVxdWlyZWQ8SVNtYXJ0U2VsZWN0T3B0aW9ucz4+IHtcblx0XHRpZiAoIWlucHV0IHx8IHR5cGVvZiBpbnB1dCAhPT0gJ29iamVjdCcpIHtcblx0XHRcdHJldHVybiB0aGlzLmRlZmF1bHRWYWx1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNlbGVjdExlYWRpbmdBbmRUcmFpbGluZ1doaXRlc3BhY2U6IGJvb2xlYW4oKGlucHV0IGFzIElTbWFydFNlbGVjdE9wdGlvbnMpLnNlbGVjdExlYWRpbmdBbmRUcmFpbGluZ1doaXRlc3BhY2UsIHRoaXMuZGVmYXVsdFZhbHVlLnNlbGVjdExlYWRpbmdBbmRUcmFpbGluZ1doaXRlc3BhY2UpLFxuXHRcdFx0c2VsZWN0U3Vid29yZHM6IGJvb2xlYW4oKGlucHV0IGFzIElTbWFydFNlbGVjdE9wdGlvbnMpLnNlbGVjdFN1YndvcmRzLCB0aGlzLmRlZmF1bHRWYWx1ZS5zZWxlY3RTdWJ3b3JkcyksXG5cdFx0fTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIHdvcmRTZWdtZW50ZXJMb2NhbGVzXG5cbi8qKlxuICogTG9jYWxlcyB1c2VkIGZvciBzZWdtZW50aW5nIGxpbmVzIGludG8gd29yZHMgd2hlbiBkb2luZyB3b3JkIHJlbGF0ZWQgbmF2aWdhdGlvbnMgb3Igb3BlcmF0aW9ucy5cbiAqXG4gKiBTcGVjaWZ5IHRoZSBCQ1AgNDcgbGFuZ3VhZ2UgdGFnIG9mIHRoZSB3b3JkIHlvdSB3aXNoIHRvIHJlY29nbml6ZSAoZS5nLiwgamEsIHpoLUNOLCB6aC1IYW50LVRXLCBldGMuKS5cbiAqL1xuY2xhc3MgV29yZFNlZ21lbnRlckxvY2FsZXMgZXh0ZW5kcyBCYXNlRWRpdG9yT3B0aW9uPEVkaXRvck9wdGlvbi53b3JkU2VnbWVudGVyTG9jYWxlcywgc3RyaW5nIHwgc3RyaW5nW10sIHN0cmluZ1tdPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IGRlZmF1bHRzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0c3VwZXIoXG5cdFx0XHRFZGl0b3JPcHRpb24ud29yZFNlZ21lbnRlckxvY2FsZXMsICd3b3JkU2VnbWVudGVyTG9jYWxlcycsIGRlZmF1bHRzLFxuXHRcdFx0e1xuXHRcdFx0XHRhbnlPZjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3dvcmRTZWdtZW50ZXJMb2NhbGVzJywgXCJMb2NhbGVzIHRvIGJlIHVzZWQgZm9yIHdvcmQgc2VnbWVudGF0aW9uIHdoZW4gZG9pbmcgd29yZCByZWxhdGVkIG5hdmlnYXRpb25zIG9yIG9wZXJhdGlvbnMuIFNwZWNpZnkgdGhlIEJDUCA0NyBsYW5ndWFnZSB0YWcgb2YgdGhlIHdvcmQgeW91IHdpc2ggdG8gcmVjb2duaXplIChlLmcuLCBqYSwgemgtQ04sIHpoLUhhbnQtVFcsIGV0Yy4pLlwiKSxcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3dvcmRTZWdtZW50ZXJMb2NhbGVzJywgXCJMb2NhbGVzIHRvIGJlIHVzZWQgZm9yIHdvcmQgc2VnbWVudGF0aW9uIHdoZW4gZG9pbmcgd29yZCByZWxhdGVkIG5hdmlnYXRpb25zIG9yIG9wZXJhdGlvbnMuIFNwZWNpZnkgdGhlIEJDUCA0NyBsYW5ndWFnZSB0YWcgb2YgdGhlIHdvcmQgeW91IHdpc2ggdG8gcmVjb2duaXplIChlLmcuLCBqYSwgemgtQ04sIHpoLUhhbnQtVFcsIGV0Yy4pLlwiKSxcblx0XHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgdmFsaWRhdGUoaW5wdXQ6IGFueSk6IHN0cmluZ1tdIHtcblx0XHRpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0aW5wdXQgPSBbaW5wdXRdO1xuXHRcdH1cblx0XHRpZiAoQXJyYXkuaXNBcnJheShpbnB1dCkpIHtcblx0XHRcdGNvbnN0IHZhbGlkTG9jYWxlczogc3RyaW5nW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgbG9jYWxlIG9mIGlucHV0KSB7XG5cdFx0XHRcdGlmICh0eXBlb2YgbG9jYWxlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRpZiAoSW50bC5TZWdtZW50ZXIuc3VwcG9ydGVkTG9jYWxlc09mKGxvY2FsZSkubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0XHR2YWxpZExvY2FsZXMucHVzaChsb2NhbGUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRcdFx0Ly8gaWdub3JlIGludmFsaWQgbG9jYWxlc1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHZhbGlkTG9jYWxlcztcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0VmFsdWU7XG5cdH1cbn1cblxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIHdyYXBwaW5nSW5kZW50XG5cbi8qKlxuICogRGVzY3JpYmVzIGhvdyB0byBpbmRlbnQgd3JhcHBlZCBsaW5lcy5cbiAqL1xuZXhwb3J0IGNvbnN0IGVudW0gV3JhcHBpbmdJbmRlbnQge1xuXHQvKipcblx0ICogTm8gaW5kZW50YXRpb24gPT4gd3JhcHBlZCBsaW5lcyBiZWdpbiBhdCBjb2x1bW4gMS5cblx0ICovXG5cdE5vbmUgPSAwLFxuXHQvKipcblx0ICogU2FtZSA9PiB3cmFwcGVkIGxpbmVzIGdldCB0aGUgc2FtZSBpbmRlbnRhdGlvbiBhcyB0aGUgcGFyZW50LlxuXHQgKi9cblx0U2FtZSA9IDEsXG5cdC8qKlxuXHQgKiBJbmRlbnQgPT4gd3JhcHBlZCBsaW5lcyBnZXQgKzEgaW5kZW50YXRpb24gdG93YXJkIHRoZSBwYXJlbnQuXG5cdCAqL1xuXHRJbmRlbnQgPSAyLFxuXHQvKipcblx0ICogRGVlcEluZGVudCA9PiB3cmFwcGVkIGxpbmVzIGdldCArMiBpbmRlbnRhdGlvbiB0b3dhcmQgdGhlIHBhcmVudC5cblx0ICovXG5cdERlZXBJbmRlbnQgPSAzXG59XG5cbmNsYXNzIFdyYXBwaW5nSW5kZW50T3B0aW9uIGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24ud3JhcHBpbmdJbmRlbnQsICdub25lJyB8ICdzYW1lJyB8ICdpbmRlbnQnIHwgJ2RlZXBJbmRlbnQnLCBXcmFwcGluZ0luZGVudD4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKEVkaXRvck9wdGlvbi53cmFwcGluZ0luZGVudCwgJ3dyYXBwaW5nSW5kZW50JywgV3JhcHBpbmdJbmRlbnQuU2FtZSxcblx0XHRcdHtcblx0XHRcdFx0J2VkaXRvci53cmFwcGluZ0luZGVudCc6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRlbnVtOiBbJ25vbmUnLCAnc2FtZScsICdpbmRlbnQnLCAnZGVlcEluZGVudCddLFxuXHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnd3JhcHBpbmdJbmRlbnQubm9uZScsIFwiTm8gaW5kZW50YXRpb24uIFdyYXBwZWQgbGluZXMgYmVnaW4gYXQgY29sdW1uIDEuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCd3cmFwcGluZ0luZGVudC5zYW1lJywgXCJXcmFwcGVkIGxpbmVzIGdldCB0aGUgc2FtZSBpbmRlbnRhdGlvbiBhcyB0aGUgcGFyZW50LlwiKSxcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnd3JhcHBpbmdJbmRlbnQuaW5kZW50JywgXCJXcmFwcGVkIGxpbmVzIGdldCArMSBpbmRlbnRhdGlvbiB0b3dhcmQgdGhlIHBhcmVudC5cIiksXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ3dyYXBwaW5nSW5kZW50LmRlZXBJbmRlbnQnLCBcIldyYXBwZWQgbGluZXMgZ2V0ICsyIGluZGVudGF0aW9uIHRvd2FyZCB0aGUgcGFyZW50LlwiKSxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3dyYXBwaW5nSW5kZW50JywgXCJDb250cm9scyB0aGUgaW5kZW50YXRpb24gb2Ygd3JhcHBlZCBsaW5lcy5cIiksXG5cdFx0XHRcdFx0ZGVmYXVsdDogJ3NhbWUnXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHZhbGlkYXRlKGlucHV0OiBhbnkpOiBXcmFwcGluZ0luZGVudCB7XG5cdFx0c3dpdGNoIChpbnB1dCkge1xuXHRcdFx0Y2FzZSAnbm9uZSc6IHJldHVybiBXcmFwcGluZ0luZGVudC5Ob25lO1xuXHRcdFx0Y2FzZSAnc2FtZSc6IHJldHVybiBXcmFwcGluZ0luZGVudC5TYW1lO1xuXHRcdFx0Y2FzZSAnaW5kZW50JzogcmV0dXJuIFdyYXBwaW5nSW5kZW50LkluZGVudDtcblx0XHRcdGNhc2UgJ2RlZXBJbmRlbnQnOiByZXR1cm4gV3JhcHBpbmdJbmRlbnQuRGVlcEluZGVudDtcblx0XHR9XG5cdFx0cmV0dXJuIFdyYXBwaW5nSW5kZW50LlNhbWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgY29tcHV0ZShlbnY6IElFbnZpcm9ubWVudGFsT3B0aW9ucywgb3B0aW9uczogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucywgdmFsdWU6IFdyYXBwaW5nSW5kZW50KTogV3JhcHBpbmdJbmRlbnQge1xuXHRcdGNvbnN0IGFjY2Vzc2liaWxpdHlTdXBwb3J0ID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmFjY2Vzc2liaWxpdHlTdXBwb3J0KTtcblx0XHRpZiAoYWNjZXNzaWJpbGl0eVN1cHBvcnQgPT09IEFjY2Vzc2liaWxpdHlTdXBwb3J0LkVuYWJsZWQpIHtcblx0XHRcdC8vIGlmIHdlIGtub3cgZm9yIGEgZmFjdCB0aGF0IGEgc2NyZWVuIHJlYWRlciBpcyBhdHRhY2hlZCwgd2UgdXNlIG5vIGluZGVudCB3cmFwcGluZyB0b1xuXHRcdFx0Ly8gaGVscCB0aGF0IHRoZSBlZGl0b3IncyB3cmFwcGluZyBwb2ludHMgbWF0Y2ggdGhlIHRleHRhcmVhJ3Mgd3JhcHBpbmcgcG9pbnRzXG5cdFx0XHRyZXR1cm4gV3JhcHBpbmdJbmRlbnQuTm9uZTtcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gd3JhcHBpbmdJbmZvXG5cbmV4cG9ydCBpbnRlcmZhY2UgRWRpdG9yV3JhcHBpbmdJbmZvIHtcblx0cmVhZG9ubHkgaXNEb21pbmF0ZWRCeUxvbmdMaW5lczogYm9vbGVhbjtcblx0cmVhZG9ubHkgaXNXb3JkV3JhcE1pbmlmaWVkOiBib29sZWFuO1xuXHRyZWFkb25seSBpc1ZpZXdwb3J0V3JhcHBpbmc6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHdyYXBwaW5nQ29sdW1uOiBudW1iZXI7XG59XG5cbmNsYXNzIEVkaXRvcldyYXBwaW5nSW5mb0NvbXB1dGVyIGV4dGVuZHMgQ29tcHV0ZWRFZGl0b3JPcHRpb248RWRpdG9yT3B0aW9uLndyYXBwaW5nSW5mbywgRWRpdG9yV3JhcHBpbmdJbmZvPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoRWRpdG9yT3B0aW9uLndyYXBwaW5nSW5mbyk7XG5cdH1cblxuXHRwdWJsaWMgY29tcHV0ZShlbnY6IElFbnZpcm9ubWVudGFsT3B0aW9ucywgb3B0aW9uczogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucywgXzogRWRpdG9yV3JhcHBpbmdJbmZvKTogRWRpdG9yV3JhcHBpbmdJbmZvIHtcblx0XHRjb25zdCBsYXlvdXRJbmZvID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGlzRG9taW5hdGVkQnlMb25nTGluZXM6IGVudi5pc0RvbWluYXRlZEJ5TG9uZ0xpbmVzLFxuXHRcdFx0aXNXb3JkV3JhcE1pbmlmaWVkOiBsYXlvdXRJbmZvLmlzV29yZFdyYXBNaW5pZmllZCxcblx0XHRcdGlzVmlld3BvcnRXcmFwcGluZzogbGF5b3V0SW5mby5pc1ZpZXdwb3J0V3JhcHBpbmcsXG5cdFx0XHR3cmFwcGluZ0NvbHVtbjogbGF5b3V0SW5mby53cmFwcGluZ0NvbHVtbixcblx0XHR9O1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gZHJvcEludG9FZGl0b3JcblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIGVkaXRvciBkcm9wIGludG8gYmVoYXZpb3JcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJRHJvcEludG9FZGl0b3JPcHRpb25zIHtcblx0LyoqXG5cdCAqIEVuYWJsZSBkcm9wcGluZyBpbnRvIGVkaXRvci5cblx0ICogRGVmYXVsdHMgdG8gdHJ1ZS5cblx0ICovXG5cdGVuYWJsZWQ/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBDb250cm9scyBpZiBhIHdpZGdldCBpcyBzaG93biBhZnRlciBhIGRyb3AuXG5cdCAqIERlZmF1bHRzIHRvICdhZnRlckRyb3AnLlxuXHQgKi9cblx0c2hvd0Ryb3BTZWxlY3Rvcj86ICdhZnRlckRyb3AnIHwgJ25ldmVyJztcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IHR5cGUgRWRpdG9yRHJvcEludG9FZGl0b3JPcHRpb25zID0gUmVhZG9ubHk8UmVxdWlyZWQ8SURyb3BJbnRvRWRpdG9yT3B0aW9ucz4+O1xuXG5jbGFzcyBFZGl0b3JEcm9wSW50b0VkaXRvciBleHRlbmRzIEJhc2VFZGl0b3JPcHRpb248RWRpdG9yT3B0aW9uLmRyb3BJbnRvRWRpdG9yLCBJRHJvcEludG9FZGl0b3JPcHRpb25zLCBFZGl0b3JEcm9wSW50b0VkaXRvck9wdGlvbnM+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBkZWZhdWx0czogRWRpdG9yRHJvcEludG9FZGl0b3JPcHRpb25zID0geyBlbmFibGVkOiB0cnVlLCBzaG93RHJvcFNlbGVjdG9yOiAnYWZ0ZXJEcm9wJyB9O1xuXHRcdHN1cGVyKFxuXHRcdFx0RWRpdG9yT3B0aW9uLmRyb3BJbnRvRWRpdG9yLCAnZHJvcEludG9FZGl0b3InLCBkZWZhdWx0cyxcblx0XHRcdHtcblx0XHRcdFx0J2VkaXRvci5kcm9wSW50b0VkaXRvci5lbmFibGVkJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5lbmFibGVkLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZHJvcEludG9FZGl0b3IuZW5hYmxlZCcsIFwiQ29udHJvbHMgd2hldGhlciB5b3UgY2FuIGRyYWcgYW5kIGRyb3AgYSBmaWxlIGludG8gYSB0ZXh0IGVkaXRvciBieSBob2xkaW5nIGRvd24gdGhlIGBTaGlmdGAga2V5IChpbnN0ZWFkIG9mIG9wZW5pbmcgdGhlIGZpbGUgaW4gYW4gZWRpdG9yKS5cIiksXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IuZHJvcEludG9FZGl0b3Iuc2hvd0Ryb3BTZWxlY3Rvcic6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2Ryb3BJbnRvRWRpdG9yLnNob3dEcm9wU2VsZWN0b3InLCBcIkNvbnRyb2xzIGlmIGEgd2lkZ2V0IGlzIHNob3duIHdoZW4gZHJvcHBpbmcgZmlsZXMgaW50byB0aGUgZWRpdG9yLiBUaGlzIHdpZGdldCBsZXRzIHlvdSBjb250cm9sIGhvdyB0aGUgZmlsZSBpcyBkcm9wcGVkLlwiKSxcblx0XHRcdFx0XHRlbnVtOiBbXG5cdFx0XHRcdFx0XHQnYWZ0ZXJEcm9wJyxcblx0XHRcdFx0XHRcdCduZXZlcidcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnZHJvcEludG9FZGl0b3Iuc2hvd0Ryb3BTZWxlY3Rvci5hZnRlckRyb3AnLCBcIlNob3cgdGhlIGRyb3Agc2VsZWN0b3Igd2lkZ2V0IGFmdGVyIGEgZmlsZSBpcyBkcm9wcGVkIGludG8gdGhlIGVkaXRvci5cIiksXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2Ryb3BJbnRvRWRpdG9yLnNob3dEcm9wU2VsZWN0b3IubmV2ZXInLCBcIk5ldmVyIHNob3cgdGhlIGRyb3Agc2VsZWN0b3Igd2lkZ2V0LiBJbnN0ZWFkIHRoZSBkZWZhdWx0IGRyb3AgcHJvdmlkZXIgaXMgYWx3YXlzIHVzZWQuXCIpLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0ZGVmYXVsdDogJ2FmdGVyRHJvcCcsXG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShfaW5wdXQ6IGFueSk6IEVkaXRvckRyb3BJbnRvRWRpdG9yT3B0aW9ucyB7XG5cdFx0aWYgKCFfaW5wdXQgfHwgdHlwZW9mIF9pbnB1dCAhPT0gJ29iamVjdCcpIHtcblx0XHRcdHJldHVybiB0aGlzLmRlZmF1bHRWYWx1ZTtcblx0XHR9XG5cdFx0Y29uc3QgaW5wdXQgPSBfaW5wdXQgYXMgSURyb3BJbnRvRWRpdG9yT3B0aW9ucztcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZW5hYmxlZDogYm9vbGVhbihpbnB1dC5lbmFibGVkLCB0aGlzLmRlZmF1bHRWYWx1ZS5lbmFibGVkKSxcblx0XHRcdHNob3dEcm9wU2VsZWN0b3I6IHN0cmluZ1NldChpbnB1dC5zaG93RHJvcFNlbGVjdG9yLCB0aGlzLmRlZmF1bHRWYWx1ZS5zaG93RHJvcFNlbGVjdG9yLCBbJ2FmdGVyRHJvcCcsICduZXZlciddKSxcblx0XHR9O1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gcGFzdGVBc1xuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgZWRpdG9yIHBhc3RpbmcgYXMgaW50byBiZWhhdmlvclxuICovXG5leHBvcnQgaW50ZXJmYWNlIElQYXN0ZUFzT3B0aW9ucyB7XG5cdC8qKlxuXHQgKiBFbmFibGUgcGFzdGUgYXMgZnVuY3Rpb25hbGl0eSBpbiBlZGl0b3JzLlxuXHQgKiBEZWZhdWx0cyB0byB0cnVlLlxuXHQgKi9cblx0ZW5hYmxlZD86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIGlmIGEgd2lkZ2V0IGlzIHNob3duIGFmdGVyIGEgZHJvcC5cblx0ICogRGVmYXVsdHMgdG8gJ2FmdGVyUGFzdGUnLlxuXHQgKi9cblx0c2hvd1Bhc3RlU2VsZWN0b3I/OiAnYWZ0ZXJQYXN0ZScgfCAnbmV2ZXInO1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgdHlwZSBFZGl0b3JQYXN0ZUFzT3B0aW9ucyA9IFJlYWRvbmx5PFJlcXVpcmVkPElQYXN0ZUFzT3B0aW9ucz4+O1xuXG5jbGFzcyBFZGl0b3JQYXN0ZUFzIGV4dGVuZHMgQmFzZUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24ucGFzdGVBcywgSVBhc3RlQXNPcHRpb25zLCBFZGl0b3JQYXN0ZUFzT3B0aW9ucz4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IGRlZmF1bHRzOiBFZGl0b3JQYXN0ZUFzT3B0aW9ucyA9IHsgZW5hYmxlZDogdHJ1ZSwgc2hvd1Bhc3RlU2VsZWN0b3I6ICdhZnRlclBhc3RlJyB9O1xuXHRcdHN1cGVyKFxuXHRcdFx0RWRpdG9yT3B0aW9uLnBhc3RlQXMsICdwYXN0ZUFzJywgZGVmYXVsdHMsXG5cdFx0XHR7XG5cdFx0XHRcdCdlZGl0b3IucGFzdGVBcy5lbmFibGVkJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0cy5lbmFibGVkLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncGFzdGVBcy5lbmFibGVkJywgXCJDb250cm9scyB3aGV0aGVyIHlvdSBjYW4gcGFzdGUgY29udGVudCBpbiBkaWZmZXJlbnQgd2F5cy5cIiksXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdlZGl0b3IucGFzdGVBcy5zaG93UGFzdGVTZWxlY3Rvcic6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Bhc3RlQXMuc2hvd1Bhc3RlU2VsZWN0b3InLCBcIkNvbnRyb2xzIGlmIGEgd2lkZ2V0IGlzIHNob3duIHdoZW4gcGFzdGluZyBjb250ZW50IGluIHRvIHRoZSBlZGl0b3IuIFRoaXMgd2lkZ2V0IGxldHMgeW91IGNvbnRyb2wgaG93IHRoZSBmaWxlIGlzIHBhc3RlZC5cIiksXG5cdFx0XHRcdFx0ZW51bTogW1xuXHRcdFx0XHRcdFx0J2FmdGVyUGFzdGUnLFxuXHRcdFx0XHRcdFx0J25ldmVyJ1xuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdwYXN0ZUFzLnNob3dQYXN0ZVNlbGVjdG9yLmFmdGVyUGFzdGUnLCBcIlNob3cgdGhlIHBhc3RlIHNlbGVjdG9yIHdpZGdldCBhZnRlciBjb250ZW50IGlzIHBhc3RlZCBpbnRvIHRoZSBlZGl0b3IuXCIpLFxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdwYXN0ZUFzLnNob3dQYXN0ZVNlbGVjdG9yLm5ldmVyJywgXCJOZXZlciBzaG93IHRoZSBwYXN0ZSBzZWxlY3RvciB3aWRnZXQuIEluc3RlYWQgdGhlIGRlZmF1bHQgcGFzdGluZyBiZWhhdmlvciBpcyBhbHdheXMgdXNlZC5cIiksXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRkZWZhdWx0OiAnYWZ0ZXJQYXN0ZScsXG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShfaW5wdXQ6IGFueSk6IEVkaXRvclBhc3RlQXNPcHRpb25zIHtcblx0XHRpZiAoIV9pbnB1dCB8fCB0eXBlb2YgX2lucHV0ICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHRjb25zdCBpbnB1dCA9IF9pbnB1dCBhcyBJUGFzdGVBc09wdGlvbnM7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGVuYWJsZWQ6IGJvb2xlYW4oaW5wdXQuZW5hYmxlZCwgdGhpcy5kZWZhdWx0VmFsdWUuZW5hYmxlZCksXG5cdFx0XHRzaG93UGFzdGVTZWxlY3Rvcjogc3RyaW5nU2V0KGlucHV0LnNob3dQYXN0ZVNlbGVjdG9yLCB0aGlzLmRlZmF1bHRWYWx1ZS5zaG93UGFzdGVTZWxlY3RvciwgWydhZnRlclBhc3RlJywgJ25ldmVyJ10pLFxuXHRcdH07XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbmNvbnN0IERFRkFVTFRfV0lORE9XU19GT05UX0ZBTUlMWSA9ICdDb25zb2xhcywgXFwnQ291cmllciBOZXdcXCcsIG1vbm9zcGFjZSc7XG5jb25zdCBERUZBVUxUX01BQ19GT05UX0ZBTUlMWSA9ICdNZW5sbywgTW9uYWNvLCBcXCdDb3VyaWVyIE5ld1xcJywgbW9ub3NwYWNlJztcbmNvbnN0IERFRkFVTFRfTElOVVhfRk9OVF9GQU1JTFkgPSAnXFwnRHJvaWQgU2FucyBNb25vXFwnLCBcXCdtb25vc3BhY2VcXCcsIG1vbm9zcGFjZSc7XG5cbi8qKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCBjb25zdCBFRElUT1JfRk9OVF9ERUZBVUxUUyA9IHtcblx0Zm9udEZhbWlseTogKFxuXHRcdHBsYXRmb3JtLmlzTWFjaW50b3NoID8gREVGQVVMVF9NQUNfRk9OVF9GQU1JTFkgOiAocGxhdGZvcm0uaXNMaW51eCA/IERFRkFVTFRfTElOVVhfRk9OVF9GQU1JTFkgOiBERUZBVUxUX1dJTkRPV1NfRk9OVF9GQU1JTFkpXG5cdCksXG5cdGZvbnRXZWlnaHQ6ICdub3JtYWwnLFxuXHRmb250U2l6ZTogKFxuXHRcdHBsYXRmb3JtLmlzTWFjaW50b3NoID8gMTIgOiAxNFxuXHQpLFxuXHRsaW5lSGVpZ2h0OiAwLFxuXHRsZXR0ZXJTcGFjaW5nOiAwLFxufTtcblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGNvbnN0IGVkaXRvck9wdGlvbnNSZWdpc3RyeTogSUVkaXRvck9wdGlvbjxFZGl0b3JPcHRpb24sIGFueT5bXSA9IFtdO1xuXG5mdW5jdGlvbiByZWdpc3RlcjxLIGV4dGVuZHMgRWRpdG9yT3B0aW9uLCBWPihvcHRpb246IElFZGl0b3JPcHRpb248SywgVj4pOiBJRWRpdG9yT3B0aW9uPEssIFY+IHtcblx0ZWRpdG9yT3B0aW9uc1JlZ2lzdHJ5W29wdGlvbi5pZF0gPSBvcHRpb247XG5cdHJldHVybiBvcHRpb247XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIEVkaXRvck9wdGlvbiB7XG5cdGFjY2VwdFN1Z2dlc3Rpb25PbkNvbW1pdENoYXJhY3Rlcixcblx0YWNjZXB0U3VnZ2VzdGlvbk9uRW50ZXIsXG5cdGFjY2Vzc2liaWxpdHlTdXBwb3J0LFxuXHRhY2Nlc3NpYmlsaXR5UGFnZVNpemUsXG5cdGFyaWFMYWJlbCxcblx0YXJpYVJlcXVpcmVkLFxuXHRhdXRvQ2xvc2luZ0JyYWNrZXRzLFxuXHRhdXRvQ2xvc2luZ0NvbW1lbnRzLFxuXHRzY3JlZW5SZWFkZXJBbm5vdW5jZUlubGluZVN1Z2dlc3Rpb24sXG5cdGF1dG9DbG9zaW5nRGVsZXRlLFxuXHRhdXRvQ2xvc2luZ092ZXJ0eXBlLFxuXHRhdXRvQ2xvc2luZ1F1b3Rlcyxcblx0YXV0b0luZGVudCxcblx0YXV0b21hdGljTGF5b3V0LFxuXHRhdXRvU3Vycm91bmQsXG5cdGJyYWNrZXRQYWlyQ29sb3JpemF0aW9uLFxuXHRndWlkZXMsXG5cdGNvZGVMZW5zLFxuXHRjb2RlTGVuc0ZvbnRGYW1pbHksXG5cdGNvZGVMZW5zRm9udFNpemUsXG5cdGNvbG9yRGVjb3JhdG9ycyxcblx0Y29sb3JEZWNvcmF0b3JzTGltaXQsXG5cdGNvbHVtblNlbGVjdGlvbixcblx0Y29tbWVudHMsXG5cdGNvbnRleHRtZW51LFxuXHRjb3B5V2l0aFN5bnRheEhpZ2hsaWdodGluZyxcblx0Y3Vyc29yQmxpbmtpbmcsXG5cdGN1cnNvclNtb290aENhcmV0QW5pbWF0aW9uLFxuXHRjdXJzb3JTdHlsZSxcblx0Y3Vyc29yU3Vycm91bmRpbmdMaW5lcyxcblx0Y3Vyc29yU3Vycm91bmRpbmdMaW5lc1N0eWxlLFxuXHRjdXJzb3JXaWR0aCxcblx0ZGlzYWJsZUxheWVySGludGluZyxcblx0ZGlzYWJsZU1vbm9zcGFjZU9wdGltaXphdGlvbnMsXG5cdGRvbVJlYWRPbmx5LFxuXHRkcmFnQW5kRHJvcCxcblx0ZHJvcEludG9FZGl0b3IsXG5cdGV4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZCxcblx0ZW1wdHlTZWxlY3Rpb25DbGlwYm9hcmQsXG5cdGV4cGVyaW1lbnRhbEdwdUFjY2VsZXJhdGlvbixcblx0ZXhwZXJpbWVudGFsV2hpdGVzcGFjZVJlbmRlcmluZyxcblx0ZXh0cmFFZGl0b3JDbGFzc05hbWUsXG5cdGZhc3RTY3JvbGxTZW5zaXRpdml0eSxcblx0ZmluZCxcblx0Zml4ZWRPdmVyZmxvd1dpZGdldHMsXG5cdGZvbGRpbmcsXG5cdGZvbGRpbmdTdHJhdGVneSxcblx0Zm9sZGluZ0hpZ2hsaWdodCxcblx0Zm9sZGluZ0ltcG9ydHNCeURlZmF1bHQsXG5cdGZvbGRpbmdNYXhpbXVtUmVnaW9ucyxcblx0dW5mb2xkT25DbGlja0FmdGVyRW5kT2ZMaW5lLFxuXHRmb250RmFtaWx5LFxuXHRmb250SW5mbyxcblx0Zm9udExpZ2F0dXJlcyxcblx0Zm9udFNpemUsXG5cdGZvbnRXZWlnaHQsXG5cdGZvbnRWYXJpYXRpb25zLFxuXHRmb3JtYXRPblBhc3RlLFxuXHRmb3JtYXRPblR5cGUsXG5cdGdseXBoTWFyZ2luLFxuXHRnb3RvTG9jYXRpb24sXG5cdGhpZGVDdXJzb3JJbk92ZXJ2aWV3UnVsZXIsXG5cdGhvdmVyLFxuXHRpbkRpZmZFZGl0b3IsXG5cdGlubGluZVN1Z2dlc3QsXG5cdGxldHRlclNwYWNpbmcsXG5cdGxpZ2h0YnVsYixcblx0bGluZURlY29yYXRpb25zV2lkdGgsXG5cdGxpbmVIZWlnaHQsXG5cdGxpbmVOdW1iZXJzLFxuXHRsaW5lTnVtYmVyc01pbkNoYXJzLFxuXHRsaW5rZWRFZGl0aW5nLFxuXHRsaW5rcyxcblx0bWF0Y2hCcmFja2V0cyxcblx0bWluaW1hcCxcblx0bW91c2VTdHlsZSxcblx0bW91c2VXaGVlbFNjcm9sbFNlbnNpdGl2aXR5LFxuXHRtb3VzZVdoZWVsWm9vbSxcblx0bXVsdGlDdXJzb3JNZXJnZU92ZXJsYXBwaW5nLFxuXHRtdWx0aUN1cnNvck1vZGlmaWVyLFxuXHRtdWx0aUN1cnNvclBhc3RlLFxuXHRtdWx0aUN1cnNvckxpbWl0LFxuXHRvY2N1cnJlbmNlc0hpZ2hsaWdodCxcblx0b2NjdXJyZW5jZXNIaWdobGlnaHREZWxheSxcblx0b3ZlcnR5cGVDdXJzb3JTdHlsZSxcblx0b3ZlcnR5cGVPblBhc3RlLFxuXHRvdmVydmlld1J1bGVyQm9yZGVyLFxuXHRvdmVydmlld1J1bGVyTGFuZXMsXG5cdHBhZGRpbmcsXG5cdHBhc3RlQXMsXG5cdHBhcmFtZXRlckhpbnRzLFxuXHRwZWVrV2lkZ2V0RGVmYXVsdEZvY3VzLFxuXHRwbGFjZWhvbGRlcixcblx0ZGVmaW5pdGlvbkxpbmtPcGVuc0luUGVlayxcblx0cXVpY2tTdWdnZXN0aW9ucyxcblx0cXVpY2tTdWdnZXN0aW9uc0RlbGF5LFxuXHRyZWFkT25seSxcblx0cmVhZE9ubHlNZXNzYWdlLFxuXHRyZW5hbWVPblR5cGUsXG5cdHJlbmRlckNvbnRyb2xDaGFyYWN0ZXJzLFxuXHRyZW5kZXJGaW5hbE5ld2xpbmUsXG5cdHJlbmRlckxpbmVIaWdobGlnaHQsXG5cdHJlbmRlckxpbmVIaWdobGlnaHRPbmx5V2hlbkZvY3VzLFxuXHRyZW5kZXJWYWxpZGF0aW9uRGVjb3JhdGlvbnMsXG5cdHJlbmRlcldoaXRlc3BhY2UsXG5cdHJldmVhbEhvcml6b250YWxSaWdodFBhZGRpbmcsXG5cdHJvdW5kZWRTZWxlY3Rpb24sXG5cdHJ1bGVycyxcblx0c2Nyb2xsYmFyLFxuXHRzY3JvbGxCZXlvbmRMYXN0Q29sdW1uLFxuXHRzY3JvbGxCZXlvbmRMYXN0TGluZSxcblx0c2Nyb2xsUHJlZG9taW5hbnRBeGlzLFxuXHRzZWxlY3Rpb25DbGlwYm9hcmQsXG5cdHNlbGVjdGlvbkhpZ2hsaWdodCxcblx0c2VsZWN0T25MaW5lTnVtYmVycyxcblx0c2hvd0ZvbGRpbmdDb250cm9scyxcblx0c2hvd1VudXNlZCxcblx0c25pcHBldFN1Z2dlc3Rpb25zLFxuXHRzbWFydFNlbGVjdCxcblx0c21vb3RoU2Nyb2xsaW5nLFxuXHRzdGlja3lTY3JvbGwsXG5cdHN0aWNreVRhYlN0b3BzLFxuXHRzdG9wUmVuZGVyaW5nTGluZUFmdGVyLFxuXHRzdWdnZXN0LFxuXHRzdWdnZXN0Rm9udFNpemUsXG5cdHN1Z2dlc3RMaW5lSGVpZ2h0LFxuXHRzdWdnZXN0T25UcmlnZ2VyQ2hhcmFjdGVycyxcblx0c3VnZ2VzdFNlbGVjdGlvbixcblx0dGFiQ29tcGxldGlvbixcblx0dGFiSW5kZXgsXG5cdHVuaWNvZGVIaWdobGlnaHRpbmcsXG5cdHVudXN1YWxMaW5lVGVybWluYXRvcnMsXG5cdHVzZVNoYWRvd0RPTSxcblx0dXNlVGFiU3RvcHMsXG5cdHdvcmRCcmVhayxcblx0d29yZFNlZ21lbnRlckxvY2FsZXMsXG5cdHdvcmRTZXBhcmF0b3JzLFxuXHR3b3JkV3JhcCxcblx0d29yZFdyYXBCcmVha0FmdGVyQ2hhcmFjdGVycyxcblx0d29yZFdyYXBCcmVha0JlZm9yZUNoYXJhY3RlcnMsXG5cdHdvcmRXcmFwQ29sdW1uLFxuXHR3b3JkV3JhcE92ZXJyaWRlMSxcblx0d29yZFdyYXBPdmVycmlkZTIsXG5cdHdyYXBwaW5nSW5kZW50LFxuXHR3cmFwcGluZ1N0cmF0ZWd5LFxuXHRzaG93RGVwcmVjYXRlZCxcblx0aW5sYXlIaW50cyxcblx0Ly8gTGVhdmUgdGhlc2UgYXQgdGhlIGVuZCAoYmVjYXVzZSB0aGV5IGhhdmUgZGVwZW5kZW5jaWVzISlcblx0ZWZmZWN0aXZlQ3Vyc29yU3R5bGUsXG5cdGVkaXRvckNsYXNzTmFtZSxcblx0cGl4ZWxSYXRpbyxcblx0dGFiRm9jdXNNb2RlLFxuXHRsYXlvdXRJbmZvLFxuXHR3cmFwcGluZ0luZm8sXG5cdGRlZmF1bHRDb2xvckRlY29yYXRvcnMsXG5cdGNvbG9yRGVjb3JhdG9yc0FjdGl2YXRlZE9uLFxuXHRpbmxpbmVDb21wbGV0aW9uc0FjY2Vzc2liaWxpdHlWZXJib3NlLFxuXHRlZmZlY3RpdmVFeHBlcmltZW50YWxFZGl0Q29udGV4dEVuYWJsZWRcbn1cblxuZXhwb3J0IGNvbnN0IEVkaXRvck9wdGlvbnMgPSB7XG5cdGFjY2VwdFN1Z2dlc3Rpb25PbkNvbW1pdENoYXJhY3RlcjogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmFjY2VwdFN1Z2dlc3Rpb25PbkNvbW1pdENoYXJhY3RlciwgJ2FjY2VwdFN1Z2dlc3Rpb25PbkNvbW1pdENoYXJhY3RlcicsIHRydWUsXG5cdFx0eyBtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2FjY2VwdFN1Z2dlc3Rpb25PbkNvbW1pdENoYXJhY3RlcicsIFwiQ29udHJvbHMgd2hldGhlciBzdWdnZXN0aW9ucyBzaG91bGQgYmUgYWNjZXB0ZWQgb24gY29tbWl0IGNoYXJhY3RlcnMuIEZvciBleGFtcGxlLCBpbiBKYXZhU2NyaXB0LCB0aGUgc2VtaS1jb2xvbiAoYDtgKSBjYW4gYmUgYSBjb21taXQgY2hhcmFjdGVyIHRoYXQgYWNjZXB0cyBhIHN1Z2dlc3Rpb24gYW5kIHR5cGVzIHRoYXQgY2hhcmFjdGVyLlwiKSB9XG5cdCkpLFxuXHRhY2NlcHRTdWdnZXN0aW9uT25FbnRlcjogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ0VudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmFjY2VwdFN1Z2dlc3Rpb25PbkVudGVyLCAnYWNjZXB0U3VnZ2VzdGlvbk9uRW50ZXInLFxuXHRcdCdvbicgYXMgJ29uJyB8ICdzbWFydCcgfCAnb2ZmJyxcblx0XHRbJ29uJywgJ3NtYXJ0JywgJ29mZiddIGFzIGNvbnN0LFxuXHRcdHtcblx0XHRcdG1hcmtkb3duRW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHQnJyxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdhY2NlcHRTdWdnZXN0aW9uT25FbnRlclNtYXJ0JywgXCJPbmx5IGFjY2VwdCBhIHN1Z2dlc3Rpb24gd2l0aCBgRW50ZXJgIHdoZW4gaXQgbWFrZXMgYSB0ZXh0dWFsIGNoYW5nZS5cIiksXG5cdFx0XHRcdCcnXG5cdFx0XHRdLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdhY2NlcHRTdWdnZXN0aW9uT25FbnRlcicsIFwiQ29udHJvbHMgd2hldGhlciBzdWdnZXN0aW9ucyBzaG91bGQgYmUgYWNjZXB0ZWQgb24gYEVudGVyYCwgaW4gYWRkaXRpb24gdG8gYFRhYmAuIEhlbHBzIHRvIGF2b2lkIGFtYmlndWl0eSBiZXR3ZWVuIGluc2VydGluZyBuZXcgbGluZXMgb3IgYWNjZXB0aW5nIHN1Z2dlc3Rpb25zLlwiKVxuXHRcdH1cblx0KSksXG5cdGFjY2Vzc2liaWxpdHlTdXBwb3J0OiByZWdpc3RlcihuZXcgRWRpdG9yQWNjZXNzaWJpbGl0eVN1cHBvcnQoKSksXG5cdGFjY2Vzc2liaWxpdHlQYWdlU2l6ZTogcmVnaXN0ZXIobmV3IEVkaXRvckludE9wdGlvbihFZGl0b3JPcHRpb24uYWNjZXNzaWJpbGl0eVBhZ2VTaXplLCAnYWNjZXNzaWJpbGl0eVBhZ2VTaXplJywgNTAwLCAxLCBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUixcblx0XHR7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5UGFnZVNpemUnLCBcIkNvbnRyb2xzIHRoZSBudW1iZXIgb2YgbGluZXMgaW4gdGhlIGVkaXRvciB0aGF0IGNhbiBiZSByZWFkIG91dCBieSBhIHNjcmVlbiByZWFkZXIgYXQgb25jZS4gV2hlbiB3ZSBkZXRlY3QgYSBzY3JlZW4gcmVhZGVyIHdlIGF1dG9tYXRpY2FsbHkgc2V0IHRoZSBkZWZhdWx0IHRvIGJlIDUwMC4gV2FybmluZzogdGhpcyBoYXMgYSBwZXJmb3JtYW5jZSBpbXBsaWNhdGlvbiBmb3IgbnVtYmVycyBsYXJnZXIgdGhhbiB0aGUgZGVmYXVsdC5cIiksXG5cdFx0XHR0YWdzOiBbJ2FjY2Vzc2liaWxpdHknXVxuXHRcdH0pKSxcblx0YXJpYUxhYmVsOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5hcmlhTGFiZWwsICdhcmlhTGFiZWwnLCBubHMubG9jYWxpemUoJ2VkaXRvclZpZXdBY2Nlc3NpYmxlTGFiZWwnLCBcIkVkaXRvciBjb250ZW50XCIpXG5cdCkpLFxuXHRhcmlhUmVxdWlyZWQ6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5hcmlhUmVxdWlyZWQsICdhcmlhUmVxdWlyZWQnLCBmYWxzZSwgdW5kZWZpbmVkXG5cdCkpLFxuXHRzY3JlZW5SZWFkZXJBbm5vdW5jZUlubGluZVN1Z2dlc3Rpb246IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5zY3JlZW5SZWFkZXJBbm5vdW5jZUlubGluZVN1Z2dlc3Rpb24sICdzY3JlZW5SZWFkZXJBbm5vdW5jZUlubGluZVN1Z2dlc3Rpb24nLCB0cnVlLFxuXHRcdHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NjcmVlblJlYWRlckFubm91bmNlSW5saW5lU3VnZ2VzdGlvbicsIFwiQ29udHJvbCB3aGV0aGVyIGlubGluZSBzdWdnZXN0aW9ucyBhcmUgYW5ub3VuY2VkIGJ5IGEgc2NyZWVuIHJlYWRlci5cIiksXG5cdFx0XHR0YWdzOiBbJ2FjY2Vzc2liaWxpdHknXVxuXHRcdH1cblx0KSksXG5cdGF1dG9DbG9zaW5nQnJhY2tldHM6IHJlZ2lzdGVyKG5ldyBFZGl0b3JTdHJpbmdFbnVtT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5hdXRvQ2xvc2luZ0JyYWNrZXRzLCAnYXV0b0Nsb3NpbmdCcmFja2V0cycsXG5cdFx0J2xhbmd1YWdlRGVmaW5lZCcgYXMgJ2Fsd2F5cycgfCAnbGFuZ3VhZ2VEZWZpbmVkJyB8ICdiZWZvcmVXaGl0ZXNwYWNlJyB8ICduZXZlcicsXG5cdFx0WydhbHdheXMnLCAnbGFuZ3VhZ2VEZWZpbmVkJywgJ2JlZm9yZVdoaXRlc3BhY2UnLCAnbmV2ZXInXSBhcyBjb25zdCxcblx0XHR7XG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5hdXRvQ2xvc2luZ0JyYWNrZXRzLmxhbmd1YWdlRGVmaW5lZCcsIFwiVXNlIGxhbmd1YWdlIGNvbmZpZ3VyYXRpb25zIHRvIGRldGVybWluZSB3aGVuIHRvIGF1dG9jbG9zZSBicmFja2V0cy5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmF1dG9DbG9zaW5nQnJhY2tldHMuYmVmb3JlV2hpdGVzcGFjZScsIFwiQXV0b2Nsb3NlIGJyYWNrZXRzIG9ubHkgd2hlbiB0aGUgY3Vyc29yIGlzIHRvIHRoZSBsZWZ0IG9mIHdoaXRlc3BhY2UuXCIpLFxuXHRcdFx0XHQnJyxcblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdhdXRvQ2xvc2luZ0JyYWNrZXRzJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBlZGl0b3Igc2hvdWxkIGF1dG9tYXRpY2FsbHkgY2xvc2UgYnJhY2tldHMgYWZ0ZXIgdGhlIHVzZXIgYWRkcyBhbiBvcGVuaW5nIGJyYWNrZXQuXCIpXG5cdFx0fVxuXHQpKSxcblx0YXV0b0Nsb3NpbmdDb21tZW50czogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ0VudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmF1dG9DbG9zaW5nQ29tbWVudHMsICdhdXRvQ2xvc2luZ0NvbW1lbnRzJyxcblx0XHQnbGFuZ3VhZ2VEZWZpbmVkJyBhcyAnYWx3YXlzJyB8ICdsYW5ndWFnZURlZmluZWQnIHwgJ2JlZm9yZVdoaXRlc3BhY2UnIHwgJ25ldmVyJyxcblx0XHRbJ2Fsd2F5cycsICdsYW5ndWFnZURlZmluZWQnLCAnYmVmb3JlV2hpdGVzcGFjZScsICduZXZlciddIGFzIGNvbnN0LFxuXHRcdHtcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmF1dG9DbG9zaW5nQ29tbWVudHMubGFuZ3VhZ2VEZWZpbmVkJywgXCJVc2UgbGFuZ3VhZ2UgY29uZmlndXJhdGlvbnMgdG8gZGV0ZXJtaW5lIHdoZW4gdG8gYXV0b2Nsb3NlIGNvbW1lbnRzLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuYXV0b0Nsb3NpbmdDb21tZW50cy5iZWZvcmVXaGl0ZXNwYWNlJywgXCJBdXRvY2xvc2UgY29tbWVudHMgb25seSB3aGVuIHRoZSBjdXJzb3IgaXMgdG8gdGhlIGxlZnQgb2Ygd2hpdGVzcGFjZS5cIiksXG5cdFx0XHRcdCcnLFxuXHRcdFx0XSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2F1dG9DbG9zaW5nQ29tbWVudHMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGVkaXRvciBzaG91bGQgYXV0b21hdGljYWxseSBjbG9zZSBjb21tZW50cyBhZnRlciB0aGUgdXNlciBhZGRzIGFuIG9wZW5pbmcgY29tbWVudC5cIilcblx0XHR9XG5cdCkpLFxuXHRhdXRvQ2xvc2luZ0RlbGV0ZTogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ0VudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmF1dG9DbG9zaW5nRGVsZXRlLCAnYXV0b0Nsb3NpbmdEZWxldGUnLFxuXHRcdCdhdXRvJyBhcyAnYWx3YXlzJyB8ICdhdXRvJyB8ICduZXZlcicsXG5cdFx0WydhbHdheXMnLCAnYXV0bycsICduZXZlciddIGFzIGNvbnN0LFxuXHRcdHtcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmF1dG9DbG9zaW5nRGVsZXRlLmF1dG8nLCBcIlJlbW92ZSBhZGphY2VudCBjbG9zaW5nIHF1b3RlcyBvciBicmFja2V0cyBvbmx5IGlmIHRoZXkgd2VyZSBhdXRvbWF0aWNhbGx5IGluc2VydGVkLlwiKSxcblx0XHRcdFx0JycsXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnYXV0b0Nsb3NpbmdEZWxldGUnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGVkaXRvciBzaG91bGQgcmVtb3ZlIGFkamFjZW50IGNsb3NpbmcgcXVvdGVzIG9yIGJyYWNrZXRzIHdoZW4gZGVsZXRpbmcuXCIpXG5cdFx0fVxuXHQpKSxcblx0YXV0b0Nsb3NpbmdPdmVydHlwZTogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ0VudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmF1dG9DbG9zaW5nT3ZlcnR5cGUsICdhdXRvQ2xvc2luZ092ZXJ0eXBlJyxcblx0XHQnYXV0bycgYXMgJ2Fsd2F5cycgfCAnYXV0bycgfCAnbmV2ZXInLFxuXHRcdFsnYWx3YXlzJywgJ2F1dG8nLCAnbmV2ZXInXSBhcyBjb25zdCxcblx0XHR7XG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5hdXRvQ2xvc2luZ092ZXJ0eXBlLmF1dG8nLCBcIlR5cGUgb3ZlciBjbG9zaW5nIHF1b3RlcyBvciBicmFja2V0cyBvbmx5IGlmIHRoZXkgd2VyZSBhdXRvbWF0aWNhbGx5IGluc2VydGVkLlwiKSxcblx0XHRcdFx0JycsXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnYXV0b0Nsb3NpbmdPdmVydHlwZScsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgZWRpdG9yIHNob3VsZCB0eXBlIG92ZXIgY2xvc2luZyBxdW90ZXMgb3IgYnJhY2tldHMuXCIpXG5cdFx0fVxuXHQpKSxcblx0YXV0b0Nsb3NpbmdRdW90ZXM6IHJlZ2lzdGVyKG5ldyBFZGl0b3JTdHJpbmdFbnVtT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5hdXRvQ2xvc2luZ1F1b3RlcywgJ2F1dG9DbG9zaW5nUXVvdGVzJyxcblx0XHQnbGFuZ3VhZ2VEZWZpbmVkJyBhcyAnYWx3YXlzJyB8ICdsYW5ndWFnZURlZmluZWQnIHwgJ2JlZm9yZVdoaXRlc3BhY2UnIHwgJ25ldmVyJyxcblx0XHRbJ2Fsd2F5cycsICdsYW5ndWFnZURlZmluZWQnLCAnYmVmb3JlV2hpdGVzcGFjZScsICduZXZlciddIGFzIGNvbnN0LFxuXHRcdHtcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmF1dG9DbG9zaW5nUXVvdGVzLmxhbmd1YWdlRGVmaW5lZCcsIFwiVXNlIGxhbmd1YWdlIGNvbmZpZ3VyYXRpb25zIHRvIGRldGVybWluZSB3aGVuIHRvIGF1dG9jbG9zZSBxdW90ZXMuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5hdXRvQ2xvc2luZ1F1b3Rlcy5iZWZvcmVXaGl0ZXNwYWNlJywgXCJBdXRvY2xvc2UgcXVvdGVzIG9ubHkgd2hlbiB0aGUgY3Vyc29yIGlzIHRvIHRoZSBsZWZ0IG9mIHdoaXRlc3BhY2UuXCIpLFxuXHRcdFx0XHQnJyxcblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdhdXRvQ2xvc2luZ1F1b3RlcycsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgZWRpdG9yIHNob3VsZCBhdXRvbWF0aWNhbGx5IGNsb3NlIHF1b3RlcyBhZnRlciB0aGUgdXNlciBhZGRzIGFuIG9wZW5pbmcgcXVvdGUuXCIpXG5cdFx0fVxuXHQpKSxcblx0YXV0b0luZGVudDogcmVnaXN0ZXIobmV3IEVkaXRvckVudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmF1dG9JbmRlbnQsICdhdXRvSW5kZW50Jyxcblx0XHRFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kuRnVsbCwgJ2Z1bGwnLFxuXHRcdFsnbm9uZScsICdrZWVwJywgJ2JyYWNrZXRzJywgJ2FkdmFuY2VkJywgJ2Z1bGwnXSxcblx0XHRfYXV0b0luZGVudEZyb21TdHJpbmcsXG5cdFx0e1xuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5hdXRvSW5kZW50Lm5vbmUnLCBcIlRoZSBlZGl0b3Igd2lsbCBub3QgaW5zZXJ0IGluZGVudGF0aW9uIGF1dG9tYXRpY2FsbHkuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5hdXRvSW5kZW50LmtlZXAnLCBcIlRoZSBlZGl0b3Igd2lsbCBrZWVwIHRoZSBjdXJyZW50IGxpbmUncyBpbmRlbnRhdGlvbi5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmF1dG9JbmRlbnQuYnJhY2tldHMnLCBcIlRoZSBlZGl0b3Igd2lsbCBrZWVwIHRoZSBjdXJyZW50IGxpbmUncyBpbmRlbnRhdGlvbiBhbmQgaG9ub3IgbGFuZ3VhZ2UgZGVmaW5lZCBicmFja2V0cy5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmF1dG9JbmRlbnQuYWR2YW5jZWQnLCBcIlRoZSBlZGl0b3Igd2lsbCBrZWVwIHRoZSBjdXJyZW50IGxpbmUncyBpbmRlbnRhdGlvbiwgaG9ub3IgbGFuZ3VhZ2UgZGVmaW5lZCBicmFja2V0cyBhbmQgaW52b2tlIHNwZWNpYWwgb25FbnRlclJ1bGVzIGRlZmluZWQgYnkgbGFuZ3VhZ2VzLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuYXV0b0luZGVudC5mdWxsJywgXCJUaGUgZWRpdG9yIHdpbGwga2VlcCB0aGUgY3VycmVudCBsaW5lJ3MgaW5kZW50YXRpb24sIGhvbm9yIGxhbmd1YWdlIGRlZmluZWQgYnJhY2tldHMsIGludm9rZSBzcGVjaWFsIG9uRW50ZXJSdWxlcyBkZWZpbmVkIGJ5IGxhbmd1YWdlcywgYW5kIGhvbm9yIGluZGVudGF0aW9uUnVsZXMgZGVmaW5lZCBieSBsYW5ndWFnZXMuXCIpLFxuXHRcdFx0XSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2F1dG9JbmRlbnQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGVkaXRvciBzaG91bGQgYXV0b21hdGljYWxseSBhZGp1c3QgdGhlIGluZGVudGF0aW9uIHdoZW4gdXNlcnMgdHlwZSwgcGFzdGUsIG1vdmUgb3IgaW5kZW50IGxpbmVzLlwiKVxuXHRcdH1cblx0KSksXG5cdGF1dG9tYXRpY0xheW91dDogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmF1dG9tYXRpY0xheW91dCwgJ2F1dG9tYXRpY0xheW91dCcsIGZhbHNlLFxuXHQpKSxcblx0YXV0b1N1cnJvdW5kOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uYXV0b1N1cnJvdW5kLCAnYXV0b1N1cnJvdW5kJyxcblx0XHQnbGFuZ3VhZ2VEZWZpbmVkJyBhcyAnbGFuZ3VhZ2VEZWZpbmVkJyB8ICdxdW90ZXMnIHwgJ2JyYWNrZXRzJyB8ICduZXZlcicsXG5cdFx0WydsYW5ndWFnZURlZmluZWQnLCAncXVvdGVzJywgJ2JyYWNrZXRzJywgJ25ldmVyJ10gYXMgY29uc3QsXG5cdFx0e1xuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5hdXRvU3Vycm91bmQubGFuZ3VhZ2VEZWZpbmVkJywgXCJVc2UgbGFuZ3VhZ2UgY29uZmlndXJhdGlvbnMgdG8gZGV0ZXJtaW5lIHdoZW4gdG8gYXV0b21hdGljYWxseSBzdXJyb3VuZCBzZWxlY3Rpb25zLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdlZGl0b3IuYXV0b1N1cnJvdW5kLnF1b3RlcycsIFwiU3Vycm91bmQgd2l0aCBxdW90ZXMgYnV0IG5vdCBicmFja2V0cy5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmF1dG9TdXJyb3VuZC5icmFja2V0cycsIFwiU3Vycm91bmQgd2l0aCBicmFja2V0cyBidXQgbm90IHF1b3Rlcy5cIiksXG5cdFx0XHRcdCcnXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnYXV0b1N1cnJvdW5kJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBlZGl0b3Igc2hvdWxkIGF1dG9tYXRpY2FsbHkgc3Vycm91bmQgc2VsZWN0aW9ucyB3aGVuIHR5cGluZyBxdW90ZXMgb3IgYnJhY2tldHMuXCIpXG5cdFx0fVxuXHQpKSxcblx0YnJhY2tldFBhaXJDb2xvcml6YXRpb246IHJlZ2lzdGVyKG5ldyBCcmFja2V0UGFpckNvbG9yaXphdGlvbigpKSxcblx0YnJhY2tldFBhaXJHdWlkZXM6IHJlZ2lzdGVyKG5ldyBHdWlkZU9wdGlvbnMoKSksXG5cdHN0aWNreVRhYlN0b3BzOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uc3RpY2t5VGFiU3RvcHMsICdzdGlja3lUYWJTdG9wcycsIGZhbHNlLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc3RpY2t5VGFiU3RvcHMnLCBcIkVtdWxhdGUgc2VsZWN0aW9uIGJlaGF2aW9yIG9mIHRhYiBjaGFyYWN0ZXJzIHdoZW4gdXNpbmcgc3BhY2VzIGZvciBpbmRlbnRhdGlvbi4gU2VsZWN0aW9uIHdpbGwgc3RpY2sgdG8gdGFiIHN0b3BzLlwiKSB9XG5cdCkpLFxuXHRjb2RlTGVuczogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmNvZGVMZW5zLCAnY29kZUxlbnMnLCB0cnVlLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29kZUxlbnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGVkaXRvciBzaG93cyBDb2RlTGVucy5cIikgfVxuXHQpKSxcblx0Y29kZUxlbnNGb250RmFtaWx5OiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5jb2RlTGVuc0ZvbnRGYW1pbHksICdjb2RlTGVuc0ZvbnRGYW1pbHknLCAnJyxcblx0XHR7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvZGVMZW5zRm9udEZhbWlseScsIFwiQ29udHJvbHMgdGhlIGZvbnQgZmFtaWx5IGZvciBDb2RlTGVucy5cIikgfVxuXHQpKSxcblx0Y29kZUxlbnNGb250U2l6ZTogcmVnaXN0ZXIobmV3IEVkaXRvckludE9wdGlvbihFZGl0b3JPcHRpb24uY29kZUxlbnNGb250U2l6ZSwgJ2NvZGVMZW5zRm9udFNpemUnLCAwLCAwLCAxMDAsIHtcblx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRkZWZhdWx0OiAwLFxuXHRcdG1pbmltdW06IDAsXG5cdFx0bWF4aW11bTogMTAwLFxuXHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29kZUxlbnNGb250U2l6ZScsIFwiQ29udHJvbHMgdGhlIGZvbnQgc2l6ZSBpbiBwaXhlbHMgZm9yIENvZGVMZW5zLiBXaGVuIHNldCB0byAwLCA5MCUgb2YgYCNlZGl0b3IuZm9udFNpemUjYCBpcyB1c2VkLlwiKVxuXHR9KSksXG5cdGNvbG9yRGVjb3JhdG9yczogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmNvbG9yRGVjb3JhdG9ycywgJ2NvbG9yRGVjb3JhdG9ycycsIHRydWUsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb2xvckRlY29yYXRvcnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGVkaXRvciBzaG91bGQgcmVuZGVyIHRoZSBpbmxpbmUgY29sb3IgZGVjb3JhdG9ycyBhbmQgY29sb3IgcGlja2VyLlwiKSB9XG5cdCkpLFxuXHRjb2xvckRlY29yYXRvckFjdGl2YXRlZE9uOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihFZGl0b3JPcHRpb24uY29sb3JEZWNvcmF0b3JzQWN0aXZhdGVkT24sICdjb2xvckRlY29yYXRvcnNBY3RpdmF0ZWRPbicsICdjbGlja0FuZEhvdmVyJyBhcyAnY2xpY2tBbmRIb3ZlcicgfCAnaG92ZXInIHwgJ2NsaWNrJywgWydjbGlja0FuZEhvdmVyJywgJ2hvdmVyJywgJ2NsaWNrJ10gYXMgY29uc3QsIHtcblx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5jb2xvckRlY29yYXRvckFjdGl2YXRlZE9uLmNsaWNrQW5kSG92ZXInLCBcIk1ha2UgdGhlIGNvbG9yIHBpY2tlciBhcHBlYXIgYm90aCBvbiBjbGljayBhbmQgaG92ZXIgb2YgdGhlIGNvbG9yIGRlY29yYXRvclwiKSxcblx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmNvbG9yRGVjb3JhdG9yQWN0aXZhdGVkT24uaG92ZXInLCBcIk1ha2UgdGhlIGNvbG9yIHBpY2tlciBhcHBlYXIgb24gaG92ZXIgb2YgdGhlIGNvbG9yIGRlY29yYXRvclwiKSxcblx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmNvbG9yRGVjb3JhdG9yQWN0aXZhdGVkT24uY2xpY2snLCBcIk1ha2UgdGhlIGNvbG9yIHBpY2tlciBhcHBlYXIgb24gY2xpY2sgb2YgdGhlIGNvbG9yIGRlY29yYXRvclwiKVxuXHRcdF0sXG5cdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29sb3JEZWNvcmF0b3JBY3RpdmF0ZWRPbicsIFwiQ29udHJvbHMgdGhlIGNvbmRpdGlvbiB0byBtYWtlIGEgY29sb3IgcGlja2VyIGFwcGVhciBmcm9tIGEgY29sb3IgZGVjb3JhdG9yLlwiKVxuXHR9KSksXG5cdGNvbG9yRGVjb3JhdG9yc0xpbWl0OiByZWdpc3RlcihuZXcgRWRpdG9ySW50T3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5jb2xvckRlY29yYXRvcnNMaW1pdCwgJ2NvbG9yRGVjb3JhdG9yc0xpbWl0JywgNTAwLCAxLCAxMDAwMDAwLFxuXHRcdHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29sb3JEZWNvcmF0b3JzTGltaXQnLCBcIkNvbnRyb2xzIHRoZSBtYXggbnVtYmVyIG9mIGNvbG9yIGRlY29yYXRvcnMgdGhhdCBjYW4gYmUgcmVuZGVyZWQgaW4gYW4gZWRpdG9yIGF0IG9uY2UuXCIpXG5cdFx0fVxuXHQpKSxcblx0Y29sdW1uU2VsZWN0aW9uOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uY29sdW1uU2VsZWN0aW9uLCAnY29sdW1uU2VsZWN0aW9uJywgZmFsc2UsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb2x1bW5TZWxlY3Rpb24nLCBcIkVuYWJsZSB0aGF0IHRoZSBzZWxlY3Rpb24gd2l0aCB0aGUgbW91c2UgYW5kIGtleXMgaXMgZG9pbmcgY29sdW1uIHNlbGVjdGlvbi5cIikgfVxuXHQpKSxcblx0Y29tbWVudHM6IHJlZ2lzdGVyKG5ldyBFZGl0b3JDb21tZW50cygpKSxcblx0Y29udGV4dG1lbnU6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5jb250ZXh0bWVudSwgJ2NvbnRleHRtZW51JywgdHJ1ZSxcblx0KSksXG5cdGNvcHlXaXRoU3ludGF4SGlnaGxpZ2h0aW5nOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uY29weVdpdGhTeW50YXhIaWdobGlnaHRpbmcsICdjb3B5V2l0aFN5bnRheEhpZ2hsaWdodGluZycsIHRydWUsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb3B5V2l0aFN5bnRheEhpZ2hsaWdodGluZycsIFwiQ29udHJvbHMgd2hldGhlciBzeW50YXggaGlnaGxpZ2h0aW5nIHNob3VsZCBiZSBjb3BpZWQgaW50byB0aGUgY2xpcGJvYXJkLlwiKSB9XG5cdCkpLFxuXHRjdXJzb3JCbGlua2luZzogcmVnaXN0ZXIobmV3IEVkaXRvckVudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmN1cnNvckJsaW5raW5nLCAnY3Vyc29yQmxpbmtpbmcnLFxuXHRcdFRleHRFZGl0b3JDdXJzb3JCbGlua2luZ1N0eWxlLkJsaW5rLCAnYmxpbmsnLFxuXHRcdFsnYmxpbmsnLCAnc21vb3RoJywgJ3BoYXNlJywgJ2V4cGFuZCcsICdzb2xpZCddLFxuXHRcdGN1cnNvckJsaW5raW5nU3R5bGVGcm9tU3RyaW5nLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY3Vyc29yQmxpbmtpbmcnLCBcIkNvbnRyb2wgdGhlIGN1cnNvciBhbmltYXRpb24gc3R5bGUuXCIpIH1cblx0KSksXG5cdGN1cnNvclNtb290aENhcmV0QW5pbWF0aW9uOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uY3Vyc29yU21vb3RoQ2FyZXRBbmltYXRpb24sICdjdXJzb3JTbW9vdGhDYXJldEFuaW1hdGlvbicsXG5cdFx0J29mZicgYXMgJ29mZicgfCAnZXhwbGljaXQnIHwgJ29uJyxcblx0XHRbJ29mZicsICdleHBsaWNpdCcsICdvbiddIGFzIGNvbnN0LFxuXHRcdHtcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdjdXJzb3JTbW9vdGhDYXJldEFuaW1hdGlvbi5vZmYnLCBcIlNtb290aCBjYXJldCBhbmltYXRpb24gaXMgZGlzYWJsZWQuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2N1cnNvclNtb290aENhcmV0QW5pbWF0aW9uLmV4cGxpY2l0JywgXCJTbW9vdGggY2FyZXQgYW5pbWF0aW9uIGlzIGVuYWJsZWQgb25seSB3aGVuIHRoZSB1c2VyIG1vdmVzIHRoZSBjdXJzb3Igd2l0aCBhbiBleHBsaWNpdCBnZXN0dXJlLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdjdXJzb3JTbW9vdGhDYXJldEFuaW1hdGlvbi5vbicsIFwiU21vb3RoIGNhcmV0IGFuaW1hdGlvbiBpcyBhbHdheXMgZW5hYmxlZC5cIilcblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjdXJzb3JTbW9vdGhDYXJldEFuaW1hdGlvbicsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgc21vb3RoIGNhcmV0IGFuaW1hdGlvbiBzaG91bGQgYmUgZW5hYmxlZC5cIilcblx0XHR9XG5cdCkpLFxuXHRjdXJzb3JTdHlsZTogcmVnaXN0ZXIobmV3IEVkaXRvckVudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmN1cnNvclN0eWxlLCAnY3Vyc29yU3R5bGUnLFxuXHRcdFRleHRFZGl0b3JDdXJzb3JTdHlsZS5MaW5lLCAnbGluZScsXG5cdFx0WydsaW5lJywgJ2Jsb2NrJywgJ3VuZGVybGluZScsICdsaW5lLXRoaW4nLCAnYmxvY2stb3V0bGluZScsICd1bmRlcmxpbmUtdGhpbiddLFxuXHRcdGN1cnNvclN0eWxlRnJvbVN0cmluZyxcblx0XHR7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2N1cnNvclN0eWxlJywgXCJDb250cm9scyB0aGUgY3Vyc29yIHN0eWxlIGluIGluc2VydCBpbnB1dCBtb2RlLlwiKSB9XG5cdCkpLFxuXHRvdmVydHlwZUN1cnNvclN0eWxlOiByZWdpc3RlcihuZXcgRWRpdG9yRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ub3ZlcnR5cGVDdXJzb3JTdHlsZSwgJ292ZXJ0eXBlQ3Vyc29yU3R5bGUnLFxuXHRcdFRleHRFZGl0b3JDdXJzb3JTdHlsZS5CbG9jaywgJ2Jsb2NrJyxcblx0XHRbJ2xpbmUnLCAnYmxvY2snLCAndW5kZXJsaW5lJywgJ2xpbmUtdGhpbicsICdibG9jay1vdXRsaW5lJywgJ3VuZGVybGluZS10aGluJ10sXG5cdFx0Y3Vyc29yU3R5bGVGcm9tU3RyaW5nLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnb3ZlcnR5cGVDdXJzb3JTdHlsZScsIFwiQ29udHJvbHMgdGhlIGN1cnNvciBzdHlsZSBpbiBvdmVydHlwZSBpbnB1dCBtb2RlLlwiKSB9XG5cdCkpLFxuXHRjdXJzb3JTdXJyb3VuZGluZ0xpbmVzOiByZWdpc3RlcihuZXcgRWRpdG9ySW50T3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5jdXJzb3JTdXJyb3VuZGluZ0xpbmVzLCAnY3Vyc29yU3Vycm91bmRpbmdMaW5lcycsXG5cdFx0MCwgMCwgQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjdXJzb3JTdXJyb3VuZGluZ0xpbmVzJywgXCJDb250cm9scyB0aGUgbWluaW1hbCBudW1iZXIgb2YgdmlzaWJsZSBsZWFkaW5nIGxpbmVzIChtaW5pbXVtIDApIGFuZCB0cmFpbGluZyBsaW5lcyAobWluaW11bSAxKSBzdXJyb3VuZGluZyB0aGUgY3Vyc29yLiBLbm93biBhcyAnc2Nyb2xsT2ZmJyBvciAnc2Nyb2xsT2Zmc2V0JyBpbiBzb21lIG90aGVyIGVkaXRvcnMuXCIpIH1cblx0KSksXG5cdGN1cnNvclN1cnJvdW5kaW5nTGluZXNTdHlsZTogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ0VudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmN1cnNvclN1cnJvdW5kaW5nTGluZXNTdHlsZSwgJ2N1cnNvclN1cnJvdW5kaW5nTGluZXNTdHlsZScsXG5cdFx0J2RlZmF1bHQnIGFzICdkZWZhdWx0JyB8ICdhbGwnLFxuXHRcdFsnZGVmYXVsdCcsICdhbGwnXSBhcyBjb25zdCxcblx0XHR7XG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnY3Vyc29yU3Vycm91bmRpbmdMaW5lc1N0eWxlLmRlZmF1bHQnLCBcImBjdXJzb3JTdXJyb3VuZGluZ0xpbmVzYCBpcyBlbmZvcmNlZCBvbmx5IHdoZW4gdHJpZ2dlcmVkIHZpYSB0aGUga2V5Ym9hcmQgb3IgQVBJLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdjdXJzb3JTdXJyb3VuZGluZ0xpbmVzU3R5bGUuYWxsJywgXCJgY3Vyc29yU3Vycm91bmRpbmdMaW5lc2AgaXMgZW5mb3JjZWQgYWx3YXlzLlwiKVxuXHRcdFx0XSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY3Vyc29yU3Vycm91bmRpbmdMaW5lc1N0eWxlJywgXCJDb250cm9scyB3aGVuIGAjZWRpdG9yLmN1cnNvclN1cnJvdW5kaW5nTGluZXMjYCBzaG91bGQgYmUgZW5mb3JjZWQuXCIpXG5cdFx0fVxuXHQpKSxcblx0Y3Vyc29yV2lkdGg6IHJlZ2lzdGVyKG5ldyBFZGl0b3JJbnRPcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmN1cnNvcldpZHRoLCAnY3Vyc29yV2lkdGgnLFxuXHRcdDAsIDAsIENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSLFxuXHRcdHsgbWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjdXJzb3JXaWR0aCcsIFwiQ29udHJvbHMgdGhlIHdpZHRoIG9mIHRoZSBjdXJzb3Igd2hlbiBgI2VkaXRvci5jdXJzb3JTdHlsZSNgIGlzIHNldCB0byBgbGluZWAuXCIpIH1cblx0KSksXG5cdGRpc2FibGVMYXllckhpbnRpbmc6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5kaXNhYmxlTGF5ZXJIaW50aW5nLCAnZGlzYWJsZUxheWVySGludGluZycsIGZhbHNlLFxuXHQpKSxcblx0ZGlzYWJsZU1vbm9zcGFjZU9wdGltaXphdGlvbnM6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5kaXNhYmxlTW9ub3NwYWNlT3B0aW1pemF0aW9ucywgJ2Rpc2FibGVNb25vc3BhY2VPcHRpbWl6YXRpb25zJywgZmFsc2Vcblx0KSksXG5cdGRvbVJlYWRPbmx5OiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uZG9tUmVhZE9ubHksICdkb21SZWFkT25seScsIGZhbHNlLFxuXHQpKSxcblx0ZHJhZ0FuZERyb3A6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5kcmFnQW5kRHJvcCwgJ2RyYWdBbmREcm9wJywgdHJ1ZSxcblx0XHR7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2RyYWdBbmREcm9wJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBlZGl0b3Igc2hvdWxkIGFsbG93IG1vdmluZyBzZWxlY3Rpb25zIHZpYSBkcmFnIGFuZCBkcm9wLlwiKSB9XG5cdCkpLFxuXHRlbXB0eVNlbGVjdGlvbkNsaXBib2FyZDogcmVnaXN0ZXIobmV3IEVkaXRvckVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkKCkpLFxuXHRkcm9wSW50b0VkaXRvcjogcmVnaXN0ZXIobmV3IEVkaXRvckRyb3BJbnRvRWRpdG9yKCkpLFxuXHRleHBlcmltZW50YWxFZGl0Q29udGV4dEVuYWJsZWQ6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5leHBlcmltZW50YWxFZGl0Q29udGV4dEVuYWJsZWQsICdleHBlcmltZW50YWxFZGl0Q29udGV4dEVuYWJsZWQnLCBwcm9kdWN0LnF1YWxpdHkgIT09ICdzdGFibGUnLFxuXHRcdHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2V4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZCcsIFwiU2V0cyB3aGV0aGVyIHRoZSBuZXcgZXhwZXJpbWVudGFsIGVkaXQgY29udGV4dCBzaG91bGQgYmUgdXNlZCBpbnN0ZWFkIG9mIHRoZSB0ZXh0IGFyZWEuXCIpLFxuXHRcdFx0aW5jbHVkZWQ6IHBsYXRmb3JtLmlzQ2hyb21lIHx8IHBsYXRmb3JtLmlzRWRnZSB8fCBwbGF0Zm9ybS5pc05hdGl2ZVxuXHRcdH1cblx0KSksXG5cdHN0aWNreVNjcm9sbDogcmVnaXN0ZXIobmV3IEVkaXRvclN0aWNreVNjcm9sbCgpKSxcblx0ZXhwZXJpbWVudGFsR3B1QWNjZWxlcmF0aW9uOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uZXhwZXJpbWVudGFsR3B1QWNjZWxlcmF0aW9uLCAnZXhwZXJpbWVudGFsR3B1QWNjZWxlcmF0aW9uJyxcblx0XHQnb2ZmJyBhcyAnb2ZmJyB8ICdvbicsXG5cdFx0WydvZmYnLCAnb24nXSBhcyBjb25zdCxcblx0XHR7XG5cdFx0XHR0YWdzOiBbJ2V4cGVyaW1lbnRhbCddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ2V4cGVyaW1lbnRhbEdwdUFjY2VsZXJhdGlvbi5vZmYnLCBcIlVzZSByZWd1bGFyIERPTS1iYXNlZCByZW5kZXJpbmcuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2V4cGVyaW1lbnRhbEdwdUFjY2VsZXJhdGlvbi5vbicsIFwiVXNlIEdQVSBhY2NlbGVyYXRpb24uXCIpLFxuXHRcdFx0XSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2V4cGVyaW1lbnRhbEdwdUFjY2VsZXJhdGlvbicsIFwiQ29udHJvbHMgd2hldGhlciB0byB1c2UgdGhlIGV4cGVyaW1lbnRhbCBHUFUgYWNjZWxlcmF0aW9uIHRvIHJlbmRlciB0aGUgZWRpdG9yLlwiKVxuXHRcdH1cblx0KSksXG5cdGV4cGVyaW1lbnRhbFdoaXRlc3BhY2VSZW5kZXJpbmc6IHJlZ2lzdGVyKG5ldyBFZGl0b3JTdHJpbmdFbnVtT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5leHBlcmltZW50YWxXaGl0ZXNwYWNlUmVuZGVyaW5nLCAnZXhwZXJpbWVudGFsV2hpdGVzcGFjZVJlbmRlcmluZycsXG5cdFx0J3N2ZycgYXMgJ3N2ZycgfCAnZm9udCcgfCAnb2ZmJyxcblx0XHRbJ3N2ZycsICdmb250JywgJ29mZiddIGFzIGNvbnN0LFxuXHRcdHtcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdleHBlcmltZW50YWxXaGl0ZXNwYWNlUmVuZGVyaW5nLnN2ZycsIFwiVXNlIGEgbmV3IHJlbmRlcmluZyBtZXRob2Qgd2l0aCBzdmdzLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdleHBlcmltZW50YWxXaGl0ZXNwYWNlUmVuZGVyaW5nLmZvbnQnLCBcIlVzZSBhIG5ldyByZW5kZXJpbmcgbWV0aG9kIHdpdGggZm9udCBjaGFyYWN0ZXJzLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdleHBlcmltZW50YWxXaGl0ZXNwYWNlUmVuZGVyaW5nLm9mZicsIFwiVXNlIHRoZSBzdGFibGUgcmVuZGVyaW5nIG1ldGhvZC5cIiksXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZXhwZXJpbWVudGFsV2hpdGVzcGFjZVJlbmRlcmluZycsIFwiQ29udHJvbHMgd2hldGhlciB3aGl0ZXNwYWNlIGlzIHJlbmRlcmVkIHdpdGggYSBuZXcsIGV4cGVyaW1lbnRhbCBtZXRob2QuXCIpXG5cdFx0fVxuXHQpKSxcblx0ZXh0cmFFZGl0b3JDbGFzc05hbWU6IHJlZ2lzdGVyKG5ldyBFZGl0b3JTdHJpbmdPcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmV4dHJhRWRpdG9yQ2xhc3NOYW1lLCAnZXh0cmFFZGl0b3JDbGFzc05hbWUnLCAnJyxcblx0KSksXG5cdGZhc3RTY3JvbGxTZW5zaXRpdml0eTogcmVnaXN0ZXIobmV3IEVkaXRvckZsb2F0T3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5mYXN0U2Nyb2xsU2Vuc2l0aXZpdHksICdmYXN0U2Nyb2xsU2Vuc2l0aXZpdHknLFxuXHRcdDUsIHggPT4gKHggPD0gMCA/IDUgOiB4KSxcblx0XHR7IG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZmFzdFNjcm9sbFNlbnNpdGl2aXR5JywgXCJTY3JvbGxpbmcgc3BlZWQgbXVsdGlwbGllciB3aGVuIHByZXNzaW5nIGBBbHRgLlwiKSB9XG5cdCkpLFxuXHRmaW5kOiByZWdpc3RlcihuZXcgRWRpdG9yRmluZCgpKSxcblx0Zml4ZWRPdmVyZmxvd1dpZGdldHM6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5maXhlZE92ZXJmbG93V2lkZ2V0cywgJ2ZpeGVkT3ZlcmZsb3dXaWRnZXRzJywgZmFsc2UsXG5cdCkpLFxuXHRmb2xkaW5nOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uZm9sZGluZywgJ2ZvbGRpbmcnLCB0cnVlLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZm9sZGluZycsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgZWRpdG9yIGhhcyBjb2RlIGZvbGRpbmcgZW5hYmxlZC5cIikgfVxuXHQpKSxcblx0Zm9sZGluZ1N0cmF0ZWd5OiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uZm9sZGluZ1N0cmF0ZWd5LCAnZm9sZGluZ1N0cmF0ZWd5Jyxcblx0XHQnYXV0bycgYXMgJ2F1dG8nIHwgJ2luZGVudGF0aW9uJyxcblx0XHRbJ2F1dG8nLCAnaW5kZW50YXRpb24nXSBhcyBjb25zdCxcblx0XHR7XG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZm9sZGluZ1N0cmF0ZWd5LmF1dG8nLCBcIlVzZSBhIGxhbmd1YWdlLXNwZWNpZmljIGZvbGRpbmcgc3RyYXRlZ3kgaWYgYXZhaWxhYmxlLCBlbHNlIHRoZSBpbmRlbnRhdGlvbi1iYXNlZCBvbmUuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2ZvbGRpbmdTdHJhdGVneS5pbmRlbnRhdGlvbicsIFwiVXNlIHRoZSBpbmRlbnRhdGlvbi1iYXNlZCBmb2xkaW5nIHN0cmF0ZWd5LlwiKSxcblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdmb2xkaW5nU3RyYXRlZ3knLCBcIkNvbnRyb2xzIHRoZSBzdHJhdGVneSBmb3IgY29tcHV0aW5nIGZvbGRpbmcgcmFuZ2VzLlwiKVxuXHRcdH1cblx0KSksXG5cdGZvbGRpbmdIaWdobGlnaHQ6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5mb2xkaW5nSGlnaGxpZ2h0LCAnZm9sZGluZ0hpZ2hsaWdodCcsIHRydWUsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdmb2xkaW5nSGlnaGxpZ2h0JywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBlZGl0b3Igc2hvdWxkIGhpZ2hsaWdodCBmb2xkZWQgcmFuZ2VzLlwiKSB9XG5cdCkpLFxuXHRmb2xkaW5nSW1wb3J0c0J5RGVmYXVsdDogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmZvbGRpbmdJbXBvcnRzQnlEZWZhdWx0LCAnZm9sZGluZ0ltcG9ydHNCeURlZmF1bHQnLCBmYWxzZSxcblx0XHR7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2ZvbGRpbmdJbXBvcnRzQnlEZWZhdWx0JywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBlZGl0b3IgYXV0b21hdGljYWxseSBjb2xsYXBzZXMgaW1wb3J0IHJhbmdlcy5cIikgfVxuXHQpKSxcblx0Zm9sZGluZ01heGltdW1SZWdpb25zOiByZWdpc3RlcihuZXcgRWRpdG9ySW50T3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5mb2xkaW5nTWF4aW11bVJlZ2lvbnMsICdmb2xkaW5nTWF4aW11bVJlZ2lvbnMnLFxuXHRcdDUwMDAsIDEwLCA2NTAwMCwgLy8gbGltaXQgbXVzdCBiZSBsZXNzIHRoYW4gZm9sZGluZ1JhbmdlcyBNQVhfRk9MRElOR19SRUdJT05TXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdmb2xkaW5nTWF4aW11bVJlZ2lvbnMnLCBcIlRoZSBtYXhpbXVtIG51bWJlciBvZiBmb2xkYWJsZSByZWdpb25zLiBJbmNyZWFzaW5nIHRoaXMgdmFsdWUgbWF5IHJlc3VsdCBpbiB0aGUgZWRpdG9yIGJlY29taW5nIGxlc3MgcmVzcG9uc2l2ZSB3aGVuIHRoZSBjdXJyZW50IHNvdXJjZSBoYXMgYSBsYXJnZSBudW1iZXIgb2YgZm9sZGFibGUgcmVnaW9ucy5cIikgfVxuXHQpKSxcblx0dW5mb2xkT25DbGlja0FmdGVyRW5kT2ZMaW5lOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24udW5mb2xkT25DbGlja0FmdGVyRW5kT2ZMaW5lLCAndW5mb2xkT25DbGlja0FmdGVyRW5kT2ZMaW5lJywgZmFsc2UsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd1bmZvbGRPbkNsaWNrQWZ0ZXJFbmRPZkxpbmUnLCBcIkNvbnRyb2xzIHdoZXRoZXIgY2xpY2tpbmcgb24gdGhlIGVtcHR5IGNvbnRlbnQgYWZ0ZXIgYSBmb2xkZWQgbGluZSB3aWxsIHVuZm9sZCB0aGUgbGluZS5cIikgfVxuXHQpKSxcblx0Zm9udEZhbWlseTogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ09wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uZm9udEZhbWlseSwgJ2ZvbnRGYW1pbHknLCBFRElUT1JfRk9OVF9ERUZBVUxUUy5mb250RmFtaWx5LFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZm9udEZhbWlseScsIFwiQ29udHJvbHMgdGhlIGZvbnQgZmFtaWx5LlwiKSB9XG5cdCkpLFxuXHRmb250SW5mbzogcmVnaXN0ZXIobmV3IEVkaXRvckZvbnRJbmZvKCkpLFxuXHRmb250TGlnYXR1cmVzMjogcmVnaXN0ZXIobmV3IEVkaXRvckZvbnRMaWdhdHVyZXMoKSksXG5cdGZvbnRTaXplOiByZWdpc3RlcihuZXcgRWRpdG9yRm9udFNpemUoKSksXG5cdGZvbnRXZWlnaHQ6IHJlZ2lzdGVyKG5ldyBFZGl0b3JGb250V2VpZ2h0KCkpLFxuXHRmb250VmFyaWF0aW9uczogcmVnaXN0ZXIobmV3IEVkaXRvckZvbnRWYXJpYXRpb25zKCkpLFxuXHRmb3JtYXRPblBhc3RlOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uZm9ybWF0T25QYXN0ZSwgJ2Zvcm1hdE9uUGFzdGUnLCBmYWxzZSxcblx0XHR7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2Zvcm1hdE9uUGFzdGUnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGVkaXRvciBzaG91bGQgYXV0b21hdGljYWxseSBmb3JtYXQgdGhlIHBhc3RlZCBjb250ZW50LiBBIGZvcm1hdHRlciBtdXN0IGJlIGF2YWlsYWJsZSBhbmQgdGhlIGZvcm1hdHRlciBzaG91bGQgYmUgYWJsZSB0byBmb3JtYXQgYSByYW5nZSBpbiBhIGRvY3VtZW50LlwiKSB9XG5cdCkpLFxuXHRmb3JtYXRPblR5cGU6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5mb3JtYXRPblR5cGUsICdmb3JtYXRPblR5cGUnLCBmYWxzZSxcblx0XHR7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2Zvcm1hdE9uVHlwZScsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgZWRpdG9yIHNob3VsZCBhdXRvbWF0aWNhbGx5IGZvcm1hdCB0aGUgbGluZSBhZnRlciB0eXBpbmcuXCIpIH1cblx0KSksXG5cdGdseXBoTWFyZ2luOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uZ2x5cGhNYXJnaW4sICdnbHlwaE1hcmdpbicsIHRydWUsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdnbHlwaE1hcmdpbicsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgZWRpdG9yIHNob3VsZCByZW5kZXIgdGhlIHZlcnRpY2FsIGdseXBoIG1hcmdpbi4gR2x5cGggbWFyZ2luIGlzIG1vc3RseSB1c2VkIGZvciBkZWJ1Z2dpbmcuXCIpIH1cblx0KSksXG5cdGdvdG9Mb2NhdGlvbjogcmVnaXN0ZXIobmV3IEVkaXRvckdvVG9Mb2NhdGlvbigpKSxcblx0aGlkZUN1cnNvckluT3ZlcnZpZXdSdWxlcjogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmhpZGVDdXJzb3JJbk92ZXJ2aWV3UnVsZXIsICdoaWRlQ3Vyc29ySW5PdmVydmlld1J1bGVyJywgZmFsc2UsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdoaWRlQ3Vyc29ySW5PdmVydmlld1J1bGVyJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBjdXJzb3Igc2hvdWxkIGJlIGhpZGRlbiBpbiB0aGUgb3ZlcnZpZXcgcnVsZXIuXCIpIH1cblx0KSksXG5cdGhvdmVyOiByZWdpc3RlcihuZXcgRWRpdG9ySG92ZXIoKSksXG5cdGluRGlmZkVkaXRvcjogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmluRGlmZkVkaXRvciwgJ2luRGlmZkVkaXRvcicsIGZhbHNlXG5cdCkpLFxuXHRsZXR0ZXJTcGFjaW5nOiByZWdpc3RlcihuZXcgRWRpdG9yRmxvYXRPcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmxldHRlclNwYWNpbmcsICdsZXR0ZXJTcGFjaW5nJyxcblx0XHRFRElUT1JfRk9OVF9ERUZBVUxUUy5sZXR0ZXJTcGFjaW5nLCB4ID0+IEVkaXRvckZsb2F0T3B0aW9uLmNsYW1wKHgsIC01LCAyMCksXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdsZXR0ZXJTcGFjaW5nJywgXCJDb250cm9scyB0aGUgbGV0dGVyIHNwYWNpbmcgaW4gcGl4ZWxzLlwiKSB9XG5cdCkpLFxuXHRsaWdodGJ1bGI6IHJlZ2lzdGVyKG5ldyBFZGl0b3JMaWdodGJ1bGIoKSksXG5cdGxpbmVEZWNvcmF0aW9uc1dpZHRoOiByZWdpc3RlcihuZXcgRWRpdG9yTGluZURlY29yYXRpb25zV2lkdGgoKSksXG5cdGxpbmVIZWlnaHQ6IHJlZ2lzdGVyKG5ldyBFZGl0b3JMaW5lSGVpZ2h0KCkpLFxuXHRsaW5lTnVtYmVyczogcmVnaXN0ZXIobmV3IEVkaXRvclJlbmRlckxpbmVOdW1iZXJzT3B0aW9uKCkpLFxuXHRsaW5lTnVtYmVyc01pbkNoYXJzOiByZWdpc3RlcihuZXcgRWRpdG9ySW50T3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5saW5lTnVtYmVyc01pbkNoYXJzLCAnbGluZU51bWJlcnNNaW5DaGFycycsXG5cdFx0NSwgMSwgMzAwXG5cdCkpLFxuXHRsaW5rZWRFZGl0aW5nOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ubGlua2VkRWRpdGluZywgJ2xpbmtlZEVkaXRpbmcnLCBmYWxzZSxcblx0XHR7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2xpbmtlZEVkaXRpbmcnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGVkaXRvciBoYXMgbGlua2VkIGVkaXRpbmcgZW5hYmxlZC4gRGVwZW5kaW5nIG9uIHRoZSBsYW5ndWFnZSwgcmVsYXRlZCBzeW1ib2xzIHN1Y2ggYXMgSFRNTCB0YWdzLCBhcmUgdXBkYXRlZCB3aGlsZSBlZGl0aW5nLlwiKSB9XG5cdCkpLFxuXHRsaW5rczogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmxpbmtzLCAnbGlua3MnLCB0cnVlLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbGlua3MnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGVkaXRvciBzaG91bGQgZGV0ZWN0IGxpbmtzIGFuZCBtYWtlIHRoZW0gY2xpY2thYmxlLlwiKSB9XG5cdCkpLFxuXHRtYXRjaEJyYWNrZXRzOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ubWF0Y2hCcmFja2V0cywgJ21hdGNoQnJhY2tldHMnLFxuXHRcdCdhbHdheXMnIGFzICduZXZlcicgfCAnbmVhcicgfCAnYWx3YXlzJyxcblx0XHRbJ2Fsd2F5cycsICduZWFyJywgJ25ldmVyJ10gYXMgY29uc3QsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdtYXRjaEJyYWNrZXRzJywgXCJIaWdobGlnaHQgbWF0Y2hpbmcgYnJhY2tldHMuXCIpIH1cblx0KSksXG5cdG1pbmltYXA6IHJlZ2lzdGVyKG5ldyBFZGl0b3JNaW5pbWFwKCkpLFxuXHRtb3VzZVN0eWxlOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ubW91c2VTdHlsZSwgJ21vdXNlU3R5bGUnLFxuXHRcdCd0ZXh0JyBhcyAndGV4dCcgfCAnZGVmYXVsdCcgfCAnY29weScsXG5cdFx0Wyd0ZXh0JywgJ2RlZmF1bHQnLCAnY29weSddIGFzIGNvbnN0LFxuXHQpKSxcblx0bW91c2VXaGVlbFNjcm9sbFNlbnNpdGl2aXR5OiByZWdpc3RlcihuZXcgRWRpdG9yRmxvYXRPcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLm1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eSwgJ21vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eScsXG5cdFx0MSwgeCA9PiAoeCA9PT0gMCA/IDEgOiB4KSxcblx0XHR7IG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbW91c2VXaGVlbFNjcm9sbFNlbnNpdGl2aXR5JywgXCJBIG11bHRpcGxpZXIgdG8gYmUgdXNlZCBvbiB0aGUgYGRlbHRhWGAgYW5kIGBkZWx0YVlgIG9mIG1vdXNlIHdoZWVsIHNjcm9sbCBldmVudHMuXCIpIH1cblx0KSksXG5cdG1vdXNlV2hlZWxab29tOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ubW91c2VXaGVlbFpvb20sICdtb3VzZVdoZWVsWm9vbScsIGZhbHNlLFxuXHRcdHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IHBsYXRmb3JtLmlzTWFjaW50b3NoXG5cdFx0XHRcdD8gbmxzLmxvY2FsaXplKCdtb3VzZVdoZWVsWm9vbS5tYWMnLCBcIlpvb20gdGhlIGZvbnQgb2YgdGhlIGVkaXRvciB3aGVuIHVzaW5nIG1vdXNlIHdoZWVsIGFuZCBob2xkaW5nIGBDbWRgLlwiKVxuXHRcdFx0XHQ6IG5scy5sb2NhbGl6ZSgnbW91c2VXaGVlbFpvb20nLCBcIlpvb20gdGhlIGZvbnQgb2YgdGhlIGVkaXRvciB3aGVuIHVzaW5nIG1vdXNlIHdoZWVsIGFuZCBob2xkaW5nIGBDdHJsYC5cIilcblx0XHR9XG5cdCkpLFxuXHRtdWx0aUN1cnNvck1lcmdlT3ZlcmxhcHBpbmc6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5tdWx0aUN1cnNvck1lcmdlT3ZlcmxhcHBpbmcsICdtdWx0aUN1cnNvck1lcmdlT3ZlcmxhcHBpbmcnLCB0cnVlLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbXVsdGlDdXJzb3JNZXJnZU92ZXJsYXBwaW5nJywgXCJNZXJnZSBtdWx0aXBsZSBjdXJzb3JzIHdoZW4gdGhleSBhcmUgb3ZlcmxhcHBpbmcuXCIpIH1cblx0KSksXG5cdG11bHRpQ3Vyc29yTW9kaWZpZXI6IHJlZ2lzdGVyKG5ldyBFZGl0b3JFbnVtT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5tdWx0aUN1cnNvck1vZGlmaWVyLCAnbXVsdGlDdXJzb3JNb2RpZmllcicsXG5cdFx0J2FsdEtleScsICdhbHQnLFxuXHRcdFsnY3RybENtZCcsICdhbHQnXSxcblx0XHRfbXVsdGlDdXJzb3JNb2RpZmllckZyb21TdHJpbmcsXG5cdFx0e1xuXHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnbXVsdGlDdXJzb3JNb2RpZmllci5jdHJsQ21kJywgXCJNYXBzIHRvIGBDb250cm9sYCBvbiBXaW5kb3dzIGFuZCBMaW51eCBhbmQgdG8gYENvbW1hbmRgIG9uIG1hY09TLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdtdWx0aUN1cnNvck1vZGlmaWVyLmFsdCcsIFwiTWFwcyB0byBgQWx0YCBvbiBXaW5kb3dzIGFuZCBMaW51eCBhbmQgdG8gYE9wdGlvbmAgb24gbWFjT1MuXCIpXG5cdFx0XHRdLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKHtcblx0XHRcdFx0a2V5OiAnbXVsdGlDdXJzb3JNb2RpZmllcicsXG5cdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHQnLSBgY3RybENtZGAgcmVmZXJzIHRvIGEgdmFsdWUgdGhlIHNldHRpbmcgY2FuIHRha2UgYW5kIHNob3VsZCBub3QgYmUgbG9jYWxpemVkLicsXG5cdFx0XHRcdFx0Jy0gYENvbnRyb2xgIGFuZCBgQ29tbWFuZGAgcmVmZXIgdG8gdGhlIG1vZGlmaWVyIGtleXMgQ3RybCBvciBDbWQgb24gdGhlIGtleWJvYXJkIGFuZCBjYW4gYmUgbG9jYWxpemVkLidcblx0XHRcdFx0XVxuXHRcdFx0fSwgXCJUaGUgbW9kaWZpZXIgdG8gYmUgdXNlZCB0byBhZGQgbXVsdGlwbGUgY3Vyc29ycyB3aXRoIHRoZSBtb3VzZS4gVGhlIEdvIHRvIERlZmluaXRpb24gYW5kIE9wZW4gTGluayBtb3VzZSBnZXN0dXJlcyB3aWxsIGFkYXB0IHN1Y2ggdGhhdCB0aGV5IGRvIG5vdCBjb25mbGljdCB3aXRoIHRoZSBbbXVsdGljdXJzb3IgbW9kaWZpZXJdKGh0dHBzOi8vY29kZS52aXN1YWxzdHVkaW8uY29tL2RvY3MvZWRpdG9yL2NvZGViYXNpY3MjX211bHRpY3Vyc29yLW1vZGlmaWVyKS5cIilcblx0XHR9XG5cdCkpLFxuXHRtdWx0aUN1cnNvclBhc3RlOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ubXVsdGlDdXJzb3JQYXN0ZSwgJ211bHRpQ3Vyc29yUGFzdGUnLFxuXHRcdCdzcHJlYWQnIGFzICdzcHJlYWQnIHwgJ2Z1bGwnLFxuXHRcdFsnc3ByZWFkJywgJ2Z1bGwnXSBhcyBjb25zdCxcblx0XHR7XG5cdFx0XHRtYXJrZG93bkVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdtdWx0aUN1cnNvclBhc3RlLnNwcmVhZCcsIFwiRWFjaCBjdXJzb3IgcGFzdGVzIGEgc2luZ2xlIGxpbmUgb2YgdGhlIHRleHQuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ211bHRpQ3Vyc29yUGFzdGUuZnVsbCcsIFwiRWFjaCBjdXJzb3IgcGFzdGVzIHRoZSBmdWxsIHRleHQuXCIpXG5cdFx0XHRdLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdtdWx0aUN1cnNvclBhc3RlJywgXCJDb250cm9scyBwYXN0aW5nIHdoZW4gdGhlIGxpbmUgY291bnQgb2YgdGhlIHBhc3RlZCB0ZXh0IG1hdGNoZXMgdGhlIGN1cnNvciBjb3VudC5cIilcblx0XHR9XG5cdCkpLFxuXHRtdWx0aUN1cnNvckxpbWl0OiByZWdpc3RlcihuZXcgRWRpdG9ySW50T3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5tdWx0aUN1cnNvckxpbWl0LCAnbXVsdGlDdXJzb3JMaW1pdCcsIDEwMDAwLCAxLCAxMDAwMDAsXG5cdFx0e1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdtdWx0aUN1cnNvckxpbWl0JywgXCJDb250cm9scyB0aGUgbWF4IG51bWJlciBvZiBjdXJzb3JzIHRoYXQgY2FuIGJlIGluIGFuIGFjdGl2ZSBlZGl0b3IgYXQgb25jZS5cIilcblx0XHR9XG5cdCkpLFxuXHRvY2N1cnJlbmNlc0hpZ2hsaWdodDogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ0VudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLm9jY3VycmVuY2VzSGlnaGxpZ2h0LCAnb2NjdXJyZW5jZXNIaWdobGlnaHQnLFxuXHRcdCdzaW5nbGVGaWxlJyBhcyAnb2ZmJyB8ICdzaW5nbGVGaWxlJyB8ICdtdWx0aUZpbGUnLFxuXHRcdFsnb2ZmJywgJ3NpbmdsZUZpbGUnLCAnbXVsdGlGaWxlJ10gYXMgY29uc3QsXG5cdFx0e1xuXHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnb2NjdXJyZW5jZXNIaWdobGlnaHQub2ZmJywgXCJEb2VzIG5vdCBoaWdobGlnaHQgb2NjdXJyZW5jZXMuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ29jY3VycmVuY2VzSGlnaGxpZ2h0LnNpbmdsZUZpbGUnLCBcIkhpZ2hsaWdodHMgb2NjdXJyZW5jZXMgb25seSBpbiB0aGUgY3VycmVudCBmaWxlLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdvY2N1cnJlbmNlc0hpZ2hsaWdodC5tdWx0aUZpbGUnLCBcIkV4cGVyaW1lbnRhbDogSGlnaGxpZ2h0cyBvY2N1cnJlbmNlcyBhY3Jvc3MgYWxsIHZhbGlkIG9wZW4gZmlsZXMuXCIpXG5cdFx0XHRdLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdvY2N1cnJlbmNlc0hpZ2hsaWdodCcsIFwiQ29udHJvbHMgd2hldGhlciBvY2N1cnJlbmNlcyBzaG91bGQgYmUgaGlnaGxpZ2h0ZWQgYWNyb3NzIG9wZW4gZmlsZXMuXCIpXG5cdFx0fVxuXHQpKSxcblx0b2NjdXJyZW5jZXNIaWdobGlnaHREZWxheTogcmVnaXN0ZXIobmV3IEVkaXRvckludE9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ub2NjdXJyZW5jZXNIaWdobGlnaHREZWxheSwgJ29jY3VycmVuY2VzSGlnaGxpZ2h0RGVsYXknLFxuXHRcdDAsIDAsIDIwMDAsXG5cdFx0e1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnb2NjdXJyZW5jZXNIaWdobGlnaHREZWxheScsIFwiQ29udHJvbHMgdGhlIGRlbGF5IGluIG1pbGxpc2Vjb25kcyBhZnRlciB3aGljaCBvY2N1cnJlbmNlcyBhcmUgaGlnaGxpZ2h0ZWQuXCIpLFxuXHRcdFx0dGFnczogWydwcmV2aWV3J11cblx0XHR9XG5cdCkpLFxuXHRvdmVydHlwZU9uUGFzdGU6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5vdmVydHlwZU9uUGFzdGUsICdvdmVydHlwZU9uUGFzdGUnLCB0cnVlLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnb3ZlcnR5cGVPblBhc3RlJywgXCJDb250cm9scyB3aGV0aGVyIHBhc3Rpbmcgc2hvdWxkIG92ZXJ0eXBlLlwiKSB9XG5cdCkpLFxuXHRvdmVydmlld1J1bGVyQm9yZGVyOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ub3ZlcnZpZXdSdWxlckJvcmRlciwgJ292ZXJ2aWV3UnVsZXJCb3JkZXInLCB0cnVlLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnb3ZlcnZpZXdSdWxlckJvcmRlcicsIFwiQ29udHJvbHMgd2hldGhlciBhIGJvcmRlciBzaG91bGQgYmUgZHJhd24gYXJvdW5kIHRoZSBvdmVydmlldyBydWxlci5cIikgfVxuXHQpKSxcblx0b3ZlcnZpZXdSdWxlckxhbmVzOiByZWdpc3RlcihuZXcgRWRpdG9ySW50T3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5vdmVydmlld1J1bGVyTGFuZXMsICdvdmVydmlld1J1bGVyTGFuZXMnLFxuXHRcdDMsIDAsIDNcblx0KSksXG5cdHBhZGRpbmc6IHJlZ2lzdGVyKG5ldyBFZGl0b3JQYWRkaW5nKCkpLFxuXHRwYXN0ZUFzOiByZWdpc3RlcihuZXcgRWRpdG9yUGFzdGVBcygpKSxcblx0cGFyYW1ldGVySGludHM6IHJlZ2lzdGVyKG5ldyBFZGl0b3JQYXJhbWV0ZXJIaW50cygpKSxcblx0cGVla1dpZGdldERlZmF1bHRGb2N1czogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ0VudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnBlZWtXaWRnZXREZWZhdWx0Rm9jdXMsICdwZWVrV2lkZ2V0RGVmYXVsdEZvY3VzJyxcblx0XHQndHJlZScgYXMgJ3RyZWUnIHwgJ2VkaXRvcicsXG5cdFx0Wyd0cmVlJywgJ2VkaXRvciddIGFzIGNvbnN0LFxuXHRcdHtcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdwZWVrV2lkZ2V0RGVmYXVsdEZvY3VzLnRyZWUnLCBcIkZvY3VzIHRoZSB0cmVlIHdoZW4gb3BlbmluZyBwZWVrXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3BlZWtXaWRnZXREZWZhdWx0Rm9jdXMuZWRpdG9yJywgXCJGb2N1cyB0aGUgZWRpdG9yIHdoZW4gb3BlbmluZyBwZWVrXCIpXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncGVla1dpZGdldERlZmF1bHRGb2N1cycsIFwiQ29udHJvbHMgd2hldGhlciB0byBmb2N1cyB0aGUgaW5saW5lIGVkaXRvciBvciB0aGUgdHJlZSBpbiB0aGUgcGVlayB3aWRnZXQuXCIpXG5cdFx0fVxuXHQpKSxcblx0cGxhY2Vob2xkZXI6IHJlZ2lzdGVyKG5ldyBQbGFjZWhvbGRlck9wdGlvbigpKSxcblx0ZGVmaW5pdGlvbkxpbmtPcGVuc0luUGVlazogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLmRlZmluaXRpb25MaW5rT3BlbnNJblBlZWssICdkZWZpbml0aW9uTGlua09wZW5zSW5QZWVrJywgZmFsc2UsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdkZWZpbml0aW9uTGlua09wZW5zSW5QZWVrJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBHbyB0byBEZWZpbml0aW9uIG1vdXNlIGdlc3R1cmUgYWx3YXlzIG9wZW5zIHRoZSBwZWVrIHdpZGdldC5cIikgfVxuXHQpKSxcblx0cXVpY2tTdWdnZXN0aW9uczogcmVnaXN0ZXIobmV3IEVkaXRvclF1aWNrU3VnZ2VzdGlvbnMoKSksXG5cdHF1aWNrU3VnZ2VzdGlvbnNEZWxheTogcmVnaXN0ZXIobmV3IEVkaXRvckludE9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ucXVpY2tTdWdnZXN0aW9uc0RlbGF5LCAncXVpY2tTdWdnZXN0aW9uc0RlbGF5Jyxcblx0XHQxMCwgMCwgQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdxdWlja1N1Z2dlc3Rpb25zRGVsYXknLCBcIkNvbnRyb2xzIHRoZSBkZWxheSBpbiBtaWxsaXNlY29uZHMgYWZ0ZXIgd2hpY2ggcXVpY2sgc3VnZ2VzdGlvbnMgd2lsbCBzaG93IHVwLlwiKSB9XG5cdCkpLFxuXHRyZWFkT25seTogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnJlYWRPbmx5LCAncmVhZE9ubHknLCBmYWxzZSxcblx0KSksXG5cdHJlYWRPbmx5TWVzc2FnZTogcmVnaXN0ZXIobmV3IFJlYWRvbmx5TWVzc2FnZSgpKSxcblx0cmVuYW1lT25UeXBlOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ucmVuYW1lT25UeXBlLCAncmVuYW1lT25UeXBlJywgZmFsc2UsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdyZW5hbWVPblR5cGUnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGVkaXRvciBhdXRvIHJlbmFtZXMgb24gdHlwZS5cIiksIG1hcmtkb3duRGVwcmVjYXRpb25NZXNzYWdlOiBubHMubG9jYWxpemUoJ3JlbmFtZU9uVHlwZURlcHJlY2F0ZScsIFwiRGVwcmVjYXRlZCwgdXNlIGBlZGl0b3IubGlua2VkRWRpdGluZ2AgaW5zdGVhZC5cIikgfVxuXHQpKSxcblx0cmVuZGVyQ29udHJvbENoYXJhY3RlcnM6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5yZW5kZXJDb250cm9sQ2hhcmFjdGVycywgJ3JlbmRlckNvbnRyb2xDaGFyYWN0ZXJzJywgdHJ1ZSxcblx0XHR7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3JlbmRlckNvbnRyb2xDaGFyYWN0ZXJzJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBlZGl0b3Igc2hvdWxkIHJlbmRlciBjb250cm9sIGNoYXJhY3RlcnMuXCIpLCByZXN0cmljdGVkOiB0cnVlIH1cblx0KSksXG5cdHJlbmRlckZpbmFsTmV3bGluZTogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ0VudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnJlbmRlckZpbmFsTmV3bGluZSwgJ3JlbmRlckZpbmFsTmV3bGluZScsXG5cdFx0KHBsYXRmb3JtLmlzTGludXggPyAnZGltbWVkJyA6ICdvbicpIGFzICdvZmYnIHwgJ29uJyB8ICdkaW1tZWQnLFxuXHRcdFsnb2ZmJywgJ29uJywgJ2RpbW1lZCddIGFzIGNvbnN0LFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncmVuZGVyRmluYWxOZXdsaW5lJywgXCJSZW5kZXIgbGFzdCBsaW5lIG51bWJlciB3aGVuIHRoZSBmaWxlIGVuZHMgd2l0aCBhIG5ld2xpbmUuXCIpIH1cblx0KSksXG5cdHJlbmRlckxpbmVIaWdobGlnaHQ6IHJlZ2lzdGVyKG5ldyBFZGl0b3JTdHJpbmdFbnVtT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5yZW5kZXJMaW5lSGlnaGxpZ2h0LCAncmVuZGVyTGluZUhpZ2hsaWdodCcsXG5cdFx0J2xpbmUnIGFzICdub25lJyB8ICdndXR0ZXInIHwgJ2xpbmUnIHwgJ2FsbCcsXG5cdFx0Wydub25lJywgJ2d1dHRlcicsICdsaW5lJywgJ2FsbCddIGFzIGNvbnN0LFxuXHRcdHtcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdyZW5kZXJMaW5lSGlnaGxpZ2h0LmFsbCcsIFwiSGlnaGxpZ2h0cyBib3RoIHRoZSBndXR0ZXIgYW5kIHRoZSBjdXJyZW50IGxpbmUuXCIpLFxuXHRcdFx0XSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3JlbmRlckxpbmVIaWdobGlnaHQnLCBcIkNvbnRyb2xzIGhvdyB0aGUgZWRpdG9yIHNob3VsZCByZW5kZXIgdGhlIGN1cnJlbnQgbGluZSBoaWdobGlnaHQuXCIpXG5cdFx0fVxuXHQpKSxcblx0cmVuZGVyTGluZUhpZ2hsaWdodE9ubHlXaGVuRm9jdXM6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5yZW5kZXJMaW5lSGlnaGxpZ2h0T25seVdoZW5Gb2N1cywgJ3JlbmRlckxpbmVIaWdobGlnaHRPbmx5V2hlbkZvY3VzJywgZmFsc2UsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdyZW5kZXJMaW5lSGlnaGxpZ2h0T25seVdoZW5Gb2N1cycsIFwiQ29udHJvbHMgaWYgdGhlIGVkaXRvciBzaG91bGQgcmVuZGVyIHRoZSBjdXJyZW50IGxpbmUgaGlnaGxpZ2h0IG9ubHkgd2hlbiB0aGUgZWRpdG9yIGlzIGZvY3VzZWQuXCIpIH1cblx0KSksXG5cdHJlbmRlclZhbGlkYXRpb25EZWNvcmF0aW9uczogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ0VudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnJlbmRlclZhbGlkYXRpb25EZWNvcmF0aW9ucywgJ3JlbmRlclZhbGlkYXRpb25EZWNvcmF0aW9ucycsXG5cdFx0J2VkaXRhYmxlJyBhcyAnZWRpdGFibGUnIHwgJ29uJyB8ICdvZmYnLFxuXHRcdFsnZWRpdGFibGUnLCAnb24nLCAnb2ZmJ10gYXMgY29uc3Rcblx0KSksXG5cdHJlbmRlcldoaXRlc3BhY2U6IHJlZ2lzdGVyKG5ldyBFZGl0b3JTdHJpbmdFbnVtT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5yZW5kZXJXaGl0ZXNwYWNlLCAncmVuZGVyV2hpdGVzcGFjZScsXG5cdFx0J3NlbGVjdGlvbicgYXMgJ3NlbGVjdGlvbicgfCAnbm9uZScgfCAnYm91bmRhcnknIHwgJ3RyYWlsaW5nJyB8ICdhbGwnLFxuXHRcdFsnbm9uZScsICdib3VuZGFyeScsICdzZWxlY3Rpb24nLCAndHJhaWxpbmcnLCAnYWxsJ10gYXMgY29uc3QsXG5cdFx0e1xuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHQnJyxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdyZW5kZXJXaGl0ZXNwYWNlLmJvdW5kYXJ5JywgXCJSZW5kZXIgd2hpdGVzcGFjZSBjaGFyYWN0ZXJzIGV4Y2VwdCBmb3Igc2luZ2xlIHNwYWNlcyBiZXR3ZWVuIHdvcmRzLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdyZW5kZXJXaGl0ZXNwYWNlLnNlbGVjdGlvbicsIFwiUmVuZGVyIHdoaXRlc3BhY2UgY2hhcmFjdGVycyBvbmx5IG9uIHNlbGVjdGVkIHRleHQuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3JlbmRlcldoaXRlc3BhY2UudHJhaWxpbmcnLCBcIlJlbmRlciBvbmx5IHRyYWlsaW5nIHdoaXRlc3BhY2UgY2hhcmFjdGVycy5cIiksXG5cdFx0XHRcdCcnXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncmVuZGVyV2hpdGVzcGFjZScsIFwiQ29udHJvbHMgaG93IHRoZSBlZGl0b3Igc2hvdWxkIHJlbmRlciB3aGl0ZXNwYWNlIGNoYXJhY3RlcnMuXCIpXG5cdFx0fVxuXHQpKSxcblx0cmV2ZWFsSG9yaXpvbnRhbFJpZ2h0UGFkZGluZzogcmVnaXN0ZXIobmV3IEVkaXRvckludE9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ucmV2ZWFsSG9yaXpvbnRhbFJpZ2h0UGFkZGluZywgJ3JldmVhbEhvcml6b250YWxSaWdodFBhZGRpbmcnLFxuXHRcdDE1LCAwLCAxMDAwLFxuXHQpKSxcblx0cm91bmRlZFNlbGVjdGlvbjogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnJvdW5kZWRTZWxlY3Rpb24sICdyb3VuZGVkU2VsZWN0aW9uJywgdHJ1ZSxcblx0XHR7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3JvdW5kZWRTZWxlY3Rpb24nLCBcIkNvbnRyb2xzIHdoZXRoZXIgc2VsZWN0aW9ucyBzaG91bGQgaGF2ZSByb3VuZGVkIGNvcm5lcnMuXCIpIH1cblx0KSksXG5cdHJ1bGVyczogcmVnaXN0ZXIobmV3IEVkaXRvclJ1bGVycygpKSxcblx0c2Nyb2xsYmFyOiByZWdpc3RlcihuZXcgRWRpdG9yU2Nyb2xsYmFyKCkpLFxuXHRzY3JvbGxCZXlvbmRMYXN0Q29sdW1uOiByZWdpc3RlcihuZXcgRWRpdG9ySW50T3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5zY3JvbGxCZXlvbmRMYXN0Q29sdW1uLCAnc2Nyb2xsQmV5b25kTGFzdENvbHVtbicsXG5cdFx0NCwgMCwgQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY3JvbGxCZXlvbmRMYXN0Q29sdW1uJywgXCJDb250cm9scyB0aGUgbnVtYmVyIG9mIGV4dHJhIGNoYXJhY3RlcnMgYmV5b25kIHdoaWNoIHRoZSBlZGl0b3Igd2lsbCBzY3JvbGwgaG9yaXpvbnRhbGx5LlwiKSB9XG5cdCkpLFxuXHRzY3JvbGxCZXlvbmRMYXN0TGluZTogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnNjcm9sbEJleW9uZExhc3RMaW5lLCAnc2Nyb2xsQmV5b25kTGFzdExpbmUnLCB0cnVlLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2Nyb2xsQmV5b25kTGFzdExpbmUnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGVkaXRvciB3aWxsIHNjcm9sbCBiZXlvbmQgdGhlIGxhc3QgbGluZS5cIikgfVxuXHQpKSxcblx0c2Nyb2xsUHJlZG9taW5hbnRBeGlzOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uc2Nyb2xsUHJlZG9taW5hbnRBeGlzLCAnc2Nyb2xsUHJlZG9taW5hbnRBeGlzJywgdHJ1ZSxcblx0XHR7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Njcm9sbFByZWRvbWluYW50QXhpcycsIFwiU2Nyb2xsIG9ubHkgYWxvbmcgdGhlIHByZWRvbWluYW50IGF4aXMgd2hlbiBzY3JvbGxpbmcgYm90aCB2ZXJ0aWNhbGx5IGFuZCBob3Jpem9udGFsbHkgYXQgdGhlIHNhbWUgdGltZS4gUHJldmVudHMgaG9yaXpvbnRhbCBkcmlmdCB3aGVuIHNjcm9sbGluZyB2ZXJ0aWNhbGx5IG9uIGEgdHJhY2twYWQuXCIpIH1cblx0KSksXG5cdHNlbGVjdGlvbkNsaXBib2FyZDogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnNlbGVjdGlvbkNsaXBib2FyZCwgJ3NlbGVjdGlvbkNsaXBib2FyZCcsIHRydWUsXG5cdFx0e1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2VsZWN0aW9uQ2xpcGJvYXJkJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBMaW51eCBwcmltYXJ5IGNsaXBib2FyZCBzaG91bGQgYmUgc3VwcG9ydGVkLlwiKSxcblx0XHRcdGluY2x1ZGVkOiBwbGF0Zm9ybS5pc0xpbnV4XG5cdFx0fVxuXHQpKSxcblx0c2VsZWN0aW9uSGlnaGxpZ2h0OiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uc2VsZWN0aW9uSGlnaGxpZ2h0LCAnc2VsZWN0aW9uSGlnaGxpZ2h0JywgdHJ1ZSxcblx0XHR7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlbGVjdGlvbkhpZ2hsaWdodCcsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgZWRpdG9yIHNob3VsZCBoaWdobGlnaHQgbWF0Y2hlcyBzaW1pbGFyIHRvIHRoZSBzZWxlY3Rpb24uXCIpIH1cblx0KSksXG5cdHNlbGVjdE9uTGluZU51bWJlcnM6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5zZWxlY3RPbkxpbmVOdW1iZXJzLCAnc2VsZWN0T25MaW5lTnVtYmVycycsIHRydWUsXG5cdCkpLFxuXHRzaG93Rm9sZGluZ0NvbnRyb2xzOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uc2hvd0ZvbGRpbmdDb250cm9scywgJ3Nob3dGb2xkaW5nQ29udHJvbHMnLFxuXHRcdCdtb3VzZW92ZXInIGFzICdhbHdheXMnIHwgJ25ldmVyJyB8ICdtb3VzZW92ZXInLFxuXHRcdFsnYWx3YXlzJywgJ25ldmVyJywgJ21vdXNlb3ZlciddIGFzIGNvbnN0LFxuXHRcdHtcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdzaG93Rm9sZGluZ0NvbnRyb2xzLmFsd2F5cycsIFwiQWx3YXlzIHNob3cgdGhlIGZvbGRpbmcgY29udHJvbHMuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3Nob3dGb2xkaW5nQ29udHJvbHMubmV2ZXInLCBcIk5ldmVyIHNob3cgdGhlIGZvbGRpbmcgY29udHJvbHMgYW5kIHJlZHVjZSB0aGUgZ3V0dGVyIHNpemUuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3Nob3dGb2xkaW5nQ29udHJvbHMubW91c2VvdmVyJywgXCJPbmx5IHNob3cgdGhlIGZvbGRpbmcgY29udHJvbHMgd2hlbiB0aGUgbW91c2UgaXMgb3ZlciB0aGUgZ3V0dGVyLlwiKSxcblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzaG93Rm9sZGluZ0NvbnRyb2xzJywgXCJDb250cm9scyB3aGVuIHRoZSBmb2xkaW5nIGNvbnRyb2xzIG9uIHRoZSBndXR0ZXIgYXJlIHNob3duLlwiKVxuXHRcdH1cblx0KSksXG5cdHNob3dVbnVzZWQ6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5zaG93VW51c2VkLCAnc2hvd1VudXNlZCcsIHRydWUsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzaG93VW51c2VkJywgXCJDb250cm9scyBmYWRpbmcgb3V0IG9mIHVudXNlZCBjb2RlLlwiKSB9XG5cdCkpLFxuXHRzaG93RGVwcmVjYXRlZDogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnNob3dEZXByZWNhdGVkLCAnc2hvd0RlcHJlY2F0ZWQnLCB0cnVlLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2hvd0RlcHJlY2F0ZWQnLCBcIkNvbnRyb2xzIHN0cmlrZXRocm91Z2ggZGVwcmVjYXRlZCB2YXJpYWJsZXMuXCIpIH1cblx0KSksXG5cdGlubGF5SGludHM6IHJlZ2lzdGVyKG5ldyBFZGl0b3JJbmxheUhpbnRzKCkpLFxuXHRzbmlwcGV0U3VnZ2VzdGlvbnM6IHJlZ2lzdGVyKG5ldyBFZGl0b3JTdHJpbmdFbnVtT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5zbmlwcGV0U3VnZ2VzdGlvbnMsICdzbmlwcGV0U3VnZ2VzdGlvbnMnLFxuXHRcdCdpbmxpbmUnIGFzICd0b3AnIHwgJ2JvdHRvbScgfCAnaW5saW5lJyB8ICdub25lJyxcblx0XHRbJ3RvcCcsICdib3R0b20nLCAnaW5saW5lJywgJ25vbmUnXSBhcyBjb25zdCxcblx0XHR7XG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc25pcHBldFN1Z2dlc3Rpb25zLnRvcCcsIFwiU2hvdyBzbmlwcGV0IHN1Z2dlc3Rpb25zIG9uIHRvcCBvZiBvdGhlciBzdWdnZXN0aW9ucy5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc25pcHBldFN1Z2dlc3Rpb25zLmJvdHRvbScsIFwiU2hvdyBzbmlwcGV0IHN1Z2dlc3Rpb25zIGJlbG93IG90aGVyIHN1Z2dlc3Rpb25zLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdzbmlwcGV0U3VnZ2VzdGlvbnMuaW5saW5lJywgXCJTaG93IHNuaXBwZXRzIHN1Z2dlc3Rpb25zIHdpdGggb3RoZXIgc3VnZ2VzdGlvbnMuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NuaXBwZXRTdWdnZXN0aW9ucy5ub25lJywgXCJEbyBub3Qgc2hvdyBzbmlwcGV0IHN1Z2dlc3Rpb25zLlwiKSxcblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzbmlwcGV0U3VnZ2VzdGlvbnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgc25pcHBldHMgYXJlIHNob3duIHdpdGggb3RoZXIgc3VnZ2VzdGlvbnMgYW5kIGhvdyB0aGV5IGFyZSBzb3J0ZWQuXCIpXG5cdFx0fVxuXHQpKSxcblx0c21hcnRTZWxlY3Q6IHJlZ2lzdGVyKG5ldyBTbWFydFNlbGVjdCgpKSxcblx0c21vb3RoU2Nyb2xsaW5nOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uc21vb3RoU2Nyb2xsaW5nLCAnc21vb3RoU2Nyb2xsaW5nJywgZmFsc2UsXG5cdFx0eyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzbW9vdGhTY3JvbGxpbmcnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGVkaXRvciB3aWxsIHNjcm9sbCB1c2luZyBhbiBhbmltYXRpb24uXCIpIH1cblx0KSksXG5cdHN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXI6IHJlZ2lzdGVyKG5ldyBFZGl0b3JJbnRPcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXIsICdzdG9wUmVuZGVyaW5nTGluZUFmdGVyJyxcblx0XHQxMDAwMCwgLTEsIENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSLFxuXHQpKSxcblx0c3VnZ2VzdDogcmVnaXN0ZXIobmV3IEVkaXRvclN1Z2dlc3QoKSksXG5cdGlubGluZVN1Z2dlc3Q6IHJlZ2lzdGVyKG5ldyBJbmxpbmVFZGl0b3JTdWdnZXN0KCkpLFxuXHRpbmxpbmVDb21wbGV0aW9uc0FjY2Vzc2liaWxpdHlWZXJib3NlOiByZWdpc3RlcihuZXcgRWRpdG9yQm9vbGVhbk9wdGlvbihFZGl0b3JPcHRpb24uaW5saW5lQ29tcGxldGlvbnNBY2Nlc3NpYmlsaXR5VmVyYm9zZSwgJ2lubGluZUNvbXBsZXRpb25zQWNjZXNzaWJpbGl0eVZlcmJvc2UnLCBmYWxzZSxcblx0XHR7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2lubGluZUNvbXBsZXRpb25zQWNjZXNzaWJpbGl0eVZlcmJvc2UnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGFjY2Vzc2liaWxpdHkgaGludCBzaG91bGQgYmUgcHJvdmlkZWQgdG8gc2NyZWVuIHJlYWRlciB1c2VycyB3aGVuIGFuIGlubGluZSBjb21wbGV0aW9uIGlzIHNob3duLlwiKSB9KSksXG5cdHN1Z2dlc3RGb250U2l6ZTogcmVnaXN0ZXIobmV3IEVkaXRvckludE9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uc3VnZ2VzdEZvbnRTaXplLCAnc3VnZ2VzdEZvbnRTaXplJyxcblx0XHQwLCAwLCAxMDAwLFxuXHRcdHsgbWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzdWdnZXN0Rm9udFNpemUnLCBcIkZvbnQgc2l6ZSBmb3IgdGhlIHN1Z2dlc3Qgd2lkZ2V0LiBXaGVuIHNldCB0byB7MH0sIHRoZSB2YWx1ZSBvZiB7MX0gaXMgdXNlZC5cIiwgJ2AwYCcsICdgI2VkaXRvci5mb250U2l6ZSNgJykgfVxuXHQpKSxcblx0c3VnZ2VzdExpbmVIZWlnaHQ6IHJlZ2lzdGVyKG5ldyBFZGl0b3JJbnRPcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnN1Z2dlc3RMaW5lSGVpZ2h0LCAnc3VnZ2VzdExpbmVIZWlnaHQnLFxuXHRcdDAsIDAsIDEwMDAsXG5cdFx0eyBtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3N1Z2dlc3RMaW5lSGVpZ2h0JywgXCJMaW5lIGhlaWdodCBmb3IgdGhlIHN1Z2dlc3Qgd2lkZ2V0LiBXaGVuIHNldCB0byB7MH0sIHRoZSB2YWx1ZSBvZiB7MX0gaXMgdXNlZC4gVGhlIG1pbmltdW0gdmFsdWUgaXMgOC5cIiwgJ2AwYCcsICdgI2VkaXRvci5saW5lSGVpZ2h0I2AnKSB9XG5cdCkpLFxuXHRzdWdnZXN0T25UcmlnZ2VyQ2hhcmFjdGVyczogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnN1Z2dlc3RPblRyaWdnZXJDaGFyYWN0ZXJzLCAnc3VnZ2VzdE9uVHJpZ2dlckNoYXJhY3RlcnMnLCB0cnVlLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc3VnZ2VzdE9uVHJpZ2dlckNoYXJhY3RlcnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgc3VnZ2VzdGlvbnMgc2hvdWxkIGF1dG9tYXRpY2FsbHkgc2hvdyB1cCB3aGVuIHR5cGluZyB0cmlnZ2VyIGNoYXJhY3RlcnMuXCIpIH1cblx0KSksXG5cdHN1Z2dlc3RTZWxlY3Rpb246IHJlZ2lzdGVyKG5ldyBFZGl0b3JTdHJpbmdFbnVtT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi5zdWdnZXN0U2VsZWN0aW9uLCAnc3VnZ2VzdFNlbGVjdGlvbicsXG5cdFx0J2ZpcnN0JyBhcyAnZmlyc3QnIHwgJ3JlY2VudGx5VXNlZCcgfCAncmVjZW50bHlVc2VkQnlQcmVmaXgnLFxuXHRcdFsnZmlyc3QnLCAncmVjZW50bHlVc2VkJywgJ3JlY2VudGx5VXNlZEJ5UHJlZml4J10gYXMgY29uc3QsXG5cdFx0e1xuXHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc3VnZ2VzdFNlbGVjdGlvbi5maXJzdCcsIFwiQWx3YXlzIHNlbGVjdCB0aGUgZmlyc3Qgc3VnZ2VzdGlvbi5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc3VnZ2VzdFNlbGVjdGlvbi5yZWNlbnRseVVzZWQnLCBcIlNlbGVjdCByZWNlbnQgc3VnZ2VzdGlvbnMgdW5sZXNzIGZ1cnRoZXIgdHlwaW5nIHNlbGVjdHMgb25lLCBlLmcuIGBjb25zb2xlLnwgLT4gY29uc29sZS5sb2dgIGJlY2F1c2UgYGxvZ2AgaGFzIGJlZW4gY29tcGxldGVkIHJlY2VudGx5LlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdzdWdnZXN0U2VsZWN0aW9uLnJlY2VudGx5VXNlZEJ5UHJlZml4JywgXCJTZWxlY3Qgc3VnZ2VzdGlvbnMgYmFzZWQgb24gcHJldmlvdXMgcHJlZml4ZXMgdGhhdCBoYXZlIGNvbXBsZXRlZCB0aG9zZSBzdWdnZXN0aW9ucywgZS5nLiBgY28gLT4gY29uc29sZWAgYW5kIGBjb24gLT4gY29uc3RgLlwiKSxcblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzdWdnZXN0U2VsZWN0aW9uJywgXCJDb250cm9scyBob3cgc3VnZ2VzdGlvbnMgYXJlIHByZS1zZWxlY3RlZCB3aGVuIHNob3dpbmcgdGhlIHN1Z2dlc3QgbGlzdC5cIilcblx0XHR9XG5cdCkpLFxuXHR0YWJDb21wbGV0aW9uOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24udGFiQ29tcGxldGlvbiwgJ3RhYkNvbXBsZXRpb24nLFxuXHRcdCdvZmYnIGFzICdvbicgfCAnb2ZmJyB8ICdvbmx5U25pcHBldHMnLFxuXHRcdFsnb24nLCAnb2ZmJywgJ29ubHlTbmlwcGV0cyddIGFzIGNvbnN0LFxuXHRcdHtcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKCd0YWJDb21wbGV0aW9uLm9uJywgXCJUYWIgY29tcGxldGUgd2lsbCBpbnNlcnQgdGhlIGJlc3QgbWF0Y2hpbmcgc3VnZ2VzdGlvbiB3aGVuIHByZXNzaW5nIHRhYi5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgndGFiQ29tcGxldGlvbi5vZmYnLCBcIkRpc2FibGUgdGFiIGNvbXBsZXRpb25zLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCd0YWJDb21wbGV0aW9uLm9ubHlTbmlwcGV0cycsIFwiVGFiIGNvbXBsZXRlIHNuaXBwZXRzIHdoZW4gdGhlaXIgcHJlZml4IG1hdGNoLiBXb3JrcyBiZXN0IHdoZW4gJ3F1aWNrU3VnZ2VzdGlvbnMnIGFyZW4ndCBlbmFibGVkLlwiKSxcblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd0YWJDb21wbGV0aW9uJywgXCJFbmFibGVzIHRhYiBjb21wbGV0aW9ucy5cIilcblx0XHR9XG5cdCkpLFxuXHR0YWJJbmRleDogcmVnaXN0ZXIobmV3IEVkaXRvckludE9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24udGFiSW5kZXgsICd0YWJJbmRleCcsXG5cdFx0MCwgLTEsIENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSXG5cdCkpLFxuXHR1bmljb2RlSGlnaGxpZ2h0OiByZWdpc3RlcihuZXcgVW5pY29kZUhpZ2hsaWdodCgpKSxcblx0dW51c3VhbExpbmVUZXJtaW5hdG9yczogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ0VudW1PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnVudXN1YWxMaW5lVGVybWluYXRvcnMsICd1bnVzdWFsTGluZVRlcm1pbmF0b3JzJyxcblx0XHQncHJvbXB0JyBhcyAnYXV0bycgfCAnb2ZmJyB8ICdwcm9tcHQnLFxuXHRcdFsnYXV0bycsICdvZmYnLCAncHJvbXB0J10gYXMgY29uc3QsXG5cdFx0e1xuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ3VudXN1YWxMaW5lVGVybWluYXRvcnMuYXV0bycsIFwiVW51c3VhbCBsaW5lIHRlcm1pbmF0b3JzIGFyZSBhdXRvbWF0aWNhbGx5IHJlbW92ZWQuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3VudXN1YWxMaW5lVGVybWluYXRvcnMub2ZmJywgXCJVbnVzdWFsIGxpbmUgdGVybWluYXRvcnMgYXJlIGlnbm9yZWQuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3VudXN1YWxMaW5lVGVybWluYXRvcnMucHJvbXB0JywgXCJVbnVzdWFsIGxpbmUgdGVybWluYXRvcnMgcHJvbXB0IHRvIGJlIHJlbW92ZWQuXCIpLFxuXHRcdFx0XSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3VudXN1YWxMaW5lVGVybWluYXRvcnMnLCBcIlJlbW92ZSB1bnVzdWFsIGxpbmUgdGVybWluYXRvcnMgdGhhdCBtaWdodCBjYXVzZSBwcm9ibGVtcy5cIilcblx0XHR9XG5cdCkpLFxuXHR1c2VTaGFkb3dET006IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi51c2VTaGFkb3dET00sICd1c2VTaGFkb3dET00nLCB0cnVlXG5cdCkpLFxuXHR1c2VUYWJTdG9wczogcmVnaXN0ZXIobmV3IEVkaXRvckJvb2xlYW5PcHRpb24oXG5cdFx0RWRpdG9yT3B0aW9uLnVzZVRhYlN0b3BzLCAndXNlVGFiU3RvcHMnLCB0cnVlLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndXNlVGFiU3RvcHMnLCBcIlNwYWNlcyBhbmQgdGFicyBhcmUgaW5zZXJ0ZWQgYW5kIGRlbGV0ZWQgaW4gYWxpZ25tZW50IHdpdGggdGFiIHN0b3BzLlwiKSB9XG5cdCkpLFxuXHR3b3JkQnJlYWs6IHJlZ2lzdGVyKG5ldyBFZGl0b3JTdHJpbmdFbnVtT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi53b3JkQnJlYWssICd3b3JkQnJlYWsnLFxuXHRcdCdub3JtYWwnIGFzICdub3JtYWwnIHwgJ2tlZXBBbGwnLFxuXHRcdFsnbm9ybWFsJywgJ2tlZXBBbGwnXSBhcyBjb25zdCxcblx0XHR7XG5cdFx0XHRtYXJrZG93bkVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKCd3b3JkQnJlYWsubm9ybWFsJywgXCJVc2UgdGhlIGRlZmF1bHQgbGluZSBicmVhayBydWxlLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCd3b3JkQnJlYWsua2VlcEFsbCcsIFwiV29yZCBicmVha3Mgc2hvdWxkIG5vdCBiZSB1c2VkIGZvciBDaGluZXNlL0phcGFuZXNlL0tvcmVhbiAoQ0pLKSB0ZXh0LiBOb24tQ0pLIHRleHQgYmVoYXZpb3IgaXMgdGhlIHNhbWUgYXMgZm9yIG5vcm1hbC5cIiksXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnd29yZEJyZWFrJywgXCJDb250cm9scyB0aGUgd29yZCBicmVhayBydWxlcyB1c2VkIGZvciBDaGluZXNlL0phcGFuZXNlL0tvcmVhbiAoQ0pLKSB0ZXh0LlwiKVxuXHRcdH1cblx0KSksXG5cdHdvcmRTZWdtZW50ZXJMb2NhbGVzOiByZWdpc3RlcihuZXcgV29yZFNlZ21lbnRlckxvY2FsZXMoKSksXG5cdHdvcmRTZXBhcmF0b3JzOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nT3B0aW9uKFxuXHRcdEVkaXRvck9wdGlvbi53b3JkU2VwYXJhdG9ycywgJ3dvcmRTZXBhcmF0b3JzJywgVVNVQUxfV09SRF9TRVBBUkFUT1JTLFxuXHRcdHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnd29yZFNlcGFyYXRvcnMnLCBcIkNoYXJhY3RlcnMgdGhhdCB3aWxsIGJlIHVzZWQgYXMgd29yZCBzZXBhcmF0b3JzIHdoZW4gZG9pbmcgd29yZCByZWxhdGVkIG5hdmlnYXRpb25zIG9yIG9wZXJhdGlvbnMuXCIpIH1cblx0KSksXG5cdHdvcmRXcmFwOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ud29yZFdyYXAsICd3b3JkV3JhcCcsXG5cdFx0J29mZicgYXMgJ29mZicgfCAnb24nIHwgJ3dvcmRXcmFwQ29sdW1uJyB8ICdib3VuZGVkJyxcblx0XHRbJ29mZicsICdvbicsICd3b3JkV3JhcENvbHVtbicsICdib3VuZGVkJ10gYXMgY29uc3QsXG5cdFx0e1xuXHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnd29yZFdyYXAub2ZmJywgXCJMaW5lcyB3aWxsIG5ldmVyIHdyYXAuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3dvcmRXcmFwLm9uJywgXCJMaW5lcyB3aWxsIHdyYXAgYXQgdGhlIHZpZXdwb3J0IHdpZHRoLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKHtcblx0XHRcdFx0XHRrZXk6ICd3b3JkV3JhcC53b3JkV3JhcENvbHVtbicsXG5cdFx0XHRcdFx0Y29tbWVudDogW1xuXHRcdFx0XHRcdFx0Jy0gYGVkaXRvci53b3JkV3JhcENvbHVtbmAgcmVmZXJzIHRvIGEgZGlmZmVyZW50IHNldHRpbmcgYW5kIHNob3VsZCBub3QgYmUgbG9jYWxpemVkLidcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sIFwiTGluZXMgd2lsbCB3cmFwIGF0IGAjZWRpdG9yLndvcmRXcmFwQ29sdW1uI2AuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoe1xuXHRcdFx0XHRcdGtleTogJ3dvcmRXcmFwLmJvdW5kZWQnLFxuXHRcdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHRcdCctIHZpZXdwb3J0IG1lYW5zIHRoZSBlZGdlIG9mIHRoZSB2aXNpYmxlIHdpbmRvdyBzaXplLicsXG5cdFx0XHRcdFx0XHQnLSBgZWRpdG9yLndvcmRXcmFwQ29sdW1uYCByZWZlcnMgdG8gYSBkaWZmZXJlbnQgc2V0dGluZyBhbmQgc2hvdWxkIG5vdCBiZSBsb2NhbGl6ZWQuJ1xuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSwgXCJMaW5lcyB3aWxsIHdyYXAgYXQgdGhlIG1pbmltdW0gb2Ygdmlld3BvcnQgYW5kIGAjZWRpdG9yLndvcmRXcmFwQ29sdW1uI2AuXCIpLFxuXHRcdFx0XSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoe1xuXHRcdFx0XHRrZXk6ICd3b3JkV3JhcCcsXG5cdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHQnLSBcXCdvZmZcXCcsIFxcJ29uXFwnLCBcXCd3b3JkV3JhcENvbHVtblxcJyBhbmQgXFwnYm91bmRlZFxcJyByZWZlciB0byB2YWx1ZXMgdGhlIHNldHRpbmcgY2FuIHRha2UgYW5kIHNob3VsZCBub3QgYmUgbG9jYWxpemVkLicsXG5cdFx0XHRcdFx0Jy0gYGVkaXRvci53b3JkV3JhcENvbHVtbmAgcmVmZXJzIHRvIGEgZGlmZmVyZW50IHNldHRpbmcgYW5kIHNob3VsZCBub3QgYmUgbG9jYWxpemVkLidcblx0XHRcdFx0XVxuXHRcdFx0fSwgXCJDb250cm9scyBob3cgbGluZXMgc2hvdWxkIHdyYXAuXCIpXG5cdFx0fVxuXHQpKSxcblx0d29yZFdyYXBCcmVha0FmdGVyQ2hhcmFjdGVyczogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ09wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ud29yZFdyYXBCcmVha0FmdGVyQ2hhcmFjdGVycywgJ3dvcmRXcmFwQnJlYWtBZnRlckNoYXJhY3RlcnMnLFxuXHRcdC8vIGFsbG93LWFueS11bmljb2RlLW5leHQtbGluZVxuXHRcdCcgXFx0fSldP3wvJi4sO1x1MDBBMlx1MDBCMFx1MjAzMlx1MjAzM1x1MjAzMFx1MjEwM1x1MzAwMVx1MzAwMlx1RkY2MVx1RkY2NFx1RkZFMFx1RkYwQ1x1RkYwRVx1RkYxQVx1RkYxQlx1RkYxRlx1RkYwMVx1RkYwNVx1MzBGQlx1RkY2NVx1MzA5RFx1MzA5RVx1MzBGRFx1MzBGRVx1MzBGQ1x1MzBBMVx1MzBBM1x1MzBBNVx1MzBBN1x1MzBBOVx1MzBDM1x1MzBFM1x1MzBFNVx1MzBFN1x1MzBFRVx1MzBGNVx1MzBGNlx1MzA0MVx1MzA0M1x1MzA0NVx1MzA0N1x1MzA0OVx1MzA2M1x1MzA4M1x1MzA4NVx1MzA4N1x1MzA4RVx1MzA5NVx1MzA5Nlx1MzFGMFx1MzFGMVx1MzFGMlx1MzFGM1x1MzFGNFx1MzFGNVx1MzFGNlx1MzFGN1x1MzFGOFx1MzFGOVx1MzFGQVx1MzFGQlx1MzFGQ1x1MzFGRFx1MzFGRVx1MzFGRlx1MzAwNVx1MzAzQlx1RkY2N1x1RkY2OFx1RkY2OVx1RkY2QVx1RkY2Qlx1RkY2Q1x1RkY2RFx1RkY2RVx1RkY2Rlx1RkY3MFx1MjAxRFx1MzAwOVx1MzAwQlx1MzAwRFx1MzAwRlx1MzAxMVx1MzAxNVx1RkYwOVx1RkYzRFx1RkY1RFx1RkY2MycsXG5cdCkpLFxuXHR3b3JkV3JhcEJyZWFrQmVmb3JlQ2hhcmFjdGVyczogcmVnaXN0ZXIobmV3IEVkaXRvclN0cmluZ09wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ud29yZFdyYXBCcmVha0JlZm9yZUNoYXJhY3RlcnMsICd3b3JkV3JhcEJyZWFrQmVmb3JlQ2hhcmFjdGVycycsXG5cdFx0Ly8gYWxsb3ctYW55LXVuaWNvZGUtbmV4dC1saW5lXG5cdFx0Jyhbe1x1MjAxOFx1MjAxQ1x1MzAwOFx1MzAwQVx1MzAwQ1x1MzAwRVx1MzAxMFx1MzAxNFx1RkYwOFx1RkYzQlx1RkY1Qlx1RkY2Mlx1MDBBM1x1MDBBNVx1RkYwNFx1RkZFMVx1RkZFNStcdUZGMEInXG5cdCkpLFxuXHR3b3JkV3JhcENvbHVtbjogcmVnaXN0ZXIobmV3IEVkaXRvckludE9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ud29yZFdyYXBDb2x1bW4sICd3b3JkV3JhcENvbHVtbicsXG5cdFx0ODAsIDEsIENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSLFxuXHRcdHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSh7XG5cdFx0XHRcdGtleTogJ3dvcmRXcmFwQ29sdW1uJyxcblx0XHRcdFx0Y29tbWVudDogW1xuXHRcdFx0XHRcdCctIGBlZGl0b3Iud29yZFdyYXBgIHJlZmVycyB0byBhIGRpZmZlcmVudCBzZXR0aW5nIGFuZCBzaG91bGQgbm90IGJlIGxvY2FsaXplZC4nLFxuXHRcdFx0XHRcdCctIFxcJ3dvcmRXcmFwQ29sdW1uXFwnIGFuZCBcXCdib3VuZGVkXFwnIHJlZmVyIHRvIHZhbHVlcyB0aGUgZGlmZmVyZW50IHNldHRpbmcgY2FuIHRha2UgYW5kIHNob3VsZCBub3QgYmUgbG9jYWxpemVkLidcblx0XHRcdFx0XVxuXHRcdFx0fSwgXCJDb250cm9scyB0aGUgd3JhcHBpbmcgY29sdW1uIG9mIHRoZSBlZGl0b3Igd2hlbiBgI2VkaXRvci53b3JkV3JhcCNgIGlzIGB3b3JkV3JhcENvbHVtbmAgb3IgYGJvdW5kZWRgLlwiKVxuXHRcdH1cblx0KSksXG5cdHdvcmRXcmFwT3ZlcnJpZGUxOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ud29yZFdyYXBPdmVycmlkZTEsICd3b3JkV3JhcE92ZXJyaWRlMScsXG5cdFx0J2luaGVyaXQnIGFzICdvZmYnIHwgJ29uJyB8ICdpbmhlcml0Jyxcblx0XHRbJ29mZicsICdvbicsICdpbmhlcml0J10gYXMgY29uc3Rcblx0KSksXG5cdHdvcmRXcmFwT3ZlcnJpZGUyOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24ud29yZFdyYXBPdmVycmlkZTIsICd3b3JkV3JhcE92ZXJyaWRlMicsXG5cdFx0J2luaGVyaXQnIGFzICdvZmYnIHwgJ29uJyB8ICdpbmhlcml0Jyxcblx0XHRbJ29mZicsICdvbicsICdpbmhlcml0J10gYXMgY29uc3Rcblx0KSksXG5cblx0Ly8gTGVhdmUgdGhlc2UgYXQgdGhlIGVuZCAoYmVjYXVzZSB0aGV5IGhhdmUgZGVwZW5kZW5jaWVzISlcblx0ZWZmZWN0aXZlQ3Vyc29yU3R5bGU6IHJlZ2lzdGVyKG5ldyBFZmZlY3RpdmVDdXJzb3JTdHlsZSgpKSxcblx0ZWRpdG9yQ2xhc3NOYW1lOiByZWdpc3RlcihuZXcgRWRpdG9yQ2xhc3NOYW1lKCkpLFxuXHRkZWZhdWx0Q29sb3JEZWNvcmF0b3JzOiByZWdpc3RlcihuZXcgRWRpdG9yU3RyaW5nRW51bU9wdGlvbihcblx0XHRFZGl0b3JPcHRpb24uZGVmYXVsdENvbG9yRGVjb3JhdG9ycywgJ2RlZmF1bHRDb2xvckRlY29yYXRvcnMnLCAnYXV0bycgYXMgJ2F1dG8nIHwgJ2Fsd2F5cycgfCAnbmV2ZXInLFxuXHRcdFsnYXV0bycsICdhbHdheXMnLCAnbmV2ZXInXSBhcyBjb25zdCxcblx0XHR7XG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmRlZmF1bHRDb2xvckRlY29yYXRvcnMuYXV0bycsIFwiU2hvdyBkZWZhdWx0IGNvbG9yIGRlY29yYXRvcnMgb25seSB3aGVuIG5vIGV4dGVuc2lvbiBwcm92aWRlcyBjb2xvcnMgZGVjb3JhdG9ycy5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZWRpdG9yLmRlZmF1bHRDb2xvckRlY29yYXRvcnMuYWx3YXlzJywgXCJBbHdheXMgc2hvdyBkZWZhdWx0IGNvbG9yIGRlY29yYXRvcnMuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRvci5kZWZhdWx0Q29sb3JEZWNvcmF0b3JzLm5ldmVyJywgXCJOZXZlciBzaG93IGRlZmF1bHQgY29sb3IgZGVjb3JhdG9ycy5cIiksXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZGVmYXVsdENvbG9yRGVjb3JhdG9ycycsIFwiQ29udHJvbHMgd2hldGhlciBpbmxpbmUgY29sb3IgZGVjb3JhdGlvbnMgc2hvdWxkIGJlIHNob3duIHVzaW5nIHRoZSBkZWZhdWx0IGRvY3VtZW50IGNvbG9yIHByb3ZpZGVyLlwiKVxuXHRcdH1cblx0KSksXG5cdHBpeGVsUmF0aW86IHJlZ2lzdGVyKG5ldyBFZGl0b3JQaXhlbFJhdGlvKCkpLFxuXHR0YWJGb2N1c01vZGU6IHJlZ2lzdGVyKG5ldyBFZGl0b3JCb29sZWFuT3B0aW9uKEVkaXRvck9wdGlvbi50YWJGb2N1c01vZGUsICd0YWJGb2N1c01vZGUnLCBmYWxzZSxcblx0XHR7IG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndGFiRm9jdXNNb2RlJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBlZGl0b3IgcmVjZWl2ZXMgdGFicyBvciBkZWZlcnMgdGhlbSB0byB0aGUgd29ya2JlbmNoIGZvciBuYXZpZ2F0aW9uLlwiKSB9XG5cdCkpLFxuXHRsYXlvdXRJbmZvOiByZWdpc3RlcihuZXcgRWRpdG9yTGF5b3V0SW5mb0NvbXB1dGVyKCkpLFxuXHR3cmFwcGluZ0luZm86IHJlZ2lzdGVyKG5ldyBFZGl0b3JXcmFwcGluZ0luZm9Db21wdXRlcigpKSxcblx0d3JhcHBpbmdJbmRlbnQ6IHJlZ2lzdGVyKG5ldyBXcmFwcGluZ0luZGVudE9wdGlvbigpKSxcblx0d3JhcHBpbmdTdHJhdGVneTogcmVnaXN0ZXIobmV3IFdyYXBwaW5nU3RyYXRlZ3koKSksXG5cdGVmZmVjdGl2ZUV4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZDogcmVnaXN0ZXIobmV3IEVmZmVjdGl2ZUV4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZCgpKVxufTtcblxudHlwZSBFZGl0b3JPcHRpb25zVHlwZSA9IHR5cGVvZiBFZGl0b3JPcHRpb25zO1xudHlwZSBGaW5kRWRpdG9yT3B0aW9uc0tleUJ5SWQ8VCBleHRlbmRzIEVkaXRvck9wdGlvbj4gPSB7IFtLIGluIGtleW9mIEVkaXRvck9wdGlvbnNUeXBlXTogRWRpdG9yT3B0aW9uc1R5cGVbS11bJ2lkJ10gZXh0ZW5kcyBUID8gSyA6IG5ldmVyIH1ba2V5b2YgRWRpdG9yT3B0aW9uc1R5cGVdO1xudHlwZSBDb21wdXRlZEVkaXRvck9wdGlvblZhbHVlPFQgZXh0ZW5kcyBJRWRpdG9yT3B0aW9uPGFueSwgYW55Pj4gPSBUIGV4dGVuZHMgSUVkaXRvck9wdGlvbjxhbnksIGluZmVyIFI+ID8gUiA6IG5ldmVyO1xuZXhwb3J0IHR5cGUgRmluZENvbXB1dGVkRWRpdG9yT3B0aW9uVmFsdWVCeUlkPFQgZXh0ZW5kcyBFZGl0b3JPcHRpb24+ID0gTm9uTnVsbGFibGU8Q29tcHV0ZWRFZGl0b3JPcHRpb25WYWx1ZTxFZGl0b3JPcHRpb25zVHlwZVtGaW5kRWRpdG9yT3B0aW9uc0tleUJ5SWQ8VD5dPj47XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFlBQVk7QUFHeEIsWUFBWSxhQUFhO0FBQ3pCLFlBQVksY0FBYztBQUMxQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGlCQUFpQjtBQUUxQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0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QUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNBLEVBQUFBLDRCQUFBO0FBQ0EsRUFBQUEsNEJBQUE7QUFDQSxFQUFBQSw0QkFBQTtBQUNB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LHFCQUFxQixJQUFJLFNBQVM7QUFBQSxRQUNqQyxLQUFLO0FBQUEsUUFDTCxTQUFTO0FBQUEsVUFDUjtBQUFBLFVBQ0E7QUFBQSxRQUNEO0FBQUEsTUFDRCxHQUFHLHVHQUF1RztBQUFBLElBQzNHO0FBQUEsRUFDRCxDQUFDO0FBQUEsRUFDRCxtQkFBbUIsU0FBUyxJQUFJO0FBQUEsSUFDL0I7QUFBQSxJQUFnQztBQUFBLElBQ2hDO0FBQUEsSUFDQSxDQUFDLE9BQU8sTUFBTSxTQUFTO0FBQUEsRUFDeEIsQ0FBQztBQUFBLEVBQ0QsbUJBQW1CLFNBQVMsSUFBSTtBQUFBLElBQy9CO0FBQUEsSUFBZ0M7QUFBQSxJQUNoQztBQUFBLElBQ0EsQ0FBQyxPQUFPLE1BQU0sU0FBUztBQUFBLEVBQ3hCLENBQUM7QUFBQTtBQUFBLEVBR0Qsc0JBQXNCLFNBQVMsSUFBSSxxQkFBcUIsQ0FBQztBQUFBLEVBQ3pELGlCQUFpQixTQUFTLElBQUksZ0JBQWdCLENBQUM7QUFBQSxFQUMvQyx3QkFBd0IsU0FBUyxJQUFJO0FBQUEsSUFDcEM7QUFBQSxJQUFxQztBQUFBLElBQTBCO0FBQUEsSUFDL0QsQ0FBQyxRQUFRLFVBQVUsT0FBTztBQUFBLElBQzFCO0FBQUEsTUFDQyxrQkFBa0I7QUFBQSxRQUNqQixJQUFJLFNBQVMsc0NBQXNDLGtGQUFrRjtBQUFBLFFBQ3JJLElBQUksU0FBUyx3Q0FBd0MsdUNBQXVDO0FBQUEsUUFDNUYsSUFBSSxTQUFTLHVDQUF1QyxzQ0FBc0M7QUFBQSxNQUMzRjtBQUFBLE1BQ0EsYUFBYSxJQUFJLFNBQVMsMEJBQTBCLHNHQUFzRztBQUFBLElBQzNKO0FBQUEsRUFDRCxDQUFDO0FBQUEsRUFDRCxZQUFZLFNBQVMsSUFBSSxpQkFBaUIsQ0FBQztBQUFBLEVBQzNDLGNBQWMsU0FBUyxJQUFJO0FBQUEsSUFBb0I7QUFBQSxJQUEyQjtBQUFBLElBQWdCO0FBQUEsSUFDekYsRUFBRSxxQkFBcUIsSUFBSSxTQUFTLGdCQUFnQiwyRkFBMkYsRUFBRTtBQUFBLEVBQ2xKLENBQUM7QUFBQSxFQUNELFlBQVksU0FBUyxJQUFJLHlCQUF5QixDQUFDO0FBQUEsRUFDbkQsY0FBYyxTQUFTLElBQUksMkJBQTJCLENBQUM7QUFBQSxFQUN2RCxnQkFBZ0IsU0FBUyxJQUFJLHFCQUFxQixDQUFDO0FBQUEsRUFDbkQsa0JBQWtCLFNBQVMsSUFBSSxpQkFBaUIsQ0FBQztBQUFBLEVBQ2pELHlDQUF5QyxTQUFTLElBQUksd0NBQXdDLENBQUM7QUFDaEc7IiwKICAibmFtZXMiOiBbIkVkaXRvckF1dG9JbmRlbnRTdHJhdGVneSIsICJUZXh0RWRpdG9yQ3Vyc29yQmxpbmtpbmdTdHlsZSIsICJUZXh0RWRpdG9yQ3Vyc29yU3R5bGUiLCAiUmVuZGVyTWluaW1hcCIsICJTaG93TGlnaHRidWxiSWNvbk1vZGUiLCAiUmVuZGVyTGluZU51bWJlcnNUeXBlIiwgIldyYXBwaW5nSW5kZW50IiwgIkVkaXRvck9wdGlvbiJdCn0K
