const r = String.raw;
const linkPattern = r`(?<!\\)` + // Must not start with escape
// text
r`(!?\[` + // open prefix match -->
/**/
r`(?:` + /*****/
r`[^\[\]\\]|` + // Non-bracket chars, or...
/*****/
r`\\.|` + // Escaped char, or...
/*****/
r`\[[^\[\]]*\]` + // Matched bracket pair
/**/
r`)*` + r`\])` + // <-- close prefix match
// Destination
r`(\(\s*)` + // Pre href
/**/
r`(` + /*****/
r`[^\s\(\)<](?:[^\s\(\)]|\([^\s\(\)]*?\))*|` + // Link without whitespace, or...
/*****/
r`<(?:\\[<>]|[^<>])+>` + // In angle brackets
/**/
r`)` + // Title
/**/
r`\s*(?:"[^"]*"|'[^']*'|\([^\(\)]*\))?\s*` + r`\)`;
function getNWords(str, numWordsToCount) {
  const allWordMatches = Array.from(str.matchAll(new RegExp(linkPattern + r`|\p{sc=Han}|=+|\++|-+|[^\s\|\p{sc=Han}|=|\+|\-]+`, "gu")));
  const targetWords = allWordMatches.slice(0, numWordsToCount);
  const endIndex = numWordsToCount >= allWordMatches.length ? str.length : targetWords.length ? targetWords.at(-1).index + targetWords.at(-1)[0].length : 0;
  const value = str.substring(0, endIndex);
  return {
    value,
    returnedWordCount: targetWords.length === 0 ? value.length ? 1 : 0 : targetWords.length,
    isFullString: endIndex >= str.length,
    totalWordCount: allWordMatches.length
  };
}
function countWords(str) {
  const result = getNWords(str, Number.MAX_SAFE_INTEGER);
  return result.returnedWordCount;
}
export {
  countWords,
  getNWords
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0V29yZENvdW50ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5leHBvcnQgaW50ZXJmYWNlIElXb3JkQ291bnRSZXN1bHQge1xuXHR2YWx1ZTogc3RyaW5nO1xuXHRyZXR1cm5lZFdvcmRDb3VudDogbnVtYmVyO1xuXHR0b3RhbFdvcmRDb3VudDogbnVtYmVyO1xuXHRpc0Z1bGxTdHJpbmc6IGJvb2xlYW47XG59XG5cbmNvbnN0IHIgPSBTdHJpbmcucmF3O1xuXG4vKipcbiAqIE1hdGNoZXMgYFt0ZXh0XShsaW5rIHRpdGxlPylgIG9yIGBbdGV4dF0oPGxpbms+IHRpdGxlPylgXG4gKlxuICogVGFrZW4gZnJvbSB2c2NvZGUtbWFya2Rvd24tbGFuZ3VhZ2VzZXJ2aWNlXG4gKi9cbmNvbnN0IGxpbmtQYXR0ZXJuID1cblx0cmAoPzwhXFxcXClgICsgLy8gTXVzdCBub3Qgc3RhcnQgd2l0aCBlc2NhcGVcblxuXHQvLyB0ZXh0XG5cdHJgKCE/XFxbYCArIC8vIG9wZW4gcHJlZml4IG1hdGNoIC0tPlxuXHQvKiovcmAoPzpgICtcblx0LyoqKioqL3JgW15cXFtcXF1cXFxcXXxgICsgLy8gTm9uLWJyYWNrZXQgY2hhcnMsIG9yLi4uXG5cdC8qKioqKi9yYFxcXFwufGAgKyAvLyBFc2NhcGVkIGNoYXIsIG9yLi4uXG5cdC8qKioqKi9yYFxcW1teXFxbXFxdXSpcXF1gICsgLy8gTWF0Y2hlZCBicmFja2V0IHBhaXJcblx0LyoqL3JgKSpgICtcblx0cmBcXF0pYCArIC8vIDwtLSBjbG9zZSBwcmVmaXggbWF0Y2hcblxuXHQvLyBEZXN0aW5hdGlvblxuXHRyYChcXChcXHMqKWAgKyAvLyBQcmUgaHJlZlxuXHQvKiovcmAoYCArXG5cdC8qKioqKi9yYFteXFxzXFwoXFwpPF0oPzpbXlxcc1xcKFxcKV18XFwoW15cXHNcXChcXCldKj9cXCkpKnxgICsgLy8gTGluayB3aXRob3V0IHdoaXRlc3BhY2UsIG9yLi4uXG5cdC8qKioqKi9yYDwoPzpcXFxcWzw+XXxbXjw+XSkrPmAgKyAvLyBJbiBhbmdsZSBicmFja2V0c1xuXHQvKiovcmApYCArXG5cblx0Ly8gVGl0bGVcblx0LyoqL3JgXFxzKig/OlwiW15cIl0qXCJ8J1teJ10qJ3xcXChbXlxcKFxcKV0qXFwpKT9cXHMqYCArXG5cdHJgXFwpYDtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldE5Xb3JkcyhzdHI6IHN0cmluZywgbnVtV29yZHNUb0NvdW50OiBudW1iZXIpOiBJV29yZENvdW50UmVzdWx0IHtcblx0Ly8gVGhpcyByZWdleCBtYXRjaGVzIGVhY2ggd29yZCBhbmQgc2tpcHMgb3ZlciB3aGl0ZXNwYWNlIGFuZCBzZXBhcmF0b3JzLiBBIHdvcmQgaXM6XG5cdC8vIEEgbWFya2Rvd24gbGlua1xuXHQvLyBPbmUgY2hpbmVzZSBjaGFyYWN0ZXJcblx0Ly8gT25lIG9yIG1vcmUgKyAtID0sIGhhbmRsZWQgc28gdGhhdCBjb2RlIGxpa2UgXCJhPTErMi0zXCIgaXMgYnJva2VuIHVwIGJldHRlclxuXHQvLyBPbmUgb3IgbW9yZSBjaGFyYWN0ZXJzIHRoYXQgYXJlbid0IHdoaXRlcGFjZSBvciBhbnkgb2YgdGhlIGFib3ZlXG5cdGNvbnN0IGFsbFdvcmRNYXRjaGVzID0gQXJyYXkuZnJvbShzdHIubWF0Y2hBbGwobmV3IFJlZ0V4cChsaW5rUGF0dGVybiArIHJgfFxccHtzYz1IYW59fD0rfFxcKyt8LSt8W15cXHNcXHxcXHB7c2M9SGFufXw9fFxcK3xcXC1dK2AsICdndScpKSk7XG5cblx0Y29uc3QgdGFyZ2V0V29yZHMgPSBhbGxXb3JkTWF0Y2hlcy5zbGljZSgwLCBudW1Xb3Jkc1RvQ291bnQpO1xuXG5cdGNvbnN0IGVuZEluZGV4ID0gbnVtV29yZHNUb0NvdW50ID49IGFsbFdvcmRNYXRjaGVzLmxlbmd0aFxuXHRcdD8gc3RyLmxlbmd0aCAvLyBSZWFjaGVkIGVuZCBvZiBzdHJpbmdcblx0XHQ6IHRhcmdldFdvcmRzLmxlbmd0aCA/IHRhcmdldFdvcmRzLmF0KC0xKSEuaW5kZXggKyB0YXJnZXRXb3Jkcy5hdCgtMSkhWzBdLmxlbmd0aCA6IDA7XG5cblx0Y29uc3QgdmFsdWUgPSBzdHIuc3Vic3RyaW5nKDAsIGVuZEluZGV4KTtcblx0cmV0dXJuIHtcblx0XHR2YWx1ZSxcblx0XHRyZXR1cm5lZFdvcmRDb3VudDogdGFyZ2V0V29yZHMubGVuZ3RoID09PSAwID8gKHZhbHVlLmxlbmd0aCA/IDEgOiAwKSA6IHRhcmdldFdvcmRzLmxlbmd0aCxcblx0XHRpc0Z1bGxTdHJpbmc6IGVuZEluZGV4ID49IHN0ci5sZW5ndGgsXG5cdFx0dG90YWxXb3JkQ291bnQ6IGFsbFdvcmRNYXRjaGVzLmxlbmd0aFxuXHR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY291bnRXb3JkcyhzdHI6IHN0cmluZyk6IG51bWJlciB7XG5cdGNvbnN0IHJlc3VsdCA9IGdldE5Xb3JkcyhzdHIsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKTtcblx0cmV0dXJuIHJlc3VsdC5yZXR1cm5lZFdvcmRDb3VudDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQVlBLE1BQU0sSUFBSSxPQUFPO0FBT2pCLE1BQU0sY0FDTDtBQUFBO0FBR0E7QUFBQTtBQUNJO0FBQ0c7QUFBQTtBQUNBO0FBQUE7QUFDQTtBQUFBO0FBQ0gsUUFDSjtBQUFBO0FBR0E7QUFBQTtBQUNJO0FBQ0c7QUFBQTtBQUNBO0FBQUE7QUFDSDtBQUFBO0FBR0EsNkNBQ0o7QUFFTSxTQUFTLFVBQVUsS0FBYSxpQkFBMkM7QUFNakYsUUFBTSxpQkFBaUIsTUFBTSxLQUFLLElBQUksU0FBUyxJQUFJLE9BQU8sY0FBYyxxREFBcUQsSUFBSSxDQUFDLENBQUM7QUFFbkksUUFBTSxjQUFjLGVBQWUsTUFBTSxHQUFHLGVBQWU7QUFFM0QsUUFBTSxXQUFXLG1CQUFtQixlQUFlLFNBQ2hELElBQUksU0FDSixZQUFZLFNBQVMsWUFBWSxHQUFHLEVBQUUsRUFBRyxRQUFRLFlBQVksR0FBRyxFQUFFLEVBQUcsQ0FBQyxFQUFFLFNBQVM7QUFFcEYsUUFBTSxRQUFRLElBQUksVUFBVSxHQUFHLFFBQVE7QUFDdkMsU0FBTztBQUFBLElBQ047QUFBQSxJQUNBLG1CQUFtQixZQUFZLFdBQVcsSUFBSyxNQUFNLFNBQVMsSUFBSSxJQUFLLFlBQVk7QUFBQSxJQUNuRixjQUFjLFlBQVksSUFBSTtBQUFBLElBQzlCLGdCQUFnQixlQUFlO0FBQUEsRUFDaEM7QUFDRDtBQUVPLFNBQVMsV0FBVyxLQUFxQjtBQUMvQyxRQUFNLFNBQVMsVUFBVSxLQUFLLE9BQU8sZ0JBQWdCO0FBQ3JELFNBQU8sT0FBTztBQUNmOyIsCiAgIm5hbWVzIjogW10KfQo=
