import { deepStrictEqual } from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { chunkInput } from "../../common/terminalProcess.js";
suite("platform - terminalProcess", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("chunkInput", () => {
    test("single chunk", () => {
      deepStrictEqual(chunkInput("foo bar"), ["foo bar"]);
    });
    test("multi chunk", () => {
      deepStrictEqual(chunkInput("foo".repeat(50)), [
        "foofoofoofoofoofoofoofoofoofoofoofoofoofoofoofoofo",
        "ofoofoofoofoofoofoofoofoofoofoofoofoofoofoofoofoof",
        "oofoofoofoofoofoofoofoofoofoofoofoofoofoofoofoofoo"
      ]);
    });
    test("small data with escapes", () => {
      deepStrictEqual(chunkInput("foo \x1B[30mbar"), [
        "foo ",
        "\x1B[30mbar"
      ]);
    });
    test("large data with escapes", () => {
      deepStrictEqual(chunkInput("foofoofoofoo\x1B[30mbarbarbarbarbar\x1B[0m".repeat(3)), [
        "foofoofoofoo",
        "\x1B[30mbarbarbarbarbar",
        "\x1B[0mfoofoofoofoo",
        "\x1B[30mbarbarbarbarbar",
        "\x1B[0mfoofoofoofoo",
        "\x1B[30mbarbarbarbarbar",
        "\x1B[0m"
      ]);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC90ZXN0L2NvbW1vbi90ZXJtaW5hbFByb2Nlc3MudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGRlZXBTdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IGNodW5rSW5wdXQgfSBmcm9tICcuLi8uLi9jb21tb24vdGVybWluYWxQcm9jZXNzLmpzJztcblxuc3VpdGUoJ3BsYXRmb3JtIC0gdGVybWluYWxQcm9jZXNzJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblx0c3VpdGUoJ2NodW5rSW5wdXQnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2luZ2xlIGNodW5rJywgKCkgPT4ge1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKGNodW5rSW5wdXQoJ2ZvbyBiYXInKSwgWydmb28gYmFyJ10pO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ211bHRpIGNodW5rJywgKCkgPT4ge1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKGNodW5rSW5wdXQoJ2ZvbycucmVwZWF0KDUwKSksIFtcblx0XHRcdFx0J2Zvb2Zvb2Zvb2Zvb2Zvb2Zvb2Zvb2Zvb2Zvb2Zvb2Zvb2Zvb2Zvb2Zvb2Zvb2Zvb2ZvJyxcblx0XHRcdFx0J29mb29mb29mb29mb29mb29mb29mb29mb29mb29mb29mb29mb29mb29mb29mb29mb29mJyxcblx0XHRcdFx0J29vZm9vZm9vZm9vZm9vZm9vZm9vZm9vZm9vZm9vZm9vZm9vZm9vZm9vZm9vZm9vZm9vJ1xuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc21hbGwgZGF0YSB3aXRoIGVzY2FwZXMnLCAoKSA9PiB7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoY2h1bmtJbnB1dCgnZm9vIFxceDFiWzMwbWJhcicpLCBbXG5cdFx0XHRcdCdmb28gJyxcblx0XHRcdFx0J1xceDFiWzMwbWJhcidcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ2xhcmdlIGRhdGEgd2l0aCBlc2NhcGVzJywgKCkgPT4ge1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKGNodW5rSW5wdXQoJ2Zvb2Zvb2Zvb2Zvb1xceDFiWzMwbWJhcmJhcmJhcmJhcmJhclxceDFiWzBtJy5yZXBlYXQoMykpLCBbXG5cdFx0XHRcdCdmb29mb29mb29mb28nLFxuXHRcdFx0XHQnXFx4MUJbMzBtYmFyYmFyYmFyYmFyYmFyJyxcblx0XHRcdFx0J1xceDFCWzBtZm9vZm9vZm9vZm9vJyxcblx0XHRcdFx0J1xceDFCWzMwbWJhcmJhcmJhcmJhcmJhcicsXG5cdFx0XHRcdCdcXHgxQlswbWZvb2Zvb2Zvb2ZvbycsXG5cdFx0XHRcdCdcXHgxQlszMG1iYXJiYXJiYXJiYXJiYXInLFxuXHRcdFx0XHQnXFx4MUJbMG0nXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsa0JBQWtCO0FBRTNCLE1BQU0sOEJBQThCLE1BQU07QUFDekMsMENBQXdDO0FBQ3hDLFFBQU0sY0FBYyxNQUFNO0FBQ3pCLFNBQUssZ0JBQWdCLE1BQU07QUFDMUIsc0JBQWdCLFdBQVcsU0FBUyxHQUFHLENBQUMsU0FBUyxDQUFDO0FBQUEsSUFDbkQsQ0FBQztBQUNELFNBQUssZUFBZSxNQUFNO0FBQ3pCLHNCQUFnQixXQUFXLE1BQU0sT0FBTyxFQUFFLENBQUMsR0FBRztBQUFBLFFBQzdDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGLENBQUM7QUFDRCxTQUFLLDJCQUEyQixNQUFNO0FBQ3JDLHNCQUFnQixXQUFXLGlCQUFpQixHQUFHO0FBQUEsUUFDOUM7QUFBQSxRQUNBO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQ0QsU0FBSywyQkFBMkIsTUFBTTtBQUNyQyxzQkFBZ0IsV0FBVyw2Q0FBNkMsT0FBTyxDQUFDLENBQUMsR0FBRztBQUFBLFFBQ25GO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
