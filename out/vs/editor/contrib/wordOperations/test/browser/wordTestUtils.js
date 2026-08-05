import { Position } from "../../../../common/core/position.js";
import { withTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
function deserializePipePositions(text) {
  let resultText = "";
  let lineNumber = 1;
  let charIndex = 0;
  const positions = [];
  for (let i = 0, len = text.length; i < len; i++) {
    const chr = text.charAt(i);
    if (chr === "\n") {
      resultText += chr;
      lineNumber++;
      charIndex = 0;
      continue;
    }
    if (chr === "|") {
      positions.push(new Position(lineNumber, charIndex + 1));
    } else {
      resultText += chr;
      charIndex++;
    }
  }
  return [resultText, positions];
}
function serializePipePositions(text, positions) {
  positions.sort(Position.compare);
  let resultText = "";
  let lineNumber = 1;
  let charIndex = 0;
  for (let i = 0, len = text.length; i < len; i++) {
    const chr = text.charAt(i);
    if (positions.length > 0 && positions[0].lineNumber === lineNumber && positions[0].column === charIndex + 1) {
      resultText += "|";
      positions.shift();
    }
    resultText += chr;
    if (chr === "\n") {
      lineNumber++;
      charIndex = 0;
    } else {
      charIndex++;
    }
  }
  if (positions.length > 0 && positions[0].lineNumber === lineNumber && positions[0].column === charIndex + 1) {
    resultText += "|";
    positions.shift();
  }
  if (positions.length > 0) {
    throw new Error(`Unexpected left over positions!!!`);
  }
  return resultText;
}
function testRepeatedActionAndExtractPositions(text, initialPosition, action, record, stopCondition, options = {}) {
  const actualStops = [];
  withTestCodeEditor(text, options, (editor) => {
    editor.setPosition(initialPosition);
    while (true) {
      action(editor);
      actualStops.push(record(editor));
      if (stopCondition(editor)) {
        break;
      }
      if (actualStops.length > 1e3) {
        throw new Error(`Endless loop detected involving position ${editor.getPosition()}!`);
      }
    }
  });
  return actualStops;
}
export {
  deserializePipePositions,
  serializePipePositions,
  testRepeatedActionAndExtractPositions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi93b3JkT3BlcmF0aW9ucy90ZXN0L2Jyb3dzZXIvd29yZFRlc3RVdGlscy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSVRlc3RDb2RlRWRpdG9yLCBUZXN0Q29kZUVkaXRvckluc3RhbnRpYXRpb25PcHRpb25zLCB3aXRoVGVzdENvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvdGVzdENvZGVFZGl0b3IuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQ6IHN0cmluZyk6IFtzdHJpbmcsIFBvc2l0aW9uW11dIHtcblx0bGV0IHJlc3VsdFRleHQgPSAnJztcblx0bGV0IGxpbmVOdW1iZXIgPSAxO1xuXHRsZXQgY2hhckluZGV4ID0gMDtcblx0Y29uc3QgcG9zaXRpb25zOiBQb3NpdGlvbltdID0gW107XG5cdGZvciAobGV0IGkgPSAwLCBsZW4gPSB0ZXh0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0Y29uc3QgY2hyID0gdGV4dC5jaGFyQXQoaSk7XG5cdFx0aWYgKGNociA9PT0gJ1xcbicpIHtcblx0XHRcdHJlc3VsdFRleHQgKz0gY2hyO1xuXHRcdFx0bGluZU51bWJlcisrO1xuXHRcdFx0Y2hhckluZGV4ID0gMDtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblx0XHRpZiAoY2hyID09PSAnfCcpIHtcblx0XHRcdHBvc2l0aW9ucy5wdXNoKG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBjaGFySW5kZXggKyAxKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc3VsdFRleHQgKz0gY2hyO1xuXHRcdFx0Y2hhckluZGV4Kys7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBbcmVzdWx0VGV4dCwgcG9zaXRpb25zXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVBpcGVQb3NpdGlvbnModGV4dDogc3RyaW5nLCBwb3NpdGlvbnM6IFBvc2l0aW9uW10pOiBzdHJpbmcge1xuXHRwb3NpdGlvbnMuc29ydChQb3NpdGlvbi5jb21wYXJlKTtcblx0bGV0IHJlc3VsdFRleHQgPSAnJztcblx0bGV0IGxpbmVOdW1iZXIgPSAxO1xuXHRsZXQgY2hhckluZGV4ID0gMDtcblx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHRleHQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRjb25zdCBjaHIgPSB0ZXh0LmNoYXJBdChpKTtcblx0XHRpZiAocG9zaXRpb25zLmxlbmd0aCA+IDAgJiYgcG9zaXRpb25zWzBdLmxpbmVOdW1iZXIgPT09IGxpbmVOdW1iZXIgJiYgcG9zaXRpb25zWzBdLmNvbHVtbiA9PT0gY2hhckluZGV4ICsgMSkge1xuXHRcdFx0cmVzdWx0VGV4dCArPSAnfCc7XG5cdFx0XHRwb3NpdGlvbnMuc2hpZnQoKTtcblx0XHR9XG5cdFx0cmVzdWx0VGV4dCArPSBjaHI7XG5cdFx0aWYgKGNociA9PT0gJ1xcbicpIHtcblx0XHRcdGxpbmVOdW1iZXIrKztcblx0XHRcdGNoYXJJbmRleCA9IDA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNoYXJJbmRleCsrO1xuXHRcdH1cblx0fVxuXHRpZiAocG9zaXRpb25zLmxlbmd0aCA+IDAgJiYgcG9zaXRpb25zWzBdLmxpbmVOdW1iZXIgPT09IGxpbmVOdW1iZXIgJiYgcG9zaXRpb25zWzBdLmNvbHVtbiA9PT0gY2hhckluZGV4ICsgMSkge1xuXHRcdHJlc3VsdFRleHQgKz0gJ3wnO1xuXHRcdHBvc2l0aW9ucy5zaGlmdCgpO1xuXHR9XG5cdGlmIChwb3NpdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBsZWZ0IG92ZXIgcG9zaXRpb25zISEhYCk7XG5cdH1cblx0cmV0dXJuIHJlc3VsdFRleHQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKHRleHQ6IHN0cmluZywgaW5pdGlhbFBvc2l0aW9uOiBQb3NpdGlvbiwgYWN0aW9uOiAoZWRpdG9yOiBJVGVzdENvZGVFZGl0b3IpID0+IHZvaWQsIHJlY29yZDogKGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yKSA9PiBQb3NpdGlvbiwgc3RvcENvbmRpdGlvbjogKGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yKSA9PiBib29sZWFuLCBvcHRpb25zOiBUZXN0Q29kZUVkaXRvckluc3RhbnRpYXRpb25PcHRpb25zID0ge30pOiBQb3NpdGlvbltdIHtcblx0Y29uc3QgYWN0dWFsU3RvcHM6IFBvc2l0aW9uW10gPSBbXTtcblx0d2l0aFRlc3RDb2RlRWRpdG9yKHRleHQsIG9wdGlvbnMsIChlZGl0b3IpID0+IHtcblx0XHRlZGl0b3Iuc2V0UG9zaXRpb24oaW5pdGlhbFBvc2l0aW9uKTtcblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0YWN0aW9uKGVkaXRvcik7XG5cdFx0XHRhY3R1YWxTdG9wcy5wdXNoKHJlY29yZChlZGl0b3IpKTtcblx0XHRcdGlmIChzdG9wQ29uZGl0aW9uKGVkaXRvcikpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhY3R1YWxTdG9wcy5sZW5ndGggPiAxMDAwKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgRW5kbGVzcyBsb29wIGRldGVjdGVkIGludm9sdmluZyBwb3NpdGlvbiAke2VkaXRvci5nZXRQb3NpdGlvbigpfSFgKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXHRyZXR1cm4gYWN0dWFsU3RvcHM7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUE4RCwwQkFBMEI7QUFFakYsU0FBUyx5QkFBeUIsTUFBb0M7QUFDNUUsTUFBSSxhQUFhO0FBQ2pCLE1BQUksYUFBYTtBQUNqQixNQUFJLFlBQVk7QUFDaEIsUUFBTSxZQUF3QixDQUFDO0FBQy9CLFdBQVMsSUFBSSxHQUFHLE1BQU0sS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLO0FBQ2hELFVBQU0sTUFBTSxLQUFLLE9BQU8sQ0FBQztBQUN6QixRQUFJLFFBQVEsTUFBTTtBQUNqQixvQkFBYztBQUNkO0FBQ0Esa0JBQVk7QUFDWjtBQUFBLElBQ0Q7QUFDQSxRQUFJLFFBQVEsS0FBSztBQUNoQixnQkFBVSxLQUFLLElBQUksU0FBUyxZQUFZLFlBQVksQ0FBQyxDQUFDO0FBQUEsSUFDdkQsT0FBTztBQUNOLG9CQUFjO0FBQ2Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNBLFNBQU8sQ0FBQyxZQUFZLFNBQVM7QUFDOUI7QUFFTyxTQUFTLHVCQUF1QixNQUFjLFdBQStCO0FBQ25GLFlBQVUsS0FBSyxTQUFTLE9BQU87QUFDL0IsTUFBSSxhQUFhO0FBQ2pCLE1BQUksYUFBYTtBQUNqQixNQUFJLFlBQVk7QUFDaEIsV0FBUyxJQUFJLEdBQUcsTUFBTSxLQUFLLFFBQVEsSUFBSSxLQUFLLEtBQUs7QUFDaEQsVUFBTSxNQUFNLEtBQUssT0FBTyxDQUFDO0FBQ3pCLFFBQUksVUFBVSxTQUFTLEtBQUssVUFBVSxDQUFDLEVBQUUsZUFBZSxjQUFjLFVBQVUsQ0FBQyxFQUFFLFdBQVcsWUFBWSxHQUFHO0FBQzVHLG9CQUFjO0FBQ2QsZ0JBQVUsTUFBTTtBQUFBLElBQ2pCO0FBQ0Esa0JBQWM7QUFDZCxRQUFJLFFBQVEsTUFBTTtBQUNqQjtBQUNBLGtCQUFZO0FBQUEsSUFDYixPQUFPO0FBQ047QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNBLE1BQUksVUFBVSxTQUFTLEtBQUssVUFBVSxDQUFDLEVBQUUsZUFBZSxjQUFjLFVBQVUsQ0FBQyxFQUFFLFdBQVcsWUFBWSxHQUFHO0FBQzVHLGtCQUFjO0FBQ2QsY0FBVSxNQUFNO0FBQUEsRUFDakI7QUFDQSxNQUFJLFVBQVUsU0FBUyxHQUFHO0FBQ3pCLFVBQU0sSUFBSSxNQUFNLG1DQUFtQztBQUFBLEVBQ3BEO0FBQ0EsU0FBTztBQUNSO0FBRU8sU0FBUyxzQ0FBc0MsTUFBYyxpQkFBMkIsUUFBMkMsUUFBK0MsZUFBcUQsVUFBOEMsQ0FBQyxHQUFlO0FBQzNTLFFBQU0sY0FBMEIsQ0FBQztBQUNqQyxxQkFBbUIsTUFBTSxTQUFTLENBQUMsV0FBVztBQUM3QyxXQUFPLFlBQVksZUFBZTtBQUNsQyxXQUFPLE1BQU07QUFDWixhQUFPLE1BQU07QUFDYixrQkFBWSxLQUFLLE9BQU8sTUFBTSxDQUFDO0FBQy9CLFVBQUksY0FBYyxNQUFNLEdBQUc7QUFDMUI7QUFBQSxNQUNEO0FBRUEsVUFBSSxZQUFZLFNBQVMsS0FBTTtBQUM5QixjQUFNLElBQUksTUFBTSw0Q0FBNEMsT0FBTyxZQUFZLENBQUMsR0FBRztBQUFBLE1BQ3BGO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUNELFNBQU87QUFDUjsiLAogICJuYW1lcyI6IFtdCn0K
