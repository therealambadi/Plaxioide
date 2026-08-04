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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L3ZlbmRvci9zdFBhcnNlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLypcbiAqIElFQyA2MTEzMS0zIFN0cnVjdHVyZWQgVGV4dCBQYXJzZXIgKFNUIFx1MjE5MiBOb3JtYWxpemVkUE9VKVxuICogUmVjdXJzaXZlIGRlc2NlbnQgcGFyc2VyIGZvciB0aGUgc3Vic2V0IG9mIFNUIGNvbnN0cnVjdHMgdGhhdCBjYW4gbWFwIHRvIENMTTpcbiAqIC0gUFJPR1JBTSAvIEZVTkNUSU9OX0JMT0NLIC8gRlVOQ1RJT04gZGVjbGFyYXRpb25zXG4gKiAtIFZBUiAvIEVORF9WQVIgYmxvY2tzIChuYW1lLCB0eXBlLCBpbml0aWFsIHZhbHVlLCBSRVRBSU4sIEFUIGFkZHJlc3MpXG4gKiAtIEZCIGluc3RhbmNlIGNhbGxzOiBUaW1lcihJTiA6PSB4LCBQVCA6PSBUIzVzKVxuICogLSBBc3NpZ25tZW50czogWCA6PSBZIEFORCBaXG4gKiAtIElGIC8gRUxTSUYgLyBFTFNFIC8gRU5EX0lGXG4gKiAtIENBU0UgLyBFTkRfQ0FTRVxuICogLSBGT1IgLyBXSElMRSAvIFJFUEVBVCBsb29wcyAocHJlc2VydmVkIGFzIFNULW9ubHkgYmxvY2tzKVxuICpcbiAqIERlc2lnbjogaGFuZC13cml0dGVuIHJlY3Vyc2l2ZSBkZXNjZW50IFx1MjAxNCBmYXN0LCB6ZXJvIGRlcGVuZGVuY2llcywgaGFuZGxlc1xuICogZXhhY3RseSB0aGUgY29uc3RydWN0cyBjbG1Ub1NUKCkgZ2VuZXJhdGVzIGZvciBwZXJmZWN0IHJvdW5kLXRyaXAgZmlkZWxpdHkuXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkUE9VLCBOb3JtYWxpemVkVGFnIH0gZnJvbSAnLi90eXBlcy5qcyc7XG5pbXBvcnQgdHlwZSB7XG4gIExhZGRlclByb2dyYW0sIEZCRFByb2dyYW0sIEZCRE5vZGUsIEZCRFdpcmUsIFBpbixcbiAgRkJEQmxvY2tUeXBlLCBJRUNEYXRhVHlwZSxcbn0gZnJvbSAnLi4vbG9naWNTdG9yZS5qcyc7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUb2tlbml6ZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbnR5cGUgVG9rZW5LaW5kID1cbiAgfCAnS0VZV09SRCcgfCAnSURFTlQnIHwgJ05VTUJFUicgfCAnVElNRV9MSVRFUkFMJyB8ICdTVFJJTkcnXG4gIHwgJ0FTU0lHTicgfCAnQVJST1cnIHwgJ0NPTE9OJyB8ICdTRU1JJyB8ICdDT01NQScgfCAnRE9UJ1xuICB8ICdMUEFSRU4nIHwgJ1JQQVJFTicgfCAnTEJSQUNLRVQnIHwgJ1JCUkFDS0VUJ1xuICB8ICdPUF9DT01QQVJFJyB8ICdPUF9BUklUSCcgfCAnT1BfTE9HSUMnXG4gIHwgJ0VPRic7XG5cbmludGVyZmFjZSBUb2tlbiB7XG4gIGtpbmQ6IFRva2VuS2luZDtcbiAgdmFsdWU6IHN0cmluZztcbiAgbGluZTogbnVtYmVyO1xuICBjb2w6IG51bWJlcjtcbn1cblxuY29uc3QgS0VZV09SRFMgPSBuZXcgU2V0KFtcbiAgJ1BST0dSQU0nLCAnRU5EX1BST0dSQU0nLCAnRlVOQ1RJT05fQkxPQ0snLCAnRU5EX0ZVTkNUSU9OX0JMT0NLJyxcbiAgJ0ZVTkNUSU9OJywgJ0VORF9GVU5DVElPTicsICdWQVInLCAnVkFSX0lOUFVUJywgJ1ZBUl9PVVRQVVQnLFxuICAnVkFSX0lOX09VVCcsICdWQVJfVEVNUCcsICdWQVJfR0xPQkFMJywgJ0VORF9WQVInLFxuICAnSUYnLCAnVEhFTicsICdFTFNJRicsICdFTFNFJywgJ0VORF9JRicsXG4gICdDQVNFJywgJ09GJywgJ0VORF9DQVNFJyxcbiAgJ0ZPUicsICdUTycsICdCWScsICdETycsICdFTkRfRk9SJyxcbiAgJ1dISUxFJywgJ0VORF9XSElMRScsICdSRVBFQVQnLCAnVU5USUwnLCAnRU5EX1JFUEVBVCcsXG4gICdSRVRVUk4nLCAnRVhJVCcsICdDT05USU5VRScsXG4gICdBTkQnLCAnT1InLCAnTk9UJywgJ1hPUicsICdNT0QnLFxuICAnVFJVRScsICdGQUxTRScsICdSRVRBSU4nLCAnQ09OU1RBTlQnLCAnQVQnLFxuICAnQVJSQVknLCAnU1RSVUNUJywgJ0VORF9TVFJVQ1QnLCAnVFlQRScsICdFTkRfVFlQRScsXG5dKTtcblxuZnVuY3Rpb24gdG9rZW5pemUoc291cmNlOiBzdHJpbmcpOiBUb2tlbltdIHtcbiAgY29uc3QgdG9rZW5zOiBUb2tlbltdID0gW107XG4gIGxldCBpID0gMDtcbiAgbGV0IGxpbmUgPSAxO1xuICBsZXQgY29sID0gMTtcblxuICB3aGlsZSAoaSA8IHNvdXJjZS5sZW5ndGgpIHtcbiAgICAvLyBTa2lwIHdoaXRlc3BhY2VcbiAgICBpZiAoL1xccy8udGVzdChzb3VyY2VbaV0pKSB7XG4gICAgICBpZiAoc291cmNlW2ldID09PSAnXFxuJykgeyBsaW5lKys7IGNvbCA9IDE7IH0gZWxzZSB7IGNvbCsrOyB9XG4gICAgICBpKys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBTa2lwIGJsb2NrIGNvbW1lbnRzICgqIC4uLiAqKVxuICAgIGlmIChzb3VyY2VbaV0gPT09ICcoJyAmJiBzb3VyY2VbaSArIDFdID09PSAnKicpIHtcbiAgICAgIGkgKz0gMjsgY29sICs9IDI7XG4gICAgICB3aGlsZSAoaSA8IHNvdXJjZS5sZW5ndGggLSAxICYmICEoc291cmNlW2ldID09PSAnKicgJiYgc291cmNlW2kgKyAxXSA9PT0gJyknKSkge1xuICAgICAgICBpZiAoc291cmNlW2ldID09PSAnXFxuJykgeyBsaW5lKys7IGNvbCA9IDE7IH0gZWxzZSB7IGNvbCsrOyB9XG4gICAgICAgIGkrKztcbiAgICAgIH1cbiAgICAgIGkgKz0gMjsgY29sICs9IDI7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBTa2lwIGxpbmUgY29tbWVudHMgLy9cbiAgICBpZiAoc291cmNlW2ldID09PSAnLycgJiYgc291cmNlW2kgKyAxXSA9PT0gJy8nKSB7XG4gICAgICB3aGlsZSAoaSA8IHNvdXJjZS5sZW5ndGggJiYgc291cmNlW2ldICE9PSAnXFxuJykgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhcnRDb2wgPSBjb2w7XG5cbiAgICAvLyBUaW1lIGxpdGVyYWxzOiBUIy4uLiwgVElNRSMuLi5cbiAgICBjb25zdCB0aW1lTWF0Y2ggPSBzb3VyY2Uuc2xpY2UoaSkubWF0Y2goL14oVHxUSU1FfExUfExUSU1FKSNbMC05ZGhtc19dKy9pKTtcbiAgICBpZiAodGltZU1hdGNoKSB7XG4gICAgICB0b2tlbnMucHVzaCh7IGtpbmQ6ICdUSU1FX0xJVEVSQUwnLCB2YWx1ZTogdGltZU1hdGNoWzBdLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pO1xuICAgICAgaSArPSB0aW1lTWF0Y2hbMF0ubGVuZ3RoOyBjb2wgKz0gdGltZU1hdGNoWzBdLmxlbmd0aDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIElkZW50aWZpZXJzIGFuZCBrZXl3b3Jkc1xuICAgIGlmICgvW0EtWmEtel9dLy50ZXN0KHNvdXJjZVtpXSkpIHtcbiAgICAgIGxldCB3b3JkID0gJyc7XG4gICAgICB3aGlsZSAoaSA8IHNvdXJjZS5sZW5ndGggJiYgL1tBLVphLXowLTlfXS8udGVzdChzb3VyY2VbaV0pKSB7XG4gICAgICAgIHdvcmQgKz0gc291cmNlW2ldOyBpKys7IGNvbCsrO1xuICAgICAgfVxuICAgICAgY29uc3QgdXBwZXIgPSB3b3JkLnRvVXBwZXJDYXNlKCk7XG4gICAgICBpZiAodXBwZXIgPT09ICdBTkQnIHx8IHVwcGVyID09PSAnT1InIHx8IHVwcGVyID09PSAnTk9UJyB8fCB1cHBlciA9PT0gJ1hPUicpIHtcbiAgICAgICAgdG9rZW5zLnB1c2goeyBraW5kOiAnT1BfTE9HSUMnLCB2YWx1ZTogdXBwZXIsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7XG4gICAgICB9IGVsc2UgaWYgKHVwcGVyID09PSAnTU9EJykge1xuICAgICAgICB0b2tlbnMucHVzaCh7IGtpbmQ6ICdPUF9BUklUSCcsIHZhbHVlOiB1cHBlciwgbGluZSwgY29sOiBzdGFydENvbCB9KTtcbiAgICAgIH0gZWxzZSBpZiAoS0VZV09SRFMuaGFzKHVwcGVyKSkge1xuICAgICAgICB0b2tlbnMucHVzaCh7IGtpbmQ6ICdLRVlXT1JEJywgdmFsdWU6IHVwcGVyLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdG9rZW5zLnB1c2goeyBraW5kOiAnSURFTlQnLCB2YWx1ZTogd29yZCwgbGluZSwgY29sOiBzdGFydENvbCB9KTtcbiAgICAgIH1cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIE51bWJlcnMgKGludC9mbG9hdC9oZXgvYmluYXJ5KVxuICAgIGlmICgvWzAtOV0vLnRlc3Qoc291cmNlW2ldKSkge1xuICAgICAgbGV0IG51bSA9ICcnO1xuICAgICAgLy8gQ2hlY2sgZm9yIGJhc2UgcHJlZml4OiAxNiMsIDgjLCAyI1xuICAgICAgaWYgKC9bMC05XS8udGVzdChzb3VyY2VbaV0pICYmIGkgKyAxIDwgc291cmNlLmxlbmd0aCAmJiBzb3VyY2VbaSArIDFdID09PSAnIycpIHtcbiAgICAgICAgbnVtID0gc291cmNlW2ldICsgJyMnOyBpICs9IDI7IGNvbCArPSAyO1xuICAgICAgICB3aGlsZSAoaSA8IHNvdXJjZS5sZW5ndGggJiYgL1swLTlBLUZhLWZfXS8udGVzdChzb3VyY2VbaV0pKSB7XG4gICAgICAgICAgbnVtICs9IHNvdXJjZVtpXTsgaSsrOyBjb2wrKztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgd2hpbGUgKGkgPCBzb3VyY2UubGVuZ3RoICYmIC9bMC05Xy5dLy50ZXN0KHNvdXJjZVtpXSkpIHtcbiAgICAgICAgICBudW0gKz0gc291cmNlW2ldOyBpKys7IGNvbCsrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpIDwgc291cmNlLmxlbmd0aCAmJiAvW2VFXS8udGVzdChzb3VyY2VbaV0pKSB7XG4gICAgICAgICAgbnVtICs9IHNvdXJjZVtpXTsgaSsrOyBjb2wrKztcbiAgICAgICAgICBpZiAoaSA8IHNvdXJjZS5sZW5ndGggJiYgL1srLV0vLnRlc3Qoc291cmNlW2ldKSkgeyBudW0gKz0gc291cmNlW2ldOyBpKys7IGNvbCsrOyB9XG4gICAgICAgICAgd2hpbGUgKGkgPCBzb3VyY2UubGVuZ3RoICYmIC9bMC05XS8udGVzdChzb3VyY2VbaV0pKSB7IG51bSArPSBzb3VyY2VbaV07IGkrKzsgY29sKys7IH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdG9rZW5zLnB1c2goeyBraW5kOiAnTlVNQkVSJywgdmFsdWU6IG51bSwgbGluZSwgY29sOiBzdGFydENvbCB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFN0cmluZyBsaXRlcmFsc1xuICAgIGlmIChzb3VyY2VbaV0gPT09ICdcXCcnIHx8IHNvdXJjZVtpXSA9PT0gJ1wiJykge1xuICAgICAgY29uc3QgcXVvdGUgPSBzb3VyY2VbaV07XG4gICAgICBsZXQgc3RyID0gcXVvdGU7IGkrKzsgY29sKys7XG4gICAgICB3aGlsZSAoaSA8IHNvdXJjZS5sZW5ndGggJiYgc291cmNlW2ldICE9PSBxdW90ZSkge1xuICAgICAgICBpZiAoc291cmNlW2ldID09PSAnJCcgfHwgc291cmNlW2ldID09PSAnXFxcXCcpIHsgc3RyICs9IHNvdXJjZVtpXTsgaSsrOyBjb2wrKzsgfVxuICAgICAgICBpZiAoaSA8IHNvdXJjZS5sZW5ndGgpIHsgc3RyICs9IHNvdXJjZVtpXTsgaSsrOyBjb2wrKzsgfVxuICAgICAgfVxuICAgICAgaWYgKGkgPCBzb3VyY2UubGVuZ3RoKSB7IHN0ciArPSBzb3VyY2VbaV07IGkrKzsgY29sKys7IH1cbiAgICAgIHRva2Vucy5wdXNoKHsga2luZDogJ1NUUklORycsIHZhbHVlOiBzdHIsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBNdWx0aS1jaGFyIG9wZXJhdG9yc1xuICAgIGNvbnN0IHR3byA9IHNvdXJjZS5zbGljZShpLCBpICsgMik7XG4gICAgaWYgKHR3byA9PT0gJzo9JykgeyB0b2tlbnMucHVzaCh7IGtpbmQ6ICdBU1NJR04nLCB2YWx1ZTogJzo9JywgbGluZSwgY29sOiBzdGFydENvbCB9KTsgaSArPSAyOyBjb2wgKz0gMjsgY29udGludWU7IH1cbiAgICBpZiAodHdvID09PSAnPT4nKSB7IHRva2Vucy5wdXNoKHsga2luZDogJ0FSUk9XJywgdmFsdWU6ICc9PicsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7IGkgKz0gMjsgY29sICs9IDI7IGNvbnRpbnVlOyB9XG4gICAgaWYgKHR3byA9PT0gJzw+JyB8fCB0d28gPT09ICc8PScgfHwgdHdvID09PSAnPj0nKSB7XG4gICAgICB0b2tlbnMucHVzaCh7IGtpbmQ6ICdPUF9DT01QQVJFJywgdmFsdWU6IHR3bywgbGluZSwgY29sOiBzdGFydENvbCB9KTsgaSArPSAyOyBjb2wgKz0gMjsgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gU2luZ2xlLWNoYXJcbiAgICBjb25zdCBjaCA9IHNvdXJjZVtpXTtcbiAgICBpZiAoY2ggPT09ICc6JykgeyB0b2tlbnMucHVzaCh7IGtpbmQ6ICdDT0xPTicsIHZhbHVlOiAnOicsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7IH1cbiAgICBlbHNlIGlmIChjaCA9PT0gJzsnKSB7IHRva2Vucy5wdXNoKHsga2luZDogJ1NFTUknLCB2YWx1ZTogJzsnLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pOyB9XG4gICAgZWxzZSBpZiAoY2ggPT09ICcsJykgeyB0b2tlbnMucHVzaCh7IGtpbmQ6ICdDT01NQScsIHZhbHVlOiAnLCcsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7IH1cbiAgICBlbHNlIGlmIChjaCA9PT0gJy4nKSB7IHRva2Vucy5wdXNoKHsga2luZDogJ0RPVCcsIHZhbHVlOiAnLicsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7IH1cbiAgICBlbHNlIGlmIChjaCA9PT0gJygnKSB7IHRva2Vucy5wdXNoKHsga2luZDogJ0xQQVJFTicsIHZhbHVlOiAnKCcsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7IH1cbiAgICBlbHNlIGlmIChjaCA9PT0gJyknKSB7IHRva2Vucy5wdXNoKHsga2luZDogJ1JQQVJFTicsIHZhbHVlOiAnKScsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7IH1cbiAgICBlbHNlIGlmIChjaCA9PT0gJ1snKSB7IHRva2Vucy5wdXNoKHsga2luZDogJ0xCUkFDS0VUJywgdmFsdWU6ICdbJywgbGluZSwgY29sOiBzdGFydENvbCB9KTsgfVxuICAgIGVsc2UgaWYgKGNoID09PSAnXScpIHsgdG9rZW5zLnB1c2goeyBraW5kOiAnUkJSQUNLRVQnLCB2YWx1ZTogJ10nLCBsaW5lLCBjb2w6IHN0YXJ0Q29sIH0pOyB9XG4gICAgZWxzZSBpZiAoY2ggPT09ICc8JyB8fCBjaCA9PT0gJz4nIHx8IGNoID09PSAnPScpIHsgdG9rZW5zLnB1c2goeyBraW5kOiAnT1BfQ09NUEFSRScsIHZhbHVlOiBjaCwgbGluZSwgY29sOiBzdGFydENvbCB9KTsgfVxuICAgIGVsc2UgaWYgKGNoID09PSAnKycgfHwgY2ggPT09ICctJyB8fCBjaCA9PT0gJyonIHx8IGNoID09PSAnLycpIHsgdG9rZW5zLnB1c2goeyBraW5kOiAnT1BfQVJJVEgnLCB2YWx1ZTogY2gsIGxpbmUsIGNvbDogc3RhcnRDb2wgfSk7IH1cbiAgICBlbHNlIHsgLyogc2tpcCB1bmtub3duIGNoYXIgKi8gfVxuICAgIGkrKzsgY29sKys7XG4gIH1cblxuICB0b2tlbnMucHVzaCh7IGtpbmQ6ICdFT0YnLCB2YWx1ZTogJycsIGxpbmUsIGNvbCB9KTtcbiAgcmV0dXJuIHRva2Vucztcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFBhcnNlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuaW50ZXJmYWNlIFBhcnNlZFZhckRlY2wge1xuICBuYW1lOiBzdHJpbmc7XG4gIGRhdGFUeXBlOiBzdHJpbmc7XG4gIGluaXRpYWxWYWx1ZT86IHN0cmluZztcbiAgcmV0YWluPzogYm9vbGVhbjtcbiAgYWRkcmVzcz86IHN0cmluZztcbiAgc2VjdGlvbjogJ2xvY2FsJyB8ICdpbnB1dCcgfCAnb3V0cHV0JyB8ICdpbm91dCcgfCAndGVtcCcgfCAnZ2xvYmFsJztcbn1cblxuaW50ZXJmYWNlIFBhcnNlZEZCQ2FsbCB7XG4gIGluc3RhbmNlTmFtZTogc3RyaW5nO1xuICBmYlR5cGU6IHN0cmluZztcbiAgcGFyYW1zOiB7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZzsgZGlyZWN0aW9uOiAnaW4nIHwgJ291dCcgfVtdO1xufVxuXG5pbnRlcmZhY2UgUGFyc2VkQXNzaWdubWVudCB7XG4gIHRhcmdldDogc3RyaW5nO1xuICBleHByZXNzaW9uOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBQYXJzZWRTdGF0ZW1lbnQge1xuICBraW5kOiAnZmJfY2FsbCcgfCAnYXNzaWdubWVudCcgfCAnaWYnIHwgJ2Nhc2UnIHwgJ2ZvcicgfCAnd2hpbGUnIHwgJ3JlcGVhdCcgfCAncmV0dXJuJztcbiAgZmJDYWxsPzogUGFyc2VkRkJDYWxsO1xuICBhc3NpZ25tZW50PzogUGFyc2VkQXNzaWdubWVudDtcbiAgcmF3U1Q/OiBzdHJpbmc7XG59XG5cbmNsYXNzIFNUUGFyc2VyIHtcbiAgcHJpdmF0ZSB0b2tlbnM6IFRva2VuW107XG4gIHByaXZhdGUgcG9zOiBudW1iZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKHNvdXJjZTogc3RyaW5nKSB7XG4gICAgdGhpcy50b2tlbnMgPSB0b2tlbml6ZShzb3VyY2UpO1xuICB9XG5cbiAgcHJpdmF0ZSBwZWVrKCk6IFRva2VuIHsgcmV0dXJuIHRoaXMudG9rZW5zW3RoaXMucG9zXSB8fCB0aGlzLnRva2Vuc1t0aGlzLnRva2Vucy5sZW5ndGggLSAxXTsgfVxuICBwcml2YXRlIGFkdmFuY2UoKTogVG9rZW4geyByZXR1cm4gdGhpcy50b2tlbnNbdGhpcy5wb3MrK107IH1cbiAgcHJpdmF0ZSBleHBlY3Qoa2luZDogVG9rZW5LaW5kLCB2YWx1ZT86IHN0cmluZyk6IFRva2VuIHtcbiAgICBjb25zdCB0ID0gdGhpcy5wZWVrKCk7XG4gICAgaWYgKHQua2luZCAhPT0ga2luZCB8fCAodmFsdWUgJiYgdC52YWx1ZS50b1VwcGVyQ2FzZSgpICE9PSB2YWx1ZS50b1VwcGVyQ2FzZSgpKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCAke2tpbmR9JHt2YWx1ZSA/IGAoJHt2YWx1ZX0pYCA6ICcnfSBhdCBsaW5lICR7dC5saW5lfToke3QuY29sfSwgZ290ICR7dC5raW5kfSgke3QudmFsdWV9KWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZHZhbmNlKCk7XG4gIH1cbiAgcHJpdmF0ZSBtYXRjaChraW5kOiBUb2tlbktpbmQsIHZhbHVlPzogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgdCA9IHRoaXMucGVlaygpO1xuICAgIGlmICh0LmtpbmQgPT09IGtpbmQgJiYgKCF2YWx1ZSB8fCB0LnZhbHVlLnRvVXBwZXJDYXNlKCkgPT09IHZhbHVlLnRvVXBwZXJDYXNlKCkpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcHJpdmF0ZSBpc0F0KGtpbmQ6IFRva2VuS2luZCwgdmFsdWU/OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCB0ID0gdGhpcy5wZWVrKCk7XG4gICAgcmV0dXJuIHQua2luZCA9PT0ga2luZCAmJiAoIXZhbHVlIHx8IHQudmFsdWUudG9VcHBlckNhc2UoKSA9PT0gdmFsdWUudG9VcHBlckNhc2UoKSk7XG4gIH1cblxuICBwYXJzZSgpOiB7IHBvdU5hbWU6IHN0cmluZzsgcG91VHlwZTogc3RyaW5nOyB2YXJzOiBQYXJzZWRWYXJEZWNsW107IHN0YXRlbWVudHM6IFBhcnNlZFN0YXRlbWVudFtdIH0ge1xuICAgIGxldCBwb3VOYW1lID0gJ01haW4nO1xuICAgIGxldCBwb3VUeXBlID0gJ3Byb2dyYW0nO1xuXG4gICAgLy8gT3B0aW9uYWwgUE9VIGRlY2xhcmF0aW9uXG4gICAgaWYgKHRoaXMuaXNBdCgnS0VZV09SRCcsICdQUk9HUkFNJykpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcG91TmFtZSA9IHRoaXMuZXhwZWN0KCdJREVOVCcpLnZhbHVlO1xuICAgICAgcG91VHlwZSA9ICdwcm9ncmFtJztcbiAgICB9IGVsc2UgaWYgKHRoaXMuaXNBdCgnS0VZV09SRCcsICdGVU5DVElPTl9CTE9DSycpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHBvdU5hbWUgPSB0aGlzLmV4cGVjdCgnSURFTlQnKS52YWx1ZTtcbiAgICAgIHBvdVR5cGUgPSAnZnVuY3Rpb25CbG9jayc7XG4gICAgfSBlbHNlIGlmICh0aGlzLmlzQXQoJ0tFWVdPUkQnLCAnRlVOQ1RJT04nKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICBwb3VOYW1lID0gdGhpcy5leHBlY3QoJ0lERU5UJykudmFsdWU7XG4gICAgICBwb3VUeXBlID0gJ2Z1bmN0aW9uJztcbiAgICAgIGlmICh0aGlzLm1hdGNoKCdDT0xPTicpKSB7IHRoaXMuYWR2YW5jZSgpOyB9IC8vIHJldHVybiB0eXBlXG4gICAgfVxuXG4gICAgLy8gUGFyc2UgVkFSIGJsb2Nrc1xuICAgIGNvbnN0IHZhcnM6IFBhcnNlZFZhckRlY2xbXSA9IFtdO1xuICAgIHdoaWxlICh0aGlzLmlzQXQoJ0tFWVdPUkQnKSAmJiB0aGlzLnBlZWsoKS52YWx1ZS5zdGFydHNXaXRoKCdWQVInKSkge1xuICAgICAgdmFycy5wdXNoKC4uLnRoaXMucGFyc2VWYXJCbG9jaygpKTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSBzdGF0ZW1lbnRzIHVudGlsIEVORF9QUk9HUkFNL0VORF9GVU5DVElPTl9CTE9DSy9FTkRfRlVOQ1RJT04vRU9GXG4gICAgY29uc3Qgc3RhdGVtZW50czogUGFyc2VkU3RhdGVtZW50W10gPSBbXTtcbiAgICB3aGlsZSAoIXRoaXMuaXNBdCgnRU9GJykgJiYgIXRoaXMuaXNBdCgnS0VZV09SRCcsICdFTkRfUFJPR1JBTScpICYmXG4gICAgICAgICAgICF0aGlzLmlzQXQoJ0tFWVdPUkQnLCAnRU5EX0ZVTkNUSU9OX0JMT0NLJykgJiYgIXRoaXMuaXNBdCgnS0VZV09SRCcsICdFTkRfRlVOQ1RJT04nKSkge1xuICAgICAgY29uc3Qgc3RtdCA9IHRoaXMucGFyc2VTdGF0ZW1lbnQoKTtcbiAgICAgIGlmIChzdG10KSBzdGF0ZW1lbnRzLnB1c2goc3RtdCk7XG4gICAgfVxuXG4gICAgLy8gQ29uc3VtZSBFTkRfeHh4XG4gICAgaWYgKHRoaXMuaXNBdCgnS0VZV09SRCcpICYmIHRoaXMucGVlaygpLnZhbHVlLnN0YXJ0c1dpdGgoJ0VORF8nKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgcG91TmFtZSwgcG91VHlwZSwgdmFycywgc3RhdGVtZW50cyB9O1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVZhckJsb2NrKCk6IFBhcnNlZFZhckRlY2xbXSB7XG4gICAgY29uc3QgZGVjbHM6IFBhcnNlZFZhckRlY2xbXSA9IFtdO1xuICAgIGNvbnN0IGt3ID0gdGhpcy5hZHZhbmNlKCkudmFsdWU7IC8vIFZBUiwgVkFSX0lOUFVULCBldGMuXG4gICAgY29uc3Qgc2VjdGlvbk1hcDogUmVjb3JkPHN0cmluZywgUGFyc2VkVmFyRGVjbFsnc2VjdGlvbiddPiA9IHtcbiAgICAgIFZBUjogJ2xvY2FsJywgVkFSX0lOUFVUOiAnaW5wdXQnLCBWQVJfT1VUUFVUOiAnb3V0cHV0JyxcbiAgICAgIFZBUl9JTl9PVVQ6ICdpbm91dCcsIFZBUl9URU1QOiAndGVtcCcsIFZBUl9HTE9CQUw6ICdnbG9iYWwnLFxuICAgIH07XG4gICAgY29uc3Qgc2VjdGlvbiA9IHNlY3Rpb25NYXBba3ddIHx8ICdsb2NhbCc7XG5cbiAgICB3aGlsZSAoIXRoaXMuaXNBdCgnS0VZV09SRCcsICdFTkRfVkFSJykgJiYgIXRoaXMuaXNBdCgnRU9GJykpIHtcbiAgICAgIGNvbnN0IHJldGFpbiA9IHRoaXMubWF0Y2goJ0tFWVdPUkQnLCAnUkVUQUlOJyk7XG4gICAgICBpZiAodGhpcy5tYXRjaCgnS0VZV09SRCcsICdDT05TVEFOVCcpKSB7IC8qIHNraXAgKi8gfVxuXG4gICAgICBpZiAoIXRoaXMuaXNBdCgnSURFTlQnKSkgeyB0aGlzLmFkdmFuY2UoKTsgY29udGludWU7IH1cbiAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLmFkdmFuY2UoKS52YWx1ZTtcblxuICAgICAgLy8gT3B0aW9uYWwgQVQgYWRkcmVzc1xuICAgICAgbGV0IGFkZHJlc3M6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIGlmICh0aGlzLm1hdGNoKCdLRVlXT1JEJywgJ0FUJykpIHtcbiAgICAgICAgLy8gQ29uc3VtZSB0aGUgYWRkcmVzcyB0b2tlbiAoZS5nLiwgJUlYMC4wKVxuICAgICAgICBhZGRyZXNzID0gJyc7XG4gICAgICAgIHdoaWxlICghdGhpcy5pc0F0KCdDT0xPTicpICYmICF0aGlzLmlzQXQoJ1NFTUknKSAmJiAhdGhpcy5pc0F0KCdFT0YnKSkge1xuICAgICAgICAgIGFkZHJlc3MgKz0gdGhpcy5hZHZhbmNlKCkudmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5leHBlY3QoJ0NPTE9OJyk7XG4gICAgICBsZXQgZGF0YVR5cGUgPSAnJztcbiAgICAgIHdoaWxlICghdGhpcy5pc0F0KCdTRU1JJykgJiYgIXRoaXMuaXNBdCgnQVNTSUdOJykgJiYgIXRoaXMuaXNBdCgnRU9GJykgJiZcbiAgICAgICAgICAgICAhKHRoaXMuaXNBdCgnS0VZV09SRCcsICdFTkRfVkFSJykpKSB7XG4gICAgICAgIGRhdGFUeXBlICs9IHRoaXMuYWR2YW5jZSgpLnZhbHVlO1xuICAgICAgfVxuICAgICAgZGF0YVR5cGUgPSBkYXRhVHlwZS50cmltKCk7XG5cbiAgICAgIGxldCBpbml0aWFsVmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIGlmICh0aGlzLm1hdGNoKCdBU1NJR04nKSkge1xuICAgICAgICBpbml0aWFsVmFsdWUgPSAnJztcbiAgICAgICAgd2hpbGUgKCF0aGlzLmlzQXQoJ1NFTUknKSAmJiAhdGhpcy5pc0F0KCdFT0YnKSkge1xuICAgICAgICAgIGluaXRpYWxWYWx1ZSArPSB0aGlzLmFkdmFuY2UoKS52YWx1ZSArICcgJztcbiAgICAgICAgfVxuICAgICAgICBpbml0aWFsVmFsdWUgPSBpbml0aWFsVmFsdWUudHJpbSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5tYXRjaCgnU0VNSScpO1xuXG4gICAgICBkZWNscy5wdXNoKHsgbmFtZSwgZGF0YVR5cGUsIGluaXRpYWxWYWx1ZSwgcmV0YWluLCBhZGRyZXNzLCBzZWN0aW9uIH0pO1xuICAgIH1cbiAgICB0aGlzLm1hdGNoKCdLRVlXT1JEJywgJ0VORF9WQVInKTtcbiAgICByZXR1cm4gZGVjbHM7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlU3RhdGVtZW50KCk6IFBhcnNlZFN0YXRlbWVudCB8IG51bGwge1xuICAgIC8vIElGXG4gICAgaWYgKHRoaXMuaXNBdCgnS0VZV09SRCcsICdJRicpKSB7IHJldHVybiB0aGlzLnBhcnNlSUYoKTsgfVxuICAgIC8vIEZPUlxuICAgIGlmICh0aGlzLmlzQXQoJ0tFWVdPUkQnLCAnRk9SJykpIHsgcmV0dXJuIHRoaXMuY29uc3VtZUJsb2NrKCdGT1InLCAnRU5EX0ZPUicpOyB9XG4gICAgLy8gV0hJTEVcbiAgICBpZiAodGhpcy5pc0F0KCdLRVlXT1JEJywgJ1dISUxFJykpIHsgcmV0dXJuIHRoaXMuY29uc3VtZUJsb2NrKCdXSElMRScsICdFTkRfV0hJTEUnKTsgfVxuICAgIC8vIFJFUEVBVFxuICAgIGlmICh0aGlzLmlzQXQoJ0tFWVdPUkQnLCAnUkVQRUFUJykpIHsgcmV0dXJuIHRoaXMuY29uc3VtZUJsb2NrKCdSRVBFQVQnLCAnRU5EX1JFUEVBVCcpOyB9XG4gICAgLy8gQ0FTRVxuICAgIGlmICh0aGlzLmlzQXQoJ0tFWVdPUkQnLCAnQ0FTRScpKSB7IHJldHVybiB0aGlzLmNvbnN1bWVCbG9jaygnQ0FTRScsICdFTkRfQ0FTRScpOyB9XG4gICAgLy8gUkVUVVJOXG4gICAgaWYgKHRoaXMubWF0Y2goJ0tFWVdPUkQnLCAnUkVUVVJOJykpIHsgdGhpcy5tYXRjaCgnU0VNSScpOyByZXR1cm4geyBraW5kOiAncmV0dXJuJyB9OyB9XG5cbiAgICAvLyBJZGVudGlmaWVyIFx1MjAxNCBlaXRoZXIgRkIgY2FsbCBvciBhc3NpZ25tZW50XG4gICAgaWYgKHRoaXMuaXNBdCgnSURFTlQnKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VJZGVudFN0YXRlbWVudCgpO1xuICAgIH1cblxuICAgIC8vIFNraXAgdW5rbm93blxuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUlkZW50U3RhdGVtZW50KCk6IFBhcnNlZFN0YXRlbWVudCB7XG4gICAgY29uc3QgaWRlbnQgPSB0aGlzLmFkdmFuY2UoKS52YWx1ZTtcblxuICAgIC8vIENoZWNrIGZvciBkb3QtYWNjZXNzIChlLmcuLCBUaW1lci5RKVxuICAgIGxldCBmdWxsSWRlbnQgPSBpZGVudDtcbiAgICB3aGlsZSAodGhpcy5tYXRjaCgnRE9UJykpIHtcbiAgICAgIGZ1bGxJZGVudCArPSAnLicgKyB0aGlzLmFkdmFuY2UoKS52YWx1ZTtcbiAgICB9XG5cbiAgICAvLyBGQiBjYWxsOiBJZGVudChwYXJhbXMpIFx1MjAxNCBoYW5kbGUgYm90aCBuYW1lZCBhbmQgcG9zaXRpb25hbCBwYXJhbXNcbiAgICBpZiAodGhpcy5pc0F0KCdMUEFSRU4nKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VGQkNhbGwoaWRlbnQpO1xuICAgIH1cblxuICAgIC8vIEFzc2lnbm1lbnQ6IGlkZW50IDo9IGV4cHI7XG4gICAgaWYgKHRoaXMubWF0Y2goJ0FTU0lHTicpKSB7XG4gICAgICBsZXQgZXhwciA9ICcnO1xuICAgICAgd2hpbGUgKCF0aGlzLmlzQXQoJ1NFTUknKSAmJiAhdGhpcy5pc0F0KCdFT0YnKSkge1xuICAgICAgICBleHByICs9IHRoaXMuYWR2YW5jZSgpLnZhbHVlICsgJyAnO1xuICAgICAgfVxuICAgICAgdGhpcy5tYXRjaCgnU0VNSScpO1xuICAgICAgcmV0dXJuIHsga2luZDogJ2Fzc2lnbm1lbnQnLCBhc3NpZ25tZW50OiB7IHRhcmdldDogZnVsbElkZW50LCBleHByZXNzaW9uOiBleHByLnRyaW0oKSB9IH07XG4gICAgfVxuXG4gICAgLy8gQmFyZSBzdGF0ZW1lbnQgKHJhcmUpIFx1MjAxNCBza2lwIHRvIHNlbWljb2xvblxuICAgIHdoaWxlICghdGhpcy5pc0F0KCdTRU1JJykgJiYgIXRoaXMuaXNBdCgnRU9GJykpIHsgdGhpcy5hZHZhbmNlKCk7IH1cbiAgICB0aGlzLm1hdGNoKCdTRU1JJyk7XG4gICAgcmV0dXJuIG51bGwgYXMgYW55O1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUZCQ2FsbChpbnN0YW5jZU5hbWU6IHN0cmluZyk6IFBhcnNlZFN0YXRlbWVudCB7XG4gICAgdGhpcy5leHBlY3QoJ0xQQVJFTicpO1xuICAgIGNvbnN0IHBhcmFtczogUGFyc2VkRkJDYWxsWydwYXJhbXMnXSA9IFtdO1xuXG4gICAgd2hpbGUgKCF0aGlzLmlzQXQoJ1JQQVJFTicpICYmICF0aGlzLmlzQXQoJ0VPRicpKSB7XG4gICAgICBpZiAodGhpcy5pc0F0KCdJREVOVCcpKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtTmFtZSA9IHRoaXMuYWR2YW5jZSgpLnZhbHVlO1xuICAgICAgICBsZXQgZGlyZWN0aW9uOiAnaW4nIHwgJ291dCcgPSAnaW4nO1xuICAgICAgICBpZiAodGhpcy5tYXRjaCgnQVNTSUdOJykpIHsgZGlyZWN0aW9uID0gJ2luJzsgfVxuICAgICAgICBlbHNlIGlmICh0aGlzLm1hdGNoKCdBUlJPVycpKSB7IGRpcmVjdGlvbiA9ICdvdXQnOyB9XG4gICAgICAgIGVsc2UgeyAvKiBwb3NpdGlvbmFsIFx1MjAxNCB0cmVhdCBhcyBpbiAqLyB9XG5cbiAgICAgICAgbGV0IHZhbHVlID0gJyc7XG4gICAgICAgIHdoaWxlICghdGhpcy5pc0F0KCdDT01NQScpICYmICF0aGlzLmlzQXQoJ1JQQVJFTicpICYmICF0aGlzLmlzQXQoJ0VPRicpKSB7XG4gICAgICAgICAgdmFsdWUgKz0gdGhpcy5hZHZhbmNlKCkudmFsdWUgKyAnICc7XG4gICAgICAgIH1cbiAgICAgICAgcGFyYW1zLnB1c2goeyBuYW1lOiBwYXJhbU5hbWUsIHZhbHVlOiB2YWx1ZS50cmltKCksIGRpcmVjdGlvbiB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5tYXRjaCgnQ09NTUEnKTtcbiAgICB9XG4gICAgdGhpcy5tYXRjaCgnUlBBUkVOJyk7XG4gICAgdGhpcy5tYXRjaCgnU0VNSScpO1xuXG4gICAgLy8gRGV0ZXJtaW5lIEZCIHR5cGUgZnJvbSB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgY29udGV4dCBvciBpbnN0YW5jZSBuYW1lIHBhdHRlcm5cbiAgICBjb25zdCBmYlR5cGUgPSBndWVzc0ZCVHlwZShpbnN0YW5jZU5hbWUsIHBhcmFtcyk7XG5cbiAgICByZXR1cm4ge1xuICAgICAga2luZDogJ2ZiX2NhbGwnLFxuICAgICAgZmJDYWxsOiB7IGluc3RhbmNlTmFtZSwgZmJUeXBlLCBwYXJhbXMgfSxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUlGKCk6IFBhcnNlZFN0YXRlbWVudCB7XG4gICAgY29uc3Qgc3RhcnRQb3MgPSB0aGlzLnBvcyAtIDA7XG4gICAgbGV0IHJhdyA9ICdJRiAnO1xuICAgIHRoaXMuYWR2YW5jZSgpOyAvLyBjb25zdW1lIElGXG4gICAgbGV0IGRlcHRoID0gMTtcbiAgICB3aGlsZSAoZGVwdGggPiAwICYmICF0aGlzLmlzQXQoJ0VPRicpKSB7XG4gICAgICBjb25zdCB0ID0gdGhpcy5hZHZhbmNlKCk7XG4gICAgICByYXcgKz0gdC52YWx1ZSArICcgJztcbiAgICAgIGlmICh0LmtpbmQgPT09ICdLRVlXT1JEJyAmJiB0LnZhbHVlID09PSAnSUYnICYmIHRoaXMudG9rZW5zW3RoaXMucG9zIC0gMl0/LnZhbHVlICE9PSAnRU5EJykgZGVwdGgrKztcbiAgICAgIGlmICh0LmtpbmQgPT09ICdLRVlXT1JEJyAmJiB0LnZhbHVlID09PSAnRU5EX0lGJykgZGVwdGgtLTtcbiAgICB9XG4gICAgdGhpcy5tYXRjaCgnU0VNSScpO1xuICAgIHJldHVybiB7IGtpbmQ6ICdpZicsIHJhd1NUOiByYXcudHJpbSgpIH07XG4gIH1cblxuICBwcml2YXRlIGNvbnN1bWVCbG9jayhzdGFydDogc3RyaW5nLCBlbmQ6IHN0cmluZyk6IFBhcnNlZFN0YXRlbWVudCB7XG4gICAgbGV0IHJhdyA9IHN0YXJ0ICsgJyAnO1xuICAgIHRoaXMuYWR2YW5jZSgpOyAvLyBjb25zdW1lIHN0YXJ0IGtleXdvcmRcbiAgICBsZXQgZGVwdGggPSAxO1xuICAgIHdoaWxlIChkZXB0aCA+IDAgJiYgIXRoaXMuaXNBdCgnRU9GJykpIHtcbiAgICAgIGNvbnN0IHQgPSB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJhdyArPSB0LnZhbHVlICsgJyAnO1xuICAgICAgaWYgKHQua2luZCA9PT0gJ0tFWVdPUkQnICYmIHQudmFsdWUgPT09IHN0YXJ0KSBkZXB0aCsrO1xuICAgICAgaWYgKHQua2luZCA9PT0gJ0tFWVdPUkQnICYmIHQudmFsdWUgPT09IGVuZCkgZGVwdGgtLTtcbiAgICB9XG4gICAgdGhpcy5tYXRjaCgnU0VNSScpO1xuICAgIHJldHVybiB7IGtpbmQ6IHN0YXJ0LnRvTG93ZXJDYXNlKCkgYXMgYW55LCByYXdTVDogcmF3LnRyaW0oKSB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGd1ZXNzRkJUeXBlKGluc3RhbmNlTmFtZTogc3RyaW5nLCBwYXJhbXM6IFBhcnNlZEZCQ2FsbFsncGFyYW1zJ10pOiBzdHJpbmcge1xuICBjb25zdCB1cHBlciA9IGluc3RhbmNlTmFtZS50b1VwcGVyQ2FzZSgpO1xuICBjb25zdCBmYlBhdHRlcm5zOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgIFRPTjogJ1RPTicsIFRPRjogJ1RPRicsIFRQOiAnVFAnLFxuICAgIENUVTogJ0NUVScsIENURDogJ0NURCcsIENUVUQ6ICdDVFVEJyxcbiAgICBTUjogJ1NSJywgUlM6ICdSUycsXG4gICAgUl9UUklHOiAnUlRSSUcnLCBGX1RSSUc6ICdGVFJJRycsIFJUUklHOiAnUlRSSUcnLCBGVFJJRzogJ0ZUUklHJyxcbiAgfTtcbiAgLy8gQ2hlY2sgaWYgaW5zdGFuY2UgbmFtZSBjb250YWlucyBhIGtub3duIEZCIHR5cGVcbiAgZm9yIChjb25zdCBbcGF0dGVybiwgZmJUeXBlXSBvZiBPYmplY3QuZW50cmllcyhmYlBhdHRlcm5zKSkge1xuICAgIGlmICh1cHBlci5pbmNsdWRlcyhwYXR0ZXJuKSkgcmV0dXJuIGZiVHlwZTtcbiAgfVxuICAvLyBDaGVjayBwYXJhbXMgZm9yIHRpbWVyL2NvdW50ZXIgc2lnbmF0dXJlc1xuICBjb25zdCBwYXJhbU5hbWVzID0gbmV3IFNldChwYXJhbXMubWFwKHAgPT4gcC5uYW1lLnRvVXBwZXJDYXNlKCkpKTtcbiAgaWYgKHBhcmFtTmFtZXMuaGFzKCdJTicpICYmIHBhcmFtTmFtZXMuaGFzKCdQVCcpKSByZXR1cm4gJ1RPTic7XG4gIGlmIChwYXJhbU5hbWVzLmhhcygnQ1UnKSAmJiBwYXJhbU5hbWVzLmhhcygnUFYnKSkgcmV0dXJuICdDVFUnO1xuICAvLyBGYWxsIGJhY2sgdG8gTU9WRSBhcyBhIHNhZmUgZ2VuZXJpYyBibG9jayBcdTIwMTQgJ0NVU1RPTScgaXMgbm90IGEgdmFsaWQgRkJEQmxvY2tUeXBlXG4gIHJldHVybiAnTU9WRSc7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBQdWJsaWMgQVBJIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIFNUUGFyc2VSZXN1bHQge1xuICBwb3U6IE5vcm1hbGl6ZWRQT1U7XG4gIGVycm9yczogc3RyaW5nW107XG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlU1RTb3VyY2Uoc291cmNlOiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmcpOiBTVFBhcnNlUmVzdWx0IHtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcblxuICB0cnkge1xuICAgIGNvbnN0IHBhcnNlciA9IG5ldyBTVFBhcnNlcihzb3VyY2UpO1xuICAgIGNvbnN0IHJlc3VsdCA9IHBhcnNlci5wYXJzZSgpO1xuXG4gICAgLy8gQ29udmVydCBwYXJzZWQgdmFycyB0byBOb3JtYWxpemVkVGFnW11cbiAgICBjb25zdCBsb2NhbFRhZ3M6IE5vcm1hbGl6ZWRUYWdbXSA9IHJlc3VsdC52YXJzLm1hcCh2ID0+ICh7XG4gICAgICBuYW1lOiB2Lm5hbWUsXG4gICAgICBkYXRhVHlwZTogbWFwU1REYXRhVHlwZSh2LmRhdGFUeXBlKSxcbiAgICAgIGluaXRpYWxWYWx1ZTogdi5pbml0aWFsVmFsdWUsXG4gICAgICByZXRhaW46IHYucmV0YWluLFxuICAgICAgYWRkcmVzczogdi5hZGRyZXNzLFxuICAgIH0pKTtcblxuICAgIC8vIENvbnZlcnQgRkIgY2FsbHMgKyBhc3NpZ25tZW50cyB0byBhbiBGQkQgcHJvZ3JhbVxuICAgIGNvbnN0IHsgbm9kZXMsIHdpcmVzIH0gPSBzdGF0ZW1lbnRzVG9GQkQocmVzdWx0LnN0YXRlbWVudHMsIHJlc3VsdC52YXJzKTtcblxuICAgIGNvbnN0IGZiZFByb2dyYW06IEZCRFByb2dyYW0gPSBub2Rlcy5sZW5ndGggPiAwID8geyBub2Rlcywgd2lyZXMgfSA6IHsgbm9kZXM6IFtdLCB3aXJlczogW10gfTtcblxuICAgIGNvbnN0IHBvdTogTm9ybWFsaXplZFBPVSA9IHtcbiAgICAgIGlkOiBgcG91LSR7cmVzdWx0LnBvdU5hbWV9YCxcbiAgICAgIG5hbWU6IHJlc3VsdC5wb3VOYW1lLFxuICAgICAgbGFuZ3VhZ2U6IG5vZGVzLmxlbmd0aCA+IDAgPyAnRkJEJyA6ICdTVCcsXG4gICAgICBwb3VUeXBlOiByZXN1bHQucG91VHlwZSBhcyBhbnksXG4gICAgICBmYmRQcm9ncmFtOiBub2Rlcy5sZW5ndGggPiAwID8gZmJkUHJvZ3JhbSA6IHVuZGVmaW5lZCxcbiAgICAgIHN0U291cmNlOiBzb3VyY2UsXG4gICAgICBsb2NhbFRhZ3MsXG4gICAgfTtcblxuICAgIHJldHVybiB7IHBvdSwgZXJyb3JzLCB3YXJuaW5ncyB9O1xuICB9IGNhdGNoIChlKSB7XG4gICAgZXJyb3JzLnB1c2goYFNUIHBhcnNlIGVycm9yOiAke2V9YCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBvdToge1xuICAgICAgICBpZDogJ3BvdS1wYXJzZS1lcnJvcicsXG4gICAgICAgIG5hbWU6ICdQYXJzZUVycm9yJyxcbiAgICAgICAgbGFuZ3VhZ2U6ICdTVCcsXG4gICAgICAgIHN0U291cmNlOiBzb3VyY2UsXG4gICAgICAgIGxvY2FsVGFnczogW10sXG4gICAgICB9LFxuICAgICAgZXJyb3JzLFxuICAgICAgd2FybmluZ3MsXG4gICAgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBtYXBTVERhdGFUeXBlKHR5cGVTdHI6IHN0cmluZyk6IElFQ0RhdGFUeXBlIHtcbiAgY29uc3QgdXBwZXIgPSB0eXBlU3RyLnRvVXBwZXJDYXNlKCkudHJpbSgpO1xuICBjb25zdCBtYXA6IFJlY29yZDxzdHJpbmcsIElFQ0RhdGFUeXBlPiA9IHtcbiAgICBCT09MOiAnQk9PTCcsIElOVDogJ0lOVCcsIERJTlQ6ICdESU5UJywgU0lOVDogJ1NJTlQnLCBMSU5UOiAnTElOVCcsXG4gICAgVUlOVDogJ1VJTlQnLCBVRElOVDogJ1VESU5UJywgVVNJTlQ6ICdVU0lOVCcsIFVMSU5UOiAnVUxJTlQnLFxuICAgIFJFQUw6ICdSRUFMJywgTFJFQUw6ICdMUkVBTCcsXG4gICAgQllURTogJ0JZVEUnLCBXT1JEOiAnV09SRCcsIERXT1JEOiAnRFdPUkQnLCBMV09SRDogJ0xXT1JEJyxcbiAgICBTVFJJTkc6ICdTVFJJTkcnLCBXU1RSSU5HOiAnV1NUUklORycsIFRJTUU6ICdUSU1FJywgREFURTogJ0RBVEUnLFxuICAgIFRPTjogJ0JPT0wnLCBUT0Y6ICdCT09MJywgVFA6ICdCT09MJywgQ1RVOiAnQk9PTCcsIENURDogJ0JPT0wnLFxuICB9O1xuICAvLyBIYW5kbGUgZGVyaXZlZCB0eXBlcyBsaWtlIFRPTiwgVE9GIGV0Y1xuICBpZiAodXBwZXIuc3RhcnRzV2l0aCgnQVJSQVknKSkgcmV0dXJuICdESU5UJztcbiAgaWYgKHVwcGVyLnN0YXJ0c1dpdGgoJ1NUUklOR1snKSkgcmV0dXJuICdTVFJJTkcnO1xuICByZXR1cm4gbWFwW3VwcGVyXSB8fCAnRElOVCc7XG59XG5cbmZ1bmN0aW9uIHN0YXRlbWVudHNUb0ZCRChcbiAgc3RhdGVtZW50czogUGFyc2VkU3RhdGVtZW50W10sXG4gIHZhcnM6IFBhcnNlZFZhckRlY2xbXVxuKTogeyBub2RlczogRkJETm9kZVtdOyB3aXJlczogRkJEV2lyZVtdIH0ge1xuICBjb25zdCBub2RlczogRkJETm9kZVtdID0gW107XG4gIGNvbnN0IHdpcmVzOiBGQkRXaXJlW10gPSBbXTtcbiAgbGV0IG5vZGVJZHggPSAwO1xuICBjb25zdCB2YXJUeXBlTWFwID0gbmV3IE1hcCh2YXJzLm1hcCh2ID0+IFt2Lm5hbWUsIHYuZGF0YVR5cGVdKSk7XG5cbiAgZm9yIChjb25zdCBzdG10IG9mIHN0YXRlbWVudHMpIHtcbiAgICBpZiAoc3RtdC5raW5kID09PSAnZmJfY2FsbCcgJiYgc3RtdC5mYkNhbGwpIHtcbiAgICAgIGNvbnN0IGZiID0gc3RtdC5mYkNhbGw7XG4gICAgICBjb25zdCBibG9ja0lkID0gYHN0LWZiZC0ke25vZGVJZHgrK31gO1xuXG4gICAgICBjb25zdCBpbnB1dHM6IFBpbltdID0gZmIucGFyYW1zXG4gICAgICAgIC5maWx0ZXIocCA9PiBwLmRpcmVjdGlvbiA9PT0gJ2luJylcbiAgICAgICAgLm1hcCgocCwgaSkgPT4gKHsgaWQ6IGAke2Jsb2NrSWR9LWluLSR7aX1gLCBuYW1lOiBwLm5hbWUsIGRhdGFUeXBlOiAnQk9PTCcgYXMgSUVDRGF0YVR5cGUgfSkpO1xuICAgICAgY29uc3Qgb3V0cHV0czogUGluW10gPSBmYi5wYXJhbXNcbiAgICAgICAgLmZpbHRlcihwID0+IHAuZGlyZWN0aW9uID09PSAnb3V0JylcbiAgICAgICAgLm1hcCgocCwgaSkgPT4gKHsgaWQ6IGAke2Jsb2NrSWR9LW91dC0ke2l9YCwgbmFtZTogcC5uYW1lLCBkYXRhVHlwZTogJ0JPT0wnIGFzIElFQ0RhdGFUeXBlIH0pKTtcblxuICAgICAgLy8gQWRkIGRlZmF1bHQgb3V0cHV0IGlmIG5vbmUgc3BlY2lmaWVkXG4gICAgICBpZiAob3V0cHV0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgb3V0cHV0cy5wdXNoKHsgaWQ6IGAke2Jsb2NrSWR9LW91dC1RYCwgbmFtZTogJ1EnLCBkYXRhVHlwZTogJ0JPT0wnIH0pO1xuICAgICAgfVxuXG4gICAgICBub2Rlcy5wdXNoKHtcbiAgICAgICAgaWQ6IGJsb2NrSWQsXG4gICAgICAgIHR5cGU6IGZiLmZiVHlwZSBhcyBGQkRCbG9ja1R5cGUsXG4gICAgICAgIGluc3RhbmNlTmFtZTogZmIuaW5zdGFuY2VOYW1lLFxuICAgICAgICBwb3NpdGlvbjogeyB4OiAyMDAsIHk6IG5vZGVJZHggKiAxMDAgfSxcbiAgICAgICAgaW5wdXRzLFxuICAgICAgICBvdXRwdXRzLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIENyZWF0ZSBJTl9WQVJJQUJMRSBub2RlcyBmb3IgZWFjaCBpbnB1dCBwYXJhbSB2YWx1ZVxuICAgICAgZm9yIChjb25zdCBwYXJhbSBvZiBmYi5wYXJhbXMuZmlsdGVyKHAgPT4gcC5kaXJlY3Rpb24gPT09ICdpbicpKSB7XG4gICAgICAgIGNvbnN0IHZhcklkID0gYHN0LWZiZC12YXItJHtub2RlSWR4Kyt9YDtcbiAgICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgICAgaWQ6IHZhcklkLFxuICAgICAgICAgIHR5cGU6ICdJTl9WQVJJQUJMRScsXG4gICAgICAgICAgdGFnOiB7IG5hbWU6IHBhcmFtLnZhbHVlLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICAgICAgcG9zaXRpb246IHsgeDogNTAsIHk6IG5vZGVJZHggKiA4MCB9LFxuICAgICAgICAgIGlucHV0czogW10sXG4gICAgICAgICAgb3V0cHV0czogW3sgaWQ6IGAke3ZhcklkfS1vdXRgLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHRhcmdldFBpbiA9IGlucHV0cy5maW5kKHAgPT4gcC5uYW1lID09PSBwYXJhbS5uYW1lKTtcbiAgICAgICAgaWYgKHRhcmdldFBpbikge1xuICAgICAgICAgIHdpcmVzLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGB3aXJlLSR7dmFySWR9LXRvLSR7YmxvY2tJZH1gLFxuICAgICAgICAgICAgZnJvbTogeyBub2RlSWQ6IHZhcklkLCBwaW46ICdPVVQnIH0sXG4gICAgICAgICAgICB0bzogeyBub2RlSWQ6IGJsb2NrSWQsIHBpbjogcGFyYW0ubmFtZSB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWF0ZSBPVVRfVkFSSUFCTEUgbm9kZXMgZm9yIG91dHB1dCBwYXJhbXNcbiAgICAgIGZvciAoY29uc3QgcGFyYW0gb2YgZmIucGFyYW1zLmZpbHRlcihwID0+IHAuZGlyZWN0aW9uID09PSAnb3V0JykpIHtcbiAgICAgICAgY29uc3QgdmFySWQgPSBgc3QtZmJkLXZhci0ke25vZGVJZHgrK31gO1xuICAgICAgICBub2Rlcy5wdXNoKHtcbiAgICAgICAgICBpZDogdmFySWQsXG4gICAgICAgICAgdHlwZTogJ09VVF9WQVJJQUJMRScsXG4gICAgICAgICAgdGFnOiB7IG5hbWU6IHBhcmFtLnZhbHVlLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICAgICAgcG9zaXRpb246IHsgeDogNDAwLCB5OiBub2RlSWR4ICogODAgfSxcbiAgICAgICAgICBpbnB1dHM6IFt7IGlkOiBgJHt2YXJJZH0taW5gLCBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgICAgICAgIG91dHB1dHM6IFtdLFxuICAgICAgICB9KTtcbiAgICAgICAgd2lyZXMucHVzaCh7XG4gICAgICAgICAgaWQ6IGB3aXJlLSR7YmxvY2tJZH0tdG8tJHt2YXJJZH1gLFxuICAgICAgICAgIGZyb206IHsgbm9kZUlkOiBibG9ja0lkLCBwaW46IHBhcmFtLm5hbWUgfSxcbiAgICAgICAgICB0bzogeyBub2RlSWQ6IHZhcklkLCBwaW46ICdJTicgfSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChzdG10LmtpbmQgPT09ICdhc3NpZ25tZW50JyAmJiBzdG10LmFzc2lnbm1lbnQpIHtcbiAgICAgIC8vIFNpbXBsZSBib29sZWFuIGFzc2lnbm1lbnRzIHdpdGggQU5EL09SIGNhbiBtYXAgdG8gbG9naWMgYmxvY2tzXG4gICAgICBjb25zdCBhc3NpZ24gPSBzdG10LmFzc2lnbm1lbnQ7XG4gICAgICBjb25zdCBleHByVXBwZXIgPSBhc3NpZ24uZXhwcmVzc2lvbi50b1VwcGVyQ2FzZSgpO1xuXG4gICAgICBpZiAoZXhwclVwcGVyLmluY2x1ZGVzKCcgQU5EICcpIHx8IGV4cHJVcHBlci5pbmNsdWRlcygnIE9SICcpIHx8IGV4cHJVcHBlci5pbmNsdWRlcygnIFhPUiAnKSkge1xuICAgICAgICBjb25zdCBvcE1hdGNoID0gZXhwclVwcGVyLm1hdGNoKC9cXGIoQU5EfE9SfFhPUilcXGIvKTtcbiAgICAgICAgaWYgKG9wTWF0Y2gpIHtcbiAgICAgICAgICBjb25zdCBvcCA9IG9wTWF0Y2hbMV0gYXMgRkJEQmxvY2tUeXBlO1xuICAgICAgICAgIGNvbnN0IHBhcnRzID0gYXNzaWduLmV4cHJlc3Npb24uc3BsaXQobmV3IFJlZ0V4cChgXFxcXGIke29wfVxcXFxiYCwgJ2knKSkubWFwKHMgPT4gcy50cmltKCkpO1xuICAgICAgICAgIGNvbnN0IGJsb2NrSWQgPSBgc3QtZmJkLSR7bm9kZUlkeCsrfWA7XG4gICAgICAgICAgY29uc3QgaW5wdXRzOiBQaW5bXSA9IHBhcnRzLm1hcCgoXywgaSkgPT4gKHtcbiAgICAgICAgICAgIGlkOiBgJHtibG9ja0lkfS1pbi0ke2l9YCwgbmFtZTogYElOJHtpICsgMX1gLCBkYXRhVHlwZTogJ0JPT0wnIGFzIElFQ0RhdGFUeXBlLFxuICAgICAgICAgIH0pKTtcbiAgICAgICAgICBjb25zdCBvdXRwdXRzOiBQaW5bXSA9IFt7IGlkOiBgJHtibG9ja0lkfS1vdXQtMGAsIG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH1dO1xuXG4gICAgICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgICAgICBpZDogYmxvY2tJZCxcbiAgICAgICAgICAgIHR5cGU6IG9wLFxuICAgICAgICAgICAgcG9zaXRpb246IHsgeDogMjAwLCB5OiBub2RlSWR4ICogMTAwIH0sXG4gICAgICAgICAgICBpbnB1dHMsXG4gICAgICAgICAgICBvdXRwdXRzLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gSW5wdXQgdmFyaWFibGUgbm9kZXNcbiAgICAgICAgICBmb3IgKGxldCBwaSA9IDA7IHBpIDwgcGFydHMubGVuZ3RoOyBwaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB2YXJJZCA9IGBzdC1mYmQtdmFyLSR7bm9kZUlkeCsrfWA7XG4gICAgICAgICAgICBub2Rlcy5wdXNoKHtcbiAgICAgICAgICAgICAgaWQ6IHZhcklkLFxuICAgICAgICAgICAgICB0eXBlOiAnSU5fVkFSSUFCTEUnLFxuICAgICAgICAgICAgICB0YWc6IHsgbmFtZTogcGFydHNbcGldLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICAgICAgICAgIHBvc2l0aW9uOiB7IHg6IDUwLCB5OiBub2RlSWR4ICogODAgfSxcbiAgICAgICAgICAgICAgaW5wdXRzOiBbXSxcbiAgICAgICAgICAgICAgb3V0cHV0czogW3sgaWQ6IGAke3ZhcklkfS1vdXRgLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgd2lyZXMucHVzaCh7XG4gICAgICAgICAgICAgIGlkOiBgd2lyZS0ke3ZhcklkfS10by0ke2Jsb2NrSWR9YCxcbiAgICAgICAgICAgICAgZnJvbTogeyBub2RlSWQ6IHZhcklkLCBwaW46ICdPVVQnIH0sXG4gICAgICAgICAgICAgIHRvOiB7IG5vZGVJZDogYmxvY2tJZCwgcGluOiBgSU4ke3BpICsgMX1gIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBPdXRwdXQgdmFyaWFibGUgbm9kZVxuICAgICAgICAgIGNvbnN0IG91dFZhcklkID0gYHN0LWZiZC12YXItJHtub2RlSWR4Kyt9YDtcbiAgICAgICAgICBub2Rlcy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBvdXRWYXJJZCxcbiAgICAgICAgICAgIHR5cGU6ICdPVVRfVkFSSUFCTEUnLFxuICAgICAgICAgICAgdGFnOiB7IG5hbWU6IGFzc2lnbi50YXJnZXQsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgICAgICAgIHBvc2l0aW9uOiB7IHg6IDQwMCwgeTogbm9kZUlkeCAqIDgwIH0sXG4gICAgICAgICAgICBpbnB1dHM6IFt7IGlkOiBgJHtvdXRWYXJJZH0taW5gLCBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgICAgICAgICAgb3V0cHV0czogW10sXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgd2lyZXMucHVzaCh7XG4gICAgICAgICAgICBpZDogYHdpcmUtJHtibG9ja0lkfS10by0ke291dFZhcklkfWAsXG4gICAgICAgICAgICBmcm9tOiB7IG5vZGVJZDogYmxvY2tJZCwgcGluOiAnT1VUJyB9LFxuICAgICAgICAgICAgdG86IHsgbm9kZUlkOiBvdXRWYXJJZCwgcGluOiAnSU4nIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBub2Rlcywgd2lyZXMgfTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQXFDQSxNQUFNLFdBQVcsb0JBQUksSUFBSTtBQUFBLEVBQ3ZCO0FBQUEsRUFBVztBQUFBLEVBQWU7QUFBQSxFQUFrQjtBQUFBLEVBQzVDO0FBQUEsRUFBWTtBQUFBLEVBQWdCO0FBQUEsRUFBTztBQUFBLEVBQWE7QUFBQSxFQUNoRDtBQUFBLEVBQWM7QUFBQSxFQUFZO0FBQUEsRUFBYztBQUFBLEVBQ3hDO0FBQUEsRUFBTTtBQUFBLEVBQVE7QUFBQSxFQUFTO0FBQUEsRUFBUTtBQUFBLEVBQy9CO0FBQUEsRUFBUTtBQUFBLEVBQU07QUFBQSxFQUNkO0FBQUEsRUFBTztBQUFBLEVBQU07QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQ3pCO0FBQUEsRUFBUztBQUFBLEVBQWE7QUFBQSxFQUFVO0FBQUEsRUFBUztBQUFBLEVBQ3pDO0FBQUEsRUFBVTtBQUFBLEVBQVE7QUFBQSxFQUNsQjtBQUFBLEVBQU87QUFBQSxFQUFNO0FBQUEsRUFBTztBQUFBLEVBQU87QUFBQSxFQUMzQjtBQUFBLEVBQVE7QUFBQSxFQUFTO0FBQUEsRUFBVTtBQUFBLEVBQVk7QUFBQSxFQUN2QztBQUFBLEVBQVM7QUFBQSxFQUFVO0FBQUEsRUFBYztBQUFBLEVBQVE7QUFDM0MsQ0FBQztBQUVELFNBQVMsU0FBUyxRQUF5QjtBQUN6QyxRQUFN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
