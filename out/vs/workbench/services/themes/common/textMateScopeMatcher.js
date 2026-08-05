function createMatchers(selector, matchesName, results) {
  const tokenizer = newTokenizer(selector);
  let token = tokenizer.next();
  while (token !== null) {
    let priority = 0;
    if (token.length === 2 && token.charAt(1) === ":") {
      switch (token.charAt(0)) {
        case "R":
          priority = 1;
          break;
        case "L":
          priority = -1;
          break;
        default:
          console.log(`Unknown priority ${token} in scope selector`);
      }
      token = tokenizer.next();
    }
    const matcher = parseConjunction();
    if (matcher) {
      results.push({ matcher, priority });
    }
    if (token !== ",") {
      break;
    }
    token = tokenizer.next();
  }
  function parseOperand() {
    if (token === "-") {
      token = tokenizer.next();
      const expressionToNegate = parseOperand();
      if (!expressionToNegate) {
        return null;
      }
      return (matcherInput) => {
        const score = expressionToNegate(matcherInput);
        return score < 0 ? 0 : -1;
      };
    }
    if (token === "(") {
      token = tokenizer.next();
      const expressionInParents = parseInnerExpression();
      if (token === ")") {
        token = tokenizer.next();
      }
      return expressionInParents;
    }
    if (isIdentifier(token)) {
      const identifiers = [];
      do {
        identifiers.push(token);
        token = tokenizer.next();
      } while (isIdentifier(token));
      return (matcherInput) => matchesName(identifiers, matcherInput);
    }
    return null;
  }
  function parseConjunction() {
    let matcher = parseOperand();
    if (!matcher) {
      return null;
    }
    const matchers = [];
    while (matcher) {
      matchers.push(matcher);
      matcher = parseOperand();
    }
    return (matcherInput) => {
      let min = matchers[0](matcherInput);
      for (let i = 1; min >= 0 && i < matchers.length; i++) {
        min = Math.min(min, matchers[i](matcherInput));
      }
      return min;
    };
  }
  function parseInnerExpression() {
    let matcher = parseConjunction();
    if (!matcher) {
      return null;
    }
    const matchers = [];
    while (matcher) {
      matchers.push(matcher);
      if (token === "|" || token === ",") {
        do {
          token = tokenizer.next();
        } while (token === "|" || token === ",");
      } else {
        break;
      }
      matcher = parseConjunction();
    }
    return (matcherInput) => {
      let max = matchers[0](matcherInput);
      for (let i = 1; i < matchers.length; i++) {
        max = Math.max(max, matchers[i](matcherInput));
      }
      return max;
    };
  }
}
function isIdentifier(token) {
  return !!token && !!token.match(/[\w\.:]+/);
}
function newTokenizer(input) {
  const regex = /([LR]:|[\w\.:][\w\.:\-]*|[\,\|\-\(\)])/g;
  let match = regex.exec(input);
  return {
    next: () => {
      if (!match) {
        return null;
      }
      const res = match[0];
      match = regex.exec(input);
      return res;
    }
  };
}
export {
  createMatchers
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2NvbW1vbi90ZXh0TWF0ZVNjb3BlTWF0Y2hlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0IGludGVyZmFjZSBNYXRjaGVyV2l0aFByaW9yaXR5PFQ+IHtcblx0bWF0Y2hlcjogTWF0Y2hlcjxUPjtcblx0cHJpb3JpdHk6IC0xIHwgMCB8IDE7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWF0Y2hlcjxUPiB7XG5cdChtYXRjaGVySW5wdXQ6IFQpOiBudW1iZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNYXRjaGVyczxUPihzZWxlY3Rvcjogc3RyaW5nLCBtYXRjaGVzTmFtZTogKG5hbWVzOiBzdHJpbmdbXSwgbWF0Y2hlcklucHV0OiBUKSA9PiBudW1iZXIsIHJlc3VsdHM6IE1hdGNoZXJXaXRoUHJpb3JpdHk8VD5bXSk6IHZvaWQge1xuXHRjb25zdCB0b2tlbml6ZXIgPSBuZXdUb2tlbml6ZXIoc2VsZWN0b3IpO1xuXHRsZXQgdG9rZW4gPSB0b2tlbml6ZXIubmV4dCgpO1xuXHR3aGlsZSAodG9rZW4gIT09IG51bGwpIHtcblx0XHRsZXQgcHJpb3JpdHk6IC0xIHwgMCB8IDEgPSAwO1xuXHRcdGlmICh0b2tlbi5sZW5ndGggPT09IDIgJiYgdG9rZW4uY2hhckF0KDEpID09PSAnOicpIHtcblx0XHRcdHN3aXRjaCAodG9rZW4uY2hhckF0KDApKSB7XG5cdFx0XHRcdGNhc2UgJ1InOiBwcmlvcml0eSA9IDE7IGJyZWFrO1xuXHRcdFx0XHRjYXNlICdMJzogcHJpb3JpdHkgPSAtMTsgYnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coYFVua25vd24gcHJpb3JpdHkgJHt0b2tlbn0gaW4gc2NvcGUgc2VsZWN0b3JgKTtcblx0XHRcdH1cblx0XHRcdHRva2VuID0gdG9rZW5pemVyLm5leHQoKTtcblx0XHR9XG5cdFx0Y29uc3QgbWF0Y2hlciA9IHBhcnNlQ29uanVuY3Rpb24oKTtcblx0XHRpZiAobWF0Y2hlcikge1xuXHRcdFx0cmVzdWx0cy5wdXNoKHsgbWF0Y2hlciwgcHJpb3JpdHkgfSk7XG5cdFx0fVxuXHRcdGlmICh0b2tlbiAhPT0gJywnKSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0dG9rZW4gPSB0b2tlbml6ZXIubmV4dCgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFyc2VPcGVyYW5kKCk6IE1hdGNoZXI8VD4gfCBudWxsIHtcblx0XHRpZiAodG9rZW4gPT09ICctJykge1xuXHRcdFx0dG9rZW4gPSB0b2tlbml6ZXIubmV4dCgpO1xuXHRcdFx0Y29uc3QgZXhwcmVzc2lvblRvTmVnYXRlID0gcGFyc2VPcGVyYW5kKCk7XG5cdFx0XHRpZiAoIWV4cHJlc3Npb25Ub05lZ2F0ZSkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBtYXRjaGVySW5wdXQgPT4ge1xuXHRcdFx0XHRjb25zdCBzY29yZSA9IGV4cHJlc3Npb25Ub05lZ2F0ZShtYXRjaGVySW5wdXQpO1xuXHRcdFx0XHRyZXR1cm4gc2NvcmUgPCAwID8gMCA6IC0xO1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0aWYgKHRva2VuID09PSAnKCcpIHtcblx0XHRcdHRva2VuID0gdG9rZW5pemVyLm5leHQoKTtcblx0XHRcdGNvbnN0IGV4cHJlc3Npb25JblBhcmVudHMgPSBwYXJzZUlubmVyRXhwcmVzc2lvbigpO1xuXHRcdFx0aWYgKHRva2VuID09PSAnKScpIHtcblx0XHRcdFx0dG9rZW4gPSB0b2tlbml6ZXIubmV4dCgpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGV4cHJlc3Npb25JblBhcmVudHM7XG5cdFx0fVxuXHRcdGlmIChpc0lkZW50aWZpZXIodG9rZW4pKSB7XG5cdFx0XHRjb25zdCBpZGVudGlmaWVyczogc3RyaW5nW10gPSBbXTtcblx0XHRcdGRvIHtcblx0XHRcdFx0aWRlbnRpZmllcnMucHVzaCh0b2tlbik7XG5cdFx0XHRcdHRva2VuID0gdG9rZW5pemVyLm5leHQoKTtcblx0XHRcdH0gd2hpbGUgKGlzSWRlbnRpZmllcih0b2tlbikpO1xuXHRcdFx0cmV0dXJuIG1hdGNoZXJJbnB1dCA9PiBtYXRjaGVzTmFtZShpZGVudGlmaWVycywgbWF0Y2hlcklucHV0KTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblx0ZnVuY3Rpb24gcGFyc2VDb25qdW5jdGlvbigpOiBNYXRjaGVyPFQ+IHwgbnVsbCB7XG5cdFx0bGV0IG1hdGNoZXIgPSBwYXJzZU9wZXJhbmQoKTtcblx0XHRpZiAoIW1hdGNoZXIpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1hdGNoZXJzOiBNYXRjaGVyPFQ+W10gPSBbXTtcblx0XHR3aGlsZSAobWF0Y2hlcikge1xuXHRcdFx0bWF0Y2hlcnMucHVzaChtYXRjaGVyKTtcblx0XHRcdG1hdGNoZXIgPSBwYXJzZU9wZXJhbmQoKTtcblx0XHR9XG5cdFx0cmV0dXJuIG1hdGNoZXJJbnB1dCA9PiB7ICAvLyBhbmRcblx0XHRcdGxldCBtaW4gPSBtYXRjaGVyc1swXShtYXRjaGVySW5wdXQpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDE7IG1pbiA+PSAwICYmIGkgPCBtYXRjaGVycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRtaW4gPSBNYXRoLm1pbihtaW4sIG1hdGNoZXJzW2ldKG1hdGNoZXJJbnB1dCkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG1pbjtcblx0XHR9O1xuXHR9XG5cdGZ1bmN0aW9uIHBhcnNlSW5uZXJFeHByZXNzaW9uKCk6IE1hdGNoZXI8VD4gfCBudWxsIHtcblx0XHRsZXQgbWF0Y2hlciA9IHBhcnNlQ29uanVuY3Rpb24oKTtcblx0XHRpZiAoIW1hdGNoZXIpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCBtYXRjaGVyczogTWF0Y2hlcjxUPltdID0gW107XG5cdFx0d2hpbGUgKG1hdGNoZXIpIHtcblx0XHRcdG1hdGNoZXJzLnB1c2gobWF0Y2hlcik7XG5cdFx0XHRpZiAodG9rZW4gPT09ICd8JyB8fCB0b2tlbiA9PT0gJywnKSB7XG5cdFx0XHRcdGRvIHtcblx0XHRcdFx0XHR0b2tlbiA9IHRva2VuaXplci5uZXh0KCk7XG5cdFx0XHRcdH0gd2hpbGUgKHRva2VuID09PSAnfCcgfHwgdG9rZW4gPT09ICcsJyk7IC8vIGlnbm9yZSBzdWJzZXF1ZW50IGNvbW1hc1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRtYXRjaGVyID0gcGFyc2VDb25qdW5jdGlvbigpO1xuXHRcdH1cblx0XHRyZXR1cm4gbWF0Y2hlcklucHV0ID0+IHsgIC8vIG9yXG5cdFx0XHRsZXQgbWF4ID0gbWF0Y2hlcnNbMF0obWF0Y2hlcklucHV0KTtcblx0XHRcdGZvciAobGV0IGkgPSAxOyBpIDwgbWF0Y2hlcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0bWF4ID0gTWF0aC5tYXgobWF4LCBtYXRjaGVyc1tpXShtYXRjaGVySW5wdXQpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBtYXg7XG5cdFx0fTtcblx0fVxufVxuXG5mdW5jdGlvbiBpc0lkZW50aWZpZXIodG9rZW46IHN0cmluZyB8IG51bGwpOiB0b2tlbiBpcyBzdHJpbmcge1xuXHRyZXR1cm4gISF0b2tlbiAmJiAhIXRva2VuLm1hdGNoKC9bXFx3XFwuOl0rLyk7XG59XG5cbmZ1bmN0aW9uIG5ld1Rva2VuaXplcihpbnB1dDogc3RyaW5nKTogeyBuZXh0OiAoKSA9PiBzdHJpbmcgfCBudWxsIH0ge1xuXHRjb25zdCByZWdleCA9IC8oW0xSXTp8W1xcd1xcLjpdW1xcd1xcLjpcXC1dKnxbXFwsXFx8XFwtXFwoXFwpXSkvZztcblx0bGV0IG1hdGNoID0gcmVnZXguZXhlYyhpbnB1dCk7XG5cdHJldHVybiB7XG5cdFx0bmV4dDogKCkgPT4ge1xuXHRcdFx0aWYgKCFtYXRjaCkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlcyA9IG1hdGNoWzBdO1xuXHRcdFx0bWF0Y2ggPSByZWdleC5leGVjKGlucHV0KTtcblx0XHRcdHJldHVybiByZXM7XG5cdFx0fVxuXHR9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBZ0JPLFNBQVMsZUFBa0IsVUFBa0IsYUFBMkQsU0FBeUM7QUFDdkosUUFBTSxZQUFZLGFBQWEsUUFBUTtBQUN2QyxNQUFJLFFBQVEsVUFBVSxLQUFLO0FBQzNCLFNBQU8sVUFBVSxNQUFNO0FBQ3RCLFFBQUksV0FBdUI7QUFDM0IsUUFBSSxNQUFNLFdBQVcsS0FBSyxNQUFNLE9BQU8sQ0FBQyxNQUFNLEtBQUs7QUFDbEQsY0FBUSxNQUFNLE9BQU8sQ0FBQyxHQUFHO0FBQUEsUUFDeEIsS0FBSztBQUFLLHFCQUFXO0FBQUc7QUFBQSxRQUN4QixLQUFLO0FBQUsscUJBQVc7QUFBSTtBQUFBLFFBQ3pCO0FBQ0Msa0JBQVEsSUFBSSxvQkFBb0IsS0FBSyxvQkFBb0I7QUFBQSxNQUMzRDtBQUNBLGNBQVEsVUFBVSxLQUFLO0FBQUEsSUFDeEI7QUFDQSxVQUFNLFVBQVUsaUJB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
