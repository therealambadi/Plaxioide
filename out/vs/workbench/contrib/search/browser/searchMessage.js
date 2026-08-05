import * as nls from "../../../../nls.js";
import * as dom from "../../../../base/browser/dom.js";
import { parseLinkedText } from "../../../../base/common/linkedText.js";
import Severity from "../../../../base/common/severity.js";
import { SeverityIcon } from "../../../../base/browser/ui/severityIcon/severityIcon.js";
import { TextSearchCompleteMessageType } from "../../../services/search/common/searchExtTypes.js";
import { Schemas } from "../../../../base/common/network.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { URI } from "../../../../base/common/uri.js";
const renderSearchMessage = (message, instantiationService, notificationService, openerService, commandService, disposableStore, triggerSearch) => {
  const div = dom.$("div.providerMessage");
  const linkedText = parseLinkedText(message.text);
  dom.append(
    div,
    dom.$("." + SeverityIcon.className(
      message.type === TextSearchCompleteMessageType.Information ? Severity.Info : Severity.Warning
    ).split(" ").join("."))
  );
  for (const node of linkedText.nodes) {
    if (typeof node === "string") {
      dom.append(div, document.createTextNode(node));
    } else {
      const link = instantiationService.createInstance(Link, div, node, {
        opener: async (href) => {
          if (!message.trusted) {
            return;
          }
          const parsed = URI.parse(href, true);
          if (parsed.scheme === Schemas.command && message.trusted) {
            const result = await commandService.executeCommand(parsed.path);
            if (result?.triggerSearch) {
              triggerSearch();
            }
          } else if (parsed.scheme === Schemas.https) {
            openerService.open(parsed);
          } else {
            if (parsed.scheme === Schemas.command && !message.trusted) {
              notificationService.error(nls.localize("unable to open trust", "Unable to open command link from untrusted source: {0}", href));
            } else {
              notificationService.error(nls.localize("unable to open", "Unable to open unknown link: {0}", href));
            }
          }
        }
      });
      disposableStore.add(link);
    }
  }
  return div;
};
export {
  renderSearchMessage
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hNZXNzYWdlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgcGFyc2VMaW5rZWRUZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlua2VkVGV4dC5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IFNldmVyaXR5SWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zZXZlcml0eUljb24vc2V2ZXJpdHlJY29uLmpzJztcbmltcG9ydCB7IFRleHRTZWFyY2hDb21wbGV0ZU1lc3NhZ2UsIFRleHRTZWFyY2hDb21wbGV0ZU1lc3NhZ2VUeXBlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2hFeHRUeXBlcy5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBMaW5rIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2Jyb3dzZXIvbGluay5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuXG5leHBvcnQgY29uc3QgcmVuZGVyU2VhcmNoTWVzc2FnZSA9IChcblx0bWVzc2FnZTogVGV4dFNlYXJjaENvbXBsZXRlTWVzc2FnZSxcblx0aW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0bm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRkaXNwb3NhYmxlU3RvcmU6IERpc3Bvc2FibGVTdG9yZSxcblx0dHJpZ2dlclNlYXJjaDogKCkgPT4gdm9pZCxcbik6IEhUTUxFbGVtZW50ID0+IHtcblx0Y29uc3QgZGl2ID0gZG9tLiQoJ2Rpdi5wcm92aWRlck1lc3NhZ2UnKTtcblx0Y29uc3QgbGlua2VkVGV4dCA9IHBhcnNlTGlua2VkVGV4dChtZXNzYWdlLnRleHQpO1xuXHRkb20uYXBwZW5kKGRpdixcblx0XHRkb20uJCgnLicgK1xuXHRcdFx0U2V2ZXJpdHlJY29uLmNsYXNzTmFtZShcblx0XHRcdFx0bWVzc2FnZS50eXBlID09PSBUZXh0U2VhcmNoQ29tcGxldGVNZXNzYWdlVHlwZS5JbmZvcm1hdGlvblxuXHRcdFx0XHRcdD8gU2V2ZXJpdHkuSW5mb1xuXHRcdFx0XHRcdDogU2V2ZXJpdHkuV2FybmluZylcblx0XHRcdFx0LnNwbGl0KCcgJylcblx0XHRcdFx0LmpvaW4oJy4nKSkpO1xuXG5cdGZvciAoY29uc3Qgbm9kZSBvZiBsaW5rZWRUZXh0Lm5vZGVzKSB7XG5cdFx0aWYgKHR5cGVvZiBub2RlID09PSAnc3RyaW5nJykge1xuXHRcdFx0ZG9tLmFwcGVuZChkaXYsIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKG5vZGUpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbGluayA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKExpbmssIGRpdiwgbm9kZSwge1xuXHRcdFx0XHRvcGVuZXI6IGFzeW5jIGhyZWYgPT4ge1xuXHRcdFx0XHRcdGlmICghbWVzc2FnZS50cnVzdGVkKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdGNvbnN0IHBhcnNlZCA9IFVSSS5wYXJzZShocmVmLCB0cnVlKTtcblx0XHRcdFx0XHRpZiAocGFyc2VkLnNjaGVtZSA9PT0gU2NoZW1hcy5jb21tYW5kICYmIG1lc3NhZ2UudHJ1c3RlZCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQocGFyc2VkLnBhdGgpO1xuXHRcdFx0XHRcdFx0aWYgKChyZXN1bHQgYXMgYW55KT8udHJpZ2dlclNlYXJjaCkge1xuXHRcdFx0XHRcdFx0XHR0cmlnZ2VyU2VhcmNoKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChwYXJzZWQuc2NoZW1lID09PSBTY2hlbWFzLmh0dHBzKSB7XG5cdFx0XHRcdFx0XHRvcGVuZXJTZXJ2aWNlLm9wZW4ocGFyc2VkKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWYgKHBhcnNlZC5zY2hlbWUgPT09IFNjaGVtYXMuY29tbWFuZCAmJiAhbWVzc2FnZS50cnVzdGVkKSB7XG5cdFx0XHRcdFx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobmxzLmxvY2FsaXplKCd1bmFibGUgdG8gb3BlbiB0cnVzdCcsIFwiVW5hYmxlIHRvIG9wZW4gY29tbWFuZCBsaW5rIGZyb20gdW50cnVzdGVkIHNvdXJjZTogezB9XCIsIGhyZWYpKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobmxzLmxvY2FsaXplKCd1bmFibGUgdG8gb3BlbicsIFwiVW5hYmxlIHRvIG9wZW4gdW5rbm93biBsaW5rOiB7MH1cIiwgaHJlZikpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKGxpbmspO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gZGl2O1xufTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUNyQixZQUFZLFNBQVM7QUFFckIsU0FBUyx1QkFBdUI7QUFDaEMsT0FBTyxjQUFjO0FBR3JCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQW9DLHFDQUFxQztBQUV6RSxTQUFTLGVBQWU7QUFFeEIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsV0FBVztBQUViLE1BQU0sc0JBQXNCLENBQ2xDLFNBQ0Esc0JBQ0EscUJBQ0EsZUFDQSxnQkFDQSxpQkFDQSxrQkFDaUI7QUFDakIsUUFBTSxNQUFNLElBQUksRUFBRSxxQkFBcUI7QUFDdkMsUUFBTSxhQUFhLGdCQUFnQixRQUFRLElBQUk7QUFDL0MsTUFBSTtBQUFBLElBQU87QUFBQSxJQUNWLElBQUksRUFBRSxNQUNMLGFBQWE7QUFBQSxNQUNaLFFBQVEsU0FBUyw4QkFBOEIsY0FDNUMsU0FBUyxPQUNULFNBQVM7QUFBQSxJQUFPLEVBQ2xCLE1BQU0sR0FBRyxFQUNULEtBQUssR0FBRyxDQUFDO0FBQUEsRUFBQztBQUVkLGFBQVcsUUFBUSxXQUFXLE9BQU87QUFDcEMsUUFBSSxPQUFPLFNBQVMsVUFBVTtBQUM3QixVQUFJLE9BQU8sS0FBSyxTQUFTLGVBQWUsSUFBSSxDQUFDO0FBQUEsSUFDOUMsT0FBTztBQUNOLFlBQU0sT0FBTyxxQkFBcUIsZUFBZSxNQUFNLEtBQUssTUFBTTtBQUFBLFFBQ2pFLFFBQVEsT0FBTSxTQUFRO0FBQ3JCLGNBQUksQ0FBQyxRQUFRLFNBQVM7QUFBRTtBQUFBLFVBQVE7QUFDaEMsZ0JBQU0sU0FBUyxJQUFJLE1BQU0sTUFBTSxJQUFJO0FBQ25DLGNBQUksT0FBTyxXQUFXLFFBQVEsV0FBVyxRQUFRLFNBQVM7QUFDekQsa0JBQU0sU0FBUyxNQUFNLGVBQWUsZUFBZSxPQUFPLElBQUk7QUFDOUQsZ0JBQUssUUFBZ0IsZUFBZTtBQUNuQyw0QkFBYztBQUFBLFlBQ2Y7QUFBQSxVQUNELFdBQVcsT0FBTyxXQUFXLFFBQVEsT0FBTztBQUMzQywwQkFBYyxLQUFLLE1BQU07QUFBQSxVQUMxQixPQUFPO0FBQ04sZ0JBQUksT0FBTyxXQUFXLFFBQVEsV0FBVyxDQUFDLFFBQVEsU0FBUztBQUMxRCxrQ0FBb0IsTUFBTSxJQUFJLFNBQVMsd0JBQXdCLDBEQUEwRCxJQUFJLENBQUM7QUFBQSxZQUMvSCxPQUFPO0FBQ04sa0NBQW9CLE1BQU0sSUFBSSxTQUFTLGtCQUFrQixvQ0FBb0MsSUFBSSxDQUFDO0FBQUEsWUFDbkc7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELHNCQUFnQixJQUFJLElBQUk7QUFBQSxJQUN6QjtBQUFBLEVBQ0Q7QUFDQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbXQp9Cg==
