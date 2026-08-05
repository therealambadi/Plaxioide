import assert from "assert";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { CellOutputContainer } from "../../browser/view/cellParts/cellOutput.js";
import { CellKind } from "../../common/notebookCommon.js";
import { setupInstantiationService, withTestNotebook } from "./testNotebookEditor.js";
import { FastDomNode } from "../../../../../base/browser/fastDomNode.js";
import { INotebookService } from "../../common/notebookService.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { IMenuService } from "../../../../../platform/actions/common/actions.js";
import { Event } from "../../../../../base/common/event.js";
import { getAllOutputsText } from "../../browser/viewModel/cellOutputTextHelper.js";
suite("CellOutput", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let instantiationService;
  let outputMenus = [];
  setup(() => {
    outputMenus = [];
    instantiationService = setupInstantiationService(store);
    instantiationService.stub(INotebookService, new class extends mock() {
      getOutputMimeTypeInfo(_textModel, _kernelProvides, output) {
        return [{
          rendererId: "plainTextRendererId",
          mimeType: "text/plain",
          isTrusted: true
        }, {
          rendererId: "htmlRendererId",
          mimeType: "text/html",
          isTrusted: true
        }, {
          rendererId: "errorRendererId",
          mimeType: "application/vnd.code.notebook.error",
          isTrusted: true
        }, {
          rendererId: "stderrRendererId",
          mimeType: "application/vnd.code.notebook.stderr",
          isTrusted: true
        }, {
          rendererId: "stdoutRendererId",
          mimeType: "application/vnd.code.notebook.stdout",
          isTrusted: true
        }].filter((info) => output.outputs.some((output2) => output2.mime === info.mimeType));
      }
      getRendererInfo() {
        return {
          id: "rendererId",
          displayName: "Stubbed Renderer",
          extensionId: { _lower: "id", value: "id" }
        };
      }
    }());
    instantiationService.stub(IMenuService, new class extends mock() {
      createMenu() {
        const menu = new class extends mock() {
          constructor() {
            super(...arguments);
            this.onDidChange = Event.None;
          }
          getActions() {
            return [];
          }
          dispose() {
            outputMenus = outputMenus.filter((item) => item !== menu);
          }
        }();
        outputMenus.push(menu);
        return menu;
      }
    }());
  });
  test("Render cell output items with multiple mime types", async function() {
    const outputItem = { data: VSBuffer.fromString("output content"), mime: "text/plain" };
    const htmlOutputItem = { data: VSBuffer.fromString("output content"), mime: "text/html" };
    const output1 = { outputId: "abc", outputs: [outputItem, htmlOutputItem] };
    const output2 = { outputId: "def", outputs: [outputItem, htmlOutputItem] };
    await withTestNotebook(
      [
        ["print(output content)", "python", CellKind.Code, [output1, output2], {}]
      ],
      (editor, viewModel, disposables, accessor) => {
        const cell = viewModel.viewCells[0];
        const cellTemplate = createCellTemplate(disposables);
        const output = disposables.add(accessor.createInstance(CellOutputContainer, editor, cell, cellTemplate, { limit: 100 }));
        output.render();
        cell.outputsViewModels[0].setVisible(true);
        assert.strictEqual(outputMenus.length, 1, "should have 1 output menus");
        assert(cellTemplate.outputContainer.domNode.style.display !== "none", "output container should be visible");
        cell.outputsViewModels[1].setVisible(true);
        assert.strictEqual(outputMenus.length, 2, "should have 2 output menus");
        cell.outputsViewModels[1].setVisible(true);
        assert.strictEqual(outputMenus.length, 2, "should still have 2 output menus");
      },
      instantiationService
    );
  });
  test("One of many cell outputs becomes hidden", async function() {
    const outputItem = { data: VSBuffer.fromString("output content"), mime: "text/plain" };
    const htmlOutputItem = { data: VSBuffer.fromString("output content"), mime: "text/html" };
    const output1 = { outputId: "abc", outputs: [outputItem, htmlOutputItem] };
    const output2 = { outputId: "def", outputs: [outputItem, htmlOutputItem] };
    const output3 = { outputId: "ghi", outputs: [outputItem, htmlOutputItem] };
    await withTestNotebook(
      [
        ["print(output content)", "python", CellKind.Code, [output1, output2, output3], {}]
      ],
      (editor, viewModel, disposables, accessor) => {
        const cell = viewModel.viewCells[0];
        const cellTemplate = createCellTemplate(disposables);
        const output = disposables.add(accessor.createInstance(CellOutputContainer, editor, cell, cellTemplate, { limit: 100 }));
        output.render();
        cell.outputsViewModels[0].setVisible(true);
        cell.outputsViewModels[1].setVisible(true);
        cell.outputsViewModels[2].setVisible(true);
        cell.outputsViewModels[1].setVisible(false);
        assert(cellTemplate.outputContainer.domNode.style.display !== "none", "output container should be visible");
        assert.strictEqual(outputMenus.length, 2, "should have 2 output menus");
      },
      instantiationService
    );
  });
  test("get all adjacent stream outputs", async () => {
    const stdout = { data: VSBuffer.fromString("stdout"), mime: "application/vnd.code.notebook.stdout" };
    const stderr = { data: VSBuffer.fromString("stderr"), mime: "application/vnd.code.notebook.stderr" };
    const output1 = { outputId: "abc", outputs: [stdout] };
    const output2 = { outputId: "abc", outputs: [stderr] };
    await withTestNotebook(
      [
        ["print(output content)", "python", CellKind.Code, [output1, output2], {}]
      ],
      (_editor, viewModel) => {
        const cell = viewModel.viewCells[0];
        const notebook = viewModel.notebookDocument;
        const result = getAllOutputsText(notebook, cell);
        assert.strictEqual(result, "stdoutstderr");
      },
      instantiationService
    );
  });
  test("get all mixed outputs of cell", async () => {
    const stdout = { data: VSBuffer.fromString("stdout"), mime: "application/vnd.code.notebook.stdout" };
    const stderr = { data: VSBuffer.fromString("stderr"), mime: "application/vnd.code.notebook.stderr" };
    const plainText = { data: VSBuffer.fromString("output content"), mime: "text/plain" };
    const error = { data: VSBuffer.fromString(`{"name":"Error Name","message":"error message","stack":"error stack"}`), mime: "application/vnd.code.notebook.error" };
    const output1 = { outputId: "abc", outputs: [stdout] };
    const output2 = { outputId: "abc", outputs: [stderr] };
    const output3 = { outputId: "abc", outputs: [plainText] };
    const output4 = { outputId: "abc", outputs: [error] };
    await withTestNotebook(
      [
        ["print(output content)", "python", CellKind.Code, [output1, output2, output3, output4], {}]
      ],
      (_editor, viewModel) => {
        const cell = viewModel.viewCells[0];
        const notebook = viewModel.notebookDocument;
        const result = getAllOutputsText(notebook, cell);
        assert.strictEqual(
          result,
          "Cell output 1 of 3\nstdoutstderr\nCell output 2 of 3\noutput content\nCell output 3 of 3\nerror stack"
        );
      },
      instantiationService
    );
  });
});
function createCellTemplate(disposables) {
  return {
    outputContainer: new FastDomNode(document.createElement("div")),
    outputShowMoreContainer: new FastDomNode(document.createElement("div")),
    focusSinkElement: document.createElement("div"),
    templateDisposables: disposables,
    elementDisposables: disposables
  };
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvY2VsbE91dHB1dC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBDZWxsT3V0cHV0Q29udGFpbmVyIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci92aWV3L2NlbGxQYXJ0cy9jZWxsT3V0cHV0LmpzJztcbmltcG9ydCB7IENvZGVDZWxsUmVuZGVyVGVtcGxhdGUgfSBmcm9tICcuLi8uLi9icm93c2VyL3ZpZXcvbm90ZWJvb2tSZW5kZXJpbmdDb21tb24uanMnO1xuaW1wb3J0IHsgQ29kZUNlbGxWaWV3TW9kZWwgfSBmcm9tICcuLi8uLi9icm93c2VyL3ZpZXdNb2RlbC9jb2RlQ2VsbFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBDZWxsS2luZCwgSU5vdGVib29rUmVuZGVyZXJJbmZvLCBJT3V0cHV0RHRvIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IHNldHVwSW5zdGFudGlhdGlvblNlcnZpY2UsIHdpdGhUZXN0Tm90ZWJvb2sgfSBmcm9tICcuL3Rlc3ROb3RlYm9va0VkaXRvci5qcyc7XG5pbXBvcnQgeyBGYXN0RG9tTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mYXN0RG9tTm9kZS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgbW9jayB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBJTWVudSwgSU1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IGdldEFsbE91dHB1dHNUZXh0IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci92aWV3TW9kZWwvY2VsbE91dHB1dFRleHRIZWxwZXIuanMnO1xuXG5zdWl0ZSgnQ2VsbE91dHB1dCcsICgpID0+IHtcblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBvdXRwdXRNZW51czogSU1lbnVbXSA9IFtdO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRvdXRwdXRNZW51cyA9IFtdO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc2V0dXBJbnN0YW50aWF0aW9uU2VydmljZShzdG9yZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTm90ZWJvb2tTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElOb3RlYm9va1NlcnZpY2U+KCkge1xuXHRcdFx0b3ZlcnJpZGUgZ2V0T3V0cHV0TWltZVR5cGVJbmZvKF90ZXh0TW9kZWw6IGFueSwgX2tlcm5lbFByb3ZpZGVzOiByZWFkb25seSBzdHJpbmdbXSB8IHVuZGVmaW5lZCwgb3V0cHV0OiBJT3V0cHV0RHRvKSB7XG5cdFx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRcdHJlbmRlcmVySWQ6ICdwbGFpblRleHRSZW5kZXJlcklkJyxcblx0XHRcdFx0XHRtaW1lVHlwZTogJ3RleHQvcGxhaW4nLFxuXHRcdFx0XHRcdGlzVHJ1c3RlZDogdHJ1ZVxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0cmVuZGVyZXJJZDogJ2h0bWxSZW5kZXJlcklkJyxcblx0XHRcdFx0XHRtaW1lVHlwZTogJ3RleHQvaHRtbCcsXG5cdFx0XHRcdFx0aXNUcnVzdGVkOiB0cnVlXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRyZW5kZXJlcklkOiAnZXJyb3JSZW5kZXJlcklkJyxcblx0XHRcdFx0XHRtaW1lVHlwZTogJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLmVycm9yJyxcblx0XHRcdFx0XHRpc1RydXN0ZWQ6IHRydWVcblx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdHJlbmRlcmVySWQ6ICdzdGRlcnJSZW5kZXJlcklkJyxcblx0XHRcdFx0XHRtaW1lVHlwZTogJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZGVycicsXG5cdFx0XHRcdFx0aXNUcnVzdGVkOiB0cnVlXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRyZW5kZXJlcklkOiAnc3Rkb3V0UmVuZGVyZXJJZCcsXG5cdFx0XHRcdFx0bWltZVR5cGU6ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRvdXQnLFxuXHRcdFx0XHRcdGlzVHJ1c3RlZDogdHJ1ZVxuXHRcdFx0XHR9XVxuXHRcdFx0XHRcdC5maWx0ZXIoaW5mbyA9PiBvdXRwdXQub3V0cHV0cy5zb21lKG91dHB1dCA9PiBvdXRwdXQubWltZSA9PT0gaW5mby5taW1lVHlwZSkpO1xuXHRcdFx0fVxuXHRcdFx0b3ZlcnJpZGUgZ2V0UmVuZGVyZXJJbmZvKCk6IElOb3RlYm9va1JlbmRlcmVySW5mbyB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aWQ6ICdyZW5kZXJlcklkJyxcblx0XHRcdFx0XHRkaXNwbGF5TmFtZTogJ1N0dWJiZWQgUmVuZGVyZXInLFxuXHRcdFx0XHRcdGV4dGVuc2lvbklkOiB7IF9sb3dlcjogJ2lkJywgdmFsdWU6ICdpZCcgfSxcblx0XHRcdFx0fSBhcyBJTm90ZWJvb2tSZW5kZXJlckluZm87XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTWVudVNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SU1lbnVTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIGNyZWF0ZU1lbnUoKSB7XG5cdFx0XHRcdGNvbnN0IG1lbnUgPSBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElNZW51PigpIHtcblx0XHRcdFx0XHRvdmVycmlkZSBvbkRpZENoYW5nZSA9IEV2ZW50Lk5vbmU7XG5cdFx0XHRcdFx0b3ZlcnJpZGUgZ2V0QWN0aW9ucygpIHsgcmV0dXJuIFtdOyB9XG5cdFx0XHRcdFx0b3ZlcnJpZGUgZGlzcG9zZSgpIHsgb3V0cHV0TWVudXMgPSBvdXRwdXRNZW51cy5maWx0ZXIoaXRlbSA9PiBpdGVtICE9PSBtZW51KTsgfVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRvdXRwdXRNZW51cy5wdXNoKG1lbnUpO1xuXHRcdFx0XHRyZXR1cm4gbWVudTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnUmVuZGVyIGNlbGwgb3V0cHV0IGl0ZW1zIHdpdGggbXVsdGlwbGUgbWltZSB0eXBlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBvdXRwdXRJdGVtID0geyBkYXRhOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdvdXRwdXQgY29udGVudCcpLCBtaW1lOiAndGV4dC9wbGFpbicgfTtcblx0XHRjb25zdCBodG1sT3V0cHV0SXRlbSA9IHsgZGF0YTogVlNCdWZmZXIuZnJvbVN0cmluZygnb3V0cHV0IGNvbnRlbnQnKSwgbWltZTogJ3RleHQvaHRtbCcgfTtcblx0XHRjb25zdCBvdXRwdXQxOiBJT3V0cHV0RHRvID0geyBvdXRwdXRJZDogJ2FiYycsIG91dHB1dHM6IFtvdXRwdXRJdGVtLCBodG1sT3V0cHV0SXRlbV0gfTtcblx0XHRjb25zdCBvdXRwdXQyOiBJT3V0cHV0RHRvID0geyBvdXRwdXRJZDogJ2RlZicsIG91dHB1dHM6IFtvdXRwdXRJdGVtLCBodG1sT3V0cHV0SXRlbV0gfTtcblxuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsncHJpbnQob3V0cHV0IGNvbnRlbnQpJywgJ3B5dGhvbicsIENlbGxLaW5kLkNvZGUsIFtvdXRwdXQxLCBvdXRwdXQyXSwge31dLFxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCwgZGlzcG9zYWJsZXMsIGFjY2Vzc29yKSA9PiB7XG5cblx0XHRcdFx0Y29uc3QgY2VsbCA9IHZpZXdNb2RlbC52aWV3Q2VsbHNbMF0gYXMgQ29kZUNlbGxWaWV3TW9kZWw7XG5cdFx0XHRcdGNvbnN0IGNlbGxUZW1wbGF0ZSA9IGNyZWF0ZUNlbGxUZW1wbGF0ZShkaXNwb3NhYmxlcyk7XG5cdFx0XHRcdGNvbnN0IG91dHB1dCA9IGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci5jcmVhdGVJbnN0YW5jZShDZWxsT3V0cHV0Q29udGFpbmVyLCBlZGl0b3IsIGNlbGwsIGNlbGxUZW1wbGF0ZSwgeyBsaW1pdDogMTAwIH0pKTtcblx0XHRcdFx0b3V0cHV0LnJlbmRlcigpO1xuXHRcdFx0XHRjZWxsLm91dHB1dHNWaWV3TW9kZWxzWzBdLnNldFZpc2libGUodHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRwdXRNZW51cy5sZW5ndGgsIDEsICdzaG91bGQgaGF2ZSAxIG91dHB1dCBtZW51cycpO1xuXHRcdFx0XHRhc3NlcnQoY2VsbFRlbXBsYXRlLm91dHB1dENvbnRhaW5lci5kb21Ob2RlLnN0eWxlLmRpc3BsYXkgIT09ICdub25lJywgJ291dHB1dCBjb250YWluZXIgc2hvdWxkIGJlIHZpc2libGUnKTtcblx0XHRcdFx0Y2VsbC5vdXRwdXRzVmlld01vZGVsc1sxXS5zZXRWaXNpYmxlKHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0TWVudXMubGVuZ3RoLCAyLCAnc2hvdWxkIGhhdmUgMiBvdXRwdXQgbWVudXMnKTtcblx0XHRcdFx0Y2VsbC5vdXRwdXRzVmlld01vZGVsc1sxXS5zZXRWaXNpYmxlKHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0TWVudXMubGVuZ3RoLCAyLCAnc2hvdWxkIHN0aWxsIGhhdmUgMiBvdXRwdXQgbWVudXMnKTtcblx0XHRcdH0sXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ09uZSBvZiBtYW55IGNlbGwgb3V0cHV0cyBiZWNvbWVzIGhpZGRlbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBvdXRwdXRJdGVtID0geyBkYXRhOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdvdXRwdXQgY29udGVudCcpLCBtaW1lOiAndGV4dC9wbGFpbicgfTtcblx0XHRjb25zdCBodG1sT3V0cHV0SXRlbSA9IHsgZGF0YTogVlNCdWZmZXIuZnJvbVN0cmluZygnb3V0cHV0IGNvbnRlbnQnKSwgbWltZTogJ3RleHQvaHRtbCcgfTtcblx0XHRjb25zdCBvdXRwdXQxOiBJT3V0cHV0RHRvID0geyBvdXRwdXRJZDogJ2FiYycsIG91dHB1dHM6IFtvdXRwdXRJdGVtLCBodG1sT3V0cHV0SXRlbV0gfTtcblx0XHRjb25zdCBvdXRwdXQyOiBJT3V0cHV0RHRvID0geyBvdXRwdXRJZDogJ2RlZicsIG91dHB1dHM6IFtvdXRwdXRJdGVtLCBodG1sT3V0cHV0SXRlbV0gfTtcblx0XHRjb25zdCBvdXRwdXQzOiBJT3V0cHV0RHRvID0geyBvdXRwdXRJZDogJ2doaScsIG91dHB1dHM6IFtvdXRwdXRJdGVtLCBodG1sT3V0cHV0SXRlbV0gfTtcblxuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsncHJpbnQob3V0cHV0IGNvbnRlbnQpJywgJ3B5dGhvbicsIENlbGxLaW5kLkNvZGUsIFtvdXRwdXQxLCBvdXRwdXQyLCBvdXRwdXQzXSwge31dLFxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCwgZGlzcG9zYWJsZXMsIGFjY2Vzc29yKSA9PiB7XG5cblx0XHRcdFx0Y29uc3QgY2VsbCA9IHZpZXdNb2RlbC52aWV3Q2VsbHNbMF0gYXMgQ29kZUNlbGxWaWV3TW9kZWw7XG5cdFx0XHRcdGNvbnN0IGNlbGxUZW1wbGF0ZSA9IGNyZWF0ZUNlbGxUZW1wbGF0ZShkaXNwb3NhYmxlcyk7XG5cdFx0XHRcdGNvbnN0IG91dHB1dCA9IGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci5jcmVhdGVJbnN0YW5jZShDZWxsT3V0cHV0Q29udGFpbmVyLCBlZGl0b3IsIGNlbGwsIGNlbGxUZW1wbGF0ZSwgeyBsaW1pdDogMTAwIH0pKTtcblx0XHRcdFx0b3V0cHV0LnJlbmRlcigpO1xuXHRcdFx0XHRjZWxsLm91dHB1dHNWaWV3TW9kZWxzWzBdLnNldFZpc2libGUodHJ1ZSk7XG5cdFx0XHRcdGNlbGwub3V0cHV0c1ZpZXdNb2RlbHNbMV0uc2V0VmlzaWJsZSh0cnVlKTtcblx0XHRcdFx0Y2VsbC5vdXRwdXRzVmlld01vZGVsc1syXS5zZXRWaXNpYmxlKHRydWUpO1xuXHRcdFx0XHRjZWxsLm91dHB1dHNWaWV3TW9kZWxzWzFdLnNldFZpc2libGUoZmFsc2UpO1xuXHRcdFx0XHRhc3NlcnQoY2VsbFRlbXBsYXRlLm91dHB1dENvbnRhaW5lci5kb21Ob2RlLnN0eWxlLmRpc3BsYXkgIT09ICdub25lJywgJ291dHB1dCBjb250YWluZXIgc2hvdWxkIGJlIHZpc2libGUnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG91dHB1dE1lbnVzLmxlbmd0aCwgMiwgJ3Nob3VsZCBoYXZlIDIgb3V0cHV0IG1lbnVzJyk7XG5cdFx0XHR9LFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Vcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXQgYWxsIGFkamFjZW50IHN0cmVhbSBvdXRwdXRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHN0ZG91dCA9IHsgZGF0YTogVlNCdWZmZXIuZnJvbVN0cmluZygnc3Rkb3V0JyksIG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRvdXQnIH07XG5cdFx0Y29uc3Qgc3RkZXJyID0geyBkYXRhOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdzdGRlcnInKSwgbWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZGVycicgfTtcblx0XHRjb25zdCBvdXRwdXQxOiBJT3V0cHV0RHRvID0geyBvdXRwdXRJZDogJ2FiYycsIG91dHB1dHM6IFtzdGRvdXRdIH07XG5cdFx0Y29uc3Qgb3V0cHV0MjogSU91dHB1dER0byA9IHsgb3V0cHV0SWQ6ICdhYmMnLCBvdXRwdXRzOiBbc3RkZXJyXSB9O1xuXG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WydwcmludChvdXRwdXQgY29udGVudCknLCAncHl0aG9uJywgQ2VsbEtpbmQuQ29kZSwgW291dHB1dDEsIG91dHB1dDJdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0KF9lZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHRjb25zdCBjZWxsID0gdmlld01vZGVsLnZpZXdDZWxsc1swXTtcblx0XHRcdFx0Y29uc3Qgbm90ZWJvb2sgPSB2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudDtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gZ2V0QWxsT3V0cHV0c1RleHQobm90ZWJvb2ssIGNlbGwpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICdzdGRvdXRzdGRlcnInKTtcblx0XHRcdH0sXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldCBhbGwgbWl4ZWQgb3V0cHV0cyBvZiBjZWxsJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHN0ZG91dCA9IHsgZGF0YTogVlNCdWZmZXIuZnJvbVN0cmluZygnc3Rkb3V0JyksIG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRvdXQnIH07XG5cdFx0Y29uc3Qgc3RkZXJyID0geyBkYXRhOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdzdGRlcnInKSwgbWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZGVycicgfTtcblx0XHRjb25zdCBwbGFpblRleHQgPSB7IGRhdGE6IFZTQnVmZmVyLmZyb21TdHJpbmcoJ291dHB1dCBjb250ZW50JyksIG1pbWU6ICd0ZXh0L3BsYWluJyB9O1xuXHRcdGNvbnN0IGVycm9yID0geyBkYXRhOiBWU0J1ZmZlci5mcm9tU3RyaW5nKGB7XCJuYW1lXCI6XCJFcnJvciBOYW1lXCIsXCJtZXNzYWdlXCI6XCJlcnJvciBtZXNzYWdlXCIsXCJzdGFja1wiOlwiZXJyb3Igc3RhY2tcIn1gKSwgbWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLmVycm9yJyB9O1xuXHRcdGNvbnN0IG91dHB1dDE6IElPdXRwdXREdG8gPSB7IG91dHB1dElkOiAnYWJjJywgb3V0cHV0czogW3N0ZG91dF0gfTtcblx0XHRjb25zdCBvdXRwdXQyOiBJT3V0cHV0RHRvID0geyBvdXRwdXRJZDogJ2FiYycsIG91dHB1dHM6IFtzdGRlcnJdIH07XG5cdFx0Y29uc3Qgb3V0cHV0MzogSU91dHB1dER0byA9IHsgb3V0cHV0SWQ6ICdhYmMnLCBvdXRwdXRzOiBbcGxhaW5UZXh0XSB9O1xuXHRcdGNvbnN0IG91dHB1dDQ6IElPdXRwdXREdG8gPSB7IG91dHB1dElkOiAnYWJjJywgb3V0cHV0czogW2Vycm9yXSB9O1xuXG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WydwcmludChvdXRwdXQgY29udGVudCknLCAncHl0aG9uJywgQ2VsbEtpbmQuQ29kZSwgW291dHB1dDEsIG91dHB1dDIsIG91dHB1dDMsIG91dHB1dDRdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0KF9lZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHRjb25zdCBjZWxsID0gdmlld01vZGVsLnZpZXdDZWxsc1swXTtcblx0XHRcdFx0Y29uc3Qgbm90ZWJvb2sgPSB2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudDtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gZ2V0QWxsT3V0cHV0c1RleHQobm90ZWJvb2ssIGNlbGwpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsXG5cdFx0XHRcdFx0J0NlbGwgb3V0cHV0IDEgb2YgM1xcbicgK1xuXHRcdFx0XHRcdCdzdGRvdXRzdGRlcnJcXG4nICtcblx0XHRcdFx0XHQnQ2VsbCBvdXRwdXQgMiBvZiAzXFxuJyArXG5cdFx0XHRcdFx0J291dHB1dCBjb250ZW50XFxuJyArXG5cdFx0XHRcdFx0J0NlbGwgb3V0cHV0IDMgb2YgM1xcbicgK1xuXHRcdFx0XHRcdCdlcnJvciBzdGFjaydcblx0XHRcdFx0KTtcblx0XHRcdH0sXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZVxuXHRcdCk7XG5cblx0fSk7XG5cblxufSk7XG5cbmZ1bmN0aW9uIGNyZWF0ZUNlbGxUZW1wbGF0ZShkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKSB7XG5cdHJldHVybiB7XG5cdFx0b3V0cHV0Q29udGFpbmVyOiBuZXcgRmFzdERvbU5vZGUoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpLFxuXHRcdG91dHB1dFNob3dNb3JlQ29udGFpbmVyOiBuZXcgRmFzdERvbU5vZGUoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpLFxuXHRcdGZvY3VzU2lua0VsZW1lbnQ6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuXHRcdHRlbXBsYXRlRGlzcG9zYWJsZXM6IGRpc3Bvc2FibGVzLFxuXHRcdGVsZW1lbnREaXNwb3NhYmxlczogZGlzcG9zYWJsZXMsXG5cdH0gYXMgdW5rbm93biBhcyBDb2RlQ2VsbFJlbmRlclRlbXBsYXRlO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsMkJBQTJCO0FBR3BDLFNBQVMsZ0JBQW1EO0FBQzVELFNBQVMsMkJBQTJCLHdCQUF3QjtBQUM1RCxTQUFTLG1CQUFtQjtBQUU1QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLFlBQVk7QUFDckIsU0FBZ0Isb0JBQW9CO0FBQ3BDLFNBQVMsYUFBYTtBQUV0QixTQUFTLHlCQUF5QjtBQUVsQyxNQUFNLGNBQWMsTUFBTTtBQUN6QixRQUFNLFFBQVEsd0NBQXdDO0FBQ3RELE1BQUk7QUFDSixNQUFJLGNBQXVCLENBQUM7QUFFNUIsUUFBTSxNQUFNO0FBQ1gsa0JBQWMsQ0FB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
