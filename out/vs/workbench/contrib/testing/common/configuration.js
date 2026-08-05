import { observableFromEvent } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../common/configuration.js";
var TestingConfigKeys = /* @__PURE__ */ ((TestingConfigKeys2) => {
  TestingConfigKeys2["AutoOpenPeekView"] = "testing.automaticallyOpenPeekView";
  TestingConfigKeys2["AutoOpenPeekViewDuringContinuousRun"] = "testing.automaticallyOpenPeekViewDuringAutoRun";
  TestingConfigKeys2["OpenResults"] = "testing.automaticallyOpenTestResults";
  TestingConfigKeys2["FollowRunningTest"] = "testing.followRunningTest";
  TestingConfigKeys2["DefaultGutterClickAction"] = "testing.defaultGutterClickAction";
  TestingConfigKeys2["GutterEnabled"] = "testing.gutterEnabled";
  TestingConfigKeys2["SaveBeforeTest"] = "testing.saveBeforeTest";
  TestingConfigKeys2["AlwaysRevealTestOnStateChange"] = "testing.alwaysRevealTestOnStateChange";
  TestingConfigKeys2["CountBadge"] = "testing.countBadge";
  TestingConfigKeys2["ShowAllMessages"] = "testing.showAllMessages";
  TestingConfigKeys2["CoveragePercent"] = "testing.displayedCoveragePercent";
  TestingConfigKeys2["ShowCoverageInExplorer"] = "testing.showCoverageInExplorer";
  TestingConfigKeys2["CoverageBarThresholds"] = "testing.coverageBarThresholds";
  TestingConfigKeys2["CoverageToolbarEnabled"] = "testing.coverageToolbarEnabled";
  return TestingConfigKeys2;
})(TestingConfigKeys || {});
var AutoOpenTesting = /* @__PURE__ */ ((AutoOpenTesting2) => {
  AutoOpenTesting2["NeverOpen"] = "neverOpen";
  AutoOpenTesting2["OpenOnTestStart"] = "openOnTestStart";
  AutoOpenTesting2["OpenOnTestFailure"] = "openOnTestFailure";
  AutoOpenTesting2["OpenExplorerOnTestStart"] = "openExplorerOnTestStart";
  return AutoOpenTesting2;
})(AutoOpenTesting || {});
var AutoOpenPeekViewWhen = /* @__PURE__ */ ((AutoOpenPeekViewWhen2) => {
  AutoOpenPeekViewWhen2["FailureVisible"] = "failureInVisibleDocument";
  AutoOpenPeekViewWhen2["FailureAnywhere"] = "failureAnywhere";
  AutoOpenPeekViewWhen2["Never"] = "never";
  return AutoOpenPeekViewWhen2;
})(AutoOpenPeekViewWhen || {});
var DefaultGutterClickAction = /* @__PURE__ */ ((DefaultGutterClickAction2) => {
  DefaultGutterClickAction2["Run"] = "run";
  DefaultGutterClickAction2["Debug"] = "debug";
  DefaultGutterClickAction2["Coverage"] = "runWithCoverage";
  DefaultGutterClickAction2["ContextMenu"] = "contextMenu";
  return DefaultGutterClickAction2;
})(DefaultGutterClickAction || {});
var TestingCountBadge = /* @__PURE__ */ ((TestingCountBadge2) => {
  TestingCountBadge2["Failed"] = "failed";
  TestingCountBadge2["Off"] = "off";
  TestingCountBadge2["Passed"] = "passed";
  TestingCountBadge2["Skipped"] = "skipped";
  return TestingCountBadge2;
})(TestingCountBadge || {});
var TestingDisplayedCoveragePercent = /* @__PURE__ */ ((TestingDisplayedCoveragePercent2) => {
  TestingDisplayedCoveragePercent2["TotalCoverage"] = "totalCoverage";
  TestingDisplayedCoveragePercent2["Statement"] = "statement";
  TestingDisplayedCoveragePercent2["Minimum"] = "minimum";
  return TestingDisplayedCoveragePercent2;
})(TestingDisplayedCoveragePercent || {});
const testingConfiguration = {
  id: "testing",
  order: 21,
  title: localize("testConfigurationTitle", "Testing"),
  type: "object",
  properties: {
    ["testing.automaticallyOpenPeekView" /* AutoOpenPeekView */]: {
      description: localize("testing.automaticallyOpenPeekView", "Configures when the error Peek view is automatically opened."),
      enum: [
        "failureAnywhere" /* FailureAnywhere */,
        "failureInVisibleDocument" /* FailureVisible */,
        "never" /* Never */
      ],
      default: "never" /* Never */,
      enumDescriptions: [
        localize("testing.automaticallyOpenPeekView.failureAnywhere", "Open automatically no matter where the failure is."),
        localize("testing.automaticallyOpenPeekView.failureInVisibleDocument", "Open automatically when a test fails in a visible document."),
        localize("testing.automaticallyOpenPeekView.never", "Never automatically open.")
      ]
    },
    ["testing.showAllMessages" /* ShowAllMessages */]: {
      description: localize("testing.showAllMessages", "Controls whether to show messages from all test runs."),
      type: "boolean",
      default: false
    },
    ["testing.automaticallyOpenPeekViewDuringAutoRun" /* AutoOpenPeekViewDuringContinuousRun */]: {
      description: localize("testing.automaticallyOpenPeekViewDuringContinuousRun", "Controls whether to automatically open the Peek view during continuous run mode."),
      type: "boolean",
      default: false
    },
    ["testing.countBadge" /* CountBadge */]: {
      description: localize("testing.countBadge", "Controls the count badge on the Testing icon on the Activity Bar."),
      enum: [
        "failed" /* Failed */,
        "off" /* Off */,
        "passed" /* Passed */,
        "skipped" /* Skipped */
      ],
      enumDescriptions: [
        localize("testing.countBadge.failed", "Show the number of failed tests"),
        localize("testing.countBadge.off", "Disable the testing count badge"),
        localize("testing.countBadge.passed", "Show the number of passed tests"),
        localize("testing.countBadge.skipped", "Show the number of skipped tests")
      ],
      default: "failed" /* Failed */
    },
    ["testing.followRunningTest" /* FollowRunningTest */]: {
      description: localize("testing.followRunningTest", "Controls whether the running test should be followed in the Test Explorer view."),
      type: "boolean",
      default: false
    },
    ["testing.defaultGutterClickAction" /* DefaultGutterClickAction */]: {
      description: localize("testing.defaultGutterClickAction", "Controls the action to take when left-clicking on a test decoration in the gutter."),
      enum: [
        "run" /* Run */,
        "debug" /* Debug */,
        "runWithCoverage" /* Coverage */,
        "contextMenu" /* ContextMenu */
      ],
      enumDescriptions: [
        localize("testing.defaultGutterClickAction.run", "Run the test."),
        localize("testing.defaultGutterClickAction.debug", "Debug the test."),
        localize("testing.defaultGutterClickAction.coverage", "Run the test with coverage."),
        localize("testing.defaultGutterClickAction.contextMenu", "Open the context menu for more options.")
      ],
      default: "run" /* Run */
    },
    ["testing.gutterEnabled" /* GutterEnabled */]: {
      description: localize("testing.gutterEnabled", "Controls whether test decorations are shown in the editor gutter."),
      type: "boolean",
      default: true
    },
    ["testing.saveBeforeTest" /* SaveBeforeTest */]: {
      description: localize("testing.saveBeforeTest", "Control whether save all dirty editors before running a test."),
      type: "boolean",
      default: true
    },
    ["testing.automaticallyOpenTestResults" /* OpenResults */]: {
      enum: [
        "neverOpen" /* NeverOpen */,
        "openOnTestStart" /* OpenOnTestStart */,
        "openOnTestFailure" /* OpenOnTestFailure */,
        "openExplorerOnTestStart" /* OpenExplorerOnTestStart */
      ],
      enumDescriptions: [
        localize("testing.openTesting.neverOpen", "Never automatically open the testing views"),
        localize("testing.openTesting.openOnTestStart", "Open the test results view when tests start"),
        localize("testing.openTesting.openOnTestFailure", "Open the test result view on any test failure"),
        localize("testing.openTesting.openExplorerOnTestStart", "Open the test explorer when tests start")
      ],
      default: "openOnTestStart",
      description: localize("testing.openTesting", "Controls when the testing view should open.")
    },
    ["testing.alwaysRevealTestOnStateChange" /* AlwaysRevealTestOnStateChange */]: {
      markdownDescription: localize("testing.alwaysRevealTestOnStateChange", "Always reveal the executed test when {0} is on. If this setting is turned off, only failed tests will be revealed.", "`#testing.followRunningTest#`"),
      type: "boolean",
      default: false
    },
    ["testing.showCoverageInExplorer" /* ShowCoverageInExplorer */]: {
      description: localize("testing.ShowCoverageInExplorer", "Whether test coverage should be down in the File Explorer view."),
      type: "boolean",
      default: true
    },
    ["testing.displayedCoveragePercent" /* CoveragePercent */]: {
      markdownDescription: localize("testing.displayedCoveragePercent", "Configures what percentage is displayed by default for test coverage."),
      default: "totalCoverage" /* TotalCoverage */,
      enum: [
        "totalCoverage" /* TotalCoverage */,
        "statement" /* Statement */,
        "minimum" /* Minimum */
      ],
      enumDescriptions: [
        localize("testing.displayedCoveragePercent.totalCoverage", "A calculation of the combined statement, function, and branch coverage."),
        localize("testing.displayedCoveragePercent.statement", "The statement coverage."),
        localize("testing.displayedCoveragePercent.minimum", "The minimum of statement, function, and branch coverage.")
      ]
    },
    ["testing.coverageBarThresholds" /* CoverageBarThresholds */]: {
      markdownDescription: localize("testing.coverageBarThresholds", "Configures the colors used for percentages in test coverage bars."),
      default: { red: 0, yellow: 60, green: 90 },
      properties: {
        red: { type: "number", minimum: 0, maximum: 100, default: 0 },
        yellow: { type: "number", minimum: 0, maximum: 100, default: 60 },
        green: { type: "number", minimum: 0, maximum: 100, default: 90 }
      }
    },
    ["testing.coverageToolbarEnabled" /* CoverageToolbarEnabled */]: {
      description: localize("testing.coverageToolbarEnabled", "Controls whether the coverage toolbar is shown in the editor."),
      type: "boolean",
      default: false
      // todo@connor4312: disabled by default until UI sync
    }
  }
};
Registry.as(Extensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "testing.openTesting",
  migrateFn: (value) => {
    return [["testing.automaticallyOpenTestResults" /* OpenResults */, { value }]];
  }
}, {
  key: "testing.automaticallyOpenResults",
  // insiders only during 1.96, remove after 1.97
  migrateFn: (value) => {
    return [["testing.automaticallyOpenTestResults" /* OpenResults */, { value }]];
  }
}]);
const getTestingConfiguration = (config, key) => config.getValue(key);
const observeTestingConfiguration = (config, key) => observableFromEvent(config.onDidChangeConfiguration, () => getTestingConfiguration(config, key));
export {
  AutoOpenPeekViewWhen,
  AutoOpenTesting,
  DefaultGutterClickAction,
  TestingConfigKeys,
  TestingCountBadge,
  TestingDisplayedCoveragePercent,
  getTestingConfiguration,
  observeTestingConfiguration,
  testingConfiguration
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2NvbW1vbi9jb25maWd1cmF0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgb2JzZXJ2YWJsZUZyb21FdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvbk5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbktleVZhbHVlUGFpcnMsIEV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uTWlncmF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5cbmV4cG9ydCBjb25zdCBlbnVtIFRlc3RpbmdDb25maWdLZXlzIHtcblx0QXV0b09wZW5QZWVrVmlldyA9ICd0ZXN0aW5nLmF1dG9tYXRpY2FsbHlPcGVuUGVla1ZpZXcnLFxuXHRBdXRvT3BlblBlZWtWaWV3RHVyaW5nQ29udGludW91c1J1biA9ICd0ZXN0aW5nLmF1dG9tYXRpY2FsbHlPcGVuUGVla1ZpZXdEdXJpbmdBdXRvUnVuJyxcblx0T3BlblJlc3VsdHMgPSAndGVzdGluZy5hdXRvbWF0aWNhbGx5T3BlblRlc3RSZXN1bHRzJyxcblx0Rm9sbG93UnVubmluZ1Rlc3QgPSAndGVzdGluZy5mb2xsb3dSdW5uaW5nVGVzdCcsXG5cdERlZmF1bHRHdXR0ZXJDbGlja0FjdGlvbiA9ICd0ZXN0aW5nLmRlZmF1bHRHdXR0ZXJDbGlja0FjdGlvbicsXG5cdEd1dHRlckVuYWJsZWQgPSAndGVzdGluZy5ndXR0ZXJFbmFibGVkJyxcblx0U2F2ZUJlZm9yZVRlc3QgPSAndGVzdGluZy5zYXZlQmVmb3JlVGVzdCcsXG5cdEFsd2F5c1JldmVhbFRlc3RPblN0YXRlQ2hhbmdlID0gJ3Rlc3RpbmcuYWx3YXlzUmV2ZWFsVGVzdE9uU3RhdGVDaGFuZ2UnLFxuXHRDb3VudEJhZGdlID0gJ3Rlc3RpbmcuY291bnRCYWRnZScsXG5cdFNob3dBbGxNZXNzYWdlcyA9ICd0ZXN0aW5nLnNob3dBbGxNZXNzYWdlcycsXG5cdENvdmVyYWdlUGVyY2VudCA9ICd0ZXN0aW5nLmRpc3BsYXllZENvdmVyYWdlUGVyY2VudCcsXG5cdFNob3dDb3ZlcmFnZUluRXhwbG9yZXIgPSAndGVzdGluZy5zaG93Q292ZXJhZ2VJbkV4cGxvcmVyJyxcblx0Q292ZXJhZ2VCYXJUaHJlc2hvbGRzID0gJ3Rlc3RpbmcuY292ZXJhZ2VCYXJUaHJlc2hvbGRzJyxcblx0Q292ZXJhZ2VUb29sYmFyRW5hYmxlZCA9ICd0ZXN0aW5nLmNvdmVyYWdlVG9vbGJhckVuYWJsZWQnLFxufVxuXG5leHBvcnQgY29uc3QgZW51bSBBdXRvT3BlblRlc3Rpbmcge1xuXHROZXZlck9wZW4gPSAnbmV2ZXJPcGVuJyxcblx0T3Blbk9uVGVzdFN0YXJ0ID0gJ29wZW5PblRlc3RTdGFydCcsXG5cdE9wZW5PblRlc3RGYWlsdXJlID0gJ29wZW5PblRlc3RGYWlsdXJlJyxcblx0T3BlbkV4cGxvcmVyT25UZXN0U3RhcnQgPSAnb3BlbkV4cGxvcmVyT25UZXN0U3RhcnQnLFxufVxuXG5leHBvcnQgY29uc3QgZW51bSBBdXRvT3BlblBlZWtWaWV3V2hlbiB7XG5cdEZhaWx1cmVWaXNpYmxlID0gJ2ZhaWx1cmVJblZpc2libGVEb2N1bWVudCcsXG5cdEZhaWx1cmVBbnl3aGVyZSA9ICdmYWlsdXJlQW55d2hlcmUnLFxuXHROZXZlciA9ICduZXZlcicsXG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIERlZmF1bHRHdXR0ZXJDbGlja0FjdGlvbiB7XG5cdFJ1biA9ICdydW4nLFxuXHREZWJ1ZyA9ICdkZWJ1ZycsXG5cdENvdmVyYWdlID0gJ3J1bldpdGhDb3ZlcmFnZScsXG5cdENvbnRleHRNZW51ID0gJ2NvbnRleHRNZW51Jyxcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gVGVzdGluZ0NvdW50QmFkZ2Uge1xuXHRGYWlsZWQgPSAnZmFpbGVkJyxcblx0T2ZmID0gJ29mZicsXG5cdFBhc3NlZCA9ICdwYXNzZWQnLFxuXHRTa2lwcGVkID0gJ3NraXBwZWQnLFxufVxuXG5leHBvcnQgY29uc3QgZW51bSBUZXN0aW5nRGlzcGxheWVkQ292ZXJhZ2VQZXJjZW50IHtcblx0VG90YWxDb3ZlcmFnZSA9ICd0b3RhbENvdmVyYWdlJyxcblx0U3RhdGVtZW50ID0gJ3N0YXRlbWVudCcsXG5cdE1pbmltdW0gPSAnbWluaW11bScsXG59XG5cbmV4cG9ydCBjb25zdCB0ZXN0aW5nQ29uZmlndXJhdGlvbjogSUNvbmZpZ3VyYXRpb25Ob2RlID0ge1xuXHRpZDogJ3Rlc3RpbmcnLFxuXHRvcmRlcjogMjEsXG5cdHRpdGxlOiBsb2NhbGl6ZSgndGVzdENvbmZpZ3VyYXRpb25UaXRsZScsIFwiVGVzdGluZ1wiKSxcblx0dHlwZTogJ29iamVjdCcsXG5cdHByb3BlcnRpZXM6IHtcblx0XHRbVGVzdGluZ0NvbmZpZ0tleXMuQXV0b09wZW5QZWVrVmlld106IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVzdGluZy5hdXRvbWF0aWNhbGx5T3BlblBlZWtWaWV3JywgXCJDb25maWd1cmVzIHdoZW4gdGhlIGVycm9yIFBlZWsgdmlldyBpcyBhdXRvbWF0aWNhbGx5IG9wZW5lZC5cIiksXG5cdFx0XHRlbnVtOiBbXG5cdFx0XHRcdEF1dG9PcGVuUGVla1ZpZXdXaGVuLkZhaWx1cmVBbnl3aGVyZSxcblx0XHRcdFx0QXV0b09wZW5QZWVrVmlld1doZW4uRmFpbHVyZVZpc2libGUsXG5cdFx0XHRcdEF1dG9PcGVuUGVla1ZpZXdXaGVuLk5ldmVyLFxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6IEF1dG9PcGVuUGVla1ZpZXdXaGVuLk5ldmVyLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgndGVzdGluZy5hdXRvbWF0aWNhbGx5T3BlblBlZWtWaWV3LmZhaWx1cmVBbnl3aGVyZScsIFwiT3BlbiBhdXRvbWF0aWNhbGx5IG5vIG1hdHRlciB3aGVyZSB0aGUgZmFpbHVyZSBpcy5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXN0aW5nLmF1dG9tYXRpY2FsbHlPcGVuUGVla1ZpZXcuZmFpbHVyZUluVmlzaWJsZURvY3VtZW50JywgXCJPcGVuIGF1dG9tYXRpY2FsbHkgd2hlbiBhIHRlc3QgZmFpbHMgaW4gYSB2aXNpYmxlIGRvY3VtZW50LlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlc3RpbmcuYXV0b21hdGljYWxseU9wZW5QZWVrVmlldy5uZXZlcicsIFwiTmV2ZXIgYXV0b21hdGljYWxseSBvcGVuLlwiKSxcblx0XHRcdF0sXG5cdFx0fSxcblx0XHRbVGVzdGluZ0NvbmZpZ0tleXMuU2hvd0FsbE1lc3NhZ2VzXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXN0aW5nLnNob3dBbGxNZXNzYWdlcycsIFwiQ29udHJvbHMgd2hldGhlciB0byBzaG93IG1lc3NhZ2VzIGZyb20gYWxsIHRlc3QgcnVucy5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHR9LFxuXHRcdFtUZXN0aW5nQ29uZmlnS2V5cy5BdXRvT3BlblBlZWtWaWV3RHVyaW5nQ29udGludW91c1J1bl06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVzdGluZy5hdXRvbWF0aWNhbGx5T3BlblBlZWtWaWV3RHVyaW5nQ29udGludW91c1J1bicsIFwiQ29udHJvbHMgd2hldGhlciB0byBhdXRvbWF0aWNhbGx5IG9wZW4gdGhlIFBlZWsgdmlldyBkdXJpbmcgY29udGludW91cyBydW4gbW9kZS5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHR9LFxuXHRcdFtUZXN0aW5nQ29uZmlnS2V5cy5Db3VudEJhZGdlXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXN0aW5nLmNvdW50QmFkZ2UnLCAnQ29udHJvbHMgdGhlIGNvdW50IGJhZGdlIG9uIHRoZSBUZXN0aW5nIGljb24gb24gdGhlIEFjdGl2aXR5IEJhci4nKSxcblx0XHRcdGVudW06IFtcblx0XHRcdFx0VGVzdGluZ0NvdW50QmFkZ2UuRmFpbGVkLFxuXHRcdFx0XHRUZXN0aW5nQ291bnRCYWRnZS5PZmYsXG5cdFx0XHRcdFRlc3RpbmdDb3VudEJhZGdlLlBhc3NlZCxcblx0XHRcdFx0VGVzdGluZ0NvdW50QmFkZ2UuU2tpcHBlZCxcblx0XHRcdF0sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXN0aW5nLmNvdW50QmFkZ2UuZmFpbGVkJywgJ1Nob3cgdGhlIG51bWJlciBvZiBmYWlsZWQgdGVzdHMnKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlc3RpbmcuY291bnRCYWRnZS5vZmYnLCAnRGlzYWJsZSB0aGUgdGVzdGluZyBjb3VudCBiYWRnZScpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVzdGluZy5jb3VudEJhZGdlLnBhc3NlZCcsICdTaG93IHRoZSBudW1iZXIgb2YgcGFzc2VkIHRlc3RzJyksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXN0aW5nLmNvdW50QmFkZ2Uuc2tpcHBlZCcsICdTaG93IHRoZSBudW1iZXIgb2Ygc2tpcHBlZCB0ZXN0cycpLFxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6IFRlc3RpbmdDb3VudEJhZGdlLkZhaWxlZCxcblx0XHR9LFxuXHRcdFtUZXN0aW5nQ29uZmlnS2V5cy5Gb2xsb3dSdW5uaW5nVGVzdF06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVzdGluZy5mb2xsb3dSdW5uaW5nVGVzdCcsICdDb250cm9scyB3aGV0aGVyIHRoZSBydW5uaW5nIHRlc3Qgc2hvdWxkIGJlIGZvbGxvd2VkIGluIHRoZSBUZXN0IEV4cGxvcmVyIHZpZXcuJyksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHR9LFxuXHRcdFtUZXN0aW5nQ29uZmlnS2V5cy5EZWZhdWx0R3V0dGVyQ2xpY2tBY3Rpb25dOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlc3RpbmcuZGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uJywgJ0NvbnRyb2xzIHRoZSBhY3Rpb24gdG8gdGFrZSB3aGVuIGxlZnQtY2xpY2tpbmcgb24gYSB0ZXN0IGRlY29yYXRpb24gaW4gdGhlIGd1dHRlci4nKSxcblx0XHRcdGVudW06IFtcblx0XHRcdFx0RGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uLlJ1bixcblx0XHRcdFx0RGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uLkRlYnVnLFxuXHRcdFx0XHREZWZhdWx0R3V0dGVyQ2xpY2tBY3Rpb24uQ292ZXJhZ2UsXG5cdFx0XHRcdERlZmF1bHRHdXR0ZXJDbGlja0FjdGlvbi5Db250ZXh0TWVudSxcblx0XHRcdF0sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXN0aW5nLmRlZmF1bHRHdXR0ZXJDbGlja0FjdGlvbi5ydW4nLCAnUnVuIHRoZSB0ZXN0LicpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVzdGluZy5kZWZhdWx0R3V0dGVyQ2xpY2tBY3Rpb24uZGVidWcnLCAnRGVidWcgdGhlIHRlc3QuJyksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXN0aW5nLmRlZmF1bHRHdXR0ZXJDbGlja0FjdGlvbi5jb3ZlcmFnZScsICdSdW4gdGhlIHRlc3Qgd2l0aCBjb3ZlcmFnZS4nKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlc3RpbmcuZGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uLmNvbnRleHRNZW51JywgJ09wZW4gdGhlIGNvbnRleHQgbWVudSBmb3IgbW9yZSBvcHRpb25zLicpLFxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6IERlZmF1bHRHdXR0ZXJDbGlja0FjdGlvbi5SdW4sXG5cdFx0fSxcblx0XHRbVGVzdGluZ0NvbmZpZ0tleXMuR3V0dGVyRW5hYmxlZF06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVzdGluZy5ndXR0ZXJFbmFibGVkJywgJ0NvbnRyb2xzIHdoZXRoZXIgdGVzdCBkZWNvcmF0aW9ucyBhcmUgc2hvd24gaW4gdGhlIGVkaXRvciBndXR0ZXIuJyksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdH0sXG5cdFx0W1Rlc3RpbmdDb25maWdLZXlzLlNhdmVCZWZvcmVUZXN0XToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXN0aW5nLnNhdmVCZWZvcmVUZXN0JywgJ0NvbnRyb2wgd2hldGhlciBzYXZlIGFsbCBkaXJ0eSBlZGl0b3JzIGJlZm9yZSBydW5uaW5nIGEgdGVzdC4nKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0fSxcblx0XHRbVGVzdGluZ0NvbmZpZ0tleXMuT3BlblJlc3VsdHNdOiB7XG5cdFx0XHRlbnVtOiBbXG5cdFx0XHRcdEF1dG9PcGVuVGVzdGluZy5OZXZlck9wZW4sXG5cdFx0XHRcdEF1dG9PcGVuVGVzdGluZy5PcGVuT25UZXN0U3RhcnQsXG5cdFx0XHRcdEF1dG9PcGVuVGVzdGluZy5PcGVuT25UZXN0RmFpbHVyZSxcblx0XHRcdFx0QXV0b09wZW5UZXN0aW5nLk9wZW5FeHBsb3Jlck9uVGVzdFN0YXJ0LFxuXHRcdFx0XSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ3Rlc3Rpbmcub3BlblRlc3RpbmcubmV2ZXJPcGVuJywgJ05ldmVyIGF1dG9tYXRpY2FsbHkgb3BlbiB0aGUgdGVzdGluZyB2aWV3cycpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVzdGluZy5vcGVuVGVzdGluZy5vcGVuT25UZXN0U3RhcnQnLCAnT3BlbiB0aGUgdGVzdCByZXN1bHRzIHZpZXcgd2hlbiB0ZXN0cyBzdGFydCcpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVzdGluZy5vcGVuVGVzdGluZy5vcGVuT25UZXN0RmFpbHVyZScsICdPcGVuIHRoZSB0ZXN0IHJlc3VsdCB2aWV3IG9uIGFueSB0ZXN0IGZhaWx1cmUnKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlc3Rpbmcub3BlblRlc3Rpbmcub3BlbkV4cGxvcmVyT25UZXN0U3RhcnQnLCAnT3BlbiB0aGUgdGVzdCBleHBsb3JlciB3aGVuIHRlc3RzIHN0YXJ0JyksXG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogJ29wZW5PblRlc3RTdGFydCcsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlc3Rpbmcub3BlblRlc3RpbmcnLCBcIkNvbnRyb2xzIHdoZW4gdGhlIHRlc3RpbmcgdmlldyBzaG91bGQgb3Blbi5cIilcblx0XHR9LFxuXHRcdFtUZXN0aW5nQ29uZmlnS2V5cy5BbHdheXNSZXZlYWxUZXN0T25TdGF0ZUNoYW5nZV06IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXN0aW5nLmFsd2F5c1JldmVhbFRlc3RPblN0YXRlQ2hhbmdlJywgXCJBbHdheXMgcmV2ZWFsIHRoZSBleGVjdXRlZCB0ZXN0IHdoZW4gezB9IGlzIG9uLiBJZiB0aGlzIHNldHRpbmcgaXMgdHVybmVkIG9mZiwgb25seSBmYWlsZWQgdGVzdHMgd2lsbCBiZSByZXZlYWxlZC5cIiwgJ2AjdGVzdGluZy5mb2xsb3dSdW5uaW5nVGVzdCNgJyksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHR9LFxuXHRcdFtUZXN0aW5nQ29uZmlnS2V5cy5TaG93Q292ZXJhZ2VJbkV4cGxvcmVyXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXN0aW5nLlNob3dDb3ZlcmFnZUluRXhwbG9yZXInLCBcIldoZXRoZXIgdGVzdCBjb3ZlcmFnZSBzaG91bGQgYmUgZG93biBpbiB0aGUgRmlsZSBFeHBsb3JlciB2aWV3LlwiKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0fSxcblx0XHRbVGVzdGluZ0NvbmZpZ0tleXMuQ292ZXJhZ2VQZXJjZW50XToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlc3RpbmcuZGlzcGxheWVkQ292ZXJhZ2VQZXJjZW50JywgXCJDb25maWd1cmVzIHdoYXQgcGVyY2VudGFnZSBpcyBkaXNwbGF5ZWQgYnkgZGVmYXVsdCBmb3IgdGVzdCBjb3ZlcmFnZS5cIiksXG5cdFx0XHRkZWZhdWx0OiBUZXN0aW5nRGlzcGxheWVkQ292ZXJhZ2VQZXJjZW50LlRvdGFsQ292ZXJhZ2UsXG5cdFx0XHRlbnVtOiBbXG5cdFx0XHRcdFRlc3RpbmdEaXNwbGF5ZWRDb3ZlcmFnZVBlcmNlbnQuVG90YWxDb3ZlcmFnZSxcblx0XHRcdFx0VGVzdGluZ0Rpc3BsYXllZENvdmVyYWdlUGVyY2VudC5TdGF0ZW1lbnQsXG5cdFx0XHRcdFRlc3RpbmdEaXNwbGF5ZWRDb3ZlcmFnZVBlcmNlbnQuTWluaW11bSxcblx0XHRcdF0sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXN0aW5nLmRpc3BsYXllZENvdmVyYWdlUGVyY2VudC50b3RhbENvdmVyYWdlJywgJ0EgY2FsY3VsYXRpb24gb2YgdGhlIGNvbWJpbmVkIHN0YXRlbWVudCwgZnVuY3Rpb24sIGFuZCBicmFuY2ggY292ZXJhZ2UuJyksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXN0aW5nLmRpc3BsYXllZENvdmVyYWdlUGVyY2VudC5zdGF0ZW1lbnQnLCAnVGhlIHN0YXRlbWVudCBjb3ZlcmFnZS4nKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlc3RpbmcuZGlzcGxheWVkQ292ZXJhZ2VQZXJjZW50Lm1pbmltdW0nLCAnVGhlIG1pbmltdW0gb2Ygc3RhdGVtZW50LCBmdW5jdGlvbiwgYW5kIGJyYW5jaCBjb3ZlcmFnZS4nKSxcblx0XHRcdF0sXG5cdFx0fSxcblx0XHRbVGVzdGluZ0NvbmZpZ0tleXMuQ292ZXJhZ2VCYXJUaHJlc2hvbGRzXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlc3RpbmcuY292ZXJhZ2VCYXJUaHJlc2hvbGRzJywgXCJDb25maWd1cmVzIHRoZSBjb2xvcnMgdXNlZCBmb3IgcGVyY2VudGFnZXMgaW4gdGVzdCBjb3ZlcmFnZSBiYXJzLlwiKSxcblx0XHRcdGRlZmF1bHQ6IHsgcmVkOiAwLCB5ZWxsb3c6IDYwLCBncmVlbjogOTAgfSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0cmVkOiB7IHR5cGU6ICdudW1iZXInLCBtaW5pbXVtOiAwLCBtYXhpbXVtOiAxMDAsIGRlZmF1bHQ6IDAgfSxcblx0XHRcdFx0eWVsbG93OiB7IHR5cGU6ICdudW1iZXInLCBtaW5pbXVtOiAwLCBtYXhpbXVtOiAxMDAsIGRlZmF1bHQ6IDYwIH0sXG5cdFx0XHRcdGdyZWVuOiB7IHR5cGU6ICdudW1iZXInLCBtaW5pbXVtOiAwLCBtYXhpbXVtOiAxMDAsIGRlZmF1bHQ6IDkwIH0sXG5cdFx0XHR9LFxuXHRcdH0sXG5cdFx0W1Rlc3RpbmdDb25maWdLZXlzLkNvdmVyYWdlVG9vbGJhckVuYWJsZWRdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlc3RpbmcuY292ZXJhZ2VUb29sYmFyRW5hYmxlZCcsICdDb250cm9scyB3aGV0aGVyIHRoZSBjb3ZlcmFnZSB0b29sYmFyIGlzIHNob3duIGluIHRoZSBlZGl0b3IuJyksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSwgLy8gdG9kb0Bjb25ub3I0MzEyOiBkaXNhYmxlZCBieSBkZWZhdWx0IHVudGlsIFVJIHN5bmNcblx0XHR9LFxuXHR9XG59O1xuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvbk1pZ3JhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb25NaWdyYXRpb24pXG5cdC5yZWdpc3RlckNvbmZpZ3VyYXRpb25NaWdyYXRpb25zKFt7XG5cdFx0a2V5OiAndGVzdGluZy5vcGVuVGVzdGluZycsXG5cdFx0bWlncmF0ZUZuOiAodmFsdWU6IEF1dG9PcGVuVGVzdGluZyk6IENvbmZpZ3VyYXRpb25LZXlWYWx1ZVBhaXJzID0+IHtcblx0XHRcdHJldHVybiBbW1Rlc3RpbmdDb25maWdLZXlzLk9wZW5SZXN1bHRzLCB7IHZhbHVlIH1dXTtcblx0XHR9XG5cdH0sIHtcblx0XHRrZXk6ICd0ZXN0aW5nLmF1dG9tYXRpY2FsbHlPcGVuUmVzdWx0cycsIC8vIGluc2lkZXJzIG9ubHkgZHVyaW5nIDEuOTYsIHJlbW92ZSBhZnRlciAxLjk3XG5cdFx0bWlncmF0ZUZuOiAodmFsdWU6IEF1dG9PcGVuVGVzdGluZyk6IENvbmZpZ3VyYXRpb25LZXlWYWx1ZVBhaXJzID0+IHtcblx0XHRcdHJldHVybiBbW1Rlc3RpbmdDb25maWdLZXlzLk9wZW5SZXN1bHRzLCB7IHZhbHVlIH1dXTtcblx0XHR9XG5cdH1dKTtcblxuZXhwb3J0IGludGVyZmFjZSBJVGVzdGluZ0NvdmVyYWdlQmFyVGhyZXNob2xkcyB7XG5cdHJlZDogbnVtYmVyO1xuXHRncmVlbjogbnVtYmVyO1xuXHR5ZWxsb3c6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGVzdGluZ0NvbmZpZ3VyYXRpb24ge1xuXHRbVGVzdGluZ0NvbmZpZ0tleXMuQXV0b09wZW5QZWVrVmlld106IEF1dG9PcGVuUGVla1ZpZXdXaGVuO1xuXHRbVGVzdGluZ0NvbmZpZ0tleXMuQXV0b09wZW5QZWVrVmlld0R1cmluZ0NvbnRpbnVvdXNSdW5dOiBib29sZWFuO1xuXHRbVGVzdGluZ0NvbmZpZ0tleXMuQ291bnRCYWRnZV06IFRlc3RpbmdDb3VudEJhZGdlO1xuXHRbVGVzdGluZ0NvbmZpZ0tleXMuRm9sbG93UnVubmluZ1Rlc3RdOiBib29sZWFuO1xuXHRbVGVzdGluZ0NvbmZpZ0tleXMuRGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uXTogRGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uO1xuXHRbVGVzdGluZ0NvbmZpZ0tleXMuR3V0dGVyRW5hYmxlZF06IGJvb2xlYW47XG5cdFtUZXN0aW5nQ29uZmlnS2V5cy5TYXZlQmVmb3JlVGVzdF06IGJvb2xlYW47XG5cdFtUZXN0aW5nQ29uZmlnS2V5cy5PcGVuUmVzdWx0c106IEF1dG9PcGVuVGVzdGluZztcblx0W1Rlc3RpbmdDb25maWdLZXlzLkFsd2F5c1JldmVhbFRlc3RPblN0YXRlQ2hhbmdlXTogYm9vbGVhbjtcblx0W1Rlc3RpbmdDb25maWdLZXlzLlNob3dBbGxNZXNzYWdlc106IGJvb2xlYW47XG5cdFtUZXN0aW5nQ29uZmlnS2V5cy5Db3ZlcmFnZVBlcmNlbnRdOiBUZXN0aW5nRGlzcGxheWVkQ292ZXJhZ2VQZXJjZW50O1xuXHRbVGVzdGluZ0NvbmZpZ0tleXMuU2hvd0NvdmVyYWdlSW5FeHBsb3Jlcl06IGJvb2xlYW47XG5cdFtUZXN0aW5nQ29uZmlnS2V5cy5Db3ZlcmFnZUJhclRocmVzaG9sZHNdOiBJVGVzdGluZ0NvdmVyYWdlQmFyVGhyZXNob2xkcztcblx0W1Rlc3RpbmdDb25maWdLZXlzLkNvdmVyYWdlVG9vbGJhckVuYWJsZWRdOiBib29sZWFuO1xufVxuXG5leHBvcnQgY29uc3QgZ2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24gPSA8SyBleHRlbmRzIFRlc3RpbmdDb25maWdLZXlzPihjb25maWc6IElDb25maWd1cmF0aW9uU2VydmljZSwga2V5OiBLKSA9PiBjb25maWcuZ2V0VmFsdWU8SVRlc3RpbmdDb25maWd1cmF0aW9uW0tdPihrZXkpO1xuXG5leHBvcnQgY29uc3Qgb2JzZXJ2ZVRlc3RpbmdDb25maWd1cmF0aW9uID0gPEsgZXh0ZW5kcyBUZXN0aW5nQ29uZmlnS2V5cz4oY29uZmlnOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsIGtleTogSykgPT4gb2JzZXJ2YWJsZUZyb21FdmVudChjb25maWcub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCAoKSA9PlxuXHRnZXRUZXN0aW5nQ29uZmlndXJhdGlvbihjb25maWcsIGtleSkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxnQkFBZ0I7QUFHekIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBcUMsa0JBQW1EO0FBRWpGLElBQVcsb0JBQVgsa0JBQVdBLHVCQUFYO0FBQ04sRUFBQUEsbUJBQUEsc0JBQW1CO0FBQ25CLEVBQUFBLG1CQUFBLHlDQUFzQztBQUN0QyxFQUFBQSxtQkFBQSxpQkFBYztBQUNkLEVBQUFBLG1CQUFBLHVCQUFvQjtBQUNwQixFQUFBQSxtQkFBQSw4QkFBMkI7QUFDM0IsRUFBQUEsbUJBQUEsbUJB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LEVBQ0Q7QUFDRDtBQUVBLFNBQVMsR0FBb0MsV0FBVyxzQkFBc0IsRUFDNUUsZ0NBQWdDLENBQUM7QUFBQSxFQUNqQyxLQUFLO0FBQUEsRUFDTCxXQUFXLENBQUMsVUFBdUQ7QUFDbEUsV0FBTyxDQUFDLENBQUMsMERBQStCLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFBQSxFQUNuRDtBQUNELEdBQUc7QUFBQSxFQUNGLEtBQUs7QUFBQTtBQUFBLEVBQ0wsV0FBVyxDQUFDLFVBQXVEO0FBQ2xFLFdBQU8sQ0FBQyxDQUFDLDBEQUErQixFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQUEsRUFDbkQ7QUFDRCxDQUFDLENBQUM7QUF5QkksTUFBTSwwQkFBMEIsQ0FBOEIsUUFBK0IsUUFBVyxPQUFPLFNBQW1DLEdBQUc7QUFFckosTUFBTSw4QkFBOEIsQ0FBOEIsUUFBK0IsUUFBVyxvQkFBb0IsT0FBTywwQkFBMEIsTUFDdkssd0JBQXdCLFFBQVEsR0FBRyxDQUFDOyIsCiAgIm5hbWVzIjogWyJUZXN0aW5nQ29uZmlnS2V5cyIsICJBdXRvT3BlblRlc3RpbmciLCAiQXV0b09wZW5QZWVrVmlld1doZW4iLCAiRGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uIiwgIlRlc3RpbmdDb3VudEJhZGdlIiwgIlRlc3RpbmdEaXNwbGF5ZWRDb3ZlcmFnZVBlcmNlbnQiXQp9Cg==
