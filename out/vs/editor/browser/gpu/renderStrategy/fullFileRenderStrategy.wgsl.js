import { TextureAtlas } from "../atlas/textureAtlas.js";
import { TextureAtlasPage } from "../atlas/textureAtlasPage.js";
import { BindingId } from "../gpu.js";
const fullFileRenderStrategyWgsl = (
  /*wgsl*/
  `
struct GlyphInfo {
	position: vec2f,
	size: vec2f,
	origin: vec2f,
};

struct Vertex {
	@location(0) position: vec2f,
};

struct Cell {
	position: vec2f,
	unused1: vec2f,
	glyphIndex: f32,
	textureIndex: f32
};

struct LayoutInfo {
	canvasDims: vec2f,
	viewportOffset: vec2f,
	viewportDims: vec2f,
}

struct ScrollOffset {
	offset: vec2f
}

struct VSOutput {
	@builtin(position) position:   vec4f,
	@location(1)       layerIndex: f32,
	@location(0)       texcoord:   vec2f,
};

// Uniforms
@group(0) @binding(${BindingId.LayoutInfoUniform})       var<uniform>       layoutInfo:      LayoutInfo;
@group(0) @binding(${BindingId.AtlasDimensionsUniform})  var<uniform>       atlasDims:       vec2f;
@group(0) @binding(${BindingId.ScrollOffset})            var<uniform>       scrollOffset:    ScrollOffset;

// Storage buffers
@group(0) @binding(${BindingId.GlyphInfo})               var<storage, read> glyphInfo:       array<array<GlyphInfo, ${TextureAtlasPage.maximumGlyphCount}>, ${TextureAtlas.maximumPageCount}>;
@group(0) @binding(${BindingId.Cells})                   var<storage, read> cells:           array<Cell>;

@vertex fn vs(
	vert: Vertex,
	@builtin(instance_index) instanceIndex: u32,
	@builtin(vertex_index) vertexIndex : u32
) -> VSOutput {
	let cell = cells[instanceIndex];
	var glyph = glyphInfo[u32(cell.textureIndex)][u32(cell.glyphIndex)];

	var vsOut: VSOutput;
	// Multiple vert.position by 2,-2 to get it into clipspace which ranged from -1 to 1
	vsOut.position = vec4f(
		// Make everything relative to top left instead of center
		vec2f(-1, 1) +
		((vert.position * vec2f(2, -2)) / layoutInfo.canvasDims) * glyph.size +
		((cell.position * vec2f(2, -2)) / layoutInfo.canvasDims) +
		((glyph.origin * vec2f(2, -2)) / layoutInfo.canvasDims) +
		(((layoutInfo.viewportOffset - scrollOffset.offset * vec2(1, -1)) * 2) / layoutInfo.canvasDims),
		0.0,
		1.0
	);

	vsOut.layerIndex = cell.textureIndex;
	// Textures are flipped from natural direction on the y-axis, so flip it back
	vsOut.texcoord = vert.position;
	vsOut.texcoord = (
		// Glyph offset (0-1)
		(glyph.position / atlasDims) +
		// Glyph coordinate (0-1)
		(vsOut.texcoord * (glyph.size / atlasDims))
	);

	return vsOut;
}

@group(0) @binding(${BindingId.TextureSampler}) var ourSampler: sampler;
@group(0) @binding(${BindingId.Texture})        var ourTexture: texture_2d_array<f32>;

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
	return textureSample(ourTexture, ourSampler, vsOut.texcoord, u32(vsOut.layerIndex));
}
`
);
export {
  fullFileRenderStrategyWgsl
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9ncHUvcmVuZGVyU3RyYXRlZ3kvZnVsbEZpbGVSZW5kZXJTdHJhdGVneS53Z3NsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVGV4dHVyZUF0bGFzIH0gZnJvbSAnLi4vYXRsYXMvdGV4dHVyZUF0bGFzLmpzJztcbmltcG9ydCB7IFRleHR1cmVBdGxhc1BhZ2UgfSBmcm9tICcuLi9hdGxhcy90ZXh0dXJlQXRsYXNQYWdlLmpzJztcbmltcG9ydCB7IEJpbmRpbmdJZCB9IGZyb20gJy4uL2dwdS5qcyc7XG5cbmV4cG9ydCBjb25zdCBmdWxsRmlsZVJlbmRlclN0cmF0ZWd5V2dzbCA9IC8qd2dzbCovIGBcbnN0cnVjdCBHbHlwaEluZm8ge1xuXHRwb3NpdGlvbjogdmVjMmYsXG5cdHNpemU6IHZlYzJmLFxuXHRvcmlnaW46IHZlYzJmLFxufTtcblxuc3RydWN0IFZlcnRleCB7XG5cdEBsb2NhdGlvbigwKSBwb3NpdGlvbjogdmVjMmYsXG59O1xuXG5zdHJ1Y3QgQ2VsbCB7XG5cdHBvc2l0aW9uOiB2ZWMyZixcblx0dW51c2VkMTogdmVjMmYsXG5cdGdseXBoSW5kZXg6IGYzMixcblx0dGV4dHVyZUluZGV4OiBmMzJcbn07XG5cbnN0cnVjdCBMYXlvdXRJbmZvIHtcblx0Y2FudmFzRGltczogdmVjMmYsXG5cdHZpZXdwb3J0T2Zmc2V0OiB2ZWMyZixcblx0dmlld3BvcnREaW1zOiB2ZWMyZixcbn1cblxuc3RydWN0IFNjcm9sbE9mZnNldCB7XG5cdG9mZnNldDogdmVjMmZcbn1cblxuc3RydWN0IFZTT3V0cHV0IHtcblx0QGJ1aWx0aW4ocG9zaXRpb24pIHBvc2l0aW9uOiAgIHZlYzRmLFxuXHRAbG9jYXRpb24oMSkgICAgICAgbGF5ZXJJbmRleDogZjMyLFxuXHRAbG9jYXRpb24oMCkgICAgICAgdGV4Y29vcmQ6ICAgdmVjMmYsXG59O1xuXG4vLyBVbmlmb3Jtc1xuQGdyb3VwKDApIEBiaW5kaW5nKCR7QmluZGluZ0lkLkxheW91dEluZm9Vbmlmb3JtfSkgICAgICAgdmFyPHVuaWZvcm0+ICAgICAgIGxheW91dEluZm86ICAgICAgTGF5b3V0SW5mbztcbkBncm91cCgwKSBAYmluZGluZygke0JpbmRpbmdJZC5BdGxhc0RpbWVuc2lvbnNVbmlmb3JtfSkgIHZhcjx1bmlmb3JtPiAgICAgICBhdGxhc0RpbXM6ICAgICAgIHZlYzJmO1xuQGdyb3VwKDApIEBiaW5kaW5nKCR7QmluZGluZ0lkLlNjcm9sbE9mZnNldH0pICAgICAgICAgICAgdmFyPHVuaWZvcm0+ICAgICAgIHNjcm9sbE9mZnNldDogICAgU2Nyb2xsT2Zmc2V0O1xuXG4vLyBTdG9yYWdlIGJ1ZmZlcnNcbkBncm91cCgwKSBAYmluZGluZygke0JpbmRpbmdJZC5HbHlwaEluZm99KSAgICAgICAgICAgICAgIHZhcjxzdG9yYWdlLCByZWFkPiBnbHlwaEluZm86ICAgICAgIGFycmF5PGFycmF5PEdseXBoSW5mbywgJHtUZXh0dXJlQXRsYXNQYWdlLm1heGltdW1HbHlwaENvdW50fT4sICR7VGV4dHVyZUF0bGFzLm1heGltdW1QYWdlQ291bnR9PjtcbkBncm91cCgwKSBAYmluZGluZygke0JpbmRpbmdJZC5DZWxsc30pICAgICAgICAgICAgICAgICAgIHZhcjxzdG9yYWdlLCByZWFkPiBjZWxsczogICAgICAgICAgIGFycmF5PENlbGw+O1xuXG5AdmVydGV4IGZuIHZzKFxuXHR2ZXJ0OiBWZXJ0ZXgsXG5cdEBidWlsdGluKGluc3RhbmNlX2luZGV4KSBpbnN0YW5jZUluZGV4OiB1MzIsXG5cdEBidWlsdGluKHZlcnRleF9pbmRleCkgdmVydGV4SW5kZXggOiB1MzJcbikgLT4gVlNPdXRwdXQge1xuXHRsZXQgY2VsbCA9IGNlbGxzW2luc3RhbmNlSW5kZXhdO1xuXHR2YXIgZ2x5cGggPSBnbHlwaEluZm9bdTMyKGNlbGwudGV4dHVyZUluZGV4KV1bdTMyKGNlbGwuZ2x5cGhJbmRleCldO1xuXG5cdHZhciB2c091dDogVlNPdXRwdXQ7XG5cdC8vIE11bHRpcGxlIHZlcnQucG9zaXRpb24gYnkgMiwtMiB0byBnZXQgaXQgaW50byBjbGlwc3BhY2Ugd2hpY2ggcmFuZ2VkIGZyb20gLTEgdG8gMVxuXHR2c091dC5wb3NpdGlvbiA9IHZlYzRmKFxuXHRcdC8vIE1ha2UgZXZlcnl0aGluZyByZWxhdGl2ZSB0byB0b3AgbGVmdCBpbnN0ZWFkIG9mIGNlbnRlclxuXHRcdHZlYzJmKC0xLCAxKSArXG5cdFx0KCh2ZXJ0LnBvc2l0aW9uICogdmVjMmYoMiwgLTIpKSAvIGxheW91dEluZm8uY2FudmFzRGltcykgKiBnbHlwaC5zaXplICtcblx0XHQoKGNlbGwucG9zaXRpb24gKiB2ZWMyZigyLCAtMikpIC8gbGF5b3V0SW5mby5jYW52YXNEaW1zKSArXG5cdFx0KChnbHlwaC5vcmlnaW4gKiB2ZWMyZigyLCAtMikpIC8gbGF5b3V0SW5mby5jYW52YXNEaW1zKSArXG5cdFx0KCgobGF5b3V0SW5mby52aWV3cG9ydE9mZnNldCAtIHNjcm9sbE9mZnNldC5vZmZzZXQgKiB2ZWMyKDEsIC0xKSkgKiAyKSAvIGxheW91dEluZm8uY2FudmFzRGltcyksXG5cdFx0MC4wLFxuXHRcdDEuMFxuXHQpO1xuXG5cdHZzT3V0LmxheWVySW5kZXggPSBjZWxsLnRleHR1cmVJbmRleDtcblx0Ly8gVGV4dHVyZXMgYXJlIGZsaXBwZWQgZnJvbSBuYXR1cmFsIGRpcmVjdGlvbiBvbiB0aGUgeS1heGlzLCBzbyBmbGlwIGl0IGJhY2tcblx0dnNPdXQudGV4Y29vcmQgPSB2ZXJ0LnBvc2l0aW9uO1xuXHR2c091dC50ZXhjb29yZCA9IChcblx0XHQvLyBHbHlwaCBvZmZzZXQgKDAtMSlcblx0XHQoZ2x5cGgucG9zaXRpb24gLyBhdGxhc0RpbXMpICtcblx0XHQvLyBHbHlwaCBjb29yZGluYXRlICgwLTEpXG5cdFx0KHZzT3V0LnRleGNvb3JkICogKGdseXBoLnNpemUgLyBhdGxhc0RpbXMpKVxuXHQpO1xuXG5cdHJldHVybiB2c091dDtcbn1cblxuQGdyb3VwKDApIEBiaW5kaW5nKCR7QmluZGluZ0lkLlRleHR1cmVTYW1wbGVyfSkgdmFyIG91clNhbXBsZXI6IHNhbXBsZXI7XG5AZ3JvdXAoMCkgQGJpbmRpbmcoJHtCaW5kaW5nSWQuVGV4dHVyZX0pICAgICAgICB2YXIgb3VyVGV4dHVyZTogdGV4dHVyZV8yZF9hcnJheTxmMzI+O1xuXG5AZnJhZ21lbnQgZm4gZnModnNPdXQ6IFZTT3V0cHV0KSAtPiBAbG9jYXRpb24oMCkgdmVjNGYge1xuXHRyZXR1cm4gdGV4dHVyZVNhbXBsZShvdXJUZXh0dXJlLCBvdXJTYW1wbGVyLCB2c091dC50ZXhjb29yZCwgdTMyKHZzT3V0LmxheWVySW5kZXgpKTtcbn1cbmA7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGlCQUFpQjtBQUVuQixNQUFNO0FBQUE7QUFBQSxFQUFzQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBbUM5QixVQUFVLGlCQUFpQjtBQUFBLHFCQUMzQixVQUFVLHNCQUFzQjtBQUFBLHFCQUNoQyxVQUFVLFlBQVk7QUFBQTtBQUFBO0FBQUEscUJBR3RCLFVBQVUsU0FBUyw4RUFBOEUsaUJBQWlCLGlCQUFpQixNQUFNLGFBQWEsZ0JBQWdCO0FBQUEscUJBQ3RLLFVBQVUsS0FBSztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFvQ2YsVUFBVSxjQUFjO0FBQUEscUJBQ3hCLFVBQVUsT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTsiLAogICJuYW1lcyI6IFtdCn0K
