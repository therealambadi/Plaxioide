const KEYWORDS = /* @__PURE__ */ new Set([
  "PROGRAM",
  "END_PROGRAM",
  "FUNCTION_BLOCK",
  "END_FUNCTION_BLOCK",
  "FUNCTION",
  "END_FUNCTION",
  "VAR",
  "VAR_INPUT",
  "VAR_OUTPUT",
  "VAR_IN_OUT",
  "VAR_TEMP",
  "VAR_GLOBAL",
  "END_VAR",
  "IF",
  "THEN",
  "ELSIF",
  "ELSE",
  "END_IF",
  "CASE",
  "OF",
  "END_CASE",
  "FOR",
  "TO",
  "BY",
  "DO",
  "END_FOR",
  "WHILE",
  "END_WHILE",
  "REPEAT",
  "UNTIL",
  "END_REPEAT",
  "RETURN",
  "EXIT",
  "CONTINUE",
  "AND",
  "OR",
  "NOT",
  "XOR",
  "MOD",
  "TRUE",
  "FALSE",
  "RETAIN",
  "CONSTANT",
  "AT",
  "ARRAY",
  "STRUCT",
  "END_STRUCT",
  "TYPE",
  "END_TYPE"
]);
function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  while (i < source.length) {
    if (/\s/.test(source[i])) {
      if (source[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
      continue;
    }
    if (source[i] === "(" && source[i + 1] === "*") {
      i += 2;
      col += 2;
      while (i < source.length - 1 && !(source[i] === "*" && source[i + 1] === ")")) {
        if (source[i] === "\n") {
          line++;
          col = 1;
        } else {
          col++;
        }
        i++;
      }
      i += 2;
      col += 2;
      continue;
    }
    if (source[i] === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    const startCol = col;
    const timeMatch = source.slice(i).match(/^(T|TIME|LT|LTIME)#[0-9dhms_]+/i);
    if (timeMatch) {
      tokens.push({ kind: "TIME_LITERAL", value: timeMatch[0], line, col: startCol });
      i += timeMatch[0].length;
      col += timeMatch[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(source[i])) {
      let word = "";
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        word += source[i];
        i++;
        col++;
      }
      const upper = word.toUpperCase();
      if (upper === "AND" || upper === "OR" || upper === "NOT" || upper === "XOR") {
        tokens.push({ kind: "OP_LOGIC", value: upper, line, col: startCol });
      } else if (upper === "MOD") {
        tokens.push({ kind: "OP_ARITH", value: upper, line, col: startCol });
      } else if (KEYWORDS.has(upper)) {
        tokens.push({ kind: "KEYWORD", value: upper, line, col: startCol });
      } else {
        tokens.push({ kind: "IDENT", value: word, line, col: startCol });
      }
      continue;
    }
    if (/[0-9]/.test(source[i])) {
      let num = "";
      if (/[0-9]/.test(source[i]) && i + 1 < source.length && source[i + 1] === "#") {
        num = source[i] + "#";
        i += 2;
        col += 2;
        while (i < source.length && /[0-9A-Fa-f_]/.test(source[i])) {
          num += source[i];
          i++;
          col++;
        }
      } else {
        while (i < source.length && /[0-9_.]/.test(source[i])) {
          num += source[i];
          i++;
          col++;
        }
        if (i < source.length && /[eE]/.test(source[i])) {
          num += source[i];
          i++;
          col++;
          if (i < source.length && /[+-]/.test(source[i])) {
            num += source[i];
            i++;
            col++;
          }
          while (i < source.length && /[0-9]/.test(source[i])) {
            num += source[i];
            i++;
            col++;
          }
        }
      }
      tokens.push({ kind: "NUMBER", value: num, line, col: startCol });
      continue;
    }
    if (source[i] === "'" || source[i] === '"') {
      const quote = source[i];
      let str = quote;
      i++;
      col++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "$" || source[i] === "\\") {
          str += source[i];
          i++;
          col++;
        }
        if (i < source.length) {
          str += source[i];
          i++;
          col++;
        }
      }
      if (i < source.length) {
        str += source[i];
        i++;
        col++;
      }
      tokens.push({ kind: "STRING", value: str, line, col: startCol });
      continue;
    }
    const two = source.slice(i, i + 2);
    if (two === ":=") {
      tokens.push({ kind: "ASSIGN", value: ":=", line, col: startCol });
      i += 2;
      col += 2;
      continue;
    }
    if (two === "=>") {
      tokens.push({ kind: "ARROW", value: "=>", line, col: startCol });
      i += 2;
      col += 2;
      continue;
    }
    if (two === "<>" || two === "<=" || two === ">=") {
      tokens.push({ kind: "OP_COMPARE", value: two, line, col: startCol });
      i += 2;
      col += 2;
      continue;
    }
    const ch = source[i];
    if (ch === ":") {
      tokens.push({ kind: "COLON", value: ":", line, col: startCol });
    } else if (ch === ";") {
      tokens.push({ kind: "SEMI", value: ";", line, col: startCol });
    } else if (ch === ",") {
      tokens.push({ kind: "COMMA", value: ",", line, col: startCol });
    } else if (ch === ".") {
      tokens.push({ kind: "DOT", value: ".", line, col: startCol });
    } else if (ch === "(") {
      tokens.push({ kind: "LPAREN", value: "(", line, col: startCol });
    } else if (ch === ")") {
      tokens.push({ kind: "RPAREN", value: ")", line, col: startCol });
    } else if (ch === "[") {
      tokens.push({ kind: "LBRACKET", value: "[", line, col: startCol });
    } else if (ch === "]") {
      tokens.push({ kind: "RBRACKET", value: "]", line, col: startCol });
    } else if (ch === "<" || ch === ">" || ch === "=") {
      tokens.push({ kind: "OP_COMPARE", value: ch, line, col: startCol });
    } else if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ kind: "OP_ARITH", value: ch, line, col: startCol });
    } else {
    }
    i++;
    col++;
  }
  tokens.push({ kind: "EOF", value: "", line, col });
  return tokens;
}
class STParser {
  constructor(source) {
    this.pos = 0;
    this.tokens = tokenize(source);
  }
  peek() {
    return this.tokens[this.pos] || this.tokens[this.tokens.length - 1];
  }
  advance() {
    return this.tokens[this.pos++];
  }
  expect(kind, value) {
    const t = this.peek();
    if (t.kind !== kind || value && t.value.toUpperCase() !== value.toUpperCase()) {
      throw new Error(`Expected ${kind}${value ? `(${value})` : ""} at line ${t.line}:${t.col}, got ${t.kind}(${t.value})`);
    }
    return this.advance();
  }
  match(kind, value) {
    const t = this.peek();
    if (t.kind === kind && (!value || t.value.toUpperCase() === value.toUpperCase())) {
      this.advance();
      return true;
    }
    return false;
  }
  isAt(kind, value) {
    const t = this.peek();
    return t.kind === kind && (!value || t.value.toUpperCase() === value.toUpperCase());
  }
  parse() {
    let pouName = "Main";
    let pouType = "program";
    if (this.isAt("KEYWORD", "PROGRAM")) {
      this.advance();
      pouName = this.expect("IDENT").value;
      pouType = "program";
    } else if (this.isAt("KEYWORD", "FUNCTION_BLOCK")) {
      this.advance();
      pouName = this.expect("IDENT").value;
      pouType = "functionBlock";
    } else if (this.isAt("KEYWORD", "FUNCTION")) {
      this.advance();
      pouName = this.expect("IDENT").value;
      pouType = "function";
      if (this.match("COLON")) {
        this.advance();
      }
    }
    const vars = [];
    while (this.isAt("KEYWORD") && this.peek().value.startsWith("VAR")) {
      vars.push(...this.parseVarBlock());
    }
    const statements = [];
    while (!this.isAt("EOF") && !this.isAt("KEYWORD", "END_PROGRAM") && !this.isAt("KEYWORD", "END_FUNCTION_BLOCK") && !this.isAt("KEYWORD", "END_FUNCTION")) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }
    if (this.isAt("KEYWORD") && this.peek().value.startsWith("END_")) {
      this.advance();
    }
    return { pouName, pouType, vars, statements };
  }
  parseVarBlock() {
    const decls = [];
    const kw = this.advance().value;
    const sectionMap = {
      VAR: "local",
      VAR_INPUT: "input",
      VAR_OUTPUT: "output",
      VAR_IN_OUT: "inout",
      VAR_TEMP: "temp",
      VAR_GLOBAL: "global"
    };
    const section = sectionMap[kw] || "local";
    while (!this.isAt("KEYWORD", "END_VAR") && !this.isAt("EOF")) {
      const retain = this.match("KEYWORD", "RETAIN");
      if (this.match("KEYWORD", "CONSTANT")) {
      }
      if (!this.isAt("IDENT")) {
        this.advance();
        continue;
      }
      const name = this.advance().value;
      let address;
      if (this.match("KEYWORD", "AT")) {
        address = "";
        while (!this.isAt("COLON") && !this.isAt("SEMI") && !this.isAt("EOF")) {
          address += this.advance().value;
        }
      }
      this.expect("COLON");
      let dataType = "";
      while (!this.isAt("SEMI") && !this.isAt("ASSIGN") && !this.isAt("EOF") && !this.isAt("KEYWORD", "END_VAR")) {
        dataType += this.advance().value;
      }
      dataType = dataType.trim();
      let initialValue;
      if (this.match("ASSIGN")) {
        initialValue = "";
        while (!this.isAt("SEMI") && !this.isAt("EOF")) {
          initialValue += this.advance().value + " ";
        }
        initialValue = initialValue.trim();
      }
      this.match("SEMI");
      decls.push({ name, dataType, initialValue, retain, address, section });
    }
    this.match("KEYWORD", "END_VAR");
    return decls;
  }
  parseStatement() {
    if (this.isAt("KEYWORD", "IF")) {
      return this.parseIF();
    }
    if (this.isAt("KEYWORD", "FOR")) {
      return this.consumeBlock("FOR", "END_FOR");
    }
    if (this.isAt("KEYWORD", "WHILE")) {
      return this.consumeBlock("WHILE", "END_WHILE");
    }
    if (this.isAt("KEYWORD", "REPEAT")) {
      return this.consumeBlock("REPEAT", "END_REPEAT");
    }
    if (this.isAt("KEYWORD", "CASE")) {
      return this.consumeBlock("CASE", "END_CASE");
    }
    if (this.match("KEYWORD", "RETURN")) {
      this.match("SEMI");
      return { kind: "return" };
    }
    if (this.isAt("IDENT")) {
      return this.parseIdentStatement();
    }
    this.advance();
    return null;
  }
  parseIdentStatement() {
    const ident = this.advance().value;
    let fullIdent = ident;
    while (this.match("DOT")) {
      fullIdent += "." + this.advance().value;
    }
    if (this.isAt("LPAREN")) {
      return this.parseFBCall(ident);
    }
    if (this.match("ASSIGN")) {
      let expr = "";
      while (!this.isAt("SEMI") && !this.isAt("EOF")) {
        expr += this.advance().value + " ";
      }
      this.match("SEMI");
      return { kind: "assignment", assignment: { target: fullIdent, expression: expr.trim() } };
    }
    while (!this.isAt("SEMI") && !this.isAt("EOF")) {
      this.advance();
    }
    this.match("SEMI");
    return null;
  }
  parseFBCall(instanceName) {
    this.expect("LPAREN");
    const params = [];
    while (!this.isAt("RPAREN") && !this.isAt("EOF")) {
      if (this.isAt("IDENT")) {
        const paramName = this.advance().value;
        let direction = "in";
        if (this.match("ASSIGN")) {
          direction = "in";
        } else if (this.match("ARROW")) {
          direction = "out";
        } else {
        }
        let value = "";
        while (!this.isAt("COMMA") && !this.isAt("RPAREN") && !this.isAt("EOF")) {
          value += this.advance().value + " ";
        }
        params.push({ name: paramName, value: value.trim(), direction });
      } else {
        this.advance();
      }
      this.match("COMMA");
    }
    this.match("RPAREN");
    this.match("SEMI");
    const fbType = guessFBType(instanceName, params);
    return {
      kind: "fb_call",
      fbCall: { instanceName, fbType, params }
    };
  }
  parseIF() {
    const startPos = this.pos - 0;
    let raw = "IF ";
    this.advance();
    let depth = 1;
    while (depth > 0 && !this.isAt("EOF")) {
      const t = this.advance();
      raw += t.value + " ";
      if (t.kind === "KEYWORD" && t.value === "IF" && this.tokens[this.pos - 2]?.value !== "END") depth++;
      if (t.kind === "KEYWORD" && t.value === "END_IF") depth--;
    }
    this.match("SEMI");
    return { kind: "if", rawST: raw.trim() };
  }
  consumeBlock(start, end) {
    let raw = start + " ";
    this.advance();
    let depth = 1;
    while (depth > 0 && !this.isAt("EOF")) {
      const t = this.advance();
      raw += t.value + " ";
      if (t.kind === "KEYWORD" && t.value === start) depth++;
      if (t.kind === "KEYWORD" && t.value === end) depth--;
    }
    this.match("SEMI");
    return { kind: start.toLowerCase(), rawST: raw.trim() };
  }
}
function guessFBType(instanceName, params) {
  const upper = instanceName.toUpperCase();
  const fbPatterns = {
    TON: "TON",
    TOF: "TOF",
    TP: "TP",
    CTU: "CTU",
    CTD: "CTD",
    CTUD: "CTUD",
    SR: "SR",
    RS: "RS",
    R_TRIG: "RTRIG",
    F_TRIG: "FTRIG",
    RTRIG: "RTRIG",
    FTRIG: "FTRIG"
  };
  for (const [pattern, fbType] of Object.entries(fbPatterns)) {
    if (upper.includes(pattern)) return fbType;
  }
  const paramNames = new Set(params.map((p) => p.name.toUpperCase()));
  if (paramNames.has("IN") && paramNames.has("PT")) return "TON";
  if (paramNames.has("CU") && paramNames.has("PV")) return "CTU";
  return "MOVE";
}
function parseSTSource(source, filePath) {
  const errors = [];
  const warnings = [];
  try {
    const parser = new STParser(source);
    const result = parser.parse();
    const localTags = result.vars.map((v) => ({
      name: v.name,
      dataType: mapSTDataType(v.dataType),
      initialValue: v.initialValue,
      retain: v.retain,
      address: v.address
    }));
    const { nodes, wires } = statementsToFBD(result.statements, result.vars);
    const fbdProgram = nodes.length > 0 ? { nodes, wires } : { nodes: [], wires: [] };
    const pou = {
      id: `pou-${result.pouName}`,
      name: result.pouName,
      language: nodes.length > 0 ? "FBD" : "ST",
      pouType: result.pouType,
      fbdProgram: nodes.length > 0 ? fbdProgram : void 0,
      stSource: source,
      localTags
    };
    return { pou, errors, warnings };
  } catch (e) {
    errors.push(`ST parse error: ${e}`);
    return {
      pou: {
        id: "pou-parse-error",
        name: "ParseError",
        language: "ST",
        stSource: source,
        localTags: []
      },
      errors,
      warnings
    };
  }
}
function mapSTDataType(typeStr) {
  const upper = typeStr.toUpperCase().trim();
  const map = {
    BOOL: "BOOL",
    INT: "INT",
    DINT: "DINT",
    SINT: "SINT",
    LINT: "LINT",
    UINT: "UINT",
    UDINT: "UDINT",
    USINT: "USINT",
    ULINT: "ULINT",
    REAL: "REAL",
    LREAL: "LREAL",
    BYTE: "BYTE",
    WORD: "WORD",
    DWORD: "DWORD",
    LWORD: "LWORD",
    STRING: "STRING",
    WSTRING: "WSTRING",
    TIME: "TIME",
    DATE: "DATE",
    TON: "BOOL",
    TOF: "BOOL",
    TP: "BOOL",
    CTU: "BOOL",
    CTD: "BOOL"
  };
  if (upper.startsWith("ARRAY")) return "DINT";
  if (upper.startsWith("STRING[")) return "STRING";
  return map[upper] || "DINT";
}
function statementsToFBD(statements, vars) {
  const nodes = [];
  const wires = [];
  let nodeIdx = 0;
  const varTypeMap = new Map(vars.map((v) => [v.name, v.dataType]));
  for (const stmt of statements) {
    if (stmt.kind === "fb_call" && stmt.fbCall) {
      const fb = stmt.fbCall;
      const blockId = `st-fbd-${nodeIdx++}`;
      const inputs = fb.params.filter((p) => p.direction === "in").map((p, i) => ({ id: `${blockId}-in-${i}`, name: p.name, dataType: "BOOL" }));
      const outputs = fb.params.filter((p) => p.direction === "out").map((p, i) => ({ id: `${blockId}-out-${i}`, name: p.name, dataType: "BOOL" }));
      if (outputs.length === 0) {
        outputs.push({ id: `${blockId}-out-Q`, name: "Q", dataType: "BOOL" });
      }
      nodes.push({
        id: blockId,
        type: fb.fbType,
        instanceName: fb.instanceName,
        position: { x: 200, y: nodeIdx * 100 },
        inputs,
        outputs
      });
      for (const param of fb.params.filter((p) => p.direction === "in")) {
        const varId = `st-fbd-var-${nodeIdx++}`;
        nodes.push({
          id: varId,
          type: "IN_VARIABLE",
          tag: { name: param.value, dataType: "BOOL" },
          position: { x: 50, y: nodeIdx * 80 },
          inputs: [],
          outputs: [{ id: `${varId}-out`, name: "OUT", dataType: "BOOL" }]
        });
        const targetPin = inputs.find((p) => p.name === param.name);
        if (targetPin) {
          wires.push({
            id: `wire-${varId}-to-${blockId}`,
            from: { nodeId: varId, pin: "OUT" },
            to: { nodeId: blockId, pin: param.name }
          });
        }
      }
      for (const param of fb.params.filter((p) => p.direction === "out")) {
        const varId = `st-fbd-var-${nodeIdx++}`;
        nodes.push({
          id: varId,
          type: "OUT_VARIABLE",
          tag: { name: param.value, dataType: "BOOL" },
          position: { x: 400, y: nodeIdx * 80 },
          inputs: [{ id: `${varId}-in`, name: "IN", dataType: "BOOL" }],
          outputs: []
        });
        wires.push({
          id: `wire-${blockId}-to-${varId}`,
          from: { nodeId: blockId, pin: param.name },
          to: { nodeId: varId, pin: "IN" }
        });
      }
    } else if (stmt.kind === "assignment" && stmt.assignment) {
      const assign = stmt.assignment;
      const exprUpper = assign.expression.toUpperCase();
      if (exprUpper.includes(" AND ") || exprUpper.includes(" OR ") || exprUpper.includes(" XOR ")) {
        const opMatch = exprUpper.match(/\b(AND|OR|XOR)\b/);
        if (opMatch) {
          const op = opMatch[1];
          const parts = assign.expression.split(new RegExp(`\\b${op}\\b`, "i")).map((s) => s.trim());
          const blockId = `st-fbd-${nodeIdx++}`;
          const inputs = parts.map((_, i) => ({
            id: `${blockId}-in-${i}`,
            name: `IN${i + 1}`,
            dataType: "BOOL"
          }));
          const outputs = [{ id: `${blockId}-out-0`, name: "OUT", dataType: "BOOL" }];
          nodes.push({
            id: blockId,
            type: op,
            position: { x: 200, y: nodeIdx * 100 },
            inputs,
            outputs
          });
          for (let pi = 0; pi < parts.length; pi++) {
            const varId = `st-fbd-var-${nodeIdx++}`;
            nodes.push({
              id: varId,
              type: "IN_VARIABLE",
              tag: { name: parts[pi], dataType: "BOOL" },
              position: { x: 50, y: nodeIdx * 80 },
              inputs: [],
              outputs: [{ id: `${varId}-out`, name: "OUT", dataType: "BOOL" }]
            });
            wires.push({
              id: `wire-${varId}-to-${blockId}`,
              from: { nodeId: varId, pin: "OUT" },
              to: { nodeId: blockId, pin: `IN${pi + 1}` }
            });
          }
          const outVarId = `st-fbd-var-${nodeIdx++}`;
          nodes.push({
            id: outVarId,
            type: "OUT_VARIABLE",
            tag: { name: assign.target, dataType: "BOOL" },
            position: { x: 400, y: nodeIdx * 80 },
            inputs: [{ id: `${outVarId}-in`, name: "IN", dataType: "BOOL" }],
            outputs: []
          });
          wires.push({
            id: `wire-${blockId}-to-${outVarId}`,
            from: { nodeId: blockId, pin: "OUT" },
            to: { nodeId: outVarId, pin: "IN" }
          });
        }
      }
    }
  }
  return { nodes, wires };
}
export {
  parseSTSource
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC92ZW5kb3Ivc3RQYXJzZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qXG4gKiBJRUMgNjExMzEtMyBTdHJ1Y3R1cmVkIFRleHQgUGFyc2VyIChTVCBcdTIxOTIgTm9ybWFsaXplZFBPVSlcbiAqIFJlY3Vyc2l2ZSBkZXNjZW50IHBhcnNlciBmb3IgdGhlIHN1YnNldCBvZiBTVCBjb25zdHJ1Y3RzIHRoYXQgY2FuIG1hcCB0byBDTE06XG4gKiAtIFBST0dSQU0gLyBGVU5DVElPTl9CTE9DSyAvIEZVTkNUSU9OIGRlY2xhcmF0aW9uc1xuICogLSBWQVIgLyBFTkRfVkFSIGJsb2NrcyAobmFtZSwgdHlwZSwgaW5pdGlhbCB2YWx1ZSwgUkVUQUlOLCBBVCBhZGRyZXNzKVxuICogLSBGQiBpbnN0YW5jZSBjYWxsczogVGltZXIoSU4gOj0geCwgUFQgOj0gVCM1cylcbiAqIC0gQXNzaWdubWVudHM6IFggOj0gWSBBTkQgWlxuICogLSBJRiAvIEVMU0lGIC8gRUxTRSAvIEVORF9JRlxuICogLSBDQVNFIC8gRU5EX0NBU0VcbiAqIC0gRk9SIC8gV0hJTEUgLyBSRVBFQVQgbG9vcHMgKHByZXNlcnZlZCBhcyBTVC1vbmx5IGJsb2NrcylcbiAqXG4gKiBEZXNpZ246IGhhbmQtd3JpdHRlbiByZWN1cnNpdmUgZGVzY2VudCBcdTIwMTQgZmFzdCwgemVybyBkZXBlbmRlbmNpZXMsIGhhbmRsZXNcbiAqIGV4YWN0bHkgdGhlIGNvbnN0cnVjdHMgY2xtVG9TVCgpIGdlbmVyYXRlcyBmb3IgcGVyZmVjdCByb3VuZC10cmlwIGZpZGVsaXR5LlxuICovXG5cbmltcG9ydCB0eXBlIHsgTm9ybWFsaXplZFBPVSwgTm9ybWFsaXplZFRhZyB9IGZyb20gJy4vdHlwZXMuanMnO1xuaW1wb3J0IHR5cGUge1xuICBMYWRkZXJQcm9ncmFtLCBGQkRQcm9ncmFtLCBGQkROb2RlLCBGQkRXaXJlLCBQaW4sXG4gIEZCREJsb2NrVHlwZSwgSUVDRGF0YVR5cGUsXG59IGZyb20gJy4uL2xvZ2ljU3RvcmUuanMnO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVG9rZW5pemVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG50eXBlIFRva2VuS2luZCA9XG4gIHwgJ0tFWVdPUkQnIHwgJ0lERU5UJyB8ICdOVU1CRVInIHwgJ1RJTUVfTElURVJBTCcgfCAnU1RSSU5HJ1xuICB8ICdBU1NJR04nIHwgJ0FSUk9XJyB8ICdDT0xPTicgfCAnU0VNSScgfCAnQ09NTUEnIHwgJ0RPVCdcbiAgfCAnTFBBUkVOJyB8ICdSUEFSRU4nIHwgJ0xCUkFDS0VUJyB8ICdSQlJBQ0tFVCdcbiAgfCAnT1BfQ09NUEFSRScgfCAnT1BfQVJJVEgnIHwgJ09QX0xPR0lDJ1xuICB8ICdFT0YnO1xuXG5pbnRlcmZhY2UgVG9rZW4ge1xuICBraW5kOiBUb2tlbktpbmQ7XG4gIHZhbHVlOiBzdHJpbmc7XG4gIGxpbmU6IG51bWJlcjtcbiAgY29sOiBudW1iZXI7XG59XG5cbmNvbnN0IEtFWVdPUkRTID0gbmV3IFNldChbXG4gICdQUk9HUkFNJywgJ0VORF9QUk9HUkFNJywgJ0ZVTkNUSU9OX0JMT0NLJywgJ0VORF9GVU5DVElPTl9CTE9DSycsXG4gICdGVU5DVElPTicsICdFTkRfRlVOQ1RJT04nLCAnVkFSJywgJ1ZBUl9JTlBVVCcsICdWQVJfT1VUUFVUJyxcbiAgJ1ZBUl9JTl9PVVQnLCAnVkFSX1RFTVAnLCAnVkFSX0dMT0JBTCcsICdFTkRfVkFSJyxcbiAgJ0lGJywgJ1RIRU4nLCAnRUxTSUYnLCAnRUxTRScsICdFTkRfSUYnLFxuICAnQ0FTRScsICdPRicsICdFTkRfQ0FTRScsXG4gICdGT1InLCAnVE8nLCAnQlknLCAnRE8nLCAnRU5EX0ZPUicsXG4gICdXSElMRScsICdFTkRfV0hJTEUnLCAnUkVQRUFUJywgJ1VOVElMJywgJ0VORF9SRVBFQVQnLFxuICAnUkVUVVJOJywgJ0VYSVQnLCAnQ09OVElOVUUnLFxuICAnQU5EJywgJ09SJywgJ05PVCcsICdYT1InLCAnTU9EJyxcbiAgJ1RSVUUnLCAnRkFMU0UnLCAnUkVUQUlOJywgJ0NPTlNUQU5UJywgJ0FUJyxcbiAgJ0FSUkFZJywgJ1NUUlVDVCcsICdFTkRfU1RSVUNUJywgJ1RZUEUnLCAnRU5EX1RZUEUnLFxuXSk7XG5cbmZ1bmN0aW9uIHRva2VuaXplKHNvdXJjZTogc3RyaW5nKTogVG9rZW5bXSB7XG4gIGNvbnN0IHRva2VuczogVG9rZW5bXSA9IFtdO1xuICBsZXQgaSA9IDA7XG4gIGxldCBsaW5lID0gMTtcbiAgbGV0IGNvbCA9IDE7XG5cbiAgd2hpbGUgKGkgPCBzb3VyY2UubGVuZ3RoKSB7XG4gICAgLy8gU2tpcCB3aGl0ZXNwYWNlXG4gICAgaWYgKC9cXHMvLnRlc3Qoc291cmNlW2ldKSkge1xuICAgICAgaWYgKHNvdXJjZVtpXSA9PT0gJ1xcbicpIHsgbGluZSsrOyBjb2wgPSAxOyB9IGVsc2UgeyBjb2wrKzsgfVxuICAgICAgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gU2tpcCBibG9jayBjb21tZW50cyAoKiAuLi4gKilcbiAgICBpZiAoc291cmNlW2ldID09PSAnKCcgJiYgc291cmNlW2kgKyAxXSA9PT0gJyonKSB7XG4gICAgICBpICs9IDI7IGNvbCArPSAyO1xuICAgICAgd2hpbGUgKGkgPCBzb3VyY2UubGVuZ3RoIC0gMSAmJiAhKHNvdXJjZVtpXSA9PT0gJyonICYmIHNvdXJjZVtpICsgMV0gPT09ICcpJykpIHtcbiAgICAgICAgaWYgKHNvdXJjZVtpXSA9PT0gJ1xcbicpIHsgbGluZSsrOyBjb2wgPSAxOyB9IGVsc2UgeyBjb2wrKzsgfVxuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgICBpICs9IDI7IGNvbCArPSAyO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gU2tpcCBsaW5lIGNvbW1lbnRzIC8vXG4gICAgaWYgKHNvdXJjZVtpXSA9PT0gJy8nICYmIHNvdXJjZVtpICsgMV0gPT09ICcvJykge1xuICAgICAgd2hpbGUgKGkgPCBzb3VyY2UubGVuZ3RoICYmIHNvdXJjZVtpXSAhPT0gJ1xcbicpIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXJ0Q29sID0gY29sO1xuXG4gICAgLy8gVGltZSBsaXRlcmFsczogVCMuLi4sIFRJTUUjLi4uXG4gICAgY29uc3QgdGltZU1hdGNoID0gc291cmNlLnNsaWNlKGkpLm1hdGNoKC9eKFR8VElNRXxMVHxMVElNRSkjWzAtOWRobXNfXSsvaSk7XG4gICAgaWYgKHRpbWVNYXRjaCkge1xuICAgICAgdG9rZW5zLnB1c2goeyBraW5kOiAnVElNRV9MSVRFUkFMJywgdmFsdWU6IHRpbWVNYXRjaFswXSwgbGluZSwgY29sOiBzdGFydENvbCB9KTtcbiAgICAgIGkgKz0gdGltZU1hdGNoWzBdLmxlbmd0aDsgY29sICs9IHRpbWVNYXRjaFswXS5sZW5ndGg7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBJZGVudGlmaWVycyBhbmQga2V5d29yZHNcbiAgICBpZiAoL1tBLVphLXpfXS8udGVzdChzb3VyY2VbaV0pKSB7XG4gICAgICBsZXQgd29yZCA9ICcnO1xuICAgICAgd2hpbGUgKGkgPCBzb3VyY2UubGVuZ3RoICYmIC9bQS1aYS16MC05X10vLnRlc3Qoc291cmNlW2ldKSkge1xuICAgICAgICB3b3JkICs9IHNvdXJjZVtpXTsgaSsrOyBjb2wrKztcbiAgICAgIH1cbiAgICAgIGNvbnN0IHVwcGVyID0gd29yZC50b1VwcGVyQ2FzZSgpO1xuICAgICAgaWYgKHVwcGVyID09PSAnQU5EJyB8fCB1cHBlciA9PT0gJ09SJyB8fCB1cHBlciA9PT0gJ05PVCcgfHwgdXBwZXIgPT09ICdYT1InKSB7XG4gICAgICAgIHRva2Vucy5wdXNoKHsga2luZDogJ09QX0xPR0lDJywgdmFsdWU6IHVwcGVyLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pO1xuICAgICAgfSBlbHNlIGlmICh1cHBlciA9PT0gJ01PRCcpIHtcbiAgICAgICAgdG9rZW5zLnB1c2goeyBraW5kOiAnT1BfQVJJVEgnLCB2YWx1ZTogdXBwZXIsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7XG4gICAgICB9IGVsc2UgaWYgKEtFWVdPUkRTLmhhcyh1cHBlcikpIHtcbiAgICAgICAgdG9rZW5zLnB1c2goeyBraW5kOiAnS0VZV09SRCcsIHZhbHVlOiB1cHBlciwgbGluZSwgY29sOiBzdGFydENvbCB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRva2Vucy5wdXNoKHsga2luZDogJ0lERU5UJywgdmFsdWU6IHdvcmQsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7XG4gICAgICB9XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBOdW1iZXJzIChpbnQvZmxvYXQvaGV4L2JpbmFyeSlcbiAgICBpZiAoL1swLTldLy50ZXN0KHNvdXJjZVtpXSkpIHtcbiAgICAgIGxldCBudW0gPSAnJztcbiAgICAgIC8vIENoZWNrIGZvciBiYXNlIHByZWZpeDogMTYjLCA4IywgMiNcbiAgICAgIGlmICgvWzAtOV0vLnRlc3Qoc291cmNlW2ldKSAmJiBpICsgMSA8IHNvdXJjZS5sZW5ndGggJiYgc291cmNlW2kgKyAxXSA9PT0gJyMnKSB7XG4gICAgICAgIG51bSA9IHNvdXJjZVtpXSArICcjJzsgaSArPSAyOyBjb2wgKz0gMjtcbiAgICAgICAgd2hpbGUgKGkgPCBzb3VyY2UubGVuZ3RoICYmIC9bMC05QS1GYS1mX10vLnRlc3Qoc291cmNlW2ldKSkge1xuICAgICAgICAgIG51bSArPSBzb3VyY2VbaV07IGkrKzsgY29sKys7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdoaWxlIChpIDwgc291cmNlLmxlbmd0aCAmJiAvWzAtOV8uXS8udGVzdChzb3VyY2VbaV0pKSB7XG4gICAgICAgICAgbnVtICs9IHNvdXJjZVtpXTsgaSsrOyBjb2wrKztcbiAgICAgICAgfVxuICAgICAgICBpZiAoaSA8IHNvdXJjZS5sZW5ndGggJiYgL1tlRV0vLnRlc3Qoc291cmNlW2ldKSkge1xuICAgICAgICAgIG51bSArPSBzb3VyY2VbaV07IGkrKzsgY29sKys7XG4gICAgICAgICAgaWYgKGkgPCBzb3VyY2UubGVuZ3RoICYmIC9bKy1dLy50ZXN0KHNvdXJjZVtpXSkpIHsgbnVtICs9IHNvdXJjZVtpXTsgaSsrOyBjb2wrKzsgfVxuICAgICAgICAgIHdoaWxlIChpIDwgc291cmNlLmxlbmd0aCAmJiAvWzAtOV0vLnRlc3Qoc291cmNlW2ldKSkgeyBudW0gKz0gc291cmNlW2ldOyBpKys7IGNvbCsrOyB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRva2Vucy5wdXNoKHsga2luZDogJ05VTUJFUicsIHZhbHVlOiBudW0sIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBTdHJpbmcgbGl0ZXJhbHNcbiAgICBpZiAoc291cmNlW2ldID09PSAnXFwnJyB8fCBzb3VyY2VbaV0gPT09ICdcIicpIHtcbiAgICAgIGNvbnN0IHF1b3RlID0gc291cmNlW2ldO1xuICAgICAgbGV0IHN0ciA9IHF1b3RlOyBpKys7IGNvbCsrO1xuICAgICAgd2hpbGUgKGkgPCBzb3VyY2UubGVuZ3RoICYmIHNvdXJjZVtpXSAhPT0gcXVvdGUpIHtcbiAgICAgICAgaWYgKHNvdXJjZVtpXSA9PT0gJyQnIHx8IHNvdXJjZVtpXSA9PT0gJ1xcXFwnKSB7IHN0ciArPSBzb3VyY2VbaV07IGkrKzsgY29sKys7IH1cbiAgICAgICAgaWYgKGkgPCBzb3VyY2UubGVuZ3RoKSB7IHN0ciArPSBzb3VyY2VbaV07IGkrKzsgY29sKys7IH1cbiAgICAgIH1cbiAgICAgIGlmIChpIDwgc291cmNlLmxlbmd0aCkgeyBzdHIgKz0gc291cmNlW2ldOyBpKys7IGNvbCsrOyB9XG4gICAgICB0b2tlbnMucHVzaCh7IGtpbmQ6ICdTVFJJTkcnLCB2YWx1ZTogc3RyLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gTXVsdGktY2hhciBvcGVyYXRvcnNcbiAgICBjb25zdCB0d28gPSBzb3VyY2Uuc2xpY2UoaSwgaSArIDIpO1xuICAgIGlmICh0d28gPT09ICc6PScpIHsgdG9rZW5zLnB1c2goeyBraW5kOiAnQVNTSUdOJywgdmFsdWU6ICc6PScsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7IGkgKz0gMjsgY29sICs9IDI7IGNvbnRpbnVlOyB9XG4gICAgaWYgKHR3byA9PT0gJz0+JykgeyB0b2tlbnMucHVzaCh7IGtpbmQ6ICdBUlJPVycsIHZhbHVlOiAnPT4nLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pOyBpICs9IDI7IGNvbCArPSAyOyBjb250aW51ZTsgfVxuICAgIGlmICh0d28gPT09ICc8PicgfHwgdHdvID09PSAnPD0nIHx8IHR3byA9PT0gJz49Jykge1xuICAgICAgdG9rZW5zLnB1c2goeyBraW5kOiAnT1BfQ09NUEFSRScsIHZhbHVlOiB0d28sIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7IGkgKz0gMjsgY29sICs9IDI7IGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFNpbmdsZS1jaGFyXG4gICAgY29uc3QgY2ggPSBzb3VyY2VbaV07XG4gICAgaWYgKGNoID09PSAnOicpIHsgdG9rZW5zLnB1c2goeyBraW5kOiAnQ09MT04nLCB2YWx1ZTogJzonLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pOyB9XG4gICAgZWxzZSBpZiAoY2ggPT09ICc7JykgeyB0b2tlbnMucHVzaCh7IGtpbmQ6ICdTRU1JJywgdmFsdWU6ICc7JywgbGluZSwgY29sOiBzdGFydENvbCB9KTsgfVxuICAgIGVsc2UgaWYgKGNoID09PSAnLCcpIHsgdG9rZW5zLnB1c2goeyBraW5kOiAnQ09NTUEnLCB2YWx1ZTogJywnLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pOyB9XG4gICAgZWxzZSBpZiAoY2ggPT09ICcuJykgeyB0b2tlbnMucHVzaCh7IGtpbmQ6ICdET1QnLCB2YWx1ZTogJy4nLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pOyB9XG4gICAgZWxzZSBpZiAoY2ggPT09ICcoJykgeyB0b2tlbnMucHVzaCh7IGtpbmQ6ICdMUEFSRU4nLCB2YWx1ZTogJygnLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pOyB9XG4gICAgZWxzZSBpZiAoY2ggPT09ICcpJykgeyB0b2tlbnMucHVzaCh7IGtpbmQ6ICdSUEFSRU4nLCB2YWx1ZTogJyknLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pOyB9XG4gICAgZWxzZSBpZiAoY2ggPT09ICdbJykgeyB0b2tlbnMucHVzaCh7IGtpbmQ6ICdMQlJBQ0tFVCcsIHZhbHVlOiAnWycsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7IH1cbiAgICBlbHNlIGlmIChjaCA9PT0gJ10nKSB7IHRva2Vucy5wdXNoKHsga2luZDogJ1JCUkFDS0VUJywgdmFsdWU6ICddJywgbGluZSwgY29sOiBzdGFydENvbCB9KTsgfVxuICAgIGVsc2UgaWYgKGNoID09PSAnPCcgfHwgY2ggPT09ICc+JyB8fCBjaCA9PT0gJz0nKSB7IHRva2Vucy5wdXNoKHsga2luZDogJ09QX0NPTVBBUkUnLCB2YWx1ZTogY2gsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7IH1cbiAgICBlbHNlIGlmIChjaCA9PT0gJysnIHx8IGNoID09PSAnLScgfHwgY2ggPT09ICcqJyB8fCBjaCA9PT0gJy8nKSB7IHRva2Vucy5wdXNoKHsga2luZDogJ09QX0FSSVRIJywgdmFsdWU6IGNoLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pOyB9XG4gICAgZWxzZSB7IC8qIHNraXAgdW5rbm93biBjaGFyICovIH1cbiAgICBpKys7IGNvbCsrO1xuICB9XG5cbiAgdG9rZW5zLnB1c2goeyBraW5kOiAnRU9GJywgdmFsdWU6ICcnLCBsaW5lLCBjb2wgfSk7XG4gIHJldHVybiB0b2tlbnM7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBQYXJzZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmludGVyZmFjZSBQYXJzZWRWYXJEZWNsIHtcbiAgbmFtZTogc3RyaW5nO1xuICBkYXRhVHlwZTogc3RyaW5nO1xuICBpbml0aWFsVmFsdWU/OiBzdHJpbmc7XG4gIHJldGFpbj86IGJvb2xlYW47XG4gIGFkZHJlc3M/OiBzdHJpbmc7XG4gIHNlY3Rpb246ICdsb2NhbCcgfCAnaW5wdXQnIHwgJ291dHB1dCcgfCAnaW5vdXQnIHwgJ3RlbXAnIHwgJ2dsb2JhbCc7XG59XG5cbmludGVyZmFjZSBQYXJzZWRGQkNhbGwge1xuICBpbnN0YW5jZU5hbWU6IHN0cmluZztcbiAgZmJUeXBlOiBzdHJpbmc7XG4gIHBhcmFtczogeyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmc7IGRpcmVjdGlvbjogJ2luJyB8ICdvdXQnIH1bXTtcbn1cblxuaW50ZXJmYWNlIFBhcnNlZEFzc2lnbm1lbnQge1xuICB0YXJnZXQ6IHN0cmluZztcbiAgZXhwcmVzc2lvbjogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgUGFyc2VkU3RhdGVtZW50IHtcbiAga2luZDogJ2ZiX2NhbGwnIHwgJ2Fzc2lnbm1lbnQnIHwgJ2lmJyB8ICdjYXNlJyB8ICdmb3InIHwgJ3doaWxlJyB8ICdyZXBlYXQnIHwgJ3JldHVybic7XG4gIGZiQ2FsbD86IFBhcnNlZEZCQ2FsbDtcbiAgYXNzaWdubWVudD86IFBhcnNlZEFzc2lnbm1lbnQ7XG4gIHJhd1NUPzogc3RyaW5nO1xufVxuXG5jbGFzcyBTVFBhcnNlciB7XG4gIHByaXZhdGUgdG9rZW5zOiBUb2tlbltdO1xuICBwcml2YXRlIHBvczogbnVtYmVyID0gMDtcblxuICBjb25zdHJ1Y3Rvcihzb3VyY2U6IHN0cmluZykge1xuICAgIHRoaXMudG9rZW5zID0gdG9rZW5pemUoc291cmNlKTtcbiAgfVxuXG4gIHByaXZhdGUgcGVlaygpOiBUb2tlbiB7IHJldHVybiB0aGlzLnRva2Vuc1t0aGlzLnBvc10gfHwgdGhpcy50b2tlbnNbdGhpcy50b2tlbnMubGVuZ3RoIC0gMV07IH1cbiAgcHJpdmF0ZSBhZHZhbmNlKCk6IFRva2VuIHsgcmV0dXJuIHRoaXMudG9rZW5zW3RoaXMucG9zKytdOyB9XG4gIHByaXZhdGUgZXhwZWN0KGtpbmQ6IFRva2VuS2luZCwgdmFsdWU/OiBzdHJpbmcpOiBUb2tlbiB7XG4gICAgY29uc3QgdCA9IHRoaXMucGVlaygpO1xuICAgIGlmICh0LmtpbmQgIT09IGtpbmQgfHwgKHZhbHVlICYmIHQudmFsdWUudG9VcHBlckNhc2UoKSAhPT0gdmFsdWUudG9VcHBlckNhc2UoKSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHtraW5kfSR7dmFsdWUgPyBgKCR7dmFsdWV9KWAgOiAnJ30gYXQgbGluZSAke3QubGluZX06JHt0LmNvbH0sIGdvdCAke3Qua2luZH0oJHt0LnZhbHVlfSlgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWR2YW5jZSgpO1xuICB9XG4gIHByaXZhdGUgbWF0Y2goa2luZDogVG9rZW5LaW5kLCB2YWx1ZT86IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHQgPSB0aGlzLnBlZWsoKTtcbiAgICBpZiAodC5raW5kID09PSBraW5kICYmICghdmFsdWUgfHwgdC52YWx1ZS50b1VwcGVyQ2FzZSgpID09PSB2YWx1ZS50b1VwcGVyQ2FzZSgpKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHByaXZhdGUgaXNBdChraW5kOiBUb2tlbktpbmQsIHZhbHVlPzogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgdCA9IHRoaXMucGVlaygpO1xuICAgIHJldHVybiB0LmtpbmQgPT09IGtpbmQgJiYgKCF2YWx1ZSB8fCB0LnZhbHVlLnRvVXBwZXJDYXNlKCkgPT09IHZhbHVlLnRvVXBwZXJDYXNlKCkpO1xuICB9XG5cbiAgcGFyc2UoKTogeyBwb3VOYW1lOiBzdHJpbmc7IHBvdVR5cGU6IHN0cmluZzsgdmFyczogUGFyc2VkVmFyRGVjbFtdOyBzdGF0ZW1lbnRzOiBQYXJzZWRTdGF0ZW1lbnRbXSB9IHtcbiAgICBsZXQgcG91TmFtZSA9ICdNYWluJztcbiAgICBsZXQgcG91VHlwZSA9ICdwcm9ncmFtJztcblxuICAgIC8vIE9wdGlvbmFsIFBPVSBkZWNsYXJhdGlvblxuICAgIGlmICh0aGlzLmlzQXQoJ0tFWVdPUkQnLCAnUFJPR1JBTScpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHBvdU5hbWUgPSB0aGlzLmV4cGVjdCgnSURFTlQnKS52YWx1ZTtcbiAgICAgIHBvdVR5cGUgPSAncHJvZ3JhbSc7XG4gICAgfSBlbHNlIGlmICh0aGlzLmlzQXQoJ0tFWVdPUkQnLCAnRlVOQ1RJT05fQkxPQ0snKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICBwb3VOYW1lID0gdGhpcy5leHBlY3QoJ0lERU5UJykudmFsdWU7XG4gICAgICBwb3VUeXBlID0gJ2Z1bmN0aW9uQmxvY2snO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc0F0KCdLRVlXT1JEJywgJ0ZVTkNUSU9OJykpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcG91TmFtZSA9IHRoaXMuZXhwZWN0KCdJREVOVCcpLnZhbHVlO1xuICAgICAgcG91VHlwZSA9ICdmdW5jdGlvbic7XG4gICAgICBpZiAodGhpcy5tYXRjaCgnQ09MT04nKSkgeyB0aGlzLmFkdmFuY2UoKTsgfSAvLyByZXR1cm4gdHlwZVxuICAgIH1cblxuICAgIC8vIFBhcnNlIFZBUiBibG9ja3NcbiAgICBjb25zdCB2YXJzOiBQYXJzZWRWYXJEZWNsW10gPSBbXTtcbiAgICB3aGlsZSAodGhpcy5pc0F0KCdLRVlXT1JEJykgJiYgdGhpcy5wZWVrKCkudmFsdWUuc3RhcnRzV2l0aCgnVkFSJykpIHtcbiAgICAgIHZhcnMucHVzaCguLi50aGlzLnBhcnNlVmFyQmxvY2soKSk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2Ugc3RhdGVtZW50cyB1bnRpbCBFTkRfUFJPR1JBTS9FTkRfRlVOQ1RJT05fQkxPQ0svRU5EX0ZVTkNUSU9OL0VPRlxuICAgIGNvbnN0IHN0YXRlbWVudHM6IFBhcnNlZFN0YXRlbWVudFtdID0gW107XG4gICAgd2hpbGUgKCF0aGlzLmlzQXQoJ0VPRicpICYmICF0aGlzLmlzQXQoJ0tFWVdPUkQnLCAnRU5EX1BST0dSQU0nKSAmJlxuICAgICAgICAgICAhdGhpcy5pc0F0KCdLRVlXT1JEJywgJ0VORF9GVU5DVElPTl9CTE9DSycpICYmICF0aGlzLmlzQXQoJ0tFWVdPUkQnLCAnRU5EX0ZVTkNUSU9OJykpIHtcbiAgICAgIGNvbnN0IHN0bXQgPSB0aGlzLnBhcnNlU3RhdGVtZW50KCk7XG4gICAgICBpZiAoc3RtdCkgc3RhdGVtZW50cy5wdXNoKHN0bXQpO1xuICAgIH1cblxuICAgIC8vIENvbnN1bWUgRU5EX3h4eFxuICAgIGlmICh0aGlzLmlzQXQoJ0tFWVdPUkQnKSAmJiB0aGlzLnBlZWsoKS52YWx1ZS5zdGFydHNXaXRoKCdFTkRfJykpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIH1cblxuICAgIHJldHVybiB7IHBvdU5hbWUsIHBvdVR5cGUsIHZhcnMsIHN0YXRlbWVudHMgfTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VWYXJCbG9jaygpOiBQYXJzZWRWYXJEZWNsW10ge1xuICAgIGNvbnN0IGRlY2xzOiBQYXJzZWRWYXJEZWNsW10gPSBbXTtcbiAgICBjb25zdCBrdyA9IHRoaXMuYWR2YW5jZSgpLnZhbHVlOyAvLyBWQVIsIFZBUl9JTlBVVCwgZXRjLlxuICAgIGNvbnN0IHNlY3Rpb25NYXA6IFJlY29yZDxzdHJpbmcsIFBhcnNlZFZhckRlY2xbJ3NlY3Rpb24nXT4gPSB7XG4gICAgICBWQVI6ICdsb2NhbCcsIFZBUl9JTlBVVDogJ2lucHV0JywgVkFSX09VVFBVVDogJ291dHB1dCcsXG4gICAgICBWQVJfSU5fT1VUOiAnaW5vdXQnLCBWQVJfVEVNUDogJ3RlbXAnLCBWQVJfR0xPQkFMOiAnZ2xvYmFsJyxcbiAgICB9O1xuICAgIGNvbnN0IHNlY3Rpb24gPSBzZWN0aW9uTWFwW2t3XSB8fCAnbG9jYWwnO1xuXG4gICAgd2hpbGUgKCF0aGlzLmlzQXQoJ0tFWVdPUkQnLCAnRU5EX1ZBUicpICYmICF0aGlzLmlzQXQoJ0VPRicpKSB7XG4gICAgICBjb25zdCByZXRhaW4gPSB0aGlzLm1hdGNoKCdLRVlXT1JEJywgJ1JFVEFJTicpO1xuICAgICAgaWYgKHRoaXMubWF0Y2goJ0tFWVdPUkQnLCAnQ09OU1RBTlQnKSkgeyAvKiBza2lwICovIH1cblxuICAgICAgaWYgKCF0aGlzLmlzQXQoJ0lERU5UJykpIHsgdGhpcy5hZHZhbmNlKCk7IGNvbnRpbnVlOyB9XG4gICAgICBjb25zdCBuYW1lID0gdGhpcy5hZHZhbmNlKCkudmFsdWU7XG5cbiAgICAgIC8vIE9wdGlvbmFsIEFUIGFkZHJlc3NcbiAgICAgIGxldCBhZGRyZXNzOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICBpZiAodGhpcy5tYXRjaCgnS0VZV09SRCcsICdBVCcpKSB7XG4gICAgICAgIC8vIENvbnN1bWUgdGhlIGFkZHJlc3MgdG9rZW4gKGUuZy4sICVJWDAuMClcbiAgICAgICAgYWRkcmVzcyA9ICcnO1xuICAgICAgICB3aGlsZSAoIXRoaXMuaXNBdCgnQ09MT04nKSAmJiAhdGhpcy5pc0F0KCdTRU1JJykgJiYgIXRoaXMuaXNBdCgnRU9GJykpIHtcbiAgICAgICAgICBhZGRyZXNzICs9IHRoaXMuYWR2YW5jZSgpLnZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZXhwZWN0KCdDT0xPTicpO1xuICAgICAgbGV0IGRhdGFUeXBlID0gJyc7XG4gICAgICB3aGlsZSAoIXRoaXMuaXNBdCgnU0VNSScpICYmICF0aGlzLmlzQXQoJ0FTU0lHTicpICYmICF0aGlzLmlzQXQoJ0VPRicpICYmXG4gICAgICAgICAgICAgISh0aGlzLmlzQXQoJ0tFWVdPUkQnLCAnRU5EX1ZBUicpKSkge1xuICAgICAgICBkYXRhVHlwZSArPSB0aGlzLmFkdmFuY2UoKS52YWx1ZTtcbiAgICAgIH1cbiAgICAgIGRhdGFUeXBlID0gZGF0YVR5cGUudHJpbSgpO1xuXG4gICAgICBsZXQgaW5pdGlhbFZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICBpZiAodGhpcy5tYXRjaCgnQVNTSUdOJykpIHtcbiAgICAgICAgaW5pdGlhbFZhbHVlID0gJyc7XG4gICAgICAgIHdoaWxlICghdGhpcy5pc0F0KCdTRU1JJykgJiYgIXRoaXMuaXNBdCgnRU9GJykpIHtcbiAgICAgICAgICBpbml0aWFsVmFsdWUgKz0gdGhpcy5hZHZhbmNlKCkudmFsdWUgKyAnICc7XG4gICAgICAgIH1cbiAgICAgICAgaW5pdGlhbFZhbHVlID0gaW5pdGlhbFZhbHVlLnRyaW0oKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubWF0Y2goJ1NFTUknKTtcblxuICAgICAgZGVjbHMucHVzaCh7IG5hbWUsIGRhdGFUeXBlLCBpbml0aWFsVmFsdWUsIHJldGFpbiwgYWRkcmVzcywgc2VjdGlvbiB9KTtcbiAgICB9XG4gICAgdGhpcy5tYXRjaCgnS0VZV09SRCcsICdFTkRfVkFSJyk7XG4gICAgcmV0dXJuIGRlY2xzO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVN0YXRlbWVudCgpOiBQYXJzZWRTdGF0ZW1lbnQgfCBudWxsIHtcbiAgICAvLyBJRlxuICAgIGlmICh0aGlzLmlzQXQoJ0tFWVdPUkQnLCAnSUYnKSkgeyByZXR1cm4gdGhpcy5wYXJzZUlGKCk7IH1cbiAgICAvLyBGT1JcbiAgICBpZiAodGhpcy5pc0F0KCdLRVlXT1JEJywgJ0ZPUicpKSB7IHJldHVybiB0aGlzLmNvbnN1bWVCbG9jaygnRk9SJywgJ0VORF9GT1InKTsgfVxuICAgIC8vIFdISUxFXG4gICAgaWYgKHRoaXMuaXNBdCgnS0VZV09SRCcsICdXSElMRScpKSB7IHJldHVybiB0aGlzLmNvbnN1bWVCbG9jaygnV0hJTEUnLCAnRU5EX1dISUxFJyk7IH1cbiAgICAvLyBSRVBFQVRcbiAgICBpZiAodGhpcy5pc0F0KCdLRVlXT1JEJywgJ1JFUEVBVCcpKSB7IHJldHVybiB0aGlzLmNvbnN1bWVCbG9jaygnUkVQRUFUJywgJ0VORF9SRVBFQVQnKTsgfVxuICAgIC8vIENBU0VcbiAgICBpZiAodGhpcy5pc0F0KCdLRVlXT1JEJywgJ0NBU0UnKSkgeyByZXR1cm4gdGhpcy5jb25zdW1lQmxvY2soJ0NBU0UnLCAnRU5EX0NBU0UnKTsgfVxuICAgIC8vIFJFVFVSTlxuICAgIGlmICh0aGlzLm1hdGNoKCdLRVlXT1JEJywgJ1JFVFVSTicpKSB7IHRoaXMubWF0Y2goJ1NFTUknKTsgcmV0dXJuIHsga2luZDogJ3JldHVybicgfTsgfVxuXG4gICAgLy8gSWRlbnRpZmllciBcdTIwMTQgZWl0aGVyIEZCIGNhbGwgb3IgYXNzaWdubWVudFxuICAgIGlmICh0aGlzLmlzQXQoJ0lERU5UJykpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlSWRlbnRTdGF0ZW1lbnQoKTtcbiAgICB9XG5cbiAgICAvLyBTa2lwIHVua25vd25cbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VJZGVudFN0YXRlbWVudCgpOiBQYXJzZWRTdGF0ZW1lbnQge1xuICAgIGNvbnN0IGlkZW50ID0gdGhpcy5hZHZhbmNlKCkudmFsdWU7XG5cbiAgICAvLyBDaGVjayBmb3IgZG90LWFjY2VzcyAoZS5nLiwgVGltZXIuUSlcbiAgICBsZXQgZnVsbElkZW50ID0gaWRlbnQ7XG4gICAgd2hpbGUgKHRoaXMubWF0Y2goJ0RPVCcpKSB7XG4gICAgICBmdWxsSWRlbnQgKz0gJy4nICsgdGhpcy5hZHZhbmNlKCkudmFsdWU7XG4gICAgfVxuXG4gICAgLy8gRkIgY2FsbDogSWRlbnQocGFyYW1zKSBcdTIwMTQgaGFuZGxlIGJvdGggbmFtZWQgYW5kIHBvc2l0aW9uYWwgcGFyYW1zXG4gICAgaWYgKHRoaXMuaXNBdCgnTFBBUkVOJykpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlRkJDYWxsKGlkZW50KTtcbiAgICB9XG5cbiAgICAvLyBBc3NpZ25tZW50OiBpZGVudCA6PSBleHByO1xuICAgIGlmICh0aGlzLm1hdGNoKCdBU1NJR04nKSkge1xuICAgICAgbGV0IGV4cHIgPSAnJztcbiAgICAgIHdoaWxlICghdGhpcy5pc0F0KCdTRU1JJykgJiYgIXRoaXMuaXNBdCgnRU9GJykpIHtcbiAgICAgICAgZXhwciArPSB0aGlzLmFkdmFuY2UoKS52YWx1ZSArICcgJztcbiAgICAgIH1cbiAgICAgIHRoaXMubWF0Y2goJ1NFTUknKTtcbiAgICAgIHJldHVybiB7IGtpbmQ6ICdhc3NpZ25tZW50JywgYXNzaWdubWVudDogeyB0YXJnZXQ6IGZ1bGxJZGVudCwgZXhwcmVzc2lvbjogZXhwci50cmltKCkgfSB9O1xuICAgIH1cblxuICAgIC8vIEJhcmUgc3RhdGVtZW50IChyYXJlKSBcdTIwMTQgc2tpcCB0byBzZW1pY29sb25cbiAgICB3aGlsZSAoIXRoaXMuaXNBdCgnU0VNSScpICYmICF0aGlzLmlzQXQoJ0VPRicpKSB7IHRoaXMuYWR2YW5jZSgpOyB9XG4gICAgdGhpcy5tYXRjaCgnU0VNSScpO1xuICAgIHJldHVybiBudWxsIGFzIGFueTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VGQkNhbGwoaW5zdGFuY2VOYW1lOiBzdHJpbmcpOiBQYXJzZWRTdGF0ZW1lbnQge1xuICAgIHRoaXMuZXhwZWN0KCdMUEFSRU4nKTtcbiAgICBjb25zdCBwYXJhbXM6IFBhcnNlZEZCQ2FsbFsncGFyYW1zJ10gPSBbXTtcblxuICAgIHdoaWxlICghdGhpcy5pc0F0KCdSUEFSRU4nKSAmJiAhdGhpcy5pc0F0KCdFT0YnKSkge1xuICAgICAgaWYgKHRoaXMuaXNBdCgnSURFTlQnKSkge1xuICAgICAgICBjb25zdCBwYXJhbU5hbWUgPSB0aGlzLmFkdmFuY2UoKS52YWx1ZTtcbiAgICAgICAgbGV0IGRpcmVjdGlvbjogJ2luJyB8ICdvdXQnID0gJ2luJztcbiAgICAgICAgaWYgKHRoaXMubWF0Y2goJ0FTU0lHTicpKSB7IGRpcmVjdGlvbiA9ICdpbic7IH1cbiAgICAgICAgZWxzZSBpZiAodGhpcy5tYXRjaCgnQVJST1cnKSkgeyBkaXJlY3Rpb24gPSAnb3V0JzsgfVxuICAgICAgICBlbHNlIHsgLyogcG9zaXRpb25hbCBcdTIwMTQgdHJlYXQgYXMgaW4gKi8gfVxuXG4gICAgICAgIGxldCB2YWx1ZSA9ICcnO1xuICAgICAgICB3aGlsZSAoIXRoaXMuaXNBdCgnQ09NTUEnKSAmJiAhdGhpcy5pc0F0KCdSUEFSRU4nKSAmJiAhdGhpcy5pc0F0KCdFT0YnKSkge1xuICAgICAgICAgIHZhbHVlICs9IHRoaXMuYWR2YW5jZSgpLnZhbHVlICsgJyAnO1xuICAgICAgICB9XG4gICAgICAgIHBhcmFtcy5wdXNoKHsgbmFtZTogcGFyYW1OYW1lLCB2YWx1ZTogdmFsdWUudHJpbSgpLCBkaXJlY3Rpb24gfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubWF0Y2goJ0NPTU1BJyk7XG4gICAgfVxuICAgIHRoaXMubWF0Y2goJ1JQQVJFTicpO1xuICAgIHRoaXMubWF0Y2goJ1NFTUknKTtcblxuICAgIC8vIERldGVybWluZSBGQiB0eXBlIGZyb20gdmFyaWFibGUgZGVjbGFyYXRpb25zIGNvbnRleHQgb3IgaW5zdGFuY2UgbmFtZSBwYXR0ZXJuXG4gICAgY29uc3QgZmJUeXBlID0gZ3Vlc3NGQlR5cGUoaW5zdGFuY2VOYW1lLCBwYXJhbXMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGtpbmQ6ICdmYl9jYWxsJyxcbiAgICAgIGZiQ2FsbDogeyBpbnN0YW5jZU5hbWUsIGZiVHlwZSwgcGFyYW1zIH0sXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VJRigpOiBQYXJzZWRTdGF0ZW1lbnQge1xuICAgIGNvbnN0IHN0YXJ0UG9zID0gdGhpcy5wb3MgLSAwO1xuICAgIGxldCByYXcgPSAnSUYgJztcbiAgICB0aGlzLmFkdmFuY2UoKTsgLy8gY29uc3VtZSBJRlxuICAgIGxldCBkZXB0aCA9IDE7XG4gICAgd2hpbGUgKGRlcHRoID4gMCAmJiAhdGhpcy5pc0F0KCdFT0YnKSkge1xuICAgICAgY29uc3QgdCA9IHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmF3ICs9IHQudmFsdWUgKyAnICc7XG4gICAgICBpZiAodC5raW5kID09PSAnS0VZV09SRCcgJiYgdC52YWx1ZSA9PT0gJ0lGJyAmJiB0aGlzLnRva2Vuc1t0aGlzLnBvcyAtIDJdPy52YWx1ZSAhPT0gJ0VORCcpIGRlcHRoKys7XG4gICAgICBpZiAodC5raW5kID09PSAnS0VZV09SRCcgJiYgdC52YWx1ZSA9PT0gJ0VORF9JRicpIGRlcHRoLS07XG4gICAgfVxuICAgIHRoaXMubWF0Y2goJ1NFTUknKTtcbiAgICByZXR1cm4geyBraW5kOiAnaWYnLCByYXdTVDogcmF3LnRyaW0oKSB9O1xuICB9XG5cbiAgcHJpdmF0ZSBjb25zdW1lQmxvY2soc3RhcnQ6IHN0cmluZywgZW5kOiBzdHJpbmcpOiBQYXJzZWRTdGF0ZW1lbnQge1xuICAgIGxldCByYXcgPSBzdGFydCArICcgJztcbiAgICB0aGlzLmFkdmFuY2UoKTsgLy8gY29uc3VtZSBzdGFydCBrZXl3b3JkXG4gICAgbGV0IGRlcHRoID0gMTtcbiAgICB3aGlsZSAoZGVwdGggPiAwICYmICF0aGlzLmlzQXQoJ0VPRicpKSB7XG4gICAgICBjb25zdCB0ID0gdGhpcy5hZHZhbmNlKCk7XG4gICAgICByYXcgKz0gdC52YWx1ZSArICcgJztcbiAgICAgIGlmICh0LmtpbmQgPT09ICdLRVlXT1JEJyAmJiB0LnZhbHVlID09PSBzdGFydCkgZGVwdGgrKztcbiAgICAgIGlmICh0LmtpbmQgPT09ICdLRVlXT1JEJyAmJiB0LnZhbHVlID09PSBlbmQpIGRlcHRoLS07XG4gICAgfVxuICAgIHRoaXMubWF0Y2goJ1NFTUknKTtcbiAgICByZXR1cm4geyBraW5kOiBzdGFydC50b0xvd2VyQ2FzZSgpIGFzIGFueSwgcmF3U1Q6IHJhdy50cmltKCkgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBndWVzc0ZCVHlwZShpbnN0YW5jZU5hbWU6IHN0cmluZywgcGFyYW1zOiBQYXJzZWRGQkNhbGxbJ3BhcmFtcyddKTogc3RyaW5nIHtcbiAgY29uc3QgdXBwZXIgPSBpbnN0YW5jZU5hbWUudG9VcHBlckNhc2UoKTtcbiAgY29uc3QgZmJQYXR0ZXJuczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICBUT046ICdUT04nLCBUT0Y6ICdUT0YnLCBUUDogJ1RQJyxcbiAgICBDVFU6ICdDVFUnLCBDVEQ6ICdDVEQnLCBDVFVEOiAnQ1RVRCcsXG4gICAgU1I6ICdTUicsIFJTOiAnUlMnLFxuICAgIFJfVFJJRzogJ1JUUklHJywgRl9UUklHOiAnRlRSSUcnLCBSVFJJRzogJ1JUUklHJywgRlRSSUc6ICdGVFJJRycsXG4gIH07XG4gIC8vIENoZWNrIGlmIGluc3RhbmNlIG5hbWUgY29udGFpbnMgYSBrbm93biBGQiB0eXBlXG4gIGZvciAoY29uc3QgW3BhdHRlcm4sIGZiVHlwZV0gb2YgT2JqZWN0LmVudHJpZXMoZmJQYXR0ZXJucykpIHtcbiAgICBpZiAodXBwZXIuaW5jbHVkZXMocGF0dGVybikpIHJldHVybiBmYlR5cGU7XG4gIH1cbiAgLy8gQ2hlY2sgcGFyYW1zIGZvciB0aW1lci9jb3VudGVyIHNpZ25hdHVyZXNcbiAgY29uc3QgcGFyYW1OYW1lcyA9IG5ldyBTZXQocGFyYW1zLm1hcChwID0+IHAubmFtZS50b1VwcGVyQ2FzZSgpKSk7XG4gIGlmIChwYXJhbU5hbWVzLmhhcygnSU4nKSAmJiBwYXJhbU5hbWVzLmhhcygnUFQnKSkgcmV0dXJuICdUT04nO1xuICBpZiAocGFyYW1OYW1lcy5oYXMoJ0NVJykgJiYgcGFyYW1OYW1lcy5oYXMoJ1BWJykpIHJldHVybiAnQ1RVJztcbiAgLy8gRmFsbCBiYWNrIHRvIE1PVkUgYXMgYSBzYWZlIGdlbmVyaWMgYmxvY2sgXHUyMDE0ICdDVVNUT00nIGlzIG5vdCBhIHZhbGlkIEZCREJsb2NrVHlwZVxuICByZXR1cm4gJ01PVkUnO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUHVibGljIEFQSSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGludGVyZmFjZSBTVFBhcnNlUmVzdWx0IHtcbiAgcG91OiBOb3JtYWxpemVkUE9VO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xuICB3YXJuaW5nczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVNUU291cmNlKHNvdXJjZTogc3RyaW5nLCBmaWxlUGF0aDogc3RyaW5nKTogU1RQYXJzZVJlc3VsdCB7XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgU1RQYXJzZXIoc291cmNlKTtcbiAgICBjb25zdCByZXN1bHQgPSBwYXJzZXIucGFyc2UoKTtcblxuICAgIC8vIENvbnZlcnQgcGFyc2VkIHZhcnMgdG8gTm9ybWFsaXplZFRhZ1tdXG4gICAgY29uc3QgbG9jYWxUYWdzOiBOb3JtYWxpemVkVGFnW10gPSByZXN1bHQudmFycy5tYXAodiA9PiAoe1xuICAgICAgbmFtZTogdi5uYW1lLFxuICAgICAgZGF0YVR5cGU6IG1hcFNURGF0YVR5cGUodi5kYXRhVHlwZSksXG4gICAgICBpbml0aWFsVmFsdWU6IHYuaW5pdGlhbFZhbHVlLFxuICAgICAgcmV0YWluOiB2LnJldGFpbixcbiAgICAgIGFkZHJlc3M6IHYuYWRkcmVzcyxcbiAgICB9KSk7XG5cbiAgICAvLyBDb252ZXJ0IEZCIGNhbGxzICsgYXNzaWdubWVudHMgdG8gYW4gRkJEIHByb2dyYW1cbiAgICBjb25zdCB7IG5vZGVzLCB3aXJlcyB9ID0gc3RhdGVtZW50c1RvRkJEKHJlc3VsdC5zdGF0ZW1lbnRzLCByZXN1bHQudmFycyk7XG5cbiAgICBjb25zdCBmYmRQcm9ncmFtOiBGQkRQcm9ncmFtID0gbm9kZXMubGVuZ3RoID4gMCA/IHsgbm9kZXMsIHdpcmVzIH0gOiB7IG5vZGVzOiBbXSwgd2lyZXM6IFtdIH07XG5cbiAgICBjb25zdCBwb3U6IE5vcm1hbGl6ZWRQT1UgPSB7XG4gICAgICBpZDogYHBvdS0ke3Jlc3VsdC5wb3VOYW1lfWAsXG4gICAgICBuYW1lOiByZXN1bHQucG91TmFtZSxcbiAgICAgIGxhbmd1YWdlOiBub2Rlcy5sZW5ndGggPiAwID8gJ0ZCRCcgOiAnU1QnLFxuICAgICAgcG91VHlwZTogcmVzdWx0LnBvdVR5cGUgYXMgYW55LFxuICAgICAgZmJkUHJvZ3JhbTogbm9kZXMubGVuZ3RoID4gMCA/IGZiZFByb2dyYW0gOiB1bmRlZmluZWQsXG4gICAgICBzdFNvdXJjZTogc291cmNlLFxuICAgICAgbG9jYWxUYWdzLFxuICAgIH07XG5cbiAgICByZXR1cm4geyBwb3UsIGVycm9ycywgd2FybmluZ3MgfTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGVycm9ycy5wdXNoKGBTVCBwYXJzZSBlcnJvcjogJHtlfWApO1xuICAgIHJldHVybiB7XG4gICAgICBwb3U6IHtcbiAgICAgICAgaWQ6ICdwb3UtcGFyc2UtZXJyb3InLFxuICAgICAgICBuYW1lOiAnUGFyc2VFcnJvcicsXG4gICAgICAgIGxhbmd1YWdlOiAnU1QnLFxuICAgICAgICBzdFNvdXJjZTogc291cmNlLFxuICAgICAgICBsb2NhbFRhZ3M6IFtdLFxuICAgICAgfSxcbiAgICAgIGVycm9ycyxcbiAgICAgIHdhcm5pbmdzLFxuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gbWFwU1REYXRhVHlwZSh0eXBlU3RyOiBzdHJpbmcpOiBJRUNEYXRhVHlwZSB7XG4gIGNvbnN0IHVwcGVyID0gdHlwZVN0ci50b1VwcGVyQ2FzZSgpLnRyaW0oKTtcbiAgY29uc3QgbWFwOiBSZWNvcmQ8c3RyaW5nLCBJRUNEYXRhVHlwZT4gPSB7XG4gICAgQk9PTDogJ0JPT0wnLCBJTlQ6ICdJTlQnLCBESU5UOiAnRElOVCcsIFNJTlQ6ICdTSU5UJywgTElOVDogJ0xJTlQnLFxuICAgIFVJTlQ6ICdVSU5UJywgVURJTlQ6ICdVRElOVCcsIFVTSU5UOiAnVVNJTlQnLCBVTElOVDogJ1VMSU5UJyxcbiAgICBSRUFMOiAnUkVBTCcsIExSRUFMOiAnTFJFQUwnLFxuICAgIEJZVEU6ICdCWVRFJywgV09SRDogJ1dPUkQnLCBEV09SRDogJ0RXT1JEJywgTFdPUkQ6ICdMV09SRCcsXG4gICAgU1RSSU5HOiAnU1RSSU5HJywgV1NUUklORzogJ1dTVFJJTkcnLCBUSU1FOiAnVElNRScsIERBVEU6ICdEQVRFJyxcbiAgICBUT046ICdCT09MJywgVE9GOiAnQk9PTCcsIFRQOiAnQk9PTCcsIENUVTogJ0JPT0wnLCBDVEQ6ICdCT09MJyxcbiAgfTtcbiAgLy8gSGFuZGxlIGRlcml2ZWQgdHlwZXMgbGlrZSBUT04sIFRPRiBldGNcbiAgaWYgKHVwcGVyLnN0YXJ0c1dpdGgoJ0FSUkFZJykpIHJldHVybiAnRElOVCc7XG4gIGlmICh1cHBlci5zdGFydHNXaXRoKCdTVFJJTkdbJykpIHJldHVybiAnU1RSSU5HJztcbiAgcmV0dXJuIG1hcFt1cHBlcl0gfHwgJ0RJTlQnO1xufVxuXG5mdW5jdGlvbiBzdGF0ZW1lbnRzVG9GQkQoXG4gIHN0YXRlbWVudHM6IFBhcnNlZFN0YXRlbWVudFtdLFxuICB2YXJzOiBQYXJzZWRWYXJEZWNsW11cbik6IHsgbm9kZXM6IEZCRE5vZGVbXTsgd2lyZXM6IEZCRFdpcmVbXSB9IHtcbiAgY29uc3Qgbm9kZXM6IEZCRE5vZGVbXSA9IFtdO1xuICBjb25zdCB3aXJlczogRkJEV2lyZVtdID0gW107XG4gIGxldCBub2RlSWR4ID0gMDtcbiAgY29uc3QgdmFyVHlwZU1hcCA9IG5ldyBNYXAodmFycy5tYXAodiA9PiBbdi5uYW1lLCB2LmRhdGFUeXBlXSkpO1xuXG4gIGZvciAoY29uc3Qgc3RtdCBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgaWYgKHN0bXQua2luZCA9PT0gJ2ZiX2NhbGwnICYmIHN0bXQuZmJDYWxsKSB7XG4gICAgICBjb25zdCBmYiA9IHN0bXQuZmJDYWxsO1xuICAgICAgY29uc3QgYmxvY2tJZCA9IGBzdC1mYmQtJHtub2RlSWR4Kyt9YDtcblxuICAgICAgY29uc3QgaW5wdXRzOiBQaW5bXSA9IGZiLnBhcmFtc1xuICAgICAgICAuZmlsdGVyKHAgPT4gcC5kaXJlY3Rpb24gPT09ICdpbicpXG4gICAgICAgIC5tYXAoKHAsIGkpID0+ICh7IGlkOiBgJHtibG9ja0lkfS1pbi0ke2l9YCwgbmFtZTogcC5uYW1lLCBkYXRhVHlwZTogJ0JPT0wnIGFzIElFQ0RhdGFUeXBlIH0pKTtcbiAgICAgIGNvbnN0IG91dHB1dHM6IFBpbltdID0gZmIucGFyYW1zXG4gICAgICAgIC5maWx0ZXIocCA9PiBwLmRpcmVjdGlvbiA9PT0gJ291dCcpXG4gICAgICAgIC5tYXAoKHAsIGkpID0+ICh7IGlkOiBgJHtibG9ja0lkfS1vdXQtJHtpfWAsIG5hbWU6IHAubmFtZSwgZGF0YVR5cGU6ICdCT09MJyBhcyBJRUNEYXRhVHlwZSB9KSk7XG5cbiAgICAgIC8vIEFkZCBkZWZhdWx0IG91dHB1dCBpZiBub25lIHNwZWNpZmllZFxuICAgICAgaWYgKG91dHB1dHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIG91dHB1dHMucHVzaCh7IGlkOiBgJHtibG9ja0lkfS1vdXQtUWAsIG5hbWU6ICdRJywgZGF0YVR5cGU6ICdCT09MJyB9KTtcbiAgICAgIH1cblxuICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgIGlkOiBibG9ja0lkLFxuICAgICAgICB0eXBlOiBmYi5mYlR5cGUgYXMgRkJEQmxvY2tUeXBlLFxuICAgICAgICBpbnN0YW5jZU5hbWU6IGZiLmluc3RhbmNlTmFtZSxcbiAgICAgICAgcG9zaXRpb246IHsgeDogMjAwLCB5OiBub2RlSWR4ICogMTAwIH0sXG4gICAgICAgIGlucHV0cyxcbiAgICAgICAgb3V0cHV0cyxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBDcmVhdGUgSU5fVkFSSUFCTEUgbm9kZXMgZm9yIGVhY2ggaW5wdXQgcGFyYW0gdmFsdWVcbiAgICAgIGZvciAoY29uc3QgcGFyYW0gb2YgZmIucGFyYW1zLmZpbHRlcihwID0+IHAuZGlyZWN0aW9uID09PSAnaW4nKSkge1xuICAgICAgICBjb25zdCB2YXJJZCA9IGBzdC1mYmQtdmFyLSR7bm9kZUlkeCsrfWA7XG4gICAgICAgIG5vZGVzLnB1c2goe1xuICAgICAgICAgIGlkOiB2YXJJZCxcbiAgICAgICAgICB0eXBlOiAnSU5fVkFSSUFCTEUnLFxuICAgICAgICAgIHRhZzogeyBuYW1lOiBwYXJhbS52YWx1ZSwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICAgIHBvc2l0aW9uOiB7IHg6IDUwLCB5OiBub2RlSWR4ICogODAgfSxcbiAgICAgICAgICBpbnB1dHM6IFtdLFxuICAgICAgICAgIG91dHB1dHM6IFt7IGlkOiBgJHt2YXJJZH0tb3V0YCwgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCB0YXJnZXRQaW4gPSBpbnB1dHMuZmluZChwID0+IHAubmFtZSA9PT0gcGFyYW0ubmFtZSk7XG4gICAgICAgIGlmICh0YXJnZXRQaW4pIHtcbiAgICAgICAgICB3aXJlcy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBgd2lyZS0ke3ZhcklkfS10by0ke2Jsb2NrSWR9YCxcbiAgICAgICAgICAgIGZyb206IHsgbm9kZUlkOiB2YXJJZCwgcGluOiAnT1VUJyB9LFxuICAgICAgICAgICAgdG86IHsgbm9kZUlkOiBibG9ja0lkLCBwaW46IHBhcmFtLm5hbWUgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBDcmVhdGUgT1VUX1ZBUklBQkxFIG5vZGVzIGZvciBvdXRwdXQgcGFyYW1zXG4gICAgICBmb3IgKGNvbnN0IHBhcmFtIG9mIGZiLnBhcmFtcy5maWx0ZXIocCA9PiBwLmRpcmVjdGlvbiA9PT0gJ291dCcpKSB7XG4gICAgICAgIGNvbnN0IHZhcklkID0gYHN0LWZiZC12YXItJHtub2RlSWR4Kyt9YDtcbiAgICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgICAgaWQ6IHZhcklkLFxuICAgICAgICAgIHR5cGU6ICdPVVRfVkFSSUFCTEUnLFxuICAgICAgICAgIHRhZzogeyBuYW1lOiBwYXJhbS52YWx1ZSwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICAgIHBvc2l0aW9uOiB7IHg6IDQwMCwgeTogbm9kZUlkeCAqIDgwIH0sXG4gICAgICAgICAgaW5wdXRzOiBbeyBpZDogYCR7dmFySWR9LWluYCwgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICAgICAgICBvdXRwdXRzOiBbXSxcbiAgICAgICAgfSk7XG4gICAgICAgIHdpcmVzLnB1c2goe1xuICAgICAgICAgIGlkOiBgd2lyZS0ke2Jsb2NrSWR9LXRvLSR7dmFySWR9YCxcbiAgICAgICAgICBmcm9tOiB7IG5vZGVJZDogYmxvY2tJZCwgcGluOiBwYXJhbS5uYW1lIH0sXG4gICAgICAgICAgdG86IHsgbm9kZUlkOiB2YXJJZCwgcGluOiAnSU4nIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RtdC5raW5kID09PSAnYXNzaWdubWVudCcgJiYgc3RtdC5hc3NpZ25tZW50KSB7XG4gICAgICAvLyBTaW1wbGUgYm9vbGVhbiBhc3NpZ25tZW50cyB3aXRoIEFORC9PUiBjYW4gbWFwIHRvIGxvZ2ljIGJsb2Nrc1xuICAgICAgY29uc3QgYXNzaWduID0gc3RtdC5hc3NpZ25tZW50O1xuICAgICAgY29uc3QgZXhwclVwcGVyID0gYXNzaWduLmV4cHJlc3Npb24udG9VcHBlckNhc2UoKTtcblxuICAgICAgaWYgKGV4cHJVcHBlci5pbmNsdWRlcygnIEFORCAnKSB8fCBleHByVXBwZXIuaW5jbHVkZXMoJyBPUiAnKSB8fCBleHByVXBwZXIuaW5jbHVkZXMoJyBYT1IgJykpIHtcbiAgICAgICAgY29uc3Qgb3BNYXRjaCA9IGV4cHJVcHBlci5tYXRjaCgvXFxiKEFORHxPUnxYT1IpXFxiLyk7XG4gICAgICAgIGlmIChvcE1hdGNoKSB7XG4gICAgICAgICAgY29uc3Qgb3AgPSBvcE1hdGNoWzFdIGFzIEZCREJsb2NrVHlwZTtcbiAgICAgICAgICBjb25zdCBwYXJ0cyA9IGFzc2lnbi5leHByZXNzaW9uLnNwbGl0KG5ldyBSZWdFeHAoYFxcXFxiJHtvcH1cXFxcYmAsICdpJykpLm1hcChzID0+IHMudHJpbSgpKTtcbiAgICAgICAgICBjb25zdCBibG9ja0lkID0gYHN0LWZiZC0ke25vZGVJZHgrK31gO1xuICAgICAgICAgIGNvbnN0IGlucHV0czogUGluW10gPSBwYXJ0cy5tYXAoKF8sIGkpID0+ICh7XG4gICAgICAgICAgICBpZDogYCR7YmxvY2tJZH0taW4tJHtpfWAsIG5hbWU6IGBJTiR7aSArIDF9YCwgZGF0YVR5cGU6ICdCT09MJyBhcyBJRUNEYXRhVHlwZSxcbiAgICAgICAgICB9KSk7XG4gICAgICAgICAgY29uc3Qgb3V0cHV0czogUGluW10gPSBbeyBpZDogYCR7YmxvY2tJZH0tb3V0LTBgLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XTtcblxuICAgICAgICAgIG5vZGVzLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGJsb2NrSWQsXG4gICAgICAgICAgICB0eXBlOiBvcCxcbiAgICAgICAgICAgIHBvc2l0aW9uOiB7IHg6IDIwMCwgeTogbm9kZUlkeCAqIDEwMCB9LFxuICAgICAgICAgICAgaW5wdXRzLFxuICAgICAgICAgICAgb3V0cHV0cyxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIElucHV0IHZhcmlhYmxlIG5vZGVzXG4gICAgICAgICAgZm9yIChsZXQgcGkgPSAwOyBwaSA8IHBhcnRzLmxlbmd0aDsgcGkrKykge1xuICAgICAgICAgICAgY29uc3QgdmFySWQgPSBgc3QtZmJkLXZhci0ke25vZGVJZHgrK31gO1xuICAgICAgICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgICAgICAgIGlkOiB2YXJJZCxcbiAgICAgICAgICAgICAgdHlwZTogJ0lOX1ZBUklBQkxFJyxcbiAgICAgICAgICAgICAgdGFnOiB7IG5hbWU6IHBhcnRzW3BpXSwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICAgICAgICBwb3NpdGlvbjogeyB4OiA1MCwgeTogbm9kZUlkeCAqIDgwIH0sXG4gICAgICAgICAgICAgIGlucHV0czogW10sXG4gICAgICAgICAgICAgIG91dHB1dHM6IFt7IGlkOiBgJHt2YXJJZH0tb3V0YCwgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHdpcmVzLnB1c2goe1xuICAgICAgICAgICAgICBpZDogYHdpcmUtJHt2YXJJZH0tdG8tJHtibG9ja0lkfWAsXG4gICAgICAgICAgICAgIGZyb206IHsgbm9kZUlkOiB2YXJJZCwgcGluOiAnT1VUJyB9LFxuICAgICAgICAgICAgICB0bzogeyBub2RlSWQ6IGJsb2NrSWQsIHBpbjogYElOJHtwaSArIDF9YCB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gT3V0cHV0IHZhcmlhYmxlIG5vZGVcbiAgICAgICAgICBjb25zdCBvdXRWYXJJZCA9IGBzdC1mYmQtdmFyLSR7bm9kZUlkeCsrfWA7XG4gICAgICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgICAgICBpZDogb3V0VmFySWQsXG4gICAgICAgICAgICB0eXBlOiAnT1VUX1ZBUklBQkxFJyxcbiAgICAgICAgICAgIHRhZzogeyBuYW1lOiBhc3NpZ24udGFyZ2V0LCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICAgICAgICBwb3NpdGlvbjogeyB4OiA0MDAsIHk6IG5vZGVJZHggKiA4MCB9LFxuICAgICAgICAgICAgaW5wdXRzOiBbeyBpZDogYCR7b3V0VmFySWR9LWluYCwgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICAgICAgICAgIG91dHB1dHM6IFtdLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHdpcmVzLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGB3aXJlLSR7YmxvY2tJZH0tdG8tJHtvdXRWYXJJZH1gLFxuICAgICAgICAgICAgZnJvbTogeyBub2RlSWQ6IGJsb2NrSWQsIHBpbjogJ09VVCcgfSxcbiAgICAgICAgICAgIHRvOiB7IG5vZGVJZDogb3V0VmFySWQsIHBpbjogJ0lOJyB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgbm9kZXMsIHdpcmVzIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFxQ0EsTUFBTSxXQUFXLG9CQUFJLElBQUk7QUFBQSxFQUN2QjtBQUFBLEVBQVc7QUFBQSxFQUFlO0FBQUEsRUFBa0I7QUFBQSxFQUM1QztBQUFBLEVBQVk7QUFBQSxFQUFnQjtBQUFBLEVBQU87QUFBQSxFQUFhO0FBQUEsRUFDaEQ7QUFBQSxFQUFjO0FBQUEsRUFBWTtBQUFBLEVBQWM7QUFBQSxFQUN4QztBQUFBLEVBQU07QUFBQSxFQUFRO0FBQUEsRUFBUztBQUFBLEVBQVE7QUFBQSxFQUMvQjtBQUFBLEVBQVE7QUFBQSxFQUFNO0FBQUEsRUFDZDtBQUFBLEVBQU87QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUN6QjtBQUFBLEVBQVM7QUFBQSxFQUFhO0FBQUEsRUFBVTtBQUFBLEVBQVM7QUFBQSxFQUN6QztBQUFBLEVBQVU7QUFBQSxFQUFRO0FBQUEsRUFDbEI7QUFBQSxFQUFPO0FBQUEsRUFBTTtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFDM0I7QUFBQSxFQUFRO0FBQUEsRUFBUztBQUFBLEVBQVU7QUFBQSxFQUFZO0FBQUEsRUFDdkM7QUFBQSxFQUFTO0FBQUEsRUFBVTtBQUFBLEVBQWM7QUFBQSxFQUFRO0FBQzNDLENBQUM7QUFFRCxTQUFTLFNBQVMsUUFBeUI7QUFDekMsUUFB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
