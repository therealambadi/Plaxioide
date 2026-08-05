import { IndentAction } from "../../../../common/languages/languageConfiguration.js";
const javascriptOnEnterRules = [
  {
    // e.g. /** | */
    beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
    afterText: /^\s*\*\/$/,
    action: { indentAction: IndentAction.IndentOutdent, appendText: " * " }
  },
  {
    // e.g. /** ...|
    beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
    action: { indentAction: IndentAction.None, appendText: " * " }
  },
  {
    // e.g.  * ...|
    beforeText: /^(\t|[ ])*[ ]\*([ ]([^\*]|\*(?!\/))*)?$/,
    previousLineText: /(?=^(\s*(\/\*\*|\*)).*)(?=(?!(\s*\*\/)))/,
    action: { indentAction: IndentAction.None, appendText: "* " }
  },
  {
    // e.g.  */|
    beforeText: /^(\t|[ ])*[ ]\*\/\s*$/,
    action: { indentAction: IndentAction.None, removeText: 1 }
  },
  {
    // e.g.  *-----*/|
    beforeText: /^(\t|[ ])*[ ]\*[^/]*\*\/\s*$/,
    action: { indentAction: IndentAction.None, removeText: 1 }
  },
  {
    beforeText: /^\s*(\bcase\s.+:|\bdefault:)$/,
    afterText: /^(?!\s*(\bcase\b|\bdefault\b))/,
    action: { indentAction: IndentAction.Indent }
  },
  {
    previousLineText: /^\s*(((else ?)?if|for|while)\s*\(.*\)\s*|else\s*)$/,
    beforeText: /^\s+([^{i\s]|i(?!f\b))/,
    action: { indentAction: IndentAction.Outdent }
  },
  // Indent when pressing enter from inside ()
  {
    beforeText: /^.*\([^\)]*$/,
    afterText: /^\s*\).*$/,
    action: { indentAction: IndentAction.IndentOutdent, appendText: "	" }
  },
  // Indent when pressing enter from inside {}
  {
    beforeText: /^.*\{[^\}]*$/,
    afterText: /^\s*\}.*$/,
    action: { indentAction: IndentAction.IndentOutdent, appendText: "	" }
  },
  // Indent when pressing enter from inside []
  {
    beforeText: /^.*\[[^\]]*$/,
    afterText: /^\s*\].*$/,
    action: { indentAction: IndentAction.IndentOutdent, appendText: "	" }
  }
];
const phpOnEnterRules = [
  {
    beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
    afterText: /^\s*\*\/$/,
    action: {
      indentAction: IndentAction.IndentOutdent,
      appendText: " * "
    }
  },
  {
    beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
    action: {
      indentAction: IndentAction.None,
      appendText: " * "
    }
  },
  {
    beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
    action: {
      indentAction: IndentAction.None,
      appendText: "* "
    }
  },
  {
    beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
    action: {
      indentAction: IndentAction.None,
      removeText: 1
    }
  },
  {
    beforeText: /^(\t|(\ \ ))*\ \*[^/]*\*\/\s*$/,
    action: {
      indentAction: IndentAction.None,
      removeText: 1
    }
  },
  {
    beforeText: /^\s+([^{i\s]|i(?!f\b))/,
    previousLineText: /^\s*(((else ?)?if|for(each)?|while)\s*\(.*\)\s*|else\s*)$/,
    action: {
      indentAction: IndentAction.Outdent
    }
  }
];
const cppOnEnterRules = [
  {
    previousLineText: /^\s*(((else ?)?if|for|while)\s*\(.*\)\s*|else\s*)$/,
    beforeText: /^\s+([^{i\s]|i(?!f\b))/,
    action: {
      indentAction: IndentAction.Outdent
    }
  }
];
const htmlOnEnterRules = [
  {
    beforeText: /<(?!(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr))([_:\w][_:\w\-.\d]*)(?:(?:[^'"/>]|"[^"]*"|'[^']*')*?(?!\/)>)[^<]*$/i,
    afterText: /^<\/([_:\w][_:\w\-.\d]*)\s*>/i,
    action: {
      indentAction: IndentAction.IndentOutdent
    }
  },
  {
    beforeText: /<(?!(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr))([_:\w][_:\w\-.\d]*)(?:(?:[^'"/>]|"[^"]*"|'[^']*')*?(?!\/)>)[^<]*$/i,
    action: {
      indentAction: IndentAction.Indent
    }
  }
];
export {
  cppOnEnterRules,
  htmlOnEnterRules,
  javascriptOnEnterRules,
  phpOnEnterRules
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZXMvc3VwcG9ydHMvb25FbnRlclJ1bGVzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSW5kZW50QWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb24uanMnO1xuXG5leHBvcnQgY29uc3QgamF2YXNjcmlwdE9uRW50ZXJSdWxlcyA9IFtcblx0e1xuXHRcdC8vIGUuZy4gLyoqIHwgKi9cblx0XHRiZWZvcmVUZXh0OiAvXlxccypcXC9cXCpcXCooPyFcXC8pKFteXFwqXXxcXCooPyFcXC8pKSokLyxcblx0XHRhZnRlclRleHQ6IC9eXFxzKlxcKlxcLyQvLFxuXHRcdGFjdGlvbjogeyBpbmRlbnRBY3Rpb246IEluZGVudEFjdGlvbi5JbmRlbnRPdXRkZW50LCBhcHBlbmRUZXh0OiAnICogJyB9XG5cdH0sIHtcblx0XHQvLyBlLmcuIC8qKiAuLi58XG5cdFx0YmVmb3JlVGV4dDogL15cXHMqXFwvXFwqXFwqKD8hXFwvKShbXlxcKl18XFwqKD8hXFwvKSkqJC8sXG5cdFx0YWN0aW9uOiB7IGluZGVudEFjdGlvbjogSW5kZW50QWN0aW9uLk5vbmUsIGFwcGVuZFRleHQ6ICcgKiAnIH1cblx0fSwge1xuXHRcdC8vIGUuZy4gICogLi4ufFxuXHRcdGJlZm9yZVRleHQ6IC9eKFxcdHxbIF0pKlsgXVxcKihbIF0oW15cXCpdfFxcKig/IVxcLykpKik/JC8sXG5cdFx0cHJldmlvdXNMaW5lVGV4dDogLyg/PV4oXFxzKihcXC9cXCpcXCp8XFwqKSkuKikoPz0oPyEoXFxzKlxcKlxcLykpKS8sXG5cdFx0YWN0aW9uOiB7IGluZGVudEFjdGlvbjogSW5kZW50QWN0aW9uLk5vbmUsIGFwcGVuZFRleHQ6ICcqICcgfVxuXHR9LCB7XG5cdFx0Ly8gZS5nLiAgKi98XG5cdFx0YmVmb3JlVGV4dDogL14oXFx0fFsgXSkqWyBdXFwqXFwvXFxzKiQvLFxuXHRcdGFjdGlvbjogeyBpbmRlbnRBY3Rpb246IEluZGVudEFjdGlvbi5Ob25lLCByZW1vdmVUZXh0OiAxIH1cblx0fSxcblx0e1xuXHRcdC8vIGUuZy4gICotLS0tLSovfFxuXHRcdGJlZm9yZVRleHQ6IC9eKFxcdHxbIF0pKlsgXVxcKlteL10qXFwqXFwvXFxzKiQvLFxuXHRcdGFjdGlvbjogeyBpbmRlbnRBY3Rpb246IEluZGVudEFjdGlvbi5Ob25lLCByZW1vdmVUZXh0OiAxIH1cblx0fSxcblx0e1xuXHRcdGJlZm9yZVRleHQ6IC9eXFxzKihcXGJjYXNlXFxzLis6fFxcYmRlZmF1bHQ6KSQvLFxuXHRcdGFmdGVyVGV4dDogL14oPyFcXHMqKFxcYmNhc2VcXGJ8XFxiZGVmYXVsdFxcYikpLyxcblx0XHRhY3Rpb246IHsgaW5kZW50QWN0aW9uOiBJbmRlbnRBY3Rpb24uSW5kZW50IH1cblx0fSxcblx0e1xuXHRcdHByZXZpb3VzTGluZVRleHQ6IC9eXFxzKigoKGVsc2UgPyk/aWZ8Zm9yfHdoaWxlKVxccypcXCguKlxcKVxccyp8ZWxzZVxccyopJC8sXG5cdFx0YmVmb3JlVGV4dDogL15cXHMrKFtee2lcXHNdfGkoPyFmXFxiKSkvLFxuXHRcdGFjdGlvbjogeyBpbmRlbnRBY3Rpb246IEluZGVudEFjdGlvbi5PdXRkZW50IH1cblx0fSxcblx0Ly8gSW5kZW50IHdoZW4gcHJlc3NpbmcgZW50ZXIgZnJvbSBpbnNpZGUgKClcblx0e1xuXHRcdGJlZm9yZVRleHQ6IC9eLipcXChbXlxcKV0qJC8sXG5cdFx0YWZ0ZXJUZXh0OiAvXlxccypcXCkuKiQvLFxuXHRcdGFjdGlvbjogeyBpbmRlbnRBY3Rpb246IEluZGVudEFjdGlvbi5JbmRlbnRPdXRkZW50LCBhcHBlbmRUZXh0OiAnXFx0JyB9XG5cdH0sXG5cdC8vIEluZGVudCB3aGVuIHByZXNzaW5nIGVudGVyIGZyb20gaW5zaWRlIHt9XG5cdHtcblx0XHRiZWZvcmVUZXh0OiAvXi4qXFx7W15cXH1dKiQvLFxuXHRcdGFmdGVyVGV4dDogL15cXHMqXFx9LiokLyxcblx0XHRhY3Rpb246IHsgaW5kZW50QWN0aW9uOiBJbmRlbnRBY3Rpb24uSW5kZW50T3V0ZGVudCwgYXBwZW5kVGV4dDogJ1xcdCcgfVxuXHR9LFxuXHQvLyBJbmRlbnQgd2hlbiBwcmVzc2luZyBlbnRlciBmcm9tIGluc2lkZSBbXVxuXHR7XG5cdFx0YmVmb3JlVGV4dDogL14uKlxcW1teXFxdXSokLyxcblx0XHRhZnRlclRleHQ6IC9eXFxzKlxcXS4qJC8sXG5cdFx0YWN0aW9uOiB7IGluZGVudEFjdGlvbjogSW5kZW50QWN0aW9uLkluZGVudE91dGRlbnQsIGFwcGVuZFRleHQ6ICdcXHQnIH1cblx0fSxcbl07XG5cbmV4cG9ydCBjb25zdCBwaHBPbkVudGVyUnVsZXMgPSBbXG5cdHtcblx0XHRiZWZvcmVUZXh0OiAvXlxccypcXC9cXCpcXCooPyFcXC8pKFteXFwqXXxcXCooPyFcXC8pKSokLyxcblx0XHRhZnRlclRleHQ6IC9eXFxzKlxcKlxcLyQvLFxuXHRcdGFjdGlvbjoge1xuXHRcdFx0aW5kZW50QWN0aW9uOiBJbmRlbnRBY3Rpb24uSW5kZW50T3V0ZGVudCxcblx0XHRcdGFwcGVuZFRleHQ6ICcgKiAnLFxuXHRcdH1cblx0fSxcblx0e1xuXHRcdGJlZm9yZVRleHQ6IC9eXFxzKlxcL1xcKlxcKig/IVxcLykoW15cXCpdfFxcKig/IVxcLykpKiQvLFxuXHRcdGFjdGlvbjoge1xuXHRcdFx0aW5kZW50QWN0aW9uOiBJbmRlbnRBY3Rpb24uTm9uZSxcblx0XHRcdGFwcGVuZFRleHQ6ICcgKiAnLFxuXHRcdH1cblx0fSxcblx0e1xuXHRcdGJlZm9yZVRleHQ6IC9eKFxcdHwoXFwgXFwgKSkqXFwgXFwqKFxcIChbXlxcKl18XFwqKD8hXFwvKSkqKT8kLyxcblx0XHRhY3Rpb246IHtcblx0XHRcdGluZGVudEFjdGlvbjogSW5kZW50QWN0aW9uLk5vbmUsXG5cdFx0XHRhcHBlbmRUZXh0OiAnKiAnLFxuXHRcdH1cblx0fSxcblx0e1xuXHRcdGJlZm9yZVRleHQ6IC9eKFxcdHwoXFwgXFwgKSkqXFwgXFwqXFwvXFxzKiQvLFxuXHRcdGFjdGlvbjoge1xuXHRcdFx0aW5kZW50QWN0aW9uOiBJbmRlbnRBY3Rpb24uTm9uZSxcblx0XHRcdHJlbW92ZVRleHQ6IDEsXG5cdFx0fVxuXHR9LFxuXHR7XG5cdFx0YmVmb3JlVGV4dDogL14oXFx0fChcXCBcXCApKSpcXCBcXCpbXi9dKlxcKlxcL1xccyokLyxcblx0XHRhY3Rpb246IHtcblx0XHRcdGluZGVudEFjdGlvbjogSW5kZW50QWN0aW9uLk5vbmUsXG5cdFx0XHRyZW1vdmVUZXh0OiAxLFxuXHRcdH1cblx0fSxcblx0e1xuXHRcdGJlZm9yZVRleHQ6IC9eXFxzKyhbXntpXFxzXXxpKD8hZlxcYikpLyxcblx0XHRwcmV2aW91c0xpbmVUZXh0OiAvXlxccyooKChlbHNlID8pP2lmfGZvcihlYWNoKT98d2hpbGUpXFxzKlxcKC4qXFwpXFxzKnxlbHNlXFxzKikkLyxcblx0XHRhY3Rpb246IHtcblx0XHRcdGluZGVudEFjdGlvbjogSW5kZW50QWN0aW9uLk91dGRlbnRcblx0XHR9XG5cdH0sXG5dO1xuXG5leHBvcnQgY29uc3QgY3BwT25FbnRlclJ1bGVzID0gW1xuXHR7XG5cdFx0cHJldmlvdXNMaW5lVGV4dDogL15cXHMqKCgoZWxzZSA/KT9pZnxmb3J8d2hpbGUpXFxzKlxcKC4qXFwpXFxzKnxlbHNlXFxzKikkLyxcblx0XHRiZWZvcmVUZXh0OiAvXlxccysoW157aVxcc118aSg/IWZcXGIpKS8sXG5cdFx0YWN0aW9uOiB7XG5cdFx0XHRpbmRlbnRBY3Rpb246IEluZGVudEFjdGlvbi5PdXRkZW50XG5cdFx0fVxuXHR9XG5dO1xuXG5leHBvcnQgY29uc3QgaHRtbE9uRW50ZXJSdWxlcyA9IFtcblx0e1xuXHRcdGJlZm9yZVRleHQ6IC88KD8hKD86YXJlYXxiYXNlfGJyfGNvbHxlbWJlZHxocnxpbWd8aW5wdXR8a2V5Z2VufGxpbmt8bWVudWl0ZW18bWV0YXxwYXJhbXxzb3VyY2V8dHJhY2t8d2JyKSkoW186XFx3XVtfOlxcd1xcLS5cXGRdKikoPzooPzpbXidcIi8+XXxcIlteXCJdKlwifCdbXiddKicpKj8oPyFcXC8pPilbXjxdKiQvaSxcblx0XHRhZnRlclRleHQ6IC9ePFxcLyhbXzpcXHddW186XFx3XFwtLlxcZF0qKVxccyo+L2ksXG5cdFx0YWN0aW9uOiB7XG5cdFx0XHRpbmRlbnRBY3Rpb246IEluZGVudEFjdGlvbi5JbmRlbnRPdXRkZW50XG5cdFx0fVxuXHR9LFxuXHR7XG5cdFx0YmVmb3JlVGV4dDogLzwoPyEoPzphcmVhfGJhc2V8YnJ8Y29sfGVtYmVkfGhyfGltZ3xpbnB1dHxrZXlnZW58bGlua3xtZW51aXRlbXxtZXRhfHBhcmFtfHNvdXJjZXx0cmFja3x3YnIpKShbXzpcXHddW186XFx3XFwtLlxcZF0qKSg/Oig/OlteJ1wiLz5dfFwiW15cIl0qXCJ8J1teJ10qJykqPyg/IVxcLyk+KVtePF0qJC9pLFxuXHRcdGFjdGlvbjoge1xuXHRcdFx0aW5kZW50QWN0aW9uOiBJbmRlbnRBY3Rpb24uSW5kZW50XG5cdFx0fVxuXHR9XG5dO1xuXG4vKlxuZXhwb3J0IGVudW0gSW5kZW50QWN0aW9uIHtcblx0Tm9uZSA9IDAsXG5cdEluZGVudCA9IDEsXG5cdEluZGVudE91dGRlbnQgPSAyLFxuXHRPdXRkZW50ID0gM1xufVxuKi9cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsb0JBQW9CO0FBRXRCLE1BQU0seUJBQXlCO0FBQUEsRUFDckM7QUFBQTtBQUFBLElBRUMsWUFBWTtBQUFBLElBQ1osV0FBVztBQUFBLElBQ1gsUUFBUSxFQUFFLGNBQWMsYUFBYSxlQUFlLFlBQVksTUFBTTtBQUFBLEVBQ3ZFO0FBQUEsRUFBRztBQUFBO0FBQUEsSUFFRixZQUFZO0FBQUEsSUFDWixRQUFRLEVBQUUsY0FBYyxhQUFhLE1BQU0sWUFBWSxNQUFNO0FBQUEsRUFDOUQ7QUFBQSxFQUFHO0FBQUE7QUFBQSxJQUVGLFlBQVk7QUFBQSxJQUNaLGtCQUFrQjtBQUFBLElBQ2xCLFFBQVEsRUFBRSxjQUFjLGFBQWEsTUFBTSxZQUFZLEtBQUs7QUFBQSxFQUM3RDtBQUFBLEVBQUc7QUFBQTtBQUFBLElBRUYsWUFBWTtBQUFBLElBQ1osUUFBUSxFQUFFLGNBQWMsYUFBYSxNQUFNLFlBQVksRUFBRTtBQUFBLEVBQzFEO0FBQUEsRUFDQTtBQUFBO0FBQUEsSUFFQyxZQUFZO0FBQUEsSUFDWixRQUFRLEVBQUUsY0FBYyxhQUFhLE1BQU0sWUFBWSxFQUFFO0FBQUEsRUFDMUQ7QUFBQSxFQUNBO0FBQUEsSUFDQyxZQUFZO0FBQUEsSUFDWixXQUFXO0FBQUEsSUFDWCxRQUFRLEVBQUUsY0FBYyxhQUFhLE9BQU87QUFBQSxFQUM3QztBQUFBLEVBQ0E7QUFBQSxJQUNDLGtCQUFrQjtBQUFBLElBQ2xCLFlBQVk7QUFBQSxJQUNaLFFBQVEsRUFBRSxjQUFjLGFBQWEsUUFBUTtBQUFBLEVBQzlDO0FBQUE7QUFBQSxFQUVBO0FBQUEsSUFDQyxZQUFZO0FBQUEsSUFDWixXQUFXO0FBQUEsSUFDWCxRQUFRLEVBQUUsY0FBYyxhQUFhLGVBQWUsWUFBWSxJQUFLO0FBQUEsRUFDdEU7QUFBQTtBQUFBLEVBRUE7QUFBQSxJQUNDLFlBQVk7QUFBQSxJQUNaLFdBQVc7QUFBQSxJQUNYLFFBQVEsRUFBRSxjQUFjLGFBQWEsZUFBZSxZQUFZLElBQUs7QUFBQSxFQUN0RTtBQUFBO0FBQUEsRUFFQTtBQUFBLElBQ0MsWUFBWTtBQUFBLElBQ1osV0FBVztBQUFBLElBQ1gsUUFBUSxFQUFFLGNBQWMsYUFBYSxlQUFlLFlBQVksSUFBSztBQUFBLEVBQ3RFO0FBQ0Q7QUFFTyxNQUFNLGtCQUFrQjtBQUFBLEVBQzlCO0FBQUEsSUFDQyxZQUFZO0FBQUEsSUFDWixXQUFXO0FBQUEsSUFDWCxRQUFRO0FBQUEsTUFDUCxjQUFjLGFBQWE7QUFBQSxNQUMzQixZQUFZO0FBQUEsSUFDYjtBQUFBLEVBQ0Q7QUFBQSxFQUNBO0FBQUEsSUFDQyxZQUFZO0FBQUEsSUFDWixRQUFRO0FBQUEsTUFDUCxjQUFjLGFBQWE7QUFBQSxNQUMzQixZQUFZO0FBQUEsSUFDYjtBQUFBLEVBQ0Q7QUFBQSxFQUNBO0FBQUEsSUFDQyxZQUFZO0FBQUEsSUFDWixRQUFRO0FBQUEsTUFDUCxjQUFjLGFBQWE7QUFBQSxNQUMzQixZQUFZO0FBQUEsSUFDYjtBQUFBLEVBQ0Q7QUFBQSxFQUNBO0FBQUEsSUFDQyxZQUFZO0FBQUEsSUFDWixRQUFRO0FBQUEsTUFDUCxjQUFjLGFBQWE7QUFBQSxNQUMzQixZQUFZO0FBQUEsSUFDYjtBQUFBLEVBQ0Q7QUFBQSxFQUNBO0FBQUEsSUFDQyxZQUFZO0FBQUEsSUFDWixRQUFRO0FBQUEsTUFDUCxjQUFjLGFBQWE7QUFBQSxNQUMzQixZQUFZO0FBQUEsSUFDYjtBQUFBLEVBQ0Q7QUFBQSxFQUNBO0FBQUEsSUFDQyxZQUFZO0FBQUEsSUFDWixrQkFBa0I7QUFBQSxJQUNsQixRQUFRO0FBQUEsTUFDUCxjQUFjLGFBQWE7QUFBQSxJQUM1QjtBQUFBLEVBQ0Q7QUFDRDtBQUVPLE1BQU0sa0JBQWtCO0FBQUEsRUFDOUI7QUFBQSxJQUNDLGtCQUFrQjtBQUFBLElBQ2xCLFlBQVk7QUFBQSxJQUNaLFFBQVE7QUFBQSxNQUNQLGNBQWMsYUFBYTtBQUFBLElBQzVCO0FBQUEsRUFDRDtBQUNEO0FBRU8sTUFBTSxtQkFBbUI7QUFBQSxFQUMvQjtBQUFBLElBQ0MsWUFBWTtBQUFBLElBQ1osV0FBVztBQUFBLElBQ1gsUUFBUTtBQUFBLE1BQ1AsY0FBYyxhQUFhO0FBQUEsSUFDNUI7QUFBQSxFQUNEO0FBQUEsRUFDQTtBQUFBLElBQ0MsWUFBWTtBQUFBLElBQ1osUUFBUTtBQUFBLE1BQ1AsY0FBYyxhQUFhO0FBQUEsSUFDNUI7QUFBQSxFQUNEO0FBQ0Q7IiwKICAibmFtZXMiOiBbXQp9Cg==
