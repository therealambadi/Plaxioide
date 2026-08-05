import { deepStrictEqual } from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { DecorationCssRuleExtractor } from "../../../browser/gpu/css/decorationCssRuleExtractor.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { $, getActiveDocument } from "../../../../base/browser/dom.js";
function randomClass() {
  return "test-class-" + generateUuid();
}
suite("DecorationCssRulerExtractor", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let doc;
  let container;
  let extractor;
  let testClassName;
  function addStyleElement(content) {
    const styleElement = $("style");
    styleElement.textContent = content;
    container.append(styleElement);
  }
  function assertStyles(className, expectedCssText) {
    deepStrictEqual(extractor.getStyleRules(container, className).map((e) => e.cssText), expectedCssText);
  }
  setup(() => {
    doc = getActiveDocument();
    extractor = store.add(new DecorationCssRuleExtractor());
    testClassName = randomClass();
    container = $("div");
    doc.body.append(container);
  });
  teardown(() => {
    container.remove();
  });
  test("unknown class should give no styles", () => {
    assertStyles(randomClass(), []);
  });
  test("single style should be picked up", () => {
    addStyleElement(`.${testClassName} { color: red; }`);
    assertStyles(testClassName, [
      `.${testClassName} { color: red; }`
    ]);
  });
  test("multiple styles from the same selector should be picked up", () => {
    addStyleElement(`.${testClassName} { color: red; opacity: 0.5; }`);
    assertStyles(testClassName, [
      `.${testClassName} { color: red; opacity: 0.5; }`
    ]);
  });
  test("multiple styles from  different selectors should be picked up", () => {
    addStyleElement([
      `.${testClassName} { color: red; opacity: 0.5; }`,
      `.${testClassName}:hover { opacity: 1; }`
    ].join("\n"));
    assertStyles(testClassName, [
      `.${testClassName} { color: red; opacity: 0.5; }`,
      `.${testClassName}:hover { opacity: 1; }`
    ]);
  });
  test("multiple styles from the different stylesheets should be picked up", () => {
    addStyleElement(`.${testClassName} { color: red; opacity: 0.5; }`);
    addStyleElement(`.${testClassName}:hover { opacity: 1; }`);
    assertStyles(testClassName, [
      `.${testClassName} { color: red; opacity: 0.5; }`,
      `.${testClassName}:hover { opacity: 1; }`
    ]);
  });
  test("should not pick up styles from selectors where the prefix is the class", () => {
    addStyleElement([
      `.${testClassName} { color: red; }`,
      `.${testClassName}-ignoreme { opacity: 1; }`,
      `.${testClassName}fake { opacity: 1; }`
    ].join("\n"));
    assertStyles(testClassName, [
      `.${testClassName} { color: red; }`
    ]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL2dwdS9kZWNvcmF0aW9uQ3NzUnVsZXJFeHRyYWN0b3IudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGRlZXBTdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IERlY29yYXRpb25Dc3NSdWxlRXh0cmFjdG9yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9ncHUvY3NzL2RlY29yYXRpb25Dc3NSdWxlRXh0cmFjdG9yLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgJCwgZ2V0QWN0aXZlRG9jdW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcblxuZnVuY3Rpb24gcmFuZG9tQ2xhc3MoKTogc3RyaW5nIHtcblx0cmV0dXJuICd0ZXN0LWNsYXNzLScgKyBnZW5lcmF0ZVV1aWQoKTtcbn1cblxuc3VpdGUoJ0RlY29yYXRpb25Dc3NSdWxlckV4dHJhY3RvcicsICgpID0+IHtcblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgZG9jOiBEb2N1bWVudDtcblx0bGV0IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdGxldCBleHRyYWN0b3I6IERlY29yYXRpb25Dc3NSdWxlRXh0cmFjdG9yO1xuXHRsZXQgdGVzdENsYXNzTmFtZTogc3RyaW5nO1xuXG5cdGZ1bmN0aW9uIGFkZFN0eWxlRWxlbWVudChjb250ZW50OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBzdHlsZUVsZW1lbnQgPSAkKCdzdHlsZScpO1xuXHRcdHN0eWxlRWxlbWVudC50ZXh0Q29udGVudCA9IGNvbnRlbnQ7XG5cdFx0Y29udGFpbmVyLmFwcGVuZChzdHlsZUVsZW1lbnQpO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0U3R5bGVzKGNsYXNzTmFtZTogc3RyaW5nLCBleHBlY3RlZENzc1RleHQ6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0ZGVlcFN0cmljdEVxdWFsKGV4dHJhY3Rvci5nZXRTdHlsZVJ1bGVzKGNvbnRhaW5lciwgY2xhc3NOYW1lKS5tYXAoZSA9PiBlLmNzc1RleHQpLCBleHBlY3RlZENzc1RleHQpO1xuXHR9XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRvYyA9IGdldEFjdGl2ZURvY3VtZW50KCk7XG5cdFx0ZXh0cmFjdG9yID0gc3RvcmUuYWRkKG5ldyBEZWNvcmF0aW9uQ3NzUnVsZUV4dHJhY3RvcigpKTtcblx0XHR0ZXN0Q2xhc3NOYW1lID0gcmFuZG9tQ2xhc3MoKTtcblx0XHRjb250YWluZXIgPSAkKCdkaXYnKTtcblx0XHRkb2MuYm9keS5hcHBlbmQoY29udGFpbmVyKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGNvbnRhaW5lci5yZW1vdmUoKTtcblx0fSk7XG5cblx0dGVzdCgndW5rbm93biBjbGFzcyBzaG91bGQgZ2l2ZSBubyBzdHlsZXMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0U3R5bGVzKHJhbmRvbUNsYXNzKCksIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnc2luZ2xlIHN0eWxlIHNob3VsZCBiZSBwaWNrZWQgdXAnLCAoKSA9PiB7XG5cdFx0YWRkU3R5bGVFbGVtZW50KGAuJHt0ZXN0Q2xhc3NOYW1lfSB7IGNvbG9yOiByZWQ7IH1gKTtcblx0XHRhc3NlcnRTdHlsZXModGVzdENsYXNzTmFtZSwgW1xuXHRcdFx0YC4ke3Rlc3RDbGFzc05hbWV9IHsgY29sb3I6IHJlZDsgfWBcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlwbGUgc3R5bGVzIGZyb20gdGhlIHNhbWUgc2VsZWN0b3Igc2hvdWxkIGJlIHBpY2tlZCB1cCcsICgpID0+IHtcblx0XHRhZGRTdHlsZUVsZW1lbnQoYC4ke3Rlc3RDbGFzc05hbWV9IHsgY29sb3I6IHJlZDsgb3BhY2l0eTogMC41OyB9YCk7XG5cdFx0YXNzZXJ0U3R5bGVzKHRlc3RDbGFzc05hbWUsIFtcblx0XHRcdGAuJHt0ZXN0Q2xhc3NOYW1lfSB7IGNvbG9yOiByZWQ7IG9wYWNpdHk6IDAuNTsgfWBcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlwbGUgc3R5bGVzIGZyb20gIGRpZmZlcmVudCBzZWxlY3RvcnMgc2hvdWxkIGJlIHBpY2tlZCB1cCcsICgpID0+IHtcblx0XHRhZGRTdHlsZUVsZW1lbnQoW1xuXHRcdFx0YC4ke3Rlc3RDbGFzc05hbWV9IHsgY29sb3I6IHJlZDsgb3BhY2l0eTogMC41OyB9YCxcblx0XHRcdGAuJHt0ZXN0Q2xhc3NOYW1lfTpob3ZlciB7IG9wYWNpdHk6IDE7IH1gLFxuXHRcdF0uam9pbignXFxuJykpO1xuXHRcdGFzc2VydFN0eWxlcyh0ZXN0Q2xhc3NOYW1lLCBbXG5cdFx0XHRgLiR7dGVzdENsYXNzTmFtZX0geyBjb2xvcjogcmVkOyBvcGFjaXR5OiAwLjU7IH1gLFxuXHRcdFx0YC4ke3Rlc3RDbGFzc05hbWV9OmhvdmVyIHsgb3BhY2l0eTogMTsgfWAsXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpcGxlIHN0eWxlcyBmcm9tIHRoZSBkaWZmZXJlbnQgc3R5bGVzaGVldHMgc2hvdWxkIGJlIHBpY2tlZCB1cCcsICgpID0+IHtcblx0XHRhZGRTdHlsZUVsZW1lbnQoYC4ke3Rlc3RDbGFzc05hbWV9IHsgY29sb3I6IHJlZDsgb3BhY2l0eTogMC41OyB9YCk7XG5cdFx0YWRkU3R5bGVFbGVtZW50KGAuJHt0ZXN0Q2xhc3NOYW1lfTpob3ZlciB7IG9wYWNpdHk6IDE7IH1gKTtcblx0XHRhc3NlcnRTdHlsZXModGVzdENsYXNzTmFtZSwgW1xuXHRcdFx0YC4ke3Rlc3RDbGFzc05hbWV9IHsgY29sb3I6IHJlZDsgb3BhY2l0eTogMC41OyB9YCxcblx0XHRcdGAuJHt0ZXN0Q2xhc3NOYW1lfTpob3ZlciB7IG9wYWNpdHk6IDE7IH1gLFxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzaG91bGQgbm90IHBpY2sgdXAgc3R5bGVzIGZyb20gc2VsZWN0b3JzIHdoZXJlIHRoZSBwcmVmaXggaXMgdGhlIGNsYXNzJywgKCkgPT4ge1xuXHRcdGFkZFN0eWxlRWxlbWVudChbXG5cdFx0XHRgLiR7dGVzdENsYXNzTmFtZX0geyBjb2xvcjogcmVkOyB9YCxcblx0XHRcdGAuJHt0ZXN0Q2xhc3NOYW1lfS1pZ25vcmVtZSB7IG9wYWNpdHk6IDE7IH1gLFxuXHRcdFx0YC4ke3Rlc3RDbGFzc05hbWV9ZmFrZSB7IG9wYWNpdHk6IDE7IH1gLFxuXHRcdF0uam9pbignXFxuJykpO1xuXHRcdGFzc2VydFN0eWxlcyh0ZXN0Q2xhc3NOYW1lLCBbXG5cdFx0XHRgLiR7dGVzdENsYXNzTmFtZX0geyBjb2xvcjogcmVkOyB9YCxcblx0XHRdKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6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
