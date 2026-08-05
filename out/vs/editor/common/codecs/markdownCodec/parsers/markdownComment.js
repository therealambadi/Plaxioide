var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
import { Range } from "../../../core/range.js";
import { Dash } from "../../simpleCodec/tokens/dash.js";
import { pick } from "../../../../../base/common/arrays.js";
import { assert } from "../../../../../base/common/assert.js";
import { MarkdownComment } from "../tokens/markdownComment.js";
import { ExclamationMark } from "../../simpleCodec/tokens/exclamationMark.js";
import { LeftAngleBracket, RightAngleBracket } from "../../simpleCodec/tokens/angleBrackets.js";
import { assertNotConsumed, ParserBase } from "../../simpleCodec/parserBase.js";
class PartialMarkdownCommentStart extends ParserBase {
  constructor(token) {
    super([token]);
  }
  accept(token) {
    const lastToken = this.currentTokens[this.currentTokens.length - 1];
    if (token instanceof ExclamationMark && lastToken instanceof LeftAngleBracket) {
      this.currentTokens.push(token);
      return {
        result: "success",
        nextParser: this,
        wasTokenConsumed: true
      };
    }
    if (token instanceof Dash) {
      this.currentTokens.push(token);
      if (lastToken instanceof ExclamationMark) {
        return {
          result: "success",
          nextParser: this,
          wasTokenConsumed: true
        };
      }
      if (lastToken instanceof Dash) {
        const token1 = this.currentTokens[0];
        const token2 = this.currentTokens[1];
        const token3 = this.currentTokens[2];
        const token4 = this.currentTokens[3];
        assert(
          token1 instanceof LeftAngleBracket,
          `The first token must be a '<', got '${token1}'.`
        );
        assert(
          token2 instanceof ExclamationMark,
          `The second token must be a '!', got '${token2}'.`
        );
        assert(
          token3 instanceof Dash,
          `The third token must be a '-', got '${token3}'.`
        );
        assert(
          token4 instanceof Dash,
          `The fourth token must be a '-', got '${token4}'.`
        );
        this.isConsumed = true;
        return {
          result: "success",
          nextParser: new MarkdownCommentStart([token1, token2, token3, token4]),
          wasTokenConsumed: true
        };
      }
    }
    this.isConsumed = true;
    return {
      result: "failure",
      wasTokenConsumed: false
    };
  }
}
__decorateClass([
  assertNotConsumed
], PartialMarkdownCommentStart.prototype, "accept", 1);
class MarkdownCommentStart extends ParserBase {
  constructor(tokens) {
    super(tokens);
  }
  accept(token) {
    if (token instanceof RightAngleBracket && this.endsWithDashes) {
      this.currentTokens.push(token);
      return {
        result: "success",
        nextParser: this.asMarkdownComment(),
        wasTokenConsumed: true
      };
    }
    this.currentTokens.push(token);
    return {
      result: "success",
      nextParser: this,
      wasTokenConsumed: true
    };
  }
  /**
   * Convert the current token sequence into a {@link MarkdownComment} token.
   *
   * Note! that this method marks the current parser object as "consumend"
   *       hence it should not be used after this method is called.
   */
  asMarkdownComment() {
    this.isConsumed = true;
    const text = this.currentTokens.map(pick("text")).join("");
    return new MarkdownComment(
      this.range,
      text
    );
  }
  /**
   * Get range of current token sequence.
   */
  get range() {
    const firstToken = this.currentTokens[0];
    const lastToken = this.currentTokens[this.currentTokens.length - 1];
    const range = new Range(
      firstToken.range.startLineNumber,
      firstToken.range.startColumn,
      lastToken.range.endLineNumber,
      lastToken.range.endColumn
    );
    return range;
  }
  /**
   * Whether the current token sequence ends with two dashes.
   */
  get endsWithDashes() {
    const lastToken = this.currentTokens[this.currentTokens.length - 1];
    if (!(lastToken instanceof Dash)) {
      return false;
    }
    const secondLastToken = this.currentTokens[this.currentTokens.length - 2];
    if (!(secondLastToken instanceof Dash)) {
      return false;
    }
    return true;
  }
}
__decorateClass([
  assertNotConsumed
], MarkdownCommentStart.prototype, "accept", 1);
export {
  MarkdownCommentStart,
  PartialMarkdownCommentStart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2NvZGVjcy9tYXJrZG93bkNvZGVjL3BhcnNlcnMvbWFya2Rvd25Db21tZW50LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IERhc2ggfSBmcm9tICcuLi8uLi9zaW1wbGVDb2RlYy90b2tlbnMvZGFzaC5qcyc7XG5pbXBvcnQgeyBwaWNrIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGFzc2VydCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Fzc2VydC5qcyc7XG5pbXBvcnQgeyBNYXJrZG93bkNvbW1lbnQgfSBmcm9tICcuLi90b2tlbnMvbWFya2Rvd25Db21tZW50LmpzJztcbmltcG9ydCB7IFRTaW1wbGVUb2tlbiB9IGZyb20gJy4uLy4uL3NpbXBsZUNvZGVjL3NpbXBsZURlY29kZXIuanMnO1xuaW1wb3J0IHsgRXhjbGFtYXRpb25NYXJrIH0gZnJvbSAnLi4vLi4vc2ltcGxlQ29kZWMvdG9rZW5zL2V4Y2xhbWF0aW9uTWFyay5qcyc7XG5pbXBvcnQgeyBMZWZ0QW5nbGVCcmFja2V0LCBSaWdodEFuZ2xlQnJhY2tldCB9IGZyb20gJy4uLy4uL3NpbXBsZUNvZGVjL3Rva2Vucy9hbmdsZUJyYWNrZXRzLmpzJztcbmltcG9ydCB7IGFzc2VydE5vdENvbnN1bWVkLCBQYXJzZXJCYXNlLCBUQWNjZXB0VG9rZW5SZXN1bHQgfSBmcm9tICcuLi8uLi9zaW1wbGVDb2RlYy9wYXJzZXJCYXNlLmpzJztcblxuLyoqXG4gKiBUaGUgcGFyc2VyIHJlc3BvbnNpYmxlIGZvciBwYXJzaW5nIHRoZSBgPCEtLWAgc2VxdWVuY2UgLSB0aGUgc3RhcnQgb2YgYSBgbWFya2Rvd24gY29tbWVudGAuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXJ0aWFsTWFya2Rvd25Db21tZW50U3RhcnQgZXh0ZW5kcyBQYXJzZXJCYXNlPFRTaW1wbGVUb2tlbiwgUGFydGlhbE1hcmtkb3duQ29tbWVudFN0YXJ0IHwgTWFya2Rvd25Db21tZW50U3RhcnQ+IHtcblx0Y29uc3RydWN0b3IodG9rZW46IExlZnRBbmdsZUJyYWNrZXQpIHtcblx0XHRzdXBlcihbdG9rZW5dKTtcblx0fVxuXG5cdEBhc3NlcnROb3RDb25zdW1lZFxuXHRwdWJsaWMgYWNjZXB0KHRva2VuOiBUU2ltcGxlVG9rZW4pOiBUQWNjZXB0VG9rZW5SZXN1bHQ8UGFydGlhbE1hcmtkb3duQ29tbWVudFN0YXJ0IHwgTWFya2Rvd25Db21tZW50U3RhcnQ+IHtcblx0XHRjb25zdCBsYXN0VG9rZW4gPSB0aGlzLmN1cnJlbnRUb2tlbnNbdGhpcy5jdXJyZW50VG9rZW5zLmxlbmd0aCAtIDFdO1xuXG5cdFx0Ly8gaWYgcmVjZWl2ZWQgYCFgIGFmdGVyIGA8YCwgY29udGludWUgdGhlIHBhcnNpbmcgcHJvY2Vzc1xuXHRcdGlmICh0b2tlbiBpbnN0YW5jZW9mIEV4Y2xhbWF0aW9uTWFyayAmJiBsYXN0VG9rZW4gaW5zdGFuY2VvZiBMZWZ0QW5nbGVCcmFja2V0KSB7XG5cdFx0XHR0aGlzLmN1cnJlbnRUb2tlbnMucHVzaCh0b2tlbik7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyZXN1bHQ6ICdzdWNjZXNzJyxcblx0XHRcdFx0bmV4dFBhcnNlcjogdGhpcyxcblx0XHRcdFx0d2FzVG9rZW5Db25zdW1lZDogdHJ1ZSxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gaWYgcmVjZWl2ZWQgYC1gIGFmdGVyLCBjaGVjayB0aGF0IHByZXZpb3VzIHRva2VuIGVpdGhlciBgIWAgb3IgYC1gLFxuXHRcdC8vIHdoaWNoIGFsbG93cyB0byBjb250aW51ZSB0aGUgcGFyc2luZyBwcm9jZXNzLCBvdGhlcndpc2UgZmFpbFxuXHRcdGlmICh0b2tlbiBpbnN0YW5jZW9mIERhc2gpIHtcblx0XHRcdHRoaXMuY3VycmVudFRva2Vucy5wdXNoKHRva2VuKTtcblxuXHRcdFx0aWYgKGxhc3RUb2tlbiBpbnN0YW5jZW9mIEV4Y2xhbWF0aW9uTWFyaykge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHJlc3VsdDogJ3N1Y2Nlc3MnLFxuXHRcdFx0XHRcdG5leHRQYXJzZXI6IHRoaXMsXG5cdFx0XHRcdFx0d2FzVG9rZW5Db25zdW1lZDogdHJ1ZSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGxhc3RUb2tlbiBpbnN0YW5jZW9mIERhc2gpIHtcblx0XHRcdFx0Y29uc3QgdG9rZW4xOiBUU2ltcGxlVG9rZW4gfCB1bmRlZmluZWQgPSB0aGlzLmN1cnJlbnRUb2tlbnNbMF07XG5cdFx0XHRcdGNvbnN0IHRva2VuMjogVFNpbXBsZVRva2VuIHwgdW5kZWZpbmVkID0gdGhpcy5jdXJyZW50VG9rZW5zWzFdO1xuXHRcdFx0XHRjb25zdCB0b2tlbjM6IFRTaW1wbGVUb2tlbiB8IHVuZGVmaW5lZCA9IHRoaXMuY3VycmVudFRva2Vuc1syXTtcblx0XHRcdFx0Y29uc3QgdG9rZW40OiBUU2ltcGxlVG9rZW4gfCB1bmRlZmluZWQgPSB0aGlzLmN1cnJlbnRUb2tlbnNbM107XG5cblx0XHRcdFx0Ly8gc2FuaXR5IGNoZWNrc1xuXHRcdFx0XHRhc3NlcnQoXG5cdFx0XHRcdFx0dG9rZW4xIGluc3RhbmNlb2YgTGVmdEFuZ2xlQnJhY2tldCxcblx0XHRcdFx0XHRgVGhlIGZpcnN0IHRva2VuIG11c3QgYmUgYSAnPCcsIGdvdCAnJHt0b2tlbjF9Jy5gLFxuXHRcdFx0XHQpO1xuXHRcdFx0XHRhc3NlcnQoXG5cdFx0XHRcdFx0dG9rZW4yIGluc3RhbmNlb2YgRXhjbGFtYXRpb25NYXJrLFxuXHRcdFx0XHRcdGBUaGUgc2Vjb25kIHRva2VuIG11c3QgYmUgYSAnIScsIGdvdCAnJHt0b2tlbjJ9Jy5gLFxuXHRcdFx0XHQpO1xuXHRcdFx0XHRhc3NlcnQoXG5cdFx0XHRcdFx0dG9rZW4zIGluc3RhbmNlb2YgRGFzaCxcblx0XHRcdFx0XHRgVGhlIHRoaXJkIHRva2VuIG11c3QgYmUgYSAnLScsIGdvdCAnJHt0b2tlbjN9Jy5gLFxuXHRcdFx0XHQpO1xuXHRcdFx0XHRhc3NlcnQoXG5cdFx0XHRcdFx0dG9rZW40IGluc3RhbmNlb2YgRGFzaCxcblx0XHRcdFx0XHRgVGhlIGZvdXJ0aCB0b2tlbiBtdXN0IGJlIGEgJy0nLCBnb3QgJyR7dG9rZW40fScuYCxcblx0XHRcdFx0KTtcblxuXHRcdFx0XHR0aGlzLmlzQ29uc3VtZWQgPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHJlc3VsdDogJ3N1Y2Nlc3MnLFxuXHRcdFx0XHRcdG5leHRQYXJzZXI6IG5ldyBNYXJrZG93bkNvbW1lbnRTdGFydChbdG9rZW4xLCB0b2tlbjIsIHRva2VuMywgdG9rZW40XSksXG5cdFx0XHRcdFx0d2FzVG9rZW5Db25zdW1lZDogdHJ1ZSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLmlzQ29uc3VtZWQgPSB0cnVlO1xuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN1bHQ6ICdmYWlsdXJlJyxcblx0XHRcdHdhc1Rva2VuQ29uc3VtZWQ6IGZhbHNlLFxuXHRcdH07XG5cdH1cbn1cblxuLyoqXG4gKiBUaGUgcGFyc2VyIHJlc3BvbnNpYmxlIGZvciBhIGBtYXJrZG93biBjb21tZW50YCBzZXF1ZW5jZSBvZiB0b2tlbnMuXG4gKiBFLmcuIGA8IS0tIHNvbWUgY29tbWVudGAgd2hpY2ggbWF5IG9yIG1heSBub3QgZW5kIHdpdGggYC0tPmAuIElmIGl0IGRvZXMsXG4gKiB0aGVuIHRoZSBwYXJzZXIgdHJhbnNpdGlvbnMgdG8gdGhlIHtAbGluayBNYXJrZG93bkNvbW1lbnR9IHRva2VuLlxuICovXG5leHBvcnQgY2xhc3MgTWFya2Rvd25Db21tZW50U3RhcnQgZXh0ZW5kcyBQYXJzZXJCYXNlPFRTaW1wbGVUb2tlbiwgTWFya2Rvd25Db21tZW50U3RhcnQgfCBNYXJrZG93bkNvbW1lbnQ+IHtcblx0Y29uc3RydWN0b3IodG9rZW5zOiBbTGVmdEFuZ2xlQnJhY2tldCwgRXhjbGFtYXRpb25NYXJrLCBEYXNoLCBEYXNoXSkge1xuXHRcdHN1cGVyKHRva2Vucyk7XG5cdH1cblxuXHRAYXNzZXJ0Tm90Q29uc3VtZWRcblx0cHVibGljIGFjY2VwdCh0b2tlbjogVFNpbXBsZVRva2VuKTogVEFjY2VwdFRva2VuUmVzdWx0PE1hcmtkb3duQ29tbWVudFN0YXJ0IHwgTWFya2Rvd25Db21tZW50PiB7XG5cdFx0Ly8gaWYgcmVjZWl2ZWQgYD5gIHdoaWxlIGN1cnJlbnQgdG9rZW4gc2VxdWVuY2UgZW5kcyB3aXRoIGAtLWAsXG5cdFx0Ly8gdGhlbiB0aGlzIGlzIHRoZSBlbmQgb2YgdGhlIGNvbW1lbnQgc2VxdWVuY2Vcblx0XHRpZiAodG9rZW4gaW5zdGFuY2VvZiBSaWdodEFuZ2xlQnJhY2tldCAmJiB0aGlzLmVuZHNXaXRoRGFzaGVzKSB7XG5cdFx0XHR0aGlzLmN1cnJlbnRUb2tlbnMucHVzaCh0b2tlbik7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJlc3VsdDogJ3N1Y2Nlc3MnLFxuXHRcdFx0XHRuZXh0UGFyc2VyOiB0aGlzLmFzTWFya2Rvd25Db21tZW50KCksXG5cdFx0XHRcdHdhc1Rva2VuQ29uc3VtZWQ6IHRydWUsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHRoaXMuY3VycmVudFRva2Vucy5wdXNoKHRva2VuKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN1bHQ6ICdzdWNjZXNzJyxcblx0XHRcdG5leHRQYXJzZXI6IHRoaXMsXG5cdFx0XHR3YXNUb2tlbkNvbnN1bWVkOiB0cnVlLFxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydCB0aGUgY3VycmVudCB0b2tlbiBzZXF1ZW5jZSBpbnRvIGEge0BsaW5rIE1hcmtkb3duQ29tbWVudH0gdG9rZW4uXG5cdCAqXG5cdCAqIE5vdGUhIHRoYXQgdGhpcyBtZXRob2QgbWFya3MgdGhlIGN1cnJlbnQgcGFyc2VyIG9iamVjdCBhcyBcImNvbnN1bWVuZFwiXG5cdCAqICAgICAgIGhlbmNlIGl0IHNob3VsZCBub3QgYmUgdXNlZCBhZnRlciB0aGlzIG1ldGhvZCBpcyBjYWxsZWQuXG5cdCAqL1xuXHRwdWJsaWMgYXNNYXJrZG93bkNvbW1lbnQoKTogTWFya2Rvd25Db21tZW50IHtcblx0XHR0aGlzLmlzQ29uc3VtZWQgPSB0cnVlO1xuXG5cdFx0Y29uc3QgdGV4dCA9IHRoaXMuY3VycmVudFRva2Vuc1xuXHRcdFx0Lm1hcChwaWNrKCd0ZXh0JykpXG5cdFx0XHQuam9pbignJyk7XG5cblx0XHRyZXR1cm4gbmV3IE1hcmtkb3duQ29tbWVudChcblx0XHRcdHRoaXMucmFuZ2UsXG5cdFx0XHR0ZXh0LFxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IHJhbmdlIG9mIGN1cnJlbnQgdG9rZW4gc2VxdWVuY2UuXG5cdCAqL1xuXHRwcml2YXRlIGdldCByYW5nZSgpOiBSYW5nZSB7XG5cdFx0Y29uc3QgZmlyc3RUb2tlbiA9IHRoaXMuY3VycmVudFRva2Vuc1swXTtcblx0XHRjb25zdCBsYXN0VG9rZW4gPSB0aGlzLmN1cnJlbnRUb2tlbnNbdGhpcy5jdXJyZW50VG9rZW5zLmxlbmd0aCAtIDFdO1xuXG5cdFx0Y29uc3QgcmFuZ2UgPSBuZXcgUmFuZ2UoXG5cdFx0XHRmaXJzdFRva2VuLnJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdGZpcnN0VG9rZW4ucmFuZ2Uuc3RhcnRDb2x1bW4sXG5cdFx0XHRsYXN0VG9rZW4ucmFuZ2UuZW5kTGluZU51bWJlcixcblx0XHRcdGxhc3RUb2tlbi5yYW5nZS5lbmRDb2x1bW4sXG5cdFx0KTtcblxuXHRcdHJldHVybiByYW5nZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIHRoZSBjdXJyZW50IHRva2VuIHNlcXVlbmNlIGVuZHMgd2l0aCB0d28gZGFzaGVzLlxuXHQgKi9cblx0cHJpdmF0ZSBnZXQgZW5kc1dpdGhEYXNoZXMoKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgbGFzdFRva2VuID0gdGhpcy5jdXJyZW50VG9rZW5zW3RoaXMuY3VycmVudFRva2Vucy5sZW5ndGggLSAxXTtcblx0XHRpZiAoIShsYXN0VG9rZW4gaW5zdGFuY2VvZiBEYXNoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlY29uZExhc3RUb2tlbiA9IHRoaXMuY3VycmVudFRva2Vuc1t0aGlzLmN1cnJlbnRUb2tlbnMubGVuZ3RoIC0gMl07XG5cdFx0aWYgKCEoc2Vjb25kTGFzdFRva2VuIGluc3RhbmNlb2YgRGFzaCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUtBLFNBQVMsYUFBYTtBQUN0QixTQUFTLFlBQVk7QUFDckIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsY0FBYztBQUN2QixTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGtCQUFrQix5QkFBeUI7QUFDcEQsU0FBUyxtQkFBbUIsa0JBQXNDO0FBSzNELE1BQU0sb0NBQW9DLFdBQTZFO0FBQUEsRUFD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
