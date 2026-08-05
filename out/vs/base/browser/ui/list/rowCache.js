import { $ } from "../../dom.js";
class RowCache {
  constructor(renderers) {
    this.renderers = renderers;
    this.cache = /* @__PURE__ */ new Map();
    this.transactionNodesPendingRemoval = /* @__PURE__ */ new Set();
    this.inTransaction = false;
  }
  /**
   * Returns a row either by creating a new one or reusing
   * a previously released row which shares the same templateId.
   *
   * @returns A row and `isReusingConnectedDomNode` if the row's node is already in the dom in a stale position.
   */
  alloc(templateId) {
    let result = this.getTemplateCache(templateId).pop();
    let isStale = false;
    if (result) {
      isStale = this.transactionNodesPendingRemoval.has(result.domNode);
      if (isStale) {
        this.transactionNodesPendingRemoval.delete(result.domNode);
      }
    } else {
      const domNode = $(".monaco-list-row");
      const renderer = this.getRenderer(templateId);
      const templateData = renderer.renderTemplate(domNode);
      result = { domNode, templateId, templateData };
    }
    return { row: result, isReusingConnectedDomNode: isStale };
  }
  /**
   * Releases the row for eventual reuse.
   */
  release(row) {
    if (!row) {
      return;
    }
    this.releaseRow(row);
  }
  /**
   * Begin a set of changes that use the cache. This lets us skip work when a row is removed and then inserted again.
   */
  transact(makeChanges) {
    if (this.inTransaction) {
      throw new Error("Already in transaction");
    }
    this.inTransaction = true;
    try {
      makeChanges();
    } finally {
      for (const domNode of this.transactionNodesPendingRemoval) {
        this.doRemoveNode(domNode);
      }
      this.transactionNodesPendingRemoval.clear();
      this.inTransaction = false;
    }
  }
  releaseRow(row) {
    const { domNode, templateId } = row;
    if (domNode) {
      if (this.inTransaction) {
        this.transactionNodesPendingRemoval.add(domNode);
      } else {
        this.doRemoveNode(domNode);
      }
    }
    const cache = this.getTemplateCache(templateId);
    cache.push(row);
  }
  doRemoveNode(domNode) {
    domNode.classList.remove("scrolling");
    domNode.remove();
  }
  getTemplateCache(templateId) {
    let result = this.cache.get(templateId);
    if (!result) {
      result = [];
      this.cache.set(templateId, result);
    }
    return result;
  }
  dispose() {
    this.cache.forEach((cachedRows, templateId) => {
      for (const cachedRow of cachedRows) {
        const renderer = this.getRenderer(templateId);
        renderer.disposeTemplate(cachedRow.templateData);
        cachedRow.templateData = null;
      }
    });
    this.cache.clear();
    this.transactionNodesPendingRemoval.clear();
  }
  getRenderer(templateId) {
    const renderer = this.renderers.get(templateId);
    if (!renderer) {
      throw new Error(`No renderer found for ${templateId}`);
    }
    return renderer;
  }
}
export {
  RowCache
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9yb3dDYWNoZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7ICQgfSBmcm9tICcuLi8uLi9kb20uanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElMaXN0UmVuZGVyZXIgfSBmcm9tICcuL2xpc3QuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElSb3cge1xuXHRkb21Ob2RlOiBIVE1MRWxlbWVudDtcblx0dGVtcGxhdGVJZDogc3RyaW5nO1xuXHR0ZW1wbGF0ZURhdGE6IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIFJvd0NhY2hlPFQ+IGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgY2FjaGUgPSBuZXcgTWFwPHN0cmluZywgSVJvd1tdPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgdHJhbnNhY3Rpb25Ob2Rlc1BlbmRpbmdSZW1vdmFsID0gbmV3IFNldDxIVE1MRWxlbWVudD4oKTtcblx0cHJpdmF0ZSBpblRyYW5zYWN0aW9uID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZW5kZXJlcnM6IE1hcDxzdHJpbmcsIElMaXN0UmVuZGVyZXI8VCwgYW55Pj4pIHsgfVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgcm93IGVpdGhlciBieSBjcmVhdGluZyBhIG5ldyBvbmUgb3IgcmV1c2luZ1xuXHQgKiBhIHByZXZpb3VzbHkgcmVsZWFzZWQgcm93IHdoaWNoIHNoYXJlcyB0aGUgc2FtZSB0ZW1wbGF0ZUlkLlxuXHQgKlxuXHQgKiBAcmV0dXJucyBBIHJvdyBhbmQgYGlzUmV1c2luZ0Nvbm5lY3RlZERvbU5vZGVgIGlmIHRoZSByb3cncyBub2RlIGlzIGFscmVhZHkgaW4gdGhlIGRvbSBpbiBhIHN0YWxlIHBvc2l0aW9uLlxuXHQgKi9cblx0YWxsb2ModGVtcGxhdGVJZDogc3RyaW5nKTogeyByb3c6IElSb3c7IGlzUmV1c2luZ0Nvbm5lY3RlZERvbU5vZGU6IGJvb2xlYW4gfSB7XG5cdFx0bGV0IHJlc3VsdCA9IHRoaXMuZ2V0VGVtcGxhdGVDYWNoZSh0ZW1wbGF0ZUlkKS5wb3AoKTtcblxuXHRcdGxldCBpc1N0YWxlID0gZmFsc2U7XG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0aXNTdGFsZSA9IHRoaXMudHJhbnNhY3Rpb25Ob2Rlc1BlbmRpbmdSZW1vdmFsLmhhcyhyZXN1bHQuZG9tTm9kZSk7XG5cdFx0XHRpZiAoaXNTdGFsZSkge1xuXHRcdFx0XHR0aGlzLnRyYW5zYWN0aW9uTm9kZXNQZW5kaW5nUmVtb3ZhbC5kZWxldGUocmVzdWx0LmRvbU5vZGUpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBkb21Ob2RlID0gJCgnLm1vbmFjby1saXN0LXJvdycpO1xuXHRcdFx0Y29uc3QgcmVuZGVyZXIgPSB0aGlzLmdldFJlbmRlcmVyKHRlbXBsYXRlSWQpO1xuXHRcdFx0Y29uc3QgdGVtcGxhdGVEYXRhID0gcmVuZGVyZXIucmVuZGVyVGVtcGxhdGUoZG9tTm9kZSk7XG5cdFx0XHRyZXN1bHQgPSB7IGRvbU5vZGUsIHRlbXBsYXRlSWQsIHRlbXBsYXRlRGF0YSB9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7IHJvdzogcmVzdWx0LCBpc1JldXNpbmdDb25uZWN0ZWREb21Ob2RlOiBpc1N0YWxlIH07XG5cdH1cblxuXHQvKipcblx0ICogUmVsZWFzZXMgdGhlIHJvdyBmb3IgZXZlbnR1YWwgcmV1c2UuXG5cdCAqL1xuXHRyZWxlYXNlKHJvdzogSVJvdyk6IHZvaWQge1xuXHRcdGlmICghcm93KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5yZWxlYXNlUm93KHJvdyk7XG5cdH1cblxuXHQvKipcblx0ICogQmVnaW4gYSBzZXQgb2YgY2hhbmdlcyB0aGF0IHVzZSB0aGUgY2FjaGUuIFRoaXMgbGV0cyB1cyBza2lwIHdvcmsgd2hlbiBhIHJvdyBpcyByZW1vdmVkIGFuZCB0aGVuIGluc2VydGVkIGFnYWluLlxuXHQgKi9cblx0dHJhbnNhY3QobWFrZUNoYW5nZXM6ICgpID0+IHZvaWQpIHtcblx0XHRpZiAodGhpcy5pblRyYW5zYWN0aW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0FscmVhZHkgaW4gdHJhbnNhY3Rpb24nKTtcblx0XHR9XG5cblx0XHR0aGlzLmluVHJhbnNhY3Rpb24gPSB0cnVlO1xuXG5cdFx0dHJ5IHtcblx0XHRcdG1ha2VDaGFuZ2VzKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZvciAoY29uc3QgZG9tTm9kZSBvZiB0aGlzLnRyYW5zYWN0aW9uTm9kZXNQZW5kaW5nUmVtb3ZhbCkge1xuXHRcdFx0XHR0aGlzLmRvUmVtb3ZlTm9kZShkb21Ob2RlKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy50cmFuc2FjdGlvbk5vZGVzUGVuZGluZ1JlbW92YWwuY2xlYXIoKTtcblx0XHRcdHRoaXMuaW5UcmFuc2FjdGlvbiA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVsZWFzZVJvdyhyb3c6IElSb3cpOiB2b2lkIHtcblx0XHRjb25zdCB7IGRvbU5vZGUsIHRlbXBsYXRlSWQgfSA9IHJvdztcblx0XHRpZiAoZG9tTm9kZSkge1xuXHRcdFx0aWYgKHRoaXMuaW5UcmFuc2FjdGlvbikge1xuXHRcdFx0XHR0aGlzLnRyYW5zYWN0aW9uTm9kZXNQZW5kaW5nUmVtb3ZhbC5hZGQoZG9tTm9kZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmRvUmVtb3ZlTm9kZShkb21Ob2RlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjYWNoZSA9IHRoaXMuZ2V0VGVtcGxhdGVDYWNoZSh0ZW1wbGF0ZUlkKTtcblx0XHRjYWNoZS5wdXNoKHJvdyk7XG5cdH1cblxuXHRwcml2YXRlIGRvUmVtb3ZlTm9kZShkb21Ob2RlOiBIVE1MRWxlbWVudCkge1xuXHRcdGRvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgnc2Nyb2xsaW5nJyk7XG5cdFx0ZG9tTm9kZS5yZW1vdmUoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VGVtcGxhdGVDYWNoZSh0ZW1wbGF0ZUlkOiBzdHJpbmcpOiBJUm93W10ge1xuXHRcdGxldCByZXN1bHQgPSB0aGlzLmNhY2hlLmdldCh0ZW1wbGF0ZUlkKTtcblxuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXN1bHQgPSBbXTtcblx0XHRcdHRoaXMuY2FjaGUuc2V0KHRlbXBsYXRlSWQsIHJlc3VsdCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5jYWNoZS5mb3JFYWNoKChjYWNoZWRSb3dzLCB0ZW1wbGF0ZUlkKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGNhY2hlZFJvdyBvZiBjYWNoZWRSb3dzKSB7XG5cdFx0XHRcdGNvbnN0IHJlbmRlcmVyID0gdGhpcy5nZXRSZW5kZXJlcih0ZW1wbGF0ZUlkKTtcblx0XHRcdFx0cmVuZGVyZXIuZGlzcG9zZVRlbXBsYXRlKGNhY2hlZFJvdy50ZW1wbGF0ZURhdGEpO1xuXHRcdFx0XHRjYWNoZWRSb3cudGVtcGxhdGVEYXRhID0gbnVsbDtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuY2FjaGUuY2xlYXIoKTtcblx0XHR0aGlzLnRyYW5zYWN0aW9uTm9kZXNQZW5kaW5nUmVtb3ZhbC5jbGVhcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRSZW5kZXJlcih0ZW1wbGF0ZUlkOiBzdHJpbmcpOiBJTGlzdFJlbmRlcmVyPFQsIGFueT4ge1xuXHRcdGNvbnN0IHJlbmRlcmVyID0gdGhpcy5yZW5kZXJlcnMuZ2V0KHRlbXBsYXRlSWQpO1xuXHRcdGlmICghcmVuZGVyZXIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgTm8gcmVuZGVyZXIgZm91bmQgZm9yICR7dGVtcGxhdGVJZH1gKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlbmRlcmVyO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFNBQVM7QUFVWCxNQUFNLFNBQW1DO0FBQUEsRUFPL0MsWUFBb0IsV0FBK0M7QUFBL0M7QUFMcEIsU0FBUSxRQUFRLG9CQUFJLElBQW9CO0FBRXhDLFNBQWlCLGlDQUFpQyxvQkFBSSxJQUFpQjtBQUN2RSxTQUFRLGdCQUFnQjtBQUFBLEVBRTZDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFRckUsTUFBTSxZQUF1RTtBQUM1RSxRQUFJLFNBQVMsS0FBSyxpQkFBaUIsVUFBVSxFQUFFLElBQUk7QUFFbkQsUUFBSSxVQUFVO0FBQ2QsUUFBSSxRQUFRO0FBQ1gsZ0JBQVUsS0FBSywrQkFBK0IsSUFBSSxPQUFPLE9BQU87QUFDaEUsVUFBSSxTQUFTO0FBQ1osYUFBSywrQkFBK0IsT0FBTyxPQUFPLE9BQU87QUFBQSxNQUMxRDtBQUFBLElBQ0QsT0FBTztBQUNOLFlBQU0sVUFBVSxFQUFFLGtCQUFrQjtBQUNwQyxZQUFNLFdBQVcsS0FBSyxZQUFZLFVBQVU7QUFDNUMsWUFBTSxlQUFlLFNBQVMsZUFBZSxPQUFPO0FBQ3BELGVBQVMsRUFBRSxTQUFTLFlBQVksYUFBYTtBQUFBLElBQzlDO0FBRUEsV0FBTyxFQUFFLEtBQUssUUFBUSwyQkFBMkIsUUFBUTtBQUFBLEVBQzFEO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxRQUFRLEtBQWlCO0FBQ3hCLFFBQUksQ0FBQyxLQUFLO0FBQ1Q7QUFBQSxJQUNEO0FBRUEsU0FBSyxXQUFXLEdBQUc7QUFBQSxFQUNwQjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0EsU0FBUyxhQUF5QjtBQUNqQyxRQUFJLEtBQUssZUFBZTtBQUN2QixZQUFNLElBQUksTUFBTSx3QkFBd0I7QUFBQSxJQUN6QztBQUVBLFNBQUssZ0JBQWdCO0FBRXJCLFFBQUk7QUFDSCxrQkFBWTtBQUFBLElBQ2IsVUFBRTtBQUNELGlCQUFXLFdBQVcsS0FBSyxnQ0FBZ0M7QUFDMUQsYUFBSyxhQUFhLE9BQU87QUFBQSxNQUMxQjtBQUVBLFdBQUssK0JBQStCLE1BQU07QUFDMUMsV0FBSyxnQkFBZ0I7QUFBQSxJQUN0QjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLFdBQVcsS0FBaUI7QUFDbkMsVUFBTSxFQUFFLFNBQVMsV0FBVyxJQUFJO0FBQ2hDLFFBQUksU0FBUztBQUNaLFVBQUksS0FBSyxlQUFlO0FBQ3ZCLGFBQUssK0JBQStCLElBQUksT0FBTztBQUFBLE1BQ2hELE9BQU87QUFDTixhQUFLLGFBQWEsT0FBTztBQUFBLE1BQzFCO0FBQUEsSUFDRDtBQUVBLFVBQU0sUUFBUSxLQUFLLGlCQUFpQixVQUFVO0FBQzlDLFVBQU0sS0FBSyxHQUFHO0FBQUEsRUFDZjtBQUFBLEVBRVEsYUFBYSxTQUFzQjtBQUMxQyxZQUFRLFVBQVUsT0FBTyxXQUFXO0FBQ3BDLFlBQVEsT0FBTztBQUFBLEVBQ2hCO0FBQUEsRUFFUSxpQkFBaUIsWUFBNEI7QUFDcEQsUUFBSSxTQUFTLEtBQUssTUFBTSxJQUFJLFVBQVU7QUFFdEMsUUFBSSxDQUFDLFFBQVE7QUFDWixlQUFTLENBQUM7QUFDVixXQUFLLE1BQU0sSUFBSSxZQUFZLE1BQU07QUFBQSxJQUNsQztBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxVQUFnQjtBQUNmLFNBQUssTUFBTSxRQUFRLENBQUMsWUFBWSxlQUFlO0FBQzlDLGlCQUFXLGFBQWEsWUFBWTtBQUNuQyxjQUFNLFdBQVcsS0FBSyxZQUFZLFVBQVU7QUFDNUMsaUJBQVMsZ0JBQWdCLFVBQVUsWUFBWTtBQUMvQyxrQkFBVSxlQUFlO0FBQUEsTUFDMUI7QUFBQSxJQUNELENBQUM7QUFFRCxTQUFLLE1BQU0sTUFBTTtBQUNqQixTQUFLLCtCQUErQixNQUFNO0FBQUEsRUFDM0M7QUFBQSxFQUVRLFlBQVksWUFBMkM7QUFDOUQsVUFBTSxXQUFXLEtBQUssVUFBVSxJQUFJLFVBQVU7QUFDOUMsUUFBSSxDQUFDLFVBQVU7QUFDZCxZQUFNLElBQUksTUFBTSx5QkFBeUIsVUFBVSxFQUFFO0FBQUEsSUFDdEQ7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEOyIsCiAgIm5hbWVzIjogW10KfQo=
