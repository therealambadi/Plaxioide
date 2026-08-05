import { renderStringAsPlaintext } from "../../../../base/browser/markdownRenderer.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import { GraphemeIterator, forAnsiStringParts, removeAnsiEscapeCodes } from "../../../../base/common/strings.js";
import "./media/testMessageColorizer.css";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
const colorAttrRe = /^\x1b\[([0-9]+)m$/;
var Classes = /* @__PURE__ */ ((Classes2) => {
  Classes2["Prefix"] = "tstm-ansidec-";
  Classes2["ForegroundPrefix"] = "tstm-ansidec-fg";
  Classes2["BackgroundPrefix"] = "tstm-ansidec-bg";
  Classes2["Bold"] = "tstm-ansidec-1";
  Classes2["Faint"] = "tstm-ansidec-2";
  Classes2["Italic"] = "tstm-ansidec-3";
  Classes2["Underline"] = "tstm-ansidec-4";
  return Classes2;
})(Classes || {});
const renderTestMessageAsText = (tm) => typeof tm === "string" ? removeAnsiEscapeCodes(tm) : renderStringAsPlaintext(tm);
const colorizeTestMessageInEditor = (message, editor) => {
  const decos = [];
  editor.changeDecorations((changeAccessor) => {
    let start = new Position(1, 1);
    let cls = [];
    for (const part of forAnsiStringParts(message)) {
      if (part.isCode) {
        const colorAttr = colorAttrRe.exec(part.str)?.[1];
        if (!colorAttr) {
          continue;
        }
        const n = Number(colorAttr);
        if (n === 0) {
          cls.length = 0;
        } else if (n === 22) {
          cls = cls.filter((c) => c !== "tstm-ansidec-1" /* Bold */ && c !== "tstm-ansidec-3" /* Italic */);
        } else if (n === 23) {
          cls = cls.filter((c) => c !== "tstm-ansidec-3" /* Italic */);
        } else if (n === 24) {
          cls = cls.filter((c) => c !== "tstm-ansidec-4" /* Underline */);
        } else if (n >= 30 && n <= 39 || n >= 90 && n <= 99) {
          cls = cls.filter((c) => !c.startsWith("tstm-ansidec-fg" /* ForegroundPrefix */));
          cls.push("tstm-ansidec-fg" /* ForegroundPrefix */ + colorAttr);
        } else if (n >= 40 && n <= 49 || n >= 100 && n <= 109) {
          cls = cls.filter((c) => !c.startsWith("tstm-ansidec-bg" /* BackgroundPrefix */));
          cls.push("tstm-ansidec-bg" /* BackgroundPrefix */ + colorAttr);
        } else {
          cls.push("tstm-ansidec-" /* Prefix */ + colorAttr);
        }
      } else {
        let line = start.lineNumber;
        let col = start.column;
        const graphemes = new GraphemeIterator(part.str);
        for (let i = 0; !graphemes.eol(); i += graphemes.nextGraphemeLength()) {
          if (part.str[i] === "\n") {
            line++;
            col = 1;
          } else {
            col++;
          }
        }
        const end = new Position(line, col);
        if (cls.length) {
          decos.push(changeAccessor.addDecoration(Range.fromPositions(start, end), {
            inlineClassName: cls.join(" "),
            description: "test-message-colorized"
          }));
        }
        start = end;
      }
    }
  });
  return toDisposable(() => editor.removeDecorations(decos));
};
export {
  colorizeTestMessageInEditor,
  renderTestMessageAsText
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdE1lc3NhZ2VDb2xvcml6ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyByZW5kZXJTdHJpbmdBc1BsYWludGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgR3JhcGhlbWVJdGVyYXRvciwgZm9yQW5zaVN0cmluZ1BhcnRzLCByZW1vdmVBbnNpRXNjYXBlQ29kZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCAnLi9tZWRpYS90ZXN0TWVzc2FnZUNvbG9yaXplci5jc3MnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuXG5jb25zdCBjb2xvckF0dHJSZSA9IC9eXFx4MWJcXFsoWzAtOV0rKW0kLztcblxuY29uc3QgZW51bSBDbGFzc2VzIHtcblx0UHJlZml4ID0gJ3RzdG0tYW5zaWRlYy0nLFxuXHRGb3JlZ3JvdW5kUHJlZml4ID0gQ2xhc3Nlcy5QcmVmaXggKyAnZmcnLFxuXHRCYWNrZ3JvdW5kUHJlZml4ID0gQ2xhc3Nlcy5QcmVmaXggKyAnYmcnLFxuXHRCb2xkID0gQ2xhc3Nlcy5QcmVmaXggKyAnMScsXG5cdEZhaW50ID0gQ2xhc3Nlcy5QcmVmaXggKyAnMicsXG5cdEl0YWxpYyA9IENsYXNzZXMuUHJlZml4ICsgJzMnLFxuXHRVbmRlcmxpbmUgPSBDbGFzc2VzLlByZWZpeCArICc0Jyxcbn1cblxuZXhwb3J0IGNvbnN0IHJlbmRlclRlc3RNZXNzYWdlQXNUZXh0ID0gKHRtOiBzdHJpbmcgfCBJTWFya2Rvd25TdHJpbmcpID0+XG5cdHR5cGVvZiB0bSA9PT0gJ3N0cmluZycgPyByZW1vdmVBbnNpRXNjYXBlQ29kZXModG0pIDogcmVuZGVyU3RyaW5nQXNQbGFpbnRleHQodG0pO1xuXG5cbi8qKlxuICogQXBwbGllcyBkZWNvcmF0aW9ucyBiYXNlZCBvbiBBTlNJIHN0eWxlcyBmcm9tIHRoZSB0ZXN0IG1lc3NhZ2UgaW4gdGhlIGVkaXRvci5cbiAqIEFOU0kgc2VxdWVuY2VzIGFyZSBzdHJpcHBlZCBmcm9tIHRoZSB0ZXh0IGRpc3BsYXllZCBpbiBlZGl0b3IsIGFuZCB0aGlzXG4gKiByZS1hcHBsaWVzIHRoZWlyIGNvbG9yaXphdGlvbi5cbiAqXG4gKiBUaGlzIHVzZXMgZGVjb3JhdGlvbnMgcmF0aGVyIHRoYW4gbGFuZ3VhZ2UgZmVhdHVyZXMgYmVjYXVzZSB0aGUgc3RyaW5nXG4gKiByZW5kZXJlZCBpbiB0aGUgZWRpdG9yIGxhY2tzIHRoZSBBTlNJIGNvZGVzIG5lZWRlZCB0byBhY3R1YWxseSBhcHBseSB0aGVcbiAqIGNvbG9yaXphdGlvbi5cbiAqXG4gKiBOb3RlOiBkb2VzIG5vdCBzdXBwb3J0IFRydWVDb2xvci5cbiAqL1xuZXhwb3J0IGNvbnN0IGNvbG9yaXplVGVzdE1lc3NhZ2VJbkVkaXRvciA9IChtZXNzYWdlOiBzdHJpbmcsIGVkaXRvcjogQ29kZUVkaXRvcldpZGdldCk6IElEaXNwb3NhYmxlID0+IHtcblx0Y29uc3QgZGVjb3M6IHN0cmluZ1tdID0gW107XG5cblx0ZWRpdG9yLmNoYW5nZURlY29yYXRpb25zKGNoYW5nZUFjY2Vzc29yID0+IHtcblx0XHRsZXQgc3RhcnQgPSBuZXcgUG9zaXRpb24oMSwgMSk7XG5cdFx0bGV0IGNsczogc3RyaW5nW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHBhcnQgb2YgZm9yQW5zaVN0cmluZ1BhcnRzKG1lc3NhZ2UpKSB7XG5cdFx0XHRpZiAocGFydC5pc0NvZGUpIHtcblx0XHRcdFx0Y29uc3QgY29sb3JBdHRyID0gY29sb3JBdHRyUmUuZXhlYyhwYXJ0LnN0cik/LlsxXTtcblx0XHRcdFx0aWYgKCFjb2xvckF0dHIpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IG4gPSBOdW1iZXIoY29sb3JBdHRyKTtcblx0XHRcdFx0aWYgKG4gPT09IDApIHtcblx0XHRcdFx0XHRjbHMubGVuZ3RoID0gMDtcblx0XHRcdFx0fSBlbHNlIGlmIChuID09PSAyMikge1xuXHRcdFx0XHRcdGNscyA9IGNscy5maWx0ZXIoYyA9PiBjICE9PSBDbGFzc2VzLkJvbGQgJiYgYyAhPT0gQ2xhc3Nlcy5JdGFsaWMpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG4gPT09IDIzKSB7XG5cdFx0XHRcdFx0Y2xzID0gY2xzLmZpbHRlcihjID0+IGMgIT09IENsYXNzZXMuSXRhbGljKTtcblx0XHRcdFx0fSBlbHNlIGlmIChuID09PSAyNCkge1xuXHRcdFx0XHRcdGNscyA9IGNscy5maWx0ZXIoYyA9PiBjICE9PSBDbGFzc2VzLlVuZGVybGluZSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoKG4gPj0gMzAgJiYgbiA8PSAzOSkgfHwgKG4gPj0gOTAgJiYgbiA8PSA5OSkpIHtcblx0XHRcdFx0XHRjbHMgPSBjbHMuZmlsdGVyKGMgPT4gIWMuc3RhcnRzV2l0aChDbGFzc2VzLkZvcmVncm91bmRQcmVmaXgpKTtcblx0XHRcdFx0XHRjbHMucHVzaChDbGFzc2VzLkZvcmVncm91bmRQcmVmaXggKyBjb2xvckF0dHIpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKChuID49IDQwICYmIG4gPD0gNDkpIHx8IChuID49IDEwMCAmJiBuIDw9IDEwOSkpIHtcblx0XHRcdFx0XHRjbHMgPSBjbHMuZmlsdGVyKGMgPT4gIWMuc3RhcnRzV2l0aChDbGFzc2VzLkJhY2tncm91bmRQcmVmaXgpKTtcblx0XHRcdFx0XHRjbHMucHVzaChDbGFzc2VzLkJhY2tncm91bmRQcmVmaXggKyBjb2xvckF0dHIpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNscy5wdXNoKENsYXNzZXMuUHJlZml4ICsgY29sb3JBdHRyKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGV0IGxpbmUgPSBzdGFydC5saW5lTnVtYmVyO1xuXHRcdFx0XHRsZXQgY29sID0gc3RhcnQuY29sdW1uO1xuXG5cdFx0XHRcdGNvbnN0IGdyYXBoZW1lcyA9IG5ldyBHcmFwaGVtZUl0ZXJhdG9yKHBhcnQuc3RyKTtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7ICFncmFwaGVtZXMuZW9sKCk7IGkgKz0gZ3JhcGhlbWVzLm5leHRHcmFwaGVtZUxlbmd0aCgpKSB7XG5cdFx0XHRcdFx0aWYgKHBhcnQuc3RyW2ldID09PSAnXFxuJykge1xuXHRcdFx0XHRcdFx0bGluZSsrO1xuXHRcdFx0XHRcdFx0Y29sID0gMTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y29sKys7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgZW5kID0gbmV3IFBvc2l0aW9uKGxpbmUsIGNvbCk7XG5cdFx0XHRcdGlmIChjbHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0ZGVjb3MucHVzaChjaGFuZ2VBY2Nlc3Nvci5hZGREZWNvcmF0aW9uKFJhbmdlLmZyb21Qb3NpdGlvbnMoc3RhcnQsIGVuZCksIHtcblx0XHRcdFx0XHRcdGlubGluZUNsYXNzTmFtZTogY2xzLmpvaW4oJyAnKSxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAndGVzdC1tZXNzYWdlLWNvbG9yaXplZCcsXG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YXJ0ID0gZW5kO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiBlZGl0b3IucmVtb3ZlRGVjb3JhdGlvbnMoZGVjb3MpKTtcbn07XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLCtCQUErQjtBQUV4QyxTQUFzQixvQkFBb0I7QUFDMUMsU0FBUyxrQkFBa0Isb0JBQW9CLDZCQUE2QjtBQUM1RSxPQUFPO0FBRVAsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBRXRCLE1BQU0sY0FBYztBQUVwQixJQUFXLFVBQVgsa0JBQVdBLGFBQVg7QUFDQyxFQUFBQSxTQUFBLFlBQVM7QUFDVCxFQUFBQSxTQUFBLHNCQUFtQjtBQUNuQixFQUFBQSxTQUFBLHNCQUFtQjtBQUNuQixFQUFBQSxTQUFBLFVBQU87QUFDUCxFQUFBQSxTQUFBLFdBQVE7QUFDUixFQUFBQSxTQUFBLFlBQVM7QUFDVCxFQUFBQSxTQUFBLGVBQVk7QUFQRixTQUFB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
