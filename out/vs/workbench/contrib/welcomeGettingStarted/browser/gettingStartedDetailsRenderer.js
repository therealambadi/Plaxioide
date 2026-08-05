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
import { generateUuid } from "../../../../base/common/uuid.js";
import { generateTokensCSSForColorMap } from "../../../../editor/common/languages/supports/tokenization.js";
import { TokenizationRegistry } from "../../../../editor/common/languages.js";
import { DEFAULT_MARKDOWN_STYLES, renderMarkdownDocument } from "../../markdown/browser/markdownDocumentRenderer.js";
import { language } from "../../../../base/common/platform.js";
import { joinPath } from "../../../../base/common/resources.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { asWebviewUri } from "../../webview/common/webview.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { gettingStartedContentRegistry } from "../common/gettingStartedContent.js";
let GettingStartedDetailsRenderer = class {
  constructor(fileService, notificationService, extensionService, languageService) {
    this.fileService = fileService;
    this.notificationService = notificationService;
    this.extensionService = extensionService;
    this.languageService = languageService;
    this.mdCache = new ResourceMap();
    this.svgCache = new ResourceMap();
  }
  async renderMarkdown(path, base) {
    const content = await this.readAndCacheStepMarkdown(path, base);
    const nonce = generateUuid();
    const colorMap = TokenizationRegistry.getColorMap();
    const css = colorMap ? generateTokensCSSForColorMap(colorMap) : "";
    const inDev = document.location.protocol === "http:";
    const imgSrcCsp = inDev ? "img-src https: data: http:" : "img-src https: data:";
    return `<!DOCTYPE html>
		<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${imgSrcCsp}; media-src https:; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
				<style nonce="${nonce}">
					${DEFAULT_MARKDOWN_STYLES}
					${css}
					body > img {
						align-self: flex-start;
					}
					body > img[centered] {
						align-self: center;
					}
					body {
						display: flex;
						flex-direction: column;
						padding: 0;
						height: inherit;
					}
					.theme-picker-row {
						display: flex;
						justify-content: center;
						gap: 32px;
					}
					checklist {
						display: flex;
						gap: 32px;
						flex-direction: column;
					}
					checkbox {
						display: flex;
						flex-direction: column;
						align-items: center;
						margin: 5px;
						cursor: pointer;
					}
					checkbox > img {
						margin-bottom: 8px !important;
					}
					checkbox.checked > img {
						box-sizing: border-box;
					}
					checkbox.checked > img {
						outline: 2px solid var(--vscode-focusBorder);
						outline-offset: 4px;
						border-radius: 4px;
					}
					.theme-picker-link {
						margin-top: 16px;
						color: var(--vscode-textLink-foreground);
					}
					blockquote > p:first-child {
						margin-top: 0;
					}
					body > * {
						margin-block-end: 0.25em;
						margin-block-start: 0.25em;
					}
					vertically-centered {
						padding-top: 5px;
						padding-bottom: 5px;
						display: flex;
						justify-content: center;
						flex-direction: column;
					}
					html {
						height: 100%;
						padding-right: 32px;
					}
					h1 {
						font-size: 19.5px;
					}
					h2 {
						font-size: 18.5px;
					}
				</style>
			</head>
			<body>
				<vertically-centered>
					${content}
				</vertically-centered>
			</body>
			<script nonce="${nonce}">
				const vscode = acquireVsCodeApi();

				document.querySelectorAll('[when-checked]').forEach(el => {
					el.addEventListener('click', () => {
						vscode.postMessage(el.getAttribute('when-checked'));
					});
				});

				let ongoingLayout = undefined;
				const doLayout = () => {
					document.querySelectorAll('vertically-centered').forEach(element => {
						element.style.marginTop = Math.max((document.body.clientHeight - element.scrollHeight) * 3/10, 0) + 'px';
					});
					ongoingLayout = undefined;
				};

				const layout = () => {
					if (ongoingLayout) {
						clearTimeout(ongoingLayout);
					}
					ongoingLayout = setTimeout(doLayout, 0);
				};

				layout();

				document.querySelectorAll('img').forEach(element => {
					element.onload = layout;
				})

				window.addEventListener('message', event => {
					if (event.data.layoutMeNow) {
						layout();
					}
					if (event.data.enabledContextKeys) {
						document.querySelectorAll('.checked').forEach(element => element.classList.remove('checked'))
						for (const key of event.data.enabledContextKeys) {
							document.querySelectorAll('[checked-on="' + key + '"]').forEach(element => element.classList.add('checked'))
						}
					}
				});
		<\/script>
		</html>`;
  }
  async renderSVG(path) {
    const content = await this.readAndCacheSVGFile(path);
    const nonce = generateUuid();
    const colorMap = TokenizationRegistry.getColorMap();
    const css = colorMap ? generateTokensCSSForColorMap(colorMap) : "";
    return `<!DOCTYPE html>
		<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'nonce-${nonce}';">
				<style nonce="${nonce}">
					${DEFAULT_MARKDOWN_STYLES}
					${css}
					svg {
						position: fixed;
						height: 100%;
						width: 80%;
						left: 50%;
						top: 50%;
						max-width: 530px;
						min-width: 350px;
						transform: translate(-50%,-50%);
					}
				</style>
			</head>
			<body>
				${content}
			</body>
		</html>`;
  }
  async renderVideo(path, poster, description) {
    const nonce = generateUuid();
    return `<!DOCTYPE html>
		<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; media-src https:; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
				<style nonce="${nonce}">
					video {
						max-width: 100%;
						max-height: 100%;
						object-fit: cover;
					}
				</style>
			</head>
			<body>
				<video controls autoplay ${poster ? `poster="${poster.toString(true)}"` : ""} muted ${description ? `aria-label="${description}"` : ""}>
					<source src="${path.toString(true)}" type="video/mp4">
				</video>
			</body>
		</html>`;
  }
  async readAndCacheSVGFile(path) {
    if (!this.svgCache.has(path)) {
      const contents = await this.readContentsOfPath(path, false);
      this.svgCache.set(path, contents);
    }
    return assertIsDefined(this.svgCache.get(path));
  }
  async readAndCacheStepMarkdown(path, base) {
    if (!this.mdCache.has(path)) {
      const contents = await this.readContentsOfPath(path);
      const markdownContents = await renderMarkdownDocument(transformUris(contents, base), this.extensionService, this.languageService, { allowUnknownProtocols: true });
      this.mdCache.set(path, markdownContents);
    }
    return assertIsDefined(this.mdCache.get(path));
  }
  async readContentsOfPath(path, useModuleId = true) {
    try {
      const moduleId = JSON.parse(path.query).moduleId;
      if (useModuleId && moduleId) {
        const contents = await new Promise((resolve, reject) => {
          const provider = gettingStartedContentRegistry.getProvider(moduleId);
          if (!provider) {
            reject(`Getting started: no provider registered for ${moduleId}`);
          } else {
            resolve(provider());
          }
        });
        return contents;
      }
    } catch {
    }
    try {
      const localizedPath = path.with({ path: path.path.replace(/\.md$/, `.nls.${language}.md`) });
      const generalizedLocale = language?.replace(/-.*$/, "");
      const generalizedLocalizedPath = path.with({ path: path.path.replace(/\.md$/, `.nls.${generalizedLocale}.md`) });
      const fileExists = (file) => this.fileService.stat(file).then((stat) => !!stat.size).catch(() => false);
      const [localizedFileExists, generalizedLocalizedFileExists] = await Promise.all([
        fileExists(localizedPath),
        fileExists(generalizedLocalizedPath)
      ]);
      const bytes = await this.fileService.readFile(
        localizedFileExists ? localizedPath : generalizedLocalizedFileExists ? generalizedLocalizedPath : path
      );
      return bytes.value.toString();
    } catch (e) {
      this.notificationService.error("Error reading markdown document at `" + path + "`: " + e);
      return "";
    }
  }
};
GettingStartedDetailsRenderer = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, IExtensionService),
  __decorateParam(3, ILanguageService)
], GettingStartedDetailsRenderer);
const transformUri = (src, base) => {
  const path = joinPath(base, src);
  return asWebviewUri(path).toString(true);
};
const transformUris = (content, base) => content.replace(/src="([^"]*)"/g, (_, src) => {
  if (src.startsWith("https://")) {
    return `src="${src}"`;
  }
  return `src="${transformUri(src, base)}"`;
}).replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_, title, src) => {
  if (src.startsWith("https://")) {
    return `![${title}](${src})`;
  }
  return `![${title}](${transformUri(src, base)})`;
});
export {
  GettingStartedDetailsRenderer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lR2V0dGluZ1N0YXJ0ZWQvYnJvd3Nlci9nZXR0aW5nU3RhcnRlZERldGFpbHNSZW5kZXJlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVUb2tlbnNDU1NGb3JDb2xvck1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL3N1cHBvcnRzL3Rva2VuaXphdGlvbi5qcyc7XG5pbXBvcnQgeyBUb2tlbml6YXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IERFRkFVTFRfTUFSS0RPV05fU1RZTEVTLCByZW5kZXJNYXJrZG93bkRvY3VtZW50IH0gZnJvbSAnLi4vLi4vbWFya2Rvd24vYnJvd3Nlci9tYXJrZG93bkRvY3VtZW50UmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxhbmd1YWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgYXNXZWJ2aWV3VXJpIH0gZnJvbSAnLi4vLi4vd2Vidmlldy9jb21tb24vd2Vidmlldy5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGdldHRpbmdTdGFydGVkQ29udGVudFJlZ2lzdHJ5IH0gZnJvbSAnLi4vY29tbW9uL2dldHRpbmdTdGFydGVkQ29udGVudC5qcyc7XG5cblxuZXhwb3J0IGNsYXNzIEdldHRpbmdTdGFydGVkRGV0YWlsc1JlbmRlcmVyIHtcblx0cHJpdmF0ZSBtZENhY2hlID0gbmV3IFJlc291cmNlTWFwPHN0cmluZz4oKTtcblx0cHJpdmF0ZSBzdmdDYWNoZSA9IG5ldyBSZXNvdXJjZU1hcDxzdHJpbmc+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdCkgeyB9XG5cblx0YXN5bmMgcmVuZGVyTWFya2Rvd24ocGF0aDogVVJJLCBiYXNlOiBVUkkpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnJlYWRBbmRDYWNoZVN0ZXBNYXJrZG93bihwYXRoLCBiYXNlKTtcblx0XHRjb25zdCBub25jZSA9IGdlbmVyYXRlVXVpZCgpO1xuXHRcdGNvbnN0IGNvbG9yTWFwID0gVG9rZW5pemF0aW9uUmVnaXN0cnkuZ2V0Q29sb3JNYXAoKTtcblxuXHRcdGNvbnN0IGNzcyA9IGNvbG9yTWFwID8gZ2VuZXJhdGVUb2tlbnNDU1NGb3JDb2xvck1hcChjb2xvck1hcCkgOiAnJztcblxuXHRcdGNvbnN0IGluRGV2ID0gZG9jdW1lbnQubG9jYXRpb24ucHJvdG9jb2wgPT09ICdodHRwOic7XG5cdFx0Y29uc3QgaW1nU3JjQ3NwID0gaW5EZXYgPyAnaW1nLXNyYyBodHRwczogZGF0YTogaHR0cDonIDogJ2ltZy1zcmMgaHR0cHM6IGRhdGE6JztcblxuXHRcdHJldHVybiBgPCFET0NUWVBFIGh0bWw+XG5cdFx0PGh0bWw+XG5cdFx0XHQ8aGVhZD5cblx0XHRcdFx0PG1ldGEgaHR0cC1lcXVpdj1cIkNvbnRlbnQtdHlwZVwiIGNvbnRlbnQ9XCJ0ZXh0L2h0bWw7Y2hhcnNldD1VVEYtOFwiPlxuXHRcdFx0XHQ8bWV0YSBodHRwLWVxdWl2PVwiQ29udGVudC1TZWN1cml0eS1Qb2xpY3lcIiBjb250ZW50PVwiZGVmYXVsdC1zcmMgJ25vbmUnOyAke2ltZ1NyY0NzcH07IG1lZGlhLXNyYyBodHRwczo7IHNjcmlwdC1zcmMgJ25vbmNlLSR7bm9uY2V9Jzsgc3R5bGUtc3JjICdub25jZS0ke25vbmNlfSc7XCI+XG5cdFx0XHRcdDxzdHlsZSBub25jZT1cIiR7bm9uY2V9XCI+XG5cdFx0XHRcdFx0JHtERUZBVUxUX01BUktET1dOX1NUWUxFU31cblx0XHRcdFx0XHQke2Nzc31cblx0XHRcdFx0XHRib2R5ID4gaW1nIHtcblx0XHRcdFx0XHRcdGFsaWduLXNlbGY6IGZsZXgtc3RhcnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJvZHkgPiBpbWdbY2VudGVyZWRdIHtcblx0XHRcdFx0XHRcdGFsaWduLXNlbGY6IGNlbnRlcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ym9keSB7XG5cdFx0XHRcdFx0XHRkaXNwbGF5OiBmbGV4O1xuXHRcdFx0XHRcdFx0ZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcblx0XHRcdFx0XHRcdHBhZGRpbmc6IDA7XG5cdFx0XHRcdFx0XHRoZWlnaHQ6IGluaGVyaXQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC50aGVtZS1waWNrZXItcm93IHtcblx0XHRcdFx0XHRcdGRpc3BsYXk6IGZsZXg7XG5cdFx0XHRcdFx0XHRqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcblx0XHRcdFx0XHRcdGdhcDogMzJweDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2hlY2tsaXN0IHtcblx0XHRcdFx0XHRcdGRpc3BsYXk6IGZsZXg7XG5cdFx0XHRcdFx0XHRnYXA6IDMycHg7XG5cdFx0XHRcdFx0XHRmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjaGVja2JveCB7XG5cdFx0XHRcdFx0XHRkaXNwbGF5OiBmbGV4O1xuXHRcdFx0XHRcdFx0ZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcblx0XHRcdFx0XHRcdGFsaWduLWl0ZW1zOiBjZW50ZXI7XG5cdFx0XHRcdFx0XHRtYXJnaW46IDVweDtcblx0XHRcdFx0XHRcdGN1cnNvcjogcG9pbnRlcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2hlY2tib3ggPiBpbWcge1xuXHRcdFx0XHRcdFx0bWFyZ2luLWJvdHRvbTogOHB4ICFpbXBvcnRhbnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNoZWNrYm94LmNoZWNrZWQgPiBpbWcge1xuXHRcdFx0XHRcdFx0Ym94LXNpemluZzogYm9yZGVyLWJveDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2hlY2tib3guY2hlY2tlZCA+IGltZyB7XG5cdFx0XHRcdFx0XHRvdXRsaW5lOiAycHggc29saWQgdmFyKC0tdnNjb2RlLWZvY3VzQm9yZGVyKTtcblx0XHRcdFx0XHRcdG91dGxpbmUtb2Zmc2V0OiA0cHg7XG5cdFx0XHRcdFx0XHRib3JkZXItcmFkaXVzOiA0cHg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC50aGVtZS1waWNrZXItbGluayB7XG5cdFx0XHRcdFx0XHRtYXJnaW4tdG9wOiAxNnB4O1xuXHRcdFx0XHRcdFx0Y29sb3I6IHZhcigtLXZzY29kZS10ZXh0TGluay1mb3JlZ3JvdW5kKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YmxvY2txdW90ZSA+IHA6Zmlyc3QtY2hpbGQge1xuXHRcdFx0XHRcdFx0bWFyZ2luLXRvcDogMDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ym9keSA+ICoge1xuXHRcdFx0XHRcdFx0bWFyZ2luLWJsb2NrLWVuZDogMC4yNWVtO1xuXHRcdFx0XHRcdFx0bWFyZ2luLWJsb2NrLXN0YXJ0OiAwLjI1ZW07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHZlcnRpY2FsbHktY2VudGVyZWQge1xuXHRcdFx0XHRcdFx0cGFkZGluZy10b3A6IDVweDtcblx0XHRcdFx0XHRcdHBhZGRpbmctYm90dG9tOiA1cHg7XG5cdFx0XHRcdFx0XHRkaXNwbGF5OiBmbGV4O1xuXHRcdFx0XHRcdFx0anVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG5cdFx0XHRcdFx0XHRmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRodG1sIHtcblx0XHRcdFx0XHRcdGhlaWdodDogMTAwJTtcblx0XHRcdFx0XHRcdHBhZGRpbmctcmlnaHQ6IDMycHg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGgxIHtcblx0XHRcdFx0XHRcdGZvbnQtc2l6ZTogMTkuNXB4O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRoMiB7XG5cdFx0XHRcdFx0XHRmb250LXNpemU6IDE4LjVweDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdDwvc3R5bGU+XG5cdFx0XHQ8L2hlYWQ+XG5cdFx0XHQ8Ym9keT5cblx0XHRcdFx0PHZlcnRpY2FsbHktY2VudGVyZWQ+XG5cdFx0XHRcdFx0JHtjb250ZW50fVxuXHRcdFx0XHQ8L3ZlcnRpY2FsbHktY2VudGVyZWQ+XG5cdFx0XHQ8L2JvZHk+XG5cdFx0XHQ8c2NyaXB0IG5vbmNlPVwiJHtub25jZX1cIj5cblx0XHRcdFx0Y29uc3QgdnNjb2RlID0gYWNxdWlyZVZzQ29kZUFwaSgpO1xuXG5cdFx0XHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1t3aGVuLWNoZWNrZWRdJykuZm9yRWFjaChlbCA9PiB7XG5cdFx0XHRcdFx0ZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHR2c2NvZGUucG9zdE1lc3NhZ2UoZWwuZ2V0QXR0cmlidXRlKCd3aGVuLWNoZWNrZWQnKSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGxldCBvbmdvaW5nTGF5b3V0ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBkb0xheW91dCA9ICgpID0+IHtcblx0XHRcdFx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCd2ZXJ0aWNhbGx5LWNlbnRlcmVkJykuZm9yRWFjaChlbGVtZW50ID0+IHtcblx0XHRcdFx0XHRcdGVsZW1lbnQuc3R5bGUubWFyZ2luVG9wID0gTWF0aC5tYXgoKGRvY3VtZW50LmJvZHkuY2xpZW50SGVpZ2h0IC0gZWxlbWVudC5zY3JvbGxIZWlnaHQpICogMy8xMCwgMCkgKyAncHgnO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdG9uZ29pbmdMYXlvdXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Y29uc3QgbGF5b3V0ID0gKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChvbmdvaW5nTGF5b3V0KSB7XG5cdFx0XHRcdFx0XHRjbGVhclRpbWVvdXQob25nb2luZ0xheW91dCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG9uZ29pbmdMYXlvdXQgPSBzZXRUaW1lb3V0KGRvTGF5b3V0LCAwKTtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRsYXlvdXQoKTtcblxuXHRcdFx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbWcnKS5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuXHRcdFx0XHRcdGVsZW1lbnQub25sb2FkID0gbGF5b3V0O1xuXHRcdFx0XHR9KVxuXG5cdFx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZXZlbnQgPT4ge1xuXHRcdFx0XHRcdGlmIChldmVudC5kYXRhLmxheW91dE1lTm93KSB7XG5cdFx0XHRcdFx0XHRsYXlvdXQoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGV2ZW50LmRhdGEuZW5hYmxlZENvbnRleHRLZXlzKSB7XG5cdFx0XHRcdFx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuY2hlY2tlZCcpLmZvckVhY2goZWxlbWVudCA9PiBlbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2NoZWNrZWQnKSlcblx0XHRcdFx0XHRcdGZvciAoY29uc3Qga2V5IG9mIGV2ZW50LmRhdGEuZW5hYmxlZENvbnRleHRLZXlzKSB7XG5cdFx0XHRcdFx0XHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tjaGVja2VkLW9uPVwiJyArIGtleSArICdcIl0nKS5mb3JFYWNoKGVsZW1lbnQgPT4gZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdjaGVja2VkJykpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHQ8L3NjcmlwdD5cblx0XHQ8L2h0bWw+YDtcblx0fVxuXG5cdGFzeW5jIHJlbmRlclNWRyhwYXRoOiBVUkkpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnJlYWRBbmRDYWNoZVNWR0ZpbGUocGF0aCk7XG5cdFx0Y29uc3Qgbm9uY2UgPSBnZW5lcmF0ZVV1aWQoKTtcblx0XHRjb25zdCBjb2xvck1hcCA9IFRva2VuaXphdGlvblJlZ2lzdHJ5LmdldENvbG9yTWFwKCk7XG5cblx0XHRjb25zdCBjc3MgPSBjb2xvck1hcCA/IGdlbmVyYXRlVG9rZW5zQ1NTRm9yQ29sb3JNYXAoY29sb3JNYXApIDogJyc7XG5cdFx0cmV0dXJuIGA8IURPQ1RZUEUgaHRtbD5cblx0XHQ8aHRtbD5cblx0XHRcdDxoZWFkPlxuXHRcdFx0XHQ8bWV0YSBodHRwLWVxdWl2PVwiQ29udGVudC10eXBlXCIgY29udGVudD1cInRleHQvaHRtbDtjaGFyc2V0PVVURi04XCI+XG5cdFx0XHRcdDxtZXRhIGh0dHAtZXF1aXY9XCJDb250ZW50LVNlY3VyaXR5LVBvbGljeVwiIGNvbnRlbnQ9XCJkZWZhdWx0LXNyYyAnbm9uZSc7IGltZy1zcmMgZGF0YTo7IHN0eWxlLXNyYyAnbm9uY2UtJHtub25jZX0nO1wiPlxuXHRcdFx0XHQ8c3R5bGUgbm9uY2U9XCIke25vbmNlfVwiPlxuXHRcdFx0XHRcdCR7REVGQVVMVF9NQVJLRE9XTl9TVFlMRVN9XG5cdFx0XHRcdFx0JHtjc3N9XG5cdFx0XHRcdFx0c3ZnIHtcblx0XHRcdFx0XHRcdHBvc2l0aW9uOiBmaXhlZDtcblx0XHRcdFx0XHRcdGhlaWdodDogMTAwJTtcblx0XHRcdFx0XHRcdHdpZHRoOiA4MCU7XG5cdFx0XHRcdFx0XHRsZWZ0OiA1MCU7XG5cdFx0XHRcdFx0XHR0b3A6IDUwJTtcblx0XHRcdFx0XHRcdG1heC13aWR0aDogNTMwcHg7XG5cdFx0XHRcdFx0XHRtaW4td2lkdGg6IDM1MHB4O1xuXHRcdFx0XHRcdFx0dHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwtNTAlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdDwvc3R5bGU+XG5cdFx0XHQ8L2hlYWQ+XG5cdFx0XHQ8Ym9keT5cblx0XHRcdFx0JHtjb250ZW50fVxuXHRcdFx0PC9ib2R5PlxuXHRcdDwvaHRtbD5gO1xuXHR9XG5cblx0YXN5bmMgcmVuZGVyVmlkZW8ocGF0aDogVVJJLCBwb3N0ZXI/OiBVUkksIGRlc2NyaXB0aW9uPzogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBub25jZSA9IGdlbmVyYXRlVXVpZCgpO1xuXG5cdFx0cmV0dXJuIGA8IURPQ1RZUEUgaHRtbD5cblx0XHQ8aHRtbD5cblx0XHRcdDxoZWFkPlxuXHRcdFx0XHQ8bWV0YSBodHRwLWVxdWl2PVwiQ29udGVudC10eXBlXCIgY29udGVudD1cInRleHQvaHRtbDtjaGFyc2V0PVVURi04XCI+XG5cdFx0XHRcdDxtZXRhIGh0dHAtZXF1aXY9XCJDb250ZW50LVNlY3VyaXR5LVBvbGljeVwiIGNvbnRlbnQ9XCJkZWZhdWx0LXNyYyAnbm9uZSc7IGltZy1zcmMgaHR0cHM6OyBtZWRpYS1zcmMgaHR0cHM6OyBzY3JpcHQtc3JjICdub25jZS0ke25vbmNlfSc7IHN0eWxlLXNyYyAnbm9uY2UtJHtub25jZX0nO1wiPlxuXHRcdFx0XHQ8c3R5bGUgbm9uY2U9XCIke25vbmNlfVwiPlxuXHRcdFx0XHRcdHZpZGVvIHtcblx0XHRcdFx0XHRcdG1heC13aWR0aDogMTAwJTtcblx0XHRcdFx0XHRcdG1heC1oZWlnaHQ6IDEwMCU7XG5cdFx0XHRcdFx0XHRvYmplY3QtZml0OiBjb3Zlcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdDwvc3R5bGU+XG5cdFx0XHQ8L2hlYWQ+XG5cdFx0XHQ8Ym9keT5cblx0XHRcdFx0PHZpZGVvIGNvbnRyb2xzIGF1dG9wbGF5ICR7cG9zdGVyID8gYHBvc3Rlcj1cIiR7cG9zdGVyLnRvU3RyaW5nKHRydWUpfVwiYCA6ICcnfSBtdXRlZCAke2Rlc2NyaXB0aW9uID8gYGFyaWEtbGFiZWw9XCIke2Rlc2NyaXB0aW9ufVwiYCA6ICcnfT5cblx0XHRcdFx0XHQ8c291cmNlIHNyYz1cIiR7cGF0aC50b1N0cmluZyh0cnVlKX1cIiB0eXBlPVwidmlkZW8vbXA0XCI+XG5cdFx0XHRcdDwvdmlkZW8+XG5cdFx0XHQ8L2JvZHk+XG5cdFx0PC9odG1sPmA7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlYWRBbmRDYWNoZVNWR0ZpbGUocGF0aDogVVJJKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRpZiAoIXRoaXMuc3ZnQ2FjaGUuaGFzKHBhdGgpKSB7XG5cdFx0XHRjb25zdCBjb250ZW50cyA9IGF3YWl0IHRoaXMucmVhZENvbnRlbnRzT2ZQYXRoKHBhdGgsIGZhbHNlKTtcblx0XHRcdHRoaXMuc3ZnQ2FjaGUuc2V0KHBhdGgsIGNvbnRlbnRzKTtcblx0XHR9XG5cdFx0cmV0dXJuIGFzc2VydElzRGVmaW5lZCh0aGlzLnN2Z0NhY2hlLmdldChwYXRoKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlYWRBbmRDYWNoZVN0ZXBNYXJrZG93bihwYXRoOiBVUkksIGJhc2U6IFVSSSk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0aWYgKCF0aGlzLm1kQ2FjaGUuaGFzKHBhdGgpKSB7XG5cdFx0XHRjb25zdCBjb250ZW50cyA9IGF3YWl0IHRoaXMucmVhZENvbnRlbnRzT2ZQYXRoKHBhdGgpO1xuXHRcdFx0Y29uc3QgbWFya2Rvd25Db250ZW50cyA9IGF3YWl0IHJlbmRlck1hcmtkb3duRG9jdW1lbnQodHJhbnNmb3JtVXJpcyhjb250ZW50cywgYmFzZSksIHRoaXMuZXh0ZW5zaW9uU2VydmljZSwgdGhpcy5sYW5ndWFnZVNlcnZpY2UsIHsgYWxsb3dVbmtub3duUHJvdG9jb2xzOiB0cnVlIH0pO1xuXHRcdFx0dGhpcy5tZENhY2hlLnNldChwYXRoLCBtYXJrZG93bkNvbnRlbnRzKTtcblx0XHR9XG5cdFx0cmV0dXJuIGFzc2VydElzRGVmaW5lZCh0aGlzLm1kQ2FjaGUuZ2V0KHBhdGgpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVhZENvbnRlbnRzT2ZQYXRoKHBhdGg6IFVSSSwgdXNlTW9kdWxlSWQgPSB0cnVlKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgbW9kdWxlSWQgPSBKU09OLnBhcnNlKHBhdGgucXVlcnkpLm1vZHVsZUlkO1xuXHRcdFx0aWYgKHVzZU1vZHVsZUlkICYmIG1vZHVsZUlkKSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRlbnRzID0gYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcHJvdmlkZXIgPSBnZXR0aW5nU3RhcnRlZENvbnRlbnRSZWdpc3RyeS5nZXRQcm92aWRlcihtb2R1bGVJZCk7XG5cdFx0XHRcdFx0aWYgKCFwcm92aWRlcikge1xuXHRcdFx0XHRcdFx0cmVqZWN0KGBHZXR0aW5nIHN0YXJ0ZWQ6IG5vIHByb3ZpZGVyIHJlZ2lzdGVyZWQgZm9yICR7bW9kdWxlSWR9YCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJlc29sdmUocHJvdmlkZXIoKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuIGNvbnRlbnRzO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggeyB9XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgbG9jYWxpemVkUGF0aCA9IHBhdGgud2l0aCh7IHBhdGg6IHBhdGgucGF0aC5yZXBsYWNlKC9cXC5tZCQvLCBgLm5scy4ke2xhbmd1YWdlfS5tZGApIH0pO1xuXG5cdFx0XHRjb25zdCBnZW5lcmFsaXplZExvY2FsZSA9IGxhbmd1YWdlPy5yZXBsYWNlKC8tLiokLywgJycpO1xuXHRcdFx0Y29uc3QgZ2VuZXJhbGl6ZWRMb2NhbGl6ZWRQYXRoID0gcGF0aC53aXRoKHsgcGF0aDogcGF0aC5wYXRoLnJlcGxhY2UoL1xcLm1kJC8sIGAubmxzLiR7Z2VuZXJhbGl6ZWRMb2NhbGV9Lm1kYCkgfSk7XG5cblx0XHRcdGNvbnN0IGZpbGVFeGlzdHMgPSAoZmlsZTogVVJJKSA9PiB0aGlzLmZpbGVTZXJ2aWNlXG5cdFx0XHRcdC5zdGF0KGZpbGUpXG5cdFx0XHRcdC50aGVuKChzdGF0KSA9PiAhIXN0YXQuc2l6ZSkgLy8gRG91YmxlIGNoZWNrIHRoZSBmaWxlIGFjdHVhbGx5IGhhcyBjb250ZW50IGZvciBmaWxlU3lzdGVtUHJvdmlkZXJzIHRoYXQgZmFrZSBgc3RhdGAuICMxMzE4MDlcblx0XHRcdFx0LmNhdGNoKCgpID0+IGZhbHNlKTtcblxuXHRcdFx0Y29uc3QgW2xvY2FsaXplZEZpbGVFeGlzdHMsIGdlbmVyYWxpemVkTG9jYWxpemVkRmlsZUV4aXN0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRcdGZpbGVFeGlzdHMobG9jYWxpemVkUGF0aCksXG5cdFx0XHRcdGZpbGVFeGlzdHMoZ2VuZXJhbGl6ZWRMb2NhbGl6ZWRQYXRoKSxcblx0XHRcdF0pO1xuXG5cdFx0XHRjb25zdCBieXRlcyA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVhZEZpbGUoXG5cdFx0XHRcdGxvY2FsaXplZEZpbGVFeGlzdHNcblx0XHRcdFx0XHQ/IGxvY2FsaXplZFBhdGhcblx0XHRcdFx0XHQ6IGdlbmVyYWxpemVkTG9jYWxpemVkRmlsZUV4aXN0c1xuXHRcdFx0XHRcdFx0PyBnZW5lcmFsaXplZExvY2FsaXplZFBhdGhcblx0XHRcdFx0XHRcdDogcGF0aCk7XG5cblx0XHRcdHJldHVybiBieXRlcy52YWx1ZS50b1N0cmluZygpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcignRXJyb3IgcmVhZGluZyBtYXJrZG93biBkb2N1bWVudCBhdCBgJyArIHBhdGggKyAnYDogJyArIGUpO1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0fVxufVxuXG5jb25zdCB0cmFuc2Zvcm1VcmkgPSAoc3JjOiBzdHJpbmcsIGJhc2U6IFVSSSkgPT4ge1xuXHRjb25zdCBwYXRoID0gam9pblBhdGgoYmFzZSwgc3JjKTtcblx0cmV0dXJuIGFzV2Vidmlld1VyaShwYXRoKS50b1N0cmluZyh0cnVlKTtcbn07XG5cbmNvbnN0IHRyYW5zZm9ybVVyaXMgPSAoY29udGVudDogc3RyaW5nLCBiYXNlOiBVUkkpOiBzdHJpbmcgPT4gY29udGVudFxuXHQucmVwbGFjZSgvc3JjPVwiKFteXCJdKilcIi9nLCAoXywgc3JjOiBzdHJpbmcpID0+IHtcblx0XHRpZiAoc3JjLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykpIHsgcmV0dXJuIGBzcmM9XCIke3NyY31cImA7IH1cblx0XHRyZXR1cm4gYHNyYz1cIiR7dHJhbnNmb3JtVXJpKHNyYywgYmFzZSl9XCJgO1xuXHR9KVxuXHQucmVwbGFjZSgvIVxcWyhbXlxcXV0qKVxcXVxcKChbXildKilcXCkvZywgKF8sIHRpdGxlOiBzdHJpbmcsIHNyYzogc3RyaW5nKSA9PiB7XG5cdFx0aWYgKHNyYy5zdGFydHNXaXRoKCdodHRwczovLycpKSB7IHJldHVybiBgIVske3RpdGxlfV0oJHtzcmN9KWA7IH1cblx0XHRyZXR1cm4gYCFbJHt0aXRsZX1dKCR7dHJhbnNmb3JtVXJpKHNyYywgYmFzZSl9KWA7XG5cdH0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG9DQUFvQztBQUM3QyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHlCQUF5Qiw4QkFBOEI7QUFFaEUsU0FBUyxnQkFB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
