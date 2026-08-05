import { localize } from "../../../../nls.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ViewAction } from "../../../browser/parts/views/viewPane.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { ctxAllCollapsed, ctxFilterOnType, ctxFollowsCursor, ctxSortMode, IOutlinePane, OutlineSortOrder } from "./outline.js";
registerAction2(class CollapseAll extends ViewAction {
  constructor() {
    super({
      viewId: IOutlinePane.Id,
      id: "outline.collapse",
      title: localize("collapse", "Collapse All"),
      f1: false,
      icon: Codicon.collapseAll,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", IOutlinePane.Id), ctxAllCollapsed.isEqualTo(false))
      }
    });
  }
  runInView(_accessor, view) {
    view.collapseAll();
  }
});
registerAction2(class ExpandAll extends ViewAction {
  constructor() {
    super({
      viewId: IOutlinePane.Id,
      id: "outline.expand",
      title: localize("expand", "Expand All"),
      f1: false,
      icon: Codicon.expandAll,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", IOutlinePane.Id), ctxAllCollapsed.isEqualTo(true))
      }
    });
  }
  runInView(_accessor, view) {
    view.expandAll();
  }
});
registerAction2(class FollowCursor extends ViewAction {
  constructor() {
    super({
      viewId: IOutlinePane.Id,
      id: "outline.followCursor",
      title: localize("followCur", "Follow Cursor"),
      f1: false,
      toggled: ctxFollowsCursor,
      menu: {
        id: MenuId.ViewTitle,
        group: "config",
        order: 1,
        when: ContextKeyExpr.equals("view", IOutlinePane.Id)
      }
    });
  }
  runInView(_accessor, view) {
    view.outlineViewState.followCursor = !view.outlineViewState.followCursor;
  }
});
registerAction2(class FilterOnType extends ViewAction {
  constructor() {
    super({
      viewId: IOutlinePane.Id,
      id: "outline.filterOnType",
      title: localize("filterOnType", "Filter on Type"),
      f1: false,
      toggled: ctxFilterOnType,
      menu: {
        id: MenuId.ViewTitle,
        group: "config",
        order: 2,
        when: ContextKeyExpr.equals("view", IOutlinePane.Id)
      }
    });
  }
  runInView(_accessor, view) {
    view.outlineViewState.filterOnType = !view.outlineViewState.filterOnType;
  }
});
registerAction2(class SortByPosition extends ViewAction {
  constructor() {
    super({
      viewId: IOutlinePane.Id,
      id: "outline.sortByPosition",
      title: localize("sortByPosition", "Sort By: Position"),
      f1: false,
      toggled: ctxSortMode.isEqualTo(OutlineSortOrder.ByPosition),
      menu: {
        id: MenuId.ViewTitle,
        group: "sort",
        order: 1,
        when: ContextKeyExpr.equals("view", IOutlinePane.Id)
      }
    });
  }
  runInView(_accessor, view) {
    view.outlineViewState.sortBy = OutlineSortOrder.ByPosition;
  }
});
registerAction2(class SortByName extends ViewAction {
  constructor() {
    super({
      viewId: IOutlinePane.Id,
      id: "outline.sortByName",
      title: localize("sortByName", "Sort By: Name"),
      f1: false,
      toggled: ctxSortMode.isEqualTo(OutlineSortOrder.ByName),
      menu: {
        id: MenuId.ViewTitle,
        group: "sort",
        order: 2,
        when: ContextKeyExpr.equals("view", IOutlinePane.Id)
      }
    });
  }
  runInView(_accessor, view) {
    view.outlineViewState.sortBy = OutlineSortOrder.ByName;
  }
});
registerAction2(class SortByKind extends ViewAction {
  constructor() {
    super({
      viewId: IOutlinePane.Id,
      id: "outline.sortByKind",
      title: localize("sortByKind", "Sort By: Category"),
      f1: false,
      toggled: ctxSortMode.isEqualTo(OutlineSortOrder.ByKind),
      menu: {
        id: MenuId.ViewTitle,
        group: "sort",
        order: 3,
        when: ContextKeyExpr.equals("view", IOutlinePane.Id)
      }
    });
  }
  runInView(_accessor, view) {
    view.outlineViewState.sortBy = OutlineSortOrder.ByKind;
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9vdXRsaW5lL2Jyb3dzZXIvb3V0bGluZUFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgTWVudUlkLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFZpZXdBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdQYW5lLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBjdHhBbGxDb2xsYXBzZWQsIGN0eEZpbHRlck9uVHlwZSwgY3R4Rm9sbG93c0N1cnNvciwgY3R4U29ydE1vZGUsIElPdXRsaW5lUGFuZSwgT3V0bGluZVNvcnRPcmRlciB9IGZyb20gJy4vb3V0bGluZS5qcyc7XG5cblxuLy8gLS0tIGNvbW1hbmRzXG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBDb2xsYXBzZUFsbCBleHRlbmRzIFZpZXdBY3Rpb248SU91dGxpbmVQYW5lPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdHZpZXdJZDogSU91dGxpbmVQYW5lLklkLFxuXHRcdFx0aWQ6ICdvdXRsaW5lLmNvbGxhcHNlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnY29sbGFwc2UnLCBcIkNvbGxhcHNlIEFsbFwiKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdGljb246IENvZGljb24uY29sbGFwc2VBbGwsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgSU91dGxpbmVQYW5lLklkKSwgY3R4QWxsQ29sbGFwc2VkLmlzRXF1YWxUbyhmYWxzZSkpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblx0cnVuSW5WaWV3KF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogSU91dGxpbmVQYW5lKSB7XG5cdFx0dmlldy5jb2xsYXBzZUFsbCgpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEV4cGFuZEFsbCBleHRlbmRzIFZpZXdBY3Rpb248SU91dGxpbmVQYW5lPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdHZpZXdJZDogSU91dGxpbmVQYW5lLklkLFxuXHRcdFx0aWQ6ICdvdXRsaW5lLmV4cGFuZCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2V4cGFuZCcsIFwiRXhwYW5kIEFsbFwiKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdGljb246IENvZGljb24uZXhwYW5kQWxsLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIElPdXRsaW5lUGFuZS5JZCksIGN0eEFsbENvbGxhcHNlZC5pc0VxdWFsVG8odHJ1ZSkpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblx0cnVuSW5WaWV3KF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogSU91dGxpbmVQYW5lKSB7XG5cdFx0dmlldy5leHBhbmRBbGwoKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBGb2xsb3dDdXJzb3IgZXh0ZW5kcyBWaWV3QWN0aW9uPElPdXRsaW5lUGFuZT4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHR2aWV3SWQ6IElPdXRsaW5lUGFuZS5JZCxcblx0XHRcdGlkOiAnb3V0bGluZS5mb2xsb3dDdXJzb3InLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdmb2xsb3dDdXInLCBcIkZvbGxvdyBDdXJzb3JcIiksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHR0b2dnbGVkOiBjdHhGb2xsb3dzQ3Vyc29yLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICdjb25maWcnLFxuXHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgSU91dGxpbmVQYW5lLklkKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdHJ1bkluVmlldyhfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IElPdXRsaW5lUGFuZSkge1xuXHRcdHZpZXcub3V0bGluZVZpZXdTdGF0ZS5mb2xsb3dDdXJzb3IgPSAhdmlldy5vdXRsaW5lVmlld1N0YXRlLmZvbGxvd0N1cnNvcjtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBGaWx0ZXJPblR5cGUgZXh0ZW5kcyBWaWV3QWN0aW9uPElPdXRsaW5lUGFuZT4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHR2aWV3SWQ6IElPdXRsaW5lUGFuZS5JZCxcblx0XHRcdGlkOiAnb3V0bGluZS5maWx0ZXJPblR5cGUnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdmaWx0ZXJPblR5cGUnLCBcIkZpbHRlciBvbiBUeXBlXCIpLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0dG9nZ2xlZDogY3R4RmlsdGVyT25UeXBlLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICdjb25maWcnLFxuXHRcdFx0XHRvcmRlcjogMixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgSU91dGxpbmVQYW5lLklkKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdHJ1bkluVmlldyhfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IElPdXRsaW5lUGFuZSkge1xuXHRcdHZpZXcub3V0bGluZVZpZXdTdGF0ZS5maWx0ZXJPblR5cGUgPSAhdmlldy5vdXRsaW5lVmlld1N0YXRlLmZpbHRlck9uVHlwZTtcblx0fVxufSk7XG5cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFNvcnRCeVBvc2l0aW9uIGV4dGVuZHMgVmlld0FjdGlvbjxJT3V0bGluZVBhbmU+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0dmlld0lkOiBJT3V0bGluZVBhbmUuSWQsXG5cdFx0XHRpZDogJ291dGxpbmUuc29ydEJ5UG9zaXRpb24nLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzb3J0QnlQb3NpdGlvbicsIFwiU29ydCBCeTogUG9zaXRpb25cIiksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHR0b2dnbGVkOiBjdHhTb3J0TW9kZS5pc0VxdWFsVG8oT3V0bGluZVNvcnRPcmRlci5CeVBvc2l0aW9uKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGdyb3VwOiAnc29ydCcsXG5cdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBJT3V0bGluZVBhbmUuSWQpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblx0cnVuSW5WaWV3KF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogSU91dGxpbmVQYW5lKSB7XG5cdFx0dmlldy5vdXRsaW5lVmlld1N0YXRlLnNvcnRCeSA9IE91dGxpbmVTb3J0T3JkZXIuQnlQb3NpdGlvbjtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBTb3J0QnlOYW1lIGV4dGVuZHMgVmlld0FjdGlvbjxJT3V0bGluZVBhbmU+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0dmlld0lkOiBJT3V0bGluZVBhbmUuSWQsXG5cdFx0XHRpZDogJ291dGxpbmUuc29ydEJ5TmFtZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ3NvcnRCeU5hbWUnLCBcIlNvcnQgQnk6IE5hbWVcIiksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHR0b2dnbGVkOiBjdHhTb3J0TW9kZS5pc0VxdWFsVG8oT3V0bGluZVNvcnRPcmRlci5CeU5hbWUpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICdzb3J0Jyxcblx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIElPdXRsaW5lUGFuZS5JZClcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRydW5JblZpZXcoX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBJT3V0bGluZVBhbmUpIHtcblx0XHR2aWV3Lm91dGxpbmVWaWV3U3RhdGUuc29ydEJ5ID0gT3V0bGluZVNvcnRPcmRlci5CeU5hbWU7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgU29ydEJ5S2luZCBleHRlbmRzIFZpZXdBY3Rpb248SU91dGxpbmVQYW5lPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdHZpZXdJZDogSU91dGxpbmVQYW5lLklkLFxuXHRcdFx0aWQ6ICdvdXRsaW5lLnNvcnRCeUtpbmQnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzb3J0QnlLaW5kJywgXCJTb3J0IEJ5OiBDYXRlZ29yeVwiKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdHRvZ2dsZWQ6IGN0eFNvcnRNb2RlLmlzRXF1YWxUbyhPdXRsaW5lU29ydE9yZGVyLkJ5S2luZCksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRncm91cDogJ3NvcnQnLFxuXHRcdFx0XHRvcmRlcjogMyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgSU91dGxpbmVQYW5lLklkKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdHJ1bkluVmlldyhfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IElPdXRsaW5lUGFuZSkge1xuXHRcdHZpZXcub3V0bGluZVZpZXdTdGF0ZS5zb3J0QnkgPSBPdXRsaW5lU29ydE9yZGVyLkJ5S2luZDtcblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxT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QUFBQSxNQUNyRCxJQUFJO0FBQUEsTUFDSixTQUFTLFlBQVksVUFBVSxpQkFBaUIsVUFBVTtBQUFBLE1BQzFELE1BQU07QUFBQSxRQUNMLElBQUksT0FBTztBQUFBLFFBQ1gsT0FBTztBQUFBLFFBQ1AsT0FBTztBQUFBLFFBQ1AsTUFBTSxlQUFlLE9BQU8sUUFBUSxhQUFhLEVBQUU7QUFBQSxNQUNwRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLFVBQVUsV0FBNkIsTUFBb0I7QUFDMUQsU0FBSyxpQkFBaUIsU0FBUyxpQkFBaUI7QUFBQSxFQUNqRDtBQUNELENBQUM7QUFFRCxnQkFBZ0IsTUFBTSxtQkFBbUIsV0FBeUI7QUFBQSxFQUNqRSxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsUUFBUSxhQUFhO0FBQUEsTUFDckIsSUFBSTtBQUFBLE1BQ0osT0FBTyxTQUFTLGNBQWMsZUFBZTtBQUFBLE1BQzdDLElBQUk7QUFBQSxNQUNKLFNBQVMsWUFBWSxVQUFVLGlCQUFpQixNQUFNO0FBQUEsTUFDdEQsTUFBTTtBQUFBLFFBQ0wsSUFBSSxPQUFPO0FBQUEsUUFDWCxPQUFPO0FBQUEsUUFDUCxPQUFPO0FBQUEsUUFDUCxNQUFNLGVBQWUsT0FBTyxRQUFRLGFBQWEsRUFBRTtBQUFBLE1BQ3BEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsVUFBVSxXQUE2QixNQUFvQjtBQUMxRCxTQUFLLGlCQUFpQixTQUFTLGlCQUFpQjtBQUFBLEVBQ2pEO0FBQ0QsQ0FBQztBQUVELGdCQUFnQixNQUFNLG1CQUFtQixXQUF5QjtBQUFBLEVBQ2pFLGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxRQUFRLGFBQWE7QUFBQSxNQUNyQixJQUFJO0FBQUEsTUFDSixPQUFPLFNBQVMsY0FBYyxtQkFBbUI7QUFBQSxNQUNqRCxJQUFJO0FBQUEsTUFDSixTQUFTLFlBQVksVUFBVSxpQkFBaUIsTUFBTTtBQUFBLE1BQ3RELE1BQU07QUFBQSxRQUNMLElBQUksT0FBTztBQUFBLFFBQ1gsT0FBTztBQUFBLFFBQ1AsT0FBTztBQUFBLFFBQ1AsTUFBTSxlQUFlLE9BQU8sUUFBUSxhQUFhLEVBQUU7QUFBQSxNQUNwRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLFVBQVUsV0FBNkIsTUFBb0I7QUFDMUQsU0FBSyxpQkFBaUIsU0FBUyxpQkFBaUI7QUFBQSxFQUNqRDtBQUNELENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
