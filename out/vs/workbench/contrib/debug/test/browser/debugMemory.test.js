import assert from "assert";
import { decodeBase64, encodeBase64, VSBuffer } from "../../../../../base/common/buffer.js";
import { Emitter } from "../../../../../base/common/event.js";
import { mockObject } from "../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { MemoryRangeType } from "../../common/debug.js";
import { MemoryRegion } from "../../common/debugModel.js";
suite("Debug - Memory", () => {
  const dapResponseCommon = {
    command: "someCommand",
    type: "response",
    seq: 1,
    request_seq: 1,
    success: true
  };
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("MemoryRegion", () => {
    let memory;
    let unreadable;
    let invalidateMemoryEmitter;
    let session;
    let region;
    setup(() => {
      const memoryBuf = new Uint8Array(1024);
      for (let i = 0; i < memoryBuf.length; i++) {
        memoryBuf[i] = i;
      }
      memory = VSBuffer.wrap(memoryBuf);
      invalidateMemoryEmitter = new Emitter();
      unreadable = 0;
      session = mockObject()({
        onDidInvalidateMemory: invalidateMemoryEmitter.event
      });
      session.readMemory.callsFake((ref, fromOffset, count) => {
        const res = {
          ...dapResponseCommon,
          body: {
            address: "0",
            data: encodeBase64(memory.slice(fromOffset, fromOffset + Math.max(0, count - unreadable))),
            unreadableBytes: unreadable
          }
        };
        unreadable = 0;
        return Promise.resolve(res);
      });
      session.writeMemory.callsFake((ref, fromOffset, data) => {
        const decoded = decodeBase64(data);
        for (let i = 0; i < decoded.byteLength; i++) {
          memory.buffer[fromOffset + i] = decoded.buffer[i];
        }
        return {
          ...dapResponseCommon,
          body: {
            bytesWritten: decoded.byteLength,
            offset: fromOffset
          }
        };
      });
      region = new MemoryRegion("ref", session);
    });
    teardown(() => {
      region.dispose();
    });
    test("reads a simple range", async () => {
      assert.deepStrictEqual(await region.read(10, 14), [
        { type: MemoryRangeType.Valid, offset: 10, length: 4, data: VSBuffer.wrap(new Uint8Array([10, 11, 12, 13])) }
      ]);
    });
    test("reads a non-contiguous range", async () => {
      unreadable = 3;
      assert.deepStrictEqual(await region.read(10, 14), [
        { type: MemoryRangeType.Valid, offset: 10, length: 1, data: VSBuffer.wrap(new Uint8Array([10])) },
        { type: MemoryRangeType.Unreadable, offset: 11, length: 3 }
      ]);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy90ZXN0L2Jyb3dzZXIvZGVidWdNZW1vcnkudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGRlY29kZUJhc2U2NCwgZW5jb2RlQmFzZTY0LCBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgbW9ja09iamVjdCwgTW9ja09iamVjdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IE1lbW9yeVJhbmdlVHlwZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBNZW1vcnlSZWdpb24gfSBmcm9tICcuLi8uLi9jb21tb24vZGVidWdNb2RlbC5qcyc7XG5pbXBvcnQgeyBNb2NrU2Vzc2lvbiB9IGZyb20gJy4uL2NvbW1vbi9tb2NrRGVidWcuanMnO1xuXG5zdWl0ZSgnRGVidWcgLSBNZW1vcnknLCAoKSA9PiB7XG5cdGNvbnN0IGRhcFJlc3BvbnNlQ29tbW9uID0ge1xuXHRcdGNvbW1hbmQ6ICdzb21lQ29tbWFuZCcsXG5cdFx0dHlwZTogJ3Jlc3BvbnNlJyxcblx0XHRzZXE6IDEsXG5cdFx0cmVxdWVzdF9zZXE6IDEsXG5cdFx0c3VjY2VzczogdHJ1ZSxcblx0fTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzdWl0ZSgnTWVtb3J5UmVnaW9uJywgKCkgPT4ge1xuXHRcdGxldCBtZW1vcnk6IFZTQnVmZmVyO1xuXHRcdGxldCB1bnJlYWRhYmxlOiBudW1iZXI7XG5cdFx0bGV0IGludmFsaWRhdGVNZW1vcnlFbWl0dGVyOiBFbWl0dGVyPERlYnVnUHJvdG9jb2wuTWVtb3J5RXZlbnQ+O1xuXHRcdGxldCBzZXNzaW9uOiBNb2NrT2JqZWN0PE1vY2tTZXNzaW9uLCAnb25EaWRJbnZhbGlkYXRlTWVtb3J5Jz47XG5cdFx0bGV0IHJlZ2lvbjogTWVtb3J5UmVnaW9uO1xuXG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWVtb3J5QnVmID0gbmV3IFVpbnQ4QXJyYXkoMTAyNCk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG1lbW9yeUJ1Zi5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRtZW1vcnlCdWZbaV0gPSBpOyAvLyB3aWxsIGJlIDAtMjU1XG5cdFx0XHR9XG5cdFx0XHRtZW1vcnkgPSBWU0J1ZmZlci53cmFwKG1lbW9yeUJ1Zik7XG5cdFx0XHRpbnZhbGlkYXRlTWVtb3J5RW1pdHRlciA9IG5ldyBFbWl0dGVyKCk7XG5cdFx0XHR1bnJlYWRhYmxlID0gMDtcblxuXHRcdFx0c2Vzc2lvbiA9IG1vY2tPYmplY3Q8TW9ja1Nlc3Npb24+KCkoe1xuXHRcdFx0XHRvbkRpZEludmFsaWRhdGVNZW1vcnk6IGludmFsaWRhdGVNZW1vcnlFbWl0dGVyLmV2ZW50XG5cdFx0XHR9KTtcblxuXHRcdFx0c2Vzc2lvbi5yZWFkTWVtb3J5LmNhbGxzRmFrZSgocmVmOiBzdHJpbmcsIGZyb21PZmZzZXQ6IG51bWJlciwgY291bnQ6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRjb25zdCByZXM6IERlYnVnUHJvdG9jb2wuUmVhZE1lbW9yeVJlc3BvbnNlID0gKHtcblx0XHRcdFx0XHQuLi5kYXBSZXNwb25zZUNvbW1vbixcblx0XHRcdFx0XHRib2R5OiB7XG5cdFx0XHRcdFx0XHRhZGRyZXNzOiAnMCcsXG5cdFx0XHRcdFx0XHRkYXRhOiBlbmNvZGVCYXNlNjQobWVtb3J5LnNsaWNlKGZyb21PZmZzZXQsIGZyb21PZmZzZXQgKyBNYXRoLm1heCgwLCBjb3VudCAtIHVucmVhZGFibGUpKSksXG5cdFx0XHRcdFx0XHR1bnJlYWRhYmxlQnl0ZXM6IHVucmVhZGFibGVcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHVucmVhZGFibGUgPSAwO1xuXG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUocmVzKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRzZXNzaW9uLndyaXRlTWVtb3J5LmNhbGxzRmFrZSgocmVmOiBzdHJpbmcsIGZyb21PZmZzZXQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogRGVidWdQcm90b2NvbC5Xcml0ZU1lbW9yeVJlc3BvbnNlID0+IHtcblx0XHRcdFx0Y29uc3QgZGVjb2RlZCA9IGRlY29kZUJhc2U2NChkYXRhKTtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBkZWNvZGVkLmJ5dGVMZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdG1lbW9yeS5idWZmZXJbZnJvbU9mZnNldCArIGldID0gZGVjb2RlZC5idWZmZXJbaV07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gKHtcblx0XHRcdFx0XHQuLi5kYXBSZXNwb25zZUNvbW1vbixcblx0XHRcdFx0XHRib2R5OiB7XG5cdFx0XHRcdFx0XHRieXRlc1dyaXR0ZW46IGRlY29kZWQuYnl0ZUxlbmd0aCxcblx0XHRcdFx0XHRcdG9mZnNldDogZnJvbU9mZnNldCxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHJlZ2lvbiA9IG5ldyBNZW1vcnlSZWdpb24oJ3JlZicsIHNlc3Npb24gYXMgYW55KTtcblx0XHR9KTtcblxuXHRcdHRlYXJkb3duKCgpID0+IHtcblx0XHRcdHJlZ2lvbi5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZWFkcyBhIHNpbXBsZSByYW5nZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgcmVnaW9uLnJlYWQoMTAsIDE0KSwgW1xuXHRcdFx0XHR7IHR5cGU6IE1lbW9yeVJhbmdlVHlwZS5WYWxpZCwgb2Zmc2V0OiAxMCwgbGVuZ3RoOiA0LCBkYXRhOiBWU0J1ZmZlci53cmFwKG5ldyBVaW50OEFycmF5KFsxMCwgMTEsIDEyLCAxM10pKSB9XG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JlYWRzIGEgbm9uLWNvbnRpZ3VvdXMgcmFuZ2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHR1bnJlYWRhYmxlID0gMztcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgcmVnaW9uLnJlYWQoMTAsIDE0KSwgW1xuXHRcdFx0XHR7IHR5cGU6IE1lbW9yeVJhbmdlVHlwZS5WYWxpZCwgb2Zmc2V0OiAxMCwgbGVuZ3RoOiAxLCBkYXRhOiBWU0J1ZmZlci53cmFwKG5ldyBVaW50OEFycmF5KFsxMF0pKSB9LFxuXHRcdFx0XHR7IHR5cGU6IE1lbW9yeVJhbmdlVHlwZS5VbnJlYWRhYmxlLCBvZmZzZXQ6IDExLCBsZW5ndGg6IDMgfSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsY0FBYyxjQUFjLGdCQUFnQjtBQUNyRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBOEI7QUFDdkMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxvQkFBb0I7QUFHN0IsTUFBTSxrQkFBa0IsTUFBTTtBQUM3QixRQUFNLG9CQUFvQjtBQUFBLElBQ3pCLFNBQVM7QUFBQSxJQUNULE1BQU07QUFBQSxJQUNOLEtBQUs7QUFBQSxJQUNMLGFBQWE7QUFBQSxJQUNiLFNBQVM7QUFBQSxFQUNWO0FBRUEsMENBQXdDO0FBRXhDLFFBQU0sZ0JBQWdCLE1BQU07QUFDM0IsUUFBSTtBQUNKLFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSTtBQUNKLFFBQUk7QUFFSixVQUFNLE1BQU07QUFDWCxZQUFNLFlBQVksSUFBSSxXQUFXLElBQUk7QUFDckMsZUFBUyxJQUFJLEdBQUcsSUFBSSxVQUFVLFFBQVEsS0FBSztBQUMxQyxrQkFBVSxDQUFDLElBQUk7QUFBQSxNQUNoQjtBQUNBLGVBQVMsU0FBUyxLQUFLLFNBQVM7QUFDaEMsZ0NBQTBCLElBQUksUUFBUTtBQUN0QyxtQkFBYTtBQUViLGdCQUFVLFdBQXdCLEVBQUU7QUFBQSxRQUNuQyx1QkFBdUIsd0JBQXdCO0FBQUEsTUFDaEQsQ0FBQztBQUVELGNBQVEsV0FBVyxVQUFVLENBQUMsS0FBYSxZQUFvQixVQUFrQjtBQUNoRixjQUFNLE1BQXlDO0FBQUEsVUFDOUMsR0FBRztBQUFBLFVBQ0gsTUFBTTtBQUFBLFlBQ0wsU0FBUztBQUFBLFlBQ1QsTUFBTSxhQUFhLE9BQU8sTUFBTSxZQUFZLGFBQWEsS0FBSyxJQUFJLEdBQUcsUUFBUSxVQUFVLENBQUMsQ0FBQztBQUFBLFlBQ3pGLGlCQUFpQjtBQUFBLFVBQ2xCO0FBQUEsUUFDRDtBQUVBLHFCQUFhO0FBRWIsZUFBTyxRQUFRLFFBQVEsR0FBRztBQUFBLE1BQzNCLENBQUM7QUFFRCxjQUFRLFlBQVksVUFBVSxDQUFDLEtBQWEsWUFBb0IsU0FBb0Q7QUFDbkgsY0FBTSxVQUFVLGFBQWEsSUFBSTtBQUNqQyxpQkFBUyxJQUFJLEdBQUcsSUFBSSxRQUFRLFlBQVksS0FBSztBQUM1QyxpQkFBTyxPQUFPLGFBQWEsQ0FBQyxJQUFJLFFBQVEsT0FBTyxDQUFDO0FBQUEsUUFDakQ7QUFFQSxlQUFRO0FBQUEsVUFDUCxHQUFHO0FBQUEsVUFDSCxNQUFNO0FBQUEsWUFDTCxjQUFjLFFBQVE7QUFBQSxZQUN0QixRQUFRO0FBQUEsVUFDVDtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFFRCxlQUFTLElBQUksYUFBYSxPQUFPLE9BQWM7QUFBQSxJQUNoRCxDQUFDO0FBRUQsYUFBUyxNQUFNO0FBQ2QsYUFBTyxRQUFRO0FBQUEsSUFDaEIsQ0FBQztBQUVELFNBQUssd0JBQXdCLFlBQVk7QUFDeEMsYUFBTyxnQkFBZ0IsTUFBTSxPQUFPLEtBQUssSUFBSSxFQUFFLEdBQUc7QUFBQSxRQUNqRCxFQUFFLE1BQU0sZ0JBQWdCLE9BQU8sUUFBUSxJQUFJLFFBQVEsR0FBRyxNQUFNLFNBQVMsS0FBSyxJQUFJLFdBQVcsQ0FBQyxJQUFJLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQUEsTUFDN0csQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFNBQUssZ0NBQWdDLFlBQVk7QUFDaEQsbUJBQWE7QUFDYixhQUFPLGdCQUFnQixNQUFNLE9BQU8sS0FBSyxJQUFJLEVBQUUsR0FBRztBQUFBLFFBQ2pELEVBQUUsTUFBTSxnQkFBZ0IsT0FBTyxRQUFRLElBQUksUUFBUSxHQUFHLE1BQU0sU0FBUyxLQUFLLElBQUksV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFBQSxRQUNoRyxFQUFFLE1BQU0sZ0JBQWdCLFlBQVksUUFBUSxJQUFJLFFBQVEsRUFBRTtBQUFBLE1BQzNELENBQUM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
