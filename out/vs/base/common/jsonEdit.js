import { findNodeAtLocation, parseTree } from "./json.js";
import { format, isEOL } from "./jsonFormatter.js";
function removeProperty(text, path, formattingOptions) {
  return setProperty(text, path, void 0, formattingOptions);
}
function setProperty(text, originalPath, value, formattingOptions, getInsertionIndex) {
  const path = originalPath.slice();
  const errors = [];
  const root = parseTree(text, errors);
  let parent = void 0;
  let lastSegment = void 0;
  while (path.length > 0) {
    lastSegment = path.pop();
    parent = findNodeAtLocation(root, path);
    if (parent === void 0 && value !== void 0) {
      if (typeof lastSegment === "string") {
        value = { [lastSegment]: value };
      } else {
        value = [value];
      }
    } else {
      break;
    }
  }
  if (!parent) {
    if (value === void 0) {
      return [];
    }
    return withFormatting(text, { offset: root ? root.offset : 0, length: root ? root.length : 0, content: JSON.stringify(value) }, formattingOptions);
  } else if (parent.type === "object" && typeof lastSegment === "string" && Array.isArray(parent.children)) {
    const existing = findNodeAtLocation(parent, [lastSegment]);
    if (existing !== void 0) {
      if (value === void 0) {
        if (!existing.parent) {
          throw new Error("Malformed AST");
        }
        const propertyIndex = parent.children.indexOf(existing.parent);
        let removeBegin;
        let removeEnd = existing.parent.offset + existing.parent.length;
        if (propertyIndex > 0) {
          const previous = parent.children[propertyIndex - 1];
          removeBegin = previous.offset + previous.length;
        } else {
          removeBegin = parent.offset + 1;
          if (parent.children.length > 1) {
            const next = parent.children[1];
            removeEnd = next.offset;
          }
        }
        return withFormatting(text, { offset: removeBegin, length: removeEnd - removeBegin, content: "" }, formattingOptions);
      } else {
        return withFormatting(text, { offset: existing.offset, length: existing.length, content: JSON.stringify(value) }, formattingOptions);
      }
    } else {
      if (value === void 0) {
        return [];
      }
      const newProperty = `${JSON.stringify(lastSegment)}: ${JSON.stringify(value)}`;
      const index = getInsertionIndex ? getInsertionIndex(parent.children.map((p) => p.children[0].value)) : parent.children.length;
      let edit;
      if (index > 0) {
        const previous = parent.children[index - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      } else if (parent.children.length === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty };
      } else {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty + "," };
      }
      return withFormatting(text, edit, formattingOptions);
    }
  } else if (parent.type === "array" && typeof lastSegment === "number" && Array.isArray(parent.children)) {
    if (value !== void 0) {
      const newProperty = `${JSON.stringify(value)}`;
      let edit;
      if (parent.children.length === 0 || lastSegment === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: parent.children.length === 0 ? newProperty : newProperty + "," };
      } else {
        const index = lastSegment === -1 || lastSegment > parent.children.length ? parent.children.length : lastSegment;
        const previous = parent.children[index - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      }
      return withFormatting(text, edit, formattingOptions);
    } else {
      const removalIndex = lastSegment;
      const toRemove = parent.children[removalIndex];
      let edit;
      if (parent.children.length === 1) {
        edit = { offset: parent.offset + 1, length: parent.length - 2, content: "" };
      } else if (parent.children.length - 1 === removalIndex) {
        const previous = parent.children[removalIndex - 1];
        const offset = previous.offset + previous.length;
        const parentEndOffset = parent.offset + parent.length;
        edit = { offset, length: parentEndOffset - 2 - offset, content: "" };
      } else {
        edit = { offset: toRemove.offset, length: parent.children[removalIndex + 1].offset - toRemove.offset, content: "" };
      }
      return withFormatting(text, edit, formattingOptions);
    }
  } else {
    throw new Error(`Can not add ${typeof lastSegment !== "number" ? "index" : "property"} to parent of type ${parent.type}`);
  }
}
function withFormatting(text, edit, formattingOptions) {
  let newText = applyEdit(text, edit);
  let begin = edit.offset;
  let end = edit.offset + edit.content.length;
  if (edit.length === 0 || edit.content.length === 0) {
    while (begin > 0 && !isEOL(newText, begin - 1)) {
      begin--;
    }
    while (end < newText.length && !isEOL(newText, end)) {
      end++;
    }
  }
  const edits = format(newText, { offset: begin, length: end - begin }, formattingOptions);
  for (let i = edits.length - 1; i >= 0; i--) {
    const curr = edits[i];
    newText = applyEdit(newText, curr);
    begin = Math.min(begin, curr.offset);
    end = Math.max(end, curr.offset + curr.length);
    end += curr.content.length - curr.length;
  }
  const editLength = text.length - (newText.length - end) - begin;
  return [{ offset: begin, length: editLength, content: newText.substring(begin, end) }];
}
function applyEdit(text, edit) {
  return text.substring(0, edit.offset) + edit.content + text.substring(edit.offset + edit.length);
}
function applyEdits(text, edits) {
  const sortedEdits = edits.slice(0).sort((a, b) => {
    const diff = a.offset - b.offset;
    if (diff === 0) {
      return a.length - b.length;
    }
    return diff;
  });
  let lastModifiedOffset = text.length;
  for (let i = sortedEdits.length - 1; i >= 0; i--) {
    const e = sortedEdits[i];
    if (e.offset + e.length <= lastModifiedOffset) {
      text = applyEdit(text, e);
    } else {
      throw new Error("Overlapping edit");
    }
    lastModifiedOffset = e.offset;
  }
  return text;
}
export {
  applyEdit,
  applyEdits,
  removeProperty,
  setProperty,
  withFormatting
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9qc29uRWRpdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGZpbmROb2RlQXRMb2NhdGlvbiwgSlNPTlBhdGgsIE5vZGUsIFBhcnNlRXJyb3IsIHBhcnNlVHJlZSwgU2VnbWVudCB9IGZyb20gJy4vanNvbi5qcyc7XG5pbXBvcnQgeyBFZGl0LCBmb3JtYXQsIEZvcm1hdHRpbmdPcHRpb25zLCBpc0VPTCB9IGZyb20gJy4vanNvbkZvcm1hdHRlci5qcyc7XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZVByb3BlcnR5KHRleHQ6IHN0cmluZywgcGF0aDogSlNPTlBhdGgsIGZvcm1hdHRpbmdPcHRpb25zOiBGb3JtYXR0aW5nT3B0aW9ucyk6IEVkaXRbXSB7XG5cdHJldHVybiBzZXRQcm9wZXJ0eSh0ZXh0LCBwYXRoLCB1bmRlZmluZWQsIGZvcm1hdHRpbmdPcHRpb25zKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFByb3BlcnR5KHRleHQ6IHN0cmluZywgb3JpZ2luYWxQYXRoOiBKU09OUGF0aCwgdmFsdWU6IGFueSwgZm9ybWF0dGluZ09wdGlvbnM6IEZvcm1hdHRpbmdPcHRpb25zLCBnZXRJbnNlcnRpb25JbmRleD86IChwcm9wZXJ0aWVzOiBzdHJpbmdbXSkgPT4gbnVtYmVyKTogRWRpdFtdIHtcblx0Y29uc3QgcGF0aCA9IG9yaWdpbmFsUGF0aC5zbGljZSgpO1xuXHRjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuXHRjb25zdCByb290ID0gcGFyc2VUcmVlKHRleHQsIGVycm9ycyk7XG5cdGxldCBwYXJlbnQ6IE5vZGUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0bGV0IGxhc3RTZWdtZW50OiBTZWdtZW50IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHR3aGlsZSAocGF0aC5sZW5ndGggPiAwKSB7XG5cdFx0bGFzdFNlZ21lbnQgPSBwYXRoLnBvcCgpO1xuXHRcdHBhcmVudCA9IGZpbmROb2RlQXRMb2NhdGlvbihyb290LCBwYXRoKTtcblx0XHRpZiAocGFyZW50ID09PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aWYgKHR5cGVvZiBsYXN0U2VnbWVudCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0dmFsdWUgPSB7IFtsYXN0U2VnbWVudF06IHZhbHVlIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YWx1ZSA9IFt2YWx1ZV07XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdGlmICghcGFyZW50KSB7XG5cdFx0Ly8gZW1wdHkgZG9jdW1lbnRcblx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkgeyAvLyBkZWxldGVcblx0XHRcdHJldHVybiBbXTsgLy8gcHJvcGVydHkgZG9lcyBub3QgZXhpc3QsIG5vdGhpbmcgdG8gZG9cblx0XHR9XG5cdFx0cmV0dXJuIHdpdGhGb3JtYXR0aW5nKHRleHQsIHsgb2Zmc2V0OiByb290ID8gcm9vdC5vZmZzZXQgOiAwLCBsZW5ndGg6IHJvb3QgPyByb290Lmxlbmd0aCA6IDAsIGNvbnRlbnQ6IEpTT04uc3RyaW5naWZ5KHZhbHVlKSB9LCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdH0gZWxzZSBpZiAocGFyZW50LnR5cGUgPT09ICdvYmplY3QnICYmIHR5cGVvZiBsYXN0U2VnbWVudCA9PT0gJ3N0cmluZycgJiYgQXJyYXkuaXNBcnJheShwYXJlbnQuY2hpbGRyZW4pKSB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSBmaW5kTm9kZUF0TG9jYXRpb24ocGFyZW50LCBbbGFzdFNlZ21lbnRdKTtcblx0XHRpZiAoZXhpc3RpbmcgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHsgLy8gZGVsZXRlXG5cdFx0XHRcdGlmICghZXhpc3RpbmcucGFyZW50KSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdNYWxmb3JtZWQgQVNUJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgcHJvcGVydHlJbmRleCA9IHBhcmVudC5jaGlsZHJlbi5pbmRleE9mKGV4aXN0aW5nLnBhcmVudCk7XG5cdFx0XHRcdGxldCByZW1vdmVCZWdpbjogbnVtYmVyO1xuXHRcdFx0XHRsZXQgcmVtb3ZlRW5kID0gZXhpc3RpbmcucGFyZW50Lm9mZnNldCArIGV4aXN0aW5nLnBhcmVudC5sZW5ndGg7XG5cdFx0XHRcdGlmIChwcm9wZXJ0eUluZGV4ID4gMCkge1xuXHRcdFx0XHRcdC8vIHJlbW92ZSB0aGUgY29tbWEgb2YgdGhlIHByZXZpb3VzIG5vZGVcblx0XHRcdFx0XHRjb25zdCBwcmV2aW91cyA9IHBhcmVudC5jaGlsZHJlbltwcm9wZXJ0eUluZGV4IC0gMV07XG5cdFx0XHRcdFx0cmVtb3ZlQmVnaW4gPSBwcmV2aW91cy5vZmZzZXQgKyBwcmV2aW91cy5sZW5ndGg7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVtb3ZlQmVnaW4gPSBwYXJlbnQub2Zmc2V0ICsgMTtcblx0XHRcdFx0XHRpZiAocGFyZW50LmNoaWxkcmVuLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0XHRcdC8vIHJlbW92ZSB0aGUgY29tbWEgb2YgdGhlIG5leHQgbm9kZVxuXHRcdFx0XHRcdFx0Y29uc3QgbmV4dCA9IHBhcmVudC5jaGlsZHJlblsxXTtcblx0XHRcdFx0XHRcdHJlbW92ZUVuZCA9IG5leHQub2Zmc2V0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gd2l0aEZvcm1hdHRpbmcodGV4dCwgeyBvZmZzZXQ6IHJlbW92ZUJlZ2luLCBsZW5ndGg6IHJlbW92ZUVuZCAtIHJlbW92ZUJlZ2luLCBjb250ZW50OiAnJyB9LCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBzZXQgdmFsdWUgb2YgZXhpc3RpbmcgcHJvcGVydHlcblx0XHRcdFx0cmV0dXJuIHdpdGhGb3JtYXR0aW5nKHRleHQsIHsgb2Zmc2V0OiBleGlzdGluZy5vZmZzZXQsIGxlbmd0aDogZXhpc3RpbmcubGVuZ3RoLCBjb250ZW50OiBKU09OLnN0cmluZ2lmeSh2YWx1ZSkgfSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkgeyAvLyBkZWxldGVcblx0XHRcdFx0cmV0dXJuIFtdOyAvLyBwcm9wZXJ0eSBkb2VzIG5vdCBleGlzdCwgbm90aGluZyB0byBkb1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbmV3UHJvcGVydHkgPSBgJHtKU09OLnN0cmluZ2lmeShsYXN0U2VnbWVudCl9OiAke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gO1xuXHRcdFx0Y29uc3QgaW5kZXggPSBnZXRJbnNlcnRpb25JbmRleCA/IGdldEluc2VydGlvbkluZGV4KHBhcmVudC5jaGlsZHJlbi5tYXAocCA9PiBwLmNoaWxkcmVuIVswXS52YWx1ZSkpIDogcGFyZW50LmNoaWxkcmVuLmxlbmd0aDtcblx0XHRcdGxldCBlZGl0OiBFZGl0O1xuXHRcdFx0aWYgKGluZGV4ID4gMCkge1xuXHRcdFx0XHRjb25zdCBwcmV2aW91cyA9IHBhcmVudC5jaGlsZHJlbltpbmRleCAtIDFdO1xuXHRcdFx0XHRlZGl0ID0geyBvZmZzZXQ6IHByZXZpb3VzLm9mZnNldCArIHByZXZpb3VzLmxlbmd0aCwgbGVuZ3RoOiAwLCBjb250ZW50OiAnLCcgKyBuZXdQcm9wZXJ0eSB9O1xuXHRcdFx0fSBlbHNlIGlmIChwYXJlbnQuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdGVkaXQgPSB7IG9mZnNldDogcGFyZW50Lm9mZnNldCArIDEsIGxlbmd0aDogMCwgY29udGVudDogbmV3UHJvcGVydHkgfTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVkaXQgPSB7IG9mZnNldDogcGFyZW50Lm9mZnNldCArIDEsIGxlbmd0aDogMCwgY29udGVudDogbmV3UHJvcGVydHkgKyAnLCcgfTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB3aXRoRm9ybWF0dGluZyh0ZXh0LCBlZGl0LCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0fVxuXHR9IGVsc2UgaWYgKHBhcmVudC50eXBlID09PSAnYXJyYXknICYmIHR5cGVvZiBsYXN0U2VnbWVudCA9PT0gJ251bWJlcicgJiYgQXJyYXkuaXNBcnJheShwYXJlbnQuY2hpbGRyZW4pKSB7XG5cdFx0aWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdC8vIEluc2VydFxuXHRcdFx0Y29uc3QgbmV3UHJvcGVydHkgPSBgJHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YDtcblx0XHRcdGxldCBlZGl0OiBFZGl0O1xuXHRcdFx0aWYgKHBhcmVudC5jaGlsZHJlbi5sZW5ndGggPT09IDAgfHwgbGFzdFNlZ21lbnQgPT09IDApIHtcblx0XHRcdFx0ZWRpdCA9IHsgb2Zmc2V0OiBwYXJlbnQub2Zmc2V0ICsgMSwgbGVuZ3RoOiAwLCBjb250ZW50OiBwYXJlbnQuY2hpbGRyZW4ubGVuZ3RoID09PSAwID8gbmV3UHJvcGVydHkgOiBuZXdQcm9wZXJ0eSArICcsJyB9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgaW5kZXggPSBsYXN0U2VnbWVudCA9PT0gLTEgfHwgbGFzdFNlZ21lbnQgPiBwYXJlbnQuY2hpbGRyZW4ubGVuZ3RoID8gcGFyZW50LmNoaWxkcmVuLmxlbmd0aCA6IGxhc3RTZWdtZW50O1xuXHRcdFx0XHRjb25zdCBwcmV2aW91cyA9IHBhcmVudC5jaGlsZHJlbltpbmRleCAtIDFdO1xuXHRcdFx0XHRlZGl0ID0geyBvZmZzZXQ6IHByZXZpb3VzLm9mZnNldCArIHByZXZpb3VzLmxlbmd0aCwgbGVuZ3RoOiAwLCBjb250ZW50OiAnLCcgKyBuZXdQcm9wZXJ0eSB9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHdpdGhGb3JtYXR0aW5nKHRleHQsIGVkaXQsIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly9SZW1vdmFsXG5cdFx0XHRjb25zdCByZW1vdmFsSW5kZXggPSBsYXN0U2VnbWVudDtcblx0XHRcdGNvbnN0IHRvUmVtb3ZlID0gcGFyZW50LmNoaWxkcmVuW3JlbW92YWxJbmRleF07XG5cdFx0XHRsZXQgZWRpdDogRWRpdDtcblx0XHRcdGlmIChwYXJlbnQuY2hpbGRyZW4ubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdC8vIG9ubHkgaXRlbVxuXHRcdFx0XHRlZGl0ID0geyBvZmZzZXQ6IHBhcmVudC5vZmZzZXQgKyAxLCBsZW5ndGg6IHBhcmVudC5sZW5ndGggLSAyLCBjb250ZW50OiAnJyB9O1xuXHRcdFx0fSBlbHNlIGlmIChwYXJlbnQuY2hpbGRyZW4ubGVuZ3RoIC0gMSA9PT0gcmVtb3ZhbEluZGV4KSB7XG5cdFx0XHRcdC8vIGxhc3QgaXRlbVxuXHRcdFx0XHRjb25zdCBwcmV2aW91cyA9IHBhcmVudC5jaGlsZHJlbltyZW1vdmFsSW5kZXggLSAxXTtcblx0XHRcdFx0Y29uc3Qgb2Zmc2V0ID0gcHJldmlvdXMub2Zmc2V0ICsgcHJldmlvdXMubGVuZ3RoO1xuXHRcdFx0XHRjb25zdCBwYXJlbnRFbmRPZmZzZXQgPSBwYXJlbnQub2Zmc2V0ICsgcGFyZW50Lmxlbmd0aDtcblx0XHRcdFx0ZWRpdCA9IHsgb2Zmc2V0LCBsZW5ndGg6IHBhcmVudEVuZE9mZnNldCAtIDIgLSBvZmZzZXQsIGNvbnRlbnQ6ICcnIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlZGl0ID0geyBvZmZzZXQ6IHRvUmVtb3ZlLm9mZnNldCwgbGVuZ3RoOiBwYXJlbnQuY2hpbGRyZW5bcmVtb3ZhbEluZGV4ICsgMV0ub2Zmc2V0IC0gdG9SZW1vdmUub2Zmc2V0LCBjb250ZW50OiAnJyB9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHdpdGhGb3JtYXR0aW5nKHRleHQsIGVkaXQsIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBDYW4gbm90IGFkZCAke3R5cGVvZiBsYXN0U2VnbWVudCAhPT0gJ251bWJlcicgPyAnaW5kZXgnIDogJ3Byb3BlcnR5J30gdG8gcGFyZW50IG9mIHR5cGUgJHtwYXJlbnQudHlwZX1gKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd2l0aEZvcm1hdHRpbmcodGV4dDogc3RyaW5nLCBlZGl0OiBFZGl0LCBmb3JtYXR0aW5nT3B0aW9uczogRm9ybWF0dGluZ09wdGlvbnMpOiBFZGl0W10ge1xuXHQvLyBhcHBseSB0aGUgZWRpdFxuXHRsZXQgbmV3VGV4dCA9IGFwcGx5RWRpdCh0ZXh0LCBlZGl0KTtcblxuXHQvLyBmb3JtYXQgdGhlIG5ldyB0ZXh0XG5cdGxldCBiZWdpbiA9IGVkaXQub2Zmc2V0O1xuXHRsZXQgZW5kID0gZWRpdC5vZmZzZXQgKyBlZGl0LmNvbnRlbnQubGVuZ3RoO1xuXHRpZiAoZWRpdC5sZW5ndGggPT09IDAgfHwgZWRpdC5jb250ZW50Lmxlbmd0aCA9PT0gMCkgeyAvLyBpbnNlcnQgb3IgcmVtb3ZlXG5cdFx0d2hpbGUgKGJlZ2luID4gMCAmJiAhaXNFT0wobmV3VGV4dCwgYmVnaW4gLSAxKSkge1xuXHRcdFx0YmVnaW4tLTtcblx0XHR9XG5cdFx0d2hpbGUgKGVuZCA8IG5ld1RleHQubGVuZ3RoICYmICFpc0VPTChuZXdUZXh0LCBlbmQpKSB7XG5cdFx0XHRlbmQrKztcblx0XHR9XG5cdH1cblxuXHRjb25zdCBlZGl0cyA9IGZvcm1hdChuZXdUZXh0LCB7IG9mZnNldDogYmVnaW4sIGxlbmd0aDogZW5kIC0gYmVnaW4gfSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdC8vIGFwcGx5IHRoZSBmb3JtYXR0aW5nIGVkaXRzIGFuZCB0cmFjayB0aGUgYmVnaW4gYW5kIGVuZCBvZmZzZXRzIG9mIHRoZSBjaGFuZ2VzXG5cdGZvciAobGV0IGkgPSBlZGl0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdGNvbnN0IGN1cnIgPSBlZGl0c1tpXTtcblx0XHRuZXdUZXh0ID0gYXBwbHlFZGl0KG5ld1RleHQsIGN1cnIpO1xuXHRcdGJlZ2luID0gTWF0aC5taW4oYmVnaW4sIGN1cnIub2Zmc2V0KTtcblx0XHRlbmQgPSBNYXRoLm1heChlbmQsIGN1cnIub2Zmc2V0ICsgY3Vyci5sZW5ndGgpO1xuXHRcdGVuZCArPSBjdXJyLmNvbnRlbnQubGVuZ3RoIC0gY3Vyci5sZW5ndGg7XG5cdH1cblx0Ly8gY3JlYXRlIGEgc2luZ2xlIGVkaXQgd2l0aCBhbGwgY2hhbmdlc1xuXHRjb25zdCBlZGl0TGVuZ3RoID0gdGV4dC5sZW5ndGggLSAobmV3VGV4dC5sZW5ndGggLSBlbmQpIC0gYmVnaW47XG5cdHJldHVybiBbeyBvZmZzZXQ6IGJlZ2luLCBsZW5ndGg6IGVkaXRMZW5ndGgsIGNvbnRlbnQ6IG5ld1RleHQuc3Vic3RyaW5nKGJlZ2luLCBlbmQpIH1dO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlFZGl0KHRleHQ6IHN0cmluZywgZWRpdDogRWRpdCk6IHN0cmluZyB7XG5cdHJldHVybiB0ZXh0LnN1YnN0cmluZygwLCBlZGl0Lm9mZnNldCkgKyBlZGl0LmNvbnRlbnQgKyB0ZXh0LnN1YnN0cmluZyhlZGl0Lm9mZnNldCArIGVkaXQubGVuZ3RoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5RWRpdHModGV4dDogc3RyaW5nLCBlZGl0czogRWRpdFtdKTogc3RyaW5nIHtcblx0Y29uc3Qgc29ydGVkRWRpdHMgPSBlZGl0cy5zbGljZSgwKS5zb3J0KChhLCBiKSA9PiB7XG5cdFx0Y29uc3QgZGlmZiA9IGEub2Zmc2V0IC0gYi5vZmZzZXQ7XG5cdFx0aWYgKGRpZmYgPT09IDApIHtcblx0XHRcdHJldHVybiBhLmxlbmd0aCAtIGIubGVuZ3RoO1xuXHRcdH1cblx0XHRyZXR1cm4gZGlmZjtcblx0fSk7XG5cdGxldCBsYXN0TW9kaWZpZWRPZmZzZXQgPSB0ZXh0Lmxlbmd0aDtcblx0Zm9yIChsZXQgaSA9IHNvcnRlZEVkaXRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0Y29uc3QgZSA9IHNvcnRlZEVkaXRzW2ldO1xuXHRcdGlmIChlLm9mZnNldCArIGUubGVuZ3RoIDw9IGxhc3RNb2RpZmllZE9mZnNldCkge1xuXHRcdFx0dGV4dCA9IGFwcGx5RWRpdCh0ZXh0LCBlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdPdmVybGFwcGluZyBlZGl0Jyk7XG5cdFx0fVxuXHRcdGxhc3RNb2RpZmllZE9mZnNldCA9IGUub2Zmc2V0O1xuXHR9XG5cdHJldHVybiB0ZXh0O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxvQkFBZ0QsaUJBQTBCO0FBQ25GLFNBQWUsUUFBMkIsYUFBYTtBQUdoRCxTQUFTLGVBQWUsTUFBYyxNQUFnQixtQkFBOEM7QUFDMUcsU0FBTyxZQUFZLE1BQU0sTUFBTSxRQUFXLGlCQUFpQjtBQUM1RDtBQUVPLFNBQVMsWUFBWSxNQUFjLGNBQXdCLE9BQVksbUJBQXNDLG1CQUE4RDtBQUNqTCxRQUFNLE9BQU8sYUFBYSxNQUFNO0FBQ2hDLFFBQU0sU0FBdUIsQ0FBQztBQUM5QixRQUFNLE9BQU8sVUFBVSxNQUFNLE1BQU07QUFDbkMsTUFB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
