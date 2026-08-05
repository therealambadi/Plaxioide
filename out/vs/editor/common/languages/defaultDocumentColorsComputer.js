import { Color, HSLA } from "../../../base/common/color.js";
function _parseCaptureGroups(captureGroups) {
  const values = [];
  for (const captureGroup of captureGroups) {
    const parsedNumber = Number(captureGroup);
    if (parsedNumber || parsedNumber === 0 && captureGroup.replace(/\s/g, "") !== "") {
      values.push(parsedNumber);
    }
  }
  return values;
}
function _toIColor(r, g, b, a) {
  return {
    red: r / 255,
    blue: b / 255,
    green: g / 255,
    alpha: a
  };
}
function _findRange(model, match) {
  const index = match.index;
  const length = match[0].length;
  if (index === void 0) {
    return;
  }
  const startPosition = model.positionAt(index);
  const range = {
    startLineNumber: startPosition.lineNumber,
    startColumn: startPosition.column,
    endLineNumber: startPosition.lineNumber,
    endColumn: startPosition.column + length
  };
  return range;
}
function _findHexColorInformation(range, hexValue) {
  if (!range) {
    return;
  }
  const parsedHexColor = Color.Format.CSS.parseHex(hexValue);
  if (!parsedHexColor) {
    return;
  }
  return {
    range,
    color: _toIColor(parsedHexColor.rgba.r, parsedHexColor.rgba.g, parsedHexColor.rgba.b, parsedHexColor.rgba.a)
  };
}
function _findRGBColorInformation(range, matches, isAlpha) {
  if (!range || matches.length !== 1) {
    return;
  }
  const match = matches[0];
  const captureGroups = match.values();
  const parsedRegex = _parseCaptureGroups(captureGroups);
  return {
    range,
    color: _toIColor(parsedRegex[0], parsedRegex[1], parsedRegex[2], isAlpha ? parsedRegex[3] : 1)
  };
}
function _findHSLColorInformation(range, matches, isAlpha) {
  if (!range || matches.length !== 1) {
    return;
  }
  const match = matches[0];
  const captureGroups = match.values();
  const parsedRegex = _parseCaptureGroups(captureGroups);
  const colorEquivalent = new Color(new HSLA(parsedRegex[0], parsedRegex[1] / 100, parsedRegex[2] / 100, isAlpha ? parsedRegex[3] : 1));
  return {
    range,
    color: _toIColor(colorEquivalent.rgba.r, colorEquivalent.rgba.g, colorEquivalent.rgba.b, colorEquivalent.rgba.a)
  };
}
function _findMatches(model, regex) {
  if (typeof model === "string") {
    return [...model.matchAll(regex)];
  } else {
    return model.findMatches(regex);
  }
}
function computeColors(model) {
  const result = [];
  const initialValidationRegex = /\b(rgb|rgba|hsl|hsla)(\([0-9\s,.\%]*\))|\s+(#)([A-Fa-f0-9]{6})\b|\s+(#)([A-Fa-f0-9]{8})\b|^(#)([A-Fa-f0-9]{6})\b|^(#)([A-Fa-f0-9]{8})\b/gm;
  const initialValidationMatches = _findMatches(model, initialValidationRegex);
  if (initialValidationMatches.length > 0) {
    for (const initialMatch of initialValidationMatches) {
      const initialCaptureGroups = initialMatch.filter((captureGroup) => captureGroup !== void 0);
      const colorScheme = initialCaptureGroups[1];
      const colorParameters = initialCaptureGroups[2];
      if (!colorParameters) {
        continue;
      }
      let colorInformation;
      if (colorScheme === "rgb") {
        const regexParameters = /^\(\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*\)$/gm;
        colorInformation = _findRGBColorInformation(_findRange(model, initialMatch), _findMatches(colorParameters, regexParameters), false);
      } else if (colorScheme === "rgba") {
        const regexParameters = /^\(\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(0[.][0-9]+|[.][0-9]+|[01][.]|[01])\s*\)$/gm;
        colorInformation = _findRGBColorInformation(_findRange(model, initialMatch), _findMatches(colorParameters, regexParameters), true);
      } else if (colorScheme === "hsl") {
        const regexParameters = /^\(\s*(36[0]|3[0-5][0-9]|[12][0-9][0-9]|[1-9]?[0-9])\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*\)$/gm;
        colorInformation = _findHSLColorInformation(_findRange(model, initialMatch), _findMatches(colorParameters, regexParameters), false);
      } else if (colorScheme === "hsla") {
        const regexParameters = /^\(\s*(36[0]|3[0-5][0-9]|[12][0-9][0-9]|[1-9]?[0-9])\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*,\s*(0[.][0-9]+|[.][0-9]+|[01][.]|[01])\s*\)$/gm;
        colorInformation = _findHSLColorInformation(_findRange(model, initialMatch), _findMatches(colorParameters, regexParameters), true);
      } else if (colorScheme === "#") {
        colorInformation = _findHexColorInformation(_findRange(model, initialMatch), colorScheme + colorParameters);
      }
      if (colorInformation) {
        result.push(colorInformation);
      }
    }
  }
  return result;
}
function computeDefaultDocumentColors(model) {
  if (!model || typeof model.getValue !== "function" || typeof model.positionAt !== "function") {
    return [];
  }
  return computeColors(model);
}
export {
  computeDefaultDocumentColors
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9kZWZhdWx0RG9jdW1lbnRDb2xvcnNDb21wdXRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgeyBDb2xvciwgSFNMQSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiB9IGZyb20gJy4uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSVJhbmdlIH0gZnJvbSAnLi4vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJQ29sb3IsIElDb2xvckluZm9ybWF0aW9uIH0gZnJvbSAnLi4vbGFuZ3VhZ2VzLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJRG9jdW1lbnRDb2xvckNvbXB1dGVyVGFyZ2V0IHtcblx0Z2V0VmFsdWUoKTogc3RyaW5nO1xuXHRwb3NpdGlvbkF0KG9mZnNldDogbnVtYmVyKTogSVBvc2l0aW9uO1xuXHRmaW5kTWF0Y2hlcyhyZWdleDogUmVnRXhwKTogUmVnRXhwTWF0Y2hBcnJheVtdO1xufVxuXG5mdW5jdGlvbiBfcGFyc2VDYXB0dXJlR3JvdXBzKGNhcHR1cmVHcm91cHM6IEl0ZXJhYmxlSXRlcmF0b3I8c3RyaW5nPikge1xuXHRjb25zdCB2YWx1ZXMgPSBbXTtcblx0Zm9yIChjb25zdCBjYXB0dXJlR3JvdXAgb2YgY2FwdHVyZUdyb3Vwcykge1xuXHRcdGNvbnN0IHBhcnNlZE51bWJlciA9IE51bWJlcihjYXB0dXJlR3JvdXApO1xuXHRcdGlmIChwYXJzZWROdW1iZXIgfHwgcGFyc2VkTnVtYmVyID09PSAwICYmIGNhcHR1cmVHcm91cC5yZXBsYWNlKC9cXHMvZywgJycpICE9PSAnJykge1xuXHRcdFx0dmFsdWVzLnB1c2gocGFyc2VkTnVtYmVyKTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHZhbHVlcztcbn1cblxuZnVuY3Rpb24gX3RvSUNvbG9yKHI6IG51bWJlciwgZzogbnVtYmVyLCBiOiBudW1iZXIsIGE6IG51bWJlcik6IElDb2xvciB7XG5cdHJldHVybiB7XG5cdFx0cmVkOiByIC8gMjU1LFxuXHRcdGJsdWU6IGIgLyAyNTUsXG5cdFx0Z3JlZW46IGcgLyAyNTUsXG5cdFx0YWxwaGE6IGFcblx0fTtcbn1cblxuZnVuY3Rpb24gX2ZpbmRSYW5nZShtb2RlbDogSURvY3VtZW50Q29sb3JDb21wdXRlclRhcmdldCwgbWF0Y2g6IFJlZ0V4cE1hdGNoQXJyYXkpOiBJUmFuZ2UgfCB1bmRlZmluZWQge1xuXHRjb25zdCBpbmRleCA9IG1hdGNoLmluZGV4O1xuXHRjb25zdCBsZW5ndGggPSBtYXRjaFswXS5sZW5ndGg7XG5cdGlmIChpbmRleCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGNvbnN0IHN0YXJ0UG9zaXRpb24gPSBtb2RlbC5wb3NpdGlvbkF0KGluZGV4KTtcblx0Y29uc3QgcmFuZ2U6IElSYW5nZSA9IHtcblx0XHRzdGFydExpbmVOdW1iZXI6IHN0YXJ0UG9zaXRpb24ubGluZU51bWJlcixcblx0XHRzdGFydENvbHVtbjogc3RhcnRQb3NpdGlvbi5jb2x1bW4sXG5cdFx0ZW5kTGluZU51bWJlcjogc3RhcnRQb3NpdGlvbi5saW5lTnVtYmVyLFxuXHRcdGVuZENvbHVtbjogc3RhcnRQb3NpdGlvbi5jb2x1bW4gKyBsZW5ndGhcblx0fTtcblx0cmV0dXJuIHJhbmdlO1xufVxuXG5mdW5jdGlvbiBfZmluZEhleENvbG9ySW5mb3JtYXRpb24ocmFuZ2U6IElSYW5nZSB8IHVuZGVmaW5lZCwgaGV4VmFsdWU6IHN0cmluZykge1xuXHRpZiAoIXJhbmdlKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGNvbnN0IHBhcnNlZEhleENvbG9yID0gQ29sb3IuRm9ybWF0LkNTUy5wYXJzZUhleChoZXhWYWx1ZSk7XG5cdGlmICghcGFyc2VkSGV4Q29sb3IpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0cmV0dXJuIHtcblx0XHRyYW5nZTogcmFuZ2UsXG5cdFx0Y29sb3I6IF90b0lDb2xvcihwYXJzZWRIZXhDb2xvci5yZ2JhLnIsIHBhcnNlZEhleENvbG9yLnJnYmEuZywgcGFyc2VkSGV4Q29sb3IucmdiYS5iLCBwYXJzZWRIZXhDb2xvci5yZ2JhLmEpXG5cdH07XG59XG5cbmZ1bmN0aW9uIF9maW5kUkdCQ29sb3JJbmZvcm1hdGlvbihyYW5nZTogSVJhbmdlIHwgdW5kZWZpbmVkLCBtYXRjaGVzOiBSZWdFeHBNYXRjaEFycmF5W10sIGlzQWxwaGE6IGJvb2xlYW4pIHtcblx0aWYgKCFyYW5nZSB8fCBtYXRjaGVzLmxlbmd0aCAhPT0gMSkge1xuXHRcdHJldHVybjtcblx0fVxuXHRjb25zdCBtYXRjaCA9IG1hdGNoZXNbMF0hO1xuXHRjb25zdCBjYXB0dXJlR3JvdXBzID0gbWF0Y2gudmFsdWVzKCk7XG5cdGNvbnN0IHBhcnNlZFJlZ2V4ID0gX3BhcnNlQ2FwdHVyZUdyb3VwcyhjYXB0dXJlR3JvdXBzKTtcblx0cmV0dXJuIHtcblx0XHRyYW5nZTogcmFuZ2UsXG5cdFx0Y29sb3I6IF90b0lDb2xvcihwYXJzZWRSZWdleFswXSwgcGFyc2VkUmVnZXhbMV0sIHBhcnNlZFJlZ2V4WzJdLCBpc0FscGhhID8gcGFyc2VkUmVnZXhbM10gOiAxKVxuXHR9O1xufVxuXG5mdW5jdGlvbiBfZmluZEhTTENvbG9ySW5mb3JtYXRpb24ocmFuZ2U6IElSYW5nZSB8IHVuZGVmaW5lZCwgbWF0Y2hlczogUmVnRXhwTWF0Y2hBcnJheVtdLCBpc0FscGhhOiBib29sZWFuKSB7XG5cdGlmICghcmFuZ2UgfHwgbWF0Y2hlcy5sZW5ndGggIT09IDEpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y29uc3QgbWF0Y2ggPSBtYXRjaGVzWzBdITtcblx0Y29uc3QgY2FwdHVyZUdyb3VwcyA9IG1hdGNoLnZhbHVlcygpO1xuXHRjb25zdCBwYXJzZWRSZWdleCA9IF9wYXJzZUNhcHR1cmVHcm91cHMoY2FwdHVyZUdyb3Vwcyk7XG5cdGNvbnN0IGNvbG9yRXF1aXZhbGVudCA9IG5ldyBDb2xvcihuZXcgSFNMQShwYXJzZWRSZWdleFswXSwgcGFyc2VkUmVnZXhbMV0gLyAxMDAsIHBhcnNlZFJlZ2V4WzJdIC8gMTAwLCBpc0FscGhhID8gcGFyc2VkUmVnZXhbM10gOiAxKSk7XG5cdHJldHVybiB7XG5cdFx0cmFuZ2U6IHJhbmdlLFxuXHRcdGNvbG9yOiBfdG9JQ29sb3IoY29sb3JFcXVpdmFsZW50LnJnYmEuciwgY29sb3JFcXVpdmFsZW50LnJnYmEuZywgY29sb3JFcXVpdmFsZW50LnJnYmEuYiwgY29sb3JFcXVpdmFsZW50LnJnYmEuYSlcblx0fTtcbn1cblxuZnVuY3Rpb24gX2ZpbmRNYXRjaGVzKG1vZGVsOiBJRG9jdW1lbnRDb2xvckNvbXB1dGVyVGFyZ2V0IHwgc3RyaW5nLCByZWdleDogUmVnRXhwKTogUmVnRXhwTWF0Y2hBcnJheVtdIHtcblx0aWYgKHR5cGVvZiBtb2RlbCA9PT0gJ3N0cmluZycpIHtcblx0XHRyZXR1cm4gWy4uLm1vZGVsLm1hdGNoQWxsKHJlZ2V4KV07XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIG1vZGVsLmZpbmRNYXRjaGVzKHJlZ2V4KTtcblx0fVxufVxuXG5mdW5jdGlvbiBjb21wdXRlQ29sb3JzKG1vZGVsOiBJRG9jdW1lbnRDb2xvckNvbXB1dGVyVGFyZ2V0KTogSUNvbG9ySW5mb3JtYXRpb25bXSB7XG5cdGNvbnN0IHJlc3VsdDogSUNvbG9ySW5mb3JtYXRpb25bXSA9IFtdO1xuXHQvLyBFYXJseSB2YWxpZGF0aW9uIGZvciBSR0IgYW5kIEhTTFxuXHRjb25zdCBpbml0aWFsVmFsaWRhdGlvblJlZ2V4ID0gL1xcYihyZ2J8cmdiYXxoc2x8aHNsYSkoXFwoWzAtOVxccywuXFwlXSpcXCkpfFxccysoIykoW0EtRmEtZjAtOV17Nn0pXFxifFxccysoIykoW0EtRmEtZjAtOV17OH0pXFxifF4oIykoW0EtRmEtZjAtOV17Nn0pXFxifF4oIykoW0EtRmEtZjAtOV17OH0pXFxiL2dtO1xuXHRjb25zdCBpbml0aWFsVmFsaWRhdGlvbk1hdGNoZXMgPSBfZmluZE1hdGNoZXMobW9kZWwsIGluaXRpYWxWYWxpZGF0aW9uUmVnZXgpO1xuXG5cdC8vIFBvdGVudGlhbCBjb2xvcnMgaGF2ZSBiZWVuIGZvdW5kLCB2YWxpZGF0ZSB0aGUgcGFyYW1ldGVyc1xuXHRpZiAoaW5pdGlhbFZhbGlkYXRpb25NYXRjaGVzLmxlbmd0aCA+IDApIHtcblx0XHRmb3IgKGNvbnN0IGluaXRpYWxNYXRjaCBvZiBpbml0aWFsVmFsaWRhdGlvbk1hdGNoZXMpIHtcblx0XHRcdGNvbnN0IGluaXRpYWxDYXB0dXJlR3JvdXBzID0gaW5pdGlhbE1hdGNoLmZpbHRlcihjYXB0dXJlR3JvdXAgPT4gY2FwdHVyZUdyb3VwICE9PSB1bmRlZmluZWQpO1xuXHRcdFx0Y29uc3QgY29sb3JTY2hlbWUgPSBpbml0aWFsQ2FwdHVyZUdyb3Vwc1sxXTtcblx0XHRcdGNvbnN0IGNvbG9yUGFyYW1ldGVycyA9IGluaXRpYWxDYXB0dXJlR3JvdXBzWzJdO1xuXHRcdFx0aWYgKCFjb2xvclBhcmFtZXRlcnMpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRsZXQgY29sb3JJbmZvcm1hdGlvbjtcblx0XHRcdGlmIChjb2xvclNjaGVtZSA9PT0gJ3JnYicpIHtcblx0XHRcdFx0Y29uc3QgcmVnZXhQYXJhbWV0ZXJzID0gL15cXChcXHMqKDI1WzAtNV18MlswLTRdWzAtOV18MVswLTldezJ9fFsxLTldWzAtOV18WzAtOV0pXFxzKixcXHMqKDI1WzAtNV18MlswLTRdWzAtOV18MVswLTldezJ9fFsxLTldWzAtOV18WzAtOV0pXFxzKixcXHMqKDI1WzAtNV18MlswLTRdWzAtOV18MVswLTldezJ9fFsxLTldWzAtOV18WzAtOV0pXFxzKlxcKSQvZ207XG5cdFx0XHRcdGNvbG9ySW5mb3JtYXRpb24gPSBfZmluZFJHQkNvbG9ySW5mb3JtYXRpb24oX2ZpbmRSYW5nZShtb2RlbCwgaW5pdGlhbE1hdGNoKSwgX2ZpbmRNYXRjaGVzKGNvbG9yUGFyYW1ldGVycywgcmVnZXhQYXJhbWV0ZXJzKSwgZmFsc2UpO1xuXHRcdFx0fSBlbHNlIGlmIChjb2xvclNjaGVtZSA9PT0gJ3JnYmEnKSB7XG5cdFx0XHRcdGNvbnN0IHJlZ2V4UGFyYW1ldGVycyA9IC9eXFwoXFxzKigyNVswLTVdfDJbMC00XVswLTldfDFbMC05XXsyfXxbMS05XVswLTldfFswLTldKVxccyosXFxzKigyNVswLTVdfDJbMC00XVswLTldfDFbMC05XXsyfXxbMS05XVswLTldfFswLTldKVxccyosXFxzKigyNVswLTVdfDJbMC00XVswLTldfDFbMC05XXsyfXxbMS05XVswLTldfFswLTldKVxccyosXFxzKigwWy5dWzAtOV0rfFsuXVswLTldK3xbMDFdWy5dfFswMV0pXFxzKlxcKSQvZ207XG5cdFx0XHRcdGNvbG9ySW5mb3JtYXRpb24gPSBfZmluZFJHQkNvbG9ySW5mb3JtYXRpb24oX2ZpbmRSYW5nZShtb2RlbCwgaW5pdGlhbE1hdGNoKSwgX2ZpbmRNYXRjaGVzKGNvbG9yUGFyYW1ldGVycywgcmVnZXhQYXJhbWV0ZXJzKSwgdHJ1ZSk7XG5cdFx0XHR9IGVsc2UgaWYgKGNvbG9yU2NoZW1lID09PSAnaHNsJykge1xuXHRcdFx0XHRjb25zdCByZWdleFBhcmFtZXRlcnMgPSAvXlxcKFxccyooMzZbMF18M1swLTVdWzAtOV18WzEyXVswLTldWzAtOV18WzEtOV0/WzAtOV0pXFxzKixcXHMqKDEwMHxcXGR7MSwyfVsuXVxcZCp8XFxkezEsMn0pJVxccyosXFxzKigxMDB8XFxkezEsMn1bLl1cXGQqfFxcZHsxLDJ9KSVcXHMqXFwpJC9nbTtcblx0XHRcdFx0Y29sb3JJbmZvcm1hdGlvbiA9IF9maW5kSFNMQ29sb3JJbmZvcm1hdGlvbihfZmluZFJhbmdlKG1vZGVsLCBpbml0aWFsTWF0Y2gpLCBfZmluZE1hdGNoZXMoY29sb3JQYXJhbWV0ZXJzLCByZWdleFBhcmFtZXRlcnMpLCBmYWxzZSk7XG5cdFx0XHR9IGVsc2UgaWYgKGNvbG9yU2NoZW1lID09PSAnaHNsYScpIHtcblx0XHRcdFx0Y29uc3QgcmVnZXhQYXJhbWV0ZXJzID0gL15cXChcXHMqKDM2WzBdfDNbMC01XVswLTldfFsxMl1bMC05XVswLTldfFsxLTldP1swLTldKVxccyosXFxzKigxMDB8XFxkezEsMn1bLl1cXGQqfFxcZHsxLDJ9KSVcXHMqLFxccyooMTAwfFxcZHsxLDJ9Wy5dXFxkKnxcXGR7MSwyfSklXFxzKixcXHMqKDBbLl1bMC05XSt8Wy5dWzAtOV0rfFswMV1bLl18WzAxXSlcXHMqXFwpJC9nbTtcblx0XHRcdFx0Y29sb3JJbmZvcm1hdGlvbiA9IF9maW5kSFNMQ29sb3JJbmZvcm1hdGlvbihfZmluZFJhbmdlKG1vZGVsLCBpbml0aWFsTWF0Y2gpLCBfZmluZE1hdGNoZXMoY29sb3JQYXJhbWV0ZXJzLCByZWdleFBhcmFtZXRlcnMpLCB0cnVlKTtcblx0XHRcdH0gZWxzZSBpZiAoY29sb3JTY2hlbWUgPT09ICcjJykge1xuXHRcdFx0XHRjb2xvckluZm9ybWF0aW9uID0gX2ZpbmRIZXhDb2xvckluZm9ybWF0aW9uKF9maW5kUmFuZ2UobW9kZWwsIGluaXRpYWxNYXRjaCksIGNvbG9yU2NoZW1lICsgY29sb3JQYXJhbWV0ZXJzKTtcblx0XHRcdH1cblx0XHRcdGlmIChjb2xvckluZm9ybWF0aW9uKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGNvbG9ySW5mb3JtYXRpb24pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgYWxsIGRlZmF1bHQgZG9jdW1lbnQgY29sb3JzIGluIHRoZSBwcm92aWRlZCBkb2N1bWVudFxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcHV0ZURlZmF1bHREb2N1bWVudENvbG9ycyhtb2RlbDogSURvY3VtZW50Q29sb3JDb21wdXRlclRhcmdldCk6IElDb2xvckluZm9ybWF0aW9uW10ge1xuXHRpZiAoIW1vZGVsIHx8IHR5cGVvZiBtb2RlbC5nZXRWYWx1ZSAhPT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgbW9kZWwucG9zaXRpb25BdCAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdC8vIFVua25vd24gY2FsbGVyIVxuXHRcdHJldHVybiBbXTtcblx0fVxuXHRyZXR1cm4gY29tcHV0ZUNvbG9ycyhtb2RlbCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxTQUFTLE9BQU8sWUFBWTtBQVc1QixTQUFTLG9CQUFvQixlQUF5QztBQUNyRSxRQUFNLFNBQVMsQ0FBQztBQUNoQixhQUFXLGdCQUFnQixlQUFlO0FBQ3pDLFVBQU0sZUFBZSxPQUFPLFlBQVk7QUFDeEMsUUFBSSxnQkFBZ0IsaUJBQWlCLEtBQUssYUFBYSxRQUFRLE9BQU8sRUFBRSxNQUFNLElBQUk7QUFDakYsYUFBTyxLQUFLLFlBQVk7QUFBQSxJQUN6QjtBQUFBLEVBQ0Q7QUFDQSxTQUFPO0FBQ1I7QUFFQSxTQUFTLFVBQVUsR0FBVyxHQUFXLEdBQVcsR0FBbUI7QUFDdEUsU0FBTztBQUFBLElBQ04sS0FBSyxJQUFJO0FBQUEsSUFDVCxNQUFNLElBQUk7QUFBQSxJQUNWLE9BQU8sSUFBSTtBQUFBLElBQ1gsT0FBTztBQUFBLEVBQ1I7QUFDRDtBQUVBLFNBQVMsV0FBVyxPQUFxQyxPQUE2QztBQUNyRyxRQUFNLFFBQVEsTUFBTTtBQUNwQixRQUFNLFNBQVMsTUFBTSxDQUFDLEVBQUU7QUFDeEIsTUFBSSxVQUFVLFFBQVc7QUFDeEI7QUFBQSxFQUNEO0FBQ0EsUUFBTSxnQkFBZ0IsTUFBTSxXQUFXLEtBQUs7QUFDNUMsUUFBTSxRQUFnQjtBQUFBLElBQ3JCLGlCQUFpQixjQUFjO0FBQUEsSUFDL0IsYUFBYSxjQUFjO0FBQUEsSUFDM0IsZUFBZSxjQUFjO0FBQUEsSUFDN0IsV0FBVyxjQUFjLFNBQVM7QUFBQSxFQUNuQztBQUNBLFNBQU87QUFDUjtBQUVBLFNBQVMseUJBQXlCLE9BQTJCLFVBQWtCO0FBQzlFLE1BQUksQ0FBQyxPQUFPO0FBQ1g7QUFBQSxFQUNEO0FBQ0EsUUFBTSxpQkFBaUIsTUFBTSxPQUFPLElBQUksU0FBUyxRQUFRO0FBQ3pELE1BQUksQ0FBQyxnQkFBZ0I7QUFDcEI7QUFBQSxFQUNEO0FBQ0EsU0FBTztBQUFBLElBQ047QUFBQSxJQUNBLE9BQU8sVUFBVSxlQUFlLEtBQUssR0FBRyxlQUFlLEtBQUssR0FBRyxlQUFlLEtBQUssR0FBRyxlQUFlLEtBQUssQ0FBQztBQUFBLEVBQzVHO0FBQ0Q7QUFFQSxTQUFTLHlCQUF5QixPQUEyQixTQUE2QixTQUFrQjtBQUMzRyxNQUFJLENBQUMsU0FBUyxRQUFRLFdBQVcsR0FBRztBQUNuQztBQUFBLEVBQ0Q7QUFDQSxRQUFNLFFBQVEsUUFBUSxDQUFDO0FBQ3ZCLFFBQU0sZ0JBQWdCLE1BQU0sT0FBTztBQUNuQyxRQUFNLGNBQWMsb0JBQW9CLGFBQWE7QUFDckQsU0FBTztBQUFBLElBQ047QUFBQSxJQUNBLE9BQU8sVUFBVSxZQUFZLENBQUMsR0FBRyxZQUFZLENBQUMsR0FBRyxZQUFZLENBQUMsR0FBRyxVQUFVLFlBQVksQ0FBQyxJQUFJLENBQUM7QUFBQSxFQUM5RjtBQUNEO0FBRUEsU0FBUyx5QkFBeUIsT0FBMkIsU0FBNkIsU0FBa0I7QUFDM0csTUFBSSxDQUFDLFNBQVMsUUFBUSxXQUFXLEdBQUc7QUFDbkM7QUFBQSxFQUNEO0FBQ0EsUUFBTSxRQUFRLFFBQVEsQ0FBQztBQUN2QixRQUFNLGdCQUFnQixNQUFNLE9BQU87QUFDbkMsUUFBTSxjQUFjLG9CQUFvQixhQUFhO0FBQ3JELFFBQU0sa0JBQWtCLElBQUksTUFBTSxJQUFJLEtBQUssWUFBWSxDQUFDLEdBQUcsWUFBWSxDQUFDLElBQUksS0FBSyxZQUFZLENBQUMsSUFBSSxLQUFLLFVBQVUsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3BJLFNBQU87QUFBQSxJQUNOO0FBQUEsSUFDQSxPQUFPLFVBQVUsZ0JBQWdCLEtBQUssR0FBRyxnQkFBZ0IsS0FBSyxHQUFHLGdCQUFnQixLQUFLLEdBQUcsZ0JBQWdCLEtBQUssQ0FBQztBQUFBLEVBQ2hIO0FBQ0Q7QUFFQSxTQUFTLGFBQWEsT0FBOEMsT0FBbUM7QUFDdEcsTUFBSSxPQUFPLFVBQVUsVUFBVTtBQUM5QixXQUFPLENBQUMsR0FBRyxNQUFNLFNBQVMsS0FBSyxDQUFDO0FBQUEsRUFDakMsT0FBTztBQUNOLFdBQU8sTUFBTSxZQUFZLEtBQUs7QUFBQSxFQUMvQjtBQUNEO0FBRUEsU0FBUyxjQUFjLE9BQTBEO0FBQ2hGLFFBQU0sU0FBOEIsQ0FBQztBQUVyQyxRQUFNLHlCQUF5QjtBQUMvQixRQUFNLDJCQUEyQixhQUFhLE9BQU8sc0JBQXNCO0FBRzNFLE1BQUkseUJBQXlCLFNBQVMsR0FBRztBQUN4QyxlQUFXLGdCQUFnQiwwQkFBMEI7QUFDcEQsWUFBTSx1QkFBdUIsYUFBYSxPQUFPLGtCQUFnQixpQkFBaUIsTUFBUztBQUMzRixZQUFNLGNBQWMscUJBQXFCLENBQUM7QUFDMUMsWUFBTSxrQkFBa0IscUJBQXFCLENBQUM7QUFDOUMsVUFBSSxDQUFDLGlCQUFpQjtBQUNyQjtBQUFBLE1BQ0Q7QUFDQSxVQUFJO0FBQ0osVUFBSSxnQkFBZ0IsT0FBTztBQUMxQixjQUFNLGtCQUFrQjtBQUN4QiwyQkFBbUIseUJBQXlCLFdBQVcsT0FBTyxZQUFZLEdBQUcsYUFBYSxpQkFBaUIsZUFBZSxHQUFHLEtBQUs7QUFBQSxNQUNuSSxXQUFXLGdCQUFnQixRQUFRO0FBQ2xDLGNBQU0sa0JBQWtCO0FBQ3hCLDJCQUFtQix5QkFBeUIsV0FBVyxPQUFPLFlBQVksR0FBRyxhQUFhLGlCQUFpQixlQUFlLEdBQUcsSUFBSTtBQUFBLE1BQ2xJLFdBQVcsZ0JBQWdCLE9BQU87QUFDakMsY0FBTSxrQkFBa0I7QUFDeEIsMkJBQW1CLHlCQUF5QixXQUFXLE9BQU8sWUFBWSxHQUFHLGFBQWEsaUJBQWlCLGVBQWUsR0FBRyxLQUFLO0FBQUEsTUFDbkksV0FBVyxnQkFBZ0IsUUFBUTtBQUNsQyxjQUFNLGtCQUFrQjtBQUN4QiwyQkFBbUIseUJBQXlCLFdBQVcsT0FBTyxZQUFZLEdBQUcsYUFBYSxpQkFBaUIsZUFBZSxHQUFHLElBQUk7QUFBQSxNQUNsSSxXQUFXLGdCQUFnQixLQUFLO0FBQy9CLDJCQUFtQix5QkFBeUIsV0FBVyxPQUFPLFlBQVksR0FBRyxjQUFjLGVBQWU7QUFBQSxNQUMzRztBQUNBLFVBQUksa0JBQWtCO0FBQ3JCLGVBQU8sS0FBSyxnQkFBZ0I7QUFBQSxNQUM3QjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0EsU0FBTztBQUNSO0FBS08sU0FBUyw2QkFBNkIsT0FBMEQ7QUFDdEcsTUFBSSxDQUFDLFNBQVMsT0FBTyxNQUFNLGFBQWEsY0FBYyxPQUFPLE1BQU0sZUFBZSxZQUFZO0FBRTdGLFdBQU8sQ0FBQztBQUFBLEVBQ1Q7QUFDQSxTQUFPLGNBQWMsS0FBSztBQUMzQjsiLAogICJuYW1lcyI6IFtdCn0K
