import { parsePIDImage, parsePIDDescription, generateCodeFromPID } from "./parser.js";
async function executePIDPipeline(input, aiProvider) {
  let parseResult;
  if (input.imageBase64 && input.mimeType) {
    parseResult = await parsePIDImage(input.imageBase64, input.mimeType, aiProvider);
  } else if (input.textDescription) {
    parseResult = await parsePIDDescription(input.textDescription, aiProvider);
  } else {
    return {
      success: false,
      parseResult: {
        elements: [],
        controlLoops: [],
        interlocks: [],
        pipes: [],
        confidence: 0,
        warnings: ["No input provided"]
      },
      codeResult: null,
      files: [],
      summary: emptySummary(),
      error: "No image or description provided"
    };
  }
  if (parseResult.confidence === 0 && parseResult.elements.length === 0) {
    return {
      success: false,
      parseResult,
      codeResult: null,
      files: [],
      summary: emptySummary(),
      error: `P&ID parsing failed: ${parseResult.warnings.join("; ")}`
    };
  }
  const codeGenRequest = {
    parseResult,
    targetVendor: input.targetVendor || "generic",
    safetyLevel: input.safetyLevel || "none",
    scanTime: input.scanTime || "T#100ms",
    controlStrategy: input.controlStrategy
  };
  const codeResult = await generateCodeFromPID(codeGenRequest, aiProvider);
  const files = generateWorkbenchFiles(parseResult, codeResult);
  const summary = buildSummary(parseResult, codeResult);
  return {
    success: true,
    parseResult,
    codeResult,
    files,
    summary
  };
}
function generateWorkbenchFiles(parseResult, codeResult) {
  const files = [];
  files.push({
    path: "src/main.st",
    content: codeResult.stCode,
    description: "Main Structured Text program generated from P&ID"
  });
  files.push({
    path: "tags/io_list.csv",
    content: generateIOCSV(codeResult.tagList),
    description: "I/O tag list with addresses and descriptions"
  });
  files.push({
    path: "src/variables.st",
    content: generateVariableDeclarations(codeResult.tagList, parseResult),
    description: "Variable declarations for all P&ID instruments and actuators"
  });
  if (parseResult.controlLoops.length > 0) {
    files.push({
      path: "src/control_loops.st",
      content: generateControlLoopCode(parseResult.controlLoops),
      description: "PID control loop implementations"
    });
  }
  if (parseResult.interlocks.length > 0) {
    files.push({
      path: "src/interlocks.st",
      content: generateInterlockCode(parseResult.interlocks),
      description: "Safety interlock logic"
    });
  }
  files.push({
    path: "diagram.json",
    content: codeResult.ladderJson,
    description: "Ladder diagram layout for visualization"
  });
  files.push({
    path: "docs/pid_analysis.md",
    content: generateAnalysisReport(parseResult, codeResult),
    description: "P&ID analysis report with extracted elements"
  });
  return files;
}
function generateIOCSV(tagList) {
  const header = "Tag Name,Address,Data Type,Description,Source Element";
  const rows = tagList.map((t) => `${t.name},${t.address},${t.dataType},"${t.description}",${t.source}`);
  return [header, ...rows].join("\n");
}
function generateVariableDeclarations(tagList, parseResult) {
  const lines = ["PROGRAM PID_Variables", "(* Auto-generated from P&ID analysis *)", ""];
  const digitalInputs = tagList.filter((t) => t.address.startsWith("%IX"));
  const digitalOutputs = tagList.filter((t) => t.address.startsWith("%QX"));
  const analogInputs = tagList.filter((t) => t.address.startsWith("%IW"));
  const analogOutputs = tagList.filter((t) => t.address.startsWith("%QW"));
  if (digitalInputs.length > 0) {
    lines.push("VAR_INPUT");
    lines.push("  (* Digital Inputs *)");
    for (const tag of digitalInputs) {
      lines.push(`  ${tag.name} AT ${tag.address} : ${tag.dataType}; (* ${tag.description} *)`);
    }
    lines.push("END_VAR");
    lines.push("");
  }
  if (analogInputs.length > 0) {
    lines.push("VAR_INPUT");
    lines.push("  (* Analog Inputs *)");
    for (const tag of analogInputs) {
      lines.push(`  ${tag.name} AT ${tag.address} : ${tag.dataType}; (* ${tag.description} *)`);
    }
    lines.push("END_VAR");
    lines.push("");
  }
  if (digitalOutputs.length > 0) {
    lines.push("VAR_OUTPUT");
    lines.push("  (* Digital Outputs *)");
    for (const tag of digitalOutputs) {
      lines.push(`  ${tag.name} AT ${tag.address} : ${tag.dataType}; (* ${tag.description} *)`);
    }
    lines.push("END_VAR");
    lines.push("");
  }
  if (analogOutputs.length > 0) {
    lines.push("VAR_OUTPUT");
    lines.push("  (* Analog Outputs *)");
    for (const tag of analogOutputs) {
      lines.push(`  ${tag.name} AT ${tag.address} : ${tag.dataType}; (* ${tag.description} *)`);
    }
    lines.push("END_VAR");
    lines.push("");
  }
  if (parseResult.controlLoops.length > 0) {
    lines.push("VAR");
    lines.push("  (* Control Loop Internal Variables *)");
    for (const loop of parseResult.controlLoops) {
      const prefix = `LOOP_${loop.loopNumber}`;
      lines.push(`  ${prefix}_SP : REAL := ${loop.setpoint ?? 50}; (* Setpoint *)`);
      lines.push(`  ${prefix}_PV : REAL; (* Process Value - scaled *)`);
      lines.push(`  ${prefix}_CV : REAL; (* Control Output *)`);
      lines.push(`  ${prefix}_EN : BOOL := TRUE; (* Loop Enable *)`);
      lines.push(`  ${prefix}_MAN : BOOL := FALSE; (* Manual Mode *)`);
      lines.push(`  ${prefix}_ERR : REAL; (* Error = SP - PV *)`);
      lines.push(`  ${prefix}_KP : REAL := 1.0; (* Proportional Gain *)`);
      lines.push(`  ${prefix}_KI : REAL := 0.1; (* Integral Gain *)`);
      lines.push(`  ${prefix}_KD : REAL := 0.0; (* Derivative Gain *)`);
      lines.push("");
    }
    lines.push("END_VAR");
    lines.push("");
  }
  if (parseResult.interlocks.length > 0) {
    lines.push("VAR");
    lines.push("  (* Safety Interlock Status *)");
    for (const interlock of parseResult.interlocks) {
      const tag = interlock.id.replace(/[^a-zA-Z0-9_]/g, "_");
      lines.push(`  ${tag}_ACTIVE : BOOL; (* ${interlock.name} active *)`);
      lines.push(`  ${tag}_LATCHED : BOOL; (* ${interlock.name} latched *)`);
      lines.push(`  ${tag}_RESET : BOOL; (* ${interlock.name} reset command *)`);
    }
    lines.push("END_VAR");
  }
  lines.push("");
  lines.push("END_PROGRAM");
  return lines.join("\n");
}
function generateControlLoopCode(loops) {
  const lines = ["(* Control Loop Implementations *)", "(* Auto-generated from P&ID analysis *)", ""];
  for (const loop of loops) {
    const prefix = `LOOP_${loop.loopNumber}`;
    const desc = loop.description || `${loop.measuredVariable} control`;
    lines.push(`(* \u2500\u2500\u2500\u2500 ${desc} \u2500\u2500\u2500\u2500 *)`);
    lines.push(
      `(* Sensor: ${loop.sensor.tagNumber} \u2192 Controller \u2192 ${loop.finalElement.tagNumber || "output"} *)`
    );
    lines.push(`(* Control Type: ${loop.controlType} *)`);
    lines.push("");
    if (loop.controlType === "onoff") {
      lines.push(`IF ${prefix}_EN AND NOT ${prefix}_MAN THEN`);
      lines.push(`  ${prefix}_ERR := ${prefix}_SP - ${prefix}_PV;`);
      lines.push(`  IF ${prefix}_ERR > 0.0 THEN`);
      lines.push(`    ${prefix}_CV := 100.0;`);
      lines.push("  ELSE");
      lines.push(`    ${prefix}_CV := 0.0;`);
      lines.push("  END_IF;");
      lines.push("END_IF;");
    } else {
      lines.push(`IF ${prefix}_EN AND NOT ${prefix}_MAN THEN`);
      lines.push(`  ${prefix}_ERR := ${prefix}_SP - ${prefix}_PV;`);
      lines.push("");
      lines.push("  (* PID calculation \u2014 use OSCAT FT_PID or vendor FB *)");
      lines.push(`  ${prefix}_CV := ${prefix}_KP * ${prefix}_ERR;`);
      lines.push("");
      lines.push("  (* Output limiting *)");
      lines.push(`  IF ${prefix}_CV > 100.0 THEN`);
      lines.push(`    ${prefix}_CV := 100.0;`);
      lines.push(`  ELSIF ${prefix}_CV < 0.0 THEN`);
      lines.push(`    ${prefix}_CV := 0.0;`);
      lines.push("  END_IF;");
      lines.push("END_IF;");
    }
    lines.push("");
  }
  return lines.join("\n");
}
function generateInterlockCode(interlocks) {
  const lines = [
    "(* Safety Interlock Logic *)",
    "(* Auto-generated from P&ID analysis *)",
    "(* WARNING: Review and validate before deployment *)",
    ""
  ];
  for (const interlock of interlocks) {
    const tag = interlock.id.replace(/[^a-zA-Z0-9_]/g, "_");
    lines.push(`(* \u2500\u2500\u2500\u2500 ${interlock.name} [${interlock.priority}] \u2500\u2500\u2500\u2500 *)`);
    lines.push(`(* Trigger: ${interlock.triggerCondition} *)`);
    lines.push("");
    const condParts = interlock.instruments.map((inst) => {
      const isHighAlarm = inst.subsequentLetters.includes("H");
      const isLowAlarm = inst.subsequentLetters.includes("L");
      if (isHighAlarm) {
        return `${inst.tagNumber}_PV >= ${inst.tagNumber}_HH`;
      }
      if (isLowAlarm) {
        return `${inst.tagNumber}_PV <= ${inst.tagNumber}_LL`;
      }
      return `${inst.tagNumber}`;
    });
    const condition = condParts.length > 0 ? condParts.join(" OR ") : "FALSE";
    lines.push(`(* Condition evaluation *)`);
    lines.push(`${tag}_ACTIVE := ${condition};`);
    lines.push("");
    if (interlock.priority === "safety") {
      lines.push("(* Safety latch \u2014 requires manual reset *)");
      lines.push(`IF ${tag}_ACTIVE THEN`);
      lines.push(`  ${tag}_LATCHED := TRUE;`);
      lines.push("END_IF;");
      lines.push(`IF ${tag}_RESET AND NOT ${tag}_ACTIVE THEN`);
      lines.push(`  ${tag}_LATCHED := FALSE;`);
      lines.push("END_IF;");
    } else {
      lines.push("(* Process interlock \u2014 auto-reset when condition clears *)");
      lines.push(`${tag}_LATCHED := ${tag}_ACTIVE;`);
    }
    lines.push("");
    lines.push("(* Actions *)");
    lines.push(`IF ${tag}_LATCHED THEN`);
    for (const action of interlock.actions) {
      const actionTag = action.replace(/\s+/g, "_").toUpperCase();
      lines.push(`  ${actionTag} := TRUE;`);
    }
    lines.push("END_IF;");
    lines.push("");
  }
  return lines.join("\n");
}
function generateAnalysisReport(parseResult, codeResult) {
  const lines = [
    "# P&ID Analysis Report",
    "",
    `**Confidence:** ${(parseResult.confidence * 100).toFixed(0)}%`,
    `**Generated:** ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`,
    ""
  ];
  if (parseResult.rawDescription) {
    lines.push("## P&ID Description");
    lines.push(parseResult.rawDescription);
    lines.push("");
  }
  const instruments = parseResult.elements.filter((e) => e.type === "instrument");
  if (instruments.length > 0) {
    lines.push("## Instruments");
    lines.push("| Tag | Variable | Function | Location |");
    lines.push("|-----|----------|----------|----------|");
    for (const inst of instruments) {
      lines.push(
        `| ${inst.tagNumber} | ${inst.measuredVariable} | ${inst.subsequentLetters.join("")} | ${inst.location} |`
      );
    }
    lines.push("");
  }
  const valves = parseResult.elements.filter((e) => e.type === "valve");
  if (valves.length > 0) {
    lines.push("## Valves");
    lines.push("| Tag | Type | Actuator | Fail Position |");
    lines.push("|-----|------|----------|---------------|");
    for (const valve of valves) {
      lines.push(
        `| ${valve.tagNumber} | ${valve.valveType} | ${valve.actuatorType || "-"} | ${valve.failPosition || "-"} |`
      );
    }
    lines.push("");
  }
  if (parseResult.controlLoops.length > 0) {
    lines.push("## Control Loops");
    for (const loop of parseResult.controlLoops) {
      lines.push(`- **Loop ${loop.loopNumber}** (${loop.controlType}): ${loop.description}`);
      lines.push(`  - Sensor: ${loop.sensor.tagNumber} \u2192 Controller \u2192 ${loop.finalElement.tagNumber}`);
      if (loop.setpoint != null) {
        lines.push(`  - Setpoint: ${loop.setpoint}`);
      }
    }
    lines.push("");
  }
  if (parseResult.interlocks.length > 0) {
    lines.push("## Safety Interlocks");
    for (const interlock of parseResult.interlocks) {
      lines.push(`- **${interlock.name}** [${interlock.priority}]`);
      lines.push(`  - Trigger: ${interlock.triggerCondition}`);
      lines.push(`  - Actions: ${interlock.actions.join(", ")}`);
    }
    lines.push("");
  }
  lines.push("## I/O Summary");
  lines.push(`- Digital Inputs: ${codeResult.ioCount.digitalInputs}`);
  lines.push(`- Digital Outputs: ${codeResult.ioCount.digitalOutputs}`);
  lines.push(`- Analog Inputs: ${codeResult.ioCount.analogInputs}`);
  lines.push(`- Analog Outputs: ${codeResult.ioCount.analogOutputs}`);
  lines.push(`- **Total I/O points:** ${Object.values(codeResult.ioCount).reduce((a, b) => a + b, 0)}`);
  if (parseResult.warnings.length > 0) {
    lines.push("");
    lines.push("## Warnings");
    for (const w of parseResult.warnings) {
      lines.push(`- \u26A0\uFE0F ${w}`);
    }
  }
  return lines.join("\n");
}
function buildSummary(parseResult, codeResult) {
  return {
    instrumentCount: parseResult.elements.filter((e) => e.type === "instrument").length,
    valveCount: parseResult.elements.filter((e) => e.type === "valve").length,
    pumpCount: parseResult.elements.filter((e) => e.type === "pump").length,
    controlLoopCount: parseResult.controlLoops.length,
    interlockCount: parseResult.interlocks.length,
    ioCount: codeResult.ioCount,
    confidence: parseResult.confidence,
    warnings: parseResult.warnings
  };
}
function emptySummary() {
  return {
    instrumentCount: 0,
    valveCount: 0,
    pumpCount: 0,
    controlLoopCount: 0,
    interlockCount: 0,
    ioCount: { digitalInputs: 0, digitalOutputs: 0, analogInputs: 0, analogOutputs: 0 },
    confidence: 0,
    warnings: []
  };
}
export {
  executePIDPipeline
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC92ZW5kb3IvcGlkL3BpcGVsaW5lLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIFAmSUQgXHUyMTkyIFNUIENvZGUgRW5kLXRvLUVuZCBQaXBlbGluZVxuICpcbiAqIE9yY2hlc3RyYXRlcyB0aGUgZnVsbCBmbG93OlxuICogICAxLiBJbWFnZSBcdTIxOTIgR2VtaW5pIFZpc2lvbiBcdTIxOTIgUElEUGFyc2VSZXN1bHQgKGluc3RydW1lbnRzLCBsb29wcywgaW50ZXJsb2NrcylcbiAqICAgMi4gUElEUGFyc2VSZXN1bHQgXHUyMTkyIFNUIGNvZGUgZ2VuZXJhdGlvbiAodmFyaWFibGVzLCBydW5ncywgY29udHJvbCBsb2dpYylcbiAqICAgMy4gU1QgY29kZSBcdTIxOTIgd29ya2JlbmNoIGZpbGUgcG9wdWxhdGlvbiAobWFpbi5zdCwgaW9fbGlzdC5jc3YsIGRpYWdyYW0uanNvbilcbiAqXG4gKiBUaGlzIGlzIHRoZSBjb3JlIGRpZmZlcmVudGlhdG9yOiBcInBob3RvZ3JhcGggYSBQJklELCBnZXQgd29ya2luZyBQTEMgY29kZS5cIlxuICovXG5cbmltcG9ydCB7IHBhcnNlUElESW1hZ2UsIHBhcnNlUElERGVzY3JpcHRpb24sIGdlbmVyYXRlQ29kZUZyb21QSUQgfSBmcm9tICcuL3BhcnNlci5qcyc7XG5pbXBvcnQgdHlwZSB7XG4gIFBJRFBhcnNlUmVzdWx0LFxuICBQSURDb2RlR2VuUmVxdWVzdCxcbiAgUElEQ29kZUdlblJlc3VsdCxcbiAgUElESW5zdHJ1bWVudCxcbiAgUElEVmFsdmUsXG4gIFBJRFB1bXAsXG4gIFBJRENvbnRyb2xMb29wLFxuICBQSURJbnRlcmxvY2ssXG59IGZyb20gJy4vdHlwZXMuanMnO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUGlwZWxpbmUgVHlwZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBpbnRlcmZhY2UgUElEUGlwZWxpbmVJbnB1dCB7XG4gIGltYWdlQmFzZTY0Pzogc3RyaW5nO1xuICBtaW1lVHlwZT86IHN0cmluZztcbiAgdGV4dERlc2NyaXB0aW9uPzogc3RyaW5nO1xuICB0YXJnZXRWZW5kb3I/OiBzdHJpbmc7XG4gIHNhZmV0eUxldmVsPzogJ1NJTDEnIHwgJ1NJTDInIHwgJ1NJTDMnIHwgJ25vbmUnO1xuICBzY2FuVGltZT86IHN0cmluZztcbiAgY29udHJvbFN0cmF0ZWd5Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBJRFBpcGVsaW5lUmVzdWx0IHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgcGFyc2VSZXN1bHQ6IFBJRFBhcnNlUmVzdWx0O1xuICBjb2RlUmVzdWx0OiBQSURDb2RlR2VuUmVzdWx0IHwgbnVsbDtcbiAgZmlsZXM6IEdlbmVyYXRlZEZpbGVbXTtcbiAgc3VtbWFyeTogUGlwZWxpbmVTdW1tYXJ5O1xuICBlcnJvcj86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBHZW5lcmF0ZWRGaWxlIHtcbiAgcGF0aDogc3RyaW5nO1xuICBjb250ZW50OiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGlwZWxpbmVTdW1tYXJ5IHtcbiAgaW5zdHJ1bWVudENvdW50OiBudW1iZXI7XG4gIHZhbHZlQ291bnQ6IG51bWJlcjtcbiAgcHVtcENvdW50OiBudW1iZXI7XG4gIGNvbnRyb2xMb29wQ291bnQ6IG51bWJlcjtcbiAgaW50ZXJsb2NrQ291bnQ6IG51bWJlcjtcbiAgaW9Db3VudDoge1xuICAgIGRpZ2l0YWxJbnB1dHM6IG51bWJlcjtcbiAgICBkaWdpdGFsT3V0cHV0czogbnVtYmVyO1xuICAgIGFuYWxvZ0lucHV0czogbnVtYmVyO1xuICAgIGFuYWxvZ091dHB1dHM6IG51bWJlcjtcbiAgfTtcbiAgY29uZmlkZW5jZTogbnVtYmVyO1xuICB3YXJuaW5nczogc3RyaW5nW107XG59XG5cbmV4cG9ydCB0eXBlIEFJVmlzaW9uUHJvdmlkZXIgPSAocHJvbXB0OiBzdHJpbmcsIGltYWdlPzogeyBkYXRhOiBzdHJpbmc7IG1pbWVUeXBlOiBzdHJpbmcgfSkgPT4gUHJvbWlzZTxzdHJpbmc+O1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUGlwZWxpbmUgRXhlY3V0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4vKipcbiAqIEV4ZWN1dGUgdGhlIGZ1bGwgUCZJRCBcdTIxOTIgU1QgcGlwZWxpbmUuXG4gKlxuICogQHBhcmFtIGlucHV0IC0gSW1hZ2Ugb3IgdGV4dCBkZXNjcmlwdGlvbiBvZiB0aGUgUCZJRFxuICogQHBhcmFtIGFpUHJvdmlkZXIgLSBWaXNpb24tY2FwYWJsZSBBSSBwcm92aWRlciBmdW5jdGlvblxuICogQHJldHVybnMgQ29tcGxldGUgcGlwZWxpbmUgcmVzdWx0IHdpdGggZ2VuZXJhdGVkIGZpbGVzXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGVjdXRlUElEUGlwZWxpbmUoXG4gIGlucHV0OiBQSURQaXBlbGluZUlucHV0LFxuICBhaVByb3ZpZGVyOiBBSVZpc2lvblByb3ZpZGVyLFxuKTogUHJvbWlzZTxQSURQaXBlbGluZVJlc3VsdD4ge1xuICAvLyBTdGVwIDE6IFBhcnNlIHRoZSBQJklEIChpbWFnZSBvciBkZXNjcmlwdGlvbilcbiAgbGV0IHBhcnNlUmVzdWx0OiBQSURQYXJzZVJlc3VsdDtcblxuICBpZiAoaW5wdXQuaW1hZ2VCYXNlNjQgJiYgaW5wdXQubWltZVR5cGUpIHtcbiAgICBwYXJzZVJlc3VsdCA9IGF3YWl0IHBhcnNlUElESW1hZ2UoaW5wdXQuaW1hZ2VCYXNlNjQsIGlucHV0Lm1pbWVUeXBlLCBhaVByb3ZpZGVyKTtcbiAgfSBlbHNlIGlmIChpbnB1dC50ZXh0RGVzY3JpcHRpb24pIHtcbiAgICBwYXJzZVJlc3VsdCA9IGF3YWl0IHBhcnNlUElERGVzY3JpcHRpb24oaW5wdXQudGV4dERlc2NyaXB0aW9uLCBhaVByb3ZpZGVyKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBwYXJzZVJlc3VsdDoge1xuICAgICAgICBlbGVtZW50czogW10sXG4gICAgICAgIGNvbnRyb2xMb29wczogW10sXG4gICAgICAgIGludGVybG9ja3M6IFtdLFxuICAgICAgICBwaXBlczogW10sXG4gICAgICAgIGNvbmZpZGVuY2U6IDAsXG4gICAgICAgIHdhcm5pbmdzOiBbJ05vIGlucHV0IHByb3ZpZGVkJ10sXG4gICAgICB9LFxuICAgICAgY29kZVJlc3VsdDogbnVsbCxcbiAgICAgIGZpbGVzOiBbXSxcbiAgICAgIHN1bW1hcnk6IGVtcHR5U3VtbWFyeSgpLFxuICAgICAgZXJyb3I6ICdObyBpbWFnZSBvciBkZXNjcmlwdGlvbiBwcm92aWRlZCcsXG4gICAgfTtcbiAgfVxuXG4gIGlmIChwYXJzZVJlc3VsdC5jb25maWRlbmNlID09PSAwICYmIHBhcnNlUmVzdWx0LmVsZW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgIHBhcnNlUmVzdWx0LFxuICAgICAgY29kZVJlc3VsdDogbnVsbCxcbiAgICAgIGZpbGVzOiBbXSxcbiAgICAgIHN1bW1hcnk6IGVtcHR5U3VtbWFyeSgpLFxuICAgICAgZXJyb3I6IGBQJklEIHBhcnNpbmcgZmFpbGVkOiAke3BhcnNlUmVzdWx0Lndhcm5pbmdzLmpvaW4oJzsgJyl9YCxcbiAgICB9O1xuICB9XG5cbiAgLy8gU3RlcCAyOiBHZW5lcmF0ZSBQTEMgY29kZSBmcm9tIHBhcnNlIHJlc3VsdFxuICBjb25zdCBjb2RlR2VuUmVxdWVzdDogUElEQ29kZUdlblJlcXVlc3QgPSB7XG4gICAgcGFyc2VSZXN1bHQsXG4gICAgdGFyZ2V0VmVuZG9yOiBpbnB1dC50YXJnZXRWZW5kb3IgfHwgJ2dlbmVyaWMnLFxuICAgIHNhZmV0eUxldmVsOiBpbnB1dC5zYWZldHlMZXZlbCB8fCAnbm9uZScsXG4gICAgc2NhblRpbWU6IGlucHV0LnNjYW5UaW1lIHx8ICdUIzEwMG1zJyxcbiAgICBjb250cm9sU3RyYXRlZ3k6IGlucHV0LmNvbnRyb2xTdHJhdGVneSxcbiAgfTtcblxuICBjb25zdCBjb2RlUmVzdWx0ID0gYXdhaXQgZ2VuZXJhdGVDb2RlRnJvbVBJRChjb2RlR2VuUmVxdWVzdCwgYWlQcm92aWRlcik7XG5cbiAgLy8gU3RlcCAzOiBHZW5lcmF0ZSB3b3JrYmVuY2ggZmlsZXNcbiAgY29uc3QgZmlsZXMgPSBnZW5lcmF0ZVdvcmtiZW5jaEZpbGVzKHBhcnNlUmVzdWx0LCBjb2RlUmVzdWx0KTtcblxuICAvLyBTdGVwIDQ6IEJ1aWxkIHN1bW1hcnlcbiAgY29uc3Qgc3VtbWFyeSA9IGJ1aWxkU3VtbWFyeShwYXJzZVJlc3VsdCwgY29kZVJlc3VsdCk7XG5cbiAgcmV0dXJuIHtcbiAgICBzdWNjZXNzOiB0cnVlLFxuICAgIHBhcnNlUmVzdWx0LFxuICAgIGNvZGVSZXN1bHQsXG4gICAgZmlsZXMsXG4gICAgc3VtbWFyeSxcbiAgfTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEZpbGUgR2VuZXJhdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gZ2VuZXJhdGVXb3JrYmVuY2hGaWxlcyhwYXJzZVJlc3VsdDogUElEUGFyc2VSZXN1bHQsIGNvZGVSZXN1bHQ6IFBJRENvZGVHZW5SZXN1bHQpOiBHZW5lcmF0ZWRGaWxlW10ge1xuICBjb25zdCBmaWxlczogR2VuZXJhdGVkRmlsZVtdID0gW107XG5cbiAgLy8gTWFpbiBTVCBwcm9ncmFtIGZpbGVcbiAgZmlsZXMucHVzaCh7XG4gICAgcGF0aDogJ3NyYy9tYWluLnN0JyxcbiAgICBjb250ZW50OiBjb2RlUmVzdWx0LnN0Q29kZSxcbiAgICBkZXNjcmlwdGlvbjogJ01haW4gU3RydWN0dXJlZCBUZXh0IHByb2dyYW0gZ2VuZXJhdGVkIGZyb20gUCZJRCcsXG4gIH0pO1xuXG4gIC8vIElPIHRhZyBsaXN0IGFzIENTVlxuICBmaWxlcy5wdXNoKHtcbiAgICBwYXRoOiAndGFncy9pb19saXN0LmNzdicsXG4gICAgY29udGVudDogZ2VuZXJhdGVJT0NTVihjb2RlUmVzdWx0LnRhZ0xpc3QpLFxuICAgIGRlc2NyaXB0aW9uOiAnSS9PIHRhZyBsaXN0IHdpdGggYWRkcmVzc2VzIGFuZCBkZXNjcmlwdGlvbnMnLFxuICB9KTtcblxuICAvLyBWYXJpYWJsZSBkZWNsYXJhdGlvbnMgYXMgc2VwYXJhdGUgZmlsZSAoZm9yIGltcG9ydCBpbnRvIE9wZW5QTEMpXG4gIGZpbGVzLnB1c2goe1xuICAgIHBhdGg6ICdzcmMvdmFyaWFibGVzLnN0JyxcbiAgICBjb250ZW50OiBnZW5lcmF0ZVZhcmlhYmxlRGVjbGFyYXRpb25zKGNvZGVSZXN1bHQudGFnTGlzdCwgcGFyc2VSZXN1bHQpLFxuICAgIGRlc2NyaXB0aW9uOiAnVmFyaWFibGUgZGVjbGFyYXRpb25zIGZvciBhbGwgUCZJRCBpbnN0cnVtZW50cyBhbmQgYWN0dWF0b3JzJyxcbiAgfSk7XG5cbiAgLy8gQ29udHJvbCBsb29wIGNvbmZpZ3VyYXRpb25cbiAgaWYgKHBhcnNlUmVzdWx0LmNvbnRyb2xMb29wcy5sZW5ndGggPiAwKSB7XG4gICAgZmlsZXMucHVzaCh7XG4gICAgICBwYXRoOiAnc3JjL2NvbnRyb2xfbG9vcHMuc3QnLFxuICAgICAgY29udGVudDogZ2VuZXJhdGVDb250cm9sTG9vcENvZGUocGFyc2VSZXN1bHQuY29udHJvbExvb3BzKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUElEIGNvbnRyb2wgbG9vcCBpbXBsZW1lbnRhdGlvbnMnLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gU2FmZXR5IGludGVybG9ja3MgYXMgc2VwYXJhdGUgbW9kdWxlXG4gIGlmIChwYXJzZVJlc3VsdC5pbnRlcmxvY2tzLmxlbmd0aCA+IDApIHtcbiAgICBmaWxlcy5wdXNoKHtcbiAgICAgIHBhdGg6ICdzcmMvaW50ZXJsb2Nrcy5zdCcsXG4gICAgICBjb250ZW50OiBnZW5lcmF0ZUludGVybG9ja0NvZGUocGFyc2VSZXN1bHQuaW50ZXJsb2NrcyksXG4gICAgICBkZXNjcmlwdGlvbjogJ1NhZmV0eSBpbnRlcmxvY2sgbG9naWMnLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gRGlhZ3JhbSBKU09OIGZvciBsYWRkZXIgdmlzdWFsaXphdGlvblxuICBmaWxlcy5wdXNoKHtcbiAgICBwYXRoOiAnZGlhZ3JhbS5qc29uJyxcbiAgICBjb250ZW50OiBjb2RlUmVzdWx0LmxhZGRlckpzb24sXG4gICAgZGVzY3JpcHRpb246ICdMYWRkZXIgZGlhZ3JhbSBsYXlvdXQgZm9yIHZpc3VhbGl6YXRpb24nLFxuICB9KTtcblxuICAvLyBQJklEIGFuYWx5c2lzIHJlcG9ydCAobWFya2Rvd24pXG4gIGZpbGVzLnB1c2goe1xuICAgIHBhdGg6ICdkb2NzL3BpZF9hbmFseXNpcy5tZCcsXG4gICAgY29udGVudDogZ2VuZXJhdGVBbmFseXNpc1JlcG9ydChwYXJzZVJlc3VsdCwgY29kZVJlc3VsdCksXG4gICAgZGVzY3JpcHRpb246ICdQJklEIGFuYWx5c2lzIHJlcG9ydCB3aXRoIGV4dHJhY3RlZCBlbGVtZW50cycsXG4gIH0pO1xuXG4gIHJldHVybiBmaWxlcztcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVJT0NTVih0YWdMaXN0OiBQSURDb2RlR2VuUmVzdWx0Wyd0YWdMaXN0J10pOiBzdHJpbmcge1xuICBjb25zdCBoZWFkZXIgPSAnVGFnIE5hbWUsQWRkcmVzcyxEYXRhIFR5cGUsRGVzY3JpcHRpb24sU291cmNlIEVsZW1lbnQnO1xuICBjb25zdCByb3dzID0gdGFnTGlzdC5tYXAoKHQpID0+IGAke3QubmFtZX0sJHt0LmFkZHJlc3N9LCR7dC5kYXRhVHlwZX0sXCIke3QuZGVzY3JpcHRpb259XCIsJHt0LnNvdXJjZX1gKTtcblxuICByZXR1cm4gW2hlYWRlciwgLi4ucm93c10uam9pbignXFxuJyk7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlVmFyaWFibGVEZWNsYXJhdGlvbnModGFnTGlzdDogUElEQ29kZUdlblJlc3VsdFsndGFnTGlzdCddLCBwYXJzZVJlc3VsdDogUElEUGFyc2VSZXN1bHQpOiBzdHJpbmcge1xuICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbJ1BST0dSQU0gUElEX1ZhcmlhYmxlcycsICcoKiBBdXRvLWdlbmVyYXRlZCBmcm9tIFAmSUQgYW5hbHlzaXMgKiknLCAnJ107XG5cbiAgLy8gR3JvdXAgYnkgdHlwZVxuICBjb25zdCBkaWdpdGFsSW5wdXRzID0gdGFnTGlzdC5maWx0ZXIoKHQpID0+IHQuYWRkcmVzcy5zdGFydHNXaXRoKCclSVgnKSk7XG4gIGNvbnN0IGRpZ2l0YWxPdXRwdXRzID0gdGFnTGlzdC5maWx0ZXIoKHQpID0+IHQuYWRkcmVzcy5zdGFydHNXaXRoKCclUVgnKSk7XG4gIGNvbnN0IGFuYWxvZ0lucHV0cyA9IHRhZ0xpc3QuZmlsdGVyKCh0KSA9PiB0LmFkZHJlc3Muc3RhcnRzV2l0aCgnJUlXJykpO1xuICBjb25zdCBhbmFsb2dPdXRwdXRzID0gdGFnTGlzdC5maWx0ZXIoKHQpID0+IHQuYWRkcmVzcy5zdGFydHNXaXRoKCclUVcnKSk7XG5cbiAgaWYgKGRpZ2l0YWxJbnB1dHMubGVuZ3RoID4gMCkge1xuICAgIGxpbmVzLnB1c2goJ1ZBUl9JTlBVVCcpO1xuICAgIGxpbmVzLnB1c2goJyAgKCogRGlnaXRhbCBJbnB1dHMgKiknKTtcblxuICAgIGZvciAoY29uc3QgdGFnIG9mIGRpZ2l0YWxJbnB1dHMpIHtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHt0YWcubmFtZX0gQVQgJHt0YWcuYWRkcmVzc30gOiAke3RhZy5kYXRhVHlwZX07ICgqICR7dGFnLmRlc2NyaXB0aW9ufSAqKWApO1xuICAgIH1cblxuICAgIGxpbmVzLnB1c2goJ0VORF9WQVInKTtcbiAgICBsaW5lcy5wdXNoKCcnKTtcbiAgfVxuXG4gIGlmIChhbmFsb2dJbnB1dHMubGVuZ3RoID4gMCkge1xuICAgIGxpbmVzLnB1c2goJ1ZBUl9JTlBVVCcpO1xuICAgIGxpbmVzLnB1c2goJyAgKCogQW5hbG9nIElucHV0cyAqKScpO1xuXG4gICAgZm9yIChjb25zdCB0YWcgb2YgYW5hbG9nSW5wdXRzKSB7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7dGFnLm5hbWV9IEFUICR7dGFnLmFkZHJlc3N9IDogJHt0YWcuZGF0YVR5cGV9OyAoKiAke3RhZy5kZXNjcmlwdGlvbn0gKilgKTtcbiAgICB9XG5cbiAgICBsaW5lcy5wdXNoKCdFTkRfVkFSJyk7XG4gICAgbGluZXMucHVzaCgnJyk7XG4gIH1cblxuICBpZiAoZGlnaXRhbE91dHB1dHMubGVuZ3RoID4gMCkge1xuICAgIGxpbmVzLnB1c2goJ1ZBUl9PVVRQVVQnKTtcbiAgICBsaW5lcy5wdXNoKCcgICgqIERpZ2l0YWwgT3V0cHV0cyAqKScpO1xuXG4gICAgZm9yIChjb25zdCB0YWcgb2YgZGlnaXRhbE91dHB1dHMpIHtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHt0YWcubmFtZX0gQVQgJHt0YWcuYWRkcmVzc30gOiAke3RhZy5kYXRhVHlwZX07ICgqICR7dGFnLmRlc2NyaXB0aW9ufSAqKWApO1xuICAgIH1cblxuICAgIGxpbmVzLnB1c2goJ0VORF9WQVInKTtcbiAgICBsaW5lcy5wdXNoKCcnKTtcbiAgfVxuXG4gIGlmIChhbmFsb2dPdXRwdXRzLmxlbmd0aCA+IDApIHtcbiAgICBsaW5lcy5wdXNoKCdWQVJfT1VUUFVUJyk7XG4gICAgbGluZXMucHVzaCgnICAoKiBBbmFsb2cgT3V0cHV0cyAqKScpO1xuXG4gICAgZm9yIChjb25zdCB0YWcgb2YgYW5hbG9nT3V0cHV0cykge1xuICAgICAgbGluZXMucHVzaChgICAke3RhZy5uYW1lfSBBVCAke3RhZy5hZGRyZXNzfSA6ICR7dGFnLmRhdGFUeXBlfTsgKCogJHt0YWcuZGVzY3JpcHRpb259ICopYCk7XG4gICAgfVxuXG4gICAgbGluZXMucHVzaCgnRU5EX1ZBUicpO1xuICAgIGxpbmVzLnB1c2goJycpO1xuICB9XG5cbiAgLy8gSW50ZXJuYWwgdmFyaWFibGVzIGZvciBjb250cm9sIGxvb3BzXG4gIGlmIChwYXJzZVJlc3VsdC5jb250cm9sTG9vcHMubGVuZ3RoID4gMCkge1xuICAgIGxpbmVzLnB1c2goJ1ZBUicpO1xuICAgIGxpbmVzLnB1c2goJyAgKCogQ29udHJvbCBMb29wIEludGVybmFsIFZhcmlhYmxlcyAqKScpO1xuXG4gICAgZm9yIChjb25zdCBsb29wIG9mIHBhcnNlUmVzdWx0LmNvbnRyb2xMb29wcykge1xuICAgICAgY29uc3QgcHJlZml4ID0gYExPT1BfJHtsb29wLmxvb3BOdW1iZXJ9YDtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHtwcmVmaXh9X1NQIDogUkVBTCA6PSAke2xvb3Auc2V0cG9pbnQgPz8gNTAuMH07ICgqIFNldHBvaW50ICopYCk7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7cHJlZml4fV9QViA6IFJFQUw7ICgqIFByb2Nlc3MgVmFsdWUgLSBzY2FsZWQgKilgKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHtwcmVmaXh9X0NWIDogUkVBTDsgKCogQ29udHJvbCBPdXRwdXQgKilgKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHtwcmVmaXh9X0VOIDogQk9PTCA6PSBUUlVFOyAoKiBMb29wIEVuYWJsZSAqKWApO1xuICAgICAgbGluZXMucHVzaChgICAke3ByZWZpeH1fTUFOIDogQk9PTCA6PSBGQUxTRTsgKCogTWFudWFsIE1vZGUgKilgKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHtwcmVmaXh9X0VSUiA6IFJFQUw7ICgqIEVycm9yID0gU1AgLSBQViAqKWApO1xuICAgICAgbGluZXMucHVzaChgICAke3ByZWZpeH1fS1AgOiBSRUFMIDo9IDEuMDsgKCogUHJvcG9ydGlvbmFsIEdhaW4gKilgKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHtwcmVmaXh9X0tJIDogUkVBTCA6PSAwLjE7ICgqIEludGVncmFsIEdhaW4gKilgKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHtwcmVmaXh9X0tEIDogUkVBTCA6PSAwLjA7ICgqIERlcml2YXRpdmUgR2FpbiAqKWApO1xuICAgICAgbGluZXMucHVzaCgnJyk7XG4gICAgfVxuXG4gICAgbGluZXMucHVzaCgnRU5EX1ZBUicpO1xuICAgIGxpbmVzLnB1c2goJycpO1xuICB9XG5cbiAgLy8gSW50ZXJsb2NrIHN0YXR1cyB2YXJpYWJsZXNcbiAgaWYgKHBhcnNlUmVzdWx0LmludGVybG9ja3MubGVuZ3RoID4gMCkge1xuICAgIGxpbmVzLnB1c2goJ1ZBUicpO1xuICAgIGxpbmVzLnB1c2goJyAgKCogU2FmZXR5IEludGVybG9jayBTdGF0dXMgKiknKTtcblxuICAgIGZvciAoY29uc3QgaW50ZXJsb2NrIG9mIHBhcnNlUmVzdWx0LmludGVybG9ja3MpIHtcbiAgICAgIGNvbnN0IHRhZyA9IGludGVybG9jay5pZC5yZXBsYWNlKC9bXmEtekEtWjAtOV9dL2csICdfJyk7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7dGFnfV9BQ1RJVkUgOiBCT09MOyAoKiAke2ludGVybG9jay5uYW1lfSBhY3RpdmUgKilgKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHt0YWd9X0xBVENIRUQgOiBCT09MOyAoKiAke2ludGVybG9jay5uYW1lfSBsYXRjaGVkICopYCk7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7dGFnfV9SRVNFVCA6IEJPT0w7ICgqICR7aW50ZXJsb2NrLm5hbWV9IHJlc2V0IGNvbW1hbmQgKilgKTtcbiAgICB9XG5cbiAgICBsaW5lcy5wdXNoKCdFTkRfVkFSJyk7XG4gIH1cblxuICBsaW5lcy5wdXNoKCcnKTtcbiAgbGluZXMucHVzaCgnRU5EX1BST0dSQU0nKTtcblxuICByZXR1cm4gbGluZXMuam9pbignXFxuJyk7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQ29udHJvbExvb3BDb2RlKGxvb3BzOiBQSURDb250cm9sTG9vcFtdKTogc3RyaW5nIHtcbiAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gWycoKiBDb250cm9sIExvb3AgSW1wbGVtZW50YXRpb25zICopJywgJygqIEF1dG8tZ2VuZXJhdGVkIGZyb20gUCZJRCBhbmFseXNpcyAqKScsICcnXTtcblxuICBmb3IgKGNvbnN0IGxvb3Agb2YgbG9vcHMpIHtcbiAgICBjb25zdCBwcmVmaXggPSBgTE9PUF8ke2xvb3AubG9vcE51bWJlcn1gO1xuICAgIGNvbnN0IGRlc2MgPSBsb29wLmRlc2NyaXB0aW9uIHx8IGAke2xvb3AubWVhc3VyZWRWYXJpYWJsZX0gY29udHJvbGA7XG5cbiAgICBsaW5lcy5wdXNoKGAoKiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgJHtkZXNjfSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgKilgKTtcbiAgICBsaW5lcy5wdXNoKFxuICAgICAgYCgqIFNlbnNvcjogJHtsb29wLnNlbnNvci50YWdOdW1iZXJ9IFx1MjE5MiBDb250cm9sbGVyIFx1MjE5MiAkeyhsb29wLmZpbmFsRWxlbWVudCBhcyBQSURWYWx2ZSB8IFBJRFB1bXApLnRhZ051bWJlciB8fCAnb3V0cHV0J30gKilgLFxuICAgICk7XG4gICAgbGluZXMucHVzaChgKCogQ29udHJvbCBUeXBlOiAke2xvb3AuY29udHJvbFR5cGV9ICopYCk7XG4gICAgbGluZXMucHVzaCgnJyk7XG5cbiAgICBpZiAobG9vcC5jb250cm9sVHlwZSA9PT0gJ29ub2ZmJykge1xuICAgICAgbGluZXMucHVzaChgSUYgJHtwcmVmaXh9X0VOIEFORCBOT1QgJHtwcmVmaXh9X01BTiBUSEVOYCk7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7cHJlZml4fV9FUlIgOj0gJHtwcmVmaXh9X1NQIC0gJHtwcmVmaXh9X1BWO2ApO1xuICAgICAgbGluZXMucHVzaChgICBJRiAke3ByZWZpeH1fRVJSID4gMC4wIFRIRU5gKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgICAke3ByZWZpeH1fQ1YgOj0gMTAwLjA7YCk7XG4gICAgICBsaW5lcy5wdXNoKCcgIEVMU0UnKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgICAke3ByZWZpeH1fQ1YgOj0gMC4wO2ApO1xuICAgICAgbGluZXMucHVzaCgnICBFTkRfSUY7Jyk7XG4gICAgICBsaW5lcy5wdXNoKCdFTkRfSUY7Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpbmVzLnB1c2goYElGICR7cHJlZml4fV9FTiBBTkQgTk9UICR7cHJlZml4fV9NQU4gVEhFTmApO1xuICAgICAgbGluZXMucHVzaChgICAke3ByZWZpeH1fRVJSIDo9ICR7cHJlZml4fV9TUCAtICR7cHJlZml4fV9QVjtgKTtcbiAgICAgIGxpbmVzLnB1c2goJycpO1xuICAgICAgbGluZXMucHVzaCgnICAoKiBQSUQgY2FsY3VsYXRpb24gXHUyMDE0IHVzZSBPU0NBVCBGVF9QSUQgb3IgdmVuZG9yIEZCICopJyk7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7cHJlZml4fV9DViA6PSAke3ByZWZpeH1fS1AgKiAke3ByZWZpeH1fRVJSO2ApO1xuICAgICAgbGluZXMucHVzaCgnJyk7XG4gICAgICBsaW5lcy5wdXNoKCcgICgqIE91dHB1dCBsaW1pdGluZyAqKScpO1xuICAgICAgbGluZXMucHVzaChgICBJRiAke3ByZWZpeH1fQ1YgPiAxMDAuMCBUSEVOYCk7XG4gICAgICBsaW5lcy5wdXNoKGAgICAgJHtwcmVmaXh9X0NWIDo9IDEwMC4wO2ApO1xuICAgICAgbGluZXMucHVzaChgICBFTFNJRiAke3ByZWZpeH1fQ1YgPCAwLjAgVEhFTmApO1xuICAgICAgbGluZXMucHVzaChgICAgICR7cHJlZml4fV9DViA6PSAwLjA7YCk7XG4gICAgICBsaW5lcy5wdXNoKCcgIEVORF9JRjsnKTtcbiAgICAgIGxpbmVzLnB1c2goJ0VORF9JRjsnKTtcbiAgICB9XG5cbiAgICBsaW5lcy5wdXNoKCcnKTtcbiAgfVxuXG4gIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVJbnRlcmxvY2tDb2RlKGludGVybG9ja3M6IFBJREludGVybG9ja1tdKTogc3RyaW5nIHtcbiAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gW1xuICAgICcoKiBTYWZldHkgSW50ZXJsb2NrIExvZ2ljICopJyxcbiAgICAnKCogQXV0by1nZW5lcmF0ZWQgZnJvbSBQJklEIGFuYWx5c2lzICopJyxcbiAgICAnKCogV0FSTklORzogUmV2aWV3IGFuZCB2YWxpZGF0ZSBiZWZvcmUgZGVwbG95bWVudCAqKScsXG4gICAgJycsXG4gIF07XG5cbiAgZm9yIChjb25zdCBpbnRlcmxvY2sgb2YgaW50ZXJsb2Nrcykge1xuICAgIGNvbnN0IHRhZyA9IGludGVybG9jay5pZC5yZXBsYWNlKC9bXmEtekEtWjAtOV9dL2csICdfJyk7XG5cbiAgICBsaW5lcy5wdXNoKGAoKiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgJHtpbnRlcmxvY2submFtZX0gWyR7aW50ZXJsb2NrLnByaW9yaXR5fV0gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwICopYCk7XG4gICAgbGluZXMucHVzaChgKCogVHJpZ2dlcjogJHtpbnRlcmxvY2sudHJpZ2dlckNvbmRpdGlvbn0gKilgKTtcbiAgICBsaW5lcy5wdXNoKCcnKTtcblxuICAgIC8vIEdlbmVyYXRlIGNvbmRpdGlvbiBldmFsdWF0aW9uXG4gICAgY29uc3QgY29uZFBhcnRzID0gaW50ZXJsb2NrLmluc3RydW1lbnRzLm1hcCgoaW5zdCkgPT4ge1xuICAgICAgY29uc3QgaXNIaWdoQWxhcm0gPSBpbnN0LnN1YnNlcXVlbnRMZXR0ZXJzLmluY2x1ZGVzKCdIJyk7XG4gICAgICBjb25zdCBpc0xvd0FsYXJtID0gaW5zdC5zdWJzZXF1ZW50TGV0dGVycy5pbmNsdWRlcygnTCcpO1xuXG4gICAgICBpZiAoaXNIaWdoQWxhcm0pIHtcbiAgICAgICAgcmV0dXJuIGAke2luc3QudGFnTnVtYmVyfV9QViA+PSAke2luc3QudGFnTnVtYmVyfV9ISGA7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc0xvd0FsYXJtKSB7XG4gICAgICAgIHJldHVybiBgJHtpbnN0LnRhZ051bWJlcn1fUFYgPD0gJHtpbnN0LnRhZ051bWJlcn1fTExgO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYCR7aW5zdC50YWdOdW1iZXJ9YDtcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvbmRpdGlvbiA9IGNvbmRQYXJ0cy5sZW5ndGggPiAwID8gY29uZFBhcnRzLmpvaW4oJyBPUiAnKSA6ICdGQUxTRSc7XG5cbiAgICBsaW5lcy5wdXNoKGAoKiBDb25kaXRpb24gZXZhbHVhdGlvbiAqKWApO1xuICAgIGxpbmVzLnB1c2goYCR7dGFnfV9BQ1RJVkUgOj0gJHtjb25kaXRpb259O2ApO1xuICAgIGxpbmVzLnB1c2goJycpO1xuXG4gICAgLy8gTGF0Y2ggbG9naWMgKHNhZmV0eSBpbnRlcmxvY2tzIGxhdGNoIFx1MjAxNCByZXF1aXJlIG1hbnVhbCByZXNldClcbiAgICBpZiAoaW50ZXJsb2NrLnByaW9yaXR5ID09PSAnc2FmZXR5Jykge1xuICAgICAgbGluZXMucHVzaCgnKCogU2FmZXR5IGxhdGNoIFx1MjAxNCByZXF1aXJlcyBtYW51YWwgcmVzZXQgKiknKTtcbiAgICAgIGxpbmVzLnB1c2goYElGICR7dGFnfV9BQ1RJVkUgVEhFTmApO1xuICAgICAgbGluZXMucHVzaChgICAke3RhZ31fTEFUQ0hFRCA6PSBUUlVFO2ApO1xuICAgICAgbGluZXMucHVzaCgnRU5EX0lGOycpO1xuICAgICAgbGluZXMucHVzaChgSUYgJHt0YWd9X1JFU0VUIEFORCBOT1QgJHt0YWd9X0FDVElWRSBUSEVOYCk7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7dGFnfV9MQVRDSEVEIDo9IEZBTFNFO2ApO1xuICAgICAgbGluZXMucHVzaCgnRU5EX0lGOycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaW5lcy5wdXNoKCcoKiBQcm9jZXNzIGludGVybG9jayBcdTIwMTQgYXV0by1yZXNldCB3aGVuIGNvbmRpdGlvbiBjbGVhcnMgKiknKTtcbiAgICAgIGxpbmVzLnB1c2goYCR7dGFnfV9MQVRDSEVEIDo9ICR7dGFnfV9BQ1RJVkU7YCk7XG4gICAgfVxuXG4gICAgbGluZXMucHVzaCgnJyk7XG5cbiAgICAvLyBBY3Rpb25zXG4gICAgbGluZXMucHVzaCgnKCogQWN0aW9ucyAqKScpO1xuICAgIGxpbmVzLnB1c2goYElGICR7dGFnfV9MQVRDSEVEIFRIRU5gKTtcblxuICAgIGZvciAoY29uc3QgYWN0aW9uIG9mIGludGVybG9jay5hY3Rpb25zKSB7XG4gICAgICBjb25zdCBhY3Rpb25UYWcgPSBhY3Rpb24ucmVwbGFjZSgvXFxzKy9nLCAnXycpLnRvVXBwZXJDYXNlKCk7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7YWN0aW9uVGFnfSA6PSBUUlVFO2ApO1xuICAgIH1cblxuICAgIGxpbmVzLnB1c2goJ0VORF9JRjsnKTtcbiAgICBsaW5lcy5wdXNoKCcnKTtcbiAgfVxuXG4gIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVBbmFseXNpc1JlcG9ydChwYXJzZVJlc3VsdDogUElEUGFyc2VSZXN1bHQsIGNvZGVSZXN1bHQ6IFBJRENvZGVHZW5SZXN1bHQpOiBzdHJpbmcge1xuICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXG4gICAgJyMgUCZJRCBBbmFseXNpcyBSZXBvcnQnLFxuICAgICcnLFxuICAgIGAqKkNvbmZpZGVuY2U6KiogJHsocGFyc2VSZXN1bHQuY29uZmlkZW5jZSAqIDEwMCkudG9GaXhlZCgwKX0lYCxcbiAgICBgKipHZW5lcmF0ZWQ6KiogJHtuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3BsaXQoJ1QnKVswXX1gLFxuICAgICcnLFxuICBdO1xuXG4gIGlmIChwYXJzZVJlc3VsdC5yYXdEZXNjcmlwdGlvbikge1xuICAgIGxpbmVzLnB1c2goJyMjIFAmSUQgRGVzY3JpcHRpb24nKTtcbiAgICBsaW5lcy5wdXNoKHBhcnNlUmVzdWx0LnJhd0Rlc2NyaXB0aW9uKTtcbiAgICBsaW5lcy5wdXNoKCcnKTtcbiAgfVxuXG4gIC8vIEluc3RydW1lbnRzXG4gIGNvbnN0IGluc3RydW1lbnRzID0gcGFyc2VSZXN1bHQuZWxlbWVudHMuZmlsdGVyKChlKSA9PiBlLnR5cGUgPT09ICdpbnN0cnVtZW50JykgYXMgUElESW5zdHJ1bWVudFtdO1xuXG4gIGlmIChpbnN0cnVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgbGluZXMucHVzaCgnIyMgSW5zdHJ1bWVudHMnKTtcbiAgICBsaW5lcy5wdXNoKCd8IFRhZyB8IFZhcmlhYmxlIHwgRnVuY3Rpb24gfCBMb2NhdGlvbiB8Jyk7XG4gICAgbGluZXMucHVzaCgnfC0tLS0tfC0tLS0tLS0tLS18LS0tLS0tLS0tLXwtLS0tLS0tLS0tfCcpO1xuXG4gICAgZm9yIChjb25zdCBpbnN0IG9mIGluc3RydW1lbnRzKSB7XG4gICAgICBsaW5lcy5wdXNoKFxuICAgICAgICBgfCAke2luc3QudGFnTnVtYmVyfSB8ICR7aW5zdC5tZWFzdXJlZFZhcmlhYmxlfSB8ICR7aW5zdC5zdWJzZXF1ZW50TGV0dGVycy5qb2luKCcnKX0gfCAke2luc3QubG9jYXRpb259IHxgLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBsaW5lcy5wdXNoKCcnKTtcbiAgfVxuXG4gIC8vIFZhbHZlc1xuICBjb25zdCB2YWx2ZXMgPSBwYXJzZVJlc3VsdC5lbGVtZW50cy5maWx0ZXIoKGUpID0+IGUudHlwZSA9PT0gJ3ZhbHZlJykgYXMgUElEVmFsdmVbXTtcblxuICBpZiAodmFsdmVzLmxlbmd0aCA+IDApIHtcbiAgICBsaW5lcy5wdXNoKCcjIyBWYWx2ZXMnKTtcbiAgICBsaW5lcy5wdXNoKCd8IFRhZyB8IFR5cGUgfCBBY3R1YXRvciB8IEZhaWwgUG9zaXRpb24gfCcpO1xuICAgIGxpbmVzLnB1c2goJ3wtLS0tLXwtLS0tLS18LS0tLS0tLS0tLXwtLS0tLS0tLS0tLS0tLS18Jyk7XG5cbiAgICBmb3IgKGNvbnN0IHZhbHZlIG9mIHZhbHZlcykge1xuICAgICAgbGluZXMucHVzaChcbiAgICAgICAgYHwgJHt2YWx2ZS50YWdOdW1iZXJ9IHwgJHt2YWx2ZS52YWx2ZVR5cGV9IHwgJHt2YWx2ZS5hY3R1YXRvclR5cGUgfHwgJy0nfSB8ICR7dmFsdmUuZmFpbFBvc2l0aW9uIHx8ICctJ30gfGAsXG4gICAgICApO1xuICAgIH1cblxuICAgIGxpbmVzLnB1c2goJycpO1xuICB9XG5cbiAgLy8gQ29udHJvbCBMb29wc1xuICBpZiAocGFyc2VSZXN1bHQuY29udHJvbExvb3BzLmxlbmd0aCA+IDApIHtcbiAgICBsaW5lcy5wdXNoKCcjIyBDb250cm9sIExvb3BzJyk7XG5cbiAgICBmb3IgKGNvbnN0IGxvb3Agb2YgcGFyc2VSZXN1bHQuY29udHJvbExvb3BzKSB7XG4gICAgICBsaW5lcy5wdXNoKGAtICoqTG9vcCAke2xvb3AubG9vcE51bWJlcn0qKiAoJHtsb29wLmNvbnRyb2xUeXBlfSk6ICR7bG9vcC5kZXNjcmlwdGlvbn1gKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgLSBTZW5zb3I6ICR7bG9vcC5zZW5zb3IudGFnTnVtYmVyfSBcdTIxOTIgQ29udHJvbGxlciBcdTIxOTIgJHsobG9vcC5maW5hbEVsZW1lbnQgYXMgYW55KS50YWdOdW1iZXJ9YCk7XG5cbiAgICAgIGlmIChsb29wLnNldHBvaW50ICE9IG51bGwpIHtcbiAgICAgICAgbGluZXMucHVzaChgICAtIFNldHBvaW50OiAke2xvb3Auc2V0cG9pbnR9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGluZXMucHVzaCgnJyk7XG4gIH1cblxuICAvLyBJbnRlcmxvY2tzXG4gIGlmIChwYXJzZVJlc3VsdC5pbnRlcmxvY2tzLmxlbmd0aCA+IDApIHtcbiAgICBsaW5lcy5wdXNoKCcjIyBTYWZldHkgSW50ZXJsb2NrcycpO1xuXG4gICAgZm9yIChjb25zdCBpbnRlcmxvY2sgb2YgcGFyc2VSZXN1bHQuaW50ZXJsb2Nrcykge1xuICAgICAgbGluZXMucHVzaChgLSAqKiR7aW50ZXJsb2NrLm5hbWV9KiogWyR7aW50ZXJsb2NrLnByaW9yaXR5fV1gKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgLSBUcmlnZ2VyOiAke2ludGVybG9jay50cmlnZ2VyQ29uZGl0aW9ufWApO1xuICAgICAgbGluZXMucHVzaChgICAtIEFjdGlvbnM6ICR7aW50ZXJsb2NrLmFjdGlvbnMuam9pbignLCAnKX1gKTtcbiAgICB9XG5cbiAgICBsaW5lcy5wdXNoKCcnKTtcbiAgfVxuXG4gIC8vIEkvTyBTdW1tYXJ5XG4gIGxpbmVzLnB1c2goJyMjIEkvTyBTdW1tYXJ5Jyk7XG4gIGxpbmVzLnB1c2goYC0gRGlnaXRhbCBJbnB1dHM6ICR7Y29kZVJlc3VsdC5pb0NvdW50LmRpZ2l0YWxJbnB1dHN9YCk7XG4gIGxpbmVzLnB1c2goYC0gRGlnaXRhbCBPdXRwdXRzOiAke2NvZGVSZXN1bHQuaW9Db3VudC5kaWdpdGFsT3V0cHV0c31gKTtcbiAgbGluZXMucHVzaChgLSBBbmFsb2cgSW5wdXRzOiAke2NvZGVSZXN1bHQuaW9Db3VudC5hbmFsb2dJbnB1dHN9YCk7XG4gIGxpbmVzLnB1c2goYC0gQW5hbG9nIE91dHB1dHM6ICR7Y29kZVJlc3VsdC5pb0NvdW50LmFuYWxvZ091dHB1dHN9YCk7XG4gIGxpbmVzLnB1c2goYC0gKipUb3RhbCBJL08gcG9pbnRzOioqICR7T2JqZWN0LnZhbHVlcyhjb2RlUmVzdWx0LmlvQ291bnQpLnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApfWApO1xuXG4gIC8vIFdhcm5pbmdzXG4gIGlmIChwYXJzZVJlc3VsdC53YXJuaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgbGluZXMucHVzaCgnJyk7XG4gICAgbGluZXMucHVzaCgnIyMgV2FybmluZ3MnKTtcblxuICAgIGZvciAoY29uc3QgdyBvZiBwYXJzZVJlc3VsdC53YXJuaW5ncykge1xuICAgICAgbGluZXMucHVzaChgLSBcdTI2QTBcdUZFMEYgJHt3fWApO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGJ1aWxkU3VtbWFyeShwYXJzZVJlc3VsdDogUElEUGFyc2VSZXN1bHQsIGNvZGVSZXN1bHQ6IFBJRENvZGVHZW5SZXN1bHQpOiBQaXBlbGluZVN1bW1hcnkge1xuICByZXR1cm4ge1xuICAgIGluc3RydW1lbnRDb3VudDogcGFyc2VSZXN1bHQuZWxlbWVudHMuZmlsdGVyKChlKSA9PiBlLnR5cGUgPT09ICdpbnN0cnVtZW50JykubGVuZ3RoLFxuICAgIHZhbHZlQ291bnQ6IHBhcnNlUmVzdWx0LmVsZW1lbnRzLmZpbHRlcigoZSkgPT4gZS50eXBlID09PSAndmFsdmUnKS5sZW5ndGgsXG4gICAgcHVtcENvdW50OiBwYXJzZVJlc3VsdC5lbGVtZW50cy5maWx0ZXIoKGUpID0+IGUudHlwZSA9PT0gJ3B1bXAnKS5sZW5ndGgsXG4gICAgY29udHJvbExvb3BDb3VudDogcGFyc2VSZXN1bHQuY29udHJvbExvb3BzLmxlbmd0aCxcbiAgICBpbnRlcmxvY2tDb3VudDogcGFyc2VSZXN1bHQuaW50ZXJsb2Nrcy5sZW5ndGgsXG4gICAgaW9Db3VudDogY29kZVJlc3VsdC5pb0NvdW50LFxuICAgIGNvbmZpZGVuY2U6IHBhcnNlUmVzdWx0LmNvbmZpZGVuY2UsXG4gICAgd2FybmluZ3M6IHBhcnNlUmVzdWx0Lndhcm5pbmdzLFxuICB9O1xufVxuXG5mdW5jdGlvbiBlbXB0eVN1bW1hcnkoKTogUGlwZWxpbmVTdW1tYXJ5IHtcbiAgcmV0dXJuIHtcbiAgICBpbnN0cnVtZW50Q291bnQ6IDAsXG4gICAgdmFsdmVDb3VudDogMCxcbiAgICBwdW1wQ291bnQ6IDAsXG4gICAgY29udHJvbExvb3BDb3VudDogMCxcbiAgICBpbnRlcmxvY2tDb3VudDogMCxcbiAgICBpb0NvdW50OiB7IGRpZ2l0YWxJbnB1dHM6IDAsIGRpZ2l0YWxPdXRwdXRzOiAwLCBhbmFsb2dJbnB1dHM6IDAsIGFuYWxvZ091dHB1dHM6IDAgfSxcbiAgICBjb25maWRlbmNlOiAwLFxuICAgIHdhcm5pbmdzOiBbXSxcbiAgfTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQVdBLFNBQVMsZUFBZSxxQkFBcUIsMkJBQTJCO0FBa0V4RSxlQUFzQixtQkFDcEIsT0FDQSxZQUM0QjtBQUU1QixNQUFJO0FBRUosTUFBSSxNQUFNLGVBQWUsTUFBTSxVQUFVO0FBQ3ZDLGtCQUFjLE1BQU0sY0FBYyxNQUFNLGFBQWEsTUFBTSxVQUFVLFVBQVU7QUFBQSxFQUNqRixXQUFXLE1BQU0saUJBQWlCO0FBQ2hDLGtCQUFjLE1BQU0sb0JBQW9CLE1BQU0saUJBQWlCLFVBQVU7QUFBQSxFQUMzRSxPQUFPO0FBQ0wsV0FBTztBQUFBLE1BQ0wsU0FBUztBQUFBLE1BQ1QsYUFBYTtBQUFBLFFBQ1gsVUFBVSxDQUFDO0FBQUEsUUFDWCxjQUFjLENBQUM7QUFBQSxRQUNmLFlBQVksQ0FBQztBQUFBLFFBQ2IsT0FBTyxDQUFDO0FBQUEsUUFDUixZQUFZO0FBQUEsUUFDWixVQUFVLENBQUMsbUJBQW1CO0FBQUEsTUFDaEM7QUFBQSxNQUNBLFlBQVk7QUFBQSxNQUNaLE9BQU8sQ0FBQztBQUFBLE1BQ1IsU0FBUyxhQUFhO0FBQUEsTUFDdEIsT0FBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBRUEsTUFBSSxZQUFZLGVBQWUsS0FBSyxZQUFZLFNBQVMsV0FBVyxHQUFHO0FBQ3JFLFdBQU87QUFBQSxNQUNMLFNBQVM7QUFBQSxNQUNUO0FB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
