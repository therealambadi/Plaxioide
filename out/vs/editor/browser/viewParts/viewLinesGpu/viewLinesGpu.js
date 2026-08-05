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
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { getActiveWindow } from "../../../../base/browser/dom.js";
import { BugIndicatingError } from "../../../../base/common/errors.js";
import { autorun, runOnChange } from "../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { TextureAtlasPage } from "../../gpu/atlas/textureAtlasPage.js";
import { BindingId } from "../../gpu/gpu.js";
import { GPULifecycle } from "../../gpu/gpuDisposable.js";
import { quadVertices } from "../../gpu/gpuUtils.js";
import { ViewGpuContext } from "../../gpu/viewGpuContext.js";
import { FloatHorizontalRange, HorizontalPosition, HorizontalRange, LineVisibleRanges, VisibleRanges } from "../../view/renderingContext.js";
import { ViewPart } from "../../view/viewPart.js";
import { ViewLineOptions } from "../viewLines/viewLineOptions.js";
import { CursorColumns } from "../../../common/core/cursorColumns.js";
import { TextureAtlas } from "../../gpu/atlas/textureAtlas.js";
import { createContentSegmenter } from "../../gpu/contentSegmenter.js";
import { ViewportRenderStrategy } from "../../gpu/renderStrategy/viewportRenderStrategy.js";
import { FullFileRenderStrategy } from "../../gpu/renderStrategy/fullFileRenderStrategy.js";
import { MutableDisposable } from "../../../../base/common/lifecycle.js";
import { GlyphRasterizer } from "../../gpu/raster/glyphRasterizer.js";
var GlyphStorageBufferInfo = /* @__PURE__ */ ((GlyphStorageBufferInfo2) => {
  GlyphStorageBufferInfo2[GlyphStorageBufferInfo2["FloatsPerEntry"] = 6] = "FloatsPerEntry";
  GlyphStorageBufferInfo2[GlyphStorageBufferInfo2["BytesPerEntry"] = 24] = "BytesPerEntry";
  GlyphStorageBufferInfo2[GlyphStorageBufferInfo2["Offset_TexturePosition"] = 0] = "Offset_TexturePosition";
  GlyphStorageBufferInfo2[GlyphStorageBufferInfo2["Offset_TextureSize"] = 2] = "Offset_TextureSize";
  GlyphStorageBufferInfo2[GlyphStorageBufferInfo2["Offset_OriginPosition"] = 4] = "Offset_OriginPosition";
  return GlyphStorageBufferInfo2;
})(GlyphStorageBufferInfo || {});
let ViewLinesGpu = class extends ViewPart {
  constructor(context, _viewGpuContext, _instantiationService, _logService) {
    super(context);
    this._viewGpuContext = _viewGpuContext;
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._atlasGpuTextureVersions = [];
    this._initialized = false;
    this._glyphRasterizer = this._register(new MutableDisposable());
    this._renderStrategy = this._register(new MutableDisposable());
    this.canvas = this._viewGpuContext.canvas.domNode;
    this._register(autorun((reader) => {
      this._viewGpuContext.canvasDevicePixelDimensions.read(reader);
      const lastViewportData = this._lastViewportData;
      if (lastViewportData) {
        setTimeout(() => {
          if (lastViewportData === this._lastViewportData) {
            this.renderText(lastViewportData);
          }
        });
      }
    }));
    this.initWebgpu();
  }
  async initWebgpu() {
    this._device = ViewGpuContext.deviceSync || await ViewGpuContext.device;
    if (this._store.isDisposed) {
      return;
    }
    const atlas = ViewGpuContext.atlas;
    this._register(atlas.onDidDeleteGlyphs(() => {
      this._atlasGpuTextureVersions.length = 0;
      this._atlasGpuTextureVersions[0] = 0;
      this._atlasGpuTextureVersions[1] = 0;
      this._renderStrategy.value.reset();
    }));
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this._viewGpuContext.ctx.configure({
      device: this._device,
      format: presentationFormat,
      alphaMode: "premultiplied"
    });
    this._renderPassColorAttachment = {
      view: null,
      // Will be filled at render time
      loadOp: "load",
      storeOp: "store"
    };
    this._renderPassDescriptor = {
      label: "Monaco render pass",
      colorAttachments: [this._renderPassColorAttachment]
    };
    let layoutInfoUniformBuffer;
    {
      let Info;
      ((Info2) => {
        Info2[Info2["FloatsPerEntry"] = 6] = "FloatsPerEntry";
        Info2[Info2["BytesPerEntry"] = 24] = "BytesPerEntry";
        Info2[Info2["Offset_CanvasWidth____"] = 0] = "Offset_CanvasWidth____";
        Info2[Info2["Offset_CanvasHeight___"] = 1] = "Offset_CanvasHeight___";
        Info2[Info2["Offset_ViewportOffsetX"] = 2] = "Offset_ViewportOffsetX";
        Info2[Info2["Offset_ViewportOffsetY"] = 3] = "Offset_ViewportOffsetY";
        Info2[Info2["Offset_ViewportWidth__"] = 4] = "Offset_ViewportWidth__";
        Info2[Info2["Offset_ViewportHeight_"] = 5] = "Offset_ViewportHeight_";
      })(Info || (Info = {}));
      const bufferValues = new Float32Array(6 /* FloatsPerEntry */);
      const updateBufferValues = (canvasDevicePixelWidth = this.canvas.width, canvasDevicePixelHeight = this.canvas.height) => {
        bufferValues[0 /* Offset_CanvasWidth____ */] = canvasDevicePixelWidth;
        bufferValues[1 /* Offset_CanvasHeight___ */] = canvasDevicePixelHeight;
        bufferValues[2 /* Offset_ViewportOffsetX */] = Math.ceil(this._context.configuration.options.get(EditorOption.layoutInfo).contentLeft * getActiveWindow().devicePixelRatio);
        bufferValues[3 /* Offset_ViewportOffsetY */] = 0;
        bufferValues[4 /* Offset_ViewportWidth__ */] = bufferValues[0 /* Offset_CanvasWidth____ */] - bufferValues[2 /* Offset_ViewportOffsetX */];
        bufferValues[5 /* Offset_ViewportHeight_ */] = bufferValues[1 /* Offset_CanvasHeight___ */] - bufferValues[3 /* Offset_ViewportOffsetY */];
        return bufferValues;
      };
      layoutInfoUniformBuffer = this._register(GPULifecycle.createBuffer(this._device, {
        label: "Monaco uniform buffer",
        size: 24 /* BytesPerEntry */,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      }, () => updateBufferValues())).object;
      this._register(runOnChange(this._viewGpuContext.canvasDevicePixelDimensions, ({ width, height }) => {
        this._device.queue.writeBuffer(layoutInfoUniformBuffer, 0, updateBufferValues(width, height));
      }));
      this._register(runOnChange(this._viewGpuContext.contentLeft, () => {
        this._device.queue.writeBuffer(layoutInfoUniformBuffer, 0, updateBufferValues());
      }));
    }
    let atlasInfoUniformBuffer;
    {
      let Info;
      ((Info2) => {
        Info2[Info2["FloatsPerEntry"] = 2] = "FloatsPerEntry";
        Info2[Info2["BytesPerEntry"] = 8] = "BytesPerEntry";
        Info2[Info2["Offset_Width_"] = 0] = "Offset_Width_";
        Info2[Info2["Offset_Height"] = 1] = "Offset_Height";
      })(Info || (Info = {}));
      atlasInfoUniformBuffer = this._register(GPULifecycle.createBuffer(this._device, {
        label: "Monaco atlas info uniform buffer",
        size: 8 /* BytesPerEntry */,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      }, () => {
        const values = new Float32Array(2 /* FloatsPerEntry */);
        values[0 /* Offset_Width_ */] = atlas.pageSize;
        values[1 /* Offset_Height */] = atlas.pageSize;
        return values;
      })).object;
    }
    const fontFamily = this._context.configuration.options.get(EditorOption.fontFamily);
    const fontSize = this._context.configuration.options.get(EditorOption.fontSize);
    this._glyphRasterizer.value = this._register(new GlyphRasterizer(fontSize, fontFamily, this._viewGpuContext.devicePixelRatio.get()));
    this._register(runOnChange(this._viewGpuContext.devicePixelRatio, () => {
      this._refreshGlyphRasterizer();
    }));
    this._renderStrategy.value = this._instantiationService.createInstance(FullFileRenderStrategy, this._context, this._viewGpuContext, this._device, this._glyphRasterizer);
    this._glyphStorageBuffer = this._register(GPULifecycle.createBuffer(this._device, {
      label: "Monaco glyph storage buffer",
      size: TextureAtlas.maximumPageCount * (TextureAtlasPage.maximumGlyphCount * 24 /* BytesPerEntry */),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })).object;
    this._atlasGpuTextureVersions[0] = 0;
    this._atlasGpuTextureVersions[1] = 0;
    this._atlasGpuTexture = this._register(GPULifecycle.createTexture(this._device, {
      label: "Monaco atlas texture",
      format: "rgba8unorm",
      size: { width: atlas.pageSize, height: atlas.pageSize, depthOrArrayLayers: TextureAtlas.maximumPageCount },
      dimension: "2d",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    })).object;
    this._updateAtlasStorageBufferAndTexture();
    this._vertexBuffer = this._register(GPULifecycle.createBuffer(this._device, {
      label: "Monaco vertex buffer",
      size: quadVertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    }, quadVertices)).object;
    const module = this._device.createShaderModule({
      label: "Monaco shader module",
      code: this._renderStrategy.value.wgsl
    });
    this._pipeline = this._device.createRenderPipeline({
      label: "Monaco render pipeline",
      layout: "auto",
      vertex: {
        module,
        buffers: [
          {
            arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
            // 2 floats, 4 bytes each
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" }
              // position
            ]
          }
        ]
      },
      fragment: {
        module,
        targets: [
          {
            format: presentationFormat,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha"
              },
              alpha: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha"
              }
            }
          }
        ]
      }
    });
    this._rebuildBindGroup = () => {
      this._bindGroup = this._device.createBindGroup({
        label: "Monaco bind group",
        layout: this._pipeline.getBindGroupLayout(0),
        entries: [
          // TODO: Pass in generically as array?
          { binding: BindingId.GlyphInfo, resource: { buffer: this._glyphStorageBuffer } },
          {
            binding: BindingId.TextureSampler,
            resource: this._device.createSampler({
              label: "Monaco atlas sampler",
              magFilter: "nearest",
              minFilter: "nearest"
            })
          },
          { binding: BindingId.Texture, resource: this._atlasGpuTexture.createView() },
          { binding: BindingId.LayoutInfoUniform, resource: { buffer: layoutInfoUniformBuffer } },
          { binding: BindingId.AtlasDimensionsUniform, resource: { buffer: atlasInfoUniformBuffer } },
          ...this._renderStrategy.value.bindGroupEntries
        ]
      });
    };
    this._rebuildBindGroup();
    this._initialized = true;
    if (this._initViewportData) {
      for (const viewportData of this._initViewportData) {
        this.renderText(viewportData);
      }
      this._initViewportData = void 0;
    }
  }
  _refreshRenderStrategy(viewportData) {
    if (this._renderStrategy.value?.type === "viewport") {
      return;
    }
    if (viewportData.endLineNumber < FullFileRenderStrategy.maxSupportedLines && this._viewportMaxColumn(viewportData) < FullFileRenderStrategy.maxSupportedColumns) {
      return;
    }
    this._logService.trace(`File is larger than ${FullFileRenderStrategy.maxSupportedLines} lines or ${FullFileRenderStrategy.maxSupportedColumns} columns, switching to viewport render strategy`);
    const viewportRenderStrategy = this._instantiationService.createInstance(ViewportRenderStrategy, this._context, this._viewGpuContext, this._device, this._glyphRasterizer);
    this._renderStrategy.value = viewportRenderStrategy;
    this._register(viewportRenderStrategy.onDidChangeBindGroupEntries(() => this._rebuildBindGroup?.()));
    this._rebuildBindGroup?.();
  }
  _viewportMaxColumn(viewportData) {
    let maxColumn = 0;
    let lineData;
    for (let i = viewportData.startLineNumber; i <= viewportData.endLineNumber; i++) {
      lineData = viewportData.getViewLineRenderingData(i);
      maxColumn = Math.max(maxColumn, lineData.maxColumn);
    }
    return maxColumn;
  }
  _updateAtlasStorageBufferAndTexture() {
    for (const [layerIndex, page] of ViewGpuContext.atlas.pages.entries()) {
      if (layerIndex >= TextureAtlas.maximumPageCount) {
        console.log(`Attempt to upload atlas page [${layerIndex}], only ${TextureAtlas.maximumPageCount} are supported currently`);
        continue;
      }
      if (page.version === this._atlasGpuTextureVersions[layerIndex]) {
        continue;
      }
      this._logService.trace("Updating atlas page[", layerIndex, "] from version ", this._atlasGpuTextureVersions[layerIndex], " to version ", page.version);
      const entryCount = 6 /* FloatsPerEntry */ * TextureAtlasPage.maximumGlyphCount;
      const values = new Float32Array(entryCount);
      let entryOffset = 0;
      for (const glyph of page.glyphs) {
        values[entryOffset + 0 /* Offset_TexturePosition */] = glyph.x;
        values[entryOffset + 0 /* Offset_TexturePosition */ + 1] = glyph.y;
        values[entryOffset + 2 /* Offset_TextureSize */] = glyph.w;
        values[entryOffset + 2 /* Offset_TextureSize */ + 1] = glyph.h;
        values[entryOffset + 4 /* Offset_OriginPosition */] = glyph.originOffsetX;
        values[entryOffset + 4 /* Offset_OriginPosition */ + 1] = glyph.originOffsetY;
        entryOffset += 6 /* FloatsPerEntry */;
      }
      if (entryOffset / 6 /* FloatsPerEntry */ > TextureAtlasPage.maximumGlyphCount) {
        throw new Error(`Attempting to write more glyphs (${entryOffset / 6 /* FloatsPerEntry */}) than the GPUBuffer can hold (${TextureAtlasPage.maximumGlyphCount})`);
      }
      this._device.queue.writeBuffer(
        this._glyphStorageBuffer,
        layerIndex * 6 /* FloatsPerEntry */ * TextureAtlasPage.maximumGlyphCount * Float32Array.BYTES_PER_ELEMENT,
        values,
        0,
        6 /* FloatsPerEntry */ * TextureAtlasPage.maximumGlyphCount
      );
      if (page.usedArea.right - page.usedArea.left > 0 && page.usedArea.bottom - page.usedArea.top > 0) {
        this._device.queue.copyExternalImageToTexture(
          { source: page.source },
          {
            texture: this._atlasGpuTexture,
            origin: {
              x: page.usedArea.left,
              y: page.usedArea.top,
              z: layerIndex
            }
          },
          {
            width: page.usedArea.right - page.usedArea.left + 1,
            height: page.usedArea.bottom - page.usedArea.top + 1
          }
        );
      }
      this._atlasGpuTextureVersions[layerIndex] = page.version;
    }
  }
  prepareRender(ctx) {
    throw new BugIndicatingError("Should not be called");
  }
  render(ctx) {
    throw new BugIndicatingError("Should not be called");
  }
  // #region Event handlers
  // Since ViewLinesGpu currently coordinates rendering to the canvas, it must listen to all
  // changed events that any GPU part listens to. This is because any drawing to the canvas will
  // clear it for that frame, so all parts must be rendered every time.
  //
  // Additionally, since this is intrinsically linked to ViewLines, it must also listen to events
  // from that side. Luckily rendering is cheap, it's only when uploaded data changes does it
  // start to cost.
  onConfigurationChanged(e) {
    this._refreshGlyphRasterizer();
    return true;
  }
  onCursorStateChanged(e) {
    return true;
  }
  onDecorationsChanged(e) {
    return true;
  }
  onFlushed(e) {
    return true;
  }
  onLinesChanged(e) {
    return true;
  }
  onLinesDeleted(e) {
    return true;
  }
  onLinesInserted(e) {
    return true;
  }
  onLineMappingChanged(e) {
    return true;
  }
  onRevealRangeRequest(e) {
    return true;
  }
  onScrollChanged(e) {
    return true;
  }
  onThemeChanged(e) {
    return true;
  }
  onZonesChanged(e) {
    return true;
  }
  // #endregion
  _refreshGlyphRasterizer() {
    const glyphRasterizer = this._glyphRasterizer.value;
    if (!glyphRasterizer) {
      return;
    }
    const fontFamily = this._context.configuration.options.get(EditorOption.fontFamily);
    const fontSize = this._context.configuration.options.get(EditorOption.fontSize);
    const devicePixelRatio = this._viewGpuContext.devicePixelRatio.get();
    if (glyphRasterizer.fontFamily !== fontFamily || glyphRasterizer.fontSize !== fontSize || glyphRasterizer.devicePixelRatio !== devicePixelRatio) {
      this._glyphRasterizer.value = new GlyphRasterizer(fontSize, fontFamily, devicePixelRatio);
    }
  }
  renderText(viewportData) {
    if (this._initialized) {
      this._refreshRenderStrategy(viewportData);
      return this._renderText(viewportData);
    } else {
      this._initViewportData = this._initViewportData ?? [];
      this._initViewportData.push(viewportData);
    }
  }
  _renderText(viewportData) {
    this._viewGpuContext.rectangleRenderer.draw(viewportData);
    const options = new ViewLineOptions(this._context.configuration, this._context.theme.type);
    this._renderStrategy.value.update(viewportData, options);
    this._updateAtlasStorageBufferAndTexture();
    const encoder = this._device.createCommandEncoder({ label: "Monaco command encoder" });
    this._renderPassColorAttachment.view = this._viewGpuContext.ctx.getCurrentTexture().createView({ label: "Monaco canvas texture view" });
    const pass = encoder.beginRenderPass(this._renderPassDescriptor);
    pass.setPipeline(this._pipeline);
    pass.setVertexBuffer(0, this._vertexBuffer);
    const contentLeft = Math.ceil(this._viewGpuContext.contentLeft.get() * this._viewGpuContext.devicePixelRatio.get());
    pass.setScissorRect(contentLeft, 0, this.canvas.width - contentLeft, this.canvas.height);
    pass.setBindGroup(0, this._bindGroup);
    this._renderStrategy.value.draw(pass, viewportData);
    pass.end();
    const commandBuffer = encoder.finish();
    this._device.queue.submit([commandBuffer]);
    this._lastViewportData = viewportData;
    this._lastViewLineOptions = options;
  }
  linesVisibleRangesForRange(_range, includeNewLines) {
    if (!this._lastViewportData) {
      return null;
    }
    const originalEndLineNumber = _range.endLineNumber;
    const range = Range.intersectRanges(_range, this._lastViewportData.visibleRange);
    if (!range) {
      return null;
    }
    const rendStartLineNumber = this._lastViewportData.startLineNumber;
    const rendEndLineNumber = this._lastViewportData.endLineNumber;
    const viewportData = this._lastViewportData;
    const viewLineOptions = this._lastViewLineOptions;
    if (!viewportData || !viewLineOptions) {
      return null;
    }
    const visibleRanges = [];
    let nextLineModelLineNumber = 0;
    if (includeNewLines) {
      nextLineModelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(range.startLineNumber, 1)).lineNumber;
    }
    for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
      if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
        continue;
      }
      const startColumn = lineNumber === range.startLineNumber ? range.startColumn : 1;
      const continuesInNextLine = lineNumber !== range.endLineNumber;
      const endColumn = continuesInNextLine ? this._context.viewModel.getLineMaxColumn(lineNumber) : range.endColumn;
      const visibleRangesForLine = this._visibleRangesForLineRange(lineNumber, startColumn, endColumn);
      if (!visibleRangesForLine) {
        continue;
      }
      if (includeNewLines && lineNumber < originalEndLineNumber) {
        const currentLineModelLineNumber = nextLineModelLineNumber;
        nextLineModelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(lineNumber + 1, 1)).lineNumber;
        if (currentLineModelLineNumber !== nextLineModelLineNumber) {
          visibleRangesForLine.ranges[visibleRangesForLine.ranges.length - 1].width += viewLineOptions.spaceWidth;
        }
      }
      visibleRanges.push(new LineVisibleRanges(visibleRangesForLine.outsideRenderedLine, lineNumber, HorizontalRange.from(visibleRangesForLine.ranges), continuesInNextLine));
    }
    if (visibleRanges.length === 0) {
      return null;
    }
    return visibleRanges;
  }
  _visibleRangesForLineRange(lineNumber, startColumn, endColumn) {
    if (this.shouldRender()) {
      return null;
    }
    const viewportData = this._lastViewportData;
    const viewLineOptions = this._lastViewLineOptions;
    if (!viewportData || !viewLineOptions || lineNumber < viewportData.startLineNumber || lineNumber > viewportData.endLineNumber) {
      return null;
    }
    const lineData = viewportData.getViewLineRenderingData(lineNumber);
    const content = lineData.content;
    let contentSegmenter;
    if (!(lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations)) {
      contentSegmenter = createContentSegmenter(lineData, viewLineOptions);
    }
    let chars = "";
    let resolvedStartColumn = 0;
    let resolvedStartCssPixelOffset = 0;
    for (let x = 0; x < startColumn - 1; x++) {
      if (lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations) {
        chars = content.charAt(x);
      } else {
        chars = contentSegmenter.getSegmentAtIndex(x);
        if (chars === void 0) {
          continue;
        }
        resolvedStartCssPixelOffset += this._renderStrategy.value.glyphRasterizer.getTextMetrics(chars).width / getActiveWindow().devicePixelRatio - viewLineOptions.spaceWidth;
      }
      if (chars === "	") {
        resolvedStartColumn = CursorColumns.nextRenderTabStop(resolvedStartColumn, lineData.tabSize);
      } else {
        resolvedStartColumn++;
      }
    }
    let resolvedEndColumn = resolvedStartColumn;
    let resolvedEndCssPixelOffset = 0;
    for (let x = startColumn - 1; x < endColumn - 1; x++) {
      if (lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations) {
        chars = content.charAt(x);
      } else {
        chars = contentSegmenter.getSegmentAtIndex(x);
        if (chars === void 0) {
          continue;
        }
        resolvedEndCssPixelOffset += this._renderStrategy.value.glyphRasterizer.getTextMetrics(chars).width / getActiveWindow().devicePixelRatio - viewLineOptions.spaceWidth;
      }
      if (chars === "	") {
        resolvedEndColumn = CursorColumns.nextRenderTabStop(resolvedEndColumn, lineData.tabSize);
      } else {
        resolvedEndColumn++;
      }
    }
    const result = new VisibleRanges(false, [
      new FloatHorizontalRange(
        resolvedStartColumn * viewLineOptions.spaceWidth + resolvedStartCssPixelOffset,
        (resolvedEndColumn - resolvedStartColumn) * viewLineOptions.spaceWidth + resolvedEndCssPixelOffset
      )
    ]);
    return result;
  }
  visibleRangeForPosition(position) {
    const visibleRanges = this._visibleRangesForLineRange(position.lineNumber, position.column, position.column);
    if (!visibleRanges) {
      return null;
    }
    return new HorizontalPosition(visibleRanges.outsideRenderedLine, visibleRanges.ranges[0].left);
  }
  getLineWidth(lineNumber) {
    if (!this._lastViewportData || !this._lastViewLineOptions) {
      return void 0;
    }
    if (!this._viewGpuContext.canRender(this._lastViewLineOptions, this._lastViewportData, lineNumber)) {
      return void 0;
    }
    const lineData = this._lastViewportData.getViewLineRenderingData(lineNumber);
    const lineRange = this._visibleRangesForLineRange(lineNumber, 1, lineData.maxColumn);
    const lastRange = lineRange?.ranges.at(-1);
    if (lastRange) {
      return lastRange.width;
    }
    return void 0;
  }
  getPositionAtCoordinate(lineNumber, mouseContentHorizontalOffset) {
    if (!this._lastViewportData || !this._lastViewLineOptions) {
      return void 0;
    }
    if (!this._viewGpuContext.canRender(this._lastViewLineOptions, this._lastViewportData, lineNumber)) {
      return void 0;
    }
    const lineData = this._lastViewportData.getViewLineRenderingData(lineNumber);
    const content = lineData.content;
    const dpr = getActiveWindow().devicePixelRatio;
    const mouseContentHorizontalOffsetDevicePixels = mouseContentHorizontalOffset * dpr;
    const spaceWidthDevicePixels = this._lastViewLineOptions.spaceWidth * dpr;
    const contentSegmenter = createContentSegmenter(lineData, this._lastViewLineOptions);
    let widthSoFar = 0;
    let charWidth = 0;
    let tabXOffset = 0;
    let column = 0;
    for (let x = 0; x < content.length; x++) {
      const chars = contentSegmenter.getSegmentAtIndex(x);
      if (chars === void 0) {
        column++;
        continue;
      }
      if (chars === "	") {
        const offsetBefore = x + tabXOffset;
        tabXOffset = CursorColumns.nextRenderTabStop(x + tabXOffset, lineData.tabSize);
        charWidth = spaceWidthDevicePixels * (tabXOffset - offsetBefore);
        tabXOffset -= x + 1;
      } else if (lineData.isBasicASCII && this._lastViewLineOptions.useMonospaceOptimizations) {
        charWidth = spaceWidthDevicePixels;
      } else {
        charWidth = this._renderStrategy.value.glyphRasterizer.getTextMetrics(chars).width;
      }
      if (mouseContentHorizontalOffsetDevicePixels < widthSoFar + charWidth / 2) {
        break;
      }
      widthSoFar += charWidth;
      column++;
    }
    return new Position(lineNumber, column + 1);
  }
};
ViewLinesGpu = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILogService)
], ViewLinesGpu);
export {
  ViewLinesGpu
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci92aWV3UGFydHMvdmlld0xpbmVzR3B1L3ZpZXdMaW5lc0dwdS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGdldEFjdGl2ZVdpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQnVnSW5kaWNhdGluZ0Vycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IGF1dG9ydW4sIHJ1bk9uQ2hhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgdHlwZSB7IFZpZXdwb3J0RGF0YSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TGF5b3V0L3ZpZXdMaW5lc1ZpZXdwb3J0RGF0YS5qcyc7XG5pbXBvcnQgdHlwZSB7IFZpZXdDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC92aWV3Q29udGV4dC5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlQXRsYXNQYWdlIH0gZnJvbSAnLi4vLi4vZ3B1L2F0bGFzL3RleHR1cmVBdGxhc1BhZ2UuanMnO1xuaW1wb3J0IHsgQmluZGluZ0lkLCB0eXBlIElHcHVSZW5kZXJTdHJhdGVneSB9IGZyb20gJy4uLy4uL2dwdS9ncHUuanMnO1xuaW1wb3J0IHsgR1BVTGlmZWN5Y2xlIH0gZnJvbSAnLi4vLi4vZ3B1L2dwdURpc3Bvc2FibGUuanMnO1xuaW1wb3J0IHsgcXVhZFZlcnRpY2VzIH0gZnJvbSAnLi4vLi4vZ3B1L2dwdVV0aWxzLmpzJztcbmltcG9ydCB7IFZpZXdHcHVDb250ZXh0IH0gZnJvbSAnLi4vLi4vZ3B1L3ZpZXdHcHVDb250ZXh0LmpzJztcbmltcG9ydCB7IEZsb2F0SG9yaXpvbnRhbFJhbmdlLCBIb3Jpem9udGFsUG9zaXRpb24sIEhvcml6b250YWxSYW5nZSwgSVZpZXdMaW5lcywgTGluZVZpc2libGVSYW5nZXMsIFJlbmRlcmluZ0NvbnRleHQsIFJlc3RyaWN0ZWRSZW5kZXJpbmdDb250ZXh0LCBWaXNpYmxlUmFuZ2VzIH0gZnJvbSAnLi4vLi4vdmlldy9yZW5kZXJpbmdDb250ZXh0LmpzJztcbmltcG9ydCB7IFZpZXdQYXJ0IH0gZnJvbSAnLi4vLi4vdmlldy92aWV3UGFydC5qcyc7XG5pbXBvcnQgeyBWaWV3TGluZU9wdGlvbnMgfSBmcm9tICcuLi92aWV3TGluZXMvdmlld0xpbmVPcHRpb25zLmpzJztcbmltcG9ydCB0eXBlICogYXMgdmlld0V2ZW50cyBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgeyBDdXJzb3JDb2x1bW5zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvY3Vyc29yQ29sdW1ucy5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlQXRsYXMgfSBmcm9tICcuLi8uLi9ncHUvYXRsYXMvdGV4dHVyZUF0bGFzLmpzJztcbmltcG9ydCB7IGNyZWF0ZUNvbnRlbnRTZWdtZW50ZXIsIHR5cGUgSUNvbnRlbnRTZWdtZW50ZXIgfSBmcm9tICcuLi8uLi9ncHUvY29udGVudFNlZ21lbnRlci5qcyc7XG5pbXBvcnQgeyBWaWV3cG9ydFJlbmRlclN0cmF0ZWd5IH0gZnJvbSAnLi4vLi4vZ3B1L3JlbmRlclN0cmF0ZWd5L3ZpZXdwb3J0UmVuZGVyU3RyYXRlZ3kuanMnO1xuaW1wb3J0IHsgRnVsbEZpbGVSZW5kZXJTdHJhdGVneSB9IGZyb20gJy4uLy4uL2dwdS9yZW5kZXJTdHJhdGVneS9mdWxsRmlsZVJlbmRlclN0cmF0ZWd5LmpzJztcbmltcG9ydCB7IE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB0eXBlIHsgVmlld0xpbmVSZW5kZXJpbmdEYXRhIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBHbHlwaFJhc3Rlcml6ZXIgfSBmcm9tICcuLi8uLi9ncHUvcmFzdGVyL2dseXBoUmFzdGVyaXplci5qcyc7XG5cbmNvbnN0IGVudW0gR2x5cGhTdG9yYWdlQnVmZmVySW5mbyB7XG5cdEZsb2F0c1BlckVudHJ5ID0gMiArIDIgKyAyLFxuXHRCeXRlc1BlckVudHJ5ID0gR2x5cGhTdG9yYWdlQnVmZmVySW5mby5GbG9hdHNQZXJFbnRyeSAqIDQsXG5cdE9mZnNldF9UZXh0dXJlUG9zaXRpb24gPSAwLFxuXHRPZmZzZXRfVGV4dHVyZVNpemUgPSAyLFxuXHRPZmZzZXRfT3JpZ2luUG9zaXRpb24gPSA0LFxufVxuXG4vKipcbiAqIFRoZSBHUFUgaW1wbGVtZW50YXRpb24gb2YgdGhlIFZpZXdMaW5lcyBwYXJ0LlxuICovXG5leHBvcnQgY2xhc3MgVmlld0xpbmVzR3B1IGV4dGVuZHMgVmlld1BhcnQgaW1wbGVtZW50cyBJVmlld0xpbmVzIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQ7XG5cblx0cHJpdmF0ZSBfaW5pdFZpZXdwb3J0RGF0YT86IFZpZXdwb3J0RGF0YVtdO1xuXHRwcml2YXRlIF9sYXN0Vmlld3BvcnREYXRhPzogVmlld3BvcnREYXRhO1xuXHRwcml2YXRlIF9sYXN0Vmlld0xpbmVPcHRpb25zPzogVmlld0xpbmVPcHRpb25zO1xuXG5cdHByaXZhdGUgX2RldmljZSE6IEdQVURldmljZTtcblx0cHJpdmF0ZSBfcmVuZGVyUGFzc0Rlc2NyaXB0b3IhOiBHUFVSZW5kZXJQYXNzRGVzY3JpcHRvcjtcblx0cHJpdmF0ZSBfcmVuZGVyUGFzc0NvbG9yQXR0YWNobWVudCE6IEdQVVJlbmRlclBhc3NDb2xvckF0dGFjaG1lbnQ7XG5cdHByaXZhdGUgX2JpbmRHcm91cCE6IEdQVUJpbmRHcm91cDtcblx0cHJpdmF0ZSBfcGlwZWxpbmUhOiBHUFVSZW5kZXJQaXBlbGluZTtcblxuXHRwcml2YXRlIF92ZXJ0ZXhCdWZmZXIhOiBHUFVCdWZmZXI7XG5cblx0cHJpdmF0ZSBfZ2x5cGhTdG9yYWdlQnVmZmVyITogR1BVQnVmZmVyO1xuXHRwcml2YXRlIF9hdGxhc0dwdVRleHR1cmUhOiBHUFVUZXh0dXJlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hdGxhc0dwdVRleHR1cmVWZXJzaW9uczogbnVtYmVyW10gPSBbXTtcblxuXHRwcml2YXRlIF9pbml0aWFsaXplZCA9IGZhbHNlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2dseXBoUmFzdGVyaXplcjogTXV0YWJsZURpc3Bvc2FibGU8R2x5cGhSYXN0ZXJpemVyPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVuZGVyU3RyYXRlZ3k6IE11dGFibGVEaXNwb3NhYmxlPElHcHVSZW5kZXJTdHJhdGVneT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgX3JlYnVpbGRCaW5kR3JvdXA/OiAoKSA9PiB2b2lkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRleHQ6IFZpZXdDb250ZXh0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdHcHVDb250ZXh0OiBWaWV3R3B1Q29udGV4dCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihjb250ZXh0KTtcblxuXHRcdHRoaXMuY2FudmFzID0gdGhpcy5fdmlld0dwdUNvbnRleHQuY2FudmFzLmRvbU5vZGU7XG5cblx0XHQvLyBSZS1yZW5kZXIgdGhlIGZvbGxvd2luZyBmcmFtZSBhZnRlciBjYW52YXMgZGV2aWNlIHBpeGVsIGRpbWVuc2lvbnMgY2hhbmdlLCBwcm92aWRlZCBhXG5cdFx0Ly8gbmV3IHJlbmRlciBkb2VzIG5vdCBvY2N1ci5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHR0aGlzLl92aWV3R3B1Q29udGV4dC5jYW52YXNEZXZpY2VQaXhlbERpbWVuc2lvbnMucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgbGFzdFZpZXdwb3J0RGF0YSA9IHRoaXMuX2xhc3RWaWV3cG9ydERhdGE7XG5cdFx0XHRpZiAobGFzdFZpZXdwb3J0RGF0YSkge1xuXHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRpZiAobGFzdFZpZXdwb3J0RGF0YSA9PT0gdGhpcy5fbGFzdFZpZXdwb3J0RGF0YSkge1xuXHRcdFx0XHRcdFx0dGhpcy5yZW5kZXJUZXh0KGxhc3RWaWV3cG9ydERhdGEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5pbml0V2ViZ3B1KCk7XG5cdH1cblxuXHRhc3luYyBpbml0V2ViZ3B1KCkge1xuXHRcdC8vICNyZWdpb24gR2VuZXJhbFxuXG5cdFx0dGhpcy5fZGV2aWNlID0gVmlld0dwdUNvbnRleHQuZGV2aWNlU3luYyB8fCBhd2FpdCBWaWV3R3B1Q29udGV4dC5kZXZpY2U7XG5cblx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGF0bGFzID0gVmlld0dwdUNvbnRleHQuYXRsYXM7XG5cblx0XHQvLyBSZXJlbmRlciB3aGVuIHRoZSB0ZXh0dXJlIGF0bGFzIGRlbGV0ZXMgZ2x5cGhzXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXRsYXMub25EaWREZWxldGVHbHlwaHMoKCkgPT4ge1xuXHRcdFx0dGhpcy5fYXRsYXNHcHVUZXh0dXJlVmVyc2lvbnMubGVuZ3RoID0gMDtcblx0XHRcdHRoaXMuX2F0bGFzR3B1VGV4dHVyZVZlcnNpb25zWzBdID0gMDtcblx0XHRcdHRoaXMuX2F0bGFzR3B1VGV4dHVyZVZlcnNpb25zWzFdID0gMDtcblx0XHRcdHRoaXMuX3JlbmRlclN0cmF0ZWd5LnZhbHVlIS5yZXNldCgpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHByZXNlbnRhdGlvbkZvcm1hdCA9IG5hdmlnYXRvci5ncHUuZ2V0UHJlZmVycmVkQ2FudmFzRm9ybWF0KCk7XG5cdFx0dGhpcy5fdmlld0dwdUNvbnRleHQuY3R4LmNvbmZpZ3VyZSh7XG5cdFx0XHRkZXZpY2U6IHRoaXMuX2RldmljZSxcblx0XHRcdGZvcm1hdDogcHJlc2VudGF0aW9uRm9ybWF0LFxuXHRcdFx0YWxwaGFNb2RlOiAncHJlbXVsdGlwbGllZCcsXG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZW5kZXJQYXNzQ29sb3JBdHRhY2htZW50ID0ge1xuXHRcdFx0dmlldzogbnVsbCEsIC8vIFdpbGwgYmUgZmlsbGVkIGF0IHJlbmRlciB0aW1lXG5cdFx0XHRsb2FkT3A6ICdsb2FkJyxcblx0XHRcdHN0b3JlT3A6ICdzdG9yZScsXG5cdFx0fTtcblx0XHR0aGlzLl9yZW5kZXJQYXNzRGVzY3JpcHRvciA9IHtcblx0XHRcdGxhYmVsOiAnTW9uYWNvIHJlbmRlciBwYXNzJyxcblx0XHRcdGNvbG9yQXR0YWNobWVudHM6IFt0aGlzLl9yZW5kZXJQYXNzQ29sb3JBdHRhY2htZW50XSxcblx0XHR9O1xuXG5cdFx0Ly8gI2VuZHJlZ2lvbiBHZW5lcmFsXG5cblx0XHQvLyAjcmVnaW9uIFVuaWZvcm1zXG5cblx0XHRsZXQgbGF5b3V0SW5mb1VuaWZvcm1CdWZmZXI6IEdQVUJ1ZmZlcjtcblx0XHR7XG5cdFx0XHRjb25zdCBlbnVtIEluZm8ge1xuXHRcdFx0XHRGbG9hdHNQZXJFbnRyeSA9IDYsXG5cdFx0XHRcdEJ5dGVzUGVyRW50cnkgPSBJbmZvLkZsb2F0c1BlckVudHJ5ICogNCxcblx0XHRcdFx0T2Zmc2V0X0NhbnZhc1dpZHRoX19fXyA9IDAsXG5cdFx0XHRcdE9mZnNldF9DYW52YXNIZWlnaHRfX18gPSAxLFxuXHRcdFx0XHRPZmZzZXRfVmlld3BvcnRPZmZzZXRYID0gMixcblx0XHRcdFx0T2Zmc2V0X1ZpZXdwb3J0T2Zmc2V0WSA9IDMsXG5cdFx0XHRcdE9mZnNldF9WaWV3cG9ydFdpZHRoX18gPSA0LFxuXHRcdFx0XHRPZmZzZXRfVmlld3BvcnRIZWlnaHRfID0gNSxcblx0XHRcdH1cblx0XHRcdGNvbnN0IGJ1ZmZlclZhbHVlcyA9IG5ldyBGbG9hdDMyQXJyYXkoSW5mby5GbG9hdHNQZXJFbnRyeSk7XG5cdFx0XHRjb25zdCB1cGRhdGVCdWZmZXJWYWx1ZXMgPSAoY2FudmFzRGV2aWNlUGl4ZWxXaWR0aDogbnVtYmVyID0gdGhpcy5jYW52YXMud2lkdGgsIGNhbnZhc0RldmljZVBpeGVsSGVpZ2h0OiBudW1iZXIgPSB0aGlzLmNhbnZhcy5oZWlnaHQpID0+IHtcblx0XHRcdFx0YnVmZmVyVmFsdWVzW0luZm8uT2Zmc2V0X0NhbnZhc1dpZHRoX19fX10gPSBjYW52YXNEZXZpY2VQaXhlbFdpZHRoO1xuXHRcdFx0XHRidWZmZXJWYWx1ZXNbSW5mby5PZmZzZXRfQ2FudmFzSGVpZ2h0X19fXSA9IGNhbnZhc0RldmljZVBpeGVsSGVpZ2h0O1xuXHRcdFx0XHRidWZmZXJWYWx1ZXNbSW5mby5PZmZzZXRfVmlld3BvcnRPZmZzZXRYXSA9IE1hdGguY2VpbCh0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pLmNvbnRlbnRMZWZ0ICogZ2V0QWN0aXZlV2luZG93KCkuZGV2aWNlUGl4ZWxSYXRpbyk7XG5cdFx0XHRcdGJ1ZmZlclZhbHVlc1tJbmZvLk9mZnNldF9WaWV3cG9ydE9mZnNldFldID0gMDtcblx0XHRcdFx0YnVmZmVyVmFsdWVzW0luZm8uT2Zmc2V0X1ZpZXdwb3J0V2lkdGhfX10gPSBidWZmZXJWYWx1ZXNbSW5mby5PZmZzZXRfQ2FudmFzV2lkdGhfX19fXSAtIGJ1ZmZlclZhbHVlc1tJbmZvLk9mZnNldF9WaWV3cG9ydE9mZnNldFhdO1xuXHRcdFx0XHRidWZmZXJWYWx1ZXNbSW5mby5PZmZzZXRfVmlld3BvcnRIZWlnaHRfXSA9IGJ1ZmZlclZhbHVlc1tJbmZvLk9mZnNldF9DYW52YXNIZWlnaHRfX19dIC0gYnVmZmVyVmFsdWVzW0luZm8uT2Zmc2V0X1ZpZXdwb3J0T2Zmc2V0WV07XG5cdFx0XHRcdHJldHVybiBidWZmZXJWYWx1ZXM7XG5cdFx0XHR9O1xuXHRcdFx0bGF5b3V0SW5mb1VuaWZvcm1CdWZmZXIgPSB0aGlzLl9yZWdpc3RlcihHUFVMaWZlY3ljbGUuY3JlYXRlQnVmZmVyKHRoaXMuX2RldmljZSwge1xuXHRcdFx0XHRsYWJlbDogJ01vbmFjbyB1bmlmb3JtIGJ1ZmZlcicsXG5cdFx0XHRcdHNpemU6IEluZm8uQnl0ZXNQZXJFbnRyeSxcblx0XHRcdFx0dXNhZ2U6IEdQVUJ1ZmZlclVzYWdlLlVOSUZPUk0gfCBHUFVCdWZmZXJVc2FnZS5DT1BZX0RTVCxcblx0XHRcdH0sICgpID0+IHVwZGF0ZUJ1ZmZlclZhbHVlcygpKSkub2JqZWN0O1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIocnVuT25DaGFuZ2UodGhpcy5fdmlld0dwdUNvbnRleHQuY2FudmFzRGV2aWNlUGl4ZWxEaW1lbnNpb25zLCAoeyB3aWR0aCwgaGVpZ2h0IH0pID0+IHtcblx0XHRcdFx0dGhpcy5fZGV2aWNlLnF1ZXVlLndyaXRlQnVmZmVyKGxheW91dEluZm9Vbmlmb3JtQnVmZmVyLCAwLCB1cGRhdGVCdWZmZXJWYWx1ZXMod2lkdGgsIGhlaWdodCkpO1xuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIocnVuT25DaGFuZ2UodGhpcy5fdmlld0dwdUNvbnRleHQuY29udGVudExlZnQsICgpID0+IHtcblx0XHRcdFx0dGhpcy5fZGV2aWNlLnF1ZXVlLndyaXRlQnVmZmVyKGxheW91dEluZm9Vbmlmb3JtQnVmZmVyLCAwLCB1cGRhdGVCdWZmZXJWYWx1ZXMoKSk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0bGV0IGF0bGFzSW5mb1VuaWZvcm1CdWZmZXI6IEdQVUJ1ZmZlcjtcblx0XHR7XG5cdFx0XHRjb25zdCBlbnVtIEluZm8ge1xuXHRcdFx0XHRGbG9hdHNQZXJFbnRyeSA9IDIsXG5cdFx0XHRcdEJ5dGVzUGVyRW50cnkgPSBJbmZvLkZsb2F0c1BlckVudHJ5ICogNCxcblx0XHRcdFx0T2Zmc2V0X1dpZHRoXyA9IDAsXG5cdFx0XHRcdE9mZnNldF9IZWlnaHQgPSAxLFxuXHRcdFx0fVxuXHRcdFx0YXRsYXNJbmZvVW5pZm9ybUJ1ZmZlciA9IHRoaXMuX3JlZ2lzdGVyKEdQVUxpZmVjeWNsZS5jcmVhdGVCdWZmZXIodGhpcy5fZGV2aWNlLCB7XG5cdFx0XHRcdGxhYmVsOiAnTW9uYWNvIGF0bGFzIGluZm8gdW5pZm9ybSBidWZmZXInLFxuXHRcdFx0XHRzaXplOiBJbmZvLkJ5dGVzUGVyRW50cnksXG5cdFx0XHRcdHVzYWdlOiBHUFVCdWZmZXJVc2FnZS5VTklGT1JNIHwgR1BVQnVmZmVyVXNhZ2UuQ09QWV9EU1QsXG5cdFx0XHR9LCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHZhbHVlcyA9IG5ldyBGbG9hdDMyQXJyYXkoSW5mby5GbG9hdHNQZXJFbnRyeSk7XG5cdFx0XHRcdHZhbHVlc1tJbmZvLk9mZnNldF9XaWR0aF9dID0gYXRsYXMucGFnZVNpemU7XG5cdFx0XHRcdHZhbHVlc1tJbmZvLk9mZnNldF9IZWlnaHRdID0gYXRsYXMucGFnZVNpemU7XG5cdFx0XHRcdHJldHVybiB2YWx1ZXM7XG5cdFx0XHR9KSkub2JqZWN0O1xuXHRcdH1cblxuXHRcdC8vICNlbmRyZWdpb24gVW5pZm9ybXNcblxuXHRcdC8vICNyZWdpb24gU3RvcmFnZSBidWZmZXJzXG5cblx0XHRjb25zdCBmb250RmFtaWx5ID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5mb250RmFtaWx5KTtcblx0XHRjb25zdCBmb250U2l6ZSA9IHRoaXMuX2NvbnRleHQuY29uZmlndXJhdGlvbi5vcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9udFNpemUpO1xuXHRcdHRoaXMuX2dseXBoUmFzdGVyaXplci52YWx1ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBHbHlwaFJhc3Rlcml6ZXIoZm9udFNpemUsIGZvbnRGYW1pbHksIHRoaXMuX3ZpZXdHcHVDb250ZXh0LmRldmljZVBpeGVsUmF0aW8uZ2V0KCkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihydW5PbkNoYW5nZSh0aGlzLl92aWV3R3B1Q29udGV4dC5kZXZpY2VQaXhlbFJhdGlvLCAoKSA9PiB7XG5cdFx0XHR0aGlzLl9yZWZyZXNoR2x5cGhSYXN0ZXJpemVyKCk7XG5cdFx0fSkpO1xuXG5cblx0XHR0aGlzLl9yZW5kZXJTdHJhdGVneS52YWx1ZSA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEZ1bGxGaWxlUmVuZGVyU3RyYXRlZ3ksIHRoaXMuX2NvbnRleHQsIHRoaXMuX3ZpZXdHcHVDb250ZXh0LCB0aGlzLl9kZXZpY2UsIHRoaXMuX2dseXBoUmFzdGVyaXplciBhcyB7IHZhbHVlOiBHbHlwaFJhc3Rlcml6ZXIgfSk7XG5cdFx0Ly8gdGhpcy5fcmVuZGVyU3RyYXRlZ3kudmFsdWUgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShWaWV3cG9ydFJlbmRlclN0cmF0ZWd5LCB0aGlzLl9jb250ZXh0LCB0aGlzLl92aWV3R3B1Q29udGV4dCwgdGhpcy5fZGV2aWNlKTtcblxuXHRcdHRoaXMuX2dseXBoU3RvcmFnZUJ1ZmZlciA9IHRoaXMuX3JlZ2lzdGVyKEdQVUxpZmVjeWNsZS5jcmVhdGVCdWZmZXIodGhpcy5fZGV2aWNlLCB7XG5cdFx0XHRsYWJlbDogJ01vbmFjbyBnbHlwaCBzdG9yYWdlIGJ1ZmZlcicsXG5cdFx0XHRzaXplOiBUZXh0dXJlQXRsYXMubWF4aW11bVBhZ2VDb3VudCAqIChUZXh0dXJlQXRsYXNQYWdlLm1heGltdW1HbHlwaENvdW50ICogR2x5cGhTdG9yYWdlQnVmZmVySW5mby5CeXRlc1BlckVudHJ5KSxcblx0XHRcdHVzYWdlOiBHUFVCdWZmZXJVc2FnZS5TVE9SQUdFIHwgR1BVQnVmZmVyVXNhZ2UuQ09QWV9EU1QsXG5cdFx0fSkpLm9iamVjdDtcblx0XHR0aGlzLl9hdGxhc0dwdVRleHR1cmVWZXJzaW9uc1swXSA9IDA7XG5cdFx0dGhpcy5fYXRsYXNHcHVUZXh0dXJlVmVyc2lvbnNbMV0gPSAwO1xuXHRcdHRoaXMuX2F0bGFzR3B1VGV4dHVyZSA9IHRoaXMuX3JlZ2lzdGVyKEdQVUxpZmVjeWNsZS5jcmVhdGVUZXh0dXJlKHRoaXMuX2RldmljZSwge1xuXHRcdFx0bGFiZWw6ICdNb25hY28gYXRsYXMgdGV4dHVyZScsXG5cdFx0XHRmb3JtYXQ6ICdyZ2JhOHVub3JtJyxcblx0XHRcdHNpemU6IHsgd2lkdGg6IGF0bGFzLnBhZ2VTaXplLCBoZWlnaHQ6IGF0bGFzLnBhZ2VTaXplLCBkZXB0aE9yQXJyYXlMYXllcnM6IFRleHR1cmVBdGxhcy5tYXhpbXVtUGFnZUNvdW50IH0sXG5cdFx0XHRkaW1lbnNpb246ICcyZCcsXG5cdFx0XHR1c2FnZTogR1BVVGV4dHVyZVVzYWdlLlRFWFRVUkVfQklORElORyB8XG5cdFx0XHRcdEdQVVRleHR1cmVVc2FnZS5DT1BZX0RTVCB8XG5cdFx0XHRcdEdQVVRleHR1cmVVc2FnZS5SRU5ERVJfQVRUQUNITUVOVCxcblx0XHR9KSkub2JqZWN0O1xuXG5cdFx0dGhpcy5fdXBkYXRlQXRsYXNTdG9yYWdlQnVmZmVyQW5kVGV4dHVyZSgpO1xuXG5cdFx0Ly8gI2VuZHJlZ2lvbiBTdG9yYWdlIGJ1ZmZlcnNcblxuXHRcdC8vICNyZWdpb24gVmVydGV4IGJ1ZmZlclxuXG5cdFx0dGhpcy5fdmVydGV4QnVmZmVyID0gdGhpcy5fcmVnaXN0ZXIoR1BVTGlmZWN5Y2xlLmNyZWF0ZUJ1ZmZlcih0aGlzLl9kZXZpY2UsIHtcblx0XHRcdGxhYmVsOiAnTW9uYWNvIHZlcnRleCBidWZmZXInLFxuXHRcdFx0c2l6ZTogcXVhZFZlcnRpY2VzLmJ5dGVMZW5ndGgsXG5cdFx0XHR1c2FnZTogR1BVQnVmZmVyVXNhZ2UuVkVSVEVYIHwgR1BVQnVmZmVyVXNhZ2UuQ09QWV9EU1QsXG5cdFx0fSwgcXVhZFZlcnRpY2VzKSkub2JqZWN0O1xuXG5cdFx0Ly8gI2VuZHJlZ2lvbiBWZXJ0ZXggYnVmZmVyXG5cblx0XHQvLyAjcmVnaW9uIFNoYWRlciBtb2R1bGVcblxuXHRcdGNvbnN0IG1vZHVsZSA9IHRoaXMuX2RldmljZS5jcmVhdGVTaGFkZXJNb2R1bGUoe1xuXHRcdFx0bGFiZWw6ICdNb25hY28gc2hhZGVyIG1vZHVsZScsXG5cdFx0XHRjb2RlOiB0aGlzLl9yZW5kZXJTdHJhdGVneS52YWx1ZSEud2dzbCxcblx0XHR9KTtcblxuXHRcdC8vICNlbmRyZWdpb24gU2hhZGVyIG1vZHVsZVxuXG5cdFx0Ly8gI3JlZ2lvbiBQaXBlbGluZVxuXG5cdFx0dGhpcy5fcGlwZWxpbmUgPSB0aGlzLl9kZXZpY2UuY3JlYXRlUmVuZGVyUGlwZWxpbmUoe1xuXHRcdFx0bGFiZWw6ICdNb25hY28gcmVuZGVyIHBpcGVsaW5lJyxcblx0XHRcdGxheW91dDogJ2F1dG8nLFxuXHRcdFx0dmVydGV4OiB7XG5cdFx0XHRcdG1vZHVsZSxcblx0XHRcdFx0YnVmZmVyczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGFycmF5U3RyaWRlOiAyICogRmxvYXQzMkFycmF5LkJZVEVTX1BFUl9FTEVNRU5ULCAvLyAyIGZsb2F0cywgNCBieXRlcyBlYWNoXG5cdFx0XHRcdFx0XHRhdHRyaWJ1dGVzOiBbXG5cdFx0XHRcdFx0XHRcdHsgc2hhZGVyTG9jYXRpb246IDAsIG9mZnNldDogMCwgZm9ybWF0OiAnZmxvYXQzMngyJyB9LCAgLy8gcG9zaXRpb25cblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9LFxuXHRcdFx0ZnJhZ21lbnQ6IHtcblx0XHRcdFx0bW9kdWxlLFxuXHRcdFx0XHR0YXJnZXRzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0Zm9ybWF0OiBwcmVzZW50YXRpb25Gb3JtYXQsXG5cdFx0XHRcdFx0XHRibGVuZDoge1xuXHRcdFx0XHRcdFx0XHRjb2xvcjoge1xuXHRcdFx0XHRcdFx0XHRcdHNyY0ZhY3RvcjogJ3NyYy1hbHBoYScsXG5cdFx0XHRcdFx0XHRcdFx0ZHN0RmFjdG9yOiAnb25lLW1pbnVzLXNyYy1hbHBoYSdcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0YWxwaGE6IHtcblx0XHRcdFx0XHRcdFx0XHRzcmNGYWN0b3I6ICdzcmMtYWxwaGEnLFxuXHRcdFx0XHRcdFx0XHRcdGRzdEZhY3RvcjogJ29uZS1taW51cy1zcmMtYWxwaGEnXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSxcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHQvLyAjZW5kcmVnaW9uIFBpcGVsaW5lXG5cblx0XHQvLyAjcmVnaW9uIEJpbmQgZ3JvdXBcblxuXHRcdHRoaXMuX3JlYnVpbGRCaW5kR3JvdXAgPSAoKSA9PiB7XG5cdFx0XHR0aGlzLl9iaW5kR3JvdXAgPSB0aGlzLl9kZXZpY2UuY3JlYXRlQmluZEdyb3VwKHtcblx0XHRcdFx0bGFiZWw6ICdNb25hY28gYmluZCBncm91cCcsXG5cdFx0XHRcdGxheW91dDogdGhpcy5fcGlwZWxpbmUuZ2V0QmluZEdyb3VwTGF5b3V0KDApLFxuXHRcdFx0XHRlbnRyaWVzOiBbXG5cdFx0XHRcdFx0Ly8gVE9ETzogUGFzcyBpbiBnZW5lcmljYWxseSBhcyBhcnJheT9cblx0XHRcdFx0XHR7IGJpbmRpbmc6IEJpbmRpbmdJZC5HbHlwaEluZm8sIHJlc291cmNlOiB7IGJ1ZmZlcjogdGhpcy5fZ2x5cGhTdG9yYWdlQnVmZmVyIH0gfSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRiaW5kaW5nOiBCaW5kaW5nSWQuVGV4dHVyZVNhbXBsZXIsIHJlc291cmNlOiB0aGlzLl9kZXZpY2UuY3JlYXRlU2FtcGxlcih7XG5cdFx0XHRcdFx0XHRcdGxhYmVsOiAnTW9uYWNvIGF0bGFzIHNhbXBsZXInLFxuXHRcdFx0XHRcdFx0XHRtYWdGaWx0ZXI6ICduZWFyZXN0Jyxcblx0XHRcdFx0XHRcdFx0bWluRmlsdGVyOiAnbmVhcmVzdCcsXG5cdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0eyBiaW5kaW5nOiBCaW5kaW5nSWQuVGV4dHVyZSwgcmVzb3VyY2U6IHRoaXMuX2F0bGFzR3B1VGV4dHVyZS5jcmVhdGVWaWV3KCkgfSxcblx0XHRcdFx0XHR7IGJpbmRpbmc6IEJpbmRpbmdJZC5MYXlvdXRJbmZvVW5pZm9ybSwgcmVzb3VyY2U6IHsgYnVmZmVyOiBsYXlvdXRJbmZvVW5pZm9ybUJ1ZmZlciB9IH0sXG5cdFx0XHRcdFx0eyBiaW5kaW5nOiBCaW5kaW5nSWQuQXRsYXNEaW1lbnNpb25zVW5pZm9ybSwgcmVzb3VyY2U6IHsgYnVmZmVyOiBhdGxhc0luZm9Vbmlmb3JtQnVmZmVyIH0gfSxcblx0XHRcdFx0XHQuLi50aGlzLl9yZW5kZXJTdHJhdGVneS52YWx1ZSEuYmluZEdyb3VwRW50cmllc1xuXHRcdFx0XHRdLFxuXHRcdFx0fSk7XG5cdFx0fTtcblx0XHR0aGlzLl9yZWJ1aWxkQmluZEdyb3VwKCk7XG5cblx0XHQvLyBlbmRyZWdpb24gQmluZCBncm91cFxuXG5cdFx0dGhpcy5faW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG5cdFx0Ly8gUmVuZGVyIHRoZSBpbml0aWFsIHZpZXdwb3J0IGltbWVkaWF0ZWx5IGFmdGVyIGluaXRpYWxpemF0aW9uXG5cdFx0aWYgKHRoaXMuX2luaXRWaWV3cG9ydERhdGEpIHtcblx0XHRcdC8vIEhBQ0s6IFJlbmRlcmluZyBtdWx0aXBsZSB0aW1lcyBpbiB0aGUgc2FtZSBmcmFtZSBsaWtlIHRoaXMgaXNuJ3QgaWRlYWwsIGJ1dCB0aGVyZVxuXHRcdFx0Ly8gICAgICAgaXNuJ3QgYW4gZWFzeSB3YXkgdG8gbWVyZ2Ugdmlld3BvcnQgZGF0YVxuXHRcdFx0Zm9yIChjb25zdCB2aWV3cG9ydERhdGEgb2YgdGhpcy5faW5pdFZpZXdwb3J0RGF0YSkge1xuXHRcdFx0XHR0aGlzLnJlbmRlclRleHQodmlld3BvcnREYXRhKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2luaXRWaWV3cG9ydERhdGEgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVmcmVzaFJlbmRlclN0cmF0ZWd5KHZpZXdwb3J0RGF0YTogVmlld3BvcnREYXRhKSB7XG5cdFx0aWYgKHRoaXMuX3JlbmRlclN0cmF0ZWd5LnZhbHVlPy50eXBlID09PSAndmlld3BvcnQnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh2aWV3cG9ydERhdGEuZW5kTGluZU51bWJlciA8IEZ1bGxGaWxlUmVuZGVyU3RyYXRlZ3kubWF4U3VwcG9ydGVkTGluZXMgJiYgdGhpcy5fdmlld3BvcnRNYXhDb2x1bW4odmlld3BvcnREYXRhKSA8IEZ1bGxGaWxlUmVuZGVyU3RyYXRlZ3kubWF4U3VwcG9ydGVkQ29sdW1ucykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBGaWxlIGlzIGxhcmdlciB0aGFuICR7RnVsbEZpbGVSZW5kZXJTdHJhdGVneS5tYXhTdXBwb3J0ZWRMaW5lc30gbGluZXMgb3IgJHtGdWxsRmlsZVJlbmRlclN0cmF0ZWd5Lm1heFN1cHBvcnRlZENvbHVtbnN9IGNvbHVtbnMsIHN3aXRjaGluZyB0byB2aWV3cG9ydCByZW5kZXIgc3RyYXRlZ3lgKTtcblx0XHRjb25zdCB2aWV3cG9ydFJlbmRlclN0cmF0ZWd5ID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVmlld3BvcnRSZW5kZXJTdHJhdGVneSwgdGhpcy5fY29udGV4dCwgdGhpcy5fdmlld0dwdUNvbnRleHQsIHRoaXMuX2RldmljZSwgdGhpcy5fZ2x5cGhSYXN0ZXJpemVyIGFzIHsgdmFsdWU6IEdseXBoUmFzdGVyaXplciB9KTtcblx0XHR0aGlzLl9yZW5kZXJTdHJhdGVneS52YWx1ZSA9IHZpZXdwb3J0UmVuZGVyU3RyYXRlZ3k7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodmlld3BvcnRSZW5kZXJTdHJhdGVneS5vbkRpZENoYW5nZUJpbmRHcm91cEVudHJpZXMoKCkgPT4gdGhpcy5fcmVidWlsZEJpbmRHcm91cD8uKCkpKTtcblx0XHR0aGlzLl9yZWJ1aWxkQmluZEdyb3VwPy4oKTtcblx0fVxuXG5cdHByaXZhdGUgX3ZpZXdwb3J0TWF4Q29sdW1uKHZpZXdwb3J0RGF0YTogVmlld3BvcnREYXRhKTogbnVtYmVyIHtcblx0XHRsZXQgbWF4Q29sdW1uID0gMDtcblx0XHRsZXQgbGluZURhdGE6IFZpZXdMaW5lUmVuZGVyaW5nRGF0YTtcblx0XHRmb3IgKGxldCBpID0gdmlld3BvcnREYXRhLnN0YXJ0TGluZU51bWJlcjsgaSA8PSB2aWV3cG9ydERhdGEuZW5kTGluZU51bWJlcjsgaSsrKSB7XG5cdFx0XHRsaW5lRGF0YSA9IHZpZXdwb3J0RGF0YS5nZXRWaWV3TGluZVJlbmRlcmluZ0RhdGEoaSk7XG5cdFx0XHRtYXhDb2x1bW4gPSBNYXRoLm1heChtYXhDb2x1bW4sIGxpbmVEYXRhLm1heENvbHVtbik7XG5cdFx0fVxuXHRcdHJldHVybiBtYXhDb2x1bW47XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVBdGxhc1N0b3JhZ2VCdWZmZXJBbmRUZXh0dXJlKCkge1xuXHRcdGZvciAoY29uc3QgW2xheWVySW5kZXgsIHBhZ2VdIG9mIFZpZXdHcHVDb250ZXh0LmF0bGFzLnBhZ2VzLmVudHJpZXMoKSkge1xuXHRcdFx0aWYgKGxheWVySW5kZXggPj0gVGV4dHVyZUF0bGFzLm1heGltdW1QYWdlQ291bnQpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYEF0dGVtcHQgdG8gdXBsb2FkIGF0bGFzIHBhZ2UgWyR7bGF5ZXJJbmRleH1dLCBvbmx5ICR7VGV4dHVyZUF0bGFzLm1heGltdW1QYWdlQ291bnR9IGFyZSBzdXBwb3J0ZWQgY3VycmVudGx5YCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTa2lwIHRoZSB1cGRhdGUgaWYgaXQncyBhbHJlYWR5IHRoZSBsYXRlc3QgdmVyc2lvblxuXHRcdFx0aWYgKHBhZ2UudmVyc2lvbiA9PT0gdGhpcy5fYXRsYXNHcHVUZXh0dXJlVmVyc2lvbnNbbGF5ZXJJbmRleF0pIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ1VwZGF0aW5nIGF0bGFzIHBhZ2VbJywgbGF5ZXJJbmRleCwgJ10gZnJvbSB2ZXJzaW9uICcsIHRoaXMuX2F0bGFzR3B1VGV4dHVyZVZlcnNpb25zW2xheWVySW5kZXhdLCAnIHRvIHZlcnNpb24gJywgcGFnZS52ZXJzaW9uKTtcblxuXHRcdFx0Y29uc3QgZW50cnlDb3VudCA9IEdseXBoU3RvcmFnZUJ1ZmZlckluZm8uRmxvYXRzUGVyRW50cnkgKiBUZXh0dXJlQXRsYXNQYWdlLm1heGltdW1HbHlwaENvdW50O1xuXHRcdFx0Y29uc3QgdmFsdWVzID0gbmV3IEZsb2F0MzJBcnJheShlbnRyeUNvdW50KTtcblx0XHRcdGxldCBlbnRyeU9mZnNldCA9IDA7XG5cdFx0XHRmb3IgKGNvbnN0IGdseXBoIG9mIHBhZ2UuZ2x5cGhzKSB7XG5cdFx0XHRcdHZhbHVlc1tlbnRyeU9mZnNldCArIEdseXBoU3RvcmFnZUJ1ZmZlckluZm8uT2Zmc2V0X1RleHR1cmVQb3NpdGlvbl0gPSBnbHlwaC54O1xuXHRcdFx0XHR2YWx1ZXNbZW50cnlPZmZzZXQgKyBHbHlwaFN0b3JhZ2VCdWZmZXJJbmZvLk9mZnNldF9UZXh0dXJlUG9zaXRpb24gKyAxXSA9IGdseXBoLnk7XG5cdFx0XHRcdHZhbHVlc1tlbnRyeU9mZnNldCArIEdseXBoU3RvcmFnZUJ1ZmZlckluZm8uT2Zmc2V0X1RleHR1cmVTaXplXSA9IGdseXBoLnc7XG5cdFx0XHRcdHZhbHVlc1tlbnRyeU9mZnNldCArIEdseXBoU3RvcmFnZUJ1ZmZlckluZm8uT2Zmc2V0X1RleHR1cmVTaXplICsgMV0gPSBnbHlwaC5oO1xuXHRcdFx0XHR2YWx1ZXNbZW50cnlPZmZzZXQgKyBHbHlwaFN0b3JhZ2VCdWZmZXJJbmZvLk9mZnNldF9PcmlnaW5Qb3NpdGlvbl0gPSBnbHlwaC5vcmlnaW5PZmZzZXRYO1xuXHRcdFx0XHR2YWx1ZXNbZW50cnlPZmZzZXQgKyBHbHlwaFN0b3JhZ2VCdWZmZXJJbmZvLk9mZnNldF9PcmlnaW5Qb3NpdGlvbiArIDFdID0gZ2x5cGgub3JpZ2luT2Zmc2V0WTtcblx0XHRcdFx0ZW50cnlPZmZzZXQgKz0gR2x5cGhTdG9yYWdlQnVmZmVySW5mby5GbG9hdHNQZXJFbnRyeTtcblx0XHRcdH1cblx0XHRcdGlmIChlbnRyeU9mZnNldCAvIEdseXBoU3RvcmFnZUJ1ZmZlckluZm8uRmxvYXRzUGVyRW50cnkgPiBUZXh0dXJlQXRsYXNQYWdlLm1heGltdW1HbHlwaENvdW50KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgQXR0ZW1wdGluZyB0byB3cml0ZSBtb3JlIGdseXBocyAoJHtlbnRyeU9mZnNldCAvIEdseXBoU3RvcmFnZUJ1ZmZlckluZm8uRmxvYXRzUGVyRW50cnl9KSB0aGFuIHRoZSBHUFVCdWZmZXIgY2FuIGhvbGQgKCR7VGV4dHVyZUF0bGFzUGFnZS5tYXhpbXVtR2x5cGhDb3VudH0pYCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9kZXZpY2UucXVldWUud3JpdGVCdWZmZXIoXG5cdFx0XHRcdHRoaXMuX2dseXBoU3RvcmFnZUJ1ZmZlcixcblx0XHRcdFx0bGF5ZXJJbmRleCAqIEdseXBoU3RvcmFnZUJ1ZmZlckluZm8uRmxvYXRzUGVyRW50cnkgKiBUZXh0dXJlQXRsYXNQYWdlLm1heGltdW1HbHlwaENvdW50ICogRmxvYXQzMkFycmF5LkJZVEVTX1BFUl9FTEVNRU5ULFxuXHRcdFx0XHR2YWx1ZXMsXG5cdFx0XHRcdDAsXG5cdFx0XHRcdEdseXBoU3RvcmFnZUJ1ZmZlckluZm8uRmxvYXRzUGVyRW50cnkgKiBUZXh0dXJlQXRsYXNQYWdlLm1heGltdW1HbHlwaENvdW50XG5cdFx0XHQpO1xuXHRcdFx0aWYgKHBhZ2UudXNlZEFyZWEucmlnaHQgLSBwYWdlLnVzZWRBcmVhLmxlZnQgPiAwICYmIHBhZ2UudXNlZEFyZWEuYm90dG9tIC0gcGFnZS51c2VkQXJlYS50b3AgPiAwKSB7XG5cdFx0XHRcdHRoaXMuX2RldmljZS5xdWV1ZS5jb3B5RXh0ZXJuYWxJbWFnZVRvVGV4dHVyZShcblx0XHRcdFx0XHR7IHNvdXJjZTogcGFnZS5zb3VyY2UgfSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0ZXh0dXJlOiB0aGlzLl9hdGxhc0dwdVRleHR1cmUsXG5cdFx0XHRcdFx0XHRvcmlnaW46IHtcblx0XHRcdFx0XHRcdFx0eDogcGFnZS51c2VkQXJlYS5sZWZ0LFxuXHRcdFx0XHRcdFx0XHR5OiBwYWdlLnVzZWRBcmVhLnRvcCxcblx0XHRcdFx0XHRcdFx0ejogbGF5ZXJJbmRleFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0d2lkdGg6IHBhZ2UudXNlZEFyZWEucmlnaHQgLSBwYWdlLnVzZWRBcmVhLmxlZnQgKyAxLFxuXHRcdFx0XHRcdFx0aGVpZ2h0OiBwYWdlLnVzZWRBcmVhLmJvdHRvbSAtIHBhZ2UudXNlZEFyZWEudG9wICsgMVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9hdGxhc0dwdVRleHR1cmVWZXJzaW9uc1tsYXllckluZGV4XSA9IHBhZ2UudmVyc2lvbjtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcHJlcGFyZVJlbmRlcihjdHg6IFJlbmRlcmluZ0NvbnRleHQpOiB2b2lkIHtcblx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdTaG91bGQgbm90IGJlIGNhbGxlZCcpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHJlbmRlcihjdHg6IFJlc3RyaWN0ZWRSZW5kZXJpbmdDb250ZXh0KTogdm9pZCB7XG5cdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignU2hvdWxkIG5vdCBiZSBjYWxsZWQnKTtcblx0fVxuXG5cdC8vICNyZWdpb24gRXZlbnQgaGFuZGxlcnNcblxuXHQvLyBTaW5jZSBWaWV3TGluZXNHcHUgY3VycmVudGx5IGNvb3JkaW5hdGVzIHJlbmRlcmluZyB0byB0aGUgY2FudmFzLCBpdCBtdXN0IGxpc3RlbiB0byBhbGxcblx0Ly8gY2hhbmdlZCBldmVudHMgdGhhdCBhbnkgR1BVIHBhcnQgbGlzdGVucyB0by4gVGhpcyBpcyBiZWNhdXNlIGFueSBkcmF3aW5nIHRvIHRoZSBjYW52YXMgd2lsbFxuXHQvLyBjbGVhciBpdCBmb3IgdGhhdCBmcmFtZSwgc28gYWxsIHBhcnRzIG11c3QgYmUgcmVuZGVyZWQgZXZlcnkgdGltZS5cblx0Ly9cblx0Ly8gQWRkaXRpb25hbGx5LCBzaW5jZSB0aGlzIGlzIGludHJpbnNpY2FsbHkgbGlua2VkIHRvIFZpZXdMaW5lcywgaXQgbXVzdCBhbHNvIGxpc3RlbiB0byBldmVudHNcblx0Ly8gZnJvbSB0aGF0IHNpZGUuIEx1Y2tpbHkgcmVuZGVyaW5nIGlzIGNoZWFwLCBpdCdzIG9ubHkgd2hlbiB1cGxvYWRlZCBkYXRhIGNoYW5nZXMgZG9lcyBpdFxuXHQvLyBzdGFydCB0byBjb3N0LlxuXG5cdG92ZXJyaWRlIG9uQ29uZmlndXJhdGlvbkNoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Q29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX3JlZnJlc2hHbHlwaFJhc3Rlcml6ZXIoKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRvdmVycmlkZSBvbkN1cnNvclN0YXRlQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdDdXJzb3JTdGF0ZUNoYW5nZWRFdmVudCk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXHRvdmVycmlkZSBvbkRlY29yYXRpb25zQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdEZWNvcmF0aW9uc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXHRvdmVycmlkZSBvbkZsdXNoZWQoZTogdmlld0V2ZW50cy5WaWV3Rmx1c2hlZEV2ZW50KTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG5cblx0b3ZlcnJpZGUgb25MaW5lc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3TGluZXNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cblx0b3ZlcnJpZGUgb25MaW5lc0RlbGV0ZWQoZTogdmlld0V2ZW50cy5WaWV3TGluZXNEZWxldGVkRXZlbnQpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cblx0b3ZlcnJpZGUgb25MaW5lc0luc2VydGVkKGU6IHZpZXdFdmVudHMuVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXHRvdmVycmlkZSBvbkxpbmVNYXBwaW5nQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdMaW5lTWFwcGluZ0NoYW5nZWRFdmVudCk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXHRvdmVycmlkZSBvblJldmVhbFJhbmdlUmVxdWVzdChlOiB2aWV3RXZlbnRzLlZpZXdSZXZlYWxSYW5nZVJlcXVlc3RFdmVudCk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXHRvdmVycmlkZSBvblNjcm9sbENoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3U2Nyb2xsQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG5cdG92ZXJyaWRlIG9uVGhlbWVDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld1RoZW1lQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG5cdG92ZXJyaWRlIG9uWm9uZXNDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld1pvbmVzQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG5cblx0Ly8gI2VuZHJlZ2lvblxuXG5cdHByaXZhdGUgX3JlZnJlc2hHbHlwaFJhc3Rlcml6ZXIoKSB7XG5cdFx0Y29uc3QgZ2x5cGhSYXN0ZXJpemVyID0gdGhpcy5fZ2x5cGhSYXN0ZXJpemVyLnZhbHVlO1xuXHRcdGlmICghZ2x5cGhSYXN0ZXJpemVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGZvbnRGYW1pbHkgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmZvbnRGYW1pbHkpO1xuXHRcdGNvbnN0IGZvbnRTaXplID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5mb250U2l6ZSk7XG5cdFx0Y29uc3QgZGV2aWNlUGl4ZWxSYXRpbyA9IHRoaXMuX3ZpZXdHcHVDb250ZXh0LmRldmljZVBpeGVsUmF0aW8uZ2V0KCk7XG5cdFx0aWYgKFxuXHRcdFx0Z2x5cGhSYXN0ZXJpemVyLmZvbnRGYW1pbHkgIT09IGZvbnRGYW1pbHkgfHxcblx0XHRcdGdseXBoUmFzdGVyaXplci5mb250U2l6ZSAhPT0gZm9udFNpemUgfHxcblx0XHRcdGdseXBoUmFzdGVyaXplci5kZXZpY2VQaXhlbFJhdGlvICE9PSBkZXZpY2VQaXhlbFJhdGlvXG5cdFx0KSB7XG5cdFx0XHR0aGlzLl9nbHlwaFJhc3Rlcml6ZXIudmFsdWUgPSBuZXcgR2x5cGhSYXN0ZXJpemVyKGZvbnRTaXplLCBmb250RmFtaWx5LCBkZXZpY2VQaXhlbFJhdGlvKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcmVuZGVyVGV4dCh2aWV3cG9ydERhdGE6IFZpZXdwb3J0RGF0YSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pbml0aWFsaXplZCkge1xuXHRcdFx0dGhpcy5fcmVmcmVzaFJlbmRlclN0cmF0ZWd5KHZpZXdwb3J0RGF0YSk7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyVGV4dCh2aWV3cG9ydERhdGEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9pbml0Vmlld3BvcnREYXRhID0gdGhpcy5faW5pdFZpZXdwb3J0RGF0YSA/PyBbXTtcblx0XHRcdHRoaXMuX2luaXRWaWV3cG9ydERhdGEucHVzaCh2aWV3cG9ydERhdGEpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3JlbmRlclRleHQodmlld3BvcnREYXRhOiBWaWV3cG9ydERhdGEpOiB2b2lkIHtcblx0XHR0aGlzLl92aWV3R3B1Q29udGV4dC5yZWN0YW5nbGVSZW5kZXJlci5kcmF3KHZpZXdwb3J0RGF0YSk7XG5cblx0XHRjb25zdCBvcHRpb25zID0gbmV3IFZpZXdMaW5lT3B0aW9ucyh0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24sIHRoaXMuX2NvbnRleHQudGhlbWUudHlwZSk7XG5cblx0XHR0aGlzLl9yZW5kZXJTdHJhdGVneS52YWx1ZSEudXBkYXRlKHZpZXdwb3J0RGF0YSwgb3B0aW9ucyk7XG5cblx0XHR0aGlzLl91cGRhdGVBdGxhc1N0b3JhZ2VCdWZmZXJBbmRUZXh0dXJlKCk7XG5cblx0XHRjb25zdCBlbmNvZGVyID0gdGhpcy5fZGV2aWNlLmNyZWF0ZUNvbW1hbmRFbmNvZGVyKHsgbGFiZWw6ICdNb25hY28gY29tbWFuZCBlbmNvZGVyJyB9KTtcblxuXHRcdHRoaXMuX3JlbmRlclBhc3NDb2xvckF0dGFjaG1lbnQudmlldyA9IHRoaXMuX3ZpZXdHcHVDb250ZXh0LmN0eC5nZXRDdXJyZW50VGV4dHVyZSgpLmNyZWF0ZVZpZXcoeyBsYWJlbDogJ01vbmFjbyBjYW52YXMgdGV4dHVyZSB2aWV3JyB9KTtcblx0XHRjb25zdCBwYXNzID0gZW5jb2Rlci5iZWdpblJlbmRlclBhc3ModGhpcy5fcmVuZGVyUGFzc0Rlc2NyaXB0b3IpO1xuXHRcdHBhc3Muc2V0UGlwZWxpbmUodGhpcy5fcGlwZWxpbmUpO1xuXHRcdHBhc3Muc2V0VmVydGV4QnVmZmVyKDAsIHRoaXMuX3ZlcnRleEJ1ZmZlcik7XG5cblx0XHQvLyBPbmx5IGRyYXcgdGhlIGNvbnRlbnQgYXJlYVxuXHRcdGNvbnN0IGNvbnRlbnRMZWZ0ID0gTWF0aC5jZWlsKHRoaXMuX3ZpZXdHcHVDb250ZXh0LmNvbnRlbnRMZWZ0LmdldCgpICogdGhpcy5fdmlld0dwdUNvbnRleHQuZGV2aWNlUGl4ZWxSYXRpby5nZXQoKSk7XG5cdFx0cGFzcy5zZXRTY2lzc29yUmVjdChjb250ZW50TGVmdCwgMCwgdGhpcy5jYW52YXMud2lkdGggLSBjb250ZW50TGVmdCwgdGhpcy5jYW52YXMuaGVpZ2h0KTtcblxuXHRcdHBhc3Muc2V0QmluZEdyb3VwKDAsIHRoaXMuX2JpbmRHcm91cCk7XG5cblx0XHR0aGlzLl9yZW5kZXJTdHJhdGVneS52YWx1ZSEuZHJhdyhwYXNzLCB2aWV3cG9ydERhdGEpO1xuXG5cdFx0cGFzcy5lbmQoKTtcblxuXHRcdGNvbnN0IGNvbW1hbmRCdWZmZXIgPSBlbmNvZGVyLmZpbmlzaCgpO1xuXG5cdFx0dGhpcy5fZGV2aWNlLnF1ZXVlLnN1Ym1pdChbY29tbWFuZEJ1ZmZlcl0pO1xuXG5cdFx0dGhpcy5fbGFzdFZpZXdwb3J0RGF0YSA9IHZpZXdwb3J0RGF0YTtcblx0XHR0aGlzLl9sYXN0Vmlld0xpbmVPcHRpb25zID0gb3B0aW9ucztcblx0fVxuXG5cdGxpbmVzVmlzaWJsZVJhbmdlc0ZvclJhbmdlKF9yYW5nZTogUmFuZ2UsIGluY2x1ZGVOZXdMaW5lczogYm9vbGVhbik6IExpbmVWaXNpYmxlUmFuZ2VzW10gfCBudWxsIHtcblx0XHRpZiAoIXRoaXMuX2xhc3RWaWV3cG9ydERhdGEpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCBvcmlnaW5hbEVuZExpbmVOdW1iZXIgPSBfcmFuZ2UuZW5kTGluZU51bWJlcjtcblx0XHRjb25zdCByYW5nZSA9IFJhbmdlLmludGVyc2VjdFJhbmdlcyhfcmFuZ2UsIHRoaXMuX2xhc3RWaWV3cG9ydERhdGEudmlzaWJsZVJhbmdlKTtcblx0XHRpZiAoIXJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCByZW5kU3RhcnRMaW5lTnVtYmVyID0gdGhpcy5fbGFzdFZpZXdwb3J0RGF0YS5zdGFydExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgcmVuZEVuZExpbmVOdW1iZXIgPSB0aGlzLl9sYXN0Vmlld3BvcnREYXRhLmVuZExpbmVOdW1iZXI7XG5cblx0XHRjb25zdCB2aWV3cG9ydERhdGEgPSB0aGlzLl9sYXN0Vmlld3BvcnREYXRhO1xuXHRcdGNvbnN0IHZpZXdMaW5lT3B0aW9ucyA9IHRoaXMuX2xhc3RWaWV3TGluZU9wdGlvbnM7XG5cblx0XHRpZiAoIXZpZXdwb3J0RGF0YSB8fCAhdmlld0xpbmVPcHRpb25zKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCB2aXNpYmxlUmFuZ2VzOiBMaW5lVmlzaWJsZVJhbmdlc1tdID0gW107XG5cblx0XHRsZXQgbmV4dExpbmVNb2RlbExpbmVOdW1iZXI6IG51bWJlciA9IDA7XG5cdFx0aWYgKGluY2x1ZGVOZXdMaW5lcykge1xuXHRcdFx0bmV4dExpbmVNb2RlbExpbmVOdW1iZXIgPSB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKG5ldyBQb3NpdGlvbihyYW5nZS5zdGFydExpbmVOdW1iZXIsIDEpKS5saW5lTnVtYmVyO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGxpbmVOdW1iZXIgPSByYW5nZS5zdGFydExpbmVOdW1iZXI7IGxpbmVOdW1iZXIgPD0gcmFuZ2UuZW5kTGluZU51bWJlcjsgbGluZU51bWJlcisrKSB7XG5cblx0XHRcdGlmIChsaW5lTnVtYmVyIDwgcmVuZFN0YXJ0TGluZU51bWJlciB8fCBsaW5lTnVtYmVyID4gcmVuZEVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzdGFydENvbHVtbiA9IGxpbmVOdW1iZXIgPT09IHJhbmdlLnN0YXJ0TGluZU51bWJlciA/IHJhbmdlLnN0YXJ0Q29sdW1uIDogMTtcblx0XHRcdGNvbnN0IGNvbnRpbnVlc0luTmV4dExpbmUgPSBsaW5lTnVtYmVyICE9PSByYW5nZS5lbmRMaW5lTnVtYmVyO1xuXHRcdFx0Y29uc3QgZW5kQ29sdW1uID0gY29udGludWVzSW5OZXh0TGluZSA/IHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcikgOiByYW5nZS5lbmRDb2x1bW47XG5cblx0XHRcdGNvbnN0IHZpc2libGVSYW5nZXNGb3JMaW5lID0gdGhpcy5fdmlzaWJsZVJhbmdlc0ZvckxpbmVSYW5nZShsaW5lTnVtYmVyLCBzdGFydENvbHVtbiwgZW5kQ29sdW1uKTtcblxuXHRcdFx0aWYgKCF2aXNpYmxlUmFuZ2VzRm9yTGluZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGluY2x1ZGVOZXdMaW5lcyAmJiBsaW5lTnVtYmVyIDwgb3JpZ2luYWxFbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdGNvbnN0IGN1cnJlbnRMaW5lTW9kZWxMaW5lTnVtYmVyID0gbmV4dExpbmVNb2RlbExpbmVOdW1iZXI7XG5cdFx0XHRcdG5leHRMaW5lTW9kZWxMaW5lTnVtYmVyID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbihuZXcgUG9zaXRpb24obGluZU51bWJlciArIDEsIDEpKS5saW5lTnVtYmVyO1xuXG5cdFx0XHRcdGlmIChjdXJyZW50TGluZU1vZGVsTGluZU51bWJlciAhPT0gbmV4dExpbmVNb2RlbExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHR2aXNpYmxlUmFuZ2VzRm9yTGluZS5yYW5nZXNbdmlzaWJsZVJhbmdlc0ZvckxpbmUucmFuZ2VzLmxlbmd0aCAtIDFdLndpZHRoICs9IHZpZXdMaW5lT3B0aW9ucy5zcGFjZVdpZHRoO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHZpc2libGVSYW5nZXMucHVzaChuZXcgTGluZVZpc2libGVSYW5nZXModmlzaWJsZVJhbmdlc0ZvckxpbmUub3V0c2lkZVJlbmRlcmVkTGluZSwgbGluZU51bWJlciwgSG9yaXpvbnRhbFJhbmdlLmZyb20odmlzaWJsZVJhbmdlc0ZvckxpbmUucmFuZ2VzKSwgY29udGludWVzSW5OZXh0TGluZSkpO1xuXHRcdH1cblxuXHRcdGlmICh2aXNpYmxlUmFuZ2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHZpc2libGVSYW5nZXM7XG5cdH1cblxuXHRwcml2YXRlIF92aXNpYmxlUmFuZ2VzRm9yTGluZVJhbmdlKGxpbmVOdW1iZXI6IG51bWJlciwgc3RhcnRDb2x1bW46IG51bWJlciwgZW5kQ29sdW1uOiBudW1iZXIpOiBWaXNpYmxlUmFuZ2VzIHwgbnVsbCB7XG5cdFx0aWYgKHRoaXMuc2hvdWxkUmVuZGVyKCkpIHtcblx0XHRcdC8vIENhbm5vdCByZWFkIGZyb20gdGhlIERPTSBiZWNhdXNlIGl0IGlzIGRpcnR5XG5cdFx0XHQvLyBpLmUuIHRoZSBtb2RlbCAmIHRoZSBkb20gYXJlIG91dCBvZiBzeW5jLCBzbyBJJ2QgYmUgcmVhZGluZyBzb21ldGhpbmcgc3RhbGVcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZpZXdwb3J0RGF0YSA9IHRoaXMuX2xhc3RWaWV3cG9ydERhdGE7XG5cdFx0Y29uc3Qgdmlld0xpbmVPcHRpb25zID0gdGhpcy5fbGFzdFZpZXdMaW5lT3B0aW9ucztcblxuXHRcdGlmICghdmlld3BvcnREYXRhIHx8ICF2aWV3TGluZU9wdGlvbnMgfHwgbGluZU51bWJlciA8IHZpZXdwb3J0RGF0YS5zdGFydExpbmVOdW1iZXIgfHwgbGluZU51bWJlciA+IHZpZXdwb3J0RGF0YS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHQvLyBSZXNvbHZlIHRhYiB3aWR0aHMgZm9yIHRoaXMgbGluZVxuXHRcdGNvbnN0IGxpbmVEYXRhID0gdmlld3BvcnREYXRhLmdldFZpZXdMaW5lUmVuZGVyaW5nRGF0YShsaW5lTnVtYmVyKTtcblx0XHRjb25zdCBjb250ZW50ID0gbGluZURhdGEuY29udGVudDtcblxuXHRcdGxldCBjb250ZW50U2VnbWVudGVyOiBJQ29udGVudFNlZ21lbnRlciB8IHVuZGVmaW5lZDtcblx0XHRpZiAoIShsaW5lRGF0YS5pc0Jhc2ljQVNDSUkgJiYgdmlld0xpbmVPcHRpb25zLnVzZU1vbm9zcGFjZU9wdGltaXphdGlvbnMpKSB7XG5cdFx0XHRjb250ZW50U2VnbWVudGVyID0gY3JlYXRlQ29udGVudFNlZ21lbnRlcihsaW5lRGF0YSwgdmlld0xpbmVPcHRpb25zKTtcblx0XHR9XG5cblx0XHRsZXQgY2hhcnM6IHN0cmluZyB8IHVuZGVmaW5lZCA9ICcnO1xuXG5cdFx0bGV0IHJlc29sdmVkU3RhcnRDb2x1bW4gPSAwO1xuXHRcdGxldCByZXNvbHZlZFN0YXJ0Q3NzUGl4ZWxPZmZzZXQgPSAwO1xuXHRcdGZvciAobGV0IHggPSAwOyB4IDwgc3RhcnRDb2x1bW4gLSAxOyB4KyspIHtcblx0XHRcdGlmIChsaW5lRGF0YS5pc0Jhc2ljQVNDSUkgJiYgdmlld0xpbmVPcHRpb25zLnVzZU1vbm9zcGFjZU9wdGltaXphdGlvbnMpIHtcblx0XHRcdFx0Y2hhcnMgPSBjb250ZW50LmNoYXJBdCh4KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNoYXJzID0gY29udGVudFNlZ21lbnRlciEuZ2V0U2VnbWVudEF0SW5kZXgoeCk7XG5cdFx0XHRcdGlmIChjaGFycyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzb2x2ZWRTdGFydENzc1BpeGVsT2Zmc2V0ICs9ICh0aGlzLl9yZW5kZXJTdHJhdGVneS52YWx1ZSEuZ2x5cGhSYXN0ZXJpemVyLmdldFRleHRNZXRyaWNzKGNoYXJzKS53aWR0aCAvIGdldEFjdGl2ZVdpbmRvdygpLmRldmljZVBpeGVsUmF0aW8pIC0gdmlld0xpbmVPcHRpb25zLnNwYWNlV2lkdGg7XG5cdFx0XHR9XG5cdFx0XHRpZiAoY2hhcnMgPT09ICdcXHQnKSB7XG5cdFx0XHRcdHJlc29sdmVkU3RhcnRDb2x1bW4gPSBDdXJzb3JDb2x1bW5zLm5leHRSZW5kZXJUYWJTdG9wKHJlc29sdmVkU3RhcnRDb2x1bW4sIGxpbmVEYXRhLnRhYlNpemUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzb2x2ZWRTdGFydENvbHVtbisrO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRsZXQgcmVzb2x2ZWRFbmRDb2x1bW4gPSByZXNvbHZlZFN0YXJ0Q29sdW1uO1xuXHRcdGxldCByZXNvbHZlZEVuZENzc1BpeGVsT2Zmc2V0ID0gMDtcblx0XHRmb3IgKGxldCB4ID0gc3RhcnRDb2x1bW4gLSAxOyB4IDwgZW5kQ29sdW1uIC0gMTsgeCsrKSB7XG5cdFx0XHRpZiAobGluZURhdGEuaXNCYXNpY0FTQ0lJICYmIHZpZXdMaW5lT3B0aW9ucy51c2VNb25vc3BhY2VPcHRpbWl6YXRpb25zKSB7XG5cdFx0XHRcdGNoYXJzID0gY29udGVudC5jaGFyQXQoeCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjaGFycyA9IGNvbnRlbnRTZWdtZW50ZXIhLmdldFNlZ21lbnRBdEluZGV4KHgpO1xuXHRcdFx0XHRpZiAoY2hhcnMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc29sdmVkRW5kQ3NzUGl4ZWxPZmZzZXQgKz0gKHRoaXMuX3JlbmRlclN0cmF0ZWd5LnZhbHVlIS5nbHlwaFJhc3Rlcml6ZXIuZ2V0VGV4dE1ldHJpY3MoY2hhcnMpLndpZHRoIC8gZ2V0QWN0aXZlV2luZG93KCkuZGV2aWNlUGl4ZWxSYXRpbykgLSB2aWV3TGluZU9wdGlvbnMuc3BhY2VXaWR0aDtcblx0XHRcdH1cblx0XHRcdGlmIChjaGFycyA9PT0gJ1xcdCcpIHtcblx0XHRcdFx0cmVzb2x2ZWRFbmRDb2x1bW4gPSBDdXJzb3JDb2x1bW5zLm5leHRSZW5kZXJUYWJTdG9wKHJlc29sdmVkRW5kQ29sdW1uLCBsaW5lRGF0YS50YWJTaXplKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc29sdmVkRW5kQ29sdW1uKys7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVmlzaWJsZSBob3Jpem9udGFsIHJhbmdlIGluIF9zY2FsZWRfIHBpeGVsc1xuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBWaXNpYmxlUmFuZ2VzKGZhbHNlLCBbbmV3IEZsb2F0SG9yaXpvbnRhbFJhbmdlKFxuXHRcdFx0cmVzb2x2ZWRTdGFydENvbHVtbiAqIHZpZXdMaW5lT3B0aW9ucy5zcGFjZVdpZHRoICsgcmVzb2x2ZWRTdGFydENzc1BpeGVsT2Zmc2V0LFxuXHRcdFx0KHJlc29sdmVkRW5kQ29sdW1uIC0gcmVzb2x2ZWRTdGFydENvbHVtbikgKiB2aWV3TGluZU9wdGlvbnMuc3BhY2VXaWR0aCArIHJlc29sdmVkRW5kQ3NzUGl4ZWxPZmZzZXQpXG5cdFx0XSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0dmlzaWJsZVJhbmdlRm9yUG9zaXRpb24ocG9zaXRpb246IFBvc2l0aW9uKTogSG9yaXpvbnRhbFBvc2l0aW9uIHwgbnVsbCB7XG5cdFx0Y29uc3QgdmlzaWJsZVJhbmdlcyA9IHRoaXMuX3Zpc2libGVSYW5nZXNGb3JMaW5lUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uLCBwb3NpdGlvbi5jb2x1bW4pO1xuXHRcdGlmICghdmlzaWJsZVJhbmdlcykge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgSG9yaXpvbnRhbFBvc2l0aW9uKHZpc2libGVSYW5nZXMub3V0c2lkZVJlbmRlcmVkTGluZSwgdmlzaWJsZVJhbmdlcy5yYW5nZXNbMF0ubGVmdCk7XG5cdH1cblxuXHRnZXRMaW5lV2lkdGgobGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuX2xhc3RWaWV3cG9ydERhdGEgfHwgIXRoaXMuX2xhc3RWaWV3TGluZU9wdGlvbnMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fdmlld0dwdUNvbnRleHQuY2FuUmVuZGVyKHRoaXMuX2xhc3RWaWV3TGluZU9wdGlvbnMsIHRoaXMuX2xhc3RWaWV3cG9ydERhdGEsIGxpbmVOdW1iZXIpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpbmVEYXRhID0gdGhpcy5fbGFzdFZpZXdwb3J0RGF0YS5nZXRWaWV3TGluZVJlbmRlcmluZ0RhdGEobGluZU51bWJlcik7XG5cdFx0Y29uc3QgbGluZVJhbmdlID0gdGhpcy5fdmlzaWJsZVJhbmdlc0ZvckxpbmVSYW5nZShsaW5lTnVtYmVyLCAxLCBsaW5lRGF0YS5tYXhDb2x1bW4pO1xuXHRcdGNvbnN0IGxhc3RSYW5nZSA9IGxpbmVSYW5nZT8ucmFuZ2VzLmF0KC0xKTtcblx0XHRpZiAobGFzdFJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gbGFzdFJhbmdlLndpZHRoO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXRQb3NpdGlvbkF0Q29vcmRpbmF0ZShsaW5lTnVtYmVyOiBudW1iZXIsIG1vdXNlQ29udGVudEhvcml6b250YWxPZmZzZXQ6IG51bWJlcik6IFBvc2l0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuX2xhc3RWaWV3cG9ydERhdGEgfHwgIXRoaXMuX2xhc3RWaWV3TGluZU9wdGlvbnMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fdmlld0dwdUNvbnRleHQuY2FuUmVuZGVyKHRoaXMuX2xhc3RWaWV3TGluZU9wdGlvbnMsIHRoaXMuX2xhc3RWaWV3cG9ydERhdGEsIGxpbmVOdW1iZXIpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBsaW5lRGF0YSA9IHRoaXMuX2xhc3RWaWV3cG9ydERhdGEuZ2V0Vmlld0xpbmVSZW5kZXJpbmdEYXRhKGxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBsaW5lRGF0YS5jb250ZW50O1xuXHRcdGNvbnN0IGRwciA9IGdldEFjdGl2ZVdpbmRvdygpLmRldmljZVBpeGVsUmF0aW87XG5cdFx0Y29uc3QgbW91c2VDb250ZW50SG9yaXpvbnRhbE9mZnNldERldmljZVBpeGVscyA9IG1vdXNlQ29udGVudEhvcml6b250YWxPZmZzZXQgKiBkcHI7XG5cdFx0Y29uc3Qgc3BhY2VXaWR0aERldmljZVBpeGVscyA9IHRoaXMuX2xhc3RWaWV3TGluZU9wdGlvbnMuc3BhY2VXaWR0aCAqIGRwcjtcblx0XHRjb25zdCBjb250ZW50U2VnbWVudGVyID0gY3JlYXRlQ29udGVudFNlZ21lbnRlcihsaW5lRGF0YSwgdGhpcy5fbGFzdFZpZXdMaW5lT3B0aW9ucyk7XG5cblx0XHRsZXQgd2lkdGhTb0ZhciA9IDA7XG5cdFx0bGV0IGNoYXJXaWR0aCA9IDA7XG5cdFx0bGV0IHRhYlhPZmZzZXQgPSAwO1xuXHRcdGxldCBjb2x1bW4gPSAwO1xuXHRcdGZvciAobGV0IHggPSAwOyB4IDwgY29udGVudC5sZW5ndGg7IHgrKykge1xuXHRcdFx0Y29uc3QgY2hhcnMgPSBjb250ZW50U2VnbWVudGVyLmdldFNlZ21lbnRBdEluZGV4KHgpO1xuXG5cdFx0XHQvLyBQYXJ0IG9mIGFuIGVhcmxpZXIgc2VnbWVudFxuXHRcdFx0aWYgKGNoYXJzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29sdW1uKys7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBHZXQgdGhlIHdpZHRoIG9mIHRoZSBjaGFyYWN0ZXJcblx0XHRcdGlmIChjaGFycyA9PT0gJ1xcdCcpIHtcblx0XHRcdFx0Ly8gRmluZCB0aGUgcGl4ZWwgb2Zmc2V0IGJldHdlZW4gdGhlIGN1cnJlbnQgcG9zaXRpb24gYW5kIHRoZSBuZXh0IHRhYiBzdG9wXG5cdFx0XHRcdGNvbnN0IG9mZnNldEJlZm9yZSA9IHggKyB0YWJYT2Zmc2V0O1xuXHRcdFx0XHR0YWJYT2Zmc2V0ID0gQ3Vyc29yQ29sdW1ucy5uZXh0UmVuZGVyVGFiU3RvcCh4ICsgdGFiWE9mZnNldCwgbGluZURhdGEudGFiU2l6ZSk7XG5cdFx0XHRcdGNoYXJXaWR0aCA9IHNwYWNlV2lkdGhEZXZpY2VQaXhlbHMgKiAodGFiWE9mZnNldCAtIG9mZnNldEJlZm9yZSk7XG5cdFx0XHRcdC8vIENvbnZlcnQgYmFjayB0byBvZmZzZXQgZXhjbHVkaW5nIHggYW5kIHRoZSBjdXJyZW50IGNoYXJhY3RlclxuXHRcdFx0XHR0YWJYT2Zmc2V0IC09IHggKyAxO1xuXHRcdFx0fSBlbHNlIGlmIChsaW5lRGF0YS5pc0Jhc2ljQVNDSUkgJiYgdGhpcy5fbGFzdFZpZXdMaW5lT3B0aW9ucy51c2VNb25vc3BhY2VPcHRpbWl6YXRpb25zKSB7XG5cdFx0XHRcdGNoYXJXaWR0aCA9IHNwYWNlV2lkdGhEZXZpY2VQaXhlbHM7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjaGFyV2lkdGggPSB0aGlzLl9yZW5kZXJTdHJhdGVneS52YWx1ZSEuZ2x5cGhSYXN0ZXJpemVyLmdldFRleHRNZXRyaWNzKGNoYXJzKS53aWR0aDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG1vdXNlQ29udGVudEhvcml6b250YWxPZmZzZXREZXZpY2VQaXhlbHMgPCB3aWR0aFNvRmFyICsgY2hhcldpZHRoIC8gMikge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0d2lkdGhTb0ZhciArPSBjaGFyV2lkdGg7XG5cdFx0XHRjb2x1bW4rKztcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbiArIDEpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsU0FBUyxtQkFBbUI7QUFDckMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBR3RCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsaUJBQTBDO0FBQ25ELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsc0JBQXNCLG9C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
