const standardBracketRules = [
  ["{", "}"],
  ["[", "]"],
  ["(", ")"]
];
const rubyBracketRules = standardBracketRules;
const cppBracketRules = standardBracketRules;
const goBracketRules = standardBracketRules;
const phpBracketRules = standardBracketRules;
const vbBracketRules = standardBracketRules;
const luaBracketRules = standardBracketRules;
const htmlBracketRules = [
  ["<!--", "-->"],
  ["{", "}"],
  ["(", ")"]
];
const typescriptBracketRules = [
  ["${", "}"],
  ["{", "}"],
  ["[", "]"],
  ["(", ")"]
];
const latexBracketRules = [
  ["{", "}"],
  ["[", "]"],
  ["(", ")"],
  ["[", ")"],
  ["(", "]"],
  ["\\left(", "\\right)"],
  ["\\left(", "\\right."],
  ["\\left.", "\\right)"],
  ["\\left[", "\\right]"],
  ["\\left[", "\\right."],
  ["\\left.", "\\right]"],
  ["\\left\\{", "\\right\\}"],
  ["\\left\\{", "\\right."],
  ["\\left.", "\\right\\}"],
  ["\\left<", "\\right>"],
  ["\\bigl(", "\\bigr)"],
  ["\\bigl[", "\\bigr]"],
  ["\\bigl\\{", "\\bigr\\}"],
  ["\\Bigl(", "\\Bigr)"],
  ["\\Bigl[", "\\Bigr]"],
  ["\\Bigl\\{", "\\Bigr\\}"],
  ["\\biggl(", "\\biggr)"],
  ["\\biggl[", "\\biggr]"],
  ["\\biggl\\{", "\\biggr\\}"],
  ["\\Biggl(", "\\Biggr)"],
  ["\\Biggl[", "\\Biggr]"],
  ["\\Biggl\\{", "\\Biggr\\}"],
  ["\\langle", "\\rangle"],
  ["\\lvert", "\\rvert"],
  ["\\lVert", "\\rVert"],
  ["\\left|", "\\right|"],
  ["\\left\\vert", "\\right\\vert"],
  ["\\left\\|", "\\right\\|"],
  ["\\left\\Vert", "\\right\\Vert"],
  ["\\left\\langle", "\\right\\rangle"],
  ["\\left\\lvert", "\\right\\rvert"],
  ["\\left\\lVert", "\\right\\rVert"],
  ["\\bigl\\langle", "\\bigr\\rangle"],
  ["\\bigl|", "\\bigr|"],
  ["\\bigl\\vert", "\\bigr\\vert"],
  ["\\bigl\\lvert", "\\bigr\\rvert"],
  ["\\bigl\\|", "\\bigr\\|"],
  ["\\bigl\\lVert", "\\bigr\\rVert"],
  ["\\bigl\\Vert", "\\bigr\\Vert"],
  ["\\Bigl\\langle", "\\Bigr\\rangle"],
  ["\\Bigl|", "\\Bigr|"],
  ["\\Bigl\\lvert", "\\Bigr\\rvert"],
  ["\\Bigl\\vert", "\\Bigr\\vert"],
  ["\\Bigl\\|", "\\Bigr\\|"],
  ["\\Bigl\\lVert", "\\Bigr\\rVert"],
  ["\\Bigl\\Vert", "\\Bigr\\Vert"],
  ["\\biggl\\langle", "\\biggr\\rangle"],
  ["\\biggl|", "\\biggr|"],
  ["\\biggl\\lvert", "\\biggr\\rvert"],
  ["\\biggl\\vert", "\\biggr\\vert"],
  ["\\biggl\\|", "\\biggr\\|"],
  ["\\biggl\\lVert", "\\biggr\\rVert"],
  ["\\biggl\\Vert", "\\biggr\\Vert"],
  ["\\Biggl\\langle", "\\Biggr\\rangle"],
  ["\\Biggl|", "\\Biggr|"],
  ["\\Biggl\\lvert", "\\Biggr\\rvert"],
  ["\\Biggl\\vert", "\\Biggr\\vert"],
  ["\\Biggl\\|", "\\Biggr\\|"],
  ["\\Biggl\\lVert", "\\Biggr\\rVert"],
  ["\\Biggl\\Vert", "\\Biggr\\Vert"]
];
export {
  cppBracketRules,
  goBracketRules,
  htmlBracketRules,
  latexBracketRules,
  luaBracketRules,
  phpBracketRules,
  rubyBracketRules,
  typescriptBracketRules,
  vbBracketRules
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZXMvc3VwcG9ydHMvYnJhY2tldFJ1bGVzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2hhcmFjdGVyUGFpciB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uLmpzJztcblxuY29uc3Qgc3RhbmRhcmRCcmFja2V0UnVsZXM6IENoYXJhY3RlclBhaXJbXSA9IFtcblx0Wyd7JywgJ30nXSxcblx0WydbJywgJ10nXSxcblx0WycoJywgJyknXVxuXTtcblxuZXhwb3J0IGNvbnN0IHJ1YnlCcmFja2V0UnVsZXMgPSBzdGFuZGFyZEJyYWNrZXRSdWxlcztcblxuZXhwb3J0IGNvbnN0IGNwcEJyYWNrZXRSdWxlcyA9IHN0YW5kYXJkQnJhY2tldFJ1bGVzO1xuXG5leHBvcnQgY29uc3QgZ29CcmFja2V0UnVsZXMgPSBzdGFuZGFyZEJyYWNrZXRSdWxlcztcblxuZXhwb3J0IGNvbnN0IHBocEJyYWNrZXRSdWxlcyA9IHN0YW5kYXJkQnJhY2tldFJ1bGVzO1xuXG5leHBvcnQgY29uc3QgdmJCcmFja2V0UnVsZXMgPSBzdGFuZGFyZEJyYWNrZXRSdWxlcztcblxuZXhwb3J0IGNvbnN0IGx1YUJyYWNrZXRSdWxlcyA9IHN0YW5kYXJkQnJhY2tldFJ1bGVzO1xuXG5leHBvcnQgY29uc3QgaHRtbEJyYWNrZXRSdWxlczogQ2hhcmFjdGVyUGFpcltdID0gW1xuXHRbJzwhLS0nLCAnLS0+J10sXG5cdFsneycsICd9J10sXG5cdFsnKCcsICcpJ11cbl07XG5cbmV4cG9ydCBjb25zdCB0eXBlc2NyaXB0QnJhY2tldFJ1bGVzOiBDaGFyYWN0ZXJQYWlyW10gPSBbXG5cdFsnJHsnLCAnfSddLFxuXHRbJ3snLCAnfSddLFxuXHRbJ1snLCAnXSddLFxuXHRbJygnLCAnKSddXG5dO1xuXG5leHBvcnQgY29uc3QgbGF0ZXhCcmFja2V0UnVsZXM6IENoYXJhY3RlclBhaXJbXSA9IFtcblx0Wyd7JywgJ30nXSxcblx0WydbJywgJ10nXSxcblx0WycoJywgJyknXSxcblx0WydbJywgJyknXSxcblx0WycoJywgJ10nXSxcblx0WydcXFxcbGVmdCgnLCAnXFxcXHJpZ2h0KSddLFxuXHRbJ1xcXFxsZWZ0KCcsICdcXFxccmlnaHQuJ10sXG5cdFsnXFxcXGxlZnQuJywgJ1xcXFxyaWdodCknXSxcblx0WydcXFxcbGVmdFsnLCAnXFxcXHJpZ2h0XSddLFxuXHRbJ1xcXFxsZWZ0WycsICdcXFxccmlnaHQuJ10sXG5cdFsnXFxcXGxlZnQuJywgJ1xcXFxyaWdodF0nXSxcblx0WydcXFxcbGVmdFxcXFx7JywgJ1xcXFxyaWdodFxcXFx9J10sXG5cdFsnXFxcXGxlZnRcXFxceycsICdcXFxccmlnaHQuJ10sXG5cdFsnXFxcXGxlZnQuJywgJ1xcXFxyaWdodFxcXFx9J10sXG5cdFsnXFxcXGxlZnQ8JywgJ1xcXFxyaWdodD4nXSxcblx0WydcXFxcYmlnbCgnLCAnXFxcXGJpZ3IpJ10sXG5cdFsnXFxcXGJpZ2xbJywgJ1xcXFxiaWdyXSddLFxuXHRbJ1xcXFxiaWdsXFxcXHsnLCAnXFxcXGJpZ3JcXFxcfSddLFxuXHRbJ1xcXFxCaWdsKCcsICdcXFxcQmlnciknXSxcblx0WydcXFxcQmlnbFsnLCAnXFxcXEJpZ3JdJ10sXG5cdFsnXFxcXEJpZ2xcXFxceycsICdcXFxcQmlnclxcXFx9J10sXG5cdFsnXFxcXGJpZ2dsKCcsICdcXFxcYmlnZ3IpJ10sXG5cdFsnXFxcXGJpZ2dsWycsICdcXFxcYmlnZ3JdJ10sXG5cdFsnXFxcXGJpZ2dsXFxcXHsnLCAnXFxcXGJpZ2dyXFxcXH0nXSxcblx0WydcXFxcQmlnZ2woJywgJ1xcXFxCaWdnciknXSxcblx0WydcXFxcQmlnZ2xbJywgJ1xcXFxCaWdncl0nXSxcblx0WydcXFxcQmlnZ2xcXFxceycsICdcXFxcQmlnZ3JcXFxcfSddLFxuXHRbJ1xcXFxsYW5nbGUnLCAnXFxcXHJhbmdsZSddLFxuXHRbJ1xcXFxsdmVydCcsICdcXFxccnZlcnQnXSxcblx0WydcXFxcbFZlcnQnLCAnXFxcXHJWZXJ0J10sXG5cdFsnXFxcXGxlZnR8JywgJ1xcXFxyaWdodHwnXSxcblx0WydcXFxcbGVmdFxcXFx2ZXJ0JywgJ1xcXFxyaWdodFxcXFx2ZXJ0J10sXG5cdFsnXFxcXGxlZnRcXFxcfCcsICdcXFxccmlnaHRcXFxcfCddLFxuXHRbJ1xcXFxsZWZ0XFxcXFZlcnQnLCAnXFxcXHJpZ2h0XFxcXFZlcnQnXSxcblx0WydcXFxcbGVmdFxcXFxsYW5nbGUnLCAnXFxcXHJpZ2h0XFxcXHJhbmdsZSddLFxuXHRbJ1xcXFxsZWZ0XFxcXGx2ZXJ0JywgJ1xcXFxyaWdodFxcXFxydmVydCddLFxuXHRbJ1xcXFxsZWZ0XFxcXGxWZXJ0JywgJ1xcXFxyaWdodFxcXFxyVmVydCddLFxuXHRbJ1xcXFxiaWdsXFxcXGxhbmdsZScsICdcXFxcYmlnclxcXFxyYW5nbGUnXSxcblx0WydcXFxcYmlnbHwnLCAnXFxcXGJpZ3J8J10sXG5cdFsnXFxcXGJpZ2xcXFxcdmVydCcsICdcXFxcYmlnclxcXFx2ZXJ0J10sXG5cdFsnXFxcXGJpZ2xcXFxcbHZlcnQnLCAnXFxcXGJpZ3JcXFxccnZlcnQnXSxcblx0WydcXFxcYmlnbFxcXFx8JywgJ1xcXFxiaWdyXFxcXHwnXSxcblx0WydcXFxcYmlnbFxcXFxsVmVydCcsICdcXFxcYmlnclxcXFxyVmVydCddLFxuXHRbJ1xcXFxiaWdsXFxcXFZlcnQnLCAnXFxcXGJpZ3JcXFxcVmVydCddLFxuXHRbJ1xcXFxCaWdsXFxcXGxhbmdsZScsICdcXFxcQmlnclxcXFxyYW5nbGUnXSxcblx0WydcXFxcQmlnbHwnLCAnXFxcXEJpZ3J8J10sXG5cdFsnXFxcXEJpZ2xcXFxcbHZlcnQnLCAnXFxcXEJpZ3JcXFxccnZlcnQnXSxcblx0WydcXFxcQmlnbFxcXFx2ZXJ0JywgJ1xcXFxCaWdyXFxcXHZlcnQnXSxcblx0WydcXFxcQmlnbFxcXFx8JywgJ1xcXFxCaWdyXFxcXHwnXSxcblx0WydcXFxcQmlnbFxcXFxsVmVydCcsICdcXFxcQmlnclxcXFxyVmVydCddLFxuXHRbJ1xcXFxCaWdsXFxcXFZlcnQnLCAnXFxcXEJpZ3JcXFxcVmVydCddLFxuXHRbJ1xcXFxiaWdnbFxcXFxsYW5nbGUnLCAnXFxcXGJpZ2dyXFxcXHJhbmdsZSddLFxuXHRbJ1xcXFxiaWdnbHwnLCAnXFxcXGJpZ2dyfCddLFxuXHRbJ1xcXFxiaWdnbFxcXFxsdmVydCcsICdcXFxcYmlnZ3JcXFxccnZlcnQnXSxcblx0WydcXFxcYmlnZ2xcXFxcdmVydCcsICdcXFxcYmlnZ3JcXFxcdmVydCddLFxuXHRbJ1xcXFxiaWdnbFxcXFx8JywgJ1xcXFxiaWdnclxcXFx8J10sXG5cdFsnXFxcXGJpZ2dsXFxcXGxWZXJ0JywgJ1xcXFxiaWdnclxcXFxyVmVydCddLFxuXHRbJ1xcXFxiaWdnbFxcXFxWZXJ0JywgJ1xcXFxiaWdnclxcXFxWZXJ0J10sXG5cdFsnXFxcXEJpZ2dsXFxcXGxhbmdsZScsICdcXFxcQmlnZ3JcXFxccmFuZ2xlJ10sXG5cdFsnXFxcXEJpZ2dsfCcsICdcXFxcQmlnZ3J8J10sXG5cdFsnXFxcXEJpZ2dsXFxcXGx2ZXJ0JywgJ1xcXFxCaWdnclxcXFxydmVydCddLFxuXHRbJ1xcXFxCaWdnbFxcXFx2ZXJ0JywgJ1xcXFxCaWdnclxcXFx2ZXJ0J10sXG5cdFsnXFxcXEJpZ2dsXFxcXHwnLCAnXFxcXEJpZ2dyXFxcXHwnXSxcblx0WydcXFxcQmlnZ2xcXFxcbFZlcnQnLCAnXFxcXEJpZ2dyXFxcXHJWZXJ0J10sXG5cdFsnXFxcXEJpZ2dsXFxcXFZlcnQnLCAnXFxcXEJpZ2dyXFxcXFZlcnQnXVxuXTtcblxuIl0sCiAgIm1hcHBpbmdzIjogIkFBT0EsTUFBTSx1QkFBd0M7QUFBQSxFQUM3QyxDQUFDLEtBQUssR0FBRztBQUFBLEVBQ1QsQ0FBQyxLQUFLLEdBQUc7QUFBQSxFQUNULENBQUMsS0FBSyxHQUFHO0FBQ1Y7QUFFTyxNQUFNLG1CQUFtQjtBQUV6QixNQUFNLGtCQUFrQjtBQUV4QixNQUFNLGlCQUFpQjtBQUV2QixNQUFNLGtCQUFrQjtBQUV4QixNQUFNLGlCQUFpQjtBQUV2QixNQUFNLGtCQUFrQjtBQUV4QixNQUFNLG1CQUFvQztBQUFBLEVBQ2hELENBQUMsUUFBUSxLQUFLO0FBQUEsRUFDZCxDQUFDLEtBQUssR0FBRztBQUFBLEVBQ1QsQ0FBQyxLQUFLLEdBQUc7QUFDVjtBQUVPLE1BQU0seUJBQTBDO0FBQUEsRUFDdEQsQ0FBQyxNQUFNLEdBQUc7QUFBQSxFQUNWLENBQUMsS0FBSyxHQUFHO0FBQUEsRUFDVCxDQUFDLEtBQUssR0FBRztBQUFBLEVBQ1QsQ0FBQyxLQUFLLEdBQUc7QUFDVjtBQUVPLE1BQU0sb0JBQXFDO0FBQUEsRUFDakQsQ0FBQyxLQUFLLEdBQUc7QUFBQSxFQUNULENBQUMsS0FBSyxHQUFHO0FBQUEsRUFDVCxDQUFDLEtBQUssR0FBRztBQUFBLEVBQ1QsQ0FBQyxLQUFLLEdBQUc7QUFBQSxFQUNULENBQUMsS0FBSyxHQUFHO0FBQUEsRUFDVCxDQUFDLFdBQVcsVUFBVTtBQUFBLEVBQ3RCLENBQUMsV0FBVyxVQUFVO0FBQUEsRUFDdEIsQ0FBQyxXQUFXLFVBQVU7QUFBQSxFQUN0QixDQUFDLFdBQVcsVUFBVTtBQUFBLEVBQ3RCLENBQUMsV0FB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
