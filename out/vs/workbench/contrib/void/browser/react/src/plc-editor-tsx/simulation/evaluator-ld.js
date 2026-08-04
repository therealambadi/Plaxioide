import { executeFB } from "./function-blocks.js";
function evaluateLadder(clm, tagValues, fbStates, dt, prevTagValues = {}, prevCoilPower = {}, forcedValues) {
  const tagUpdates = {};
  const energized = {};
  const powerAfter = {};
  const blockPinValues = {};
  const coilPowerThisScan = {};
  const newFbStates = new Map(fbStates);
  const newPrevTagValues = { ...tagValues };
  const getEffective = (tagName) => forcedValues && tagName in forcedValues ? forcedValues[tagName] : tagUpdates[tagName] ?? tagValues[tagName];
  const ctx = {
    clm,
    tagValues,
    tagUpdates,
    energized,
    powerAfter,
    blockPinValues,
    coilPowerThisScan,
    fbStates: newFbStates,
    dt,
    prevTagValues,
    prevCoilPower,
    getEffective
  };
  for (const rungId of getOrderedRungs(clm)) {
    evaluateRung(ctx, rungId);
  }
  return {
    tagUpdates,
    energized,
    powerAfter,
    blockPinValues,
    fbStates: newFbStates,
    coilPowerThisScan,
    prevTagValues: newPrevTagValues
  };
}
function getOrderedRungs(clm) {
  const allRungs = clm.getNodesByType("RUNG");
  if (allRungs.length === 0) return [];
  const nextRung = /* @__PURE__ */ new Map();
  for (const id of allRungs) {
    for (const e of clm.getOutEdgesByType(id, "RUNG_ORDER")) nextRung.set(id, e.target);
  }
  const hasIncoming = new Set(nextRung.values());
  let cur = allRungs.find((r) => !hasIncoming.has(r)) ?? allRungs[0];
  const ordered = [];
  const visited = /* @__PURE__ */ new Set();
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    ordered.push(cur);
    cur = nextRung.get(cur);
  }
  for (const r of allRungs) if (!visited.has(r)) ordered.push(r);
  return ordered;
}
const SOURCE = "SOURCE";
const SINK = "SINK";
function buildRungGraph(ctx, rungId) {
  const children = ctx.clm.getChildren(rungId);
  const allEls = [];
  for (const cId of children) {
    const attr = ctx.clm.getNodeAttr(cId);
    if (attr?.type === "LD_ELEMENT") allEls.push({ id: cId, data: attr.data });
  }
  const mainRail = allEls.filter((e) => !e.data.branchId).sort((a, b) => a.data.position.x - b.data.position.x);
  const branchGroups = /* @__PURE__ */ new Map();
  for (const el of allEls) {
    if (!el.data.branchId) continue;
    const g = branchGroups.get(el.data.branchId) ?? [];
    g.push(el);
    branchGroups.set(el.data.branchId, g);
  }
  for (const [, g] of branchGroups) g.sort((a, b) => a.data.position.x - b.data.position.x);
  const edges = [];
  const nodes = /* @__PURE__ */ new Set([SOURCE, SINK]);
  const contacts = mainRail.filter((e) => !e.data.elementKind.startsWith("coil"));
  const coils = mainRail.filter((e) => e.data.elementKind.startsWith("coil"));
  const junctionBefore = {};
  const junctionAfter = {};
  if (contacts.length === 0) {
  } else {
    junctionBefore[contacts[0].id] = SOURCE;
    for (let i = 0; i < contacts.length - 1; i++) {
      const jId = `J_${contacts[i].id}_${contacts[i + 1].id}`;
      junctionAfter[contacts[i].id] = jId;
      junctionBefore[contacts[i + 1].id] = jId;
      nodes.add(jId);
    }
    junctionAfter[contacts[contacts.length - 1].id] = coils.length > 0 ? `J_pre_coils` : SINK;
    if (coils.length > 0) nodes.add("J_pre_coils");
  }
  for (const el of contacts) {
    const from = junctionBefore[el.id];
    const to = junctionAfter[el.id];
    edges.push({ from, to, elId: el.id });
  }
  const coilSource = contacts.length > 0 ? coils.length > 0 ? "J_pre_coils" : SINK : SOURCE;
  for (const coil of coils) {
    edges.push({ from: coilSource, to: SINK, elId: coil.id, isCoil: true });
  }
  for (const [, group] of branchGroups) {
    const anchorId = group[0]?.data.anchorId;
    if (!anchorId) continue;
    const anchorIsContact = contacts.some((c) => c.id === anchorId);
    if (!anchorIsContact) continue;
    const leftJunction = junctionBefore[anchorId];
    const rightJunction = junctionAfter[anchorId];
    if (!leftJunction || !rightJunction) continue;
    if (group.length === 0) {
      edges.push({ from: leftJunction, to: rightJunction });
    } else {
      let prevNode = leftJunction;
      for (let i = 0; i < group.length; i++) {
        const bel = group[i];
        const nextNode = i === group.length - 1 ? rightJunction : `BJ_${group[i].id}_${group[i + 1].id}`;
        if (nextNode !== rightJunction) nodes.add(nextNode);
        edges.push({ from: prevNode, to: nextNode, elId: bel.id });
        prevNode = nextNode;
      }
    }
  }
  return { edges, nodes };
}
function evaluateRung(ctx, rungId) {
  const graph = buildRungGraph(ctx, rungId);
  if (graph.edges.length === 0) return;
  const conducts = /* @__PURE__ */ new Map();
  for (const edge of graph.edges) {
    if (edge.isCoil) {
      conducts.set(edge, false);
      continue;
    }
    if (!edge.elId) {
      conducts.set(edge, true);
      continue;
    }
    const attr = ctx.clm.getNodeAttr(edge.elId);
    if (!attr) {
      conducts.set(edge, false);
      continue;
    }
    const data = attr.data;
    if (data.elementKind === "fb_call") {
      conducts.set(edge, false);
    } else {
      conducts.set(edge, contactConducts(ctx, edge.elId, data));
    }
  }
  const reachable = /* @__PURE__ */ new Set([SOURCE]);
  const queue = [SOURCE];
  const fbEdges = graph.edges.filter((e) => {
    if (!e.elId || e.isCoil) return false;
    const attr = ctx.clm.getNodeAttr(e.elId);
    return attr && attr.data.elementKind === "fb_call";
  });
  let changed = true;
  while (changed) {
    changed = false;
    let head = 0;
    while (head < queue.length) {
      const node = queue[head++];
      for (const edge of graph.edges) {
        if (edge.from !== node || edge.isCoil) continue;
        if (edge.elId) {
          const attr = ctx.clm.getNodeAttr(edge.elId);
          if (attr && attr.data.elementKind === "fb_call") {
            const fbResult = evaluateFBCall(ctx, edge.elId, attr.data, true);
            conducts.set(edge, fbResult);
          }
        }
        if (conducts.get(edge) && !reachable.has(edge.to)) {
          reachable.add(edge.to);
          queue.push(edge.to);
          changed = true;
        }
      }
    }
    for (const edge of fbEdges) {
      if (!reachable.has(edge.from) && conducts.get(edge) === false) {
      }
    }
  }
  for (const edge of graph.edges) {
    if (!edge.elId || edge.isCoil) continue;
    const data = ctx.clm.getNodeAttr(edge.elId)?.data;
    if (!data) continue;
    const sourceReachable = reachable.has(edge.from);
    const targetReachable = reachable.has(edge.to);
    const edgeConducts = !!conducts.get(edge);
    ctx.energized[edge.elId] = sourceReachable && edgeConducts;
    ctx.powerAfter[edge.elId] = targetReachable;
  }
  for (const edge of graph.edges) {
    if (!edge.elId || !edge.isCoil) continue;
    const data = ctx.clm.getNodeAttr(edge.elId)?.data;
    if (!data) continue;
    const powerIn = reachable.has(edge.from);
    evaluateCoilElement(ctx, edge.elId, data, powerIn);
  }
}
function contactConducts(ctx, elId, data) {
  const tagName = getReadTag(ctx.clm, elId);
  if (!tagName) return false;
  const val = toBool(ctx.getEffective(tagName));
  const prevVal = toBool(ctx.prevTagValues[tagName]);
  switch (data.elementKind) {
    case "contact_no":
      return val;
    case "contact_nc":
      return !val;
    case "contact_p":
      return val && !prevVal;
    // rising edge — exactly one scan
    case "contact_n":
      return !val && prevVal;
    // falling edge — exactly one scan
    default:
      return val;
  }
}
function evaluateFBCall(ctx, elId, data, powerIn) {
  if (!powerIn || !data.fbType) return false;
  const inlineOps = /* @__PURE__ */ new Set(["EQ", "NE", "GT", "GE", "LT", "LE", "ADD", "SUB", "MUL", "DIV", "MOD", "ABS", "SQRT", "MOVE", "SEL", "LIMIT", "MIN", "MAX"]);
  if (inlineOps.has(data.fbType)) {
    const pinToTag = {};
    for (const edge of ctx.clm.getOutEdgesByType(elId, "READS")) {
      const tagData = ctx.clm.getNodeData(edge.target);
      const pin = edge.data?.pin || "IN";
      pinToTag[pin] = tagData.name;
    }
    const getVal = (pin) => ctx.getEffective(pinToTag[pin] ?? "") ?? 0;
    const toNum = (v) => {
      if (typeof v === "number") return v;
      if (typeof v === "boolean") return v ? 1 : 0;
      const n = parseFloat(String(v ?? "0"));
      return isNaN(n) ? 0 : n;
    };
    const toBoolLocal = (v) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v !== 0;
      return v === "TRUE" || v === "true" || v === "1";
    };
    const a = toNum(getVal("IN1") ?? getVal("IN"));
    const b = toNum(getVal("IN2"));
    let result2;
    switch (data.fbType) {
      case "EQ":
        result2 = a === b;
        break;
      case "NE":
        result2 = a !== b;
        break;
      case "GT":
        result2 = a > b;
        break;
      case "GE":
        result2 = a >= b;
        break;
      case "LT":
        result2 = a < b;
        break;
      case "LE":
        result2 = a <= b;
        break;
      case "ADD":
        result2 = a + b;
        break;
      case "SUB":
        result2 = a - b;
        break;
      case "MUL":
        result2 = a * b;
        break;
      case "DIV":
        result2 = b !== 0 ? a / b : 0;
        break;
      case "MOD":
        result2 = b !== 0 ? a % b : 0;
        break;
      case "ABS":
        result2 = Math.abs(a);
        break;
      case "SQRT":
        result2 = Math.sqrt(Math.max(0, a));
        break;
      case "MOVE":
        result2 = getVal("IN");
        break;
      case "SEL":
        result2 = toBoolLocal(getVal("G")) ? toNum(getVal("IN1")) : toNum(getVal("IN0"));
        break;
      case "LIMIT": {
        const mn = toNum(getVal("MN"));
        const mx = toNum(getVal("MX"));
        result2 = Math.max(mn, Math.min(mx, a));
        break;
      }
      case "MIN":
        result2 = Math.min(a, b);
        break;
      case "MAX":
        result2 = Math.max(a, b);
        break;
      default:
        result2 = false;
    }
    for (const edge of ctx.clm.getOutEdgesByType(elId, "WRITES")) {
      const tagData = ctx.clm.getNodeData(edge.target);
      ctx.tagUpdates[tagData.name] = result2;
    }
    ctx.blockPinValues[`${elId}:OUT`] = String(result2);
    ctx.energized[elId] = true;
    ctx.powerAfter[elId] = typeof result2 === "boolean" ? result2 : true;
    return typeof result2 === "boolean" ? result2 : true;
  }
  const instanceKey = data.instanceName || elId;
  const inputs = {};
  const readEdges = ctx.clm.getOutEdgesByType(elId, "READS");
  for (const edge of readEdges) {
    const tagData = ctx.clm.getNodeData(edge.target);
    const pin = edge.data?.pin || "IN";
    inputs[pin] = ctx.getEffective(tagData.name) ?? false;
  }
  if (readEdges.length === 1 && inputs["IN"] === void 0) {
    const tagData = ctx.clm.getNodeData(readEdges[0].target);
    inputs["IN"] = ctx.getEffective(tagData.name) ?? false;
  }
  const result = executeFB(data.fbType, inputs, ctx.fbStates.get(instanceKey), { dt: ctx.dt });
  ctx.fbStates.set(instanceKey, result.state);
  for (const edge of ctx.clm.getOutEdgesByType(elId, "WRITES")) {
    const tagData = ctx.clm.getNodeData(edge.target);
    const pin = edge.data?.pin || "Q";
    if (result.outputs[pin] !== void 0) ctx.tagUpdates[tagData.name] = result.outputs[pin];
  }
  for (const [pin, val] of Object.entries(result.outputs)) {
    ctx.blockPinValues[`${elId}:${pin}`] = String(val);
  }
  return toBool(result.outputs.Q ?? result.outputs.Q1 ?? false);
}
function evaluateCoilElement(ctx, elId, data, powerIn) {
  ctx.coilPowerThisScan[elId] = powerIn;
  ctx.energized[elId] = powerIn;
  ctx.powerAfter[elId] = false;
  const tagName = getWriteTag(ctx.clm, elId);
  if (!tagName) return;
  const prevPower = toBool(ctx.prevCoilPower[elId]);
  switch (data.elementKind) {
    case "coil":
      ctx.tagUpdates[tagName] = powerIn;
      break;
    case "coil_negated":
      ctx.tagUpdates[tagName] = !powerIn;
      break;
    case "coil_set":
    case "coil_latch":
      if (powerIn) ctx.tagUpdates[tagName] = true;
      break;
    case "coil_reset":
    case "coil_unlatch":
      if (powerIn) ctx.tagUpdates[tagName] = false;
      break;
    case "coil_p":
      ctx.tagUpdates[tagName] = powerIn && !prevPower;
      break;
    case "coil_n":
      ctx.tagUpdates[tagName] = !powerIn && prevPower;
      break;
  }
}
function getReadTag(clm, elementId) {
  const edges = clm.getOutEdgesByType(elementId, "READS");
  if (edges.length === 0) return void 0;
  return clm.getNodeData(edges[0].target)?.name;
}
function getWriteTag(clm, elementId) {
  const edges = clm.getOutEdgesByType(elementId, "WRITES");
  if (edges.length === 0) return void 0;
  return clm.getNodeData(edges[0].target)?.name;
}
function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v === "TRUE" || v === "true" || v === "1";
  if (Array.isArray(v)) return toBool(v[0]);
  return !!v;
}
export {
  evaluateLadder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L3NpbXVsYXRpb24vZXZhbHVhdG9yLWxkLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIElFQyA2MTEzMS0zIExhZGRlciBEaWFncmFtIGV2YWx1YXRvciBcdTIwMTQgZ3JhcGgtcmVhY2hhYmlsaXR5IG1vZGVsLlxuICpcbiAqIEVhY2ggcnVuZyBpcyBtb2RlbGVkIGFzIGEgZGlyZWN0ZWQgQm9vbGVhbiBncmFwaDpcbiAqICAgLSBOb2RlczoganVuY3Rpb24gcG9pbnRzIChsZWZ0IHJhaWwgc291cmNlLCByaWdodCByYWlsIHNpbmssIGludGVyLWVsZW1lbnQganVuY3Rpb25zKS5cbiAqICAgLSBFZGdlczogd2lyZSBzZWdtZW50cy4gRWFjaCBlZGdlIGNhcnJpZXMgemVybyBvciBvbmUgZWxlbWVudCAoY29udGFjdC9ibG9jaykuXG4gKiAgICAgQW4gZWRnZSB3aXRoIG5vIGVsZW1lbnQgaXMgYSBwbGFpbiB3aXJlIFx1MjAxNCBhbHdheXMgY29uZHVjdHMuXG4gKiAgICAgQW4gZWRnZSB3aXRoIGEgY29udGFjdCBjb25kdWN0cyBwZXIgU2VjdGlvbiAyLjEgcnVsZXMgKE5PL05DL1AvTikuXG4gKiAgICAgQW4gZWRnZSB3aXRoIGEgY29pbCBpcyBhIHNpbmsgZWRnZSBcdTIwMTQgcmVjb3JkcyBwb3dlciBhcnJpdmFsLCB3cml0ZXMgdGFnLCBuZXZlciBwcm9wYWdhdGVzLlxuICogICAtIFBhcmFsbGVsIGJyYW5jaGVzIGFkZCBleHRyYSBlZGdlcyBiZXR3ZWVuIHRoZSBqdW5jdGlvbiBub2RlcyB0aGF0IGZsYW5rIHRoZWlyIGFuY2hvciBlbGVtZW50LlxuICpcbiAqIFBvd2VyIGZsb3cgPSBCRlMgcmVhY2hhYmlsaXR5IGZyb20gdGhlIGxlZnQtcmFpbCBzb3VyY2Ugbm9kZSwgZm9sbG93aW5nIG9ubHkgY29uZHVjdGluZyBlZGdlcy5cbiAqIEEgbm9kZSBpcyBlbmVyZ2l6ZWQgaWYgaXQgaXMgcmVhY2hhYmxlLiBBIGNvaWwgZmlyZXMgaWYgaXRzIHNpbmsgZWRnZSdzIHNvdXJjZSBub2RlIGlzIGVuZXJnaXplZC5cbiAqXG4gKiBUaGlzIG1vZGVsIGlzIHByb3ZhYmx5IGdlbmVyYWw6IGFueSBzZXJpZXMvcGFyYWxsZWwvbmVzdGVkLWJyYW5jaCBjb21iaW5hdGlvbiBtYXBzIHRvIGEgZ3JhcGgsXG4gKiBhbmQgQkZTIHJlYWNoYWJpbGl0eSBpcyBjb3JyZWN0IGZvciBhbGwgZ3JhcGhzIGJ5IGRlZmluaXRpb24uXG4gKlxuICogcG93ZXJBZnRlcltlbGVtZW50SWRdOiBwb3dlciBleGl0aW5nIHJpZ2h0IHNpZGUgb2YgZWxlbWVudCBcdTIwMTQgdXNlZCBieSB3aXJlIHJlbmRlcmVyLlxuICogZW5lcmdpemVkW2VsZW1lbnRJZF06ICBlbGVtZW50IGdseXBoIGNvbG9yIFx1MjAxNCB0aGUgZWxlbWVudCBpbmRpdmlkdWFsbHkgY29uZHVjdGVkLlxuICogVGhlc2UgZGlmZmVyIGF0IGJyYW5jaCBhbmNob3JzOiBieXBhc3MgYnJhbmNoIGNhbiBtYWtlIHBvd2VyQWZ0ZXI9dHJ1ZSB3aGlsZSBhbmNob3IgZW5lcmdpemVkPWZhbHNlLlxuICovXG5cbmltcG9ydCB7IENMTUdyYXBoIH0gZnJvbSAnLi4vY2xtL2dyYXBoLmpzJztcbmltcG9ydCB0eXBlIHsgTERFbGVtZW50Tm9kZURhdGEsIFRhZ05vZGVEYXRhIH0gZnJvbSAnLi4vY2xtL3NjaGVtYS5qcyc7XG5pbXBvcnQgeyBUYWdTdGF0ZSwgRkJJbnN0YW5jZVN0YXRlLCBGQkNvbnRleHQgfSBmcm9tICcuL3R5cGVzLmpzJztcbmltcG9ydCB7IGV4ZWN1dGVGQiB9IGZyb20gJy4vZnVuY3Rpb24tYmxvY2tzLmpzJztcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFB1YmxpYyByZXN1bHQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBpbnRlcmZhY2UgTERFdmFsUmVzdWx0IHtcbiAgdGFnVXBkYXRlczogVGFnU3RhdGU7XG4gIGVuZXJnaXplZDogIFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xuICAvKiogUG93ZXIgZXhpdGluZyByaWdodCBzaWRlIG9mIGVhY2ggZWxlbWVudCBcdTIwMTQgZm9yIHdpcmUgcmVuZGVyZXIuICovXG4gIHBvd2VyQWZ0ZXI6ICAgIFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xuICBibG9ja1BpblZhbHVlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgZmJTdGF0ZXM6ICAgICAgTWFwPHN0cmluZywgRkJJbnN0YW5jZVN0YXRlPjtcbiAgLyoqIENvaWwgcG93ZXIgdGhpcyBzY2FuIFx1MjAxNCBmb3IgUC9OIGNvaWwgZWRnZSBkZXRlY3Rpb24gbmV4dCBzY2FuLiAqL1xuICBjb2lsUG93ZXJUaGlzU2NhbjogUmVjb3JkPHN0cmluZywgYm9vbGVhbj47XG4gIHByZXZUYWdWYWx1ZXM6IFRhZ1N0YXRlO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRW50cnkgcG9pbnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBmdW5jdGlvbiBldmFsdWF0ZUxhZGRlcihcbiAgY2xtOiAgICAgICAgICAgQ0xNR3JhcGgsXG4gIHRhZ1ZhbHVlczogICAgIFRhZ1N0YXRlLFxuICBmYlN0YXRlczogICAgICBNYXA8c3RyaW5nLCBGQkluc3RhbmNlU3RhdGU+LFxuICBkdDogICAgICAgICAgICBudW1iZXIsXG4gIHByZXZUYWdWYWx1ZXM6ICAgICBUYWdTdGF0ZSA9IHt9LFxuICBwcmV2Q29pbFBvd2VyOiAgICAgUmVjb3JkPHN0cmluZywgYm9vbGVhbj4gPSB7fSxcbiAgZm9yY2VkVmFsdWVzPzogICAgIFJlY29yZDxzdHJpbmcsIGFueT4sXG4pOiBMREV2YWxSZXN1bHQge1xuICBjb25zdCB0YWdVcGRhdGVzOiAgICAgICBUYWdTdGF0ZSAgICAgICAgICAgICAgICAgID0ge307XG4gIGNvbnN0IGVuZXJnaXplZDogICAgICAgIFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+ICAgPSB7fTtcbiAgY29uc3QgcG93ZXJBZnRlcjogICAgICAgUmVjb3JkPHN0cmluZywgYm9vbGVhbj4gICA9IHt9O1xuICBjb25zdCBibG9ja1BpblZhbHVlczogICBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ICAgID0ge307XG4gIGNvbnN0IGNvaWxQb3dlclRoaXNTY2FuOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiAgPSB7fTtcbiAgY29uc3QgbmV3RmJTdGF0ZXMgICAgICAgPSBuZXcgTWFwKGZiU3RhdGVzKTtcbiAgY29uc3QgbmV3UHJldlRhZ1ZhbHVlczogVGFnU3RhdGUgICAgICAgICAgICAgICAgICA9IHsgLi4udGFnVmFsdWVzIH07XG5cbiAgLy8gU2luZ2xlIGZvcmNlLWluamVjdGlvbiBwb2ludCBcdTIwMTQgb25seSBwbGFjZSBmb3JjaW5nIGxvZ2ljIGxpdmVzLlxuICBjb25zdCBnZXRFZmZlY3RpdmUgPSAodGFnTmFtZTogc3RyaW5nKTogYW55ID0+XG4gICAgZm9yY2VkVmFsdWVzICYmIHRhZ05hbWUgaW4gZm9yY2VkVmFsdWVzXG4gICAgICA/IGZvcmNlZFZhbHVlc1t0YWdOYW1lXVxuICAgICAgOiAodGFnVXBkYXRlc1t0YWdOYW1lXSA/PyB0YWdWYWx1ZXNbdGFnTmFtZV0pO1xuXG4gIGNvbnN0IGN0eDogRXZhbEN0eCA9IHtcbiAgICBjbG0sIHRhZ1ZhbHVlcywgdGFnVXBkYXRlcywgZW5lcmdpemVkLCBwb3dlckFmdGVyLFxuICAgIGJsb2NrUGluVmFsdWVzLCBjb2lsUG93ZXJUaGlzU2NhbiwgZmJTdGF0ZXM6IG5ld0ZiU3RhdGVzLCBkdCxcbiAgICBwcmV2VGFnVmFsdWVzLCBwcmV2Q29pbFBvd2VyLCBnZXRFZmZlY3RpdmUsXG4gIH07XG5cbiAgZm9yIChjb25zdCBydW5nSWQgb2YgZ2V0T3JkZXJlZFJ1bmdzKGNsbSkpIHtcbiAgICBldmFsdWF0ZVJ1bmcoY3R4LCBydW5nSWQpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICB0YWdVcGRhdGVzLCBlbmVyZ2l6ZWQsIHBvd2VyQWZ0ZXIsIGJsb2NrUGluVmFsdWVzLFxuICAgIGZiU3RhdGVzOiBuZXdGYlN0YXRlcywgY29pbFBvd2VyVGhpc1NjYW4sXG4gICAgcHJldlRhZ1ZhbHVlczogbmV3UHJldlRhZ1ZhbHVlcyxcbiAgfTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEludGVybmFsIGNvbnRleHQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmludGVyZmFjZSBFdmFsQ3R4IHtcbiAgY2xtOiAgICAgICAgICAgICAgIENMTUdyYXBoO1xuICB0YWdWYWx1ZXM6ICAgICAgICAgVGFnU3RhdGU7XG4gIHRhZ1VwZGF0ZXM6ICAgICAgICBUYWdTdGF0ZTtcbiAgZW5lcmdpemVkOiAgICAgICAgIFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xuICBwb3dlckFmdGVyOiAgICAgICAgUmVjb3JkPHN0cmluZywgYm9vbGVhbj47XG4gIGJsb2NrUGluVmFsdWVzOiAgICBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBjb2lsUG93ZXJUaGlzU2NhbjogUmVjb3JkPHN0cmluZywgYm9vbGVhbj47XG4gIGZiU3RhdGVzOiAgICAgICAgICBNYXA8c3RyaW5nLCBGQkluc3RhbmNlU3RhdGU+O1xuICBkdDogICAgICAgICAgICAgICAgbnVtYmVyO1xuICBwcmV2VGFnVmFsdWVzOiAgICAgVGFnU3RhdGU7XG4gIHByZXZDb2lsUG93ZXI6ICAgICBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPjtcbiAgZ2V0RWZmZWN0aXZlOiAgICAgICh0YWdOYW1lOiBzdHJpbmcpID0+IGFueTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFJ1bmcgb3JkZXJpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGdldE9yZGVyZWRSdW5ncyhjbG06IENMTUdyYXBoKTogc3RyaW5nW10ge1xuICBjb25zdCBhbGxSdW5ncyA9IGNsbS5nZXROb2Rlc0J5VHlwZSgnUlVORycpO1xuICBpZiAoYWxsUnVuZ3MubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG4gIGNvbnN0IG5leHRSdW5nID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBpZCBvZiBhbGxSdW5ncykge1xuICAgIGZvciAoY29uc3QgZSBvZiBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoaWQsICdSVU5HX09SREVSJykpIG5leHRSdW5nLnNldChpZCwgZS50YXJnZXQpO1xuICB9XG4gIGNvbnN0IGhhc0luY29taW5nID0gbmV3IFNldChuZXh0UnVuZy52YWx1ZXMoKSk7XG4gIGxldCBjdXI6IHN0cmluZyB8IHVuZGVmaW5lZCA9IGFsbFJ1bmdzLmZpbmQociA9PiAhaGFzSW5jb21pbmcuaGFzKHIpKSA/PyBhbGxSdW5nc1swXTtcbiAgY29uc3Qgb3JkZXJlZDogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgdmlzaXRlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICB3aGlsZSAoY3VyICYmICF2aXNpdGVkLmhhcyhjdXIpKSB7IHZpc2l0ZWQuYWRkKGN1cik7IG9yZGVyZWQucHVzaChjdXIpOyBjdXIgPSBuZXh0UnVuZy5nZXQoY3VyKTsgfVxuICBmb3IgKGNvbnN0IHIgb2YgYWxsUnVuZ3MpIGlmICghdmlzaXRlZC5oYXMocikpIG9yZGVyZWQucHVzaChyKTtcbiAgcmV0dXJuIG9yZGVyZWQ7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBSdW5nIGdyYXBoIHJlcHJlc2VudGF0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy9cbi8vIFdlIGJ1aWxkIGEgbGlnaHR3ZWlnaHQgZGlyZWN0ZWQgZ3JhcGggd2l0aDpcbi8vICAgLSBTdHJpbmcgbm9kZSBJRHMgKHN5bnRoZXRpYzogJ1NPVVJDRScsICdTSU5LJywgb3IganVuY3Rpb24gSURzIGxpa2UgJ0pfYmVmb3JlXzxlbElkPicpXG4vLyAgIC0gRGlyZWN0ZWQgZWRnZXMgY2FycnlpbmcgYW4gb3B0aW9uYWwgZWxlbWVudCByZWZlcmVuY2UgKyBjb25kdWN0aW9uIHN0YXRlXG4vL1xuLy8gR3JhcGggc2hhcGUgZm9yIGEgcnVuZyB3aXRoIG1haW4gZWxlbWVudHMgW0EsIEIsIENdIGFuZCBvbmUgYnJhbmNoIHBhcmFsbGVsIHRvIEI6XG4vL1xuLy8gICBTT1VSQ0UgLS1BLS0+IEpfQSAgLS1CLS0+IEpfQiAgLS1DLS0+IFNJTktcbi8vICAgICAgICAgICAgICAgICB8ICAgICAgICAgICAgICAgICAgXlxuLy8gICAgICAgICAgICAgICAgICstLS0tYnJhbmNoRWwtLS0tLS18XG4vL1xuLy8gVGhlIGJyYW5jaCBhZGRzIGFuIGV4dHJhIGVkZ2UgZnJvbSBKX0EgKGp1bmN0aW9uIGJlZm9yZSBCKSB0byBKX0IgKGp1bmN0aW9uIGFmdGVyIEIpLlxuLy8gQkZTIGZyb20gU09VUkNFIGZvbGxvd2luZyBjb25kdWN0aW5nIGVkZ2VzIGRldGVybWluZXMgd2hpY2ggbm9kZXMgYXJlIHJlYWNoYWJsZS5cblxuaW50ZXJmYWNlIFJ1bmdFZGdlIHtcbiAgZnJvbTogICAgc3RyaW5nO1xuICB0bzogICAgICBzdHJpbmc7XG4gIGVsSWQ/OiAgIHN0cmluZzsgIC8vIGVsZW1lbnQgSUQgaWYgdGhpcyBlZGdlIGNhcnJpZXMgYSBjb250YWN0L2Jsb2NrOyB1bmRlZmluZWQgPSBwbGFpbiB3aXJlXG4gIGlzQ29pbD86IGJvb2xlYW47IC8vIGNvaWwgZWRnZXMgYXJlIHNpbmtzIFx1MjAxNCB0aGV5IGZpcmUgd2hlbiBgZnJvbWAgaXMgcmVhY2hhYmxlIGJ1dCBuZXZlciBwcm9wYWdhdGVcbn1cblxuaW50ZXJmYWNlIFJ1bmdHcmFwaCB7XG4gIGVkZ2VzOiBSdW5nRWRnZVtdO1xuICAvLyBBbGwgbm9kZSBJRHMgcHJlc2VudCAodW5pb24gb2YgYWxsIGZyb20vdG8pXG4gIG5vZGVzOiBTZXQ8c3RyaW5nPjtcbn1cblxuY29uc3QgU09VUkNFID0gJ1NPVVJDRSc7XG5jb25zdCBTSU5LICAgPSAnU0lOSyc7XG5cbi8qKlxuICogQnVpbGQgdGhlIGp1bmN0aW9uLW5vZGUgZ3JhcGggZm9yIGEgcnVuZy5cbiAqXG4gKiBNYWluLXJhaWwgZWxlbWVudHMgZm9ybSBhIHNlcmllcyBjaGFpbjogU09VUkNFIFx1MjE5MiBKMCBcdTIxOTIgSjEgXHUyMTkyIFx1MjAyNiBcdTIxOTIgSm4gXHUyMTkyIFNJTktcbiAqIHdoZXJlIGVhY2ggSmkgaXMgdGhlIGp1bmN0aW9uIGJldHdlZW4gZWxlbWVudCBpIGFuZCBlbGVtZW50IGkrMS5cbiAqIEp1bmN0aW9uIGJlZm9yZSBmaXJzdCBtYWluIGVsZW1lbnQgPSBTT1VSQ0U7IGp1bmN0aW9uIGFmdGVyIGxhc3QgPSBTSU5LLlxuICpcbiAqIEZvciBlYWNoIGJyYW5jaCAoaWRlbnRpZmllZCBieSBhbmNob3JJZCBvbiB0aGUgYnJhbmNoJ3MgZmlyc3QgZWxlbWVudCk6XG4gKiAgIC0gTG9jYXRlIHRoZSBhbmNob3IgZWxlbWVudCBvbiB0aGUgbWFpbiByYWlsLiBJdHMgbGVmdCBqdW5jdGlvbiA9IGp1bmN0aW9uQmVmb3JlW2FuY2hvcl0sXG4gKiAgICAgaXRzIHJpZ2h0IGp1bmN0aW9uID0ganVuY3Rpb25BZnRlclthbmNob3JdLlxuICogICAtIEFkZCBhIHNlcmllcyBvZiBlZGdlcyBmb3IgdGhlIGJyYW5jaCBlbGVtZW50cyBiZXR3ZWVuIHRob3NlIHR3byBqdW5jdGlvbnMuXG4gKiAgIC0gVGhpcyBuYXR1cmFsbHkgY3JlYXRlcyBwYXJhbGxlbCBwYXRocywgY29ycmVjdGx5IE9SLWluZyB0aGUgYW5jaG9yIHdpdGggdGhlIGJyYW5jaC5cbiAqXG4gKiBDb2lsIGVsZW1lbnRzOiBwbGFjZWQgYXQgdGhlIHJpZ2h0IGVuZCBvZiB0aGUgbWFpbiByYWlsIChvciBhcyBhIHBhcmFsbGVsIGJyYW5jaCBvZiB0aGUgcmlnaHRtb3N0XG4gKiBub24tY29pbCkuIEVhY2ggY29pbCBnZXRzIGEgZGVkaWNhdGVkIHNpbmsgZWRnZSBmcm9tIHRoZSBqdW5jdGlvbiBiZWZvcmUgaXQgdG8gU0lOSywgdGFnZ2VkIGlzQ29pbC5cbiAqL1xuZnVuY3Rpb24gYnVpbGRSdW5nR3JhcGgoXG4gIGN0eDogICAgRXZhbEN0eCxcbiAgcnVuZ0lkOiBzdHJpbmcsXG4pOiBSdW5nR3JhcGgge1xuICBjb25zdCBjaGlsZHJlbiA9IGN0eC5jbG0uZ2V0Q2hpbGRyZW4ocnVuZ0lkKTtcbiAgY29uc3QgYWxsRWxzOiBBcnJheTx7IGlkOiBzdHJpbmc7IGRhdGE6IExERWxlbWVudE5vZGVEYXRhIH0+ID0gW107XG4gIGZvciAoY29uc3QgY0lkIG9mIGNoaWxkcmVuKSB7XG4gICAgY29uc3QgYXR0ciA9IGN0eC5jbG0uZ2V0Tm9kZUF0dHIoY0lkKTtcbiAgICBpZiAoYXR0cj8udHlwZSA9PT0gJ0xEX0VMRU1FTlQnKSBhbGxFbHMucHVzaCh7IGlkOiBjSWQsIGRhdGE6IGF0dHIuZGF0YSBhcyBMREVsZW1lbnROb2RlRGF0YSB9KTtcbiAgfVxuXG4gIC8vIFBhcnRpdGlvbiBpbnRvIG1haW4tcmFpbCAobm8gYnJhbmNoSWQpIHZzIGJyYW5jaCBlbGVtZW50c1xuICBjb25zdCBtYWluUmFpbCA9IGFsbEVscy5maWx0ZXIoZSA9PiAhZS5kYXRhLmJyYW5jaElkKVxuICAgICAgICAgICAgICAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBhLmRhdGEucG9zaXRpb24ueCAtIGIuZGF0YS5wb3NpdGlvbi54KTtcblxuICAvLyBHcm91cCBicmFuY2ggZWxlbWVudHMgYnkgYnJhbmNoSWQsIHNvcnRlZCBsZWZ0LXRvLXJpZ2h0IHdpdGhpbiBlYWNoIGdyb3VwXG4gIGNvbnN0IGJyYW5jaEdyb3VwcyA9IG5ldyBNYXA8c3RyaW5nLCBBcnJheTx7IGlkOiBzdHJpbmc7IGRhdGE6IExERWxlbWVudE5vZGVEYXRhIH0+PigpO1xuICBmb3IgKGNvbnN0IGVsIG9mIGFsbEVscykge1xuICAgIGlmICghZWwuZGF0YS5icmFuY2hJZCkgY29udGludWU7XG4gICAgY29uc3QgZyA9IGJyYW5jaEdyb3Vwcy5nZXQoZWwuZGF0YS5icmFuY2hJZCkgPz8gW107XG4gICAgZy5wdXNoKGVsKTtcbiAgICBicmFuY2hHcm91cHMuc2V0KGVsLmRhdGEuYnJhbmNoSWQsIGcpO1xuICB9XG4gIGZvciAoY29uc3QgWywgZ10gb2YgYnJhbmNoR3JvdXBzKSBnLnNvcnQoKGEsIGIpID0+IGEuZGF0YS5wb3NpdGlvbi54IC0gYi5kYXRhLnBvc2l0aW9uLngpO1xuXG4gIGNvbnN0IGVkZ2VzOiBSdW5nRWRnZVtdID0gW107XG4gIGNvbnN0IG5vZGVzID0gbmV3IFNldDxzdHJpbmc+KFtTT1VSQ0UsIFNJTktdKTtcblxuICAvLyBCdWlsZCBqdW5jdGlvbiBJRHMgZm9yIG1haW4tcmFpbCBlbGVtZW50IGJvdW5kYXJpZXMuXG4gIC8vIGp1bmN0aW9uQmVmb3JlW2ldID0gbGVmdCBzaWRlIG9mIG1haW5SYWlsW2ldOyBqdW5jdGlvbkFmdGVyW2ldID0gcmlnaHQgc2lkZS5cbiAgLy8ganVuY3Rpb25CZWZvcmVbMF0gPSBTT1VSQ0U7IGp1bmN0aW9uQWZ0ZXJbbGFzdF0gZGVwZW5kcyBvbiBlbGVtZW50IHR5cGUuXG4gIGNvbnN0IGNvbnRhY3RzID0gbWFpblJhaWwuZmlsdGVyKGUgPT4gIWUuZGF0YS5lbGVtZW50S2luZC5zdGFydHNXaXRoKCdjb2lsJykpO1xuICBjb25zdCBjb2lscyAgICA9IG1haW5SYWlsLmZpbHRlcihlID0+ICBlLmRhdGEuZWxlbWVudEtpbmQuc3RhcnRzV2l0aCgnY29pbCcpKTtcblxuICAvLyBCdWlsZCBqdW5jdGlvbiBub2RlIElEcyBmb3IgZWFjaCBjb250YWN0L2Jsb2NrICh0aGUgbm9uLXRlcm1pbmFsIGVsZW1lbnRzKVxuICAvLyBKX2JlZm9yZV9baWRdIGFuZCBKX2FmdGVyX1tpZF0gXHUyMDE0IGJ1dCBjb25zZWN1dGl2ZSBlbGVtZW50cyBzaGFyZSBhIGp1bmN0aW9uOlxuICAvLyAgIGp1bmN0aW9uQWZ0ZXJbaV0gPT09IGp1bmN0aW9uQmVmb3JlW2krMV1cbiAgLy8gV2UgZ2VuZXJhdGUgb25lIGp1bmN0aW9uIElEIHBlciBpbnRlci1lbGVtZW50IGdhcC5cbiAgY29uc3QganVuY3Rpb25CZWZvcmU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgY29uc3QganVuY3Rpb25BZnRlcjogIFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcblxuICBpZiAoY29udGFjdHMubGVuZ3RoID09PSAwKSB7XG4gICAgLy8gUnVuZyBoYXMgb25seSBjb2lscyAob3IgaXMgZW1wdHkpIFx1MjAxNCBTT1VSQ0UgZGlyZWN0bHkgY29ubmVjdHMgdG8gU0lOSyBmb3IgY29pbHNcbiAgfSBlbHNlIHtcbiAgICBqdW5jdGlvbkJlZm9yZVtjb250YWN0c1swXS5pZF0gPSBTT1VSQ0U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb250YWN0cy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGNvbnN0IGpJZCA9IGBKXyR7Y29udGFjdHNbaV0uaWR9XyR7Y29udGFjdHNbaSArIDFdLmlkfWA7XG4gICAgICBqdW5jdGlvbkFmdGVyW2NvbnRhY3RzW2ldLmlkXSAgICAgID0gaklkO1xuICAgICAganVuY3Rpb25CZWZvcmVbY29udGFjdHNbaSArIDFdLmlkXSA9IGpJZDtcbiAgICAgIG5vZGVzLmFkZChqSWQpO1xuICAgIH1cbiAgICBqdW5jdGlvbkFmdGVyW2NvbnRhY3RzW2NvbnRhY3RzLmxlbmd0aCAtIDFdLmlkXSA9IGNvaWxzLmxlbmd0aCA+IDAgPyBgSl9wcmVfY29pbHNgIDogU0lOSztcbiAgICBpZiAoY29pbHMubGVuZ3RoID4gMCkgbm9kZXMuYWRkKCdKX3ByZV9jb2lscycpO1xuICB9XG5cbiAgLy8gQWRkIGVkZ2VzIGZvciBtYWluLXJhaWwgY29udGFjdHMvYmxvY2tzXG4gIGZvciAoY29uc3QgZWwgb2YgY29udGFjdHMpIHtcbiAgICBjb25zdCBmcm9tID0ganVuY3Rpb25CZWZvcmVbZWwuaWRdO1xuICAgIGNvbnN0IHRvICAgPSBqdW5jdGlvbkFmdGVyW2VsLmlkXTtcbiAgICBlZGdlcy5wdXNoKHsgZnJvbSwgdG8sIGVsSWQ6IGVsLmlkIH0pO1xuICB9XG5cbiAgLy8gQWRkIHNpbmsgZWRnZXMgZm9yIGNvaWxzIChmcm9tIEpfcHJlX2NvaWxzIG9yIFNPVVJDRSBpZiBubyBjb250YWN0cywgdG8gU0lOSylcbiAgY29uc3QgY29pbFNvdXJjZSA9IGNvbnRhY3RzLmxlbmd0aCA+IDAgPyAoY29pbHMubGVuZ3RoID4gMCA/ICdKX3ByZV9jb2lscycgOiBTSU5LKSA6IFNPVVJDRTtcbiAgZm9yIChjb25zdCBjb2lsIG9mIGNvaWxzKSB7XG4gICAgZWRnZXMucHVzaCh7IGZyb206IGNvaWxTb3VyY2UsIHRvOiBTSU5LLCBlbElkOiBjb2lsLmlkLCBpc0NvaWw6IHRydWUgfSk7XG4gIH1cblxuICAvLyBBZGQgZWRnZXMgZm9yIGVhY2ggYnJhbmNoIGdyb3VwXG4gIGZvciAoY29uc3QgWywgZ3JvdXBdIG9mIGJyYW5jaEdyb3Vwcykge1xuICAgIGNvbnN0IGFuY2hvcklkID0gZ3JvdXBbMF0/LmRhdGEuYW5jaG9ySWQ7XG4gICAgaWYgKCFhbmNob3JJZCkgY29udGludWU7XG5cbiAgICAvLyBMb2NhdGUgdGhlIGFuY2hvciBvbiB0aGUgbWFpbiByYWlsXG4gICAgY29uc3QgYW5jaG9ySXNDb250YWN0ID0gY29udGFjdHMuc29tZShjID0+IGMuaWQgPT09IGFuY2hvcklkKTtcbiAgICBpZiAoIWFuY2hvcklzQ29udGFjdCkgY29udGludWU7ICAvLyBhbmNob3IgbXVzdCBiZSBhIGNvbnRhY3Qgb24gbWFpbiByYWlsXG5cbiAgICBjb25zdCBsZWZ0SnVuY3Rpb24gID0ganVuY3Rpb25CZWZvcmVbYW5jaG9ySWRdO1xuICAgIGNvbnN0IHJpZ2h0SnVuY3Rpb24gPSBqdW5jdGlvbkFmdGVyW2FuY2hvcklkXTtcbiAgICBpZiAoIWxlZnRKdW5jdGlvbiB8fCAhcmlnaHRKdW5jdGlvbikgY29udGludWU7XG5cbiAgICBpZiAoZ3JvdXAubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBFbXB0eSBicmFuY2ggPSBwbGFpbiB3aXJlIChzaG9ydC1jaXJjdWl0IGJ5cGFzcyBvZiBhbmNob3IpXG4gICAgICBlZGdlcy5wdXNoKHsgZnJvbTogbGVmdEp1bmN0aW9uLCB0bzogcmlnaHRKdW5jdGlvbiB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQnVpbGQgc2VyaWVzIGNoYWluIGZvciBicmFuY2ggZWxlbWVudHMgYmV0d2VlbiB0aGUgdHdvIGFuY2hvciBqdW5jdGlvbnNcbiAgICAgIGxldCBwcmV2Tm9kZSA9IGxlZnRKdW5jdGlvbjtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ3JvdXAubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgYmVsID0gZ3JvdXBbaV07XG4gICAgICAgIGNvbnN0IG5leHROb2RlID0gaSA9PT0gZ3JvdXAubGVuZ3RoIC0gMVxuICAgICAgICAgID8gcmlnaHRKdW5jdGlvblxuICAgICAgICAgIDogYEJKXyR7Z3JvdXBbaV0uaWR9XyR7Z3JvdXBbaSArIDFdLmlkfWA7XG4gICAgICAgIGlmIChuZXh0Tm9kZSAhPT0gcmlnaHRKdW5jdGlvbikgbm9kZXMuYWRkKG5leHROb2RlKTtcbiAgICAgICAgZWRnZXMucHVzaCh7IGZyb206IHByZXZOb2RlLCB0bzogbmV4dE5vZGUsIGVsSWQ6IGJlbC5pZCB9KTtcbiAgICAgICAgcHJldk5vZGUgPSBuZXh0Tm9kZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBlZGdlcywgbm9kZXMgfTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFJ1bmcgZXZhbHVhdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gZXZhbHVhdGVSdW5nKGN0eDogRXZhbEN0eCwgcnVuZ0lkOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgZ3JhcGggPSBidWlsZFJ1bmdHcmFwaChjdHgsIHJ1bmdJZCk7XG4gIGlmIChncmFwaC5lZGdlcy5sZW5ndGggPT09IDApIHJldHVybjtcblxuICAvLyBTdGVwIDE6IEV2YWx1YXRlIGNvbmR1Y3Rpb24gc3RhdGUgb2YgZXZlcnkgZWRnZVxuICAvLyBBbiBlZGdlIGNvbmR1Y3RzIGlmOlxuICAvLyAgIC0gaXQgaGFzIG5vIGVsZW1lbnQgKHBsYWluIHdpcmUpIFx1MjE5MiBhbHdheXMgdHJ1ZVxuICAvLyAgIC0gaXQgaGFzIGEgY29udGFjdC9ibG9jayBcdTIxOTIgY29udGFjdENvbmR1Y3RzKC4uLilcbiAgLy8gICAtIGl0IGhhcyBhIGNvaWwgXHUyMTkyIGNvaWwgZWRnZXMgYXJlIE5FVkVSIHVzZWQgZm9yIHRyYXZlcnNhbCAoaXNDb2lsPXRydWUgZWRnZXMgYXJlIHNpbmtzKVxuICBjb25zdCBjb25kdWN0cyA9IG5ldyBNYXA8UnVuZ0VkZ2UsIGJvb2xlYW4+KCk7XG4gIGZvciAoY29uc3QgZWRnZSBvZiBncmFwaC5lZGdlcykge1xuICAgIGlmIChlZGdlLmlzQ29pbCkge1xuICAgICAgY29uZHVjdHMuc2V0KGVkZ2UsIGZhbHNlKTsgLy8gY29pbCBlZGdlcyBkb24ndCBwcm9wYWdhdGUgXHUyMDE0IGV2YWx1YXRlZCBzZXBhcmF0ZWx5XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKCFlZGdlLmVsSWQpIHtcbiAgICAgIGNvbmR1Y3RzLnNldChlZGdlLCB0cnVlKTsgLy8gcGxhaW4gd2lyZVxuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IGF0dHIgPSBjdHguY2xtLmdldE5vZGVBdHRyKGVkZ2UuZWxJZCk7XG4gICAgaWYgKCFhdHRyKSB7IGNvbmR1Y3RzLnNldChlZGdlLCBmYWxzZSk7IGNvbnRpbnVlOyB9XG4gICAgY29uc3QgZGF0YSA9IGF0dHIuZGF0YSBhcyBMREVsZW1lbnROb2RlRGF0YTtcbiAgICBpZiAoZGF0YS5lbGVtZW50S2luZCA9PT0gJ2ZiX2NhbGwnKSB7XG4gICAgICAvLyBGQiBjYWxsIGNvbmR1Y3Rpb24gaXMgY29tcHV0ZWQgZHVyaW5nIEJGUyAobmVlZHMgdG8ga25vdyBpZiBzb3VyY2Ugbm9kZSBpcyByZWFjaGFibGUpXG4gICAgICAvLyBEZWZlciBcdTIwMTQgbWFyayBhcyBuZWVkaW5nIGV2YWx1YXRpb25cbiAgICAgIGNvbmR1Y3RzLnNldChlZGdlLCBmYWxzZSk7IC8vIHBsYWNlaG9sZGVyOyB3aWxsIGJlIHJlLWV2YWx1YXRlZCBkdXJpbmcgQkZTXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbmR1Y3RzLnNldChlZGdlLCBjb250YWN0Q29uZHVjdHMoY3R4LCBlZGdlLmVsSWQsIGRhdGEpKTtcbiAgICB9XG4gIH1cblxuICAvLyBTdGVwIDI6IEJGUyByZWFjaGFiaWxpdHkgZnJvbSBTT1VSQ0UgdGhyb3VnaCBjb25kdWN0aW5nIG5vbi1jb2lsIGVkZ2VzXG4gIGNvbnN0IHJlYWNoYWJsZSA9IG5ldyBTZXQ8c3RyaW5nPihbU09VUkNFXSk7XG4gIGNvbnN0IHF1ZXVlOiBzdHJpbmdbXSA9IFtTT1VSQ0VdO1xuICAvLyBUcmFjayB3aGljaCBlZGdlcyB3ZSBuZWVkIHRvIHJlLWV2YWx1YXRlIGZvciBGQiBjYWxscyAobmVlZHMgcG93ZXItaW4gdG8gYmUga25vd24pXG4gIGNvbnN0IGZiRWRnZXMgPSBncmFwaC5lZGdlcy5maWx0ZXIoZSA9PiB7XG4gICAgaWYgKCFlLmVsSWQgfHwgZS5pc0NvaWwpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBhdHRyID0gY3R4LmNsbS5nZXROb2RlQXR0cihlLmVsSWQpO1xuICAgIHJldHVybiBhdHRyICYmIChhdHRyLmRhdGEgYXMgTERFbGVtZW50Tm9kZURhdGEpLmVsZW1lbnRLaW5kID09PSAnZmJfY2FsbCc7XG4gIH0pO1xuXG4gIC8vIFJlLWV2YWx1YXRlIEZCLWNhbGwgZWRnZXMgb25jZSBzb3VyY2Ugbm9kZSByZWFjaGFiaWxpdHkgaXMga25vd25cbiAgLy8gV2UgbmVlZCBhbiBpdGVyYXRpdmUgYXBwcm9hY2g6IEJGUywgdGhlbiBoYW5kbGUgRkIgZWRnZXMgdGhhdCBiZWNhbWUgcmVhY2hhYmxlXG4gIGxldCBjaGFuZ2VkID0gdHJ1ZTtcbiAgd2hpbGUgKGNoYW5nZWQpIHtcbiAgICBjaGFuZ2VkID0gZmFsc2U7XG4gICAgLy8gUHJvY2VzcyB0aGUgcXVldWVcbiAgICBsZXQgaGVhZCA9IDA7XG4gICAgd2hpbGUgKGhlYWQgPCBxdWV1ZS5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBxdWV1ZVtoZWFkKytdO1xuICAgICAgZm9yIChjb25zdCBlZGdlIG9mIGdyYXBoLmVkZ2VzKSB7XG4gICAgICAgIGlmIChlZGdlLmZyb20gIT09IG5vZGUgfHwgZWRnZS5pc0NvaWwpIGNvbnRpbnVlO1xuICAgICAgICAvLyBSZS1ldmFsdWF0ZSBGQiBlZGdlcyBub3cgdGhhdCB3ZSBrbm93IGBmcm9tYCBpcyByZWFjaGFibGVcbiAgICAgICAgaWYgKGVkZ2UuZWxJZCkge1xuICAgICAgICAgIGNvbnN0IGF0dHIgPSBjdHguY2xtLmdldE5vZGVBdHRyKGVkZ2UuZWxJZCk7XG4gICAgICAgICAgaWYgKGF0dHIgJiYgKGF0dHIuZGF0YSBhcyBMREVsZW1lbnROb2RlRGF0YSkuZWxlbWVudEtpbmQgPT09ICdmYl9jYWxsJykge1xuICAgICAgICAgICAgY29uc3QgZmJSZXN1bHQgPSBldmFsdWF0ZUZCQ2FsbChjdHgsIGVkZ2UuZWxJZCwgYXR0ci5kYXRhIGFzIExERWxlbWVudE5vZGVEYXRhLCB0cnVlKTtcbiAgICAgICAgICAgIGNvbmR1Y3RzLnNldChlZGdlLCBmYlJlc3VsdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChjb25kdWN0cy5nZXQoZWRnZSkgJiYgIXJlYWNoYWJsZS5oYXMoZWRnZS50bykpIHtcbiAgICAgICAgICByZWFjaGFibGUuYWRkKGVkZ2UudG8pO1xuICAgICAgICAgIHF1ZXVlLnB1c2goZWRnZS50byk7XG4gICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQ2hlY2sgRkIgZWRnZXMgZnJvbSBub24tcmVhY2hhYmxlIG5vZGVzICh0aGV5IGRvbid0IGNvbmR1Y3QgXHUyMDE0IGJ1dCBtYXJrIHRoZW0pXG4gICAgZm9yIChjb25zdCBlZGdlIG9mIGZiRWRnZXMpIHtcbiAgICAgIGlmICghcmVhY2hhYmxlLmhhcyhlZGdlLmZyb20pICYmIGNvbmR1Y3RzLmdldChlZGdlKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgLy8gU3RpbGwgZmFsc2UgXHUyMDE0IG5vIGNoYW5nZVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFN0ZXAgMzogV3JpdGUgZW5lcmdpemVkIGFuZCBwb3dlckFmdGVyIGZvciBhbGwgY29udGFjdC9ibG9jayBlbGVtZW50c1xuICAvLyBGb3IgZWFjaCBjb250YWN0IGVsZW1lbnQgb24gYSBub24tY29pbCBlZGdlOlxuICAvLyAgIGVuZXJnaXplZFtpZF0gPSB0aGUgZWxlbWVudCdzIG93biBjb25kdWN0aW9uIEFORCBpdHMgc291cmNlIG5vZGUgd2FzIHJlYWNoYWJsZVxuICAvLyAgIHBvd2VyQWZ0ZXJbaWRdID0gdGhlIHRhcmdldCBqdW5jdGlvbiBub2RlIGlzIHJlYWNoYWJsZSAoT1Igb2YgYWxsIHBhcmFsbGVsIHBhdGhzIHRocm91Z2ggaXQpXG4gIGZvciAoY29uc3QgZWRnZSBvZiBncmFwaC5lZGdlcykge1xuICAgIGlmICghZWRnZS5lbElkIHx8IGVkZ2UuaXNDb2lsKSBjb250aW51ZTtcbiAgICBjb25zdCBkYXRhID0gKGN0eC5jbG0uZ2V0Tm9kZUF0dHIoZWRnZS5lbElkKT8uZGF0YSkgYXMgTERFbGVtZW50Tm9kZURhdGEgfCB1bmRlZmluZWQ7XG4gICAgaWYgKCFkYXRhKSBjb250aW51ZTtcblxuICAgIGNvbnN0IHNvdXJjZVJlYWNoYWJsZSA9IHJlYWNoYWJsZS5oYXMoZWRnZS5mcm9tKTtcbiAgICBjb25zdCB0YXJnZXRSZWFjaGFibGUgPSByZWFjaGFibGUuaGFzKGVkZ2UudG8pO1xuICAgIGNvbnN0IGVkZ2VDb25kdWN0cyAgICA9ICEhY29uZHVjdHMuZ2V0KGVkZ2UpO1xuXG4gICAgLy8gZW5lcmdpemVkID0gdGhlIGVsZW1lbnQgaW5kaXZpZHVhbGx5IGNvbmR1Y3RlZCAoc291cmNlIHdhcyBsaXZlIEFORCBpdCBwYXNzZWQgcG93ZXIpXG4gICAgY3R4LmVuZXJnaXplZFtlZGdlLmVsSWRdICA9IHNvdXJjZVJlYWNoYWJsZSAmJiBlZGdlQ29uZHVjdHM7XG4gICAgLy8gcG93ZXJBZnRlciA9IHBvd2VyIGV4aXRzIHJpZ2h0IHNpZGUgKHRhcmdldCBqdW5jdGlvbiByZWFjaGFibGUsIHBvc3NpYmx5IHZpYSBwYXJhbGxlbCBicmFuY2gpXG4gICAgY3R4LnBvd2VyQWZ0ZXJbZWRnZS5lbElkXSA9IHRhcmdldFJlYWNoYWJsZTtcbiAgfVxuXG4gIC8vIFN0ZXAgNDogRmlyZSBjb2lsIHNpbmsgZWRnZXMgXHUyMDE0IGNvaWwgZmlyZXMgaWYgaXRzIHNvdXJjZSBub2RlIGlzIHJlYWNoYWJsZVxuICBmb3IgKGNvbnN0IGVkZ2Ugb2YgZ3JhcGguZWRnZXMpIHtcbiAgICBpZiAoIWVkZ2UuZWxJZCB8fCAhZWRnZS5pc0NvaWwpIGNvbnRpbnVlO1xuICAgIGNvbnN0IGRhdGEgPSAoY3R4LmNsbS5nZXROb2RlQXR0cihlZGdlLmVsSWQpPy5kYXRhKSBhcyBMREVsZW1lbnROb2RlRGF0YSB8IHVuZGVmaW5lZDtcbiAgICBpZiAoIWRhdGEpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHBvd2VySW4gPSByZWFjaGFibGUuaGFzKGVkZ2UuZnJvbSk7XG4gICAgZXZhbHVhdGVDb2lsRWxlbWVudChjdHgsIGVkZ2UuZWxJZCwgZGF0YSwgcG93ZXJJbik7XG4gIH1cblxufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgQ29udGFjdCBjb25kdWN0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBjb250YWN0Q29uZHVjdHMoXG4gIGN0eDogICBFdmFsQ3R4LFxuICBlbElkOiAgc3RyaW5nLFxuICBkYXRhOiAgTERFbGVtZW50Tm9kZURhdGEsXG4pOiBib29sZWFuIHtcbiAgY29uc3QgdGFnTmFtZSA9IGdldFJlYWRUYWcoY3R4LmNsbSwgZWxJZCk7XG4gIGlmICghdGFnTmFtZSkgcmV0dXJuIGZhbHNlO1xuXG4gIGNvbnN0IHZhbCAgICAgPSB0b0Jvb2woY3R4LmdldEVmZmVjdGl2ZSh0YWdOYW1lKSk7XG4gIGNvbnN0IHByZXZWYWwgPSB0b0Jvb2woY3R4LnByZXZUYWdWYWx1ZXNbdGFnTmFtZV0pO1xuXG4gIHN3aXRjaCAoZGF0YS5lbGVtZW50S2luZCkge1xuICAgIGNhc2UgJ2NvbnRhY3Rfbm8nOiByZXR1cm4gdmFsO1xuICAgIGNhc2UgJ2NvbnRhY3RfbmMnOiByZXR1cm4gIXZhbDtcbiAgICBjYXNlICdjb250YWN0X3AnOiAgcmV0dXJuIHZhbCAmJiAhcHJldlZhbDsgICAvLyByaXNpbmcgZWRnZSBcdTIwMTQgZXhhY3RseSBvbmUgc2NhblxuICAgIGNhc2UgJ2NvbnRhY3Rfbic6ICByZXR1cm4gIXZhbCAmJiBwcmV2VmFsOyAgIC8vIGZhbGxpbmcgZWRnZSBcdTIwMTQgZXhhY3RseSBvbmUgc2NhblxuICAgIGRlZmF1bHQ6ICAgICAgICAgICByZXR1cm4gdmFsO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBGQiBjYWxsIGV2YWx1YXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGV2YWx1YXRlRkJDYWxsKFxuICBjdHg6ICAgICBFdmFsQ3R4LFxuICBlbElkOiAgICBzdHJpbmcsXG4gIGRhdGE6ICAgIExERWxlbWVudE5vZGVEYXRhLFxuICBwb3dlckluOiBib29sZWFuLFxuKTogYm9vbGVhbiB7XG4gIGlmICghcG93ZXJJbiB8fCAhZGF0YS5mYlR5cGUpIHJldHVybiBmYWxzZTtcblxuICAvLyBJbmxpbmUgc3RhdGVsZXNzIG1hdGggLyBjb21wYXJlIC8gc2VsZWN0b3Igb3BlcmF0aW9uc1xuICBjb25zdCBpbmxpbmVPcHMgPSBuZXcgU2V0KFsnRVEnLCdORScsJ0dUJywnR0UnLCdMVCcsJ0xFJywnQUREJywnU1VCJywnTVVMJywnRElWJywnTU9EJywnQUJTJywnU1FSVCcsJ01PVkUnLCdTRUwnLCdMSU1JVCcsJ01JTicsJ01BWCddKTtcbiAgaWYgKGlubGluZU9wcy5oYXMoZGF0YS5mYlR5cGUpKSB7XG4gICAgLy8gQ29sbGVjdCBwaW4gXHUyMTkyIHRhZyBtYXBwaW5ncyBmcm9tIFJFQURTIGVkZ2VzXG4gICAgY29uc3QgcGluVG9UYWc6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgICBmb3IgKGNvbnN0IGVkZ2Ugb2YgY3R4LmNsbS5nZXRPdXRFZGdlc0J5VHlwZShlbElkLCAnUkVBRFMnKSkge1xuICAgICAgY29uc3QgdGFnRGF0YSA9IGN0eC5jbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KGVkZ2UudGFyZ2V0KTtcbiAgICAgIGNvbnN0IHBpbiA9IChlZGdlLmRhdGEgYXMgYW55KT8ucGluIHx8ICdJTic7XG4gICAgICBwaW5Ub1RhZ1twaW5dID0gdGFnRGF0YS5uYW1lO1xuICAgIH1cbiAgICBjb25zdCBnZXRWYWwgPSAocGluOiBzdHJpbmcpOiBhbnkgPT4gY3R4LmdldEVmZmVjdGl2ZShwaW5Ub1RhZ1twaW5dID8/ICcnKSA/PyAwO1xuICAgIGNvbnN0IHRvTnVtID0gKHY6IGFueSk6IG51bWJlciA9PiB7XG4gICAgICBpZiAodHlwZW9mIHYgPT09ICdudW1iZXInKSByZXR1cm4gdjtcbiAgICAgIGlmICh0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nKSByZXR1cm4gdiA/IDEgOiAwO1xuICAgICAgY29uc3QgbiA9IHBhcnNlRmxvYXQoU3RyaW5nKHYgPz8gJzAnKSk7XG4gICAgICByZXR1cm4gaXNOYU4obikgPyAwIDogbjtcbiAgICB9O1xuICAgIGNvbnN0IHRvQm9vbExvY2FsID0gKHY6IGFueSk6IGJvb2xlYW4gPT4ge1xuICAgICAgaWYgKHR5cGVvZiB2ID09PSAnYm9vbGVhbicpIHJldHVybiB2O1xuICAgICAgaWYgKHR5cGVvZiB2ID09PSAnbnVtYmVyJykgcmV0dXJuIHYgIT09IDA7XG4gICAgICByZXR1cm4gdiA9PT0gJ1RSVUUnIHx8IHYgPT09ICd0cnVlJyB8fCB2ID09PSAnMSc7XG4gICAgfTtcbiAgICBjb25zdCBhID0gdG9OdW0oZ2V0VmFsKCdJTjEnKSA/PyBnZXRWYWwoJ0lOJykpO1xuICAgIGNvbnN0IGIgPSB0b051bShnZXRWYWwoJ0lOMicpKTtcbiAgICBsZXQgcmVzdWx0OiBhbnk7XG4gICAgc3dpdGNoIChkYXRhLmZiVHlwZSkge1xuICAgICAgY2FzZSAnRVEnOiByZXN1bHQgPSBhID09PSBiOyBicmVhaztcbiAgICAgIGNhc2UgJ05FJzogcmVzdWx0ID0gYSAhPT0gYjsgYnJlYWs7XG4gICAgICBjYXNlICdHVCc6IHJlc3VsdCA9IGEgPiBiOyBicmVhaztcbiAgICAgIGNhc2UgJ0dFJzogcmVzdWx0ID0gYSA+PSBiOyBicmVhaztcbiAgICAgIGNhc2UgJ0xUJzogcmVzdWx0ID0gYSA8IGI7IGJyZWFrO1xuICAgICAgY2FzZSAnTEUnOiByZXN1bHQgPSBhIDw9IGI7IGJyZWFrO1xuICAgICAgY2FzZSAnQUREJzogcmVzdWx0ID0gYSArIGI7IGJyZWFrO1xuICAgICAgY2FzZSAnU1VCJzogcmVzdWx0ID0gYSAtIGI7IGJyZWFrO1xuICAgICAgY2FzZSAnTVVMJzogcmVzdWx0ID0gYSAqIGI7IGJyZWFrO1xuICAgICAgY2FzZSAnRElWJzogcmVzdWx0ID0gYiAhPT0gMCA/IGEgLyBiIDogMDsgYnJlYWs7XG4gICAgICBjYXNlICdNT0QnOiByZXN1bHQgPSBiICE9PSAwID8gYSAlIGIgOiAwOyBicmVhaztcbiAgICAgIGNhc2UgJ0FCUyc6IHJlc3VsdCA9IE1hdGguYWJzKGEpOyBicmVhaztcbiAgICAgIGNhc2UgJ1NRUlQnOiByZXN1bHQgPSBNYXRoLnNxcnQoTWF0aC5tYXgoMCwgYSkpOyBicmVhaztcbiAgICAgIGNhc2UgJ01PVkUnOiByZXN1bHQgPSBnZXRWYWwoJ0lOJyk7IGJyZWFrO1xuICAgICAgY2FzZSAnU0VMJzogcmVzdWx0ID0gdG9Cb29sTG9jYWwoZ2V0VmFsKCdHJykpID8gdG9OdW0oZ2V0VmFsKCdJTjEnKSkgOiB0b051bShnZXRWYWwoJ0lOMCcpKTsgYnJlYWs7XG4gICAgICBjYXNlICdMSU1JVCc6IHsgY29uc3QgbW4gPSB0b051bShnZXRWYWwoJ01OJykpOyBjb25zdCBteCA9IHRvTnVtKGdldFZhbCgnTVgnKSk7IHJlc3VsdCA9IE1hdGgubWF4KG1uLCBNYXRoLm1pbihteCwgYSkpOyBicmVhazsgfVxuICAgICAgY2FzZSAnTUlOJzogcmVzdWx0ID0gTWF0aC5taW4oYSwgYik7IGJyZWFrO1xuICAgICAgY2FzZSAnTUFYJzogcmVzdWx0ID0gTWF0aC5tYXgoYSwgYik7IGJyZWFrO1xuICAgICAgZGVmYXVsdDogcmVzdWx0ID0gZmFsc2U7XG4gICAgfVxuICAgIC8vIFdyaXRlIHJlc3VsdCB0byBvdXRwdXQgdGFnIHZpYSBXUklURVMgZWRnZXNcbiAgICBmb3IgKGNvbnN0IGVkZ2Ugb2YgY3R4LmNsbS5nZXRPdXRFZGdlc0J5VHlwZShlbElkLCAnV1JJVEVTJykpIHtcbiAgICAgIGNvbnN0IHRhZ0RhdGEgPSBjdHguY2xtLmdldE5vZGVEYXRhPFRhZ05vZGVEYXRhPihlZGdlLnRhcmdldCk7XG4gICAgICBjdHgudGFnVXBkYXRlc1t0YWdEYXRhLm5hbWVdID0gcmVzdWx0O1xuICAgIH1cbiAgICBjdHguYmxvY2tQaW5WYWx1ZXNbYCR7ZWxJZH06T1VUYF0gPSBTdHJpbmcocmVzdWx0KTtcbiAgICBjdHguZW5lcmdpemVkW2VsSWRdID0gdHJ1ZTtcbiAgICBjdHgucG93ZXJBZnRlcltlbElkXSA9IHR5cGVvZiByZXN1bHQgPT09ICdib29sZWFuJyA/IHJlc3VsdCA6IHRydWU7XG4gICAgcmV0dXJuIHR5cGVvZiByZXN1bHQgPT09ICdib29sZWFuJyA/IHJlc3VsdCA6IHRydWU7XG4gIH1cblxuICBjb25zdCBpbnN0YW5jZUtleSA9IGRhdGEuaW5zdGFuY2VOYW1lIHx8IGVsSWQ7XG4gIGNvbnN0IGlucHV0czogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuXG4gIGNvbnN0IHJlYWRFZGdlcyA9IGN0eC5jbG0uZ2V0T3V0RWRnZXNCeVR5cGUoZWxJZCwgJ1JFQURTJyk7XG4gIGZvciAoY29uc3QgZWRnZSBvZiByZWFkRWRnZXMpIHtcbiAgICBjb25zdCB0YWdEYXRhID0gY3R4LmNsbS5nZXROb2RlRGF0YTxUYWdOb2RlRGF0YT4oZWRnZS50YXJnZXQpO1xuICAgIGNvbnN0IHBpbiA9IChlZGdlLmRhdGEgYXMgYW55KT8ucGluIHx8ICdJTic7XG4gICAgaW5wdXRzW3Bpbl0gPSBjdHguZ2V0RWZmZWN0aXZlKHRhZ0RhdGEubmFtZSkgPz8gZmFsc2U7XG4gIH1cbiAgaWYgKHJlYWRFZGdlcy5sZW5ndGggPT09IDEgJiYgaW5wdXRzWydJTiddID09PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCB0YWdEYXRhID0gY3R4LmNsbS5nZXROb2RlRGF0YTxUYWdOb2RlRGF0YT4ocmVhZEVkZ2VzWzBdLnRhcmdldCk7XG4gICAgaW5wdXRzWydJTiddID0gY3R4LmdldEVmZmVjdGl2ZSh0YWdEYXRhLm5hbWUpID8/IGZhbHNlO1xuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gZXhlY3V0ZUZCKGRhdGEuZmJUeXBlLCBpbnB1dHMsIGN0eC5mYlN0YXRlcy5nZXQoaW5zdGFuY2VLZXkpLCB7IGR0OiBjdHguZHQgfSk7XG4gIGN0eC5mYlN0YXRlcy5zZXQoaW5zdGFuY2VLZXksIHJlc3VsdC5zdGF0ZSk7XG5cbiAgZm9yIChjb25zdCBlZGdlIG9mIGN0eC5jbG0uZ2V0T3V0RWRnZXNCeVR5cGUoZWxJZCwgJ1dSSVRFUycpKSB7XG4gICAgY29uc3QgdGFnRGF0YSA9IGN0eC5jbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KGVkZ2UudGFyZ2V0KTtcbiAgICBjb25zdCBwaW4gPSAoZWRnZS5kYXRhIGFzIGFueSk/LnBpbiB8fCAnUSc7XG4gICAgaWYgKHJlc3VsdC5vdXRwdXRzW3Bpbl0gIT09IHVuZGVmaW5lZCkgY3R4LnRhZ1VwZGF0ZXNbdGFnRGF0YS5uYW1lXSA9IHJlc3VsdC5vdXRwdXRzW3Bpbl07XG4gIH1cbiAgZm9yIChjb25zdCBbcGluLCB2YWxdIG9mIE9iamVjdC5lbnRyaWVzKHJlc3VsdC5vdXRwdXRzKSkge1xuICAgIGN0eC5ibG9ja1BpblZhbHVlc1tgJHtlbElkfToke3Bpbn1gXSA9IFN0cmluZyh2YWwpO1xuICB9XG5cbiAgcmV0dXJuIHRvQm9vbChyZXN1bHQub3V0cHV0cy5RID8/IHJlc3VsdC5vdXRwdXRzLlExID8/IGZhbHNlKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIENvaWwgZXZhbHVhdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gZXZhbHVhdGVDb2lsRWxlbWVudChcbiAgY3R4OiAgICAgRXZhbEN0eCxcbiAgZWxJZDogICAgc3RyaW5nLFxuICBkYXRhOiAgICBMREVsZW1lbnROb2RlRGF0YSxcbiAgcG93ZXJJbjogYm9vbGVhbixcbik6IHZvaWQge1xuICAvLyBSZWNvcmQgZm9yIFAvTiBlZGdlIGRldGVjdGlvbiBvbiBuZXh0IHNjYW5cbiAgY3R4LmNvaWxQb3dlclRoaXNTY2FuW2VsSWRdID0gcG93ZXJJbjtcbiAgLy8gR2x5cGggPSBjb2lsIHJlY2VpdmluZyBwb3dlclxuICBjdHguZW5lcmdpemVkW2VsSWRdID0gcG93ZXJJbjtcbiAgLy8gQ29pbCBpcyB0ZXJtaW5hbCBcdTIwMTQgbm8gcG93ZXIgZXhpdHNcbiAgY3R4LnBvd2VyQWZ0ZXJbZWxJZF0gPSBmYWxzZTtcblxuICBjb25zdCB0YWdOYW1lID0gZ2V0V3JpdGVUYWcoY3R4LmNsbSwgZWxJZCk7XG4gIGlmICghdGFnTmFtZSkgcmV0dXJuO1xuXG4gIGNvbnN0IHByZXZQb3dlciA9IHRvQm9vbChjdHgucHJldkNvaWxQb3dlcltlbElkXSk7XG5cbiAgc3dpdGNoIChkYXRhLmVsZW1lbnRLaW5kKSB7XG4gICAgY2FzZSAnY29pbCc6XG4gICAgICAvLyBOb24tcmV0ZW50aXZlOiByZWNvbXB1dGVkIGV2ZXJ5IHNjYW5cbiAgICAgIGN0eC50YWdVcGRhdGVzW3RhZ05hbWVdID0gcG93ZXJJbjtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnY29pbF9uZWdhdGVkJzpcbiAgICAgIC8vIFdyaXRlcyBpbnZlcnNlIG9mIHBvd2VyIFx1MjAxNCB0cnVlIHdoZW4gTk9UIGVuZXJnaXplZFxuICAgICAgY3R4LnRhZ1VwZGF0ZXNbdGFnTmFtZV0gPSAhcG93ZXJJbjtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnY29pbF9zZXQnOlxuICAgIGNhc2UgJ2NvaWxfbGF0Y2gnOlxuICAgICAgLy8gUmV0ZW50aXZlIFNFVDogb25seSBhY3RzIHdoZW4gZW5lcmdpemVkOyBuZXZlciBjbGVhcnNcbiAgICAgIGlmIChwb3dlckluKSBjdHgudGFnVXBkYXRlc1t0YWdOYW1lXSA9IHRydWU7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2NvaWxfcmVzZXQnOlxuICAgIGNhc2UgJ2NvaWxfdW5sYXRjaCc6XG4gICAgICAvLyBSZXRlbnRpdmUgUkVTRVQ6IG9ubHkgYWN0cyB3aGVuIGVuZXJnaXplZDsgbmV2ZXIgc2V0c1xuICAgICAgaWYgKHBvd2VySW4pIGN0eC50YWdVcGRhdGVzW3RhZ05hbWVdID0gZmFsc2U7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2NvaWxfcCc6XG4gICAgICAvLyBQb3NpdGl2ZSBzZW5zaW5nOiAxLXNjYW4gcHVsc2Ugb24gcG93ZXIgRkFMU0VcdTIxOTJUUlVFIHRyYW5zaXRpb25cbiAgICAgIGN0eC50YWdVcGRhdGVzW3RhZ05hbWVdID0gcG93ZXJJbiAmJiAhcHJldlBvd2VyO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdjb2lsX24nOlxuICAgICAgLy8gTmVnYXRpdmUgc2Vuc2luZzogMS1zY2FuIHB1bHNlIG9uIHBvd2VyIFRSVUVcdTIxOTJGQUxTRSB0cmFuc2l0aW9uXG4gICAgICBjdHgudGFnVXBkYXRlc1t0YWdOYW1lXSA9ICFwb3dlckluICYmIHByZXZQb3dlcjtcbiAgICAgIGJyZWFrO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUYWcgbmFtZSBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBnZXRSZWFkVGFnKGNsbTogQ0xNR3JhcGgsIGVsZW1lbnRJZDogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgZWRnZXMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoZWxlbWVudElkLCAnUkVBRFMnKTtcbiAgaWYgKGVkZ2VzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgcmV0dXJuIGNsbS5nZXROb2RlRGF0YTxUYWdOb2RlRGF0YT4oZWRnZXNbMF0udGFyZ2V0KT8ubmFtZTtcbn1cblxuZnVuY3Rpb24gZ2V0V3JpdGVUYWcoY2xtOiBDTE1HcmFwaCwgZWxlbWVudElkOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBjb25zdCBlZGdlcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShlbGVtZW50SWQsICdXUklURVMnKTtcbiAgaWYgKGVkZ2VzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgcmV0dXJuIGNsbS5nZXROb2RlRGF0YTxUYWdOb2RlRGF0YT4oZWRnZXNbMF0udGFyZ2V0KT8ubmFtZTtcbn1cblxuZnVuY3Rpb24gdG9Cb29sKHY6IGFueSk6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIHYgPT09ICdib29sZWFuJykgcmV0dXJuIHY7XG4gIGlmICh0eXBlb2YgdiA9PT0gJ251bWJlcicpIHJldHVybiB2ICE9PSAwO1xuICBpZiAodHlwZW9mIHYgPT09ICdzdHJpbmcnKSByZXR1cm4gdiA9PT0gJ1RSVUUnIHx8IHYgPT09ICd0cnVlJyB8fCB2ID09PSAnMSc7XG4gIC8vIEdyYWNlZnVsIGZhbGxiYWNrIGZvciBhcnJheSB0eXBlczogdXNlIGluZGV4IDBcbiAgaWYgKEFycmF5LmlzQXJyYXkodikpIHJldHVybiB0b0Jvb2wodlswXSk7XG4gIHJldHVybiAhIXY7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUF5QkEsU0FBUyxpQkFBaUI7QUFrQm5CLFNBQVMsZUFDZCxLQUNBLFdBQ0EsVUFDQSxJQUNBLGdCQUE4QixDQUFDLEdBQy9CLGdCQUE2QyxDQUFDLEdBQzlDLGNBQ2M7QUFDZCxRQUFNLGFBQThDLENBQUM7QUFDckQsUUFBTSxZQUE4QyxDQUFDO0FBQ3JELFFBQU0sYUFBOEMsQ0FBQztBQUNyRCxRQUFNLGlCQUE4QyxDQUFDO0FBQ3JELFFBQU0sb0JBQThDLENBQUM7QUFDckQsUUFBTSxjQUFvQixJQUFJLElBQUksUUFBUTtBQUMxQyxRQUFNLG1CQUE4QyxFQUFFLEdBQUcsVUFBVTtBQUduRSxRQUFNLGVBQWUsQ0FBQyxZQUNwQixnQkFBZ0IsV0FBVyxlQUN2QixhQUFhLE9BQU8sSUFDbkIsV0FBVyxPQUFPLEtBQUssVUFBVSxPQUFPO0FBRS9DLFFBQU0sTUFBZTtBQUFBLElBQ25CO0FBQUEsSUFBSztBQUFBLElBQVc7QUFBQSxJQUFZO0FBQUEsSUFBVztBQUFBLElBQ3ZDO0FBQUEsSUFBZ0I7QUFB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
