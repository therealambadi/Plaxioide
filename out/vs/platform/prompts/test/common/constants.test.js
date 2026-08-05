import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import { randomInt } from "../../../../base/common/numbers.js";
import { getCleanPromptName, isPromptFile } from "../../common/constants.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
suite("Prompt Constants", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("\u2022 getCleanPromptName", () => {
    test("\u2022 returns a clean prompt name", () => {
      assert.strictEqual(
        getCleanPromptName(URI.file("/path/to/my-prompt.prompt.md")),
        "my-prompt"
      );
      assert.strictEqual(
        getCleanPromptName(URI.file("../common.prompt.md")),
        "common"
      );
      const expectedPromptName = `some-${randomInt(1e3)}`;
      assert.strictEqual(
        getCleanPromptName(URI.file(`./${expectedPromptName}.prompt.md`)),
        expectedPromptName
      );
      assert.strictEqual(
        getCleanPromptName(URI.file(".github/copilot-instructions.md")),
        "copilot-instructions"
      );
    });
    test("\u2022 throws if not a prompt file URI provided", () => {
      assert.throws(() => {
        getCleanPromptName(URI.file("/path/to/default.prompt.md1"));
      });
      assert.throws(() => {
        getCleanPromptName(URI.file("./some.md"));
      });
      assert.throws(() => {
        getCleanPromptName(URI.file("../some-folder/frequent.txt"));
      });
      assert.throws(() => {
        getCleanPromptName(URI.file("/etc/prompts/my-prompt"));
      });
    });
  });
  suite("\u2022 isPromptFile", () => {
    test("\u2022 returns `true` for prompt files", () => {
      assert(
        isPromptFile(URI.file("/path/to/my-prompt.prompt.md"))
      );
      assert(
        isPromptFile(URI.file("../common.prompt.md"))
      );
      assert(
        isPromptFile(URI.file(`./some-${randomInt(1e3)}.prompt.md`))
      );
      assert(
        isPromptFile(URI.file(".github/copilot-instructions.md"))
      );
    });
    test("\u2022 returns `false` for non-prompt files", () => {
      assert(
        !isPromptFile(URI.file("/path/to/my-prompt.prompt.md1"))
      );
      assert(
        !isPromptFile(URI.file("../common.md"))
      );
      assert(
        !isPromptFile(URI.file(`./some-${randomInt(1e3)}.txt`))
      );
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9wcm9tcHRzL3Rlc3QvY29tbW9uL2NvbnN0YW50cy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IHJhbmRvbUludCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL251bWJlcnMuanMnO1xuaW1wb3J0IHsgZ2V0Q2xlYW5Qcm9tcHROYW1lLCBpc1Byb21wdEZpbGUgfSBmcm9tICcuLi8uLi9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5cbnN1aXRlKCdQcm9tcHQgQ29uc3RhbnRzJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzdWl0ZSgnXHUyMDIyIGdldENsZWFuUHJvbXB0TmFtZScsICgpID0+IHtcblx0XHR0ZXN0KCdcdTIwMjIgcmV0dXJucyBhIGNsZWFuIHByb21wdCBuYW1lJywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0XHRnZXRDbGVhblByb21wdE5hbWUoVVJJLmZpbGUoJy9wYXRoL3RvL215LXByb21wdC5wcm9tcHQubWQnKSksXG5cdFx0XHRcdCdteS1wcm9tcHQnLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0XHRnZXRDbGVhblByb21wdE5hbWUoVVJJLmZpbGUoJy4uL2NvbW1vbi5wcm9tcHQubWQnKSksXG5cdFx0XHRcdCdjb21tb24nLFxuXHRcdFx0KTtcblxuXHRcdFx0Y29uc3QgZXhwZWN0ZWRQcm9tcHROYW1lID0gYHNvbWUtJHtyYW5kb21JbnQoMTAwMCl9YDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdFx0Z2V0Q2xlYW5Qcm9tcHROYW1lKFVSSS5maWxlKGAuLyR7ZXhwZWN0ZWRQcm9tcHROYW1lfS5wcm9tcHQubWRgKSksXG5cdFx0XHRcdGV4cGVjdGVkUHJvbXB0TmFtZSxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdFx0Z2V0Q2xlYW5Qcm9tcHROYW1lKFVSSS5maWxlKCcuZ2l0aHViL2NvcGlsb3QtaW5zdHJ1Y3Rpb25zLm1kJykpLFxuXHRcdFx0XHQnY29waWxvdC1pbnN0cnVjdGlvbnMnLFxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ1x1MjAyMiB0aHJvd3MgaWYgbm90IGEgcHJvbXB0IGZpbGUgVVJJIHByb3ZpZGVkJywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdGdldENsZWFuUHJvbXB0TmFtZShVUkkuZmlsZSgnL3BhdGgvdG8vZGVmYXVsdC5wcm9tcHQubWQxJykpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRnZXRDbGVhblByb21wdE5hbWUoVVJJLmZpbGUoJy4vc29tZS5tZCcpKTtcblx0XHRcdH0pO1xuXG5cblx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRnZXRDbGVhblByb21wdE5hbWUoVVJJLmZpbGUoJy4uL3NvbWUtZm9sZGVyL2ZyZXF1ZW50LnR4dCcpKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0Z2V0Q2xlYW5Qcm9tcHROYW1lKFVSSS5maWxlKCcvZXRjL3Byb21wdHMvbXktcHJvbXB0JykpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdcdTIwMjIgaXNQcm9tcHRGaWxlJywgKCkgPT4ge1xuXHRcdHRlc3QoJ1x1MjAyMiByZXR1cm5zIGB0cnVlYCBmb3IgcHJvbXB0IGZpbGVzJywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRpc1Byb21wdEZpbGUoVVJJLmZpbGUoJy9wYXRoL3RvL215LXByb21wdC5wcm9tcHQubWQnKSksXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdGlzUHJvbXB0RmlsZShVUkkuZmlsZSgnLi4vY29tbW9uLnByb21wdC5tZCcpKSxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0aXNQcm9tcHRGaWxlKFVSSS5maWxlKGAuL3NvbWUtJHtyYW5kb21JbnQoMTAwMCl9LnByb21wdC5tZGApKSxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0aXNQcm9tcHRGaWxlKFVSSS5maWxlKCcuZ2l0aHViL2NvcGlsb3QtaW5zdHJ1Y3Rpb25zLm1kJykpLFxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ1x1MjAyMiByZXR1cm5zIGBmYWxzZWAgZm9yIG5vbi1wcm9tcHQgZmlsZXMnLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdCFpc1Byb21wdEZpbGUoVVJJLmZpbGUoJy9wYXRoL3RvL215LXByb21wdC5wcm9tcHQubWQxJykpLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHQhaXNQcm9tcHRGaWxlKFVSSS5maWxlKCcuLi9jb21tb24ubWQnKSksXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdCFpc1Byb21wdEZpbGUoVVJJLmZpbGUoYC4vc29tZS0ke3JhbmRvbUludCgxMDAwKX0udHh0YCkpLFxuXHRcdFx0KTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxvQkFBb0Isb0JBQW9CO0FBQ2pELFNBQVMsK0NBQStDO0FBR3hELE1BQU0sb0JBQW9CLE1BQU07QUFDL0IsMENBQXdDO0FBRXhDLFFBQU0sNkJBQXdCLE1BQU07QUFDbkMsU0FBSyxzQ0FBaUMsTUFBTTtBQUMzQyxhQUFPO0FBQUEsUUFDTixtQkFBbUIsSUFBSSxLQUFLLDhCQUE4QixDQUFDO0FBQUEsUUFDM0Q7QUFBQSxNQUNEO0FBRUEsYUFBTztBQUFBLFFBQ04sbUJBQW1CLElBQUksS0FBSyxxQkFBcUIsQ0FBQztBQUFBLFFBQ2xEO0FBQUEsTUFDRDtBQUVBLFlBQU0scUJBQXFCLFFBQVEsVUFBVSxHQUFJLENBQUM7QUFDbEQsYUFBTztBQUFBLFFBQ04sbUJBQW1CLElBQUksS0FBSyxLQUFLLGtCQUFrQixZQUFZLENBQUM7QUFBQSxRQUNoRTtBQUFBLE1BQ0Q7QUFFQSxhQUFPO0FBQUEsUUFDTixtQkFBbUIsSUFBSSxLQUFLLGlDQUFpQyxDQUFDO0FBQUEsUUFDOUQ7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBRUQsU0FBSyxtREFBOEMsTUFBTTtBQUN4RCxhQUFPLE9BQU8sTUFBTTtBQUNuQiwyQkFBbUIsSUFBSSxLQUFLLDZCQUE2QixDQUFDO0FBQUEsTUFDM0QsQ0FBQztBQUVELGFBQU8sT0FBTyxNQUFNO0FBQ25CLDJCQUFtQixJQUFJLEtBQUssV0FBVyxDQUFDO0FBQUEsTUFDekMsQ0FBQztBQUdELGFBQU8sT0FBTyxNQUFNO0FBQ25CLDJCQUFtQixJQUFJLEtBQUssNkJBQTZCLENBQUM7QUFBQSxNQUMzRCxDQUFDO0FBRUQsYUFBTyxPQUFPLE1BQU07QUFDbkIsMkJBQW1CLElBQUksS0FBSyx3QkFBd0IsQ0FBQztBQUFBLE1BQ3RELENBQUM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxRQUFNLHVCQUFrQixNQUFNO0FBQzdCLFNBQUssMENBQXFDLE1BQU07QUFDL0M7QUFBQSxRQUNDLGFBQWEsSUFBSSxLQUFLLDhCQUE4QixDQUFDO0FBQUEsTUFDdEQ7QUFFQTtBQUFBLFFBQ0MsYUFBYSxJQUFJLEtBQUsscUJBQXFCLENBQUM7QUFBQSxNQUM3QztBQUVBO0FBQUEsUUFDQyxhQUFhLElBQUksS0FBSyxVQUFVLFVBQVUsR0FBSSxDQUFDLFlBQVksQ0FBQztBQUFBLE1BQzdEO0FBRUE7QUFBQSxRQUNDLGFBQWEsSUFBSSxLQUFLLGlDQUFpQyxDQUFDO0FBQUEsTUFDekQ7QUFBQSxJQUNELENBQUM7QUFFRCxTQUFLLCtDQUEwQyxNQUFNO0FBQ3BEO0FBQUEsUUFDQyxDQUFDLGFBQWEsSUFBSSxLQUFLLCtCQUErQixDQUFDO0FBQUEsTUFDeEQ7QUFFQTtBQUFBLFFBQ0MsQ0FBQyxhQUFhLElBQUksS0FBSyxjQUFjLENBQUM7QUFBQSxNQUN2QztBQUVBO0FBQUEsUUFDQyxDQUFDLGFBQWEsSUFBSSxLQUFLLFVBQVUsVUFBVSxHQUFJLENBQUMsTUFBTSxDQUFDO0FBQUEsTUFDeEQ7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
