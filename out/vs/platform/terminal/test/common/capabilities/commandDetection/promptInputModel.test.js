import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { NullLogService } from "../../../../../log/common/log.js";
import { PromptInputModel } from "../../../../common/capabilities/commandDetection/promptInputModel.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { ok, notDeepStrictEqual, strictEqual } from "assert";
import { timeout } from "../../../../../../base/common/async.js";
import { importAMDNodeModule } from "../../../../../../amdX.js";
import { GeneralShellType, PosixShellType } from "../../../../common/terminal.js";
suite("PromptInputModel", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let promptInputModel;
  let xterm;
  let onCommandStart;
  let onCommandStartChanged;
  let onCommandExecuted;
  async function writePromise(data) {
    await new Promise((r) => xterm.write(data, r));
  }
  function fireCommandStart() {
    onCommandStart.fire({ marker: xterm.registerMarker() });
  }
  function fireCommandExecuted() {
    onCommandExecuted.fire(null);
  }
  function setContinuationPrompt(prompt) {
    promptInputModel.setContinuationPrompt(prompt);
  }
  async function assertPromptInput(valueWithCursor) {
    await timeout(0);
    if (promptInputModel.cursorIndex !== -1 && !valueWithCursor.includes("|")) {
      throw new Error("assertPromptInput must contain | character");
    }
    const actualValueWithCursor = promptInputModel.getCombinedString();
    strictEqual(
      actualValueWithCursor,
      valueWithCursor.replaceAll("\n", "\u23CE")
    );
    const value = valueWithCursor.replace(/[\|\[\]]/g, "");
    const cursorIndex = valueWithCursor.indexOf("|");
    strictEqual(promptInputModel.value, value);
    strictEqual(promptInputModel.cursorIndex, cursorIndex, `value=${promptInputModel.value}`);
    ok(promptInputModel.ghostTextIndex === -1 || cursorIndex <= promptInputModel.ghostTextIndex, `cursorIndex (${cursorIndex}) must be before ghostTextIndex (${promptInputModel.ghostTextIndex})`);
  }
  setup(async () => {
    const TerminalCtor = (await importAMDNodeModule("@xterm/xterm", "lib/xterm.js")).Terminal;
    xterm = store.add(new TerminalCtor({ allowProposedApi: true }));
    onCommandStart = store.add(new Emitter());
    onCommandStartChanged = store.add(new Emitter());
    onCommandExecuted = store.add(new Emitter());
    promptInputModel = store.add(new PromptInputModel(xterm, onCommandStart.event, onCommandStartChanged.event, onCommandExecuted.event, new NullLogService()));
  });
  test("basic input and execute", async () => {
    await writePromise("$ ");
    fireCommandStart();
    await assertPromptInput("|");
    await writePromise("foo bar");
    await assertPromptInput("foo bar|");
    await writePromise("\r\n");
    fireCommandExecuted();
    await assertPromptInput("foo bar");
    await writePromise("(command output)\r\n$ ");
    fireCommandStart();
    await assertPromptInput("|");
  });
  test("should not fire onDidChangeInput events when nothing changes", async () => {
    const events = [];
    store.add(promptInputModel.onDidChangeInput((e) => events.push(e)));
    await writePromise("$ ");
    fireCommandStart();
    await assertPromptInput("|");
    await writePromise("foo");
    await assertPromptInput("foo|");
    await writePromise(" bar");
    await assertPromptInput("foo bar|");
    await writePromise("\r\n");
    fireCommandExecuted();
    await assertPromptInput("foo bar");
    await writePromise("$ ");
    fireCommandStart();
    await assertPromptInput("|");
    await writePromise("foo bar");
    await assertPromptInput("foo bar|");
    for (let i = 0; i < events.length - 1; i++) {
      notDeepStrictEqual(events[i], events[i + 1], "not adjacent events should fire with the same value");
    }
  });
  test("should fire onDidInterrupt followed by onDidFinish when ctrl+c is pressed", async () => {
    await writePromise("$ ");
    fireCommandStart();
    await assertPromptInput("|");
    await writePromise("foo");
    await assertPromptInput("foo|");
    await new Promise((r) => {
      store.add(promptInputModel.onDidInterrupt(() => {
        store.add(promptInputModel.onDidFinishInput(() => {
          r();
        }));
      }));
      xterm.input("");
      writePromise("^C").then(() => fireCommandExecuted());
    });
  });
  test("cursor navigation", async () => {
    await writePromise("$ ");
    fireCommandStart();
    await assertPromptInput("|");
    await writePromise("foo bar");
    await assertPromptInput("foo bar|");
    await writePromise("\x1B[3D");
    await assertPromptInput("foo |bar");
    await writePromise("\x1B[4D");
    await assertPromptInput("|foo bar");
    await writePromise("\x1B[3C");
    await assertPromptInput("foo| bar");
    await writePromise("\x1B[4C");
    await assertPromptInput("foo bar|");
    await writePromise("\x1B[D");
    await assertPromptInput("foo ba|r");
    await writePromise("\x1B[C");
    await assertPromptInput("foo bar|");
  });
  suite("ghost text", () => {
    test("basic ghost text", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise("foo\x1B[2m bar\x1B[0m\x1B[4D");
      await assertPromptInput("foo|[ bar]");
      await writePromise("\x1B[2D");
      await assertPromptInput("f|oo[ bar]");
    });
    test("trailing whitespace", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise("foo    ");
      await writePromise("\x1B[4D");
      await assertPromptInput("foo|    ");
    });
    test("basic ghost text one word", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise("pw\x1B[2md\x1B[1D");
      await assertPromptInput("pw|[d]");
    });
    test("ghost text with cursor navigation", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise("foo\x1B[2m bar\x1B[0m\x1B[4D");
      await assertPromptInput("foo|[ bar]");
      await writePromise("\x1B[2D");
      await assertPromptInput("f|oo[ bar]");
      await writePromise("\x1B[C");
      await assertPromptInput("fo|o[ bar]");
      await writePromise("\x1B[C");
      await assertPromptInput("foo|[ bar]");
    });
    test("ghost text with different foreground colors only", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise("foo\x1B[38;2;255;0;0m bar\x1B[0m\x1B[4D");
      await assertPromptInput("foo|[ bar]");
      await writePromise("\x1B[2D");
      await assertPromptInput("f|oo[ bar]");
    });
    test("no ghost text when foreground color matches earlier text", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(
        "\x1B[38;2;255;0;0mred1\x1B[0m \x1B[38;2;0;255;0mgreen\x1B[0m \x1B[38;2;255;0;0mred2\x1B[0m"
        // Red "red2" (same as red1)
      );
      await assertPromptInput("red1 green red2|");
    });
    test("ghost text detected when foreground color is unique at the end", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(
        "\x1B[38;2;255;0;0mcmd\x1B[0m \x1B[38;2;0;255;0marg\x1B[0m \x1B[38;2;0;0;255mfinal\x1B[5D"
        // Blue "final" (ghost text)
      );
      await assertPromptInput("cmd arg |[final]");
    });
    test("no ghost text when background color matches earlier text", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(
        "\x1B[48;2;255;0;0mred_bg1\x1B[0m \x1B[48;2;0;255;0mgreen_bg\x1B[0m \x1B[48;2;255;0;0mred_bg2\x1B[0m"
        // Red background again
      );
      await assertPromptInput("red_bg1 green_bg red_bg2|");
    });
    test("ghost text detected when background color is unique at the end", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(
        "\x1B[48;2;255;0;0mred_bg\x1B[0m \x1B[48;2;0;255;0mgreen_bg\x1B[0m \x1B[48;2;0;0;255mblue_bg\x1B[7D"
        // Blue background (ghost text)
      );
      await assertPromptInput("red_bg green_bg |[blue_bg]");
    });
    test("ghost text detected when bold style is unique at the end", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(
        "text \x1B[1mBOLD\x1B[4D"
        // Bold "BOLD" (ghost text)
      );
      await assertPromptInput("text |[BOLD]");
    });
    test("no ghost text when earlier text has the same bold style", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(
        "\x1B[1mBOLD1\x1B[0m normal \x1B[1mBOLD2\x1B[0m"
        // Bold "BOLD2" (same style as "BOLD1")
      );
      await assertPromptInput("BOLD1 normal BOLD2|");
    });
    test("ghost text detected when italic style is unique at the end", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(
        "text \x1B[3mITALIC\x1B[6D"
        // Italic "ITALIC" (ghost text)
      );
      await assertPromptInput("text |[ITALIC]");
    });
    test("no ghost text when earlier text has the same italic style", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(
        "\x1B[3mITALIC1\x1B[0m normal \x1B[3mITALIC2\x1B[0m"
        // Italic "ITALIC2" (same style as "ITALIC1")
      );
      await assertPromptInput("ITALIC1 normal ITALIC2|");
    });
    test("ghost text detected when underline style is unique at the end", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(
        "text \x1B[4mUNDERLINE\x1B[9D"
        // Underlined "UNDERLINE" (ghost text)
      );
      await assertPromptInput("text |[UNDERLINE]");
    });
    test("no ghost text when earlier text has the same underline style", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(
        "\x1B[4mUNDERLINE1\x1B[0m normal \x1B[4mUNDERLINE2\x1B[0m"
        // Underlined "UNDERLINE2" (same style as "UNDERLINE1")
      );
      await assertPromptInput("UNDERLINE1 normal UNDERLINE2|");
    });
    test("ghost text detected when strikethrough style is unique at the end", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(
        "text \x1B[9mSTRIKE\x1B[6D"
        // Strikethrough "STRIKE" (ghost text)
      );
      await assertPromptInput("text |[STRIKE]");
    });
    test("no ghost text when earlier text has the same strikethrough style", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(
        "\x1B[9mSTRIKE1\x1B[0m normal \x1B[9mSTRIKE2\x1B[0m"
        // Strikethrough "STRIKE2" (same style as "STRIKE1")
      );
      await assertPromptInput("STRIKE1 normal STRIKE2|");
    });
    suite("With wrapping", () => {
      test("Fish ghost text in long line with wrapped content", async () => {
        promptInputModel.setShellType(PosixShellType.Fish);
        await writePromise("$ ");
        fireCommandStart();
        await assertPromptInput("|");
        await writePromise("find . -name");
        await assertPromptInput(`find . -name|`);
        await writePromise("\x1B[2m test\x1B[0m\x1B[4D");
        await assertPromptInput(`find . -name |[test]`);
        await writePromise("\x1B[C");
        await assertPromptInput(`find . -name t|[est]`);
        await writePromise("\x1B[C\x1B[C\x1B[C\x1B[C\x1B[C");
        await assertPromptInput(`find . -name test|`);
      });
      test("Pwsh ghost text in long line with wrapped content", async () => {
        promptInputModel.setShellType(GeneralShellType.PowerShell);
        await writePromise("$ ");
        fireCommandStart();
        await assertPromptInput("|");
        await writePromise("find . -name");
        await assertPromptInput(`find . -name|`);
        await writePromise("\x1B[2m test\x1B[0m\x1B[4D");
        await assertPromptInput(`find . -name |[test]`);
        await writePromise("\x1B[C");
        await assertPromptInput(`find . -name t|[est]`);
        await writePromise("\x1B[C\x1B[C\x1B[C\x1B[C\x1B[C");
        await assertPromptInput(`find . -name test|`);
      });
    });
  });
  test("wide input (Korean)", async () => {
    await writePromise("$ ");
    fireCommandStart();
    await assertPromptInput("|");
    await writePromise("\uC548\uC601");
    await assertPromptInput("\uC548\uC601|");
    await writePromise("\r\n\uCEF4\uD4E8\uD130");
    await assertPromptInput("\uC548\uC601\n\uCEF4\uD4E8\uD130|");
    await writePromise("\r\n\uC0AC\uB78C");
    await assertPromptInput("\uC548\uC601\n\uCEF4\uD4E8\uD130\n\uC0AC\uB78C|");
    await writePromise("\x1B[G");
    await assertPromptInput("\uC548\uC601\n\uCEF4\uD4E8\uD130\n|\uC0AC\uB78C");
    await writePromise("\x1B[A");
    await assertPromptInput("\uC548\uC601\n|\uCEF4\uD4E8\uD130\n\uC0AC\uB78C");
    await writePromise("\x1B[4C");
    await assertPromptInput("\uC548\uC601\n\uCEF4\uD4E8|\uD130\n\uC0AC\uB78C");
    await writePromise("\x1B[1;4H");
    await assertPromptInput("\uC548|\uC601\n\uCEF4\uD4E8\uD130\n\uC0AC\uB78C");
    await writePromise("\x1B[D");
    await assertPromptInput("|\uC548\uC601\n\uCEF4\uD4E8\uD130\n\uC0AC\uB78C");
  });
  test("emoji input", async () => {
    await writePromise("$ ");
    fireCommandStart();
    await assertPromptInput("|");
    await writePromise("\u270C\uFE0F\u{1F44D}");
    await assertPromptInput("\u270C\uFE0F\u{1F44D}|");
    await writePromise("\r\n\u{1F60E}\u{1F615}\u{1F605}");
    await assertPromptInput("\u270C\uFE0F\u{1F44D}\n\u{1F60E}\u{1F615}\u{1F605}|");
    await writePromise("\r\n\u{1F914}\u{1F937}\u{1F629}");
    await assertPromptInput("\u270C\uFE0F\u{1F44D}\n\u{1F60E}\u{1F615}\u{1F605}\n\u{1F914}\u{1F937}\u{1F629}|");
    await writePromise("\x1B[G");
    await assertPromptInput("\u270C\uFE0F\u{1F44D}\n\u{1F60E}\u{1F615}\u{1F605}\n|\u{1F914}\u{1F937}\u{1F629}");
    await writePromise("\x1B[A");
    await assertPromptInput("\u270C\uFE0F\u{1F44D}\n|\u{1F60E}\u{1F615}\u{1F605}\n\u{1F914}\u{1F937}\u{1F629}");
    await writePromise("\x1B[2C");
    await assertPromptInput("\u270C\uFE0F\u{1F44D}\n\u{1F60E}\u{1F615}|\u{1F605}\n\u{1F914}\u{1F937}\u{1F629}");
    await writePromise("\x1B[1;4H");
    await assertPromptInput("\u270C\uFE0F|\u{1F44D}\n\u{1F60E}\u{1F615}\u{1F605}\n\u{1F914}\u{1F937}\u{1F629}");
    await writePromise("\x1B[D");
    await assertPromptInput("|\u270C\uFE0F\u{1F44D}\n\u{1F60E}\u{1F615}\u{1F605}\n\u{1F914}\u{1F937}\u{1F629}");
  });
  suite("trailing whitespace", () => {
    test("delete whitespace with backspace", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(" ");
      await assertPromptInput(` |`);
      xterm.input("\x7F", true);
      await writePromise("\x1B[D");
      await assertPromptInput("|");
      xterm.input(" ".repeat(4), true);
      await writePromise(" ".repeat(4));
      await assertPromptInput(`    |`);
      xterm.input("\x1B[D".repeat(2), true);
      await writePromise("\x1B[2D");
      await assertPromptInput(`  |  `);
      xterm.input("\x7F", true);
      await writePromise("\x1B[D");
      await assertPromptInput(` |  `);
      xterm.input("\x7F", true);
      await writePromise("\x1B[D");
      await assertPromptInput(`|  `);
      xterm.input(" ", true);
      await writePromise(" ");
      await assertPromptInput(` |  `);
      xterm.input(" ", true);
      await writePromise(" ");
      await assertPromptInput(`  |  `);
      xterm.input("\x1B[C", true);
      await writePromise("\x1B[C");
      await assertPromptInput(`   | `);
      xterm.input("a", true);
      await writePromise("a");
      await assertPromptInput(`   a| `);
      xterm.input("\x7F", true);
      await writePromise("\x1B[D\x1B[K");
      await assertPromptInput(`   | `);
      xterm.input("\x1B[D".repeat(2), true);
      await writePromise("\x1B[2D");
      await assertPromptInput(` |   `);
      xterm.input("\x1B[3~", true);
      await writePromise("");
      await assertPromptInput(` |  `);
    });
    test.skip("track whitespace when ConPTY deletes whitespace unexpectedly", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      xterm.input("ls", true);
      await writePromise("ls");
      await assertPromptInput(`ls|`);
      xterm.input(" ".repeat(4), true);
      await writePromise(" ".repeat(4));
      await assertPromptInput(`ls    |`);
      xterm.input(" ", true);
      await writePromise("\x1B[4D\x1B[5X\x1B[5C");
      await assertPromptInput(`ls     |`);
    });
    test("track whitespace beyond cursor", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise(" ".repeat(8));
      await assertPromptInput(`${" ".repeat(8)}|`);
      await writePromise("\x1B[4D");
      await assertPromptInput(`${" ".repeat(4)}|${" ".repeat(4)}`);
    });
  });
  suite("multi-line", () => {
    test("basic 2 line", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise('echo "a');
      await assertPromptInput(`echo "a|`);
      await writePromise("\n\r\u2219 ");
      setContinuationPrompt("\u2219 ");
      await assertPromptInput(`echo "a
|`);
      await writePromise("b");
      await assertPromptInput(`echo "a
b|`);
    });
    test("basic 3 line", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise('echo "a');
      await assertPromptInput(`echo "a|`);
      await writePromise("\n\r\u2219 ");
      setContinuationPrompt("\u2219 ");
      await assertPromptInput(`echo "a
|`);
      await writePromise("b");
      await assertPromptInput(`echo "a
b|`);
      await writePromise("\n\r\u2219 ");
      setContinuationPrompt("\u2219 ");
      await assertPromptInput(`echo "a
b
|`);
      await writePromise("c");
      await assertPromptInput(`echo "a
b
c|`);
    });
    test("navigate left in multi-line", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise('echo "a');
      await assertPromptInput(`echo "a|`);
      await writePromise("\n\r\u2219 ");
      setContinuationPrompt("\u2219 ");
      await assertPromptInput(`echo "a
|`);
      await writePromise("b");
      await assertPromptInput(`echo "a
b|`);
      await writePromise("\x1B[D");
      await assertPromptInput(`echo "a
|b`);
      await writePromise("\x1B[@c");
      await assertPromptInput(`echo "a
c|b`);
      await writePromise("\x1B[K\n\r\u2219 ");
      await assertPromptInput(`echo "a
c
|`);
      await writePromise("b");
      await assertPromptInput(`echo "a
c
b|`);
      await writePromise(" foo");
      await assertPromptInput(`echo "a
c
b foo|`);
      await writePromise("\x1B[3D");
      await assertPromptInput(`echo "a
c
b |foo`);
    });
    test("navigate up in multi-line", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise('echo "foo');
      await assertPromptInput(`echo "foo|`);
      await writePromise("\n\r\u2219 ");
      setContinuationPrompt("\u2219 ");
      await assertPromptInput(`echo "foo
|`);
      await writePromise("bar");
      await assertPromptInput(`echo "foo
bar|`);
      await writePromise("\n\r\u2219 ");
      setContinuationPrompt("\u2219 ");
      await assertPromptInput(`echo "foo
bar
|`);
      await writePromise("baz");
      await assertPromptInput(`echo "foo
bar
baz|`);
      await writePromise("\x1B[A");
      await assertPromptInput(`echo "foo
bar|
baz`);
      await writePromise("\x1B[D");
      await assertPromptInput(`echo "foo
ba|r
baz`);
      await writePromise("\x1B[D");
      await assertPromptInput(`echo "foo
b|ar
baz`);
      await writePromise("\x1B[D");
      await assertPromptInput(`echo "foo
|bar
baz`);
      await writePromise("\x1B[1;9H");
      await assertPromptInput(`echo "|foo
bar
baz`);
      await writePromise("\x1B[C");
      await assertPromptInput(`echo "f|oo
bar
baz`);
      await writePromise("\x1B[C");
      await assertPromptInput(`echo "fo|o
bar
baz`);
      await writePromise("\x1B[C");
      await assertPromptInput(`echo "foo|
bar
baz`);
    });
    test("navigating up when first line contains invalid/stale trailing whitespace", async () => {
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise('echo "foo      \x1B[6D');
      await assertPromptInput(`echo "foo|`);
      await writePromise("\n\r\u2219 ");
      setContinuationPrompt("\u2219 ");
      await assertPromptInput(`echo "foo
|`);
      await writePromise("bar");
      await assertPromptInput(`echo "foo
bar|`);
      await writePromise("\x1B[D");
      await assertPromptInput(`echo "foo
ba|r`);
      await writePromise("\x1B[D");
      await assertPromptInput(`echo "foo
b|ar`);
      await writePromise("\x1B[D");
      await assertPromptInput(`echo "foo
|bar`);
    });
  });
  suite("multi-line wrapped (no continuation prompt)", () => {
    test("basic wrapped line", async () => {
      xterm.resize(5, 10);
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise("ech");
      await assertPromptInput(`ech|`);
      await writePromise("o ");
      await assertPromptInput(`echo |`);
      await writePromise('"a"');
      await assertPromptInput(`echo "a"| `);
      await writePromise("\n\r b");
      await assertPromptInput(`echo "a"
 b|`);
      await writePromise("\n\r c");
      await assertPromptInput(`echo "a"
 b
 c|`);
    });
  });
  suite("multi-line wrapped (continuation prompt)", () => {
    test("basic wrapped line", async () => {
      xterm.resize(5, 10);
      promptInputModel.setContinuationPrompt("\u2219 ");
      await writePromise("$ ");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise("ech");
      await assertPromptInput(`ech|`);
      await writePromise("o ");
      await assertPromptInput(`echo |`);
      await writePromise('"a"');
      await assertPromptInput(`echo "a"| `);
      await writePromise("\n\r\u2219 ");
      await assertPromptInput(`echo "a"
|`);
      await writePromise("b");
      await assertPromptInput(`echo "a"
b|`);
      await writePromise("\n\r\u2219 ");
      await assertPromptInput(`echo "a"
b
|`);
      await writePromise("c");
      await assertPromptInput(`echo "a"
b
c|`);
      await writePromise("\n\r\u2219 ");
      await assertPromptInput(`echo "a"
b
c
|`);
    });
  });
  suite("multi-line wrapped fish", () => {
    test("forward slash continuation", async () => {
      promptInputModel.setShellType(PosixShellType.Fish);
      await writePromise("$ ");
      await assertPromptInput("|");
      await writePromise("[I] meganrogge@Megans-MacBook-Pro ~ (main|BISECTING)>");
      fireCommandStart();
      await writePromise("ech\\");
      await assertPromptInput(`ech\\|`);
      await writePromise("\no bye");
      await assertPromptInput(`echo bye|`);
    });
    test("newline with no continuation", async () => {
      promptInputModel.setShellType(PosixShellType.Fish);
      await writePromise("$ ");
      await assertPromptInput("|");
      await writePromise("[I] meganrogge@Megans-MacBook-Pro ~ (main|BISECTING)>");
      fireCommandStart();
      await assertPromptInput("|");
      await writePromise('echo "hi');
      await assertPromptInput(`echo "hi|`);
      await writePromise('\nand bye\nwhy"');
      await assertPromptInput(`echo "hi
and bye
why"|`);
    });
  });
  suite("recorded sessions", () => {
    async function replayEvents(events) {
      for (const data of events) {
        await writePromise(data);
      }
    }
    suite("Windows 11 (10.0.22621.3447), pwsh 7.4.2, starship prompt 1.10.2", () => {
      test("input with ignored ghost text", async () => {
        await replayEvents([
          "\x1B[?25l\x1B[2J\x1B[m\x1B[H\x1B]0;C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.4.2.0_x64__8wekyb3d8bbwe\\pwsh.exe\x07\x1B[?25h",
          "\x1B[?25l\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\x1B[H\x1B[?25h",
          "\x1B]633;P;IsWindows=True\x07",
          "\x1B]633;P;ContinuationPrompt=\x1B[38;5;8m\u2219\x1B[0m \x07",
          "\x1B]633;A\x07\x1B]633;P;Cwd=C:\\Github\\microsoft\\vscode\x07\x1B]633;B\x07",
          "\x1B[34m\r\n\uE0B6\x1B[38;2;17;17;17m\x1B[44m03:13:47 \x1B[34m\x1B[41m\uE0B0 \x1B[38;2;17;17;17mvscode \x1B[31m\x1B[43m\uE0B0 \x1B[38;2;17;17;17m\uE0A0 tyriar/prompt_input_model \x1B[33m\x1B[46m\uE0B0 \x1B[38;2;17;17;17m$\u21E1 \x1B[36m\x1B[49m\uE0B0 \x1B[mvia \x1B[32m\x1B[1m\uE718 v18.18.2 \r\n\u276F\x1B[m "
        ]);
        fireCommandStart();
        await assertPromptInput("|");
        await replayEvents([
          "\x1B[?25l\x1B[93mf\x1B[97m\x1B[2m\x1B[3makecommand\x1B[3;4H\x1B[?25h",
          "\x1B[m",
          "\x1B[93m\bfo\x1B[9X",
          "\x1B[m",
          "\x1B[?25l\x1B[93m\x1B[3;3Hfoo\x1B[?25h",
          "\x1B[m"
        ]);
        await assertPromptInput("foo|");
      });
      test("input with accepted and run ghost text", async () => {
        await replayEvents([
          "\x1B[?25l\x1B[2J\x1B[m\x1B[H\x1B]0;C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.4.2.0_x64__8wekyb3d8bbwe\\pwsh.exe\x07\x1B[?25h",
          "\x1B[?25l\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\x1B[H\x1B[?25h",
          "\x1B]633;P;IsWindows=True\x07",
          "\x1B]633;P;ContinuationPrompt=\x1B[38;5;8m\u2219\x1B[0m \x07",
          "\x1B]633;A\x07\x1B]633;P;Cwd=C:\\Github\\microsoft\\vscode\x07\x1B]633;B\x07",
          "\x1B[34m\r\n\uE0B6\x1B[38;2;17;17;17m\x1B[44m03:41:36 \x1B[34m\x1B[41m\uE0B0 \x1B[38;2;17;17;17mvscode \x1B[31m\x1B[43m\uE0B0 \x1B[38;2;17;17;17m\uE0A0 tyriar/prompt_input_model \x1B[33m\x1B[46m\uE0B0 \x1B[38;2;17;17;17m$ \x1B[36m\x1B[49m\uE0B0 \x1B[mvia \x1B[32m\x1B[1m\uE718 v18.18.2 \r\n\u276F\x1B[m "
        ]);
        promptInputModel.setContinuationPrompt("\u2219 ");
        fireCommandStart();
        await assertPromptInput("|");
        await replayEvents([
          '\x1B[?25l\x1B[93me\x1B[97m\x1B[2m\x1B[3mcho "hello world"\x1B[3;4H\x1B[?25h',
          "\x1B[m"
        ]);
        await assertPromptInput('e|[cho "hello world"]');
        await replayEvents([
          '\x1B[?25l\x1B[93m\bec\x1B[97m\x1B[2m\x1B[3mho "hello world"\x1B[3;5H\x1B[?25h',
          "\x1B[m"
        ]);
        await assertPromptInput('ec|[ho "hello world"]');
        await replayEvents([
          '\x1B[?25l\x1B[93m\x1B[3;3Hech\x1B[97m\x1B[2m\x1B[3mo "hello world"\x1B[3;6H\x1B[?25h',
          "\x1B[m"
        ]);
        await assertPromptInput('ech|[o "hello world"]');
        await replayEvents([
          '\x1B[?25l\x1B[93m\x1B[3;3Hecho\x1B[97m\x1B[2m\x1B[3m "hello world"\x1B[3;7H\x1B[?25h',
          "\x1B[m"
        ]);
        await assertPromptInput('echo|[ "hello world"]');
        await replayEvents([
          '\x1B[?25l\x1B[93m\x1B[3;3Hecho \x1B[97m\x1B[2m\x1B[3m"hello world"\x1B[3;8H\x1B[?25h',
          "\x1B[m"
        ]);
        await assertPromptInput('echo |["hello world"]');
        await replayEvents([
          '\x1B[?25l\x1B[93m\x1B[3;3Hecho \x1B[36m"hello world"\x1B[?25h',
          "\x1B[m"
        ]);
        await assertPromptInput('echo "hello world"|');
        await replayEvents([
          '\x1B]633;E;echo "hello world";ff464d39-bc80-4bae-9ead-b1cafc4adf6f\x07\x1B]633;C\x07'
        ]);
        fireCommandExecuted();
        await assertPromptInput('echo "hello world"');
        await replayEvents([
          "\r\n",
          "hello world\r\n"
        ]);
        await assertPromptInput('echo "hello world"');
        await replayEvents([
          "\x1B]633;D;0\x07\x1B]633;A\x07\x1B]633;P;Cwd=C:\\Github\\microsoft\\vscode\x07\x1B]633;B\x07",
          "\x1B[34m\r\n\uE0B6\x1B[38;2;17;17;17m\x1B[44m03:41:42 \x1B[34m\x1B[41m\uE0B0 \x1B[38;2;17;17;17mvscode \x1B[31m\x1B[43m\uE0B0 \x1B[38;2;17;17;17m\uE0A0 tyriar/prompt_input_model \x1B[33m\x1B[46m\uE0B0 \x1B[38;2;17;17;17m$ \x1B[36m\x1B[49m\uE0B0 \x1B[mvia \x1B[32m\x1B[1m\uE718 v18.18.2 \r\n\u276F\x1B[m "
        ]);
        fireCommandStart();
        await assertPromptInput("|");
      });
      test("input, go to start (ctrl+home), delete word in front (ctrl+delete)", async () => {
        await replayEvents([
          "\x1B[?25l\x1B[2J\x1B[m\x1B[H\x1B]0;C:Program FilesWindowsAppsMicrosoft.PowerShell_7.4.2.0_x64__8wekyb3d8bbwepwsh.exe\x07\x1B[?25h",
          "\x1B[?25l\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\r\n\x1B[K\x1B[H\x1B[?25h",
          "\x1B]633;P;IsWindows=True\x07",
          "\x1B]633;P;ContinuationPrompt=\x1B[38;5;8m\u2219\x1B[0m \x07",
          "\x1B]633;A\x07\x1B]633;P;Cwd=C:\\Github\\microsoft\\vscode\x07\x1B]633;B\x07",
          "\x1B[34m\r\n\uE0B6\x1B[38;2;17;17;17m\x1B[44m16:07:06 \x1B[34m\x1B[41m\uE0B0 \x1B[38;2;17;17;17mvscode \x1B[31m\x1B[43m\uE0B0 \x1B[38;2;17;17;17m\uE0A0 tyriar/210662 \x1B[33m\x1B[46m\uE0B0 \x1B[38;2;17;17;17m$! \x1B[36m\x1B[49m\uE0B0 \x1B[mvia \x1B[32m\x1B[1m\uE718 v18.18.2 \r\n\u276F\x1B[m "
        ]);
        fireCommandStart();
        await assertPromptInput("|");
        await replayEvents([
          "\x1B[?25l\x1B[93mG\x1B[97m\x1B[2m\x1B[3mit push\x1B[3;4H\x1B[?25h",
          "\x1B[m",
          "\x1B[?25l\x1B[93m\bGe\x1B[97m\x1B[2m\x1B[3mt-ChildItem -Path a\x1B[3;5H\x1B[?25h",
          "\x1B[m",
          "\x1B[?25l\x1B[93m\x1B[3;3HGet\x1B[97m\x1B[2m\x1B[3m-ChildItem -Path a\x1B[3;6H\x1B[?25h"
        ]);
        await assertPromptInput("Get|[-ChildItem -Path a]");
        await replayEvents([
          "\x1B[m",
          "\x1B[?25l\x1B[3;3H\x1B[?25h",
          "\x1B[21X"
        ]);
        await timeout(0);
        const actualValueWithCursor = promptInputModel.getCombinedString();
        strictEqual(
          actualValueWithCursor,
          "|".replaceAll("\n", "\u23CE")
        );
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC90ZXN0L2NvbW1vbi9jYXBhYmlsaXRpZXMvY29tbWFuZERldGVjdGlvbi9wcm9tcHRJbnB1dE1vZGVsLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgdHlwZSB7IFRlcm1pbmFsIH0gZnJvbSAnQHh0ZXJtL2hlYWRsZXNzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBQcm9tcHRJbnB1dE1vZGVsLCB0eXBlIElQcm9tcHRJbnB1dE1vZGVsU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY2FwYWJpbGl0aWVzL2NvbW1hbmREZXRlY3Rpb24vcHJvbXB0SW5wdXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHR5cGUgeyBJVGVybWluYWxDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgb2ssIG5vdERlZXBTdHJpY3RFcXVhbCwgc3RyaWN0RXF1YWwgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGltcG9ydEFNRE5vZGVNb2R1bGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9hbWRYLmpzJztcbmltcG9ydCB7IEdlbmVyYWxTaGVsbFR5cGUsIFBvc2l4U2hlbGxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3Rlcm1pbmFsLmpzJztcblxuc3VpdGUoJ1Byb21wdElucHV0TW9kZWwnLCAoKSA9PiB7XG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IHByb21wdElucHV0TW9kZWw6IFByb21wdElucHV0TW9kZWw7XG5cdGxldCB4dGVybTogVGVybWluYWw7XG5cdGxldCBvbkNvbW1hbmRTdGFydDogRW1pdHRlcjxJVGVybWluYWxDb21tYW5kPjtcblx0bGV0IG9uQ29tbWFuZFN0YXJ0Q2hhbmdlZDogRW1pdHRlcjx2b2lkPjtcblx0bGV0IG9uQ29tbWFuZEV4ZWN1dGVkOiBFbWl0dGVyPElUZXJtaW5hbENvbW1hbmQ+O1xuXG5cdGFzeW5jIGZ1bmN0aW9uIHdyaXRlUHJvbWlzZShkYXRhOiBzdHJpbmcpIHtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyID0+IHh0ZXJtLndyaXRlKGRhdGEsIHIpKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGZpcmVDb21tYW5kU3RhcnQoKSB7XG5cdFx0b25Db21tYW5kU3RhcnQuZmlyZSh7IG1hcmtlcjogeHRlcm0ucmVnaXN0ZXJNYXJrZXIoKSB9IGFzIElUZXJtaW5hbENvbW1hbmQpO1xuXHR9XG5cblx0ZnVuY3Rpb24gZmlyZUNvbW1hbmRFeGVjdXRlZCgpIHtcblx0XHRvbkNvbW1hbmRFeGVjdXRlZC5maXJlKG51bGwhKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHNldENvbnRpbnVhdGlvblByb21wdChwcm9tcHQ6IHN0cmluZykge1xuXHRcdHByb21wdElucHV0TW9kZWwuc2V0Q29udGludWF0aW9uUHJvbXB0KHByb21wdCk7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBhc3NlcnRQcm9tcHRJbnB1dCh2YWx1ZVdpdGhDdXJzb3I6IHN0cmluZykge1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cblx0XHRpZiAocHJvbXB0SW5wdXRNb2RlbC5jdXJzb3JJbmRleCAhPT0gLTEgJiYgIXZhbHVlV2l0aEN1cnNvci5pbmNsdWRlcygnfCcpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2Fzc2VydFByb21wdElucHV0IG11c3QgY29udGFpbiB8IGNoYXJhY3RlcicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdHVhbFZhbHVlV2l0aEN1cnNvciA9IHByb21wdElucHV0TW9kZWwuZ2V0Q29tYmluZWRTdHJpbmcoKTtcblx0XHRzdHJpY3RFcXVhbChcblx0XHRcdGFjdHVhbFZhbHVlV2l0aEN1cnNvcixcblx0XHRcdHZhbHVlV2l0aEN1cnNvci5yZXBsYWNlQWxsKCdcXG4nLCAnXFx1MjNDRScpXG5cdFx0KTtcblxuXHRcdC8vIFRoaXMgaXMgcmVxdWlyZWQgdG8gZW5zdXJlIHRoZSBjdXJzb3IgaW5kZXggaXMgY29ycmVjdGx5IHJlc29sdmVkIGZvciBub24tYXNjaWkgY2hhcmFjdGVyc1xuXHRcdGNvbnN0IHZhbHVlID0gdmFsdWVXaXRoQ3Vyc29yLnJlcGxhY2UoL1tcXHxcXFtcXF1dL2csICcnKTtcblx0XHRjb25zdCBjdXJzb3JJbmRleCA9IHZhbHVlV2l0aEN1cnNvci5pbmRleE9mKCd8Jyk7XG5cdFx0c3RyaWN0RXF1YWwocHJvbXB0SW5wdXRNb2RlbC52YWx1ZSwgdmFsdWUpO1xuXHRcdHN0cmljdEVxdWFsKHByb21wdElucHV0TW9kZWwuY3Vyc29ySW5kZXgsIGN1cnNvckluZGV4LCBgdmFsdWU9JHtwcm9tcHRJbnB1dE1vZGVsLnZhbHVlfWApO1xuXHRcdG9rKHByb21wdElucHV0TW9kZWwuZ2hvc3RUZXh0SW5kZXggPT09IC0xIHx8IGN1cnNvckluZGV4IDw9IHByb21wdElucHV0TW9kZWwuZ2hvc3RUZXh0SW5kZXgsIGBjdXJzb3JJbmRleCAoJHtjdXJzb3JJbmRleH0pIG11c3QgYmUgYmVmb3JlIGdob3N0VGV4dEluZGV4ICgke3Byb21wdElucHV0TW9kZWwuZ2hvc3RUZXh0SW5kZXh9KWApO1xuXHR9XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFRlcm1pbmFsQ3RvciA9IChhd2FpdCBpbXBvcnRBTUROb2RlTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0B4dGVybS94dGVybScpPignQHh0ZXJtL3h0ZXJtJywgJ2xpYi94dGVybS5qcycpKS5UZXJtaW5hbDtcblx0XHR4dGVybSA9IHN0b3JlLmFkZChuZXcgVGVybWluYWxDdG9yKHsgYWxsb3dQcm9wb3NlZEFwaTogdHJ1ZSB9KSk7XG5cdFx0b25Db21tYW5kU3RhcnQgPSBzdG9yZS5hZGQobmV3IEVtaXR0ZXIoKSk7XG5cdFx0b25Db21tYW5kU3RhcnRDaGFuZ2VkID0gc3RvcmUuYWRkKG5ldyBFbWl0dGVyKCkpO1xuXHRcdG9uQ29tbWFuZEV4ZWN1dGVkID0gc3RvcmUuYWRkKG5ldyBFbWl0dGVyKCkpO1xuXHRcdHByb21wdElucHV0TW9kZWwgPSBzdG9yZS5hZGQobmV3IFByb21wdElucHV0TW9kZWwoeHRlcm0sIG9uQ29tbWFuZFN0YXJ0LmV2ZW50LCBvbkNvbW1hbmRTdGFydENoYW5nZWQuZXZlbnQsIG9uQ29tbWFuZEV4ZWN1dGVkLmV2ZW50LCBuZXcgTnVsbExvZ1NlcnZpY2UpKTtcblx0fSk7XG5cblx0dGVzdCgnYmFzaWMgaW5wdXQgYW5kIGV4ZWN1dGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd3JpdGVQcm9taXNlKCckICcpO1xuXHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdmb28gYmFyJyk7XG5cdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ2ZvbyBiYXJ8Jyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xcclxcbicpO1xuXHRcdGZpcmVDb21tYW5kRXhlY3V0ZWQoKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnZm9vIGJhcicpO1xuXG5cdFx0YXdhaXQgd3JpdGVQcm9taXNlKCcoY29tbWFuZCBvdXRwdXQpXFxyXFxuJCAnKTtcblx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3wnKTtcblx0fSk7XG5cblx0dGVzdCgnc2hvdWxkIG5vdCBmaXJlIG9uRGlkQ2hhbmdlSW5wdXQgZXZlbnRzIHdoZW4gbm90aGluZyBjaGFuZ2VzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGV2ZW50czogSVByb21wdElucHV0TW9kZWxTdGF0ZVtdID0gW107XG5cdFx0c3RvcmUuYWRkKHByb21wdElucHV0TW9kZWwub25EaWRDaGFuZ2VJbnB1dChlID0+IGV2ZW50cy5wdXNoKGUpKSk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ2ZvbycpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdmb298Jyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyBiYXInKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnZm9vIGJhcnwnKTtcblxuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFxyXFxuJyk7XG5cdFx0ZmlyZUNvbW1hbmRFeGVjdXRlZCgpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdmb28gYmFyJyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ2ZvbyBiYXInKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnZm9vIGJhcnwnKTtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnRzLmxlbmd0aCAtIDE7IGkrKykge1xuXHRcdFx0bm90RGVlcFN0cmljdEVxdWFsKGV2ZW50c1tpXSwgZXZlbnRzW2kgKyAxXSwgJ25vdCBhZGphY2VudCBldmVudHMgc2hvdWxkIGZpcmUgd2l0aCB0aGUgc2FtZSB2YWx1ZScpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnc2hvdWxkIGZpcmUgb25EaWRJbnRlcnJ1cHQgZm9sbG93ZWQgYnkgb25EaWRGaW5pc2ggd2hlbiBjdHJsK2MgaXMgcHJlc3NlZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ2ZvbycpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdmb298Jyk7XG5cblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyID0+IHtcblx0XHRcdHN0b3JlLmFkZChwcm9tcHRJbnB1dE1vZGVsLm9uRGlkSW50ZXJydXB0KCgpID0+IHtcblx0XHRcdFx0Ly8gRmlyZSBvbkRpZEZpbmlzaElucHV0IGltbWVkaWF0ZWx5IGFmdGVyIG9uRGlkSW50ZXJydXB0XG5cdFx0XHRcdHN0b3JlLmFkZChwcm9tcHRJbnB1dE1vZGVsLm9uRGlkRmluaXNoSW5wdXQoKCkgPT4ge1xuXHRcdFx0XHRcdHIoKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fSkpO1xuXHRcdFx0eHRlcm0uaW5wdXQoJ1xceDAzJyk7XG5cdFx0XHR3cml0ZVByb21pc2UoJ15DJykudGhlbigoKSA9PiBmaXJlQ29tbWFuZEV4ZWN1dGVkKCkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjdXJzb3IgbmF2aWdhdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ2ZvbyBiYXInKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnZm9vIGJhcnwnKTtcblxuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbM0QnKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnZm9vIHxiYXInKTtcblxuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbNEQnKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfGZvbyBiYXInKTtcblxuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbM0MnKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnZm9vfCBiYXInKTtcblxuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbNEMnKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnZm9vIGJhcnwnKTtcblxuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbRCcpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdmb28gYmF8cicpO1xuXG5cdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltDJyk7XG5cdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ2ZvbyBiYXJ8Jyk7XG5cdH0pO1xuXG5cdHN1aXRlKCdnaG9zdCB0ZXh0JywgKCkgPT4ge1xuXHRcdHRlc3QoJ2Jhc2ljIGdob3N0IHRleHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ2Zvb1xceDFiWzJtIGJhclxceDFiWzBtXFx4MWJbNEQnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdmb298WyBiYXJdJyk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbMkQnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdmfG9vWyBiYXJdJyk7XG5cdFx0fSk7XG5cdFx0dGVzdCgndHJhaWxpbmcgd2hpdGVzcGFjZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ2ZvbyAgICAnKTtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbNEQnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdmb298ICAgICcpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ2Jhc2ljIGdob3N0IHRleHQgb25lIHdvcmQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ3B3XFx4MWJbMm1kXFx4MWJbMUQnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdwd3xbZF0nKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdnaG9zdCB0ZXh0IHdpdGggY3Vyc29yIG5hdmlnYXRpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ2Zvb1xceDFiWzJtIGJhclxceDFiWzBtXFx4MWJbNEQnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdmb298WyBiYXJdJyk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbMkQnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdmfG9vWyBiYXJdJyk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbQycpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ2ZvfG9bIGJhcl0nKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltDJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnZm9vfFsgYmFyXScpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ2dob3N0IHRleHQgd2l0aCBkaWZmZXJlbnQgZm9yZWdyb3VuZCBjb2xvcnMgb25seScsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnZm9vXFx4MWJbMzg7MjsyNTU7MDswbSBiYXJcXHgxYlswbVxceDFiWzREJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnZm9vfFsgYmFyXScpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiWzJEJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnZnxvb1sgYmFyXScpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ25vIGdob3N0IHRleHQgd2hlbiBmb3JlZ3JvdW5kIGNvbG9yIG1hdGNoZXMgZWFybGllciB0ZXh0JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCckICcpO1xuXHRcdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3wnKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKFxuXHRcdFx0XHQnXFx4MWJbMzg7MjsyNTU7MDswbXJlZDFcXHgxYlswbSAnICsgIC8vIFJlZCBcInJlZDFcIlxuXHRcdFx0XHQnXFx4MWJbMzg7MjswOzI1NTswbWdyZWVuXFx4MWJbMG0gJyArIC8vIEdyZWVuIFwiZ3JlZW5cIlxuXHRcdFx0XHQnXFx4MWJbMzg7MjsyNTU7MDswbXJlZDJcXHgxYlswbScgICAgIC8vIFJlZCBcInJlZDJcIiAoc2FtZSBhcyByZWQxKVxuXHRcdFx0KTtcblxuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3JlZDEgZ3JlZW4gcmVkMnwnKTsgLy8gTm8gZ2hvc3QgdGV4dCBleHBlY3RlZFxuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ2hvc3QgdGV4dCBkZXRlY3RlZCB3aGVuIGZvcmVncm91bmQgY29sb3IgaXMgdW5pcXVlIGF0IHRoZSBlbmQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoXG5cdFx0XHRcdCdcXHgxYlszODsyOzI1NTswOzBtY21kXFx4MWJbMG0gJyArICAgLy8gUmVkIFwiY21kXCJcblx0XHRcdFx0J1xceDFiWzM4OzI7MDsyNTU7MG1hcmdcXHgxYlswbSAnICsgICAvLyBHcmVlbiBcImFyZ1wiXG5cdFx0XHRcdCdcXHgxYlszODsyOzA7MDsyNTVtZmluYWxcXHgxYls1RCcgICAgLy8gQmx1ZSBcImZpbmFsXCIgKGdob3N0IHRleHQpXG5cdFx0XHQpO1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnY21kIGFyZyB8W2ZpbmFsXScpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbm8gZ2hvc3QgdGV4dCB3aGVuIGJhY2tncm91bmQgY29sb3IgbWF0Y2hlcyBlYXJsaWVyIHRleHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoXG5cdFx0XHRcdCdcXHgxYls0ODsyOzI1NTswOzBtcmVkX2JnMVxceDFiWzBtICcgKyAgLy8gUmVkIGJhY2tncm91bmRcblx0XHRcdFx0J1xceDFiWzQ4OzI7MDsyNTU7MG1ncmVlbl9iZ1xceDFiWzBtICcgKyAvLyBHcmVlbiBiYWNrZ3JvdW5kXG5cdFx0XHRcdCdcXHgxYls0ODsyOzI1NTswOzBtcmVkX2JnMlxceDFiWzBtJyAgICAgLy8gUmVkIGJhY2tncm91bmQgYWdhaW5cblx0XHRcdCk7XG5cblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdyZWRfYmcxIGdyZWVuX2JnIHJlZF9iZzJ8Jyk7IC8vIE5vIGdob3N0IHRleHQgZXhwZWN0ZWRcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2dob3N0IHRleHQgZGV0ZWN0ZWQgd2hlbiBiYWNrZ3JvdW5kIGNvbG9yIGlzIHVuaXF1ZSBhdCB0aGUgZW5kJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCckICcpO1xuXHRcdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3wnKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKFxuXHRcdFx0XHQnXFx4MWJbNDg7MjsyNTU7MDswbXJlZF9iZ1xceDFiWzBtICcgKyAgLy8gUmVkIGJhY2tncm91bmRcblx0XHRcdFx0J1xceDFiWzQ4OzI7MDsyNTU7MG1ncmVlbl9iZ1xceDFiWzBtICcgKyAvLyBHcmVlbiBiYWNrZ3JvdW5kXG5cdFx0XHRcdCdcXHgxYls0ODsyOzA7MDsyNTVtYmx1ZV9iZ1xceDFiWzdEJyAgICAgLy8gQmx1ZSBiYWNrZ3JvdW5kIChnaG9zdCB0ZXh0KVxuXHRcdFx0KTtcblxuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3JlZF9iZyBncmVlbl9iZyB8W2JsdWVfYmddJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnaG9zdCB0ZXh0IGRldGVjdGVkIHdoZW4gYm9sZCBzdHlsZSBpcyB1bmlxdWUgYXQgdGhlIGVuZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZShcblx0XHRcdFx0J3RleHQgJyArXG5cdFx0XHRcdCdcXHgxYlsxbUJPTERcXHgxYls0RCcgLy8gQm9sZCBcIkJPTERcIiAoZ2hvc3QgdGV4dClcblx0XHRcdCk7XG5cblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd0ZXh0IHxbQk9MRF0nKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ25vIGdob3N0IHRleHQgd2hlbiBlYXJsaWVyIHRleHQgaGFzIHRoZSBzYW1lIGJvbGQgc3R5bGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoXG5cdFx0XHRcdCdcXHgxYlsxbUJPTEQxXFx4MWJbMG0gJyArIC8vIEJvbGQgXCJCT0xEMVwiXG5cdFx0XHRcdCdub3JtYWwgJyArXG5cdFx0XHRcdCdcXHgxYlsxbUJPTEQyXFx4MWJbMG0nICAgIC8vIEJvbGQgXCJCT0xEMlwiIChzYW1lIHN0eWxlIGFzIFwiQk9MRDFcIilcblx0XHRcdCk7XG5cblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdCT0xEMSBub3JtYWwgQk9MRDJ8Jyk7IC8vIE5vIGdob3N0IHRleHQgZXhwZWN0ZWRcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2dob3N0IHRleHQgZGV0ZWN0ZWQgd2hlbiBpdGFsaWMgc3R5bGUgaXMgdW5pcXVlIGF0IHRoZSBlbmQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoXG5cdFx0XHRcdCd0ZXh0ICcgK1xuXHRcdFx0XHQnXFx4MWJbM21JVEFMSUNcXHgxYls2RCcgLy8gSXRhbGljIFwiSVRBTElDXCIgKGdob3N0IHRleHQpXG5cdFx0XHQpO1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgndGV4dCB8W0lUQUxJQ10nKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ25vIGdob3N0IHRleHQgd2hlbiBlYXJsaWVyIHRleHQgaGFzIHRoZSBzYW1lIGl0YWxpYyBzdHlsZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZShcblx0XHRcdFx0J1xceDFiWzNtSVRBTElDMVxceDFiWzBtICcgKyAvLyBJdGFsaWMgXCJJVEFMSUMxXCJcblx0XHRcdFx0J25vcm1hbCAnICtcblx0XHRcdFx0J1xceDFiWzNtSVRBTElDMlxceDFiWzBtJyAgICAvLyBJdGFsaWMgXCJJVEFMSUMyXCIgKHNhbWUgc3R5bGUgYXMgXCJJVEFMSUMxXCIpXG5cdFx0XHQpO1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnSVRBTElDMSBub3JtYWwgSVRBTElDMnwnKTsgLy8gTm8gZ2hvc3QgdGV4dCBleHBlY3RlZFxuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ2hvc3QgdGV4dCBkZXRlY3RlZCB3aGVuIHVuZGVybGluZSBzdHlsZSBpcyB1bmlxdWUgYXQgdGhlIGVuZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZShcblx0XHRcdFx0J3RleHQgJyArXG5cdFx0XHRcdCdcXHgxYls0bVVOREVSTElORVxceDFiWzlEJyAvLyBVbmRlcmxpbmVkIFwiVU5ERVJMSU5FXCIgKGdob3N0IHRleHQpXG5cdFx0XHQpO1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgndGV4dCB8W1VOREVSTElORV0nKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ25vIGdob3N0IHRleHQgd2hlbiBlYXJsaWVyIHRleHQgaGFzIHRoZSBzYW1lIHVuZGVybGluZSBzdHlsZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZShcblx0XHRcdFx0J1xceDFiWzRtVU5ERVJMSU5FMVxceDFiWzBtICcgKyAvLyBVbmRlcmxpbmVkIFwiVU5ERVJMSU5FMVwiXG5cdFx0XHRcdCdub3JtYWwgJyArXG5cdFx0XHRcdCdcXHgxYls0bVVOREVSTElORTJcXHgxYlswbScgICAgLy8gVW5kZXJsaW5lZCBcIlVOREVSTElORTJcIiAoc2FtZSBzdHlsZSBhcyBcIlVOREVSTElORTFcIilcblx0XHRcdCk7XG5cblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdVTkRFUkxJTkUxIG5vcm1hbCBVTkRFUkxJTkUyfCcpOyAvLyBObyBnaG9zdCB0ZXh0IGV4cGVjdGVkXG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnaG9zdCB0ZXh0IGRldGVjdGVkIHdoZW4gc3RyaWtldGhyb3VnaCBzdHlsZSBpcyB1bmlxdWUgYXQgdGhlIGVuZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZShcblx0XHRcdFx0J3RleHQgJyArXG5cdFx0XHRcdCdcXHgxYls5bVNUUklLRVxceDFiWzZEJyAvLyBTdHJpa2V0aHJvdWdoIFwiU1RSSUtFXCIgKGdob3N0IHRleHQpXG5cdFx0XHQpO1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgndGV4dCB8W1NUUklLRV0nKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ25vIGdob3N0IHRleHQgd2hlbiBlYXJsaWVyIHRleHQgaGFzIHRoZSBzYW1lIHN0cmlrZXRocm91Z2ggc3R5bGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoXG5cdFx0XHRcdCdcXHgxYls5bVNUUklLRTFcXHgxYlswbSAnICsgLy8gU3RyaWtldGhyb3VnaCBcIlNUUklLRTFcIlxuXHRcdFx0XHQnbm9ybWFsICcgK1xuXHRcdFx0XHQnXFx4MWJbOW1TVFJJS0UyXFx4MWJbMG0nICAgIC8vIFN0cmlrZXRocm91Z2ggXCJTVFJJS0UyXCIgKHNhbWUgc3R5bGUgYXMgXCJTVFJJS0UxXCIpXG5cdFx0XHQpO1xuXG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnU1RSSUtFMSBub3JtYWwgU1RSSUtFMnwnKTsgLy8gTm8gZ2hvc3QgdGV4dCBleHBlY3RlZFxuXHRcdH0pO1xuXHRcdHN1aXRlKCdXaXRoIHdyYXBwaW5nJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnRmlzaCBnaG9zdCB0ZXh0IGluIGxvbmcgbGluZSB3aXRoIHdyYXBwZWQgY29udGVudCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0cHJvbXB0SW5wdXRNb2RlbC5zZXRTaGVsbFR5cGUoUG9zaXhTaGVsbFR5cGUuRmlzaCk7XG5cdFx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRcdC8vIFdyaXRlIGEgY29tbWFuZCB3aXRoIGdob3N0IHRleHQgdGhhdCB3aWxsIHdyYXBcblx0XHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdmaW5kIC4gLW5hbWUnKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGZpbmQgLiAtbmFtZXxgKTtcblxuXHRcdFx0XHQvLyBBZGQgZ2hvc3QgdGV4dCB3aXRoIGRpbSBzdHlsZVxuXHRcdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiWzJtIHRlc3RcXHgxYlswbVxceDFiWzREJyk7XG5cdFx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBmaW5kIC4gLW5hbWUgfFt0ZXN0XWApO1xuXG5cdFx0XHRcdC8vIE1vdmUgY3Vyc29yIHdpdGhpbiB0aGUgZ2hvc3QgdGV4dFxuXHRcdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiW0MnKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGZpbmQgLiAtbmFtZSB0fFtlc3RdYCk7XG5cblx0XHRcdFx0Ly8gQWNjZXB0IGdob3N0IHRleHRcblx0XHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltDXFx4MWJbQ1xceDFiW0NcXHgxYltDXFx4MWJbQycpO1xuXHRcdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZmluZCAuIC1uYW1lIHRlc3R8YCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ1B3c2ggZ2hvc3QgdGV4dCBpbiBsb25nIGxpbmUgd2l0aCB3cmFwcGVkIGNvbnRlbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHByb21wdElucHV0TW9kZWwuc2V0U2hlbGxUeXBlKEdlbmVyYWxTaGVsbFR5cGUuUG93ZXJTaGVsbCk7XG5cdFx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRcdC8vIFdyaXRlIGEgY29tbWFuZCB3aXRoIGdob3N0IHRleHQgdGhhdCB3aWxsIHdyYXBcblx0XHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdmaW5kIC4gLW5hbWUnKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGZpbmQgLiAtbmFtZXxgKTtcblxuXHRcdFx0XHQvLyBBZGQgZ2hvc3QgdGV4dCB3aXRoIGRpbSBzdHlsZVxuXHRcdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiWzJtIHRlc3RcXHgxYlswbVxceDFiWzREJyk7XG5cdFx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBmaW5kIC4gLW5hbWUgfFt0ZXN0XWApO1xuXG5cdFx0XHRcdC8vIE1vdmUgY3Vyc29yIHdpdGhpbiB0aGUgZ2hvc3QgdGV4dFxuXHRcdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiW0MnKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGZpbmQgLiAtbmFtZSB0fFtlc3RdYCk7XG5cblx0XHRcdFx0Ly8gQWNjZXB0IGdob3N0IHRleHRcblx0XHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltDXFx4MWJbQ1xceDFiW0NcXHgxYltDXFx4MWJbQycpO1xuXHRcdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZmluZCAuIC1uYW1lIHRlc3R8YCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnd2lkZSBpbnB1dCAoS29yZWFuKScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1x1QzU0OFx1QzYwMScpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdcdUM1NDhcdUM2MDF8Jyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xcclxcblx1Q0VGNFx1RDRFOFx1RDEzMCcpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdcdUM1NDhcdUM2MDFcXG5cdUNFRjRcdUQ0RThcdUQxMzB8Jyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xcclxcblx1QzBBQ1x1Qjc4QycpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdcdUM1NDhcdUM2MDFcXG5cdUNFRjRcdUQ0RThcdUQxMzBcXG5cdUMwQUNcdUI3OEN8Jyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiW0cnKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnXHVDNTQ4XHVDNjAxXFxuXHVDRUY0XHVENEU4XHVEMTMwXFxufFx1QzBBQ1x1Qjc4QycpO1xuXG5cdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltBJyk7XG5cdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ1x1QzU0OFx1QzYwMVxcbnxcdUNFRjRcdUQ0RThcdUQxMzBcXG5cdUMwQUNcdUI3OEMnKTtcblxuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbNEMnKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnXHVDNTQ4XHVDNjAxXFxuXHVDRUY0XHVENEU4fFx1RDEzMFxcblx1QzBBQ1x1Qjc4QycpO1xuXG5cdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYlsxOzRIJyk7XG5cdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ1x1QzU0OHxcdUM2MDFcXG5cdUNFRjRcdUQ0RThcdUQxMzBcXG5cdUMwQUNcdUI3OEMnKTtcblxuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbRCcpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8XHVDNTQ4XHVDNjAxXFxuXHVDRUY0XHVENEU4XHVEMTMwXFxuXHVDMEFDXHVCNzhDJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Vtb2ppIGlucHV0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3wnKTtcblxuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXHUyNzBDXHVGRTBGXHVEODNEXHVEQzREJyk7XG5cdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ1x1MjcwQ1x1RkUwRlx1RDgzRFx1REM0RHwnKTtcblxuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFxyXFxuXHVEODNEXHVERTBFXHVEODNEXHVERTE1XHVEODNEXHVERTA1Jyk7XG5cdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ1x1MjcwQ1x1RkUwRlx1RDgzRFx1REM0RFxcblx1RDgzRFx1REUwRVx1RDgzRFx1REUxNVx1RDgzRFx1REUwNXwnKTtcblxuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFxyXFxuXHVEODNFXHVERDE0XHVEODNFXHVERDM3XHVEODNEXHVERTI5Jyk7XG5cdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ1x1MjcwQ1x1RkUwRlx1RDgzRFx1REM0RFxcblx1RDgzRFx1REUwRVx1RDgzRFx1REUxNVx1RDgzRFx1REUwNVxcblx1RDgzRVx1REQxNFx1RDgzRVx1REQzN1x1RDgzRFx1REUyOXwnKTtcblxuXHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbRycpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdcdTI3MENcdUZFMEZcdUQ4M0RcdURDNERcXG5cdUQ4M0RcdURFMEVcdUQ4M0RcdURFMTVcdUQ4M0RcdURFMDVcXG58XHVEODNFXHVERDE0XHVEODNFXHVERDM3XHVEODNEXHVERTI5Jyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiW0EnKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnXHUyNzBDXHVGRTBGXHVEODNEXHVEQzREXFxufFx1RDgzRFx1REUwRVx1RDgzRFx1REUxNVx1RDgzRFx1REUwNVxcblx1RDgzRVx1REQxNFx1RDgzRVx1REQzN1x1RDgzRFx1REUyOScpO1xuXG5cdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYlsyQycpO1xuXHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdcdTI3MENcdUZFMEZcdUQ4M0RcdURDNERcXG5cdUQ4M0RcdURFMEVcdUQ4M0RcdURFMTV8XHVEODNEXHVERTA1XFxuXHVEODNFXHVERDE0XHVEODNFXHVERDM3XHVEODNEXHVERTI5Jyk7XG5cblx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiWzE7NEgnKTtcblx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnXHUyNzBDXHVGRTBGfFx1RDgzRFx1REM0RFxcblx1RDgzRFx1REUwRVx1RDgzRFx1REUxNVx1RDgzRFx1REUwNVxcblx1RDgzRVx1REQxNFx1RDgzRVx1REQzN1x1RDgzRFx1REUyOScpO1xuXG5cdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltEJyk7XG5cdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3xcdTI3MENcdUZFMEZcdUQ4M0RcdURDNERcXG5cdUQ4M0RcdURFMEVcdUQ4M0RcdURFMTVcdUQ4M0RcdURFMDVcXG5cdUQ4M0VcdUREMTRcdUQ4M0VcdUREMzdcdUQ4M0RcdURFMjknKTtcblx0fSk7XG5cblx0c3VpdGUoJ3RyYWlsaW5nIHdoaXRlc3BhY2UnLCAoKSA9PiB7XG5cdFx0dGVzdCgnZGVsZXRlIHdoaXRlc3BhY2Ugd2l0aCBiYWNrc3BhY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyAnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGAgfGApO1xuXG5cdFx0XHR4dGVybS5pbnB1dCgnXFx4N0YnLCB0cnVlKTsgLy8gQmFja3NwYWNlXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiW0QnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRcdHh0ZXJtLmlucHV0KCcgJy5yZXBlYXQoNCksIHRydWUpO1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCcgJy5yZXBlYXQoNCkpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYCAgICB8YCk7XG5cblx0XHRcdHh0ZXJtLmlucHV0KCdcXHgxYltEJy5yZXBlYXQoMiksIHRydWUpOyAvLyBMZWZ0XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiWzJEJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgICB8ICBgKTtcblxuXHRcdFx0eHRlcm0uaW5wdXQoJ1xceDdGJywgdHJ1ZSk7IC8vIEJhY2tzcGFjZVxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltEJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgIHwgIGApO1xuXG5cdFx0XHR4dGVybS5pbnB1dCgnXFx4N0YnLCB0cnVlKTsgLy8gQmFja3NwYWNlXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiW0QnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGB8ICBgKTtcblxuXHRcdFx0eHRlcm0uaW5wdXQoJyAnLCB0cnVlKTtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnICcpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYCB8ICBgKTtcblxuXHRcdFx0eHRlcm0uaW5wdXQoJyAnLCB0cnVlKTtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnICcpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYCAgfCAgYCk7XG5cblx0XHRcdHh0ZXJtLmlucHV0KCdcXHgxYltDJywgdHJ1ZSk7IC8vIFJpZ2h0XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiW0MnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGAgICB8IGApO1xuXG5cdFx0XHR4dGVybS5pbnB1dCgnYScsIHRydWUpO1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdhJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgICAgYXwgYCk7XG5cblx0XHRcdHh0ZXJtLmlucHV0KCdcXHg3RicsIHRydWUpOyAvLyBCYWNrc3BhY2Vcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbRFxceDFiW0snKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGAgICB8IGApO1xuXG5cdFx0XHR4dGVybS5pbnB1dCgnXFx4MWJbRCcucmVwZWF0KDIpLCB0cnVlKTsgLy8gTGVmdFxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYlsyRCcpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYCB8ICAgYCk7XG5cblx0XHRcdHh0ZXJtLmlucHV0KCdcXHgxYlszficsIHRydWUpOyAvLyBEZWxldGVcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgIHwgIGApO1xuXHRcdH0pO1xuXG5cdFx0Ly8gVE9ETzogVGhpcyBkb2Vzbid0IHdvcmsgY29ycmVjdGx5IGJ1dCBpdCBkb2Vzbid0IG1hdHRlciB0b28gbXVjaCBhcyBpdCBvbmx5IGhhcHBlbnMgd2hlblxuXHRcdC8vIHRoZXJlIGlzIGEgbG90IG9mIHdoaXRlc3BhY2UgYXQgdGhlIGVuZCBvZiBhIHByb21wdCBpbnB1dFxuXHRcdHRlc3Quc2tpcCgndHJhY2sgd2hpdGVzcGFjZSB3aGVuIENvblBUWSBkZWxldGVzIHdoaXRlc3BhY2UgdW5leHBlY3RlZGx5JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCckICcpO1xuXHRcdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3wnKTtcblxuXHRcdFx0eHRlcm0uaW5wdXQoJ2xzJywgdHJ1ZSk7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ2xzJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgbHN8YCk7XG5cblx0XHRcdHh0ZXJtLmlucHV0KCcgJy5yZXBlYXQoNCksIHRydWUpO1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCcgJy5yZXBlYXQoNCkpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGxzICAgIHxgKTtcblxuXHRcdFx0eHRlcm0uaW5wdXQoJyAnLCB0cnVlKTtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbNERcXHgxYls1WFxceDFiWzVDJyk7IC8vIEN1cnNvciBsZWZ0IHgoTi0xKSwgZGVsZXRlIHhOLCBjdXJzb3IgcmlnaHQgeE5cblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBscyAgICAgfGApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndHJhY2sgd2hpdGVzcGFjZSBiZXlvbmQgY3Vyc29yJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCckICcpO1xuXHRcdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3wnKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCcgJy5yZXBlYXQoOCkpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYCR7JyAnLnJlcGVhdCg4KX18YCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbNEQnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGAkeycgJy5yZXBlYXQoNCl9fCR7JyAnLnJlcGVhdCg0KX1gKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ211bHRpLWxpbmUnLCAoKSA9PiB7XG5cdFx0dGVzdCgnYmFzaWMgMiBsaW5lJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCckICcpO1xuXHRcdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3wnKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdlY2hvIFwiYScpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJhfGApO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xcblxcclxcXHUyMjE5ICcpO1xuXHRcdFx0c2V0Q29udGludWF0aW9uUHJvbXB0KCdcdTIyMTkgJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImFcXG58YCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnYicpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJhXFxuYnxgKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2Jhc2ljIDMgbGluZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnZWNobyBcImEnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBlY2hvIFwiYXxgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXG5cXHJcXFx1MjIxOSAnKTtcblx0XHRcdHNldENvbnRpbnVhdGlvblByb21wdCgnXHUyMjE5ICcpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJhXFxufGApO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ2InKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBlY2hvIFwiYVxcbmJ8YCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFxuXFxyXFxcdTIyMTkgJyk7XG5cdFx0XHRzZXRDb250aW51YXRpb25Qcm9tcHQoJ1x1MjIxOSAnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBlY2hvIFwiYVxcbmJcXG58YCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnYycpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJhXFxuYlxcbmN8YCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCduYXZpZ2F0ZSBsZWZ0IGluIG11bHRpLWxpbmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ2VjaG8gXCJhJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImF8YCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFxuXFxyXFxcdTIyMTkgJyk7XG5cdFx0XHRzZXRDb250aW51YXRpb25Qcm9tcHQoJ1x1MjIxOSAnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBlY2hvIFwiYVxcbnxgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdiJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImFcXG5ifGApO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiW0QnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBlY2hvIFwiYVxcbnxiYCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFx4MWJbQGMnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBlY2hvIFwiYVxcbmN8YmApO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiW0tcXG5cXHJcXFx1MjIxOSAnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBlY2hvIFwiYVxcbmNcXG58YCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnYicpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJhXFxuY1xcbmJ8YCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnIGZvbycpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJhXFxuY1xcbmIgZm9vfGApO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1xceDFiWzNEJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImFcXG5jXFxuYiB8Zm9vYCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCduYXZpZ2F0ZSB1cCBpbiBtdWx0aS1saW5lJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCckICcpO1xuXHRcdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3wnKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdlY2hvIFwiZm9vJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb3xgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXG5cXHJcXFx1MjIxOSAnKTtcblx0XHRcdHNldENvbnRpbnVhdGlvblByb21wdCgnXHUyMjE5ICcpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJmb29cXG58YCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnYmFyJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb1xcbmJhcnxgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXG5cXHJcXFx1MjIxOSAnKTtcblx0XHRcdHNldENvbnRpbnVhdGlvblByb21wdCgnXHUyMjE5ICcpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJmb29cXG5iYXJcXG58YCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnYmF6Jyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb1xcbmJhclxcbmJhenxgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltBJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb1xcbmJhcnxcXG5iYXpgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltEJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb1xcbmJhfHJcXG5iYXpgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltEJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb1xcbmJ8YXJcXG5iYXpgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltEJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb1xcbnxiYXJcXG5iYXpgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYlsxOzlIJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcInxmb29cXG5iYXJcXG5iYXpgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltDJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZ8b29cXG5iYXJcXG5iYXpgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltDJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvfG9cXG5iYXJcXG5iYXpgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltDJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb3xcXG5iYXJcXG5iYXpgKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ25hdmlnYXRpbmcgdXAgd2hlbiBmaXJzdCBsaW5lIGNvbnRhaW5zIGludmFsaWQvc3RhbGUgdHJhaWxpbmcgd2hpdGVzcGFjZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnZWNobyBcImZvbyAgICAgIFxceDFiWzZEJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb3xgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXG5cXHJcXFx1MjIxOSAnKTtcblx0XHRcdHNldENvbnRpbnVhdGlvblByb21wdCgnXHUyMjE5ICcpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJmb29cXG58YCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnYmFyJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb1xcbmJhcnxgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltEJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb1xcbmJhfHJgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltEJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb1xcbmJ8YXJgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXHgxYltEJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImZvb1xcbnxiYXJgKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ211bHRpLWxpbmUgd3JhcHBlZCAobm8gY29udGludWF0aW9uIHByb21wdCknLCAoKSA9PiB7XG5cdFx0dGVzdCgnYmFzaWMgd3JhcHBlZCBsaW5lJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0eHRlcm0ucmVzaXplKDUsIDEwKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCckICcpO1xuXHRcdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3wnKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdlY2gnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBlY2h8YCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnbyAnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBlY2hvIHxgKTtcblxuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcImFcIicpO1xuXHRcdFx0Ly8gSEFDSzogVHJhaWxpbmcgd2hpdGVzcGFjZSBpcyBkdWUgdG8gZmxha3kgZGV0ZWN0aW9uIGluIHdyYXBwZWQgbGluZXMgKGJ1dCBpdCBkb2Vzbid0IG1hdHRlciBtdWNoKVxuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJhXCJ8IGApO1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXG5cXHJcXCBiJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImFcIlxcbiBifGApO1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXG5cXHJcXCBjJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImFcIlxcbiBiXFxuIGN8YCk7XG5cdFx0fSk7XG5cdH0pO1xuXHRzdWl0ZSgnbXVsdGktbGluZSB3cmFwcGVkIChjb250aW51YXRpb24gcHJvbXB0KScsICgpID0+IHtcblx0XHR0ZXN0KCdiYXNpYyB3cmFwcGVkIGxpbmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHR4dGVybS5yZXNpemUoNSwgMTApO1xuXHRcdFx0cHJvbXB0SW5wdXRNb2RlbC5zZXRDb250aW51YXRpb25Qcm9tcHQoJ1x1MjIxOSAnKTtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnZWNoJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNofGApO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ28gJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyB8YCk7XG5cblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXCJhXCInKTtcblx0XHRcdC8vIEhBQ0s6IFRyYWlsaW5nIHdoaXRlc3BhY2UgaXMgZHVlIHRvIGZsYWt5IGRldGVjdGlvbiBpbiB3cmFwcGVkIGxpbmVzIChidXQgaXQgZG9lc24ndCBtYXR0ZXIgbXVjaClcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBlY2hvIFwiYVwifCBgKTtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFxuXFxyXFxcdTIyMTkgJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImFcIlxcbnxgKTtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnYicpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJhXCJcXG5ifGApO1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXG5cXHJcXFx1MjIxOSAnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBlY2hvIFwiYVwiXFxuYlxcbnxgKTtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnYycpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJhXCJcXG5iXFxuY3xgKTtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFxuXFxyXFxcdTIyMTkgJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImFcIlxcbmJcXG5jXFxufGApO1xuXHRcdH0pO1xuXHR9KTtcblx0c3VpdGUoJ211bHRpLWxpbmUgd3JhcHBlZCBmaXNoJywgKCkgPT4ge1xuXHRcdHRlc3QoJ2ZvcndhcmQgc2xhc2ggY29udGludWF0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0cHJvbXB0SW5wdXRNb2RlbC5zZXRTaGVsbFR5cGUoUG9zaXhTaGVsbFR5cGUuRmlzaCk7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJyQgJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdbSV0gbWVnYW5yb2dnZUBNZWdhbnMtTWFjQm9vay1Qcm8gfiAobWFpbnxCSVNFQ1RJTkcpPicpO1xuXHRcdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ2VjaFxcXFwnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KGBlY2hcXFxcfGApO1xuXHRcdFx0YXdhaXQgd3JpdGVQcm9taXNlKCdcXG5vIGJ5ZScpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gYnllfGApO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ25ld2xpbmUgd2l0aCBubyBjb250aW51YXRpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRwcm9tcHRJbnB1dE1vZGVsLnNldFNoZWxsVHlwZShQb3NpeFNoZWxsVHlwZS5GaXNoKTtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnJCAnKTtcblx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ1tJXSBtZWdhbnJvZ2dlQE1lZ2Fucy1NYWNCb29rLVBybyB+IChtYWlufEJJU0VDVElORyk+Jyk7XG5cdFx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoJ2VjaG8gXCJoaScpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoYGVjaG8gXCJoaXxgKTtcblx0XHRcdGF3YWl0IHdyaXRlUHJvbWlzZSgnXFxuYW5kIGJ5ZVxcbndoeVwiJyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dChgZWNobyBcImhpXFxuYW5kIGJ5ZVxcbndoeVwifGApO1xuXHRcdH0pO1xuXHR9KTtcblxuXHQvLyBUbyBcInJlY29yZCBhIHNlc3Npb25cIiBmb3IgdGhlc2UgdGVzdHM6XG5cdC8vIC0gRW5hYmxlIGRlYnVnIGxvZ2dpbmdcblx0Ly8gLSBPcGVuIGFuZCBjbGVhciBUZXJtaW5hbCBvdXRwdXQgY2hhbm5lbFxuXHQvLyAtIE9wZW4gdGVybWluYWwgYW5kIHBlcmZvcm0gdGhlIHRlc3Rcblx0Ly8gLSBFeHRyYWN0IGFsbCBcInBhcnNpbmcgZGF0YVwiIGxpbmVzIGZyb20gdGhlIHRlcm1pbmFsXG5cdHN1aXRlKCdyZWNvcmRlZCBzZXNzaW9ucycsICgpID0+IHtcblx0XHRhc3luYyBmdW5jdGlvbiByZXBsYXlFdmVudHMoZXZlbnRzOiBzdHJpbmdbXSkge1xuXHRcdFx0Zm9yIChjb25zdCBkYXRhIG9mIGV2ZW50cykge1xuXHRcdFx0XHRhd2FpdCB3cml0ZVByb21pc2UoZGF0YSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0c3VpdGUoJ1dpbmRvd3MgMTEgKDEwLjAuMjI2MjEuMzQ0NyksIHB3c2ggNy40LjIsIHN0YXJzaGlwIHByb21wdCAxLjEwLjInLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdpbnB1dCB3aXRoIGlnbm9yZWQgZ2hvc3QgdGV4dCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgcmVwbGF5RXZlbnRzKFtcblx0XHRcdFx0XHQnXHUwMDFCWz8yNWxcdTAwMUJbMkpcdTAwMUJbbVx1MDAxQltIXHUwMDFCXTA7QzpcXFxcUHJvZ3JhbSBGaWxlc1xcXFxXaW5kb3dzQXBwc1xcXFxNaWNyb3NvZnQuUG93ZXJTaGVsbF83LjQuMi4wX3g2NF9fOHdla3liM2Q4YmJ3ZVxcXFxwd3NoLmV4ZVx1MDAwN1x1MDAxQls/MjVoJyxcblx0XHRcdFx0XHQnXHUwMDFCWz8yNWxcdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXHUwMDFCW0hcdTAwMUJbPzI1aCcsXG5cdFx0XHRcdFx0J1x1MDAxQl02MzM7UDtJc1dpbmRvd3M9VHJ1ZVx1MDAwNycsXG5cdFx0XHRcdFx0J1x1MDAxQl02MzM7UDtDb250aW51YXRpb25Qcm9tcHQ9XFx4MWJbMzhcXHgzYjVcXHgzYjhtXHUyMjE5XFx4MWJbMG0gXHUwMDA3Jyxcblx0XHRcdFx0XHQnXHUwMDFCXTYzMztBXHUwMDA3XHUwMDFCXTYzMztQO0N3ZD1DOlxceDVjR2l0aHViXFx4NWNtaWNyb3NvZnRcXHg1Y3ZzY29kZVx1MDAwN1x1MDAxQl02MzM7Qlx1MDAwNycsXG5cdFx0XHRcdFx0J1x1MDAxQlszNG1cXHJcXG5cdUUwQjZcdTAwMUJbMzg7MjsxNzsxNzsxN21cdTAwMUJbNDRtMDM6MTM6NDcgXHUwMDFCWzM0bVx1MDAxQls0MW1cdUUwQjAgXHUwMDFCWzM4OzI7MTc7MTc7MTdtdnNjb2RlIFx1MDAxQlszMW1cdTAwMUJbNDNtXHVFMEIwIFx1MDAxQlszODsyOzE3OzE3OzE3bVx1RTBBMCB0eXJpYXIvcHJvbXB0X2lucHV0X21vZGVsIFx1MDAxQlszM21cdTAwMUJbNDZtXHVFMEIwIFx1MDAxQlszODsyOzE3OzE3OzE3bSRcdTIxRTEgXHUwMDFCWzM2bVx1MDAxQls0OW1cdUUwQjAgXHUwMDFCW212aWEgXHUwMDFCWzMybVx1MDAxQlsxbVx1RTcxOCB2MTguMTguMiBcXHJcXG5cdTI3NkZcdTAwMUJbbSAnLFxuXHRcdFx0XHRdKTtcblx0XHRcdFx0ZmlyZUNvbW1hbmRTdGFydCgpO1xuXHRcdFx0XHRhd2FpdCBhc3NlcnRQcm9tcHRJbnB1dCgnfCcpO1xuXG5cdFx0XHRcdGF3YWl0IHJlcGxheUV2ZW50cyhbXG5cdFx0XHRcdFx0J1x1MDAxQls/MjVsXHUwMDFCWzkzbWZcdTAwMUJbOTdtXHUwMDFCWzJtXHUwMDFCWzNtYWtlY29tbWFuZFx1MDAxQlszOzRIXHUwMDFCWz8yNWgnLFxuXHRcdFx0XHRcdCdcdTAwMUJbbScsXG5cdFx0XHRcdFx0J1x1MDAxQls5M21cYmZvXHUwMDFCWzlYJyxcblx0XHRcdFx0XHQnXHUwMDFCW20nLFxuXHRcdFx0XHRcdCdcdTAwMUJbPzI1bFx1MDAxQls5M21cdTAwMUJbMzszSGZvb1x1MDAxQls/MjVoJyxcblx0XHRcdFx0XHQnXHUwMDFCW20nLFxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ2Zvb3wnKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnaW5wdXQgd2l0aCBhY2NlcHRlZCBhbmQgcnVuIGdob3N0IHRleHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHJlcGxheUV2ZW50cyhbXG5cdFx0XHRcdFx0J1x1MDAxQls/MjVsXHUwMDFCWzJKXHUwMDFCW21cdTAwMUJbSFx1MDAxQl0wO0M6XFxcXFByb2dyYW0gRmlsZXNcXFxcV2luZG93c0FwcHNcXFxcTWljcm9zb2Z0LlBvd2VyU2hlbGxfNy40LjIuMF94NjRfXzh3ZWt5YjNkOGJid2VcXFxccHdzaC5leGVcdTAwMDdcdTAwMUJbPzI1aCcsXG5cdFx0XHRcdFx0J1x1MDAxQls/MjVsXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1x1MDAxQltIXHUwMDFCWz8yNWgnLFxuXHRcdFx0XHRcdCdcdTAwMUJdNjMzO1A7SXNXaW5kb3dzPVRydWVcdTAwMDcnLFxuXHRcdFx0XHRcdCdcdTAwMUJdNjMzO1A7Q29udGludWF0aW9uUHJvbXB0PVxceDFiWzM4XFx4M2I1XFx4M2I4bVx1MjIxOVxceDFiWzBtIFx1MDAwNycsXG5cdFx0XHRcdFx0J1x1MDAxQl02MzM7QVx1MDAwN1x1MDAxQl02MzM7UDtDd2Q9QzpcXHg1Y0dpdGh1YlxceDVjbWljcm9zb2Z0XFx4NWN2c2NvZGVcdTAwMDdcdTAwMUJdNjMzO0JcdTAwMDcnLFxuXHRcdFx0XHRcdCdcdTAwMUJbMzRtXFxyXFxuXHVFMEI2XHUwMDFCWzM4OzI7MTc7MTc7MTdtXHUwMDFCWzQ0bTAzOjQxOjM2IFx1MDAxQlszNG1cdTAwMUJbNDFtXHVFMEIwIFx1MDAxQlszODsyOzE3OzE3OzE3bXZzY29kZSBcdTAwMUJbMzFtXHUwMDFCWzQzbVx1RTBCMCBcdTAwMUJbMzg7MjsxNzsxNzsxN21cdUUwQTAgdHlyaWFyL3Byb21wdF9pbnB1dF9tb2RlbCBcdTAwMUJbMzNtXHUwMDFCWzQ2bVx1RTBCMCBcdTAwMUJbMzg7MjsxNzsxNzsxN20kIFx1MDAxQlszNm1cdTAwMUJbNDltXHVFMEIwIFx1MDAxQlttdmlhIFx1MDAxQlszMm1cdTAwMUJbMW1cdUU3MTggdjE4LjE4LjIgXFxyXFxuXHUyNzZGXHUwMDFCW20gJyxcblx0XHRcdFx0XSk7XG5cdFx0XHRcdHByb21wdElucHV0TW9kZWwuc2V0Q29udGludWF0aW9uUHJvbXB0KCdcdTIyMTkgJyk7XG5cdFx0XHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3wnKTtcblxuXHRcdFx0XHRhd2FpdCByZXBsYXlFdmVudHMoW1xuXHRcdFx0XHRcdCdcdTAwMUJbPzI1bFx1MDAxQls5M21lXHUwMDFCWzk3bVx1MDAxQlsybVx1MDAxQlszbWNobyBcImhlbGxvIHdvcmxkXCJcdTAwMUJbMzs0SFx1MDAxQls/MjVoJyxcblx0XHRcdFx0XHQnXHUwMDFCW20nLFxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ2V8W2NobyBcImhlbGxvIHdvcmxkXCJdJyk7XG5cblx0XHRcdFx0YXdhaXQgcmVwbGF5RXZlbnRzKFtcblx0XHRcdFx0XHQnXHUwMDFCWz8yNWxcdTAwMUJbOTNtXGJlY1x1MDAxQls5N21cdTAwMUJbMm1cdTAwMUJbM21obyBcImhlbGxvIHdvcmxkXCJcdTAwMUJbMzs1SFx1MDAxQls/MjVoJyxcblx0XHRcdFx0XHQnXHUwMDFCW20nLFxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ2VjfFtobyBcImhlbGxvIHdvcmxkXCJdJyk7XG5cblx0XHRcdFx0YXdhaXQgcmVwbGF5RXZlbnRzKFtcblx0XHRcdFx0XHQnXHUwMDFCWz8yNWxcdTAwMUJbOTNtXHUwMDFCWzM7M0hlY2hcdTAwMUJbOTdtXHUwMDFCWzJtXHUwMDFCWzNtbyBcImhlbGxvIHdvcmxkXCJcdTAwMUJbMzs2SFx1MDAxQls/MjVoJyxcblx0XHRcdFx0XHQnXHUwMDFCW20nLFxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ2VjaHxbbyBcImhlbGxvIHdvcmxkXCJdJyk7XG5cblx0XHRcdFx0YXdhaXQgcmVwbGF5RXZlbnRzKFtcblx0XHRcdFx0XHQnXHUwMDFCWz8yNWxcdTAwMUJbOTNtXHUwMDFCWzM7M0hlY2hvXHUwMDFCWzk3bVx1MDAxQlsybVx1MDAxQlszbSBcImhlbGxvIHdvcmxkXCJcdTAwMUJbMzs3SFx1MDAxQls/MjVoJyxcblx0XHRcdFx0XHQnXHUwMDFCW20nLFxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ2VjaG98WyBcImhlbGxvIHdvcmxkXCJdJyk7XG5cblx0XHRcdFx0YXdhaXQgcmVwbGF5RXZlbnRzKFtcblx0XHRcdFx0XHQnXHUwMDFCWz8yNWxcdTAwMUJbOTNtXHUwMDFCWzM7M0hlY2hvIFx1MDAxQls5N21cdTAwMUJbMm1cdTAwMUJbM21cImhlbGxvIHdvcmxkXCJcdTAwMUJbMzs4SFx1MDAxQls/MjVoJyxcblx0XHRcdFx0XHQnXHUwMDFCW20nLFxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ2VjaG8gfFtcImhlbGxvIHdvcmxkXCJdJyk7XG5cblx0XHRcdFx0YXdhaXQgcmVwbGF5RXZlbnRzKFtcblx0XHRcdFx0XHQnXHUwMDFCWz8yNWxcdTAwMUJbOTNtXHUwMDFCWzM7M0hlY2hvIFx1MDAxQlszNm1cImhlbGxvIHdvcmxkXCJcdTAwMUJbPzI1aCcsXG5cdFx0XHRcdFx0J1x1MDAxQlttJyxcblx0XHRcdFx0XSk7XG5cdFx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdlY2hvIFwiaGVsbG8gd29ybGRcInwnKTtcblxuXHRcdFx0XHRhd2FpdCByZXBsYXlFdmVudHMoW1xuXHRcdFx0XHRcdCdcdTAwMUJdNjMzO0U7ZWNobyBcImhlbGxvIHdvcmxkXCI7ZmY0NjRkMzktYmM4MC00YmFlLTllYWQtYjFjYWZjNGFkZjZmXHUwMDA3XHUwMDFCXTYzMztDXHUwMDA3Jyxcblx0XHRcdFx0XSk7XG5cdFx0XHRcdGZpcmVDb21tYW5kRXhlY3V0ZWQoKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ2VjaG8gXCJoZWxsbyB3b3JsZFwiJyk7XG5cblx0XHRcdFx0YXdhaXQgcmVwbGF5RXZlbnRzKFtcblx0XHRcdFx0XHQnXFxyXFxuJyxcblx0XHRcdFx0XHQnaGVsbG8gd29ybGRcXHJcXG4nLFxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ2VjaG8gXCJoZWxsbyB3b3JsZFwiJyk7XG5cblx0XHRcdFx0YXdhaXQgcmVwbGF5RXZlbnRzKFtcblx0XHRcdFx0XHQnXHUwMDFCXTYzMztEOzBcdTAwMDdcdTAwMUJdNjMzO0FcdTAwMDdcdTAwMUJdNjMzO1A7Q3dkPUM6XFx4NWNHaXRodWJcXHg1Y21pY3Jvc29mdFxceDVjdnNjb2RlXHUwMDA3XHUwMDFCXTYzMztCXHUwMDA3Jyxcblx0XHRcdFx0XHQnXHUwMDFCWzM0bVxcclxcblx1RTBCNlx1MDAxQlszODsyOzE3OzE3OzE3bVx1MDAxQls0NG0wMzo0MTo0MiBcdTAwMUJbMzRtXHUwMDFCWzQxbVx1RTBCMCBcdTAwMUJbMzg7MjsxNzsxNzsxN212c2NvZGUgXHUwMDFCWzMxbVx1MDAxQls0M21cdUUwQjAgXHUwMDFCWzM4OzI7MTc7MTc7MTdtXHVFMEEwIHR5cmlhci9wcm9tcHRfaW5wdXRfbW9kZWwgXHUwMDFCWzMzbVx1MDAxQls0Nm1cdUUwQjAgXHUwMDFCWzM4OzI7MTc7MTc7MTdtJCBcdTAwMUJbMzZtXHUwMDFCWzQ5bVx1RTBCMCBcdTAwMUJbbXZpYSBcdTAwMUJbMzJtXHUwMDFCWzFtXHVFNzE4IHYxOC4xOC4yIFxcclxcblx1Mjc2Rlx1MDAxQlttICcsXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRmaXJlQ29tbWFuZFN0YXJ0KCk7XG5cdFx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCd8Jyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnaW5wdXQsIGdvIHRvIHN0YXJ0IChjdHJsK2hvbWUpLCBkZWxldGUgd29yZCBpbiBmcm9udCAoY3RybCtkZWxldGUpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCByZXBsYXlFdmVudHMoW1xuXHRcdFx0XHRcdCdcdTAwMUJbPzI1bFx1MDAxQlsySlx1MDAxQlttXHUwMDFCW0hcdTAwMUJdMDtDOlxcUHJvZ3JhbSBGaWxlc1xcV2luZG93c0FwcHNcXE1pY3Jvc29mdC5Qb3dlclNoZWxsXzcuNC4yLjBfeDY0X184d2VreWIzZDhiYndlXFxwd3NoLmV4ZVx1MDAwN1x1MDAxQls/MjVoJyxcblx0XHRcdFx0XHQnXHUwMDFCWz8yNWxcdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXFxyXFxuXHUwMDFCW0tcXHJcXG5cdTAwMUJbS1xcclxcblx1MDAxQltLXHUwMDFCW0hcdTAwMUJbPzI1aCcsXG5cdFx0XHRcdFx0J1x1MDAxQl02MzM7UDtJc1dpbmRvd3M9VHJ1ZVx1MDAwNycsXG5cdFx0XHRcdFx0J1x1MDAxQl02MzM7UDtDb250aW51YXRpb25Qcm9tcHQ9XFx4MWJbMzhcXHgzYjVcXHgzYjhtXHUyMjE5XFx4MWJbMG0gXHUwMDA3Jyxcblx0XHRcdFx0XHQnXHUwMDFCXTYzMztBXHUwMDA3XHUwMDFCXTYzMztQO0N3ZD1DOlxceDVjR2l0aHViXFx4NWNtaWNyb3NvZnRcXHg1Y3ZzY29kZVx1MDAwN1x1MDAxQl02MzM7Qlx1MDAwNycsXG5cdFx0XHRcdFx0J1x1MDAxQlszNG1cXHJcXG5cdUUwQjZcdTAwMUJbMzg7MjsxNzsxNzsxN21cdTAwMUJbNDRtMTY6MDc6MDYgXHUwMDFCWzM0bVx1MDAxQls0MW1cdUUwQjAgXHUwMDFCWzM4OzI7MTc7MTc7MTdtdnNjb2RlIFx1MDAxQlszMW1cdTAwMUJbNDNtXHVFMEIwIFx1MDAxQlszODsyOzE3OzE3OzE3bVx1RTBBMCB0eXJpYXIvMjEwNjYyIFx1MDAxQlszM21cdTAwMUJbNDZtXHVFMEIwIFx1MDAxQlszODsyOzE3OzE3OzE3bSQhIFx1MDAxQlszNm1cdTAwMUJbNDltXHVFMEIwIFx1MDAxQlttdmlhIFx1MDAxQlszMm1cdTAwMUJbMW1cdUU3MTggdjE4LjE4LjIgXFxyXFxuXHUyNzZGXHUwMDFCW20gJyxcblx0XHRcdFx0XSk7XG5cdFx0XHRcdGZpcmVDb21tYW5kU3RhcnQoKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0UHJvbXB0SW5wdXQoJ3wnKTtcblxuXHRcdFx0XHRhd2FpdCByZXBsYXlFdmVudHMoW1xuXHRcdFx0XHRcdCdcdTAwMUJbPzI1bFx1MDAxQls5M21HXHUwMDFCWzk3bVx1MDAxQlsybVx1MDAxQlszbWl0IHB1c2hcdTAwMUJbMzs0SFx1MDAxQls/MjVoJyxcblx0XHRcdFx0XHQnXHUwMDFCW20nLFxuXHRcdFx0XHRcdCdcdTAwMUJbPzI1bFx1MDAxQls5M21cYkdlXHUwMDFCWzk3bVx1MDAxQlsybVx1MDAxQlszbXQtQ2hpbGRJdGVtIC1QYXRoIGFcdTAwMUJbMzs1SFx1MDAxQls/MjVoJyxcblx0XHRcdFx0XHQnXHUwMDFCW20nLFxuXHRcdFx0XHRcdCdcdTAwMUJbPzI1bFx1MDAxQls5M21cdTAwMUJbMzszSEdldFx1MDAxQls5N21cdTAwMUJbMm1cdTAwMUJbM20tQ2hpbGRJdGVtIC1QYXRoIGFcdTAwMUJbMzs2SFx1MDAxQls/MjVoJyxcblx0XHRcdFx0XSk7XG5cdFx0XHRcdGF3YWl0IGFzc2VydFByb21wdElucHV0KCdHZXR8Wy1DaGlsZEl0ZW0gLVBhdGggYV0nKTtcblxuXHRcdFx0XHRhd2FpdCByZXBsYXlFdmVudHMoW1xuXHRcdFx0XHRcdCdcdTAwMUJbbScsXG5cdFx0XHRcdFx0J1x1MDAxQls/MjVsXHUwMDFCWzM7M0hcdTAwMUJbPzI1aCcsXG5cdFx0XHRcdFx0J1x1MDAxQlsyMVgnLFxuXHRcdFx0XHRdKTtcblxuXHRcdFx0XHQvLyBEb24ndCBmb3JjZSBhIHN5bmMsIHRoZSBwcm9tcHQgaW5wdXQgbW9kZWwgc2hvdWxkIHVwZGF0ZSBieSBpdHNlbGZcblx0XHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRcdFx0Y29uc3QgYWN0dWFsVmFsdWVXaXRoQ3Vyc29yID0gcHJvbXB0SW5wdXRNb2RlbC5nZXRDb21iaW5lZFN0cmluZygpO1xuXHRcdFx0XHRzdHJpY3RFcXVhbChcblx0XHRcdFx0XHRhY3R1YWxWYWx1ZVdpdGhDdXJzb3IsXG5cdFx0XHRcdFx0J3wnLnJlcGxhY2VBbGwoJ1xcbicsICdcXHUyM0NFJylcblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx3QkFBcUQ7QUFDOUQsU0FBUyxlQUFlO0FBRXhCLFNBQVMsSUFBSSxvQkFBb0IsbUJBQW1CO0FBQ3BELFNBQVMsZUFBZTtBQUN4QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGtCQUFrQixzQkFBc0I7QUFFakQsTUFBTSxvQkFBb0IsTUFBTTtBQUMvQixRQUFNLFFBQVEsd0NBQXdDO0FBRXRELE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBRUosaUJBQWUsYUFBYSxNQUFjO0FBQ3pDLFVBQU0sSUFBSSxRQUFjLE9BQUssTUFBTSxNQUFNLE1BQU0sQ0FBQyxDQUFDO0FBQUEsRUFDbEQ7QUFFQSxXQUFTLG1CQUFtQjtBQUMzQixtQkFBZSxLQUFLLEVBQUUsUUFBUSxNQUFNLGVBQWUsRUFBRSxDQUFxQjtBQUFBLEVBQzNFO0FBRUEsV0FBUyxzQkFBc0I7QUFDOUIsc0JBQWtCLEtBQUssSUFBSztBQUFBLEVBQzdCO0FBRUEsV0FBUyxzQkFBc0IsUUFBZ0I7QUFDOUMscUJBQWlCLHNCQUFzQixNQUFNO0FBQUEsRUFDOUM7QUFFQSxpQkFBZSxrQkFBa0IsaUJBQXlCO0FBQ3pELFVBQU0sUUFBUSxDQUFDO0FBRWYsUUFBSSxpQkFBaUIsZ0JBQWdCLE1BQU0sQ0FBQyxnQkFBZ0IsU0FBUyxHQUFHLEdBQUc7QUFDMUUsWUFBTSxJQUFJLE1BQU0sNENBQTRDO0FBQUEsSUFDN0Q7QUFFQSxVQUFNLHdCQUF3QixpQkFBaUIsa0JBQWtCO0FBQ2pFO0FBQUEsTUFDQztBQUFBLE1BQ0EsZ0JBQWdCLFdBQVcsTUFBTSxRQUFRO0FBQUEsSUFDMUM7QUFHQSxVQUFNLFFBQVEs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
