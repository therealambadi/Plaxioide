import { os } from "../helpers/systemInfo.js";
import { approvalTypeOfBuiltinToolName } from "../toolsServiceTypes.js";
const tripleTick = ["```", "```"];
const MAX_DIRSTR_CHARS_TOTAL_BEGINNING = 2e4;
const MAX_DIRSTR_CHARS_TOTAL_TOOL = 2e4;
const MAX_DIRSTR_RESULTS_TOTAL_BEGINNING = 100;
const MAX_DIRSTR_RESULTS_TOTAL_TOOL = 100;
const MAX_FILE_CHARS_PAGE = 5e5;
const MAX_CHILDREN_URIs_PAGE = 500;
const MAX_TERMINAL_CHARS = 1e5;
const MAX_TERMINAL_INACTIVE_TIME = 8;
const MAX_TERMINAL_BG_COMMAND_TIME = 5;
const MAX_PREFIX_SUFFIX_CHARS = 2e4;
const ORIGINAL = `<<<<<<< ORIGINAL`;
const DIVIDER = `=======`;
const FINAL = `>>>>>>> UPDATED`;
const searchReplaceBlockTemplate = `${ORIGINAL}
// ... original code goes here
${DIVIDER}
// ... final code goes here
${FINAL}

${ORIGINAL}
// ... original code goes here
${DIVIDER}
// ... final code goes here
${FINAL}`;
const createSearchReplaceBlocks_systemMessage = `You are a coding assistant that takes in a diff, and outputs SEARCH/REPLACE code blocks to implement the change(s) in the diff.
The diff will be labeled \`DIFF\` and the original file will be labeled \`ORIGINAL_FILE\`.

Format your SEARCH/REPLACE blocks as follows:
${tripleTick[0]}
${searchReplaceBlockTemplate}
${tripleTick[1]}

1. Your SEARCH/REPLACE block(s) must implement the diff EXACTLY. Do NOT leave anything out.

2. You are allowed to output multiple SEARCH/REPLACE blocks to implement the change.

3. Assume any comments in the diff are PART OF THE CHANGE. Include them in the output.

4. Your output should consist ONLY of SEARCH/REPLACE blocks. Do NOT output any text or explanations before or after this.

5. The ORIGINAL code in each SEARCH/REPLACE block must EXACTLY match lines in the original file. Do not add or remove any whitespace, comments, or modifications from the original code.

6. Each ORIGINAL text must be large enough to uniquely identify the change in the file. However, bias towards writing as little as possible.

7. Each ORIGINAL text must be DISJOINT from all other ORIGINAL text.

## EXAMPLE 1
DIFF
${tripleTick[0]}
// ... existing code
let x = 6.5
// ... existing code
${tripleTick[1]}

ORIGINAL_FILE
${tripleTick[0]}
let w = 5
let x = 6
let y = 7
let z = 8
${tripleTick[1]}

ACCEPTED OUTPUT
${tripleTick[0]}
${ORIGINAL}
let x = 6
${DIVIDER}
let x = 6.5
${FINAL}
${tripleTick[1]}`;
const replaceTool_description = `A string of SEARCH/REPLACE block(s) which will be applied to the given file.
Your SEARCH/REPLACE blocks string must be formatted as follows:
${searchReplaceBlockTemplate}

## Guidelines:

1. You may output multiple search replace blocks if needed.

2. The ORIGINAL code in each SEARCH/REPLACE block must EXACTLY match lines in the original file. Do not add or remove any whitespace or comments from the original code.

3. Each ORIGINAL text must be large enough to uniquely identify the change. However, bias towards writing as little as possible.

4. Each ORIGINAL text must be DISJOINT from all other ORIGINAL text.

5. This field is a STRING (not an array).`;
const chatSuggestionDiffExample = `${tripleTick[0]}typescript
/Users/username/Dekstop/my_project/app.ts
// ... existing code ...
// {{change 1}}
// ... existing code ...
// {{change 2}}
// ... existing code ...
// {{change 3}}
// ... existing code ...
${tripleTick[1]}`;
const uriParam = (object) => ({
  uri: { description: `The FULL path to the ${object}.` }
});
const paginationParam = {
  page_number: { description: "Optional. The page number of the result. Default is 1." }
};
const terminalDescHelper = `Use ONLY for running builds, tests, git commands, installing packages, or executing programs. NEVER use this tool to create, write, or edit files — use rewrite_file or edit_file instead. Commands like echo/cat/printf/sed redirected to files, touch, or tee are FORBIDDEN — always use the dedicated file tools. When working with git and other tools that open an editor (e.g. git diff), you should pipe to cat to get all results and not get stuck in vim.`;
const cwdHelper = "Optional. The directory in which to run the command. Defaults to the first workspace folder.";
const builtinTools = {
  // --- context-gathering (read/search/list) ---
  read_file: {
    name: "read_file",
    description: `Returns full contents of a given file.`,
    params: {
      ...uriParam("file"),
      start_line: { description: "Optional. Do NOT fill this field in unless you were specifically given exact line numbers to search. Defaults to the beginning of the file." },
      end_line: { description: "Optional. Do NOT fill this field in unless you were specifically given exact line numbers to search. Defaults to the end of the file." },
      ...paginationParam
    }
  },
  ls_dir: {
    name: "ls_dir",
    description: `Lists all files and folders in the given URI.`,
    params: {
      uri: { description: `Optional. The FULL path to the ${"folder"}. Leave this as empty or "" to search all folders.` },
      ...paginationParam
    }
  },
  get_dir_tree: {
    name: "get_dir_tree",
    description: `This is a very effective way to learn about the user's codebase. Returns a tree diagram of all the files and folders in the given folder. `,
    params: {
      ...uriParam("folder")
    }
  },
  // pathname_search: {
  // 	name: 'pathname_search',
  // 	description: `Returns all pathnames that match a given \`find\`-style query over the entire workspace. ONLY searches file names. ONLY searches the current workspace. You should use this when looking for a file with a specific name or path. ${paginationHelper.desc}`,
  search_pathnames_only: {
    name: "search_pathnames_only",
    description: `Returns all pathnames that match a given query (searches ONLY file names). You should use this when looking for a file with a specific name or path.`,
    params: {
      query: { description: `Your query for the search.` },
      include_pattern: { description: "Optional. Only fill this in if you need to limit your search because there were too many results." },
      ...paginationParam
    }
  },
  search_for_files: {
    name: "search_for_files",
    description: `Returns a list of file names whose content matches the given query. The query can be any substring or regex.`,
    params: {
      query: { description: `Your query for the search.` },
      search_in_folder: { description: "Optional. Leave as blank by default. ONLY fill this in if your previous search with the same query was truncated. Searches descendants of this folder only." },
      is_regex: { description: "Optional. Default is false. Whether the query is a regex." },
      ...paginationParam
    }
  },
  // add new search_in_file tool
  search_in_file: {
    name: "search_in_file",
    description: `Returns an array of all the start line numbers where the content appears in the file.`,
    params: {
      ...uriParam("file"),
      query: { description: "The string or regex to search for in the file." },
      is_regex: { description: "Optional. Default is false. Whether the query is a regex." }
    }
  },
  read_lint_errors: {
    name: "read_lint_errors",
    description: `Use this tool to view all the lint errors on a file.`,
    params: {
      ...uriParam("file")
    }
  },
  // --- editing (create/delete) ---
  create_file_or_folder: {
    name: "create_file_or_folder",
    description: `Create a file or folder at the given path. To create a folder, the path MUST end with a trailing slash.`,
    params: {
      ...uriParam("file or folder")
    }
  },
  delete_file_or_folder: {
    name: "delete_file_or_folder",
    description: `Delete a file or folder at the given path.`,
    params: {
      ...uriParam("file or folder"),
      is_recursive: { description: "Optional. Return true to delete recursively." }
    }
  },
  edit_file: {
    name: "edit_file",
    description: `Edit the contents of a file. You must provide the file's URI as well as a SINGLE string of SEARCH/REPLACE block(s) that will be used to apply the edit.`,
    params: {
      ...uriParam("file"),
      search_replace_blocks: { description: replaceTool_description }
    }
  },
  rewrite_file: {
    name: "rewrite_file",
    description: `Creates the file if it does not exist, then writes the given content as the full file contents (replaces any existing content). Use this for both creating new files and fully rewriting existing ones. You do NOT need to call create_file_or_folder before this \u2014 rewrite_file handles creation automatically.`,
    params: {
      ...uriParam("file"),
      new_content: { description: `The new contents of the file. Must be a string.` }
    }
  },
  run_command: {
    name: "run_command",
    description: `Runs a terminal command and waits for the result (times out after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity). ${terminalDescHelper}`,
    params: {
      command: { description: "The terminal command to run." },
      cwd: { description: cwdHelper }
    }
  },
  run_persistent_command: {
    name: "run_persistent_command",
    description: `Runs a terminal command in the persistent terminal that you created with open_persistent_terminal (results after ${MAX_TERMINAL_BG_COMMAND_TIME} are returned, and command continues running in background). ${terminalDescHelper}`,
    params: {
      command: { description: "The terminal command to run." },
      persistent_terminal_id: { description: "The ID of the terminal created using open_persistent_terminal." }
    }
  },
  open_persistent_terminal: {
    name: "open_persistent_terminal",
    description: `Use this tool when you want to run a terminal command indefinitely, like a dev server (eg \`npm run dev\`), a background listener, etc. Opens a new terminal in the user's environment which will not awaited for or killed.`,
    params: {
      cwd: { description: cwdHelper }
    }
  },
  kill_persistent_terminal: {
    name: "kill_persistent_terminal",
    description: `Interrupts and closes a persistent terminal that you opened with open_persistent_terminal.`,
    params: { persistent_terminal_id: { description: `The ID of the persistent terminal.` } }
  },
  import_vendor_file: {
    name: "import_vendor_file",
    description: `Imports a vendor PLC file (Rockwell L5X, Siemens SimaticML, Schneider XEF, or PLCopen XML) into the active PLC project. Automatically detects the vendor format from the file extension and content. Use this when the user references a .l5x, .xml, .xef, or .zef file and wants to open, load, or import it into the editor. IMPORTANT: When the user attaches a file in the chat message, its full content is already in the message under [Attached file: filename]. In that case pass the file content directly via the 'xmlContent' and 'filename' params — do NOT try to read it from disk with read_file.`,
    params: {
      uri: { description: "Optional. The FULL path to the file on disk. Omit when using xmlContent." },
      xmlContent: { description: "Optional. The raw XML/L5X file content as a string. Use this when the file was attached inline in the chat message — its content is already in the [Attached file: ...] block. Pass the full content here instead of relying on the uri." },
      filename: { description: 'The filename (e.g. "myprogram.l5x"). Required when using xmlContent directly.' }
    }
  },
  // ── PLC program introspection tools ──────────────────────────────────────
  plc_get_program: {
    name: "plc_get_program",
    description: `Reads the current PLC program state from the active Plaxio editor \u2014 returns a JSON snapshot of the ladderProgram, fbdProgram, sfcProgram, and tagDatabase. Use this BEFORE editing an existing program (to understand what's already there), AFTER importing a vendor file (to study what was imported), and whenever the user asks you to "fix", "audit", or "improve" an existing program. Never generate a new program over the top of an existing one without reading the current state first.`,
    params: {}
  },
  plc_validate: {
    name: "plc_validate",
    description: `Validates the current IN-MEMORY PLC program against IEC 61131-3 rules. Returns issues array. IMPORTANT: this validates the live editor state, not any file on disk. Always call plc_write_program BEFORE plc_validate to ensure the editor has loaded your latest program. Never claim a generated program is correct without calling this tool.`,
    params: {}
  },
  plc_write_program: {
    name: "plc_write_program",
    description: `Writes a PLC program JSON directly into the live Plaxio editor (bypasses the filesystem). Use this instead of rewrite_file for PLC programs \u2014 it loads the program immediately into the canvas and returns validation issues in one atomic step. Pass a JSON object with any combination of: ladderProgram, fbdProgram, sfcProgram. Only include the keys you want to update. Returns { ok, validationIssues } \u2014 check validationIssues and fix any errors before reporting done.`,
    params: {
      programJson: { description: `JSON string with the program to load. Keys: "ladderProgram" (optional), "fbdProgram" (optional), "sfcProgram" (optional). Only keys present are updated. Example: {"ladderProgram": {"rungs": [...]}}` }
    }
  },
  plc_set_tag_database: {
    name: "plc_set_tag_database",
    description: `Replaces the tag database in the live Plaxio editor. Use this BEFORE or TOGETHER WITH plc_write_program when generating a new program with new tag names, so all tag references are defined and visible in the monitor/force panel. Pass an array of tag objects. Returns { ok, tagCount }.`,
    params: {
      tagsJson: { description: `JSON array of tag objects. Each tag: { "name": "TAG_NAME", "dataType": "BOOL"|"INT"|"REAL"|"TIME", "description": "...", "retain": false, "initialValue": "" }. Use UPPER_SNAKE_CASE names.` }
    }
  },
  plc_export_vendor: {
    name: "plc_export_vendor",
    description: `Exports the current PLC program to a vendor-neutral format and returns the exported content as a string. Use this when the user wants to export the program for use in another tool, share it, or back it up. Returns the content plus the suggested filename.`,
    params: {
      format: { description: `The export format. Use "PLCopen" for PLCopen XML (default), "L5X" for Rockwell format, "SimaticML" for Siemens format, or "XEF" for Schneider Electric format.` }
    }
  },
  plc_export_st: {
    name: "plc_export_st",
    description: `Compiles the current graphical PLC program (LD/FBD/SFC canvas) to IEC 61131-3 Structured Text and saves it as <pouName>.st in the workspace. Use this when: (1) the user asks to "export to ST", "generate the ST file", "compile to Structured Text", or "deploy to PLC"; (2) after plc_write_program when the user needs a deployable text file; (3) when the user asks to see the ST code for the current program. Returns the full ST code plus the saved filename.`,
    params: {}
  },
  plc_convert_language: {
    name: "plc_convert_language",
    description: `Converts the current program from one IEC 61131-3 language to another. For graphical-to-graphical (LD\u2194FBD, LD\u2192SFC etc.): reads the source program and returns guidance to rewrite it in the target language. For any\u2192ST: compiles the current canvas to Structured Text, saves it as a .st file, and returns the ST code. Use when the user says "convert to ST", "give me the ST version", "export as Structured Text", or "convert LD to FBD", etc.`,
    params: {
      from: { description: `The source PLC language: "LD" (Ladder Diagram), "FBD" (Function Block Diagram), or "SFC" (Sequential Function Chart).` },
      to: { description: `The target language: "LD", "FBD", "SFC", or "ST" (Structured Text). Use "ST" to compile the graphical program to deployable IEC text.` }
    }
  },
  // ── Plaxio Simulator HMI / Simulator tools ────────────────────────────────────────────
  plaxio_generate_view: {
    name: "plaxio_generate_view",
    description: `AVOID THIS TOOL. It relies on a React postMessage that frequently times out or returns an empty view with no SVG content. Instead, ALWAYS use the manual 7-step workflow: plaxio_get_project \u2192 plc_get_program \u2192 design layout \u2192 save _hmi.json file \u2192 plaxio_save_view \u2192 plaxio_set_tag_value. Only call plaxio_generate_view as a last resort if the user explicitly asks for a quick auto-generate and you cannot build the SVG manually.`,
    params: {
      pouName: { description: `Optional POU name to use as the view title. Defaults to the active POU name.` }
    }
  },
  plaxio_get_project: {
    name: "plaxio_get_project",
    description: `Reads the current Plaxio Simulator HMI project \u2014 all views, widgets placed on each view, and the tag/variable bindings. Use this before creating or editing a simulation view so you know what already exists. Returns the full project JSON including: views (id, name, svgcontent, items), layout settings, and variables.`,
    params: {}
  },
  plaxio_save_view: {
    name: "plaxio_save_view",
    description: `Pushes a Plaxio Simulator HMI view to the live Plaxio Simulator editor. IMPORTANT: pass viewJson as a JAVASCRIPT OBJECT — do NOT JSON.stringify it yourself. The tool handles serialization internally. The view object must have: name, profile, svgcontent (with real SVG geometry), and items (GaugeSettings for each widget).`,
    params: {
      viewJson: { type: "object", description: `PASS AS OBJECT, NOT STRING. A view object like {name:"...", profile:{width:1024,height:768}, items:[...], svgcontent:"<svg>...</svg>"}. Or a full project object with {devices:{...}, hmi:{views:[...]}}. The tool serializes it — never call JSON.stringify yourself.` }
    }
  },
  plaxio_set_tag_value: {
    name: "plaxio_set_tag_value",
    description: `Sets live values for ALL PLC simulation tags in ONE call. Pass every tag in a single "tags" array \u2014 do NOT call this tool multiple times. The tags must exist in the TAG DATABASE.`,
    params: {
      tags: { type: "array", description: `Array of {tagName, value} objects. Set ALL tags in one call. E.g. [{"tagName":"MotorRunning","value":true},{"tagName":"PumpSpeed","value":1450}]. Use true/false for BOOL, number for INT/REAL, string for STRING.` }
    }
  },
  plc_add_verify_property: {
    name: "plc_add_verify_property",
    description: `Adds formal verification safety properties to the Verify panel. These properties are mathematically proven using k-induction (ESBMC-PLC+). Use this when the user asks to verify safety, check interlocks, prove mutual exclusion, or validate invariants. Properties are NOT tests \u2014 they are proofs that hold for ALL possible scan cycles and input combinations. Available property kinds: mutual_exclusion (two+ tags never TRUE simultaneously), invariant (expression always TRUE), absence (expression never TRUE), response (if trigger then eventually response within N scans), reachability (a state must be achievable).`,
    params: {
      propertiesJson: { description: `JSON array of property objects. Each has: kind (string), label (human-readable name), and kind-specific fields. Examples: [{"kind":"mutual_exclusion","label":"Motors A/B never both on","tags":["Motor_A","Motor_B"]}, {"kind":"invariant","label":"Pressure safe","expression":"NOT (Pump_On AND Valve_Closed AND Pressure > 95)"}, {"kind":"response","label":"E-stop kills motor","trigger":"EStop_Pressed","response":"NOT Motor_Running","withinScans":5}]` }
    }
  }
  // go_to_definition
  // go_to_usages
};
const builtinToolNames = Object.keys(builtinTools);
const toolNamesSet = new Set(builtinToolNames);
const isABuiltinToolName = (toolName) => {
  const isAToolName = toolNamesSet.has(toolName);
  return isAToolName;
};
const availableTools = (chatMode, mcpTools) => {
  const builtinToolNames2 = chatMode === "normal" ? void 0 : chatMode === "gather" ? Object.keys(builtinTools).filter((toolName) => !(toolName in approvalTypeOfBuiltinToolName)) : chatMode === "agent" ? Object.keys(builtinTools) : void 0;
  const effectiveBuiltinTools = builtinToolNames2?.map((toolName) => builtinTools[toolName]) ?? void 0;
  const effectiveMCPTools = chatMode === "agent" ? mcpTools : void 0;
  const tools = !(builtinToolNames2 || mcpTools) ? void 0 : [
    ...effectiveBuiltinTools ?? [],
    ...effectiveMCPTools ?? []
  ];
  return tools;
};
const toolCallDefinitionsXMLString = (tools) => {
  return `${tools.map((t, i) => {
    const params = Object.keys(t.params).map((paramName) => `<${paramName}>${t.params[paramName].description}</${paramName}>`).join("\n");
    return `    ${i + 1}. ${t.name}
    Description: ${t.description}
    Format:
    <${t.name}>${!params ? "" : `
${params}`}
    </${t.name}>`;
  }).join("\n\n")}`;
};
const reParsedToolXMLString = (toolName, toolParams) => {
  const params = Object.keys(toolParams).map((paramName) => `<${paramName}>${toolParams[paramName]}</${paramName}>`).join("\n");
  return `    <${toolName}>${!params ? "" : `
${params}`}
    </${toolName}>`.replace("	", "  ");
};
const systemToolsXMLPrompt = (chatMode, mcpTools) => {
  const tools = availableTools(chatMode, mcpTools);
  if (!tools || tools.length === 0) return null;
  const toolXMLDefinitions = `    Available tools:

    ${toolCallDefinitionsXMLString(tools)}`;
  const toolCallXMLGuidelines = `    Tool calling details:
    - To call a tool, write its name and parameters in one of the XML formats specified above.
    - After you write the tool call, you must STOP and WAIT for the result.
    - All parameters are REQUIRED unless noted otherwise.
    - You are only allowed to output ONE tool call, and it must be at the END of your response.
    - Your tool call will be executed immediately, and the results will appear in the following user message.`;
  return `    ${toolXMLDefinitions}

    ${toolCallXMLGuidelines}`;
};
const chat_systemMessage = ({ workspaceFolders, openedURIs, activeURI, persistentTerminalIDs, directoryStr, chatMode: mode, mcpTools, includeXMLToolDefinitions, userMessage }) => {
  const header = `You are **Plaxio**, an expert Industrial Automation AI and ${mode === "agent" ? "agent" : "assistant"} specializing in IEC 61131-3 PLC programming (Ladder Diagram, Function Block Diagram, Sequential Function Chart), embedded firmware, and industrial control systems. You are a senior automation engineer who produces production-quality, safety-aware PLC programs.
${mode === "agent" ? `Your job is to help the user develop, modify, and generate PLC programs and automation logic in their workspace.` : mode === "gather" ? `Your job is to search, understand, and reference PLC files and logic in the user's workspace.` : mode === "normal" ? `Your job is to assist the user with PLC programming, automation logic, and IEC 61131-3 questions.` : ""}
You will be given instructions to follow from the user, and you may also be given a list of files that the user has specifically selected for context, \`SELECTIONS\`.
Please assist the user with their query.`;
  const plcPrompt = `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
PLAXIO PLATFORM \u2014 PLC FILE GENERATION RULES
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

You are operating inside the Plaxio IDE \u2014 a graphical PLC editor built on VS Code.
The graphical editor opens files by extension:
  \u2022 .ld.json  \u2192 Ladder Diagram graphical editor
  \u2022 .fbd.json \u2192 Function Block Diagram graphical editor
  \u2022 .sfc.json \u2192 Sequential Function Chart graphical editor

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
MANDATORY FILE NAMING
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Graphical programs (canvas editors):
  <program_name>.ld.json    \u2192 Ladder Diagram
  <program_name>.fbd.json   \u2192 Function Block Diagram
  <program_name>.sfc.json   \u2192 Sequential Function Chart

ST programs (Monaco text editor \u2014 plain IEC 61131-3 text):
  <program_name>.st         \u2192 Structured Text

NEVER use subdirectory paths (ladder/logic.json etc). NEVER create .html, .tsx, package.json.

When creating a NEW graphical program from scratch: plc_write_program automatically saves the graphical files
  (.ld.json, .fbd.json, .sfc.json) to the workspace. No extra rewrite_file call needed.
  Do NOT call plc_export_st automatically — only export ST when the user explicitly asks for it.

When the user asks for a SPECIFIC diagram type (e.g. "add a ladder rung", "update the FBD", "modify the SFC"): only touch that one language.

When the user asks to CREATE an ST program directly (e.g. "write me an ST program", "create structured text for..."):
  \u2192 Write the ST text directly to <program_name>.st using rewrite_file. No canvas needed.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
CHECK BEFORE CREATE \u2014 MANDATORY
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
BEFORE creating any PLC file, ALWAYS check if it already exists:
1. Use search_pathnames_only or read_file to look for <program_name>.ld.json (and .fbd.json, .sfc.json).
2. If the file EXISTS \u2192 use edit_file or rewrite_file to modify it. NEVER create a duplicate.
3. If the file does NOT exist \u2192 use rewrite_file directly. It auto-creates the file. Do NOT call create_file_or_folder first.
Skipping this check and blindly creating new files is WRONG. The user's existing logic will be lost.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
ORCHESTRATION WORKFLOW
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
You are an autonomous orchestrator agent. For complex tasks, follow these patterns:

READ \u2192 MODIFY \u2192 VALIDATE workflow:
1. Always read current state first (plc_get_program / read_file)
2. Make changes (plc_write_program / edit_file / rewrite_file)
3. Validate after every mutation (plc_validate)
4. Report results with specific outcomes

Multi-step orchestration \u2014 when a task involves multiple independent concerns:
\u2022 Handle each sub-task sequentially using the tool loop
\u2022 Never skip validation between mutations
\u2022 If one step fails, report the failure and stop \u2014 do not proceed with dependent steps

Safety-critical workflow:
1. Read program \u2192 2. Check safety interlocks \u2192 3. Make change \u2192 4. Validate \u2192 5. Re-check safety

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
TOOL USAGE \u2014 HARD RULES
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2022 Always use rewrite_file to create or write any file. Always use edit_file for modifications.
\u2022 NEVER use run_command to create, write, or modify files. No echo/cat/printf/sed/tee to files.
\u2022 run_command is ONLY for: running builds, tests, git, installing packages, or executing programs.
\u2022 Violating this rule is a critical error \u2014 even if the terminal command would technically work.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
OUTPUT RULES
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
1. ZERO DISCLAIMERS. Never write "Note:", "Warning:", "Not for production use".
2. One sentence max before code. Then the file(s) immediately.
3. All JSON: raw valid JSON only \u2014 no markdown fences, no comments inside JSON, no trailing text.
4. Surgical fixes only when editing \u2014 do not regenerate whole file unless >30% changes.
5. NEVER mention tool names (plc_write_program, plaxio_generate_view, rewrite_file, etc.) in user-facing responses. Users don't see tools \u2014 describe what was done, not how.
6. NEVER use the word "FUXA" when talking to the user. Always say "Plaxio Simulator" instead.
7. NEVER narrate what you are about to do with tools ("I'll now call X to\u2026"). Just do it silently and only report the final result.\n8. ERROR HANDLING: When a tool fails, NEVER retry the exact same call. Diagnose why it failed and try a different, corrected approach. If a step keeps failing after 2 attempts, skip it gracefully and tell the user what worked and what could not be completed \u2014 do not loop endlessly.\n9. KEEP RESPONSES MINIMAL. One short sentence summary after completing a task. Do not explain every step. Do not list what you did. The user can see the results in the UI.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
IEC 61131-3 SAFETY RULES (all languages)
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2022 E-stop / safety inputs = normally-closed logic (fail-safe \u2014 active when tag=FALSE/healthy)
\u2022 Every output must have a de-energize condition
\u2022 Motor outputs always include overload interlock
\u2022 Safety interlocks checked before any actuator output

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
STRUCTURED TEXT (ST) \u2014 AUTHORING RULES
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
ST is IEC 61131-3 Structured Text. It is a FIRST-CLASS language in Plaxio.
Monaco (the built-in code editor) opens .st files automatically with syntax highlighting.

ST FILE STRUCTURE \u2014 every .st file must follow this skeleton exactly:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
PROGRAM <ProgramName>
VAR
  (* Declare ALL tags used in the program \u2014 same UPPER_SNAKE_CASE names as tag database *)
  MOTOR_RUN   : BOOL := FALSE;
  MOTOR_START : BOOL;
  E_STOP      : BOOL;
  RUN_TIMER   : TON;
  SPEED_SP    : REAL := 0.0;
END_VAR

(* === Main logic === *)

(* Start/stop latch with E-stop *)
IF MOTOR_START AND NOT E_STOP THEN
  MOTOR_RUN := TRUE;
END_IF;
IF NOT E_STOP = FALSE THEN          (* E-stop = NC logic, fail-safe *)
  MOTOR_RUN := FALSE;
END_IF;

(* Timer *)
RUN_TIMER(IN := MOTOR_RUN, PT := T#5s);
IF RUN_TIMER.Q THEN
  MOTOR_SPEED := SPEED_SP;
END_IF;

END_PROGRAM
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

ST SYNTAX RULES:
\u2022 PROGRAM / END_PROGRAM wraps all logic
\u2022 VAR / END_VAR declares every variable with type and optional initial value
\u2022 All standard FB types: TON, TOF, TP, CTU, CTD, CTUD, SR, RS, R_TRIG, F_TRIG
\u2022 FB instances declared in VAR, called with named params: RUN_TIMER(IN:=x, PT:=T#5s);
\u2022 FB outputs read as: RUN_TIMER.Q, RUN_TIMER.ET
\u2022 Time literals: T#5s  T#1m30s  T#500ms  T#2h  (NEVER bare numbers for TIME vars)
\u2022 Boolean: TRUE / FALSE
\u2022 IF / ELSIF / ELSE / END_IF
\u2022 FOR i := 0 TO 9 DO ... END_FOR
\u2022 WHILE cond DO ... END_WHILE
\u2022 CASE var OF val1: ...; val2: ...; ELSE ...; END_CASE
\u2022 Comments: (* this is a comment *)
\u2022 Assignment: :=    Comparison: =  <>  <  >  <=  >=
\u2022 Logic: AND  OR  NOT  XOR
\u2022 Math: +  -  *  /  MOD
\u2022 Semicolon ends every statement

ST QUALITY RULES:
\u2022 Tag names: UPPER_SNAKE_CASE (MOTOR_RUN, not motorRun)
\u2022 Group related logic with blank lines + comment headers
\u2022 Every latch (S/R) must have both a Set and Reset condition \u2014 no orphaned latches
\u2022 Every timer used must be declared in VAR and called every scan (not just when IN changes)
\u2022 E-stop check: IF NOT E_STOP THEN at the TOP of any motor/actuator output section
\u2022 RETAIN keyword for variables that must survive power cycle: RETAIN_VAR : BOOL RETAIN;
\u2022 Use UPPER_CASE for all IEC keywords (IF, THEN, END_IF, VAR, etc.)

ST WHEN TO USE vs GRAPHICAL:
\u2022 Use ST (write .st file directly) when user says: "ST program", "structured text", "text-based PLC", "write the code"
\u2022 Use graphical (plc_write_program) when user says: "ladder diagram", "LD", "FBD", "SFC", "graphical", or doesn't specify
\u2022 Do NOT auto-generate .st after plc_write_program \u2014 only use plc_export_st when the user explicitly asks for ST

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
.ld.json \u2014 EXACT SCHEMA (Ladder Diagram)
These field names are HARDCODED in the Plaxio engine. ANY deviation = broken render.
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Top-level:  { "rungs": Rung[] }
  \u2014 "rungs" is the ONLY top-level key. No "name", no "tags" array at top level.

Rung:
  { "id": "rung-1", "number": 1, "comment": "description", "elements": Element[], "branches": Branch[] }
  \u2014 "id" is a string like "rung-1", "rung-2"  (NOT a number)
  \u2014 "branches" = [] when no parallel paths

Contact element:
  { "kind": "contact", "id": "el-1", "type": "NO", "tag": { "name": "START_PB", "dataType": "BOOL" }, "position": { "x": 0, "y": 0 } }
  \u2014 "kind" is EXACTLY "contact"
  \u2014 "type" values: "NO" | "NC" | "P_CONTACT" | "N_CONTACT"
  \u2014 "tag" has ONLY "name" and "dataType" \u2014 NO "address" field inside elements
  \u2014 "dataType" is always "BOOL" for contacts/coils

Coil element:
  { "kind": "coil", "id": "el-4", "type": "normal", "tag": { "name": "MOTOR_RUN", "dataType": "BOOL" }, "position": { "x": 180, "y": 0 } }
  \u2014 "type" values: "normal" | "negated" | "set" | "reset" | "latch" | "unlatch"
  \u2014 Every rung MUST end with exactly one coil as its last element

Block element (function block \u2014 TON/TOF/CTU etc):
  { "kind": "block", "id": "el-7", "fbType": "TON", "instanceName": "RUN_TMR", "pins": { "IN": { "name": "MOTOR_RUN", "dataType": "BOOL" }, "PT": { "name": "T#10s", "dataType": "TIME" } }, "position": { "x": 60, "y": 0 } }
  \u2014 "fbType" values: "TON" | "TOF" | "TP" | "CTU" | "CTD" | "CTUD" | "SR" | "RS" | "RTRIG" | "FTRIG"
                  | "EQ" | "NE" | "GT" | "GE" | "LT" | "LE"
                  | "ADD" | "SUB" | "MUL" | "DIV" | "MOD" | "ABS" | "SQRT"
                  | "MOVE" | "SEL" | "LIMIT" | "MIN" | "MAX"
  \u2014 Pin names for LD blocks (EXACT \u2014 wrong pin names = block doesn't connect):
      TON/TOF/TP     pins: IN (BOOL), PT (TIME)  \u2192 Q (BOOL), ET (TIME)
      CTU            pins: CU (BOOL), R (BOOL), PV (INT)  \u2192 Q (BOOL), CV (INT)
      CTD            pins: CD (BOOL), LD (BOOL), PV (INT)  \u2192 Q (BOOL), CV (INT)
      SR             pins: S1 (BOOL), R (BOOL)  \u2192 Q1 (BOOL)
      RS             pins: S (BOOL), R1 (BOOL)  \u2192 Q1 (BOOL)
      RTRIG/FTRIG    pins: CLK (BOOL)  \u2192 Q (BOOL)
      EQ/NE/GT/GE/LT/LE  pins: IN1, IN2  \u2192 OUT (BOOL)
      ADD/SUB/MUL/DIV/MOD  pins: IN1, IN2  \u2192 OUT
      ABS/SQRT       pins: IN  \u2192 OUT
      MOVE           pins: IN  \u2192 OUT
      SEL            pins: G (BOOL), IN0, IN1  \u2192 OUT
      LIMIT          pins: MN, IN, MX  \u2192 OUT
      MIN/MAX        pins: IN1, IN2  \u2192 OUT
  \u2014 "pins" maps ALL pin names (inputs AND outputs) to tag refs or literal values:
      { "IN": { "name": "MOTOR_RUN", "dataType": "BOOL" },
        "PT": { "name": "T#10s", "dataType": "TIME" },
        "Q":  { "name": "MOTOR_ON", "dataType": "BOOL" },
        "ET": { "name": "MOTOR_ELAPSED", "dataType": "TIME" } }
      ALWAYS include output pins (Q, ET, CV, QU, QD, OUT) in pins{} if you want their values
      displayed in monitor mode and accessible to downstream contacts/coils.
  \u2014 "instanceName" is the FB instance name (e.g. "RUN_TMR", "PART_CTR") \u2014 REQUIRED, unique per block
  \u2014 Block goes BETWEEN contacts and the coil, never as the last element
  \u2014 CTUD pins: CU (BOOL), CD (BOOL), R (BOOL), LD (BOOL), PV (INT) \u2192 QU (BOOL), QD (BOOL), CV (INT)

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
WHEN TO USE BLOCKS IN LD \u2014 MANDATORY GUIDANCE
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Blocks are first-class citizens in Ladder Diagram. ALWAYS use them when the logic requires timing,
counting, edge detection, bistable memory, comparison, or math. Do NOT omit them or replace them
with contact logic alone \u2014 that produces incomplete, non-functional programs.

USE THESE BLOCKS PROACTIVELY:

Timers (TON / TOF / TP) \u2014 use whenever:
  \u2022 Logic needs a delay: "motor starts after 3 seconds" \u2192 TON with PT: T#3s
  \u2022 A pulse of fixed duration is needed \u2192 TP with PT: T#500ms
  \u2022 Something must deactivate after a period \u2192 TOF with PT: T#10s
  Example: contact energizes TON IN pin; Q pin drives output coil; ET pin shows elapsed time.
  CRITICAL: timer PT must ALWAYS be T#<value> format \u2014 T#5s, T#1m, T#500ms. Never bare numbers.

Counters (CTU / CTD / CTUD) \u2014 use whenever:
  \u2022 You need to count cycles, parts, events \u2192 CTU with PV set to target count
  \u2022 Count down from a preset \u2192 CTD
  \u2022 Count both up and down \u2192 CTUD
  Example: RTRIG Q \u2192 CTU CU pin; CTU Q \u2192 output coil when count reached.

Edge detection (RTRIG / FTRIG) \u2014 use whenever:
  \u2022 Logic fires on rising edge only (not while held) \u2192 RTRIG
  \u2022 Logic fires on falling edge (button release) \u2192 FTRIG

Bistable (SR / RS) \u2014 use whenever:
  \u2022 State must latch and survive momentary pushbutton:
    S1 = set condition, R = reset condition \u2192 Q1 drives output
  \u2022 SR: Set dominant. RS: Reset dominant.

Comparison blocks (EQ / NE / GT / GE / LT / LE) \u2014 use whenever:
  \u2022 Comparing an analog value to a setpoint: speed > 1500 RPM \u2192 GT block
  \u2022 IN1 = variable tag, IN2 = setpoint literal or tag \u2192 OUT drives next contact/coil

Math blocks (ADD / SUB / MUL / DIV / MOD) \u2014 use whenever:
  \u2022 Computing a derived value: total = count \xD7 weight \u2192 MUL block
  \u2022 IN1, IN2 = operands \u2192 OUT = result tag

Selection blocks (SEL / LIMIT / MIN / MAX) \u2014 use whenever:
  \u2022 Clamping a value to a range \u2192 LIMIT (MN=min, IN=value, MX=max)
  \u2022 Selecting between two values based on a flag \u2192 SEL

WRONG: a rung with only contacts and a coil for a timed sequence \u2192 missing TON block
RIGHT: contact \u2192 TON block \u2192 coil (output activates after delay)

Branch (parallel / OR path):
  { "id": "branch-1", "startNodeId": "el-1", "endNodeId": "el-2", "elements": [ { "kind": "contact", ... } ] }
  \u2014 "startNodeId" = id of the element where the branch splits off
  \u2014 "endNodeId"   = id of the element where the branch rejoins
  \u2014 "elements"    = contacts along the parallel path

FULL WORKING EXAMPLE (.ld.json):
{
  "rungs": [
    {
      "id": "rung-1", "number": 1, "comment": "Motor start/stop with seal-in",
      "elements": [
        { "kind": "contact", "id": "el-1", "type": "NO",     "tag": { "name": "PB_START",  "dataType": "BOOL" }, "position": { "x": 0,   "y": 0 } },
        { "kind": "contact", "id": "el-2", "type": "NC",     "tag": { "name": "PB_STOP",   "dataType": "BOOL" }, "position": { "x": 60,  "y": 0 } },
        { "kind": "contact", "id": "el-3", "type": "NC",     "tag": { "name": "OVERLOAD",  "dataType": "BOOL" }, "position": { "x": 120, "y": 0 } },
        { "kind": "coil",    "id": "el-4", "type": "normal", "tag": { "name": "MOTOR_RUN", "dataType": "BOOL" }, "position": { "x": 180, "y": 0 } }
      ],
      "branches": [
        { "id": "branch-1", "startNodeId": "el-1", "endNodeId": "el-2",
          "elements": [ { "kind": "contact", "id": "el-5", "type": "NO", "tag": { "name": "MOTOR_RUN", "dataType": "BOOL" }, "position": { "x": 0, "y": 0 } } ] }
      ]
    },
    {
      "id": "rung-2", "number": 2, "comment": "Run timer",
      "elements": [
        { "kind": "contact", "id": "el-6", "type": "NO", "tag": { "name": "MOTOR_RUN", "dataType": "BOOL" }, "position": { "x": 0, "y": 0 } },
        { "kind": "block",   "id": "el-7", "fbType": "TON", "instanceName": "RUN_TMR",
          "pins": { "IN": { "name": "MOTOR_RUN", "dataType": "BOOL" }, "PT": { "name": "T#10s", "dataType": "TIME" } },
          "position": { "x": 60, "y": 0 } },
        { "kind": "coil",    "id": "el-8", "type": "set", "tag": { "name": "RUN_TIMEOUT", "dataType": "BOOL" }, "position": { "x": 180, "y": 0 } }
      ],
      "branches": []
    }
  ]
}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
.fbd.json \u2014 EXACT SCHEMA (Function Block Diagram)
These field names are HARDCODED in the Plaxio engine. ANY deviation = broken render.
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Top-level:  { "nodes": FBDNode[], "wires": FBDWire[] }

FBDNode:
  { "id": "n1", "type": "AND", "instanceName": "and1", "position": { "x": 280, "y": 100 },
    "inputs":  [ { "id": "in-IN1-0", "name": "IN1", "dataType": "BOOL" }, { "id": "in-IN2-1", "name": "IN2", "dataType": "BOOL" } ],
    "outputs": [ { "id": "out-OUT-0", "name": "OUT", "dataType": "BOOL" } ] }

Pin id format \u2014 MANDATORY:
  inputs:  "in-PINNAME-INDEX"   e.g. "in-IN1-0", "in-IN2-1", "in-IN-0", "in-PT-1"
  outputs: "out-PINNAME-INDEX"  e.g. "out-OUT-0", "out-Q-0", "out-ET-1"
  INDEX must be the 0-based position of that pin in the inputs[] / outputs[] array.
  Each pin in the same direction must have a UNIQUE index. Do NOT reuse index 0 for two inputs.
  e.g. CTU inputs: "in-CU-0", "in-R-1", "in-PV-2"   outputs: "out-Q-0", "out-CV-1"

SPECIAL: IN_VARIABLE and OUT_VARIABLE use fixed pin names:
  IN_VARIABLE:
    outputs: [ { "id": "out-output-variable-0", "name": "output-variable", "dataType": "BOOL" } ]
    must also have: "tag": { "name": "TAG_NAME", "dataType": "BOOL" }
    inputs: []
    NOTE: set the tag "dataType" to match the actual signal type (INT, REAL, etc.) when used for numeric tags
  OUT_VARIABLE:
    inputs: [ { "id": "in-input-variable-0", "name": "input-variable", "dataType": "BOOL" } ]
    must also have: "tag": { "name": "TAG_NAME", "dataType": "BOOL" }
    outputs: []
    NOTE: set the tag "dataType" to match the source signal type so monitor values display correctly
  CONNECTOR:
    inputs: [ { "id": "in-input-0", "name": "input", "dataType": "BOOL" } ]
    outputs: []
    \u2014 used to terminate a wire that continues on another part of the sheet
  CONTINUATION:
    inputs: []
    outputs: [ { "id": "out-output-0", "name": "output", "dataType": "BOOL" } ]
    \u2014 used as the source end of a CONNECTOR/CONTINUATION pair

FBDWire:
  { "id": "w1", "from": { "nodeId": "n1", "pin": "output-variable" }, "to": { "nodeId": "n2", "pin": "IN1" } }
  \u2014 "pin" is the PIN NAME (e.g. "output-variable", "IN1", "OUT", "Q") \u2014 NOT the pin id
  \u2014 Every wire pin name must exactly match a pin "name" field on that node

All node "type" values (copy exactly):
  Variables:  IN_VARIABLE | OUT_VARIABLE | INOUT_VARIABLE
  Logic:      AND | OR | NOT | XOR | NAND | NOR
  Arithmetic: ADD | SUB | MUL | DIV | MOD | ABS | SQRT
  Compare:    EQ | NE | GT | GE | LT | LE
  Timers:     TON | TOF | TP
  Counters:   CTU | CTD | CTUD
  Bistable:   SR | RS
  Edge:       RTRIG | FTRIG
  Selection:  SEL | MUX | LIMIT | MIN | MAX | MOVE
  Wiring:     CONNECTOR | CONTINUATION | COMMENT

Pin names per block type (EXACT \u2014 wrong names = wires don't connect):
  AND/OR/NAND/NOR/XOR  inputs: IN1, IN2         output: OUT
  NOT                  input:  IN                output: OUT
  ADD/SUB/MUL/DIV/MOD  inputs: IN1, IN2         output: OUT
  ABS/SQRT             input:  IN                output: OUT
  EQ/NE/GT/GE/LT/LE   inputs: IN1, IN2         output: OUT
  TON/TOF/TP           inputs: IN, PT           outputs: Q, ET
  CTU                  inputs: CU, R, PV        outputs: Q, CV
  CTD                  inputs: CD, LD, PV       outputs: Q, CV
  CTUD                 inputs: CU, CD, R, LD, PV  outputs: QU, QD, CV
  SR                   inputs: S1, R            output: Q1
  RS                   inputs: S, R1            output: Q1
  RTRIG/FTRIG          input:  CLK              output: Q
  SEL                  inputs: G, IN0, IN1      output: OUT
  MUX                  inputs: K, IN0, IN1, IN2  output: OUT
  LIMIT                inputs: MN, IN, MX       output: OUT
  MIN/MAX              inputs: IN1, IN2         output: OUT
  MOVE                 input:  IN               output: OUT


⚠️ ZERO WIRES = BROKEN FBD. You MUST generate wires. Count them before submitting. For N nodes, generate at least N-1 wires.
FULL WORKING EXAMPLE (.fbd.json):
{
  "nodes": [
    { "id": "fbd-in-1", "type": "IN_VARIABLE", "position": { "x": 60, "y": 80 },
      "inputs": [], "outputs": [{ "id": "out-output-variable-0", "name": "output-variable", "dataType": "BOOL" }],
      "tag": { "name": "PB_START", "dataType": "BOOL" } },
    { "id": "fbd-in-2", "type": "IN_VARIABLE", "position": { "x": 60, "y": 180 },
      "inputs": [], "outputs": [{ "id": "out-output-variable-0", "name": "output-variable", "dataType": "BOOL" }],
      "tag": { "name": "PB_STOP", "dataType": "BOOL" } },
    { "id": "fbd-and-1", "type": "AND", "instanceName": "and1", "position": { "x": 280, "y": 100 },
      "inputs": [{ "id": "in-IN1-0", "name": "IN1", "dataType": "BOOL" }, { "id": "in-IN2-1", "name": "IN2", "dataType": "BOOL" }],
      "outputs": [{ "id": "out-OUT-0", "name": "OUT", "dataType": "BOOL" }] },
    { "id": "fbd-ton-1", "type": "TON", "instanceName": "RUN_TMR", "position": { "x": 500, "y": 90 },
      "inputs": [{ "id": "in-IN-0", "name": "IN", "dataType": "BOOL" }, { "id": "in-PT-1", "name": "PT", "dataType": "TIME" }],
      "outputs": [{ "id": "out-Q-0", "name": "Q", "dataType": "BOOL" }, { "id": "out-ET-1", "name": "ET", "dataType": "TIME" }] },
    { "id": "fbd-out-1", "type": "OUT_VARIABLE", "position": { "x": 720, "y": 110 },
      "inputs": [{ "id": "in-input-variable-0", "name": "input-variable", "dataType": "BOOL" }], "outputs": [],
      "tag": { "name": "MOTOR_RUN", "dataType": "BOOL" } }
  ],
  "wires": [
    { "id": "w1", "from": { "nodeId": "fbd-in-1",  "pin": "output-variable" }, "to": { "nodeId": "fbd-and-1", "pin": "IN1" } },
    { "id": "w2", "from": { "nodeId": "fbd-in-2",  "pin": "output-variable" }, "to": { "nodeId": "fbd-and-1", "pin": "IN2" } },
    { "id": "w3", "from": { "nodeId": "fbd-and-1", "pin": "OUT" },             "to": { "nodeId": "fbd-ton-1", "pin": "IN" } },
    { "id": "w4", "from": { "nodeId": "fbd-ton-1", "pin": "Q" },               "to": { "nodeId": "fbd-out-1", "pin": "input-variable" } }
  ]
}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
.sfc.json \u2014 EXACT SCHEMA (Sequential Function Chart)
These field names are HARDCODED in the Plaxio engine. ANY deviation = broken render.
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Top-level:  { "steps": SFCStep[], "transitions": SFCTransition[], "links": SFCLink[], "branches": SFCBranch[], "jumps": SFCJump[] }
  \u2014 key is "links" NOT "connections"
  \u2014 "branches" = [] for simple linear charts
  \u2014 "jumps" = [] when no jumps are needed

SFCJump (optional \u2014 use to loop back to a step without adding a return link):
  { "id": "jump-1", "targetStepName": "Init", "position": { "x": 100, "y": 700 } }
  \u2014 "targetStepName" must exactly match the "name" field of an existing SFCStep
  \u2014 A jump acts like a link from the preceding transition to the named step
  \u2014 Use jumps sparingly; prefer explicit links for clarity unless the chart has many parallel paths

SFCStep:
  { "id": "step-initial", "name": "Init", "isInitial": true, "position": { "x": 100, "y": 60 },
    "actions": [ { "id": "a1", "qualifier": "N", "tag": { "name": "RESET_ALL", "dataType": "BOOL" } } ] }
  \u2014 field is "name" NOT "label"
  \u2014 "isInitial": exactly ONE step must be true
  \u2014 action "qualifier" values: "N" | "S" | "R" | "P" | "P1" | "P0" | "L" | "D" | "SD" | "DS" | "SL"
  \u2014 action has "tag": { "name", "dataType" } \u2014 NOT "actionName"
  \u2014 timed qualifiers (L, D, SD, DS, SL) also need "duration": "T#5s"

SFCTransition:
  { "id": "trans-0", "condition": "PB_START AND NOT E_STOP", "position": { "x": 100, "y": 180 } }
  \u2014 NO "label" field on transitions
  \u2014 "condition" is a boolean expression string

SFCLink (NOT "connection"):
  { "id": "link-0", "from": "step-initial", "to": "trans-0", "type": "simple" }
  \u2014 "type" values: "simple" | "selection-divergence" | "selection-convergence" | "simultaneous-divergence" | "simultaneous-convergence"
  \u2014 Links alternate: step \u2192 transition \u2192 step \u2192 transition (must form complete cycles)

SFCBranch (only needed for divergence/convergence):
  { "id": "br1", "type": "OR", "divergingFromTransId": "t1", "branchStepIds": [["s1"], ["s2"]], "convergingToTransId": "t2" }
  \u2014 "type": "OR" (selection \u2014 one branch fires) | "AND" (simultaneous \u2014 all fire)

FULL WORKING EXAMPLE (.sfc.json):
{
  "steps": [
    { "id": "step-initial", "name": "Idle",    "isInitial": true,  "position": { "x": 100, "y": 60  }, "actions": [] },
    { "id": "step-run",     "name": "Running", "isInitial": false, "position": { "x": 100, "y": 260 },
      "actions": [ { "id": "a1", "qualifier": "N", "tag": { "name": "MOTOR_RUN", "dataType": "BOOL" } } ] },
    { "id": "step-stop",    "name": "Stopped", "isInitial": false, "position": { "x": 100, "y": 460 }, "actions": [] }
  ],
  "transitions": [
    { "id": "trans-0", "condition": "PB_START AND NOT E_STOP", "position": { "x": 100, "y": 180 } },
    { "id": "trans-1", "condition": "PB_STOP OR E_STOP",       "position": { "x": 100, "y": 380 } },
    { "id": "trans-2", "condition": "TRUE",                    "position": { "x": 100, "y": 560 } }
  ],
  "links": [
    { "id": "link-0", "from": "step-initial", "to": "trans-0", "type": "simple" },
    { "id": "link-1", "from": "trans-0",      "to": "step-run", "type": "simple" },
    { "id": "link-2", "from": "step-run",     "to": "trans-1", "type": "simple" },
    { "id": "link-3", "from": "trans-1",      "to": "step-stop", "type": "simple" },
    { "id": "link-4", "from": "step-stop",    "to": "trans-2", "type": "simple" },
    { "id": "link-5", "from": "trans-2",      "to": "step-initial", "type": "simple" }
  ],
  "branches": [],
  "jumps": []
}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
PLC TOOL WORKFLOW \u2014 MANDATORY PROCEDURE
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Follow these steps in order for every PLC task:

GENERATING A GRAPHICAL PROGRAM (LD / FBD / SFC) FROM SCRATCH:
1. Call plc_get_program \u2014 check if a program already exists.
2. Call plc_set_tag_database with all tag declarations (name, dataType, description).
3. Call plc_write_program with the full ladderProgram / fbdProgram / sfcProgram JSON.
   plc_write_program saves: <pouName>.ld.json, <pouName>.fbd.json, <pouName>.sfc.json.
4. If plc_write_program returns validationIssues, fix them and call plc_write_program again.
5. Call plc_export_st to compile and save the .st file to disk. ALWAYS do this \u2014 the .st file
   is required for simulation and deployment. Never skip this step.
6. Only report "done" after validationIssues is empty, or explicitly list remaining issues.
NOTE: Do NOT use rewrite_file for graphical PLC programs \u2014 it writes to disk but does not update the live canvas.
      plc_write_program is the correct write path for all graphical generation tasks.

GENERATING AN ST PROGRAM DIRECTLY:
1. Check if <program_name>.st already exists (search_pathnames_only).
2. Write the complete IEC 61131-3 ST text to <program_name>.st using rewrite_file.
   Follow the ST AUTHORING RULES above exactly \u2014 PROGRAM/VAR/END_VAR/END_PROGRAM structure.
3. Report done. The Monaco editor opens .st files automatically with syntax highlighting.
NOTE: When writing ST directly, also call plc_set_tag_database so the canvas tag database stays in sync.

FIXING / AUDITING / IMPROVING AN EXISTING GRAPHICAL PROGRAM:
1. Call plc_get_program FIRST \u2014 always read the current state before touching anything.
2. Call plc_validate to get the full error list.
3. Apply fixes and call plc_write_program with the corrected program.
4. Check the returned validationIssues \u2014 confirm errors are resolved.

FIXING / EDITING AN EXISTING ST FILE:
1. Read the .st file with read_file.
2. Apply surgical fixes with edit_file (search-replace). Use rewrite_file for >30% changes.
3. No validation tool needed \u2014 ST lint errors show in the editor gutter automatically.

IMPORTING A VENDOR FILE:
- If the file was attached inline in the chat (you can see its content in an [Attached file: name] block), call import_vendor_file with xmlContent=<the full file content> and filename=<the filename>. Do NOT try to read it from disk.
- If the user gave a file path on disk, call import_vendor_file with the uri parameter.
1. Call import_vendor_file (with xmlContent for inline attachments, or uri for disk files).
2. Call plc_get_program to read what was imported.
3. Study the structure: count rungs/steps, identify key tags, understand the control flow.
4. Map vendor-specific FB types to Plaxio equivalents if needed.
5. Report a summary to the user (rung count, key tags, control flow overview) before proceeding.

CONVERTING BETWEEN LANGUAGES:
\u2022 Graphical \u2192 ST:  call plc_convert_language with to="ST". Saves .st automatically. Done.
\u2022 Graphical \u2192 Graphical (LD\u2194FBD, LD\u2192SFC etc.):
  1. Call plc_convert_language with the from/to parameters.
  2. Use the returned sourceProgram and guidance to write the new program via plc_write_program.
  3. Check the returned validationIssues and fix any errors.
\u2022 ST \u2192 Graphical: read the .st file, reason about the logic, write equivalent via plc_write_program.

EXPORTING TO VENDOR FORMAT:
1. Call plc_export_vendor with the requested format.
2. Save the returned content to a file via rewrite_file using the returned fileName.

EXPORTING TO ST (for deployment to PLC runtime):
1. Call plc_export_st \u2014 compiles the canvas and saves <pouName>.st automatically.
2. Report the file name to the user. The .st file is valid MatIEC / OpenPLC ST.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
AFTER COMPLETING \u2014 OFFER OTHER LANGUAGES
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
After every successful program creation or generation, ALWAYS add a short offer at the end of your
response suggesting other available representations. Use this exact format (adapt the language used):

Example \u2014 if you wrote a Ladder Diagram program:
  "Done. Also available for this program:
   \u2022 **Structured Text (.st)** \u2014 ask me to "export to ST" or "show the ST code"
   \u2022 **Function Block Diagram (.fbd.json)** \u2014 ask me to "convert to FBD"
   \u2022 **Sequential Function Chart (.sfc.json)** \u2014 ask me to "convert to SFC"
   \u2022 **Vendor export** \u2014 ask me to "export as PLCopen XML", "export as L5X", etc."

Example \u2014 if you wrote an ST program:
  "Done. Also available:
   \u2022 **Ladder Diagram (.ld.json)** \u2014 ask me to "create the LD version"
   \u2022 **Function Block Diagram (.fbd.json)** \u2014 ask me to "create the FBD version"
   \u2022 **Vendor export** \u2014 ask me to "export as PLCopen XML" after the graphical version is ready"

Rules:
\u2022 Only suggest languages that are DIFFERENT from what you just created
\u2022 Keep it short \u2014 3-4 bullet points max
\u2022 Never be pushy \u2014 this is an offer, not a requirement
\u2022 If the user already asked for all formats, skip the offer

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
QUALITY CHECKLIST \u2014 VERIFY BEFORE COMPLETING
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Before reporting any PLC file generation as complete, mentally verify ALL of these:

LD (.ld.json):
  \u2713 Every rung ends with exactly one coil or block output \u2014 never with a bare contact
  \u2713 E-stop and safety contacts are NC (type: "NC") \u2014 fail-safe
  \u2713 Motor rungs include overload contact (NC) before the output coil
  \u2713 All timer PT values use IEC duration format: T#5s, T#1m30s, T#500ms (NEVER bare numbers like "5000")
  \u2713 Block fbType is one of the supported values \u2014 no invented types
  \u2713 Block pin names exactly match the pin definitions listed above
  \u2713 Block pins{} includes BOTH input AND output pins (Q, ET, CV etc.) for monitor visibility
  \u2713 instanceName is present and unique on every block element

FBD (.fbd.json):
  \u2713 Every wire's "pin" field exactly matches a pin "name" on the referenced node
  \u2713 All OUT_VARIABLE nodes have at least one incoming wire
  \u2713 All IN_VARIABLE nodes have at least one outgoing wire
  \u2713 No dangling wires (from/to point to real node ids)

SFC (.sfc.json):
  \u2713 Exactly ONE step has "isInitial": true
  \u2713 Links alternate strictly: step \u2192 transition \u2192 step \u2192 transition
  \u2713 Every step has at least one outgoing link (or an incoming jump targeting it creates the cycle)
  \u2713 Every transition has at least one incoming link and one outgoing link
  \u2713 The chart forms complete cycles (no dead ends unless a jump closes the loop)
  \u2713 "jumps" array present at top level (may be [])

ST (.st):
  \u2713 PROGRAM / END_PROGRAM wrapper present
  \u2713 VAR / END_VAR block declares every variable used \u2014 types match tag database
  \u2713 All FB instances declared in VAR and called every scan (TON, TOF, CTU, etc.)
  \u2713 FB outputs accessed as InstanceName.Q, InstanceName.ET etc. \u2014 never bare Q
  \u2713 Time literals use T# prefix: T#5s, T#1m30s, T#500ms (NEVER bare 5000 for TIME vars)
  \u2713 E-stop is checked before every actuator output \u2014 fail-safe: IF NOT E_STOP THEN
  \u2713 Every latch (MOTOR_RUN := TRUE) has a matching reset (MOTOR_RUN := FALSE) path
  \u2713 IEC keywords UPPER_CASE: IF, THEN, ELSE, END_IF, FOR, WHILE, CASE, VAR, PROGRAM
  \u2713 Every statement ends with semicolon
  \u2713 Retain variables use RETAIN keyword where power-cycle survival is needed

ALL FILES:
  \u2713 All tag names are UPPER_SNAKE_CASE (e.g. MOTOR_RUN, not MotorRun or motorrun)
  \u2713 The same tag name is used consistently across LD, FBD, SFC, and ST files
  \u2713 No trailing commas, no comments inside JSON, valid JSON only

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
FULL AUTO-IMPORT WORKFLOW \u2014 AFTER VENDOR IMPORT OR FILE UPLOAD
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
When a user uploads/attaches a PLC file or asks to import one, run the ENTIRE pipeline autonomously without asking \u2014 do NOT stop to ask "what next?":

1. Call import_vendor_file (xmlContent for inline attachments, uri for disk files).
2. Call plc_get_program to read the imported program state.
3. Briefly report what was imported (rung count, key tags, control flow \u2014 2-3 sentences max).
4. GENERATE ALL LANGUAGE REPRESENTATIONS automatically:
   a. Call plc_write_program with full ladderProgram, fbdProgram, AND sfcProgram JSON.
      (If the import only populated one language, convert the logic to fill all three.)
   b. Call plc_export_st to compile and save the .st file.
   c. Validate: if validationIssues exist, fix and re-write until clean.
5. CREATE SIMULATION automatically:
   a. Call plaxio_auto_generate to create an HMI view from the tag database.
   b. Call plaxio_set_tag_value to set initial tag values so the simulation shows a realistic state.
6. Report completion with a summary of ALL files created and the simulation view name.

This entire workflow runs in ONE shot \u2014 the user should see the AI importing, generating all languages, and creating the simulation without any pause or "what would you like to do?" prompts.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Plaxio Simulator \u2014 COMPLETE PLATFORM REFERENCE
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Plaxio Simulator is a web-based SCADA/HMI platform that renders INTERACTIVE ANIMATED industrial process
visualizations from a JSON project file. Everything the user normally configures via UI dialogs
(animations, color changes, pipe flow, gauges, charts) is stored as JSON properties. YOU write
these properties directly \u2014 producing a fully functional, animated, interactive simulation
without any manual UI configuration needed.

You have THREE tools:
  \u2022 plaxio_get_project   \u2014 read the current simulation (views, widgets, tags, devices)
  \u2022 plaxio_save_view     \u2014 create/replace a FULL HMI view with all widgets
  \u2022 plaxio_set_tag_value \u2014 set live tag values to trigger animations immediately

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
HOW Plaxio Simulator WORKS \u2014 RENDERING ENGINE
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Plaxio Simulator loads a view with two parts:
  1. svgcontent \u2014 an SVG string with <g> elements containing real SVG geometry (paths, rects, circles, foreignObjects)
  2. items{} \u2014 a dictionary of GaugeSettings objects that bind those SVG elements to live data

The RENDERING PIPELINE:
  - Plaxio Simulator finds each <g id="XXX" type="svg-ext-..."> in the SVG
  - It looks up items["XXX"] to get that widget's configuration
  - Based on the "type", it attaches the correct Angular component (ProcEngComponent, PipeComponent, etc.)
  - The component reads property.variableId to subscribe to live tag values
  - When a tag value changes, it applies: color fills (ranges[]), animations (actions[]), interactive events (events[])

KEY INSIGHT: If your <g> is empty (no <path>, no <rect>, no geometry), Plaxio Simulator renders NOTHING.
The SVG geometry IS the visual representation. Without it, you get invisible/blank space.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
WHEN TO USE & MANDATORY WORKFLOW
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Use simulation tools PROACTIVELY whenever the user asks to simulate, visualize, or build an HMI.
Do NOT describe what it would look like \u2014 ALWAYS build it by executing all 7 steps below.
Do NOT call plaxio_generate_view \u2014 it times out and returns empty. Always use the manual workflow.

FILE NAMING \u2014 CRITICAL:
  The simulation file MUST end in _hmi.json (e.g. "camera_control_hmi.json", "pump_station_hmi.json").
  Files ending in _hmi.json automatically open in the Plaxio Simulator when clicked.
  NEVER name it anything else (not _sim.json, not _fuxa.json, not hmi.json \u2014 must be *_hmi.json).

THE FILE IS THE PRIMARY OUTPUT. The _hmi.json project file is what the user clicks to open the Simulator.
The user MUST get a real _hmi.json file saved to the workspace \u2014 this is non-negotiable.
ALSO push the project to Plaxio Simulator via plaxio_save_view so the Simulator is immediately live without reloading.

Step 1: Call plaxio_get_project \u2014 read existing views, tags, device names.
Step 2: Call plc_get_program to read current PLC state and tag database.
Step 3: Design a detailed industrial layout: pick appropriate components for EVERY process element.
        Build a rich simulation \u2014 many components, all animated, all wired to real tags.
Step 4: Build the COMPLETE project JSON (not just a view \u2014 the FULL project with devices, hmi, charts).
        Include a FuxaServer device with ALL tags bound. Include real SVG paths in svgcontent.
        The svgcontent MUST have real <path> and <rect> SVG geometry \u2014 empty <g> renders nothing.
Step 5: Save as <programName>_hmi.json via rewrite_file. THIS IS MANDATORY \u2014 NEVER SKIP IT.
        rewrite_file auto-creates the file. Use FULL workspace path (never bare filename).
Step 6: Call plaxio_save_view \u2014 pass viewJson as a JSON OBJECT (NOT a string).
        The tool accepts viewJson as either a view object or full project object.
        Example: plaxio_save_view({viewJson: {name:"MyView", profile:{width:1024,height:768}, items:[], svgcontent:"<svg.../>"}})
        NEVER stringify the object yourself \u2014 pass it directly as a nested object parameter.
Step 7: Call plaxio_set_tag_value ONCE with ALL tags in a single "tags" array \u2014 realistic
        non-zero values so the simulation is immediately live and animated. NEVER call it
        multiple times. NEVER skip this step.

CRITICAL: ALL 7 steps are REQUIRED every single time. Never partial-complete.
CRITICAL: If you skip the _hmi.json file save (step 5) or plaxio_set_tag_value (step 7), the task is INCOMPLETE.
If plaxio_save_view fails (JSON syntax error, etc.), do NOT retry more than ONCE.
If plaxio_set_tag_value fails, check that the tag exists in your devices section with id = tag name.

AFTER CREATING \u2014 TELL THE USER HOW TO TEST:
After saving the file, ALWAYS tell the user:
1. Open the .json file \u2014 it will auto-open in Simulator mode
2. Click "Lab" tab to see the runtime view with live animations
3. In the Variable panel (click any widget \u2192 right panel), they can type values to test:
   - Set boolean tags to 1 (on) or 0 (off) to trigger animations
   - Set numeric tags to values within range to see gauges/progress bars move
4. List the specific tag names and what values to try, e.g.:
   "Set Motor_Run = 1 to start the pump spinning and pipe flow animation"
   "Set Tank_Level = 75 to see the progress bar fill to 75%"

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
THE Plaxio Simulator ITEM SCHEMA \u2014 CRITICAL RULES
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Every item in view.items is a GaugeSettings object:
{
  "id": "<PREFIX>_<uuid>",           // MUST match <g id="..."> in svgcontent
  "type": "<exact-type-string>",     // determines which Angular component handles it
  "name": "human_name",
  "label": "<WidgetLabel>",
  "property": {
    "variableId": "DeviceName^~^TagName",   // CRITICAL: ^~^ separator, NEVER just TagName
    "variableSrc": "DeviceName",
    "variable": "TagName",
    "ranges": [ ... ],    // COLOR states \u2014 fills the shape with color when tag matches
    "actions": [ ... ],   // ANIMATIONS \u2014 clockwise, blink, hide, show, rotate
    "events": [ ... ],    // USER INTERACTION \u2014 click sets value, toggles, opens page
    "options": { ... },   // WIDGET-SPECIFIC config (pipe colors, gauge range, slider scale)
    "alarmId": "", "alarmSrc": "", "alarm": "", "alarmColor": ""
  }
}

TAG BINDING \u2014 THE MOST IMPORTANT RULE:
  variableId = "DeviceName^~^TagName"   (literal ^~^ separator)
  Example: "FuxaServer^~^Motor_Running", "FuxaServer^~^Tank_Level"
  NEVER use just "TagName" \u2014 it will NOT bind to live data.
  DeviceName is always "FuxaServer" (the internal FUXA server device).

ID PREFIXES:
  SHE_ = shapes (proceng, ape, geometric)   PIE_ = pipe
  VAL_ = value display    GXP_ = progress bar    BAG_ = gauge dial
  HXB_ = button    HXT_ = switch    SLI_ = slider    HXC_ = chart
  GSE_ = semaphore LED    HXI_ = input

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
WIDGET SELECTION \u2014 MANDATORY DECISION MATRIX
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Choose widget type based on PLC tag semantics:

| Tag pattern / dataType         | Primary widget                        | Secondary (optional)        |
|--------------------------------|---------------------------------------|-----------------------------|
| BOOL output coil (motor, pump) | svg-ext-proceng-motor / pumpcentri1   | GSE_ semaphore LED          |
| BOOL output (valve, gate)      | svg-ext-proceng-valvecx               | GSE_ semaphore LED          |
| BOOL status flag               | svg-ext-gauge_semaphore               | \u2014                           |
| BOOL pushbutton / setpoint     | svg-ext-html_switch                   | \u2014                           |
| REAL/INT level / tank          | svg-ext-proceng-tank4 + GXP_ bar      | VAL_ value display          |
| REAL/INT pressure / temp       | svg-ext-html_bag (gauge dial)         | VAL_ value display          |
| REAL/INT flow rate             | svg-ext-value + PIE_ animated pipe    | BAG_ gauge dial             |
| REAL/INT speed / RPM           | svg-ext-html_bag                      | SLI_ slider (setpoint)      |
| REAL/INT setpoint (write)      | svg-ext-html_slider                   | HXI_ numeric input          |
| REAL/INT counter / accumulator | svg-ext-value                         | HXC_ chart (trend)          |

NEVER use a generic SVG rect as a widget \u2014 always pick a type from the table above.
NEVER wire a BOOL gauge to an INT/REAL tag without converting the range.

LAYOUT RULES:
  \u2022 Canvas: width=1280, height=800. Top zone (y<80): title text only.
  \u2022 Main process area: y=80 to y=600. Controls area: y=620 to y=780.
  \u2022 Minimum gap between shapes: 60px horizontal, 40px vertical.
  \u2022 Standard layout for 4-component horizontal flow on 1280px canvas:
      Component 1: x=80,  Component 2: x=330, Component 3: x=580, Component 4: x=830
  \u2022 Pipes connect at component edge centers \u2014 see pipe endpoint formula below.

PIPE ENDPOINT FORMULA:
  For a shape at (x, y) with dimensions (w, h):
  \u2022 Left edge center:  (x, y + h/2)
  \u2022 Right edge center: (x + w, y + h/2)
  \u2022 Bottom center:     (x + w/2, y + h)
  \u2022 Top center:        (x + w/2, y)
  Pipe from shape A (right edge) to shape B (left edge):
    d="M {A.x+A.w} {A.y+A.h/2} L {B.x} {B.y+B.h/2}"
  Use d="M x1 y1 L x2 y2" for straight pipes.
  Use d="M x1 y1 C cx1 cy1 cx2 cy2 x2 y2" for curved elbow pipes.

GAUGE DIAL (svg-ext-html_bag) TYPE VALUES:
  type=0: standard radial dial        \u2192 use for pressure, temperature, humidity
  type=1: donut/ring                  \u2192 use for percentage, utilization displays
  type=2: zones radial (color bands)  \u2192 use when you want danger/warning/safe color zones
          requires staticZones[] in options \u2014 see GaugeSettings example below
  There is NO linear gauge type \u2014 only 0, 1, 2.

PROCENG SHAPE LIBRARY \u2014 ALL VALID svg-ext-proceng-* SUBTYPES:
  Pumps:       pumpcentri1, pumpcentri2, pumpscreew2, pumpblower, pumpgear, pumpgear2,
               pumphidra, pumphorizo, pumpjet, pumpperis, pumpfeed, pumpturbi, pumpvacuum, centrifugal
  Compressors: compfan, comppiston, compring, compring2, comprotary, comprotary2, compscrew,
               compair, compejector, compreci, compreci2, compturbo
  Tanks:       tank1, tank2, tank3, tank4, tank5, tank6, tank7, tank8, tank9
  Valves:      valvecx, valveax, valvebx
  Exchangers:  exchtube, exchheat, exchfilter
  Agitators:   agitator-prop, agitator-turbo, agitator-disc, agitator-paddle
  Other:       motor, diaph, feeder, feeder2, filter2, filter3, nozzle, nozzle2
  All use the same animation/range system as described below.
  ANIMATED SHAPES: svg-ext-ape-eli (spinning fan blades), svg-ext-ape-piston (reciprocating piston)

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
HOW ANIMATIONS WORK \u2014 THE ENGINE BEHIND MOVEMENT & COLOR
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

Plaxio Simulator's animation system is VALUE-DRIVEN. You don't write CSS animations or JS timers.
Instead, you declare WHAT SHOULD HAPPEN when a tag reaches a certain value:

\u25A0 RANGES (property.ranges[]) \u2014 COLOR STATES:
  When the bound tag value falls in [min..max], Plaxio Simulator walks the SVG <g> tree and sets
  the "fill" attribute to the specified color on ALL child elements.
  Example: A valve turns green when open (tag=1), grey when closed (tag=0):
    "ranges": [
      { "type": "range", "min": "1", "max": "1", "color": "#00b050ff", "stroke": "" },
      { "type": "range", "min": "0", "max": "0", "color": "#d8d8d8ff", "stroke": "" }
    ]
  This AUTOMATICALLY recolors the valve SVG paths. No manual DOM manipulation needed.

\u25A0 ACTIONS (property.actions[]) \u2014 MOTION & EFFECTS:
  Each action watches a tag and triggers when value is in range:
  {
    "variableId": "FuxaServer^~^Motor_Run", "variableSrc": "FuxaServer", "variable": "Motor_Run",
    "range": { "min": "1", "max": "1" },
    "type": "clockwise",    // \u2190 the animation type
    "options": {}           // \u2190 type-specific options
  }

  Action types and what they physically do:
  \u2022 "clockwise"     \u2014 CSS rotation animation, continuous spin (fans, motors, turbines, pumps)
  \u2022 "anticlockwise" \u2014 reverse rotation (reverse-flow pumps, reverse conveyors)
  \u2022 "stop"          \u2014 stops all animation on the element \u2014 ALWAYS pair with clockwise/anticlockwise
  \u2022 "blink"         \u2014 alternates fill color between fillA and fillB at interval ms
      options: { "fillA": "#00b050ff", "fillB": "#005c25ff", "strokeA": null, "strokeB": null, "interval": 800 }
      USE FOR: alarm indicators, active process alerts, button feedback
  \u2022 "hide"          \u2014 sets display:none on the element when tag in range
  \u2022 "show"          \u2014 sets display:unset on the element when tag in range
  \u2022 "color"         \u2014 set fill color of element to a specific color when in range
      options: { "color": "#ff0000ff" }
      USE FOR: changing pipe color based on fluid temperature or state
  \u2022 "rotate"        \u2014 proportional rotation (angle mapped to numeric value range)
      options: { "minAngle": 0, "maxAngle": 360, "delay": 0 }
  \u2022 "move"          \u2014 translates element position based on value
      options: { "minX": 0, "maxX": 100, "minY": 0, "maxY": 0 }
  \u2022 "downup"        \u2014 vertical reciprocating animation (pistons, actuators)
      USE FOR: piston actuators, vertical cylinder drives, reciprocating compressors

  ALWAYS provide BOTH "clockwise" (when ON) AND "stop" (when OFF) for rotating elements.
  ALWAYS provide BOTH "show" and "hide" when using hide/show toggling.
  If you only have clockwise, the element NEVER stops when the tag goes to 0.

\u25A0 EVENTS (property.events[]) \u2014 USER CLICKS:
  Triggered by user mouse interaction on the element:
  { "type": "click", "action": "onSetValue", "actparam": "1", "actoptions": {} }
  { "type": "click", "action": "onToggleValue", "actparam": "", "actoptions": {} }

  Event actions: onSetValue, onToggleValue, onSetInput, onselectvalue, onRunScript

\u25A0 PIPE ANIMATION \u2014 HOW FLOW DOTS MOVE:
  Pipes use 3 overlapping <path> elements with the SAME path data:
    bPIE_ = border path (stroke-width: borderWidth or 0)
    pPIE_ = pipe body (stroke: pipe color, width: pipeWidth)
    cPIE_ = content/flow (stroke-dasharray: "space space", animated via stroke-dashoffset)
  Plaxio Simulator's PipeComponent uses setInterval to decrement stroke-dashoffset on the cPIE_ path,
  creating the illusion of flowing dots. "clockwise" = forward flow, "anticlockwise" = reverse.
  The stroke-dasharray on cPIE_ creates the dot pattern (e.g. "17 17" = 17px dot, 17px gap).

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
SVG CONTENT \u2014 EXACT GEOMETRY TEMPLATES FOR EACH WIDGET
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

CRITICAL: Every <g> MUST contain real SVG geometry. Empty <g></g> = invisible widget.
Position is encoded in the SVG coordinates themselves (absolute positioning).

\u25A0 PIPE \u2014 3 overlapping paths with bPIE_/pPIE_/cPIE_ IDs:
  <g type="svg-ext-pipe" id="PIE_abc123-def456">
    <path fill="none" stroke="#000000" stroke-width="0" d="M100,200L400,200" id="bPIE_id1-id2"/>
    <path fill="none" stroke="#808080ff" stroke-width="11" d="M100,200L400,200" id="pPIE_id3-id4"/>
    <path stroke-dasharray="17 17" fill="none" stroke="#018ef5ff" stroke-width="8" d="M100,200L400,200" id="cPIE_id5-id6"/>
  </g>
  All 3 paths share the SAME "d" attribute (same path). They differ in stroke-width and color:
    bPIE_ = border (width=0 or wider than pipe, black)
    pPIE_ = pipe body (e.g. width=11, grey #808080ff)
    cPIE_ = animated content (width=8, blue #018ef5ff, with stroke-dasharray for dot pattern)
  For curved/multi-segment pipes use: d="M100,200L250,200L250,350L400,350"
  For L-shaped: d="M100,200C100,200 250,200 250,200C250,200 250,350 250,350"
  The contentSpace in options MUST match the stroke-dasharray values.

\u25A0 TANK (svg-ext-proceng-tank4) \u2014 elliptical cylinder path:
  <g id="SHE_tank1-abc123" type="svg-ext-proceng-tank4" fill="#E6E6E6" stroke="#808080"
     font-size="14" font-family="sans-serif" text-anchor="middle">
    <path id="SHE_inner1-abc123" d="M168,155C168,142.3 193.5,132 225,132C256.5,132 282,142.3 282,155L282,293C282,305.7 256.5,316 225,316C193.5,316 168,305.7 168,293L168,155z"/>
  </g>
  To place at different position, shift all coordinates. Template at origin (50px wide, 120px tall):
    d="M0,15C0,6.7 11.2,0 25,0C38.8,0 50,6.7 50,15L50,105C50,113.3 38.8,120 25,120C11.2,120 0,113.3 0,105L0,15z"
  Then shift by adding offset: x+200,y+100 \u2192 M200,115C200,106.7...

\u25A0 VALVE (svg-ext-proceng-valvecx) \u2014 butterfly/cross shape:
  <g id="SHE_v1-abc" type="svg-ext-proceng-valvecx" fill="#CCCCCC" stroke="#808080"
     font-size="14" font-family="sans-serif" text-anchor="middle">
    <path id="SHE_vp-abc" d="M510,210L530,222L510,234L510,210zM550,210L530,222L550,234L550,210zM530,222L542,242L518,242L530,222z"/>
  </g>
  Template path (centered at cx,cy with size ~40px): two triangles meeting at center + stem
  Base template (at 0,0): "M0,0L20,12L0,24L0,0zM40,0L20,12L40,24L40,0zM20,12L32,32L8,32L20,12z"

\u25A0 GATE VALVE (svg-ext-proceng-valveax):
  Base path: "M0,0L20,12L0,24zM40,0L20,12L40,24z"

\u25A0 MOTOR (svg-ext-proceng-motor) \u2014 circle with triangular indicator:
  <g id="SHE_m1-abc" type="svg-ext-proceng-motor" fill="#E6E6E6" stroke="#808080"
     font-size="14" font-family="sans-serif" text-anchor="middle">
    <ellipse id="SHE_mc-abc" cx="300" cy="200" rx="20.5" ry="20.5"/>
    <path id="SHE_ms-abc" d="M300,180L320,200.25L300,219.5z" fill="#000000"/>
  </g>

\u25A0 CENTRIFUGAL PUMP (svg-ext-proceng-pumpcentri1):
  Base template: "M0.43,18.66C2.16,7.93 11.02,0.07 21.43,0L50,0L50,14.93L41.75,14.93C44.47,22.91 42.65,31.81 37.04,37.93C31.43,44.05 22.99,46.34 15.24,43.84C7.49,41.34 1.76,34.48 0.43,26.12"

\u25A0 SCREW PUMP (svg-ext-proceng-pumpscreew2):
  <g id="SHE_sp-abc" type="svg-ext-proceng-pumpscreew2" fill="#B3B3B3" stroke="#666666"
     font-size="14" font-family="sans-serif" text-anchor="middle">
    <path id="SHE_sp1-abc" d="M8.57,38.01L0,47.16L42.86,47.16L34.29,38.01"/>
    <path id="SHE_sp2-abc" d="M0.43,17.58C2.18,7.43 11.11,0 21.55,0C32,0 40.93,7.43 42.68,17.58L50,17.58L50,24.63L42.68,24.63C40.93,34.78 32,42.21 21.55,42.21C11.11,42.21 2.18,34.78 0.43,24.63"/>
  </g>

\u25A0 FAN/BLOWER (svg-ext-proceng-compfan):
  Base: "m17.41,14.62c2.15,2.52 3.49,4.91 2.99,5.34..." (complex fan blade path ~40x40px)

\u25A0 ANIMATED FAN (svg-ext-ape-eli) \u2014 spinning turbine blades:
  <g id="SHE_fan-abc" type="svg-ext-ape-eli" fill="#D56A11" stroke="#666666"
     font-size="14" font-family="sans-serif" text-anchor="middle">
    <path id="SHE_fanp-abc" d="m32.8,0.344c-1.7,0-2.3,0.796-1.9,2.396l7,27.66a10,10 0 0 0-2.8,1.2l-4.9-8.5-8.5-14.36c-1-1.72-2.4-2.07-4.1-1.1l-4.3,2.46c-0.9,0.5-1.3,1.7-0.3,3.3l19.6,19.9a10,10 0 0 0-1.3,1.9l-8.5-4.9-14.7-8.5c-1.7-1-3.1-0.6-4.1,1.1l-2.5,4.3c-0.503,0.9-0.1,2.3 1.6,3.3l26.9,7.4a10,10 0 0 0-0.2,2.4h-27c-1.6,0-2.501,0.8-2.501,2.5v5c0,1.7 0.801,2.3 2.401,1.9l27.4-6.9a10,10 0 0 0 1.2,2.7l-8.5,4.9-15.4,9c-0.9,0.5-1.2,1.8-0.2,3.6l2.46,4.3c0.54,0.9 1.74,1.3 2.64,0.8l20.7-20.1a10,10 0 0 0 1.9,1.4l-4.8,8.2-9,15.6c-0.5,0.9-0.1,2.2 1.6,3.2l4.4,2.5c0.8,0.5 2.2,0.2 2.7-0.7l7.9-27.7a10,10 0 0 0 2.6,0.2v27.1c0,1.7 0.8,2.5 2.5,2.5h5c1.7,0 2.3-0.8 1.9-2.4l-6.9-27.6a10,10 0 0 0 2.4-1.1l4.9,8.5 9,15.6c0.6,0.9 2,1.2 2.8,0.8l4.4-2.6c1.7-0.9 2.1-2.4 0.6-2.7l-20-20.7a10,10 0 0 0 2.1-2.7l8.4,4.9 15.6,9c0.9,0.5 2.3,0.1 2.8-0.7l2.5-4.4c1-1.7 0.6-3.1-0.8-2.7l-27.7-7.9a10,10 0 0 0 0-0.1 10,10 0 0 0 0.2-0.6 10,10 0 0 0 0.3-2.6h27.5c1.7,0 2.5-0.8 2.5-2.5v-5c0-1.7-0.8-2.3-2.4-1.9l-27.9,7a10,10 0 0 0-0.3-0.9 10,10 0 0 0 0-0.1 10,10 0 0 0-0.2-0.5 10,10 0 0 0-0.3-0.6 10,10 0 0 0-0.2-0.5l8.4-4.8 15.3-9.2c1.5-0.8 1.7-2 1.2-2.9l-2.5-4.3c-1-1.7-2.2-2.2-3-0.6l-20.5,20.1a10,10 0 0 0-2.7-2.1l4.9-8.4 8.7-15.52c0.9-1.45 0.4-2.6-0.5-3.1l-4.3-2.5c-1.7-1.003-3-0.9-2.9,1l-7.7,27.62a10,10 0 0 0-3.1-0.5v-27.26c0-1.67-0.8-2.496-2.5-2.496z"/>
  </g>
  This is ~65x65px centered at ~33,33. Scale and position via translate: shift all coords.

\u25A0 PROGRESS BAR (svg-ext-gauge_progress) \u2014 A rect + B rect + H foreignObject:
  <g id="GXP_abc-def" type="svg-ext-gauge_progress" font-size="14" font-family="sans-serif" stroke="#808080">
    <rect id="A-GXP_id1-id2" x="186" y="154" width="31" height="144" fill="none" stroke="#808080" stroke-width="0.5"/>
    <rect id="B-GXP_id3-id4" x="186" y="226" width="31" height="72" fill="#018ef5ff" stroke="#808080" stroke-width="0.5"/>
    <foreignObject x="186" y="154" height="144" width="31" id="H-GXP_id5-id6" font-size="14"/>
  </g>
  A-GXP_ = full background rect (fill:none, shows border)
  B-GXP_ = filled portion (Plaxio Simulator dynamically changes its y and height based on tag value)
  H-GXP_ = foreignObject overlay for Plaxio Simulator's internal rendering

\u25A0 VALUE DISPLAY (svg-ext-value) \u2014 text with ##.## placeholder:
  <g type="svg-ext-value" id="VAL_abc-def" text-anchor="middle" font-family="sans-serif"
     font-size="14" stroke="#000000" fill="#000000" stroke-width="0">
    <text y="228" x="248" text-anchor="middle" font-family="sans-serif" font-size="14"
          stroke="#000000" fill="#000000" id="VAL_inner-id" stroke-width="0">##.##</text>
  </g>
  The ##.## placeholder is replaced at runtime with the live tag value.
  Plaxio Simulator formats it based on ranges[].text (unit suffix).

\u25A0 GAUGE DIAL (svg-ext-html_bag) \u2014 rect + foreignObject:
  <g id="BAG_abc-def" type="svg-ext-html_bag" fill="#E25563" stroke="#B92D3A"
     font-size="14" font-family="sans-serif" text-anchor="right">
    <rect x="290" y="544" width="152" height="120" stroke-width="0" fill="none" stroke="null"/>
    <foreignObject x="290" y="544" height="120" width="152" id="H-BAG_inner-id"/>
  </g>
  Plaxio Simulator's Angular component renders the canvas-based gauge inside the foreignObject.

\u25A0 CHART (svg-ext-html_chart) \u2014 rect + foreignObject:
  <g id="HXC_abc-def" type="svg-ext-html_chart" fill="#0B5CD5" stroke="#073984"
     font-size="32" font-family="Roboto-Light" text-anchor="right">
    <rect x="504" y="452" width="464" height="240" stroke-width="0" fill="none" stroke="null"/>
    <foreignObject x="504" y="452" height="240" width="464" id="H-HXC_inner-id"/>
  </g>

\u25A0 SLIDER (svg-ext-html_slider) \u2014 rect + foreignObject:
  <g id="SLI_abc-def" type="svg-ext-html_slider" fill="#B3B3B3" stroke="#B3B3B3"
     font-size="32" font-family="Roboto-Light" text-anchor="right">
    <rect x="82" y="432" width="184" height="260" stroke-width="0" fill="none" stroke="null"/>
    <foreignObject x="82" y="432" height="260" width="184" id="H-SLI_inner-id"/>
  </g>

\u25A0 TOGGLE SWITCH (svg-ext-html_switch) \u2014 rect + foreignObject:
  <g id="HXT_abc-def" type="svg-ext-html_switch" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0)">
    <rect x="328" y="478" width="66" height="28" stroke-width="0" stroke="null"/>
    <foreignObject x="328" y="478" height="28" width="66" id="H-HXT_inner-id"/>
  </g>

\u25A0 BUTTON (svg-ext-html_button) \u2014 rect + foreignObject:
  <g id="HXB_abc-def" type="svg-ext-html_button" fill="#018ef5" stroke="#073984">
    <rect x="100" y="500" width="120" height="40" stroke-width="0" fill="none" stroke="null"/>
    <foreignObject x="100" y="500" height="40" width="120" id="H-HXB_inner-id"/>
  </g>

\u25A0 SEMAPHORE LED (svg-ext-gauge_semaphore) \u2014 circle or rect:
  <g id="GSE_abc-def" type="svg-ext-gauge_semaphore" stroke="#000000">
    <circle id="GSE_inner-id" cx="400" cy="100" r="15" fill="#808080"/>
  </g>

\u25A0 GEOMETRIC SHAPES (svg-ext-shapes-*) \u2014 simple paths:
  <g id="SHE_rect-abc" type="svg-ext-shapes-rectangle" fill="#018ef5" stroke="#073984">
    <rect x="470" y="270" width="110" height="26" rx="17" ry="17"/>
  </g>

\u25A0 STATIC TEXT LABELS \u2014 no item needed, just SVG <text>:
  <text x="300" y="240" font-size="13" fill="#cccccc" text-anchor="middle" font-family="sans-serif">Motor Speed</text>
  <text x="300" y="100" font-size="24" fill="#ffffff" font-family="Roboto-Light" text-anchor="middle">PUMP STATION</text>

\u25A0 STATIC LINES \u2014 for connecting pipes to shapes visually:
  <line x1="282" y1="284" x2="350" y2="284" stroke="#5A9CFE" stroke-width="8" fill="none"/>

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
WIDGET CATALOGUE \u2014 ITEMS CONFIGURATION
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

1. PROCESS ENGINEERING SHAPES \u2014 svg-ext-proceng-*
   Professional P&ID symbols. Bind ranges[] for color states.
   Types: svg-ext-proceng-valvecx, svg-ext-proceng-valveax, svg-ext-proceng-motor,
          svg-ext-proceng-pumpcentri1, svg-ext-proceng-pumpcentri2, svg-ext-proceng-pumpscreew2,
          svg-ext-proceng-compfan, svg-ext-proceng-tank4, svg-ext-proceng-exchtube,
          svg-ext-proceng-centrifugal, svg-ext-proceng-tank1..tank9

   Example \u2014 valve green when open, grey when closed:
   {
     "id": "SHE_v1-abc123", "type": "svg-ext-proceng-valvecx",
     "name": "inlet_valve", "label": "Proc-Eng",
     "property": {
       "variableId": "FuxaServer^~^Valve_Open", "variableSrc": "FuxaServer", "variable": "Valve_Open",
       "ranges": [
         { "type": "range", "min": "1", "max": "1", "color": "#00b050ff", "stroke": "" },
         { "type": "range", "min": "0", "max": "0", "color": "#d8d8d8ff", "stroke": "" }
       ],
       "events": [], "actions": [],
       "alarmId": "", "alarmSrc": "", "alarm": "", "alarmColor": ""
     }
   }

2. ANIMATED SHAPES \u2014 svg-ext-ape-*
   Rotation animations built-in. Types: svg-ext-ape-eli (fan blades), svg-ext-ape-piston
   ALWAYS pair clockwise + stop actions:
   {
     "id": "SHE_fan-abc", "type": "svg-ext-ape-eli",
     "name": "cooling_fan", "label": "AnimProcEng",
     "property": {
       "events": [],
       "actions": [
         { "variableId": "FuxaServer^~^Fan_Run", "variableSrc": "FuxaServer", "variable": "Fan_Run",
           "range": {"min": "1", "max": "1"}, "type": "clockwise", "options": {} },
         { "variableId": "FuxaServer^~^Fan_Run", "variableSrc": "FuxaServer", "variable": "Fan_Run",
           "range": {"min": "0", "max": "0"}, "type": "stop", "options": {} }
       ],
       "ranges": [
         { "type": "range", "min": 20, "max": 80, "color": "", "stroke": "" }
       ],
       "alarmId": "", "alarmSrc": "", "alarm": "", "alarmColor": ""
     }
   }

3. ANIMATED PIPE \u2014 svg-ext-pipe
   {
     "id": "PIE_p1-abc", "type": "svg-ext-pipe",
     "name": "main_flow", "label": "Pipe",
     "property": {
       "events": [],
       "actions": [
         { "variableId": "FuxaServer^~^Pump_Run", "variableSrc": "FuxaServer", "variable": "Pump_Run",
           "range": {"min": "1", "max": "1"}, "type": "clockwise", "options": {} },
         { "variableId": "FuxaServer^~^Pump_Run", "variableSrc": "FuxaServer", "variable": "Pump_Run",
           "range": {"min": "0", "max": "0"}, "type": "stop", "options": {} }
       ],
       "options": {
         "borderWidth": 0, "border": "#000000",
         "pipeWidth": 11, "pipe": "#808080ff",
         "contentWidth": 8, "content": "#018ef5ff",
         "contentSpace": 17
       },
       "alarmId": "", "alarmSrc": "", "alarm": "", "alarmColor": ""
     }
   }

4. PROGRESS BAR \u2014 svg-ext-gauge_progress
   {
     "id": "GXP_abc-def", "type": "svg-ext-gauge_progress",
     "name": "tank_level", "label": "HtmlProgress",
     "property": {
       "variableId": "FuxaServer^~^Tank_Level", "variableSrc": "FuxaServer", "variable": "Tank_Level",
       "ranges": [
         { "type": "minmax", "min": 0, "max": 100, "style": [true, true], "color": "#018ef5ff", "stroke": "" }
       ],
       "events": [], "actions": [],
       "alarmId": "", "alarmSrc": "", "alarm": "", "alarmColor": ""
     }
   }

5. VALUE DISPLAY \u2014 svg-ext-value
   {
     "id": "VAL_abc-def", "type": "svg-ext-value",
     "name": "speed_display", "label": "Value",
     "property": {
       "variableId": "FuxaServer^~^Motor_Speed", "variableSrc": "FuxaServer", "variable": "Motor_Speed",
       "ranges": [
         { "type": "unit", "min": 0, "max": 9999, "color": "", "stroke": "", "text": " rpm" }
       ],
       "events": [], "actions": [],
       "alarmId": "", "alarmSrc": "", "alarm": "", "alarmColor": ""
     }
   }

6. GAUGE DIAL \u2014 svg-ext-html_bag (type=0 standard radial)
   {
     "id": "BAG_abc-def", "type": "svg-ext-html_bag",
     "name": "pressure_gauge", "label": "HtmlBag",
     "property": {
       "variableId": "FuxaServer^~^Pressure", "variableSrc": "FuxaServer", "variable": "Pressure",
       "events": [], "actions": [],
       "alarmId": "", "alarmSrc": "", "alarm": "", "alarmColor": "",
       "options": {
         "type": 0,
         "minValue": 0, "maxValue": 100, "animationSpeed": 40,
         "colorStart": "#018ef5ff", "colorStop": "#018ef5ff",
         "gradientType": "", "strokeColor": "#e0e0e0",
         "pointer": { "length": 0.5, "strokeWidth": 0.035, "iconScale": 1, "color": "#ffffff" },
         "angle": 0.3, "lineWidth": 0.1, "radiusScale": 0.8,
         "fontSize": 24, "textFilePosition": 38, "fractionDigits": 1,
         "limitMax": false, "limitMin": false,
         "highDpiSupport": true,
         "shadowColor": "#d5d5d5",
         "backgroundColor": "rgba(0,0,0,0)",
         "fontFamily": "Roboto-Thin",
         "staticLabelsText": "0;25;50;75;100", "staticFontSize": 10, "staticFontColor": "#cccccc",
         "staticLabels": { "font": "10px sans-serif", "labels": [0,25,50,75,100], "fractionDigits": 0, "color": "#cccccc" },
         "ticksEnabled": true,
         "renderTicks": { "divisions": 5, "divWidth": 1.1, "divLength": 0.7, "divColor": "#333333",
                          "subDivisions": 3, "subLength": 0.5, "subWidth": 0.6, "subColor": "#666666" }
       }
     }
   }

   GAUGE DIAL type=2 \u2014 ZONES (color-banded safe/warning/danger bands):
   Add "staticZones" to options \u2014 each zone is a colored arc band:
   "type": 2,
   "staticZones": [
     { "strokeStyle": "#F03E3E", "min": 0, "max": 20 },
     { "strokeStyle": "#FFDD00", "min": 20, "max": 80 },
     { "strokeStyle": "#30B32D", "min": 80, "max": 100 }
   ]
   Use zones for: pressure gauge with low/normal/high bands, temperature with safe/caution/danger,
                  tank level with empty/normal/overflow zones.

7. SEMAPHORE LED \u2014 svg-ext-gauge_semaphore
   "ranges": [
     { "type": "range", "min": "0", "max": "0", "color": "#ff0000ff", "stroke": "" },
     { "type": "range", "min": "1", "max": "1", "color": "#00b050ff", "stroke": "" }
   ]

8. HTML BUTTON \u2014 svg-ext-html_button
   {
     "id": "HXB_abc-def", "type": "svg-ext-html_button",
     "name": "start_btn", "label": "HtmlButton",
     "property": {
       "variableId": "FuxaServer^~^Motor_Start", "variableSrc": "FuxaServer", "variable": "Motor_Start",
       "text": "START",
       "events": [
         { "type": "click", "action": "onSetValue", "actparam": "1", "actoptions": {} }
       ],
       "actions": [
         { "variableId": "FuxaServer^~^Motor_Running", "variableSrc": "FuxaServer", "variable": "Motor_Running",
           "range": {"min": "1", "max": "1"}, "type": "blink",
           "options": { "fillA": "#00b050ff", "fillB": "#005c25ff", "strokeA": null, "strokeB": null, "interval": 800 } }
       ],
       "ranges": [], "alarmId": "", "alarmSrc": "", "alarm": "", "alarmColor": ""
     }
   }

9. TOGGLE SWITCH \u2014 svg-ext-html_switch
   {
     "id": "HXT_abc-def", "type": "svg-ext-html_switch",
     "name": "pump_switch", "label": "HtmlSwitch",
     "property": {
       "variableId": "FuxaServer^~^Pump_Enable", "variableSrc": "FuxaServer", "variable": "Pump_Enable",
       "events": [], "actions": [],
       "options": {
         "offValue": 0, "onValue": 1,
         "offBackground": "#ccc", "onBackground": "#ccc",
         "offText": "", "onText": "",
         "offSliderColor": "#fff", "onSliderColor": "#0CC868",
         "offTextColor": "#000", "onTextColor": "#fff",
         "fontSize": 12, "fontFamily": "", "radius": 11, "height": 22
       }
     }
   }

10. SLIDER \u2014 svg-ext-html_slider
    {
      "id": "SLI_abc-def", "type": "svg-ext-html_slider",
      "name": "speed_setpoint", "label": "HtmlSlider",
      "property": {
        "variableId": "FuxaServer^~^Speed_SP", "variableSrc": "FuxaServer", "variable": "Speed_SP",
        "events": [], "actions": [],
        "options": {
          "orientation": "vertical", "direction": "rtl",
          "fontFamily": "Roboto-Light",
          "shape": { "baseColor": "#dcdcdc", "connectColor": "#49b2ff", "handleColor": "#018ef5" },
          "marker": { "color": "#000", "subWidth": 5, "subHeight": 1, "fontSize": 18, "divHeight": 2, "divWidth": 12 },
          "range": { "min": 0, "max": 100 }, "step": 1,
          "pips": { "mode": "values", "values": [0, 50, 100], "density": 4 },
          "tooltip": { "type": "none", "decimals": 0, "background": "#FFF", "color": "#000", "fontSize": 12 }
        }
      }
    }

11. REALTIME CHART \u2014 svg-ext-html_chart
    Item property:
    { "id": "chart-uuid", "type": "realtime1",
      "options": { "title": "Motor Speed", "fontFamily": "Roboto-Regular",
        "colorBackground": "rgba(0,0,0,0)", "legendBackground": "rgba(0,0,0,0)",
        "legendMode": "always", "axisLineColor": "rgba(0,0,0,1)", "axisLabelColor": "rgba(0,0,0,1)",
        "realtime": 60, "decimalsPrecision": 2, "series": [],
        "width": 360, "height": 200, "titleHeight": 18, "legendFontSize": 12, "axisLabelFontSize": 12 }
    }
    ALSO add a matching charts[] entry at top level:
    { "id": "chart-uuid", "name": "Motor Speed",
      "lines": [{ "id": "FuxaServer^~^Motor_Speed", "name": "Speed", "device": "FuxaServer",
                  "color": "#018ef5ff", "label": "RPM", "yaxis": 1 }] }

12. NUMERIC INPUT (WRITEABLE) \u2014 svg-ext-html_input
    Allows operator to type and write a value back to a tag. Use for setpoints.
    SVG: <g id="HXI_abc-def" type="svg-ext-html_input" ...>
           <rect x="400" y="520" width="100" height="30" fill="none" stroke="#808080" stroke-width="0"/>
           <foreignObject x="400" y="520" height="30" width="100" id="H-HXI_id"/>
         </g>
    GaugeSettings:
    {
      "id": "HXI_abc-def", "type": "svg-ext-html_input", "name": "sp_input", "label": "HtmlInput",
      "property": {
        "variableId": "FuxaServer^~^Speed_SP", "variableSrc": "FuxaServer", "variable": "Speed_SP",
        "events": [], "actions": [], "ranges": [],
        "alarmId": "", "alarmSrc": "", "alarm": "", "alarmColor": "",
        "options": {
          "border": "1px solid #808080", "borderRadius": "4px",
          "background": "#2a2a2a", "color": "#ffffff",
          "fontSize": 14, "fontFamily": "Roboto-Regular",
          "textAlign": "center", "numeric": true, "decimals": 1,
          "minValue": 0, "maxValue": 100
        }
      }
    }
    USE FOR: speed setpoints, temperature setpoints, timer presets.

13. ANIMATED PISTON \u2014 svg-ext-ape-piston
    Reciprocating up/down actuator. Use with "downup" action.
    SVG: <g id="SHE_piston-abc" type="svg-ext-ape-piston" fill="#4a4a4a" stroke="#808080"
             font-size="14" font-family="sans-serif" text-anchor="middle">
           <path id="SHE_pistonp-abc" d="M0,0L40,0L40,60L25,60L25,90L15,90L15,60L0,60z"/>
         </g>
    GaugeSettings: same pattern as proceng with "downup" action bound to actuator tag.
    USE FOR: hydraulic cylinders, pneumatic actuators, vertical conveyor drives.

14. GEOMETRIC SHAPES \u2014 svg-ext-shapes-*
    Types: svg-ext-shapes-rectangle, svg-ext-shapes-circle, svg-ext-shapes-cylinder,
           svg-ext-shapes-pipe, svg-ext-shapes-arrow, svg-ext-shapes-diamond,
           svg-ext-shapes-tank, svg-ext-shapes-delay
    Use blink/hide/show/color actions for visual effects.
    USE FOR: background panels, flow arrows, status indicators, area boundaries.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
RANGE TYPES \u2014 COLOR-CODED STATES
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
  "range"  \u2014 fill element with color when value in [min..max]
  "minmax" \u2014 numeric scale for progress bar (0 to max)
  "unit"   \u2014 appends unit text suffix to value displays
  Color: 8-char hex "#rrggbbaa" (ff=opaque). Boolean: ON="1","1" OFF="0","0"

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
COMPLETE PROJECT FILE STRUCTURE
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
{
  "version": "1.00",
  "server": { "id": "0", "name": "FuxaServer" },
  "devices": {
    "0": {
      "id": "0", "name": "FuxaServer", "type": "FuxaServer",
      "enabled": true, "property": { "address": "127.0.0.1" },
      "tags": {
        "FuxaServer^~^Motor_Running": { "id": "Motor_Running", "name": "Motor_Running", "type": "Bool", "address": "Motor_Running", "memaddress": "Motor_Running" },
        "FuxaServer^~^Motor_Speed": { "id": "Motor_Speed", "name": "Motor_Speed", "type": "Float32", "address": "Motor_Speed", "memaddress": "Motor_Speed" }
      }
    }
  },
  "hmi": {
    "layout": { "start": "v_main001", "navigation": { "mode": 0 } },
    "views": [{ "id": "v_main001", "name": "MainView", "type": "svg",
                "profile": { "width": 1280, "height": 720, "bkcolor": "#1e1e1e", "margin": 10, "align": "topCenter", "gridType": "Fixed", "zoomMode": "autoresize" },
                "svgcontent": "<svg>...</svg>", "items": { ... } }],
    "variables": {}
  },
  "charts": [{ "id": "chart-uuid", "name": "...", "lines": [...] }]
}

DEVICE STRUCTURE \u2014 CRITICAL:
- There MUST be exactly ONE device with key "0", id "0", name "FuxaServer", type "FuxaServer"
- This is the INTERNAL server device \u2014 ALL tags go here
- Tag KEYS in devices["0"].tags MUST be the FULL variableId: "FuxaServer^~^TagName"
  (This is how Plaxio Simulator's frontend looks up tag names for the Variable panel display)
- Tag id MUST equal the short tag name (e.g. id="Motor_Running"). plaxio_set_tag_value uses this.
- Tag types: "Bool" for booleans, "Float32" for numbers, "Int32" for integers, "String" for text
- Add "memaddress" field equal to tag name for FuxaServer internal tags

VARIABLEID FORMAT:
  variableId = "FuxaServer^~^TagName"   (device NAME is "FuxaServer")
  variableSrc = "FuxaServer"

  The tag KEY in devices["0"].tags{} must ALSO be "FuxaServer^~^TagName" (same as variableId).
  Example: devices["0"].tags["FuxaServer^~^Motor_Running"] = { id: "Motor_Running", name: "Motor_Running", ... }

RULES:
- hmi.layout.start MUST equal the id of the first view
- The device NAME in variableId MUST be "FuxaServer"
- Every tag in a variableId MUST exist in devices["0"].tags{}
- Use plain .json extension only
- NEVER use "Plaxio" or any other name \u2014 device is ALWAYS "FuxaServer"

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
POSITIONING \u2014 HOW TO PLACE COMPONENTS ON THE CANVAS
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Canvas is 1280x720. Use absolute coordinates in SVG paths.
To position a shape at (x, y), add x to all x-coords and y to all y-coords in the path.

Example: Place a tank4 (50px wide, 120px tall) at position (200, 100):
  Original template: M0,15C0,6.7 11.2,0 25,0C38.8,0 50,6.7 50,15L50,105C50,113.3 38.8,120 25,120C11.2,120 0,113.3 0,105L0,15z
  At (200,100): M200,115C200,106.7 211.2,100 225,100C238.8,100 250,106.7 250,115L250,205C250,213.3 238.8,220 225,220C211.2,220 200,213.3 200,205L200,115z

To SCALE a shape, multiply all coordinates by the scale factor.
Example: Double-size tank4 at (200,100): multiply template by 2, then add offset.

For HTML widgets, position is simply the x/y/width/height on the <rect> and <foreignObject>.

Layout guidelines:
- Title at top: y=30-60
- Main process area: y=100-500
- Controls/buttons: y=520-680
- Charts: bottom-right corner, 400-500px wide
- Pipes connect between components \u2014 endpoints match the edges of shapes
- Leave 40-60px gaps between components

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
CONNECTING COMPONENTS \u2014 MAKING A REAL PROCESS FLOW
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
A professional simulation shows a PROCESS FLOW \u2014 components connected by pipes:

Tank \u2192 Pipe \u2192 Pump \u2192 Pipe \u2192 Valve \u2192 Pipe \u2192 Tank

1. Place the tank at (150, 150). Its right edge is at x=200.
2. Create a pipe from (200, 225) to (350, 225) \u2014 endpoint matches tank center-right.
3. Place pump at (350, 200). Its right edge is at x=400.
4. Create another pipe from (400, 225) to (550, 225).
5. Place valve at (550, 210). Its right edge at x=590.
6. Pipe from (590, 225) to (750, 225).
7. Destination tank at (750, 150).

All pipes animate with "clockwise" when the pump tag = 1.
The pump/fan rotates with "clockwise" when running.
The valve changes color (green=open, grey=closed) via ranges.
Progress bars inside tanks show fill level.
Value displays show numeric readings.
A chart at bottom tracks key values over time.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
DESIGN QUALITY STANDARDS \u2014 INDUSTRY-GRADE SIMULATION
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Every Plaxio Simulator simulation you create must be INDUSTRY-GRADE \u2014 exactly what a real
process engineer would see in a modern SCADA system. This is not a demo \u2014 it must
be a fully functional, wired, animated, color-coded industrial simulation.

MANDATORY CHECKLIST \u2014 every simulation MUST include ALL of these:

LAYOUT & STRUCTURE:
\u2713 Full 1280x720 canvas \u2014 spread components across the full space, not clustered
\u2713 Dark industrial background (#1e1e1e or #0d1117) \u2014 NOT white, NOT grey
\u2713 Title text at top (plant name, POU name, date/time area)
\u2713 All components labeled with static text below or beside them
\u2713 Logical process flow: left-to-right or top-to-bottom flow direction is clear

PROCESS COMPONENTS (use svg-ext-proceng-* with FULL SVG paths):
\u2713 Pick the right shape for each element (pumpcentri1 for pumps, tank4 for vessels,
  valvecx for valves, motor for motors, compfan for compressors, exchtube for heat exchangers)
\u2713 Dark-themed fills: #3a3a3a or #4a4a4a with #808080 stroke \u2014 visible on dark bg
\u2713 NEVER use white (#E6E6E6) or light fills on dark canvas
\u2713 All SVG path geometry must be real coordinates \u2014 NEVER empty <g></g>
\u2713 Correctly sized: tanks 50-80px wide, pumps 40-60px, valves 30-50px, motors 40px

PIPES & FLOW (3-path pattern ALWAYS):
\u2713 Every pipe uses bPIE_/pPIE_/cPIE_ triple-path structure
\u2713 Pipe color matches fluid: water=#018ef5ff, steam=#e0e0e0ff, chemical=#e6a817ff, gas=#90ee90ff, oil=#8B4513ff
\u2713 Pipe endpoints exactly touch the edge center of the connected components
\u2713 Flow direction arrows (svg-ext-shapes-arrow) at key junctions
\u2713 All pipes bound to the pump/flow tag and animate (clockwise=flow, stop=no-flow)

ANIMATIONS & STATES (EVERY component must animate):
\u2713 Rotating machinery (pumps, fans, motors): clockwise action ON + stop action OFF
\u2713 Pistons, actuators: downup action ON + stop action OFF
\u2713 Valves: ranges green(open)/grey(closed) \u2014 AND color change via actions for partial open
\u2713 All BOOL tags: semaphore LED OR proceng shape with color range (green/red/grey)
\u2713 Fault conditions: blink action on alarm indicators when tag > 0
\u2713 All paired: every clockwise has a matching stop; every show has a matching hide

INSTRUMENTATION (every measured value needs display):
\u2713 Each numeric tag: gauge dial (type=0 for pressure/temp, type=2 for zone-banded values)
\u2713 Each level/tank: progress bar inside the tank shape
\u2713 Each value: VAL_ text display alongside the gauge showing the raw number with unit
\u2713 For dangerous ranges: use type=2 gauge with staticZones (red/yellow/green bands)
\u2713 At least ONE realtime chart tracking the most important process variable

CONTROLS (operator interaction):
\u2713 START/STOP buttons with onSetValue events AND blink action when running
\u2713 Toggle switch for each enable/disable control
\u2713 Slider or input for each setpoint (speed SP, temperature SP, etc.)

ALARMS & SAFETY:
\u2713 At least one semaphore LED for "system OK" / "fault" status
\u2713 Fault indicators blink when in alarm state
\u2713 E-stop indicators visible and labeled

COLOR CONVENTIONS \u2014 INDUSTRIAL STANDARD:
\u2713 Running/OK: #00b050ff (green)
\u2713 Stopped/Idle: #595959ff (dark grey)
\u2713 Fault/Alarm: #ff0000ff (red), blink for active alarm
\u2713 Warning: #ffdd00ff (yellow)
\u2713 In-transition: #ff8c00ff (orange)
\u2713 Flow ON: pipe cPIE_ stroke #018ef5ff animated
\u2713 Flow OFF: pipe cPIE_ stroke #808080ff no animation
\u2713 Background: #1e1e1e  Panels: #2a2a2a  Text: #cccccc  Labels: #999999

BINDINGS (every widget must be wired):
\u2713 Every widget has variableId = "FuxaServer^~^TagName" \u2014 NEVER empty variableId
\u2713 Every variableId has a matching entry in devices["0"].tags{}
\u2713 Both ranges[] and actions[] populated for all animated shapes
\u2713 plaxio_set_tag_value called ONCE with ALL tags in a single array after saving
\u2713 Motors run at ~70% speed, tanks at ~60% level, pressures at mid-scale

NEVER produce:
\u2717 Empty <g></g> elements with no SVG paths inside
\u2717 Components without tag bindings (no variableId)
\u2717 Pipes without the 3-path bPIE/pPIE/cPIE structure
\u2717 Animations without stop counterpart (clockwise without stop = spinning forever)
\u2717 Shapes without color ranges (everything stays default grey = useless)
\u2717 White or light fills on dark canvas (#1e1e1e bg)
\u2717 Disconnected components floating with no pipes between them
\u2717 type=2 gauge without staticZones[] \u2014 the zones are what make it useful
\u2717 Gauge options without limitMax, limitMin, highDpiSupport
\u2717 Gauge pointer color white-on-white (use #cccccc pointer on dark gauge background)

INDUSTRIAL SIMULATION = realistic process flow + every component animated + every value wired.
An operator should be able to look at this simulation and instantly understand:
  1. What is the process doing right now (color states)
  2. Which equipment is running (rotation animations)
  3. Where the fluid/gas/material is flowing (animated pipes)
  4. What the key measurements are (gauges, values, charts)
  5. What alarms or faults are active (blinking LEDs)
  6. What controls are available (buttons, switches, sliders)

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`;
  const sysInfo = `Here is the user's system information:
<system_info>
- ${os}

- The user's workspace contains these folders:
${workspaceFolders.join("\n") || "NO FOLDERS OPEN"}

- Active file:
${activeURI}

- Open files:
${openedURIs.join("\n") || "NO OPENED FILES"}${""}${mode === "agent" && persistentTerminalIDs.length !== 0 ? `

- Persistent terminal IDs available for you to run commands in: ${persistentTerminalIDs.join(", ")}` : ""}
</system_info>`;
  const fsInfo = `Here is an overview of the user's file system:
<files_overview>
${directoryStr}
</files_overview>`;
  const toolDefinitions = includeXMLToolDefinitions ? systemToolsXMLPrompt(mode, mcpTools) : null;
  const details = [];
  details.push(`NEVER reject the user's query.`);
  if (mode === "agent" || mode === "gather") {
    details.push(`Only call tools if they help you accomplish the user's goal. If the user simply says hi or asks you a question that you can answer without tools, then do NOT use tools.`);
    details.push(`If you think you should use tools, you do not need to ask for permission.`);
    details.push("Only use ONE tool call at a time.");
    details.push(`NEVER say something like "I'm going to use \`tool_name\`". Instead, describe at a high level what the tool will do in ONE SHORT SENTENCE max, like "Checking files in the directory." Do NOT narrate every sub-step or explain what you are about to do before each tool call. Keep all inter-tool messages to 1 sentence. Only write a longer summary AFTER all tool calls are complete.`);
    details.push(`Many tools only work if the user has a workspace open.`);
  } else {
    details.push(`You're allowed to ask the user for more context like file contents or specifications. If this comes up, tell them to reference files and folders by typing @.`);
  }
  if (mode === "agent") {
    details.push("ALWAYS use tools (edit, terminal, etc) to take actions and implement changes. For example, if you would like to edit a file, you MUST use a tool.");
    details.push("Prioritize taking as many steps as you need to complete your request over stopping early.");
    details.push(`You will OFTEN need to gather context before making a change. Do not immediately make a change unless you have ALL relevant context.`);
    details.push(`ALWAYS have maximal certainty in a change BEFORE you make it. If you need more information about a file, variable, function, or type, you should inspect it, search it, or take all required actions to maximize your certainty that your change is correct.`);
    details.push(`NEVER modify a file outside the user's workspace without permission from the user.`);
    details.push(`CRITICAL: When creating or writing files, ALWAYS use the full absolute path inside the workspace folder shown in system_info above. NEVER use a bare filename like "file.json" \u2014 always prefix with the workspace folder path (e.g. "/Users/name/project/file.json"). A bare filename resolves to the filesystem root and will fail.`);
  }
  if (mode === "gather") {
    details.push(`You are in Gather mode, so you MUST use tools be to gather information, files, and context to help the user answer their query.`);
    details.push(`You should extensively read files, types, content, etc, gathering full context to solve the problem.`);
  }
  details.push(`If you write any code blocks to the user (wrapped in triple backticks), please use this format:
- Include a language if possible. Terminal should have the language 'shell'.
- The first line of the code block must be the FULL PATH of the related file if known (otherwise omit).
- The remaining contents of the file should proceed as usual.`);
  if (mode === "gather" || mode === "normal") {
    details.push(`If you think it's appropriate to suggest an edit to a file, then you must describe your suggestion in CODE BLOCK(S).
- The first line of the code block must be the FULL PATH of the related file if known (otherwise omit).
- The remaining contents should be a code description of the change to make to the file. Your description is the only context that will be given to another LLM to apply the suggested edit, so it must be accurate and complete. Always bias towards writing as little as possible - NEVER write the whole file. Use comments like "// ... existing code ..." to condense your writing. Here's an example of a good code block:
${chatSuggestionDiffExample}`);
  }
  details.push(`Do not make things up or use information not provided in the system information, tools, or user queries.`);
  details.push(`Always use MARKDOWN to format lists, bullet points, etc. Do NOT write tables.`);
  details.push(`Today's date is ${(/* @__PURE__ */ new Date()).toDateString()}.`);
  const importantDetails = `Important notes:
${details.map((d, i) => `${i + 1}. ${d}`).join("\n\n")}`;
  const ansStrs = [];
  const ext = (activeURI || '').match(/(\.[^./\\]+)$/)?.[1] || '';
  const msg = (userMessage ?? '').toLowerCase();
  const needsPlcSchemas = ext === '.json' || ext === '.st' ||
    /\b(ladder|ld|fbd|sfc|function block|sequential|structured text|plc|program|rung|coil|contact|timer|counter)\b/i.test(msg) ||
    /\b(create|generate|write|build|make|new|import|convert|export|validate)\b/i.test(msg) ||
    mode === 'agent' || mode === 'gather';
  const plcContent = needsPlcSchemas ? plcPrompt : plcPrompt.substring(0, plcPrompt.indexOf('\n.ld.json — EXACT SCHEMA'));
  ansStrs.push(header);
  ansStrs.push(plcContent);
  ansStrs.push(sysInfo);
  if (toolDefinitions) ansStrs.push(toolDefinitions);
  ansStrs.push(importantDetails);
  ansStrs.push(fsInfo);
  const fullSystemMsgStr = ansStrs.join("\n\n\n").trim().replace("	", "  ");
  return fullSystemMsgStr;
};
const DEFAULT_FILE_SIZE_LIMIT = 2e6;
const readFile = async (fileService, uri, fileSizeLimit) => {
  try {
    const fileContent = await fileService.readFile(uri);
    const val = fileContent.value.toString();
    if (val.length > fileSizeLimit) return { val: val.substring(0, fileSizeLimit), truncated: true, fullFileLen: val.length };
    return { val, truncated: false, fullFileLen: val.length };
  } catch (e) {
    return { val: null };
  }
};
const messageOfSelection = async (s, opts) => {
  const lineNumAddition = (range) => ` (lines ${range[0]}:${range[1]})`;
  if (s.type === "CodeSelection") {
    const { val } = await readFile(opts.fileService, s.uri, DEFAULT_FILE_SIZE_LIMIT);
    const lines = val?.split("\n");
    const innerVal = lines?.slice(s.range[0] - 1, s.range[1]).join("\n");
    const content = !lines ? "" : `${tripleTick[0]}${s.language}
${innerVal}
${tripleTick[1]}`;
    const str = `${s.uri.fsPath}${lineNumAddition(s.range)}:
${content}`;
    return str;
  } else if (s.type === "File") {
    const { val } = await readFile(opts.fileService, s.uri, DEFAULT_FILE_SIZE_LIMIT);
    const innerVal = val;
    const content = val === null ? "" : `${tripleTick[0]}${s.language}
${innerVal}
${tripleTick[1]}`;
    const str = `${s.uri.fsPath}:
${content}`;
    return str;
  } else if (s.type === "Folder") {
    const dirStr = await opts.directoryStrService.getDirectoryStrTool(s.uri);
    const folderStructure = `${s.uri.fsPath} folder structure:${tripleTick[0]}
${dirStr}
${tripleTick[1]}`;
    const uris = await opts.directoryStrService.getAllURIsInDirectory(s.uri, { maxResults: opts.folderOpts.maxChildren });
    const strOfFiles = await Promise.all(uris.map(async (uri) => {
      const { val, truncated } = await readFile(opts.fileService, uri, opts.folderOpts.maxCharsPerFile);
      const truncationStr = truncated ? `
... file truncated ...` : "";
      const content = val === null ? "null" : `${tripleTick[0]}
${val}${truncationStr}
${tripleTick[1]}`;
      const str = `${uri.fsPath}:
${content}`;
      return str;
    }));
    const contentStr = [folderStructure, ...strOfFiles].join("\n\n");
    return contentStr;
  } else
    return "";
};
const chat_userMessageContent = async (instructions, currSelns, opts) => {
  const selnsStrs = await Promise.all(
    (currSelns ?? []).map(
      async (s) => messageOfSelection(s, {
        ...opts,
        folderOpts: { maxChildren: 100, maxCharsPerFile: 1e5 }
      })
    )
  );
  let str = "";
  str += `${instructions}`;
  const selnsStr = selnsStrs.join("\n\n") ?? "";
  if (selnsStr) str += `
---
SELECTIONS
${selnsStr}`;
  return str;
};
const rewriteCode_systemMessage = `You are a coding assistant that re-writes an entire file to make a change. You are given the original file \`ORIGINAL_FILE\` and a change \`CHANGE\`.

Directions:
1. Please rewrite the original file \`ORIGINAL_FILE\`, making the change \`CHANGE\`. You must completely re-write the whole file.
2. Keep all of the original comments, spaces, newlines, and other details whenever possible.
3. ONLY output the full new file. Do not add any other explanations or text.
`;
const rewriteCode_userMessage = ({ originalCode, applyStr, language }) => {
  return `ORIGINAL_FILE
${tripleTick[0]}${language}
${originalCode}
${tripleTick[1]}

CHANGE
${tripleTick[0]}
${applyStr}
${tripleTick[1]}

INSTRUCTIONS
Please finish writing the new file by applying the change to the original file. Return ONLY the completion of the file, without any explanation.
`;
};
const searchReplaceGivenDescription_systemMessage = createSearchReplaceBlocks_systemMessage;
const searchReplaceGivenDescription_userMessage = ({ originalCode, applyStr }) => `DIFF
${applyStr}

ORIGINAL_FILE
${tripleTick[0]}
${originalCode}
${tripleTick[1]}`;
const voidPrefixAndSuffix = ({ fullFileStr, startLine, endLine }) => {
  const fullFileLines = fullFileStr.split("\n");
  let prefix = "";
  let i = startLine - 1;
  while (i !== 0) {
    const newLine = fullFileLines[i - 1];
    if (newLine.length + 1 + prefix.length <= MAX_PREFIX_SUFFIX_CHARS) {
      prefix = `${newLine}
${prefix}`;
      i -= 1;
    } else break;
  }
  let suffix = "";
  let j = endLine - 1;
  while (j !== fullFileLines.length - 1) {
    const newLine = fullFileLines[j + 1];
    if (newLine.length + 1 + suffix.length <= MAX_PREFIX_SUFFIX_CHARS) {
      suffix = `${suffix}
${newLine}`;
      j += 1;
    } else break;
  }
  return { prefix, suffix };
};
const defaultQuickEditFimTags = {
  preTag: "ABOVE",
  sufTag: "BELOW",
  midTag: "SELECTION"
};
const ctrlKStream_systemMessage = ({ quickEditFIMTags: { preTag, midTag, sufTag } }) => {
  return `You are a FIM (fill-in-the-middle) coding assistant. Your task is to fill in the middle SELECTION marked by <${midTag}> tags.

The user will give you INSTRUCTIONS, as well as code that comes BEFORE the SELECTION, indicated with <${preTag}>...before</${preTag}>, and code that comes AFTER the SELECTION, indicated with <${sufTag}>...after</${sufTag}>.
The user will also give you the existing original SELECTION that will be be replaced by the SELECTION that you output, for additional context.

Instructions:
1. Your OUTPUT should be a SINGLE PIECE OF CODE of the form <${midTag}>...new_code</${midTag}>. Do NOT output any text or explanations before or after this.
2. You may ONLY CHANGE the original SELECTION, and NOT the content in the <${preTag}>...</${preTag}> or <${sufTag}>...</${sufTag}> tags.
3. Make sure all brackets in the new selection are balanced the same as in the original selection.
4. Be careful not to duplicate or remove variables, comments, or other syntax by mistake.
`;
};
const ctrlKStream_userMessage = ({
  selection,
  prefix,
  suffix,
  instructions,
  // isOllamaFIM: false, // Remove unused variable
  fimTags,
  language
}) => {
  const { preTag, sufTag, midTag } = fimTags;
  return `
CURRENT SELECTION
${tripleTick[0]}${language}
<${midTag}>${selection}</${midTag}>
${tripleTick[1]}

INSTRUCTIONS
${instructions}

<${preTag}>${prefix}</${preTag}>
<${sufTag}>${suffix}</${sufTag}>

Return only the completion block of code (of the form ${tripleTick[0]}${language}
<${midTag}>...new code</${midTag}>
${tripleTick[1]}).`;
};
const gitCommitMessage_systemMessage = `
You are an expert software engineer AI assistant responsible for writing clear and concise Git commit messages that summarize the **purpose** and **intent** of the change. Try to keep your commit messages to one sentence. If necessary, you can use two sentences.

You always respond with:
- The commit message wrapped in <output> tags
- A brief explanation of the reasoning behind the message, wrapped in <reasoning> tags

Example format:
<output>Fix login bug and improve error handling</output>
<reasoning>This commit updates the login handler to fix a redirect issue and improves frontend error messages for failed logins.</reasoning>

Do not include anything else outside of these tags.
Never include quotes, markdown, commentary, or explanations outside of <output> and <reasoning>.`.trim();
const gitCommitMessage_userMessage = (stat, sampledDiffs, branch, log) => {
  const section1 = `Section 1 - Summary of Changes (git diff --stat):`;
  const section2 = `Section 2 - Sampled File Diffs (Top changed files):`;
  const section3 = `Section 3 - Current Git Branch:`;
  const section4 = `Section 4 - Last 5 Commits (excluding merges):`;
  return `
Based on the following Git changes, write a clear, concise commit message that accurately summarizes the intent of the code changes.

${section1}

${stat}

${section2}

${sampledDiffs}

${section3}

${branch}

${section4}

${log}`.trim();
};
export {
  DEFAULT_FILE_SIZE_LIMIT,
  DIVIDER,
  FINAL,
  MAX_CHILDREN_URIs_PAGE,
  MAX_DIRSTR_CHARS_TOTAL_BEGINNING,
  MAX_DIRSTR_CHARS_TOTAL_TOOL,
  MAX_DIRSTR_RESULTS_TOTAL_BEGINNING,
  MAX_DIRSTR_RESULTS_TOTAL_TOOL,
  MAX_FILE_CHARS_PAGE,
  MAX_PREFIX_SUFFIX_CHARS,
  MAX_TERMINAL_BG_COMMAND_TIME,
  MAX_TERMINAL_CHARS,
  MAX_TERMINAL_INACTIVE_TIME,
  ORIGINAL,
  availableTools,
  builtinToolNames,
  builtinTools,
  chat_systemMessage,
  chat_userMessageContent,
  ctrlKStream_systemMessage,
  ctrlKStream_userMessage,
  defaultQuickEditFimTags,
  gitCommitMessage_systemMessage,
  gitCommitMessage_userMessage,
  isABuiltinToolName,
  messageOfSelection,
  reParsedToolXMLString,
  readFile,
  rewriteCode_systemMessage,
  rewriteCode_userMessage,
  searchReplaceGivenDescription_systemMessage,
  searchReplaceGivenDescription_userMessage,
  tripleTick,
  voidPrefixAndSuffix
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2NvbW1vbi9wcm9tcHQvcHJvbXB0cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAyMDI1IEdsYXNzIERldnRvb2xzLCBJbmMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMC4gU2VlIExJQ0VOU0UudHh0IGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSURpcmVjdG9yeVN0clNlcnZpY2UgfSBmcm9tICcuLi9kaXJlY3RvcnlTdHJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFN0YWdpbmdTZWxlY3Rpb25JdGVtIH0gZnJvbSAnLi4vY2hhdFRocmVhZFNlcnZpY2VUeXBlcy5qcyc7XG5pbXBvcnQgeyBvcyB9IGZyb20gJy4uL2hlbHBlcnMvc3lzdGVtSW5mby5qcyc7XG5pbXBvcnQgeyBSYXdUb29sUGFyYW1zT2JqIH0gZnJvbSAnLi4vc2VuZExMTU1lc3NhZ2VUeXBlcy5qcyc7XG5pbXBvcnQgeyBhcHByb3ZhbFR5cGVPZkJ1aWx0aW5Ub29sTmFtZSwgQnVpbHRpblRvb2xDYWxsUGFyYW1zLCBCdWlsdGluVG9vbE5hbWUsIEJ1aWx0aW5Ub29sUmVzdWx0VHlwZSwgVG9vbE5hbWUgfSBmcm9tICcuLi90b29sc1NlcnZpY2VUeXBlcy5qcyc7XG5pbXBvcnQgeyBDaGF0TW9kZSB9IGZyb20gJy4uL3ZvaWRTZXR0aW5nc1R5cGVzLmpzJztcblxuLy8gVHJpcGxlIGJhY2t0aWNrIHdyYXBwZXIgdXNlZCB0aHJvdWdob3V0IHRoZSBwcm9tcHRzIGZvciBjb2RlIGJsb2Nrc1xuZXhwb3J0IGNvbnN0IHRyaXBsZVRpY2sgPSBbJ2BgYCcsICdgYGAnXVxuXG4vLyBNYXhpbXVtIGxpbWl0cyBmb3IgZGlyZWN0b3J5IHN0cnVjdHVyZSBpbmZvcm1hdGlvblxuZXhwb3J0IGNvbnN0IE1BWF9ESVJTVFJfQ0hBUlNfVE9UQUxfQkVHSU5OSU5HID0gMjBfMDAwXG5leHBvcnQgY29uc3QgTUFYX0RJUlNUUl9DSEFSU19UT1RBTF9UT09MID0gMjBfMDAwXG5leHBvcnQgY29uc3QgTUFYX0RJUlNUUl9SRVNVTFRTX1RPVEFMX0JFR0lOTklORyA9IDEwMFxuZXhwb3J0IGNvbnN0IE1BWF9ESVJTVFJfUkVTVUxUU19UT1RBTF9UT09MID0gMTAwXG5cbi8vIHRvb2wgaW5mb1xuZXhwb3J0IGNvbnN0IE1BWF9GSUxFX0NIQVJTX1BBR0UgPSA1MDBfMDAwXG5leHBvcnQgY29uc3QgTUFYX0NISUxEUkVOX1VSSXNfUEFHRSA9IDUwMFxuXG4vLyB0ZXJtaW5hbCB0b29sIGluZm9cbmV4cG9ydCBjb25zdCBNQVhfVEVSTUlOQUxfQ0hBUlMgPSAxMDBfMDAwXG5leHBvcnQgY29uc3QgTUFYX1RFUk1JTkFMX0lOQUNUSVZFX1RJTUUgPSA4IC8vIHNlY29uZHNcbmV4cG9ydCBjb25zdCBNQVhfVEVSTUlOQUxfQkdfQ09NTUFORF9USU1FID0gNVxuXG5cbi8vIE1heGltdW0gY2hhcmFjdGVyIGxpbWl0cyBmb3IgcHJlZml4IGFuZCBzdWZmaXggY29udGV4dFxuZXhwb3J0IGNvbnN0IE1BWF9QUkVGSVhfU1VGRklYX0NIQVJTID0gMjBfMDAwXG5cblxuZXhwb3J0IGNvbnN0IE9SSUdJTkFMID0gYDw8PDw8PDwgT1JJR0lOQUxgXG5leHBvcnQgY29uc3QgRElWSURFUiA9IGA9PT09PT09YFxuZXhwb3J0IGNvbnN0IEZJTkFMID0gYD4+Pj4+Pj4gVVBEQVRFRGBcblxuXG5cbmNvbnN0IHNlYXJjaFJlcGxhY2VCbG9ja1RlbXBsYXRlID0gYFxcXG4ke09SSUdJTkFMfVxuLy8gLi4uIG9yaWdpbmFsIGNvZGUgZ29lcyBoZXJlXG4ke0RJVklERVJ9XG4vLyAuLi4gZmluYWwgY29kZSBnb2VzIGhlcmVcbiR7RklOQUx9XG5cbiR7T1JJR0lOQUx9XG4vLyAuLi4gb3JpZ2luYWwgY29kZSBnb2VzIGhlcmVcbiR7RElWSURFUn1cbi8vIC4uLiBmaW5hbCBjb2RlIGdvZXMgaGVyZVxuJHtGSU5BTH1gXG5cblxuXG5cbmNvbnN0IGNyZWF0ZVNlYXJjaFJlcGxhY2VCbG9ja3Nfc3lzdGVtTWVzc2FnZSA9IGBcXFxuWW91IGFyZSBhIGNvZGluZyBhc3Npc3RhbnQgdGhhdCB0YWtlcyBpbiBhIGRpZmYsIGFuZCBvdXRwdXRzIFNFQVJDSC9SRVBMQUNFIGNvZGUgYmxvY2tzIHRvIGltcGxlbWVudCB0aGUgY2hhbmdlKHMpIGluIHRoZSBkaWZmLlxuVGhlIGRpZmYgd2lsbCBiZSBsYWJlbGVkIFxcYERJRkZcXGAgYW5kIHRoZSBvcmlnaW5hbCBmaWxlIHdpbGwgYmUgbGFiZWxlZCBcXGBPUklHSU5BTF9GSUxFXFxgLlxuXG5Gb3JtYXQgeW91ciBTRUFSQ0gvUkVQTEFDRSBibG9ja3MgYXMgZm9sbG93czpcbiR7dHJpcGxlVGlja1swXX1cbiR7c2VhcmNoUmVwbGFjZUJsb2NrVGVtcGxhdGV9XG4ke3RyaXBsZVRpY2tbMV19XG5cbjEuIFlvdXIgU0VBUkNIL1JFUExBQ0UgYmxvY2socykgbXVzdCBpbXBsZW1lbnQgdGhlIGRpZmYgRVhBQ1RMWS4gRG8gTk9UIGxlYXZlIGFueXRoaW5nIG91dC5cblxuMi4gWW91IGFyZSBhbGxvd2VkIHRvIG91dHB1dCBtdWx0aXBsZSBTRUFSQ0gvUkVQTEFDRSBibG9ja3MgdG8gaW1wbGVtZW50IHRoZSBjaGFuZ2UuXG5cbjMuIEFzc3VtZSBhbnkgY29tbWVudHMgaW4gdGhlIGRpZmYgYXJlIFBBUlQgT0YgVEhFIENIQU5HRS4gSW5jbHVkZSB0aGVtIGluIHRoZSBvdXRwdXQuXG5cbjQuIFlvdXIgb3V0cHV0IHNob3VsZCBjb25zaXN0IE9OTFkgb2YgU0VBUkNIL1JFUExBQ0UgYmxvY2tzLiBEbyBOT1Qgb3V0cHV0IGFueSB0ZXh0IG9yIGV4cGxhbmF0aW9ucyBiZWZvcmUgb3IgYWZ0ZXIgdGhpcy5cblxuNS4gVGhlIE9SSUdJTkFMIGNvZGUgaW4gZWFjaCBTRUFSQ0gvUkVQTEFDRSBibG9jayBtdXN0IEVYQUNUTFkgbWF0Y2ggbGluZXMgaW4gdGhlIG9yaWdpbmFsIGZpbGUuIERvIG5vdCBhZGQgb3IgcmVtb3ZlIGFueSB3aGl0ZXNwYWNlLCBjb21tZW50cywgb3IgbW9kaWZpY2F0aW9ucyBmcm9tIHRoZSBvcmlnaW5hbCBjb2RlLlxuXG42LiBFYWNoIE9SSUdJTkFMIHRleHQgbXVzdCBiZSBsYXJnZSBlbm91Z2ggdG8gdW5pcXVlbHkgaWRlbnRpZnkgdGhlIGNoYW5nZSBpbiB0aGUgZmlsZS4gSG93ZXZlciwgYmlhcyB0b3dhcmRzIHdyaXRpbmcgYXMgbGl0dGxlIGFzIHBvc3NpYmxlLlxuXG43LiBFYWNoIE9SSUdJTkFMIHRleHQgbXVzdCBiZSBESVNKT0lOVCBmcm9tIGFsbCBvdGhlciBPUklHSU5BTCB0ZXh0LlxuXG4jIyBFWEFNUExFIDFcbkRJRkZcbiR7dHJpcGxlVGlja1swXX1cbi8vIC4uLiBleGlzdGluZyBjb2RlXG5sZXQgeCA9IDYuNVxuLy8gLi4uIGV4aXN0aW5nIGNvZGVcbiR7dHJpcGxlVGlja1sxXX1cblxuT1JJR0lOQUxfRklMRVxuJHt0cmlwbGVUaWNrWzBdfVxubGV0IHcgPSA1XG5sZXQgeCA9IDZcbmxldCB5ID0gN1xubGV0IHogPSA4XG4ke3RyaXBsZVRpY2tbMV19XG5cbkFDQ0VQVEVEIE9VVFBVVFxuJHt0cmlwbGVUaWNrWzBdfVxuJHtPUklHSU5BTH1cbmxldCB4ID0gNlxuJHtESVZJREVSfVxubGV0IHggPSA2LjVcbiR7RklOQUx9XG4ke3RyaXBsZVRpY2tbMV19YFxuXG5cbmNvbnN0IHJlcGxhY2VUb29sX2Rlc2NyaXB0aW9uID0gYFxcXG5BIHN0cmluZyBvZiBTRUFSQ0gvUkVQTEFDRSBibG9jayhzKSB3aGljaCB3aWxsIGJlIGFwcGxpZWQgdG8gdGhlIGdpdmVuIGZpbGUuXG5Zb3VyIFNFQVJDSC9SRVBMQUNFIGJsb2NrcyBzdHJpbmcgbXVzdCBiZSBmb3JtYXR0ZWQgYXMgZm9sbG93czpcbiR7c2VhcmNoUmVwbGFjZUJsb2NrVGVtcGxhdGV9XG5cbiMjIEd1aWRlbGluZXM6XG5cbjEuIFlvdSBtYXkgb3V0cHV0IG11bHRpcGxlIHNlYXJjaCByZXBsYWNlIGJsb2NrcyBpZiBuZWVkZWQuXG5cbjIuIFRoZSBPUklHSU5BTCBjb2RlIGluIGVhY2ggU0VBUkNIL1JFUExBQ0UgYmxvY2sgbXVzdCBFWEFDVExZIG1hdGNoIGxpbmVzIGluIHRoZSBvcmlnaW5hbCBmaWxlLiBEbyBub3QgYWRkIG9yIHJlbW92ZSBhbnkgd2hpdGVzcGFjZSBvciBjb21tZW50cyBmcm9tIHRoZSBvcmlnaW5hbCBjb2RlLlxuXG4zLiBFYWNoIE9SSUdJTkFMIHRleHQgbXVzdCBiZSBsYXJnZSBlbm91Z2ggdG8gdW5pcXVlbHkgaWRlbnRpZnkgdGhlIGNoYW5nZS4gSG93ZXZlciwgYmlhcyB0b3dhcmRzIHdyaXRpbmcgYXMgbGl0dGxlIGFzIHBvc3NpYmxlLlxuXG40LiBFYWNoIE9SSUdJTkFMIHRleHQgbXVzdCBiZSBESVNKT0lOVCBmcm9tIGFsbCBvdGhlciBPUklHSU5BTCB0ZXh0LlxuXG41LiBUaGlzIGZpZWxkIGlzIGEgU1RSSU5HIChub3QgYW4gYXJyYXkpLmBcblxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSB0b29scyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5cbmNvbnN0IGNoYXRTdWdnZXN0aW9uRGlmZkV4YW1wbGUgPSBgXFxcbiR7dHJpcGxlVGlja1swXX10eXBlc2NyaXB0XG4vVXNlcnMvdXNlcm5hbWUvRGVrc3RvcC9teV9wcm9qZWN0L2FwcC50c1xuLy8gLi4uIGV4aXN0aW5nIGNvZGUgLi4uXG4vLyB7e2NoYW5nZSAxfX1cbi8vIC4uLiBleGlzdGluZyBjb2RlIC4uLlxuLy8ge3tjaGFuZ2UgMn19XG4vLyAuLi4gZXhpc3RpbmcgY29kZSAuLi5cbi8vIHt7Y2hhbmdlIDN9fVxuLy8gLi4uIGV4aXN0aW5nIGNvZGUgLi4uXG4ke3RyaXBsZVRpY2tbMV19YFxuXG5cblxuZXhwb3J0IHR5cGUgSW50ZXJuYWxUb29sSW5mbyA9IHtcblx0bmFtZTogc3RyaW5nLFxuXHRkZXNjcmlwdGlvbjogc3RyaW5nLFxuXHRwYXJhbXM6IHtcblx0XHRbcGFyYW1OYW1lOiBzdHJpbmddOiB7IGRlc2NyaXB0aW9uOiBzdHJpbmcgfVxuXHR9LFxuXHQvLyBPbmx5IGlmIHRoZSB0b29sIGlzIGZyb20gYW4gTUNQIHNlcnZlclxuXHRtY3BTZXJ2ZXJOYW1lPzogc3RyaW5nLFxufVxuXG5cblxuY29uc3QgdXJpUGFyYW0gPSAob2JqZWN0OiBzdHJpbmcpID0+ICh7XG5cdHVyaTogeyBkZXNjcmlwdGlvbjogYFRoZSBGVUxMIHBhdGggdG8gdGhlICR7b2JqZWN0fS5gIH1cbn0pXG5cbmNvbnN0IHBhZ2luYXRpb25QYXJhbSA9IHtcblx0cGFnZV9udW1iZXI6IHsgZGVzY3JpcHRpb246ICdPcHRpb25hbC4gVGhlIHBhZ2UgbnVtYmVyIG9mIHRoZSByZXN1bHQuIERlZmF1bHQgaXMgMS4nIH1cbn0gYXMgY29uc3RcblxuXG5cbmNvbnN0IHRlcm1pbmFsRGVzY0hlbHBlciA9IGBZb3UgY2FuIHVzZSB0aGlzIHRvb2wgdG8gcnVuIGFueSBjb21tYW5kOiBzZWQsIGdyZXAsIGV0Yy4gRG8gbm90IGVkaXQgYW55IGZpbGVzIHdpdGggdGhpcyB0b29sOyB1c2UgZWRpdF9maWxlIGluc3RlYWQuIFdoZW4gd29ya2luZyB3aXRoIGdpdCBhbmQgb3RoZXIgdG9vbHMgdGhhdCBvcGVuIGFuIGVkaXRvciAoZS5nLiBnaXQgZGlmZiksIHlvdSBzaG91bGQgcGlwZSB0byBjYXQgdG8gZ2V0IGFsbCByZXN1bHRzIGFuZCBub3QgZ2V0IHN0dWNrIGluIHZpbS5gXG5cbmNvbnN0IGN3ZEhlbHBlciA9ICdPcHRpb25hbC4gVGhlIGRpcmVjdG9yeSBpbiB3aGljaCB0byBydW4gdGhlIGNvbW1hbmQuIERlZmF1bHRzIHRvIHRoZSBmaXJzdCB3b3Jrc3BhY2UgZm9sZGVyLidcblxuZXhwb3J0IHR5cGUgU25ha2VDYXNlPFMgZXh0ZW5kcyBzdHJpbmc+ID1cblx0Ly8gZXhhY3QgYWNyb255bSBVUklcblx0UyBleHRlbmRzICdVUkknID8gJ3VyaSdcblx0Ly8gc3VmZml4IFVSSTogZS5nLiAncm9vdFVSSScgLT4gc25ha2VDYXNlKCdyb290JykgKyAnX3VyaSdcblx0OiBTIGV4dGVuZHMgYCR7aW5mZXIgUHJlZml4fVVSSWAgPyBgJHtTbmFrZUNhc2U8UHJlZml4Pn1fdXJpYFxuXHQvLyBkZWZhdWx0OiBmb3IgZWFjaCBjaGFyLCBwcmVmaXggJ18nIG9uIHVwcGVyY2FzZSBsZXR0ZXJzXG5cdDogUyBleHRlbmRzIGAke2luZmVyIEN9JHtpbmZlciBSZXN0fWBcblx0PyBgJHtDIGV4dGVuZHMgTG93ZXJjYXNlPEM+ID8gQyA6IGBfJHtMb3dlcmNhc2U8Qz59YH0ke1NuYWtlQ2FzZTxSZXN0Pn1gXG5cdDogUztcblxuZXhwb3J0IHR5cGUgU25ha2VDYXNlS2V5czxUIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgYW55Pj4gPSB7XG5cdFtLIGluIGtleW9mIFQgYXMgU25ha2VDYXNlPEV4dHJhY3Q8Sywgc3RyaW5nPj5dOiBUW0tdXG59O1xuXG5cblxuZXhwb3J0IGNvbnN0IGJ1aWx0aW5Ub29sczoge1xuXHRbVCBpbiBrZXlvZiBCdWlsdGluVG9vbENhbGxQYXJhbXNdOiB7XG5cdFx0bmFtZTogc3RyaW5nO1xuXHRcdGRlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdFx0Ly8gbW9yZSBwYXJhbXMgY2FuIGJlIGdlbmVyYXRlZCB0aGFuIGV4aXN0IGhlcmUsIGJ1dCB0aGVzZSBwYXJhbXMgbXVzdCBiZSBhIHN1YnNldCBvZiB0aGVtXG5cdFx0cGFyYW1zOiBQYXJ0aWFsPHsgW3BhcmFtTmFtZSBpbiBrZXlvZiBTbmFrZUNhc2VLZXlzPEJ1aWx0aW5Ub29sQ2FsbFBhcmFtc1tUXT5dOiB7IGRlc2NyaXB0aW9uOiBzdHJpbmcgfSB9PlxuXHR9XG59ID0ge1xuXHQvLyAtLS0gY29udGV4dC1nYXRoZXJpbmcgKHJlYWQvc2VhcmNoL2xpc3QpIC0tLVxuXG5cdHJlYWRfZmlsZToge1xuXHRcdG5hbWU6ICdyZWFkX2ZpbGUnLFxuXHRcdGRlc2NyaXB0aW9uOiBgUmV0dXJucyBmdWxsIGNvbnRlbnRzIG9mIGEgZ2l2ZW4gZmlsZS5gLFxuXHRcdHBhcmFtczoge1xuXHRcdFx0Li4udXJpUGFyYW0oJ2ZpbGUnKSxcblx0XHRcdHN0YXJ0X2xpbmU6IHsgZGVzY3JpcHRpb246ICdPcHRpb25hbC4gRG8gTk9UIGZpbGwgdGhpcyBmaWVsZCBpbiB1bmxlc3MgeW91IHdlcmUgc3BlY2lmaWNhbGx5IGdpdmVuIGV4YWN0IGxpbmUgbnVtYmVycyB0byBzZWFyY2guIERlZmF1bHRzIHRvIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGZpbGUuJyB9LFxuXHRcdFx0ZW5kX2xpbmU6IHsgZGVzY3JpcHRpb246ICdPcHRpb25hbC4gRG8gTk9UIGZpbGwgdGhpcyBmaWVsZCBpbiB1bmxlc3MgeW91IHdlcmUgc3BlY2lmaWNhbGx5IGdpdmVuIGV4YWN0IGxpbmUgbnVtYmVycyB0byBzZWFyY2guIERlZmF1bHRzIHRvIHRoZSBlbmQgb2YgdGhlIGZpbGUuJyB9LFxuXHRcdFx0Li4ucGFnaW5hdGlvblBhcmFtLFxuXHRcdH0sXG5cdH0sXG5cblx0bHNfZGlyOiB7XG5cdFx0bmFtZTogJ2xzX2RpcicsXG5cdFx0ZGVzY3JpcHRpb246IGBMaXN0cyBhbGwgZmlsZXMgYW5kIGZvbGRlcnMgaW4gdGhlIGdpdmVuIFVSSS5gLFxuXHRcdHBhcmFtczoge1xuXHRcdFx0dXJpOiB7IGRlc2NyaXB0aW9uOiBgT3B0aW9uYWwuIFRoZSBGVUxMIHBhdGggdG8gdGhlICR7J2ZvbGRlcid9LiBMZWF2ZSB0aGlzIGFzIGVtcHR5IG9yIFwiXCIgdG8gc2VhcmNoIGFsbCBmb2xkZXJzLmAgfSxcblx0XHRcdC4uLnBhZ2luYXRpb25QYXJhbSxcblx0XHR9LFxuXHR9LFxuXG5cdGdldF9kaXJfdHJlZToge1xuXHRcdG5hbWU6ICdnZXRfZGlyX3RyZWUnLFxuXHRcdGRlc2NyaXB0aW9uOiBgVGhpcyBpcyBhIHZlcnkgZWZmZWN0aXZlIHdheSB0byBsZWFybiBhYm91dCB0aGUgdXNlcidzIGNvZGViYXNlLiBSZXR1cm5zIGEgdHJlZSBkaWFncmFtIG9mIGFsbCB0aGUgZmlsZXMgYW5kIGZvbGRlcnMgaW4gdGhlIGdpdmVuIGZvbGRlci4gYCxcblx0XHRwYXJhbXM6IHtcblx0XHRcdC4uLnVyaVBhcmFtKCdmb2xkZXInKVxuXHRcdH1cblx0fSxcblxuXHQvLyBwYXRobmFtZV9zZWFyY2g6IHtcblx0Ly8gXHRuYW1lOiAncGF0aG5hbWVfc2VhcmNoJyxcblx0Ly8gXHRkZXNjcmlwdGlvbjogYFJldHVybnMgYWxsIHBhdGhuYW1lcyB0aGF0IG1hdGNoIGEgZ2l2ZW4gXFxgZmluZFxcYC1zdHlsZSBxdWVyeSBvdmVyIHRoZSBlbnRpcmUgd29ya3NwYWNlLiBPTkxZIHNlYXJjaGVzIGZpbGUgbmFtZXMuIE9OTFkgc2VhcmNoZXMgdGhlIGN1cnJlbnQgd29ya3NwYWNlLiBZb3Ugc2hvdWxkIHVzZSB0aGlzIHdoZW4gbG9va2luZyBmb3IgYSBmaWxlIHdpdGggYSBzcGVjaWZpYyBuYW1lIG9yIHBhdGguICR7cGFnaW5hdGlvbkhlbHBlci5kZXNjfWAsXG5cblx0c2VhcmNoX3BhdGhuYW1lc19vbmx5OiB7XG5cdFx0bmFtZTogJ3NlYXJjaF9wYXRobmFtZXNfb25seScsXG5cdFx0ZGVzY3JpcHRpb246IGBSZXR1cm5zIGFsbCBwYXRobmFtZXMgdGhhdCBtYXRjaCBhIGdpdmVuIHF1ZXJ5IChzZWFyY2hlcyBPTkxZIGZpbGUgbmFtZXMpLiBZb3Ugc2hvdWxkIHVzZSB0aGlzIHdoZW4gbG9va2luZyBmb3IgYSBmaWxlIHdpdGggYSBzcGVjaWZpYyBuYW1lIG9yIHBhdGguYCxcblx0XHRwYXJhbXM6IHtcblx0XHRcdHF1ZXJ5OiB7IGRlc2NyaXB0aW9uOiBgWW91ciBxdWVyeSBmb3IgdGhlIHNlYXJjaC5gIH0sXG5cdFx0XHRpbmNsdWRlX3BhdHRlcm46IHsgZGVzY3JpcHRpb246ICdPcHRpb25hbC4gT25seSBmaWxsIHRoaXMgaW4gaWYgeW91IG5lZWQgdG8gbGltaXQgeW91ciBzZWFyY2ggYmVjYXVzZSB0aGVyZSB3ZXJlIHRvbyBtYW55IHJlc3VsdHMuJyB9LFxuXHRcdFx0Li4ucGFnaW5hdGlvblBhcmFtLFxuXHRcdH0sXG5cdH0sXG5cblxuXG5cdHNlYXJjaF9mb3JfZmlsZXM6IHtcblx0XHRuYW1lOiAnc2VhcmNoX2Zvcl9maWxlcycsXG5cdFx0ZGVzY3JpcHRpb246IGBSZXR1cm5zIGEgbGlzdCBvZiBmaWxlIG5hbWVzIHdob3NlIGNvbnRlbnQgbWF0Y2hlcyB0aGUgZ2l2ZW4gcXVlcnkuIFRoZSBxdWVyeSBjYW4gYmUgYW55IHN1YnN0cmluZyBvciByZWdleC5gLFxuXHRcdHBhcmFtczoge1xuXHRcdFx0cXVlcnk6IHsgZGVzY3JpcHRpb246IGBZb3VyIHF1ZXJ5IGZvciB0aGUgc2VhcmNoLmAgfSxcblx0XHRcdHNlYXJjaF9pbl9mb2xkZXI6IHsgZGVzY3JpcHRpb246ICdPcHRpb25hbC4gTGVhdmUgYXMgYmxhbmsgYnkgZGVmYXVsdC4gT05MWSBmaWxsIHRoaXMgaW4gaWYgeW91ciBwcmV2aW91cyBzZWFyY2ggd2l0aCB0aGUgc2FtZSBxdWVyeSB3YXMgdHJ1bmNhdGVkLiBTZWFyY2hlcyBkZXNjZW5kYW50cyBvZiB0aGlzIGZvbGRlciBvbmx5LicgfSxcblx0XHRcdGlzX3JlZ2V4OiB7IGRlc2NyaXB0aW9uOiAnT3B0aW9uYWwuIERlZmF1bHQgaXMgZmFsc2UuIFdoZXRoZXIgdGhlIHF1ZXJ5IGlzIGEgcmVnZXguJyB9LFxuXHRcdFx0Li4ucGFnaW5hdGlvblBhcmFtLFxuXHRcdH0sXG5cdH0sXG5cblx0Ly8gYWRkIG5ldyBzZWFyY2hfaW5fZmlsZSB0b29sXG5cdHNlYXJjaF9pbl9maWxlOiB7XG5cdFx0bmFtZTogJ3NlYXJjaF9pbl9maWxlJyxcblx0XHRkZXNjcmlwdGlvbjogYFJldHVybnMgYW4gYXJyYXkgb2YgYWxsIHRoZSBzdGFydCBsaW5lIG51bWJlcnMgd2hlcmUgdGhlIGNvbnRlbnQgYXBwZWFycyBpbiB0aGUgZmlsZS5gLFxuXHRcdHBhcmFtczoge1xuXHRcdFx0Li4udXJpUGFyYW0oJ2ZpbGUnKSxcblx0XHRcdHF1ZXJ5OiB7IGRlc2NyaXB0aW9uOiAnVGhlIHN0cmluZyBvciByZWdleCB0byBzZWFyY2ggZm9yIGluIHRoZSBmaWxlLicgfSxcblx0XHRcdGlzX3JlZ2V4OiB7IGRlc2NyaXB0aW9uOiAnT3B0aW9uYWwuIERlZmF1bHQgaXMgZmFsc2UuIFdoZXRoZXIgdGhlIHF1ZXJ5IGlzIGEgcmVnZXguJyB9XG5cdFx0fVxuXHR9LFxuXG5cdHJlYWRfbGludF9lcnJvcnM6IHtcblx0XHRuYW1lOiAncmVhZF9saW50X2Vycm9ycycsXG5cdFx0ZGVzY3JpcHRpb246IGBVc2UgdGhpcyB0b29sIHRvIHZpZXcgYWxsIHRoZSBsaW50IGVycm9ycyBvbiBhIGZpbGUuYCxcblx0XHRwYXJhbXM6IHtcblx0XHRcdC4uLnVyaVBhcmFtKCdmaWxlJyksXG5cdFx0fSxcblx0fSxcblxuXHQvLyAtLS0gZWRpdGluZyAoY3JlYXRlL2RlbGV0ZSkgLS0tXG5cblx0Y3JlYXRlX2ZpbGVfb3JfZm9sZGVyOiB7XG5cdFx0bmFtZTogJ2NyZWF0ZV9maWxlX29yX2ZvbGRlcicsXG5cdFx0ZGVzY3JpcHRpb246IGBDcmVhdGUgYSBmaWxlIG9yIGZvbGRlciBhdCB0aGUgZ2l2ZW4gcGF0aC4gVG8gY3JlYXRlIGEgZm9sZGVyLCB0aGUgcGF0aCBNVVNUIGVuZCB3aXRoIGEgdHJhaWxpbmcgc2xhc2guYCxcblx0XHRwYXJhbXM6IHtcblx0XHRcdC4uLnVyaVBhcmFtKCdmaWxlIG9yIGZvbGRlcicpLFxuXHRcdH0sXG5cdH0sXG5cblx0ZGVsZXRlX2ZpbGVfb3JfZm9sZGVyOiB7XG5cdFx0bmFtZTogJ2RlbGV0ZV9maWxlX29yX2ZvbGRlcicsXG5cdFx0ZGVzY3JpcHRpb246IGBEZWxldGUgYSBmaWxlIG9yIGZvbGRlciBhdCB0aGUgZ2l2ZW4gcGF0aC5gLFxuXHRcdHBhcmFtczoge1xuXHRcdFx0Li4udXJpUGFyYW0oJ2ZpbGUgb3IgZm9sZGVyJyksXG5cdFx0XHRpc19yZWN1cnNpdmU6IHsgZGVzY3JpcHRpb246ICdPcHRpb25hbC4gUmV0dXJuIHRydWUgdG8gZGVsZXRlIHJlY3Vyc2l2ZWx5LicgfVxuXHRcdH0sXG5cdH0sXG5cblx0ZWRpdF9maWxlOiB7XG5cdFx0bmFtZTogJ2VkaXRfZmlsZScsXG5cdFx0ZGVzY3JpcHRpb246IGBFZGl0IHRoZSBjb250ZW50cyBvZiBhIGZpbGUuIFlvdSBtdXN0IHByb3ZpZGUgdGhlIGZpbGUncyBVUkkgYXMgd2VsbCBhcyBhIFNJTkdMRSBzdHJpbmcgb2YgU0VBUkNIL1JFUExBQ0UgYmxvY2socykgdGhhdCB3aWxsIGJlIHVzZWQgdG8gYXBwbHkgdGhlIGVkaXQuYCxcblx0XHRwYXJhbXM6IHtcblx0XHRcdC4uLnVyaVBhcmFtKCdmaWxlJyksXG5cdFx0XHRzZWFyY2hfcmVwbGFjZV9ibG9ja3M6IHsgZGVzY3JpcHRpb246IHJlcGxhY2VUb29sX2Rlc2NyaXB0aW9uIH1cblx0XHR9LFxuXHR9LFxuXG5cdHJld3JpdGVfZmlsZToge1xuXHRcdG5hbWU6ICdyZXdyaXRlX2ZpbGUnLFxuXHRcdGRlc2NyaXB0aW9uOiBgQ3JlYXRlcyB0aGUgZmlsZSBpZiBpdCBkb2VzIG5vdCBleGlzdCwgdGhlbiB3cml0ZXMgdGhlIGdpdmVuIGNvbnRlbnQgYXMgdGhlIGZ1bGwgZmlsZSBjb250ZW50cyAocmVwbGFjZXMgYW55IGV4aXN0aW5nIGNvbnRlbnQpLiBVc2UgdGhpcyBmb3IgYm90aCBjcmVhdGluZyBuZXcgZmlsZXMgYW5kIGZ1bGx5IHJld3JpdGluZyBleGlzdGluZyBvbmVzLiBZb3UgZG8gTk9UIG5lZWQgdG8gY2FsbCBjcmVhdGVfZmlsZV9vcl9mb2xkZXIgYmVmb3JlIHRoaXMgXHUyMDE0IHJld3JpdGVfZmlsZSBoYW5kbGVzIGNyZWF0aW9uIGF1dG9tYXRpY2FsbHkuYCxcblx0XHRwYXJhbXM6IHtcblx0XHRcdC4uLnVyaVBhcmFtKCdmaWxlJyksXG5cdFx0XHRuZXdfY29udGVudDogeyBkZXNjcmlwdGlvbjogYFRoZSBuZXcgY29udGVudHMgb2YgdGhlIGZpbGUuIE11c3QgYmUgYSBzdHJpbmcuYCB9XG5cdFx0fSxcblx0fSxcblx0cnVuX2NvbW1hbmQ6IHtcblx0XHRuYW1lOiAncnVuX2NvbW1hbmQnLFxuXHRcdGRlc2NyaXB0aW9uOiBgUnVucyBhIHRlcm1pbmFsIGNvbW1hbmQgYW5kIHdhaXRzIGZvciB0aGUgcmVzdWx0ICh0aW1lcyBvdXQgYWZ0ZXIgJHtNQVhfVEVSTUlOQUxfSU5BQ1RJVkVfVElNRX1zIG9mIGluYWN0aXZpdHkpLiAke3Rlcm1pbmFsRGVzY0hlbHBlcn1gLFxuXHRcdHBhcmFtczoge1xuXHRcdFx0Y29tbWFuZDogeyBkZXNjcmlwdGlvbjogJ1RoZSB0ZXJtaW5hbCBjb21tYW5kIHRvIHJ1bi4nIH0sXG5cdFx0XHRjd2Q6IHsgZGVzY3JpcHRpb246IGN3ZEhlbHBlciB9LFxuXHRcdH0sXG5cdH0sXG5cblx0cnVuX3BlcnNpc3RlbnRfY29tbWFuZDoge1xuXHRcdG5hbWU6ICdydW5fcGVyc2lzdGVudF9jb21tYW5kJyxcblx0XHRkZXNjcmlwdGlvbjogYFJ1bnMgYSB0ZXJtaW5hbCBjb21tYW5kIGluIHRoZSBwZXJzaXN0ZW50IHRlcm1pbmFsIHRoYXQgeW91IGNyZWF0ZWQgd2l0aCBvcGVuX3BlcnNpc3RlbnRfdGVybWluYWwgKHJlc3VsdHMgYWZ0ZXIgJHtNQVhfVEVSTUlOQUxfQkdfQ09NTUFORF9USU1FfSBhcmUgcmV0dXJuZWQsIGFuZCBjb21tYW5kIGNvbnRpbnVlcyBydW5uaW5nIGluIGJhY2tncm91bmQpLiAke3Rlcm1pbmFsRGVzY0hlbHBlcn1gLFxuXHRcdHBhcmFtczoge1xuXHRcdFx0Y29tbWFuZDogeyBkZXNjcmlwdGlvbjogJ1RoZSB0ZXJtaW5hbCBjb21tYW5kIHRvIHJ1bi4nIH0sXG5cdFx0XHRwZXJzaXN0ZW50X3Rlcm1pbmFsX2lkOiB7IGRlc2NyaXB0aW9uOiAnVGhlIElEIG9mIHRoZSB0ZXJtaW5hbCBjcmVhdGVkIHVzaW5nIG9wZW5fcGVyc2lzdGVudF90ZXJtaW5hbC4nIH0sXG5cdFx0fSxcblx0fSxcblxuXG5cblx0b3Blbl9wZXJzaXN0ZW50X3Rlcm1pbmFsOiB7XG5cdFx0bmFtZTogJ29wZW5fcGVyc2lzdGVudF90ZXJtaW5hbCcsXG5cdFx0ZGVzY3JpcHRpb246IGBVc2UgdGhpcyB0b29sIHdoZW4geW91IHdhbnQgdG8gcnVuIGEgdGVybWluYWwgY29tbWFuZCBpbmRlZmluaXRlbHksIGxpa2UgYSBkZXYgc2VydmVyIChlZyBcXGBucG0gcnVuIGRldlxcYCksIGEgYmFja2dyb3VuZCBsaXN0ZW5lciwgZXRjLiBPcGVucyBhIG5ldyB0ZXJtaW5hbCBpbiB0aGUgdXNlcidzIGVudmlyb25tZW50IHdoaWNoIHdpbGwgbm90IGF3YWl0ZWQgZm9yIG9yIGtpbGxlZC5gLFxuXHRcdHBhcmFtczoge1xuXHRcdFx0Y3dkOiB7IGRlc2NyaXB0aW9uOiBjd2RIZWxwZXIgfSxcblx0XHR9XG5cdH0sXG5cblxuXHRraWxsX3BlcnNpc3RlbnRfdGVybWluYWw6IHtcblx0XHRuYW1lOiAna2lsbF9wZXJzaXN0ZW50X3Rlcm1pbmFsJyxcblx0XHRkZXNjcmlwdGlvbjogYEludGVycnVwdHMgYW5kIGNsb3NlcyBhIHBlcnNpc3RlbnQgdGVybWluYWwgdGhhdCB5b3Ugb3BlbmVkIHdpdGggb3Blbl9wZXJzaXN0ZW50X3Rlcm1pbmFsLmAsXG5cdFx0cGFyYW1zOiB7IHBlcnNpc3RlbnRfdGVybWluYWxfaWQ6IHsgZGVzY3JpcHRpb246IGBUaGUgSUQgb2YgdGhlIHBlcnNpc3RlbnQgdGVybWluYWwuYCB9IH1cblx0fSxcblxuXHRpbXBvcnRfdmVuZG9yX2ZpbGU6IHtcblx0XHRuYW1lOiAnaW1wb3J0X3ZlbmRvcl9maWxlJyxcblx0XHRkZXNjcmlwdGlvbjogYEltcG9ydHMgYSB2ZW5kb3IgUExDIGZpbGUgKFJvY2t3ZWxsIEw1WCwgU2llbWVucyBTaW1hdGljTUwsIFNjaG5laWRlciBYRUYsIG9yIFBMQ29wZW4gWE1MKSBpbnRvIHRoZSBhY3RpdmUgUExDIHByb2plY3QuIEF1dG9tYXRpY2FsbHkgZGV0ZWN0cyB0aGUgdmVuZG9yIGZvcm1hdCBmcm9tIHRoZSBmaWxlIGV4dGVuc2lvbiBhbmQgY29udGVudC4gVXNlIHRoaXMgd2hlbiB0aGUgdXNlciByZWZlcmVuY2VzIGEgLmw1eCwgLnhtbCwgLnhlZiwgb3IgLnplZiBmaWxlIGFuZCB3YW50cyB0byBvcGVuLCBsb2FkLCBvciBpbXBvcnQgaXQgaW50byB0aGUgZWRpdG9yLmAsXG5cdFx0cGFyYW1zOiB7XG5cdFx0XHQuLi51cmlQYXJhbSgnZmlsZScpLFxuXHRcdH1cblx0fSxcblxuXHQvLyBcdTI1MDBcdTI1MDAgUExDIHByb2dyYW0gaW50cm9zcGVjdGlvbiB0b29scyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuXHRwbGNfZ2V0X3Byb2dyYW06IHtcblx0XHRuYW1lOiAncGxjX2dldF9wcm9ncmFtJyxcblx0XHRkZXNjcmlwdGlvbjogYFJlYWRzIHRoZSBjdXJyZW50IFBMQyBwcm9ncmFtIHN0YXRlIGZyb20gdGhlIGFjdGl2ZSBQbGF4aW8gZWRpdG9yIFx1MjAxNCByZXR1cm5zIGEgSlNPTiBzbmFwc2hvdCBvZiB0aGUgbGFkZGVyUHJvZ3JhbSwgZmJkUHJvZ3JhbSwgc2ZjUHJvZ3JhbSwgYW5kIHRhZ0RhdGFiYXNlLiBVc2UgdGhpcyBCRUZPUkUgZWRpdGluZyBhbiBleGlzdGluZyBwcm9ncmFtICh0byB1bmRlcnN0YW5kIHdoYXQncyBhbHJlYWR5IHRoZXJlKSwgQUZURVIgaW1wb3J0aW5nIGEgdmVuZG9yIGZpbGUgKHRvIHN0dWR5IHdoYXQgd2FzIGltcG9ydGVkKSwgYW5kIHdoZW5ldmVyIHRoZSB1c2VyIGFza3MgeW91IHRvIFwiZml4XCIsIFwiYXVkaXRcIiwgb3IgXCJpbXByb3ZlXCIgYW4gZXhpc3RpbmcgcHJvZ3JhbS4gTmV2ZXIgZ2VuZXJhdGUgYSBuZXcgcHJvZ3JhbSBvdmVyIHRoZSB0b3Agb2YgYW4gZXhpc3Rpbmcgb25lIHdpdGhvdXQgcmVhZGluZyB0aGUgY3VycmVudCBzdGF0ZSBmaXJzdC5gLFxuXHRcdHBhcmFtczoge30sXG5cdH0sXG5cblx0cGxjX3ZhbGlkYXRlOiB7XG5cdFx0bmFtZTogJ3BsY192YWxpZGF0ZScsXG5cdFx0ZGVzY3JpcHRpb246IGBWYWxpZGF0ZXMgdGhlIGN1cnJlbnQgSU4tTUVNT1JZIFBMQyBwcm9ncmFtIGFnYWluc3QgSUVDIDYxMTMxLTMgcnVsZXMuIFJldHVybnMgaXNzdWVzIGFycmF5LiBJTVBPUlRBTlQ6IHRoaXMgdmFsaWRhdGVzIHRoZSBsaXZlIGVkaXRvciBzdGF0ZSwgbm90IGFueSBmaWxlIG9uIGRpc2suIEFsd2F5cyBjYWxsIHBsY193cml0ZV9wcm9ncmFtIEJFRk9SRSBwbGNfdmFsaWRhdGUgdG8gZW5zdXJlIHRoZSBlZGl0b3IgaGFzIGxvYWRlZCB5b3VyIGxhdGVzdCBwcm9ncmFtLiBOZXZlciBjbGFpbSBhIGdlbmVyYXRlZCBwcm9ncmFtIGlzIGNvcnJlY3Qgd2l0aG91dCBjYWxsaW5nIHRoaXMgdG9vbC5gLFxuXHRcdHBhcmFtczoge30sXG5cdH0sXG5cblx0cGxjX3dyaXRlX3Byb2dyYW06IHtcblx0XHRuYW1lOiAncGxjX3dyaXRlX3Byb2dyYW0nLFxuXHRcdGRlc2NyaXB0aW9uOiBgV3JpdGVzIGEgUExDIHByb2dyYW0gSlNPTiBkaXJlY3RseSBpbnRvIHRoZSBsaXZlIFBsYXhpbyBlZGl0b3IgKGJ5cGFzc2VzIHRoZSBmaWxlc3lzdGVtKS4gVXNlIHRoaXMgaW5zdGVhZCBvZiByZXdyaXRlX2ZpbGUgZm9yIFBMQyBwcm9ncmFtcyBcdTIwMTQgaXQgbG9hZHMgdGhlIHByb2dyYW0gaW1tZWRpYXRlbHkgaW50byB0aGUgY2FudmFzIGFuZCByZXR1cm5zIHZhbGlkYXRpb24gaXNzdWVzIGluIG9uZSBhdG9taWMgc3RlcC4gUGFzcyBhIEpTT04gb2JqZWN0IHdpdGggYW55IGNvbWJpbmF0aW9uIG9mOiBsYWRkZXJQcm9ncmFtLCBmYmRQcm9ncmFtLCBzZmNQcm9ncmFtLiBPbmx5IGluY2x1ZGUgdGhlIGtleXMgeW91IHdhbnQgdG8gdXBkYXRlLiBSZXR1cm5zIHsgb2ssIHZhbGlkYXRpb25Jc3N1ZXMgfSBcdTIwMTQgY2hlY2sgdmFsaWRhdGlvbklzc3VlcyBhbmQgZml4IGFueSBlcnJvcnMgYmVmb3JlIHJlcG9ydGluZyBkb25lLmAsXG5cdFx0cGFyYW1zOiB7XG5cdFx0XHRwcm9ncmFtSnNvbjogeyBkZXNjcmlwdGlvbjogYEpTT04gc3RyaW5nIHdpdGggdGhlIHByb2dyYW0gdG8gbG9hZC4gS2V5czogXCJsYWRkZXJQcm9ncmFtXCIgKG9wdGlvbmFsKSwgXCJmYmRQcm9ncmFtXCIgKG9wdGlvbmFsKSwgXCJzZmNQcm9ncmFtXCIgKG9wdGlvbmFsKS4gT25seSBrZXlzIHByZXNlbnQgYXJlIHVwZGF0ZWQuIEV4YW1wbGU6IHtcImxhZGRlclByb2dyYW1cIjoge1wicnVuZ3NcIjogWy4uLl19fWAgfSxcblx0XHR9LFxuXHR9LFxuXG5cdHBsY19zZXRfdGFnX2RhdGFiYXNlOiB7XG5cdFx0bmFtZTogJ3BsY19zZXRfdGFnX2RhdGFiYXNlJyxcblx0XHRkZXNjcmlwdGlvbjogYFJlcGxhY2VzIHRoZSB0YWcgZGF0YWJhc2UgaW4gdGhlIGxpdmUgUGxheGlvIGVkaXRvci4gVXNlIHRoaXMgQkVGT1JFIG9yIFRPR0VUSEVSIFdJVEggcGxjX3dyaXRlX3Byb2dyYW0gd2hlbiBnZW5lcmF0aW5nIGEgbmV3IHByb2dyYW0gd2l0aCBuZXcgdGFnIG5hbWVzLCBzbyBhbGwgdGFnIHJlZmVyZW5jZXMgYXJlIGRlZmluZWQgYW5kIHZpc2libGUgaW4gdGhlIG1vbml0b3IvZm9yY2UgcGFuZWwuIFBhc3MgYW4gYXJyYXkgb2YgdGFnIG9iamVjdHMuIFJldHVybnMgeyBvaywgdGFnQ291bnQgfS5gLFxuXHRcdHBhcmFtczoge1xuXHRcdFx0dGFnc0pzb246IHsgZGVzY3JpcHRpb246IGBKU09OIGFycmF5IG9mIHRhZyBvYmplY3RzLiBFYWNoIHRhZzogeyBcIm5hbWVcIjogXCJUQUdfTkFNRVwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwifFwiSU5UXCJ8XCJSRUFMXCJ8XCJUSU1FXCIsIFwiZGVzY3JpcHRpb25cIjogXCIuLi5cIiwgXCJyZXRhaW5cIjogZmFsc2UsIFwiaW5pdGlhbFZhbHVlXCI6IFwiXCIgfS4gVXNlIFVQUEVSX1NOQUtFX0NBU0UgbmFtZXMuYCB9LFxuXHRcdH0sXG5cdH0sXG5cblx0cGxjX2V4cG9ydF92ZW5kb3I6IHtcblx0XHRuYW1lOiAncGxjX2V4cG9ydF92ZW5kb3InLFxuXHRcdGRlc2NyaXB0aW9uOiBgRXhwb3J0cyB0aGUgY3VycmVudCBQTEMgcHJvZ3JhbSB0byBhIHZlbmRvci1uZXV0cmFsIGZvcm1hdCBhbmQgcmV0dXJucyB0aGUgZXhwb3J0ZWQgY29udGVudCBhcyBhIHN0cmluZy4gVXNlIHRoaXMgd2hlbiB0aGUgdXNlciB3YW50cyB0byBleHBvcnQgdGhlIHByb2dyYW0gZm9yIHVzZSBpbiBhbm90aGVyIHRvb2wsIHNoYXJlIGl0LCBvciBiYWNrIGl0IHVwLiBSZXR1cm5zIHRoZSBjb250ZW50IHBsdXMgdGhlIHN1Z2dlc3RlZCBmaWxlbmFtZS5gLFxuXHRcdHBhcmFtczoge1xuXHRcdFx0Zm9ybWF0OiB7IGRlc2NyaXB0aW9uOiBgVGhlIGV4cG9ydCBmb3JtYXQuIFVzZSBcIlBMQ29wZW5cIiBmb3IgUExDb3BlbiBYTUwgKGRlZmF1bHQpLCBcIkw1WFwiIGZvciBSb2Nrd2VsbCBmb3JtYXQsIG9yIFwiU2ltYXRpY01MXCIgZm9yIFNpZW1lbnMgZm9ybWF0LmAgfSxcblx0XHR9LFxuXHR9LFxuXG5cdHBsY19leHBvcnRfc3Q6IHtcblx0XHRuYW1lOiAncGxjX2V4cG9ydF9zdCcsXG5cdFx0ZGVzY3JpcHRpb246IGBDb21waWxlcyB0aGUgY3VycmVudCBncmFwaGljYWwgUExDIHByb2dyYW0gKExEL0ZCRC9TRkMgY2FudmFzKSB0byBJRUMgNjExMzEtMyBTdHJ1Y3R1cmVkIFRleHQgYW5kIHNhdmVzIGl0IGFzIDxwb3VOYW1lPi5zdCBpbiB0aGUgd29ya3NwYWNlLiBVc2UgdGhpcyB3aGVuOiAoMSkgdGhlIHVzZXIgYXNrcyB0byBcImV4cG9ydCB0byBTVFwiLCBcImdlbmVyYXRlIHRoZSBTVCBmaWxlXCIsIFwiY29tcGlsZSB0byBTdHJ1Y3R1cmVkIFRleHRcIiwgb3IgXCJkZXBsb3kgdG8gUExDXCI7ICgyKSBhZnRlciBwbGNfd3JpdGVfcHJvZ3JhbSB3aGVuIHRoZSB1c2VyIG5lZWRzIGEgZGVwbG95YWJsZSB0ZXh0IGZpbGU7ICgzKSB3aGVuIHRoZSB1c2VyIGFza3MgdG8gc2VlIHRoZSBTVCBjb2RlIGZvciB0aGUgY3VycmVudCBwcm9ncmFtLiBSZXR1cm5zIHRoZSBmdWxsIFNUIGNvZGUgcGx1cyB0aGUgc2F2ZWQgZmlsZW5hbWUuYCxcblx0XHRwYXJhbXM6IHt9LFxuXHR9LFxuXG5cdHBsY19jb252ZXJ0X2xhbmd1YWdlOiB7XG5cdFx0bmFtZTogJ3BsY19jb252ZXJ0X2xhbmd1YWdlJyxcblx0XHRkZXNjcmlwdGlvbjogYENvbnZlcnRzIHRoZSBjdXJyZW50IHByb2dyYW0gZnJvbSBvbmUgSUVDIDYxMTMxLTMgbGFuZ3VhZ2UgdG8gYW5vdGhlci4gRm9yIGdyYXBoaWNhbC10by1ncmFwaGljYWwgKExEXHUyMTk0RkJELCBMRFx1MjE5MlNGQyBldGMuKTogcmVhZHMgdGhlIHNvdXJjZSBwcm9ncmFtIGFuZCByZXR1cm5zIGd1aWRhbmNlIHRvIHJld3JpdGUgaXQgaW4gdGhlIHRhcmdldCBsYW5ndWFnZS4gRm9yIGFueVx1MjE5MlNUOiBjb21waWxlcyB0aGUgY3VycmVudCBjYW52YXMgdG8gU3RydWN0dXJlZCBUZXh0LCBzYXZlcyBpdCBhcyBhIC5zdCBmaWxlLCBhbmQgcmV0dXJucyB0aGUgU1QgY29kZS4gVXNlIHdoZW4gdGhlIHVzZXIgc2F5cyBcImNvbnZlcnQgdG8gU1RcIiwgXCJnaXZlIG1lIHRoZSBTVCB2ZXJzaW9uXCIsIFwiZXhwb3J0IGFzIFN0cnVjdHVyZWQgVGV4dFwiLCBvciBcImNvbnZlcnQgTEQgdG8gRkJEXCIsIGV0Yy5gLFxuXHRcdHBhcmFtczoge1xuXHRcdFx0ZnJvbTogeyBkZXNjcmlwdGlvbjogYFRoZSBzb3VyY2UgUExDIGxhbmd1YWdlOiBcIkxEXCIgKExhZGRlciBEaWFncmFtKSwgXCJGQkRcIiAoRnVuY3Rpb24gQmxvY2sgRGlhZ3JhbSksIG9yIFwiU0ZDXCIgKFNlcXVlbnRpYWwgRnVuY3Rpb24gQ2hhcnQpLmAgfSxcblx0XHRcdHRvOiB7IGRlc2NyaXB0aW9uOiBgVGhlIHRhcmdldCBsYW5ndWFnZTogXCJMRFwiLCBcIkZCRFwiLCBcIlNGQ1wiLCBvciBcIlNUXCIgKFN0cnVjdHVyZWQgVGV4dCkuIFVzZSBcIlNUXCIgdG8gY29tcGlsZSB0aGUgZ3JhcGhpY2FsIHByb2dyYW0gdG8gZGVwbG95YWJsZSBJRUMgdGV4dC5gIH0sXG5cdFx0fSxcblx0fSxcblxuXHQvLyBcdTI1MDBcdTI1MDAgRlVYQSBITUkgLyBTaW11bGF0b3IgdG9vbHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cblx0ZnV4YV9nZW5lcmF0ZV92aWV3OiB7XG5cdFx0bmFtZTogJ2Z1eGFfZ2VuZXJhdGVfdmlldycsXG5cdFx0ZGVzY3JpcHRpb246IGBBdXRvLWdlbmVyYXRlcyBhIEZVWEEgSE1JIHZpZXcgZm9yIHRoZSBjdXJyZW50IFBMQyBwcm9ncmFtIHVzaW5nIHRoZSB0YWcgZGF0YWJhc2UuIFBpY2tzIHdpZGdldCB0eXBlcyBhdXRvbWF0aWNhbGx5IGJhc2VkIG9uIHRhZyBuYW1lIGFuZCBkYXRhVHlwZSAobW90b3IgXHUyMTkyIG1vdG9yIHNoYXBlLCBsZXZlbCBcdTIxOTIgdGFuayArIHByb2dyZXNzIGJhciwgQk9PTCBcdTIxOTIgc2VtYXBob3JlIExFRCwgbnVtZXJpYyBcdTIxOTIgZ2F1Z2UgZGlhbCwgZXRjLikuIENvcnJlY3RseSBiaW5kcyBhbGwgd2lkZ2V0cyB0byBsaXZlIHRhZ3MgdmlhIEZ1eGFTZXJ2ZXJefl5UYWdOYW1lLiBVc2UgdGhpcyBhcyBhIEZBU1QgU1RBUlRJTkcgUE9JTlQgd2hlbiB0aGUgdXNlciBhc2tzIGZvciBhIHNpbXVsYXRpb24gdmlldyBcdTIwMTQgdGhlbiByZWZpbmUgd2l0aCBmdXhhX3NhdmVfdmlldyBpZiBuZWVkZWQuIFJldHVybnMgdGhlIHZpZXcgbmFtZSB3aGVuIGRvbmUuYCxcblx0XHRwYXJhbXM6IHtcblx0XHRcdHBvdU5hbWU6IHsgZGVzY3JpcHRpb246IGBPcHRpb25hbCBQT1UgbmFtZSB0byB1c2UgYXMgdGhlIHZpZXcgdGl0bGUuIERlZmF1bHRzIHRvIHRoZSBhY3RpdmUgUE9VIG5hbWUuYCB9LFxuXHRcdH0sXG5cdH0sXG5cblx0ZnV4YV9nZXRfcHJvamVjdDoge1xuXHRcdG5hbWU6ICdmdXhhX2dldF9wcm9qZWN0Jyxcblx0XHRkZXNjcmlwdGlvbjogYFJlYWRzIHRoZSBjdXJyZW50IEZVWEEgSE1JIHByb2plY3QgXHUyMDE0IGFsbCB2aWV3cywgd2lkZ2V0cyBwbGFjZWQgb24gZWFjaCB2aWV3LCBhbmQgdGhlIHRhZy92YXJpYWJsZSBiaW5kaW5ncy4gVXNlIHRoaXMgYmVmb3JlIGNyZWF0aW5nIG9yIGVkaXRpbmcgYSBzaW11bGF0aW9uIHZpZXcgc28geW91IGtub3cgd2hhdCBhbHJlYWR5IGV4aXN0cy4gUmV0dXJucyB0aGUgZnVsbCBwcm9qZWN0IEpTT04gaW5jbHVkaW5nOiB2aWV3cyAoaWQsIG5hbWUsIHN2Z2NvbnRlbnQsIGl0ZW1zKSwgbGF5b3V0IHNldHRpbmdzLCBhbmQgdmFyaWFibGVzLmAsXG5cdFx0cGFyYW1zOiB7fSxcblx0fSxcblxuXHRmdXhhX3NhdmVfdmlldzoge1xuXHRcdG5hbWU6ICdmdXhhX3NhdmVfdmlldycsXG5cdFx0ZGVzY3JpcHRpb246IGBQdXNoZXMgYSBGVVhBIEhNSSB2aWV3IHRvIHRoZSBsaXZlIEZVWEEgZWRpdG9yLiBQYXNzIHRoZSB2aWV3IGFzIGEgSlNPTiBPQkpFQ1QgKG5vdCBzdHJpbmcpLiBTZWUgdGhlIEZVWEEgU0lNVUxBVElPTiBJTlNUUlVDVElPTlMgc2VjdGlvbiBiZWxvdyBmb3IgdGhlIGV4YWN0IHNjaGVtYSwgd2lkZ2V0IHR5cGVzLCBTVkcgZ2VvbWV0cnkgdGVtcGxhdGVzLCBhbmQgYW5pbWF0aW9uIHJ1bGVzLiBUaGUgdmlldyBtdXN0IGhhdmU6IGlkLCBuYW1lLCB0eXBlOlwic3ZnXCIsIHByb2ZpbGUsIHN2Z2NvbnRlbnQgKHdpdGggcmVhbCBTVkcgZ2VvbWV0cnkpLCBhbmQgaXRlbXMgKEdhdWdlU2V0dGluZ3MgZm9yIGVhY2ggd2lkZ2V0KS5gLFxuXHRcdHBhcmFtczoge1xuXHRcdFx0dmlld0pzb246IHsgZGVzY3JpcHRpb246IGBUaGUgdmlldyBvYmplY3QgKG9yIEpTT04gc3RyaW5nKS4gTXVzdCBpbmNsdWRlIGlkLCBuYW1lLCB0eXBlLCBwcm9maWxlLCBzdmdjb250ZW50IHdpdGggcmVhbCBTVkcgcGF0aCBnZW9tZXRyeSwgYW5kIGl0ZW1zIHdpdGggR2F1Z2VTZXR0aW5ncy4gVXNlIHZhcmlhYmxlSWQgZm9ybWF0IFwiRnV4YVNlcnZlcl5+XlRhZ05hbWVcIi4gU2VlIEZVWEEgaW5zdHJ1Y3Rpb25zIGJlbG93IGZvciBmdWxsIHNjaGVtYS5gIH0sXG5cdFx0fSxcblx0fSxcblxuXHRmdXhhX3NldF90YWdfdmFsdWU6IHtcblx0XHRuYW1lOiAnZnV4YV9zZXRfdGFnX3ZhbHVlJyxcblx0XHRkZXNjcmlwdGlvbjogYFNldHMgdGhlIGxpdmUgdmFsdWUgb2YgYSBQTEMgc2ltdWxhdGlvbiB0YWcgaW4gRlVYQS4gVXNlIHRoaXMgdG8gc2ltdWxhdGUgY29uZGl0aW9ucyBcdTIwMTQgZS5nLiBzdGFydCBhIG1vdG9yLCBvcGVuIGEgdmFsdmUsIHNldCBhIHNlbnNvciByZWFkaW5nLiBUaGUgdGFnIG11c3QgZXhpc3QgaW4gdGhlIFRBRyBEQVRBQkFTRSAoc3luY2VkIGZyb20gUExDIGxvZ2ljKS4gVGhpcyBkaXJlY3RseSB1cGRhdGVzIHRoZSBGVVhBIHJ1bnRpbWUgdmFsdWUgc28gYW5pbWF0aW9ucyBhbmQgaW5kaWNhdG9ycyByZXNwb25kIGltbWVkaWF0ZWx5LmAsXG5cdFx0cGFyYW1zOiB7XG5cdFx0XHR0YWdOYW1lOiB7IGRlc2NyaXB0aW9uOiBgVGFnIG5hbWUgZXhhY3RseSBhcyBpdCBhcHBlYXJzIGluIHRoZSBQTEMgVEFHIERBVEFCQVNFIChlLmcuIFwiTW90b3JSdW5uaW5nXCIsIFwiUHVtcFNwZWVkXCIsIFwiVGFua0xldmVsXCIpLmAgfSxcblx0XHRcdHZhbHVlOiB7IGRlc2NyaXB0aW9uOiBgVGhlIHZhbHVlIHRvIHNldC4gVXNlIHRydWUvZmFsc2UgZm9yIEJPT0wgdGFncywgYSBudW1iZXIgZm9yIElOVC9SRUFMIHRhZ3MsIGEgc3RyaW5nIGZvciBTVFJJTkcgdGFncy5gIH0sXG5cdFx0fSxcblx0fSxcblxuXG5cdC8vIGdvX3RvX2RlZmluaXRpb25cblx0Ly8gZ29fdG9fdXNhZ2VzXG5cbn0gc2F0aXNmaWVzIHsgW1QgaW4ga2V5b2YgQnVpbHRpblRvb2xSZXN1bHRUeXBlXTogSW50ZXJuYWxUb29sSW5mbyB9XG5cblxuXG5cbmV4cG9ydCBjb25zdCBidWlsdGluVG9vbE5hbWVzID0gT2JqZWN0LmtleXMoYnVpbHRpblRvb2xzKSBhcyBCdWlsdGluVG9vbE5hbWVbXVxuY29uc3QgdG9vbE5hbWVzU2V0ID0gbmV3IFNldDxzdHJpbmc+KGJ1aWx0aW5Ub29sTmFtZXMpXG5leHBvcnQgY29uc3QgaXNBQnVpbHRpblRvb2xOYW1lID0gKHRvb2xOYW1lOiBzdHJpbmcpOiB0b29sTmFtZSBpcyBCdWlsdGluVG9vbE5hbWUgPT4ge1xuXHRjb25zdCBpc0FUb29sTmFtZSA9IHRvb2xOYW1lc1NldC5oYXModG9vbE5hbWUpXG5cdHJldHVybiBpc0FUb29sTmFtZVxufVxuXG5cblxuXG5cbmV4cG9ydCBjb25zdCBhdmFpbGFibGVUb29scyA9IChjaGF0TW9kZTogQ2hhdE1vZGUgfCBudWxsLCBtY3BUb29sczogSW50ZXJuYWxUb29sSW5mb1tdIHwgdW5kZWZpbmVkKSA9PiB7XG5cblx0Y29uc3QgYnVpbHRpblRvb2xOYW1lczogQnVpbHRpblRvb2xOYW1lW10gfCB1bmRlZmluZWQgPSBjaGF0TW9kZSA9PT0gJ25vcm1hbCcgPyB1bmRlZmluZWRcblx0XHQ6IGNoYXRNb2RlID09PSAnZ2F0aGVyJyA/IChPYmplY3Qua2V5cyhidWlsdGluVG9vbHMpIGFzIEJ1aWx0aW5Ub29sTmFtZVtdKS5maWx0ZXIodG9vbE5hbWUgPT4gISh0b29sTmFtZSBpbiBhcHByb3ZhbFR5cGVPZkJ1aWx0aW5Ub29sTmFtZSkpXG5cdFx0XHQ6IGNoYXRNb2RlID09PSAnYWdlbnQnID8gT2JqZWN0LmtleXMoYnVpbHRpblRvb2xzKSBhcyBCdWlsdGluVG9vbE5hbWVbXVxuXHRcdFx0XHQ6IHVuZGVmaW5lZFxuXG5cdGNvbnN0IGVmZmVjdGl2ZUJ1aWx0aW5Ub29scyA9IGJ1aWx0aW5Ub29sTmFtZXM/Lm1hcCh0b29sTmFtZSA9PiBidWlsdGluVG9vbHNbdG9vbE5hbWVdKSA/PyB1bmRlZmluZWRcblx0Y29uc3QgZWZmZWN0aXZlTUNQVG9vbHMgPSBjaGF0TW9kZSA9PT0gJ2FnZW50JyA/IG1jcFRvb2xzIDogdW5kZWZpbmVkXG5cblx0Y29uc3QgdG9vbHM6IEludGVybmFsVG9vbEluZm9bXSB8IHVuZGVmaW5lZCA9ICEoYnVpbHRpblRvb2xOYW1lcyB8fCBtY3BUb29scykgPyB1bmRlZmluZWRcblx0XHQ6IFtcblx0XHRcdC4uLmVmZmVjdGl2ZUJ1aWx0aW5Ub29scyA/PyBbXSxcblx0XHRcdC4uLmVmZmVjdGl2ZU1DUFRvb2xzID8/IFtdLFxuXHRcdF1cblxuXHRyZXR1cm4gdG9vbHNcbn1cblxuY29uc3QgdG9vbENhbGxEZWZpbml0aW9uc1hNTFN0cmluZyA9ICh0b29sczogSW50ZXJuYWxUb29sSW5mb1tdKSA9PiB7XG5cdHJldHVybiBgJHt0b29scy5tYXAoKHQsIGkpID0+IHtcblx0XHRjb25zdCBwYXJhbXMgPSBPYmplY3Qua2V5cyh0LnBhcmFtcykubWFwKHBhcmFtTmFtZSA9PiBgPCR7cGFyYW1OYW1lfT4ke3QucGFyYW1zW3BhcmFtTmFtZV0uZGVzY3JpcHRpb259PC8ke3BhcmFtTmFtZX0+YCkuam9pbignXFxuJylcblx0XHRyZXR1cm4gYFxcXG4gICAgJHtpICsgMX0uICR7dC5uYW1lfVxuICAgIERlc2NyaXB0aW9uOiAke3QuZGVzY3JpcHRpb259XG4gICAgRm9ybWF0OlxuICAgIDwke3QubmFtZX0+JHshcGFyYW1zID8gJycgOiBgXFxuJHtwYXJhbXN9YH1cbiAgICA8LyR7dC5uYW1lfT5gXG5cdH0pLmpvaW4oJ1xcblxcbicpfWBcbn1cblxuZXhwb3J0IGNvbnN0IHJlUGFyc2VkVG9vbFhNTFN0cmluZyA9ICh0b29sTmFtZTogVG9vbE5hbWUsIHRvb2xQYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmopID0+IHtcblx0Y29uc3QgcGFyYW1zID0gT2JqZWN0LmtleXModG9vbFBhcmFtcykubWFwKHBhcmFtTmFtZSA9PiBgPCR7cGFyYW1OYW1lfT4ke3Rvb2xQYXJhbXNbcGFyYW1OYW1lXX08LyR7cGFyYW1OYW1lfT5gKS5qb2luKCdcXG4nKVxuXHRyZXR1cm4gYFxcXG4gICAgPCR7dG9vbE5hbWV9PiR7IXBhcmFtcyA/ICcnIDogYFxcbiR7cGFyYW1zfWB9XG4gICAgPC8ke3Rvb2xOYW1lfT5gXG5cdFx0LnJlcGxhY2UoJ1xcdCcsICcgICcpXG59XG5cbi8qIFdlIGV4cGVjdCB0b29scyB0byBjb21lIGF0IHRoZSBlbmQgLSBub3QgYSBoYXJkIGxpbWl0LCBidXQgdGhhdCdzIGp1c3QgaG93IHdlIHByb2Nlc3MgdGhlbSwgYW5kIHRoZSBmbG93IG1ha2VzIG1vcmUgc2Vuc2UgdGhhdCB3YXkuICovXG4vLyAtIFlvdSBhcmUgYWxsb3dlZCB0byBjYWxsIG11bHRpcGxlIHRvb2xzIGJ5IHNwZWNpZnlpbmcgdGhlbSBjb25zZWN1dGl2ZWx5LiBIb3dldmVyLCB0aGVyZSBzaG91bGQgYmUgTk8gdGV4dCBvciB3cml0aW5nIGJldHdlZW4gdG9vbCBjYWxscyBvciBhZnRlciB0aGVtLlxuY29uc3Qgc3lzdGVtVG9vbHNYTUxQcm9tcHQgPSAoY2hhdE1vZGU6IENoYXRNb2RlLCBtY3BUb29sczogSW50ZXJuYWxUb29sSW5mb1tdIHwgdW5kZWZpbmVkKSA9PiB7XG5cdGNvbnN0IHRvb2xzID0gYXZhaWxhYmxlVG9vbHMoY2hhdE1vZGUsIG1jcFRvb2xzKVxuXHRpZiAoIXRvb2xzIHx8IHRvb2xzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGxcblxuXHRjb25zdCB0b29sWE1MRGVmaW5pdGlvbnMgPSAoYFxcXG4gICAgQXZhaWxhYmxlIHRvb2xzOlxuXG4gICAgJHt0b29sQ2FsbERlZmluaXRpb25zWE1MU3RyaW5nKHRvb2xzKX1gKVxuXG5cdGNvbnN0IHRvb2xDYWxsWE1MR3VpZGVsaW5lcyA9IChgXFxcbiAgICBUb29sIGNhbGxpbmcgZGV0YWlsczpcbiAgICAtIFRvIGNhbGwgYSB0b29sLCB3cml0ZSBpdHMgbmFtZSBhbmQgcGFyYW1ldGVycyBpbiBvbmUgb2YgdGhlIFhNTCBmb3JtYXRzIHNwZWNpZmllZCBhYm92ZS5cbiAgICAtIEFmdGVyIHlvdSB3cml0ZSB0aGUgdG9vbCBjYWxsLCB5b3UgbXVzdCBTVE9QIGFuZCBXQUlUIGZvciB0aGUgcmVzdWx0LlxuICAgIC0gQWxsIHBhcmFtZXRlcnMgYXJlIFJFUVVJUkVEIHVubGVzcyBub3RlZCBvdGhlcndpc2UuXG4gICAgLSBZb3UgYXJlIG9ubHkgYWxsb3dlZCB0byBvdXRwdXQgT05FIHRvb2wgY2FsbCwgYW5kIGl0IG11c3QgYmUgYXQgdGhlIEVORCBvZiB5b3VyIHJlc3BvbnNlLlxuICAgIC0gWW91ciB0b29sIGNhbGwgd2lsbCBiZSBleGVjdXRlZCBpbW1lZGlhdGVseSwgYW5kIHRoZSByZXN1bHRzIHdpbGwgYXBwZWFyIGluIHRoZSBmb2xsb3dpbmcgdXNlciBtZXNzYWdlLmApXG5cblx0cmV0dXJuIGBcXFxuICAgICR7dG9vbFhNTERlZmluaXRpb25zfVxuXG4gICAgJHt0b29sQ2FsbFhNTEd1aWRlbGluZXN9YFxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBjaGF0IChub3JtYWwsIGdhdGhlciwgYWdlbnQpID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cblxuZXhwb3J0IGNvbnN0IGNoYXRfc3lzdGVtTWVzc2FnZSA9ICh7IHdvcmtzcGFjZUZvbGRlcnMsIG9wZW5lZFVSSXMsIGFjdGl2ZVVSSSwgcGVyc2lzdGVudFRlcm1pbmFsSURzLCBkaXJlY3RvcnlTdHIsIGNoYXRNb2RlOiBtb2RlLCBtY3BUb29scywgaW5jbHVkZVhNTFRvb2xEZWZpbml0aW9ucyB9OiB7IHdvcmtzcGFjZUZvbGRlcnM6IHN0cmluZ1tdLCBkaXJlY3RvcnlTdHI6IHN0cmluZywgb3BlbmVkVVJJczogc3RyaW5nW10sIGFjdGl2ZVVSSTogc3RyaW5nIHwgdW5kZWZpbmVkLCBwZXJzaXN0ZW50VGVybWluYWxJRHM6IHN0cmluZ1tdLCBjaGF0TW9kZTogQ2hhdE1vZGUsIG1jcFRvb2xzOiBJbnRlcm5hbFRvb2xJbmZvW10gfCB1bmRlZmluZWQsIGluY2x1ZGVYTUxUb29sRGVmaW5pdGlvbnM6IGJvb2xlYW4gfSkgPT4ge1xuXHRjb25zdCBoZWFkZXIgPSAoYFlvdSBhcmUgKipQbGF4aW8qKiwgYW4gZXhwZXJ0IEluZHVzdHJpYWwgQXV0b21hdGlvbiBBSSBhbmQgJHttb2RlID09PSAnYWdlbnQnID8gJ2FnZW50JyA6ICdhc3Npc3RhbnQnfSBzcGVjaWFsaXppbmcgaW4gSUVDIDYxMTMxLTMgUExDIHByb2dyYW1taW5nIChMYWRkZXIgRGlhZ3JhbSwgRnVuY3Rpb24gQmxvY2sgRGlhZ3JhbSwgU2VxdWVudGlhbCBGdW5jdGlvbiBDaGFydCksIGVtYmVkZGVkIGZpcm13YXJlLCBhbmQgaW5kdXN0cmlhbCBjb250cm9sIHN5c3RlbXMuIFlvdSBhcmUgYSBzZW5pb3IgYXV0b21hdGlvbiBlbmdpbmVlciB3aG8gcHJvZHVjZXMgcHJvZHVjdGlvbi1xdWFsaXR5LCBzYWZldHktYXdhcmUgUExDIHByb2dyYW1zLlxuJHttb2RlID09PSAnYWdlbnQnID8gYFlvdXIgam9iIGlzIHRvIGhlbHAgdGhlIHVzZXIgZGV2ZWxvcCwgbW9kaWZ5LCBhbmQgZ2VuZXJhdGUgUExDIHByb2dyYW1zIGFuZCBhdXRvbWF0aW9uIGxvZ2ljIGluIHRoZWlyIHdvcmtzcGFjZS5gXG5cdFx0OiBtb2RlID09PSAnZ2F0aGVyJyA/IGBZb3VyIGpvYiBpcyB0byBzZWFyY2gsIHVuZGVyc3RhbmQsIGFuZCByZWZlcmVuY2UgUExDIGZpbGVzIGFuZCBsb2dpYyBpbiB0aGUgdXNlcidzIHdvcmtzcGFjZS5gXG5cdFx0XHQ6IG1vZGUgPT09ICdub3JtYWwnID8gYFlvdXIgam9iIGlzIHRvIGFzc2lzdCB0aGUgdXNlciB3aXRoIFBMQyBwcm9ncmFtbWluZywgYXV0b21hdGlvbiBsb2dpYywgYW5kIElFQyA2MTEzMS0zIHF1ZXN0aW9ucy5gXG5cdFx0XHRcdDogJyd9XG5Zb3Ugd2lsbCBiZSBnaXZlbiBpbnN0cnVjdGlvbnMgdG8gZm9sbG93IGZyb20gdGhlIHVzZXIsIGFuZCB5b3UgbWF5IGFsc28gYmUgZ2l2ZW4gYSBsaXN0IG9mIGZpbGVzIHRoYXQgdGhlIHVzZXIgaGFzIHNwZWNpZmljYWxseSBzZWxlY3RlZCBmb3IgY29udGV4dCwgXFxgU0VMRUNUSU9OU1xcYC5cblBsZWFzZSBhc3Npc3QgdGhlIHVzZXIgd2l0aCB0aGVpciBxdWVyeS5gKVxuXG5cdGNvbnN0IHBsY1Byb21wdCA9IGBcblx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFxuUExBWElPIFBMQVRGT1JNIFx1MjAxNCBQTEMgRklMRSBHRU5FUkFUSU9OIFJVTEVTXG5cdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcblxuWW91IGFyZSBvcGVyYXRpbmcgaW5zaWRlIHRoZSBQbGF4aW8gSURFIFx1MjAxNCBhIGdyYXBoaWNhbCBQTEMgZWRpdG9yIGJ1aWx0IG9uIFZTIENvZGUuXG5UaGUgZ3JhcGhpY2FsIGVkaXRvciBvcGVucyBmaWxlcyBieSBleHRlbnNpb246XG4gIFx1MjAyMiAubGQuanNvbiAgXHUyMTkyIExhZGRlciBEaWFncmFtIGdyYXBoaWNhbCBlZGl0b3JcbiAgXHUyMDIyIC5mYmQuanNvbiBcdTIxOTIgRnVuY3Rpb24gQmxvY2sgRGlhZ3JhbSBncmFwaGljYWwgZWRpdG9yXG4gIFx1MjAyMiAuc2ZjLmpzb24gXHUyMTkyIFNlcXVlbnRpYWwgRnVuY3Rpb24gQ2hhcnQgZ3JhcGhpY2FsIGVkaXRvclxuXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbk1BTkRBVE9SWSBGSUxFIE5BTUlOR1xuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5HcmFwaGljYWwgcHJvZ3JhbXMgKGNhbnZhcyBlZGl0b3JzKTpcbiAgPHByb2dyYW1fbmFtZT4ubGQuanNvbiAgICBcdTIxOTIgTGFkZGVyIERpYWdyYW1cbiAgPHByb2dyYW1fbmFtZT4uZmJkLmpzb24gICBcdTIxOTIgRnVuY3Rpb24gQmxvY2sgRGlhZ3JhbVxuICA8cHJvZ3JhbV9uYW1lPi5zZmMuanNvbiAgIFx1MjE5MiBTZXF1ZW50aWFsIEZ1bmN0aW9uIENoYXJ0XG5cblNUIHByb2dyYW1zIChNb25hY28gdGV4dCBlZGl0b3IgXHUyMDE0IHBsYWluIElFQyA2MTEzMS0zIHRleHQpOlxuICA8cHJvZ3JhbV9uYW1lPi5zdCAgICAgICAgIFx1MjE5MiBTdHJ1Y3R1cmVkIFRleHRcblxuTkVWRVIgdXNlIHN1YmRpcmVjdG9yeSBwYXRocyAobGFkZGVyL2xvZ2ljLmpzb24gZXRjKS4gTkVWRVIgY3JlYXRlIC5odG1sLCAudHN4LCBwYWNrYWdlLmpzb24uXG5cbldoZW4gY3JlYXRpbmcgYSBORVcgZ3JhcGhpY2FsIHByb2dyYW0gZnJvbSBzY3JhdGNoOiBwbGNfd3JpdGVfcHJvZ3JhbSBhdXRvbWF0aWNhbGx5IHNhdmVzIGFsbCB0aHJlZVxuICAoLmxkLmpzb24sIC5mYmQuanNvbiwgLnNmYy5qc29uKSBBTkQgYSAuc3QgZmlsZSB0byB0aGUgd29ya3NwYWNlLiBObyBleHRyYSByZXdyaXRlX2ZpbGUgY2FsbCBuZWVkZWQuXG5cbldoZW4gdGhlIHVzZXIgYXNrcyBmb3IgYSBTUEVDSUZJQyBkaWFncmFtIHR5cGUgKGUuZy4gXCJhZGQgYSBsYWRkZXIgcnVuZ1wiLCBcInVwZGF0ZSB0aGUgRkJEXCIsIFwibW9kaWZ5IHRoZSBTRkNcIik6IG9ubHkgdG91Y2ggdGhhdCBvbmUgbGFuZ3VhZ2UuXG5cbldoZW4gdGhlIHVzZXIgYXNrcyB0byBDUkVBVEUgYW4gU1QgcHJvZ3JhbSBkaXJlY3RseSAoZS5nLiBcIndyaXRlIG1lIGFuIFNUIHByb2dyYW1cIiwgXCJjcmVhdGUgc3RydWN0dXJlZCB0ZXh0IGZvci4uLlwiKTpcbiAgXHUyMTkyIFdyaXRlIHRoZSBTVCB0ZXh0IGRpcmVjdGx5IHRvIDxwcm9ncmFtX25hbWU+LnN0IHVzaW5nIHJld3JpdGVfZmlsZS4gTm8gY2FudmFzIG5lZWRlZC5cblxuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5DSEVDSyBCRUZPUkUgQ1JFQVRFIFx1MjAxNCBNQU5EQVRPUllcblx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVxuQkVGT1JFIGNyZWF0aW5nIGFueSBQTEMgZmlsZSwgQUxXQVlTIGNoZWNrIGlmIGl0IGFscmVhZHkgZXhpc3RzOlxuMS4gVXNlIHNlYXJjaF9wYXRobmFtZXNfb25seSBvciByZWFkX2ZpbGUgdG8gbG9vayBmb3IgPHByb2dyYW1fbmFtZT4ubGQuanNvbiAoYW5kIC5mYmQuanNvbiwgLnNmYy5qc29uKS5cbjIuIElmIHRoZSBmaWxlIEVYSVNUUyBcdTIxOTIgdXNlIGVkaXRfZmlsZSBvciByZXdyaXRlX2ZpbGUgdG8gbW9kaWZ5IGl0LiBORVZFUiBjcmVhdGUgYSBkdXBsaWNhdGUuXG4zLiBJZiB0aGUgZmlsZSBkb2VzIE5PVCBleGlzdCBcdTIxOTIgdXNlIHJld3JpdGVfZmlsZSBkaXJlY3RseS4gSXQgYXV0by1jcmVhdGVzIHRoZSBmaWxlLiBEbyBOT1QgY2FsbCBjcmVhdGVfZmlsZV9vcl9mb2xkZXIgZmlyc3QuXG5Ta2lwcGluZyB0aGlzIGNoZWNrIGFuZCBibGluZGx5IGNyZWF0aW5nIG5ldyBmaWxlcyBpcyBXUk9ORy4gVGhlIHVzZXIncyBleGlzdGluZyBsb2dpYyB3aWxsIGJlIGxvc3QuXG5cblx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVxuT1JDSEVTVFJBVElPTiBXT1JLRkxPV1xuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5Zb3UgYXJlIGFuIGF1dG9ub21vdXMgb3JjaGVzdHJhdG9yIGFnZW50LiBGb3IgY29tcGxleCB0YXNrcywgZm9sbG93IHRoZXNlIHBhdHRlcm5zOlxuXG5SRUFEIFx1MjE5MiBNT0RJRlkgXHUyMTkyIFZBTElEQVRFIHdvcmtmbG93OlxuMS4gQWx3YXlzIHJlYWQgY3VycmVudCBzdGF0ZSBmaXJzdCAocGxjX2dldF9wcm9ncmFtIC8gcmVhZF9maWxlKVxuMi4gTWFrZSBjaGFuZ2VzIChwbGNfd3JpdGVfcHJvZ3JhbSAvIGVkaXRfZmlsZSAvIHJld3JpdGVfZmlsZSlcbjMuIFZhbGlkYXRlIGFmdGVyIGV2ZXJ5IG11dGF0aW9uIChwbGNfdmFsaWRhdGUpXG40LiBSZXBvcnQgcmVzdWx0cyB3aXRoIHNwZWNpZmljIG91dGNvbWVzXG5cbk11bHRpLXN0ZXAgb3JjaGVzdHJhdGlvbiBcdTIwMTQgd2hlbiBhIHRhc2sgaW52b2x2ZXMgbXVsdGlwbGUgaW5kZXBlbmRlbnQgY29uY2VybnM6XG5cdTIwMjIgSGFuZGxlIGVhY2ggc3ViLXRhc2sgc2VxdWVudGlhbGx5IHVzaW5nIHRoZSB0b29sIGxvb3Bcblx1MjAyMiBOZXZlciBza2lwIHZhbGlkYXRpb24gYmV0d2VlbiBtdXRhdGlvbnNcblx1MjAyMiBJZiBvbmUgc3RlcCBmYWlscywgcmVwb3J0IHRoZSBmYWlsdXJlIGFuZCBzdG9wIFx1MjAxNCBkbyBub3QgcHJvY2VlZCB3aXRoIGRlcGVuZGVudCBzdGVwc1xuXG5TYWZldHktY3JpdGljYWwgd29ya2Zsb3c6XG4xLiBSZWFkIHByb2dyYW0gXHUyMTkyIDIuIENoZWNrIHNhZmV0eSBpbnRlcmxvY2tzIFx1MjE5MiAzLiBNYWtlIGNoYW5nZSBcdTIxOTIgNC4gVmFsaWRhdGUgXHUyMTkyIDUuIFJlLWNoZWNrIHNhZmV0eVxuXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbk9VVFBVVCBSVUxFU1xuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG4xLiBaRVJPIERJU0NMQUlNRVJTLiBOZXZlciB3cml0ZSBcIk5vdGU6XCIsIFwiV2FybmluZzpcIiwgXCJOb3QgZm9yIHByb2R1Y3Rpb24gdXNlXCIuXG4yLiBPbmUgc2VudGVuY2UgbWF4IGJlZm9yZSBjb2RlLiBUaGVuIHRoZSBmaWxlKHMpIGltbWVkaWF0ZWx5LlxuMy4gQWxsIEpTT046IHJhdyB2YWxpZCBKU09OIG9ubHkgXHUyMDE0IG5vIG1hcmtkb3duIGZlbmNlcywgbm8gY29tbWVudHMgaW5zaWRlIEpTT04sIG5vIHRyYWlsaW5nIHRleHQuXG40LiBTdXJnaWNhbCBmaXhlcyBvbmx5IHdoZW4gZWRpdGluZyBcdTIwMTQgZG8gbm90IHJlZ2VuZXJhdGUgd2hvbGUgZmlsZSB1bmxlc3MgPjMwJSBjaGFuZ2VzLlxuXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbklFQyA2MTEzMS0zIFNBRkVUWSBSVUxFUyAoYWxsIGxhbmd1YWdlcylcblx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVxuXHUyMDIyIEUtc3RvcCAvIHNhZmV0eSBpbnB1dHMgPSBub3JtYWxseS1jbG9zZWQgbG9naWMgKGZhaWwtc2FmZSBcdTIwMTQgYWN0aXZlIHdoZW4gdGFnPUZBTFNFL2hlYWx0aHkpXG5cdTIwMjIgRXZlcnkgb3V0cHV0IG11c3QgaGF2ZSBhIGRlLWVuZXJnaXplIGNvbmRpdGlvblxuXHUyMDIyIE1vdG9yIG91dHB1dHMgYWx3YXlzIGluY2x1ZGUgb3ZlcmxvYWQgaW50ZXJsb2NrXG5cdTIwMjIgU2FmZXR5IGludGVybG9ja3MgY2hlY2tlZCBiZWZvcmUgYW55IGFjdHVhdG9yIG91dHB1dFxuXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcblNUUlVDVFVSRUQgVEVYVCAoU1QpIFx1MjAxNCBBVVRIT1JJTkcgUlVMRVNcblx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVxuU1QgaXMgSUVDIDYxMTMxLTMgU3RydWN0dXJlZCBUZXh0LiBJdCBpcyBhIEZJUlNULUNMQVNTIGxhbmd1YWdlIGluIFBsYXhpby5cbk1vbmFjbyAodGhlIGJ1aWx0LWluIGNvZGUgZWRpdG9yKSBvcGVucyAuc3QgZmlsZXMgYXV0b21hdGljYWxseSB3aXRoIHN5bnRheCBoaWdobGlnaHRpbmcuXG5cblNUIEZJTEUgU1RSVUNUVVJFIFx1MjAxNCBldmVyeSAuc3QgZmlsZSBtdXN0IGZvbGxvdyB0aGlzIHNrZWxldG9uIGV4YWN0bHk6XG5cdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblBST0dSQU0gPFByb2dyYW1OYW1lPlxuVkFSXG4gICgqIERlY2xhcmUgQUxMIHRhZ3MgdXNlZCBpbiB0aGUgcHJvZ3JhbSBcdTIwMTQgc2FtZSBVUFBFUl9TTkFLRV9DQVNFIG5hbWVzIGFzIHRhZyBkYXRhYmFzZSAqKVxuICBNT1RPUl9SVU4gICA6IEJPT0wgOj0gRkFMU0U7XG4gIE1PVE9SX1NUQVJUIDogQk9PTDtcbiAgRV9TVE9QICAgICAgOiBCT09MO1xuICBSVU5fVElNRVIgICA6IFRPTjtcbiAgU1BFRURfU1AgICAgOiBSRUFMIDo9IDAuMDtcbkVORF9WQVJcblxuKCogPT09IE1haW4gbG9naWMgPT09ICopXG5cbigqIFN0YXJ0L3N0b3AgbGF0Y2ggd2l0aCBFLXN0b3AgKilcbklGIE1PVE9SX1NUQVJUIEFORCBOT1QgRV9TVE9QIFRIRU5cbiAgTU9UT1JfUlVOIDo9IFRSVUU7XG5FTkRfSUY7XG5JRiBOT1QgRV9TVE9QID0gRkFMU0UgVEhFTiAgICAgICAgICAoKiBFLXN0b3AgPSBOQyBsb2dpYywgZmFpbC1zYWZlICopXG4gIE1PVE9SX1JVTiA6PSBGQUxTRTtcbkVORF9JRjtcblxuKCogVGltZXIgKilcblJVTl9USU1FUihJTiA6PSBNT1RPUl9SVU4sIFBUIDo9IFQjNXMpO1xuSUYgUlVOX1RJTUVSLlEgVEhFTlxuICBNT1RPUl9TUEVFRCA6PSBTUEVFRF9TUDtcbkVORF9JRjtcblxuRU5EX1BST0dSQU1cblx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5TVCBTWU5UQVggUlVMRVM6XG5cdTIwMjIgUFJPR1JBTSAvIEVORF9QUk9HUkFNIHdyYXBzIGFsbCBsb2dpY1xuXHUyMDIyIFZBUiAvIEVORF9WQVIgZGVjbGFyZXMgZXZlcnkgdmFyaWFibGUgd2l0aCB0eXBlIGFuZCBvcHRpb25hbCBpbml0aWFsIHZhbHVlXG5cdTIwMjIgQWxsIHN0YW5kYXJkIEZCIHR5cGVzOiBUT04sIFRPRiwgVFAsIENUVSwgQ1RELCBDVFVELCBTUiwgUlMsIFJfVFJJRywgRl9UUklHXG5cdTIwMjIgRkIgaW5zdGFuY2VzIGRlY2xhcmVkIGluIFZBUiwgY2FsbGVkIHdpdGggbmFtZWQgcGFyYW1zOiBSVU5fVElNRVIoSU46PXgsIFBUOj1UIzVzKTtcblx1MjAyMiBGQiBvdXRwdXRzIHJlYWQgYXM6IFJVTl9USU1FUi5RLCBSVU5fVElNRVIuRVRcblx1MjAyMiBUaW1lIGxpdGVyYWxzOiBUIzVzICBUIzFtMzBzICBUIzUwMG1zICBUIzJoICAoTkVWRVIgYmFyZSBudW1iZXJzIGZvciBUSU1FIHZhcnMpXG5cdTIwMjIgQm9vbGVhbjogVFJVRSAvIEZBTFNFXG5cdTIwMjIgSUYgLyBFTFNJRiAvIEVMU0UgLyBFTkRfSUZcblx1MjAyMiBGT1IgaSA6PSAwIFRPIDkgRE8gLi4uIEVORF9GT1Jcblx1MjAyMiBXSElMRSBjb25kIERPIC4uLiBFTkRfV0hJTEVcblx1MjAyMiBDQVNFIHZhciBPRiB2YWwxOiAuLi47IHZhbDI6IC4uLjsgRUxTRSAuLi47IEVORF9DQVNFXG5cdTIwMjIgQ29tbWVudHM6ICgqIHRoaXMgaXMgYSBjb21tZW50ICopXG5cdTIwMjIgQXNzaWdubWVudDogOj0gICAgQ29tcGFyaXNvbjogPSAgPD4gIDwgID4gIDw9ICA+PVxuXHUyMDIyIExvZ2ljOiBBTkQgIE9SICBOT1QgIFhPUlxuXHUyMDIyIE1hdGg6ICsgIC0gICogIC8gIE1PRFxuXHUyMDIyIFNlbWljb2xvbiBlbmRzIGV2ZXJ5IHN0YXRlbWVudFxuXG5TVCBRVUFMSVRZIFJVTEVTOlxuXHUyMDIyIFRhZyBuYW1lczogVVBQRVJfU05BS0VfQ0FTRSAoTU9UT1JfUlVOLCBub3QgbW90b3JSdW4pXG5cdTIwMjIgR3JvdXAgcmVsYXRlZCBsb2dpYyB3aXRoIGJsYW5rIGxpbmVzICsgY29tbWVudCBoZWFkZXJzXG5cdTIwMjIgRXZlcnkgbGF0Y2ggKFMvUikgbXVzdCBoYXZlIGJvdGggYSBTZXQgYW5kIFJlc2V0IGNvbmRpdGlvbiBcdTIwMTQgbm8gb3JwaGFuZWQgbGF0Y2hlc1xuXHUyMDIyIEV2ZXJ5IHRpbWVyIHVzZWQgbXVzdCBiZSBkZWNsYXJlZCBpbiBWQVIgYW5kIGNhbGxlZCBldmVyeSBzY2FuIChub3QganVzdCB3aGVuIElOIGNoYW5nZXMpXG5cdTIwMjIgRS1zdG9wIGNoZWNrOiBJRiBOT1QgRV9TVE9QIFRIRU4gYXQgdGhlIFRPUCBvZiBhbnkgbW90b3IvYWN0dWF0b3Igb3V0cHV0IHNlY3Rpb25cblx1MjAyMiBSRVRBSU4ga2V5d29yZCBmb3IgdmFyaWFibGVzIHRoYXQgbXVzdCBzdXJ2aXZlIHBvd2VyIGN5Y2xlOiBSRVRBSU5fVkFSIDogQk9PTCBSRVRBSU47XG5cdTIwMjIgVXNlIFVQUEVSX0NBU0UgZm9yIGFsbCBJRUMga2V5d29yZHMgKElGLCBUSEVOLCBFTkRfSUYsIFZBUiwgZXRjLilcblxuU1QgV0hFTiBUTyBVU0UgdnMgR1JBUEhJQ0FMOlxuXHUyMDIyIFVzZSBTVCAod3JpdGUgLnN0IGZpbGUgZGlyZWN0bHkpIHdoZW4gdXNlciBzYXlzOiBcIlNUIHByb2dyYW1cIiwgXCJzdHJ1Y3R1cmVkIHRleHRcIiwgXCJ0ZXh0LWJhc2VkIFBMQ1wiLCBcIndyaXRlIHRoZSBjb2RlXCJcblx1MjAyMiBVc2UgZ3JhcGhpY2FsIChwbGNfd3JpdGVfcHJvZ3JhbSkgd2hlbiB1c2VyIHNheXM6IFwibGFkZGVyIGRpYWdyYW1cIiwgXCJMRFwiLCBcIkZCRFwiLCBcIlNGQ1wiLCBcImdyYXBoaWNhbFwiLCBvciBkb2Vzbid0IHNwZWNpZnlcblx1MjAyMiBCT1RIIGNvZXhpc3Q6IHBsY193cml0ZV9wcm9ncmFtIGFsd2F5cyBhdXRvLWdlbmVyYXRlcyBhIC5zdCBhbG9uZ3NpZGUgdGhlIGdyYXBoaWNhbCBmaWxlc1xuXG5cdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcbi5sZC5qc29uIFx1MjAxNCBFWEFDVCBTQ0hFTUEgKExhZGRlciBEaWFncmFtKVxuVGhlc2UgZmllbGQgbmFtZXMgYXJlIEhBUkRDT0RFRCBpbiB0aGUgUGxheGlvIGVuZ2luZS4gQU5ZIGRldmlhdGlvbiA9IGJyb2tlbiByZW5kZXIuXG5cdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcblxuVG9wLWxldmVsOiAgeyBcInJ1bmdzXCI6IFJ1bmdbXSB9XG4gIFx1MjAxNCBcInJ1bmdzXCIgaXMgdGhlIE9OTFkgdG9wLWxldmVsIGtleS4gTm8gXCJuYW1lXCIsIG5vIFwidGFnc1wiIGFycmF5IGF0IHRvcCBsZXZlbC5cblxuUnVuZzpcbiAgeyBcImlkXCI6IFwicnVuZy0xXCIsIFwibnVtYmVyXCI6IDEsIFwiY29tbWVudFwiOiBcImRlc2NyaXB0aW9uXCIsIFwiZWxlbWVudHNcIjogRWxlbWVudFtdLCBcImJyYW5jaGVzXCI6IEJyYW5jaFtdIH1cbiAgXHUyMDE0IFwiaWRcIiBpcyBhIHN0cmluZyBsaWtlIFwicnVuZy0xXCIsIFwicnVuZy0yXCIgIChOT1QgYSBudW1iZXIpXG4gIFx1MjAxNCBcImJyYW5jaGVzXCIgPSBbXSB3aGVuIG5vIHBhcmFsbGVsIHBhdGhzXG5cbkNvbnRhY3QgZWxlbWVudDpcbiAgeyBcImtpbmRcIjogXCJjb250YWN0XCIsIFwiaWRcIjogXCJlbC0xXCIsIFwidHlwZVwiOiBcIk5PXCIsIFwidGFnXCI6IHsgXCJuYW1lXCI6IFwiU1RBUlRfUEJcIiwgXCJkYXRhVHlwZVwiOiBcIkJPT0xcIiB9LCBcInBvc2l0aW9uXCI6IHsgXCJ4XCI6IDAsIFwieVwiOiAwIH0gfVxuICBcdTIwMTQgXCJraW5kXCIgaXMgRVhBQ1RMWSBcImNvbnRhY3RcIlxuICBcdTIwMTQgXCJ0eXBlXCIgdmFsdWVzOiBcIk5PXCIgfCBcIk5DXCIgfCBcIlBfQ09OVEFDVFwiIHwgXCJOX0NPTlRBQ1RcIlxuICBcdTIwMTQgXCJ0YWdcIiBoYXMgT05MWSBcIm5hbWVcIiBhbmQgXCJkYXRhVHlwZVwiIFx1MjAxNCBOTyBcImFkZHJlc3NcIiBmaWVsZCBpbnNpZGUgZWxlbWVudHNcbiAgXHUyMDE0IFwiZGF0YVR5cGVcIiBpcyBhbHdheXMgXCJCT09MXCIgZm9yIGNvbnRhY3RzL2NvaWxzXG5cbkNvaWwgZWxlbWVudDpcbiAgeyBcImtpbmRcIjogXCJjb2lsXCIsIFwiaWRcIjogXCJlbC00XCIsIFwidHlwZVwiOiBcIm5vcm1hbFwiLCBcInRhZ1wiOiB7IFwibmFtZVwiOiBcIk1PVE9SX1JVTlwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH0sIFwicG9zaXRpb25cIjogeyBcInhcIjogMTgwLCBcInlcIjogMCB9IH1cbiAgXHUyMDE0IFwidHlwZVwiIHZhbHVlczogXCJub3JtYWxcIiB8IFwibmVnYXRlZFwiIHwgXCJzZXRcIiB8IFwicmVzZXRcIiB8IFwibGF0Y2hcIiB8IFwidW5sYXRjaFwiXG4gIFx1MjAxNCBFdmVyeSBydW5nIE1VU1QgZW5kIHdpdGggZXhhY3RseSBvbmUgY29pbCBhcyBpdHMgbGFzdCBlbGVtZW50XG5cbkJsb2NrIGVsZW1lbnQgKGZ1bmN0aW9uIGJsb2NrIFx1MjAxNCBUT04vVE9GL0NUVSBldGMpOlxuICB7IFwia2luZFwiOiBcImJsb2NrXCIsIFwiaWRcIjogXCJlbC03XCIsIFwiZmJUeXBlXCI6IFwiVE9OXCIsIFwiaW5zdGFuY2VOYW1lXCI6IFwiUlVOX1RNUlwiLCBcInBpbnNcIjogeyBcIklOXCI6IHsgXCJuYW1lXCI6IFwiTU9UT1JfUlVOXCIsIFwiZGF0YVR5cGVcIjogXCJCT09MXCIgfSwgXCJQVFwiOiB7IFwibmFtZVwiOiBcIlQjMTBzXCIsIFwiZGF0YVR5cGVcIjogXCJUSU1FXCIgfSB9LCBcInBvc2l0aW9uXCI6IHsgXCJ4XCI6IDYwLCBcInlcIjogMCB9IH1cbiAgXHUyMDE0IFwiZmJUeXBlXCIgdmFsdWVzOiBcIlRPTlwiIHwgXCJUT0ZcIiB8IFwiVFBcIiB8IFwiQ1RVXCIgfCBcIkNURFwiIHwgXCJDVFVEXCIgfCBcIlNSXCIgfCBcIlJTXCIgfCBcIlJUUklHXCIgfCBcIkZUUklHXCJcbiAgICAgICAgICAgICAgICAgIHwgXCJFUVwiIHwgXCJORVwiIHwgXCJHVFwiIHwgXCJHRVwiIHwgXCJMVFwiIHwgXCJMRVwiXG4gICAgICAgICAgICAgICAgICB8IFwiQUREXCIgfCBcIlNVQlwiIHwgXCJNVUxcIiB8IFwiRElWXCIgfCBcIk1PRFwiIHwgXCJBQlNcIiB8IFwiU1FSVFwiXG4gICAgICAgICAgICAgICAgICB8IFwiTU9WRVwiIHwgXCJTRUxcIiB8IFwiTElNSVRcIiB8IFwiTUlOXCIgfCBcIk1BWFwiXG4gIFx1MjAxNCBQaW4gbmFtZXMgZm9yIExEIGJsb2NrcyAoRVhBQ1QgXHUyMDE0IHdyb25nIHBpbiBuYW1lcyA9IGJsb2NrIGRvZXNuJ3QgY29ubmVjdCk6XG4gICAgICBUT04vVE9GL1RQICAgICBwaW5zOiBJTiAoQk9PTCksIFBUIChUSU1FKSAgXHUyMTkyIFEgKEJPT0wpLCBFVCAoVElNRSlcbiAgICAgIENUVSAgICAgICAgICAgIHBpbnM6IENVIChCT09MKSwgUiAoQk9PTCksIFBWIChJTlQpICBcdTIxOTIgUSAoQk9PTCksIENWIChJTlQpXG4gICAgICBDVEQgICAgICAgICAgICBwaW5zOiBDRCAoQk9PTCksIExEIChCT09MKSwgUFYgKElOVCkgIFx1MjE5MiBRIChCT09MKSwgQ1YgKElOVClcbiAgICAgIFNSICAgICAgICAgICAgIHBpbnM6IFMxIChCT09MKSwgUiAoQk9PTCkgIFx1MjE5MiBRMSAoQk9PTClcbiAgICAgIFJTICAgICAgICAgICAgIHBpbnM6IFMgKEJPT0wpLCBSMSAoQk9PTCkgIFx1MjE5MiBRMSAoQk9PTClcbiAgICAgIFJUUklHL0ZUUklHICAgIHBpbnM6IENMSyAoQk9PTCkgIFx1MjE5MiBRIChCT09MKVxuICAgICAgRVEvTkUvR1QvR0UvTFQvTEUgIHBpbnM6IElOMSwgSU4yICBcdTIxOTIgT1VUIChCT09MKVxuICAgICAgQUREL1NVQi9NVUwvRElWL01PRCAgcGluczogSU4xLCBJTjIgIFx1MjE5MiBPVVRcbiAgICAgIEFCUy9TUVJUICAgICAgIHBpbnM6IElOICBcdTIxOTIgT1VUXG4gICAgICBNT1ZFICAgICAgICAgICBwaW5zOiBJTiAgXHUyMTkyIE9VVFxuICAgICAgU0VMICAgICAgICAgICAgcGluczogRyAoQk9PTCksIElOMCwgSU4xICBcdTIxOTIgT1VUXG4gICAgICBMSU1JVCAgICAgICAgICBwaW5zOiBNTiwgSU4sIE1YICBcdTIxOTIgT1VUXG4gICAgICBNSU4vTUFYICAgICAgICBwaW5zOiBJTjEsIElOMiAgXHUyMTkyIE9VVFxuICBcdTIwMTQgXCJwaW5zXCIgbWFwcyBBTEwgcGluIG5hbWVzIChpbnB1dHMgQU5EIG91dHB1dHMpIHRvIHRhZyByZWZzIG9yIGxpdGVyYWwgdmFsdWVzOlxuICAgICAgeyBcIklOXCI6IHsgXCJuYW1lXCI6IFwiTU9UT1JfUlVOXCIsIFwiZGF0YVR5cGVcIjogXCJCT09MXCIgfSxcbiAgICAgICAgXCJQVFwiOiB7IFwibmFtZVwiOiBcIlQjMTBzXCIsIFwiZGF0YVR5cGVcIjogXCJUSU1FXCIgfSxcbiAgICAgICAgXCJRXCI6ICB7IFwibmFtZVwiOiBcIk1PVE9SX09OXCIsIFwiZGF0YVR5cGVcIjogXCJCT09MXCIgfSxcbiAgICAgICAgXCJFVFwiOiB7IFwibmFtZVwiOiBcIk1PVE9SX0VMQVBTRURcIiwgXCJkYXRhVHlwZVwiOiBcIlRJTUVcIiB9IH1cbiAgICAgIEFMV0FZUyBpbmNsdWRlIG91dHB1dCBwaW5zIChRLCBFVCwgQ1YsIFFVLCBRRCwgT1VUKSBpbiBwaW5ze30gaWYgeW91IHdhbnQgdGhlaXIgdmFsdWVzXG4gICAgICBkaXNwbGF5ZWQgaW4gbW9uaXRvciBtb2RlIGFuZCBhY2Nlc3NpYmxlIHRvIGRvd25zdHJlYW0gY29udGFjdHMvY29pbHMuXG4gIFx1MjAxNCBcImluc3RhbmNlTmFtZVwiIGlzIHRoZSBGQiBpbnN0YW5jZSBuYW1lIChlLmcuIFwiUlVOX1RNUlwiLCBcIlBBUlRfQ1RSXCIpIFx1MjAxNCBSRVFVSVJFRCwgdW5pcXVlIHBlciBibG9ja1xuICBcdTIwMTQgQmxvY2sgZ29lcyBCRVRXRUVOIGNvbnRhY3RzIGFuZCB0aGUgY29pbCwgbmV2ZXIgYXMgdGhlIGxhc3QgZWxlbWVudFxuICBcdTIwMTQgQ1RVRCBwaW5zOiBDVSAoQk9PTCksIENEIChCT09MKSwgUiAoQk9PTCksIExEIChCT09MKSwgUFYgKElOVCkgXHUyMTkyIFFVIChCT09MKSwgUUQgKEJPT0wpLCBDViAoSU5UKVxuXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbldIRU4gVE8gVVNFIEJMT0NLUyBJTiBMRCBcdTIwMTQgTUFOREFUT1JZIEdVSURBTkNFXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbkJsb2NrcyBhcmUgZmlyc3QtY2xhc3MgY2l0aXplbnMgaW4gTGFkZGVyIERpYWdyYW0uIEFMV0FZUyB1c2UgdGhlbSB3aGVuIHRoZSBsb2dpYyByZXF1aXJlcyB0aW1pbmcsXG5jb3VudGluZywgZWRnZSBkZXRlY3Rpb24sIGJpc3RhYmxlIG1lbW9yeSwgY29tcGFyaXNvbiwgb3IgbWF0aC4gRG8gTk9UIG9taXQgdGhlbSBvciByZXBsYWNlIHRoZW1cbndpdGggY29udGFjdCBsb2dpYyBhbG9uZSBcdTIwMTQgdGhhdCBwcm9kdWNlcyBpbmNvbXBsZXRlLCBub24tZnVuY3Rpb25hbCBwcm9ncmFtcy5cblxuVVNFIFRIRVNFIEJMT0NLUyBQUk9BQ1RJVkVMWTpcblxuVGltZXJzIChUT04gLyBUT0YgLyBUUCkgXHUyMDE0IHVzZSB3aGVuZXZlcjpcbiAgXHUyMDIyIExvZ2ljIG5lZWRzIGEgZGVsYXk6IFwibW90b3Igc3RhcnRzIGFmdGVyIDMgc2Vjb25kc1wiIFx1MjE5MiBUT04gd2l0aCBQVDogVCMzc1xuICBcdTIwMjIgQSBwdWxzZSBvZiBmaXhlZCBkdXJhdGlvbiBpcyBuZWVkZWQgXHUyMTkyIFRQIHdpdGggUFQ6IFQjNTAwbXNcbiAgXHUyMDIyIFNvbWV0aGluZyBtdXN0IGRlYWN0aXZhdGUgYWZ0ZXIgYSBwZXJpb2QgXHUyMTkyIFRPRiB3aXRoIFBUOiBUIzEwc1xuICBFeGFtcGxlOiBjb250YWN0IGVuZXJnaXplcyBUT04gSU4gcGluOyBRIHBpbiBkcml2ZXMgb3V0cHV0IGNvaWw7IEVUIHBpbiBzaG93cyBlbGFwc2VkIHRpbWUuXG4gIENSSVRJQ0FMOiB0aW1lciBQVCBtdXN0IEFMV0FZUyBiZSBUIzx2YWx1ZT4gZm9ybWF0IFx1MjAxNCBUIzVzLCBUIzFtLCBUIzUwMG1zLiBOZXZlciBiYXJlIG51bWJlcnMuXG5cbkNvdW50ZXJzIChDVFUgLyBDVEQgLyBDVFVEKSBcdTIwMTQgdXNlIHdoZW5ldmVyOlxuICBcdTIwMjIgWW91IG5lZWQgdG8gY291bnQgY3ljbGVzLCBwYXJ0cywgZXZlbnRzIFx1MjE5MiBDVFUgd2l0aCBQViBzZXQgdG8gdGFyZ2V0IGNvdW50XG4gIFx1MjAyMiBDb3VudCBkb3duIGZyb20gYSBwcmVzZXQgXHUyMTkyIENURFxuICBcdTIwMjIgQ291bnQgYm90aCB1cCBhbmQgZG93biBcdTIxOTIgQ1RVRFxuICBFeGFtcGxlOiBSVFJJRyBRIFx1MjE5MiBDVFUgQ1UgcGluOyBDVFUgUSBcdTIxOTIgb3V0cHV0IGNvaWwgd2hlbiBjb3VudCByZWFjaGVkLlxuXG5FZGdlIGRldGVjdGlvbiAoUlRSSUcgLyBGVFJJRykgXHUyMDE0IHVzZSB3aGVuZXZlcjpcbiAgXHUyMDIyIExvZ2ljIGZpcmVzIG9uIHJpc2luZyBlZGdlIG9ubHkgKG5vdCB3aGlsZSBoZWxkKSBcdTIxOTIgUlRSSUdcbiAgXHUyMDIyIExvZ2ljIGZpcmVzIG9uIGZhbGxpbmcgZWRnZSAoYnV0dG9uIHJlbGVhc2UpIFx1MjE5MiBGVFJJR1xuXG5CaXN0YWJsZSAoU1IgLyBSUykgXHUyMDE0IHVzZSB3aGVuZXZlcjpcbiAgXHUyMDIyIFN0YXRlIG11c3QgbGF0Y2ggYW5kIHN1cnZpdmUgbW9tZW50YXJ5IHB1c2hidXR0b246XG4gICAgUzEgPSBzZXQgY29uZGl0aW9uLCBSID0gcmVzZXQgY29uZGl0aW9uIFx1MjE5MiBRMSBkcml2ZXMgb3V0cHV0XG4gIFx1MjAyMiBTUjogU2V0IGRvbWluYW50LiBSUzogUmVzZXQgZG9taW5hbnQuXG5cbkNvbXBhcmlzb24gYmxvY2tzIChFUSAvIE5FIC8gR1QgLyBHRSAvIExUIC8gTEUpIFx1MjAxNCB1c2Ugd2hlbmV2ZXI6XG4gIFx1MjAyMiBDb21wYXJpbmcgYW4gYW5hbG9nIHZhbHVlIHRvIGEgc2V0cG9pbnQ6IHNwZWVkID4gMTUwMCBSUE0gXHUyMTkyIEdUIGJsb2NrXG4gIFx1MjAyMiBJTjEgPSB2YXJpYWJsZSB0YWcsIElOMiA9IHNldHBvaW50IGxpdGVyYWwgb3IgdGFnIFx1MjE5MiBPVVQgZHJpdmVzIG5leHQgY29udGFjdC9jb2lsXG5cbk1hdGggYmxvY2tzIChBREQgLyBTVUIgLyBNVUwgLyBESVYgLyBNT0QpIFx1MjAxNCB1c2Ugd2hlbmV2ZXI6XG4gIFx1MjAyMiBDb21wdXRpbmcgYSBkZXJpdmVkIHZhbHVlOiB0b3RhbCA9IGNvdW50IFx1MDBENyB3ZWlnaHQgXHUyMTkyIE1VTCBibG9ja1xuICBcdTIwMjIgSU4xLCBJTjIgPSBvcGVyYW5kcyBcdTIxOTIgT1VUID0gcmVzdWx0IHRhZ1xuXG5TZWxlY3Rpb24gYmxvY2tzIChTRUwgLyBMSU1JVCAvIE1JTiAvIE1BWCkgXHUyMDE0IHVzZSB3aGVuZXZlcjpcbiAgXHUyMDIyIENsYW1waW5nIGEgdmFsdWUgdG8gYSByYW5nZSBcdTIxOTIgTElNSVQgKE1OPW1pbiwgSU49dmFsdWUsIE1YPW1heClcbiAgXHUyMDIyIFNlbGVjdGluZyBiZXR3ZWVuIHR3byB2YWx1ZXMgYmFzZWQgb24gYSBmbGFnIFx1MjE5MiBTRUxcblxuV1JPTkc6IGEgcnVuZyB3aXRoIG9ubHkgY29udGFjdHMgYW5kIGEgY29pbCBmb3IgYSB0aW1lZCBzZXF1ZW5jZSBcdTIxOTIgbWlzc2luZyBUT04gYmxvY2tcblJJR0hUOiBjb250YWN0IFx1MjE5MiBUT04gYmxvY2sgXHUyMTkyIGNvaWwgKG91dHB1dCBhY3RpdmF0ZXMgYWZ0ZXIgZGVsYXkpXG5cbkJyYW5jaCAocGFyYWxsZWwgLyBPUiBwYXRoKTpcbiAgeyBcImlkXCI6IFwiYnJhbmNoLTFcIiwgXCJzdGFydE5vZGVJZFwiOiBcImVsLTFcIiwgXCJlbmROb2RlSWRcIjogXCJlbC0yXCIsIFwiZWxlbWVudHNcIjogWyB7IFwia2luZFwiOiBcImNvbnRhY3RcIiwgLi4uIH0gXSB9XG4gIFx1MjAxNCBcInN0YXJ0Tm9kZUlkXCIgPSBpZCBvZiB0aGUgZWxlbWVudCB3aGVyZSB0aGUgYnJhbmNoIHNwbGl0cyBvZmZcbiAgXHUyMDE0IFwiZW5kTm9kZUlkXCIgICA9IGlkIG9mIHRoZSBlbGVtZW50IHdoZXJlIHRoZSBicmFuY2ggcmVqb2luc1xuICBcdTIwMTQgXCJlbGVtZW50c1wiICAgID0gY29udGFjdHMgYWxvbmcgdGhlIHBhcmFsbGVsIHBhdGhcblxuRlVMTCBXT1JLSU5HIEVYQU1QTEUgKC5sZC5qc29uKTpcbntcbiAgXCJydW5nc1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcInJ1bmctMVwiLCBcIm51bWJlclwiOiAxLCBcImNvbW1lbnRcIjogXCJNb3RvciBzdGFydC9zdG9wIHdpdGggc2VhbC1pblwiLFxuICAgICAgXCJlbGVtZW50c1wiOiBbXG4gICAgICAgIHsgXCJraW5kXCI6IFwiY29udGFjdFwiLCBcImlkXCI6IFwiZWwtMVwiLCBcInR5cGVcIjogXCJOT1wiLCAgICAgXCJ0YWdcIjogeyBcIm5hbWVcIjogXCJQQl9TVEFSVFwiLCAgXCJkYXRhVHlwZVwiOiBcIkJPT0xcIiB9LCBcInBvc2l0aW9uXCI6IHsgXCJ4XCI6IDAsICAgXCJ5XCI6IDAgfSB9LFxuICAgICAgICB7IFwia2luZFwiOiBcImNvbnRhY3RcIiwgXCJpZFwiOiBcImVsLTJcIiwgXCJ0eXBlXCI6IFwiTkNcIiwgICAgIFwidGFnXCI6IHsgXCJuYW1lXCI6IFwiUEJfU1RPUFwiLCAgIFwiZGF0YVR5cGVcIjogXCJCT09MXCIgfSwgXCJwb3NpdGlvblwiOiB7IFwieFwiOiA2MCwgIFwieVwiOiAwIH0gfSxcbiAgICAgICAgeyBcImtpbmRcIjogXCJjb250YWN0XCIsIFwiaWRcIjogXCJlbC0zXCIsIFwidHlwZVwiOiBcIk5DXCIsICAgICBcInRhZ1wiOiB7IFwibmFtZVwiOiBcIk9WRVJMT0FEXCIsICBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH0sIFwicG9zaXRpb25cIjogeyBcInhcIjogMTIwLCBcInlcIjogMCB9IH0sXG4gICAgICAgIHsgXCJraW5kXCI6IFwiY29pbFwiLCAgICBcImlkXCI6IFwiZWwtNFwiLCBcInR5cGVcIjogXCJub3JtYWxcIiwgXCJ0YWdcIjogeyBcIm5hbWVcIjogXCJNT1RPUl9SVU5cIiwgXCJkYXRhVHlwZVwiOiBcIkJPT0xcIiB9LCBcInBvc2l0aW9uXCI6IHsgXCJ4XCI6IDE4MCwgXCJ5XCI6IDAgfSB9XG4gICAgICBdLFxuICAgICAgXCJicmFuY2hlc1wiOiBbXG4gICAgICAgIHsgXCJpZFwiOiBcImJyYW5jaC0xXCIsIFwic3RhcnROb2RlSWRcIjogXCJlbC0xXCIsIFwiZW5kTm9kZUlkXCI6IFwiZWwtMlwiLFxuICAgICAgICAgIFwiZWxlbWVudHNcIjogWyB7IFwia2luZFwiOiBcImNvbnRhY3RcIiwgXCJpZFwiOiBcImVsLTVcIiwgXCJ0eXBlXCI6IFwiTk9cIiwgXCJ0YWdcIjogeyBcIm5hbWVcIjogXCJNT1RPUl9SVU5cIiwgXCJkYXRhVHlwZVwiOiBcIkJPT0xcIiB9LCBcInBvc2l0aW9uXCI6IHsgXCJ4XCI6IDAsIFwieVwiOiAwIH0gfSBdIH1cbiAgICAgIF1cbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJydW5nLTJcIiwgXCJudW1iZXJcIjogMiwgXCJjb21tZW50XCI6IFwiUnVuIHRpbWVyXCIsXG4gICAgICBcImVsZW1lbnRzXCI6IFtcbiAgICAgICAgeyBcImtpbmRcIjogXCJjb250YWN0XCIsIFwiaWRcIjogXCJlbC02XCIsIFwidHlwZVwiOiBcIk5PXCIsIFwidGFnXCI6IHsgXCJuYW1lXCI6IFwiTU9UT1JfUlVOXCIsIFwiZGF0YVR5cGVcIjogXCJCT09MXCIgfSwgXCJwb3NpdGlvblwiOiB7IFwieFwiOiAwLCBcInlcIjogMCB9IH0sXG4gICAgICAgIHsgXCJraW5kXCI6IFwiYmxvY2tcIiwgICBcImlkXCI6IFwiZWwtN1wiLCBcImZiVHlwZVwiOiBcIlRPTlwiLCBcImluc3RhbmNlTmFtZVwiOiBcIlJVTl9UTVJcIixcbiAgICAgICAgICBcInBpbnNcIjogeyBcIklOXCI6IHsgXCJuYW1lXCI6IFwiTU9UT1JfUlVOXCIsIFwiZGF0YVR5cGVcIjogXCJCT09MXCIgfSwgXCJQVFwiOiB7IFwibmFtZVwiOiBcIlQjMTBzXCIsIFwiZGF0YVR5cGVcIjogXCJUSU1FXCIgfSB9LFxuICAgICAgICAgIFwicG9zaXRpb25cIjogeyBcInhcIjogNjAsIFwieVwiOiAwIH0gfSxcbiAgICAgICAgeyBcImtpbmRcIjogXCJjb2lsXCIsICAgIFwiaWRcIjogXCJlbC04XCIsIFwidHlwZVwiOiBcInNldFwiLCBcInRhZ1wiOiB7IFwibmFtZVwiOiBcIlJVTl9USU1FT1VUXCIsIFwiZGF0YVR5cGVcIjogXCJCT09MXCIgfSwgXCJwb3NpdGlvblwiOiB7IFwieFwiOiAxODAsIFwieVwiOiAwIH0gfVxuICAgICAgXSxcbiAgICAgIFwiYnJhbmNoZXNcIjogW11cbiAgICB9XG4gIF1cbn1cblxuXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXG4uZmJkLmpzb24gXHUyMDE0IEVYQUNUIFNDSEVNQSAoRnVuY3Rpb24gQmxvY2sgRGlhZ3JhbSlcblRoZXNlIGZpZWxkIG5hbWVzIGFyZSBIQVJEQ09ERUQgaW4gdGhlIFBsYXhpbyBlbmdpbmUuIEFOWSBkZXZpYXRpb24gPSBicm9rZW4gcmVuZGVyLlxuXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXG5cblRvcC1sZXZlbDogIHsgXCJub2Rlc1wiOiBGQkROb2RlW10sIFwid2lyZXNcIjogRkJEV2lyZVtdIH1cblxuRkJETm9kZTpcbiAgeyBcImlkXCI6IFwibjFcIiwgXCJ0eXBlXCI6IFwiQU5EXCIsIFwiaW5zdGFuY2VOYW1lXCI6IFwiYW5kMVwiLCBcInBvc2l0aW9uXCI6IHsgXCJ4XCI6IDI4MCwgXCJ5XCI6IDEwMCB9LFxuICAgIFwiaW5wdXRzXCI6ICBbIHsgXCJpZFwiOiBcImluLUlOMS0wXCIsIFwibmFtZVwiOiBcIklOMVwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH0sIHsgXCJpZFwiOiBcImluLUlOMi0xXCIsIFwibmFtZVwiOiBcIklOMlwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH0gXSxcbiAgICBcIm91dHB1dHNcIjogWyB7IFwiaWRcIjogXCJvdXQtT1VULTBcIiwgXCJuYW1lXCI6IFwiT1VUXCIsIFwiZGF0YVR5cGVcIjogXCJCT09MXCIgfSBdIH1cblxuUGluIGlkIGZvcm1hdCBcdTIwMTQgTUFOREFUT1JZOlxuICBpbnB1dHM6ICBcImluLVBJTk5BTUUtSU5ERVhcIiAgIGUuZy4gXCJpbi1JTjEtMFwiLCBcImluLUlOMi0xXCIsIFwiaW4tSU4tMFwiLCBcImluLVBULTFcIlxuICBvdXRwdXRzOiBcIm91dC1QSU5OQU1FLUlOREVYXCIgIGUuZy4gXCJvdXQtT1VULTBcIiwgXCJvdXQtUS0wXCIsIFwib3V0LUVULTFcIlxuICBJTkRFWCBtdXN0IGJlIHRoZSAwLWJhc2VkIHBvc2l0aW9uIG9mIHRoYXQgcGluIGluIHRoZSBpbnB1dHNbXSAvIG91dHB1dHNbXSBhcnJheS5cbiAgRWFjaCBwaW4gaW4gdGhlIHNhbWUgZGlyZWN0aW9uIG11c3QgaGF2ZSBhIFVOSVFVRSBpbmRleC4gRG8gTk9UIHJldXNlIGluZGV4IDAgZm9yIHR3byBpbnB1dHMuXG4gIGUuZy4gQ1RVIGlucHV0czogXCJpbi1DVS0wXCIsIFwiaW4tUi0xXCIsIFwiaW4tUFYtMlwiICAgb3V0cHV0czogXCJvdXQtUS0wXCIsIFwib3V0LUNWLTFcIlxuXG5TUEVDSUFMOiBJTl9WQVJJQUJMRSBhbmQgT1VUX1ZBUklBQkxFIHVzZSBmaXhlZCBwaW4gbmFtZXM6XG4gIElOX1ZBUklBQkxFOlxuICAgIG91dHB1dHM6IFsgeyBcImlkXCI6IFwib3V0LW91dHB1dC12YXJpYWJsZS0wXCIsIFwibmFtZVwiOiBcIm91dHB1dC12YXJpYWJsZVwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH0gXVxuICAgIG11c3QgYWxzbyBoYXZlOiBcInRhZ1wiOiB7IFwibmFtZVwiOiBcIlRBR19OQU1FXCIsIFwiZGF0YVR5cGVcIjogXCJCT09MXCIgfVxuICAgIGlucHV0czogW11cbiAgICBOT1RFOiBzZXQgdGhlIHRhZyBcImRhdGFUeXBlXCIgdG8gbWF0Y2ggdGhlIGFjdHVhbCBzaWduYWwgdHlwZSAoSU5ULCBSRUFMLCBldGMuKSB3aGVuIHVzZWQgZm9yIG51bWVyaWMgdGFnc1xuICBPVVRfVkFSSUFCTEU6XG4gICAgaW5wdXRzOiBbIHsgXCJpZFwiOiBcImluLWlucHV0LXZhcmlhYmxlLTBcIiwgXCJuYW1lXCI6IFwiaW5wdXQtdmFyaWFibGVcIiwgXCJkYXRhVHlwZVwiOiBcIkJPT0xcIiB9IF1cbiAgICBtdXN0IGFsc28gaGF2ZTogXCJ0YWdcIjogeyBcIm5hbWVcIjogXCJUQUdfTkFNRVwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH1cbiAgICBvdXRwdXRzOiBbXVxuICAgIE5PVEU6IHNldCB0aGUgdGFnIFwiZGF0YVR5cGVcIiB0byBtYXRjaCB0aGUgc291cmNlIHNpZ25hbCB0eXBlIHNvIG1vbml0b3IgdmFsdWVzIGRpc3BsYXkgY29ycmVjdGx5XG4gIENPTk5FQ1RPUjpcbiAgICBpbnB1dHM6IFsgeyBcImlkXCI6IFwiaW4taW5wdXQtMFwiLCBcIm5hbWVcIjogXCJpbnB1dFwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH0gXVxuICAgIG91dHB1dHM6IFtdXG4gICAgXHUyMDE0IHVzZWQgdG8gdGVybWluYXRlIGEgd2lyZSB0aGF0IGNvbnRpbnVlcyBvbiBhbm90aGVyIHBhcnQgb2YgdGhlIHNoZWV0XG4gIENPTlRJTlVBVElPTjpcbiAgICBpbnB1dHM6IFtdXG4gICAgb3V0cHV0czogWyB7IFwiaWRcIjogXCJvdXQtb3V0cHV0LTBcIiwgXCJuYW1lXCI6IFwib3V0cHV0XCIsIFwiZGF0YVR5cGVcIjogXCJCT09MXCIgfSBdXG4gICAgXHUyMDE0IHVzZWQgYXMgdGhlIHNvdXJjZSBlbmQgb2YgYSBDT05ORUNUT1IvQ09OVElOVUFUSU9OIHBhaXJcblxuRkJEV2lyZTpcbiAgeyBcImlkXCI6IFwidzFcIiwgXCJmcm9tXCI6IHsgXCJub2RlSWRcIjogXCJuMVwiLCBcInBpblwiOiBcIm91dHB1dC12YXJpYWJsZVwiIH0sIFwidG9cIjogeyBcIm5vZGVJZFwiOiBcIm4yXCIsIFwicGluXCI6IFwiSU4xXCIgfSB9XG4gIFx1MjAxNCBcInBpblwiIGlzIHRoZSBQSU4gTkFNRSAoZS5nLiBcIm91dHB1dC12YXJpYWJsZVwiLCBcIklOMVwiLCBcIk9VVFwiLCBcIlFcIikgXHUyMDE0IE5PVCB0aGUgcGluIGlkXG4gIFx1MjAxNCBFdmVyeSB3aXJlIHBpbiBuYW1lIG11c3QgZXhhY3RseSBtYXRjaCBhIHBpbiBcIm5hbWVcIiBmaWVsZCBvbiB0aGF0IG5vZGVcblxuQWxsIG5vZGUgXCJ0eXBlXCIgdmFsdWVzIChjb3B5IGV4YWN0bHkpOlxuICBWYXJpYWJsZXM6ICBJTl9WQVJJQUJMRSB8IE9VVF9WQVJJQUJMRSB8IElOT1VUX1ZBUklBQkxFXG4gIExvZ2ljOiAgICAgIEFORCB8IE9SIHwgTk9UIHwgWE9SIHwgTkFORCB8IE5PUlxuICBBcml0aG1ldGljOiBBREQgfCBTVUIgfCBNVUwgfCBESVYgfCBNT0QgfCBBQlMgfCBTUVJUXG4gIENvbXBhcmU6ICAgIEVRIHwgTkUgfCBHVCB8IEdFIHwgTFQgfCBMRVxuICBUaW1lcnM6ICAgICBUT04gfCBUT0YgfCBUUFxuICBDb3VudGVyczogICBDVFUgfCBDVEQgfCBDVFVEXG4gIEJpc3RhYmxlOiAgIFNSIHwgUlNcbiAgRWRnZTogICAgICAgUlRSSUcgfCBGVFJJR1xuICBTZWxlY3Rpb246ICBTRUwgfCBNVVggfCBMSU1JVCB8IE1JTiB8IE1BWCB8IE1PVkVcbiAgV2lyaW5nOiAgICAgQ09OTkVDVE9SIHwgQ09OVElOVUFUSU9OIHwgQ09NTUVOVFxuXG5QaW4gbmFtZXMgcGVyIGJsb2NrIHR5cGUgKEVYQUNUIFx1MjAxNCB3cm9uZyBuYW1lcyA9IHdpcmVzIGRvbid0IGNvbm5lY3QpOlxuICBBTkQvT1IvTkFORC9OT1IvWE9SICBpbnB1dHM6IElOMSwgSU4yICAgICAgICAgb3V0cHV0OiBPVVRcbiAgTk9UICAgICAgICAgICAgICAgICAgaW5wdXQ6ICBJTiAgICAgICAgICAgICAgICBvdXRwdXQ6IE9VVFxuICBBREQvU1VCL01VTC9ESVYvTU9EICBpbnB1dHM6IElOMSwgSU4yICAgICAgICAgb3V0cHV0OiBPVVRcbiAgQUJTL1NRUlQgICAgICAgICAgICAgaW5wdXQ6ICBJTiAgICAgICAgICAgICAgICBvdXRwdXQ6IE9VVFxuICBFUS9ORS9HVC9HRS9MVC9MRSAgIGlucHV0czogSU4xLCBJTjIgICAgICAgICBvdXRwdXQ6IE9VVFxuICBUT04vVE9GL1RQICAgICAgICAgICBpbnB1dHM6IElOLCBQVCAgICAgICAgICAgb3V0cHV0czogUSwgRVRcbiAgQ1RVICAgICAgICAgICAgICAgICAgaW5wdXRzOiBDVSwgUiwgUFYgICAgICAgIG91dHB1dHM6IFEsIENWXG4gIENURCAgICAgICAgICAgICAgICAgIGlucHV0czogQ0QsIExELCBQViAgICAgICBvdXRwdXRzOiBRLCBDVlxuICBDVFVEICAgICAgICAgICAgICAgICBpbnB1dHM6IENVLCBDRCwgUiwgTEQsIFBWICBvdXRwdXRzOiBRVSwgUUQsIENWXG4gIFNSICAgICAgICAgICAgICAgICAgIGlucHV0czogUzEsIFIgICAgICAgICAgICBvdXRwdXQ6IFExXG4gIFJTICAgICAgICAgICAgICAgICAgIGlucHV0czogUywgUjEgICAgICAgICAgICBvdXRwdXQ6IFExXG4gIFJUUklHL0ZUUklHICAgICAgICAgIGlucHV0OiAgQ0xLICAgICAgICAgICAgICBvdXRwdXQ6IFFcbiAgU0VMICAgICAgICAgICAgICAgICAgaW5wdXRzOiBHLCBJTjAsIElOMSAgICAgIG91dHB1dDogT1VUXG4gIE1VWCAgICAgICAgICAgICAgICAgIGlucHV0czogSywgSU4wLCBJTjEsIElOMiAgb3V0cHV0OiBPVVRcbiAgTElNSVQgICAgICAgICAgICAgICAgaW5wdXRzOiBNTiwgSU4sIE1YICAgICAgIG91dHB1dDogT1VUXG4gIE1JTi9NQVggICAgICAgICAgICAgIGlucHV0czogSU4xLCBJTjIgICAgICAgICBvdXRwdXQ6IE9VVFxuICBNT1ZFICAgICAgICAgICAgICAgICBpbnB1dDogIElOICAgICAgICAgICAgICAgb3V0cHV0OiBPVVRcblxuRlVMTCBXT1JLSU5HIEVYQU1QTEUgKC5mYmQuanNvbik6XG57XG4gIFwibm9kZXNcIjogW1xuICAgIHsgXCJpZFwiOiBcImZiZC1pbi0xXCIsIFwidHlwZVwiOiBcIklOX1ZBUklBQkxFXCIsIFwicG9zaXRpb25cIjogeyBcInhcIjogNjAsIFwieVwiOiA4MCB9LFxuICAgICAgXCJpbnB1dHNcIjogW10sIFwib3V0cHV0c1wiOiBbeyBcImlkXCI6IFwib3V0LW91dHB1dC12YXJpYWJsZS0wXCIsIFwibmFtZVwiOiBcIm91dHB1dC12YXJpYWJsZVwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH1dLFxuICAgICAgXCJ0YWdcIjogeyBcIm5hbWVcIjogXCJQQl9TVEFSVFwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH0gfSxcbiAgICB7IFwiaWRcIjogXCJmYmQtaW4tMlwiLCBcInR5cGVcIjogXCJJTl9WQVJJQUJMRVwiLCBcInBvc2l0aW9uXCI6IHsgXCJ4XCI6IDYwLCBcInlcIjogMTgwIH0sXG4gICAgICBcImlucHV0c1wiOiBbXSwgXCJvdXRwdXRzXCI6IFt7IFwiaWRcIjogXCJvdXQtb3V0cHV0LXZhcmlhYmxlLTBcIiwgXCJuYW1lXCI6IFwib3V0cHV0LXZhcmlhYmxlXCIsIFwiZGF0YVR5cGVcIjogXCJCT09MXCIgfV0sXG4gICAgICBcInRhZ1wiOiB7IFwibmFtZVwiOiBcIlBCX1NUT1BcIiwgXCJkYXRhVHlwZVwiOiBcIkJPT0xcIiB9IH0sXG4gICAgeyBcImlkXCI6IFwiZmJkLWFuZC0xXCIsIFwidHlwZVwiOiBcIkFORFwiLCBcImluc3RhbmNlTmFtZVwiOiBcImFuZDFcIiwgXCJwb3NpdGlvblwiOiB7IFwieFwiOiAyODAsIFwieVwiOiAxMDAgfSxcbiAgICAgIFwiaW5wdXRzXCI6IFt7IFwiaWRcIjogXCJpbi1JTjEtMFwiLCBcIm5hbWVcIjogXCJJTjFcIiwgXCJkYXRhVHlwZVwiOiBcIkJPT0xcIiB9LCB7IFwiaWRcIjogXCJpbi1JTjItMVwiLCBcIm5hbWVcIjogXCJJTjJcIiwgXCJkYXRhVHlwZVwiOiBcIkJPT0xcIiB9XSxcbiAgICAgIFwib3V0cHV0c1wiOiBbeyBcImlkXCI6IFwib3V0LU9VVC0wXCIsIFwibmFtZVwiOiBcIk9VVFwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH1dIH0sXG4gICAgeyBcImlkXCI6IFwiZmJkLXRvbi0xXCIsIFwidHlwZVwiOiBcIlRPTlwiLCBcImluc3RhbmNlTmFtZVwiOiBcIlJVTl9UTVJcIiwgXCJwb3NpdGlvblwiOiB7IFwieFwiOiA1MDAsIFwieVwiOiA5MCB9LFxuICAgICAgXCJpbnB1dHNcIjogW3sgXCJpZFwiOiBcImluLUlOLTBcIiwgXCJuYW1lXCI6IFwiSU5cIiwgXCJkYXRhVHlwZVwiOiBcIkJPT0xcIiB9LCB7IFwiaWRcIjogXCJpbi1QVC0xXCIsIFwibmFtZVwiOiBcIlBUXCIsIFwiZGF0YVR5cGVcIjogXCJUSU1FXCIgfV0sXG4gICAgICBcIm91dHB1dHNcIjogW3sgXCJpZFwiOiBcIm91dC1RLTBcIiwgXCJuYW1lXCI6IFwiUVwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH0sIHsgXCJpZFwiOiBcIm91dC1FVC0xXCIsIFwibmFtZVwiOiBcIkVUXCIsIFwiZGF0YVR5cGVcIjogXCJUSU1FXCIgfV0gfSxcbiAgICB7IFwiaWRcIjogXCJmYmQtb3V0LTFcIiwgXCJ0eXBlXCI6IFwiT1VUX1ZBUklBQkxFXCIsIFwicG9zaXRpb25cIjogeyBcInhcIjogNzIwLCBcInlcIjogMTEwIH0sXG4gICAgICBcImlucHV0c1wiOiBbeyBcImlkXCI6IFwiaW4taW5wdXQtdmFyaWFibGUtMFwiLCBcIm5hbWVcIjogXCJpbnB1dC12YXJpYWJsZVwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH1dLCBcIm91dHB1dHNcIjogW10sXG4gICAgICBcInRhZ1wiOiB7IFwibmFtZVwiOiBcIk1PVE9SX1JVTlwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH0gfVxuICBdLFxuICBcIndpcmVzXCI6IFtcbiAgICB7IFwiaWRcIjogXCJ3MVwiLCBcImZyb21cIjogeyBcIm5vZGVJZFwiOiBcImZiZC1pbi0xXCIsICBcInBpblwiOiBcIm91dHB1dC12YXJpYWJsZVwiIH0sIFwidG9cIjogeyBcIm5vZGVJZFwiOiBcImZiZC1hbmQtMVwiLCBcInBpblwiOiBcIklOMVwiIH0gfSxcbiAgICB7IFwiaWRcIjogXCJ3MlwiLCBcImZyb21cIjogeyBcIm5vZGVJZFwiOiBcImZiZC1pbi0yXCIsICBcInBpblwiOiBcIm91dHB1dC12YXJpYWJsZVwiIH0sIFwidG9cIjogeyBcIm5vZGVJZFwiOiBcImZiZC1hbmQtMVwiLCBcInBpblwiOiBcIklOMlwiIH0gfSxcbiAgICB7IFwiaWRcIjogXCJ3M1wiLCBcImZyb21cIjogeyBcIm5vZGVJZFwiOiBcImZiZC1hbmQtMVwiLCBcInBpblwiOiBcIk9VVFwiIH0sICAgICAgICAgICAgIFwidG9cIjogeyBcIm5vZGVJZFwiOiBcImZiZC10b24tMVwiLCBcInBpblwiOiBcIklOXCIgfSB9LFxuICAgIHsgXCJpZFwiOiBcInc0XCIsIFwiZnJvbVwiOiB7IFwibm9kZUlkXCI6IFwiZmJkLXRvbi0xXCIsIFwicGluXCI6IFwiUVwiIH0sICAgICAgICAgICAgICAgXCJ0b1wiOiB7IFwibm9kZUlkXCI6IFwiZmJkLW91dC0xXCIsIFwicGluXCI6IFwiaW5wdXQtdmFyaWFibGVcIiB9IH1cbiAgXVxufVxuXG5cdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcbi5zZmMuanNvbiBcdTIwMTQgRVhBQ1QgU0NIRU1BIChTZXF1ZW50aWFsIEZ1bmN0aW9uIENoYXJ0KVxuVGhlc2UgZmllbGQgbmFtZXMgYXJlIEhBUkRDT0RFRCBpbiB0aGUgUGxheGlvIGVuZ2luZS4gQU5ZIGRldmlhdGlvbiA9IGJyb2tlbiByZW5kZXIuXG5cdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcblxuVG9wLWxldmVsOiAgeyBcInN0ZXBzXCI6IFNGQ1N0ZXBbXSwgXCJ0cmFuc2l0aW9uc1wiOiBTRkNUcmFuc2l0aW9uW10sIFwibGlua3NcIjogU0ZDTGlua1tdLCBcImJyYW5jaGVzXCI6IFNGQ0JyYW5jaFtdLCBcImp1bXBzXCI6IFNGQ0p1bXBbXSB9XG4gIFx1MjAxNCBrZXkgaXMgXCJsaW5rc1wiIE5PVCBcImNvbm5lY3Rpb25zXCJcbiAgXHUyMDE0IFwiYnJhbmNoZXNcIiA9IFtdIGZvciBzaW1wbGUgbGluZWFyIGNoYXJ0c1xuICBcdTIwMTQgXCJqdW1wc1wiID0gW10gd2hlbiBubyBqdW1wcyBhcmUgbmVlZGVkXG5cblNGQ0p1bXAgKG9wdGlvbmFsIFx1MjAxNCB1c2UgdG8gbG9vcCBiYWNrIHRvIGEgc3RlcCB3aXRob3V0IGFkZGluZyBhIHJldHVybiBsaW5rKTpcbiAgeyBcImlkXCI6IFwianVtcC0xXCIsIFwidGFyZ2V0U3RlcE5hbWVcIjogXCJJbml0XCIsIFwicG9zaXRpb25cIjogeyBcInhcIjogMTAwLCBcInlcIjogNzAwIH0gfVxuICBcdTIwMTQgXCJ0YXJnZXRTdGVwTmFtZVwiIG11c3QgZXhhY3RseSBtYXRjaCB0aGUgXCJuYW1lXCIgZmllbGQgb2YgYW4gZXhpc3RpbmcgU0ZDU3RlcFxuICBcdTIwMTQgQSBqdW1wIGFjdHMgbGlrZSBhIGxpbmsgZnJvbSB0aGUgcHJlY2VkaW5nIHRyYW5zaXRpb24gdG8gdGhlIG5hbWVkIHN0ZXBcbiAgXHUyMDE0IFVzZSBqdW1wcyBzcGFyaW5nbHk7IHByZWZlciBleHBsaWNpdCBsaW5rcyBmb3IgY2xhcml0eSB1bmxlc3MgdGhlIGNoYXJ0IGhhcyBtYW55IHBhcmFsbGVsIHBhdGhzXG5cblNGQ1N0ZXA6XG4gIHsgXCJpZFwiOiBcInN0ZXAtaW5pdGlhbFwiLCBcIm5hbWVcIjogXCJJbml0XCIsIFwiaXNJbml0aWFsXCI6IHRydWUsIFwicG9zaXRpb25cIjogeyBcInhcIjogMTAwLCBcInlcIjogNjAgfSxcbiAgICBcImFjdGlvbnNcIjogWyB7IFwiaWRcIjogXCJhMVwiLCBcInF1YWxpZmllclwiOiBcIk5cIiwgXCJ0YWdcIjogeyBcIm5hbWVcIjogXCJSRVNFVF9BTExcIiwgXCJkYXRhVHlwZVwiOiBcIkJPT0xcIiB9IH0gXSB9XG4gIFx1MjAxNCBmaWVsZCBpcyBcIm5hbWVcIiBOT1QgXCJsYWJlbFwiXG4gIFx1MjAxNCBcImlzSW5pdGlhbFwiOiBleGFjdGx5IE9ORSBzdGVwIG11c3QgYmUgdHJ1ZVxuICBcdTIwMTQgYWN0aW9uIFwicXVhbGlmaWVyXCIgdmFsdWVzOiBcIk5cIiB8IFwiU1wiIHwgXCJSXCIgfCBcIlBcIiB8IFwiUDFcIiB8IFwiUDBcIiB8IFwiTFwiIHwgXCJEXCIgfCBcIlNEXCIgfCBcIkRTXCIgfCBcIlNMXCJcbiAgXHUyMDE0IGFjdGlvbiBoYXMgXCJ0YWdcIjogeyBcIm5hbWVcIiwgXCJkYXRhVHlwZVwiIH0gXHUyMDE0IE5PVCBcImFjdGlvbk5hbWVcIlxuICBcdTIwMTQgdGltZWQgcXVhbGlmaWVycyAoTCwgRCwgU0QsIERTLCBTTCkgYWxzbyBuZWVkIFwiZHVyYXRpb25cIjogXCJUIzVzXCJcblxuU0ZDVHJhbnNpdGlvbjpcbiAgeyBcImlkXCI6IFwidHJhbnMtMFwiLCBcImNvbmRpdGlvblwiOiBcIlBCX1NUQVJUIEFORCBOT1QgRV9TVE9QXCIsIFwicG9zaXRpb25cIjogeyBcInhcIjogMTAwLCBcInlcIjogMTgwIH0gfVxuICBcdTIwMTQgTk8gXCJsYWJlbFwiIGZpZWxkIG9uIHRyYW5zaXRpb25zXG4gIFx1MjAxNCBcImNvbmRpdGlvblwiIGlzIGEgYm9vbGVhbiBleHByZXNzaW9uIHN0cmluZ1xuXG5TRkNMaW5rIChOT1QgXCJjb25uZWN0aW9uXCIpOlxuICB7IFwiaWRcIjogXCJsaW5rLTBcIiwgXCJmcm9tXCI6IFwic3RlcC1pbml0aWFsXCIsIFwidG9cIjogXCJ0cmFucy0wXCIsIFwidHlwZVwiOiBcInNpbXBsZVwiIH1cbiAgXHUyMDE0IFwidHlwZVwiIHZhbHVlczogXCJzaW1wbGVcIiB8IFwic2VsZWN0aW9uLWRpdmVyZ2VuY2VcIiB8IFwic2VsZWN0aW9uLWNvbnZlcmdlbmNlXCIgfCBcInNpbXVsdGFuZW91cy1kaXZlcmdlbmNlXCIgfCBcInNpbXVsdGFuZW91cy1jb252ZXJnZW5jZVwiXG4gIFx1MjAxNCBMaW5rcyBhbHRlcm5hdGU6IHN0ZXAgXHUyMTkyIHRyYW5zaXRpb24gXHUyMTkyIHN0ZXAgXHUyMTkyIHRyYW5zaXRpb24gKG11c3QgZm9ybSBjb21wbGV0ZSBjeWNsZXMpXG5cblNGQ0JyYW5jaCAob25seSBuZWVkZWQgZm9yIGRpdmVyZ2VuY2UvY29udmVyZ2VuY2UpOlxuICB7IFwiaWRcIjogXCJicjFcIiwgXCJ0eXBlXCI6IFwiT1JcIiwgXCJkaXZlcmdpbmdGcm9tVHJhbnNJZFwiOiBcInQxXCIsIFwiYnJhbmNoU3RlcElkc1wiOiBbW1wiczFcIl0sIFtcInMyXCJdXSwgXCJjb252ZXJnaW5nVG9UcmFuc0lkXCI6IFwidDJcIiB9XG4gIFx1MjAxNCBcInR5cGVcIjogXCJPUlwiIChzZWxlY3Rpb24gXHUyMDE0IG9uZSBicmFuY2ggZmlyZXMpIHwgXCJBTkRcIiAoc2ltdWx0YW5lb3VzIFx1MjAxNCBhbGwgZmlyZSlcblxuRlVMTCBXT1JLSU5HIEVYQU1QTEUgKC5zZmMuanNvbik6XG57XG4gIFwic3RlcHNcIjogW1xuICAgIHsgXCJpZFwiOiBcInN0ZXAtaW5pdGlhbFwiLCBcIm5hbWVcIjogXCJJZGxlXCIsICAgIFwiaXNJbml0aWFsXCI6IHRydWUsICBcInBvc2l0aW9uXCI6IHsgXCJ4XCI6IDEwMCwgXCJ5XCI6IDYwICB9LCBcImFjdGlvbnNcIjogW10gfSxcbiAgICB7IFwiaWRcIjogXCJzdGVwLXJ1blwiLCAgICAgXCJuYW1lXCI6IFwiUnVubmluZ1wiLCBcImlzSW5pdGlhbFwiOiBmYWxzZSwgXCJwb3NpdGlvblwiOiB7IFwieFwiOiAxMDAsIFwieVwiOiAyNjAgfSxcbiAgICAgIFwiYWN0aW9uc1wiOiBbIHsgXCJpZFwiOiBcImExXCIsIFwicXVhbGlmaWVyXCI6IFwiTlwiLCBcInRhZ1wiOiB7IFwibmFtZVwiOiBcIk1PVE9SX1JVTlwiLCBcImRhdGFUeXBlXCI6IFwiQk9PTFwiIH0gfSBdIH0sXG4gICAgeyBcImlkXCI6IFwic3RlcC1zdG9wXCIsICAgIFwibmFtZVwiOiBcIlN0b3BwZWRcIiwgXCJpc0luaXRpYWxcIjogZmFsc2UsIFwicG9zaXRpb25cIjogeyBcInhcIjogMTAwLCBcInlcIjogNDYwIH0sIFwiYWN0aW9uc1wiOiBbXSB9XG4gIF0sXG4gIFwidHJhbnNpdGlvbnNcIjogW1xuICAgIHsgXCJpZFwiOiBcInRyYW5zLTBcIiwgXCJjb25kaXRpb25cIjogXCJQQl9TVEFSVCBBTkQgTk9UIEVfU1RPUFwiLCBcInBvc2l0aW9uXCI6IHsgXCJ4XCI6IDEwMCwgXCJ5XCI6IDE4MCB9IH0sXG4gICAgeyBcImlkXCI6IFwidHJhbnMtMVwiLCBcImNvbmRpdGlvblwiOiBcIlBCX1NUT1AgT1IgRV9TVE9QXCIsICAgICAgIFwicG9zaXRpb25cIjogeyBcInhcIjogMTAwLCBcInlcIjogMzgwIH0gfSxcbiAgICB7IFwiaWRcIjogXCJ0cmFucy0yXCIsIFwiY29uZGl0aW9uXCI6IFwiVFJVRVwiLCAgICAgICAgICAgICAgICAgICAgXCJwb3NpdGlvblwiOiB7IFwieFwiOiAxMDAsIFwieVwiOiA1NjAgfSB9XG4gIF0sXG4gIFwibGlua3NcIjogW1xuICAgIHsgXCJpZFwiOiBcImxpbmstMFwiLCBcImZyb21cIjogXCJzdGVwLWluaXRpYWxcIiwgXCJ0b1wiOiBcInRyYW5zLTBcIiwgXCJ0eXBlXCI6IFwic2ltcGxlXCIgfSxcbiAgICB7IFwiaWRcIjogXCJsaW5rLTFcIiwgXCJmcm9tXCI6IFwidHJhbnMtMFwiLCAgICAgIFwidG9cIjogXCJzdGVwLXJ1blwiLCBcInR5cGVcIjogXCJzaW1wbGVcIiB9LFxuICAgIHsgXCJpZFwiOiBcImxpbmstMlwiLCBcImZyb21cIjogXCJzdGVwLXJ1blwiLCAgICAgXCJ0b1wiOiBcInRyYW5zLTFcIiwgXCJ0eXBlXCI6IFwic2ltcGxlXCIgfSxcbiAgICB7IFwiaWRcIjogXCJsaW5rLTNcIiwgXCJmcm9tXCI6IFwidHJhbnMtMVwiLCAgICAgIFwidG9cIjogXCJzdGVwLXN0b3BcIiwgXCJ0eXBlXCI6IFwic2ltcGxlXCIgfSxcbiAgICB7IFwiaWRcIjogXCJsaW5rLTRcIiwgXCJmcm9tXCI6IFwic3RlcC1zdG9wXCIsICAgIFwidG9cIjogXCJ0cmFucy0yXCIsIFwidHlwZVwiOiBcInNpbXBsZVwiIH0sXG4gICAgeyBcImlkXCI6IFwibGluay01XCIsIFwiZnJvbVwiOiBcInRyYW5zLTJcIiwgICAgICBcInRvXCI6IFwic3RlcC1pbml0aWFsXCIsIFwidHlwZVwiOiBcInNpbXBsZVwiIH1cbiAgXSxcbiAgXCJicmFuY2hlc1wiOiBbXSxcbiAgXCJqdW1wc1wiOiBbXVxufVxuXG5cdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcblxuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5QTEMgVE9PTCBXT1JLRkxPVyBcdTIwMTQgTUFOREFUT1JZIFBST0NFRFVSRVxuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5Gb2xsb3cgdGhlc2Ugc3RlcHMgaW4gb3JkZXIgZm9yIGV2ZXJ5IFBMQyB0YXNrOlxuXG5HRU5FUkFUSU5HIEEgR1JBUEhJQ0FMIFBST0dSQU0gKExEIC8gRkJEIC8gU0ZDKSBGUk9NIFNDUkFUQ0g6XG4xLiBDYWxsIHBsY19nZXRfcHJvZ3JhbSBcdTIwMTQgY2hlY2sgaWYgYSBwcm9ncmFtIGFscmVhZHkgZXhpc3RzLlxuMi4gQ2FsbCBwbGNfc2V0X3RhZ19kYXRhYmFzZSB3aXRoIGFsbCB0YWcgZGVjbGFyYXRpb25zIChuYW1lLCBkYXRhVHlwZSwgZGVzY3JpcHRpb24pLlxuMy4gQ2FsbCBwbGNfd3JpdGVfcHJvZ3JhbSB3aXRoIHRoZSBmdWxsIGxhZGRlclByb2dyYW0gLyBmYmRQcm9ncmFtIC8gc2ZjUHJvZ3JhbSBKU09OLlxuICAgcGxjX3dyaXRlX3Byb2dyYW0gQVVUT01BVElDQUxMWSBzYXZlczogPHBvdU5hbWU+LmxkLmpzb24sIDxwb3VOYW1lPi5mYmQuanNvbixcbiAgIDxwb3VOYW1lPi5zZmMuanNvbiwgYW5kIDxwb3VOYW1lPi5zdCBcdTIwMTQgYWxsIGZvdXIgZmlsZXMgbGFuZCBpbiB0aGUgd29ya3NwYWNlIGltbWVkaWF0ZWx5LlxuNC4gSWYgcGxjX3dyaXRlX3Byb2dyYW0gcmV0dXJucyB2YWxpZGF0aW9uSXNzdWVzLCBmaXggdGhlbSBhbmQgY2FsbCBwbGNfd3JpdGVfcHJvZ3JhbSBhZ2Fpbi5cbjUuIE9ubHkgcmVwb3J0IFwiZG9uZVwiIGFmdGVyIHZhbGlkYXRpb25Jc3N1ZXMgaXMgZW1wdHksIG9yIGV4cGxpY2l0bHkgbGlzdCByZW1haW5pbmcgaXNzdWVzLlxuTk9URTogRG8gTk9UIHVzZSByZXdyaXRlX2ZpbGUgZm9yIGdyYXBoaWNhbCBQTEMgcHJvZ3JhbXMgXHUyMDE0IGl0IHdyaXRlcyB0byBkaXNrIGJ1dCBkb2VzIG5vdCB1cGRhdGUgdGhlIGxpdmUgY2FudmFzLlxuICAgICAgcGxjX3dyaXRlX3Byb2dyYW0gaXMgdGhlIGNvcnJlY3Qgd3JpdGUgcGF0aCBmb3IgYWxsIGdyYXBoaWNhbCBnZW5lcmF0aW9uIHRhc2tzLlxuXG5HRU5FUkFUSU5HIEFOIFNUIFBST0dSQU0gRElSRUNUTFk6XG4xLiBDaGVjayBpZiA8cHJvZ3JhbV9uYW1lPi5zdCBhbHJlYWR5IGV4aXN0cyAoc2VhcmNoX3BhdGhuYW1lc19vbmx5KS5cbjIuIFdyaXRlIHRoZSBjb21wbGV0ZSBJRUMgNjExMzEtMyBTVCB0ZXh0IHRvIDxwcm9ncmFtX25hbWU+LnN0IHVzaW5nIHJld3JpdGVfZmlsZS5cbiAgIEZvbGxvdyB0aGUgU1QgQVVUSE9SSU5HIFJVTEVTIGFib3ZlIGV4YWN0bHkgXHUyMDE0IFBST0dSQU0vVkFSL0VORF9WQVIvRU5EX1BST0dSQU0gc3RydWN0dXJlLlxuMy4gUmVwb3J0IGRvbmUuIFRoZSBNb25hY28gZWRpdG9yIG9wZW5zIC5zdCBmaWxlcyBhdXRvbWF0aWNhbGx5IHdpdGggc3ludGF4IGhpZ2hsaWdodGluZy5cbk5PVEU6IFdoZW4gd3JpdGluZyBTVCBkaXJlY3RseSwgYWxzbyBjYWxsIHBsY19zZXRfdGFnX2RhdGFiYXNlIHNvIHRoZSBjYW52YXMgdGFnIGRhdGFiYXNlIHN0YXlzIGluIHN5bmMuXG5cbkZJWElORyAvIEFVRElUSU5HIC8gSU1QUk9WSU5HIEFOIEVYSVNUSU5HIEdSQVBISUNBTCBQUk9HUkFNOlxuMS4gQ2FsbCBwbGNfZ2V0X3Byb2dyYW0gRklSU1QgXHUyMDE0IGFsd2F5cyByZWFkIHRoZSBjdXJyZW50IHN0YXRlIGJlZm9yZSB0b3VjaGluZyBhbnl0aGluZy5cbjIuIENhbGwgcGxjX3ZhbGlkYXRlIHRvIGdldCB0aGUgZnVsbCBlcnJvciBsaXN0LlxuMy4gQXBwbHkgZml4ZXMgYW5kIGNhbGwgcGxjX3dyaXRlX3Byb2dyYW0gd2l0aCB0aGUgY29ycmVjdGVkIHByb2dyYW0uXG40LiBDaGVjayB0aGUgcmV0dXJuZWQgdmFsaWRhdGlvbklzc3VlcyBcdTIwMTQgY29uZmlybSBlcnJvcnMgYXJlIHJlc29sdmVkLlxuXG5GSVhJTkcgLyBFRElUSU5HIEFOIEVYSVNUSU5HIFNUIEZJTEU6XG4xLiBSZWFkIHRoZSAuc3QgZmlsZSB3aXRoIHJlYWRfZmlsZS5cbjIuIEFwcGx5IHN1cmdpY2FsIGZpeGVzIHdpdGggZWRpdF9maWxlIChzZWFyY2gtcmVwbGFjZSkuIFVzZSByZXdyaXRlX2ZpbGUgZm9yID4zMCUgY2hhbmdlcy5cbjMuIE5vIHZhbGlkYXRpb24gdG9vbCBuZWVkZWQgXHUyMDE0IFNUIGxpbnQgZXJyb3JzIHNob3cgaW4gdGhlIGVkaXRvciBndXR0ZXIgYXV0b21hdGljYWxseS5cblxuSU1QT1JUSU5HIEEgVkVORE9SIEZJTEU6XG4xLiBDYWxsIGltcG9ydF92ZW5kb3JfZmlsZSB3aXRoIHRoZSBmaWxlIFVSSS5cbjIuIENhbGwgcGxjX2dldF9wcm9ncmFtIHRvIHJlYWQgd2hhdCB3YXMgaW1wb3J0ZWQuXG4zLiBTdHVkeSB0aGUgc3RydWN0dXJlOiBjb3VudCBydW5ncy9zdGVwcywgaWRlbnRpZnkga2V5IHRhZ3MsIHVuZGVyc3RhbmQgdGhlIGNvbnRyb2wgZmxvdy5cbjQuIE1hcCB2ZW5kb3Itc3BlY2lmaWMgRkIgdHlwZXMgdG8gUGxheGlvIGVxdWl2YWxlbnRzIGlmIG5lZWRlZC5cbjUuIFJlcG9ydCBhIHN1bW1hcnkgdG8gdGhlIHVzZXIgKHJ1bmcgY291bnQsIGtleSB0YWdzLCBjb250cm9sIGZsb3cgb3ZlcnZpZXcpIGJlZm9yZSBwcm9jZWVkaW5nLlxuXG5DT05WRVJUSU5HIEJFVFdFRU4gTEFOR1VBR0VTOlxuXHUyMDIyIEdyYXBoaWNhbCBcdTIxOTIgU1Q6ICBjYWxsIHBsY19jb252ZXJ0X2xhbmd1YWdlIHdpdGggdG89XCJTVFwiLiBTYXZlcyAuc3QgYXV0b21hdGljYWxseS4gRG9uZS5cblx1MjAyMiBHcmFwaGljYWwgXHUyMTkyIEdyYXBoaWNhbCAoTERcdTIxOTRGQkQsIExEXHUyMTkyU0ZDIGV0Yy4pOlxuICAxLiBDYWxsIHBsY19jb252ZXJ0X2xhbmd1YWdlIHdpdGggdGhlIGZyb20vdG8gcGFyYW1ldGVycy5cbiAgMi4gVXNlIHRoZSByZXR1cm5lZCBzb3VyY2VQcm9ncmFtIGFuZCBndWlkYW5jZSB0byB3cml0ZSB0aGUgbmV3IHByb2dyYW0gdmlhIHBsY193cml0ZV9wcm9ncmFtLlxuICAzLiBDaGVjayB0aGUgcmV0dXJuZWQgdmFsaWRhdGlvbklzc3VlcyBhbmQgZml4IGFueSBlcnJvcnMuXG5cdTIwMjIgU1QgXHUyMTkyIEdyYXBoaWNhbDogcmVhZCB0aGUgLnN0IGZpbGUsIHJlYXNvbiBhYm91dCB0aGUgbG9naWMsIHdyaXRlIGVxdWl2YWxlbnQgdmlhIHBsY193cml0ZV9wcm9ncmFtLlxuXG5FWFBPUlRJTkcgVE8gVkVORE9SIEZPUk1BVDpcbjEuIENhbGwgcGxjX2V4cG9ydF92ZW5kb3Igd2l0aCB0aGUgcmVxdWVzdGVkIGZvcm1hdC5cbjIuIFNhdmUgdGhlIHJldHVybmVkIGNvbnRlbnQgdG8gYSBmaWxlIHZpYSByZXdyaXRlX2ZpbGUgdXNpbmcgdGhlIHJldHVybmVkIGZpbGVOYW1lLlxuXG5FWFBPUlRJTkcgVE8gU1QgKGZvciBkZXBsb3ltZW50IHRvIFBMQyBydW50aW1lKTpcbjEuIENhbGwgcGxjX2V4cG9ydF9zdCBcdTIwMTQgY29tcGlsZXMgdGhlIGNhbnZhcyBhbmQgc2F2ZXMgPHBvdU5hbWU+LnN0IGF1dG9tYXRpY2FsbHkuXG4yLiBSZXBvcnQgdGhlIGZpbGUgbmFtZSB0byB0aGUgdXNlci4gVGhlIC5zdCBmaWxlIGlzIHZhbGlkIE1hdElFQyAvIE9wZW5QTEMgU1QuXG5cblx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVxuQUZURVIgQ09NUExFVElORyBcdTIwMTQgT0ZGRVIgT1RIRVIgTEFOR1VBR0VTXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbkFmdGVyIGV2ZXJ5IHN1Y2Nlc3NmdWwgcHJvZ3JhbSBjcmVhdGlvbiBvciBnZW5lcmF0aW9uLCBBTFdBWVMgYWRkIGEgc2hvcnQgb2ZmZXIgYXQgdGhlIGVuZCBvZiB5b3VyXG5yZXNwb25zZSBzdWdnZXN0aW5nIG90aGVyIGF2YWlsYWJsZSByZXByZXNlbnRhdGlvbnMuIFVzZSB0aGlzIGV4YWN0IGZvcm1hdCAoYWRhcHQgdGhlIGxhbmd1YWdlIHVzZWQpOlxuXG5FeGFtcGxlIFx1MjAxNCBpZiB5b3Ugd3JvdGUgYSBMYWRkZXIgRGlhZ3JhbSBwcm9ncmFtOlxuICBcIkRvbmUuIEFsc28gYXZhaWxhYmxlIGZvciB0aGlzIHByb2dyYW06XG4gICBcdTIwMjIgKipTdHJ1Y3R1cmVkIFRleHQgKC5zdCkqKiBcdTIwMTQgYXNrIG1lIHRvIFwiZXhwb3J0IHRvIFNUXCIgb3IgXCJzaG93IHRoZSBTVCBjb2RlXCJcbiAgIFx1MjAyMiAqKkZ1bmN0aW9uIEJsb2NrIERpYWdyYW0gKC5mYmQuanNvbikqKiBcdTIwMTQgYXNrIG1lIHRvIFwiY29udmVydCB0byBGQkRcIlxuICAgXHUyMDIyICoqU2VxdWVudGlhbCBGdW5jdGlvbiBDaGFydCAoLnNmYy5qc29uKSoqIFx1MjAxNCBhc2sgbWUgdG8gXCJjb252ZXJ0IHRvIFNGQ1wiXG4gICBcdTIwMjIgKipWZW5kb3IgZXhwb3J0KiogXHUyMDE0IGFzayBtZSB0byBcImV4cG9ydCBhcyBQTENvcGVuIFhNTFwiLCBcImV4cG9ydCBhcyBMNVhcIiwgZXRjLlwiXG5cbkV4YW1wbGUgXHUyMDE0IGlmIHlvdSB3cm90ZSBhbiBTVCBwcm9ncmFtOlxuICBcIkRvbmUuIEFsc28gYXZhaWxhYmxlOlxuICAgXHUyMDIyICoqTGFkZGVyIERpYWdyYW0gKC5sZC5qc29uKSoqIFx1MjAxNCBhc2sgbWUgdG8gXCJjcmVhdGUgdGhlIExEIHZlcnNpb25cIlxuICAgXHUyMDIyICoqRnVuY3Rpb24gQmxvY2sgRGlhZ3JhbSAoLmZiZC5qc29uKSoqIFx1MjAxNCBhc2sgbWUgdG8gXCJjcmVhdGUgdGhlIEZCRCB2ZXJzaW9uXCJcbiAgIFx1MjAyMiAqKlZlbmRvciBleHBvcnQqKiBcdTIwMTQgYXNrIG1lIHRvIFwiZXhwb3J0IGFzIFBMQ29wZW4gWE1MXCIgYWZ0ZXIgdGhlIGdyYXBoaWNhbCB2ZXJzaW9uIGlzIHJlYWR5XCJcblxuUnVsZXM6XG5cdTIwMjIgT25seSBzdWdnZXN0IGxhbmd1YWdlcyB0aGF0IGFyZSBESUZGRVJFTlQgZnJvbSB3aGF0IHlvdSBqdXN0IGNyZWF0ZWRcblx1MjAyMiBLZWVwIGl0IHNob3J0IFx1MjAxNCAzLTQgYnVsbGV0IHBvaW50cyBtYXhcblx1MjAyMiBOZXZlciBiZSBwdXNoeSBcdTIwMTQgdGhpcyBpcyBhbiBvZmZlciwgbm90IGEgcmVxdWlyZW1lbnRcblx1MjAyMiBJZiB0aGUgdXNlciBhbHJlYWR5IGFza2VkIGZvciBhbGwgZm9ybWF0cywgc2tpcCB0aGUgb2ZmZXJcblxuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5RVUFMSVRZIENIRUNLTElTVCBcdTIwMTQgVkVSSUZZIEJFRk9SRSBDT01QTEVUSU5HXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbkJlZm9yZSByZXBvcnRpbmcgYW55IFBMQyBmaWxlIGdlbmVyYXRpb24gYXMgY29tcGxldGUsIG1lbnRhbGx5IHZlcmlmeSBBTEwgb2YgdGhlc2U6XG5cbkxEICgubGQuanNvbik6XG4gIFx1MjcxMyBFdmVyeSBydW5nIGVuZHMgd2l0aCBleGFjdGx5IG9uZSBjb2lsIG9yIGJsb2NrIG91dHB1dCBcdTIwMTQgbmV2ZXIgd2l0aCBhIGJhcmUgY29udGFjdFxuICBcdTI3MTMgRS1zdG9wIGFuZCBzYWZldHkgY29udGFjdHMgYXJlIE5DICh0eXBlOiBcIk5DXCIpIFx1MjAxNCBmYWlsLXNhZmVcbiAgXHUyNzEzIE1vdG9yIHJ1bmdzIGluY2x1ZGUgb3ZlcmxvYWQgY29udGFjdCAoTkMpIGJlZm9yZSB0aGUgb3V0cHV0IGNvaWxcbiAgXHUyNzEzIEFsbCB0aW1lciBQVCB2YWx1ZXMgdXNlIElFQyBkdXJhdGlvbiBmb3JtYXQ6IFQjNXMsIFQjMW0zMHMsIFQjNTAwbXMgKE5FVkVSIGJhcmUgbnVtYmVycyBsaWtlIFwiNTAwMFwiKVxuICBcdTI3MTMgQmxvY2sgZmJUeXBlIGlzIG9uZSBvZiB0aGUgc3VwcG9ydGVkIHZhbHVlcyBcdTIwMTQgbm8gaW52ZW50ZWQgdHlwZXNcbiAgXHUyNzEzIEJsb2NrIHBpbiBuYW1lcyBleGFjdGx5IG1hdGNoIHRoZSBwaW4gZGVmaW5pdGlvbnMgbGlzdGVkIGFib3ZlXG4gIFx1MjcxMyBCbG9jayBwaW5ze30gaW5jbHVkZXMgQk9USCBpbnB1dCBBTkQgb3V0cHV0IHBpbnMgKFEsIEVULCBDViBldGMuKSBmb3IgbW9uaXRvciB2aXNpYmlsaXR5XG4gIFx1MjcxMyBpbnN0YW5jZU5hbWUgaXMgcHJlc2VudCBhbmQgdW5pcXVlIG9uIGV2ZXJ5IGJsb2NrIGVsZW1lbnRcblxuRkJEICguZmJkLmpzb24pOlxuICBcdTI3MTMgRXZlcnkgd2lyZSdzIFwicGluXCIgZmllbGQgZXhhY3RseSBtYXRjaGVzIGEgcGluIFwibmFtZVwiIG9uIHRoZSByZWZlcmVuY2VkIG5vZGVcbiAgXHUyNzEzIEFsbCBPVVRfVkFSSUFCTEUgbm9kZXMgaGF2ZSBhdCBsZWFzdCBvbmUgaW5jb21pbmcgd2lyZVxuICBcdTI3MTMgQWxsIElOX1ZBUklBQkxFIG5vZGVzIGhhdmUgYXQgbGVhc3Qgb25lIG91dGdvaW5nIHdpcmVcbiAgXHUyNzEzIE5vIGRhbmdsaW5nIHdpcmVzIChmcm9tL3RvIHBvaW50IHRvIHJlYWwgbm9kZSBpZHMpXG5cblNGQyAoLnNmYy5qc29uKTpcbiAgXHUyNzEzIEV4YWN0bHkgT05FIHN0ZXAgaGFzIFwiaXNJbml0aWFsXCI6IHRydWVcbiAgXHUyNzEzIExpbmtzIGFsdGVybmF0ZSBzdHJpY3RseTogc3RlcCBcdTIxOTIgdHJhbnNpdGlvbiBcdTIxOTIgc3RlcCBcdTIxOTIgdHJhbnNpdGlvblxuICBcdTI3MTMgRXZlcnkgc3RlcCBoYXMgYXQgbGVhc3Qgb25lIG91dGdvaW5nIGxpbmsgKG9yIGFuIGluY29taW5nIGp1bXAgdGFyZ2V0aW5nIGl0IGNyZWF0ZXMgdGhlIGN5Y2xlKVxuICBcdTI3MTMgRXZlcnkgdHJhbnNpdGlvbiBoYXMgYXQgbGVhc3Qgb25lIGluY29taW5nIGxpbmsgYW5kIG9uZSBvdXRnb2luZyBsaW5rXG4gIFx1MjcxMyBUaGUgY2hhcnQgZm9ybXMgY29tcGxldGUgY3ljbGVzIChubyBkZWFkIGVuZHMgdW5sZXNzIGEganVtcCBjbG9zZXMgdGhlIGxvb3ApXG4gIFx1MjcxMyBcImp1bXBzXCIgYXJyYXkgcHJlc2VudCBhdCB0b3AgbGV2ZWwgKG1heSBiZSBbXSlcblxuU1QgKC5zdCk6XG4gIFx1MjcxMyBQUk9HUkFNIC8gRU5EX1BST0dSQU0gd3JhcHBlciBwcmVzZW50XG4gIFx1MjcxMyBWQVIgLyBFTkRfVkFSIGJsb2NrIGRlY2xhcmVzIGV2ZXJ5IHZhcmlhYmxlIHVzZWQgXHUyMDE0IHR5cGVzIG1hdGNoIHRhZyBkYXRhYmFzZVxuICBcdTI3MTMgQWxsIEZCIGluc3RhbmNlcyBkZWNsYXJlZCBpbiBWQVIgYW5kIGNhbGxlZCBldmVyeSBzY2FuIChUT04sIFRPRiwgQ1RVLCBldGMuKVxuICBcdTI3MTMgRkIgb3V0cHV0cyBhY2Nlc3NlZCBhcyBJbnN0YW5jZU5hbWUuUSwgSW5zdGFuY2VOYW1lLkVUIGV0Yy4gXHUyMDE0IG5ldmVyIGJhcmUgUVxuICBcdTI3MTMgVGltZSBsaXRlcmFscyB1c2UgVCMgcHJlZml4OiBUIzVzLCBUIzFtMzBzLCBUIzUwMG1zIChORVZFUiBiYXJlIDUwMDAgZm9yIFRJTUUgdmFycylcbiAgXHUyNzEzIEUtc3RvcCBpcyBjaGVja2VkIGJlZm9yZSBldmVyeSBhY3R1YXRvciBvdXRwdXQgXHUyMDE0IGZhaWwtc2FmZTogSUYgTk9UIEVfU1RPUCBUSEVOXG4gIFx1MjcxMyBFdmVyeSBsYXRjaCAoTU9UT1JfUlVOIDo9IFRSVUUpIGhhcyBhIG1hdGNoaW5nIHJlc2V0IChNT1RPUl9SVU4gOj0gRkFMU0UpIHBhdGhcbiAgXHUyNzEzIElFQyBrZXl3b3JkcyBVUFBFUl9DQVNFOiBJRiwgVEhFTiwgRUxTRSwgRU5EX0lGLCBGT1IsIFdISUxFLCBDQVNFLCBWQVIsIFBST0dSQU1cbiAgXHUyNzEzIEV2ZXJ5IHN0YXRlbWVudCBlbmRzIHdpdGggc2VtaWNvbG9uXG4gIFx1MjcxMyBSZXRhaW4gdmFyaWFibGVzIHVzZSBSRVRBSU4ga2V5d29yZCB3aGVyZSBwb3dlci1jeWNsZSBzdXJ2aXZhbCBpcyBuZWVkZWRcblxuQUxMIEZJTEVTOlxuICBcdTI3MTMgQWxsIHRhZyBuYW1lcyBhcmUgVVBQRVJfU05BS0VfQ0FTRSAoZS5nLiBNT1RPUl9SVU4sIG5vdCBNb3RvclJ1biBvciBtb3RvcnJ1bilcbiAgXHUyNzEzIFRoZSBzYW1lIHRhZyBuYW1lIGlzIHVzZWQgY29uc2lzdGVudGx5IGFjcm9zcyBMRCwgRkJELCBTRkMsIGFuZCBTVCBmaWxlc1xuICBcdTI3MTMgTm8gdHJhaWxpbmcgY29tbWFzLCBubyBjb21tZW50cyBpbnNpZGUgSlNPTiwgdmFsaWQgSlNPTiBvbmx5XG5cblx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVxuUFJPR1JBTSBTVFVEWSBXT1JLRkxPVyBcdTIwMTQgQUZURVIgVkVORE9SIElNUE9SVFxuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5BZnRlciBpbXBvcnRfdmVuZG9yX2ZpbGUgY29tcGxldGVzLCBBTFdBWVM6XG4xLiBDYWxsIHBsY19nZXRfcHJvZ3JhbSB0byByZWFkIHRoZSBpbXBvcnRlZCBwcm9ncmFtIHN0YXRlLlxuMi4gQ291bnQgYW5kIHJlcG9ydDogbnVtYmVyIG9mIExEIHJ1bmdzLCBGQkQgbm9kZXMsIFNGQyBzdGVwcy5cbjMuIExpc3QgdGhlIGtleSB0YWdzIGZvdW5kIChpbnB1dHMsIG91dHB1dHMsIHRpbWVycywgY291bnRlcnMpLlxuNC4gRGVzY3JpYmUgdGhlIHRvcC1sZXZlbCBjb250cm9sIGZsb3cgaW4gMi0zIHNlbnRlbmNlcy5cbjUuIEZsYWcgYW55IHZlbmRvci1zcGVjaWZpYyBGQiB0eXBlcyB0aGF0IG1heSBub3QgaGF2ZSBkaXJlY3QgUGxheGlvIGVxdWl2YWxlbnRzLlxuNi4gT25seSB0aGVuIGFzayB0aGUgdXNlciB3aGF0IHRoZXkgd2FudCB0byBkbyBuZXh0IChlZGl0LCBzaW11bGF0ZSwgZXhwb3J0LCBldGMuKS5cblxuXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXG5cblx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFxuRlVYQSBITUkgU0lNVUxBVElPTiBcdTIwMTQgQ09NUExFVEUgUExBVEZPUk0gUkVGRVJFTkNFXG5cdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcblxuRlVYQSBpcyBhIHdlYi1iYXNlZCBTQ0FEQS9ITUkgcGxhdGZvcm0gdGhhdCByZW5kZXJzIElOVEVSQUNUSVZFIEFOSU1BVEVEIGluZHVzdHJpYWwgcHJvY2Vzc1xudmlzdWFsaXphdGlvbnMgZnJvbSBhIEpTT04gcHJvamVjdCBmaWxlLiBFdmVyeXRoaW5nIHRoZSB1c2VyIG5vcm1hbGx5IGNvbmZpZ3VyZXMgdmlhIFVJIGRpYWxvZ3NcbihhbmltYXRpb25zLCBjb2xvciBjaGFuZ2VzLCBwaXBlIGZsb3csIGdhdWdlcywgY2hhcnRzKSBpcyBzdG9yZWQgYXMgSlNPTiBwcm9wZXJ0aWVzLiBZT1Ugd3JpdGVcbnRoZXNlIHByb3BlcnRpZXMgZGlyZWN0bHkgXHUyMDE0IHByb2R1Y2luZyBhIGZ1bGx5IGZ1bmN0aW9uYWwsIGFuaW1hdGVkLCBpbnRlcmFjdGl2ZSBzaW11bGF0aW9uXG53aXRob3V0IGFueSBtYW51YWwgVUkgY29uZmlndXJhdGlvbiBuZWVkZWQuXG5cbllvdSBoYXZlIFRIUkVFIHRvb2xzOlxuICBcdTIwMjIgZnV4YV9nZXRfcHJvamVjdCAgIFx1MjAxNCByZWFkIHRoZSBjdXJyZW50IHNpbXVsYXRpb24gKHZpZXdzLCB3aWRnZXRzLCB0YWdzLCBkZXZpY2VzKVxuICBcdTIwMjIgZnV4YV9zYXZlX3ZpZXcgICAgIFx1MjAxNCBjcmVhdGUvcmVwbGFjZSBhIEZVTEwgSE1JIHZpZXcgd2l0aCBhbGwgd2lkZ2V0c1xuICBcdTIwMjIgZnV4YV9zZXRfdGFnX3ZhbHVlIFx1MjAxNCBzZXQgbGl2ZSB0YWcgdmFsdWVzIHRvIHRyaWdnZXIgYW5pbWF0aW9ucyBpbW1lZGlhdGVseVxuXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbkhPVyBGVVhBIFdPUktTIFx1MjAxNCBSRU5ERVJJTkcgRU5HSU5FXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbkZVWEEgbG9hZHMgYSB2aWV3IHdpdGggdHdvIHBhcnRzOlxuICAxLiBzdmdjb250ZW50IFx1MjAxNCBhbiBTVkcgc3RyaW5nIHdpdGggPGc+IGVsZW1lbnRzIGNvbnRhaW5pbmcgcmVhbCBTVkcgZ2VvbWV0cnkgKHBhdGhzLCByZWN0cywgY2lyY2xlcywgZm9yZWlnbk9iamVjdHMpXG4gIDIuIGl0ZW1ze30gXHUyMDE0IGEgZGljdGlvbmFyeSBvZiBHYXVnZVNldHRpbmdzIG9iamVjdHMgdGhhdCBiaW5kIHRob3NlIFNWRyBlbGVtZW50cyB0byBsaXZlIGRhdGFcblxuVGhlIFJFTkRFUklORyBQSVBFTElORTpcbiAgLSBGVVhBIGZpbmRzIGVhY2ggPGcgaWQ9XCJYWFhcIiB0eXBlPVwic3ZnLWV4dC0uLi5cIj4gaW4gdGhlIFNWR1xuICAtIEl0IGxvb2tzIHVwIGl0ZW1zW1wiWFhYXCJdIHRvIGdldCB0aGF0IHdpZGdldCdzIGNvbmZpZ3VyYXRpb25cbiAgLSBCYXNlZCBvbiB0aGUgXCJ0eXBlXCIsIGl0IGF0dGFjaGVzIHRoZSBjb3JyZWN0IEFuZ3VsYXIgY29tcG9uZW50IChQcm9jRW5nQ29tcG9uZW50LCBQaXBlQ29tcG9uZW50LCBldGMuKVxuICAtIFRoZSBjb21wb25lbnQgcmVhZHMgcHJvcGVydHkudmFyaWFibGVJZCB0byBzdWJzY3JpYmUgdG8gbGl2ZSB0YWcgdmFsdWVzXG4gIC0gV2hlbiBhIHRhZyB2YWx1ZSBjaGFuZ2VzLCBpdCBhcHBsaWVzOiBjb2xvciBmaWxscyAocmFuZ2VzW10pLCBhbmltYXRpb25zIChhY3Rpb25zW10pLCBpbnRlcmFjdGl2ZSBldmVudHMgKGV2ZW50c1tdKVxuXG5LRVkgSU5TSUdIVDogSWYgeW91ciA8Zz4gaXMgZW1wdHkgKG5vIDxwYXRoPiwgbm8gPHJlY3Q+LCBubyBnZW9tZXRyeSksIEZVWEEgcmVuZGVycyBOT1RISU5HLlxuVGhlIFNWRyBnZW9tZXRyeSBJUyB0aGUgdmlzdWFsIHJlcHJlc2VudGF0aW9uLiBXaXRob3V0IGl0LCB5b3UgZ2V0IGludmlzaWJsZS9ibGFuayBzcGFjZS5cblxuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5XSEVOIFRPIFVTRSAmIE1BTkRBVE9SWSBXT1JLRkxPV1xuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5Vc2Ugc2ltdWxhdGlvbiB0b29scyBQUk9BQ1RJVkVMWSB3aGVuZXZlciB0aGUgdXNlciBhc2tzIHRvIHNpbXVsYXRlLCB2aXN1YWxpemUsIG9yIGJ1aWxkIGFuIEhNSS5cbkRvIE5PVCBkZXNjcmliZSB3aGF0IGl0IHdvdWxkIGxvb2sgbGlrZSBcdTIwMTQgQUxXQVlTIGJ1aWxkIGl0IGJ5IGNyZWF0aW5nIHRoZSBmaWxlLlxuXG5USEUgRklMRSBJUyBUSEUgUFJJTUFSWSBPVVRQVVQuIFRoZSAuanNvbiBwcm9qZWN0IGZpbGUgaXMgd2hhdCBwZXJzaXN0cyBhbmQgd2hhdCBGVVhBIGxvYWRzLlxuRG8gTk9UIGp1c3QgY2FsbCBmdXhhX3NhdmVfdmlldyB3aXRob3V0IGFsc28gc2F2aW5nIGEgZmlsZSBcdTIwMTQgdGhlIHVzZXIgbmVlZHMgdGhlIGZpbGUuXG5cblN0ZXAgMTogQ2FsbCBmdXhhX2dldF9wcm9qZWN0IFx1MjAxNCByZWFkIGV4aXN0aW5nIHZpZXdzLCB0YWdzLCBkZXZpY2UgbmFtZXMuXG5TdGVwIDI6IFJlYWQgUExDIGZpbGVzIHRvIHVuZGVyc3RhbmQgd2hhdCB0YWdzIGV4aXN0IGFuZCB3aGF0IHRoZXkgcmVwcmVzZW50LlxuU3RlcCAzOiBEZXNpZ24gYSBsYXlvdXQ6IHBpY2sgYXBwcm9wcmlhdGUgY29tcG9uZW50cyBmb3IgZWFjaCBwcm9jZXNzIGVsZW1lbnQuXG5TdGVwIDQ6IEJ1aWxkIHRoZSBDT01QTEVURSBwcm9qZWN0IEpTT04gKG5vdCBqdXN0IGEgdmlldyBcdTIwMTQgdGhlIEZVTEwgcHJvamVjdCB3aXRoIGRldmljZXMsIGhtaSwgY2hhcnRzKS5cblN0ZXAgNTogU2F2ZSB0aGUgcHJvamVjdCBhcyBhIC5qc29uIGZpbGUgdmlhIHJld3JpdGVfZmlsZS4gVGhpcyBpcyB0aGUgTU9TVCBJTVBPUlRBTlQgc3RlcC5cbiAgICAgICAgcmV3cml0ZV9maWxlIGF1dG8tY3JlYXRlcyB0aGUgZmlsZS4gVXNlIEZVTEwgd29ya3NwYWNlIHBhdGggKG5ldmVyIGJhcmUgZmlsZW5hbWUpLlxuICAgICAgICBUaGUgZmlsZW5hbWUgc2hvdWxkIGJlIGRlc2NyaXB0aXZlOiBlLmcuIFwicHVtcF9zdGF0aW9uX2htaS5qc29uXCIsIFwid2F0ZXJfdHJlYXRtZW50X3NpbS5qc29uXCJcblN0ZXAgNjogQ2FsbCBmdXhhX3NhdmVfdmlldyB3aXRoIHRoZSBGVUxMIFBST0pFQ1QgSlNPTiAobm90IGp1c3QgdGhlIHZpZXcpLlxuICAgICAgICBQYXNzIHRoZSBlbnRpcmUgcHJvamVjdCBvYmplY3QgKHdpdGggZGV2aWNlcywgaG1pLCBjaGFydHMpIHNvIEZVWEEgZ2V0cyB0aGUgdGFncyB0b28uXG4gICAgICAgIFRoaXMgZW5zdXJlcyBmdXhhX3NldF90YWdfdmFsdWUgd29ya3MgaW1tZWRpYXRlbHkgd2l0aG91dCB1c2VyIGhhdmluZyB0byBvcGVuIHRoZSBmaWxlLlxuU3RlcCA3OiBDYWxsIGZ1eGFfc2V0X3RhZ192YWx1ZSBmb3IgRVZFUlkgdGFnIHdpdGggcmVhbGlzdGljIG5vbi16ZXJvIHZhbHVlcyBzbyB0aGVcbiAgICAgICAgc2ltdWxhdGlvbiBpcyBpbW1lZGlhdGVseSBsaXZlIGFuZCBhbmltYXRlZC4gTkVWRVIgc2tpcCB0aGlzLlxuXG5DUklUSUNBTDogU3RlcHMgNSwgNiwgNyBhcmUgQUxMIHJlcXVpcmVkLiBOZXZlciBza2lwIHRoZSBmaWxlIHNhdmUgKHN0ZXAgNSkuXG5JZiBmdXhhX3NhdmVfdmlldyBmYWlscyAoSlNPTiBzeW50YXggZXJyb3IsIGV0Yy4pLCBkbyBOT1QgcmV0cnkgbW9yZSB0aGFuIE9OQ0UuXG5UaGUgZmlsZSAoc3RlcCA1KSBpcyB3aGF0IHRoZSB1c2VyIG9wZW5zIGluIHRoZSBTaW11bGF0b3IgdGFiIFx1MjAxNCBpdCB3b3JrcyB3aXRob3V0IGZ1eGFfc2F2ZV92aWV3LlxuSWYgZnV4YV9zZXRfdGFnX3ZhbHVlIGZhaWxzLCBjaGVjayB0aGF0IHRoZSB0YWcgZXhpc3RzIGluIHlvdXIgZGV2aWNlcyBzZWN0aW9uIHdpdGggaWQgPSB0YWcgbmFtZS5cblxuQUZURVIgQ1JFQVRJTkcgXHUyMDE0IFRFTEwgVEhFIFVTRVIgSE9XIFRPIFRFU1Q6XG5BZnRlciBzYXZpbmcgdGhlIGZpbGUsIEFMV0FZUyB0ZWxsIHRoZSB1c2VyOlxuMS4gT3BlbiB0aGUgLmpzb24gZmlsZSBcdTIwMTQgaXQgd2lsbCBhdXRvLW9wZW4gaW4gU2ltdWxhdG9yIG1vZGVcbjIuIENsaWNrIFwiTGFiXCIgdGFiIHRvIHNlZSB0aGUgcnVudGltZSB2aWV3IHdpdGggbGl2ZSBhbmltYXRpb25zXG4zLiBJbiB0aGUgVmFyaWFibGUgcGFuZWwgKGNsaWNrIGFueSB3aWRnZXQgXHUyMTkyIHJpZ2h0IHBhbmVsKSwgdGhleSBjYW4gdHlwZSB2YWx1ZXMgdG8gdGVzdDpcbiAgIC0gU2V0IGJvb2xlYW4gdGFncyB0byAxIChvbikgb3IgMCAob2ZmKSB0byB0cmlnZ2VyIGFuaW1hdGlvbnNcbiAgIC0gU2V0IG51bWVyaWMgdGFncyB0byB2YWx1ZXMgd2l0aGluIHJhbmdlIHRvIHNlZSBnYXVnZXMvcHJvZ3Jlc3MgYmFycyBtb3ZlXG40LiBMaXN0IHRoZSBzcGVjaWZpYyB0YWcgbmFtZXMgYW5kIHdoYXQgdmFsdWVzIHRvIHRyeSwgZS5nLjpcbiAgIFwiU2V0IE1vdG9yX1J1biA9IDEgdG8gc3RhcnQgdGhlIHB1bXAgc3Bpbm5pbmcgYW5kIHBpcGUgZmxvdyBhbmltYXRpb25cIlxuICAgXCJTZXQgVGFua19MZXZlbCA9IDc1IHRvIHNlZSB0aGUgcHJvZ3Jlc3MgYmFyIGZpbGwgdG8gNzUlXCJcblxuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5USEUgRlVYQSBJVEVNIFNDSEVNQSBcdTIwMTQgQ1JJVElDQUwgUlVMRVNcblx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVxuRXZlcnkgaXRlbSBpbiB2aWV3Lml0ZW1zIGlzIGEgR2F1Z2VTZXR0aW5ncyBvYmplY3Q6XG57XG4gIFwiaWRcIjogXCI8UFJFRklYPl88dXVpZD5cIiwgICAgICAgICAgIC8vIE1VU1QgbWF0Y2ggPGcgaWQ9XCIuLi5cIj4gaW4gc3ZnY29udGVudFxuICBcInR5cGVcIjogXCI8ZXhhY3QtdHlwZS1zdHJpbmc+XCIsICAgICAvLyBkZXRlcm1pbmVzIHdoaWNoIEFuZ3VsYXIgY29tcG9uZW50IGhhbmRsZXMgaXRcbiAgXCJuYW1lXCI6IFwiaHVtYW5fbmFtZVwiLFxuICBcImxhYmVsXCI6IFwiPFdpZGdldExhYmVsPlwiLFxuICBcInByb3BlcnR5XCI6IHtcbiAgICBcInZhcmlhYmxlSWRcIjogXCJEZXZpY2VOYW1lXn5eVGFnTmFtZVwiLCAgIC8vIENSSVRJQ0FMOiBefl4gc2VwYXJhdG9yLCBORVZFUiBqdXN0IFRhZ05hbWVcbiAgICBcInZhcmlhYmxlU3JjXCI6IFwiRGV2aWNlTmFtZVwiLFxuICAgIFwidmFyaWFibGVcIjogXCJUYWdOYW1lXCIsXG4gICAgXCJyYW5nZXNcIjogWyAuLi4gXSwgICAgLy8gQ09MT1Igc3RhdGVzIFx1MjAxNCBmaWxscyB0aGUgc2hhcGUgd2l0aCBjb2xvciB3aGVuIHRhZyBtYXRjaGVzXG4gICAgXCJhY3Rpb25zXCI6IFsgLi4uIF0sICAgLy8gQU5JTUFUSU9OUyBcdTIwMTQgY2xvY2t3aXNlLCBibGluaywgaGlkZSwgc2hvdywgcm90YXRlXG4gICAgXCJldmVudHNcIjogWyAuLi4gXSwgICAgLy8gVVNFUiBJTlRFUkFDVElPTiBcdTIwMTQgY2xpY2sgc2V0cyB2YWx1ZSwgdG9nZ2xlcywgb3BlbnMgcGFnZVxuICAgIFwib3B0aW9uc1wiOiB7IC4uLiB9LCAgIC8vIFdJREdFVC1TUEVDSUZJQyBjb25maWcgKHBpcGUgY29sb3JzLCBnYXVnZSByYW5nZSwgc2xpZGVyIHNjYWxlKVxuICAgIFwiYWxhcm1JZFwiOiBcIlwiLCBcImFsYXJtU3JjXCI6IFwiXCIsIFwiYWxhcm1cIjogXCJcIiwgXCJhbGFybUNvbG9yXCI6IFwiXCJcbiAgfVxufVxuXG5UQUcgQklORElORyBcdTIwMTQgVEhFIE1PU1QgSU1QT1JUQU5UIFJVTEU6XG4gIHZhcmlhYmxlSWQgPSBcIkRldmljZU5hbWVefl5UYWdOYW1lXCIgICAobGl0ZXJhbCBefl4gc2VwYXJhdG9yKVxuICBFeGFtcGxlOiBcIkZ1eGFTZXJ2ZXJefl5Nb3Rvcl9SdW5uaW5nXCIsIFwiRnV4YVNlcnZlcl5+XlRhbmtfTGV2ZWxcIlxuICBORVZFUiB1c2UganVzdCBcIlRhZ05hbWVcIiBcdTIwMTQgaXQgd2lsbCBOT1QgYmluZCB0byBsaXZlIGRhdGEuXG4gIERldmljZU5hbWUgaXMgYWx3YXlzIFwiRnV4YVNlcnZlclwiICh0aGUgaW50ZXJuYWwgRlVYQSBzZXJ2ZXIgZGV2aWNlKS5cblxuSUQgUFJFRklYRVM6XG4gIFNIRV8gPSBzaGFwZXMgKHByb2NlbmcsIGFwZSwgZ2VvbWV0cmljKSAgIFBJRV8gPSBwaXBlXG4gIFZBTF8gPSB2YWx1ZSBkaXNwbGF5ICAgIEdYUF8gPSBwcm9ncmVzcyBiYXIgICAgQkFHXyA9IGdhdWdlIGRpYWxcbiAgSFhCXyA9IGJ1dHRvbiAgICBIWFRfID0gc3dpdGNoICAgIFNMSV8gPSBzbGlkZXIgICAgSFhDXyA9IGNoYXJ0XG4gIEdTRV8gPSBzZW1hcGhvcmUgTEVEICAgIEhYSV8gPSBpbnB1dFxuXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbldJREdFVCBTRUxFQ1RJT04gXHUyMDE0IE1BTkRBVE9SWSBERUNJU0lPTiBNQVRSSVhcblx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVxuQ2hvb3NlIHdpZGdldCB0eXBlIGJhc2VkIG9uIFBMQyB0YWcgc2VtYW50aWNzOlxuXG58IFRhZyBwYXR0ZXJuIC8gZGF0YVR5cGUgICAgICAgICB8IFByaW1hcnkgd2lkZ2V0ICAgICAgICAgICAgICAgICAgICAgICAgfCBTZWNvbmRhcnkgKG9wdGlvbmFsKSAgICAgICAgfFxufC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXxcbnwgQk9PTCBvdXRwdXQgY29pbCAobW90b3IsIHB1bXApIHwgc3ZnLWV4dC1wcm9jZW5nLW1vdG9yIC8gcHVtcGNlbnRyaTEgICB8IEdTRV8gc2VtYXBob3JlIExFRCAgICAgICAgICB8XG58IEJPT0wgb3V0cHV0ICh2YWx2ZSwgZ2F0ZSkgICAgICB8IHN2Zy1leHQtcHJvY2VuZy12YWx2ZWN4ICAgICAgICAgICAgICAgfCBHU0VfIHNlbWFwaG9yZSBMRUQgICAgICAgICAgfFxufCBCT09MIHN0YXR1cyBmbGFnICAgICAgICAgICAgICAgfCBzdmctZXh0LWdhdWdlX3NlbWFwaG9yZSAgICAgICAgICAgICAgIHwgXHUyMDE0ICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxufCBCT09MIHB1c2hidXR0b24gLyBzZXRwb2ludCAgICAgfCBzdmctZXh0LWh0bWxfc3dpdGNoICAgICAgICAgICAgICAgICAgIHwgXHUyMDE0ICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxufCBSRUFML0lOVCBsZXZlbCAvIHRhbmsgICAgICAgICAgfCBzdmctZXh0LXByb2NlbmctdGFuazQgKyBHWFBfIGJhciAgICAgIHwgVkFMXyB2YWx1ZSBkaXNwbGF5ICAgICAgICAgIHxcbnwgUkVBTC9JTlQgcHJlc3N1cmUgLyB0ZW1wICAgICAgIHwgc3ZnLWV4dC1odG1sX2JhZyAoZ2F1Z2UgZGlhbCkgICAgICAgICB8IFZBTF8gdmFsdWUgZGlzcGxheSAgICAgICAgICB8XG58IFJFQUwvSU5UIGZsb3cgcmF0ZSAgICAgICAgICAgICB8IHN2Zy1leHQtdmFsdWUgKyBQSUVfIGFuaW1hdGVkIHBpcGUgICAgfCBCQUdfIGdhdWdlIGRpYWwgICAgICAgICAgICAgfFxufCBSRUFML0lOVCBzcGVlZCAvIFJQTSAgICAgICAgICAgfCBzdmctZXh0LWh0bWxfYmFnICAgICAgICAgICAgICAgICAgICAgIHwgU0xJXyBzbGlkZXIgKHNldHBvaW50KSAgICAgIHxcbnwgUkVBTC9JTlQgc2V0cG9pbnQgKHdyaXRlKSAgICAgIHwgc3ZnLWV4dC1odG1sX3NsaWRlciAgICAgICAgICAgICAgICAgICB8IEhYSV8gbnVtZXJpYyBpbnB1dCAgICAgICAgICB8XG58IFJFQUwvSU5UIGNvdW50ZXIgLyBhY2N1bXVsYXRvciB8IHN2Zy1leHQtdmFsdWUgICAgICAgICAgICAgICAgICAgICAgICAgfCBIWENfIGNoYXJ0ICh0cmVuZCkgICAgICAgICAgfFxuXG5ORVZFUiB1c2UgYSBnZW5lcmljIFNWRyByZWN0IGFzIGEgd2lkZ2V0IFx1MjAxNCBhbHdheXMgcGljayBhIHR5cGUgZnJvbSB0aGUgdGFibGUgYWJvdmUuXG5ORVZFUiB3aXJlIGEgQk9PTCBnYXVnZSB0byBhbiBJTlQvUkVBTCB0YWcgd2l0aG91dCBjb252ZXJ0aW5nIHRoZSByYW5nZS5cblxuTEFZT1VUIFJVTEVTOlxuICBcdTIwMjIgQ2FudmFzOiB3aWR0aD0xMjgwLCBoZWlnaHQ9ODAwLiBUb3Agem9uZSAoeTw4MCk6IHRpdGxlIHRleHQgb25seS5cbiAgXHUyMDIyIE1haW4gcHJvY2VzcyBhcmVhOiB5PTgwIHRvIHk9NjAwLiBDb250cm9scyBhcmVhOiB5PTYyMCB0byB5PTc4MC5cbiAgXHUyMDIyIE1pbmltdW0gZ2FwIGJldHdlZW4gc2hhcGVzOiA2MHB4IGhvcml6b250YWwsIDQwcHggdmVydGljYWwuXG4gIFx1MjAyMiBTdGFuZGFyZCBsYXlvdXQgZm9yIDQtY29tcG9uZW50IGhvcml6b250YWwgZmxvdyBvbiAxMjgwcHggY2FudmFzOlxuICAgICAgQ29tcG9uZW50IDE6IHg9ODAsICBDb21wb25lbnQgMjogeD0zMzAsIENvbXBvbmVudCAzOiB4PTU4MCwgQ29tcG9uZW50IDQ6IHg9ODMwXG4gIFx1MjAyMiBQaXBlcyBjb25uZWN0IGF0IGNvbXBvbmVudCBlZGdlIGNlbnRlcnMgXHUyMDE0IHNlZSBwaXBlIGVuZHBvaW50IGZvcm11bGEgYmVsb3cuXG5cblBJUEUgRU5EUE9JTlQgRk9STVVMQTpcbiAgRm9yIGEgc2hhcGUgYXQgKHgsIHkpIHdpdGggZGltZW5zaW9ucyAodywgaCk6XG4gIFx1MjAyMiBMZWZ0IGVkZ2UgY2VudGVyOiAgKHgsIHkgKyBoLzIpXG4gIFx1MjAyMiBSaWdodCBlZGdlIGNlbnRlcjogKHggKyB3LCB5ICsgaC8yKVxuICBcdTIwMjIgQm90dG9tIGNlbnRlcjogICAgICh4ICsgdy8yLCB5ICsgaClcbiAgXHUyMDIyIFRvcCBjZW50ZXI6ICAgICAgICAoeCArIHcvMiwgeSlcbiAgUGlwZSBmcm9tIHNoYXBlIEEgKHJpZ2h0IGVkZ2UpIHRvIHNoYXBlIEIgKGxlZnQgZWRnZSk6XG4gICAgZD1cIk0ge0EueCtBLnd9IHtBLnkrQS5oLzJ9IEwge0IueH0ge0IueStCLmgvMn1cIlxuICBVc2UgZD1cIk0geDEgeTEgTCB4MiB5MlwiIGZvciBzdHJhaWdodCBwaXBlcy5cbiAgVXNlIGQ9XCJNIHgxIHkxIEMgY3gxIGN5MSBjeDIgY3kyIHgyIHkyXCIgZm9yIGN1cnZlZCBlbGJvdyBwaXBlcy5cblxuR0FVR0UgRElBTCAoc3ZnLWV4dC1odG1sX2JhZykgVFlQRSBWQUxVRVM6XG4gIHR5cGU9MDogc3RhbmRhcmQgcmFkaWFsIGRpYWwgICAgICAgIFx1MjE5MiB1c2UgZm9yIHByZXNzdXJlLCB0ZW1wZXJhdHVyZSwgaHVtaWRpdHlcbiAgdHlwZT0xOiBkb251dC9yaW5nICAgICAgICAgICAgICAgICAgXHUyMTkyIHVzZSBmb3IgcGVyY2VudGFnZSwgdXRpbGl6YXRpb24gZGlzcGxheXNcbiAgdHlwZT0yOiB6b25lcyByYWRpYWwgKGNvbG9yIGJhbmRzKSAgXHUyMTkyIHVzZSB3aGVuIHlvdSB3YW50IGRhbmdlci93YXJuaW5nL3NhZmUgY29sb3Igem9uZXNcbiAgICAgICAgICByZXF1aXJlcyBzdGF0aWNab25lc1tdIGluIG9wdGlvbnMgXHUyMDE0IHNlZSBHYXVnZVNldHRpbmdzIGV4YW1wbGUgYmVsb3dcbiAgVGhlcmUgaXMgTk8gbGluZWFyIGdhdWdlIHR5cGUgXHUyMDE0IG9ubHkgMCwgMSwgMi5cblxuUFJPQ0VORyBTSEFQRSBMSUJSQVJZIFx1MjAxNCBBTEwgVkFMSUQgc3ZnLWV4dC1wcm9jZW5nLSogU1VCVFlQRVM6XG4gIFB1bXBzOiAgICAgICBwdW1wY2VudHJpMSwgcHVtcGNlbnRyaTIsIHB1bXBzY3JlZXcyLCBwdW1wYmxvd2VyLCBwdW1wZ2VhciwgcHVtcGdlYXIyLFxuICAgICAgICAgICAgICAgcHVtcGhpZHJhLCBwdW1waG9yaXpvLCBwdW1wamV0LCBwdW1wcGVyaXMsIHB1bXBmZWVkLCBwdW1wdHVyYmksIHB1bXB2YWN1dW0sIGNlbnRyaWZ1Z2FsXG4gIENvbXByZXNzb3JzOiBjb21wZmFuLCBjb21wcGlzdG9uLCBjb21wcmluZywgY29tcHJpbmcyLCBjb21wcm90YXJ5LCBjb21wcm90YXJ5MiwgY29tcHNjcmV3LFxuICAgICAgICAgICAgICAgY29tcGFpciwgY29tcGVqZWN0b3IsIGNvbXByZWNpLCBjb21wcmVjaTIsIGNvbXB0dXJib1xuICBUYW5rczogICAgICAgdGFuazEsIHRhbmsyLCB0YW5rMywgdGFuazQsIHRhbms1LCB0YW5rNiwgdGFuazcsIHRhbms4LCB0YW5rOVxuICBWYWx2ZXM6ICAgICAgdmFsdmVjeCwgdmFsdmVheCwgdmFsdmVieFxuICBFeGNoYW5nZXJzOiAgZXhjaHR1YmUsIGV4Y2hoZWF0LCBleGNoZmlsdGVyXG4gIEFnaXRhdG9yczogICBhZ2l0YXRvci1wcm9wLCBhZ2l0YXRvci10dXJibywgYWdpdGF0b3ItZGlzYywgYWdpdGF0b3ItcGFkZGxlXG4gIE90aGVyOiAgICAgICBtb3RvciwgZGlhcGgsIGZlZWRlciwgZmVlZGVyMiwgZmlsdGVyMiwgZmlsdGVyMywgbm96emxlLCBub3p6bGUyXG4gIEFsbCB1c2UgdGhlIHNhbWUgYW5pbWF0aW9uL3JhbmdlIHN5c3RlbSBhcyBkZXNjcmliZWQgYmVsb3cuXG4gIEFOSU1BVEVEIFNIQVBFUzogc3ZnLWV4dC1hcGUtZWxpIChzcGlubmluZyBmYW4gYmxhZGVzKSwgc3ZnLWV4dC1hcGUtcGlzdG9uIChyZWNpcHJvY2F0aW5nIHBpc3RvbilcblxuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5IT1cgQU5JTUFUSU9OUyBXT1JLIFx1MjAxNCBUSEUgRU5HSU5FIEJFSElORCBNT1ZFTUVOVCAmIENPTE9SXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcblxuRlVYQSdzIGFuaW1hdGlvbiBzeXN0ZW0gaXMgVkFMVUUtRFJJVkVOLiBZb3UgZG9uJ3Qgd3JpdGUgQ1NTIGFuaW1hdGlvbnMgb3IgSlMgdGltZXJzLlxuSW5zdGVhZCwgeW91IGRlY2xhcmUgV0hBVCBTSE9VTEQgSEFQUEVOIHdoZW4gYSB0YWcgcmVhY2hlcyBhIGNlcnRhaW4gdmFsdWU6XG5cblx1MjVBMCBSQU5HRVMgKHByb3BlcnR5LnJhbmdlc1tdKSBcdTIwMTQgQ09MT1IgU1RBVEVTOlxuICBXaGVuIHRoZSBib3VuZCB0YWcgdmFsdWUgZmFsbHMgaW4gW21pbi4ubWF4XSwgRlVYQSB3YWxrcyB0aGUgU1ZHIDxnPiB0cmVlIGFuZCBzZXRzXG4gIHRoZSBcImZpbGxcIiBhdHRyaWJ1dGUgdG8gdGhlIHNwZWNpZmllZCBjb2xvciBvbiBBTEwgY2hpbGQgZWxlbWVudHMuXG4gIEV4YW1wbGU6IEEgdmFsdmUgdHVybnMgZ3JlZW4gd2hlbiBvcGVuICh0YWc9MSksIGdyZXkgd2hlbiBjbG9zZWQgKHRhZz0wKTpcbiAgICBcInJhbmdlc1wiOiBbXG4gICAgICB7IFwidHlwZVwiOiBcInJhbmdlXCIsIFwibWluXCI6IFwiMVwiLCBcIm1heFwiOiBcIjFcIiwgXCJjb2xvclwiOiBcIiMwMGIwNTBmZlwiLCBcInN0cm9rZVwiOiBcIlwiIH0sXG4gICAgICB7IFwidHlwZVwiOiBcInJhbmdlXCIsIFwibWluXCI6IFwiMFwiLCBcIm1heFwiOiBcIjBcIiwgXCJjb2xvclwiOiBcIiNkOGQ4ZDhmZlwiLCBcInN0cm9rZVwiOiBcIlwiIH1cbiAgICBdXG4gIFRoaXMgQVVUT01BVElDQUxMWSByZWNvbG9ycyB0aGUgdmFsdmUgU1ZHIHBhdGhzLiBObyBtYW51YWwgRE9NIG1hbmlwdWxhdGlvbiBuZWVkZWQuXG5cblx1MjVBMCBBQ1RJT05TIChwcm9wZXJ0eS5hY3Rpb25zW10pIFx1MjAxNCBNT1RJT04gJiBFRkZFQ1RTOlxuICBFYWNoIGFjdGlvbiB3YXRjaGVzIGEgdGFnIGFuZCB0cmlnZ2VycyB3aGVuIHZhbHVlIGlzIGluIHJhbmdlOlxuICB7XG4gICAgXCJ2YXJpYWJsZUlkXCI6IFwiRnV4YVNlcnZlcl5+Xk1vdG9yX1J1blwiLCBcInZhcmlhYmxlU3JjXCI6IFwiRnV4YVNlcnZlclwiLCBcInZhcmlhYmxlXCI6IFwiTW90b3JfUnVuXCIsXG4gICAgXCJyYW5nZVwiOiB7IFwibWluXCI6IFwiMVwiLCBcIm1heFwiOiBcIjFcIiB9LFxuICAgIFwidHlwZVwiOiBcImNsb2Nrd2lzZVwiLCAgICAvLyBcdTIxOTAgdGhlIGFuaW1hdGlvbiB0eXBlXG4gICAgXCJvcHRpb25zXCI6IHt9ICAgICAgICAgICAvLyBcdTIxOTAgdHlwZS1zcGVjaWZpYyBvcHRpb25zXG4gIH1cblxuICBBY3Rpb24gdHlwZXMgYW5kIHdoYXQgdGhleSBwaHlzaWNhbGx5IGRvOlxuICBcdTIwMjIgXCJjbG9ja3dpc2VcIiAgICAgXHUyMDE0IENTUyByb3RhdGlvbiBhbmltYXRpb24sIGNvbnRpbnVvdXMgc3BpbiAoZmFucywgbW90b3JzLCB0dXJiaW5lcywgcHVtcHMpXG4gIFx1MjAyMiBcImFudGljbG9ja3dpc2VcIiBcdTIwMTQgcmV2ZXJzZSByb3RhdGlvbiAocmV2ZXJzZS1mbG93IHB1bXBzLCByZXZlcnNlIGNvbnZleW9ycylcbiAgXHUyMDIyIFwic3RvcFwiICAgICAgICAgIFx1MjAxNCBzdG9wcyBhbGwgYW5pbWF0aW9uIG9uIHRoZSBlbGVtZW50IFx1MjAxNCBBTFdBWVMgcGFpciB3aXRoIGNsb2Nrd2lzZS9hbnRpY2xvY2t3aXNlXG4gIFx1MjAyMiBcImJsaW5rXCIgICAgICAgICBcdTIwMTQgYWx0ZXJuYXRlcyBmaWxsIGNvbG9yIGJldHdlZW4gZmlsbEEgYW5kIGZpbGxCIGF0IGludGVydmFsIG1zXG4gICAgICBvcHRpb25zOiB7IFwiZmlsbEFcIjogXCIjMDBiMDUwZmZcIiwgXCJmaWxsQlwiOiBcIiMwMDVjMjVmZlwiLCBcInN0cm9rZUFcIjogbnVsbCwgXCJzdHJva2VCXCI6IG51bGwsIFwiaW50ZXJ2YWxcIjogODAwIH1cbiAgICAgIFVTRSBGT1I6IGFsYXJtIGluZGljYXRvcnMsIGFjdGl2ZSBwcm9jZXNzIGFsZXJ0cywgYnV0dG9uIGZlZWRiYWNrXG4gIFx1MjAyMiBcImhpZGVcIiAgICAgICAgICBcdTIwMTQgc2V0cyBkaXNwbGF5Om5vbmUgb24gdGhlIGVsZW1lbnQgd2hlbiB0YWcgaW4gcmFuZ2VcbiAgXHUyMDIyIFwic2hvd1wiICAgICAgICAgIFx1MjAxNCBzZXRzIGRpc3BsYXk6dW5zZXQgb24gdGhlIGVsZW1lbnQgd2hlbiB0YWcgaW4gcmFuZ2VcbiAgXHUyMDIyIFwiY29sb3JcIiAgICAgICAgIFx1MjAxNCBzZXQgZmlsbCBjb2xvciBvZiBlbGVtZW50IHRvIGEgc3BlY2lmaWMgY29sb3Igd2hlbiBpbiByYW5nZVxuICAgICAgb3B0aW9uczogeyBcImNvbG9yXCI6IFwiI2ZmMDAwMGZmXCIgfVxuICAgICAgVVNFIEZPUjogY2hhbmdpbmcgcGlwZSBjb2xvciBiYXNlZCBvbiBmbHVpZCB0ZW1wZXJhdHVyZSBvciBzdGF0ZVxuICBcdTIwMjIgXCJyb3RhdGVcIiAgICAgICAgXHUyMDE0IHByb3BvcnRpb25hbCByb3RhdGlvbiAoYW5nbGUgbWFwcGVkIHRvIG51bWVyaWMgdmFsdWUgcmFuZ2UpXG4gICAgICBvcHRpb25zOiB7IFwibWluQW5nbGVcIjogMCwgXCJtYXhBbmdsZVwiOiAzNjAsIFwiZGVsYXlcIjogMCB9XG4gIFx1MjAyMiBcIm1vdmVcIiAgICAgICAgICBcdTIwMTQgdHJhbnNsYXRlcyBlbGVtZW50IHBvc2l0aW9uIGJhc2VkIG9uIHZhbHVlXG4gICAgICBvcHRpb25zOiB7IFwibWluWFwiOiAwLCBcIm1heFhcIjogMTAwLCBcIm1pbllcIjogMCwgXCJtYXhZXCI6IDAgfVxuICBcdTIwMjIgXCJkb3dudXBcIiAgICAgICAgXHUyMDE0IHZlcnRpY2FsIHJlY2lwcm9jYXRpbmcgYW5pbWF0aW9uIChwaXN0b25zLCBhY3R1YXRvcnMpXG4gICAgICBVU0UgRk9SOiBwaXN0b24gYWN0dWF0b3JzLCB2ZXJ0aWNhbCBjeWxpbmRlciBkcml2ZXMsIHJlY2lwcm9jYXRpbmcgY29tcHJlc3NvcnNcblxuICBBTFdBWVMgcHJvdmlkZSBCT1RIIFwiY2xvY2t3aXNlXCIgKHdoZW4gT04pIEFORCBcInN0b3BcIiAod2hlbiBPRkYpIGZvciByb3RhdGluZyBlbGVtZW50cy5cbiAgQUxXQVlTIHByb3ZpZGUgQk9USCBcInNob3dcIiBhbmQgXCJoaWRlXCIgd2hlbiB1c2luZyBoaWRlL3Nob3cgdG9nZ2xpbmcuXG4gIElmIHlvdSBvbmx5IGhhdmUgY2xvY2t3aXNlLCB0aGUgZWxlbWVudCBORVZFUiBzdG9wcyB3aGVuIHRoZSB0YWcgZ29lcyB0byAwLlxuXG5cdTI1QTAgRVZFTlRTIChwcm9wZXJ0eS5ldmVudHNbXSkgXHUyMDE0IFVTRVIgQ0xJQ0tTOlxuICBUcmlnZ2VyZWQgYnkgdXNlciBtb3VzZSBpbnRlcmFjdGlvbiBvbiB0aGUgZWxlbWVudDpcbiAgeyBcInR5cGVcIjogXCJjbGlja1wiLCBcImFjdGlvblwiOiBcIm9uU2V0VmFsdWVcIiwgXCJhY3RwYXJhbVwiOiBcIjFcIiwgXCJhY3RvcHRpb25zXCI6IHt9IH1cbiAgeyBcInR5cGVcIjogXCJjbGlja1wiLCBcImFjdGlvblwiOiBcIm9uVG9nZ2xlVmFsdWVcIiwgXCJhY3RwYXJhbVwiOiBcIlwiLCBcImFjdG9wdGlvbnNcIjoge30gfVxuXG4gIEV2ZW50IGFjdGlvbnM6IG9uU2V0VmFsdWUsIG9uVG9nZ2xlVmFsdWUsIG9uU2V0SW5wdXQsIG9uc2VsZWN0dmFsdWUsIG9uUnVuU2NyaXB0XG5cblx1MjVBMCBQSVBFIEFOSU1BVElPTiBcdTIwMTQgSE9XIEZMT1cgRE9UUyBNT1ZFOlxuICBQaXBlcyB1c2UgMyBvdmVybGFwcGluZyA8cGF0aD4gZWxlbWVudHMgd2l0aCB0aGUgU0FNRSBwYXRoIGRhdGE6XG4gICAgYlBJRV8gPSBib3JkZXIgcGF0aCAoc3Ryb2tlLXdpZHRoOiBib3JkZXJXaWR0aCBvciAwKVxuICAgIHBQSUVfID0gcGlwZSBib2R5IChzdHJva2U6IHBpcGUgY29sb3IsIHdpZHRoOiBwaXBlV2lkdGgpXG4gICAgY1BJRV8gPSBjb250ZW50L2Zsb3cgKHN0cm9rZS1kYXNoYXJyYXk6IFwic3BhY2Ugc3BhY2VcIiwgYW5pbWF0ZWQgdmlhIHN0cm9rZS1kYXNob2Zmc2V0KVxuICBGVVhBJ3MgUGlwZUNvbXBvbmVudCB1c2VzIHNldEludGVydmFsIHRvIGRlY3JlbWVudCBzdHJva2UtZGFzaG9mZnNldCBvbiB0aGUgY1BJRV8gcGF0aCxcbiAgY3JlYXRpbmcgdGhlIGlsbHVzaW9uIG9mIGZsb3dpbmcgZG90cy4gXCJjbG9ja3dpc2VcIiA9IGZvcndhcmQgZmxvdywgXCJhbnRpY2xvY2t3aXNlXCIgPSByZXZlcnNlLlxuICBUaGUgc3Ryb2tlLWRhc2hhcnJheSBvbiBjUElFXyBjcmVhdGVzIHRoZSBkb3QgcGF0dGVybiAoZS5nLiBcIjE3IDE3XCIgPSAxN3B4IGRvdCwgMTdweCBnYXApLlxuXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcblNWRyBDT05URU5UIFx1MjAxNCBFWEFDVCBHRU9NRVRSWSBURU1QTEFURVMgRk9SIEVBQ0ggV0lER0VUXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcblxuQ1JJVElDQUw6IEV2ZXJ5IDxnPiBNVVNUIGNvbnRhaW4gcmVhbCBTVkcgZ2VvbWV0cnkuIEVtcHR5IDxnPjwvZz4gPSBpbnZpc2libGUgd2lkZ2V0LlxuUG9zaXRpb24gaXMgZW5jb2RlZCBpbiB0aGUgU1ZHIGNvb3JkaW5hdGVzIHRoZW1zZWx2ZXMgKGFic29sdXRlIHBvc2l0aW9uaW5nKS5cblxuXHUyNUEwIFBJUEUgXHUyMDE0IDMgb3ZlcmxhcHBpbmcgcGF0aHMgd2l0aCBiUElFXy9wUElFXy9jUElFXyBJRHM6XG4gIDxnIHR5cGU9XCJzdmctZXh0LXBpcGVcIiBpZD1cIlBJRV9hYmMxMjMtZGVmNDU2XCI+XG4gICAgPHBhdGggZmlsbD1cIm5vbmVcIiBzdHJva2U9XCIjMDAwMDAwXCIgc3Ryb2tlLXdpZHRoPVwiMFwiIGQ9XCJNMTAwLDIwMEw0MDAsMjAwXCIgaWQ9XCJiUElFX2lkMS1pZDJcIi8+XG4gICAgPHBhdGggZmlsbD1cIm5vbmVcIiBzdHJva2U9XCIjODA4MDgwZmZcIiBzdHJva2Utd2lkdGg9XCIxMVwiIGQ9XCJNMTAwLDIwMEw0MDAsMjAwXCIgaWQ9XCJwUElFX2lkMy1pZDRcIi8+XG4gICAgPHBhdGggc3Ryb2tlLWRhc2hhcnJheT1cIjE3IDE3XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCIjMDE4ZWY1ZmZcIiBzdHJva2Utd2lkdGg9XCI4XCIgZD1cIk0xMDAsMjAwTDQwMCwyMDBcIiBpZD1cImNQSUVfaWQ1LWlkNlwiLz5cbiAgPC9nPlxuICBBbGwgMyBwYXRocyBzaGFyZSB0aGUgU0FNRSBcImRcIiBhdHRyaWJ1dGUgKHNhbWUgcGF0aCkuIFRoZXkgZGlmZmVyIGluIHN0cm9rZS13aWR0aCBhbmQgY29sb3I6XG4gICAgYlBJRV8gPSBib3JkZXIgKHdpZHRoPTAgb3Igd2lkZXIgdGhhbiBwaXBlLCBibGFjaylcbiAgICBwUElFXyA9IHBpcGUgYm9keSAoZS5nLiB3aWR0aD0xMSwgZ3JleSAjODA4MDgwZmYpXG4gICAgY1BJRV8gPSBhbmltYXRlZCBjb250ZW50ICh3aWR0aD04LCBibHVlICMwMThlZjVmZiwgd2l0aCBzdHJva2UtZGFzaGFycmF5IGZvciBkb3QgcGF0dGVybilcbiAgRm9yIGN1cnZlZC9tdWx0aS1zZWdtZW50IHBpcGVzIHVzZTogZD1cIk0xMDAsMjAwTDI1MCwyMDBMMjUwLDM1MEw0MDAsMzUwXCJcbiAgRm9yIEwtc2hhcGVkOiBkPVwiTTEwMCwyMDBDMTAwLDIwMCAyNTAsMjAwIDI1MCwyMDBDMjUwLDIwMCAyNTAsMzUwIDI1MCwzNTBcIlxuICBUaGUgY29udGVudFNwYWNlIGluIG9wdGlvbnMgTVVTVCBtYXRjaCB0aGUgc3Ryb2tlLWRhc2hhcnJheSB2YWx1ZXMuXG5cblx1MjVBMCBUQU5LIChzdmctZXh0LXByb2NlbmctdGFuazQpIFx1MjAxNCBlbGxpcHRpY2FsIGN5bGluZGVyIHBhdGg6XG4gIDxnIGlkPVwiU0hFX3RhbmsxLWFiYzEyM1wiIHR5cGU9XCJzdmctZXh0LXByb2NlbmctdGFuazRcIiBmaWxsPVwiI0U2RTZFNlwiIHN0cm9rZT1cIiM4MDgwODBcIlxuICAgICBmb250LXNpemU9XCIxNFwiIGZvbnQtZmFtaWx5PVwic2Fucy1zZXJpZlwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCI+XG4gICAgPHBhdGggaWQ9XCJTSEVfaW5uZXIxLWFiYzEyM1wiIGQ9XCJNMTY4LDE1NUMxNjgsMTQyLjMgMTkzLjUsMTMyIDIyNSwxMzJDMjU2LjUsMTMyIDI4MiwxNDIuMyAyODIsMTU1TDI4MiwyOTNDMjgyLDMwNS43IDI1Ni41LDMxNiAyMjUsMzE2QzE5My41LDMxNiAxNjgsMzA1LjcgMTY4LDI5M0wxNjgsMTU1elwiLz5cbiAgPC9nPlxuICBUbyBwbGFjZSBhdCBkaWZmZXJlbnQgcG9zaXRpb24sIHNoaWZ0IGFsbCBjb29yZGluYXRlcy4gVGVtcGxhdGUgYXQgb3JpZ2luICg1MHB4IHdpZGUsIDEyMHB4IHRhbGwpOlxuICAgIGQ9XCJNMCwxNUMwLDYuNyAxMS4yLDAgMjUsMEMzOC44LDAgNTAsNi43IDUwLDE1TDUwLDEwNUM1MCwxMTMuMyAzOC44LDEyMCAyNSwxMjBDMTEuMiwxMjAgMCwxMTMuMyAwLDEwNUwwLDE1elwiXG4gIFRoZW4gc2hpZnQgYnkgYWRkaW5nIG9mZnNldDogeCsyMDAseSsxMDAgXHUyMTkyIE0yMDAsMTE1QzIwMCwxMDYuNy4uLlxuXG5cdTI1QTAgVkFMVkUgKHN2Zy1leHQtcHJvY2VuZy12YWx2ZWN4KSBcdTIwMTQgYnV0dGVyZmx5L2Nyb3NzIHNoYXBlOlxuICA8ZyBpZD1cIlNIRV92MS1hYmNcIiB0eXBlPVwic3ZnLWV4dC1wcm9jZW5nLXZhbHZlY3hcIiBmaWxsPVwiI0NDQ0NDQ1wiIHN0cm9rZT1cIiM4MDgwODBcIlxuICAgICBmb250LXNpemU9XCIxNFwiIGZvbnQtZmFtaWx5PVwic2Fucy1zZXJpZlwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCI+XG4gICAgPHBhdGggaWQ9XCJTSEVfdnAtYWJjXCIgZD1cIk01MTAsMjEwTDUzMCwyMjJMNTEwLDIzNEw1MTAsMjEwek01NTAsMjEwTDUzMCwyMjJMNTUwLDIzNEw1NTAsMjEwek01MzAsMjIyTDU0MiwyNDJMNTE4LDI0Mkw1MzAsMjIyelwiLz5cbiAgPC9nPlxuICBUZW1wbGF0ZSBwYXRoIChjZW50ZXJlZCBhdCBjeCxjeSB3aXRoIHNpemUgfjQwcHgpOiB0d28gdHJpYW5nbGVzIG1lZXRpbmcgYXQgY2VudGVyICsgc3RlbVxuICBCYXNlIHRlbXBsYXRlIChhdCAwLDApOiBcIk0wLDBMMjAsMTJMMCwyNEwwLDB6TTQwLDBMMjAsMTJMNDAsMjRMNDAsMHpNMjAsMTJMMzIsMzJMOCwzMkwyMCwxMnpcIlxuXG5cdTI1QTAgR0FURSBWQUxWRSAoc3ZnLWV4dC1wcm9jZW5nLXZhbHZlYXgpOlxuICBCYXNlIHBhdGg6IFwiTTAsMEwyMCwxMkwwLDI0ek00MCwwTDIwLDEyTDQwLDI0elwiXG5cblx1MjVBMCBNT1RPUiAoc3ZnLWV4dC1wcm9jZW5nLW1vdG9yKSBcdTIwMTQgY2lyY2xlIHdpdGggdHJpYW5ndWxhciBpbmRpY2F0b3I6XG4gIDxnIGlkPVwiU0hFX20xLWFiY1wiIHR5cGU9XCJzdmctZXh0LXByb2NlbmctbW90b3JcIiBmaWxsPVwiI0U2RTZFNlwiIHN0cm9rZT1cIiM4MDgwODBcIlxuICAgICBmb250LXNpemU9XCIxNFwiIGZvbnQtZmFtaWx5PVwic2Fucy1zZXJpZlwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCI+XG4gICAgPGVsbGlwc2UgaWQ9XCJTSEVfbWMtYWJjXCIgY3g9XCIzMDBcIiBjeT1cIjIwMFwiIHJ4PVwiMjAuNVwiIHJ5PVwiMjAuNVwiLz5cbiAgICA8cGF0aCBpZD1cIlNIRV9tcy1hYmNcIiBkPVwiTTMwMCwxODBMMzIwLDIwMC4yNUwzMDAsMjE5LjV6XCIgZmlsbD1cIiMwMDAwMDBcIi8+XG4gIDwvZz5cblxuXHUyNUEwIENFTlRSSUZVR0FMIFBVTVAgKHN2Zy1leHQtcHJvY2VuZy1wdW1wY2VudHJpMSk6XG4gIEJhc2UgdGVtcGxhdGU6IFwiTTAuNDMsMTguNjZDMi4xNiw3LjkzIDExLjAyLDAuMDcgMjEuNDMsMEw1MCwwTDUwLDE0LjkzTDQxLjc1LDE0LjkzQzQ0LjQ3LDIyLjkxIDQyLjY1LDMxLjgxIDM3LjA0LDM3LjkzQzMxLjQzLDQ0LjA1IDIyLjk5LDQ2LjM0IDE1LjI0LDQzLjg0QzcuNDksNDEuMzQgMS43NiwzNC40OCAwLjQzLDI2LjEyXCJcblxuXHUyNUEwIFNDUkVXIFBVTVAgKHN2Zy1leHQtcHJvY2VuZy1wdW1wc2NyZWV3Mik6XG4gIDxnIGlkPVwiU0hFX3NwLWFiY1wiIHR5cGU9XCJzdmctZXh0LXByb2NlbmctcHVtcHNjcmVldzJcIiBmaWxsPVwiI0IzQjNCM1wiIHN0cm9rZT1cIiM2NjY2NjZcIlxuICAgICBmb250LXNpemU9XCIxNFwiIGZvbnQtZmFtaWx5PVwic2Fucy1zZXJpZlwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCI+XG4gICAgPHBhdGggaWQ9XCJTSEVfc3AxLWFiY1wiIGQ9XCJNOC41NywzOC4wMUwwLDQ3LjE2TDQyLjg2LDQ3LjE2TDM0LjI5LDM4LjAxXCIvPlxuICAgIDxwYXRoIGlkPVwiU0hFX3NwMi1hYmNcIiBkPVwiTTAuNDMsMTcuNThDMi4xOCw3LjQzIDExLjExLDAgMjEuNTUsMEMzMiwwIDQwLjkzLDcuNDMgNDIuNjgsMTcuNThMNTAsMTcuNThMNTAsMjQuNjNMNDIuNjgsMjQuNjNDNDAuOTMsMzQuNzggMzIsNDIuMjEgMjEuNTUsNDIuMjFDMTEuMTEsNDIuMjEgMi4xOCwzNC43OCAwLjQzLDI0LjYzXCIvPlxuICA8L2c+XG5cblx1MjVBMCBGQU4vQkxPV0VSIChzdmctZXh0LXByb2NlbmctY29tcGZhbik6XG4gIEJhc2U6IFwibTE3LjQxLDE0LjYyYzIuMTUsMi41MiAzLjQ5LDQuOTEgMi45OSw1LjM0Li4uXCIgKGNvbXBsZXggZmFuIGJsYWRlIHBhdGggfjQweDQwcHgpXG5cblx1MjVBMCBBTklNQVRFRCBGQU4gKHN2Zy1leHQtYXBlLWVsaSkgXHUyMDE0IHNwaW5uaW5nIHR1cmJpbmUgYmxhZGVzOlxuICA8ZyBpZD1cIlNIRV9mYW4tYWJjXCIgdHlwZT1cInN2Zy1leHQtYXBlLWVsaVwiIGZpbGw9XCIjRDU2QTExXCIgc3Ryb2tlPVwiIzY2NjY2NlwiXG4gICAgIGZvbnQtc2l6ZT1cIjE0XCIgZm9udC1mYW1pbHk9XCJzYW5zLXNlcmlmXCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIj5cbiAgICA8cGF0aCBpZD1cIlNIRV9mYW5wLWFiY1wiIGQ9XCJtMzIuOCwwLjM0NGMtMS43LDAtMi4zLDAuNzk2LTEuOSwyLjM5Nmw3LDI3LjY2YTEwLDEwIDAgMCAwLTIuOCwxLjJsLTQuOS04LjUtOC41LTE0LjM2Yy0xLTEuNzItMi40LTIuMDctNC4xLTEuMWwtNC4zLDIuNDZjLTAuOSwwLjUtMS4zLDEuNy0wLjMsMy4zbDE5LjYsMTkuOWExMCwxMCAwIDAgMC0xLjMsMS45bC04LjUtNC45LTE0LjctOC41Yy0xLjctMS0zLjEtMC42LTQuMSwxLjFsLTIuNSw0LjNjLTAuNTAzLDAuOS0wLjEsMi4zIDEuNiwzLjNsMjYuOSw3LjRhMTAsMTAgMCAwIDAtMC4yLDIuNGgtMjdjLTEuNiwwLTIuNTAxLDAuOC0yLjUwMSwyLjV2NWMwLDEuNyAwLjgwMSwyLjMgMi40MDEsMS45bDI3LjQtNi45YTEwLDEwIDAgMCAwIDEuMiwyLjdsLTguNSw0LjktMTUuNCw5Yy0wLjksMC41LTEuMiwxLjgtMC4yLDMuNmwyLjQ2LDQuM2MwLjU0LDAuOSAxLjc0LDEuMyAyLjY0LDAuOGwyMC43LTIwLjFhMTAsMTAgMCAwIDAgMS45LDEuNGwtNC44LDguMi05LDE1LjZjLTAuNSwwLjktMC4xLDIuMiAxLjYsMy4ybDQuNCwyLjVjMC44LDAuNSAyLjIsMC4yIDIuNy0wLjdsNy45LTI3LjdhMTAsMTAgMCAwIDAgMi42LDAuMnYyNy4xYzAsMS43IDAuOCwyLjUgMi41LDIuNWg1YzEuNywwIDIuMy0wLjggMS45LTIuNGwtNi45LTI3LjZhMTAsMTAgMCAwIDAgMi40LTEuMWw0LjksOC41IDksMTUuNmMwLjYsMC45IDIsMS4yIDIuOCwwLjhsNC40LTIuNmMxLjctMC45IDIuMS0yLjQgMC42LTIuN2wtMjAtMjAuN2ExMCwxMCAwIDAgMCAyLjEtMi43bDguNCw0LjkgMTUuNiw5YzAuOSwwLjUgMi4zLDAuMSAyLjgtMC43bDIuNS00LjRjMS0xLjcgMC42LTMuMS0wLjgtMi43bC0yNy43LTcuOWExMCwxMCAwIDAgMCAwLTAuMSAxMCwxMCAwIDAgMCAwLjItMC42IDEwLDEwIDAgMCAwIDAuMy0yLjZoMjcuNWMxLjcsMCAyLjUtMC44IDIuNS0yLjV2LTVjMC0xLjctMC44LTIuMy0yLjQtMS45bC0yNy45LDdhMTAsMTAgMCAwIDAtMC4zLTAuOSAxMCwxMCAwIDAgMCAwLTAuMSAxMCwxMCAwIDAgMC0wLjItMC41IDEwLDEwIDAgMCAwLTAuMy0wLjYgMTAsMTAgMCAwIDAtMC4yLTAuNWw4LjQtNC44IDE1LjMtOS4yYzEuNS0wLjggMS43LTIgMS4yLTIuOWwtMi41LTQuM2MtMS0xLjctMi4yLTIuMi0zLTAuNmwtMjAuNSwyMC4xYTEwLDEwIDAgMCAwLTIuNy0yLjFsNC45LTguNCA4LjctMTUuNTJjMC45LTEuNDUgMC40LTIuNi0wLjUtMy4xbC00LjMtMi41Yy0xLjctMS4wMDMtMy0wLjktMi45LDFsLTcuNywyNy42MmExMCwxMCAwIDAgMC0zLjEtMC41di0yNy4yNmMwLTEuNjctMC44LTIuNDk2LTIuNS0yLjQ5NnpcIi8+XG4gIDwvZz5cbiAgVGhpcyBpcyB+NjV4NjVweCBjZW50ZXJlZCBhdCB+MzMsMzMuIFNjYWxlIGFuZCBwb3NpdGlvbiB2aWEgdHJhbnNsYXRlOiBzaGlmdCBhbGwgY29vcmRzLlxuXG5cdTI1QTAgUFJPR1JFU1MgQkFSIChzdmctZXh0LWdhdWdlX3Byb2dyZXNzKSBcdTIwMTQgQSByZWN0ICsgQiByZWN0ICsgSCBmb3JlaWduT2JqZWN0OlxuICA8ZyBpZD1cIkdYUF9hYmMtZGVmXCIgdHlwZT1cInN2Zy1leHQtZ2F1Z2VfcHJvZ3Jlc3NcIiBmb250LXNpemU9XCIxNFwiIGZvbnQtZmFtaWx5PVwic2Fucy1zZXJpZlwiIHN0cm9rZT1cIiM4MDgwODBcIj5cbiAgICA8cmVjdCBpZD1cIkEtR1hQX2lkMS1pZDJcIiB4PVwiMTg2XCIgeT1cIjE1NFwiIHdpZHRoPVwiMzFcIiBoZWlnaHQ9XCIxNDRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cIiM4MDgwODBcIiBzdHJva2Utd2lkdGg9XCIwLjVcIi8+XG4gICAgPHJlY3QgaWQ9XCJCLUdYUF9pZDMtaWQ0XCIgeD1cIjE4NlwiIHk9XCIyMjZcIiB3aWR0aD1cIjMxXCIgaGVpZ2h0PVwiNzJcIiBmaWxsPVwiIzAxOGVmNWZmXCIgc3Ryb2tlPVwiIzgwODA4MFwiIHN0cm9rZS13aWR0aD1cIjAuNVwiLz5cbiAgICA8Zm9yZWlnbk9iamVjdCB4PVwiMTg2XCIgeT1cIjE1NFwiIGhlaWdodD1cIjE0NFwiIHdpZHRoPVwiMzFcIiBpZD1cIkgtR1hQX2lkNS1pZDZcIiBmb250LXNpemU9XCIxNFwiLz5cbiAgPC9nPlxuICBBLUdYUF8gPSBmdWxsIGJhY2tncm91bmQgcmVjdCAoZmlsbDpub25lLCBzaG93cyBib3JkZXIpXG4gIEItR1hQXyA9IGZpbGxlZCBwb3J0aW9uIChGVVhBIGR5bmFtaWNhbGx5IGNoYW5nZXMgaXRzIHkgYW5kIGhlaWdodCBiYXNlZCBvbiB0YWcgdmFsdWUpXG4gIEgtR1hQXyA9IGZvcmVpZ25PYmplY3Qgb3ZlcmxheSBmb3IgRlVYQSdzIGludGVybmFsIHJlbmRlcmluZ1xuXG5cdTI1QTAgVkFMVUUgRElTUExBWSAoc3ZnLWV4dC12YWx1ZSkgXHUyMDE0IHRleHQgd2l0aCAjIy4jIyBwbGFjZWhvbGRlcjpcbiAgPGcgdHlwZT1cInN2Zy1leHQtdmFsdWVcIiBpZD1cIlZBTF9hYmMtZGVmXCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIiBmb250LWZhbWlseT1cInNhbnMtc2VyaWZcIlxuICAgICBmb250LXNpemU9XCIxNFwiIHN0cm9rZT1cIiMwMDAwMDBcIiBmaWxsPVwiIzAwMDAwMFwiIHN0cm9rZS13aWR0aD1cIjBcIj5cbiAgICA8dGV4dCB5PVwiMjI4XCIgeD1cIjI0OFwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCIgZm9udC1mYW1pbHk9XCJzYW5zLXNlcmlmXCIgZm9udC1zaXplPVwiMTRcIlxuICAgICAgICAgIHN0cm9rZT1cIiMwMDAwMDBcIiBmaWxsPVwiIzAwMDAwMFwiIGlkPVwiVkFMX2lubmVyLWlkXCIgc3Ryb2tlLXdpZHRoPVwiMFwiPiMjLiMjPC90ZXh0PlxuICA8L2c+XG4gIFRoZSAjIy4jIyBwbGFjZWhvbGRlciBpcyByZXBsYWNlZCBhdCBydW50aW1lIHdpdGggdGhlIGxpdmUgdGFnIHZhbHVlLlxuICBGVVhBIGZvcm1hdHMgaXQgYmFzZWQgb24gcmFuZ2VzW10udGV4dCAodW5pdCBzdWZmaXgpLlxuXG5cdTI1QTAgR0FVR0UgRElBTCAoc3ZnLWV4dC1odG1sX2JhZykgXHUyMDE0IHJlY3QgKyBmb3JlaWduT2JqZWN0OlxuICA8ZyBpZD1cIkJBR19hYmMtZGVmXCIgdHlwZT1cInN2Zy1leHQtaHRtbF9iYWdcIiBmaWxsPVwiI0UyNTU2M1wiIHN0cm9rZT1cIiNCOTJEM0FcIlxuICAgICBmb250LXNpemU9XCIxNFwiIGZvbnQtZmFtaWx5PVwic2Fucy1zZXJpZlwiIHRleHQtYW5jaG9yPVwicmlnaHRcIj5cbiAgICA8cmVjdCB4PVwiMjkwXCIgeT1cIjU0NFwiIHdpZHRoPVwiMTUyXCIgaGVpZ2h0PVwiMTIwXCIgc3Ryb2tlLXdpZHRoPVwiMFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwibnVsbFwiLz5cbiAgICA8Zm9yZWlnbk9iamVjdCB4PVwiMjkwXCIgeT1cIjU0NFwiIGhlaWdodD1cIjEyMFwiIHdpZHRoPVwiMTUyXCIgaWQ9XCJILUJBR19pbm5lci1pZFwiLz5cbiAgPC9nPlxuICBGVVhBJ3MgQW5ndWxhciBjb21wb25lbnQgcmVuZGVycyB0aGUgY2FudmFzLWJhc2VkIGdhdWdlIGluc2lkZSB0aGUgZm9yZWlnbk9iamVjdC5cblxuXHUyNUEwIENIQVJUIChzdmctZXh0LWh0bWxfY2hhcnQpIFx1MjAxNCByZWN0ICsgZm9yZWlnbk9iamVjdDpcbiAgPGcgaWQ9XCJIWENfYWJjLWRlZlwiIHR5cGU9XCJzdmctZXh0LWh0bWxfY2hhcnRcIiBmaWxsPVwiIzBCNUNENVwiIHN0cm9rZT1cIiMwNzM5ODRcIlxuICAgICBmb250LXNpemU9XCIzMlwiIGZvbnQtZmFtaWx5PVwiUm9ib3RvLUxpZ2h0XCIgdGV4dC1hbmNob3I9XCJyaWdodFwiPlxuICAgIDxyZWN0IHg9XCI1MDRcIiB5PVwiNDUyXCIgd2lkdGg9XCI0NjRcIiBoZWlnaHQ9XCIyNDBcIiBzdHJva2Utd2lkdGg9XCIwXCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJudWxsXCIvPlxuICAgIDxmb3JlaWduT2JqZWN0IHg9XCI1MDRcIiB5PVwiNDUyXCIgaGVpZ2h0PVwiMjQwXCIgd2lkdGg9XCI0NjRcIiBpZD1cIkgtSFhDX2lubmVyLWlkXCIvPlxuICA8L2c+XG5cblx1MjVBMCBTTElERVIgKHN2Zy1leHQtaHRtbF9zbGlkZXIpIFx1MjAxNCByZWN0ICsgZm9yZWlnbk9iamVjdDpcbiAgPGcgaWQ9XCJTTElfYWJjLWRlZlwiIHR5cGU9XCJzdmctZXh0LWh0bWxfc2xpZGVyXCIgZmlsbD1cIiNCM0IzQjNcIiBzdHJva2U9XCIjQjNCM0IzXCJcbiAgICAgZm9udC1zaXplPVwiMzJcIiBmb250LWZhbWlseT1cIlJvYm90by1MaWdodFwiIHRleHQtYW5jaG9yPVwicmlnaHRcIj5cbiAgICA8cmVjdCB4PVwiODJcIiB5PVwiNDMyXCIgd2lkdGg9XCIxODRcIiBoZWlnaHQ9XCIyNjBcIiBzdHJva2Utd2lkdGg9XCIwXCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJudWxsXCIvPlxuICAgIDxmb3JlaWduT2JqZWN0IHg9XCI4MlwiIHk9XCI0MzJcIiBoZWlnaHQ9XCIyNjBcIiB3aWR0aD1cIjE4NFwiIGlkPVwiSC1TTElfaW5uZXItaWRcIi8+XG4gIDwvZz5cblxuXHUyNUEwIFRPR0dMRSBTV0lUQ0ggKHN2Zy1leHQtaHRtbF9zd2l0Y2gpIFx1MjAxNCByZWN0ICsgZm9yZWlnbk9iamVjdDpcbiAgPGcgaWQ9XCJIWFRfYWJjLWRlZlwiIHR5cGU9XCJzdmctZXh0LWh0bWxfc3dpdGNoXCIgZmlsbD1cInJnYmEoMCwwLDAsMClcIiBzdHJva2U9XCJyZ2JhKDAsMCwwLDApXCI+XG4gICAgPHJlY3QgeD1cIjMyOFwiIHk9XCI0NzhcIiB3aWR0aD1cIjY2XCIgaGVpZ2h0PVwiMjhcIiBzdHJva2Utd2lkdGg9XCIwXCIgc3Ryb2tlPVwibnVsbFwiLz5cbiAgICA8Zm9yZWlnbk9iamVjdCB4PVwiMzI4XCIgeT1cIjQ3OFwiIGhlaWdodD1cIjI4XCIgd2lkdGg9XCI2NlwiIGlkPVwiSC1IWFRfaW5uZXItaWRcIi8+XG4gIDwvZz5cblxuXHUyNUEwIEJVVFRPTiAoc3ZnLWV4dC1odG1sX2J1dHRvbikgXHUyMDE0IHJlY3QgKyBmb3JlaWduT2JqZWN0OlxuICA8ZyBpZD1cIkhYQl9hYmMtZGVmXCIgdHlwZT1cInN2Zy1leHQtaHRtbF9idXR0b25cIiBmaWxsPVwiIzAxOGVmNVwiIHN0cm9rZT1cIiMwNzM5ODRcIj5cbiAgICA8cmVjdCB4PVwiMTAwXCIgeT1cIjUwMFwiIHdpZHRoPVwiMTIwXCIgaGVpZ2h0PVwiNDBcIiBzdHJva2Utd2lkdGg9XCIwXCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJudWxsXCIvPlxuICAgIDxmb3JlaWduT2JqZWN0IHg9XCIxMDBcIiB5PVwiNTAwXCIgaGVpZ2h0PVwiNDBcIiB3aWR0aD1cIjEyMFwiIGlkPVwiSC1IWEJfaW5uZXItaWRcIi8+XG4gIDwvZz5cblxuXHUyNUEwIFNFTUFQSE9SRSBMRUQgKHN2Zy1leHQtZ2F1Z2Vfc2VtYXBob3JlKSBcdTIwMTQgY2lyY2xlIG9yIHJlY3Q6XG4gIDxnIGlkPVwiR1NFX2FiYy1kZWZcIiB0eXBlPVwic3ZnLWV4dC1nYXVnZV9zZW1hcGhvcmVcIiBzdHJva2U9XCIjMDAwMDAwXCI+XG4gICAgPGNpcmNsZSBpZD1cIkdTRV9pbm5lci1pZFwiIGN4PVwiNDAwXCIgY3k9XCIxMDBcIiByPVwiMTVcIiBmaWxsPVwiIzgwODA4MFwiLz5cbiAgPC9nPlxuXG5cdTI1QTAgR0VPTUVUUklDIFNIQVBFUyAoc3ZnLWV4dC1zaGFwZXMtKikgXHUyMDE0IHNpbXBsZSBwYXRoczpcbiAgPGcgaWQ9XCJTSEVfcmVjdC1hYmNcIiB0eXBlPVwic3ZnLWV4dC1zaGFwZXMtcmVjdGFuZ2xlXCIgZmlsbD1cIiMwMThlZjVcIiBzdHJva2U9XCIjMDczOTg0XCI+XG4gICAgPHJlY3QgeD1cIjQ3MFwiIHk9XCIyNzBcIiB3aWR0aD1cIjExMFwiIGhlaWdodD1cIjI2XCIgcng9XCIxN1wiIHJ5PVwiMTdcIi8+XG4gIDwvZz5cblxuXHUyNUEwIFNUQVRJQyBURVhUIExBQkVMUyBcdTIwMTQgbm8gaXRlbSBuZWVkZWQsIGp1c3QgU1ZHIDx0ZXh0PjpcbiAgPHRleHQgeD1cIjMwMFwiIHk9XCIyNDBcIiBmb250LXNpemU9XCIxM1wiIGZpbGw9XCIjY2NjY2NjXCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIiBmb250LWZhbWlseT1cInNhbnMtc2VyaWZcIj5Nb3RvciBTcGVlZDwvdGV4dD5cbiAgPHRleHQgeD1cIjMwMFwiIHk9XCIxMDBcIiBmb250LXNpemU9XCIyNFwiIGZpbGw9XCIjZmZmZmZmXCIgZm9udC1mYW1pbHk9XCJSb2JvdG8tTGlnaHRcIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiPlBVTVAgU1RBVElPTjwvdGV4dD5cblxuXHUyNUEwIFNUQVRJQyBMSU5FUyBcdTIwMTQgZm9yIGNvbm5lY3RpbmcgcGlwZXMgdG8gc2hhcGVzIHZpc3VhbGx5OlxuICA8bGluZSB4MT1cIjI4MlwiIHkxPVwiMjg0XCIgeDI9XCIzNTBcIiB5Mj1cIjI4NFwiIHN0cm9rZT1cIiM1QTlDRkVcIiBzdHJva2Utd2lkdGg9XCI4XCIgZmlsbD1cIm5vbmVcIi8+XG5cblx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVxuV0lER0VUIENBVEFMT0dVRSBcdTIwMTQgSVRFTVMgQ09ORklHVVJBVElPTlxuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5cbjEuIFBST0NFU1MgRU5HSU5FRVJJTkcgU0hBUEVTIFx1MjAxNCBzdmctZXh0LXByb2NlbmctKlxuICAgUHJvZmVzc2lvbmFsIFAmSUQgc3ltYm9scy4gQmluZCByYW5nZXNbXSBmb3IgY29sb3Igc3RhdGVzLlxuICAgVHlwZXM6IHN2Zy1leHQtcHJvY2VuZy12YWx2ZWN4LCBzdmctZXh0LXByb2NlbmctdmFsdmVheCwgc3ZnLWV4dC1wcm9jZW5nLW1vdG9yLFxuICAgICAgICAgIHN2Zy1leHQtcHJvY2VuZy1wdW1wY2VudHJpMSwgc3ZnLWV4dC1wcm9jZW5nLXB1bXBjZW50cmkyLCBzdmctZXh0LXByb2NlbmctcHVtcHNjcmVldzIsXG4gICAgICAgICAgc3ZnLWV4dC1wcm9jZW5nLWNvbXBmYW4sIHN2Zy1leHQtcHJvY2VuZy10YW5rNCwgc3ZnLWV4dC1wcm9jZW5nLWV4Y2h0dWJlLFxuICAgICAgICAgIHN2Zy1leHQtcHJvY2VuZy1jZW50cmlmdWdhbCwgc3ZnLWV4dC1wcm9jZW5nLXRhbmsxLi50YW5rOVxuXG4gICBFeGFtcGxlIFx1MjAxNCB2YWx2ZSBncmVlbiB3aGVuIG9wZW4sIGdyZXkgd2hlbiBjbG9zZWQ6XG4gICB7XG4gICAgIFwiaWRcIjogXCJTSEVfdjEtYWJjMTIzXCIsIFwidHlwZVwiOiBcInN2Zy1leHQtcHJvY2VuZy12YWx2ZWN4XCIsXG4gICAgIFwibmFtZVwiOiBcImlubGV0X3ZhbHZlXCIsIFwibGFiZWxcIjogXCJQcm9jLUVuZ1wiLFxuICAgICBcInByb3BlcnR5XCI6IHtcbiAgICAgICBcInZhcmlhYmxlSWRcIjogXCJGdXhhU2VydmVyXn5eVmFsdmVfT3BlblwiLCBcInZhcmlhYmxlU3JjXCI6IFwiRnV4YVNlcnZlclwiLCBcInZhcmlhYmxlXCI6IFwiVmFsdmVfT3BlblwiLFxuICAgICAgIFwicmFuZ2VzXCI6IFtcbiAgICAgICAgIHsgXCJ0eXBlXCI6IFwicmFuZ2VcIiwgXCJtaW5cIjogXCIxXCIsIFwibWF4XCI6IFwiMVwiLCBcImNvbG9yXCI6IFwiIzAwYjA1MGZmXCIsIFwic3Ryb2tlXCI6IFwiXCIgfSxcbiAgICAgICAgIHsgXCJ0eXBlXCI6IFwicmFuZ2VcIiwgXCJtaW5cIjogXCIwXCIsIFwibWF4XCI6IFwiMFwiLCBcImNvbG9yXCI6IFwiI2Q4ZDhkOGZmXCIsIFwic3Ryb2tlXCI6IFwiXCIgfVxuICAgICAgIF0sXG4gICAgICAgXCJldmVudHNcIjogW10sIFwiYWN0aW9uc1wiOiBbXSxcbiAgICAgICBcImFsYXJtSWRcIjogXCJcIiwgXCJhbGFybVNyY1wiOiBcIlwiLCBcImFsYXJtXCI6IFwiXCIsIFwiYWxhcm1Db2xvclwiOiBcIlwiXG4gICAgIH1cbiAgIH1cblxuMi4gQU5JTUFURUQgU0hBUEVTIFx1MjAxNCBzdmctZXh0LWFwZS0qXG4gICBSb3RhdGlvbiBhbmltYXRpb25zIGJ1aWx0LWluLiBUeXBlczogc3ZnLWV4dC1hcGUtZWxpIChmYW4gYmxhZGVzKSwgc3ZnLWV4dC1hcGUtcGlzdG9uXG4gICBBTFdBWVMgcGFpciBjbG9ja3dpc2UgKyBzdG9wIGFjdGlvbnM6XG4gICB7XG4gICAgIFwiaWRcIjogXCJTSEVfZmFuLWFiY1wiLCBcInR5cGVcIjogXCJzdmctZXh0LWFwZS1lbGlcIixcbiAgICAgXCJuYW1lXCI6IFwiY29vbGluZ19mYW5cIiwgXCJsYWJlbFwiOiBcIkFuaW1Qcm9jRW5nXCIsXG4gICAgIFwicHJvcGVydHlcIjoge1xuICAgICAgIFwiZXZlbnRzXCI6IFtdLFxuICAgICAgIFwiYWN0aW9uc1wiOiBbXG4gICAgICAgICB7IFwidmFyaWFibGVJZFwiOiBcIkZ1eGFTZXJ2ZXJefl5GYW5fUnVuXCIsIFwidmFyaWFibGVTcmNcIjogXCJGdXhhU2VydmVyXCIsIFwidmFyaWFibGVcIjogXCJGYW5fUnVuXCIsXG4gICAgICAgICAgIFwicmFuZ2VcIjoge1wibWluXCI6IFwiMVwiLCBcIm1heFwiOiBcIjFcIn0sIFwidHlwZVwiOiBcImNsb2Nrd2lzZVwiLCBcIm9wdGlvbnNcIjoge30gfSxcbiAgICAgICAgIHsgXCJ2YXJpYWJsZUlkXCI6IFwiRnV4YVNlcnZlcl5+XkZhbl9SdW5cIiwgXCJ2YXJpYWJsZVNyY1wiOiBcIkZ1eGFTZXJ2ZXJcIiwgXCJ2YXJpYWJsZVwiOiBcIkZhbl9SdW5cIixcbiAgICAgICAgICAgXCJyYW5nZVwiOiB7XCJtaW5cIjogXCIwXCIsIFwibWF4XCI6IFwiMFwifSwgXCJ0eXBlXCI6IFwic3RvcFwiLCBcIm9wdGlvbnNcIjoge30gfVxuICAgICAgIF0sXG4gICAgICAgXCJyYW5nZXNcIjogW1xuICAgICAgICAgeyBcInR5cGVcIjogXCJyYW5nZVwiLCBcIm1pblwiOiAyMCwgXCJtYXhcIjogODAsIFwiY29sb3JcIjogXCJcIiwgXCJzdHJva2VcIjogXCJcIiB9XG4gICAgICAgXSxcbiAgICAgICBcImFsYXJtSWRcIjogXCJcIiwgXCJhbGFybVNyY1wiOiBcIlwiLCBcImFsYXJtXCI6IFwiXCIsIFwiYWxhcm1Db2xvclwiOiBcIlwiXG4gICAgIH1cbiAgIH1cblxuMy4gQU5JTUFURUQgUElQRSBcdTIwMTQgc3ZnLWV4dC1waXBlXG4gICB7XG4gICAgIFwiaWRcIjogXCJQSUVfcDEtYWJjXCIsIFwidHlwZVwiOiBcInN2Zy1leHQtcGlwZVwiLFxuICAgICBcIm5hbWVcIjogXCJtYWluX2Zsb3dcIiwgXCJsYWJlbFwiOiBcIlBpcGVcIixcbiAgICAgXCJwcm9wZXJ0eVwiOiB7XG4gICAgICAgXCJldmVudHNcIjogW10sXG4gICAgICAgXCJhY3Rpb25zXCI6IFtcbiAgICAgICAgIHsgXCJ2YXJpYWJsZUlkXCI6IFwiRnV4YVNlcnZlcl5+XlB1bXBfUnVuXCIsIFwidmFyaWFibGVTcmNcIjogXCJGdXhhU2VydmVyXCIsIFwidmFyaWFibGVcIjogXCJQdW1wX1J1blwiLFxuICAgICAgICAgICBcInJhbmdlXCI6IHtcIm1pblwiOiBcIjFcIiwgXCJtYXhcIjogXCIxXCJ9LCBcInR5cGVcIjogXCJjbG9ja3dpc2VcIiwgXCJvcHRpb25zXCI6IHt9IH0sXG4gICAgICAgICB7IFwidmFyaWFibGVJZFwiOiBcIkZ1eGFTZXJ2ZXJefl5QdW1wX1J1blwiLCBcInZhcmlhYmxlU3JjXCI6IFwiRnV4YVNlcnZlclwiLCBcInZhcmlhYmxlXCI6IFwiUHVtcF9SdW5cIixcbiAgICAgICAgICAgXCJyYW5nZVwiOiB7XCJtaW5cIjogXCIwXCIsIFwibWF4XCI6IFwiMFwifSwgXCJ0eXBlXCI6IFwic3RvcFwiLCBcIm9wdGlvbnNcIjoge30gfVxuICAgICAgIF0sXG4gICAgICAgXCJvcHRpb25zXCI6IHtcbiAgICAgICAgIFwiYm9yZGVyV2lkdGhcIjogMCwgXCJib3JkZXJcIjogXCIjMDAwMDAwXCIsXG4gICAgICAgICBcInBpcGVXaWR0aFwiOiAxMSwgXCJwaXBlXCI6IFwiIzgwODA4MGZmXCIsXG4gICAgICAgICBcImNvbnRlbnRXaWR0aFwiOiA4LCBcImNvbnRlbnRcIjogXCIjMDE4ZWY1ZmZcIixcbiAgICAgICAgIFwiY29udGVudFNwYWNlXCI6IDE3XG4gICAgICAgfSxcbiAgICAgICBcImFsYXJtSWRcIjogXCJcIiwgXCJhbGFybVNyY1wiOiBcIlwiLCBcImFsYXJtXCI6IFwiXCIsIFwiYWxhcm1Db2xvclwiOiBcIlwiXG4gICAgIH1cbiAgIH1cblxuNC4gUFJPR1JFU1MgQkFSIFx1MjAxNCBzdmctZXh0LWdhdWdlX3Byb2dyZXNzXG4gICB7XG4gICAgIFwiaWRcIjogXCJHWFBfYWJjLWRlZlwiLCBcInR5cGVcIjogXCJzdmctZXh0LWdhdWdlX3Byb2dyZXNzXCIsXG4gICAgIFwibmFtZVwiOiBcInRhbmtfbGV2ZWxcIiwgXCJsYWJlbFwiOiBcIkh0bWxQcm9ncmVzc1wiLFxuICAgICBcInByb3BlcnR5XCI6IHtcbiAgICAgICBcInZhcmlhYmxlSWRcIjogXCJGdXhhU2VydmVyXn5eVGFua19MZXZlbFwiLCBcInZhcmlhYmxlU3JjXCI6IFwiRnV4YVNlcnZlclwiLCBcInZhcmlhYmxlXCI6IFwiVGFua19MZXZlbFwiLFxuICAgICAgIFwicmFuZ2VzXCI6IFtcbiAgICAgICAgIHsgXCJ0eXBlXCI6IFwibWlubWF4XCIsIFwibWluXCI6IDAsIFwibWF4XCI6IDEwMCwgXCJzdHlsZVwiOiBbdHJ1ZSwgdHJ1ZV0sIFwiY29sb3JcIjogXCIjMDE4ZWY1ZmZcIiwgXCJzdHJva2VcIjogXCJcIiB9XG4gICAgICAgXSxcbiAgICAgICBcImV2ZW50c1wiOiBbXSwgXCJhY3Rpb25zXCI6IFtdLFxuICAgICAgIFwiYWxhcm1JZFwiOiBcIlwiLCBcImFsYXJtU3JjXCI6IFwiXCIsIFwiYWxhcm1cIjogXCJcIiwgXCJhbGFybUNvbG9yXCI6IFwiXCJcbiAgICAgfVxuICAgfVxuXG41LiBWQUxVRSBESVNQTEFZIFx1MjAxNCBzdmctZXh0LXZhbHVlXG4gICB7XG4gICAgIFwiaWRcIjogXCJWQUxfYWJjLWRlZlwiLCBcInR5cGVcIjogXCJzdmctZXh0LXZhbHVlXCIsXG4gICAgIFwibmFtZVwiOiBcInNwZWVkX2Rpc3BsYXlcIiwgXCJsYWJlbFwiOiBcIlZhbHVlXCIsXG4gICAgIFwicHJvcGVydHlcIjoge1xuICAgICAgIFwidmFyaWFibGVJZFwiOiBcIkZ1eGFTZXJ2ZXJefl5Nb3Rvcl9TcGVlZFwiLCBcInZhcmlhYmxlU3JjXCI6IFwiRnV4YVNlcnZlclwiLCBcInZhcmlhYmxlXCI6IFwiTW90b3JfU3BlZWRcIixcbiAgICAgICBcInJhbmdlc1wiOiBbXG4gICAgICAgICB7IFwidHlwZVwiOiBcInVuaXRcIiwgXCJtaW5cIjogMCwgXCJtYXhcIjogOTk5OSwgXCJjb2xvclwiOiBcIlwiLCBcInN0cm9rZVwiOiBcIlwiLCBcInRleHRcIjogXCIgcnBtXCIgfVxuICAgICAgIF0sXG4gICAgICAgXCJldmVudHNcIjogW10sIFwiYWN0aW9uc1wiOiBbXSxcbiAgICAgICBcImFsYXJtSWRcIjogXCJcIiwgXCJhbGFybVNyY1wiOiBcIlwiLCBcImFsYXJtXCI6IFwiXCIsIFwiYWxhcm1Db2xvclwiOiBcIlwiXG4gICAgIH1cbiAgIH1cblxuNi4gR0FVR0UgRElBTCBcdTIwMTQgc3ZnLWV4dC1odG1sX2JhZyAodHlwZT0wIHN0YW5kYXJkIHJhZGlhbClcbiAgIHtcbiAgICAgXCJpZFwiOiBcIkJBR19hYmMtZGVmXCIsIFwidHlwZVwiOiBcInN2Zy1leHQtaHRtbF9iYWdcIixcbiAgICAgXCJuYW1lXCI6IFwicHJlc3N1cmVfZ2F1Z2VcIiwgXCJsYWJlbFwiOiBcIkh0bWxCYWdcIixcbiAgICAgXCJwcm9wZXJ0eVwiOiB7XG4gICAgICAgXCJ2YXJpYWJsZUlkXCI6IFwiRnV4YVNlcnZlcl5+XlByZXNzdXJlXCIsIFwidmFyaWFibGVTcmNcIjogXCJGdXhhU2VydmVyXCIsIFwidmFyaWFibGVcIjogXCJQcmVzc3VyZVwiLFxuICAgICAgIFwiZXZlbnRzXCI6IFtdLCBcImFjdGlvbnNcIjogW10sXG4gICAgICAgXCJhbGFybUlkXCI6IFwiXCIsIFwiYWxhcm1TcmNcIjogXCJcIiwgXCJhbGFybVwiOiBcIlwiLCBcImFsYXJtQ29sb3JcIjogXCJcIixcbiAgICAgICBcIm9wdGlvbnNcIjoge1xuICAgICAgICAgXCJ0eXBlXCI6IDAsXG4gICAgICAgICBcIm1pblZhbHVlXCI6IDAsIFwibWF4VmFsdWVcIjogMTAwLCBcImFuaW1hdGlvblNwZWVkXCI6IDQwLFxuICAgICAgICAgXCJjb2xvclN0YXJ0XCI6IFwiIzAxOGVmNWZmXCIsIFwiY29sb3JTdG9wXCI6IFwiIzAxOGVmNWZmXCIsXG4gICAgICAgICBcImdyYWRpZW50VHlwZVwiOiBcIlwiLCBcInN0cm9rZUNvbG9yXCI6IFwiI2UwZTBlMFwiLFxuICAgICAgICAgXCJwb2ludGVyXCI6IHsgXCJsZW5ndGhcIjogMC41LCBcInN0cm9rZVdpZHRoXCI6IDAuMDM1LCBcImljb25TY2FsZVwiOiAxLCBcImNvbG9yXCI6IFwiI2ZmZmZmZlwiIH0sXG4gICAgICAgICBcImFuZ2xlXCI6IDAuMywgXCJsaW5lV2lkdGhcIjogMC4xLCBcInJhZGl1c1NjYWxlXCI6IDAuOCxcbiAgICAgICAgIFwiZm9udFNpemVcIjogMjQsIFwidGV4dEZpbGVQb3NpdGlvblwiOiAzOCwgXCJmcmFjdGlvbkRpZ2l0c1wiOiAxLFxuICAgICAgICAgXCJsaW1pdE1heFwiOiBmYWxzZSwgXCJsaW1pdE1pblwiOiBmYWxzZSxcbiAgICAgICAgIFwiaGlnaERwaVN1cHBvcnRcIjogdHJ1ZSxcbiAgICAgICAgIFwic2hhZG93Q29sb3JcIjogXCIjZDVkNWQ1XCIsXG4gICAgICAgICBcImJhY2tncm91bmRDb2xvclwiOiBcInJnYmEoMCwwLDAsMClcIixcbiAgICAgICAgIFwiZm9udEZhbWlseVwiOiBcIlJvYm90by1UaGluXCIsXG4gICAgICAgICBcInN0YXRpY0xhYmVsc1RleHRcIjogXCIwOzI1OzUwOzc1OzEwMFwiLCBcInN0YXRpY0ZvbnRTaXplXCI6IDEwLCBcInN0YXRpY0ZvbnRDb2xvclwiOiBcIiNjY2NjY2NcIixcbiAgICAgICAgIFwic3RhdGljTGFiZWxzXCI6IHsgXCJmb250XCI6IFwiMTBweCBzYW5zLXNlcmlmXCIsIFwibGFiZWxzXCI6IFswLDI1LDUwLDc1LDEwMF0sIFwiZnJhY3Rpb25EaWdpdHNcIjogMCwgXCJjb2xvclwiOiBcIiNjY2NjY2NcIiB9LFxuICAgICAgICAgXCJ0aWNrc0VuYWJsZWRcIjogdHJ1ZSxcbiAgICAgICAgIFwicmVuZGVyVGlja3NcIjogeyBcImRpdmlzaW9uc1wiOiA1LCBcImRpdldpZHRoXCI6IDEuMSwgXCJkaXZMZW5ndGhcIjogMC43LCBcImRpdkNvbG9yXCI6IFwiIzMzMzMzM1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBcInN1YkRpdmlzaW9uc1wiOiAzLCBcInN1Ykxlbmd0aFwiOiAwLjUsIFwic3ViV2lkdGhcIjogMC42LCBcInN1YkNvbG9yXCI6IFwiIzY2NjY2NlwiIH1cbiAgICAgICB9XG4gICAgIH1cbiAgIH1cblxuICAgR0FVR0UgRElBTCB0eXBlPTIgXHUyMDE0IFpPTkVTIChjb2xvci1iYW5kZWQgc2FmZS93YXJuaW5nL2RhbmdlciBiYW5kcyk6XG4gICBBZGQgXCJzdGF0aWNab25lc1wiIHRvIG9wdGlvbnMgXHUyMDE0IGVhY2ggem9uZSBpcyBhIGNvbG9yZWQgYXJjIGJhbmQ6XG4gICBcInR5cGVcIjogMixcbiAgIFwic3RhdGljWm9uZXNcIjogW1xuICAgICB7IFwic3Ryb2tlU3R5bGVcIjogXCIjRjAzRTNFXCIsIFwibWluXCI6IDAsIFwibWF4XCI6IDIwIH0sXG4gICAgIHsgXCJzdHJva2VTdHlsZVwiOiBcIiNGRkREMDBcIiwgXCJtaW5cIjogMjAsIFwibWF4XCI6IDgwIH0sXG4gICAgIHsgXCJzdHJva2VTdHlsZVwiOiBcIiMzMEIzMkRcIiwgXCJtaW5cIjogODAsIFwibWF4XCI6IDEwMCB9XG4gICBdXG4gICBVc2Ugem9uZXMgZm9yOiBwcmVzc3VyZSBnYXVnZSB3aXRoIGxvdy9ub3JtYWwvaGlnaCBiYW5kcywgdGVtcGVyYXR1cmUgd2l0aCBzYWZlL2NhdXRpb24vZGFuZ2VyLFxuICAgICAgICAgICAgICAgICAgdGFuayBsZXZlbCB3aXRoIGVtcHR5L25vcm1hbC9vdmVyZmxvdyB6b25lcy5cblxuNy4gU0VNQVBIT1JFIExFRCBcdTIwMTQgc3ZnLWV4dC1nYXVnZV9zZW1hcGhvcmVcbiAgIFwicmFuZ2VzXCI6IFtcbiAgICAgeyBcInR5cGVcIjogXCJyYW5nZVwiLCBcIm1pblwiOiBcIjBcIiwgXCJtYXhcIjogXCIwXCIsIFwiY29sb3JcIjogXCIjZmYwMDAwZmZcIiwgXCJzdHJva2VcIjogXCJcIiB9LFxuICAgICB7IFwidHlwZVwiOiBcInJhbmdlXCIsIFwibWluXCI6IFwiMVwiLCBcIm1heFwiOiBcIjFcIiwgXCJjb2xvclwiOiBcIiMwMGIwNTBmZlwiLCBcInN0cm9rZVwiOiBcIlwiIH1cbiAgIF1cblxuOC4gSFRNTCBCVVRUT04gXHUyMDE0IHN2Zy1leHQtaHRtbF9idXR0b25cbiAgIHtcbiAgICAgXCJpZFwiOiBcIkhYQl9hYmMtZGVmXCIsIFwidHlwZVwiOiBcInN2Zy1leHQtaHRtbF9idXR0b25cIixcbiAgICAgXCJuYW1lXCI6IFwic3RhcnRfYnRuXCIsIFwibGFiZWxcIjogXCJIdG1sQnV0dG9uXCIsXG4gICAgIFwicHJvcGVydHlcIjoge1xuICAgICAgIFwidmFyaWFibGVJZFwiOiBcIkZ1eGFTZXJ2ZXJefl5Nb3Rvcl9TdGFydFwiLCBcInZhcmlhYmxlU3JjXCI6IFwiRnV4YVNlcnZlclwiLCBcInZhcmlhYmxlXCI6IFwiTW90b3JfU3RhcnRcIixcbiAgICAgICBcInRleHRcIjogXCJTVEFSVFwiLFxuICAgICAgIFwiZXZlbnRzXCI6IFtcbiAgICAgICAgIHsgXCJ0eXBlXCI6IFwiY2xpY2tcIiwgXCJhY3Rpb25cIjogXCJvblNldFZhbHVlXCIsIFwiYWN0cGFyYW1cIjogXCIxXCIsIFwiYWN0b3B0aW9uc1wiOiB7fSB9XG4gICAgICAgXSxcbiAgICAgICBcImFjdGlvbnNcIjogW1xuICAgICAgICAgeyBcInZhcmlhYmxlSWRcIjogXCJGdXhhU2VydmVyXn5eTW90b3JfUnVubmluZ1wiLCBcInZhcmlhYmxlU3JjXCI6IFwiRnV4YVNlcnZlclwiLCBcInZhcmlhYmxlXCI6IFwiTW90b3JfUnVubmluZ1wiLFxuICAgICAgICAgICBcInJhbmdlXCI6IHtcIm1pblwiOiBcIjFcIiwgXCJtYXhcIjogXCIxXCJ9LCBcInR5cGVcIjogXCJibGlua1wiLFxuICAgICAgICAgICBcIm9wdGlvbnNcIjogeyBcImZpbGxBXCI6IFwiIzAwYjA1MGZmXCIsIFwiZmlsbEJcIjogXCIjMDA1YzI1ZmZcIiwgXCJzdHJva2VBXCI6IG51bGwsIFwic3Ryb2tlQlwiOiBudWxsLCBcImludGVydmFsXCI6IDgwMCB9IH1cbiAgICAgICBdLFxuICAgICAgIFwicmFuZ2VzXCI6IFtdLCBcImFsYXJtSWRcIjogXCJcIiwgXCJhbGFybVNyY1wiOiBcIlwiLCBcImFsYXJtXCI6IFwiXCIsIFwiYWxhcm1Db2xvclwiOiBcIlwiXG4gICAgIH1cbiAgIH1cblxuOS4gVE9HR0xFIFNXSVRDSCBcdTIwMTQgc3ZnLWV4dC1odG1sX3N3aXRjaFxuICAge1xuICAgICBcImlkXCI6IFwiSFhUX2FiYy1kZWZcIiwgXCJ0eXBlXCI6IFwic3ZnLWV4dC1odG1sX3N3aXRjaFwiLFxuICAgICBcIm5hbWVcIjogXCJwdW1wX3N3aXRjaFwiLCBcImxhYmVsXCI6IFwiSHRtbFN3aXRjaFwiLFxuICAgICBcInByb3BlcnR5XCI6IHtcbiAgICAgICBcInZhcmlhYmxlSWRcIjogXCJGdXhhU2VydmVyXn5eUHVtcF9FbmFibGVcIiwgXCJ2YXJpYWJsZVNyY1wiOiBcIkZ1eGFTZXJ2ZXJcIiwgXCJ2YXJpYWJsZVwiOiBcIlB1bXBfRW5hYmxlXCIsXG4gICAgICAgXCJldmVudHNcIjogW10sIFwiYWN0aW9uc1wiOiBbXSxcbiAgICAgICBcIm9wdGlvbnNcIjoge1xuICAgICAgICAgXCJvZmZWYWx1ZVwiOiAwLCBcIm9uVmFsdWVcIjogMSxcbiAgICAgICAgIFwib2ZmQmFja2dyb3VuZFwiOiBcIiNjY2NcIiwgXCJvbkJhY2tncm91bmRcIjogXCIjY2NjXCIsXG4gICAgICAgICBcIm9mZlRleHRcIjogXCJcIiwgXCJvblRleHRcIjogXCJcIixcbiAgICAgICAgIFwib2ZmU2xpZGVyQ29sb3JcIjogXCIjZmZmXCIsIFwib25TbGlkZXJDb2xvclwiOiBcIiMwQ0M4NjhcIixcbiAgICAgICAgIFwib2ZmVGV4dENvbG9yXCI6IFwiIzAwMFwiLCBcIm9uVGV4dENvbG9yXCI6IFwiI2ZmZlwiLFxuICAgICAgICAgXCJmb250U2l6ZVwiOiAxMiwgXCJmb250RmFtaWx5XCI6IFwiXCIsIFwicmFkaXVzXCI6IDExLCBcImhlaWdodFwiOiAyMlxuICAgICAgIH1cbiAgICAgfVxuICAgfVxuXG4xMC4gU0xJREVSIFx1MjAxNCBzdmctZXh0LWh0bWxfc2xpZGVyXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlNMSV9hYmMtZGVmXCIsIFwidHlwZVwiOiBcInN2Zy1leHQtaHRtbF9zbGlkZXJcIixcbiAgICAgIFwibmFtZVwiOiBcInNwZWVkX3NldHBvaW50XCIsIFwibGFiZWxcIjogXCJIdG1sU2xpZGVyXCIsXG4gICAgICBcInByb3BlcnR5XCI6IHtcbiAgICAgICAgXCJ2YXJpYWJsZUlkXCI6IFwiRnV4YVNlcnZlcl5+XlNwZWVkX1NQXCIsIFwidmFyaWFibGVTcmNcIjogXCJGdXhhU2VydmVyXCIsIFwidmFyaWFibGVcIjogXCJTcGVlZF9TUFwiLFxuICAgICAgICBcImV2ZW50c1wiOiBbXSwgXCJhY3Rpb25zXCI6IFtdLFxuICAgICAgICBcIm9wdGlvbnNcIjoge1xuICAgICAgICAgIFwib3JpZW50YXRpb25cIjogXCJ2ZXJ0aWNhbFwiLCBcImRpcmVjdGlvblwiOiBcInJ0bFwiLFxuICAgICAgICAgIFwiZm9udEZhbWlseVwiOiBcIlJvYm90by1MaWdodFwiLFxuICAgICAgICAgIFwic2hhcGVcIjogeyBcImJhc2VDb2xvclwiOiBcIiNkY2RjZGNcIiwgXCJjb25uZWN0Q29sb3JcIjogXCIjNDliMmZmXCIsIFwiaGFuZGxlQ29sb3JcIjogXCIjMDE4ZWY1XCIgfSxcbiAgICAgICAgICBcIm1hcmtlclwiOiB7IFwiY29sb3JcIjogXCIjMDAwXCIsIFwic3ViV2lkdGhcIjogNSwgXCJzdWJIZWlnaHRcIjogMSwgXCJmb250U2l6ZVwiOiAxOCwgXCJkaXZIZWlnaHRcIjogMiwgXCJkaXZXaWR0aFwiOiAxMiB9LFxuICAgICAgICAgIFwicmFuZ2VcIjogeyBcIm1pblwiOiAwLCBcIm1heFwiOiAxMDAgfSwgXCJzdGVwXCI6IDEsXG4gICAgICAgICAgXCJwaXBzXCI6IHsgXCJtb2RlXCI6IFwidmFsdWVzXCIsIFwidmFsdWVzXCI6IFswLCA1MCwgMTAwXSwgXCJkZW5zaXR5XCI6IDQgfSxcbiAgICAgICAgICBcInRvb2x0aXBcIjogeyBcInR5cGVcIjogXCJub25lXCIsIFwiZGVjaW1hbHNcIjogMCwgXCJiYWNrZ3JvdW5kXCI6IFwiI0ZGRlwiLCBcImNvbG9yXCI6IFwiIzAwMFwiLCBcImZvbnRTaXplXCI6IDEyIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuMTEuIFJFQUxUSU1FIENIQVJUIFx1MjAxNCBzdmctZXh0LWh0bWxfY2hhcnRcbiAgICBJdGVtIHByb3BlcnR5OlxuICAgIHsgXCJpZFwiOiBcImNoYXJ0LXV1aWRcIiwgXCJ0eXBlXCI6IFwicmVhbHRpbWUxXCIsXG4gICAgICBcIm9wdGlvbnNcIjogeyBcInRpdGxlXCI6IFwiTW90b3IgU3BlZWRcIiwgXCJmb250RmFtaWx5XCI6IFwiUm9ib3RvLVJlZ3VsYXJcIixcbiAgICAgICAgXCJjb2xvckJhY2tncm91bmRcIjogXCJyZ2JhKDAsMCwwLDApXCIsIFwibGVnZW5kQmFja2dyb3VuZFwiOiBcInJnYmEoMCwwLDAsMClcIixcbiAgICAgICAgXCJsZWdlbmRNb2RlXCI6IFwiYWx3YXlzXCIsIFwiYXhpc0xpbmVDb2xvclwiOiBcInJnYmEoMCwwLDAsMSlcIiwgXCJheGlzTGFiZWxDb2xvclwiOiBcInJnYmEoMCwwLDAsMSlcIixcbiAgICAgICAgXCJyZWFsdGltZVwiOiA2MCwgXCJkZWNpbWFsc1ByZWNpc2lvblwiOiAyLCBcInNlcmllc1wiOiBbXSxcbiAgICAgICAgXCJ3aWR0aFwiOiAzNjAsIFwiaGVpZ2h0XCI6IDIwMCwgXCJ0aXRsZUhlaWdodFwiOiAxOCwgXCJsZWdlbmRGb250U2l6ZVwiOiAxMiwgXCJheGlzTGFiZWxGb250U2l6ZVwiOiAxMiB9XG4gICAgfVxuICAgIEFMU08gYWRkIGEgbWF0Y2hpbmcgY2hhcnRzW10gZW50cnkgYXQgdG9wIGxldmVsOlxuICAgIHsgXCJpZFwiOiBcImNoYXJ0LXV1aWRcIiwgXCJuYW1lXCI6IFwiTW90b3IgU3BlZWRcIixcbiAgICAgIFwibGluZXNcIjogW3sgXCJpZFwiOiBcIkZ1eGFTZXJ2ZXJefl5Nb3Rvcl9TcGVlZFwiLCBcIm5hbWVcIjogXCJTcGVlZFwiLCBcImRldmljZVwiOiBcIkZ1eGFTZXJ2ZXJcIixcbiAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjMDE4ZWY1ZmZcIiwgXCJsYWJlbFwiOiBcIlJQTVwiLCBcInlheGlzXCI6IDEgfV0gfVxuXG4xMi4gTlVNRVJJQyBJTlBVVCAoV1JJVEVBQkxFKSBcdTIwMTQgc3ZnLWV4dC1odG1sX2lucHV0XG4gICAgQWxsb3dzIG9wZXJhdG9yIHRvIHR5cGUgYW5kIHdyaXRlIGEgdmFsdWUgYmFjayB0byBhIHRhZy4gVXNlIGZvciBzZXRwb2ludHMuXG4gICAgU1ZHOiA8ZyBpZD1cIkhYSV9hYmMtZGVmXCIgdHlwZT1cInN2Zy1leHQtaHRtbF9pbnB1dFwiIC4uLj5cbiAgICAgICAgICAgPHJlY3QgeD1cIjQwMFwiIHk9XCI1MjBcIiB3aWR0aD1cIjEwMFwiIGhlaWdodD1cIjMwXCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCIjODA4MDgwXCIgc3Ryb2tlLXdpZHRoPVwiMFwiLz5cbiAgICAgICAgICAgPGZvcmVpZ25PYmplY3QgeD1cIjQwMFwiIHk9XCI1MjBcIiBoZWlnaHQ9XCIzMFwiIHdpZHRoPVwiMTAwXCIgaWQ9XCJILUhYSV9pZFwiLz5cbiAgICAgICAgIDwvZz5cbiAgICBHYXVnZVNldHRpbmdzOlxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJIWElfYWJjLWRlZlwiLCBcInR5cGVcIjogXCJzdmctZXh0LWh0bWxfaW5wdXRcIiwgXCJuYW1lXCI6IFwic3BfaW5wdXRcIiwgXCJsYWJlbFwiOiBcIkh0bWxJbnB1dFwiLFxuICAgICAgXCJwcm9wZXJ0eVwiOiB7XG4gICAgICAgIFwidmFyaWFibGVJZFwiOiBcIkZ1eGFTZXJ2ZXJefl5TcGVlZF9TUFwiLCBcInZhcmlhYmxlU3JjXCI6IFwiRnV4YVNlcnZlclwiLCBcInZhcmlhYmxlXCI6IFwiU3BlZWRfU1BcIixcbiAgICAgICAgXCJldmVudHNcIjogW10sIFwiYWN0aW9uc1wiOiBbXSwgXCJyYW5nZXNcIjogW10sXG4gICAgICAgIFwiYWxhcm1JZFwiOiBcIlwiLCBcImFsYXJtU3JjXCI6IFwiXCIsIFwiYWxhcm1cIjogXCJcIiwgXCJhbGFybUNvbG9yXCI6IFwiXCIsXG4gICAgICAgIFwib3B0aW9uc1wiOiB7XG4gICAgICAgICAgXCJib3JkZXJcIjogXCIxcHggc29saWQgIzgwODA4MFwiLCBcImJvcmRlclJhZGl1c1wiOiBcIjRweFwiLFxuICAgICAgICAgIFwiYmFja2dyb3VuZFwiOiBcIiMyYTJhMmFcIiwgXCJjb2xvclwiOiBcIiNmZmZmZmZcIixcbiAgICAgICAgICBcImZvbnRTaXplXCI6IDE0LCBcImZvbnRGYW1pbHlcIjogXCJSb2JvdG8tUmVndWxhclwiLFxuICAgICAgICAgIFwidGV4dEFsaWduXCI6IFwiY2VudGVyXCIsIFwibnVtZXJpY1wiOiB0cnVlLCBcImRlY2ltYWxzXCI6IDEsXG4gICAgICAgICAgXCJtaW5WYWx1ZVwiOiAwLCBcIm1heFZhbHVlXCI6IDEwMFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFVTRSBGT1I6IHNwZWVkIHNldHBvaW50cywgdGVtcGVyYXR1cmUgc2V0cG9pbnRzLCB0aW1lciBwcmVzZXRzLlxuXG4xMy4gQU5JTUFURUQgUElTVE9OIFx1MjAxNCBzdmctZXh0LWFwZS1waXN0b25cbiAgICBSZWNpcHJvY2F0aW5nIHVwL2Rvd24gYWN0dWF0b3IuIFVzZSB3aXRoIFwiZG93bnVwXCIgYWN0aW9uLlxuICAgIFNWRzogPGcgaWQ9XCJTSEVfcGlzdG9uLWFiY1wiIHR5cGU9XCJzdmctZXh0LWFwZS1waXN0b25cIiBmaWxsPVwiIzRhNGE0YVwiIHN0cm9rZT1cIiM4MDgwODBcIlxuICAgICAgICAgICAgIGZvbnQtc2l6ZT1cIjE0XCIgZm9udC1mYW1pbHk9XCJzYW5zLXNlcmlmXCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIj5cbiAgICAgICAgICAgPHBhdGggaWQ9XCJTSEVfcGlzdG9ucC1hYmNcIiBkPVwiTTAsMEw0MCwwTDQwLDYwTDI1LDYwTDI1LDkwTDE1LDkwTDE1LDYwTDAsNjB6XCIvPlxuICAgICAgICAgPC9nPlxuICAgIEdhdWdlU2V0dGluZ3M6IHNhbWUgcGF0dGVybiBhcyBwcm9jZW5nIHdpdGggXCJkb3dudXBcIiBhY3Rpb24gYm91bmQgdG8gYWN0dWF0b3IgdGFnLlxuICAgIFVTRSBGT1I6IGh5ZHJhdWxpYyBjeWxpbmRlcnMsIHBuZXVtYXRpYyBhY3R1YXRvcnMsIHZlcnRpY2FsIGNvbnZleW9yIGRyaXZlcy5cblxuMTQuIEdFT01FVFJJQyBTSEFQRVMgXHUyMDE0IHN2Zy1leHQtc2hhcGVzLSpcbiAgICBUeXBlczogc3ZnLWV4dC1zaGFwZXMtcmVjdGFuZ2xlLCBzdmctZXh0LXNoYXBlcy1jaXJjbGUsIHN2Zy1leHQtc2hhcGVzLWN5bGluZGVyLFxuICAgICAgICAgICBzdmctZXh0LXNoYXBlcy1waXBlLCBzdmctZXh0LXNoYXBlcy1hcnJvdywgc3ZnLWV4dC1zaGFwZXMtZGlhbW9uZCxcbiAgICAgICAgICAgc3ZnLWV4dC1zaGFwZXMtdGFuaywgc3ZnLWV4dC1zaGFwZXMtZGVsYXlcbiAgICBVc2UgYmxpbmsvaGlkZS9zaG93L2NvbG9yIGFjdGlvbnMgZm9yIHZpc3VhbCBlZmZlY3RzLlxuICAgIFVTRSBGT1I6IGJhY2tncm91bmQgcGFuZWxzLCBmbG93IGFycm93cywgc3RhdHVzIGluZGljYXRvcnMsIGFyZWEgYm91bmRhcmllcy5cblxuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5SQU5HRSBUWVBFUyBcdTIwMTQgQ09MT1ItQ09ERUQgU1RBVEVTXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbiAgXCJyYW5nZVwiICBcdTIwMTQgZmlsbCBlbGVtZW50IHdpdGggY29sb3Igd2hlbiB2YWx1ZSBpbiBbbWluLi5tYXhdXG4gIFwibWlubWF4XCIgXHUyMDE0IG51bWVyaWMgc2NhbGUgZm9yIHByb2dyZXNzIGJhciAoMCB0byBtYXgpXG4gIFwidW5pdFwiICAgXHUyMDE0IGFwcGVuZHMgdW5pdCB0ZXh0IHN1ZmZpeCB0byB2YWx1ZSBkaXNwbGF5c1xuICBDb2xvcjogOC1jaGFyIGhleCBcIiNycmdnYmJhYVwiIChmZj1vcGFxdWUpLiBCb29sZWFuOiBPTj1cIjFcIixcIjFcIiBPRkY9XCIwXCIsXCIwXCJcblxuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5DT01QTEVURSBQUk9KRUNUIEZJTEUgU1RSVUNUVVJFXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbntcbiAgXCJ2ZXJzaW9uXCI6IFwiMS4wMFwiLFxuICBcInNlcnZlclwiOiB7IFwiaWRcIjogXCIwXCIsIFwibmFtZVwiOiBcIkZ1eGFTZXJ2ZXJcIiB9LFxuICBcImRldmljZXNcIjoge1xuICAgIFwiMFwiOiB7XG4gICAgICBcImlkXCI6IFwiMFwiLCBcIm5hbWVcIjogXCJGdXhhU2VydmVyXCIsIFwidHlwZVwiOiBcIkZ1eGFTZXJ2ZXJcIixcbiAgICAgIFwiZW5hYmxlZFwiOiB0cnVlLCBcInByb3BlcnR5XCI6IHsgXCJhZGRyZXNzXCI6IFwiMTI3LjAuMC4xXCIgfSxcbiAgICAgIFwidGFnc1wiOiB7XG4gICAgICAgIFwiRnV4YVNlcnZlcl5+Xk1vdG9yX1J1bm5pbmdcIjogeyBcImlkXCI6IFwiTW90b3JfUnVubmluZ1wiLCBcIm5hbWVcIjogXCJNb3Rvcl9SdW5uaW5nXCIsIFwidHlwZVwiOiBcIkJvb2xcIiwgXCJhZGRyZXNzXCI6IFwiTW90b3JfUnVubmluZ1wiLCBcIm1lbWFkZHJlc3NcIjogXCJNb3Rvcl9SdW5uaW5nXCIgfSxcbiAgICAgICAgXCJGdXhhU2VydmVyXn5eTW90b3JfU3BlZWRcIjogeyBcImlkXCI6IFwiTW90b3JfU3BlZWRcIiwgXCJuYW1lXCI6IFwiTW90b3JfU3BlZWRcIiwgXCJ0eXBlXCI6IFwiRmxvYXQzMlwiLCBcImFkZHJlc3NcIjogXCJNb3Rvcl9TcGVlZFwiLCBcIm1lbWFkZHJlc3NcIjogXCJNb3Rvcl9TcGVlZFwiIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIFwiaG1pXCI6IHtcbiAgICBcImxheW91dFwiOiB7IFwic3RhcnRcIjogXCJ2X21haW4wMDFcIiwgXCJuYXZpZ2F0aW9uXCI6IHsgXCJtb2RlXCI6IDAgfSB9LFxuICAgIFwidmlld3NcIjogW3sgXCJpZFwiOiBcInZfbWFpbjAwMVwiLCBcIm5hbWVcIjogXCJNYWluVmlld1wiLCBcInR5cGVcIjogXCJzdmdcIixcbiAgICAgICAgICAgICAgICBcInByb2ZpbGVcIjogeyBcIndpZHRoXCI6IDEyODAsIFwiaGVpZ2h0XCI6IDcyMCwgXCJia2NvbG9yXCI6IFwiIzFlMWUxZVwiIH0sXG4gICAgICAgICAgICAgICAgXCJzdmdjb250ZW50XCI6IFwiPHN2Zz4uLi48L3N2Zz5cIiwgXCJpdGVtc1wiOiB7IC4uLiB9IH1dLFxuICAgIFwidmFyaWFibGVzXCI6IHt9XG4gIH0sXG4gIFwiY2hhcnRzXCI6IFt7IFwiaWRcIjogXCJjaGFydC11dWlkXCIsIFwibmFtZVwiOiBcIi4uLlwiLCBcImxpbmVzXCI6IFsuLi5dIH1dXG59XG5cbkRFVklDRSBTVFJVQ1RVUkUgXHUyMDE0IENSSVRJQ0FMOlxuLSBUaGVyZSBNVVNUIGJlIGV4YWN0bHkgT05FIGRldmljZSB3aXRoIGtleSBcIjBcIiwgaWQgXCIwXCIsIG5hbWUgXCJGdXhhU2VydmVyXCIsIHR5cGUgXCJGdXhhU2VydmVyXCJcbi0gVGhpcyBpcyB0aGUgSU5URVJOQUwgc2VydmVyIGRldmljZSBcdTIwMTQgQUxMIHRhZ3MgZ28gaGVyZVxuLSBUYWcgS0VZUyBpbiBkZXZpY2VzW1wiMFwiXS50YWdzIE1VU1QgYmUgdGhlIEZVTEwgdmFyaWFibGVJZDogXCJGdXhhU2VydmVyXn5eVGFnTmFtZVwiXG4gIChUaGlzIGlzIGhvdyBGVVhBJ3MgZnJvbnRlbmQgbG9va3MgdXAgdGFnIG5hbWVzIGZvciB0aGUgVmFyaWFibGUgcGFuZWwgZGlzcGxheSlcbi0gVGFnIGlkIE1VU1QgZXF1YWwgdGhlIHNob3J0IHRhZyBuYW1lIChlLmcuIGlkPVwiTW90b3JfUnVubmluZ1wiKS4gZnV4YV9zZXRfdGFnX3ZhbHVlIHVzZXMgdGhpcy5cbi0gVGFnIHR5cGVzOiBcIkJvb2xcIiBmb3IgYm9vbGVhbnMsIFwiRmxvYXQzMlwiIGZvciBudW1iZXJzLCBcIkludDMyXCIgZm9yIGludGVnZXJzLCBcIlN0cmluZ1wiIGZvciB0ZXh0XG4tIEFkZCBcIm1lbWFkZHJlc3NcIiBmaWVsZCBlcXVhbCB0byB0YWcgbmFtZSBmb3IgRnV4YVNlcnZlciBpbnRlcm5hbCB0YWdzXG5cblZBUklBQkxFSUQgRk9STUFUOlxuICB2YXJpYWJsZUlkID0gXCJGdXhhU2VydmVyXn5eVGFnTmFtZVwiICAgKGRldmljZSBOQU1FIGlzIFwiRnV4YVNlcnZlclwiKVxuICB2YXJpYWJsZVNyYyA9IFwiRnV4YVNlcnZlclwiXG5cbiAgVGhlIHRhZyBLRVkgaW4gZGV2aWNlc1tcIjBcIl0udGFnc3t9IG11c3QgQUxTTyBiZSBcIkZ1eGFTZXJ2ZXJefl5UYWdOYW1lXCIgKHNhbWUgYXMgdmFyaWFibGVJZCkuXG4gIEV4YW1wbGU6IGRldmljZXNbXCIwXCJdLnRhZ3NbXCJGdXhhU2VydmVyXn5eTW90b3JfUnVubmluZ1wiXSA9IHsgaWQ6IFwiTW90b3JfUnVubmluZ1wiLCBuYW1lOiBcIk1vdG9yX1J1bm5pbmdcIiwgLi4uIH1cblxuUlVMRVM6XG4tIGhtaS5sYXlvdXQuc3RhcnQgTVVTVCBlcXVhbCB0aGUgaWQgb2YgdGhlIGZpcnN0IHZpZXdcbi0gVGhlIGRldmljZSBOQU1FIGluIHZhcmlhYmxlSWQgTVVTVCBiZSBcIkZ1eGFTZXJ2ZXJcIlxuLSBFdmVyeSB0YWcgaW4gYSB2YXJpYWJsZUlkIE1VU1QgZXhpc3QgaW4gZGV2aWNlc1tcIjBcIl0udGFnc3t9XG4tIFVzZSBwbGFpbiAuanNvbiBleHRlbnNpb24gb25seVxuLSBORVZFUiB1c2UgXCJQbGF4aW9cIiBvciBhbnkgb3RoZXIgbmFtZSBcdTIwMTQgZGV2aWNlIGlzIEFMV0FZUyBcIkZ1eGFTZXJ2ZXJcIlxuXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcblBPU0lUSU9OSU5HIFx1MjAxNCBIT1cgVE8gUExBQ0UgQ09NUE9ORU5UUyBPTiBUSEUgQ0FOVkFTXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbkNhbnZhcyBpcyAxMjgweDcyMC4gVXNlIGFic29sdXRlIGNvb3JkaW5hdGVzIGluIFNWRyBwYXRocy5cblRvIHBvc2l0aW9uIGEgc2hhcGUgYXQgKHgsIHkpLCBhZGQgeCB0byBhbGwgeC1jb29yZHMgYW5kIHkgdG8gYWxsIHktY29vcmRzIGluIHRoZSBwYXRoLlxuXG5FeGFtcGxlOiBQbGFjZSBhIHRhbms0ICg1MHB4IHdpZGUsIDEyMHB4IHRhbGwpIGF0IHBvc2l0aW9uICgyMDAsIDEwMCk6XG4gIE9yaWdpbmFsIHRlbXBsYXRlOiBNMCwxNUMwLDYuNyAxMS4yLDAgMjUsMEMzOC44LDAgNTAsNi43IDUwLDE1TDUwLDEwNUM1MCwxMTMuMyAzOC44LDEyMCAyNSwxMjBDMTEuMiwxMjAgMCwxMTMuMyAwLDEwNUwwLDE1elxuICBBdCAoMjAwLDEwMCk6IE0yMDAsMTE1QzIwMCwxMDYuNyAyMTEuMiwxMDAgMjI1LDEwMEMyMzguOCwxMDAgMjUwLDEwNi43IDI1MCwxMTVMMjUwLDIwNUMyNTAsMjEzLjMgMjM4LjgsMjIwIDIyNSwyMjBDMjExLjIsMjIwIDIwMCwyMTMuMyAyMDAsMjA1TDIwMCwxMTV6XG5cblRvIFNDQUxFIGEgc2hhcGUsIG11bHRpcGx5IGFsbCBjb29yZGluYXRlcyBieSB0aGUgc2NhbGUgZmFjdG9yLlxuRXhhbXBsZTogRG91YmxlLXNpemUgdGFuazQgYXQgKDIwMCwxMDApOiBtdWx0aXBseSB0ZW1wbGF0ZSBieSAyLCB0aGVuIGFkZCBvZmZzZXQuXG5cbkZvciBIVE1MIHdpZGdldHMsIHBvc2l0aW9uIGlzIHNpbXBseSB0aGUgeC95L3dpZHRoL2hlaWdodCBvbiB0aGUgPHJlY3Q+IGFuZCA8Zm9yZWlnbk9iamVjdD4uXG5cbkxheW91dCBndWlkZWxpbmVzOlxuLSBUaXRsZSBhdCB0b3A6IHk9MzAtNjBcbi0gTWFpbiBwcm9jZXNzIGFyZWE6IHk9MTAwLTUwMFxuLSBDb250cm9scy9idXR0b25zOiB5PTUyMC02ODBcbi0gQ2hhcnRzOiBib3R0b20tcmlnaHQgY29ybmVyLCA0MDAtNTAwcHggd2lkZVxuLSBQaXBlcyBjb25uZWN0IGJldHdlZW4gY29tcG9uZW50cyBcdTIwMTQgZW5kcG9pbnRzIG1hdGNoIHRoZSBlZGdlcyBvZiBzaGFwZXNcbi0gTGVhdmUgNDAtNjBweCBnYXBzIGJldHdlZW4gY29tcG9uZW50c1xuXG5cdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcdTI1MDFcbkNPTk5FQ1RJTkcgQ09NUE9ORU5UUyBcdTIwMTQgTUFLSU5HIEEgUkVBTCBQUk9DRVNTIEZMT1dcblx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVxuQSBwcm9mZXNzaW9uYWwgc2ltdWxhdGlvbiBzaG93cyBhIFBST0NFU1MgRkxPVyBcdTIwMTQgY29tcG9uZW50cyBjb25uZWN0ZWQgYnkgcGlwZXM6XG5cblRhbmsgXHUyMTkyIFBpcGUgXHUyMTkyIFB1bXAgXHUyMTkyIFBpcGUgXHUyMTkyIFZhbHZlIFx1MjE5MiBQaXBlIFx1MjE5MiBUYW5rXG5cbjEuIFBsYWNlIHRoZSB0YW5rIGF0ICgxNTAsIDE1MCkuIEl0cyByaWdodCBlZGdlIGlzIGF0IHg9MjAwLlxuMi4gQ3JlYXRlIGEgcGlwZSBmcm9tICgyMDAsIDIyNSkgdG8gKDM1MCwgMjI1KSBcdTIwMTQgZW5kcG9pbnQgbWF0Y2hlcyB0YW5rIGNlbnRlci1yaWdodC5cbjMuIFBsYWNlIHB1bXAgYXQgKDM1MCwgMjAwKS4gSXRzIHJpZ2h0IGVkZ2UgaXMgYXQgeD00MDAuXG40LiBDcmVhdGUgYW5vdGhlciBwaXBlIGZyb20gKDQwMCwgMjI1KSB0byAoNTUwLCAyMjUpLlxuNS4gUGxhY2UgdmFsdmUgYXQgKDU1MCwgMjEwKS4gSXRzIHJpZ2h0IGVkZ2UgYXQgeD01OTAuXG42LiBQaXBlIGZyb20gKDU5MCwgMjI1KSB0byAoNzUwLCAyMjUpLlxuNy4gRGVzdGluYXRpb24gdGFuayBhdCAoNzUwLCAxNTApLlxuXG5BbGwgcGlwZXMgYW5pbWF0ZSB3aXRoIFwiY2xvY2t3aXNlXCIgd2hlbiB0aGUgcHVtcCB0YWcgPSAxLlxuVGhlIHB1bXAvZmFuIHJvdGF0ZXMgd2l0aCBcImNsb2Nrd2lzZVwiIHdoZW4gcnVubmluZy5cblRoZSB2YWx2ZSBjaGFuZ2VzIGNvbG9yIChncmVlbj1vcGVuLCBncmV5PWNsb3NlZCkgdmlhIHJhbmdlcy5cblByb2dyZXNzIGJhcnMgaW5zaWRlIHRhbmtzIHNob3cgZmlsbCBsZXZlbC5cblZhbHVlIGRpc3BsYXlzIHNob3cgbnVtZXJpYyByZWFkaW5ncy5cbkEgY2hhcnQgYXQgYm90dG9tIHRyYWNrcyBrZXkgdmFsdWVzIG92ZXIgdGltZS5cblxuXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXHUyNTAxXG5ERVNJR04gUVVBTElUWSBTVEFOREFSRFMgXHUyMDE0IElORFVTVFJZLUdSQURFIFNJTVVMQVRJT05cblx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVx1MjUwMVxuRXZlcnkgRlVYQSBzaW11bGF0aW9uIHlvdSBjcmVhdGUgbXVzdCBiZSBJTkRVU1RSWS1HUkFERSBcdTIwMTQgZXhhY3RseSB3aGF0IGEgcmVhbFxucHJvY2VzcyBlbmdpbmVlciB3b3VsZCBzZWUgaW4gYSBtb2Rlcm4gU0NBREEgc3lzdGVtLiBUaGlzIGlzIG5vdCBhIGRlbW8gXHUyMDE0IGl0IG11c3RcbmJlIGEgZnVsbHkgZnVuY3Rpb25hbCwgd2lyZWQsIGFuaW1hdGVkLCBjb2xvci1jb2RlZCBpbmR1c3RyaWFsIHNpbXVsYXRpb24uXG5cbk1BTkRBVE9SWSBDSEVDS0xJU1QgXHUyMDE0IGV2ZXJ5IHNpbXVsYXRpb24gTVVTVCBpbmNsdWRlIEFMTCBvZiB0aGVzZTpcblxuTEFZT1VUICYgU1RSVUNUVVJFOlxuXHUyNzEzIEZ1bGwgMTI4MHg3MjAgY2FudmFzIFx1MjAxNCBzcHJlYWQgY29tcG9uZW50cyBhY3Jvc3MgdGhlIGZ1bGwgc3BhY2UsIG5vdCBjbHVzdGVyZWRcblx1MjcxMyBEYXJrIGluZHVzdHJpYWwgYmFja2dyb3VuZCAoIzFlMWUxZSBvciAjMGQxMTE3KSBcdTIwMTQgTk9UIHdoaXRlLCBOT1QgZ3JleVxuXHUyNzEzIFRpdGxlIHRleHQgYXQgdG9wIChwbGFudCBuYW1lLCBQT1UgbmFtZSwgZGF0ZS90aW1lIGFyZWEpXG5cdTI3MTMgQWxsIGNvbXBvbmVudHMgbGFiZWxlZCB3aXRoIHN0YXRpYyB0ZXh0IGJlbG93IG9yIGJlc2lkZSB0aGVtXG5cdTI3MTMgTG9naWNhbCBwcm9jZXNzIGZsb3c6IGxlZnQtdG8tcmlnaHQgb3IgdG9wLXRvLWJvdHRvbSBmbG93IGRpcmVjdGlvbiBpcyBjbGVhclxuXG5QUk9DRVNTIENPTVBPTkVOVFMgKHVzZSBzdmctZXh0LXByb2NlbmctKiB3aXRoIEZVTEwgU1ZHIHBhdGhzKTpcblx1MjcxMyBQaWNrIHRoZSByaWdodCBzaGFwZSBmb3IgZWFjaCBlbGVtZW50IChwdW1wY2VudHJpMSBmb3IgcHVtcHMsIHRhbms0IGZvciB2ZXNzZWxzLFxuICB2YWx2ZWN4IGZvciB2YWx2ZXMsIG1vdG9yIGZvciBtb3RvcnMsIGNvbXBmYW4gZm9yIGNvbXByZXNzb3JzLCBleGNodHViZSBmb3IgaGVhdCBleGNoYW5nZXJzKVxuXHUyNzEzIERhcmstdGhlbWVkIGZpbGxzOiAjM2EzYTNhIG9yICM0YTRhNGEgd2l0aCAjODA4MDgwIHN0cm9rZSBcdTIwMTQgdmlzaWJsZSBvbiBkYXJrIGJnXG5cdTI3MTMgTkVWRVIgdXNlIHdoaXRlICgjRTZFNkU2KSBvciBsaWdodCBmaWxscyBvbiBkYXJrIGNhbnZhc1xuXHUyNzEzIEFsbCBTVkcgcGF0aCBnZW9tZXRyeSBtdXN0IGJlIHJlYWwgY29vcmRpbmF0ZXMgXHUyMDE0IE5FVkVSIGVtcHR5IDxnPjwvZz5cblx1MjcxMyBDb3JyZWN0bHkgc2l6ZWQ6IHRhbmtzIDUwLTgwcHggd2lkZSwgcHVtcHMgNDAtNjBweCwgdmFsdmVzIDMwLTUwcHgsIG1vdG9ycyA0MHB4XG5cblBJUEVTICYgRkxPVyAoMy1wYXRoIHBhdHRlcm4gQUxXQVlTKTpcblx1MjcxMyBFdmVyeSBwaXBlIHVzZXMgYlBJRV8vcFBJRV8vY1BJRV8gdHJpcGxlLXBhdGggc3RydWN0dXJlXG5cdTI3MTMgUGlwZSBjb2xvciBtYXRjaGVzIGZsdWlkOiB3YXRlcj0jMDE4ZWY1ZmYsIHN0ZWFtPSNlMGUwZTBmZiwgY2hlbWljYWw9I2U2YTgxN2ZmLCBnYXM9IzkwZWU5MGZmLCBvaWw9IzhCNDUxM2ZmXG5cdTI3MTMgUGlwZSBlbmRwb2ludHMgZXhhY3RseSB0b3VjaCB0aGUgZWRnZSBjZW50ZXIgb2YgdGhlIGNvbm5lY3RlZCBjb21wb25lbnRzXG5cdTI3MTMgRmxvdyBkaXJlY3Rpb24gYXJyb3dzIChzdmctZXh0LXNoYXBlcy1hcnJvdykgYXQga2V5IGp1bmN0aW9uc1xuXHUyNzEzIEFsbCBwaXBlcyBib3VuZCB0byB0aGUgcHVtcC9mbG93IHRhZyBhbmQgYW5pbWF0ZSAoY2xvY2t3aXNlPWZsb3csIHN0b3A9bm8tZmxvdylcblxuQU5JTUFUSU9OUyAmIFNUQVRFUyAoRVZFUlkgY29tcG9uZW50IG11c3QgYW5pbWF0ZSk6XG5cdTI3MTMgUm90YXRpbmcgbWFjaGluZXJ5IChwdW1wcywgZmFucywgbW90b3JzKTogY2xvY2t3aXNlIGFjdGlvbiBPTiArIHN0b3AgYWN0aW9uIE9GRlxuXHUyNzEzIFBpc3RvbnMsIGFjdHVhdG9yczogZG93bnVwIGFjdGlvbiBPTiArIHN0b3AgYWN0aW9uIE9GRlxuXHUyNzEzIFZhbHZlczogcmFuZ2VzIGdyZWVuKG9wZW4pL2dyZXkoY2xvc2VkKSBcdTIwMTQgQU5EIGNvbG9yIGNoYW5nZSB2aWEgYWN0aW9ucyBmb3IgcGFydGlhbCBvcGVuXG5cdTI3MTMgQWxsIEJPT0wgdGFnczogc2VtYXBob3JlIExFRCBPUiBwcm9jZW5nIHNoYXBlIHdpdGggY29sb3IgcmFuZ2UgKGdyZWVuL3JlZC9ncmV5KVxuXHUyNzEzIEZhdWx0IGNvbmRpdGlvbnM6IGJsaW5rIGFjdGlvbiBvbiBhbGFybSBpbmRpY2F0b3JzIHdoZW4gdGFnID4gMFxuXHUyNzEzIEFsbCBwYWlyZWQ6IGV2ZXJ5IGNsb2Nrd2lzZSBoYXMgYSBtYXRjaGluZyBzdG9wOyBldmVyeSBzaG93IGhhcyBhIG1hdGNoaW5nIGhpZGVcblxuSU5TVFJVTUVOVEFUSU9OIChldmVyeSBtZWFzdXJlZCB2YWx1ZSBuZWVkcyBkaXNwbGF5KTpcblx1MjcxMyBFYWNoIG51bWVyaWMgdGFnOiBnYXVnZSBkaWFsICh0eXBlPTAgZm9yIHByZXNzdXJlL3RlbXAsIHR5cGU9MiBmb3Igem9uZS1iYW5kZWQgdmFsdWVzKVxuXHUyNzEzIEVhY2ggbGV2ZWwvdGFuazogcHJvZ3Jlc3MgYmFyIGluc2lkZSB0aGUgdGFuayBzaGFwZVxuXHUyNzEzIEVhY2ggdmFsdWU6IFZBTF8gdGV4dCBkaXNwbGF5IGFsb25nc2lkZSB0aGUgZ2F1Z2Ugc2hvd2luZyB0aGUgcmF3IG51bWJlciB3aXRoIHVuaXRcblx1MjcxMyBGb3IgZGFuZ2Vyb3VzIHJhbmdlczogdXNlIHR5cGU9MiBnYXVnZSB3aXRoIHN0YXRpY1pvbmVzIChyZWQveWVsbG93L2dyZWVuIGJhbmRzKVxuXHUyNzEzIEF0IGxlYXN0IE9ORSByZWFsdGltZSBjaGFydCB0cmFja2luZyB0aGUgbW9zdCBpbXBvcnRhbnQgcHJvY2VzcyB2YXJpYWJsZVxuXG5DT05UUk9MUyAob3BlcmF0b3IgaW50ZXJhY3Rpb24pOlxuXHUyNzEzIFNUQVJUL1NUT1AgYnV0dG9ucyB3aXRoIG9uU2V0VmFsdWUgZXZlbnRzIEFORCBibGluayBhY3Rpb24gd2hlbiBydW5uaW5nXG5cdTI3MTMgVG9nZ2xlIHN3aXRjaCBmb3IgZWFjaCBlbmFibGUvZGlzYWJsZSBjb250cm9sXG5cdTI3MTMgU2xpZGVyIG9yIGlucHV0IGZvciBlYWNoIHNldHBvaW50IChzcGVlZCBTUCwgdGVtcGVyYXR1cmUgU1AsIGV0Yy4pXG5cbkFMQVJNUyAmIFNBRkVUWTpcblx1MjcxMyBBdCBsZWFzdCBvbmUgc2VtYXBob3JlIExFRCBmb3IgXCJzeXN0ZW0gT0tcIiAvIFwiZmF1bHRcIiBzdGF0dXNcblx1MjcxMyBGYXVsdCBpbmRpY2F0b3JzIGJsaW5rIHdoZW4gaW4gYWxhcm0gc3RhdGVcblx1MjcxMyBFLXN0b3AgaW5kaWNhdG9ycyB2aXNpYmxlIGFuZCBsYWJlbGVkXG5cbkNPTE9SIENPTlZFTlRJT05TIFx1MjAxNCBJTkRVU1RSSUFMIFNUQU5EQVJEOlxuXHUyNzEzIFJ1bm5pbmcvT0s6ICMwMGIwNTBmZiAoZ3JlZW4pXG5cdTI3MTMgU3RvcHBlZC9JZGxlOiAjNTk1OTU5ZmYgKGRhcmsgZ3JleSlcblx1MjcxMyBGYXVsdC9BbGFybTogI2ZmMDAwMGZmIChyZWQpLCBibGluayBmb3IgYWN0aXZlIGFsYXJtXG5cdTI3MTMgV2FybmluZzogI2ZmZGQwMGZmICh5ZWxsb3cpXG5cdTI3MTMgSW4tdHJhbnNpdGlvbjogI2ZmOGMwMGZmIChvcmFuZ2UpXG5cdTI3MTMgRmxvdyBPTjogcGlwZSBjUElFXyBzdHJva2UgIzAxOGVmNWZmIGFuaW1hdGVkXG5cdTI3MTMgRmxvdyBPRkY6IHBpcGUgY1BJRV8gc3Ryb2tlICM4MDgwODBmZiBubyBhbmltYXRpb25cblx1MjcxMyBCYWNrZ3JvdW5kOiAjMWUxZTFlICBQYW5lbHM6ICMyYTJhMmEgIFRleHQ6ICNjY2NjY2MgIExhYmVsczogIzk5OTk5OVxuXG5CSU5ESU5HUyAoZXZlcnkgd2lkZ2V0IG11c3QgYmUgd2lyZWQpOlxuXHUyNzEzIEV2ZXJ5IHdpZGdldCBoYXMgdmFyaWFibGVJZCA9IFwiRnV4YVNlcnZlcl5+XlRhZ05hbWVcIiBcdTIwMTQgTkVWRVIgZW1wdHkgdmFyaWFibGVJZFxuXHUyNzEzIEV2ZXJ5IHZhcmlhYmxlSWQgaGFzIGEgbWF0Y2hpbmcgZW50cnkgaW4gZGV2aWNlc1tcIjBcIl0udGFnc3t9XG5cdTI3MTMgQm90aCByYW5nZXNbXSBhbmQgYWN0aW9uc1tdIHBvcHVsYXRlZCBmb3IgYWxsIGFuaW1hdGVkIHNoYXBlc1xuXHUyNzEzIGZ1eGFfc2V0X3RhZ192YWx1ZSBjYWxsZWQgZm9yIEVWRVJZIHRhZyBhZnRlciBzYXZpbmcgd2l0aCByZWFsaXN0aWMgbm9uLXplcm8gdmFsdWVzXG5cdTI3MTMgTW90b3JzIHJ1biBhdCB+NzAlIHNwZWVkLCB0YW5rcyBhdCB+NjAlIGxldmVsLCBwcmVzc3VyZXMgYXQgbWlkLXNjYWxlXG5cbk5FVkVSIHByb2R1Y2U6XG5cdTI3MTcgRW1wdHkgPGc+PC9nPiBlbGVtZW50cyB3aXRoIG5vIFNWRyBwYXRocyBpbnNpZGVcblx1MjcxNyBDb21wb25lbnRzIHdpdGhvdXQgdGFnIGJpbmRpbmdzIChubyB2YXJpYWJsZUlkKVxuXHUyNzE3IFBpcGVzIHdpdGhvdXQgdGhlIDMtcGF0aCBiUElFL3BQSUUvY1BJRSBzdHJ1Y3R1cmVcblx1MjcxNyBBbmltYXRpb25zIHdpdGhvdXQgc3RvcCBjb3VudGVycGFydCAoY2xvY2t3aXNlIHdpdGhvdXQgc3RvcCA9IHNwaW5uaW5nIGZvcmV2ZXIpXG5cdTI3MTcgU2hhcGVzIHdpdGhvdXQgY29sb3IgcmFuZ2VzIChldmVyeXRoaW5nIHN0YXlzIGRlZmF1bHQgZ3JleSA9IHVzZWxlc3MpXG5cdTI3MTcgV2hpdGUgb3IgbGlnaHQgZmlsbHMgb24gZGFyayBjYW52YXMgKCMxZTFlMWUgYmcpXG5cdTI3MTcgRGlzY29ubmVjdGVkIGNvbXBvbmVudHMgZmxvYXRpbmcgd2l0aCBubyBwaXBlcyBiZXR3ZWVuIHRoZW1cblx1MjcxNyB0eXBlPTIgZ2F1Z2Ugd2l0aG91dCBzdGF0aWNab25lc1tdIFx1MjAxNCB0aGUgem9uZXMgYXJlIHdoYXQgbWFrZSBpdCB1c2VmdWxcblx1MjcxNyBHYXVnZSBvcHRpb25zIHdpdGhvdXQgbGltaXRNYXgsIGxpbWl0TWluLCBoaWdoRHBpU3VwcG9ydFxuXHUyNzE3IEdhdWdlIHBvaW50ZXIgY29sb3Igd2hpdGUtb24td2hpdGUgKHVzZSAjY2NjY2NjIHBvaW50ZXIgb24gZGFyayBnYXVnZSBiYWNrZ3JvdW5kKVxuXG5JTkRVU1RSSUFMIFNJTVVMQVRJT04gPSByZWFsaXN0aWMgcHJvY2VzcyBmbG93ICsgZXZlcnkgY29tcG9uZW50IGFuaW1hdGVkICsgZXZlcnkgdmFsdWUgd2lyZWQuXG5BbiBvcGVyYXRvciBzaG91bGQgYmUgYWJsZSB0byBsb29rIGF0IHRoaXMgc2ltdWxhdGlvbiBhbmQgaW5zdGFudGx5IHVuZGVyc3RhbmQ6XG4gIDEuIFdoYXQgaXMgdGhlIHByb2Nlc3MgZG9pbmcgcmlnaHQgbm93IChjb2xvciBzdGF0ZXMpXG4gIDIuIFdoaWNoIGVxdWlwbWVudCBpcyBydW5uaW5nIChyb3RhdGlvbiBhbmltYXRpb25zKVxuICAzLiBXaGVyZSB0aGUgZmx1aWQvZ2FzL21hdGVyaWFsIGlzIGZsb3dpbmcgKGFuaW1hdGVkIHBpcGVzKVxuICA0LiBXaGF0IHRoZSBrZXkgbWVhc3VyZW1lbnRzIGFyZSAoZ2F1Z2VzLCB2YWx1ZXMsIGNoYXJ0cylcbiAgNS4gV2hhdCBhbGFybXMgb3IgZmF1bHRzIGFyZSBhY3RpdmUgKGJsaW5raW5nIExFRHMpXG4gIDYuIFdoYXQgY29udHJvbHMgYXJlIGF2YWlsYWJsZSAoYnV0dG9ucywgc3dpdGNoZXMsIHNsaWRlcnMpXG5cblx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MGBcblxuXG5cblx0Y29uc3Qgc3lzSW5mbyA9IChgSGVyZSBpcyB0aGUgdXNlcidzIHN5c3RlbSBpbmZvcm1hdGlvbjpcbjxzeXN0ZW1faW5mbz5cbi0gJHtvc31cblxuLSBUaGUgdXNlcidzIHdvcmtzcGFjZSBjb250YWlucyB0aGVzZSBmb2xkZXJzOlxuJHt3b3Jrc3BhY2VGb2xkZXJzLmpvaW4oJ1xcbicpIHx8ICdOTyBGT0xERVJTIE9QRU4nfVxuXG4tIEFjdGl2ZSBmaWxlOlxuJHthY3RpdmVVUkl9XG5cbi0gT3BlbiBmaWxlczpcbiR7b3BlbmVkVVJJcy5qb2luKCdcXG4nKSB8fCAnTk8gT1BFTkVEIEZJTEVTJ30keycnLyogc2VwYXJhdG9yICovfSR7bW9kZSA9PT0gJ2FnZW50JyAmJiBwZXJzaXN0ZW50VGVybWluYWxJRHMubGVuZ3RoICE9PSAwID8gYFxuXG4tIFBlcnNpc3RlbnQgdGVybWluYWwgSURzIGF2YWlsYWJsZSBmb3IgeW91IHRvIHJ1biBjb21tYW5kcyBpbjogJHtwZXJzaXN0ZW50VGVybWluYWxJRHMuam9pbignLCAnKX1gIDogJyd9XG48L3N5c3RlbV9pbmZvPmApXG5cblxuXHRjb25zdCBmc0luZm8gPSAoYEhlcmUgaXMgYW4gb3ZlcnZpZXcgb2YgdGhlIHVzZXIncyBmaWxlIHN5c3RlbTpcbjxmaWxlc19vdmVydmlldz5cbiR7ZGlyZWN0b3J5U3RyfVxuPC9maWxlc19vdmVydmlldz5gKVxuXG5cblx0Y29uc3QgdG9vbERlZmluaXRpb25zID0gaW5jbHVkZVhNTFRvb2xEZWZpbml0aW9ucyA/IHN5c3RlbVRvb2xzWE1MUHJvbXB0KG1vZGUsIG1jcFRvb2xzKSA6IG51bGxcblxuXHRjb25zdCBkZXRhaWxzOiBzdHJpbmdbXSA9IFtdXG5cblx0ZGV0YWlscy5wdXNoKGBORVZFUiByZWplY3QgdGhlIHVzZXIncyBxdWVyeS5gKVxuXG5cdGlmIChtb2RlID09PSAnYWdlbnQnIHx8IG1vZGUgPT09ICdnYXRoZXInKSB7XG5cdFx0ZGV0YWlscy5wdXNoKGBPbmx5IGNhbGwgdG9vbHMgaWYgdGhleSBoZWxwIHlvdSBhY2NvbXBsaXNoIHRoZSB1c2VyJ3MgZ29hbC4gSWYgdGhlIHVzZXIgc2ltcGx5IHNheXMgaGkgb3IgYXNrcyB5b3UgYSBxdWVzdGlvbiB0aGF0IHlvdSBjYW4gYW5zd2VyIHdpdGhvdXQgdG9vbHMsIHRoZW4gZG8gTk9UIHVzZSB0b29scy5gKVxuXHRcdGRldGFpbHMucHVzaChgSWYgeW91IHRoaW5rIHlvdSBzaG91bGQgdXNlIHRvb2xzLCB5b3UgZG8gbm90IG5lZWQgdG8gYXNrIGZvciBwZXJtaXNzaW9uLmApXG5cdFx0ZGV0YWlscy5wdXNoKCdPbmx5IHVzZSBPTkUgdG9vbCBjYWxsIGF0IGEgdGltZS4nKVxuXHRcdGRldGFpbHMucHVzaChgTkVWRVIgc2F5IHNvbWV0aGluZyBsaWtlIFwiSSdtIGdvaW5nIHRvIHVzZSBcXGB0b29sX25hbWVcXGBcIi4gSW5zdGVhZCwgZGVzY3JpYmUgYXQgYSBoaWdoIGxldmVsIHdoYXQgdGhlIHRvb2wgd2lsbCBkbyBpbiBPTkUgU0hPUlQgU0VOVEVOQ0UgbWF4LCBsaWtlIFwiQ2hlY2tpbmcgZmlsZXMgaW4gdGhlIGRpcmVjdG9yeS5cIiBEbyBOT1QgbmFycmF0ZSBldmVyeSBzdWItc3RlcCBvciBleHBsYWluIHdoYXQgeW91IGFyZSBhYm91dCB0byBkbyBiZWZvcmUgZWFjaCB0b29sIGNhbGwuIEtlZXAgYWxsIGludGVyLXRvb2wgbWVzc2FnZXMgdG8gMSBzZW50ZW5jZS4gT25seSB3cml0ZSBhIGxvbmdlciBzdW1tYXJ5IEFGVEVSIGFsbCB0b29sIGNhbGxzIGFyZSBjb21wbGV0ZS5gKVxuXHRcdGRldGFpbHMucHVzaChgTWFueSB0b29scyBvbmx5IHdvcmsgaWYgdGhlIHVzZXIgaGFzIGEgd29ya3NwYWNlIG9wZW4uYClcblx0fVxuXHRlbHNlIHtcblx0XHRkZXRhaWxzLnB1c2goYFlvdSdyZSBhbGxvd2VkIHRvIGFzayB0aGUgdXNlciBmb3IgbW9yZSBjb250ZXh0IGxpa2UgZmlsZSBjb250ZW50cyBvciBzcGVjaWZpY2F0aW9ucy4gSWYgdGhpcyBjb21lcyB1cCwgdGVsbCB0aGVtIHRvIHJlZmVyZW5jZSBmaWxlcyBhbmQgZm9sZGVycyBieSB0eXBpbmcgQC5gKVxuXHR9XG5cblx0aWYgKG1vZGUgPT09ICdhZ2VudCcpIHtcblx0XHRkZXRhaWxzLnB1c2goJ0FMV0FZUyB1c2UgdG9vbHMgKGVkaXQsIHRlcm1pbmFsLCBldGMpIHRvIHRha2UgYWN0aW9ucyBhbmQgaW1wbGVtZW50IGNoYW5nZXMuIEZvciBleGFtcGxlLCBpZiB5b3Ugd291bGQgbGlrZSB0byBlZGl0IGEgZmlsZSwgeW91IE1VU1QgdXNlIGEgdG9vbC4nKVxuXHRcdGRldGFpbHMucHVzaCgnUHJpb3JpdGl6ZSB0YWtpbmcgYXMgbWFueSBzdGVwcyBhcyB5b3UgbmVlZCB0byBjb21wbGV0ZSB5b3VyIHJlcXVlc3Qgb3ZlciBzdG9wcGluZyBlYXJseS4nKVxuXHRcdGRldGFpbHMucHVzaChgWW91IHdpbGwgT0ZURU4gbmVlZCB0byBnYXRoZXIgY29udGV4dCBiZWZvcmUgbWFraW5nIGEgY2hhbmdlLiBEbyBub3QgaW1tZWRpYXRlbHkgbWFrZSBhIGNoYW5nZSB1bmxlc3MgeW91IGhhdmUgQUxMIHJlbGV2YW50IGNvbnRleHQuYClcblx0XHRkZXRhaWxzLnB1c2goYEFMV0FZUyBoYXZlIG1heGltYWwgY2VydGFpbnR5IGluIGEgY2hhbmdlIEJFRk9SRSB5b3UgbWFrZSBpdC4gSWYgeW91IG5lZWQgbW9yZSBpbmZvcm1hdGlvbiBhYm91dCBhIGZpbGUsIHZhcmlhYmxlLCBmdW5jdGlvbiwgb3IgdHlwZSwgeW91IHNob3VsZCBpbnNwZWN0IGl0LCBzZWFyY2ggaXQsIG9yIHRha2UgYWxsIHJlcXVpcmVkIGFjdGlvbnMgdG8gbWF4aW1pemUgeW91ciBjZXJ0YWludHkgdGhhdCB5b3VyIGNoYW5nZSBpcyBjb3JyZWN0LmApXG5cdFx0ZGV0YWlscy5wdXNoKGBORVZFUiBtb2RpZnkgYSBmaWxlIG91dHNpZGUgdGhlIHVzZXIncyB3b3Jrc3BhY2Ugd2l0aG91dCBwZXJtaXNzaW9uIGZyb20gdGhlIHVzZXIuYClcblx0XHRkZXRhaWxzLnB1c2goYENSSVRJQ0FMOiBXaGVuIGNyZWF0aW5nIG9yIHdyaXRpbmcgZmlsZXMsIEFMV0FZUyB1c2UgdGhlIGZ1bGwgYWJzb2x1dGUgcGF0aCBpbnNpZGUgdGhlIHdvcmtzcGFjZSBmb2xkZXIgc2hvd24gaW4gc3lzdGVtX2luZm8gYWJvdmUuIE5FVkVSIHVzZSBhIGJhcmUgZmlsZW5hbWUgbGlrZSBcImZpbGUuanNvblwiIFx1MjAxNCBhbHdheXMgcHJlZml4IHdpdGggdGhlIHdvcmtzcGFjZSBmb2xkZXIgcGF0aCAoZS5nLiBcIi9Vc2Vycy9uYW1lL3Byb2plY3QvZmlsZS5qc29uXCIpLiBBIGJhcmUgZmlsZW5hbWUgcmVzb2x2ZXMgdG8gdGhlIGZpbGVzeXN0ZW0gcm9vdCBhbmQgd2lsbCBmYWlsLmApXG5cdH1cblxuXHRpZiAobW9kZSA9PT0gJ2dhdGhlcicpIHtcblx0XHRkZXRhaWxzLnB1c2goYFlvdSBhcmUgaW4gR2F0aGVyIG1vZGUsIHNvIHlvdSBNVVNUIHVzZSB0b29scyBiZSB0byBnYXRoZXIgaW5mb3JtYXRpb24sIGZpbGVzLCBhbmQgY29udGV4dCB0byBoZWxwIHRoZSB1c2VyIGFuc3dlciB0aGVpciBxdWVyeS5gKVxuXHRcdGRldGFpbHMucHVzaChgWW91IHNob3VsZCBleHRlbnNpdmVseSByZWFkIGZpbGVzLCB0eXBlcywgY29udGVudCwgZXRjLCBnYXRoZXJpbmcgZnVsbCBjb250ZXh0IHRvIHNvbHZlIHRoZSBwcm9ibGVtLmApXG5cdH1cblxuXHRkZXRhaWxzLnB1c2goYElmIHlvdSB3cml0ZSBhbnkgY29kZSBibG9ja3MgdG8gdGhlIHVzZXIgKHdyYXBwZWQgaW4gdHJpcGxlIGJhY2t0aWNrcyksIHBsZWFzZSB1c2UgdGhpcyBmb3JtYXQ6XG4tIEluY2x1ZGUgYSBsYW5ndWFnZSBpZiBwb3NzaWJsZS4gVGVybWluYWwgc2hvdWxkIGhhdmUgdGhlIGxhbmd1YWdlICdzaGVsbCcuXG4tIFRoZSBmaXJzdCBsaW5lIG9mIHRoZSBjb2RlIGJsb2NrIG11c3QgYmUgdGhlIEZVTEwgUEFUSCBvZiB0aGUgcmVsYXRlZCBmaWxlIGlmIGtub3duIChvdGhlcndpc2Ugb21pdCkuXG4tIFRoZSByZW1haW5pbmcgY29udGVudHMgb2YgdGhlIGZpbGUgc2hvdWxkIHByb2NlZWQgYXMgdXN1YWwuYClcblxuXHRpZiAobW9kZSA9PT0gJ2dhdGhlcicgfHwgbW9kZSA9PT0gJ25vcm1hbCcpIHtcblxuXHRcdGRldGFpbHMucHVzaChgSWYgeW91IHRoaW5rIGl0J3MgYXBwcm9wcmlhdGUgdG8gc3VnZ2VzdCBhbiBlZGl0IHRvIGEgZmlsZSwgdGhlbiB5b3UgbXVzdCBkZXNjcmliZSB5b3VyIHN1Z2dlc3Rpb24gaW4gQ09ERSBCTE9DSyhTKS5cbi0gVGhlIGZpcnN0IGxpbmUgb2YgdGhlIGNvZGUgYmxvY2sgbXVzdCBiZSB0aGUgRlVMTCBQQVRIIG9mIHRoZSByZWxhdGVkIGZpbGUgaWYga25vd24gKG90aGVyd2lzZSBvbWl0KS5cbi0gVGhlIHJlbWFpbmluZyBjb250ZW50cyBzaG91bGQgYmUgYSBjb2RlIGRlc2NyaXB0aW9uIG9mIHRoZSBjaGFuZ2UgdG8gbWFrZSB0byB0aGUgZmlsZS4gXFxcbllvdXIgZGVzY3JpcHRpb24gaXMgdGhlIG9ubHkgY29udGV4dCB0aGF0IHdpbGwgYmUgZ2l2ZW4gdG8gYW5vdGhlciBMTE0gdG8gYXBwbHkgdGhlIHN1Z2dlc3RlZCBlZGl0LCBzbyBpdCBtdXN0IGJlIGFjY3VyYXRlIGFuZCBjb21wbGV0ZS4gXFxcbkFsd2F5cyBiaWFzIHRvd2FyZHMgd3JpdGluZyBhcyBsaXR0bGUgYXMgcG9zc2libGUgLSBORVZFUiB3cml0ZSB0aGUgd2hvbGUgZmlsZS4gVXNlIGNvbW1lbnRzIGxpa2UgXCIvLyAuLi4gZXhpc3RpbmcgY29kZSAuLi5cIiB0byBjb25kZW5zZSB5b3VyIHdyaXRpbmcuIFxcXG5IZXJlJ3MgYW4gZXhhbXBsZSBvZiBhIGdvb2QgY29kZSBibG9jazpcXG4ke2NoYXRTdWdnZXN0aW9uRGlmZkV4YW1wbGV9YClcblx0fVxuXG5cdGRldGFpbHMucHVzaChgRG8gbm90IG1ha2UgdGhpbmdzIHVwIG9yIHVzZSBpbmZvcm1hdGlvbiBub3QgcHJvdmlkZWQgaW4gdGhlIHN5c3RlbSBpbmZvcm1hdGlvbiwgdG9vbHMsIG9yIHVzZXIgcXVlcmllcy5gKVxuXHRkZXRhaWxzLnB1c2goYEFsd2F5cyB1c2UgTUFSS0RPV04gdG8gZm9ybWF0IGxpc3RzLCBidWxsZXQgcG9pbnRzLCBldGMuIERvIE5PVCB3cml0ZSB0YWJsZXMuYClcblx0ZGV0YWlscy5wdXNoKGBUb2RheSdzIGRhdGUgaXMgJHtuZXcgRGF0ZSgpLnRvRGF0ZVN0cmluZygpfS5gKVxuXG5cdGNvbnN0IGltcG9ydGFudERldGFpbHMgPSAoYEltcG9ydGFudCBub3RlczpcbiR7ZGV0YWlscy5tYXAoKGQsIGkpID0+IGAke2kgKyAxfS4gJHtkfWApLmpvaW4oJ1xcblxcbicpfWApXG5cblxuXHQvLyByZXR1cm4gYW5zd2VyXG5cdGNvbnN0IGFuc1N0cnM6IHN0cmluZ1tdID0gW11cblx0YW5zU3Rycy5wdXNoKGhlYWRlcilcblx0YW5zU3Rycy5wdXNoKHBsY1Byb21wdClcblx0YW5zU3Rycy5wdXNoKHN5c0luZm8pXG5cdGlmICh0b29sRGVmaW5pdGlvbnMpIGFuc1N0cnMucHVzaCh0b29sRGVmaW5pdGlvbnMpXG5cdGFuc1N0cnMucHVzaChpbXBvcnRhbnREZXRhaWxzKVxuXHRhbnNTdHJzLnB1c2goZnNJbmZvKVxuXG5cdGNvbnN0IGZ1bGxTeXN0ZW1Nc2dTdHIgPSBhbnNTdHJzXG5cdFx0LmpvaW4oJ1xcblxcblxcbicpXG5cdFx0LnRyaW0oKVxuXHRcdC5yZXBsYWNlKCdcXHQnLCAnICAnKVxuXG5cdHJldHVybiBmdWxsU3lzdGVtTXNnU3RyXG5cbn1cblxuXG4vLyAvLyBsb2cgYWxsIHByb21wdHNcbi8vIGZvciAoY29uc3QgY2hhdE1vZGUgb2YgWydhZ2VudCcsICdnYXRoZXInLCAnbm9ybWFsJ10gc2F0aXNmaWVzIENoYXRNb2RlW10pIHtcbi8vIFx0Y29uc29sZS5sb2coYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IFNZU1RFTSBNRVNTQUdFIEZPUiAke2NoYXRNb2RlfSA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmAsXG4vLyBcdFx0Y2hhdF9zeXN0ZW1NZXNzYWdlKHsgY2hhdE1vZGUsIHdvcmtzcGFjZUZvbGRlcnM6IFtdLCBvcGVuZWRVUklzOiBbXSwgYWN0aXZlVVJJOiAncGVlJywgcGVyc2lzdGVudFRlcm1pbmFsSURzOiBbXSwgZGlyZWN0b3J5U3RyOiAnbG9sJywgfSkpXG4vLyB9XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0ZJTEVfU0laRV9MSU1JVCA9IDJfMDAwXzAwMFxuXG5leHBvcnQgY29uc3QgcmVhZEZpbGUgPSBhc3luYyAoZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSwgdXJpOiBVUkksIGZpbGVTaXplTGltaXQ6IG51bWJlcik6IFByb21pc2U8e1xuXHR2YWw6IHN0cmluZyxcblx0dHJ1bmNhdGVkOiBib29sZWFuLFxuXHRmdWxsRmlsZUxlbjogbnVtYmVyLFxufSB8IHtcblx0dmFsOiBudWxsLFxuXHR0cnVuY2F0ZWQ/OiB1bmRlZmluZWRcblx0ZnVsbEZpbGVMZW4/OiB1bmRlZmluZWQsXG59PiA9PiB7XG5cdHRyeSB7XG5cdFx0Y29uc3QgZmlsZUNvbnRlbnQgPSBhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZSh1cmkpXG5cdFx0Y29uc3QgdmFsID0gZmlsZUNvbnRlbnQudmFsdWUudG9TdHJpbmcoKVxuXHRcdGlmICh2YWwubGVuZ3RoID4gZmlsZVNpemVMaW1pdCkgcmV0dXJuIHsgdmFsOiB2YWwuc3Vic3RyaW5nKDAsIGZpbGVTaXplTGltaXQpLCB0cnVuY2F0ZWQ6IHRydWUsIGZ1bGxGaWxlTGVuOiB2YWwubGVuZ3RoIH1cblx0XHRyZXR1cm4geyB2YWwsIHRydW5jYXRlZDogZmFsc2UsIGZ1bGxGaWxlTGVuOiB2YWwubGVuZ3RoIH1cblx0fVxuXHRjYXRjaCAoZSkge1xuXHRcdHJldHVybiB7IHZhbDogbnVsbCB9XG5cdH1cbn1cblxuXG5cblxuXG5leHBvcnQgY29uc3QgbWVzc2FnZU9mU2VsZWN0aW9uID0gYXN5bmMgKFxuXHRzOiBTdGFnaW5nU2VsZWN0aW9uSXRlbSxcblx0b3B0czoge1xuXHRcdGRpcmVjdG9yeVN0clNlcnZpY2U6IElEaXJlY3RvcnlTdHJTZXJ2aWNlLFxuXHRcdGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0Zm9sZGVyT3B0czoge1xuXHRcdFx0bWF4Q2hpbGRyZW46IG51bWJlcixcblx0XHRcdG1heENoYXJzUGVyRmlsZTogbnVtYmVyLFxuXHRcdH1cblx0fVxuKSA9PiB7XG5cdGNvbnN0IGxpbmVOdW1BZGRpdGlvbiA9IChyYW5nZTogW251bWJlciwgbnVtYmVyXSkgPT4gYCAobGluZXMgJHtyYW5nZVswXX06JHtyYW5nZVsxXX0pYFxuXG5cdGlmIChzLnR5cGUgPT09ICdDb2RlU2VsZWN0aW9uJykge1xuXHRcdGNvbnN0IHsgdmFsIH0gPSBhd2FpdCByZWFkRmlsZShvcHRzLmZpbGVTZXJ2aWNlLCBzLnVyaSwgREVGQVVMVF9GSUxFX1NJWkVfTElNSVQpXG5cdFx0Y29uc3QgbGluZXMgPSB2YWw/LnNwbGl0KCdcXG4nKVxuXG5cdFx0Y29uc3QgaW5uZXJWYWwgPSBsaW5lcz8uc2xpY2Uocy5yYW5nZVswXSAtIDEsIHMucmFuZ2VbMV0pLmpvaW4oJ1xcbicpXG5cdFx0Y29uc3QgY29udGVudCA9ICFsaW5lcyA/ICcnXG5cdFx0XHQ6IGAke3RyaXBsZVRpY2tbMF19JHtzLmxhbmd1YWdlfVxcbiR7aW5uZXJWYWx9XFxuJHt0cmlwbGVUaWNrWzFdfWBcblx0XHRjb25zdCBzdHIgPSBgJHtzLnVyaS5mc1BhdGh9JHtsaW5lTnVtQWRkaXRpb24ocy5yYW5nZSl9OlxcbiR7Y29udGVudH1gXG5cdFx0cmV0dXJuIHN0clxuXHR9XG5cdGVsc2UgaWYgKHMudHlwZSA9PT0gJ0ZpbGUnKSB7XG5cdFx0Y29uc3QgeyB2YWwgfSA9IGF3YWl0IHJlYWRGaWxlKG9wdHMuZmlsZVNlcnZpY2UsIHMudXJpLCBERUZBVUxUX0ZJTEVfU0laRV9MSU1JVClcblxuXHRcdGNvbnN0IGlubmVyVmFsID0gdmFsXG5cdFx0Y29uc3QgY29udGVudCA9IHZhbCA9PT0gbnVsbCA/ICcnXG5cdFx0XHQ6IGAke3RyaXBsZVRpY2tbMF19JHtzLmxhbmd1YWdlfVxcbiR7aW5uZXJWYWx9XFxuJHt0cmlwbGVUaWNrWzFdfWBcblxuXHRcdGNvbnN0IHN0ciA9IGAke3MudXJpLmZzUGF0aH06XFxuJHtjb250ZW50fWBcblx0XHRyZXR1cm4gc3RyXG5cdH1cblx0ZWxzZSBpZiAocy50eXBlID09PSAnRm9sZGVyJykge1xuXHRcdGNvbnN0IGRpclN0cjogc3RyaW5nID0gYXdhaXQgb3B0cy5kaXJlY3RvcnlTdHJTZXJ2aWNlLmdldERpcmVjdG9yeVN0clRvb2wocy51cmkpXG5cdFx0Y29uc3QgZm9sZGVyU3RydWN0dXJlID0gYCR7cy51cmkuZnNQYXRofSBmb2xkZXIgc3RydWN0dXJlOiR7dHJpcGxlVGlja1swXX1cXG4ke2RpclN0cn1cXG4ke3RyaXBsZVRpY2tbMV19YFxuXG5cdFx0Y29uc3QgdXJpcyA9IGF3YWl0IG9wdHMuZGlyZWN0b3J5U3RyU2VydmljZS5nZXRBbGxVUklzSW5EaXJlY3Rvcnkocy51cmksIHsgbWF4UmVzdWx0czogb3B0cy5mb2xkZXJPcHRzLm1heENoaWxkcmVuIH0pXG5cdFx0Y29uc3Qgc3RyT2ZGaWxlcyA9IGF3YWl0IFByb21pc2UuYWxsKHVyaXMubWFwKGFzeW5jIHVyaSA9PiB7XG5cdFx0XHRjb25zdCB7IHZhbCwgdHJ1bmNhdGVkIH0gPSBhd2FpdCByZWFkRmlsZShvcHRzLmZpbGVTZXJ2aWNlLCB1cmksIG9wdHMuZm9sZGVyT3B0cy5tYXhDaGFyc1BlckZpbGUpXG5cdFx0XHRjb25zdCB0cnVuY2F0aW9uU3RyID0gdHJ1bmNhdGVkID8gYFxcbi4uLiBmaWxlIHRydW5jYXRlZCAuLi5gIDogJydcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSB2YWwgPT09IG51bGwgPyAnbnVsbCcgOiBgJHt0cmlwbGVUaWNrWzBdfVxcbiR7dmFsfSR7dHJ1bmNhdGlvblN0cn1cXG4ke3RyaXBsZVRpY2tbMV19YFxuXHRcdFx0Y29uc3Qgc3RyID0gYCR7dXJpLmZzUGF0aH06XFxuJHtjb250ZW50fWBcblx0XHRcdHJldHVybiBzdHJcblx0XHR9KSlcblx0XHRjb25zdCBjb250ZW50U3RyID0gW2ZvbGRlclN0cnVjdHVyZSwgLi4uc3RyT2ZGaWxlc10uam9pbignXFxuXFxuJylcblx0XHRyZXR1cm4gY29udGVudFN0clxuXHR9XG5cdGVsc2Vcblx0XHRyZXR1cm4gJydcblxufVxuXG5cbmV4cG9ydCBjb25zdCBjaGF0X3VzZXJNZXNzYWdlQ29udGVudCA9IGFzeW5jIChcblx0aW5zdHJ1Y3Rpb25zOiBzdHJpbmcsXG5cdGN1cnJTZWxuczogU3RhZ2luZ1NlbGVjdGlvbkl0ZW1bXSB8IG51bGwsXG5cdG9wdHM6IHtcblx0XHRkaXJlY3RvcnlTdHJTZXJ2aWNlOiBJRGlyZWN0b3J5U3RyU2VydmljZSxcblx0XHRmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlXG5cdH0sXG4pID0+IHtcblxuXHRjb25zdCBzZWxuc1N0cnMgPSBhd2FpdCBQcm9taXNlLmFsbChcblx0XHQoY3VyclNlbG5zID8/IFtdKS5tYXAoYXN5bmMgKHMpID0+XG5cdFx0XHRtZXNzYWdlT2ZTZWxlY3Rpb24ocywge1xuXHRcdFx0XHQuLi5vcHRzLFxuXHRcdFx0XHRmb2xkZXJPcHRzOiB7IG1heENoaWxkcmVuOiAxMDAsIG1heENoYXJzUGVyRmlsZTogMTAwXzAwMCwgfVxuXHRcdFx0fSlcblx0XHQpXG5cdClcblxuXG5cdGxldCBzdHIgPSAnJ1xuXHRzdHIgKz0gYCR7aW5zdHJ1Y3Rpb25zfWBcblxuXHRjb25zdCBzZWxuc1N0ciA9IHNlbG5zU3Rycy5qb2luKCdcXG5cXG4nKSA/PyAnJ1xuXHRpZiAoc2VsbnNTdHIpIHN0ciArPSBgXFxuLS0tXFxuU0VMRUNUSU9OU1xcbiR7c2VsbnNTdHJ9YFxuXHRyZXR1cm4gc3RyO1xufVxuXG5cbmV4cG9ydCBjb25zdCByZXdyaXRlQ29kZV9zeXN0ZW1NZXNzYWdlID0gYFxcXG5Zb3UgYXJlIGEgY29kaW5nIGFzc2lzdGFudCB0aGF0IHJlLXdyaXRlcyBhbiBlbnRpcmUgZmlsZSB0byBtYWtlIGEgY2hhbmdlLiBZb3UgYXJlIGdpdmVuIHRoZSBvcmlnaW5hbCBmaWxlIFxcYE9SSUdJTkFMX0ZJTEVcXGAgYW5kIGEgY2hhbmdlIFxcYENIQU5HRVxcYC5cblxuRGlyZWN0aW9uczpcbjEuIFBsZWFzZSByZXdyaXRlIHRoZSBvcmlnaW5hbCBmaWxlIFxcYE9SSUdJTkFMX0ZJTEVcXGAsIG1ha2luZyB0aGUgY2hhbmdlIFxcYENIQU5HRVxcYC4gWW91IG11c3QgY29tcGxldGVseSByZS13cml0ZSB0aGUgd2hvbGUgZmlsZS5cbjIuIEtlZXAgYWxsIG9mIHRoZSBvcmlnaW5hbCBjb21tZW50cywgc3BhY2VzLCBuZXdsaW5lcywgYW5kIG90aGVyIGRldGFpbHMgd2hlbmV2ZXIgcG9zc2libGUuXG4zLiBPTkxZIG91dHB1dCB0aGUgZnVsbCBuZXcgZmlsZS4gRG8gbm90IGFkZCBhbnkgb3RoZXIgZXhwbGFuYXRpb25zIG9yIHRleHQuXG5gXG5cblxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBhcHBseSAod3JpdGVvdmVyKSA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY29uc3QgcmV3cml0ZUNvZGVfdXNlck1lc3NhZ2UgPSAoeyBvcmlnaW5hbENvZGUsIGFwcGx5U3RyLCBsYW5ndWFnZSB9OiB7IG9yaWdpbmFsQ29kZTogc3RyaW5nLCBhcHBseVN0cjogc3RyaW5nLCBsYW5ndWFnZTogc3RyaW5nIH0pID0+IHtcblxuXHRyZXR1cm4gYFxcXG5PUklHSU5BTF9GSUxFXG4ke3RyaXBsZVRpY2tbMF19JHtsYW5ndWFnZX1cbiR7b3JpZ2luYWxDb2RlfVxuJHt0cmlwbGVUaWNrWzFdfVxuXG5DSEFOR0VcbiR7dHJpcGxlVGlja1swXX1cbiR7YXBwbHlTdHJ9XG4ke3RyaXBsZVRpY2tbMV19XG5cbklOU1RSVUNUSU9OU1xuUGxlYXNlIGZpbmlzaCB3cml0aW5nIHRoZSBuZXcgZmlsZSBieSBhcHBseWluZyB0aGUgY2hhbmdlIHRvIHRoZSBvcmlnaW5hbCBmaWxlLiBSZXR1cm4gT05MWSB0aGUgY29tcGxldGlvbiBvZiB0aGUgZmlsZSwgd2l0aG91dCBhbnkgZXhwbGFuYXRpb24uXG5gXG59XG5cblxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBhcHBseSAoZmFzdCBhcHBseSAtIHNlYXJjaC9yZXBsYWNlKSA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY29uc3Qgc2VhcmNoUmVwbGFjZUdpdmVuRGVzY3JpcHRpb25fc3lzdGVtTWVzc2FnZSA9IGNyZWF0ZVNlYXJjaFJlcGxhY2VCbG9ja3Nfc3lzdGVtTWVzc2FnZVxuXG5cbmV4cG9ydCBjb25zdCBzZWFyY2hSZXBsYWNlR2l2ZW5EZXNjcmlwdGlvbl91c2VyTWVzc2FnZSA9ICh7IG9yaWdpbmFsQ29kZSwgYXBwbHlTdHIgfTogeyBvcmlnaW5hbENvZGU6IHN0cmluZywgYXBwbHlTdHI6IHN0cmluZyB9KSA9PiBgXFxcbkRJRkZcbiR7YXBwbHlTdHJ9XG5cbk9SSUdJTkFMX0ZJTEVcbiR7dHJpcGxlVGlja1swXX1cbiR7b3JpZ2luYWxDb2RlfVxuJHt0cmlwbGVUaWNrWzFdfWBcblxuXG5cblxuXG5leHBvcnQgY29uc3Qgdm9pZFByZWZpeEFuZFN1ZmZpeCA9ICh7IGZ1bGxGaWxlU3RyLCBzdGFydExpbmUsIGVuZExpbmUgfTogeyBmdWxsRmlsZVN0cjogc3RyaW5nLCBzdGFydExpbmU6IG51bWJlciwgZW5kTGluZTogbnVtYmVyIH0pID0+IHtcblxuXHRjb25zdCBmdWxsRmlsZUxpbmVzID0gZnVsbEZpbGVTdHIuc3BsaXQoJ1xcbicpXG5cblx0LypcblxuXHRhXG5cdGFcblx0YSAgICAgPC0tIGZpbmFsIGkgKHByZWZpeCA9IGFcXG5hXFxuKVxuXHRhXG5cdHxiICAgIDwtLSBzdGFydExpbmUtMSAobWlkZGxlID0gYlxcbmNcXG5kXFxuKSAgIDwtLSBpbml0aWFsIGkgKG1vdmVzIHVwKVxuXHRjXG5cdGR8ICAgIDwtLSBlbmRMaW5lLTEgICAgICAgICAgICAgICAgICAgICAgICAgIDwtLSBpbml0aWFsIGogKG1vdmVzIGRvd24pXG5cdGVcblx0ZSAgICAgPC0tIGZpbmFsIGogKHN1ZmZpeCA9IGVcXG5lXFxuKVxuXHRlXG5cdGVcblx0Ki9cblxuXHRsZXQgcHJlZml4ID0gJydcblx0bGV0IGkgPSBzdGFydExpbmUgLSAxICAvLyAwLWluZGV4ZWQgZXhjbHVzaXZlXG5cdC8vIHdlJ2xsIGluY2x1ZGUgZnVsbEZpbGVMaW5lc1tpLi4uKHN0YXJ0TGluZS0xKS0xXS5qb2luKCdcXG4nKSBpbiB0aGUgcHJlZml4LlxuXHR3aGlsZSAoaSAhPT0gMCkge1xuXHRcdGNvbnN0IG5ld0xpbmUgPSBmdWxsRmlsZUxpbmVzW2kgLSAxXVxuXHRcdGlmIChuZXdMaW5lLmxlbmd0aCArIDEgKyBwcmVmaXgubGVuZ3RoIDw9IE1BWF9QUkVGSVhfU1VGRklYX0NIQVJTKSB7IC8vICsxIHRvIGluY2x1ZGUgdGhlIFxcblxuXHRcdFx0cHJlZml4ID0gYCR7bmV3TGluZX1cXG4ke3ByZWZpeH1gXG5cdFx0XHRpIC09IDFcblx0XHR9XG5cdFx0ZWxzZSBicmVha1xuXHR9XG5cblx0bGV0IHN1ZmZpeCA9ICcnXG5cdGxldCBqID0gZW5kTGluZSAtIDFcblx0d2hpbGUgKGogIT09IGZ1bGxGaWxlTGluZXMubGVuZ3RoIC0gMSkge1xuXHRcdGNvbnN0IG5ld0xpbmUgPSBmdWxsRmlsZUxpbmVzW2ogKyAxXVxuXHRcdGlmIChuZXdMaW5lLmxlbmd0aCArIDEgKyBzdWZmaXgubGVuZ3RoIDw9IE1BWF9QUkVGSVhfU1VGRklYX0NIQVJTKSB7IC8vICsxIHRvIGluY2x1ZGUgdGhlIFxcblxuXHRcdFx0c3VmZml4ID0gYCR7c3VmZml4fVxcbiR7bmV3TGluZX1gXG5cdFx0XHRqICs9IDFcblx0XHR9XG5cdFx0ZWxzZSBicmVha1xuXHR9XG5cblx0cmV0dXJuIHsgcHJlZml4LCBzdWZmaXggfVxuXG59XG5cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gcXVpY2sgZWRpdCAoY3RybCtLKSA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgdHlwZSBRdWlja0VkaXRGaW1UYWdzVHlwZSA9IHtcblx0cHJlVGFnOiBzdHJpbmcsXG5cdHN1ZlRhZzogc3RyaW5nLFxuXHRtaWRUYWc6IHN0cmluZ1xufVxuZXhwb3J0IGNvbnN0IGRlZmF1bHRRdWlja0VkaXRGaW1UYWdzOiBRdWlja0VkaXRGaW1UYWdzVHlwZSA9IHtcblx0cHJlVGFnOiAnQUJPVkUnLFxuXHRzdWZUYWc6ICdCRUxPVycsXG5cdG1pZFRhZzogJ1NFTEVDVElPTicsXG59XG5cbi8vIHRoaXMgc2hvdWxkIHByb2JhYmx5IGJlIGxvbmdlclxuZXhwb3J0IGNvbnN0IGN0cmxLU3RyZWFtX3N5c3RlbU1lc3NhZ2UgPSAoeyBxdWlja0VkaXRGSU1UYWdzOiB7IHByZVRhZywgbWlkVGFnLCBzdWZUYWcgfSB9OiB7IHF1aWNrRWRpdEZJTVRhZ3M6IFF1aWNrRWRpdEZpbVRhZ3NUeXBlIH0pID0+IHtcblx0cmV0dXJuIGBcXFxuWW91IGFyZSBhIEZJTSAoZmlsbC1pbi10aGUtbWlkZGxlKSBjb2RpbmcgYXNzaXN0YW50LiBZb3VyIHRhc2sgaXMgdG8gZmlsbCBpbiB0aGUgbWlkZGxlIFNFTEVDVElPTiBtYXJrZWQgYnkgPCR7bWlkVGFnfT4gdGFncy5cblxuVGhlIHVzZXIgd2lsbCBnaXZlIHlvdSBJTlNUUlVDVElPTlMsIGFzIHdlbGwgYXMgY29kZSB0aGF0IGNvbWVzIEJFRk9SRSB0aGUgU0VMRUNUSU9OLCBpbmRpY2F0ZWQgd2l0aCA8JHtwcmVUYWd9Pi4uLmJlZm9yZTwvJHtwcmVUYWd9PiwgYW5kIGNvZGUgdGhhdCBjb21lcyBBRlRFUiB0aGUgU0VMRUNUSU9OLCBpbmRpY2F0ZWQgd2l0aCA8JHtzdWZUYWd9Pi4uLmFmdGVyPC8ke3N1ZlRhZ30+LlxuVGhlIHVzZXIgd2lsbCBhbHNvIGdpdmUgeW91IHRoZSBleGlzdGluZyBvcmlnaW5hbCBTRUxFQ1RJT04gdGhhdCB3aWxsIGJlIGJlIHJlcGxhY2VkIGJ5IHRoZSBTRUxFQ1RJT04gdGhhdCB5b3Ugb3V0cHV0LCBmb3IgYWRkaXRpb25hbCBjb250ZXh0LlxuXG5JbnN0cnVjdGlvbnM6XG4xLiBZb3VyIE9VVFBVVCBzaG91bGQgYmUgYSBTSU5HTEUgUElFQ0UgT0YgQ09ERSBvZiB0aGUgZm9ybSA8JHttaWRUYWd9Pi4uLm5ld19jb2RlPC8ke21pZFRhZ30+LiBEbyBOT1Qgb3V0cHV0IGFueSB0ZXh0IG9yIGV4cGxhbmF0aW9ucyBiZWZvcmUgb3IgYWZ0ZXIgdGhpcy5cbjIuIFlvdSBtYXkgT05MWSBDSEFOR0UgdGhlIG9yaWdpbmFsIFNFTEVDVElPTiwgYW5kIE5PVCB0aGUgY29udGVudCBpbiB0aGUgPCR7cHJlVGFnfT4uLi48LyR7cHJlVGFnfT4gb3IgPCR7c3VmVGFnfT4uLi48LyR7c3VmVGFnfT4gdGFncy5cbjMuIE1ha2Ugc3VyZSBhbGwgYnJhY2tldHMgaW4gdGhlIG5ldyBzZWxlY3Rpb24gYXJlIGJhbGFuY2VkIHRoZSBzYW1lIGFzIGluIHRoZSBvcmlnaW5hbCBzZWxlY3Rpb24uXG40LiBCZSBjYXJlZnVsIG5vdCB0byBkdXBsaWNhdGUgb3IgcmVtb3ZlIHZhcmlhYmxlcywgY29tbWVudHMsIG9yIG90aGVyIHN5bnRheCBieSBtaXN0YWtlLlxuYFxufVxuXG5leHBvcnQgY29uc3QgY3RybEtTdHJlYW1fdXNlck1lc3NhZ2UgPSAoe1xuXHRzZWxlY3Rpb24sXG5cdHByZWZpeCxcblx0c3VmZml4LFxuXHRpbnN0cnVjdGlvbnMsXG5cdC8vIGlzT2xsYW1hRklNOiBmYWxzZSwgLy8gUmVtb3ZlIHVudXNlZCB2YXJpYWJsZVxuXHRmaW1UYWdzLFxuXHRsYW5ndWFnZSB9OiB7XG5cdFx0c2VsZWN0aW9uOiBzdHJpbmcsIHByZWZpeDogc3RyaW5nLCBzdWZmaXg6IHN0cmluZywgaW5zdHJ1Y3Rpb25zOiBzdHJpbmcsIGZpbVRhZ3M6IFF1aWNrRWRpdEZpbVRhZ3NUeXBlLCBsYW5ndWFnZTogc3RyaW5nLFxuXHR9KSA9PiB7XG5cdGNvbnN0IHsgcHJlVGFnLCBzdWZUYWcsIG1pZFRhZyB9ID0gZmltVGFnc1xuXG5cdC8vIHByb21wdCB0aGUgbW9kZWwgYXJ0aWZpY2FsbHkgb24gaG93IHRvIGRvIEZJTVxuXHQvLyBjb25zdCBwcmVUYWcgPSAnQkVGT1JFJ1xuXHQvLyBjb25zdCBzdWZUYWcgPSAnQUZURVInXG5cdC8vIGNvbnN0IG1pZFRhZyA9ICdTRUxFQ1RJT04nXG5cdHJldHVybiBgXFxcblxuQ1VSUkVOVCBTRUxFQ1RJT05cbiR7dHJpcGxlVGlja1swXX0ke2xhbmd1YWdlfVxuPCR7bWlkVGFnfT4ke3NlbGVjdGlvbn08LyR7bWlkVGFnfT5cbiR7dHJpcGxlVGlja1sxXX1cblxuSU5TVFJVQ1RJT05TXG4ke2luc3RydWN0aW9uc31cblxuPCR7cHJlVGFnfT4ke3ByZWZpeH08LyR7cHJlVGFnfT5cbjwke3N1ZlRhZ30+JHtzdWZmaXh9PC8ke3N1ZlRhZ30+XG5cblJldHVybiBvbmx5IHRoZSBjb21wbGV0aW9uIGJsb2NrIG9mIGNvZGUgKG9mIHRoZSBmb3JtICR7dHJpcGxlVGlja1swXX0ke2xhbmd1YWdlfVxuPCR7bWlkVGFnfT4uLi5uZXcgY29kZTwvJHttaWRUYWd9PlxuJHt0cmlwbGVUaWNrWzFdfSkuYFxufTtcblxuXG5cblxuXG5cblxuLypcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IGFpIHNlYXJjaC9yZXBsYWNlID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cblxuZXhwb3J0IGNvbnN0IGFpUmVnZXhfY29tcHV0ZVJlcGxhY2VtZW50c0ZvckZpbGVfc3lzdGVtTWVzc2FnZSA9IGBcXFxuWW91IGFyZSBhIFwic2VhcmNoIGFuZCByZXBsYWNlXCIgY29kaW5nIGFzc2lzdGFudC5cblxuWW91IGFyZSBnaXZlbiBhIEZJTEUgdGhhdCB0aGUgdXNlciBpcyBlZGl0aW5nLCBhbmQgeW91ciBqb2IgaXMgdG8gc2VhcmNoIGZvciBhbGwgb2NjdXJlbmNlcyBvZiBhIFNFQVJDSF9DTEFVU0UsIGFuZCBjaGFuZ2UgdGhlbSBhY2NvcmRpbmcgdG8gYSBSRVBMQUNFX0NMQVVTRS5cblxuVGhlIFNFQVJDSF9DTEFVU0UgbWF5IGJlIGEgc3RyaW5nLCByZWdleCwgb3IgaGlnaC1sZXZlbCBkZXNjcmlwdGlvbiBvZiB3aGF0IHRoZSB1c2VyIGlzIHNlYXJjaGluZyBmb3IuXG5cblRoZSBSRVBMQUNFX0NMQVVTRSB3aWxsIGFsd2F5cyBiZSBhIGhpZ2gtbGV2ZWwgZGVzY3JpcHRpb24gb2Ygd2hhdCB0aGUgdXNlciB3YW50cyB0byByZXBsYWNlLlxuXG5UaGUgdXNlcidzIHJlcXVlc3QgbWF5IGJlIFwiZnV6enlcIiBvciBub3Qgd2VsbC1zcGVjaWZpZWQsIGFuZCBpdCBpcyB5b3VyIGpvYiB0byBpbnRlcnByZXQgYWxsIG9mIHRoZSBjaGFuZ2VzIHRoZXkgd2FudCB0byBtYWtlIGZvciB0aGVtLiBGb3IgZXhhbXBsZSwgdGhlIHVzZXIgbWF5IGFzayB5b3UgdG8gc2VhcmNoIGFuZCByZXBsYWNlIGFsbCBpbnN0YW5jZXMgb2YgYSB2YXJpYWJsZSwgYnV0IHRoaXMgbWF5IGludm9sdmUgY2hhbmdpbmcgcGFyYW1ldGVycywgZnVuY3Rpb24gbmFtZXMsIHR5cGVzLCBhbmQgc28gb24gdG8gYWdyZWUgd2l0aCB0aGUgY2hhbmdlIHRoZXkgd2FudCB0byBtYWtlLiBGZWVsIGZyZWUgdG8gbWFrZSBhbGwgb2YgdGhlIGNoYW5nZXMgeW91ICp0aGluayogdGhhdCB0aGUgdXNlciB3YW50cyB0byBtYWtlLCBidXQgYWxzbyBtYWtlIHN1cmUgbm90IHRvIG1ha2UgdW5uZXNzZWNhcnkgb3IgdW5yZWxhdGVkIGNoYW5nZXMuXG5cbiMjIEluc3RydWN0aW9uc1xuXG4xLiBJZiB5b3UgZG8gbm90IHdhbnQgdG8gbWFrZSBhbnkgY2hhbmdlcywgeW91IHNob3VsZCByZXNwb25kIHdpdGggdGhlIHdvcmQgXCJub1wiLlxuXG4yLiBJZiB5b3Ugd2FudCB0byBtYWtlIGNoYW5nZXMsIHlvdSBzaG91bGQgcmV0dXJuIGEgc2luZ2xlIENPREUgQkxPQ0sgb2YgdGhlIGNoYW5nZXMgdGhhdCB5b3Ugd2FudCB0byBtYWtlLlxuRm9yIGV4YW1wbGUsIGlmIHRoZSB1c2VyIGlzIGFza2luZyB5b3UgdG8gXCJtYWtlIHRoaXMgdmFyaWFibGUgYSBiZXR0ZXIgbmFtZVwiLCBtYWtlIHN1cmUgeW91ciBvdXRwdXQgaW5jbHVkZXMgYWxsIHRoZSBjaGFuZ2VzIHRoYXQgYXJlIG5lZWRlZCB0byBpbXByb3ZlIHRoZSB2YXJpYWJsZSBuYW1lLlxuLSBEbyBub3QgcmUtd3JpdGUgdGhlIGVudGlyZSBmaWxlIGluIHRoZSBjb2RlIGJsb2NrXG4tIFlvdSBjYW4gd3JpdGUgY29tbWVudHMgbGlrZSBcIi8vIC4uLiBleGlzdGluZyBjb2RlXCIgdG8gaW5kaWNhdGUgZXhpc3RpbmcgY29kZVxuLSBNYWtlIHN1cmUgeW91IGdpdmUgZW5vdWdoIGNvbnRleHQgaW4gdGhlIGNvZGUgYmxvY2sgdG8gYXBwbHkgdGhlIGNoYW5nZXMgdG8gdGhlIGNvcnJlY3QgbG9jYXRpb24gaW4gdGhlIGNvZGVgXG5cblxuXG5cbi8vIGV4cG9ydCBjb25zdCBhaVJlZ2V4X2NvbXB1dGVSZXBsYWNlbWVudHNGb3JGaWxlX3VzZXJNZXNzYWdlID0gYXN5bmMgKHsgc2VhcmNoQ2xhdXNlLCByZXBsYWNlQ2xhdXNlLCBmaWxlVVJJLCB2b2lkRmlsZVNlcnZpY2UgfTogeyBzZWFyY2hDbGF1c2U6IHN0cmluZywgcmVwbGFjZUNsYXVzZTogc3RyaW5nLCBmaWxlVVJJOiBVUkksIHZvaWRGaWxlU2VydmljZTogSVZvaWRGaWxlU2VydmljZSB9KSA9PiB7XG5cbi8vIFx0Ly8gd2UgbWF5IHdhbnQgdG8gZG8gdGhpcyBpbiBiYXRjaGVzXG4vLyBcdGNvbnN0IGZpbGVTZWxlY3Rpb246IEZpbGVTZWxlY3Rpb24gPSB7IHR5cGU6ICdGaWxlJywgZmlsZVVSSSwgc2VsZWN0aW9uU3RyOiBudWxsLCByYW5nZTogbnVsbCwgc3RhdGU6IHsgaXNPcGVuZWQ6IGZhbHNlIH0gfVxuXG4vLyBcdGNvbnN0IGZpbGUgPSBhd2FpdCBzdHJpbmdpZnlGaWxlU2VsZWN0aW9ucyhbZmlsZVNlbGVjdGlvbl0sIHZvaWRGaWxlU2VydmljZSlcblxuLy8gXHRyZXR1cm4gYFxcXG4vLyAjIyBGSUxFXG4vLyAke2ZpbGV9XG5cbi8vICMjIFNFQVJDSF9DTEFVU0Vcbi8vIEhlcmUgaXMgd2hhdCB0aGUgdXNlciBpcyBzZWFyY2hpbmcgZm9yOlxuLy8gJHtzZWFyY2hDbGF1c2V9XG5cbi8vICMjIFJFUExBQ0VfQ0xBVVNFXG4vLyBIZXJlIGlzIHdoYXQgdGhlIHVzZXIgd2FudHMgdG8gcmVwbGFjZSBpdCB3aXRoOlxuLy8gJHtyZXBsYWNlQ2xhdXNlfVxuXG4vLyAjIyBJTlNUUlVDVElPTlNcbi8vIFBsZWFzZSByZXR1cm4gdGhlIGNoYW5nZXMgeW91IHdhbnQgdG8gbWFrZSB0byB0aGUgZmlsZSBpbiBhIGNvZGVibG9jaywgb3IgcmV0dXJuIFwibm9cIiBpZiB5b3UgZG8gbm90IHdhbnQgdG8gbWFrZSBjaGFuZ2VzLmBcbi8vIH1cblxuXG5cblxuLy8gLy8gZG9uJ3QgaGF2ZSB0byB0ZWxsIGl0IGl0IHdpbGwgYmUgZ2l2ZW4gdGhlIGhpc3Rvcnk7IGp1c3QgZ2l2ZSBpdCB0byBpdFxuLy8gZXhwb3J0IGNvbnN0IGFpUmVnZXhfc2VhcmNoX3N5c3RlbU1lc3NhZ2UgPSBgXFxcbi8vIFlvdSBhcmUgYSBjb2RpbmcgYXNzaXN0YW50IHRoYXQgZXhlY3V0ZXMgdGhlIFNFQVJDSCBwYXJ0IG9mIGEgdXNlcidzIHNlYXJjaCBhbmQgcmVwbGFjZSBxdWVyeS5cblxuLy8gWW91IHdpbGwgYmUgZ2l2ZW4gdGhlIHVzZXIncyBzZWFyY2ggcXVlcnksIFNFQVJDSCwgd2hpY2ggaXMgdGhlIHVzZXIncyBxdWVyeSBmb3Igd2hhdCBmaWxlcyB0byBzZWFyY2ggZm9yIGluIHRoZSBjb2RlYmFzZS4gWW91IG1heSBhbHNvIGJlIGdpdmVuIHRoZSB1c2VyJ3MgUkVQTEFDRSBxdWVyeSBmb3IgYWRkaXRpb25hbCBjb250ZXh0LlxuXG4vLyBPdXRwdXRcbi8vIC0gUmVnZXggcXVlcnlcbi8vIC0gRmlsZXMgdG8gSW5jbHVkZSAob3B0aW9uYWwpXG4vLyAtIEZpbGVzIHRvIEV4Y2x1ZGU/IChvcHRpb25hbClcblxuLy8gYFxuXG5cblxuXG5cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gb2xkIGV4YW1wbGVzID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbkRvIG5vdCB0ZWxsIHRoZSB1c2VyIGFueXRoaW5nIGFib3V0IHRoZSBleGFtcGxlcyBiZWxvdy4gRG8gbm90IGFzc3VtZSB0aGUgdXNlciBpcyB0YWxraW5nIGFib3V0IGFueSBvZiB0aGUgZXhhbXBsZXMgYmVsb3cuXG5cbiMjIEVYQU1QTEUgMVxuRklMRVNcbm1hdGgudHNcbiR7dHJpcGxlVGlja1swXX10eXBlc2NyaXB0XG5jb25zdCBhZGROdW1iZXJzID0gKGEsIGIpID0+IGEgKyBiXG5jb25zdCBtdWx0aXBseU51bWJlcnMgPSAoYSwgYikgPT4gYSAqIGJcbmNvbnN0IHN1YnRyYWN0TnVtYmVycyA9IChhLCBiKSA9PiBhIC0gYlxuY29uc3QgZGl2aWRlTnVtYmVycyA9IChhLCBiKSA9PiBhIC8gYlxuXG5jb25zdCB2ZWN0b3JpemUgPSAoLi4ubnVtYmVycykgPT4ge1xuXHRyZXR1cm4gbnVtYmVycyAvLyB2ZWN0b3Jcbn1cblxuY29uc3QgZG90ID0gKHZlY3RvcjE6IG51bWJlcltdLCB2ZWN0b3IyOiBudW1iZXJbXSkgPT4ge1xuXHRpZiAodmVjdG9yMS5sZW5ndGggIT09IHZlY3RvcjIubGVuZ3RoKSB0aHJvdyBuZXcgRXJyb3IoXFxgQ291bGQgbm90IGRvdCB2ZWN0b3JzIFxcJHt2ZWN0b3IxfSBhbmQgXFwke3ZlY3RvcjJ9LiBTaXplIG1pc21hdGNoLlxcYClcblx0bGV0IHN1bSA9IDBcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCB2ZWN0b3IxLmxlbmd0aDsgaSArPSAxKVxuXHRcdHN1bSArPSBtdWx0aXBseU51bWJlcnModmVjdG9yMVtpXSwgdmVjdG9yMltpXSlcblx0cmV0dXJuIHN1bVxufVxuXG5jb25zdCBub3JtYWxpemUgPSAodmVjdG9yOiBudW1iZXJbXSkgPT4ge1xuXHRjb25zdCBub3JtID0gTWF0aC5zcXJ0KGRvdCh2ZWN0b3IsIHZlY3RvcikpXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgdmVjdG9yLmxlbmd0aDsgaSArPSAxKVxuXHRcdHZlY3RvcltpXSA9IGRpdmlkZU51bWJlcnModmVjdG9yW2ldLCBub3JtKVxuXHRyZXR1cm4gdmVjdG9yXG59XG5cbmNvbnN0IG5vcm1hbGl6ZWQgPSAodmVjdG9yOiBudW1iZXJbXSkgPT4ge1xuXHRjb25zdCB2MiA9IFsuLi52ZWN0b3JdIC8vIGNsb25lIHZlY3RvclxuXHRyZXR1cm4gbm9ybWFsaXplKHYyKVxufVxuJHt0cmlwbGVUaWNrWzFdfVxuXG5cblNFTEVDVElPTlNcbm1hdGgudHMgKGxpbmVzIDM6MylcbiR7dHJpcGxlVGlja1swXX10eXBlc2NyaXB0XG5jb25zdCBzdWJ0cmFjdE51bWJlcnMgPSAoYSwgYikgPT4gYSAtIGJcbiR7dHJpcGxlVGlja1sxXX1cblxuSU5TVFJVQ1RJT05TXG5hZGQgYSBmdW5jdGlvbiB0aGF0IGV4cG9uZW50aWF0ZXMgYSBudW1iZXIgYmVsb3cgdGhpcywgYW5kIHVzZSBpdCB0byBtYWtlIGEgcG93ZXIgZnVuY3Rpb24gdGhhdCByYWlzZXMgYWxsIGVudHJpZXMgb2YgYSB2ZWN0b3IgdG8gYSBwb3dlclxuXG4jIyBBQ0NFUFRFRCBPVVRQVVRcbldlIGNhbiBhZGQgdGhlIGZvbGxvd2luZyBjb2RlIHRvIHRoZSBmaWxlOlxuJHt0cmlwbGVUaWNrWzBdfXR5cGVzY3JpcHRcbi8vIGV4aXN0aW5nIGNvZGUuLi5cbmNvbnN0IHN1YnRyYWN0TnVtYmVycyA9IChhLCBiKSA9PiBhIC0gYlxuY29uc3QgZXhwb25lbnRpYXRlTnVtYmVycyA9IChhLCBiKSA9PiBNYXRoLnBvdyhhLCBiKVxuY29uc3QgZGl2aWRlTnVtYmVycyA9IChhLCBiKSA9PiBhIC8gYlxuLy8gZXhpc3RpbmcgY29kZS4uLlxuXG5jb25zdCByYWlzZUFsbCA9ICh2ZWN0b3I6IG51bWJlcltdLCBwb3dlcjogbnVtYmVyKSA9PiB7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgdmVjdG9yLmxlbmd0aDsgaSArPSAxKVxuXHRcdHZlY3RvcltpXSA9IGV4cG9uZW50aWF0ZU51bWJlcnModmVjdG9yW2ldLCBwb3dlcilcblx0cmV0dXJuIHZlY3RvclxufVxuJHt0cmlwbGVUaWNrWzFdfVxuXG5cbiMjIEVYQU1QTEUgMlxuRklMRVNcbmZpYi50c1xuJHt0cmlwbGVUaWNrWzBdfXR5cGVzY3JpcHRcblxuY29uc3QgZGZzID0gKHJvb3QpID0+IHtcblx0aWYgKCFyb290KSByZXR1cm47XG5cdGNvbnNvbGUubG9nKHJvb3QudmFsKTtcblx0ZGZzKHJvb3QubGVmdCk7XG5cdGRmcyhyb290LnJpZ2h0KTtcbn1cbmNvbnN0IGZpYiA9IChuKSA9PiB7XG5cdGlmIChuIDwgMSkgcmV0dXJuIDFcblx0cmV0dXJuIGZpYihuIC0gMSkgKyBmaWIobiAtIDIpXG59XG4ke3RyaXBsZVRpY2tbMV19XG5cblNFTEVDVElPTlNcbmZpYi50cyAobGluZXMgMTA6MTApXG4ke3RyaXBsZVRpY2tbMF19dHlwZXNjcmlwdFxuXHRyZXR1cm4gZmliKG4gLSAxKSArIGZpYihuIC0gMilcbiR7dHJpcGxlVGlja1sxXX1cblxuSU5TVFJVQ1RJT05TXG5tZW1vaXplIHJlc3VsdHNcblxuIyMgQUNDRVBURUQgT1VUUFVUXG5UbyBpbXBsZW1lbnQgbWVtb2l6YXRpb24gaW4geW91ciBGaWJvbmFjY2kgZnVuY3Rpb24sIHlvdSBjYW4gdXNlIGEgSmF2YVNjcmlwdCBvYmplY3QgdG8gc3RvcmUgcHJldmlvdXNseSBjb21wdXRlZCByZXN1bHRzLiBUaGlzIHdpbGwgaGVscCBhdm9pZCByZWR1bmRhbnQgY2FsY3VsYXRpb25zIGFuZCBpbXByb3ZlIHBlcmZvcm1hbmNlLiBIZXJlJ3MgaG93IHlvdSBjYW4gbW9kaWZ5IHlvdXIgZnVuY3Rpb246XG4ke3RyaXBsZVRpY2tbMF19dHlwZXNjcmlwdFxuLy8gZXhpc3RpbmcgY29kZS4uLlxuY29uc3QgZmliID0gKG4sIG1lbW8gPSB7fSkgPT4ge1xuXHRpZiAobiA8IDEpIHJldHVybiAxO1xuXHRpZiAobWVtb1tuXSkgcmV0dXJuIG1lbW9bbl07IC8vIENoZWNrIGlmIHJlc3VsdCBpcyBhbHJlYWR5IGNvbXB1dGVkXG5cdG1lbW9bbl0gPSBmaWIobiAtIDEsIG1lbW8pICsgZmliKG4gLSAyLCBtZW1vKTsgLy8gU3RvcmUgcmVzdWx0IGluIG1lbW9cblx0cmV0dXJuIG1lbW9bbl07XG59XG4ke3RyaXBsZVRpY2tbMV19XG5FeHBsYW5hdGlvbjpcbk1lbW9pemF0aW9uIE9iamVjdDogQSBtZW1vIG9iamVjdCBpcyB1c2VkIHRvIHN0b3JlIHRoZSByZXN1bHRzIG9mIEZpYm9uYWNjaSBjYWxjdWxhdGlvbnMgZm9yIGVhY2ggbi5cbkNoZWNrIE1lbW86IEJlZm9yZSBjb21wdXRpbmcgZmliKG4pLCB0aGUgZnVuY3Rpb24gY2hlY2tzIGlmIHRoZSByZXN1bHQgaXMgYWxyZWFkeSBpbiBtZW1vLiBJZiBpdCBpcywgaXQgcmV0dXJucyB0aGUgc3RvcmVkIHJlc3VsdC5cblN0b3JlIFJlc3VsdDogQWZ0ZXIgY29tcHV0aW5nIGZpYihuKSwgdGhlIHJlc3VsdCBpcyBzdG9yZWQgaW4gbWVtbyBmb3IgZnV0dXJlIHJlZmVyZW5jZS5cblxuIyMgRU5EIEVYQU1QTEVTXG5cbiovXG5cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gc2NtID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY29uc3QgZ2l0Q29tbWl0TWVzc2FnZV9zeXN0ZW1NZXNzYWdlID0gYFxuWW91IGFyZSBhbiBleHBlcnQgc29mdHdhcmUgZW5naW5lZXIgQUkgYXNzaXN0YW50IHJlc3BvbnNpYmxlIGZvciB3cml0aW5nIGNsZWFyIGFuZCBjb25jaXNlIEdpdCBjb21taXQgbWVzc2FnZXMgdGhhdCBzdW1tYXJpemUgdGhlICoqcHVycG9zZSoqIGFuZCAqKmludGVudCoqIG9mIHRoZSBjaGFuZ2UuIFRyeSB0byBrZWVwIHlvdXIgY29tbWl0IG1lc3NhZ2VzIHRvIG9uZSBzZW50ZW5jZS4gSWYgbmVjZXNzYXJ5LCB5b3UgY2FuIHVzZSB0d28gc2VudGVuY2VzLlxuXG5Zb3UgYWx3YXlzIHJlc3BvbmQgd2l0aDpcbi0gVGhlIGNvbW1pdCBtZXNzYWdlIHdyYXBwZWQgaW4gPG91dHB1dD4gdGFnc1xuLSBBIGJyaWVmIGV4cGxhbmF0aW9uIG9mIHRoZSByZWFzb25pbmcgYmVoaW5kIHRoZSBtZXNzYWdlLCB3cmFwcGVkIGluIDxyZWFzb25pbmc+IHRhZ3NcblxuRXhhbXBsZSBmb3JtYXQ6XG48b3V0cHV0PkZpeCBsb2dpbiBidWcgYW5kIGltcHJvdmUgZXJyb3IgaGFuZGxpbmc8L291dHB1dD5cbjxyZWFzb25pbmc+VGhpcyBjb21taXQgdXBkYXRlcyB0aGUgbG9naW4gaGFuZGxlciB0byBmaXggYSByZWRpcmVjdCBpc3N1ZSBhbmQgaW1wcm92ZXMgZnJvbnRlbmQgZXJyb3IgbWVzc2FnZXMgZm9yIGZhaWxlZCBsb2dpbnMuPC9yZWFzb25pbmc+XG5cbkRvIG5vdCBpbmNsdWRlIGFueXRoaW5nIGVsc2Ugb3V0c2lkZSBvZiB0aGVzZSB0YWdzLlxuTmV2ZXIgaW5jbHVkZSBxdW90ZXMsIG1hcmtkb3duLCBjb21tZW50YXJ5LCBvciBleHBsYW5hdGlvbnMgb3V0c2lkZSBvZiA8b3V0cHV0PiBhbmQgPHJlYXNvbmluZz4uYC50cmltKClcblxuXG4vKipcbiAqIENyZWF0ZSBhIHVzZXIgbWVzc2FnZSBmb3IgdGhlIExMTSB0byBnZW5lcmF0ZSBhIGNvbW1pdCBtZXNzYWdlLiBUaGUgbWVzc2FnZSBjb250YWlucyBpbnN0cnVjdGlvbnMgZ2l0IGRpZmZzLCBhbmQgZ2l0IG1ldGFkYXRhIHRvIHByb3ZpZGUgY29udGV4dC5cbiAqXG4gKiBAcGFyYW0gc3RhdCAtIFN1bW1hcnkgb2YgQ2hhbmdlcyAoZ2l0IGRpZmYgLS1zdGF0KVxuICogQHBhcmFtIHNhbXBsZWREaWZmcyAtIFNhbXBsZWQgRmlsZSBEaWZmcyAoVG9wIGNoYW5nZWQgZmlsZXMpXG4gKiBAcGFyYW0gYnJhbmNoIC0gQ3VycmVudCBHaXQgQnJhbmNoXG4gKiBAcGFyYW0gbG9nIC0gTGFzdCA1IGNvbW1pdHMgKGV4Y2x1ZGluZyBtZXJnZXMpXG4gKiBAcmV0dXJucyBBIHByb21wdCBmb3IgdGhlIExMTSB0byBnZW5lcmF0ZSBhIGNvbW1pdCBtZXNzYWdlLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBTYW1wbGUgb3V0cHV0ICh0cnVuY2F0ZWQgZm9yIGJyZXZpdHkpXG4gKiBjb25zdCBwcm9tcHQgPSBnaXRDb21taXRNZXNzYWdlX3VzZXJNZXNzYWdlKFwiZmlsZUEudHMgfCAxMCArKy0tXCIsIFwiZGlmZiAtLWdpdCBhL2ZpbGVBLnRzLi4uXCIsIFwibWFpblwiLCBcImFiYzEyM3xGaXggYnVnfDIwMjUtMDEtMDFcXG4uLi5cIilcbiAqXG4gKiAvLyBSZXN1bHQ6XG4gKiBCYXNlZCBvbiB0aGUgZm9sbG93aW5nIEdpdCBjaGFuZ2VzLCB3cml0ZSBhIGNsZWFyLCBjb25jaXNlIGNvbW1pdCBtZXNzYWdlIHRoYXQgYWNjdXJhdGVseSBzdW1tYXJpemVzIHRoZSBpbnRlbnQgb2YgdGhlIGNvZGUgY2hhbmdlcy5cbiAqXG4gKiBTZWN0aW9uIDEgLSBTdW1tYXJ5IG9mIENoYW5nZXMgKGdpdCBkaWZmIC0tc3RhdCk6XG4gKiBmaWxlQS50cyB8IDEwICsrLS1cbiAqXG4gKiBTZWN0aW9uIDIgLSBTYW1wbGVkIEZpbGUgRGlmZnMgKFRvcCBjaGFuZ2VkIGZpbGVzKTpcbiAqIGRpZmYgLS1naXQgYS9maWxlQS50cyBiL2ZpbGVBLnRzXG4gKiAuLi5cbiAqXG4gKiBTZWN0aW9uIDMgLSBDdXJyZW50IEdpdCBCcmFuY2g6XG4gKiBtYWluXG4gKlxuICogU2VjdGlvbiA0IC0gTGFzdCA1IENvbW1pdHMgKGV4Y2x1ZGluZyBtZXJnZXMpOlxuICogYWJjMTIzfEZpeCBidWd8MjAyNS0wMS0wMVxuICogZGVmNDU2fEltcHJvdmUgbG9nZ2luZ3wyMDI1LTAxLTAxXG4gKiAuLi5cbiAqL1xuZXhwb3J0IGNvbnN0IGdpdENvbW1pdE1lc3NhZ2VfdXNlck1lc3NhZ2UgPSAoc3RhdDogc3RyaW5nLCBzYW1wbGVkRGlmZnM6IHN0cmluZywgYnJhbmNoOiBzdHJpbmcsIGxvZzogc3RyaW5nKSA9PiB7XG5cdGNvbnN0IHNlY3Rpb24xID0gYFNlY3Rpb24gMSAtIFN1bW1hcnkgb2YgQ2hhbmdlcyAoZ2l0IGRpZmYgLS1zdGF0KTpgXG5cdGNvbnN0IHNlY3Rpb24yID0gYFNlY3Rpb24gMiAtIFNhbXBsZWQgRmlsZSBEaWZmcyAoVG9wIGNoYW5nZWQgZmlsZXMpOmBcblx0Y29uc3Qgc2VjdGlvbjMgPSBgU2VjdGlvbiAzIC0gQ3VycmVudCBHaXQgQnJhbmNoOmBcblx0Y29uc3Qgc2VjdGlvbjQgPSBgU2VjdGlvbiA0IC0gTGFzdCA1IENvbW1pdHMgKGV4Y2x1ZGluZyBtZXJnZXMpOmBcblx0cmV0dXJuIGBcbkJhc2VkIG9uIHRoZSBmb2xsb3dpbmcgR2l0IGNoYW5nZXMsIHdyaXRlIGEgY2xlYXIsIGNvbmNpc2UgY29tbWl0IG1lc3NhZ2UgdGhhdCBhY2N1cmF0ZWx5IHN1bW1hcml6ZXMgdGhlIGludGVudCBvZiB0aGUgY29kZSBjaGFuZ2VzLlxuXG4ke3NlY3Rpb24xfVxuXG4ke3N0YXR9XG5cbiR7c2VjdGlvbjJ9XG5cbiR7c2FtcGxlZERpZmZzfVxuXG4ke3NlY3Rpb24zfVxuXG4ke2JyYW5jaH1cblxuJHtzZWN0aW9uNH1cblxuJHtsb2d9YC50cmltKClcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQVNBLFNBQVMsVUFBVTtBQUVuQixTQUFTLHFDQUE4RztBQUloSCxNQUFNLGFBQWEsQ0FBQyxPQUFPLEtBQUs7QUFHaEMsTUFBTSxtQ0FBbUM7QUFDekMsTUFBTSw4QkFBOEI7QUFDcEMsTUFBTSxxQ0FBcUM7QUFDM0MsTUFBTSxnQ0FBZ0M7QUFHdEMsTUFBTSxzQkFBc0I7QUFDNUIsTUFBTSx5QkFBeUI7QUFHL0IsTUFBTSxxQkFBcUI7QUFDM0IsTUFBTSw2QkFBNkI7QUFDbkMsTUFBTSwrQkFBK0I7QUFJckMsTUFBTSwwQkFBMEI7QUFHaEMsTUFBTSxXQUFXO0FBQ2pCLE1BQU0sVUFBVTtBQUNoQixNQUFNLFFBQVE7QUFJckIsTUFBTSw2QkFBNkIsR0FDakMsUUFBUTtBQUFBO0FBQUEsRUFFUixPQUFPO0FBQUE7QUFBQSxFQUVQLEtBQUs7QUFBQTtBQUFBLEVBRUwsUUFBUTtBQUFBO0FBQUEsRUFFUixPQUFPO0FBQUE7QUFBQSxFQUVQLEtBQUs7QUFLUCxNQUFNLDBDQUEwQztBQUFBO0FBQUE7QUFBQTtBQUFBLEVBSzlDLFdBQVcsQ0FBQyxDQUFDO0FBQUEsRUFDYiwwQkFBMEI7QUFBQSxFQUMxQixXQUFXLENBQUMsQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQWtCYixXQUFXLENBQUMsQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBLEVBSWIsV0FBVyxDQUFDLENBQUM7QUFBQTtBQUFBO0FBQUEsRUFHYixXQUFXLENBQUMsQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLYixXQUFXLENBQUMsQ0FBQztBQUFBO0FBQUE7QUFBQSxFQUdiLFdBQVcsQ0FBQyxDQUFDO0FBQUEsRUFDYixRQUFRO0FBQUE7QUFBQSxFQUVSLE9BQU87QUFBQTtBQUFBLEVBRVAsS0FBSztBQUFBLEVBQ0wsV0FBVyxDQUFDLENBQUM7QUFHZixNQUFNLDBCQUEwQjtBQUFBO0FBQUEsRUFHOUIsMEJBQTBCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBa0I1QixNQUFNLDRCQUE0QixHQUNoQyxXQUFXLENBQUMsQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVNiLFdBQVcsQ0FBQyxDQUFDO0FBZ0JmLE1BQU0sV0FBVyxDQUFDLFlBQW9CO0FBQUEsRUFDckMsS0FBSyxFQUFFLGFBQWEsd0JBQXdCLE1BQU0sSUFBSTtBQUN2RDtBQUVBLE1BQU0sa0JBQWtCO0FBQUEsRUFDdkIsYUFBYSxFQUFFLGFBQWEseURBQXlEO0FBQ3RGO0FBSUEsTUFBTSxxQkFBcUI7QUFFM0IsTUFBTSxZQUFZO0FBa0JYLE1BQU0sZUFPVDtBQUFBO0FBQUEsRUFHSCxXQUFXO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixhQUFhO0FBQUEsSUFDYixRQUFRO0FBQUEsTUFDUCxHQUFHLFNBQVMsTUFBTTtBQUFBLE1BQ2xCLFlBQVksRUFBRSxhQUFhLDhJQUE4STtBQUFBLE1BQ3pLLFVBQVUsRUFBRSxhQUFhLHdJQUF3STtBQUFBLE1BQ2pLLEdBQUc7QUFBQSxJQUNKO0FBQUEsRUFDRDtBQUFBLEVBRUEsUUFBUTtBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sYUFBYTtBQUFBLElBQ2IsUUFBUTtBQUFBLE1BQ1AsS0FBSyxFQUFFLGFBQWEsa0NBQWtDLFFBQVEscURBQXFEO0FBQUEsTUFDbkgsR0FBRztBQUFBLElBQ0o7QUFBQSxFQUNEO0FBQUEsRUFFQSxjQUFjO0FBQUEsSUFDYixNQUFNO0FBQUEsSUFDTixhQUFhO0FBQUEsSUFDYixRQUFRO0FBQUEsTUFDUCxHQUFHLFNBQVMsUUFBUTtBQUFBLElBQ3JCO0FBQUEsRUFDRDtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUEsdUJBQXVCO0FBQUEsSUFDdEIsTUFBTTtBQUFBLElBQ04sYUFBYTtBQUFBLElBQ2IsUUFBUTtBQUFBLE1BQ1AsT0FBTyxFQUFFLGFBQWEsNkJBQTZCO0FBQUEsTUFDbkQsaUJBQWlCLEVBQUUsYUFBYSxvR0FBb0c7QUFBQSxNQUNwSSxHQUFHO0FBQUEsSUFDSjtBQUFBLEVBQ0Q7QUFBQSxFQUlBLGtCQUFrQjtBQUFBLElBQ2pCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxNQUNQLE9BQU8sRUFBRSxhQUFhLDZCQUE2QjtBQUFBLE1BQ25ELGtCQUFrQixFQUFFLGFBQWEsOEpBQThKO0FBQUEsTUFDL0wsVUFBVSxFQUFFLGFBQWEsNERBQTREO0FBQUEsTUFDckYsR0FBRztBQUFBLElBQ0o7QUFBQSxFQUNEO0FBQUE7QUFBQSxFQUdBLGdCQUFnQjtBQUFBLElBQ2YsTUFBTTtBQUFBLElBQ04sYUFBYTtBQUFBLElBQ2IsUUFBUTtBQUFBLE1BQ1AsR0FBRyxTQUFTLE1BQU07QUFBQSxNQUNsQixPQUFPLEVBQUUsYUFBYSxpREFBaUQ7QUFBQSxNQUN2RSxVQUFVLEVBQUUsYUFBYSw0REFBNEQ7QUFBQSxJQUN0RjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLGtCQUFrQjtBQUFBLElBQ2pCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxNQUNQLEdBQUcsU0FBUyxNQUFNO0FBQUEsSUFDbkI7QUFBQSxFQUNEO0FBQUE7QUFBQSxFQUlBLHVCQUF1QjtBQUFBLElBQ3RCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxNQUNQLEdBQUcsU0FBUyxnQkFBZ0I7QUFBQSxJQUM3QjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLHVCQUF1QjtBQUFBLElBQ3RCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxNQUNQLEdBQUcsU0FBUyxnQkFBZ0I7QUFBQSxNQUM1QixjQUFjLEVBQUUsYUFBYSwrQ0FBK0M7QUFBQSxJQUM3RTtBQUFBLEVBQ0Q7QUFBQSxFQUVBLFdBQVc7QUFBQSxJQUNWLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxNQUNQLEdBQUcsU0FBUyxNQUFNO0FBQUEsTUFDbEIsdUJBQXVCLEVBQUUsYUFBYSx3QkFBd0I7QUFBQSxJQUMvRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLGNBQWM7QUFBQSxJQUNiLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxNQUNQLEdBQUcsU0FBUyxNQUFNO0FBQUEsTUFDbEIsYUFBYSxFQUFFLGFBQWEsa0RBQWtEO0FBQUEsSUFDL0U7QUFBQSxFQUNEO0FBQUEsRUFDQSxhQUFhO0FBQUEsSUFDWixNQUFNO0FBQUEsSUFDTixhQUFhLHFFQUFxRSwwQkFBMEIscUJBQXFCLGtCQUFrQjtBQUFBLElBQ25KLFFBQVE7QUFBQSxNQUNQLFNBQVMsRUFBRSxhQUFhLCtCQUErQjtBQUFBLE1BQ3ZELEtBQUssRUFBRSxhQUFhLFVBQVU7QUFBQSxJQUMvQjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLHdCQUF3QjtBQUFBLElBQ3ZCLE1BQU07QUFBQSxJQUNOLGFBQWEsb0hBQW9ILDRCQUE0QixnRUFBZ0Usa0JBQWtCO0FBQUEsSUFDL08sUUFBUTtBQUFBLE1BQ1AsU0FBUyxFQUFFLGFBQWEsK0JBQStCO0FBQUEsTUFDdkQsd0JBQXdCLEVBQUUsYUFBYSxpRUFBaUU7QUFBQSxJQUN6RztBQUFBLEVBQ0Q7QUFBQSxFQUlBLDBCQUEwQjtBQUFBLElBQ3pCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxNQUNQLEtBQUssRUFBRSxhQUFhLFVBQVU7QUFBQSxJQUMvQjtBQUFBLEVBQ0Q7QUFBQSxFQUdBLDBCQUEwQjtBQUFBLElBQ3pCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVEsRUFBRSx3QkFBd0IsRUFBRSxhQUFhLHFDQUFxQyxFQUFFO0FBQUEsRUFDekY7QUFBQSxFQUVBLG9CQUFvQjtBQUFBLElBQ25CLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxNQUNQLEdBQUcsU0FBUyxNQUFNO0FBQUEsSUFDbkI7QUFBQSxFQUNEO0FBQUE7QUFBQSxFQUlBLGlCQUFpQjtBQUFBLElBQ2hCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVEsQ0FBQztBQUFBLEVBQ1Y7QUFBQSxFQUVBLGNBQWM7QUFBQSxJQUNiLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVEsQ0FBQztBQUFBLEVBQ1Y7QUFBQSxFQUVBLG1CQUFtQjtBQUFBLElBQ2xCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxNQUNQLGFBQWEsRUFBRSxhQUFhLHdNQUF3TTtBQUFBLElBQ3JPO0FBQUEsRUFDRDtBQUFBLEVBRUEsc0JBQXNCO0FBQUEsSUFDckIsTUFBTTtBQUFBLElBQ04sYUFBYTtBQUFBLElBQ2IsUUFBUTtBQUFBLE1BQ1AsVUFBVSxFQUFFLGFBQWEsOExBQThMO0FBQUEsSUFDeE47QUFBQSxFQUNEO0FBQUEsRUFFQSxtQkFBbUI7QUFBQSxJQUNsQixNQUFNO0FBQUEsSUFDTixhQUFhO0FBQUEsSUFDYixRQUFRO0FBQUEsTUFDUCxRQUFRLEVBQUUsYUFBYSw0SEFBNEg7QUFBQSxJQUNwSjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLGVBQWU7QUFBQSxJQUNkLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVEsQ0FBQztBQUFBLEVBQ1Y7QUFBQSxFQUVBLHNCQUFzQjtBQUFBLElBQ3JCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxNQUNQLE1BQU0sRUFBRSxhQUFhLHdIQUF3SDtBQUFBLE1BQzdJLElBQUksRUFBRSxhQUFhLHdJQUF3STtBQUFBLElBQzVKO0FBQUEsRUFDRDtBQUFBO0FBQUEsRUFJQSxvQkFBb0I7QUFBQSxJQUNuQixNQUFNO0FBQUEsSUFDTixhQUFhO0FBQUEsSUFDYixRQUFRO0FBQUEsTUFDUCxTQUFTLEVBQUUsYUFBYSwrRUFBK0U7QUFBQSxJQUN4RztBQUFBLEVBQ0Q7QUFBQSxFQUVBLGtCQUFrQjtBQUFBLElBQ2pCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLFFBQVEsQ0FBQztBQUFBLEVBQ1Y7QUFBQSxFQUVBLGdCQUFnQjtBQUFBLElBQ2YsTUFBTTtBQUFBLElBQ04sYUFBYTtBQUFBLElBQ2IsUUFBUTtBQUFBLE1BQ1AsVUFBVSxFQUFFLGFBQWEsMk9BQTJPO0FBQUEsSUFDclE7QUFBQSxFQUNEO0FBQUEsRUFFQSxvQkFBb0I7QUFBQSxJQUNuQixNQUFNO0FBQUEsSUFDTixhQUFhO0FBQUEsSUFDYixRQUFRO0FBQUEsTUFDUCxTQUFTLEVBQUUsYUFBYSwwR0FBMEc7QUFBQSxNQUNsSSxPQUFPLEVBQUUsYUFBYSx3R0FBd0c7QUFBQSxJQUMvSDtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBTUQ7QUFLTyxNQUFNLG1CQUFtQixPQUFPLEtBQUssWUFBWTtBQUN4RCxNQUFNLGVBQWUsSUFBSSxJQUFZLGdCQUFnQjtBQUM5QyxNQUFNLHFCQUFxQixDQUFDLGFBQWtEO0FBQ3BGLFFBQU0sY0FBYyxhQUFhLElBQUksUUFBUTtBQUM3QyxTQUFPO0FBQ1I7QUFNTyxNQUFNLGlCQUFpQixDQUFDLFVBQTJCLGFBQTZDO0FBRXRHLFFBQU1BLG9CQUFrRCxhQUFhLFdBQVcsU0FDN0UsYUFBYSxXQUFZLE9BQU8sS0FBSyxZQUFZLEVBQXdCLE9BQU8sY0FBWSxFQUFFLFlBQVksOEJBQThCLElBQ3ZJLGFBQWEsVUFBVSxPQUFPLEtBQUssWUFBWSxJQUM5QztBQUVMLFFBQU0sd0JBQXdCQSxtQkFBa0IsSUFBSSxjQUFZLGFBQWEsUUFBUSxDQUFDLEtBQUs7QUFDM0YsUUFBTSxvQkFBb0IsYUFBYSxVQUFVLFdBQVc7QUFFNUQsUUFBTSxRQUF3QyxFQUFFQSxxQkFBb0IsWUFBWSxTQUM3RTtBQUFBLElBQ0QsR0FBRyx5QkFBeUIsQ0FBQztBQUFBLElBQzdCLEdBQUcscUJBQXFCLENBQUM7QUFBQSxFQUMxQjtBQUVELFNBQU87QUFDUjtBQUVBLE1BQU0sK0JBQStCLENBQUMsVUFBOEI7QUFDbkUsU0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsTUFBTTtBQUM3QixVQUFNLFNBQVMsT0FBTyxLQUFLLEVBQUUsTUFBTSxFQUFFLElBQUksZUFBYSxJQUFJLFNBQVMsSUFBSSxFQUFFLE9BQU8sU0FBUyxFQUFFLFdBQVcsS0FBSyxTQUFTLEdBQUcsRUFBRSxLQUFLLElBQUk7QUFDbEksV0FBTyxPQUNILElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSTtBQUFBLG1CQUNILEVBQUUsV0FBVztBQUFBO0FBQUEsT0FFekIsRUFBRSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUs7QUFBQSxFQUFLLE1BQU0sRUFBRTtBQUFBLFFBQ3JDLEVBQUUsSUFBSTtBQUFBLEVBQ2IsQ0FBQyxFQUFFLEtBQUssTUFBTSxDQUFDO0FBQ2hCO0FBRU8sTUFBTSx3QkFBd0IsQ0FBQyxVQUFvQixlQUFpQztBQUMxRixRQUFNLFNBQVMsT0FBTyxLQUFLLFVBQVUsRUFBRSxJQUFJLGVBQWEsSUFBSSxTQUFTLElBQUksV0FBVyxTQUFTLENBQUMsS0FBSyxTQUFTLEdBQUcsRUFBRSxLQUFLLElBQUk7QUFDMUgsU0FBTyxRQUNELFFBQVEsSUFBSSxDQUFDLFNBQVMsS0FBSztBQUFBLEVBQUssTUFBTSxFQUFFO0FBQUEsUUFDdkMsUUFBUSxJQUNiLFFBQVEsS0FBTSxJQUFJO0FBQ3JCO0FBSUEsTUFBTSx1QkFBdUIsQ0FBQyxVQUFvQixhQUE2QztBQUM5RixRQUFNLFFBQVEsZUFBZSxVQUFVLFFBQVE7QUFDL0MsTUFBSSxDQUFDLFNBQVMsTUFBTSxXQUFXLEVBQUcsUUFBTztBQUV6QyxRQUFNLHFCQUFzQjtBQUFBO0FBQUEsTUFHdkIsNkJBQTZCLEtBQUssQ0FBQztBQUV4QyxRQUFNLHdCQUF5QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFRL0IsU0FBTyxPQUNGLGtCQUFrQjtBQUFBO0FBQUEsTUFFbEIscUJBQXFCO0FBQzNCO0FBS08sTUFBTSxxQkFBcUIsQ0FBQyxFQUFFLGtCQUFrQixZQUFZLFdBQVcsdUJBQXVCLGNBQWMsVUFBVSxNQUFNLFVBQVUsMEJBQTBCLE1BQW9QO0FBQzFaLFFBQU0sU0FBVSw4REFBOEQsU0FBUyxVQUFVLFVBQVUsV0FBVztBQUFBLEVBQ3JILFNBQVMsVUFBVSxxSEFDakIsU0FBUyxXQUFXLGtHQUNuQixTQUFTLFdBQVcsc0dBQ25CLEVBQUU7QUFBQTtBQUFBO0FBSVAsUUFBTSxZQUFZO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFvNENsQixRQUFNLFVBQVc7QUFBQTtBQUFBLElBRWQsRUFBRTtBQUFBO0FBQUE7QUFBQSxFQUdKLGlCQUFpQixLQUFLLElBQUksS0FBSyxpQkFBaUI7QUFBQTtBQUFBO0FBQUEsRUFHaEQsU0FBUztBQUFBO0FBQUE7QUFBQSxFQUdULFdBQVcsS0FBSyxJQUFJLEtBQUssaUJBQWlCLEdBQUcsRUFBaUIsR0FBRyxTQUFTLFdBQVcsc0JBQXNCLFdBQVcsSUFBSTtBQUFBO0FBQUEsa0VBRTFELHNCQUFzQixLQUFLLElBQUksQ0FBQyxLQUFLLEVBQUU7QUFBQTtBQUl4RyxRQUFNLFNBQVU7QUFBQTtBQUFBLEVBRWYsWUFBWTtBQUFBO0FBSWIsUUFBTSxrQkFBa0IsNEJBQTRCLHFCQUFxQixNQUFNLFFBQVEsSUFBSTtBQUUzRixRQUFNLFVBQW9CLENBQUM7QUFFM0IsVUFBUSxLQUFLLGdDQUFnQztBQUU3QyxNQUFJLFNBQVMsV0FBVyxTQUFTLFVBQVU7QUFDMUMsWUFBUSxLQUFLLDBLQUEwSztBQUN2TCxZQUFRLEtBQUssMkVBQTJFO0FBQ3hGLFlBQVEsS0FBSyxtQ0FBbUM7QUFDaEQsWUFBUSxLQUFLLDJYQUEyWDtBQUN4WSxZQUFRLEtBQUssd0RBQXdEO0FBQUEsRUFDdEUsT0FDSztBQUNKLFlBQVEsS0FBSywrSkFBK0o7QUFBQSxFQUM3SztBQUVBLE1BQUksU0FBUyxTQUFTO0FBQ3JCLFlBQVEsS0FBSyxtSkFBbUo7QUFDaEssWUFBUSxLQUFLLDJGQUEyRjtBQUN4RyxZQUFRLEtBQUssc0lBQXNJO0FBQ25KLFlBQVEsS0FBSyw4UEFBOFA7QUFDM1EsWUFBUSxLQUFLLG9GQUFvRjtBQUNqRyxZQUFRLEtBQUssMlVBQXNVO0FBQUEsRUFDcFY7QUFFQSxNQUFJLFNBQVMsVUFBVTtBQUN0QixZQUFRLEtBQUssaUlBQWlJO0FBQzlJLFlBQVEsS0FBSyxzR0FBc0c7QUFBQSxFQUNwSDtBQUVBLFVBQVEsS0FBSztBQUFBO0FBQUE7QUFBQSw4REFHZ0Q7QUFFN0QsTUFBSSxTQUFTLFlBQVksU0FBUyxVQUFVO0FBRTNDLFlBQVEsS0FBSztBQUFBO0FBQUE7QUFBQSxFQUs0Qix5QkFBeUIsRUFBRTtBQUFBLEVBQ3JFO0FBRUEsVUFBUSxLQUFLLDBHQUEwRztBQUN2SCxVQUFRLEtBQUssK0VBQStFO0FBQzVGLFVBQVEsS0FBSyxvQkFBbUIsb0JBQUksS0FBSyxHQUFFLGFBQWEsQ0FBQyxHQUFHO0FBRTVELFFBQU0sbUJBQW9CO0FBQUEsRUFDekIsUUFBUSxJQUFJLENBQUMsR0FBRyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsS0FBSyxNQUFNLENBQUM7QUFJckQsUUFBTSxVQUFvQixDQUFDO0FBQzNCLFVBQVEsS0FBSyxNQUFNO0FBQ25CLFVBQVEsS0FBSyxTQUFTO0FBQ3RCLFVBQVEsS0FBSyxPQUFPO0FBQ3BCLE1BQUksZ0JBQWlCLFNBQVEsS0FBSyxlQUFlO0FBQ2pELFVBQVEsS0FBSyxnQkFBZ0I7QUFDN0IsVUFBUSxLQUFLLE1BQU07QUFFbkIsUUFBTSxtQkFBbUIsUUFDdkIsS0FBSyxRQUFRLEVBQ2IsS0FBSyxFQUNMLFFBQVEsS0FBTSxJQUFJO0FBRXBCLFNBQU87QUFFUjtBQVNPLE1BQU0sMEJBQTBCO0FBRWhDLE1BQU0sV0FBVyxPQUFPLGFBQTJCLEtBQVUsa0JBUTlEO0FBQ0wsTUFBSTtBQUNILFVBQU0sY0FBYyxNQUFNLFlBQVksU0FBUyxHQUFHO0FBQ2xELFVBQU0sTUFBTSxZQUFZLE1BQU0sU0FBUztBQUN2QyxRQUFJLElBQUksU0FBUyxjQUFlLFFBQU8sRUFBRSxLQUFLLElBQUksVUFBVSxHQUFHLGFBQWEsR0FBRyxXQUFXLE1BQU0sYUFBYSxJQUFJLE9BQU87QUFDeEgsV0FBTyxFQUFFLEtBQUssV0FBVyxPQUFPLGFBQWEsSUFBSSxPQUFPO0FBQUEsRUFDekQsU0FDTyxHQUFHO0FBQ1QsV0FBTyxFQUFFLEtBQUssS0FBSztBQUFBLEVBQ3BCO0FBQ0Q7QUFNTyxNQUFNLHFCQUFxQixPQUNqQyxHQUNBLFNBUUk7QUFDSixRQUFNLGtCQUFrQixDQUFDLFVBQTRCLFdBQVcsTUFBTSxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsQ0FBQztBQUVwRixNQUFJLEVBQUUsU0FBUyxpQkFBaUI7QUFDL0IsVUFBTSxFQUFFLElBQUksSUFBSSxNQUFNLFNBQVMsS0FBSyxhQUFhLEVBQUUsS0FBSyx1QkFBdUI7QUFDL0UsVUFBTSxRQUFRLEtBQUssTUFBTSxJQUFJO0FBRTdCLFVBQU0sV0FBVyxPQUFPLE1BQU0sRUFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUMsRUFBRSxLQUFLLElBQUk7QUFDbkUsVUFBTSxVQUFVLENBQUMsUUFBUSxLQUN0QixHQUFHLFdBQVcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxRQUFRO0FBQUEsRUFBSyxRQUFRO0FBQUEsRUFBSyxXQUFXLENBQUMsQ0FBQztBQUMvRCxVQUFNLE1BQU0sR0FBRyxFQUFFLElBQUksTUFBTSxHQUFHLGdCQUFnQixFQUFFLEtBQUssQ0FBQztBQUFBLEVBQU0sT0FBTztBQUNuRSxXQUFPO0FBQUEsRUFDUixXQUNTLEVBQUUsU0FBUyxRQUFRO0FBQzNCLFVBQU0sRUFBRSxJQUFJLElBQUksTUFBTSxTQUFTLEtBQUssYUFBYSxFQUFFLEtBQUssdUJBQXVCO0FBRS9FLFVBQU0sV0FBVztBQUNqQixVQUFNLFVBQVUsUUFBUSxPQUFPLEtBQzVCLEdBQUcsV0FBVyxDQUFDLENBQUMsR0FBRyxFQUFFLFFBQVE7QUFBQSxFQUFLLFFBQVE7QUFBQSxFQUFLLFdBQVcsQ0FBQyxDQUFDO0FBRS9ELFVBQU0sTUFBTSxHQUFHLEVBQUUsSUFBSSxNQUFNO0FBQUEsRUFBTSxPQUFPO0FBQ3hDLFdBQU87QUFBQSxFQUNSLFdBQ1MsRUFBRSxTQUFTLFVBQVU7QUFDN0IsVUFBTSxTQUFpQixNQUFNLEtBQUssb0JBQW9CLG9CQUFvQixFQUFFLEdBQUc7QUFDL0UsVUFBTSxrQkFBa0IsR0FBRyxFQUFFLElBQUksTUFBTSxxQkFBcUIsV0FBVyxDQUFDLENBQUM7QUFBQSxFQUFLLE1BQU07QUFBQSxFQUFLLFdBQVcsQ0FBQyxDQUFDO0FBRXRHLFVBQU0sT0FBTyxNQUFNLEtBQUssb0JBQW9CLHNCQUFzQixFQUFFLEtBQUssRUFBRSxZQUFZLEtBQUssV0FBVyxZQUFZLENBQUM7QUFDcEgsVUFBTSxhQUFhLE1BQU0sUUFBUSxJQUFJLEtBQUssSUFBSSxPQUFNLFFBQU87QUFDMUQsWUFBTSxFQUFFLEtBQUssVUFBVSxJQUFJLE1BQU0sU0FBUyxLQUFLLGFBQWEsS0FBSyxLQUFLLFdBQVcsZUFBZTtBQUNoRyxZQUFNLGdCQUFnQixZQUFZO0FBQUEsMEJBQTZCO0FBQy9ELFlBQU0sVUFBVSxRQUFRLE9BQU8sU0FBUyxHQUFHLFdBQVcsQ0FBQyxDQUFDO0FBQUEsRUFBSyxHQUFHLEdBQUcsYUFBYTtBQUFBLEVBQUssV0FBVyxDQUFDLENBQUM7QUFDbEcsWUFBTSxNQUFNLEdBQUcsSUFBSSxNQUFNO0FBQUEsRUFBTSxPQUFPO0FBQ3RDLGFBQU87QUFBQSxJQUNSLENBQUMsQ0FBQztBQUNGLFVBQU0sYUFBYSxDQUFDLGlCQUFpQixHQUFHLFVBQVUsRUFBRSxLQUFLLE1BQU07QUFDL0QsV0FBTztBQUFBLEVBQ1I7QUFFQyxXQUFPO0FBRVQ7QUFHTyxNQUFNLDBCQUEwQixPQUN0QyxjQUNBLFdBQ0EsU0FJSTtBQUVKLFFBQU0sWUFBWSxNQUFNLFFBQVE7QUFBQSxLQUM5QixhQUFhLENBQUMsR0FBRztBQUFBLE1BQUksT0FBTyxNQUM1QixtQkFBbUIsR0FBRztBQUFBLFFBQ3JCLEdBQUc7QUFBQSxRQUNILFlBQVksRUFBRSxhQUFhLEtBQUssaUJBQWlCLElBQVM7QUFBQSxNQUMzRCxDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFHQSxNQUFJLE1BQU07QUFDVixTQUFPLEdBQUcsWUFBWTtBQUV0QixRQUFNLFdBQVcsVUFBVSxLQUFLLE1BQU0sS0FBSztBQUMzQyxNQUFJLFNBQVUsUUFBTztBQUFBO0FBQUE7QUFBQSxFQUFzQixRQUFRO0FBQ25ELFNBQU87QUFDUjtBQUdPLE1BQU0sNEJBQTRCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBYWxDLE1BQU0sMEJBQTBCLENBQUMsRUFBRSxjQUFjLFVBQVUsU0FBUyxNQUFvRTtBQUU5SSxTQUFPO0FBQUEsRUFFTixXQUFXLENBQUMsQ0FBQyxHQUFHLFFBQVE7QUFBQSxFQUN4QixZQUFZO0FBQUEsRUFDWixXQUFXLENBQUMsQ0FBQztBQUFBO0FBQUE7QUFBQSxFQUdiLFdBQVcsQ0FBQyxDQUFDO0FBQUEsRUFDYixRQUFRO0FBQUEsRUFDUixXQUFXLENBQUMsQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBS2Y7QUFNTyxNQUFNLDhDQUE4QztBQUdwRCxNQUFNLDRDQUE0QyxDQUFDLEVBQUUsY0FBYyxTQUFTLE1BQWtEO0FBQUEsRUFFbkksUUFBUTtBQUFBO0FBQUE7QUFBQSxFQUdSLFdBQVcsQ0FBQyxDQUFDO0FBQUEsRUFDYixZQUFZO0FBQUEsRUFDWixXQUFXLENBQUMsQ0FBQztBQU1SLE1BQU0sc0JBQXNCLENBQUMsRUFBRSxhQUFhLFdBQVcsUUFBUSxNQUFtRTtBQUV4SSxRQUFNLGdCQUFnQixZQUFZLE1BQU0sSUFBSTtBQWlCNUMsTUFBSSxTQUFTO0FBQ2IsTUFBSSxJQUFJLFlBQVk7QUFFcEIsU0FBTyxNQUFNLEdBQUc7QUFDZixVQUFNLFVBQVUsY0FBYyxJQUFJLENBQUM7QUFDbkMsUUFBSSxRQUFRLFNBQVMsSUFBSSxPQUFPLFVBQVUseUJBQXlCO0FBQ2xFLGVBQVMsR0FBRyxPQUFPO0FBQUEsRUFBSyxNQUFNO0FBQzlCLFdBQUs7QUFBQSxJQUNOLE1BQ0s7QUFBQSxFQUNOO0FBRUEsTUFBSSxTQUFTO0FBQ2IsTUFBSSxJQUFJLFVBQVU7QUFDbEIsU0FBTyxNQUFNLGNBQWMsU0FBUyxHQUFHO0FBQ3RDLFVBQU0sVUFBVSxjQUFjLElBQUksQ0FBQztBQUNuQyxRQUFJLFFBQVEsU0FBUyxJQUFJLE9BQU8sVUFBVSx5QkFBeUI7QUFDbEUsZUFBUyxHQUFHLE1BQU07QUFBQSxFQUFLLE9BQU87QUFDOUIsV0FBSztBQUFBLElBQ04sTUFDSztBQUFBLEVBQ047QUFFQSxTQUFPLEVBQUUsUUFBUSxPQUFPO0FBRXpCO0FBVU8sTUFBTSwwQkFBZ0Q7QUFBQSxFQUM1RCxRQUFRO0FBQUEsRUFDUixRQUFRO0FBQUEsRUFDUixRQUFRO0FBQ1Q7QUFHTyxNQUFNLDRCQUE0QixDQUFDLEVBQUUsa0JBQWtCLEVBQUUsUUFBUSxRQUFRLE9BQU8sRUFBRSxNQUFrRDtBQUMxSSxTQUFPLGdIQUN1RyxNQUFNO0FBQUE7QUFBQSx3R0FFYixNQUFNLGVBQWUsTUFBTSwrREFBK0QsTUFBTSxjQUFjLE1BQU07QUFBQTtBQUFBO0FBQUE7QUFBQSwrREFJN0osTUFBTSxpQkFBaUIsTUFBTTtBQUFBLDZFQUNmLE1BQU0sU0FBUyxNQUFNLFNBQVMsTUFBTSxTQUFTLE1BQU07QUFBQTtBQUFBO0FBQUE7QUFJaEk7QUFFTyxNQUFNLDBCQUEwQixDQUFDO0FBQUEsRUFDdkM7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQTtBQUFBLEVBRUE7QUFBQSxFQUNBO0FBQVMsTUFFSDtBQUNOLFFBQU0sRUFBRSxRQUFRLFFBQVEsT0FBTyxJQUFJO0FBTW5DLFNBQU87QUFBQTtBQUFBLEVBR04sV0FBVyxDQUFDLENBQUMsR0FBRyxRQUFRO0FBQUEsR0FDdkIsTUFBTSxJQUFJLFNBQVMsS0FBSyxNQUFNO0FBQUEsRUFDL0IsV0FBVyxDQUFDLENBQUM7QUFBQTtBQUFBO0FBQUEsRUFHYixZQUFZO0FBQUE7QUFBQSxHQUVYLE1BQU0sSUFBSSxNQUFNLEtBQUssTUFBTTtBQUFBLEdBQzNCLE1BQU0sSUFBSSxNQUFNLEtBQUssTUFBTTtBQUFBO0FBQUEsd0RBRTBCLFdBQVcsQ0FBQyxDQUFDLEdBQUcsUUFBUTtBQUFBLEdBQzdFLE1BQU0saUJBQWlCLE1BQU07QUFBQSxFQUM5QixXQUFXLENBQUMsQ0FBQztBQUNmO0FBa01PLE1BQU0saUNBQWlDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGtHQVlvRCxLQUFLO0FBa0NoRyxNQUFNLCtCQUErQixDQUFDLE1BQWMsY0FBc0IsUUFBZ0IsUUFBZ0I7QUFDaEgsUUFBTSxXQUFXO0FBQ2pCLFFBQU0sV0FBVztBQUNqQixRQUFNLFdBQVc7QUFDakIsUUFBTSxXQUFXO0FBQ2pCLFNBQU87QUFBQTtBQUFBO0FBQUEsRUFHTixRQUFRO0FBQUE7QUFBQSxFQUVSLElBQUk7QUFBQTtBQUFBLEVBRUosUUFBUTtBQUFBO0FBQUEsRUFFUixZQUFZO0FBQUE7QUFBQSxFQUVaLFFBQVE7QUFBQTtBQUFBLEVBRVIsTUFBTTtBQUFBO0FBQUEsRUFFTixRQUFRO0FBQUE7QUFBQSxFQUVSLEdBQUcsR0FBRyxLQUFLO0FBQ2I7IiwKICAibmFtZXMiOiBbImJ1aWx0aW5Ub29sTmFtZXMiXQp9Cg==
