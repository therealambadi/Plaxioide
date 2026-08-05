import { Range } from "../../../../editor/common/core/range.js";
const getFileResults = (bytes, pattern, options) => {
  let text;
  if (bytes[0] === 255 && bytes[1] === 254) {
    text = new TextDecoder("utf-16le").decode(bytes);
  } else if (bytes[0] === 254 && bytes[1] === 255) {
    text = new TextDecoder("utf-16be").decode(bytes);
  } else {
    text = new TextDecoder("utf8").decode(bytes);
    if (text.slice(0, 1e3).includes("\uFFFD") && bytes.includes(0)) {
      return [];
    }
  }
  const results = [];
  const patternIndecies = [];
  let patternMatch = null;
  let remainingResultQuota = options.remainingResultQuota;
  while (remainingResultQuota >= 0 && (patternMatch = pattern.exec(text))) {
    patternIndecies.push({ matchStartIndex: patternMatch.index, matchedText: patternMatch[0] });
    remainingResultQuota--;
  }
  if (patternIndecies.length) {
    const contextLinesNeeded = /* @__PURE__ */ new Set();
    const resultLines = /* @__PURE__ */ new Set();
    const lineRanges = [];
    const readLine = (lineNumber) => text.slice(lineRanges[lineNumber].start, lineRanges[lineNumber].end);
    let prevLineEnd = 0;
    let lineEndingMatch = null;
    const lineEndRegex = /\r?\n/g;
    while (lineEndingMatch = lineEndRegex.exec(text)) {
      lineRanges.push({ start: prevLineEnd, end: lineEndingMatch.index });
      prevLineEnd = lineEndingMatch.index + lineEndingMatch[0].length;
    }
    if (prevLineEnd < text.length) {
      lineRanges.push({ start: prevLineEnd, end: text.length });
    }
    let startLine = 0;
    for (const { matchStartIndex, matchedText } of patternIndecies) {
      if (remainingResultQuota < 0) {
        break;
      }
      while (Boolean(lineRanges[startLine + 1]) && matchStartIndex > lineRanges[startLine].end) {
        startLine++;
      }
      let endLine = startLine;
      while (Boolean(lineRanges[endLine + 1]) && matchStartIndex + matchedText.length > lineRanges[endLine].end) {
        endLine++;
      }
      if (options.surroundingContext) {
        for (let contextLine = Math.max(0, startLine - options.surroundingContext); contextLine < startLine; contextLine++) {
          contextLinesNeeded.add(contextLine);
        }
      }
      let previewText = "";
      let offset = 0;
      for (let matchLine = startLine; matchLine <= endLine; matchLine++) {
        let previewLine = readLine(matchLine);
        if (options.previewOptions?.charsPerLine && previewLine.length > options.previewOptions.charsPerLine) {
          offset = Math.max(matchStartIndex - lineRanges[startLine].start - 20, 0);
          previewLine = previewLine.substr(offset, options.previewOptions.charsPerLine);
        }
        previewText += `${previewLine}
`;
        resultLines.add(matchLine);
      }
      const fileRange = new Range(
        startLine,
        matchStartIndex - lineRanges[startLine].start,
        endLine,
        matchStartIndex + matchedText.length - lineRanges[endLine].start
      );
      const previewRange = new Range(
        0,
        matchStartIndex - lineRanges[startLine].start - offset,
        endLine - startLine,
        matchStartIndex + matchedText.length - lineRanges[endLine].start - (endLine === startLine ? offset : 0)
      );
      const match = {
        rangeLocations: [{
          source: fileRange,
          preview: previewRange
        }],
        previewText
      };
      results.push(match);
      if (options.surroundingContext) {
        for (let contextLine = endLine + 1; contextLine <= Math.min(endLine + options.surroundingContext, lineRanges.length - 1); contextLine++) {
          contextLinesNeeded.add(contextLine);
        }
      }
    }
    for (const contextLine of contextLinesNeeded) {
      if (!resultLines.has(contextLine)) {
        results.push({
          text: readLine(contextLine),
          lineNumber: contextLine + 1
        });
      }
    }
  }
  return results;
};
export {
  getFileResults
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL2NvbW1vbi9nZXRGaWxlUmVzdWx0cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElUZXh0U2VhcmNoTWF0Y2gsIElUZXh0U2VhcmNoUHJldmlld09wdGlvbnMsIElUZXh0U2VhcmNoUmVzdWx0IH0gZnJvbSAnLi9zZWFyY2guanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuXG5leHBvcnQgY29uc3QgZ2V0RmlsZVJlc3VsdHMgPSAoXG5cdGJ5dGVzOiBVaW50OEFycmF5LFxuXHRwYXR0ZXJuOiBSZWdFeHAsXG5cdG9wdGlvbnM6IHtcblx0XHRzdXJyb3VuZGluZ0NvbnRleHQ6IG51bWJlcjtcblx0XHRwcmV2aWV3T3B0aW9uczogSVRleHRTZWFyY2hQcmV2aWV3T3B0aW9ucyB8IHVuZGVmaW5lZDtcblx0XHRyZW1haW5pbmdSZXN1bHRRdW90YTogbnVtYmVyO1xuXHR9XG4pOiBJVGV4dFNlYXJjaFJlc3VsdFtdID0+IHtcblxuXHRsZXQgdGV4dDogc3RyaW5nO1xuXHRpZiAoYnl0ZXNbMF0gPT09IDB4ZmYgJiYgYnl0ZXNbMV0gPT09IDB4ZmUpIHtcblx0XHR0ZXh0ID0gbmV3IFRleHREZWNvZGVyKCd1dGYtMTZsZScpLmRlY29kZShieXRlcyk7XG5cdH0gZWxzZSBpZiAoYnl0ZXNbMF0gPT09IDB4ZmUgJiYgYnl0ZXNbMV0gPT09IDB4ZmYpIHtcblx0XHR0ZXh0ID0gbmV3IFRleHREZWNvZGVyKCd1dGYtMTZiZScpLmRlY29kZShieXRlcyk7XG5cdH0gZWxzZSB7XG5cdFx0dGV4dCA9IG5ldyBUZXh0RGVjb2RlcigndXRmOCcpLmRlY29kZShieXRlcyk7XG5cdFx0aWYgKHRleHQuc2xpY2UoMCwgMTAwMCkuaW5jbHVkZXMoJ1xcdUZGRkQnKSAmJiBieXRlcy5pbmNsdWRlcygwKSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IHJlc3VsdHM6IElUZXh0U2VhcmNoUmVzdWx0W10gPSBbXTtcblxuXHRjb25zdCBwYXR0ZXJuSW5kZWNpZXM6IHsgbWF0Y2hTdGFydEluZGV4OiBudW1iZXI7IG1hdGNoZWRUZXh0OiBzdHJpbmcgfVtdID0gW107XG5cblx0bGV0IHBhdHRlcm5NYXRjaDogUmVnRXhwRXhlY0FycmF5IHwgbnVsbCA9IG51bGw7XG5cdGxldCByZW1haW5pbmdSZXN1bHRRdW90YSA9IG9wdGlvbnMucmVtYWluaW5nUmVzdWx0UXVvdGE7XG5cdHdoaWxlIChyZW1haW5pbmdSZXN1bHRRdW90YSA+PSAwICYmIChwYXR0ZXJuTWF0Y2ggPSBwYXR0ZXJuLmV4ZWModGV4dCkpKSB7XG5cdFx0cGF0dGVybkluZGVjaWVzLnB1c2goeyBtYXRjaFN0YXJ0SW5kZXg6IHBhdHRlcm5NYXRjaC5pbmRleCwgbWF0Y2hlZFRleHQ6IHBhdHRlcm5NYXRjaFswXSB9KTtcblx0XHRyZW1haW5pbmdSZXN1bHRRdW90YS0tO1xuXHR9XG5cblx0aWYgKHBhdHRlcm5JbmRlY2llcy5sZW5ndGgpIHtcblx0XHRjb25zdCBjb250ZXh0TGluZXNOZWVkZWQgPSBuZXcgU2V0PG51bWJlcj4oKTtcblx0XHRjb25zdCByZXN1bHRMaW5lcyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuXG5cdFx0Y29uc3QgbGluZVJhbmdlczogeyBzdGFydDogbnVtYmVyOyBlbmQ6IG51bWJlciB9W10gPSBbXTtcblx0XHRjb25zdCByZWFkTGluZSA9IChsaW5lTnVtYmVyOiBudW1iZXIpID0+IHRleHQuc2xpY2UobGluZVJhbmdlc1tsaW5lTnVtYmVyXS5zdGFydCwgbGluZVJhbmdlc1tsaW5lTnVtYmVyXS5lbmQpO1xuXG5cdFx0bGV0IHByZXZMaW5lRW5kID0gMDtcblx0XHRsZXQgbGluZUVuZGluZ01hdGNoOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsID0gbnVsbDtcblx0XHRjb25zdCBsaW5lRW5kUmVnZXggPSAvXFxyP1xcbi9nO1xuXHRcdHdoaWxlICgobGluZUVuZGluZ01hdGNoID0gbGluZUVuZFJlZ2V4LmV4ZWModGV4dCkpKSB7XG5cdFx0XHRsaW5lUmFuZ2VzLnB1c2goeyBzdGFydDogcHJldkxpbmVFbmQsIGVuZDogbGluZUVuZGluZ01hdGNoLmluZGV4IH0pO1xuXHRcdFx0cHJldkxpbmVFbmQgPSBsaW5lRW5kaW5nTWF0Y2guaW5kZXggKyBsaW5lRW5kaW5nTWF0Y2hbMF0ubGVuZ3RoO1xuXHRcdH1cblx0XHRpZiAocHJldkxpbmVFbmQgPCB0ZXh0Lmxlbmd0aCkgeyBsaW5lUmFuZ2VzLnB1c2goeyBzdGFydDogcHJldkxpbmVFbmQsIGVuZDogdGV4dC5sZW5ndGggfSk7IH1cblxuXHRcdGxldCBzdGFydExpbmUgPSAwO1xuXHRcdGZvciAoY29uc3QgeyBtYXRjaFN0YXJ0SW5kZXgsIG1hdGNoZWRUZXh0IH0gb2YgcGF0dGVybkluZGVjaWVzKSB7XG5cdFx0XHRpZiAocmVtYWluaW5nUmVzdWx0UXVvdGEgPCAwKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHR3aGlsZSAoQm9vbGVhbihsaW5lUmFuZ2VzW3N0YXJ0TGluZSArIDFdKSAmJiBtYXRjaFN0YXJ0SW5kZXggPiBsaW5lUmFuZ2VzW3N0YXJ0TGluZV0uZW5kKSB7XG5cdFx0XHRcdHN0YXJ0TGluZSsrO1xuXHRcdFx0fVxuXHRcdFx0bGV0IGVuZExpbmUgPSBzdGFydExpbmU7XG5cdFx0XHR3aGlsZSAoQm9vbGVhbihsaW5lUmFuZ2VzW2VuZExpbmUgKyAxXSkgJiYgbWF0Y2hTdGFydEluZGV4ICsgbWF0Y2hlZFRleHQubGVuZ3RoID4gbGluZVJhbmdlc1tlbmRMaW5lXS5lbmQpIHtcblx0XHRcdFx0ZW5kTGluZSsrO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob3B0aW9ucy5zdXJyb3VuZGluZ0NvbnRleHQpIHtcblx0XHRcdFx0Zm9yIChsZXQgY29udGV4dExpbmUgPSBNYXRoLm1heCgwLCBzdGFydExpbmUgLSBvcHRpb25zLnN1cnJvdW5kaW5nQ29udGV4dCk7IGNvbnRleHRMaW5lIDwgc3RhcnRMaW5lOyBjb250ZXh0TGluZSsrKSB7XG5cdFx0XHRcdFx0Y29udGV4dExpbmVzTmVlZGVkLmFkZChjb250ZXh0TGluZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0bGV0IHByZXZpZXdUZXh0ID0gJyc7XG5cdFx0XHRsZXQgb2Zmc2V0ID0gMDtcblx0XHRcdGZvciAobGV0IG1hdGNoTGluZSA9IHN0YXJ0TGluZTsgbWF0Y2hMaW5lIDw9IGVuZExpbmU7IG1hdGNoTGluZSsrKSB7XG5cdFx0XHRcdGxldCBwcmV2aWV3TGluZSA9IHJlYWRMaW5lKG1hdGNoTGluZSk7XG5cdFx0XHRcdGlmIChvcHRpb25zLnByZXZpZXdPcHRpb25zPy5jaGFyc1BlckxpbmUgJiYgcHJldmlld0xpbmUubGVuZ3RoID4gb3B0aW9ucy5wcmV2aWV3T3B0aW9ucy5jaGFyc1BlckxpbmUpIHtcblx0XHRcdFx0XHRvZmZzZXQgPSBNYXRoLm1heChtYXRjaFN0YXJ0SW5kZXggLSBsaW5lUmFuZ2VzW3N0YXJ0TGluZV0uc3RhcnQgLSAyMCwgMCk7XG5cdFx0XHRcdFx0cHJldmlld0xpbmUgPSBwcmV2aWV3TGluZS5zdWJzdHIob2Zmc2V0LCBvcHRpb25zLnByZXZpZXdPcHRpb25zLmNoYXJzUGVyTGluZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cHJldmlld1RleHQgKz0gYCR7cHJldmlld0xpbmV9XFxuYDtcblx0XHRcdFx0cmVzdWx0TGluZXMuYWRkKG1hdGNoTGluZSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGZpbGVSYW5nZSA9IG5ldyBSYW5nZShcblx0XHRcdFx0c3RhcnRMaW5lLFxuXHRcdFx0XHRtYXRjaFN0YXJ0SW5kZXggLSBsaW5lUmFuZ2VzW3N0YXJ0TGluZV0uc3RhcnQsXG5cdFx0XHRcdGVuZExpbmUsXG5cdFx0XHRcdG1hdGNoU3RhcnRJbmRleCArIG1hdGNoZWRUZXh0Lmxlbmd0aCAtIGxpbmVSYW5nZXNbZW5kTGluZV0uc3RhcnRcblx0XHRcdCk7XG5cdFx0XHRjb25zdCBwcmV2aWV3UmFuZ2UgPSBuZXcgUmFuZ2UoXG5cdFx0XHRcdDAsXG5cdFx0XHRcdG1hdGNoU3RhcnRJbmRleCAtIGxpbmVSYW5nZXNbc3RhcnRMaW5lXS5zdGFydCAtIG9mZnNldCxcblx0XHRcdFx0ZW5kTGluZSAtIHN0YXJ0TGluZSxcblx0XHRcdFx0bWF0Y2hTdGFydEluZGV4ICsgbWF0Y2hlZFRleHQubGVuZ3RoIC0gbGluZVJhbmdlc1tlbmRMaW5lXS5zdGFydCAtIChlbmRMaW5lID09PSBzdGFydExpbmUgPyBvZmZzZXQgOiAwKVxuXHRcdFx0KTtcblxuXHRcdFx0Y29uc3QgbWF0Y2g6IElUZXh0U2VhcmNoTWF0Y2ggPSB7XG5cdFx0XHRcdHJhbmdlTG9jYXRpb25zOiBbe1xuXHRcdFx0XHRcdHNvdXJjZTogZmlsZVJhbmdlLFxuXHRcdFx0XHRcdHByZXZpZXc6IHByZXZpZXdSYW5nZSxcblx0XHRcdFx0fV0sXG5cdFx0XHRcdHByZXZpZXdUZXh0OiBwcmV2aWV3VGV4dFxuXHRcdFx0fTtcblxuXHRcdFx0cmVzdWx0cy5wdXNoKG1hdGNoKTtcblxuXHRcdFx0aWYgKG9wdGlvbnMuc3Vycm91bmRpbmdDb250ZXh0KSB7XG5cdFx0XHRcdGZvciAobGV0IGNvbnRleHRMaW5lID0gZW5kTGluZSArIDE7IGNvbnRleHRMaW5lIDw9IE1hdGgubWluKGVuZExpbmUgKyBvcHRpb25zLnN1cnJvdW5kaW5nQ29udGV4dCwgbGluZVJhbmdlcy5sZW5ndGggLSAxKTsgY29udGV4dExpbmUrKykge1xuXHRcdFx0XHRcdGNvbnRleHRMaW5lc05lZWRlZC5hZGQoY29udGV4dExpbmUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgY29udGV4dExpbmUgb2YgY29udGV4dExpbmVzTmVlZGVkKSB7XG5cdFx0XHRpZiAoIXJlc3VsdExpbmVzLmhhcyhjb250ZXh0TGluZSkpIHtcblxuXHRcdFx0XHRyZXN1bHRzLnB1c2goe1xuXHRcdFx0XHRcdHRleHQ6IHJlYWRMaW5lKGNvbnRleHRMaW5lKSxcblx0XHRcdFx0XHRsaW5lTnVtYmVyOiBjb250ZXh0TGluZSArIDEsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gcmVzdWx0cztcbn07XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLGFBQWE7QUFFZixNQUFNLGlCQUFpQixDQUM3QixPQUNBLFNBQ0EsWUFLeUI7QUFFekIsTUFBSTtBQUNKLE1BQUksTUFBTSxDQUFDLE1BQU0sT0FBUSxNQUFNLENBQUMsTUFBTSxLQUFNO0FBQzNDLFdBQU8sSUFBSSxZQUFZLFVBQVUsRUFBRSxPQUFPLEtBQUs7QUFBQSxFQUNoRCxXQUFXLE1BQU0sQ0FBQyxNQUFNLE9BQVEsTUFBTSxDQUFDLE1BQU0sS0FBTTtBQUNsRCxXQUFPLElBQUksWUFBWSxVQUFVLEVBQUUsT0FBTyxLQUFLO0FBQUEsRUFDaEQsT0FBTztBQUNOLFdBQU8sSUFBSSxZQUFZLE1BQU0sRUFBRSxPQUFPLEtBQUs7QUFDM0MsUUFBSSxLQUFLLE1BQU0sR0FBRyxHQUFJLEVBQUUsU0FBUyxRQUFRLEtBQUssTUFBTSxTQUFTLENBQUMsR0FBRztBQUNoRSxhQUFPLENBQUM7QUFBQSxJQUNUO0FBQUEsRUFDRDtBQUVBLFFBQU0sVUFBK0IsQ0FBQztBQUV0QyxRQUFNLGtCQUFzRSxDQUFDO0FBRTdFLE1BQUksZUFBdUM7QUFDM0MsTUFBSSx1QkFBdUIsUUFBUTtBQUNuQyxTQUFPLHdCQUF3QixNQUFNLGVBQWUsUUFBUSxLQUFLLElBQUksSUFBSTtBQUN4RSxvQkFBZ0IsS0FBSyxFQUFFLGlCQUFpQixhQUFhLE9BQU8sYUFBYSxhQUFhLENBQUMsRUFBRSxDQUFDO0FBQzFGO0FBQUEsRUFDRDtBQUVBLE1BQUksZ0JBQWdCLFFBQVE7QUFDM0IsVUFBTSxxQkFBcUIsb0JBQUksSUFBWTtBQUMzQyxVQUFNLGNBQWMsb0JBQUksSUFBWTtBQUVwQyxVQUFNLGFBQStDLENBQUM7QUFDdEQsVUFBTSxXQUFXLENBQUMsZUFBdUIsS0FBSyxNQUFNLFdBQVcsVUFBVSxFQUFFLE9BQU8sV0FBVyxVQUFVLEVBQUUsR0FBRztBQUU1RyxRQUFJLGNBQWM7QUFDbEIsUUFBSSxrQkFBMEM7QUFDOUMsVUFBTSxlQUFlO0FBQ3JCLFdBQVEsa0JBQWtCLGFBQWEsS0FBSyxJQUFJLEdBQUk7QUFDbkQsaUJBQVcsS0FBSyxFQUFFLE9BQU8sYUFBYSxLQUFLLGdCQUFnQixNQUFNLENBQUM7QUFDbEUsb0JBQWMsZ0JBQWdCLFFBQVEsZ0JBQWdCLENBQUMsRUFBRTtBQUFBLElBQzFEO0FBQ0EsUUFBSSxjQUFjLEtBQUssUUFBUTtBQUFFLGlCQUFXLEtBQUssRUFBRSxPQUFPLGFBQWEsS0FBSyxLQUFLLE9BQU8sQ0FBQztBQUFBLElBQUc7QUFFNUYsUUFBSSxZQUFZO0FBQ2hCLGVBQVcsRUFBRSxpQkFBaUIsWUFBWSxLQUFLLGlCQUFpQjtBQUMvRCxVQUFJLHVCQUF1QixHQUFHO0FBQzdCO0FBQUEsTUFDRDtBQUVBLGFBQU8sUUFBUSxXQUFXLFlBQVksQ0FBQyxDQUFDLEtBQUssa0JBQWtCLFdBQVcsU0FBUyxFQUFFLEtBQUs7QUFDekY7QUFBQSxNQUNEO0FBQ0EsVUFBSSxVQUFVO0FBQ2QsYUFBTyxRQUFRLFdBQVcsVUFBVSxDQUFDLENBQUMsS0FBSyxrQkFBa0IsWUFBWSxTQUFTLFdBQVcsT0FBTyxFQUFFLEtBQUs7QUFDMUc7QUFBQSxNQUNEO0FBRUEsVUFBSSxRQUFRLG9CQUFvQjtBQUMvQixpQkFBUyxjQUFjLEtBQUssSUFBSSxHQUFHLFlBQVksUUFBUSxrQkFBa0IsR0FBRyxjQUFjLFdBQVcsZUFBZTtBQUNuSCw2QkFBbUIsSUFBSSxXQUFXO0FBQUEsUUFDbkM7QUFBQSxNQUNEO0FBRUEsVUFBSSxjQUFjO0FBQ2xCLFVBQUksU0FBUztBQUNiLGVBQVMsWUFBWSxXQUFXLGFBQWEsU0FBUyxhQUFhO0FBQ2xFLFlBQUksY0FBYyxTQUFTLFNBQVM7QUFDcEMsWUFBSSxRQUFRLGdCQUFnQixnQkFBZ0IsWUFBWSxTQUFTLFFBQVEsZUFBZSxjQUFjO0FBQ3JHLG1CQUFTLEtBQUssSUFBSSxrQkFBa0IsV0FBVyxTQUFTLEVBQUUsUUFBUSxJQUFJLENBQUM7QUFDdkUsd0JBQWMsWUFBWSxPQUFPLFFBQVEsUUFBUSxlQUFlLFlBQVk7QUFBQSxRQUM3RTtBQUNBLHVCQUFlLEdBQUcsV0FBVztBQUFBO0FBQzdCLG9CQUFZLElBQUksU0FBUztBQUFBLE1BQzFCO0FBRUEsWUFBTSxZQUFZLElBQUk7QUFBQSxRQUNyQjtBQUFBLFFBQ0Esa0JBQWtCLFdBQVcsU0FBUyxFQUFFO0FBQUEsUUFDeEM7QUFBQSxRQUNBLGtCQUFrQixZQUFZLFNBQVMsV0FBVyxPQUFPLEVBQUU7QUFBQSxNQUM1RDtBQUNBLFlBQU0sZUFBZSxJQUFJO0FBQUEsUUFDeEI7QUFBQSxRQUNBLGtCQUFrQixXQUFXLFNBQVMsRUFBRSxRQUFRO0FBQUEsUUFDaEQsVUFBVTtBQUFBLFFBQ1Ysa0JBQWtCLFlBQVksU0FBUyxXQUFXLE9BQU8sRUFBRSxTQUFTLFlBQVksWUFBWSxTQUFTO0FBQUEsTUFDdEc7QUFFQSxZQUFNLFFBQTBCO0FBQUEsUUFDL0IsZ0JBQWdCLENBQUM7QUFBQSxVQUNoQixRQUFRO0FBQUEsVUFDUixTQUFTO0FBQUEsUUFDVixDQUFDO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFFQSxjQUFRLEtBQUssS0FBSztBQUVsQixVQUFJLFFBQVEsb0JBQW9CO0FBQy9CLGlCQUFTLGNBQWMsVUFBVSxHQUFHLGVBQWUsS0FBSyxJQUFJLFVBQVUsUUFBUSxvQkFBb0IsV0FBVyxTQUFTLENBQUMsR0FBRyxlQUFlO0FBQ3hJLDZCQUFtQixJQUFJLFdBQVc7QUFBQSxRQUNuQztBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsZUFBVyxlQUFlLG9CQUFvQjtBQUM3QyxVQUFJLENBQUMsWUFBWSxJQUFJLFdBQVcsR0FBRztBQUVsQyxnQkFBUSxLQUFLO0FBQUEsVUFDWixNQUFNLFNBQVMsV0FBVztBQUFBLFVBQzFCLFlBQVksY0FBYztBQUFBLFFBQzNCLENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbXQp9Cg==
