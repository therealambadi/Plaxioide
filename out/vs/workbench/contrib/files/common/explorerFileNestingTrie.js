class ExplorerFileNestingTrie {
  constructor(config) {
    this.root = new PreTrie();
    for (const [parentPattern, childPatterns] of config) {
      for (const childPattern of childPatterns) {
        this.root.add(parentPattern, childPattern);
      }
    }
  }
  toString() {
    return this.root.toString();
  }
  getAttributes(filename, dirname) {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot < 1) {
      return {
        dirname,
        basename: filename,
        extname: ""
      };
    } else {
      return {
        dirname,
        basename: filename.substring(0, lastDot),
        extname: filename.substring(lastDot + 1)
      };
    }
  }
  nest(files, dirname) {
    const parentFinder = new PreTrie();
    for (const potentialParent of files) {
      const attributes = this.getAttributes(potentialParent, dirname);
      const children = this.root.get(potentialParent, attributes);
      for (const child of children) {
        parentFinder.add(child, potentialParent);
      }
    }
    const findAllRootAncestors = (file, seen = /* @__PURE__ */ new Set()) => {
      if (seen.has(file)) {
        return [];
      }
      seen.add(file);
      const attributes = this.getAttributes(file, dirname);
      const ancestors = parentFinder.get(file, attributes);
      if (ancestors.length === 0) {
        return [file];
      }
      if (ancestors.length === 1 && ancestors[0] === file) {
        return [file];
      }
      return ancestors.flatMap((a) => findAllRootAncestors(a, seen));
    };
    const result = /* @__PURE__ */ new Map();
    for (const file of files) {
      let ancestors = findAllRootAncestors(file);
      if (ancestors.length === 0) {
        ancestors = [file];
      }
      for (const ancestor of ancestors) {
        let existing = result.get(ancestor);
        if (!existing) {
          result.set(ancestor, existing = /* @__PURE__ */ new Set());
        }
        if (file !== ancestor) {
          existing.add(file);
        }
      }
    }
    return result;
  }
}
class PreTrie {
  constructor() {
    this.value = new SufTrie();
    this.map = /* @__PURE__ */ new Map();
  }
  add(key, value) {
    if (key === "") {
      this.value.add(key, value);
    } else if (key[0] === "*") {
      this.value.add(key, value);
    } else {
      const head = key[0];
      const rest = key.slice(1);
      let existing = this.map.get(head);
      if (!existing) {
        this.map.set(head, existing = new PreTrie());
      }
      existing.add(rest, value);
    }
  }
  get(key, attributes) {
    const results = [];
    results.push(...this.value.get(key, attributes));
    const head = key[0];
    const rest = key.slice(1);
    const existing = this.map.get(head);
    if (existing) {
      results.push(...existing.get(rest, attributes));
    }
    return results;
  }
  toString(indentation = "") {
    const lines = [];
    if (this.value.hasItems) {
      lines.push("* => \n" + this.value.toString(indentation + "  "));
    }
    [...this.map.entries()].map(([key, trie]) => lines.push("^" + key + " => \n" + trie.toString(indentation + "  ")));
    return lines.map((l) => indentation + l).join("\n");
  }
}
class SufTrie {
  constructor() {
    this.star = [];
    this.epsilon = [];
    this.map = /* @__PURE__ */ new Map();
    this.hasItems = false;
  }
  add(key, value) {
    this.hasItems = true;
    if (key === "*") {
      this.star.push(new SubstitutionString(value));
    } else if (key === "") {
      this.epsilon.push(new SubstitutionString(value));
    } else {
      const tail = key[key.length - 1];
      const rest = key.slice(0, key.length - 1);
      if (tail === "*") {
        throw Error("Unexpected star in SufTrie key: " + key);
      } else {
        let existing = this.map.get(tail);
        if (!existing) {
          this.map.set(tail, existing = new SufTrie());
        }
        existing.add(rest, value);
      }
    }
  }
  get(key, attributes) {
    const results = [];
    if (key === "") {
      results.push(...this.epsilon.map((ss) => ss.substitute(attributes)));
    }
    if (this.star.length) {
      results.push(...this.star.map((ss) => ss.substitute(attributes, key)));
    }
    const tail = key[key.length - 1];
    const rest = key.slice(0, key.length - 1);
    const existing = this.map.get(tail);
    if (existing) {
      results.push(...existing.get(rest, attributes));
    }
    return results;
  }
  toString(indentation = "") {
    const lines = [];
    if (this.star.length) {
      lines.push("* => " + this.star.join("; "));
    }
    if (this.epsilon.length) {
      lines.push("\u03B5 => " + this.epsilon.join("; "));
    }
    [...this.map.entries()].map(([key, trie]) => lines.push(key + "$ => \n" + trie.toString(indentation + "  ")));
    return lines.map((l) => indentation + l).join("\n");
  }
}
var SubstitutionType = /* @__PURE__ */ ((SubstitutionType2) => {
  SubstitutionType2["capture"] = "capture";
  SubstitutionType2["basename"] = "basename";
  SubstitutionType2["dirname"] = "dirname";
  SubstitutionType2["extname"] = "extname";
  return SubstitutionType2;
})(SubstitutionType || {});
const substitutionStringTokenizer = /\$[({](capture|basename|dirname|extname)[)}]/g;
class SubstitutionString {
  constructor(pattern) {
    this.tokens = [];
    substitutionStringTokenizer.lastIndex = 0;
    let token;
    let lastIndex = 0;
    while (token = substitutionStringTokenizer.exec(pattern)) {
      const prefix = pattern.slice(lastIndex, token.index);
      this.tokens.push(prefix);
      const type = token[1];
      switch (type) {
        case "basename" /* basename */:
        case "dirname" /* dirname */:
        case "extname" /* extname */:
        case "capture" /* capture */:
          this.tokens.push({ capture: type });
          break;
        default:
          throw Error("unknown substitution type: " + type);
      }
      lastIndex = token.index + token[0].length;
    }
    if (lastIndex !== pattern.length) {
      const suffix = pattern.slice(lastIndex, pattern.length);
      this.tokens.push(suffix);
    }
  }
  substitute(attributes, capture) {
    return this.tokens.map((t) => {
      if (typeof t === "string") {
        return t;
      }
      switch (t.capture) {
        case "basename" /* basename */:
          return attributes.basename;
        case "dirname" /* dirname */:
          return attributes.dirname;
        case "extname" /* extname */:
          return attributes.extname;
        case "capture" /* capture */:
          return capture || "";
      }
    }).join("");
  }
}
export {
  ExplorerFileNestingTrie,
  PreTrie,
  SufTrie
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9jb21tb24vZXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG50eXBlIEZpbGVuYW1lQXR0cmlidXRlcyA9IHtcblx0Ly8gaW5kZXgudGVzdCBpbiBpbmRleC50ZXN0Lmpzb25cblx0YmFzZW5hbWU6IHN0cmluZztcblx0Ly8ganNvbiBpbiBpbmRleC50ZXN0Lmpzb25cblx0ZXh0bmFtZTogc3RyaW5nO1xuXHQvLyBteS1mb2xkZXIgaW4gbXktZm9sZGVyL2luZGV4LnRlc3QuanNvblxuXHRkaXJuYW1lOiBzdHJpbmc7XG59O1xuXG4vKipcbiAqIEEgc29ydCBvZiBkb3VibGUtZW5kZWQgdHJpZSwgdXNlZCB0byBlZmZpY2llbnRseSBxdWVyeSBmb3IgbWF0Y2hlcyB0byBcInN0YXJcIiBwYXR0ZXJucywgd2hlcmVcbiAqIGEgZ2l2ZW4ga2V5IHJlcHJlc2VudHMgYSBwYXJlbnQgYW5kIG1heSBjb250YWluIGEgY2FwdHVyaW5nIGdyb3VwIChcIipcIiksIHdoaWNoIGNhbiB0aGVuIGJlXG4gKiByZWZlcmVuY2VkIHZpYSB0aGUgdG9rZW4gXCIkKGNhcHR1cmUpXCIgaW4gYXNzb2NpYXRlZCBjaGlsZCBwYXR0ZXJucy5cbiAqXG4gKiBUaGUgZ2VuZXJhdGVkIHRyZWUgd2lsbCBoYXZlIGF0IG1vc3QgdHdvIGxldmVscywgYXMgc3VidHJlZXMgYXJlIGZsYXR0ZW5lZCByYXRoZXIgdGhhbiBuZXN0ZWQuXG4gKlxuICogRXhhbXBsZTpcbiAqIFRoZSBjb25maWc6IFtcbiAqIFsgKi50cyAsIFsgJChjYXB0dXJlKS4qLnRzIDsgJChjYXB0dXJlKS5qcyBdIF1cbiAqIFsgKi5qcyAsIFsgJChjYXB0dXJlKS5taW4uanMgXSBdIF1cbiAqIE5lc3RzIHRoZSBmaWxlczogWyBhLnRzIDsgYS5kLnRzIDsgYS5qcyA7IGEubWluLmpzIDsgYi50cyA7IGIubWluLmpzIF1cbiAqIEFzOlxuICogLSBhLnRzID0+IFsgYS5kLnRzIDsgYS5qcyA7IGEubWluLmpzIF1cbiAqIC0gYi50cyA9PiBbIF1cbiAqIC0gYi5taW4udHMgPT4gWyBdXG4gKi9cbmV4cG9ydCBjbGFzcyBFeHBsb3JlckZpbGVOZXN0aW5nVHJpZSB7XG5cdHByaXZhdGUgcm9vdCA9IG5ldyBQcmVUcmllKCk7XG5cblx0Y29uc3RydWN0b3IoY29uZmlnOiBbc3RyaW5nLCBzdHJpbmdbXV1bXSkge1xuXHRcdGZvciAoY29uc3QgW3BhcmVudFBhdHRlcm4sIGNoaWxkUGF0dGVybnNdIG9mIGNvbmZpZykge1xuXHRcdFx0Zm9yIChjb25zdCBjaGlsZFBhdHRlcm4gb2YgY2hpbGRQYXR0ZXJucykge1xuXHRcdFx0XHR0aGlzLnJvb3QuYWRkKHBhcmVudFBhdHRlcm4sIGNoaWxkUGF0dGVybik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0dG9TdHJpbmcoKSB7XG5cdFx0cmV0dXJuIHRoaXMucm9vdC50b1N0cmluZygpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRBdHRyaWJ1dGVzKGZpbGVuYW1lOiBzdHJpbmcsIGRpcm5hbWU6IHN0cmluZyk6IEZpbGVuYW1lQXR0cmlidXRlcyB7XG5cdFx0Y29uc3QgbGFzdERvdCA9IGZpbGVuYW1lLmxhc3RJbmRleE9mKCcuJyk7XG5cdFx0aWYgKGxhc3REb3QgPCAxKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRkaXJuYW1lLFxuXHRcdFx0XHRiYXNlbmFtZTogZmlsZW5hbWUsXG5cdFx0XHRcdGV4dG5hbWU6ICcnXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRkaXJuYW1lLFxuXHRcdFx0XHRiYXNlbmFtZTogZmlsZW5hbWUuc3Vic3RyaW5nKDAsIGxhc3REb3QpLFxuXHRcdFx0XHRleHRuYW1lOiBmaWxlbmFtZS5zdWJzdHJpbmcobGFzdERvdCArIDEpXG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXG5cdG5lc3QoZmlsZXM6IHN0cmluZ1tdLCBkaXJuYW1lOiBzdHJpbmcpOiBNYXA8c3RyaW5nLCBTZXQ8c3RyaW5nPj4ge1xuXHRcdGNvbnN0IHBhcmVudEZpbmRlciA9IG5ldyBQcmVUcmllKCk7XG5cblx0XHRmb3IgKGNvbnN0IHBvdGVudGlhbFBhcmVudCBvZiBmaWxlcykge1xuXHRcdFx0Y29uc3QgYXR0cmlidXRlcyA9IHRoaXMuZ2V0QXR0cmlidXRlcyhwb3RlbnRpYWxQYXJlbnQsIGRpcm5hbWUpO1xuXHRcdFx0Y29uc3QgY2hpbGRyZW4gPSB0aGlzLnJvb3QuZ2V0KHBvdGVudGlhbFBhcmVudCwgYXR0cmlidXRlcyk7XG5cdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG5cdFx0XHRcdHBhcmVudEZpbmRlci5hZGQoY2hpbGQsIHBvdGVudGlhbFBhcmVudCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmluZEFsbFJvb3RBbmNlc3RvcnMgPSAoZmlsZTogc3RyaW5nLCBzZWVuOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKSk6IHN0cmluZ1tdID0+IHtcblx0XHRcdGlmIChzZWVuLmhhcyhmaWxlKSkgeyByZXR1cm4gW107IH1cblx0XHRcdHNlZW4uYWRkKGZpbGUpO1xuXHRcdFx0Y29uc3QgYXR0cmlidXRlcyA9IHRoaXMuZ2V0QXR0cmlidXRlcyhmaWxlLCBkaXJuYW1lKTtcblx0XHRcdGNvbnN0IGFuY2VzdG9ycyA9IHBhcmVudEZpbmRlci5nZXQoZmlsZSwgYXR0cmlidXRlcyk7XG5cdFx0XHRpZiAoYW5jZXN0b3JzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRyZXR1cm4gW2ZpbGVdO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYW5jZXN0b3JzLmxlbmd0aCA9PT0gMSAmJiBhbmNlc3RvcnNbMF0gPT09IGZpbGUpIHtcblx0XHRcdFx0cmV0dXJuIFtmaWxlXTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGFuY2VzdG9ycy5mbGF0TWFwKGEgPT4gZmluZEFsbFJvb3RBbmNlc3RvcnMoYSwgc2VlbikpO1xuXHRcdH07XG5cblx0XHRjb25zdCByZXN1bHQgPSBuZXcgTWFwPHN0cmluZywgU2V0PHN0cmluZz4+KCk7XG5cdFx0Zm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG5cdFx0XHRsZXQgYW5jZXN0b3JzID0gZmluZEFsbFJvb3RBbmNlc3RvcnMoZmlsZSk7XG5cdFx0XHRpZiAoYW5jZXN0b3JzLmxlbmd0aCA9PT0gMCkgeyBhbmNlc3RvcnMgPSBbZmlsZV07IH1cblx0XHRcdGZvciAoY29uc3QgYW5jZXN0b3Igb2YgYW5jZXN0b3JzKSB7XG5cdFx0XHRcdGxldCBleGlzdGluZyA9IHJlc3VsdC5nZXQoYW5jZXN0b3IpO1xuXHRcdFx0XHRpZiAoIWV4aXN0aW5nKSB7IHJlc3VsdC5zZXQoYW5jZXN0b3IsIGV4aXN0aW5nID0gbmV3IFNldCgpKTsgfVxuXHRcdFx0XHRpZiAoZmlsZSAhPT0gYW5jZXN0b3IpIHtcblx0XHRcdFx0XHRleGlzdGluZy5hZGQoZmlsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG4vKiogRXhwb3J0IGZvciB0ZXN0IG9ubHkuICovXG5leHBvcnQgY2xhc3MgUHJlVHJpZSB7XG5cdHByaXZhdGUgdmFsdWU6IFN1ZlRyaWUgPSBuZXcgU3VmVHJpZSgpO1xuXG5cdHByaXZhdGUgbWFwOiBNYXA8c3RyaW5nLCBQcmVUcmllPiA9IG5ldyBNYXAoKTtcblxuXHRjb25zdHJ1Y3RvcigpIHsgfVxuXG5cdGFkZChrZXk6IHN0cmluZywgdmFsdWU6IHN0cmluZykge1xuXHRcdGlmIChrZXkgPT09ICcnKSB7XG5cdFx0XHR0aGlzLnZhbHVlLmFkZChrZXksIHZhbHVlKTtcblx0XHR9IGVsc2UgaWYgKGtleVswXSA9PT0gJyonKSB7XG5cdFx0XHR0aGlzLnZhbHVlLmFkZChrZXksIHZhbHVlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgaGVhZCA9IGtleVswXTtcblx0XHRcdGNvbnN0IHJlc3QgPSBrZXkuc2xpY2UoMSk7XG5cdFx0XHRsZXQgZXhpc3RpbmcgPSB0aGlzLm1hcC5nZXQoaGVhZCk7XG5cdFx0XHRpZiAoIWV4aXN0aW5nKSB7XG5cdFx0XHRcdHRoaXMubWFwLnNldChoZWFkLCBleGlzdGluZyA9IG5ldyBQcmVUcmllKCkpO1xuXHRcdFx0fVxuXHRcdFx0ZXhpc3RpbmcuYWRkKHJlc3QsIHZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRnZXQoa2V5OiBzdHJpbmcsIGF0dHJpYnV0ZXM6IEZpbGVuYW1lQXR0cmlidXRlcyk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCByZXN1bHRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdHJlc3VsdHMucHVzaCguLi50aGlzLnZhbHVlLmdldChrZXksIGF0dHJpYnV0ZXMpKTtcblxuXHRcdGNvbnN0IGhlYWQgPSBrZXlbMF07XG5cdFx0Y29uc3QgcmVzdCA9IGtleS5zbGljZSgxKTtcblx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMubWFwLmdldChoZWFkKTtcblx0XHRpZiAoZXhpc3RpbmcpIHtcblx0XHRcdHJlc3VsdHMucHVzaCguLi5leGlzdGluZy5nZXQocmVzdCwgYXR0cmlidXRlcykpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHRzO1xuXHR9XG5cblx0dG9TdHJpbmcoaW5kZW50YXRpb24gPSAnJyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgbGluZXMgPSBbXTtcblx0XHRpZiAodGhpcy52YWx1ZS5oYXNJdGVtcykge1xuXHRcdFx0bGluZXMucHVzaCgnKiA9PiBcXG4nICsgdGhpcy52YWx1ZS50b1N0cmluZyhpbmRlbnRhdGlvbiArICcgICcpKTtcblx0XHR9XG5cdFx0Wy4uLnRoaXMubWFwLmVudHJpZXMoKV0ubWFwKChba2V5LCB0cmllXSkgPT5cblx0XHRcdGxpbmVzLnB1c2goJ14nICsga2V5ICsgJyA9PiBcXG4nICsgdHJpZS50b1N0cmluZyhpbmRlbnRhdGlvbiArICcgICcpKSk7XG5cdFx0cmV0dXJuIGxpbmVzLm1hcChsID0+IGluZGVudGF0aW9uICsgbCkuam9pbignXFxuJyk7XG5cdH1cbn1cblxuLyoqIEV4cG9ydCBmb3IgdGVzdCBvbmx5LiAqL1xuZXhwb3J0IGNsYXNzIFN1ZlRyaWUge1xuXHRwcml2YXRlIHN0YXI6IFN1YnN0aXR1dGlvblN0cmluZ1tdID0gW107XG5cdHByaXZhdGUgZXBzaWxvbjogU3Vic3RpdHV0aW9uU3RyaW5nW10gPSBbXTtcblxuXHRwcml2YXRlIG1hcDogTWFwPHN0cmluZywgU3VmVHJpZT4gPSBuZXcgTWFwKCk7XG5cdGhhc0l0ZW1zOiBib29sZWFuID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoKSB7IH1cblxuXHRhZGQoa2V5OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpIHtcblx0XHR0aGlzLmhhc0l0ZW1zID0gdHJ1ZTtcblx0XHRpZiAoa2V5ID09PSAnKicpIHtcblx0XHRcdHRoaXMuc3Rhci5wdXNoKG5ldyBTdWJzdGl0dXRpb25TdHJpbmcodmFsdWUpKTtcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJycpIHtcblx0XHRcdHRoaXMuZXBzaWxvbi5wdXNoKG5ldyBTdWJzdGl0dXRpb25TdHJpbmcodmFsdWUpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgdGFpbCA9IGtleVtrZXkubGVuZ3RoIC0gMV07XG5cdFx0XHRjb25zdCByZXN0ID0ga2V5LnNsaWNlKDAsIGtleS5sZW5ndGggLSAxKTtcblx0XHRcdGlmICh0YWlsID09PSAnKicpIHtcblx0XHRcdFx0dGhyb3cgRXJyb3IoJ1VuZXhwZWN0ZWQgc3RhciBpbiBTdWZUcmllIGtleTogJyArIGtleSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsZXQgZXhpc3RpbmcgPSB0aGlzLm1hcC5nZXQodGFpbCk7XG5cdFx0XHRcdGlmICghZXhpc3RpbmcpIHtcblx0XHRcdFx0XHR0aGlzLm1hcC5zZXQodGFpbCwgZXhpc3RpbmcgPSBuZXcgU3VmVHJpZSgpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRleGlzdGluZy5hZGQocmVzdCwgdmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGdldChrZXk6IHN0cmluZywgYXR0cmlidXRlczogRmlsZW5hbWVBdHRyaWJ1dGVzKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IHJlc3VsdHM6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKGtleSA9PT0gJycpIHtcblx0XHRcdHJlc3VsdHMucHVzaCguLi50aGlzLmVwc2lsb24ubWFwKHNzID0+IHNzLnN1YnN0aXR1dGUoYXR0cmlidXRlcykpKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuc3Rhci5sZW5ndGgpIHtcblx0XHRcdHJlc3VsdHMucHVzaCguLi50aGlzLnN0YXIubWFwKHNzID0+IHNzLnN1YnN0aXR1dGUoYXR0cmlidXRlcywga2V5KSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRhaWwgPSBrZXlba2V5Lmxlbmd0aCAtIDFdO1xuXHRcdGNvbnN0IHJlc3QgPSBrZXkuc2xpY2UoMCwga2V5Lmxlbmd0aCAtIDEpO1xuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5tYXAuZ2V0KHRhaWwpO1xuXHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0cmVzdWx0cy5wdXNoKC4uLmV4aXN0aW5nLmdldChyZXN0LCBhdHRyaWJ1dGVzKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdHM7XG5cdH1cblxuXHR0b1N0cmluZyhpbmRlbnRhdGlvbiA9ICcnKTogc3RyaW5nIHtcblx0XHRjb25zdCBsaW5lcyA9IFtdO1xuXHRcdGlmICh0aGlzLnN0YXIubGVuZ3RoKSB7XG5cdFx0XHRsaW5lcy5wdXNoKCcqID0+ICcgKyB0aGlzLnN0YXIuam9pbignOyAnKSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZXBzaWxvbi5sZW5ndGgpIHtcblx0XHRcdC8vIGFsbG93LWFueS11bmljb2RlLW5leHQtbGluZVxuXHRcdFx0bGluZXMucHVzaCgnXHUwM0I1ID0+ICcgKyB0aGlzLmVwc2lsb24uam9pbignOyAnKSk7XG5cdFx0fVxuXG5cdFx0Wy4uLnRoaXMubWFwLmVudHJpZXMoKV0ubWFwKChba2V5LCB0cmllXSkgPT5cblx0XHRcdGxpbmVzLnB1c2goa2V5ICsgJyQnICsgJyA9PiBcXG4nICsgdHJpZS50b1N0cmluZyhpbmRlbnRhdGlvbiArICcgICcpKSk7XG5cblx0XHRyZXR1cm4gbGluZXMubWFwKGwgPT4gaW5kZW50YXRpb24gKyBsKS5qb2luKCdcXG4nKTtcblx0fVxufVxuXG5jb25zdCBlbnVtIFN1YnN0aXR1dGlvblR5cGUge1xuXHRjYXB0dXJlID0gJ2NhcHR1cmUnLFxuXHRiYXNlbmFtZSA9ICdiYXNlbmFtZScsXG5cdGRpcm5hbWUgPSAnZGlybmFtZScsXG5cdGV4dG5hbWUgPSAnZXh0bmFtZScsXG59XG5cbmNvbnN0IHN1YnN0aXR1dGlvblN0cmluZ1Rva2VuaXplciA9IC9cXCRbKHtdKGNhcHR1cmV8YmFzZW5hbWV8ZGlybmFtZXxleHRuYW1lKVspfV0vZztcblxuY2xhc3MgU3Vic3RpdHV0aW9uU3RyaW5nIHtcblxuXHRwcml2YXRlIHRva2VuczogKHN0cmluZyB8IHsgY2FwdHVyZTogU3Vic3RpdHV0aW9uVHlwZSB9KVtdID0gW107XG5cblx0Y29uc3RydWN0b3IocGF0dGVybjogc3RyaW5nKSB7XG5cdFx0c3Vic3RpdHV0aW9uU3RyaW5nVG9rZW5pemVyLmxhc3RJbmRleCA9IDA7XG5cdFx0bGV0IHRva2VuO1xuXHRcdGxldCBsYXN0SW5kZXggPSAwO1xuXHRcdHdoaWxlICh0b2tlbiA9IHN1YnN0aXR1dGlvblN0cmluZ1Rva2VuaXplci5leGVjKHBhdHRlcm4pKSB7XG5cdFx0XHRjb25zdCBwcmVmaXggPSBwYXR0ZXJuLnNsaWNlKGxhc3RJbmRleCwgdG9rZW4uaW5kZXgpO1xuXHRcdFx0dGhpcy50b2tlbnMucHVzaChwcmVmaXgpO1xuXG5cdFx0XHRjb25zdCB0eXBlID0gdG9rZW5bMV07XG5cdFx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRcdFx0Y2FzZSBTdWJzdGl0dXRpb25UeXBlLmJhc2VuYW1lOlxuXHRcdFx0XHRjYXNlIFN1YnN0aXR1dGlvblR5cGUuZGlybmFtZTpcblx0XHRcdFx0Y2FzZSBTdWJzdGl0dXRpb25UeXBlLmV4dG5hbWU6XG5cdFx0XHRcdGNhc2UgU3Vic3RpdHV0aW9uVHlwZS5jYXB0dXJlOlxuXHRcdFx0XHRcdHRoaXMudG9rZW5zLnB1c2goeyBjYXB0dXJlOiB0eXBlIH0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRkZWZhdWx0OiB0aHJvdyBFcnJvcigndW5rbm93biBzdWJzdGl0dXRpb24gdHlwZTogJyArIHR5cGUpO1xuXHRcdFx0fVxuXHRcdFx0bGFzdEluZGV4ID0gdG9rZW4uaW5kZXggKyB0b2tlblswXS5sZW5ndGg7XG5cdFx0fVxuXG5cdFx0aWYgKGxhc3RJbmRleCAhPT0gcGF0dGVybi5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IHN1ZmZpeCA9IHBhdHRlcm4uc2xpY2UobGFzdEluZGV4LCBwYXR0ZXJuLmxlbmd0aCk7XG5cdFx0XHR0aGlzLnRva2Vucy5wdXNoKHN1ZmZpeCk7XG5cdFx0fVxuXHR9XG5cblx0c3Vic3RpdHV0ZShhdHRyaWJ1dGVzOiBGaWxlbmFtZUF0dHJpYnV0ZXMsIGNhcHR1cmU/OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnRva2Vucy5tYXAodCA9PiB7XG5cdFx0XHRpZiAodHlwZW9mIHQgPT09ICdzdHJpbmcnKSB7IHJldHVybiB0OyB9XG5cdFx0XHRzd2l0Y2ggKHQuY2FwdHVyZSkge1xuXHRcdFx0XHRjYXNlIFN1YnN0aXR1dGlvblR5cGUuYmFzZW5hbWU6IHJldHVybiBhdHRyaWJ1dGVzLmJhc2VuYW1lO1xuXHRcdFx0XHRjYXNlIFN1YnN0aXR1dGlvblR5cGUuZGlybmFtZTogcmV0dXJuIGF0dHJpYnV0ZXMuZGlybmFtZTtcblx0XHRcdFx0Y2FzZSBTdWJzdGl0dXRpb25UeXBlLmV4dG5hbWU6IHJldHVybiBhdHRyaWJ1dGVzLmV4dG5hbWU7XG5cdFx0XHRcdGNhc2UgU3Vic3RpdHV0aW9uVHlwZS5jYXB0dXJlOiByZXR1cm4gY2FwdHVyZSB8fCAnJztcblx0XHRcdH1cblx0XHR9KS5qb2luKCcnKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBK0JPLE1BQU0sd0JBQXdCO0FBQUEsRUFHcEMsWUFBWSxRQUE4QjtBQUYxQyxTQUFRLE9BQU8sSUFBSSxRQUFRO0FBRzFCLGVBQVcsQ0FBQyxlQUFlLGFBQWEsS0FBSyxRQUFRO0FBQ3BELGlCQUFXLGdCQUFnQixlQUFlO0FBQ3pDLGFBQUssS0FBSyxJQUFJLGVBQWUsWUFBWTtBQUFBLE1BQzFDO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLFdBQVc7QUFDVixXQUFPLEtBQUssS0FBSyxTQUFTO0FBQUEsRUFDM0I7QUFBQSxFQUVRLGNBQWMsVUFBa0IsU0FBcUM7QUFDNUUsVUFBTSxVQUFVLFNBQVMsWUFBWSxHQUFHO0FBQ3hDLFFBQUksVUFBVSxHQUFHO0FBQ2hCLGFBQU87QUFBQSxRQUNOO0FBQUEsUUFDQSxVQUFVO0FBQUEsUUFDVixTQUFTO0FBQUEsTUFDVjtBQUFBLElBQ0QsT0FBTztBQUNOLGFBQU87QUFBQSxRQUNOO0FBQUEsUUFDQSxVQUFVLFNBQVMsVUFBVSxHQUFHLE9BQU87QUFBQSxR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RDtBQUNEO0FBRUEsSUFBVyxtQkFBWCxrQkFBV0Esc0JBQVg7QUFDQyxFQUFBQSxrQkFBQSxhQUFVO0FBQ1YsRUFBQUEsa0JBQUEsY0FBVztBQUNYLEVBQUFBLGtCQUFBLGFBQVU7QUFDVixFQUFBQSxrQkFBQSxhQUFVO0FBSkEsU0FBQUE7QUFBQSxHQUFBO0FBT1gsTUFBTSw4QkFBOEI7QUFFcEMsTUFBTSxtQkFBbUI7QUFBQSxFQUl4QixZQUFZLFNBQWlCO0FBRjdCLFNBQVEsU0FBcUQsQ0FBQztBQUc3RCxnQ0FBNEIsWUFBWTtBQUN4QyxRQUFJO0FBQ0osUUFBSSxZQUFZO0FBQ2hCLFdBQU8sUUFBUSw0QkFBNEIsS0FBSyxPQUFPLEdBQUc7QUFDekQsWUFBTSxTQUFTLFFBQVEsTUFBTSxXQUFXLE1BQU0sS0FBSztBQUNuRCxXQUFLLE9BQU8sS0FBSyxNQUFNO0FBRXZCLFlBQU0sT0FBTyxNQUFNLENBQUM7QUFDcEIsY0FBUSxNQUFNO0FBQUEsUUFDYixLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQ0osZUFBSyxPQUFPLEtBQUssRUFBRSxTQUFTLEtBQUssQ0FBQztBQUNsQztBQUFBLFFBQ0Q7QUFBUyxnQkFBTSxNQUFNLGdDQUFnQyxJQUFJO0FBQUEsTUFDMUQ7QUFDQSxrQkFBWSxNQUFNLFFBQVEsTUFBTSxDQUFDLEVBQUU7QUFBQSxJQUNwQztBQUVBLFFBQUksY0FBYyxRQUFRLFFBQVE7QUFDakMsWUFBTSxTQUFTLFFBQVEsTUFBTSxXQUFXLFFBQVEsTUFBTTtBQUN0RCxXQUFLLE9BQU8sS0FBSyxNQUFNO0FBQUEsSUFDeEI7QUFBQSxFQUNEO0FBQUEsRUFFQSxXQUFXLFlBQWdDLFNBQTBCO0FBQ3BFLFdBQU8sS0FBSyxPQUFPLElBQUksT0FBSztBQUMzQixVQUFJLE9BQU8sTUFBTSxVQUFVO0FBQUUsZUFBTztBQUFBLE1BQUc7QUFDdkMsY0FBUSxFQUFFLFNBQVM7QUFBQSxRQUNsQixLQUFLO0FBQTJCLGlCQUFPLFdBQVc7QUFBQSxRQUNsRCxLQUFLO0FBQTBCLGlCQUFPLFdBQVc7QUFBQSxRQUNqRCxLQUFLO0FBQTBCLGlCQUFPLFdBQVc7QUFBQSxRQUNqRCxLQUFLO0FBQTBCLGlCQUFPLFdBQVc7QUFBQSxNQUNsRDtBQUFBLElBQ0QsQ0FBQyxFQUFFLEtBQUssRUFBRTtBQUFBLEVBQ1g7QUFDRDsiLAogICJuYW1lcyI6IFsiU3Vic3RpdHV0aW9uVHlwZSJdCn0K
