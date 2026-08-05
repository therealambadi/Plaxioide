import assert from "assert";
import { createURI } from "../testUtils/createUri.js";
import { Schemas } from "../../../../../../../base/common/network.js";
import { basename } from "../../../../../../../base/common/resources.js";
import { isWindows } from "../../../../../../../base/common/platform.js";
import { MockFilesystem } from "../testUtils/mockFilesystem.js";
import { IFileService } from "../../../../../../../platform/files/common/files.js";
import { PromptsConfig } from "../../../../../../../platform/prompts/common/config.js";
import { FileService } from "../../../../../../../platform/files/common/fileService.js";
import { ILogService, NullLogService } from "../../../../../../../platform/log/common/log.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../../base/test/common/utils.js";
import { mockObject, mockService } from "../../../../../../../platform/prompts/test/common/utils/mock.js";
import { isValidGlob, PromptFilesLocator } from "../../../../common/promptSyntax/utils/promptFilesLocator.js";
import { InMemoryFileSystemProvider } from "../../../../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { TestInstantiationService } from "../../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { IWorkspaceContextService } from "../../../../../../../platform/workspace/common/workspace.js";
const mockConfigService = (value) => {
  return mockService({
    getValue(key) {
      assert(
        typeof key === "string",
        `Expected string configuration key, got '${typeof key}'.`
      );
      assert(
        [PromptsConfig.KEY, PromptsConfig.LOCATIONS_KEY].includes(key),
        `Unsupported configuration key '${key}'.`
      );
      return value;
    }
  });
};
const mockWorkspaceService = (folders) => {
  return mockService({
    getWorkspace() {
      return mockObject({
        folders
      });
    }
  });
};
suite("PromptFilesLocator", () => {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  if (isWindows) {
    return;
  }
  let initService;
  setup(async () => {
    initService = disposables.add(new TestInstantiationService());
    initService.stub(ILogService, new NullLogService());
    const fileService = disposables.add(initService.createInstance(FileService));
    const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
    disposables.add(fileService.registerProvider(Schemas.file, fileSystemProvider));
    initService.stub(IFileService, fileService);
  });
  const createPromptsLocator = async (configValue, workspaceFolderPaths, filesystem) => {
    await initService.createInstance(MockFilesystem, filesystem).mock();
    initService.stub(IConfigurationService, mockConfigService(configValue));
    const workspaceFolders = workspaceFolderPaths.map((path, index) => {
      const uri = createURI(path);
      return mockObject({
        uri,
        name: basename(uri),
        index
      });
    });
    initService.stub(IWorkspaceContextService, mockWorkspaceService(workspaceFolders));
    return initService.createInstance(PromptFilesLocator);
  };
  suite("\u2022 empty workspace", () => {
    const EMPTY_WORKSPACE = [];
    suite("\u2022 empty filesystem", () => {
      test("\u2022 no config value", async () => {
        const locator = await createPromptsLocator(void 0, EMPTY_WORKSPACE, []);
        assert.deepStrictEqual(
          (await locator.listFiles()).map((file) => file.fsPath),
          [],
          "No prompts must be found."
        );
      });
      test("\u2022 object config value", async () => {
        const locator = await createPromptsLocator({
          "/Users/legomushroom/repos/prompts/": true,
          "/tmp/prompts/": false
        }, EMPTY_WORKSPACE, []);
        assert.deepStrictEqual(
          await locator.listFiles(),
          [],
          "No prompts must be found."
        );
      });
      test("\u2022 array config value", async () => {
        const locator = await createPromptsLocator([
          "relative/path/to/prompts/",
          "/abs/path"
        ], EMPTY_WORKSPACE, []);
        assert.deepStrictEqual(
          await locator.listFiles(),
          [],
          "No prompts must be found."
        );
      });
      test("\u2022 null config value", async () => {
        const locator = await createPromptsLocator(null, EMPTY_WORKSPACE, []);
        assert.deepStrictEqual(
          (await locator.listFiles()).map((file) => file.fsPath),
          [],
          "No prompts must be found."
        );
      });
      test("\u2022 string config value", async () => {
        const locator = await createPromptsLocator("/etc/hosts/prompts", EMPTY_WORKSPACE, []);
        assert.deepStrictEqual(
          (await locator.listFiles()).map((file) => file.fsPath),
          [],
          "No prompts must be found."
        );
      });
    });
    suite("\u2022 non-empty filesystem", () => {
      test("\u2022 core logic", async () => {
        const locator = await createPromptsLocator(
          {
            "/Users/legomushroom/repos/prompts": true,
            "/tmp/prompts/": true,
            "/absolute/path/prompts": false,
            ".copilot/prompts": true
          },
          EMPTY_WORKSPACE,
          [
            {
              name: "/Users/legomushroom/repos/prompts",
              children: [
                {
                  name: "test.prompt.md",
                  contents: "Hello, World!"
                },
                {
                  name: "refactor-tests.prompt.md",
                  contents: "some file content goes here"
                }
              ]
            },
            {
              name: "/tmp/prompts",
              children: [
                {
                  name: "translate.to-rust.prompt.md",
                  contents: "some more random file contents"
                }
              ]
            },
            {
              name: "/absolute/path/prompts",
              children: [
                {
                  name: "some-prompt-file.prompt.md",
                  contents: "hey hey hey"
                }
              ]
            }
          ]
        );
        assert.deepStrictEqual(
          (await locator.listFiles()).map((file) => file.fsPath),
          [
            createURI("/Users/legomushroom/repos/prompts/test.prompt.md").path,
            createURI("/Users/legomushroom/repos/prompts/refactor-tests.prompt.md").path,
            createURI("/tmp/prompts/translate.to-rust.prompt.md").path
          ],
          "Must find correct prompts."
        );
      });
      suite("\u2022 absolute", () => {
        suite("\u2022 wild card", () => {
          const settings = [
            "/Users/legomushroom/repos/vscode/**",
            "/Users/legomushroom/repos/vscode/**/*.prompt.md",
            "/Users/legomushroom/repos/vscode/**/*.md",
            "/Users/legomushroom/repos/vscode/**/*",
            "/Users/legomushroom/repos/vscode/deps/**",
            "/Users/legomushroom/repos/vscode/deps/**/*.prompt.md",
            "/Users/legomushroom/repos/vscode/deps/**/*",
            "/Users/legomushroom/repos/vscode/deps/**/*.md",
            "/Users/legomushroom/repos/vscode/**/text/**",
            "/Users/legomushroom/repos/vscode/**/text/**/*",
            "/Users/legomushroom/repos/vscode/**/text/**/*.md",
            "/Users/legomushroom/repos/vscode/**/text/**/*.prompt.md",
            "/Users/legomushroom/repos/vscode/deps/text/**",
            "/Users/legomushroom/repos/vscode/deps/text/**/*",
            "/Users/legomushroom/repos/vscode/deps/text/**/*.md",
            "/Users/legomushroom/repos/vscode/deps/text/**/*.prompt.md"
          ];
          for (const setting of settings) {
            test(`\u2022 '${setting}'`, async () => {
              const locator = await createPromptsLocator(
                { [setting]: true },
                EMPTY_WORKSPACE,
                [
                  {
                    name: "/Users/legomushroom/repos/vscode",
                    children: [
                      {
                        name: "deps/text",
                        children: [
                          {
                            name: "my.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "nested",
                            children: [
                              {
                                name: "specific.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "unspecific1.prompt.md",
                                contents: "oh hi, robot!"
                              },
                              {
                                name: "unspecific2.prompt.md",
                                contents: "oh hi, rabot!"
                              },
                              {
                                name: "readme.md",
                                contents: "non prompt file"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              );
              assert.deepStrictEqual(
                (await locator.listFiles()).map((file) => file.fsPath),
                [
                  createURI("/Users/legomushroom/repos/vscode/deps/text/my.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/specific.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/unspecific1.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/unspecific2.prompt.md").fsPath
                ],
                "Must find correct prompts."
              );
            });
          }
        });
        suite(`\u2022 specific`, () => {
          const testSettings = [
            [
              "/Users/legomushroom/repos/vscode/**/*specific*"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/*specific*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/*specific*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/specific*",
              "/Users/legomushroom/repos/vscode/**/unspecific1.prompt.md",
              "/Users/legomushroom/repos/vscode/**/unspecific2.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/**/unspecific*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/nested/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/**/nested/unspecific*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/nested/*specific*"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/*spec*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/*spec*"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/*spec*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/deps/**/*spec*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/text/**/*spec*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/nested/*spec*"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/nested/*specific*"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/**/*specific*"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/**/specific*",
              "/Users/legomushroom/repos/vscode/deps/**/unspecific*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/**/specific*.md",
              "/Users/legomushroom/repos/vscode/deps/**/unspecific*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/**/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/deps/**/unspecific1.prompt.md",
              "/Users/legomushroom/repos/vscode/deps/**/unspecific2.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/**/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/deps/**/unspecific1*.md",
              "/Users/legomushroom/repos/vscode/deps/**/unspecific2*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/**/*specific*"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/**/specific*",
              "/Users/legomushroom/repos/vscode/deps/text/**/unspecific*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/**/specific*.md",
              "/Users/legomushroom/repos/vscode/deps/text/**/unspecific*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/**/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/deps/text/**/unspecific1.prompt.md",
              "/Users/legomushroom/repos/vscode/deps/text/**/unspecific2.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/**/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/deps/text/**/unspecific1*.md",
              "/Users/legomushroom/repos/vscode/deps/text/**/unspecific2*.md"
            ]
          ];
          for (const settings of testSettings) {
            test(`\u2022 '${JSON.stringify(settings)}'`, async () => {
              const vscodeSettings = {};
              for (const setting of settings) {
                vscodeSettings[setting] = true;
              }
              const locator = await createPromptsLocator(
                vscodeSettings,
                EMPTY_WORKSPACE,
                [
                  {
                    name: "/Users/legomushroom/repos/vscode",
                    children: [
                      {
                        name: "deps/text",
                        children: [
                          {
                            name: "my.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "nested",
                            children: [
                              {
                                name: "default.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "specific.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "unspecific1.prompt.md",
                                contents: "oh hi, robot!"
                              },
                              {
                                name: "unspecific2.prompt.md",
                                contents: "oh hi, rawbot!"
                              },
                              {
                                name: "readme.md",
                                contents: "non prompt file"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              );
              assert.deepStrictEqual(
                (await locator.listFiles()).map((file) => file.fsPath),
                [
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/specific.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/unspecific1.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/unspecific2.prompt.md").fsPath
                ],
                "Must find correct prompts."
              );
            });
          }
        });
      });
    });
  });
  suite("\u2022 single-root workspace", () => {
    suite("\u2022 glob pattern", () => {
      suite("\u2022 relative", () => {
        suite("\u2022 wild card", () => {
          const testSettings = [
            "**",
            "**/*.prompt.md",
            "**/*.md",
            "**/*",
            "deps/**",
            "deps/**/*.prompt.md",
            "deps/**/*",
            "deps/**/*.md",
            "**/text/**",
            "**/text/**/*",
            "**/text/**/*.md",
            "**/text/**/*.prompt.md",
            "deps/text/**",
            "deps/text/**/*",
            "deps/text/**/*.md",
            "deps/text/**/*.prompt.md"
          ];
          for (const setting of testSettings) {
            test(`\u2022 '${setting}'`, async () => {
              const locator = await createPromptsLocator(
                { [setting]: true },
                ["/Users/legomushroom/repos/vscode"],
                [
                  {
                    name: "/Users/legomushroom/repos/vscode",
                    children: [
                      {
                        name: "deps/text",
                        children: [
                          {
                            name: "my.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "nested",
                            children: [
                              {
                                name: "specific.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "unspecific1.prompt.md",
                                contents: "oh hi, robot!"
                              },
                              {
                                name: "unspecific2.prompt.md",
                                contents: "oh hi, rabot!"
                              },
                              {
                                name: "readme.md",
                                contents: "non prompt file"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              );
              assert.deepStrictEqual(
                (await locator.listFiles()).map((file) => file.fsPath),
                [
                  createURI("/Users/legomushroom/repos/vscode/deps/text/my.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/specific.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/unspecific1.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/unspecific2.prompt.md").fsPath
                ],
                "Must find correct prompts."
              );
            });
          }
        });
        suite(`\u2022 specific`, () => {
          const testSettings = [
            [
              "**/*specific*"
            ],
            [
              "**/*specific*.prompt.md"
            ],
            [
              "**/*specific*.md"
            ],
            [
              "**/specific*",
              "**/unspecific1.prompt.md",
              "**/unspecific2.prompt.md"
            ],
            [
              "**/specific.prompt.md",
              "**/unspecific*.prompt.md"
            ],
            [
              "**/nested/specific.prompt.md",
              "**/nested/unspecific*.prompt.md"
            ],
            [
              "**/nested/*specific*"
            ],
            [
              "**/*spec*.prompt.md"
            ],
            [
              "**/*spec*"
            ],
            [
              "**/*spec*.md"
            ],
            [
              "**/deps/**/*spec*.md"
            ],
            [
              "**/text/**/*spec*.md"
            ],
            [
              "deps/text/nested/*spec*"
            ],
            [
              "deps/text/nested/*specific*"
            ],
            [
              "deps/**/*specific*"
            ],
            [
              "deps/**/specific*",
              "deps/**/unspecific*.prompt.md"
            ],
            [
              "deps/**/specific*.md",
              "deps/**/unspecific*.md"
            ],
            [
              "deps/**/specific.prompt.md",
              "deps/**/unspecific1.prompt.md",
              "deps/**/unspecific2.prompt.md"
            ],
            [
              "deps/**/specific.prompt.md",
              "deps/**/unspecific1*.md",
              "deps/**/unspecific2*.md"
            ],
            [
              "deps/text/**/*specific*"
            ],
            [
              "deps/text/**/specific*",
              "deps/text/**/unspecific*.prompt.md"
            ],
            [
              "deps/text/**/specific*.md",
              "deps/text/**/unspecific*.md"
            ],
            [
              "deps/text/**/specific.prompt.md",
              "deps/text/**/unspecific1.prompt.md",
              "deps/text/**/unspecific2.prompt.md"
            ],
            [
              "deps/text/**/specific.prompt.md",
              "deps/text/**/unspecific1*.md",
              "deps/text/**/unspecific2*.md"
            ]
          ];
          for (const settings of testSettings) {
            test(`\u2022 '${JSON.stringify(settings)}'`, async () => {
              const vscodeSettings = {};
              for (const setting of settings) {
                vscodeSettings[setting] = true;
              }
              const locator = await createPromptsLocator(
                vscodeSettings,
                ["/Users/legomushroom/repos/vscode"],
                [
                  {
                    name: "/Users/legomushroom/repos/vscode",
                    children: [
                      {
                        name: "deps/text",
                        children: [
                          {
                            name: "my.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "nested",
                            children: [
                              {
                                name: "default.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "specific.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "unspecific1.prompt.md",
                                contents: "oh hi, robot!"
                              },
                              {
                                name: "unspecific2.prompt.md",
                                contents: "oh hi, rawbot!"
                              },
                              {
                                name: "readme.md",
                                contents: "non prompt file"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              );
              assert.deepStrictEqual(
                (await locator.listFiles()).map((file) => file.fsPath),
                [
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/specific.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/unspecific1.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/unspecific2.prompt.md").fsPath
                ],
                "Must find correct prompts."
              );
            });
          }
        });
      });
      suite("\u2022 absolute", () => {
        suite("\u2022 wild card", () => {
          const settings = [
            "/Users/legomushroom/repos/vscode/**",
            "/Users/legomushroom/repos/vscode/**/*.prompt.md",
            "/Users/legomushroom/repos/vscode/**/*.md",
            "/Users/legomushroom/repos/vscode/**/*",
            "/Users/legomushroom/repos/vscode/deps/**",
            "/Users/legomushroom/repos/vscode/deps/**/*.prompt.md",
            "/Users/legomushroom/repos/vscode/deps/**/*",
            "/Users/legomushroom/repos/vscode/deps/**/*.md",
            "/Users/legomushroom/repos/vscode/**/text/**",
            "/Users/legomushroom/repos/vscode/**/text/**/*",
            "/Users/legomushroom/repos/vscode/**/text/**/*.md",
            "/Users/legomushroom/repos/vscode/**/text/**/*.prompt.md",
            "/Users/legomushroom/repos/vscode/deps/text/**",
            "/Users/legomushroom/repos/vscode/deps/text/**/*",
            "/Users/legomushroom/repos/vscode/deps/text/**/*.md",
            "/Users/legomushroom/repos/vscode/deps/text/**/*.prompt.md"
          ];
          for (const setting of settings) {
            test(`\u2022 '${setting}'`, async () => {
              const locator = await createPromptsLocator(
                { [setting]: true },
                ["/Users/legomushroom/repos/vscode"],
                [
                  {
                    name: "/Users/legomushroom/repos/vscode",
                    children: [
                      {
                        name: "deps/text",
                        children: [
                          {
                            name: "my.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "nested",
                            children: [
                              {
                                name: "specific.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "unspecific1.prompt.md",
                                contents: "oh hi, robot!"
                              },
                              {
                                name: "unspecific2.prompt.md",
                                contents: "oh hi, rabot!"
                              },
                              {
                                name: "readme.md",
                                contents: "non prompt file"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              );
              assert.deepStrictEqual(
                (await locator.listFiles()).map((file) => file.fsPath),
                [
                  createURI("/Users/legomushroom/repos/vscode/deps/text/my.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/specific.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/unspecific1.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/unspecific2.prompt.md").fsPath
                ],
                "Must find correct prompts."
              );
            });
          }
        });
        suite(`\u2022 specific`, () => {
          const testSettings = [
            [
              "/Users/legomushroom/repos/vscode/**/*specific*"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/*specific*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/*specific*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/specific*",
              "/Users/legomushroom/repos/vscode/**/unspecific1.prompt.md",
              "/Users/legomushroom/repos/vscode/**/unspecific2.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/**/unspecific*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/nested/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/**/nested/unspecific*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/nested/*specific*"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/*spec*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/*spec*"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/*spec*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/deps/**/*spec*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/**/text/**/*spec*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/nested/*spec*"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/nested/*specific*"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/**/*specific*"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/**/specific*",
              "/Users/legomushroom/repos/vscode/deps/**/unspecific*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/**/specific*.md",
              "/Users/legomushroom/repos/vscode/deps/**/unspecific*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/**/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/deps/**/unspecific1.prompt.md",
              "/Users/legomushroom/repos/vscode/deps/**/unspecific2.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/**/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/deps/**/unspecific1*.md",
              "/Users/legomushroom/repos/vscode/deps/**/unspecific2*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/**/*specific*"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/**/specific*",
              "/Users/legomushroom/repos/vscode/deps/text/**/unspecific*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/**/specific*.md",
              "/Users/legomushroom/repos/vscode/deps/text/**/unspecific*.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/**/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/deps/text/**/unspecific1.prompt.md",
              "/Users/legomushroom/repos/vscode/deps/text/**/unspecific2.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/deps/text/**/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/deps/text/**/unspecific1*.md",
              "/Users/legomushroom/repos/vscode/deps/text/**/unspecific2*.md"
            ]
          ];
          for (const settings of testSettings) {
            test(`\u2022 '${JSON.stringify(settings)}'`, async () => {
              const vscodeSettings = {};
              for (const setting of settings) {
                vscodeSettings[setting] = true;
              }
              const locator = await createPromptsLocator(
                vscodeSettings,
                ["/Users/legomushroom/repos/vscode"],
                [
                  {
                    name: "/Users/legomushroom/repos/vscode",
                    children: [
                      {
                        name: "deps/text",
                        children: [
                          {
                            name: "my.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "nested",
                            children: [
                              {
                                name: "default.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "specific.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "unspecific1.prompt.md",
                                contents: "oh hi, robot!"
                              },
                              {
                                name: "unspecific2.prompt.md",
                                contents: "oh hi, rawbot!"
                              },
                              {
                                name: "readme.md",
                                contents: "non prompt file"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              );
              assert.deepStrictEqual(
                (await locator.listFiles()).map((file) => file.fsPath),
                [
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/specific.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/unspecific1.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/deps/text/nested/unspecific2.prompt.md").fsPath
                ],
                "Must find correct prompts."
              );
            });
          }
        });
      });
    });
  });
  test("\u2022 core logic", async () => {
    const locator = await createPromptsLocator(
      {
        "/Users/legomushroom/repos/prompts": true,
        "/tmp/prompts/": true,
        "/absolute/path/prompts": false,
        ".copilot/prompts": true
      },
      [
        "/Users/legomushroom/repos/vscode"
      ],
      [
        {
          name: "/Users/legomushroom/repos/prompts",
          children: [
            {
              name: "test.prompt.md",
              contents: "Hello, World!"
            },
            {
              name: "refactor-tests.prompt.md",
              contents: "some file content goes here"
            }
          ]
        },
        {
          name: "/tmp/prompts",
          children: [
            {
              name: "translate.to-rust.prompt.md",
              contents: "some more random file contents"
            }
          ]
        },
        {
          name: "/absolute/path/prompts",
          children: [
            {
              name: "some-prompt-file.prompt.md",
              contents: "hey hey hey"
            }
          ]
        },
        {
          name: "/Users/legomushroom/repos/vscode",
          children: [
            {
              name: ".copilot/prompts",
              children: [
                {
                  name: "default.prompt.md",
                  contents: "oh hi, robot!"
                }
              ]
            },
            {
              name: ".github/prompts",
              children: [
                {
                  name: "my.prompt.md",
                  contents: "oh hi, bot!"
                }
              ]
            }
          ]
        }
      ]
    );
    assert.deepStrictEqual(
      (await locator.listFiles()).map((file) => file.fsPath),
      [
        createURI("/Users/legomushroom/repos/vscode/.github/prompts/my.prompt.md").fsPath,
        createURI("/Users/legomushroom/repos/prompts/test.prompt.md").fsPath,
        createURI("/Users/legomushroom/repos/prompts/refactor-tests.prompt.md").fsPath,
        createURI("/tmp/prompts/translate.to-rust.prompt.md").fsPath,
        createURI("/Users/legomushroom/repos/vscode/.copilot/prompts/default.prompt.md").fsPath
      ],
      "Must find correct prompts."
    );
  });
  test("\u2022 with disabled `.github/prompts` location", async () => {
    const locator = await createPromptsLocator(
      {
        "/Users/legomushroom/repos/prompts": true,
        "/tmp/prompts/": true,
        "/absolute/path/prompts": false,
        ".copilot/prompts": true,
        ".github/prompts": false
      },
      [
        "/Users/legomushroom/repos/vscode"
      ],
      [
        {
          name: "/Users/legomushroom/repos/prompts",
          children: [
            {
              name: "test.prompt.md",
              contents: "Hello, World!"
            },
            {
              name: "refactor-tests.prompt.md",
              contents: "some file content goes here"
            }
          ]
        },
        {
          name: "/tmp/prompts",
          children: [
            {
              name: "translate.to-rust.prompt.md",
              contents: "some more random file contents"
            }
          ]
        },
        {
          name: "/absolute/path/prompts",
          children: [
            {
              name: "some-prompt-file.prompt.md",
              contents: "hey hey hey"
            }
          ]
        },
        {
          name: "/Users/legomushroom/repos/vscode",
          children: [
            {
              name: ".copilot/prompts",
              children: [
                {
                  name: "default.prompt.md",
                  contents: "oh hi, robot!"
                }
              ]
            },
            {
              name: ".github/prompts",
              children: [
                {
                  name: "my.prompt.md",
                  contents: "oh hi, bot!"
                },
                {
                  name: "your.prompt.md",
                  contents: "oh hi, bot!"
                }
              ]
            }
          ]
        }
      ]
    );
    assert.deepStrictEqual(
      (await locator.listFiles()).map((file) => file.fsPath),
      [
        createURI("/Users/legomushroom/repos/prompts/test.prompt.md").path,
        createURI("/Users/legomushroom/repos/prompts/refactor-tests.prompt.md").path,
        createURI("/tmp/prompts/translate.to-rust.prompt.md").path,
        createURI("/Users/legomushroom/repos/vscode/.copilot/prompts/default.prompt.md").path
      ],
      "Must find correct prompts."
    );
  });
  suite("\u2022 multi-root workspace", () => {
    suite("\u2022 core logic", () => {
      test("\u2022 without top-level `.github` folder", async () => {
        const locator = await createPromptsLocator(
          {
            "/Users/legomushroom/repos/prompts": true,
            "/tmp/prompts/": true,
            "/absolute/path/prompts": false,
            ".copilot/prompts": false
          },
          [
            "/Users/legomushroom/repos/vscode",
            "/Users/legomushroom/repos/node"
          ],
          [
            {
              name: "/Users/legomushroom/repos/prompts",
              children: [
                {
                  name: "test.prompt.md",
                  contents: "Hello, World!"
                },
                {
                  name: "refactor-tests.prompt.md",
                  contents: "some file content goes here"
                }
              ]
            },
            {
              name: "/tmp/prompts",
              children: [
                {
                  name: "translate.to-rust.prompt.md",
                  contents: "some more random file contents"
                }
              ]
            },
            {
              name: "/absolute/path/prompts",
              children: [
                {
                  name: "some-prompt-file.prompt.md",
                  contents: "hey hey hey"
                }
              ]
            },
            {
              name: "/Users/legomushroom/repos/vscode",
              children: [
                {
                  name: ".copilot/prompts",
                  children: [
                    {
                      name: "prompt1.prompt.md",
                      contents: "oh hi, robot!"
                    }
                  ]
                },
                {
                  name: ".github/prompts",
                  children: [
                    {
                      name: "default.prompt.md",
                      contents: "oh hi, bot!"
                    }
                  ]
                }
              ]
            },
            {
              name: "/Users/legomushroom/repos/node",
              children: [
                {
                  name: ".copilot/prompts",
                  children: [
                    {
                      name: "prompt5.prompt.md",
                      contents: "oh hi, robot!"
                    }
                  ]
                },
                {
                  name: ".github/prompts",
                  children: [
                    {
                      name: "refactor-static-classes.prompt.md",
                      contents: "file contents"
                    }
                  ]
                }
              ]
            },
            // note! this folder is not part of the workspace, so prompt files are `ignored`
            {
              name: "/Users/legomushroom/repos/.github/prompts",
              children: [
                {
                  name: "prompt-name.prompt.md",
                  contents: "oh hi, robot!"
                },
                {
                  name: "name-of-the-prompt.prompt.md",
                  contents: "oh hi, raw bot!"
                }
              ]
            }
          ]
        );
        assert.deepStrictEqual(
          (await locator.listFiles()).map((file) => file.fsPath),
          [
            createURI("/Users/legomushroom/repos/vscode/.github/prompts/default.prompt.md").path,
            createURI("/Users/legomushroom/repos/node/.github/prompts/refactor-static-classes.prompt.md").path,
            createURI("/Users/legomushroom/repos/prompts/test.prompt.md").path,
            createURI("/Users/legomushroom/repos/prompts/refactor-tests.prompt.md").path,
            createURI("/tmp/prompts/translate.to-rust.prompt.md").path
          ],
          "Must find correct prompts."
        );
      });
      test("\u2022 with top-level `.github` folder", async () => {
        const locator = await createPromptsLocator(
          {
            "/Users/legomushroom/repos/prompts": true,
            "/tmp/prompts/": true,
            "/absolute/path/prompts": false,
            ".copilot/prompts": false
          },
          [
            "/Users/legomushroom/repos/vscode",
            "/Users/legomushroom/repos/node",
            "/var/shared/prompts/.github"
          ],
          [
            {
              name: "/Users/legomushroom/repos/prompts",
              children: [
                {
                  name: "test.prompt.md",
                  contents: "Hello, World!"
                },
                {
                  name: "refactor-tests.prompt.md",
                  contents: "some file content goes here"
                }
              ]
            },
            {
              name: "/tmp/prompts",
              children: [
                {
                  name: "translate.to-rust.prompt.md",
                  contents: "some more random file contents"
                }
              ]
            },
            {
              name: "/absolute/path/prompts",
              children: [
                {
                  name: "some-prompt-file.prompt.md",
                  contents: "hey hey hey"
                }
              ]
            },
            {
              name: "/Users/legomushroom/repos/vscode",
              children: [
                {
                  name: ".copilot/prompts",
                  children: [
                    {
                      name: "prompt1.prompt.md",
                      contents: "oh hi, robot!"
                    }
                  ]
                },
                {
                  name: ".github/prompts",
                  children: [
                    {
                      name: "default.prompt.md",
                      contents: "oh hi, bot!"
                    }
                  ]
                }
              ]
            },
            {
              name: "/Users/legomushroom/repos/node",
              children: [
                {
                  name: ".copilot/prompts",
                  children: [
                    {
                      name: "prompt5.prompt.md",
                      contents: "oh hi, robot!"
                    }
                  ]
                },
                {
                  name: ".github/prompts",
                  children: [
                    {
                      name: "refactor-static-classes.prompt.md",
                      contents: "file contents"
                    }
                  ]
                }
              ]
            },
            // note! this folder is part of the workspace, so prompt files are `included`
            {
              name: "/var/shared/prompts/.github/prompts",
              children: [
                {
                  name: "prompt-name.prompt.md",
                  contents: "oh hi, robot!"
                },
                {
                  name: "name-of-the-prompt.prompt.md",
                  contents: "oh hi, raw bot!"
                }
              ]
            }
          ]
        );
        assert.deepStrictEqual(
          (await locator.listFiles()).map((file) => file.fsPath),
          [
            createURI("/Users/legomushroom/repos/vscode/.github/prompts/default.prompt.md").fsPath,
            createURI("/Users/legomushroom/repos/node/.github/prompts/refactor-static-classes.prompt.md").fsPath,
            createURI("/var/shared/prompts/.github/prompts/prompt-name.prompt.md").fsPath,
            createURI("/var/shared/prompts/.github/prompts/name-of-the-prompt.prompt.md").fsPath,
            createURI("/Users/legomushroom/repos/prompts/test.prompt.md").fsPath,
            createURI("/Users/legomushroom/repos/prompts/refactor-tests.prompt.md").fsPath,
            createURI("/tmp/prompts/translate.to-rust.prompt.md").fsPath
          ],
          "Must find correct prompts."
        );
      });
      test("\u2022 with disabled `.github/prompts` location", async () => {
        const locator = await createPromptsLocator(
          {
            "/Users/legomushroom/repos/prompts": true,
            "/tmp/prompts/": true,
            "/absolute/path/prompts": false,
            ".copilot/prompts": false,
            ".github/prompts": false
          },
          [
            "/Users/legomushroom/repos/vscode",
            "/Users/legomushroom/repos/node",
            "/var/shared/prompts/.github"
          ],
          [
            {
              name: "/Users/legomushroom/repos/prompts",
              children: [
                {
                  name: "test.prompt.md",
                  contents: "Hello, World!"
                },
                {
                  name: "refactor-tests.prompt.md",
                  contents: "some file content goes here"
                }
              ]
            },
            {
              name: "/tmp/prompts",
              children: [
                {
                  name: "translate.to-rust.prompt.md",
                  contents: "some more random file contents"
                }
              ]
            },
            {
              name: "/absolute/path/prompts",
              children: [
                {
                  name: "some-prompt-file.prompt.md",
                  contents: "hey hey hey"
                }
              ]
            },
            {
              name: "/Users/legomushroom/repos/vscode",
              children: [
                {
                  name: ".copilot/prompts",
                  children: [
                    {
                      name: "prompt1.prompt.md",
                      contents: "oh hi, robot!"
                    }
                  ]
                },
                {
                  name: ".github/prompts",
                  children: [
                    {
                      name: "default.prompt.md",
                      contents: "oh hi, bot!"
                    }
                  ]
                }
              ]
            },
            {
              name: "/Users/legomushroom/repos/node",
              children: [
                {
                  name: ".copilot/prompts",
                  children: [
                    {
                      name: "prompt5.prompt.md",
                      contents: "oh hi, robot!"
                    }
                  ]
                },
                {
                  name: ".github/prompts",
                  children: [
                    {
                      name: "refactor-static-classes.prompt.md",
                      contents: "file contents"
                    }
                  ]
                }
              ]
            },
            // note! this folder is part of the workspace, so prompt files are `included`
            {
              name: "/var/shared/prompts/.github/prompts",
              children: [
                {
                  name: "prompt-name.prompt.md",
                  contents: "oh hi, robot!"
                },
                {
                  name: "name-of-the-prompt.prompt.md",
                  contents: "oh hi, raw bot!"
                }
              ]
            }
          ]
        );
        assert.deepStrictEqual(
          (await locator.listFiles()).map((file) => file.fsPath),
          [
            createURI("/Users/legomushroom/repos/prompts/test.prompt.md").path,
            createURI("/Users/legomushroom/repos/prompts/refactor-tests.prompt.md").path,
            createURI("/tmp/prompts/translate.to-rust.prompt.md").path
          ],
          "Must find correct prompts."
        );
      });
      test("\u2022 mixed", async () => {
        const locator = await createPromptsLocator(
          {
            "/Users/legomushroom/repos/**/*test*": true,
            ".copilot/prompts": false,
            ".github/prompts": true,
            "/absolute/path/prompts/some-prompt-file.prompt.md": true
          },
          [
            "/Users/legomushroom/repos/vscode",
            "/Users/legomushroom/repos/node",
            "/var/shared/prompts/.github"
          ],
          [
            {
              name: "/Users/legomushroom/repos/prompts",
              children: [
                {
                  name: "test.prompt.md",
                  contents: "Hello, World!"
                },
                {
                  name: "refactor-tests.prompt.md",
                  contents: "some file content goes here"
                },
                {
                  name: "elf.prompt.md",
                  contents: "haalo!"
                }
              ]
            },
            {
              name: "/tmp/prompts",
              children: [
                {
                  name: "translate.to-rust.prompt.md",
                  contents: "some more random file contents"
                }
              ]
            },
            {
              name: "/absolute/path/prompts",
              children: [
                {
                  name: "some-prompt-file.prompt.md",
                  contents: "hey hey hey"
                }
              ]
            },
            {
              name: "/Users/legomushroom/repos/vscode",
              children: [
                {
                  name: ".copilot/prompts",
                  children: [
                    {
                      name: "prompt1.prompt.md",
                      contents: "oh hi, robot!"
                    }
                  ]
                },
                {
                  name: ".github/prompts",
                  children: [
                    {
                      name: "default.prompt.md",
                      contents: "oh hi, bot!"
                    }
                  ]
                }
              ]
            },
            {
              name: "/Users/legomushroom/repos/node",
              children: [
                {
                  name: ".copilot/prompts",
                  children: [
                    {
                      name: "prompt5.prompt.md",
                      contents: "oh hi, robot!"
                    }
                  ]
                },
                {
                  name: ".github/prompts",
                  children: [
                    {
                      name: "refactor-static-classes.prompt.md",
                      contents: "file contents"
                    }
                  ]
                }
              ]
            },
            // note! this folder is part of the workspace, so prompt files are `included`
            {
              name: "/var/shared/prompts/.github/prompts",
              children: [
                {
                  name: "prompt-name.prompt.md",
                  contents: "oh hi, robot!"
                },
                {
                  name: "name-of-the-prompt.prompt.md",
                  contents: "oh hi, raw bot!"
                }
              ]
            }
          ]
        );
        assert.deepStrictEqual(
          (await locator.listFiles()).map((file) => file.fsPath),
          [
            // all of these are due to the `.github/prompts` setting
            createURI("/Users/legomushroom/repos/vscode/.github/prompts/default.prompt.md").fsPath,
            createURI("/Users/legomushroom/repos/node/.github/prompts/refactor-static-classes.prompt.md").fsPath,
            createURI("/var/shared/prompts/.github/prompts/prompt-name.prompt.md").fsPath,
            createURI("/var/shared/prompts/.github/prompts/name-of-the-prompt.prompt.md").fsPath,
            // all of these are due to the `/Users/legomushroom/repos/**/*test*` setting
            createURI("/Users/legomushroom/repos/prompts/test.prompt.md").fsPath,
            createURI("/Users/legomushroom/repos/prompts/refactor-tests.prompt.md").fsPath,
            // this one is due to the specific `/absolute/path/prompts/some-prompt-file.prompt.md` setting
            createURI("/absolute/path/prompts/some-prompt-file.prompt.md").fsPath
          ],
          "Must find correct prompts."
        );
      });
    });
    suite("\u2022 glob pattern", () => {
      suite("\u2022 relative", () => {
        suite("\u2022 wild card", () => {
          const testSettings = [
            "**",
            "**/*.prompt.md",
            "**/*.md",
            "**/*",
            "gen*/**",
            "gen*/**/*.prompt.md",
            "gen*/**/*",
            "gen*/**/*.md",
            "**/gen*/**",
            "**/gen*/**/*",
            "**/gen*/**/*.md",
            "**/gen*/**/*.prompt.md",
            "{generic,general,gen}/**",
            "{generic,general,gen}/**/*.prompt.md",
            "{generic,general,gen}/**/*",
            "{generic,general,gen}/**/*.md",
            "**/{generic,general,gen}/**",
            "**/{generic,general,gen}/**/*",
            "**/{generic,general,gen}/**/*.md",
            "**/{generic,general,gen}/**/*.prompt.md"
          ];
          for (const setting of testSettings) {
            test(`\u2022 '${setting}'`, async () => {
              const locator = await createPromptsLocator(
                { [setting]: true },
                [
                  "/Users/legomushroom/repos/vscode",
                  "/Users/legomushroom/repos/prompts"
                ],
                [
                  {
                    name: "/Users/legomushroom/repos/vscode",
                    children: [
                      {
                        name: "gen/text",
                        children: [
                          {
                            name: "my.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "nested",
                            children: [
                              {
                                name: "specific.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "unspecific1.prompt.md",
                                contents: "oh hi, robot!"
                              },
                              {
                                name: "unspecific2.prompt.md",
                                contents: "oh hi, rabot!"
                              },
                              {
                                name: "readme.md",
                                contents: "non prompt file"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    name: "/Users/legomushroom/repos/prompts",
                    children: [
                      {
                        name: "general",
                        children: [
                          {
                            name: "common.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "uncommon-10.prompt.md",
                            contents: "oh hi, robot!"
                          },
                          {
                            name: "license.md",
                            contents: "non prompt file"
                          }
                        ]
                      }
                    ]
                  }
                ]
              );
              assert.deepStrictEqual(
                (await locator.listFiles()).map((file) => file.fsPath),
                [
                  createURI("/Users/legomushroom/repos/vscode/gen/text/my.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/gen/text/nested/specific.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/gen/text/nested/unspecific1.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/gen/text/nested/unspecific2.prompt.md").fsPath,
                  // -
                  createURI("/Users/legomushroom/repos/prompts/general/common.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/prompts/general/uncommon-10.prompt.md").fsPath
                ],
                "Must find correct prompts."
              );
            });
          }
        });
        suite(`\u2022 specific`, () => {
          const testSettings = [
            [
              "**/my.prompt.md",
              "**/*specific*",
              "**/*common*"
            ],
            [
              "**/my.prompt.md",
              "**/*specific*.prompt.md",
              "**/*common*.prompt.md"
            ],
            [
              "**/my*.md",
              "**/*specific*.md",
              "**/*common*.md"
            ],
            [
              "**/my*.md",
              "**/specific*",
              "**/unspecific*",
              "**/common*",
              "**/uncommon*"
            ],
            [
              "**/my.prompt.md",
              "**/specific.prompt.md",
              "**/unspecific1.prompt.md",
              "**/unspecific2.prompt.md",
              "**/common.prompt.md",
              "**/uncommon-10.prompt.md"
            ],
            [
              "gen*/**/my.prompt.md",
              "gen*/**/*specific*",
              "gen*/**/*common*"
            ],
            [
              "gen*/**/my.prompt.md",
              "gen*/**/*specific*.prompt.md",
              "gen*/**/*common*.prompt.md"
            ],
            [
              "gen*/**/my*.md",
              "gen*/**/*specific*.md",
              "gen*/**/*common*.md"
            ],
            [
              "gen*/**/my*.md",
              "gen*/**/specific*",
              "gen*/**/unspecific*",
              "gen*/**/common*",
              "gen*/**/uncommon*"
            ],
            [
              "gen*/**/my.prompt.md",
              "gen*/**/specific.prompt.md",
              "gen*/**/unspecific1.prompt.md",
              "gen*/**/unspecific2.prompt.md",
              "gen*/**/common.prompt.md",
              "gen*/**/uncommon-10.prompt.md"
            ],
            [
              "gen/text/my.prompt.md",
              "gen/text/nested/specific.prompt.md",
              "gen/text/nested/unspecific1.prompt.md",
              "gen/text/nested/unspecific2.prompt.md",
              "general/common.prompt.md",
              "general/uncommon-10.prompt.md"
            ],
            [
              "gen/text/my.prompt.md",
              "gen/text/nested/*specific*",
              "general/*common*"
            ],
            [
              "gen/text/my.prompt.md",
              "gen/text/**/specific.prompt.md",
              "gen/text/**/unspecific1.prompt.md",
              "gen/text/**/unspecific2.prompt.md",
              "general/*"
            ],
            [
              "{gen,general}/**/my.prompt.md",
              "{gen,general}/**/*specific*",
              "{gen,general}/**/*common*"
            ],
            [
              "{gen,general}/**/my.prompt.md",
              "{gen,general}/**/*specific*.prompt.md",
              "{gen,general}/**/*common*.prompt.md"
            ],
            [
              "{gen,general}/**/my*.md",
              "{gen,general}/**/*specific*.md",
              "{gen,general}/**/*common*.md"
            ],
            [
              "{gen,general}/**/my*.md",
              "{gen,general}/**/specific*",
              "{gen,general}/**/unspecific*",
              "{gen,general}/**/common*",
              "{gen,general}/**/uncommon*"
            ],
            [
              "{gen,general}/**/my.prompt.md",
              "{gen,general}/**/specific.prompt.md",
              "{gen,general}/**/unspecific1.prompt.md",
              "{gen,general}/**/unspecific2.prompt.md",
              "{gen,general}/**/common.prompt.md",
              "{gen,general}/**/uncommon-10.prompt.md"
            ]
          ];
          for (const settings of testSettings) {
            test(`\u2022 '${JSON.stringify(settings)}'`, async () => {
              const vscodeSettings = {};
              for (const setting of settings) {
                vscodeSettings[setting] = true;
              }
              const locator = await createPromptsLocator(
                vscodeSettings,
                [
                  "/Users/legomushroom/repos/vscode",
                  "/Users/legomushroom/repos/prompts"
                ],
                [
                  {
                    name: "/Users/legomushroom/repos/vscode",
                    children: [
                      {
                        name: "gen/text",
                        children: [
                          {
                            name: "my.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "nested",
                            children: [
                              {
                                name: "specific.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "unspecific1.prompt.md",
                                contents: "oh hi, robot!"
                              },
                              {
                                name: "unspecific2.prompt.md",
                                contents: "oh hi, rabot!"
                              },
                              {
                                name: "readme.md",
                                contents: "non prompt file"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    name: "/Users/legomushroom/repos/prompts",
                    children: [
                      {
                        name: "general",
                        children: [
                          {
                            name: "common.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "uncommon-10.prompt.md",
                            contents: "oh hi, robot!"
                          },
                          {
                            name: "license.md",
                            contents: "non prompt file"
                          }
                        ]
                      }
                    ]
                  }
                ]
              );
              assert.deepStrictEqual(
                (await locator.listFiles()).map((file) => file.fsPath),
                [
                  createURI("/Users/legomushroom/repos/vscode/gen/text/my.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/gen/text/nested/specific.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/gen/text/nested/unspecific1.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/gen/text/nested/unspecific2.prompt.md").fsPath,
                  // -
                  createURI("/Users/legomushroom/repos/prompts/general/common.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/prompts/general/uncommon-10.prompt.md").fsPath
                ],
                "Must find correct prompts."
              );
            });
          }
        });
      });
      suite("\u2022 absolute", () => {
        suite("\u2022 wild card", () => {
          const testSettings = [
            "/Users/legomushroom/repos/**",
            "/Users/legomushroom/repos/**/*.prompt.md",
            "/Users/legomushroom/repos/**/*.md",
            "/Users/legomushroom/repos/**/*",
            "/Users/legomushroom/repos/**/gen*/**",
            "/Users/legomushroom/repos/**/gen*/**/*.prompt.md",
            "/Users/legomushroom/repos/**/gen*/**/*",
            "/Users/legomushroom/repos/**/gen*/**/*.md",
            "/Users/legomushroom/repos/**/gen*/**",
            "/Users/legomushroom/repos/**/gen*/**/*",
            "/Users/legomushroom/repos/**/gen*/**/*.md",
            "/Users/legomushroom/repos/**/gen*/**/*.prompt.md",
            "/Users/legomushroom/repos/{vscode,prompts}/**",
            "/Users/legomushroom/repos/{vscode,prompts}/**/*.prompt.md",
            "/Users/legomushroom/repos/{vscode,prompts}/**/*.md",
            "/Users/legomushroom/repos/{vscode,prompts}/**/*",
            "/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**",
            "/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**/*.prompt.md",
            "/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**/*",
            "/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**/*.md",
            "/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**",
            "/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**/*",
            "/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**/*.md",
            "/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**/*.prompt.md",
            "/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**",
            "/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**/*.prompt.md",
            "/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**/*",
            "/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**/*.md",
            "/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**",
            "/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**/*",
            "/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**/*.md",
            "/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**/*.prompt.md"
          ];
          for (const setting of testSettings) {
            test(`\u2022 '${setting}'`, async () => {
              const locator = await createPromptsLocator(
                { [setting]: true },
                [
                  "/Users/legomushroom/repos/vscode",
                  "/Users/legomushroom/repos/prompts"
                ],
                [
                  {
                    name: "/Users/legomushroom/repos/vscode",
                    children: [
                      {
                        name: "gen/text",
                        children: [
                          {
                            name: "my.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "nested",
                            children: [
                              {
                                name: "specific.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "unspecific1.prompt.md",
                                contents: "oh hi, robot!"
                              },
                              {
                                name: "unspecific2.prompt.md",
                                contents: "oh hi, rabot!"
                              },
                              {
                                name: "readme.md",
                                contents: "non prompt file"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    name: "/Users/legomushroom/repos/prompts",
                    children: [
                      {
                        name: "general",
                        children: [
                          {
                            name: "common.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "uncommon-10.prompt.md",
                            contents: "oh hi, robot!"
                          },
                          {
                            name: "license.md",
                            contents: "non prompt file"
                          }
                        ]
                      }
                    ]
                  }
                ]
              );
              assert.deepStrictEqual(
                (await locator.listFiles()).map((file) => file.fsPath),
                [
                  createURI("/Users/legomushroom/repos/vscode/gen/text/my.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/gen/text/nested/specific.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/gen/text/nested/unspecific1.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/gen/text/nested/unspecific2.prompt.md").fsPath,
                  // -
                  createURI("/Users/legomushroom/repos/prompts/general/common.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/prompts/general/uncommon-10.prompt.md").fsPath
                ],
                "Must find correct prompts."
              );
            });
          }
        });
        suite(`\u2022 specific`, () => {
          const testSettings = [
            [
              "/Users/legomushroom/repos/**/my.prompt.md",
              "/Users/legomushroom/repos/**/*specific*",
              "/Users/legomushroom/repos/**/*common*"
            ],
            [
              "/Users/legomushroom/repos/**/my.prompt.md",
              "/Users/legomushroom/repos/**/*specific*.prompt.md",
              "/Users/legomushroom/repos/**/*common*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/**/my*.md",
              "/Users/legomushroom/repos/**/*specific*.md",
              "/Users/legomushroom/repos/**/*common*.md"
            ],
            [
              "/Users/legomushroom/repos/**/my*.md",
              "/Users/legomushroom/repos/**/specific*",
              "/Users/legomushroom/repos/**/unspecific*",
              "/Users/legomushroom/repos/**/common*",
              "/Users/legomushroom/repos/**/uncommon*"
            ],
            [
              "/Users/legomushroom/repos/**/my.prompt.md",
              "/Users/legomushroom/repos/**/specific.prompt.md",
              "/Users/legomushroom/repos/**/unspecific1.prompt.md",
              "/Users/legomushroom/repos/**/unspecific2.prompt.md",
              "/Users/legomushroom/repos/**/common.prompt.md",
              "/Users/legomushroom/repos/**/uncommon-10.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/**/gen*/**/my.prompt.md",
              "/Users/legomushroom/repos/**/gen*/**/*specific*",
              "/Users/legomushroom/repos/**/gen*/**/*common*"
            ],
            [
              "/Users/legomushroom/repos/**/gen*/**/my.prompt.md",
              "/Users/legomushroom/repos/**/gen*/**/*specific*.prompt.md",
              "/Users/legomushroom/repos/**/gen*/**/*common*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/**/gen*/**/my*.md",
              "/Users/legomushroom/repos/**/gen*/**/*specific*.md",
              "/Users/legomushroom/repos/**/gen*/**/*common*.md"
            ],
            [
              "/Users/legomushroom/repos/**/gen*/**/my*.md",
              "/Users/legomushroom/repos/**/gen*/**/specific*",
              "/Users/legomushroom/repos/**/gen*/**/unspecific*",
              "/Users/legomushroom/repos/**/gen*/**/common*",
              "/Users/legomushroom/repos/**/gen*/**/uncommon*"
            ],
            [
              "/Users/legomushroom/repos/**/gen*/**/my.prompt.md",
              "/Users/legomushroom/repos/**/gen*/**/specific.prompt.md",
              "/Users/legomushroom/repos/**/gen*/**/unspecific1.prompt.md",
              "/Users/legomushroom/repos/**/gen*/**/unspecific2.prompt.md",
              "/Users/legomushroom/repos/**/gen*/**/common.prompt.md",
              "/Users/legomushroom/repos/**/gen*/**/uncommon-10.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/gen/text/my.prompt.md",
              "/Users/legomushroom/repos/vscode/gen/text/nested/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/gen/text/nested/unspecific1.prompt.md",
              "/Users/legomushroom/repos/vscode/gen/text/nested/unspecific2.prompt.md",
              "/Users/legomushroom/repos/prompts/general/common.prompt.md",
              "/Users/legomushroom/repos/prompts/general/uncommon-10.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/vscode/gen/text/my.prompt.md",
              "/Users/legomushroom/repos/vscode/gen/text/nested/*specific*",
              "/Users/legomushroom/repos/prompts/general/*common*"
            ],
            [
              "/Users/legomushroom/repos/vscode/gen/text/my.prompt.md",
              "/Users/legomushroom/repos/vscode/gen/text/**/specific.prompt.md",
              "/Users/legomushroom/repos/vscode/gen/text/**/unspecific1.prompt.md",
              "/Users/legomushroom/repos/vscode/gen/text/**/unspecific2.prompt.md",
              "/Users/legomushroom/repos/prompts/general/*"
            ],
            [
              "/Users/legomushroom/repos/**/{gen,general}/**/my.prompt.md",
              "/Users/legomushroom/repos/**/{gen,general}/**/*specific*",
              "/Users/legomushroom/repos/**/{gen,general}/**/*common*"
            ],
            [
              "/Users/legomushroom/repos/**/{gen,general}/**/my.prompt.md",
              "/Users/legomushroom/repos/**/{gen,general}/**/*specific*.prompt.md",
              "/Users/legomushroom/repos/**/{gen,general}/**/*common*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/**/{gen,general}/**/my*.md",
              "/Users/legomushroom/repos/**/{gen,general}/**/*specific*.md",
              "/Users/legomushroom/repos/**/{gen,general}/**/*common*.md"
            ],
            [
              "/Users/legomushroom/repos/**/{gen,general}/**/my*.md",
              "/Users/legomushroom/repos/**/{gen,general}/**/specific*",
              "/Users/legomushroom/repos/**/{gen,general}/**/unspecific*",
              "/Users/legomushroom/repos/**/{gen,general}/**/common*",
              "/Users/legomushroom/repos/**/{gen,general}/**/uncommon*"
            ],
            [
              "/Users/legomushroom/repos/**/{gen,general}/**/my.prompt.md",
              "/Users/legomushroom/repos/**/{gen,general}/**/specific.prompt.md",
              "/Users/legomushroom/repos/**/{gen,general}/**/unspecific1.prompt.md",
              "/Users/legomushroom/repos/**/{gen,general}/**/unspecific2.prompt.md",
              "/Users/legomushroom/repos/**/{gen,general}/**/common.prompt.md",
              "/Users/legomushroom/repos/**/{gen,general}/**/uncommon-10.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/my.prompt.md",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/*specific*",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/*common*"
            ],
            [
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/my.prompt.md",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/*specific*.prompt.md",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/*common*.prompt.md"
            ],
            [
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/my*.md",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/*specific*.md",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/*common*.md"
            ],
            [
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/my*.md",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/specific*",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/unspecific*",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/common*",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/uncommon*"
            ],
            [
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/my.prompt.md",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/specific.prompt.md",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/unspecific1.prompt.md",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/unspecific2.prompt.md",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/common.prompt.md",
              "/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/uncommon-10.prompt.md"
            ]
          ];
          for (const settings of testSettings) {
            test(`\u2022 '${JSON.stringify(settings)}'`, async () => {
              const vscodeSettings = {};
              for (const setting of settings) {
                vscodeSettings[setting] = true;
              }
              const locator = await createPromptsLocator(
                vscodeSettings,
                [
                  "/Users/legomushroom/repos/vscode",
                  "/Users/legomushroom/repos/prompts"
                ],
                [
                  {
                    name: "/Users/legomushroom/repos/vscode",
                    children: [
                      {
                        name: "gen/text",
                        children: [
                          {
                            name: "my.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "nested",
                            children: [
                              {
                                name: "specific.prompt.md",
                                contents: "oh hi, bot!"
                              },
                              {
                                name: "unspecific1.prompt.md",
                                contents: "oh hi, robot!"
                              },
                              {
                                name: "unspecific2.prompt.md",
                                contents: "oh hi, rabot!"
                              },
                              {
                                name: "readme.md",
                                contents: "non prompt file"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    name: "/Users/legomushroom/repos/prompts",
                    children: [
                      {
                        name: "general",
                        children: [
                          {
                            name: "common.prompt.md",
                            contents: "oh hi, bot!"
                          },
                          {
                            name: "uncommon-10.prompt.md",
                            contents: "oh hi, robot!"
                          },
                          {
                            name: "license.md",
                            contents: "non prompt file"
                          }
                        ]
                      }
                    ]
                  }
                ]
              );
              assert.deepStrictEqual(
                (await locator.listFiles()).map((file) => file.fsPath),
                [
                  createURI("/Users/legomushroom/repos/vscode/gen/text/my.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/gen/text/nested/specific.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/gen/text/nested/unspecific1.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/vscode/gen/text/nested/unspecific2.prompt.md").fsPath,
                  // -
                  createURI("/Users/legomushroom/repos/prompts/general/common.prompt.md").fsPath,
                  createURI("/Users/legomushroom/repos/prompts/general/uncommon-10.prompt.md").fsPath
                ],
                "Must find correct prompts."
              );
            });
          }
        });
      });
    });
  });
  suite("\u2022 isValidGlob", () => {
    test("\u2022 valid patterns", () => {
      const globs = [
        "**",
        "*",
        "**",
        "**/*",
        "**/*.prompt.md",
        "/Users/legomushroom/**/*.prompt.md",
        "/Users/legomushroom/*.prompt.md",
        "/Users/legomushroom/*",
        "/Users/legomushroom/repos/{repo1,test}",
        "/Users/legomushroom/repos/{repo1,test}/**",
        "/Users/legomushroom/repos/{repo1,test}/*",
        "/Users/legomushroom/**/{repo1,test}/**",
        "/Users/legomushroom/**/{repo1,test}",
        "/Users/legomushroom/**/{repo1,test}/*",
        "/Users/legomushroom/**/repo[1,2,3]",
        "/Users/legomushroom/**/repo[1,2,3]/**",
        "/Users/legomushroom/**/repo[1,2,3]/*",
        "/Users/legomushroom/**/repo[1,2,3]/**/*.prompt.md",
        "repo[1,2,3]/**/*.prompt.md",
        "repo[[1,2,3]/**/*.prompt.md",
        "{repo1,test}/*.prompt.md",
        "{repo1,test}/*",
        "/{repo1,test}/*",
        "/{repo1,test}}/*"
      ];
      for (const glob of globs) {
        assert(
          isValidGlob(glob) === true,
          `'${glob}' must be a 'valid' glob pattern.`
        );
      }
    });
    test("\u2022 invalid patterns", () => {
      const globs = [
        ".",
        "\\*",
        "\\?",
        "\\*\\?\\*",
        "repo[1,2,3",
        "repo1,2,3]",
        "repo\\[1,2,3]",
        "repo[1,2,3\\]",
        "repo\\[1,2,3\\]",
        "{repo1,repo2",
        "repo1,repo2}",
        "\\{repo1,repo2}",
        "{repo1,repo2\\}",
        "\\{repo1,repo2\\}",
        "/Users/legomushroom/repos",
        "/Users/legomushroom/repo[1,2,3",
        "/Users/legomushroom/repo1,2,3]",
        "/Users/legomushroom/repo\\[1,2,3]",
        "/Users/legomushroom/repo[1,2,3\\]",
        "/Users/legomushroom/repo\\[1,2,3\\]",
        "/Users/legomushroom/{repo1,repo2",
        "/Users/legomushroom/repo1,repo2}",
        "/Users/legomushroom/\\{repo1,repo2}",
        "/Users/legomushroom/{repo1,repo2\\}",
        "/Users/legomushroom/\\{repo1,repo2\\}"
      ];
      for (const glob of globs) {
        assert(
          isValidGlob(glob) === false,
          `'${glob}' must be an 'invalid' glob pattern.`
        );
      }
    });
  });
  suite("\u2022 getConfigBasedSourceFolders", () => {
    test("\u2022 gets unambiguous list of folders", async () => {
      const locator = await createPromptsLocator(
        {
          ".github/prompts": true,
          "/Users/**/repos/**": true,
          "gen/text/**": true,
          "gen/text/nested/*.prompt.md": true,
          "general/*": true,
          "/Users/legomushroom/repos/vscode/my-prompts": true,
          "/Users/legomushroom/repos/vscode/your-prompts/*.md": true,
          "/Users/legomushroom/repos/prompts/shared-prompts/*": true
        },
        [
          "/Users/legomushroom/repos/vscode",
          "/Users/legomushroom/repos/prompts"
        ],
        []
      );
      assert.deepStrictEqual(
        locator.getConfigBasedSourceFolders().map((file) => file.fsPath),
        [
          createURI("/Users/legomushroom/repos/vscode/.github/prompts").fsPath,
          createURI("/Users/legomushroom/repos/prompts/.github/prompts").fsPath,
          createURI("/Users/legomushroom/repos/vscode/gen/text/nested").fsPath,
          createURI("/Users/legomushroom/repos/prompts/gen/text/nested").fsPath,
          createURI("/Users/legomushroom/repos/vscode/general").fsPath,
          createURI("/Users/legomushroom/repos/prompts/general").fsPath,
          createURI("/Users/legomushroom/repos/vscode/my-prompts").fsPath,
          createURI("/Users/legomushroom/repos/vscode/your-prompts").fsPath,
          createURI("/Users/legomushroom/repos/prompts/shared-prompts").fsPath
        ],
        "Must find correct prompts."
      );
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC91dGlscy9wcm9tcHRGaWxlc0xvY2F0b3IudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGNyZWF0ZVVSSSB9IGZyb20gJy4uL3Rlc3RVdGlscy9jcmVhdGVVcmkuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSU1vY2tGb2xkZXIsIE1vY2tGaWxlc3lzdGVtIH0gZnJvbSAnLi4vdGVzdFV0aWxzL21vY2tGaWxlc3lzdGVtLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBQcm9tcHRzQ29uZmlnIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvbXB0cy9jb21tb24vY29uZmlnLmpzJztcbmltcG9ydCB7IEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgbW9ja09iamVjdCwgbW9ja1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9tcHRzL3Rlc3QvY29tbW9uL3V0aWxzL21vY2suanMnO1xuaW1wb3J0IHsgaXNWYWxpZEdsb2IsIFByb21wdEZpbGVzTG9jYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9wcm9tcHRTeW50YXgvdXRpbHMvcHJvbXB0RmlsZXNMb2NhdG9yLmpzJztcbmltcG9ydCB7IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2luTWVtb3J5RmlsZXN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uT3ZlcnJpZGVzLCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2UsIElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgSVdvcmtzcGFjZUZvbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcblxuLyoqXG4gKiBNb2NrZWQgaW5zdGFuY2Ugb2Yge0BsaW5rIElDb25maWd1cmF0aW9uU2VydmljZX0uXG4gKi9cbmNvbnN0IG1vY2tDb25maWdTZXJ2aWNlID0gPFQ+KHZhbHVlOiBUKTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0+IHtcblx0cmV0dXJuIG1vY2tTZXJ2aWNlPElDb25maWd1cmF0aW9uU2VydmljZT4oe1xuXHRcdGdldFZhbHVlKGtleT86IHN0cmluZyB8IElDb25maWd1cmF0aW9uT3ZlcnJpZGVzKSB7XG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdHR5cGVvZiBrZXkgPT09ICdzdHJpbmcnLFxuXHRcdFx0XHRgRXhwZWN0ZWQgc3RyaW5nIGNvbmZpZ3VyYXRpb24ga2V5LCBnb3QgJyR7dHlwZW9mIGtleX0nLmAsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdFtQcm9tcHRzQ29uZmlnLktFWSwgUHJvbXB0c0NvbmZpZy5MT0NBVElPTlNfS0VZXS5pbmNsdWRlcyhrZXkpLFxuXHRcdFx0XHRgVW5zdXBwb3J0ZWQgY29uZmlndXJhdGlvbiBrZXkgJyR7a2V5fScuYCxcblx0XHRcdCk7XG5cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9LFxuXHR9KTtcbn07XG5cbi8qKlxuICogTW9ja2VkIGluc3RhbmNlIG9mIHtAbGluayBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2V9LlxuICovXG5jb25zdCBtb2NrV29ya3NwYWNlU2VydmljZSA9IChmb2xkZXJzOiBJV29ya3NwYWNlRm9sZGVyW10pOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgPT4ge1xuXHRyZXR1cm4gbW9ja1NlcnZpY2U8SVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlPih7XG5cdFx0Z2V0V29ya3NwYWNlKCk6IElXb3Jrc3BhY2Uge1xuXHRcdFx0cmV0dXJuIG1vY2tPYmplY3Q8SVdvcmtzcGFjZT4oe1xuXHRcdFx0XHRmb2xkZXJzLFxuXHRcdFx0fSk7XG5cdFx0fSxcblx0fSk7XG59O1xuXG5zdWl0ZSgnUHJvbXB0RmlsZXNMb2NhdG9yJywgKCkgPT4ge1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGlmIChpc1dpbmRvd3MpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRsZXQgaW5pdFNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGluaXRTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKSk7XG5cdFx0aW5pdFNlcnZpY2Uuc3R1YihJTG9nU2VydmljZSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQoaW5pdFNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRmlsZVNlcnZpY2UpKTtcblx0XHRjb25zdCBmaWxlU3lzdGVtUHJvdmlkZXIgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyKCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChmaWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKFNjaGVtYXMuZmlsZSwgZmlsZVN5c3RlbVByb3ZpZGVyKSk7XG5cblx0XHRpbml0U2VydmljZS5zdHViKElGaWxlU2VydmljZSwgZmlsZVNlcnZpY2UpO1xuXHR9KTtcblxuXHQvKipcblx0ICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIHtAbGluayBQcm9tcHRGaWxlc0xvY2F0b3J9IHdpdGggcHJvdmlkZWQgbW9ja2VkXG5cdCAqIHZhbHVlcyBmb3IgY29uZmlndXJhdGlvbiBhbmQgd29ya3NwYWNlIHNlcnZpY2VzLlxuXHQgKi9cblx0Y29uc3QgY3JlYXRlUHJvbXB0c0xvY2F0b3IgPSBhc3luYyAoXG5cdFx0Y29uZmlnVmFsdWU6IHVua25vd24sXG5cdFx0d29ya3NwYWNlRm9sZGVyUGF0aHM6IHN0cmluZ1tdLFxuXHRcdGZpbGVzeXN0ZW06IElNb2NrRm9sZGVyW10sXG5cdCk6IFByb21pc2U8UHJvbXB0RmlsZXNMb2NhdG9yPiA9PiB7XG5cdFx0YXdhaXQgKGluaXRTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1vY2tGaWxlc3lzdGVtLCBmaWxlc3lzdGVtKSkubW9jaygpO1xuXG5cdFx0aW5pdFNlcnZpY2Uuc3R1YihJQ29uZmlndXJhdGlvblNlcnZpY2UsIG1vY2tDb25maWdTZXJ2aWNlKGNvbmZpZ1ZhbHVlKSk7XG5cblx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXJzID0gd29ya3NwYWNlRm9sZGVyUGF0aHMubWFwKChwYXRoLCBpbmRleCkgPT4ge1xuXHRcdFx0Y29uc3QgdXJpID0gY3JlYXRlVVJJKHBhdGgpO1xuXG5cdFx0XHRyZXR1cm4gbW9ja09iamVjdDxJV29ya3NwYWNlRm9sZGVyPih7XG5cdFx0XHRcdHVyaSxcblx0XHRcdFx0bmFtZTogYmFzZW5hbWUodXJpKSxcblx0XHRcdFx0aW5kZXgsXG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRpbml0U2VydmljZS5zdHViKElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgbW9ja1dvcmtzcGFjZVNlcnZpY2Uod29ya3NwYWNlRm9sZGVycykpO1xuXG5cdFx0cmV0dXJuIGluaXRTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFByb21wdEZpbGVzTG9jYXRvcik7XG5cdH07XG5cblx0c3VpdGUoJ1x1MjAyMiBlbXB0eSB3b3Jrc3BhY2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgRU1QVFlfV09SS1NQQUNFOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0c3VpdGUoJ1x1MjAyMiBlbXB0eSBmaWxlc3lzdGVtJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnXHUyMDIyIG5vIGNvbmZpZyB2YWx1ZScsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgbG9jYXRvciA9IGF3YWl0IGNyZWF0ZVByb21wdHNMb2NhdG9yKHVuZGVmaW5lZCwgRU1QVFlfV09SS1NQQUNFLCBbXSk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHQoYXdhaXQgbG9jYXRvci5saXN0RmlsZXMoKSlcblx0XHRcdFx0XHRcdC5tYXAoKGZpbGUpID0+IGZpbGUuZnNQYXRoKSxcblx0XHRcdFx0XHRbXSxcblx0XHRcdFx0XHQnTm8gcHJvbXB0cyBtdXN0IGJlIGZvdW5kLicsXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnXHUyMDIyIG9iamVjdCBjb25maWcgdmFsdWUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxvY2F0b3IgPSBhd2FpdCBjcmVhdGVQcm9tcHRzTG9jYXRvcih7XG5cdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cy8nOiB0cnVlLFxuXHRcdFx0XHRcdCcvdG1wL3Byb21wdHMvJzogZmFsc2UsXG5cdFx0XHRcdH0sIEVNUFRZX1dPUktTUEFDRSwgW10pO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0YXdhaXQgbG9jYXRvci5saXN0RmlsZXMoKSxcblx0XHRcdFx0XHRbXSxcblx0XHRcdFx0XHQnTm8gcHJvbXB0cyBtdXN0IGJlIGZvdW5kLicsXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnXHUyMDIyIGFycmF5IGNvbmZpZyB2YWx1ZScsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgbG9jYXRvciA9IGF3YWl0IGNyZWF0ZVByb21wdHNMb2NhdG9yKFtcblx0XHRcdFx0XHQncmVsYXRpdmUvcGF0aC90by9wcm9tcHRzLycsXG5cdFx0XHRcdFx0Jy9hYnMvcGF0aCcsXG5cdFx0XHRcdF0sIEVNUFRZX1dPUktTUEFDRSwgW10pO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0YXdhaXQgbG9jYXRvci5saXN0RmlsZXMoKSxcblx0XHRcdFx0XHRbXSxcblx0XHRcdFx0XHQnTm8gcHJvbXB0cyBtdXN0IGJlIGZvdW5kLicsXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnXHUyMDIyIG51bGwgY29uZmlnIHZhbHVlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBsb2NhdG9yID0gYXdhaXQgY3JlYXRlUHJvbXB0c0xvY2F0b3IobnVsbCwgRU1QVFlfV09SS1NQQUNFLCBbXSk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHQoYXdhaXQgbG9jYXRvci5saXN0RmlsZXMoKSlcblx0XHRcdFx0XHRcdC5tYXAoKGZpbGUpID0+IGZpbGUuZnNQYXRoKSxcblx0XHRcdFx0XHRbXSxcblx0XHRcdFx0XHQnTm8gcHJvbXB0cyBtdXN0IGJlIGZvdW5kLicsXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnXHUyMDIyIHN0cmluZyBjb25maWcgdmFsdWUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxvY2F0b3IgPSBhd2FpdCBjcmVhdGVQcm9tcHRzTG9jYXRvcignL2V0Yy9ob3N0cy9wcm9tcHRzJywgRU1QVFlfV09SS1NQQUNFLCBbXSk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHQoYXdhaXQgbG9jYXRvci5saXN0RmlsZXMoKSlcblx0XHRcdFx0XHRcdC5tYXAoKGZpbGUpID0+IGZpbGUuZnNQYXRoKSxcblx0XHRcdFx0XHRbXSxcblx0XHRcdFx0XHQnTm8gcHJvbXB0cyBtdXN0IGJlIGZvdW5kLicsXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdcdTIwMjIgbm9uLWVtcHR5IGZpbGVzeXN0ZW0nLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdcdTIwMjIgY29yZSBsb2dpYycsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgbG9jYXRvciA9IGF3YWl0IGNyZWF0ZVByb21wdHNMb2NhdG9yKFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy90bXAvcHJvbXB0cy8nOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy9hYnNvbHV0ZS9wYXRoL3Byb21wdHMnOiBmYWxzZSxcblx0XHRcdFx0XHRcdCcuY29waWxvdC9wcm9tcHRzJzogdHJ1ZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdEVNUFRZX1dPUktTUEFDRSxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ0hlbGxvLCBXb3JsZCEnLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3JlZmFjdG9yLXRlc3RzLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ3NvbWUgZmlsZSBjb250ZW50IGdvZXMgaGVyZScsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcvdG1wL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd0cmFuc2xhdGUudG8tcnVzdC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdzb21lIG1vcmUgcmFuZG9tIGZpbGUgY29udGVudHMnLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRuYW1lOiAnL2Fic29sdXRlL3BhdGgvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3NvbWUtcHJvbXB0LWZpbGUucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnaGV5IGhleSBoZXknLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0KGF3YWl0IGxvY2F0b3IubGlzdEZpbGVzKCkpXG5cdFx0XHRcdFx0XHQubWFwKChmaWxlKSA9PiBmaWxlLmZzUGF0aCksXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMvdGVzdC5wcm9tcHQubWQnKS5wYXRoLFxuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMvcmVmYWN0b3ItdGVzdHMucHJvbXB0Lm1kJykucGF0aCxcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL3RtcC9wcm9tcHRzL3RyYW5zbGF0ZS50by1ydXN0LnByb21wdC5tZCcpLnBhdGgsXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHQnTXVzdCBmaW5kIGNvcnJlY3QgcHJvbXB0cy4nLFxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHN1aXRlKCdcdTIwMjIgYWJzb2x1dGUnLCAoKSA9PiB7XG5cdFx0XHRcdHN1aXRlKCdcdTIwMjIgd2lsZCBjYXJkJywgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHNldHRpbmdzID0gW1xuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi8qLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovKi5tZCcsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovKicsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKicsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKi8qLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKi8qJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzLyoqLyoubWQnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqL3RleHQvKionLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqL3RleHQvKiovKicsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovdGV4dC8qKi8qLm1kJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi90ZXh0LyoqLyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvKionLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC8qKi8qJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvKiovKi5tZCcsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0LyoqLyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRdO1xuXG5cdFx0XHRcdFx0Zm9yIChjb25zdCBzZXR0aW5nIG9mIHNldHRpbmdzKSB7XG5cdFx0XHRcdFx0XHR0ZXN0KGBcdTIwMjIgJyR7c2V0dGluZ30nYCwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBsb2NhdG9yID0gYXdhaXQgY3JlYXRlUHJvbXB0c0xvY2F0b3IoXG5cdFx0XHRcdFx0XHRcdFx0eyBbc2V0dGluZ106IHRydWUgfSxcblx0XHRcdFx0XHRcdFx0XHRFTVBUWV9XT1JLU1BBQ0UsXG5cdFx0XHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdkZXBzL3RleHQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdteS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ25lc3RlZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Vuc3BlY2lmaWMxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJvYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAndW5zcGVjaWZpYzIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcmFib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdyZWFkbWUubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ25vbiBwcm9tcHQgZmlsZScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0KTtcblxuXHRcdFx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdFx0XHRcdChhd2FpdCBsb2NhdG9yLmxpc3RGaWxlcygpKVxuXHRcdFx0XHRcdFx0XHRcdFx0Lm1hcCgoZmlsZSkgPT4gZmlsZS5mc1BhdGgpLFxuXHRcdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0L215LnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0L25lc3RlZC9zcGVjaWZpYy5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC9uZXN0ZWQvdW5zcGVjaWZpYzEucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvbmVzdGVkL3Vuc3BlY2lmaWMyLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdCdNdXN0IGZpbmQgY29ycmVjdCBwcm9tcHRzLicsXG5cdFx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHN1aXRlKGBcdTIwMjIgc3BlY2lmaWNgLCAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgdGVzdFNldHRpbmdzID0gW1xuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovKnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovKnNwZWNpZmljKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqLypzcGVjaWZpYyoubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqL3NwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi91bnNwZWNpZmljMS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovdW5zcGVjaWZpYzIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi9zcGVjaWZpYy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovdW5zcGVjaWZpYyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi9uZXN0ZWQvc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqL25lc3RlZC91bnNwZWNpZmljKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqL25lc3RlZC8qc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi8qc3BlYyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi8qc3BlYyonLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqLypzcGVjKi5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovZGVwcy8qKi8qc3BlYyoubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqL3RleHQvKiovKnNwZWMqLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvbmVzdGVkLypzcGVjKicsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0L25lc3RlZC8qc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzLyoqLypzcGVjaWZpYyonLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvKiovc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvKiovdW5zcGVjaWZpYyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzLyoqL3NwZWNpZmljKi5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzLyoqL3Vuc3BlY2lmaWMqLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzLyoqL3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzLyoqL3Vuc3BlY2lmaWMxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzLyoqL3Vuc3BlY2lmaWMyLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKi9zcGVjaWZpYy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKi91bnNwZWNpZmljMSoubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKi91bnNwZWNpZmljMioubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC8qKi8qc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvKiovc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC8qKi91bnNwZWNpZmljKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC8qKi9zcGVjaWZpYyoubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0LyoqL3Vuc3BlY2lmaWMqLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvKiovc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC8qKi91bnNwZWNpZmljMS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0LyoqL3Vuc3BlY2lmaWMyLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0LyoqL3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvKiovdW5zcGVjaWZpYzEqLm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC8qKi91bnNwZWNpZmljMioubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRdO1xuXG5cdFx0XHRcdFx0Zm9yIChjb25zdCBzZXR0aW5ncyBvZiB0ZXN0U2V0dGluZ3MpIHtcblx0XHRcdFx0XHRcdHRlc3QoYFx1MjAyMiAnJHtKU09OLnN0cmluZ2lmeShzZXR0aW5ncyl9J2AsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgdnNjb2RlU2V0dGluZ3M6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+ID0ge307XG5cdFx0XHRcdFx0XHRcdGZvciAoY29uc3Qgc2V0dGluZyBvZiBzZXR0aW5ncykge1xuXHRcdFx0XHRcdFx0XHRcdHZzY29kZVNldHRpbmdzW3NldHRpbmddID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxvY2F0b3IgPSBhd2FpdCBjcmVhdGVQcm9tcHRzTG9jYXRvcihcblx0XHRcdFx0XHRcdFx0XHR2c2NvZGVTZXR0aW5ncyxcblx0XHRcdFx0XHRcdFx0XHRFTVBUWV9XT1JLU1BBQ0UsXG5cdFx0XHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdkZXBzL3RleHQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdteS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ25lc3RlZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2RlZmF1bHQucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAndW5zcGVjaWZpYzEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcm9ib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd1bnNwZWNpZmljMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCByYXdib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdyZWFkbWUubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ25vbiBwcm9tcHQgZmlsZScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0KTtcblxuXHRcdFx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdFx0XHRcdChhd2FpdCBsb2NhdG9yLmxpc3RGaWxlcygpKVxuXHRcdFx0XHRcdFx0XHRcdFx0Lm1hcCgoZmlsZSkgPT4gZmlsZS5mc1BhdGgpLFxuXHRcdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0L25lc3RlZC9zcGVjaWZpYy5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC9uZXN0ZWQvdW5zcGVjaWZpYzEucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvbmVzdGVkL3Vuc3BlY2lmaWMyLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdCdNdXN0IGZpbmQgY29ycmVjdCBwcm9tcHRzLicsXG5cdFx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdcdTIwMjIgc2luZ2xlLXJvb3Qgd29ya3NwYWNlJywgKCkgPT4ge1xuXHRcdHN1aXRlKCdcdTIwMjIgZ2xvYiBwYXR0ZXJuJywgKCkgPT4ge1xuXHRcdFx0c3VpdGUoJ1x1MjAyMiByZWxhdGl2ZScsICgpID0+IHtcblx0XHRcdFx0c3VpdGUoJ1x1MjAyMiB3aWxkIGNhcmQnLCAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgdGVzdFNldHRpbmdzID0gW1xuXHRcdFx0XHRcdFx0JyoqJyxcblx0XHRcdFx0XHRcdCcqKi8qLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHQnKiovKi5tZCcsXG5cdFx0XHRcdFx0XHQnKiovKicsXG5cdFx0XHRcdFx0XHQnZGVwcy8qKicsXG5cdFx0XHRcdFx0XHQnZGVwcy8qKi8qLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHQnZGVwcy8qKi8qJyxcblx0XHRcdFx0XHRcdCdkZXBzLyoqLyoubWQnLFxuXHRcdFx0XHRcdFx0JyoqL3RleHQvKionLFxuXHRcdFx0XHRcdFx0JyoqL3RleHQvKiovKicsXG5cdFx0XHRcdFx0XHQnKiovdGV4dC8qKi8qLm1kJyxcblx0XHRcdFx0XHRcdCcqKi90ZXh0LyoqLyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdCdkZXBzL3RleHQvKionLFxuXHRcdFx0XHRcdFx0J2RlcHMvdGV4dC8qKi8qJyxcblx0XHRcdFx0XHRcdCdkZXBzL3RleHQvKiovKi5tZCcsXG5cdFx0XHRcdFx0XHQnZGVwcy90ZXh0LyoqLyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRdO1xuXG5cdFx0XHRcdFx0Zm9yIChjb25zdCBzZXR0aW5nIG9mIHRlc3RTZXR0aW5ncykge1xuXHRcdFx0XHRcdFx0dGVzdChgXHUyMDIyICcke3NldHRpbmd9J2AsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbG9jYXRvciA9IGF3YWl0IGNyZWF0ZVByb21wdHNMb2NhdG9yKFxuXHRcdFx0XHRcdFx0XHRcdHsgW3NldHRpbmddOiB0cnVlIH0sXG5cdFx0XHRcdFx0XHRcdFx0WycvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZSddLFxuXHRcdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnZGVwcy90ZXh0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCBib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICduZXN0ZWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdzcGVjaWZpYy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCBib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd1bnNwZWNpZmljMS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCByb2JvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Vuc3BlY2lmaWMyLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJhYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAncmVhZG1lLm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdub24gcHJvbXB0IGZpbGUnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRcdFx0XHQoYXdhaXQgbG9jYXRvci5saXN0RmlsZXMoKSlcblx0XHRcdFx0XHRcdFx0XHRcdC5tYXAoKGZpbGUpID0+IGZpbGUuZnNQYXRoKSxcblx0XHRcdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC9teS5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC9uZXN0ZWQvc3BlY2lmaWMucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvbmVzdGVkL3Vuc3BlY2lmaWMxLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0L25lc3RlZC91bnNwZWNpZmljMi5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHQnTXVzdCBmaW5kIGNvcnJlY3QgcHJvbXB0cy4nLFxuXHRcdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRzdWl0ZShgXHUyMDIyIHNwZWNpZmljYCwgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHRlc3RTZXR0aW5ncyA9IFtcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0JyoqLypzcGVjaWZpYyonLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0JyoqLypzcGVjaWZpYyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcqKi8qc3BlY2lmaWMqLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcqKi9zcGVjaWZpYyonLFxuXHRcdFx0XHRcdFx0XHQnKiovdW5zcGVjaWZpYzEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0JyoqL3Vuc3BlY2lmaWMyLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnKiovc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0JyoqL3Vuc3BlY2lmaWMqLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnKiovbmVzdGVkL3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcqKi9uZXN0ZWQvdW5zcGVjaWZpYyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcqKi9uZXN0ZWQvKnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnKiovKnNwZWMqLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnKiovKnNwZWMqJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcqKi8qc3BlYyoubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0JyoqL2RlcHMvKiovKnNwZWMqLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcqKi90ZXh0LyoqLypzcGVjKi5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnZGVwcy90ZXh0L25lc3RlZC8qc3BlYyonLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0J2RlcHMvdGV4dC9uZXN0ZWQvKnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnZGVwcy8qKi8qc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCdkZXBzLyoqL3NwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRcdCdkZXBzLyoqL3Vuc3BlY2lmaWMqLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnZGVwcy8qKi9zcGVjaWZpYyoubWQnLFxuXHRcdFx0XHRcdFx0XHQnZGVwcy8qKi91bnNwZWNpZmljKi5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnZGVwcy8qKi9zcGVjaWZpYy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnZGVwcy8qKi91bnNwZWNpZmljMS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnZGVwcy8qKi91bnNwZWNpZmljMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0J2RlcHMvKiovc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J2RlcHMvKiovdW5zcGVjaWZpYzEqLm1kJyxcblx0XHRcdFx0XHRcdFx0J2RlcHMvKiovdW5zcGVjaWZpYzIqLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCdkZXBzL3RleHQvKiovKnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnZGVwcy90ZXh0LyoqL3NwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRcdCdkZXBzL3RleHQvKiovdW5zcGVjaWZpYyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCdkZXBzL3RleHQvKiovc3BlY2lmaWMqLm1kJyxcblx0XHRcdFx0XHRcdFx0J2RlcHMvdGV4dC8qKi91bnNwZWNpZmljKi5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnZGVwcy90ZXh0LyoqL3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCdkZXBzL3RleHQvKiovdW5zcGVjaWZpYzEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J2RlcHMvdGV4dC8qKi91bnNwZWNpZmljMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0J2RlcHMvdGV4dC8qKi9zcGVjaWZpYy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnZGVwcy90ZXh0LyoqL3Vuc3BlY2lmaWMxKi5tZCcsXG5cdFx0XHRcdFx0XHRcdCdkZXBzL3RleHQvKiovdW5zcGVjaWZpYzIqLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XTtcblxuXHRcdFx0XHRcdGZvciAoY29uc3Qgc2V0dGluZ3Mgb2YgdGVzdFNldHRpbmdzKSB7XG5cdFx0XHRcdFx0XHR0ZXN0KGBcdTIwMjIgJyR7SlNPTi5zdHJpbmdpZnkoc2V0dGluZ3MpfSdgLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHZzY29kZVNldHRpbmdzOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiA9IHt9O1xuXHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHNldHRpbmcgb2Ygc2V0dGluZ3MpIHtcblx0XHRcdFx0XHRcdFx0XHR2c2NvZGVTZXR0aW5nc1tzZXR0aW5nXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRjb25zdCBsb2NhdG9yID0gYXdhaXQgY3JlYXRlUHJvbXB0c0xvY2F0b3IoXG5cdFx0XHRcdFx0XHRcdFx0dnNjb2RlU2V0dGluZ3MsXG5cdFx0XHRcdFx0XHRcdFx0WycvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZSddLFxuXHRcdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnZGVwcy90ZXh0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCBib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICduZXN0ZWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdkZWZhdWx0LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Vuc3BlY2lmaWMxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJvYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAndW5zcGVjaWZpYzIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcmF3Ym90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAncmVhZG1lLm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdub24gcHJvbXB0IGZpbGUnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRcdFx0XHQoYXdhaXQgbG9jYXRvci5saXN0RmlsZXMoKSlcblx0XHRcdFx0XHRcdFx0XHRcdC5tYXAoKGZpbGUpID0+IGZpbGUuZnNQYXRoKSxcblx0XHRcdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC9uZXN0ZWQvc3BlY2lmaWMucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvbmVzdGVkL3Vuc3BlY2lmaWMxLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0L25lc3RlZC91bnNwZWNpZmljMi5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHQnTXVzdCBmaW5kIGNvcnJlY3QgcHJvbXB0cy4nLFxuXHRcdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRzdWl0ZSgnXHUyMDIyIGFic29sdXRlJywgKCkgPT4ge1xuXHRcdFx0XHRzdWl0ZSgnXHUyMDIyIHdpbGQgY2FyZCcsICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBzZXR0aW5ncyA9IFtcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKicsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqLyoubWQnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqLyonLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvKionLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvKiovKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvKiovKicsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKi8qLm1kJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi90ZXh0LyoqJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi90ZXh0LyoqLyonLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqL3RleHQvKiovKi5tZCcsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovdGV4dC8qKi8qLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0LyoqJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvKiovKicsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0LyoqLyoubWQnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC8qKi8qLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XTtcblxuXHRcdFx0XHRcdGZvciAoY29uc3Qgc2V0dGluZyBvZiBzZXR0aW5ncykge1xuXHRcdFx0XHRcdFx0dGVzdChgXHUyMDIyICcke3NldHRpbmd9J2AsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbG9jYXRvciA9IGF3YWl0IGNyZWF0ZVByb21wdHNMb2NhdG9yKFxuXHRcdFx0XHRcdFx0XHRcdHsgW3NldHRpbmddOiB0cnVlIH0sXG5cdFx0XHRcdFx0XHRcdFx0WycvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZSddLFxuXHRcdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnZGVwcy90ZXh0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCBib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICduZXN0ZWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdzcGVjaWZpYy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCBib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd1bnNwZWNpZmljMS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCByb2JvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Vuc3BlY2lmaWMyLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJhYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAncmVhZG1lLm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdub24gcHJvbXB0IGZpbGUnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRcdFx0XHQoYXdhaXQgbG9jYXRvci5saXN0RmlsZXMoKSlcblx0XHRcdFx0XHRcdFx0XHRcdC5tYXAoKGZpbGUpID0+IGZpbGUuZnNQYXRoKSxcblx0XHRcdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC9teS5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC9uZXN0ZWQvc3BlY2lmaWMucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvbmVzdGVkL3Vuc3BlY2lmaWMxLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0L25lc3RlZC91bnNwZWNpZmljMi5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHQnTXVzdCBmaW5kIGNvcnJlY3QgcHJvbXB0cy4nLFxuXHRcdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRzdWl0ZShgXHUyMDIyIHNwZWNpZmljYCwgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHRlc3RTZXR0aW5ncyA9IFtcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqLypzcGVjaWZpYyonLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqLypzcGVjaWZpYyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi8qc3BlY2lmaWMqLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi9zcGVjaWZpYyonLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovdW5zcGVjaWZpYzEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqL3Vuc3BlY2lmaWMyLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqL3Vuc3BlY2lmaWMqLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovbmVzdGVkL3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi9uZXN0ZWQvdW5zcGVjaWZpYyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi9uZXN0ZWQvKnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovKnNwZWMqLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvKiovKnNwZWMqJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi8qc3BlYyoubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLyoqL2RlcHMvKiovKnNwZWMqLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS8qKi90ZXh0LyoqLypzcGVjKi5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0L25lc3RlZC8qc3BlYyonLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC9uZXN0ZWQvKnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKi8qc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzLyoqL3NwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzLyoqL3Vuc3BlY2lmaWMqLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKi9zcGVjaWZpYyoubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKi91bnNwZWNpZmljKi5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKi9zcGVjaWZpYy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKi91bnNwZWNpZmljMS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy8qKi91bnNwZWNpZmljMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvKiovc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvKiovdW5zcGVjaWZpYzEqLm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvKiovdW5zcGVjaWZpYzIqLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvKiovKnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0LyoqL3NwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvKiovdW5zcGVjaWZpYyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvKiovc3BlY2lmaWMqLm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC8qKi91bnNwZWNpZmljKi5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0LyoqL3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvKiovdW5zcGVjaWZpYzEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC8qKi91bnNwZWNpZmljMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC8qKi9zcGVjaWZpYy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0LyoqL3Vuc3BlY2lmaWMxKi5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvKiovdW5zcGVjaWZpYzIqLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XTtcblxuXHRcdFx0XHRcdGZvciAoY29uc3Qgc2V0dGluZ3Mgb2YgdGVzdFNldHRpbmdzKSB7XG5cdFx0XHRcdFx0XHR0ZXN0KGBcdTIwMjIgJyR7SlNPTi5zdHJpbmdpZnkoc2V0dGluZ3MpfSdgLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHZzY29kZVNldHRpbmdzOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiA9IHt9O1xuXHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHNldHRpbmcgb2Ygc2V0dGluZ3MpIHtcblx0XHRcdFx0XHRcdFx0XHR2c2NvZGVTZXR0aW5nc1tzZXR0aW5nXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRjb25zdCBsb2NhdG9yID0gYXdhaXQgY3JlYXRlUHJvbXB0c0xvY2F0b3IoXG5cdFx0XHRcdFx0XHRcdFx0dnNjb2RlU2V0dGluZ3MsXG5cdFx0XHRcdFx0XHRcdFx0WycvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZSddLFxuXHRcdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnZGVwcy90ZXh0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCBib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICduZXN0ZWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdkZWZhdWx0LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Vuc3BlY2lmaWMxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJvYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAndW5zcGVjaWZpYzIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcmF3Ym90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAncmVhZG1lLm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdub24gcHJvbXB0IGZpbGUnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRcdFx0XHQoYXdhaXQgbG9jYXRvci5saXN0RmlsZXMoKSlcblx0XHRcdFx0XHRcdFx0XHRcdC5tYXAoKGZpbGUpID0+IGZpbGUuZnNQYXRoKSxcblx0XHRcdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2RlcHMvdGV4dC9uZXN0ZWQvc3BlY2lmaWMucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9kZXBzL3RleHQvbmVzdGVkL3Vuc3BlY2lmaWMxLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZGVwcy90ZXh0L25lc3RlZC91bnNwZWNpZmljMi5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHQnTXVzdCBmaW5kIGNvcnJlY3QgcHJvbXB0cy4nLFxuXHRcdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgY29yZSBsb2dpYycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhdG9yID0gYXdhaXQgY3JlYXRlUHJvbXB0c0xvY2F0b3IoXG5cdFx0XHR7XG5cdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMnOiB0cnVlLFxuXHRcdFx0XHQnL3RtcC9wcm9tcHRzLyc6IHRydWUsXG5cdFx0XHRcdCcvYWJzb2x1dGUvcGF0aC9wcm9tcHRzJzogZmFsc2UsXG5cdFx0XHRcdCcuY29waWxvdC9wcm9tcHRzJzogdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRbXG5cdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZScsXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cycsXG5cdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdIZWxsbywgV29ybGQhJyxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICdyZWZhY3Rvci10ZXN0cy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRjb250ZW50czogJ3NvbWUgZmlsZSBjb250ZW50IGdvZXMgaGVyZScsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRuYW1lOiAnL3RtcC9wcm9tcHRzJyxcblx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRuYW1lOiAndHJhbnNsYXRlLnRvLXJ1c3QucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdzb21lIG1vcmUgcmFuZG9tIGZpbGUgY29udGVudHMnLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bmFtZTogJy9hYnNvbHV0ZS9wYXRoL3Byb21wdHMnLFxuXHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICdzb21lLXByb21wdC1maWxlLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnaGV5IGhleSBoZXknLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlJyxcblx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRuYW1lOiAnLmNvcGlsb3QvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2RlZmF1bHQucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJvYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcuZ2l0aHViL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdteS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0fSxcblx0XHRcdF0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdChhd2FpdCBsb2NhdG9yLmxpc3RGaWxlcygpKVxuXHRcdFx0XHQubWFwKChmaWxlKSA9PiBmaWxlLmZzUGF0aCksXG5cdFx0XHRbXG5cdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvLmdpdGh1Yi9wcm9tcHRzL215LnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMvdGVzdC5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzL3JlZmFjdG9yLXRlc3RzLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0Y3JlYXRlVVJJKCcvdG1wL3Byb21wdHMvdHJhbnNsYXRlLnRvLXJ1c3QucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLy5jb3BpbG90L3Byb21wdHMvZGVmYXVsdC5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRdLFxuXHRcdFx0J011c3QgZmluZCBjb3JyZWN0IHByb21wdHMuJyxcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgd2l0aCBkaXNhYmxlZCBgLmdpdGh1Yi9wcm9tcHRzYCBsb2NhdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhdG9yID0gYXdhaXQgY3JlYXRlUHJvbXB0c0xvY2F0b3IoXG5cdFx0XHR7XG5cdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMnOiB0cnVlLFxuXHRcdFx0XHQnL3RtcC9wcm9tcHRzLyc6IHRydWUsXG5cdFx0XHRcdCcvYWJzb2x1dGUvcGF0aC9wcm9tcHRzJzogZmFsc2UsXG5cdFx0XHRcdCcuY29waWxvdC9wcm9tcHRzJzogdHJ1ZSxcblx0XHRcdFx0Jy5naXRodWIvcHJvbXB0cyc6IGZhbHNlLFxuXHRcdFx0fSxcblx0XHRcdFtcblx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlJyxcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRuYW1lOiAnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzJyxcblx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRuYW1lOiAndGVzdC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRjb250ZW50czogJ0hlbGxvLCBXb3JsZCEnLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJ3JlZmFjdG9yLXRlc3RzLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnc29tZSBmaWxlIGNvbnRlbnQgZ29lcyBoZXJlJyxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG5hbWU6ICcvdG1wL3Byb21wdHMnLFxuXHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICd0cmFuc2xhdGUudG8tcnVzdC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRjb250ZW50czogJ3NvbWUgbW9yZSByYW5kb20gZmlsZSBjb250ZW50cycsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRuYW1lOiAnL2Fic29sdXRlL3BhdGgvcHJvbXB0cycsXG5cdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJ3NvbWUtcHJvbXB0LWZpbGUucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdoZXkgaGV5IGhleScsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRuYW1lOiAnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUnLFxuXHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcuY29waWxvdC9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnZGVmYXVsdC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcm9ib3QhJyxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJy5naXRodWIvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ215LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCBib3QhJyxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd5b3VyLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCBib3QhJyxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHR9LFxuXHRcdFx0XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0KGF3YWl0IGxvY2F0b3IubGlzdEZpbGVzKCkpXG5cdFx0XHRcdC5tYXAoKGZpbGUpID0+IGZpbGUuZnNQYXRoKSxcblx0XHRcdFtcblx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMvdGVzdC5wcm9tcHQubWQnKS5wYXRoLFxuXHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cy9yZWZhY3Rvci10ZXN0cy5wcm9tcHQubWQnKS5wYXRoLFxuXHRcdFx0XHRjcmVhdGVVUkkoJy90bXAvcHJvbXB0cy90cmFuc2xhdGUudG8tcnVzdC5wcm9tcHQubWQnKS5wYXRoLFxuXHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLy5jb3BpbG90L3Byb21wdHMvZGVmYXVsdC5wcm9tcHQubWQnKS5wYXRoLFxuXHRcdFx0XSxcblx0XHRcdCdNdXN0IGZpbmQgY29ycmVjdCBwcm9tcHRzLicsXG5cdFx0KTtcblx0fSk7XG5cblx0c3VpdGUoJ1x1MjAyMiBtdWx0aS1yb290IHdvcmtzcGFjZScsICgpID0+IHtcblx0XHRzdWl0ZSgnXHUyMDIyIGNvcmUgbG9naWMnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdcdTIwMjIgd2l0aG91dCB0b3AtbGV2ZWwgYC5naXRodWJgIGZvbGRlcicsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgbG9jYXRvciA9IGF3YWl0IGNyZWF0ZVByb21wdHNMb2NhdG9yKFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy90bXAvcHJvbXB0cy8nOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy9hYnNvbHV0ZS9wYXRoL3Byb21wdHMnOiBmYWxzZSxcblx0XHRcdFx0XHRcdCcuY29waWxvdC9wcm9tcHRzJzogZmFsc2UsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mvbm9kZScsXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ0hlbGxvLCBXb3JsZCEnLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3JlZmFjdG9yLXRlc3RzLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ3NvbWUgZmlsZSBjb250ZW50IGdvZXMgaGVyZScsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcvdG1wL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd0cmFuc2xhdGUudG8tcnVzdC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdzb21lIG1vcmUgcmFuZG9tIGZpbGUgY29udGVudHMnLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRuYW1lOiAnL2Fic29sdXRlL3BhdGgvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3NvbWUtcHJvbXB0LWZpbGUucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnaGV5IGhleSBoZXknLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRuYW1lOiAnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUnLFxuXHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICcuY29waWxvdC9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAncHJvbXB0MS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJvYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy5naXRodWIvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2RlZmF1bHQucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCBib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL25vZGUnLFxuXHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICcuY29waWxvdC9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAncHJvbXB0NS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJvYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy5naXRodWIvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3JlZmFjdG9yLXN0YXRpYy1jbGFzc2VzLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdmaWxlIGNvbnRlbnRzJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHQvLyBub3RlISB0aGlzIGZvbGRlciBpcyBub3QgcGFydCBvZiB0aGUgd29ya3NwYWNlLCBzbyBwcm9tcHQgZmlsZXMgYXJlIGBpZ25vcmVkYFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRuYW1lOiAnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8uZ2l0aHViL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdwcm9tcHQtbmFtZS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcm9ib3QhJyxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICduYW1lLW9mLXRoZS1wcm9tcHQucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJhdyBib3QhJyxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRdKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdChhd2FpdCBsb2NhdG9yLmxpc3RGaWxlcygpKVxuXHRcdFx0XHRcdFx0Lm1hcCgoZmlsZSkgPT4gZmlsZS5mc1BhdGgpLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvLmdpdGh1Yi9wcm9tcHRzL2RlZmF1bHQucHJvbXB0Lm1kJykucGF0aCxcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9ub2RlLy5naXRodWIvcHJvbXB0cy9yZWZhY3Rvci1zdGF0aWMtY2xhc3Nlcy5wcm9tcHQubWQnKS5wYXRoLFxuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMvdGVzdC5wcm9tcHQubWQnKS5wYXRoLFxuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMvcmVmYWN0b3ItdGVzdHMucHJvbXB0Lm1kJykucGF0aCxcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL3RtcC9wcm9tcHRzL3RyYW5zbGF0ZS50by1ydXN0LnByb21wdC5tZCcpLnBhdGgsXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHQnTXVzdCBmaW5kIGNvcnJlY3QgcHJvbXB0cy4nLFxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ1x1MjAyMiB3aXRoIHRvcC1sZXZlbCBgLmdpdGh1YmAgZm9sZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBsb2NhdG9yID0gYXdhaXQgY3JlYXRlUHJvbXB0c0xvY2F0b3IoXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cyc6IHRydWUsXG5cdFx0XHRcdFx0XHQnL3RtcC9wcm9tcHRzLyc6IHRydWUsXG5cdFx0XHRcdFx0XHQnL2Fic29sdXRlL3BhdGgvcHJvbXB0cyc6IGZhbHNlLFxuXHRcdFx0XHRcdFx0Jy5jb3BpbG90L3Byb21wdHMnOiBmYWxzZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZScsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9ub2RlJyxcblx0XHRcdFx0XHRcdCcvdmFyL3NoYXJlZC9wcm9tcHRzLy5naXRodWInLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRuYW1lOiAnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAndGVzdC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdIZWxsbywgV29ybGQhJyxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdyZWZhY3Rvci10ZXN0cy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdzb21lIGZpbGUgY29udGVudCBnb2VzIGhlcmUnLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRuYW1lOiAnL3RtcC9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAndHJhbnNsYXRlLnRvLXJ1c3QucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnc29tZSBtb3JlIHJhbmRvbSBmaWxlIGNvbnRlbnRzJyxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJy9hYnNvbHV0ZS9wYXRoL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdzb21lLXByb21wdC1maWxlLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ2hleSBoZXkgaGV5Jyxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlJyxcblx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnLmNvcGlsb3QvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Byb21wdDEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCByb2JvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICcuZ2l0aHViL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdkZWZhdWx0LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRuYW1lOiAnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9ub2RlJyxcblx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnLmNvcGlsb3QvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Byb21wdDUucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCByb2JvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICcuZ2l0aHViL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdyZWZhY3Rvci1zdGF0aWMtY2xhc3Nlcy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnZmlsZSBjb250ZW50cycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0Ly8gbm90ZSEgdGhpcyBmb2xkZXIgaXMgcGFydCBvZiB0aGUgd29ya3NwYWNlLCBzbyBwcm9tcHQgZmlsZXMgYXJlIGBpbmNsdWRlZGBcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJy92YXIvc2hhcmVkL3Byb21wdHMvLmdpdGh1Yi9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAncHJvbXB0LW5hbWUucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJvYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnbmFtZS1vZi10aGUtcHJvbXB0LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCByYXcgYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XSk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHQoYXdhaXQgbG9jYXRvci5saXN0RmlsZXMoKSlcblx0XHRcdFx0XHRcdC5tYXAoKGZpbGUpID0+IGZpbGUuZnNQYXRoKSxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlLy5naXRodWIvcHJvbXB0cy9kZWZhdWx0LnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9ub2RlLy5naXRodWIvcHJvbXB0cy9yZWZhY3Rvci1zdGF0aWMtY2xhc3Nlcy5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy92YXIvc2hhcmVkL3Byb21wdHMvLmdpdGh1Yi9wcm9tcHRzL3Byb21wdC1uYW1lLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL3Zhci9zaGFyZWQvcHJvbXB0cy8uZ2l0aHViL3Byb21wdHMvbmFtZS1vZi10aGUtcHJvbXB0LnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzL3Rlc3QucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMvcmVmYWN0b3ItdGVzdHMucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvdG1wL3Byb21wdHMvdHJhbnNsYXRlLnRvLXJ1c3QucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0J011c3QgZmluZCBjb3JyZWN0IHByb21wdHMuJyxcblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdcdTIwMjIgd2l0aCBkaXNhYmxlZCBgLmdpdGh1Yi9wcm9tcHRzYCBsb2NhdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgbG9jYXRvciA9IGF3YWl0IGNyZWF0ZVByb21wdHNMb2NhdG9yKFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy90bXAvcHJvbXB0cy8nOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy9hYnNvbHV0ZS9wYXRoL3Byb21wdHMnOiBmYWxzZSxcblx0XHRcdFx0XHRcdCcuY29waWxvdC9wcm9tcHRzJzogZmFsc2UsXG5cdFx0XHRcdFx0XHQnLmdpdGh1Yi9wcm9tcHRzJzogZmFsc2UsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mvbm9kZScsXG5cdFx0XHRcdFx0XHQnL3Zhci9zaGFyZWQvcHJvbXB0cy8uZ2l0aHViJyxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnSGVsbG8sIFdvcmxkIScsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAncmVmYWN0b3ItdGVzdHMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnc29tZSBmaWxlIGNvbnRlbnQgZ29lcyBoZXJlJyxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJy90bXAvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3RyYW5zbGF0ZS50by1ydXN0LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ3NvbWUgbW9yZSByYW5kb20gZmlsZSBjb250ZW50cycsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcvYWJzb2x1dGUvcGF0aC9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnc29tZS1wcm9tcHQtZmlsZS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdoZXkgaGV5IGhleScsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZScsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy5jb3BpbG90L3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdwcm9tcHQxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcm9ib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnLmdpdGh1Yi9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnZGVmYXVsdC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mvbm9kZScsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy5jb3BpbG90L3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdwcm9tcHQ1LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcm9ib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnLmdpdGh1Yi9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAncmVmYWN0b3Itc3RhdGljLWNsYXNzZXMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ2ZpbGUgY29udGVudHMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdC8vIG5vdGUhIHRoaXMgZm9sZGVyIGlzIHBhcnQgb2YgdGhlIHdvcmtzcGFjZSwgc28gcHJvbXB0IGZpbGVzIGFyZSBgaW5jbHVkZWRgXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcvdmFyL3NoYXJlZC9wcm9tcHRzLy5naXRodWIvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Byb21wdC1uYW1lLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCByb2JvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ25hbWUtb2YtdGhlLXByb21wdC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcmF3IGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0KGF3YWl0IGxvY2F0b3IubGlzdEZpbGVzKCkpXG5cdFx0XHRcdFx0XHQubWFwKChmaWxlKSA9PiBmaWxlLmZzUGF0aCksXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMvdGVzdC5wcm9tcHQubWQnKS5wYXRoLFxuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMvcmVmYWN0b3ItdGVzdHMucHJvbXB0Lm1kJykucGF0aCxcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL3RtcC9wcm9tcHRzL3RyYW5zbGF0ZS50by1ydXN0LnByb21wdC5tZCcpLnBhdGgsXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHQnTXVzdCBmaW5kIGNvcnJlY3QgcHJvbXB0cy4nLFxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ1x1MjAyMiBtaXhlZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgbG9jYXRvciA9IGF3YWl0IGNyZWF0ZVByb21wdHNMb2NhdG9yKFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqLyp0ZXN0Kic6IHRydWUsXG5cdFx0XHRcdFx0XHQnLmNvcGlsb3QvcHJvbXB0cyc6IGZhbHNlLFxuXHRcdFx0XHRcdFx0Jy5naXRodWIvcHJvbXB0cyc6IHRydWUsXG5cdFx0XHRcdFx0XHQnL2Fic29sdXRlL3BhdGgvcHJvbXB0cy9zb21lLXByb21wdC1maWxlLnByb21wdC5tZCc6IHRydWUsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mvbm9kZScsXG5cdFx0XHRcdFx0XHQnL3Zhci9zaGFyZWQvcHJvbXB0cy8uZ2l0aHViJyxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnSGVsbG8sIFdvcmxkIScsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAncmVmYWN0b3ItdGVzdHMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnc29tZSBmaWxlIGNvbnRlbnQgZ29lcyBoZXJlJyxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdlbGYucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnaGFhbG8hJyxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJy90bXAvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3RyYW5zbGF0ZS50by1ydXN0LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ3NvbWUgbW9yZSByYW5kb20gZmlsZSBjb250ZW50cycsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcvYWJzb2x1dGUvcGF0aC9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnc29tZS1wcm9tcHQtZmlsZS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdoZXkgaGV5IGhleScsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZScsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy5jb3BpbG90L3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdwcm9tcHQxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcm9ib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnLmdpdGh1Yi9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnZGVmYXVsdC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mvbm9kZScsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy5jb3BpbG90L3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdwcm9tcHQ1LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcm9ib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnLmdpdGh1Yi9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAncmVmYWN0b3Itc3RhdGljLWNsYXNzZXMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ2ZpbGUgY29udGVudHMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdC8vIG5vdGUhIHRoaXMgZm9sZGVyIGlzIHBhcnQgb2YgdGhlIHdvcmtzcGFjZSwgc28gcHJvbXB0IGZpbGVzIGFyZSBgaW5jbHVkZWRgXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICcvdmFyL3NoYXJlZC9wcm9tcHRzLy5naXRodWIvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Byb21wdC1uYW1lLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCByb2JvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ25hbWUtb2YtdGhlLXByb21wdC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcmF3IGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0KGF3YWl0IGxvY2F0b3IubGlzdEZpbGVzKCkpXG5cdFx0XHRcdFx0XHQubWFwKChmaWxlKSA9PiBmaWxlLmZzUGF0aCksXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0Ly8gYWxsIG9mIHRoZXNlIGFyZSBkdWUgdG8gdGhlIGAuZ2l0aHViL3Byb21wdHNgIHNldHRpbmdcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvLmdpdGh1Yi9wcm9tcHRzL2RlZmF1bHQucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL25vZGUvLmdpdGh1Yi9wcm9tcHRzL3JlZmFjdG9yLXN0YXRpYy1jbGFzc2VzLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL3Zhci9zaGFyZWQvcHJvbXB0cy8uZ2l0aHViL3Byb21wdHMvcHJvbXB0LW5hbWUucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvdmFyL3NoYXJlZC9wcm9tcHRzLy5naXRodWIvcHJvbXB0cy9uYW1lLW9mLXRoZS1wcm9tcHQucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0Ly8gYWxsIG9mIHRoZXNlIGFyZSBkdWUgdG8gdGhlIGAvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqLyp0ZXN0KmAgc2V0dGluZ1xuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMvdGVzdC5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cy9yZWZhY3Rvci10ZXN0cy5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHQvLyB0aGlzIG9uZSBpcyBkdWUgdG8gdGhlIHNwZWNpZmljIGAvYWJzb2x1dGUvcGF0aC9wcm9tcHRzL3NvbWUtcHJvbXB0LWZpbGUucHJvbXB0Lm1kYCBzZXR0aW5nXG5cdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9hYnNvbHV0ZS9wYXRoL3Byb21wdHMvc29tZS1wcm9tcHQtZmlsZS5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHQnTXVzdCBmaW5kIGNvcnJlY3QgcHJvbXB0cy4nLFxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRzdWl0ZSgnXHUyMDIyIGdsb2IgcGF0dGVybicsICgpID0+IHtcblx0XHRcdHN1aXRlKCdcdTIwMjIgcmVsYXRpdmUnLCAoKSA9PiB7XG5cdFx0XHRcdHN1aXRlKCdcdTIwMjIgd2lsZCBjYXJkJywgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHRlc3RTZXR0aW5ncyA9IFtcblx0XHRcdFx0XHRcdCcqKicsXG5cdFx0XHRcdFx0XHQnKiovKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0JyoqLyoubWQnLFxuXHRcdFx0XHRcdFx0JyoqLyonLFxuXHRcdFx0XHRcdFx0J2dlbiovKionLFxuXHRcdFx0XHRcdFx0J2dlbiovKiovKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0J2dlbiovKiovKicsXG5cdFx0XHRcdFx0XHQnZ2VuKi8qKi8qLm1kJyxcblx0XHRcdFx0XHRcdCcqKi9nZW4qLyoqJyxcblx0XHRcdFx0XHRcdCcqKi9nZW4qLyoqLyonLFxuXHRcdFx0XHRcdFx0JyoqL2dlbiovKiovKi5tZCcsXG5cdFx0XHRcdFx0XHQnKiovZ2VuKi8qKi8qLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHQne2dlbmVyaWMsZ2VuZXJhbCxnZW59LyoqJyxcblx0XHRcdFx0XHRcdCd7Z2VuZXJpYyxnZW5lcmFsLGdlbn0vKiovKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0J3tnZW5lcmljLGdlbmVyYWwsZ2VufS8qKi8qJyxcblx0XHRcdFx0XHRcdCd7Z2VuZXJpYyxnZW5lcmFsLGdlbn0vKiovKi5tZCcsXG5cdFx0XHRcdFx0XHQnKiove2dlbmVyaWMsZ2VuZXJhbCxnZW59LyoqJyxcblx0XHRcdFx0XHRcdCcqKi97Z2VuZXJpYyxnZW5lcmFsLGdlbn0vKiovKicsXG5cdFx0XHRcdFx0XHQnKiove2dlbmVyaWMsZ2VuZXJhbCxnZW59LyoqLyoubWQnLFxuXHRcdFx0XHRcdFx0JyoqL3tnZW5lcmljLGdlbmVyYWwsZ2VufS8qKi8qLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XTtcblxuXHRcdFx0XHRcdGZvciAoY29uc3Qgc2V0dGluZyBvZiB0ZXN0U2V0dGluZ3MpIHtcblx0XHRcdFx0XHRcdHRlc3QoYFx1MjAyMiAnJHtzZXR0aW5nfSdgLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxvY2F0b3IgPSBhd2FpdCBjcmVhdGVQcm9tcHRzTG9jYXRvcihcblx0XHRcdFx0XHRcdFx0XHR7IFtzZXR0aW5nXTogdHJ1ZSB9LFxuXHRcdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZScsXG5cdFx0XHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnZ2VuL3RleHQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdteS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ25lc3RlZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Vuc3BlY2lmaWMxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJvYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAndW5zcGVjaWZpYzIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcmFib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdyZWFkbWUubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ25vbiBwcm9tcHQgZmlsZScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdnZW5lcmFsJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnY29tbW9uLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAndW5jb21tb24tMTAucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCByb2JvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2xpY2Vuc2UubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnbm9uIHByb21wdCBmaWxlJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0XHRcdFx0KGF3YWl0IGxvY2F0b3IubGlzdEZpbGVzKCkpXG5cdFx0XHRcdFx0XHRcdFx0XHQubWFwKChmaWxlKSA9PiBmaWxlLmZzUGF0aCksXG5cdFx0XHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9nZW4vdGV4dC9teS5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0L25lc3RlZC9zcGVjaWZpYy5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0L25lc3RlZC91bnNwZWNpZmljMS5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0L25lc3RlZC91bnNwZWNpZmljMi5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHQvLyAtXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cy9nZW5lcmFsL2NvbW1vbi5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cy9nZW5lcmFsL3VuY29tbW9uLTEwLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdCdNdXN0IGZpbmQgY29ycmVjdCBwcm9tcHRzLicsXG5cdFx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHN1aXRlKGBcdTIwMjIgc3BlY2lmaWNgLCAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgdGVzdFNldHRpbmdzID0gW1xuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnKiovbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0JyoqLypzcGVjaWZpYyonLFxuXHRcdFx0XHRcdFx0XHQnKiovKmNvbW1vbionLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0JyoqL215LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcqKi8qc3BlY2lmaWMqLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcqKi8qY29tbW9uKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0JyoqL215Ki5tZCcsXG5cdFx0XHRcdFx0XHRcdCcqKi8qc3BlY2lmaWMqLm1kJyxcblx0XHRcdFx0XHRcdFx0JyoqLypjb21tb24qLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcqKi9teSoubWQnLFxuXHRcdFx0XHRcdFx0XHQnKiovc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdFx0JyoqL3Vuc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdFx0JyoqL2NvbW1vbionLFxuXHRcdFx0XHRcdFx0XHQnKiovdW5jb21tb24qJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcqKi9teS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnKiovc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0JyoqL3Vuc3BlY2lmaWMxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcqKi91bnNwZWNpZmljMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnKiovY29tbW9uLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcqKi91bmNvbW1vbi0xMC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0J2dlbiovKiovbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J2dlbiovKiovKnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRcdCdnZW4qLyoqLypjb21tb24qJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCdnZW4qLyoqL215LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCdnZW4qLyoqLypzcGVjaWZpYyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J2dlbiovKiovKmNvbW1vbioucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCdnZW4qLyoqL215Ki5tZCcsXG5cdFx0XHRcdFx0XHRcdCdnZW4qLyoqLypzcGVjaWZpYyoubWQnLFxuXHRcdFx0XHRcdFx0XHQnZ2VuKi8qKi8qY29tbW9uKi5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnZ2VuKi8qKi9teSoubWQnLFxuXHRcdFx0XHRcdFx0XHQnZ2VuKi8qKi9zcGVjaWZpYyonLFxuXHRcdFx0XHRcdFx0XHQnZ2VuKi8qKi91bnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRcdCdnZW4qLyoqL2NvbW1vbionLFxuXHRcdFx0XHRcdFx0XHQnZ2VuKi8qKi91bmNvbW1vbionLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0J2dlbiovKiovbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J2dlbiovKiovc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J2dlbiovKiovdW5zcGVjaWZpYzEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J2dlbiovKiovdW5zcGVjaWZpYzIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J2dlbiovKiovY29tbW9uLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCdnZW4qLyoqL3VuY29tbW9uLTEwLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnZ2VuL3RleHQvbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J2dlbi90ZXh0L25lc3RlZC9zcGVjaWZpYy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnZ2VuL3RleHQvbmVzdGVkL3Vuc3BlY2lmaWMxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCdnZW4vdGV4dC9uZXN0ZWQvdW5zcGVjaWZpYzIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J2dlbmVyYWwvY29tbW9uLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCdnZW5lcmFsL3VuY29tbW9uLTEwLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnZ2VuL3RleHQvbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J2dlbi90ZXh0L25lc3RlZC8qc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdFx0J2dlbmVyYWwvKmNvbW1vbionLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0J2dlbi90ZXh0L215LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCdnZW4vdGV4dC8qKi9zcGVjaWZpYy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnZ2VuL3RleHQvKiovdW5zcGVjaWZpYzEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J2dlbi90ZXh0LyoqL3Vuc3BlY2lmaWMyLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCdnZW5lcmFsLyonLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0J3tnZW4sZ2VuZXJhbH0vKiovbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J3tnZW4sZ2VuZXJhbH0vKiovKnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRcdCd7Z2VuLGdlbmVyYWx9LyoqLypjb21tb24qJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCd7Z2VuLGdlbmVyYWx9LyoqL215LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCd7Z2VuLGdlbmVyYWx9LyoqLypzcGVjaWZpYyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J3tnZW4sZ2VuZXJhbH0vKiovKmNvbW1vbioucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCd7Z2VuLGdlbmVyYWx9LyoqL215Ki5tZCcsXG5cdFx0XHRcdFx0XHRcdCd7Z2VuLGdlbmVyYWx9LyoqLypzcGVjaWZpYyoubWQnLFxuXHRcdFx0XHRcdFx0XHQne2dlbixnZW5lcmFsfS8qKi8qY29tbW9uKi5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQne2dlbixnZW5lcmFsfS8qKi9teSoubWQnLFxuXHRcdFx0XHRcdFx0XHQne2dlbixnZW5lcmFsfS8qKi9zcGVjaWZpYyonLFxuXHRcdFx0XHRcdFx0XHQne2dlbixnZW5lcmFsfS8qKi91bnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRcdCd7Z2VuLGdlbmVyYWx9LyoqL2NvbW1vbionLFxuXHRcdFx0XHRcdFx0XHQne2dlbixnZW5lcmFsfS8qKi91bmNvbW1vbionLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0J3tnZW4sZ2VuZXJhbH0vKiovbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J3tnZW4sZ2VuZXJhbH0vKiovc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J3tnZW4sZ2VuZXJhbH0vKiovdW5zcGVjaWZpYzEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J3tnZW4sZ2VuZXJhbH0vKiovdW5zcGVjaWZpYzIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0J3tnZW4sZ2VuZXJhbH0vKiovY29tbW9uLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCd7Z2VuLGdlbmVyYWx9LyoqL3VuY29tbW9uLTEwLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdF07XG5cblx0XHRcdFx0XHRmb3IgKGNvbnN0IHNldHRpbmdzIG9mIHRlc3RTZXR0aW5ncykge1xuXHRcdFx0XHRcdFx0dGVzdChgXHUyMDIyICcke0pTT04uc3RyaW5naWZ5KHNldHRpbmdzKX0nYCwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB2c2NvZGVTZXR0aW5nczogUmVjb3JkPHN0cmluZywgYm9vbGVhbj4gPSB7fTtcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCBzZXR0aW5nIG9mIHNldHRpbmdzKSB7XG5cdFx0XHRcdFx0XHRcdFx0dnNjb2RlU2V0dGluZ3Nbc2V0dGluZ10gPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0Y29uc3QgbG9jYXRvciA9IGF3YWl0IGNyZWF0ZVByb21wdHNMb2NhdG9yKFxuXHRcdFx0XHRcdFx0XHRcdHZzY29kZVNldHRpbmdzLFxuXHRcdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZScsXG5cdFx0XHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnZ2VuL3RleHQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdteS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ25lc3RlZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIGJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Vuc3BlY2lmaWMxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJvYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAndW5zcGVjaWZpYzIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcmFib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdyZWFkbWUubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ25vbiBwcm9tcHQgZmlsZScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdnZW5lcmFsJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnY29tbW9uLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAndW5jb21tb24tMTAucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCByb2JvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2xpY2Vuc2UubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnbm9uIHByb21wdCBmaWxlJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0XHRcdFx0KGF3YWl0IGxvY2F0b3IubGlzdEZpbGVzKCkpXG5cdFx0XHRcdFx0XHRcdFx0XHQubWFwKChmaWxlKSA9PiBmaWxlLmZzUGF0aCksXG5cdFx0XHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9nZW4vdGV4dC9teS5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0L25lc3RlZC9zcGVjaWZpYy5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0L25lc3RlZC91bnNwZWNpZmljMS5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0L25lc3RlZC91bnNwZWNpZmljMi5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHQvLyAtXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cy9nZW5lcmFsL2NvbW1vbi5wcm9tcHQubWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cy9nZW5lcmFsL3VuY29tbW9uLTEwLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdCdNdXN0IGZpbmQgY29ycmVjdCBwcm9tcHRzLicsXG5cdFx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHN1aXRlKCdcdTIwMjIgYWJzb2x1dGUnLCAoKSA9PiB7XG5cdFx0XHRcdHN1aXRlKCdcdTIwMjIgd2lsZCBjYXJkJywgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHRlc3RTZXR0aW5ncyA9IFtcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqLyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqLyoubWQnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovKicsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi9nZW4qLyoqJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL2dlbiovKiovKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovZ2VuKi8qKi8qJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL2dlbiovKiovKi5tZCcsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi9nZW4qLyoqJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL2dlbiovKiovKicsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi9nZW4qLyoqLyoubWQnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovZ2VuKi8qKi8qLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97dnNjb2RlLHByb21wdHN9LyoqJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3t2c2NvZGUscHJvbXB0c30vKiovKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3ZzY29kZSxwcm9tcHRzfS8qKi8qLm1kJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3t2c2NvZGUscHJvbXB0c30vKiovKicsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97dnNjb2RlLHByb21wdHN9LyoqL2dlbiovKionLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3ZzY29kZSxwcm9tcHRzfS8qKi9nZW4qLyoqLyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3t2c2NvZGUscHJvbXB0c30vKiovZ2VuKi8qKi8qJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3t2c2NvZGUscHJvbXB0c30vKiovZ2VuKi8qKi8qLm1kJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3t2c2NvZGUscHJvbXB0c30vKiovZ2VuKi8qKicsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97dnNjb2RlLHByb21wdHN9LyoqL2dlbiovKiovKicsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97dnNjb2RlLHByb21wdHN9LyoqL2dlbiovKiovKi5tZCcsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97dnNjb2RlLHByb21wdHN9LyoqL2dlbiovKiovKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3ZzY29kZSxwcm9tcHRzfS8qKi97Z2VuZXJhbCxnZW59LyoqJyxcblx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3t2c2NvZGUscHJvbXB0c30vKiove2dlbmVyYWwsZ2VufS8qKi8qLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97dnNjb2RlLHByb21wdHN9LyoqL3tnZW5lcmFsLGdlbn0vKiovKicsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97dnNjb2RlLHByb21wdHN9LyoqL3tnZW5lcmFsLGdlbn0vKiovKi5tZCcsXG5cdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97dnNjb2RlLHByb21wdHN9LyoqL3tnZW5lcmFsLGdlbn0vKionLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3ZzY29kZSxwcm9tcHRzfS8qKi97Z2VuZXJhbCxnZW59LyoqLyonLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3ZzY29kZSxwcm9tcHRzfS8qKi97Z2VuZXJhbCxnZW59LyoqLyoubWQnLFxuXHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3ZzY29kZSxwcm9tcHRzfS8qKi97Z2VuZXJhbCxnZW59LyoqLyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRdO1xuXG5cdFx0XHRcdFx0Zm9yIChjb25zdCBzZXR0aW5nIG9mIHRlc3RTZXR0aW5ncykge1xuXHRcdFx0XHRcdFx0dGVzdChgXHUyMDIyICcke3NldHRpbmd9J2AsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbG9jYXRvciA9IGF3YWl0IGNyZWF0ZVByb21wdHNMb2NhdG9yKFxuXHRcdFx0XHRcdFx0XHRcdHsgW3NldHRpbmddOiB0cnVlIH0sXG5cdFx0XHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlJyxcblx0XHRcdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdnZW4vdGV4dCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ215LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnbmVzdGVkJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAndW5zcGVjaWZpYzEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcm9ib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd1bnNwZWNpZmljMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCByYWJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3JlYWRtZS5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnbm9uIHByb21wdCBmaWxlJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2dlbmVyYWwnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdjb21tb24ucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCBib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd1bmNvbW1vbi0xMC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJvYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnbGljZW5zZS5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdub24gcHJvbXB0IGZpbGUnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRcdFx0XHQoYXdhaXQgbG9jYXRvci5saXN0RmlsZXMoKSlcblx0XHRcdFx0XHRcdFx0XHRcdC5tYXAoKGZpbGUpID0+IGZpbGUuZnNQYXRoKSxcblx0XHRcdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0L215LnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZ2VuL3RleHQvbmVzdGVkL3NwZWNpZmljLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZ2VuL3RleHQvbmVzdGVkL3Vuc3BlY2lmaWMxLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZ2VuL3RleHQvbmVzdGVkL3Vuc3BlY2lmaWMyLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdC8vIC1cblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzL2dlbmVyYWwvY29tbW9uLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzL2dlbmVyYWwvdW5jb21tb24tMTAucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0J011c3QgZmluZCBjb3JyZWN0IHByb21wdHMuJyxcblx0XHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0c3VpdGUoYFx1MjAyMiBzcGVjaWZpY2AsICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCB0ZXN0U2V0dGluZ3MgPSBbXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL215LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqLypzcGVjaWZpYyonLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi8qY29tbW9uKicsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi9teS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi8qc3BlY2lmaWMqLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqLypjb21tb24qLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi9teSoubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi8qc3BlY2lmaWMqLm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovKmNvbW1vbioubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovbXkqLm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovdW5zcGVjaWZpYyonLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi9jb21tb24qJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovdW5jb21tb24qJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL215LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL3Vuc3BlY2lmaWMxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL3Vuc3BlY2lmaWMyLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL2NvbW1vbi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi91bmNvbW1vbi0xMC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovZ2VuKi8qKi9teS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi9nZW4qLyoqLypzcGVjaWZpYyonLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi9nZW4qLyoqLypjb21tb24qJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL2dlbiovKiovbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovZ2VuKi8qKi8qc3BlY2lmaWMqLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL2dlbiovKiovKmNvbW1vbioucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL2dlbiovKiovbXkqLm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovZ2VuKi8qKi8qc3BlY2lmaWMqLm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovZ2VuKi8qKi8qY29tbW9uKi5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi9nZW4qLyoqL215Ki5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL2dlbiovKiovc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovZ2VuKi8qKi91bnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL2dlbiovKiovY29tbW9uKicsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL2dlbiovKiovdW5jb21tb24qJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL2dlbiovKiovbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovZ2VuKi8qKi9zcGVjaWZpYy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi9nZW4qLyoqL3Vuc3BlY2lmaWMxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL2dlbiovKiovdW5zcGVjaWZpYzIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovZ2VuKi8qKi9jb21tb24ucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiovZ2VuKi8qKi91bmNvbW1vbi0xMC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0L215LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9nZW4vdGV4dC9uZXN0ZWQvc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0L25lc3RlZC91bnNwZWNpZmljMS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZ2VuL3RleHQvbmVzdGVkL3Vuc3BlY2lmaWMyLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMvZ2VuZXJhbC9jb21tb24ucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cy9nZW5lcmFsL3VuY29tbW9uLTEwLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZ2VuL3RleHQvbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0L25lc3RlZC8qc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cy9nZW5lcmFsLypjb21tb24qJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9nZW4vdGV4dC9teS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZ2VuL3RleHQvKiovc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0LyoqL3Vuc3BlY2lmaWMxLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9nZW4vdGV4dC8qKi91bnNwZWNpZmljMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzL2dlbmVyYWwvKicsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi97Z2VuLGdlbmVyYWx9LyoqL215LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL3tnZW4sZ2VuZXJhbH0vKiovKnNwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL3tnZW4sZ2VuZXJhbH0vKiovKmNvbW1vbionLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiove2dlbixnZW5lcmFsfS8qKi9teS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi97Z2VuLGdlbmVyYWx9LyoqLypzcGVjaWZpYyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiove2dlbixnZW5lcmFsfS8qKi8qY29tbW9uKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiove2dlbixnZW5lcmFsfS8qKi9teSoubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi97Z2VuLGdlbmVyYWx9LyoqLypzcGVjaWZpYyoubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi97Z2VuLGdlbmVyYWx9LyoqLypjb21tb24qLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL3tnZW4sZ2VuZXJhbH0vKiovbXkqLm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiove2dlbixnZW5lcmFsfS8qKi9zcGVjaWZpYyonLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi97Z2VuLGdlbmVyYWx9LyoqL3Vuc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiove2dlbixnZW5lcmFsfS8qKi9jb21tb24qJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiove2dlbixnZW5lcmFsfS8qKi91bmNvbW1vbionLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiove2dlbixnZW5lcmFsfS8qKi9teS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi97Z2VuLGdlbmVyYWx9LyoqL3NwZWNpZmljLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zLyoqL3tnZW4sZ2VuZXJhbH0vKiovdW5zcGVjaWZpYzEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvKiove2dlbixnZW5lcmFsfS8qKi91bnNwZWNpZmljMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi97Z2VuLGdlbmVyYWx9LyoqL2NvbW1vbi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy8qKi97Z2VuLGdlbmVyYWx9LyoqL3VuY29tbW9uLTEwLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97cHJvbXB0cyx2c2NvZGUsY29waWxvdH0ve2dlbixnZW5lcmFsfS8qKi9teS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97cHJvbXB0cyx2c2NvZGUsY29waWxvdH0ve2dlbixnZW5lcmFsfS8qKi8qc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3Byb21wdHMsdnNjb2RlLGNvcGlsb3R9L3tnZW4sZ2VuZXJhbH0vKiovKmNvbW1vbionLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3Byb21wdHMsdnNjb2RlLGNvcGlsb3R9L3tnZW4sZ2VuZXJhbH0vKiovbXkucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3Byb21wdHMsdnNjb2RlLGNvcGlsb3R9L3tnZW4sZ2VuZXJhbH0vKiovKnNwZWNpZmljKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97cHJvbXB0cyx2c2NvZGUsY29waWxvdH0ve2dlbixnZW5lcmFsfS8qKi8qY29tbW9uKi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3Byb21wdHMsdnNjb2RlLGNvcGlsb3R9L3tnZW4sZ2VuZXJhbH0vKiovbXkqLm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3Byb21wdHMsdnNjb2RlLGNvcGlsb3R9L3tnZW4sZ2VuZXJhbH0vKiovKnNwZWNpZmljKi5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3twcm9tcHRzLHZzY29kZSxjb3BpbG90fS97Z2VuLGdlbmVyYWx9LyoqLypjb21tb24qLm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3twcm9tcHRzLHZzY29kZSxjb3BpbG90fS97Z2VuLGdlbmVyYWx9LyoqL215Ki5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3twcm9tcHRzLHZzY29kZSxjb3BpbG90fS97Z2VuLGdlbmVyYWx9LyoqL3NwZWNpZmljKicsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3twcm9tcHRzLHZzY29kZSxjb3BpbG90fS97Z2VuLGdlbmVyYWx9LyoqL3Vuc3BlY2lmaWMqJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3Byb21wdHMsdnNjb2RlLGNvcGlsb3R9L3tnZW4sZ2VuZXJhbH0vKiovY29tbW9uKicsXG5cdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3twcm9tcHRzLHZzY29kZSxjb3BpbG90fS97Z2VuLGdlbmVyYWx9LyoqL3VuY29tbW9uKicsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97cHJvbXB0cyx2c2NvZGUsY29waWxvdH0ve2dlbixnZW5lcmFsfS8qKi9teS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97cHJvbXB0cyx2c2NvZGUsY29waWxvdH0ve2dlbixnZW5lcmFsfS8qKi9zcGVjaWZpYy5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97cHJvbXB0cyx2c2NvZGUsY29waWxvdH0ve2dlbixnZW5lcmFsfS8qKi91bnNwZWNpZmljMS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97cHJvbXB0cyx2c2NvZGUsY29waWxvdH0ve2dlbixnZW5lcmFsfS8qKi91bnNwZWNpZmljMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy97cHJvbXB0cyx2c2NvZGUsY29waWxvdH0ve2dlbixnZW5lcmFsfS8qKi9jb21tb24ucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3Mve3Byb21wdHMsdnNjb2RlLGNvcGlsb3R9L3tnZW4sZ2VuZXJhbH0vKiovdW5jb21tb24tMTAucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XTtcblxuXHRcdFx0XHRcdGZvciAoY29uc3Qgc2V0dGluZ3Mgb2YgdGVzdFNldHRpbmdzKSB7XG5cdFx0XHRcdFx0XHR0ZXN0KGBcdTIwMjIgJyR7SlNPTi5zdHJpbmdpZnkoc2V0dGluZ3MpfSdgLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHZzY29kZVNldHRpbmdzOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiA9IHt9O1xuXHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHNldHRpbmcgb2Ygc2V0dGluZ3MpIHtcblx0XHRcdFx0XHRcdFx0XHR2c2NvZGVTZXR0aW5nc1tzZXR0aW5nXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRjb25zdCBsb2NhdG9yID0gYXdhaXQgY3JlYXRlUHJvbXB0c0xvY2F0b3IoXG5cdFx0XHRcdFx0XHRcdFx0dnNjb2RlU2V0dGluZ3MsXG5cdFx0XHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlJyxcblx0XHRcdFx0XHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdnZW4vdGV4dCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ215LnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnbmVzdGVkJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnc3BlY2lmaWMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAndW5zcGVjaWZpYzEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvaCBoaSwgcm9ib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd1bnNwZWNpZmljMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCByYWJvdCEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3JlYWRtZS5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnbm9uIHByb21wdCBmaWxlJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2dlbmVyYWwnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdjb21tb24ucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29oIGhpLCBib3QhJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd1bmNvbW1vbi0xMC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb2ggaGksIHJvYm90IScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnbGljZW5zZS5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdub24gcHJvbXB0IGZpbGUnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRcdFx0XHQoYXdhaXQgbG9jYXRvci5saXN0RmlsZXMoKSlcblx0XHRcdFx0XHRcdFx0XHRcdC5tYXAoKGZpbGUpID0+IGZpbGUuZnNQYXRoKSxcblx0XHRcdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0L215LnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZ2VuL3RleHQvbmVzdGVkL3NwZWNpZmljLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZ2VuL3RleHQvbmVzdGVkL3Vuc3BlY2lmaWMxLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvZ2VuL3RleHQvbmVzdGVkL3Vuc3BlY2lmaWMyLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdC8vIC1cblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzL2dlbmVyYWwvY29tbW9uLnByb21wdC5tZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzL2dlbmVyYWwvdW5jb21tb24tMTAucHJvbXB0Lm1kJykuZnNQYXRoLFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0J011c3QgZmluZCBjb3JyZWN0IHByb21wdHMuJyxcblx0XHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ1x1MjAyMiBpc1ZhbGlkR2xvYicsICgpID0+IHtcblx0XHR0ZXN0KCdcdTIwMjIgdmFsaWQgcGF0dGVybnMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBnbG9icyA9IFtcblx0XHRcdFx0JyoqJyxcblx0XHRcdFx0J1xcKicsXG5cdFx0XHRcdCdcXCoqJyxcblx0XHRcdFx0JyoqLyonLFxuXHRcdFx0XHQnKiovKi5wcm9tcHQubWQnLFxuXHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS8qKi8qLnByb21wdC5tZCcsXG5cdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tLyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vKicsXG5cdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3tyZXBvMSx0ZXN0fScsXG5cdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3tyZXBvMSx0ZXN0fS8qKicsXG5cdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3tyZXBvMSx0ZXN0fS8qJyxcblx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vKiove3JlcG8xLHRlc3R9LyoqJyxcblx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vKiove3JlcG8xLHRlc3R9Jyxcblx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vKiove3JlcG8xLHRlc3R9LyonLFxuXHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS8qKi9yZXBvWzEsMiwzXScsXG5cdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tLyoqL3JlcG9bMSwyLDNdLyoqJyxcblx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vKiovcmVwb1sxLDIsM10vKicsXG5cdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tLyoqL3JlcG9bMSwyLDNdLyoqLyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0J3JlcG9bMSwyLDNdLyoqLyoucHJvbXB0Lm1kJyxcblx0XHRcdFx0J3JlcG9bWzEsMiwzXS8qKi8qLnByb21wdC5tZCcsXG5cdFx0XHRcdCd7cmVwbzEsdGVzdH0vKi5wcm9tcHQubWQnLFxuXHRcdFx0XHQne3JlcG8xLHRlc3R9LyonLFxuXHRcdFx0XHQnL3tyZXBvMSx0ZXN0fS8qJyxcblx0XHRcdFx0Jy97cmVwbzEsdGVzdH19LyonLFxuXHRcdFx0XTtcblxuXHRcdFx0Zm9yIChjb25zdCBnbG9iIG9mIGdsb2JzKSB7XG5cdFx0XHRcdGFzc2VydChcblx0XHRcdFx0XHQoaXNWYWxpZEdsb2IoZ2xvYikgPT09IHRydWUpLFxuXHRcdFx0XHRcdGAnJHtnbG9ifScgbXVzdCBiZSBhICd2YWxpZCcgZ2xvYiBwYXR0ZXJuLmAsXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdcdTIwMjIgaW52YWxpZCBwYXR0ZXJucycsICgpID0+IHtcblx0XHRcdGNvbnN0IGdsb2JzID0gW1xuXHRcdFx0XHQnLicsXG5cdFx0XHRcdCdcXFxcKicsXG5cdFx0XHRcdCdcXFxcPycsXG5cdFx0XHRcdCdcXFxcKlxcXFw/XFxcXConLFxuXHRcdFx0XHQncmVwb1sxLDIsMycsXG5cdFx0XHRcdCdyZXBvMSwyLDNdJyxcblx0XHRcdFx0J3JlcG9cXFxcWzEsMiwzXScsXG5cdFx0XHRcdCdyZXBvWzEsMiwzXFxcXF0nLFxuXHRcdFx0XHQncmVwb1xcXFxbMSwyLDNcXFxcXScsXG5cdFx0XHRcdCd7cmVwbzEscmVwbzInLFxuXHRcdFx0XHQncmVwbzEscmVwbzJ9Jyxcblx0XHRcdFx0J1xcXFx7cmVwbzEscmVwbzJ9Jyxcblx0XHRcdFx0J3tyZXBvMSxyZXBvMlxcXFx9Jyxcblx0XHRcdFx0J1xcXFx7cmVwbzEscmVwbzJcXFxcfScsXG5cdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zJyxcblx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb1sxLDIsMycsXG5cdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG8xLDIsM10nLFxuXHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvXFxcXFsxLDIsM10nLFxuXHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvWzEsMiwzXFxcXF0nLFxuXHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvXFxcXFsxLDIsM1xcXFxdJyxcblx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20ve3JlcG8xLHJlcG8yJyxcblx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwbzEscmVwbzJ9Jyxcblx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vXFxcXHtyZXBvMSxyZXBvMn0nLFxuXHRcdFx0XHQnL1VzZXJzL2xlZ29tdXNocm9vbS97cmVwbzEscmVwbzJcXFxcfScsXG5cdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL1xcXFx7cmVwbzEscmVwbzJcXFxcfScsXG5cdFx0XHRdO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGdsb2Igb2YgZ2xvYnMpIHtcblx0XHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRcdChpc1ZhbGlkR2xvYihnbG9iKSA9PT0gZmFsc2UpLFxuXHRcdFx0XHRcdGAnJHtnbG9ifScgbXVzdCBiZSBhbiAnaW52YWxpZCcgZ2xvYiBwYXR0ZXJuLmAsXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdcdTIwMjIgZ2V0Q29uZmlnQmFzZWRTb3VyY2VGb2xkZXJzJywgKCkgPT4ge1xuXHRcdHRlc3QoJ1x1MjAyMiBnZXRzIHVuYW1iaWd1b3VzIGxpc3Qgb2YgZm9sZGVycycsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGxvY2F0b3IgPSBhd2FpdCBjcmVhdGVQcm9tcHRzTG9jYXRvcihcblx0XHRcdFx0e1xuXHRcdFx0XHRcdCcuZ2l0aHViL3Byb21wdHMnOiB0cnVlLFxuXHRcdFx0XHRcdCcvVXNlcnMvKiovcmVwb3MvKionOiB0cnVlLFxuXHRcdFx0XHRcdCdnZW4vdGV4dC8qKic6IHRydWUsXG5cdFx0XHRcdFx0J2dlbi90ZXh0L25lc3RlZC8qLnByb21wdC5tZCc6IHRydWUsXG5cdFx0XHRcdFx0J2dlbmVyYWwvKic6IHRydWUsXG5cdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL215LXByb21wdHMnOiB0cnVlLFxuXHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS95b3VyLXByb21wdHMvKi5tZCc6IHRydWUsXG5cdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cy9zaGFyZWQtcHJvbXB0cy8qJzogdHJ1ZSxcblx0XHRcdFx0fSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZScsXG5cdFx0XHRcdFx0Jy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cycsXG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtdLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0bG9jYXRvci5nZXRDb25maWdCYXNlZFNvdXJjZUZvbGRlcnMoKVxuXHRcdFx0XHRcdC5tYXAoKGZpbGUpID0+IGZpbGUuZnNQYXRoKSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUvLmdpdGh1Yi9wcm9tcHRzJykuZnNQYXRoLFxuXHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzLy5naXRodWIvcHJvbXB0cycpLmZzUGF0aCxcblx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvdnNjb2RlL2dlbi90ZXh0L25lc3RlZCcpLmZzUGF0aCxcblx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy9sZWdvbXVzaHJvb20vcmVwb3MvcHJvbXB0cy9nZW4vdGV4dC9uZXN0ZWQnKS5mc1BhdGgsXG5cdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9nZW5lcmFsJykuZnNQYXRoLFxuXHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzL2dlbmVyYWwnKS5mc1BhdGgsXG5cdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZS9teS1wcm9tcHRzJykuZnNQYXRoLFxuXHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy92c2NvZGUveW91ci1wcm9tcHRzJykuZnNQYXRoLFxuXHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHRzL3NoYXJlZC1wcm9tcHRzJykuZnNQYXRoLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHQnTXVzdCBmaW5kIGNvcnJlY3QgcHJvbXB0cy4nLFxuXHRcdFx0KTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFB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RDtBQUFBLFlBQ0E7QUFBQSxjQUNDO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNEO0FBQUEsWUFDQTtBQUFBLGNBQ0M7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxZQUNBO0FBQUEsY0FDQztBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsWUFDRDtBQUFBLFlBQ0E7QUFBQSxjQUNDO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNEO0FBQUEsWUFDQTtBQUFBLGNBQ0M7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsWUFDRDtBQUFBLFlBQ0E7QUFBQSxjQUNDO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNEO0FBQUEsWUFDQTtBQUFBLGNBQ0M7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxZQUNBO0FBQUEsY0FDQztBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsWUFDRDtBQUFBLFlBQ0E7QUFBQSxjQUNDO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxZQUNBO0FBQUEsY0FDQztBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsWUFDRDtBQUFBLFlBQ0E7QUFBQSxjQUNDO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNEO0FBQUEsWUFDQTtBQUFBLGNBQ0M7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxZQUNBO0FBQUEsY0FDQztBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNEO0FBQUEsWUFDQTtBQUFBLGNBQ0M7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxVQUNEO0FBRUEscUJB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QUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNEO0FBQUEsWUFDQTtBQUFBLGNBQ0M7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxZQUNBO0FBQUEsY0FDQztBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsWUFDRDtBQUFBLFlBQ0E7QUFBQSxjQUNDO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxZQUNBO0FBQUEsY0FDQztBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsWUFDRDtBQUFBLFlBQ0E7QUFBQSxjQUNDO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNEO0FBQUEsWUFDQTtBQUFBLGNBQ0M7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxZQUNBO0FBQUEsY0FDQztBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNEO0FBQUEsWUFDQTtBQUFBLGNBQ0M7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxZQUNBO0FBQUEsY0FDQztBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsWUFDRDtBQUFBLFlBQ0E7QUFBQSxjQUNDO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNEO0FBQUEsWUFDQTtBQUFBLGNBQ0M7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxZQUNBO0FBQUEsY0FDQztBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNEO0FBQUEsWUFDQTtBQUFBLGNBQ0M7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxVQUNEO0FBRUEscUJBQVcsWUFBWSxjQUFjO0FBQ3BDLGlCQUFL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Q2hDLFlBQU0sUUFBUTtBQUFBLFFBQ2I7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBRUEsaUJBQVcsUUFBUSxPQUFPO0FBQ3pCO0FBQUEsVUFDRSxZQUFZLElBQUksTUFBTTtBQUFBLFVBQ3ZCLElBQUksSUFBSTtBQUFBLFFBQ1Q7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsUUFBTSxzQ0FBaUMsTUFBTTtBQUM1QyxTQUFLLDJDQUFzQyxZQUFZO0FBQ3RELFlBQU0sVUFBVSxNQUFNO0FBQUEsUUFDckI7QUFBQSxVQUNDLG1CQUFtQjtBQUFBLFVBQ25CLHNCQUFzQjtBQUFBLFVBQ3RCLGVBQWU7QUFBQSxVQUNmLCtCQUErQjtBQUFBLFVBQy9CLGFBQWE7QUFBQSxVQUNiLCtDQUErQztBQUFBLFVBQy9DLHNEQUFzRDtBQUFBLFVBQ3RELHNEQUFzRDtBQUFBLFFBQ3ZEO0FBQUEsUUFDQTtBQUFBLFVBQ0M7QUFBQSxVQUNBO0FBQUEsUUFDRDtBQUFBLFFBQ0EsQ0FBQztBQUFBLE1BQ0Y7QUFFQSxhQUFPO0FBQUEsUUFDTixRQUFRLDRCQUE0QixFQUNsQyxJQUFJLENBQUMsU0FBUyxLQUFLLE1BQU07QUFBQSxRQUMzQjtBQUFBLFVBQ0MsVUFBVSxrREFBa0QsRUFBRTtBQUFBLFVBQzlELFVBQVUsbURBQW1ELEVBQUU7QUFBQSxVQUMvRCxVQUFVLGtEQUFrRCxFQUFFO0FBQUEsVUFDOUQsVUFBVSxtREFBbUQsRUFBRTtBQUFBLFVBQy9ELFVBQVUsMENBQTBDLEVBQUU7QUFBQSxVQUN0RCxVQUFVLDJDQUEyQyxFQUFFO0FBQUEsVUFDdkQsVUFBVSw2Q0FBNkMsRUFBRTtBQUFBLFVBQ3pELFVBQVUsK0NBQStDLEVBQUU7QUFBQSxVQUMzRCxVQUFVLGtEQUFrRCxFQUFFO0FBQUEsUUFDL0Q7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
