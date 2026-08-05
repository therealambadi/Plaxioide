import { registerColor, foreground, editorInfoForeground, editorWarningForeground, errorForeground, badgeBackground, badgeForeground, listDeemphasizedForeground, contrastBorder, inputBorder, toolbarHoverBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Color } from "../../../../base/common/color.js";
import { localize } from "../../../../nls.js";
import * as icons from "./debugIcons.js";
import { isHighContrast } from "../../../../platform/theme/common/theme.js";
const debugToolBarBackground = registerColor("debugToolBar.background", {
  dark: "#333333",
  light: "#F3F3F3",
  hcDark: "#000000",
  hcLight: "#FFFFFF"
}, localize("debugToolBarBackground", "Debug toolbar background color."));
const debugToolBarBorder = registerColor("debugToolBar.border", null, localize("debugToolBarBorder", "Debug toolbar border color."));
const debugIconStartForeground = registerColor("debugIcon.startForeground", {
  dark: "#89D185",
  light: "#388A34",
  hcDark: "#89D185",
  hcLight: "#388A34"
}, localize("debugIcon.startForeground", "Debug toolbar icon for start debugging."));
function registerColors() {
  const debugTokenExpressionName = registerColor("debugTokenExpression.name", { dark: "#c586c0", light: "#9b46b0", hcDark: foreground, hcLight: foreground }, "Foreground color for the token names shown in the debug views (ie. the Variables or Watch view).");
  const debugTokenExpressionType = registerColor("debugTokenExpression.type", { dark: "#4A90E2", light: "#4A90E2", hcDark: foreground, hcLight: foreground }, "Foreground color for the token types shown in the debug views (ie. the Variables or Watch view).");
  const debugTokenExpressionValue = registerColor("debugTokenExpression.value", { dark: "#cccccc99", light: "#6c6c6ccc", hcDark: foreground, hcLight: foreground }, "Foreground color for the token values shown in the debug views (ie. the Variables or Watch view).");
  const debugTokenExpressionString = registerColor("debugTokenExpression.string", { dark: "#ce9178", light: "#a31515", hcDark: "#f48771", hcLight: "#a31515" }, "Foreground color for strings in the debug views (ie. the Variables or Watch view).");
  const debugTokenExpressionBoolean = registerColor("debugTokenExpression.boolean", { dark: "#4e94ce", light: "#0000ff", hcDark: "#75bdfe", hcLight: "#0000ff" }, "Foreground color for booleans in the debug views (ie. the Variables or Watch view).");
  const debugTokenExpressionNumber = registerColor("debugTokenExpression.number", { dark: "#b5cea8", light: "#098658", hcDark: "#89d185", hcLight: "#098658" }, "Foreground color for numbers in the debug views (ie. the Variables or Watch view).");
  const debugTokenExpressionError = registerColor("debugTokenExpression.error", { dark: "#f48771", light: "#e51400", hcDark: "#f48771", hcLight: "#e51400" }, "Foreground color for expression errors in the debug views (ie. the Variables or Watch view) and for error logs shown in the debug console.");
  const debugViewExceptionLabelForeground = registerColor("debugView.exceptionLabelForeground", { dark: foreground, light: "#FFF", hcDark: foreground, hcLight: foreground }, "Foreground color for a label shown in the CALL STACK view when the debugger breaks on an exception.");
  const debugViewExceptionLabelBackground = registerColor("debugView.exceptionLabelBackground", { dark: "#6C2022", light: "#A31515", hcDark: "#6C2022", hcLight: "#A31515" }, "Background color for a label shown in the CALL STACK view when the debugger breaks on an exception.");
  const debugViewStateLabelForeground = registerColor("debugView.stateLabelForeground", foreground, "Foreground color for a label in the CALL STACK view showing the current session's or thread's state.");
  const debugViewStateLabelBackground = registerColor("debugView.stateLabelBackground", "#88888844", "Background color for a label in the CALL STACK view showing the current session's or thread's state.");
  const debugViewValueChangedHighlight = registerColor("debugView.valueChangedHighlight", "#569CD6", "Color used to highlight value changes in the debug views (ie. in the Variables view).");
  const debugConsoleInfoForeground = registerColor("debugConsole.infoForeground", { dark: editorInfoForeground, light: editorInfoForeground, hcDark: foreground, hcLight: foreground }, "Foreground color for info messages in debug REPL console.");
  const debugConsoleWarningForeground = registerColor("debugConsole.warningForeground", { dark: editorWarningForeground, light: editorWarningForeground, hcDark: "#008000", hcLight: editorWarningForeground }, "Foreground color for warning messages in debug REPL console.");
  const debugConsoleErrorForeground = registerColor("debugConsole.errorForeground", errorForeground, "Foreground color for error messages in debug REPL console.");
  const debugConsoleSourceForeground = registerColor("debugConsole.sourceForeground", foreground, "Foreground color for source filenames in debug REPL console.");
  const debugConsoleInputIconForeground = registerColor("debugConsoleInputIcon.foreground", foreground, "Foreground color for debug console input marker icon.");
  const debugIconPauseForeground = registerColor("debugIcon.pauseForeground", {
    dark: "#75BEFF",
    light: "#007ACC",
    hcDark: "#75BEFF",
    hcLight: "#007ACC"
  }, localize("debugIcon.pauseForeground", "Debug toolbar icon for pause."));
  const debugIconStopForeground = registerColor("debugIcon.stopForeground", {
    dark: "#F48771",
    light: "#A1260D",
    hcDark: "#F48771",
    hcLight: "#A1260D"
  }, localize("debugIcon.stopForeground", "Debug toolbar icon for stop."));
  const debugIconDisconnectForeground = registerColor("debugIcon.disconnectForeground", {
    dark: "#F48771",
    light: "#A1260D",
    hcDark: "#F48771",
    hcLight: "#A1260D"
  }, localize("debugIcon.disconnectForeground", "Debug toolbar icon for disconnect."));
  const debugIconRestartForeground = registerColor("debugIcon.restartForeground", {
    dark: "#89D185",
    light: "#388A34",
    hcDark: "#89D185",
    hcLight: "#388A34"
  }, localize("debugIcon.restartForeground", "Debug toolbar icon for restart."));
  const debugIconStepOverForeground = registerColor("debugIcon.stepOverForeground", {
    dark: "#75BEFF",
    light: "#007ACC",
    hcDark: "#75BEFF",
    hcLight: "#007ACC"
  }, localize("debugIcon.stepOverForeground", "Debug toolbar icon for step over."));
  const debugIconStepIntoForeground = registerColor("debugIcon.stepIntoForeground", {
    dark: "#75BEFF",
    light: "#007ACC",
    hcDark: "#75BEFF",
    hcLight: "#007ACC"
  }, localize("debugIcon.stepIntoForeground", "Debug toolbar icon for step into."));
  const debugIconStepOutForeground = registerColor("debugIcon.stepOutForeground", {
    dark: "#75BEFF",
    light: "#007ACC",
    hcDark: "#75BEFF",
    hcLight: "#007ACC"
  }, localize("debugIcon.stepOutForeground", "Debug toolbar icon for step over."));
  const debugIconContinueForeground = registerColor("debugIcon.continueForeground", {
    dark: "#75BEFF",
    light: "#007ACC",
    hcDark: "#75BEFF",
    hcLight: "#007ACC"
  }, localize("debugIcon.continueForeground", "Debug toolbar icon for continue."));
  const debugIconStepBackForeground = registerColor("debugIcon.stepBackForeground", {
    dark: "#75BEFF",
    light: "#007ACC",
    hcDark: "#75BEFF",
    hcLight: "#007ACC"
  }, localize("debugIcon.stepBackForeground", "Debug toolbar icon for step back."));
  registerThemingParticipant((theme, collector) => {
    const badgeBackgroundColor = theme.getColor(badgeBackground);
    const badgeForegroundColor = theme.getColor(badgeForeground);
    const listDeemphasizedForegroundColor = theme.getColor(listDeemphasizedForeground);
    const debugViewExceptionLabelForegroundColor = theme.getColor(debugViewExceptionLabelForeground);
    const debugViewExceptionLabelBackgroundColor = theme.getColor(debugViewExceptionLabelBackground);
    const debugViewStateLabelForegroundColor = theme.getColor(debugViewStateLabelForeground);
    const debugViewStateLabelBackgroundColor = theme.getColor(debugViewStateLabelBackground);
    const debugViewValueChangedHighlightColor = theme.getColor(debugViewValueChangedHighlight);
    const toolbarHoverBackgroundColor = theme.getColor(toolbarHoverBackground);
    collector.addRule(`
			/* Text colour of the call stack row's filename */
			.debug-pane .debug-call-stack .monaco-list-row:not(.selected) .stack-frame > .file .file-name {
				color: ${listDeemphasizedForegroundColor}
			}

			/* Line & column number "badge" for selected call stack row */
			.debug-pane .monaco-list-row.selected .line-number {
				background-color: ${badgeBackgroundColor};
				color: ${badgeForegroundColor};
			}

			/* Line & column number "badge" for unselected call stack row (basically all other rows) */
			.debug-pane .line-number {
				background-color: ${badgeBackgroundColor.transparent(0.6)};
				color: ${badgeForegroundColor.transparent(0.6)};
			}

			/* State "badge" displaying the active session's current state.
			* Only visible when there are more active debug sessions/threads running.
			*/
			.debug-pane .debug-call-stack .thread > .state.label,
			.debug-pane .debug-call-stack .session > .state.label {
				background-color: ${debugViewStateLabelBackgroundColor};
				color: ${debugViewStateLabelForegroundColor};
			}

			/* State "badge" displaying the active session's current state.
			* Only visible when there are more active debug sessions/threads running
			* and thread paused due to a thrown exception.
			*/
			.debug-pane .debug-call-stack .thread > .state.label.exception,
			.debug-pane .debug-call-stack .session > .state.label.exception {
				background-color: ${debugViewExceptionLabelBackgroundColor};
				color: ${debugViewExceptionLabelForegroundColor};
			}

			/* Info "badge" shown when the debugger pauses due to a thrown exception. */
			.debug-pane .call-stack-state-message > .label.exception {
				background-color: ${debugViewExceptionLabelBackgroundColor};
				color: ${debugViewExceptionLabelForegroundColor};
			}

			/* Animation of changed values in Debug viewlet */
			@keyframes debugViewletValueChanged {
				0%   { background-color: ${debugViewValueChangedHighlightColor.transparent(0)} }
				5%   { background-color: ${debugViewValueChangedHighlightColor.transparent(0.9)} }
				100% { background-color: ${debugViewValueChangedHighlightColor.transparent(0.3)} }
			}

			.debug-pane .monaco-list-row .expression .value.changed {
				background-color: ${debugViewValueChangedHighlightColor.transparent(0.3)};
				animation-name: debugViewletValueChanged;
				animation-duration: 1s;
				animation-fill-mode: forwards;
			}

			.monaco-list-row .expression .lazy-button:hover {
				background-color: ${toolbarHoverBackgroundColor}
			}
		`);
    const contrastBorderColor = theme.getColor(contrastBorder);
    if (contrastBorderColor) {
      collector.addRule(`
			.debug-pane .line-number {
				border: 1px solid ${contrastBorderColor};
			}
			`);
    }
    if (isHighContrast(theme.type)) {
      collector.addRule(`
			.debug-pane .line-number {
				background-color: ${badgeBackgroundColor};
				color: ${badgeForegroundColor};
			}`);
    }
    const tokenNameColor = theme.getColor(debugTokenExpressionName);
    const tokenTypeColor = theme.getColor(debugTokenExpressionType);
    const tokenValueColor = theme.getColor(debugTokenExpressionValue);
    const tokenStringColor = theme.getColor(debugTokenExpressionString);
    const tokenBooleanColor = theme.getColor(debugTokenExpressionBoolean);
    const tokenErrorColor = theme.getColor(debugTokenExpressionError);
    const tokenNumberColor = theme.getColor(debugTokenExpressionNumber);
    collector.addRule(`
			.monaco-workbench .monaco-list-row .expression .name {
				color: ${tokenNameColor};
			}

			.monaco-workbench .monaco-list-row .expression .type {
				color: ${tokenTypeColor};
			}

			.monaco-workbench .monaco-list-row .expression .value,
			.monaco-workbench .debug-hover-widget .value {
				color: ${tokenValueColor};
			}

			.monaco-workbench .monaco-list-row .expression .value.string,
			.monaco-workbench .debug-hover-widget .value.string {
				color: ${tokenStringColor};
			}

			.monaco-workbench .monaco-list-row .expression .value.boolean,
			.monaco-workbench .debug-hover-widget .value.boolean {
				color: ${tokenBooleanColor};
			}

			.monaco-workbench .monaco-list-row .expression .error,
			.monaco-workbench .debug-hover-widget .error,
			.monaco-workbench .debug-pane .debug-variables .scope .error {
				color: ${tokenErrorColor};
			}

			.monaco-workbench .monaco-list-row .expression .value.number,
			.monaco-workbench .debug-hover-widget .value.number {
				color: ${tokenNumberColor};
			}
		`);
    const debugConsoleInputBorderColor = theme.getColor(inputBorder) || Color.fromHex("#80808060");
    const debugConsoleInfoForegroundColor = theme.getColor(debugConsoleInfoForeground);
    const debugConsoleWarningForegroundColor = theme.getColor(debugConsoleWarningForeground);
    const debugConsoleErrorForegroundColor = theme.getColor(debugConsoleErrorForeground);
    const debugConsoleSourceForegroundColor = theme.getColor(debugConsoleSourceForeground);
    const debugConsoleInputIconForegroundColor = theme.getColor(debugConsoleInputIconForeground);
    collector.addRule(`
			.repl .repl-input-wrapper {
				border-top: 1px solid ${debugConsoleInputBorderColor};
			}

			.monaco-workbench .repl .repl-tree .output .expression .value.info {
				color: ${debugConsoleInfoForegroundColor};
			}

			.monaco-workbench .repl .repl-tree .output .expression .value.warn {
				color: ${debugConsoleWarningForegroundColor};
			}

			.monaco-workbench .repl .repl-tree .output .expression .value.error {
				color: ${debugConsoleErrorForegroundColor};
			}

			.monaco-workbench .repl .repl-tree .output .expression .source {
				color: ${debugConsoleSourceForegroundColor};
			}

			.monaco-workbench .repl .repl-tree .monaco-tl-contents .arrow {
				color: ${debugConsoleInputIconForegroundColor};
			}
		`);
    if (!theme.defines(debugConsoleInputIconForeground)) {
      collector.addRule(`
				.monaco-workbench.vs .repl .repl-tree .monaco-tl-contents .arrow {
					opacity: 0.25;
				}

				.monaco-workbench.vs-dark .repl .repl-tree .monaco-tl-contents .arrow {
					opacity: 0.4;
				}

				.monaco-workbench.hc-black .repl .repl-tree .monaco-tl-contents .arrow,
				.monaco-workbench.hc-light .repl .repl-tree .monaco-tl-contents .arrow {
					opacity: 1;
				}
			`);
    }
    const debugIconStartColor = theme.getColor(debugIconStartForeground);
    if (debugIconStartColor) {
      collector.addRule(`.monaco-workbench ${ThemeIcon.asCSSSelector(icons.debugStart)} { color: ${debugIconStartColor}; }`);
    }
    const debugIconPauseColor = theme.getColor(debugIconPauseForeground);
    if (debugIconPauseColor) {
      collector.addRule(`.monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugPause)}, .monaco-workbench ${ThemeIcon.asCSSSelector(icons.debugPause)} { color: ${debugIconPauseColor}; }`);
    }
    const debugIconStopColor = theme.getColor(debugIconStopForeground);
    if (debugIconStopColor) {
      collector.addRule(`.monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugStop)},.monaco-workbench ${ThemeIcon.asCSSSelector(icons.debugStop)} { color: ${debugIconStopColor}; }`);
    }
    const debugIconDisconnectColor = theme.getColor(debugIconDisconnectForeground);
    if (debugIconDisconnectColor) {
      collector.addRule(`.monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugDisconnect)},.monaco-workbench .debug-view-content ${ThemeIcon.asCSSSelector(icons.debugDisconnect)}, .monaco-workbench .debug-toolbar ${ThemeIcon.asCSSSelector(icons.debugDisconnect)}, .monaco-workbench .command-center-center ${ThemeIcon.asCSSSelector(icons.debugDisconnect)} { color: ${debugIconDisconnectColor}; }`);
    }
    const debugIconRestartColor = theme.getColor(debugIconRestartForeground);
    if (debugIconRestartColor) {
      collector.addRule(`.monaco-workbench ${ThemeIcon.asCSSSelector(icons.debugRestart)}, .monaco-workbench ${ThemeIcon.asCSSSelector(icons.debugRestartFrame)}, .monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugRestart)}, .monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugRestartFrame)} { color: ${debugIconRestartColor}; }`);
    }
    const debugIconStepOverColor = theme.getColor(debugIconStepOverForeground);
    if (debugIconStepOverColor) {
      collector.addRule(`.monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugStepOver)}, .monaco-workbench ${ThemeIcon.asCSSSelector(icons.debugStepOver)} { color: ${debugIconStepOverColor}; }`);
    }
    const debugIconStepIntoColor = theme.getColor(debugIconStepIntoForeground);
    if (debugIconStepIntoColor) {
      collector.addRule(`.monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugStepInto)}, .monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugStepInto)}, .monaco-workbench ${ThemeIcon.asCSSSelector(icons.debugStepInto)} { color: ${debugIconStepIntoColor}; }`);
    }
    const debugIconStepOutColor = theme.getColor(debugIconStepOutForeground);
    if (debugIconStepOutColor) {
      collector.addRule(`.monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugStepOut)}, .monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugStepOut)}, .monaco-workbench ${ThemeIcon.asCSSSelector(icons.debugStepOut)} { color: ${debugIconStepOutColor}; }`);
    }
    const debugIconContinueColor = theme.getColor(debugIconContinueForeground);
    if (debugIconContinueColor) {
      collector.addRule(`.monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugContinue)}, .monaco-workbench ${ThemeIcon.asCSSSelector(icons.debugContinue)}, .monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugReverseContinue)}, .monaco-workbench ${ThemeIcon.asCSSSelector(icons.debugReverseContinue)} { color: ${debugIconContinueColor}; }`);
    }
    const debugIconStepBackColor = theme.getColor(debugIconStepBackForeground);
    if (debugIconStepBackColor) {
      collector.addRule(`.monaco-workbench .part > .title > .title-actions .action-label${ThemeIcon.asCSSSelector(icons.debugStepBack)}, .monaco-workbench ${ThemeIcon.asCSSSelector(icons.debugStepBack)} { color: ${debugIconStepBackColor}; }`);
    }
  });
}
export {
  debugIconStartForeground,
  debugToolBarBackground,
  debugToolBarBorder,
  registerColors
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnQ29sb3JzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgcmVnaXN0ZXJDb2xvciwgZm9yZWdyb3VuZCwgZWRpdG9ySW5mb0ZvcmVncm91bmQsIGVkaXRvcldhcm5pbmdGb3JlZ3JvdW5kLCBlcnJvckZvcmVncm91bmQsIGJhZGdlQmFja2dyb3VuZCwgYmFkZ2VGb3JlZ3JvdW5kLCBsaXN0RGVlbXBoYXNpemVkRm9yZWdyb3VuZCwgY29udHJhc3RCb3JkZXIsIGlucHV0Qm9yZGVyLCB0b29sYmFySG92ZXJCYWNrZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCAqIGFzIGljb25zIGZyb20gJy4vZGVidWdJY29ucy5qcyc7XG5pbXBvcnQgeyBpc0hpZ2hDb250cmFzdCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZS5qcyc7XG5cbmV4cG9ydCBjb25zdCBkZWJ1Z1Rvb2xCYXJCYWNrZ3JvdW5kID0gcmVnaXN0ZXJDb2xvcignZGVidWdUb29sQmFyLmJhY2tncm91bmQnLCB7XG5cdGRhcms6ICcjMzMzMzMzJyxcblx0bGlnaHQ6ICcjRjNGM0YzJyxcblx0aGNEYXJrOiAnIzAwMDAwMCcsXG5cdGhjTGlnaHQ6ICcjRkZGRkZGJ1xufSwgbG9jYWxpemUoJ2RlYnVnVG9vbEJhckJhY2tncm91bmQnLCBcIkRlYnVnIHRvb2xiYXIgYmFja2dyb3VuZCBjb2xvci5cIikpO1xuXG5leHBvcnQgY29uc3QgZGVidWdUb29sQmFyQm9yZGVyID0gcmVnaXN0ZXJDb2xvcignZGVidWdUb29sQmFyLmJvcmRlcicsIG51bGwsIGxvY2FsaXplKCdkZWJ1Z1Rvb2xCYXJCb3JkZXInLCBcIkRlYnVnIHRvb2xiYXIgYm9yZGVyIGNvbG9yLlwiKSk7XG5cbmV4cG9ydCBjb25zdCBkZWJ1Z0ljb25TdGFydEZvcmVncm91bmQgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z0ljb24uc3RhcnRGb3JlZ3JvdW5kJywge1xuXHRkYXJrOiAnIzg5RDE4NScsXG5cdGxpZ2h0OiAnIzM4OEEzNCcsXG5cdGhjRGFyazogJyM4OUQxODUnLFxuXHRoY0xpZ2h0OiAnIzM4OEEzNCdcbn0sIGxvY2FsaXplKCdkZWJ1Z0ljb24uc3RhcnRGb3JlZ3JvdW5kJywgXCJEZWJ1ZyB0b29sYmFyIGljb24gZm9yIHN0YXJ0IGRlYnVnZ2luZy5cIikpO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJDb2xvcnMoKSB7XG5cblx0Y29uc3QgZGVidWdUb2tlbkV4cHJlc3Npb25OYW1lID0gcmVnaXN0ZXJDb2xvcignZGVidWdUb2tlbkV4cHJlc3Npb24ubmFtZScsIHsgZGFyazogJyNjNTg2YzAnLCBsaWdodDogJyM5YjQ2YjAnLCBoY0Rhcms6IGZvcmVncm91bmQsIGhjTGlnaHQ6IGZvcmVncm91bmQgfSwgJ0ZvcmVncm91bmQgY29sb3IgZm9yIHRoZSB0b2tlbiBuYW1lcyBzaG93biBpbiB0aGUgZGVidWcgdmlld3MgKGllLiB0aGUgVmFyaWFibGVzIG9yIFdhdGNoIHZpZXcpLicpO1xuXHRjb25zdCBkZWJ1Z1Rva2VuRXhwcmVzc2lvblR5cGUgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z1Rva2VuRXhwcmVzc2lvbi50eXBlJywgeyBkYXJrOiAnIzRBOTBFMicsIGxpZ2h0OiAnIzRBOTBFMicsIGhjRGFyazogZm9yZWdyb3VuZCwgaGNMaWdodDogZm9yZWdyb3VuZCB9LCAnRm9yZWdyb3VuZCBjb2xvciBmb3IgdGhlIHRva2VuIHR5cGVzIHNob3duIGluIHRoZSBkZWJ1ZyB2aWV3cyAoaWUuIHRoZSBWYXJpYWJsZXMgb3IgV2F0Y2ggdmlldykuJyk7XG5cdGNvbnN0IGRlYnVnVG9rZW5FeHByZXNzaW9uVmFsdWUgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z1Rva2VuRXhwcmVzc2lvbi52YWx1ZScsIHsgZGFyazogJyNjY2NjY2M5OScsIGxpZ2h0OiAnIzZjNmM2Y2NjJywgaGNEYXJrOiBmb3JlZ3JvdW5kLCBoY0xpZ2h0OiBmb3JlZ3JvdW5kIH0sICdGb3JlZ3JvdW5kIGNvbG9yIGZvciB0aGUgdG9rZW4gdmFsdWVzIHNob3duIGluIHRoZSBkZWJ1ZyB2aWV3cyAoaWUuIHRoZSBWYXJpYWJsZXMgb3IgV2F0Y2ggdmlldykuJyk7XG5cdGNvbnN0IGRlYnVnVG9rZW5FeHByZXNzaW9uU3RyaW5nID0gcmVnaXN0ZXJDb2xvcignZGVidWdUb2tlbkV4cHJlc3Npb24uc3RyaW5nJywgeyBkYXJrOiAnI2NlOTE3OCcsIGxpZ2h0OiAnI2EzMTUxNScsIGhjRGFyazogJyNmNDg3NzEnLCBoY0xpZ2h0OiAnI2EzMTUxNScgfSwgJ0ZvcmVncm91bmQgY29sb3IgZm9yIHN0cmluZ3MgaW4gdGhlIGRlYnVnIHZpZXdzIChpZS4gdGhlIFZhcmlhYmxlcyBvciBXYXRjaCB2aWV3KS4nKTtcblx0Y29uc3QgZGVidWdUb2tlbkV4cHJlc3Npb25Cb29sZWFuID0gcmVnaXN0ZXJDb2xvcignZGVidWdUb2tlbkV4cHJlc3Npb24uYm9vbGVhbicsIHsgZGFyazogJyM0ZTk0Y2UnLCBsaWdodDogJyMwMDAwZmYnLCBoY0Rhcms6ICcjNzViZGZlJywgaGNMaWdodDogJyMwMDAwZmYnIH0sICdGb3JlZ3JvdW5kIGNvbG9yIGZvciBib29sZWFucyBpbiB0aGUgZGVidWcgdmlld3MgKGllLiB0aGUgVmFyaWFibGVzIG9yIFdhdGNoIHZpZXcpLicpO1xuXHRjb25zdCBkZWJ1Z1Rva2VuRXhwcmVzc2lvbk51bWJlciA9IHJlZ2lzdGVyQ29sb3IoJ2RlYnVnVG9rZW5FeHByZXNzaW9uLm51bWJlcicsIHsgZGFyazogJyNiNWNlYTgnLCBsaWdodDogJyMwOTg2NTgnLCBoY0Rhcms6ICcjODlkMTg1JywgaGNMaWdodDogJyMwOTg2NTgnIH0sICdGb3JlZ3JvdW5kIGNvbG9yIGZvciBudW1iZXJzIGluIHRoZSBkZWJ1ZyB2aWV3cyAoaWUuIHRoZSBWYXJpYWJsZXMgb3IgV2F0Y2ggdmlldykuJyk7XG5cdGNvbnN0IGRlYnVnVG9rZW5FeHByZXNzaW9uRXJyb3IgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z1Rva2VuRXhwcmVzc2lvbi5lcnJvcicsIHsgZGFyazogJyNmNDg3NzEnLCBsaWdodDogJyNlNTE0MDAnLCBoY0Rhcms6ICcjZjQ4NzcxJywgaGNMaWdodDogJyNlNTE0MDAnIH0sICdGb3JlZ3JvdW5kIGNvbG9yIGZvciBleHByZXNzaW9uIGVycm9ycyBpbiB0aGUgZGVidWcgdmlld3MgKGllLiB0aGUgVmFyaWFibGVzIG9yIFdhdGNoIHZpZXcpIGFuZCBmb3IgZXJyb3IgbG9ncyBzaG93biBpbiB0aGUgZGVidWcgY29uc29sZS4nKTtcblxuXHRjb25zdCBkZWJ1Z1ZpZXdFeGNlcHRpb25MYWJlbEZvcmVncm91bmQgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z1ZpZXcuZXhjZXB0aW9uTGFiZWxGb3JlZ3JvdW5kJywgeyBkYXJrOiBmb3JlZ3JvdW5kLCBsaWdodDogJyNGRkYnLCBoY0Rhcms6IGZvcmVncm91bmQsIGhjTGlnaHQ6IGZvcmVncm91bmQgfSwgJ0ZvcmVncm91bmQgY29sb3IgZm9yIGEgbGFiZWwgc2hvd24gaW4gdGhlIENBTEwgU1RBQ0sgdmlldyB3aGVuIHRoZSBkZWJ1Z2dlciBicmVha3Mgb24gYW4gZXhjZXB0aW9uLicpO1xuXHRjb25zdCBkZWJ1Z1ZpZXdFeGNlcHRpb25MYWJlbEJhY2tncm91bmQgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z1ZpZXcuZXhjZXB0aW9uTGFiZWxCYWNrZ3JvdW5kJywgeyBkYXJrOiAnIzZDMjAyMicsIGxpZ2h0OiAnI0EzMTUxNScsIGhjRGFyazogJyM2QzIwMjInLCBoY0xpZ2h0OiAnI0EzMTUxNScgfSwgJ0JhY2tncm91bmQgY29sb3IgZm9yIGEgbGFiZWwgc2hvd24gaW4gdGhlIENBTEwgU1RBQ0sgdmlldyB3aGVuIHRoZSBkZWJ1Z2dlciBicmVha3Mgb24gYW4gZXhjZXB0aW9uLicpO1xuXHRjb25zdCBkZWJ1Z1ZpZXdTdGF0ZUxhYmVsRm9yZWdyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2RlYnVnVmlldy5zdGF0ZUxhYmVsRm9yZWdyb3VuZCcsIGZvcmVncm91bmQsICdGb3JlZ3JvdW5kIGNvbG9yIGZvciBhIGxhYmVsIGluIHRoZSBDQUxMIFNUQUNLIHZpZXcgc2hvd2luZyB0aGUgY3VycmVudCBzZXNzaW9uXFwncyBvciB0aHJlYWRcXCdzIHN0YXRlLicpO1xuXHRjb25zdCBkZWJ1Z1ZpZXdTdGF0ZUxhYmVsQmFja2dyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2RlYnVnVmlldy5zdGF0ZUxhYmVsQmFja2dyb3VuZCcsICcjODg4ODg4NDQnLCAnQmFja2dyb3VuZCBjb2xvciBmb3IgYSBsYWJlbCBpbiB0aGUgQ0FMTCBTVEFDSyB2aWV3IHNob3dpbmcgdGhlIGN1cnJlbnQgc2Vzc2lvblxcJ3Mgb3IgdGhyZWFkXFwncyBzdGF0ZS4nKTtcblx0Y29uc3QgZGVidWdWaWV3VmFsdWVDaGFuZ2VkSGlnaGxpZ2h0ID0gcmVnaXN0ZXJDb2xvcignZGVidWdWaWV3LnZhbHVlQ2hhbmdlZEhpZ2hsaWdodCcsICcjNTY5Q0Q2JywgJ0NvbG9yIHVzZWQgdG8gaGlnaGxpZ2h0IHZhbHVlIGNoYW5nZXMgaW4gdGhlIGRlYnVnIHZpZXdzIChpZS4gaW4gdGhlIFZhcmlhYmxlcyB2aWV3KS4nKTtcblxuXHRjb25zdCBkZWJ1Z0NvbnNvbGVJbmZvRm9yZWdyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2RlYnVnQ29uc29sZS5pbmZvRm9yZWdyb3VuZCcsIHsgZGFyazogZWRpdG9ySW5mb0ZvcmVncm91bmQsIGxpZ2h0OiBlZGl0b3JJbmZvRm9yZWdyb3VuZCwgaGNEYXJrOiBmb3JlZ3JvdW5kLCBoY0xpZ2h0OiBmb3JlZ3JvdW5kIH0sICdGb3JlZ3JvdW5kIGNvbG9yIGZvciBpbmZvIG1lc3NhZ2VzIGluIGRlYnVnIFJFUEwgY29uc29sZS4nKTtcblx0Y29uc3QgZGVidWdDb25zb2xlV2FybmluZ0ZvcmVncm91bmQgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z0NvbnNvbGUud2FybmluZ0ZvcmVncm91bmQnLCB7IGRhcms6IGVkaXRvcldhcm5pbmdGb3JlZ3JvdW5kLCBsaWdodDogZWRpdG9yV2FybmluZ0ZvcmVncm91bmQsIGhjRGFyazogJyMwMDgwMDAnLCBoY0xpZ2h0OiBlZGl0b3JXYXJuaW5nRm9yZWdyb3VuZCB9LCAnRm9yZWdyb3VuZCBjb2xvciBmb3Igd2FybmluZyBtZXNzYWdlcyBpbiBkZWJ1ZyBSRVBMIGNvbnNvbGUuJyk7XG5cdGNvbnN0IGRlYnVnQ29uc29sZUVycm9yRm9yZWdyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2RlYnVnQ29uc29sZS5lcnJvckZvcmVncm91bmQnLCBlcnJvckZvcmVncm91bmQsICdGb3JlZ3JvdW5kIGNvbG9yIGZvciBlcnJvciBtZXNzYWdlcyBpbiBkZWJ1ZyBSRVBMIGNvbnNvbGUuJyk7XG5cdGNvbnN0IGRlYnVnQ29uc29sZVNvdXJjZUZvcmVncm91bmQgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z0NvbnNvbGUuc291cmNlRm9yZWdyb3VuZCcsIGZvcmVncm91bmQsICdGb3JlZ3JvdW5kIGNvbG9yIGZvciBzb3VyY2UgZmlsZW5hbWVzIGluIGRlYnVnIFJFUEwgY29uc29sZS4nKTtcblx0Y29uc3QgZGVidWdDb25zb2xlSW5wdXRJY29uRm9yZWdyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2RlYnVnQ29uc29sZUlucHV0SWNvbi5mb3JlZ3JvdW5kJywgZm9yZWdyb3VuZCwgJ0ZvcmVncm91bmQgY29sb3IgZm9yIGRlYnVnIGNvbnNvbGUgaW5wdXQgbWFya2VyIGljb24uJyk7XG5cblx0Y29uc3QgZGVidWdJY29uUGF1c2VGb3JlZ3JvdW5kID0gcmVnaXN0ZXJDb2xvcignZGVidWdJY29uLnBhdXNlRm9yZWdyb3VuZCcsIHtcblx0XHRkYXJrOiAnIzc1QkVGRicsXG5cdFx0bGlnaHQ6ICcjMDA3QUNDJyxcblx0XHRoY0Rhcms6ICcjNzVCRUZGJyxcblx0XHRoY0xpZ2h0OiAnIzAwN0FDQydcblx0fSwgbG9jYWxpemUoJ2RlYnVnSWNvbi5wYXVzZUZvcmVncm91bmQnLCBcIkRlYnVnIHRvb2xiYXIgaWNvbiBmb3IgcGF1c2UuXCIpKTtcblxuXHRjb25zdCBkZWJ1Z0ljb25TdG9wRm9yZWdyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2RlYnVnSWNvbi5zdG9wRm9yZWdyb3VuZCcsIHtcblx0XHRkYXJrOiAnI0Y0ODc3MScsXG5cdFx0bGlnaHQ6ICcjQTEyNjBEJyxcblx0XHRoY0Rhcms6ICcjRjQ4NzcxJyxcblx0XHRoY0xpZ2h0OiAnI0ExMjYwRCdcblx0fSwgbG9jYWxpemUoJ2RlYnVnSWNvbi5zdG9wRm9yZWdyb3VuZCcsIFwiRGVidWcgdG9vbGJhciBpY29uIGZvciBzdG9wLlwiKSk7XG5cblx0Y29uc3QgZGVidWdJY29uRGlzY29ubmVjdEZvcmVncm91bmQgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z0ljb24uZGlzY29ubmVjdEZvcmVncm91bmQnLCB7XG5cdFx0ZGFyazogJyNGNDg3NzEnLFxuXHRcdGxpZ2h0OiAnI0ExMjYwRCcsXG5cdFx0aGNEYXJrOiAnI0Y0ODc3MScsXG5cdFx0aGNMaWdodDogJyNBMTI2MEQnXG5cdH0sIGxvY2FsaXplKCdkZWJ1Z0ljb24uZGlzY29ubmVjdEZvcmVncm91bmQnLCBcIkRlYnVnIHRvb2xiYXIgaWNvbiBmb3IgZGlzY29ubmVjdC5cIikpO1xuXG5cdGNvbnN0IGRlYnVnSWNvblJlc3RhcnRGb3JlZ3JvdW5kID0gcmVnaXN0ZXJDb2xvcignZGVidWdJY29uLnJlc3RhcnRGb3JlZ3JvdW5kJywge1xuXHRcdGRhcms6ICcjODlEMTg1Jyxcblx0XHRsaWdodDogJyMzODhBMzQnLFxuXHRcdGhjRGFyazogJyM4OUQxODUnLFxuXHRcdGhjTGlnaHQ6ICcjMzg4QTM0J1xuXHR9LCBsb2NhbGl6ZSgnZGVidWdJY29uLnJlc3RhcnRGb3JlZ3JvdW5kJywgXCJEZWJ1ZyB0b29sYmFyIGljb24gZm9yIHJlc3RhcnQuXCIpKTtcblxuXHRjb25zdCBkZWJ1Z0ljb25TdGVwT3ZlckZvcmVncm91bmQgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z0ljb24uc3RlcE92ZXJGb3JlZ3JvdW5kJywge1xuXHRcdGRhcms6ICcjNzVCRUZGJyxcblx0XHRsaWdodDogJyMwMDdBQ0MnLFxuXHRcdGhjRGFyazogJyM3NUJFRkYnLFxuXHRcdGhjTGlnaHQ6ICcjMDA3QUNDJ1xuXHR9LCBsb2NhbGl6ZSgnZGVidWdJY29uLnN0ZXBPdmVyRm9yZWdyb3VuZCcsIFwiRGVidWcgdG9vbGJhciBpY29uIGZvciBzdGVwIG92ZXIuXCIpKTtcblxuXHRjb25zdCBkZWJ1Z0ljb25TdGVwSW50b0ZvcmVncm91bmQgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z0ljb24uc3RlcEludG9Gb3JlZ3JvdW5kJywge1xuXHRcdGRhcms6ICcjNzVCRUZGJyxcblx0XHRsaWdodDogJyMwMDdBQ0MnLFxuXHRcdGhjRGFyazogJyM3NUJFRkYnLFxuXHRcdGhjTGlnaHQ6ICcjMDA3QUNDJ1xuXHR9LCBsb2NhbGl6ZSgnZGVidWdJY29uLnN0ZXBJbnRvRm9yZWdyb3VuZCcsIFwiRGVidWcgdG9vbGJhciBpY29uIGZvciBzdGVwIGludG8uXCIpKTtcblxuXHRjb25zdCBkZWJ1Z0ljb25TdGVwT3V0Rm9yZWdyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2RlYnVnSWNvbi5zdGVwT3V0Rm9yZWdyb3VuZCcsIHtcblx0XHRkYXJrOiAnIzc1QkVGRicsXG5cdFx0bGlnaHQ6ICcjMDA3QUNDJyxcblx0XHRoY0Rhcms6ICcjNzVCRUZGJyxcblx0XHRoY0xpZ2h0OiAnIzAwN0FDQydcblx0fSwgbG9jYWxpemUoJ2RlYnVnSWNvbi5zdGVwT3V0Rm9yZWdyb3VuZCcsIFwiRGVidWcgdG9vbGJhciBpY29uIGZvciBzdGVwIG92ZXIuXCIpKTtcblxuXHRjb25zdCBkZWJ1Z0ljb25Db250aW51ZUZvcmVncm91bmQgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z0ljb24uY29udGludWVGb3JlZ3JvdW5kJywge1xuXHRcdGRhcms6ICcjNzVCRUZGJyxcblx0XHRsaWdodDogJyMwMDdBQ0MnLFxuXHRcdGhjRGFyazogJyM3NUJFRkYnLFxuXHRcdGhjTGlnaHQ6ICcjMDA3QUNDJ1xuXHR9LCBsb2NhbGl6ZSgnZGVidWdJY29uLmNvbnRpbnVlRm9yZWdyb3VuZCcsIFwiRGVidWcgdG9vbGJhciBpY29uIGZvciBjb250aW51ZS5cIikpO1xuXG5cdGNvbnN0IGRlYnVnSWNvblN0ZXBCYWNrRm9yZWdyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2RlYnVnSWNvbi5zdGVwQmFja0ZvcmVncm91bmQnLCB7XG5cdFx0ZGFyazogJyM3NUJFRkYnLFxuXHRcdGxpZ2h0OiAnIzAwN0FDQycsXG5cdFx0aGNEYXJrOiAnIzc1QkVGRicsXG5cdFx0aGNMaWdodDogJyMwMDdBQ0MnXG5cdH0sIGxvY2FsaXplKCdkZWJ1Z0ljb24uc3RlcEJhY2tGb3JlZ3JvdW5kJywgXCJEZWJ1ZyB0b29sYmFyIGljb24gZm9yIHN0ZXAgYmFjay5cIikpO1xuXG5cdHJlZ2lzdGVyVGhlbWluZ1BhcnRpY2lwYW50KCh0aGVtZSwgY29sbGVjdG9yKSA9PiB7XG5cdFx0Ly8gQWxsIHRoZXNlIGNvbG91cnMgcHJvdmlkZSBhIGRlZmF1bHQgdmFsdWUgc28gdGhleSB3aWxsIG5ldmVyIGJlIHVuZGVmaW5lZCwgaGVuY2UgdGhlIGAhYFxuXHRcdGNvbnN0IGJhZGdlQmFja2dyb3VuZENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoYmFkZ2VCYWNrZ3JvdW5kKSE7XG5cdFx0Y29uc3QgYmFkZ2VGb3JlZ3JvdW5kQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihiYWRnZUZvcmVncm91bmQpITtcblx0XHRjb25zdCBsaXN0RGVlbXBoYXNpemVkRm9yZWdyb3VuZENvbG9yID0gdGhlbWUuZ2V0Q29sb3IobGlzdERlZW1waGFzaXplZEZvcmVncm91bmQpITtcblx0XHRjb25zdCBkZWJ1Z1ZpZXdFeGNlcHRpb25MYWJlbEZvcmVncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGRlYnVnVmlld0V4Y2VwdGlvbkxhYmVsRm9yZWdyb3VuZCkhO1xuXHRcdGNvbnN0IGRlYnVnVmlld0V4Y2VwdGlvbkxhYmVsQmFja2dyb3VuZENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdWaWV3RXhjZXB0aW9uTGFiZWxCYWNrZ3JvdW5kKSE7XG5cdFx0Y29uc3QgZGVidWdWaWV3U3RhdGVMYWJlbEZvcmVncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGRlYnVnVmlld1N0YXRlTGFiZWxGb3JlZ3JvdW5kKSE7XG5cdFx0Y29uc3QgZGVidWdWaWV3U3RhdGVMYWJlbEJhY2tncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGRlYnVnVmlld1N0YXRlTGFiZWxCYWNrZ3JvdW5kKSE7XG5cdFx0Y29uc3QgZGVidWdWaWV3VmFsdWVDaGFuZ2VkSGlnaGxpZ2h0Q29sb3IgPSB0aGVtZS5nZXRDb2xvcihkZWJ1Z1ZpZXdWYWx1ZUNoYW5nZWRIaWdobGlnaHQpITtcblx0XHRjb25zdCB0b29sYmFySG92ZXJCYWNrZ3JvdW5kQ29sb3IgPSB0aGVtZS5nZXRDb2xvcih0b29sYmFySG92ZXJCYWNrZ3JvdW5kKTtcblxuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGBcblx0XHRcdC8qIFRleHQgY29sb3VyIG9mIHRoZSBjYWxsIHN0YWNrIHJvdydzIGZpbGVuYW1lICovXG5cdFx0XHQuZGVidWctcGFuZSAuZGVidWctY2FsbC1zdGFjayAubW9uYWNvLWxpc3Qtcm93Om5vdCguc2VsZWN0ZWQpIC5zdGFjay1mcmFtZSA+IC5maWxlIC5maWxlLW5hbWUge1xuXHRcdFx0XHRjb2xvcjogJHtsaXN0RGVlbXBoYXNpemVkRm9yZWdyb3VuZENvbG9yfVxuXHRcdFx0fVxuXG5cdFx0XHQvKiBMaW5lICYgY29sdW1uIG51bWJlciBcImJhZGdlXCIgZm9yIHNlbGVjdGVkIGNhbGwgc3RhY2sgcm93ICovXG5cdFx0XHQuZGVidWctcGFuZSAubW9uYWNvLWxpc3Qtcm93LnNlbGVjdGVkIC5saW5lLW51bWJlciB7XG5cdFx0XHRcdGJhY2tncm91bmQtY29sb3I6ICR7YmFkZ2VCYWNrZ3JvdW5kQ29sb3J9O1xuXHRcdFx0XHRjb2xvcjogJHtiYWRnZUZvcmVncm91bmRDb2xvcn07XG5cdFx0XHR9XG5cblx0XHRcdC8qIExpbmUgJiBjb2x1bW4gbnVtYmVyIFwiYmFkZ2VcIiBmb3IgdW5zZWxlY3RlZCBjYWxsIHN0YWNrIHJvdyAoYmFzaWNhbGx5IGFsbCBvdGhlciByb3dzKSAqL1xuXHRcdFx0LmRlYnVnLXBhbmUgLmxpbmUtbnVtYmVyIHtcblx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogJHtiYWRnZUJhY2tncm91bmRDb2xvci50cmFuc3BhcmVudCgwLjYpfTtcblx0XHRcdFx0Y29sb3I6ICR7YmFkZ2VGb3JlZ3JvdW5kQ29sb3IudHJhbnNwYXJlbnQoMC42KX07XG5cdFx0XHR9XG5cblx0XHRcdC8qIFN0YXRlIFwiYmFkZ2VcIiBkaXNwbGF5aW5nIHRoZSBhY3RpdmUgc2Vzc2lvbidzIGN1cnJlbnQgc3RhdGUuXG5cdFx0XHQqIE9ubHkgdmlzaWJsZSB3aGVuIHRoZXJlIGFyZSBtb3JlIGFjdGl2ZSBkZWJ1ZyBzZXNzaW9ucy90aHJlYWRzIHJ1bm5pbmcuXG5cdFx0XHQqL1xuXHRcdFx0LmRlYnVnLXBhbmUgLmRlYnVnLWNhbGwtc3RhY2sgLnRocmVhZCA+IC5zdGF0ZS5sYWJlbCxcblx0XHRcdC5kZWJ1Zy1wYW5lIC5kZWJ1Zy1jYWxsLXN0YWNrIC5zZXNzaW9uID4gLnN0YXRlLmxhYmVsIHtcblx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogJHtkZWJ1Z1ZpZXdTdGF0ZUxhYmVsQmFja2dyb3VuZENvbG9yfTtcblx0XHRcdFx0Y29sb3I6ICR7ZGVidWdWaWV3U3RhdGVMYWJlbEZvcmVncm91bmRDb2xvcn07XG5cdFx0XHR9XG5cblx0XHRcdC8qIFN0YXRlIFwiYmFkZ2VcIiBkaXNwbGF5aW5nIHRoZSBhY3RpdmUgc2Vzc2lvbidzIGN1cnJlbnQgc3RhdGUuXG5cdFx0XHQqIE9ubHkgdmlzaWJsZSB3aGVuIHRoZXJlIGFyZSBtb3JlIGFjdGl2ZSBkZWJ1ZyBzZXNzaW9ucy90aHJlYWRzIHJ1bm5pbmdcblx0XHRcdCogYW5kIHRocmVhZCBwYXVzZWQgZHVlIHRvIGEgdGhyb3duIGV4Y2VwdGlvbi5cblx0XHRcdCovXG5cdFx0XHQuZGVidWctcGFuZSAuZGVidWctY2FsbC1zdGFjayAudGhyZWFkID4gLnN0YXRlLmxhYmVsLmV4Y2VwdGlvbixcblx0XHRcdC5kZWJ1Zy1wYW5lIC5kZWJ1Zy1jYWxsLXN0YWNrIC5zZXNzaW9uID4gLnN0YXRlLmxhYmVsLmV4Y2VwdGlvbiB7XG5cdFx0XHRcdGJhY2tncm91bmQtY29sb3I6ICR7ZGVidWdWaWV3RXhjZXB0aW9uTGFiZWxCYWNrZ3JvdW5kQ29sb3J9O1xuXHRcdFx0XHRjb2xvcjogJHtkZWJ1Z1ZpZXdFeGNlcHRpb25MYWJlbEZvcmVncm91bmRDb2xvcn07XG5cdFx0XHR9XG5cblx0XHRcdC8qIEluZm8gXCJiYWRnZVwiIHNob3duIHdoZW4gdGhlIGRlYnVnZ2VyIHBhdXNlcyBkdWUgdG8gYSB0aHJvd24gZXhjZXB0aW9uLiAqL1xuXHRcdFx0LmRlYnVnLXBhbmUgLmNhbGwtc3RhY2stc3RhdGUtbWVzc2FnZSA+IC5sYWJlbC5leGNlcHRpb24ge1xuXHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiAke2RlYnVnVmlld0V4Y2VwdGlvbkxhYmVsQmFja2dyb3VuZENvbG9yfTtcblx0XHRcdFx0Y29sb3I6ICR7ZGVidWdWaWV3RXhjZXB0aW9uTGFiZWxGb3JlZ3JvdW5kQ29sb3J9O1xuXHRcdFx0fVxuXG5cdFx0XHQvKiBBbmltYXRpb24gb2YgY2hhbmdlZCB2YWx1ZXMgaW4gRGVidWcgdmlld2xldCAqL1xuXHRcdFx0QGtleWZyYW1lcyBkZWJ1Z1ZpZXdsZXRWYWx1ZUNoYW5nZWQge1xuXHRcdFx0XHQwJSAgIHsgYmFja2dyb3VuZC1jb2xvcjogJHtkZWJ1Z1ZpZXdWYWx1ZUNoYW5nZWRIaWdobGlnaHRDb2xvci50cmFuc3BhcmVudCgwKX0gfVxuXHRcdFx0XHQ1JSAgIHsgYmFja2dyb3VuZC1jb2xvcjogJHtkZWJ1Z1ZpZXdWYWx1ZUNoYW5nZWRIaWdobGlnaHRDb2xvci50cmFuc3BhcmVudCgwLjkpfSB9XG5cdFx0XHRcdDEwMCUgeyBiYWNrZ3JvdW5kLWNvbG9yOiAke2RlYnVnVmlld1ZhbHVlQ2hhbmdlZEhpZ2hsaWdodENvbG9yLnRyYW5zcGFyZW50KDAuMyl9IH1cblx0XHRcdH1cblxuXHRcdFx0LmRlYnVnLXBhbmUgLm1vbmFjby1saXN0LXJvdyAuZXhwcmVzc2lvbiAudmFsdWUuY2hhbmdlZCB7XG5cdFx0XHRcdGJhY2tncm91bmQtY29sb3I6ICR7ZGVidWdWaWV3VmFsdWVDaGFuZ2VkSGlnaGxpZ2h0Q29sb3IudHJhbnNwYXJlbnQoMC4zKX07XG5cdFx0XHRcdGFuaW1hdGlvbi1uYW1lOiBkZWJ1Z1ZpZXdsZXRWYWx1ZUNoYW5nZWQ7XG5cdFx0XHRcdGFuaW1hdGlvbi1kdXJhdGlvbjogMXM7XG5cdFx0XHRcdGFuaW1hdGlvbi1maWxsLW1vZGU6IGZvcndhcmRzO1xuXHRcdFx0fVxuXG5cdFx0XHQubW9uYWNvLWxpc3Qtcm93IC5leHByZXNzaW9uIC5sYXp5LWJ1dHRvbjpob3ZlciB7XG5cdFx0XHRcdGJhY2tncm91bmQtY29sb3I6ICR7dG9vbGJhckhvdmVyQmFja2dyb3VuZENvbG9yfVxuXHRcdFx0fVxuXHRcdGApO1xuXG5cdFx0Y29uc3QgY29udHJhc3RCb3JkZXJDb2xvciA9IHRoZW1lLmdldENvbG9yKGNvbnRyYXN0Qm9yZGVyKTtcblxuXHRcdGlmIChjb250cmFzdEJvcmRlckNvbG9yKSB7XG5cdFx0XHRjb2xsZWN0b3IuYWRkUnVsZShgXG5cdFx0XHQuZGVidWctcGFuZSAubGluZS1udW1iZXIge1xuXHRcdFx0XHRib3JkZXI6IDFweCBzb2xpZCAke2NvbnRyYXN0Qm9yZGVyQ29sb3J9O1xuXHRcdFx0fVxuXHRcdFx0YCk7XG5cdFx0fVxuXG5cdFx0Ly8gVXNlIGZ1bGx5LW9wYXF1ZSBjb2xvcnMgZm9yIGxpbmUtbnVtYmVyIGJhZGdlc1xuXHRcdGlmIChpc0hpZ2hDb250cmFzdCh0aGVtZS50eXBlKSkge1xuXHRcdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdFx0LmRlYnVnLXBhbmUgLmxpbmUtbnVtYmVyIHtcblx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogJHtiYWRnZUJhY2tncm91bmRDb2xvcn07XG5cdFx0XHRcdGNvbG9yOiAke2JhZGdlRm9yZWdyb3VuZENvbG9yfTtcblx0XHRcdH1gKTtcblx0XHR9XG5cblx0XHRjb25zdCB0b2tlbk5hbWVDb2xvciA9IHRoZW1lLmdldENvbG9yKGRlYnVnVG9rZW5FeHByZXNzaW9uTmFtZSkhO1xuXHRcdGNvbnN0IHRva2VuVHlwZUNvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdUb2tlbkV4cHJlc3Npb25UeXBlKSE7XG5cdFx0Y29uc3QgdG9rZW5WYWx1ZUNvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdUb2tlbkV4cHJlc3Npb25WYWx1ZSkhO1xuXHRcdGNvbnN0IHRva2VuU3RyaW5nQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihkZWJ1Z1Rva2VuRXhwcmVzc2lvblN0cmluZykhO1xuXHRcdGNvbnN0IHRva2VuQm9vbGVhbkNvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdUb2tlbkV4cHJlc3Npb25Cb29sZWFuKSE7XG5cdFx0Y29uc3QgdG9rZW5FcnJvckNvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdUb2tlbkV4cHJlc3Npb25FcnJvcikhO1xuXHRcdGNvbnN0IHRva2VuTnVtYmVyQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihkZWJ1Z1Rva2VuRXhwcmVzc2lvbk51bWJlcikhO1xuXG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm1vbmFjby1saXN0LXJvdyAuZXhwcmVzc2lvbiAubmFtZSB7XG5cdFx0XHRcdGNvbG9yOiAke3Rva2VuTmFtZUNvbG9yfTtcblx0XHRcdH1cblxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm1vbmFjby1saXN0LXJvdyAuZXhwcmVzc2lvbiAudHlwZSB7XG5cdFx0XHRcdGNvbG9yOiAke3Rva2VuVHlwZUNvbG9yfTtcblx0XHRcdH1cblxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm1vbmFjby1saXN0LXJvdyAuZXhwcmVzc2lvbiAudmFsdWUsXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAuZGVidWctaG92ZXItd2lkZ2V0IC52YWx1ZSB7XG5cdFx0XHRcdGNvbG9yOiAke3Rva2VuVmFsdWVDb2xvcn07XG5cdFx0XHR9XG5cblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5tb25hY28tbGlzdC1yb3cgLmV4cHJlc3Npb24gLnZhbHVlLnN0cmluZyxcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5kZWJ1Zy1ob3Zlci13aWRnZXQgLnZhbHVlLnN0cmluZyB7XG5cdFx0XHRcdGNvbG9yOiAke3Rva2VuU3RyaW5nQ29sb3J9O1xuXHRcdFx0fVxuXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAubW9uYWNvLWxpc3Qtcm93IC5leHByZXNzaW9uIC52YWx1ZS5ib29sZWFuLFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLmRlYnVnLWhvdmVyLXdpZGdldCAudmFsdWUuYm9vbGVhbiB7XG5cdFx0XHRcdGNvbG9yOiAke3Rva2VuQm9vbGVhbkNvbG9yfTtcblx0XHRcdH1cblxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm1vbmFjby1saXN0LXJvdyAuZXhwcmVzc2lvbiAuZXJyb3IsXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAuZGVidWctaG92ZXItd2lkZ2V0IC5lcnJvcixcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5kZWJ1Zy1wYW5lIC5kZWJ1Zy12YXJpYWJsZXMgLnNjb3BlIC5lcnJvciB7XG5cdFx0XHRcdGNvbG9yOiAke3Rva2VuRXJyb3JDb2xvcn07XG5cdFx0XHR9XG5cblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5tb25hY28tbGlzdC1yb3cgLmV4cHJlc3Npb24gLnZhbHVlLm51bWJlcixcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5kZWJ1Zy1ob3Zlci13aWRnZXQgLnZhbHVlLm51bWJlciB7XG5cdFx0XHRcdGNvbG9yOiAke3Rva2VuTnVtYmVyQ29sb3J9O1xuXHRcdFx0fVxuXHRcdGApO1xuXG5cdFx0Y29uc3QgZGVidWdDb25zb2xlSW5wdXRCb3JkZXJDb2xvciA9IHRoZW1lLmdldENvbG9yKGlucHV0Qm9yZGVyKSB8fCBDb2xvci5mcm9tSGV4KCcjODA4MDgwNjAnKTtcblx0XHRjb25zdCBkZWJ1Z0NvbnNvbGVJbmZvRm9yZWdyb3VuZENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdDb25zb2xlSW5mb0ZvcmVncm91bmQpITtcblx0XHRjb25zdCBkZWJ1Z0NvbnNvbGVXYXJuaW5nRm9yZWdyb3VuZENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdDb25zb2xlV2FybmluZ0ZvcmVncm91bmQpITtcblx0XHRjb25zdCBkZWJ1Z0NvbnNvbGVFcnJvckZvcmVncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGRlYnVnQ29uc29sZUVycm9yRm9yZWdyb3VuZCkhO1xuXHRcdGNvbnN0IGRlYnVnQ29uc29sZVNvdXJjZUZvcmVncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGRlYnVnQ29uc29sZVNvdXJjZUZvcmVncm91bmQpITtcblx0XHRjb25zdCBkZWJ1Z0NvbnNvbGVJbnB1dEljb25Gb3JlZ3JvdW5kQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihkZWJ1Z0NvbnNvbGVJbnB1dEljb25Gb3JlZ3JvdW5kKSE7XG5cblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgXG5cdFx0XHQucmVwbCAucmVwbC1pbnB1dC13cmFwcGVyIHtcblx0XHRcdFx0Ym9yZGVyLXRvcDogMXB4IHNvbGlkICR7ZGVidWdDb25zb2xlSW5wdXRCb3JkZXJDb2xvcn07XG5cdFx0XHR9XG5cblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5yZXBsIC5yZXBsLXRyZWUgLm91dHB1dCAuZXhwcmVzc2lvbiAudmFsdWUuaW5mbyB7XG5cdFx0XHRcdGNvbG9yOiAke2RlYnVnQ29uc29sZUluZm9Gb3JlZ3JvdW5kQ29sb3J9O1xuXHRcdFx0fVxuXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucmVwbCAucmVwbC10cmVlIC5vdXRwdXQgLmV4cHJlc3Npb24gLnZhbHVlLndhcm4ge1xuXHRcdFx0XHRjb2xvcjogJHtkZWJ1Z0NvbnNvbGVXYXJuaW5nRm9yZWdyb3VuZENvbG9yfTtcblx0XHRcdH1cblxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnJlcGwgLnJlcGwtdHJlZSAub3V0cHV0IC5leHByZXNzaW9uIC52YWx1ZS5lcnJvciB7XG5cdFx0XHRcdGNvbG9yOiAke2RlYnVnQ29uc29sZUVycm9yRm9yZWdyb3VuZENvbG9yfTtcblx0XHRcdH1cblxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnJlcGwgLnJlcGwtdHJlZSAub3V0cHV0IC5leHByZXNzaW9uIC5zb3VyY2Uge1xuXHRcdFx0XHRjb2xvcjogJHtkZWJ1Z0NvbnNvbGVTb3VyY2VGb3JlZ3JvdW5kQ29sb3J9O1xuXHRcdFx0fVxuXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucmVwbCAucmVwbC10cmVlIC5tb25hY28tdGwtY29udGVudHMgLmFycm93IHtcblx0XHRcdFx0Y29sb3I6ICR7ZGVidWdDb25zb2xlSW5wdXRJY29uRm9yZWdyb3VuZENvbG9yfTtcblx0XHRcdH1cblx0XHRgKTtcblxuXHRcdGlmICghdGhlbWUuZGVmaW5lcyhkZWJ1Z0NvbnNvbGVJbnB1dEljb25Gb3JlZ3JvdW5kKSkge1xuXHRcdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdFx0XHQubW9uYWNvLXdvcmtiZW5jaC52cyAucmVwbCAucmVwbC10cmVlIC5tb25hY28tdGwtY29udGVudHMgLmFycm93IHtcblx0XHRcdFx0XHRvcGFjaXR5OiAwLjI1O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Lm1vbmFjby13b3JrYmVuY2gudnMtZGFyayAucmVwbCAucmVwbC10cmVlIC5tb25hY28tdGwtY29udGVudHMgLmFycm93IHtcblx0XHRcdFx0XHRvcGFjaXR5OiAwLjQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQubW9uYWNvLXdvcmtiZW5jaC5oYy1ibGFjayAucmVwbCAucmVwbC10cmVlIC5tb25hY28tdGwtY29udGVudHMgLmFycm93LFxuXHRcdFx0XHQubW9uYWNvLXdvcmtiZW5jaC5oYy1saWdodCAucmVwbCAucmVwbC10cmVlIC5tb25hY28tdGwtY29udGVudHMgLmFycm93IHtcblx0XHRcdFx0XHRvcGFjaXR5OiAxO1xuXHRcdFx0XHR9XG5cdFx0XHRgKTtcblx0XHR9XG5cblx0XHRjb25zdCBkZWJ1Z0ljb25TdGFydENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdJY29uU3RhcnRGb3JlZ3JvdW5kKTtcblx0XHRpZiAoZGVidWdJY29uU3RhcnRDb2xvcikge1xuXHRcdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYC5tb25hY28td29ya2JlbmNoICR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaWNvbnMuZGVidWdTdGFydCl9IHsgY29sb3I6ICR7ZGVidWdJY29uU3RhcnRDb2xvcn07IH1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBkZWJ1Z0ljb25QYXVzZUNvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdJY29uUGF1c2VGb3JlZ3JvdW5kKTtcblx0XHRpZiAoZGVidWdJY29uUGF1c2VDb2xvcikge1xuXHRcdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYC5tb25hY28td29ya2JlbmNoIC5wYXJ0ID4gLnRpdGxlID4gLnRpdGxlLWFjdGlvbnMgLmFjdGlvbi1sYWJlbCR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaWNvbnMuZGVidWdQYXVzZSl9LCAubW9uYWNvLXdvcmtiZW5jaCAke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnUGF1c2UpfSB7IGNvbG9yOiAke2RlYnVnSWNvblBhdXNlQ29sb3J9OyB9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVidWdJY29uU3RvcENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdJY29uU3RvcEZvcmVncm91bmQpO1xuXHRcdGlmIChkZWJ1Z0ljb25TdG9wQ29sb3IpIHtcblx0XHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLXdvcmtiZW5jaCAucGFydCA+IC50aXRsZSA+IC50aXRsZS1hY3Rpb25zIC5hY3Rpb24tbGFiZWwke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnU3RvcCl9LC5tb25hY28td29ya2JlbmNoICR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaWNvbnMuZGVidWdTdG9wKX0geyBjb2xvcjogJHtkZWJ1Z0ljb25TdG9wQ29sb3J9OyB9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVidWdJY29uRGlzY29ubmVjdENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdJY29uRGlzY29ubmVjdEZvcmVncm91bmQpO1xuXHRcdGlmIChkZWJ1Z0ljb25EaXNjb25uZWN0Q29sb3IpIHtcblx0XHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLXdvcmtiZW5jaCAucGFydCA+IC50aXRsZSA+IC50aXRsZS1hY3Rpb25zIC5hY3Rpb24tbGFiZWwke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnRGlzY29ubmVjdCl9LC5tb25hY28td29ya2JlbmNoIC5kZWJ1Zy12aWV3LWNvbnRlbnQgJHtUaGVtZUljb24uYXNDU1NTZWxlY3RvcihpY29ucy5kZWJ1Z0Rpc2Nvbm5lY3QpfSwgLm1vbmFjby13b3JrYmVuY2ggLmRlYnVnLXRvb2xiYXIgJHtUaGVtZUljb24uYXNDU1NTZWxlY3RvcihpY29ucy5kZWJ1Z0Rpc2Nvbm5lY3QpfSwgLm1vbmFjby13b3JrYmVuY2ggLmNvbW1hbmQtY2VudGVyLWNlbnRlciAke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnRGlzY29ubmVjdCl9IHsgY29sb3I6ICR7ZGVidWdJY29uRGlzY29ubmVjdENvbG9yfTsgfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlYnVnSWNvblJlc3RhcnRDb2xvciA9IHRoZW1lLmdldENvbG9yKGRlYnVnSWNvblJlc3RhcnRGb3JlZ3JvdW5kKTtcblx0XHRpZiAoZGVidWdJY29uUmVzdGFydENvbG9yKSB7XG5cdFx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby13b3JrYmVuY2ggJHtUaGVtZUljb24uYXNDU1NTZWxlY3RvcihpY29ucy5kZWJ1Z1Jlc3RhcnQpfSwgLm1vbmFjby13b3JrYmVuY2ggJHtUaGVtZUljb24uYXNDU1NTZWxlY3RvcihpY29ucy5kZWJ1Z1Jlc3RhcnRGcmFtZSl9LCAubW9uYWNvLXdvcmtiZW5jaCAucGFydCA+IC50aXRsZSA+IC50aXRsZS1hY3Rpb25zIC5hY3Rpb24tbGFiZWwke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnUmVzdGFydCl9LCAubW9uYWNvLXdvcmtiZW5jaCAucGFydCA+IC50aXRsZSA+IC50aXRsZS1hY3Rpb25zIC5hY3Rpb24tbGFiZWwke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnUmVzdGFydEZyYW1lKX0geyBjb2xvcjogJHtkZWJ1Z0ljb25SZXN0YXJ0Q29sb3J9OyB9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVidWdJY29uU3RlcE92ZXJDb2xvciA9IHRoZW1lLmdldENvbG9yKGRlYnVnSWNvblN0ZXBPdmVyRm9yZWdyb3VuZCk7XG5cdFx0aWYgKGRlYnVnSWNvblN0ZXBPdmVyQ29sb3IpIHtcblx0XHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLXdvcmtiZW5jaCAucGFydCA+IC50aXRsZSA+IC50aXRsZS1hY3Rpb25zIC5hY3Rpb24tbGFiZWwke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnU3RlcE92ZXIpfSwgLm1vbmFjby13b3JrYmVuY2ggJHtUaGVtZUljb24uYXNDU1NTZWxlY3RvcihpY29ucy5kZWJ1Z1N0ZXBPdmVyKX0geyBjb2xvcjogJHtkZWJ1Z0ljb25TdGVwT3ZlckNvbG9yfTsgfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlYnVnSWNvblN0ZXBJbnRvQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihkZWJ1Z0ljb25TdGVwSW50b0ZvcmVncm91bmQpO1xuXHRcdGlmIChkZWJ1Z0ljb25TdGVwSW50b0NvbG9yKSB7XG5cdFx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby13b3JrYmVuY2ggLnBhcnQgPiAudGl0bGUgPiAudGl0bGUtYWN0aW9ucyAuYWN0aW9uLWxhYmVsJHtUaGVtZUljb24uYXNDU1NTZWxlY3RvcihpY29ucy5kZWJ1Z1N0ZXBJbnRvKX0sIC5tb25hY28td29ya2JlbmNoIC5wYXJ0ID4gLnRpdGxlID4gLnRpdGxlLWFjdGlvbnMgLmFjdGlvbi1sYWJlbCR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaWNvbnMuZGVidWdTdGVwSW50byl9LCAubW9uYWNvLXdvcmtiZW5jaCAke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnU3RlcEludG8pfSB7IGNvbG9yOiAke2RlYnVnSWNvblN0ZXBJbnRvQ29sb3J9OyB9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVidWdJY29uU3RlcE91dENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdJY29uU3RlcE91dEZvcmVncm91bmQpO1xuXHRcdGlmIChkZWJ1Z0ljb25TdGVwT3V0Q29sb3IpIHtcblx0XHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLXdvcmtiZW5jaCAucGFydCA+IC50aXRsZSA+IC50aXRsZS1hY3Rpb25zIC5hY3Rpb24tbGFiZWwke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnU3RlcE91dCl9LCAubW9uYWNvLXdvcmtiZW5jaCAucGFydCA+IC50aXRsZSA+IC50aXRsZS1hY3Rpb25zIC5hY3Rpb24tbGFiZWwke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnU3RlcE91dCl9LCAubW9uYWNvLXdvcmtiZW5jaCAke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnU3RlcE91dCl9IHsgY29sb3I6ICR7ZGVidWdJY29uU3RlcE91dENvbG9yfTsgfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlYnVnSWNvbkNvbnRpbnVlQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihkZWJ1Z0ljb25Db250aW51ZUZvcmVncm91bmQpO1xuXHRcdGlmIChkZWJ1Z0ljb25Db250aW51ZUNvbG9yKSB7XG5cdFx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby13b3JrYmVuY2ggLnBhcnQgPiAudGl0bGUgPiAudGl0bGUtYWN0aW9ucyAuYWN0aW9uLWxhYmVsJHtUaGVtZUljb24uYXNDU1NTZWxlY3RvcihpY29ucy5kZWJ1Z0NvbnRpbnVlKX0sIC5tb25hY28td29ya2JlbmNoICR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaWNvbnMuZGVidWdDb250aW51ZSl9LCAubW9uYWNvLXdvcmtiZW5jaCAucGFydCA+IC50aXRsZSA+IC50aXRsZS1hY3Rpb25zIC5hY3Rpb24tbGFiZWwke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnUmV2ZXJzZUNvbnRpbnVlKX0sIC5tb25hY28td29ya2JlbmNoICR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaWNvbnMuZGVidWdSZXZlcnNlQ29udGludWUpfSB7IGNvbG9yOiAke2RlYnVnSWNvbkNvbnRpbnVlQ29sb3J9OyB9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVidWdJY29uU3RlcEJhY2tDb2xvciA9IHRoZW1lLmdldENvbG9yKGRlYnVnSWNvblN0ZXBCYWNrRm9yZWdyb3VuZCk7XG5cdFx0aWYgKGRlYnVnSWNvblN0ZXBCYWNrQ29sb3IpIHtcblx0XHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLXdvcmtiZW5jaCAucGFydCA+IC50aXRsZSA+IC50aXRsZS1hY3Rpb25zIC5hY3Rpb24tbGFiZWwke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnU3RlcEJhY2spfSwgLm1vbmFjby13b3JrYmVuY2ggJHtUaGVtZUljb24uYXNDU1NTZWxlY3RvcihpY29ucy5kZWJ1Z1N0ZXBCYWNrKX0geyBjb2xvcjogJHtkZWJ1Z0ljb25TdGVwQmFja0NvbG9yfTsgfWApO1xuXHRcdH1cblx0fSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGVBQWUsWUFBWSxzQkFBc0IseUJBQXlCLGlCQUFpQixpQkFBaUIsaUJBQWlCLDRCQUE0QixnQkFBZ0IsYUFBYSw4QkFBOEI7QUFDN04sU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZ0JBQWdCO0FBQ3pCLFlB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
