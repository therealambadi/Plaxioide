import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import { mock } from "../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { TestDialogService } from "../../../dialogs/test/common/testDialogService.js";
import { TestNotificationService } from "../../../notification/test/common/testNotificationService.js";
import { UndoRedoElementType, UndoRedoGroup } from "../../common/undoRedo.js";
import { UndoRedoService } from "../../common/undoRedoService.js";
suite("UndoRedoService", () => {
  function createUndoRedoService(dialogService = new TestDialogService()) {
    const notificationService = new TestNotificationService();
    return new UndoRedoService(dialogService, notificationService);
  }
  test("simple single resource elements", () => {
    const resource = URI.file("test.txt");
    const service = createUndoRedoService();
    assert.strictEqual(service.canUndo(resource), false);
    assert.strictEqual(service.canRedo(resource), false);
    assert.strictEqual(service.hasElements(resource), false);
    assert.ok(service.getLastElement(resource) === null);
    let undoCall1 = 0;
    let redoCall1 = 0;
    const element1 = {
      type: UndoRedoElementType.Resource,
      resource,
      label: "typing 1",
      code: "typing",
      undo: () => {
        undoCall1++;
      },
      redo: () => {
        redoCall1++;
      }
    };
    service.pushElement(element1);
    assert.strictEqual(undoCall1, 0);
    assert.strictEqual(redoCall1, 0);
    assert.strictEqual(service.canUndo(resource), true);
    assert.strictEqual(service.canRedo(resource), false);
    assert.strictEqual(service.hasElements(resource), true);
    assert.ok(service.getLastElement(resource) === element1);
    service.undo(resource);
    assert.strictEqual(undoCall1, 1);
    assert.strictEqual(redoCall1, 0);
    assert.strictEqual(service.canUndo(resource), false);
    assert.strictEqual(service.canRedo(resource), true);
    assert.strictEqual(service.hasElements(resource), true);
    assert.ok(service.getLastElement(resource) === null);
    service.redo(resource);
    assert.strictEqual(undoCall1, 1);
    assert.strictEqual(redoCall1, 1);
    assert.strictEqual(service.canUndo(resource), true);
    assert.strictEqual(service.canRedo(resource), false);
    assert.strictEqual(service.hasElements(resource), true);
    assert.ok(service.getLastElement(resource) === element1);
    let undoCall2 = 0;
    let redoCall2 = 0;
    const element2 = {
      type: UndoRedoElementType.Resource,
      resource,
      label: "typing 2",
      code: "typing",
      undo: () => {
        undoCall2++;
      },
      redo: () => {
        redoCall2++;
      }
    };
    service.pushElement(element2);
    assert.strictEqual(undoCall1, 1);
    assert.strictEqual(redoCall1, 1);
    assert.strictEqual(undoCall2, 0);
    assert.strictEqual(redoCall2, 0);
    assert.strictEqual(service.canUndo(resource), true);
    assert.strictEqual(service.canRedo(resource), false);
    assert.strictEqual(service.hasElements(resource), true);
    assert.ok(service.getLastElement(resource) === element2);
    service.undo(resource);
    assert.strictEqual(undoCall1, 1);
    assert.strictEqual(redoCall1, 1);
    assert.strictEqual(undoCall2, 1);
    assert.strictEqual(redoCall2, 0);
    assert.strictEqual(service.canUndo(resource), true);
    assert.strictEqual(service.canRedo(resource), true);
    assert.strictEqual(service.hasElements(resource), true);
    assert.ok(service.getLastElement(resource) === null);
    let undoCall3 = 0;
    let redoCall3 = 0;
    const element3 = {
      type: UndoRedoElementType.Resource,
      resource,
      label: "typing 2",
      code: "typing",
      undo: () => {
        undoCall3++;
      },
      redo: () => {
        redoCall3++;
      }
    };
    service.pushElement(element3);
    assert.strictEqual(undoCall1, 1);
    assert.strictEqual(redoCall1, 1);
    assert.strictEqual(undoCall2, 1);
    assert.strictEqual(redoCall2, 0);
    assert.strictEqual(undoCall3, 0);
    assert.strictEqual(redoCall3, 0);
    assert.strictEqual(service.canUndo(resource), true);
    assert.strictEqual(service.canRedo(resource), false);
    assert.strictEqual(service.hasElements(resource), true);
    assert.ok(service.getLastElement(resource) === element3);
    service.undo(resource);
    assert.strictEqual(undoCall1, 1);
    assert.strictEqual(redoCall1, 1);
    assert.strictEqual(undoCall2, 1);
    assert.strictEqual(redoCall2, 0);
    assert.strictEqual(undoCall3, 1);
    assert.strictEqual(redoCall3, 0);
    assert.strictEqual(service.canUndo(resource), true);
    assert.strictEqual(service.canRedo(resource), true);
    assert.strictEqual(service.hasElements(resource), true);
    assert.ok(service.getLastElement(resource) === null);
  });
  test("multi resource elements", async () => {
    const resource1 = URI.file("test1.txt");
    const resource2 = URI.file("test2.txt");
    const service = createUndoRedoService(new class extends mock() {
      async prompt(prompt) {
        const result = prompt.buttons?.[0].run({ checkboxChecked: false });
        return { result };
      }
      async confirm() {
        return {
          confirmed: true
          // confirm!
        };
      }
    }());
    let undoCall1 = 0, undoCall11 = 0, undoCall12 = 0;
    let redoCall1 = 0, redoCall11 = 0, redoCall12 = 0;
    const element1 = {
      type: UndoRedoElementType.Workspace,
      resources: [resource1, resource2],
      label: "typing 1",
      code: "typing",
      undo: () => {
        undoCall1++;
      },
      redo: () => {
        redoCall1++;
      },
      split: () => {
        return [
          {
            type: UndoRedoElementType.Resource,
            resource: resource1,
            label: "typing 1.1",
            code: "typing",
            undo: () => {
              undoCall11++;
            },
            redo: () => {
              redoCall11++;
            }
          },
          {
            type: UndoRedoElementType.Resource,
            resource: resource2,
            label: "typing 1.2",
            code: "typing",
            undo: () => {
              undoCall12++;
            },
            redo: () => {
              redoCall12++;
            }
          }
        ];
      }
    };
    service.pushElement(element1);
    assert.strictEqual(service.canUndo(resource1), true);
    assert.strictEqual(service.canRedo(resource1), false);
    assert.strictEqual(service.hasElements(resource1), true);
    assert.ok(service.getLastElement(resource1) === element1);
    assert.strictEqual(service.canUndo(resource2), true);
    assert.strictEqual(service.canRedo(resource2), false);
    assert.strictEqual(service.hasElements(resource2), true);
    assert.ok(service.getLastElement(resource2) === element1);
    await service.undo(resource1);
    assert.strictEqual(undoCall1, 1);
    assert.strictEqual(redoCall1, 0);
    assert.strictEqual(service.canUndo(resource1), false);
    assert.strictEqual(service.canRedo(resource1), true);
    assert.strictEqual(service.hasElements(resource1), true);
    assert.ok(service.getLastElement(resource1) === null);
    assert.strictEqual(service.canUndo(resource2), false);
    assert.strictEqual(service.canRedo(resource2), true);
    assert.strictEqual(service.hasElements(resource2), true);
    assert.ok(service.getLastElement(resource2) === null);
    await service.redo(resource2);
    assert.strictEqual(undoCall1, 1);
    assert.strictEqual(redoCall1, 1);
    assert.strictEqual(undoCall11, 0);
    assert.strictEqual(redoCall11, 0);
    assert.strictEqual(undoCall12, 0);
    assert.strictEqual(redoCall12, 0);
    assert.strictEqual(service.canUndo(resource1), true);
    assert.strictEqual(service.canRedo(resource1), false);
    assert.strictEqual(service.hasElements(resource1), true);
    assert.ok(service.getLastElement(resource1) === element1);
    assert.strictEqual(service.canUndo(resource2), true);
    assert.strictEqual(service.canRedo(resource2), false);
    assert.strictEqual(service.hasElements(resource2), true);
    assert.ok(service.getLastElement(resource2) === element1);
  });
  test("UndoRedoGroup.None uses id 0", () => {
    assert.strictEqual(UndoRedoGroup.None.id, 0);
    assert.strictEqual(UndoRedoGroup.None.nextOrder(), 0);
    assert.strictEqual(UndoRedoGroup.None.nextOrder(), 0);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91bmRvUmVkby90ZXN0L2NvbW1vbi91bmRvUmVkb1NlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UsIElQcm9tcHQgfSBmcm9tICcuLi8uLi8uLi9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IFRlc3REaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZGlhbG9ncy90ZXN0L2NvbW1vbi90ZXN0RGlhbG9nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0Tm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL25vdGlmaWNhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Tm90aWZpY2F0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVW5kb1JlZG9FbGVtZW50LCBVbmRvUmVkb0VsZW1lbnRUeXBlLCBVbmRvUmVkb0dyb3VwIH0gZnJvbSAnLi4vLi4vY29tbW9uL3VuZG9SZWRvLmpzJztcbmltcG9ydCB7IFVuZG9SZWRvU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi91bmRvUmVkb1NlcnZpY2UuanMnO1xuXG5zdWl0ZSgnVW5kb1JlZG9TZXJ2aWNlJywgKCkgPT4ge1xuXG5cdGZ1bmN0aW9uIGNyZWF0ZVVuZG9SZWRvU2VydmljZShkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSA9IG5ldyBUZXN0RGlhbG9nU2VydmljZSgpKTogVW5kb1JlZG9TZXJ2aWNlIHtcblx0XHRjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0gbmV3IFRlc3ROb3RpZmljYXRpb25TZXJ2aWNlKCk7XG5cdFx0cmV0dXJuIG5ldyBVbmRvUmVkb1NlcnZpY2UoZGlhbG9nU2VydmljZSwgbm90aWZpY2F0aW9uU2VydmljZSk7XG5cdH1cblxuXHR0ZXN0KCdzaW1wbGUgc2luZ2xlIHJlc291cmNlIGVsZW1lbnRzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJ3Rlc3QudHh0Jyk7XG5cdFx0Y29uc3Qgc2VydmljZSA9IGNyZWF0ZVVuZG9SZWRvU2VydmljZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuY2FuVW5kbyhyZXNvdXJjZSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5jYW5SZWRvKHJlc291cmNlKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmhhc0VsZW1lbnRzKHJlc291cmNlKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5vayhzZXJ2aWNlLmdldExhc3RFbGVtZW50KHJlc291cmNlKSA9PT0gbnVsbCk7XG5cblx0XHRsZXQgdW5kb0NhbGwxID0gMDtcblx0XHRsZXQgcmVkb0NhbGwxID0gMDtcblx0XHRjb25zdCBlbGVtZW50MTogSVVuZG9SZWRvRWxlbWVudCA9IHtcblx0XHRcdHR5cGU6IFVuZG9SZWRvRWxlbWVudFR5cGUuUmVzb3VyY2UsXG5cdFx0XHRyZXNvdXJjZTogcmVzb3VyY2UsXG5cdFx0XHRsYWJlbDogJ3R5cGluZyAxJyxcblx0XHRcdGNvZGU6ICd0eXBpbmcnLFxuXHRcdFx0dW5kbzogKCkgPT4geyB1bmRvQ2FsbDErKzsgfSxcblx0XHRcdHJlZG86ICgpID0+IHsgcmVkb0NhbGwxKys7IH1cblx0XHR9O1xuXHRcdHNlcnZpY2UucHVzaEVsZW1lbnQoZWxlbWVudDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuZG9DYWxsMSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZG9DYWxsMSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuY2FuVW5kbyhyZXNvdXJjZSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmNhblJlZG8ocmVzb3VyY2UpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaGFzRWxlbWVudHMocmVzb3VyY2UpLCB0cnVlKTtcblx0XHRhc3NlcnQub2soc2VydmljZS5nZXRMYXN0RWxlbWVudChyZXNvdXJjZSkgPT09IGVsZW1lbnQxKTtcblxuXHRcdHNlcnZpY2UudW5kbyhyZXNvdXJjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuZG9DYWxsMSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZG9DYWxsMSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuY2FuVW5kbyhyZXNvdXJjZSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5jYW5SZWRvKHJlc291cmNlKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaGFzRWxlbWVudHMocmVzb3VyY2UpLCB0cnVlKTtcblx0XHRhc3NlcnQub2soc2VydmljZS5nZXRMYXN0RWxlbWVudChyZXNvdXJjZSkgPT09IG51bGwpO1xuXG5cdFx0c2VydmljZS5yZWRvKHJlc291cmNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5kb0NhbGwxLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVkb0NhbGwxLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5jYW5VbmRvKHJlc291cmNlKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuY2FuUmVkbyhyZXNvdXJjZSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5oYXNFbGVtZW50cyhyZXNvdXJjZSksIHRydWUpO1xuXHRcdGFzc2VydC5vayhzZXJ2aWNlLmdldExhc3RFbGVtZW50KHJlc291cmNlKSA9PT0gZWxlbWVudDEpO1xuXG5cdFx0bGV0IHVuZG9DYWxsMiA9IDA7XG5cdFx0bGV0IHJlZG9DYWxsMiA9IDA7XG5cdFx0Y29uc3QgZWxlbWVudDI6IElVbmRvUmVkb0VsZW1lbnQgPSB7XG5cdFx0XHR0eXBlOiBVbmRvUmVkb0VsZW1lbnRUeXBlLlJlc291cmNlLFxuXHRcdFx0cmVzb3VyY2U6IHJlc291cmNlLFxuXHRcdFx0bGFiZWw6ICd0eXBpbmcgMicsXG5cdFx0XHRjb2RlOiAndHlwaW5nJyxcblx0XHRcdHVuZG86ICgpID0+IHsgdW5kb0NhbGwyKys7IH0sXG5cdFx0XHRyZWRvOiAoKSA9PiB7IHJlZG9DYWxsMisrOyB9XG5cdFx0fTtcblx0XHRzZXJ2aWNlLnB1c2hFbGVtZW50KGVsZW1lbnQyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmRvQ2FsbDEsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWRvQ2FsbDEsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmRvQ2FsbDIsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWRvQ2FsbDIsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmNhblVuZG8ocmVzb3VyY2UpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5jYW5SZWRvKHJlc291cmNlKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmhhc0VsZW1lbnRzKHJlc291cmNlKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuZ2V0TGFzdEVsZW1lbnQocmVzb3VyY2UpID09PSBlbGVtZW50Mik7XG5cblx0XHRzZXJ2aWNlLnVuZG8ocmVzb3VyY2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuZG9DYWxsMSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZG9DYWxsMSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuZG9DYWxsMiwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZG9DYWxsMiwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuY2FuVW5kbyhyZXNvdXJjZSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmNhblJlZG8ocmVzb3VyY2UpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5oYXNFbGVtZW50cyhyZXNvdXJjZSksIHRydWUpO1xuXHRcdGFzc2VydC5vayhzZXJ2aWNlLmdldExhc3RFbGVtZW50KHJlc291cmNlKSA9PT0gbnVsbCk7XG5cblx0XHRsZXQgdW5kb0NhbGwzID0gMDtcblx0XHRsZXQgcmVkb0NhbGwzID0gMDtcblx0XHRjb25zdCBlbGVtZW50MzogSVVuZG9SZWRvRWxlbWVudCA9IHtcblx0XHRcdHR5cGU6IFVuZG9SZWRvRWxlbWVudFR5cGUuUmVzb3VyY2UsXG5cdFx0XHRyZXNvdXJjZTogcmVzb3VyY2UsXG5cdFx0XHRsYWJlbDogJ3R5cGluZyAyJyxcblx0XHRcdGNvZGU6ICd0eXBpbmcnLFxuXHRcdFx0dW5kbzogKCkgPT4geyB1bmRvQ2FsbDMrKzsgfSxcblx0XHRcdHJlZG86ICgpID0+IHsgcmVkb0NhbGwzKys7IH1cblx0XHR9O1xuXHRcdHNlcnZpY2UucHVzaEVsZW1lbnQoZWxlbWVudDMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuZG9DYWxsMSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZG9DYWxsMSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuZG9DYWxsMiwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZG9DYWxsMiwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuZG9DYWxsMywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZG9DYWxsMywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuY2FuVW5kbyhyZXNvdXJjZSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmNhblJlZG8ocmVzb3VyY2UpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaGFzRWxlbWVudHMocmVzb3VyY2UpLCB0cnVlKTtcblx0XHRhc3NlcnQub2soc2VydmljZS5nZXRMYXN0RWxlbWVudChyZXNvdXJjZSkgPT09IGVsZW1lbnQzKTtcblxuXHRcdHNlcnZpY2UudW5kbyhyZXNvdXJjZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5kb0NhbGwxLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVkb0NhbGwxLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5kb0NhbGwyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVkb0NhbGwyLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5kb0NhbGwzLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVkb0NhbGwzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5jYW5VbmRvKHJlc291cmNlKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuY2FuUmVkbyhyZXNvdXJjZSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmhhc0VsZW1lbnRzKHJlc291cmNlKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuZ2V0TGFzdEVsZW1lbnQocmVzb3VyY2UpID09PSBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGkgcmVzb3VyY2UgZWxlbWVudHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UxID0gVVJJLmZpbGUoJ3Rlc3QxLnR4dCcpO1xuXHRcdGNvbnN0IHJlc291cmNlMiA9IFVSSS5maWxlKCd0ZXN0Mi50eHQnKTtcblx0XHRjb25zdCBzZXJ2aWNlID0gY3JlYXRlVW5kb1JlZG9TZXJ2aWNlKG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SURpYWxvZ1NlcnZpY2U+KCkge1xuXHRcdFx0b3ZlcnJpZGUgYXN5bmMgcHJvbXB0PFQgPSBhbnk+KHByb21wdDogSVByb21wdDxhbnk+KSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHByb21wdC5idXR0b25zPy5bMF0ucnVuKHsgY2hlY2tib3hDaGVja2VkOiBmYWxzZSB9KTtcblxuXHRcdFx0XHRyZXR1cm4geyByZXN1bHQgfTtcblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlIGFzeW5jIGNvbmZpcm0oKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0Y29uZmlybWVkOiB0cnVlIC8vIGNvbmZpcm0hXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRsZXQgdW5kb0NhbGwxID0gMCwgdW5kb0NhbGwxMSA9IDAsIHVuZG9DYWxsMTIgPSAwO1xuXHRcdGxldCByZWRvQ2FsbDEgPSAwLCByZWRvQ2FsbDExID0gMCwgcmVkb0NhbGwxMiA9IDA7XG5cdFx0Y29uc3QgZWxlbWVudDE6IElVbmRvUmVkb0VsZW1lbnQgPSB7XG5cdFx0XHR0eXBlOiBVbmRvUmVkb0VsZW1lbnRUeXBlLldvcmtzcGFjZSxcblx0XHRcdHJlc291cmNlczogW3Jlc291cmNlMSwgcmVzb3VyY2UyXSxcblx0XHRcdGxhYmVsOiAndHlwaW5nIDEnLFxuXHRcdFx0Y29kZTogJ3R5cGluZycsXG5cdFx0XHR1bmRvOiAoKSA9PiB7IHVuZG9DYWxsMSsrOyB9LFxuXHRcdFx0cmVkbzogKCkgPT4geyByZWRvQ2FsbDErKzsgfSxcblx0XHRcdHNwbGl0OiAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogVW5kb1JlZG9FbGVtZW50VHlwZS5SZXNvdXJjZSxcblx0XHRcdFx0XHRcdHJlc291cmNlOiByZXNvdXJjZTEsXG5cdFx0XHRcdFx0XHRsYWJlbDogJ3R5cGluZyAxLjEnLFxuXHRcdFx0XHRcdFx0Y29kZTogJ3R5cGluZycsXG5cdFx0XHRcdFx0XHR1bmRvOiAoKSA9PiB7IHVuZG9DYWxsMTErKzsgfSxcblx0XHRcdFx0XHRcdHJlZG86ICgpID0+IHsgcmVkb0NhbGwxMSsrOyB9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiBVbmRvUmVkb0VsZW1lbnRUeXBlLlJlc291cmNlLFxuXHRcdFx0XHRcdFx0cmVzb3VyY2U6IHJlc291cmNlMixcblx0XHRcdFx0XHRcdGxhYmVsOiAndHlwaW5nIDEuMicsXG5cdFx0XHRcdFx0XHRjb2RlOiAndHlwaW5nJyxcblx0XHRcdFx0XHRcdHVuZG86ICgpID0+IHsgdW5kb0NhbGwxMisrOyB9LFxuXHRcdFx0XHRcdFx0cmVkbzogKCkgPT4geyByZWRvQ2FsbDEyKys7IH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF07XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRzZXJ2aWNlLnB1c2hFbGVtZW50KGVsZW1lbnQxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmNhblVuZG8ocmVzb3VyY2UxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuY2FuUmVkbyhyZXNvdXJjZTEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaGFzRWxlbWVudHMocmVzb3VyY2UxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuZ2V0TGFzdEVsZW1lbnQocmVzb3VyY2UxKSA9PT0gZWxlbWVudDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmNhblVuZG8ocmVzb3VyY2UyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuY2FuUmVkbyhyZXNvdXJjZTIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaGFzRWxlbWVudHMocmVzb3VyY2UyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuZ2V0TGFzdEVsZW1lbnQocmVzb3VyY2UyKSA9PT0gZWxlbWVudDEpO1xuXG5cdFx0YXdhaXQgc2VydmljZS51bmRvKHJlc291cmNlMSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5kb0NhbGwxLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVkb0NhbGwxLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5jYW5VbmRvKHJlc291cmNlMSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5jYW5SZWRvKHJlc291cmNlMSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmhhc0VsZW1lbnRzKHJlc291cmNlMSksIHRydWUpO1xuXHRcdGFzc2VydC5vayhzZXJ2aWNlLmdldExhc3RFbGVtZW50KHJlc291cmNlMSkgPT09IG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmNhblVuZG8ocmVzb3VyY2UyKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmNhblJlZG8ocmVzb3VyY2UyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaGFzRWxlbWVudHMocmVzb3VyY2UyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuZ2V0TGFzdEVsZW1lbnQocmVzb3VyY2UyKSA9PT0gbnVsbCk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLnJlZG8ocmVzb3VyY2UyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5kb0NhbGwxLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVkb0NhbGwxLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5kb0NhbGwxMSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZG9DYWxsMTEsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmRvQ2FsbDEyLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVkb0NhbGwxMiwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuY2FuVW5kbyhyZXNvdXJjZTEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5jYW5SZWRvKHJlc291cmNlMSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5oYXNFbGVtZW50cyhyZXNvdXJjZTEpLCB0cnVlKTtcblx0XHRhc3NlcnQub2soc2VydmljZS5nZXRMYXN0RWxlbWVudChyZXNvdXJjZTEpID09PSBlbGVtZW50MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuY2FuVW5kbyhyZXNvdXJjZTIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5jYW5SZWRvKHJlc291cmNlMiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5oYXNFbGVtZW50cyhyZXNvdXJjZTIpLCB0cnVlKTtcblx0XHRhc3NlcnQub2soc2VydmljZS5nZXRMYXN0RWxlbWVudChyZXNvdXJjZTIpID09PSBlbGVtZW50MSk7XG5cblx0fSk7XG5cblx0dGVzdCgnVW5kb1JlZG9Hcm91cC5Ob25lIHVzZXMgaWQgMCcsICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoVW5kb1JlZG9Hcm91cC5Ob25lLmlkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoVW5kb1JlZG9Hcm91cC5Ob25lLm5leHRPcmRlcigpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoVW5kb1JlZG9Hcm91cC5Ob25lLm5leHRPcmRlcigpLCAwKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsK0NBQStDO0FBRXhELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQTJCLHFCQUFxQixxQkFBcUI7QUFDckUsU0FBUyx1QkFBdUI7QUFFaEMsTUFBTSxtQkFBbUIsTUFBTTtBQUU5QixXQUFTLHNCQUFzQixnQkFBZ0MsSUFBSSxrQkFBa0IsR0FBb0I7QUFDeEcsVUFBTSxzQkFBc0IsSUFBSSx3QkFBd0I7QUFDeEQsV0FBTyxJQUFJLGdCQUFnQixlQUFlLG1CQUFtQjtBQUFBLEVBQzlEO0FBRUEsT0FBSyxtQ0FBbUMsTUFBTTtBQUM3QyxVQUFNLFdBQVcsSUFBSSxLQUFLLFVBQVU7QUFDcEMsVUFBTSxVQUFVLHNCQUFzQjtBQUV0QyxXQUFPLFlBQVksUUFBUSxRQUFRLFFBQVEsR0FBRyxLQUFLO0FBQ25ELFdBQU8sWUFBWSxRQUFRLFFBQVEsUUFBUSxHQUFHLEtBQUs7QUFDbkQsV0FBTyxZQUFZLFFBQVEsWUFBWSxRQUFRLEdBQUcsS0FBSztBQUN2RCxXQUFPLEdBQUcsUUFBUSxlQUFlLFFBQVEsTUFBTSxJQUFJO0FB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
