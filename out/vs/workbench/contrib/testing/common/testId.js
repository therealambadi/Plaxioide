var TestIdPathParts = /* @__PURE__ */ ((TestIdPathParts2) => {
  TestIdPathParts2["Delimiter"] = "\0";
  return TestIdPathParts2;
})(TestIdPathParts || {});
var TestPosition = /* @__PURE__ */ ((TestPosition2) => {
  TestPosition2[TestPosition2["IsSame"] = 0] = "IsSame";
  TestPosition2[TestPosition2["Disconnected"] = 1] = "Disconnected";
  TestPosition2[TestPosition2["IsChild"] = 2] = "IsChild";
  TestPosition2[TestPosition2["IsParent"] = 3] = "IsParent";
  return TestPosition2;
})(TestPosition || {});
class TestId {
  constructor(path, viewEnd = path.length) {
    this.path = path;
    this.viewEnd = viewEnd;
    if (path.length === 0 || viewEnd < 1) {
      throw new Error("cannot create test with empty path");
    }
  }
  /**
   * Creates a test ID from an ext host test item.
   */
  static fromExtHostTestItem(item, rootId, parent = item.parent) {
    if (item._isRoot) {
      return new TestId([rootId]);
    }
    const path = [item.id];
    for (let i = parent; i && i.id !== rootId; i = i.parent) {
      path.push(i.id);
    }
    path.push(rootId);
    return new TestId(path.reverse());
  }
  /**
   * Cheaply ets whether the ID refers to the root .
   */
  static isRoot(idString) {
    return !idString.includes("\0" /* Delimiter */);
  }
  /**
   * Cheaply gets whether the ID refers to the root .
   */
  static root(idString) {
    const idx = idString.indexOf("\0" /* Delimiter */);
    return idx === -1 ? idString : idString.slice(0, idx);
  }
  /**
   * Creates a test ID from a serialized TestId instance.
   */
  static fromString(idString) {
    return new TestId(idString.split("\0" /* Delimiter */));
  }
  /**
   * Gets the ID resulting from adding b to the base ID.
   */
  static join(base, b) {
    return new TestId([...base.path, b]);
  }
  /**
   * Splits a test ID into its parts.
   */
  static split(idString) {
    return idString.split("\0" /* Delimiter */);
  }
  /**
   * Gets the string ID resulting from adding b to the base ID.
   */
  static joinToString(base, b) {
    return base.toString() + "\0" /* Delimiter */ + b;
  }
  /**
   * Cheaply gets the parent ID of a test identified with the string.
   */
  static parentId(idString) {
    const idx = idString.lastIndexOf("\0" /* Delimiter */);
    return idx === -1 ? void 0 : idString.slice(0, idx);
  }
  /**
   * Cheaply gets the local ID of a test identified with the string.
   */
  static localId(idString) {
    const idx = idString.lastIndexOf("\0" /* Delimiter */);
    return idx === -1 ? idString : idString.slice(idx + "\0" /* Delimiter */.length);
  }
  /**
   * Gets whether maybeChild is a child of maybeParent.
   * todo@connor4312: review usages of this to see if using the WellDefinedPrefixTree is better
   */
  static isChild(maybeParent, maybeChild) {
    return maybeChild[maybeParent.length] === "\0" /* Delimiter */ && maybeChild.startsWith(maybeParent);
  }
  /**
   * Compares the position of the two ID strings.
   * todo@connor4312: review usages of this to see if using the WellDefinedPrefixTree is better
   */
  static compare(a, b) {
    if (a === b) {
      return 0 /* IsSame */;
    }
    if (TestId.isChild(a, b)) {
      return 2 /* IsChild */;
    }
    if (TestId.isChild(b, a)) {
      return 3 /* IsParent */;
    }
    return 1 /* Disconnected */;
  }
  static getLengthOfCommonPrefix(length, getId) {
    if (length === 0) {
      return 0;
    }
    let commonPrefix = 0;
    while (commonPrefix < length - 1) {
      for (let i = 1; i < length; i++) {
        const a = getId(i - 1);
        const b = getId(i);
        if (a.path[commonPrefix] !== b.path[commonPrefix]) {
          return commonPrefix;
        }
      }
      commonPrefix++;
    }
    return commonPrefix;
  }
  /**
   * Gets the ID of the parent test.
   */
  get rootId() {
    return new TestId(this.path, 1);
  }
  /**
   * Gets the ID of the parent test.
   */
  get parentId() {
    return this.viewEnd > 1 ? new TestId(this.path, this.viewEnd - 1) : void 0;
  }
  /**
   * Gets the local ID of the current full test ID.
   */
  get localId() {
    return this.path[this.viewEnd - 1];
  }
  /**
   * Gets whether this ID refers to the root.
   */
  get controllerId() {
    return this.path[0];
  }
  /**
   * Gets whether this ID refers to the root.
   */
  get isRoot() {
    return this.viewEnd === 1;
  }
  /**
   * Returns an iterable that yields IDs of all parent items down to and
   * including the current item.
   */
  *idsFromRoot() {
    for (let i = 1; i <= this.viewEnd; i++) {
      yield new TestId(this.path, i);
    }
  }
  /**
   * Returns an iterable that yields IDs of the current item up to the root
   * item.
   */
  *idsToRoot() {
    for (let i = this.viewEnd; i > 0; i--) {
      yield new TestId(this.path, i);
    }
  }
  /**
   * Compares the other test ID with this one.
   */
  compare(other) {
    if (typeof other === "string") {
      return TestId.compare(this.toString(), other);
    }
    for (let i = 0; i < other.viewEnd && i < this.viewEnd; i++) {
      if (other.path[i] !== this.path[i]) {
        return 1 /* Disconnected */;
      }
    }
    if (other.viewEnd > this.viewEnd) {
      return 2 /* IsChild */;
    }
    if (other.viewEnd < this.viewEnd) {
      return 3 /* IsParent */;
    }
    return 0 /* IsSame */;
  }
  /**
   * Serializes the ID.
   */
  toJSON() {
    return this.toString();
  }
  /**
   * Serializes the ID to a string.
   */
  toString() {
    if (!this.stringifed) {
      this.stringifed = this.path[0];
      for (let i = 1; i < this.viewEnd; i++) {
        this.stringifed += "\0" /* Delimiter */;
        this.stringifed += this.path[i];
      }
    }
    return this.stringifed;
  }
}
export {
  TestId,
  TestIdPathParts,
  TestPosition
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2NvbW1vbi90ZXN0SWQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5leHBvcnQgY29uc3QgZW51bSBUZXN0SWRQYXRoUGFydHMge1xuXHQvKiogRGVsaW1pdGVyIGZvciBwYXRoIHBhcnRzIGluIHRlc3QgSURzICovXG5cdERlbGltaXRlciA9ICdcXDAnLFxufVxuXG4vKipcbiAqIEVudW0gZm9yIGRlc2NyaWJpbmcgcmVsYXRpdmUgcG9zaXRpb25zIG9mIHRlc3RzLiBTaW1pbGFyIHRvXG4gKiBgbm9kZS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbmAgaW4gdGhlIERPTS5cbiAqL1xuZXhwb3J0IGNvbnN0IGVudW0gVGVzdFBvc2l0aW9uIHtcblx0LyoqIGEgPT09IGIgKi9cblx0SXNTYW1lLFxuXHQvKiogTmVpdGhlciBhIG5vciBiIGFyZSBhIGNoaWxkIG9mIG9uZSBhbm90aGVyLiBUaGV5IG1heSBzaGFyZSBhIGNvbW1vbiBwYXJlbnQsIHRob3VnaC4gKi9cblx0RGlzY29ubmVjdGVkLFxuXHQvKiogYiBpcyBhIGNoaWxkIG9mIGEgKi9cblx0SXNDaGlsZCxcblx0LyoqIGIgaXMgYSBwYXJlbnQgb2YgYSAqL1xuXHRJc1BhcmVudCxcbn1cblxudHlwZSBUZXN0SXRlbUxpa2UgPSB7IGlkOiBzdHJpbmc7IHBhcmVudD86IFRlc3RJdGVtTGlrZTsgX2lzUm9vdD86IGJvb2xlYW4gfTtcblxuLyoqXG4gKiBUaGUgdGVzdCBJRCBpcyBhIHN0cmluZ2lmaWFibGUgY2xpZW50IHRoYXRcbiAqL1xuZXhwb3J0IGNsYXNzIFRlc3RJZCB7XG5cdHByaXZhdGUgc3RyaW5naWZlZD86IHN0cmluZztcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIHRlc3QgSUQgZnJvbSBhbiBleHQgaG9zdCB0ZXN0IGl0ZW0uXG5cdCAqL1xuXHRwdWJsaWMgc3RhdGljIGZyb21FeHRIb3N0VGVzdEl0ZW0oaXRlbTogVGVzdEl0ZW1MaWtlLCByb290SWQ6IHN0cmluZywgcGFyZW50ID0gaXRlbS5wYXJlbnQpIHtcblx0XHRpZiAoaXRlbS5faXNSb290KSB7XG5cdFx0XHRyZXR1cm4gbmV3IFRlc3RJZChbcm9vdElkXSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGF0aCA9IFtpdGVtLmlkXTtcblx0XHRmb3IgKGxldCBpID0gcGFyZW50OyBpICYmIGkuaWQgIT09IHJvb3RJZDsgaSA9IGkucGFyZW50KSB7XG5cdFx0XHRwYXRoLnB1c2goaS5pZCk7XG5cdFx0fVxuXHRcdHBhdGgucHVzaChyb290SWQpO1xuXG5cdFx0cmV0dXJuIG5ldyBUZXN0SWQocGF0aC5yZXZlcnNlKCkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENoZWFwbHkgZXRzIHdoZXRoZXIgdGhlIElEIHJlZmVycyB0byB0aGUgcm9vdCAuXG5cdCAqL1xuXHRwdWJsaWMgc3RhdGljIGlzUm9vdChpZFN0cmluZzogc3RyaW5nKSB7XG5cdFx0cmV0dXJuICFpZFN0cmluZy5pbmNsdWRlcyhUZXN0SWRQYXRoUGFydHMuRGVsaW1pdGVyKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDaGVhcGx5IGdldHMgd2hldGhlciB0aGUgSUQgcmVmZXJzIHRvIHRoZSByb290IC5cblx0ICovXG5cdHB1YmxpYyBzdGF0aWMgcm9vdChpZFN0cmluZzogc3RyaW5nKSB7XG5cdFx0Y29uc3QgaWR4ID0gaWRTdHJpbmcuaW5kZXhPZihUZXN0SWRQYXRoUGFydHMuRGVsaW1pdGVyKTtcblx0XHRyZXR1cm4gaWR4ID09PSAtMSA/IGlkU3RyaW5nIDogaWRTdHJpbmcuc2xpY2UoMCwgaWR4KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgdGVzdCBJRCBmcm9tIGEgc2VyaWFsaXplZCBUZXN0SWQgaW5zdGFuY2UuXG5cdCAqL1xuXHRwdWJsaWMgc3RhdGljIGZyb21TdHJpbmcoaWRTdHJpbmc6IHN0cmluZykge1xuXHRcdHJldHVybiBuZXcgVGVzdElkKGlkU3RyaW5nLnNwbGl0KFRlc3RJZFBhdGhQYXJ0cy5EZWxpbWl0ZXIpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIHRoZSBJRCByZXN1bHRpbmcgZnJvbSBhZGRpbmcgYiB0byB0aGUgYmFzZSBJRC5cblx0ICovXG5cdHB1YmxpYyBzdGF0aWMgam9pbihiYXNlOiBUZXN0SWQsIGI6IHN0cmluZykge1xuXHRcdHJldHVybiBuZXcgVGVzdElkKFsuLi5iYXNlLnBhdGgsIGJdKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTcGxpdHMgYSB0ZXN0IElEIGludG8gaXRzIHBhcnRzLlxuXHQgKi9cblx0cHVibGljIHN0YXRpYyBzcGxpdChpZFN0cmluZzogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIGlkU3RyaW5nLnNwbGl0KFRlc3RJZFBhdGhQYXJ0cy5EZWxpbWl0ZXIpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIHN0cmluZyBJRCByZXN1bHRpbmcgZnJvbSBhZGRpbmcgYiB0byB0aGUgYmFzZSBJRC5cblx0ICovXG5cdHB1YmxpYyBzdGF0aWMgam9pblRvU3RyaW5nKGJhc2U6IHN0cmluZyB8IFRlc3RJZCwgYjogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIGJhc2UudG9TdHJpbmcoKSArIFRlc3RJZFBhdGhQYXJ0cy5EZWxpbWl0ZXIgKyBiO1xuXHR9XG5cblx0LyoqXG5cdCAqIENoZWFwbHkgZ2V0cyB0aGUgcGFyZW50IElEIG9mIGEgdGVzdCBpZGVudGlmaWVkIHdpdGggdGhlIHN0cmluZy5cblx0ICovXG5cdHB1YmxpYyBzdGF0aWMgcGFyZW50SWQoaWRTdHJpbmc6IHN0cmluZykge1xuXHRcdGNvbnN0IGlkeCA9IGlkU3RyaW5nLmxhc3RJbmRleE9mKFRlc3RJZFBhdGhQYXJ0cy5EZWxpbWl0ZXIpO1xuXHRcdHJldHVybiBpZHggPT09IC0xID8gdW5kZWZpbmVkIDogaWRTdHJpbmcuc2xpY2UoMCwgaWR4KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDaGVhcGx5IGdldHMgdGhlIGxvY2FsIElEIG9mIGEgdGVzdCBpZGVudGlmaWVkIHdpdGggdGhlIHN0cmluZy5cblx0ICovXG5cdHB1YmxpYyBzdGF0aWMgbG9jYWxJZChpZFN0cmluZzogc3RyaW5nKSB7XG5cdFx0Y29uc3QgaWR4ID0gaWRTdHJpbmcubGFzdEluZGV4T2YoVGVzdElkUGF0aFBhcnRzLkRlbGltaXRlcik7XG5cdFx0cmV0dXJuIGlkeCA9PT0gLTEgPyBpZFN0cmluZyA6IGlkU3RyaW5nLnNsaWNlKGlkeCArIFRlc3RJZFBhdGhQYXJ0cy5EZWxpbWl0ZXIubGVuZ3RoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIHdoZXRoZXIgbWF5YmVDaGlsZCBpcyBhIGNoaWxkIG9mIG1heWJlUGFyZW50LlxuXHQgKiB0b2RvQGNvbm5vcjQzMTI6IHJldmlldyB1c2FnZXMgb2YgdGhpcyB0byBzZWUgaWYgdXNpbmcgdGhlIFdlbGxEZWZpbmVkUHJlZml4VHJlZSBpcyBiZXR0ZXJcblx0ICovXG5cdHB1YmxpYyBzdGF0aWMgaXNDaGlsZChtYXliZVBhcmVudDogc3RyaW5nLCBtYXliZUNoaWxkOiBzdHJpbmcpIHtcblx0XHRyZXR1cm4gbWF5YmVDaGlsZFttYXliZVBhcmVudC5sZW5ndGhdID09PSBUZXN0SWRQYXRoUGFydHMuRGVsaW1pdGVyICYmIG1heWJlQ2hpbGQuc3RhcnRzV2l0aChtYXliZVBhcmVudCk7XG5cdH1cblxuXHQvKipcblx0ICogQ29tcGFyZXMgdGhlIHBvc2l0aW9uIG9mIHRoZSB0d28gSUQgc3RyaW5ncy5cblx0ICogdG9kb0Bjb25ub3I0MzEyOiByZXZpZXcgdXNhZ2VzIG9mIHRoaXMgdG8gc2VlIGlmIHVzaW5nIHRoZSBXZWxsRGVmaW5lZFByZWZpeFRyZWUgaXMgYmV0dGVyXG5cdCAqL1xuXHRwdWJsaWMgc3RhdGljIGNvbXBhcmUoYTogc3RyaW5nLCBiOiBzdHJpbmcpIHtcblx0XHRpZiAoYSA9PT0gYikge1xuXHRcdFx0cmV0dXJuIFRlc3RQb3NpdGlvbi5Jc1NhbWU7XG5cdFx0fVxuXG5cdFx0aWYgKFRlc3RJZC5pc0NoaWxkKGEsIGIpKSB7XG5cdFx0XHRyZXR1cm4gVGVzdFBvc2l0aW9uLklzQ2hpbGQ7XG5cdFx0fVxuXG5cdFx0aWYgKFRlc3RJZC5pc0NoaWxkKGIsIGEpKSB7XG5cdFx0XHRyZXR1cm4gVGVzdFBvc2l0aW9uLklzUGFyZW50O1xuXHRcdH1cblxuXHRcdHJldHVybiBUZXN0UG9zaXRpb24uRGlzY29ubmVjdGVkO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBnZXRMZW5ndGhPZkNvbW1vblByZWZpeChsZW5ndGg6IG51bWJlciwgZ2V0SWQ6IChpOiBudW1iZXIpID0+IFRlc3RJZCk6IG51bWJlciB7XG5cdFx0aWYgKGxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0bGV0IGNvbW1vblByZWZpeCA9IDA7XG5cdFx0d2hpbGUgKGNvbW1vblByZWZpeCA8IGxlbmd0aCAtIDEpIHtcblx0XHRcdGZvciAobGV0IGkgPSAxOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgYSA9IGdldElkKGkgLSAxKTtcblx0XHRcdFx0Y29uc3QgYiA9IGdldElkKGkpO1xuXHRcdFx0XHRpZiAoYS5wYXRoW2NvbW1vblByZWZpeF0gIT09IGIucGF0aFtjb21tb25QcmVmaXhdKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNvbW1vblByZWZpeDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb21tb25QcmVmaXgrKztcblx0XHR9XG5cblx0XHRyZXR1cm4gY29tbW9uUHJlZml4O1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHBhdGg6IHJlYWRvbmx5IHN0cmluZ1tdLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdmlld0VuZCA9IHBhdGgubGVuZ3RoLFxuXHQpIHtcblx0XHRpZiAocGF0aC5sZW5ndGggPT09IDAgfHwgdmlld0VuZCA8IDEpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignY2Fubm90IGNyZWF0ZSB0ZXN0IHdpdGggZW1wdHkgcGF0aCcpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIHRoZSBJRCBvZiB0aGUgcGFyZW50IHRlc3QuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IHJvb3RJZCgpOiBUZXN0SWQge1xuXHRcdHJldHVybiBuZXcgVGVzdElkKHRoaXMucGF0aCwgMSk7XG5cdH1cblxuXHQvKipcblx0ICogR2V0cyB0aGUgSUQgb2YgdGhlIHBhcmVudCB0ZXN0LlxuXHQgKi9cblx0cHVibGljIGdldCBwYXJlbnRJZCgpOiBUZXN0SWQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnZpZXdFbmQgPiAxID8gbmV3IFRlc3RJZCh0aGlzLnBhdGgsIHRoaXMudmlld0VuZCAtIDEpIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIGxvY2FsIElEIG9mIHRoZSBjdXJyZW50IGZ1bGwgdGVzdCBJRC5cblx0ICovXG5cdHB1YmxpYyBnZXQgbG9jYWxJZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5wYXRoW3RoaXMudmlld0VuZCAtIDFdO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgd2hldGhlciB0aGlzIElEIHJlZmVycyB0byB0aGUgcm9vdC5cblx0ICovXG5cdHB1YmxpYyBnZXQgY29udHJvbGxlcklkKCkge1xuXHRcdHJldHVybiB0aGlzLnBhdGhbMF07XG5cdH1cblxuXHQvKipcblx0ICogR2V0cyB3aGV0aGVyIHRoaXMgSUQgcmVmZXJzIHRvIHRoZSByb290LlxuXHQgKi9cblx0cHVibGljIGdldCBpc1Jvb3QoKSB7XG5cdFx0cmV0dXJuIHRoaXMudmlld0VuZCA9PT0gMTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGFuIGl0ZXJhYmxlIHRoYXQgeWllbGRzIElEcyBvZiBhbGwgcGFyZW50IGl0ZW1zIGRvd24gdG8gYW5kXG5cdCAqIGluY2x1ZGluZyB0aGUgY3VycmVudCBpdGVtLlxuXHQgKi9cblx0cHVibGljICppZHNGcm9tUm9vdCgpIHtcblx0XHRmb3IgKGxldCBpID0gMTsgaSA8PSB0aGlzLnZpZXdFbmQ7IGkrKykge1xuXHRcdFx0eWllbGQgbmV3IFRlc3RJZCh0aGlzLnBhdGgsIGkpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGFuIGl0ZXJhYmxlIHRoYXQgeWllbGRzIElEcyBvZiB0aGUgY3VycmVudCBpdGVtIHVwIHRvIHRoZSByb290XG5cdCAqIGl0ZW0uXG5cdCAqL1xuXHRwdWJsaWMgKmlkc1RvUm9vdCgpIHtcblx0XHRmb3IgKGxldCBpID0gdGhpcy52aWV3RW5kOyBpID4gMDsgaS0tKSB7XG5cdFx0XHR5aWVsZCBuZXcgVGVzdElkKHRoaXMucGF0aCwgaSk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENvbXBhcmVzIHRoZSBvdGhlciB0ZXN0IElEIHdpdGggdGhpcyBvbmUuXG5cdCAqL1xuXHRwdWJsaWMgY29tcGFyZShvdGhlcjogVGVzdElkIHwgc3RyaW5nKSB7XG5cdFx0aWYgKHR5cGVvZiBvdGhlciA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiBUZXN0SWQuY29tcGFyZSh0aGlzLnRvU3RyaW5nKCksIG90aGVyKTtcblx0XHR9XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG90aGVyLnZpZXdFbmQgJiYgaSA8IHRoaXMudmlld0VuZDsgaSsrKSB7XG5cdFx0XHRpZiAob3RoZXIucGF0aFtpXSAhPT0gdGhpcy5wYXRoW2ldKSB7XG5cdFx0XHRcdHJldHVybiBUZXN0UG9zaXRpb24uRGlzY29ubmVjdGVkO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChvdGhlci52aWV3RW5kID4gdGhpcy52aWV3RW5kKSB7XG5cdFx0XHRyZXR1cm4gVGVzdFBvc2l0aW9uLklzQ2hpbGQ7XG5cdFx0fVxuXG5cdFx0aWYgKG90aGVyLnZpZXdFbmQgPCB0aGlzLnZpZXdFbmQpIHtcblx0XHRcdHJldHVybiBUZXN0UG9zaXRpb24uSXNQYXJlbnQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFRlc3RQb3NpdGlvbi5Jc1NhbWU7XG5cdH1cblxuXHQvKipcblx0ICogU2VyaWFsaXplcyB0aGUgSUQuXG5cdCAqL1xuXHRwdWJsaWMgdG9KU09OKCkge1xuXHRcdHJldHVybiB0aGlzLnRvU3RyaW5nKCk7XG5cdH1cblxuXHQvKipcblx0ICogU2VyaWFsaXplcyB0aGUgSUQgdG8gYSBzdHJpbmcuXG5cdCAqL1xuXHRwdWJsaWMgdG9TdHJpbmcoKSB7XG5cdFx0aWYgKCF0aGlzLnN0cmluZ2lmZWQpIHtcblx0XHRcdHRoaXMuc3RyaW5naWZlZCA9IHRoaXMucGF0aFswXTtcblx0XHRcdGZvciAobGV0IGkgPSAxOyBpIDwgdGhpcy52aWV3RW5kOyBpKyspIHtcblx0XHRcdFx0dGhpcy5zdHJpbmdpZmVkICs9IFRlc3RJZFBhdGhQYXJ0cy5EZWxpbWl0ZXI7XG5cdFx0XHRcdHRoaXMuc3RyaW5naWZlZCArPSB0aGlzLnBhdGhbaV07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuc3RyaW5naWZlZDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS08sSUFBVyxrQkFBWCxrQkFBV0EscUJBQVg7QUFFTixFQUFBQSxpQkFBQSxlQUFZO0FBRkssU0FBQUE7QUFB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
