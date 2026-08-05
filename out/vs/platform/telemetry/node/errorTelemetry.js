import { isCancellationError, isSigPipeError, onUnexpectedError, setUnexpectedErrorHandler } from "../../../base/common/errors.js";
import BaseErrorTelemetry from "../common/errorTelemetry.js";
class ErrorTelemetry extends BaseErrorTelemetry {
  installErrorListeners() {
    setUnexpectedErrorHandler((err) => console.error(err));
    const unhandledPromises = [];
    process.on("unhandledRejection", (reason, promise) => {
      unhandledPromises.push(promise);
      setTimeout(() => {
        const idx = unhandledPromises.indexOf(promise);
        if (idx >= 0) {
          promise.catch((e) => {
            unhandledPromises.splice(idx, 1);
            if (!isCancellationError(e)) {
              console.warn(`rejected promise not handled within 1 second: ${e}`);
              if (e.stack) {
                console.warn(`stack trace: ${e.stack}`);
              }
              if (reason) {
                onUnexpectedError(reason);
              }
            }
          });
        }
      }, 1e3);
    });
    process.on("rejectionHandled", (promise) => {
      const idx = unhandledPromises.indexOf(promise);
      if (idx >= 0) {
        unhandledPromises.splice(idx, 1);
      }
    });
    process.on("uncaughtException", (err) => {
      if (isSigPipeError(err)) {
        return;
      }
      onUnexpectedError(err);
    });
  }
}
export {
  ErrorTelemetry as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZWxlbWV0cnkvbm9kZS9lcnJvclRlbGVtZXRyeS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IsIGlzU2lnUGlwZUVycm9yLCBvblVuZXhwZWN0ZWRFcnJvciwgc2V0VW5leHBlY3RlZEVycm9ySGFuZGxlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgQmFzZUVycm9yVGVsZW1ldHJ5IGZyb20gJy4uL2NvbW1vbi9lcnJvclRlbGVtZXRyeS5qcyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVycm9yVGVsZW1ldHJ5IGV4dGVuZHMgQmFzZUVycm9yVGVsZW1ldHJ5IHtcblx0cHJvdGVjdGVkIG92ZXJyaWRlIGluc3RhbGxFcnJvckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKGVyciA9PiBjb25zb2xlLmVycm9yKGVycikpO1xuXG5cdFx0Ly8gUHJpbnQgYSBjb25zb2xlIG1lc3NhZ2Ugd2hlbiByZWplY3Rpb24gaXNuJ3QgaGFuZGxlZCB3aXRoaW4gTiBzZWNvbmRzLiBGb3IgZGV0YWlsczpcblx0XHQvLyBzZWUgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19ldmVudF91bmhhbmRsZWRyZWplY3Rpb25cblx0XHQvLyBhbmQgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19ldmVudF9yZWplY3Rpb25oYW5kbGVkXG5cdFx0Y29uc3QgdW5oYW5kbGVkUHJvbWlzZXM6IFByb21pc2U8YW55PltdID0gW107XG5cdFx0cHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgKHJlYXNvbjogYW55LCBwcm9taXNlOiBQcm9taXNlPGFueT4pID0+IHtcblx0XHRcdHVuaGFuZGxlZFByb21pc2VzLnB1c2gocHJvbWlzZSk7XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0Y29uc3QgaWR4ID0gdW5oYW5kbGVkUHJvbWlzZXMuaW5kZXhPZihwcm9taXNlKTtcblx0XHRcdFx0aWYgKGlkeCA+PSAwKSB7XG5cdFx0XHRcdFx0cHJvbWlzZS5jYXRjaChlID0+IHtcblx0XHRcdFx0XHRcdHVuaGFuZGxlZFByb21pc2VzLnNwbGljZShpZHgsIDEpO1xuXHRcdFx0XHRcdFx0aWYgKCFpc0NhbmNlbGxhdGlvbkVycm9yKGUpKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUud2FybihgcmVqZWN0ZWQgcHJvbWlzZSBub3QgaGFuZGxlZCB3aXRoaW4gMSBzZWNvbmQ6ICR7ZX1gKTtcblx0XHRcdFx0XHRcdFx0aWYgKGUuc3RhY2spIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oYHN0YWNrIHRyYWNlOiAke2Uuc3RhY2t9YCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKHJlYXNvbikge1xuXHRcdFx0XHRcdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKHJlYXNvbik7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgMTAwMCk7XG5cdFx0fSk7XG5cblx0XHRwcm9jZXNzLm9uKCdyZWplY3Rpb25IYW5kbGVkJywgKHByb21pc2U6IFByb21pc2U8YW55PikgPT4ge1xuXHRcdFx0Y29uc3QgaWR4ID0gdW5oYW5kbGVkUHJvbWlzZXMuaW5kZXhPZihwcm9taXNlKTtcblx0XHRcdGlmIChpZHggPj0gMCkge1xuXHRcdFx0XHR1bmhhbmRsZWRQcm9taXNlcy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIFByaW50IGEgY29uc29sZSBtZXNzYWdlIHdoZW4gYW4gZXhjZXB0aW9uIGlzbid0IGhhbmRsZWQuXG5cdFx0cHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCAoZXJyOiBFcnJvciB8IE5vZGVKUy5FcnJub0V4Y2VwdGlvbikgPT4ge1xuXHRcdFx0aWYgKGlzU2lnUGlwZUVycm9yKGVycikpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnIpO1xuXHRcdH0pO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHFCQUFxQixnQkFBZ0IsbUJBQW1CLGlDQUFpQztBQUNsRyxPQUFPLHdCQUF3QjtBQUUvQixNQUFPLHVCQUFxQyxtQkFBbUI7QUFBQSxFQUMzQyx3QkFBOEI7QUFDaEQsOEJBQTBCLFNBQU8sUUFBUSxNQUFNLEdBQUcsQ0FBQztBQUtuRCxVQUFNLG9CQUFvQyxDQUFDO0FBQzNDLFlBQVEsR0FBRyxzQkFBc0IsQ0FBQyxRQUFhLFlBQTBCO0FBQ3hFLHdCQUFrQixLQUFLLE9BQU87QUFDOUIsaUJBQVcsTUFBTTtBQUNoQixjQUFNLE1BQU0sa0JBQWtCLFFBQVEsT0FBTztBQUM3QyxZQUFJLE9BQU8sR0FBRztBQUNiLGtCQUFRLE1BQU0sT0FBSztBQUNsQiw4QkFBa0IsT0FBTyxLQUFLLENBQUM7QUFDL0IsZ0JBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHO0FBQzVCLHNCQUFRLEtBQUssaURBQWlELENBQUMsRUFBRTtBQUNqRSxrQkFBSSxFQUFFLE9BQU87QUFDWix3QkFBUSxLQUFLLGdCQUFnQixFQUFFLEtBQUssRUFBRTtBQUFBLGNBQ3ZDO0FBQ0Esa0JBQUksUUFBUTtBQUNYLGtDQUFrQixNQUFNO0FBQUEsY0FDekI7QUFBQSxZQUNEO0FBQUEsVUFDRCxDQUFDO0FBQUEsUUFDRjtBQUFBLE1BQ0QsR0FBRyxHQUFJO0FBQUEsSUFDUixDQUFDO0FBRUQsWUFBUSxHQUFHLG9CQUFvQixDQUFDLFlBQTBCO0FBQ3pELFlBQU0sTUFBTSxrQkFBa0IsUUFBUSxPQUFPO0FBQzdDLFVBQUksT0FBTyxHQUFHO0FBQ2IsMEJBQWtCLE9BQU8sS0FBSyxDQUFDO0FBQUEsTUFDaEM7QUFBQSxJQUNELENBQUM7QUFHRCxZQUFRLEdBQUcscUJBQXFCLENBQUMsUUFBdUM7QUFDdkUsVUFBSSxlQUFlLEdBQUcsR0FBRztBQUN4QjtBQUFBLE1BQ0Q7QUFFQSx3QkFBa0IsR0FBRztBQUFBLElBQ3RCLENBQUM7QUFBQSxFQUNGO0FBQ0Q7IiwKICAibmFtZXMiOiBbXQp9Cg==
