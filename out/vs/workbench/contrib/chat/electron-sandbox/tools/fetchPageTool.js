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
import { localize } from "../../../../../nls.js";
import { URI } from "../../../../../base/common/uri.js";
import { IWebContentExtractorService } from "../../../../../platform/webContentExtractor/common/webContentExtractor.js";
import { ITrustedDomainService } from "../../../url/browser/trustedDomainService.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { InternalFetchWebPageToolId } from "../../common/tools/tools.js";
const FetchWebPageToolData = {
  id: InternalFetchWebPageToolId,
  displayName: "Fetch Web Page",
  canBeReferencedInPrompt: false,
  modelDescription: localize("fetchWebPage.modelDescription", "Fetches the main content from a web page. This tool is useful for summarizing or analyzing the content of a webpage."),
  source: { type: "internal" },
  inputSchema: {
    type: "object",
    properties: {
      urls: {
        type: "array",
        items: {
          type: "string"
        },
        description: localize("fetchWebPage.urlsDescription", "An array of URLs to fetch content from.")
      }
    },
    required: ["urls"]
  }
};
let FetchWebPageTool = class {
  constructor(_readerModeService, _trustedDomainService) {
    this._readerModeService = _readerModeService;
    this._trustedDomainService = _trustedDomainService;
    this._alreadyApprovedDomains = /* @__PURE__ */ new Set();
  }
  async invoke(invocation, _countTokens, _token) {
    const parsedUriResults = this._parseUris(invocation.parameters.urls);
    const validUris = Array.from(parsedUriResults.values()).filter((uri) => !!uri);
    if (!validUris.length) {
      return {
        content: [{ kind: "text", value: localize("fetchWebPage.noValidUrls", "No valid URLs provided.") }]
      };
    }
    for (const uri of validUris) {
      if (!this._trustedDomainService.isValid(uri)) {
        this._alreadyApprovedDomains.add(uri.toString(true));
      }
    }
    const contents = await this._readerModeService.extract(validUris);
    const contentsWithUndefined = [];
    let indexInContents = 0;
    parsedUriResults.forEach((uri) => {
      if (uri) {
        contentsWithUndefined.push(contents[indexInContents]);
        indexInContents++;
      } else {
        contentsWithUndefined.push(void 0);
      }
    });
    return { content: this._getPromptPartsForResults(contentsWithUndefined) };
  }
  async prepareToolInvocation(parameters, token) {
    const map = this._parseUris(parameters.urls);
    const invalid = new Array();
    const valid = new Array();
    map.forEach((uri, url) => {
      if (!uri) {
        invalid.push(url);
      } else {
        valid.push(uri);
      }
    });
    const urlsNeedingConfirmation = valid.filter((url) => !this._trustedDomainService.isValid(url) && !this._alreadyApprovedDomains.has(url.toString(true)));
    const pastTenseMessage = invalid.length ? invalid.length > 1 ? new MarkdownString(
      localize(
        "fetchWebPage.pastTenseMessage.plural",
        "Fetched {0} web pages, but the following were invalid URLs:\n\n{1}\n\n",
        valid.length,
        invalid.map((url) => `- ${url}`).join("\n")
      )
    ) : new MarkdownString(
      localize(
        "fetchWebPage.pastTenseMessage.singular",
        "Fetched web page, but the following was an invalid URL:\n\n{0}\n\n",
        invalid[0]
      )
    ) : new MarkdownString();
    const invocationMessage = new MarkdownString();
    if (valid.length > 1) {
      pastTenseMessage.appendMarkdown(localize("fetchWebPage.pastTenseMessageResult.plural", "Fetched {0} web pages", valid.length));
      invocationMessage.appendMarkdown(localize("fetchWebPage.invocationMessage.plural", "Fetching {0} web pages", valid.length));
    } else {
      const url = valid[0].toString();
      if (url.length > 400) {
        pastTenseMessage.appendMarkdown(localize({
          key: "fetchWebPage.pastTenseMessageResult.singularAsLink",
          comment: [
            // Make sure the link syntax is correct
            '{Locked="]({0})"}'
          ]
        }, "Fetched [web page]({0})", url));
        invocationMessage.appendMarkdown(localize({
          key: "fetchWebPage.invocationMessage.singularAsLink",
          comment: [
            // Make sure the link syntax is correct
            '{Locked="]({0})"}'
          ]
        }, "Fetching [web page]({0})", url));
      } else {
        pastTenseMessage.appendMarkdown(localize("fetchWebPage.pastTenseMessageResult.singular", "Fetched {0}", url));
        invocationMessage.appendMarkdown(localize("fetchWebPage.invocationMessage.singular", "Fetching {0}", url));
      }
    }
    const result = { invocationMessage, pastTenseMessage };
    if (urlsNeedingConfirmation.length) {
      const confirmationTitle = urlsNeedingConfirmation.length > 1 ? localize("fetchWebPage.confirmationTitle.plural", "Fetch untrusted web pages?") : localize("fetchWebPage.confirmationTitle.singular", "Fetch untrusted web page?");
      const managedTrustedDomainsCommand = "workbench.action.manageTrustedDomain";
      const confirmationMessage = new MarkdownString(
        urlsNeedingConfirmation.length > 1 ? urlsNeedingConfirmation.map((uri) => `- ${uri.toString()}`).join("\n") : urlsNeedingConfirmation[0].toString(),
        {
          isTrusted: { enabledCommands: [managedTrustedDomainsCommand] },
          supportThemeIcons: true
        }
      );
      confirmationMessage.appendMarkdown(
        "\n\n$(info) " + localize(
          "fetchWebPage.confirmationMessageManageTrustedDomains",
          "You can [manage your trusted domains]({0}) to skip this confirmation in the future.",
          `command:${managedTrustedDomainsCommand}`
        )
      );
      result.confirmationMessages = { title: confirmationTitle, message: confirmationMessage, allowAutoConfirm: false };
    }
    return result;
  }
  _parseUris(urls) {
    const results = /* @__PURE__ */ new Map();
    urls?.forEach((uri) => {
      try {
        const uriObj = URI.parse(uri);
        results.set(uri, uriObj);
      } catch (e) {
        results.set(uri, void 0);
      }
    });
    return results;
  }
  _getPromptPartsForResults(results) {
    return results.map((value) => ({
      kind: "text",
      value: value || localize("fetchWebPage.invalidUrl", "Invalid URL")
    }));
  }
};
FetchWebPageTool = __decorateClass([
  __decorateParam(0, IWebContentExtractorService),
  __decorateParam(1, ITrustedDomainService)
], FetchWebPageTool);
export {
  FetchWebPageTool,
  FetchWebPageToolData
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2VsZWN0cm9uLXNhbmRib3gvdG9vbHMvZmV0Y2hQYWdlVG9vbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJV2ViQ29udGVudEV4dHJhY3RvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93ZWJDb250ZW50RXh0cmFjdG9yL2NvbW1vbi93ZWJDb250ZW50RXh0cmFjdG9yLmpzJztcbmltcG9ydCB7IElUcnVzdGVkRG9tYWluU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3VybC9icm93c2VyL3RydXN0ZWREb21haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvdW50VG9rZW5zQ2FsbGJhY2ssIElQcmVwYXJlZFRvb2xJbnZvY2F0aW9uLCBJVG9vbERhdGEsIElUb29sSW1wbCwgSVRvb2xJbnZvY2F0aW9uLCBJVG9vbFJlc3VsdCwgSVRvb2xSZXN1bHRUZXh0UGFydCB9IGZyb20gJy4uLy4uL2NvbW1vbi9sYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgSW50ZXJuYWxGZXRjaFdlYlBhZ2VUb29sSWQgfSBmcm9tICcuLi8uLi9jb21tb24vdG9vbHMvdG9vbHMuanMnO1xuXG5leHBvcnQgY29uc3QgRmV0Y2hXZWJQYWdlVG9vbERhdGE6IElUb29sRGF0YSA9IHtcblx0aWQ6IEludGVybmFsRmV0Y2hXZWJQYWdlVG9vbElkLFxuXHRkaXNwbGF5TmFtZTogJ0ZldGNoIFdlYiBQYWdlJyxcblx0Y2FuQmVSZWZlcmVuY2VkSW5Qcm9tcHQ6IGZhbHNlLFxuXHRtb2RlbERlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmV0Y2hXZWJQYWdlLm1vZGVsRGVzY3JpcHRpb24nLCAnRmV0Y2hlcyB0aGUgbWFpbiBjb250ZW50IGZyb20gYSB3ZWIgcGFnZS4gVGhpcyB0b29sIGlzIHVzZWZ1bCBmb3Igc3VtbWFyaXppbmcgb3IgYW5hbHl6aW5nIHRoZSBjb250ZW50IG9mIGEgd2VicGFnZS4nKSxcblx0c291cmNlOiB7IHR5cGU6ICdpbnRlcm5hbCcgfSxcblx0aW5wdXRTY2hlbWE6IHtcblx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHR1cmxzOiB7XG5cdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmV0Y2hXZWJQYWdlLnVybHNEZXNjcmlwdGlvbicsICdBbiBhcnJheSBvZiBVUkxzIHRvIGZldGNoIGNvbnRlbnQgZnJvbS4nKVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0cmVxdWlyZWQ6IFsndXJscyddXG5cdH1cbn07XG5cbmV4cG9ydCBjbGFzcyBGZXRjaFdlYlBhZ2VUb29sIGltcGxlbWVudHMgSVRvb2xJbXBsIHtcblx0cHJpdmF0ZSBfYWxyZWFkeUFwcHJvdmVkRG9tYWlucyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJV2ViQ29udGVudEV4dHJhY3RvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcmVhZGVyTW9kZVNlcnZpY2U6IElXZWJDb250ZW50RXh0cmFjdG9yU2VydmljZSxcblx0XHRASVRydXN0ZWREb21haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RydXN0ZWREb21haW5TZXJ2aWNlOiBJVHJ1c3RlZERvbWFpblNlcnZpY2UsXG5cdCkgeyB9XG5cblx0YXN5bmMgaW52b2tlKGludm9jYXRpb246IElUb29sSW52b2NhdGlvbiwgX2NvdW50VG9rZW5zOiBDb3VudFRva2Vuc0NhbGxiYWNrLCBfdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJVG9vbFJlc3VsdD4ge1xuXHRcdGNvbnN0IHBhcnNlZFVyaVJlc3VsdHMgPSB0aGlzLl9wYXJzZVVyaXMoKGludm9jYXRpb24ucGFyYW1ldGVycyBhcyB7IHVybHM/OiBzdHJpbmdbXSB9KS51cmxzKTtcblx0XHRjb25zdCB2YWxpZFVyaXMgPSBBcnJheS5mcm9tKHBhcnNlZFVyaVJlc3VsdHMudmFsdWVzKCkpLmZpbHRlcigodXJpKTogdXJpIGlzIFVSSSA9PiAhIXVyaSk7XG5cdFx0aWYgKCF2YWxpZFVyaXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjb250ZW50OiBbeyBraW5kOiAndGV4dCcsIHZhbHVlOiBsb2NhbGl6ZSgnZmV0Y2hXZWJQYWdlLm5vVmFsaWRVcmxzJywgJ05vIHZhbGlkIFVSTHMgcHJvdmlkZWQuJykgfV1cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gV2UgYXBwcm92ZWQgdGhlc2UgdmlhIGNvbmZpcm1hdGlvbiwgc28gbWFyayB0aGVtIGFzIFwiYXBwcm92ZWRcIiBpbiB0aGlzIHNlc3Npb25cblx0XHQvLyBpZiB0aGV5IGFyZSBub3QgYXBwcm92ZWQgdmlhIHRoZSB0cnVzdGVkIGRvbWFpbiBzZXJ2aWNlLlxuXHRcdGZvciAoY29uc3QgdXJpIG9mIHZhbGlkVXJpcykge1xuXHRcdFx0aWYgKCF0aGlzLl90cnVzdGVkRG9tYWluU2VydmljZS5pc1ZhbGlkKHVyaSkpIHtcblx0XHRcdFx0dGhpcy5fYWxyZWFkeUFwcHJvdmVkRG9tYWlucy5hZGQodXJpLnRvU3RyaW5nKHRydWUpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjb250ZW50cyA9IGF3YWl0IHRoaXMuX3JlYWRlck1vZGVTZXJ2aWNlLmV4dHJhY3QodmFsaWRVcmlzKTtcblx0XHQvLyBNYWtlIGFuIGFycmF5IHRoYXQgY29udGFpbnMgZWl0aGVyIHRoZSBjb250ZW50IG9yIHVuZGVmaW5lZCBmb3IgaW52YWxpZCBVUkxzXG5cdFx0Y29uc3QgY29udGVudHNXaXRoVW5kZWZpbmVkOiAoc3RyaW5nIHwgdW5kZWZpbmVkKVtdID0gW107XG5cdFx0bGV0IGluZGV4SW5Db250ZW50cyA9IDA7XG5cdFx0cGFyc2VkVXJpUmVzdWx0cy5mb3JFYWNoKCh1cmkpID0+IHtcblx0XHRcdGlmICh1cmkpIHtcblx0XHRcdFx0Y29udGVudHNXaXRoVW5kZWZpbmVkLnB1c2goY29udGVudHNbaW5kZXhJbkNvbnRlbnRzXSk7XG5cdFx0XHRcdGluZGV4SW5Db250ZW50cysrO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udGVudHNXaXRoVW5kZWZpbmVkLnB1c2godW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiB7IGNvbnRlbnQ6IHRoaXMuX2dldFByb21wdFBhcnRzRm9yUmVzdWx0cyhjb250ZW50c1dpdGhVbmRlZmluZWQpIH07XG5cdH1cblxuXHRhc3luYyBwcmVwYXJlVG9vbEludm9jYXRpb24ocGFyYW1ldGVyczogYW55LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElQcmVwYXJlZFRvb2xJbnZvY2F0aW9uIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgbWFwID0gdGhpcy5fcGFyc2VVcmlzKHBhcmFtZXRlcnMudXJscyk7XG5cdFx0Y29uc3QgaW52YWxpZCA9IG5ldyBBcnJheTxzdHJpbmc+KCk7XG5cdFx0Y29uc3QgdmFsaWQgPSBuZXcgQXJyYXk8VVJJPigpO1xuXHRcdG1hcC5mb3JFYWNoKCh1cmksIHVybCkgPT4ge1xuXHRcdFx0aWYgKCF1cmkpIHtcblx0XHRcdFx0aW52YWxpZC5wdXNoKHVybCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YWxpZC5wdXNoKHVyaSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Y29uc3QgdXJsc05lZWRpbmdDb25maXJtYXRpb24gPSB2YWxpZC5maWx0ZXIodXJsID0+ICF0aGlzLl90cnVzdGVkRG9tYWluU2VydmljZS5pc1ZhbGlkKHVybCkgJiYgIXRoaXMuX2FscmVhZHlBcHByb3ZlZERvbWFpbnMuaGFzKHVybC50b1N0cmluZyh0cnVlKSkpO1xuXG5cdFx0Y29uc3QgcGFzdFRlbnNlTWVzc2FnZSA9IGludmFsaWQubGVuZ3RoXG5cdFx0XHQ/IGludmFsaWQubGVuZ3RoID4gMVxuXHRcdFx0XHQvLyBJZiB0aGVyZSBhcmUgbXVsdGlwbGUgaW52YWxpZCBVUkxzLCBzaG93IHRoZW0gYWxsXG5cdFx0XHRcdD8gbmV3IE1hcmtkb3duU3RyaW5nKFxuXHRcdFx0XHRcdGxvY2FsaXplKFxuXHRcdFx0XHRcdFx0J2ZldGNoV2ViUGFnZS5wYXN0VGVuc2VNZXNzYWdlLnBsdXJhbCcsXG5cdFx0XHRcdFx0XHQnRmV0Y2hlZCB7MH0gd2ViIHBhZ2VzLCBidXQgdGhlIGZvbGxvd2luZyB3ZXJlIGludmFsaWQgVVJMczpcXG5cXG57MX1cXG5cXG4nLCB2YWxpZC5sZW5ndGgsIGludmFsaWQubWFwKHVybCA9PiBgLSAke3VybH1gKS5qb2luKCdcXG4nKVxuXHRcdFx0XHRcdCkpXG5cdFx0XHRcdC8vIElmIHRoZXJlIGlzIG9ubHkgb25lIGludmFsaWQgVVJMLCBzaG93IGl0XG5cdFx0XHRcdDogbmV3IE1hcmtkb3duU3RyaW5nKFxuXHRcdFx0XHRcdGxvY2FsaXplKFxuXHRcdFx0XHRcdFx0J2ZldGNoV2ViUGFnZS5wYXN0VGVuc2VNZXNzYWdlLnNpbmd1bGFyJyxcblx0XHRcdFx0XHRcdCdGZXRjaGVkIHdlYiBwYWdlLCBidXQgdGhlIGZvbGxvd2luZyB3YXMgYW4gaW52YWxpZCBVUkw6XFxuXFxuezB9XFxuXFxuJywgaW52YWxpZFswXVxuXHRcdFx0XHRcdCkpXG5cdFx0XHQvLyBObyBpbnZhbGlkIFVSTHNcblx0XHRcdDogbmV3IE1hcmtkb3duU3RyaW5nKCk7XG5cblx0XHRjb25zdCBpbnZvY2F0aW9uTWVzc2FnZSA9IG5ldyBNYXJrZG93blN0cmluZygpO1xuXHRcdGlmICh2YWxpZC5sZW5ndGggPiAxKSB7XG5cdFx0XHRwYXN0VGVuc2VNZXNzYWdlLmFwcGVuZE1hcmtkb3duKGxvY2FsaXplKCdmZXRjaFdlYlBhZ2UucGFzdFRlbnNlTWVzc2FnZVJlc3VsdC5wbHVyYWwnLCAnRmV0Y2hlZCB7MH0gd2ViIHBhZ2VzJywgdmFsaWQubGVuZ3RoKSk7XG5cdFx0XHRpbnZvY2F0aW9uTWVzc2FnZS5hcHBlbmRNYXJrZG93bihsb2NhbGl6ZSgnZmV0Y2hXZWJQYWdlLmludm9jYXRpb25NZXNzYWdlLnBsdXJhbCcsICdGZXRjaGluZyB7MH0gd2ViIHBhZ2VzJywgdmFsaWQubGVuZ3RoKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHVybCA9IHZhbGlkWzBdLnRvU3RyaW5nKCk7XG5cdFx0XHQvLyBJZiB0aGUgVVJMIGlzIHRvbyBsb25nLCBzaG93IGl0IGFzIGEgbGluay4uLiBvdGhlcndpc2UsIHNob3cgaXQgYXMgcGxhaW4gdGV4dFxuXHRcdFx0aWYgKHVybC5sZW5ndGggPiA0MDApIHtcblx0XHRcdFx0cGFzdFRlbnNlTWVzc2FnZS5hcHBlbmRNYXJrZG93bihsb2NhbGl6ZSh7XG5cdFx0XHRcdFx0a2V5OiAnZmV0Y2hXZWJQYWdlLnBhc3RUZW5zZU1lc3NhZ2VSZXN1bHQuc2luZ3VsYXJBc0xpbmsnLFxuXHRcdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHRcdC8vIE1ha2Ugc3VyZSB0aGUgbGluayBzeW50YXggaXMgY29ycmVjdFxuXHRcdFx0XHRcdFx0J3tMb2NrZWQ9XCJdKHswfSlcIn0nLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSwgJ0ZldGNoZWQgW3dlYiBwYWdlXSh7MH0pJywgdXJsKSk7XG5cdFx0XHRcdGludm9jYXRpb25NZXNzYWdlLmFwcGVuZE1hcmtkb3duKGxvY2FsaXplKHtcblx0XHRcdFx0XHRrZXk6ICdmZXRjaFdlYlBhZ2UuaW52b2NhdGlvbk1lc3NhZ2Uuc2luZ3VsYXJBc0xpbmsnLFxuXHRcdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHRcdC8vIE1ha2Ugc3VyZSB0aGUgbGluayBzeW50YXggaXMgY29ycmVjdFxuXHRcdFx0XHRcdFx0J3tMb2NrZWQ9XCJdKHswfSlcIn0nLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSwgJ0ZldGNoaW5nIFt3ZWIgcGFnZV0oezB9KScsIHVybCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cGFzdFRlbnNlTWVzc2FnZS5hcHBlbmRNYXJrZG93bihsb2NhbGl6ZSgnZmV0Y2hXZWJQYWdlLnBhc3RUZW5zZU1lc3NhZ2VSZXN1bHQuc2luZ3VsYXInLCAnRmV0Y2hlZCB7MH0nLCB1cmwpKTtcblx0XHRcdFx0aW52b2NhdGlvbk1lc3NhZ2UuYXBwZW5kTWFya2Rvd24obG9jYWxpemUoJ2ZldGNoV2ViUGFnZS5pbnZvY2F0aW9uTWVzc2FnZS5zaW5ndWxhcicsICdGZXRjaGluZyB7MH0nLCB1cmwpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQ6IElQcmVwYXJlZFRvb2xJbnZvY2F0aW9uID0geyBpbnZvY2F0aW9uTWVzc2FnZSwgcGFzdFRlbnNlTWVzc2FnZSB9O1xuXHRcdGlmICh1cmxzTmVlZGluZ0NvbmZpcm1hdGlvbi5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IGNvbmZpcm1hdGlvblRpdGxlID0gdXJsc05lZWRpbmdDb25maXJtYXRpb24ubGVuZ3RoID4gMVxuXHRcdFx0XHQ/IGxvY2FsaXplKCdmZXRjaFdlYlBhZ2UuY29uZmlybWF0aW9uVGl0bGUucGx1cmFsJywgJ0ZldGNoIHVudHJ1c3RlZCB3ZWIgcGFnZXM/Jylcblx0XHRcdFx0OiBsb2NhbGl6ZSgnZmV0Y2hXZWJQYWdlLmNvbmZpcm1hdGlvblRpdGxlLnNpbmd1bGFyJywgJ0ZldGNoIHVudHJ1c3RlZCB3ZWIgcGFnZT8nKTtcblxuXHRcdFx0Y29uc3QgbWFuYWdlZFRydXN0ZWREb21haW5zQ29tbWFuZCA9ICd3b3JrYmVuY2guYWN0aW9uLm1hbmFnZVRydXN0ZWREb21haW4nO1xuXHRcdFx0Y29uc3QgY29uZmlybWF0aW9uTWVzc2FnZSA9IG5ldyBNYXJrZG93blN0cmluZyhcblx0XHRcdFx0dXJsc05lZWRpbmdDb25maXJtYXRpb24ubGVuZ3RoID4gMVxuXHRcdFx0XHRcdD8gdXJsc05lZWRpbmdDb25maXJtYXRpb24ubWFwKHVyaSA9PiBgLSAke3VyaS50b1N0cmluZygpfWApLmpvaW4oJ1xcbicpXG5cdFx0XHRcdFx0OiB1cmxzTmVlZGluZ0NvbmZpcm1hdGlvblswXS50b1N0cmluZygpLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aXNUcnVzdGVkOiB7IGVuYWJsZWRDb21tYW5kczogW21hbmFnZWRUcnVzdGVkRG9tYWluc0NvbW1hbmRdIH0sXG5cdFx0XHRcdFx0c3VwcG9ydFRoZW1lSWNvbnM6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0KTtcblxuXHRcdFx0Y29uZmlybWF0aW9uTWVzc2FnZS5hcHBlbmRNYXJrZG93bihcblx0XHRcdFx0J1xcblxcbiQoaW5mbykgJyArIGxvY2FsaXplKFxuXHRcdFx0XHRcdCdmZXRjaFdlYlBhZ2UuY29uZmlybWF0aW9uTWVzc2FnZU1hbmFnZVRydXN0ZWREb21haW5zJyxcblx0XHRcdFx0XHQnWW91IGNhbiBbbWFuYWdlIHlvdXIgdHJ1c3RlZCBkb21haW5zXSh7MH0pIHRvIHNraXAgdGhpcyBjb25maXJtYXRpb24gaW4gdGhlIGZ1dHVyZS4nLFxuXHRcdFx0XHRcdGBjb21tYW5kOiR7bWFuYWdlZFRydXN0ZWREb21haW5zQ29tbWFuZH1gXG5cdFx0XHRcdClcblx0XHRcdCk7XG5cblx0XHRcdHJlc3VsdC5jb25maXJtYXRpb25NZXNzYWdlcyA9IHsgdGl0bGU6IGNvbmZpcm1hdGlvblRpdGxlLCBtZXNzYWdlOiBjb25maXJtYXRpb25NZXNzYWdlLCBhbGxvd0F1dG9Db25maXJtOiBmYWxzZSB9O1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIF9wYXJzZVVyaXModXJscz86IHN0cmluZ1tdKTogTWFwPHN0cmluZywgVVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgcmVzdWx0cyA9IG5ldyBNYXA8c3RyaW5nLCBVUkkgfCB1bmRlZmluZWQ+KCk7XG5cdFx0dXJscz8uZm9yRWFjaCh1cmkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgdXJpT2JqID0gVVJJLnBhcnNlKHVyaSk7XG5cdFx0XHRcdHJlc3VsdHMuc2V0KHVyaSwgdXJpT2JqKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0cmVzdWx0cy5zZXQodXJpLCB1bmRlZmluZWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiByZXN1bHRzO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0UHJvbXB0UGFydHNGb3JSZXN1bHRzKHJlc3VsdHM6IChzdHJpbmcgfCB1bmRlZmluZWQpW10pOiBJVG9vbFJlc3VsdFRleHRQYXJ0W10ge1xuXHRcdHJldHVybiByZXN1bHRzLm1hcCh2YWx1ZSA9PiAoe1xuXHRcdFx0a2luZDogJ3RleHQnLFxuXHRcdFx0dmFsdWU6IHZhbHVlIHx8IGxvY2FsaXplKCdmZXRjaFdlYlBhZ2UuaW52YWxpZFVybCcsICdJbnZhbGlkIFVSTCcpXG5cdFx0fSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsV0FBVztBQUNwQixTQUFTLG1DQUFtQztBQUM1QyxTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGtDQUFrQztBQUVwQyxNQUFNLHVCQUFrQztBQUFBLEVBQzlDLElBQUk7QUFBQSxFQUNKLGFBQWE7QUFBQSxFQUNiLHlCQUF5QjtBQUFBLEVBQ3pCLGtCQUFrQixTQUFTLGlDQUFpQyxzSEFBc0g7QUFBQSxFQUNsTCxRQUFRLEVBQUUsTUFBTSxXQUFXO0FBQUEsRUFDM0IsYUFBYTtBQUFBLElBQ1osTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBLE1BQ1gsTUFBTTtBQUFBLFFBQ0wsTUFBTTtBQUFBLFFBQ04sT0FBTztBQUFBLFVBQ04sTUFBTTtBQUFBLFFBQ1A7QUFBQSxRQUNBLGFBQWEsU0FBUyxnQ0FBZ0MseUNBQXlDO0FBQUEsTUFDaEc7QUFBQSxJQUNEO0FBQUEsSUFDQSxVQUFVLENBQUMsTUFBTTtBQUFBLEVBQ2xCO0FBQ0Q7QUFFTyxJQUFNLG1CQUFOLE1BQTRDO0FBQUEsRUFHbEQsWUFDK0Msb0JBQ04sdUJBQ3ZDO0FBRjZDO0FBQ047QUFKekMsU0FBUSwwQkFBMEIsb0JBQUksSUFBWTtBQUFBLEVBSzlDO0FBQUEsRUFFSixNQUFNLE9BQU8sWUFBNkIsY0FBbUMsUUFBaUQ7QUFDN0gsVUFBTSxtQkFBbUIsS0FBSyxXQUFZLFdBQVcsV0FBbUMsSUFBSTtBQUM1RixVQUFNLFlBQVksTUFBTSxLQUFLLGlCQUFpQixPQUFPLENBQUMsRUFBRSxPQUFPLENBQUMsUUFBb0IsQ0FBQyxDQUFDLEdBQUc7QUFDekYsUUFBSSxDQUFD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
