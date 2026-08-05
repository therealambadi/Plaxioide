import { Color, RGBA } from "../../../../base/common/color.js";
import { isDefined } from "../../../../base/common/types.js";
import { editorHoverBackground, listActiveSelectionBackground, listFocusBackground, listInactiveFocusBackground, listInactiveSelectionBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { PANEL_BACKGROUND, SIDE_BAR_BACKGROUND } from "../../../common/theme.js";
import { ansiColorIdentifiers } from "../../terminal/common/terminalColorRegistry.js";
function handleANSIOutput(text, linkDetector, workspaceFolder, highlights) {
  const root = document.createElement("span");
  const textLength = text.length;
  let styleNames = [];
  let customFgColor;
  let customBgColor;
  let customUnderlineColor;
  let colorsInverted = false;
  let currentPos = 0;
  let unprintedChars = 0;
  let buffer = "";
  while (currentPos < textLength) {
    let sequenceFound = false;
    if (text.charCodeAt(currentPos) === 27 && text.charAt(currentPos + 1) === "[") {
      const startPos = currentPos;
      currentPos += 2;
      let ansiSequence = "";
      while (currentPos < textLength) {
        const char = text.charAt(currentPos);
        ansiSequence += char;
        currentPos++;
        if (char.match(/^[ABCDHIJKfhmpsu]$/)) {
          sequenceFound = true;
          break;
        }
      }
      if (sequenceFound) {
        unprintedChars += 2 + ansiSequence.length;
        appendStylizedStringToContainer(root, buffer, styleNames, linkDetector, workspaceFolder, customFgColor, customBgColor, customUnderlineColor, highlights, currentPos - buffer.length - unprintedChars);
        buffer = "";
        if (ansiSequence.match(/^(?:[34][0-8]|9[0-7]|10[0-7]|[0-9]|2[1-5,7-9]|[34]9|5[8,9]|1[0-9])(?:;[349][0-7]|10[0-7]|[013]|[245]|[34]9)?(?:;[012]?[0-9]?[0-9])*;?m$/)) {
          const styleCodes = ansiSequence.slice(0, -1).split(";").filter((elem) => elem !== "").map((elem) => parseInt(elem, 10));
          if (styleCodes[0] === 38 || styleCodes[0] === 48 || styleCodes[0] === 58) {
            const colorType = styleCodes[0] === 38 ? "foreground" : styleCodes[0] === 48 ? "background" : "underline";
            if (styleCodes[1] === 5) {
              set8BitColor(styleCodes, colorType);
            } else if (styleCodes[1] === 2) {
              set24BitColor(styleCodes, colorType);
            }
          } else {
            setBasicFormatters(styleCodes);
          }
        } else {
        }
      } else {
        currentPos = startPos;
      }
    }
    if (sequenceFound === false) {
      buffer += text.charAt(currentPos);
      currentPos++;
    }
  }
  if (buffer) {
    appendStylizedStringToContainer(root, buffer, styleNames, linkDetector, workspaceFolder, customFgColor, customBgColor, customUnderlineColor, highlights, currentPos - buffer.length);
  }
  return root;
  function changeColor(colorType, color) {
    if (colorType === "foreground") {
      customFgColor = color;
    } else if (colorType === "background") {
      customBgColor = color;
    } else if (colorType === "underline") {
      customUnderlineColor = color;
    }
    styleNames = styleNames.filter((style) => style !== `code-${colorType}-colored`);
    if (color !== void 0) {
      styleNames.push(`code-${colorType}-colored`);
    }
  }
  function reverseForegroundAndBackgroundColors() {
    const oldFgColor = customFgColor;
    changeColor("foreground", customBgColor);
    changeColor("background", oldFgColor);
  }
  function setBasicFormatters(styleCodes) {
    for (const code of styleCodes) {
      switch (code) {
        case 0: {
          styleNames = [];
          customFgColor = void 0;
          customBgColor = void 0;
          break;
        }
        case 1: {
          styleNames = styleNames.filter((style) => style !== `code-bold`);
          styleNames.push("code-bold");
          break;
        }
        case 2: {
          styleNames = styleNames.filter((style) => style !== `code-dim`);
          styleNames.push("code-dim");
          break;
        }
        case 3: {
          styleNames = styleNames.filter((style) => style !== `code-italic`);
          styleNames.push("code-italic");
          break;
        }
        case 4: {
          styleNames = styleNames.filter((style) => style !== `code-underline` && style !== `code-double-underline`);
          styleNames.push("code-underline");
          break;
        }
        case 5: {
          styleNames = styleNames.filter((style) => style !== `code-blink`);
          styleNames.push("code-blink");
          break;
        }
        case 6: {
          styleNames = styleNames.filter((style) => style !== `code-rapid-blink`);
          styleNames.push("code-rapid-blink");
          break;
        }
        case 7: {
          if (!colorsInverted) {
            colorsInverted = true;
            reverseForegroundAndBackgroundColors();
          }
          break;
        }
        case 8: {
          styleNames = styleNames.filter((style) => style !== `code-hidden`);
          styleNames.push("code-hidden");
          break;
        }
        case 9: {
          styleNames = styleNames.filter((style) => style !== `code-strike-through`);
          styleNames.push("code-strike-through");
          break;
        }
        case 10: {
          styleNames = styleNames.filter((style) => !style.startsWith("code-font"));
          break;
        }
        case 11:
        case 12:
        case 13:
        case 14:
        case 15:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20: {
          styleNames = styleNames.filter((style) => !style.startsWith("code-font"));
          styleNames.push(`code-font-${code - 10}`);
          break;
        }
        case 21: {
          styleNames = styleNames.filter((style) => style !== `code-underline` && style !== `code-double-underline`);
          styleNames.push("code-double-underline");
          break;
        }
        case 22: {
          styleNames = styleNames.filter((style) => style !== `code-bold` && style !== `code-dim`);
          break;
        }
        case 23: {
          styleNames = styleNames.filter((style) => style !== `code-italic` && style !== `code-font-10`);
          break;
        }
        case 24: {
          styleNames = styleNames.filter((style) => style !== `code-underline` && style !== `code-double-underline`);
          break;
        }
        case 25: {
          styleNames = styleNames.filter((style) => style !== `code-blink` && style !== `code-rapid-blink`);
          break;
        }
        case 27: {
          if (colorsInverted) {
            colorsInverted = false;
            reverseForegroundAndBackgroundColors();
          }
          break;
        }
        case 28: {
          styleNames = styleNames.filter((style) => style !== `code-hidden`);
          break;
        }
        case 29: {
          styleNames = styleNames.filter((style) => style !== `code-strike-through`);
          break;
        }
        case 53: {
          styleNames = styleNames.filter((style) => style !== `code-overline`);
          styleNames.push("code-overline");
          break;
        }
        case 55: {
          styleNames = styleNames.filter((style) => style !== `code-overline`);
          break;
        }
        case 39: {
          changeColor("foreground", void 0);
          break;
        }
        case 49: {
          changeColor("background", void 0);
          break;
        }
        case 59: {
          changeColor("underline", void 0);
          break;
        }
        case 73: {
          styleNames = styleNames.filter((style) => style !== `code-superscript` && style !== `code-subscript`);
          styleNames.push("code-superscript");
          break;
        }
        case 74: {
          styleNames = styleNames.filter((style) => style !== `code-superscript` && style !== `code-subscript`);
          styleNames.push("code-subscript");
          break;
        }
        case 75: {
          styleNames = styleNames.filter((style) => style !== `code-superscript` && style !== `code-subscript`);
          break;
        }
        default: {
          setBasicColor(code);
          break;
        }
      }
    }
  }
  function set24BitColor(styleCodes, colorType) {
    if (styleCodes.length >= 5 && styleCodes[2] >= 0 && styleCodes[2] <= 255 && styleCodes[3] >= 0 && styleCodes[3] <= 255 && styleCodes[4] >= 0 && styleCodes[4] <= 255) {
      const customColor = new RGBA(styleCodes[2], styleCodes[3], styleCodes[4]);
      changeColor(colorType, customColor);
    }
  }
  function set8BitColor(styleCodes, colorType) {
    let colorNumber = styleCodes[2];
    const color = calcANSI8bitColor(colorNumber);
    if (color) {
      changeColor(colorType, color);
    } else if (colorNumber >= 0 && colorNumber <= 15) {
      if (colorType === "underline") {
        const colorName = ansiColorIdentifiers[colorNumber];
        changeColor(colorType, `--vscode-debug-ansi-${colorName}`);
        return;
      }
      colorNumber += 30;
      if (colorNumber >= 38) {
        colorNumber += 52;
      }
      if (colorType === "background") {
        colorNumber += 10;
      }
      setBasicColor(colorNumber);
    }
  }
  function setBasicColor(styleCode) {
    let colorType;
    let colorIndex;
    if (styleCode >= 30 && styleCode <= 37) {
      colorIndex = styleCode - 30;
      colorType = "foreground";
    } else if (styleCode >= 90 && styleCode <= 97) {
      colorIndex = styleCode - 90 + 8;
      colorType = "foreground";
    } else if (styleCode >= 40 && styleCode <= 47) {
      colorIndex = styleCode - 40;
      colorType = "background";
    } else if (styleCode >= 100 && styleCode <= 107) {
      colorIndex = styleCode - 100 + 8;
      colorType = "background";
    }
    if (colorIndex !== void 0 && colorType) {
      const colorName = ansiColorIdentifiers[colorIndex];
      changeColor(colorType, `--vscode-debug-ansi-${colorName.replaceAll(".", "-")}`);
    }
  }
}
function appendStylizedStringToContainer(root, stringContent, cssClasses, linkDetector, workspaceFolder, customTextColor, customBackgroundColor, customUnderlineColor, highlights, offset) {
  if (!root || !stringContent) {
    return;
  }
  const container = linkDetector.linkify(
    stringContent,
    true,
    workspaceFolder,
    void 0,
    void 0,
    highlights?.map((h) => ({ start: h.start - offset, end: h.end - offset, extraClasses: h.extraClasses }))
  );
  container.className = cssClasses.join(" ");
  if (customTextColor) {
    container.style.color = typeof customTextColor === "string" ? `var(${customTextColor})` : Color.Format.CSS.formatRGB(new Color(customTextColor));
  }
  if (customBackgroundColor) {
    container.style.backgroundColor = typeof customBackgroundColor === "string" ? `var(${customBackgroundColor})` : Color.Format.CSS.formatRGB(new Color(customBackgroundColor));
  }
  if (customUnderlineColor) {
    container.style.textDecorationColor = typeof customUnderlineColor === "string" ? `var(${customUnderlineColor})` : Color.Format.CSS.formatRGB(new Color(customUnderlineColor));
  }
  root.appendChild(container);
}
function calcANSI8bitColor(colorNumber) {
  if (colorNumber % 1 !== 0) {
    return;
  }
  if (colorNumber >= 16 && colorNumber <= 231) {
    colorNumber -= 16;
    let blue = colorNumber % 6;
    colorNumber = (colorNumber - blue) / 6;
    let green = colorNumber % 6;
    colorNumber = (colorNumber - green) / 6;
    let red = colorNumber;
    const convFactor = 255 / 5;
    blue = Math.round(blue * convFactor);
    green = Math.round(green * convFactor);
    red = Math.round(red * convFactor);
    return new RGBA(red, green, blue);
  } else if (colorNumber >= 232 && colorNumber <= 255) {
    colorNumber -= 232;
    const colorLevel = Math.round(colorNumber / 23 * 255);
    return new RGBA(colorLevel, colorLevel, colorLevel);
  } else {
    return;
  }
}
registerThemingParticipant((theme, collector) => {
  const areas = [
    { selector: ".monaco-workbench .sidebar, .monaco-workbench .auxiliarybar", bg: theme.getColor(SIDE_BAR_BACKGROUND) },
    { selector: ".monaco-workbench .panel", bg: theme.getColor(PANEL_BACKGROUND) },
    { selector: ".monaco-workbench .monaco-list-row.selected", bg: theme.getColor(listInactiveSelectionBackground) },
    { selector: ".monaco-workbench .monaco-list-row.focused", bg: theme.getColor(listInactiveFocusBackground) },
    { selector: ".monaco-workbench .monaco-list:focus .monaco-list-row.focused", bg: theme.getColor(listFocusBackground) },
    { selector: ".monaco-workbench .monaco-list:focus .monaco-list-row.selected", bg: theme.getColor(listActiveSelectionBackground) },
    { selector: ".debug-hover-widget", bg: theme.getColor(editorHoverBackground) }
  ];
  for (const { selector, bg } of areas) {
    const content = ansiColorIdentifiers.map((color) => {
      const actual = theme.getColor(color);
      if (!actual) {
        return void 0;
      }
      return `--vscode-debug-ansi-${color.replaceAll(".", "-")}:${bg ? bg.ensureConstrast(actual, 4) : actual}`;
    }).filter(isDefined);
    collector.addRule(`${selector} { ${content.join(";")} }`);
  }
});
export {
  appendStylizedStringToContainer,
  calcANSI8bitColor,
  handleANSIOutput
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnQU5TSUhhbmRsaW5nLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSUhpZ2hsaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9oaWdobGlnaHRlZGxhYmVsL2hpZ2hsaWdodGVkTGFiZWwuanMnO1xuaW1wb3J0IHsgQ29sb3IsIFJHQkEgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBpc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBlZGl0b3JIb3ZlckJhY2tncm91bmQsIGxpc3RBY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kLCBsaXN0Rm9jdXNCYWNrZ3JvdW5kLCBsaXN0SW5hY3RpdmVGb2N1c0JhY2tncm91bmQsIGxpc3RJbmFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyByZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUZvbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFBBTkVMX0JBQ0tHUk9VTkQsIFNJREVfQkFSX0JBQ0tHUk9VTkQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgYW5zaUNvbG9ySWRlbnRpZmllcnMgfSBmcm9tICcuLi8uLi90ZXJtaW5hbC9jb21tb24vdGVybWluYWxDb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMaW5rRGV0ZWN0b3IgfSBmcm9tICcuL2xpbmtEZXRlY3Rvci5qcyc7XG5cbi8qKlxuICogQHBhcmFtIHRleHQgVGhlIGNvbnRlbnQgdG8gc3R5bGl6ZS5cbiAqIEByZXR1cm5zIEFuIHtAbGluayBIVE1MU3BhbkVsZW1lbnR9IHRoYXQgY29udGFpbnMgdGhlIHBvdGVudGlhbGx5IHN0eWxpemVkIHRleHQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYW5kbGVBTlNJT3V0cHV0KHRleHQ6IHN0cmluZywgbGlua0RldGVjdG9yOiBJTGlua0RldGVjdG9yLCB3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQsIGhpZ2hsaWdodHM6IElIaWdobGlnaHRbXSB8IHVuZGVmaW5lZCk6IEhUTUxTcGFuRWxlbWVudCB7XG5cblx0Y29uc3Qgcm9vdDogSFRNTFNwYW5FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRjb25zdCB0ZXh0TGVuZ3RoOiBudW1iZXIgPSB0ZXh0Lmxlbmd0aDtcblxuXHRsZXQgc3R5bGVOYW1lczogc3RyaW5nW10gPSBbXTtcblx0bGV0IGN1c3RvbUZnQ29sb3I6IFJHQkEgfCBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGxldCBjdXN0b21CZ0NvbG9yOiBSR0JBIHwgc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsZXQgY3VzdG9tVW5kZXJsaW5lQ29sb3I6IFJHQkEgfCBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGxldCBjb2xvcnNJbnZlcnRlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRsZXQgY3VycmVudFBvczogbnVtYmVyID0gMDtcblx0bGV0IHVucHJpbnRlZENoYXJzID0gMDtcblx0bGV0IGJ1ZmZlcjogc3RyaW5nID0gJyc7XG5cblx0d2hpbGUgKGN1cnJlbnRQb3MgPCB0ZXh0TGVuZ3RoKSB7XG5cblx0XHRsZXQgc2VxdWVuY2VGb3VuZDogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdFx0Ly8gUG90ZW50aWFsbHkgYW4gQU5TSSBlc2NhcGUgc2VxdWVuY2UuXG5cdFx0Ly8gU2VlIGh0dHA6Ly9hc2NpaS10YWJsZS5jb20vYW5zaS1lc2NhcGUtc2VxdWVuY2VzLnBocCAmIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FOU0lfZXNjYXBlX2NvZGVcblx0XHRpZiAodGV4dC5jaGFyQ29kZUF0KGN1cnJlbnRQb3MpID09PSAyNyAmJiB0ZXh0LmNoYXJBdChjdXJyZW50UG9zICsgMSkgPT09ICdbJykge1xuXG5cdFx0XHRjb25zdCBzdGFydFBvczogbnVtYmVyID0gY3VycmVudFBvcztcblx0XHRcdGN1cnJlbnRQb3MgKz0gMjsgLy8gSWdub3JlICdFc2NbJyBhcyBpdCdzIGluIGV2ZXJ5IHNlcXVlbmNlLlxuXG5cdFx0XHRsZXQgYW5zaVNlcXVlbmNlOiBzdHJpbmcgPSAnJztcblxuXHRcdFx0d2hpbGUgKGN1cnJlbnRQb3MgPCB0ZXh0TGVuZ3RoKSB7XG5cdFx0XHRcdGNvbnN0IGNoYXI6IHN0cmluZyA9IHRleHQuY2hhckF0KGN1cnJlbnRQb3MpO1xuXHRcdFx0XHRhbnNpU2VxdWVuY2UgKz0gY2hhcjtcblxuXHRcdFx0XHRjdXJyZW50UG9zKys7XG5cblx0XHRcdFx0Ly8gTG9vayBmb3IgYSBrbm93biBzZXF1ZW5jZSB0ZXJtaW5hdGluZyBjaGFyYWN0ZXIuXG5cdFx0XHRcdGlmIChjaGFyLm1hdGNoKC9eW0FCQ0RISUpLZmhtcHN1XSQvKSkge1xuXHRcdFx0XHRcdHNlcXVlbmNlRm91bmQgPSB0cnVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdH1cblxuXHRcdFx0aWYgKHNlcXVlbmNlRm91bmQpIHtcblxuXHRcdFx0XHR1bnByaW50ZWRDaGFycyArPSAyICsgYW5zaVNlcXVlbmNlLmxlbmd0aDtcblxuXHRcdFx0XHQvLyBGbHVzaCBidWZmZXIgd2l0aCBwcmV2aW91cyBzdHlsZXMuXG5cdFx0XHRcdGFwcGVuZFN0eWxpemVkU3RyaW5nVG9Db250YWluZXIocm9vdCwgYnVmZmVyLCBzdHlsZU5hbWVzLCBsaW5rRGV0ZWN0b3IsIHdvcmtzcGFjZUZvbGRlciwgY3VzdG9tRmdDb2xvciwgY3VzdG9tQmdDb2xvciwgY3VzdG9tVW5kZXJsaW5lQ29sb3IsIGhpZ2hsaWdodHMsIGN1cnJlbnRQb3MgLSBidWZmZXIubGVuZ3RoIC0gdW5wcmludGVkQ2hhcnMpO1xuXG5cdFx0XHRcdGJ1ZmZlciA9ICcnO1xuXG5cdFx0XHRcdC8qXG5cdFx0XHRcdCAqIENlcnRhaW4gcmFuZ2VzIHRoYXQgYXJlIG1hdGNoZWQgaGVyZSBkbyBub3QgY29udGFpbiByZWFsIGdyYXBoaWNzIHJlbmRpdGlvbiBzZXF1ZW5jZXMuIEZvclxuXHRcdFx0XHQgKiB0aGUgc2FrZSBvZiBoYXZpbmcgYSBzaW1wbGVyIGV4cHJlc3Npb24sIHRoZXkgaGF2ZSBiZWVuIGluY2x1ZGVkIGFueXdheS5cblx0XHRcdFx0ICovXG5cdFx0XHRcdGlmIChhbnNpU2VxdWVuY2UubWF0Y2goL14oPzpbMzRdWzAtOF18OVswLTddfDEwWzAtN118WzAtOV18MlsxLTUsNy05XXxbMzRdOXw1WzgsOV18MVswLTldKSg/OjtbMzQ5XVswLTddfDEwWzAtN118WzAxM118WzI0NV18WzM0XTkpPyg/OjtbMDEyXT9bMC05XT9bMC05XSkqOz9tJC8pKSB7XG5cblx0XHRcdFx0XHRjb25zdCBzdHlsZUNvZGVzOiBudW1iZXJbXSA9IGFuc2lTZXF1ZW5jZS5zbGljZSgwLCAtMSkgLy8gUmVtb3ZlIGZpbmFsICdtJyBjaGFyYWN0ZXIuXG5cdFx0XHRcdFx0XHQuc3BsaXQoJzsnKVx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgLy8gU2VwYXJhdGUgc3R5bGUgY29kZXMuXG5cdFx0XHRcdFx0XHQuZmlsdGVyKGVsZW0gPT4gZWxlbSAhPT0gJycpXHRcdFx0ICAgICAgICAgICAvLyBGaWx0ZXIgZW1wdHkgZWxlbXMgYXMgJzM0O20nIC0+IFsnMzQnLCAnJ10uXG5cdFx0XHRcdFx0XHQubWFwKGVsZW0gPT4gcGFyc2VJbnQoZWxlbSwgMTApKTtcdFx0ICAgICAgICAgICAvLyBDb252ZXJ0IHRvIG51bWJlcnMuXG5cblx0XHRcdFx0XHRpZiAoc3R5bGVDb2Rlc1swXSA9PT0gMzggfHwgc3R5bGVDb2Rlc1swXSA9PT0gNDggfHwgc3R5bGVDb2Rlc1swXSA9PT0gNTgpIHtcblx0XHRcdFx0XHRcdC8vIEFkdmFuY2VkIGNvbG9yIGNvZGUgLSBjYW4ndCBiZSBjb21iaW5lZCB3aXRoIGZvcm1hdHRpbmcgY29kZXMgbGlrZSBzaW1wbGUgY29sb3JzIGNhblxuXHRcdFx0XHRcdFx0Ly8gSWdub3JlcyBpbnZhbGlkIGNvbG9ycyBhbmQgYWRkaXRpb25hbCBpbmZvIGJleW9uZCB3aGF0IGlzIG5lY2Vzc2FyeVxuXHRcdFx0XHRcdFx0Y29uc3QgY29sb3JUeXBlID0gKHN0eWxlQ29kZXNbMF0gPT09IDM4KSA/ICdmb3JlZ3JvdW5kJyA6ICgoc3R5bGVDb2Rlc1swXSA9PT0gNDgpID8gJ2JhY2tncm91bmQnIDogJ3VuZGVybGluZScpO1xuXG5cdFx0XHRcdFx0XHRpZiAoc3R5bGVDb2Rlc1sxXSA9PT0gNSkge1xuXHRcdFx0XHRcdFx0XHRzZXQ4Qml0Q29sb3Ioc3R5bGVDb2RlcywgY29sb3JUeXBlKTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoc3R5bGVDb2Rlc1sxXSA9PT0gMikge1xuXHRcdFx0XHRcdFx0XHRzZXQyNEJpdENvbG9yKHN0eWxlQ29kZXMsIGNvbG9yVHlwZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHNldEJhc2ljRm9ybWF0dGVycyhzdHlsZUNvZGVzKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBVbnN1cHBvcnRlZCBzZXF1ZW5jZSBzbyBzaW1wbHkgaGlkZSBpdC5cblx0XHRcdFx0fVxuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjdXJyZW50UG9zID0gc3RhcnRQb3M7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHNlcXVlbmNlRm91bmQgPT09IGZhbHNlKSB7XG5cdFx0XHRidWZmZXIgKz0gdGV4dC5jaGFyQXQoY3VycmVudFBvcyk7XG5cdFx0XHRjdXJyZW50UG9zKys7XG5cdFx0fVxuXHR9XG5cblx0Ly8gRmx1c2ggcmVtYWluaW5nIHRleHQgYnVmZmVyIGlmIG5vdCBlbXB0eS5cblx0aWYgKGJ1ZmZlcikge1xuXHRcdGFwcGVuZFN0eWxpemVkU3RyaW5nVG9Db250YWluZXIocm9vdCwgYnVmZmVyLCBzdHlsZU5hbWVzLCBsaW5rRGV0ZWN0b3IsIHdvcmtzcGFjZUZvbGRlciwgY3VzdG9tRmdDb2xvciwgY3VzdG9tQmdDb2xvciwgY3VzdG9tVW5kZXJsaW5lQ29sb3IsIGhpZ2hsaWdodHMsIGN1cnJlbnRQb3MgLSBidWZmZXIubGVuZ3RoKTtcblx0fVxuXG5cdHJldHVybiByb290O1xuXG5cdC8qKlxuXHQgKiBDaGFuZ2UgdGhlIGZvcmVncm91bmQgb3IgYmFja2dyb3VuZCBjb2xvciBieSBjbGVhcmluZyB0aGUgY3VycmVudCBjb2xvclxuXHQgKiBhbmQgYWRkaW5nIHRoZSBuZXcgb25lLlxuXHQgKiBAcGFyYW0gY29sb3JUeXBlIElmIGAnZm9yZWdyb3VuZCdgLCB3aWxsIGNoYW5nZSB0aGUgZm9yZWdyb3VuZCBjb2xvciwgaWZcblx0ICogXHRgJ2JhY2tncm91bmQnYCwgd2lsbCBjaGFuZ2UgdGhlIGJhY2tncm91bmQgY29sb3IsIGFuZCBpZiBgJ3VuZGVybGluZSdgXG5cdCAqIHdpbGwgc2V0IHRoZSB1bmRlcmxpbmUgY29sb3IuXG5cdCAqIEBwYXJhbSBjb2xvciBDb2xvciB0byBjaGFuZ2UgdG8uIElmIGB1bmRlZmluZWRgIG9yIG5vdCBwcm92aWRlZCxcblx0ICogd2lsbCBjbGVhciBjdXJyZW50IGNvbG9yIHdpdGhvdXQgYWRkaW5nIGEgbmV3IG9uZS5cblx0ICovXG5cdGZ1bmN0aW9uIGNoYW5nZUNvbG9yKGNvbG9yVHlwZTogJ2ZvcmVncm91bmQnIHwgJ2JhY2tncm91bmQnIHwgJ3VuZGVybGluZScsIGNvbG9yPzogUkdCQSB8IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmIChjb2xvclR5cGUgPT09ICdmb3JlZ3JvdW5kJykge1xuXHRcdFx0Y3VzdG9tRmdDb2xvciA9IGNvbG9yO1xuXHRcdH0gZWxzZSBpZiAoY29sb3JUeXBlID09PSAnYmFja2dyb3VuZCcpIHtcblx0XHRcdGN1c3RvbUJnQ29sb3IgPSBjb2xvcjtcblx0XHR9IGVsc2UgaWYgKGNvbG9yVHlwZSA9PT0gJ3VuZGVybGluZScpIHtcblx0XHRcdGN1c3RvbVVuZGVybGluZUNvbG9yID0gY29sb3I7XG5cdFx0fVxuXHRcdHN0eWxlTmFtZXMgPSBzdHlsZU5hbWVzLmZpbHRlcihzdHlsZSA9PiBzdHlsZSAhPT0gYGNvZGUtJHtjb2xvclR5cGV9LWNvbG9yZWRgKTtcblx0XHRpZiAoY29sb3IgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0c3R5bGVOYW1lcy5wdXNoKGBjb2RlLSR7Y29sb3JUeXBlfS1jb2xvcmVkYCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFN3YXAgZm9yZWdyb3VuZCBhbmQgYmFja2dyb3VuZCBjb2xvcnMuICBVc2VkIGZvciBjb2xvciBpbnZlcnNpb24uICBDYWxsZXIgc2hvdWxkIGNoZWNrXG5cdCAqIFtdIGZsYWcgdG8gbWFrZSBzdXJlIGl0IGlzIGFwcHJvcHJpYXRlIHRvIHR1cm4gT04gb3IgT0ZGIChpZiBpdCBpcyBhbHJlYWR5IGludmVydGVkIGRvbid0IGNhbGxcblx0ICovXG5cdGZ1bmN0aW9uIHJldmVyc2VGb3JlZ3JvdW5kQW5kQmFja2dyb3VuZENvbG9ycygpOiB2b2lkIHtcblx0XHRjb25zdCBvbGRGZ0NvbG9yID0gY3VzdG9tRmdDb2xvcjtcblx0XHRjaGFuZ2VDb2xvcignZm9yZWdyb3VuZCcsIGN1c3RvbUJnQ29sb3IpO1xuXHRcdGNoYW5nZUNvbG9yKCdiYWNrZ3JvdW5kJywgb2xkRmdDb2xvcik7XG5cdH1cblxuXHQvKipcblx0ICogQ2FsY3VsYXRlIGFuZCBzZXQgYmFzaWMgQU5TSSBmb3JtYXR0aW5nLiBTdXBwb3J0cyBPTi9PRkYgb2YgYm9sZCwgaXRhbGljLCB1bmRlcmxpbmUsXG5cdCAqIGRvdWJsZSB1bmRlcmxpbmUsICBjcm9zc2VkLW91dC9zdHJpa2V0aHJvdWdoLCBvdmVybGluZSwgZGltLCBibGluaywgcmFwaWQgYmxpbmssXG5cdCAqIHJldmVyc2UvaW52ZXJ0IHZpZGVvLCBoaWRkZW4sIHN1cGVyc2NyaXB0LCBzdWJzY3JpcHQgYW5kIGFsdGVybmF0ZSBmb250IGNvZGVzLFxuXHQgKiBjbGVhcmluZy9yZXNldHRpbmcgb2YgZm9yZWdyb3VuZCwgYmFja2dyb3VuZCBhbmQgdW5kZXJsaW5lIGNvbG9ycyxcblx0ICogc2V0dGluZyBub3JtYWwgZm9yZWdyb3VuZCBhbmQgYmFja2dyb3VuZCBjb2xvcnMsIGFuZCBicmlnaHQgZm9yZWdyb3VuZCBhbmRcblx0ICogYmFja2dyb3VuZCBjb2xvcnMuIE5vdCB0byBiZSB1c2VkIGZvciBjb2RlcyBjb250YWluaW5nIGFkdmFuY2VkIGNvbG9ycy5cblx0ICogV2lsbCBpZ25vcmUgaW52YWxpZCBjb2Rlcy5cblx0ICogQHBhcmFtIHN0eWxlQ29kZXMgQXJyYXkgb2YgQU5TSSBiYXNpYyBzdHlsaW5nIG51bWJlcnMsIHdoaWNoIHdpbGwgYmVcblx0ICogYXBwbGllZCBpbiBvcmRlci4gTmV3IGNvbG9ycyBhbmQgYmFja2dyb3VuZHMgY2xlYXIgb2xkIG9uZXM7IG5ldyBmb3JtYXR0aW5nXG5cdCAqIGRvZXMgbm90LlxuXHQgKiBAc2VlIHtAbGluayBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9BTlNJX2VzY2FwZV9jb2RlI1NHUiB9XG5cdCAqL1xuXHRmdW5jdGlvbiBzZXRCYXNpY0Zvcm1hdHRlcnMoc3R5bGVDb2RlczogbnVtYmVyW10pOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGNvZGUgb2Ygc3R5bGVDb2Rlcykge1xuXHRcdFx0c3dpdGNoIChjb2RlKSB7XG5cdFx0XHRcdGNhc2UgMDogeyAgLy8gcmVzZXQgKGV2ZXJ5dGhpbmcpXG5cdFx0XHRcdFx0c3R5bGVOYW1lcyA9IFtdO1xuXHRcdFx0XHRcdGN1c3RvbUZnQ29sb3IgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0Y3VzdG9tQmdDb2xvciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDE6IHsgLy8gYm9sZFxuXHRcdFx0XHRcdHN0eWxlTmFtZXMgPSBzdHlsZU5hbWVzLmZpbHRlcihzdHlsZSA9PiBzdHlsZSAhPT0gYGNvZGUtYm9sZGApO1xuXHRcdFx0XHRcdHN0eWxlTmFtZXMucHVzaCgnY29kZS1ib2xkJyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSAyOiB7IC8vIGRpbVxuXHRcdFx0XHRcdHN0eWxlTmFtZXMgPSBzdHlsZU5hbWVzLmZpbHRlcihzdHlsZSA9PiBzdHlsZSAhPT0gYGNvZGUtZGltYCk7XG5cdFx0XHRcdFx0c3R5bGVOYW1lcy5wdXNoKCdjb2RlLWRpbScpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgMzogeyAvLyBpdGFsaWNcblx0XHRcdFx0XHRzdHlsZU5hbWVzID0gc3R5bGVOYW1lcy5maWx0ZXIoc3R5bGUgPT4gc3R5bGUgIT09IGBjb2RlLWl0YWxpY2ApO1xuXHRcdFx0XHRcdHN0eWxlTmFtZXMucHVzaCgnY29kZS1pdGFsaWMnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDQ6IHsgLy8gdW5kZXJsaW5lXG5cdFx0XHRcdFx0c3R5bGVOYW1lcyA9IHN0eWxlTmFtZXMuZmlsdGVyKHN0eWxlID0+IChzdHlsZSAhPT0gYGNvZGUtdW5kZXJsaW5lYCAmJiBzdHlsZSAhPT0gYGNvZGUtZG91YmxlLXVuZGVybGluZWApKTtcblx0XHRcdFx0XHRzdHlsZU5hbWVzLnB1c2goJ2NvZGUtdW5kZXJsaW5lJyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSA1OiB7IC8vIGJsaW5rXG5cdFx0XHRcdFx0c3R5bGVOYW1lcyA9IHN0eWxlTmFtZXMuZmlsdGVyKHN0eWxlID0+IHN0eWxlICE9PSBgY29kZS1ibGlua2ApO1xuXHRcdFx0XHRcdHN0eWxlTmFtZXMucHVzaCgnY29kZS1ibGluaycpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgNjogeyAvLyByYXBpZCBibGlua1xuXHRcdFx0XHRcdHN0eWxlTmFtZXMgPSBzdHlsZU5hbWVzLmZpbHRlcihzdHlsZSA9PiBzdHlsZSAhPT0gYGNvZGUtcmFwaWQtYmxpbmtgKTtcblx0XHRcdFx0XHRzdHlsZU5hbWVzLnB1c2goJ2NvZGUtcmFwaWQtYmxpbmsnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDc6IHsgLy8gaW52ZXJ0IGZvcmVncm91bmQgYW5kIGJhY2tncm91bmRcblx0XHRcdFx0XHRpZiAoIWNvbG9yc0ludmVydGVkKSB7XG5cdFx0XHRcdFx0XHRjb2xvcnNJbnZlcnRlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRyZXZlcnNlRm9yZWdyb3VuZEFuZEJhY2tncm91bmRDb2xvcnMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSA4OiB7IC8vIGhpZGRlblxuXHRcdFx0XHRcdHN0eWxlTmFtZXMgPSBzdHlsZU5hbWVzLmZpbHRlcihzdHlsZSA9PiBzdHlsZSAhPT0gYGNvZGUtaGlkZGVuYCk7XG5cdFx0XHRcdFx0c3R5bGVOYW1lcy5wdXNoKCdjb2RlLWhpZGRlbicpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgOTogeyAvLyBzdHJpa2UtdGhyb3VnaC9jcm9zc2VkLW91dFxuXHRcdFx0XHRcdHN0eWxlTmFtZXMgPSBzdHlsZU5hbWVzLmZpbHRlcihzdHlsZSA9PiBzdHlsZSAhPT0gYGNvZGUtc3RyaWtlLXRocm91Z2hgKTtcblx0XHRcdFx0XHRzdHlsZU5hbWVzLnB1c2goJ2NvZGUtc3RyaWtlLXRocm91Z2gnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDEwOiB7IC8vIG5vcm1hbCBkZWZhdWx0IGZvbnRcblx0XHRcdFx0XHRzdHlsZU5hbWVzID0gc3R5bGVOYW1lcy5maWx0ZXIoc3R5bGUgPT4gIXN0eWxlLnN0YXJ0c1dpdGgoJ2NvZGUtZm9udCcpKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDExOiBjYXNlIDEyOiBjYXNlIDEzOiBjYXNlIDE0OiBjYXNlIDE1OiBjYXNlIDE2OiBjYXNlIDE3OiBjYXNlIDE4OiBjYXNlIDE5OiBjYXNlIDIwOiB7IC8vIGZvbnQgY29kZXMgKGFuZCAyMCBpcyAnYmxhY2tsZXR0ZXInIGZvbnQgY29kZSlcblx0XHRcdFx0XHRzdHlsZU5hbWVzID0gc3R5bGVOYW1lcy5maWx0ZXIoc3R5bGUgPT4gIXN0eWxlLnN0YXJ0c1dpdGgoJ2NvZGUtZm9udCcpKTtcblx0XHRcdFx0XHRzdHlsZU5hbWVzLnB1c2goYGNvZGUtZm9udC0ke2NvZGUgLSAxMH1gKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDIxOiB7IC8vIGRvdWJsZSB1bmRlcmxpbmVcblx0XHRcdFx0XHRzdHlsZU5hbWVzID0gc3R5bGVOYW1lcy5maWx0ZXIoc3R5bGUgPT4gKHN0eWxlICE9PSBgY29kZS11bmRlcmxpbmVgICYmIHN0eWxlICE9PSBgY29kZS1kb3VibGUtdW5kZXJsaW5lYCkpO1xuXHRcdFx0XHRcdHN0eWxlTmFtZXMucHVzaCgnY29kZS1kb3VibGUtdW5kZXJsaW5lJyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSAyMjogeyAvLyBub3JtYWwgaW50ZW5zaXR5IChib2xkIG9mZiBhbmQgZGltIG9mZilcblx0XHRcdFx0XHRzdHlsZU5hbWVzID0gc3R5bGVOYW1lcy5maWx0ZXIoc3R5bGUgPT4gKHN0eWxlICE9PSBgY29kZS1ib2xkYCAmJiBzdHlsZSAhPT0gYGNvZGUtZGltYCkpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgMjM6IHsgLy8gTmVpdGhlciBpdGFsaWMgb3IgYmxhY2tsZXR0ZXIgKGZvbnQgMTApXG5cdFx0XHRcdFx0c3R5bGVOYW1lcyA9IHN0eWxlTmFtZXMuZmlsdGVyKHN0eWxlID0+IChzdHlsZSAhPT0gYGNvZGUtaXRhbGljYCAmJiBzdHlsZSAhPT0gYGNvZGUtZm9udC0xMGApKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDI0OiB7IC8vIG5vdCB1bmRlcmxpbmVkIChOZWl0aGVyIHNpbmdseSBub3IgZG91Ymx5IHVuZGVybGluZWQpXG5cdFx0XHRcdFx0c3R5bGVOYW1lcyA9IHN0eWxlTmFtZXMuZmlsdGVyKHN0eWxlID0+IChzdHlsZSAhPT0gYGNvZGUtdW5kZXJsaW5lYCAmJiBzdHlsZSAhPT0gYGNvZGUtZG91YmxlLXVuZGVybGluZWApKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDI1OiB7IC8vIG5vdCBibGlua2luZ1xuXHRcdFx0XHRcdHN0eWxlTmFtZXMgPSBzdHlsZU5hbWVzLmZpbHRlcihzdHlsZSA9PiAoc3R5bGUgIT09IGBjb2RlLWJsaW5rYCAmJiBzdHlsZSAhPT0gYGNvZGUtcmFwaWQtYmxpbmtgKSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSAyNzogeyAvLyBub3QgcmV2ZXJzZWQvaW52ZXJ0ZWRcblx0XHRcdFx0XHRpZiAoY29sb3JzSW52ZXJ0ZWQpIHtcblx0XHRcdFx0XHRcdGNvbG9yc0ludmVydGVkID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRyZXZlcnNlRm9yZWdyb3VuZEFuZEJhY2tncm91bmRDb2xvcnMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSAyODogeyAvLyBub3QgaGlkZGVuIChyZXZlYWwpXG5cdFx0XHRcdFx0c3R5bGVOYW1lcyA9IHN0eWxlTmFtZXMuZmlsdGVyKHN0eWxlID0+IHN0eWxlICE9PSBgY29kZS1oaWRkZW5gKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDI5OiB7IC8vIG5vdCBjcm9zc2VkLW91dFxuXHRcdFx0XHRcdHN0eWxlTmFtZXMgPSBzdHlsZU5hbWVzLmZpbHRlcihzdHlsZSA9PiBzdHlsZSAhPT0gYGNvZGUtc3RyaWtlLXRocm91Z2hgKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDUzOiB7IC8vIG92ZXJsaW5lZFxuXHRcdFx0XHRcdHN0eWxlTmFtZXMgPSBzdHlsZU5hbWVzLmZpbHRlcihzdHlsZSA9PiBzdHlsZSAhPT0gYGNvZGUtb3ZlcmxpbmVgKTtcblx0XHRcdFx0XHRzdHlsZU5hbWVzLnB1c2goJ2NvZGUtb3ZlcmxpbmUnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDU1OiB7IC8vIG5vdCBvdmVybGluZWRcblx0XHRcdFx0XHRzdHlsZU5hbWVzID0gc3R5bGVOYW1lcy5maWx0ZXIoc3R5bGUgPT4gc3R5bGUgIT09IGBjb2RlLW92ZXJsaW5lYCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSAzOTogeyAgLy8gZGVmYXVsdCBmb3JlZ3JvdW5kIGNvbG9yXG5cdFx0XHRcdFx0Y2hhbmdlQ29sb3IoJ2ZvcmVncm91bmQnLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgNDk6IHsgIC8vIGRlZmF1bHQgYmFja2dyb3VuZCBjb2xvclxuXHRcdFx0XHRcdGNoYW5nZUNvbG9yKCdiYWNrZ3JvdW5kJywgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDU5OiB7ICAvLyBkZWZhdWx0IHVuZGVybGluZSBjb2xvclxuXHRcdFx0XHRcdGNoYW5nZUNvbG9yKCd1bmRlcmxpbmUnLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgNzM6IHsgLy8gc3VwZXJzY3JpcHRcblx0XHRcdFx0XHRzdHlsZU5hbWVzID0gc3R5bGVOYW1lcy5maWx0ZXIoc3R5bGUgPT4gKHN0eWxlICE9PSBgY29kZS1zdXBlcnNjcmlwdGAgJiYgc3R5bGUgIT09IGBjb2RlLXN1YnNjcmlwdGApKTtcblx0XHRcdFx0XHRzdHlsZU5hbWVzLnB1c2goJ2NvZGUtc3VwZXJzY3JpcHQnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDc0OiB7IC8vIHN1YnNjcmlwdFxuXHRcdFx0XHRcdHN0eWxlTmFtZXMgPSBzdHlsZU5hbWVzLmZpbHRlcihzdHlsZSA9PiAoc3R5bGUgIT09IGBjb2RlLXN1cGVyc2NyaXB0YCAmJiBzdHlsZSAhPT0gYGNvZGUtc3Vic2NyaXB0YCkpO1xuXHRcdFx0XHRcdHN0eWxlTmFtZXMucHVzaCgnY29kZS1zdWJzY3JpcHQnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIDc1OiB7IC8vIG5laXRoZXIgc3VwZXJzY3JpcHQgb3Igc3Vic2NyaXB0XG5cdFx0XHRcdFx0c3R5bGVOYW1lcyA9IHN0eWxlTmFtZXMuZmlsdGVyKHN0eWxlID0+IChzdHlsZSAhPT0gYGNvZGUtc3VwZXJzY3JpcHRgICYmIHN0eWxlICE9PSBgY29kZS1zdWJzY3JpcHRgKSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHRcdHNldEJhc2ljQ29sb3IoY29kZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2FsY3VsYXRlIGFuZCBzZXQgc3R5bGluZyBmb3IgY29tcGxpY2F0ZWQgMjQtYml0IEFOU0kgY29sb3IgY29kZXMuXG5cdCAqIEBwYXJhbSBzdHlsZUNvZGVzIEZ1bGwgbGlzdCBvZiBpbnRlZ2VyIGNvZGVzIHRoYXQgbWFrZSB1cCB0aGUgZnVsbCBBTlNJXG5cdCAqIHNlcXVlbmNlLCBpbmNsdWRpbmcgdGhlIHR3byBkZWZpbmluZyBjb2RlcyBhbmQgdGhlIHRocmVlIFJHQiBjb2Rlcy5cblx0ICogQHBhcmFtIGNvbG9yVHlwZSBJZiBgJ2ZvcmVncm91bmQnYCwgd2lsbCBzZXQgZm9yZWdyb3VuZCBjb2xvciwgaWZcblx0ICogYCdiYWNrZ3JvdW5kJ2AsIHdpbGwgc2V0IGJhY2tncm91bmQgY29sb3IsIGFuZCBpZiBpdCBpcyBgJ3VuZGVybGluZSdgXG5cdCAqIHdpbGwgc2V0IHRoZSB1bmRlcmxpbmUgY29sb3IuXG5cdCAqIEBzZWUge0BsaW5rIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FOU0lfZXNjYXBlX2NvZGUjMjQtYml0IH1cblx0ICovXG5cdGZ1bmN0aW9uIHNldDI0Qml0Q29sb3Ioc3R5bGVDb2RlczogbnVtYmVyW10sIGNvbG9yVHlwZTogJ2ZvcmVncm91bmQnIHwgJ2JhY2tncm91bmQnIHwgJ3VuZGVybGluZScpOiB2b2lkIHtcblx0XHRpZiAoc3R5bGVDb2Rlcy5sZW5ndGggPj0gNSAmJlxuXHRcdFx0c3R5bGVDb2Rlc1syXSA+PSAwICYmIHN0eWxlQ29kZXNbMl0gPD0gMjU1ICYmXG5cdFx0XHRzdHlsZUNvZGVzWzNdID49IDAgJiYgc3R5bGVDb2Rlc1szXSA8PSAyNTUgJiZcblx0XHRcdHN0eWxlQ29kZXNbNF0gPj0gMCAmJiBzdHlsZUNvZGVzWzRdIDw9IDI1NSkge1xuXHRcdFx0Y29uc3QgY3VzdG9tQ29sb3IgPSBuZXcgUkdCQShzdHlsZUNvZGVzWzJdLCBzdHlsZUNvZGVzWzNdLCBzdHlsZUNvZGVzWzRdKTtcblx0XHRcdGNoYW5nZUNvbG9yKGNvbG9yVHlwZSwgY3VzdG9tQ29sb3IpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBDYWxjdWxhdGUgYW5kIHNldCBzdHlsaW5nIGZvciBhZHZhbmNlZCA4LWJpdCBBTlNJIGNvbG9yIGNvZGVzLlxuXHQgKiBAcGFyYW0gc3R5bGVDb2RlcyBGdWxsIGxpc3Qgb2YgaW50ZWdlciBjb2RlcyB0aGF0IG1ha2UgdXAgdGhlIEFOU0lcblx0ICogc2VxdWVuY2UsIGluY2x1ZGluZyB0aGUgdHdvIGRlZmluaW5nIGNvZGVzIGFuZCB0aGUgb25lIGNvbG9yIGNvZGUuXG5cdCAqIEBwYXJhbSBjb2xvclR5cGUgSWYgYCdmb3JlZ3JvdW5kJ2AsIHdpbGwgc2V0IGZvcmVncm91bmQgY29sb3IsIGlmXG5cdCAqIGAnYmFja2dyb3VuZCdgLCB3aWxsIHNldCBiYWNrZ3JvdW5kIGNvbG9yIGFuZCBpZiBpdCBpcyBgJ3VuZGVybGluZSdgXG5cdCAqIHdpbGwgc2V0IHRoZSB1bmRlcmxpbmUgY29sb3IuXG5cdCAqIEBzZWUge0BsaW5rIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FOU0lfZXNjYXBlX2NvZGUjOC1iaXQgfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2V0OEJpdENvbG9yKHN0eWxlQ29kZXM6IG51bWJlcltdLCBjb2xvclR5cGU6ICdmb3JlZ3JvdW5kJyB8ICdiYWNrZ3JvdW5kJyB8ICd1bmRlcmxpbmUnKTogdm9pZCB7XG5cdFx0bGV0IGNvbG9yTnVtYmVyID0gc3R5bGVDb2Rlc1syXTtcblx0XHRjb25zdCBjb2xvciA9IGNhbGNBTlNJOGJpdENvbG9yKGNvbG9yTnVtYmVyKTtcblxuXHRcdGlmIChjb2xvcikge1xuXHRcdFx0Y2hhbmdlQ29sb3IoY29sb3JUeXBlLCBjb2xvcik7XG5cdFx0fSBlbHNlIGlmIChjb2xvck51bWJlciA+PSAwICYmIGNvbG9yTnVtYmVyIDw9IDE1KSB7XG5cdFx0XHRpZiAoY29sb3JUeXBlID09PSAndW5kZXJsaW5lJykge1xuXHRcdFx0XHQvLyBmb3IgdW5kZXJsaW5lIGNvbG9ycyB3ZSBqdXN0IGRlY29kZSB0aGUgMC0xNSBjb2xvciBudW1iZXIgdG8gdGhlbWUgY29sb3IsIHNldCBhbmQgcmV0dXJuXG5cdFx0XHRcdGNvbnN0IGNvbG9yTmFtZSA9IGFuc2lDb2xvcklkZW50aWZpZXJzW2NvbG9yTnVtYmVyXTtcblx0XHRcdFx0Y2hhbmdlQ29sb3IoY29sb3JUeXBlLCBgLS12c2NvZGUtZGVidWctYW5zaS0ke2NvbG9yTmFtZX1gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Ly8gTmVlZCB0byBtYXAgdG8gb25lIG9mIHRoZSBmb3VyIGJhc2ljIGNvbG9yIHJhbmdlcyAoMzAtMzcsIDkwLTk3LCA0MC00NywgMTAwLTEwNylcblx0XHRcdGNvbG9yTnVtYmVyICs9IDMwO1xuXHRcdFx0aWYgKGNvbG9yTnVtYmVyID49IDM4KSB7XG5cdFx0XHRcdC8vIEJyaWdodCBjb2xvcnNcblx0XHRcdFx0Y29sb3JOdW1iZXIgKz0gNTI7XG5cdFx0XHR9XG5cdFx0XHRpZiAoY29sb3JUeXBlID09PSAnYmFja2dyb3VuZCcpIHtcblx0XHRcdFx0Y29sb3JOdW1iZXIgKz0gMTA7XG5cdFx0XHR9XG5cdFx0XHRzZXRCYXNpY0NvbG9yKGNvbG9yTnVtYmVyKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2FsY3VsYXRlIGFuZCBzZXQgc3R5bGluZyBmb3IgYmFzaWMgYnJpZ2h0IGFuZCBkYXJrIEFOU0kgY29sb3IgY29kZXMuIFVzZXNcblx0ICogdGhlbWUgY29sb3JzIGlmIGF2YWlsYWJsZS4gQXV0b21hdGljYWxseSBkaXN0aW5ndWlzaGVzIGJldHdlZW4gZm9yZWdyb3VuZFxuXHQgKiBhbmQgYmFja2dyb3VuZCBjb2xvcnM7IGRvZXMgbm90IHN1cHBvcnQgY29sb3ItY2xlYXJpbmcgY29kZXMgMzkgYW5kIDQ5LlxuXHQgKiBAcGFyYW0gc3R5bGVDb2RlIEludGVnZXIgY29sb3IgY29kZSBvbiBvbmUgb2YgdGhlIGZvbGxvd2luZyByYW5nZXM6XG5cdCAqIFszMC0zNywgOTAtOTcsIDQwLTQ3LCAxMDAtMTA3XS4gSWYgbm90IG9uIG9uZSBvZiB0aGVzZSByYW5nZXMsIHdpbGwgZG9cblx0ICogbm90aGluZy5cblx0ICovXG5cdGZ1bmN0aW9uIHNldEJhc2ljQ29sb3Ioc3R5bGVDb2RlOiBudW1iZXIpOiB2b2lkIHtcblx0XHRsZXQgY29sb3JUeXBlOiAnZm9yZWdyb3VuZCcgfCAnYmFja2dyb3VuZCcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGNvbG9ySW5kZXg6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRcdGlmIChzdHlsZUNvZGUgPj0gMzAgJiYgc3R5bGVDb2RlIDw9IDM3KSB7XG5cdFx0XHRjb2xvckluZGV4ID0gc3R5bGVDb2RlIC0gMzA7XG5cdFx0XHRjb2xvclR5cGUgPSAnZm9yZWdyb3VuZCc7XG5cdFx0fSBlbHNlIGlmIChzdHlsZUNvZGUgPj0gOTAgJiYgc3R5bGVDb2RlIDw9IDk3KSB7XG5cdFx0XHRjb2xvckluZGV4ID0gKHN0eWxlQ29kZSAtIDkwKSArIDg7IC8vIEhpZ2gtaW50ZW5zaXR5IChicmlnaHQpXG5cdFx0XHRjb2xvclR5cGUgPSAnZm9yZWdyb3VuZCc7XG5cdFx0fSBlbHNlIGlmIChzdHlsZUNvZGUgPj0gNDAgJiYgc3R5bGVDb2RlIDw9IDQ3KSB7XG5cdFx0XHRjb2xvckluZGV4ID0gc3R5bGVDb2RlIC0gNDA7XG5cdFx0XHRjb2xvclR5cGUgPSAnYmFja2dyb3VuZCc7XG5cdFx0fSBlbHNlIGlmIChzdHlsZUNvZGUgPj0gMTAwICYmIHN0eWxlQ29kZSA8PSAxMDcpIHtcblx0XHRcdGNvbG9ySW5kZXggPSAoc3R5bGVDb2RlIC0gMTAwKSArIDg7IC8vIEhpZ2gtaW50ZW5zaXR5IChicmlnaHQpXG5cdFx0XHRjb2xvclR5cGUgPSAnYmFja2dyb3VuZCc7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbG9ySW5kZXggIT09IHVuZGVmaW5lZCAmJiBjb2xvclR5cGUpIHtcblx0XHRcdGNvbnN0IGNvbG9yTmFtZSA9IGFuc2lDb2xvcklkZW50aWZpZXJzW2NvbG9ySW5kZXhdO1xuXHRcdFx0Y2hhbmdlQ29sb3IoY29sb3JUeXBlLCBgLS12c2NvZGUtZGVidWctYW5zaS0ke2NvbG9yTmFtZS5yZXBsYWNlQWxsKCcuJywgJy0nKX1gKTtcblx0XHR9XG5cdH1cbn1cblxuLyoqXG4gKiBAcGFyYW0gcm9vdCBUaGUge0BsaW5rIEhUTUxFbGVtZW50fSB0byBhcHBlbmQgdGhlIGNvbnRlbnQgdG8uXG4gKiBAcGFyYW0gc3RyaW5nQ29udGVudCBUaGUgdGV4dCBjb250ZW50IHRvIGJlIGFwcGVuZGVkLlxuICogQHBhcmFtIGNzc0NsYXNzZXMgVGhlIGxpc3Qgb2YgQ1NTIHN0eWxlcyB0byBhcHBseSB0byB0aGUgdGV4dCBjb250ZW50LlxuICogQHBhcmFtIGxpbmtEZXRlY3RvciBUaGUge0BsaW5rIElMaW5rRGV0ZWN0b3J9IHJlc3BvbnNpYmxlIGZvciBnZW5lcmF0aW5nIGxpbmtzIGZyb20ge0BwYXJhbSBzdHJpbmdDb250ZW50fS5cbiAqIEBwYXJhbSBjdXN0b21UZXh0Q29sb3IgSWYgcHJvdmlkZWQsIHdpbGwgYXBwbHkgY3VzdG9tIGNvbG9yIHdpdGggaW5saW5lIHN0eWxlLlxuICogQHBhcmFtIGN1c3RvbUJhY2tncm91bmRDb2xvciBJZiBwcm92aWRlZCwgd2lsbCBhcHBseSBjdXN0b20gYmFja2dyb3VuZENvbG9yIHdpdGggaW5saW5lIHN0eWxlLlxuICogQHBhcmFtIGN1c3RvbVVuZGVybGluZUNvbG9yIElmIHByb3ZpZGVkLCB3aWxsIGFwcGx5IGN1c3RvbSB0ZXh0RGVjb3JhdGlvbkNvbG9yIHdpdGggaW5saW5lIHN0eWxlLlxuICogQHBhcmFtIGhpZ2hsaWdodHMgVGhlIHJhbmdlcyB0byBoaWdobGlnaHQuXG4gKiBAcGFyYW0gb2Zmc2V0IFRoZSBzdGFydGluZyBpbmRleCBvZiB0aGUgc3RyaW5nQ29udGVudCBpbiB0aGUgb3JpZ2luYWwgdGV4dC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGVuZFN0eWxpemVkU3RyaW5nVG9Db250YWluZXIoXG5cdHJvb3Q6IEhUTUxFbGVtZW50LFxuXHRzdHJpbmdDb250ZW50OiBzdHJpbmcsXG5cdGNzc0NsYXNzZXM6IHN0cmluZ1tdLFxuXHRsaW5rRGV0ZWN0b3I6IElMaW5rRGV0ZWN0b3IsXG5cdHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCxcblx0Y3VzdG9tVGV4dENvbG9yOiBSR0JBIHwgc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRjdXN0b21CYWNrZ3JvdW5kQ29sb3I6IFJHQkEgfCBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdGN1c3RvbVVuZGVybGluZUNvbG9yOiBSR0JBIHwgc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRoaWdobGlnaHRzOiBJSGlnaGxpZ2h0W10gfCB1bmRlZmluZWQsXG5cdG9mZnNldDogbnVtYmVyLFxuKTogdm9pZCB7XG5cdGlmICghcm9vdCB8fCAhc3RyaW5nQ29udGVudCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IGNvbnRhaW5lciA9IGxpbmtEZXRlY3Rvci5saW5raWZ5KFxuXHRcdHN0cmluZ0NvbnRlbnQsXG5cdFx0dHJ1ZSxcblx0XHR3b3Jrc3BhY2VGb2xkZXIsXG5cdFx0dW5kZWZpbmVkLFxuXHRcdHVuZGVmaW5lZCxcblx0XHRoaWdobGlnaHRzPy5tYXAoaCA9PiAoeyBzdGFydDogaC5zdGFydCAtIG9mZnNldCwgZW5kOiBoLmVuZCAtIG9mZnNldCwgZXh0cmFDbGFzc2VzOiBoLmV4dHJhQ2xhc3NlcyB9KSksXG5cdCk7XG5cblx0Y29udGFpbmVyLmNsYXNzTmFtZSA9IGNzc0NsYXNzZXMuam9pbignICcpO1xuXHRpZiAoY3VzdG9tVGV4dENvbG9yKSB7XG5cdFx0Y29udGFpbmVyLnN0eWxlLmNvbG9yID1cblx0XHRcdHR5cGVvZiBjdXN0b21UZXh0Q29sb3IgPT09ICdzdHJpbmcnID8gYHZhcigke2N1c3RvbVRleHRDb2xvcn0pYCA6IENvbG9yLkZvcm1hdC5DU1MuZm9ybWF0UkdCKG5ldyBDb2xvcihjdXN0b21UZXh0Q29sb3IpKTtcblx0fVxuXHRpZiAoY3VzdG9tQmFja2dyb3VuZENvbG9yKSB7XG5cdFx0Y29udGFpbmVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9XG5cdFx0XHR0eXBlb2YgY3VzdG9tQmFja2dyb3VuZENvbG9yID09PSAnc3RyaW5nJyA/IGB2YXIoJHtjdXN0b21CYWNrZ3JvdW5kQ29sb3J9KWAgOiBDb2xvci5Gb3JtYXQuQ1NTLmZvcm1hdFJHQihuZXcgQ29sb3IoY3VzdG9tQmFja2dyb3VuZENvbG9yKSk7XG5cdH1cblx0aWYgKGN1c3RvbVVuZGVybGluZUNvbG9yKSB7XG5cdFx0Y29udGFpbmVyLnN0eWxlLnRleHREZWNvcmF0aW9uQ29sb3IgPVxuXHRcdFx0dHlwZW9mIGN1c3RvbVVuZGVybGluZUNvbG9yID09PSAnc3RyaW5nJyA/IGB2YXIoJHtjdXN0b21VbmRlcmxpbmVDb2xvcn0pYCA6IENvbG9yLkZvcm1hdC5DU1MuZm9ybWF0UkdCKG5ldyBDb2xvcihjdXN0b21VbmRlcmxpbmVDb2xvcikpO1xuXHR9XG5cblx0cm9vdC5hcHBlbmRDaGlsZChjb250YWluZXIpO1xufVxuXG4vKipcbiAqIENhbGN1bGF0ZSB0aGUgY29sb3IgZnJvbSB0aGUgY29sb3Igc2V0IGRlZmluZWQgaW4gdGhlIEFOU0kgOC1iaXQgc3RhbmRhcmQuXG4gKiBTdGFuZGFyZCBhbmQgaGlnaCBpbnRlbnNpdHkgY29sb3JzIGFyZSBub3QgZGVmaW5lZCBpbiB0aGUgc3RhbmRhcmQgYXMgc3BlY2lmaWNcbiAqIGNvbG9ycywgc28gdGhlc2UgYW5kIGludmFsaWQgY29sb3JzIHJldHVybiBgdW5kZWZpbmVkYC5cbiAqIEBzZWUge0BsaW5rIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FOU0lfZXNjYXBlX2NvZGUjOC1iaXQgfSBmb3IgaW5mby5cbiAqIEBwYXJhbSBjb2xvck51bWJlciBUaGUgbnVtYmVyIChyYW5naW5nIGZyb20gMTYgdG8gMjU1KSByZWZlcnJpbmcgdG8gdGhlIGNvbG9yXG4gKiBkZXNpcmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2FsY0FOU0k4Yml0Q29sb3IoY29sb3JOdW1iZXI6IG51bWJlcik6IFJHQkEgfCB1bmRlZmluZWQge1xuXHRpZiAoY29sb3JOdW1iZXIgJSAxICE9PSAwKSB7XG5cdFx0Ly8gU2hvdWxkIGJlIGludGVnZXJcblx0XHRyZXR1cm47XG5cdH0gaWYgKGNvbG9yTnVtYmVyID49IDE2ICYmIGNvbG9yTnVtYmVyIDw9IDIzMSkge1xuXHRcdC8vIENvbnZlcnRzIHRvIG9uZSBvZiAyMTYgUkdCIGNvbG9yc1xuXHRcdGNvbG9yTnVtYmVyIC09IDE2O1xuXG5cdFx0bGV0IGJsdWU6IG51bWJlciA9IGNvbG9yTnVtYmVyICUgNjtcblx0XHRjb2xvck51bWJlciA9IChjb2xvck51bWJlciAtIGJsdWUpIC8gNjtcblx0XHRsZXQgZ3JlZW46IG51bWJlciA9IGNvbG9yTnVtYmVyICUgNjtcblx0XHRjb2xvck51bWJlciA9IChjb2xvck51bWJlciAtIGdyZWVuKSAvIDY7XG5cdFx0bGV0IHJlZDogbnVtYmVyID0gY29sb3JOdW1iZXI7XG5cblx0XHQvLyByZWQsIGdyZWVuLCBibHVlIG5vdyByYW5nZSBvbiBbMCwgNV0sIG5lZWQgdG8gbWFwIHRvIFswLDI1NV1cblx0XHRjb25zdCBjb252RmFjdG9yOiBudW1iZXIgPSAyNTUgLyA1O1xuXHRcdGJsdWUgPSBNYXRoLnJvdW5kKGJsdWUgKiBjb252RmFjdG9yKTtcblx0XHRncmVlbiA9IE1hdGgucm91bmQoZ3JlZW4gKiBjb252RmFjdG9yKTtcblx0XHRyZWQgPSBNYXRoLnJvdW5kKHJlZCAqIGNvbnZGYWN0b3IpO1xuXG5cdFx0cmV0dXJuIG5ldyBSR0JBKHJlZCwgZ3JlZW4sIGJsdWUpO1xuXHR9IGVsc2UgaWYgKGNvbG9yTnVtYmVyID49IDIzMiAmJiBjb2xvck51bWJlciA8PSAyNTUpIHtcblx0XHQvLyBDb252ZXJ0cyB0byBhIGdyYXlzY2FsZSB2YWx1ZVxuXHRcdGNvbG9yTnVtYmVyIC09IDIzMjtcblx0XHRjb25zdCBjb2xvckxldmVsOiBudW1iZXIgPSBNYXRoLnJvdW5kKGNvbG9yTnVtYmVyIC8gMjMgKiAyNTUpO1xuXHRcdHJldHVybiBuZXcgUkdCQShjb2xvckxldmVsLCBjb2xvckxldmVsLCBjb2xvckxldmVsKTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm47XG5cdH1cbn1cblxucmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQoKHRoZW1lLCBjb2xsZWN0b3IpID0+IHtcblx0Y29uc3QgYXJlYXMgPSBbXG5cdFx0eyBzZWxlY3RvcjogJy5tb25hY28td29ya2JlbmNoIC5zaWRlYmFyLCAubW9uYWNvLXdvcmtiZW5jaCAuYXV4aWxpYXJ5YmFyJywgYmc6IHRoZW1lLmdldENvbG9yKFNJREVfQkFSX0JBQ0tHUk9VTkQpIH0sXG5cdFx0eyBzZWxlY3RvcjogJy5tb25hY28td29ya2JlbmNoIC5wYW5lbCcsIGJnOiB0aGVtZS5nZXRDb2xvcihQQU5FTF9CQUNLR1JPVU5EKSB9LFxuXHRcdHsgc2VsZWN0b3I6ICcubW9uYWNvLXdvcmtiZW5jaCAubW9uYWNvLWxpc3Qtcm93LnNlbGVjdGVkJywgYmc6IHRoZW1lLmdldENvbG9yKGxpc3RJbmFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmQpIH0sXG5cdFx0eyBzZWxlY3RvcjogJy5tb25hY28td29ya2JlbmNoIC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZCcsIGJnOiB0aGVtZS5nZXRDb2xvcihsaXN0SW5hY3RpdmVGb2N1c0JhY2tncm91bmQpIH0sXG5cdFx0eyBzZWxlY3RvcjogJy5tb25hY28td29ya2JlbmNoIC5tb25hY28tbGlzdDpmb2N1cyAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQnLCBiZzogdGhlbWUuZ2V0Q29sb3IobGlzdEZvY3VzQmFja2dyb3VuZCkgfSxcblx0XHR7IHNlbGVjdG9yOiAnLm1vbmFjby13b3JrYmVuY2ggLm1vbmFjby1saXN0OmZvY3VzIC5tb25hY28tbGlzdC1yb3cuc2VsZWN0ZWQnLCBiZzogdGhlbWUuZ2V0Q29sb3IobGlzdEFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmQpIH0sXG5cdFx0eyBzZWxlY3RvcjogJy5kZWJ1Zy1ob3Zlci13aWRnZXQnLCBiZzogdGhlbWUuZ2V0Q29sb3IoZWRpdG9ySG92ZXJCYWNrZ3JvdW5kKSB9LFxuXHRdO1xuXG5cdGZvciAoY29uc3QgeyBzZWxlY3RvciwgYmcgfSBvZiBhcmVhcykge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBhbnNpQ29sb3JJZGVudGlmaWVyc1xuXHRcdFx0Lm1hcChjb2xvciA9PiB7XG5cdFx0XHRcdGNvbnN0IGFjdHVhbCA9IHRoZW1lLmdldENvbG9yKGNvbG9yKTtcblx0XHRcdFx0aWYgKCFhY3R1YWwpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdFx0XHQvLyB0aGlzIHVzZXMgdGhlIGRlZmF1bHQgY29udHJhc3QgcmF0aW8gb2YgNCAoZnJvbSB0aGUgdGVybWluYWwpLFxuXHRcdFx0XHQvLyB3ZSBtYXkgd2FudCB0byBtYWtlIHRoaXMgY29uZmlndXJhYmxlIGluIHRoZSBmdXR1cmUsIGJ1dCB0aGlzIGlzXG5cdFx0XHRcdC8vIGdvb2QgdG8ga2VlcCB0aGluZ3Mgc2FuZSB0byBzdGFydCB3aXRoLlxuXHRcdFx0XHRyZXR1cm4gYC0tdnNjb2RlLWRlYnVnLWFuc2ktJHtjb2xvci5yZXBsYWNlQWxsKCcuJywgJy0nKX06JHtiZyA/IGJnLmVuc3VyZUNvbnN0cmFzdChhY3R1YWwsIDQpIDogYWN0dWFsfWA7XG5cdFx0XHR9KVxuXHRcdFx0LmZpbHRlcihpc0RlZmluZWQpO1xuXG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYCR7c2VsZWN0b3J9IHsgJHtjb250ZW50LmpvaW4oJzsnKX0gfWApO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMsT0FBTyxZQUFZO0FBQzVCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsdUJBQXVCLCtCQUErQixxQkFBcUIsNkJBQTZCLHVDQUF1QztBQUN4SixTQUFTLGtDQUFrQztBQUUzQyxTQUFTLGtCQUFrQiwyQkFBMkI7QUFDdEQsU0FBUyw0QkFBNEI7QUFPOUIsU0FBUyxpQkFBaUIsTUFBYyxjQUE2QixpQkFBK0MsWUFBdUQ7QUFFakwsUUFBTSxPQUF3QixTQUFTLGNBQWMsTUFBTTtBQUMzRCxRQUFNLGFBQXFCLEtBQUs7QUFFaEMsTUFBSSxhQUF1QixDQUFDO0FBQzVCLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUksaUJBQTBCO0FBQzlCLE1BQUksYUFBcUI7QUFDekIsTUFBSSxpQkFBaUI7QUFDckIsTUFBSSxTQUFpQjtBQUVyQixTQUFPLGFBQWEsWUFBWTtBQUUvQixRQUFJLGdCQUF5QjtBQUk3QixRQUFJLEtBQUssV0FBVyxVQUFVLE1BQU0sTUFBTSxLQUFLLE9BQU8sYUFBYSxDQUFDLE1BQU0sS0FBSztBQUU5RSxZQUFNLFdBQW1CO0FBQ3pCLG9CQUFjO0FBRWQsVUFBSSxlQUF1QjtBQUUzQixhQUFPLGFBQWEsWUFBWTtBQUMvQixjQUFNLE9BQWUsS0FBSyxPQUFPLFVBQVU7QUFDM0Msd0JBQWdCO0FBRWhCO0FBR0EsWUFBSSxLQUFLLE1BQU0sb0JBQW9CLEdBQUc7QUFDckMsMEJBQWdCO0FBQ2hCO0FBQUEsUUFDRDtBQUFBLE1BRUQ7QUFFQSxVQUFJLGVBQWU7QUFFbEIsMEJBQWtCLElBQUksYUFBYTtBQUduQyx3Q0FBZ0MsTUFB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
