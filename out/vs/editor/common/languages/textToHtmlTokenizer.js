import { CharCode } from "../../../base/common/charCode.js";
import * as strings from "../../../base/common/strings.js";
import { LineTokens } from "../tokens/lineTokens.js";
import { TokenizationRegistry } from "../languages.js";
import { LanguageId } from "../encodedTokenAttributes.js";
import { NullState, nullTokenizeEncoded } from "./nullTokenize.js";
const fallback = {
  getInitialState: () => NullState,
  tokenizeEncoded: (buffer, hasEOL, state) => nullTokenizeEncoded(LanguageId.Null, state)
};
function tokenizeToStringSync(languageService, text, languageId) {
  return _tokenizeToString(text, languageService.languageIdCodec, TokenizationRegistry.get(languageId) || fallback);
}
async function tokenizeToString(languageService, text, languageId) {
  if (!languageId) {
    return _tokenizeToString(text, languageService.languageIdCodec, fallback);
  }
  const tokenizationSupport = await TokenizationRegistry.getOrCreate(languageId);
  return _tokenizeToString(text, languageService.languageIdCodec, tokenizationSupport || fallback);
}
function tokenizeLineToHTML(text, viewLineTokens, colorMap, startOffset, endOffset, tabSize, useNbsp) {
  let result = `<div>`;
  let charIndex = startOffset;
  let tabsCharDelta = 0;
  let prevIsSpace = true;
  for (let tokenIndex = 0, tokenCount = viewLineTokens.getCount(); tokenIndex < tokenCount; tokenIndex++) {
    const tokenEndIndex = viewLineTokens.getEndOffset(tokenIndex);
    if (tokenEndIndex <= startOffset) {
      continue;
    }
    let partContent = "";
    for (; charIndex < tokenEndIndex && charIndex < endOffset; charIndex++) {
      const charCode = text.charCodeAt(charIndex);
      switch (charCode) {
        case CharCode.Tab: {
          let insertSpacesCount = tabSize - (charIndex + tabsCharDelta) % tabSize;
          tabsCharDelta += insertSpacesCount - 1;
          while (insertSpacesCount > 0) {
            if (useNbsp && prevIsSpace) {
              partContent += "&#160;";
              prevIsSpace = false;
            } else {
              partContent += " ";
              prevIsSpace = true;
            }
            insertSpacesCount--;
          }
          break;
        }
        case CharCode.LessThan:
          partContent += "&lt;";
          prevIsSpace = false;
          break;
        case CharCode.GreaterThan:
          partContent += "&gt;";
          prevIsSpace = false;
          break;
        case CharCode.Ampersand:
          partContent += "&amp;";
          prevIsSpace = false;
          break;
        case CharCode.Null:
          partContent += "&#00;";
          prevIsSpace = false;
          break;
        case CharCode.UTF8_BOM:
        case CharCode.LINE_SEPARATOR:
        case CharCode.PARAGRAPH_SEPARATOR:
        case CharCode.NEXT_LINE:
          partContent += "\uFFFD";
          prevIsSpace = false;
          break;
        case CharCode.CarriageReturn:
          partContent += "&#8203";
          prevIsSpace = false;
          break;
        case CharCode.Space:
          if (useNbsp && prevIsSpace) {
            partContent += "&#160;";
            prevIsSpace = false;
          } else {
            partContent += " ";
            prevIsSpace = true;
          }
          break;
        default:
          partContent += String.fromCharCode(charCode);
          prevIsSpace = false;
      }
    }
    result += `<span style="${viewLineTokens.getInlineStyle(tokenIndex, colorMap)}">${partContent}</span>`;
    if (tokenEndIndex > endOffset || charIndex >= endOffset) {
      break;
    }
  }
  result += `</div>`;
  return result;
}
function _tokenizeToString(text, languageIdCodec, tokenizationSupport) {
  let result = `<div class="monaco-tokenized-source">`;
  const lines = strings.splitLines(text);
  let currentState = tokenizationSupport.getInitialState();
  for (let i = 0, len = lines.length; i < len; i++) {
    const line = lines[i];
    if (i > 0) {
      result += `<br/>`;
    }
    const tokenizationResult = tokenizationSupport.tokenizeEncoded(line, true, currentState);
    LineTokens.convertToEndOffset(tokenizationResult.tokens, line.length);
    const lineTokens = new LineTokens(tokenizationResult.tokens, line, languageIdCodec);
    const viewLineTokens = lineTokens.inflate();
    let startOffset = 0;
    for (let j = 0, lenJ = viewLineTokens.getCount(); j < lenJ; j++) {
      const type = viewLineTokens.getClassName(j);
      const endIndex = viewLineTokens.getEndOffset(j);
      result += `<span class="${type}">${strings.escape(line.substring(startOffset, endIndex))}</span>`;
      startOffset = endIndex;
    }
    currentState = tokenizationResult.endState;
  }
  result += `</div>`;
  return result;
}
export {
  _tokenizeToString,
  tokenizeLineToHTML,
  tokenizeToString,
  tokenizeToStringSync
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy90ZXh0VG9IdG1sVG9rZW5pemVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2hhckNvZGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jaGFyQ29kZS5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgSVZpZXdMaW5lVG9rZW5zLCBMaW5lVG9rZW5zIH0gZnJvbSAnLi4vdG9rZW5zL2xpbmVUb2tlbnMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlSWRDb2RlYywgSVN0YXRlLCBJVG9rZW5pemF0aW9uU3VwcG9ydCwgVG9rZW5pemF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VJZCB9IGZyb20gJy4uL2VuY29kZWRUb2tlbkF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHsgTnVsbFN0YXRlLCBudWxsVG9rZW5pemVFbmNvZGVkIH0gZnJvbSAnLi9udWxsVG9rZW5pemUuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4vbGFuZ3VhZ2UuanMnO1xuXG5leHBvcnQgdHlwZSBJUmVkdWNlZFRva2VuaXphdGlvblN1cHBvcnQgPSBPbWl0PElUb2tlbml6YXRpb25TdXBwb3J0LCAndG9rZW5pemUnPjtcblxuY29uc3QgZmFsbGJhY2s6IElSZWR1Y2VkVG9rZW5pemF0aW9uU3VwcG9ydCA9IHtcblx0Z2V0SW5pdGlhbFN0YXRlOiAoKSA9PiBOdWxsU3RhdGUsXG5cdHRva2VuaXplRW5jb2RlZDogKGJ1ZmZlcjogc3RyaW5nLCBoYXNFT0w6IGJvb2xlYW4sIHN0YXRlOiBJU3RhdGUpID0+IG51bGxUb2tlbml6ZUVuY29kZWQoTGFuZ3VhZ2VJZC5OdWxsLCBzdGF0ZSlcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiB0b2tlbml6ZVRvU3RyaW5nU3luYyhsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsIHRleHQ6IHN0cmluZywgbGFuZ3VhZ2VJZDogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIF90b2tlbml6ZVRvU3RyaW5nKHRleHQsIGxhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMsIFRva2VuaXphdGlvblJlZ2lzdHJ5LmdldChsYW5ndWFnZUlkKSB8fCBmYWxsYmFjayk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB0b2tlbml6ZVRvU3RyaW5nKGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSwgdGV4dDogc3RyaW5nLCBsYW5ndWFnZUlkOiBzdHJpbmcgfCBudWxsKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0aWYgKCFsYW5ndWFnZUlkKSB7XG5cdFx0cmV0dXJuIF90b2tlbml6ZVRvU3RyaW5nKHRleHQsIGxhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMsIGZhbGxiYWNrKTtcblx0fVxuXHRjb25zdCB0b2tlbml6YXRpb25TdXBwb3J0ID0gYXdhaXQgVG9rZW5pemF0aW9uUmVnaXN0cnkuZ2V0T3JDcmVhdGUobGFuZ3VhZ2VJZCk7XG5cdHJldHVybiBfdG9rZW5pemVUb1N0cmluZyh0ZXh0LCBsYW5ndWFnZVNlcnZpY2UubGFuZ3VhZ2VJZENvZGVjLCB0b2tlbml6YXRpb25TdXBwb3J0IHx8IGZhbGxiYWNrKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRva2VuaXplTGluZVRvSFRNTCh0ZXh0OiBzdHJpbmcsIHZpZXdMaW5lVG9rZW5zOiBJVmlld0xpbmVUb2tlbnMsIGNvbG9yTWFwOiBzdHJpbmdbXSwgc3RhcnRPZmZzZXQ6IG51bWJlciwgZW5kT2Zmc2V0OiBudW1iZXIsIHRhYlNpemU6IG51bWJlciwgdXNlTmJzcDogYm9vbGVhbik6IHN0cmluZyB7XG5cdGxldCByZXN1bHQgPSBgPGRpdj5gO1xuXHRsZXQgY2hhckluZGV4ID0gc3RhcnRPZmZzZXQ7XG5cdGxldCB0YWJzQ2hhckRlbHRhID0gMDtcblxuXHRsZXQgcHJldklzU3BhY2UgPSB0cnVlO1xuXG5cdGZvciAobGV0IHRva2VuSW5kZXggPSAwLCB0b2tlbkNvdW50ID0gdmlld0xpbmVUb2tlbnMuZ2V0Q291bnQoKTsgdG9rZW5JbmRleCA8IHRva2VuQ291bnQ7IHRva2VuSW5kZXgrKykge1xuXHRcdGNvbnN0IHRva2VuRW5kSW5kZXggPSB2aWV3TGluZVRva2Vucy5nZXRFbmRPZmZzZXQodG9rZW5JbmRleCk7XG5cblx0XHRpZiAodG9rZW5FbmRJbmRleCA8PSBzdGFydE9mZnNldCkge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0bGV0IHBhcnRDb250ZW50ID0gJyc7XG5cblx0XHRmb3IgKDsgY2hhckluZGV4IDwgdG9rZW5FbmRJbmRleCAmJiBjaGFySW5kZXggPCBlbmRPZmZzZXQ7IGNoYXJJbmRleCsrKSB7XG5cdFx0XHRjb25zdCBjaGFyQ29kZSA9IHRleHQuY2hhckNvZGVBdChjaGFySW5kZXgpO1xuXG5cdFx0XHRzd2l0Y2ggKGNoYXJDb2RlKSB7XG5cdFx0XHRcdGNhc2UgQ2hhckNvZGUuVGFiOiB7XG5cdFx0XHRcdFx0bGV0IGluc2VydFNwYWNlc0NvdW50ID0gdGFiU2l6ZSAtIChjaGFySW5kZXggKyB0YWJzQ2hhckRlbHRhKSAlIHRhYlNpemU7XG5cdFx0XHRcdFx0dGFic0NoYXJEZWx0YSArPSBpbnNlcnRTcGFjZXNDb3VudCAtIDE7XG5cdFx0XHRcdFx0d2hpbGUgKGluc2VydFNwYWNlc0NvdW50ID4gMCkge1xuXHRcdFx0XHRcdFx0aWYgKHVzZU5ic3AgJiYgcHJldklzU3BhY2UpIHtcblx0XHRcdFx0XHRcdFx0cGFydENvbnRlbnQgKz0gJyYjMTYwOyc7XG5cdFx0XHRcdFx0XHRcdHByZXZJc1NwYWNlID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRwYXJ0Q29udGVudCArPSAnICc7XG5cdFx0XHRcdFx0XHRcdHByZXZJc1NwYWNlID0gdHJ1ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGluc2VydFNwYWNlc0NvdW50LS07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgQ2hhckNvZGUuTGVzc1RoYW46XG5cdFx0XHRcdFx0cGFydENvbnRlbnQgKz0gJyZsdDsnO1xuXHRcdFx0XHRcdHByZXZJc1NwYWNlID0gZmFsc2U7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5HcmVhdGVyVGhhbjpcblx0XHRcdFx0XHRwYXJ0Q29udGVudCArPSAnJmd0Oyc7XG5cdFx0XHRcdFx0cHJldklzU3BhY2UgPSBmYWxzZTtcblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlIENoYXJDb2RlLkFtcGVyc2FuZDpcblx0XHRcdFx0XHRwYXJ0Q29udGVudCArPSAnJmFtcDsnO1xuXHRcdFx0XHRcdHByZXZJc1NwYWNlID0gZmFsc2U7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5OdWxsOlxuXHRcdFx0XHRcdHBhcnRDb250ZW50ICs9ICcmIzAwOyc7XG5cdFx0XHRcdFx0cHJldklzU3BhY2UgPSBmYWxzZTtcblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlIENoYXJDb2RlLlVURjhfQk9NOlxuXHRcdFx0XHRjYXNlIENoYXJDb2RlLkxJTkVfU0VQQVJBVE9SOlxuXHRcdFx0XHRjYXNlIENoYXJDb2RlLlBBUkFHUkFQSF9TRVBBUkFUT1I6XG5cdFx0XHRcdGNhc2UgQ2hhckNvZGUuTkVYVF9MSU5FOlxuXHRcdFx0XHRcdHBhcnRDb250ZW50ICs9ICdcXHVmZmZkJztcblx0XHRcdFx0XHRwcmV2SXNTcGFjZSA9IGZhbHNlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2UgQ2hhckNvZGUuQ2FycmlhZ2VSZXR1cm46XG5cdFx0XHRcdFx0Ly8gemVybyB3aWR0aCBzcGFjZSwgYmVjYXVzZSBjYXJyaWFnZSByZXR1cm4gd291bGQgaW50cm9kdWNlIGEgbGluZSBicmVha1xuXHRcdFx0XHRcdHBhcnRDb250ZW50ICs9ICcmIzgyMDMnO1xuXHRcdFx0XHRcdHByZXZJc1NwYWNlID0gZmFsc2U7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5TcGFjZTpcblx0XHRcdFx0XHRpZiAodXNlTmJzcCAmJiBwcmV2SXNTcGFjZSkge1xuXHRcdFx0XHRcdFx0cGFydENvbnRlbnQgKz0gJyYjMTYwOyc7XG5cdFx0XHRcdFx0XHRwcmV2SXNTcGFjZSA9IGZhbHNlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRwYXJ0Q29udGVudCArPSAnICc7XG5cdFx0XHRcdFx0XHRwcmV2SXNTcGFjZSA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0cGFydENvbnRlbnQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShjaGFyQ29kZSk7XG5cdFx0XHRcdFx0cHJldklzU3BhY2UgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXN1bHQgKz0gYDxzcGFuIHN0eWxlPVwiJHt2aWV3TGluZVRva2Vucy5nZXRJbmxpbmVTdHlsZSh0b2tlbkluZGV4LCBjb2xvck1hcCl9XCI+JHtwYXJ0Q29udGVudH08L3NwYW4+YDtcblxuXHRcdGlmICh0b2tlbkVuZEluZGV4ID4gZW5kT2Zmc2V0IHx8IGNoYXJJbmRleCA+PSBlbmRPZmZzZXQpIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdHJlc3VsdCArPSBgPC9kaXY+YDtcblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF90b2tlbml6ZVRvU3RyaW5nKHRleHQ6IHN0cmluZywgbGFuZ3VhZ2VJZENvZGVjOiBJTGFuZ3VhZ2VJZENvZGVjLCB0b2tlbml6YXRpb25TdXBwb3J0OiBJUmVkdWNlZFRva2VuaXphdGlvblN1cHBvcnQpOiBzdHJpbmcge1xuXHRsZXQgcmVzdWx0ID0gYDxkaXYgY2xhc3M9XCJtb25hY28tdG9rZW5pemVkLXNvdXJjZVwiPmA7XG5cdGNvbnN0IGxpbmVzID0gc3RyaW5ncy5zcGxpdExpbmVzKHRleHQpO1xuXHRsZXQgY3VycmVudFN0YXRlID0gdG9rZW5pemF0aW9uU3VwcG9ydC5nZXRJbml0aWFsU3RhdGUoKTtcblx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGxpbmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0Y29uc3QgbGluZSA9IGxpbmVzW2ldO1xuXG5cdFx0aWYgKGkgPiAwKSB7XG5cdFx0XHRyZXN1bHQgKz0gYDxici8+YDtcblx0XHR9XG5cblx0XHRjb25zdCB0b2tlbml6YXRpb25SZXN1bHQgPSB0b2tlbml6YXRpb25TdXBwb3J0LnRva2VuaXplRW5jb2RlZChsaW5lLCB0cnVlLCBjdXJyZW50U3RhdGUpO1xuXHRcdExpbmVUb2tlbnMuY29udmVydFRvRW5kT2Zmc2V0KHRva2VuaXphdGlvblJlc3VsdC50b2tlbnMsIGxpbmUubGVuZ3RoKTtcblx0XHRjb25zdCBsaW5lVG9rZW5zID0gbmV3IExpbmVUb2tlbnModG9rZW5pemF0aW9uUmVzdWx0LnRva2VucywgbGluZSwgbGFuZ3VhZ2VJZENvZGVjKTtcblx0XHRjb25zdCB2aWV3TGluZVRva2VucyA9IGxpbmVUb2tlbnMuaW5mbGF0ZSgpO1xuXG5cdFx0bGV0IHN0YXJ0T2Zmc2V0ID0gMDtcblx0XHRmb3IgKGxldCBqID0gMCwgbGVuSiA9IHZpZXdMaW5lVG9rZW5zLmdldENvdW50KCk7IGogPCBsZW5KOyBqKyspIHtcblx0XHRcdGNvbnN0IHR5cGUgPSB2aWV3TGluZVRva2Vucy5nZXRDbGFzc05hbWUoaik7XG5cdFx0XHRjb25zdCBlbmRJbmRleCA9IHZpZXdMaW5lVG9rZW5zLmdldEVuZE9mZnNldChqKTtcblx0XHRcdHJlc3VsdCArPSBgPHNwYW4gY2xhc3M9XCIke3R5cGV9XCI+JHtzdHJpbmdzLmVzY2FwZShsaW5lLnN1YnN0cmluZyhzdGFydE9mZnNldCwgZW5kSW5kZXgpKX08L3NwYW4+YDtcblx0XHRcdHN0YXJ0T2Zmc2V0ID0gZW5kSW5kZXg7XG5cdFx0fVxuXG5cdFx0Y3VycmVudFN0YXRlID0gdG9rZW5pemF0aW9uUmVzdWx0LmVuZFN0YXRlO1xuXHR9XG5cblx0cmVzdWx0ICs9IGA8L2Rpdj5gO1xuXHRyZXR1cm4gcmVzdWx0O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFDekIsWUFBWSxhQUFhO0FBQ3pCLFNBQTBCLGtCQUFrQjtBQUM1QyxTQUF5RCw0QkFBNEI7QUFDckYsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxXQUFXLDJCQUEyQjtBQUsvQyxNQUFNLFdBQXdDO0FBQUEsRUFDN0MsaUJBQWlCLE1BQU07QUFBQSxFQUN2QixpQkFBaUIsQ0FBQyxRQUFnQixRQUFpQixVQUFrQixvQkFBb0IsV0FBVyxNQUFNLEtBQUs7QUFDaEg7QUFFTyxTQUFTLHFCQUFxQixpQkFBbUMsTUFBYyxZQUE0QjtBQUNqSCxTQUFPLGtCQUFrQixNQUFNLGdCQUFnQixpQkFBaUIscUJBQXFCLElBQUksVUFB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
