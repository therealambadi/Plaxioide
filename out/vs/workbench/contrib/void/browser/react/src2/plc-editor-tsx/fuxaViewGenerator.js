import { logicStore } from "./logicStore.js";
const FUXA_BASE = "http://127.0.0.1:1881";
const DEVICE = "FuxaServer";
function inferRole(tag) {
  const n = tag.name.toLowerCase();
  if (/level|tank|vessel|hopper/.test(n)) return "tank";
  if (/motor|run|speed|rpm/.test(n)) return "motor";
  if (/valve|open|close|gate|damper/.test(n)) return "valve";
  if (/pump/.test(n)) return "pump";
  if (tag.dataType === "BOOL") return "bool_indicator";
  return "number_display";
}
const ROLE_SPEC = {
  tank: { type: "svg-ext-proceng-tank4", w: 110, h: 150, prefix: "SHE_" },
  motor: { type: "svg-ext-proceng-motor", w: 130, h: 110, prefix: "SHE_" },
  valve: { type: "svg-ext-proceng-valvecx", w: 110, h: 130, prefix: "SHE_" },
  pump: { type: "svg-ext-proceng-pumpcentri1", w: 140, h: 120, prefix: "SHE_" },
  bool_indicator: { type: "svg-ext-gauge_semaphore", w: 80, h: 80, prefix: "GSE_" },
  number_display: { type: "svg-ext-value", w: 140, h: 60, prefix: "VAL_" }
};
function makeInnerSvg(role, tagName, w, h) {
  const short = tagName.length > 10 ? tagName.slice(0, 9) + "\u2026" : tagName;
  switch (role) {
    case "tank":
      return `
  <defs>
    <linearGradient id="tkg_${tagName}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#90caf9"/><stop offset="40%" stop-color="#e3f2fd"/><stop offset="100%" stop-color="#64b5f6"/>
    </linearGradient>
    <linearGradient id="tkf_${tagName}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1565c0"/><stop offset="50%" stop-color="#1e88e5"/><stop offset="100%" stop-color="#0d47a1"/>
    </linearGradient>
    <clipPath id="tkc_${tagName}"><rect x="13" y="22" width="84" height="100" rx="4"/></clipPath>
  </defs>
  <rect x="13" y="22" width="84" height="100" rx="6" fill="url(#tkg_${tagName})" stroke="#1565c0" stroke-width="2.5"/>
  <rect x="14" y="67" width="82" height="54" clip-path="url(#tkc_${tagName})" fill="url(#tkf_${tagName})" opacity="0.92"/>
  <line x1="13" y1="45" x2="20" y2="45" stroke="#1565c0" stroke-width="1"/>
  <line x1="13" y1="67" x2="20" y2="67" stroke="#1565c0" stroke-width="1"/>
  <line x1="13" y1="89" x2="20" y2="89" stroke="#1565c0" stroke-width="1"/>
  <rect x="17" y="26" width="10" height="92" rx="3" fill="white" opacity="0.18"/>
  <ellipse cx="55" cy="22" rx="42" ry="10" fill="#bbdefb" stroke="#1565c0" stroke-width="2"/>
  <rect x="50" y="4" width="10" height="18" rx="3" fill="#90caf9" stroke="#1565c0" stroke-width="1.5"/>
  <rect x="48" y="122" width="14" height="10" rx="2" fill="#90caf9" stroke="#1565c0" stroke-width="1.5"/>
  <text x="${w / 2}" y="${h - 3}" text-anchor="middle" font-size="9" fill="#0d47a1" font-family="monospace" font-weight="bold">${short}</text>`;
    case "motor":
      return `
  <defs>
    <linearGradient id="mg_${tagName}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e0e0e0"/><stop offset="50%" stop-color="#bdbdbd"/><stop offset="100%" stop-color="#9e9e9e"/>
    </linearGradient>
  </defs>
  <rect x="10" y="20" width="90" height="60" rx="10" fill="url(#mg_${tagName})" stroke="#616161" stroke-width="2"/>
  <line x1="25" y1="20" x2="25" y2="80" stroke="#9e9e9e" stroke-width="1.5"/>
  <line x1="38" y1="20" x2="38" y2="80" stroke="#9e9e9e" stroke-width="1.5"/>
  <line x1="51" y1="20" x2="51" y2="80" stroke="#9e9e9e" stroke-width="1.5"/>
  <line x1="64" y1="20" x2="64" y2="80" stroke="#9e9e9e" stroke-width="1.5"/>
  <ellipse cx="100" cy="50" rx="12" ry="30" fill="#d0d0d0" stroke="#616161" stroke-width="2"/>
  <rect x="108" y="46" width="18" height="8" rx="3" fill="#bdbdbd" stroke="#424242" stroke-width="1.5"/>
  <text x="55" y="55" text-anchor="middle" font-size="18" fill="#424242" font-weight="bold" opacity="0.5">M</text>
  <circle cx="18" cy="50" r="7" fill="#ef5350" stroke="#b71c1c" stroke-width="1.5"/>
  <text x="${w / 2}" y="${h - 2}" text-anchor="middle" font-size="9" fill="#212121" font-family="monospace" font-weight="bold">${short}</text>`;
    case "valve":
      return `
  <defs>
    <linearGradient id="vg_${tagName}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffcc80"/><stop offset="50%" stop-color="#ffe0b2"/><stop offset="100%" stop-color="#ffb74d"/>
    </linearGradient>
  </defs>
  <rect x="0" y="42" width="22" height="26" rx="2" fill="#bdbdbd" stroke="#757575" stroke-width="1.5"/>
  <rect x="88" y="42" width="22" height="26" rx="2" fill="#bdbdbd" stroke="#757575" stroke-width="1.5"/>
  <polygon points="22,42 88,42 88,68 22,68" fill="#ffe0b2" stroke="#e65100" stroke-width="1.5"/>
  <polygon points="22,42 55,55 22,68" fill="url(#vg_${tagName})" stroke="#e65100" stroke-width="2"/>
  <polygon points="88,42 55,55 88,68" fill="url(#vg_${tagName})" stroke="#e65100" stroke-width="2"/>
  <rect x="51" y="10" width="8" height="32" rx="2" fill="#bdbdbd" stroke="#757575" stroke-width="1.5"/>
  <rect x="46" y="36" width="18" height="10" rx="3" fill="#9e9e9e" stroke="#616161" stroke-width="1.5"/>
  <circle cx="55" cy="8" r="14" fill="none" stroke="#424242" stroke-width="3"/>
  <circle cx="55" cy="8" r="4" fill="#616161"/>
  <circle cx="55" cy="55" r="7" fill="#ef5350" stroke="#b71c1c" stroke-width="1.5"/>
  <text x="${w / 2}" y="${h - 3}" text-anchor="middle" font-size="9" fill="#bf360c" font-family="monospace" font-weight="bold">${short}</text>`;
    case "pump":
      return `
  <defs>
    <radialGradient id="pumpg_${tagName}" cx="45%" cy="45%">
      <stop offset="0%" stop-color="#e1bee7"/><stop offset="100%" stop-color="#9c27b0"/>
    </radialGradient>
    <linearGradient id="pumpmg_${tagName}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e0e0e0"/><stop offset="100%" stop-color="#9e9e9e"/>
    </linearGradient>
  </defs>
  <rect x="57" y="0" width="16" height="22" rx="2" fill="#ce93d8" stroke="#6a1b9a" stroke-width="1.5"/>
  <rect x="0" y="47" width="20" height="16" rx="2" fill="#ce93d8" stroke="#6a1b9a" stroke-width="1.5"/>
  <ellipse cx="55" cy="58" rx="35" ry="35" fill="url(#pumpg_${tagName})" stroke="#6a1b9a" stroke-width="2.5"/>
  <line x1="55" y1="35" x2="55" y2="81" stroke="#7b1fa2" stroke-width="2" opacity="0.7"/>
  <line x1="32" y1="45" x2="78" y2="71" stroke="#7b1fa2" stroke-width="2" opacity="0.7"/>
  <line x1="32" y1="71" x2="78" y2="45" stroke="#7b1fa2" stroke-width="2" opacity="0.7"/>
  <circle cx="55" cy="58" r="8" fill="#4a148c" stroke="#7b1fa2" stroke-width="1.5"/>
  <rect x="98" y="44" width="38" height="28" rx="6" fill="url(#pumpmg_${tagName})" stroke="#616161" stroke-width="2"/>
  <text x="117" y="61" text-anchor="middle" font-size="10" fill="#424242" font-weight="bold" opacity="0.6">M</text>
  <circle cx="100" cy="48" r="6" fill="#ef5350" stroke="#b71c1c" stroke-width="1.5"/>
  <text x="${w / 2}" y="${h - 2}" text-anchor="middle" font-size="9" fill="#4a148c" font-family="monospace" font-weight="bold">${short}</text>`;
    case "bool_indicator":
      return `
  <defs>
    <radialGradient id="ledg_${tagName}" cx="38%" cy="38%">
      <stop offset="0%" stop-color="#ef9a9a"/><stop offset="100%" stop-color="#c62828"/>
    </radialGradient>
  </defs>
  <rect x="3" y="3" width="74" height="74" rx="8" fill="#eeeeee" stroke="#bdbdbd" stroke-width="2"/>
  <circle cx="40" cy="35" r="22" fill="#bdbdbd" stroke="#9e9e9e" stroke-width="1.5"/>
  <circle cx="40" cy="35" r="15" fill="url(#ledg_${tagName})"/>
  <ellipse cx="33" cy="28" rx="5" ry="3" fill="white" opacity="0.4" transform="rotate(-20 33 28)"/>
  <text x="40" y="${h - 3}" text-anchor="middle" font-size="8" fill="#212121" font-family="monospace" font-weight="bold">${short}</text>`;
    default:
      return `
  <defs>
    <linearGradient id="dspg_${tagName}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8eaf6"/><stop offset="100%" stop-color="#c5cae9"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="8" fill="url(#dspg_${tagName})" stroke="#3949ab" stroke-width="2.5"/>
  <rect x="8" y="8" width="${w - 16}" height="${h - 20}" rx="5" fill="#1a237e" stroke="#3949ab" stroke-width="1.5"/>
  <rect x="12" y="12" width="${w - 24}" height="${h - 32}" rx="3" fill="#0d1b0d"/>
  <text x="${w / 2}" y="${Math.floor(h / 2) + 6}" text-anchor="middle" font-size="20" fill="#00e676" font-family="'Courier New',monospace" font-weight="bold" letter-spacing="2">0.00</text>
  <text x="${w / 2}" y="${h - 4}" text-anchor="middle" font-size="8" fill="#9fa8da" font-family="monospace" font-weight="bold">${short}</text>`;
  }
}
function buildGaugeSettings(tag, widgetId, role) {
  const spec = ROLE_SPEC[role];
  const variableId = `${DEVICE}^~^${tag.name}`;
  const property = {
    variableId,
    variableSrc: DEVICE,
    variable: tag.name,
    alarmId: "",
    alarmSrc: "",
    alarm: "",
    alarmColor: "",
    ranges: [],
    actions: [],
    events: [],
    options: {}
  };
  if (role === "bool_indicator") {
    property.ranges = [
      { type: "range", min: "1", max: "1", color: "#00b050ff", stroke: "" },
      { type: "range", min: "0", max: "0", color: "#d8d8d8ff", stroke: "" }
    ];
  } else if (role === "motor" || role === "pump") {
    property.actions = [
      {
        variableId,
        variableSrc: DEVICE,
        variable: tag.name,
        range: { min: "1", max: "1" },
        type: "clockwise",
        options: {}
      },
      {
        variableId,
        variableSrc: DEVICE,
        variable: tag.name,
        range: { min: "0", max: "0" },
        type: "stop",
        options: {}
      }
    ];
    property.ranges = [
      { type: "range", min: "1", max: "1", color: "#00b050ff", stroke: "" },
      { type: "range", min: "0", max: "0", color: "#9e9e9eff", stroke: "" }
    ];
  } else if (role === "valve") {
    property.ranges = [
      { type: "range", min: "1", max: "1", color: "#00b050ff", stroke: "" },
      { type: "range", min: "0", max: "0", color: "#d8d8d8ff", stroke: "" }
    ];
  }
  return {
    id: widgetId,
    type: spec.type,
    name: tag.name,
    label: tag.description || tag.name,
    property
  };
}
async function apiFetch(path, method = "GET", body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== void 0) opts.body = JSON.stringify(body);
  const res = await fetch(FUXA_BASE + path, opts);
  if (!res.ok) throw new Error(`FUXA ${method} ${path} \u2192 ${res.status}`);
  return res.json().catch(() => null);
}
async function generateFuxaViewForPOU(pouName, tags) {
  if (!tags.length) return;
  const MAX_COLS = 5;
  const CELL_W = 200;
  const CELL_H = 200;
  const MARGIN_X = 40;
  const MARGIN_Y = 80;
  const widgets = [];
  let col = 0, row = 0;
  for (const tag of tags) {
    const role = inferRole(tag);
    const spec = ROLE_SPEC[role];
    const x = MARGIN_X + col * CELL_W;
    const y = MARGIN_Y + row * CELL_H;
    const widgetId = `${spec.prefix}widget_${tag.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
    widgets.push({ id: `g_${tag.name}`, widgetId, role, spec, tag, x, y });
    col++;
    if (col >= MAX_COLS) {
      col = 0;
      row++;
    }
  }
  const canvasW = Math.max(1200, Math.min(tags.length, MAX_COLS) * CELL_W + MARGIN_X * 2);
  const canvasH = Math.max(800, (row + 1) * CELL_H + MARGIN_Y * 2);
  const gElements = widgets.map((w) => {
    const inner = makeInnerSvg(w.role, w.tag.name, w.spec.w, w.spec.h);
    return `<g id="${w.widgetId}" transform="translate(${w.x},${w.y})" type="${w.spec.type}" name="${w.tag.name}" width="${w.spec.w}" height="${w.spec.h}">
${inner}
</g>`;
  });
  const svgcontent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvasW}" height="${canvasH}">
${gElements.join("\n")}
</svg>`;
  const items = {};
  for (const w of widgets) {
    items[w.widgetId] = buildGaugeSettings(w.tag, w.widgetId, w.role);
  }
  const viewId = `view_${pouName.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  const view = {
    id: viewId,
    name: pouName,
    type: "svg",
    profile: { width: canvasW, height: canvasH, bkcolor: "#ffffff", margin: "0" },
    svgcontent,
    items
  };
  try {
    const project = await apiFetch("/api/project");
    if (!project?.hmi) throw new Error("Unexpected project structure from FUXA");
    if (Array.isArray(project.hmi.views)) {
      for (const v of project.hmi.views) {
        if (v.profile?.bkcolor) v.profile.bkcolor = "#ffffff";
      }
      const idx = project.hmi.views.findIndex((v) => v.id === viewId);
      if (idx >= 0) project.hmi.views[idx] = view;
      else project.hmi.views.push(view);
    } else {
      project.hmi.views = [view];
    }
    const devices = project.devices ?? {};
    const fuxaDevice = Object.values(devices).find((d) => d.name === DEVICE || d.id === DEVICE);
    if (fuxaDevice) {
      if (!fuxaDevice.tags) fuxaDevice.tags = {};
      for (const w of widgets) {
        const key = `${DEVICE}^~^${w.tag.name}`;
        if (!fuxaDevice.tags[key]) {
          fuxaDevice.tags[key] = {
            id: w.tag.name,
            name: w.tag.name,
            type: w.tag.dataType,
            address: `${DEVICE}^~^${w.tag.name}`,
            value: 0
          };
        }
      }
    }
    await apiFetch("/api/project", "POST", project);
    logicStore.addConsoleEntry(
      "success",
      `[FuxaView] Generated HMI view "${pouName}" \u2014 ${widgets.length} widget(s) on ${canvasW}\xD7${canvasH} canvas`
    );
  } catch (e) {
    logicStore.addConsoleEntry("warn", `[FuxaView] Could not save view to FUXA: ${e.message}`);
  }
}
async function generateFuxaViewFromCurrentTags(pouName = "main") {
  const tags = logicStore.state.tagDatabase;
  return generateFuxaViewForPOU(pouName, tags);
}
export {
  generateFuxaViewForPOU,
  generateFuxaViewFromCurrentTags
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC9mdXhhVmlld0dlbmVyYXRvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLypcbiAqIGZ1eGFWaWV3R2VuZXJhdG9yIFx1MjAxNCBhdXRvLWdlbmVyYXRlcyBhIEZVWEEgSE1JIHZpZXcgZm9yIGEgc2V0IG9mIHRhZ3MuXG4gKiBQcm9kdWNlcyBhIHByb3BlciBGVVhBIHZpZXc6IHN2Z2NvbnRlbnQgd2l0aCA8ZyB0eXBlPVwiLi4uXCI+IGVsZW1lbnRzXG4gKiArIGl0ZW1ze30gR2F1Z2VTZXR0aW5ncyBrZXllZCBieSB3aWRnZXQgSUQuXG4gKiBVc2VzIHRoZSBjb3JyZWN0IEdFVCtQT1NUIC9hcGkvcHJvamVjdCBwYXR0ZXJuIChubyBwZXItdmlldyBlbmRwb2ludHMpLlxuICovXG5cbmltcG9ydCB7IGxvZ2ljU3RvcmUgfSBmcm9tICcuL2xvZ2ljU3RvcmUuanMnO1xuaW1wb3J0IHR5cGUgeyBUYWdFbnRyeSB9IGZyb20gJy4vbG9naWNTdG9yZS5qcyc7XG5cbmNvbnN0IEZVWEFfQkFTRSA9ICdodHRwOi8vMTI3LjAuMC4xOjE4ODEnO1xuY29uc3QgREVWSUNFID0gJ0Z1eGFTZXJ2ZXInO1xuXG4vLyBcdTI1MDBcdTI1MDAgV2lkZ2V0IHJvbGUgaGV1cmlzdGljcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxudHlwZSBXaWRnZXRSb2xlID0gJ3RhbmsnIHwgJ21vdG9yJyB8ICd2YWx2ZScgfCAncHVtcCcgfCAnYm9vbF9pbmRpY2F0b3InIHwgJ251bWJlcl9kaXNwbGF5JztcblxuZnVuY3Rpb24gaW5mZXJSb2xlKHRhZzogVGFnRW50cnkpOiBXaWRnZXRSb2xlIHtcbiAgICBjb25zdCBuID0gdGFnLm5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoL2xldmVsfHRhbmt8dmVzc2VsfGhvcHBlci8udGVzdChuKSkgcmV0dXJuICd0YW5rJztcbiAgICBpZiAoL21vdG9yfHJ1bnxzcGVlZHxycG0vLnRlc3QobikpIHJldHVybiAnbW90b3InO1xuICAgIGlmICgvdmFsdmV8b3BlbnxjbG9zZXxnYXRlfGRhbXBlci8udGVzdChuKSkgcmV0dXJuICd2YWx2ZSc7XG4gICAgaWYgKC9wdW1wLy50ZXN0KG4pKSByZXR1cm4gJ3B1bXAnO1xuICAgIGlmICh0YWcuZGF0YVR5cGUgPT09ICdCT09MJykgcmV0dXJuICdib29sX2luZGljYXRvcic7XG4gICAgcmV0dXJuICdudW1iZXJfZGlzcGxheSc7XG59XG5cbi8vIE1hcCByb2xlIFx1MjE5MiBGVVhBIHR5cGUgc3RyaW5nIGFuZCB3aWRnZXQgZGltZW5zaW9uc1xuaW50ZXJmYWNlIFdpZGdldFNwZWMge1xuICAgIHR5cGU6IHN0cmluZzsgICAvLyBleGFjdCBGVVhBIHR5cGUgc3RyaW5nIGZvciA8ZyB0eXBlPVwiLi4uXCI+XG4gICAgdzogbnVtYmVyO1xuICAgIGg6IG51bWJlcjtcbiAgICBwcmVmaXg6IHN0cmluZzsgLy8gR2F1Z2VTZXR0aW5ncyBpZCBwcmVmaXhcbn1cblxuY29uc3QgUk9MRV9TUEVDOiBSZWNvcmQ8V2lkZ2V0Um9sZSwgV2lkZ2V0U3BlYz4gPSB7XG4gICAgdGFuazogICAgICAgICAgIHsgdHlwZTogJ3N2Zy1leHQtcHJvY2VuZy10YW5rNCcsICAgICAgdzogMTEwLCBoOiAxNTAsIHByZWZpeDogJ1NIRV8nIH0sXG4gICAgbW90b3I6ICAgICAgICAgIHsgdHlwZTogJ3N2Zy1leHQtcHJvY2VuZy1tb3RvcicsICAgICAgdzogMTMwLCBoOiAxMTAsIHByZWZpeDogJ1NIRV8nIH0sXG4gICAgdmFsdmU6ICAgICAgICAgIHsgdHlwZTogJ3N2Zy1leHQtcHJvY2VuZy12YWx2ZWN4JywgICAgdzogMTEwLCBoOiAxMzAsIHByZWZpeDogJ1NIRV8nIH0sXG4gICAgcHVtcDogICAgICAgICAgIHsgdHlwZTogJ3N2Zy1leHQtcHJvY2VuZy1wdW1wY2VudHJpMScsdzogMTQwLCBoOiAxMjAsIHByZWZpeDogJ1NIRV8nIH0sXG4gICAgYm9vbF9pbmRpY2F0b3I6IHsgdHlwZTogJ3N2Zy1leHQtZ2F1Z2Vfc2VtYXBob3JlJywgICAgdzogODAsICBoOiA4MCwgIHByZWZpeDogJ0dTRV8nIH0sXG4gICAgbnVtYmVyX2Rpc3BsYXk6IHsgdHlwZTogJ3N2Zy1leHQtdmFsdWUnLCAgICAgICAgICAgICAgdzogMTQwLCBoOiA2MCwgIHByZWZpeDogJ1ZBTF8nIH0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgU1ZHIGdlb21ldHJ5IHBlciByb2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gVGhlc2UgYXJlIHRoZSBpbm5lciBTVkcgcGF0aC9yZWN0IGJvZGllcyB0aGF0IGdvIGluc2lkZSB0aGUgPGc+IHdyYXBwZXIuXG4vLyBGVVhBIGFwcGxpZXMgYW5pbWF0aW9ucyBieSB3YWxraW5nIGNoaWxkIGVsZW1lbnRzIG9mIHRoZSA8Zz4gbm9kZS5cblxuZnVuY3Rpb24gbWFrZUlubmVyU3ZnKHJvbGU6IFdpZGdldFJvbGUsIHRhZ05hbWU6IHN0cmluZywgdzogbnVtYmVyLCBoOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIGNvbnN0IHNob3J0ID0gdGFnTmFtZS5sZW5ndGggPiAxMCA/IHRhZ05hbWUuc2xpY2UoMCwgOSkgKyAnXHUyMDI2JyA6IHRhZ05hbWU7XG4gICAgc3dpdGNoIChyb2xlKSB7XG4gICAgICAgIGNhc2UgJ3RhbmsnOlxuICAgICAgICAgICAgcmV0dXJuIGBcbiAgPGRlZnM+XG4gICAgPGxpbmVhckdyYWRpZW50IGlkPVwidGtnXyR7dGFnTmFtZX1cIiB4MT1cIjBcIiB5MT1cIjBcIiB4Mj1cIjFcIiB5Mj1cIjBcIj5cbiAgICAgIDxzdG9wIG9mZnNldD1cIjAlXCIgc3RvcC1jb2xvcj1cIiM5MGNhZjlcIi8+PHN0b3Agb2Zmc2V0PVwiNDAlXCIgc3RvcC1jb2xvcj1cIiNlM2YyZmRcIi8+PHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3AtY29sb3I9XCIjNjRiNWY2XCIvPlxuICAgIDwvbGluZWFyR3JhZGllbnQ+XG4gICAgPGxpbmVhckdyYWRpZW50IGlkPVwidGtmXyR7dGFnTmFtZX1cIiB4MT1cIjBcIiB5MT1cIjBcIiB4Mj1cIjFcIiB5Mj1cIjBcIj5cbiAgICAgIDxzdG9wIG9mZnNldD1cIjAlXCIgc3RvcC1jb2xvcj1cIiMxNTY1YzBcIi8+PHN0b3Agb2Zmc2V0PVwiNTAlXCIgc3RvcC1jb2xvcj1cIiMxZTg4ZTVcIi8+PHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3AtY29sb3I9XCIjMGQ0N2ExXCIvPlxuICAgIDwvbGluZWFyR3JhZGllbnQ+XG4gICAgPGNsaXBQYXRoIGlkPVwidGtjXyR7dGFnTmFtZX1cIj48cmVjdCB4PVwiMTNcIiB5PVwiMjJcIiB3aWR0aD1cIjg0XCIgaGVpZ2h0PVwiMTAwXCIgcng9XCI0XCIvPjwvY2xpcFBhdGg+XG4gIDwvZGVmcz5cbiAgPHJlY3QgeD1cIjEzXCIgeT1cIjIyXCIgd2lkdGg9XCI4NFwiIGhlaWdodD1cIjEwMFwiIHJ4PVwiNlwiIGZpbGw9XCJ1cmwoI3RrZ18ke3RhZ05hbWV9KVwiIHN0cm9rZT1cIiMxNTY1YzBcIiBzdHJva2Utd2lkdGg9XCIyLjVcIi8+XG4gIDxyZWN0IHg9XCIxNFwiIHk9XCI2N1wiIHdpZHRoPVwiODJcIiBoZWlnaHQ9XCI1NFwiIGNsaXAtcGF0aD1cInVybCgjdGtjXyR7dGFnTmFtZX0pXCIgZmlsbD1cInVybCgjdGtmXyR7dGFnTmFtZX0pXCIgb3BhY2l0eT1cIjAuOTJcIi8+XG4gIDxsaW5lIHgxPVwiMTNcIiB5MT1cIjQ1XCIgeDI9XCIyMFwiIHkyPVwiNDVcIiBzdHJva2U9XCIjMTU2NWMwXCIgc3Ryb2tlLXdpZHRoPVwiMVwiLz5cbiAgPGxpbmUgeDE9XCIxM1wiIHkxPVwiNjdcIiB4Mj1cIjIwXCIgeTI9XCI2N1wiIHN0cm9rZT1cIiMxNTY1YzBcIiBzdHJva2Utd2lkdGg9XCIxXCIvPlxuICA8bGluZSB4MT1cIjEzXCIgeTE9XCI4OVwiIHgyPVwiMjBcIiB5Mj1cIjg5XCIgc3Ryb2tlPVwiIzE1NjVjMFwiIHN0cm9rZS13aWR0aD1cIjFcIi8+XG4gIDxyZWN0IHg9XCIxN1wiIHk9XCIyNlwiIHdpZHRoPVwiMTBcIiBoZWlnaHQ9XCI5MlwiIHJ4PVwiM1wiIGZpbGw9XCJ3aGl0ZVwiIG9wYWNpdHk9XCIwLjE4XCIvPlxuICA8ZWxsaXBzZSBjeD1cIjU1XCIgY3k9XCIyMlwiIHJ4PVwiNDJcIiByeT1cIjEwXCIgZmlsbD1cIiNiYmRlZmJcIiBzdHJva2U9XCIjMTU2NWMwXCIgc3Ryb2tlLXdpZHRoPVwiMlwiLz5cbiAgPHJlY3QgeD1cIjUwXCIgeT1cIjRcIiB3aWR0aD1cIjEwXCIgaGVpZ2h0PVwiMThcIiByeD1cIjNcIiBmaWxsPVwiIzkwY2FmOVwiIHN0cm9rZT1cIiMxNTY1YzBcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDxyZWN0IHg9XCI0OFwiIHk9XCIxMjJcIiB3aWR0aD1cIjE0XCIgaGVpZ2h0PVwiMTBcIiByeD1cIjJcIiBmaWxsPVwiIzkwY2FmOVwiIHN0cm9rZT1cIiMxNTY1YzBcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDx0ZXh0IHg9XCIke3cvMn1cIiB5PVwiJHtoLTN9XCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIiBmb250LXNpemU9XCI5XCIgZmlsbD1cIiMwZDQ3YTFcIiBmb250LWZhbWlseT1cIm1vbm9zcGFjZVwiIGZvbnQtd2VpZ2h0PVwiYm9sZFwiPiR7c2hvcnR9PC90ZXh0PmA7XG5cbiAgICAgICAgY2FzZSAnbW90b3InOlxuICAgICAgICAgICAgcmV0dXJuIGBcbiAgPGRlZnM+XG4gICAgPGxpbmVhckdyYWRpZW50IGlkPVwibWdfJHt0YWdOYW1lfVwiIHgxPVwiMFwiIHkxPVwiMFwiIHgyPVwiMFwiIHkyPVwiMVwiPlxuICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wLWNvbG9yPVwiI2UwZTBlMFwiLz48c3RvcCBvZmZzZXQ9XCI1MCVcIiBzdG9wLWNvbG9yPVwiI2JkYmRiZFwiLz48c3RvcCBvZmZzZXQ9XCIxMDAlXCIgc3RvcC1jb2xvcj1cIiM5ZTllOWVcIi8+XG4gICAgPC9saW5lYXJHcmFkaWVudD5cbiAgPC9kZWZzPlxuICA8cmVjdCB4PVwiMTBcIiB5PVwiMjBcIiB3aWR0aD1cIjkwXCIgaGVpZ2h0PVwiNjBcIiByeD1cIjEwXCIgZmlsbD1cInVybCgjbWdfJHt0YWdOYW1lfSlcIiBzdHJva2U9XCIjNjE2MTYxXCIgc3Ryb2tlLXdpZHRoPVwiMlwiLz5cbiAgPGxpbmUgeDE9XCIyNVwiIHkxPVwiMjBcIiB4Mj1cIjI1XCIgeTI9XCI4MFwiIHN0cm9rZT1cIiM5ZTllOWVcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDxsaW5lIHgxPVwiMzhcIiB5MT1cIjIwXCIgeDI9XCIzOFwiIHkyPVwiODBcIiBzdHJva2U9XCIjOWU5ZTllXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIvPlxuICA8bGluZSB4MT1cIjUxXCIgeTE9XCIyMFwiIHgyPVwiNTFcIiB5Mj1cIjgwXCIgc3Ryb2tlPVwiIzllOWU5ZVwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPGxpbmUgeDE9XCI2NFwiIHkxPVwiMjBcIiB4Mj1cIjY0XCIgeTI9XCI4MFwiIHN0cm9rZT1cIiM5ZTllOWVcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDxlbGxpcHNlIGN4PVwiMTAwXCIgY3k9XCI1MFwiIHJ4PVwiMTJcIiByeT1cIjMwXCIgZmlsbD1cIiNkMGQwZDBcIiBzdHJva2U9XCIjNjE2MTYxXCIgc3Ryb2tlLXdpZHRoPVwiMlwiLz5cbiAgPHJlY3QgeD1cIjEwOFwiIHk9XCI0NlwiIHdpZHRoPVwiMThcIiBoZWlnaHQ9XCI4XCIgcng9XCIzXCIgZmlsbD1cIiNiZGJkYmRcIiBzdHJva2U9XCIjNDI0MjQyXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIvPlxuICA8dGV4dCB4PVwiNTVcIiB5PVwiNTVcIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIGZvbnQtc2l6ZT1cIjE4XCIgZmlsbD1cIiM0MjQyNDJcIiBmb250LXdlaWdodD1cImJvbGRcIiBvcGFjaXR5PVwiMC41XCI+TTwvdGV4dD5cbiAgPGNpcmNsZSBjeD1cIjE4XCIgY3k9XCI1MFwiIHI9XCI3XCIgZmlsbD1cIiNlZjUzNTBcIiBzdHJva2U9XCIjYjcxYzFjXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIvPlxuICA8dGV4dCB4PVwiJHt3LzJ9XCIgeT1cIiR7aC0yfVwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCIgZm9udC1zaXplPVwiOVwiIGZpbGw9XCIjMjEyMTIxXCIgZm9udC1mYW1pbHk9XCJtb25vc3BhY2VcIiBmb250LXdlaWdodD1cImJvbGRcIj4ke3Nob3J0fTwvdGV4dD5gO1xuXG4gICAgICAgIGNhc2UgJ3ZhbHZlJzpcbiAgICAgICAgICAgIHJldHVybiBgXG4gIDxkZWZzPlxuICAgIDxsaW5lYXJHcmFkaWVudCBpZD1cInZnXyR7dGFnTmFtZX1cIiB4MT1cIjBcIiB5MT1cIjBcIiB4Mj1cIjFcIiB5Mj1cIjBcIj5cbiAgICAgIDxzdG9wIG9mZnNldD1cIjAlXCIgc3RvcC1jb2xvcj1cIiNmZmNjODBcIi8+PHN0b3Agb2Zmc2V0PVwiNTAlXCIgc3RvcC1jb2xvcj1cIiNmZmUwYjJcIi8+PHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3AtY29sb3I9XCIjZmZiNzRkXCIvPlxuICAgIDwvbGluZWFyR3JhZGllbnQ+XG4gIDwvZGVmcz5cbiAgPHJlY3QgeD1cIjBcIiB5PVwiNDJcIiB3aWR0aD1cIjIyXCIgaGVpZ2h0PVwiMjZcIiByeD1cIjJcIiBmaWxsPVwiI2JkYmRiZFwiIHN0cm9rZT1cIiM3NTc1NzVcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDxyZWN0IHg9XCI4OFwiIHk9XCI0MlwiIHdpZHRoPVwiMjJcIiBoZWlnaHQ9XCIyNlwiIHJ4PVwiMlwiIGZpbGw9XCIjYmRiZGJkXCIgc3Ryb2tlPVwiIzc1NzU3NVwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPHBvbHlnb24gcG9pbnRzPVwiMjIsNDIgODgsNDIgODgsNjggMjIsNjhcIiBmaWxsPVwiI2ZmZTBiMlwiIHN0cm9rZT1cIiNlNjUxMDBcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDxwb2x5Z29uIHBvaW50cz1cIjIyLDQyIDU1LDU1IDIyLDY4XCIgZmlsbD1cInVybCgjdmdfJHt0YWdOYW1lfSlcIiBzdHJva2U9XCIjZTY1MTAwXCIgc3Ryb2tlLXdpZHRoPVwiMlwiLz5cbiAgPHBvbHlnb24gcG9pbnRzPVwiODgsNDIgNTUsNTUgODgsNjhcIiBmaWxsPVwidXJsKCN2Z18ke3RhZ05hbWV9KVwiIHN0cm9rZT1cIiNlNjUxMDBcIiBzdHJva2Utd2lkdGg9XCIyXCIvPlxuICA8cmVjdCB4PVwiNTFcIiB5PVwiMTBcIiB3aWR0aD1cIjhcIiBoZWlnaHQ9XCIzMlwiIHJ4PVwiMlwiIGZpbGw9XCIjYmRiZGJkXCIgc3Ryb2tlPVwiIzc1NzU3NVwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPHJlY3QgeD1cIjQ2XCIgeT1cIjM2XCIgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjEwXCIgcng9XCIzXCIgZmlsbD1cIiM5ZTllOWVcIiBzdHJva2U9XCIjNjE2MTYxXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIvPlxuICA8Y2lyY2xlIGN4PVwiNTVcIiBjeT1cIjhcIiByPVwiMTRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cIiM0MjQyNDJcIiBzdHJva2Utd2lkdGg9XCIzXCIvPlxuICA8Y2lyY2xlIGN4PVwiNTVcIiBjeT1cIjhcIiByPVwiNFwiIGZpbGw9XCIjNjE2MTYxXCIvPlxuICA8Y2lyY2xlIGN4PVwiNTVcIiBjeT1cIjU1XCIgcj1cIjdcIiBmaWxsPVwiI2VmNTM1MFwiIHN0cm9rZT1cIiNiNzFjMWNcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDx0ZXh0IHg9XCIke3cvMn1cIiB5PVwiJHtoLTN9XCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIiBmb250LXNpemU9XCI5XCIgZmlsbD1cIiNiZjM2MGNcIiBmb250LWZhbWlseT1cIm1vbm9zcGFjZVwiIGZvbnQtd2VpZ2h0PVwiYm9sZFwiPiR7c2hvcnR9PC90ZXh0PmA7XG5cbiAgICAgICAgY2FzZSAncHVtcCc6XG4gICAgICAgICAgICByZXR1cm4gYFxuICA8ZGVmcz5cbiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9XCJwdW1wZ18ke3RhZ05hbWV9XCIgY3g9XCI0NSVcIiBjeT1cIjQ1JVwiPlxuICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wLWNvbG9yPVwiI2UxYmVlN1wiLz48c3RvcCBvZmZzZXQ9XCIxMDAlXCIgc3RvcC1jb2xvcj1cIiM5YzI3YjBcIi8+XG4gICAgPC9yYWRpYWxHcmFkaWVudD5cbiAgICA8bGluZWFyR3JhZGllbnQgaWQ9XCJwdW1wbWdfJHt0YWdOYW1lfVwiIHgxPVwiMFwiIHkxPVwiMFwiIHgyPVwiMFwiIHkyPVwiMVwiPlxuICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wLWNvbG9yPVwiI2UwZTBlMFwiLz48c3RvcCBvZmZzZXQ9XCIxMDAlXCIgc3RvcC1jb2xvcj1cIiM5ZTllOWVcIi8+XG4gICAgPC9saW5lYXJHcmFkaWVudD5cbiAgPC9kZWZzPlxuICA8cmVjdCB4PVwiNTdcIiB5PVwiMFwiIHdpZHRoPVwiMTZcIiBoZWlnaHQ9XCIyMlwiIHJ4PVwiMlwiIGZpbGw9XCIjY2U5M2Q4XCIgc3Ryb2tlPVwiIzZhMWI5YVwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPHJlY3QgeD1cIjBcIiB5PVwiNDdcIiB3aWR0aD1cIjIwXCIgaGVpZ2h0PVwiMTZcIiByeD1cIjJcIiBmaWxsPVwiI2NlOTNkOFwiIHN0cm9rZT1cIiM2YTFiOWFcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDxlbGxpcHNlIGN4PVwiNTVcIiBjeT1cIjU4XCIgcng9XCIzNVwiIHJ5PVwiMzVcIiBmaWxsPVwidXJsKCNwdW1wZ18ke3RhZ05hbWV9KVwiIHN0cm9rZT1cIiM2YTFiOWFcIiBzdHJva2Utd2lkdGg9XCIyLjVcIi8+XG4gIDxsaW5lIHgxPVwiNTVcIiB5MT1cIjM1XCIgeDI9XCI1NVwiIHkyPVwiODFcIiBzdHJva2U9XCIjN2IxZmEyXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIG9wYWNpdHk9XCIwLjdcIi8+XG4gIDxsaW5lIHgxPVwiMzJcIiB5MT1cIjQ1XCIgeDI9XCI3OFwiIHkyPVwiNzFcIiBzdHJva2U9XCIjN2IxZmEyXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIG9wYWNpdHk9XCIwLjdcIi8+XG4gIDxsaW5lIHgxPVwiMzJcIiB5MT1cIjcxXCIgeDI9XCI3OFwiIHkyPVwiNDVcIiBzdHJva2U9XCIjN2IxZmEyXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIG9wYWNpdHk9XCIwLjdcIi8+XG4gIDxjaXJjbGUgY3g9XCI1NVwiIGN5PVwiNThcIiByPVwiOFwiIGZpbGw9XCIjNGExNDhjXCIgc3Ryb2tlPVwiIzdiMWZhMlwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPHJlY3QgeD1cIjk4XCIgeT1cIjQ0XCIgd2lkdGg9XCIzOFwiIGhlaWdodD1cIjI4XCIgcng9XCI2XCIgZmlsbD1cInVybCgjcHVtcG1nXyR7dGFnTmFtZX0pXCIgc3Ryb2tlPVwiIzYxNjE2MVwiIHN0cm9rZS13aWR0aD1cIjJcIi8+XG4gIDx0ZXh0IHg9XCIxMTdcIiB5PVwiNjFcIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIGZvbnQtc2l6ZT1cIjEwXCIgZmlsbD1cIiM0MjQyNDJcIiBmb250LXdlaWdodD1cImJvbGRcIiBvcGFjaXR5PVwiMC42XCI+TTwvdGV4dD5cbiAgPGNpcmNsZSBjeD1cIjEwMFwiIGN5PVwiNDhcIiByPVwiNlwiIGZpbGw9XCIjZWY1MzUwXCIgc3Ryb2tlPVwiI2I3MWMxY1wiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPHRleHQgeD1cIiR7dy8yfVwiIHk9XCIke2gtMn1cIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIGZvbnQtc2l6ZT1cIjlcIiBmaWxsPVwiIzRhMTQ4Y1wiIGZvbnQtZmFtaWx5PVwibW9ub3NwYWNlXCIgZm9udC13ZWlnaHQ9XCJib2xkXCI+JHtzaG9ydH08L3RleHQ+YDtcblxuICAgICAgICBjYXNlICdib29sX2luZGljYXRvcic6XG4gICAgICAgICAgICByZXR1cm4gYFxuICA8ZGVmcz5cbiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9XCJsZWRnXyR7dGFnTmFtZX1cIiBjeD1cIjM4JVwiIGN5PVwiMzglXCI+XG4gICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3AtY29sb3I9XCIjZWY5YTlhXCIvPjxzdG9wIG9mZnNldD1cIjEwMCVcIiBzdG9wLWNvbG9yPVwiI2M2MjgyOFwiLz5cbiAgICA8L3JhZGlhbEdyYWRpZW50PlxuICA8L2RlZnM+XG4gIDxyZWN0IHg9XCIzXCIgeT1cIjNcIiB3aWR0aD1cIjc0XCIgaGVpZ2h0PVwiNzRcIiByeD1cIjhcIiBmaWxsPVwiI2VlZWVlZVwiIHN0cm9rZT1cIiNiZGJkYmRcIiBzdHJva2Utd2lkdGg9XCIyXCIvPlxuICA8Y2lyY2xlIGN4PVwiNDBcIiBjeT1cIjM1XCIgcj1cIjIyXCIgZmlsbD1cIiNiZGJkYmRcIiBzdHJva2U9XCIjOWU5ZTllXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIvPlxuICA8Y2lyY2xlIGN4PVwiNDBcIiBjeT1cIjM1XCIgcj1cIjE1XCIgZmlsbD1cInVybCgjbGVkZ18ke3RhZ05hbWV9KVwiLz5cbiAgPGVsbGlwc2UgY3g9XCIzM1wiIGN5PVwiMjhcIiByeD1cIjVcIiByeT1cIjNcIiBmaWxsPVwid2hpdGVcIiBvcGFjaXR5PVwiMC40XCIgdHJhbnNmb3JtPVwicm90YXRlKC0yMCAzMyAyOClcIi8+XG4gIDx0ZXh0IHg9XCI0MFwiIHk9XCIke2gtM31cIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIGZvbnQtc2l6ZT1cIjhcIiBmaWxsPVwiIzIxMjEyMVwiIGZvbnQtZmFtaWx5PVwibW9ub3NwYWNlXCIgZm9udC13ZWlnaHQ9XCJib2xkXCI+JHtzaG9ydH08L3RleHQ+YDtcblxuICAgICAgICBkZWZhdWx0OiAvLyBudW1iZXJfZGlzcGxheVxuICAgICAgICAgICAgcmV0dXJuIGBcbiAgPGRlZnM+XG4gICAgPGxpbmVhckdyYWRpZW50IGlkPVwiZHNwZ18ke3RhZ05hbWV9XCIgeDE9XCIwXCIgeTE9XCIwXCIgeDI9XCIwXCIgeTI9XCIxXCI+XG4gICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3AtY29sb3I9XCIjZThlYWY2XCIvPjxzdG9wIG9mZnNldD1cIjEwMCVcIiBzdG9wLWNvbG9yPVwiI2M1Y2FlOVwiLz5cbiAgICA8L2xpbmVhckdyYWRpZW50PlxuICA8L2RlZnM+XG4gIDxyZWN0IHg9XCIyXCIgeT1cIjJcIiB3aWR0aD1cIiR7dy00fVwiIGhlaWdodD1cIiR7aC00fVwiIHJ4PVwiOFwiIGZpbGw9XCJ1cmwoI2RzcGdfJHt0YWdOYW1lfSlcIiBzdHJva2U9XCIjMzk0OWFiXCIgc3Ryb2tlLXdpZHRoPVwiMi41XCIvPlxuICA8cmVjdCB4PVwiOFwiIHk9XCI4XCIgd2lkdGg9XCIke3ctMTZ9XCIgaGVpZ2h0PVwiJHtoLTIwfVwiIHJ4PVwiNVwiIGZpbGw9XCIjMWEyMzdlXCIgc3Ryb2tlPVwiIzM5NDlhYlwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPHJlY3QgeD1cIjEyXCIgeT1cIjEyXCIgd2lkdGg9XCIke3ctMjR9XCIgaGVpZ2h0PVwiJHtoLTMyfVwiIHJ4PVwiM1wiIGZpbGw9XCIjMGQxYjBkXCIvPlxuICA8dGV4dCB4PVwiJHt3LzJ9XCIgeT1cIiR7TWF0aC5mbG9vcihoLzIpKzZ9XCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIiBmb250LXNpemU9XCIyMFwiIGZpbGw9XCIjMDBlNjc2XCIgZm9udC1mYW1pbHk9XCInQ291cmllciBOZXcnLG1vbm9zcGFjZVwiIGZvbnQtd2VpZ2h0PVwiYm9sZFwiIGxldHRlci1zcGFjaW5nPVwiMlwiPjAuMDA8L3RleHQ+XG4gIDx0ZXh0IHg9XCIke3cvMn1cIiB5PVwiJHtoLTR9XCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIiBmb250LXNpemU9XCI4XCIgZmlsbD1cIiM5ZmE4ZGFcIiBmb250LWZhbWlseT1cIm1vbm9zcGFjZVwiIGZvbnQtd2VpZ2h0PVwiYm9sZFwiPiR7c2hvcnR9PC90ZXh0PmA7XG4gICAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgR2F1Z2VTZXR0aW5ncyBidWlsZGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBidWlsZEdhdWdlU2V0dGluZ3ModGFnOiBUYWdFbnRyeSwgd2lkZ2V0SWQ6IHN0cmluZywgcm9sZTogV2lkZ2V0Um9sZSk6IG9iamVjdCB7XG4gICAgY29uc3Qgc3BlYyA9IFJPTEVfU1BFQ1tyb2xlXTtcbiAgICBjb25zdCB2YXJpYWJsZUlkID0gYCR7REVWSUNFfV5+XiR7dGFnLm5hbWV9YDtcblxuICAgIC8vIEJhc2UgcHJvcGVydHlcbiAgICBjb25zdCBwcm9wZXJ0eTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAgIHZhcmlhYmxlSWQsXG4gICAgICAgIHZhcmlhYmxlU3JjOiBERVZJQ0UsXG4gICAgICAgIHZhcmlhYmxlOiB0YWcubmFtZSxcbiAgICAgICAgYWxhcm1JZDogJycsIGFsYXJtU3JjOiAnJywgYWxhcm06ICcnLCBhbGFybUNvbG9yOiAnJyxcbiAgICAgICAgcmFuZ2VzOiBbXSxcbiAgICAgICAgYWN0aW9uczogW10sXG4gICAgICAgIGV2ZW50czogW10sXG4gICAgICAgIG9wdGlvbnM6IHt9LFxuICAgIH07XG5cbiAgICAvLyBSb2xlLXNwZWNpZmljIGJpbmRpbmdzXG4gICAgaWYgKHJvbGUgPT09ICdib29sX2luZGljYXRvcicpIHtcbiAgICAgICAgcHJvcGVydHkucmFuZ2VzID0gW1xuICAgICAgICAgICAgeyB0eXBlOiAncmFuZ2UnLCBtaW46ICcxJywgbWF4OiAnMScsIGNvbG9yOiAnIzAwYjA1MGZmJywgc3Ryb2tlOiAnJyB9LFxuICAgICAgICAgICAgeyB0eXBlOiAncmFuZ2UnLCBtaW46ICcwJywgbWF4OiAnMCcsIGNvbG9yOiAnI2Q4ZDhkOGZmJywgc3Ryb2tlOiAnJyB9LFxuICAgICAgICBdO1xuICAgIH0gZWxzZSBpZiAocm9sZSA9PT0gJ21vdG9yJyB8fCByb2xlID09PSAncHVtcCcpIHtcbiAgICAgICAgcHJvcGVydHkuYWN0aW9ucyA9IFtcbiAgICAgICAgICAgIHsgdmFyaWFibGVJZCwgdmFyaWFibGVTcmM6IERFVklDRSwgdmFyaWFibGU6IHRhZy5uYW1lLFxuICAgICAgICAgICAgICByYW5nZTogeyBtaW46ICcxJywgbWF4OiAnMScgfSwgdHlwZTogJ2Nsb2Nrd2lzZScsIG9wdGlvbnM6IHt9IH0sXG4gICAgICAgICAgICB7IHZhcmlhYmxlSWQsIHZhcmlhYmxlU3JjOiBERVZJQ0UsIHZhcmlhYmxlOiB0YWcubmFtZSxcbiAgICAgICAgICAgICAgcmFuZ2U6IHsgbWluOiAnMCcsIG1heDogJzAnIH0sIHR5cGU6ICdzdG9wJywgb3B0aW9uczoge30gfSxcbiAgICAgICAgXTtcbiAgICAgICAgcHJvcGVydHkucmFuZ2VzID0gW1xuICAgICAgICAgICAgeyB0eXBlOiAncmFuZ2UnLCBtaW46ICcxJywgbWF4OiAnMScsIGNvbG9yOiAnIzAwYjA1MGZmJywgc3Ryb2tlOiAnJyB9LFxuICAgICAgICAgICAgeyB0eXBlOiAncmFuZ2UnLCBtaW46ICcwJywgbWF4OiAnMCcsIGNvbG9yOiAnIzllOWU5ZWZmJywgc3Ryb2tlOiAnJyB9LFxuICAgICAgICBdO1xuICAgIH0gZWxzZSBpZiAocm9sZSA9PT0gJ3ZhbHZlJykge1xuICAgICAgICBwcm9wZXJ0eS5yYW5nZXMgPSBbXG4gICAgICAgICAgICB7IHR5cGU6ICdyYW5nZScsIG1pbjogJzEnLCBtYXg6ICcxJywgY29sb3I6ICcjMDBiMDUwZmYnLCBzdHJva2U6ICcnIH0sXG4gICAgICAgICAgICB7IHR5cGU6ICdyYW5nZScsIG1pbjogJzAnLCBtYXg6ICcwJywgY29sb3I6ICcjZDhkOGQ4ZmYnLCBzdHJva2U6ICcnIH0sXG4gICAgICAgIF07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgaWQ6IHdpZGdldElkLFxuICAgICAgICB0eXBlOiBzcGVjLnR5cGUsXG4gICAgICAgIG5hbWU6IHRhZy5uYW1lLFxuICAgICAgICBsYWJlbDogdGFnLmRlc2NyaXB0aW9uIHx8IHRhZy5uYW1lLFxuICAgICAgICBwcm9wZXJ0eSxcbiAgICB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTWFpbiBBUEkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmFzeW5jIGZ1bmN0aW9uIGFwaUZldGNoKHBhdGg6IHN0cmluZywgbWV0aG9kID0gJ0dFVCcsIGJvZHk/OiB1bmtub3duKSB7XG4gICAgY29uc3Qgb3B0czogUmVxdWVzdEluaXQgPSB7IG1ldGhvZCwgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0gfTtcbiAgICBpZiAoYm9keSAhPT0gdW5kZWZpbmVkKSBvcHRzLmJvZHkgPSBKU09OLnN0cmluZ2lmeShib2R5KTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChGVVhBX0JBU0UgKyBwYXRoLCBvcHRzKTtcbiAgICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBGVVhBICR7bWV0aG9kfSAke3BhdGh9IFx1MjE5MiAke3Jlcy5zdGF0dXN9YCk7XG4gICAgcmV0dXJuIHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gbnVsbCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZUZ1eGFWaWV3Rm9yUE9VKHBvdU5hbWU6IHN0cmluZywgdGFnczogVGFnRW50cnlbXSkge1xuICAgIGlmICghdGFncy5sZW5ndGgpIHJldHVybjtcblxuICAgIGNvbnN0IE1BWF9DT0xTID0gNTtcbiAgICBjb25zdCBDRUxMX1cgPSAyMDA7XG4gICAgY29uc3QgQ0VMTF9IID0gMjAwO1xuICAgIGNvbnN0IE1BUkdJTl9YID0gNDA7XG4gICAgY29uc3QgTUFSR0lOX1kgPSA4MDtcblxuICAgIC8vIEJ1aWxkIHdpZGdldCBsYXlvdXRcbiAgICBjb25zdCB3aWRnZXRzOiBBcnJheTx7XG4gICAgICAgIGlkOiBzdHJpbmc7IHdpZGdldElkOiBzdHJpbmc7IHJvbGU6IFdpZGdldFJvbGU7XG4gICAgICAgIHNwZWM6IFdpZGdldFNwZWM7IHRhZzogVGFnRW50cnk7IHg6IG51bWJlcjsgeTogbnVtYmVyO1xuICAgIH0+ID0gW107XG5cbiAgICBsZXQgY29sID0gMCwgcm93ID0gMDtcbiAgICBmb3IgKGNvbnN0IHRhZyBvZiB0YWdzKSB7XG4gICAgICAgIGNvbnN0IHJvbGUgPSBpbmZlclJvbGUodGFnKTtcbiAgICAgICAgY29uc3Qgc3BlYyA9IFJPTEVfU1BFQ1tyb2xlXTtcbiAgICAgICAgY29uc3QgeCA9IE1BUkdJTl9YICsgY29sICogQ0VMTF9XO1xuICAgICAgICBjb25zdCB5ID0gTUFSR0lOX1kgKyByb3cgKiBDRUxMX0g7XG4gICAgICAgIGNvbnN0IHdpZGdldElkID0gYCR7c3BlYy5wcmVmaXh9d2lkZ2V0XyR7dGFnLm5hbWUucmVwbGFjZSgvW15hLXpBLVowLTldL2csICdfJyl9YDtcbiAgICAgICAgd2lkZ2V0cy5wdXNoKHsgaWQ6IGBnXyR7dGFnLm5hbWV9YCwgd2lkZ2V0SWQsIHJvbGUsIHNwZWMsIHRhZywgeCwgeSB9KTtcbiAgICAgICAgY29sKys7XG4gICAgICAgIGlmIChjb2wgPj0gTUFYX0NPTFMpIHsgY29sID0gMDsgcm93Kys7IH1cbiAgICB9XG5cbiAgICBjb25zdCBjYW52YXNXID0gTWF0aC5tYXgoMTIwMCwgKE1hdGgubWluKHRhZ3MubGVuZ3RoLCBNQVhfQ09MUykpICogQ0VMTF9XICsgTUFSR0lOX1ggKiAyKTtcbiAgICBjb25zdCBjYW52YXNIID0gTWF0aC5tYXgoODAwLCAocm93ICsgMSkgKiBDRUxMX0ggKyBNQVJHSU5fWSAqIDIpO1xuXG4gICAgLy8gQnVpbGQgc3ZnY29udGVudCBcdTIwMTQgZWFjaCB3aWRnZXQgaXMgYSA8ZyBpZD1cIldJREdFVF9JRFwiIHR5cGU9XCJGVVhBX1RZUEVcIj4gZWxlbWVudFxuICAgIC8vIHBvc2l0aW9uZWQgd2l0aCBhIHRyYW5zZm9ybS4gRlVYQSByZWFkcyB0eXBlLCBpZCwgYW5kIHRyYW5zZm9ybSB0byByZW5kZXIgY29tcG9uZW50cy5cbiAgICBjb25zdCBnRWxlbWVudHMgPSB3aWRnZXRzLm1hcCh3ID0+IHtcbiAgICAgICAgY29uc3QgaW5uZXIgPSBtYWtlSW5uZXJTdmcody5yb2xlLCB3LnRhZy5uYW1lLCB3LnNwZWMudywgdy5zcGVjLmgpO1xuICAgICAgICByZXR1cm4gYDxnIGlkPVwiJHt3LndpZGdldElkfVwiIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSgke3cueH0sJHt3Lnl9KVwiIHR5cGU9XCIke3cuc3BlYy50eXBlfVwiIG5hbWU9XCIke3cudGFnLm5hbWV9XCIgd2lkdGg9XCIke3cuc3BlYy53fVwiIGhlaWdodD1cIiR7dy5zcGVjLmh9XCI+XFxuJHtpbm5lcn1cXG48L2c+YDtcbiAgICB9KTtcbiAgICBjb25zdCBzdmdjb250ZW50ID0gYDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiIHdpZHRoPVwiJHtjYW52YXNXfVwiIGhlaWdodD1cIiR7Y2FudmFzSH1cIj5cXG4ke2dFbGVtZW50cy5qb2luKCdcXG4nKX1cXG48L3N2Zz5gO1xuXG4gICAgLy8gQnVpbGQgaXRlbXN7fSBcdTIwMTQga2V5ZWQgYnkgd2lkZ2V0IGlkLCBlYWNoIHZhbHVlIGlzIGEgR2F1Z2VTZXR0aW5ncyBvYmplY3RcbiAgICBjb25zdCBpdGVtczogUmVjb3JkPHN0cmluZywgb2JqZWN0PiA9IHt9O1xuICAgIGZvciAoY29uc3QgdyBvZiB3aWRnZXRzKSB7XG4gICAgICAgIGl0ZW1zW3cud2lkZ2V0SWRdID0gYnVpbGRHYXVnZVNldHRpbmdzKHcudGFnLCB3LndpZGdldElkLCB3LnJvbGUpO1xuICAgIH1cblxuICAgIGNvbnN0IHZpZXdJZCA9IGB2aWV3XyR7cG91TmFtZS5yZXBsYWNlKC9bXmEtekEtWjAtOV9dL2csICdfJyl9YDtcbiAgICBjb25zdCB2aWV3ID0ge1xuICAgICAgICBpZDogdmlld0lkLFxuICAgICAgICBuYW1lOiBwb3VOYW1lLFxuICAgICAgICB0eXBlOiAnc3ZnJyxcbiAgICAgICAgcHJvZmlsZTogeyB3aWR0aDogY2FudmFzVywgaGVpZ2h0OiBjYW52YXNILCBia2NvbG9yOiAnI2ZmZmZmZicsIG1hcmdpbjogJzAnIH0sXG4gICAgICAgIHN2Z2NvbnRlbnQsXG4gICAgICAgIGl0ZW1zLFxuICAgIH07XG5cbiAgICB0cnkge1xuICAgICAgICAvLyBDb3JyZWN0IEZVWEEgcGF0dGVybjogR0VUIGZ1bGwgcHJvamVjdCwgbWVyZ2UgdmlldywgUE9TVCBmdWxsIHByb2plY3RcbiAgICAgICAgY29uc3QgcHJvamVjdCA9IGF3YWl0IGFwaUZldGNoKCcvYXBpL3Byb2plY3QnKTtcbiAgICAgICAgaWYgKCFwcm9qZWN0Py5obWkpIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBwcm9qZWN0IHN0cnVjdHVyZSBmcm9tIEZVWEEnKTtcblxuICAgICAgICAvLyBQYXRjaCBia2NvbG9yIG9uIGFsbCBleGlzdGluZyB2aWV3cyAod2hpdGUgYmFja2dyb3VuZClcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocHJvamVjdC5obWkudmlld3MpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHYgb2YgcHJvamVjdC5obWkudmlld3MpIHtcbiAgICAgICAgICAgICAgICBpZiAodi5wcm9maWxlPy5ia2NvbG9yKSB2LnByb2ZpbGUuYmtjb2xvciA9ICcjZmZmZmZmJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFJlcGxhY2Ugb3IgaW5zZXJ0IG91ciB2aWV3XG4gICAgICAgICAgICBjb25zdCBpZHggPSBwcm9qZWN0LmhtaS52aWV3cy5maW5kSW5kZXgoKHY6IGFueSkgPT4gdi5pZCA9PT0gdmlld0lkKTtcbiAgICAgICAgICAgIGlmIChpZHggPj0gMCkgcHJvamVjdC5obWkudmlld3NbaWR4XSA9IHZpZXc7XG4gICAgICAgICAgICBlbHNlIHByb2plY3QuaG1pLnZpZXdzLnB1c2godmlldyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm9qZWN0LmhtaS52aWV3cyA9IFt2aWV3XTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEluamVjdCB0YWcgZW50cmllcyBpbnRvIGRldmljZXNbXCIwXCJdIHNvIGZ1eGFfc2V0X3RhZ192YWx1ZSBjYW4gZmluZCB0aGVtXG4gICAgICAgIGNvbnN0IGRldmljZXMgPSBwcm9qZWN0LmRldmljZXMgPz8ge307XG4gICAgICAgIGNvbnN0IGZ1eGFEZXZpY2UgPSBPYmplY3QudmFsdWVzKGRldmljZXMpLmZpbmQoKGQ6IGFueSkgPT4gZC5uYW1lID09PSBERVZJQ0UgfHwgZC5pZCA9PT0gREVWSUNFKSBhcyBhbnk7XG4gICAgICAgIGlmIChmdXhhRGV2aWNlKSB7XG4gICAgICAgICAgICBpZiAoIWZ1eGFEZXZpY2UudGFncykgZnV4YURldmljZS50YWdzID0ge307XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHcgb2Ygd2lkZ2V0cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGtleSA9IGAke0RFVklDRX1efl4ke3cudGFnLm5hbWV9YDtcbiAgICAgICAgICAgICAgICBpZiAoIWZ1eGFEZXZpY2UudGFnc1trZXldKSB7XG4gICAgICAgICAgICAgICAgICAgIGZ1eGFEZXZpY2UudGFnc1trZXldID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IHcudGFnLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiB3LnRhZy5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogdy50YWcuZGF0YVR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRyZXNzOiBgJHtERVZJQ0V9Xn5eJHt3LnRhZy5uYW1lfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogMCxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBhcGlGZXRjaCgnL2FwaS9wcm9qZWN0JywgJ1BPU1QnLCBwcm9qZWN0KTtcbiAgICAgICAgbG9naWNTdG9yZS5hZGRDb25zb2xlRW50cnkoJ3N1Y2Nlc3MnLFxuICAgICAgICAgICAgYFtGdXhhVmlld10gR2VuZXJhdGVkIEhNSSB2aWV3IFwiJHtwb3VOYW1lfVwiIFx1MjAxNCAke3dpZGdldHMubGVuZ3RofSB3aWRnZXQocykgb24gJHtjYW52YXNXfVx1MDBENyR7Y2FudmFzSH0gY2FudmFzYCk7XG4gICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgIGxvZ2ljU3RvcmUuYWRkQ29uc29sZUVudHJ5KCd3YXJuJywgYFtGdXhhVmlld10gQ291bGQgbm90IHNhdmUgdmlldyB0byBGVVhBOiAke2UubWVzc2FnZX1gKTtcbiAgICB9XG59XG5cbi8vIEF1dG8tZ2VuZXJhdGUgdmlldyBmcm9tIGN1cnJlbnQgdGFnRGF0YWJhc2Ugd2hlbmV2ZXIgY2FsbGVkXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVGdXhhVmlld0Zyb21DdXJyZW50VGFncyhwb3VOYW1lID0gJ21haW4nKSB7XG4gICAgY29uc3QgdGFncyA9IGxvZ2ljU3RvcmUuc3RhdGUudGFnRGF0YWJhc2U7XG4gICAgcmV0dXJuIGdlbmVyYXRlRnV4YVZpZXdGb3JQT1UocG91TmFtZSwgdGFncyk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFPQSxTQUFTLGtCQUFrQjtBQUczQixNQUFNLFlBQVk7QUFDbEIsTUFBTSxTQUFTO0FBTWYsU0FBUyxVQUFVLEtBQTJCO0FBQzFDLFFBQU0sSUFBSSxJQUFJLEtBQUssWUFBWTtBQUMvQixNQUFJLDJCQUEyQixLQUFLLENBQUMsRUFBRyxRQUFPO0FBQy9DLE1BQUksc0JBQXNCLEtBQUssQ0FBQyxFQUFHLFFBQU87QUFDMUMsTUFBSSwrQkFBK0IsS0FBSyxDQUFDLEVBQUcsUUFBTztBQUNuRCxNQUFJLE9BQU8sS0FBSyxDQUFDLEVBQUcsUUFBTztBQUMzQixNQUFJLElBQUksYUFBYSxPQUFRLFFBQU87QUFDcEMsU0FBTztBQUNYO0FBVUEsTUFBTSxZQUE0QztBQUFBLEVBQzlDLE1BQWdCLEVBQUUsTUFBTSx5QkFBOEIsR0FBRyxLQUFLLEdBQUcsS0FBSyxRQUFRLE9BQU87QUFBQSxFQUNyRixPQUFnQixFQUFFLE1BQU0seUJBQThCLEdBQUcsS0FBSyxHQUFHLEtBQUssUUFBUSxPQUFPO0FBQUEsRUFDckYsT0FBZ0IsRUFBRSxNQUFNLDJCQUE4QixHQUFHLEtBQUssR0FBRyxLQUFLLFFBQVEsT0FBTztBQUFBLEVBQ3JGLE1BQWdCLEVBQUUsTUFBTSwrQkFBOEIsR0FBRyxLQUFLLEdBQUcsS0FBSyxRQUFRLE9BQU87QUFBQSxFQUNyRixnQkFBZ0IsRUFBRSxNQUFNLDJCQUE4QixHQUFHLElBQUssR0FBRyxJQUFLLFFBQVEsT0FBTztBQUFBLEVBQ3JGLGdCQUFnQixFQUFFLE1BQU0saUJBQThCLEdBQUcsS0FBSyxHQUFHLElBQUssUUFBUSxPQUFPO0FBQ3pGO0FBTUEsU0FBUyxhQUFhLE1BQWtCLFNBQWlCLEdBQVcsR0FBbUI7QUFDbkYsUUFBTSxRQUFRLFFBQVEsU0FBUyxLQUFLLFFBQVEsTUFBTSxHQUFHLENBQUMsSUFBSSxXQUFNO0FBQ2hFLFVBQVEsTUFBTTtBQUFBLElBQ1YsS0FBSztBQUNELGFBQU87QUFBQTtBQUFBLDhCQUVXLE9BQU87QUFBQTtBQUFBO0FBQUEsOEJBR1AsT0FBTztBQUFBO0FBQUE7QUFBQSx3QkFHYixPQUFPO0FBQUE7QUFBQSxzRUFFdUMsT0FBTztBQUFBLG1FQUNWLE9BQU8scUJBQXFCLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBUXpGLElBQUUsQ0FBQyxRQUFRLElBQUUsQ0FBQyxrR0FBa0csS0FBSztBQUFBLElBRTFILEtBQUs7QUFDRCxhQUFPO0FBQUE7QUFBQSw2QkFFVSxPQUFPO0FBQUE7QUFBQTtBQUFBO0FBQUEscUVBSWlDLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFTL0QsSUFBRSxDQUFDLFFBQVEsSUFBRSxDQUFDLGtHQUFrRyxLQUFLO0FBQUEsSUFFMUgsS0FBSztBQUNELGFBQU87QUFBQTtBQUFBLDZCQUVVLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzREFPa0IsT0FBTztBQUFBLHNEQUNQLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFNaEQsSUFBRSxDQUFDLFFBQVEsSUFBRSxDQUFDLGtHQUFrRyxLQUFLO0FBQUEsSUFFMUgsS0FBSztBQUNELGFBQU87QUFBQTtBQUFBLGdDQUVhLE9BQU87QUFBQTtBQUFBO0FBQUEsaUNBR04sT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSw4REFNc0IsT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsd0VBS0csT0FBTztBQUFBO0FBQUE7QUFBQSxhQUdsRSxJQUFFLENBQUMsUUFBUSxJQUFFLENBQUMsa0dBQWtHLEtBQUs7QUFBQSxJQUUxSCxLQUFLO0FBQ0QsYUFBTztBQUFBO0FBQUEsK0JBRVksT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxtREFNYSxPQUFPO0FBQUE7QUFBQSxvQkFFdEMsSUFBRSxDQUFDLGtHQUFrRyxLQUFLO0FBQUEsSUFFdEg7QUFDSSxhQUFPO0FBQUE7QUFBQSwrQkFFWSxPQUFPO0FBQUE7QUFBQTtBQUFBO0FBQUEsNkJBSVQsSUFBRSxDQUFDLGFBQWEsSUFBRSxDQUFDLDRCQUE0QixPQUFPO0FBQUEsNkJBQ3RELElBQUUsRUFBRSxhQUFhLElBQUUsRUFBRTtBQUFBLCtCQUNuQixJQUFFLEVBQUUsYUFBYSxJQUFFLEVBQUU7QUFBQSxhQUN2QyxJQUFFLENBQUMsUUFBUSxLQUFLLE1BQU0sSUFBRSxDQUFDLElBQUUsQ0FBQztBQUFBLGFBQzVCLElBQUUsQ0FBQyxRQUFRLElBQUUsQ0FBQyxrR0FBa0csS0FBSztBQUFBLEVBQzlIO0FBQ0o7QUFJQSxTQUFTLG1CQUFtQixLQUFlLFVBQWtCLE1BQTBCO0FBQ25GLFFBQU0sT0FBTyxVQUFVLElBQUk7QUFDM0IsUUFBTSxhQUFhLEdBQUcsTUFBTSxNQUFNLElBQUksSUFBSTtBQUcxQyxRQUFNLFdBQW9DO0FBQUEsSUFDdEM7QUFBQSxJQUNBLGFBQWE7QUFBQSxJQUNiLFVBQVUsSUFBSTtBQUFBLElBQ2QsU0FBUztBQUFBLElBQUksVUFBVTtBQUFBLElBQUksT0FBTztBQUFBLElBQUksWUFBWTtBQUFBLElBQ2xELFFBQVEsQ0FBQztBQUFBLElBQ1QsU0FBUyxDQUFDO0FBQUEsSUFDVixRQUFRLENBQUM7QUFBQSxJQUNULFNBQVMsQ0FBQztBQUFBLEVBQ2Q7QUFHQSxNQUFJLFNBQVMsa0JBQWtCO0FBQzNCLGFBQVMsU0FBUztBQUFBLE1BQ2QsRUFBRSxNQUFNLFNBQVMsS0FBSyxLQUFLLEtBQUssS0FBSyxPQUFPLGFBQWEsUUFBUSxHQUFHO0FBQUEsTUFDcEUsRUFBRSxNQUFNLFNBQVMsS0FBSyxLQUFLLEtBQUssS0FBSyxPQUFPLGFBQWEsUUFBUSxHQUFHO0FBQUEsSUFDeEU7QUFBQSxFQUNKLFdBQVcsU0FBUyxXQUFXLFNBQVMsUUFBUTtBQUM1QyxhQUFTLFVBQVU7QUFBQSxNQUNmO0FBQUEsUUFBRTtBQUFBLFFBQVksYUFBYTtBQUFBLFFBQVEsVUFBVSxJQUFJO0FBQUEsUUFDL0MsT0FBTyxFQUFFLEtBQUssS0FBSyxLQUFLLElBQUk7QUFBQSxRQUFHLE1BQU07QUFBQSxRQUFhLFNBQVMsQ0FBQztBQUFBLE1BQUU7QUFBQSxNQUNoRTtBQUFBLFFBQUU7QUFBQSxRQUFZLGFBQWE7QUFBQSxRQUFRLFVBQVUsSUFBSTtBQUFBLFFBQy9DLE9BQU8sRUFBRSxLQUFLLEtBQUssS0FBSyxJQUFJO0FBQUEsUUFBRyxNQUFNO0FBQUEsUUFBUSxTQUFTLENBQUM7QUFBQSxNQUFFO0FBQUEsSUFDL0Q7QUFDQSxhQUFTLFNBQVM7QUFBQSxNQUNkLEVBQUUsTUFBTSxTQUFTLEtBQUssS0FBSyxLQUFLLEtBQUssT0FBTyxhQUFhLFFBQVEsR0FBRztBQUFBLE1BQ3BFLEVBQUUsTUFBTSxTQUFTLEtBQUssS0FBSyxLQUFLLEtBQUssT0FBTyxhQUFhLFFBQVEsR0FBRztBQUFBLElBQ3hFO0FBQUEsRUFDSixXQUFXLFNBQVMsU0FBUztBQUN6QixhQUFTLFNBQVM7QUFBQSxNQUNkLEVBQUUsTUFBTSxTQUFTLEtBQUssS0FBSyxLQUFLLEtBQUssT0FBTyxhQUFhLFFBQVEsR0FBRztBQUFBLE1BQ3BFLEVBQUUsTUFBTSxTQUFTLEtBQUssS0FBSyxLQUFLLEtBQUssT0FBTyxhQUFhLFFBQVEsR0FBRztBQUFBLElBQ3hFO0FBQUEsRUFDSjtBQUVBLFNBQU87QUFBQSxJQUNILElBQUk7QUFBQSxJQUNKLE1BQU0sS0FBSztBQUFBLElBQ1gsTUFBTSxJQUFJO0FBQUEsSUFDVixPQUFPLElBQUksZUFBZSxJQUFJO0FBQUEsSUFDOUI7QUFBQSxFQUNKO0FBQ0o7QUFJQSxlQUFlLFNBQVMsTUFBYyxTQUFTLE9BQU8sTUFBZ0I7QUFDbEUsUUFBTSxPQUFvQixFQUFFLFFBQVEsU0FBUyxFQUFFLGdCQUFnQixtQkFBbUIsRUFBRTtBQUNwRixNQUFJLFNBQVMsT0FBVyxNQUFLLE9BQU8sS0FBSyxVQUFVLElBQUk7QUFDdkQsUUFBTSxNQUFNLE1BQU0sTUFBTSxZQUFZLE1BQU0sSUFBSTtBQUM5QyxNQUFJLENBQUMsSUFBSSxHQUFJLE9BQU0sSUFBSSxNQUFNLFFBQVEsTUFBTSxJQUFJLElBQUksV0FBTSxJQUFJLE1BQU0sRUFBRTtBQUNyRSxTQUFPLElBQUksS0FBSyxFQUFFLE1BQU0sTUFBTSxJQUFJO0FBQ3RDO0FBRUEsZUFBc0IsdUJBQXVCLFNBQWlCLE1BQWtCO0FBQzVFLE1BQUksQ0FBQyxLQUFLLE9BQVE7QUFFbEIsUUFBTSxXQUFXO0FBQ2pCLFFBQU0sU0FBUztBQUNmLFFBQU0sU0FBUztBQUNmLFFBQU0sV0FBVztBQUNqQixRQUFNLFdBQVc7QUFHakIsUUFBTSxVQUdELENBQUM7QUFFTixNQUFJLE1BQU0sR0FBRyxNQUFNO0FBQ25CLGFBQVcsT0FBTyxNQUFNO0FBQ3BCLFVBQU0sT0FBTyxVQUFVLEdBQUc7QUFDMUIsVUFBTSxPQUFPLFVBQVUsSUFBSTtBQUMzQixVQUFNLElBQUksV0FBVyxNQUFNO0FBQzNCLFVBQU0sSUFBSSxXQUFXLE1BQU07QUFDM0IsVUFBTSxXQUFXLEdBQUcsS0FBSyxNQUFNLFVBQVUsSUFBSSxLQUFLLFFBQVEsaUJBQWlCLEdBQUcsQ0FBQztBQUMvRSxZQUFRLEtBQUssRUFBRSxJQUFJLEtBQUssSUFBSSxJQUFJLElBQUksVUFBVSxNQUFNLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQztBQUNyRTtBQUNBLFFBQUksT0FBTyxVQUFVO0FBQUUsWUFBTTtBQUFHO0FBQUEsSUFBTztBQUFBLEVBQzNDO0FBRUEsUUFBTSxVQUFVLEtBQUssSUFBSSxNQUFPLEtBQUssSUFBSSxLQUFLLFFBQVEsUUFBUSxJQUFLLFNBQVMsV0FBVyxDQUFDO0FBQ3hGLFFBQU0sVUFBVSxLQUFLLElBQUksTUFBTSxNQUFNLEtBQUssU0FBUyxXQUFXLENBQUM7QUFJL0QsUUFBTSxZQUFZLFFBQVEsSUFBSSxPQUFLO0FBQy9CLFVBQU0sUUFBUSxhQUFhLEVBQUUsTUFBTSxFQUFFLElBQUksTUFBTSxFQUFFLEtBQUssR0FBRyxFQUFFLEtBQUssQ0FBQztBQUNqRSxXQUFPLFVBQVUsRUFBRSxRQUFRLDBCQUEwQixFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsWUFBWSxFQUFFLEtBQUssSUFBSSxXQUFXLEVBQUUsSUFBSSxJQUFJLFlBQVksRUFBRSxLQUFLLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQztBQUFBLEVBQU8sS0FBSztBQUFBO0FBQUEsRUFDcEssQ0FBQztBQUNELFFBQU0sYUFBYSw2RkFBNkYsT0FBTyxhQUFhLE9BQU87QUFBQSxFQUFPLFVBQVUsS0FBSyxJQUFJLENBQUM7QUFBQTtBQUd0SyxRQUFNLFFBQWdDLENBQUM7QUFDdkMsYUFBVyxLQUFLLFNBQVM7QUFDckIsVUFBTSxFQUFFLFFBQVEsSUFBSSxtQkFBbUIsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUk7QUFBQSxFQUNwRTtBQUVBLFFBQU0sU0FBUyxRQUFRLFFBQVEsUUFBUSxrQkFBa0IsR0FBRyxDQUFDO0FBQzdELFFBQU0sT0FBTztBQUFBLElBQ1QsSUFBSTtBQUFBLElBQ0osTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sU0FBUyxFQUFFLE9BQU8sU0FBUyxRQUFRLFNBQVMsU0FBUyxXQUFXLFFBQVEsSUFBSTtBQUFBLElBQzVFO0FBQUEsSUFDQTtBQUFBLEVBQ0o7QUFFQSxNQUFJO0FBRUEsVUFBTSxVQUFVLE1BQU0sU0FBUyxjQUFjO0FBQzdDLFFBQUksQ0FBQyxTQUFTLElBQUssT0FBTSxJQUFJLE1BQU0sd0NBQXdDO0FBRzNFLFFBQUksTUFBTSxRQUFRLFFBQVEsSUFBSSxLQUFLLEdBQUc7QUFDbEMsaUJBQVcsS0FBSyxRQUFRLElBQUksT0FBTztBQUMvQixZQUFJLEVBQUUsU0FBUyxRQUFTLEdBQUUsUUFBUSxVQUFVO0FBQUEsTUFDaEQ7QUFFQSxZQUFNLE1BQU0sUUFBUSxJQUFJLE1BQU0sVUFBVSxDQUFDLE1BQVcsRUFBRSxPQUFPLE1BQU07QUFDbkUsVUFBSSxPQUFPLEVBQUcsU0FBUSxJQUFJLE1BQU0sR0FBRyxJQUFJO0FBQUEsVUFDbEMsU0FBUSxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQUEsSUFDcEMsT0FBTztBQUNILGNBQVEsSUFBSSxRQUFRLENBQUMsSUFBSTtBQUFBLElBQzdCO0FBR0EsVUFBTSxVQUFVLFFBQVEsV0FBVyxDQUFDO0FBQ3BDLFVBQU0sYUFBYSxPQUFPLE9BQU8sT0FBTyxFQUFFLEtBQUssQ0FBQyxNQUFXLEVBQUUsU0FBUyxVQUFVLEVBQUUsT0FBTyxNQUFNO0FBQy9GLFFBQUksWUFBWTtBQUNaLFVBQUksQ0FBQyxXQUFXLEtBQU0sWUFBVyxPQUFPLENBQUM7QUFDekMsaUJBQVcsS0FBSyxTQUFTO0FBQ3JCLGNBQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxFQUFFLElBQUksSUFBSTtBQUNyQyxZQUFJLENBQUMsV0FBVyxLQUFLLEdBQUcsR0FBRztBQUN2QixxQkFBVyxLQUFLLEdBQUcsSUFBSTtBQUFBLFlBQ25CLElBQUksRUFBRSxJQUFJO0FBQUEsWUFDVixNQUFNLEVBQUUsSUFBSTtBQUFBLFlBQ1osTUFBTSxFQUFFLElBQUk7QUFBQSxZQUNaLFNBQVMsR0FBRyxNQUFNLE1BQU0sRUFBRSxJQUFJLElBQUk7QUFBQSxZQUNsQyxPQUFPO0FBQUEsVUFDWDtBQUFBLFFBQ0o7QUFBQSxNQUNKO0FBQUEsSUFDSjtBQUVBLFVBQU0sU0FBUyxnQkFBZ0IsUUFBUSxPQUFPO0FBQzlDLGVBQVc7QUFBQSxNQUFnQjtBQUFBLE1BQ3ZCLGtDQUFrQyxPQUFPLFlBQU8sUUFBUSxNQUFNLGlCQUFpQixPQUFPLE9BQUksT0FBTztBQUFBLElBQVM7QUFBQSxFQUNsSCxTQUFTLEdBQVE7QUFDYixlQUFXLGdCQUFnQixRQUFRLDJDQUEyQyxFQUFFLE9BQU8sRUFBRTtBQUFBLEVBQzdGO0FBQ0o7QUFHQSxlQUFzQixnQ0FBZ0MsVUFBVSxRQUFRO0FBQ3BFLFFBQU0sT0FBTyxXQUFXLE1BQU07QUFDOUIsU0FBTyx1QkFBdUIsU0FBUyxJQUFJO0FBQy9DOyIsCiAgIm5hbWVzIjogW10KfQo=
