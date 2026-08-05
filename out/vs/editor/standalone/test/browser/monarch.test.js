import assert from "assert";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Token, TokenizationRegistry } from "../../../common/languages.js";
import { LanguageService } from "../../../common/services/languageService.js";
import { StandaloneConfigurationService } from "../../browser/standaloneServices.js";
import { compile } from "../../common/monarch/monarchCompile.js";
import { MonarchTokenizer } from "../../common/monarch/monarchLexer.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
suite("Monarch", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function createMonarchTokenizer(languageService, languageId, language, configurationService) {
    return new MonarchTokenizer(languageService, null, languageId, compile(languageId, language), configurationService);
  }
  function getTokens(tokenizer, lines) {
    const actualTokens = [];
    let state = tokenizer.getInitialState();
    for (const line of lines) {
      const result = tokenizer.tokenize(line, true, state);
      actualTokens.push(result.tokens);
      state = result.endState;
    }
    return actualTokens;
  }
  test("Ensure @rematch and nextEmbedded can be used together in Monarch grammar", () => {
    const disposables = new DisposableStore();
    const languageService = disposables.add(new LanguageService());
    const configurationService = new StandaloneConfigurationService(new NullLogService());
    disposables.add(languageService.registerLanguage({ id: "sql" }));
    disposables.add(TokenizationRegistry.register("sql", disposables.add(createMonarchTokenizer(languageService, "sql", {
      tokenizer: {
        root: [
          [/./, "token"]
        ]
      }
    }, configurationService))));
    const SQL_QUERY_START = "(SELECT|INSERT|UPDATE|DELETE|CREATE|REPLACE|ALTER|WITH)";
    const tokenizer = disposables.add(createMonarchTokenizer(languageService, "test1", {
      tokenizer: {
        root: [
          [`(""")${SQL_QUERY_START}`, [{ "token": "string.quote" }, { token: "@rematch", next: "@endStringWithSQL", nextEmbedded: "sql" }]],
          [/(""")$/, [{ token: "string.quote", next: "@maybeStringIsSQL" }]]
        ],
        maybeStringIsSQL: [
          [/(.*)/, {
            cases: {
              [`${SQL_QUERY_START}\\b.*`]: { token: "@rematch", next: "@endStringWithSQL", nextEmbedded: "sql" },
              "@default": { token: "@rematch", switchTo: "@endDblDocString" }
            }
          }]
        ],
        endDblDocString: [
          ["[^']+", "string"],
          ["\\\\'", "string"],
          ["'''", "string", "@popall"],
          ["'", "string"]
        ],
        endStringWithSQL: [[/"""/, { token: "string.quote", next: "@popall", nextEmbedded: "@pop" }]]
      }
    }, configurationService));
    const lines = [
      `mysql_query("""SELECT * FROM table_name WHERE ds = '<DATEID>'""")`,
      `mysql_query("""`,
      `SELECT *`,
      `FROM table_name`,
      `WHERE ds = '<DATEID>'`,
      `""")`
    ];
    const actualTokens = getTokens(tokenizer, lines);
    assert.deepStrictEqual(actualTokens, [
      [
        new Token(0, "source.test1", "test1"),
        new Token(12, "string.quote.test1", "test1"),
        new Token(15, "token.sql", "sql"),
        new Token(61, "string.quote.test1", "test1"),
        new Token(64, "source.test1", "test1")
      ],
      [
        new Token(0, "source.test1", "test1"),
        new Token(12, "string.quote.test1", "test1")
      ],
      [
        new Token(0, "token.sql", "sql")
      ],
      [
        new Token(0, "token.sql", "sql")
      ],
      [
        new Token(0, "token.sql", "sql")
      ],
      [
        new Token(0, "string.quote.test1", "test1"),
        new Token(3, "source.test1", "test1")
      ]
    ]);
    disposables.dispose();
  });
  test("microsoft/monaco-editor#1235: Empty Line Handling", () => {
    const disposables = new DisposableStore();
    const configurationService = new StandaloneConfigurationService(new NullLogService());
    const languageService = disposables.add(new LanguageService());
    const tokenizer = disposables.add(createMonarchTokenizer(languageService, "test", {
      tokenizer: {
        root: [
          { include: "@comments" }
        ],
        comments: [
          [/\/\/$/, "comment"],
          // empty single-line comment
          [/\/\//, "comment", "@comment_cpp"]
        ],
        comment_cpp: [
          [/(?:[^\\]|(?:\\.))+$/, "comment", "@pop"],
          [/.+$/, "comment"],
          [/$/, "comment", "@pop"]
          // No possible rule to detect an empty line and @pop?
        ]
      }
    }, configurationService));
    const lines = [
      `// This comment \\`,
      `   continues on the following line`,
      ``,
      `// This comment does NOT continue \\\\`,
      `   because the escape char was itself escaped`,
      ``,
      `// This comment DOES continue because \\\\\\`,
      `   the 1st '\\' escapes the 2nd; the 3rd escapes EOL`,
      ``,
      `// This comment continues to the following line \\`,
      ``,
      `But the line was empty. This line should not be commented.`
    ];
    const actualTokens = getTokens(tokenizer, lines);
    assert.deepStrictEqual(actualTokens, [
      [new Token(0, "comment.test", "test")],
      [new Token(0, "comment.test", "test")],
      [],
      [new Token(0, "comment.test", "test")],
      [new Token(0, "source.test", "test")],
      [],
      [new Token(0, "comment.test", "test")],
      [new Token(0, "comment.test", "test")],
      [],
      [new Token(0, "comment.test", "test")],
      [],
      [new Token(0, "source.test", "test")]
    ]);
    disposables.dispose();
  });
  test("microsoft/monaco-editor#2265: Exit a state at end of line", () => {
    const disposables = new DisposableStore();
    const configurationService = new StandaloneConfigurationService(new NullLogService());
    const languageService = disposables.add(new LanguageService());
    const tokenizer = disposables.add(createMonarchTokenizer(languageService, "test", {
      includeLF: true,
      tokenizer: {
        root: [
          [/^\*/, "", "@inner"],
          [/\:\*/, "", "@inner"],
          [/[^*:]+/, "string"],
          [/[*:]/, "string"]
        ],
        inner: [
          [/\n/, "", "@pop"],
          [/\d+/, "number"],
          [/[^\d]+/, ""]
        ]
      }
    }, configurationService));
    const lines = [
      `PRINT 10 * 20`,
      `*FX200, 3`,
      `PRINT 2*3:*FX200, 3`
    ];
    const actualTokens = getTokens(tokenizer, lines);
    assert.deepStrictEqual(actualTokens, [
      [
        new Token(0, "string.test", "test")
      ],
      [
        new Token(0, "", "test"),
        new Token(3, "number.test", "test"),
        new Token(6, "", "test"),
        new Token(8, "number.test", "test")
      ],
      [
        new Token(0, "string.test", "test"),
        new Token(9, "", "test"),
        new Token(13, "number.test", "test"),
        new Token(16, "", "test"),
        new Token(18, "number.test", "test")
      ]
    ]);
    disposables.dispose();
  });
  test("issue #115662: monarchCompile function need an extra option which can control replacement", () => {
    const disposables = new DisposableStore();
    const configurationService = new StandaloneConfigurationService(new NullLogService());
    const languageService = disposables.add(new LanguageService());
    const tokenizer1 = disposables.add(createMonarchTokenizer(languageService, "test", {
      ignoreCase: false,
      uselessReplaceKey1: "@uselessReplaceKey2",
      uselessReplaceKey2: "@uselessReplaceKey3",
      uselessReplaceKey3: "@uselessReplaceKey4",
      uselessReplaceKey4: "@uselessReplaceKey5",
      uselessReplaceKey5: "@ham",
      tokenizer: {
        root: [
          {
            regex: /@\w+/.test("@ham") ? new RegExp(`^${"@uselessReplaceKey1"}$`) : new RegExp(`^${"@ham"}$`),
            action: { token: "ham" }
          }
        ]
      }
    }, configurationService));
    const tokenizer2 = disposables.add(createMonarchTokenizer(languageService, "test", {
      ignoreCase: false,
      tokenizer: {
        root: [
          {
            regex: /@@ham/,
            action: { token: "ham" }
          }
        ]
      }
    }, configurationService));
    const lines = [
      `@ham`
    ];
    const actualTokens1 = getTokens(tokenizer1, lines);
    assert.deepStrictEqual(actualTokens1, [
      [
        new Token(0, "ham.test", "test")
      ]
    ]);
    const actualTokens2 = getTokens(tokenizer2, lines);
    assert.deepStrictEqual(actualTokens2, [
      [
        new Token(0, "ham.test", "test")
      ]
    ]);
    disposables.dispose();
  });
  test("microsoft/monaco-editor#2424: Allow to target @@", () => {
    const disposables = new DisposableStore();
    const configurationService = new StandaloneConfigurationService(new NullLogService());
    const languageService = disposables.add(new LanguageService());
    const tokenizer = disposables.add(createMonarchTokenizer(languageService, "test", {
      ignoreCase: false,
      tokenizer: {
        root: [
          {
            regex: /@@@@/,
            action: { token: "ham" }
          }
        ]
      }
    }, configurationService));
    const lines = [
      `@@`
    ];
    const actualTokens = getTokens(tokenizer, lines);
    assert.deepStrictEqual(actualTokens, [
      [
        new Token(0, "ham.test", "test")
      ]
    ]);
    disposables.dispose();
  });
  test("microsoft/monaco-editor#3025: Check maxTokenizationLineLength before tokenizing", async () => {
    const disposables = new DisposableStore();
    const configurationService = new StandaloneConfigurationService(new NullLogService());
    const languageService = disposables.add(new LanguageService());
    await configurationService.updateValue("editor.maxTokenizationLineLength", 4);
    const tokenizer = disposables.add(createMonarchTokenizer(languageService, "test", {
      tokenizer: {
        root: [
          {
            regex: /ham/,
            action: { token: "ham" }
          }
        ]
      }
    }, configurationService));
    const lines = [
      "ham",
      // length 3, should be tokenized
      "hamham"
      // length 6, should NOT be tokenized
    ];
    const actualTokens = getTokens(tokenizer, lines);
    assert.deepStrictEqual(actualTokens, [
      [
        new Token(0, "ham.test", "test")
      ],
      [
        new Token(0, "", "test")
      ]
    ]);
    disposables.dispose();
  });
  test("microsoft/monaco-editor#3128: allow state access within rules", () => {
    const disposables = new DisposableStore();
    const configurationService = new StandaloneConfigurationService(new NullLogService());
    const languageService = disposables.add(new LanguageService());
    const tokenizer = disposables.add(createMonarchTokenizer(languageService, "test", {
      ignoreCase: false,
      encoding: /u|u8|U|L/,
      tokenizer: {
        root: [
          // C++ 11 Raw String
          [/@encoding?R\"(?:([^ ()\\\t]*))\(/, { token: "string.raw.begin", next: "@raw.$1" }]
        ],
        raw: [
          [/.*\)$S2\"/, "string.raw", "@pop"],
          [/.*/, "string.raw"]
        ]
      }
    }, configurationService));
    const lines = [
      `int main(){`,
      ``,
      `	auto s = R""""(`,
      `	Hello World`,
      `	)"""";`,
      ``,
      `	std::cout << "hello";`,
      ``,
      `}`
    ];
    const actualTokens = getTokens(tokenizer, lines);
    assert.deepStrictEqual(actualTokens, [
      [new Token(0, "source.test", "test")],
      [],
      [new Token(0, "source.test", "test"), new Token(10, "string.raw.begin.test", "test")],
      [new Token(0, "string.raw.test", "test")],
      [new Token(0, "string.raw.test", "test"), new Token(6, "source.test", "test")],
      [],
      [new Token(0, "source.test", "test")],
      [],
      [new Token(0, "source.test", "test")]
    ]);
    disposables.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3Ivc3RhbmRhbG9uZS90ZXN0L2Jyb3dzZXIvbW9uYXJjaC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgVG9rZW4sIFRva2VuaXphdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFN0YW5kYWxvbmVDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc3RhbmRhbG9uZVNlcnZpY2VzLmpzJztcbmltcG9ydCB7IGNvbXBpbGUgfSBmcm9tICcuLi8uLi9jb21tb24vbW9uYXJjaC9tb25hcmNoQ29tcGlsZS5qcyc7XG5pbXBvcnQgeyBNb25hcmNoVG9rZW5pemVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL21vbmFyY2gvbW9uYXJjaExleGVyLmpzJztcbmltcG9ydCB7IElNb25hcmNoTGFuZ3VhZ2UgfSBmcm9tICcuLi8uLi9jb21tb24vbW9uYXJjaC9tb25hcmNoVHlwZXMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcblxuc3VpdGUoJ01vbmFyY2gnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gY3JlYXRlTW9uYXJjaFRva2VuaXplcihsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsIGxhbmd1YWdlSWQ6IHN0cmluZywgbGFuZ3VhZ2U6IElNb25hcmNoTGFuZ3VhZ2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UpOiBNb25hcmNoVG9rZW5pemVyIHtcblx0XHRyZXR1cm4gbmV3IE1vbmFyY2hUb2tlbml6ZXIobGFuZ3VhZ2VTZXJ2aWNlLCBudWxsISwgbGFuZ3VhZ2VJZCwgY29tcGlsZShsYW5ndWFnZUlkLCBsYW5ndWFnZSksIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFRva2Vucyh0b2tlbml6ZXI6IE1vbmFyY2hUb2tlbml6ZXIsIGxpbmVzOiBzdHJpbmdbXSk6IFRva2VuW11bXSB7XG5cdFx0Y29uc3QgYWN0dWFsVG9rZW5zOiBUb2tlbltdW10gPSBbXTtcblx0XHRsZXQgc3RhdGUgPSB0b2tlbml6ZXIuZ2V0SW5pdGlhbFN0YXRlKCk7XG5cdFx0Zm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSB0b2tlbml6ZXIudG9rZW5pemUobGluZSwgdHJ1ZSwgc3RhdGUpO1xuXHRcdFx0YWN0dWFsVG9rZW5zLnB1c2gocmVzdWx0LnRva2Vucyk7XG5cdFx0XHRzdGF0ZSA9IHJlc3VsdC5lbmRTdGF0ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGFjdHVhbFRva2Vucztcblx0fVxuXG5cdHRlc3QoJ0Vuc3VyZSBAcmVtYXRjaCBhbmQgbmV4dEVtYmVkZGVkIGNhbiBiZSB1c2VkIHRvZ2V0aGVyIGluIE1vbmFyY2ggZ3JhbW1hcicsICgpID0+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IExhbmd1YWdlU2VydmljZSgpKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBTdGFuZGFsb25lQ29uZmlndXJhdGlvblNlcnZpY2UobmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiAnc3FsJyB9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKFRva2VuaXphdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKCdzcWwnLCBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlTW9uYXJjaFRva2VuaXplcihsYW5ndWFnZVNlcnZpY2UsICdzcWwnLCB7XG5cdFx0XHR0b2tlbml6ZXI6IHtcblx0XHRcdFx0cm9vdDogW1xuXHRcdFx0XHRcdFsvLi8sICd0b2tlbiddXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9LCBjb25maWd1cmF0aW9uU2VydmljZSkpKSk7XG5cdFx0Y29uc3QgU1FMX1FVRVJZX1NUQVJUID0gJyhTRUxFQ1R8SU5TRVJUfFVQREFURXxERUxFVEV8Q1JFQVRFfFJFUExBQ0V8QUxURVJ8V0lUSCknO1xuXHRcdGNvbnN0IHRva2VuaXplciA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVNb25hcmNoVG9rZW5pemVyKGxhbmd1YWdlU2VydmljZSwgJ3Rlc3QxJywge1xuXHRcdFx0dG9rZW5pemVyOiB7XG5cdFx0XHRcdHJvb3Q6IFtcblx0XHRcdFx0XHRbYChcXFwiXFxcIlxcXCIpJHtTUUxfUVVFUllfU1RBUlR9YCwgW3sgJ3Rva2VuJzogJ3N0cmluZy5xdW90ZScsIH0sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAZW5kU3RyaW5nV2l0aFNRTCcsIG5leHRFbWJlZGRlZDogJ3NxbCcsIH0sXV0sXG5cdFx0XHRcdFx0Wy8oXCJcIlwiKSQvLCBbeyB0b2tlbjogJ3N0cmluZy5xdW90ZScsIG5leHQ6ICdAbWF5YmVTdHJpbmdJc1NRTCcsIH0sXV0sXG5cdFx0XHRcdF0sXG5cdFx0XHRcdG1heWJlU3RyaW5nSXNTUUw6IFtcblx0XHRcdFx0XHRbLyguKikvLCB7XG5cdFx0XHRcdFx0XHRjYXNlczoge1xuXHRcdFx0XHRcdFx0XHRbYCR7U1FMX1FVRVJZX1NUQVJUfVxcXFxiLipgXTogeyB0b2tlbjogJ0ByZW1hdGNoJywgbmV4dDogJ0BlbmRTdHJpbmdXaXRoU1FMJywgbmV4dEVtYmVkZGVkOiAnc3FsJywgfSxcblx0XHRcdFx0XHRcdFx0J0BkZWZhdWx0JzogeyB0b2tlbjogJ0ByZW1hdGNoJywgc3dpdGNoVG86ICdAZW5kRGJsRG9jU3RyaW5nJywgfSxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XSxcblx0XHRcdFx0XSxcblx0XHRcdFx0ZW5kRGJsRG9jU3RyaW5nOiBbXG5cdFx0XHRcdFx0WydbXlxcJ10rJywgJ3N0cmluZyddLFxuXHRcdFx0XHRcdFsnXFxcXFxcXFxcXCcnLCAnc3RyaW5nJ10sXG5cdFx0XHRcdFx0WydcXCdcXCdcXCcnLCAnc3RyaW5nJywgJ0Bwb3BhbGwnXSxcblx0XHRcdFx0XHRbJ1xcJycsICdzdHJpbmcnXVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRlbmRTdHJpbmdXaXRoU1FMOiBbWy9cIlwiXCIvLCB7IHRva2VuOiAnc3RyaW5nLnF1b3RlJywgbmV4dDogJ0Bwb3BhbGwnLCBuZXh0RW1iZWRkZWQ6ICdAcG9wJywgfSxdXSxcblx0XHRcdH1cblx0XHR9LCBjb25maWd1cmF0aW9uU2VydmljZSkpO1xuXG5cdFx0Y29uc3QgbGluZXMgPSBbXG5cdFx0XHRgbXlzcWxfcXVlcnkoXCJcIlwiU0VMRUNUICogRlJPTSB0YWJsZV9uYW1lIFdIRVJFIGRzID0gJzxEQVRFSUQ+J1wiXCJcIilgLFxuXHRcdFx0YG15c3FsX3F1ZXJ5KFwiXCJcImAsXG5cdFx0XHRgU0VMRUNUICpgLFxuXHRcdFx0YEZST00gdGFibGVfbmFtZWAsXG5cdFx0XHRgV0hFUkUgZHMgPSAnPERBVEVJRD4nYCxcblx0XHRcdGBcIlwiXCIpYCxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsVG9rZW5zID0gZ2V0VG9rZW5zKHRva2VuaXplciwgbGluZXMpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxUb2tlbnMsIFtcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRva2VuKDAsICdzb3VyY2UudGVzdDEnLCAndGVzdDEnKSxcblx0XHRcdFx0bmV3IFRva2VuKDEyLCAnc3RyaW5nLnF1b3RlLnRlc3QxJywgJ3Rlc3QxJyksXG5cdFx0XHRcdG5ldyBUb2tlbigxNSwgJ3Rva2VuLnNxbCcsICdzcWwnKSxcblx0XHRcdFx0bmV3IFRva2VuKDYxLCAnc3RyaW5nLnF1b3RlLnRlc3QxJywgJ3Rlc3QxJyksXG5cdFx0XHRcdG5ldyBUb2tlbig2NCwgJ3NvdXJjZS50ZXN0MScsICd0ZXN0MScpXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVG9rZW4oMCwgJ3NvdXJjZS50ZXN0MScsICd0ZXN0MScpLFxuXHRcdFx0XHRuZXcgVG9rZW4oMTIsICdzdHJpbmcucXVvdGUudGVzdDEnLCAndGVzdDEnKVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRva2VuKDAsICd0b2tlbi5zcWwnLCAnc3FsJylcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUb2tlbigwLCAndG9rZW4uc3FsJywgJ3NxbCcpXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVG9rZW4oMCwgJ3Rva2VuLnNxbCcsICdzcWwnKVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRva2VuKDAsICdzdHJpbmcucXVvdGUudGVzdDEnLCAndGVzdDEnKSxcblx0XHRcdFx0bmV3IFRva2VuKDMsICdzb3VyY2UudGVzdDEnLCAndGVzdDEnKVxuXHRcdFx0XVxuXHRcdF0pO1xuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnbWljcm9zb2Z0L21vbmFjby1lZGl0b3IjMTIzNTogRW1wdHkgTGluZSBIYW5kbGluZycsICgpID0+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBTdGFuZGFsb25lQ29uZmlndXJhdGlvblNlcnZpY2UobmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgTGFuZ3VhZ2VTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IHRva2VuaXplciA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVNb25hcmNoVG9rZW5pemVyKGxhbmd1YWdlU2VydmljZSwgJ3Rlc3QnLCB7XG5cdFx0XHR0b2tlbml6ZXI6IHtcblx0XHRcdFx0cm9vdDogW1xuXHRcdFx0XHRcdHsgaW5jbHVkZTogJ0Bjb21tZW50cycgfSxcblx0XHRcdFx0XSxcblxuXHRcdFx0XHRjb21tZW50czogW1xuXHRcdFx0XHRcdFsvXFwvXFwvJC8sICdjb21tZW50J10sIC8vIGVtcHR5IHNpbmdsZS1saW5lIGNvbW1lbnRcblx0XHRcdFx0XHRbL1xcL1xcLy8sICdjb21tZW50JywgJ0Bjb21tZW50X2NwcCddLFxuXHRcdFx0XHRdLFxuXG5cdFx0XHRcdGNvbW1lbnRfY3BwOiBbXG5cdFx0XHRcdFx0Wy8oPzpbXlxcXFxdfCg/OlxcXFwuKSkrJC8sICdjb21tZW50JywgJ0Bwb3AnXSxcblx0XHRcdFx0XHRbLy4rJC8sICdjb21tZW50J10sXG5cdFx0XHRcdFx0Wy8kLywgJ2NvbW1lbnQnLCAnQHBvcCddXG5cdFx0XHRcdFx0Ly8gTm8gcG9zc2libGUgcnVsZSB0byBkZXRlY3QgYW4gZW1wdHkgbGluZSBhbmQgQHBvcD9cblx0XHRcdFx0XSxcblx0XHRcdH0sXG5cdFx0fSwgY29uZmlndXJhdGlvblNlcnZpY2UpKTtcblxuXHRcdGNvbnN0IGxpbmVzID0gW1xuXHRcdFx0YC8vIFRoaXMgY29tbWVudCBcXFxcYCxcblx0XHRcdGAgICBjb250aW51ZXMgb24gdGhlIGZvbGxvd2luZyBsaW5lYCxcblx0XHRcdGBgLFxuXHRcdFx0YC8vIFRoaXMgY29tbWVudCBkb2VzIE5PVCBjb250aW51ZSBcXFxcXFxcXGAsXG5cdFx0XHRgICAgYmVjYXVzZSB0aGUgZXNjYXBlIGNoYXIgd2FzIGl0c2VsZiBlc2NhcGVkYCxcblx0XHRcdGBgLFxuXHRcdFx0YC8vIFRoaXMgY29tbWVudCBET0VTIGNvbnRpbnVlIGJlY2F1c2UgXFxcXFxcXFxcXFxcYCxcblx0XHRcdGAgICB0aGUgMXN0ICdcXFxcJyBlc2NhcGVzIHRoZSAybmQ7IHRoZSAzcmQgZXNjYXBlcyBFT0xgLFxuXHRcdFx0YGAsXG5cdFx0XHRgLy8gVGhpcyBjb21tZW50IGNvbnRpbnVlcyB0byB0aGUgZm9sbG93aW5nIGxpbmUgXFxcXGAsXG5cdFx0XHRgYCxcblx0XHRcdGBCdXQgdGhlIGxpbmUgd2FzIGVtcHR5LiBUaGlzIGxpbmUgc2hvdWxkIG5vdCBiZSBjb21tZW50ZWQuYCxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsVG9rZW5zID0gZ2V0VG9rZW5zKHRva2VuaXplciwgbGluZXMpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxUb2tlbnMsIFtcblx0XHRcdFtuZXcgVG9rZW4oMCwgJ2NvbW1lbnQudGVzdCcsICd0ZXN0JyldLFxuXHRcdFx0W25ldyBUb2tlbigwLCAnY29tbWVudC50ZXN0JywgJ3Rlc3QnKV0sXG5cdFx0XHRbXSxcblx0XHRcdFtuZXcgVG9rZW4oMCwgJ2NvbW1lbnQudGVzdCcsICd0ZXN0JyldLFxuXHRcdFx0W25ldyBUb2tlbigwLCAnc291cmNlLnRlc3QnLCAndGVzdCcpXSxcblx0XHRcdFtdLFxuXHRcdFx0W25ldyBUb2tlbigwLCAnY29tbWVudC50ZXN0JywgJ3Rlc3QnKV0sXG5cdFx0XHRbbmV3IFRva2VuKDAsICdjb21tZW50LnRlc3QnLCAndGVzdCcpXSxcblx0XHRcdFtdLFxuXHRcdFx0W25ldyBUb2tlbigwLCAnY29tbWVudC50ZXN0JywgJ3Rlc3QnKV0sXG5cdFx0XHRbXSxcblx0XHRcdFtuZXcgVG9rZW4oMCwgJ3NvdXJjZS50ZXN0JywgJ3Rlc3QnKV1cblx0XHRdKTtcblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnbWljcm9zb2Z0L21vbmFjby1lZGl0b3IjMjI2NTogRXhpdCBhIHN0YXRlIGF0IGVuZCBvZiBsaW5lJywgKCkgPT4ge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFN0YW5kYWxvbmVDb25maWd1cmF0aW9uU2VydmljZShuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBMYW5ndWFnZVNlcnZpY2UoKSk7XG5cdFx0Y29uc3QgdG9rZW5pemVyID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZU1vbmFyY2hUb2tlbml6ZXIobGFuZ3VhZ2VTZXJ2aWNlLCAndGVzdCcsIHtcblx0XHRcdGluY2x1ZGVMRjogdHJ1ZSxcblx0XHRcdHRva2VuaXplcjoge1xuXHRcdFx0XHRyb290OiBbXG5cdFx0XHRcdFx0Wy9eXFwqLywgJycsICdAaW5uZXInXSxcblx0XHRcdFx0XHRbL1xcOlxcKi8sICcnLCAnQGlubmVyJ10sXG5cdFx0XHRcdFx0Wy9bXio6XSsvLCAnc3RyaW5nJ10sXG5cdFx0XHRcdFx0Wy9bKjpdLywgJ3N0cmluZyddXG5cdFx0XHRcdF0sXG5cdFx0XHRcdGlubmVyOiBbXG5cdFx0XHRcdFx0Wy9cXG4vLCAnJywgJ0Bwb3AnXSxcblx0XHRcdFx0XHRbL1xcZCsvLCAnbnVtYmVyJ10sXG5cdFx0XHRcdFx0Wy9bXlxcZF0rLywgJyddXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9LCBjb25maWd1cmF0aW9uU2VydmljZSkpO1xuXG5cdFx0Y29uc3QgbGluZXMgPSBbXG5cdFx0XHRgUFJJTlQgMTAgKiAyMGAsXG5cdFx0XHRgKkZYMjAwLCAzYCxcblx0XHRcdGBQUklOVCAyKjM6KkZYMjAwLCAzYFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWxUb2tlbnMgPSBnZXRUb2tlbnModG9rZW5pemVyLCBsaW5lcyk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbFRva2VucywgW1xuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVG9rZW4oMCwgJ3N0cmluZy50ZXN0JywgJ3Rlc3QnKSxcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUb2tlbigwLCAnJywgJ3Rlc3QnKSxcblx0XHRcdFx0bmV3IFRva2VuKDMsICdudW1iZXIudGVzdCcsICd0ZXN0JyksXG5cdFx0XHRcdG5ldyBUb2tlbig2LCAnJywgJ3Rlc3QnKSxcblx0XHRcdFx0bmV3IFRva2VuKDgsICdudW1iZXIudGVzdCcsICd0ZXN0JyksXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVG9rZW4oMCwgJ3N0cmluZy50ZXN0JywgJ3Rlc3QnKSxcblx0XHRcdFx0bmV3IFRva2VuKDksICcnLCAndGVzdCcpLFxuXHRcdFx0XHRuZXcgVG9rZW4oMTMsICdudW1iZXIudGVzdCcsICd0ZXN0JyksXG5cdFx0XHRcdG5ldyBUb2tlbigxNiwgJycsICd0ZXN0JyksXG5cdFx0XHRcdG5ldyBUb2tlbigxOCwgJ251bWJlci50ZXN0JywgJ3Rlc3QnKSxcblx0XHRcdF1cblx0XHRdKTtcblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzExNTY2MjogbW9uYXJjaENvbXBpbGUgZnVuY3Rpb24gbmVlZCBhbiBleHRyYSBvcHRpb24gd2hpY2ggY2FuIGNvbnRyb2wgcmVwbGFjZW1lbnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBuZXcgU3RhbmRhbG9uZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IExhbmd1YWdlU2VydmljZSgpKTtcblxuXHRcdGNvbnN0IHRva2VuaXplcjEgPSBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlTW9uYXJjaFRva2VuaXplcihsYW5ndWFnZVNlcnZpY2UsICd0ZXN0Jywge1xuXHRcdFx0aWdub3JlQ2FzZTogZmFsc2UsXG5cdFx0XHR1c2VsZXNzUmVwbGFjZUtleTE6ICdAdXNlbGVzc1JlcGxhY2VLZXkyJyxcblx0XHRcdHVzZWxlc3NSZXBsYWNlS2V5MjogJ0B1c2VsZXNzUmVwbGFjZUtleTMnLFxuXHRcdFx0dXNlbGVzc1JlcGxhY2VLZXkzOiAnQHVzZWxlc3NSZXBsYWNlS2V5NCcsXG5cdFx0XHR1c2VsZXNzUmVwbGFjZUtleTQ6ICdAdXNlbGVzc1JlcGxhY2VLZXk1Jyxcblx0XHRcdHVzZWxlc3NSZXBsYWNlS2V5NTogJ0BoYW0nLFxuXHRcdFx0dG9rZW5pemVyOiB7XG5cdFx0XHRcdHJvb3Q6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRyZWdleDogL0BcXHcrLy50ZXN0KCdAaGFtJylcblx0XHRcdFx0XHRcdFx0PyBuZXcgUmVnRXhwKGBeJHsnQHVzZWxlc3NSZXBsYWNlS2V5MSd9JGApXG5cdFx0XHRcdFx0XHRcdDogbmV3IFJlZ0V4cChgXiR7J0BoYW0nfSRgKSxcblx0XHRcdFx0XHRcdGFjdGlvbjogeyB0b2tlbjogJ2hhbScgfVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9LFxuXHRcdH0sIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cblx0XHRjb25zdCB0b2tlbml6ZXIyID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZU1vbmFyY2hUb2tlbml6ZXIobGFuZ3VhZ2VTZXJ2aWNlLCAndGVzdCcsIHtcblx0XHRcdGlnbm9yZUNhc2U6IGZhbHNlLFxuXHRcdFx0dG9rZW5pemVyOiB7XG5cdFx0XHRcdHJvb3Q6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRyZWdleDogL0BAaGFtLyxcblx0XHRcdFx0XHRcdGFjdGlvbjogeyB0b2tlbjogJ2hhbScgfVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9LFxuXHRcdH0sIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cblx0XHRjb25zdCBsaW5lcyA9IFtcblx0XHRcdGBAaGFtYFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWxUb2tlbnMxID0gZ2V0VG9rZW5zKHRva2VuaXplcjEsIGxpbmVzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbFRva2VuczEsIFtcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRva2VuKDAsICdoYW0udGVzdCcsICd0ZXN0JyksXG5cdFx0XHRdXG5cdFx0XSk7XG5cblx0XHRjb25zdCBhY3R1YWxUb2tlbnMyID0gZ2V0VG9rZW5zKHRva2VuaXplcjIsIGxpbmVzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbFRva2VuczIsIFtcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRva2VuKDAsICdoYW0udGVzdCcsICd0ZXN0JyksXG5cdFx0XHRdXG5cdFx0XSk7XG5cblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21pY3Jvc29mdC9tb25hY28tZWRpdG9yIzI0MjQ6IEFsbG93IHRvIHRhcmdldCBAQCcsICgpID0+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBTdGFuZGFsb25lQ29uZmlndXJhdGlvblNlcnZpY2UobmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgTGFuZ3VhZ2VTZXJ2aWNlKCkpO1xuXG5cdFx0Y29uc3QgdG9rZW5pemVyID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZU1vbmFyY2hUb2tlbml6ZXIobGFuZ3VhZ2VTZXJ2aWNlLCAndGVzdCcsIHtcblx0XHRcdGlnbm9yZUNhc2U6IGZhbHNlLFxuXHRcdFx0dG9rZW5pemVyOiB7XG5cdFx0XHRcdHJvb3Q6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRyZWdleDogL0BAQEAvLFxuXHRcdFx0XHRcdFx0YWN0aW9uOiB7IHRva2VuOiAnaGFtJyB9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH0sXG5cdFx0fSwgY29uZmlndXJhdGlvblNlcnZpY2UpKTtcblxuXHRcdGNvbnN0IGxpbmVzID0gW1xuXHRcdFx0YEBAYFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWxUb2tlbnMgPSBnZXRUb2tlbnModG9rZW5pemVyLCBsaW5lcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxUb2tlbnMsIFtcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRva2VuKDAsICdoYW0udGVzdCcsICd0ZXN0JyksXG5cdFx0XHRdXG5cdFx0XSk7XG5cblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21pY3Jvc29mdC9tb25hY28tZWRpdG9yIzMwMjU6IENoZWNrIG1heFRva2VuaXphdGlvbkxpbmVMZW5ndGggYmVmb3JlIHRva2VuaXppbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBTdGFuZGFsb25lQ29uZmlndXJhdGlvblNlcnZpY2UobmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgTGFuZ3VhZ2VTZXJ2aWNlKCkpO1xuXG5cdFx0Ly8gU2V0IG1heFRva2VuaXphdGlvbkxpbmVMZW5ndGggdG8gNCBzbyB0aGF0IFwiaGFtXCIgd29ya3MgYnV0IFwiaGFtaGFtXCIgd291bGQgZmFpbFxuXHRcdGF3YWl0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKCdlZGl0b3IubWF4VG9rZW5pemF0aW9uTGluZUxlbmd0aCcsIDQpO1xuXG5cdFx0Y29uc3QgdG9rZW5pemVyID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZU1vbmFyY2hUb2tlbml6ZXIobGFuZ3VhZ2VTZXJ2aWNlLCAndGVzdCcsIHtcblx0XHRcdHRva2VuaXplcjoge1xuXHRcdFx0XHRyb290OiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0cmVnZXg6IC9oYW0vLFxuXHRcdFx0XHRcdFx0YWN0aW9uOiB7IHRva2VuOiAnaGFtJyB9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH0sXG5cdFx0fSwgY29uZmlndXJhdGlvblNlcnZpY2UpKTtcblxuXHRcdGNvbnN0IGxpbmVzID0gW1xuXHRcdFx0J2hhbScsIC8vIGxlbmd0aCAzLCBzaG91bGQgYmUgdG9rZW5pemVkXG5cdFx0XHQnaGFtaGFtJyAvLyBsZW5ndGggNiwgc2hvdWxkIE5PVCBiZSB0b2tlbml6ZWRcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsVG9rZW5zID0gZ2V0VG9rZW5zKHRva2VuaXplciwgbGluZXMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsVG9rZW5zLCBbXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUb2tlbigwLCAnaGFtLnRlc3QnLCAndGVzdCcpLFxuXHRcdFx0XSwgW1xuXHRcdFx0XHRuZXcgVG9rZW4oMCwgJycsICd0ZXN0Jylcblx0XHRcdF1cblx0XHRdKTtcblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnbWljcm9zb2Z0L21vbmFjby1lZGl0b3IjMzEyODogYWxsb3cgc3RhdGUgYWNjZXNzIHdpdGhpbiBydWxlcycsICgpID0+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBTdGFuZGFsb25lQ29uZmlndXJhdGlvblNlcnZpY2UobmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgTGFuZ3VhZ2VTZXJ2aWNlKCkpO1xuXG5cdFx0Y29uc3QgdG9rZW5pemVyID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZU1vbmFyY2hUb2tlbml6ZXIobGFuZ3VhZ2VTZXJ2aWNlLCAndGVzdCcsIHtcblx0XHRcdGlnbm9yZUNhc2U6IGZhbHNlLFxuXHRcdFx0ZW5jb2Rpbmc6IC91fHU4fFV8TC8sXG5cdFx0XHR0b2tlbml6ZXI6IHtcblx0XHRcdFx0cm9vdDogW1xuXHRcdFx0XHRcdC8vIEMrKyAxMSBSYXcgU3RyaW5nXG5cdFx0XHRcdFx0Wy9AZW5jb2Rpbmc/UlxcXCIoPzooW14gKClcXFxcXFx0XSopKVxcKC8sIHsgdG9rZW46ICdzdHJpbmcucmF3LmJlZ2luJywgbmV4dDogJ0ByYXcuJDEnIH1dLFxuXHRcdFx0XHRdLFxuXG5cdFx0XHRcdHJhdzogW1xuXHRcdFx0XHRcdFsvLipcXCkkUzJcXFwiLywgJ3N0cmluZy5yYXcnLCAnQHBvcCddLFxuXHRcdFx0XHRcdFsvLiovLCAnc3RyaW5nLnJhdyddXG5cdFx0XHRcdF0sXG5cdFx0XHR9LFxuXHRcdH0sIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cblx0XHRjb25zdCBsaW5lcyA9IFtcblx0XHRcdGBpbnQgbWFpbigpe2AsXG5cdFx0XHRgYCxcblx0XHRcdGBcdGF1dG8gcyA9IFJcIlwiXCJcIihgLFxuXHRcdFx0YFx0SGVsbG8gV29ybGRgLFxuXHRcdFx0YFx0KVwiXCJcIlwiO2AsXG5cdFx0XHRgYCxcblx0XHRcdGBcdHN0ZDo6Y291dCA8PCBcImhlbGxvXCI7YCxcblx0XHRcdGBgLFxuXHRcdFx0YH1gLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWxUb2tlbnMgPSBnZXRUb2tlbnModG9rZW5pemVyLCBsaW5lcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxUb2tlbnMsIFtcblx0XHRcdFtuZXcgVG9rZW4oMCwgJ3NvdXJjZS50ZXN0JywgJ3Rlc3QnKV0sXG5cdFx0XHRbXSxcblx0XHRcdFtuZXcgVG9rZW4oMCwgJ3NvdXJjZS50ZXN0JywgJ3Rlc3QnKSwgbmV3IFRva2VuKDEwLCAnc3RyaW5nLnJhdy5iZWdpbi50ZXN0JywgJ3Rlc3QnKV0sXG5cdFx0XHRbbmV3IFRva2VuKDAsICdzdHJpbmcucmF3LnRlc3QnLCAndGVzdCcpXSxcblx0XHRcdFtuZXcgVG9rZW4oMCwgJ3N0cmluZy5yYXcudGVzdCcsICd0ZXN0JyksIG5ldyBUb2tlbig2LCAnc291cmNlLnRlc3QnLCAndGVzdCcpXSxcblx0XHRcdFtdLFxuXHRcdFx0W25ldyBUb2tlbigwLCAnc291cmNlLnRlc3QnLCAndGVzdCcpXSxcblx0XHRcdFtdLFxuXHRcdFx0W25ldyBUb2tlbigwLCAnc291cmNlLnRlc3QnLCAndGVzdCcpXSxcblx0XHRdKTtcblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsT0FBTyw0QkFBNEI7QUFFNUMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsd0JBQXdCO0FBR2pDLFNBQVMsc0JBQXNCO0FBRS9CLE1BQU0sV0FBVyxNQUFNO0FBRXRCLDBDQUF3QztBQUV4QyxXQUFTLHVCQUF1QixpQkFBbUMsWUFBb0IsVUFBNEIsc0JBQStEO0FBQ2pMLFdBQU8sSUFBSSxpQkFBaUIsaUJBQWlCLE1BQU8sWUFBWSxRQUFRLFlBQVksUUFBUSxHQUFHLG9CQUFvQjtBQUFBLEVBQ3BIO0FBRUEsV0FBUyxVQUFVLFdBQTZCLE9BQTRCO0FBQzNFLFVBQU0sZUFBMEIsQ0FBQztBQUNqQyxRQUFJLFFBQVEsVUFBVSxnQkFBZ0I7QUFDdEMsZUFBVyxRQUFRLE9BQU87QUFDekIsWUFBTSxTQUFTLFVBQVUsU0FBUyxNQUFNLE1BQU0sS0FBSztBQUNuRCxtQkFBYSxLQUFLLE9BQU8sTUFBTTtBQUMvQixjQUFRLE9BQU87QUFBQSxJQUNoQjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBRUEsT0FBSyw0RUFBNEUsTUFBTTtBQUN0RixVQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFDeEMsVUFBTSxrQkFBa0IsWUFBWSxJQUFJLElBQUksZ0JBQWdCLENBQUM7QUFDN0QsVUFBTSx1QkFBdUIsSUFBSSwrQkFBK0IsSUFBSSxlQUFlLENBQUM7QUFDcEYsZ0JBQVksSUFBSSxnQkFBZ0IsaUJBQWlCLEVBQUUsSUFBSSxNQUFNLENBQUMsQ0FBQztBQUMv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
