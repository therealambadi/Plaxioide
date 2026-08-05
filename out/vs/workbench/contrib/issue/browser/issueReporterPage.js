import { escape } from "../../../../base/common/strings.js";
import { localize } from "../../../../nls.js";
const sendSystemInfoLabel = escape(localize("sendSystemInfo", "Include my system information"));
const sendProcessInfoLabel = escape(localize("sendProcessInfo", "Include my currently running processes"));
const sendWorkspaceInfoLabel = escape(localize("sendWorkspaceInfo", "Include my workspace metadata"));
const sendExtensionsLabel = escape(localize("sendExtensions", "Include my enabled extensions"));
const sendExperimentsLabel = escape(localize("sendExperiments", "Include A/B experiment info"));
const sendExtensionData = escape(localize("sendExtensionData", "Include additional extension info"));
const acknowledgementsLabel = escape(localize("acknowledgements", "I acknowledge that my VS Code version is not updated and this issue may be closed."));
const reviewGuidanceLabel = localize(
  // intentionally not escaped because of its embedded tags
  {
    key: "reviewGuidanceLabel",
    comment: [
      '{Locked="<a href="https://github.com/microsoft/vscode/wiki/Submitting-Bugs-and-Suggestions" target="_blank">"}',
      '{Locked="</a>"}'
    ]
  },
  'Before you report an issue here please <a href="https://github.com/microsoft/vscode/wiki/Submitting-Bugs-and-Suggestions" target="_blank">review the guidance we provide</a>. Please complete the form in English.'
);
var issueReporterPage_default = () => `
<div id="update-banner" class="issue-reporter-update-banner hidden">
	<span class="update-banner-text" id="update-banner-text">
		<!-- To be dynamically filled -->
	</span>
</div>
<div class="issue-reporter" id="issue-reporter">
	<div id="english" class="input-group hidden">${escape(localize("completeInEnglish", "Please complete the form in English."))}</div>

	<div id="review-guidance-help-text" class="input-group">${reviewGuidanceLabel}</div>

	<div class="section">
		<div class="input-group">
			<label class="inline-label" for="issue-type">${escape(localize("issueTypeLabel", "This is a"))}</label>
			<select id="issue-type" class="inline-form-control">
				<!-- To be dynamically filled -->
			</select>
		</div>

		<div class="input-group" id="problem-source">
			<label class="inline-label" for="issue-source">${escape(localize("issueSourceLabel", "For"))} <span class="required-input">*</span></label>
			<select id="issue-source" class="inline-form-control" required>
				<!-- To be dynamically filled -->
			</select>
			<div id="issue-source-empty-error" class="validation-error hidden" role="alert">${escape(localize("issueSourceEmptyValidation", "An issue source is required."))}</div>
			<div id="problem-source-help-text" class="instructions hidden">${escape(localize("disableExtensionsLabelText", "Try to reproduce the problem after {0}. If the problem only reproduces when extensions are active, it is likely an issue with an extension.")).replace("{0}", () => `<span tabIndex=0 role="button" id="disableExtensions" class="workbenchCommand">${escape(localize("disableExtensions", "disabling all extensions and reloading the window"))}</span>`)}
			</div>

			<div id="extension-selection">
				<label class="inline-label" for="extension-selector">${escape(localize("chooseExtension", "Extension"))} <span class="required-input">*</span></label>
				<select id="extension-selector" class="inline-form-control">
					<!-- To be dynamically filled -->
				</select>
				<div id="extension-selection-validation-error" class="validation-error hidden" role="alert">${escape(localize("extensionWithNonstandardBugsUrl", "The issue reporter is unable to create issues for this extension. Please visit {0} to report an issue.")).replace("{0}", () => `<span tabIndex=0 role="button" id="extensionBugsLink" class="workbenchCommand"><!-- To be dynamically filled --></span>`)}</div>
				<div id="extension-selection-validation-error-no-url" class="validation-error hidden" role="alert">
					${escape(localize("extensionWithNoBugsUrl", "The issue reporter is unable to create issues for this extension, as it does not specify a URL for reporting issues. Please check the marketplace page of this extension to see if other instructions are available."))}
				</div>
			</div>
		</div>

		<div id="issue-title-container" class="input-group">
			<label class="inline-label" for="issue-title">${escape(localize("issueTitleLabel", "Title"))} <span class="required-input">*</span></label>
			<input id="issue-title" type="text" class="inline-form-control" placeholder="${escape(localize("issueTitleRequired", "Please enter a title."))}" required>
			<div id="issue-title-empty-error" class="validation-error hidden" role="alert">${escape(localize("titleEmptyValidation", "A title is required."))}</div>
			<div id="issue-title-length-validation-error" class="validation-error hidden" role="alert">${escape(localize("titleLengthValidation", "The title is too long."))}</div>
			<small id="similar-issues">
				<!-- To be dynamically filled -->
			</small>
		</div>

	</div>

	<div class="input-group description-section">
		<label for="description" id="issue-description-label">
			<!-- To be dynamically filled -->
		</label>
		<div class="instructions" id="issue-description-subtitle">
			<!-- To be dynamically filled -->
		</div>
		<div class="block-info-text">
			<textarea name="description" id="description" placeholder="${escape(localize("details", "Please enter details."))}" required></textarea>
		</div>
		<div id="description-empty-error" class="validation-error hidden" role="alert">${escape(localize("descriptionEmptyValidation", "A description is required."))}</div>
		<div id="description-short-error" class="validation-error hidden" role="alert">${escape(localize("descriptionTooShortValidation", "Please provide a longer description."))}</div>
	</div>

	<div class="system-info" id="block-container">
		<div class="block block-extension-data">
			<input class="send-extension-data" aria-label="${sendExtensionData}" type="checkbox" id="includeExtensionData" checked/>
			<label class="extension-caption" id="extension-caption" for="includeExtensionData">
				${sendExtensionData}
				<span id="ext-loading" hidden></span>
				<span class="ext-parens" hidden>(</span><a href="#" class="showInfo" id="extension-id">${escape(localize("show", "show"))}</a><span class="ext-parens" hidden>)</span>
				<a id="extension-data-download">${escape(localize("downloadExtensionData", "Download Extension Data"))}</a>
			</label>
			<pre class="block-info" id="extension-data" placeholder="${escape(localize("extensionData", "Extension does not have additional data to include."))}" style="white-space: pre-wrap; user-select: text;">
				<!-- To be dynamically filled -->
			</pre>
		</div>

		<div class="block block-system">
			<input class="sendData" aria-label="${sendSystemInfoLabel}" type="checkbox" id="includeSystemInfo" checked/>
			<label class="caption" for="includeSystemInfo">
				${sendSystemInfoLabel}
				(<a href="#" class="showInfo">${escape(localize("show", "show"))}</a>)
			</label>
			<div class="block-info hidden" style="user-select: text;">
				<!-- To be dynamically filled -->
		</div>
		</div>
		<div class="block block-process">
			<input class="sendData" aria-label="${sendProcessInfoLabel}" type="checkbox" id="includeProcessInfo" checked/>
			<label class="caption" for="includeProcessInfo">
				${sendProcessInfoLabel}
				(<a href="#" class="showInfo">${escape(localize("show", "show"))}</a>)
			</label>
			<pre class="block-info hidden" style="user-select: text;">
				<code>
				<!-- To be dynamically filled -->
				</code>
			</pre>
		</div>
		<div class="block block-workspace">
			<input class="sendData" aria-label="${sendWorkspaceInfoLabel}" type="checkbox" id="includeWorkspaceInfo" checked/>
			<label class="caption" for="includeWorkspaceInfo">
				${sendWorkspaceInfoLabel}
				(<a href="#" class="showInfo">${escape(localize("show", "show"))}</a>)
			</label>
			<pre id="systemInfo" class="block-info hidden" style="user-select: text;">
				<code>
				<!-- To be dynamically filled -->
				</code>
			</pre>
		</div>
		<div class="block block-extensions">
			<input class="sendData" aria-label="${sendExtensionsLabel}" type="checkbox" id="includeExtensions" checked/>
			<label class="caption" for="includeExtensions">
				${sendExtensionsLabel}
				(<a href="#" class="showInfo">${escape(localize("show", "show"))}</a>)
			</label>
			<div id="systemInfo" class="block-info hidden" style="user-select: text;">
				<!-- To be dynamically filled -->
			</div>
		</div>
		<div class="block block-experiments">
			<input class="sendData" aria-label="${sendExperimentsLabel}" type="checkbox" id="includeExperiments" checked/>
			<label class="caption" for="includeExperiments">
				${sendExperimentsLabel}
				(<a href="#" class="showInfo">${escape(localize("show", "show"))}</a>)
			</label>
			<pre class="block-info hidden" style="user-select: text;">
				<!-- To be dynamically filled -->
			</pre>
		</div>
		<div class="block block-acknowledgements hidden" id="version-acknowledgements">
			<input class="sendData" aria-label="${acknowledgementsLabel}" type="checkbox" id="includeAcknowledgement"/>
			<label class="caption" for="includeAcknowledgement">
				${acknowledgementsLabel}
			</label>
		</div>
	</div>
</div>`;
export {
  issueReporterPage_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pc3N1ZS9icm93c2VyL2lzc3VlUmVwb3J0ZXJQYWdlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZXNjYXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5cbmNvbnN0IHNlbmRTeXN0ZW1JbmZvTGFiZWwgPSBlc2NhcGUobG9jYWxpemUoJ3NlbmRTeXN0ZW1JbmZvJywgXCJJbmNsdWRlIG15IHN5c3RlbSBpbmZvcm1hdGlvblwiKSk7XG5jb25zdCBzZW5kUHJvY2Vzc0luZm9MYWJlbCA9IGVzY2FwZShsb2NhbGl6ZSgnc2VuZFByb2Nlc3NJbmZvJywgXCJJbmNsdWRlIG15IGN1cnJlbnRseSBydW5uaW5nIHByb2Nlc3Nlc1wiKSk7XG5jb25zdCBzZW5kV29ya3NwYWNlSW5mb0xhYmVsID0gZXNjYXBlKGxvY2FsaXplKCdzZW5kV29ya3NwYWNlSW5mbycsIFwiSW5jbHVkZSBteSB3b3Jrc3BhY2UgbWV0YWRhdGFcIikpO1xuY29uc3Qgc2VuZEV4dGVuc2lvbnNMYWJlbCA9IGVzY2FwZShsb2NhbGl6ZSgnc2VuZEV4dGVuc2lvbnMnLCBcIkluY2x1ZGUgbXkgZW5hYmxlZCBleHRlbnNpb25zXCIpKTtcbmNvbnN0IHNlbmRFeHBlcmltZW50c0xhYmVsID0gZXNjYXBlKGxvY2FsaXplKCdzZW5kRXhwZXJpbWVudHMnLCBcIkluY2x1ZGUgQS9CIGV4cGVyaW1lbnQgaW5mb1wiKSk7XG5jb25zdCBzZW5kRXh0ZW5zaW9uRGF0YSA9IGVzY2FwZShsb2NhbGl6ZSgnc2VuZEV4dGVuc2lvbkRhdGEnLCBcIkluY2x1ZGUgYWRkaXRpb25hbCBleHRlbnNpb24gaW5mb1wiKSk7XG5jb25zdCBhY2tub3dsZWRnZW1lbnRzTGFiZWwgPSBlc2NhcGUobG9jYWxpemUoJ2Fja25vd2xlZGdlbWVudHMnLCBcIkkgYWNrbm93bGVkZ2UgdGhhdCBteSBWUyBDb2RlIHZlcnNpb24gaXMgbm90IHVwZGF0ZWQgYW5kIHRoaXMgaXNzdWUgbWF5IGJlIGNsb3NlZC5cIikpO1xuY29uc3QgcmV2aWV3R3VpZGFuY2VMYWJlbCA9IGxvY2FsaXplKCAvLyBpbnRlbnRpb25hbGx5IG5vdCBlc2NhcGVkIGJlY2F1c2Ugb2YgaXRzIGVtYmVkZGVkIHRhZ3Ncblx0e1xuXHRcdGtleTogJ3Jldmlld0d1aWRhbmNlTGFiZWwnLFxuXHRcdGNvbW1lbnQ6IFtcblx0XHRcdCd7TG9ja2VkPVwiPGEgaHJlZj1cXFwiaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvd2lraS9TdWJtaXR0aW5nLUJ1Z3MtYW5kLVN1Z2dlc3Rpb25zXFxcIiB0YXJnZXQ9XFxcIl9ibGFua1xcXCI+XCJ9Jyxcblx0XHRcdCd7TG9ja2VkPVwiPC9hPlwifSdcblx0XHRdXG5cdH0sXG5cdCdCZWZvcmUgeW91IHJlcG9ydCBhbiBpc3N1ZSBoZXJlIHBsZWFzZSA8YSBocmVmPVwiaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvd2lraS9TdWJtaXR0aW5nLUJ1Z3MtYW5kLVN1Z2dlc3Rpb25zXCIgdGFyZ2V0PVwiX2JsYW5rXCI+cmV2aWV3IHRoZSBndWlkYW5jZSB3ZSBwcm92aWRlPC9hPi4gUGxlYXNlIGNvbXBsZXRlIHRoZSBmb3JtIGluIEVuZ2xpc2guJ1xuKTtcblxuZXhwb3J0IGRlZmF1bHQgKCk6IHN0cmluZyA9PiBgXG48ZGl2IGlkPVwidXBkYXRlLWJhbm5lclwiIGNsYXNzPVwiaXNzdWUtcmVwb3J0ZXItdXBkYXRlLWJhbm5lciBoaWRkZW5cIj5cblx0PHNwYW4gY2xhc3M9XCJ1cGRhdGUtYmFubmVyLXRleHRcIiBpZD1cInVwZGF0ZS1iYW5uZXItdGV4dFwiPlxuXHRcdDwhLS0gVG8gYmUgZHluYW1pY2FsbHkgZmlsbGVkIC0tPlxuXHQ8L3NwYW4+XG48L2Rpdj5cbjxkaXYgY2xhc3M9XCJpc3N1ZS1yZXBvcnRlclwiIGlkPVwiaXNzdWUtcmVwb3J0ZXJcIj5cblx0PGRpdiBpZD1cImVuZ2xpc2hcIiBjbGFzcz1cImlucHV0LWdyb3VwIGhpZGRlblwiPiR7ZXNjYXBlKGxvY2FsaXplKCdjb21wbGV0ZUluRW5nbGlzaCcsIFwiUGxlYXNlIGNvbXBsZXRlIHRoZSBmb3JtIGluIEVuZ2xpc2guXCIpKX08L2Rpdj5cblxuXHQ8ZGl2IGlkPVwicmV2aWV3LWd1aWRhbmNlLWhlbHAtdGV4dFwiIGNsYXNzPVwiaW5wdXQtZ3JvdXBcIj4ke3Jldmlld0d1aWRhbmNlTGFiZWx9PC9kaXY+XG5cblx0PGRpdiBjbGFzcz1cInNlY3Rpb25cIj5cblx0XHQ8ZGl2IGNsYXNzPVwiaW5wdXQtZ3JvdXBcIj5cblx0XHRcdDxsYWJlbCBjbGFzcz1cImlubGluZS1sYWJlbFwiIGZvcj1cImlzc3VlLXR5cGVcIj4ke2VzY2FwZShsb2NhbGl6ZSgnaXNzdWVUeXBlTGFiZWwnLCBcIlRoaXMgaXMgYVwiKSl9PC9sYWJlbD5cblx0XHRcdDxzZWxlY3QgaWQ9XCJpc3N1ZS10eXBlXCIgY2xhc3M9XCJpbmxpbmUtZm9ybS1jb250cm9sXCI+XG5cdFx0XHRcdDwhLS0gVG8gYmUgZHluYW1pY2FsbHkgZmlsbGVkIC0tPlxuXHRcdFx0PC9zZWxlY3Q+XG5cdFx0PC9kaXY+XG5cblx0XHQ8ZGl2IGNsYXNzPVwiaW5wdXQtZ3JvdXBcIiBpZD1cInByb2JsZW0tc291cmNlXCI+XG5cdFx0XHQ8bGFiZWwgY2xhc3M9XCJpbmxpbmUtbGFiZWxcIiBmb3I9XCJpc3N1ZS1zb3VyY2VcIj4ke2VzY2FwZShsb2NhbGl6ZSgnaXNzdWVTb3VyY2VMYWJlbCcsIFwiRm9yXCIpKX0gPHNwYW4gY2xhc3M9XCJyZXF1aXJlZC1pbnB1dFwiPio8L3NwYW4+PC9sYWJlbD5cblx0XHRcdDxzZWxlY3QgaWQ9XCJpc3N1ZS1zb3VyY2VcIiBjbGFzcz1cImlubGluZS1mb3JtLWNvbnRyb2xcIiByZXF1aXJlZD5cblx0XHRcdFx0PCEtLSBUbyBiZSBkeW5hbWljYWxseSBmaWxsZWQgLS0+XG5cdFx0XHQ8L3NlbGVjdD5cblx0XHRcdDxkaXYgaWQ9XCJpc3N1ZS1zb3VyY2UtZW1wdHktZXJyb3JcIiBjbGFzcz1cInZhbGlkYXRpb24tZXJyb3IgaGlkZGVuXCIgcm9sZT1cImFsZXJ0XCI+JHtlc2NhcGUobG9jYWxpemUoJ2lzc3VlU291cmNlRW1wdHlWYWxpZGF0aW9uJywgXCJBbiBpc3N1ZSBzb3VyY2UgaXMgcmVxdWlyZWQuXCIpKX08L2Rpdj5cblx0XHRcdDxkaXYgaWQ9XCJwcm9ibGVtLXNvdXJjZS1oZWxwLXRleHRcIiBjbGFzcz1cImluc3RydWN0aW9ucyBoaWRkZW5cIj4ke2VzY2FwZShsb2NhbGl6ZSgnZGlzYWJsZUV4dGVuc2lvbnNMYWJlbFRleHQnLCBcIlRyeSB0byByZXByb2R1Y2UgdGhlIHByb2JsZW0gYWZ0ZXIgezB9LiBJZiB0aGUgcHJvYmxlbSBvbmx5IHJlcHJvZHVjZXMgd2hlbiBleHRlbnNpb25zIGFyZSBhY3RpdmUsIGl0IGlzIGxpa2VseSBhbiBpc3N1ZSB3aXRoIGFuIGV4dGVuc2lvbi5cIikpXG5cdFx0LnJlcGxhY2UoJ3swfScsICgpID0+IGA8c3BhbiB0YWJJbmRleD0wIHJvbGU9XCJidXR0b25cIiBpZD1cImRpc2FibGVFeHRlbnNpb25zXCIgY2xhc3M9XCJ3b3JrYmVuY2hDb21tYW5kXCI+JHtlc2NhcGUobG9jYWxpemUoJ2Rpc2FibGVFeHRlbnNpb25zJywgXCJkaXNhYmxpbmcgYWxsIGV4dGVuc2lvbnMgYW5kIHJlbG9hZGluZyB0aGUgd2luZG93XCIpKX08L3NwYW4+YCl9XG5cdFx0XHQ8L2Rpdj5cblxuXHRcdFx0PGRpdiBpZD1cImV4dGVuc2lvbi1zZWxlY3Rpb25cIj5cblx0XHRcdFx0PGxhYmVsIGNsYXNzPVwiaW5saW5lLWxhYmVsXCIgZm9yPVwiZXh0ZW5zaW9uLXNlbGVjdG9yXCI+JHtlc2NhcGUobG9jYWxpemUoJ2Nob29zZUV4dGVuc2lvbicsIFwiRXh0ZW5zaW9uXCIpKX0gPHNwYW4gY2xhc3M9XCJyZXF1aXJlZC1pbnB1dFwiPio8L3NwYW4+PC9sYWJlbD5cblx0XHRcdFx0PHNlbGVjdCBpZD1cImV4dGVuc2lvbi1zZWxlY3RvclwiIGNsYXNzPVwiaW5saW5lLWZvcm0tY29udHJvbFwiPlxuXHRcdFx0XHRcdDwhLS0gVG8gYmUgZHluYW1pY2FsbHkgZmlsbGVkIC0tPlxuXHRcdFx0XHQ8L3NlbGVjdD5cblx0XHRcdFx0PGRpdiBpZD1cImV4dGVuc2lvbi1zZWxlY3Rpb24tdmFsaWRhdGlvbi1lcnJvclwiIGNsYXNzPVwidmFsaWRhdGlvbi1lcnJvciBoaWRkZW5cIiByb2xlPVwiYWxlcnRcIj4ke2VzY2FwZShsb2NhbGl6ZSgnZXh0ZW5zaW9uV2l0aE5vbnN0YW5kYXJkQnVnc1VybCcsIFwiVGhlIGlzc3VlIHJlcG9ydGVyIGlzIHVuYWJsZSB0byBjcmVhdGUgaXNzdWVzIGZvciB0aGlzIGV4dGVuc2lvbi4gUGxlYXNlIHZpc2l0IHswfSB0byByZXBvcnQgYW4gaXNzdWUuXCIpKVxuXHRcdC5yZXBsYWNlKCd7MH0nLCAoKSA9PiBgPHNwYW4gdGFiSW5kZXg9MCByb2xlPVwiYnV0dG9uXCIgaWQ9XCJleHRlbnNpb25CdWdzTGlua1wiIGNsYXNzPVwid29ya2JlbmNoQ29tbWFuZFwiPjwhLS0gVG8gYmUgZHluYW1pY2FsbHkgZmlsbGVkIC0tPjwvc3Bhbj5gKX08L2Rpdj5cblx0XHRcdFx0PGRpdiBpZD1cImV4dGVuc2lvbi1zZWxlY3Rpb24tdmFsaWRhdGlvbi1lcnJvci1uby11cmxcIiBjbGFzcz1cInZhbGlkYXRpb24tZXJyb3IgaGlkZGVuXCIgcm9sZT1cImFsZXJ0XCI+XG5cdFx0XHRcdFx0JHtlc2NhcGUobG9jYWxpemUoJ2V4dGVuc2lvbldpdGhOb0J1Z3NVcmwnLCBcIlRoZSBpc3N1ZSByZXBvcnRlciBpcyB1bmFibGUgdG8gY3JlYXRlIGlzc3VlcyBmb3IgdGhpcyBleHRlbnNpb24sIGFzIGl0IGRvZXMgbm90IHNwZWNpZnkgYSBVUkwgZm9yIHJlcG9ydGluZyBpc3N1ZXMuIFBsZWFzZSBjaGVjayB0aGUgbWFya2V0cGxhY2UgcGFnZSBvZiB0aGlzIGV4dGVuc2lvbiB0byBzZWUgaWYgb3RoZXIgaW5zdHJ1Y3Rpb25zIGFyZSBhdmFpbGFibGUuXCIpKX1cblx0XHRcdFx0PC9kaXY+XG5cdFx0XHQ8L2Rpdj5cblx0XHQ8L2Rpdj5cblxuXHRcdDxkaXYgaWQ9XCJpc3N1ZS10aXRsZS1jb250YWluZXJcIiBjbGFzcz1cImlucHV0LWdyb3VwXCI+XG5cdFx0XHQ8bGFiZWwgY2xhc3M9XCJpbmxpbmUtbGFiZWxcIiBmb3I9XCJpc3N1ZS10aXRsZVwiPiR7ZXNjYXBlKGxvY2FsaXplKCdpc3N1ZVRpdGxlTGFiZWwnLCBcIlRpdGxlXCIpKX0gPHNwYW4gY2xhc3M9XCJyZXF1aXJlZC1pbnB1dFwiPio8L3NwYW4+PC9sYWJlbD5cblx0XHRcdDxpbnB1dCBpZD1cImlzc3VlLXRpdGxlXCIgdHlwZT1cInRleHRcIiBjbGFzcz1cImlubGluZS1mb3JtLWNvbnRyb2xcIiBwbGFjZWhvbGRlcj1cIiR7ZXNjYXBlKGxvY2FsaXplKCdpc3N1ZVRpdGxlUmVxdWlyZWQnLCBcIlBsZWFzZSBlbnRlciBhIHRpdGxlLlwiKSl9XCIgcmVxdWlyZWQ+XG5cdFx0XHQ8ZGl2IGlkPVwiaXNzdWUtdGl0bGUtZW1wdHktZXJyb3JcIiBjbGFzcz1cInZhbGlkYXRpb24tZXJyb3IgaGlkZGVuXCIgcm9sZT1cImFsZXJ0XCI+JHtlc2NhcGUobG9jYWxpemUoJ3RpdGxlRW1wdHlWYWxpZGF0aW9uJywgXCJBIHRpdGxlIGlzIHJlcXVpcmVkLlwiKSl9PC9kaXY+XG5cdFx0XHQ8ZGl2IGlkPVwiaXNzdWUtdGl0bGUtbGVuZ3RoLXZhbGlkYXRpb24tZXJyb3JcIiBjbGFzcz1cInZhbGlkYXRpb24tZXJyb3IgaGlkZGVuXCIgcm9sZT1cImFsZXJ0XCI+JHtlc2NhcGUobG9jYWxpemUoJ3RpdGxlTGVuZ3RoVmFsaWRhdGlvbicsIFwiVGhlIHRpdGxlIGlzIHRvbyBsb25nLlwiKSl9PC9kaXY+XG5cdFx0XHQ8c21hbGwgaWQ9XCJzaW1pbGFyLWlzc3Vlc1wiPlxuXHRcdFx0XHQ8IS0tIFRvIGJlIGR5bmFtaWNhbGx5IGZpbGxlZCAtLT5cblx0XHRcdDwvc21hbGw+XG5cdFx0PC9kaXY+XG5cblx0PC9kaXY+XG5cblx0PGRpdiBjbGFzcz1cImlucHV0LWdyb3VwIGRlc2NyaXB0aW9uLXNlY3Rpb25cIj5cblx0XHQ8bGFiZWwgZm9yPVwiZGVzY3JpcHRpb25cIiBpZD1cImlzc3VlLWRlc2NyaXB0aW9uLWxhYmVsXCI+XG5cdFx0XHQ8IS0tIFRvIGJlIGR5bmFtaWNhbGx5IGZpbGxlZCAtLT5cblx0XHQ8L2xhYmVsPlxuXHRcdDxkaXYgY2xhc3M9XCJpbnN0cnVjdGlvbnNcIiBpZD1cImlzc3VlLWRlc2NyaXB0aW9uLXN1YnRpdGxlXCI+XG5cdFx0XHQ8IS0tIFRvIGJlIGR5bmFtaWNhbGx5IGZpbGxlZCAtLT5cblx0XHQ8L2Rpdj5cblx0XHQ8ZGl2IGNsYXNzPVwiYmxvY2staW5mby10ZXh0XCI+XG5cdFx0XHQ8dGV4dGFyZWEgbmFtZT1cImRlc2NyaXB0aW9uXCIgaWQ9XCJkZXNjcmlwdGlvblwiIHBsYWNlaG9sZGVyPVwiJHtlc2NhcGUobG9jYWxpemUoJ2RldGFpbHMnLCBcIlBsZWFzZSBlbnRlciBkZXRhaWxzLlwiKSl9XCIgcmVxdWlyZWQ+PC90ZXh0YXJlYT5cblx0XHQ8L2Rpdj5cblx0XHQ8ZGl2IGlkPVwiZGVzY3JpcHRpb24tZW1wdHktZXJyb3JcIiBjbGFzcz1cInZhbGlkYXRpb24tZXJyb3IgaGlkZGVuXCIgcm9sZT1cImFsZXJ0XCI+JHtlc2NhcGUobG9jYWxpemUoJ2Rlc2NyaXB0aW9uRW1wdHlWYWxpZGF0aW9uJywgXCJBIGRlc2NyaXB0aW9uIGlzIHJlcXVpcmVkLlwiKSl9PC9kaXY+XG5cdFx0PGRpdiBpZD1cImRlc2NyaXB0aW9uLXNob3J0LWVycm9yXCIgY2xhc3M9XCJ2YWxpZGF0aW9uLWVycm9yIGhpZGRlblwiIHJvbGU9XCJhbGVydFwiPiR7ZXNjYXBlKGxvY2FsaXplKCdkZXNjcmlwdGlvblRvb1Nob3J0VmFsaWRhdGlvbicsIFwiUGxlYXNlIHByb3ZpZGUgYSBsb25nZXIgZGVzY3JpcHRpb24uXCIpKX08L2Rpdj5cblx0PC9kaXY+XG5cblx0PGRpdiBjbGFzcz1cInN5c3RlbS1pbmZvXCIgaWQ9XCJibG9jay1jb250YWluZXJcIj5cblx0XHQ8ZGl2IGNsYXNzPVwiYmxvY2sgYmxvY2stZXh0ZW5zaW9uLWRhdGFcIj5cblx0XHRcdDxpbnB1dCBjbGFzcz1cInNlbmQtZXh0ZW5zaW9uLWRhdGFcIiBhcmlhLWxhYmVsPVwiJHtzZW5kRXh0ZW5zaW9uRGF0YX1cIiB0eXBlPVwiY2hlY2tib3hcIiBpZD1cImluY2x1ZGVFeHRlbnNpb25EYXRhXCIgY2hlY2tlZC8+XG5cdFx0XHQ8bGFiZWwgY2xhc3M9XCJleHRlbnNpb24tY2FwdGlvblwiIGlkPVwiZXh0ZW5zaW9uLWNhcHRpb25cIiBmb3I9XCJpbmNsdWRlRXh0ZW5zaW9uRGF0YVwiPlxuXHRcdFx0XHQke3NlbmRFeHRlbnNpb25EYXRhfVxuXHRcdFx0XHQ8c3BhbiBpZD1cImV4dC1sb2FkaW5nXCIgaGlkZGVuPjwvc3Bhbj5cblx0XHRcdFx0PHNwYW4gY2xhc3M9XCJleHQtcGFyZW5zXCIgaGlkZGVuPig8L3NwYW4+PGEgaHJlZj1cIiNcIiBjbGFzcz1cInNob3dJbmZvXCIgaWQ9XCJleHRlbnNpb24taWRcIj4ke2VzY2FwZShsb2NhbGl6ZSgnc2hvdycsIFwic2hvd1wiKSl9PC9hPjxzcGFuIGNsYXNzPVwiZXh0LXBhcmVuc1wiIGhpZGRlbj4pPC9zcGFuPlxuXHRcdFx0XHQ8YSBpZD1cImV4dGVuc2lvbi1kYXRhLWRvd25sb2FkXCI+JHtlc2NhcGUobG9jYWxpemUoJ2Rvd25sb2FkRXh0ZW5zaW9uRGF0YScsIFwiRG93bmxvYWQgRXh0ZW5zaW9uIERhdGFcIikpfTwvYT5cblx0XHRcdDwvbGFiZWw+XG5cdFx0XHQ8cHJlIGNsYXNzPVwiYmxvY2staW5mb1wiIGlkPVwiZXh0ZW5zaW9uLWRhdGFcIiBwbGFjZWhvbGRlcj1cIiR7ZXNjYXBlKGxvY2FsaXplKCdleHRlbnNpb25EYXRhJywgXCJFeHRlbnNpb24gZG9lcyBub3QgaGF2ZSBhZGRpdGlvbmFsIGRhdGEgdG8gaW5jbHVkZS5cIikpfVwiIHN0eWxlPVwid2hpdGUtc3BhY2U6IHByZS13cmFwOyB1c2VyLXNlbGVjdDogdGV4dDtcIj5cblx0XHRcdFx0PCEtLSBUbyBiZSBkeW5hbWljYWxseSBmaWxsZWQgLS0+XG5cdFx0XHQ8L3ByZT5cblx0XHQ8L2Rpdj5cblxuXHRcdDxkaXYgY2xhc3M9XCJibG9jayBibG9jay1zeXN0ZW1cIj5cblx0XHRcdDxpbnB1dCBjbGFzcz1cInNlbmREYXRhXCIgYXJpYS1sYWJlbD1cIiR7c2VuZFN5c3RlbUluZm9MYWJlbH1cIiB0eXBlPVwiY2hlY2tib3hcIiBpZD1cImluY2x1ZGVTeXN0ZW1JbmZvXCIgY2hlY2tlZC8+XG5cdFx0XHQ8bGFiZWwgY2xhc3M9XCJjYXB0aW9uXCIgZm9yPVwiaW5jbHVkZVN5c3RlbUluZm9cIj5cblx0XHRcdFx0JHtzZW5kU3lzdGVtSW5mb0xhYmVsfVxuXHRcdFx0XHQoPGEgaHJlZj1cIiNcIiBjbGFzcz1cInNob3dJbmZvXCI+JHtlc2NhcGUobG9jYWxpemUoJ3Nob3cnLCBcInNob3dcIikpfTwvYT4pXG5cdFx0XHQ8L2xhYmVsPlxuXHRcdFx0PGRpdiBjbGFzcz1cImJsb2NrLWluZm8gaGlkZGVuXCIgc3R5bGU9XCJ1c2VyLXNlbGVjdDogdGV4dDtcIj5cblx0XHRcdFx0PCEtLSBUbyBiZSBkeW5hbWljYWxseSBmaWxsZWQgLS0+XG5cdFx0PC9kaXY+XG5cdFx0PC9kaXY+XG5cdFx0PGRpdiBjbGFzcz1cImJsb2NrIGJsb2NrLXByb2Nlc3NcIj5cblx0XHRcdDxpbnB1dCBjbGFzcz1cInNlbmREYXRhXCIgYXJpYS1sYWJlbD1cIiR7c2VuZFByb2Nlc3NJbmZvTGFiZWx9XCIgdHlwZT1cImNoZWNrYm94XCIgaWQ9XCJpbmNsdWRlUHJvY2Vzc0luZm9cIiBjaGVja2VkLz5cblx0XHRcdDxsYWJlbCBjbGFzcz1cImNhcHRpb25cIiBmb3I9XCJpbmNsdWRlUHJvY2Vzc0luZm9cIj5cblx0XHRcdFx0JHtzZW5kUHJvY2Vzc0luZm9MYWJlbH1cblx0XHRcdFx0KDxhIGhyZWY9XCIjXCIgY2xhc3M9XCJzaG93SW5mb1wiPiR7ZXNjYXBlKGxvY2FsaXplKCdzaG93JywgXCJzaG93XCIpKX08L2E+KVxuXHRcdFx0PC9sYWJlbD5cblx0XHRcdDxwcmUgY2xhc3M9XCJibG9jay1pbmZvIGhpZGRlblwiIHN0eWxlPVwidXNlci1zZWxlY3Q6IHRleHQ7XCI+XG5cdFx0XHRcdDxjb2RlPlxuXHRcdFx0XHQ8IS0tIFRvIGJlIGR5bmFtaWNhbGx5IGZpbGxlZCAtLT5cblx0XHRcdFx0PC9jb2RlPlxuXHRcdFx0PC9wcmU+XG5cdFx0PC9kaXY+XG5cdFx0PGRpdiBjbGFzcz1cImJsb2NrIGJsb2NrLXdvcmtzcGFjZVwiPlxuXHRcdFx0PGlucHV0IGNsYXNzPVwic2VuZERhdGFcIiBhcmlhLWxhYmVsPVwiJHtzZW5kV29ya3NwYWNlSW5mb0xhYmVsfVwiIHR5cGU9XCJjaGVja2JveFwiIGlkPVwiaW5jbHVkZVdvcmtzcGFjZUluZm9cIiBjaGVja2VkLz5cblx0XHRcdDxsYWJlbCBjbGFzcz1cImNhcHRpb25cIiBmb3I9XCJpbmNsdWRlV29ya3NwYWNlSW5mb1wiPlxuXHRcdFx0XHQke3NlbmRXb3Jrc3BhY2VJbmZvTGFiZWx9XG5cdFx0XHRcdCg8YSBocmVmPVwiI1wiIGNsYXNzPVwic2hvd0luZm9cIj4ke2VzY2FwZShsb2NhbGl6ZSgnc2hvdycsIFwic2hvd1wiKSl9PC9hPilcblx0XHRcdDwvbGFiZWw+XG5cdFx0XHQ8cHJlIGlkPVwic3lzdGVtSW5mb1wiIGNsYXNzPVwiYmxvY2staW5mbyBoaWRkZW5cIiBzdHlsZT1cInVzZXItc2VsZWN0OiB0ZXh0O1wiPlxuXHRcdFx0XHQ8Y29kZT5cblx0XHRcdFx0PCEtLSBUbyBiZSBkeW5hbWljYWxseSBmaWxsZWQgLS0+XG5cdFx0XHRcdDwvY29kZT5cblx0XHRcdDwvcHJlPlxuXHRcdDwvZGl2PlxuXHRcdDxkaXYgY2xhc3M9XCJibG9jayBibG9jay1leHRlbnNpb25zXCI+XG5cdFx0XHQ8aW5wdXQgY2xhc3M9XCJzZW5kRGF0YVwiIGFyaWEtbGFiZWw9XCIke3NlbmRFeHRlbnNpb25zTGFiZWx9XCIgdHlwZT1cImNoZWNrYm94XCIgaWQ9XCJpbmNsdWRlRXh0ZW5zaW9uc1wiIGNoZWNrZWQvPlxuXHRcdFx0PGxhYmVsIGNsYXNzPVwiY2FwdGlvblwiIGZvcj1cImluY2x1ZGVFeHRlbnNpb25zXCI+XG5cdFx0XHRcdCR7c2VuZEV4dGVuc2lvbnNMYWJlbH1cblx0XHRcdFx0KDxhIGhyZWY9XCIjXCIgY2xhc3M9XCJzaG93SW5mb1wiPiR7ZXNjYXBlKGxvY2FsaXplKCdzaG93JywgXCJzaG93XCIpKX08L2E+KVxuXHRcdFx0PC9sYWJlbD5cblx0XHRcdDxkaXYgaWQ9XCJzeXN0ZW1JbmZvXCIgY2xhc3M9XCJibG9jay1pbmZvIGhpZGRlblwiIHN0eWxlPVwidXNlci1zZWxlY3Q6IHRleHQ7XCI+XG5cdFx0XHRcdDwhLS0gVG8gYmUgZHluYW1pY2FsbHkgZmlsbGVkIC0tPlxuXHRcdFx0PC9kaXY+XG5cdFx0PC9kaXY+XG5cdFx0PGRpdiBjbGFzcz1cImJsb2NrIGJsb2NrLWV4cGVyaW1lbnRzXCI+XG5cdFx0XHQ8aW5wdXQgY2xhc3M9XCJzZW5kRGF0YVwiIGFyaWEtbGFiZWw9XCIke3NlbmRFeHBlcmltZW50c0xhYmVsfVwiIHR5cGU9XCJjaGVja2JveFwiIGlkPVwiaW5jbHVkZUV4cGVyaW1lbnRzXCIgY2hlY2tlZC8+XG5cdFx0XHQ8bGFiZWwgY2xhc3M9XCJjYXB0aW9uXCIgZm9yPVwiaW5jbHVkZUV4cGVyaW1lbnRzXCI+XG5cdFx0XHRcdCR7c2VuZEV4cGVyaW1lbnRzTGFiZWx9XG5cdFx0XHRcdCg8YSBocmVmPVwiI1wiIGNsYXNzPVwic2hvd0luZm9cIj4ke2VzY2FwZShsb2NhbGl6ZSgnc2hvdycsIFwic2hvd1wiKSl9PC9hPilcblx0XHRcdDwvbGFiZWw+XG5cdFx0XHQ8cHJlIGNsYXNzPVwiYmxvY2staW5mbyBoaWRkZW5cIiBzdHlsZT1cInVzZXItc2VsZWN0OiB0ZXh0O1wiPlxuXHRcdFx0XHQ8IS0tIFRvIGJlIGR5bmFtaWNhbGx5IGZpbGxlZCAtLT5cblx0XHRcdDwvcHJlPlxuXHRcdDwvZGl2PlxuXHRcdDxkaXYgY2xhc3M9XCJibG9jayBibG9jay1hY2tub3dsZWRnZW1lbnRzIGhpZGRlblwiIGlkPVwidmVyc2lvbi1hY2tub3dsZWRnZW1lbnRzXCI+XG5cdFx0XHQ8aW5wdXQgY2xhc3M9XCJzZW5kRGF0YVwiIGFyaWEtbGFiZWw9XCIke2Fja25vd2xlZGdlbWVudHNMYWJlbH1cIiB0eXBlPVwiY2hlY2tib3hcIiBpZD1cImluY2x1ZGVBY2tub3dsZWRnZW1lbnRcIi8+XG5cdFx0XHQ8bGFiZWwgY2xhc3M9XCJjYXB0aW9uXCIgZm9yPVwiaW5jbHVkZUFja25vd2xlZGdlbWVudFwiPlxuXHRcdFx0XHQke2Fja25vd2xlZGdlbWVudHNMYWJlbH1cblx0XHRcdDwvbGFiZWw+XG5cdFx0PC9kaXY+XG5cdDwvZGl2PlxuPC9kaXY+YDtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsY0FBYztBQUN2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
