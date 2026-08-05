import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { prepareCommand } from "../../node/terminals.js";
suite("Debug - prepareCommand", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("bash", () => {
    assert.strictEqual(
      prepareCommand("bash", ["{$} ("], false).trim(),
      "\\{\\$\\}\\ \\("
    );
    assert.strictEqual(
      prepareCommand("bash", ["hello", "world", "--flag=true"], false).trim(),
      "hello world --flag=true"
    );
    assert.strictEqual(
      prepareCommand("bash", [" space arg "], false).trim(),
      "\\ space\\ arg\\"
    );
    assert.strictEqual(
      prepareCommand("bash", ["{$} ("], true).trim(),
      "{$} ("
    );
    assert.strictEqual(
      prepareCommand("bash", ["hello", "world", "--flag=true"], true).trim(),
      "hello world --flag=true"
    );
    assert.strictEqual(
      prepareCommand("bash", [" space arg "], true).trim(),
      "space arg"
    );
  });
  test("bash - do not escape > and <", () => {
    assert.strictEqual(
      prepareCommand("bash", ["arg1", ">", "> hello.txt", "<", "<input.in"], false).trim(),
      "arg1 > \\>\\ hello.txt < \\<input.in"
    );
  });
  test("cmd", () => {
    assert.strictEqual(
      prepareCommand("cmd.exe", ["^!< "], false).trim(),
      '"^^^!^< "'
    );
    assert.strictEqual(
      prepareCommand("cmd.exe", ["hello", "world", "--flag=true"], false).trim(),
      "hello world --flag=true"
    );
    assert.strictEqual(
      prepareCommand("cmd.exe", [" space arg "], false).trim(),
      '" space arg "'
    );
    assert.strictEqual(
      prepareCommand("cmd.exe", ['"A>0"'], false).trim(),
      '"""A^>0"""'
    );
    assert.strictEqual(
      prepareCommand("cmd.exe", [""], false).trim(),
      '""'
    );
    assert.strictEqual(
      prepareCommand("cmd.exe", ["^!< "], true).trim(),
      "^!<"
    );
    assert.strictEqual(
      prepareCommand("cmd.exe", ["hello", "world", "--flag=true"], true).trim(),
      "hello world --flag=true"
    );
    assert.strictEqual(
      prepareCommand("cmd.exe", [" space arg "], true).trim(),
      "space arg"
    );
    assert.strictEqual(
      prepareCommand("cmd.exe", ['"A>0"'], true).trim(),
      '"A>0"'
    );
    assert.strictEqual(
      prepareCommand("cmd.exe", [""], true).trim(),
      ""
    );
  });
  test("cmd - do not escape > and <", () => {
    assert.strictEqual(
      prepareCommand("cmd.exe", ["arg1", ">", "> hello.txt", "<", "<input.in"], false).trim(),
      'arg1 > "^> hello.txt" < ^<input.in'
    );
  });
  test("powershell", () => {
    assert.strictEqual(
      prepareCommand("powershell", ["!< "], false).trim(),
      `& '!< '`
    );
    assert.strictEqual(
      prepareCommand("powershell", ["hello", "world", "--flag=true"], false).trim(),
      `& 'hello' 'world' '--flag=true'`
    );
    assert.strictEqual(
      prepareCommand("powershell", [" space arg "], false).trim(),
      `& ' space arg '`
    );
    assert.strictEqual(
      prepareCommand("powershell", ['"A>0"'], false).trim(),
      `& '"A>0"'`
    );
    assert.strictEqual(
      prepareCommand("powershell", [""], false).trim(),
      `& ''`
    );
    assert.strictEqual(
      prepareCommand("powershell", ["!< "], true).trim(),
      "!<"
    );
    assert.strictEqual(
      prepareCommand("powershell", ["hello", "world", "--flag=true"], true).trim(),
      "hello world --flag=true"
    );
    assert.strictEqual(
      prepareCommand("powershell", [" space arg "], true).trim(),
      "space arg"
    );
    assert.strictEqual(
      prepareCommand("powershell", ['"A>0"'], true).trim(),
      '"A>0"'
    );
    assert.strictEqual(
      prepareCommand("powershell", [""], true).trim(),
      ``
    );
  });
  test("powershell - do not escape > and <", () => {
    assert.strictEqual(
      prepareCommand("powershell", ["arg1", ">", "> hello.txt", "<", "<input.in"], false).trim(),
      `& 'arg1' > '> hello.txt' < '<input.in'`
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy90ZXN0L25vZGUvdGVybWluYWxzLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IHByZXBhcmVDb21tYW5kIH0gZnJvbSAnLi4vLi4vbm9kZS90ZXJtaW5hbHMuanMnO1xuXG5cbnN1aXRlKCdEZWJ1ZyAtIHByZXBhcmVDb21tYW5kJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdiYXNoJywgKCkgPT4ge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHByZXBhcmVDb21tYW5kKCdiYXNoJywgWyd7JH0gKCddLCBmYWxzZSkudHJpbSgpLFxuXHRcdFx0J1xcXFx7XFxcXCRcXFxcfVxcXFwgXFxcXCgnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwcmVwYXJlQ29tbWFuZCgnYmFzaCcsIFsnaGVsbG8nLCAnd29ybGQnLCAnLS1mbGFnPXRydWUnXSwgZmFsc2UpLnRyaW0oKSxcblx0XHRcdCdoZWxsbyB3b3JsZCAtLWZsYWc9dHJ1ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHByZXBhcmVDb21tYW5kKCdiYXNoJywgWycgc3BhY2UgYXJnICddLCBmYWxzZSkudHJpbSgpLFxuXHRcdFx0J1xcXFwgc3BhY2VcXFxcIGFyZ1xcXFwnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHByZXBhcmVDb21tYW5kKCdiYXNoJywgWyd7JH0gKCddLCB0cnVlKS50cmltKCksXG5cdFx0XHQneyR9ICgnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwcmVwYXJlQ29tbWFuZCgnYmFzaCcsIFsnaGVsbG8nLCAnd29ybGQnLCAnLS1mbGFnPXRydWUnXSwgdHJ1ZSkudHJpbSgpLFxuXHRcdFx0J2hlbGxvIHdvcmxkIC0tZmxhZz10cnVlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0cHJlcGFyZUNvbW1hbmQoJ2Jhc2gnLCBbJyBzcGFjZSBhcmcgJ10sIHRydWUpLnRyaW0oKSxcblx0XHRcdCdzcGFjZSBhcmcnKTtcblx0fSk7XG5cblx0dGVzdCgnYmFzaCAtIGRvIG5vdCBlc2NhcGUgPiBhbmQgPCcsICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwcmVwYXJlQ29tbWFuZCgnYmFzaCcsIFsnYXJnMScsICc+JywgJz4gaGVsbG8udHh0JywgJzwnLCAnPGlucHV0LmluJ10sIGZhbHNlKS50cmltKCksXG5cdFx0XHQnYXJnMSA+IFxcXFw+XFxcXCBoZWxsby50eHQgPCBcXFxcPGlucHV0LmluJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NtZCcsICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwcmVwYXJlQ29tbWFuZCgnY21kLmV4ZScsIFsnXiE8ICddLCBmYWxzZSkudHJpbSgpLFxuXHRcdFx0J1wiXl5eIV48IFwiJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0cHJlcGFyZUNvbW1hbmQoJ2NtZC5leGUnLCBbJ2hlbGxvJywgJ3dvcmxkJywgJy0tZmxhZz10cnVlJ10sIGZhbHNlKS50cmltKCksXG5cdFx0XHQnaGVsbG8gd29ybGQgLS1mbGFnPXRydWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwcmVwYXJlQ29tbWFuZCgnY21kLmV4ZScsIFsnIHNwYWNlIGFyZyAnXSwgZmFsc2UpLnRyaW0oKSxcblx0XHRcdCdcIiBzcGFjZSBhcmcgXCInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwcmVwYXJlQ29tbWFuZCgnY21kLmV4ZScsIFsnXCJBPjBcIiddLCBmYWxzZSkudHJpbSgpLFxuXHRcdFx0J1wiXCJcIkFePjBcIlwiXCInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwcmVwYXJlQ29tbWFuZCgnY21kLmV4ZScsIFsnJ10sIGZhbHNlKS50cmltKCksXG5cdFx0XHQnXCJcIicpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0cHJlcGFyZUNvbW1hbmQoJ2NtZC5leGUnLCBbJ14hPCAnXSwgdHJ1ZSkudHJpbSgpLFxuXHRcdFx0J14hPCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHByZXBhcmVDb21tYW5kKCdjbWQuZXhlJywgWydoZWxsbycsICd3b3JsZCcsICctLWZsYWc9dHJ1ZSddLCB0cnVlKS50cmltKCksXG5cdFx0XHQnaGVsbG8gd29ybGQgLS1mbGFnPXRydWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwcmVwYXJlQ29tbWFuZCgnY21kLmV4ZScsIFsnIHNwYWNlIGFyZyAnXSwgdHJ1ZSkudHJpbSgpLFxuXHRcdFx0J3NwYWNlIGFyZycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHByZXBhcmVDb21tYW5kKCdjbWQuZXhlJywgWydcIkE+MFwiJ10sIHRydWUpLnRyaW0oKSxcblx0XHRcdCdcIkE+MFwiJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0cHJlcGFyZUNvbW1hbmQoJ2NtZC5leGUnLCBbJyddLCB0cnVlKS50cmltKCksXG5cdFx0XHQnJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NtZCAtIGRvIG5vdCBlc2NhcGUgPiBhbmQgPCcsICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwcmVwYXJlQ29tbWFuZCgnY21kLmV4ZScsIFsnYXJnMScsICc+JywgJz4gaGVsbG8udHh0JywgJzwnLCAnPGlucHV0LmluJ10sIGZhbHNlKS50cmltKCksXG5cdFx0XHQnYXJnMSA+IFwiXj4gaGVsbG8udHh0XCIgPCBePGlucHV0LmluJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Bvd2Vyc2hlbGwnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0cHJlcGFyZUNvbW1hbmQoJ3Bvd2Vyc2hlbGwnLCBbJyE8ICddLCBmYWxzZSkudHJpbSgpLFxuXHRcdFx0YCYgJyE8ICdgKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwcmVwYXJlQ29tbWFuZCgncG93ZXJzaGVsbCcsIFsnaGVsbG8nLCAnd29ybGQnLCAnLS1mbGFnPXRydWUnXSwgZmFsc2UpLnRyaW0oKSxcblx0XHRcdGAmICdoZWxsbycgJ3dvcmxkJyAnLS1mbGFnPXRydWUnYCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0cHJlcGFyZUNvbW1hbmQoJ3Bvd2Vyc2hlbGwnLCBbJyBzcGFjZSBhcmcgJ10sIGZhbHNlKS50cmltKCksXG5cdFx0XHRgJiAnIHNwYWNlIGFyZyAnYCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0cHJlcGFyZUNvbW1hbmQoJ3Bvd2Vyc2hlbGwnLCBbJ1wiQT4wXCInXSwgZmFsc2UpLnRyaW0oKSxcblx0XHRcdGAmICdcIkE+MFwiJ2ApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHByZXBhcmVDb21tYW5kKCdwb3dlcnNoZWxsJywgWycnXSwgZmFsc2UpLnRyaW0oKSxcblx0XHRcdGAmICcnYCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwcmVwYXJlQ29tbWFuZCgncG93ZXJzaGVsbCcsIFsnITwgJ10sIHRydWUpLnRyaW0oKSxcblx0XHRcdCchPCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHByZXBhcmVDb21tYW5kKCdwb3dlcnNoZWxsJywgWydoZWxsbycsICd3b3JsZCcsICctLWZsYWc9dHJ1ZSddLCB0cnVlKS50cmltKCksXG5cdFx0XHQnaGVsbG8gd29ybGQgLS1mbGFnPXRydWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwcmVwYXJlQ29tbWFuZCgncG93ZXJzaGVsbCcsIFsnIHNwYWNlIGFyZyAnXSwgdHJ1ZSkudHJpbSgpLFxuXHRcdFx0J3NwYWNlIGFyZycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHByZXBhcmVDb21tYW5kKCdwb3dlcnNoZWxsJywgWydcIkE+MFwiJ10sIHRydWUpLnRyaW0oKSxcblx0XHRcdCdcIkE+MFwiJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0cHJlcGFyZUNvbW1hbmQoJ3Bvd2Vyc2hlbGwnLCBbJyddLCB0cnVlKS50cmltKCksXG5cdFx0XHRgYCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Bvd2Vyc2hlbGwgLSBkbyBub3QgZXNjYXBlID4gYW5kIDwnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0cHJlcGFyZUNvbW1hbmQoJ3Bvd2Vyc2hlbGwnLCBbJ2FyZzEnLCAnPicsICc+IGhlbGxvLnR4dCcsICc8JywgJzxpbnB1dC5pbiddLCBmYWxzZSkudHJpbSgpLFxuXHRcdFx0YCYgJ2FyZzEnID4gJz4gaGVsbG8udHh0JyA8ICc8aW5wdXQuaW4nYCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxzQkFBc0I7QUFHL0IsTUFBTSwwQkFBMEIsTUFBTTtBQUNyQywwQ0FBd0M7QUFFeEMsT0FBSyxRQUFRLE1BQU07QUFDbEIsV0FBTztBQUFBLE1BQ04sZUFBZSxRQUFRLENBQUMsT0FBTyxHQUFHLEtBQUssRUFBRSxLQUFLO0FBQUEsTUFDOUM7QUFBQSxJQUFpQjtBQUNsQixXQUFPO0FBQUEsTUFDTixlQUFlLFFBQVEsQ0FBQyxTQUFTLFNBQVMsYUFBYSxHQUFHLEtBQUssRUFBRSxLQUFLO0FBQUEsTUFDdEU7QUFBQSxJQUF5QjtBQUMxQixXQUFPO0FBQUEsTUFDTixlQUFlLFFBQVEsQ0FBQyxhQUFhLEdBQUcsS0FBSyxFQUFFLEtBQUs7QUFBQSxNQUNwRDtBQUFBLElBQWtCO0FBRW5CLFdBQU87QUFBQSxNQUNOLGVBQWUsUUFBUSxDQUFDLE9BQU8sR0FBRyxJQUFJLEVBQUUsS0FBSztBQUFBLE1BQzdDO0FBQUEsSUFBTztBQUNSLFdBQU87QUFBQSxNQUNOLGVBQWUsUUFBUSxDQUFDLFNBQVMsU0FBUyxhQUFhLEdBQUcsSUFBSSxFQUFFLEtBQUs7QUFBQSxNQUNyRTtBQUFBLElBQXlCO0FBQzFCLFdBQU87QUFBQSxNQUNOLGVBQWUsUUFBUSxDQUFDLGFBQWEsR0FBRyxJQUFJLEVBQUUsS0FBSztBQUFBLE1BQ25EO0FBQUEsSUFBVztBQUFBLEVBQ2IsQ0FBQztBQUVELE9BQUssZ0NBQWdDLE1BQU07QUFDMUMsV0FBTztBQUFBLE1BQ04sZUFBZSxRQUFRLENBQUMsUUFBUSxLQUFLLGVBQWUsS0FBSyxXQUFXLEdBQUcsS0FBSyxFQUFFLEtBQUs7QUFBQSxNQUNuRjtBQUFBLElBQXNDO0FBQUEsRUFDeEMsQ0FBQztBQUVELE9BQUssT0FBTyxNQUFNO0FBQ2pCLFdBQU87QUFBQSxNQUNOLGVBQWUsV0FBVyxDQUFDLE1BQU0sR0FBRyxLQUFLLEVBQUUsS0FBSztBQUFBLE1BQ2hEO0FBQUEsSUFBVztBQUNaLFdBQU87QUFBQSxNQUNOLGVBQWUsV0FBVyxDQUFDLFNBQVMsU0FBUyxhQUFhLEdBQUcsS0FBSyxFQUFFLEtBQUs7QUFBQSxNQUN6RTtBQUFBLElBQXlCO0FBQzFCLFdBQU87QUFBQSxNQUNOLGVBQWUsV0FBVyxDQUFDLGFBQWEsR0FBRyxLQUFLLEVBQUUsS0FBSztBQUFBLE1BQ3ZEO0FBQUEsSUFBZTtBQUNoQixXQUFPO0FBQUEsTUFDTixlQUFlLFdBQVcsQ0FBQyxPQUFPLEdBQUcsS0FBSyxFQUFFLEtBQUs7QUFBQSxNQUNqRDtBQUFBLElBQVk7QUFDYixXQUFPO0FBQUEsTUFDTixlQUFlLFdBQVcsQ0FBQyxFQUFFLEdBQUcsS0FBSyxFQUFFLEtBQUs7QUFBQSxNQUM1QztBQUFBLElBQUk7QUFFTCxXQUFPO0FBQUEsTUFDTixlQUFlLFdBQVcsQ0FBQyxNQUFNLEdBQUcsSUFBSSxFQUFFLEtBQUs7QUFBQSxNQUMvQztBQUFBLElBQUs7QUFDTixXQUFPO0FBQUEsTUFDTixlQUFlLFdBQVcsQ0FBQyxTQUFTLFNBQVMsYUFBYSxHQUFHLElBQUksRUFBRSxLQUFLO0FBQUEsTUFDeEU7QUFBQSxJQUF5QjtBQUMxQixXQUFPO0FBQUEsTUFDTixlQUFlLFdBQVcsQ0FBQyxhQUFhLEdBQUcsSUFBSSxFQUFFLEtBQUs7QUFBQSxNQUN0RDtBQUFBLElBQVc7QUFDWixXQUFPO0FBQUEsTUFDTixlQUFlLFdBQVcsQ0FBQyxPQUFPLEdBQUcsSUFBSSxFQUFFLEtBQUs7QUFBQSxNQUNoRDtBQUFBLElBQU87QUFDUixXQUFPO0FBQUEsTUFDTixlQUFlLFdBQVcsQ0FBQyxFQUFFLEdBQUcsSUFBSSxFQUFFLEtBQUs7QUFBQSxNQUMzQztBQUFBLElBQUU7QUFBQSxFQUNKLENBQUM7QUFFRCxPQUFLLCtCQUErQixNQUFNO0FBQ3pDLFdBQU87QUFBQSxNQUNOLGVBQWUsV0FBVyxDQUFDLFFBQVEsS0FBSyxlQUFlLEtBQUssV0FBVyxHQUFHLEtBQUssRUFBRSxLQUFLO0FBQUEsTUFDdEY7QUFBQSxJQUFvQztBQUFBLEVBQ3RDLENBQUM7QUFFRCxPQUFLLGNBQWMsTUFBTTtBQUN4QixXQUFPO0FBQUEsTUFDTixlQUFlLGNBQWMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxFQUFFLEtBQUs7QUFBQSxNQUNsRDtBQUFBLElBQVM7QUFDVixXQUFPO0FBQUEsTUFDTixlQUFlLGNBQWMsQ0FBQyxTQUFTLFNBQVMsYUFBYSxHQUFHLEtBQUssRUFBRSxLQUFLO0FBQUEsTUFDNUU7QUFBQSxJQUFpQztBQUNsQyxXQUFPO0FBQUEsTUFDTixlQUFlLGNBQWMsQ0FBQyxhQUFhLEdBQUcsS0FBSyxFQUFFLEtBQUs7QUFBQSxNQUMxRDtBQUFBLElBQWlCO0FBQ2xCLFdBQU87QUFBQSxNQUNOLGVBQWUsY0FBYyxDQUFDLE9BQU8sR0FBRyxLQUFLLEVBQUUsS0FBSztBQUFBLE1BQ3BEO0FBQUEsSUFBVztBQUNaLFdBQU87QUFBQSxNQUNOLGVBQWUsY0FBYyxDQUFDLEVBQUUsR0FBRyxLQUFLLEVBQUUsS0FBSztBQUFBLE1BQy9DO0FBQUEsSUFBTTtBQUVQLFdBQU87QUFBQSxNQUNOLGVBQWUsY0FBYyxDQUFDLEtBQUssR0FBRyxJQUFJLEVBQUUsS0FBSztBQUFBLE1BQ2pEO0FBQUEsSUFBSTtBQUNMLFdBQU87QUFBQSxNQUNOLGVBQWUsY0FBYyxDQUFDLFNBQVMsU0FBUyxhQUFhLEdBQUcsSUFBSSxFQUFFLEtBQUs7QUFBQSxNQUMzRTtBQUFBLElBQXlCO0FBQzFCLFdBQU87QUFBQSxNQUNOLGVBQWUsY0FBYyxDQUFDLGFBQWEsR0FBRyxJQUFJLEVBQUUsS0FBSztBQUFBLE1BQ3pEO0FBQUEsSUFBVztBQUNaLFdBQU87QUFBQSxNQUNOLGVBQWUsY0FBYyxDQUFDLE9BQU8sR0FBRyxJQUFJLEVBQUUsS0FBSztBQUFBLE1BQ25EO0FBQUEsSUFBTztBQUNSLFdBQU87QUFBQSxNQUNOLGVBQWUsY0FBYyxDQUFDLEVBQUUsR0FBRyxJQUFJLEVBQUUsS0FBSztBQUFBLE1BQzlDO0FBQUEsSUFBRTtBQUFBLEVBQ0osQ0FBQztBQUVELE9BQUssc0NBQXNDLE1BQU07QUFDaEQsV0FBTztBQUFBLE1BQ04sZUFBZSxjQUFjLENBQUMsUUFBUSxLQUFLLGVBQWUsS0FBSyxXQUFXLEdBQUcsS0FBSyxFQUFFLEtBQUs7QUFBQSxNQUN6RjtBQUFBLElBQXdDO0FBQUEsRUFDMUMsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
