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
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { isWeb } from "../../../../base/common/platform.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { ILifecycleService, LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { CURRENT_PROFILE_CONTEXT, HAS_PROFILES_CONTEXT, IS_CURRENT_PROFILE_TRANSIENT_CONTEXT, IUserDataProfileManagementService, IUserDataProfileService, PROFILES_CATEGORY, PROFILES_TITLE, isProfileURL } from "../../../services/userDataProfile/common/userDataProfile.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { URI } from "../../../../base/common/uri.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTagsService } from "../../tags/common/workspaceTags.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { EditorExtensions } from "../../../common/editor.js";
import { UserDataProfilesEditor, UserDataProfilesEditorInput, UserDataProfilesEditorInputSerializer } from "./userDataProfilesEditor.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IURLService } from "../../../../platform/url/common/url.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
const OpenProfileMenu = new MenuId("OpenProfile");
const ProfilesMenu = new MenuId("Profiles");
let UserDataProfilesWorkbenchContribution = class extends Disposable {
  constructor(userDataProfileService, userDataProfilesService, userDataProfileManagementService, telemetryService, workspaceContextService, workspaceTagsService, contextKeyService, editorGroupsService, instantiationService, lifecycleService, urlService, environmentService) {
    super();
    this.userDataProfileService = userDataProfileService;
    this.userDataProfilesService = userDataProfilesService;
    this.userDataProfileManagementService = userDataProfileManagementService;
    this.telemetryService = telemetryService;
    this.workspaceContextService = workspaceContextService;
    this.workspaceTagsService = workspaceTagsService;
    this.editorGroupsService = editorGroupsService;
    this.instantiationService = instantiationService;
    this.lifecycleService = lifecycleService;
    this.urlService = urlService;
    this.profilesDisposable = this._register(new MutableDisposable());
    this.currentProfileContext = CURRENT_PROFILE_CONTEXT.bindTo(contextKeyService);
    this.isCurrentProfileTransientContext = IS_CURRENT_PROFILE_TRANSIENT_CONTEXT.bindTo(contextKeyService);
    this.currentProfileContext.set(this.userDataProfileService.currentProfile.id);
    this.isCurrentProfileTransientContext.set(!!this.userDataProfileService.currentProfile.isTransient);
    this._register(this.userDataProfileService.onDidChangeCurrentProfile((e) => {
      this.currentProfileContext.set(this.userDataProfileService.currentProfile.id);
      this.isCurrentProfileTransientContext.set(!!this.userDataProfileService.currentProfile.isTransient);
    }));
    this.hasProfilesContext = HAS_PROFILES_CONTEXT.bindTo(contextKeyService);
    this.hasProfilesContext.set(this.userDataProfilesService.profiles.length > 1);
    this._register(this.userDataProfilesService.onDidChangeProfiles((e) => this.hasProfilesContext.set(this.userDataProfilesService.profiles.length > 1)));
    this.registerEditor();
    this.registerActions();
    this._register(this.urlService.registerHandler(this));
    if (isWeb) {
      lifecycleService.when(LifecyclePhase.Eventually).then(() => userDataProfilesService.cleanUp());
    }
    this.reportWorkspaceProfileInfo();
    if (environmentService.options?.profileToPreview) {
      lifecycleService.when(LifecyclePhase.Restored).then(() => this.handleURL(URI.revive(environmentService.options.profileToPreview)));
    }
  }
  async handleURL(uri) {
    if (isProfileURL(uri)) {
      const editor = await this.openProfilesEditor();
      if (editor) {
        editor.createNewProfile(uri);
        return true;
      }
    }
    return false;
  }
  async openProfilesEditor() {
    const editor = await this.editorGroupsService.activeGroup.openEditor(new UserDataProfilesEditorInput(this.instantiationService));
    return editor;
  }
  registerEditor() {
    Registry.as(EditorExtensions.EditorPane).registerEditorPane(
      EditorPaneDescriptor.create(
        UserDataProfilesEditor,
        UserDataProfilesEditor.ID,
        localize("userdataprofilesEditor", "Profiles Editor")
      ),
      [
        new SyncDescriptor(UserDataProfilesEditorInput)
      ]
    );
    Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(UserDataProfilesEditorInput.ID, UserDataProfilesEditorInputSerializer);
  }
  registerActions() {
    this.registerProfileSubMenu();
    this._register(this.registerManageProfilesAction());
    this._register(this.registerSwitchProfileAction());
    this.registerOpenProfileSubMenu();
    this.registerNewWindowWithProfileAction();
    this.registerProfilesActions();
    this._register(this.userDataProfilesService.onDidChangeProfiles(() => this.registerProfilesActions()));
    this._register(this.registerExportCurrentProfileAction());
    this.registerCreateFromCurrentProfileAction();
    this.registerNewProfileAction();
    this.registerDeleteProfileAction();
    this.registerHelpAction();
  }
  registerProfileSubMenu() {
    const getProfilesTitle = () => {
      return localize("profiles", "Profile ({0})", this.userDataProfileService.currentProfile.name);
    };
    MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
      get title() {
        return getProfilesTitle();
      },
      submenu: ProfilesMenu,
      group: "2_configuration",
      order: 1,
      when: HAS_PROFILES_CONTEXT
    });
    MenuRegistry.appendMenuItem(MenuId.MenubarPreferencesMenu, {
      get title() {
        return getProfilesTitle();
      },
      submenu: ProfilesMenu,
      group: "2_configuration",
      order: 1,
      when: HAS_PROFILES_CONTEXT
    });
  }
  registerOpenProfileSubMenu() {
    MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
      title: localize("New Profile Window", "New Window with Profile"),
      submenu: OpenProfileMenu,
      group: "1_new",
      order: 4
    });
  }
  registerProfilesActions() {
    this.profilesDisposable.value = new DisposableStore();
    for (const profile of this.userDataProfilesService.profiles) {
      if (!profile.isTransient) {
        this.profilesDisposable.value.add(this.registerProfileEntryAction(profile));
        this.profilesDisposable.value.add(this.registerNewWindowAction(profile));
      }
    }
  }
  registerProfileEntryAction(profile) {
    const that = this;
    return registerAction2(class ProfileEntryAction extends Action2 {
      constructor() {
        super({
          id: `workbench.profiles.actions.profileEntry.${profile.id}`,
          title: profile.name,
          metadata: {
            description: localize2("change profile", "Switch to {0} profile", profile.name)
          },
          toggled: ContextKeyExpr.equals(CURRENT_PROFILE_CONTEXT.key, profile.id),
          menu: [
            {
              id: ProfilesMenu,
              group: "0_profiles"
            }
          ]
        });
      }
      async run(accessor) {
        if (that.userDataProfileService.currentProfile.id !== profile.id) {
          return that.userDataProfileManagementService.switchProfile(profile);
        }
      }
    });
  }
  registerNewWindowWithProfileAction() {
    return registerAction2(class NewWindowWithProfileAction extends Action2 {
      constructor() {
        super({
          id: `workbench.profiles.actions.newWindowWithProfile`,
          title: localize2("newWindowWithProfile", "New Window with Profile..."),
          category: PROFILES_CATEGORY,
          precondition: HAS_PROFILES_CONTEXT,
          f1: true
        });
      }
      async run(accessor) {
        const quickInputService = accessor.get(IQuickInputService);
        const userDataProfilesService = accessor.get(IUserDataProfilesService);
        const hostService = accessor.get(IHostService);
        const pick = await quickInputService.pick(
          userDataProfilesService.profiles.map((profile) => ({
            label: profile.name,
            profile
          })),
          {
            title: localize("new window with profile", "New Window with Profile"),
            placeHolder: localize("pick profile", "Select Profile"),
            canPickMany: false
          }
        );
        if (pick) {
          return hostService.openWindow({ remoteAuthority: null, forceProfile: pick.profile.name });
        }
      }
    });
  }
  registerNewWindowAction(profile) {
    const disposables = new DisposableStore();
    const id = `workbench.action.openProfile.${profile.name.replace("/s+/", "_")}`;
    disposables.add(registerAction2(class NewWindowAction extends Action2 {
      constructor() {
        super({
          id,
          title: localize2("openShort", "{0}", profile.name),
          metadata: {
            description: localize2("open profile", "Open New Window with {0} Profile", profile.name)
          },
          menu: {
            id: OpenProfileMenu,
            group: "0_profiles",
            when: HAS_PROFILES_CONTEXT
          }
        });
      }
      run(accessor) {
        const hostService = accessor.get(IHostService);
        return hostService.openWindow({ remoteAuthority: null, forceProfile: profile.name });
      }
    }));
    disposables.add(MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
      command: {
        id,
        category: PROFILES_CATEGORY,
        title: localize2("open", "Open {0} Profile", profile.name),
        precondition: HAS_PROFILES_CONTEXT
      }
    }));
    return disposables;
  }
  registerSwitchProfileAction() {
    const that = this;
    return registerAction2(class SwitchProfileAction extends Action2 {
      constructor() {
        super({
          id: `workbench.profiles.actions.switchProfile`,
          title: localize2("switchProfile", "Switch Profile..."),
          category: PROFILES_CATEGORY,
          f1: true
        });
      }
      async run(accessor) {
        const quickInputService = accessor.get(IQuickInputService);
        const items = [];
        for (const profile of that.userDataProfilesService.profiles) {
          items.push({
            id: profile.id,
            label: profile.id === that.userDataProfileService.currentProfile.id ? `$(check) ${profile.name}` : profile.name,
            profile
          });
        }
        const result = await quickInputService.pick(items.sort((a, b) => a.profile.name.localeCompare(b.profile.name)), {
          placeHolder: localize("selectProfile", "Select Profile")
        });
        if (result) {
          await that.userDataProfileManagementService.switchProfile(result.profile);
        }
      }
    });
  }
  registerManageProfilesAction() {
    const disposables = new DisposableStore();
    disposables.add(registerAction2(class ManageProfilesAction extends Action2 {
      constructor() {
        super({
          id: `workbench.profiles.actions.manageProfiles`,
          title: {
            ...localize2("manage profiles", "Profiles"),
            mnemonicTitle: localize({ key: "miOpenProfiles", comment: ["&& denotes a mnemonic"] }, "&&Profiles")
          },
          menu: [
            {
              id: MenuId.GlobalActivity,
              group: "2_configuration",
              order: 1,
              when: HAS_PROFILES_CONTEXT.negate()
            },
            {
              id: MenuId.MenubarPreferencesMenu,
              group: "2_configuration",
              order: 1,
              when: HAS_PROFILES_CONTEXT.negate()
            },
            {
              id: ProfilesMenu,
              group: "1_manage",
              order: 1
            }
          ]
        });
      }
      run(accessor) {
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const instantiationService = accessor.get(IInstantiationService);
        return editorGroupsService.activeGroup.openEditor(new UserDataProfilesEditorInput(instantiationService));
      }
    }));
    disposables.add(MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
      command: {
        id: "workbench.profiles.actions.manageProfiles",
        category: Categories.Preferences,
        title: localize2("open profiles", "Open Profiles (UI)")
      }
    }));
    return disposables;
  }
  registerExportCurrentProfileAction() {
    const that = this;
    const disposables = new DisposableStore();
    const id = "workbench.profiles.actions.exportProfile";
    disposables.add(registerAction2(class ExportProfileAction extends Action2 {
      constructor() {
        super({
          id,
          title: localize2("export profile", "Export Profile..."),
          category: PROFILES_CATEGORY,
          f1: true
        });
      }
      async run() {
        const editor = await that.openProfilesEditor();
        editor?.selectProfile(that.userDataProfileService.currentProfile);
      }
    }));
    disposables.add(MenuRegistry.appendMenuItem(MenuId.MenubarShare, {
      command: {
        id,
        title: localize2("export profile in share", "Export Profile ({0})...", that.userDataProfileService.currentProfile.name)
      }
    }));
    return disposables;
  }
  registerCreateFromCurrentProfileAction() {
    const that = this;
    this._register(registerAction2(class CreateFromCurrentProfileAction extends Action2 {
      constructor() {
        super({
          id: "workbench.profiles.actions.createFromCurrentProfile",
          title: localize2("save profile as", "Save Current Profile As..."),
          category: PROFILES_CATEGORY,
          f1: true
        });
      }
      async run() {
        const editor = await that.openProfilesEditor();
        editor?.createNewProfile(that.userDataProfileService.currentProfile);
      }
    }));
  }
  registerNewProfileAction() {
    const that = this;
    this._register(registerAction2(class CreateProfileAction extends Action2 {
      constructor() {
        super({
          id: "workbench.profiles.actions.createProfile",
          title: localize2("create profile", "New Profile..."),
          category: PROFILES_CATEGORY,
          f1: true,
          menu: [
            {
              id: OpenProfileMenu,
              group: "1_manage_profiles",
              order: 1
            }
          ]
        });
      }
      async run(accessor) {
        const editor = await that.openProfilesEditor();
        return editor?.createNewProfile();
      }
    }));
  }
  registerDeleteProfileAction() {
    this._register(registerAction2(class DeleteProfileAction extends Action2 {
      constructor() {
        super({
          id: "workbench.profiles.actions.deleteProfile",
          title: localize2("delete profile", "Delete Profile..."),
          category: PROFILES_CATEGORY,
          f1: true,
          precondition: HAS_PROFILES_CONTEXT
        });
      }
      async run(accessor) {
        const quickInputService = accessor.get(IQuickInputService);
        const userDataProfileService = accessor.get(IUserDataProfileService);
        const userDataProfilesService = accessor.get(IUserDataProfilesService);
        const userDataProfileManagementService = accessor.get(IUserDataProfileManagementService);
        const notificationService = accessor.get(INotificationService);
        const profiles = userDataProfilesService.profiles.filter((p) => !p.isDefault && !p.isTransient);
        if (profiles.length) {
          const picks = await quickInputService.pick(
            profiles.map((profile) => ({
              label: profile.name,
              description: profile.id === userDataProfileService.currentProfile.id ? localize("current", "Current") : void 0,
              profile
            })),
            {
              title: localize("delete specific profile", "Delete Profile..."),
              placeHolder: localize("pick profile to delete", "Select Profiles to Delete"),
              canPickMany: true
            }
          );
          if (picks) {
            try {
              await Promise.all(picks.map((pick) => userDataProfileManagementService.removeProfile(pick.profile)));
            } catch (error) {
              notificationService.error(error);
            }
          }
        }
      }
    }));
  }
  registerHelpAction() {
    this._register(registerAction2(class HelpAction extends Action2 {
      constructor() {
        super({
          id: "workbench.profiles.actions.help",
          title: PROFILES_TITLE,
          category: Categories.Help,
          menu: [{
            id: MenuId.CommandPalette
          }]
        });
      }
      run(accessor) {
        return accessor.get(IOpenerService).open(URI.parse("https://aka.ms/vscode-profiles-help"));
      }
    }));
  }
  async reportWorkspaceProfileInfo() {
    await this.lifecycleService.when(LifecyclePhase.Eventually);
    if (this.userDataProfilesService.profiles.length > 1) {
      this.telemetryService.publicLog2("profiles:count", { count: this.userDataProfilesService.profiles.length - 1 });
    }
    const workspaceId = await this.workspaceTagsService.getTelemetryWorkspaceId(this.workspaceContextService.getWorkspace(), this.workspaceContextService.getWorkbenchState());
    this.telemetryService.publicLog2("workspaceProfileInfo", {
      workspaceId,
      defaultProfile: this.userDataProfileService.currentProfile.isDefault
    });
  }
};
UserDataProfilesWorkbenchContribution.ID = "workbench.contrib.userDataProfiles";
UserDataProfilesWorkbenchContribution = __decorateClass([
  __decorateParam(0, IUserDataProfileService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IUserDataProfileManagementService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IWorkspaceTagsService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IEditorGroupsService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, ILifecycleService),
  __decorateParam(10, IURLService),
  __decorateParam(11, IBrowserWorkbenchEnvironmentService)
], UserDataProfilesWorkbenchContribution);
export {
  OpenProfileMenu,
  UserDataProfilesWorkbenchContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi91c2VyRGF0YVByb2ZpbGUvYnJvd3Nlci91c2VyRGF0YVByb2ZpbGUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc1dlYiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgTWVudUlkLCBNZW51UmVnaXN0cnksIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGUsIElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSwgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBDVVJSRU5UX1BST0ZJTEVfQ09OVEVYVCwgSEFTX1BST0ZJTEVTX0NPTlRFWFQsIElTX0NVUlJFTlRfUFJPRklMRV9UUkFOU0lFTlRfQ09OVEVYVCwgSVVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlLCBJVXNlckRhdGFQcm9maWxlU2VydmljZSwgUFJPRklMRVNfQ0FURUdPUlksIFBST0ZJTEVTX1RJVExFLCBpc1Byb2ZpbGVVUkwgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUYWdzU2VydmljZSB9IGZyb20gJy4uLy4uL3RhZ3MvY29tbW9uL3dvcmtzcGFjZVRhZ3MuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEVkaXRvclBhbmVEZXNjcmlwdG9yLCBJRWRpdG9yUGFuZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9yRXh0ZW5zaW9ucywgSUVkaXRvckZhY3RvcnlSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgVXNlckRhdGFQcm9maWxlc0VkaXRvciwgVXNlckRhdGFQcm9maWxlc0VkaXRvcklucHV0LCBVc2VyRGF0YVByb2ZpbGVzRWRpdG9ySW5wdXRTZXJpYWxpemVyIH0gZnJvbSAnLi91c2VyRGF0YVByb2ZpbGVzRWRpdG9yLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlc0VkaXRvciB9IGZyb20gJy4uL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVVSTFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmwvY29tbW9uL3VybC5qcyc7XG5pbXBvcnQgeyBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2Jyb3dzZXIvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNvbnN0IE9wZW5Qcm9maWxlTWVudSA9IG5ldyBNZW51SWQoJ09wZW5Qcm9maWxlJyk7XG5jb25zdCBQcm9maWxlc01lbnUgPSBuZXcgTWVudUlkKCdQcm9maWxlcycpO1xuXG5leHBvcnQgY2xhc3MgVXNlckRhdGFQcm9maWxlc1dvcmtiZW5jaENvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIudXNlckRhdGFQcm9maWxlcyc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjdXJyZW50UHJvZmlsZUNvbnRleHQ6IElDb250ZXh0S2V5PHN0cmluZz47XG5cdHByaXZhdGUgcmVhZG9ubHkgaXNDdXJyZW50UHJvZmlsZVRyYW5zaWVudENvbnRleHQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGhhc1Byb2ZpbGVzQ29udGV4dDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUYWdzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVRhZ3NTZXJ2aWNlOiBJV29ya3NwYWNlVGFnc1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvckdyb3Vwc1NlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJVVJMU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVybFNlcnZpY2U6IElVUkxTZXJ2aWNlLFxuXHRcdEBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5jdXJyZW50UHJvZmlsZUNvbnRleHQgPSBDVVJSRU5UX1BST0ZJTEVfQ09OVEVYVC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuaXNDdXJyZW50UHJvZmlsZVRyYW5zaWVudENvbnRleHQgPSBJU19DVVJSRU5UX1BST0ZJTEVfVFJBTlNJRU5UX0NPTlRFWFQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuY3VycmVudFByb2ZpbGVDb250ZXh0LnNldCh0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaWQpO1xuXHRcdHRoaXMuaXNDdXJyZW50UHJvZmlsZVRyYW5zaWVudENvbnRleHQuc2V0KCEhdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmlzVHJhbnNpZW50KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2Uub25EaWRDaGFuZ2VDdXJyZW50UHJvZmlsZShlID0+IHtcblx0XHRcdHRoaXMuY3VycmVudFByb2ZpbGVDb250ZXh0LnNldCh0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaWQpO1xuXHRcdFx0dGhpcy5pc0N1cnJlbnRQcm9maWxlVHJhbnNpZW50Q29udGV4dC5zZXQoISF0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaXNUcmFuc2llbnQpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuaGFzUHJvZmlsZXNDb250ZXh0ID0gSEFTX1BST0ZJTEVTX0NPTlRFWFQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmhhc1Byb2ZpbGVzQ29udGV4dC5zZXQodGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcy5sZW5ndGggPiAxKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLm9uRGlkQ2hhbmdlUHJvZmlsZXMoZSA9PiB0aGlzLmhhc1Byb2ZpbGVzQ29udGV4dC5zZXQodGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcy5sZW5ndGggPiAxKSkpO1xuXG5cdFx0dGhpcy5yZWdpc3RlckVkaXRvcigpO1xuXHRcdHRoaXMucmVnaXN0ZXJBY3Rpb25zKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnVybFNlcnZpY2UucmVnaXN0ZXJIYW5kbGVyKHRoaXMpKTtcblxuXHRcdGlmIChpc1dlYikge1xuXHRcdFx0bGlmZWN5Y2xlU2VydmljZS53aGVuKExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpLnRoZW4oKCkgPT4gdXNlckRhdGFQcm9maWxlc1NlcnZpY2UuY2xlYW5VcCgpKTtcblx0XHR9XG5cblx0XHR0aGlzLnJlcG9ydFdvcmtzcGFjZVByb2ZpbGVJbmZvKCk7XG5cblx0XHRpZiAoZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnM/LnByb2ZpbGVUb1ByZXZpZXcpIHtcblx0XHRcdGxpZmVjeWNsZVNlcnZpY2Uud2hlbihMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCkudGhlbigoKSA9PiB0aGlzLmhhbmRsZVVSTChVUkkucmV2aXZlKGVudmlyb25tZW50U2VydmljZS5vcHRpb25zIS5wcm9maWxlVG9QcmV2aWV3ISkpKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBoYW5kbGVVUkwodXJpOiBVUkkpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoaXNQcm9maWxlVVJMKHVyaSkpIHtcblx0XHRcdGNvbnN0IGVkaXRvciA9IGF3YWl0IHRoaXMub3BlblByb2ZpbGVzRWRpdG9yKCk7XG5cdFx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRcdGVkaXRvci5jcmVhdGVOZXdQcm9maWxlKHVyaSk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9wZW5Qcm9maWxlc0VkaXRvcigpOiBQcm9taXNlPElVc2VyRGF0YVByb2ZpbGVzRWRpdG9yIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZWRpdG9yID0gYXdhaXQgdGhpcy5lZGl0b3JHcm91cHNTZXJ2aWNlLmFjdGl2ZUdyb3VwLm9wZW5FZGl0b3IobmV3IFVzZXJEYXRhUHJvZmlsZXNFZGl0b3JJbnB1dCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlKSk7XG5cdFx0cmV0dXJuIGVkaXRvciBhcyBJVXNlckRhdGFQcm9maWxlc0VkaXRvcjtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJFZGl0b3IoKTogdm9pZCB7XG5cdFx0UmVnaXN0cnkuYXM8SUVkaXRvclBhbmVSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JQYW5lKS5yZWdpc3RlckVkaXRvclBhbmUoXG5cdFx0XHRFZGl0b3JQYW5lRGVzY3JpcHRvci5jcmVhdGUoXG5cdFx0XHRcdFVzZXJEYXRhUHJvZmlsZXNFZGl0b3IsXG5cdFx0XHRcdFVzZXJEYXRhUHJvZmlsZXNFZGl0b3IuSUQsXG5cdFx0XHRcdGxvY2FsaXplKCd1c2VyZGF0YXByb2ZpbGVzRWRpdG9yJywgXCJQcm9maWxlcyBFZGl0b3JcIilcblx0XHRcdCksXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBTeW5jRGVzY3JpcHRvcihVc2VyRGF0YVByb2ZpbGVzRWRpdG9ySW5wdXQpXG5cdFx0XHRdXG5cdFx0KTtcblx0XHRSZWdpc3RyeS5hczxJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvckZhY3RvcnkpLnJlZ2lzdGVyRWRpdG9yU2VyaWFsaXplcihVc2VyRGF0YVByb2ZpbGVzRWRpdG9ySW5wdXQuSUQsIFVzZXJEYXRhUHJvZmlsZXNFZGl0b3JJbnB1dFNlcmlhbGl6ZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckFjdGlvbnMoKTogdm9pZCB7XG5cdFx0dGhpcy5yZWdpc3RlclByb2ZpbGVTdWJNZW51KCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5yZWdpc3Rlck1hbmFnZVByb2ZpbGVzQWN0aW9uKCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucmVnaXN0ZXJTd2l0Y2hQcm9maWxlQWN0aW9uKCkpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlck9wZW5Qcm9maWxlU3ViTWVudSgpO1xuXHRcdHRoaXMucmVnaXN0ZXJOZXdXaW5kb3dXaXRoUHJvZmlsZUFjdGlvbigpO1xuXHRcdHRoaXMucmVnaXN0ZXJQcm9maWxlc0FjdGlvbnMoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLm9uRGlkQ2hhbmdlUHJvZmlsZXMoKCkgPT4gdGhpcy5yZWdpc3RlclByb2ZpbGVzQWN0aW9ucygpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnJlZ2lzdGVyRXhwb3J0Q3VycmVudFByb2ZpbGVBY3Rpb24oKSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyQ3JlYXRlRnJvbUN1cnJlbnRQcm9maWxlQWN0aW9uKCk7XG5cdFx0dGhpcy5yZWdpc3Rlck5ld1Byb2ZpbGVBY3Rpb24oKTtcblx0XHR0aGlzLnJlZ2lzdGVyRGVsZXRlUHJvZmlsZUFjdGlvbigpO1xuXG5cdFx0dGhpcy5yZWdpc3RlckhlbHBBY3Rpb24oKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJQcm9maWxlU3ViTWVudSgpOiB2b2lkIHtcblx0XHRjb25zdCBnZXRQcm9maWxlc1RpdGxlID0gKCkgPT4ge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdwcm9maWxlcycsIFwiUHJvZmlsZSAoezB9KVwiLCB0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUubmFtZSk7XG5cdFx0fTtcblx0XHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkdsb2JhbEFjdGl2aXR5LCB7XG5cdFx0XHRnZXQgdGl0bGUoKSB7XG5cdFx0XHRcdHJldHVybiBnZXRQcm9maWxlc1RpdGxlKCk7XG5cdFx0XHR9LFxuXHRcdFx0c3VibWVudTogUHJvZmlsZXNNZW51LFxuXHRcdFx0Z3JvdXA6ICcyX2NvbmZpZ3VyYXRpb24nLFxuXHRcdFx0b3JkZXI6IDEsXG5cdFx0XHR3aGVuOiBIQVNfUFJPRklMRVNfQ09OVEVYVFxuXHRcdH0pO1xuXHRcdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhclByZWZlcmVuY2VzTWVudSwge1xuXHRcdFx0Z2V0IHRpdGxlKCkge1xuXHRcdFx0XHRyZXR1cm4gZ2V0UHJvZmlsZXNUaXRsZSgpO1xuXHRcdFx0fSxcblx0XHRcdHN1Ym1lbnU6IFByb2ZpbGVzTWVudSxcblx0XHRcdGdyb3VwOiAnMl9jb25maWd1cmF0aW9uJyxcblx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0d2hlbjogSEFTX1BST0ZJTEVTX0NPTlRFWFRcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJPcGVuUHJvZmlsZVN1Yk1lbnUoKTogdm9pZCB7XG5cdFx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyRmlsZU1lbnUsIHtcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnTmV3IFByb2ZpbGUgV2luZG93JywgXCJOZXcgV2luZG93IHdpdGggUHJvZmlsZVwiKSxcblx0XHRcdHN1Ym1lbnU6IE9wZW5Qcm9maWxlTWVudSxcblx0XHRcdGdyb3VwOiAnMV9uZXcnLFxuXHRcdFx0b3JkZXI6IDQsXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHByb2ZpbGVzRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxEaXNwb3NhYmxlU3RvcmU+KCkpO1xuXHRwcml2YXRlIHJlZ2lzdGVyUHJvZmlsZXNBY3Rpb25zKCk6IHZvaWQge1xuXHRcdHRoaXMucHJvZmlsZXNEaXNwb3NhYmxlLnZhbHVlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGZvciAoY29uc3QgcHJvZmlsZSBvZiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzKSB7XG5cdFx0XHRpZiAoIXByb2ZpbGUuaXNUcmFuc2llbnQpIHtcblx0XHRcdFx0dGhpcy5wcm9maWxlc0Rpc3Bvc2FibGUudmFsdWUuYWRkKHRoaXMucmVnaXN0ZXJQcm9maWxlRW50cnlBY3Rpb24ocHJvZmlsZSkpO1xuXHRcdFx0XHR0aGlzLnByb2ZpbGVzRGlzcG9zYWJsZS52YWx1ZS5hZGQodGhpcy5yZWdpc3Rlck5ld1dpbmRvd0FjdGlvbihwcm9maWxlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclByb2ZpbGVFbnRyeUFjdGlvbihwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHJldHVybiByZWdpc3RlckFjdGlvbjIoY2xhc3MgUHJvZmlsZUVudHJ5QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBgd29ya2JlbmNoLnByb2ZpbGVzLmFjdGlvbnMucHJvZmlsZUVudHJ5LiR7cHJvZmlsZS5pZH1gLFxuXHRcdFx0XHRcdHRpdGxlOiBwcm9maWxlLm5hbWUsXG5cdFx0XHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZTIoJ2NoYW5nZSBwcm9maWxlJywgXCJTd2l0Y2ggdG8gezB9IHByb2ZpbGVcIiwgcHJvZmlsZS5uYW1lKSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByLmVxdWFscyhDVVJSRU5UX1BST0ZJTEVfQ09OVEVYVC5rZXksIHByb2ZpbGUuaWQpLFxuXHRcdFx0XHRcdG1lbnU6IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0aWQ6IFByb2ZpbGVzTWVudSxcblx0XHRcdFx0XHRcdFx0Z3JvdXA6ICcwX3Byb2ZpbGVzJyxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRcdGlmICh0aGF0LnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaWQgIT09IHByb2ZpbGUuaWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhhdC51c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZS5zd2l0Y2hQcm9maWxlKHByb2ZpbGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTmV3V2luZG93V2l0aFByb2ZpbGVBY3Rpb24oKTogSURpc3Bvc2FibGUge1xuXHRcdHJldHVybiByZWdpc3RlckFjdGlvbjIoY2xhc3MgTmV3V2luZG93V2l0aFByb2ZpbGVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IGB3b3JrYmVuY2gucHJvZmlsZXMuYWN0aW9ucy5uZXdXaW5kb3dXaXRoUHJvZmlsZWAsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignbmV3V2luZG93V2l0aFByb2ZpbGUnLCBcIk5ldyBXaW5kb3cgd2l0aCBQcm9maWxlLi4uXCIpLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBQUk9GSUxFU19DQVRFR09SWSxcblx0XHRcdFx0XHRwcmVjb25kaXRpb246IEhBU19QUk9GSUxFU19DT05URVhULFxuXHRcdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdFx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBob3N0U2VydmljZSA9IGFjY2Vzc29yLmdldChJSG9zdFNlcnZpY2UpO1xuXG5cdFx0XHRcdGNvbnN0IHBpY2sgPSBhd2FpdCBxdWlja0lucHV0U2VydmljZS5waWNrKFxuXHRcdFx0XHRcdHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzLm1hcChwcm9maWxlID0+ICh7XG5cdFx0XHRcdFx0XHRsYWJlbDogcHJvZmlsZS5uYW1lLFxuXHRcdFx0XHRcdFx0cHJvZmlsZVxuXHRcdFx0XHRcdH0pKSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ25ldyB3aW5kb3cgd2l0aCBwcm9maWxlJywgXCJOZXcgV2luZG93IHdpdGggUHJvZmlsZVwiKSxcblx0XHRcdFx0XHRcdHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgncGljayBwcm9maWxlJywgXCJTZWxlY3QgUHJvZmlsZVwiKSxcblx0XHRcdFx0XHRcdGNhblBpY2tNYW55OiBmYWxzZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAocGljaykge1xuXHRcdFx0XHRcdHJldHVybiBob3N0U2VydmljZS5vcGVuV2luZG93KHsgcmVtb3RlQXV0aG9yaXR5OiBudWxsLCBmb3JjZVByb2ZpbGU6IHBpY2sucHJvZmlsZS5uYW1lIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTmV3V2luZG93QWN0aW9uKHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBpZCA9IGB3b3JrYmVuY2guYWN0aW9uLm9wZW5Qcm9maWxlLiR7cHJvZmlsZS5uYW1lLnJlcGxhY2UoJy9cXHMrLycsICdfJyl9YDtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RlckFjdGlvbjIoY2xhc3MgTmV3V2luZG93QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignb3BlblNob3J0JywgXCJ7MH1cIiwgcHJvZmlsZS5uYW1lKSxcblx0XHRcdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplMignb3BlbiBwcm9maWxlJywgXCJPcGVuIE5ldyBXaW5kb3cgd2l0aCB7MH0gUHJvZmlsZVwiLCBwcm9maWxlLm5hbWUpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0aWQ6IE9wZW5Qcm9maWxlTWVudSxcblx0XHRcdFx0XHRcdGdyb3VwOiAnMF9wcm9maWxlcycsXG5cdFx0XHRcdFx0XHR3aGVuOiBIQVNfUFJPRklMRVNfQ09OVEVYVFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRjb25zdCBob3N0U2VydmljZSA9IGFjY2Vzc29yLmdldChJSG9zdFNlcnZpY2UpO1xuXHRcdFx0XHRyZXR1cm4gaG9zdFNlcnZpY2Uub3BlbldpbmRvdyh7IHJlbW90ZUF1dGhvcml0eTogbnVsbCwgZm9yY2VQcm9maWxlOiBwcm9maWxlLm5hbWUgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ29tbWFuZFBhbGV0dGUsIHtcblx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0aWQsXG5cdFx0XHRcdGNhdGVnb3J5OiBQUk9GSUxFU19DQVRFR09SWSxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignb3BlbicsIFwiT3BlbiB7MH0gUHJvZmlsZVwiLCBwcm9maWxlLm5hbWUpLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IEhBU19QUk9GSUxFU19DT05URVhUXG5cdFx0XHR9LFxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBkaXNwb3NhYmxlcztcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJTd2l0Y2hQcm9maWxlQWN0aW9uKCk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRyZXR1cm4gcmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFN3aXRjaFByb2ZpbGVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IGB3b3JrYmVuY2gucHJvZmlsZXMuYWN0aW9ucy5zd2l0Y2hQcm9maWxlYCxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzd2l0Y2hQcm9maWxlJywgJ1N3aXRjaCBQcm9maWxlLi4uJyksXG5cdFx0XHRcdFx0Y2F0ZWdvcnk6IFBST0ZJTEVTX0NBVEVHT1JZLFxuXHRcdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdFx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXG5cdFx0XHRcdGNvbnN0IGl0ZW1zOiBBcnJheTxJUXVpY2tQaWNrSXRlbSAmIHsgcHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSB9PiA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHByb2ZpbGUgb2YgdGhhdC51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcykge1xuXHRcdFx0XHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0XHRcdFx0aWQ6IHByb2ZpbGUuaWQsXG5cdFx0XHRcdFx0XHRsYWJlbDogcHJvZmlsZS5pZCA9PT0gdGhhdC51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmlkID8gYCQoY2hlY2spICR7cHJvZmlsZS5uYW1lfWAgOiBwcm9maWxlLm5hbWUsXG5cdFx0XHRcdFx0XHRwcm9maWxlLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhpdGVtcy5zb3J0KChhLCBiKSA9PiBhLnByb2ZpbGUubmFtZS5sb2NhbGVDb21wYXJlKGIucHJvZmlsZS5uYW1lKSksIHtcblx0XHRcdFx0XHRwbGFjZUhvbGRlcjogbG9jYWxpemUoJ3NlbGVjdFByb2ZpbGUnLCBcIlNlbGVjdCBQcm9maWxlXCIpXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhhdC51c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZS5zd2l0Y2hQcm9maWxlKHJlc3VsdC5wcm9maWxlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlck1hbmFnZVByb2ZpbGVzQWN0aW9uKCk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIE1hbmFnZVByb2ZpbGVzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBgd29ya2JlbmNoLnByb2ZpbGVzLmFjdGlvbnMubWFuYWdlUHJvZmlsZXNgLFxuXHRcdFx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdFx0XHQuLi5sb2NhbGl6ZTIoJ21hbmFnZSBwcm9maWxlcycsIFwiUHJvZmlsZXNcIiksXG5cdFx0XHRcdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pT3BlblByb2ZpbGVzJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUHJvZmlsZXNcIiksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRtZW51OiBbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdGlkOiBNZW51SWQuR2xvYmFsQWN0aXZpdHksXG5cdFx0XHRcdFx0XHRcdGdyb3VwOiAnMl9jb25maWd1cmF0aW9uJyxcblx0XHRcdFx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdFx0XHRcdHdoZW46IEhBU19QUk9GSUxFU19DT05URVhULm5lZ2F0ZSgpXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJQcmVmZXJlbmNlc01lbnUsXG5cdFx0XHRcdFx0XHRcdGdyb3VwOiAnMl9jb25maWd1cmF0aW9uJyxcblx0XHRcdFx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdFx0XHRcdHdoZW46IEhBU19QUk9GSUxFU19DT05URVhULm5lZ2F0ZSgpXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRpZDogUHJvZmlsZXNNZW51LFxuXHRcdFx0XHRcdFx0XHRncm91cDogJzFfbWFuYWdlJyxcblx0XHRcdFx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRcdHJldHVybiBlZGl0b3JHcm91cHNTZXJ2aWNlLmFjdGl2ZUdyb3VwLm9wZW5FZGl0b3IobmV3IFVzZXJEYXRhUHJvZmlsZXNFZGl0b3JJbnB1dChpbnN0YW50aWF0aW9uU2VydmljZSkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwge1xuXHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5wcm9maWxlcy5hY3Rpb25zLm1hbmFnZVByb2ZpbGVzJyxcblx0XHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuUHJlZmVyZW5jZXMsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ29wZW4gcHJvZmlsZXMnLCBcIk9wZW4gUHJvZmlsZXMgKFVJKVwiKSxcblx0XHRcdH0sXG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGRpc3Bvc2FibGVzO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckV4cG9ydEN1cnJlbnRQcm9maWxlQWN0aW9uKCk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBpZCA9ICd3b3JrYmVuY2gucHJvZmlsZXMuYWN0aW9ucy5leHBvcnRQcm9maWxlJztcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEV4cG9ydFByb2ZpbGVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignZXhwb3J0IHByb2ZpbGUnLCBcIkV4cG9ydCBQcm9maWxlLi4uXCIpLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBQUk9GSUxFU19DQVRFR09SWSxcblx0XHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIHJ1bigpIHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yID0gYXdhaXQgdGhhdC5vcGVuUHJvZmlsZXNFZGl0b3IoKTtcblx0XHRcdFx0ZWRpdG9yPy5zZWxlY3RQcm9maWxlKHRoYXQudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJTaGFyZSwge1xuXHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRpZCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignZXhwb3J0IHByb2ZpbGUgaW4gc2hhcmUnLCBcIkV4cG9ydCBQcm9maWxlICh7MH0pLi4uXCIsIHRoYXQudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5uYW1lKSxcblx0XHRcdH0sXG5cdFx0fSkpO1xuXHRcdHJldHVybiBkaXNwb3NhYmxlcztcblx0fVxuXG5cblx0cHJpdmF0ZSByZWdpc3RlckNyZWF0ZUZyb21DdXJyZW50UHJvZmlsZUFjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgQ3JlYXRlRnJvbUN1cnJlbnRQcm9maWxlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLnByb2ZpbGVzLmFjdGlvbnMuY3JlYXRlRnJvbUN1cnJlbnRQcm9maWxlJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzYXZlIHByb2ZpbGUgYXMnLCBcIlNhdmUgQ3VycmVudCBQcm9maWxlIEFzLi4uXCIpLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBQUk9GSUxFU19DQVRFR09SWSxcblx0XHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIHJ1bigpIHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yID0gYXdhaXQgdGhhdC5vcGVuUHJvZmlsZXNFZGl0b3IoKTtcblx0XHRcdFx0ZWRpdG9yPy5jcmVhdGVOZXdQcm9maWxlKHRoYXQudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlck5ld1Byb2ZpbGVBY3Rpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIENyZWF0ZVByb2ZpbGVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2gucHJvZmlsZXMuYWN0aW9ucy5jcmVhdGVQcm9maWxlJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjcmVhdGUgcHJvZmlsZScsIFwiTmV3IFByb2ZpbGUuLi5cIiksXG5cdFx0XHRcdFx0Y2F0ZWdvcnk6IFBST0ZJTEVTX0NBVEVHT1JZLFxuXHRcdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRcdG1lbnU6IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0aWQ6IE9wZW5Qcm9maWxlTWVudSxcblx0XHRcdFx0XHRcdFx0Z3JvdXA6ICcxX21hbmFnZV9wcm9maWxlcycsXG5cdFx0XHRcdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvciA9IGF3YWl0IHRoYXQub3BlblByb2ZpbGVzRWRpdG9yKCk7XG5cdFx0XHRcdHJldHVybiBlZGl0b3I/LmNyZWF0ZU5ld1Byb2ZpbGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyRGVsZXRlUHJvZmlsZUFjdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgRGVsZXRlUHJvZmlsZUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5wcm9maWxlcy5hY3Rpb25zLmRlbGV0ZVByb2ZpbGUnLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2RlbGV0ZSBwcm9maWxlJywgXCJEZWxldGUgUHJvZmlsZS4uLlwiKSxcblx0XHRcdFx0XHRjYXRlZ29yeTogUFJPRklMRVNfQ0FURUdPUlksXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdFx0cHJlY29uZGl0aW9uOiBIQVNfUFJPRklMRVNfQ09OVEVYVCxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdFx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgdXNlckRhdGFQcm9maWxlc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgdXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cblx0XHRcdFx0Y29uc3QgcHJvZmlsZXMgPSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcy5maWx0ZXIocCA9PiAhcC5pc0RlZmF1bHQgJiYgIXAuaXNUcmFuc2llbnQpO1xuXHRcdFx0XHRpZiAocHJvZmlsZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29uc3QgcGlja3MgPSBhd2FpdCBxdWlja0lucHV0U2VydmljZS5waWNrKFxuXHRcdFx0XHRcdFx0cHJvZmlsZXMubWFwKHByb2ZpbGUgPT4gKHtcblx0XHRcdFx0XHRcdFx0bGFiZWw6IHByb2ZpbGUubmFtZSxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IHByb2ZpbGUuaWQgPT09IHVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaWQgPyBsb2NhbGl6ZSgnY3VycmVudCcsIFwiQ3VycmVudFwiKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0cHJvZmlsZVxuXHRcdFx0XHRcdFx0fSkpLFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2RlbGV0ZSBzcGVjaWZpYyBwcm9maWxlJywgXCJEZWxldGUgUHJvZmlsZS4uLlwiKSxcblx0XHRcdFx0XHRcdFx0cGxhY2VIb2xkZXI6IGxvY2FsaXplKCdwaWNrIHByb2ZpbGUgdG8gZGVsZXRlJywgXCJTZWxlY3QgUHJvZmlsZXMgdG8gRGVsZXRlXCIpLFxuXHRcdFx0XHRcdFx0XHRjYW5QaWNrTWFueTogdHJ1ZVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0aWYgKHBpY2tzKSB7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChwaWNrcy5tYXAocGljayA9PiB1c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZS5yZW1vdmVQcm9maWxlKHBpY2sucHJvZmlsZSkpKTtcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJIZWxwQWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBIZWxwQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLnByb2ZpbGVzLmFjdGlvbnMuaGVscCcsXG5cdFx0XHRcdFx0dGl0bGU6IFBST0ZJTEVTX1RJVExFLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkhlbHAsXG5cdFx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdW5rbm93biB7XG5cdFx0XHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSU9wZW5lclNlcnZpY2UpLm9wZW4oVVJJLnBhcnNlKCdodHRwczovL2FrYS5tcy92c2NvZGUtcHJvZmlsZXMtaGVscCcpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlcG9ydFdvcmtzcGFjZVByb2ZpbGVJbmZvKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMubGlmZWN5Y2xlU2VydmljZS53aGVuKExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpO1xuXG5cdFx0dHlwZSBVc2VyUHJvZmlsZXNDb3VudENsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdzYW5keTA4MSc7XG5cdFx0XHRjb21tZW50OiAnUmVwb3J0IHRoZSBudW1iZXIgb2YgdXNlciBwcm9maWxlcyBleGNsdWRpbmcgdGhlIGRlZmF1bHQgcHJvZmlsZSc7XG5cdFx0XHRjb3VudDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBudW1iZXIgb2YgdXNlciBwcm9maWxlcyBleGNsdWRpbmcgdGhlIGRlZmF1bHQgcHJvZmlsZScgfTtcblx0XHR9O1xuXHRcdHR5cGUgVXNlclByb2ZpbGVzQ291bnRFdmVudCA9IHtcblx0XHRcdGNvdW50OiBudW1iZXI7XG5cdFx0fTtcblx0XHRpZiAodGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcy5sZW5ndGggPiAxKSB7XG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxVc2VyUHJvZmlsZXNDb3VudEV2ZW50LCBVc2VyUHJvZmlsZXNDb3VudENsYXNzaWZpY2F0aW9uPigncHJvZmlsZXM6Y291bnQnLCB7IGNvdW50OiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzLmxlbmd0aCAtIDEgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd29ya3NwYWNlSWQgPSBhd2FpdCB0aGlzLndvcmtzcGFjZVRhZ3NTZXJ2aWNlLmdldFRlbGVtZXRyeVdvcmtzcGFjZUlkKHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCksIHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSk7XG5cdFx0dHlwZSBXb3Jrc3BhY2VQcm9maWxlSW5mb0NsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdzYW5keTA4MSc7XG5cdFx0XHRjb21tZW50OiAnUmVwb3J0IHByb2ZpbGUgaW5mb3JtYXRpb24gb2YgdGhlIGN1cnJlbnQgd29ya3NwYWNlJztcblx0XHRcdHdvcmtzcGFjZUlkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnQSBVVUlEIGdpdmVuIHRvIGEgd29ya3NwYWNlIHRvIGlkZW50aWZ5IGl0LicgfTtcblx0XHRcdGRlZmF1bHRQcm9maWxlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciB0aGUgcHJvZmlsZSBvZiB0aGUgd29ya3NwYWNlIGlzIGRlZmF1bHQgb3Igbm90LicgfTtcblx0XHR9O1xuXHRcdHR5cGUgV29ya3NwYWNlUHJvZmlsZUluZm9FdmVudCA9IHtcblx0XHRcdHdvcmtzcGFjZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRkZWZhdWx0UHJvZmlsZTogYm9vbGVhbjtcblx0XHR9O1xuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtzcGFjZVByb2ZpbGVJbmZvRXZlbnQsIFdvcmtzcGFjZVByb2ZpbGVJbmZvQ2xhc3NpZmljYXRpb24+KCd3b3Jrc3BhY2VQcm9maWxlSW5mbycsIHtcblx0XHRcdHdvcmtzcGFjZUlkLFxuXHRcdFx0ZGVmYXVsdFByb2ZpbGU6IHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5pc0RlZmF1bHRcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFlBQVksaUJBQThCLHlCQUF5QjtBQUM1RSxTQUFTLGFBQWE7QUFFdEIsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLFNBQVMsUUFBUSxjQUFjLHVCQUF1QjtBQUMvRCxTQUFTLGdCQUE2QiwwQkFBMEI7QUFDaEUsU0FBMkIsZ0NBQWdDO0FBRTNELFNBQVMsbUJBQW1CLHNCQUFzQjtBQUNsRCxTQUFTLHlCQUF5QixzQkFBc0Isc0NBQXNDLG1DQUFtQyx5QkFBeUIsbUJBQW1CLGdCQUFnQixvQkFBb0I7QUFDak4sU0FBUywwQkFBMEM7QUFDbkQsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNEJBQWlEO0FBQzFELFNBQVMsd0JBQWdEO0FBQ3pELFNBQVMsd0JBQXdCLDZCQUE2Qiw2Q0FBNkM7QUFDM0csU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUywyQ0FBMkM7QUFFN0MsTUFBTSxrQkFBa0IsSUFBSSxPQUFPLGFBQWE7QUFDdkQsTUFBTSxlQUFlLElBQUksT0FBTyxVQUFVO0FBRW5DLElBQU0sd0NBQU4sY0FBb0QsV0FBNkM7QUFBQSxFQVF2RyxZQUMyQyx3QkFDQyx5QkFDUyxrQ0FDaEIsa0JBQ08seUJBQ0gsc0JBQ3BCLG1CQUNtQixxQkFDQyxzQkFDSixrQkFDTixZQUNPLG9CQUNwQztBQUNELFVBQU07QUFib0M7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
