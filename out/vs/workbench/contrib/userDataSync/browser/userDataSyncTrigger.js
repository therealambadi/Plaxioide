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
import { Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isWeb } from "../../../../base/common/platform.js";
import { isEqual } from "../../../../base/common/resources.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IUserDataAutoSyncService } from "../../../../platform/userDataSync/common/userDataSync.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { VIEWLET_ID } from "../../extensions/common/extensions.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { KeybindingsEditorInput } from "../../../services/preferences/browser/keybindingsEditorInput.js";
import { SettingsEditor2Input } from "../../../services/preferences/common/preferencesEditorInput.js";
let UserDataSyncTrigger = class extends Disposable {
  constructor(editorService, userDataProfilesService, viewsService, userDataAutoSyncService, hostService) {
    super();
    this.userDataProfilesService = userDataProfilesService;
    const event = Event.filter(
      Event.any(
        Event.map(editorService.onDidActiveEditorChange, () => this.getUserDataEditorInputSource(editorService.activeEditor)),
        Event.map(Event.filter(viewsService.onDidChangeViewContainerVisibility, (e) => e.id === VIEWLET_ID && e.visible), (e) => e.id)
      ),
      (source) => source !== void 0
    );
    if (isWeb) {
      this._register(Event.debounce(
        Event.any(
          Event.map(hostService.onDidChangeFocus, () => "windowFocus"),
          Event.map(event, (source) => source)
        ),
        (last, source) => last ? [...last, source] : [source],
        1e3
      )((sources) => userDataAutoSyncService.triggerSync(sources, { skipIfSyncedRecently: true })));
    } else {
      this._register(event((source) => userDataAutoSyncService.triggerSync([source], { skipIfSyncedRecently: true })));
    }
  }
  getUserDataEditorInputSource(editorInput) {
    if (!editorInput) {
      return void 0;
    }
    if (editorInput instanceof SettingsEditor2Input) {
      return "settingsEditor";
    }
    if (editorInput instanceof KeybindingsEditorInput) {
      return "keybindingsEditor";
    }
    const resource = editorInput.resource;
    if (isEqual(resource, this.userDataProfilesService.defaultProfile.settingsResource)) {
      return "settingsEditor";
    }
    if (isEqual(resource, this.userDataProfilesService.defaultProfile.keybindingsResource)) {
      return "keybindingsEditor";
    }
    return void 0;
  }
};
UserDataSyncTrigger = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IViewsService),
  __decorateParam(3, IUserDataAutoSyncService),
  __decorateParam(4, IHostService)
], UserDataSyncTrigger);
export {
  UserDataSyncTrigger
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi91c2VyRGF0YVN5bmMvYnJvd3Nlci91c2VyRGF0YVN5bmNUcmlnZ2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFBdXRvU3luY1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFZJRVdMRVRfSUQgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9icm93c2VyL2tleWJpbmRpbmdzRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgU2V0dGluZ3NFZGl0b3IySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXNFZGl0b3JJbnB1dC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBVc2VyRGF0YVN5bmNUcmlnZ2VyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRWRpdG9yU2VydmljZSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASVZpZXdzU2VydmljZSB2aWV3c1NlcnZpY2U6IElWaWV3c1NlcnZpY2UsXG5cdFx0QElVc2VyRGF0YUF1dG9TeW5jU2VydmljZSB1c2VyRGF0YUF1dG9TeW5jU2VydmljZTogSVVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjb25zdCBldmVudCA9IEV2ZW50LmZpbHRlcihcblx0XHRcdEV2ZW50LmFueTxzdHJpbmcgfCB1bmRlZmluZWQ+KFxuXHRcdFx0XHRFdmVudC5tYXAoZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSwgKCkgPT4gdGhpcy5nZXRVc2VyRGF0YUVkaXRvcklucHV0U291cmNlKGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yKSksXG5cdFx0XHRcdEV2ZW50Lm1hcChFdmVudC5maWx0ZXIodmlld3NTZXJ2aWNlLm9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHksIGUgPT4gZS5pZCA9PT0gVklFV0xFVF9JRCAmJiBlLnZpc2libGUpLCBlID0+IGUuaWQpXG5cdFx0XHQpLCBzb3VyY2UgPT4gc291cmNlICE9PSB1bmRlZmluZWQpO1xuXHRcdGlmIChpc1dlYikge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZGVib3VuY2U8c3RyaW5nLCBzdHJpbmdbXT4oXG5cdFx0XHRcdEV2ZW50LmFueTxzdHJpbmc+KFxuXHRcdFx0XHRcdEV2ZW50Lm1hcChob3N0U2VydmljZS5vbkRpZENoYW5nZUZvY3VzLCAoKSA9PiAnd2luZG93Rm9jdXMnKSxcblx0XHRcdFx0XHRFdmVudC5tYXAoZXZlbnQsIHNvdXJjZSA9PiBzb3VyY2UhKSxcblx0XHRcdFx0KSwgKGxhc3QsIHNvdXJjZSkgPT4gbGFzdCA/IFsuLi5sYXN0LCBzb3VyY2VdIDogW3NvdXJjZV0sIDEwMDApXG5cdFx0XHRcdChzb3VyY2VzID0+IHVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlLnRyaWdnZXJTeW5jKHNvdXJjZXMsIHsgc2tpcElmU3luY2VkUmVjZW50bHk6IHRydWUgfSkpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoZXZlbnQoc291cmNlID0+IHVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlLnRyaWdnZXJTeW5jKFtzb3VyY2UhXSwgeyBza2lwSWZTeW5jZWRSZWNlbnRseTogdHJ1ZSB9KSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0VXNlckRhdGFFZGl0b3JJbnB1dFNvdXJjZShlZGl0b3JJbnB1dDogRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICghZWRpdG9ySW5wdXQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmIChlZGl0b3JJbnB1dCBpbnN0YW5jZW9mIFNldHRpbmdzRWRpdG9yMklucHV0KSB7XG5cdFx0XHRyZXR1cm4gJ3NldHRpbmdzRWRpdG9yJztcblx0XHR9XG5cdFx0aWYgKGVkaXRvcklucHV0IGluc3RhbmNlb2YgS2V5YmluZGluZ3NFZGl0b3JJbnB1dCkge1xuXHRcdFx0cmV0dXJuICdrZXliaW5kaW5nc0VkaXRvcic7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc291cmNlID0gZWRpdG9ySW5wdXQucmVzb3VyY2U7XG5cdFx0aWYgKGlzRXF1YWwocmVzb3VyY2UsIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc2V0dGluZ3NSZXNvdXJjZSkpIHtcblx0XHRcdHJldHVybiAnc2V0dGluZ3NFZGl0b3InO1xuXHRcdH1cblx0XHRpZiAoaXNFcXVhbChyZXNvdXJjZSwgdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5rZXliaW5kaW5nc1Jlc291cmNlKSkge1xuXHRcdFx0cmV0dXJuICdrZXliaW5kaW5nc0VkaXRvcic7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxnQ0FBZ0M7QUFHekMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyw0QkFBNEI7QUFFOUIsSUFBTSxzQkFBTixjQUFrQyxXQUE2QztBQUFBLEVBRXJGLFlBQ2lCLGVBQzJCLHlCQUM1QixjQUNXLHlCQUNaLGFBQ2I7QUFDRCxVQUFNO0FBTHFDO0FBTTNDLFVBQU0sUUFBUSxNQUFNO0FBQUEsTUFDbkIsTUFBTTtBQUFBLFFBQ0wsTUFBTSxJQUFJLGNBQWMseUJBQXlCLE1BQU0sS0FBSyw2QkFBNkIsY0FBYyxZQUFZLENBQUM7QUFBQSxRQUNwSCxNQUFNLElBQUksTUFBTSxPQUFPLGFBQWEsb0NBQW9DLE9BQUssRUFBRSxPQUFPLGNBQWMsRUFBRSxPQUFPLEdBQUcsT0FBSyxFQUFFLEVBQUU7QUFBQSxNQUMxSDtBQUFBLE1BQUcsWUFBVSxXQUFXO0FBQUEsSUFBUztBQUNsQyxRQUFJLE9BQU87QUFDVixXQUFLLFVBQVUsTUFBTTtBQUFBLFFBQ3BCLE1BQU07QUFBQSxVQUNMLE1BQU0sSUFBSSxZQUFZLGtCQUFrQixNQUFNLGFBQWE7QUFBQSxVQUMzRCxNQUFNLElBQUksT0FBTyxZQUFVLE1BQU87QUFBQSxRQUNuQztBQUFBLFFBQUcsQ0FBQyxNQUFNLFdBQVcsT0FBTyxDQUFDLEdBQUcsTUFBTSxNQUFNLElBQUksQ0FBQyxNQUFNO0FBQUEsUUFBRztBQUFBLE1BQUksRUFDN0QsYUFBVyx3QkFBd0IsWUFBWSxTQUFTLEVBQUUsc0JBQXNCLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFBQSxJQUMzRixPQUFPO0FBQ04sV0FBSyxVQUFVLE1BQU0sWUFBVSx3QkFBd0IsWUFBWSxDQUFDLE1BQU8sR0FBRyxFQUFFLHNCQUFzQixLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQUEsSUFDL0c7QUFBQSxFQUNEO0FBQUEsRUFFUSw2QkFBNkIsYUFBMEQ7QUFDOUYsUUFBSSxDQUFDLGFBQWE7QUFDakIsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLHVCQUF1QixzQkFBc0I7QUFDaEQsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLHVCQUF1Qix3QkFBd0I7QUFDbEQsYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNLFdBQVcsWUFBWTtBQUM3QixRQUFJLFFBQVEsVUFBVSxLQUFLLHdCQUF3QixlQUFlLGdCQUFnQixHQUFHO0FBQ3BGLGFBQU87QUFBQSxJQUNSO0FBQ0EsUUFBSSxRQUFRLFVBQVUsS0FBSyx3QkFBd0IsZUFBZSxtQkFBbUIsR0FBRztBQUN2RixhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUE5Q2Esc0JBQU47QUFBQSxFQUdKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBUFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
