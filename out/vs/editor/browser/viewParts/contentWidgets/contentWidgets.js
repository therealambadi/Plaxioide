import * as dom from "../../../../base/browser/dom.js";
import { createFastDomNode } from "../../../../base/browser/fastDomNode.js";
import { ContentWidgetPositionPreference } from "../../editorBrowser.js";
import { PartFingerprint, PartFingerprints, ViewPart } from "../../view/viewPart.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { PositionAffinity } from "../../../common/model.js";
class ViewContentWidgets extends ViewPart {
  constructor(context, viewDomNode) {
    super(context);
    this._viewDomNode = viewDomNode;
    this._widgets = {};
    this.domNode = createFastDomNode(document.createElement("div"));
    PartFingerprints.write(this.domNode, PartFingerprint.ContentWidgets);
    this.domNode.setClassName("contentWidgets");
    this.domNode.setPosition("absolute");
    this.domNode.setTop(0);
    this.overflowingContentWidgetsDomNode = createFastDomNode(document.createElement("div"));
    PartFingerprints.write(this.overflowingContentWidgetsDomNode, PartFingerprint.OverflowingContentWidgets);
    this.overflowingContentWidgetsDomNode.setClassName("overflowingContentWidgets");
  }
  dispose() {
    super.dispose();
    this._widgets = {};
  }
  // --- begin event handlers
  onConfigurationChanged(e) {
    const keys = Object.keys(this._widgets);
    for (const widgetId of keys) {
      this._widgets[widgetId].onConfigurationChanged(e);
    }
    return true;
  }
  onDecorationsChanged(e) {
    return true;
  }
  onFlushed(e) {
    return true;
  }
  onLineMappingChanged(e) {
    this._updateAnchorsViewPositions();
    return true;
  }
  onLinesChanged(e) {
    this._updateAnchorsViewPositions();
    return true;
  }
  onLinesDeleted(e) {
    this._updateAnchorsViewPositions();
    return true;
  }
  onLinesInserted(e) {
    this._updateAnchorsViewPositions();
    return true;
  }
  onScrollChanged(e) {
    return true;
  }
  onZonesChanged(e) {
    return true;
  }
  // ---- end view event handlers
  _updateAnchorsViewPositions() {
    const keys = Object.keys(this._widgets);
    for (const widgetId of keys) {
      this._widgets[widgetId].updateAnchorViewPosition();
    }
  }
  addWidget(_widget) {
    const myWidget = new Widget(this._context, this._viewDomNode, _widget);
    this._widgets[myWidget.id] = myWidget;
    if (myWidget.allowEditorOverflow) {
      this.overflowingContentWidgetsDomNode.appendChild(myWidget.domNode);
    } else {
      this.domNode.appendChild(myWidget.domNode);
    }
    this.setShouldRender();
  }
  setWidgetPosition(widget, primaryAnchor, secondaryAnchor, preference, affinity) {
    const myWidget = this._widgets[widget.getId()];
    myWidget.setPosition(primaryAnchor, secondaryAnchor, preference, affinity);
    this.setShouldRender();
  }
  removeWidget(widget) {
    const widgetId = widget.getId();
    if (this._widgets.hasOwnProperty(widgetId)) {
      const myWidget = this._widgets[widgetId];
      delete this._widgets[widgetId];
      const domNode = myWidget.domNode.domNode;
      domNode.remove();
      domNode.removeAttribute("monaco-visible-content-widget");
      this.setShouldRender();
    }
  }
  shouldSuppressMouseDownOnWidget(widgetId) {
    if (this._widgets.hasOwnProperty(widgetId)) {
      return this._widgets[widgetId].suppressMouseDown;
    }
    return false;
  }
  onBeforeRender(viewportData) {
    const keys = Object.keys(this._widgets);
    for (const widgetId of keys) {
      this._widgets[widgetId].onBeforeRender(viewportData);
    }
  }
  prepareRender(ctx) {
    const keys = Object.keys(this._widgets);
    for (const widgetId of keys) {
      this._widgets[widgetId].prepareRender(ctx);
    }
  }
  render(ctx) {
    const keys = Object.keys(this._widgets);
    for (const widgetId of keys) {
      this._widgets[widgetId].render(ctx);
    }
  }
}
class Widget {
  constructor(context, viewDomNode, actual) {
    this._primaryAnchor = new PositionPair(null, null);
    this._secondaryAnchor = new PositionPair(null, null);
    this._context = context;
    this._viewDomNode = viewDomNode;
    this._actual = actual;
    this.domNode = createFastDomNode(this._actual.getDomNode());
    this.id = this._actual.getId();
    this.allowEditorOverflow = this._actual.allowEditorOverflow || false;
    this.suppressMouseDown = this._actual.suppressMouseDown || false;
    const options = this._context.configuration.options;
    const layoutInfo = options.get(EditorOption.layoutInfo);
    this._fixedOverflowWidgets = options.get(EditorOption.fixedOverflowWidgets);
    this._contentWidth = layoutInfo.contentWidth;
    this._contentLeft = layoutInfo.contentLeft;
    this._lineHeight = options.get(EditorOption.lineHeight);
    this._affinity = null;
    this._preference = [];
    this._cachedDomNodeOffsetWidth = -1;
    this._cachedDomNodeOffsetHeight = -1;
    this._maxWidth = this._getMaxWidth();
    this._isVisible = false;
    this._renderData = null;
    this.domNode.setPosition(this._fixedOverflowWidgets && this.allowEditorOverflow ? "fixed" : "absolute");
    this.domNode.setDisplay("none");
    this.domNode.setVisibility("hidden");
    this.domNode.setAttribute("widgetId", this.id);
    this.domNode.setMaxWidth(this._maxWidth);
  }
  onConfigurationChanged(e) {
    const options = this._context.configuration.options;
    this._lineHeight = options.get(EditorOption.lineHeight);
    if (e.hasChanged(EditorOption.layoutInfo)) {
      const layoutInfo = options.get(EditorOption.layoutInfo);
      this._contentLeft = layoutInfo.contentLeft;
      this._contentWidth = layoutInfo.contentWidth;
      this._maxWidth = this._getMaxWidth();
    }
  }
  updateAnchorViewPosition() {
    this._setPosition(this._affinity, this._primaryAnchor.modelPosition, this._secondaryAnchor.modelPosition);
  }
  _setPosition(affinity, primaryAnchor, secondaryAnchor) {
    this._affinity = affinity;
    this._primaryAnchor = getValidPositionPair(primaryAnchor, this._context.viewModel, this._affinity);
    this._secondaryAnchor = getValidPositionPair(secondaryAnchor, this._context.viewModel, this._affinity);
    function getValidPositionPair(position, viewModel, affinity2) {
      if (!position) {
        return new PositionPair(null, null);
      }
      const validModelPosition = viewModel.model.validatePosition(position);
      if (viewModel.coordinatesConverter.modelPositionIsVisible(validModelPosition)) {
        const viewPosition = viewModel.coordinatesConverter.convertModelPositionToViewPosition(validModelPosition, affinity2 ?? void 0);
        return new PositionPair(position, viewPosition);
      }
      return new PositionPair(position, null);
    }
  }
  _getMaxWidth() {
    const elDocument = this.domNode.domNode.ownerDocument;
    const elWindow = elDocument.defaultView;
    return this.allowEditorOverflow ? elWindow?.innerWidth || elDocument.documentElement.offsetWidth || elDocument.body.offsetWidth : this._contentWidth;
  }
  setPosition(primaryAnchor, secondaryAnchor, preference, affinity) {
    this._setPosition(affinity, primaryAnchor, secondaryAnchor);
    this._preference = preference;
    if (this._primaryAnchor.viewPosition && this._preference && this._preference.length > 0) {
      this.domNode.setDisplay("block");
    } else {
      this.domNode.setDisplay("none");
    }
    this._cachedDomNodeOffsetWidth = -1;
    this._cachedDomNodeOffsetHeight = -1;
  }
  _layoutBoxInViewport(anchor, width, height, ctx) {
    const aboveLineTop = anchor.top;
    const heightAvailableAboveLine = aboveLineTop;
    const underLineTop = anchor.top + anchor.height;
    const heightAvailableUnderLine = ctx.viewportHeight - underLineTop;
    const aboveTop = aboveLineTop - height;
    const fitsAbove = heightAvailableAboveLine >= height;
    const belowTop = underLineTop;
    const fitsBelow = heightAvailableUnderLine >= height;
    let left = anchor.left;
    if (left + width > ctx.scrollLeft + ctx.viewportWidth) {
      left = ctx.scrollLeft + ctx.viewportWidth - width;
    }
    if (left < ctx.scrollLeft) {
      left = ctx.scrollLeft;
    }
    return { fitsAbove, aboveTop, fitsBelow, belowTop, left };
  }
  _layoutHorizontalSegmentInPage(windowSize, domNodePosition, left, width) {
    const LEFT_PADDING = 15;
    const RIGHT_PADDING = 15;
    const MIN_LIMIT = Math.max(LEFT_PADDING, domNodePosition.left - width);
    const MAX_LIMIT = Math.min(domNodePosition.left + domNodePosition.width + width, windowSize.width - RIGHT_PADDING);
    const elDocument = this._viewDomNode.domNode.ownerDocument;
    const elWindow = elDocument.defaultView;
    let absoluteLeft = domNodePosition.left + left - (elWindow?.scrollX ?? 0);
    if (absoluteLeft + width > MAX_LIMIT) {
      const delta = absoluteLeft - (MAX_LIMIT - width);
      absoluteLeft -= delta;
      left -= delta;
    }
    if (absoluteLeft < MIN_LIMIT) {
      const delta = absoluteLeft - MIN_LIMIT;
      absoluteLeft -= delta;
      left -= delta;
    }
    return [left, absoluteLeft];
  }
  _layoutBoxInPage(anchor, width, height, ctx) {
    const aboveTop = anchor.top - height;
    const belowTop = anchor.top + anchor.height;
    const domNodePosition = dom.getDomNodePagePosition(this._viewDomNode.domNode);
    const elDocument = this._viewDomNode.domNode.ownerDocument;
    const elWindow = elDocument.defaultView;
    const absoluteAboveTop = domNodePosition.top + aboveTop - (elWindow?.scrollY ?? 0);
    const absoluteBelowTop = domNodePosition.top + belowTop - (elWindow?.scrollY ?? 0);
    const windowSize = dom.getClientArea(elDocument.body);
    const [left, absoluteAboveLeft] = this._layoutHorizontalSegmentInPage(windowSize, domNodePosition, anchor.left - ctx.scrollLeft + this._contentLeft, width);
    const TOP_PADDING = 22;
    const BOTTOM_PADDING = 22;
    const fitsAbove = absoluteAboveTop >= TOP_PADDING;
    const fitsBelow = absoluteBelowTop + height <= windowSize.height - BOTTOM_PADDING;
    if (this._fixedOverflowWidgets) {
      return {
        fitsAbove,
        aboveTop: Math.max(absoluteAboveTop, TOP_PADDING),
        fitsBelow,
        belowTop: absoluteBelowTop,
        left: absoluteAboveLeft
      };
    }
    return { fitsAbove, aboveTop, fitsBelow, belowTop, left };
  }
  _prepareRenderWidgetAtExactPositionOverflowing(topLeft) {
    return new Coordinate(topLeft.top, topLeft.left + this._contentLeft);
  }
  /**
   * Compute the coordinates above and below the primary and secondary anchors.
   * The content widget *must* touch the primary anchor.
   * The content widget should touch if possible the secondary anchor.
   */
  _getAnchorsCoordinates(ctx) {
    const primary = getCoordinates(this._primaryAnchor.viewPosition, this._affinity, this._lineHeight);
    const secondaryViewPosition = this._secondaryAnchor.viewPosition?.lineNumber === this._primaryAnchor.viewPosition?.lineNumber ? this._secondaryAnchor.viewPosition : null;
    const secondary = getCoordinates(secondaryViewPosition, this._affinity, this._lineHeight);
    return { primary, secondary };
    function getCoordinates(position, affinity, lineHeight) {
      if (!position) {
        return null;
      }
      const horizontalPosition = ctx.visibleRangeForPosition(position);
      if (!horizontalPosition) {
        return null;
      }
      const left = position.column === 1 && affinity === PositionAffinity.LeftOfInjectedText ? 0 : horizontalPosition.left;
      const top = ctx.getVerticalOffsetForLineNumber(position.lineNumber) - ctx.scrollTop;
      return new AnchorCoordinate(top, left, lineHeight);
    }
  }
  _reduceAnchorCoordinates(primary, secondary, width) {
    if (!secondary) {
      return primary;
    }
    const fontInfo = this._context.configuration.options.get(EditorOption.fontInfo);
    let left = secondary.left;
    if (left < primary.left) {
      left = Math.max(left, primary.left - width + fontInfo.typicalFullwidthCharacterWidth);
    } else {
      left = Math.min(left, primary.left + width - fontInfo.typicalFullwidthCharacterWidth);
    }
    return new AnchorCoordinate(primary.top, left, primary.height);
  }
  _prepareRenderWidget(ctx) {
    if (!this._preference || this._preference.length === 0) {
      return null;
    }
    const { primary, secondary } = this._getAnchorsCoordinates(ctx);
    if (!primary) {
      return {
        kind: "offViewport",
        preserveFocus: this.domNode.domNode.contains(this.domNode.domNode.ownerDocument.activeElement)
      };
    }
    if (this._cachedDomNodeOffsetWidth === -1 || this._cachedDomNodeOffsetHeight === -1) {
      let preferredDimensions = null;
      if (typeof this._actual.beforeRender === "function") {
        preferredDimensions = safeInvoke(this._actual.beforeRender, this._actual);
      }
      if (preferredDimensions) {
        this._cachedDomNodeOffsetWidth = preferredDimensions.width;
        this._cachedDomNodeOffsetHeight = preferredDimensions.height;
      } else {
        const domNode = this.domNode.domNode;
        const clientRect = domNode.getBoundingClientRect();
        this._cachedDomNodeOffsetWidth = Math.round(clientRect.width);
        this._cachedDomNodeOffsetHeight = Math.round(clientRect.height);
      }
    }
    const anchor = this._reduceAnchorCoordinates(primary, secondary, this._cachedDomNodeOffsetWidth);
    let placement;
    if (this.allowEditorOverflow) {
      placement = this._layoutBoxInPage(anchor, this._cachedDomNodeOffsetWidth, this._cachedDomNodeOffsetHeight, ctx);
    } else {
      placement = this._layoutBoxInViewport(anchor, this._cachedDomNodeOffsetWidth, this._cachedDomNodeOffsetHeight, ctx);
    }
    for (let pass = 1; pass <= 2; pass++) {
      for (const pref of this._preference) {
        if (pref === ContentWidgetPositionPreference.ABOVE) {
          if (!placement) {
            return null;
          }
          if (pass === 2 || placement.fitsAbove) {
            return {
              kind: "inViewport",
              coordinate: new Coordinate(placement.aboveTop, placement.left),
              position: ContentWidgetPositionPreference.ABOVE
            };
          }
        } else if (pref === ContentWidgetPositionPreference.BELOW) {
          if (!placement) {
            return null;
          }
          if (pass === 2 || placement.fitsBelow) {
            return {
              kind: "inViewport",
              coordinate: new Coordinate(placement.belowTop, placement.left),
              position: ContentWidgetPositionPreference.BELOW
            };
          }
        } else {
          if (this.allowEditorOverflow) {
            return {
              kind: "inViewport",
              coordinate: this._prepareRenderWidgetAtExactPositionOverflowing(new Coordinate(anchor.top, anchor.left)),
              position: ContentWidgetPositionPreference.EXACT
            };
          } else {
            return {
              kind: "inViewport",
              coordinate: new Coordinate(anchor.top, anchor.left),
              position: ContentWidgetPositionPreference.EXACT
            };
          }
        }
      }
    }
    return null;
  }
  /**
   * On this first pass, we ensure that the content widget (if it is in the viewport) has the max width set correctly.
   */
  onBeforeRender(viewportData) {
    if (!this._primaryAnchor.viewPosition || !this._preference) {
      return;
    }
    if (this._primaryAnchor.viewPosition.lineNumber < viewportData.startLineNumber || this._primaryAnchor.viewPosition.lineNumber > viewportData.endLineNumber) {
      return;
    }
    this.domNode.setMaxWidth(this._maxWidth);
  }
  prepareRender(ctx) {
    this._renderData = this._prepareRenderWidget(ctx);
  }
  render(ctx) {
    if (!this._renderData || this._renderData.kind === "offViewport") {
      if (this._isVisible) {
        this.domNode.removeAttribute("monaco-visible-content-widget");
        this._isVisible = false;
        if (this._renderData?.kind === "offViewport" && this._renderData.preserveFocus) {
          this.domNode.setTop(-1e3);
        } else {
          this.domNode.setVisibility("hidden");
        }
      }
      if (typeof this._actual.afterRender === "function") {
        safeInvoke(this._actual.afterRender, this._actual, null, null);
      }
      return;
    }
    if (this.allowEditorOverflow) {
      this.domNode.setTop(this._renderData.coordinate.top);
      this.domNode.setLeft(this._renderData.coordinate.left);
    } else {
      this.domNode.setTop(this._renderData.coordinate.top + ctx.scrollTop - ctx.bigNumbersDelta);
      this.domNode.setLeft(this._renderData.coordinate.left);
    }
    if (!this._isVisible) {
      this.domNode.setVisibility("inherit");
      this.domNode.setAttribute("monaco-visible-content-widget", "true");
      this._isVisible = true;
    }
    if (typeof this._actual.afterRender === "function") {
      safeInvoke(this._actual.afterRender, this._actual, this._renderData.position, this._renderData.coordinate);
    }
  }
}
class PositionPair {
  constructor(modelPosition, viewPosition) {
    this.modelPosition = modelPosition;
    this.viewPosition = viewPosition;
  }
}
class Coordinate {
  constructor(top, left) {
    this.top = top;
    this.left = left;
    this._coordinateBrand = void 0;
  }
}
class AnchorCoordinate {
  constructor(top, left, height) {
    this.top = top;
    this.left = left;
    this.height = height;
    this._anchorCoordinateBrand = void 0;
  }
}
function safeInvoke(fn, thisArg, ...args) {
  try {
    return fn.call(thisArg, ...args);
  } catch {
    return null;
  }
}
export {
  ViewContentWidgets
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci92aWV3UGFydHMvY29udGVudFdpZGdldHMvY29udGVudFdpZGdldHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBGYXN0RG9tTm9kZSwgY3JlYXRlRmFzdERvbU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZmFzdERvbU5vZGUuanMnO1xuaW1wb3J0IHsgQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZSwgSUNvbnRlbnRXaWRnZXQsIElDb250ZW50V2lkZ2V0UmVuZGVyZWRDb29yZGluYXRlIH0gZnJvbSAnLi4vLi4vZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBQYXJ0RmluZ2VycHJpbnQsIFBhcnRGaW5nZXJwcmludHMsIFZpZXdQYXJ0IH0gZnJvbSAnLi4vLi4vdmlldy92aWV3UGFydC5qcyc7XG5pbXBvcnQgeyBSZW5kZXJpbmdDb250ZXh0LCBSZXN0cmljdGVkUmVuZGVyaW5nQ29udGV4dCB9IGZyb20gJy4uLy4uL3ZpZXcvcmVuZGVyaW5nQ29udGV4dC5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwvdmlld0NvbnRleHQuanMnO1xuaW1wb3J0ICogYXMgdmlld0V2ZW50cyBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgeyBWaWV3cG9ydERhdGEgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld0xheW91dC92aWV3TGluZXNWaWV3cG9ydERhdGEuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IElEaW1lbnNpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9kaW1lbnNpb24uanMnO1xuaW1wb3J0IHsgUG9zaXRpb25BZmZpbml0eSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSVZpZXdNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwuanMnO1xuXG4vKipcbiAqIFRoaXMgdmlldyBwYXJ0IGlzIHJlc3BvbnNpYmxlIGZvciByZW5kZXJpbmcgdGhlIGNvbnRlbnQgd2lkZ2V0cywgd2hpY2ggYXJlXG4gKiB1c2VkIGZvciByZW5kZXJpbmcgZWxlbWVudHMgdGhhdCBhcmUgYXNzb2NpYXRlZCB0byBhbiBlZGl0b3IgcG9zaXRpb24sXG4gKiBzdWNoIGFzIHN1Z2dlc3Rpb25zIG9yIHRoZSBwYXJhbWV0ZXIgaGludHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBWaWV3Q29udGVudFdpZGdldHMgZXh0ZW5kcyBWaWV3UGFydCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdmlld0RvbU5vZGU6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50Pjtcblx0cHJpdmF0ZSBfd2lkZ2V0czogeyBba2V5OiBzdHJpbmddOiBXaWRnZXQgfTtcblxuXHRwdWJsaWMgZG9tTm9kZTogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+O1xuXHRwdWJsaWMgb3ZlcmZsb3dpbmdDb250ZW50V2lkZ2V0c0RvbU5vZGU6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50PjtcblxuXHRjb25zdHJ1Y3Rvcihjb250ZXh0OiBWaWV3Q29udGV4dCwgdmlld0RvbU5vZGU6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50Pikge1xuXHRcdHN1cGVyKGNvbnRleHQpO1xuXHRcdHRoaXMuX3ZpZXdEb21Ob2RlID0gdmlld0RvbU5vZGU7XG5cdFx0dGhpcy5fd2lkZ2V0cyA9IHt9O1xuXG5cdFx0dGhpcy5kb21Ob2RlID0gY3JlYXRlRmFzdERvbU5vZGUoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpO1xuXHRcdFBhcnRGaW5nZXJwcmludHMud3JpdGUodGhpcy5kb21Ob2RlLCBQYXJ0RmluZ2VycHJpbnQuQ29udGVudFdpZGdldHMpO1xuXHRcdHRoaXMuZG9tTm9kZS5zZXRDbGFzc05hbWUoJ2NvbnRlbnRXaWRnZXRzJyk7XG5cdFx0dGhpcy5kb21Ob2RlLnNldFBvc2l0aW9uKCdhYnNvbHV0ZScpO1xuXHRcdHRoaXMuZG9tTm9kZS5zZXRUb3AoMCk7XG5cblx0XHR0aGlzLm92ZXJmbG93aW5nQ29udGVudFdpZGdldHNEb21Ob2RlID0gY3JlYXRlRmFzdERvbU5vZGUoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpO1xuXHRcdFBhcnRGaW5nZXJwcmludHMud3JpdGUodGhpcy5vdmVyZmxvd2luZ0NvbnRlbnRXaWRnZXRzRG9tTm9kZSwgUGFydEZpbmdlcnByaW50Lk92ZXJmbG93aW5nQ29udGVudFdpZGdldHMpO1xuXHRcdHRoaXMub3ZlcmZsb3dpbmdDb250ZW50V2lkZ2V0c0RvbU5vZGUuc2V0Q2xhc3NOYW1lKCdvdmVyZmxvd2luZ0NvbnRlbnRXaWRnZXRzJyk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fd2lkZ2V0cyA9IHt9O1xuXHR9XG5cblx0Ly8gLS0tIGJlZ2luIGV2ZW50IGhhbmRsZXJzXG5cblx0cHVibGljIG92ZXJyaWRlIG9uQ29uZmlndXJhdGlvbkNoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Q29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLl93aWRnZXRzKTtcblx0XHRmb3IgKGNvbnN0IHdpZGdldElkIG9mIGtleXMpIHtcblx0XHRcdHRoaXMuX3dpZGdldHNbd2lkZ2V0SWRdLm9uQ29uZmlndXJhdGlvbkNoYW5nZWQoZSk7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvbkRlY29yYXRpb25zQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdEZWNvcmF0aW9uc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdC8vIHRydWUgZm9yIGlubGluZSBkZWNvcmF0aW9ucyB0aGF0IGNhbiBlbmQgdXAgcmVsYXlvdXRpbmcgdGV4dFxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvbkZsdXNoZWQoZTogdmlld0V2ZW50cy5WaWV3Rmx1c2hlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0cHVibGljIG92ZXJyaWRlIG9uTGluZU1hcHBpbmdDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld0xpbmVNYXBwaW5nQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fdXBkYXRlQW5jaG9yc1ZpZXdQb3NpdGlvbnMoKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3TGluZXNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHR0aGlzLl91cGRhdGVBbmNob3JzVmlld1Bvc2l0aW9ucygpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvbkxpbmVzRGVsZXRlZChlOiB2aWV3RXZlbnRzLlZpZXdMaW5lc0RlbGV0ZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX3VwZGF0ZUFuY2hvcnNWaWV3UG9zaXRpb25zKCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0cHVibGljIG92ZXJyaWRlIG9uTGluZXNJbnNlcnRlZChlOiB2aWV3RXZlbnRzLlZpZXdMaW5lc0luc2VydGVkRXZlbnQpOiBib29sZWFuIHtcblx0XHR0aGlzLl91cGRhdGVBbmNob3JzVmlld1Bvc2l0aW9ucygpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvblNjcm9sbENoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3U2Nyb2xsQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0cHVibGljIG92ZXJyaWRlIG9uWm9uZXNDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld1pvbmVzQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvLyAtLS0tIGVuZCB2aWV3IGV2ZW50IGhhbmRsZXJzXG5cblx0cHJpdmF0ZSBfdXBkYXRlQW5jaG9yc1ZpZXdQb3NpdGlvbnMoKTogdm9pZCB7XG5cdFx0Y29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuX3dpZGdldHMpO1xuXHRcdGZvciAoY29uc3Qgd2lkZ2V0SWQgb2Yga2V5cykge1xuXHRcdFx0dGhpcy5fd2lkZ2V0c1t3aWRnZXRJZF0udXBkYXRlQW5jaG9yVmlld1Bvc2l0aW9uKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFkZFdpZGdldChfd2lkZ2V0OiBJQ29udGVudFdpZGdldCk6IHZvaWQge1xuXHRcdGNvbnN0IG15V2lkZ2V0ID0gbmV3IFdpZGdldCh0aGlzLl9jb250ZXh0LCB0aGlzLl92aWV3RG9tTm9kZSwgX3dpZGdldCk7XG5cdFx0dGhpcy5fd2lkZ2V0c1tteVdpZGdldC5pZF0gPSBteVdpZGdldDtcblxuXHRcdGlmIChteVdpZGdldC5hbGxvd0VkaXRvck92ZXJmbG93KSB7XG5cdFx0XHR0aGlzLm92ZXJmbG93aW5nQ29udGVudFdpZGdldHNEb21Ob2RlLmFwcGVuZENoaWxkKG15V2lkZ2V0LmRvbU5vZGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRvbU5vZGUuYXBwZW5kQ2hpbGQobXlXaWRnZXQuZG9tTm9kZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRTaG91bGRSZW5kZXIoKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRXaWRnZXRQb3NpdGlvbih3aWRnZXQ6IElDb250ZW50V2lkZ2V0LCBwcmltYXJ5QW5jaG9yOiBJUG9zaXRpb24gfCBudWxsLCBzZWNvbmRhcnlBbmNob3I6IElQb3NpdGlvbiB8IG51bGwsIHByZWZlcmVuY2U6IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2VbXSB8IG51bGwsIGFmZmluaXR5OiBQb3NpdGlvbkFmZmluaXR5IHwgbnVsbCk6IHZvaWQge1xuXHRcdGNvbnN0IG15V2lkZ2V0ID0gdGhpcy5fd2lkZ2V0c1t3aWRnZXQuZ2V0SWQoKV07XG5cdFx0bXlXaWRnZXQuc2V0UG9zaXRpb24ocHJpbWFyeUFuY2hvciwgc2Vjb25kYXJ5QW5jaG9yLCBwcmVmZXJlbmNlLCBhZmZpbml0eSk7XG5cblx0XHR0aGlzLnNldFNob3VsZFJlbmRlcigpO1xuXHR9XG5cblx0cHVibGljIHJlbW92ZVdpZGdldCh3aWRnZXQ6IElDb250ZW50V2lkZ2V0KTogdm9pZCB7XG5cdFx0Y29uc3Qgd2lkZ2V0SWQgPSB3aWRnZXQuZ2V0SWQoKTtcblx0XHRpZiAodGhpcy5fd2lkZ2V0cy5oYXNPd25Qcm9wZXJ0eSh3aWRnZXRJZCkpIHtcblx0XHRcdGNvbnN0IG15V2lkZ2V0ID0gdGhpcy5fd2lkZ2V0c1t3aWRnZXRJZF07XG5cdFx0XHRkZWxldGUgdGhpcy5fd2lkZ2V0c1t3aWRnZXRJZF07XG5cblx0XHRcdGNvbnN0IGRvbU5vZGUgPSBteVdpZGdldC5kb21Ob2RlLmRvbU5vZGU7XG5cdFx0XHRkb21Ob2RlLnJlbW92ZSgpO1xuXHRcdFx0ZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoJ21vbmFjby12aXNpYmxlLWNvbnRlbnQtd2lkZ2V0Jyk7XG5cblx0XHRcdHRoaXMuc2V0U2hvdWxkUmVuZGVyKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHNob3VsZFN1cHByZXNzTW91c2VEb3duT25XaWRnZXQod2lkZ2V0SWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl93aWRnZXRzLmhhc093blByb3BlcnR5KHdpZGdldElkKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3dpZGdldHNbd2lkZ2V0SWRdLnN1cHByZXNzTW91c2VEb3duO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgb25CZWZvcmVSZW5kZXIodmlld3BvcnREYXRhOiBWaWV3cG9ydERhdGEpOiB2b2lkIHtcblx0XHRjb25zdCBrZXlzID0gT2JqZWN0LmtleXModGhpcy5fd2lkZ2V0cyk7XG5cdFx0Zm9yIChjb25zdCB3aWRnZXRJZCBvZiBrZXlzKSB7XG5cdFx0XHR0aGlzLl93aWRnZXRzW3dpZGdldElkXS5vbkJlZm9yZVJlbmRlcih2aWV3cG9ydERhdGEpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBwcmVwYXJlUmVuZGVyKGN0eDogUmVuZGVyaW5nQ29udGV4dCk6IHZvaWQge1xuXHRcdGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLl93aWRnZXRzKTtcblx0XHRmb3IgKGNvbnN0IHdpZGdldElkIG9mIGtleXMpIHtcblx0XHRcdHRoaXMuX3dpZGdldHNbd2lkZ2V0SWRdLnByZXBhcmVSZW5kZXIoY3R4KTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcmVuZGVyKGN0eDogUmVzdHJpY3RlZFJlbmRlcmluZ0NvbnRleHQpOiB2b2lkIHtcblx0XHRjb25zdCBrZXlzID0gT2JqZWN0LmtleXModGhpcy5fd2lkZ2V0cyk7XG5cdFx0Zm9yIChjb25zdCB3aWRnZXRJZCBvZiBrZXlzKSB7XG5cdFx0XHR0aGlzLl93aWRnZXRzW3dpZGdldElkXS5yZW5kZXIoY3R4KTtcblx0XHR9XG5cdH1cbn1cblxuaW50ZXJmYWNlIElCb3hMYXlvdXRSZXN1bHQge1xuXHRmaXRzQWJvdmU6IGJvb2xlYW47XG5cdGFib3ZlVG9wOiBudW1iZXI7XG5cblx0Zml0c0JlbG93OiBib29sZWFuO1xuXHRiZWxvd1RvcDogbnVtYmVyO1xuXG5cdGxlZnQ6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIElPZmZWaWV3cG9ydFJlbmRlckRhdGEge1xuXHRraW5kOiAnb2ZmVmlld3BvcnQnO1xuXHRwcmVzZXJ2ZUZvY3VzOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgSUluVmlld3BvcnRSZW5kZXJEYXRhIHtcblx0a2luZDogJ2luVmlld3BvcnQnO1xuXHRjb29yZGluYXRlOiBDb29yZGluYXRlO1xuXHRwb3NpdGlvbjogQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZTtcbn1cblxudHlwZSBJUmVuZGVyRGF0YSA9IElJblZpZXdwb3J0UmVuZGVyRGF0YSB8IElPZmZWaWV3cG9ydFJlbmRlckRhdGE7XG5cbmNsYXNzIFdpZGdldCB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHQ6IFZpZXdDb250ZXh0O1xuXHRwcml2YXRlIHJlYWRvbmx5IF92aWV3RG9tTm9kZTogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3R1YWw6IElDb250ZW50V2lkZ2V0O1xuXG5cdHB1YmxpYyByZWFkb25seSBkb21Ob2RlOiBGYXN0RG9tTm9kZTxIVE1MRWxlbWVudD47XG5cdHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nO1xuXHRwdWJsaWMgcmVhZG9ubHkgYWxsb3dFZGl0b3JPdmVyZmxvdzogYm9vbGVhbjtcblx0cHVibGljIHJlYWRvbmx5IHN1cHByZXNzTW91c2VEb3duOiBib29sZWFuO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2ZpeGVkT3ZlcmZsb3dXaWRnZXRzOiBib29sZWFuO1xuXHRwcml2YXRlIF9jb250ZW50V2lkdGg6IG51bWJlcjtcblx0cHJpdmF0ZSBfY29udGVudExlZnQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfbGluZUhlaWdodDogbnVtYmVyO1xuXG5cdHByaXZhdGUgX3ByaW1hcnlBbmNob3I6IFBvc2l0aW9uUGFpciA9IG5ldyBQb3NpdGlvblBhaXIobnVsbCwgbnVsbCk7XG5cdHByaXZhdGUgX3NlY29uZGFyeUFuY2hvcjogUG9zaXRpb25QYWlyID0gbmV3IFBvc2l0aW9uUGFpcihudWxsLCBudWxsKTtcblx0cHJpdmF0ZSBfYWZmaW5pdHk6IFBvc2l0aW9uQWZmaW5pdHkgfCBudWxsO1xuXHRwcml2YXRlIF9wcmVmZXJlbmNlOiBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlW10gfCBudWxsO1xuXHRwcml2YXRlIF9jYWNoZWREb21Ob2RlT2Zmc2V0V2lkdGg6IG51bWJlcjtcblx0cHJpdmF0ZSBfY2FjaGVkRG9tTm9kZU9mZnNldEhlaWdodDogbnVtYmVyO1xuXHRwcml2YXRlIF9tYXhXaWR0aDogbnVtYmVyO1xuXHRwcml2YXRlIF9pc1Zpc2libGU6IGJvb2xlYW47XG5cblx0cHJpdmF0ZSBfcmVuZGVyRGF0YTogSVJlbmRlckRhdGEgfCBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKGNvbnRleHQ6IFZpZXdDb250ZXh0LCB2aWV3RG9tTm9kZTogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+LCBhY3R1YWw6IElDb250ZW50V2lkZ2V0KSB7XG5cdFx0dGhpcy5fY29udGV4dCA9IGNvbnRleHQ7XG5cdFx0dGhpcy5fdmlld0RvbU5vZGUgPSB2aWV3RG9tTm9kZTtcblx0XHR0aGlzLl9hY3R1YWwgPSBhY3R1YWw7XG5cblx0XHR0aGlzLmRvbU5vZGUgPSBjcmVhdGVGYXN0RG9tTm9kZSh0aGlzLl9hY3R1YWwuZ2V0RG9tTm9kZSgpKTtcblx0XHR0aGlzLmlkID0gdGhpcy5fYWN0dWFsLmdldElkKCk7XG5cdFx0dGhpcy5hbGxvd0VkaXRvck92ZXJmbG93ID0gdGhpcy5fYWN0dWFsLmFsbG93RWRpdG9yT3ZlcmZsb3cgfHwgZmFsc2U7XG5cdFx0dGhpcy5zdXBwcmVzc01vdXNlRG93biA9IHRoaXMuX2FjdHVhbC5zdXBwcmVzc01vdXNlRG93biB8fCBmYWxzZTtcblxuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucztcblx0XHRjb25zdCBsYXlvdXRJbmZvID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pO1xuXG5cdFx0dGhpcy5fZml4ZWRPdmVyZmxvd1dpZGdldHMgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZml4ZWRPdmVyZmxvd1dpZGdldHMpO1xuXHRcdHRoaXMuX2NvbnRlbnRXaWR0aCA9IGxheW91dEluZm8uY29udGVudFdpZHRoO1xuXHRcdHRoaXMuX2NvbnRlbnRMZWZ0ID0gbGF5b3V0SW5mby5jb250ZW50TGVmdDtcblx0XHR0aGlzLl9saW5lSGVpZ2h0ID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXG5cdFx0dGhpcy5fYWZmaW5pdHkgPSBudWxsO1xuXHRcdHRoaXMuX3ByZWZlcmVuY2UgPSBbXTtcblx0XHR0aGlzLl9jYWNoZWREb21Ob2RlT2Zmc2V0V2lkdGggPSAtMTtcblx0XHR0aGlzLl9jYWNoZWREb21Ob2RlT2Zmc2V0SGVpZ2h0ID0gLTE7XG5cdFx0dGhpcy5fbWF4V2lkdGggPSB0aGlzLl9nZXRNYXhXaWR0aCgpO1xuXHRcdHRoaXMuX2lzVmlzaWJsZSA9IGZhbHNlO1xuXHRcdHRoaXMuX3JlbmRlckRhdGEgPSBudWxsO1xuXG5cdFx0dGhpcy5kb21Ob2RlLnNldFBvc2l0aW9uKCh0aGlzLl9maXhlZE92ZXJmbG93V2lkZ2V0cyAmJiB0aGlzLmFsbG93RWRpdG9yT3ZlcmZsb3cpID8gJ2ZpeGVkJyA6ICdhYnNvbHV0ZScpO1xuXHRcdHRoaXMuZG9tTm9kZS5zZXREaXNwbGF5KCdub25lJyk7XG5cdFx0dGhpcy5kb21Ob2RlLnNldFZpc2liaWxpdHkoJ2hpZGRlbicpO1xuXHRcdHRoaXMuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ3dpZGdldElkJywgdGhpcy5pZCk7XG5cdFx0dGhpcy5kb21Ob2RlLnNldE1heFdpZHRoKHRoaXMuX21heFdpZHRoKTtcblx0fVxuXG5cdHB1YmxpYyBvbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld0NvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnM7XG5cdFx0dGhpcy5fbGluZUhlaWdodCA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvKSkge1xuXHRcdFx0Y29uc3QgbGF5b3V0SW5mbyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvKTtcblx0XHRcdHRoaXMuX2NvbnRlbnRMZWZ0ID0gbGF5b3V0SW5mby5jb250ZW50TGVmdDtcblx0XHRcdHRoaXMuX2NvbnRlbnRXaWR0aCA9IGxheW91dEluZm8uY29udGVudFdpZHRoO1xuXHRcdFx0dGhpcy5fbWF4V2lkdGggPSB0aGlzLl9nZXRNYXhXaWR0aCgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyB1cGRhdGVBbmNob3JWaWV3UG9zaXRpb24oKTogdm9pZCB7XG5cdFx0dGhpcy5fc2V0UG9zaXRpb24odGhpcy5fYWZmaW5pdHksIHRoaXMuX3ByaW1hcnlBbmNob3IubW9kZWxQb3NpdGlvbiwgdGhpcy5fc2Vjb25kYXJ5QW5jaG9yLm1vZGVsUG9zaXRpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0UG9zaXRpb24oYWZmaW5pdHk6IFBvc2l0aW9uQWZmaW5pdHkgfCBudWxsLCBwcmltYXJ5QW5jaG9yOiBJUG9zaXRpb24gfCBudWxsLCBzZWNvbmRhcnlBbmNob3I6IElQb3NpdGlvbiB8IG51bGwpOiB2b2lkIHtcblx0XHR0aGlzLl9hZmZpbml0eSA9IGFmZmluaXR5O1xuXHRcdHRoaXMuX3ByaW1hcnlBbmNob3IgPSBnZXRWYWxpZFBvc2l0aW9uUGFpcihwcmltYXJ5QW5jaG9yLCB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbCwgdGhpcy5fYWZmaW5pdHkpO1xuXHRcdHRoaXMuX3NlY29uZGFyeUFuY2hvciA9IGdldFZhbGlkUG9zaXRpb25QYWlyKHNlY29uZGFyeUFuY2hvciwgdGhpcy5fY29udGV4dC52aWV3TW9kZWwsIHRoaXMuX2FmZmluaXR5KTtcblxuXHRcdGZ1bmN0aW9uIGdldFZhbGlkUG9zaXRpb25QYWlyKHBvc2l0aW9uOiBJUG9zaXRpb24gfCBudWxsLCB2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFmZmluaXR5OiBQb3NpdGlvbkFmZmluaXR5IHwgbnVsbCk6IFBvc2l0aW9uUGFpciB7XG5cdFx0XHRpZiAoIXBvc2l0aW9uKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgUG9zaXRpb25QYWlyKG51bGwsIG51bGwpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gRG8gbm90IHRydXN0IHRoYXQgd2lkZ2V0cyBnaXZlIGEgdmFsaWQgcG9zaXRpb25cblx0XHRcdGNvbnN0IHZhbGlkTW9kZWxQb3NpdGlvbiA9IHZpZXdNb2RlbC5tb2RlbC52YWxpZGF0ZVBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRcdGlmICh2aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIubW9kZWxQb3NpdGlvbklzVmlzaWJsZSh2YWxpZE1vZGVsUG9zaXRpb24pKSB7XG5cdFx0XHRcdGNvbnN0IHZpZXdQb3NpdGlvbiA9IHZpZXdNb2RlbC5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0TW9kZWxQb3NpdGlvblRvVmlld1Bvc2l0aW9uKHZhbGlkTW9kZWxQb3NpdGlvbiwgYWZmaW5pdHkgPz8gdW5kZWZpbmVkKTtcblx0XHRcdFx0cmV0dXJuIG5ldyBQb3NpdGlvblBhaXIocG9zaXRpb24sIHZpZXdQb3NpdGlvbik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uUGFpcihwb3NpdGlvbiwgbnVsbCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0TWF4V2lkdGgoKTogbnVtYmVyIHtcblx0XHRjb25zdCBlbERvY3VtZW50ID0gdGhpcy5kb21Ob2RlLmRvbU5vZGUub3duZXJEb2N1bWVudDtcblx0XHRjb25zdCBlbFdpbmRvdyA9IGVsRG9jdW1lbnQuZGVmYXVsdFZpZXc7XG5cdFx0cmV0dXJuIChcblx0XHRcdHRoaXMuYWxsb3dFZGl0b3JPdmVyZmxvd1xuXHRcdFx0XHQ/IGVsV2luZG93Py5pbm5lcldpZHRoIHx8IGVsRG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50Lm9mZnNldFdpZHRoIHx8IGVsRG9jdW1lbnQuYm9keS5vZmZzZXRXaWR0aFxuXHRcdFx0XHQ6IHRoaXMuX2NvbnRlbnRXaWR0aFxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgc2V0UG9zaXRpb24ocHJpbWFyeUFuY2hvcjogSVBvc2l0aW9uIHwgbnVsbCwgc2Vjb25kYXJ5QW5jaG9yOiBJUG9zaXRpb24gfCBudWxsLCBwcmVmZXJlbmNlOiBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlW10gfCBudWxsLCBhZmZpbml0eTogUG9zaXRpb25BZmZpbml0eSB8IG51bGwpOiB2b2lkIHtcblx0XHR0aGlzLl9zZXRQb3NpdGlvbihhZmZpbml0eSwgcHJpbWFyeUFuY2hvciwgc2Vjb25kYXJ5QW5jaG9yKTtcblx0XHR0aGlzLl9wcmVmZXJlbmNlID0gcHJlZmVyZW5jZTtcblx0XHRpZiAodGhpcy5fcHJpbWFyeUFuY2hvci52aWV3UG9zaXRpb24gJiYgdGhpcy5fcHJlZmVyZW5jZSAmJiB0aGlzLl9wcmVmZXJlbmNlLmxlbmd0aCA+IDApIHtcblx0XHRcdC8vIHRoaXMgY29udGVudCB3aWRnZXQgd291bGQgbGlrZSB0byBiZSB2aXNpYmxlIGlmIHBvc3NpYmxlXG5cdFx0XHQvLyB3ZSBjaGFuZ2UgaXQgZnJvbSBgZGlzcGxheTpub25lYCB0byBgZGlzcGxheTpibG9ja2AgZXZlbiBpZiBpdFxuXHRcdFx0Ly8gbWlnaHQgYmUgb3V0c2lkZSB0aGUgdmlld3BvcnQgc3VjaCB0aGF0IHdlIGNhbiBtZWFzdXJlIGl0cyBzaXplXG5cdFx0XHQvLyBpbiBgcHJlcGFyZVJlbmRlcmBcblx0XHRcdHRoaXMuZG9tTm9kZS5zZXREaXNwbGF5KCdibG9jaycpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRvbU5vZGUuc2V0RGlzcGxheSgnbm9uZScpO1xuXHRcdH1cblx0XHR0aGlzLl9jYWNoZWREb21Ob2RlT2Zmc2V0V2lkdGggPSAtMTtcblx0XHR0aGlzLl9jYWNoZWREb21Ob2RlT2Zmc2V0SGVpZ2h0ID0gLTE7XG5cdH1cblxuXHRwcml2YXRlIF9sYXlvdXRCb3hJblZpZXdwb3J0KGFuY2hvcjogQW5jaG9yQ29vcmRpbmF0ZSwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIGN0eDogUmVuZGVyaW5nQ29udGV4dCk6IElCb3hMYXlvdXRSZXN1bHQge1xuXHRcdC8vIE91ciB2aXNpYmxlIGJveCBpcyBzcGxpdCBob3Jpem9udGFsbHkgYnkgdGhlIGN1cnJlbnQgbGluZSA9PiAyIGJveGVzXG5cblx0XHQvLyBhKSB0aGUgYm94IGFib3ZlIHRoZSBsaW5lXG5cdFx0Y29uc3QgYWJvdmVMaW5lVG9wID0gYW5jaG9yLnRvcDtcblx0XHRjb25zdCBoZWlnaHRBdmFpbGFibGVBYm92ZUxpbmUgPSBhYm92ZUxpbmVUb3A7XG5cblx0XHQvLyBiKSB0aGUgYm94IHVuZGVyIHRoZSBsaW5lXG5cdFx0Y29uc3QgdW5kZXJMaW5lVG9wID0gYW5jaG9yLnRvcCArIGFuY2hvci5oZWlnaHQ7XG5cdFx0Y29uc3QgaGVpZ2h0QXZhaWxhYmxlVW5kZXJMaW5lID0gY3R4LnZpZXdwb3J0SGVpZ2h0IC0gdW5kZXJMaW5lVG9wO1xuXG5cdFx0Y29uc3QgYWJvdmVUb3AgPSBhYm92ZUxpbmVUb3AgLSBoZWlnaHQ7XG5cdFx0Y29uc3QgZml0c0Fib3ZlID0gKGhlaWdodEF2YWlsYWJsZUFib3ZlTGluZSA+PSBoZWlnaHQpO1xuXHRcdGNvbnN0IGJlbG93VG9wID0gdW5kZXJMaW5lVG9wO1xuXHRcdGNvbnN0IGZpdHNCZWxvdyA9IChoZWlnaHRBdmFpbGFibGVVbmRlckxpbmUgPj0gaGVpZ2h0KTtcblxuXHRcdC8vIEFuZCBpdHMgbGVmdFxuXHRcdGxldCBsZWZ0ID0gYW5jaG9yLmxlZnQ7XG5cdFx0aWYgKGxlZnQgKyB3aWR0aCA+IGN0eC5zY3JvbGxMZWZ0ICsgY3R4LnZpZXdwb3J0V2lkdGgpIHtcblx0XHRcdGxlZnQgPSBjdHguc2Nyb2xsTGVmdCArIGN0eC52aWV3cG9ydFdpZHRoIC0gd2lkdGg7XG5cdFx0fVxuXHRcdGlmIChsZWZ0IDwgY3R4LnNjcm9sbExlZnQpIHtcblx0XHRcdGxlZnQgPSBjdHguc2Nyb2xsTGVmdDtcblx0XHR9XG5cblx0XHRyZXR1cm4geyBmaXRzQWJvdmUsIGFib3ZlVG9wLCBmaXRzQmVsb3csIGJlbG93VG9wLCBsZWZ0IH07XG5cdH1cblxuXHRwcml2YXRlIF9sYXlvdXRIb3Jpem9udGFsU2VnbWVudEluUGFnZSh3aW5kb3dTaXplOiBkb20uRGltZW5zaW9uLCBkb21Ob2RlUG9zaXRpb246IGRvbS5JRG9tTm9kZVBhZ2VQb3NpdGlvbiwgbGVmdDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogW251bWJlciwgbnVtYmVyXSB7XG5cdFx0Ly8gTGVhdmUgc29tZSBjbGVhcmFuY2UgdG8gdGhlIGxlZnQvcmlnaHRcblx0XHRjb25zdCBMRUZUX1BBRERJTkcgPSAxNTtcblx0XHRjb25zdCBSSUdIVF9QQURESU5HID0gMTU7XG5cblx0XHQvLyBJbml0aWFsbHksIHRoZSBsaW1pdHMgYXJlIGRlZmluZWQgYXMgdGhlIGRvbSBub2RlIGxpbWl0c1xuXHRcdGNvbnN0IE1JTl9MSU1JVCA9IE1hdGgubWF4KExFRlRfUEFERElORywgZG9tTm9kZVBvc2l0aW9uLmxlZnQgLSB3aWR0aCk7XG5cdFx0Y29uc3QgTUFYX0xJTUlUID0gTWF0aC5taW4oZG9tTm9kZVBvc2l0aW9uLmxlZnQgKyBkb21Ob2RlUG9zaXRpb24ud2lkdGggKyB3aWR0aCwgd2luZG93U2l6ZS53aWR0aCAtIFJJR0hUX1BBRERJTkcpO1xuXG5cdFx0Y29uc3QgZWxEb2N1bWVudCA9IHRoaXMuX3ZpZXdEb21Ob2RlLmRvbU5vZGUub3duZXJEb2N1bWVudDtcblx0XHRjb25zdCBlbFdpbmRvdyA9IGVsRG9jdW1lbnQuZGVmYXVsdFZpZXc7XG5cdFx0bGV0IGFic29sdXRlTGVmdCA9IGRvbU5vZGVQb3NpdGlvbi5sZWZ0ICsgbGVmdCAtIChlbFdpbmRvdz8uc2Nyb2xsWCA/PyAwKTtcblxuXHRcdGlmIChhYnNvbHV0ZUxlZnQgKyB3aWR0aCA+IE1BWF9MSU1JVCkge1xuXHRcdFx0Y29uc3QgZGVsdGEgPSBhYnNvbHV0ZUxlZnQgLSAoTUFYX0xJTUlUIC0gd2lkdGgpO1xuXHRcdFx0YWJzb2x1dGVMZWZ0IC09IGRlbHRhO1xuXHRcdFx0bGVmdCAtPSBkZWx0YTtcblx0XHR9XG5cblx0XHRpZiAoYWJzb2x1dGVMZWZ0IDwgTUlOX0xJTUlUKSB7XG5cdFx0XHRjb25zdCBkZWx0YSA9IGFic29sdXRlTGVmdCAtIE1JTl9MSU1JVDtcblx0XHRcdGFic29sdXRlTGVmdCAtPSBkZWx0YTtcblx0XHRcdGxlZnQgLT0gZGVsdGE7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtsZWZ0LCBhYnNvbHV0ZUxlZnRdO1xuXHR9XG5cblx0cHJpdmF0ZSBfbGF5b3V0Qm94SW5QYWdlKGFuY2hvcjogQW5jaG9yQ29vcmRpbmF0ZSwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIGN0eDogUmVuZGVyaW5nQ29udGV4dCk6IElCb3hMYXlvdXRSZXN1bHQgfCBudWxsIHtcblx0XHRjb25zdCBhYm92ZVRvcCA9IGFuY2hvci50b3AgLSBoZWlnaHQ7XG5cdFx0Y29uc3QgYmVsb3dUb3AgPSBhbmNob3IudG9wICsgYW5jaG9yLmhlaWdodDtcblxuXHRcdGNvbnN0IGRvbU5vZGVQb3NpdGlvbiA9IGRvbS5nZXREb21Ob2RlUGFnZVBvc2l0aW9uKHRoaXMuX3ZpZXdEb21Ob2RlLmRvbU5vZGUpO1xuXHRcdGNvbnN0IGVsRG9jdW1lbnQgPSB0aGlzLl92aWV3RG9tTm9kZS5kb21Ob2RlLm93bmVyRG9jdW1lbnQ7XG5cdFx0Y29uc3QgZWxXaW5kb3cgPSBlbERvY3VtZW50LmRlZmF1bHRWaWV3O1xuXHRcdGNvbnN0IGFic29sdXRlQWJvdmVUb3AgPSBkb21Ob2RlUG9zaXRpb24udG9wICsgYWJvdmVUb3AgLSAoZWxXaW5kb3c/LnNjcm9sbFkgPz8gMCk7XG5cdFx0Y29uc3QgYWJzb2x1dGVCZWxvd1RvcCA9IGRvbU5vZGVQb3NpdGlvbi50b3AgKyBiZWxvd1RvcCAtIChlbFdpbmRvdz8uc2Nyb2xsWSA/PyAwKTtcblxuXHRcdGNvbnN0IHdpbmRvd1NpemUgPSBkb20uZ2V0Q2xpZW50QXJlYShlbERvY3VtZW50LmJvZHkpO1xuXHRcdGNvbnN0IFtsZWZ0LCBhYnNvbHV0ZUFib3ZlTGVmdF0gPSB0aGlzLl9sYXlvdXRIb3Jpem9udGFsU2VnbWVudEluUGFnZSh3aW5kb3dTaXplLCBkb21Ob2RlUG9zaXRpb24sIGFuY2hvci5sZWZ0IC0gY3R4LnNjcm9sbExlZnQgKyB0aGlzLl9jb250ZW50TGVmdCwgd2lkdGgpO1xuXG5cdFx0Ly8gTGVhdmUgc29tZSBjbGVhcmFuY2UgdG8gdGhlIHRvcC9ib3R0b21cblx0XHRjb25zdCBUT1BfUEFERElORyA9IDIyO1xuXHRcdGNvbnN0IEJPVFRPTV9QQURESU5HID0gMjI7XG5cblx0XHRjb25zdCBmaXRzQWJvdmUgPSAoYWJzb2x1dGVBYm92ZVRvcCA+PSBUT1BfUEFERElORyk7XG5cdFx0Y29uc3QgZml0c0JlbG93ID0gKGFic29sdXRlQmVsb3dUb3AgKyBoZWlnaHQgPD0gd2luZG93U2l6ZS5oZWlnaHQgLSBCT1RUT01fUEFERElORyk7XG5cblx0XHRpZiAodGhpcy5fZml4ZWRPdmVyZmxvd1dpZGdldHMpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGZpdHNBYm92ZSxcblx0XHRcdFx0YWJvdmVUb3A6IE1hdGgubWF4KGFic29sdXRlQWJvdmVUb3AsIFRPUF9QQURESU5HKSxcblx0XHRcdFx0Zml0c0JlbG93LFxuXHRcdFx0XHRiZWxvd1RvcDogYWJzb2x1dGVCZWxvd1RvcCxcblx0XHRcdFx0bGVmdDogYWJzb2x1dGVBYm92ZUxlZnRcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgZml0c0Fib3ZlLCBhYm92ZVRvcCwgZml0c0JlbG93LCBiZWxvd1RvcCwgbGVmdCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfcHJlcGFyZVJlbmRlcldpZGdldEF0RXhhY3RQb3NpdGlvbk92ZXJmbG93aW5nKHRvcExlZnQ6IENvb3JkaW5hdGUpOiBDb29yZGluYXRlIHtcblx0XHRyZXR1cm4gbmV3IENvb3JkaW5hdGUodG9wTGVmdC50b3AsIHRvcExlZnQubGVmdCArIHRoaXMuX2NvbnRlbnRMZWZ0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb21wdXRlIHRoZSBjb29yZGluYXRlcyBhYm92ZSBhbmQgYmVsb3cgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBhbmNob3JzLlxuXHQgKiBUaGUgY29udGVudCB3aWRnZXQgKm11c3QqIHRvdWNoIHRoZSBwcmltYXJ5IGFuY2hvci5cblx0ICogVGhlIGNvbnRlbnQgd2lkZ2V0IHNob3VsZCB0b3VjaCBpZiBwb3NzaWJsZSB0aGUgc2Vjb25kYXJ5IGFuY2hvci5cblx0ICovXG5cdHByaXZhdGUgX2dldEFuY2hvcnNDb29yZGluYXRlcyhjdHg6IFJlbmRlcmluZ0NvbnRleHQpOiB7IHByaW1hcnk6IEFuY2hvckNvb3JkaW5hdGUgfCBudWxsOyBzZWNvbmRhcnk6IEFuY2hvckNvb3JkaW5hdGUgfCBudWxsIH0ge1xuXHRcdGNvbnN0IHByaW1hcnkgPSBnZXRDb29yZGluYXRlcyh0aGlzLl9wcmltYXJ5QW5jaG9yLnZpZXdQb3NpdGlvbiwgdGhpcy5fYWZmaW5pdHksIHRoaXMuX2xpbmVIZWlnaHQpO1xuXHRcdGNvbnN0IHNlY29uZGFyeVZpZXdQb3NpdGlvbiA9ICh0aGlzLl9zZWNvbmRhcnlBbmNob3Iudmlld1Bvc2l0aW9uPy5saW5lTnVtYmVyID09PSB0aGlzLl9wcmltYXJ5QW5jaG9yLnZpZXdQb3NpdGlvbj8ubGluZU51bWJlciA/IHRoaXMuX3NlY29uZGFyeUFuY2hvci52aWV3UG9zaXRpb24gOiBudWxsKTtcblx0XHRjb25zdCBzZWNvbmRhcnkgPSBnZXRDb29yZGluYXRlcyhzZWNvbmRhcnlWaWV3UG9zaXRpb24sIHRoaXMuX2FmZmluaXR5LCB0aGlzLl9saW5lSGVpZ2h0KTtcblx0XHRyZXR1cm4geyBwcmltYXJ5LCBzZWNvbmRhcnkgfTtcblxuXHRcdGZ1bmN0aW9uIGdldENvb3JkaW5hdGVzKHBvc2l0aW9uOiBQb3NpdGlvbiB8IG51bGwsIGFmZmluaXR5OiBQb3NpdGlvbkFmZmluaXR5IHwgbnVsbCwgbGluZUhlaWdodDogbnVtYmVyKTogQW5jaG9yQ29vcmRpbmF0ZSB8IG51bGwge1xuXHRcdFx0aWYgKCFwb3NpdGlvbikge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaG9yaXpvbnRhbFBvc2l0aW9uID0gY3R4LnZpc2libGVSYW5nZUZvclBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRcdGlmICghaG9yaXpvbnRhbFBvc2l0aW9uKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBMZWZ0LWFsaWduIHdpZGdldHMgdGhhdCBzaG91bGQgYXBwZWFyIDpiZWZvcmUgY29udGVudFxuXHRcdFx0Y29uc3QgbGVmdCA9IChwb3NpdGlvbi5jb2x1bW4gPT09IDEgJiYgYWZmaW5pdHkgPT09IFBvc2l0aW9uQWZmaW5pdHkuTGVmdE9mSW5qZWN0ZWRUZXh0ID8gMCA6IGhvcml6b250YWxQb3NpdGlvbi5sZWZ0KTtcblx0XHRcdGNvbnN0IHRvcCA9IGN0eC5nZXRWZXJ0aWNhbE9mZnNldEZvckxpbmVOdW1iZXIocG9zaXRpb24ubGluZU51bWJlcikgLSBjdHguc2Nyb2xsVG9wO1xuXHRcdFx0cmV0dXJuIG5ldyBBbmNob3JDb29yZGluYXRlKHRvcCwgbGVmdCwgbGluZUhlaWdodCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVkdWNlQW5jaG9yQ29vcmRpbmF0ZXMocHJpbWFyeTogQW5jaG9yQ29vcmRpbmF0ZSwgc2Vjb25kYXJ5OiBBbmNob3JDb29yZGluYXRlIHwgbnVsbCwgd2lkdGg6IG51bWJlcik6IEFuY2hvckNvb3JkaW5hdGUge1xuXHRcdGlmICghc2Vjb25kYXJ5KSB7XG5cdFx0XHRyZXR1cm4gcHJpbWFyeTtcblx0XHR9XG5cblx0XHRjb25zdCBmb250SW5mbyA9IHRoaXMuX2NvbnRleHQuY29uZmlndXJhdGlvbi5vcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9udEluZm8pO1xuXG5cdFx0bGV0IGxlZnQgPSBzZWNvbmRhcnkubGVmdDtcblx0XHRpZiAobGVmdCA8IHByaW1hcnkubGVmdCkge1xuXHRcdFx0bGVmdCA9IE1hdGgubWF4KGxlZnQsIHByaW1hcnkubGVmdCAtIHdpZHRoICsgZm9udEluZm8udHlwaWNhbEZ1bGx3aWR0aENoYXJhY3RlcldpZHRoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGVmdCA9IE1hdGgubWluKGxlZnQsIHByaW1hcnkubGVmdCArIHdpZHRoIC0gZm9udEluZm8udHlwaWNhbEZ1bGx3aWR0aENoYXJhY3RlcldpZHRoKTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBBbmNob3JDb29yZGluYXRlKHByaW1hcnkudG9wLCBsZWZ0LCBwcmltYXJ5LmhlaWdodCk7XG5cdH1cblxuXHRwcml2YXRlIF9wcmVwYXJlUmVuZGVyV2lkZ2V0KGN0eDogUmVuZGVyaW5nQ29udGV4dCk6IElSZW5kZXJEYXRhIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLl9wcmVmZXJlbmNlIHx8IHRoaXMuX3ByZWZlcmVuY2UubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCB7IHByaW1hcnksIHNlY29uZGFyeSB9ID0gdGhpcy5fZ2V0QW5jaG9yc0Nvb3JkaW5hdGVzKGN0eCk7XG5cdFx0aWYgKCFwcmltYXJ5KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRraW5kOiAnb2ZmVmlld3BvcnQnLFxuXHRcdFx0XHRwcmVzZXJ2ZUZvY3VzOiB0aGlzLmRvbU5vZGUuZG9tTm9kZS5jb250YWlucyh0aGlzLmRvbU5vZGUuZG9tTm9kZS5vd25lckRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpXG5cdFx0XHR9O1xuXHRcdFx0Ly8gcmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2NhY2hlZERvbU5vZGVPZmZzZXRXaWR0aCA9PT0gLTEgfHwgdGhpcy5fY2FjaGVkRG9tTm9kZU9mZnNldEhlaWdodCA9PT0gLTEpIHtcblxuXHRcdFx0bGV0IHByZWZlcnJlZERpbWVuc2lvbnM6IElEaW1lbnNpb24gfCBudWxsID0gbnVsbDtcblx0XHRcdGlmICh0eXBlb2YgdGhpcy5fYWN0dWFsLmJlZm9yZVJlbmRlciA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRwcmVmZXJyZWREaW1lbnNpb25zID0gc2FmZUludm9rZSh0aGlzLl9hY3R1YWwuYmVmb3JlUmVuZGVyLCB0aGlzLl9hY3R1YWwpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHByZWZlcnJlZERpbWVuc2lvbnMpIHtcblx0XHRcdFx0dGhpcy5fY2FjaGVkRG9tTm9kZU9mZnNldFdpZHRoID0gcHJlZmVycmVkRGltZW5zaW9ucy53aWR0aDtcblx0XHRcdFx0dGhpcy5fY2FjaGVkRG9tTm9kZU9mZnNldEhlaWdodCA9IHByZWZlcnJlZERpbWVuc2lvbnMuaGVpZ2h0O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgZG9tTm9kZSA9IHRoaXMuZG9tTm9kZS5kb21Ob2RlO1xuXHRcdFx0XHRjb25zdCBjbGllbnRSZWN0ID0gZG9tTm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0dGhpcy5fY2FjaGVkRG9tTm9kZU9mZnNldFdpZHRoID0gTWF0aC5yb3VuZChjbGllbnRSZWN0LndpZHRoKTtcblx0XHRcdFx0dGhpcy5fY2FjaGVkRG9tTm9kZU9mZnNldEhlaWdodCA9IE1hdGgucm91bmQoY2xpZW50UmVjdC5oZWlnaHQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGFuY2hvciA9IHRoaXMuX3JlZHVjZUFuY2hvckNvb3JkaW5hdGVzKHByaW1hcnksIHNlY29uZGFyeSwgdGhpcy5fY2FjaGVkRG9tTm9kZU9mZnNldFdpZHRoKTtcblxuXHRcdGxldCBwbGFjZW1lbnQ6IElCb3hMYXlvdXRSZXN1bHQgfCBudWxsO1xuXHRcdGlmICh0aGlzLmFsbG93RWRpdG9yT3ZlcmZsb3cpIHtcblx0XHRcdHBsYWNlbWVudCA9IHRoaXMuX2xheW91dEJveEluUGFnZShhbmNob3IsIHRoaXMuX2NhY2hlZERvbU5vZGVPZmZzZXRXaWR0aCwgdGhpcy5fY2FjaGVkRG9tTm9kZU9mZnNldEhlaWdodCwgY3R4KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cGxhY2VtZW50ID0gdGhpcy5fbGF5b3V0Qm94SW5WaWV3cG9ydChhbmNob3IsIHRoaXMuX2NhY2hlZERvbU5vZGVPZmZzZXRXaWR0aCwgdGhpcy5fY2FjaGVkRG9tTm9kZU9mZnNldEhlaWdodCwgY3R4KTtcblx0XHR9XG5cblx0XHQvLyBEbyB0d28gcGFzc2VzLCBmaXJzdCBmb3IgcGVyZmVjdCBmaXQsIHNlY29uZCBwaWNrcyBmaXJzdCBvcHRpb25cblx0XHRmb3IgKGxldCBwYXNzID0gMTsgcGFzcyA8PSAyOyBwYXNzKyspIHtcblx0XHRcdGZvciAoY29uc3QgcHJlZiBvZiB0aGlzLl9wcmVmZXJlbmNlKSB7XG5cdFx0XHRcdC8vIHBsYWNlbWVudFxuXHRcdFx0XHRpZiAocHJlZiA9PT0gQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5BQk9WRSkge1xuXHRcdFx0XHRcdGlmICghcGxhY2VtZW50KSB7XG5cdFx0XHRcdFx0XHQvLyBXaWRnZXQgb3V0c2lkZSBvZiB2aWV3cG9ydFxuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChwYXNzID09PSAyIHx8IHBsYWNlbWVudC5maXRzQWJvdmUpIHtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdGtpbmQ6ICdpblZpZXdwb3J0Jyxcblx0XHRcdFx0XHRcdFx0Y29vcmRpbmF0ZTogbmV3IENvb3JkaW5hdGUocGxhY2VtZW50LmFib3ZlVG9wLCBwbGFjZW1lbnQubGVmdCksXG5cdFx0XHRcdFx0XHRcdHBvc2l0aW9uOiBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkFCT1ZFXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChwcmVmID09PSBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkJFTE9XKSB7XG5cdFx0XHRcdFx0aWYgKCFwbGFjZW1lbnQpIHtcblx0XHRcdFx0XHRcdC8vIFdpZGdldCBvdXRzaWRlIG9mIHZpZXdwb3J0XG5cdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHBhc3MgPT09IDIgfHwgcGxhY2VtZW50LmZpdHNCZWxvdykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0a2luZDogJ2luVmlld3BvcnQnLFxuXHRcdFx0XHRcdFx0XHRjb29yZGluYXRlOiBuZXcgQ29vcmRpbmF0ZShwbGFjZW1lbnQuYmVsb3dUb3AsIHBsYWNlbWVudC5sZWZ0KSxcblx0XHRcdFx0XHRcdFx0cG9zaXRpb246IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQkVMT1dcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmICh0aGlzLmFsbG93RWRpdG9yT3ZlcmZsb3cpIHtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdGtpbmQ6ICdpblZpZXdwb3J0Jyxcblx0XHRcdFx0XHRcdFx0Y29vcmRpbmF0ZTogdGhpcy5fcHJlcGFyZVJlbmRlcldpZGdldEF0RXhhY3RQb3NpdGlvbk92ZXJmbG93aW5nKG5ldyBDb29yZGluYXRlKGFuY2hvci50b3AsIGFuY2hvci5sZWZ0KSksXG5cdFx0XHRcdFx0XHRcdHBvc2l0aW9uOiBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkVYQUNUXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRraW5kOiAnaW5WaWV3cG9ydCcsXG5cdFx0XHRcdFx0XHRcdGNvb3JkaW5hdGU6IG5ldyBDb29yZGluYXRlKGFuY2hvci50b3AsIGFuY2hvci5sZWZ0KSxcblx0XHRcdFx0XHRcdFx0cG9zaXRpb246IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuRVhBQ1Rcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHQvKipcblx0ICogT24gdGhpcyBmaXJzdCBwYXNzLCB3ZSBlbnN1cmUgdGhhdCB0aGUgY29udGVudCB3aWRnZXQgKGlmIGl0IGlzIGluIHRoZSB2aWV3cG9ydCkgaGFzIHRoZSBtYXggd2lkdGggc2V0IGNvcnJlY3RseS5cblx0ICovXG5cdHB1YmxpYyBvbkJlZm9yZVJlbmRlcih2aWV3cG9ydERhdGE6IFZpZXdwb3J0RGF0YSk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fcHJpbWFyeUFuY2hvci52aWV3UG9zaXRpb24gfHwgIXRoaXMuX3ByZWZlcmVuY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fcHJpbWFyeUFuY2hvci52aWV3UG9zaXRpb24ubGluZU51bWJlciA8IHZpZXdwb3J0RGF0YS5zdGFydExpbmVOdW1iZXIgfHwgdGhpcy5fcHJpbWFyeUFuY2hvci52aWV3UG9zaXRpb24ubGluZU51bWJlciA+IHZpZXdwb3J0RGF0YS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHQvLyBPdXRzaWRlIG9mIHZpZXdwb3J0XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5kb21Ob2RlLnNldE1heFdpZHRoKHRoaXMuX21heFdpZHRoKTtcblx0fVxuXG5cdHB1YmxpYyBwcmVwYXJlUmVuZGVyKGN0eDogUmVuZGVyaW5nQ29udGV4dCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlbmRlckRhdGEgPSB0aGlzLl9wcmVwYXJlUmVuZGVyV2lkZ2V0KGN0eCk7XG5cdH1cblxuXHRwdWJsaWMgcmVuZGVyKGN0eDogUmVzdHJpY3RlZFJlbmRlcmluZ0NvbnRleHQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3JlbmRlckRhdGEgfHwgdGhpcy5fcmVuZGVyRGF0YS5raW5kID09PSAnb2ZmVmlld3BvcnQnKSB7XG5cdFx0XHQvLyBUaGlzIHdpZGdldCBzaG91bGQgYmUgaW52aXNpYmxlXG5cdFx0XHRpZiAodGhpcy5faXNWaXNpYmxlKSB7XG5cdFx0XHRcdHRoaXMuZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoJ21vbmFjby12aXNpYmxlLWNvbnRlbnQtd2lkZ2V0Jyk7XG5cdFx0XHRcdHRoaXMuX2lzVmlzaWJsZSA9IGZhbHNlO1xuXG5cdFx0XHRcdGlmICh0aGlzLl9yZW5kZXJEYXRhPy5raW5kID09PSAnb2ZmVmlld3BvcnQnICYmIHRoaXMuX3JlbmRlckRhdGEucHJlc2VydmVGb2N1cykge1xuXHRcdFx0XHRcdC8vIHdpZGdldCB3YW50cyB0byBiZSBzaG93biwgYnV0IGl0IGlzIG91dHNpZGUgb2YgdGhlIHZpZXdwb3J0IGFuZCBpdFxuXHRcdFx0XHRcdC8vIGhhcyBmb2N1cyB3aGljaCB3ZSBuZWVkIHRvIHByZXNlcnZlXG5cdFx0XHRcdFx0dGhpcy5kb21Ob2RlLnNldFRvcCgtMTAwMCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5kb21Ob2RlLnNldFZpc2liaWxpdHkoJ2hpZGRlbicpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0eXBlb2YgdGhpcy5fYWN0dWFsLmFmdGVyUmVuZGVyID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdHNhZmVJbnZva2UodGhpcy5fYWN0dWFsLmFmdGVyUmVuZGVyLCB0aGlzLl9hY3R1YWwsIG51bGwsIG51bGwpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFRoaXMgd2lkZ2V0IHNob3VsZCBiZSB2aXNpYmxlXG5cdFx0aWYgKHRoaXMuYWxsb3dFZGl0b3JPdmVyZmxvdykge1xuXHRcdFx0dGhpcy5kb21Ob2RlLnNldFRvcCh0aGlzLl9yZW5kZXJEYXRhLmNvb3JkaW5hdGUudG9wKTtcblx0XHRcdHRoaXMuZG9tTm9kZS5zZXRMZWZ0KHRoaXMuX3JlbmRlckRhdGEuY29vcmRpbmF0ZS5sZWZ0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5kb21Ob2RlLnNldFRvcCh0aGlzLl9yZW5kZXJEYXRhLmNvb3JkaW5hdGUudG9wICsgY3R4LnNjcm9sbFRvcCAtIGN0eC5iaWdOdW1iZXJzRGVsdGEpO1xuXHRcdFx0dGhpcy5kb21Ob2RlLnNldExlZnQodGhpcy5fcmVuZGVyRGF0YS5jb29yZGluYXRlLmxlZnQpO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5faXNWaXNpYmxlKSB7XG5cdFx0XHR0aGlzLmRvbU5vZGUuc2V0VmlzaWJpbGl0eSgnaW5oZXJpdCcpO1xuXHRcdFx0dGhpcy5kb21Ob2RlLnNldEF0dHJpYnV0ZSgnbW9uYWNvLXZpc2libGUtY29udGVudC13aWRnZXQnLCAndHJ1ZScpO1xuXHRcdFx0dGhpcy5faXNWaXNpYmxlID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHRoaXMuX2FjdHVhbC5hZnRlclJlbmRlciA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0c2FmZUludm9rZSh0aGlzLl9hY3R1YWwuYWZ0ZXJSZW5kZXIsIHRoaXMuX2FjdHVhbCwgdGhpcy5fcmVuZGVyRGF0YS5wb3NpdGlvbiwgdGhpcy5fcmVuZGVyRGF0YS5jb29yZGluYXRlKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgUG9zaXRpb25QYWlyIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG1vZGVsUG9zaXRpb246IElQb3NpdGlvbiB8IG51bGwsXG5cdFx0cHVibGljIHJlYWRvbmx5IHZpZXdQb3NpdGlvbjogUG9zaXRpb24gfCBudWxsXG5cdCkgeyB9XG59XG5cbmNsYXNzIENvb3JkaW5hdGUgaW1wbGVtZW50cyBJQ29udGVudFdpZGdldFJlbmRlcmVkQ29vcmRpbmF0ZSB7XG5cdF9jb29yZGluYXRlQnJhbmQ6IHZvaWQgPSB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHRvcDogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBsZWZ0OiBudW1iZXJcblx0KSB7IH1cbn1cblxuY2xhc3MgQW5jaG9yQ29vcmRpbmF0ZSB7XG5cdF9hbmNob3JDb29yZGluYXRlQnJhbmQ6IHZvaWQgPSB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHRvcDogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBsZWZ0OiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IGhlaWdodDogbnVtYmVyXG5cdCkgeyB9XG59XG5cbmZ1bmN0aW9uIHNhZmVJbnZva2U8VCBleHRlbmRzICguLi5hcmdzOiBhbnlbXSkgPT4gYW55PihmbjogVCwgdGhpc0FyZzogVGhpc1BhcmFtZXRlclR5cGU8VD4sIC4uLmFyZ3M6IFBhcmFtZXRlcnM8VD4pOiBSZXR1cm5UeXBlPFQ+IHwgbnVsbCB7XG5cdHRyeSB7XG5cdFx0cmV0dXJuIGZuLmNhbGwodGhpc0FyZywgLi4uYXJncyk7XG5cdH0gY2F0Y2gge1xuXHRcdC8vIGlnbm9yZVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBc0IseUJBQXlCO0FBQy9DLFNBQVMsdUNBQXlGO0FBQ2xHLFNBQVMsaUJBQWlCLGtCQUFrQixnQkFBZ0I7QUFLNUQsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyx3QkFBd0I7QUFTMUIsTUFBTSwyQkFBMkIsU0FBUztBQUFBLEVBUWhELFlBQVksU0FBc0IsYUFBdUM7QUFDeEUsVUFBTSxPQUFPO0FBQ2IsU0FBSyxlQUFlO0FBQ3BCLFNBQUssV0FBVyxDQUFDO0FBRWpCLFNBQUssVUFBVSxrQkFBa0IsU0FBUyxjQUFjLEtBQUssQ0FBQztBQUM5RCxxQkFBaUIsTUFBTSxLQUFLLFNBQVMsZ0JBQWdCLGNBQWM7QUFDbkUsU0FBSyxRQUFRLGFBQWEsZ0JBQWdCO0FBQzFDLFNBQUssUUFBUSxZQUFZLFVBQVU7QUFDbkMsU0FBSyxRQUFRLE9BQU8sQ0FBQztBQUVyQixTQUFLLG1DQUFtQyxrQkFBa0IsU0FBUyxjQUFjLEtBQUssQ0FBQztBQUN2RixxQkFBaUIsTUFBTSxLQUFLLGtDQUFrQyxnQkFBZ0IseUJBQXlCO0FBQ3ZHLFNBQUssaUNBQWlDLGFBQWEsMkJBQTJCO0FBQUEsRUFDL0U7QUFBQSxFQUVnQixVQUFnQjtBQUMvQixVQUFNLFFBQVE7QUFDZCxTQUFLLFdBQVcsQ0FBQztBQUFBLEVBQ2xCO0FBQUE7QUFBQSxFQUlnQix1QkFBdUIsR0FBc0Q7QUFDNUYsVUFBTSxPQUFPLE9BQU8sS0FBSyxLQUFLLFFBQVE7QUFDdEMsZUFBVyxZQUFZLE1BQU07QUFDNUIsV0FBSyxTQUFTLFFBQVEsRUFBRSx1QkFBdUIsQ0FBQztBQUFBLElBQ2pEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNnQixxQkFBcUIs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
