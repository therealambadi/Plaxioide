import { createScanner, ScanError, SyntaxKind } from "./json.js";
function format(documentText, range, options) {
  let initialIndentLevel;
  let formatText;
  let formatTextStart;
  let rangeStart;
  let rangeEnd;
  if (range) {
    rangeStart = range.offset;
    rangeEnd = rangeStart + range.length;
    formatTextStart = rangeStart;
    while (formatTextStart > 0 && !isEOL(documentText, formatTextStart - 1)) {
      formatTextStart--;
    }
    let endOffset = rangeEnd;
    while (endOffset < documentText.length && !isEOL(documentText, endOffset)) {
      endOffset++;
    }
    formatText = documentText.substring(formatTextStart, endOffset);
    initialIndentLevel = computeIndentLevel(formatText, options);
  } else {
    formatText = documentText;
    initialIndentLevel = 0;
    formatTextStart = 0;
    rangeStart = 0;
    rangeEnd = documentText.length;
  }
  const eol = getEOL(options, documentText);
  let lineBreak = false;
  let indentLevel = 0;
  let indentValue;
  if (options.insertSpaces) {
    indentValue = repeat(" ", options.tabSize || 4);
  } else {
    indentValue = "	";
  }
  const scanner = createScanner(formatText, false);
  let hasError = false;
  function newLineAndIndent() {
    return eol + repeat(indentValue, initialIndentLevel + indentLevel);
  }
  function scanNext() {
    let token = scanner.scan();
    lineBreak = false;
    while (token === SyntaxKind.Trivia || token === SyntaxKind.LineBreakTrivia) {
      lineBreak = lineBreak || token === SyntaxKind.LineBreakTrivia;
      token = scanner.scan();
    }
    hasError = token === SyntaxKind.Unknown || scanner.getTokenError() !== ScanError.None;
    return token;
  }
  const editOperations = [];
  function addEdit(text, startOffset, endOffset) {
    if (!hasError && startOffset < rangeEnd && endOffset > rangeStart && documentText.substring(startOffset, endOffset) !== text) {
      editOperations.push({ offset: startOffset, length: endOffset - startOffset, content: text });
    }
  }
  let firstToken = scanNext();
  if (firstToken !== SyntaxKind.EOF) {
    const firstTokenStart = scanner.getTokenOffset() + formatTextStart;
    const initialIndent = repeat(indentValue, initialIndentLevel);
    addEdit(initialIndent, formatTextStart, firstTokenStart);
  }
  while (firstToken !== SyntaxKind.EOF) {
    let firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
    let secondToken = scanNext();
    let replaceContent = "";
    while (!lineBreak && (secondToken === SyntaxKind.LineCommentTrivia || secondToken === SyntaxKind.BlockCommentTrivia)) {
      const commentTokenStart = scanner.getTokenOffset() + formatTextStart;
      addEdit(" ", firstTokenEnd, commentTokenStart);
      firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
      replaceContent = secondToken === SyntaxKind.LineCommentTrivia ? newLineAndIndent() : "";
      secondToken = scanNext();
    }
    if (secondToken === SyntaxKind.CloseBraceToken) {
      if (firstToken !== SyntaxKind.OpenBraceToken) {
        indentLevel--;
        replaceContent = newLineAndIndent();
      }
    } else if (secondToken === SyntaxKind.CloseBracketToken) {
      if (firstToken !== SyntaxKind.OpenBracketToken) {
        indentLevel--;
        replaceContent = newLineAndIndent();
      }
    } else {
      switch (firstToken) {
        case SyntaxKind.OpenBracketToken:
        case SyntaxKind.OpenBraceToken:
          indentLevel++;
          replaceContent = newLineAndIndent();
          break;
        case SyntaxKind.CommaToken:
        case SyntaxKind.LineCommentTrivia:
          replaceContent = newLineAndIndent();
          break;
        case SyntaxKind.BlockCommentTrivia:
          if (lineBreak) {
            replaceContent = newLineAndIndent();
          } else {
            replaceContent = " ";
          }
          break;
        case SyntaxKind.ColonToken:
          replaceContent = " ";
          break;
        case SyntaxKind.StringLiteral:
          if (secondToken === SyntaxKind.ColonToken) {
            replaceContent = "";
            break;
          }
        // fall through
        case SyntaxKind.NullKeyword:
        case SyntaxKind.TrueKeyword:
        case SyntaxKind.FalseKeyword:
        case SyntaxKind.NumericLiteral:
        case SyntaxKind.CloseBraceToken:
        case SyntaxKind.CloseBracketToken:
          if (secondToken === SyntaxKind.LineCommentTrivia || secondToken === SyntaxKind.BlockCommentTrivia) {
            replaceContent = " ";
          } else if (secondToken !== SyntaxKind.CommaToken && secondToken !== SyntaxKind.EOF) {
            hasError = true;
          }
          break;
        case SyntaxKind.Unknown:
          hasError = true;
          break;
      }
      if (lineBreak && (secondToken === SyntaxKind.LineCommentTrivia || secondToken === SyntaxKind.BlockCommentTrivia)) {
        replaceContent = newLineAndIndent();
      }
    }
    const secondTokenStart = scanner.getTokenOffset() + formatTextStart;
    addEdit(replaceContent, firstTokenEnd, secondTokenStart);
    firstToken = secondToken;
  }
  return editOperations;
}
function toFormattedString(obj, options) {
  const content = JSON.stringify(obj, void 0, options.insertSpaces ? options.tabSize || 4 : "	");
  if (options.eol !== void 0) {
    return content.replace(/\r\n|\r|\n/g, options.eol);
  }
  return content;
}
function repeat(s, count) {
  let result = "";
  for (let i = 0; i < count; i++) {
    result += s;
  }
  return result;
}
function computeIndentLevel(content, options) {
  let i = 0;
  let nChars = 0;
  const tabSize = options.tabSize || 4;
  while (i < content.length) {
    const ch = content.charAt(i);
    if (ch === " ") {
      nChars++;
    } else if (ch === "	") {
      nChars += tabSize;
    } else {
      break;
    }
    i++;
  }
  return Math.floor(nChars / tabSize);
}
function getEOL(options, text) {
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === "\r") {
      if (i + 1 < text.length && text.charAt(i + 1) === "\n") {
        return "\r\n";
      }
      return "\r";
    } else if (ch === "\n") {
      return "\n";
    }
  }
  return options && options.eol || "\n";
}
function isEOL(text, offset) {
  return "\r\n".indexOf(text.charAt(offset)) !== -1;
}
export {
  format,
  getEOL,
  isEOL,
  toFormattedString
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9qc29uRm9ybWF0dGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY3JlYXRlU2Nhbm5lciwgU2NhbkVycm9yLCBTeW50YXhLaW5kIH0gZnJvbSAnLi9qc29uLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBGb3JtYXR0aW5nT3B0aW9ucyB7XG5cdC8qKlxuXHQgKiBJZiBpbmRlbnRhdGlvbiBpcyBiYXNlZCBvbiBzcGFjZXMgKGBpbnNlcnRTcGFjZXNgID0gdHJ1ZSksIHRoZW4gd2hhdCBpcyB0aGUgbnVtYmVyIG9mIHNwYWNlcyB0aGF0IG1ha2UgYW4gaW5kZW50P1xuXHQgKi9cblx0dGFiU2l6ZT86IG51bWJlcjtcblx0LyoqXG5cdCAqIElzIGluZGVudGF0aW9uIGJhc2VkIG9uIHNwYWNlcz9cblx0ICovXG5cdGluc2VydFNwYWNlcz86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBUaGUgZGVmYXVsdCAnZW5kIG9mIGxpbmUnIGNoYXJhY3Rlci4gSWYgbm90IHNldCwgJ1xcbicgaXMgdXNlZCBhcyBkZWZhdWx0LlxuXHQgKi9cblx0ZW9sPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSB0ZXh0IG1vZGlmaWNhdGlvblxuICovXG5leHBvcnQgaW50ZXJmYWNlIEVkaXQge1xuXHQvKipcblx0ICogVGhlIHN0YXJ0IG9mZnNldCBvZiB0aGUgbW9kaWZpY2F0aW9uLlxuXHQgKi9cblx0b2Zmc2V0OiBudW1iZXI7XG5cdC8qKlxuXHQgKiBUaGUgbGVuZ3RoIG9mIHRoZSBtb2RpZmljYXRpb24uIE11c3Qgbm90IGJlIG5lZ2F0aXZlLiBFbXB0eSBsZW5ndGggcmVwcmVzZW50cyBhbiAqaW5zZXJ0Ki5cblx0ICovXG5cdGxlbmd0aDogbnVtYmVyO1xuXHQvKipcblx0ICogVGhlIG5ldyBjb250ZW50LiBFbXB0eSBjb250ZW50IHJlcHJlc2VudHMgYSAqcmVtb3ZlKi5cblx0ICovXG5cdGNvbnRlbnQ6IHN0cmluZztcbn1cblxuLyoqXG4gKiBBIHRleHQgcmFuZ2UgaW4gdGhlIGRvY3VtZW50XG4qL1xuZXhwb3J0IGludGVyZmFjZSBSYW5nZSB7XG5cdC8qKlxuXHQgKiBUaGUgc3RhcnQgb2Zmc2V0IG9mIHRoZSByYW5nZS5cblx0ICovXG5cdG9mZnNldDogbnVtYmVyO1xuXHQvKipcblx0ICogVGhlIGxlbmd0aCBvZiB0aGUgcmFuZ2UuIE11c3Qgbm90IGJlIG5lZ2F0aXZlLlxuXHQgKi9cblx0bGVuZ3RoOiBudW1iZXI7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdChkb2N1bWVudFRleHQ6IHN0cmluZywgcmFuZ2U6IFJhbmdlIHwgdW5kZWZpbmVkLCBvcHRpb25zOiBGb3JtYXR0aW5nT3B0aW9ucyk6IEVkaXRbXSB7XG5cdGxldCBpbml0aWFsSW5kZW50TGV2ZWw6IG51bWJlcjtcblx0bGV0IGZvcm1hdFRleHQ6IHN0cmluZztcblx0bGV0IGZvcm1hdFRleHRTdGFydDogbnVtYmVyO1xuXHRsZXQgcmFuZ2VTdGFydDogbnVtYmVyO1xuXHRsZXQgcmFuZ2VFbmQ6IG51bWJlcjtcblx0aWYgKHJhbmdlKSB7XG5cdFx0cmFuZ2VTdGFydCA9IHJhbmdlLm9mZnNldDtcblx0XHRyYW5nZUVuZCA9IHJhbmdlU3RhcnQgKyByYW5nZS5sZW5ndGg7XG5cblx0XHRmb3JtYXRUZXh0U3RhcnQgPSByYW5nZVN0YXJ0O1xuXHRcdHdoaWxlIChmb3JtYXRUZXh0U3RhcnQgPiAwICYmICFpc0VPTChkb2N1bWVudFRleHQsIGZvcm1hdFRleHRTdGFydCAtIDEpKSB7XG5cdFx0XHRmb3JtYXRUZXh0U3RhcnQtLTtcblx0XHR9XG5cdFx0bGV0IGVuZE9mZnNldCA9IHJhbmdlRW5kO1xuXHRcdHdoaWxlIChlbmRPZmZzZXQgPCBkb2N1bWVudFRleHQubGVuZ3RoICYmICFpc0VPTChkb2N1bWVudFRleHQsIGVuZE9mZnNldCkpIHtcblx0XHRcdGVuZE9mZnNldCsrO1xuXHRcdH1cblx0XHRmb3JtYXRUZXh0ID0gZG9jdW1lbnRUZXh0LnN1YnN0cmluZyhmb3JtYXRUZXh0U3RhcnQsIGVuZE9mZnNldCk7XG5cdFx0aW5pdGlhbEluZGVudExldmVsID0gY29tcHV0ZUluZGVudExldmVsKGZvcm1hdFRleHQsIG9wdGlvbnMpO1xuXHR9IGVsc2Uge1xuXHRcdGZvcm1hdFRleHQgPSBkb2N1bWVudFRleHQ7XG5cdFx0aW5pdGlhbEluZGVudExldmVsID0gMDtcblx0XHRmb3JtYXRUZXh0U3RhcnQgPSAwO1xuXHRcdHJhbmdlU3RhcnQgPSAwO1xuXHRcdHJhbmdlRW5kID0gZG9jdW1lbnRUZXh0Lmxlbmd0aDtcblx0fVxuXHRjb25zdCBlb2wgPSBnZXRFT0wob3B0aW9ucywgZG9jdW1lbnRUZXh0KTtcblxuXHRsZXQgbGluZUJyZWFrID0gZmFsc2U7XG5cdGxldCBpbmRlbnRMZXZlbCA9IDA7XG5cdGxldCBpbmRlbnRWYWx1ZTogc3RyaW5nO1xuXHRpZiAob3B0aW9ucy5pbnNlcnRTcGFjZXMpIHtcblx0XHRpbmRlbnRWYWx1ZSA9IHJlcGVhdCgnICcsIG9wdGlvbnMudGFiU2l6ZSB8fCA0KTtcblx0fSBlbHNlIHtcblx0XHRpbmRlbnRWYWx1ZSA9ICdcXHQnO1xuXHR9XG5cblx0Y29uc3Qgc2Nhbm5lciA9IGNyZWF0ZVNjYW5uZXIoZm9ybWF0VGV4dCwgZmFsc2UpO1xuXHRsZXQgaGFzRXJyb3IgPSBmYWxzZTtcblxuXHRmdW5jdGlvbiBuZXdMaW5lQW5kSW5kZW50KCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGVvbCArIHJlcGVhdChpbmRlbnRWYWx1ZSwgaW5pdGlhbEluZGVudExldmVsICsgaW5kZW50TGV2ZWwpO1xuXHR9XG5cdGZ1bmN0aW9uIHNjYW5OZXh0KCk6IFN5bnRheEtpbmQge1xuXHRcdGxldCB0b2tlbiA9IHNjYW5uZXIuc2NhbigpO1xuXHRcdGxpbmVCcmVhayA9IGZhbHNlO1xuXHRcdHdoaWxlICh0b2tlbiA9PT0gU3ludGF4S2luZC5Ucml2aWEgfHwgdG9rZW4gPT09IFN5bnRheEtpbmQuTGluZUJyZWFrVHJpdmlhKSB7XG5cdFx0XHRsaW5lQnJlYWsgPSBsaW5lQnJlYWsgfHwgKHRva2VuID09PSBTeW50YXhLaW5kLkxpbmVCcmVha1RyaXZpYSk7XG5cdFx0XHR0b2tlbiA9IHNjYW5uZXIuc2NhbigpO1xuXHRcdH1cblx0XHRoYXNFcnJvciA9IHRva2VuID09PSBTeW50YXhLaW5kLlVua25vd24gfHwgc2Nhbm5lci5nZXRUb2tlbkVycm9yKCkgIT09IFNjYW5FcnJvci5Ob25lO1xuXHRcdHJldHVybiB0b2tlbjtcblx0fVxuXHRjb25zdCBlZGl0T3BlcmF0aW9uczogRWRpdFtdID0gW107XG5cdGZ1bmN0aW9uIGFkZEVkaXQodGV4dDogc3RyaW5nLCBzdGFydE9mZnNldDogbnVtYmVyLCBlbmRPZmZzZXQ6IG51bWJlcikge1xuXHRcdGlmICghaGFzRXJyb3IgJiYgc3RhcnRPZmZzZXQgPCByYW5nZUVuZCAmJiBlbmRPZmZzZXQgPiByYW5nZVN0YXJ0ICYmIGRvY3VtZW50VGV4dC5zdWJzdHJpbmcoc3RhcnRPZmZzZXQsIGVuZE9mZnNldCkgIT09IHRleHQpIHtcblx0XHRcdGVkaXRPcGVyYXRpb25zLnB1c2goeyBvZmZzZXQ6IHN0YXJ0T2Zmc2V0LCBsZW5ndGg6IGVuZE9mZnNldCAtIHN0YXJ0T2Zmc2V0LCBjb250ZW50OiB0ZXh0IH0pO1xuXHRcdH1cblx0fVxuXG5cdGxldCBmaXJzdFRva2VuID0gc2Nhbk5leHQoKTtcblxuXHRpZiAoZmlyc3RUb2tlbiAhPT0gU3ludGF4S2luZC5FT0YpIHtcblx0XHRjb25zdCBmaXJzdFRva2VuU3RhcnQgPSBzY2FubmVyLmdldFRva2VuT2Zmc2V0KCkgKyBmb3JtYXRUZXh0U3RhcnQ7XG5cdFx0Y29uc3QgaW5pdGlhbEluZGVudCA9IHJlcGVhdChpbmRlbnRWYWx1ZSwgaW5pdGlhbEluZGVudExldmVsKTtcblx0XHRhZGRFZGl0KGluaXRpYWxJbmRlbnQsIGZvcm1hdFRleHRTdGFydCwgZmlyc3RUb2tlblN0YXJ0KTtcblx0fVxuXG5cdHdoaWxlIChmaXJzdFRva2VuICE9PSBTeW50YXhLaW5kLkVPRikge1xuXHRcdGxldCBmaXJzdFRva2VuRW5kID0gc2Nhbm5lci5nZXRUb2tlbk9mZnNldCgpICsgc2Nhbm5lci5nZXRUb2tlbkxlbmd0aCgpICsgZm9ybWF0VGV4dFN0YXJ0O1xuXHRcdGxldCBzZWNvbmRUb2tlbiA9IHNjYW5OZXh0KCk7XG5cblx0XHRsZXQgcmVwbGFjZUNvbnRlbnQgPSAnJztcblx0XHR3aGlsZSAoIWxpbmVCcmVhayAmJiAoc2Vjb25kVG9rZW4gPT09IFN5bnRheEtpbmQuTGluZUNvbW1lbnRUcml2aWEgfHwgc2Vjb25kVG9rZW4gPT09IFN5bnRheEtpbmQuQmxvY2tDb21tZW50VHJpdmlhKSkge1xuXHRcdFx0Ly8gY29tbWVudHMgb24gdGhlIHNhbWUgbGluZToga2VlcCB0aGVtIG9uIHRoZSBzYW1lIGxpbmUsIGJ1dCBpZ25vcmUgdGhlbSBvdGhlcndpc2Vcblx0XHRcdGNvbnN0IGNvbW1lbnRUb2tlblN0YXJ0ID0gc2Nhbm5lci5nZXRUb2tlbk9mZnNldCgpICsgZm9ybWF0VGV4dFN0YXJ0O1xuXHRcdFx0YWRkRWRpdCgnICcsIGZpcnN0VG9rZW5FbmQsIGNvbW1lbnRUb2tlblN0YXJ0KTtcblx0XHRcdGZpcnN0VG9rZW5FbmQgPSBzY2FubmVyLmdldFRva2VuT2Zmc2V0KCkgKyBzY2FubmVyLmdldFRva2VuTGVuZ3RoKCkgKyBmb3JtYXRUZXh0U3RhcnQ7XG5cdFx0XHRyZXBsYWNlQ29udGVudCA9IHNlY29uZFRva2VuID09PSBTeW50YXhLaW5kLkxpbmVDb21tZW50VHJpdmlhID8gbmV3TGluZUFuZEluZGVudCgpIDogJyc7XG5cdFx0XHRzZWNvbmRUb2tlbiA9IHNjYW5OZXh0KCk7XG5cdFx0fVxuXG5cdFx0aWYgKHNlY29uZFRva2VuID09PSBTeW50YXhLaW5kLkNsb3NlQnJhY2VUb2tlbikge1xuXHRcdFx0aWYgKGZpcnN0VG9rZW4gIT09IFN5bnRheEtpbmQuT3BlbkJyYWNlVG9rZW4pIHtcblx0XHRcdFx0aW5kZW50TGV2ZWwtLTtcblx0XHRcdFx0cmVwbGFjZUNvbnRlbnQgPSBuZXdMaW5lQW5kSW5kZW50KCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChzZWNvbmRUb2tlbiA9PT0gU3ludGF4S2luZC5DbG9zZUJyYWNrZXRUb2tlbikge1xuXHRcdFx0aWYgKGZpcnN0VG9rZW4gIT09IFN5bnRheEtpbmQuT3BlbkJyYWNrZXRUb2tlbikge1xuXHRcdFx0XHRpbmRlbnRMZXZlbC0tO1xuXHRcdFx0XHRyZXBsYWNlQ29udGVudCA9IG5ld0xpbmVBbmRJbmRlbnQoKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0c3dpdGNoIChmaXJzdFRva2VuKSB7XG5cdFx0XHRcdGNhc2UgU3ludGF4S2luZC5PcGVuQnJhY2tldFRva2VuOlxuXHRcdFx0XHRjYXNlIFN5bnRheEtpbmQuT3BlbkJyYWNlVG9rZW46XG5cdFx0XHRcdFx0aW5kZW50TGV2ZWwrKztcblx0XHRcdFx0XHRyZXBsYWNlQ29udGVudCA9IG5ld0xpbmVBbmRJbmRlbnQoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBTeW50YXhLaW5kLkNvbW1hVG9rZW46XG5cdFx0XHRcdGNhc2UgU3ludGF4S2luZC5MaW5lQ29tbWVudFRyaXZpYTpcblx0XHRcdFx0XHRyZXBsYWNlQ29udGVudCA9IG5ld0xpbmVBbmRJbmRlbnQoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBTeW50YXhLaW5kLkJsb2NrQ29tbWVudFRyaXZpYTpcblx0XHRcdFx0XHRpZiAobGluZUJyZWFrKSB7XG5cdFx0XHRcdFx0XHRyZXBsYWNlQ29udGVudCA9IG5ld0xpbmVBbmRJbmRlbnQoKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gc3ltYm9sIGZvbGxvd2luZyBjb21tZW50IG9uIHRoZSBzYW1lIGxpbmU6IGtlZXAgb24gc2FtZSBsaW5lLCBzZXBhcmF0ZSB3aXRoICcgJ1xuXHRcdFx0XHRcdFx0cmVwbGFjZUNvbnRlbnQgPSAnICc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFN5bnRheEtpbmQuQ29sb25Ub2tlbjpcblx0XHRcdFx0XHRyZXBsYWNlQ29udGVudCA9ICcgJztcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBTeW50YXhLaW5kLlN0cmluZ0xpdGVyYWw6XG5cdFx0XHRcdFx0aWYgKHNlY29uZFRva2VuID09PSBTeW50YXhLaW5kLkNvbG9uVG9rZW4pIHtcblx0XHRcdFx0XHRcdHJlcGxhY2VDb250ZW50ID0gJyc7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdC8vIGZhbGwgdGhyb3VnaFxuXHRcdFx0XHRjYXNlIFN5bnRheEtpbmQuTnVsbEtleXdvcmQ6XG5cdFx0XHRcdGNhc2UgU3ludGF4S2luZC5UcnVlS2V5d29yZDpcblx0XHRcdFx0Y2FzZSBTeW50YXhLaW5kLkZhbHNlS2V5d29yZDpcblx0XHRcdFx0Y2FzZSBTeW50YXhLaW5kLk51bWVyaWNMaXRlcmFsOlxuXHRcdFx0XHRjYXNlIFN5bnRheEtpbmQuQ2xvc2VCcmFjZVRva2VuOlxuXHRcdFx0XHRjYXNlIFN5bnRheEtpbmQuQ2xvc2VCcmFja2V0VG9rZW46XG5cdFx0XHRcdFx0aWYgKHNlY29uZFRva2VuID09PSBTeW50YXhLaW5kLkxpbmVDb21tZW50VHJpdmlhIHx8IHNlY29uZFRva2VuID09PSBTeW50YXhLaW5kLkJsb2NrQ29tbWVudFRyaXZpYSkge1xuXHRcdFx0XHRcdFx0cmVwbGFjZUNvbnRlbnQgPSAnICc7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzZWNvbmRUb2tlbiAhPT0gU3ludGF4S2luZC5Db21tYVRva2VuICYmIHNlY29uZFRva2VuICE9PSBTeW50YXhLaW5kLkVPRikge1xuXHRcdFx0XHRcdFx0aGFzRXJyb3IgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBTeW50YXhLaW5kLlVua25vd246XG5cdFx0XHRcdFx0aGFzRXJyb3IgPSB0cnVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGxpbmVCcmVhayAmJiAoc2Vjb25kVG9rZW4gPT09IFN5bnRheEtpbmQuTGluZUNvbW1lbnRUcml2aWEgfHwgc2Vjb25kVG9rZW4gPT09IFN5bnRheEtpbmQuQmxvY2tDb21tZW50VHJpdmlhKSkge1xuXHRcdFx0XHRyZXBsYWNlQ29udGVudCA9IG5ld0xpbmVBbmRJbmRlbnQoKTtcblx0XHRcdH1cblxuXHRcdH1cblx0XHRjb25zdCBzZWNvbmRUb2tlblN0YXJ0ID0gc2Nhbm5lci5nZXRUb2tlbk9mZnNldCgpICsgZm9ybWF0VGV4dFN0YXJ0O1xuXHRcdGFkZEVkaXQocmVwbGFjZUNvbnRlbnQsIGZpcnN0VG9rZW5FbmQsIHNlY29uZFRva2VuU3RhcnQpO1xuXHRcdGZpcnN0VG9rZW4gPSBzZWNvbmRUb2tlbjtcblx0fVxuXHRyZXR1cm4gZWRpdE9wZXJhdGlvbnM7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZvcm1hdHRlZCBzdHJpbmcgb3V0IG9mIHRoZSBvYmplY3QgcGFzc2VkIGFzIGFyZ3VtZW50LCB1c2luZyB0aGUgZ2l2ZW4gZm9ybWF0dGluZyBvcHRpb25zXG4gKiBAcGFyYW0gYW55IFRoZSBvYmplY3QgdG8gc3RyaW5naWZ5IGFuZCBmb3JtYXRcbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBmb3JtYXR0aW5nIG9wdGlvbnMgdG8gdXNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b0Zvcm1hdHRlZFN0cmluZyhvYmo6IGFueSwgb3B0aW9uczogRm9ybWF0dGluZ09wdGlvbnMpIHtcblx0Y29uc3QgY29udGVudCA9IEpTT04uc3RyaW5naWZ5KG9iaiwgdW5kZWZpbmVkLCBvcHRpb25zLmluc2VydFNwYWNlcyA/IG9wdGlvbnMudGFiU2l6ZSB8fCA0IDogJ1xcdCcpO1xuXHRpZiAob3B0aW9ucy5lb2wgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjb250ZW50LnJlcGxhY2UoL1xcclxcbnxcXHJ8XFxuL2csIG9wdGlvbnMuZW9sKTtcblx0fVxuXHRyZXR1cm4gY29udGVudDtcbn1cblxuZnVuY3Rpb24gcmVwZWF0KHM6IHN0cmluZywgY291bnQ6IG51bWJlcik6IHN0cmluZyB7XG5cdGxldCByZXN1bHQgPSAnJztcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG5cdFx0cmVzdWx0ICs9IHM7XG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZUluZGVudExldmVsKGNvbnRlbnQ6IHN0cmluZywgb3B0aW9uczogRm9ybWF0dGluZ09wdGlvbnMpOiBudW1iZXIge1xuXHRsZXQgaSA9IDA7XG5cdGxldCBuQ2hhcnMgPSAwO1xuXHRjb25zdCB0YWJTaXplID0gb3B0aW9ucy50YWJTaXplIHx8IDQ7XG5cdHdoaWxlIChpIDwgY29udGVudC5sZW5ndGgpIHtcblx0XHRjb25zdCBjaCA9IGNvbnRlbnQuY2hhckF0KGkpO1xuXHRcdGlmIChjaCA9PT0gJyAnKSB7XG5cdFx0XHRuQ2hhcnMrKztcblx0XHR9IGVsc2UgaWYgKGNoID09PSAnXFx0Jykge1xuXHRcdFx0bkNoYXJzICs9IHRhYlNpemU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRpKys7XG5cdH1cblx0cmV0dXJuIE1hdGguZmxvb3IobkNoYXJzIC8gdGFiU2l6ZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRFT0wob3B0aW9uczogRm9ybWF0dGluZ09wdGlvbnMsIHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IGNoID0gdGV4dC5jaGFyQXQoaSk7XG5cdFx0aWYgKGNoID09PSAnXFxyJykge1xuXHRcdFx0aWYgKGkgKyAxIDwgdGV4dC5sZW5ndGggJiYgdGV4dC5jaGFyQXQoaSArIDEpID09PSAnXFxuJykge1xuXHRcdFx0XHRyZXR1cm4gJ1xcclxcbic7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gJ1xccic7XG5cdFx0fSBlbHNlIGlmIChjaCA9PT0gJ1xcbicpIHtcblx0XHRcdHJldHVybiAnXFxuJztcblx0XHR9XG5cdH1cblx0cmV0dXJuIChvcHRpb25zICYmIG9wdGlvbnMuZW9sKSB8fCAnXFxuJztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRU9MKHRleHQ6IHN0cmluZywgb2Zmc2V0OiBudW1iZXIpIHtcblx0cmV0dXJuICdcXHJcXG4nLmluZGV4T2YodGV4dC5jaGFyQXQob2Zmc2V0KSkgIT09IC0xO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxlQUFlLFdBQVcsa0JBQWtCO0FBa0Q5QyxTQUFTLE9BQU8sY0FBc0IsT0FBMEIsU0FBb0M7QUFDMUcsTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJLE9BQU87QUFDVixpQkFBYSxNQUFNO0FBQ25CLGVBQVcsYUFBYSxNQUFNO0FBRTlCLHNCQUFrQjtBQUNsQixXQUFPLGtCQUFrQixLQUFLLENBQUMsTUFBTSxjQUFjLGtCQUFrQixD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
