import { createScanner as createJSONScanner, SyntaxKind as JSONSyntaxKind } from "../../../../base/common/json.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
class SmartSnippetInserter {
  static hasOpenBrace(scanner) {
    while (scanner.scan() !== JSONSyntaxKind.EOF) {
      const kind = scanner.getToken();
      if (kind === JSONSyntaxKind.OpenBraceToken) {
        return true;
      }
    }
    return false;
  }
  static offsetToPosition(model, offset) {
    let offsetBeforeLine = 0;
    const eolLength = model.getEOL().length;
    const lineCount = model.getLineCount();
    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
      const lineTotalLength = model.getLineLength(lineNumber) + eolLength;
      const offsetAfterLine = offsetBeforeLine + lineTotalLength;
      if (offsetAfterLine > offset) {
        return new Position(
          lineNumber,
          offset - offsetBeforeLine + 1
        );
      }
      offsetBeforeLine = offsetAfterLine;
    }
    return new Position(
      lineCount,
      model.getLineMaxColumn(lineCount)
    );
  }
  static insertSnippet(model, _position) {
    const desiredPosition = model.getValueLengthInRange(new Range(1, 1, _position.lineNumber, _position.column));
    let State;
    ((State2) => {
      State2[State2["INVALID"] = 0] = "INVALID";
      State2[State2["AFTER_OBJECT"] = 1] = "AFTER_OBJECT";
      State2[State2["BEFORE_OBJECT"] = 2] = "BEFORE_OBJECT";
    })(State || (State = {}));
    let currentState = 0 /* INVALID */;
    let lastValidPos = -1;
    let lastValidState = 0 /* INVALID */;
    const scanner = createJSONScanner(model.getValue());
    let arrayLevel = 0;
    let objLevel = 0;
    const checkRangeStatus = (pos, state) => {
      if (state !== 0 /* INVALID */ && arrayLevel === 1 && objLevel === 0) {
        currentState = state;
        lastValidPos = pos;
        lastValidState = state;
      } else {
        if (currentState !== 0 /* INVALID */) {
          currentState = 0 /* INVALID */;
          lastValidPos = scanner.getTokenOffset();
        }
      }
    };
    while (scanner.scan() !== JSONSyntaxKind.EOF) {
      const currentPos = scanner.getPosition();
      const kind = scanner.getToken();
      let goodKind = false;
      switch (kind) {
        case JSONSyntaxKind.OpenBracketToken:
          goodKind = true;
          arrayLevel++;
          checkRangeStatus(currentPos, 2 /* BEFORE_OBJECT */);
          break;
        case JSONSyntaxKind.CloseBracketToken:
          goodKind = true;
          arrayLevel--;
          checkRangeStatus(currentPos, 0 /* INVALID */);
          break;
        case JSONSyntaxKind.CommaToken:
          goodKind = true;
          checkRangeStatus(currentPos, 2 /* BEFORE_OBJECT */);
          break;
        case JSONSyntaxKind.OpenBraceToken:
          goodKind = true;
          objLevel++;
          checkRangeStatus(currentPos, 0 /* INVALID */);
          break;
        case JSONSyntaxKind.CloseBraceToken:
          goodKind = true;
          objLevel--;
          checkRangeStatus(currentPos, 1 /* AFTER_OBJECT */);
          break;
        case JSONSyntaxKind.Trivia:
        case JSONSyntaxKind.LineBreakTrivia:
          goodKind = true;
      }
      if (currentPos >= desiredPosition && (currentState !== 0 /* INVALID */ || lastValidPos !== -1)) {
        let acceptPosition;
        let acceptState;
        if (currentState !== 0 /* INVALID */) {
          acceptPosition = goodKind ? currentPos : scanner.getTokenOffset();
          acceptState = currentState;
        } else {
          acceptPosition = lastValidPos;
          acceptState = lastValidState;
        }
        if (acceptState === 1 /* AFTER_OBJECT */) {
          return {
            position: this.offsetToPosition(model, acceptPosition),
            prepend: ",",
            append: ""
          };
        } else {
          scanner.setPosition(acceptPosition);
          return {
            position: this.offsetToPosition(model, acceptPosition),
            prepend: "",
            append: this.hasOpenBrace(scanner) ? "," : ""
          };
        }
      }
    }
    const modelLineCount = model.getLineCount();
    return {
      position: new Position(modelLineCount, model.getLineMaxColumn(modelLineCount)),
      prepend: "\n[",
      append: "]"
    };
  }
}
export {
  SmartSnippetInserter
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9jb21tb24vc21hcnRTbmlwcGV0SW5zZXJ0ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBKU09OU2Nhbm5lciwgY3JlYXRlU2Nhbm5lciBhcyBjcmVhdGVKU09OU2Nhbm5lciwgU3ludGF4S2luZCBhcyBKU09OU3ludGF4S2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb24uanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEluc2VydFNuaXBwZXRSZXN1bHQge1xuXHRwb3NpdGlvbjogUG9zaXRpb247XG5cdHByZXBlbmQ6IHN0cmluZztcblx0YXBwZW5kOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTbWFydFNuaXBwZXRJbnNlcnRlciB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgaGFzT3BlbkJyYWNlKHNjYW5uZXI6IEpTT05TY2FubmVyKTogYm9vbGVhbiB7XG5cblx0XHR3aGlsZSAoc2Nhbm5lci5zY2FuKCkgIT09IEpTT05TeW50YXhLaW5kLkVPRikge1xuXHRcdFx0Y29uc3Qga2luZCA9IHNjYW5uZXIuZ2V0VG9rZW4oKTtcblxuXHRcdFx0aWYgKGtpbmQgPT09IEpTT05TeW50YXhLaW5kLk9wZW5CcmFjZVRva2VuKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIG9mZnNldFRvUG9zaXRpb24obW9kZWw6IElUZXh0TW9kZWwsIG9mZnNldDogbnVtYmVyKTogUG9zaXRpb24ge1xuXHRcdGxldCBvZmZzZXRCZWZvcmVMaW5lID0gMDtcblx0XHRjb25zdCBlb2xMZW5ndGggPSBtb2RlbC5nZXRFT0woKS5sZW5ndGg7XG5cdFx0Y29uc3QgbGluZUNvdW50ID0gbW9kZWwuZ2V0TGluZUNvdW50KCk7XG5cdFx0Zm9yIChsZXQgbGluZU51bWJlciA9IDE7IGxpbmVOdW1iZXIgPD0gbGluZUNvdW50OyBsaW5lTnVtYmVyKyspIHtcblx0XHRcdGNvbnN0IGxpbmVUb3RhbExlbmd0aCA9IG1vZGVsLmdldExpbmVMZW5ndGgobGluZU51bWJlcikgKyBlb2xMZW5ndGg7XG5cdFx0XHRjb25zdCBvZmZzZXRBZnRlckxpbmUgPSBvZmZzZXRCZWZvcmVMaW5lICsgbGluZVRvdGFsTGVuZ3RoO1xuXG5cdFx0XHRpZiAob2Zmc2V0QWZ0ZXJMaW5lID4gb2Zmc2V0KSB7XG5cdFx0XHRcdHJldHVybiBuZXcgUG9zaXRpb24oXG5cdFx0XHRcdFx0bGluZU51bWJlcixcblx0XHRcdFx0XHRvZmZzZXQgLSBvZmZzZXRCZWZvcmVMaW5lICsgMVxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdFx0b2Zmc2V0QmVmb3JlTGluZSA9IG9mZnNldEFmdGVyTGluZTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBQb3NpdGlvbihcblx0XHRcdGxpbmVDb3VudCxcblx0XHRcdG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZUNvdW50KVxuXHRcdCk7XG5cdH1cblxuXHRzdGF0aWMgaW5zZXJ0U25pcHBldChtb2RlbDogSVRleHRNb2RlbCwgX3Bvc2l0aW9uOiBQb3NpdGlvbik6IEluc2VydFNuaXBwZXRSZXN1bHQge1xuXG5cdFx0Y29uc3QgZGVzaXJlZFBvc2l0aW9uID0gbW9kZWwuZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCBfcG9zaXRpb24ubGluZU51bWJlciwgX3Bvc2l0aW9uLmNvbHVtbikpO1xuXG5cdFx0Ly8gPElOVkFMSUQ+IFsgPEJFRk9SRV9PQkpFQ1Q+IHsgPElOVkFMSUQ+IH0gPEFGVEVSX09CSkVDVD4sIDxCRUZPUkVfT0JKRUNUPiB7IDxJTlZBTElEPiB9IDxBRlRFUl9PQkpFQ1Q+IF0gPElOVkFMSUQ+XG5cdFx0ZW51bSBTdGF0ZSB7XG5cdFx0XHRJTlZBTElEID0gMCxcblx0XHRcdEFGVEVSX09CSkVDVCA9IDEsXG5cdFx0XHRCRUZPUkVfT0JKRUNUID0gMixcblx0XHR9XG5cdFx0bGV0IGN1cnJlbnRTdGF0ZSA9IFN0YXRlLklOVkFMSUQ7XG5cdFx0bGV0IGxhc3RWYWxpZFBvcyA9IC0xO1xuXHRcdGxldCBsYXN0VmFsaWRTdGF0ZSA9IFN0YXRlLklOVkFMSUQ7XG5cblx0XHRjb25zdCBzY2FubmVyID0gY3JlYXRlSlNPTlNjYW5uZXIobW9kZWwuZ2V0VmFsdWUoKSk7XG5cdFx0bGV0IGFycmF5TGV2ZWwgPSAwO1xuXHRcdGxldCBvYmpMZXZlbCA9IDA7XG5cblx0XHRjb25zdCBjaGVja1JhbmdlU3RhdHVzID0gKHBvczogbnVtYmVyLCBzdGF0ZTogU3RhdGUpID0+IHtcblx0XHRcdGlmIChzdGF0ZSAhPT0gU3RhdGUuSU5WQUxJRCAmJiBhcnJheUxldmVsID09PSAxICYmIG9iakxldmVsID09PSAwKSB7XG5cdFx0XHRcdGN1cnJlbnRTdGF0ZSA9IHN0YXRlO1xuXHRcdFx0XHRsYXN0VmFsaWRQb3MgPSBwb3M7XG5cdFx0XHRcdGxhc3RWYWxpZFN0YXRlID0gc3RhdGU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoY3VycmVudFN0YXRlICE9PSBTdGF0ZS5JTlZBTElEKSB7XG5cdFx0XHRcdFx0Y3VycmVudFN0YXRlID0gU3RhdGUuSU5WQUxJRDtcblx0XHRcdFx0XHRsYXN0VmFsaWRQb3MgPSBzY2FubmVyLmdldFRva2VuT2Zmc2V0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0d2hpbGUgKHNjYW5uZXIuc2NhbigpICE9PSBKU09OU3ludGF4S2luZC5FT0YpIHtcblx0XHRcdGNvbnN0IGN1cnJlbnRQb3MgPSBzY2FubmVyLmdldFBvc2l0aW9uKCk7XG5cdFx0XHRjb25zdCBraW5kID0gc2Nhbm5lci5nZXRUb2tlbigpO1xuXG5cdFx0XHRsZXQgZ29vZEtpbmQgPSBmYWxzZTtcblx0XHRcdHN3aXRjaCAoa2luZCkge1xuXHRcdFx0XHRjYXNlIEpTT05TeW50YXhLaW5kLk9wZW5CcmFja2V0VG9rZW46XG5cdFx0XHRcdFx0Z29vZEtpbmQgPSB0cnVlO1xuXHRcdFx0XHRcdGFycmF5TGV2ZWwrKztcblx0XHRcdFx0XHRjaGVja1JhbmdlU3RhdHVzKGN1cnJlbnRQb3MsIFN0YXRlLkJFRk9SRV9PQkpFQ1QpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEpTT05TeW50YXhLaW5kLkNsb3NlQnJhY2tldFRva2VuOlxuXHRcdFx0XHRcdGdvb2RLaW5kID0gdHJ1ZTtcblx0XHRcdFx0XHRhcnJheUxldmVsLS07XG5cdFx0XHRcdFx0Y2hlY2tSYW5nZVN0YXR1cyhjdXJyZW50UG9zLCBTdGF0ZS5JTlZBTElEKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBKU09OU3ludGF4S2luZC5Db21tYVRva2VuOlxuXHRcdFx0XHRcdGdvb2RLaW5kID0gdHJ1ZTtcblx0XHRcdFx0XHRjaGVja1JhbmdlU3RhdHVzKGN1cnJlbnRQb3MsIFN0YXRlLkJFRk9SRV9PQkpFQ1QpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEpTT05TeW50YXhLaW5kLk9wZW5CcmFjZVRva2VuOlxuXHRcdFx0XHRcdGdvb2RLaW5kID0gdHJ1ZTtcblx0XHRcdFx0XHRvYmpMZXZlbCsrO1xuXHRcdFx0XHRcdGNoZWNrUmFuZ2VTdGF0dXMoY3VycmVudFBvcywgU3RhdGUuSU5WQUxJRCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgSlNPTlN5bnRheEtpbmQuQ2xvc2VCcmFjZVRva2VuOlxuXHRcdFx0XHRcdGdvb2RLaW5kID0gdHJ1ZTtcblx0XHRcdFx0XHRvYmpMZXZlbC0tO1xuXHRcdFx0XHRcdGNoZWNrUmFuZ2VTdGF0dXMoY3VycmVudFBvcywgU3RhdGUuQUZURVJfT0JKRUNUKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBKU09OU3ludGF4S2luZC5Ucml2aWE6XG5cdFx0XHRcdGNhc2UgSlNPTlN5bnRheEtpbmQuTGluZUJyZWFrVHJpdmlhOlxuXHRcdFx0XHRcdGdvb2RLaW5kID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGN1cnJlbnRQb3MgPj0gZGVzaXJlZFBvc2l0aW9uICYmIChjdXJyZW50U3RhdGUgIT09IFN0YXRlLklOVkFMSUQgfHwgbGFzdFZhbGlkUG9zICE9PSAtMSkpIHtcblx0XHRcdFx0bGV0IGFjY2VwdFBvc2l0aW9uOiBudW1iZXI7XG5cdFx0XHRcdGxldCBhY2NlcHRTdGF0ZTogU3RhdGU7XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRTdGF0ZSAhPT0gU3RhdGUuSU5WQUxJRCkge1xuXHRcdFx0XHRcdGFjY2VwdFBvc2l0aW9uID0gKGdvb2RLaW5kID8gY3VycmVudFBvcyA6IHNjYW5uZXIuZ2V0VG9rZW5PZmZzZXQoKSk7XG5cdFx0XHRcdFx0YWNjZXB0U3RhdGUgPSBjdXJyZW50U3RhdGU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YWNjZXB0UG9zaXRpb24gPSBsYXN0VmFsaWRQb3M7XG5cdFx0XHRcdFx0YWNjZXB0U3RhdGUgPSBsYXN0VmFsaWRTdGF0ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChhY2NlcHRTdGF0ZSBhcyBTdGF0ZSA9PT0gU3RhdGUuQUZURVJfT0JKRUNUKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHBvc2l0aW9uOiB0aGlzLm9mZnNldFRvUG9zaXRpb24obW9kZWwsIGFjY2VwdFBvc2l0aW9uKSxcblx0XHRcdFx0XHRcdHByZXBlbmQ6ICcsJyxcblx0XHRcdFx0XHRcdGFwcGVuZDogJydcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNjYW5uZXIuc2V0UG9zaXRpb24oYWNjZXB0UG9zaXRpb24pO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRwb3NpdGlvbjogdGhpcy5vZmZzZXRUb1Bvc2l0aW9uKG1vZGVsLCBhY2NlcHRQb3NpdGlvbiksXG5cdFx0XHRcdFx0XHRwcmVwZW5kOiAnJyxcblx0XHRcdFx0XHRcdGFwcGVuZDogdGhpcy5oYXNPcGVuQnJhY2Uoc2Nhbm5lcikgPyAnLCcgOiAnJ1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBubyB2YWxpZCBwb3NpdGlvbiBmb3VuZCFcblx0XHRjb25zdCBtb2RlbExpbmVDb3VudCA9IG1vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRwb3NpdGlvbjogbmV3IFBvc2l0aW9uKG1vZGVsTGluZUNvdW50LCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKG1vZGVsTGluZUNvdW50KSksXG5cdFx0XHRwcmVwZW5kOiAnXFxuWycsXG5cdFx0XHRhcHBl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
