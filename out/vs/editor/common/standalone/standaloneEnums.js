var AccessibilitySupport = /* @__PURE__ */ ((AccessibilitySupport2) => {
  AccessibilitySupport2[AccessibilitySupport2["Unknown"] = 0] = "Unknown";
  AccessibilitySupport2[AccessibilitySupport2["Disabled"] = 1] = "Disabled";
  AccessibilitySupport2[AccessibilitySupport2["Enabled"] = 2] = "Enabled";
  return AccessibilitySupport2;
})(AccessibilitySupport || {});
var CodeActionTriggerType = /* @__PURE__ */ ((CodeActionTriggerType2) => {
  CodeActionTriggerType2[CodeActionTriggerType2["Invoke"] = 1] = "Invoke";
  CodeActionTriggerType2[CodeActionTriggerType2["Auto"] = 2] = "Auto";
  return CodeActionTriggerType2;
})(CodeActionTriggerType || {});
var CompletionItemInsertTextRule = /* @__PURE__ */ ((CompletionItemInsertTextRule2) => {
  CompletionItemInsertTextRule2[CompletionItemInsertTextRule2["None"] = 0] = "None";
  CompletionItemInsertTextRule2[CompletionItemInsertTextRule2["KeepWhitespace"] = 1] = "KeepWhitespace";
  CompletionItemInsertTextRule2[CompletionItemInsertTextRule2["InsertAsSnippet"] = 4] = "InsertAsSnippet";
  return CompletionItemInsertTextRule2;
})(CompletionItemInsertTextRule || {});
var CompletionItemKind = /* @__PURE__ */ ((CompletionItemKind2) => {
  CompletionItemKind2[CompletionItemKind2["Method"] = 0] = "Method";
  CompletionItemKind2[CompletionItemKind2["Function"] = 1] = "Function";
  CompletionItemKind2[CompletionItemKind2["Constructor"] = 2] = "Constructor";
  CompletionItemKind2[CompletionItemKind2["Field"] = 3] = "Field";
  CompletionItemKind2[CompletionItemKind2["Variable"] = 4] = "Variable";
  CompletionItemKind2[CompletionItemKind2["Class"] = 5] = "Class";
  CompletionItemKind2[CompletionItemKind2["Struct"] = 6] = "Struct";
  CompletionItemKind2[CompletionItemKind2["Interface"] = 7] = "Interface";
  CompletionItemKind2[CompletionItemKind2["Module"] = 8] = "Module";
  CompletionItemKind2[CompletionItemKind2["Property"] = 9] = "Property";
  CompletionItemKind2[CompletionItemKind2["Event"] = 10] = "Event";
  CompletionItemKind2[CompletionItemKind2["Operator"] = 11] = "Operator";
  CompletionItemKind2[CompletionItemKind2["Unit"] = 12] = "Unit";
  CompletionItemKind2[CompletionItemKind2["Value"] = 13] = "Value";
  CompletionItemKind2[CompletionItemKind2["Constant"] = 14] = "Constant";
  CompletionItemKind2[CompletionItemKind2["Enum"] = 15] = "Enum";
  CompletionItemKind2[CompletionItemKind2["EnumMember"] = 16] = "EnumMember";
  CompletionItemKind2[CompletionItemKind2["Keyword"] = 17] = "Keyword";
  CompletionItemKind2[CompletionItemKind2["Text"] = 18] = "Text";
  CompletionItemKind2[CompletionItemKind2["Color"] = 19] = "Color";
  CompletionItemKind2[CompletionItemKind2["File"] = 20] = "File";
  CompletionItemKind2[CompletionItemKind2["Reference"] = 21] = "Reference";
  CompletionItemKind2[CompletionItemKind2["Customcolor"] = 22] = "Customcolor";
  CompletionItemKind2[CompletionItemKind2["Folder"] = 23] = "Folder";
  CompletionItemKind2[CompletionItemKind2["TypeParameter"] = 24] = "TypeParameter";
  CompletionItemKind2[CompletionItemKind2["User"] = 25] = "User";
  CompletionItemKind2[CompletionItemKind2["Issue"] = 26] = "Issue";
  CompletionItemKind2[CompletionItemKind2["Snippet"] = 27] = "Snippet";
  return CompletionItemKind2;
})(CompletionItemKind || {});
var CompletionItemTag = /* @__PURE__ */ ((CompletionItemTag2) => {
  CompletionItemTag2[CompletionItemTag2["Deprecated"] = 1] = "Deprecated";
  return CompletionItemTag2;
})(CompletionItemTag || {});
var CompletionTriggerKind = /* @__PURE__ */ ((CompletionTriggerKind2) => {
  CompletionTriggerKind2[CompletionTriggerKind2["Invoke"] = 0] = "Invoke";
  CompletionTriggerKind2[CompletionTriggerKind2["TriggerCharacter"] = 1] = "TriggerCharacter";
  CompletionTriggerKind2[CompletionTriggerKind2["TriggerForIncompleteCompletions"] = 2] = "TriggerForIncompleteCompletions";
  return CompletionTriggerKind2;
})(CompletionTriggerKind || {});
var ContentWidgetPositionPreference = /* @__PURE__ */ ((ContentWidgetPositionPreference2) => {
  ContentWidgetPositionPreference2[ContentWidgetPositionPreference2["EXACT"] = 0] = "EXACT";
  ContentWidgetPositionPreference2[ContentWidgetPositionPreference2["ABOVE"] = 1] = "ABOVE";
  ContentWidgetPositionPreference2[ContentWidgetPositionPreference2["BELOW"] = 2] = "BELOW";
  return ContentWidgetPositionPreference2;
})(ContentWidgetPositionPreference || {});
var CursorChangeReason = /* @__PURE__ */ ((CursorChangeReason2) => {
  CursorChangeReason2[CursorChangeReason2["NotSet"] = 0] = "NotSet";
  CursorChangeReason2[CursorChangeReason2["ContentFlush"] = 1] = "ContentFlush";
  CursorChangeReason2[CursorChangeReason2["RecoverFromMarkers"] = 2] = "RecoverFromMarkers";
  CursorChangeReason2[CursorChangeReason2["Explicit"] = 3] = "Explicit";
  CursorChangeReason2[CursorChangeReason2["Paste"] = 4] = "Paste";
  CursorChangeReason2[CursorChangeReason2["Undo"] = 5] = "Undo";
  CursorChangeReason2[CursorChangeReason2["Redo"] = 6] = "Redo";
  return CursorChangeReason2;
})(CursorChangeReason || {});
var DefaultEndOfLine = /* @__PURE__ */ ((DefaultEndOfLine2) => {
  DefaultEndOfLine2[DefaultEndOfLine2["LF"] = 1] = "LF";
  DefaultEndOfLine2[DefaultEndOfLine2["CRLF"] = 2] = "CRLF";
  return DefaultEndOfLine2;
})(DefaultEndOfLine || {});
var DocumentHighlightKind = /* @__PURE__ */ ((DocumentHighlightKind2) => {
  DocumentHighlightKind2[DocumentHighlightKind2["Text"] = 0] = "Text";
  DocumentHighlightKind2[DocumentHighlightKind2["Read"] = 1] = "Read";
  DocumentHighlightKind2[DocumentHighlightKind2["Write"] = 2] = "Write";
  return DocumentHighlightKind2;
})(DocumentHighlightKind || {});
var EditorAutoIndentStrategy = /* @__PURE__ */ ((EditorAutoIndentStrategy2) => {
  EditorAutoIndentStrategy2[EditorAutoIndentStrategy2["None"] = 0] = "None";
  EditorAutoIndentStrategy2[EditorAutoIndentStrategy2["Keep"] = 1] = "Keep";
  EditorAutoIndentStrategy2[EditorAutoIndentStrategy2["Brackets"] = 2] = "Brackets";
  EditorAutoIndentStrategy2[EditorAutoIndentStrategy2["Advanced"] = 3] = "Advanced";
  EditorAutoIndentStrategy2[EditorAutoIndentStrategy2["Full"] = 4] = "Full";
  return EditorAutoIndentStrategy2;
})(EditorAutoIndentStrategy || {});
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
var EndOfLinePreference = /* @__PURE__ */ ((EndOfLinePreference2) => {
  EndOfLinePreference2[EndOfLinePreference2["TextDefined"] = 0] = "TextDefined";
  EndOfLinePreference2[EndOfLinePreference2["LF"] = 1] = "LF";
  EndOfLinePreference2[EndOfLinePreference2["CRLF"] = 2] = "CRLF";
  return EndOfLinePreference2;
})(EndOfLinePreference || {});
var EndOfLineSequence = /* @__PURE__ */ ((EndOfLineSequence2) => {
  EndOfLineSequence2[EndOfLineSequence2["LF"] = 0] = "LF";
  EndOfLineSequence2[EndOfLineSequence2["CRLF"] = 1] = "CRLF";
  return EndOfLineSequence2;
})(EndOfLineSequence || {});
var GlyphMarginLane = /* @__PURE__ */ ((GlyphMarginLane2) => {
  GlyphMarginLane2[GlyphMarginLane2["Left"] = 1] = "Left";
  GlyphMarginLane2[GlyphMarginLane2["Center"] = 2] = "Center";
  GlyphMarginLane2[GlyphMarginLane2["Right"] = 3] = "Right";
  return GlyphMarginLane2;
})(GlyphMarginLane || {});
var HoverVerbosityAction = /* @__PURE__ */ ((HoverVerbosityAction2) => {
  HoverVerbosityAction2[HoverVerbosityAction2["Increase"] = 0] = "Increase";
  HoverVerbosityAction2[HoverVerbosityAction2["Decrease"] = 1] = "Decrease";
  return HoverVerbosityAction2;
})(HoverVerbosityAction || {});
var IndentAction = /* @__PURE__ */ ((IndentAction2) => {
  IndentAction2[IndentAction2["None"] = 0] = "None";
  IndentAction2[IndentAction2["Indent"] = 1] = "Indent";
  IndentAction2[IndentAction2["IndentOutdent"] = 2] = "IndentOutdent";
  IndentAction2[IndentAction2["Outdent"] = 3] = "Outdent";
  return IndentAction2;
})(IndentAction || {});
var InjectedTextCursorStops = /* @__PURE__ */ ((InjectedTextCursorStops2) => {
  InjectedTextCursorStops2[InjectedTextCursorStops2["Both"] = 0] = "Both";
  InjectedTextCursorStops2[InjectedTextCursorStops2["Right"] = 1] = "Right";
  InjectedTextCursorStops2[InjectedTextCursorStops2["Left"] = 2] = "Left";
  InjectedTextCursorStops2[InjectedTextCursorStops2["None"] = 3] = "None";
  return InjectedTextCursorStops2;
})(InjectedTextCursorStops || {});
var InlayHintKind = /* @__PURE__ */ ((InlayHintKind2) => {
  InlayHintKind2[InlayHintKind2["Type"] = 1] = "Type";
  InlayHintKind2[InlayHintKind2["Parameter"] = 2] = "Parameter";
  return InlayHintKind2;
})(InlayHintKind || {});
var InlineCompletionTriggerKind = /* @__PURE__ */ ((InlineCompletionTriggerKind2) => {
  InlineCompletionTriggerKind2[InlineCompletionTriggerKind2["Automatic"] = 0] = "Automatic";
  InlineCompletionTriggerKind2[InlineCompletionTriggerKind2["Explicit"] = 1] = "Explicit";
  return InlineCompletionTriggerKind2;
})(InlineCompletionTriggerKind || {});
var InlineEditTriggerKind = /* @__PURE__ */ ((InlineEditTriggerKind2) => {
  InlineEditTriggerKind2[InlineEditTriggerKind2["Invoke"] = 0] = "Invoke";
  InlineEditTriggerKind2[InlineEditTriggerKind2["Automatic"] = 1] = "Automatic";
  return InlineEditTriggerKind2;
})(InlineEditTriggerKind || {});
var KeyCode = /* @__PURE__ */ ((KeyCode2) => {
  KeyCode2[KeyCode2["DependsOnKbLayout"] = -1] = "DependsOnKbLayout";
  KeyCode2[KeyCode2["Unknown"] = 0] = "Unknown";
  KeyCode2[KeyCode2["Backspace"] = 1] = "Backspace";
  KeyCode2[KeyCode2["Tab"] = 2] = "Tab";
  KeyCode2[KeyCode2["Enter"] = 3] = "Enter";
  KeyCode2[KeyCode2["Shift"] = 4] = "Shift";
  KeyCode2[KeyCode2["Ctrl"] = 5] = "Ctrl";
  KeyCode2[KeyCode2["Alt"] = 6] = "Alt";
  KeyCode2[KeyCode2["PauseBreak"] = 7] = "PauseBreak";
  KeyCode2[KeyCode2["CapsLock"] = 8] = "CapsLock";
  KeyCode2[KeyCode2["Escape"] = 9] = "Escape";
  KeyCode2[KeyCode2["Space"] = 10] = "Space";
  KeyCode2[KeyCode2["PageUp"] = 11] = "PageUp";
  KeyCode2[KeyCode2["PageDown"] = 12] = "PageDown";
  KeyCode2[KeyCode2["End"] = 13] = "End";
  KeyCode2[KeyCode2["Home"] = 14] = "Home";
  KeyCode2[KeyCode2["LeftArrow"] = 15] = "LeftArrow";
  KeyCode2[KeyCode2["UpArrow"] = 16] = "UpArrow";
  KeyCode2[KeyCode2["RightArrow"] = 17] = "RightArrow";
  KeyCode2[KeyCode2["DownArrow"] = 18] = "DownArrow";
  KeyCode2[KeyCode2["Insert"] = 19] = "Insert";
  KeyCode2[KeyCode2["Delete"] = 20] = "Delete";
  KeyCode2[KeyCode2["Digit0"] = 21] = "Digit0";
  KeyCode2[KeyCode2["Digit1"] = 22] = "Digit1";
  KeyCode2[KeyCode2["Digit2"] = 23] = "Digit2";
  KeyCode2[KeyCode2["Digit3"] = 24] = "Digit3";
  KeyCode2[KeyCode2["Digit4"] = 25] = "Digit4";
  KeyCode2[KeyCode2["Digit5"] = 26] = "Digit5";
  KeyCode2[KeyCode2["Digit6"] = 27] = "Digit6";
  KeyCode2[KeyCode2["Digit7"] = 28] = "Digit7";
  KeyCode2[KeyCode2["Digit8"] = 29] = "Digit8";
  KeyCode2[KeyCode2["Digit9"] = 30] = "Digit9";
  KeyCode2[KeyCode2["KeyA"] = 31] = "KeyA";
  KeyCode2[KeyCode2["KeyB"] = 32] = "KeyB";
  KeyCode2[KeyCode2["KeyC"] = 33] = "KeyC";
  KeyCode2[KeyCode2["KeyD"] = 34] = "KeyD";
  KeyCode2[KeyCode2["KeyE"] = 35] = "KeyE";
  KeyCode2[KeyCode2["KeyF"] = 36] = "KeyF";
  KeyCode2[KeyCode2["KeyG"] = 37] = "KeyG";
  KeyCode2[KeyCode2["KeyH"] = 38] = "KeyH";
  KeyCode2[KeyCode2["KeyI"] = 39] = "KeyI";
  KeyCode2[KeyCode2["KeyJ"] = 40] = "KeyJ";
  KeyCode2[KeyCode2["KeyK"] = 41] = "KeyK";
  KeyCode2[KeyCode2["KeyL"] = 42] = "KeyL";
  KeyCode2[KeyCode2["KeyM"] = 43] = "KeyM";
  KeyCode2[KeyCode2["KeyN"] = 44] = "KeyN";
  KeyCode2[KeyCode2["KeyO"] = 45] = "KeyO";
  KeyCode2[KeyCode2["KeyP"] = 46] = "KeyP";
  KeyCode2[KeyCode2["KeyQ"] = 47] = "KeyQ";
  KeyCode2[KeyCode2["KeyR"] = 48] = "KeyR";
  KeyCode2[KeyCode2["KeyS"] = 49] = "KeyS";
  KeyCode2[KeyCode2["KeyT"] = 50] = "KeyT";
  KeyCode2[KeyCode2["KeyU"] = 51] = "KeyU";
  KeyCode2[KeyCode2["KeyV"] = 52] = "KeyV";
  KeyCode2[KeyCode2["KeyW"] = 53] = "KeyW";
  KeyCode2[KeyCode2["KeyX"] = 54] = "KeyX";
  KeyCode2[KeyCode2["KeyY"] = 55] = "KeyY";
  KeyCode2[KeyCode2["KeyZ"] = 56] = "KeyZ";
  KeyCode2[KeyCode2["Meta"] = 57] = "Meta";
  KeyCode2[KeyCode2["ContextMenu"] = 58] = "ContextMenu";
  KeyCode2[KeyCode2["F1"] = 59] = "F1";
  KeyCode2[KeyCode2["F2"] = 60] = "F2";
  KeyCode2[KeyCode2["F3"] = 61] = "F3";
  KeyCode2[KeyCode2["F4"] = 62] = "F4";
  KeyCode2[KeyCode2["F5"] = 63] = "F5";
  KeyCode2[KeyCode2["F6"] = 64] = "F6";
  KeyCode2[KeyCode2["F7"] = 65] = "F7";
  KeyCode2[KeyCode2["F8"] = 66] = "F8";
  KeyCode2[KeyCode2["F9"] = 67] = "F9";
  KeyCode2[KeyCode2["F10"] = 68] = "F10";
  KeyCode2[KeyCode2["F11"] = 69] = "F11";
  KeyCode2[KeyCode2["F12"] = 70] = "F12";
  KeyCode2[KeyCode2["F13"] = 71] = "F13";
  KeyCode2[KeyCode2["F14"] = 72] = "F14";
  KeyCode2[KeyCode2["F15"] = 73] = "F15";
  KeyCode2[KeyCode2["F16"] = 74] = "F16";
  KeyCode2[KeyCode2["F17"] = 75] = "F17";
  KeyCode2[KeyCode2["F18"] = 76] = "F18";
  KeyCode2[KeyCode2["F19"] = 77] = "F19";
  KeyCode2[KeyCode2["F20"] = 78] = "F20";
  KeyCode2[KeyCode2["F21"] = 79] = "F21";
  KeyCode2[KeyCode2["F22"] = 80] = "F22";
  KeyCode2[KeyCode2["F23"] = 81] = "F23";
  KeyCode2[KeyCode2["F24"] = 82] = "F24";
  KeyCode2[KeyCode2["NumLock"] = 83] = "NumLock";
  KeyCode2[KeyCode2["ScrollLock"] = 84] = "ScrollLock";
  KeyCode2[KeyCode2["Semicolon"] = 85] = "Semicolon";
  KeyCode2[KeyCode2["Equal"] = 86] = "Equal";
  KeyCode2[KeyCode2["Comma"] = 87] = "Comma";
  KeyCode2[KeyCode2["Minus"] = 88] = "Minus";
  KeyCode2[KeyCode2["Period"] = 89] = "Period";
  KeyCode2[KeyCode2["Slash"] = 90] = "Slash";
  KeyCode2[KeyCode2["Backquote"] = 91] = "Backquote";
  KeyCode2[KeyCode2["BracketLeft"] = 92] = "BracketLeft";
  KeyCode2[KeyCode2["Backslash"] = 93] = "Backslash";
  KeyCode2[KeyCode2["BracketRight"] = 94] = "BracketRight";
  KeyCode2[KeyCode2["Quote"] = 95] = "Quote";
  KeyCode2[KeyCode2["OEM_8"] = 96] = "OEM_8";
  KeyCode2[KeyCode2["IntlBackslash"] = 97] = "IntlBackslash";
  KeyCode2[KeyCode2["Numpad0"] = 98] = "Numpad0";
  KeyCode2[KeyCode2["Numpad1"] = 99] = "Numpad1";
  KeyCode2[KeyCode2["Numpad2"] = 100] = "Numpad2";
  KeyCode2[KeyCode2["Numpad3"] = 101] = "Numpad3";
  KeyCode2[KeyCode2["Numpad4"] = 102] = "Numpad4";
  KeyCode2[KeyCode2["Numpad5"] = 103] = "Numpad5";
  KeyCode2[KeyCode2["Numpad6"] = 104] = "Numpad6";
  KeyCode2[KeyCode2["Numpad7"] = 105] = "Numpad7";
  KeyCode2[KeyCode2["Numpad8"] = 106] = "Numpad8";
  KeyCode2[KeyCode2["Numpad9"] = 107] = "Numpad9";
  KeyCode2[KeyCode2["NumpadMultiply"] = 108] = "NumpadMultiply";
  KeyCode2[KeyCode2["NumpadAdd"] = 109] = "NumpadAdd";
  KeyCode2[KeyCode2["NUMPAD_SEPARATOR"] = 110] = "NUMPAD_SEPARATOR";
  KeyCode2[KeyCode2["NumpadSubtract"] = 111] = "NumpadSubtract";
  KeyCode2[KeyCode2["NumpadDecimal"] = 112] = "NumpadDecimal";
  KeyCode2[KeyCode2["NumpadDivide"] = 113] = "NumpadDivide";
  KeyCode2[KeyCode2["KEY_IN_COMPOSITION"] = 114] = "KEY_IN_COMPOSITION";
  KeyCode2[KeyCode2["ABNT_C1"] = 115] = "ABNT_C1";
  KeyCode2[KeyCode2["ABNT_C2"] = 116] = "ABNT_C2";
  KeyCode2[KeyCode2["AudioVolumeMute"] = 117] = "AudioVolumeMute";
  KeyCode2[KeyCode2["AudioVolumeUp"] = 118] = "AudioVolumeUp";
  KeyCode2[KeyCode2["AudioVolumeDown"] = 119] = "AudioVolumeDown";
  KeyCode2[KeyCode2["BrowserSearch"] = 120] = "BrowserSearch";
  KeyCode2[KeyCode2["BrowserHome"] = 121] = "BrowserHome";
  KeyCode2[KeyCode2["BrowserBack"] = 122] = "BrowserBack";
  KeyCode2[KeyCode2["BrowserForward"] = 123] = "BrowserForward";
  KeyCode2[KeyCode2["MediaTrackNext"] = 124] = "MediaTrackNext";
  KeyCode2[KeyCode2["MediaTrackPrevious"] = 125] = "MediaTrackPrevious";
  KeyCode2[KeyCode2["MediaStop"] = 126] = "MediaStop";
  KeyCode2[KeyCode2["MediaPlayPause"] = 127] = "MediaPlayPause";
  KeyCode2[KeyCode2["LaunchMediaPlayer"] = 128] = "LaunchMediaPlayer";
  KeyCode2[KeyCode2["LaunchMail"] = 129] = "LaunchMail";
  KeyCode2[KeyCode2["LaunchApp2"] = 130] = "LaunchApp2";
  KeyCode2[KeyCode2["Clear"] = 131] = "Clear";
  KeyCode2[KeyCode2["MAX_VALUE"] = 132] = "MAX_VALUE";
  return KeyCode2;
})(KeyCode || {});
var MarkerSeverity = /* @__PURE__ */ ((MarkerSeverity2) => {
  MarkerSeverity2[MarkerSeverity2["Hint"] = 1] = "Hint";
  MarkerSeverity2[MarkerSeverity2["Info"] = 2] = "Info";
  MarkerSeverity2[MarkerSeverity2["Warning"] = 4] = "Warning";
  MarkerSeverity2[MarkerSeverity2["Error"] = 8] = "Error";
  return MarkerSeverity2;
})(MarkerSeverity || {});
var MarkerTag = /* @__PURE__ */ ((MarkerTag2) => {
  MarkerTag2[MarkerTag2["Unnecessary"] = 1] = "Unnecessary";
  MarkerTag2[MarkerTag2["Deprecated"] = 2] = "Deprecated";
  return MarkerTag2;
})(MarkerTag || {});
var MinimapPosition = /* @__PURE__ */ ((MinimapPosition2) => {
  MinimapPosition2[MinimapPosition2["Inline"] = 1] = "Inline";
  MinimapPosition2[MinimapPosition2["Gutter"] = 2] = "Gutter";
  return MinimapPosition2;
})(MinimapPosition || {});
var MinimapSectionHeaderStyle = /* @__PURE__ */ ((MinimapSectionHeaderStyle2) => {
  MinimapSectionHeaderStyle2[MinimapSectionHeaderStyle2["Normal"] = 1] = "Normal";
  MinimapSectionHeaderStyle2[MinimapSectionHeaderStyle2["Underlined"] = 2] = "Underlined";
  return MinimapSectionHeaderStyle2;
})(MinimapSectionHeaderStyle || {});
var MouseTargetType = /* @__PURE__ */ ((MouseTargetType2) => {
  MouseTargetType2[MouseTargetType2["UNKNOWN"] = 0] = "UNKNOWN";
  MouseTargetType2[MouseTargetType2["TEXTAREA"] = 1] = "TEXTAREA";
  MouseTargetType2[MouseTargetType2["GUTTER_GLYPH_MARGIN"] = 2] = "GUTTER_GLYPH_MARGIN";
  MouseTargetType2[MouseTargetType2["GUTTER_LINE_NUMBERS"] = 3] = "GUTTER_LINE_NUMBERS";
  MouseTargetType2[MouseTargetType2["GUTTER_LINE_DECORATIONS"] = 4] = "GUTTER_LINE_DECORATIONS";
  MouseTargetType2[MouseTargetType2["GUTTER_VIEW_ZONE"] = 5] = "GUTTER_VIEW_ZONE";
  MouseTargetType2[MouseTargetType2["CONTENT_TEXT"] = 6] = "CONTENT_TEXT";
  MouseTargetType2[MouseTargetType2["CONTENT_EMPTY"] = 7] = "CONTENT_EMPTY";
  MouseTargetType2[MouseTargetType2["CONTENT_VIEW_ZONE"] = 8] = "CONTENT_VIEW_ZONE";
  MouseTargetType2[MouseTargetType2["CONTENT_WIDGET"] = 9] = "CONTENT_WIDGET";
  MouseTargetType2[MouseTargetType2["OVERVIEW_RULER"] = 10] = "OVERVIEW_RULER";
  MouseTargetType2[MouseTargetType2["SCROLLBAR"] = 11] = "SCROLLBAR";
  MouseTargetType2[MouseTargetType2["OVERLAY_WIDGET"] = 12] = "OVERLAY_WIDGET";
  MouseTargetType2[MouseTargetType2["OUTSIDE_EDITOR"] = 13] = "OUTSIDE_EDITOR";
  return MouseTargetType2;
})(MouseTargetType || {});
var NewSymbolNameTag = /* @__PURE__ */ ((NewSymbolNameTag2) => {
  NewSymbolNameTag2[NewSymbolNameTag2["AIGenerated"] = 1] = "AIGenerated";
  return NewSymbolNameTag2;
})(NewSymbolNameTag || {});
var NewSymbolNameTriggerKind = /* @__PURE__ */ ((NewSymbolNameTriggerKind2) => {
  NewSymbolNameTriggerKind2[NewSymbolNameTriggerKind2["Invoke"] = 0] = "Invoke";
  NewSymbolNameTriggerKind2[NewSymbolNameTriggerKind2["Automatic"] = 1] = "Automatic";
  return NewSymbolNameTriggerKind2;
})(NewSymbolNameTriggerKind || {});
var OverlayWidgetPositionPreference = /* @__PURE__ */ ((OverlayWidgetPositionPreference2) => {
  OverlayWidgetPositionPreference2[OverlayWidgetPositionPreference2["TOP_RIGHT_CORNER"] = 0] = "TOP_RIGHT_CORNER";
  OverlayWidgetPositionPreference2[OverlayWidgetPositionPreference2["BOTTOM_RIGHT_CORNER"] = 1] = "BOTTOM_RIGHT_CORNER";
  OverlayWidgetPositionPreference2[OverlayWidgetPositionPreference2["TOP_CENTER"] = 2] = "TOP_CENTER";
  return OverlayWidgetPositionPreference2;
})(OverlayWidgetPositionPreference || {});
var OverviewRulerLane = /* @__PURE__ */ ((OverviewRulerLane2) => {
  OverviewRulerLane2[OverviewRulerLane2["Left"] = 1] = "Left";
  OverviewRulerLane2[OverviewRulerLane2["Center"] = 2] = "Center";
  OverviewRulerLane2[OverviewRulerLane2["Right"] = 4] = "Right";
  OverviewRulerLane2[OverviewRulerLane2["Full"] = 7] = "Full";
  return OverviewRulerLane2;
})(OverviewRulerLane || {});
var PartialAcceptTriggerKind = /* @__PURE__ */ ((PartialAcceptTriggerKind2) => {
  PartialAcceptTriggerKind2[PartialAcceptTriggerKind2["Word"] = 0] = "Word";
  PartialAcceptTriggerKind2[PartialAcceptTriggerKind2["Line"] = 1] = "Line";
  PartialAcceptTriggerKind2[PartialAcceptTriggerKind2["Suggest"] = 2] = "Suggest";
  return PartialAcceptTriggerKind2;
})(PartialAcceptTriggerKind || {});
var PositionAffinity = /* @__PURE__ */ ((PositionAffinity2) => {
  PositionAffinity2[PositionAffinity2["Left"] = 0] = "Left";
  PositionAffinity2[PositionAffinity2["Right"] = 1] = "Right";
  PositionAffinity2[PositionAffinity2["None"] = 2] = "None";
  PositionAffinity2[PositionAffinity2["LeftOfInjectedText"] = 3] = "LeftOfInjectedText";
  PositionAffinity2[PositionAffinity2["RightOfInjectedText"] = 4] = "RightOfInjectedText";
  return PositionAffinity2;
})(PositionAffinity || {});
var RenderLineNumbersType = /* @__PURE__ */ ((RenderLineNumbersType2) => {
  RenderLineNumbersType2[RenderLineNumbersType2["Off"] = 0] = "Off";
  RenderLineNumbersType2[RenderLineNumbersType2["On"] = 1] = "On";
  RenderLineNumbersType2[RenderLineNumbersType2["Relative"] = 2] = "Relative";
  RenderLineNumbersType2[RenderLineNumbersType2["Interval"] = 3] = "Interval";
  RenderLineNumbersType2[RenderLineNumbersType2["Custom"] = 4] = "Custom";
  return RenderLineNumbersType2;
})(RenderLineNumbersType || {});
var RenderMinimap = /* @__PURE__ */ ((RenderMinimap2) => {
  RenderMinimap2[RenderMinimap2["None"] = 0] = "None";
  RenderMinimap2[RenderMinimap2["Text"] = 1] = "Text";
  RenderMinimap2[RenderMinimap2["Blocks"] = 2] = "Blocks";
  return RenderMinimap2;
})(RenderMinimap || {});
var ScrollType = /* @__PURE__ */ ((ScrollType2) => {
  ScrollType2[ScrollType2["Smooth"] = 0] = "Smooth";
  ScrollType2[ScrollType2["Immediate"] = 1] = "Immediate";
  return ScrollType2;
})(ScrollType || {});
var ScrollbarVisibility = /* @__PURE__ */ ((ScrollbarVisibility2) => {
  ScrollbarVisibility2[ScrollbarVisibility2["Auto"] = 1] = "Auto";
  ScrollbarVisibility2[ScrollbarVisibility2["Hidden"] = 2] = "Hidden";
  ScrollbarVisibility2[ScrollbarVisibility2["Visible"] = 3] = "Visible";
  return ScrollbarVisibility2;
})(ScrollbarVisibility || {});
var SelectionDirection = /* @__PURE__ */ ((SelectionDirection2) => {
  SelectionDirection2[SelectionDirection2["LTR"] = 0] = "LTR";
  SelectionDirection2[SelectionDirection2["RTL"] = 1] = "RTL";
  return SelectionDirection2;
})(SelectionDirection || {});
var ShowLightbulbIconMode = /* @__PURE__ */ ((ShowLightbulbIconMode2) => {
  ShowLightbulbIconMode2["Off"] = "off";
  ShowLightbulbIconMode2["OnCode"] = "onCode";
  ShowLightbulbIconMode2["On"] = "on";
  return ShowLightbulbIconMode2;
})(ShowLightbulbIconMode || {});
var SignatureHelpTriggerKind = /* @__PURE__ */ ((SignatureHelpTriggerKind2) => {
  SignatureHelpTriggerKind2[SignatureHelpTriggerKind2["Invoke"] = 1] = "Invoke";
  SignatureHelpTriggerKind2[SignatureHelpTriggerKind2["TriggerCharacter"] = 2] = "TriggerCharacter";
  SignatureHelpTriggerKind2[SignatureHelpTriggerKind2["ContentChange"] = 3] = "ContentChange";
  return SignatureHelpTriggerKind2;
})(SignatureHelpTriggerKind || {});
var SymbolKind = /* @__PURE__ */ ((SymbolKind2) => {
  SymbolKind2[SymbolKind2["File"] = 0] = "File";
  SymbolKind2[SymbolKind2["Module"] = 1] = "Module";
  SymbolKind2[SymbolKind2["Namespace"] = 2] = "Namespace";
  SymbolKind2[SymbolKind2["Package"] = 3] = "Package";
  SymbolKind2[SymbolKind2["Class"] = 4] = "Class";
  SymbolKind2[SymbolKind2["Method"] = 5] = "Method";
  SymbolKind2[SymbolKind2["Property"] = 6] = "Property";
  SymbolKind2[SymbolKind2["Field"] = 7] = "Field";
  SymbolKind2[SymbolKind2["Constructor"] = 8] = "Constructor";
  SymbolKind2[SymbolKind2["Enum"] = 9] = "Enum";
  SymbolKind2[SymbolKind2["Interface"] = 10] = "Interface";
  SymbolKind2[SymbolKind2["Function"] = 11] = "Function";
  SymbolKind2[SymbolKind2["Variable"] = 12] = "Variable";
  SymbolKind2[SymbolKind2["Constant"] = 13] = "Constant";
  SymbolKind2[SymbolKind2["String"] = 14] = "String";
  SymbolKind2[SymbolKind2["Number"] = 15] = "Number";
  SymbolKind2[SymbolKind2["Boolean"] = 16] = "Boolean";
  SymbolKind2[SymbolKind2["Array"] = 17] = "Array";
  SymbolKind2[SymbolKind2["Object"] = 18] = "Object";
  SymbolKind2[SymbolKind2["Key"] = 19] = "Key";
  SymbolKind2[SymbolKind2["Null"] = 20] = "Null";
  SymbolKind2[SymbolKind2["EnumMember"] = 21] = "EnumMember";
  SymbolKind2[SymbolKind2["Struct"] = 22] = "Struct";
  SymbolKind2[SymbolKind2["Event"] = 23] = "Event";
  SymbolKind2[SymbolKind2["Operator"] = 24] = "Operator";
  SymbolKind2[SymbolKind2["TypeParameter"] = 25] = "TypeParameter";
  return SymbolKind2;
})(SymbolKind || {});
var SymbolTag = /* @__PURE__ */ ((SymbolTag2) => {
  SymbolTag2[SymbolTag2["Deprecated"] = 1] = "Deprecated";
  return SymbolTag2;
})(SymbolTag || {});
var TextEditorCursorBlinkingStyle = /* @__PURE__ */ ((TextEditorCursorBlinkingStyle2) => {
  TextEditorCursorBlinkingStyle2[TextEditorCursorBlinkingStyle2["Hidden"] = 0] = "Hidden";
  TextEditorCursorBlinkingStyle2[TextEditorCursorBlinkingStyle2["Blink"] = 1] = "Blink";
  TextEditorCursorBlinkingStyle2[TextEditorCursorBlinkingStyle2["Smooth"] = 2] = "Smooth";
  TextEditorCursorBlinkingStyle2[TextEditorCursorBlinkingStyle2["Phase"] = 3] = "Phase";
  TextEditorCursorBlinkingStyle2[TextEditorCursorBlinkingStyle2["Expand"] = 4] = "Expand";
  TextEditorCursorBlinkingStyle2[TextEditorCursorBlinkingStyle2["Solid"] = 5] = "Solid";
  return TextEditorCursorBlinkingStyle2;
})(TextEditorCursorBlinkingStyle || {});
var TextEditorCursorStyle = /* @__PURE__ */ ((TextEditorCursorStyle2) => {
  TextEditorCursorStyle2[TextEditorCursorStyle2["Line"] = 1] = "Line";
  TextEditorCursorStyle2[TextEditorCursorStyle2["Block"] = 2] = "Block";
  TextEditorCursorStyle2[TextEditorCursorStyle2["Underline"] = 3] = "Underline";
  TextEditorCursorStyle2[TextEditorCursorStyle2["LineThin"] = 4] = "LineThin";
  TextEditorCursorStyle2[TextEditorCursorStyle2["BlockOutline"] = 5] = "BlockOutline";
  TextEditorCursorStyle2[TextEditorCursorStyle2["UnderlineThin"] = 6] = "UnderlineThin";
  return TextEditorCursorStyle2;
})(TextEditorCursorStyle || {});
var TrackedRangeStickiness = /* @__PURE__ */ ((TrackedRangeStickiness2) => {
  TrackedRangeStickiness2[TrackedRangeStickiness2["AlwaysGrowsWhenTypingAtEdges"] = 0] = "AlwaysGrowsWhenTypingAtEdges";
  TrackedRangeStickiness2[TrackedRangeStickiness2["NeverGrowsWhenTypingAtEdges"] = 1] = "NeverGrowsWhenTypingAtEdges";
  TrackedRangeStickiness2[TrackedRangeStickiness2["GrowsOnlyWhenTypingBefore"] = 2] = "GrowsOnlyWhenTypingBefore";
  TrackedRangeStickiness2[TrackedRangeStickiness2["GrowsOnlyWhenTypingAfter"] = 3] = "GrowsOnlyWhenTypingAfter";
  return TrackedRangeStickiness2;
})(TrackedRangeStickiness || {});
var WrappingIndent = /* @__PURE__ */ ((WrappingIndent2) => {
  WrappingIndent2[WrappingIndent2["None"] = 0] = "None";
  WrappingIndent2[WrappingIndent2["Same"] = 1] = "Same";
  WrappingIndent2[WrappingIndent2["Indent"] = 2] = "Indent";
  WrappingIndent2[WrappingIndent2["DeepIndent"] = 3] = "DeepIndent";
  return WrappingIndent2;
})(WrappingIndent || {});
export {
  AccessibilitySupport,
  CodeActionTriggerType,
  CompletionItemInsertTextRule,
  CompletionItemKind,
  CompletionItemTag,
  CompletionTriggerKind,
  ContentWidgetPositionPreference,
  CursorChangeReason,
  DefaultEndOfLine,
  DocumentHighlightKind,
  EditorAutoIndentStrategy,
  EditorOption,
  EndOfLinePreference,
  EndOfLineSequence,
  GlyphMarginLane,
  HoverVerbosityAction,
  IndentAction,
  InjectedTextCursorStops,
  InlayHintKind,
  InlineCompletionTriggerKind,
  InlineEditTriggerKind,
  KeyCode,
  MarkerSeverity,
  MarkerTag,
  MinimapPosition,
  MinimapSectionHeaderStyle,
  MouseTargetType,
  NewSymbolNameTag,
  NewSymbolNameTriggerKind,
  OverlayWidgetPositionPreference,
  OverviewRulerLane,
  PartialAcceptTriggerKind,
  PositionAffinity,
  RenderLineNumbersType,
  RenderMinimap,
  ScrollType,
  ScrollbarVisibility,
  SelectionDirection,
  ShowLightbulbIconMode,
  SignatureHelpTriggerKind,
  SymbolKind,
  SymbolTag,
  TextEditorCursorBlinkingStyle,
  TextEditorCursorStyle,
  TrackedRangeStickiness,
  WrappingIndent
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL3N0YW5kYWxvbmUvc3RhbmRhbG9uZUVudW1zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuLy8gVEhJUyBJUyBBIEdFTkVSQVRFRCBGSUxFLiBETyBOT1QgRURJVCBESVJFQ1RMWS5cblxuXG5leHBvcnQgZW51bSBBY2Nlc3NpYmlsaXR5U3VwcG9ydCB7XG5cdC8qKlxuXHQgKiBUaGlzIHNob3VsZCBiZSB0aGUgYnJvd3NlciBjYXNlIHdoZXJlIGl0IGlzIG5vdCBrbm93biBpZiBhIHNjcmVlbiByZWFkZXIgaXMgYXR0YWNoZWQgb3Igbm8uXG5cdCAqL1xuXHRVbmtub3duID0gMCxcblx0RGlzYWJsZWQgPSAxLFxuXHRFbmFibGVkID0gMlxufVxuXG5leHBvcnQgZW51bSBDb2RlQWN0aW9uVHJpZ2dlclR5cGUge1xuXHRJbnZva2UgPSAxLFxuXHRBdXRvID0gMlxufVxuXG5leHBvcnQgZW51bSBDb21wbGV0aW9uSXRlbUluc2VydFRleHRSdWxlIHtcblx0Tm9uZSA9IDAsXG5cdC8qKlxuXHQgKiBBZGp1c3Qgd2hpdGVzcGFjZS9pbmRlbnRhdGlvbiBvZiBtdWx0aWxpbmUgaW5zZXJ0IHRleHRzIHRvXG5cdCAqIG1hdGNoIHRoZSBjdXJyZW50IGxpbmUgaW5kZW50YXRpb24uXG5cdCAqL1xuXHRLZWVwV2hpdGVzcGFjZSA9IDEsXG5cdC8qKlxuXHQgKiBgaW5zZXJ0VGV4dGAgaXMgYSBzbmlwcGV0LlxuXHQgKi9cblx0SW5zZXJ0QXNTbmlwcGV0ID0gNFxufVxuXG5leHBvcnQgZW51bSBDb21wbGV0aW9uSXRlbUtpbmQge1xuXHRNZXRob2QgPSAwLFxuXHRGdW5jdGlvbiA9IDEsXG5cdENvbnN0cnVjdG9yID0gMixcblx0RmllbGQgPSAzLFxuXHRWYXJpYWJsZSA9IDQsXG5cdENsYXNzID0gNSxcblx0U3RydWN0ID0gNixcblx0SW50ZXJmYWNlID0gNyxcblx0TW9kdWxlID0gOCxcblx0UHJvcGVydHkgPSA5LFxuXHRFdmVudCA9IDEwLFxuXHRPcGVyYXRvciA9IDExLFxuXHRVbml0ID0gMTIsXG5cdFZhbHVlID0gMTMsXG5cdENvbnN0YW50ID0gMTQsXG5cdEVudW0gPSAxNSxcblx0RW51bU1lbWJlciA9IDE2LFxuXHRLZXl3b3JkID0gMTcsXG5cdFRleHQgPSAxOCxcblx0Q29sb3IgPSAxOSxcblx0RmlsZSA9IDIwLFxuXHRSZWZlcmVuY2UgPSAyMSxcblx0Q3VzdG9tY29sb3IgPSAyMixcblx0Rm9sZGVyID0gMjMsXG5cdFR5cGVQYXJhbWV0ZXIgPSAyNCxcblx0VXNlciA9IDI1LFxuXHRJc3N1ZSA9IDI2LFxuXHRTbmlwcGV0ID0gMjdcbn1cblxuZXhwb3J0IGVudW0gQ29tcGxldGlvbkl0ZW1UYWcge1xuXHREZXByZWNhdGVkID0gMVxufVxuXG4vKipcbiAqIEhvdyBhIHN1Z2dlc3QgcHJvdmlkZXIgd2FzIHRyaWdnZXJlZC5cbiAqL1xuZXhwb3J0IGVudW0gQ29tcGxldGlvblRyaWdnZXJLaW5kIHtcblx0SW52b2tlID0gMCxcblx0VHJpZ2dlckNoYXJhY3RlciA9IDEsXG5cdFRyaWdnZXJGb3JJbmNvbXBsZXRlQ29tcGxldGlvbnMgPSAyXG59XG5cbi8qKlxuICogQSBwb3NpdGlvbmluZyBwcmVmZXJlbmNlIGZvciByZW5kZXJpbmcgY29udGVudCB3aWRnZXRzLlxuICovXG5leHBvcnQgZW51bSBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlIHtcblx0LyoqXG5cdCAqIFBsYWNlIHRoZSBjb250ZW50IHdpZGdldCBleGFjdGx5IGF0IGEgcG9zaXRpb25cblx0ICovXG5cdEVYQUNUID0gMCxcblx0LyoqXG5cdCAqIFBsYWNlIHRoZSBjb250ZW50IHdpZGdldCBhYm92ZSBhIHBvc2l0aW9uXG5cdCAqL1xuXHRBQk9WRSA9IDEsXG5cdC8qKlxuXHQgKiBQbGFjZSB0aGUgY29udGVudCB3aWRnZXQgYmVsb3cgYSBwb3NpdGlvblxuXHQgKi9cblx0QkVMT1cgPSAyXG59XG5cbi8qKlxuICogRGVzY3JpYmVzIHRoZSByZWFzb24gdGhlIGN1cnNvciBoYXMgY2hhbmdlZCBpdHMgcG9zaXRpb24uXG4gKi9cbmV4cG9ydCBlbnVtIEN1cnNvckNoYW5nZVJlYXNvbiB7XG5cdC8qKlxuXHQgKiBVbmtub3duIG9yIG5vdCBzZXQuXG5cdCAqL1xuXHROb3RTZXQgPSAwLFxuXHQvKipcblx0ICogQSBgbW9kZWwuc2V0VmFsdWUoKWAgd2FzIGNhbGxlZC5cblx0ICovXG5cdENvbnRlbnRGbHVzaCA9IDEsXG5cdC8qKlxuXHQgKiBUaGUgYG1vZGVsYCBoYXMgYmVlbiBjaGFuZ2VkIG91dHNpZGUgb2YgdGhpcyBjdXJzb3IgYW5kIHRoZSBjdXJzb3IgcmVjb3ZlcnMgaXRzIHBvc2l0aW9uIGZyb20gYXNzb2NpYXRlZCBtYXJrZXJzLlxuXHQgKi9cblx0UmVjb3ZlckZyb21NYXJrZXJzID0gMixcblx0LyoqXG5cdCAqIFRoZXJlIHdhcyBhbiBleHBsaWNpdCB1c2VyIGdlc3R1cmUuXG5cdCAqL1xuXHRFeHBsaWNpdCA9IDMsXG5cdC8qKlxuXHQgKiBUaGVyZSB3YXMgYSBQYXN0ZS5cblx0ICovXG5cdFBhc3RlID0gNCxcblx0LyoqXG5cdCAqIFRoZXJlIHdhcyBhbiBVbmRvLlxuXHQgKi9cblx0VW5kbyA9IDUsXG5cdC8qKlxuXHQgKiBUaGVyZSB3YXMgYSBSZWRvLlxuXHQgKi9cblx0UmVkbyA9IDZcbn1cblxuLyoqXG4gKiBUaGUgZGVmYXVsdCBlbmQgb2YgbGluZSB0byB1c2Ugd2hlbiBpbnN0YW50aWF0aW5nIG1vZGVscy5cbiAqL1xuZXhwb3J0IGVudW0gRGVmYXVsdEVuZE9mTGluZSB7XG5cdC8qKlxuXHQgKiBVc2UgbGluZSBmZWVkIChcXG4pIGFzIHRoZSBlbmQgb2YgbGluZSBjaGFyYWN0ZXIuXG5cdCAqL1xuXHRMRiA9IDEsXG5cdC8qKlxuXHQgKiBVc2UgY2FycmlhZ2UgcmV0dXJuIGFuZCBsaW5lIGZlZWQgKFxcclxcbikgYXMgdGhlIGVuZCBvZiBsaW5lIGNoYXJhY3Rlci5cblx0ICovXG5cdENSTEYgPSAyXG59XG5cbi8qKlxuICogQSBkb2N1bWVudCBoaWdobGlnaHQga2luZC5cbiAqL1xuZXhwb3J0IGVudW0gRG9jdW1lbnRIaWdobGlnaHRLaW5kIHtcblx0LyoqXG5cdCAqIEEgdGV4dHVhbCBvY2N1cnJlbmNlLlxuXHQgKi9cblx0VGV4dCA9IDAsXG5cdC8qKlxuXHQgKiBSZWFkLWFjY2VzcyBvZiBhIHN5bWJvbCwgbGlrZSByZWFkaW5nIGEgdmFyaWFibGUuXG5cdCAqL1xuXHRSZWFkID0gMSxcblx0LyoqXG5cdCAqIFdyaXRlLWFjY2VzcyBvZiBhIHN5bWJvbCwgbGlrZSB3cml0aW5nIHRvIGEgdmFyaWFibGUuXG5cdCAqL1xuXHRXcml0ZSA9IDJcbn1cblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIGF1dG8gaW5kZW50YXRpb24gaW4gdGhlIGVkaXRvclxuICovXG5leHBvcnQgZW51bSBFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kge1xuXHROb25lID0gMCxcblx0S2VlcCA9IDEsXG5cdEJyYWNrZXRzID0gMixcblx0QWR2YW5jZWQgPSAzLFxuXHRGdWxsID0gNFxufVxuXG5leHBvcnQgZW51bSBFZGl0b3JPcHRpb24ge1xuXHRhY2NlcHRTdWdnZXN0aW9uT25Db21taXRDaGFyYWN0ZXIgPSAwLFxuXHRhY2NlcHRTdWdnZXN0aW9uT25FbnRlciA9IDEsXG5cdGFjY2Vzc2liaWxpdHlTdXBwb3J0ID0gMixcblx0YWNjZXNzaWJpbGl0eVBhZ2VTaXplID0gMyxcblx0YXJpYUxhYmVsID0gNCxcblx0YXJpYVJlcXVpcmVkID0gNSxcblx0YXV0b0Nsb3NpbmdCcmFja2V0cyA9IDYsXG5cdGF1dG9DbG9zaW5nQ29tbWVudHMgPSA3LFxuXHRzY3JlZW5SZWFkZXJBbm5vdW5jZUlubGluZVN1Z2dlc3Rpb24gPSA4LFxuXHRhdXRvQ2xvc2luZ0RlbGV0ZSA9IDksXG5cdGF1dG9DbG9zaW5nT3ZlcnR5cGUgPSAxMCxcblx0YXV0b0Nsb3NpbmdRdW90ZXMgPSAxMSxcblx0YXV0b0luZGVudCA9IDEyLFxuXHRhdXRvbWF0aWNMYXlvdXQgPSAxMyxcblx0YXV0b1N1cnJvdW5kID0gMTQsXG5cdGJyYWNrZXRQYWlyQ29sb3JpemF0aW9uID0gMTUsXG5cdGd1aWRlcyA9IDE2LFxuXHRjb2RlTGVucyA9IDE3LFxuXHRjb2RlTGVuc0ZvbnRGYW1pbHkgPSAxOCxcblx0Y29kZUxlbnNGb250U2l6ZSA9IDE5LFxuXHRjb2xvckRlY29yYXRvcnMgPSAyMCxcblx0Y29sb3JEZWNvcmF0b3JzTGltaXQgPSAyMSxcblx0Y29sdW1uU2VsZWN0aW9uID0gMjIsXG5cdGNvbW1lbnRzID0gMjMsXG5cdGNvbnRleHRtZW51ID0gMjQsXG5cdGNvcHlXaXRoU3ludGF4SGlnaGxpZ2h0aW5nID0gMjUsXG5cdGN1cnNvckJsaW5raW5nID0gMjYsXG5cdGN1cnNvclNtb290aENhcmV0QW5pbWF0aW9uID0gMjcsXG5cdGN1cnNvclN0eWxlID0gMjgsXG5cdGN1cnNvclN1cnJvdW5kaW5nTGluZXMgPSAyOSxcblx0Y3Vyc29yU3Vycm91bmRpbmdMaW5lc1N0eWxlID0gMzAsXG5cdGN1cnNvcldpZHRoID0gMzEsXG5cdGRpc2FibGVMYXllckhpbnRpbmcgPSAzMixcblx0ZGlzYWJsZU1vbm9zcGFjZU9wdGltaXphdGlvbnMgPSAzMyxcblx0ZG9tUmVhZE9ubHkgPSAzNCxcblx0ZHJhZ0FuZERyb3AgPSAzNSxcblx0ZHJvcEludG9FZGl0b3IgPSAzNixcblx0ZXhwZXJpbWVudGFsRWRpdENvbnRleHRFbmFibGVkID0gMzcsXG5cdGVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkID0gMzgsXG5cdGV4cGVyaW1lbnRhbEdwdUFjY2VsZXJhdGlvbiA9IDM5LFxuXHRleHBlcmltZW50YWxXaGl0ZXNwYWNlUmVuZGVyaW5nID0gNDAsXG5cdGV4dHJhRWRpdG9yQ2xhc3NOYW1lID0gNDEsXG5cdGZhc3RTY3JvbGxTZW5zaXRpdml0eSA9IDQyLFxuXHRmaW5kID0gNDMsXG5cdGZpeGVkT3ZlcmZsb3dXaWRnZXRzID0gNDQsXG5cdGZvbGRpbmcgPSA0NSxcblx0Zm9sZGluZ1N0cmF0ZWd5ID0gNDYsXG5cdGZvbGRpbmdIaWdobGlnaHQgPSA0Nyxcblx0Zm9sZGluZ0ltcG9ydHNCeURlZmF1bHQgPSA0OCxcblx0Zm9sZGluZ01heGltdW1SZWdpb25zID0gNDksXG5cdHVuZm9sZE9uQ2xpY2tBZnRlckVuZE9mTGluZSA9IDUwLFxuXHRmb250RmFtaWx5ID0gNTEsXG5cdGZvbnRJbmZvID0gNTIsXG5cdGZvbnRMaWdhdHVyZXMgPSA1Myxcblx0Zm9udFNpemUgPSA1NCxcblx0Zm9udFdlaWdodCA9IDU1LFxuXHRmb250VmFyaWF0aW9ucyA9IDU2LFxuXHRmb3JtYXRPblBhc3RlID0gNTcsXG5cdGZvcm1hdE9uVHlwZSA9IDU4LFxuXHRnbHlwaE1hcmdpbiA9IDU5LFxuXHRnb3RvTG9jYXRpb24gPSA2MCxcblx0aGlkZUN1cnNvckluT3ZlcnZpZXdSdWxlciA9IDYxLFxuXHRob3ZlciA9IDYyLFxuXHRpbkRpZmZFZGl0b3IgPSA2Myxcblx0aW5saW5lU3VnZ2VzdCA9IDY0LFxuXHRsZXR0ZXJTcGFjaW5nID0gNjUsXG5cdGxpZ2h0YnVsYiA9IDY2LFxuXHRsaW5lRGVjb3JhdGlvbnNXaWR0aCA9IDY3LFxuXHRsaW5lSGVpZ2h0ID0gNjgsXG5cdGxpbmVOdW1iZXJzID0gNjksXG5cdGxpbmVOdW1iZXJzTWluQ2hhcnMgPSA3MCxcblx0bGlua2VkRWRpdGluZyA9IDcxLFxuXHRsaW5rcyA9IDcyLFxuXHRtYXRjaEJyYWNrZXRzID0gNzMsXG5cdG1pbmltYXAgPSA3NCxcblx0bW91c2VTdHlsZSA9IDc1LFxuXHRtb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHkgPSA3Nixcblx0bW91c2VXaGVlbFpvb20gPSA3Nyxcblx0bXVsdGlDdXJzb3JNZXJnZU92ZXJsYXBwaW5nID0gNzgsXG5cdG11bHRpQ3Vyc29yTW9kaWZpZXIgPSA3OSxcblx0bXVsdGlDdXJzb3JQYXN0ZSA9IDgwLFxuXHRtdWx0aUN1cnNvckxpbWl0ID0gODEsXG5cdG9jY3VycmVuY2VzSGlnaGxpZ2h0ID0gODIsXG5cdG9jY3VycmVuY2VzSGlnaGxpZ2h0RGVsYXkgPSA4Myxcblx0b3ZlcnR5cGVDdXJzb3JTdHlsZSA9IDg0LFxuXHRvdmVydHlwZU9uUGFzdGUgPSA4NSxcblx0b3ZlcnZpZXdSdWxlckJvcmRlciA9IDg2LFxuXHRvdmVydmlld1J1bGVyTGFuZXMgPSA4Nyxcblx0cGFkZGluZyA9IDg4LFxuXHRwYXN0ZUFzID0gODksXG5cdHBhcmFtZXRlckhpbnRzID0gOTAsXG5cdHBlZWtXaWRnZXREZWZhdWx0Rm9jdXMgPSA5MSxcblx0cGxhY2Vob2xkZXIgPSA5Mixcblx0ZGVmaW5pdGlvbkxpbmtPcGVuc0luUGVlayA9IDkzLFxuXHRxdWlja1N1Z2dlc3Rpb25zID0gOTQsXG5cdHF1aWNrU3VnZ2VzdGlvbnNEZWxheSA9IDk1LFxuXHRyZWFkT25seSA9IDk2LFxuXHRyZWFkT25seU1lc3NhZ2UgPSA5Nyxcblx0cmVuYW1lT25UeXBlID0gOTgsXG5cdHJlbmRlckNvbnRyb2xDaGFyYWN0ZXJzID0gOTksXG5cdHJlbmRlckZpbmFsTmV3bGluZSA9IDEwMCxcblx0cmVuZGVyTGluZUhpZ2hsaWdodCA9IDEwMSxcblx0cmVuZGVyTGluZUhpZ2hsaWdodE9ubHlXaGVuRm9jdXMgPSAxMDIsXG5cdHJlbmRlclZhbGlkYXRpb25EZWNvcmF0aW9ucyA9IDEwMyxcblx0cmVuZGVyV2hpdGVzcGFjZSA9IDEwNCxcblx0cmV2ZWFsSG9yaXpvbnRhbFJpZ2h0UGFkZGluZyA9IDEwNSxcblx0cm91bmRlZFNlbGVjdGlvbiA9IDEwNixcblx0cnVsZXJzID0gMTA3LFxuXHRzY3JvbGxiYXIgPSAxMDgsXG5cdHNjcm9sbEJleW9uZExhc3RDb2x1bW4gPSAxMDksXG5cdHNjcm9sbEJleW9uZExhc3RMaW5lID0gMTEwLFxuXHRzY3JvbGxQcmVkb21pbmFudEF4aXMgPSAxMTEsXG5cdHNlbGVjdGlvbkNsaXBib2FyZCA9IDExMixcblx0c2VsZWN0aW9uSGlnaGxpZ2h0ID0gMTEzLFxuXHRzZWxlY3RPbkxpbmVOdW1iZXJzID0gMTE0LFxuXHRzaG93Rm9sZGluZ0NvbnRyb2xzID0gMTE1LFxuXHRzaG93VW51c2VkID0gMTE2LFxuXHRzbmlwcGV0U3VnZ2VzdGlvbnMgPSAxMTcsXG5cdHNtYXJ0U2VsZWN0ID0gMTE4LFxuXHRzbW9vdGhTY3JvbGxpbmcgPSAxMTksXG5cdHN0aWNreVNjcm9sbCA9IDEyMCxcblx0c3RpY2t5VGFiU3RvcHMgPSAxMjEsXG5cdHN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXIgPSAxMjIsXG5cdHN1Z2dlc3QgPSAxMjMsXG5cdHN1Z2dlc3RGb250U2l6ZSA9IDEyNCxcblx0c3VnZ2VzdExpbmVIZWlnaHQgPSAxMjUsXG5cdHN1Z2dlc3RPblRyaWdnZXJDaGFyYWN0ZXJzID0gMTI2LFxuXHRzdWdnZXN0U2VsZWN0aW9uID0gMTI3LFxuXHR0YWJDb21wbGV0aW9uID0gMTI4LFxuXHR0YWJJbmRleCA9IDEyOSxcblx0dW5pY29kZUhpZ2hsaWdodGluZyA9IDEzMCxcblx0dW51c3VhbExpbmVUZXJtaW5hdG9ycyA9IDEzMSxcblx0dXNlU2hhZG93RE9NID0gMTMyLFxuXHR1c2VUYWJTdG9wcyA9IDEzMyxcblx0d29yZEJyZWFrID0gMTM0LFxuXHR3b3JkU2VnbWVudGVyTG9jYWxlcyA9IDEzNSxcblx0d29yZFNlcGFyYXRvcnMgPSAxMzYsXG5cdHdvcmRXcmFwID0gMTM3LFxuXHR3b3JkV3JhcEJyZWFrQWZ0ZXJDaGFyYWN0ZXJzID0gMTM4LFxuXHR3b3JkV3JhcEJyZWFrQmVmb3JlQ2hhcmFjdGVycyA9IDEzOSxcblx0d29yZFdyYXBDb2x1bW4gPSAxNDAsXG5cdHdvcmRXcmFwT3ZlcnJpZGUxID0gMTQxLFxuXHR3b3JkV3JhcE92ZXJyaWRlMiA9IDE0Mixcblx0d3JhcHBpbmdJbmRlbnQgPSAxNDMsXG5cdHdyYXBwaW5nU3RyYXRlZ3kgPSAxNDQsXG5cdHNob3dEZXByZWNhdGVkID0gMTQ1LFxuXHRpbmxheUhpbnRzID0gMTQ2LFxuXHRlZmZlY3RpdmVDdXJzb3JTdHlsZSA9IDE0Nyxcblx0ZWRpdG9yQ2xhc3NOYW1lID0gMTQ4LFxuXHRwaXhlbFJhdGlvID0gMTQ5LFxuXHR0YWJGb2N1c01vZGUgPSAxNTAsXG5cdGxheW91dEluZm8gPSAxNTEsXG5cdHdyYXBwaW5nSW5mbyA9IDE1Mixcblx0ZGVmYXVsdENvbG9yRGVjb3JhdG9ycyA9IDE1Myxcblx0Y29sb3JEZWNvcmF0b3JzQWN0aXZhdGVkT24gPSAxNTQsXG5cdGlubGluZUNvbXBsZXRpb25zQWNjZXNzaWJpbGl0eVZlcmJvc2UgPSAxNTUsXG5cdGVmZmVjdGl2ZUV4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZCA9IDE1NlxufVxuXG4vKipcbiAqIEVuZCBvZiBsaW5lIGNoYXJhY3RlciBwcmVmZXJlbmNlLlxuICovXG5leHBvcnQgZW51bSBFbmRPZkxpbmVQcmVmZXJlbmNlIHtcblx0LyoqXG5cdCAqIFVzZSB0aGUgZW5kIG9mIGxpbmUgY2hhcmFjdGVyIGlkZW50aWZpZWQgaW4gdGhlIHRleHQgYnVmZmVyLlxuXHQgKi9cblx0VGV4dERlZmluZWQgPSAwLFxuXHQvKipcblx0ICogVXNlIGxpbmUgZmVlZCAoXFxuKSBhcyB0aGUgZW5kIG9mIGxpbmUgY2hhcmFjdGVyLlxuXHQgKi9cblx0TEYgPSAxLFxuXHQvKipcblx0ICogVXNlIGNhcnJpYWdlIHJldHVybiBhbmQgbGluZSBmZWVkIChcXHJcXG4pIGFzIHRoZSBlbmQgb2YgbGluZSBjaGFyYWN0ZXIuXG5cdCAqL1xuXHRDUkxGID0gMlxufVxuXG4vKipcbiAqIEVuZCBvZiBsaW5lIGNoYXJhY3RlciBwcmVmZXJlbmNlLlxuICovXG5leHBvcnQgZW51bSBFbmRPZkxpbmVTZXF1ZW5jZSB7XG5cdC8qKlxuXHQgKiBVc2UgbGluZSBmZWVkIChcXG4pIGFzIHRoZSBlbmQgb2YgbGluZSBjaGFyYWN0ZXIuXG5cdCAqL1xuXHRMRiA9IDAsXG5cdC8qKlxuXHQgKiBVc2UgY2FycmlhZ2UgcmV0dXJuIGFuZCBsaW5lIGZlZWQgKFxcclxcbikgYXMgdGhlIGVuZCBvZiBsaW5lIGNoYXJhY3Rlci5cblx0ICovXG5cdENSTEYgPSAxXG59XG5cbi8qKlxuICogVmVydGljYWwgTGFuZSBpbiB0aGUgZ2x5cGggbWFyZ2luIG9mIHRoZSBlZGl0b3IuXG4gKi9cbmV4cG9ydCBlbnVtIEdseXBoTWFyZ2luTGFuZSB7XG5cdExlZnQgPSAxLFxuXHRDZW50ZXIgPSAyLFxuXHRSaWdodCA9IDNcbn1cblxuZXhwb3J0IGVudW0gSG92ZXJWZXJib3NpdHlBY3Rpb24ge1xuXHQvKipcblx0ICogSW5jcmVhc2UgdGhlIHZlcmJvc2l0eSBvZiB0aGUgaG92ZXJcblx0ICovXG5cdEluY3JlYXNlID0gMCxcblx0LyoqXG5cdCAqIERlY3JlYXNlIHRoZSB2ZXJib3NpdHkgb2YgdGhlIGhvdmVyXG5cdCAqL1xuXHREZWNyZWFzZSA9IDFcbn1cblxuLyoqXG4gKiBEZXNjcmliZXMgd2hhdCB0byBkbyB3aXRoIHRoZSBpbmRlbnRhdGlvbiB3aGVuIHByZXNzaW5nIEVudGVyLlxuICovXG5leHBvcnQgZW51bSBJbmRlbnRBY3Rpb24ge1xuXHQvKipcblx0ICogSW5zZXJ0IG5ldyBsaW5lIGFuZCBjb3B5IHRoZSBwcmV2aW91cyBsaW5lJ3MgaW5kZW50YXRpb24uXG5cdCAqL1xuXHROb25lID0gMCxcblx0LyoqXG5cdCAqIEluc2VydCBuZXcgbGluZSBhbmQgaW5kZW50IG9uY2UgKHJlbGF0aXZlIHRvIHRoZSBwcmV2aW91cyBsaW5lJ3MgaW5kZW50YXRpb24pLlxuXHQgKi9cblx0SW5kZW50ID0gMSxcblx0LyoqXG5cdCAqIEluc2VydCB0d28gbmV3IGxpbmVzOlxuXHQgKiAgLSB0aGUgZmlyc3Qgb25lIGluZGVudGVkIHdoaWNoIHdpbGwgaG9sZCB0aGUgY3Vyc29yXG5cdCAqICAtIHRoZSBzZWNvbmQgb25lIGF0IHRoZSBzYW1lIGluZGVudGF0aW9uIGxldmVsXG5cdCAqL1xuXHRJbmRlbnRPdXRkZW50ID0gMixcblx0LyoqXG5cdCAqIEluc2VydCBuZXcgbGluZSBhbmQgb3V0ZGVudCBvbmNlIChyZWxhdGl2ZSB0byB0aGUgcHJldmlvdXMgbGluZSdzIGluZGVudGF0aW9uKS5cblx0ICovXG5cdE91dGRlbnQgPSAzXG59XG5cbmV4cG9ydCBlbnVtIEluamVjdGVkVGV4dEN1cnNvclN0b3BzIHtcblx0Qm90aCA9IDAsXG5cdFJpZ2h0ID0gMSxcblx0TGVmdCA9IDIsXG5cdE5vbmUgPSAzXG59XG5cbmV4cG9ydCBlbnVtIElubGF5SGludEtpbmQge1xuXHRUeXBlID0gMSxcblx0UGFyYW1ldGVyID0gMlxufVxuXG4vKipcbiAqIEhvdyBhbiB7QGxpbmsgSW5saW5lQ29tcGxldGlvbnNQcm92aWRlciBpbmxpbmUgY29tcGxldGlvbiBwcm92aWRlcn0gd2FzIHRyaWdnZXJlZC5cbiAqL1xuZXhwb3J0IGVudW0gSW5saW5lQ29tcGxldGlvblRyaWdnZXJLaW5kIHtcblx0LyoqXG5cdCAqIENvbXBsZXRpb24gd2FzIHRyaWdnZXJlZCBhdXRvbWF0aWNhbGx5IHdoaWxlIGVkaXRpbmcuXG5cdCAqIEl0IGlzIHN1ZmZpY2llbnQgdG8gcmV0dXJuIGEgc2luZ2xlIGNvbXBsZXRpb24gaXRlbSBpbiB0aGlzIGNhc2UuXG5cdCAqL1xuXHRBdXRvbWF0aWMgPSAwLFxuXHQvKipcblx0ICogQ29tcGxldGlvbiB3YXMgdHJpZ2dlcmVkIGV4cGxpY2l0bHkgYnkgYSB1c2VyIGdlc3R1cmUuXG5cdCAqIFJldHVybiBtdWx0aXBsZSBjb21wbGV0aW9uIGl0ZW1zIHRvIGVuYWJsZSBjeWNsaW5nIHRocm91Z2ggdGhlbS5cblx0ICovXG5cdEV4cGxpY2l0ID0gMVxufVxuXG5leHBvcnQgZW51bSBJbmxpbmVFZGl0VHJpZ2dlcktpbmQge1xuXHRJbnZva2UgPSAwLFxuXHRBdXRvbWF0aWMgPSAxXG59XG4vKipcbiAqIFZpcnR1YWwgS2V5IENvZGVzLCB0aGUgdmFsdWUgZG9lcyBub3QgaG9sZCBhbnkgaW5oZXJlbnQgbWVhbmluZy5cbiAqIEluc3BpcmVkIHNvbWV3aGF0IGZyb20gaHR0cHM6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS93aW5kb3dzL2Rlc2t0b3AvZGQzNzU3MzEodj12cy44NSkuYXNweFxuICogQnV0IHRoZXNlIGFyZSBcIm1vcmUgZ2VuZXJhbFwiLCBhcyB0aGV5IHNob3VsZCB3b3JrIGFjcm9zcyBicm93c2VycyAmIE9TYHMuXG4gKi9cbmV4cG9ydCBlbnVtIEtleUNvZGUge1xuXHREZXBlbmRzT25LYkxheW91dCA9IC0xLFxuXHQvKipcblx0ICogUGxhY2VkIGZpcnN0IHRvIGNvdmVyIHRoZSAwIHZhbHVlIG9mIHRoZSBlbnVtLlxuXHQgKi9cblx0VW5rbm93biA9IDAsXG5cdEJhY2tzcGFjZSA9IDEsXG5cdFRhYiA9IDIsXG5cdEVudGVyID0gMyxcblx0U2hpZnQgPSA0LFxuXHRDdHJsID0gNSxcblx0QWx0ID0gNixcblx0UGF1c2VCcmVhayA9IDcsXG5cdENhcHNMb2NrID0gOCxcblx0RXNjYXBlID0gOSxcblx0U3BhY2UgPSAxMCxcblx0UGFnZVVwID0gMTEsXG5cdFBhZ2VEb3duID0gMTIsXG5cdEVuZCA9IDEzLFxuXHRIb21lID0gMTQsXG5cdExlZnRBcnJvdyA9IDE1LFxuXHRVcEFycm93ID0gMTYsXG5cdFJpZ2h0QXJyb3cgPSAxNyxcblx0RG93bkFycm93ID0gMTgsXG5cdEluc2VydCA9IDE5LFxuXHREZWxldGUgPSAyMCxcblx0RGlnaXQwID0gMjEsXG5cdERpZ2l0MSA9IDIyLFxuXHREaWdpdDIgPSAyMyxcblx0RGlnaXQzID0gMjQsXG5cdERpZ2l0NCA9IDI1LFxuXHREaWdpdDUgPSAyNixcblx0RGlnaXQ2ID0gMjcsXG5cdERpZ2l0NyA9IDI4LFxuXHREaWdpdDggPSAyOSxcblx0RGlnaXQ5ID0gMzAsXG5cdEtleUEgPSAzMSxcblx0S2V5QiA9IDMyLFxuXHRLZXlDID0gMzMsXG5cdEtleUQgPSAzNCxcblx0S2V5RSA9IDM1LFxuXHRLZXlGID0gMzYsXG5cdEtleUcgPSAzNyxcblx0S2V5SCA9IDM4LFxuXHRLZXlJID0gMzksXG5cdEtleUogPSA0MCxcblx0S2V5SyA9IDQxLFxuXHRLZXlMID0gNDIsXG5cdEtleU0gPSA0Myxcblx0S2V5TiA9IDQ0LFxuXHRLZXlPID0gNDUsXG5cdEtleVAgPSA0Nixcblx0S2V5USA9IDQ3LFxuXHRLZXlSID0gNDgsXG5cdEtleVMgPSA0OSxcblx0S2V5VCA9IDUwLFxuXHRLZXlVID0gNTEsXG5cdEtleVYgPSA1Mixcblx0S2V5VyA9IDUzLFxuXHRLZXlYID0gNTQsXG5cdEtleVkgPSA1NSxcblx0S2V5WiA9IDU2LFxuXHRNZXRhID0gNTcsXG5cdENvbnRleHRNZW51ID0gNTgsXG5cdEYxID0gNTksXG5cdEYyID0gNjAsXG5cdEYzID0gNjEsXG5cdEY0ID0gNjIsXG5cdEY1ID0gNjMsXG5cdEY2ID0gNjQsXG5cdEY3ID0gNjUsXG5cdEY4ID0gNjYsXG5cdEY5ID0gNjcsXG5cdEYxMCA9IDY4LFxuXHRGMTEgPSA2OSxcblx0RjEyID0gNzAsXG5cdEYxMyA9IDcxLFxuXHRGMTQgPSA3Mixcblx0RjE1ID0gNzMsXG5cdEYxNiA9IDc0LFxuXHRGMTcgPSA3NSxcblx0RjE4ID0gNzYsXG5cdEYxOSA9IDc3LFxuXHRGMjAgPSA3OCxcblx0RjIxID0gNzksXG5cdEYyMiA9IDgwLFxuXHRGMjMgPSA4MSxcblx0RjI0ID0gODIsXG5cdE51bUxvY2sgPSA4Myxcblx0U2Nyb2xsTG9jayA9IDg0LFxuXHQvKipcblx0ICogVXNlZCBmb3IgbWlzY2VsbGFuZW91cyBjaGFyYWN0ZXJzOyBpdCBjYW4gdmFyeSBieSBrZXlib2FyZC5cblx0ICogRm9yIHRoZSBVUyBzdGFuZGFyZCBrZXlib2FyZCwgdGhlICc7Oicga2V5XG5cdCAqL1xuXHRTZW1pY29sb24gPSA4NSxcblx0LyoqXG5cdCAqIEZvciBhbnkgY291bnRyeS9yZWdpb24sIHRoZSAnKycga2V5XG5cdCAqIEZvciB0aGUgVVMgc3RhbmRhcmQga2V5Ym9hcmQsIHRoZSAnPSsnIGtleVxuXHQgKi9cblx0RXF1YWwgPSA4Nixcblx0LyoqXG5cdCAqIEZvciBhbnkgY291bnRyeS9yZWdpb24sIHRoZSAnLCcga2V5XG5cdCAqIEZvciB0aGUgVVMgc3RhbmRhcmQga2V5Ym9hcmQsIHRoZSAnLDwnIGtleVxuXHQgKi9cblx0Q29tbWEgPSA4Nyxcblx0LyoqXG5cdCAqIEZvciBhbnkgY291bnRyeS9yZWdpb24sIHRoZSAnLScga2V5XG5cdCAqIEZvciB0aGUgVVMgc3RhbmRhcmQga2V5Ym9hcmQsIHRoZSAnLV8nIGtleVxuXHQgKi9cblx0TWludXMgPSA4OCxcblx0LyoqXG5cdCAqIEZvciBhbnkgY291bnRyeS9yZWdpb24sIHRoZSAnLicga2V5XG5cdCAqIEZvciB0aGUgVVMgc3RhbmRhcmQga2V5Ym9hcmQsIHRoZSAnLj4nIGtleVxuXHQgKi9cblx0UGVyaW9kID0gODksXG5cdC8qKlxuXHQgKiBVc2VkIGZvciBtaXNjZWxsYW5lb3VzIGNoYXJhY3RlcnM7IGl0IGNhbiB2YXJ5IGJ5IGtleWJvYXJkLlxuXHQgKiBGb3IgdGhlIFVTIHN0YW5kYXJkIGtleWJvYXJkLCB0aGUgJy8/JyBrZXlcblx0ICovXG5cdFNsYXNoID0gOTAsXG5cdC8qKlxuXHQgKiBVc2VkIGZvciBtaXNjZWxsYW5lb3VzIGNoYXJhY3RlcnM7IGl0IGNhbiB2YXJ5IGJ5IGtleWJvYXJkLlxuXHQgKiBGb3IgdGhlIFVTIHN0YW5kYXJkIGtleWJvYXJkLCB0aGUgJ2B+JyBrZXlcblx0ICovXG5cdEJhY2txdW90ZSA9IDkxLFxuXHQvKipcblx0ICogVXNlZCBmb3IgbWlzY2VsbGFuZW91cyBjaGFyYWN0ZXJzOyBpdCBjYW4gdmFyeSBieSBrZXlib2FyZC5cblx0ICogRm9yIHRoZSBVUyBzdGFuZGFyZCBrZXlib2FyZCwgdGhlICdbeycga2V5XG5cdCAqL1xuXHRCcmFja2V0TGVmdCA9IDkyLFxuXHQvKipcblx0ICogVXNlZCBmb3IgbWlzY2VsbGFuZW91cyBjaGFyYWN0ZXJzOyBpdCBjYW4gdmFyeSBieSBrZXlib2FyZC5cblx0ICogRm9yIHRoZSBVUyBzdGFuZGFyZCBrZXlib2FyZCwgdGhlICdcXHwnIGtleVxuXHQgKi9cblx0QmFja3NsYXNoID0gOTMsXG5cdC8qKlxuXHQgKiBVc2VkIGZvciBtaXNjZWxsYW5lb3VzIGNoYXJhY3RlcnM7IGl0IGNhbiB2YXJ5IGJ5IGtleWJvYXJkLlxuXHQgKiBGb3IgdGhlIFVTIHN0YW5kYXJkIGtleWJvYXJkLCB0aGUgJ119JyBrZXlcblx0ICovXG5cdEJyYWNrZXRSaWdodCA9IDk0LFxuXHQvKipcblx0ICogVXNlZCBmb3IgbWlzY2VsbGFuZW91cyBjaGFyYWN0ZXJzOyBpdCBjYW4gdmFyeSBieSBrZXlib2FyZC5cblx0ICogRm9yIHRoZSBVUyBzdGFuZGFyZCBrZXlib2FyZCwgdGhlICcnXCInIGtleVxuXHQgKi9cblx0UXVvdGUgPSA5NSxcblx0LyoqXG5cdCAqIFVzZWQgZm9yIG1pc2NlbGxhbmVvdXMgY2hhcmFjdGVyczsgaXQgY2FuIHZhcnkgYnkga2V5Ym9hcmQuXG5cdCAqL1xuXHRPRU1fOCA9IDk2LFxuXHQvKipcblx0ICogRWl0aGVyIHRoZSBhbmdsZSBicmFja2V0IGtleSBvciB0aGUgYmFja3NsYXNoIGtleSBvbiB0aGUgUlQgMTAyLWtleSBrZXlib2FyZC5cblx0ICovXG5cdEludGxCYWNrc2xhc2ggPSA5Nyxcblx0TnVtcGFkMCA9IDk4LC8vIFZLX05VTVBBRDAsIDB4NjAsIE51bWVyaWMga2V5cGFkIDAga2V5XG5cdE51bXBhZDEgPSA5OSwvLyBWS19OVU1QQUQxLCAweDYxLCBOdW1lcmljIGtleXBhZCAxIGtleVxuXHROdW1wYWQyID0gMTAwLC8vIFZLX05VTVBBRDIsIDB4NjIsIE51bWVyaWMga2V5cGFkIDIga2V5XG5cdE51bXBhZDMgPSAxMDEsLy8gVktfTlVNUEFEMywgMHg2MywgTnVtZXJpYyBrZXlwYWQgMyBrZXlcblx0TnVtcGFkNCA9IDEwMiwvLyBWS19OVU1QQUQ0LCAweDY0LCBOdW1lcmljIGtleXBhZCA0IGtleVxuXHROdW1wYWQ1ID0gMTAzLC8vIFZLX05VTVBBRDUsIDB4NjUsIE51bWVyaWMga2V5cGFkIDUga2V5XG5cdE51bXBhZDYgPSAxMDQsLy8gVktfTlVNUEFENiwgMHg2NiwgTnVtZXJpYyBrZXlwYWQgNiBrZXlcblx0TnVtcGFkNyA9IDEwNSwvLyBWS19OVU1QQUQ3LCAweDY3LCBOdW1lcmljIGtleXBhZCA3IGtleVxuXHROdW1wYWQ4ID0gMTA2LC8vIFZLX05VTVBBRDgsIDB4NjgsIE51bWVyaWMga2V5cGFkIDgga2V5XG5cdE51bXBhZDkgPSAxMDcsLy8gVktfTlVNUEFEOSwgMHg2OSwgTnVtZXJpYyBrZXlwYWQgOSBrZXlcblx0TnVtcGFkTXVsdGlwbHkgPSAxMDgsLy8gVktfTVVMVElQTFksIDB4NkEsIE11bHRpcGx5IGtleVxuXHROdW1wYWRBZGQgPSAxMDksLy8gVktfQURELCAweDZCLCBBZGQga2V5XG5cdE5VTVBBRF9TRVBBUkFUT1IgPSAxMTAsLy8gVktfU0VQQVJBVE9SLCAweDZDLCBTZXBhcmF0b3Iga2V5XG5cdE51bXBhZFN1YnRyYWN0ID0gMTExLC8vIFZLX1NVQlRSQUNULCAweDZELCBTdWJ0cmFjdCBrZXlcblx0TnVtcGFkRGVjaW1hbCA9IDExMiwvLyBWS19ERUNJTUFMLCAweDZFLCBEZWNpbWFsIGtleVxuXHROdW1wYWREaXZpZGUgPSAxMTMsLy8gVktfRElWSURFLCAweDZGLFxuXHQvKipcblx0ICogQ292ZXIgYWxsIGtleSBjb2RlcyB3aGVuIElNRSBpcyBwcm9jZXNzaW5nIGlucHV0LlxuXHQgKi9cblx0S0VZX0lOX0NPTVBPU0lUSU9OID0gMTE0LFxuXHRBQk5UX0MxID0gMTE1LC8vIEJyYXppbGlhbiAoQUJOVCkgS2V5Ym9hcmRcblx0QUJOVF9DMiA9IDExNiwvLyBCcmF6aWxpYW4gKEFCTlQpIEtleWJvYXJkXG5cdEF1ZGlvVm9sdW1lTXV0ZSA9IDExNyxcblx0QXVkaW9Wb2x1bWVVcCA9IDExOCxcblx0QXVkaW9Wb2x1bWVEb3duID0gMTE5LFxuXHRCcm93c2VyU2VhcmNoID0gMTIwLFxuXHRCcm93c2VySG9tZSA9IDEyMSxcblx0QnJvd3NlckJhY2sgPSAxMjIsXG5cdEJyb3dzZXJGb3J3YXJkID0gMTIzLFxuXHRNZWRpYVRyYWNrTmV4dCA9IDEyNCxcblx0TWVkaWFUcmFja1ByZXZpb3VzID0gMTI1LFxuXHRNZWRpYVN0b3AgPSAxMjYsXG5cdE1lZGlhUGxheVBhdXNlID0gMTI3LFxuXHRMYXVuY2hNZWRpYVBsYXllciA9IDEyOCxcblx0TGF1bmNoTWFpbCA9IDEyOSxcblx0TGF1bmNoQXBwMiA9IDEzMCxcblx0LyoqXG5cdCAqIFZLX0NMRUFSLCAweDBDLCBDTEVBUiBrZXlcblx0ICovXG5cdENsZWFyID0gMTMxLFxuXHQvKipcblx0ICogUGxhY2VkIGxhc3QgdG8gY292ZXIgdGhlIGxlbmd0aCBvZiB0aGUgZW51bS5cblx0ICogUGxlYXNlIGRvIG5vdCBkZXBlbmQgb24gdGhpcyB2YWx1ZSFcblx0ICovXG5cdE1BWF9WQUxVRSA9IDEzMlxufVxuXG5leHBvcnQgZW51bSBNYXJrZXJTZXZlcml0eSB7XG5cdEhpbnQgPSAxLFxuXHRJbmZvID0gMixcblx0V2FybmluZyA9IDQsXG5cdEVycm9yID0gOFxufVxuXG5leHBvcnQgZW51bSBNYXJrZXJUYWcge1xuXHRVbm5lY2Vzc2FyeSA9IDEsXG5cdERlcHJlY2F0ZWQgPSAyXG59XG5cbi8qKlxuICogUG9zaXRpb24gaW4gdGhlIG1pbmltYXAgdG8gcmVuZGVyIHRoZSBkZWNvcmF0aW9uLlxuICovXG5leHBvcnQgZW51bSBNaW5pbWFwUG9zaXRpb24ge1xuXHRJbmxpbmUgPSAxLFxuXHRHdXR0ZXIgPSAyXG59XG5cbi8qKlxuICogU2VjdGlvbiBoZWFkZXIgc3R5bGUuXG4gKi9cbmV4cG9ydCBlbnVtIE1pbmltYXBTZWN0aW9uSGVhZGVyU3R5bGUge1xuXHROb3JtYWwgPSAxLFxuXHRVbmRlcmxpbmVkID0gMlxufVxuXG4vKipcbiAqIFR5cGUgb2YgaGl0IGVsZW1lbnQgd2l0aCB0aGUgbW91c2UgaW4gdGhlIGVkaXRvci5cbiAqL1xuZXhwb3J0IGVudW0gTW91c2VUYXJnZXRUeXBlIHtcblx0LyoqXG5cdCAqIE1vdXNlIGlzIG9uIHRvcCBvZiBhbiB1bmtub3duIGVsZW1lbnQuXG5cdCAqL1xuXHRVTktOT1dOID0gMCxcblx0LyoqXG5cdCAqIE1vdXNlIGlzIG9uIHRvcCBvZiB0aGUgdGV4dGFyZWEgdXNlZCBmb3IgaW5wdXQuXG5cdCAqL1xuXHRURVhUQVJFQSA9IDEsXG5cdC8qKlxuXHQgKiBNb3VzZSBpcyBvbiB0b3Agb2YgdGhlIGdseXBoIG1hcmdpblxuXHQgKi9cblx0R1VUVEVSX0dMWVBIX01BUkdJTiA9IDIsXG5cdC8qKlxuXHQgKiBNb3VzZSBpcyBvbiB0b3Agb2YgdGhlIGxpbmUgbnVtYmVyc1xuXHQgKi9cblx0R1VUVEVSX0xJTkVfTlVNQkVSUyA9IDMsXG5cdC8qKlxuXHQgKiBNb3VzZSBpcyBvbiB0b3Agb2YgdGhlIGxpbmUgZGVjb3JhdGlvbnNcblx0ICovXG5cdEdVVFRFUl9MSU5FX0RFQ09SQVRJT05TID0gNCxcblx0LyoqXG5cdCAqIE1vdXNlIGlzIG9uIHRvcCBvZiB0aGUgd2hpdGVzcGFjZSBsZWZ0IGluIHRoZSBndXR0ZXIgYnkgYSB2aWV3IHpvbmUuXG5cdCAqL1xuXHRHVVRURVJfVklFV19aT05FID0gNSxcblx0LyoqXG5cdCAqIE1vdXNlIGlzIG9uIHRvcCBvZiB0ZXh0IGluIHRoZSBjb250ZW50LlxuXHQgKi9cblx0Q09OVEVOVF9URVhUID0gNixcblx0LyoqXG5cdCAqIE1vdXNlIGlzIG9uIHRvcCBvZiBlbXB0eSBzcGFjZSBpbiB0aGUgY29udGVudCAoZS5nLiBhZnRlciBsaW5lIHRleHQgb3IgYmVsb3cgbGFzdCBsaW5lKVxuXHQgKi9cblx0Q09OVEVOVF9FTVBUWSA9IDcsXG5cdC8qKlxuXHQgKiBNb3VzZSBpcyBvbiB0b3Agb2YgYSB2aWV3IHpvbmUgaW4gdGhlIGNvbnRlbnQuXG5cdCAqL1xuXHRDT05URU5UX1ZJRVdfWk9ORSA9IDgsXG5cdC8qKlxuXHQgKiBNb3VzZSBpcyBvbiB0b3Agb2YgYSBjb250ZW50IHdpZGdldC5cblx0ICovXG5cdENPTlRFTlRfV0lER0VUID0gOSxcblx0LyoqXG5cdCAqIE1vdXNlIGlzIG9uIHRvcCBvZiB0aGUgZGVjb3JhdGlvbnMgb3ZlcnZpZXcgcnVsZXIuXG5cdCAqL1xuXHRPVkVSVklFV19SVUxFUiA9IDEwLFxuXHQvKipcblx0ICogTW91c2UgaXMgb24gdG9wIG9mIGEgc2Nyb2xsYmFyLlxuXHQgKi9cblx0U0NST0xMQkFSID0gMTEsXG5cdC8qKlxuXHQgKiBNb3VzZSBpcyBvbiB0b3Agb2YgYW4gb3ZlcmxheSB3aWRnZXQuXG5cdCAqL1xuXHRPVkVSTEFZX1dJREdFVCA9IDEyLFxuXHQvKipcblx0ICogTW91c2UgaXMgb3V0c2lkZSBvZiB0aGUgZWRpdG9yLlxuXHQgKi9cblx0T1VUU0lERV9FRElUT1IgPSAxM1xufVxuXG5leHBvcnQgZW51bSBOZXdTeW1ib2xOYW1lVGFnIHtcblx0QUlHZW5lcmF0ZWQgPSAxXG59XG5cbmV4cG9ydCBlbnVtIE5ld1N5bWJvbE5hbWVUcmlnZ2VyS2luZCB7XG5cdEludm9rZSA9IDAsXG5cdEF1dG9tYXRpYyA9IDFcbn1cblxuLyoqXG4gKiBBIHBvc2l0aW9uaW5nIHByZWZlcmVuY2UgZm9yIHJlbmRlcmluZyBvdmVybGF5IHdpZGdldHMuXG4gKi9cbmV4cG9ydCBlbnVtIE92ZXJsYXlXaWRnZXRQb3NpdGlvblByZWZlcmVuY2Uge1xuXHQvKipcblx0ICogUG9zaXRpb24gdGhlIG92ZXJsYXkgd2lkZ2V0IGluIHRoZSB0b3AgcmlnaHQgY29ybmVyXG5cdCAqL1xuXHRUT1BfUklHSFRfQ09STkVSID0gMCxcblx0LyoqXG5cdCAqIFBvc2l0aW9uIHRoZSBvdmVybGF5IHdpZGdldCBpbiB0aGUgYm90dG9tIHJpZ2h0IGNvcm5lclxuXHQgKi9cblx0Qk9UVE9NX1JJR0hUX0NPUk5FUiA9IDEsXG5cdC8qKlxuXHQgKiBQb3NpdGlvbiB0aGUgb3ZlcmxheSB3aWRnZXQgaW4gdGhlIHRvcCBjZW50ZXJcblx0ICovXG5cdFRPUF9DRU5URVIgPSAyXG59XG5cbi8qKlxuICogVmVydGljYWwgTGFuZSBpbiB0aGUgb3ZlcnZpZXcgcnVsZXIgb2YgdGhlIGVkaXRvci5cbiAqL1xuZXhwb3J0IGVudW0gT3ZlcnZpZXdSdWxlckxhbmUge1xuXHRMZWZ0ID0gMSxcblx0Q2VudGVyID0gMixcblx0UmlnaHQgPSA0LFxuXHRGdWxsID0gN1xufVxuXG4vKipcbiAqIEhvdyBhIHBhcnRpYWwgYWNjZXB0YW5jZSB3YXMgdHJpZ2dlcmVkLlxuICovXG5leHBvcnQgZW51bSBQYXJ0aWFsQWNjZXB0VHJpZ2dlcktpbmQge1xuXHRXb3JkID0gMCxcblx0TGluZSA9IDEsXG5cdFN1Z2dlc3QgPSAyXG59XG5cbmV4cG9ydCBlbnVtIFBvc2l0aW9uQWZmaW5pdHkge1xuXHQvKipcblx0ICogUHJlZmVycyB0aGUgbGVmdCBtb3N0IHBvc2l0aW9uLlxuXHQqL1xuXHRMZWZ0ID0gMCxcblx0LyoqXG5cdCAqIFByZWZlcnMgdGhlIHJpZ2h0IG1vc3QgcG9zaXRpb24uXG5cdCovXG5cdFJpZ2h0ID0gMSxcblx0LyoqXG5cdCAqIE5vIHByZWZlcmVuY2UuXG5cdCovXG5cdE5vbmUgPSAyLFxuXHQvKipcblx0ICogSWYgdGhlIGdpdmVuIHBvc2l0aW9uIGlzIG9uIGluamVjdGVkIHRleHQsIHByZWZlcnMgdGhlIHBvc2l0aW9uIGxlZnQgb2YgaXQuXG5cdCovXG5cdExlZnRPZkluamVjdGVkVGV4dCA9IDMsXG5cdC8qKlxuXHQgKiBJZiB0aGUgZ2l2ZW4gcG9zaXRpb24gaXMgb24gaW5qZWN0ZWQgdGV4dCwgcHJlZmVycyB0aGUgcG9zaXRpb24gcmlnaHQgb2YgaXQuXG5cdCovXG5cdFJpZ2h0T2ZJbmplY3RlZFRleHQgPSA0XG59XG5cbmV4cG9ydCBlbnVtIFJlbmRlckxpbmVOdW1iZXJzVHlwZSB7XG5cdE9mZiA9IDAsXG5cdE9uID0gMSxcblx0UmVsYXRpdmUgPSAyLFxuXHRJbnRlcnZhbCA9IDMsXG5cdEN1c3RvbSA9IDRcbn1cblxuZXhwb3J0IGVudW0gUmVuZGVyTWluaW1hcCB7XG5cdE5vbmUgPSAwLFxuXHRUZXh0ID0gMSxcblx0QmxvY2tzID0gMlxufVxuXG5leHBvcnQgZW51bSBTY3JvbGxUeXBlIHtcblx0U21vb3RoID0gMCxcblx0SW1tZWRpYXRlID0gMVxufVxuXG5leHBvcnQgZW51bSBTY3JvbGxiYXJWaXNpYmlsaXR5IHtcblx0QXV0byA9IDEsXG5cdEhpZGRlbiA9IDIsXG5cdFZpc2libGUgPSAzXG59XG5cbi8qKlxuICogVGhlIGRpcmVjdGlvbiBvZiBhIHNlbGVjdGlvbi5cbiAqL1xuZXhwb3J0IGVudW0gU2VsZWN0aW9uRGlyZWN0aW9uIHtcblx0LyoqXG5cdCAqIFRoZSBzZWxlY3Rpb24gc3RhcnRzIGFib3ZlIHdoZXJlIGl0IGVuZHMuXG5cdCAqL1xuXHRMVFIgPSAwLFxuXHQvKipcblx0ICogVGhlIHNlbGVjdGlvbiBzdGFydHMgYmVsb3cgd2hlcmUgaXQgZW5kcy5cblx0ICovXG5cdFJUTCA9IDFcbn1cblxuZXhwb3J0IGVudW0gU2hvd0xpZ2h0YnVsYkljb25Nb2RlIHtcblx0T2ZmID0gJ29mZicsXG5cdE9uQ29kZSA9ICdvbkNvZGUnLFxuXHRPbiA9ICdvbidcbn1cblxuZXhwb3J0IGVudW0gU2lnbmF0dXJlSGVscFRyaWdnZXJLaW5kIHtcblx0SW52b2tlID0gMSxcblx0VHJpZ2dlckNoYXJhY3RlciA9IDIsXG5cdENvbnRlbnRDaGFuZ2UgPSAzXG59XG5cbi8qKlxuICogQSBzeW1ib2wga2luZC5cbiAqL1xuZXhwb3J0IGVudW0gU3ltYm9sS2luZCB7XG5cdEZpbGUgPSAwLFxuXHRNb2R1bGUgPSAxLFxuXHROYW1lc3BhY2UgPSAyLFxuXHRQYWNrYWdlID0gMyxcblx0Q2xhc3MgPSA0LFxuXHRNZXRob2QgPSA1LFxuXHRQcm9wZXJ0eSA9IDYsXG5cdEZpZWxkID0gNyxcblx0Q29uc3RydWN0b3IgPSA4LFxuXHRFbnVtID0gOSxcblx0SW50ZXJmYWNlID0gMTAsXG5cdEZ1bmN0aW9uID0gMTEsXG5cdFZhcmlhYmxlID0gMTIsXG5cdENvbnN0YW50ID0gMTMsXG5cdFN0cmluZyA9IDE0LFxuXHROdW1iZXIgPSAxNSxcblx0Qm9vbGVhbiA9IDE2LFxuXHRBcnJheSA9IDE3LFxuXHRPYmplY3QgPSAxOCxcblx0S2V5ID0gMTksXG5cdE51bGwgPSAyMCxcblx0RW51bU1lbWJlciA9IDIxLFxuXHRTdHJ1Y3QgPSAyMixcblx0RXZlbnQgPSAyMyxcblx0T3BlcmF0b3IgPSAyNCxcblx0VHlwZVBhcmFtZXRlciA9IDI1XG59XG5cbmV4cG9ydCBlbnVtIFN5bWJvbFRhZyB7XG5cdERlcHJlY2F0ZWQgPSAxXG59XG5cbi8qKlxuICogVGhlIGtpbmQgb2YgYW5pbWF0aW9uIGluIHdoaWNoIHRoZSBlZGl0b3IncyBjdXJzb3Igc2hvdWxkIGJlIHJlbmRlcmVkLlxuICovXG5leHBvcnQgZW51bSBUZXh0RWRpdG9yQ3Vyc29yQmxpbmtpbmdTdHlsZSB7XG5cdC8qKlxuXHQgKiBIaWRkZW5cblx0ICovXG5cdEhpZGRlbiA9IDAsXG5cdC8qKlxuXHQgKiBCbGlua2luZ1xuXHQgKi9cblx0QmxpbmsgPSAxLFxuXHQvKipcblx0ICogQmxpbmtpbmcgd2l0aCBzbW9vdGggZmFkaW5nXG5cdCAqL1xuXHRTbW9vdGggPSAyLFxuXHQvKipcblx0ICogQmxpbmtpbmcgd2l0aCBwcm9sb25nZWQgZmlsbGVkIHN0YXRlIGFuZCBzbW9vdGggZmFkaW5nXG5cdCAqL1xuXHRQaGFzZSA9IDMsXG5cdC8qKlxuXHQgKiBFeHBhbmQgY29sbGFwc2UgYW5pbWF0aW9uIG9uIHRoZSB5IGF4aXNcblx0ICovXG5cdEV4cGFuZCA9IDQsXG5cdC8qKlxuXHQgKiBOby1CbGlua2luZ1xuXHQgKi9cblx0U29saWQgPSA1XG59XG5cbi8qKlxuICogVGhlIHN0eWxlIGluIHdoaWNoIHRoZSBlZGl0b3IncyBjdXJzb3Igc2hvdWxkIGJlIHJlbmRlcmVkLlxuICovXG5leHBvcnQgZW51bSBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUge1xuXHQvKipcblx0ICogQXMgYSB2ZXJ0aWNhbCBsaW5lIChzaXR0aW5nIGJldHdlZW4gdHdvIGNoYXJhY3RlcnMpLlxuXHQgKi9cblx0TGluZSA9IDEsXG5cdC8qKlxuXHQgKiBBcyBhIGJsb2NrIChzaXR0aW5nIG9uIHRvcCBvZiBhIGNoYXJhY3RlcikuXG5cdCAqL1xuXHRCbG9jayA9IDIsXG5cdC8qKlxuXHQgKiBBcyBhIGhvcml6b250YWwgbGluZSAoc2l0dGluZyB1bmRlciBhIGNoYXJhY3RlcikuXG5cdCAqL1xuXHRVbmRlcmxpbmUgPSAzLFxuXHQvKipcblx0ICogQXMgYSB0aGluIHZlcnRpY2FsIGxpbmUgKHNpdHRpbmcgYmV0d2VlbiB0d28gY2hhcmFjdGVycykuXG5cdCAqL1xuXHRMaW5lVGhpbiA9IDQsXG5cdC8qKlxuXHQgKiBBcyBhbiBvdXRsaW5lZCBibG9jayAoc2l0dGluZyBvbiB0b3Agb2YgYSBjaGFyYWN0ZXIpLlxuXHQgKi9cblx0QmxvY2tPdXRsaW5lID0gNSxcblx0LyoqXG5cdCAqIEFzIGEgdGhpbiBob3Jpem9udGFsIGxpbmUgKHNpdHRpbmcgdW5kZXIgYSBjaGFyYWN0ZXIpLlxuXHQgKi9cblx0VW5kZXJsaW5lVGhpbiA9IDZcbn1cblxuLyoqXG4gKiBEZXNjcmliZXMgdGhlIGJlaGF2aW9yIG9mIGRlY29yYXRpb25zIHdoZW4gdHlwaW5nL2VkaXRpbmcgbmVhciB0aGVpciBlZGdlcy5cbiAqIE5vdGU6IFBsZWFzZSBkbyBub3QgZWRpdCB0aGUgdmFsdWVzLCBhcyB0aGV5IHZlcnkgY2FyZWZ1bGx5IG1hdGNoIGBEZWNvcmF0aW9uUmFuZ2VCZWhhdmlvcmBcbiAqL1xuZXhwb3J0IGVudW0gVHJhY2tlZFJhbmdlU3RpY2tpbmVzcyB7XG5cdEFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMgPSAwLFxuXHROZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMgPSAxLFxuXHRHcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlID0gMixcblx0R3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyID0gM1xufVxuXG4vKipcbiAqIERlc2NyaWJlcyBob3cgdG8gaW5kZW50IHdyYXBwZWQgbGluZXMuXG4gKi9cbmV4cG9ydCBlbnVtIFdyYXBwaW5nSW5kZW50IHtcblx0LyoqXG5cdCAqIE5vIGluZGVudGF0aW9uID0+IHdyYXBwZWQgbGluZXMgYmVnaW4gYXQgY29sdW1uIDEuXG5cdCAqL1xuXHROb25lID0gMCxcblx0LyoqXG5cdCAqIFNhbWUgPT4gd3JhcHBlZCBsaW5lcyBnZXQgdGhlIHNhbWUgaW5kZW50YXRpb24gYXMgdGhlIHBhcmVudC5cblx0ICovXG5cdFNhbWUgPSAxLFxuXHQvKipcblx0ICogSW5kZW50ID0+IHdyYXBwZWQgbGluZXMgZ2V0ICsxIGluZGVudGF0aW9uIHRvd2FyZCB0aGUgcGFyZW50LlxuXHQgKi9cblx0SW5kZW50ID0gMixcblx0LyoqXG5cdCAqIERlZXBJbmRlbnQgPT4gd3JhcHBlZCBsaW5lcyBnZXQgKzIgaW5kZW50YXRpb24gdG93YXJkIHRoZSBwYXJlbnQuXG5cdCAqL1xuXHREZWVwSW5kZW50ID0gM1xufSJdLAogICJtYXBwaW5ncyI6ICJBQVFPLElBQUssdUJBQUwsa0JBQUtBLDBCQUFMO0FBSU4sRUFBQUEsNENBQUEsYUFBVSxLQUFWO0FBQ0EsRUFBQUEsNENBQUEsY0FBVyxLQUFYO0FBQ0EsRUFBQUEsNENBQUEsYUFBVSxLQUFWO0FBTlcsU0FBQUE7QUFBQSxH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LGtCQUFBLGNBQVcsS0FBWDtBQUNBLEVBQUFBLGtCQUFBLFlBQVMsS0FBVDtBQUNBLEVBQUFBLGtCQUFBLFdBQVEsTUFBUjtBQUNBLEVBQUFBLGtCQUFBLFlBQVMsTUFBVDtBQUNBLEVBQUFBLGtCQUFBLGNBQVcsTUFBWDtBQUNBLEVBQUFBLGtCQUFBLFNBQU0sTUFBTjtBQUNBLEVBQUFBLGtCQUFBLFVBQU8sTUFBUDtBQUNBLEVBQUFBLGtCQUFBLGVBQVksTUFBWjtBQUNBLEVBQUFBLGtCQUFBLGFBQVUsTUFBVjtBQUNBLEVBQUFBLGtCQUFBLGdCQUFhLE1BQWI7QUFDQSxFQUFBQSxrQkFBQSxlQUFZLE1BQVo7QUFDQSxFQUFBQSxrQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxrQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxrQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxrQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxrQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxrQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxrQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxrQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxrQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxrQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxrQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxrQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxrQkFBQSxpQkFBYyxNQUFkO0FBQ0EsRUFBQUEsa0JBQUEsUUFBSyxNQUFMO0FBQ0EsRUFBQUEsa0JBQUEsUUFBSyxNQUFMO0FBQ0EsRUFBQUEsa0JBQUEsUUFBSyxNQUFMO0FBQ0EsRUFBQUEsa0JBQUEsUUFBSyxNQUFMO0FBQ0EsRUFBQUEsa0JBQUEsUUFBSyxNQUFMO0FBQ0EsRUFBQUEsa0JBQUEsUUFBSyxNQUFMO0FBQ0EsRUFBQUEsa0JBQUEsUUFBSyxNQUFMO0FBQ0EsRUFBQUEsa0JBQUEsUUFBSyxNQUFMO0FBQ0EsRUFBQUEsa0JBQUEsUUFBSyxNQUFMO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsU0FBTSxNQUFOO0FBQ0EsRUFBQUEsa0JBQUEsYUFBVSxNQUFWO0FBQ0EsRUFBQUEsa0JBQUEsZ0JBQWEsTUFBYjtBQUtBLEVBQUFBLGtCQUFBLGVBQVksTUFBWjtBQUtBLEVBQUFBLGtCQUFBLFdBQVEsTUFBUjtBQUtBLEVBQUFBLGtCQUFBLFdBQVEsTUFBUjtBQUtBLEVBQUFBLGtCQUFBLFdBQVEsTUFBUjtBQUtBLEVBQUFBLGtCQUFBLFlBQVMsTUFBVDtBQUtBLEVBQUFBLGtCQUFBLFdBQVEsTUFBUjtBQUtBLEVBQUFBLGtCQUFBLGVBQVksTUFBWjtBQUtBLEVBQUFBLGtCQUFBLGlCQUFjLE1BQWQ7QUFLQSxFQUFBQSxrQkFBQSxlQUFZLE1BQVo7QUFLQSxFQUFBQSxrQkFBQSxrQkFBZSxNQUFmO0FBS0EsRUFBQUEsa0JBQUEsV0FBUSxNQUFSO0FBSUEsRUFBQUEsa0JBQUEsV0FBUSxNQUFSO0FBSUEsRUFBQUEsa0JBQUEsbUJBQWdCLE1BQWhCO0FBQ0EsRUFBQUEsa0JBQUEsYUFBVSxNQUFWO0FBQ0EsRUFBQUEsa0JBQUEsYUFBVSxNQUFWO0FBQ0EsRUFBQUEsa0JBQUEsYUFBVSxPQUFWO0FBQ0EsRUFBQUEsa0JBQUEsYUFBVSxPQUFWO0FBQ0EsRUFBQUEsa0JBQUEsYUFBVSxPQUFWO0FBQ0EsRUFBQUEsa0JBQUEsYUFBVSxPQUFWO0FBQ0EsRUFBQUEsa0JBQUEsYUFBVSxPQUFWO0FBQ0EsRUFBQUEsa0JBQUEsYUFBVSxPQUFWO0FBQ0EsRUFBQUEsa0JBQUEsYUFBVSxPQUFWO0FBQ0EsRUFBQUEsa0JBQUEsYUFBVSxPQUFWO0FB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OENBQUEsV0FBUSxLQUFSO0FBSUEsRUFBQUEsOENBQUEsZUFBWSxLQUFaO0FBSUEsRUFBQUEsOENBQUEsY0FBVyxLQUFYO0FBSUEsRUFBQUEsOENBQUEsa0JBQWUsS0FBZjtBQUlBLEVBQUFBLDhDQUFBLG1CQUFnQixLQUFoQjtBQXhCVyxTQUFBQTtBQUFBLEdBQUE7QUErQkwsSUFBSyx5QkFBTCxrQkFBS0MsNEJBQUw7QUFDTixFQUFBQSxnREFBQSxrQ0FBK0IsS0FBL0I7QUFDQSxFQUFBQSxnREFBQSxpQ0FBOEIsS0FBOUI7QUFDQSxFQUFBQSxnREFBQSwrQkFBNEIsS0FBNUI7QUFDQSxFQUFBQSxnREFBQSw4QkFBMkIsS0FBM0I7QUFKVyxTQUFBQTtBQUFBLEdBQUE7QUFVTCxJQUFLLGlCQUFMLGtCQUFLQyxvQkFBTDtBQUlOLEVBQUFBLGdDQUFBLFVBQU8sS0FBUDtBQUlBLEVBQUFBLGdDQUFBLFVBQU8sS0FBUDtBQUlBLEVBQUFBLGdDQUFBLFlBQVMsS0FBVDtBQUlBLEVBQUFBLGdDQUFBLGdCQUFhLEtBQWI7QUFoQlcsU0FBQUE7QUFBQSxHQUFBOyIsCiAgIm5hbWVzIjogWyJBY2Nlc3NpYmlsaXR5U3VwcG9ydCIsICJDb2RlQWN0aW9uVHJpZ2dlclR5cGUiLCAiQ29tcGxldGlvbkl0ZW1JbnNlcnRUZXh0UnVsZSIsICJDb21wbGV0aW9uSXRlbUtpbmQiLCAiQ29tcGxldGlvbkl0ZW1UYWciLCAiQ29tcGxldGlvblRyaWdnZXJLaW5kIiwgIkNvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UiLCAiQ3Vyc29yQ2hhbmdlUmVhc29uIiwgIkRlZmF1bHRFbmRPZkxpbmUiLCAiRG9jdW1lbnRIaWdobGlnaHRLaW5kIiwgIkVkaXRvckF1dG9JbmRlbnRTdHJhdGVneSIsICJFZGl0b3JPcHRpb24iLCAiRW5kT2ZMaW5lUHJlZmVyZW5jZSIsICJFbmRPZkxpbmVTZXF1ZW5jZSIsICJHbHlwaE1hcmdpbkxhbmUiLCAiSG92ZXJWZXJib3NpdHlBY3Rpb24iLCAiSW5kZW50QWN0aW9uIiwgIkluamVjdGVkVGV4dEN1cnNvclN0b3BzIiwgIklubGF5SGludEtpbmQiLCAiSW5saW5lQ29tcGxldGlvblRyaWdnZXJLaW5kIiwgIklubGluZUVkaXRUcmlnZ2VyS2luZCIsICJLZXlDb2RlIiwgIk1hcmtlclNldmVyaXR5IiwgIk1hcmtlclRhZyIsICJNaW5pbWFwUG9zaXRpb24iLCAiTWluaW1hcFNlY3Rpb25IZWFkZXJTdHlsZSIsICJNb3VzZVRhcmdldFR5cGUiLCAiTmV3U3ltYm9sTmFtZVRhZyIsICJOZXdTeW1ib2xOYW1lVHJpZ2dlcktpbmQiLCAiT3ZlcmxheVdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZSIsICJPdmVydmlld1J1bGVyTGFuZSIsICJQYXJ0aWFsQWNjZXB0VHJpZ2dlcktpbmQiLCAiUG9zaXRpb25BZmZpbml0eSIsICJSZW5kZXJMaW5lTnVtYmVyc1R5cGUiLCAiUmVuZGVyTWluaW1hcCIsICJTY3JvbGxUeXBlIiwgIlNjcm9sbGJhclZpc2liaWxpdHkiLCAiU2VsZWN0aW9uRGlyZWN0aW9uIiwgIlNob3dMaWdodGJ1bGJJY29uTW9kZSIsICJTaWduYXR1cmVIZWxwVHJpZ2dlcktpbmQiLCAiU3ltYm9sS2luZCIsICJTeW1ib2xUYWciLCAiVGV4dEVkaXRvckN1cnNvckJsaW5raW5nU3R5bGUiLCAiVGV4dEVkaXRvckN1cnNvclN0eWxlIiwgIlRyYWNrZWRSYW5nZVN0aWNraW5lc3MiLCAiV3JhcHBpbmdJbmRlbnQiXQp9Cg==
