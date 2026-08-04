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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L3ZlbmRvci9waWQvcGlwZWxpbmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogUCZJRCBcdTIxOTIgU1QgQ29kZSBFbmQtdG8tRW5kIFBpcGVsaW5lXG4gKlxuICogT3JjaGVzdHJhdGVzIHRoZSBmdWxsIGZsb3c6XG4gKiAgIDEuIEltYWdlIFx1MjE5MiBHZW1pbmkgVmlzaW9uIFx1MjE5MiBQSURQYXJzZVJlc3VsdCAoaW5zdHJ1bWVudHMsIGxvb3BzLCBpbnRlcmxvY2tzKVxuICogICAyLiBQSURQYXJzZVJlc3VsdCBcdTIxOTIgU1QgY29kZSBnZW5lcmF0aW9uICh2YXJpYWJsZXMsIHJ1bmdzLCBjb250cm9sIGxvZ2ljKVxuICogICAzLiBTVCBjb2RlIFx1MjE5MiB3b3JrYmVuY2ggZmlsZSBwb3B1bGF0aW9uIChtYWluLnN0LCBpb19saXN0LmNzdiwgZGlhZ3JhbS5qc29uKVxuICpcbiAqIFRoaXMgaXMgdGhlIGNvcmUgZGlmZmVyZW50aWF0b3I6IFwicGhvdG9ncmFwaCBhIFAmSUQsIGdldCB3b3JraW5nIFBMQyBjb2RlLlwiXG4gKi9cblxuaW1wb3J0IHsgcGFyc2VQSURJbWFnZSwgcGFyc2VQSUREZXNjcmlwdGlvbiwgZ2VuZXJhdGVDb2RlRnJvbVBJRCB9IGZyb20gJy4vcGFyc2VyLmpzJztcbmltcG9ydCB0eXBlIHtcbiAgUElEUGFyc2VSZXN1bHQsXG4gIFBJRENvZGVHZW5SZXF1ZXN0LFxuICBQSURDb2RlR2VuUmVzdWx0LFxuICBQSURJbnN0cnVtZW50LFxuICBQSURWYWx2ZSxcbiAgUElEUHVtcCxcbiAgUElEQ29udHJvbExvb3AsXG4gIFBJREludGVybG9jayxcbn0gZnJvbSAnLi90eXBlcy5qcyc7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBQaXBlbGluZSBUeXBlcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGludGVyZmFjZSBQSURQaXBlbGluZUlucHV0IHtcbiAgaW1hZ2VCYXNlNjQ/OiBzdHJpbmc7XG4gIG1pbWVUeXBlPzogc3RyaW5nO1xuICB0ZXh0RGVzY3JpcHRpb24/OiBzdHJpbmc7XG4gIHRhcmdldFZlbmRvcj86IHN0cmluZztcbiAgc2FmZXR5TGV2ZWw/OiAnU0lMMScgfCAnU0lMMicgfCAnU0lMMycgfCAnbm9uZSc7XG4gIHNjYW5UaW1lPzogc3RyaW5nO1xuICBjb250cm9sU3RyYXRlZ3k/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUElEUGlwZWxpbmVSZXN1bHQge1xuICBzdWNjZXNzOiBib29sZWFuO1xuICBwYXJzZVJlc3VsdDogUElEUGFyc2VSZXN1bHQ7XG4gIGNvZGVSZXN1bHQ6IFBJRENvZGVHZW5SZXN1bHQgfCBudWxsO1xuICBmaWxlczogR2VuZXJhdGVkRmlsZVtdO1xuICBzdW1tYXJ5OiBQaXBlbGluZVN1bW1hcnk7XG4gIGVycm9yPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEdlbmVyYXRlZEZpbGUge1xuICBwYXRoOiBzdHJpbmc7XG4gIGNvbnRlbnQ6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQaXBlbGluZVN1bW1hcnkge1xuICBpbnN0cnVtZW50Q291bnQ6IG51bWJlcjtcbiAgdmFsdmVDb3VudDogbnVtYmVyO1xuICBwdW1wQ291bnQ6IG51bWJlcjtcbiAgY29udHJvbExvb3BDb3VudDogbnVtYmVyO1xuICBpbnRlcmxvY2tDb3VudDogbnVtYmVyO1xuICBpb0NvdW50OiB7XG4gICAgZGlnaXRhbElucHV0czogbnVtYmVyO1xuICAgIGRpZ2l0YWxPdXRwdXRzOiBudW1iZXI7XG4gICAgYW5hbG9nSW5wdXRzOiBudW1iZXI7XG4gICAgYW5hbG9nT3V0cHV0czogbnVtYmVyO1xuICB9O1xuICBjb25maWRlbmNlOiBudW1iZXI7XG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IHR5cGUgQUlWaXNpb25Qcm92aWRlciA9IChwcm9tcHQ6IHN0cmluZywgaW1hZ2U/OiB7IGRhdGE6IHN0cmluZzsgbWltZVR5cGU6IHN0cmluZyB9KSA9PiBQcm9taXNlPHN0cmluZz47XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBQaXBlbGluZSBFeGVjdXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbi8qKlxuICogRXhlY3V0ZSB0aGUgZnVsbCBQJklEIFx1MjE5MiBTVCBwaXBlbGluZS5cbiAqXG4gKiBAcGFyYW0gaW5wdXQgLSBJbWFnZSBvciB0ZXh0IGRlc2NyaXB0aW9uIG9mIHRoZSBQJklEXG4gKiBAcGFyYW0gYWlQcm92aWRlciAtIFZpc2lvbi1jYXBhYmxlIEFJIHByb3ZpZGVyIGZ1bmN0aW9uXG4gKiBAcmV0dXJucyBDb21wbGV0ZSBwaXBlbGluZSByZXN1bHQgd2l0aCBnZW5lcmF0ZWQgZmlsZXNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGVQSURQaXBlbGluZShcbiAgaW5wdXQ6IFBJRFBpcGVsaW5lSW5wdXQsXG4gIGFpUHJvdmlkZXI6IEFJVmlzaW9uUHJvdmlkZXIsXG4pOiBQcm9taXNlPFBJRFBpcGVsaW5lUmVzdWx0PiB7XG4gIC8vIFN0ZXAgMTogUGFyc2UgdGhlIFAmSUQgKGltYWdlIG9yIGRlc2NyaXB0aW9uKVxuICBsZXQgcGFyc2VSZXN1bHQ6IFBJRFBhcnNlUmVzdWx0O1xuXG4gIGlmIChpbnB1dC5pbWFnZUJhc2U2NCAmJiBpbnB1dC5taW1lVHlwZSkge1xuICAgIHBhcnNlUmVzdWx0ID0gYXdhaXQgcGFyc2VQSURJbWFnZShpbnB1dC5pbWFnZUJhc2U2NCwgaW5wdXQubWltZVR5cGUsIGFpUHJvdmlkZXIpO1xuICB9IGVsc2UgaWYgKGlucHV0LnRleHREZXNjcmlwdGlvbikge1xuICAgIHBhcnNlUmVzdWx0ID0gYXdhaXQgcGFyc2VQSUREZXNjcmlwdGlvbihpbnB1dC50ZXh0RGVzY3JpcHRpb24sIGFpUHJvdmlkZXIpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgIHBhcnNlUmVzdWx0OiB7XG4gICAgICAgIGVsZW1lbnRzOiBbXSxcbiAgICAgICAgY29udHJvbExvb3BzOiBbXSxcbiAgICAgICAgaW50ZXJsb2NrczogW10sXG4gICAgICAgIHBpcGVzOiBbXSxcbiAgICAgICAgY29uZmlkZW5jZTogMCxcbiAgICAgICAgd2FybmluZ3M6IFsnTm8gaW5wdXQgcHJvdmlkZWQnXSxcbiAgICAgIH0sXG4gICAgICBjb2RlUmVzdWx0OiBudWxsLFxuICAgICAgZmlsZXM6IFtdLFxuICAgICAgc3VtbWFyeTogZW1wdHlTdW1tYXJ5KCksXG4gICAgICBlcnJvcjogJ05vIGltYWdlIG9yIGRlc2NyaXB0aW9uIHByb3ZpZGVkJyxcbiAgICB9O1xuICB9XG5cbiAgaWYgKHBhcnNlUmVzdWx0LmNvbmZpZGVuY2UgPT09IDAgJiYgcGFyc2VSZXN1bHQuZWxlbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgcGFyc2VSZXN1bHQsXG4gICAgICBjb2RlUmVzdWx0OiBudWxsLFxuICAgICAgZmlsZXM6IFtdLFxuICAgICAgc3VtbWFyeTogZW1wdHlTdW1tYXJ5KCksXG4gICAgICBlcnJvcjogYFAmSUQgcGFyc2luZyBmYWlsZWQ6ICR7cGFyc2VSZXN1bHQud2FybmluZ3Muam9pbignOyAnKX1gLFxuICAgIH07XG4gIH1cblxuICAvLyBTdGVwIDI6IEdlbmVyYXRlIFBMQyBjb2RlIGZyb20gcGFyc2UgcmVzdWx0XG4gIGNvbnN0IGNvZGVHZW5SZXF1ZXN0OiBQSURDb2RlR2VuUmVxdWVzdCA9IHtcbiAgICBwYXJzZVJlc3VsdCxcbiAgICB0YXJnZXRWZW5kb3I6IGlucHV0LnRhcmdldFZlbmRvciB8fCAnZ2VuZXJpYycsXG4gICAgc2FmZXR5TGV2ZWw6IGlucHV0LnNhZmV0eUxldmVsIHx8ICdub25lJyxcbiAgICBzY2FuVGltZTogaW5wdXQuc2NhblRpbWUgfHwgJ1QjMTAwbXMnLFxuICAgIGNvbnRyb2xTdHJhdGVneTogaW5wdXQuY29udHJvbFN0cmF0ZWd5LFxuICB9O1xuXG4gIGNvbnN0IGNvZGVSZXN1bHQgPSBhd2FpdCBnZW5lcmF0ZUNvZGVGcm9tUElEKGNvZGVHZW5SZXF1ZXN0LCBhaVByb3ZpZGVyKTtcblxuICAvLyBTdGVwIDM6IEdlbmVyYXRlIHdvcmtiZW5jaCBmaWxlc1xuICBjb25zdCBmaWxlcyA9IGdlbmVyYXRlV29ya2JlbmNoRmlsZXMocGFyc2VSZXN1bHQsIGNvZGVSZXN1bHQpO1xuXG4gIC8vIFN0ZXAgNDogQnVpbGQgc3VtbWFyeVxuICBjb25zdCBzdW1tYXJ5ID0gYnVpbGRTdW1tYXJ5KHBhcnNlUmVzdWx0LCBjb2RlUmVzdWx0KTtcblxuICByZXR1cm4ge1xuICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgcGFyc2VSZXN1bHQsXG4gICAgY29kZVJlc3VsdCxcbiAgICBmaWxlcyxcbiAgICBzdW1tYXJ5LFxuICB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRmlsZSBHZW5lcmF0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBnZW5lcmF0ZVdvcmtiZW5jaEZpbGVzKHBhcnNlUmVzdWx0OiBQSURQYXJzZVJlc3VsdCwgY29kZVJlc3VsdDogUElEQ29kZUdlblJlc3VsdCk6IEdlbmVyYXRlZEZpbGVbXSB7XG4gIGNvbnN0IGZpbGVzOiBHZW5lcmF0ZWRGaWxlW10gPSBbXTtcblxuICAvLyBNYWluIFNUIHByb2dyYW0gZmlsZVxuICBmaWxlcy5wdXNoKHtcbiAgICBwYXRoOiAnc3JjL21haW4uc3QnLFxuICAgIGNvbnRlbnQ6IGNvZGVSZXN1bHQuc3RDb2RlLFxuICAgIGRlc2NyaXB0aW9uOiAnTWFpbiBTdHJ1Y3R1cmVkIFRleHQgcHJvZ3JhbSBnZW5lcmF0ZWQgZnJvbSBQJklEJyxcbiAgfSk7XG5cbiAgLy8gSU8gdGFnIGxpc3QgYXMgQ1NWXG4gIGZpbGVzLnB1c2goe1xuICAgIHBhdGg6ICd0YWdzL2lvX2xpc3QuY3N2JyxcbiAgICBjb250ZW50OiBnZW5lcmF0ZUlPQ1NWKGNvZGVSZXN1bHQudGFnTGlzdCksXG4gICAgZGVzY3JpcHRpb246ICdJL08gdGFnIGxpc3Qgd2l0aCBhZGRyZXNzZXMgYW5kIGRlc2NyaXB0aW9ucycsXG4gIH0pO1xuXG4gIC8vIFZhcmlhYmxlIGRlY2xhcmF0aW9ucyBhcyBzZXBhcmF0ZSBmaWxlIChmb3IgaW1wb3J0IGludG8gT3BlblBMQylcbiAgZmlsZXMucHVzaCh7XG4gICAgcGF0aDogJ3NyYy92YXJpYWJsZXMuc3QnLFxuICAgIGNvbnRlbnQ6IGdlbmVyYXRlVmFyaWFibGVEZWNsYXJhdGlvbnMoY29kZVJlc3VsdC50YWdMaXN0LCBwYXJzZVJlc3VsdCksXG4gICAgZGVzY3JpcHRpb246ICdWYXJpYWJsZSBkZWNsYXJhdGlvbnMgZm9yIGFsbCBQJklEIGluc3RydW1lbnRzIGFuZCBhY3R1YXRvcnMnLFxuICB9KTtcblxuICAvLyBDb250cm9sIGxvb3AgY29uZmlndXJhdGlvblxuICBpZiAocGFyc2VSZXN1bHQuY29udHJvbExvb3BzLmxlbmd0aCA+IDApIHtcbiAgICBmaWxlcy5wdXNoKHtcbiAgICAgIHBhdGg6ICdzcmMvY29udHJvbF9sb29wcy5zdCcsXG4gICAgICBjb250ZW50OiBnZW5lcmF0ZUNvbnRyb2xMb29wQ29kZShwYXJzZVJlc3VsdC5jb250cm9sTG9vcHMpLFxuICAgICAgZGVzY3JpcHRpb246ICdQSUQgY29udHJvbCBsb29wIGltcGxlbWVudGF0aW9ucycsXG4gICAgfSk7XG4gIH1cblxuICAvLyBTYWZldHkgaW50ZXJsb2NrcyBhcyBzZXBhcmF0ZSBtb2R1bGVcbiAgaWYgKHBhcnNlUmVzdWx0LmludGVybG9ja3MubGVuZ3RoID4gMCkge1xuICAgIGZpbGVzLnB1c2goe1xuICAgICAgcGF0aDogJ3NyYy9pbnRlcmxvY2tzLnN0JyxcbiAgICAgIGNvbnRlbnQ6IGdlbmVyYXRlSW50ZXJsb2NrQ29kZShwYXJzZVJlc3VsdC5pbnRlcmxvY2tzKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2FmZXR5IGludGVybG9jayBsb2dpYycsXG4gICAgfSk7XG4gIH1cblxuICAvLyBEaWFncmFtIEpTT04gZm9yIGxhZGRlciB2aXN1YWxpemF0aW9uXG4gIGZpbGVzLnB1c2goe1xuICAgIHBhdGg6ICdkaWFncmFtLmpzb24nLFxuICAgIGNvbnRlbnQ6IGNvZGVSZXN1bHQubGFkZGVySnNvbixcbiAgICBkZXNjcmlwdGlvbjogJ0xhZGRlciBkaWFncmFtIGxheW91dCBmb3IgdmlzdWFsaXphdGlvbicsXG4gIH0pO1xuXG4gIC8vIFAmSUQgYW5hbHlzaXMgcmVwb3J0IChtYXJrZG93bilcbiAgZmlsZXMucHVzaCh7XG4gICAgcGF0aDogJ2RvY3MvcGlkX2FuYWx5c2lzLm1kJyxcbiAgICBjb250ZW50OiBnZW5lcmF0ZUFuYWx5c2lzUmVwb3J0KHBhcnNlUmVzdWx0LCBjb2RlUmVzdWx0KSxcbiAgICBkZXNjcmlwdGlvbjogJ1AmSUQgYW5hbHlzaXMgcmVwb3J0IHdpdGggZXh0cmFjdGVkIGVsZW1lbnRzJyxcbiAgfSk7XG5cbiAgcmV0dXJuIGZpbGVzO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUlPQ1NWKHRhZ0xpc3Q6IFBJRENvZGVHZW5SZXN1bHRbJ3RhZ0xpc3QnXSk6IHN0cmluZyB7XG4gIGNvbnN0IGhlYWRlciA9ICdUYWcgTmFtZSxBZGRyZXNzLERhdGEgVHlwZSxEZXNjcmlwdGlvbixTb3VyY2UgRWxlbWVudCc7XG4gIGNvbnN0IHJvd3MgPSB0YWdMaXN0Lm1hcCgodCkgPT4gYCR7dC5uYW1lfSwke3QuYWRkcmVzc30sJHt0LmRhdGFUeXBlfSxcIiR7dC5kZXNjcmlwdGlvbn1cIiwke3Quc291cmNlfWApO1xuXG4gIHJldHVybiBbaGVhZGVyLCAuLi5yb3dzXS5qb2luKCdcXG4nKTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVWYXJpYWJsZURlY2xhcmF0aW9ucyh0YWdMaXN0OiBQSURDb2RlR2VuUmVzdWx0Wyd0YWdMaXN0J10sIHBhcnNlUmVzdWx0OiBQSURQYXJzZVJlc3VsdCk6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFsnUFJPR1JBTSBQSURfVmFyaWFibGVzJywgJygqIEF1dG8tZ2VuZXJhdGVkIGZyb20gUCZJRCBhbmFseXNpcyAqKScsICcnXTtcblxuICAvLyBHcm91cCBieSB0eXBlXG4gIGNvbnN0IGRpZ2l0YWxJbnB1dHMgPSB0YWdMaXN0LmZpbHRlcigodCkgPT4gdC5hZGRyZXNzLnN0YXJ0c1dpdGgoJyVJWCcpKTtcbiAgY29uc3QgZGlnaXRhbE91dHB1dHMgPSB0YWdMaXN0LmZpbHRlcigodCkgPT4gdC5hZGRyZXNzLnN0YXJ0c1dpdGgoJyVRWCcpKTtcbiAgY29uc3QgYW5hbG9nSW5wdXRzID0gdGFnTGlzdC5maWx0ZXIoKHQpID0+IHQuYWRkcmVzcy5zdGFydHNXaXRoKCclSVcnKSk7XG4gIGNvbnN0IGFuYWxvZ091dHB1dHMgPSB0YWdMaXN0LmZpbHRlcigodCkgPT4gdC5hZGRyZXNzLnN0YXJ0c1dpdGgoJyVRVycpKTtcblxuICBpZiAoZGlnaXRhbElucHV0cy5sZW5ndGggPiAwKSB7XG4gICAgbGluZXMucHVzaCgnVkFSX0lOUFVUJyk7XG4gICAgbGluZXMucHVzaCgnICAoKiBEaWdpdGFsIElucHV0cyAqKScpO1xuXG4gICAgZm9yIChjb25zdCB0YWcgb2YgZGlnaXRhbElucHV0cykge1xuICAgICAgbGluZXMucHVzaChgICAke3RhZy5uYW1lfSBBVCAke3RhZy5hZGRyZXNzfSA6ICR7dGFnLmRhdGFUeXBlfTsgKCogJHt0YWcuZGVzY3JpcHRpb259ICopYCk7XG4gICAgfVxuXG4gICAgbGluZXMucHVzaCgnRU5EX1ZBUicpO1xuICAgIGxpbmVzLnB1c2goJycpO1xuICB9XG5cbiAgaWYgKGFuYWxvZ0lucHV0cy5sZW5ndGggPiAwKSB7XG4gICAgbGluZXMucHVzaCgnVkFSX0lOUFVUJyk7XG4gICAgbGluZXMucHVzaCgnICAoKiBBbmFsb2cgSW5wdXRzICopJyk7XG5cbiAgICBmb3IgKGNvbnN0IHRhZyBvZiBhbmFsb2dJbnB1dHMpIHtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHt0YWcubmFtZX0gQVQgJHt0YWcuYWRkcmVzc30gOiAke3RhZy5kYXRhVHlwZX07ICgqICR7dGFnLmRlc2NyaXB0aW9ufSAqKWApO1xuICAgIH1cblxuICAgIGxpbmVzLnB1c2goJ0VORF9WQVInKTtcbiAgICBsaW5lcy5wdXNoKCcnKTtcbiAgfVxuXG4gIGlmIChkaWdpdGFsT3V0cHV0cy5sZW5ndGggPiAwKSB7XG4gICAgbGluZXMucHVzaCgnVkFSX09VVFBVVCcpO1xuICAgIGxpbmVzLnB1c2goJyAgKCogRGlnaXRhbCBPdXRwdXRzICopJyk7XG5cbiAgICBmb3IgKGNvbnN0IHRhZyBvZiBkaWdpdGFsT3V0cHV0cykge1xuICAgICAgbGluZXMucHVzaChgICAke3RhZy5uYW1lfSBBVCAke3RhZy5hZGRyZXNzfSA6ICR7dGFnLmRhdGFUeXBlfTsgKCogJHt0YWcuZGVzY3JpcHRpb259ICopYCk7XG4gICAgfVxuXG4gICAgbGluZXMucHVzaCgnRU5EX1ZBUicpO1xuICAgIGxpbmVzLnB1c2goJycpO1xuICB9XG5cbiAgaWYgKGFuYWxvZ091dHB1dHMubGVuZ3RoID4gMCkge1xuICAgIGxpbmVzLnB1c2goJ1ZBUl9PVVRQVVQnKTtcbiAgICBsaW5lcy5wdXNoKCcgICgqIEFuYWxvZyBPdXRwdXRzICopJyk7XG5cbiAgICBmb3IgKGNvbnN0IHRhZyBvZiBhbmFsb2dPdXRwdXRzKSB7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7dGFnLm5hbWV9IEFUICR7dGFnLmFkZHJlc3N9IDogJHt0YWcuZGF0YVR5cGV9OyAoKiAke3RhZy5kZXNjcmlwdGlvbn0gKilgKTtcbiAgICB9XG5cbiAgICBsaW5lcy5wdXNoKCdFTkRfVkFSJyk7XG4gICAgbGluZXMucHVzaCgnJyk7XG4gIH1cblxuICAvLyBJbnRlcm5hbCB2YXJpYWJsZXMgZm9yIGNvbnRyb2wgbG9vcHNcbiAgaWYgKHBhcnNlUmVzdWx0LmNvbnRyb2xMb29wcy5sZW5ndGggPiAwKSB7XG4gICAgbGluZXMucHVzaCgnVkFSJyk7XG4gICAgbGluZXMucHVzaCgnICAoKiBDb250cm9sIExvb3AgSW50ZXJuYWwgVmFyaWFibGVzICopJyk7XG5cbiAgICBmb3IgKGNvbnN0IGxvb3Agb2YgcGFyc2VSZXN1bHQuY29udHJvbExvb3BzKSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBgTE9PUF8ke2xvb3AubG9vcE51bWJlcn1gO1xuICAgICAgbGluZXMucHVzaChgICAke3ByZWZpeH1fU1AgOiBSRUFMIDo9ICR7bG9vcC5zZXRwb2ludCA/PyA1MC4wfTsgKCogU2V0cG9pbnQgKilgKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHtwcmVmaXh9X1BWIDogUkVBTDsgKCogUHJvY2VzcyBWYWx1ZSAtIHNjYWxlZCAqKWApO1xuICAgICAgbGluZXMucHVzaChgICAke3ByZWZpeH1fQ1YgOiBSRUFMOyAoKiBDb250cm9sIE91dHB1dCAqKWApO1xuICAgICAgbGluZXMucHVzaChgICAke3ByZWZpeH1fRU4gOiBCT09MIDo9IFRSVUU7ICgqIExvb3AgRW5hYmxlICopYCk7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7cHJlZml4fV9NQU4gOiBCT09MIDo9IEZBTFNFOyAoKiBNYW51YWwgTW9kZSAqKWApO1xuICAgICAgbGluZXMucHVzaChgICAke3ByZWZpeH1fRVJSIDogUkVBTDsgKCogRXJyb3IgPSBTUCAtIFBWICopYCk7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7cHJlZml4fV9LUCA6IFJFQUwgOj0gMS4wOyAoKiBQcm9wb3J0aW9uYWwgR2FpbiAqKWApO1xuICAgICAgbGluZXMucHVzaChgICAke3ByZWZpeH1fS0kgOiBSRUFMIDo9IDAuMTsgKCogSW50ZWdyYWwgR2FpbiAqKWApO1xuICAgICAgbGluZXMucHVzaChgICAke3ByZWZpeH1fS0QgOiBSRUFMIDo9IDAuMDsgKCogRGVyaXZhdGl2ZSBHYWluICopYCk7XG4gICAgICBsaW5lcy5wdXNoKCcnKTtcbiAgICB9XG5cbiAgICBsaW5lcy5wdXNoKCdFTkRfVkFSJyk7XG4gICAgbGluZXMucHVzaCgnJyk7XG4gIH1cblxuICAvLyBJbnRlcmxvY2sgc3RhdHVzIHZhcmlhYmxlc1xuICBpZiAocGFyc2VSZXN1bHQuaW50ZXJsb2Nrcy5sZW5ndGggPiAwKSB7XG4gICAgbGluZXMucHVzaCgnVkFSJyk7XG4gICAgbGluZXMucHVzaCgnICAoKiBTYWZldHkgSW50ZXJsb2NrIFN0YXR1cyAqKScpO1xuXG4gICAgZm9yIChjb25zdCBpbnRlcmxvY2sgb2YgcGFyc2VSZXN1bHQuaW50ZXJsb2Nrcykge1xuICAgICAgY29uc3QgdGFnID0gaW50ZXJsb2NrLmlkLnJlcGxhY2UoL1teYS16QS1aMC05X10vZywgJ18nKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHt0YWd9X0FDVElWRSA6IEJPT0w7ICgqICR7aW50ZXJsb2NrLm5hbWV9IGFjdGl2ZSAqKWApO1xuICAgICAgbGluZXMucHVzaChgICAke3RhZ31fTEFUQ0hFRCA6IEJPT0w7ICgqICR7aW50ZXJsb2NrLm5hbWV9IGxhdGNoZWQgKilgKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHt0YWd9X1JFU0VUIDogQk9PTDsgKCogJHtpbnRlcmxvY2submFtZX0gcmVzZXQgY29tbWFuZCAqKWApO1xuICAgIH1cblxuICAgIGxpbmVzLnB1c2goJ0VORF9WQVInKTtcbiAgfVxuXG4gIGxpbmVzLnB1c2goJycpO1xuICBsaW5lcy5wdXNoKCdFTkRfUFJPR1JBTScpO1xuXG4gIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVDb250cm9sTG9vcENvZGUobG9vcHM6IFBJRENvbnRyb2xMb29wW10pOiBzdHJpbmcge1xuICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbJygqIENvbnRyb2wgTG9vcCBJbXBsZW1lbnRhdGlvbnMgKiknLCAnKCogQXV0by1nZW5lcmF0ZWQgZnJvbSBQJklEIGFuYWx5c2lzICopJywgJyddO1xuXG4gIGZvciAoY29uc3QgbG9vcCBvZiBsb29wcykge1xuICAgIGNvbnN0IHByZWZpeCA9IGBMT09QXyR7bG9vcC5sb29wTnVtYmVyfWA7XG4gICAgY29uc3QgZGVzYyA9IGxvb3AuZGVzY3JpcHRpb24gfHwgYCR7bG9vcC5tZWFzdXJlZFZhcmlhYmxlfSBjb250cm9sYDtcblxuICAgIGxpbmVzLnB1c2goYCgqIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMCAke2Rlc2N9IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMCAqKWApO1xuICAgIGxpbmVzLnB1c2goXG4gICAgICBgKCogU2Vuc29yOiAke2xvb3Auc2Vuc29yLnRhZ051bWJlcn0gXHUyMTkyIENvbnRyb2xsZXIgXHUyMTkyICR7KGxvb3AuZmluYWxFbGVtZW50IGFzIFBJRFZhbHZlIHwgUElEUHVtcCkudGFnTnVtYmVyIHx8ICdvdXRwdXQnfSAqKWAsXG4gICAgKTtcbiAgICBsaW5lcy5wdXNoKGAoKiBDb250cm9sIFR5cGU6ICR7bG9vcC5jb250cm9sVHlwZX0gKilgKTtcbiAgICBsaW5lcy5wdXNoKCcnKTtcblxuICAgIGlmIChsb29wLmNvbnRyb2xUeXBlID09PSAnb25vZmYnKSB7XG4gICAgICBsaW5lcy5wdXNoKGBJRiAke3ByZWZpeH1fRU4gQU5EIE5PVCAke3ByZWZpeH1fTUFOIFRIRU5gKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHtwcmVmaXh9X0VSUiA6PSAke3ByZWZpeH1fU1AgLSAke3ByZWZpeH1fUFY7YCk7XG4gICAgICBsaW5lcy5wdXNoKGAgIElGICR7cHJlZml4fV9FUlIgPiAwLjAgVEhFTmApO1xuICAgICAgbGluZXMucHVzaChgICAgICR7cHJlZml4fV9DViA6PSAxMDAuMDtgKTtcbiAgICAgIGxpbmVzLnB1c2goJyAgRUxTRScpO1xuICAgICAgbGluZXMucHVzaChgICAgICR7cHJlZml4fV9DViA6PSAwLjA7YCk7XG4gICAgICBsaW5lcy5wdXNoKCcgIEVORF9JRjsnKTtcbiAgICAgIGxpbmVzLnB1c2goJ0VORF9JRjsnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGluZXMucHVzaChgSUYgJHtwcmVmaXh9X0VOIEFORCBOT1QgJHtwcmVmaXh9X01BTiBUSEVOYCk7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7cHJlZml4fV9FUlIgOj0gJHtwcmVmaXh9X1NQIC0gJHtwcmVmaXh9X1BWO2ApO1xuICAgICAgbGluZXMucHVzaCgnJyk7XG4gICAgICBsaW5lcy5wdXNoKCcgICgqIFBJRCBjYWxjdWxhdGlvbiBcdTIwMTQgdXNlIE9TQ0FUIEZUX1BJRCBvciB2ZW5kb3IgRkIgKiknKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHtwcmVmaXh9X0NWIDo9ICR7cHJlZml4fV9LUCAqICR7cHJlZml4fV9FUlI7YCk7XG4gICAgICBsaW5lcy5wdXNoKCcnKTtcbiAgICAgIGxpbmVzLnB1c2goJyAgKCogT3V0cHV0IGxpbWl0aW5nICopJyk7XG4gICAgICBsaW5lcy5wdXNoKGAgIElGICR7cHJlZml4fV9DViA+IDEwMC4wIFRIRU5gKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgICAke3ByZWZpeH1fQ1YgOj0gMTAwLjA7YCk7XG4gICAgICBsaW5lcy5wdXNoKGAgIEVMU0lGICR7cHJlZml4fV9DViA8IDAuMCBUSEVOYCk7XG4gICAgICBsaW5lcy5wdXNoKGAgICAgJHtwcmVmaXh9X0NWIDo9IDAuMDtgKTtcbiAgICAgIGxpbmVzLnB1c2goJyAgRU5EX0lGOycpO1xuICAgICAgbGluZXMucHVzaCgnRU5EX0lGOycpO1xuICAgIH1cblxuICAgIGxpbmVzLnB1c2goJycpO1xuICB9XG5cbiAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUludGVybG9ja0NvZGUoaW50ZXJsb2NrczogUElESW50ZXJsb2NrW10pOiBzdHJpbmcge1xuICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXG4gICAgJygqIFNhZmV0eSBJbnRlcmxvY2sgTG9naWMgKiknLFxuICAgICcoKiBBdXRvLWdlbmVyYXRlZCBmcm9tIFAmSUQgYW5hbHlzaXMgKiknLFxuICAgICcoKiBXQVJOSU5HOiBSZXZpZXcgYW5kIHZhbGlkYXRlIGJlZm9yZSBkZXBsb3ltZW50ICopJyxcbiAgICAnJyxcbiAgXTtcblxuICBmb3IgKGNvbnN0IGludGVybG9jayBvZiBpbnRlcmxvY2tzKSB7XG4gICAgY29uc3QgdGFnID0gaW50ZXJsb2NrLmlkLnJlcGxhY2UoL1teYS16QS1aMC05X10vZywgJ18nKTtcblxuICAgIGxpbmVzLnB1c2goYCgqIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMCAke2ludGVybG9jay5uYW1lfSBbJHtpbnRlcmxvY2sucHJpb3JpdHl9XSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgKilgKTtcbiAgICBsaW5lcy5wdXNoKGAoKiBUcmlnZ2VyOiAke2ludGVybG9jay50cmlnZ2VyQ29uZGl0aW9ufSAqKWApO1xuICAgIGxpbmVzLnB1c2goJycpO1xuXG4gICAgLy8gR2VuZXJhdGUgY29uZGl0aW9uIGV2YWx1YXRpb25cbiAgICBjb25zdCBjb25kUGFydHMgPSBpbnRlcmxvY2suaW5zdHJ1bWVudHMubWFwKChpbnN0KSA9PiB7XG4gICAgICBjb25zdCBpc0hpZ2hBbGFybSA9IGluc3Quc3Vic2VxdWVudExldHRlcnMuaW5jbHVkZXMoJ0gnKTtcbiAgICAgIGNvbnN0IGlzTG93QWxhcm0gPSBpbnN0LnN1YnNlcXVlbnRMZXR0ZXJzLmluY2x1ZGVzKCdMJyk7XG5cbiAgICAgIGlmIChpc0hpZ2hBbGFybSkge1xuICAgICAgICByZXR1cm4gYCR7aW5zdC50YWdOdW1iZXJ9X1BWID49ICR7aW5zdC50YWdOdW1iZXJ9X0hIYDtcbiAgICAgIH1cblxuICAgICAgaWYgKGlzTG93QWxhcm0pIHtcbiAgICAgICAgcmV0dXJuIGAke2luc3QudGFnTnVtYmVyfV9QViA8PSAke2luc3QudGFnTnVtYmVyfV9MTGA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBgJHtpbnN0LnRhZ051bWJlcn1gO1xuICAgIH0pO1xuXG4gICAgY29uc3QgY29uZGl0aW9uID0gY29uZFBhcnRzLmxlbmd0aCA+IDAgPyBjb25kUGFydHMuam9pbignIE9SICcpIDogJ0ZBTFNFJztcblxuICAgIGxpbmVzLnB1c2goYCgqIENvbmRpdGlvbiBldmFsdWF0aW9uICopYCk7XG4gICAgbGluZXMucHVzaChgJHt0YWd9X0FDVElWRSA6PSAke2NvbmRpdGlvbn07YCk7XG4gICAgbGluZXMucHVzaCgnJyk7XG5cbiAgICAvLyBMYXRjaCBsb2dpYyAoc2FmZXR5IGludGVybG9ja3MgbGF0Y2ggXHUyMDE0IHJlcXVpcmUgbWFudWFsIHJlc2V0KVxuICAgIGlmIChpbnRlcmxvY2sucHJpb3JpdHkgPT09ICdzYWZldHknKSB7XG4gICAgICBsaW5lcy5wdXNoKCcoKiBTYWZldHkgbGF0Y2ggXHUyMDE0IHJlcXVpcmVzIG1hbnVhbCByZXNldCAqKScpO1xuICAgICAgbGluZXMucHVzaChgSUYgJHt0YWd9X0FDVElWRSBUSEVOYCk7XG4gICAgICBsaW5lcy5wdXNoKGAgICR7dGFnfV9MQVRDSEVEIDo9IFRSVUU7YCk7XG4gICAgICBsaW5lcy5wdXNoKCdFTkRfSUY7Jyk7XG4gICAgICBsaW5lcy5wdXNoKGBJRiAke3RhZ31fUkVTRVQgQU5EIE5PVCAke3RhZ31fQUNUSVZFIFRIRU5gKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHt0YWd9X0xBVENIRUQgOj0gRkFMU0U7YCk7XG4gICAgICBsaW5lcy5wdXNoKCdFTkRfSUY7Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpbmVzLnB1c2goJygqIFByb2Nlc3MgaW50ZXJsb2NrIFx1MjAxNCBhdXRvLXJlc2V0IHdoZW4gY29uZGl0aW9uIGNsZWFycyAqKScpO1xuICAgICAgbGluZXMucHVzaChgJHt0YWd9X0xBVENIRUQgOj0gJHt0YWd9X0FDVElWRTtgKTtcbiAgICB9XG5cbiAgICBsaW5lcy5wdXNoKCcnKTtcblxuICAgIC8vIEFjdGlvbnNcbiAgICBsaW5lcy5wdXNoKCcoKiBBY3Rpb25zICopJyk7XG4gICAgbGluZXMucHVzaChgSUYgJHt0YWd9X0xBVENIRUQgVEhFTmApO1xuXG4gICAgZm9yIChjb25zdCBhY3Rpb24gb2YgaW50ZXJsb2NrLmFjdGlvbnMpIHtcbiAgICAgIGNvbnN0IGFjdGlvblRhZyA9IGFjdGlvbi5yZXBsYWNlKC9cXHMrL2csICdfJykudG9VcHBlckNhc2UoKTtcbiAgICAgIGxpbmVzLnB1c2goYCAgJHthY3Rpb25UYWd9IDo9IFRSVUU7YCk7XG4gICAgfVxuXG4gICAgbGluZXMucHVzaCgnRU5EX0lGOycpO1xuICAgIGxpbmVzLnB1c2goJycpO1xuICB9XG5cbiAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUFuYWx5c2lzUmVwb3J0KHBhcnNlUmVzdWx0OiBQSURQYXJzZVJlc3VsdCwgY29kZVJlc3VsdDogUElEQ29kZUdlblJlc3VsdCk6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtcbiAgICAnIyBQJklEIEFuYWx5c2lzIFJlcG9ydCcsXG4gICAgJycsXG4gICAgYCoqQ29uZmlkZW5jZToqKiAkeyhwYXJzZVJlc3VsdC5jb25maWRlbmNlICogMTAwKS50b0ZpeGVkKDApfSVgLFxuICAgIGAqKkdlbmVyYXRlZDoqKiAke25ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdfWAsXG4gICAgJycsXG4gIF07XG5cbiAgaWYgKHBhcnNlUmVzdWx0LnJhd0Rlc2NyaXB0aW9uKSB7XG4gICAgbGluZXMucHVzaCgnIyMgUCZJRCBEZXNjcmlwdGlvbicpO1xuICAgIGxpbmVzLnB1c2gocGFyc2VSZXN1bHQucmF3RGVzY3JpcHRpb24pO1xuICAgIGxpbmVzLnB1c2goJycpO1xuICB9XG5cbiAgLy8gSW5zdHJ1bWVudHNcbiAgY29uc3QgaW5zdHJ1bWVudHMgPSBwYXJzZVJlc3VsdC5lbGVtZW50cy5maWx0ZXIoKGUpID0+IGUudHlwZSA9PT0gJ2luc3RydW1lbnQnKSBhcyBQSURJbnN0cnVtZW50W107XG5cbiAgaWYgKGluc3RydW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICBsaW5lcy5wdXNoKCcjIyBJbnN0cnVtZW50cycpO1xuICAgIGxpbmVzLnB1c2goJ3wgVGFnIHwgVmFyaWFibGUgfCBGdW5jdGlvbiB8IExvY2F0aW9uIHwnKTtcbiAgICBsaW5lcy5wdXNoKCd8LS0tLS18LS0tLS0tLS0tLXwtLS0tLS0tLS0tfC0tLS0tLS0tLS18Jyk7XG5cbiAgICBmb3IgKGNvbnN0IGluc3Qgb2YgaW5zdHJ1bWVudHMpIHtcbiAgICAgIGxpbmVzLnB1c2goXG4gICAgICAgIGB8ICR7aW5zdC50YWdOdW1iZXJ9IHwgJHtpbnN0Lm1lYXN1cmVkVmFyaWFibGV9IHwgJHtpbnN0LnN1YnNlcXVlbnRMZXR0ZXJzLmpvaW4oJycpfSB8ICR7aW5zdC5sb2NhdGlvbn0gfGAsXG4gICAgICApO1xuICAgIH1cblxuICAgIGxpbmVzLnB1c2goJycpO1xuICB9XG5cbiAgLy8gVmFsdmVzXG4gIGNvbnN0IHZhbHZlcyA9IHBhcnNlUmVzdWx0LmVsZW1lbnRzLmZpbHRlcigoZSkgPT4gZS50eXBlID09PSAndmFsdmUnKSBhcyBQSURWYWx2ZVtdO1xuXG4gIGlmICh2YWx2ZXMubGVuZ3RoID4gMCkge1xuICAgIGxpbmVzLnB1c2goJyMjIFZhbHZlcycpO1xuICAgIGxpbmVzLnB1c2goJ3wgVGFnIHwgVHlwZSB8IEFjdHVhdG9yIHwgRmFpbCBQb3NpdGlvbiB8Jyk7XG4gICAgbGluZXMucHVzaCgnfC0tLS0tfC0tLS0tLXwtLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS0tLXwnKTtcblxuICAgIGZvciAoY29uc3QgdmFsdmUgb2YgdmFsdmVzKSB7XG4gICAgICBsaW5lcy5wdXNoKFxuICAgICAgICBgfCAke3ZhbHZlLnRhZ051bWJlcn0gfCAke3ZhbHZlLnZhbHZlVHlwZX0gfCAke3ZhbHZlLmFjdHVhdG9yVHlwZSB8fCAnLSd9IHwgJHt2YWx2ZS5mYWlsUG9zaXRpb24gfHwgJy0nfSB8YCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgbGluZXMucHVzaCgnJyk7XG4gIH1cblxuICAvLyBDb250cm9sIExvb3BzXG4gIGlmIChwYXJzZVJlc3VsdC5jb250cm9sTG9vcHMubGVuZ3RoID4gMCkge1xuICAgIGxpbmVzLnB1c2goJyMjIENvbnRyb2wgTG9vcHMnKTtcblxuICAgIGZvciAoY29uc3QgbG9vcCBvZiBwYXJzZVJlc3VsdC5jb250cm9sTG9vcHMpIHtcbiAgICAgIGxpbmVzLnB1c2goYC0gKipMb29wICR7bG9vcC5sb29wTnVtYmVyfSoqICgke2xvb3AuY29udHJvbFR5cGV9KTogJHtsb29wLmRlc2NyaXB0aW9ufWApO1xuICAgICAgbGluZXMucHVzaChgICAtIFNlbnNvcjogJHtsb29wLnNlbnNvci50YWdOdW1iZXJ9IFx1MjE5MiBDb250cm9sbGVyIFx1MjE5MiAkeyhsb29wLmZpbmFsRWxlbWVudCBhcyBhbnkpLnRhZ051bWJlcn1gKTtcblxuICAgICAgaWYgKGxvb3Auc2V0cG9pbnQgIT0gbnVsbCkge1xuICAgICAgICBsaW5lcy5wdXNoKGAgIC0gU2V0cG9pbnQ6ICR7bG9vcC5zZXRwb2ludH1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsaW5lcy5wdXNoKCcnKTtcbiAgfVxuXG4gIC8vIEludGVybG9ja3NcbiAgaWYgKHBhcnNlUmVzdWx0LmludGVybG9ja3MubGVuZ3RoID4gMCkge1xuICAgIGxpbmVzLnB1c2goJyMjIFNhZmV0eSBJbnRlcmxvY2tzJyk7XG5cbiAgICBmb3IgKGNvbnN0IGludGVybG9jayBvZiBwYXJzZVJlc3VsdC5pbnRlcmxvY2tzKSB7XG4gICAgICBsaW5lcy5wdXNoKGAtICoqJHtpbnRlcmxvY2submFtZX0qKiBbJHtpbnRlcmxvY2sucHJpb3JpdHl9XWApO1xuICAgICAgbGluZXMucHVzaChgICAtIFRyaWdnZXI6ICR7aW50ZXJsb2NrLnRyaWdnZXJDb25kaXRpb259YCk7XG4gICAgICBsaW5lcy5wdXNoKGAgIC0gQWN0aW9uczogJHtpbnRlcmxvY2suYWN0aW9ucy5qb2luKCcsICcpfWApO1xuICAgIH1cblxuICAgIGxpbmVzLnB1c2goJycpO1xuICB9XG5cbiAgLy8gSS9PIFN1bW1hcnlcbiAgbGluZXMucHVzaCgnIyMgSS9PIFN1bW1hcnknKTtcbiAgbGluZXMucHVzaChgLSBEaWdpdGFsIElucHV0czogJHtjb2RlUmVzdWx0LmlvQ291bnQuZGlnaXRhbElucHV0c31gKTtcbiAgbGluZXMucHVzaChgLSBEaWdpdGFsIE91dHB1dHM6ICR7Y29kZVJlc3VsdC5pb0NvdW50LmRpZ2l0YWxPdXRwdXRzfWApO1xuICBsaW5lcy5wdXNoKGAtIEFuYWxvZyBJbnB1dHM6ICR7Y29kZVJlc3VsdC5pb0NvdW50LmFuYWxvZ0lucHV0c31gKTtcbiAgbGluZXMucHVzaChgLSBBbmFsb2cgT3V0cHV0czogJHtjb2RlUmVzdWx0LmlvQ291bnQuYW5hbG9nT3V0cHV0c31gKTtcbiAgbGluZXMucHVzaChgLSAqKlRvdGFsIEkvTyBwb2ludHM6KiogJHtPYmplY3QudmFsdWVzKGNvZGVSZXN1bHQuaW9Db3VudCkucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCl9YCk7XG5cbiAgLy8gV2FybmluZ3NcbiAgaWYgKHBhcnNlUmVzdWx0Lndhcm5pbmdzLmxlbmd0aCA+IDApIHtcbiAgICBsaW5lcy5wdXNoKCcnKTtcbiAgICBsaW5lcy5wdXNoKCcjIyBXYXJuaW5ncycpO1xuXG4gICAgZm9yIChjb25zdCB3IG9mIHBhcnNlUmVzdWx0Lndhcm5pbmdzKSB7XG4gICAgICBsaW5lcy5wdXNoKGAtIFx1MjZBMFx1RkUwRiAke3d9YCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgSGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gYnVpbGRTdW1tYXJ5KHBhcnNlUmVzdWx0OiBQSURQYXJzZVJlc3VsdCwgY29kZVJlc3VsdDogUElEQ29kZUdlblJlc3VsdCk6IFBpcGVsaW5lU3VtbWFyeSB7XG4gIHJldHVybiB7XG4gICAgaW5zdHJ1bWVudENvdW50OiBwYXJzZVJlc3VsdC5lbGVtZW50cy5maWx0ZXIoKGUpID0+IGUudHlwZSA9PT0gJ2luc3RydW1lbnQnKS5sZW5ndGgsXG4gICAgdmFsdmVDb3VudDogcGFyc2VSZXN1bHQuZWxlbWVudHMuZmlsdGVyKChlKSA9PiBlLnR5cGUgPT09ICd2YWx2ZScpLmxlbmd0aCxcbiAgICBwdW1wQ291bnQ6IHBhcnNlUmVzdWx0LmVsZW1lbnRzLmZpbHRlcigoZSkgPT4gZS50eXBlID09PSAncHVtcCcpLmxlbmd0aCxcbiAgICBjb250cm9sTG9vcENvdW50OiBwYXJzZVJlc3VsdC5jb250cm9sTG9vcHMubGVuZ3RoLFxuICAgIGludGVybG9ja0NvdW50OiBwYXJzZVJlc3VsdC5pbnRlcmxvY2tzLmxlbmd0aCxcbiAgICBpb0NvdW50OiBjb2RlUmVzdWx0LmlvQ291bnQsXG4gICAgY29uZmlkZW5jZTogcGFyc2VSZXN1bHQuY29uZmlkZW5jZSxcbiAgICB3YXJuaW5nczogcGFyc2VSZXN1bHQud2FybmluZ3MsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGVtcHR5U3VtbWFyeSgpOiBQaXBlbGluZVN1bW1hcnkge1xuICByZXR1cm4ge1xuICAgIGluc3RydW1lbnRDb3VudDogMCxcbiAgICB2YWx2ZUNvdW50OiAwLFxuICAgIHB1bXBDb3VudDogMCxcbiAgICBjb250cm9sTG9vcENvdW50OiAwLFxuICAgIGludGVybG9ja0NvdW50OiAwLFxuICAgIGlvQ291bnQ6IHsgZGlnaXRhbElucHV0czogMCwgZGlnaXRhbE91dHB1dHM6IDAsIGFuYWxvZ0lucHV0czogMCwgYW5hbG9nT3V0cHV0czogMCB9LFxuICAgIGNvbmZpZGVuY2U6IDAsXG4gICAgd2FybmluZ3M6IFtdLFxuICB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBV0EsU0FBUyxlQUFlLHFCQUFxQiwyQkFBMkI7QUFrRXhFLGVBQXNCLG1CQUNwQixPQUNBLFlBQzRCO0FBRTVCLE1BQUk7QUFFSixNQUFJLE1BQU0sZUFBZSxNQUFNLFVBQVU7QUFDdkMsa0JBQWMsTUFBTSxjQUFjLE1BQU0sYUFBYSxNQUFNLFVBQVUsVUFBVTtBQUFBLEVBQ2pGLFdBQVcsTUFBTSxpQkFBaUI7QUFDaEMsa0JBQWMsTUFBTSxvQkFBb0IsTUFBTSxpQkFBaUIsVUFBVTtBQUFBLEVBQzNFLE9BQU87QUFDTCxXQUFPO0FBQUEsTUFDTCxTQUFTO0FBQUEsTUFDVCxhQUFhO0FBQUEsUUFDWCxVQUFVLENBQUM7QUFBQSxRQUNYLGNBQWMsQ0FBQztBQUFBLFFBQ2YsWUFBWSxDQUFDO0FBQUEsUUFDYixPQUFPLENBQUM7QUFBQSxRQUNSLFlBQVk7QUFBQSxRQUNaLFVBQVUsQ0FBQyxtQkFBbUI7QUFBQSxNQUNoQztBQUFBLE1BQ0EsWUFBWTtBQUFBLE1BQ1osT0FBTyxDQUFDO0FBQUEsTUFDUixTQUFTLGFBQWE7QUFBQSxNQUN0QixPQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFFQSxNQUFJLFlBQVksZUFBZSxLQUFLLFlBQVksU0FBUyxXQUFXLEdBQUc7QUFDckUsV0FBTztBQUFBLE1BQ0wsU0FBUztBQUFBLE1BQ1Q7QUFB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
