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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC9zaW11bGF0aW9uL2V2YWx1YXRvci1sZC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBJRUMgNjExMzEtMyBMYWRkZXIgRGlhZ3JhbSBldmFsdWF0b3IgXHUyMDE0IGdyYXBoLXJlYWNoYWJpbGl0eSBtb2RlbC5cbiAqXG4gKiBFYWNoIHJ1bmcgaXMgbW9kZWxlZCBhcyBhIGRpcmVjdGVkIEJvb2xlYW4gZ3JhcGg6XG4gKiAgIC0gTm9kZXM6IGp1bmN0aW9uIHBvaW50cyAobGVmdCByYWlsIHNvdXJjZSwgcmlnaHQgcmFpbCBzaW5rLCBpbnRlci1lbGVtZW50IGp1bmN0aW9ucykuXG4gKiAgIC0gRWRnZXM6IHdpcmUgc2VnbWVudHMuIEVhY2ggZWRnZSBjYXJyaWVzIHplcm8gb3Igb25lIGVsZW1lbnQgKGNvbnRhY3QvYmxvY2spLlxuICogICAgIEFuIGVkZ2Ugd2l0aCBubyBlbGVtZW50IGlzIGEgcGxhaW4gd2lyZSBcdTIwMTQgYWx3YXlzIGNvbmR1Y3RzLlxuICogICAgIEFuIGVkZ2Ugd2l0aCBhIGNvbnRhY3QgY29uZHVjdHMgcGVyIFNlY3Rpb24gMi4xIHJ1bGVzIChOTy9OQy9QL04pLlxuICogICAgIEFuIGVkZ2Ugd2l0aCBhIGNvaWwgaXMgYSBzaW5rIGVkZ2UgXHUyMDE0IHJlY29yZHMgcG93ZXIgYXJyaXZhbCwgd3JpdGVzIHRhZywgbmV2ZXIgcHJvcGFnYXRlcy5cbiAqICAgLSBQYXJhbGxlbCBicmFuY2hlcyBhZGQgZXh0cmEgZWRnZXMgYmV0d2VlbiB0aGUganVuY3Rpb24gbm9kZXMgdGhhdCBmbGFuayB0aGVpciBhbmNob3IgZWxlbWVudC5cbiAqXG4gKiBQb3dlciBmbG93ID0gQkZTIHJlYWNoYWJpbGl0eSBmcm9tIHRoZSBsZWZ0LXJhaWwgc291cmNlIG5vZGUsIGZvbGxvd2luZyBvbmx5IGNvbmR1Y3RpbmcgZWRnZXMuXG4gKiBBIG5vZGUgaXMgZW5lcmdpemVkIGlmIGl0IGlzIHJlYWNoYWJsZS4gQSBjb2lsIGZpcmVzIGlmIGl0cyBzaW5rIGVkZ2UncyBzb3VyY2Ugbm9kZSBpcyBlbmVyZ2l6ZWQuXG4gKlxuICogVGhpcyBtb2RlbCBpcyBwcm92YWJseSBnZW5lcmFsOiBhbnkgc2VyaWVzL3BhcmFsbGVsL25lc3RlZC1icmFuY2ggY29tYmluYXRpb24gbWFwcyB0byBhIGdyYXBoLFxuICogYW5kIEJGUyByZWFjaGFiaWxpdHkgaXMgY29ycmVjdCBmb3IgYWxsIGdyYXBocyBieSBkZWZpbml0aW9uLlxuICpcbiAqIHBvd2VyQWZ0ZXJbZWxlbWVudElkXTogcG93ZXIgZXhpdGluZyByaWdodCBzaWRlIG9mIGVsZW1lbnQgXHUyMDE0IHVzZWQgYnkgd2lyZSByZW5kZXJlci5cbiAqIGVuZXJnaXplZFtlbGVtZW50SWRdOiAgZWxlbWVudCBnbHlwaCBjb2xvciBcdTIwMTQgdGhlIGVsZW1lbnQgaW5kaXZpZHVhbGx5IGNvbmR1Y3RlZC5cbiAqIFRoZXNlIGRpZmZlciBhdCBicmFuY2ggYW5jaG9yczogYnlwYXNzIGJyYW5jaCBjYW4gbWFrZSBwb3dlckFmdGVyPXRydWUgd2hpbGUgYW5jaG9yIGVuZXJnaXplZD1mYWxzZS5cbiAqL1xuXG5pbXBvcnQgeyBDTE1HcmFwaCB9IGZyb20gJy4uL2NsbS9ncmFwaC5qcyc7XG5pbXBvcnQgdHlwZSB7IExERWxlbWVudE5vZGVEYXRhLCBUYWdOb2RlRGF0YSB9IGZyb20gJy4uL2NsbS9zY2hlbWEuanMnO1xuaW1wb3J0IHsgVGFnU3RhdGUsIEZCSW5zdGFuY2VTdGF0ZSwgRkJDb250ZXh0IH0gZnJvbSAnLi90eXBlcy5qcyc7XG5pbXBvcnQgeyBleGVjdXRlRkIgfSBmcm9tICcuL2Z1bmN0aW9uLWJsb2Nrcy5qcyc7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBQdWJsaWMgcmVzdWx0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIExERXZhbFJlc3VsdCB7XG4gIHRhZ1VwZGF0ZXM6IFRhZ1N0YXRlO1xuICBlbmVyZ2l6ZWQ6ICBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPjtcbiAgLyoqIFBvd2VyIGV4aXRpbmcgcmlnaHQgc2lkZSBvZiBlYWNoIGVsZW1lbnQgXHUyMDE0IGZvciB3aXJlIHJlbmRlcmVyLiAqL1xuICBwb3dlckFmdGVyOiAgICBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPjtcbiAgYmxvY2tQaW5WYWx1ZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIGZiU3RhdGVzOiAgICAgIE1hcDxzdHJpbmcsIEZCSW5zdGFuY2VTdGF0ZT47XG4gIC8qKiBDb2lsIHBvd2VyIHRoaXMgc2NhbiBcdTIwMTQgZm9yIFAvTiBjb2lsIGVkZ2UgZGV0ZWN0aW9uIG5leHQgc2Nhbi4gKi9cbiAgY29pbFBvd2VyVGhpc1NjYW46IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xuICBwcmV2VGFnVmFsdWVzOiBUYWdTdGF0ZTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEVudHJ5IHBvaW50IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgZnVuY3Rpb24gZXZhbHVhdGVMYWRkZXIoXG4gIGNsbTogICAgICAgICAgIENMTUdyYXBoLFxuICB0YWdWYWx1ZXM6ICAgICBUYWdTdGF0ZSxcbiAgZmJTdGF0ZXM6ICAgICAgTWFwPHN0cmluZywgRkJJbnN0YW5jZVN0YXRlPixcbiAgZHQ6ICAgICAgICAgICAgbnVtYmVyLFxuICBwcmV2VGFnVmFsdWVzOiAgICAgVGFnU3RhdGUgPSB7fSxcbiAgcHJldkNvaWxQb3dlcjogICAgIFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+ID0ge30sXG4gIGZvcmNlZFZhbHVlcz86ICAgICBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuKTogTERFdmFsUmVzdWx0IHtcbiAgY29uc3QgdGFnVXBkYXRlczogICAgICAgVGFnU3RhdGUgICAgICAgICAgICAgICAgICA9IHt9O1xuICBjb25zdCBlbmVyZ2l6ZWQ6ICAgICAgICBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiAgID0ge307XG4gIGNvbnN0IHBvd2VyQWZ0ZXI6ICAgICAgIFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+ICAgPSB7fTtcbiAgY29uc3QgYmxvY2tQaW5WYWx1ZXM6ICAgUmVjb3JkPHN0cmluZywgc3RyaW5nPiAgICA9IHt9O1xuICBjb25zdCBjb2lsUG93ZXJUaGlzU2NhbjogUmVjb3JkPHN0cmluZywgYm9vbGVhbj4gID0ge307XG4gIGNvbnN0IG5ld0ZiU3RhdGVzICAgICAgID0gbmV3IE1hcChmYlN0YXRlcyk7XG4gIGNvbnN0IG5ld1ByZXZUYWdWYWx1ZXM6IFRhZ1N0YXRlICAgICAgICAgICAgICAgICAgPSB7IC4uLnRhZ1ZhbHVlcyB9O1xuXG4gIC8vIFNpbmdsZSBmb3JjZS1pbmplY3Rpb24gcG9pbnQgXHUyMDE0IG9ubHkgcGxhY2UgZm9yY2luZyBsb2dpYyBsaXZlcy5cbiAgY29uc3QgZ2V0RWZmZWN0aXZlID0gKHRhZ05hbWU6IHN0cmluZyk6IGFueSA9PlxuICAgIGZvcmNlZFZhbHVlcyAmJiB0YWdOYW1lIGluIGZvcmNlZFZhbHVlc1xuICAgICAgPyBmb3JjZWRWYWx1ZXNbdGFnTmFtZV1cbiAgICAgIDogKHRhZ1VwZGF0ZXNbdGFnTmFtZV0gPz8gdGFnVmFsdWVzW3RhZ05hbWVdKTtcblxuICBjb25zdCBjdHg6IEV2YWxDdHggPSB7XG4gICAgY2xtLCB0YWdWYWx1ZXMsIHRhZ1VwZGF0ZXMsIGVuZXJnaXplZCwgcG93ZXJBZnRlcixcbiAgICBibG9ja1BpblZhbHVlcywgY29pbFBvd2VyVGhpc1NjYW4sIGZiU3RhdGVzOiBuZXdGYlN0YXRlcywgZHQsXG4gICAgcHJldlRhZ1ZhbHVlcywgcHJldkNvaWxQb3dlciwgZ2V0RWZmZWN0aXZlLFxuICB9O1xuXG4gIGZvciAoY29uc3QgcnVuZ0lkIG9mIGdldE9yZGVyZWRSdW5ncyhjbG0pKSB7XG4gICAgZXZhbHVhdGVSdW5nKGN0eCwgcnVuZ0lkKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgdGFnVXBkYXRlcywgZW5lcmdpemVkLCBwb3dlckFmdGVyLCBibG9ja1BpblZhbHVlcyxcbiAgICBmYlN0YXRlczogbmV3RmJTdGF0ZXMsIGNvaWxQb3dlclRoaXNTY2FuLFxuICAgIHByZXZUYWdWYWx1ZXM6IG5ld1ByZXZUYWdWYWx1ZXMsXG4gIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBJbnRlcm5hbCBjb250ZXh0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5pbnRlcmZhY2UgRXZhbEN0eCB7XG4gIGNsbTogICAgICAgICAgICAgICBDTE1HcmFwaDtcbiAgdGFnVmFsdWVzOiAgICAgICAgIFRhZ1N0YXRlO1xuICB0YWdVcGRhdGVzOiAgICAgICAgVGFnU3RhdGU7XG4gIGVuZXJnaXplZDogICAgICAgICBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPjtcbiAgcG93ZXJBZnRlcjogICAgICAgIFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xuICBibG9ja1BpblZhbHVlczogICAgUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgY29pbFBvd2VyVGhpc1NjYW46IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xuICBmYlN0YXRlczogICAgICAgICAgTWFwPHN0cmluZywgRkJJbnN0YW5jZVN0YXRlPjtcbiAgZHQ6ICAgICAgICAgICAgICAgIG51bWJlcjtcbiAgcHJldlRhZ1ZhbHVlczogICAgIFRhZ1N0YXRlO1xuICBwcmV2Q29pbFBvd2VyOiAgICAgUmVjb3JkPHN0cmluZywgYm9vbGVhbj47XG4gIGdldEVmZmVjdGl2ZTogICAgICAodGFnTmFtZTogc3RyaW5nKSA9PiBhbnk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBSdW5nIG9yZGVyaW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBnZXRPcmRlcmVkUnVuZ3MoY2xtOiBDTE1HcmFwaCk6IHN0cmluZ1tdIHtcbiAgY29uc3QgYWxsUnVuZ3MgPSBjbG0uZ2V0Tm9kZXNCeVR5cGUoJ1JVTkcnKTtcbiAgaWYgKGFsbFJ1bmdzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuICBjb25zdCBuZXh0UnVuZyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgaWQgb2YgYWxsUnVuZ3MpIHtcbiAgICBmb3IgKGNvbnN0IGUgb2YgY2xtLmdldE91dEVkZ2VzQnlUeXBlKGlkLCAnUlVOR19PUkRFUicpKSBuZXh0UnVuZy5zZXQoaWQsIGUudGFyZ2V0KTtcbiAgfVxuICBjb25zdCBoYXNJbmNvbWluZyA9IG5ldyBTZXQobmV4dFJ1bmcudmFsdWVzKCkpO1xuICBsZXQgY3VyOiBzdHJpbmcgfCB1bmRlZmluZWQgPSBhbGxSdW5ncy5maW5kKHIgPT4gIWhhc0luY29taW5nLmhhcyhyKSkgPz8gYWxsUnVuZ3NbMF07XG4gIGNvbnN0IG9yZGVyZWQ6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHZpc2l0ZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgd2hpbGUgKGN1ciAmJiAhdmlzaXRlZC5oYXMoY3VyKSkgeyB2aXNpdGVkLmFkZChjdXIpOyBvcmRlcmVkLnB1c2goY3VyKTsgY3VyID0gbmV4dFJ1bmcuZ2V0KGN1cik7IH1cbiAgZm9yIChjb25zdCByIG9mIGFsbFJ1bmdzKSBpZiAoIXZpc2l0ZWQuaGFzKHIpKSBvcmRlcmVkLnB1c2gocik7XG4gIHJldHVybiBvcmRlcmVkO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUnVuZyBncmFwaCByZXByZXNlbnRhdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBXZSBidWlsZCBhIGxpZ2h0d2VpZ2h0IGRpcmVjdGVkIGdyYXBoIHdpdGg6XG4vLyAgIC0gU3RyaW5nIG5vZGUgSURzIChzeW50aGV0aWM6ICdTT1VSQ0UnLCAnU0lOSycsIG9yIGp1bmN0aW9uIElEcyBsaWtlICdKX2JlZm9yZV88ZWxJZD4nKVxuLy8gICAtIERpcmVjdGVkIGVkZ2VzIGNhcnJ5aW5nIGFuIG9wdGlvbmFsIGVsZW1lbnQgcmVmZXJlbmNlICsgY29uZHVjdGlvbiBzdGF0ZVxuLy9cbi8vIEdyYXBoIHNoYXBlIGZvciBhIHJ1bmcgd2l0aCBtYWluIGVsZW1lbnRzIFtBLCBCLCBDXSBhbmQgb25lIGJyYW5jaCBwYXJhbGxlbCB0byBCOlxuLy9cbi8vICAgU09VUkNFIC0tQS0tPiBKX0EgIC0tQi0tPiBKX0IgIC0tQy0tPiBTSU5LXG4vLyAgICAgICAgICAgICAgICAgfCAgICAgICAgICAgICAgICAgIF5cbi8vICAgICAgICAgICAgICAgICArLS0tLWJyYW5jaEVsLS0tLS0tfFxuLy9cbi8vIFRoZSBicmFuY2ggYWRkcyBhbiBleHRyYSBlZGdlIGZyb20gSl9BIChqdW5jdGlvbiBiZWZvcmUgQikgdG8gSl9CIChqdW5jdGlvbiBhZnRlciBCKS5cbi8vIEJGUyBmcm9tIFNPVVJDRSBmb2xsb3dpbmcgY29uZHVjdGluZyBlZGdlcyBkZXRlcm1pbmVzIHdoaWNoIG5vZGVzIGFyZSByZWFjaGFibGUuXG5cbmludGVyZmFjZSBSdW5nRWRnZSB7XG4gIGZyb206ICAgIHN0cmluZztcbiAgdG86ICAgICAgc3RyaW5nO1xuICBlbElkPzogICBzdHJpbmc7ICAvLyBlbGVtZW50IElEIGlmIHRoaXMgZWRnZSBjYXJyaWVzIGEgY29udGFjdC9ibG9jazsgdW5kZWZpbmVkID0gcGxhaW4gd2lyZVxuICBpc0NvaWw/OiBib29sZWFuOyAvLyBjb2lsIGVkZ2VzIGFyZSBzaW5rcyBcdTIwMTQgdGhleSBmaXJlIHdoZW4gYGZyb21gIGlzIHJlYWNoYWJsZSBidXQgbmV2ZXIgcHJvcGFnYXRlXG59XG5cbmludGVyZmFjZSBSdW5nR3JhcGgge1xuICBlZGdlczogUnVuZ0VkZ2VbXTtcbiAgLy8gQWxsIG5vZGUgSURzIHByZXNlbnQgKHVuaW9uIG9mIGFsbCBmcm9tL3RvKVxuICBub2RlczogU2V0PHN0cmluZz47XG59XG5cbmNvbnN0IFNPVVJDRSA9ICdTT1VSQ0UnO1xuY29uc3QgU0lOSyAgID0gJ1NJTksnO1xuXG4vKipcbiAqIEJ1aWxkIHRoZSBqdW5jdGlvbi1ub2RlIGdyYXBoIGZvciBhIHJ1bmcuXG4gKlxuICogTWFpbi1yYWlsIGVsZW1lbnRzIGZvcm0gYSBzZXJpZXMgY2hhaW46IFNPVVJDRSBcdTIxOTIgSjAgXHUyMTkyIEoxIFx1MjE5MiBcdTIwMjYgXHUyMTkyIEpuIFx1MjE5MiBTSU5LXG4gKiB3aGVyZSBlYWNoIEppIGlzIHRoZSBqdW5jdGlvbiBiZXR3ZWVuIGVsZW1lbnQgaSBhbmQgZWxlbWVudCBpKzEuXG4gKiBKdW5jdGlvbiBiZWZvcmUgZmlyc3QgbWFpbiBlbGVtZW50ID0gU09VUkNFOyBqdW5jdGlvbiBhZnRlciBsYXN0ID0gU0lOSy5cbiAqXG4gKiBGb3IgZWFjaCBicmFuY2ggKGlkZW50aWZpZWQgYnkgYW5jaG9ySWQgb24gdGhlIGJyYW5jaCdzIGZpcnN0IGVsZW1lbnQpOlxuICogICAtIExvY2F0ZSB0aGUgYW5jaG9yIGVsZW1lbnQgb24gdGhlIG1haW4gcmFpbC4gSXRzIGxlZnQganVuY3Rpb24gPSBqdW5jdGlvbkJlZm9yZVthbmNob3JdLFxuICogICAgIGl0cyByaWdodCBqdW5jdGlvbiA9IGp1bmN0aW9uQWZ0ZXJbYW5jaG9yXS5cbiAqICAgLSBBZGQgYSBzZXJpZXMgb2YgZWRnZXMgZm9yIHRoZSBicmFuY2ggZWxlbWVudHMgYmV0d2VlbiB0aG9zZSB0d28ganVuY3Rpb25zLlxuICogICAtIFRoaXMgbmF0dXJhbGx5IGNyZWF0ZXMgcGFyYWxsZWwgcGF0aHMsIGNvcnJlY3RseSBPUi1pbmcgdGhlIGFuY2hvciB3aXRoIHRoZSBicmFuY2guXG4gKlxuICogQ29pbCBlbGVtZW50czogcGxhY2VkIGF0IHRoZSByaWdodCBlbmQgb2YgdGhlIG1haW4gcmFpbCAob3IgYXMgYSBwYXJhbGxlbCBicmFuY2ggb2YgdGhlIHJpZ2h0bW9zdFxuICogbm9uLWNvaWwpLiBFYWNoIGNvaWwgZ2V0cyBhIGRlZGljYXRlZCBzaW5rIGVkZ2UgZnJvbSB0aGUganVuY3Rpb24gYmVmb3JlIGl0IHRvIFNJTkssIHRhZ2dlZCBpc0NvaWwuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkUnVuZ0dyYXBoKFxuICBjdHg6ICAgIEV2YWxDdHgsXG4gIHJ1bmdJZDogc3RyaW5nLFxuKTogUnVuZ0dyYXBoIHtcbiAgY29uc3QgY2hpbGRyZW4gPSBjdHguY2xtLmdldENoaWxkcmVuKHJ1bmdJZCk7XG4gIGNvbnN0IGFsbEVsczogQXJyYXk8eyBpZDogc3RyaW5nOyBkYXRhOiBMREVsZW1lbnROb2RlRGF0YSB9PiA9IFtdO1xuICBmb3IgKGNvbnN0IGNJZCBvZiBjaGlsZHJlbikge1xuICAgIGNvbnN0IGF0dHIgPSBjdHguY2xtLmdldE5vZGVBdHRyKGNJZCk7XG4gICAgaWYgKGF0dHI/LnR5cGUgPT09ICdMRF9FTEVNRU5UJykgYWxsRWxzLnB1c2goeyBpZDogY0lkLCBkYXRhOiBhdHRyLmRhdGEgYXMgTERFbGVtZW50Tm9kZURhdGEgfSk7XG4gIH1cblxuICAvLyBQYXJ0aXRpb24gaW50byBtYWluLXJhaWwgKG5vIGJyYW5jaElkKSB2cyBicmFuY2ggZWxlbWVudHNcbiAgY29uc3QgbWFpblJhaWwgPSBhbGxFbHMuZmlsdGVyKGUgPT4gIWUuZGF0YS5icmFuY2hJZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5kYXRhLnBvc2l0aW9uLnggLSBiLmRhdGEucG9zaXRpb24ueCk7XG5cbiAgLy8gR3JvdXAgYnJhbmNoIGVsZW1lbnRzIGJ5IGJyYW5jaElkLCBzb3J0ZWQgbGVmdC10by1yaWdodCB3aXRoaW4gZWFjaCBncm91cFxuICBjb25zdCBicmFuY2hHcm91cHMgPSBuZXcgTWFwPHN0cmluZywgQXJyYXk8eyBpZDogc3RyaW5nOyBkYXRhOiBMREVsZW1lbnROb2RlRGF0YSB9Pj4oKTtcbiAgZm9yIChjb25zdCBlbCBvZiBhbGxFbHMpIHtcbiAgICBpZiAoIWVsLmRhdGEuYnJhbmNoSWQpIGNvbnRpbnVlO1xuICAgIGNvbnN0IGcgPSBicmFuY2hHcm91cHMuZ2V0KGVsLmRhdGEuYnJhbmNoSWQpID8/IFtdO1xuICAgIGcucHVzaChlbCk7XG4gICAgYnJhbmNoR3JvdXBzLnNldChlbC5kYXRhLmJyYW5jaElkLCBnKTtcbiAgfVxuICBmb3IgKGNvbnN0IFssIGddIG9mIGJyYW5jaEdyb3VwcykgZy5zb3J0KChhLCBiKSA9PiBhLmRhdGEucG9zaXRpb24ueCAtIGIuZGF0YS5wb3NpdGlvbi54KTtcblxuICBjb25zdCBlZGdlczogUnVuZ0VkZ2VbXSA9IFtdO1xuICBjb25zdCBub2RlcyA9IG5ldyBTZXQ8c3RyaW5nPihbU09VUkNFLCBTSU5LXSk7XG5cbiAgLy8gQnVpbGQganVuY3Rpb24gSURzIGZvciBtYWluLXJhaWwgZWxlbWVudCBib3VuZGFyaWVzLlxuICAvLyBqdW5jdGlvbkJlZm9yZVtpXSA9IGxlZnQgc2lkZSBvZiBtYWluUmFpbFtpXTsganVuY3Rpb25BZnRlcltpXSA9IHJpZ2h0IHNpZGUuXG4gIC8vIGp1bmN0aW9uQmVmb3JlWzBdID0gU09VUkNFOyBqdW5jdGlvbkFmdGVyW2xhc3RdIGRlcGVuZHMgb24gZWxlbWVudCB0eXBlLlxuICBjb25zdCBjb250YWN0cyA9IG1haW5SYWlsLmZpbHRlcihlID0+ICFlLmRhdGEuZWxlbWVudEtpbmQuc3RhcnRzV2l0aCgnY29pbCcpKTtcbiAgY29uc3QgY29pbHMgICAgPSBtYWluUmFpbC5maWx0ZXIoZSA9PiAgZS5kYXRhLmVsZW1lbnRLaW5kLnN0YXJ0c1dpdGgoJ2NvaWwnKSk7XG5cbiAgLy8gQnVpbGQganVuY3Rpb24gbm9kZSBJRHMgZm9yIGVhY2ggY29udGFjdC9ibG9jayAodGhlIG5vbi10ZXJtaW5hbCBlbGVtZW50cylcbiAgLy8gSl9iZWZvcmVfW2lkXSBhbmQgSl9hZnRlcl9baWRdIFx1MjAxNCBidXQgY29uc2VjdXRpdmUgZWxlbWVudHMgc2hhcmUgYSBqdW5jdGlvbjpcbiAgLy8gICBqdW5jdGlvbkFmdGVyW2ldID09PSBqdW5jdGlvbkJlZm9yZVtpKzFdXG4gIC8vIFdlIGdlbmVyYXRlIG9uZSBqdW5jdGlvbiBJRCBwZXIgaW50ZXItZWxlbWVudCBnYXAuXG4gIGNvbnN0IGp1bmN0aW9uQmVmb3JlOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGNvbnN0IGp1bmN0aW9uQWZ0ZXI6ICBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG5cbiAgaWYgKGNvbnRhY3RzLmxlbmd0aCA9PT0gMCkge1xuICAgIC8vIFJ1bmcgaGFzIG9ubHkgY29pbHMgKG9yIGlzIGVtcHR5KSBcdTIwMTQgU09VUkNFIGRpcmVjdGx5IGNvbm5lY3RzIHRvIFNJTksgZm9yIGNvaWxzXG4gIH0gZWxzZSB7XG4gICAganVuY3Rpb25CZWZvcmVbY29udGFjdHNbMF0uaWRdID0gU09VUkNFO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29udGFjdHMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICBjb25zdCBqSWQgPSBgSl8ke2NvbnRhY3RzW2ldLmlkfV8ke2NvbnRhY3RzW2kgKyAxXS5pZH1gO1xuICAgICAganVuY3Rpb25BZnRlcltjb250YWN0c1tpXS5pZF0gICAgICA9IGpJZDtcbiAgICAgIGp1bmN0aW9uQmVmb3JlW2NvbnRhY3RzW2kgKyAxXS5pZF0gPSBqSWQ7XG4gICAgICBub2Rlcy5hZGQoaklkKTtcbiAgICB9XG4gICAganVuY3Rpb25BZnRlcltjb250YWN0c1tjb250YWN0cy5sZW5ndGggLSAxXS5pZF0gPSBjb2lscy5sZW5ndGggPiAwID8gYEpfcHJlX2NvaWxzYCA6IFNJTks7XG4gICAgaWYgKGNvaWxzLmxlbmd0aCA+IDApIG5vZGVzLmFkZCgnSl9wcmVfY29pbHMnKTtcbiAgfVxuXG4gIC8vIEFkZCBlZGdlcyBmb3IgbWFpbi1yYWlsIGNvbnRhY3RzL2Jsb2Nrc1xuICBmb3IgKGNvbnN0IGVsIG9mIGNvbnRhY3RzKSB7XG4gICAgY29uc3QgZnJvbSA9IGp1bmN0aW9uQmVmb3JlW2VsLmlkXTtcbiAgICBjb25zdCB0byAgID0ganVuY3Rpb25BZnRlcltlbC5pZF07XG4gICAgZWRnZXMucHVzaCh7IGZyb20sIHRvLCBlbElkOiBlbC5pZCB9KTtcbiAgfVxuXG4gIC8vIEFkZCBzaW5rIGVkZ2VzIGZvciBjb2lscyAoZnJvbSBKX3ByZV9jb2lscyBvciBTT1VSQ0UgaWYgbm8gY29udGFjdHMsIHRvIFNJTkspXG4gIGNvbnN0IGNvaWxTb3VyY2UgPSBjb250YWN0cy5sZW5ndGggPiAwID8gKGNvaWxzLmxlbmd0aCA+IDAgPyAnSl9wcmVfY29pbHMnIDogU0lOSykgOiBTT1VSQ0U7XG4gIGZvciAoY29uc3QgY29pbCBvZiBjb2lscykge1xuICAgIGVkZ2VzLnB1c2goeyBmcm9tOiBjb2lsU291cmNlLCB0bzogU0lOSywgZWxJZDogY29pbC5pZCwgaXNDb2lsOiB0cnVlIH0pO1xuICB9XG5cbiAgLy8gQWRkIGVkZ2VzIGZvciBlYWNoIGJyYW5jaCBncm91cFxuICBmb3IgKGNvbnN0IFssIGdyb3VwXSBvZiBicmFuY2hHcm91cHMpIHtcbiAgICBjb25zdCBhbmNob3JJZCA9IGdyb3VwWzBdPy5kYXRhLmFuY2hvcklkO1xuICAgIGlmICghYW5jaG9ySWQpIGNvbnRpbnVlO1xuXG4gICAgLy8gTG9jYXRlIHRoZSBhbmNob3Igb24gdGhlIG1haW4gcmFpbFxuICAgIGNvbnN0IGFuY2hvcklzQ29udGFjdCA9IGNvbnRhY3RzLnNvbWUoYyA9PiBjLmlkID09PSBhbmNob3JJZCk7XG4gICAgaWYgKCFhbmNob3JJc0NvbnRhY3QpIGNvbnRpbnVlOyAgLy8gYW5jaG9yIG11c3QgYmUgYSBjb250YWN0IG9uIG1haW4gcmFpbFxuXG4gICAgY29uc3QgbGVmdEp1bmN0aW9uICA9IGp1bmN0aW9uQmVmb3JlW2FuY2hvcklkXTtcbiAgICBjb25zdCByaWdodEp1bmN0aW9uID0ganVuY3Rpb25BZnRlclthbmNob3JJZF07XG4gICAgaWYgKCFsZWZ0SnVuY3Rpb24gfHwgIXJpZ2h0SnVuY3Rpb24pIGNvbnRpbnVlO1xuXG4gICAgaWYgKGdyb3VwLmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gRW1wdHkgYnJhbmNoID0gcGxhaW4gd2lyZSAoc2hvcnQtY2lyY3VpdCBieXBhc3Mgb2YgYW5jaG9yKVxuICAgICAgZWRnZXMucHVzaCh7IGZyb206IGxlZnRKdW5jdGlvbiwgdG86IHJpZ2h0SnVuY3Rpb24gfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEJ1aWxkIHNlcmllcyBjaGFpbiBmb3IgYnJhbmNoIGVsZW1lbnRzIGJldHdlZW4gdGhlIHR3byBhbmNob3IganVuY3Rpb25zXG4gICAgICBsZXQgcHJldk5vZGUgPSBsZWZ0SnVuY3Rpb247XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdyb3VwLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGJlbCA9IGdyb3VwW2ldO1xuICAgICAgICBjb25zdCBuZXh0Tm9kZSA9IGkgPT09IGdyb3VwLmxlbmd0aCAtIDFcbiAgICAgICAgICA/IHJpZ2h0SnVuY3Rpb25cbiAgICAgICAgICA6IGBCSl8ke2dyb3VwW2ldLmlkfV8ke2dyb3VwW2kgKyAxXS5pZH1gO1xuICAgICAgICBpZiAobmV4dE5vZGUgIT09IHJpZ2h0SnVuY3Rpb24pIG5vZGVzLmFkZChuZXh0Tm9kZSk7XG4gICAgICAgIGVkZ2VzLnB1c2goeyBmcm9tOiBwcmV2Tm9kZSwgdG86IG5leHROb2RlLCBlbElkOiBiZWwuaWQgfSk7XG4gICAgICAgIHByZXZOb2RlID0gbmV4dE5vZGU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZWRnZXMsIG5vZGVzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBSdW5nIGV2YWx1YXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGV2YWx1YXRlUnVuZyhjdHg6IEV2YWxDdHgsIHJ1bmdJZDogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGdyYXBoID0gYnVpbGRSdW5nR3JhcGgoY3R4LCBydW5nSWQpO1xuICBpZiAoZ3JhcGguZWRnZXMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgLy8gU3RlcCAxOiBFdmFsdWF0ZSBjb25kdWN0aW9uIHN0YXRlIG9mIGV2ZXJ5IGVkZ2VcbiAgLy8gQW4gZWRnZSBjb25kdWN0cyBpZjpcbiAgLy8gICAtIGl0IGhhcyBubyBlbGVtZW50IChwbGFpbiB3aXJlKSBcdTIxOTIgYWx3YXlzIHRydWVcbiAgLy8gICAtIGl0IGhhcyBhIGNvbnRhY3QvYmxvY2sgXHUyMTkyIGNvbnRhY3RDb25kdWN0cyguLi4pXG4gIC8vICAgLSBpdCBoYXMgYSBjb2lsIFx1MjE5MiBjb2lsIGVkZ2VzIGFyZSBORVZFUiB1c2VkIGZvciB0cmF2ZXJzYWwgKGlzQ29pbD10cnVlIGVkZ2VzIGFyZSBzaW5rcylcbiAgY29uc3QgY29uZHVjdHMgPSBuZXcgTWFwPFJ1bmdFZGdlLCBib29sZWFuPigpO1xuICBmb3IgKGNvbnN0IGVkZ2Ugb2YgZ3JhcGguZWRnZXMpIHtcbiAgICBpZiAoZWRnZS5pc0NvaWwpIHtcbiAgICAgIGNvbmR1Y3RzLnNldChlZGdlLCBmYWxzZSk7IC8vIGNvaWwgZWRnZXMgZG9uJ3QgcHJvcGFnYXRlIFx1MjAxNCBldmFsdWF0ZWQgc2VwYXJhdGVseVxuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghZWRnZS5lbElkKSB7XG4gICAgICBjb25kdWN0cy5zZXQoZWRnZSwgdHJ1ZSk7IC8vIHBsYWluIHdpcmVcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCBhdHRyID0gY3R4LmNsbS5nZXROb2RlQXR0cihlZGdlLmVsSWQpO1xuICAgIGlmICghYXR0cikgeyBjb25kdWN0cy5zZXQoZWRnZSwgZmFsc2UpOyBjb250aW51ZTsgfVxuICAgIGNvbnN0IGRhdGEgPSBhdHRyLmRhdGEgYXMgTERFbGVtZW50Tm9kZURhdGE7XG4gICAgaWYgKGRhdGEuZWxlbWVudEtpbmQgPT09ICdmYl9jYWxsJykge1xuICAgICAgLy8gRkIgY2FsbCBjb25kdWN0aW9uIGlzIGNvbXB1dGVkIGR1cmluZyBCRlMgKG5lZWRzIHRvIGtub3cgaWYgc291cmNlIG5vZGUgaXMgcmVhY2hhYmxlKVxuICAgICAgLy8gRGVmZXIgXHUyMDE0IG1hcmsgYXMgbmVlZGluZyBldmFsdWF0aW9uXG4gICAgICBjb25kdWN0cy5zZXQoZWRnZSwgZmFsc2UpOyAvLyBwbGFjZWhvbGRlcjsgd2lsbCBiZSByZS1ldmFsdWF0ZWQgZHVyaW5nIEJGU1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25kdWN0cy5zZXQoZWRnZSwgY29udGFjdENvbmR1Y3RzKGN0eCwgZWRnZS5lbElkLCBkYXRhKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gU3RlcCAyOiBCRlMgcmVhY2hhYmlsaXR5IGZyb20gU09VUkNFIHRocm91Z2ggY29uZHVjdGluZyBub24tY29pbCBlZGdlc1xuICBjb25zdCByZWFjaGFibGUgPSBuZXcgU2V0PHN0cmluZz4oW1NPVVJDRV0pO1xuICBjb25zdCBxdWV1ZTogc3RyaW5nW10gPSBbU09VUkNFXTtcbiAgLy8gVHJhY2sgd2hpY2ggZWRnZXMgd2UgbmVlZCB0byByZS1ldmFsdWF0ZSBmb3IgRkIgY2FsbHMgKG5lZWRzIHBvd2VyLWluIHRvIGJlIGtub3duKVxuICBjb25zdCBmYkVkZ2VzID0gZ3JhcGguZWRnZXMuZmlsdGVyKGUgPT4ge1xuICAgIGlmICghZS5lbElkIHx8IGUuaXNDb2lsKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgYXR0ciA9IGN0eC5jbG0uZ2V0Tm9kZUF0dHIoZS5lbElkKTtcbiAgICByZXR1cm4gYXR0ciAmJiAoYXR0ci5kYXRhIGFzIExERWxlbWVudE5vZGVEYXRhKS5lbGVtZW50S2luZCA9PT0gJ2ZiX2NhbGwnO1xuICB9KTtcblxuICAvLyBSZS1ldmFsdWF0ZSBGQi1jYWxsIGVkZ2VzIG9uY2Ugc291cmNlIG5vZGUgcmVhY2hhYmlsaXR5IGlzIGtub3duXG4gIC8vIFdlIG5lZWQgYW4gaXRlcmF0aXZlIGFwcHJvYWNoOiBCRlMsIHRoZW4gaGFuZGxlIEZCIGVkZ2VzIHRoYXQgYmVjYW1lIHJlYWNoYWJsZVxuICBsZXQgY2hhbmdlZCA9IHRydWU7XG4gIHdoaWxlIChjaGFuZ2VkKSB7XG4gICAgY2hhbmdlZCA9IGZhbHNlO1xuICAgIC8vIFByb2Nlc3MgdGhlIHF1ZXVlXG4gICAgbGV0IGhlYWQgPSAwO1xuICAgIHdoaWxlIChoZWFkIDwgcXVldWUubGVuZ3RoKSB7XG4gICAgICBjb25zdCBub2RlID0gcXVldWVbaGVhZCsrXTtcbiAgICAgIGZvciAoY29uc3QgZWRnZSBvZiBncmFwaC5lZGdlcykge1xuICAgICAgICBpZiAoZWRnZS5mcm9tICE9PSBub2RlIHx8IGVkZ2UuaXNDb2lsKSBjb250aW51ZTtcbiAgICAgICAgLy8gUmUtZXZhbHVhdGUgRkIgZWRnZXMgbm93IHRoYXQgd2Uga25vdyBgZnJvbWAgaXMgcmVhY2hhYmxlXG4gICAgICAgIGlmIChlZGdlLmVsSWQpIHtcbiAgICAgICAgICBjb25zdCBhdHRyID0gY3R4LmNsbS5nZXROb2RlQXR0cihlZGdlLmVsSWQpO1xuICAgICAgICAgIGlmIChhdHRyICYmIChhdHRyLmRhdGEgYXMgTERFbGVtZW50Tm9kZURhdGEpLmVsZW1lbnRLaW5kID09PSAnZmJfY2FsbCcpIHtcbiAgICAgICAgICAgIGNvbnN0IGZiUmVzdWx0ID0gZXZhbHVhdGVGQkNhbGwoY3R4LCBlZGdlLmVsSWQsIGF0dHIuZGF0YSBhcyBMREVsZW1lbnROb2RlRGF0YSwgdHJ1ZSk7XG4gICAgICAgICAgICBjb25kdWN0cy5zZXQoZWRnZSwgZmJSZXN1bHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoY29uZHVjdHMuZ2V0KGVkZ2UpICYmICFyZWFjaGFibGUuaGFzKGVkZ2UudG8pKSB7XG4gICAgICAgICAgcmVhY2hhYmxlLmFkZChlZGdlLnRvKTtcbiAgICAgICAgICBxdWV1ZS5wdXNoKGVkZ2UudG8pO1xuICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIENoZWNrIEZCIGVkZ2VzIGZyb20gbm9uLXJlYWNoYWJsZSBub2RlcyAodGhleSBkb24ndCBjb25kdWN0IFx1MjAxNCBidXQgbWFyayB0aGVtKVxuICAgIGZvciAoY29uc3QgZWRnZSBvZiBmYkVkZ2VzKSB7XG4gICAgICBpZiAoIXJlYWNoYWJsZS5oYXMoZWRnZS5mcm9tKSAmJiBjb25kdWN0cy5nZXQoZWRnZSkgPT09IGZhbHNlKSB7XG4gICAgICAgIC8vIFN0aWxsIGZhbHNlIFx1MjAxNCBubyBjaGFuZ2VcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTdGVwIDM6IFdyaXRlIGVuZXJnaXplZCBhbmQgcG93ZXJBZnRlciBmb3IgYWxsIGNvbnRhY3QvYmxvY2sgZWxlbWVudHNcbiAgLy8gRm9yIGVhY2ggY29udGFjdCBlbGVtZW50IG9uIGEgbm9uLWNvaWwgZWRnZTpcbiAgLy8gICBlbmVyZ2l6ZWRbaWRdID0gdGhlIGVsZW1lbnQncyBvd24gY29uZHVjdGlvbiBBTkQgaXRzIHNvdXJjZSBub2RlIHdhcyByZWFjaGFibGVcbiAgLy8gICBwb3dlckFmdGVyW2lkXSA9IHRoZSB0YXJnZXQganVuY3Rpb24gbm9kZSBpcyByZWFjaGFibGUgKE9SIG9mIGFsbCBwYXJhbGxlbCBwYXRocyB0aHJvdWdoIGl0KVxuICBmb3IgKGNvbnN0IGVkZ2Ugb2YgZ3JhcGguZWRnZXMpIHtcbiAgICBpZiAoIWVkZ2UuZWxJZCB8fCBlZGdlLmlzQ29pbCkgY29udGludWU7XG4gICAgY29uc3QgZGF0YSA9IChjdHguY2xtLmdldE5vZGVBdHRyKGVkZ2UuZWxJZCk/LmRhdGEpIGFzIExERWxlbWVudE5vZGVEYXRhIHwgdW5kZWZpbmVkO1xuICAgIGlmICghZGF0YSkgY29udGludWU7XG5cbiAgICBjb25zdCBzb3VyY2VSZWFjaGFibGUgPSByZWFjaGFibGUuaGFzKGVkZ2UuZnJvbSk7XG4gICAgY29uc3QgdGFyZ2V0UmVhY2hhYmxlID0gcmVhY2hhYmxlLmhhcyhlZGdlLnRvKTtcbiAgICBjb25zdCBlZGdlQ29uZHVjdHMgICAgPSAhIWNvbmR1Y3RzLmdldChlZGdlKTtcblxuICAgIC8vIGVuZXJnaXplZCA9IHRoZSBlbGVtZW50IGluZGl2aWR1YWxseSBjb25kdWN0ZWQgKHNvdXJjZSB3YXMgbGl2ZSBBTkQgaXQgcGFzc2VkIHBvd2VyKVxuICAgIGN0eC5lbmVyZ2l6ZWRbZWRnZS5lbElkXSAgPSBzb3VyY2VSZWFjaGFibGUgJiYgZWRnZUNvbmR1Y3RzO1xuICAgIC8vIHBvd2VyQWZ0ZXIgPSBwb3dlciBleGl0cyByaWdodCBzaWRlICh0YXJnZXQganVuY3Rpb24gcmVhY2hhYmxlLCBwb3NzaWJseSB2aWEgcGFyYWxsZWwgYnJhbmNoKVxuICAgIGN0eC5wb3dlckFmdGVyW2VkZ2UuZWxJZF0gPSB0YXJnZXRSZWFjaGFibGU7XG4gIH1cblxuICAvLyBTdGVwIDQ6IEZpcmUgY29pbCBzaW5rIGVkZ2VzIFx1MjAxNCBjb2lsIGZpcmVzIGlmIGl0cyBzb3VyY2Ugbm9kZSBpcyByZWFjaGFibGVcbiAgZm9yIChjb25zdCBlZGdlIG9mIGdyYXBoLmVkZ2VzKSB7XG4gICAgaWYgKCFlZGdlLmVsSWQgfHwgIWVkZ2UuaXNDb2lsKSBjb250aW51ZTtcbiAgICBjb25zdCBkYXRhID0gKGN0eC5jbG0uZ2V0Tm9kZUF0dHIoZWRnZS5lbElkKT8uZGF0YSkgYXMgTERFbGVtZW50Tm9kZURhdGEgfCB1bmRlZmluZWQ7XG4gICAgaWYgKCFkYXRhKSBjb250aW51ZTtcbiAgICBjb25zdCBwb3dlckluID0gcmVhY2hhYmxlLmhhcyhlZGdlLmZyb20pO1xuICAgIGV2YWx1YXRlQ29pbEVsZW1lbnQoY3R4LCBlZGdlLmVsSWQsIGRhdGEsIHBvd2VySW4pO1xuICB9XG5cbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIENvbnRhY3QgY29uZHVjdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gY29udGFjdENvbmR1Y3RzKFxuICBjdHg6ICAgRXZhbEN0eCxcbiAgZWxJZDogIHN0cmluZyxcbiAgZGF0YTogIExERWxlbWVudE5vZGVEYXRhLFxuKTogYm9vbGVhbiB7XG4gIGNvbnN0IHRhZ05hbWUgPSBnZXRSZWFkVGFnKGN0eC5jbG0sIGVsSWQpO1xuICBpZiAoIXRhZ05hbWUpIHJldHVybiBmYWxzZTtcblxuICBjb25zdCB2YWwgICAgID0gdG9Cb29sKGN0eC5nZXRFZmZlY3RpdmUodGFnTmFtZSkpO1xuICBjb25zdCBwcmV2VmFsID0gdG9Cb29sKGN0eC5wcmV2VGFnVmFsdWVzW3RhZ05hbWVdKTtcblxuICBzd2l0Y2ggKGRhdGEuZWxlbWVudEtpbmQpIHtcbiAgICBjYXNlICdjb250YWN0X25vJzogcmV0dXJuIHZhbDtcbiAgICBjYXNlICdjb250YWN0X25jJzogcmV0dXJuICF2YWw7XG4gICAgY2FzZSAnY29udGFjdF9wJzogIHJldHVybiB2YWwgJiYgIXByZXZWYWw7ICAgLy8gcmlzaW5nIGVkZ2UgXHUyMDE0IGV4YWN0bHkgb25lIHNjYW5cbiAgICBjYXNlICdjb250YWN0X24nOiAgcmV0dXJuICF2YWwgJiYgcHJldlZhbDsgICAvLyBmYWxsaW5nIGVkZ2UgXHUyMDE0IGV4YWN0bHkgb25lIHNjYW5cbiAgICBkZWZhdWx0OiAgICAgICAgICAgcmV0dXJuIHZhbDtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRkIgY2FsbCBldmFsdWF0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBldmFsdWF0ZUZCQ2FsbChcbiAgY3R4OiAgICAgRXZhbEN0eCxcbiAgZWxJZDogICAgc3RyaW5nLFxuICBkYXRhOiAgICBMREVsZW1lbnROb2RlRGF0YSxcbiAgcG93ZXJJbjogYm9vbGVhbixcbik6IGJvb2xlYW4ge1xuICBpZiAoIXBvd2VySW4gfHwgIWRhdGEuZmJUeXBlKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gSW5saW5lIHN0YXRlbGVzcyBtYXRoIC8gY29tcGFyZSAvIHNlbGVjdG9yIG9wZXJhdGlvbnNcbiAgY29uc3QgaW5saW5lT3BzID0gbmV3IFNldChbJ0VRJywnTkUnLCdHVCcsJ0dFJywnTFQnLCdMRScsJ0FERCcsJ1NVQicsJ01VTCcsJ0RJVicsJ01PRCcsJ0FCUycsJ1NRUlQnLCdNT1ZFJywnU0VMJywnTElNSVQnLCdNSU4nLCdNQVgnXSk7XG4gIGlmIChpbmxpbmVPcHMuaGFzKGRhdGEuZmJUeXBlKSkge1xuICAgIC8vIENvbGxlY3QgcGluIFx1MjE5MiB0YWcgbWFwcGluZ3MgZnJvbSBSRUFEUyBlZGdlc1xuICAgIGNvbnN0IHBpblRvVGFnOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgZm9yIChjb25zdCBlZGdlIG9mIGN0eC5jbG0uZ2V0T3V0RWRnZXNCeVR5cGUoZWxJZCwgJ1JFQURTJykpIHtcbiAgICAgIGNvbnN0IHRhZ0RhdGEgPSBjdHguY2xtLmdldE5vZGVEYXRhPFRhZ05vZGVEYXRhPihlZGdlLnRhcmdldCk7XG4gICAgICBjb25zdCBwaW4gPSAoZWRnZS5kYXRhIGFzIGFueSk/LnBpbiB8fCAnSU4nO1xuICAgICAgcGluVG9UYWdbcGluXSA9IHRhZ0RhdGEubmFtZTtcbiAgICB9XG4gICAgY29uc3QgZ2V0VmFsID0gKHBpbjogc3RyaW5nKTogYW55ID0+IGN0eC5nZXRFZmZlY3RpdmUocGluVG9UYWdbcGluXSA/PyAnJykgPz8gMDtcbiAgICBjb25zdCB0b051bSA9ICh2OiBhbnkpOiBudW1iZXIgPT4ge1xuICAgICAgaWYgKHR5cGVvZiB2ID09PSAnbnVtYmVyJykgcmV0dXJuIHY7XG4gICAgICBpZiAodHlwZW9mIHYgPT09ICdib29sZWFuJykgcmV0dXJuIHYgPyAxIDogMDtcbiAgICAgIGNvbnN0IG4gPSBwYXJzZUZsb2F0KFN0cmluZyh2ID8/ICcwJykpO1xuICAgICAgcmV0dXJuIGlzTmFOKG4pID8gMCA6IG47XG4gICAgfTtcbiAgICBjb25zdCB0b0Jvb2xMb2NhbCA9ICh2OiBhbnkpOiBib29sZWFuID0+IHtcbiAgICAgIGlmICh0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nKSByZXR1cm4gdjtcbiAgICAgIGlmICh0eXBlb2YgdiA9PT0gJ251bWJlcicpIHJldHVybiB2ICE9PSAwO1xuICAgICAgcmV0dXJuIHYgPT09ICdUUlVFJyB8fCB2ID09PSAndHJ1ZScgfHwgdiA9PT0gJzEnO1xuICAgIH07XG4gICAgY29uc3QgYSA9IHRvTnVtKGdldFZhbCgnSU4xJykgPz8gZ2V0VmFsKCdJTicpKTtcbiAgICBjb25zdCBiID0gdG9OdW0oZ2V0VmFsKCdJTjInKSk7XG4gICAgbGV0IHJlc3VsdDogYW55O1xuICAgIHN3aXRjaCAoZGF0YS5mYlR5cGUpIHtcbiAgICAgIGNhc2UgJ0VRJzogcmVzdWx0ID0gYSA9PT0gYjsgYnJlYWs7XG4gICAgICBjYXNlICdORSc6IHJlc3VsdCA9IGEgIT09IGI7IGJyZWFrO1xuICAgICAgY2FzZSAnR1QnOiByZXN1bHQgPSBhID4gYjsgYnJlYWs7XG4gICAgICBjYXNlICdHRSc6IHJlc3VsdCA9IGEgPj0gYjsgYnJlYWs7XG4gICAgICBjYXNlICdMVCc6IHJlc3VsdCA9IGEgPCBiOyBicmVhaztcbiAgICAgIGNhc2UgJ0xFJzogcmVzdWx0ID0gYSA8PSBiOyBicmVhaztcbiAgICAgIGNhc2UgJ0FERCc6IHJlc3VsdCA9IGEgKyBiOyBicmVhaztcbiAgICAgIGNhc2UgJ1NVQic6IHJlc3VsdCA9IGEgLSBiOyBicmVhaztcbiAgICAgIGNhc2UgJ01VTCc6IHJlc3VsdCA9IGEgKiBiOyBicmVhaztcbiAgICAgIGNhc2UgJ0RJVic6IHJlc3VsdCA9IGIgIT09IDAgPyBhIC8gYiA6IDA7IGJyZWFrO1xuICAgICAgY2FzZSAnTU9EJzogcmVzdWx0ID0gYiAhPT0gMCA/IGEgJSBiIDogMDsgYnJlYWs7XG4gICAgICBjYXNlICdBQlMnOiByZXN1bHQgPSBNYXRoLmFicyhhKTsgYnJlYWs7XG4gICAgICBjYXNlICdTUVJUJzogcmVzdWx0ID0gTWF0aC5zcXJ0KE1hdGgubWF4KDAsIGEpKTsgYnJlYWs7XG4gICAgICBjYXNlICdNT1ZFJzogcmVzdWx0ID0gZ2V0VmFsKCdJTicpOyBicmVhaztcbiAgICAgIGNhc2UgJ1NFTCc6IHJlc3VsdCA9IHRvQm9vbExvY2FsKGdldFZhbCgnRycpKSA/IHRvTnVtKGdldFZhbCgnSU4xJykpIDogdG9OdW0oZ2V0VmFsKCdJTjAnKSk7IGJyZWFrO1xuICAgICAgY2FzZSAnTElNSVQnOiB7IGNvbnN0IG1uID0gdG9OdW0oZ2V0VmFsKCdNTicpKTsgY29uc3QgbXggPSB0b051bShnZXRWYWwoJ01YJykpOyByZXN1bHQgPSBNYXRoLm1heChtbiwgTWF0aC5taW4obXgsIGEpKTsgYnJlYWs7IH1cbiAgICAgIGNhc2UgJ01JTic6IHJlc3VsdCA9IE1hdGgubWluKGEsIGIpOyBicmVhaztcbiAgICAgIGNhc2UgJ01BWCc6IHJlc3VsdCA9IE1hdGgubWF4KGEsIGIpOyBicmVhaztcbiAgICAgIGRlZmF1bHQ6IHJlc3VsdCA9IGZhbHNlO1xuICAgIH1cbiAgICAvLyBXcml0ZSByZXN1bHQgdG8gb3V0cHV0IHRhZyB2aWEgV1JJVEVTIGVkZ2VzXG4gICAgZm9yIChjb25zdCBlZGdlIG9mIGN0eC5jbG0uZ2V0T3V0RWRnZXNCeVR5cGUoZWxJZCwgJ1dSSVRFUycpKSB7XG4gICAgICBjb25zdCB0YWdEYXRhID0gY3R4LmNsbS5nZXROb2RlRGF0YTxUYWdOb2RlRGF0YT4oZWRnZS50YXJnZXQpO1xuICAgICAgY3R4LnRhZ1VwZGF0ZXNbdGFnRGF0YS5uYW1lXSA9IHJlc3VsdDtcbiAgICB9XG4gICAgY3R4LmJsb2NrUGluVmFsdWVzW2Ake2VsSWR9Ok9VVGBdID0gU3RyaW5nKHJlc3VsdCk7XG4gICAgY3R4LmVuZXJnaXplZFtlbElkXSA9IHRydWU7XG4gICAgY3R4LnBvd2VyQWZ0ZXJbZWxJZF0gPSB0eXBlb2YgcmVzdWx0ID09PSAnYm9vbGVhbicgPyByZXN1bHQgOiB0cnVlO1xuICAgIHJldHVybiB0eXBlb2YgcmVzdWx0ID09PSAnYm9vbGVhbicgPyByZXN1bHQgOiB0cnVlO1xuICB9XG5cbiAgY29uc3QgaW5zdGFuY2VLZXkgPSBkYXRhLmluc3RhbmNlTmFtZSB8fCBlbElkO1xuICBjb25zdCBpbnB1dHM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcblxuICBjb25zdCByZWFkRWRnZXMgPSBjdHguY2xtLmdldE91dEVkZ2VzQnlUeXBlKGVsSWQsICdSRUFEUycpO1xuICBmb3IgKGNvbnN0IGVkZ2Ugb2YgcmVhZEVkZ2VzKSB7XG4gICAgY29uc3QgdGFnRGF0YSA9IGN0eC5jbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KGVkZ2UudGFyZ2V0KTtcbiAgICBjb25zdCBwaW4gPSAoZWRnZS5kYXRhIGFzIGFueSk/LnBpbiB8fCAnSU4nO1xuICAgIGlucHV0c1twaW5dID0gY3R4LmdldEVmZmVjdGl2ZSh0YWdEYXRhLm5hbWUpID8/IGZhbHNlO1xuICB9XG4gIGlmIChyZWFkRWRnZXMubGVuZ3RoID09PSAxICYmIGlucHV0c1snSU4nXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgdGFnRGF0YSA9IGN0eC5jbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KHJlYWRFZGdlc1swXS50YXJnZXQpO1xuICAgIGlucHV0c1snSU4nXSA9IGN0eC5nZXRFZmZlY3RpdmUodGFnRGF0YS5uYW1lKSA/PyBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IGV4ZWN1dGVGQihkYXRhLmZiVHlwZSwgaW5wdXRzLCBjdHguZmJTdGF0ZXMuZ2V0KGluc3RhbmNlS2V5KSwgeyBkdDogY3R4LmR0IH0pO1xuICBjdHguZmJTdGF0ZXMuc2V0KGluc3RhbmNlS2V5LCByZXN1bHQuc3RhdGUpO1xuXG4gIGZvciAoY29uc3QgZWRnZSBvZiBjdHguY2xtLmdldE91dEVkZ2VzQnlUeXBlKGVsSWQsICdXUklURVMnKSkge1xuICAgIGNvbnN0IHRhZ0RhdGEgPSBjdHguY2xtLmdldE5vZGVEYXRhPFRhZ05vZGVEYXRhPihlZGdlLnRhcmdldCk7XG4gICAgY29uc3QgcGluID0gKGVkZ2UuZGF0YSBhcyBhbnkpPy5waW4gfHwgJ1EnO1xuICAgIGlmIChyZXN1bHQub3V0cHV0c1twaW5dICE9PSB1bmRlZmluZWQpIGN0eC50YWdVcGRhdGVzW3RhZ0RhdGEubmFtZV0gPSByZXN1bHQub3V0cHV0c1twaW5dO1xuICB9XG4gIGZvciAoY29uc3QgW3BpbiwgdmFsXSBvZiBPYmplY3QuZW50cmllcyhyZXN1bHQub3V0cHV0cykpIHtcbiAgICBjdHguYmxvY2tQaW5WYWx1ZXNbYCR7ZWxJZH06JHtwaW59YF0gPSBTdHJpbmcodmFsKTtcbiAgfVxuXG4gIHJldHVybiB0b0Jvb2wocmVzdWx0Lm91dHB1dHMuUSA/PyByZXN1bHQub3V0cHV0cy5RMSA/PyBmYWxzZSk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBDb2lsIGV2YWx1YXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGV2YWx1YXRlQ29pbEVsZW1lbnQoXG4gIGN0eDogICAgIEV2YWxDdHgsXG4gIGVsSWQ6ICAgIHN0cmluZyxcbiAgZGF0YTogICAgTERFbGVtZW50Tm9kZURhdGEsXG4gIHBvd2VySW46IGJvb2xlYW4sXG4pOiB2b2lkIHtcbiAgLy8gUmVjb3JkIGZvciBQL04gZWRnZSBkZXRlY3Rpb24gb24gbmV4dCBzY2FuXG4gIGN0eC5jb2lsUG93ZXJUaGlzU2NhbltlbElkXSA9IHBvd2VySW47XG4gIC8vIEdseXBoID0gY29pbCByZWNlaXZpbmcgcG93ZXJcbiAgY3R4LmVuZXJnaXplZFtlbElkXSA9IHBvd2VySW47XG4gIC8vIENvaWwgaXMgdGVybWluYWwgXHUyMDE0IG5vIHBvd2VyIGV4aXRzXG4gIGN0eC5wb3dlckFmdGVyW2VsSWRdID0gZmFsc2U7XG5cbiAgY29uc3QgdGFnTmFtZSA9IGdldFdyaXRlVGFnKGN0eC5jbG0sIGVsSWQpO1xuICBpZiAoIXRhZ05hbWUpIHJldHVybjtcblxuICBjb25zdCBwcmV2UG93ZXIgPSB0b0Jvb2woY3R4LnByZXZDb2lsUG93ZXJbZWxJZF0pO1xuXG4gIHN3aXRjaCAoZGF0YS5lbGVtZW50S2luZCkge1xuICAgIGNhc2UgJ2NvaWwnOlxuICAgICAgLy8gTm9uLXJldGVudGl2ZTogcmVjb21wdXRlZCBldmVyeSBzY2FuXG4gICAgICBjdHgudGFnVXBkYXRlc1t0YWdOYW1lXSA9IHBvd2VySW47XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2NvaWxfbmVnYXRlZCc6XG4gICAgICAvLyBXcml0ZXMgaW52ZXJzZSBvZiBwb3dlciBcdTIwMTQgdHJ1ZSB3aGVuIE5PVCBlbmVyZ2l6ZWRcbiAgICAgIGN0eC50YWdVcGRhdGVzW3RhZ05hbWVdID0gIXBvd2VySW47XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2NvaWxfc2V0JzpcbiAgICBjYXNlICdjb2lsX2xhdGNoJzpcbiAgICAgIC8vIFJldGVudGl2ZSBTRVQ6IG9ubHkgYWN0cyB3aGVuIGVuZXJnaXplZDsgbmV2ZXIgY2xlYXJzXG4gICAgICBpZiAocG93ZXJJbikgY3R4LnRhZ1VwZGF0ZXNbdGFnTmFtZV0gPSB0cnVlO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdjb2lsX3Jlc2V0JzpcbiAgICBjYXNlICdjb2lsX3VubGF0Y2gnOlxuICAgICAgLy8gUmV0ZW50aXZlIFJFU0VUOiBvbmx5IGFjdHMgd2hlbiBlbmVyZ2l6ZWQ7IG5ldmVyIHNldHNcbiAgICAgIGlmIChwb3dlckluKSBjdHgudGFnVXBkYXRlc1t0YWdOYW1lXSA9IGZhbHNlO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdjb2lsX3AnOlxuICAgICAgLy8gUG9zaXRpdmUgc2Vuc2luZzogMS1zY2FuIHB1bHNlIG9uIHBvd2VyIEZBTFNFXHUyMTkyVFJVRSB0cmFuc2l0aW9uXG4gICAgICBjdHgudGFnVXBkYXRlc1t0YWdOYW1lXSA9IHBvd2VySW4gJiYgIXByZXZQb3dlcjtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnY29pbF9uJzpcbiAgICAgIC8vIE5lZ2F0aXZlIHNlbnNpbmc6IDEtc2NhbiBwdWxzZSBvbiBwb3dlciBUUlVFXHUyMTkyRkFMU0UgdHJhbnNpdGlvblxuICAgICAgY3R4LnRhZ1VwZGF0ZXNbdGFnTmFtZV0gPSAhcG93ZXJJbiAmJiBwcmV2UG93ZXI7XG4gICAgICBicmVhaztcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGFnIG5hbWUgaGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gZ2V0UmVhZFRhZyhjbG06IENMTUdyYXBoLCBlbGVtZW50SWQ6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IGVkZ2VzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKGVsZW1lbnRJZCwgJ1JFQURTJyk7XG4gIGlmIChlZGdlcy5sZW5ndGggPT09IDApIHJldHVybiB1bmRlZmluZWQ7XG4gIHJldHVybiBjbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KGVkZ2VzWzBdLnRhcmdldCk/Lm5hbWU7XG59XG5cbmZ1bmN0aW9uIGdldFdyaXRlVGFnKGNsbTogQ0xNR3JhcGgsIGVsZW1lbnRJZDogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgZWRnZXMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoZWxlbWVudElkLCAnV1JJVEVTJyk7XG4gIGlmIChlZGdlcy5sZW5ndGggPT09IDApIHJldHVybiB1bmRlZmluZWQ7XG4gIHJldHVybiBjbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KGVkZ2VzWzBdLnRhcmdldCk/Lm5hbWU7XG59XG5cbmZ1bmN0aW9uIHRvQm9vbCh2OiBhbnkpOiBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiB2ID09PSAnYm9vbGVhbicpIHJldHVybiB2O1xuICBpZiAodHlwZW9mIHYgPT09ICdudW1iZXInKSByZXR1cm4gdiAhPT0gMDtcbiAgaWYgKHR5cGVvZiB2ID09PSAnc3RyaW5nJykgcmV0dXJuIHYgPT09ICdUUlVFJyB8fCB2ID09PSAndHJ1ZScgfHwgdiA9PT0gJzEnO1xuICAvLyBHcmFjZWZ1bCBmYWxsYmFjayBmb3IgYXJyYXkgdHlwZXM6IHVzZSBpbmRleCAwXG4gIGlmIChBcnJheS5pc0FycmF5KHYpKSByZXR1cm4gdG9Cb29sKHZbMF0pO1xuICByZXR1cm4gISF2O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBeUJBLFNBQVMsaUJBQWlCO0FBa0JuQixTQUFTLGVBQ2QsS0FDQSxXQUNBLFVBQ0EsSUFDQSxnQkFBOEIsQ0FBQyxHQUMvQixnQkFBNkMsQ0FBQyxHQUM5QyxjQUNjO0FBQ2QsUUFBTSxhQUE4QyxDQUFDO0FBQ3JELFFBQU0sWUFBOEMsQ0FBQztBQUNyRCxRQUFNLGFBQThDLENBQUM7QUFDckQsUUFBTSxpQkFBOEMsQ0FBQztBQUNyRCxRQUFNLG9CQUE4QyxDQUFDO0FBQ3JELFFBQU0sY0FBb0IsSUFBSSxJQUFJLFFBQVE7QUFDMUMsUUFBTSxtQkFBOEMsRUFBRSxHQUFHLFVBQVU7QUFHbkUsUUFBTSxlQUFlLENBQUMsWUFDcEIsZ0JBQWdCLFdBQVcsZUFDdkIsYUFBYSxPQUFPLElBQ25CLFdBQVcsT0FBTyxLQUFLLFVBQVUsT0FBTztBQUUvQyxRQUFNLE1BQWU7QUFBQSxJQUNuQjtBQUFBLElBQUs7QUFBQSxJQUFXO0FBQUEsSUFBWTtBQUFBLElBQVc7QUFBQSxJQUN2QztBQUFBLElBQWdCO0FB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
