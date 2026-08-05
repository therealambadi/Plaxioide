import { getActiveWindow } from "../../../../base/browser/dom.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { URI } from "../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { EditorAction, registerEditorAction } from "../../../browser/editorExtensions.js";
import { ensureNonNullable } from "../../../browser/gpu/gpuUtils.js";
import { GlyphRasterizer } from "../../../browser/gpu/raster/glyphRasterizer.js";
import { ViewGpuContext } from "../../../browser/gpu/viewGpuContext.js";
class DebugEditorGpuRendererAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.debugEditorGpuRenderer",
      label: localize2("gpuDebug.label", "Developer: Debug Editor GPU Renderer"),
      // TODO: Why doesn't `ContextKeyExpr.equals('config:editor.experimentalGpuAcceleration', 'on')` work?
      precondition: ContextKeyExpr.true()
    });
  }
  async run(accessor, editor) {
    const instantiationService = accessor.get(IInstantiationService);
    const quickInputService = accessor.get(IQuickInputService);
    const choice = await quickInputService.pick([
      {
        label: localize("logTextureAtlasStats.label", "Log Texture Atlas Stats"),
        id: "logTextureAtlasStats"
      },
      {
        label: localize("saveTextureAtlas.label", "Save Texture Atlas"),
        id: "saveTextureAtlas"
      },
      {
        label: localize("drawGlyph.label", "Draw Glyph"),
        id: "drawGlyph"
      }
    ], { canPickMany: false });
    if (!choice) {
      return;
    }
    switch (choice.id) {
      case "logTextureAtlasStats":
        instantiationService.invokeFunction((accessor2) => {
          const logService = accessor2.get(ILogService);
          const atlas = ViewGpuContext.atlas;
          if (!ViewGpuContext.atlas) {
            logService.error("No texture atlas found");
            return;
          }
          const stats = atlas.getStats();
          logService.info(["Texture atlas stats", ...stats].join("\n\n"));
        });
        break;
      case "saveTextureAtlas":
        instantiationService.invokeFunction(async (accessor2) => {
          const workspaceContextService = accessor2.get(IWorkspaceContextService);
          const fileService = accessor2.get(IFileService);
          const folders = workspaceContextService.getWorkspace().folders;
          if (folders.length > 0) {
            const atlas = ViewGpuContext.atlas;
            const promises = [];
            for (const [layerIndex, page] of atlas.pages.entries()) {
              promises.push(...[
                fileService.writeFile(
                  URI.joinPath(folders[0].uri, `textureAtlasPage${layerIndex}_actual.png`),
                  VSBuffer.wrap(new Uint8Array(await (await page.source.convertToBlob()).arrayBuffer()))
                ),
                fileService.writeFile(
                  URI.joinPath(folders[0].uri, `textureAtlasPage${layerIndex}_usage.png`),
                  VSBuffer.wrap(new Uint8Array(await (await page.getUsagePreview()).arrayBuffer()))
                )
              ]);
            }
            await Promise.all(promises);
          }
        });
        break;
      case "drawGlyph":
        instantiationService.invokeFunction(async (accessor2) => {
          const configurationService = accessor2.get(IConfigurationService);
          const fileService = accessor2.get(IFileService);
          const quickInputService2 = accessor2.get(IQuickInputService);
          const workspaceContextService = accessor2.get(IWorkspaceContextService);
          const folders = workspaceContextService.getWorkspace().folders;
          if (folders.length === 0) {
            return;
          }
          const atlas = ViewGpuContext.atlas;
          const fontFamily = configurationService.getValue("editor.fontFamily");
          const fontSize = configurationService.getValue("editor.fontSize");
          const rasterizer = new GlyphRasterizer(fontSize, fontFamily, getActiveWindow().devicePixelRatio);
          let chars = await quickInputService2.input({
            prompt: "Enter a character to draw (prefix with 0x for code point))"
          });
          if (!chars) {
            return;
          }
          const codePoint = chars.match(/0x(?<codePoint>[0-9a-f]+)/i)?.groups?.codePoint;
          if (codePoint !== void 0) {
            chars = String.fromCodePoint(parseInt(codePoint, 16));
          }
          const tokenMetadata = 0;
          const charMetadata = 0;
          const rasterizedGlyph = atlas.getGlyph(rasterizer, chars, tokenMetadata, charMetadata, 0);
          if (!rasterizedGlyph) {
            return;
          }
          const imageData = atlas.pages[rasterizedGlyph.pageIndex].source.getContext("2d")?.getImageData(
            rasterizedGlyph.x,
            rasterizedGlyph.y,
            rasterizedGlyph.w,
            rasterizedGlyph.h
          );
          if (!imageData) {
            return;
          }
          const canvas = new OffscreenCanvas(imageData.width, imageData.height);
          const ctx = ensureNonNullable(canvas.getContext("2d"));
          ctx.putImageData(imageData, 0, 0);
          const blob = await canvas.convertToBlob({ type: "image/png" });
          const resource = URI.joinPath(folders[0].uri, `glyph_${chars}_${tokenMetadata}_${fontSize}px_${fontFamily.replaceAll(/[,\\\/\.'\s]/g, "_")}.png`);
          await fileService.writeFile(resource, VSBuffer.wrap(new Uint8Array(await blob.arrayBuffer())));
        });
        break;
    }
  }
}
registerEditorAction(DebugEditorGpuRendererAction);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9ncHUvYnJvd3Nlci9ncHVBY3Rpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZ2V0QWN0aXZlV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHR5cGUgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb24sIHJlZ2lzdGVyRWRpdG9yQWN0aW9uLCB0eXBlIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9uTnVsbGFibGUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2dwdS9ncHVVdGlscy5qcyc7XG5pbXBvcnQgeyBHbHlwaFJhc3Rlcml6ZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2dwdS9yYXN0ZXIvZ2x5cGhSYXN0ZXJpemVyLmpzJztcbmltcG9ydCB7IFZpZXdHcHVDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9ncHUvdmlld0dwdUNvbnRleHQuanMnO1xuXG5jbGFzcyBEZWJ1Z0VkaXRvckdwdVJlbmRlcmVyQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uZGVidWdFZGl0b3JHcHVSZW5kZXJlcicsXG5cdFx0XHRsYWJlbDogbG9jYWxpemUyKCdncHVEZWJ1Zy5sYWJlbCcsIFwiRGV2ZWxvcGVyOiBEZWJ1ZyBFZGl0b3IgR1BVIFJlbmRlcmVyXCIpLFxuXHRcdFx0Ly8gVE9ETzogV2h5IGRvZXNuJ3QgYENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnOmVkaXRvci5leHBlcmltZW50YWxHcHVBY2NlbGVyYXRpb24nLCAnb24nKWAgd29yaz9cblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIudHJ1ZSgpLFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdGNvbnN0IGNob2ljZSA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soW1xuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2xvZ1RleHR1cmVBdGxhc1N0YXRzLmxhYmVsJywgXCJMb2cgVGV4dHVyZSBBdGxhcyBTdGF0c1wiKSxcblx0XHRcdFx0aWQ6ICdsb2dUZXh0dXJlQXRsYXNTdGF0cycsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3NhdmVUZXh0dXJlQXRsYXMubGFiZWwnLCBcIlNhdmUgVGV4dHVyZSBBdGxhc1wiKSxcblx0XHRcdFx0aWQ6ICdzYXZlVGV4dHVyZUF0bGFzJyxcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZHJhd0dseXBoLmxhYmVsJywgXCJEcmF3IEdseXBoXCIpLFxuXHRcdFx0XHRpZDogJ2RyYXdHbHlwaCcsXG5cdFx0XHR9LFxuXHRcdF0sIHsgY2FuUGlja01hbnk6IGZhbHNlIH0pO1xuXHRcdGlmICghY2hvaWNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHN3aXRjaCAoY2hvaWNlLmlkKSB7XG5cdFx0XHRjYXNlICdsb2dUZXh0dXJlQXRsYXNTdGF0cyc6XG5cdFx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IHtcblx0XHRcdFx0XHRjb25zdCBsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKTtcblxuXHRcdFx0XHRcdGNvbnN0IGF0bGFzID0gVmlld0dwdUNvbnRleHQuYXRsYXM7XG5cdFx0XHRcdFx0aWYgKCFWaWV3R3B1Q29udGV4dC5hdGxhcykge1xuXHRcdFx0XHRcdFx0bG9nU2VydmljZS5lcnJvcignTm8gdGV4dHVyZSBhdGxhcyBmb3VuZCcpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHN0YXRzID0gYXRsYXMuZ2V0U3RhdHMoKTtcblx0XHRcdFx0XHRsb2dTZXJ2aWNlLmluZm8oWydUZXh0dXJlIGF0bGFzIHN0YXRzJywgLi4uc3RhdHNdLmpvaW4oJ1xcblxcbicpKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnc2F2ZVRleHR1cmVBdGxhcyc6XG5cdFx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFzeW5jIGFjY2Vzc29yID0+IHtcblx0XHRcdFx0XHRjb25zdCB3b3Jrc3BhY2VDb250ZXh0U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UpO1xuXHRcdFx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3QgZm9sZGVycyA9IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnM7XG5cdFx0XHRcdFx0aWYgKGZvbGRlcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgYXRsYXMgPSBWaWV3R3B1Q29udGV4dC5hdGxhcztcblx0XHRcdFx0XHRcdGNvbnN0IHByb21pc2VzID0gW107XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IFtsYXllckluZGV4LCBwYWdlXSBvZiBhdGxhcy5wYWdlcy5lbnRyaWVzKCkpIHtcblx0XHRcdFx0XHRcdFx0cHJvbWlzZXMucHVzaCguLi5bXG5cdFx0XHRcdFx0XHRcdFx0ZmlsZVNlcnZpY2Uud3JpdGVGaWxlKFxuXHRcdFx0XHRcdFx0XHRcdFx0VVJJLmpvaW5QYXRoKGZvbGRlcnNbMF0udXJpLCBgdGV4dHVyZUF0bGFzUGFnZSR7bGF5ZXJJbmRleH1fYWN0dWFsLnBuZ2ApLFxuXHRcdFx0XHRcdFx0XHRcdFx0VlNCdWZmZXIud3JhcChuZXcgVWludDhBcnJheShhd2FpdCAoYXdhaXQgcGFnZS5zb3VyY2UuY29udmVydFRvQmxvYigpKS5hcnJheUJ1ZmZlcigpKSlcblx0XHRcdFx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdFx0XHRcdGZpbGVTZXJ2aWNlLndyaXRlRmlsZShcblx0XHRcdFx0XHRcdFx0XHRcdFVSSS5qb2luUGF0aChmb2xkZXJzWzBdLnVyaSwgYHRleHR1cmVBdGxhc1BhZ2Uke2xheWVySW5kZXh9X3VzYWdlLnBuZ2ApLFxuXHRcdFx0XHRcdFx0XHRcdFx0VlNCdWZmZXIud3JhcChuZXcgVWludDhBcnJheShhd2FpdCAoYXdhaXQgcGFnZS5nZXRVc2FnZVByZXZpZXcoKSkuYXJyYXlCdWZmZXIoKSkpXG5cdFx0XHRcdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRcdFx0XSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdkcmF3R2x5cGgnOlxuXHRcdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhc3luYyBhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0XHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlQ29udGV4dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblxuXHRcdFx0XHRcdGNvbnN0IGZvbGRlcnMgPSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzO1xuXHRcdFx0XHRcdGlmIChmb2xkZXJzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IGF0bGFzID0gVmlld0dwdUNvbnRleHQuYXRsYXM7XG5cdFx0XHRcdFx0Y29uc3QgZm9udEZhbWlseSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4oJ2VkaXRvci5mb250RmFtaWx5Jyk7XG5cdFx0XHRcdFx0Y29uc3QgZm9udFNpemUgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KCdlZGl0b3IuZm9udFNpemUnKTtcblx0XHRcdFx0XHRjb25zdCByYXN0ZXJpemVyID0gbmV3IEdseXBoUmFzdGVyaXplcihmb250U2l6ZSwgZm9udEZhbWlseSwgZ2V0QWN0aXZlV2luZG93KCkuZGV2aWNlUGl4ZWxSYXRpbyk7XG5cdFx0XHRcdFx0bGV0IGNoYXJzID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UuaW5wdXQoe1xuXHRcdFx0XHRcdFx0cHJvbXB0OiAnRW50ZXIgYSBjaGFyYWN0ZXIgdG8gZHJhdyAocHJlZml4IHdpdGggMHggZm9yIGNvZGUgcG9pbnQpKSdcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRpZiAoIWNoYXJzKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IGNvZGVQb2ludCA9IGNoYXJzLm1hdGNoKC8weCg/PGNvZGVQb2ludD5bMC05YS1mXSspL2kpPy5ncm91cHM/LmNvZGVQb2ludDtcblx0XHRcdFx0XHRpZiAoY29kZVBvaW50ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdGNoYXJzID0gU3RyaW5nLmZyb21Db2RlUG9pbnQocGFyc2VJbnQoY29kZVBvaW50LCAxNikpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCB0b2tlbk1ldGFkYXRhID0gMDtcblx0XHRcdFx0XHRjb25zdCBjaGFyTWV0YWRhdGEgPSAwO1xuXHRcdFx0XHRcdGNvbnN0IHJhc3Rlcml6ZWRHbHlwaCA9IGF0bGFzLmdldEdseXBoKHJhc3Rlcml6ZXIsIGNoYXJzLCB0b2tlbk1ldGFkYXRhLCBjaGFyTWV0YWRhdGEsIDApO1xuXHRcdFx0XHRcdGlmICghcmFzdGVyaXplZEdseXBoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IGltYWdlRGF0YSA9IGF0bGFzLnBhZ2VzW3Jhc3Rlcml6ZWRHbHlwaC5wYWdlSW5kZXhdLnNvdXJjZS5nZXRDb250ZXh0KCcyZCcpPy5nZXRJbWFnZURhdGEoXG5cdFx0XHRcdFx0XHRyYXN0ZXJpemVkR2x5cGgueCxcblx0XHRcdFx0XHRcdHJhc3Rlcml6ZWRHbHlwaC55LFxuXHRcdFx0XHRcdFx0cmFzdGVyaXplZEdseXBoLncsXG5cdFx0XHRcdFx0XHRyYXN0ZXJpemVkR2x5cGguaFxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0aWYgKCFpbWFnZURhdGEpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgY2FudmFzID0gbmV3IE9mZnNjcmVlbkNhbnZhcyhpbWFnZURhdGEud2lkdGgsIGltYWdlRGF0YS5oZWlnaHQpO1xuXHRcdFx0XHRcdGNvbnN0IGN0eCA9IGVuc3VyZU5vbk51bGxhYmxlKGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpKTtcblx0XHRcdFx0XHRjdHgucHV0SW1hZ2VEYXRhKGltYWdlRGF0YSwgMCwgMCk7XG5cdFx0XHRcdFx0Y29uc3QgYmxvYiA9IGF3YWl0IGNhbnZhcy5jb252ZXJ0VG9CbG9iKHsgdHlwZTogJ2ltYWdlL3BuZycgfSk7XG5cdFx0XHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuam9pblBhdGgoZm9sZGVyc1swXS51cmksIGBnbHlwaF8ke2NoYXJzfV8ke3Rva2VuTWV0YWRhdGF9XyR7Zm9udFNpemV9cHhfJHtmb250RmFtaWx5LnJlcGxhY2VBbGwoL1ssXFxcXFxcL1xcLidcXHNdL2csICdfJyl9LnBuZ2ApO1xuXHRcdFx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZShyZXNvdXJjZSwgVlNCdWZmZXIud3JhcChuZXcgVWludDhBcnJheShhd2FpdCBibG9iLmFycmF5QnVmZmVyKCkpKSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH1cbn1cblxucmVnaXN0ZXJFZGl0b3JBY3Rpb24oRGVidWdFZGl0b3JHcHVSZW5kZXJlckFjdGlvbik7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQVc7QUFDcEIsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG9CQUFv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LGNBQWNBLFVBQVMsSUFBSSxZQUFZO0FBQzdDLGdCQUFNQyxxQkFBb0JELFVBQVMsSUFBSSxrQkFBa0I7QUFDekQsZ0JBQU0sMEJBQTBCQSxVQUFTLElBQUksd0JBQXdCO0FBRXJFLGdCQUFNLFVBQVUsd0JBQXdCLGFBQWEsRUFBRTtBQUN2RCxjQUFJLFFBQVEsV0FBVyxHQUFHO0FBQ3pCO0FBQUEsVUFDRDtBQUVBLGdCQUFNLFFBQVEsZUFBZTtBQUM3QixnQkFBTSxhQUFhLHFCQUFxQixTQUFpQixtQkFBbUI7QUFDNUUsZ0JBQU0sV0FBVyxxQkFBcUIsU0FBaUIsaUJBQWlCO0FBQ3hFLGdCQUFNLGFBQWEsSUFBSSxnQkFBZ0IsVUFBVSxZQUFZLGdCQUFnQixFQUFFLGdCQUFnQjtBQUMvRixjQUFJLFFBQVEsTUFBTUMsbUJBQWtCLE1BQU07QUFBQSxZQUN6QyxRQUFRO0FBQUEsVUFDVCxDQUFDO0FBQ0QsY0FBSSxDQUFDLE9BQU87QUFDWDtBQUFBLFVBQ0Q7QUFDQSxnQkFBTSxZQUFZLE1BQU0sTUFBTSw0QkFBNEIsR0FBRyxRQUFRO0FBQ3JFLGNBQUksY0FBYyxRQUFXO0FBQzVCLG9CQUFRLE9BQU8sY0FBYyxTQUFTLFdBQVcsRUFBRSxDQUFDO0FBQUEsVUFDckQ7QUFDQSxnQkFBTSxnQkFBZ0I7QUFDdEIsZ0JBQU0sZUFBZTtBQUNyQixnQkFBTSxrQkFBa0IsTUFBTSxTQUFTLFlBQVksT0FBTyxlQUFlLGNBQWMsQ0FBQztBQUN4RixjQUFJLENBQUMsaUJBQWlCO0FBQ3JCO0FBQUEsVUFDRDtBQUNBLGdCQUFNLFlBQVksTUFBTSxNQUFNLGdCQUFnQixTQUFTLEVBQUUsT0FBTyxXQUFXLElBQUksR0FBRztBQUFBLFlBQ2pGLGdCQUFnQjtBQUFBLFlBQ2hCLGdCQUFnQjtBQUFBLFlBQ2hCLGdCQUFnQjtBQUFBLFlBQ2hCLGdCQUFnQjtBQUFBLFVBQ2pCO0FBQ0EsY0FBSSxDQUFDLFdBQVc7QUFDZjtBQUFBLFVBQ0Q7QUFDQSxnQkFBTSxTQUFTLElBQUksZ0JBQWdCLFVBQVUsT0FBTyxVQUFVLE1BQU07QUFDcEUsZ0JBQU0sTUFBTSxrQkFBa0IsT0FBTyxXQUFXLElBQUksQ0FBQztBQUNyRCxjQUFJLGFBQWEsV0FBVyxHQUFHLENBQUM7QUFDaEMsZ0JBQU0sT0FBTyxNQUFNLE9BQU8sY0FBYyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzdELGdCQUFNLFdBQVcsSUFBSSxTQUFTLFFBQVEsQ0FBQyxFQUFFLEtBQUssU0FBUyxLQUFLLElBQUksYUFBYSxJQUFJLFFBQVEsTUFBTSxXQUFXLFdBQVcsaUJBQWlCLEdBQUcsQ0FBQyxNQUFNO0FBQ2hKLGdCQUFNLFlBQVksVUFBVSxVQUFVLFNBQVMsS0FBSyxJQUFJLFdBQVcsTUFBTSxLQUFLLFlBQVksQ0FBQyxDQUFDLENBQUM7QUFBQSxRQUM5RixDQUFDO0FBQ0Q7QUFBQSxJQUNGO0FBQUEsRUFDRDtBQUNEO0FBRUEscUJBQXFCLDRCQUE0QjsiLAogICJuYW1lcyI6IFsiYWNjZXNzb3IiLCAicXVpY2tJbnB1dFNlcnZpY2UiXQp9Cg==
