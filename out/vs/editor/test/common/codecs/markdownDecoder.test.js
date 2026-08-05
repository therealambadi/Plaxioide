import assert from "assert";
import { TestDecoder } from "../utils/testDecoder.js";
import { Range } from "../../../common/core/range.js";
import { newWriteableStream } from "../../../../base/common/stream.js";
import { Tab } from "../../../common/codecs/simpleCodec/tokens/tab.js";
import { Word } from "../../../common/codecs/simpleCodec/tokens/word.js";
import { Dash } from "../../../common/codecs/simpleCodec/tokens/dash.js";
import { Space } from "../../../common/codecs/simpleCodec/tokens/space.js";
import { NewLine } from "../../../common/codecs/linesCodec/tokens/newLine.js";
import { FormFeed } from "../../../common/codecs/simpleCodec/tokens/formFeed.js";
import { VerticalTab } from "../../../common/codecs/simpleCodec/tokens/verticalTab.js";
import { MarkdownLink } from "../../../common/codecs/markdownCodec/tokens/markdownLink.js";
import { CarriageReturn } from "../../../common/codecs/linesCodec/tokens/carriageReturn.js";
import { MarkdownImage } from "../../../common/codecs/markdownCodec/tokens/markdownImage.js";
import { ExclamationMark } from "../../../common/codecs/simpleCodec/tokens/exclamationMark.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { MarkdownComment } from "../../../common/codecs/markdownCodec/tokens/markdownComment.js";
import { LeftBracket, RightBracket } from "../../../common/codecs/simpleCodec/tokens/brackets.js";
import { MarkdownDecoder } from "../../../common/codecs/markdownCodec/markdownDecoder.js";
import { LeftParenthesis, RightParenthesis } from "../../../common/codecs/simpleCodec/tokens/parentheses.js";
import { LeftAngleBracket, RightAngleBracket } from "../../../common/codecs/simpleCodec/tokens/angleBrackets.js";
class TestMarkdownDecoder extends TestDecoder {
  constructor() {
    const stream = newWriteableStream(null);
    super(stream, new MarkdownDecoder(stream));
  }
}
suite("MarkdownDecoder", () => {
  const testDisposables = ensureNoDisposablesAreLeakedInTestSuite();
  suite("\u2022 general", () => {
    test("\u2022 base cases", async () => {
      const test2 = testDisposables.add(
        new TestMarkdownDecoder()
      );
      await test2.run(
        [
          // basic text
          " hello world",
          // text with markdown link and special characters in the filename
          "how are	 you [caption text](./some/file/path/refer\u{1F3A8}nce.md)?\v",
          // empty line
          "",
          // markdown link with special characters in the link caption and path
          "[(example!)](another/path/with[-and-]-chars/folder)	 ",
          // markdown link `#file` variable in the caption and with absolute path
          "	[#file:something.txt](/absolute/path/to/something.txt)",
          // text with a commented out markdown link
          "\v\f machines must <!-- [computer rights](/do/not/exist) --> suffer"
        ],
        [
          // first line
          new Space(new Range(1, 1, 1, 2)),
          new Word(new Range(1, 2, 1, 7), "hello"),
          new Space(new Range(1, 7, 1, 8)),
          new Word(new Range(1, 8, 1, 13), "world"),
          new NewLine(new Range(1, 13, 1, 14)),
          // second line
          new Word(new Range(2, 1, 2, 4), "how"),
          new Space(new Range(2, 4, 2, 5)),
          new Word(new Range(2, 5, 2, 8), "are"),
          new Tab(new Range(2, 8, 2, 9)),
          new Space(new Range(2, 9, 2, 10)),
          new Word(new Range(2, 10, 2, 13), "you"),
          new Space(new Range(2, 13, 2, 14)),
          new MarkdownLink(2, 14, "[caption text]", "(./some/file/path/refer\u{1F3A8}nce.md)"),
          new Word(new Range(2, 60, 2, 61), "?"),
          new VerticalTab(new Range(2, 61, 2, 62)),
          new NewLine(new Range(2, 62, 2, 63)),
          // third line
          new NewLine(new Range(3, 1, 3, 2)),
          // fourth line
          new MarkdownLink(4, 1, "[(example!)]", "(another/path/with[-and-]-chars/folder)"),
          new Tab(new Range(4, 52, 4, 53)),
          new Space(new Range(4, 53, 4, 54)),
          new NewLine(new Range(4, 54, 4, 55)),
          // fifth line
          new Tab(new Range(5, 1, 5, 2)),
          new MarkdownLink(5, 2, "[#file:something.txt]", "(/absolute/path/to/something.txt)"),
          new NewLine(new Range(5, 56, 5, 57)),
          // sixth line
          new VerticalTab(new Range(6, 1, 6, 2)),
          new FormFeed(new Range(6, 2, 6, 3)),
          new Space(new Range(6, 3, 6, 4)),
          new Word(new Range(6, 4, 6, 12), "machines"),
          new Space(new Range(6, 12, 6, 13)),
          new Word(new Range(6, 13, 6, 17), "must"),
          new Space(new Range(6, 17, 6, 18)),
          new MarkdownComment(new Range(6, 18, 6, 18 + 41), "<!-- [computer rights](/do/not/exist) -->"),
          new Space(new Range(6, 59, 6, 60)),
          new Word(new Range(6, 60, 6, 66), "suffer")
        ]
      );
    });
    test("\u2022 nuanced", async () => {
      const test2 = testDisposables.add(
        new TestMarkdownDecoder()
      );
      const inputLines = [
        // tests that the link caption contain a chat prompt `#file:` reference, while
        // the file path can contain other `graphical characters`
        "\v	[#file:./another/path/to/file.txt](./real/file!path/file\u25C6name.md)",
        // tests that the link file path contain a chat prompt `#file:` reference,
        // `spaces`, `emojies`, and other `graphical characters`
        " [reference \u2218 label](/absolute/pa th/to-#file:file.txt/f\u{1F978}\u26A1\uFE0Fle.md)",
        // tests that link caption and file path can contain `parentheses`, `spaces`, and
        // `emojies`
        "\f[!(hello)!](./w(())rld/nice-\u{1F99A}-filen(a)<me>.git))\n	",
        // tests that the link caption can be empty, while the file path can contain `square brackets`
        "[<test>](./s[]me/pa[h!) "
      ];
      await test2.run(
        inputLines,
        [
          // `1st` line
          new VerticalTab(new Range(1, 1, 1, 2)),
          new Tab(new Range(1, 2, 1, 3)),
          new MarkdownLink(1, 3, "[#file:./another/path/to/file.txt]", "(./real/file!path/file\u25C6name.md)"),
          new NewLine(new Range(1, 68, 1, 69)),
          // `2nd` line
          new Space(new Range(2, 1, 2, 2)),
          new MarkdownLink(2, 2, "[reference \u2218 label]", "(/absolute/pa th/to-#file:file.txt/f\u{1F978}\u26A1\uFE0Fle.md)"),
          new NewLine(new Range(2, 67, 2, 68)),
          // `3rd` line
          new FormFeed(new Range(3, 1, 3, 2)),
          new MarkdownLink(3, 2, "[!(hello)!]", "(./w(())rld/nice-\u{1F99A}-filen(a)<me>.git)"),
          new RightParenthesis(new Range(3, 50, 3, 51)),
          new NewLine(new Range(3, 51, 3, 52)),
          // `4th` line
          new Tab(new Range(4, 1, 4, 2)),
          new NewLine(new Range(4, 2, 4, 3)),
          // `5th` line
          new MarkdownLink(5, 1, "[<test>]", "(./s[]me/pa[h!)"),
          new Space(new Range(5, 24, 5, 25))
        ]
      );
    });
  });
  suite("\u2022 links", () => {
    suite("\u2022 broken", () => {
      test("\u2022 invalid", async () => {
        const test2 = testDisposables.add(
          new TestMarkdownDecoder()
        );
        const inputLines = [
          // incomplete link reference with empty caption
          "[ ](./real/file path/file\u21E7name.md",
          // space between caption and reference is disallowed
          "[link text] (./file path/name.txt)"
        ];
        await test2.run(
          inputLines,
          [
            // `1st` line
            new LeftBracket(new Range(1, 1, 1, 2)),
            new Space(new Range(1, 2, 1, 3)),
            new RightBracket(new Range(1, 3, 1, 4)),
            new LeftParenthesis(new Range(1, 4, 1, 5)),
            new Word(new Range(1, 5, 1, 5 + 11), "./real/file"),
            new Space(new Range(1, 16, 1, 17)),
            new Word(new Range(1, 17, 1, 17 + 17), "path/file\u21E7name.md"),
            new NewLine(new Range(1, 34, 1, 35)),
            // `2nd` line
            new LeftBracket(new Range(2, 1, 2, 2)),
            new Word(new Range(2, 2, 2, 2 + 4), "link"),
            new Space(new Range(2, 6, 2, 7)),
            new Word(new Range(2, 7, 2, 7 + 4), "text"),
            new RightBracket(new Range(2, 11, 2, 12)),
            new Space(new Range(2, 12, 2, 13)),
            new LeftParenthesis(new Range(2, 13, 2, 14)),
            new Word(new Range(2, 14, 2, 14 + 6), "./file"),
            new Space(new Range(2, 20, 2, 21)),
            new Word(new Range(2, 21, 2, 21 + 13), "path/name.txt"),
            new RightParenthesis(new Range(2, 34, 2, 35))
          ]
        );
      });
      suite("\u2022 stop characters inside caption/reference (new lines)", () => {
        for (const stopCharacter of [CarriageReturn, NewLine]) {
          let characterName = "";
          if (stopCharacter === CarriageReturn) {
            characterName = "\\r";
          }
          if (stopCharacter === NewLine) {
            characterName = "\\n";
          }
          assert(
            characterName !== "",
            'The "characterName" must be set, got "empty line".'
          );
          test(`\u2022 stop character - "${characterName}"`, async () => {
            const test2 = testDisposables.add(
              new TestMarkdownDecoder()
            );
            const inputLines = [
              // stop character inside link caption
              `[haa${stopCharacter.symbol}lo\u016F](./real/\u{1F481}/name.txt)`,
              // stop character inside link reference
              `[ref text](/etc/pat${stopCharacter.symbol}h/to/file.md)`,
              // stop character between line caption and link reference is disallowed
              `[text]${stopCharacter.symbol}(/etc/ path/file.md)`
            ];
            await test2.run(
              inputLines,
              [
                // `1st` input line
                new LeftBracket(new Range(1, 1, 1, 2)),
                new Word(new Range(1, 2, 1, 2 + 3), "haa"),
                new stopCharacter(new Range(1, 5, 1, 6)),
                // <- stop character
                new Word(new Range(2, 1, 2, 1 + 3), "lo\u016F"),
                new RightBracket(new Range(2, 4, 2, 5)),
                new LeftParenthesis(new Range(2, 5, 2, 6)),
                new Word(new Range(2, 6, 2, 6 + 18), "./real/\u{1F481}/name.txt"),
                new RightParenthesis(new Range(2, 24, 2, 25)),
                new NewLine(new Range(2, 25, 2, 26)),
                // `2nd` input line
                new LeftBracket(new Range(3, 1, 3, 2)),
                new Word(new Range(3, 2, 3, 2 + 3), "ref"),
                new Space(new Range(3, 5, 3, 6)),
                new Word(new Range(3, 6, 3, 6 + 4), "text"),
                new RightBracket(new Range(3, 10, 3, 11)),
                new LeftParenthesis(new Range(3, 11, 3, 12)),
                new Word(new Range(3, 12, 3, 12 + 8), "/etc/pat"),
                new stopCharacter(new Range(3, 20, 3, 21)),
                // <- stop character
                new Word(new Range(4, 1, 4, 1 + 12), "h/to/file.md"),
                new RightParenthesis(new Range(4, 13, 4, 14)),
                new NewLine(new Range(4, 14, 4, 15)),
                // `3nd` input line
                new LeftBracket(new Range(5, 1, 5, 2)),
                new Word(new Range(5, 2, 5, 2 + 4), "text"),
                new RightBracket(new Range(5, 6, 5, 7)),
                new stopCharacter(new Range(5, 7, 5, 8)),
                // <- stop character
                new LeftParenthesis(new Range(6, 1, 6, 2)),
                new Word(new Range(6, 2, 6, 2 + 5), "/etc/"),
                new Space(new Range(6, 7, 6, 8)),
                new Word(new Range(6, 8, 6, 8 + 12), "path/file.md"),
                new RightParenthesis(new Range(6, 20, 6, 21))
              ]
            );
          });
        }
      });
      suite("\u2022 stop characters inside caption/reference (same line)", () => {
        for (const stopCharacter of [VerticalTab, FormFeed]) {
          let characterName = "";
          if (stopCharacter === VerticalTab) {
            characterName = "\\v";
          }
          if (stopCharacter === FormFeed) {
            characterName = "\\f";
          }
          assert(
            characterName !== "",
            'The "characterName" must be set, got "empty line".'
          );
          test(`\u2022 stop character - "${characterName}"`, async () => {
            const test2 = testDisposables.add(
              new TestMarkdownDecoder()
            );
            const inputLines = [
              // stop character inside link caption
              `[haa${stopCharacter.symbol}lo\u016F](./real/\u{1F481}/name.txt)`,
              // stop character inside link reference
              `[ref text](/etc/pat${stopCharacter.symbol}h/to/file.md)`,
              // stop character between line caption and link reference is disallowed
              `[text]${stopCharacter.symbol}(/etc/ path/file.md)`
            ];
            await test2.run(
              inputLines,
              [
                // `1st` input line
                new LeftBracket(new Range(1, 1, 1, 2)),
                new Word(new Range(1, 2, 1, 2 + 3), "haa"),
                new stopCharacter(new Range(1, 5, 1, 6)),
                // <- stop character
                new Word(new Range(1, 6, 1, 6 + 3), "lo\u016F"),
                new RightBracket(new Range(1, 9, 1, 10)),
                new LeftParenthesis(new Range(1, 10, 1, 11)),
                new Word(new Range(1, 11, 1, 11 + 18), "./real/\u{1F481}/name.txt"),
                new RightParenthesis(new Range(1, 29, 1, 30)),
                new NewLine(new Range(1, 30, 1, 31)),
                // `2nd` input line
                new LeftBracket(new Range(2, 1, 2, 2)),
                new Word(new Range(2, 2, 2, 2 + 3), "ref"),
                new Space(new Range(2, 5, 2, 6)),
                new Word(new Range(2, 6, 2, 6 + 4), "text"),
                new RightBracket(new Range(2, 10, 2, 11)),
                new LeftParenthesis(new Range(2, 11, 2, 12)),
                new Word(new Range(2, 12, 2, 12 + 8), "/etc/pat"),
                new stopCharacter(new Range(2, 20, 2, 21)),
                // <- stop character
                new Word(new Range(2, 21, 2, 21 + 12), "h/to/file.md"),
                new RightParenthesis(new Range(2, 33, 2, 34)),
                new NewLine(new Range(2, 34, 2, 35)),
                // `3nd` input line
                new LeftBracket(new Range(3, 1, 3, 2)),
                new Word(new Range(3, 2, 3, 2 + 4), "text"),
                new RightBracket(new Range(3, 6, 3, 7)),
                new stopCharacter(new Range(3, 7, 3, 8)),
                // <- stop character
                new LeftParenthesis(new Range(3, 8, 3, 9)),
                new Word(new Range(3, 9, 3, 9 + 5), "/etc/"),
                new Space(new Range(3, 14, 3, 15)),
                new Word(new Range(3, 15, 3, 15 + 12), "path/file.md"),
                new RightParenthesis(new Range(3, 27, 3, 28))
              ]
            );
          });
        }
      });
    });
  });
  suite("\u2022 images", () => {
    suite("\u2022 general", () => {
      test("\u2022 base cases", async () => {
        const test2 = testDisposables.add(
          new TestMarkdownDecoder()
        );
        const inputData = [
          "	![alt text](./some/path/to/file.jpg) ",
          "plain text \f![label](./image.png)\v and more text",
          "![](/var/images/default) following text"
        ];
        await test2.run(
          inputData,
          [
            // `1st`
            new Tab(new Range(1, 1, 1, 2)),
            new MarkdownImage(1, 2, "![alt text]", "(./some/path/to/file.jpg)"),
            new Space(new Range(1, 38, 1, 39)),
            new NewLine(new Range(1, 39, 1, 40)),
            // `2nd`
            new Word(new Range(2, 1, 2, 6), "plain"),
            new Space(new Range(2, 6, 2, 7)),
            new Word(new Range(2, 7, 2, 11), "text"),
            new Space(new Range(2, 11, 2, 12)),
            new FormFeed(new Range(2, 12, 2, 13)),
            new MarkdownImage(2, 13, "![label]", "(./image.png)"),
            new VerticalTab(new Range(2, 34, 2, 35)),
            new Space(new Range(2, 35, 2, 36)),
            new Word(new Range(2, 36, 2, 39), "and"),
            new Space(new Range(2, 39, 2, 40)),
            new Word(new Range(2, 40, 2, 44), "more"),
            new Space(new Range(2, 44, 2, 45)),
            new Word(new Range(2, 45, 2, 49), "text"),
            new NewLine(new Range(2, 49, 2, 50)),
            // `3rd`
            new MarkdownImage(3, 1, "![]", "(/var/images/default)"),
            new Space(new Range(3, 25, 3, 26)),
            new Word(new Range(3, 26, 3, 35), "following"),
            new Space(new Range(3, 35, 3, 36)),
            new Word(new Range(3, 36, 3, 40), "text")
          ]
        );
      });
      test("\u2022 nuanced", async () => {
        const test2 = testDisposables.add(
          new TestMarkdownDecoder()
        );
        const inputData = [
          "	![<!-- comment -->](./s\u263Bme/path/to/file.jpeg) ",
          "raw text \f![(/1.png)](./image-\u{1F978}.png)\v and more text"
          // '![](/var/images/default) following text',
        ];
        await test2.run(
          inputData,
          [
            // `1st`
            new Tab(new Range(1, 1, 1, 2)),
            new MarkdownImage(1, 2, "![<!-- comment -->]", "(./s\u263Bme/path/to/file.jpeg)"),
            new Space(new Range(1, 47, 1, 48)),
            new NewLine(new Range(1, 48, 1, 49)),
            // `2nd`
            new Word(new Range(2, 1, 2, 4), "raw"),
            new Space(new Range(2, 4, 2, 5)),
            new Word(new Range(2, 5, 2, 9), "text"),
            new Space(new Range(2, 9, 2, 10)),
            new FormFeed(new Range(2, 10, 2, 11)),
            new MarkdownImage(2, 11, "![(/1.png)]", "(./image-\u{1F978}.png)"),
            new VerticalTab(new Range(2, 38, 2, 39)),
            new Space(new Range(2, 39, 2, 40)),
            new Word(new Range(2, 40, 2, 43), "and"),
            new Space(new Range(2, 43, 2, 44)),
            new Word(new Range(2, 44, 2, 48), "more"),
            new Space(new Range(2, 48, 2, 49)),
            new Word(new Range(2, 49, 2, 53), "text")
          ]
        );
      });
    });
    suite("\u2022 broken", () => {
      test("\u2022 invalid", async () => {
        const test2 = testDisposables.add(
          new TestMarkdownDecoder()
        );
        const inputLines = [
          // incomplete link reference with empty caption
          "![ ](./real/file path/file\u2605name.webp",
          // space between caption and reference is disallowed
          "\f![link text] (./file path/name.jpg)",
          // new line inside the link reference
          "\v![ ](./file\npath/name.jpg )"
        ];
        await test2.run(
          inputLines,
          [
            // `1st` line
            new ExclamationMark(new Range(1, 1, 1, 2)),
            new LeftBracket(new Range(1, 2, 1, 3)),
            new Space(new Range(1, 3, 1, 4)),
            new RightBracket(new Range(1, 4, 1, 5)),
            new LeftParenthesis(new Range(1, 5, 1, 6)),
            new Word(new Range(1, 6, 1, 6 + 11), "./real/file"),
            new Space(new Range(1, 17, 1, 18)),
            new Word(new Range(1, 18, 1, 18 + 19), "path/file\u2605name.webp"),
            new NewLine(new Range(1, 37, 1, 38)),
            // `2nd` line
            new FormFeed(new Range(2, 1, 2, 2)),
            new ExclamationMark(new Range(2, 2, 2, 3)),
            new LeftBracket(new Range(2, 3, 2, 4)),
            new Word(new Range(2, 4, 2, 4 + 4), "link"),
            new Space(new Range(2, 8, 2, 9)),
            new Word(new Range(2, 9, 2, 9 + 4), "text"),
            new RightBracket(new Range(2, 13, 2, 14)),
            new Space(new Range(2, 14, 2, 15)),
            new LeftParenthesis(new Range(2, 15, 2, 16)),
            new Word(new Range(2, 16, 2, 16 + 6), "./file"),
            new Space(new Range(2, 22, 2, 23)),
            new Word(new Range(2, 23, 2, 23 + 13), "path/name.jpg"),
            new RightParenthesis(new Range(2, 36, 2, 37)),
            new NewLine(new Range(2, 37, 2, 38)),
            // `3rd` line
            new VerticalTab(new Range(3, 1, 3, 2)),
            new ExclamationMark(new Range(3, 2, 3, 3)),
            new LeftBracket(new Range(3, 3, 3, 4)),
            new Space(new Range(3, 4, 3, 5)),
            new RightBracket(new Range(3, 5, 3, 6)),
            new LeftParenthesis(new Range(3, 6, 3, 7)),
            new Word(new Range(3, 7, 3, 7 + 6), "./file"),
            new NewLine(new Range(3, 13, 3, 14)),
            new Word(new Range(4, 1, 4, 1 + 13), "path/name.jpg"),
            new Space(new Range(4, 14, 4, 15)),
            new RightParenthesis(new Range(4, 15, 4, 16))
          ]
        );
      });
      suite("\u2022 stop characters inside caption/reference (new lines)", () => {
        for (const stopCharacter of [CarriageReturn, NewLine]) {
          let characterName = "";
          if (stopCharacter === CarriageReturn) {
            characterName = "\\r";
          }
          if (stopCharacter === NewLine) {
            characterName = "\\n";
          }
          assert(
            characterName !== "",
            'The "characterName" must be set, got "empty line".'
          );
          test(`\u2022 stop character - "${characterName}"`, async () => {
            const test2 = testDisposables.add(
              new TestMarkdownDecoder()
            );
            const inputLines = [
              // stop character inside link caption
              `![haa${stopCharacter.symbol}lo\u016F](./real/\u{1F481}/name.png)`,
              // stop character inside link reference
              `![ref text](/etc/pat${stopCharacter.symbol}h/to/file.webp)`,
              // stop character between line caption and link reference is disallowed
              `![text]${stopCharacter.symbol}(/etc/ path/file.jpeg)`
            ];
            await test2.run(
              inputLines,
              [
                // `1st` input line
                new ExclamationMark(new Range(1, 1, 1, 2)),
                new LeftBracket(new Range(1, 2, 1, 3)),
                new Word(new Range(1, 3, 1, 3 + 3), "haa"),
                new stopCharacter(new Range(1, 6, 1, 7)),
                // <- stop character
                new Word(new Range(2, 1, 2, 1 + 3), "lo\u016F"),
                new RightBracket(new Range(2, 4, 2, 5)),
                new LeftParenthesis(new Range(2, 5, 2, 6)),
                new Word(new Range(2, 6, 2, 6 + 18), "./real/\u{1F481}/name.png"),
                new RightParenthesis(new Range(2, 24, 2, 25)),
                new NewLine(new Range(2, 25, 2, 26)),
                // `2nd` input line
                new ExclamationMark(new Range(3, 1, 3, 2)),
                new LeftBracket(new Range(3, 2, 3, 3)),
                new Word(new Range(3, 3, 3, 3 + 3), "ref"),
                new Space(new Range(3, 6, 3, 7)),
                new Word(new Range(3, 7, 3, 7 + 4), "text"),
                new RightBracket(new Range(3, 11, 3, 12)),
                new LeftParenthesis(new Range(3, 12, 3, 13)),
                new Word(new Range(3, 13, 3, 13 + 8), "/etc/pat"),
                new stopCharacter(new Range(3, 21, 3, 22)),
                // <- stop character
                new Word(new Range(4, 1, 4, 1 + 14), "h/to/file.webp"),
                new RightParenthesis(new Range(4, 15, 4, 16)),
                new NewLine(new Range(4, 16, 4, 17)),
                // `3nd` input line
                new ExclamationMark(new Range(5, 1, 5, 2)),
                new LeftBracket(new Range(5, 2, 5, 3)),
                new Word(new Range(5, 3, 5, 3 + 4), "text"),
                new RightBracket(new Range(5, 7, 5, 8)),
                new stopCharacter(new Range(5, 8, 5, 9)),
                // <- stop character
                new LeftParenthesis(new Range(6, 1, 6, 2)),
                new Word(new Range(6, 2, 6, 2 + 5), "/etc/"),
                new Space(new Range(6, 7, 6, 8)),
                new Word(new Range(6, 8, 6, 8 + 14), "path/file.jpeg"),
                new RightParenthesis(new Range(6, 22, 6, 23))
              ]
            );
          });
        }
      });
      suite("\u2022 stop characters inside caption/reference (same line)", () => {
        for (const stopCharacter of [VerticalTab, FormFeed]) {
          let characterName = "";
          if (stopCharacter === VerticalTab) {
            characterName = "\\v";
          }
          if (stopCharacter === FormFeed) {
            characterName = "\\f";
          }
          assert(
            characterName !== "",
            'The "characterName" must be set, got "empty line".'
          );
          test(`\u2022 stop character - "${characterName}"`, async () => {
            const test2 = testDisposables.add(
              new TestMarkdownDecoder()
            );
            const inputLines = [
              // stop character inside link caption
              `![haa${stopCharacter.symbol}lo\u016F](./real/\u{1F481}/name)`,
              // stop character inside link reference
              `![ref text](/etc/pat${stopCharacter.symbol}h/to/file.webp)`,
              // stop character between line caption and link reference is disallowed
              `![text]${stopCharacter.symbol}(/etc/ path/image.gif)`
            ];
            await test2.run(
              inputLines,
              [
                // `1st` input line
                new ExclamationMark(new Range(1, 1, 1, 2)),
                new LeftBracket(new Range(1, 2, 1, 3)),
                new Word(new Range(1, 3, 1, 3 + 3), "haa"),
                new stopCharacter(new Range(1, 6, 1, 7)),
                // <- stop character
                new Word(new Range(1, 7, 1, 7 + 3), "lo\u016F"),
                new RightBracket(new Range(1, 10, 1, 11)),
                new LeftParenthesis(new Range(1, 11, 1, 12)),
                new Word(new Range(1, 12, 1, 12 + 14), "./real/\u{1F481}/name"),
                new RightParenthesis(new Range(1, 26, 1, 27)),
                new NewLine(new Range(1, 27, 1, 28)),
                // `2nd` input line
                new ExclamationMark(new Range(2, 1, 2, 2)),
                new LeftBracket(new Range(2, 2, 2, 3)),
                new Word(new Range(2, 3, 2, 3 + 3), "ref"),
                new Space(new Range(2, 6, 2, 7)),
                new Word(new Range(2, 7, 2, 7 + 4), "text"),
                new RightBracket(new Range(2, 11, 2, 12)),
                new LeftParenthesis(new Range(2, 12, 2, 13)),
                new Word(new Range(2, 13, 2, 13 + 8), "/etc/pat"),
                new stopCharacter(new Range(2, 21, 2, 22)),
                // <- stop character
                new Word(new Range(2, 22, 2, 22 + 14), "h/to/file.webp"),
                new RightParenthesis(new Range(2, 36, 2, 37)),
                new NewLine(new Range(2, 37, 2, 38)),
                // `3nd` input line
                new ExclamationMark(new Range(3, 1, 3, 2)),
                new LeftBracket(new Range(3, 2, 3, 3)),
                new Word(new Range(3, 3, 3, 3 + 4), "text"),
                new RightBracket(new Range(3, 7, 3, 8)),
                new stopCharacter(new Range(3, 8, 3, 9)),
                // <- stop character
                new LeftParenthesis(new Range(3, 9, 3, 10)),
                new Word(new Range(3, 10, 3, 10 + 5), "/etc/"),
                new Space(new Range(3, 15, 3, 16)),
                new Word(new Range(3, 16, 3, 16 + 14), "path/image.gif"),
                new RightParenthesis(new Range(3, 30, 3, 31))
              ]
            );
          });
        }
      });
    });
  });
  suite("\u2022 comments", () => {
    suite("\u2022 general", () => {
      test("\u2022 base cases", async () => {
        const test2 = testDisposables.add(
          new TestMarkdownDecoder()
        );
        const inputData = [
          // comment with text inside it
          "	<!-- hello world -->",
          // comment with a link inside
          "some text<!-- \v[link label](/some/path/to/file.md)\f --> and more text ",
          // comment new lines inside it
          "<!-- comment\r\ntext\n\ngoes here --> usual text follows",
          // an empty comment
          "	<!---->	",
          // comment that was not closed properly
          "haalo	<!-- [link label](/some/path/to/file.md)"
        ];
        await test2.run(
          inputData,
          [
            // `1st`
            new Tab(new Range(1, 1, 1, 2)),
            new MarkdownComment(new Range(1, 2, 1, 2 + 20), "<!-- hello world -->"),
            new NewLine(new Range(1, 22, 1, 23)),
            // `2nd`
            new Word(new Range(2, 1, 2, 5), "some"),
            new Space(new Range(2, 5, 2, 6)),
            new Word(new Range(2, 6, 2, 10), "text"),
            new MarkdownComment(new Range(2, 10, 2, 10 + 46), "<!-- \v[link label](/some/path/to/file.md)\f -->"),
            new Space(new Range(2, 56, 2, 57)),
            new Word(new Range(2, 57, 2, 60), "and"),
            new Space(new Range(2, 60, 2, 61)),
            new Word(new Range(2, 61, 2, 65), "more"),
            new Space(new Range(2, 65, 2, 66)),
            new Word(new Range(2, 66, 2, 70), "text"),
            new Space(new Range(2, 70, 2, 71)),
            new NewLine(new Range(2, 71, 2, 72)),
            // `3rd`
            new MarkdownComment(new Range(3, 1, 3 + 3, 1 + 13), "<!-- comment\r\ntext\n\ngoes here -->"),
            new Space(new Range(6, 14, 6, 15)),
            new Word(new Range(6, 15, 6, 15 + 5), "usual"),
            new Space(new Range(6, 20, 6, 21)),
            new Word(new Range(6, 21, 6, 21 + 4), "text"),
            new Space(new Range(6, 25, 6, 26)),
            new Word(new Range(6, 26, 6, 26 + 7), "follows"),
            new NewLine(new Range(6, 33, 6, 34)),
            // `4rd`
            new Tab(new Range(7, 1, 7, 2)),
            new MarkdownComment(new Range(7, 2, 7, 2 + 7), "<!---->"),
            new Tab(new Range(7, 9, 7, 10)),
            new NewLine(new Range(7, 10, 7, 11)),
            // `5th`
            new Word(new Range(8, 1, 8, 6), "haalo"),
            new Tab(new Range(8, 6, 8, 7)),
            new MarkdownComment(new Range(8, 7, 8, 7 + 40), "<!-- [link label](/some/path/to/file.md)")
          ]
        );
      });
      test("\u2022 nuanced", async () => {
        const test2 = testDisposables.add(
          new TestMarkdownDecoder()
        );
        const inputData = [
          // comment inside `<>` brackets
          " \f <<!--commen	-->>",
          // comment contains `<[]>` brackets and `!`
          "<!--<[!c\u26BD\uFE0Emment!]>-->		",
          // comment contains `<!--` and new lines
          "\v<!--some\r\ntext\n	<!--inner\r\ntext-->		",
          // comment contains `<!--` and never closed properly
          " <!--<!--inner\r\ntext-- >	\v\f "
        ];
        await test2.run(
          inputData,
          [
            // `1st`
            new Space(new Range(1, 1, 1, 2)),
            new FormFeed(new Range(1, 2, 1, 3)),
            new Space(new Range(1, 3, 1, 4)),
            new LeftAngleBracket(new Range(1, 4, 1, 5)),
            new MarkdownComment(new Range(1, 5, 1, 5 + 14), "<!--commen	-->"),
            new RightAngleBracket(new Range(1, 19, 1, 20)),
            new NewLine(new Range(1, 20, 1, 21)),
            // `2nd`
            new MarkdownComment(new Range(2, 1, 2, 1 + 21), "<!--<[!c\u26BD\uFE0Emment!]>-->"),
            new Tab(new Range(2, 22, 2, 23)),
            new Tab(new Range(2, 23, 2, 24)),
            new NewLine(new Range(2, 24, 2, 25)),
            // `3rd`
            new VerticalTab(new Range(3, 1, 3, 2)),
            new MarkdownComment(new Range(3, 2, 3 + 3, 1 + 7), "<!--some\r\ntext\n	<!--inner\r\ntext-->"),
            new Tab(new Range(6, 8, 6, 9)),
            new Tab(new Range(6, 9, 6, 10)),
            new NewLine(new Range(6, 10, 6, 11)),
            // `4rd`
            new Space(new Range(7, 1, 7, 2)),
            // note! comment does not have correct closing `-->`, hence the comment extends
            //       to the end of the text, and therefore includes the \t\v\f and space at the end
            new MarkdownComment(new Range(7, 2, 8, 1 + 12), "<!--<!--inner\r\ntext-- >	\v\f ")
          ]
        );
      });
    });
    test("\u2022 invalid", async () => {
      const test2 = testDisposables.add(
        new TestMarkdownDecoder()
      );
      const inputData = [
        "	<! -- mondo --> ",
        " < !-- \u0441\u0432\u0456\u0442 -->	",
        "\v<!- - terra -->\f",
        "<!--mundo - -> "
      ];
      await test2.run(
        inputData,
        [
          // `1st`
          new Tab(new Range(1, 1, 1, 2)),
          new LeftAngleBracket(new Range(1, 2, 1, 3)),
          new ExclamationMark(new Range(1, 3, 1, 4)),
          new Space(new Range(1, 4, 1, 5)),
          new Dash(new Range(1, 5, 1, 6)),
          new Dash(new Range(1, 6, 1, 7)),
          new Space(new Range(1, 7, 1, 8)),
          new Word(new Range(1, 8, 1, 8 + 5), "mondo"),
          new Space(new Range(1, 13, 1, 14)),
          new Dash(new Range(1, 14, 1, 15)),
          new Dash(new Range(1, 15, 1, 16)),
          new RightAngleBracket(new Range(1, 16, 1, 17)),
          new Space(new Range(1, 17, 1, 18)),
          new NewLine(new Range(1, 18, 1, 19)),
          // `2nd`
          new Space(new Range(2, 1, 2, 2)),
          new LeftAngleBracket(new Range(2, 2, 2, 3)),
          new Space(new Range(2, 3, 2, 4)),
          new ExclamationMark(new Range(2, 4, 2, 5)),
          new Dash(new Range(2, 5, 2, 6)),
          new Dash(new Range(2, 6, 2, 7)),
          new Space(new Range(2, 7, 2, 8)),
          new Word(new Range(2, 8, 2, 8 + 4), "\u0441\u0432\u0456\u0442"),
          new Space(new Range(2, 12, 2, 13)),
          new Dash(new Range(2, 13, 2, 14)),
          new Dash(new Range(2, 14, 2, 15)),
          new RightAngleBracket(new Range(2, 15, 2, 16)),
          new Tab(new Range(2, 16, 2, 17)),
          new NewLine(new Range(2, 17, 2, 18)),
          // `3rd`
          new VerticalTab(new Range(3, 1, 3, 2)),
          new LeftAngleBracket(new Range(3, 2, 3, 3)),
          new ExclamationMark(new Range(3, 3, 3, 4)),
          new Dash(new Range(3, 4, 3, 5)),
          new Space(new Range(3, 5, 3, 6)),
          new Dash(new Range(3, 6, 3, 7)),
          new Space(new Range(3, 7, 3, 8)),
          new Word(new Range(3, 8, 3, 8 + 5), "terra"),
          new Space(new Range(3, 13, 3, 14)),
          new Dash(new Range(3, 14, 3, 15)),
          new Dash(new Range(3, 15, 3, 16)),
          new RightAngleBracket(new Range(3, 16, 3, 17)),
          new FormFeed(new Range(3, 17, 3, 18)),
          new NewLine(new Range(3, 18, 3, 19)),
          // `4rd`
          // note! comment does not have correct closing `-->`, hence the comment extends
          //       to the end of the text, and therefore includes the `space` at the end
          new MarkdownComment(new Range(4, 1, 4, 1 + 15), "<!--mundo - -> ")
        ]
      );
    });
  });
});
export {
  TestMarkdownDecoder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vY29kZWNzL21hcmtkb3duRGVjb2Rlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgVGVzdERlY29kZXIgfSBmcm9tICcuLi91dGlscy90ZXN0RGVjb2Rlci5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IG5ld1dyaXRlYWJsZVN0cmVhbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmVhbS5qcyc7XG5pbXBvcnQgeyBUYWIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29kZWNzL3NpbXBsZUNvZGVjL3Rva2Vucy90YWIuanMnO1xuaW1wb3J0IHsgV29yZCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb2RlY3Mvc2ltcGxlQ29kZWMvdG9rZW5zL3dvcmQuanMnO1xuaW1wb3J0IHsgRGFzaCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb2RlY3Mvc2ltcGxlQ29kZWMvdG9rZW5zL2Rhc2guanMnO1xuaW1wb3J0IHsgU3BhY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29kZWNzL3NpbXBsZUNvZGVjL3Rva2Vucy9zcGFjZS5qcyc7XG5pbXBvcnQgeyBOZXdMaW5lIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvZGVjcy9saW5lc0NvZGVjL3Rva2Vucy9uZXdMaW5lLmpzJztcbmltcG9ydCB7IEZvcm1GZWVkIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvZGVjcy9zaW1wbGVDb2RlYy90b2tlbnMvZm9ybUZlZWQuanMnO1xuaW1wb3J0IHsgVmVydGljYWxUYWIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29kZWNzL3NpbXBsZUNvZGVjL3Rva2Vucy92ZXJ0aWNhbFRhYi5qcyc7XG5pbXBvcnQgeyBNYXJrZG93bkxpbmsgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29kZWNzL21hcmtkb3duQ29kZWMvdG9rZW5zL21hcmtkb3duTGluay5qcyc7XG5pbXBvcnQgeyBDYXJyaWFnZVJldHVybiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb2RlY3MvbGluZXNDb2RlYy90b2tlbnMvY2FycmlhZ2VSZXR1cm4uanMnO1xuaW1wb3J0IHsgTWFya2Rvd25JbWFnZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb2RlY3MvbWFya2Rvd25Db2RlYy90b2tlbnMvbWFya2Rvd25JbWFnZS5qcyc7XG5pbXBvcnQgeyBFeGNsYW1hdGlvbk1hcmsgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29kZWNzL3NpbXBsZUNvZGVjL3Rva2Vucy9leGNsYW1hdGlvbk1hcmsuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBNYXJrZG93bkNvbW1lbnQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29kZWNzL21hcmtkb3duQ29kZWMvdG9rZW5zL21hcmtkb3duQ29tbWVudC5qcyc7XG5pbXBvcnQgeyBMZWZ0QnJhY2tldCwgUmlnaHRCcmFja2V0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvZGVjcy9zaW1wbGVDb2RlYy90b2tlbnMvYnJhY2tldHMuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25EZWNvZGVyLCBUTWFya2Rvd25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb2RlY3MvbWFya2Rvd25Db2RlYy9tYXJrZG93bkRlY29kZXIuanMnO1xuaW1wb3J0IHsgTGVmdFBhcmVudGhlc2lzLCBSaWdodFBhcmVudGhlc2lzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvZGVjcy9zaW1wbGVDb2RlYy90b2tlbnMvcGFyZW50aGVzZXMuanMnO1xuaW1wb3J0IHsgTGVmdEFuZ2xlQnJhY2tldCwgUmlnaHRBbmdsZUJyYWNrZXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29kZWNzL3NpbXBsZUNvZGVjL3Rva2Vucy9hbmdsZUJyYWNrZXRzLmpzJztcblxuLyoqXG4gKiBBIHJldXNhYmxlIHRlc3QgdXRpbGl0eSB0aGF0IGFzc2VydHMgdGhhdCBhIGBUZXN0TWFya2Rvd25EZWNvZGVyYCBpbnN0YW5jZVxuICogY29ycmVjdGx5IGRlY29kZXMgYGlucHV0RGF0YWAgaW50byBhIHN0cmVhbSBvZiBgVE1hcmtkb3duVG9rZW5gIHRva2Vucy5cbiAqXG4gKiAjIyBFeGFtcGxlc1xuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIGNyZWF0ZSBhIG5ldyB0ZXN0IHV0aWxpdHkgaW5zdGFuY2VcbiAqIGNvbnN0IHRlc3QgPSB0ZXN0RGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TWFya2Rvd25EZWNvZGVyKCkpO1xuICpcbiAqIC8vIHJ1biB0aGUgdGVzdFxuICogYXdhaXQgdGVzdC5ydW4oXG4gKiAgICcgaGVsbG8gW3dvcmxkXSgvZXRjL2hvc3RzKSEnLFxuICogICBbXG4gKiAgICAgbmV3IFNwYWNlKG5ldyBSYW5nZSgxLCAxLCAxLCAyKSksXG4gKiAgICAgbmV3IFdvcmQobmV3IFJhbmdlKDEsIDIsIDEsIDcpLCAnaGVsbG8nKSxcbiAqICAgICBuZXcgU3BhY2UobmV3IFJhbmdlKDEsIDcsIDEsIDgpKSxcbiAqICAgICBuZXcgTWFya2Rvd25MaW5rKDEsIDgsICdbd29ybGRdJywgJygvZXRjL2hvc3RzKScpLFxuICogICAgIG5ldyBXb3JkKG5ldyBSYW5nZSgxLCAyNywgMSwgMjgpLCAnIScpLFxuICogICAgIG5ldyBOZXdMaW5lKG5ldyBSYW5nZSgxLCAyOCwgMSwgMjkpKSxcbiAqICAgXSxcbiAqICk7XG4gKi9cbmV4cG9ydCBjbGFzcyBUZXN0TWFya2Rvd25EZWNvZGVyIGV4dGVuZHMgVGVzdERlY29kZXI8VE1hcmtkb3duVG9rZW4sIE1hcmtkb3duRGVjb2Rlcj4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBzdHJlYW0gPSBuZXdXcml0ZWFibGVTdHJlYW08VlNCdWZmZXI+KG51bGwpO1xuXG5cdFx0c3VwZXIoc3RyZWFtLCBuZXcgTWFya2Rvd25EZWNvZGVyKHN0cmVhbSkpO1xuXHR9XG59XG5cbnN1aXRlKCdNYXJrZG93bkRlY29kZXInLCAoKSA9PiB7XG5cdGNvbnN0IHRlc3REaXNwb3NhYmxlcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHN1aXRlKCdcdTIwMjIgZ2VuZXJhbCcsICgpID0+IHtcblx0XHR0ZXN0KCdcdTIwMjIgYmFzZSBjYXNlcycsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3QgPSB0ZXN0RGlzcG9zYWJsZXMuYWRkKFxuXHRcdFx0XHRuZXcgVGVzdE1hcmtkb3duRGVjb2RlcigpLFxuXHRcdFx0KTtcblxuXHRcdFx0YXdhaXQgdGVzdC5ydW4oXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQvLyBiYXNpYyB0ZXh0XG5cdFx0XHRcdFx0JyBoZWxsbyB3b3JsZCcsXG5cdFx0XHRcdFx0Ly8gdGV4dCB3aXRoIG1hcmtkb3duIGxpbmsgYW5kIHNwZWNpYWwgY2hhcmFjdGVycyBpbiB0aGUgZmlsZW5hbWVcblx0XHRcdFx0XHQnaG93IGFyZVxcdCB5b3UgW2NhcHRpb24gdGV4dF0oLi9zb21lL2ZpbGUvcGF0aC9yZWZlclx1RDgzQ1x1REZBOG5jZS5tZCk/XFx2Jyxcblx0XHRcdFx0XHQvLyBlbXB0eSBsaW5lXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0Ly8gbWFya2Rvd24gbGluayB3aXRoIHNwZWNpYWwgY2hhcmFjdGVycyBpbiB0aGUgbGluayBjYXB0aW9uIGFuZCBwYXRoXG5cdFx0XHRcdFx0J1soZXhhbXBsZSEpXShhbm90aGVyL3BhdGgvd2l0aFstYW5kLV0tY2hhcnMvZm9sZGVyKVxcdCAnLFxuXHRcdFx0XHRcdC8vIG1hcmtkb3duIGxpbmsgYCNmaWxlYCB2YXJpYWJsZSBpbiB0aGUgY2FwdGlvbiBhbmQgd2l0aCBhYnNvbHV0ZSBwYXRoXG5cdFx0XHRcdFx0J1xcdFsjZmlsZTpzb21ldGhpbmcudHh0XSgvYWJzb2x1dGUvcGF0aC90by9zb21ldGhpbmcudHh0KScsXG5cdFx0XHRcdFx0Ly8gdGV4dCB3aXRoIGEgY29tbWVudGVkIG91dCBtYXJrZG93biBsaW5rXG5cdFx0XHRcdFx0J1xcdlxcZiBtYWNoaW5lcyBtdXN0IDwhLS0gW2NvbXB1dGVyIHJpZ2h0c10oL2RvL25vdC9leGlzdCkgLS0+IHN1ZmZlcicsXG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQvLyBmaXJzdCBsaW5lXG5cdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgxLCAxLCAxLCAyKSksXG5cdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDEsIDIsIDEsIDcpLCAnaGVsbG8nKSxcblx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDEsIDcsIDEsIDgpKSxcblx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMSwgOCwgMSwgMTMpLCAnd29ybGQnKSxcblx0XHRcdFx0XHRuZXcgTmV3TGluZShuZXcgUmFuZ2UoMSwgMTMsIDEsIDE0KSksXG5cdFx0XHRcdFx0Ly8gc2Vjb25kIGxpbmVcblx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgMSwgMiwgNCksICdob3cnKSxcblx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDIsIDQsIDIsIDUpKSxcblx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgNSwgMiwgOCksICdhcmUnKSxcblx0XHRcdFx0XHRuZXcgVGFiKG5ldyBSYW5nZSgyLCA4LCAyLCA5KSksXG5cdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCA5LCAyLCAxMCkpLFxuXHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgyLCAxMCwgMiwgMTMpLCAneW91JyksXG5cdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCAxMywgMiwgMTQpKSxcblx0XHRcdFx0XHRuZXcgTWFya2Rvd25MaW5rKDIsIDE0LCAnW2NhcHRpb24gdGV4dF0nLCAnKC4vc29tZS9maWxlL3BhdGgvcmVmZXJcdUQ4M0NcdURGQThuY2UubWQpJyksXG5cdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDIsIDYwLCAyLCA2MSksICc/JyksXG5cdFx0XHRcdFx0bmV3IFZlcnRpY2FsVGFiKG5ldyBSYW5nZSgyLCA2MSwgMiwgNjIpKSxcblx0XHRcdFx0XHRuZXcgTmV3TGluZShuZXcgUmFuZ2UoMiwgNjIsIDIsIDYzKSksXG5cdFx0XHRcdFx0Ly8gdGhpcmQgbGluZVxuXHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSgzLCAxLCAzLCAyKSksXG5cdFx0XHRcdFx0Ly8gZm91cnRoIGxpbmVcblx0XHRcdFx0XHRuZXcgTWFya2Rvd25MaW5rKDQsIDEsICdbKGV4YW1wbGUhKV0nLCAnKGFub3RoZXIvcGF0aC93aXRoWy1hbmQtXS1jaGFycy9mb2xkZXIpJyksXG5cdFx0XHRcdFx0bmV3IFRhYihuZXcgUmFuZ2UoNCwgNTIsIDQsIDUzKSksXG5cdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSg0LCA1MywgNCwgNTQpKSxcblx0XHRcdFx0XHRuZXcgTmV3TGluZShuZXcgUmFuZ2UoNCwgNTQsIDQsIDU1KSksXG5cdFx0XHRcdFx0Ly8gZmlmdGggbGluZVxuXHRcdFx0XHRcdG5ldyBUYWIobmV3IFJhbmdlKDUsIDEsIDUsIDIpKSxcblx0XHRcdFx0XHRuZXcgTWFya2Rvd25MaW5rKDUsIDIsICdbI2ZpbGU6c29tZXRoaW5nLnR4dF0nLCAnKC9hYnNvbHV0ZS9wYXRoL3RvL3NvbWV0aGluZy50eHQpJyksXG5cdFx0XHRcdFx0bmV3IE5ld0xpbmUobmV3IFJhbmdlKDUsIDU2LCA1LCA1NykpLFxuXHRcdFx0XHRcdC8vIHNpeHRoIGxpbmVcblx0XHRcdFx0XHRuZXcgVmVydGljYWxUYWIobmV3IFJhbmdlKDYsIDEsIDYsIDIpKSxcblx0XHRcdFx0XHRuZXcgRm9ybUZlZWQobmV3IFJhbmdlKDYsIDIsIDYsIDMpKSxcblx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDYsIDMsIDYsIDQpKSxcblx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoNiwgNCwgNiwgMTIpLCAnbWFjaGluZXMnKSxcblx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDYsIDEyLCA2LCAxMykpLFxuXHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSg2LCAxMywgNiwgMTcpLCAnbXVzdCcpLFxuXHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoNiwgMTcsIDYsIDE4KSksXG5cdFx0XHRcdFx0bmV3IE1hcmtkb3duQ29tbWVudChuZXcgUmFuZ2UoNiwgMTgsIDYsIDE4ICsgNDEpLCAnPCEtLSBbY29tcHV0ZXIgcmlnaHRzXSgvZG8vbm90L2V4aXN0KSAtLT4nKSxcblx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDYsIDU5LCA2LCA2MCkpLFxuXHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSg2LCA2MCwgNiwgNjYpLCAnc3VmZmVyJyksXG5cdFx0XHRcdF0sXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnXHUyMDIyIG51YW5jZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0ID0gdGVzdERpc3Bvc2FibGVzLmFkZChcblx0XHRcdFx0bmV3IFRlc3RNYXJrZG93bkRlY29kZXIoKSxcblx0XHRcdCk7XG5cblx0XHRcdGNvbnN0IGlucHV0TGluZXMgPSBbXG5cdFx0XHRcdC8vIHRlc3RzIHRoYXQgdGhlIGxpbmsgY2FwdGlvbiBjb250YWluIGEgY2hhdCBwcm9tcHQgYCNmaWxlOmAgcmVmZXJlbmNlLCB3aGlsZVxuXHRcdFx0XHQvLyB0aGUgZmlsZSBwYXRoIGNhbiBjb250YWluIG90aGVyIGBncmFwaGljYWwgY2hhcmFjdGVyc2Bcblx0XHRcdFx0J1xcdlxcdFsjZmlsZTouL2Fub3RoZXIvcGF0aC90by9maWxlLnR4dF0oLi9yZWFsL2ZpbGUhcGF0aC9maWxlXHUyNUM2bmFtZS5tZCknLFxuXHRcdFx0XHQvLyB0ZXN0cyB0aGF0IHRoZSBsaW5rIGZpbGUgcGF0aCBjb250YWluIGEgY2hhdCBwcm9tcHQgYCNmaWxlOmAgcmVmZXJlbmNlLFxuXHRcdFx0XHQvLyBgc3BhY2VzYCwgYGVtb2ppZXNgLCBhbmQgb3RoZXIgYGdyYXBoaWNhbCBjaGFyYWN0ZXJzYFxuXHRcdFx0XHQnIFtyZWZlcmVuY2UgXHUyMjE4IGxhYmVsXSgvYWJzb2x1dGUvcGEgdGgvdG8tI2ZpbGU6ZmlsZS50eHQvZlx1RDgzRVx1REQ3OFx1MjZBMVx1RkUwRmxlLm1kKScsXG5cdFx0XHRcdC8vIHRlc3RzIHRoYXQgbGluayBjYXB0aW9uIGFuZCBmaWxlIHBhdGggY2FuIGNvbnRhaW4gYHBhcmVudGhlc2VzYCwgYHNwYWNlc2AsIGFuZFxuXHRcdFx0XHQvLyBgZW1vamllc2Bcblx0XHRcdFx0J1xcZlshKGhlbGxvKSFdKC4vdygoKSlybGQvbmljZS1cdUQ4M0VcdUREOUEtZmlsZW4oYSk8bWU+LmdpdCkpXFxuXFx0Jyxcblx0XHRcdFx0Ly8gdGVzdHMgdGhhdCB0aGUgbGluayBjYXB0aW9uIGNhbiBiZSBlbXB0eSwgd2hpbGUgdGhlIGZpbGUgcGF0aCBjYW4gY29udGFpbiBgc3F1YXJlIGJyYWNrZXRzYFxuXHRcdFx0XHQnWzx0ZXN0Pl0oLi9zW11tZS9wYVtoISkgJyxcblx0XHRcdF07XG5cblx0XHRcdGF3YWl0IHRlc3QucnVuKFxuXHRcdFx0XHRpbnB1dExpbmVzLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Ly8gYDFzdGAgbGluZVxuXHRcdFx0XHRcdG5ldyBWZXJ0aWNhbFRhYihuZXcgUmFuZ2UoMSwgMSwgMSwgMikpLFxuXHRcdFx0XHRcdG5ldyBUYWIobmV3IFJhbmdlKDEsIDIsIDEsIDMpKSxcblx0XHRcdFx0XHRuZXcgTWFya2Rvd25MaW5rKDEsIDMsICdbI2ZpbGU6Li9hbm90aGVyL3BhdGgvdG8vZmlsZS50eHRdJywgJyguL3JlYWwvZmlsZSFwYXRoL2ZpbGVcdTI1QzZuYW1lLm1kKScpLFxuXHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSgxLCA2OCwgMSwgNjkpKSxcblx0XHRcdFx0XHQvLyBgMm5kYCBsaW5lXG5cdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCAxLCAyLCAyKSksXG5cdFx0XHRcdFx0bmV3IE1hcmtkb3duTGluaygyLCAyLCAnW3JlZmVyZW5jZSBcdTIyMTggbGFiZWxdJywgJygvYWJzb2x1dGUvcGEgdGgvdG8tI2ZpbGU6ZmlsZS50eHQvZlx1RDgzRVx1REQ3OFx1MjZBMVx1RkUwRmxlLm1kKScpLFxuXHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSgyLCA2NywgMiwgNjgpKSxcblx0XHRcdFx0XHQvLyBgM3JkYCBsaW5lXG5cdFx0XHRcdFx0bmV3IEZvcm1GZWVkKG5ldyBSYW5nZSgzLCAxLCAzLCAyKSksXG5cdFx0XHRcdFx0bmV3IE1hcmtkb3duTGluaygzLCAyLCAnWyEoaGVsbG8pIV0nLCAnKC4vdygoKSlybGQvbmljZS1cdUQ4M0VcdUREOUEtZmlsZW4oYSk8bWU+LmdpdCknKSxcblx0XHRcdFx0XHRuZXcgUmlnaHRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoMywgNTAsIDMsIDUxKSksXG5cdFx0XHRcdFx0bmV3IE5ld0xpbmUobmV3IFJhbmdlKDMsIDUxLCAzLCA1MikpLFxuXHRcdFx0XHRcdC8vIGA0dGhgIGxpbmVcblx0XHRcdFx0XHRuZXcgVGFiKG5ldyBSYW5nZSg0LCAxLCA0LCAyKSksXG5cdFx0XHRcdFx0bmV3IE5ld0xpbmUobmV3IFJhbmdlKDQsIDIsIDQsIDMpKSxcblx0XHRcdFx0XHQvLyBgNXRoYCBsaW5lXG5cdFx0XHRcdFx0bmV3IE1hcmtkb3duTGluayg1LCAxLCAnWzx0ZXN0Pl0nLCAnKC4vc1tdbWUvcGFbaCEpJyksXG5cdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSg1LCAyNCwgNSwgMjUpKSxcblx0XHRcdFx0XSxcblx0XHRcdCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdcdTIwMjIgbGlua3MnLCAoKSA9PiB7XG5cdFx0c3VpdGUoJ1x1MjAyMiBicm9rZW4nLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdcdTIwMjIgaW52YWxpZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdGVzdCA9IHRlc3REaXNwb3NhYmxlcy5hZGQoXG5cdFx0XHRcdFx0bmV3IFRlc3RNYXJrZG93bkRlY29kZXIoKSxcblx0XHRcdFx0KTtcblxuXHRcdFx0XHRjb25zdCBpbnB1dExpbmVzID0gW1xuXHRcdFx0XHRcdC8vIGluY29tcGxldGUgbGluayByZWZlcmVuY2Ugd2l0aCBlbXB0eSBjYXB0aW9uXG5cdFx0XHRcdFx0J1sgXSguL3JlYWwvZmlsZSBwYXRoL2ZpbGVcdTIxRTduYW1lLm1kJyxcblx0XHRcdFx0XHQvLyBzcGFjZSBiZXR3ZWVuIGNhcHRpb24gYW5kIHJlZmVyZW5jZSBpcyBkaXNhbGxvd2VkXG5cdFx0XHRcdFx0J1tsaW5rIHRleHRdICguL2ZpbGUgcGF0aC9uYW1lLnR4dCknLFxuXHRcdFx0XHRdO1xuXG5cdFx0XHRcdGF3YWl0IHRlc3QucnVuKFxuXHRcdFx0XHRcdGlucHV0TGluZXMsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0Ly8gYDFzdGAgbGluZVxuXHRcdFx0XHRcdFx0bmV3IExlZnRCcmFja2V0KG5ldyBSYW5nZSgxLCAxLCAxLCAyKSksXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDEsIDIsIDEsIDMpKSxcblx0XHRcdFx0XHRcdG5ldyBSaWdodEJyYWNrZXQobmV3IFJhbmdlKDEsIDMsIDEsIDQpKSxcblx0XHRcdFx0XHRcdG5ldyBMZWZ0UGFyZW50aGVzaXMobmV3IFJhbmdlKDEsIDQsIDEsIDUpKSxcblx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgxLCA1LCAxLCA1ICsgMTEpLCAnLi9yZWFsL2ZpbGUnKSxcblx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoMSwgMTYsIDEsIDE3KSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMSwgMTcsIDEsIDE3ICsgMTcpLCAncGF0aC9maWxlXHUyMUU3bmFtZS5tZCcpLFxuXHRcdFx0XHRcdFx0bmV3IE5ld0xpbmUobmV3IFJhbmdlKDEsIDM0LCAxLCAzNSkpLFxuXHRcdFx0XHRcdFx0Ly8gYDJuZGAgbGluZVxuXHRcdFx0XHRcdFx0bmV3IExlZnRCcmFja2V0KG5ldyBSYW5nZSgyLCAxLCAyLCAyKSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgMiwgMiwgMiArIDQpLCAnbGluaycpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCA2LCAyLCA3KSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgNywgMiwgNyArIDQpLCAndGV4dCcpLFxuXHRcdFx0XHRcdFx0bmV3IFJpZ2h0QnJhY2tldChuZXcgUmFuZ2UoMiwgMTEsIDIsIDEyKSksXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDIsIDEyLCAyLCAxMykpLFxuXHRcdFx0XHRcdFx0bmV3IExlZnRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoMiwgMTMsIDIsIDE0KSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgMTQsIDIsIDE0ICsgNiksICcuL2ZpbGUnKSxcblx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoMiwgMjAsIDIsIDIxKSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgMjEsIDIsIDIxICsgMTMpLCAncGF0aC9uYW1lLnR4dCcpLFxuXHRcdFx0XHRcdFx0bmV3IFJpZ2h0UGFyZW50aGVzaXMobmV3IFJhbmdlKDIsIDM0LCAyLCAzNSkpLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0c3VpdGUoJ1x1MjAyMiBzdG9wIGNoYXJhY3RlcnMgaW5zaWRlIGNhcHRpb24vcmVmZXJlbmNlIChuZXcgbGluZXMpJywgKCkgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHN0b3BDaGFyYWN0ZXIgb2YgW0NhcnJpYWdlUmV0dXJuLCBOZXdMaW5lXSkge1xuXHRcdFx0XHRcdGxldCBjaGFyYWN0ZXJOYW1lID0gJyc7XG5cblx0XHRcdFx0XHRpZiAoc3RvcENoYXJhY3RlciA9PT0gQ2FycmlhZ2VSZXR1cm4pIHtcblx0XHRcdFx0XHRcdGNoYXJhY3Rlck5hbWUgPSAnXFxcXHInO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc3RvcENoYXJhY3RlciA9PT0gTmV3TGluZSkge1xuXHRcdFx0XHRcdFx0Y2hhcmFjdGVyTmFtZSA9ICdcXFxcbic7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRcdFx0Y2hhcmFjdGVyTmFtZSAhPT0gJycsXG5cdFx0XHRcdFx0XHQnVGhlIFwiY2hhcmFjdGVyTmFtZVwiIG11c3QgYmUgc2V0LCBnb3QgXCJlbXB0eSBsaW5lXCIuJyxcblx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0dGVzdChgXHUyMDIyIHN0b3AgY2hhcmFjdGVyIC0gXCIke2NoYXJhY3Rlck5hbWV9XCJgLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCB0ZXN0ID0gdGVzdERpc3Bvc2FibGVzLmFkZChcblx0XHRcdFx0XHRcdFx0bmV3IFRlc3RNYXJrZG93bkRlY29kZXIoKSxcblx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdGNvbnN0IGlucHV0TGluZXMgPSBbXG5cdFx0XHRcdFx0XHRcdC8vIHN0b3AgY2hhcmFjdGVyIGluc2lkZSBsaW5rIGNhcHRpb25cblx0XHRcdFx0XHRcdFx0YFtoYWEke3N0b3BDaGFyYWN0ZXIuc3ltYm9sfWxvXHUwMTZGXSguL3JlYWwvXHVEODNEXHVEQzgxL25hbWUudHh0KWAsXG5cdFx0XHRcdFx0XHRcdC8vIHN0b3AgY2hhcmFjdGVyIGluc2lkZSBsaW5rIHJlZmVyZW5jZVxuXHRcdFx0XHRcdFx0XHRgW3JlZiB0ZXh0XSgvZXRjL3BhdCR7c3RvcENoYXJhY3Rlci5zeW1ib2x9aC90by9maWxlLm1kKWAsXG5cdFx0XHRcdFx0XHRcdC8vIHN0b3AgY2hhcmFjdGVyIGJldHdlZW4gbGluZSBjYXB0aW9uIGFuZCBsaW5rIHJlZmVyZW5jZSBpcyBkaXNhbGxvd2VkXG5cdFx0XHRcdFx0XHRcdGBbdGV4dF0ke3N0b3BDaGFyYWN0ZXIuc3ltYm9sfSgvZXRjLyBwYXRoL2ZpbGUubWQpYCxcblx0XHRcdFx0XHRcdF07XG5cblxuXHRcdFx0XHRcdFx0YXdhaXQgdGVzdC5ydW4oXG5cdFx0XHRcdFx0XHRcdGlucHV0TGluZXMsXG5cdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHQvLyBgMXN0YCBpbnB1dCBsaW5lXG5cdFx0XHRcdFx0XHRcdFx0bmV3IExlZnRCcmFja2V0KG5ldyBSYW5nZSgxLCAxLCAxLCAyKSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDEsIDIsIDEsIDIgKyAzKSwgJ2hhYScpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBzdG9wQ2hhcmFjdGVyKG5ldyBSYW5nZSgxLCA1LCAxLCA2KSksIC8vIDwtIHN0b3AgY2hhcmFjdGVyXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDIsIDEsIDIsIDEgKyAzKSwgJ2xvXHUwMTZGJyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFJpZ2h0QnJhY2tldChuZXcgUmFuZ2UoMiwgNCwgMiwgNSkpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBMZWZ0UGFyZW50aGVzaXMobmV3IFJhbmdlKDIsIDUsIDIsIDYpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgNiwgMiwgNiArIDE4KSwgJy4vcmVhbC9cdUQ4M0RcdURDODEvbmFtZS50eHQnKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgUmlnaHRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoMiwgMjQsIDIsIDI1KSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IE5ld0xpbmUobmV3IFJhbmdlKDIsIDI1LCAyLCAyNikpLFxuXHRcdFx0XHRcdFx0XHRcdC8vIGAybmRgIGlucHV0IGxpbmVcblx0XHRcdFx0XHRcdFx0XHRuZXcgTGVmdEJyYWNrZXQobmV3IFJhbmdlKDMsIDEsIDMsIDIpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMywgMiwgMywgMiArIDMpLCAncmVmJyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgzLCA1LCAzLCA2KSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDMsIDYsIDMsIDYgKyA0KSwgJ3RleHQnKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgUmlnaHRCcmFja2V0KG5ldyBSYW5nZSgzLCAxMCwgMywgMTEpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgTGVmdFBhcmVudGhlc2lzKG5ldyBSYW5nZSgzLCAxMSwgMywgMTIpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMywgMTIsIDMsIDEyICsgOCksICcvZXRjL3BhdCcpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBzdG9wQ2hhcmFjdGVyKG5ldyBSYW5nZSgzLCAyMCwgMywgMjEpKSwgLy8gPC0gc3RvcCBjaGFyYWN0ZXJcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoNCwgMSwgNCwgMSArIDEyKSwgJ2gvdG8vZmlsZS5tZCcpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBSaWdodFBhcmVudGhlc2lzKG5ldyBSYW5nZSg0LCAxMywgNCwgMTQpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgTmV3TGluZShuZXcgUmFuZ2UoNCwgMTQsIDQsIDE1KSksXG5cdFx0XHRcdFx0XHRcdFx0Ly8gYDNuZGAgaW5wdXQgbGluZVxuXHRcdFx0XHRcdFx0XHRcdG5ldyBMZWZ0QnJhY2tldChuZXcgUmFuZ2UoNSwgMSwgNSwgMikpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSg1LCAyLCA1LCAyICsgNCksICd0ZXh0JyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFJpZ2h0QnJhY2tldChuZXcgUmFuZ2UoNSwgNiwgNSwgNykpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBzdG9wQ2hhcmFjdGVyKG5ldyBSYW5nZSg1LCA3LCA1LCA4KSksIC8vIDwtIHN0b3AgY2hhcmFjdGVyXG5cdFx0XHRcdFx0XHRcdFx0bmV3IExlZnRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoNiwgMSwgNiwgMikpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSg2LCAyLCA2LCAyICsgNSksICcvZXRjLycpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoNiwgNywgNiwgOCkpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSg2LCA4LCA2LCA4ICsgMTIpLCAncGF0aC9maWxlLm1kJyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFJpZ2h0UGFyZW50aGVzaXMobmV3IFJhbmdlKDYsIDIwLCA2LCAyMSkpLFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogU2FtZSBhcyBhYm92ZSBidXQgdGhlc2Ugc3RvcCBjaGFyYWN0ZXJzIGRvIG5vdCBtb3ZlIHRoZSBjYXJldCB0byB0aGUgbmV4dCBsaW5lLlxuXHRcdFx0ICovXG5cdFx0XHRzdWl0ZSgnXHUyMDIyIHN0b3AgY2hhcmFjdGVycyBpbnNpZGUgY2FwdGlvbi9yZWZlcmVuY2UgKHNhbWUgbGluZSknLCAoKSA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3Qgc3RvcENoYXJhY3RlciBvZiBbVmVydGljYWxUYWIsIEZvcm1GZWVkXSkge1xuXHRcdFx0XHRcdGxldCBjaGFyYWN0ZXJOYW1lID0gJyc7XG5cblx0XHRcdFx0XHRpZiAoc3RvcENoYXJhY3RlciA9PT0gVmVydGljYWxUYWIpIHtcblx0XHRcdFx0XHRcdGNoYXJhY3Rlck5hbWUgPSAnXFxcXHYnO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc3RvcENoYXJhY3RlciA9PT0gRm9ybUZlZWQpIHtcblx0XHRcdFx0XHRcdGNoYXJhY3Rlck5hbWUgPSAnXFxcXGYnO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGFzc2VydChcblx0XHRcdFx0XHRcdGNoYXJhY3Rlck5hbWUgIT09ICcnLFxuXHRcdFx0XHRcdFx0J1RoZSBcImNoYXJhY3Rlck5hbWVcIiBtdXN0IGJlIHNldCwgZ290IFwiZW1wdHkgbGluZVwiLicsXG5cdFx0XHRcdFx0KTtcblxuXHRcdFx0XHRcdHRlc3QoYFx1MjAyMiBzdG9wIGNoYXJhY3RlciAtIFwiJHtjaGFyYWN0ZXJOYW1lfVwiYCwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgdGVzdCA9IHRlc3REaXNwb3NhYmxlcy5hZGQoXG5cdFx0XHRcdFx0XHRcdG5ldyBUZXN0TWFya2Rvd25EZWNvZGVyKCksXG5cdFx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0XHRjb25zdCBpbnB1dExpbmVzID0gW1xuXHRcdFx0XHRcdFx0XHQvLyBzdG9wIGNoYXJhY3RlciBpbnNpZGUgbGluayBjYXB0aW9uXG5cdFx0XHRcdFx0XHRcdGBbaGFhJHtzdG9wQ2hhcmFjdGVyLnN5bWJvbH1sb1x1MDE2Rl0oLi9yZWFsL1x1RDgzRFx1REM4MS9uYW1lLnR4dClgLFxuXHRcdFx0XHRcdFx0XHQvLyBzdG9wIGNoYXJhY3RlciBpbnNpZGUgbGluayByZWZlcmVuY2Vcblx0XHRcdFx0XHRcdFx0YFtyZWYgdGV4dF0oL2V0Yy9wYXQke3N0b3BDaGFyYWN0ZXIuc3ltYm9sfWgvdG8vZmlsZS5tZClgLFxuXHRcdFx0XHRcdFx0XHQvLyBzdG9wIGNoYXJhY3RlciBiZXR3ZWVuIGxpbmUgY2FwdGlvbiBhbmQgbGluayByZWZlcmVuY2UgaXMgZGlzYWxsb3dlZFxuXHRcdFx0XHRcdFx0XHRgW3RleHRdJHtzdG9wQ2hhcmFjdGVyLnN5bWJvbH0oL2V0Yy8gcGF0aC9maWxlLm1kKWAsXG5cdFx0XHRcdFx0XHRdO1xuXG5cblx0XHRcdFx0XHRcdGF3YWl0IHRlc3QucnVuKFxuXHRcdFx0XHRcdFx0XHRpbnB1dExpbmVzLFxuXHRcdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdFx0Ly8gYDFzdGAgaW5wdXQgbGluZVxuXHRcdFx0XHRcdFx0XHRcdG5ldyBMZWZ0QnJhY2tldChuZXcgUmFuZ2UoMSwgMSwgMSwgMikpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgxLCAyLCAxLCAyICsgMyksICdoYWEnKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgc3RvcENoYXJhY3RlcihuZXcgUmFuZ2UoMSwgNSwgMSwgNikpLCAvLyA8LSBzdG9wIGNoYXJhY3RlclxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgxLCA2LCAxLCA2ICsgMyksICdsb1x1MDE2RicpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBSaWdodEJyYWNrZXQobmV3IFJhbmdlKDEsIDksIDEsIDEwKSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IExlZnRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoMSwgMTAsIDEsIDExKSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDEsIDExLCAxLCAxMSArIDE4KSwgJy4vcmVhbC9cdUQ4M0RcdURDODEvbmFtZS50eHQnKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgUmlnaHRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoMSwgMjksIDEsIDMwKSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IE5ld0xpbmUobmV3IFJhbmdlKDEsIDMwLCAxLCAzMSkpLFxuXHRcdFx0XHRcdFx0XHRcdC8vIGAybmRgIGlucHV0IGxpbmVcblx0XHRcdFx0XHRcdFx0XHRuZXcgTGVmdEJyYWNrZXQobmV3IFJhbmdlKDIsIDEsIDIsIDIpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgMiwgMiwgMiArIDMpLCAncmVmJyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCA1LCAyLCA2KSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDIsIDYsIDIsIDYgKyA0KSwgJ3RleHQnKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgUmlnaHRCcmFja2V0KG5ldyBSYW5nZSgyLCAxMCwgMiwgMTEpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgTGVmdFBhcmVudGhlc2lzKG5ldyBSYW5nZSgyLCAxMSwgMiwgMTIpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgMTIsIDIsIDEyICsgOCksICcvZXRjL3BhdCcpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBzdG9wQ2hhcmFjdGVyKG5ldyBSYW5nZSgyLCAyMCwgMiwgMjEpKSwgLy8gPC0gc3RvcCBjaGFyYWN0ZXJcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgMjEsIDIsIDIxICsgMTIpLCAnaC90by9maWxlLm1kJyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFJpZ2h0UGFyZW50aGVzaXMobmV3IFJhbmdlKDIsIDMzLCAyLCAzNCkpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSgyLCAzNCwgMiwgMzUpKSxcblx0XHRcdFx0XHRcdFx0XHQvLyBgM25kYCBpbnB1dCBsaW5lXG5cdFx0XHRcdFx0XHRcdFx0bmV3IExlZnRCcmFja2V0KG5ldyBSYW5nZSgzLCAxLCAzLCAyKSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDMsIDIsIDMsIDIgKyA0KSwgJ3RleHQnKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgUmlnaHRCcmFja2V0KG5ldyBSYW5nZSgzLCA2LCAzLCA3KSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IHN0b3BDaGFyYWN0ZXIobmV3IFJhbmdlKDMsIDcsIDMsIDgpKSwgLy8gPC0gc3RvcCBjaGFyYWN0ZXJcblx0XHRcdFx0XHRcdFx0XHRuZXcgTGVmdFBhcmVudGhlc2lzKG5ldyBSYW5nZSgzLCA4LCAzLCA5KSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDMsIDksIDMsIDkgKyA1KSwgJy9ldGMvJyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgzLCAxNCwgMywgMTUpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMywgMTUsIDMsIDE1ICsgMTIpLCAncGF0aC9maWxlLm1kJyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFJpZ2h0UGFyZW50aGVzaXMobmV3IFJhbmdlKDMsIDI3LCAzLCAyOCkpLFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cblx0c3VpdGUoJ1x1MjAyMiBpbWFnZXMnLCAoKSA9PiB7XG5cdFx0c3VpdGUoJ1x1MjAyMiBnZW5lcmFsJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnXHUyMDIyIGJhc2UgY2FzZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRlc3QgPSB0ZXN0RGlzcG9zYWJsZXMuYWRkKFxuXHRcdFx0XHRcdG5ldyBUZXN0TWFya2Rvd25EZWNvZGVyKCksXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0Y29uc3QgaW5wdXREYXRhID0gW1xuXHRcdFx0XHRcdCdcXHQhW2FsdCB0ZXh0XSguL3NvbWUvcGF0aC90by9maWxlLmpwZykgJyxcblx0XHRcdFx0XHQncGxhaW4gdGV4dCBcXGYhW2xhYmVsXSguL2ltYWdlLnBuZylcXHYgYW5kIG1vcmUgdGV4dCcsXG5cdFx0XHRcdFx0JyFbXSgvdmFyL2ltYWdlcy9kZWZhdWx0KSBmb2xsb3dpbmcgdGV4dCcsXG5cdFx0XHRcdF07XG5cblx0XHRcdFx0YXdhaXQgdGVzdC5ydW4oXG5cdFx0XHRcdFx0aW5wdXREYXRhLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdC8vIGAxc3RgXG5cdFx0XHRcdFx0XHRuZXcgVGFiKG5ldyBSYW5nZSgxLCAxLCAxLCAyKSksXG5cdFx0XHRcdFx0XHRuZXcgTWFya2Rvd25JbWFnZSgxLCAyLCAnIVthbHQgdGV4dF0nLCAnKC4vc29tZS9wYXRoL3RvL2ZpbGUuanBnKScpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgxLCAzOCwgMSwgMzkpKSxcblx0XHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSgxLCAzOSwgMSwgNDApKSxcblx0XHRcdFx0XHRcdC8vIGAybmRgXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgMSwgMiwgNiksICdwbGFpbicpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCA2LCAyLCA3KSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgNywgMiwgMTEpLCAndGV4dCcpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCAxMSwgMiwgMTIpKSxcblx0XHRcdFx0XHRcdG5ldyBGb3JtRmVlZChuZXcgUmFuZ2UoMiwgMTIsIDIsIDEzKSksXG5cdFx0XHRcdFx0XHRuZXcgTWFya2Rvd25JbWFnZSgyLCAxMywgJyFbbGFiZWxdJywgJyguL2ltYWdlLnBuZyknKSxcblx0XHRcdFx0XHRcdG5ldyBWZXJ0aWNhbFRhYihuZXcgUmFuZ2UoMiwgMzQsIDIsIDM1KSksXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDIsIDM1LCAyLCAzNikpLFxuXHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDIsIDM2LCAyLCAzOSksICdhbmQnKSxcblx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoMiwgMzksIDIsIDQwKSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgNDAsIDIsIDQ0KSwgJ21vcmUnKSxcblx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoMiwgNDQsIDIsIDQ1KSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgNDUsIDIsIDQ5KSwgJ3RleHQnKSxcblx0XHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSgyLCA0OSwgMiwgNTApKSxcblx0XHRcdFx0XHRcdC8vIGAzcmRgXG5cdFx0XHRcdFx0XHRuZXcgTWFya2Rvd25JbWFnZSgzLCAxLCAnIVtdJywgJygvdmFyL2ltYWdlcy9kZWZhdWx0KScpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgzLCAyNSwgMywgMjYpKSxcblx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgzLCAyNiwgMywgMzUpLCAnZm9sbG93aW5nJyksXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDMsIDM1LCAzLCAzNikpLFxuXHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDMsIDM2LCAzLCA0MCksICd0ZXh0JyksXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdcdTIwMjIgbnVhbmNlZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdGVzdCA9IHRlc3REaXNwb3NhYmxlcy5hZGQoXG5cdFx0XHRcdFx0bmV3IFRlc3RNYXJrZG93bkRlY29kZXIoKSxcblx0XHRcdFx0KTtcblxuXHRcdFx0XHRjb25zdCBpbnB1dERhdGEgPSBbXG5cdFx0XHRcdFx0J1xcdCFbPCEtLSBjb21tZW50IC0tPl0oLi9zXHUyNjNCbWUvcGF0aC90by9maWxlLmpwZWcpICcsXG5cdFx0XHRcdFx0J3JhdyB0ZXh0IFxcZiFbKC8xLnBuZyldKC4vaW1hZ2UtXHVEODNFXHVERDc4LnBuZylcXHYgYW5kIG1vcmUgdGV4dCcsXG5cdFx0XHRcdFx0Ly8gJyFbXSgvdmFyL2ltYWdlcy9kZWZhdWx0KSBmb2xsb3dpbmcgdGV4dCcsXG5cdFx0XHRcdF07XG5cblx0XHRcdFx0YXdhaXQgdGVzdC5ydW4oXG5cdFx0XHRcdFx0aW5wdXREYXRhLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdC8vIGAxc3RgXG5cdFx0XHRcdFx0XHRuZXcgVGFiKG5ldyBSYW5nZSgxLCAxLCAxLCAyKSksXG5cdFx0XHRcdFx0XHRuZXcgTWFya2Rvd25JbWFnZSgxLCAyLCAnIVs8IS0tIGNvbW1lbnQgLS0+XScsICcoLi9zXHUyNjNCbWUvcGF0aC90by9maWxlLmpwZWcpJyksXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDEsIDQ3LCAxLCA0OCkpLFxuXHRcdFx0XHRcdFx0bmV3IE5ld0xpbmUobmV3IFJhbmdlKDEsIDQ4LCAxLCA0OSkpLFxuXHRcdFx0XHRcdFx0Ly8gYDJuZGBcblx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgyLCAxLCAyLCA0KSwgJ3JhdycpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCA0LCAyLCA1KSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgNSwgMiwgOSksICd0ZXh0JyksXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDIsIDksIDIsIDEwKSksXG5cdFx0XHRcdFx0XHRuZXcgRm9ybUZlZWQobmV3IFJhbmdlKDIsIDEwLCAyLCAxMSkpLFxuXHRcdFx0XHRcdFx0bmV3IE1hcmtkb3duSW1hZ2UoMiwgMTEsICchWygvMS5wbmcpXScsICcoLi9pbWFnZS1cdUQ4M0VcdURENzgucG5nKScpLFxuXHRcdFx0XHRcdFx0bmV3IFZlcnRpY2FsVGFiKG5ldyBSYW5nZSgyLCAzOCwgMiwgMzkpKSxcblx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoMiwgMzksIDIsIDQwKSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgNDAsIDIsIDQzKSwgJ2FuZCcpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCA0MywgMiwgNDQpKSxcblx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgyLCA0NCwgMiwgNDgpLCAnbW9yZScpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCA0OCwgMiwgNDkpKSxcblx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgyLCA0OSwgMiwgNTMpLCAndGV4dCcpLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdcdTIwMjIgYnJva2VuJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnXHUyMDIyIGludmFsaWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRlc3QgPSB0ZXN0RGlzcG9zYWJsZXMuYWRkKFxuXHRcdFx0XHRcdG5ldyBUZXN0TWFya2Rvd25EZWNvZGVyKCksXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0Y29uc3QgaW5wdXRMaW5lcyA9IFtcblx0XHRcdFx0XHQvLyBpbmNvbXBsZXRlIGxpbmsgcmVmZXJlbmNlIHdpdGggZW1wdHkgY2FwdGlvblxuXHRcdFx0XHRcdCchWyBdKC4vcmVhbC9maWxlIHBhdGgvZmlsZVx1MjYwNW5hbWUud2VicCcsXG5cdFx0XHRcdFx0Ly8gc3BhY2UgYmV0d2VlbiBjYXB0aW9uIGFuZCByZWZlcmVuY2UgaXMgZGlzYWxsb3dlZFxuXHRcdFx0XHRcdCdcXGYhW2xpbmsgdGV4dF0gKC4vZmlsZSBwYXRoL25hbWUuanBnKScsXG5cdFx0XHRcdFx0Ly8gbmV3IGxpbmUgaW5zaWRlIHRoZSBsaW5rIHJlZmVyZW5jZVxuXHRcdFx0XHRcdCdcXHYhWyBdKC4vZmlsZVxcbnBhdGgvbmFtZS5qcGcgKScsXG5cdFx0XHRcdF07XG5cblx0XHRcdFx0YXdhaXQgdGVzdC5ydW4oXG5cdFx0XHRcdFx0aW5wdXRMaW5lcyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHQvLyBgMXN0YCBsaW5lXG5cdFx0XHRcdFx0XHRuZXcgRXhjbGFtYXRpb25NYXJrKG5ldyBSYW5nZSgxLCAxLCAxLCAyKSksXG5cdFx0XHRcdFx0XHRuZXcgTGVmdEJyYWNrZXQobmV3IFJhbmdlKDEsIDIsIDEsIDMpKSxcblx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoMSwgMywgMSwgNCkpLFxuXHRcdFx0XHRcdFx0bmV3IFJpZ2h0QnJhY2tldChuZXcgUmFuZ2UoMSwgNCwgMSwgNSkpLFxuXHRcdFx0XHRcdFx0bmV3IExlZnRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoMSwgNSwgMSwgNikpLFxuXHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDEsIDYsIDEsIDYgKyAxMSksICcuL3JlYWwvZmlsZScpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgxLCAxNywgMSwgMTgpKSxcblx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgxLCAxOCwgMSwgMTggKyAxOSksICdwYXRoL2ZpbGVcdTI2MDVuYW1lLndlYnAnKSxcblx0XHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSgxLCAzNywgMSwgMzgpKSxcblx0XHRcdFx0XHRcdC8vIGAybmRgIGxpbmVcblx0XHRcdFx0XHRcdG5ldyBGb3JtRmVlZChuZXcgUmFuZ2UoMiwgMSwgMiwgMikpLFxuXHRcdFx0XHRcdFx0bmV3IEV4Y2xhbWF0aW9uTWFyayhuZXcgUmFuZ2UoMiwgMiwgMiwgMykpLFxuXHRcdFx0XHRcdFx0bmV3IExlZnRCcmFja2V0KG5ldyBSYW5nZSgyLCAzLCAyLCA0KSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgNCwgMiwgNCArIDQpLCAnbGluaycpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCA4LCAyLCA5KSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgOSwgMiwgOSArIDQpLCAndGV4dCcpLFxuXHRcdFx0XHRcdFx0bmV3IFJpZ2h0QnJhY2tldChuZXcgUmFuZ2UoMiwgMTMsIDIsIDE0KSksXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDIsIDE0LCAyLCAxNSkpLFxuXHRcdFx0XHRcdFx0bmV3IExlZnRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoMiwgMTUsIDIsIDE2KSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgMTYsIDIsIDE2ICsgNiksICcuL2ZpbGUnKSxcblx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoMiwgMjIsIDIsIDIzKSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgMjMsIDIsIDIzICsgMTMpLCAncGF0aC9uYW1lLmpwZycpLFxuXHRcdFx0XHRcdFx0bmV3IFJpZ2h0UGFyZW50aGVzaXMobmV3IFJhbmdlKDIsIDM2LCAyLCAzNykpLFxuXHRcdFx0XHRcdFx0bmV3IE5ld0xpbmUobmV3IFJhbmdlKDIsIDM3LCAyLCAzOCkpLFxuXHRcdFx0XHRcdFx0Ly8gYDNyZGAgbGluZVxuXHRcdFx0XHRcdFx0bmV3IFZlcnRpY2FsVGFiKG5ldyBSYW5nZSgzLCAxLCAzLCAyKSksXG5cdFx0XHRcdFx0XHRuZXcgRXhjbGFtYXRpb25NYXJrKG5ldyBSYW5nZSgzLCAyLCAzLCAzKSksXG5cdFx0XHRcdFx0XHRuZXcgTGVmdEJyYWNrZXQobmV3IFJhbmdlKDMsIDMsIDMsIDQpKSxcblx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoMywgNCwgMywgNSkpLFxuXHRcdFx0XHRcdFx0bmV3IFJpZ2h0QnJhY2tldChuZXcgUmFuZ2UoMywgNSwgMywgNikpLFxuXHRcdFx0XHRcdFx0bmV3IExlZnRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoMywgNiwgMywgNykpLFxuXHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDMsIDcsIDMsIDcgKyA2KSwgJy4vZmlsZScpLFxuXHRcdFx0XHRcdFx0bmV3IE5ld0xpbmUobmV3IFJhbmdlKDMsIDEzLCAzLCAxNCkpLFxuXHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDQsIDEsIDQsIDEgKyAxMyksICdwYXRoL25hbWUuanBnJyksXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDQsIDE0LCA0LCAxNSkpLFxuXHRcdFx0XHRcdFx0bmV3IFJpZ2h0UGFyZW50aGVzaXMobmV3IFJhbmdlKDQsIDE1LCA0LCAxNikpLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0c3VpdGUoJ1x1MjAyMiBzdG9wIGNoYXJhY3RlcnMgaW5zaWRlIGNhcHRpb24vcmVmZXJlbmNlIChuZXcgbGluZXMpJywgKCkgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHN0b3BDaGFyYWN0ZXIgb2YgW0NhcnJpYWdlUmV0dXJuLCBOZXdMaW5lXSkge1xuXHRcdFx0XHRcdGxldCBjaGFyYWN0ZXJOYW1lID0gJyc7XG5cblx0XHRcdFx0XHRpZiAoc3RvcENoYXJhY3RlciA9PT0gQ2FycmlhZ2VSZXR1cm4pIHtcblx0XHRcdFx0XHRcdGNoYXJhY3Rlck5hbWUgPSAnXFxcXHInO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc3RvcENoYXJhY3RlciA9PT0gTmV3TGluZSkge1xuXHRcdFx0XHRcdFx0Y2hhcmFjdGVyTmFtZSA9ICdcXFxcbic7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRcdFx0Y2hhcmFjdGVyTmFtZSAhPT0gJycsXG5cdFx0XHRcdFx0XHQnVGhlIFwiY2hhcmFjdGVyTmFtZVwiIG11c3QgYmUgc2V0LCBnb3QgXCJlbXB0eSBsaW5lXCIuJyxcblx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0dGVzdChgXHUyMDIyIHN0b3AgY2hhcmFjdGVyIC0gXCIke2NoYXJhY3Rlck5hbWV9XCJgLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCB0ZXN0ID0gdGVzdERpc3Bvc2FibGVzLmFkZChcblx0XHRcdFx0XHRcdFx0bmV3IFRlc3RNYXJrZG93bkRlY29kZXIoKSxcblx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdGNvbnN0IGlucHV0TGluZXMgPSBbXG5cdFx0XHRcdFx0XHRcdC8vIHN0b3AgY2hhcmFjdGVyIGluc2lkZSBsaW5rIGNhcHRpb25cblx0XHRcdFx0XHRcdFx0YCFbaGFhJHtzdG9wQ2hhcmFjdGVyLnN5bWJvbH1sb1x1MDE2Rl0oLi9yZWFsL1x1RDgzRFx1REM4MS9uYW1lLnBuZylgLFxuXHRcdFx0XHRcdFx0XHQvLyBzdG9wIGNoYXJhY3RlciBpbnNpZGUgbGluayByZWZlcmVuY2Vcblx0XHRcdFx0XHRcdFx0YCFbcmVmIHRleHRdKC9ldGMvcGF0JHtzdG9wQ2hhcmFjdGVyLnN5bWJvbH1oL3RvL2ZpbGUud2VicClgLFxuXHRcdFx0XHRcdFx0XHQvLyBzdG9wIGNoYXJhY3RlciBiZXR3ZWVuIGxpbmUgY2FwdGlvbiBhbmQgbGluayByZWZlcmVuY2UgaXMgZGlzYWxsb3dlZFxuXHRcdFx0XHRcdFx0XHRgIVt0ZXh0XSR7c3RvcENoYXJhY3Rlci5zeW1ib2x9KC9ldGMvIHBhdGgvZmlsZS5qcGVnKWAsXG5cdFx0XHRcdFx0XHRdO1xuXG5cblx0XHRcdFx0XHRcdGF3YWl0IHRlc3QucnVuKFxuXHRcdFx0XHRcdFx0XHRpbnB1dExpbmVzLFxuXHRcdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdFx0Ly8gYDFzdGAgaW5wdXQgbGluZVxuXHRcdFx0XHRcdFx0XHRcdG5ldyBFeGNsYW1hdGlvbk1hcmsobmV3IFJhbmdlKDEsIDEsIDEsIDIpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgTGVmdEJyYWNrZXQobmV3IFJhbmdlKDEsIDIsIDEsIDMpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMSwgMywgMSwgMyArIDMpLCAnaGFhJyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IHN0b3BDaGFyYWN0ZXIobmV3IFJhbmdlKDEsIDYsIDEsIDcpKSwgLy8gPC0gc3RvcCBjaGFyYWN0ZXJcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgMSwgMiwgMSArIDMpLCAnbG9cdTAxNkYnKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgUmlnaHRCcmFja2V0KG5ldyBSYW5nZSgyLCA0LCAyLCA1KSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IExlZnRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoMiwgNSwgMiwgNikpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgyLCA2LCAyLCA2ICsgMTgpLCAnLi9yZWFsL1x1RDgzRFx1REM4MS9uYW1lLnBuZycpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBSaWdodFBhcmVudGhlc2lzKG5ldyBSYW5nZSgyLCAyNCwgMiwgMjUpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgTmV3TGluZShuZXcgUmFuZ2UoMiwgMjUsIDIsIDI2KSksXG5cdFx0XHRcdFx0XHRcdFx0Ly8gYDJuZGAgaW5wdXQgbGluZVxuXHRcdFx0XHRcdFx0XHRcdG5ldyBFeGNsYW1hdGlvbk1hcmsobmV3IFJhbmdlKDMsIDEsIDMsIDIpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgTGVmdEJyYWNrZXQobmV3IFJhbmdlKDMsIDIsIDMsIDMpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMywgMywgMywgMyArIDMpLCAncmVmJyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgzLCA2LCAzLCA3KSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDMsIDcsIDMsIDcgKyA0KSwgJ3RleHQnKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgUmlnaHRCcmFja2V0KG5ldyBSYW5nZSgzLCAxMSwgMywgMTIpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgTGVmdFBhcmVudGhlc2lzKG5ldyBSYW5nZSgzLCAxMiwgMywgMTMpKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMywgMTMsIDMsIDEzICsgOCksICcvZXRjL3BhdCcpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBzdG9wQ2hhcmFjdGVyKG5ldyBSYW5nZSgzLCAyMSwgMywgMjIpKSwgLy8gPC0gc3RvcCBjaGFyYWN0ZXJcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoNCwgMSwgNCwgMSArIDE0KSwgJ2gvdG8vZmlsZS53ZWJwJyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFJpZ2h0UGFyZW50aGVzaXMobmV3IFJhbmdlKDQsIDE1LCA0LCAxNikpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSg0LCAxNiwgNCwgMTcpKSxcblx0XHRcdFx0XHRcdFx0XHQvLyBgM25kYCBpbnB1dCBsaW5lXG5cdFx0XHRcdFx0XHRcdFx0bmV3IEV4Y2xhbWF0aW9uTWFyayhuZXcgUmFuZ2UoNSwgMSwgNSwgMikpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBMZWZ0QnJhY2tldChuZXcgUmFuZ2UoNSwgMiwgNSwgMykpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSg1LCAzLCA1LCAzICsgNCksICd0ZXh0JyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFJpZ2h0QnJhY2tldChuZXcgUmFuZ2UoNSwgNywgNSwgOCkpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBzdG9wQ2hhcmFjdGVyKG5ldyBSYW5nZSg1LCA4LCA1LCA5KSksIC8vIDwtIHN0b3AgY2hhcmFjdGVyXG5cdFx0XHRcdFx0XHRcdFx0bmV3IExlZnRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoNiwgMSwgNiwgMikpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSg2LCAyLCA2LCAyICsgNSksICcvZXRjLycpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoNiwgNywgNiwgOCkpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSg2LCA4LCA2LCA4ICsgMTQpLCAncGF0aC9maWxlLmpwZWcnKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgUmlnaHRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoNiwgMjIsIDYsIDIzKSksXG5cdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBTYW1lIGFzIGFib3ZlIGJ1dCB0aGVzZSBzdG9wIGNoYXJhY3RlcnMgZG8gbm90IG1vdmUgdGhlIGNhcmV0IHRvIHRoZSBuZXh0IGxpbmUuXG5cdFx0XHQgKi9cblx0XHRcdHN1aXRlKCdcdTIwMjIgc3RvcCBjaGFyYWN0ZXJzIGluc2lkZSBjYXB0aW9uL3JlZmVyZW5jZSAoc2FtZSBsaW5lKScsICgpID0+IHtcblx0XHRcdFx0Zm9yIChjb25zdCBzdG9wQ2hhcmFjdGVyIG9mIFtWZXJ0aWNhbFRhYiwgRm9ybUZlZWRdKSB7XG5cdFx0XHRcdFx0bGV0IGNoYXJhY3Rlck5hbWUgPSAnJztcblxuXHRcdFx0XHRcdGlmIChzdG9wQ2hhcmFjdGVyID09PSBWZXJ0aWNhbFRhYikge1xuXHRcdFx0XHRcdFx0Y2hhcmFjdGVyTmFtZSA9ICdcXFxcdic7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChzdG9wQ2hhcmFjdGVyID09PSBGb3JtRmVlZCkge1xuXHRcdFx0XHRcdFx0Y2hhcmFjdGVyTmFtZSA9ICdcXFxcZic7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRcdFx0Y2hhcmFjdGVyTmFtZSAhPT0gJycsXG5cdFx0XHRcdFx0XHQnVGhlIFwiY2hhcmFjdGVyTmFtZVwiIG11c3QgYmUgc2V0LCBnb3QgXCJlbXB0eSBsaW5lXCIuJyxcblx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0dGVzdChgXHUyMDIyIHN0b3AgY2hhcmFjdGVyIC0gXCIke2NoYXJhY3Rlck5hbWV9XCJgLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCB0ZXN0ID0gdGVzdERpc3Bvc2FibGVzLmFkZChcblx0XHRcdFx0XHRcdFx0bmV3IFRlc3RNYXJrZG93bkRlY29kZXIoKSxcblx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdGNvbnN0IGlucHV0TGluZXMgPSBbXG5cdFx0XHRcdFx0XHRcdC8vIHN0b3AgY2hhcmFjdGVyIGluc2lkZSBsaW5rIGNhcHRpb25cblx0XHRcdFx0XHRcdFx0YCFbaGFhJHtzdG9wQ2hhcmFjdGVyLnN5bWJvbH1sb1x1MDE2Rl0oLi9yZWFsL1x1RDgzRFx1REM4MS9uYW1lKWAsXG5cdFx0XHRcdFx0XHRcdC8vIHN0b3AgY2hhcmFjdGVyIGluc2lkZSBsaW5rIHJlZmVyZW5jZVxuXHRcdFx0XHRcdFx0XHRgIVtyZWYgdGV4dF0oL2V0Yy9wYXQke3N0b3BDaGFyYWN0ZXIuc3ltYm9sfWgvdG8vZmlsZS53ZWJwKWAsXG5cdFx0XHRcdFx0XHRcdC8vIHN0b3AgY2hhcmFjdGVyIGJldHdlZW4gbGluZSBjYXB0aW9uIGFuZCBsaW5rIHJlZmVyZW5jZSBpcyBkaXNhbGxvd2VkXG5cdFx0XHRcdFx0XHRcdGAhW3RleHRdJHtzdG9wQ2hhcmFjdGVyLnN5bWJvbH0oL2V0Yy8gcGF0aC9pbWFnZS5naWYpYCxcblx0XHRcdFx0XHRcdF07XG5cblxuXHRcdFx0XHRcdFx0YXdhaXQgdGVzdC5ydW4oXG5cdFx0XHRcdFx0XHRcdGlucHV0TGluZXMsXG5cdFx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0XHQvLyBgMXN0YCBpbnB1dCBsaW5lXG5cdFx0XHRcdFx0XHRcdFx0bmV3IEV4Y2xhbWF0aW9uTWFyayhuZXcgUmFuZ2UoMSwgMSwgMSwgMikpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBMZWZ0QnJhY2tldChuZXcgUmFuZ2UoMSwgMiwgMSwgMykpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgxLCAzLCAxLCAzICsgMyksICdoYWEnKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgc3RvcENoYXJhY3RlcihuZXcgUmFuZ2UoMSwgNiwgMSwgNykpLCAvLyA8LSBzdG9wIGNoYXJhY3RlclxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgxLCA3LCAxLCA3ICsgMyksICdsb1x1MDE2RicpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBSaWdodEJyYWNrZXQobmV3IFJhbmdlKDEsIDEwLCAxLCAxMSkpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBMZWZ0UGFyZW50aGVzaXMobmV3IFJhbmdlKDEsIDExLCAxLCAxMikpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgxLCAxMiwgMSwgMTIgKyAxNCksICcuL3JlYWwvXHVEODNEXHVEQzgxL25hbWUnKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgUmlnaHRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoMSwgMjYsIDEsIDI3KSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IE5ld0xpbmUobmV3IFJhbmdlKDEsIDI3LCAxLCAyOCkpLFxuXHRcdFx0XHRcdFx0XHRcdC8vIGAybmRgIGlucHV0IGxpbmVcblx0XHRcdFx0XHRcdFx0XHRuZXcgRXhjbGFtYXRpb25NYXJrKG5ldyBSYW5nZSgyLCAxLCAyLCAyKSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IExlZnRCcmFja2V0KG5ldyBSYW5nZSgyLCAyLCAyLCAzKSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDIsIDMsIDIsIDMgKyAzKSwgJ3JlZicpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoMiwgNiwgMiwgNykpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgyLCA3LCAyLCA3ICsgNCksICd0ZXh0JyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFJpZ2h0QnJhY2tldChuZXcgUmFuZ2UoMiwgMTEsIDIsIDEyKSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IExlZnRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoMiwgMTIsIDIsIDEzKSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDIsIDEzLCAyLCAxMyArIDgpLCAnL2V0Yy9wYXQnKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgc3RvcENoYXJhY3RlcihuZXcgUmFuZ2UoMiwgMjEsIDIsIDIyKSksIC8vIDwtIHN0b3AgY2hhcmFjdGVyXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDIsIDIyLCAyLCAyMiArIDE0KSwgJ2gvdG8vZmlsZS53ZWJwJyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFJpZ2h0UGFyZW50aGVzaXMobmV3IFJhbmdlKDIsIDM2LCAyLCAzNykpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSgyLCAzNywgMiwgMzgpKSxcblx0XHRcdFx0XHRcdFx0XHQvLyBgM25kYCBpbnB1dCBsaW5lXG5cdFx0XHRcdFx0XHRcdFx0bmV3IEV4Y2xhbWF0aW9uTWFyayhuZXcgUmFuZ2UoMywgMSwgMywgMikpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBMZWZ0QnJhY2tldChuZXcgUmFuZ2UoMywgMiwgMywgMykpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgzLCAzLCAzLCAzICsgNCksICd0ZXh0JyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFJpZ2h0QnJhY2tldChuZXcgUmFuZ2UoMywgNywgMywgOCkpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBzdG9wQ2hhcmFjdGVyKG5ldyBSYW5nZSgzLCA4LCAzLCA5KSksIC8vIDwtIHN0b3AgY2hhcmFjdGVyXG5cdFx0XHRcdFx0XHRcdFx0bmV3IExlZnRQYXJlbnRoZXNpcyhuZXcgUmFuZ2UoMywgOSwgMywgMTApKSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMywgMTAsIDMsIDEwICsgNSksICcvZXRjLycpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoMywgMTUsIDMsIDE2KSksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDMsIDE2LCAzLCAxNiArIDE0KSwgJ3BhdGgvaW1hZ2UuZ2lmJyksXG5cdFx0XHRcdFx0XHRcdFx0bmV3IFJpZ2h0UGFyZW50aGVzaXMobmV3IFJhbmdlKDMsIDMwLCAzLCAzMSkpLFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdcdTIwMjIgY29tbWVudHMnLCAoKSA9PiB7XG5cdFx0c3VpdGUoJ1x1MjAyMiBnZW5lcmFsJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnXHUyMDIyIGJhc2UgY2FzZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRlc3QgPSB0ZXN0RGlzcG9zYWJsZXMuYWRkKFxuXHRcdFx0XHRcdG5ldyBUZXN0TWFya2Rvd25EZWNvZGVyKCksXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0Y29uc3QgaW5wdXREYXRhID0gW1xuXHRcdFx0XHRcdC8vIGNvbW1lbnQgd2l0aCB0ZXh0IGluc2lkZSBpdFxuXHRcdFx0XHRcdCdcXHQ8IS0tIGhlbGxvIHdvcmxkIC0tPicsXG5cdFx0XHRcdFx0Ly8gY29tbWVudCB3aXRoIGEgbGluayBpbnNpZGVcblx0XHRcdFx0XHQnc29tZSB0ZXh0PCEtLSBcXHZbbGluayBsYWJlbF0oL3NvbWUvcGF0aC90by9maWxlLm1kKVxcZiAtLT4gYW5kIG1vcmUgdGV4dCAnLFxuXHRcdFx0XHRcdC8vIGNvbW1lbnQgbmV3IGxpbmVzIGluc2lkZSBpdFxuXHRcdFx0XHRcdCc8IS0tIGNvbW1lbnRcXHJcXG50ZXh0XFxuXFxuZ29lcyBoZXJlIC0tPiB1c3VhbCB0ZXh0IGZvbGxvd3MnLFxuXHRcdFx0XHRcdC8vIGFuIGVtcHR5IGNvbW1lbnRcblx0XHRcdFx0XHQnXFx0PCEtLS0tPlxcdCcsXG5cdFx0XHRcdFx0Ly8gY29tbWVudCB0aGF0IHdhcyBub3QgY2xvc2VkIHByb3Blcmx5XG5cdFx0XHRcdFx0J2hhYWxvXFx0PCEtLSBbbGluayBsYWJlbF0oL3NvbWUvcGF0aC90by9maWxlLm1kKScsXG5cdFx0XHRcdF07XG5cblx0XHRcdFx0YXdhaXQgdGVzdC5ydW4oXG5cdFx0XHRcdFx0aW5wdXREYXRhLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdC8vIGAxc3RgXG5cdFx0XHRcdFx0XHRuZXcgVGFiKG5ldyBSYW5nZSgxLCAxLCAxLCAyKSksXG5cdFx0XHRcdFx0XHRuZXcgTWFya2Rvd25Db21tZW50KG5ldyBSYW5nZSgxLCAyLCAxLCAyICsgMjApLCAnPCEtLSBoZWxsbyB3b3JsZCAtLT4nKSxcblx0XHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSgxLCAyMiwgMSwgMjMpKSxcblx0XHRcdFx0XHRcdC8vIGAybmRgXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMiwgMSwgMiwgNSksICdzb21lJyksXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDIsIDUsIDIsIDYpKSxcblx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgyLCA2LCAyLCAxMCksICd0ZXh0JyksXG5cdFx0XHRcdFx0XHRuZXcgTWFya2Rvd25Db21tZW50KG5ldyBSYW5nZSgyLCAxMCwgMiwgMTAgKyA0NiksICc8IS0tIFxcdltsaW5rIGxhYmVsXSgvc29tZS9wYXRoL3RvL2ZpbGUubWQpXFxmIC0tPicpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCA1NiwgMiwgNTcpKSxcblx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSgyLCA1NywgMiwgNjApLCAnYW5kJyksXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDIsIDYwLCAyLCA2MSkpLFxuXHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDIsIDYxLCAyLCA2NSksICdtb3JlJyksXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDIsIDY1LCAyLCA2NikpLFxuXHRcdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDIsIDY2LCAyLCA3MCksICd0ZXh0JyksXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDIsIDcwLCAyLCA3MSkpLFxuXHRcdFx0XHRcdFx0bmV3IE5ld0xpbmUobmV3IFJhbmdlKDIsIDcxLCAyLCA3MikpLFxuXHRcdFx0XHRcdFx0Ly8gYDNyZGBcblx0XHRcdFx0XHRcdG5ldyBNYXJrZG93bkNvbW1lbnQobmV3IFJhbmdlKDMsIDEsIDMgKyAzLCAxICsgMTMpLCAnPCEtLSBjb21tZW50XFxyXFxudGV4dFxcblxcbmdvZXMgaGVyZSAtLT4nKSxcblx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoNiwgMTQsIDYsIDE1KSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoNiwgMTUsIDYsIDE1ICsgNSksICd1c3VhbCcpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSg2LCAyMCwgNiwgMjEpKSxcblx0XHRcdFx0XHRcdG5ldyBXb3JkKG5ldyBSYW5nZSg2LCAyMSwgNiwgMjEgKyA0KSwgJ3RleHQnKSxcblx0XHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoNiwgMjUsIDYsIDI2KSksXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoNiwgMjYsIDYsIDI2ICsgNyksICdmb2xsb3dzJyksXG5cdFx0XHRcdFx0XHRuZXcgTmV3TGluZShuZXcgUmFuZ2UoNiwgMzMsIDYsIDM0KSksXG5cdFx0XHRcdFx0XHQvLyBgNHJkYFxuXHRcdFx0XHRcdFx0bmV3IFRhYihuZXcgUmFuZ2UoNywgMSwgNywgMikpLFxuXHRcdFx0XHRcdFx0bmV3IE1hcmtkb3duQ29tbWVudChuZXcgUmFuZ2UoNywgMiwgNywgMiArIDcpLCAnPCEtLS0tPicpLFxuXHRcdFx0XHRcdFx0bmV3IFRhYihuZXcgUmFuZ2UoNywgOSwgNywgMTApKSxcblx0XHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSg3LCAxMCwgNywgMTEpKSxcblx0XHRcdFx0XHRcdC8vIGA1dGhgXG5cdFx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoOCwgMSwgOCwgNiksICdoYWFsbycpLFxuXHRcdFx0XHRcdFx0bmV3IFRhYihuZXcgUmFuZ2UoOCwgNiwgOCwgNykpLFxuXHRcdFx0XHRcdFx0bmV3IE1hcmtkb3duQ29tbWVudChuZXcgUmFuZ2UoOCwgNywgOCwgNyArIDQwKSwgJzwhLS0gW2xpbmsgbGFiZWxdKC9zb21lL3BhdGgvdG8vZmlsZS5tZCknKSxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ1x1MjAyMiBudWFuY2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXN0ID0gdGVzdERpc3Bvc2FibGVzLmFkZChcblx0XHRcdFx0XHRuZXcgVGVzdE1hcmtkb3duRGVjb2RlcigpLFxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdGNvbnN0IGlucHV0RGF0YSA9IFtcblx0XHRcdFx0XHQvLyBjb21tZW50IGluc2lkZSBgPD5gIGJyYWNrZXRzXG5cdFx0XHRcdFx0JyBcXGYgPDwhLS1jb21tZW5cXHQtLT4+Jyxcblx0XHRcdFx0XHQvLyBjb21tZW50IGNvbnRhaW5zIGA8W10+YCBicmFja2V0cyBhbmQgYCFgXG5cdFx0XHRcdFx0JzwhLS08WyFjXHUyNkJEXHVGRTBFbW1lbnQhXT4tLT5cXHRcXHQnLFxuXHRcdFx0XHRcdC8vIGNvbW1lbnQgY29udGFpbnMgYDwhLS1gIGFuZCBuZXcgbGluZXNcblx0XHRcdFx0XHQnXFx2PCEtLXNvbWVcXHJcXG50ZXh0XFxuXFx0PCEtLWlubmVyXFxyXFxudGV4dC0tPlxcdFxcdCcsXG5cdFx0XHRcdFx0Ly8gY29tbWVudCBjb250YWlucyBgPCEtLWAgYW5kIG5ldmVyIGNsb3NlZCBwcm9wZXJseVxuXHRcdFx0XHRcdCcgPCEtLTwhLS1pbm5lclxcclxcbnRleHQtLSA+XFx0XFx2XFxmICcsXG5cdFx0XHRcdF07XG5cblx0XHRcdFx0YXdhaXQgdGVzdC5ydW4oXG5cdFx0XHRcdFx0aW5wdXREYXRhLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdC8vIGAxc3RgXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDEsIDEsIDEsIDIpKSxcblx0XHRcdFx0XHRcdG5ldyBGb3JtRmVlZChuZXcgUmFuZ2UoMSwgMiwgMSwgMykpLFxuXHRcdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgxLCAzLCAxLCA0KSksXG5cdFx0XHRcdFx0XHRuZXcgTGVmdEFuZ2xlQnJhY2tldChuZXcgUmFuZ2UoMSwgNCwgMSwgNSkpLFxuXHRcdFx0XHRcdFx0bmV3IE1hcmtkb3duQ29tbWVudChuZXcgUmFuZ2UoMSwgNSwgMSwgNSArIDE0KSwgJzwhLS1jb21tZW5cXHQtLT4nKSxcblx0XHRcdFx0XHRcdG5ldyBSaWdodEFuZ2xlQnJhY2tldChuZXcgUmFuZ2UoMSwgMTksIDEsIDIwKSksXG5cdFx0XHRcdFx0XHRuZXcgTmV3TGluZShuZXcgUmFuZ2UoMSwgMjAsIDEsIDIxKSksXG5cdFx0XHRcdFx0XHQvLyBgMm5kYFxuXHRcdFx0XHRcdFx0bmV3IE1hcmtkb3duQ29tbWVudChuZXcgUmFuZ2UoMiwgMSwgMiwgMSArIDIxKSwgJzwhLS08WyFjXHUyNkJEXHVGRTBFbW1lbnQhXT4tLT4nKSxcblx0XHRcdFx0XHRcdG5ldyBUYWIobmV3IFJhbmdlKDIsIDIyLCAyLCAyMykpLFxuXHRcdFx0XHRcdFx0bmV3IFRhYihuZXcgUmFuZ2UoMiwgMjMsIDIsIDI0KSksXG5cdFx0XHRcdFx0XHRuZXcgTmV3TGluZShuZXcgUmFuZ2UoMiwgMjQsIDIsIDI1KSksXG5cdFx0XHRcdFx0XHQvLyBgM3JkYFxuXHRcdFx0XHRcdFx0bmV3IFZlcnRpY2FsVGFiKG5ldyBSYW5nZSgzLCAxLCAzLCAyKSksXG5cdFx0XHRcdFx0XHRuZXcgTWFya2Rvd25Db21tZW50KG5ldyBSYW5nZSgzLCAyLCAzICsgMywgMSArIDcpLCAnPCEtLXNvbWVcXHJcXG50ZXh0XFxuXFx0PCEtLWlubmVyXFxyXFxudGV4dC0tPicpLFxuXHRcdFx0XHRcdFx0bmV3IFRhYihuZXcgUmFuZ2UoNiwgOCwgNiwgOSkpLFxuXHRcdFx0XHRcdFx0bmV3IFRhYihuZXcgUmFuZ2UoNiwgOSwgNiwgMTApKSxcblx0XHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSg2LCAxMCwgNiwgMTEpKSxcblx0XHRcdFx0XHRcdC8vIGA0cmRgXG5cdFx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDcsIDEsIDcsIDIpKSxcblx0XHRcdFx0XHRcdC8vIG5vdGUhIGNvbW1lbnQgZG9lcyBub3QgaGF2ZSBjb3JyZWN0IGNsb3NpbmcgYC0tPmAsIGhlbmNlIHRoZSBjb21tZW50IGV4dGVuZHNcblx0XHRcdFx0XHRcdC8vICAgICAgIHRvIHRoZSBlbmQgb2YgdGhlIHRleHQsIGFuZCB0aGVyZWZvcmUgaW5jbHVkZXMgdGhlIFxcdFxcdlxcZiBhbmQgc3BhY2UgYXQgdGhlIGVuZFxuXHRcdFx0XHRcdFx0bmV3IE1hcmtkb3duQ29tbWVudChuZXcgUmFuZ2UoNywgMiwgOCwgMSArIDEyKSwgJzwhLS08IS0taW5uZXJcXHJcXG50ZXh0LS0gPlxcdFxcdlxcZiAnKSxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdcdTIwMjIgaW52YWxpZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3QgPSB0ZXN0RGlzcG9zYWJsZXMuYWRkKFxuXHRcdFx0XHRuZXcgVGVzdE1hcmtkb3duRGVjb2RlcigpLFxuXHRcdFx0KTtcblxuXHRcdFx0Y29uc3QgaW5wdXREYXRhID0gW1xuXHRcdFx0XHQnXFx0PCEgLS0gbW9uZG8gLS0+ICcsXG5cdFx0XHRcdCcgPCAhLS0gXHUwNDQxXHUwNDMyXHUwNDU2XHUwNDQyIC0tPlxcdCcsXG5cdFx0XHRcdCdcXHY8IS0gLSB0ZXJyYSAtLT5cXGYnLFxuXHRcdFx0XHQnPCEtLW11bmRvIC0gLT4gJyxcblx0XHRcdF07XG5cblx0XHRcdGF3YWl0IHRlc3QucnVuKFxuXHRcdFx0XHRpbnB1dERhdGEsXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQvLyBgMXN0YFxuXHRcdFx0XHRcdG5ldyBUYWIobmV3IFJhbmdlKDEsIDEsIDEsIDIpKSxcblx0XHRcdFx0XHRuZXcgTGVmdEFuZ2xlQnJhY2tldChuZXcgUmFuZ2UoMSwgMiwgMSwgMykpLFxuXHRcdFx0XHRcdG5ldyBFeGNsYW1hdGlvbk1hcmsobmV3IFJhbmdlKDEsIDMsIDEsIDQpKSxcblx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDEsIDQsIDEsIDUpKSxcblx0XHRcdFx0XHRuZXcgRGFzaChuZXcgUmFuZ2UoMSwgNSwgMSwgNikpLFxuXHRcdFx0XHRcdG5ldyBEYXNoKG5ldyBSYW5nZSgxLCA2LCAxLCA3KSksXG5cdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgxLCA3LCAxLCA4KSksXG5cdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDEsIDgsIDEsIDggKyA1KSwgJ21vbmRvJyksXG5cdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgxLCAxMywgMSwgMTQpKSxcblx0XHRcdFx0XHRuZXcgRGFzaChuZXcgUmFuZ2UoMSwgMTQsIDEsIDE1KSksXG5cdFx0XHRcdFx0bmV3IERhc2gobmV3IFJhbmdlKDEsIDE1LCAxLCAxNikpLFxuXHRcdFx0XHRcdG5ldyBSaWdodEFuZ2xlQnJhY2tldChuZXcgUmFuZ2UoMSwgMTYsIDEsIDE3KSksXG5cdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgxLCAxNywgMSwgMTgpKSxcblx0XHRcdFx0XHRuZXcgTmV3TGluZShuZXcgUmFuZ2UoMSwgMTgsIDEsIDE5KSksXG5cdFx0XHRcdFx0Ly8gYDJuZGBcblx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDIsIDEsIDIsIDIpKSxcblx0XHRcdFx0XHRuZXcgTGVmdEFuZ2xlQnJhY2tldChuZXcgUmFuZ2UoMiwgMiwgMiwgMykpLFxuXHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoMiwgMywgMiwgNCkpLFxuXHRcdFx0XHRcdG5ldyBFeGNsYW1hdGlvbk1hcmsobmV3IFJhbmdlKDIsIDQsIDIsIDUpKSxcblx0XHRcdFx0XHRuZXcgRGFzaChuZXcgUmFuZ2UoMiwgNSwgMiwgNikpLFxuXHRcdFx0XHRcdG5ldyBEYXNoKG5ldyBSYW5nZSgyLCA2LCAyLCA3KSksXG5cdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgyLCA3LCAyLCA4KSksXG5cdFx0XHRcdFx0bmV3IFdvcmQobmV3IFJhbmdlKDIsIDgsIDIsIDggKyA0KSwgJ1x1MDQ0MVx1MDQzMlx1MDQ1Nlx1MDQ0MicpLFxuXHRcdFx0XHRcdG5ldyBTcGFjZShuZXcgUmFuZ2UoMiwgMTIsIDIsIDEzKSksXG5cdFx0XHRcdFx0bmV3IERhc2gobmV3IFJhbmdlKDIsIDEzLCAyLCAxNCkpLFxuXHRcdFx0XHRcdG5ldyBEYXNoKG5ldyBSYW5nZSgyLCAxNCwgMiwgMTUpKSxcblx0XHRcdFx0XHRuZXcgUmlnaHRBbmdsZUJyYWNrZXQobmV3IFJhbmdlKDIsIDE1LCAyLCAxNikpLFxuXHRcdFx0XHRcdG5ldyBUYWIobmV3IFJhbmdlKDIsIDE2LCAyLCAxNykpLFxuXHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSgyLCAxNywgMiwgMTgpKSxcblx0XHRcdFx0XHQvLyBgM3JkYFxuXHRcdFx0XHRcdG5ldyBWZXJ0aWNhbFRhYihuZXcgUmFuZ2UoMywgMSwgMywgMikpLFxuXHRcdFx0XHRcdG5ldyBMZWZ0QW5nbGVCcmFja2V0KG5ldyBSYW5nZSgzLCAyLCAzLCAzKSksXG5cdFx0XHRcdFx0bmV3IEV4Y2xhbWF0aW9uTWFyayhuZXcgUmFuZ2UoMywgMywgMywgNCkpLFxuXHRcdFx0XHRcdG5ldyBEYXNoKG5ldyBSYW5nZSgzLCA0LCAzLCA1KSksXG5cdFx0XHRcdFx0bmV3IFNwYWNlKG5ldyBSYW5nZSgzLCA1LCAzLCA2KSksXG5cdFx0XHRcdFx0bmV3IERhc2gobmV3IFJhbmdlKDMsIDYsIDMsIDcpKSxcblx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDMsIDcsIDMsIDgpKSxcblx0XHRcdFx0XHRuZXcgV29yZChuZXcgUmFuZ2UoMywgOCwgMywgOCArIDUpLCAndGVycmEnKSxcblx0XHRcdFx0XHRuZXcgU3BhY2UobmV3IFJhbmdlKDMsIDEzLCAzLCAxNCkpLFxuXHRcdFx0XHRcdG5ldyBEYXNoKG5ldyBSYW5nZSgzLCAxNCwgMywgMTUpKSxcblx0XHRcdFx0XHRuZXcgRGFzaChuZXcgUmFuZ2UoMywgMTUsIDMsIDE2KSksXG5cdFx0XHRcdFx0bmV3IFJpZ2h0QW5nbGVCcmFja2V0KG5ldyBSYW5nZSgzLCAxNiwgMywgMTcpKSxcblx0XHRcdFx0XHRuZXcgRm9ybUZlZWQobmV3IFJhbmdlKDMsIDE3LCAzLCAxOCkpLFxuXHRcdFx0XHRcdG5ldyBOZXdMaW5lKG5ldyBSYW5nZSgzLCAxOCwgMywgMTkpKSxcblx0XHRcdFx0XHQvLyBgNHJkYFxuXHRcdFx0XHRcdC8vIG5vdGUhIGNvbW1lbnQgZG9lcyBub3QgaGF2ZSBjb3JyZWN0IGNsb3NpbmcgYC0tPmAsIGhlbmNlIHRoZSBjb21tZW50IGV4dGVuZHNcblx0XHRcdFx0XHQvLyAgICAgICB0byB0aGUgZW5kIG9mIHRoZSB0ZXh0LCBhbmQgdGhlcmVmb3JlIGluY2x1ZGVzIHRoZSBgc3BhY2VgIGF0IHRoZSBlbmRcblx0XHRcdFx0XHRuZXcgTWFya2Rvd25Db21tZW50KG5ldyBSYW5nZSg0LCAxLCA0LCAxICsgMTUpLCAnPCEtLW11bmRvIC0gLT4gJyksXG5cdFx0XHRcdF0sXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsYUFBYTtBQUV0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
