import * as DOM from "./dom.js";
function renderText(text, options = {}) {
  const element = createElement(options);
  element.textContent = text;
  return element;
}
function renderFormattedText(formattedText, options = {}) {
  const element = createElement(options);
  _renderFormattedText(element, parseFormattedText(formattedText, !!options.renderCodeSegments), options.actionHandler, options.renderCodeSegments);
  return element;
}
function createElement(options) {
  const tagName = options.inline ? "span" : "div";
  const element = document.createElement(tagName);
  if (options.className) {
    element.className = options.className;
  }
  return element;
}
class StringStream {
  constructor(source) {
    this.source = source;
    this.index = 0;
  }
  eos() {
    return this.index >= this.source.length;
  }
  next() {
    const next = this.peek();
    this.advance();
    return next;
  }
  peek() {
    return this.source[this.index];
  }
  advance() {
    this.index++;
  }
}
var FormatType = /* @__PURE__ */ ((FormatType2) => {
  FormatType2[FormatType2["Invalid"] = 0] = "Invalid";
  FormatType2[FormatType2["Root"] = 1] = "Root";
  FormatType2[FormatType2["Text"] = 2] = "Text";
  FormatType2[FormatType2["Bold"] = 3] = "Bold";
  FormatType2[FormatType2["Italics"] = 4] = "Italics";
  FormatType2[FormatType2["Action"] = 5] = "Action";
  FormatType2[FormatType2["ActionClose"] = 6] = "ActionClose";
  FormatType2[FormatType2["Code"] = 7] = "Code";
  FormatType2[FormatType2["NewLine"] = 8] = "NewLine";
  return FormatType2;
})(FormatType || {});
function _renderFormattedText(element, treeNode, actionHandler, renderCodeSegments) {
  let child;
  if (treeNode.type === 2 /* Text */) {
    child = document.createTextNode(treeNode.content || "");
  } else if (treeNode.type === 3 /* Bold */) {
    child = document.createElement("b");
  } else if (treeNode.type === 4 /* Italics */) {
    child = document.createElement("i");
  } else if (treeNode.type === 7 /* Code */ && renderCodeSegments) {
    child = document.createElement("code");
  } else if (treeNode.type === 5 /* Action */ && actionHandler) {
    const a = document.createElement("a");
    actionHandler.disposables.add(DOM.addStandardDisposableListener(a, "click", (event) => {
      actionHandler.callback(String(treeNode.index), event);
    }));
    child = a;
  } else if (treeNode.type === 8 /* NewLine */) {
    child = document.createElement("br");
  } else if (treeNode.type === 1 /* Root */) {
    child = element;
  }
  if (child && element !== child) {
    element.appendChild(child);
  }
  if (child && Array.isArray(treeNode.children)) {
    treeNode.children.forEach((nodeChild) => {
      _renderFormattedText(child, nodeChild, actionHandler, renderCodeSegments);
    });
  }
}
function parseFormattedText(content, parseCodeSegments) {
  const root = {
    type: 1 /* Root */,
    children: []
  };
  let actionViewItemIndex = 0;
  let current = root;
  const stack = [];
  const stream = new StringStream(content);
  while (!stream.eos()) {
    let next = stream.next();
    const isEscapedFormatType = next === "\\" && formatTagType(stream.peek(), parseCodeSegments) !== 0 /* Invalid */;
    if (isEscapedFormatType) {
      next = stream.next();
    }
    if (!isEscapedFormatType && isFormatTag(next, parseCodeSegments) && next === stream.peek()) {
      stream.advance();
      if (current.type === 2 /* Text */) {
        current = stack.pop();
      }
      const type = formatTagType(next, parseCodeSegments);
      if (current.type === type || current.type === 5 /* Action */ && type === 6 /* ActionClose */) {
        current = stack.pop();
      } else {
        const newCurrent = {
          type,
          children: []
        };
        if (type === 5 /* Action */) {
          newCurrent.index = actionViewItemIndex;
          actionViewItemIndex++;
        }
        current.children.push(newCurrent);
        stack.push(current);
        current = newCurrent;
      }
    } else if (next === "\n") {
      if (current.type === 2 /* Text */) {
        current = stack.pop();
      }
      current.children.push({
        type: 8 /* NewLine */
      });
    } else {
      if (current.type !== 2 /* Text */) {
        const textCurrent = {
          type: 2 /* Text */,
          content: next
        };
        current.children.push(textCurrent);
        stack.push(current);
        current = textCurrent;
      } else {
        current.content += next;
      }
    }
  }
  if (current.type === 2 /* Text */) {
    current = stack.pop();
  }
  if (stack.length) {
  }
  return root;
}
function isFormatTag(char, supportCodeSegments) {
  return formatTagType(char, supportCodeSegments) !== 0 /* Invalid */;
}
function formatTagType(char, supportCodeSegments) {
  switch (char) {
    case "*":
      return 3 /* Bold */;
    case "_":
      return 4 /* Italics */;
    case "[":
      return 5 /* Action */;
    case "]":
      return 6 /* ActionClose */;
    case "`":
      return supportCodeSegments ? 7 /* Code */ : 0 /* Invalid */;
    default:
      return 0 /* Invalid */;
  }
}
export {
  createElement,
  renderFormattedText,
  renderText
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvZm9ybWF0dGVkVGV4dFJlbmRlcmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgRE9NIGZyb20gJy4vZG9tLmpzJztcbmltcG9ydCB7IElLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IElNb3VzZUV2ZW50IH0gZnJvbSAnLi9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElDb250ZW50QWN0aW9uSGFuZGxlciB7XG5cdHJlYWRvbmx5IGNhbGxiYWNrOiAoY29udGVudDogc3RyaW5nLCBldmVudDogSU1vdXNlRXZlbnQgfCBJS2V5Ym9hcmRFdmVudCkgPT4gdm9pZDtcblx0cmVhZG9ubHkgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBGb3JtYXR0ZWRUZXh0UmVuZGVyT3B0aW9ucyB7XG5cdHJlYWRvbmx5IGNsYXNzTmFtZT86IHN0cmluZztcblx0cmVhZG9ubHkgaW5saW5lPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgYWN0aW9uSGFuZGxlcj86IElDb250ZW50QWN0aW9uSGFuZGxlcjtcblx0cmVhZG9ubHkgcmVuZGVyQ29kZVNlZ21lbnRzPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlclRleHQodGV4dDogc3RyaW5nLCBvcHRpb25zOiBGb3JtYXR0ZWRUZXh0UmVuZGVyT3B0aW9ucyA9IHt9KTogSFRNTEVsZW1lbnQge1xuXHRjb25zdCBlbGVtZW50ID0gY3JlYXRlRWxlbWVudChvcHRpb25zKTtcblx0ZWxlbWVudC50ZXh0Q29udGVudCA9IHRleHQ7XG5cdHJldHVybiBlbGVtZW50O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyRm9ybWF0dGVkVGV4dChmb3JtYXR0ZWRUZXh0OiBzdHJpbmcsIG9wdGlvbnM6IEZvcm1hdHRlZFRleHRSZW5kZXJPcHRpb25zID0ge30pOiBIVE1MRWxlbWVudCB7XG5cdGNvbnN0IGVsZW1lbnQgPSBjcmVhdGVFbGVtZW50KG9wdGlvbnMpO1xuXHRfcmVuZGVyRm9ybWF0dGVkVGV4dChlbGVtZW50LCBwYXJzZUZvcm1hdHRlZFRleHQoZm9ybWF0dGVkVGV4dCwgISFvcHRpb25zLnJlbmRlckNvZGVTZWdtZW50cyksIG9wdGlvbnMuYWN0aW9uSGFuZGxlciwgb3B0aW9ucy5yZW5kZXJDb2RlU2VnbWVudHMpO1xuXHRyZXR1cm4gZWxlbWVudDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQob3B0aW9uczogRm9ybWF0dGVkVGV4dFJlbmRlck9wdGlvbnMpOiBIVE1MRWxlbWVudCB7XG5cdGNvbnN0IHRhZ05hbWUgPSBvcHRpb25zLmlubGluZSA/ICdzcGFuJyA6ICdkaXYnO1xuXHRjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcblx0aWYgKG9wdGlvbnMuY2xhc3NOYW1lKSB7XG5cdFx0ZWxlbWVudC5jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZTtcblx0fVxuXHRyZXR1cm4gZWxlbWVudDtcbn1cblxuY2xhc3MgU3RyaW5nU3RyZWFtIHtcblx0cHJpdmF0ZSBzb3VyY2U6IHN0cmluZztcblx0cHJpdmF0ZSBpbmRleDogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKHNvdXJjZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5zb3VyY2UgPSBzb3VyY2U7XG5cdFx0dGhpcy5pbmRleCA9IDA7XG5cdH1cblxuXHRwdWJsaWMgZW9zKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmluZGV4ID49IHRoaXMuc291cmNlLmxlbmd0aDtcblx0fVxuXG5cdHB1YmxpYyBuZXh0KCk6IHN0cmluZyB7XG5cdFx0Y29uc3QgbmV4dCA9IHRoaXMucGVlaygpO1xuXHRcdHRoaXMuYWR2YW5jZSgpO1xuXHRcdHJldHVybiBuZXh0O1xuXHR9XG5cblx0cHVibGljIHBlZWsoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5zb3VyY2VbdGhpcy5pbmRleF07XG5cdH1cblxuXHRwdWJsaWMgYWR2YW5jZSgpOiB2b2lkIHtcblx0XHR0aGlzLmluZGV4Kys7XG5cdH1cbn1cblxuY29uc3QgZW51bSBGb3JtYXRUeXBlIHtcblx0SW52YWxpZCxcblx0Um9vdCxcblx0VGV4dCxcblx0Qm9sZCxcblx0SXRhbGljcyxcblx0QWN0aW9uLFxuXHRBY3Rpb25DbG9zZSxcblx0Q29kZSxcblx0TmV3TGluZVxufVxuXG5pbnRlcmZhY2UgSUZvcm1hdFBhcnNlVHJlZSB7XG5cdHR5cGU6IEZvcm1hdFR5cGU7XG5cdGNvbnRlbnQ/OiBzdHJpbmc7XG5cdGluZGV4PzogbnVtYmVyO1xuXHRjaGlsZHJlbj86IElGb3JtYXRQYXJzZVRyZWVbXTtcbn1cblxuZnVuY3Rpb24gX3JlbmRlckZvcm1hdHRlZFRleHQoZWxlbWVudDogTm9kZSwgdHJlZU5vZGU6IElGb3JtYXRQYXJzZVRyZWUsIGFjdGlvbkhhbmRsZXI/OiBJQ29udGVudEFjdGlvbkhhbmRsZXIsIHJlbmRlckNvZGVTZWdtZW50cz86IGJvb2xlYW4pIHtcblx0bGV0IGNoaWxkOiBOb2RlIHwgdW5kZWZpbmVkO1xuXG5cdGlmICh0cmVlTm9kZS50eXBlID09PSBGb3JtYXRUeXBlLlRleHQpIHtcblx0XHRjaGlsZCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRyZWVOb2RlLmNvbnRlbnQgfHwgJycpO1xuXHR9IGVsc2UgaWYgKHRyZWVOb2RlLnR5cGUgPT09IEZvcm1hdFR5cGUuQm9sZCkge1xuXHRcdGNoaWxkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYicpO1xuXHR9IGVsc2UgaWYgKHRyZWVOb2RlLnR5cGUgPT09IEZvcm1hdFR5cGUuSXRhbGljcykge1xuXHRcdGNoaWxkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaScpO1xuXHR9IGVsc2UgaWYgKHRyZWVOb2RlLnR5cGUgPT09IEZvcm1hdFR5cGUuQ29kZSAmJiByZW5kZXJDb2RlU2VnbWVudHMpIHtcblx0XHRjaGlsZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NvZGUnKTtcblx0fSBlbHNlIGlmICh0cmVlTm9kZS50eXBlID09PSBGb3JtYXRUeXBlLkFjdGlvbiAmJiBhY3Rpb25IYW5kbGVyKSB7XG5cdFx0Y29uc3QgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcblx0XHRhY3Rpb25IYW5kbGVyLmRpc3Bvc2FibGVzLmFkZChET00uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIoYSwgJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG5cdFx0XHRhY3Rpb25IYW5kbGVyLmNhbGxiYWNrKFN0cmluZyh0cmVlTm9kZS5pbmRleCksIGV2ZW50KTtcblx0XHR9KSk7XG5cblx0XHRjaGlsZCA9IGE7XG5cdH0gZWxzZSBpZiAodHJlZU5vZGUudHlwZSA9PT0gRm9ybWF0VHlwZS5OZXdMaW5lKSB7XG5cdFx0Y2hpbGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdicicpO1xuXHR9IGVsc2UgaWYgKHRyZWVOb2RlLnR5cGUgPT09IEZvcm1hdFR5cGUuUm9vdCkge1xuXHRcdGNoaWxkID0gZWxlbWVudDtcblx0fVxuXG5cdGlmIChjaGlsZCAmJiBlbGVtZW50ICE9PSBjaGlsZCkge1xuXHRcdGVsZW1lbnQuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuXHR9XG5cblx0aWYgKGNoaWxkICYmIEFycmF5LmlzQXJyYXkodHJlZU5vZGUuY2hpbGRyZW4pKSB7XG5cdFx0dHJlZU5vZGUuY2hpbGRyZW4uZm9yRWFjaCgobm9kZUNoaWxkKSA9PiB7XG5cdFx0XHRfcmVuZGVyRm9ybWF0dGVkVGV4dChjaGlsZCwgbm9kZUNoaWxkLCBhY3Rpb25IYW5kbGVyLCByZW5kZXJDb2RlU2VnbWVudHMpO1xuXHRcdH0pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHBhcnNlRm9ybWF0dGVkVGV4dChjb250ZW50OiBzdHJpbmcsIHBhcnNlQ29kZVNlZ21lbnRzOiBib29sZWFuKTogSUZvcm1hdFBhcnNlVHJlZSB7XG5cblx0Y29uc3Qgcm9vdDogSUZvcm1hdFBhcnNlVHJlZSA9IHtcblx0XHR0eXBlOiBGb3JtYXRUeXBlLlJvb3QsXG5cdFx0Y2hpbGRyZW46IFtdXG5cdH07XG5cblx0bGV0IGFjdGlvblZpZXdJdGVtSW5kZXggPSAwO1xuXHRsZXQgY3VycmVudCA9IHJvb3Q7XG5cdGNvbnN0IHN0YWNrOiBJRm9ybWF0UGFyc2VUcmVlW10gPSBbXTtcblx0Y29uc3Qgc3RyZWFtID0gbmV3IFN0cmluZ1N0cmVhbShjb250ZW50KTtcblxuXHR3aGlsZSAoIXN0cmVhbS5lb3MoKSkge1xuXHRcdGxldCBuZXh0ID0gc3RyZWFtLm5leHQoKTtcblxuXHRcdGNvbnN0IGlzRXNjYXBlZEZvcm1hdFR5cGUgPSAobmV4dCA9PT0gJ1xcXFwnICYmIGZvcm1hdFRhZ1R5cGUoc3RyZWFtLnBlZWsoKSwgcGFyc2VDb2RlU2VnbWVudHMpICE9PSBGb3JtYXRUeXBlLkludmFsaWQpO1xuXHRcdGlmIChpc0VzY2FwZWRGb3JtYXRUeXBlKSB7XG5cdFx0XHRuZXh0ID0gc3RyZWFtLm5leHQoKTsgLy8gdW5yZWFkIHRoZSBiYWNrc2xhc2ggaWYgaXQgZXNjYXBlcyBhIGZvcm1hdCB0YWcgdHlwZVxuXHRcdH1cblxuXHRcdGlmICghaXNFc2NhcGVkRm9ybWF0VHlwZSAmJiBpc0Zvcm1hdFRhZyhuZXh0LCBwYXJzZUNvZGVTZWdtZW50cykgJiYgbmV4dCA9PT0gc3RyZWFtLnBlZWsoKSkge1xuXHRcdFx0c3RyZWFtLmFkdmFuY2UoKTtcblxuXHRcdFx0aWYgKGN1cnJlbnQudHlwZSA9PT0gRm9ybWF0VHlwZS5UZXh0KSB7XG5cdFx0XHRcdGN1cnJlbnQgPSBzdGFjay5wb3AoKSE7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHR5cGUgPSBmb3JtYXRUYWdUeXBlKG5leHQsIHBhcnNlQ29kZVNlZ21lbnRzKTtcblx0XHRcdGlmIChjdXJyZW50LnR5cGUgPT09IHR5cGUgfHwgKGN1cnJlbnQudHlwZSA9PT0gRm9ybWF0VHlwZS5BY3Rpb24gJiYgdHlwZSA9PT0gRm9ybWF0VHlwZS5BY3Rpb25DbG9zZSkpIHtcblx0XHRcdFx0Y3VycmVudCA9IHN0YWNrLnBvcCgpITtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IG5ld0N1cnJlbnQ6IElGb3JtYXRQYXJzZVRyZWUgPSB7XG5cdFx0XHRcdFx0dHlwZTogdHlwZSxcblx0XHRcdFx0XHRjaGlsZHJlbjogW11cblx0XHRcdFx0fTtcblxuXHRcdFx0XHRpZiAodHlwZSA9PT0gRm9ybWF0VHlwZS5BY3Rpb24pIHtcblx0XHRcdFx0XHRuZXdDdXJyZW50LmluZGV4ID0gYWN0aW9uVmlld0l0ZW1JbmRleDtcblx0XHRcdFx0XHRhY3Rpb25WaWV3SXRlbUluZGV4Kys7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjdXJyZW50LmNoaWxkcmVuIS5wdXNoKG5ld0N1cnJlbnQpO1xuXHRcdFx0XHRzdGFjay5wdXNoKGN1cnJlbnQpO1xuXHRcdFx0XHRjdXJyZW50ID0gbmV3Q3VycmVudDtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKG5leHQgPT09ICdcXG4nKSB7XG5cdFx0XHRpZiAoY3VycmVudC50eXBlID09PSBGb3JtYXRUeXBlLlRleHQpIHtcblx0XHRcdFx0Y3VycmVudCA9IHN0YWNrLnBvcCgpITtcblx0XHRcdH1cblxuXHRcdFx0Y3VycmVudC5jaGlsZHJlbiEucHVzaCh7XG5cdFx0XHRcdHR5cGU6IEZvcm1hdFR5cGUuTmV3TGluZVxuXHRcdFx0fSk7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGN1cnJlbnQudHlwZSAhPT0gRm9ybWF0VHlwZS5UZXh0KSB7XG5cdFx0XHRcdGNvbnN0IHRleHRDdXJyZW50OiBJRm9ybWF0UGFyc2VUcmVlID0ge1xuXHRcdFx0XHRcdHR5cGU6IEZvcm1hdFR5cGUuVGV4dCxcblx0XHRcdFx0XHRjb250ZW50OiBuZXh0XG5cdFx0XHRcdH07XG5cdFx0XHRcdGN1cnJlbnQuY2hpbGRyZW4hLnB1c2godGV4dEN1cnJlbnQpO1xuXHRcdFx0XHRzdGFjay5wdXNoKGN1cnJlbnQpO1xuXHRcdFx0XHRjdXJyZW50ID0gdGV4dEN1cnJlbnQ7XG5cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGN1cnJlbnQuY29udGVudCArPSBuZXh0O1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmIChjdXJyZW50LnR5cGUgPT09IEZvcm1hdFR5cGUuVGV4dCkge1xuXHRcdGN1cnJlbnQgPSBzdGFjay5wb3AoKSE7XG5cdH1cblxuXHRpZiAoc3RhY2subGVuZ3RoKSB7XG5cdFx0Ly8gaW5jb3JyZWN0bHkgZm9ybWF0dGVkIHN0cmluZyBsaXRlcmFsXG5cdH1cblxuXHRyZXR1cm4gcm9vdDtcbn1cblxuZnVuY3Rpb24gaXNGb3JtYXRUYWcoY2hhcjogc3RyaW5nLCBzdXBwb3J0Q29kZVNlZ21lbnRzOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdHJldHVybiBmb3JtYXRUYWdUeXBlKGNoYXIsIHN1cHBvcnRDb2RlU2VnbWVudHMpICE9PSBGb3JtYXRUeXBlLkludmFsaWQ7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFRhZ1R5cGUoY2hhcjogc3RyaW5nLCBzdXBwb3J0Q29kZVNlZ21lbnRzOiBib29sZWFuKTogRm9ybWF0VHlwZSB7XG5cdHN3aXRjaCAoY2hhcikge1xuXHRcdGNhc2UgJyonOlxuXHRcdFx0cmV0dXJuIEZvcm1hdFR5cGUuQm9sZDtcblx0XHRjYXNlICdfJzpcblx0XHRcdHJldHVybiBGb3JtYXRUeXBlLkl0YWxpY3M7XG5cdFx0Y2FzZSAnWyc6XG5cdFx0XHRyZXR1cm4gRm9ybWF0VHlwZS5BY3Rpb247XG5cdFx0Y2FzZSAnXSc6XG5cdFx0XHRyZXR1cm4gRm9ybWF0VHlwZS5BY3Rpb25DbG9zZTtcblx0XHRjYXNlICdgJzpcblx0XHRcdHJldHVybiBzdXBwb3J0Q29kZVNlZ21lbnRzID8gRm9ybWF0VHlwZS5Db2RlIDogRm9ybWF0VHlwZS5JbnZhbGlkO1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gRm9ybWF0VHlwZS5JbnZhbGlkO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFpQmQsU0FBUyxXQUFXLE1BQWMsVUFBc0MsQ0FBQyxHQUFnQjtBQUMvRixRQUFNLFVBQVUsY0FBYyxPQUFPO0FBQ3JDLFVBQVEsY0FBYztBQUN0QixTQUFPO0FBQ1I7QUFFTyxTQUFTLG9CQUFvQixlQUF1QixVQUFzQyxDQUFDLEdBQWdCO0FBQ2pILFFBQU0sVUFBVSxjQUFjLE9BQU87QUFDckMsdUJBQXFCLFNBQVMsbUJBQW1CLGVBQWUsQ0FBQyxDQUFDLFFBQVEsa0JBQWtCLEdBQUcsUUFBUSxlQUFlLFFBQVEsa0JBQWtCO0FBQ2hKLFNBQU87QUFDUjtBQUVPLFNBQVMsY0FBYyxTQUFrRDtBQUMvRSxRQUFNLFVBQVUsUUFBUSxTQUFTLFNBQVM7QUFDMUMsUUFBTSxVQUFVLFNBQVMsY0FBYyxPQUFPO0FBQzlDLE1BQUksUUFBUSxXQUFXO0FBQ3RCLFlBQVEsWUFBWSxRQUFRO0FBQUEsRUFDN0I7QUFDQSxTQUFPO0FBQ1I7QUFF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QU0sT0FBTyxjQUFjLE1BQU0saUJBQWlCO0FBQ2xELFVBQUksUUFBUSxTQUFTLFFBQVMsUUFBUSxTQUFTLGtCQUFxQixTQUFTLHFCQUF5QjtBQUNyRyxrQkFBVSxNQUFNLElBQUk7QUFBQSxNQUNyQixPQUFPO0FBQ04sY0FBTSxhQUErQjtBQUFBLFVBQ3BDO0FBQUEsVUFDQSxVQUFVLENBQUM7QUFBQSxRQUNaO0FBRUEsWUFBSSxTQUFTLGdCQUFtQjtBQUMvQixxQkFBVyxRQUFRO0FBQ25CO0FBQUEsUUFDRDtBQUVBLGdCQUFRLFNBQVUsS0FBSyxVQUFVO0FBQ2pDLGNBQU0sS0FBSyxPQUFPO0FBQ2xCLGtCQUFVO0FBQUEsTUFDWDtBQUFBLElBQ0QsV0FBVyxTQUFTLE1BQU07QUFDekIsVUFBSSxRQUFRLFNBQVMsY0FBaUI7QUFDckMsa0JBQVUsTUFBTSxJQUFJO0FBQUEsTUFDckI7QUFFQSxjQUFRLFNBQVUsS0FBSztBQUFBLFFBQ3RCLE1BQU07QUFBQSxNQUNQLENBQUM7QUFBQSxJQUVGLE9BQU87QUFDTixVQUFJLFFBQVEsU0FBUyxjQUFpQjtBQUNyQyxjQUFNLGNBQWdDO0FBQUEsVUFDckMsTUFBTTtBQUFBLFVBQ04sU0FBUztBQUFBLFFBQ1Y7QUFDQSxnQkFBUSxTQUFVLEtBQUssV0FBVztBQUNsQyxjQUFNLEtBQUssT0FBTztBQUNsQixrQkFBVTtBQUFBLE1BRVgsT0FBTztBQUNOLGdCQUFRLFdBQVc7QUFBQSxNQUNwQjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBRUEsTUFBSSxRQUFRLFNBQVMsY0FBaUI7QUFDckMsY0FBVSxNQUFNLElBQUk7QUFBQSxFQUNyQjtBQUVBLE1BQUksTUFBTSxRQUFRO0FBQUEsRUFFbEI7QUFFQSxTQUFPO0FBQ1I7QUFFQSxTQUFTLFlBQVksTUFBYyxxQkFBdUM7QUFDekUsU0FBTyxjQUFjLE1BQU0sbUJBQW1CLE1BQU07QUFDckQ7QUFFQSxTQUFTLGNBQWMsTUFBYyxxQkFBMEM7QUFDOUUsVUFBUSxNQUFNO0FBQUEsSUFDYixLQUFLO0FBQ0osYUFBTztBQUFBLElBQ1IsS0FBSztBQUNKLGFBQU87QUFBQSxJQUNSLEtBQUs7QUFDSixhQUFPO0FBQUEsSUFDUixLQUFLO0FBQ0osYUFBTztBQUFBLElBQ1IsS0FBSztBQUNKLGFBQU8sc0JBQXNCLGVBQWtCO0FBQUEsSUFDaEQ7QUFDQyxhQUFPO0FBQUEsRUFDVDtBQUNEOyIsCiAgIm5hbWVzIjogWyJGb3JtYXRUeXBlIl0KfQo=
