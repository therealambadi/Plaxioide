import { Action, Separator, SubmenuAction } from "../../../../base/common/actions.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Schemas } from "../../../../base/common/network.js";
import { localize, localize2 } from "../../../../nls.js";
import { MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { TerminalLocation, TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { ResourceContextKey } from "../../../common/contextkeys.js";
import { TaskExecutionSupportedContext } from "../../tasks/common/taskService.js";
import { TerminalCommandId, TERMINAL_VIEW_ID } from "../common/terminal.js";
import { TerminalContextKeys, TerminalContextKeyStrings } from "../common/terminalContextKey.js";
import { terminalStrings } from "../common/terminalStrings.js";
import { ACTIVE_GROUP, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
var ContextMenuGroup = /* @__PURE__ */ ((ContextMenuGroup2) => {
  ContextMenuGroup2["Create"] = "1_create";
  ContextMenuGroup2["Edit"] = "3_edit";
  ContextMenuGroup2["Clear"] = "5_clear";
  ContextMenuGroup2["Kill"] = "7_kill";
  ContextMenuGroup2["Config"] = "9_config";
  return ContextMenuGroup2;
})(ContextMenuGroup || {});
var TerminalMenuBarGroup = /* @__PURE__ */ ((TerminalMenuBarGroup2) => {
  TerminalMenuBarGroup2["Create"] = "1_create";
  TerminalMenuBarGroup2["Run"] = "3_run";
  TerminalMenuBarGroup2["Manage"] = "5_manage";
  TerminalMenuBarGroup2["Configure"] = "7_configure";
  return TerminalMenuBarGroup2;
})(TerminalMenuBarGroup || {});
function setupTerminalMenus() {
  MenuRegistry.appendMenuItems(
    [
      {
        id: MenuId.MenubarTerminalMenu,
        item: {
          group: "1_create" /* Create */,
          command: {
            id: TerminalCommandId.New,
            title: localize({ key: "miNewTerminal", comment: ["&& denotes a mnemonic"] }, "&&New Terminal")
          },
          order: 1
        }
      },
      {
        id: MenuId.MenubarTerminalMenu,
        item: {
          group: "1_create" /* Create */,
          command: {
            id: TerminalCommandId.Split,
            title: localize({ key: "miSplitTerminal", comment: ["&& denotes a mnemonic"] }, "&&Split Terminal"),
            precondition: ContextKeyExpr.has(TerminalContextKeyStrings.IsOpen)
          },
          order: 2,
          when: TerminalContextKeys.processSupported
        }
      },
      {
        id: MenuId.MenubarTerminalMenu,
        item: {
          group: "3_run" /* Run */,
          command: {
            id: TerminalCommandId.RunActiveFile,
            title: localize({ key: "miRunActiveFile", comment: ["&& denotes a mnemonic"] }, "Run &&Active File")
          },
          order: 3,
          when: TerminalContextKeys.processSupported
        }
      },
      {
        id: MenuId.MenubarTerminalMenu,
        item: {
          group: "3_run" /* Run */,
          command: {
            id: TerminalCommandId.RunSelectedText,
            title: localize({ key: "miRunSelectedText", comment: ["&& denotes a mnemonic"] }, "Run &&Selected Text")
          },
          order: 4,
          when: TerminalContextKeys.processSupported
        }
      }
    ]
  );
  MenuRegistry.appendMenuItems(
    [
      {
        id: MenuId.TerminalInstanceContext,
        item: {
          group: "1_create" /* Create */,
          command: {
            id: TerminalCommandId.Split,
            title: terminalStrings.split.value
          }
        }
      },
      {
        id: MenuId.TerminalInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.New,
            title: terminalStrings.new
          },
          group: "1_create" /* Create */
        }
      },
      {
        id: MenuId.TerminalInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.KillViewOrEditor,
            title: terminalStrings.kill.value
          },
          group: "7_kill" /* Kill */
        }
      },
      {
        id: MenuId.TerminalInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.CopySelection,
            title: localize("workbench.action.terminal.copySelection.short", "Copy")
          },
          group: "3_edit" /* Edit */,
          order: 1
        }
      },
      {
        id: MenuId.TerminalInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.CopySelectionAsHtml,
            title: localize("workbench.action.terminal.copySelectionAsHtml", "Copy as HTML")
          },
          group: "3_edit" /* Edit */,
          order: 2
        }
      },
      {
        id: MenuId.TerminalInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.Paste,
            title: localize("workbench.action.terminal.paste.short", "Paste")
          },
          group: "3_edit" /* Edit */,
          order: 3
        }
      },
      {
        id: MenuId.TerminalInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.Clear,
            title: localize("workbench.action.terminal.clear", "Clear")
          },
          group: "5_clear" /* Clear */
        }
      },
      {
        id: MenuId.TerminalInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.SizeToContentWidth,
            title: terminalStrings.toggleSizeToContentWidth
          },
          group: "9_config" /* Config */
        }
      },
      {
        id: MenuId.TerminalInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.SelectAll,
            title: localize("workbench.action.terminal.selectAll", "Select All")
          },
          group: "3_edit" /* Edit */,
          order: 3
        }
      }
    ]
  );
  MenuRegistry.appendMenuItems(
    [
      {
        id: MenuId.TerminalEditorInstanceContext,
        item: {
          group: "1_create" /* Create */,
          command: {
            id: TerminalCommandId.Split,
            title: terminalStrings.split.value
          }
        }
      },
      {
        id: MenuId.TerminalEditorInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.New,
            title: terminalStrings.new
          },
          group: "1_create" /* Create */
        }
      },
      {
        id: MenuId.TerminalEditorInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.KillEditor,
            title: terminalStrings.kill.value
          },
          group: "7_kill" /* Kill */
        }
      },
      {
        id: MenuId.TerminalEditorInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.CopySelection,
            title: localize("workbench.action.terminal.copySelection.short", "Copy")
          },
          group: "3_edit" /* Edit */,
          order: 1
        }
      },
      {
        id: MenuId.TerminalEditorInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.CopySelectionAsHtml,
            title: localize("workbench.action.terminal.copySelectionAsHtml", "Copy as HTML")
          },
          group: "3_edit" /* Edit */,
          order: 2
        }
      },
      {
        id: MenuId.TerminalEditorInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.Paste,
            title: localize("workbench.action.terminal.paste.short", "Paste")
          },
          group: "3_edit" /* Edit */,
          order: 3
        }
      },
      {
        id: MenuId.TerminalEditorInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.Clear,
            title: localize("workbench.action.terminal.clear", "Clear")
          },
          group: "5_clear" /* Clear */
        }
      },
      {
        id: MenuId.TerminalEditorInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.SelectAll,
            title: localize("workbench.action.terminal.selectAll", "Select All")
          },
          group: "3_edit" /* Edit */,
          order: 3
        }
      },
      {
        id: MenuId.TerminalEditorInstanceContext,
        item: {
          command: {
            id: TerminalCommandId.SizeToContentWidth,
            title: terminalStrings.toggleSizeToContentWidth
          },
          group: "9_config" /* Config */
        }
      }
    ]
  );
  MenuRegistry.appendMenuItems(
    [
      {
        id: MenuId.TerminalTabEmptyAreaContext,
        item: {
          command: {
            id: TerminalCommandId.NewWithProfile,
            title: localize("workbench.action.terminal.newWithProfile.short", "New Terminal With Profile...")
          },
          group: "1_create" /* Create */
        }
      },
      {
        id: MenuId.TerminalTabEmptyAreaContext,
        item: {
          command: {
            id: TerminalCommandId.New,
            title: terminalStrings.new
          },
          group: "1_create" /* Create */
        }
      }
    ]
  );
  MenuRegistry.appendMenuItems(
    [
      {
        id: MenuId.TerminalNewDropdownContext,
        item: {
          command: {
            id: TerminalCommandId.SelectDefaultProfile,
            title: localize2("workbench.action.terminal.selectDefaultProfile", "Select Default Profile")
          },
          group: "3_configure"
        }
      },
      {
        id: MenuId.TerminalNewDropdownContext,
        item: {
          command: {
            id: TerminalCommandId.ConfigureTerminalSettings,
            title: localize("workbench.action.terminal.openSettings", "Configure Terminal Settings")
          },
          group: "3_configure"
        }
      },
      {
        id: MenuId.TerminalNewDropdownContext,
        item: {
          command: {
            id: "workbench.action.tasks.runTask",
            title: localize("workbench.action.tasks.runTask", "Run Task...")
          },
          when: TaskExecutionSupportedContext,
          group: "4_tasks",
          order: 1
        }
      },
      {
        id: MenuId.TerminalNewDropdownContext,
        item: {
          command: {
            id: "workbench.action.tasks.configureTaskRunner",
            title: localize("workbench.action.tasks.configureTaskRunner", "Configure Tasks...")
          },
          when: TaskExecutionSupportedContext,
          group: "4_tasks",
          order: 2
        }
      }
    ]
  );
  MenuRegistry.appendMenuItems(
    [
      {
        id: MenuId.ViewTitle,
        item: {
          command: {
            id: TerminalCommandId.SwitchTerminal,
            title: localize2("workbench.action.terminal.switchTerminal", "Switch Terminal")
          },
          group: "navigation",
          order: 0,
          when: ContextKeyExpr.and(
            ContextKeyExpr.equals("view", TERMINAL_VIEW_ID),
            ContextKeyExpr.not(`config.${TerminalSettingId.TabsEnabled}`)
          )
        }
      },
      {
        // This is used to show instead of tabs when there is only a single terminal
        id: MenuId.ViewTitle,
        item: {
          command: {
            id: TerminalCommandId.Focus,
            title: terminalStrings.focus
          },
          alt: {
            id: TerminalCommandId.Split,
            title: terminalStrings.split.value,
            icon: Codicon.splitHorizontal
          },
          group: "navigation",
          order: 0,
          when: ContextKeyExpr.and(
            ContextKeyExpr.equals("view", TERMINAL_VIEW_ID),
            ContextKeyExpr.has(`config.${TerminalSettingId.TabsEnabled}`),
            ContextKeyExpr.or(
              ContextKeyExpr.and(
                ContextKeyExpr.equals(`config.${TerminalSettingId.TabsShowActiveTerminal}`, "singleTerminal"),
                ContextKeyExpr.equals(TerminalContextKeyStrings.GroupCount, 1)
              ),
              ContextKeyExpr.and(
                ContextKeyExpr.equals(`config.${TerminalSettingId.TabsShowActiveTerminal}`, "singleTerminalOrNarrow"),
                ContextKeyExpr.or(
                  ContextKeyExpr.equals(TerminalContextKeyStrings.GroupCount, 1),
                  ContextKeyExpr.has(TerminalContextKeyStrings.TabsNarrow)
                )
              ),
              ContextKeyExpr.and(
                ContextKeyExpr.equals(`config.${TerminalSettingId.TabsShowActiveTerminal}`, "singleGroup"),
                ContextKeyExpr.equals(TerminalContextKeyStrings.GroupCount, 1)
              ),
              ContextKeyExpr.equals(`config.${TerminalSettingId.TabsShowActiveTerminal}`, "always")
            )
          )
        }
      },
      {
        id: MenuId.ViewTitle,
        item: {
          command: {
            id: TerminalCommandId.Split,
            title: terminalStrings.split,
            icon: Codicon.splitHorizontal
          },
          group: "navigation",
          order: 2,
          when: TerminalContextKeys.shouldShowViewInlineActions
        }
      },
      {
        id: MenuId.ViewTitle,
        item: {
          command: {
            id: TerminalCommandId.Kill,
            title: terminalStrings.kill,
            icon: Codicon.trash
          },
          group: "navigation",
          order: 3,
          when: TerminalContextKeys.shouldShowViewInlineActions
        }
      },
      {
        id: MenuId.ViewTitle,
        item: {
          command: {
            id: TerminalCommandId.New,
            title: terminalStrings.new,
            icon: Codicon.plus
          },
          alt: {
            id: TerminalCommandId.Split,
            title: terminalStrings.split.value,
            icon: Codicon.splitHorizontal
          },
          group: "navigation",
          order: 0,
          when: ContextKeyExpr.and(
            ContextKeyExpr.equals("view", TERMINAL_VIEW_ID),
            ContextKeyExpr.or(TerminalContextKeys.webExtensionContributedProfile, TerminalContextKeys.processSupported)
          )
        }
      },
      {
        id: MenuId.ViewTitle,
        item: {
          command: {
            id: TerminalCommandId.Clear,
            title: localize("workbench.action.terminal.clearLong", "Clear Terminal"),
            icon: Codicon.clearAll
          },
          group: "navigation",
          order: 4,
          when: ContextKeyExpr.equals("view", TERMINAL_VIEW_ID),
          isHiddenByDefault: true
        }
      },
      {
        id: MenuId.ViewTitle,
        item: {
          command: {
            id: TerminalCommandId.RunActiveFile,
            title: localize("workbench.action.terminal.runActiveFile", "Run Active File"),
            icon: Codicon.run
          },
          group: "navigation",
          order: 5,
          when: ContextKeyExpr.equals("view", TERMINAL_VIEW_ID),
          isHiddenByDefault: true
        }
      },
      {
        id: MenuId.ViewTitle,
        item: {
          command: {
            id: TerminalCommandId.RunSelectedText,
            title: localize("workbench.action.terminal.runSelectedText", "Run Selected Text"),
            icon: Codicon.selection
          },
          group: "navigation",
          order: 6,
          when: ContextKeyExpr.equals("view", TERMINAL_VIEW_ID),
          isHiddenByDefault: true
        }
      }
    ]
  );
  MenuRegistry.appendMenuItems(
    [
      {
        id: MenuId.TerminalTabContext,
        item: {
          command: {
            id: TerminalCommandId.SplitActiveTab,
            title: terminalStrings.split.value
          },
          group: "1_create" /* Create */,
          order: 1
        }
      },
      {
        id: MenuId.TerminalTabContext,
        item: {
          command: {
            id: TerminalCommandId.MoveToEditor,
            title: terminalStrings.moveToEditor.value
          },
          group: "1_create" /* Create */,
          order: 2
        }
      },
      {
        id: MenuId.TerminalTabContext,
        item: {
          command: {
            id: TerminalCommandId.MoveIntoNewWindow,
            title: terminalStrings.moveIntoNewWindow.value
          },
          group: "1_create" /* Create */,
          order: 2
        }
      },
      {
        id: MenuId.TerminalTabContext,
        item: {
          command: {
            id: TerminalCommandId.RenameActiveTab,
            title: localize("workbench.action.terminal.renameInstance", "Rename...")
          },
          group: "3_edit" /* Edit */
        }
      },
      {
        id: MenuId.TerminalTabContext,
        item: {
          command: {
            id: TerminalCommandId.ChangeIconActiveTab,
            title: localize("workbench.action.terminal.changeIcon", "Change Icon...")
          },
          group: "3_edit" /* Edit */
        }
      },
      {
        id: MenuId.TerminalTabContext,
        item: {
          command: {
            id: TerminalCommandId.ChangeColorActiveTab,
            title: localize("workbench.action.terminal.changeColor", "Change Color...")
          },
          group: "3_edit" /* Edit */
        }
      },
      {
        id: MenuId.TerminalTabContext,
        item: {
          command: {
            id: TerminalCommandId.SizeToContentWidth,
            title: terminalStrings.toggleSizeToContentWidth
          },
          group: "3_edit" /* Edit */
        }
      },
      {
        id: MenuId.TerminalTabContext,
        item: {
          command: {
            id: TerminalCommandId.JoinActiveTab,
            title: localize("workbench.action.terminal.joinInstance", "Join Terminals")
          },
          when: TerminalContextKeys.tabsSingularSelection.toNegated(),
          group: "9_config" /* Config */
        }
      },
      {
        id: MenuId.TerminalTabContext,
        item: {
          command: {
            id: TerminalCommandId.Unsplit,
            title: terminalStrings.unsplit.value
          },
          when: ContextKeyExpr.and(TerminalContextKeys.tabsSingularSelection, TerminalContextKeys.splitTerminal),
          group: "9_config" /* Config */
        }
      },
      {
        id: MenuId.TerminalTabContext,
        item: {
          command: {
            id: TerminalCommandId.KillActiveTab,
            title: terminalStrings.kill.value
          },
          group: "7_kill" /* Kill */
        }
      }
    ]
  );
  MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
    command: {
      id: TerminalCommandId.MoveToTerminalPanel,
      title: terminalStrings.moveToTerminalPanel
    },
    when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
    group: "2_files"
  });
  MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
    command: {
      id: TerminalCommandId.Rename,
      title: terminalStrings.rename
    },
    when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
    group: "2_files"
  });
  MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
    command: {
      id: TerminalCommandId.ChangeColor,
      title: terminalStrings.changeColor
    },
    when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
    group: "2_files"
  });
  MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
    command: {
      id: TerminalCommandId.ChangeIcon,
      title: terminalStrings.changeIcon
    },
    when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
    group: "2_files"
  });
  MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
    command: {
      id: TerminalCommandId.SizeToContentWidth,
      title: terminalStrings.toggleSizeToContentWidth
    },
    when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
    group: "2_files"
  });
  MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
    command: {
      id: TerminalCommandId.CreateTerminalEditorSameGroup,
      title: terminalStrings.new,
      icon: Codicon.plus
    },
    alt: {
      id: TerminalCommandId.Split,
      title: terminalStrings.split.value,
      icon: Codicon.splitHorizontal
    },
    group: "navigation",
    order: 0,
    when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal)
  });
}
function getTerminalActionBarArgs(location, profiles, defaultProfileName, contributedProfiles, terminalService, dropdownMenu, disposableStore) {
  let dropdownActions = [];
  let submenuActions = [];
  profiles = profiles.filter((e) => !e.isAutoDetected);
  const splitLocation = location === TerminalLocation.Editor || typeof location === "object" && "viewColumn" in location && location.viewColumn === ACTIVE_GROUP ? { viewColumn: SIDE_GROUP } : { splitActiveTerminal: true };
  for (const p of profiles) {
    const isDefault = p.profileName === defaultProfileName;
    const options = { config: p, location };
    const splitOptions = { config: p, location: splitLocation };
    const sanitizedProfileName = p.profileName.replace(/[\n\r\t]/g, "");
    dropdownActions.push(disposableStore.add(new Action(TerminalCommandId.NewWithProfile, isDefault ? localize("defaultTerminalProfile", "{0} (Default)", sanitizedProfileName) : sanitizedProfileName, void 0, true, async () => {
      const instance = await terminalService.createTerminal(options);
      terminalService.setActiveInstance(instance);
      await terminalService.focusActiveInstance();
    })));
    submenuActions.push(disposableStore.add(new Action(TerminalCommandId.Split, isDefault ? localize("defaultTerminalProfile", "{0} (Default)", sanitizedProfileName) : sanitizedProfileName, void 0, true, async () => {
      const instance = await terminalService.createTerminal(splitOptions);
      terminalService.setActiveInstance(instance);
      await terminalService.focusActiveInstance();
    })));
  }
  for (const contributed of contributedProfiles) {
    const isDefault = contributed.title === defaultProfileName;
    const title = isDefault ? localize("defaultTerminalProfile", "{0} (Default)", contributed.title.replace(/[\n\r\t]/g, "")) : contributed.title.replace(/[\n\r\t]/g, "");
    dropdownActions.push(disposableStore.add(new Action("contributed", title, void 0, true, () => terminalService.createTerminal({
      config: {
        extensionIdentifier: contributed.extensionIdentifier,
        id: contributed.id,
        title
      },
      location
    }))));
    submenuActions.push(disposableStore.add(new Action("contributed-split", title, void 0, true, () => terminalService.createTerminal({
      config: {
        extensionIdentifier: contributed.extensionIdentifier,
        id: contributed.id,
        title
      },
      location: splitLocation
    }))));
  }
  const defaultProfileAction = dropdownActions.find((d) => d.label.endsWith("(Default)"));
  if (defaultProfileAction) {
    dropdownActions = dropdownActions.filter((d) => d !== defaultProfileAction).sort((a, b) => a.label.localeCompare(b.label));
    dropdownActions.unshift(defaultProfileAction);
  }
  if (dropdownActions.length > 0) {
    dropdownActions.push(new SubmenuAction("split.profile", localize("splitTerminal", "Split Terminal"), submenuActions));
    dropdownActions.push(new Separator());
  }
  const actions = dropdownMenu.getActions();
  dropdownActions.push(...Separator.join(...actions.map((a) => a[1])));
  const defaultSubmenuProfileAction = submenuActions.find((d) => d.label.endsWith("(Default)"));
  if (defaultSubmenuProfileAction) {
    submenuActions = submenuActions.filter((d) => d !== defaultSubmenuProfileAction).sort((a, b) => a.label.localeCompare(b.label));
    submenuActions.unshift(defaultSubmenuProfileAction);
  }
  const dropdownAction = disposableStore.add(new Action("refresh profiles", localize("launchProfile", "Launch Profile..."), "codicon-chevron-down", true));
  return { dropdownAction, dropdownMenuActions: dropdownActions, className: `terminal-tab-actions-${terminalService.resolveLocation(location)}` };
}
export {
  TerminalMenuBarGroup,
  getTerminalActionBarArgs,
  setupTerminalMenus
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsTWVudXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBBY3Rpb24sIElBY3Rpb24sIFNlcGFyYXRvciwgU3VibWVudUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSU1lbnUsIE1lbnVJZCwgTWVudVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblRlcm1pbmFsUHJvZmlsZSwgSVRlcm1pbmFsUHJvZmlsZSwgVGVybWluYWxMb2NhdGlvbiwgVGVybWluYWxTZXR0aW5nSWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IFRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0IH0gZnJvbSAnLi4vLi4vdGFza3MvY29tbW9uL3Rhc2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDcmVhdGVUZXJtaW5hbE9wdGlvbnMsIElUZXJtaW5hbExvY2F0aW9uT3B0aW9ucywgSVRlcm1pbmFsU2VydmljZSB9IGZyb20gJy4vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb21tYW5kSWQsIFRFUk1JTkFMX1ZJRVdfSUQgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb250ZXh0S2V5cywgVGVybWluYWxDb250ZXh0S2V5U3RyaW5ncyB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbENvbnRleHRLZXkuanMnO1xuaW1wb3J0IHsgdGVybWluYWxTdHJpbmdzIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsU3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBBQ1RJVkVfR1JPVVAsIFNJREVfR1JPVVAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxuY29uc3QgZW51bSBDb250ZXh0TWVudUdyb3VwIHtcblx0Q3JlYXRlID0gJzFfY3JlYXRlJyxcblx0RWRpdCA9ICczX2VkaXQnLFxuXHRDbGVhciA9ICc1X2NsZWFyJyxcblx0S2lsbCA9ICc3X2tpbGwnLFxuXHRDb25maWcgPSAnOV9jb25maWcnXG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFRlcm1pbmFsTWVudUJhckdyb3VwIHtcblx0Q3JlYXRlID0gJzFfY3JlYXRlJyxcblx0UnVuID0gJzNfcnVuJyxcblx0TWFuYWdlID0gJzVfbWFuYWdlJyxcblx0Q29uZmlndXJlID0gJzdfY29uZmlndXJlJ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBUZXJtaW5hbE1lbnVzKCk6IHZvaWQge1xuXHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW1zKFxuXHRcdFtcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyVGVybWluYWxNZW51LFxuXHRcdFx0XHRpdGVtOiB7XG5cdFx0XHRcdFx0Z3JvdXA6IFRlcm1pbmFsTWVudUJhckdyb3VwLkNyZWF0ZSxcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuTmV3LFxuXHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlOZXdUZXJtaW5hbCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk5ldyBUZXJtaW5hbFwiKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyVGVybWluYWxNZW51LFxuXHRcdFx0XHRpdGVtOiB7XG5cdFx0XHRcdFx0Z3JvdXA6IFRlcm1pbmFsTWVudUJhckdyb3VwLkNyZWF0ZSxcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU3BsaXQsXG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVNwbGl0VGVybWluYWwnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZTcGxpdCBUZXJtaW5hbFwiKSxcblx0XHRcdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuaGFzKFRlcm1pbmFsQ29udGV4dEtleVN0cmluZ3MuSXNPcGVuKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHRcdFx0d2hlbjogVGVybWluYWxDb250ZXh0S2V5cy5wcm9jZXNzU3VwcG9ydGVkXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBNZW51SWQuTWVudWJhclRlcm1pbmFsTWVudSxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGdyb3VwOiBUZXJtaW5hbE1lbnVCYXJHcm91cC5SdW4sXG5cdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlJ1bkFjdGl2ZUZpbGUsXG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVJ1bkFjdGl2ZUZpbGUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiUnVuICYmQWN0aXZlIEZpbGVcIilcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdG9yZGVyOiAzLFxuXHRcdFx0XHRcdHdoZW46IFRlcm1pbmFsQ29udGV4dEtleXMucHJvY2Vzc1N1cHBvcnRlZFxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJUZXJtaW5hbE1lbnUsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRncm91cDogVGVybWluYWxNZW51QmFyR3JvdXAuUnVuLFxuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5SdW5TZWxlY3RlZFRleHQsXG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVJ1blNlbGVjdGVkVGV4dCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJSdW4gJiZTZWxlY3RlZCBUZXh0XCIpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRvcmRlcjogNCxcblx0XHRcdFx0XHR3aGVuOiBUZXJtaW5hbENvbnRleHRLZXlzLnByb2Nlc3NTdXBwb3J0ZWRcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdF1cblx0KTtcblxuXHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW1zKFxuXHRcdFtcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbEluc3RhbmNlQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGdyb3VwOiBDb250ZXh0TWVudUdyb3VwLkNyZWF0ZSxcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU3BsaXQsXG5cdFx0XHRcdFx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLnNwbGl0LnZhbHVlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsSW5zdGFuY2VDb250ZXh0LFxuXHRcdFx0XHRpdGVtOiB7XG5cdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLk5ldyxcblx0XHRcdFx0XHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3MubmV3XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5DcmVhdGVcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbEluc3RhbmNlQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5LaWxsVmlld09yRWRpdG9yLFxuXHRcdFx0XHRcdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5raWxsLnZhbHVlLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z3JvdXA6IENvbnRleHRNZW51R3JvdXAuS2lsbFxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsSW5zdGFuY2VDb250ZXh0LFxuXHRcdFx0XHRpdGVtOiB7XG5cdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLkNvcHlTZWxlY3Rpb24sXG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY29weVNlbGVjdGlvbi5zaG9ydCcsIFwiQ29weVwiKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z3JvdXA6IENvbnRleHRNZW51R3JvdXAuRWRpdCxcblx0XHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsSW5zdGFuY2VDb250ZXh0LFxuXHRcdFx0XHRpdGVtOiB7XG5cdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLkNvcHlTZWxlY3Rpb25Bc0h0bWwsXG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY29weVNlbGVjdGlvbkFzSHRtbCcsIFwiQ29weSBhcyBIVE1MXCIpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5FZGl0LFxuXHRcdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBNZW51SWQuVGVybWluYWxJbnN0YW5jZUNvbnRleHQsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuUGFzdGUsXG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucGFzdGUuc2hvcnQnLCBcIlBhc3RlXCIpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5FZGl0LFxuXHRcdFx0XHRcdG9yZGVyOiAzXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBNZW51SWQuVGVybWluYWxJbnN0YW5jZUNvbnRleHQsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuQ2xlYXIsXG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY2xlYXInLCBcIkNsZWFyXCIpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5DbGVhcixcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbEluc3RhbmNlQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5TaXplVG9Db250ZW50V2lkdGgsXG5cdFx0XHRcdFx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLnRvZ2dsZVNpemVUb0NvbnRlbnRXaWR0aFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z3JvdXA6IENvbnRleHRNZW51R3JvdXAuQ29uZmlnXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbEluc3RhbmNlQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5TZWxlY3RBbGwsXG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2VsZWN0QWxsJywgXCJTZWxlY3QgQWxsXCIpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z3JvdXA6IENvbnRleHRNZW51R3JvdXAuRWRpdCxcblx0XHRcdFx0XHRvcmRlcjogM1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdF1cblx0KTtcblxuXHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW1zKFxuXHRcdFtcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbEVkaXRvckluc3RhbmNlQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGdyb3VwOiBDb250ZXh0TWVudUdyb3VwLkNyZWF0ZSxcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU3BsaXQsXG5cdFx0XHRcdFx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLnNwbGl0LnZhbHVlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsRWRpdG9ySW5zdGFuY2VDb250ZXh0LFxuXHRcdFx0XHRpdGVtOiB7XG5cdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLk5ldyxcblx0XHRcdFx0XHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3MubmV3XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5DcmVhdGVcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbEVkaXRvckluc3RhbmNlQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5LaWxsRWRpdG9yLFxuXHRcdFx0XHRcdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5raWxsLnZhbHVlXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5LaWxsXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBNZW51SWQuVGVybWluYWxFZGl0b3JJbnN0YW5jZUNvbnRleHQsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuQ29weVNlbGVjdGlvbixcblx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jb3B5U2VsZWN0aW9uLnNob3J0JywgXCJDb3B5XCIpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5FZGl0LFxuXHRcdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBNZW51SWQuVGVybWluYWxFZGl0b3JJbnN0YW5jZUNvbnRleHQsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuQ29weVNlbGVjdGlvbkFzSHRtbCxcblx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jb3B5U2VsZWN0aW9uQXNIdG1sJywgXCJDb3B5IGFzIEhUTUxcIilcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdyb3VwOiBDb250ZXh0TWVudUdyb3VwLkVkaXQsXG5cdFx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbEVkaXRvckluc3RhbmNlQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5QYXN0ZSxcblx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5wYXN0ZS5zaG9ydCcsIFwiUGFzdGVcIilcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdyb3VwOiBDb250ZXh0TWVudUdyb3VwLkVkaXQsXG5cdFx0XHRcdFx0b3JkZXI6IDNcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbEVkaXRvckluc3RhbmNlQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5DbGVhcixcblx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jbGVhcicsIFwiQ2xlYXJcIilcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdyb3VwOiBDb250ZXh0TWVudUdyb3VwLkNsZWFyLFxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsRWRpdG9ySW5zdGFuY2VDb250ZXh0LFxuXHRcdFx0XHRpdGVtOiB7XG5cdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlNlbGVjdEFsbCxcblx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zZWxlY3RBbGwnLCBcIlNlbGVjdCBBbGxcIiksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5FZGl0LFxuXHRcdFx0XHRcdG9yZGVyOiAzXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBNZW51SWQuVGVybWluYWxFZGl0b3JJbnN0YW5jZUNvbnRleHQsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU2l6ZVRvQ29udGVudFdpZHRoLFxuXHRcdFx0XHRcdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy50b2dnbGVTaXplVG9Db250ZW50V2lkdGhcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdyb3VwOiBDb250ZXh0TWVudUdyb3VwLkNvbmZpZ1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XVxuXHQpO1xuXG5cdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbXMoXG5cdFx0W1xuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsVGFiRW1wdHlBcmVhQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5OZXdXaXRoUHJvZmlsZSxcblx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5uZXdXaXRoUHJvZmlsZS5zaG9ydCcsIFwiTmV3IFRlcm1pbmFsIFdpdGggUHJvZmlsZS4uLlwiKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z3JvdXA6IENvbnRleHRNZW51R3JvdXAuQ3JlYXRlXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBNZW51SWQuVGVybWluYWxUYWJFbXB0eUFyZWFDb250ZXh0LFxuXHRcdFx0XHRpdGVtOiB7XG5cdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLk5ldyxcblx0XHRcdFx0XHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3MubmV3XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5DcmVhdGVcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdF1cblx0KTtcblxuXHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW1zKFxuXHRcdFtcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbE5ld0Ryb3Bkb3duQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5TZWxlY3REZWZhdWx0UHJvZmlsZSxcblx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2VsZWN0RGVmYXVsdFByb2ZpbGUnLCAnU2VsZWN0IERlZmF1bHQgUHJvZmlsZScpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z3JvdXA6ICczX2NvbmZpZ3VyZSdcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbE5ld0Ryb3Bkb3duQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5Db25maWd1cmVUZXJtaW5hbFNldHRpbmdzLFxuXHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLm9wZW5TZXR0aW5ncycsIFwiQ29uZmlndXJlIFRlcm1pbmFsIFNldHRpbmdzXCIpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogJzNfY29uZmlndXJlJ1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsTmV3RHJvcGRvd25Db250ZXh0LFxuXHRcdFx0XHRpdGVtOiB7XG5cdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnJ1blRhc2snLFxuXHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnJ1blRhc2snLCBcIlJ1biBUYXNrLi4uXCIpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR3aGVuOiBUYXNrRXhlY3V0aW9uU3VwcG9ydGVkQ29udGV4dCxcblx0XHRcdFx0XHRncm91cDogJzRfdGFza3MnLFxuXHRcdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsTmV3RHJvcGRvd25Db250ZXh0LFxuXHRcdFx0XHRpdGVtOiB7XG5cdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLmNvbmZpZ3VyZVRhc2tSdW5uZXInLFxuXHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLmNvbmZpZ3VyZVRhc2tSdW5uZXInLCBcIkNvbmZpZ3VyZSBUYXNrcy4uLlwiKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0d2hlbjogVGFza0V4ZWN1dGlvblN1cHBvcnRlZENvbnRleHQsXG5cdFx0XHRcdFx0Z3JvdXA6ICc0X3Rhc2tzJyxcblx0XHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdF1cblx0KTtcblxuXHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW1zKFxuXHRcdFtcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU3dpdGNoVGVybWluYWwsXG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnN3aXRjaFRlcm1pbmFsJywgJ1N3aXRjaCBUZXJtaW5hbCcpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAwLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIFRFUk1JTkFMX1ZJRVdfSUQpLFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIubm90KGBjb25maWcuJHtUZXJtaW5hbFNldHRpbmdJZC5UYWJzRW5hYmxlZH1gKVxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdC8vIFRoaXMgaXMgdXNlZCB0byBzaG93IGluc3RlYWQgb2YgdGFicyB3aGVuIHRoZXJlIGlzIG9ubHkgYSBzaW5nbGUgdGVybWluYWxcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuRm9jdXMsXG5cdFx0XHRcdFx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLmZvY3VzXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRhbHQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5TcGxpdCxcblx0XHRcdFx0XHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3Muc3BsaXQudmFsdWUsXG5cdFx0XHRcdFx0XHRpY29uOiBDb2RpY29uLnNwbGl0SG9yaXpvbnRhbFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogMCxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBURVJNSU5BTF9WSUVXX0lEKSxcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmhhcyhgY29uZmlnLiR7VGVybWluYWxTZXR0aW5nSWQuVGFic0VuYWJsZWR9YCksXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7VGVybWluYWxTZXR0aW5nSWQuVGFic1Nob3dBY3RpdmVUZXJtaW5hbH1gLCAnc2luZ2xlVGVybWluYWwnKSxcblx0XHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoVGVybWluYWxDb250ZXh0S2V5U3RyaW5ncy5Hcm91cENvdW50LCAxKVxuXHRcdFx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKGBjb25maWcuJHtUZXJtaW5hbFNldHRpbmdJZC5UYWJzU2hvd0FjdGl2ZVRlcm1pbmFsfWAsICdzaW5nbGVUZXJtaW5hbE9yTmFycm93JyksXG5cdFx0XHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIub3IoXG5cdFx0XHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoVGVybWluYWxDb250ZXh0S2V5U3RyaW5ncy5Hcm91cENvdW50LCAxKSxcblx0XHRcdFx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmhhcyhUZXJtaW5hbENvbnRleHRLZXlTdHJpbmdzLlRhYnNOYXJyb3cpXG5cdFx0XHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKGBjb25maWcuJHtUZXJtaW5hbFNldHRpbmdJZC5UYWJzU2hvd0FjdGl2ZVRlcm1pbmFsfWAsICdzaW5nbGVHcm91cCcpLFxuXHRcdFx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscyhUZXJtaW5hbENvbnRleHRLZXlTdHJpbmdzLkdyb3VwQ291bnQsIDEpXG5cdFx0XHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7VGVybWluYWxTZXR0aW5nSWQuVGFic1Nob3dBY3RpdmVUZXJtaW5hbH1gLCAnYWx3YXlzJylcblx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5TcGxpdCxcblx0XHRcdFx0XHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3Muc3BsaXQsXG5cdFx0XHRcdFx0XHRpY29uOiBDb2RpY29uLnNwbGl0SG9yaXpvbnRhbFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogMixcblx0XHRcdFx0XHR3aGVuOiBUZXJtaW5hbENvbnRleHRLZXlzLnNob3VsZFNob3dWaWV3SW5saW5lQWN0aW9uc1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5LaWxsLFxuXHRcdFx0XHRcdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5raWxsLFxuXHRcdFx0XHRcdFx0aWNvbjogQ29kaWNvbi50cmFzaFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogMyxcblx0XHRcdFx0XHR3aGVuOiBUZXJtaW5hbENvbnRleHRLZXlzLnNob3VsZFNob3dWaWV3SW5saW5lQWN0aW9uc1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5OZXcsXG5cdFx0XHRcdFx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLm5ldyxcblx0XHRcdFx0XHRcdGljb246IENvZGljb24ucGx1c1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0YWx0OiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU3BsaXQsXG5cdFx0XHRcdFx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLnNwbGl0LnZhbHVlLFxuXHRcdFx0XHRcdFx0aWNvbjogQ29kaWNvbi5zcGxpdEhvcml6b250YWxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDAsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgVEVSTUlOQUxfVklFV19JRCksXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5vcihUZXJtaW5hbENvbnRleHRLZXlzLndlYkV4dGVuc2lvbkNvbnRyaWJ1dGVkUHJvZmlsZSwgVGVybWluYWxDb250ZXh0S2V5cy5wcm9jZXNzU3VwcG9ydGVkKVxuXHRcdFx0XHRcdClcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuQ2xlYXIsXG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY2xlYXJMb25nJywgXCJDbGVhciBUZXJtaW5hbFwiKSxcblx0XHRcdFx0XHRcdGljb246IENvZGljb24uY2xlYXJBbGxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDQsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgVEVSTUlOQUxfVklFV19JRCksXG5cdFx0XHRcdFx0aXNIaWRkZW5CeURlZmF1bHQ6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuUnVuQWN0aXZlRmlsZSxcblx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5ydW5BY3RpdmVGaWxlJywgXCJSdW4gQWN0aXZlIEZpbGVcIiksXG5cdFx0XHRcdFx0XHRpY29uOiBDb2RpY29uLnJ1blxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogNSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBURVJNSU5BTF9WSUVXX0lEKSxcblx0XHRcdFx0XHRpc0hpZGRlbkJ5RGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5SdW5TZWxlY3RlZFRleHQsXG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucnVuU2VsZWN0ZWRUZXh0JywgXCJSdW4gU2VsZWN0ZWQgVGV4dFwiKSxcblx0XHRcdFx0XHRcdGljb246IENvZGljb24uc2VsZWN0aW9uXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiA2LFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIFRFUk1JTkFMX1ZJRVdfSUQpLFxuXHRcdFx0XHRcdGlzSGlkZGVuQnlEZWZhdWx0OiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XVxuXHQpO1xuXG5cdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbXMoXG5cdFx0W1xuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsVGFiQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5TcGxpdEFjdGl2ZVRhYixcblx0XHRcdFx0XHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3Muc3BsaXQudmFsdWUsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5DcmVhdGUsXG5cdFx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbFRhYkNvbnRleHQsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuTW92ZVRvRWRpdG9yLFxuXHRcdFx0XHRcdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5tb3ZlVG9FZGl0b3IudmFsdWVcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdyb3VwOiBDb250ZXh0TWVudUdyb3VwLkNyZWF0ZSxcblx0XHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsVGFiQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5Nb3ZlSW50b05ld1dpbmRvdyxcblx0XHRcdFx0XHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3MubW92ZUludG9OZXdXaW5kb3cudmFsdWVcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdyb3VwOiBDb250ZXh0TWVudUdyb3VwLkNyZWF0ZSxcblx0XHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsVGFiQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5SZW5hbWVBY3RpdmVUYWIsXG5cdFx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucmVuYW1lSW5zdGFuY2UnLCBcIlJlbmFtZS4uLlwiKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z3JvdXA6IENvbnRleHRNZW51R3JvdXAuRWRpdFxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsVGFiQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5DaGFuZ2VJY29uQWN0aXZlVGFiLFxuXHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmNoYW5nZUljb24nLCBcIkNoYW5nZSBJY29uLi4uXCIpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5FZGl0XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBNZW51SWQuVGVybWluYWxUYWJDb250ZXh0LFxuXHRcdFx0XHRpdGVtOiB7XG5cdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLkNoYW5nZUNvbG9yQWN0aXZlVGFiLFxuXHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmNoYW5nZUNvbG9yJywgXCJDaGFuZ2UgQ29sb3IuLi5cIilcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdyb3VwOiBDb250ZXh0TWVudUdyb3VwLkVkaXRcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbFRhYkNvbnRleHQsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU2l6ZVRvQ29udGVudFdpZHRoLFxuXHRcdFx0XHRcdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy50b2dnbGVTaXplVG9Db250ZW50V2lkdGhcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdyb3VwOiBDb250ZXh0TWVudUdyb3VwLkVkaXRcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbFRhYkNvbnRleHQsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuSm9pbkFjdGl2ZVRhYixcblx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5qb2luSW5zdGFuY2UnLCBcIkpvaW4gVGVybWluYWxzXCIpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR3aGVuOiBUZXJtaW5hbENvbnRleHRLZXlzLnRhYnNTaW5ndWxhclNlbGVjdGlvbi50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5Db25maWdcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbFRhYkNvbnRleHQsXG5cdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuVW5zcGxpdCxcblx0XHRcdFx0XHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3MudW5zcGxpdC52YWx1ZVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFRlcm1pbmFsQ29udGV4dEtleXMudGFic1Npbmd1bGFyU2VsZWN0aW9uLCBUZXJtaW5hbENvbnRleHRLZXlzLnNwbGl0VGVybWluYWwpLFxuXHRcdFx0XHRcdGdyb3VwOiBDb250ZXh0TWVudUdyb3VwLkNvbmZpZ1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLlRlcm1pbmFsVGFiQ29udGV4dCxcblx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdGlkOiBUZXJtaW5hbENvbW1hbmRJZC5LaWxsQWN0aXZlVGFiLFxuXHRcdFx0XHRcdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5raWxsLnZhbHVlXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRncm91cDogQ29udGV4dE1lbnVHcm91cC5LaWxsLFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XVxuXHQpO1xuXG5cdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LCB7XG5cdFx0Y29tbWFuZDoge1xuXHRcdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLk1vdmVUb1Rlcm1pbmFsUGFuZWwsXG5cdFx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLm1vdmVUb1Rlcm1pbmFsUGFuZWxcblx0XHR9LFxuXHRcdHdoZW46IFJlc291cmNlQ29udGV4dEtleS5TY2hlbWUuaXNFcXVhbFRvKFNjaGVtYXMudnNjb2RlVGVybWluYWwpLFxuXHRcdGdyb3VwOiAnMl9maWxlcydcblx0fSk7XG5cblx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUaXRsZUNvbnRleHQsIHtcblx0XHRjb21tYW5kOiB7XG5cdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuUmVuYW1lLFxuXHRcdFx0dGl0bGU6IHRlcm1pbmFsU3RyaW5ncy5yZW5hbWVcblx0XHR9LFxuXHRcdHdoZW46IFJlc291cmNlQ29udGV4dEtleS5TY2hlbWUuaXNFcXVhbFRvKFNjaGVtYXMudnNjb2RlVGVybWluYWwpLFxuXHRcdGdyb3VwOiAnMl9maWxlcydcblx0fSk7XG5cblx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUaXRsZUNvbnRleHQsIHtcblx0XHRjb21tYW5kOiB7XG5cdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuQ2hhbmdlQ29sb3IsXG5cdFx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLmNoYW5nZUNvbG9yXG5cdFx0fSxcblx0XHR3aGVuOiBSZXNvdXJjZUNvbnRleHRLZXkuU2NoZW1lLmlzRXF1YWxUbyhTY2hlbWFzLnZzY29kZVRlcm1pbmFsKSxcblx0XHRncm91cDogJzJfZmlsZXMnXG5cdH0pO1xuXG5cdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LCB7XG5cdFx0Y29tbWFuZDoge1xuXHRcdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLkNoYW5nZUljb24sXG5cdFx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLmNoYW5nZUljb25cblx0XHR9LFxuXHRcdHdoZW46IFJlc291cmNlQ29udGV4dEtleS5TY2hlbWUuaXNFcXVhbFRvKFNjaGVtYXMudnNjb2RlVGVybWluYWwpLFxuXHRcdGdyb3VwOiAnMl9maWxlcydcblx0fSk7XG5cdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LCB7XG5cdFx0Y29tbWFuZDoge1xuXHRcdFx0aWQ6IFRlcm1pbmFsQ29tbWFuZElkLlNpemVUb0NvbnRlbnRXaWR0aCxcblx0XHRcdHRpdGxlOiB0ZXJtaW5hbFN0cmluZ3MudG9nZ2xlU2l6ZVRvQ29udGVudFdpZHRoXG5cdFx0fSxcblx0XHR3aGVuOiBSZXNvdXJjZUNvbnRleHRLZXkuU2NoZW1lLmlzRXF1YWxUbyhTY2hlbWFzLnZzY29kZVRlcm1pbmFsKSxcblx0XHRncm91cDogJzJfZmlsZXMnXG5cdH0pO1xuXG5cdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGUsIHtcblx0XHRjb21tYW5kOiB7XG5cdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuQ3JlYXRlVGVybWluYWxFZGl0b3JTYW1lR3JvdXAsXG5cdFx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLm5ldyxcblx0XHRcdGljb246IENvZGljb24ucGx1c1xuXHRcdH0sXG5cdFx0YWx0OiB7XG5cdFx0XHRpZDogVGVybWluYWxDb21tYW5kSWQuU3BsaXQsXG5cdFx0XHR0aXRsZTogdGVybWluYWxTdHJpbmdzLnNwbGl0LnZhbHVlLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5zcGxpdEhvcml6b250YWxcblx0XHR9LFxuXHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0b3JkZXI6IDAsXG5cdFx0d2hlbjogUmVzb3VyY2VDb250ZXh0S2V5LlNjaGVtZS5pc0VxdWFsVG8oU2NoZW1hcy52c2NvZGVUZXJtaW5hbClcblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRUZXJtaW5hbEFjdGlvbkJhckFyZ3MobG9jYXRpb246IElUZXJtaW5hbExvY2F0aW9uT3B0aW9ucywgcHJvZmlsZXM6IElUZXJtaW5hbFByb2ZpbGVbXSwgZGVmYXVsdFByb2ZpbGVOYW1lOiBzdHJpbmcsIGNvbnRyaWJ1dGVkUHJvZmlsZXM6IHJlYWRvbmx5IElFeHRlbnNpb25UZXJtaW5hbFByb2ZpbGVbXSwgdGVybWluYWxTZXJ2aWNlOiBJVGVybWluYWxTZXJ2aWNlLCBkcm9wZG93bk1lbnU6IElNZW51LCBkaXNwb3NhYmxlU3RvcmU6IERpc3Bvc2FibGVTdG9yZSk6IHtcblx0ZHJvcGRvd25BY3Rpb246IElBY3Rpb247XG5cdGRyb3Bkb3duTWVudUFjdGlvbnM6IElBY3Rpb25bXTtcblx0Y2xhc3NOYW1lOiBzdHJpbmc7XG5cdGRyb3Bkb3duSWNvbj86IHN0cmluZztcbn0ge1xuXHRsZXQgZHJvcGRvd25BY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0bGV0IHN1Ym1lbnVBY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0cHJvZmlsZXMgPSBwcm9maWxlcy5maWx0ZXIoZSA9PiAhZS5pc0F1dG9EZXRlY3RlZCk7XG5cdGNvbnN0IHNwbGl0TG9jYXRpb24gPSAobG9jYXRpb24gPT09IFRlcm1pbmFsTG9jYXRpb24uRWRpdG9yIHx8ICh0eXBlb2YgbG9jYXRpb24gPT09ICdvYmplY3QnICYmICd2aWV3Q29sdW1uJyBpbiBsb2NhdGlvbiAmJiBsb2NhdGlvbi52aWV3Q29sdW1uID09PSBBQ1RJVkVfR1JPVVApKSA/IHsgdmlld0NvbHVtbjogU0lERV9HUk9VUCB9IDogeyBzcGxpdEFjdGl2ZVRlcm1pbmFsOiB0cnVlIH07XG5cdGZvciAoY29uc3QgcCBvZiBwcm9maWxlcykge1xuXHRcdGNvbnN0IGlzRGVmYXVsdCA9IHAucHJvZmlsZU5hbWUgPT09IGRlZmF1bHRQcm9maWxlTmFtZTtcblx0XHRjb25zdCBvcHRpb25zOiBJQ3JlYXRlVGVybWluYWxPcHRpb25zID0geyBjb25maWc6IHAsIGxvY2F0aW9uIH07XG5cdFx0Y29uc3Qgc3BsaXRPcHRpb25zOiBJQ3JlYXRlVGVybWluYWxPcHRpb25zID0geyBjb25maWc6IHAsIGxvY2F0aW9uOiBzcGxpdExvY2F0aW9uIH07XG5cdFx0Y29uc3Qgc2FuaXRpemVkUHJvZmlsZU5hbWUgPSBwLnByb2ZpbGVOYW1lLnJlcGxhY2UoL1tcXG5cXHJcXHRdL2csICcnKTtcblx0XHRkcm9wZG93bkFjdGlvbnMucHVzaChkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBBY3Rpb24oVGVybWluYWxDb21tYW5kSWQuTmV3V2l0aFByb2ZpbGUsIGlzRGVmYXVsdCA/IGxvY2FsaXplKCdkZWZhdWx0VGVybWluYWxQcm9maWxlJywgXCJ7MH0gKERlZmF1bHQpXCIsIHNhbml0aXplZFByb2ZpbGVOYW1lKSA6IHNhbml0aXplZFByb2ZpbGVOYW1lLCB1bmRlZmluZWQsIHRydWUsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGluc3RhbmNlID0gYXdhaXQgdGVybWluYWxTZXJ2aWNlLmNyZWF0ZVRlcm1pbmFsKG9wdGlvbnMpO1xuXHRcdFx0dGVybWluYWxTZXJ2aWNlLnNldEFjdGl2ZUluc3RhbmNlKGluc3RhbmNlKTtcblx0XHRcdGF3YWl0IHRlcm1pbmFsU2VydmljZS5mb2N1c0FjdGl2ZUluc3RhbmNlKCk7XG5cdFx0fSkpKTtcblx0XHRzdWJtZW51QWN0aW9ucy5wdXNoKGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IEFjdGlvbihUZXJtaW5hbENvbW1hbmRJZC5TcGxpdCwgaXNEZWZhdWx0ID8gbG9jYWxpemUoJ2RlZmF1bHRUZXJtaW5hbFByb2ZpbGUnLCBcInswfSAoRGVmYXVsdClcIiwgc2FuaXRpemVkUHJvZmlsZU5hbWUpIDogc2FuaXRpemVkUHJvZmlsZU5hbWUsIHVuZGVmaW5lZCwgdHJ1ZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaW5zdGFuY2UgPSBhd2FpdCB0ZXJtaW5hbFNlcnZpY2UuY3JlYXRlVGVybWluYWwoc3BsaXRPcHRpb25zKTtcblx0XHRcdHRlcm1pbmFsU2VydmljZS5zZXRBY3RpdmVJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0XHRhd2FpdCB0ZXJtaW5hbFNlcnZpY2UuZm9jdXNBY3RpdmVJbnN0YW5jZSgpO1xuXHRcdH0pKSk7XG5cdH1cblxuXHRmb3IgKGNvbnN0IGNvbnRyaWJ1dGVkIG9mIGNvbnRyaWJ1dGVkUHJvZmlsZXMpIHtcblx0XHRjb25zdCBpc0RlZmF1bHQgPSBjb250cmlidXRlZC50aXRsZSA9PT0gZGVmYXVsdFByb2ZpbGVOYW1lO1xuXHRcdGNvbnN0IHRpdGxlID0gaXNEZWZhdWx0ID8gbG9jYWxpemUoJ2RlZmF1bHRUZXJtaW5hbFByb2ZpbGUnLCBcInswfSAoRGVmYXVsdClcIiwgY29udHJpYnV0ZWQudGl0bGUucmVwbGFjZSgvW1xcblxcclxcdF0vZywgJycpKSA6IGNvbnRyaWJ1dGVkLnRpdGxlLnJlcGxhY2UoL1tcXG5cXHJcXHRdL2csICcnKTtcblx0XHRkcm9wZG93bkFjdGlvbnMucHVzaChkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBBY3Rpb24oJ2NvbnRyaWJ1dGVkJywgdGl0bGUsIHVuZGVmaW5lZCwgdHJ1ZSwgKCkgPT4gdGVybWluYWxTZXJ2aWNlLmNyZWF0ZVRlcm1pbmFsKHtcblx0XHRcdGNvbmZpZzoge1xuXHRcdFx0XHRleHRlbnNpb25JZGVudGlmaWVyOiBjb250cmlidXRlZC5leHRlbnNpb25JZGVudGlmaWVyLFxuXHRcdFx0XHRpZDogY29udHJpYnV0ZWQuaWQsXG5cdFx0XHRcdHRpdGxlXG5cdFx0XHR9LFxuXHRcdFx0bG9jYXRpb25cblx0XHR9KSkpKTtcblx0XHRzdWJtZW51QWN0aW9ucy5wdXNoKGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IEFjdGlvbignY29udHJpYnV0ZWQtc3BsaXQnLCB0aXRsZSwgdW5kZWZpbmVkLCB0cnVlLCAoKSA9PiB0ZXJtaW5hbFNlcnZpY2UuY3JlYXRlVGVybWluYWwoe1xuXHRcdFx0Y29uZmlnOiB7XG5cdFx0XHRcdGV4dGVuc2lvbklkZW50aWZpZXI6IGNvbnRyaWJ1dGVkLmV4dGVuc2lvbklkZW50aWZpZXIsXG5cdFx0XHRcdGlkOiBjb250cmlidXRlZC5pZCxcblx0XHRcdFx0dGl0bGVcblx0XHRcdH0sXG5cdFx0XHRsb2NhdGlvbjogc3BsaXRMb2NhdGlvblxuXHRcdH0pKSkpO1xuXHR9XG5cblx0Y29uc3QgZGVmYXVsdFByb2ZpbGVBY3Rpb24gPSBkcm9wZG93bkFjdGlvbnMuZmluZChkID0+IGQubGFiZWwuZW5kc1dpdGgoJyhEZWZhdWx0KScpKTtcblx0aWYgKGRlZmF1bHRQcm9maWxlQWN0aW9uKSB7XG5cdFx0ZHJvcGRvd25BY3Rpb25zID0gZHJvcGRvd25BY3Rpb25zLmZpbHRlcihkID0+IGQgIT09IGRlZmF1bHRQcm9maWxlQWN0aW9uKS5zb3J0KChhLCBiKSA9PiBhLmxhYmVsLmxvY2FsZUNvbXBhcmUoYi5sYWJlbCkpO1xuXHRcdGRyb3Bkb3duQWN0aW9ucy51bnNoaWZ0KGRlZmF1bHRQcm9maWxlQWN0aW9uKTtcblx0fVxuXG5cdGlmIChkcm9wZG93bkFjdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdGRyb3Bkb3duQWN0aW9ucy5wdXNoKG5ldyBTdWJtZW51QWN0aW9uKCdzcGxpdC5wcm9maWxlJywgbG9jYWxpemUoJ3NwbGl0VGVybWluYWwnLCAnU3BsaXQgVGVybWluYWwnKSwgc3VibWVudUFjdGlvbnMpKTtcblx0XHRkcm9wZG93bkFjdGlvbnMucHVzaChuZXcgU2VwYXJhdG9yKCkpO1xuXHR9XG5cdGNvbnN0IGFjdGlvbnMgPSBkcm9wZG93bk1lbnUuZ2V0QWN0aW9ucygpO1xuXHRkcm9wZG93bkFjdGlvbnMucHVzaCguLi5TZXBhcmF0b3Iuam9pbiguLi5hY3Rpb25zLm1hcChhID0+IGFbMV0pKSk7XG5cblx0Y29uc3QgZGVmYXVsdFN1Ym1lbnVQcm9maWxlQWN0aW9uID0gc3VibWVudUFjdGlvbnMuZmluZChkID0+IGQubGFiZWwuZW5kc1dpdGgoJyhEZWZhdWx0KScpKTtcblx0aWYgKGRlZmF1bHRTdWJtZW51UHJvZmlsZUFjdGlvbikge1xuXHRcdHN1Ym1lbnVBY3Rpb25zID0gc3VibWVudUFjdGlvbnMuZmlsdGVyKGQgPT4gZCAhPT0gZGVmYXVsdFN1Ym1lbnVQcm9maWxlQWN0aW9uKS5zb3J0KChhLCBiKSA9PiBhLmxhYmVsLmxvY2FsZUNvbXBhcmUoYi5sYWJlbCkpO1xuXHRcdHN1Ym1lbnVBY3Rpb25zLnVuc2hpZnQoZGVmYXVsdFN1Ym1lbnVQcm9maWxlQWN0aW9uKTtcblx0fVxuXG5cdGNvbnN0IGRyb3Bkb3duQWN0aW9uID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgQWN0aW9uKCdyZWZyZXNoIHByb2ZpbGVzJywgbG9jYWxpemUoJ2xhdW5jaFByb2ZpbGUnLCAnTGF1bmNoIFByb2ZpbGUuLi4nKSwgJ2NvZGljb24tY2hldnJvbi1kb3duJywgdHJ1ZSkpO1xuXHRyZXR1cm4geyBkcm9wZG93bkFjdGlvbiwgZHJvcGRvd25NZW51QWN0aW9uczogZHJvcGRvd25BY3Rpb25zLCBjbGFzc05hbWU6IGB0ZXJtaW5hbC10YWItYWN0aW9ucy0ke3Rlcm1pbmFsU2VydmljZS5yZXNvbHZlTG9jYXRpb24obG9jYXRpb24pfWAgfTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsUUFBaUIsV0FBVyxxQkFBcUI7QUFDMUQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQWdCLFFBQVEsb0JBQW9CO0FBQzVDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQXNELGtCQUFrQix5QkFBeUI7QUFDakcsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxxQ0FBcUM7QUFFOUMsU0FBUyxtQkFBbUIsd0JBQXdCO0FBQ3BELFNBQVMscUJBQXFCLGlDQUFpQztBQUMvRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGNBQWMsa0JBQWtCO0FBR3pDLElBQVcsbUJBQVgsa0JBQVdBLHNCQUFYO0FBQ0MsRUFBQUEsa0JBQUEsWUFBUztBQUNULEVBQUFBLGtCQUFBLFVBQU87QUFDUCxFQUFBQSxrQkFBQSxXQUFRO0FBQ1IsRUFBQUEsa0JBQUEsVUFBTztBQUNQLEVBQUFBLGtCQUFBLFlBQVM7QUFMQyxTQUFBQTtBQUFBLEdBQUE7QUFRSixJQUFXLHVCQUFYLGtCQUFXQywwQkFBWDtBQUNOLEVBQUFBLHNCQUFBLFlBQVM7QUFDVCxFQUFBQSxzQkFBQSxTQUFNO0FBQ04sRUFBQUEsc0JBQUEsWUFBUztBQUNULEVBQUFBLHNCQUFBLGVBQVk7QUFKSyxTQUFBQTtBQUFBLEdBQUE7QUFPWCxTQUFTLHFCQUEyQjtBQUMxQyxlQUFhO0FBQUEsSUFDWjtBQUFBLE1BQ0M7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsT0FBTztBQUFBLFVBQ1AsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLFNBQVMsRUFBRSxLQUFLLGlCQUFpQixTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxnQkFBZ0I7QUFBQSxVQUMvRjtBQUFBLFVBQ0EsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxPQUFPO0FBQUEsVUFDUCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sU0FBUyxFQUFFLEtBQUssbUJBQW1CLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLGtCQUFrQjtBQUFBLFlBQ2xHLGNBQWMsZUFBZSxJQUFJLDBCQUEwQixNQUFNO0FBQUEsVUFDbEU7QUFBQSxVQUNBLE9BQU87QUFBQSxVQUNQLE1BQU0sb0JBQW9CO0FBQUEsUUFDM0I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxPQUFPO0FBQUEsVUFDUCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sU0FBUyxFQUFFLEtBQUssbUJBQW1CLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLG1CQUFtQjtBQUFBLFVBQ3BHO0FBQUEsVUFDQSxPQUFPO0FBQUEsVUFDUCxNQUFNLG9CQUFvQjtBQUFBLFFBQzNCO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsT0FBTztBQUFBLFVBQ1AsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLFNBQVMsRUFBRSxLQUFLLHFCQUFxQixTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxxQkFBcUI7QUFBQSxVQUN4RztBQUFBLFVBQ0EsT0FBTztBQUFBLFVBQ1AsTUFBTSxvQkFBb0I7QUFBQSxRQUMzQjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLGVBQWE7QUFBQSxJQUNaO0FBQUEsTUFDQztBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxPQUFPO0FBQUEsVUFDUCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sZ0JBQWdCLE1BQU07QUFBQSxVQUM5QjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sZ0JBQWdCO0FBQUEsVUFDeEI7QUFBQSxVQUNBLE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLGdCQUFnQixLQUFLO0FBQUEsVUFDN0I7QUFBQSxVQUNBLE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLFNBQVMsaURBQWlELE1BQU07QUFBQSxVQUN4RTtBQUFBLFVBQ0EsT0FBTztBQUFBLFVBQ1AsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sU0FBUyxpREFBaUQsY0FBYztBQUFBLFVBQ2hGO0FBQUEsVUFDQSxPQUFPO0FBQUEsVUFDUCxPQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU07QUFBQSxVQUNMLFNBQVM7QUFBQSxZQUNSLElBQUksa0JBQWtCO0FBQUEsWUFDdEIsT0FBTyxTQUFTLHlDQUF5QyxPQUFPO0FBQUEsVUFDakU7QUFBQSxVQUNBLE9BQU87QUFBQSxVQUNQLE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLFNBQVMsbUNBQW1DLE9BQU87QUFBQSxVQUMzRDtBQUFBLFVBQ0EsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sZ0JBQWdCO0FBQUEsVUFDeEI7QUFBQSxVQUNBLE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BRUE7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLFNBQVMsdUNBQXVDLFlBQVk7QUFBQSxVQUNwRTtBQUFBLFVBQ0EsT0FBTztBQUFBLFVBQ1AsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFFQSxlQUFhO0FBQUEsSUFDWjtBQUFBLE1BQ0M7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsT0FBTztBQUFBLFVBQ1AsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLGdCQUFnQixNQUFNO0FBQUEsVUFDOUI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLGdCQUFnQjtBQUFBLFVBQ3hCO0FBQUEsVUFDQSxPQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU07QUFBQSxVQUNMLFNBQVM7QUFBQSxZQUNSLElBQUksa0JBQWtCO0FBQUEsWUFDdEIsT0FBTyxnQkFBZ0IsS0FBSztBQUFBLFVBQzdCO0FBQUEsVUFDQSxPQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU07QUFBQSxVQUNMLFNBQVM7QUFBQSxZQUNSLElBQUksa0JBQWtCO0FBQUEsWUFDdEIsT0FBTyxTQUFTLGlEQUFpRCxNQUFNO0FBQUEsVUFDeEU7QUFBQSxVQUNBLE9BQU87QUFBQSxVQUNQLE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLFNBQVMsaURBQWlELGNBQWM7QUFBQSxVQUNoRjtBQUFBLFVBQ0EsT0FBTztBQUFBLFVBQ1AsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sU0FBUyx5Q0FBeUMsT0FBTztBQUFBLFVBQ2pFO0FBQUEsVUFDQSxPQUFPO0FBQUEsVUFDUCxPQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU07QUFBQSxVQUNMLFNBQVM7QUFBQSxZQUNSLElBQUksa0JBQWtCO0FBQUEsWUFDdEIsT0FBTyxTQUFTLG1DQUFtQyxPQUFPO0FBQUEsVUFDM0Q7QUFBQSxVQUNBLE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLFNBQVMsdUNBQXVDLFlBQVk7QUFBQSxVQUNwRTtBQUFBLFVBQ0EsT0FBTztBQUFBLFVBQ1AsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sZ0JBQWdCO0FBQUEsVUFDeEI7QUFBQSxVQUNBLE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBRUEsZUFBYTtBQUFBLElBQ1o7QUFBQSxNQUNDO0FBQUEsUUFDQyxJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU07QUFBQSxVQUNMLFNBQVM7QUFBQSxZQUNSLElBQUksa0JBQWtCO0FBQUEsWUFDdEIsT0FBTyxTQUFTLGtEQUFrRCw4QkFBOEI7QUFBQSxVQUNqRztBQUFBLFVBQ0EsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sZ0JBQWdCO0FBQUEsVUFDeEI7QUFBQSxVQUNBLE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBRUEsZUFBYTtBQUFBLElBQ1o7QUFBQSxNQUNDO0FBQUEsUUFDQyxJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU07QUFBQSxVQUNMLFNBQVM7QUFBQSxZQUNSLElBQUksa0JBQWtCO0FBQUEsWUFDdEIsT0FBTyxVQUFVLGtEQUFrRCx3QkFBd0I7QUFBQSxVQUM1RjtBQUFBLFVBQ0EsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sU0FBUywwQ0FBMEMsNkJBQTZCO0FBQUEsVUFDeEY7QUFBQSxVQUNBLE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSTtBQUFBLFlBQ0osT0FBTyxTQUFTLGtDQUFrQyxhQUFhO0FBQUEsVUFDaEU7QUFBQSxVQUNBLE1BQU07QUFBQSxVQUNOLE9BQU87QUFBQSxVQUNQLE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSTtBQUFBLFlBQ0osT0FBTyxTQUFTLDhDQUE4QyxvQkFBb0I7QUFBQSxVQUNuRjtBQUFBLFVBQ0EsTUFBTTtBQUFBLFVBQ04sT0FBTztBQUFBLFVBQ1AsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFFQSxlQUFhO0FBQUEsSUFDWjtBQUFBLE1BQ0M7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLFVBQVUsNENBQTRDLGlCQUFpQjtBQUFBLFVBQy9FO0FBQUEsVUFDQSxPQUFPO0FBQUEsVUFDUCxPQUFPO0FBQUEsVUFDUCxNQUFNLGVBQWU7QUFBQSxZQUNwQixlQUFlLE9BQU8sUUFBUSxnQkFBZ0I7QUFBQSxZQUM5QyxlQUFlLElBQUksVUFBVSxrQkFBa0IsV0FBVyxFQUFFO0FBQUEsVUFDN0Q7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQTtBQUFBLFFBRUMsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sZ0JBQWdCO0FBQUEsVUFDeEI7QUFBQSxVQUNBLEtBQUs7QUFBQSxZQUNKLElBQUksa0JBQWtCO0FBQUEsWUFDdEIsT0FBTyxnQkFBZ0IsTUFBTTtBQUFBLFlBQzdCLE1BQU0sUUFBUTtBQUFBLFVBQ2Y7QUFBQSxVQUNBLE9BQU87QUFBQSxVQUNQLE9BQU87QUFBQSxVQUNQLE1BQU0sZUFBZTtBQUFBLFlBQ3BCLGVBQWUsT0FBTyxRQUFRLGdCQUFnQjtBQUFBLFlBQzlDLGVBQWUsSUFBSSxVQUFVLGtCQUFrQixXQUFXLEVBQUU7QUFBQSxZQUM1RCxlQUFlO0FBQUEsY0FDZCxlQUFlO0FBQUEsZ0JBQ2QsZUFBZSxPQUFPLFVBQVUsa0JBQWtCLHNCQUFzQixJQUFJLGdCQUFnQjtBQUFBLGdCQUM1RixlQUFlLE9BQU8sMEJBQTBCLFlBQVksQ0FBQztBQUFBLGNBQzlEO0FBQUEsY0FDQSxlQUFlO0FBQUEsZ0JBQ2QsZUFBZSxPQUFPLFVBQVUsa0JBQWtCLHNCQUFzQixJQUFJLHdCQUF3QjtBQUFBLGdCQUNwRyxlQUFlO0FBQUEsa0JBQ2QsZUFBZSxPQUFPLDBCQUEwQixZQUFZLENBQUM7QUFBQSxrQkFDN0QsZUFBZSxJQUFJLDBCQUEwQixVQUFVO0FBQUEsZ0JBQ3hEO0FBQUEsY0FDRDtBQUFBLGNBQ0EsZUFBZTtBQUFBLGdCQUNkLGVBQWUsT0FBTyxVQUFVLGtCQUFrQixzQkFBc0IsSUFBSSxhQUFhO0FBQUEsZ0JBQ3pGLGVBQWUsT0FBTywwQkFBMEIsWUFBWSxDQUFDO0FBQUEsY0FDOUQ7QUFBQSxjQUNBLGVBQWUsT0FBTyxVQUFVLGtCQUFrQixzQkFBc0IsSUFBSSxRQUFRO0FBQUEsWUFDckY7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU07QUFBQSxVQUNMLFNBQVM7QUFBQSxZQUNSLElBQUksa0JBQWtCO0FBQUEsWUFDdEIsT0FBTyxnQkFBZ0I7QUFBQSxZQUN2QixNQUFNLFFBQVE7QUFBQSxVQUNmO0FBQUEsVUFDQSxPQUFPO0FBQUEsVUFDUCxPQUFPO0FBQUEsVUFDUCxNQUFNLG9CQUFvQjtBQUFBLFFBQzNCO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLGdCQUFnQjtBQUFBLFlBQ3ZCLE1BQU0sUUFBUTtBQUFBLFVBQ2Y7QUFBQSxVQUNBLE9BQU87QUFBQSxVQUNQLE9BQU87QUFBQSxVQUNQLE1BQU0sb0JBQW9CO0FBQUEsUUFDM0I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sZ0JBQWdCO0FBQUEsWUFDdkIsTUFBTSxRQUFRO0FBQUEsVUFDZjtBQUFBLFVBQ0EsS0FBSztBQUFBLFlBQ0osSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLGdCQUFnQixNQUFNO0FBQUEsWUFDN0IsTUFBTSxRQUFRO0FBQUEsVUFDZjtBQUFBLFVBQ0EsT0FBTztBQUFBLFVBQ1AsT0FBTztBQUFBLFVBQ1AsTUFBTSxlQUFlO0FBQUEsWUFDcEIsZUFBZSxPQUFPLFFBQVEsZ0JBQWdCO0FBQUEsWUFDOUMsZUFBZSxHQUFHLG9CQUFvQixnQ0FBZ0Msb0JBQW9CLGdCQUFnQjtBQUFBLFVBQzNHO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU07QUFBQSxVQUNMLFNBQVM7QUFBQSxZQUNSLElBQUksa0JBQWtCO0FBQUEsWUFDdEIsT0FBTyxTQUFTLHVDQUF1QyxnQkFBZ0I7QUFBQSxZQUN2RSxNQUFNLFFBQVE7QUFBQSxVQUNmO0FBQUEsVUFDQSxPQUFPO0FBQUEsVUFDUCxPQUFPO0FBQUEsVUFDUCxNQUFNLGVBQWUsT0FBTyxRQUFRLGdCQUFnQjtBQUFBLFVBQ3BELG1CQUFtQjtBQUFBLFFBQ3BCO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLFNBQVMsMkNBQTJDLGlCQUFpQjtBQUFBLFlBQzVFLE1BQU0sUUFBUTtBQUFBLFVBQ2Y7QUFBQSxVQUNBLE9BQU87QUFBQSxVQUNQLE9BQU87QUFBQSxVQUNQLE1BQU0sZUFBZSxPQUFPLFFBQVEsZ0JBQWdCO0FBQUEsVUFDcEQsbUJBQW1CO0FBQUEsUUFDcEI7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sU0FBUyw2Q0FBNkMsbUJBQW1CO0FBQUEsWUFDaEYsTUFBTSxRQUFRO0FBQUEsVUFDZjtBQUFBLFVBQ0EsT0FBTztBQUFBLFVBQ1AsT0FBTztBQUFBLFVBQ1AsTUFBTSxlQUFlLE9BQU8sUUFBUSxnQkFBZ0I7QUFBQSxVQUNwRCxtQkFBbUI7QUFBQSxRQUNwQjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLGVBQWE7QUFBQSxJQUNaO0FBQUEsTUFDQztBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sZ0JBQWdCLE1BQU07QUFBQSxVQUM5QjtBQUFBLFVBQ0EsT0FBTztBQUFBLFVBQ1AsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sZ0JBQWdCLGFBQWE7QUFBQSxVQUNyQztBQUFBLFVBQ0EsT0FBTztBQUFBLFVBQ1AsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sZ0JBQWdCLGtCQUFrQjtBQUFBLFVBQzFDO0FBQUEsVUFDQSxPQUFPO0FBQUEsVUFDUCxPQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU07QUFBQSxVQUNMLFNBQVM7QUFBQSxZQUNSLElBQUksa0JBQWtCO0FBQUEsWUFDdEIsT0FBTyxTQUFTLDRDQUE0QyxXQUFXO0FBQUEsVUFDeEU7QUFBQSxVQUNBLE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLFNBQVMsd0NBQXdDLGdCQUFnQjtBQUFBLFVBQ3pFO0FBQUEsVUFDQSxPQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU07QUFBQSxVQUNMLFNBQVM7QUFBQSxZQUNSLElBQUksa0JBQWtCO0FBQUEsWUFDdEIsT0FBTyxTQUFTLHlDQUF5QyxpQkFBaUI7QUFBQSxVQUMzRTtBQUFBLFVBQ0EsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUixJQUFJLGtCQUFrQjtBQUFBLFlBQ3RCLE9BQU8sZ0JBQWdCO0FBQUEsVUFDeEI7QUFBQSxVQUNBLE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLFNBQVMsMENBQTBDLGdCQUFnQjtBQUFBLFVBQzNFO0FBQUEsVUFDQSxNQUFNLG9CQUFvQixzQkFBc0IsVUFBVTtBQUFBLFVBQzFELE9BQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTTtBQUFBLFVBQ0wsU0FBUztBQUFBLFlBQ1IsSUFBSSxrQkFBa0I7QUFBQSxZQUN0QixPQUFPLGdCQUFnQixRQUFRO0FBQUEsVUFDaEM7QUFBQSxVQUNBLE1BQU0sZUFBZSxJQUFJLG9CQUFvQix1QkFBdUIsb0JBQW9CLGFBQWE7QUFBQSxVQUNyRyxPQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU07QUFBQSxVQUNMLFNBQVM7QUFBQSxZQUNSLElBQUksa0JBQWtCO0FBQUEsWUFDdEIsT0FBTyxnQkFBZ0IsS0FBSztBQUFBLFVBQzdCO0FBQUEsVUFDQSxPQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLGVBQWEsZUFBZSxPQUFPLG9CQUFvQjtBQUFBLElBQ3RELFNBQVM7QUFBQSxNQUNSLElBQUksa0JBQWtCO0FBQUEsTUFDdEIsT0FBTyxnQkFBZ0I7QUFBQSxJQUN4QjtBQUFBLElBQ0EsTUFBTSxtQkFBbUIsT0FBTyxVQUFVLFFBQVEsY0FBYztBQUFBLElBQ2hFLE9BQU87QUFBQSxFQUNSLENBQUM7QUFFRCxlQUFhLGVBQWUsT0FBTyxvQkFBb0I7QUFBQSxJQUN0RCxTQUFTO0FBQUEsTUFDUixJQUFJLGtCQUFrQjtBQUFBLE1BQ3RCLE9BQU8sZ0JBQWdCO0FBQUEsSUFDeEI7QUFBQSxJQUNBLE1BQU0sbUJBQW1CLE9BQU8sVUFBVSxRQUFRLGNBQWM7QUFBQSxJQUNoRSxPQUFPO0FBQUEsRUFDUixDQUFDO0FBRUQsZUFBYSxlQUFlLE9BQU8sb0JBQW9CO0FBQUEsSUFDdEQsU0FBUztBQUFBLE1BQ1IsSUFBSSxrQkFBa0I7QUFBQSxNQUN0QixPQUFPLGdCQUFnQjtBQUFBLElBQ3hCO0FBQUEsSUFDQSxNQUFNLG1CQUFtQixPQUFPLFVBQVUsUUFBUSxjQUFjO0FBQUEsSUFDaEUsT0FBTztBQUFBLEVBQ1IsQ0FBQztBQUVELGVBQWEsZUFBZSxPQUFPLG9CQUFvQjtBQUFBLElBQ3RELFNBQVM7QUFBQSxNQUNSLElBQUksa0JBQWtCO0FBQUEsTUFDdEIsT0FBTyxnQkFBZ0I7QUFBQSxJQUN4QjtBQUFBLElBQ0EsTUFBTSxtQkFBbUIsT0FBTyxVQUFVLFFBQVEsY0FBYztBQUFBLElBQ2hFLE9BQU87QUFBQSxFQUNSLENBQUM7QUFDRCxlQUFhLGVBQWUsT0FBTyxvQkFBb0I7QUFBQSxJQUN0RCxTQUFTO0FBQUEsTUFDUixJQUFJLGtCQUFrQjtBQUFBLE1BQ3RCLE9BQU8sZ0JBQWdCO0FBQUEsSUFDeEI7QUFBQSxJQUNBLE1BQU0sbUJBQW1CLE9BQU8sVUFBVSxRQUFRLGNBQWM7QUFBQSxJQUNoRSxPQUFPO0FBQUEsRUFDUixDQUFDO0FBRUQsZUFBYSxlQUFlLE9BQU8sYUFBYTtBQUFBLElBQy9DLFNBQVM7QUFBQSxNQUNSLElBQUksa0JBQWtCO0FBQUEsTUFDdEIsT0FBTyxnQkFBZ0I7QUFBQSxNQUN2QixNQUFNLFFBQVE7QUFBQSxJQUNmO0FBQUEsSUFDQSxLQUFLO0FBQUEsTUFDSixJQUFJLGtCQUFrQjtBQUFBLE1BQ3RCLE9BQU8sZ0JBQWdCLE1BQU07QUFBQSxNQUM3QixNQUFNLFFBQVE7QUFBQSxJQUNmO0FBQUEsSUFDQSxPQUFPO0FBQUEsSUFDUCxPQUFPO0FBQUEsSUFDUCxNQUFNLG1CQUFtQixPQUFPLFVBQVUsUUFBUSxjQUFjO0FBQUEsRUFDakUsQ0FBQztBQUNGO0FBRU8sU0FBUyx5QkFBeUIsVUFBb0MsVUFBOEIsb0JBQTRCLHFCQUEyRCxpQkFBbUMsY0FBcUIsaUJBS3hQO0FBQ0QsTUFBSSxrQkFBNkIsQ0FBQztBQUNsQyxNQUFJLGlCQUE0QixDQUFDO0FBQ2pDLGFBQVcsU0FBUyxPQUFPLE9BQUssQ0FBQyxFQUFFLGNBQWM7QUFDakQsUUFBTSxnQkFBaUIsYUFBYSxpQkFBaUIsVUFBVyxPQUFPLGFBQWEsWUFBWSxnQkFBZ0IsWUFBWSxTQUFTLGVBQWUsZUFBaUIsRUFBRSxZQUFZLFdBQVcsSUFBSSxFQUFFLHFCQUFxQixLQUFLO0FBQzlOLGFBQVcsS0FBSyxVQUFVO0FBQ3pCLFVBQU0sWUFBWSxFQUFFLGdCQUFnQjtBQUNwQyxVQUFNLFVBQWtDLEVBQUUsUUFBUSxHQUFHLFNBQVM7QUFDOUQsVUFBTSxlQUF1QyxFQUFFLFFBQVEsR0FBRyxVQUFVLGNBQWM7QUFDbEYsVUFBTSx1QkFBdUIsRUFBRSxZQUFZLFFBQVEsYUFBYSxFQUFFO0FBQ2xFLG9CQUFnQixLQUFLLGdCQUFnQixJQUFJLElBQUksT0FBTyxrQkFBa0IsZ0JBQWdCLFlBQVksU0FBUywwQkFBMEIsaUJBQWlCLG9CQUFvQixJQUFJLHNCQUFzQixRQUFXLE1BQU0sWUFBWTtBQUNoTyxZQUFNLFdBQVcsTUFBTSxnQkFBZ0IsZUFBZSxPQUFPO0FBQzdELHNCQUFnQixrQkFBa0IsUUFBUTtBQUMxQyxZQUFNLGdCQUFnQixvQkFBb0I7QUFBQSxJQUMzQyxDQUFDLENBQUMsQ0FBQztBQUNILG1CQUFlLEtBQUssZ0JBQWdCLElBQUksSUFBSSxPQUFPLGtCQUFrQixPQUFPLFlBQVksU0FBUywwQkFBMEIsaUJBQWlCLG9CQUFvQixJQUFJLHNCQUFzQixRQUFXLE1BQU0sWUFBWTtBQUN0TixZQUFNLFdBQVcsTUFBTSxnQkFBZ0IsZUFBZSxZQUFZO0FBQ2xFLHNCQUFnQixrQkFBa0IsUUFBUTtBQUMxQyxZQUFNLGdCQUFnQixvQkFBb0I7QUFBQSxJQUMzQyxDQUFDLENBQUMsQ0FBQztBQUFBLEVBQ0o7QUFFQSxhQUFXLGVBQWUscUJBQXFCO0FBQzlDLFVBQU0sWUFBWSxZQUFZLFVBQVU7QUFDeEMsVUFBTSxRQUFRLFlBQVksU0FBUywwQkFBMEIsaUJBQWlCLFlBQVksTUFBTSxRQUFRLGFBQWEsRUFBRSxDQUFDLElBQUksWUFBWSxNQUFNLFFBQVEsYUFBYSxFQUFFO0FBQ3JLLG9CQUFnQixLQUFLLGdCQUFnQixJQUFJLElBQUksT0FBTyxlQUFlLE9BQU8sUUFBVyxNQUFNLE1BQU0sZ0JBQWdCLGVBQWU7QUFBQSxNQUMvSCxRQUFRO0FBQUEsUUFDUCxxQkFBcUIsWUFBWTtBQUFBLFFBQ2pDLElBQUksWUFBWTtBQUFBLFFBQ2hCO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxJQUNELENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDSixtQkFBZSxLQUFLLGdCQUFnQixJQUFJLElBQUksT0FBTyxxQkFBcUIsT0FBTyxRQUFXLE1BQU0sTUFBTSxnQkFBZ0IsZUFBZTtBQUFBLE1BQ3BJLFFBQVE7QUFBQSxRQUNQLHFCQUFxQixZQUFZO0FBQUEsUUFDakMsSUFBSSxZQUFZO0FBQUEsUUFDaEI7QUFBQSxNQUNEO0FBQUEsTUFDQSxVQUFVO0FBQUEsSUFDWCxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQUEsRUFDTDtBQUVBLFFBQU0sdUJBQXVCLGdCQUFnQixLQUFLLE9BQUssRUFBRSxNQUFNLFNBQVMsV0FBVyxDQUFDO0FBQ3BGLE1BQUksc0JBQXNCO0FBQ3pCLHNCQUFrQixnQkFBZ0IsT0FBTyxPQUFLLE1BQU0sb0JBQW9CLEVBQUUsS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sY0FBYyxFQUFFLEtBQUssQ0FBQztBQUN2SCxvQkFBZ0IsUUFBUSxvQkFBb0I7QUFBQSxFQUM3QztBQUVBLE1BQUksZ0JBQWdCLFNBQVMsR0FBRztBQUMvQixvQkFBZ0IsS0FBSyxJQUFJLGNBQWMsaUJBQWlCLFNBQVMsaUJBQWlCLGdCQUFnQixHQUFHLGNBQWMsQ0FBQztBQUNwSCxvQkFBZ0IsS0FBSyxJQUFJLFVBQVUsQ0FBQztBQUFBLEVBQ3JDO0FBQ0EsUUFBTSxVQUFVLGFBQWEsV0FBVztBQUN4QyxrQkFBZ0IsS0FBSyxHQUFHLFVBQVUsS0FBSyxHQUFHLFFBQVEsSUFBSSxPQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUVqRSxRQUFNLDhCQUE4QixlQUFlLEtBQUssT0FBSyxFQUFFLE1BQU0sU0FBUyxXQUFXLENBQUM7QUFDMUYsTUFBSSw2QkFBNkI7QUFDaEMscUJBQWlCLGVBQWUsT0FBTyxPQUFLLE1BQU0sMkJBQTJCLEVBQUUsS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sY0FBYyxFQUFFLEtBQUssQ0FBQztBQUM1SCxtQkFBZSxRQUFRLDJCQUEyQjtBQUFBLEVBQ25EO0FBRUEsUUFBTSxpQkFBaUIsZ0JBQWdCLElBQUksSUFBSSxPQUFPLG9CQUFvQixTQUFTLGlCQUFpQixtQkFBbUIsR0FBRyx3QkFBd0IsSUFBSSxDQUFDO0FBQ3ZKLFNBQU8sRUFBRSxnQkFBZ0IscUJBQXFCLGlCQUFpQixXQUFXLHdCQUF3QixnQkFBZ0IsZ0JBQWdCLFFBQVEsQ0FBQyxHQUFHO0FBQy9JOyIsCiAgIm5hbWVzIjogWyJDb250ZXh0TWVudUdyb3VwIiwgIlRlcm1pbmFsTWVudUJhckdyb3VwIl0KfQo=
