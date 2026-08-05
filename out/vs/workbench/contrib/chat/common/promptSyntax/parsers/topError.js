import { localize } from "../../../../../../nls.js";
import { assert } from "../../../../../../base/common/assert.js";
import { assertDefined } from "../../../../../../base/common/types.js";
import { OpenFailed, RecursiveReference, FailedToResolveContentsStream } from "../../promptFileReferenceErrors.js";
class TopError {
  constructor(options) {
    this.options = options;
    this.originalError = options.originalError;
    this.errorSubject = options.errorSubject;
    this.errorsCount = options.errorsCount;
    this.parentUri = options.parentUri;
  }
  get localizedMessage() {
    const { originalError, parentUri, errorSubject: subject, errorsCount } = this;
    assert(
      errorsCount >= 1,
      `Error count must be at least 1, got '${errorsCount}'.`
    );
    const moreIssuesLabel = errorsCount > 1 ? localize("workbench.reusable-prompts.top-error.more-issues-label", "\n(+{0} more issues)", errorsCount - 1) : "";
    if (subject === "root") {
      if (originalError instanceof OpenFailed) {
        return localize(
          "workbench.reusable-prompts.top-error.open-failed",
          "Cannot open '{0}'.{1}",
          originalError.uri.path,
          moreIssuesLabel
        );
      }
      if (originalError instanceof FailedToResolveContentsStream) {
        return localize(
          "workbench.reusable-prompts.top-error.cannot-read",
          "Cannot read '{0}'.{1}",
          originalError.uri.path,
          moreIssuesLabel
        );
      }
      if (originalError instanceof RecursiveReference) {
        return localize(
          "workbench.reusable-prompts.top-error.recursive-reference",
          "Recursion to itself."
        );
      }
      return originalError.message + moreIssuesLabel;
    }
    assertDefined(
      parentUri,
      "Parent URI must be defined for error of non-root link."
    );
    const errorMessageStart = subject === "child" ? localize(
      "workbench.reusable-prompts.top-error.child.direct",
      "Contains"
    ) : localize(
      "workbench.reusable-prompts.top-error.child.indirect",
      "Indirectly referenced prompt '{0}' contains",
      parentUri.path
    );
    const linkIssueName = originalError instanceof RecursiveReference ? localize("recursive", "recursive") : localize("broken", "broken");
    return localize(
      "workbench.reusable-prompts.top-error.child.final-message",
      "{0} a {1} link to '{2}' that will be ignored.{3}",
      errorMessageStart,
      linkIssueName,
      originalError.uri.path,
      moreIssuesLabel
    );
  }
}
export {
  TopError
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvcGFyc2Vycy90b3BFcnJvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElUb3BFcnJvciB9IGZyb20gJy4vdHlwZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXNzZXJ0LmpzJztcbmltcG9ydCB7IGFzc2VydERlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBPcGVuRmFpbGVkLCBSZWN1cnNpdmVSZWZlcmVuY2UsIEZhaWxlZFRvUmVzb2x2ZUNvbnRlbnRzU3RyZWFtIH0gZnJvbSAnLi4vLi4vcHJvbXB0RmlsZVJlZmVyZW5jZUVycm9ycy5qcyc7XG5cbi8qKlxuICogVGhlIHRvcC1tb3N0IGVycm9yIG9mIHRoZSByZWZlcmVuY2UgdHJlZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFRvcEVycm9yIGltcGxlbWVudHMgSVRvcEVycm9yIHtcblx0cHVibGljIHJlYWRvbmx5IG9yaWdpbmFsRXJyb3I6IElUb3BFcnJvclsnb3JpZ2luYWxFcnJvciddO1xuXHRwdWJsaWMgcmVhZG9ubHkgZXJyb3JTdWJqZWN0OiBJVG9wRXJyb3JbJ2Vycm9yU3ViamVjdCddO1xuXHRwdWJsaWMgcmVhZG9ubHkgZXJyb3JzQ291bnQ6IElUb3BFcnJvclsnZXJyb3JzQ291bnQnXTtcblx0cHVibGljIHJlYWRvbmx5IHBhcmVudFVyaTogSVRvcEVycm9yWydwYXJlbnRVcmknXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBvcHRpb25zOiBPbWl0PElUb3BFcnJvciwgJ2xvY2FsaXplZE1lc3NhZ2UnPixcblx0KSB7XG5cdFx0dGhpcy5vcmlnaW5hbEVycm9yID0gb3B0aW9ucy5vcmlnaW5hbEVycm9yO1xuXHRcdHRoaXMuZXJyb3JTdWJqZWN0ID0gb3B0aW9ucy5lcnJvclN1YmplY3Q7XG5cdFx0dGhpcy5lcnJvcnNDb3VudCA9IG9wdGlvbnMuZXJyb3JzQ291bnQ7XG5cdFx0dGhpcy5wYXJlbnRVcmkgPSBvcHRpb25zLnBhcmVudFVyaTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgbG9jYWxpemVkTWVzc2FnZSgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHsgb3JpZ2luYWxFcnJvciwgcGFyZW50VXJpLCBlcnJvclN1YmplY3Q6IHN1YmplY3QsIGVycm9yc0NvdW50IH0gPSB0aGlzO1xuXG5cdFx0YXNzZXJ0KFxuXHRcdFx0ZXJyb3JzQ291bnQgPj0gMSxcblx0XHRcdGBFcnJvciBjb3VudCBtdXN0IGJlIGF0IGxlYXN0IDEsIGdvdCAnJHtlcnJvcnNDb3VudH0nLmAsXG5cdFx0KTtcblxuXHRcdC8vIGEgbm90ZSBhYm91dCBob3cgbWFueSBtb3JlIGxpbmsgaXNzdWVzIGFyZSB0aGVyZVxuXHRcdGNvbnN0IG1vcmVJc3N1ZXNMYWJlbCA9IChlcnJvcnNDb3VudCA+IDEpXG5cdFx0XHQ/IGxvY2FsaXplKCd3b3JrYmVuY2gucmV1c2FibGUtcHJvbXB0cy50b3AtZXJyb3IubW9yZS1pc3N1ZXMtbGFiZWwnLCBcIlxcbigrezB9IG1vcmUgaXNzdWVzKVwiLCBlcnJvcnNDb3VudCAtIDEpXG5cdFx0XHQ6ICcnO1xuXG5cdFx0aWYgKHN1YmplY3QgPT09ICdyb290Jykge1xuXHRcdFx0aWYgKG9yaWdpbmFsRXJyb3IgaW5zdGFuY2VvZiBPcGVuRmFpbGVkKSB7XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZShcblx0XHRcdFx0XHQnd29ya2JlbmNoLnJldXNhYmxlLXByb21wdHMudG9wLWVycm9yLm9wZW4tZmFpbGVkJyxcblx0XHRcdFx0XHRcIkNhbm5vdCBvcGVuICd7MH0nLnsxfVwiLFxuXHRcdFx0XHRcdG9yaWdpbmFsRXJyb3IudXJpLnBhdGgsXG5cdFx0XHRcdFx0bW9yZUlzc3Vlc0xhYmVsLFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob3JpZ2luYWxFcnJvciBpbnN0YW5jZW9mIEZhaWxlZFRvUmVzb2x2ZUNvbnRlbnRzU3RyZWFtKSB7XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZShcblx0XHRcdFx0XHQnd29ya2JlbmNoLnJldXNhYmxlLXByb21wdHMudG9wLWVycm9yLmNhbm5vdC1yZWFkJyxcblx0XHRcdFx0XHRcIkNhbm5vdCByZWFkICd7MH0nLnsxfVwiLFxuXHRcdFx0XHRcdG9yaWdpbmFsRXJyb3IudXJpLnBhdGgsXG5cdFx0XHRcdFx0bW9yZUlzc3Vlc0xhYmVsLFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob3JpZ2luYWxFcnJvciBpbnN0YW5jZW9mIFJlY3Vyc2l2ZVJlZmVyZW5jZSkge1xuXHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoXG5cdFx0XHRcdFx0J3dvcmtiZW5jaC5yZXVzYWJsZS1wcm9tcHRzLnRvcC1lcnJvci5yZWN1cnNpdmUtcmVmZXJlbmNlJyxcblx0XHRcdFx0XHRcIlJlY3Vyc2lvbiB0byBpdHNlbGYuXCIsXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBvcmlnaW5hbEVycm9yLm1lc3NhZ2UgKyBtb3JlSXNzdWVzTGFiZWw7XG5cdFx0fVxuXG5cdFx0Ly8gYSBzYW5pdHkgY2hlY2sgLSBiZWNhdXNlIHRoZSBlcnJvciBzdWJqZWN0IGlzIG5vdCBgcm9vdGAsIHRoZSBwYXJlbnQgbXVzdCBzZXRcblx0XHRhc3NlcnREZWZpbmVkKFxuXHRcdFx0cGFyZW50VXJpLFxuXHRcdFx0J1BhcmVudCBVUkkgbXVzdCBiZSBkZWZpbmVkIGZvciBlcnJvciBvZiBub24tcm9vdCBsaW5rLicsXG5cdFx0KTtcblxuXHRcdGNvbnN0IGVycm9yTWVzc2FnZVN0YXJ0ID0gKHN1YmplY3QgPT09ICdjaGlsZCcpXG5cdFx0XHQ/IGxvY2FsaXplKFxuXHRcdFx0XHQnd29ya2JlbmNoLnJldXNhYmxlLXByb21wdHMudG9wLWVycm9yLmNoaWxkLmRpcmVjdCcsXG5cdFx0XHRcdFwiQ29udGFpbnNcIixcblx0XHRcdClcblx0XHRcdDogbG9jYWxpemUoXG5cdFx0XHRcdCd3b3JrYmVuY2gucmV1c2FibGUtcHJvbXB0cy50b3AtZXJyb3IuY2hpbGQuaW5kaXJlY3QnLFxuXHRcdFx0XHRcIkluZGlyZWN0bHkgcmVmZXJlbmNlZCBwcm9tcHQgJ3swfScgY29udGFpbnNcIixcblx0XHRcdFx0cGFyZW50VXJpLnBhdGgsXG5cdFx0XHQpO1xuXG5cdFx0Y29uc3QgbGlua0lzc3VlTmFtZSA9IChvcmlnaW5hbEVycm9yIGluc3RhbmNlb2YgUmVjdXJzaXZlUmVmZXJlbmNlKVxuXHRcdFx0PyBsb2NhbGl6ZSgncmVjdXJzaXZlJywgXCJyZWN1cnNpdmVcIilcblx0XHRcdDogbG9jYWxpemUoJ2Jyb2tlbicsIFwiYnJva2VuXCIpO1xuXG5cdFx0cmV0dXJuIGxvY2FsaXplKFxuXHRcdFx0J3dvcmtiZW5jaC5yZXVzYWJsZS1wcm9tcHRzLnRvcC1lcnJvci5jaGlsZC5maW5hbC1tZXNzYWdlJyxcblx0XHRcdFwiezB9IGEgezF9IGxpbmsgdG8gJ3syfScgdGhhdCB3aWxsIGJlIGlnbm9yZWQuezN9XCIsXG5cdFx0XHRlcnJvck1lc3NhZ2VTdGFydCxcblx0XHRcdGxpbmtJc3N1ZU5hbWUsXG5cdFx0XHRvcmlnaW5hbEVycm9yLnVyaS5wYXRoLFxuXHRcdFx0bW9yZUlzc3Vlc0xhYmVsLFxuXHRcdCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsY0FBYztBQUN2QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLFlBQVksb0JBQW9CLHFDQUFxQztBQUt2RSxNQUFNLFNBQThCO0FBQUEsRUFNMUMsWUFDVSxTQUNSO0FBRFE7QUFFVCxTQUFLLGdCQUFnQixRQUFRO0FBQzdCLFNBQUssZUFBZSxRQUFRO0FBQzVCLFNBQUssY0FBYyxRQUFRO0FBQzNCLFNBQUssWUFBWSxRQUFRO0FBQUEsRUFDMUI7QUFBQSxFQUVBLElBQVcsbUJBQTJCO0FBQ3JDLFVBQU0sRUFBRSxlQUFlLFdBQVcsY0FBYyxTQUFTLFlBQVksSUFBSTtBQUV6RTtBQUFBLE1BQ0MsZUFBZTtBQUFBLE1BQ2Ysd0NBQXdDLFdBQVc7QUFBQSxJQUNwRDtBQUdBLFVBQU0sa0JBQW1CLGNBQWMsSUFDcEMsU0FBUywwREFBMEQsd0JBQXdCLGNBQWMsQ0FBQyxJQUMxRztBQUVILFFBQUksWUFBWSxRQUFRO0FBQ3ZCLFVBQUkseUJBQXlCLFlBQVk7QUFDeEMsZUFBTztBQUFBLFVBQ047QUFBQSxVQUNBO0FBQUEsVUFDQSxjQUFjLElBQUk7QUFBQSxVQUNsQjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBRUEsVUFBSSx5QkFBeUIsK0JBQStCO0FBQzNELGVBQU87QUFBQSxVQUNOO0FBQUEsVUFDQTtBQUFBLFVBQ0EsY0FBYyxJQUFJO0FBQUEsVUFDbEI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUVBLFVBQUkseUJBQXlCLG9CQUFvQjtBQUNoRCxlQUFPO0FBQUEsVUFDTjtBQUFBLFVBQ0E7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUVBLGFBQU8sY0FBYyxVQUFVO0FBQUEsSUFDaEM7QUFHQTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUVBLFVBQU0sb0JBQXFCLFlBQVksVUFDcEM7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLElBQ0QsSUFDRTtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsTUFDQSxVQUFVO0FBQUEsSUFDWDtBQUVELFVBQU0sZ0JBQWlCLHlCQUF5QixxQkFDN0MsU0FBUyxhQUFhLFdBQVcsSUFDakMsU0FBUyxVQUFVLFFBQVE7QUFFOUIsV0FBTztBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLGNBQWMsSUFBSTtBQUFBLE1BQ2xCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDsiLAogICJuYW1lcyI6IFtdCn0K
