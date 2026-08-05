import * as dom from "../../dom.js";
import { getBaseLayerHoverDelegate } from "../hover/hoverDelegate2.js";
import { getDefaultHoverDelegate } from "../hover/hoverDelegateFactory.js";
import { renderLabelWithIcons } from "../iconLabel/iconLabels.js";
import { Disposable } from "../../../common/lifecycle.js";
import * as objects from "../../../common/objects.js";
class HighlightedLabel extends Disposable {
  /**
   * Create a new {@link HighlightedLabel}.
   *
   * @param container The parent container to append to.
   */
  constructor(container, options) {
    super();
    this.options = options;
    this.text = "";
    this.title = "";
    this.highlights = [];
    this.didEverRender = false;
    this.supportIcons = options?.supportIcons ?? false;
    this.domNode = dom.append(container, dom.$("span.monaco-highlighted-label"));
  }
  /**
   * The label's DOM node.
   */
  get element() {
    return this.domNode;
  }
  /**
   * Set the label and highlights.
   *
   * @param text The label to display.
   * @param highlights The ranges to highlight.
   * @param title An optional title for the hover tooltip.
   * @param escapeNewLines Whether to escape new lines.
   * @returns
   */
  set(text, highlights = [], title = "", escapeNewLines) {
    if (!text) {
      text = "";
    }
    if (escapeNewLines) {
      text = HighlightedLabel.escapeNewLines(text, highlights);
    }
    if (this.didEverRender && this.text === text && this.title === title && objects.equals(this.highlights, highlights)) {
      return;
    }
    this.text = text;
    this.title = title;
    this.highlights = highlights;
    this.render();
  }
  render() {
    const children = [];
    let pos = 0;
    for (const highlight of this.highlights) {
      if (highlight.end === highlight.start) {
        continue;
      }
      if (pos < highlight.start) {
        const substring2 = this.text.substring(pos, highlight.start);
        if (this.supportIcons) {
          children.push(...renderLabelWithIcons(substring2));
        } else {
          children.push(substring2);
        }
        pos = highlight.start;
      }
      const substring = this.text.substring(pos, highlight.end);
      const element = dom.$("span.highlight", void 0, ...this.supportIcons ? renderLabelWithIcons(substring) : [substring]);
      if (highlight.extraClasses) {
        element.classList.add(...highlight.extraClasses);
      }
      children.push(element);
      pos = highlight.end;
    }
    if (pos < this.text.length) {
      const substring = this.text.substring(pos);
      if (this.supportIcons) {
        children.push(...renderLabelWithIcons(substring));
      } else {
        children.push(substring);
      }
    }
    dom.reset(this.domNode, ...children);
    if (this.options?.hoverDelegate?.showNativeHover) {
      this.domNode.title = this.title;
    } else {
      if (!this.customHover && this.title !== "") {
        const hoverDelegate = this.options?.hoverDelegate ?? getDefaultHoverDelegate("mouse");
        this.customHover = this._register(getBaseLayerHoverDelegate().setupManagedHover(hoverDelegate, this.domNode, this.title));
      } else if (this.customHover) {
        this.customHover.update(this.title);
      }
    }
    this.didEverRender = true;
  }
  static escapeNewLines(text, highlights) {
    let total = 0;
    let extra = 0;
    return text.replace(/\r\n|\r|\n/g, (match, offset) => {
      extra = match === "\r\n" ? -1 : 0;
      offset += total;
      for (const highlight of highlights) {
        if (highlight.end <= offset) {
          continue;
        }
        if (highlight.start >= offset) {
          highlight.start += extra;
        }
        if (highlight.end >= offset) {
          highlight.end += extra;
        }
      }
      total += extra;
      return "\u23CE";
    });
  }
}
export {
  HighlightedLabel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvaGlnaGxpZ2h0ZWRsYWJlbC9oaWdobGlnaHRlZExhYmVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uL2RvbS5qcyc7XG5pbXBvcnQgdHlwZSB7IElNYW5hZ2VkSG92ZXIgfSBmcm9tICcuLi9ob3Zlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uL2hvdmVyL2hvdmVyRGVsZWdhdGUuanMnO1xuaW1wb3J0IHsgZ2V0QmFzZUxheWVySG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uL2hvdmVyL2hvdmVyRGVsZWdhdGUyLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgcmVuZGVyTGFiZWxXaXRoSWNvbnMgfSBmcm9tICcuLi9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBvYmplY3RzIGZyb20gJy4uLy4uLy4uL2NvbW1vbi9vYmplY3RzLmpzJztcblxuLyoqXG4gKiBBIHJhbmdlIHRvIGJlIGhpZ2hsaWdodGVkLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElIaWdobGlnaHQge1xuXHRzdGFydDogbnVtYmVyO1xuXHRlbmQ6IG51bWJlcjtcblx0cmVhZG9ubHkgZXh0cmFDbGFzc2VzPzogcmVhZG9ubHkgc3RyaW5nW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUhpZ2hsaWdodGVkTGFiZWxPcHRpb25zIHtcblxuXHQvKipcblx0ICogV2hldGhlciB0aGUgbGFiZWwgc3VwcG9ydHMgcmVuZGVyaW5nIGljb25zLlxuXHQgKi9cblx0cmVhZG9ubHkgc3VwcG9ydEljb25zPzogYm9vbGVhbjtcblxuXHRyZWFkb25seSBob3ZlckRlbGVnYXRlPzogSUhvdmVyRGVsZWdhdGU7XG59XG5cbi8qKlxuICogQSB3aWRnZXQgd2hpY2ggY2FuIHJlbmRlciBhIGxhYmVsIHdpdGggc3Vic3RyaW5nIGhpZ2hsaWdodHMsIG9mdGVuXG4gKiBvcmlnaW5hdGluZyBmcm9tIGEgZmlsdGVyIGZ1bmN0aW9uIGxpa2UgdGhlIGZ1enp5IG1hdGNoZXIuXG4gKi9cbmV4cG9ydCBjbGFzcyBIaWdobGlnaHRlZExhYmVsIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkb21Ob2RlOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSB0ZXh0OiBzdHJpbmcgPSAnJztcblx0cHJpdmF0ZSB0aXRsZTogc3RyaW5nID0gJyc7XG5cdHByaXZhdGUgaGlnaGxpZ2h0czogcmVhZG9ubHkgSUhpZ2hsaWdodFtdID0gW107XG5cdHByaXZhdGUgc3VwcG9ydEljb25zOiBib29sZWFuO1xuXHRwcml2YXRlIGRpZEV2ZXJSZW5kZXI6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBjdXN0b21Ib3ZlcjogSU1hbmFnZWRIb3ZlciB8IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogQ3JlYXRlIGEgbmV3IHtAbGluayBIaWdobGlnaHRlZExhYmVsfS5cblx0ICpcblx0ICogQHBhcmFtIGNvbnRhaW5lciBUaGUgcGFyZW50IGNvbnRhaW5lciB0byBhcHBlbmQgdG8uXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM/OiBJSGlnaGxpZ2h0ZWRMYWJlbE9wdGlvbnMpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5zdXBwb3J0SWNvbnMgPSBvcHRpb25zPy5zdXBwb3J0SWNvbnMgPz8gZmFsc2U7XG5cdFx0dGhpcy5kb21Ob2RlID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCdzcGFuLm1vbmFjby1oaWdobGlnaHRlZC1sYWJlbCcpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGUgbGFiZWwncyBET00gbm9kZS5cblx0ICovXG5cdGdldCBlbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5kb21Ob2RlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNldCB0aGUgbGFiZWwgYW5kIGhpZ2hsaWdodHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB0ZXh0IFRoZSBsYWJlbCB0byBkaXNwbGF5LlxuXHQgKiBAcGFyYW0gaGlnaGxpZ2h0cyBUaGUgcmFuZ2VzIHRvIGhpZ2hsaWdodC5cblx0ICogQHBhcmFtIHRpdGxlIEFuIG9wdGlvbmFsIHRpdGxlIGZvciB0aGUgaG92ZXIgdG9vbHRpcC5cblx0ICogQHBhcmFtIGVzY2FwZU5ld0xpbmVzIFdoZXRoZXIgdG8gZXNjYXBlIG5ldyBsaW5lcy5cblx0ICogQHJldHVybnNcblx0ICovXG5cdHNldCh0ZXh0OiBzdHJpbmcgfCB1bmRlZmluZWQsIGhpZ2hsaWdodHM6IHJlYWRvbmx5IElIaWdobGlnaHRbXSA9IFtdLCB0aXRsZTogc3RyaW5nID0gJycsIGVzY2FwZU5ld0xpbmVzPzogYm9vbGVhbikge1xuXHRcdGlmICghdGV4dCkge1xuXHRcdFx0dGV4dCA9ICcnO1xuXHRcdH1cblxuXHRcdGlmIChlc2NhcGVOZXdMaW5lcykge1xuXHRcdFx0Ly8gYWRqdXN0cyBoaWdobGlnaHRzIGlucGxhY2Vcblx0XHRcdHRleHQgPSBIaWdobGlnaHRlZExhYmVsLmVzY2FwZU5ld0xpbmVzKHRleHQsIGhpZ2hsaWdodHMpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmRpZEV2ZXJSZW5kZXIgJiYgdGhpcy50ZXh0ID09PSB0ZXh0ICYmIHRoaXMudGl0bGUgPT09IHRpdGxlICYmIG9iamVjdHMuZXF1YWxzKHRoaXMuaGlnaGxpZ2h0cywgaGlnaGxpZ2h0cykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnRleHQgPSB0ZXh0O1xuXHRcdHRoaXMudGl0bGUgPSB0aXRsZTtcblx0XHR0aGlzLmhpZ2hsaWdodHMgPSBoaWdobGlnaHRzO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlcigpOiB2b2lkIHtcblxuXHRcdGNvbnN0IGNoaWxkcmVuOiBBcnJheTxIVE1MU3BhbkVsZW1lbnQgfCBzdHJpbmc+ID0gW107XG5cdFx0bGV0IHBvcyA9IDA7XG5cblx0XHRmb3IgKGNvbnN0IGhpZ2hsaWdodCBvZiB0aGlzLmhpZ2hsaWdodHMpIHtcblx0XHRcdGlmIChoaWdobGlnaHQuZW5kID09PSBoaWdobGlnaHQuc3RhcnQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwb3MgPCBoaWdobGlnaHQuc3RhcnQpIHtcblx0XHRcdFx0Y29uc3Qgc3Vic3RyaW5nID0gdGhpcy50ZXh0LnN1YnN0cmluZyhwb3MsIGhpZ2hsaWdodC5zdGFydCk7XG5cdFx0XHRcdGlmICh0aGlzLnN1cHBvcnRJY29ucykge1xuXHRcdFx0XHRcdGNoaWxkcmVuLnB1c2goLi4ucmVuZGVyTGFiZWxXaXRoSWNvbnMoc3Vic3RyaW5nKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2hpbGRyZW4ucHVzaChzdWJzdHJpbmcpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHBvcyA9IGhpZ2hsaWdodC5zdGFydDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3Vic3RyaW5nID0gdGhpcy50ZXh0LnN1YnN0cmluZyhwb3MsIGhpZ2hsaWdodC5lbmQpO1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IGRvbS4kKCdzcGFuLmhpZ2hsaWdodCcsIHVuZGVmaW5lZCwgLi4udGhpcy5zdXBwb3J0SWNvbnMgPyByZW5kZXJMYWJlbFdpdGhJY29ucyhzdWJzdHJpbmcpIDogW3N1YnN0cmluZ10pO1xuXG5cdFx0XHRpZiAoaGlnaGxpZ2h0LmV4dHJhQ2xhc3Nlcykge1xuXHRcdFx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoLi4uaGlnaGxpZ2h0LmV4dHJhQ2xhc3Nlcyk7XG5cdFx0XHR9XG5cblx0XHRcdGNoaWxkcmVuLnB1c2goZWxlbWVudCk7XG5cdFx0XHRwb3MgPSBoaWdobGlnaHQuZW5kO1xuXHRcdH1cblxuXHRcdGlmIChwb3MgPCB0aGlzLnRleHQubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBzdWJzdHJpbmcgPSB0aGlzLnRleHQuc3Vic3RyaW5nKHBvcywpO1xuXHRcdFx0aWYgKHRoaXMuc3VwcG9ydEljb25zKSB7XG5cdFx0XHRcdGNoaWxkcmVuLnB1c2goLi4ucmVuZGVyTGFiZWxXaXRoSWNvbnMoc3Vic3RyaW5nKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjaGlsZHJlbi5wdXNoKHN1YnN0cmluZyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZG9tLnJlc2V0KHRoaXMuZG9tTm9kZSwgLi4uY2hpbGRyZW4pO1xuXG5cdFx0aWYgKHRoaXMub3B0aW9ucz8uaG92ZXJEZWxlZ2F0ZT8uc2hvd05hdGl2ZUhvdmVyKSB7XG5cdFx0XHQvKiBXaGlsZSBjdXN0b20gaG92ZXIgaXMgbm90IGluc2lkZSBjdXN0b20gaG92ZXIgKi9cblx0XHRcdHRoaXMuZG9tTm9kZS50aXRsZSA9IHRoaXMudGl0bGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICghdGhpcy5jdXN0b21Ib3ZlciAmJiB0aGlzLnRpdGxlICE9PSAnJykge1xuXHRcdFx0XHRjb25zdCBob3ZlckRlbGVnYXRlID0gdGhpcy5vcHRpb25zPy5ob3ZlckRlbGVnYXRlID8/IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpO1xuXHRcdFx0XHR0aGlzLmN1c3RvbUhvdmVyID0gdGhpcy5fcmVnaXN0ZXIoZ2V0QmFzZUxheWVySG92ZXJEZWxlZ2F0ZSgpLnNldHVwTWFuYWdlZEhvdmVyKGhvdmVyRGVsZWdhdGUsIHRoaXMuZG9tTm9kZSwgdGhpcy50aXRsZSkpO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLmN1c3RvbUhvdmVyKSB7XG5cdFx0XHRcdHRoaXMuY3VzdG9tSG92ZXIudXBkYXRlKHRoaXMudGl0bGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuZGlkRXZlclJlbmRlciA9IHRydWU7XG5cdH1cblxuXHRzdGF0aWMgZXNjYXBlTmV3TGluZXModGV4dDogc3RyaW5nLCBoaWdobGlnaHRzOiByZWFkb25seSBJSGlnaGxpZ2h0W10pOiBzdHJpbmcge1xuXHRcdGxldCB0b3RhbCA9IDA7XG5cdFx0bGV0IGV4dHJhID0gMDtcblxuXHRcdHJldHVybiB0ZXh0LnJlcGxhY2UoL1xcclxcbnxcXHJ8XFxuL2csIChtYXRjaCwgb2Zmc2V0KSA9PiB7XG5cdFx0XHRleHRyYSA9IG1hdGNoID09PSAnXFxyXFxuJyA/IC0xIDogMDtcblx0XHRcdG9mZnNldCArPSB0b3RhbDtcblxuXHRcdFx0Zm9yIChjb25zdCBoaWdobGlnaHQgb2YgaGlnaGxpZ2h0cykge1xuXHRcdFx0XHRpZiAoaGlnaGxpZ2h0LmVuZCA8PSBvZmZzZXQpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoaGlnaGxpZ2h0LnN0YXJ0ID49IG9mZnNldCkge1xuXHRcdFx0XHRcdGhpZ2hsaWdodC5zdGFydCArPSBleHRyYTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoaGlnaGxpZ2h0LmVuZCA+PSBvZmZzZXQpIHtcblx0XHRcdFx0XHRoaWdobGlnaHQuZW5kICs9IGV4dHJhO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRvdGFsICs9IGV4dHJhO1xuXHRcdFx0cmV0dXJuICdcXHUyM0NFJztcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBR3JCLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsa0JBQWtCO0FBQzNCLFlBQVksYUFBYTtBQXlCbEIsTUFBTSx5QkFBeUIsV0FBVztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQWVoRCxZQUFZLFdBQXlDLFNBQW9DO0FBQ3hGLFVBQU07QUFEOEM7QUFackQsU0FBUSxPQUFlO0FBQ3ZCLFNBQVEsUUFBZ0I7QUFDeEIsU0FBUSxhQUFvQyxDQUFDO0FBRTdDLFNBQVEsZ0JBQXlCO0FBV2hDLFNBQUssZUFBZSxTQUFTLGdCQUFnQjtBQUM3QyxTQUFLLFVBQVUsSUFBSSxPQUFPLFdBQVcsSUFBSSxFQUFFLCtCQUErQixDQUFDO0FBQUEsRUFDNUU7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLElBQUksVUFBdUI7QUFDMUIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBV0EsSUFBSSxNQUEwQixhQUFvQyxDQUFDLEdBQUcsUUFBZ0IsSUFBSSxnQkFBMEI7QUFDbkgsUUFBSSxDQUFDLE1BQU07QUFDVixhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksZ0JBQWdCO0FBRW5CLGFBQU8saUJBQWlCLGVBQWUsTUFBTSxVQUFVO0FBQUEsSUFDeEQ7QUFFQSxRQUFJLEtBQUssaUJBQWlCLEtBQUssU0FBUyxRQUFRLEtBQUssVUFBVSxTQUFTLFFBQVEsT0FB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
