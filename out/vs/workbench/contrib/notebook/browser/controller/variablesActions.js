import { localize2 } from "../../../../../nls.js";
import { MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { KERNEL_HAS_VARIABLE_PROVIDER } from "../../common/notebookContextKeys.js";
import { NOTEBOOK_VARIABLE_VIEW_ENABLED } from "../contrib/notebookVariables/notebookVariableContextKeys.js";
import * as icons from "../notebookIcons.js";
import { NotebookAction } from "./coreActions.js";
const OPEN_VARIABLES_VIEW_COMMAND_ID = "notebook.openVariablesView";
registerAction2(class OpenVariablesViewAction extends NotebookAction {
  constructor() {
    super({
      id: OPEN_VARIABLES_VIEW_COMMAND_ID,
      title: localize2("notebookActions.openVariablesView", "Variables"),
      icon: icons.variablesViewIcon,
      menu: [
        {
          id: MenuId.InteractiveToolbar,
          group: "navigation",
          when: ContextKeyExpr.and(
            KERNEL_HAS_VARIABLE_PROVIDER,
            // jupyter extension currently contributes their own goto variables button
            ContextKeyExpr.notEquals("jupyter.kernel.isjupyter", true),
            NOTEBOOK_VARIABLE_VIEW_ENABLED
          )
        },
        {
          id: MenuId.EditorTitle,
          order: -1,
          group: "navigation",
          when: ContextKeyExpr.and(
            KERNEL_HAS_VARIABLE_PROVIDER,
            // jupyter extension currently contributes their own goto variables button
            ContextKeyExpr.notEquals("jupyter.kernel.isjupyter", true),
            ContextKeyExpr.notEquals("config.notebook.globalToolbar", true),
            NOTEBOOK_VARIABLE_VIEW_ENABLED
          )
        },
        {
          id: MenuId.NotebookToolbar,
          order: -1,
          group: "navigation",
          when: ContextKeyExpr.and(
            KERNEL_HAS_VARIABLE_PROVIDER,
            // jupyter extension currently contributes their own goto variables button
            ContextKeyExpr.notEquals("jupyter.kernel.isjupyter", true),
            ContextKeyExpr.equals("config.notebook.globalToolbar", true),
            NOTEBOOK_VARIABLE_VIEW_ENABLED
          )
        }
      ]
    });
  }
  async runWithContext(accessor, context) {
    const variableViewId = "workbench.notebook.variables";
    accessor.get(IViewsService).openView(variableViewId, true);
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyb2xsZXIvdmFyaWFibGVzQWN0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEtFUk5FTF9IQVNfVkFSSUFCTEVfUFJPVklERVIgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBOT1RFQk9PS19WQVJJQUJMRV9WSUVXX0VOQUJMRUQgfSBmcm9tICcuLi9jb250cmliL25vdGVib29rVmFyaWFibGVzL25vdGVib29rVmFyaWFibGVDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgKiBhcyBpY29ucyBmcm9tICcuLi9ub3RlYm9va0ljb25zLmpzJztcblxuaW1wb3J0IHsgSU5vdGVib29rQWN0aW9uQ29udGV4dCwgTm90ZWJvb2tBY3Rpb24gfSBmcm9tICcuL2NvcmVBY3Rpb25zLmpzJztcblxuY29uc3QgT1BFTl9WQVJJQUJMRVNfVklFV19DT01NQU5EX0lEID0gJ25vdGVib29rLm9wZW5WYXJpYWJsZXNWaWV3JztcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIE9wZW5WYXJpYWJsZXNWaWV3QWN0aW9uIGV4dGVuZHMgTm90ZWJvb2tBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBPUEVOX1ZBUklBQkxFU19WSUVXX0NPTU1BTkRfSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdub3RlYm9va0FjdGlvbnMub3BlblZhcmlhYmxlc1ZpZXcnLCBcIlZhcmlhYmxlc1wiKSxcblx0XHRcdGljb246IGljb25zLnZhcmlhYmxlc1ZpZXdJY29uLFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5JbnRlcmFjdGl2ZVRvb2xiYXIsXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRLRVJORUxfSEFTX1ZBUklBQkxFX1BST1ZJREVSLFxuXHRcdFx0XHRcdFx0Ly8ganVweXRlciBleHRlbnNpb24gY3VycmVudGx5IGNvbnRyaWJ1dGVzIHRoZWlyIG93biBnb3RvIHZhcmlhYmxlcyBidXR0b25cblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnanVweXRlci5rZXJuZWwuaXNqdXB5dGVyJywgdHJ1ZSksXG5cdFx0XHRcdFx0XHROT1RFQk9PS19WQVJJQUJMRV9WSUVXX0VOQUJMRURcblx0XHRcdFx0XHQpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0XHRcdG9yZGVyOiAtMSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdEtFUk5FTF9IQVNfVkFSSUFCTEVfUFJPVklERVIsXG5cdFx0XHRcdFx0XHQvLyBqdXB5dGVyIGV4dGVuc2lvbiBjdXJyZW50bHkgY29udHJpYnV0ZXMgdGhlaXIgb3duIGdvdG8gdmFyaWFibGVzIGJ1dHRvblxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIubm90RXF1YWxzKCdqdXB5dGVyLmtlcm5lbC5pc2p1cHl0ZXInLCB0cnVlKSxcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnY29uZmlnLm5vdGVib29rLmdsb2JhbFRvb2xiYXInLCB0cnVlKSxcblx0XHRcdFx0XHRcdE5PVEVCT09LX1ZBUklBQkxFX1ZJRVdfRU5BQkxFRFxuXHRcdFx0XHRcdClcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tUb29sYmFyLFxuXHRcdFx0XHRcdG9yZGVyOiAtMSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdEtFUk5FTF9IQVNfVkFSSUFCTEVfUFJPVklERVIsXG5cdFx0XHRcdFx0XHQvLyBqdXB5dGVyIGV4dGVuc2lvbiBjdXJyZW50bHkgY29udHJpYnV0ZXMgdGhlaXIgb3duIGdvdG8gdmFyaWFibGVzIGJ1dHRvblxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIubm90RXF1YWxzKCdqdXB5dGVyLmtlcm5lbC5pc2p1cHl0ZXInLCB0cnVlKSxcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLm5vdGVib29rLmdsb2JhbFRvb2xiYXInLCB0cnVlKSxcblx0XHRcdFx0XHRcdE5PVEVCT09LX1ZBUklBQkxFX1ZJRVdfRU5BQkxFRFxuXHRcdFx0XHRcdClcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0FjdGlvbkNvbnRleHQpIHtcblx0XHRjb25zdCB2YXJpYWJsZVZpZXdJZCA9ICd3b3JrYmVuY2gubm90ZWJvb2sudmFyaWFibGVzJztcblx0XHRhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSkub3BlblZpZXcodmFyaWFibGVWaWV3SWQsIHRydWUpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsUUFBUSx1QkFBdUI7QUFDeEMsU0FBUyxzQkFBc0I7QUFFL0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxzQ0FBc0M7QUFDL0MsWUFBWSxXQUFXO0FBRXZCLFNBQWlDLHNCQUFzQjtBQUV2RCxNQUFNLGlDQUFpQztBQUV2QyxnQkFBZ0IsTUFBTSxnQ0FBZ0MsZUFBZTtBQUFBLEVBRXBFLGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJO0FBQUEsTUFDSixPQUFPLFVBQVUscUNBQXFDLFdBQVc7QUFBQSxNQUNqRSxNQUFNLE1BQU07QUFBQSxNQUNaLE1BQU07QUFBQSxRQUNMO0FBQUEsVUFDQyxJQUFJLE9BQU87QUFBQSxVQUNYLE9BQU87QUFBQSxVQUNQLE1BQU0sZUFBZTtBQUFBLFlBQ3BCO0FBQUE7QUFBQSxZQUVBLGVBQWUsVUFBVSw0QkFBNEIsSUFBSTtBQUFBLFlBQ3pEO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFBQSxRQUNBO0FBQUEsVUFDQyxJQUFJLE9BQU87QUFBQSxVQUNYLE9BQU87QUFBQSxVQUNQLE9BQU87QUFBQSxVQUNQLE1BQU0sZUFBZTtBQUFBLFlBQ3BCO0FBQUE7QUFBQSxZQUVBLGVBQWUsVUFBVSw0QkFBNEIsSUFBSTtBQUFBLFlBQ3pELGVBQWUsVUFBVSxpQ0FBaUMsSUFBSTtBQUFBLFlBQzlEO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFBQSxRQUNBO0FBQUEsVUFDQyxJQUFJLE9BQU87QUFBQSxVQUNYLE9BQU87QUFBQSxVQUNQLE9BQU87QUFBQSxVQUNQLE1BQU0sZUFBZTtBQUFBLFlBQ3BCO0FBQUE7QUFBQSxZQUVBLGVBQWUsVUFBVSw0QkFBNEIsSUFBSTtBQUFBLFlBQ3pELGVBQWUsT0FBTyxpQ0FBaUMsSUFBSTtBQUFBLFlBQzNEO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBZSxlQUFlLFVBQTRCLFNBQWlDO0FBQzFGLFVBQU0saUJBQWlCO0FBQ3ZCLGFBQVMsSUFBSSxhQUFhLEVBQUUsU0FBUyxnQkFBZ0IsSUFBSTtBQUFBLEVBQzFEO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
