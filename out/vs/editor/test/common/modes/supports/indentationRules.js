const javascriptIndentationRules = {
  decreaseIndentPattern: /^((?!.*?\/\*).*\*\/)?\s*[\}\]\)].*$/,
  increaseIndentPattern: /^((?!\/\/).)*(\{([^}"'`]*|(\t|[ ])*\/\/.*)|\([^)"'`]*|\[[^\]"'`]*)$/,
  // e.g.  * ...| or */| or *-----*/|
  unIndentedLinePattern: /^(\t|[ ])*[ ]\*[^/]*\*\/\s*$|^(\t|[ ])*[ ]\*\/\s*$|^(\t|[ ])*[ ]\*([ ]([^\*]|\*(?!\/))*)?$/,
  indentNextLinePattern: /^((.*=>\s*)|((.*[^\w]+|\s*)(if|while|for)\s*\(.*\)\s*))$/
};
const rubyIndentationRules = {
  decreaseIndentPattern: /^\s*([}\]]([,)]?\s*(#|$)|\.[a-zA-Z_]\w*\b)|(end|rescue|ensure|else|elsif)\b|(in|when)\s)/,
  increaseIndentPattern: /^\s*((begin|class|(private|protected)\s+def|def|else|elsif|ensure|for|if|module|rescue|unless|until|when|in|while|case)|([^#]*\sdo\b)|([^#]*=\s*(case|if|unless)))\b([^#\{;]|(\"|'|\/).*\4)*(#.*)?$/
};
const phpIndentationRules = {
  increaseIndentPattern: /({(?!.*}).*|\(|\[|((else(\s)?)?if|else|for(each)?|while|switch|case).*:)\s*((\/[/*].*|)?$|\?>)/,
  decreaseIndentPattern: /^(.*\*\/)?\s*((\})|(\)+[;,])|(\]\)*[;,])|\b(else:)|\b((end(if|for(each)?|while|switch));))/
};
const goIndentationRules = {
  decreaseIndentPattern: /^\s*(\bcase\b.*:|\bdefault\b:|}[)}]*[),]?|\)[,]?)$/,
  increaseIndentPattern: /^.*(\bcase\b.*:|\bdefault\b:|(\b(func|if|else|switch|select|for|struct)\b.*)?{[^}"'`]*|\([^)"'`]*)$/
};
const htmlIndentationRules = {
  decreaseIndentPattern: /^\s*(<\/(?!html)[-_\.A-Za-z0-9]+\b[^>]*>|-->|\})/,
  increaseIndentPattern: /<(?!\?|(?:area|base|br|col|frame|hr|html|img|input|keygen|link|menuitem|meta|param|source|track|wbr)\b|[^>]*\/>)([-_\.A-Za-z0-9]+)(?=\s|>)\b[^>]*>(?!.*<\/\1>)|<!--(?!.*-->)|\{[^}"']*$/
};
const latexIndentationRules = {
  decreaseIndentPattern: /^\s*\\end{(?!document)/,
  increaseIndentPattern: /\\begin{(?!document)([^}]*)}(?!.*\\end{\1})/
};
const luaIndentationRules = {
  decreaseIndentPattern: /^\s*((\b(elseif|else|end|until)\b)|(\})|(\)))/,
  increaseIndentPattern: /^((?!(\-\-)).)*((\b(else|function|then|do|repeat)\b((?!\b(end|until)\b).)*)|(\{\s*))$/
};
export {
  goIndentationRules,
  htmlIndentationRules,
  javascriptIndentationRules,
  latexIndentationRules,
  luaIndentationRules,
  phpIndentationRules,
  rubyIndentationRules
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZXMvc3VwcG9ydHMvaW5kZW50YXRpb25SdWxlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmV4cG9ydCBjb25zdCBqYXZhc2NyaXB0SW5kZW50YXRpb25SdWxlcyA9IHtcblx0ZGVjcmVhc2VJbmRlbnRQYXR0ZXJuOiAvXigoPyEuKj9cXC9cXCopLipcXCpcXC8pP1xccypbXFx9XFxdXFwpXS4qJC8sXG5cdGluY3JlYXNlSW5kZW50UGF0dGVybjogL14oKD8hXFwvXFwvKS4pKihcXHsoW159XCInYF0qfChcXHR8WyBdKSpcXC9cXC8uKil8XFwoW14pXCInYF0qfFxcW1teXFxdXCInYF0qKSQvLFxuXHQvLyBlLmcuICAqIC4uLnwgb3IgKi98IG9yICotLS0tLSovfFxuXHR1bkluZGVudGVkTGluZVBhdHRlcm46IC9eKFxcdHxbIF0pKlsgXVxcKlteL10qXFwqXFwvXFxzKiR8XihcXHR8WyBdKSpbIF1cXCpcXC9cXHMqJHxeKFxcdHxbIF0pKlsgXVxcKihbIF0oW15cXCpdfFxcKig/IVxcLykpKik/JC8sXG5cdGluZGVudE5leHRMaW5lUGF0dGVybjogL14oKC4qPT5cXHMqKXwoKC4qW15cXHddK3xcXHMqKShpZnx3aGlsZXxmb3IpXFxzKlxcKC4qXFwpXFxzKikpJC8sXG59O1xuXG5leHBvcnQgY29uc3QgcnVieUluZGVudGF0aW9uUnVsZXMgPSB7XG5cdGRlY3JlYXNlSW5kZW50UGF0dGVybjogL15cXHMqKFt9XFxdXShbLCldP1xccyooI3wkKXxcXC5bYS16QS1aX11cXHcqXFxiKXwoZW5kfHJlc2N1ZXxlbnN1cmV8ZWxzZXxlbHNpZilcXGJ8KGlufHdoZW4pXFxzKS8sXG5cdGluY3JlYXNlSW5kZW50UGF0dGVybjogL15cXHMqKChiZWdpbnxjbGFzc3wocHJpdmF0ZXxwcm90ZWN0ZWQpXFxzK2RlZnxkZWZ8ZWxzZXxlbHNpZnxlbnN1cmV8Zm9yfGlmfG1vZHVsZXxyZXNjdWV8dW5sZXNzfHVudGlsfHdoZW58aW58d2hpbGV8Y2FzZSl8KFteI10qXFxzZG9cXGIpfChbXiNdKj1cXHMqKGNhc2V8aWZ8dW5sZXNzKSkpXFxiKFteI1xceztdfChcXFwifCd8XFwvKS4qXFw0KSooIy4qKT8kLyxcbn07XG5cbmV4cG9ydCBjb25zdCBwaHBJbmRlbnRhdGlvblJ1bGVzID0ge1xuXHRpbmNyZWFzZUluZGVudFBhdHRlcm46IC8oeyg/IS4qfSkuKnxcXCh8XFxbfCgoZWxzZShcXHMpPyk/aWZ8ZWxzZXxmb3IoZWFjaCk/fHdoaWxlfHN3aXRjaHxjYXNlKS4qOilcXHMqKChcXC9bLypdLip8KT8kfFxcPz4pLyxcblx0ZGVjcmVhc2VJbmRlbnRQYXR0ZXJuOiAvXiguKlxcKlxcLyk/XFxzKigoXFx9KXwoXFwpK1s7LF0pfChcXF1cXCkqWzssXSl8XFxiKGVsc2U6KXxcXGIoKGVuZChpZnxmb3IoZWFjaCk/fHdoaWxlfHN3aXRjaCkpOykpLyxcbn07XG5cbmV4cG9ydCBjb25zdCBnb0luZGVudGF0aW9uUnVsZXMgPSB7XG5cdGRlY3JlYXNlSW5kZW50UGF0dGVybjogL15cXHMqKFxcYmNhc2VcXGIuKjp8XFxiZGVmYXVsdFxcYjp8fVspfV0qWyksXT98XFwpWyxdPykkLyxcblx0aW5jcmVhc2VJbmRlbnRQYXR0ZXJuOiAvXi4qKFxcYmNhc2VcXGIuKjp8XFxiZGVmYXVsdFxcYjp8KFxcYihmdW5jfGlmfGVsc2V8c3dpdGNofHNlbGVjdHxmb3J8c3RydWN0KVxcYi4qKT97W159XCInYF0qfFxcKFteKVwiJ2BdKikkLyxcbn07XG5cbmV4cG9ydCBjb25zdCBodG1sSW5kZW50YXRpb25SdWxlcyA9IHtcblx0ZGVjcmVhc2VJbmRlbnRQYXR0ZXJuOiAvXlxccyooPFxcLyg/IWh0bWwpWy1fXFwuQS1aYS16MC05XStcXGJbXj5dKj58LS0+fFxcfSkvLFxuXHRpbmNyZWFzZUluZGVudFBhdHRlcm46IC88KD8hXFw/fCg/OmFyZWF8YmFzZXxicnxjb2x8ZnJhbWV8aHJ8aHRtbHxpbWd8aW5wdXR8a2V5Z2VufGxpbmt8bWVudWl0ZW18bWV0YXxwYXJhbXxzb3VyY2V8dHJhY2t8d2JyKVxcYnxbXj5dKlxcLz4pKFstX1xcLkEtWmEtejAtOV0rKSg/PVxcc3w+KVxcYltePl0qPig/IS4qPFxcL1xcMT4pfDwhLS0oPyEuKi0tPil8XFx7W159XCInXSokLyxcbn07XG5cbmV4cG9ydCBjb25zdCBsYXRleEluZGVudGF0aW9uUnVsZXMgPSB7XG5cdGRlY3JlYXNlSW5kZW50UGF0dGVybjogL15cXHMqXFxcXGVuZHsoPyFkb2N1bWVudCkvLFxuXHRpbmNyZWFzZUluZGVudFBhdHRlcm46IC9cXFxcYmVnaW57KD8hZG9jdW1lbnQpKFtefV0qKX0oPyEuKlxcXFxlbmR7XFwxfSkvLFxufTtcblxuZXhwb3J0IGNvbnN0IGx1YUluZGVudGF0aW9uUnVsZXMgPSB7XG5cdGRlY3JlYXNlSW5kZW50UGF0dGVybjogL15cXHMqKChcXGIoZWxzZWlmfGVsc2V8ZW5kfHVudGlsKVxcYil8KFxcfSl8KFxcKSkpLyxcblx0aW5jcmVhc2VJbmRlbnRQYXR0ZXJuOiAvXigoPyEoXFwtXFwtKSkuKSooKFxcYihlbHNlfGZ1bmN0aW9ufHRoZW58ZG98cmVwZWF0KVxcYigoPyFcXGIoZW5kfHVudGlsKVxcYikuKSopfChcXHtcXHMqKSkkLyxcbn07XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLTyxNQUFNLDZCQUE2QjtBQUFBLEVBQ3pDLHVCQUF1QjtBQUFBLEVBQ3ZCLHVCQUF1QjtBQUFBO0FBQUEsRUFFdkIsdUJBQXVCO0FBQUEsRUFDdkIsdUJBQXVCO0FBQ3hCO0FBRU8sTUFBTSx1QkFBdUI7QUFBQSxFQUNuQyx1QkFBdUI7QUFBQSxFQUN2Qix1QkFBdUI7QUFDeEI7QUFFTyxNQUFNLHNCQUFzQjtBQUFBLEVBQ2xDLHVCQUF1QjtBQUFBLEVBQ3ZCLHVCQUF1QjtBQUN4QjtBQUVPLE1BQU0scUJBQXFCO0FBQUEsRUFDakMsdUJBQXVCO0FBQUEsRUFDdkIsdUJBQXVCO0FBQ3hCO0FBRU8sTUFBTSx1QkFBdUI7QUFBQSxFQUNuQyx1QkFBdUI7QUFBQSxFQUN2Qix1QkFBdUI7QUFDeEI7QUFFTyxNQUFNLHdCQUF3QjtBQUFBLEVBQ3BDLHVCQUF1QjtBQUFBLEVBQ3ZCLHVCQUF1QjtBQUN4QjtBQUVPLE1BQU0sc0JBQXNCO0FBQUEsRUFDbEMsdUJBQXVCO0FBQUEsRUFDdkIsdUJBQXVCO0FBQ3hCOyIsCiAgIm5hbWVzIjogW10KfQo=
