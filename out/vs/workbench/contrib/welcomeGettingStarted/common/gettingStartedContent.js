import themePickerContent from "./media/theme_picker.js";
import notebookProfileContent from "./media/notebookProfile.js";
import { localize } from "../../../../nls.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { NotebookSetting } from "../../notebook/common/notebookCommon.js";
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from "../../../../platform/accessibility/common/accessibility.js";
import product from "../../../../platform/product/common/product.js";
class GettingStartedContentProviderRegistry {
  constructor() {
    this.providers = /* @__PURE__ */ new Map();
  }
  registerProvider(moduleId, provider) {
    this.providers.set(moduleId, provider);
  }
  getProvider(moduleId) {
    return this.providers.get(moduleId);
  }
}
const gettingStartedContentRegistry = new GettingStartedContentProviderRegistry();
async function moduleToContent(resource) {
  if (!resource.query) {
    throw new Error("Getting Started: invalid resource");
  }
  const query = JSON.parse(resource.query);
  if (!query.moduleId) {
    throw new Error("Getting Started: invalid resource");
  }
  const provider = gettingStartedContentRegistry.getProvider(query.moduleId);
  if (!provider) {
    throw new Error(`Getting Started: no provider registered for ${query.moduleId}`);
  }
  return provider();
}
gettingStartedContentRegistry.registerProvider("vs/workbench/contrib/welcomeGettingStarted/common/media/theme_picker", themePickerContent);
gettingStartedContentRegistry.registerProvider("vs/workbench/contrib/welcomeGettingStarted/common/media/notebookProfile", notebookProfileContent);
gettingStartedContentRegistry.registerProvider("vs/workbench/contrib/welcomeGettingStarted/common/media/empty", () => "");
const setupIcon = registerIcon("getting-started-setup", Codicon.zap, localize("getting-started-setup-icon", "Icon used for the setup category of welcome page"));
const beginnerIcon = registerIcon("getting-started-beginner", Codicon.lightbulb, localize("getting-started-beginner-icon", "Icon used for the beginner category of welcome page"));
const startEntries = [
  {
    id: "welcome.showNewFileEntries",
    title: localize("gettingStarted.newFile.title", "New File..."),
    description: localize("gettingStarted.newFile.description", "Open a new untitled text file, notebook, or custom editor."),
    icon: Codicon.newFile,
    content: {
      type: "startEntry",
      command: "command:welcome.showNewFileEntries"
    }
  },
  {
    id: "topLevelOpenMac",
    title: localize("gettingStarted.openMac.title", "Open..."),
    description: localize("gettingStarted.openMac.description", "Open a file or folder to start working"),
    icon: Codicon.folderOpened,
    when: "!isWeb && isMac",
    content: {
      type: "startEntry",
      command: "command:workbench.action.files.openFileFolder"
    }
  },
  {
    id: "topLevelOpenFile",
    title: localize("gettingStarted.openFile.title", "Open File..."),
    description: localize("gettingStarted.openFile.description", "Open a file to start working"),
    icon: Codicon.goToFile,
    when: "isWeb || !isMac",
    content: {
      type: "startEntry",
      command: "command:workbench.action.files.openFile"
    }
  },
  {
    id: "topLevelOpenFolder",
    title: localize("gettingStarted.openFolder.title", "Open Folder..."),
    description: localize("gettingStarted.openFolder.description", "Open a folder to start working"),
    icon: Codicon.folderOpened,
    when: "!isWeb && !isMac",
    content: {
      type: "startEntry",
      command: "command:workbench.action.files.openFolder"
    }
  },
  {
    id: "topLevelOpenFolderWeb",
    title: localize("gettingStarted.openFolder.title", "Open Folder..."),
    description: localize("gettingStarted.openFolder.description", "Open a folder to start working"),
    icon: Codicon.folderOpened,
    when: "!openFolderWorkspaceSupport && workbenchState == 'workspace'",
    content: {
      type: "startEntry",
      command: "command:workbench.action.files.openFolderViaWorkspace"
    }
  },
  {
    id: "topLevelGitClone",
    title: localize("gettingStarted.topLevelGitClone.title", "Clone Git Repository..."),
    description: localize("gettingStarted.topLevelGitClone.description", "Clone a remote repository to a local folder"),
    when: "config.git.enabled && !git.missing",
    icon: Codicon.sourceControl,
    content: {
      type: "startEntry",
      command: "command:git.clone"
    }
  },
  {
    id: "topLevelGitOpen",
    title: localize("gettingStarted.topLevelGitOpen.title", "Open Repository..."),
    description: localize("gettingStarted.topLevelGitOpen.description", "Connect to a remote repository or pull request to browse, search, edit, and commit"),
    when: "workspacePlatform == 'webworker'",
    icon: Codicon.sourceControl,
    content: {
      type: "startEntry",
      command: "command:remoteHub.openRepository"
    }
  },
  {
    id: "topLevelShowWalkthroughs",
    title: localize("gettingStarted.topLevelShowWalkthroughs.title", "Open a Walkthrough..."),
    description: localize("gettingStarted.topLevelShowWalkthroughs.description", "View a walkthrough on the editor or an extension"),
    icon: Codicon.checklist,
    when: "allWalkthroughsHidden",
    content: {
      type: "startEntry",
      command: "command:welcome.showAllWalkthroughs"
    }
  },
  {
    id: "topLevelRemoteOpen",
    title: localize("gettingStarted.topLevelRemoteOpen.title", "Connect to..."),
    description: localize("gettingStarted.topLevelRemoteOpen.description", "Connect to remote development workspaces."),
    when: "!isWeb",
    icon: Codicon.remote,
    content: {
      type: "startEntry",
      command: "command:workbench.action.remote.showMenu"
    }
  },
  {
    id: "topLevelOpenTunnel",
    title: localize("gettingStarted.topLevelOpenTunnel.title", "Open Tunnel..."),
    description: localize("gettingStarted.topLevelOpenTunnel.description", "Connect to a remote machine through a Tunnel"),
    when: "isWeb && showRemoteStartEntryInWeb",
    icon: Codicon.remote,
    content: {
      type: "startEntry",
      command: "command:workbench.action.remote.showWebStartEntryActions"
    }
  }
];
const Button = (title, href) => `[${title}](${href})`;
const CopilotStepTitle = localize("gettingStarted.copilotSetup.title", "Use AI features with Copilot for free");
const CopilotDescription = localize({ key: "gettingStarted.copilotSetup.description", comment: ['{Locked="["}', '{Locked="]({0})"}'] }, "You can use [Copilot]({0}) to generate code across multiple files, fix errors, ask questions about your code and much more using natural language.", product.defaultChatAgent?.documentationUrl ?? "");
const CopilotSignedOutButton = Button(localize("setupCopilotButton.signIn", "Set up Copilot"), `command:workbench.action.chat.triggerSetup`);
const CopilotSignedInButton = Button(localize("setupCopilotButton.setup", "Set up Copilot"), `command:workbench.action.chat.triggerSetup`);
const CopilotCompleteButton = Button(localize("setupCopilotButton.chatWithCopilot", "Chat with Copilot"), "command:workbench.action.chat.open");
function createCopilotSetupStep(id, button, when, includeTerms) {
  const description = includeTerms ? `${CopilotDescription}

${button}` : `${CopilotDescription}
${button}`;
  return {
    id,
    title: CopilotStepTitle,
    description,
    when,
    media: {
      type: "svg",
      altText: "VS Code Copilot multi file edits",
      path: "multi-file-edits.svg"
    }
  };
}
const walkthroughs = [
  {
    id: "Setup",
    title: localize("gettingStarted.setup.title", "Get Started with VS Code"),
    description: localize("gettingStarted.setup.description", "Customize your editor, learn the basics, and start coding"),
    isFeatured: true,
    icon: setupIcon,
    when: "!isWeb",
    walkthroughPageTitle: localize("gettingStarted.setup.walkthroughPageTitle", "Setup VS Code"),
    next: "Beginner",
    content: {
      type: "steps",
      steps: [
        createCopilotSetupStep("CopilotSetupSignedOut", CopilotSignedOutButton, "chatSetupSignedOut", true),
        createCopilotSetupStep("CopilotSetupComplete", CopilotCompleteButton, "chatSetupInstalled && (chatPlanPro || chatPlanLimited)", false),
        createCopilotSetupStep("CopilotSetupSignedIn", CopilotSignedInButton, "!chatSetupSignedOut && (!chatSetupInstalled || chatPlanCanSignUp)", true),
        {
          id: "pickColorTheme",
          title: localize("gettingStarted.pickColor.title", "Choose your theme"),
          description: localize("gettingStarted.pickColor.description.interpolated", "The right theme helps you focus on your code, is easy on your eyes, and is simply more fun to use.\n{0}", Button(localize("titleID", "Browse Color Themes"), "command:workbench.action.selectTheme")),
          completionEvents: [
            "onSettingChanged:workbench.colorTheme",
            "onCommand:workbench.action.selectTheme"
          ],
          media: { type: "markdown", path: "theme_picker" }
        },
        {
          id: "extensionsWeb",
          title: localize("gettingStarted.extensions.title", "Code with extensions"),
          description: localize("gettingStarted.extensionsWeb.description.interpolated", "Extensions are VS Code's power-ups. A growing number are becoming available in the web.\n{0}", Button(localize("browsePopularWeb", "Browse Popular Web Extensions"), "command:workbench.extensions.action.showPopularExtensions")),
          when: "workspacePlatform == 'webworker'",
          media: {
            type: "svg",
            altText: "VS Code extension marketplace with featured language extensions",
            path: "extensions-web.svg"
          }
        },
        {
          id: "findLanguageExtensions",
          title: localize("gettingStarted.findLanguageExts.title", "Rich support for all your languages"),
          description: localize("gettingStarted.findLanguageExts.description.interpolated", "Code smarter with syntax highlighting, code completion, linting and debugging. While many languages are built-in, many more can be added as extensions.\n{0}", Button(localize("browseLangExts", "Browse Language Extensions"), "command:workbench.extensions.action.showLanguageExtensions")),
          when: "workspacePlatform != 'webworker'",
          media: {
            type: "svg",
            altText: "Language extensions",
            path: "languages.svg"
          }
        },
        // Hidden in favor of copilot entry (to be revisited when copilot entry moves, if at all)
        // {
        // 	id: 'settings',
        // 	title: localize('gettingStarted.settings.title', "Tune your settings"),
        // 	description: localize('gettingStarted.settings.description.interpolated', "Customize every aspect of VS Code and your extensions to your liking. Commonly used settings are listed first to get you started.\n{0}", Button(localize('tweakSettings', "Open Settings"), 'command:toSide:workbench.action.openSettings')),
        // 	media: {
        // 		type: 'svg', altText: 'VS Code Settings', path: 'settings.svg'
        // 	},
        // },
        // {
        // 	id: 'settingsSync',
        // 	title: localize('gettingStarted.settingsSync.title', "Sync settings across devices"),
        // 	description: localize('gettingStarted.settingsSync.description.interpolated', "Keep your essential customizations backed up and updated across all your devices.\n{0}", Button(localize('enableSync', "Backup and Sync Settings"), 'command:workbench.userDataSync.actions.turnOn')),
        // 	when: 'syncStatus != uninitialized',
        // 	completionEvents: ['onEvent:sync-enabled'],
        // 	media: {
        // 		type: 'svg', altText: 'The "Turn on Sync" entry in the settings gear menu.', path: 'settingsSync.svg'
        // 	},
        // },
        {
          id: "settingsAndSync",
          title: localize("gettingStarted.settings.title", "Tune your settings"),
          description: localize("gettingStarted.settingsAndSync.description.interpolated", "Customize every aspect of VS Code and your extensions to your liking. [Back up and sync](command:workbench.userDataSync.actions.turnOn) your essential customizations across all your devices.\n{0}", Button(localize("tweakSettings", "Open Settings"), "command:toSide:workbench.action.openSettings")),
          when: "syncStatus != uninitialized",
          completionEvents: ["onEvent:sync-enabled"],
          media: {
            type: "svg",
            altText: "VS Code Settings",
            path: "settings.svg"
          }
        },
        {
          id: "commandPaletteTask",
          title: localize("gettingStarted.commandPalette.title", "Unlock productivity with the Command Palette "),
          description: localize("gettingStarted.commandPalette.description.interpolated", "Run commands without reaching for your mouse to accomplish any task in VS Code.\n{0}", Button(localize("commandPalette", "Open Command Palette"), "command:workbench.action.showCommands")),
          media: { type: "svg", altText: "Command Palette overlay for searching and executing commands.", path: "commandPalette.svg" }
        },
        // Hidden in favor of copilot entry (to be revisited when copilot entry moves, if at all)
        // {
        // 	id: 'pickAFolderTask-Mac',
        // 	title: localize('gettingStarted.setup.OpenFolder.title', "Open up your code"),
        // 	description: localize('gettingStarted.setup.OpenFolder.description.interpolated', "You're all set to start coding. Open a project folder to get your files into VS Code.\n{0}", Button(localize('pickFolder', "Pick a Folder"), 'command:workbench.action.files.openFileFolder')),
        // 	when: 'isMac && workspaceFolderCount == 0',
        // 	media: {
        // 		type: 'svg', altText: 'Explorer view showing buttons for opening folder and cloning repository.', path: 'openFolder.svg'
        // 	}
        // },
        // {
        // 	id: 'pickAFolderTask-Other',
        // 	title: localize('gettingStarted.setup.OpenFolder.title', "Open up your code"),
        // 	description: localize('gettingStarted.setup.OpenFolder.description.interpolated', "You're all set to start coding. Open a project folder to get your files into VS Code.\n{0}", Button(localize('pickFolder', "Pick a Folder"), 'command:workbench.action.files.openFolder')),
        // 	when: '!isMac && workspaceFolderCount == 0',
        // 	media: {
        // 		type: 'svg', altText: 'Explorer view showing buttons for opening folder and cloning repository.', path: 'openFolder.svg'
        // 	}
        // },
        {
          id: "quickOpen",
          title: localize("gettingStarted.quickOpen.title", "Quickly navigate between your files"),
          description: localize("gettingStarted.quickOpen.description.interpolated", "Navigate between files in an instant with one keystroke. Tip: Open multiple files by pressing the right arrow key.\n{0}", Button(localize("quickOpen", "Quick Open a File"), "command:toSide:workbench.action.quickOpen")),
          when: "workspaceFolderCount != 0",
          media: {
            type: "svg",
            altText: "Go to file in quick search.",
            path: "search.svg"
          }
        },
        {
          id: "videoTutorial",
          title: localize("gettingStarted.videoTutorial.title", "Watch video tutorials"),
          description: localize("gettingStarted.videoTutorial.description.interpolated", "Watch the first in a series of short & practical video tutorials for VS Code's key features.\n{0}", Button(localize("watch", "Watch Tutorial"), "https://aka.ms/vscode-getting-started-video")),
          media: { type: "svg", altText: "VS Code Settings", path: "learn.svg" }
        }
      ]
    }
  },
  {
    id: "SetupWeb",
    title: localize("gettingStarted.setupWeb.title", "Get Started with VS Code for the Web"),
    description: localize("gettingStarted.setupWeb.description", "Customize your editor, learn the basics, and start coding"),
    isFeatured: true,
    icon: setupIcon,
    when: "isWeb",
    next: "Beginner",
    walkthroughPageTitle: localize("gettingStarted.setupWeb.walkthroughPageTitle", "Setup VS Code Web"),
    content: {
      type: "steps",
      steps: [
        {
          id: "pickColorThemeWeb",
          title: localize("gettingStarted.pickColor.title", "Choose your theme"),
          description: localize("gettingStarted.pickColor.description.interpolated", "The right theme helps you focus on your code, is easy on your eyes, and is simply more fun to use.\n{0}", Button(localize("titleID", "Browse Color Themes"), "command:workbench.action.selectTheme")),
          completionEvents: [
            "onSettingChanged:workbench.colorTheme",
            "onCommand:workbench.action.selectTheme"
          ],
          media: { type: "markdown", path: "theme_picker" }
        },
        {
          id: "menuBarWeb",
          title: localize("gettingStarted.menuBar.title", "Just the right amount of UI"),
          description: localize("gettingStarted.menuBar.description.interpolated", "The full menu bar is available in the dropdown menu to make room for your code. Toggle its appearance for faster access. \n{0}", Button(localize("toggleMenuBar", "Toggle Menu Bar"), "command:workbench.action.toggleMenuBar")),
          when: "isWeb",
          media: {
            type: "svg",
            altText: "Comparing menu dropdown with the visible menu bar.",
            path: "menuBar.svg"
          }
        },
        {
          id: "extensionsWebWeb",
          title: localize("gettingStarted.extensions.title", "Code with extensions"),
          description: localize("gettingStarted.extensionsWeb.description.interpolated", "Extensions are VS Code's power-ups. A growing number are becoming available in the web.\n{0}", Button(localize("browsePopularWeb", "Browse Popular Web Extensions"), "command:workbench.extensions.action.showPopularExtensions")),
          when: "workspacePlatform == 'webworker'",
          media: {
            type: "svg",
            altText: "VS Code extension marketplace with featured language extensions",
            path: "extensions-web.svg"
          }
        },
        {
          id: "findLanguageExtensionsWeb",
          title: localize("gettingStarted.findLanguageExts.title", "Rich support for all your languages"),
          description: localize("gettingStarted.findLanguageExts.description.interpolated", "Code smarter with syntax highlighting, code completion, linting and debugging. While many languages are built-in, many more can be added as extensions.\n{0}", Button(localize("browseLangExts", "Browse Language Extensions"), "command:workbench.extensions.action.showLanguageExtensions")),
          when: "workspacePlatform != 'webworker'",
          media: {
            type: "svg",
            altText: "Language extensions",
            path: "languages.svg"
          }
        },
        {
          id: "settingsSyncWeb",
          title: localize("gettingStarted.settingsSync.title", "Sync settings across devices"),
          description: localize("gettingStarted.settingsSync.description.interpolated", "Keep your essential customizations backed up and updated across all your devices.\n{0}", Button(localize("enableSync", "Backup and Sync Settings"), "command:workbench.userDataSync.actions.turnOn")),
          when: "syncStatus != uninitialized",
          completionEvents: ["onEvent:sync-enabled"],
          media: {
            type: "svg",
            altText: 'The "Turn on Sync" entry in the settings gear menu.',
            path: "settingsSync.svg"
          }
        },
        {
          id: "commandPaletteTaskWeb",
          title: localize("gettingStarted.commandPalette.title", "Unlock productivity with the Command Palette "),
          description: localize("gettingStarted.commandPalette.description.interpolated", "Run commands without reaching for your mouse to accomplish any task in VS Code.\n{0}", Button(localize("commandPalette", "Open Command Palette"), "command:workbench.action.showCommands")),
          media: { type: "svg", altText: "Command Palette overlay for searching and executing commands.", path: "commandPalette.svg" }
        },
        {
          id: "pickAFolderTask-WebWeb",
          title: localize("gettingStarted.setup.OpenFolder.title", "Open up your code"),
          description: localize("gettingStarted.setup.OpenFolderWeb.description.interpolated", "You're all set to start coding. You can open a local project or a remote repository to get your files into VS Code.\n{0}\n{1}", Button(localize("openFolder", "Open Folder"), "command:workbench.action.addRootFolder"), Button(localize("openRepository", "Open Repository"), "command:remoteHub.openRepository")),
          when: "workspaceFolderCount == 0",
          media: {
            type: "svg",
            altText: "Explorer view showing buttons for opening folder and cloning repository.",
            path: "openFolder.svg"
          }
        },
        {
          id: "quickOpenWeb",
          title: localize("gettingStarted.quickOpen.title", "Quickly navigate between your files"),
          description: localize("gettingStarted.quickOpen.description.interpolated", "Navigate between files in an instant with one keystroke. Tip: Open multiple files by pressing the right arrow key.\n{0}", Button(localize("quickOpen", "Quick Open a File"), "command:toSide:workbench.action.quickOpen")),
          when: "workspaceFolderCount != 0",
          media: {
            type: "svg",
            altText: "Go to file in quick search.",
            path: "search.svg"
          }
        }
      ]
    }
  },
  {
    id: "SetupAccessibility",
    title: localize("gettingStarted.setupAccessibility.title", "Get Started with Accessibility Features"),
    description: localize("gettingStarted.setupAccessibility.description", "Learn the tools and shortcuts that make VS Code accessible. Note that some actions are not actionable from within the context of the walkthrough."),
    isFeatured: true,
    icon: setupIcon,
    when: CONTEXT_ACCESSIBILITY_MODE_ENABLED.key,
    next: "Setup",
    walkthroughPageTitle: localize("gettingStarted.setupAccessibility.walkthroughPageTitle", "Setup VS Code Accessibility"),
    content: {
      type: "steps",
      steps: [
        {
          id: "accessibilityHelp",
          title: localize("gettingStarted.accessibilityHelp.title", "Use the accessibility help dialog to learn about features"),
          description: localize("gettingStarted.accessibilityHelp.description.interpolated", "The accessibility help dialog provides information about what to expect from a feature and the commands/keybindings to operate them.\n With focus in an editor, terminal, notebook, chat response, comment, or debug console, the relevant dialog can be opened with the Open Accessibility Help command.\n{0}", Button(localize("openAccessibilityHelp", "Open Accessibility Help"), "command:editor.action.accessibilityHelp")),
          media: {
            type: "markdown",
            path: "empty"
          }
        },
        {
          id: "accessibleView",
          title: localize("gettingStarted.accessibleView.title", "Screen reader users can inspect content line by line, character by character in the accessible view."),
          description: localize("gettingStarted.accessibleView.description.interpolated", "The accessible view is available for the terminal, hovers, notifications, comments, notebook output, chat responses, inline completions, and debug console output.\n With focus in any of those features, it can be opened with the Open Accessible View command.\n{0}", Button(localize("openAccessibleView", "Open Accessible View"), "command:editor.action.accessibleView")),
          media: {
            type: "markdown",
            path: "empty"
          }
        },
        {
          id: "verbositySettings",
          title: localize("gettingStarted.verbositySettings.title", "Control the verbosity of aria labels"),
          description: localize("gettingStarted.verbositySettings.description.interpolated", "Screen reader verbosity settings exist for features around the workbench so that once a user is familiar with a feature, they can avoid hearing hints about how to operate it. For example, features for which an accessibility help dialog exists will indicate how to open the dialog until the verbosity setting for that feature has been disabled.\n These and other accessibility settings can be configured by running the Open Accessibility Settings command.\n{0}", Button(localize("openVerbositySettings", "Open Accessibility Settings"), "command:workbench.action.openAccessibilitySettings")),
          media: {
            type: "markdown",
            path: "empty"
          }
        },
        {
          id: "commandPaletteTaskAccessibility",
          title: localize("gettingStarted.commandPaletteAccessibility.title", "Unlock productivity with the Command Palette "),
          description: localize("gettingStarted.commandPaletteAccessibility.description.interpolated", "Run commands without reaching for your mouse to accomplish any task in VS Code.\n{0}", Button(localize("commandPalette", "Open Command Palette"), "command:workbench.action.showCommands")),
          media: { type: "markdown", path: "empty" }
        },
        {
          id: "keybindingsAccessibility",
          title: localize("gettingStarted.keyboardShortcuts.title", "Customize your keyboard shortcuts"),
          description: localize("gettingStarted.keyboardShortcuts.description.interpolated", "Once you have discovered your favorite commands, create custom keyboard shortcuts for instant access.\n{0}", Button(localize("keyboardShortcuts", "Keyboard Shortcuts"), "command:toSide:workbench.action.openGlobalKeybindings")),
          media: {
            type: "markdown",
            path: "empty"
          }
        },
        {
          id: "accessibilitySignals",
          title: localize("gettingStarted.accessibilitySignals.title", "Fine tune which accessibility signals you want to receive via audio or a braille device"),
          description: localize("gettingStarted.accessibilitySignals.description.interpolated", "Accessibility sounds and announcements are played around the workbench for different events.\n These can be discovered and configured using the List Signal Sounds and List Signal Announcements commands.\n{0}\n{1}", Button(localize("listSignalSounds", "List Signal Sounds"), "command:signals.sounds.help"), Button(localize("listSignalAnnouncements", "List Signal Announcements"), "command:accessibility.announcement.help")),
          media: {
            type: "markdown",
            path: "empty"
          }
        },
        {
          id: "hover",
          title: localize("gettingStarted.hover.title", "Access the hover in the editor to get more information on a variable or symbol"),
          description: localize("gettingStarted.hover.description.interpolated", "While focus is in the editor on a variable or symbol, a hover can be can be focused with the Show or Open Hover command.\n{0}", Button(localize("showOrFocusHover", "Show or Focus Hover"), "command:editor.action.showHover")),
          media: {
            type: "markdown",
            path: "empty"
          }
        },
        {
          id: "goToSymbol",
          title: localize("gettingStarted.goToSymbol.title", "Navigate to symbols in a file"),
          description: localize("gettingStarted.goToSymbol.description.interpolated", "The Go to Symbol command is useful for navigating between important landmarks in a document.\n{0}", Button(localize("openGoToSymbol", "Go to Symbol"), "command:editor.action.goToSymbol")),
          media: {
            type: "markdown",
            path: "empty"
          }
        },
        {
          id: "codeFolding",
          title: localize("gettingStarted.codeFolding.title", "Use code folding to collapse blocks of code and focus on the code you're interested in."),
          description: localize("gettingStarted.codeFolding.description.interpolated", "Fold or unfold a code section with the Toggle Fold command.\n{0}\n Fold or unfold recursively with the Toggle Fold Recursively Command\n{1}\n", Button(localize("toggleFold", "Toggle Fold"), "command:editor.toggleFold"), Button(localize("toggleFoldRecursively", "Toggle Fold Recursively"), "command:editor.toggleFoldRecursively")),
          media: {
            type: "markdown",
            path: "empty"
          }
        },
        {
          id: "intellisense",
          title: localize("gettingStarted.intellisense.title", "Use Intellisense to improve coding efficiency"),
          description: localize("gettingStarted.intellisense.description.interpolated", "Intellisense suggestions can be opened with the Trigger Intellisense command.\n{0}\n Inline intellisense suggestions can be triggered with Trigger Inline Suggestion\n{1}\n Useful settings include editor.inlineCompletionsAccessibilityVerbose and editor.screenReaderAnnounceInlineSuggestion.", Button(localize("triggerIntellisense", "Trigger Intellisense"), "command:editor.action.triggerSuggest"), Button(localize("triggerInlineSuggestion", "Trigger Inline Suggestion"), "command:editor.action.inlineSuggest.trigger")),
          media: {
            type: "markdown",
            path: "empty"
          }
        },
        {
          id: "accessibilitySettings",
          title: localize("gettingStarted.accessibilitySettings.title", "Configure accessibility settings"),
          description: localize("gettingStarted.accessibilitySettings.description.interpolated", "Accessibility settings can be configured by running the Open Accessibility Settings command.\n{0}", Button(localize("openAccessibilitySettings", "Open Accessibility Settings"), "command:workbench.action.openAccessibilitySettings")),
          media: { type: "markdown", path: "empty" }
        }
      ]
    }
  },
  {
    id: "Beginner",
    isFeatured: false,
    title: localize("gettingStarted.beginner.title", "Learn the Fundamentals"),
    icon: beginnerIcon,
    description: localize("gettingStarted.beginner.description", "Get an overview of the most essential features"),
    walkthroughPageTitle: localize("gettingStarted.beginner.walkthroughPageTitle", "Essential Features"),
    content: {
      type: "steps",
      steps: [
        {
          id: "extensions",
          title: localize("gettingStarted.extensions.title", "Code with extensions"),
          description: localize("gettingStarted.extensions.description.interpolated", "Extensions are VS Code's power-ups. They range from handy productivity hacks, expanding out-of-the-box features, to adding completely new capabilities.\n{0}", Button(localize("browsePopular", "Browse Popular Extensions"), "command:workbench.extensions.action.showPopularExtensions")),
          when: "workspacePlatform != 'webworker'",
          media: {
            type: "svg",
            altText: "VS Code extension marketplace with featured language extensions",
            path: "extensions.svg"
          }
        },
        {
          id: "terminal",
          title: localize("gettingStarted.terminal.title", "Built-in terminal"),
          description: localize("gettingStarted.terminal.description.interpolated", "Quickly run shell commands and monitor build output, right next to your code.\n{0}", Button(localize("showTerminal", "Open Terminal"), "command:workbench.action.terminal.toggleTerminal")),
          when: "workspacePlatform != 'webworker' && remoteName != codespaces && !terminalIsOpen",
          media: {
            type: "svg",
            altText: "Integrated terminal running a few npm commands",
            path: "terminal.svg"
          }
        },
        {
          id: "debugging",
          title: localize("gettingStarted.debug.title", "Watch your code in action"),
          description: localize("gettingStarted.debug.description.interpolated", "Accelerate your edit, build, test, and debug loop by setting up a launch configuration.\n{0}", Button(localize("runProject", "Run your Project"), "command:workbench.action.debug.selectandstart")),
          when: "workspacePlatform != 'webworker' && workspaceFolderCount != 0",
          media: {
            type: "svg",
            altText: "Run and debug view.",
            path: "debug.svg"
          }
        },
        {
          id: "scmClone",
          title: localize("gettingStarted.scm.title", "Track your code with Git"),
          description: localize("gettingStarted.scmClone.description.interpolated", "Set up the built-in version control for your project to track your changes and collaborate with others.\n{0}", Button(localize("cloneRepo", "Clone Repository"), "command:git.clone")),
          when: "config.git.enabled && !git.missing && workspaceFolderCount == 0",
          media: {
            type: "svg",
            altText: "Source Control view.",
            path: "git.svg"
          }
        },
        {
          id: "scmSetup",
          title: localize("gettingStarted.scm.title", "Track your code with Git"),
          description: localize("gettingStarted.scmSetup.description.interpolated", "Set up the built-in version control for your project to track your changes and collaborate with others.\n{0}", Button(localize("initRepo", "Initialize Git Repository"), "command:git.init")),
          when: "config.git.enabled && !git.missing && workspaceFolderCount != 0 && gitOpenRepositoryCount == 0",
          media: {
            type: "svg",
            altText: "Source Control view.",
            path: "git.svg"
          }
        },
        {
          id: "scm",
          title: localize("gettingStarted.scm.title", "Track your code with Git"),
          description: localize("gettingStarted.scm.description.interpolated", "No more looking up Git commands! Git and GitHub workflows are seamlessly integrated.\n{0}", Button(localize("openSCM", "Open Source Control"), "command:workbench.view.scm")),
          when: "config.git.enabled && !git.missing && workspaceFolderCount != 0 && gitOpenRepositoryCount != 0 && activeViewlet != 'workbench.view.scm'",
          media: {
            type: "svg",
            altText: "Source Control view.",
            path: "git.svg"
          }
        },
        {
          id: "installGit",
          title: localize("gettingStarted.installGit.title", "Install Git"),
          description: localize({ key: "gettingStarted.installGit.description.interpolated", comment: ["The placeholders are command link items should not be translated"] }, "Install Git to track changes in your projects.\n{0}\n{1}Reload window{2} after installation to complete Git setup.", Button(localize("installGit", "Install Git"), "https://aka.ms/vscode-install-git"), "[", "](command:workbench.action.reloadWindow)"),
          when: "git.missing",
          media: {
            type: "svg",
            altText: "Install Git.",
            path: "git.svg"
          },
          completionEvents: [
            "onContext:git.state == initialized"
          ]
        },
        {
          id: "tasks",
          title: localize("gettingStarted.tasks.title", "Automate your project tasks"),
          when: "workspaceFolderCount != 0 && workspacePlatform != 'webworker'",
          description: localize("gettingStarted.tasks.description.interpolated", "Create tasks for your common workflows and enjoy the integrated experience of running scripts and automatically checking results.\n{0}", Button(localize("runTasks", "Run Auto-detected Tasks"), "command:workbench.action.tasks.runTask")),
          media: {
            type: "svg",
            altText: "Task runner.",
            path: "runTask.svg"
          }
        },
        {
          id: "shortcuts",
          title: localize("gettingStarted.shortcuts.title", "Customize your shortcuts"),
          description: localize("gettingStarted.shortcuts.description.interpolated", "Once you have discovered your favorite commands, create custom keyboard shortcuts for instant access.\n{0}", Button(localize("keyboardShortcuts", "Keyboard Shortcuts"), "command:toSide:workbench.action.openGlobalKeybindings")),
          media: {
            type: "svg",
            altText: "Interactive shortcuts.",
            path: "shortcuts.svg"
          }
        },
        {
          id: "workspaceTrust",
          title: localize("gettingStarted.workspaceTrust.title", "Safely browse and edit code"),
          description: localize("gettingStarted.workspaceTrust.description.interpolated", "{0} lets you decide whether your project folders should **allow or restrict** automatic code execution __(required for extensions, debugging, etc)__.\nOpening a file/folder will prompt to grant trust. You can always {1} later.", Button(localize("workspaceTrust", "Workspace Trust"), "https://code.visualstudio.com/docs/editor/workspace-trust"), Button(localize("enableTrust", "enable trust"), "command:toSide:workbench.trust.manage")),
          when: "workspacePlatform != 'webworker' && !isWorkspaceTrusted && workspaceFolderCount == 0",
          media: {
            type: "svg",
            altText: "Workspace Trust editor in Restricted mode and a primary button for switching to Trusted mode.",
            path: "workspaceTrust.svg"
          }
        }
      ]
    }
  },
  {
    id: "notebooks",
    title: localize("gettingStarted.notebook.title", "Customize Notebooks"),
    description: "",
    icon: setupIcon,
    isFeatured: false,
    when: `config.${NotebookSetting.openGettingStarted} && userHasOpenedNotebook`,
    walkthroughPageTitle: localize("gettingStarted.notebook.walkthroughPageTitle", "Notebooks"),
    content: {
      type: "steps",
      steps: [
        {
          completionEvents: ["onCommand:notebook.setProfile"],
          id: "notebookProfile",
          title: localize("gettingStarted.notebookProfile.title", "Select the layout for your notebooks"),
          description: localize("gettingStarted.notebookProfile.description", "Get notebooks to feel just the way you prefer"),
          when: "userHasOpenedNotebook",
          media: {
            type: "markdown",
            path: "notebookProfile"
          }
        }
      ]
    }
  }
];
export {
  gettingStartedContentRegistry,
  moduleToContent,
  startEntries,
  walkthroughs
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lR2V0dGluZ1N0YXJ0ZWQvY29tbW9uL2dldHRpbmdTdGFydGVkQ29udGVudC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB0aGVtZVBpY2tlckNvbnRlbnQgZnJvbSAnLi9tZWRpYS90aGVtZV9waWNrZXIuanMnO1xuaW1wb3J0IG5vdGVib29rUHJvZmlsZUNvbnRlbnQgZnJvbSAnLi9tZWRpYS9ub3RlYm9va1Byb2ZpbGUuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlckljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IE5vdGVib29rU2V0dGluZyB9IGZyb20gJy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBDT05URVhUX0FDQ0VTU0lCSUxJVFlfTU9ERV9FTkFCTEVEIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHByb2R1Y3QgZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdC5qcyc7XG5cbmludGVyZmFjZSBJR2V0dGluZ1N0YXJ0ZWRDb250ZW50UHJvdmlkZXIge1xuXHQoKTogc3RyaW5nO1xufVxuXG5jbGFzcyBHZXR0aW5nU3RhcnRlZENvbnRlbnRQcm92aWRlclJlZ2lzdHJ5IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHByb3ZpZGVycyA9IG5ldyBNYXA8c3RyaW5nLCBJR2V0dGluZ1N0YXJ0ZWRDb250ZW50UHJvdmlkZXI+KCk7XG5cblx0cmVnaXN0ZXJQcm92aWRlcihtb2R1bGVJZDogc3RyaW5nLCBwcm92aWRlcjogSUdldHRpbmdTdGFydGVkQ29udGVudFByb3ZpZGVyKTogdm9pZCB7XG5cdFx0dGhpcy5wcm92aWRlcnMuc2V0KG1vZHVsZUlkLCBwcm92aWRlcik7XG5cdH1cblxuXHRnZXRQcm92aWRlcihtb2R1bGVJZDogc3RyaW5nKTogSUdldHRpbmdTdGFydGVkQ29udGVudFByb3ZpZGVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5wcm92aWRlcnMuZ2V0KG1vZHVsZUlkKTtcblx0fVxufVxuZXhwb3J0IGNvbnN0IGdldHRpbmdTdGFydGVkQ29udGVudFJlZ2lzdHJ5ID0gbmV3IEdldHRpbmdTdGFydGVkQ29udGVudFByb3ZpZGVyUmVnaXN0cnkoKTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1vZHVsZVRvQ29udGVudChyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0aWYgKCFyZXNvdXJjZS5xdWVyeSkge1xuXHRcdHRocm93IG5ldyBFcnJvcignR2V0dGluZyBTdGFydGVkOiBpbnZhbGlkIHJlc291cmNlJyk7XG5cdH1cblxuXHRjb25zdCBxdWVyeSA9IEpTT04ucGFyc2UocmVzb3VyY2UucXVlcnkpO1xuXHRpZiAoIXF1ZXJ5Lm1vZHVsZUlkKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdHZXR0aW5nIFN0YXJ0ZWQ6IGludmFsaWQgcmVzb3VyY2UnKTtcblx0fVxuXG5cdGNvbnN0IHByb3ZpZGVyID0gZ2V0dGluZ1N0YXJ0ZWRDb250ZW50UmVnaXN0cnkuZ2V0UHJvdmlkZXIocXVlcnkubW9kdWxlSWQpO1xuXHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBHZXR0aW5nIFN0YXJ0ZWQ6IG5vIHByb3ZpZGVyIHJlZ2lzdGVyZWQgZm9yICR7cXVlcnkubW9kdWxlSWR9YCk7XG5cdH1cblxuXHRyZXR1cm4gcHJvdmlkZXIoKTtcbn1cblxuZ2V0dGluZ1N0YXJ0ZWRDb250ZW50UmVnaXN0cnkucmVnaXN0ZXJQcm92aWRlcigndnMvd29ya2JlbmNoL2NvbnRyaWIvd2VsY29tZUdldHRpbmdTdGFydGVkL2NvbW1vbi9tZWRpYS90aGVtZV9waWNrZXInLCB0aGVtZVBpY2tlckNvbnRlbnQpO1xuZ2V0dGluZ1N0YXJ0ZWRDb250ZW50UmVnaXN0cnkucmVnaXN0ZXJQcm92aWRlcigndnMvd29ya2JlbmNoL2NvbnRyaWIvd2VsY29tZUdldHRpbmdTdGFydGVkL2NvbW1vbi9tZWRpYS9ub3RlYm9va1Byb2ZpbGUnLCBub3RlYm9va1Byb2ZpbGVDb250ZW50KTtcbi8vIFJlZ2lzdGVyIGVtcHR5IG1lZGlhIGZvciBhY2Nlc3NpYmlsaXR5IHdhbGt0aHJvdWdoXG5nZXR0aW5nU3RhcnRlZENvbnRlbnRSZWdpc3RyeS5yZWdpc3RlclByb3ZpZGVyKCd2cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lR2V0dGluZ1N0YXJ0ZWQvY29tbW9uL21lZGlhL2VtcHR5JywgKCkgPT4gJycpO1xuXG5jb25zdCBzZXR1cEljb24gPSByZWdpc3Rlckljb24oJ2dldHRpbmctc3RhcnRlZC1zZXR1cCcsIENvZGljb24uemFwLCBsb2NhbGl6ZSgnZ2V0dGluZy1zdGFydGVkLXNldHVwLWljb24nLCBcIkljb24gdXNlZCBmb3IgdGhlIHNldHVwIGNhdGVnb3J5IG9mIHdlbGNvbWUgcGFnZVwiKSk7XG5jb25zdCBiZWdpbm5lckljb24gPSByZWdpc3Rlckljb24oJ2dldHRpbmctc3RhcnRlZC1iZWdpbm5lcicsIENvZGljb24ubGlnaHRidWxiLCBsb2NhbGl6ZSgnZ2V0dGluZy1zdGFydGVkLWJlZ2lubmVyLWljb24nLCBcIkljb24gdXNlZCBmb3IgdGhlIGJlZ2lubmVyIGNhdGVnb3J5IG9mIHdlbGNvbWUgcGFnZVwiKSk7XG5cbmV4cG9ydCB0eXBlIEJ1aWx0aW5HZXR0aW5nU3RhcnRlZFN0ZXAgPSB7XG5cdGlkOiBzdHJpbmc7XG5cdHRpdGxlOiBzdHJpbmc7XG5cdGRlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdGNvbXBsZXRpb25FdmVudHM/OiBzdHJpbmdbXTtcblx0d2hlbj86IHN0cmluZztcblx0bWVkaWE6XG5cdHwgeyB0eXBlOiAnaW1hZ2UnOyBwYXRoOiBzdHJpbmcgfCB7IGhjOiBzdHJpbmc7IGhjTGlnaHQ/OiBzdHJpbmc7IGxpZ2h0OiBzdHJpbmc7IGRhcms6IHN0cmluZyB9OyBhbHRUZXh0OiBzdHJpbmcgfVxuXHR8IHsgdHlwZTogJ3N2Zyc7IHBhdGg6IHN0cmluZzsgYWx0VGV4dDogc3RyaW5nIH1cblx0fCB7IHR5cGU6ICdtYXJrZG93bic7IHBhdGg6IHN0cmluZyB9XG5cdHwgeyB0eXBlOiAndmlkZW8nOyBwYXRoOiBzdHJpbmcgfCB7IGhjOiBzdHJpbmc7IGhjTGlnaHQ/OiBzdHJpbmc7IGxpZ2h0OiBzdHJpbmc7IGRhcms6IHN0cmluZyB9OyBwb3N0ZXI/OiBzdHJpbmcgfCB7IGhjOiBzdHJpbmc7IGhjTGlnaHQ/OiBzdHJpbmc7IGxpZ2h0OiBzdHJpbmc7IGRhcms6IHN0cmluZyB9OyBhbHRUZXh0OiBzdHJpbmcgfTtcbn07XG5cbmV4cG9ydCB0eXBlIEJ1aWx0aW5HZXR0aW5nU3RhcnRlZENhdGVnb3J5ID0ge1xuXHRpZDogc3RyaW5nO1xuXHR0aXRsZTogc3RyaW5nO1xuXHRkZXNjcmlwdGlvbjogc3RyaW5nO1xuXHRpc0ZlYXR1cmVkOiBib29sZWFuO1xuXHRuZXh0Pzogc3RyaW5nO1xuXHRpY29uOiBUaGVtZUljb247XG5cdHdoZW4/OiBzdHJpbmc7XG5cdGNvbnRlbnQ6XG5cdHwgeyB0eXBlOiAnc3RlcHMnOyBzdGVwczogQnVpbHRpbkdldHRpbmdTdGFydGVkU3RlcFtdIH07XG5cdHdhbGt0aHJvdWdoUGFnZVRpdGxlOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgdHlwZSBCdWlsdGluR2V0dGluZ1N0YXJ0ZWRTdGFydEVudHJ5ID0ge1xuXHRpZDogc3RyaW5nO1xuXHR0aXRsZTogc3RyaW5nO1xuXHRkZXNjcmlwdGlvbjogc3RyaW5nO1xuXHRpY29uOiBUaGVtZUljb247XG5cdHdoZW4/OiBzdHJpbmc7XG5cdGNvbnRlbnQ6XG5cdHwgeyB0eXBlOiAnc3RhcnRFbnRyeSc7IGNvbW1hbmQ6IHN0cmluZyB9O1xufTtcblxudHlwZSBHZXR0aW5nU3RhcnRlZFdhbGt0aHJvdWdoQ29udGVudCA9IEJ1aWx0aW5HZXR0aW5nU3RhcnRlZENhdGVnb3J5W107XG50eXBlIEdldHRpbmdTdGFydGVkU3RhcnRFbnRyeUNvbnRlbnQgPSBCdWlsdGluR2V0dGluZ1N0YXJ0ZWRTdGFydEVudHJ5W107XG5cbmV4cG9ydCBjb25zdCBzdGFydEVudHJpZXM6IEdldHRpbmdTdGFydGVkU3RhcnRFbnRyeUNvbnRlbnQgPSBbXG5cdHtcblx0XHRpZDogJ3dlbGNvbWUuc2hvd05ld0ZpbGVFbnRyaWVzJyxcblx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLm5ld0ZpbGUudGl0bGUnLCBcIk5ldyBGaWxlLi4uXCIpLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQubmV3RmlsZS5kZXNjcmlwdGlvbicsIFwiT3BlbiBhIG5ldyB1bnRpdGxlZCB0ZXh0IGZpbGUsIG5vdGVib29rLCBvciBjdXN0b20gZWRpdG9yLlwiKSxcblx0XHRpY29uOiBDb2RpY29uLm5ld0ZpbGUsXG5cdFx0Y29udGVudDoge1xuXHRcdFx0dHlwZTogJ3N0YXJ0RW50cnknLFxuXHRcdFx0Y29tbWFuZDogJ2NvbW1hbmQ6d2VsY29tZS5zaG93TmV3RmlsZUVudHJpZXMnLFxuXHRcdH1cblx0fSxcblx0e1xuXHRcdGlkOiAndG9wTGV2ZWxPcGVuTWFjJyxcblx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLm9wZW5NYWMudGl0bGUnLCBcIk9wZW4uLi5cIiksXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5vcGVuTWFjLmRlc2NyaXB0aW9uJywgXCJPcGVuIGEgZmlsZSBvciBmb2xkZXIgdG8gc3RhcnQgd29ya2luZ1wiKSxcblx0XHRpY29uOiBDb2RpY29uLmZvbGRlck9wZW5lZCxcblx0XHR3aGVuOiAnIWlzV2ViICYmIGlzTWFjJyxcblx0XHRjb250ZW50OiB7XG5cdFx0XHR0eXBlOiAnc3RhcnRFbnRyeScsXG5cdFx0XHRjb21tYW5kOiAnY29tbWFuZDp3b3JrYmVuY2guYWN0aW9uLmZpbGVzLm9wZW5GaWxlRm9sZGVyJyxcblx0XHR9XG5cdH0sXG5cdHtcblx0XHRpZDogJ3RvcExldmVsT3BlbkZpbGUnLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQub3BlbkZpbGUudGl0bGUnLCBcIk9wZW4gRmlsZS4uLlwiKSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLm9wZW5GaWxlLmRlc2NyaXB0aW9uJywgXCJPcGVuIGEgZmlsZSB0byBzdGFydCB3b3JraW5nXCIpLFxuXHRcdGljb246IENvZGljb24uZ29Ub0ZpbGUsXG5cdFx0d2hlbjogJ2lzV2ViIHx8ICFpc01hYycsXG5cdFx0Y29udGVudDoge1xuXHRcdFx0dHlwZTogJ3N0YXJ0RW50cnknLFxuXHRcdFx0Y29tbWFuZDogJ2NvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi5maWxlcy5vcGVuRmlsZScsXG5cdFx0fVxuXHR9LFxuXHR7XG5cdFx0aWQ6ICd0b3BMZXZlbE9wZW5Gb2xkZXInLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQub3BlbkZvbGRlci50aXRsZScsIFwiT3BlbiBGb2xkZXIuLi5cIiksXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5vcGVuRm9sZGVyLmRlc2NyaXB0aW9uJywgXCJPcGVuIGEgZm9sZGVyIHRvIHN0YXJ0IHdvcmtpbmdcIiksXG5cdFx0aWNvbjogQ29kaWNvbi5mb2xkZXJPcGVuZWQsXG5cdFx0d2hlbjogJyFpc1dlYiAmJiAhaXNNYWMnLFxuXHRcdGNvbnRlbnQ6IHtcblx0XHRcdHR5cGU6ICdzdGFydEVudHJ5Jyxcblx0XHRcdGNvbW1hbmQ6ICdjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24uZmlsZXMub3BlbkZvbGRlcicsXG5cdFx0fVxuXHR9LFxuXHR7XG5cdFx0aWQ6ICd0b3BMZXZlbE9wZW5Gb2xkZXJXZWInLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQub3BlbkZvbGRlci50aXRsZScsIFwiT3BlbiBGb2xkZXIuLi5cIiksXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5vcGVuRm9sZGVyLmRlc2NyaXB0aW9uJywgXCJPcGVuIGEgZm9sZGVyIHRvIHN0YXJ0IHdvcmtpbmdcIiksXG5cdFx0aWNvbjogQ29kaWNvbi5mb2xkZXJPcGVuZWQsXG5cdFx0d2hlbjogJyFvcGVuRm9sZGVyV29ya3NwYWNlU3VwcG9ydCAmJiB3b3JrYmVuY2hTdGF0ZSA9PSBcXCd3b3Jrc3BhY2VcXCcnLFxuXHRcdGNvbnRlbnQ6IHtcblx0XHRcdHR5cGU6ICdzdGFydEVudHJ5Jyxcblx0XHRcdGNvbW1hbmQ6ICdjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24uZmlsZXMub3BlbkZvbGRlclZpYVdvcmtzcGFjZScsXG5cdFx0fVxuXHR9LFxuXHR7XG5cdFx0aWQ6ICd0b3BMZXZlbEdpdENsb25lJyxcblx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnRvcExldmVsR2l0Q2xvbmUudGl0bGUnLCBcIkNsb25lIEdpdCBSZXBvc2l0b3J5Li4uXCIpLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQudG9wTGV2ZWxHaXRDbG9uZS5kZXNjcmlwdGlvbicsIFwiQ2xvbmUgYSByZW1vdGUgcmVwb3NpdG9yeSB0byBhIGxvY2FsIGZvbGRlclwiKSxcblx0XHR3aGVuOiAnY29uZmlnLmdpdC5lbmFibGVkICYmICFnaXQubWlzc2luZycsXG5cdFx0aWNvbjogQ29kaWNvbi5zb3VyY2VDb250cm9sLFxuXHRcdGNvbnRlbnQ6IHtcblx0XHRcdHR5cGU6ICdzdGFydEVudHJ5Jyxcblx0XHRcdGNvbW1hbmQ6ICdjb21tYW5kOmdpdC5jbG9uZScsXG5cdFx0fVxuXHR9LFxuXHR7XG5cdFx0aWQ6ICd0b3BMZXZlbEdpdE9wZW4nLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQudG9wTGV2ZWxHaXRPcGVuLnRpdGxlJywgXCJPcGVuIFJlcG9zaXRvcnkuLi5cIiksXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC50b3BMZXZlbEdpdE9wZW4uZGVzY3JpcHRpb24nLCBcIkNvbm5lY3QgdG8gYSByZW1vdGUgcmVwb3NpdG9yeSBvciBwdWxsIHJlcXVlc3QgdG8gYnJvd3NlLCBzZWFyY2gsIGVkaXQsIGFuZCBjb21taXRcIiksXG5cdFx0d2hlbjogJ3dvcmtzcGFjZVBsYXRmb3JtID09IFxcJ3dlYndvcmtlclxcJycsXG5cdFx0aWNvbjogQ29kaWNvbi5zb3VyY2VDb250cm9sLFxuXHRcdGNvbnRlbnQ6IHtcblx0XHRcdHR5cGU6ICdzdGFydEVudHJ5Jyxcblx0XHRcdGNvbW1hbmQ6ICdjb21tYW5kOnJlbW90ZUh1Yi5vcGVuUmVwb3NpdG9yeScsXG5cdFx0fVxuXHR9LFxuXHR7XG5cdFx0aWQ6ICd0b3BMZXZlbFNob3dXYWxrdGhyb3VnaHMnLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQudG9wTGV2ZWxTaG93V2Fsa3Rocm91Z2hzLnRpdGxlJywgXCJPcGVuIGEgV2Fsa3Rocm91Z2guLi5cIiksXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC50b3BMZXZlbFNob3dXYWxrdGhyb3VnaHMuZGVzY3JpcHRpb24nLCBcIlZpZXcgYSB3YWxrdGhyb3VnaCBvbiB0aGUgZWRpdG9yIG9yIGFuIGV4dGVuc2lvblwiKSxcblx0XHRpY29uOiBDb2RpY29uLmNoZWNrbGlzdCxcblx0XHR3aGVuOiAnYWxsV2Fsa3Rocm91Z2hzSGlkZGVuJyxcblx0XHRjb250ZW50OiB7XG5cdFx0XHR0eXBlOiAnc3RhcnRFbnRyeScsXG5cdFx0XHRjb21tYW5kOiAnY29tbWFuZDp3ZWxjb21lLnNob3dBbGxXYWxrdGhyb3VnaHMnLFxuXHRcdH1cblx0fSxcblx0e1xuXHRcdGlkOiAndG9wTGV2ZWxSZW1vdGVPcGVuJyxcblx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnRvcExldmVsUmVtb3RlT3Blbi50aXRsZScsIFwiQ29ubmVjdCB0by4uLlwiKSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnRvcExldmVsUmVtb3RlT3Blbi5kZXNjcmlwdGlvbicsIFwiQ29ubmVjdCB0byByZW1vdGUgZGV2ZWxvcG1lbnQgd29ya3NwYWNlcy5cIiksXG5cdFx0d2hlbjogJyFpc1dlYicsXG5cdFx0aWNvbjogQ29kaWNvbi5yZW1vdGUsXG5cdFx0Y29udGVudDoge1xuXHRcdFx0dHlwZTogJ3N0YXJ0RW50cnknLFxuXHRcdFx0Y29tbWFuZDogJ2NvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi5yZW1vdGUuc2hvd01lbnUnLFxuXHRcdH1cblx0fSxcblx0e1xuXHRcdGlkOiAndG9wTGV2ZWxPcGVuVHVubmVsJyxcblx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnRvcExldmVsT3BlblR1bm5lbC50aXRsZScsIFwiT3BlbiBUdW5uZWwuLi5cIiksXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC50b3BMZXZlbE9wZW5UdW5uZWwuZGVzY3JpcHRpb24nLCBcIkNvbm5lY3QgdG8gYSByZW1vdGUgbWFjaGluZSB0aHJvdWdoIGEgVHVubmVsXCIpLFxuXHRcdHdoZW46ICdpc1dlYiAmJiBzaG93UmVtb3RlU3RhcnRFbnRyeUluV2ViJyxcblx0XHRpY29uOiBDb2RpY29uLnJlbW90ZSxcblx0XHRjb250ZW50OiB7XG5cdFx0XHR0eXBlOiAnc3RhcnRFbnRyeScsXG5cdFx0XHRjb21tYW5kOiAnY29tbWFuZDp3b3JrYmVuY2guYWN0aW9uLnJlbW90ZS5zaG93V2ViU3RhcnRFbnRyeUFjdGlvbnMnLFxuXHRcdH1cblx0fSxcbl07XG5cbmNvbnN0IEJ1dHRvbiA9ICh0aXRsZTogc3RyaW5nLCBocmVmOiBzdHJpbmcpID0+IGBbJHt0aXRsZX1dKCR7aHJlZn0pYDtcblxuY29uc3QgQ29waWxvdFN0ZXBUaXRsZSA9IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5jb3BpbG90U2V0dXAudGl0bGUnLCBcIlVzZSBBSSBmZWF0dXJlcyB3aXRoIENvcGlsb3QgZm9yIGZyZWVcIik7XG5jb25zdCBDb3BpbG90RGVzY3JpcHRpb24gPSBsb2NhbGl6ZSh7IGtleTogJ2dldHRpbmdTdGFydGVkLmNvcGlsb3RTZXR1cC5kZXNjcmlwdGlvbicsIGNvbW1lbnQ6IFsne0xvY2tlZD1cIltcIn0nLCAne0xvY2tlZD1cIl0oezB9KVwifSddIH0sIFwiWW91IGNhbiB1c2UgW0NvcGlsb3RdKHswfSkgdG8gZ2VuZXJhdGUgY29kZSBhY3Jvc3MgbXVsdGlwbGUgZmlsZXMsIGZpeCBlcnJvcnMsIGFzayBxdWVzdGlvbnMgYWJvdXQgeW91ciBjb2RlIGFuZCBtdWNoIG1vcmUgdXNpbmcgbmF0dXJhbCBsYW5ndWFnZS5cIiwgcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5kb2N1bWVudGF0aW9uVXJsID8/ICcnKTtcbmNvbnN0IENvcGlsb3RTaWduZWRPdXRCdXR0b24gPSBCdXR0b24obG9jYWxpemUoJ3NldHVwQ29waWxvdEJ1dHRvbi5zaWduSW4nLCBcIlNldCB1cCBDb3BpbG90XCIpLCBgY29tbWFuZDp3b3JrYmVuY2guYWN0aW9uLmNoYXQudHJpZ2dlclNldHVwYCk7XG5jb25zdCBDb3BpbG90U2lnbmVkSW5CdXR0b24gPSBCdXR0b24obG9jYWxpemUoJ3NldHVwQ29waWxvdEJ1dHRvbi5zZXR1cCcsIFwiU2V0IHVwIENvcGlsb3RcIiksIGBjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24uY2hhdC50cmlnZ2VyU2V0dXBgKTtcbmNvbnN0IENvcGlsb3RDb21wbGV0ZUJ1dHRvbiA9IEJ1dHRvbihsb2NhbGl6ZSgnc2V0dXBDb3BpbG90QnV0dG9uLmNoYXRXaXRoQ29waWxvdCcsIFwiQ2hhdCB3aXRoIENvcGlsb3RcIiksICdjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24uY2hhdC5vcGVuJyk7XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvcGlsb3RTZXR1cFN0ZXAoaWQ6IHN0cmluZywgYnV0dG9uOiBzdHJpbmcsIHdoZW46IHN0cmluZywgaW5jbHVkZVRlcm1zOiBib29sZWFuKTogQnVpbHRpbkdldHRpbmdTdGFydGVkU3RlcCB7XG5cdGNvbnN0IGRlc2NyaXB0aW9uID0gaW5jbHVkZVRlcm1zID9cblx0XHRgJHtDb3BpbG90RGVzY3JpcHRpb259XFxuXFxuJHtidXR0b259YCA6XG5cdFx0YCR7Q29waWxvdERlc2NyaXB0aW9ufVxcbiR7YnV0dG9ufWA7XG5cblx0cmV0dXJuIHtcblx0XHRpZCxcblx0XHR0aXRsZTogQ29waWxvdFN0ZXBUaXRsZSxcblx0XHRkZXNjcmlwdGlvbixcblx0XHR3aGVuLFxuXHRcdG1lZGlhOiB7XG5cdFx0XHR0eXBlOiAnc3ZnJywgYWx0VGV4dDogJ1ZTIENvZGUgQ29waWxvdCBtdWx0aSBmaWxlIGVkaXRzJywgcGF0aDogJ211bHRpLWZpbGUtZWRpdHMuc3ZnJ1xuXHRcdH0sXG5cdH07XG59XG5cbmV4cG9ydCBjb25zdCB3YWxrdGhyb3VnaHM6IEdldHRpbmdTdGFydGVkV2Fsa3Rocm91Z2hDb250ZW50ID0gW1xuXHR7XG5cdFx0aWQ6ICdTZXR1cCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5zZXR1cC50aXRsZScsIFwiR2V0IFN0YXJ0ZWQgd2l0aCBWUyBDb2RlXCIpLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuc2V0dXAuZGVzY3JpcHRpb24nLCBcIkN1c3RvbWl6ZSB5b3VyIGVkaXRvciwgbGVhcm4gdGhlIGJhc2ljcywgYW5kIHN0YXJ0IGNvZGluZ1wiKSxcblx0XHRpc0ZlYXR1cmVkOiB0cnVlLFxuXHRcdGljb246IHNldHVwSWNvbixcblx0XHR3aGVuOiAnIWlzV2ViJyxcblx0XHR3YWxrdGhyb3VnaFBhZ2VUaXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnNldHVwLndhbGt0aHJvdWdoUGFnZVRpdGxlJywgJ1NldHVwIFZTIENvZGUnKSxcblx0XHRuZXh0OiAnQmVnaW5uZXInLFxuXHRcdGNvbnRlbnQ6IHtcblx0XHRcdHR5cGU6ICdzdGVwcycsXG5cdFx0XHRzdGVwczogW1xuXHRcdFx0XHRjcmVhdGVDb3BpbG90U2V0dXBTdGVwKCdDb3BpbG90U2V0dXBTaWduZWRPdXQnLCBDb3BpbG90U2lnbmVkT3V0QnV0dG9uLCAnY2hhdFNldHVwU2lnbmVkT3V0JywgdHJ1ZSksXG5cdFx0XHRcdGNyZWF0ZUNvcGlsb3RTZXR1cFN0ZXAoJ0NvcGlsb3RTZXR1cENvbXBsZXRlJywgQ29waWxvdENvbXBsZXRlQnV0dG9uLCAnY2hhdFNldHVwSW5zdGFsbGVkICYmIChjaGF0UGxhblBybyB8fCBjaGF0UGxhbkxpbWl0ZWQpJywgZmFsc2UpLFxuXHRcdFx0XHRjcmVhdGVDb3BpbG90U2V0dXBTdGVwKCdDb3BpbG90U2V0dXBTaWduZWRJbicsIENvcGlsb3RTaWduZWRJbkJ1dHRvbiwgJyFjaGF0U2V0dXBTaWduZWRPdXQgJiYgKCFjaGF0U2V0dXBJbnN0YWxsZWQgfHwgY2hhdFBsYW5DYW5TaWduVXApJywgdHJ1ZSksXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ3BpY2tDb2xvclRoZW1lJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnBpY2tDb2xvci50aXRsZScsIFwiQ2hvb3NlIHlvdXIgdGhlbWVcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5waWNrQ29sb3IuZGVzY3JpcHRpb24uaW50ZXJwb2xhdGVkJywgXCJUaGUgcmlnaHQgdGhlbWUgaGVscHMgeW91IGZvY3VzIG9uIHlvdXIgY29kZSwgaXMgZWFzeSBvbiB5b3VyIGV5ZXMsIGFuZCBpcyBzaW1wbHkgbW9yZSBmdW4gdG8gdXNlLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ3RpdGxlSUQnLCBcIkJyb3dzZSBDb2xvciBUaGVtZXNcIiksICdjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24uc2VsZWN0VGhlbWUnKSksXG5cdFx0XHRcdFx0Y29tcGxldGlvbkV2ZW50czogW1xuXHRcdFx0XHRcdFx0J29uU2V0dGluZ0NoYW5nZWQ6d29ya2JlbmNoLmNvbG9yVGhlbWUnLFxuXHRcdFx0XHRcdFx0J29uQ29tbWFuZDp3b3JrYmVuY2guYWN0aW9uLnNlbGVjdFRoZW1lJ1xuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0bWVkaWE6IHsgdHlwZTogJ21hcmtkb3duJywgcGF0aDogJ3RoZW1lX3BpY2tlcicsIH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnZXh0ZW5zaW9uc1dlYicsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5leHRlbnNpb25zLnRpdGxlJywgXCJDb2RlIHdpdGggZXh0ZW5zaW9uc1wiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmV4dGVuc2lvbnNXZWIuZGVzY3JpcHRpb24uaW50ZXJwb2xhdGVkJywgXCJFeHRlbnNpb25zIGFyZSBWUyBDb2RlJ3MgcG93ZXItdXBzLiBBIGdyb3dpbmcgbnVtYmVyIGFyZSBiZWNvbWluZyBhdmFpbGFibGUgaW4gdGhlIHdlYi5cXG57MH1cIiwgQnV0dG9uKGxvY2FsaXplKCdicm93c2VQb3B1bGFyV2ViJywgXCJCcm93c2UgUG9wdWxhciBXZWIgRXh0ZW5zaW9uc1wiKSwgJ2NvbW1hbmQ6d29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNob3dQb3B1bGFyRXh0ZW5zaW9ucycpKSxcblx0XHRcdFx0XHR3aGVuOiAnd29ya3NwYWNlUGxhdGZvcm0gPT0gXFwnd2Vid29ya2VyXFwnJyxcblx0XHRcdFx0XHRtZWRpYToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N2ZycsIGFsdFRleHQ6ICdWUyBDb2RlIGV4dGVuc2lvbiBtYXJrZXRwbGFjZSB3aXRoIGZlYXR1cmVkIGxhbmd1YWdlIGV4dGVuc2lvbnMnLCBwYXRoOiAnZXh0ZW5zaW9ucy13ZWIuc3ZnJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2ZpbmRMYW5ndWFnZUV4dGVuc2lvbnMnLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuZmluZExhbmd1YWdlRXh0cy50aXRsZScsIFwiUmljaCBzdXBwb3J0IGZvciBhbGwgeW91ciBsYW5ndWFnZXNcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5maW5kTGFuZ3VhZ2VFeHRzLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiQ29kZSBzbWFydGVyIHdpdGggc3ludGF4IGhpZ2hsaWdodGluZywgY29kZSBjb21wbGV0aW9uLCBsaW50aW5nIGFuZCBkZWJ1Z2dpbmcuIFdoaWxlIG1hbnkgbGFuZ3VhZ2VzIGFyZSBidWlsdC1pbiwgbWFueSBtb3JlIGNhbiBiZSBhZGRlZCBhcyBleHRlbnNpb25zLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ2Jyb3dzZUxhbmdFeHRzJywgXCJCcm93c2UgTGFuZ3VhZ2UgRXh0ZW5zaW9uc1wiKSwgJ2NvbW1hbmQ6d29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNob3dMYW5ndWFnZUV4dGVuc2lvbnMnKSksXG5cdFx0XHRcdFx0d2hlbjogJ3dvcmtzcGFjZVBsYXRmb3JtICE9IFxcJ3dlYndvcmtlclxcJycsXG5cdFx0XHRcdFx0bWVkaWE6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdmcnLCBhbHRUZXh0OiAnTGFuZ3VhZ2UgZXh0ZW5zaW9ucycsIHBhdGg6ICdsYW5ndWFnZXMuc3ZnJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdC8vIEhpZGRlbiBpbiBmYXZvciBvZiBjb3BpbG90IGVudHJ5ICh0byBiZSByZXZpc2l0ZWQgd2hlbiBjb3BpbG90IGVudHJ5IG1vdmVzLCBpZiBhdCBhbGwpXG5cdFx0XHRcdC8vIHtcblx0XHRcdFx0Ly8gXHRpZDogJ3NldHRpbmdzJyxcblx0XHRcdFx0Ly8gXHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnNldHRpbmdzLnRpdGxlJywgXCJUdW5lIHlvdXIgc2V0dGluZ3NcIiksXG5cdFx0XHRcdC8vIFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5zZXR0aW5ncy5kZXNjcmlwdGlvbi5pbnRlcnBvbGF0ZWQnLCBcIkN1c3RvbWl6ZSBldmVyeSBhc3BlY3Qgb2YgVlMgQ29kZSBhbmQgeW91ciBleHRlbnNpb25zIHRvIHlvdXIgbGlraW5nLiBDb21tb25seSB1c2VkIHNldHRpbmdzIGFyZSBsaXN0ZWQgZmlyc3QgdG8gZ2V0IHlvdSBzdGFydGVkLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ3R3ZWFrU2V0dGluZ3MnLCBcIk9wZW4gU2V0dGluZ3NcIiksICdjb21tYW5kOnRvU2lkZTp3b3JrYmVuY2guYWN0aW9uLm9wZW5TZXR0aW5ncycpKSxcblx0XHRcdFx0Ly8gXHRtZWRpYToge1xuXHRcdFx0XHQvLyBcdFx0dHlwZTogJ3N2ZycsIGFsdFRleHQ6ICdWUyBDb2RlIFNldHRpbmdzJywgcGF0aDogJ3NldHRpbmdzLnN2Zydcblx0XHRcdFx0Ly8gXHR9LFxuXHRcdFx0XHQvLyB9LFxuXHRcdFx0XHQvLyB7XG5cdFx0XHRcdC8vIFx0aWQ6ICdzZXR0aW5nc1N5bmMnLFxuXHRcdFx0XHQvLyBcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuc2V0dGluZ3NTeW5jLnRpdGxlJywgXCJTeW5jIHNldHRpbmdzIGFjcm9zcyBkZXZpY2VzXCIpLFxuXHRcdFx0XHQvLyBcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuc2V0dGluZ3NTeW5jLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiS2VlcCB5b3VyIGVzc2VudGlhbCBjdXN0b21pemF0aW9ucyBiYWNrZWQgdXAgYW5kIHVwZGF0ZWQgYWNyb3NzIGFsbCB5b3VyIGRldmljZXMuXFxuezB9XCIsIEJ1dHRvbihsb2NhbGl6ZSgnZW5hYmxlU3luYycsIFwiQmFja3VwIGFuZCBTeW5jIFNldHRpbmdzXCIpLCAnY29tbWFuZDp3b3JrYmVuY2gudXNlckRhdGFTeW5jLmFjdGlvbnMudHVybk9uJykpLFxuXHRcdFx0XHQvLyBcdHdoZW46ICdzeW5jU3RhdHVzICE9IHVuaW5pdGlhbGl6ZWQnLFxuXHRcdFx0XHQvLyBcdGNvbXBsZXRpb25FdmVudHM6IFsnb25FdmVudDpzeW5jLWVuYWJsZWQnXSxcblx0XHRcdFx0Ly8gXHRtZWRpYToge1xuXHRcdFx0XHQvLyBcdFx0dHlwZTogJ3N2ZycsIGFsdFRleHQ6ICdUaGUgXCJUdXJuIG9uIFN5bmNcIiBlbnRyeSBpbiB0aGUgc2V0dGluZ3MgZ2VhciBtZW51LicsIHBhdGg6ICdzZXR0aW5nc1N5bmMuc3ZnJ1xuXHRcdFx0XHQvLyBcdH0sXG5cdFx0XHRcdC8vIH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ3NldHRpbmdzQW5kU3luYycsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5zZXR0aW5ncy50aXRsZScsIFwiVHVuZSB5b3VyIHNldHRpbmdzXCIpLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuc2V0dGluZ3NBbmRTeW5jLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiQ3VzdG9taXplIGV2ZXJ5IGFzcGVjdCBvZiBWUyBDb2RlIGFuZCB5b3VyIGV4dGVuc2lvbnMgdG8geW91ciBsaWtpbmcuIFtCYWNrIHVwIGFuZCBzeW5jXShjb21tYW5kOndvcmtiZW5jaC51c2VyRGF0YVN5bmMuYWN0aW9ucy50dXJuT24pIHlvdXIgZXNzZW50aWFsIGN1c3RvbWl6YXRpb25zIGFjcm9zcyBhbGwgeW91ciBkZXZpY2VzLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ3R3ZWFrU2V0dGluZ3MnLCBcIk9wZW4gU2V0dGluZ3NcIiksICdjb21tYW5kOnRvU2lkZTp3b3JrYmVuY2guYWN0aW9uLm9wZW5TZXR0aW5ncycpKSxcblx0XHRcdFx0XHR3aGVuOiAnc3luY1N0YXR1cyAhPSB1bmluaXRpYWxpemVkJyxcblx0XHRcdFx0XHRjb21wbGV0aW9uRXZlbnRzOiBbJ29uRXZlbnQ6c3luYy1lbmFibGVkJ10sXG5cdFx0XHRcdFx0bWVkaWE6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdmcnLCBhbHRUZXh0OiAnVlMgQ29kZSBTZXR0aW5ncycsIHBhdGg6ICdzZXR0aW5ncy5zdmcnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnY29tbWFuZFBhbGV0dGVUYXNrJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmNvbW1hbmRQYWxldHRlLnRpdGxlJywgXCJVbmxvY2sgcHJvZHVjdGl2aXR5IHdpdGggdGhlIENvbW1hbmQgUGFsZXR0ZSBcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5jb21tYW5kUGFsZXR0ZS5kZXNjcmlwdGlvbi5pbnRlcnBvbGF0ZWQnLCBcIlJ1biBjb21tYW5kcyB3aXRob3V0IHJlYWNoaW5nIGZvciB5b3VyIG1vdXNlIHRvIGFjY29tcGxpc2ggYW55IHRhc2sgaW4gVlMgQ29kZS5cXG57MH1cIiwgQnV0dG9uKGxvY2FsaXplKCdjb21tYW5kUGFsZXR0ZScsIFwiT3BlbiBDb21tYW5kIFBhbGV0dGVcIiksICdjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24uc2hvd0NvbW1hbmRzJykpLFxuXHRcdFx0XHRcdG1lZGlhOiB7IHR5cGU6ICdzdmcnLCBhbHRUZXh0OiAnQ29tbWFuZCBQYWxldHRlIG92ZXJsYXkgZm9yIHNlYXJjaGluZyBhbmQgZXhlY3V0aW5nIGNvbW1hbmRzLicsIHBhdGg6ICdjb21tYW5kUGFsZXR0ZS5zdmcnIH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdC8vIEhpZGRlbiBpbiBmYXZvciBvZiBjb3BpbG90IGVudHJ5ICh0byBiZSByZXZpc2l0ZWQgd2hlbiBjb3BpbG90IGVudHJ5IG1vdmVzLCBpZiBhdCBhbGwpXG5cdFx0XHRcdC8vIHtcblx0XHRcdFx0Ly8gXHRpZDogJ3BpY2tBRm9sZGVyVGFzay1NYWMnLFxuXHRcdFx0XHQvLyBcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuc2V0dXAuT3BlbkZvbGRlci50aXRsZScsIFwiT3BlbiB1cCB5b3VyIGNvZGVcIiksXG5cdFx0XHRcdC8vIFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5zZXR1cC5PcGVuRm9sZGVyLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiWW91J3JlIGFsbCBzZXQgdG8gc3RhcnQgY29kaW5nLiBPcGVuIGEgcHJvamVjdCBmb2xkZXIgdG8gZ2V0IHlvdXIgZmlsZXMgaW50byBWUyBDb2RlLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ3BpY2tGb2xkZXInLCBcIlBpY2sgYSBGb2xkZXJcIiksICdjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24uZmlsZXMub3BlbkZpbGVGb2xkZXInKSksXG5cdFx0XHRcdC8vIFx0d2hlbjogJ2lzTWFjICYmIHdvcmtzcGFjZUZvbGRlckNvdW50ID09IDAnLFxuXHRcdFx0XHQvLyBcdG1lZGlhOiB7XG5cdFx0XHRcdC8vIFx0XHR0eXBlOiAnc3ZnJywgYWx0VGV4dDogJ0V4cGxvcmVyIHZpZXcgc2hvd2luZyBidXR0b25zIGZvciBvcGVuaW5nIGZvbGRlciBhbmQgY2xvbmluZyByZXBvc2l0b3J5LicsIHBhdGg6ICdvcGVuRm9sZGVyLnN2Zydcblx0XHRcdFx0Ly8gXHR9XG5cdFx0XHRcdC8vIH0sXG5cdFx0XHRcdC8vIHtcblx0XHRcdFx0Ly8gXHRpZDogJ3BpY2tBRm9sZGVyVGFzay1PdGhlcicsXG5cdFx0XHRcdC8vIFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5zZXR1cC5PcGVuRm9sZGVyLnRpdGxlJywgXCJPcGVuIHVwIHlvdXIgY29kZVwiKSxcblx0XHRcdFx0Ly8gXHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnNldHVwLk9wZW5Gb2xkZXIuZGVzY3JpcHRpb24uaW50ZXJwb2xhdGVkJywgXCJZb3UncmUgYWxsIHNldCB0byBzdGFydCBjb2RpbmcuIE9wZW4gYSBwcm9qZWN0IGZvbGRlciB0byBnZXQgeW91ciBmaWxlcyBpbnRvIFZTIENvZGUuXFxuezB9XCIsIEJ1dHRvbihsb2NhbGl6ZSgncGlja0ZvbGRlcicsIFwiUGljayBhIEZvbGRlclwiKSwgJ2NvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi5maWxlcy5vcGVuRm9sZGVyJykpLFxuXHRcdFx0XHQvLyBcdHdoZW46ICchaXNNYWMgJiYgd29ya3NwYWNlRm9sZGVyQ291bnQgPT0gMCcsXG5cdFx0XHRcdC8vIFx0bWVkaWE6IHtcblx0XHRcdFx0Ly8gXHRcdHR5cGU6ICdzdmcnLCBhbHRUZXh0OiAnRXhwbG9yZXIgdmlldyBzaG93aW5nIGJ1dHRvbnMgZm9yIG9wZW5pbmcgZm9sZGVyIGFuZCBjbG9uaW5nIHJlcG9zaXRvcnkuJywgcGF0aDogJ29wZW5Gb2xkZXIuc3ZnJ1xuXHRcdFx0XHQvLyBcdH1cblx0XHRcdFx0Ly8gfSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAncXVpY2tPcGVuJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnF1aWNrT3Blbi50aXRsZScsIFwiUXVpY2tseSBuYXZpZ2F0ZSBiZXR3ZWVuIHlvdXIgZmlsZXNcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5xdWlja09wZW4uZGVzY3JpcHRpb24uaW50ZXJwb2xhdGVkJywgXCJOYXZpZ2F0ZSBiZXR3ZWVuIGZpbGVzIGluIGFuIGluc3RhbnQgd2l0aCBvbmUga2V5c3Ryb2tlLiBUaXA6IE9wZW4gbXVsdGlwbGUgZmlsZXMgYnkgcHJlc3NpbmcgdGhlIHJpZ2h0IGFycm93IGtleS5cXG57MH1cIiwgQnV0dG9uKGxvY2FsaXplKCdxdWlja09wZW4nLCBcIlF1aWNrIE9wZW4gYSBGaWxlXCIpLCAnY29tbWFuZDp0b1NpZGU6d29ya2JlbmNoLmFjdGlvbi5xdWlja09wZW4nKSksXG5cdFx0XHRcdFx0d2hlbjogJ3dvcmtzcGFjZUZvbGRlckNvdW50ICE9IDAnLFxuXHRcdFx0XHRcdG1lZGlhOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3ZnJywgYWx0VGV4dDogJ0dvIHRvIGZpbGUgaW4gcXVpY2sgc2VhcmNoLicsIHBhdGg6ICdzZWFyY2guc3ZnJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAndmlkZW9UdXRvcmlhbCcsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC52aWRlb1R1dG9yaWFsLnRpdGxlJywgXCJXYXRjaCB2aWRlbyB0dXRvcmlhbHNcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC52aWRlb1R1dG9yaWFsLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiV2F0Y2ggdGhlIGZpcnN0IGluIGEgc2VyaWVzIG9mIHNob3J0ICYgcHJhY3RpY2FsIHZpZGVvIHR1dG9yaWFscyBmb3IgVlMgQ29kZSdzIGtleSBmZWF0dXJlcy5cXG57MH1cIiwgQnV0dG9uKGxvY2FsaXplKCd3YXRjaCcsIFwiV2F0Y2ggVHV0b3JpYWxcIiksICdodHRwczovL2FrYS5tcy92c2NvZGUtZ2V0dGluZy1zdGFydGVkLXZpZGVvJykpLFxuXHRcdFx0XHRcdG1lZGlhOiB7IHR5cGU6ICdzdmcnLCBhbHRUZXh0OiAnVlMgQ29kZSBTZXR0aW5ncycsIHBhdGg6ICdsZWFybi5zdmcnIH0sXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9XG5cdH0sXG5cblx0e1xuXHRcdGlkOiAnU2V0dXBXZWInLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuc2V0dXBXZWIudGl0bGUnLCBcIkdldCBTdGFydGVkIHdpdGggVlMgQ29kZSBmb3IgdGhlIFdlYlwiKSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnNldHVwV2ViLmRlc2NyaXB0aW9uJywgXCJDdXN0b21pemUgeW91ciBlZGl0b3IsIGxlYXJuIHRoZSBiYXNpY3MsIGFuZCBzdGFydCBjb2RpbmdcIiksXG5cdFx0aXNGZWF0dXJlZDogdHJ1ZSxcblx0XHRpY29uOiBzZXR1cEljb24sXG5cdFx0d2hlbjogJ2lzV2ViJyxcblx0XHRuZXh0OiAnQmVnaW5uZXInLFxuXHRcdHdhbGt0aHJvdWdoUGFnZVRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuc2V0dXBXZWIud2Fsa3Rocm91Z2hQYWdlVGl0bGUnLCAnU2V0dXAgVlMgQ29kZSBXZWInKSxcblx0XHRjb250ZW50OiB7XG5cdFx0XHR0eXBlOiAnc3RlcHMnLFxuXHRcdFx0c3RlcHM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAncGlja0NvbG9yVGhlbWVXZWInLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQucGlja0NvbG9yLnRpdGxlJywgXCJDaG9vc2UgeW91ciB0aGVtZVwiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnBpY2tDb2xvci5kZXNjcmlwdGlvbi5pbnRlcnBvbGF0ZWQnLCBcIlRoZSByaWdodCB0aGVtZSBoZWxwcyB5b3UgZm9jdXMgb24geW91ciBjb2RlLCBpcyBlYXN5IG9uIHlvdXIgZXllcywgYW5kIGlzIHNpbXBseSBtb3JlIGZ1biB0byB1c2UuXFxuezB9XCIsIEJ1dHRvbihsb2NhbGl6ZSgndGl0bGVJRCcsIFwiQnJvd3NlIENvbG9yIFRoZW1lc1wiKSwgJ2NvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi5zZWxlY3RUaGVtZScpKSxcblx0XHRcdFx0XHRjb21wbGV0aW9uRXZlbnRzOiBbXG5cdFx0XHRcdFx0XHQnb25TZXR0aW5nQ2hhbmdlZDp3b3JrYmVuY2guY29sb3JUaGVtZScsXG5cdFx0XHRcdFx0XHQnb25Db21tYW5kOndvcmtiZW5jaC5hY3Rpb24uc2VsZWN0VGhlbWUnXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRtZWRpYTogeyB0eXBlOiAnbWFya2Rvd24nLCBwYXRoOiAndGhlbWVfcGlja2VyJywgfVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdtZW51QmFyV2ViJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLm1lbnVCYXIudGl0bGUnLCBcIkp1c3QgdGhlIHJpZ2h0IGFtb3VudCBvZiBVSVwiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLm1lbnVCYXIuZGVzY3JpcHRpb24uaW50ZXJwb2xhdGVkJywgXCJUaGUgZnVsbCBtZW51IGJhciBpcyBhdmFpbGFibGUgaW4gdGhlIGRyb3Bkb3duIG1lbnUgdG8gbWFrZSByb29tIGZvciB5b3VyIGNvZGUuIFRvZ2dsZSBpdHMgYXBwZWFyYW5jZSBmb3IgZmFzdGVyIGFjY2Vzcy4gXFxuezB9XCIsIEJ1dHRvbihsb2NhbGl6ZSgndG9nZ2xlTWVudUJhcicsIFwiVG9nZ2xlIE1lbnUgQmFyXCIpLCAnY29tbWFuZDp3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZU1lbnVCYXInKSksXG5cdFx0XHRcdFx0d2hlbjogJ2lzV2ViJyxcblx0XHRcdFx0XHRtZWRpYToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N2ZycsIGFsdFRleHQ6ICdDb21wYXJpbmcgbWVudSBkcm9wZG93biB3aXRoIHRoZSB2aXNpYmxlIG1lbnUgYmFyLicsIHBhdGg6ICdtZW51QmFyLnN2Zydcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdleHRlbnNpb25zV2ViV2ViJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmV4dGVuc2lvbnMudGl0bGUnLCBcIkNvZGUgd2l0aCBleHRlbnNpb25zXCIpLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuZXh0ZW5zaW9uc1dlYi5kZXNjcmlwdGlvbi5pbnRlcnBvbGF0ZWQnLCBcIkV4dGVuc2lvbnMgYXJlIFZTIENvZGUncyBwb3dlci11cHMuIEEgZ3Jvd2luZyBudW1iZXIgYXJlIGJlY29taW5nIGF2YWlsYWJsZSBpbiB0aGUgd2ViLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ2Jyb3dzZVBvcHVsYXJXZWInLCBcIkJyb3dzZSBQb3B1bGFyIFdlYiBFeHRlbnNpb25zXCIpLCAnY29tbWFuZDp3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uc2hvd1BvcHVsYXJFeHRlbnNpb25zJykpLFxuXHRcdFx0XHRcdHdoZW46ICd3b3Jrc3BhY2VQbGF0Zm9ybSA9PSBcXCd3ZWJ3b3JrZXJcXCcnLFxuXHRcdFx0XHRcdG1lZGlhOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3ZnJywgYWx0VGV4dDogJ1ZTIENvZGUgZXh0ZW5zaW9uIG1hcmtldHBsYWNlIHdpdGggZmVhdHVyZWQgbGFuZ3VhZ2UgZXh0ZW5zaW9ucycsIHBhdGg6ICdleHRlbnNpb25zLXdlYi5zdmcnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnZmluZExhbmd1YWdlRXh0ZW5zaW9uc1dlYicsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5maW5kTGFuZ3VhZ2VFeHRzLnRpdGxlJywgXCJSaWNoIHN1cHBvcnQgZm9yIGFsbCB5b3VyIGxhbmd1YWdlc1wiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmZpbmRMYW5ndWFnZUV4dHMuZGVzY3JpcHRpb24uaW50ZXJwb2xhdGVkJywgXCJDb2RlIHNtYXJ0ZXIgd2l0aCBzeW50YXggaGlnaGxpZ2h0aW5nLCBjb2RlIGNvbXBsZXRpb24sIGxpbnRpbmcgYW5kIGRlYnVnZ2luZy4gV2hpbGUgbWFueSBsYW5ndWFnZXMgYXJlIGJ1aWx0LWluLCBtYW55IG1vcmUgY2FuIGJlIGFkZGVkIGFzIGV4dGVuc2lvbnMuXFxuezB9XCIsIEJ1dHRvbihsb2NhbGl6ZSgnYnJvd3NlTGFuZ0V4dHMnLCBcIkJyb3dzZSBMYW5ndWFnZSBFeHRlbnNpb25zXCIpLCAnY29tbWFuZDp3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uc2hvd0xhbmd1YWdlRXh0ZW5zaW9ucycpKSxcblx0XHRcdFx0XHR3aGVuOiAnd29ya3NwYWNlUGxhdGZvcm0gIT0gXFwnd2Vid29ya2VyXFwnJyxcblx0XHRcdFx0XHRtZWRpYToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N2ZycsIGFsdFRleHQ6ICdMYW5ndWFnZSBleHRlbnNpb25zJywgcGF0aDogJ2xhbmd1YWdlcy5zdmcnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnc2V0dGluZ3NTeW5jV2ViJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnNldHRpbmdzU3luYy50aXRsZScsIFwiU3luYyBzZXR0aW5ncyBhY3Jvc3MgZGV2aWNlc1wiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnNldHRpbmdzU3luYy5kZXNjcmlwdGlvbi5pbnRlcnBvbGF0ZWQnLCBcIktlZXAgeW91ciBlc3NlbnRpYWwgY3VzdG9taXphdGlvbnMgYmFja2VkIHVwIGFuZCB1cGRhdGVkIGFjcm9zcyBhbGwgeW91ciBkZXZpY2VzLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ2VuYWJsZVN5bmMnLCBcIkJhY2t1cCBhbmQgU3luYyBTZXR0aW5nc1wiKSwgJ2NvbW1hbmQ6d29ya2JlbmNoLnVzZXJEYXRhU3luYy5hY3Rpb25zLnR1cm5PbicpKSxcblx0XHRcdFx0XHR3aGVuOiAnc3luY1N0YXR1cyAhPSB1bmluaXRpYWxpemVkJyxcblx0XHRcdFx0XHRjb21wbGV0aW9uRXZlbnRzOiBbJ29uRXZlbnQ6c3luYy1lbmFibGVkJ10sXG5cdFx0XHRcdFx0bWVkaWE6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdmcnLCBhbHRUZXh0OiAnVGhlIFwiVHVybiBvbiBTeW5jXCIgZW50cnkgaW4gdGhlIHNldHRpbmdzIGdlYXIgbWVudS4nLCBwYXRoOiAnc2V0dGluZ3NTeW5jLnN2Zydcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdjb21tYW5kUGFsZXR0ZVRhc2tXZWInLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuY29tbWFuZFBhbGV0dGUudGl0bGUnLCBcIlVubG9jayBwcm9kdWN0aXZpdHkgd2l0aCB0aGUgQ29tbWFuZCBQYWxldHRlIFwiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmNvbW1hbmRQYWxldHRlLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiUnVuIGNvbW1hbmRzIHdpdGhvdXQgcmVhY2hpbmcgZm9yIHlvdXIgbW91c2UgdG8gYWNjb21wbGlzaCBhbnkgdGFzayBpbiBWUyBDb2RlLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ2NvbW1hbmRQYWxldHRlJywgXCJPcGVuIENvbW1hbmQgUGFsZXR0ZVwiKSwgJ2NvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi5zaG93Q29tbWFuZHMnKSksXG5cdFx0XHRcdFx0bWVkaWE6IHsgdHlwZTogJ3N2ZycsIGFsdFRleHQ6ICdDb21tYW5kIFBhbGV0dGUgb3ZlcmxheSBmb3Igc2VhcmNoaW5nIGFuZCBleGVjdXRpbmcgY29tbWFuZHMuJywgcGF0aDogJ2NvbW1hbmRQYWxldHRlLnN2ZycgfSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAncGlja0FGb2xkZXJUYXNrLVdlYldlYicsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5zZXR1cC5PcGVuRm9sZGVyLnRpdGxlJywgXCJPcGVuIHVwIHlvdXIgY29kZVwiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnNldHVwLk9wZW5Gb2xkZXJXZWIuZGVzY3JpcHRpb24uaW50ZXJwb2xhdGVkJywgXCJZb3UncmUgYWxsIHNldCB0byBzdGFydCBjb2RpbmcuIFlvdSBjYW4gb3BlbiBhIGxvY2FsIHByb2plY3Qgb3IgYSByZW1vdGUgcmVwb3NpdG9yeSB0byBnZXQgeW91ciBmaWxlcyBpbnRvIFZTIENvZGUuXFxuezB9XFxuezF9XCIsIEJ1dHRvbihsb2NhbGl6ZSgnb3BlbkZvbGRlcicsIFwiT3BlbiBGb2xkZXJcIiksICdjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24uYWRkUm9vdEZvbGRlcicpLCBCdXR0b24obG9jYWxpemUoJ29wZW5SZXBvc2l0b3J5JywgXCJPcGVuIFJlcG9zaXRvcnlcIiksICdjb21tYW5kOnJlbW90ZUh1Yi5vcGVuUmVwb3NpdG9yeScpKSxcblx0XHRcdFx0XHR3aGVuOiAnd29ya3NwYWNlRm9sZGVyQ291bnQgPT0gMCcsXG5cdFx0XHRcdFx0bWVkaWE6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdmcnLCBhbHRUZXh0OiAnRXhwbG9yZXIgdmlldyBzaG93aW5nIGJ1dHRvbnMgZm9yIG9wZW5pbmcgZm9sZGVyIGFuZCBjbG9uaW5nIHJlcG9zaXRvcnkuJywgcGF0aDogJ29wZW5Gb2xkZXIuc3ZnJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAncXVpY2tPcGVuV2ViJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnF1aWNrT3Blbi50aXRsZScsIFwiUXVpY2tseSBuYXZpZ2F0ZSBiZXR3ZWVuIHlvdXIgZmlsZXNcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5xdWlja09wZW4uZGVzY3JpcHRpb24uaW50ZXJwb2xhdGVkJywgXCJOYXZpZ2F0ZSBiZXR3ZWVuIGZpbGVzIGluIGFuIGluc3RhbnQgd2l0aCBvbmUga2V5c3Ryb2tlLiBUaXA6IE9wZW4gbXVsdGlwbGUgZmlsZXMgYnkgcHJlc3NpbmcgdGhlIHJpZ2h0IGFycm93IGtleS5cXG57MH1cIiwgQnV0dG9uKGxvY2FsaXplKCdxdWlja09wZW4nLCBcIlF1aWNrIE9wZW4gYSBGaWxlXCIpLCAnY29tbWFuZDp0b1NpZGU6d29ya2JlbmNoLmFjdGlvbi5xdWlja09wZW4nKSksXG5cdFx0XHRcdFx0d2hlbjogJ3dvcmtzcGFjZUZvbGRlckNvdW50ICE9IDAnLFxuXHRcdFx0XHRcdG1lZGlhOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3ZnJywgYWx0VGV4dDogJ0dvIHRvIGZpbGUgaW4gcXVpY2sgc2VhcmNoLicsIHBhdGg6ICdzZWFyY2guc3ZnJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH1cblx0fSxcblx0e1xuXHRcdGlkOiAnU2V0dXBBY2Nlc3NpYmlsaXR5Jyxcblx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnNldHVwQWNjZXNzaWJpbGl0eS50aXRsZScsIFwiR2V0IFN0YXJ0ZWQgd2l0aCBBY2Nlc3NpYmlsaXR5IEZlYXR1cmVzXCIpLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuc2V0dXBBY2Nlc3NpYmlsaXR5LmRlc2NyaXB0aW9uJywgXCJMZWFybiB0aGUgdG9vbHMgYW5kIHNob3J0Y3V0cyB0aGF0IG1ha2UgVlMgQ29kZSBhY2Nlc3NpYmxlLiBOb3RlIHRoYXQgc29tZSBhY3Rpb25zIGFyZSBub3QgYWN0aW9uYWJsZSBmcm9tIHdpdGhpbiB0aGUgY29udGV4dCBvZiB0aGUgd2Fsa3Rocm91Z2guXCIpLFxuXHRcdGlzRmVhdHVyZWQ6IHRydWUsXG5cdFx0aWNvbjogc2V0dXBJY29uLFxuXHRcdHdoZW46IENPTlRFWFRfQUNDRVNTSUJJTElUWV9NT0RFX0VOQUJMRUQua2V5LFxuXHRcdG5leHQ6ICdTZXR1cCcsXG5cdFx0d2Fsa3Rocm91Z2hQYWdlVGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5zZXR1cEFjY2Vzc2liaWxpdHkud2Fsa3Rocm91Z2hQYWdlVGl0bGUnLCAnU2V0dXAgVlMgQ29kZSBBY2Nlc3NpYmlsaXR5JyksXG5cdFx0Y29udGVudDoge1xuXHRcdFx0dHlwZTogJ3N0ZXBzJyxcblx0XHRcdHN0ZXBzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2FjY2Vzc2liaWxpdHlIZWxwJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmFjY2Vzc2liaWxpdHlIZWxwLnRpdGxlJywgXCJVc2UgdGhlIGFjY2Vzc2liaWxpdHkgaGVscCBkaWFsb2cgdG8gbGVhcm4gYWJvdXQgZmVhdHVyZXNcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5hY2Nlc3NpYmlsaXR5SGVscC5kZXNjcmlwdGlvbi5pbnRlcnBvbGF0ZWQnLCBcIlRoZSBhY2Nlc3NpYmlsaXR5IGhlbHAgZGlhbG9nIHByb3ZpZGVzIGluZm9ybWF0aW9uIGFib3V0IHdoYXQgdG8gZXhwZWN0IGZyb20gYSBmZWF0dXJlIGFuZCB0aGUgY29tbWFuZHMva2V5YmluZGluZ3MgdG8gb3BlcmF0ZSB0aGVtLlxcbiBXaXRoIGZvY3VzIGluIGFuIGVkaXRvciwgdGVybWluYWwsIG5vdGVib29rLCBjaGF0IHJlc3BvbnNlLCBjb21tZW50LCBvciBkZWJ1ZyBjb25zb2xlLCB0aGUgcmVsZXZhbnQgZGlhbG9nIGNhbiBiZSBvcGVuZWQgd2l0aCB0aGUgT3BlbiBBY2Nlc3NpYmlsaXR5IEhlbHAgY29tbWFuZC5cXG57MH1cIiwgQnV0dG9uKGxvY2FsaXplKCdvcGVuQWNjZXNzaWJpbGl0eUhlbHAnLCBcIk9wZW4gQWNjZXNzaWJpbGl0eSBIZWxwXCIpLCAnY29tbWFuZDplZGl0b3IuYWN0aW9uLmFjY2Vzc2liaWxpdHlIZWxwJykpLFxuXHRcdFx0XHRcdG1lZGlhOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnbWFya2Rvd24nLCBwYXRoOiAnZW1wdHknXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdhY2Nlc3NpYmxlVmlldycsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5hY2Nlc3NpYmxlVmlldy50aXRsZScsIFwiU2NyZWVuIHJlYWRlciB1c2VycyBjYW4gaW5zcGVjdCBjb250ZW50IGxpbmUgYnkgbGluZSwgY2hhcmFjdGVyIGJ5IGNoYXJhY3RlciBpbiB0aGUgYWNjZXNzaWJsZSB2aWV3LlwiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmFjY2Vzc2libGVWaWV3LmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiVGhlIGFjY2Vzc2libGUgdmlldyBpcyBhdmFpbGFibGUgZm9yIHRoZSB0ZXJtaW5hbCwgaG92ZXJzLCBub3RpZmljYXRpb25zLCBjb21tZW50cywgbm90ZWJvb2sgb3V0cHV0LCBjaGF0IHJlc3BvbnNlcywgaW5saW5lIGNvbXBsZXRpb25zLCBhbmQgZGVidWcgY29uc29sZSBvdXRwdXQuXFxuIFdpdGggZm9jdXMgaW4gYW55IG9mIHRob3NlIGZlYXR1cmVzLCBpdCBjYW4gYmUgb3BlbmVkIHdpdGggdGhlIE9wZW4gQWNjZXNzaWJsZSBWaWV3IGNvbW1hbmQuXFxuezB9XCIsIEJ1dHRvbihsb2NhbGl6ZSgnb3BlbkFjY2Vzc2libGVWaWV3JywgXCJPcGVuIEFjY2Vzc2libGUgVmlld1wiKSwgJ2NvbW1hbmQ6ZWRpdG9yLmFjdGlvbi5hY2Nlc3NpYmxlVmlldycpKSxcblx0XHRcdFx0XHRtZWRpYToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ21hcmtkb3duJywgcGF0aDogJ2VtcHR5J1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAndmVyYm9zaXR5U2V0dGluZ3MnLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQudmVyYm9zaXR5U2V0dGluZ3MudGl0bGUnLCBcIkNvbnRyb2wgdGhlIHZlcmJvc2l0eSBvZiBhcmlhIGxhYmVsc1wiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnZlcmJvc2l0eVNldHRpbmdzLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiU2NyZWVuIHJlYWRlciB2ZXJib3NpdHkgc2V0dGluZ3MgZXhpc3QgZm9yIGZlYXR1cmVzIGFyb3VuZCB0aGUgd29ya2JlbmNoIHNvIHRoYXQgb25jZSBhIHVzZXIgaXMgZmFtaWxpYXIgd2l0aCBhIGZlYXR1cmUsIHRoZXkgY2FuIGF2b2lkIGhlYXJpbmcgaGludHMgYWJvdXQgaG93IHRvIG9wZXJhdGUgaXQuIEZvciBleGFtcGxlLCBmZWF0dXJlcyBmb3Igd2hpY2ggYW4gYWNjZXNzaWJpbGl0eSBoZWxwIGRpYWxvZyBleGlzdHMgd2lsbCBpbmRpY2F0ZSBob3cgdG8gb3BlbiB0aGUgZGlhbG9nIHVudGlsIHRoZSB2ZXJib3NpdHkgc2V0dGluZyBmb3IgdGhhdCBmZWF0dXJlIGhhcyBiZWVuIGRpc2FibGVkLlxcbiBUaGVzZSBhbmQgb3RoZXIgYWNjZXNzaWJpbGl0eSBzZXR0aW5ncyBjYW4gYmUgY29uZmlndXJlZCBieSBydW5uaW5nIHRoZSBPcGVuIEFjY2Vzc2liaWxpdHkgU2V0dGluZ3MgY29tbWFuZC5cXG57MH1cIiwgQnV0dG9uKGxvY2FsaXplKCdvcGVuVmVyYm9zaXR5U2V0dGluZ3MnLCBcIk9wZW4gQWNjZXNzaWJpbGl0eSBTZXR0aW5nc1wiKSwgJ2NvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi5vcGVuQWNjZXNzaWJpbGl0eVNldHRpbmdzJykpLFxuXHRcdFx0XHRcdG1lZGlhOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnbWFya2Rvd24nLCBwYXRoOiAnZW1wdHknXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdjb21tYW5kUGFsZXR0ZVRhc2tBY2Nlc3NpYmlsaXR5Jyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmNvbW1hbmRQYWxldHRlQWNjZXNzaWJpbGl0eS50aXRsZScsIFwiVW5sb2NrIHByb2R1Y3Rpdml0eSB3aXRoIHRoZSBDb21tYW5kIFBhbGV0dGUgXCIpLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuY29tbWFuZFBhbGV0dGVBY2Nlc3NpYmlsaXR5LmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiUnVuIGNvbW1hbmRzIHdpdGhvdXQgcmVhY2hpbmcgZm9yIHlvdXIgbW91c2UgdG8gYWNjb21wbGlzaCBhbnkgdGFzayBpbiBWUyBDb2RlLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ2NvbW1hbmRQYWxldHRlJywgXCJPcGVuIENvbW1hbmQgUGFsZXR0ZVwiKSwgJ2NvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi5zaG93Q29tbWFuZHMnKSksXG5cdFx0XHRcdFx0bWVkaWE6IHsgdHlwZTogJ21hcmtkb3duJywgcGF0aDogJ2VtcHR5JyB9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdrZXliaW5kaW5nc0FjY2Vzc2liaWxpdHknLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQua2V5Ym9hcmRTaG9ydGN1dHMudGl0bGUnLCBcIkN1c3RvbWl6ZSB5b3VyIGtleWJvYXJkIHNob3J0Y3V0c1wiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmtleWJvYXJkU2hvcnRjdXRzLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiT25jZSB5b3UgaGF2ZSBkaXNjb3ZlcmVkIHlvdXIgZmF2b3JpdGUgY29tbWFuZHMsIGNyZWF0ZSBjdXN0b20ga2V5Ym9hcmQgc2hvcnRjdXRzIGZvciBpbnN0YW50IGFjY2Vzcy5cXG57MH1cIiwgQnV0dG9uKGxvY2FsaXplKCdrZXlib2FyZFNob3J0Y3V0cycsIFwiS2V5Ym9hcmQgU2hvcnRjdXRzXCIpLCAnY29tbWFuZDp0b1NpZGU6d29ya2JlbmNoLmFjdGlvbi5vcGVuR2xvYmFsS2V5YmluZGluZ3MnKSksXG5cdFx0XHRcdFx0bWVkaWE6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdtYXJrZG93bicsIHBhdGg6ICdlbXB0eScsXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdhY2Nlc3NpYmlsaXR5U2lnbmFscycsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5hY2Nlc3NpYmlsaXR5U2lnbmFscy50aXRsZScsIFwiRmluZSB0dW5lIHdoaWNoIGFjY2Vzc2liaWxpdHkgc2lnbmFscyB5b3Ugd2FudCB0byByZWNlaXZlIHZpYSBhdWRpbyBvciBhIGJyYWlsbGUgZGV2aWNlXCIpLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuYWNjZXNzaWJpbGl0eVNpZ25hbHMuZGVzY3JpcHRpb24uaW50ZXJwb2xhdGVkJywgXCJBY2Nlc3NpYmlsaXR5IHNvdW5kcyBhbmQgYW5ub3VuY2VtZW50cyBhcmUgcGxheWVkIGFyb3VuZCB0aGUgd29ya2JlbmNoIGZvciBkaWZmZXJlbnQgZXZlbnRzLlxcbiBUaGVzZSBjYW4gYmUgZGlzY292ZXJlZCBhbmQgY29uZmlndXJlZCB1c2luZyB0aGUgTGlzdCBTaWduYWwgU291bmRzIGFuZCBMaXN0IFNpZ25hbCBBbm5vdW5jZW1lbnRzIGNvbW1hbmRzLlxcbnswfVxcbnsxfVwiLCBCdXR0b24obG9jYWxpemUoJ2xpc3RTaWduYWxTb3VuZHMnLCBcIkxpc3QgU2lnbmFsIFNvdW5kc1wiKSwgJ2NvbW1hbmQ6c2lnbmFscy5zb3VuZHMuaGVscCcpLCBCdXR0b24obG9jYWxpemUoJ2xpc3RTaWduYWxBbm5vdW5jZW1lbnRzJywgXCJMaXN0IFNpZ25hbCBBbm5vdW5jZW1lbnRzXCIpLCAnY29tbWFuZDphY2Nlc3NpYmlsaXR5LmFubm91bmNlbWVudC5oZWxwJykpLFxuXHRcdFx0XHRcdG1lZGlhOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnbWFya2Rvd24nLCBwYXRoOiAnZW1wdHknXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdob3ZlcicsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5ob3Zlci50aXRsZScsIFwiQWNjZXNzIHRoZSBob3ZlciBpbiB0aGUgZWRpdG9yIHRvIGdldCBtb3JlIGluZm9ybWF0aW9uIG9uIGEgdmFyaWFibGUgb3Igc3ltYm9sXCIpLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuaG92ZXIuZGVzY3JpcHRpb24uaW50ZXJwb2xhdGVkJywgXCJXaGlsZSBmb2N1cyBpcyBpbiB0aGUgZWRpdG9yIG9uIGEgdmFyaWFibGUgb3Igc3ltYm9sLCBhIGhvdmVyIGNhbiBiZSBjYW4gYmUgZm9jdXNlZCB3aXRoIHRoZSBTaG93IG9yIE9wZW4gSG92ZXIgY29tbWFuZC5cXG57MH1cIiwgQnV0dG9uKGxvY2FsaXplKCdzaG93T3JGb2N1c0hvdmVyJywgXCJTaG93IG9yIEZvY3VzIEhvdmVyXCIpLCAnY29tbWFuZDplZGl0b3IuYWN0aW9uLnNob3dIb3ZlcicpKSxcblx0XHRcdFx0XHRtZWRpYToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ21hcmtkb3duJywgcGF0aDogJ2VtcHR5J1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnZ29Ub1N5bWJvbCcsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5nb1RvU3ltYm9sLnRpdGxlJywgXCJOYXZpZ2F0ZSB0byBzeW1ib2xzIGluIGEgZmlsZVwiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmdvVG9TeW1ib2wuZGVzY3JpcHRpb24uaW50ZXJwb2xhdGVkJywgXCJUaGUgR28gdG8gU3ltYm9sIGNvbW1hbmQgaXMgdXNlZnVsIGZvciBuYXZpZ2F0aW5nIGJldHdlZW4gaW1wb3J0YW50IGxhbmRtYXJrcyBpbiBhIGRvY3VtZW50LlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ29wZW5Hb1RvU3ltYm9sJywgXCJHbyB0byBTeW1ib2xcIiksICdjb21tYW5kOmVkaXRvci5hY3Rpb24uZ29Ub1N5bWJvbCcpKSxcblx0XHRcdFx0XHRtZWRpYToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ21hcmtkb3duJywgcGF0aDogJ2VtcHR5J1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnY29kZUZvbGRpbmcnLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuY29kZUZvbGRpbmcudGl0bGUnLCBcIlVzZSBjb2RlIGZvbGRpbmcgdG8gY29sbGFwc2UgYmxvY2tzIG9mIGNvZGUgYW5kIGZvY3VzIG9uIHRoZSBjb2RlIHlvdSdyZSBpbnRlcmVzdGVkIGluLlwiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmNvZGVGb2xkaW5nLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiRm9sZCBvciB1bmZvbGQgYSBjb2RlIHNlY3Rpb24gd2l0aCB0aGUgVG9nZ2xlIEZvbGQgY29tbWFuZC5cXG57MH1cXG4gRm9sZCBvciB1bmZvbGQgcmVjdXJzaXZlbHkgd2l0aCB0aGUgVG9nZ2xlIEZvbGQgUmVjdXJzaXZlbHkgQ29tbWFuZFxcbnsxfVxcblwiLCBCdXR0b24obG9jYWxpemUoJ3RvZ2dsZUZvbGQnLCBcIlRvZ2dsZSBGb2xkXCIpLCAnY29tbWFuZDplZGl0b3IudG9nZ2xlRm9sZCcpLCBCdXR0b24obG9jYWxpemUoJ3RvZ2dsZUZvbGRSZWN1cnNpdmVseScsIFwiVG9nZ2xlIEZvbGQgUmVjdXJzaXZlbHlcIiksICdjb21tYW5kOmVkaXRvci50b2dnbGVGb2xkUmVjdXJzaXZlbHknKSksXG5cdFx0XHRcdFx0bWVkaWE6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdtYXJrZG93bicsIHBhdGg6ICdlbXB0eSdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2ludGVsbGlzZW5zZScsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5pbnRlbGxpc2Vuc2UudGl0bGUnLCBcIlVzZSBJbnRlbGxpc2Vuc2UgdG8gaW1wcm92ZSBjb2RpbmcgZWZmaWNpZW5jeVwiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmludGVsbGlzZW5zZS5kZXNjcmlwdGlvbi5pbnRlcnBvbGF0ZWQnLCBcIkludGVsbGlzZW5zZSBzdWdnZXN0aW9ucyBjYW4gYmUgb3BlbmVkIHdpdGggdGhlIFRyaWdnZXIgSW50ZWxsaXNlbnNlIGNvbW1hbmQuXFxuezB9XFxuIElubGluZSBpbnRlbGxpc2Vuc2Ugc3VnZ2VzdGlvbnMgY2FuIGJlIHRyaWdnZXJlZCB3aXRoIFRyaWdnZXIgSW5saW5lIFN1Z2dlc3Rpb25cXG57MX1cXG4gVXNlZnVsIHNldHRpbmdzIGluY2x1ZGUgZWRpdG9yLmlubGluZUNvbXBsZXRpb25zQWNjZXNzaWJpbGl0eVZlcmJvc2UgYW5kIGVkaXRvci5zY3JlZW5SZWFkZXJBbm5vdW5jZUlubGluZVN1Z2dlc3Rpb24uXCIsIEJ1dHRvbihsb2NhbGl6ZSgndHJpZ2dlckludGVsbGlzZW5zZScsIFwiVHJpZ2dlciBJbnRlbGxpc2Vuc2VcIiksICdjb21tYW5kOmVkaXRvci5hY3Rpb24udHJpZ2dlclN1Z2dlc3QnKSwgQnV0dG9uKGxvY2FsaXplKCd0cmlnZ2VySW5saW5lU3VnZ2VzdGlvbicsICdUcmlnZ2VyIElubGluZSBTdWdnZXN0aW9uJyksICdjb21tYW5kOmVkaXRvci5hY3Rpb24uaW5saW5lU3VnZ2VzdC50cmlnZ2VyJykpLFxuXHRcdFx0XHRcdG1lZGlhOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnbWFya2Rvd24nLCBwYXRoOiAnZW1wdHknXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdhY2Nlc3NpYmlsaXR5U2V0dGluZ3MnLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuYWNjZXNzaWJpbGl0eVNldHRpbmdzLnRpdGxlJywgXCJDb25maWd1cmUgYWNjZXNzaWJpbGl0eSBzZXR0aW5nc1wiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmFjY2Vzc2liaWxpdHlTZXR0aW5ncy5kZXNjcmlwdGlvbi5pbnRlcnBvbGF0ZWQnLCBcIkFjY2Vzc2liaWxpdHkgc2V0dGluZ3MgY2FuIGJlIGNvbmZpZ3VyZWQgYnkgcnVubmluZyB0aGUgT3BlbiBBY2Nlc3NpYmlsaXR5IFNldHRpbmdzIGNvbW1hbmQuXFxuezB9XCIsIEJ1dHRvbihsb2NhbGl6ZSgnb3BlbkFjY2Vzc2liaWxpdHlTZXR0aW5ncycsIFwiT3BlbiBBY2Nlc3NpYmlsaXR5IFNldHRpbmdzXCIpLCAnY29tbWFuZDp3b3JrYmVuY2guYWN0aW9uLm9wZW5BY2Nlc3NpYmlsaXR5U2V0dGluZ3MnKSksXG5cdFx0XHRcdFx0bWVkaWE6IHsgdHlwZTogJ21hcmtkb3duJywgcGF0aDogJ2VtcHR5JyB9XG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9XG5cdH0sXG5cdHtcblx0XHRpZDogJ0JlZ2lubmVyJyxcblx0XHRpc0ZlYXR1cmVkOiBmYWxzZSxcblx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmJlZ2lubmVyLnRpdGxlJywgXCJMZWFybiB0aGUgRnVuZGFtZW50YWxzXCIpLFxuXHRcdGljb246IGJlZ2lubmVySWNvbixcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmJlZ2lubmVyLmRlc2NyaXB0aW9uJywgXCJHZXQgYW4gb3ZlcnZpZXcgb2YgdGhlIG1vc3QgZXNzZW50aWFsIGZlYXR1cmVzXCIpLFxuXHRcdHdhbGt0aHJvdWdoUGFnZVRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuYmVnaW5uZXIud2Fsa3Rocm91Z2hQYWdlVGl0bGUnLCAnRXNzZW50aWFsIEZlYXR1cmVzJyksXG5cdFx0Y29udGVudDoge1xuXHRcdFx0dHlwZTogJ3N0ZXBzJyxcblx0XHRcdHN0ZXBzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2V4dGVuc2lvbnMnLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuZXh0ZW5zaW9ucy50aXRsZScsIFwiQ29kZSB3aXRoIGV4dGVuc2lvbnNcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5leHRlbnNpb25zLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiRXh0ZW5zaW9ucyBhcmUgVlMgQ29kZSdzIHBvd2VyLXVwcy4gVGhleSByYW5nZSBmcm9tIGhhbmR5IHByb2R1Y3Rpdml0eSBoYWNrcywgZXhwYW5kaW5nIG91dC1vZi10aGUtYm94IGZlYXR1cmVzLCB0byBhZGRpbmcgY29tcGxldGVseSBuZXcgY2FwYWJpbGl0aWVzLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ2Jyb3dzZVBvcHVsYXInLCBcIkJyb3dzZSBQb3B1bGFyIEV4dGVuc2lvbnNcIiksICdjb21tYW5kOndvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5zaG93UG9wdWxhckV4dGVuc2lvbnMnKSksXG5cdFx0XHRcdFx0d2hlbjogJ3dvcmtzcGFjZVBsYXRmb3JtICE9IFxcJ3dlYndvcmtlclxcJycsXG5cdFx0XHRcdFx0bWVkaWE6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdmcnLCBhbHRUZXh0OiAnVlMgQ29kZSBleHRlbnNpb24gbWFya2V0cGxhY2Ugd2l0aCBmZWF0dXJlZCBsYW5ndWFnZSBleHRlbnNpb25zJywgcGF0aDogJ2V4dGVuc2lvbnMuc3ZnJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ3Rlcm1pbmFsJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnRlcm1pbmFsLnRpdGxlJywgXCJCdWlsdC1pbiB0ZXJtaW5hbFwiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnRlcm1pbmFsLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiUXVpY2tseSBydW4gc2hlbGwgY29tbWFuZHMgYW5kIG1vbml0b3IgYnVpbGQgb3V0cHV0LCByaWdodCBuZXh0IHRvIHlvdXIgY29kZS5cXG57MH1cIiwgQnV0dG9uKGxvY2FsaXplKCdzaG93VGVybWluYWwnLCBcIk9wZW4gVGVybWluYWxcIiksICdjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24udGVybWluYWwudG9nZ2xlVGVybWluYWwnKSksXG5cdFx0XHRcdFx0d2hlbjogJ3dvcmtzcGFjZVBsYXRmb3JtICE9IFxcJ3dlYndvcmtlclxcJyAmJiByZW1vdGVOYW1lICE9IGNvZGVzcGFjZXMgJiYgIXRlcm1pbmFsSXNPcGVuJyxcblx0XHRcdFx0XHRtZWRpYToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N2ZycsIGFsdFRleHQ6ICdJbnRlZ3JhdGVkIHRlcm1pbmFsIHJ1bm5pbmcgYSBmZXcgbnBtIGNvbW1hbmRzJywgcGF0aDogJ3Rlcm1pbmFsLnN2Zydcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdkZWJ1Z2dpbmcnLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuZGVidWcudGl0bGUnLCBcIldhdGNoIHlvdXIgY29kZSBpbiBhY3Rpb25cIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5kZWJ1Zy5kZXNjcmlwdGlvbi5pbnRlcnBvbGF0ZWQnLCBcIkFjY2VsZXJhdGUgeW91ciBlZGl0LCBidWlsZCwgdGVzdCwgYW5kIGRlYnVnIGxvb3AgYnkgc2V0dGluZyB1cCBhIGxhdW5jaCBjb25maWd1cmF0aW9uLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ3J1blByb2plY3QnLCBcIlJ1biB5b3VyIFByb2plY3RcIiksICdjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24uZGVidWcuc2VsZWN0YW5kc3RhcnQnKSksXG5cdFx0XHRcdFx0d2hlbjogJ3dvcmtzcGFjZVBsYXRmb3JtICE9IFxcJ3dlYndvcmtlclxcJyAmJiB3b3Jrc3BhY2VGb2xkZXJDb3VudCAhPSAwJyxcblx0XHRcdFx0XHRtZWRpYToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N2ZycsIGFsdFRleHQ6ICdSdW4gYW5kIGRlYnVnIHZpZXcuJywgcGF0aDogJ2RlYnVnLnN2ZycsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnc2NtQ2xvbmUnLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuc2NtLnRpdGxlJywgXCJUcmFjayB5b3VyIGNvZGUgd2l0aCBHaXRcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5zY21DbG9uZS5kZXNjcmlwdGlvbi5pbnRlcnBvbGF0ZWQnLCBcIlNldCB1cCB0aGUgYnVpbHQtaW4gdmVyc2lvbiBjb250cm9sIGZvciB5b3VyIHByb2plY3QgdG8gdHJhY2sgeW91ciBjaGFuZ2VzIGFuZCBjb2xsYWJvcmF0ZSB3aXRoIG90aGVycy5cXG57MH1cIiwgQnV0dG9uKGxvY2FsaXplKCdjbG9uZVJlcG8nLCBcIkNsb25lIFJlcG9zaXRvcnlcIiksICdjb21tYW5kOmdpdC5jbG9uZScpKSxcblx0XHRcdFx0XHR3aGVuOiAnY29uZmlnLmdpdC5lbmFibGVkICYmICFnaXQubWlzc2luZyAmJiB3b3Jrc3BhY2VGb2xkZXJDb3VudCA9PSAwJyxcblx0XHRcdFx0XHRtZWRpYToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N2ZycsIGFsdFRleHQ6ICdTb3VyY2UgQ29udHJvbCB2aWV3LicsIHBhdGg6ICdnaXQuc3ZnJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdzY21TZXR1cCcsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5zY20udGl0bGUnLCBcIlRyYWNrIHlvdXIgY29kZSB3aXRoIEdpdFwiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnNjbVNldHVwLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiU2V0IHVwIHRoZSBidWlsdC1pbiB2ZXJzaW9uIGNvbnRyb2wgZm9yIHlvdXIgcHJvamVjdCB0byB0cmFjayB5b3VyIGNoYW5nZXMgYW5kIGNvbGxhYm9yYXRlIHdpdGggb3RoZXJzLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ2luaXRSZXBvJywgXCJJbml0aWFsaXplIEdpdCBSZXBvc2l0b3J5XCIpLCAnY29tbWFuZDpnaXQuaW5pdCcpKSxcblx0XHRcdFx0XHR3aGVuOiAnY29uZmlnLmdpdC5lbmFibGVkICYmICFnaXQubWlzc2luZyAmJiB3b3Jrc3BhY2VGb2xkZXJDb3VudCAhPSAwICYmIGdpdE9wZW5SZXBvc2l0b3J5Q291bnQgPT0gMCcsXG5cdFx0XHRcdFx0bWVkaWE6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdmcnLCBhbHRUZXh0OiAnU291cmNlIENvbnRyb2wgdmlldy4nLCBwYXRoOiAnZ2l0LnN2ZycsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnc2NtJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnNjbS50aXRsZScsIFwiVHJhY2sgeW91ciBjb2RlIHdpdGggR2l0XCIpLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuc2NtLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiTm8gbW9yZSBsb29raW5nIHVwIEdpdCBjb21tYW5kcyEgR2l0IGFuZCBHaXRIdWIgd29ya2Zsb3dzIGFyZSBzZWFtbGVzc2x5IGludGVncmF0ZWQuXFxuezB9XCIsIEJ1dHRvbihsb2NhbGl6ZSgnb3BlblNDTScsIFwiT3BlbiBTb3VyY2UgQ29udHJvbFwiKSwgJ2NvbW1hbmQ6d29ya2JlbmNoLnZpZXcuc2NtJykpLFxuXHRcdFx0XHRcdHdoZW46ICdjb25maWcuZ2l0LmVuYWJsZWQgJiYgIWdpdC5taXNzaW5nICYmIHdvcmtzcGFjZUZvbGRlckNvdW50ICE9IDAgJiYgZ2l0T3BlblJlcG9zaXRvcnlDb3VudCAhPSAwICYmIGFjdGl2ZVZpZXdsZXQgIT0gXFwnd29ya2JlbmNoLnZpZXcuc2NtXFwnJyxcblx0XHRcdFx0XHRtZWRpYToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N2ZycsIGFsdFRleHQ6ICdTb3VyY2UgQ29udHJvbCB2aWV3LicsIHBhdGg6ICdnaXQuc3ZnJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdpbnN0YWxsR2l0Jyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLmluc3RhbGxHaXQudGl0bGUnLCBcIkluc3RhbGwgR2l0XCIpLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSh7IGtleTogJ2dldHRpbmdTdGFydGVkLmluc3RhbGxHaXQuZGVzY3JpcHRpb24uaW50ZXJwb2xhdGVkJywgY29tbWVudDogWydUaGUgcGxhY2Vob2xkZXJzIGFyZSBjb21tYW5kIGxpbmsgaXRlbXMgc2hvdWxkIG5vdCBiZSB0cmFuc2xhdGVkJ10gfSwgXCJJbnN0YWxsIEdpdCB0byB0cmFjayBjaGFuZ2VzIGluIHlvdXIgcHJvamVjdHMuXFxuezB9XFxuezF9UmVsb2FkIHdpbmRvd3syfSBhZnRlciBpbnN0YWxsYXRpb24gdG8gY29tcGxldGUgR2l0IHNldHVwLlwiLCBCdXR0b24obG9jYWxpemUoJ2luc3RhbGxHaXQnLCBcIkluc3RhbGwgR2l0XCIpLCAnaHR0cHM6Ly9ha2EubXMvdnNjb2RlLWluc3RhbGwtZ2l0JyksICdbJywgJ10oY29tbWFuZDp3b3JrYmVuY2guYWN0aW9uLnJlbG9hZFdpbmRvdyknKSxcblx0XHRcdFx0XHR3aGVuOiAnZ2l0Lm1pc3NpbmcnLFxuXHRcdFx0XHRcdG1lZGlhOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3ZnJywgYWx0VGV4dDogJ0luc3RhbGwgR2l0LicsIHBhdGg6ICdnaXQuc3ZnJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGNvbXBsZXRpb25FdmVudHM6IFtcblx0XHRcdFx0XHRcdCdvbkNvbnRleHQ6Z2l0LnN0YXRlID09IGluaXRpYWxpemVkJ1xuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICd0YXNrcycsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC50YXNrcy50aXRsZScsIFwiQXV0b21hdGUgeW91ciBwcm9qZWN0IHRhc2tzXCIpLFxuXHRcdFx0XHRcdHdoZW46ICd3b3Jrc3BhY2VGb2xkZXJDb3VudCAhPSAwICYmIHdvcmtzcGFjZVBsYXRmb3JtICE9IFxcJ3dlYndvcmtlclxcJycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC50YXNrcy5kZXNjcmlwdGlvbi5pbnRlcnBvbGF0ZWQnLCBcIkNyZWF0ZSB0YXNrcyBmb3IgeW91ciBjb21tb24gd29ya2Zsb3dzIGFuZCBlbmpveSB0aGUgaW50ZWdyYXRlZCBleHBlcmllbmNlIG9mIHJ1bm5pbmcgc2NyaXB0cyBhbmQgYXV0b21hdGljYWxseSBjaGVja2luZyByZXN1bHRzLlxcbnswfVwiLCBCdXR0b24obG9jYWxpemUoJ3J1blRhc2tzJywgXCJSdW4gQXV0by1kZXRlY3RlZCBUYXNrc1wiKSwgJ2NvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi50YXNrcy5ydW5UYXNrJykpLFxuXHRcdFx0XHRcdG1lZGlhOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3ZnJywgYWx0VGV4dDogJ1Rhc2sgcnVubmVyLicsIHBhdGg6ICdydW5UYXNrLnN2ZycsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnc2hvcnRjdXRzJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLnNob3J0Y3V0cy50aXRsZScsIFwiQ3VzdG9taXplIHlvdXIgc2hvcnRjdXRzXCIpLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQuc2hvcnRjdXRzLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiT25jZSB5b3UgaGF2ZSBkaXNjb3ZlcmVkIHlvdXIgZmF2b3JpdGUgY29tbWFuZHMsIGNyZWF0ZSBjdXN0b20ga2V5Ym9hcmQgc2hvcnRjdXRzIGZvciBpbnN0YW50IGFjY2Vzcy5cXG57MH1cIiwgQnV0dG9uKGxvY2FsaXplKCdrZXlib2FyZFNob3J0Y3V0cycsIFwiS2V5Ym9hcmQgU2hvcnRjdXRzXCIpLCAnY29tbWFuZDp0b1NpZGU6d29ya2JlbmNoLmFjdGlvbi5vcGVuR2xvYmFsS2V5YmluZGluZ3MnKSksXG5cdFx0XHRcdFx0bWVkaWE6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdmcnLCBhbHRUZXh0OiAnSW50ZXJhY3RpdmUgc2hvcnRjdXRzLicsIHBhdGg6ICdzaG9ydGN1dHMuc3ZnJyxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ3dvcmtzcGFjZVRydXN0Jyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLndvcmtzcGFjZVRydXN0LnRpdGxlJywgXCJTYWZlbHkgYnJvd3NlIGFuZCBlZGl0IGNvZGVcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC53b3Jrc3BhY2VUcnVzdC5kZXNjcmlwdGlvbi5pbnRlcnBvbGF0ZWQnLCBcInswfSBsZXRzIHlvdSBkZWNpZGUgd2hldGhlciB5b3VyIHByb2plY3QgZm9sZGVycyBzaG91bGQgKiphbGxvdyBvciByZXN0cmljdCoqIGF1dG9tYXRpYyBjb2RlIGV4ZWN1dGlvbiBfXyhyZXF1aXJlZCBmb3IgZXh0ZW5zaW9ucywgZGVidWdnaW5nLCBldGMpX18uXFxuT3BlbmluZyBhIGZpbGUvZm9sZGVyIHdpbGwgcHJvbXB0IHRvIGdyYW50IHRydXN0LiBZb3UgY2FuIGFsd2F5cyB7MX0gbGF0ZXIuXCIsIEJ1dHRvbihsb2NhbGl6ZSgnd29ya3NwYWNlVHJ1c3QnLCBcIldvcmtzcGFjZSBUcnVzdFwiKSwgJ2h0dHBzOi8vY29kZS52aXN1YWxzdHVkaW8uY29tL2RvY3MvZWRpdG9yL3dvcmtzcGFjZS10cnVzdCcpLCBCdXR0b24obG9jYWxpemUoJ2VuYWJsZVRydXN0JywgXCJlbmFibGUgdHJ1c3RcIiksICdjb21tYW5kOnRvU2lkZTp3b3JrYmVuY2gudHJ1c3QubWFuYWdlJykpLFxuXHRcdFx0XHRcdHdoZW46ICd3b3Jrc3BhY2VQbGF0Zm9ybSAhPSBcXCd3ZWJ3b3JrZXJcXCcgJiYgIWlzV29ya3NwYWNlVHJ1c3RlZCAmJiB3b3Jrc3BhY2VGb2xkZXJDb3VudCA9PSAwJyxcblx0XHRcdFx0XHRtZWRpYToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N2ZycsIGFsdFRleHQ6ICdXb3Jrc3BhY2UgVHJ1c3QgZWRpdG9yIGluIFJlc3RyaWN0ZWQgbW9kZSBhbmQgYSBwcmltYXJ5IGJ1dHRvbiBmb3Igc3dpdGNoaW5nIHRvIFRydXN0ZWQgbW9kZS4nLCBwYXRoOiAnd29ya3NwYWNlVHJ1c3Quc3ZnJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRdXG5cdFx0fVxuXHR9LFxuXHR7XG5cdFx0aWQ6ICdub3RlYm9va3MnLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQubm90ZWJvb2sudGl0bGUnLCBcIkN1c3RvbWl6ZSBOb3RlYm9va3NcIiksXG5cdFx0ZGVzY3JpcHRpb246ICcnLFxuXHRcdGljb246IHNldHVwSWNvbixcblx0XHRpc0ZlYXR1cmVkOiBmYWxzZSxcblx0XHR3aGVuOiBgY29uZmlnLiR7Tm90ZWJvb2tTZXR0aW5nLm9wZW5HZXR0aW5nU3RhcnRlZH0gJiYgdXNlckhhc09wZW5lZE5vdGVib29rYCxcblx0XHR3YWxrdGhyb3VnaFBhZ2VUaXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLm5vdGVib29rLndhbGt0aHJvdWdoUGFnZVRpdGxlJywgJ05vdGVib29rcycpLFxuXHRcdGNvbnRlbnQ6IHtcblx0XHRcdHR5cGU6ICdzdGVwcycsXG5cdFx0XHRzdGVwczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29tcGxldGlvbkV2ZW50czogWydvbkNvbW1hbmQ6bm90ZWJvb2suc2V0UHJvZmlsZSddLFxuXHRcdFx0XHRcdGlkOiAnbm90ZWJvb2tQcm9maWxlJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2dldHRpbmdTdGFydGVkLm5vdGVib29rUHJvZmlsZS50aXRsZScsIFwiU2VsZWN0IHRoZSBsYXlvdXQgZm9yIHlvdXIgbm90ZWJvb2tzXCIpLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZ2V0dGluZ1N0YXJ0ZWQubm90ZWJvb2tQcm9maWxlLmRlc2NyaXB0aW9uJywgXCJHZXQgbm90ZWJvb2tzIHRvIGZlZWwganVzdCB0aGUgd2F5IHlvdSBwcmVmZXJcIiksXG5cdFx0XHRcdFx0d2hlbjogJ3VzZXJIYXNPcGVuZWROb3RlYm9vaycsXG5cdFx0XHRcdFx0bWVkaWE6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdtYXJrZG93bicsIHBhdGg6ICdub3RlYm9va1Byb2ZpbGUnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XVxuXHRcdH1cblx0fVxuXTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sd0JBQXdCO0FBQy9CLE9BQU8sNEJBQTRCO0FBQ25DLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBZTtBQUV4QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDBDQUEw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
