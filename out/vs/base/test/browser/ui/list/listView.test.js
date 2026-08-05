import assert from "assert";
import { ListView } from "../../../../browser/ui/list/listView.js";
import { range } from "../../../../common/arrays.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../common/utils.js";
suite("ListView", function() {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("all rows get disposed", function() {
    const element = document.createElement("div");
    element.style.height = "200px";
    element.style.width = "200px";
    const delegate = {
      getHeight() {
        return 20;
      },
      getTemplateId() {
        return "template";
      }
    };
    let templatesCount = 0;
    const renderer = {
      templateId: "template",
      renderTemplate() {
        templatesCount++;
      },
      renderElement() {
      },
      disposeTemplate() {
        templatesCount--;
      }
    };
    const listView = new ListView(element, delegate, [renderer]);
    listView.layout(200);
    assert.strictEqual(templatesCount, 0, "no templates have been allocated");
    listView.splice(0, 0, range(100));
    assert.strictEqual(templatesCount, 10, "some templates have been allocated");
    listView.dispose();
    assert.strictEqual(templatesCount, 0, "all templates have been disposed");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvYnJvd3Nlci91aS9saXN0L2xpc3RWaWV3LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBJTGlzdFJlbmRlcmVyLCBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IExpc3RWaWV3IH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci91aS9saXN0L2xpc3RWaWV3LmpzJztcbmltcG9ydCB7IHJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnTGlzdFZpZXcnLCBmdW5jdGlvbiAoKSB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2FsbCByb3dzIGdldCBkaXNwb3NlZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZWxlbWVudC5zdHlsZS5oZWlnaHQgPSAnMjAwcHgnO1xuXHRcdGVsZW1lbnQuc3R5bGUud2lkdGggPSAnMjAwcHgnO1xuXG5cdFx0Y29uc3QgZGVsZWdhdGU6IElMaXN0VmlydHVhbERlbGVnYXRlPG51bWJlcj4gPSB7XG5cdFx0XHRnZXRIZWlnaHQoKSB7IHJldHVybiAyMDsgfSxcblx0XHRcdGdldFRlbXBsYXRlSWQoKSB7IHJldHVybiAndGVtcGxhdGUnOyB9XG5cdFx0fTtcblxuXHRcdGxldCB0ZW1wbGF0ZXNDb3VudCA9IDA7XG5cblx0XHRjb25zdCByZW5kZXJlcjogSUxpc3RSZW5kZXJlcjxudW1iZXIsIHZvaWQ+ID0ge1xuXHRcdFx0dGVtcGxhdGVJZDogJ3RlbXBsYXRlJyxcblx0XHRcdHJlbmRlclRlbXBsYXRlKCkgeyB0ZW1wbGF0ZXNDb3VudCsrOyB9LFxuXHRcdFx0cmVuZGVyRWxlbWVudCgpIHsgfSxcblx0XHRcdGRpc3Bvc2VUZW1wbGF0ZSgpIHsgdGVtcGxhdGVzQ291bnQtLTsgfVxuXHRcdH07XG5cblx0XHRjb25zdCBsaXN0VmlldyA9IG5ldyBMaXN0VmlldzxudW1iZXI+KGVsZW1lbnQsIGRlbGVnYXRlLCBbcmVuZGVyZXJdKTtcblx0XHRsaXN0Vmlldy5sYXlvdXQoMjAwKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZW1wbGF0ZXNDb3VudCwgMCwgJ25vIHRlbXBsYXRlcyBoYXZlIGJlZW4gYWxsb2NhdGVkJyk7XG5cdFx0bGlzdFZpZXcuc3BsaWNlKDAsIDAsIHJhbmdlKDEwMCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZW1wbGF0ZXNDb3VudCwgMTAsICdzb21lIHRlbXBsYXRlcyBoYXZlIGJlZW4gYWxsb2NhdGVkJyk7XG5cdFx0bGlzdFZpZXcuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZW1wbGF0ZXNDb3VudCwgMCwgJ2FsbCB0ZW1wbGF0ZXMgaGF2ZSBiZWVuIGRpc3Bvc2VkJyk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFFbkIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsK0NBQStDO0FBRXhELE1BQU0sWUFBWSxXQUFZO0FBQzdCLDBDQUF3QztBQUV4QyxPQUFLLHlCQUF5QixXQUFZO0FBQ3pDLFVBQU0sVUFBVSxTQUFTLGNBQWMsS0FBSztBQUM1QyxZQUFRLE1BQU0sU0FBUztBQUN2QixZQUFRLE1BQU0sUUFBUTtBQUV0QixVQUFNLFdBQXlDO0FBQUEsTUFDOUMsWUFBWTtBQUFFLGVBQU87QUFBQSxNQUFJO0FBQUEsTUFDekIsZ0JBQWdCO0FBQUUsZUFBTztBQUFBLE1BQVk7QUFBQSxJQUN0QztBQUVBLFFBQUksaUJBQWlCO0FBRXJCLFVBQU0sV0FBd0M7QUFBQSxNQUM3QyxZQUFZO0FBQUEsTUFDWixpQkFBaUI7QUFBRTtBQUFBLE1BQWtCO0FBQUEsTUFDckMsZ0JBQWdCO0FBQUEsTUFBRTtBQUFBLE1BQ2xCLGtCQUFrQjtBQUFFO0FBQUEsTUFBa0I7QUFBQSxJQUN2QztBQUVBLFVBQU0sV0FBVyxJQUFJLFNBQWlCLFNBQVMsVUFBVSxDQUFDLFFBQVEsQ0FBQztBQUNuRSxhQUFTLE9BQU8sR0FBRztBQUVuQixXQUFPLFlBQVksZ0JBQWdCLEdBQUcsa0NBQWtDO0FBQ3hFLGFBQVMsT0FBTyxHQUFHLEdBQUcsTUFBTSxHQUFHLENBQUM7QUFDaEMsV0FBTyxZQUFZLGdCQUFnQixJQUFJLG9DQUFvQztBQUMzRSxhQUFTLFFBQVE7QUFDakIsV0FBTyxZQUFZLGdCQUFnQixHQUFHLGtDQUFrQztBQUFBLEVBQ3pFLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
