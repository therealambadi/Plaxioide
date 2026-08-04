const PID_EXTRACTION_PROMPT = `You are an expert process control engineer analyzing a P&ID (Piping and Instrumentation Diagram).

Extract ALL of the following from this P&ID image:

1. **Instruments** (ISA 5.1 standard):
   - Tag numbers (e.g., FIC-101, TT-202, LSH-301)
   - First letter (measured variable)
   - Subsequent letters (function)
   - Loop numbers
   - Location (field/panel/DCS/PLC)
   - Setpoints if shown
   - Ranges if shown

2. **Valves**:
   - Tag numbers
   - Type (gate/globe/ball/butterfly/check/relief/solenoid/control)
   - Actuator type (pneumatic/electric/hydraulic/manual)
   - Fail position (open/closed/last)
   - Normal position

3. **Equipment** (pumps, motors, vessels, tanks):
   - Tag numbers
   - Types and specifications
   - Capacities, ratings

4. **Piping**:
   - Line numbers
   - Sizes
   - Materials
   - From/to connections
   - Medium (what flows through)

5. **Signal lines**:
   - Type (electric/pneumatic/data/software)
   - Connections (from -> to)

6. **Control Loops**:
   - Identify complete feedback/feedforward/cascade loops
   - Sensor -> Controller -> Final Element chains
   - Control strategy (PID, On/Off, Ratio)

7. **Interlocks/Safety**:
   - Trip conditions (high-high level, low pressure, etc.)
   - Actions (close valve, stop pump, etc.)
   - Priority (safety/process/equipment)

Return the result as a JSON object matching this exact schema:
{
  "elements": [...],
  "controlLoops": [...],
  "interlocks": [...],
  "pipes": [...],
  "confidence": 0.0-1.0,
  "warnings": [...],
  "rawDescription": "brief text description of what the P&ID shows"
}`;
const PID_CODE_GEN_PROMPT = `You are an IEC 61131-3 PLC programmer generating control code from a P&ID analysis.

Given the following P&ID analysis result, generate:
1. Complete Structured Text (ST) code for all control loops and interlocks
2. Tag/variable declarations with I/O addresses
3. Function block instances (PID, TON, TOF, etc.)

Rules:
- Use standard IEC 61131-3 syntax
- Every variable must be declared in VAR blocks with proper types
- Use intermediate BOOL variables for compound logic
- Implement proper scaling for analog signals (0-27648 raw -> engineering units)
- Include timer-based debouncing for digital inputs
- Add alarm generation for out-of-range conditions
- Safety interlocks override normal control
- Use SET/RESET pattern for latch logic

Target scan time: {{scanTime}}
Safety level: {{safetyLevel}}`;
async function parsePIDImage(imageBase64, mimeType, aiProvider) {
  try {
    const response = await aiProvider(PID_EXTRACTION_PROMPT, { data: imageBase64, mimeType });
    const jsonStr = extractJSON(response);
    if (!jsonStr) {
      return {
        elements: [],
        controlLoops: [],
        interlocks: [],
        pipes: [],
        confidence: 0,
        warnings: ["Failed to extract structured data from P&ID analysis"],
        rawDescription: response
      };
    }
    const parsed = JSON.parse(jsonStr);
    return normalizeParseResult(parsed);
  } catch (err) {
    return {
      elements: [],
      controlLoops: [],
      interlocks: [],
      pipes: [],
      confidence: 0,
      warnings: [`P&ID parsing error: ${err.message}`]
    };
  }
}
async function parsePIDDescription(description, aiProvider) {
  const prompt = `${PID_EXTRACTION_PROMPT}

P&ID Description:
${description}`;
  try {
    const response = await aiProvider(prompt);
    const jsonStr = extractJSON(response);
    if (!jsonStr) {
      return {
        elements: [],
        controlLoops: [],
        interlocks: [],
        pipes: [],
        confidence: 0,
        warnings: ["Failed to parse P&ID description"],
        rawDescription: response
      };
    }
    return normalizeParseResult(JSON.parse(jsonStr));
  } catch (err) {
    return {
      elements: [],
      controlLoops: [],
      interlocks: [],
      pipes: [],
      confidence: 0,
      warnings: [`P&ID description parsing error: ${err.message}`]
    };
  }
}
async function generateCodeFromPID(request, aiProvider) {
  const contextPrompt = [
    PID_CODE_GEN_PROMPT.replace("{{scanTime}}", request.scanTime || "T#100ms").replace(
      "{{safetyLevel}}",
      request.safetyLevel || "none"
    ),
    "",
    "P&ID Analysis Data:",
    JSON.stringify(request.parseResult, null, 2),
    "",
    request.controlStrategy ? `User-specified control strategy: ${request.controlStrategy}` : "",
    "",
    "Generate the complete ST code:"
  ].join("\n");
  const response = await aiProvider(contextPrompt);
  const stCode = extractCodeBlock(response, "st") || extractCodeBlock(response, "") || response;
  const tagList = generateTagList(request.parseResult);
  const ioCount = countIO(request.parseResult);
  const ladderJson = generateLadderFromPID(request.parseResult);
  return {
    stCode,
    ladderJson: JSON.stringify(ladderJson, null, 2),
    tagList,
    ioCount
  };
}
function extractJSON(text) {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      JSON.parse(jsonMatch[0]);
      return jsonMatch[0];
    } catch {
    }
  }
  return null;
}
function extractCodeBlock(text, lang) {
  const pattern = lang ? new RegExp(`\`\`\`${lang}\\s*\\n?([\\s\\S]*?)\\n?\`\`\``) : /```\s*\n?([\s\S]*?)\n?```/;
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}
function normalizeParseResult(parsed) {
  return {
    elements: Array.isArray(parsed.elements) ? parsed.elements : [],
    controlLoops: Array.isArray(parsed.controlLoops) ? parsed.controlLoops : [],
    interlocks: Array.isArray(parsed.interlocks) ? parsed.interlocks : [],
    pipes: Array.isArray(parsed.pipes) ? parsed.pipes : [],
    confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    rawDescription: parsed.rawDescription
  };
}
function generateTagList(result) {
  const tags = [];
  let diCount = 0;
  let doCount = 0;
  let aiCount = 0;
  let aoCount = 0;
  for (const element of result.elements) {
    if (element.type === "instrument") {
      const inst = element;
      const isAnalog = ["F", "T", "P", "L", "A", "D"].includes(inst.firstLetter);
      const isOutput = inst.subsequentLetters.includes("C") || inst.subsequentLetters.includes("V");
      if (isAnalog) {
        if (isOutput) {
          tags.push({
            name: `${inst.tagNumber}_CV`,
            address: `%QW${aoCount}`,
            dataType: "INT",
            description: `${inst.measuredVariable} control output`,
            source: inst.tagNumber
          });
          aoCount++;
        } else {
          tags.push({
            name: `${inst.tagNumber}_PV`,
            address: `%IW${aiCount}`,
            dataType: "INT",
            description: `${inst.measuredVariable} process value (raw)`,
            source: inst.tagNumber
          });
          aiCount++;
        }
      } else {
        if (isOutput) {
          tags.push({
            name: inst.tagNumber,
            address: `%QX0.${doCount}`,
            dataType: "BOOL",
            description: `${inst.measuredVariable} digital output`,
            source: inst.tagNumber
          });
          doCount++;
        } else {
          tags.push({
            name: inst.tagNumber,
            address: `%IX0.${diCount}`,
            dataType: "BOOL",
            description: `${inst.measuredVariable} digital input`,
            source: inst.tagNumber
          });
          diCount++;
        }
      }
    }
    if (element.type === "valve") {
      const valve = element;
      if (valve.valveType === "solenoid" || valve.actuatorType === "electric") {
        tags.push({
          name: `${valve.tagNumber}_CMD`,
          address: `%QX0.${doCount}`,
          dataType: "BOOL",
          description: `${valve.tagNumber} command`,
          source: valve.tagNumber
        });
        doCount++;
        tags.push({
          name: `${valve.tagNumber}_FB`,
          address: `%IX0.${diCount}`,
          dataType: "BOOL",
          description: `${valve.tagNumber} feedback`,
          source: valve.tagNumber
        });
        diCount++;
      }
    }
    if (element.type === "pump") {
      const pump = element;
      tags.push({
        name: `${pump.tagNumber}_RUN`,
        address: `%QX0.${doCount}`,
        dataType: "BOOL",
        description: `${pump.tagNumber} run command`,
        source: pump.tagNumber
      });
      doCount++;
      tags.push({
        name: `${pump.tagNumber}_RUN_FB`,
        address: `%IX0.${diCount}`,
        dataType: "BOOL",
        description: `${pump.tagNumber} running feedback`,
        source: pump.tagNumber
      });
      diCount++;
    }
  }
  return tags;
}
function countIO(result) {
  let digitalInputs = 0;
  let digitalOutputs = 0;
  let analogInputs = 0;
  let analogOutputs = 0;
  for (const element of result.elements) {
    switch (element.type) {
      case "instrument": {
        const inst = element;
        const isAnalog = ["F", "T", "P", "L", "A", "D"].includes(inst.firstLetter);
        const isOutput = inst.subsequentLetters.includes("C");
        if (isAnalog) {
          if (isOutput) {
            analogOutputs++;
          } else {
            analogInputs++;
          }
        } else {
          if (isOutput) {
            digitalOutputs++;
          } else {
            digitalInputs++;
          }
        }
        break;
      }
      case "valve":
        digitalOutputs++;
        digitalInputs++;
        break;
      case "pump":
        digitalOutputs++;
        digitalInputs++;
        break;
      case "motor":
        digitalOutputs++;
        digitalInputs++;
        break;
    }
  }
  return { digitalInputs, digitalOutputs, analogInputs, analogOutputs };
}
function generateLadderFromPID(result) {
  const rungs = [];
  for (const interlock of result.interlocks) {
    const contacts = interlock.instruments.map((inst) => ({
      type: inst.subsequentLetters.includes("S") ? "NC" : "NO",
      tag: inst.tagNumber,
      name: inst.description || inst.tagNumber
    }));
    rungs.push({
      comment: `Interlock: ${interlock.name}`,
      elements: contacts,
      coils: interlock.actions.map((action) => ({
        type: "STANDARD",
        tag: action.replace(/\s+/g, "_"),
        name: action
      }))
    });
  }
  for (const loop of result.controlLoops) {
    rungs.push({
      comment: `Control Loop: ${loop.description}`,
      elements: [
        {
          type: "NO",
          tag: `${loop.sensor.tagNumber}_OK`,
          name: "Sensor healthy"
        }
      ],
      coils: [
        {
          type: "STANDARD",
          tag: `LOOP_${loop.loopNumber}_EN`,
          name: `Loop ${loop.loopNumber} Enable`
        }
      ]
    });
  }
  return {
    name: "P&ID_Generated",
    rungs
  };
}
export {
  generateCodeFromPID,
  parsePIDDescription,
  parsePIDImage
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC92ZW5kb3IvcGlkL3BhcnNlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBQJklEIFZpc2lvbiBQYXJzZXJcbiAqXG4gKiBVc2VzIG11bHRpbW9kYWwgTExNICh2aWEgZXhpc3RpbmcgQUkgcHJvdmlkZXIgaW5mcmFzdHJ1Y3R1cmUpXG4gKiB0byBleHRyYWN0IFAmSUQgZWxlbWVudHMgZnJvbSB1cGxvYWRlZCBpbWFnZXMvUERGcy5cbiAqIENvbnZlcnRzIGV4dHJhY3RlZCBkYXRhIGludG8gUExDIGNvbnRyb2wgbG9naWMuXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBQSURQYXJzZVJlc3VsdCxcbiAgUElERWxlbWVudCxcbiAgUElEQ29udHJvbExvb3AsXG4gIFBJREludGVybG9jayxcbiAgUElESW5zdHJ1bWVudCxcbiAgUElEVmFsdmUsXG4gIFBJRFB1bXAsXG4gIFBJRFBpcGUsXG4gIFBJRENvZGVHZW5SZXF1ZXN0LFxuICBQSURDb2RlR2VuUmVzdWx0LFxufSBmcm9tICcuL3R5cGVzLmpzJztcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFAmSUQgQW5hbHlzaXMgUHJvbXB0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jb25zdCBQSURfRVhUUkFDVElPTl9QUk9NUFQgPSBgWW91IGFyZSBhbiBleHBlcnQgcHJvY2VzcyBjb250cm9sIGVuZ2luZWVyIGFuYWx5emluZyBhIFAmSUQgKFBpcGluZyBhbmQgSW5zdHJ1bWVudGF0aW9uIERpYWdyYW0pLlxuXG5FeHRyYWN0IEFMTCBvZiB0aGUgZm9sbG93aW5nIGZyb20gdGhpcyBQJklEIGltYWdlOlxuXG4xLiAqKkluc3RydW1lbnRzKiogKElTQSA1LjEgc3RhbmRhcmQpOlxuICAgLSBUYWcgbnVtYmVycyAoZS5nLiwgRklDLTEwMSwgVFQtMjAyLCBMU0gtMzAxKVxuICAgLSBGaXJzdCBsZXR0ZXIgKG1lYXN1cmVkIHZhcmlhYmxlKVxuICAgLSBTdWJzZXF1ZW50IGxldHRlcnMgKGZ1bmN0aW9uKVxuICAgLSBMb29wIG51bWJlcnNcbiAgIC0gTG9jYXRpb24gKGZpZWxkL3BhbmVsL0RDUy9QTEMpXG4gICAtIFNldHBvaW50cyBpZiBzaG93blxuICAgLSBSYW5nZXMgaWYgc2hvd25cblxuMi4gKipWYWx2ZXMqKjpcbiAgIC0gVGFnIG51bWJlcnNcbiAgIC0gVHlwZSAoZ2F0ZS9nbG9iZS9iYWxsL2J1dHRlcmZseS9jaGVjay9yZWxpZWYvc29sZW5vaWQvY29udHJvbClcbiAgIC0gQWN0dWF0b3IgdHlwZSAocG5ldW1hdGljL2VsZWN0cmljL2h5ZHJhdWxpYy9tYW51YWwpXG4gICAtIEZhaWwgcG9zaXRpb24gKG9wZW4vY2xvc2VkL2xhc3QpXG4gICAtIE5vcm1hbCBwb3NpdGlvblxuXG4zLiAqKkVxdWlwbWVudCoqIChwdW1wcywgbW90b3JzLCB2ZXNzZWxzLCB0YW5rcyk6XG4gICAtIFRhZyBudW1iZXJzXG4gICAtIFR5cGVzIGFuZCBzcGVjaWZpY2F0aW9uc1xuICAgLSBDYXBhY2l0aWVzLCByYXRpbmdzXG5cbjQuICoqUGlwaW5nKio6XG4gICAtIExpbmUgbnVtYmVyc1xuICAgLSBTaXplc1xuICAgLSBNYXRlcmlhbHNcbiAgIC0gRnJvbS90byBjb25uZWN0aW9uc1xuICAgLSBNZWRpdW0gKHdoYXQgZmxvd3MgdGhyb3VnaClcblxuNS4gKipTaWduYWwgbGluZXMqKjpcbiAgIC0gVHlwZSAoZWxlY3RyaWMvcG5ldW1hdGljL2RhdGEvc29mdHdhcmUpXG4gICAtIENvbm5lY3Rpb25zIChmcm9tIC0+IHRvKVxuXG42LiAqKkNvbnRyb2wgTG9vcHMqKjpcbiAgIC0gSWRlbnRpZnkgY29tcGxldGUgZmVlZGJhY2svZmVlZGZvcndhcmQvY2FzY2FkZSBsb29wc1xuICAgLSBTZW5zb3IgLT4gQ29udHJvbGxlciAtPiBGaW5hbCBFbGVtZW50IGNoYWluc1xuICAgLSBDb250cm9sIHN0cmF0ZWd5IChQSUQsIE9uL09mZiwgUmF0aW8pXG5cbjcuICoqSW50ZXJsb2Nrcy9TYWZldHkqKjpcbiAgIC0gVHJpcCBjb25kaXRpb25zIChoaWdoLWhpZ2ggbGV2ZWwsIGxvdyBwcmVzc3VyZSwgZXRjLilcbiAgIC0gQWN0aW9ucyAoY2xvc2UgdmFsdmUsIHN0b3AgcHVtcCwgZXRjLilcbiAgIC0gUHJpb3JpdHkgKHNhZmV0eS9wcm9jZXNzL2VxdWlwbWVudClcblxuUmV0dXJuIHRoZSByZXN1bHQgYXMgYSBKU09OIG9iamVjdCBtYXRjaGluZyB0aGlzIGV4YWN0IHNjaGVtYTpcbntcbiAgXCJlbGVtZW50c1wiOiBbLi4uXSxcbiAgXCJjb250cm9sTG9vcHNcIjogWy4uLl0sXG4gIFwiaW50ZXJsb2Nrc1wiOiBbLi4uXSxcbiAgXCJwaXBlc1wiOiBbLi4uXSxcbiAgXCJjb25maWRlbmNlXCI6IDAuMC0xLjAsXG4gIFwid2FybmluZ3NcIjogWy4uLl0sXG4gIFwicmF3RGVzY3JpcHRpb25cIjogXCJicmllZiB0ZXh0IGRlc2NyaXB0aW9uIG9mIHdoYXQgdGhlIFAmSUQgc2hvd3NcIlxufWA7XG5cbmNvbnN0IFBJRF9DT0RFX0dFTl9QUk9NUFQgPSBgWW91IGFyZSBhbiBJRUMgNjExMzEtMyBQTEMgcHJvZ3JhbW1lciBnZW5lcmF0aW5nIGNvbnRyb2wgY29kZSBmcm9tIGEgUCZJRCBhbmFseXNpcy5cblxuR2l2ZW4gdGhlIGZvbGxvd2luZyBQJklEIGFuYWx5c2lzIHJlc3VsdCwgZ2VuZXJhdGU6XG4xLiBDb21wbGV0ZSBTdHJ1Y3R1cmVkIFRleHQgKFNUKSBjb2RlIGZvciBhbGwgY29udHJvbCBsb29wcyBhbmQgaW50ZXJsb2Nrc1xuMi4gVGFnL3ZhcmlhYmxlIGRlY2xhcmF0aW9ucyB3aXRoIEkvTyBhZGRyZXNzZXNcbjMuIEZ1bmN0aW9uIGJsb2NrIGluc3RhbmNlcyAoUElELCBUT04sIFRPRiwgZXRjLilcblxuUnVsZXM6XG4tIFVzZSBzdGFuZGFyZCBJRUMgNjExMzEtMyBzeW50YXhcbi0gRXZlcnkgdmFyaWFibGUgbXVzdCBiZSBkZWNsYXJlZCBpbiBWQVIgYmxvY2tzIHdpdGggcHJvcGVyIHR5cGVzXG4tIFVzZSBpbnRlcm1lZGlhdGUgQk9PTCB2YXJpYWJsZXMgZm9yIGNvbXBvdW5kIGxvZ2ljXG4tIEltcGxlbWVudCBwcm9wZXIgc2NhbGluZyBmb3IgYW5hbG9nIHNpZ25hbHMgKDAtMjc2NDggcmF3IC0+IGVuZ2luZWVyaW5nIHVuaXRzKVxuLSBJbmNsdWRlIHRpbWVyLWJhc2VkIGRlYm91bmNpbmcgZm9yIGRpZ2l0YWwgaW5wdXRzXG4tIEFkZCBhbGFybSBnZW5lcmF0aW9uIGZvciBvdXQtb2YtcmFuZ2UgY29uZGl0aW9uc1xuLSBTYWZldHkgaW50ZXJsb2NrcyBvdmVycmlkZSBub3JtYWwgY29udHJvbFxuLSBVc2UgU0VUL1JFU0VUIHBhdHRlcm4gZm9yIGxhdGNoIGxvZ2ljXG5cblRhcmdldCBzY2FuIHRpbWU6IHt7c2NhblRpbWV9fVxuU2FmZXR5IGxldmVsOiB7e3NhZmV0eUxldmVsfX1gO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUGFyc2VyIEltcGxlbWVudGF0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4vKipcbiAqIFBhcnNlIGEgUCZJRCBpbWFnZSB1c2luZyB0aGUgTExNIHZpc2lvbiBjYXBhYmlsaXRpZXMuXG4gKiBVc2VzIHRoZSBleGlzdGluZyBBSSBwcm92aWRlciBpbmZyYXN0cnVjdHVyZSBpbiB2b2x0LmRpeS5cbiAqXG4gKiBAcGFyYW0gaW1hZ2VCYXNlNjQgLSBCYXNlNjQtZW5jb2RlZCBpbWFnZSBkYXRhXG4gKiBAcGFyYW0gbWltZVR5cGUgLSBJbWFnZSBNSU1FIHR5cGUgKGltYWdlL3BuZywgaW1hZ2UvanBlZywgYXBwbGljYXRpb24vcGRmKVxuICogQHBhcmFtIGFpUHJvdmlkZXIgLSBGdW5jdGlvbiB0byBjYWxsIHRoZSBBSSAocGFzc2VkIGluIHRvIGF2b2lkIGNpcmN1bGFyIGRlcHMpXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwYXJzZVBJREltYWdlKFxuICBpbWFnZUJhc2U2NDogc3RyaW5nLFxuICBtaW1lVHlwZTogc3RyaW5nLFxuICBhaVByb3ZpZGVyOiAocHJvbXB0OiBzdHJpbmcsIGltYWdlPzogeyBkYXRhOiBzdHJpbmc7IG1pbWVUeXBlOiBzdHJpbmcgfSkgPT4gUHJvbWlzZTxzdHJpbmc+LFxuKTogUHJvbWlzZTxQSURQYXJzZVJlc3VsdD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYWlQcm92aWRlcihQSURfRVhUUkFDVElPTl9QUk9NUFQsIHsgZGF0YTogaW1hZ2VCYXNlNjQsIG1pbWVUeXBlIH0pO1xuXG4gICAgLy8gRXh0cmFjdCBKU09OIGZyb20gcmVzcG9uc2UgKG1heSBiZSB3cmFwcGVkIGluIG1hcmtkb3duIGNvZGUgYmxvY2tzKVxuICAgIGNvbnN0IGpzb25TdHIgPSBleHRyYWN0SlNPTihyZXNwb25zZSk7XG5cbiAgICBpZiAoIWpzb25TdHIpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVsZW1lbnRzOiBbXSxcbiAgICAgICAgY29udHJvbExvb3BzOiBbXSxcbiAgICAgICAgaW50ZXJsb2NrczogW10sXG4gICAgICAgIHBpcGVzOiBbXSxcbiAgICAgICAgY29uZmlkZW5jZTogMCxcbiAgICAgICAgd2FybmluZ3M6IFsnRmFpbGVkIHRvIGV4dHJhY3Qgc3RydWN0dXJlZCBkYXRhIGZyb20gUCZJRCBhbmFseXNpcyddLFxuICAgICAgICByYXdEZXNjcmlwdGlvbjogcmVzcG9uc2UsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UoanNvblN0cikgYXMgUElEUGFyc2VSZXN1bHQ7XG5cbiAgICAvLyBWYWxpZGF0ZSBhbmQgbm9ybWFsaXplXG4gICAgcmV0dXJuIG5vcm1hbGl6ZVBhcnNlUmVzdWx0KHBhcnNlZCk7XG4gIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGVsZW1lbnRzOiBbXSxcbiAgICAgIGNvbnRyb2xMb29wczogW10sXG4gICAgICBpbnRlcmxvY2tzOiBbXSxcbiAgICAgIHBpcGVzOiBbXSxcbiAgICAgIGNvbmZpZGVuY2U6IDAsXG4gICAgICB3YXJuaW5nczogW2BQJklEIHBhcnNpbmcgZXJyb3I6ICR7ZXJyLm1lc3NhZ2V9YF0sXG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIFBhcnNlIGEgdGV4dCBkZXNjcmlwdGlvbiBvZiBhIFAmSUQgKGZvciB3aGVuIGltYWdlIGlzIG5vdCBhdmFpbGFibGUpXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwYXJzZVBJRERlc2NyaXB0aW9uKFxuICBkZXNjcmlwdGlvbjogc3RyaW5nLFxuICBhaVByb3ZpZGVyOiAocHJvbXB0OiBzdHJpbmcpID0+IFByb21pc2U8c3RyaW5nPixcbik6IFByb21pc2U8UElEUGFyc2VSZXN1bHQ+IHtcbiAgY29uc3QgcHJvbXB0ID0gYCR7UElEX0VYVFJBQ1RJT05fUFJPTVBUfVxcblxcblAmSUQgRGVzY3JpcHRpb246XFxuJHtkZXNjcmlwdGlvbn1gO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhaVByb3ZpZGVyKHByb21wdCk7XG4gICAgY29uc3QganNvblN0ciA9IGV4dHJhY3RKU09OKHJlc3BvbnNlKTtcblxuICAgIGlmICghanNvblN0cikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZWxlbWVudHM6IFtdLFxuICAgICAgICBjb250cm9sTG9vcHM6IFtdLFxuICAgICAgICBpbnRlcmxvY2tzOiBbXSxcbiAgICAgICAgcGlwZXM6IFtdLFxuICAgICAgICBjb25maWRlbmNlOiAwLFxuICAgICAgICB3YXJuaW5nczogWydGYWlsZWQgdG8gcGFyc2UgUCZJRCBkZXNjcmlwdGlvbiddLFxuICAgICAgICByYXdEZXNjcmlwdGlvbjogcmVzcG9uc2UsXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBub3JtYWxpemVQYXJzZVJlc3VsdChKU09OLnBhcnNlKGpzb25TdHIpKTtcbiAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZWxlbWVudHM6IFtdLFxuICAgICAgY29udHJvbExvb3BzOiBbXSxcbiAgICAgIGludGVybG9ja3M6IFtdLFxuICAgICAgcGlwZXM6IFtdLFxuICAgICAgY29uZmlkZW5jZTogMCxcbiAgICAgIHdhcm5pbmdzOiBbYFAmSUQgZGVzY3JpcHRpb24gcGFyc2luZyBlcnJvcjogJHtlcnIubWVzc2FnZX1gXSxcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGUgUExDIGNvZGUgZnJvbSBhIHBhcnNlZCBQJklEIHJlc3VsdFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVDb2RlRnJvbVBJRChcbiAgcmVxdWVzdDogUElEQ29kZUdlblJlcXVlc3QsXG4gIGFpUHJvdmlkZXI6IChwcm9tcHQ6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmc+LFxuKTogUHJvbWlzZTxQSURDb2RlR2VuUmVzdWx0PiB7XG4gIGNvbnN0IGNvbnRleHRQcm9tcHQgPSBbXG4gICAgUElEX0NPREVfR0VOX1BST01QVC5yZXBsYWNlKCd7e3NjYW5UaW1lfX0nLCByZXF1ZXN0LnNjYW5UaW1lIHx8ICdUIzEwMG1zJykucmVwbGFjZShcbiAgICAgICd7e3NhZmV0eUxldmVsfX0nLFxuICAgICAgcmVxdWVzdC5zYWZldHlMZXZlbCB8fCAnbm9uZScsXG4gICAgKSxcbiAgICAnJyxcbiAgICAnUCZJRCBBbmFseXNpcyBEYXRhOicsXG4gICAgSlNPTi5zdHJpbmdpZnkocmVxdWVzdC5wYXJzZVJlc3VsdCwgbnVsbCwgMiksXG4gICAgJycsXG4gICAgcmVxdWVzdC5jb250cm9sU3RyYXRlZ3kgPyBgVXNlci1zcGVjaWZpZWQgY29udHJvbCBzdHJhdGVneTogJHtyZXF1ZXN0LmNvbnRyb2xTdHJhdGVneX1gIDogJycsXG4gICAgJycsXG4gICAgJ0dlbmVyYXRlIHRoZSBjb21wbGV0ZSBTVCBjb2RlOicsXG4gIF0uam9pbignXFxuJyk7XG5cbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhaVByb3ZpZGVyKGNvbnRleHRQcm9tcHQpO1xuXG4gIC8vIEV4dHJhY3QgU1QgY29kZSBmcm9tIHJlc3BvbnNlXG4gIGNvbnN0IHN0Q29kZSA9IGV4dHJhY3RDb2RlQmxvY2socmVzcG9uc2UsICdzdCcpIHx8IGV4dHJhY3RDb2RlQmxvY2socmVzcG9uc2UsICcnKSB8fCByZXNwb25zZTtcblxuICAvLyBHZW5lcmF0ZSB0YWcgbGlzdCBmcm9tIGluc3RydW1lbnRzXG4gIGNvbnN0IHRhZ0xpc3QgPSBnZW5lcmF0ZVRhZ0xpc3QocmVxdWVzdC5wYXJzZVJlc3VsdCk7XG5cbiAgLy8gQ291bnQgSS9PXG4gIGNvbnN0IGlvQ291bnQgPSBjb3VudElPKHJlcXVlc3QucGFyc2VSZXN1bHQpO1xuXG4gIC8vIEdlbmVyYXRlIGJhc2ljIGxhZGRlciBKU09OIGZvciB2aXN1YWxpemF0aW9uXG4gIGNvbnN0IGxhZGRlckpzb24gPSBnZW5lcmF0ZUxhZGRlckZyb21QSUQocmVxdWVzdC5wYXJzZVJlc3VsdCk7XG5cbiAgcmV0dXJuIHtcbiAgICBzdENvZGUsXG4gICAgbGFkZGVySnNvbjogSlNPTi5zdHJpbmdpZnkobGFkZGVySnNvbiwgbnVsbCwgMiksXG4gICAgdGFnTGlzdCxcbiAgICBpb0NvdW50LFxuICB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgSGVscGVyIEZ1bmN0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gZXh0cmFjdEpTT04odGV4dDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIC8vIFRyeSB0byBmaW5kIEpTT04gaW4gY29kZSBibG9ja3NcbiAgY29uc3QgY29kZUJsb2NrTWF0Y2ggPSB0ZXh0Lm1hdGNoKC9gYGAoPzpqc29uKT9cXHMqXFxuPyhbXFxzXFxTXSo/KVxcbj9gYGAvKTtcblxuICBpZiAoY29kZUJsb2NrTWF0Y2gpIHtcbiAgICByZXR1cm4gY29kZUJsb2NrTWF0Y2hbMV0udHJpbSgpO1xuICB9XG5cbiAgLy8gVHJ5IHRvIGZpbmQgcmF3IEpTT04gb2JqZWN0XG4gIGNvbnN0IGpzb25NYXRjaCA9IHRleHQubWF0Y2goL1xce1tcXHNcXFNdKlxcfS8pO1xuXG4gIGlmIChqc29uTWF0Y2gpIHtcbiAgICB0cnkge1xuICAgICAgSlNPTi5wYXJzZShqc29uTWF0Y2hbMF0pO1xuICAgICAgcmV0dXJuIGpzb25NYXRjaFswXTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIE5vdCB2YWxpZCBKU09OXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RDb2RlQmxvY2sodGV4dDogc3RyaW5nLCBsYW5nOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgcGF0dGVybiA9IGxhbmcgPyBuZXcgUmVnRXhwKGBcXGBcXGBcXGAke2xhbmd9XFxcXHMqXFxcXG4/KFtcXFxcc1xcXFxTXSo/KVxcXFxuP1xcYFxcYFxcYGApIDogL2BgYFxccypcXG4/KFtcXHNcXFNdKj8pXFxuP2BgYC87XG5cbiAgY29uc3QgbWF0Y2ggPSB0ZXh0Lm1hdGNoKHBhdHRlcm4pO1xuXG4gIHJldHVybiBtYXRjaCA/IG1hdGNoWzFdLnRyaW0oKSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVBhcnNlUmVzdWx0KHBhcnNlZDogUElEUGFyc2VSZXN1bHQpOiBQSURQYXJzZVJlc3VsdCB7XG4gIHJldHVybiB7XG4gICAgZWxlbWVudHM6IEFycmF5LmlzQXJyYXkocGFyc2VkLmVsZW1lbnRzKSA/IHBhcnNlZC5lbGVtZW50cyA6IFtdLFxuICAgIGNvbnRyb2xMb29wczogQXJyYXkuaXNBcnJheShwYXJzZWQuY29udHJvbExvb3BzKSA/IHBhcnNlZC5jb250cm9sTG9vcHMgOiBbXSxcbiAgICBpbnRlcmxvY2tzOiBBcnJheS5pc0FycmF5KHBhcnNlZC5pbnRlcmxvY2tzKSA/IHBhcnNlZC5pbnRlcmxvY2tzIDogW10sXG4gICAgcGlwZXM6IEFycmF5LmlzQXJyYXkocGFyc2VkLnBpcGVzKSA/IHBhcnNlZC5waXBlcyA6IFtdLFxuICAgIGNvbmZpZGVuY2U6IHR5cGVvZiBwYXJzZWQuY29uZmlkZW5jZSA9PT0gJ251bWJlcicgPyBNYXRoLm1heCgwLCBNYXRoLm1pbigxLCBwYXJzZWQuY29uZmlkZW5jZSkpIDogMC41LFxuICAgIHdhcm5pbmdzOiBBcnJheS5pc0FycmF5KHBhcnNlZC53YXJuaW5ncykgPyBwYXJzZWQud2FybmluZ3MgOiBbXSxcbiAgICByYXdEZXNjcmlwdGlvbjogcGFyc2VkLnJhd0Rlc2NyaXB0aW9uLFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZVRhZ0xpc3QocmVzdWx0OiBQSURQYXJzZVJlc3VsdCk6IFBJRENvZGVHZW5SZXN1bHRbJ3RhZ0xpc3QnXSB7XG4gIGNvbnN0IHRhZ3M6IFBJRENvZGVHZW5SZXN1bHRbJ3RhZ0xpc3QnXSA9IFtdO1xuICBsZXQgZGlDb3VudCA9IDA7XG4gIGxldCBkb0NvdW50ID0gMDtcbiAgbGV0IGFpQ291bnQgPSAwO1xuICBsZXQgYW9Db3VudCA9IDA7XG5cbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIHJlc3VsdC5lbGVtZW50cykge1xuICAgIGlmIChlbGVtZW50LnR5cGUgPT09ICdpbnN0cnVtZW50Jykge1xuICAgICAgY29uc3QgaW5zdCA9IGVsZW1lbnQgYXMgUElESW5zdHJ1bWVudDtcbiAgICAgIGNvbnN0IGlzQW5hbG9nID0gWydGJywgJ1QnLCAnUCcsICdMJywgJ0EnLCAnRCddLmluY2x1ZGVzKGluc3QuZmlyc3RMZXR0ZXIpO1xuICAgICAgY29uc3QgaXNPdXRwdXQgPSBpbnN0LnN1YnNlcXVlbnRMZXR0ZXJzLmluY2x1ZGVzKCdDJykgfHwgaW5zdC5zdWJzZXF1ZW50TGV0dGVycy5pbmNsdWRlcygnVicpO1xuXG4gICAgICBpZiAoaXNBbmFsb2cpIHtcbiAgICAgICAgaWYgKGlzT3V0cHV0KSB7XG4gICAgICAgICAgdGFncy5wdXNoKHtcbiAgICAgICAgICAgIG5hbWU6IGAke2luc3QudGFnTnVtYmVyfV9DVmAsXG4gICAgICAgICAgICBhZGRyZXNzOiBgJVFXJHthb0NvdW50fWAsXG4gICAgICAgICAgICBkYXRhVHlwZTogJ0lOVCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYCR7aW5zdC5tZWFzdXJlZFZhcmlhYmxlfSBjb250cm9sIG91dHB1dGAsXG4gICAgICAgICAgICBzb3VyY2U6IGluc3QudGFnTnVtYmVyLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGFvQ291bnQrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0YWdzLnB1c2goe1xuICAgICAgICAgICAgbmFtZTogYCR7aW5zdC50YWdOdW1iZXJ9X1BWYCxcbiAgICAgICAgICAgIGFkZHJlc3M6IGAlSVcke2FpQ291bnR9YCxcbiAgICAgICAgICAgIGRhdGFUeXBlOiAnSU5UJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtpbnN0Lm1lYXN1cmVkVmFyaWFibGV9IHByb2Nlc3MgdmFsdWUgKHJhdylgLFxuICAgICAgICAgICAgc291cmNlOiBpbnN0LnRhZ051bWJlcixcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBhaUNvdW50Kys7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChpc091dHB1dCkge1xuICAgICAgICAgIHRhZ3MucHVzaCh7XG4gICAgICAgICAgICBuYW1lOiBpbnN0LnRhZ051bWJlcixcbiAgICAgICAgICAgIGFkZHJlc3M6IGAlUVgwLiR7ZG9Db3VudH1gLFxuICAgICAgICAgICAgZGF0YVR5cGU6ICdCT09MJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtpbnN0Lm1lYXN1cmVkVmFyaWFibGV9IGRpZ2l0YWwgb3V0cHV0YCxcbiAgICAgICAgICAgIHNvdXJjZTogaW5zdC50YWdOdW1iZXIsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZG9Db3VudCsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRhZ3MucHVzaCh7XG4gICAgICAgICAgICBuYW1lOiBpbnN0LnRhZ051bWJlcixcbiAgICAgICAgICAgIGFkZHJlc3M6IGAlSVgwLiR7ZGlDb3VudH1gLFxuICAgICAgICAgICAgZGF0YVR5cGU6ICdCT09MJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtpbnN0Lm1lYXN1cmVkVmFyaWFibGV9IGRpZ2l0YWwgaW5wdXRgLFxuICAgICAgICAgICAgc291cmNlOiBpbnN0LnRhZ051bWJlcixcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBkaUNvdW50Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZWxlbWVudC50eXBlID09PSAndmFsdmUnKSB7XG4gICAgICBjb25zdCB2YWx2ZSA9IGVsZW1lbnQgYXMgUElEVmFsdmU7XG5cbiAgICAgIGlmICh2YWx2ZS52YWx2ZVR5cGUgPT09ICdzb2xlbm9pZCcgfHwgdmFsdmUuYWN0dWF0b3JUeXBlID09PSAnZWxlY3RyaWMnKSB7XG4gICAgICAgIHRhZ3MucHVzaCh7XG4gICAgICAgICAgbmFtZTogYCR7dmFsdmUudGFnTnVtYmVyfV9DTURgLFxuICAgICAgICAgIGFkZHJlc3M6IGAlUVgwLiR7ZG9Db3VudH1gLFxuICAgICAgICAgIGRhdGFUeXBlOiAnQk9PTCcsXG4gICAgICAgICAgZGVzY3JpcHRpb246IGAke3ZhbHZlLnRhZ051bWJlcn0gY29tbWFuZGAsXG4gICAgICAgICAgc291cmNlOiB2YWx2ZS50YWdOdW1iZXIsXG4gICAgICAgIH0pO1xuICAgICAgICBkb0NvdW50Kys7XG5cbiAgICAgICAgdGFncy5wdXNoKHtcbiAgICAgICAgICBuYW1lOiBgJHt2YWx2ZS50YWdOdW1iZXJ9X0ZCYCxcbiAgICAgICAgICBhZGRyZXNzOiBgJUlYMC4ke2RpQ291bnR9YCxcbiAgICAgICAgICBkYXRhVHlwZTogJ0JPT0wnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHt2YWx2ZS50YWdOdW1iZXJ9IGZlZWRiYWNrYCxcbiAgICAgICAgICBzb3VyY2U6IHZhbHZlLnRhZ051bWJlcixcbiAgICAgICAgfSk7XG4gICAgICAgIGRpQ291bnQrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZWxlbWVudC50eXBlID09PSAncHVtcCcpIHtcbiAgICAgIGNvbnN0IHB1bXAgPSBlbGVtZW50IGFzIFBJRFB1bXA7XG4gICAgICB0YWdzLnB1c2goe1xuICAgICAgICBuYW1lOiBgJHtwdW1wLnRhZ051bWJlcn1fUlVOYCxcbiAgICAgICAgYWRkcmVzczogYCVRWDAuJHtkb0NvdW50fWAsXG4gICAgICAgIGRhdGFUeXBlOiAnQk9PTCcsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgJHtwdW1wLnRhZ051bWJlcn0gcnVuIGNvbW1hbmRgLFxuICAgICAgICBzb3VyY2U6IHB1bXAudGFnTnVtYmVyLFxuICAgICAgfSk7XG4gICAgICBkb0NvdW50Kys7XG5cbiAgICAgIHRhZ3MucHVzaCh7XG4gICAgICAgIG5hbWU6IGAke3B1bXAudGFnTnVtYmVyfV9SVU5fRkJgLFxuICAgICAgICBhZGRyZXNzOiBgJUlYMC4ke2RpQ291bnR9YCxcbiAgICAgICAgZGF0YVR5cGU6ICdCT09MJyxcbiAgICAgICAgZGVzY3JpcHRpb246IGAke3B1bXAudGFnTnVtYmVyfSBydW5uaW5nIGZlZWRiYWNrYCxcbiAgICAgICAgc291cmNlOiBwdW1wLnRhZ051bWJlcixcbiAgICAgIH0pO1xuICAgICAgZGlDb3VudCsrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0YWdzO1xufVxuXG5mdW5jdGlvbiBjb3VudElPKHJlc3VsdDogUElEUGFyc2VSZXN1bHQpOiBQSURDb2RlR2VuUmVzdWx0Wydpb0NvdW50J10ge1xuICBsZXQgZGlnaXRhbElucHV0cyA9IDA7XG4gIGxldCBkaWdpdGFsT3V0cHV0cyA9IDA7XG4gIGxldCBhbmFsb2dJbnB1dHMgPSAwO1xuICBsZXQgYW5hbG9nT3V0cHV0cyA9IDA7XG5cbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIHJlc3VsdC5lbGVtZW50cykge1xuICAgIHN3aXRjaCAoZWxlbWVudC50eXBlKSB7XG4gICAgICBjYXNlICdpbnN0cnVtZW50Jzoge1xuICAgICAgICBjb25zdCBpbnN0ID0gZWxlbWVudCBhcyBQSURJbnN0cnVtZW50O1xuICAgICAgICBjb25zdCBpc0FuYWxvZyA9IFsnRicsICdUJywgJ1AnLCAnTCcsICdBJywgJ0QnXS5pbmNsdWRlcyhpbnN0LmZpcnN0TGV0dGVyKTtcbiAgICAgICAgY29uc3QgaXNPdXRwdXQgPSBpbnN0LnN1YnNlcXVlbnRMZXR0ZXJzLmluY2x1ZGVzKCdDJyk7XG5cbiAgICAgICAgaWYgKGlzQW5hbG9nKSB7XG4gICAgICAgICAgaWYgKGlzT3V0cHV0KSB7XG4gICAgICAgICAgICBhbmFsb2dPdXRwdXRzKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFuYWxvZ0lucHV0cysrO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoaXNPdXRwdXQpIHtcbiAgICAgICAgICAgIGRpZ2l0YWxPdXRwdXRzKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRpZ2l0YWxJbnB1dHMrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJ3ZhbHZlJzpcbiAgICAgICAgZGlnaXRhbE91dHB1dHMrKztcbiAgICAgICAgZGlnaXRhbElucHV0cysrOyAvLyBmZWVkYmFja1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3B1bXAnOlxuICAgICAgICBkaWdpdGFsT3V0cHV0cysrO1xuICAgICAgICBkaWdpdGFsSW5wdXRzKys7IC8vIHJ1bm5pbmcgZmVlZGJhY2tcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdtb3Rvcic6XG4gICAgICAgIGRpZ2l0YWxPdXRwdXRzKys7XG4gICAgICAgIGRpZ2l0YWxJbnB1dHMrKztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZGlnaXRhbElucHV0cywgZGlnaXRhbE91dHB1dHMsIGFuYWxvZ0lucHV0cywgYW5hbG9nT3V0cHV0cyB9O1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUxhZGRlckZyb21QSUQocmVzdWx0OiBQSURQYXJzZVJlc3VsdCk6IG9iamVjdCB7XG4gIGNvbnN0IHJ1bmdzOiBhbnlbXSA9IFtdO1xuXG4gIC8vIEdlbmVyYXRlIGludGVybG9ja3MgYXMgcnVuZ3NcbiAgZm9yIChjb25zdCBpbnRlcmxvY2sgb2YgcmVzdWx0LmludGVybG9ja3MpIHtcbiAgICBjb25zdCBjb250YWN0cyA9IGludGVybG9jay5pbnN0cnVtZW50cy5tYXAoKGluc3QpID0+ICh7XG4gICAgICB0eXBlOiBpbnN0LnN1YnNlcXVlbnRMZXR0ZXJzLmluY2x1ZGVzKCdTJykgPyAnTkMnIDogJ05PJyxcbiAgICAgIHRhZzogaW5zdC50YWdOdW1iZXIsXG4gICAgICBuYW1lOiBpbnN0LmRlc2NyaXB0aW9uIHx8IGluc3QudGFnTnVtYmVyLFxuICAgIH0pKTtcblxuICAgIHJ1bmdzLnB1c2goe1xuICAgICAgY29tbWVudDogYEludGVybG9jazogJHtpbnRlcmxvY2submFtZX1gLFxuICAgICAgZWxlbWVudHM6IGNvbnRhY3RzLFxuICAgICAgY29pbHM6IGludGVybG9jay5hY3Rpb25zLm1hcCgoYWN0aW9uKSA9PiAoe1xuICAgICAgICB0eXBlOiAnU1RBTkRBUkQnLFxuICAgICAgICB0YWc6IGFjdGlvbi5yZXBsYWNlKC9cXHMrL2csICdfJyksXG4gICAgICAgIG5hbWU6IGFjdGlvbixcbiAgICAgIH0pKSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlIGNvbnRyb2wgbG9vcCBlbmFibGUgcnVuZ3NcbiAgZm9yIChjb25zdCBsb29wIG9mIHJlc3VsdC5jb250cm9sTG9vcHMpIHtcbiAgICBydW5ncy5wdXNoKHtcbiAgICAgIGNvbW1lbnQ6IGBDb250cm9sIExvb3A6ICR7bG9vcC5kZXNjcmlwdGlvbn1gLFxuICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHR5cGU6ICdOTycsXG4gICAgICAgICAgdGFnOiBgJHtsb29wLnNlbnNvci50YWdOdW1iZXJ9X09LYCxcbiAgICAgICAgICBuYW1lOiAnU2Vuc29yIGhlYWx0aHknLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGNvaWxzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0eXBlOiAnU1RBTkRBUkQnLFxuICAgICAgICAgIHRhZzogYExPT1BfJHtsb29wLmxvb3BOdW1iZXJ9X0VOYCxcbiAgICAgICAgICBuYW1lOiBgTG9vcCAke2xvb3AubG9vcE51bWJlcn0gRW5hYmxlYCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG5hbWU6ICdQJklEX0dlbmVyYXRlZCcsXG4gICAgcnVuZ3MsXG4gIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUF1QkEsTUFBTSx3QkFBd0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQXlEOUIsTUFBTSxzQkFBc0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUE4QjVCLGVBQXNCLGNBQ3BCLGFBQ0EsVUFDQSxZQUN5QjtBQUN6QixNQUFJO0FBQ0YsVUFBTSxXQUFXLE1BQU0sV0FBVyx1QkFBdUIs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
