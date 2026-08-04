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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L2Z1eGFWaWV3R2VuZXJhdG9yLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKlxuICogZnV4YVZpZXdHZW5lcmF0b3IgXHUyMDE0IGF1dG8tZ2VuZXJhdGVzIGEgRlVYQSBITUkgdmlldyBmb3IgYSBzZXQgb2YgdGFncy5cbiAqIFByb2R1Y2VzIGEgcHJvcGVyIEZVWEEgdmlldzogc3ZnY29udGVudCB3aXRoIDxnIHR5cGU9XCIuLi5cIj4gZWxlbWVudHNcbiAqICsgaXRlbXN7fSBHYXVnZVNldHRpbmdzIGtleWVkIGJ5IHdpZGdldCBJRC5cbiAqIFVzZXMgdGhlIGNvcnJlY3QgR0VUK1BPU1QgL2FwaS9wcm9qZWN0IHBhdHRlcm4gKG5vIHBlci12aWV3IGVuZHBvaW50cykuXG4gKi9cblxuaW1wb3J0IHsgbG9naWNTdG9yZSB9IGZyb20gJy4vbG9naWNTdG9yZS5qcyc7XG5pbXBvcnQgdHlwZSB7IFRhZ0VudHJ5IH0gZnJvbSAnLi9sb2dpY1N0b3JlLmpzJztcblxuY29uc3QgRlVYQV9CQVNFID0gJ2h0dHA6Ly8xMjcuMC4wLjE6MTg4MSc7XG5jb25zdCBERVZJQ0UgPSAnRnV4YVNlcnZlcic7XG5cbi8vIFx1MjUwMFx1MjUwMCBXaWRnZXQgcm9sZSBoZXVyaXN0aWNzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG50eXBlIFdpZGdldFJvbGUgPSAndGFuaycgfCAnbW90b3InIHwgJ3ZhbHZlJyB8ICdwdW1wJyB8ICdib29sX2luZGljYXRvcicgfCAnbnVtYmVyX2Rpc3BsYXknO1xuXG5mdW5jdGlvbiBpbmZlclJvbGUodGFnOiBUYWdFbnRyeSk6IFdpZGdldFJvbGUge1xuICAgIGNvbnN0IG4gPSB0YWcubmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmICgvbGV2ZWx8dGFua3x2ZXNzZWx8aG9wcGVyLy50ZXN0KG4pKSByZXR1cm4gJ3RhbmsnO1xuICAgIGlmICgvbW90b3J8cnVufHNwZWVkfHJwbS8udGVzdChuKSkgcmV0dXJuICdtb3Rvcic7XG4gICAgaWYgKC92YWx2ZXxvcGVufGNsb3NlfGdhdGV8ZGFtcGVyLy50ZXN0KG4pKSByZXR1cm4gJ3ZhbHZlJztcbiAgICBpZiAoL3B1bXAvLnRlc3QobikpIHJldHVybiAncHVtcCc7XG4gICAgaWYgKHRhZy5kYXRhVHlwZSA9PT0gJ0JPT0wnKSByZXR1cm4gJ2Jvb2xfaW5kaWNhdG9yJztcbiAgICByZXR1cm4gJ251bWJlcl9kaXNwbGF5Jztcbn1cblxuLy8gTWFwIHJvbGUgXHUyMTkyIEZVWEEgdHlwZSBzdHJpbmcgYW5kIHdpZGdldCBkaW1lbnNpb25zXG5pbnRlcmZhY2UgV2lkZ2V0U3BlYyB7XG4gICAgdHlwZTogc3RyaW5nOyAgIC8vIGV4YWN0IEZVWEEgdHlwZSBzdHJpbmcgZm9yIDxnIHR5cGU9XCIuLi5cIj5cbiAgICB3OiBudW1iZXI7XG4gICAgaDogbnVtYmVyO1xuICAgIHByZWZpeDogc3RyaW5nOyAvLyBHYXVnZVNldHRpbmdzIGlkIHByZWZpeFxufVxuXG5jb25zdCBST0xFX1NQRUM6IFJlY29yZDxXaWRnZXRSb2xlLCBXaWRnZXRTcGVjPiA9IHtcbiAgICB0YW5rOiAgICAgICAgICAgeyB0eXBlOiAnc3ZnLWV4dC1wcm9jZW5nLXRhbms0JywgICAgICB3OiAxMTAsIGg6IDE1MCwgcHJlZml4OiAnU0hFXycgfSxcbiAgICBtb3RvcjogICAgICAgICAgeyB0eXBlOiAnc3ZnLWV4dC1wcm9jZW5nLW1vdG9yJywgICAgICB3OiAxMzAsIGg6IDExMCwgcHJlZml4OiAnU0hFXycgfSxcbiAgICB2YWx2ZTogICAgICAgICAgeyB0eXBlOiAnc3ZnLWV4dC1wcm9jZW5nLXZhbHZlY3gnLCAgICB3OiAxMTAsIGg6IDEzMCwgcHJlZml4OiAnU0hFXycgfSxcbiAgICBwdW1wOiAgICAgICAgICAgeyB0eXBlOiAnc3ZnLWV4dC1wcm9jZW5nLXB1bXBjZW50cmkxJyx3OiAxNDAsIGg6IDEyMCwgcHJlZml4OiAnU0hFXycgfSxcbiAgICBib29sX2luZGljYXRvcjogeyB0eXBlOiAnc3ZnLWV4dC1nYXVnZV9zZW1hcGhvcmUnLCAgICB3OiA4MCwgIGg6IDgwLCAgcHJlZml4OiAnR1NFXycgfSxcbiAgICBudW1iZXJfZGlzcGxheTogeyB0eXBlOiAnc3ZnLWV4dC12YWx1ZScsICAgICAgICAgICAgICB3OiAxNDAsIGg6IDYwLCAgcHJlZml4OiAnVkFMXycgfSxcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBTVkcgZ2VvbWV0cnkgcGVyIHJvbGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBUaGVzZSBhcmUgdGhlIGlubmVyIFNWRyBwYXRoL3JlY3QgYm9kaWVzIHRoYXQgZ28gaW5zaWRlIHRoZSA8Zz4gd3JhcHBlci5cbi8vIEZVWEEgYXBwbGllcyBhbmltYXRpb25zIGJ5IHdhbGtpbmcgY2hpbGQgZWxlbWVudHMgb2YgdGhlIDxnPiBub2RlLlxuXG5mdW5jdGlvbiBtYWtlSW5uZXJTdmcocm9sZTogV2lkZ2V0Um9sZSwgdGFnTmFtZTogc3RyaW5nLCB3OiBudW1iZXIsIGg6IG51bWJlcik6IHN0cmluZyB7XG4gICAgY29uc3Qgc2hvcnQgPSB0YWdOYW1lLmxlbmd0aCA+IDEwID8gdGFnTmFtZS5zbGljZSgwLCA5KSArICdcdTIwMjYnIDogdGFnTmFtZTtcbiAgICBzd2l0Y2ggKHJvbGUpIHtcbiAgICAgICAgY2FzZSAndGFuayc6XG4gICAgICAgICAgICByZXR1cm4gYFxuICA8ZGVmcz5cbiAgICA8bGluZWFyR3JhZGllbnQgaWQ9XCJ0a2dfJHt0YWdOYW1lfVwiIHgxPVwiMFwiIHkxPVwiMFwiIHgyPVwiMVwiIHkyPVwiMFwiPlxuICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wLWNvbG9yPVwiIzkwY2FmOVwiLz48c3RvcCBvZmZzZXQ9XCI0MCVcIiBzdG9wLWNvbG9yPVwiI2UzZjJmZFwiLz48c3RvcCBvZmZzZXQ9XCIxMDAlXCIgc3RvcC1jb2xvcj1cIiM2NGI1ZjZcIi8+XG4gICAgPC9saW5lYXJHcmFkaWVudD5cbiAgICA8bGluZWFyR3JhZGllbnQgaWQ9XCJ0a2ZfJHt0YWdOYW1lfVwiIHgxPVwiMFwiIHkxPVwiMFwiIHgyPVwiMVwiIHkyPVwiMFwiPlxuICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wLWNvbG9yPVwiIzE1NjVjMFwiLz48c3RvcCBvZmZzZXQ9XCI1MCVcIiBzdG9wLWNvbG9yPVwiIzFlODhlNVwiLz48c3RvcCBvZmZzZXQ9XCIxMDAlXCIgc3RvcC1jb2xvcj1cIiMwZDQ3YTFcIi8+XG4gICAgPC9saW5lYXJHcmFkaWVudD5cbiAgICA8Y2xpcFBhdGggaWQ9XCJ0a2NfJHt0YWdOYW1lfVwiPjxyZWN0IHg9XCIxM1wiIHk9XCIyMlwiIHdpZHRoPVwiODRcIiBoZWlnaHQ9XCIxMDBcIiByeD1cIjRcIi8+PC9jbGlwUGF0aD5cbiAgPC9kZWZzPlxuICA8cmVjdCB4PVwiMTNcIiB5PVwiMjJcIiB3aWR0aD1cIjg0XCIgaGVpZ2h0PVwiMTAwXCIgcng9XCI2XCIgZmlsbD1cInVybCgjdGtnXyR7dGFnTmFtZX0pXCIgc3Ryb2tlPVwiIzE1NjVjMFwiIHN0cm9rZS13aWR0aD1cIjIuNVwiLz5cbiAgPHJlY3QgeD1cIjE0XCIgeT1cIjY3XCIgd2lkdGg9XCI4MlwiIGhlaWdodD1cIjU0XCIgY2xpcC1wYXRoPVwidXJsKCN0a2NfJHt0YWdOYW1lfSlcIiBmaWxsPVwidXJsKCN0a2ZfJHt0YWdOYW1lfSlcIiBvcGFjaXR5PVwiMC45MlwiLz5cbiAgPGxpbmUgeDE9XCIxM1wiIHkxPVwiNDVcIiB4Mj1cIjIwXCIgeTI9XCI0NVwiIHN0cm9rZT1cIiMxNTY1YzBcIiBzdHJva2Utd2lkdGg9XCIxXCIvPlxuICA8bGluZSB4MT1cIjEzXCIgeTE9XCI2N1wiIHgyPVwiMjBcIiB5Mj1cIjY3XCIgc3Ryb2tlPVwiIzE1NjVjMFwiIHN0cm9rZS13aWR0aD1cIjFcIi8+XG4gIDxsaW5lIHgxPVwiMTNcIiB5MT1cIjg5XCIgeDI9XCIyMFwiIHkyPVwiODlcIiBzdHJva2U9XCIjMTU2NWMwXCIgc3Ryb2tlLXdpZHRoPVwiMVwiLz5cbiAgPHJlY3QgeD1cIjE3XCIgeT1cIjI2XCIgd2lkdGg9XCIxMFwiIGhlaWdodD1cIjkyXCIgcng9XCIzXCIgZmlsbD1cIndoaXRlXCIgb3BhY2l0eT1cIjAuMThcIi8+XG4gIDxlbGxpcHNlIGN4PVwiNTVcIiBjeT1cIjIyXCIgcng9XCI0MlwiIHJ5PVwiMTBcIiBmaWxsPVwiI2JiZGVmYlwiIHN0cm9rZT1cIiMxNTY1YzBcIiBzdHJva2Utd2lkdGg9XCIyXCIvPlxuICA8cmVjdCB4PVwiNTBcIiB5PVwiNFwiIHdpZHRoPVwiMTBcIiBoZWlnaHQ9XCIxOFwiIHJ4PVwiM1wiIGZpbGw9XCIjOTBjYWY5XCIgc3Ryb2tlPVwiIzE1NjVjMFwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPHJlY3QgeD1cIjQ4XCIgeT1cIjEyMlwiIHdpZHRoPVwiMTRcIiBoZWlnaHQ9XCIxMFwiIHJ4PVwiMlwiIGZpbGw9XCIjOTBjYWY5XCIgc3Ryb2tlPVwiIzE1NjVjMFwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPHRleHQgeD1cIiR7dy8yfVwiIHk9XCIke2gtM31cIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIGZvbnQtc2l6ZT1cIjlcIiBmaWxsPVwiIzBkNDdhMVwiIGZvbnQtZmFtaWx5PVwibW9ub3NwYWNlXCIgZm9udC13ZWlnaHQ9XCJib2xkXCI+JHtzaG9ydH08L3RleHQ+YDtcblxuICAgICAgICBjYXNlICdtb3Rvcic6XG4gICAgICAgICAgICByZXR1cm4gYFxuICA8ZGVmcz5cbiAgICA8bGluZWFyR3JhZGllbnQgaWQ9XCJtZ18ke3RhZ05hbWV9XCIgeDE9XCIwXCIgeTE9XCIwXCIgeDI9XCIwXCIgeTI9XCIxXCI+XG4gICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3AtY29sb3I9XCIjZTBlMGUwXCIvPjxzdG9wIG9mZnNldD1cIjUwJVwiIHN0b3AtY29sb3I9XCIjYmRiZGJkXCIvPjxzdG9wIG9mZnNldD1cIjEwMCVcIiBzdG9wLWNvbG9yPVwiIzllOWU5ZVwiLz5cbiAgICA8L2xpbmVhckdyYWRpZW50PlxuICA8L2RlZnM+XG4gIDxyZWN0IHg9XCIxMFwiIHk9XCIyMFwiIHdpZHRoPVwiOTBcIiBoZWlnaHQ9XCI2MFwiIHJ4PVwiMTBcIiBmaWxsPVwidXJsKCNtZ18ke3RhZ05hbWV9KVwiIHN0cm9rZT1cIiM2MTYxNjFcIiBzdHJva2Utd2lkdGg9XCIyXCIvPlxuICA8bGluZSB4MT1cIjI1XCIgeTE9XCIyMFwiIHgyPVwiMjVcIiB5Mj1cIjgwXCIgc3Ryb2tlPVwiIzllOWU5ZVwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPGxpbmUgeDE9XCIzOFwiIHkxPVwiMjBcIiB4Mj1cIjM4XCIgeTI9XCI4MFwiIHN0cm9rZT1cIiM5ZTllOWVcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDxsaW5lIHgxPVwiNTFcIiB5MT1cIjIwXCIgeDI9XCI1MVwiIHkyPVwiODBcIiBzdHJva2U9XCIjOWU5ZTllXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIvPlxuICA8bGluZSB4MT1cIjY0XCIgeTE9XCIyMFwiIHgyPVwiNjRcIiB5Mj1cIjgwXCIgc3Ryb2tlPVwiIzllOWU5ZVwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPGVsbGlwc2UgY3g9XCIxMDBcIiBjeT1cIjUwXCIgcng9XCIxMlwiIHJ5PVwiMzBcIiBmaWxsPVwiI2QwZDBkMFwiIHN0cm9rZT1cIiM2MTYxNjFcIiBzdHJva2Utd2lkdGg9XCIyXCIvPlxuICA8cmVjdCB4PVwiMTA4XCIgeT1cIjQ2XCIgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjhcIiByeD1cIjNcIiBmaWxsPVwiI2JkYmRiZFwiIHN0cm9rZT1cIiM0MjQyNDJcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDx0ZXh0IHg9XCI1NVwiIHk9XCI1NVwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCIgZm9udC1zaXplPVwiMThcIiBmaWxsPVwiIzQyNDI0MlwiIGZvbnQtd2VpZ2h0PVwiYm9sZFwiIG9wYWNpdHk9XCIwLjVcIj5NPC90ZXh0PlxuICA8Y2lyY2xlIGN4PVwiMThcIiBjeT1cIjUwXCIgcj1cIjdcIiBmaWxsPVwiI2VmNTM1MFwiIHN0cm9rZT1cIiNiNzFjMWNcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDx0ZXh0IHg9XCIke3cvMn1cIiB5PVwiJHtoLTJ9XCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIiBmb250LXNpemU9XCI5XCIgZmlsbD1cIiMyMTIxMjFcIiBmb250LWZhbWlseT1cIm1vbm9zcGFjZVwiIGZvbnQtd2VpZ2h0PVwiYm9sZFwiPiR7c2hvcnR9PC90ZXh0PmA7XG5cbiAgICAgICAgY2FzZSAndmFsdmUnOlxuICAgICAgICAgICAgcmV0dXJuIGBcbiAgPGRlZnM+XG4gICAgPGxpbmVhckdyYWRpZW50IGlkPVwidmdfJHt0YWdOYW1lfVwiIHgxPVwiMFwiIHkxPVwiMFwiIHgyPVwiMVwiIHkyPVwiMFwiPlxuICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wLWNvbG9yPVwiI2ZmY2M4MFwiLz48c3RvcCBvZmZzZXQ9XCI1MCVcIiBzdG9wLWNvbG9yPVwiI2ZmZTBiMlwiLz48c3RvcCBvZmZzZXQ9XCIxMDAlXCIgc3RvcC1jb2xvcj1cIiNmZmI3NGRcIi8+XG4gICAgPC9saW5lYXJHcmFkaWVudD5cbiAgPC9kZWZzPlxuICA8cmVjdCB4PVwiMFwiIHk9XCI0MlwiIHdpZHRoPVwiMjJcIiBoZWlnaHQ9XCIyNlwiIHJ4PVwiMlwiIGZpbGw9XCIjYmRiZGJkXCIgc3Ryb2tlPVwiIzc1NzU3NVwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPHJlY3QgeD1cIjg4XCIgeT1cIjQyXCIgd2lkdGg9XCIyMlwiIGhlaWdodD1cIjI2XCIgcng9XCIyXCIgZmlsbD1cIiNiZGJkYmRcIiBzdHJva2U9XCIjNzU3NTc1XCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIvPlxuICA8cG9seWdvbiBwb2ludHM9XCIyMiw0MiA4OCw0MiA4OCw2OCAyMiw2OFwiIGZpbGw9XCIjZmZlMGIyXCIgc3Ryb2tlPVwiI2U2NTEwMFwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPHBvbHlnb24gcG9pbnRzPVwiMjIsNDIgNTUsNTUgMjIsNjhcIiBmaWxsPVwidXJsKCN2Z18ke3RhZ05hbWV9KVwiIHN0cm9rZT1cIiNlNjUxMDBcIiBzdHJva2Utd2lkdGg9XCIyXCIvPlxuICA8cG9seWdvbiBwb2ludHM9XCI4OCw0MiA1NSw1NSA4OCw2OFwiIGZpbGw9XCJ1cmwoI3ZnXyR7dGFnTmFtZX0pXCIgc3Ryb2tlPVwiI2U2NTEwMFwiIHN0cm9rZS13aWR0aD1cIjJcIi8+XG4gIDxyZWN0IHg9XCI1MVwiIHk9XCIxMFwiIHdpZHRoPVwiOFwiIGhlaWdodD1cIjMyXCIgcng9XCIyXCIgZmlsbD1cIiNiZGJkYmRcIiBzdHJva2U9XCIjNzU3NTc1XCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIvPlxuICA8cmVjdCB4PVwiNDZcIiB5PVwiMzZcIiB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMTBcIiByeD1cIjNcIiBmaWxsPVwiIzllOWU5ZVwiIHN0cm9rZT1cIiM2MTYxNjFcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDxjaXJjbGUgY3g9XCI1NVwiIGN5PVwiOFwiIHI9XCIxNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiIzQyNDI0MlwiIHN0cm9rZS13aWR0aD1cIjNcIi8+XG4gIDxjaXJjbGUgY3g9XCI1NVwiIGN5PVwiOFwiIHI9XCI0XCIgZmlsbD1cIiM2MTYxNjFcIi8+XG4gIDxjaXJjbGUgY3g9XCI1NVwiIGN5PVwiNTVcIiByPVwiN1wiIGZpbGw9XCIjZWY1MzUwXCIgc3Ryb2tlPVwiI2I3MWMxY1wiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPHRleHQgeD1cIiR7dy8yfVwiIHk9XCIke2gtM31cIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIGZvbnQtc2l6ZT1cIjlcIiBmaWxsPVwiI2JmMzYwY1wiIGZvbnQtZmFtaWx5PVwibW9ub3NwYWNlXCIgZm9udC13ZWlnaHQ9XCJib2xkXCI+JHtzaG9ydH08L3RleHQ+YDtcblxuICAgICAgICBjYXNlICdwdW1wJzpcbiAgICAgICAgICAgIHJldHVybiBgXG4gIDxkZWZzPlxuICAgIDxyYWRpYWxHcmFkaWVudCBpZD1cInB1bXBnXyR7dGFnTmFtZX1cIiBjeD1cIjQ1JVwiIGN5PVwiNDUlXCI+XG4gICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3AtY29sb3I9XCIjZTFiZWU3XCIvPjxzdG9wIG9mZnNldD1cIjEwMCVcIiBzdG9wLWNvbG9yPVwiIzljMjdiMFwiLz5cbiAgICA8L3JhZGlhbEdyYWRpZW50PlxuICAgIDxsaW5lYXJHcmFkaWVudCBpZD1cInB1bXBtZ18ke3RhZ05hbWV9XCIgeDE9XCIwXCIgeTE9XCIwXCIgeDI9XCIwXCIgeTI9XCIxXCI+XG4gICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3AtY29sb3I9XCIjZTBlMGUwXCIvPjxzdG9wIG9mZnNldD1cIjEwMCVcIiBzdG9wLWNvbG9yPVwiIzllOWU5ZVwiLz5cbiAgICA8L2xpbmVhckdyYWRpZW50PlxuICA8L2RlZnM+XG4gIDxyZWN0IHg9XCI1N1wiIHk9XCIwXCIgd2lkdGg9XCIxNlwiIGhlaWdodD1cIjIyXCIgcng9XCIyXCIgZmlsbD1cIiNjZTkzZDhcIiBzdHJva2U9XCIjNmExYjlhXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIvPlxuICA8cmVjdCB4PVwiMFwiIHk9XCI0N1wiIHdpZHRoPVwiMjBcIiBoZWlnaHQ9XCIxNlwiIHJ4PVwiMlwiIGZpbGw9XCIjY2U5M2Q4XCIgc3Ryb2tlPVwiIzZhMWI5YVwiIHN0cm9rZS13aWR0aD1cIjEuNVwiLz5cbiAgPGVsbGlwc2UgY3g9XCI1NVwiIGN5PVwiNThcIiByeD1cIjM1XCIgcnk9XCIzNVwiIGZpbGw9XCJ1cmwoI3B1bXBnXyR7dGFnTmFtZX0pXCIgc3Ryb2tlPVwiIzZhMWI5YVwiIHN0cm9rZS13aWR0aD1cIjIuNVwiLz5cbiAgPGxpbmUgeDE9XCI1NVwiIHkxPVwiMzVcIiB4Mj1cIjU1XCIgeTI9XCI4MVwiIHN0cm9rZT1cIiM3YjFmYTJcIiBzdHJva2Utd2lkdGg9XCIyXCIgb3BhY2l0eT1cIjAuN1wiLz5cbiAgPGxpbmUgeDE9XCIzMlwiIHkxPVwiNDVcIiB4Mj1cIjc4XCIgeTI9XCI3MVwiIHN0cm9rZT1cIiM3YjFmYTJcIiBzdHJva2Utd2lkdGg9XCIyXCIgb3BhY2l0eT1cIjAuN1wiLz5cbiAgPGxpbmUgeDE9XCIzMlwiIHkxPVwiNzFcIiB4Mj1cIjc4XCIgeTI9XCI0NVwiIHN0cm9rZT1cIiM3YjFmYTJcIiBzdHJva2Utd2lkdGg9XCIyXCIgb3BhY2l0eT1cIjAuN1wiLz5cbiAgPGNpcmNsZSBjeD1cIjU1XCIgY3k9XCI1OFwiIHI9XCI4XCIgZmlsbD1cIiM0YTE0OGNcIiBzdHJva2U9XCIjN2IxZmEyXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIvPlxuICA8cmVjdCB4PVwiOThcIiB5PVwiNDRcIiB3aWR0aD1cIjM4XCIgaGVpZ2h0PVwiMjhcIiByeD1cIjZcIiBmaWxsPVwidXJsKCNwdW1wbWdfJHt0YWdOYW1lfSlcIiBzdHJva2U9XCIjNjE2MTYxXCIgc3Ryb2tlLXdpZHRoPVwiMlwiLz5cbiAgPHRleHQgeD1cIjExN1wiIHk9XCI2MVwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCIgZm9udC1zaXplPVwiMTBcIiBmaWxsPVwiIzQyNDI0MlwiIGZvbnQtd2VpZ2h0PVwiYm9sZFwiIG9wYWNpdHk9XCIwLjZcIj5NPC90ZXh0PlxuICA8Y2lyY2xlIGN4PVwiMTAwXCIgY3k9XCI0OFwiIHI9XCI2XCIgZmlsbD1cIiNlZjUzNTBcIiBzdHJva2U9XCIjYjcxYzFjXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIvPlxuICA8dGV4dCB4PVwiJHt3LzJ9XCIgeT1cIiR7aC0yfVwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCIgZm9udC1zaXplPVwiOVwiIGZpbGw9XCIjNGExNDhjXCIgZm9udC1mYW1pbHk9XCJtb25vc3BhY2VcIiBmb250LXdlaWdodD1cImJvbGRcIj4ke3Nob3J0fTwvdGV4dD5gO1xuXG4gICAgICAgIGNhc2UgJ2Jvb2xfaW5kaWNhdG9yJzpcbiAgICAgICAgICAgIHJldHVybiBgXG4gIDxkZWZzPlxuICAgIDxyYWRpYWxHcmFkaWVudCBpZD1cImxlZGdfJHt0YWdOYW1lfVwiIGN4PVwiMzglXCIgY3k9XCIzOCVcIj5cbiAgICAgIDxzdG9wIG9mZnNldD1cIjAlXCIgc3RvcC1jb2xvcj1cIiNlZjlhOWFcIi8+PHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3AtY29sb3I9XCIjYzYyODI4XCIvPlxuICAgIDwvcmFkaWFsR3JhZGllbnQ+XG4gIDwvZGVmcz5cbiAgPHJlY3QgeD1cIjNcIiB5PVwiM1wiIHdpZHRoPVwiNzRcIiBoZWlnaHQ9XCI3NFwiIHJ4PVwiOFwiIGZpbGw9XCIjZWVlZWVlXCIgc3Ryb2tlPVwiI2JkYmRiZFwiIHN0cm9rZS13aWR0aD1cIjJcIi8+XG4gIDxjaXJjbGUgY3g9XCI0MFwiIGN5PVwiMzVcIiByPVwiMjJcIiBmaWxsPVwiI2JkYmRiZFwiIHN0cm9rZT1cIiM5ZTllOWVcIiBzdHJva2Utd2lkdGg9XCIxLjVcIi8+XG4gIDxjaXJjbGUgY3g9XCI0MFwiIGN5PVwiMzVcIiByPVwiMTVcIiBmaWxsPVwidXJsKCNsZWRnXyR7dGFnTmFtZX0pXCIvPlxuICA8ZWxsaXBzZSBjeD1cIjMzXCIgY3k9XCIyOFwiIHJ4PVwiNVwiIHJ5PVwiM1wiIGZpbGw9XCJ3aGl0ZVwiIG9wYWNpdHk9XCIwLjRcIiB0cmFuc2Zvcm09XCJyb3RhdGUoLTIwIDMzIDI4KVwiLz5cbiAgPHRleHQgeD1cIjQwXCIgeT1cIiR7aC0zfVwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCIgZm9udC1zaXplPVwiOFwiIGZpbGw9XCIjMjEyMTIxXCIgZm9udC1mYW1pbHk9XCJtb25vc3BhY2VcIiBmb250LXdlaWdodD1cImJvbGRcIj4ke3Nob3J0fTwvdGV4dD5gO1xuXG4gICAgICAgIGRlZmF1bHQ6IC8vIG51bWJlcl9kaXNwbGF5XG4gICAgICAgICAgICByZXR1cm4gYFxuICA8ZGVmcz5cbiAgICA8bGluZWFyR3JhZGllbnQgaWQ9XCJkc3BnXyR7dGFnTmFtZX1cIiB4MT1cIjBcIiB5MT1cIjBcIiB4Mj1cIjBcIiB5Mj1cIjFcIj5cbiAgICAgIDxzdG9wIG9mZnNldD1cIjAlXCIgc3RvcC1jb2xvcj1cIiNlOGVhZjZcIi8+PHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3AtY29sb3I9XCIjYzVjYWU5XCIvPlxuICAgIDwvbGluZWFyR3JhZGllbnQ+XG4gIDwvZGVmcz5cbiAgPHJlY3QgeD1cIjJcIiB5PVwiMlwiIHdpZHRoPVwiJHt3LTR9XCIgaGVpZ2h0PVwiJHtoLTR9XCIgcng9XCI4XCIgZmlsbD1cInVybCgjZHNwZ18ke3RhZ05hbWV9KVwiIHN0cm9rZT1cIiMzOTQ5YWJcIiBzdHJva2Utd2lkdGg9XCIyLjVcIi8+XG4gIDxyZWN0IHg9XCI4XCIgeT1cIjhcIiB3aWR0aD1cIiR7dy0xNn1cIiBoZWlnaHQ9XCIke2gtMjB9XCIgcng9XCI1XCIgZmlsbD1cIiMxYTIzN2VcIiBzdHJva2U9XCIjMzk0OWFiXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIvPlxuICA8cmVjdCB4PVwiMTJcIiB5PVwiMTJcIiB3aWR0aD1cIiR7dy0yNH1cIiBoZWlnaHQ9XCIke2gtMzJ9XCIgcng9XCIzXCIgZmlsbD1cIiMwZDFiMGRcIi8+XG4gIDx0ZXh0IHg9XCIke3cvMn1cIiB5PVwiJHtNYXRoLmZsb29yKGgvMikrNn1cIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIGZvbnQtc2l6ZT1cIjIwXCIgZmlsbD1cIiMwMGU2NzZcIiBmb250LWZhbWlseT1cIidDb3VyaWVyIE5ldycsbW9ub3NwYWNlXCIgZm9udC13ZWlnaHQ9XCJib2xkXCIgbGV0dGVyLXNwYWNpbmc9XCIyXCI+MC4wMDwvdGV4dD5cbiAgPHRleHQgeD1cIiR7dy8yfVwiIHk9XCIke2gtNH1cIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIGZvbnQtc2l6ZT1cIjhcIiBmaWxsPVwiIzlmYThkYVwiIGZvbnQtZmFtaWx5PVwibW9ub3NwYWNlXCIgZm9udC13ZWlnaHQ9XCJib2xkXCI+JHtzaG9ydH08L3RleHQ+YDtcbiAgICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBHYXVnZVNldHRpbmdzIGJ1aWxkZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGJ1aWxkR2F1Z2VTZXR0aW5ncyh0YWc6IFRhZ0VudHJ5LCB3aWRnZXRJZDogc3RyaW5nLCByb2xlOiBXaWRnZXRSb2xlKTogb2JqZWN0IHtcbiAgICBjb25zdCBzcGVjID0gUk9MRV9TUEVDW3JvbGVdO1xuICAgIGNvbnN0IHZhcmlhYmxlSWQgPSBgJHtERVZJQ0V9Xn5eJHt0YWcubmFtZX1gO1xuXG4gICAgLy8gQmFzZSBwcm9wZXJ0eVxuICAgIGNvbnN0IHByb3BlcnR5OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICAgdmFyaWFibGVJZCxcbiAgICAgICAgdmFyaWFibGVTcmM6IERFVklDRSxcbiAgICAgICAgdmFyaWFibGU6IHRhZy5uYW1lLFxuICAgICAgICBhbGFybUlkOiAnJywgYWxhcm1TcmM6ICcnLCBhbGFybTogJycsIGFsYXJtQ29sb3I6ICcnLFxuICAgICAgICByYW5nZXM6IFtdLFxuICAgICAgICBhY3Rpb25zOiBbXSxcbiAgICAgICAgZXZlbnRzOiBbXSxcbiAgICAgICAgb3B0aW9uczoge30sXG4gICAgfTtcblxuICAgIC8vIFJvbGUtc3BlY2lmaWMgYmluZGluZ3NcbiAgICBpZiAocm9sZSA9PT0gJ2Jvb2xfaW5kaWNhdG9yJykge1xuICAgICAgICBwcm9wZXJ0eS5yYW5nZXMgPSBbXG4gICAgICAgICAgICB7IHR5cGU6ICdyYW5nZScsIG1pbjogJzEnLCBtYXg6ICcxJywgY29sb3I6ICcjMDBiMDUwZmYnLCBzdHJva2U6ICcnIH0sXG4gICAgICAgICAgICB7IHR5cGU6ICdyYW5nZScsIG1pbjogJzAnLCBtYXg6ICcwJywgY29sb3I6ICcjZDhkOGQ4ZmYnLCBzdHJva2U6ICcnIH0sXG4gICAgICAgIF07XG4gICAgfSBlbHNlIGlmIChyb2xlID09PSAnbW90b3InIHx8IHJvbGUgPT09ICdwdW1wJykge1xuICAgICAgICBwcm9wZXJ0eS5hY3Rpb25zID0gW1xuICAgICAgICAgICAgeyB2YXJpYWJsZUlkLCB2YXJpYWJsZVNyYzogREVWSUNFLCB2YXJpYWJsZTogdGFnLm5hbWUsXG4gICAgICAgICAgICAgIHJhbmdlOiB7IG1pbjogJzEnLCBtYXg6ICcxJyB9LCB0eXBlOiAnY2xvY2t3aXNlJywgb3B0aW9uczoge30gfSxcbiAgICAgICAgICAgIHsgdmFyaWFibGVJZCwgdmFyaWFibGVTcmM6IERFVklDRSwgdmFyaWFibGU6IHRhZy5uYW1lLFxuICAgICAgICAgICAgICByYW5nZTogeyBtaW46ICcwJywgbWF4OiAnMCcgfSwgdHlwZTogJ3N0b3AnLCBvcHRpb25zOiB7fSB9LFxuICAgICAgICBdO1xuICAgICAgICBwcm9wZXJ0eS5yYW5nZXMgPSBbXG4gICAgICAgICAgICB7IHR5cGU6ICdyYW5nZScsIG1pbjogJzEnLCBtYXg6ICcxJywgY29sb3I6ICcjMDBiMDUwZmYnLCBzdHJva2U6ICcnIH0sXG4gICAgICAgICAgICB7IHR5cGU6ICdyYW5nZScsIG1pbjogJzAnLCBtYXg6ICcwJywgY29sb3I6ICcjOWU5ZTllZmYnLCBzdHJva2U6ICcnIH0sXG4gICAgICAgIF07XG4gICAgfSBlbHNlIGlmIChyb2xlID09PSAndmFsdmUnKSB7XG4gICAgICAgIHByb3BlcnR5LnJhbmdlcyA9IFtcbiAgICAgICAgICAgIHsgdHlwZTogJ3JhbmdlJywgbWluOiAnMScsIG1heDogJzEnLCBjb2xvcjogJyMwMGIwNTBmZicsIHN0cm9rZTogJycgfSxcbiAgICAgICAgICAgIHsgdHlwZTogJ3JhbmdlJywgbWluOiAnMCcsIG1heDogJzAnLCBjb2xvcjogJyNkOGQ4ZDhmZicsIHN0cm9rZTogJycgfSxcbiAgICAgICAgXTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBpZDogd2lkZ2V0SWQsXG4gICAgICAgIHR5cGU6IHNwZWMudHlwZSxcbiAgICAgICAgbmFtZTogdGFnLm5hbWUsXG4gICAgICAgIGxhYmVsOiB0YWcuZGVzY3JpcHRpb24gfHwgdGFnLm5hbWUsXG4gICAgICAgIHByb3BlcnR5LFxuICAgIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBNYWluIEFQSSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuYXN5bmMgZnVuY3Rpb24gYXBpRmV0Y2gocGF0aDogc3RyaW5nLCBtZXRob2QgPSAnR0VUJywgYm9keT86IHVua25vd24pIHtcbiAgICBjb25zdCBvcHRzOiBSZXF1ZXN0SW5pdCA9IHsgbWV0aG9kLCBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSB9O1xuICAgIGlmIChib2R5ICE9PSB1bmRlZmluZWQpIG9wdHMuYm9keSA9IEpTT04uc3RyaW5naWZ5KGJvZHkpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKEZVWEFfQkFTRSArIHBhdGgsIG9wdHMpO1xuICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYEZVWEEgJHttZXRob2R9ICR7cGF0aH0gXHUyMTkyICR7cmVzLnN0YXR1c31gKTtcbiAgICByZXR1cm4gcmVzLmpzb24oKS5jYXRjaCgoKSA9PiBudWxsKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlRnV4YVZpZXdGb3JQT1UocG91TmFtZTogc3RyaW5nLCB0YWdzOiBUYWdFbnRyeVtdKSB7XG4gICAgaWYgKCF0YWdzLmxlbmd0aCkgcmV0dXJuO1xuXG4gICAgY29uc3QgTUFYX0NPTFMgPSA1O1xuICAgIGNvbnN0IENFTExfVyA9IDIwMDtcbiAgICBjb25zdCBDRUxMX0ggPSAyMDA7XG4gICAgY29uc3QgTUFSR0lOX1ggPSA0MDtcbiAgICBjb25zdCBNQVJHSU5fWSA9IDgwO1xuXG4gICAgLy8gQnVpbGQgd2lkZ2V0IGxheW91dFxuICAgIGNvbnN0IHdpZGdldHM6IEFycmF5PHtcbiAgICAgICAgaWQ6IHN0cmluZzsgd2lkZ2V0SWQ6IHN0cmluZzsgcm9sZTogV2lkZ2V0Um9sZTtcbiAgICAgICAgc3BlYzogV2lkZ2V0U3BlYzsgdGFnOiBUYWdFbnRyeTsgeDogbnVtYmVyOyB5OiBudW1iZXI7XG4gICAgfT4gPSBbXTtcblxuICAgIGxldCBjb2wgPSAwLCByb3cgPSAwO1xuICAgIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpIHtcbiAgICAgICAgY29uc3Qgcm9sZSA9IGluZmVyUm9sZSh0YWcpO1xuICAgICAgICBjb25zdCBzcGVjID0gUk9MRV9TUEVDW3JvbGVdO1xuICAgICAgICBjb25zdCB4ID0gTUFSR0lOX1ggKyBjb2wgKiBDRUxMX1c7XG4gICAgICAgIGNvbnN0IHkgPSBNQVJHSU5fWSArIHJvdyAqIENFTExfSDtcbiAgICAgICAgY29uc3Qgd2lkZ2V0SWQgPSBgJHtzcGVjLnByZWZpeH13aWRnZXRfJHt0YWcubmFtZS5yZXBsYWNlKC9bXmEtekEtWjAtOV0vZywgJ18nKX1gO1xuICAgICAgICB3aWRnZXRzLnB1c2goeyBpZDogYGdfJHt0YWcubmFtZX1gLCB3aWRnZXRJZCwgcm9sZSwgc3BlYywgdGFnLCB4LCB5IH0pO1xuICAgICAgICBjb2wrKztcbiAgICAgICAgaWYgKGNvbCA+PSBNQVhfQ09MUykgeyBjb2wgPSAwOyByb3crKzsgfVxuICAgIH1cblxuICAgIGNvbnN0IGNhbnZhc1cgPSBNYXRoLm1heCgxMjAwLCAoTWF0aC5taW4odGFncy5sZW5ndGgsIE1BWF9DT0xTKSkgKiBDRUxMX1cgKyBNQVJHSU5fWCAqIDIpO1xuICAgIGNvbnN0IGNhbnZhc0ggPSBNYXRoLm1heCg4MDAsIChyb3cgKyAxKSAqIENFTExfSCArIE1BUkdJTl9ZICogMik7XG5cbiAgICAvLyBCdWlsZCBzdmdjb250ZW50IFx1MjAxNCBlYWNoIHdpZGdldCBpcyBhIDxnIGlkPVwiV0lER0VUX0lEXCIgdHlwZT1cIkZVWEFfVFlQRVwiPiBlbGVtZW50XG4gICAgLy8gcG9zaXRpb25lZCB3aXRoIGEgdHJhbnNmb3JtLiBGVVhBIHJlYWRzIHR5cGUsIGlkLCBhbmQgdHJhbnNmb3JtIHRvIHJlbmRlciBjb21wb25lbnRzLlxuICAgIGNvbnN0IGdFbGVtZW50cyA9IHdpZGdldHMubWFwKHcgPT4ge1xuICAgICAgICBjb25zdCBpbm5lciA9IG1ha2VJbm5lclN2Zyh3LnJvbGUsIHcudGFnLm5hbWUsIHcuc3BlYy53LCB3LnNwZWMuaCk7XG4gICAgICAgIHJldHVybiBgPGcgaWQ9XCIke3cud2lkZ2V0SWR9XCIgdHJhbnNmb3JtPVwidHJhbnNsYXRlKCR7dy54fSwke3cueX0pXCIgdHlwZT1cIiR7dy5zcGVjLnR5cGV9XCIgbmFtZT1cIiR7dy50YWcubmFtZX1cIiB3aWR0aD1cIiR7dy5zcGVjLnd9XCIgaGVpZ2h0PVwiJHt3LnNwZWMuaH1cIj5cXG4ke2lubmVyfVxcbjwvZz5gO1xuICAgIH0pO1xuICAgIGNvbnN0IHN2Z2NvbnRlbnQgPSBgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCIgd2lkdGg9XCIke2NhbnZhc1d9XCIgaGVpZ2h0PVwiJHtjYW52YXNIfVwiPlxcbiR7Z0VsZW1lbnRzLmpvaW4oJ1xcbicpfVxcbjwvc3ZnPmA7XG5cbiAgICAvLyBCdWlsZCBpdGVtc3t9IFx1MjAxNCBrZXllZCBieSB3aWRnZXQgaWQsIGVhY2ggdmFsdWUgaXMgYSBHYXVnZVNldHRpbmdzIG9iamVjdFxuICAgIGNvbnN0IGl0ZW1zOiBSZWNvcmQ8c3RyaW5nLCBvYmplY3Q+ID0ge307XG4gICAgZm9yIChjb25zdCB3IG9mIHdpZGdldHMpIHtcbiAgICAgICAgaXRlbXNbdy53aWRnZXRJZF0gPSBidWlsZEdhdWdlU2V0dGluZ3Mody50YWcsIHcud2lkZ2V0SWQsIHcucm9sZSk7XG4gICAgfVxuXG4gICAgY29uc3Qgdmlld0lkID0gYHZpZXdfJHtwb3VOYW1lLnJlcGxhY2UoL1teYS16QS1aMC05X10vZywgJ18nKX1gO1xuICAgIGNvbnN0IHZpZXcgPSB7XG4gICAgICAgIGlkOiB2aWV3SWQsXG4gICAgICAgIG5hbWU6IHBvdU5hbWUsXG4gICAgICAgIHR5cGU6ICdzdmcnLFxuICAgICAgICBwcm9maWxlOiB7IHdpZHRoOiBjYW52YXNXLCBoZWlnaHQ6IGNhbnZhc0gsIGJrY29sb3I6ICcjZmZmZmZmJywgbWFyZ2luOiAnMCcgfSxcbiAgICAgICAgc3ZnY29udGVudCxcbiAgICAgICAgaXRlbXMsXG4gICAgfTtcblxuICAgIHRyeSB7XG4gICAgICAgIC8vIENvcnJlY3QgRlVYQSBwYXR0ZXJuOiBHRVQgZnVsbCBwcm9qZWN0LCBtZXJnZSB2aWV3LCBQT1NUIGZ1bGwgcHJvamVjdFxuICAgICAgICBjb25zdCBwcm9qZWN0ID0gYXdhaXQgYXBpRmV0Y2goJy9hcGkvcHJvamVjdCcpO1xuICAgICAgICBpZiAoIXByb2plY3Q/LmhtaSkgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHByb2plY3Qgc3RydWN0dXJlIGZyb20gRlVYQScpO1xuXG4gICAgICAgIC8vIFBhdGNoIGJrY29sb3Igb24gYWxsIGV4aXN0aW5nIHZpZXdzICh3aGl0ZSBiYWNrZ3JvdW5kKVxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwcm9qZWN0LmhtaS52aWV3cykpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdiBvZiBwcm9qZWN0LmhtaS52aWV3cykge1xuICAgICAgICAgICAgICAgIGlmICh2LnByb2ZpbGU/LmJrY29sb3IpIHYucHJvZmlsZS5ia2NvbG9yID0gJyNmZmZmZmYnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gUmVwbGFjZSBvciBpbnNlcnQgb3VyIHZpZXdcbiAgICAgICAgICAgIGNvbnN0IGlkeCA9IHByb2plY3QuaG1pLnZpZXdzLmZpbmRJbmRleCgodjogYW55KSA9PiB2LmlkID09PSB2aWV3SWQpO1xuICAgICAgICAgICAgaWYgKGlkeCA+PSAwKSBwcm9qZWN0LmhtaS52aWV3c1tpZHhdID0gdmlldztcbiAgICAgICAgICAgIGVsc2UgcHJvamVjdC5obWkudmlld3MucHVzaCh2aWV3KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb2plY3QuaG1pLnZpZXdzID0gW3ZpZXddO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSW5qZWN0IHRhZyBlbnRyaWVzIGludG8gZGV2aWNlc1tcIjBcIl0gc28gZnV4YV9zZXRfdGFnX3ZhbHVlIGNhbiBmaW5kIHRoZW1cbiAgICAgICAgY29uc3QgZGV2aWNlcyA9IHByb2plY3QuZGV2aWNlcyA/PyB7fTtcbiAgICAgICAgY29uc3QgZnV4YURldmljZSA9IE9iamVjdC52YWx1ZXMoZGV2aWNlcykuZmluZCgoZDogYW55KSA9PiBkLm5hbWUgPT09IERFVklDRSB8fCBkLmlkID09PSBERVZJQ0UpIGFzIGFueTtcbiAgICAgICAgaWYgKGZ1eGFEZXZpY2UpIHtcbiAgICAgICAgICAgIGlmICghZnV4YURldmljZS50YWdzKSBmdXhhRGV2aWNlLnRhZ3MgPSB7fTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdyBvZiB3aWRnZXRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qga2V5ID0gYCR7REVWSUNFfV5+XiR7dy50YWcubmFtZX1gO1xuICAgICAgICAgICAgICAgIGlmICghZnV4YURldmljZS50YWdzW2tleV0pIHtcbiAgICAgICAgICAgICAgICAgICAgZnV4YURldmljZS50YWdzW2tleV0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogdy50YWcubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHcudGFnLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiB3LnRhZy5kYXRhVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZHJlc3M6IGAke0RFVklDRX1efl4ke3cudGFnLm5hbWV9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiAwLFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IGFwaUZldGNoKCcvYXBpL3Byb2plY3QnLCAnUE9TVCcsIHByb2plY3QpO1xuICAgICAgICBsb2dpY1N0b3JlLmFkZENvbnNvbGVFbnRyeSgnc3VjY2VzcycsXG4gICAgICAgICAgICBgW0Z1eGFWaWV3XSBHZW5lcmF0ZWQgSE1JIHZpZXcgXCIke3BvdU5hbWV9XCIgXHUyMDE0ICR7d2lkZ2V0cy5sZW5ndGh9IHdpZGdldChzKSBvbiAke2NhbnZhc1d9XHUwMEQ3JHtjYW52YXNIfSBjYW52YXNgKTtcbiAgICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICAgICAgbG9naWNTdG9yZS5hZGRDb25zb2xlRW50cnkoJ3dhcm4nLCBgW0Z1eGFWaWV3XSBDb3VsZCBub3Qgc2F2ZSB2aWV3IHRvIEZVWEE6ICR7ZS5tZXNzYWdlfWApO1xuICAgIH1cbn1cblxuLy8gQXV0by1nZW5lcmF0ZSB2aWV3IGZyb20gY3VycmVudCB0YWdEYXRhYmFzZSB3aGVuZXZlciBjYWxsZWRcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZUZ1eGFWaWV3RnJvbUN1cnJlbnRUYWdzKHBvdU5hbWUgPSAnbWFpbicpIHtcbiAgICBjb25zdCB0YWdzID0gbG9naWNTdG9yZS5zdGF0ZS50YWdEYXRhYmFzZTtcbiAgICByZXR1cm4gZ2VuZXJhdGVGdXhhVmlld0ZvclBPVShwb3VOYW1lLCB0YWdzKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU9BLFNBQVMsa0JBQWtCO0FBRzNCLE1BQU0sWUFBWTtBQUNsQixNQUFNLFNBQVM7QUFNZixTQUFTLFVBQVUsS0FBMkI7QUFDMUMsUUFBTSxJQUFJLElBQUksS0FBSyxZQUFZO0FBQy9CLE1BQUksMkJBQTJCLEtBQUssQ0FBQyxFQUFHLFFBQU87QUFDL0MsTUFBSSxzQkFBc0IsS0FBSyxDQUFDLEVBQUcsUUFBTztBQUMxQyxNQUFJLCtCQUErQixLQUFLLENBQUMsRUFBRyxRQUFPO0FBQ25ELE1BQUksT0FBTyxLQUFLLENBQUMsRUFBRyxRQUFPO0FBQzNCLE1BQUksSUFBSSxhQUFhLE9BQVEsUUFBTztBQUNwQyxTQUFPO0FBQ1g7QUFVQSxNQUFNLFlBQTRDO0FBQUEsRUFDOUMsTUFBZ0IsRUFBRSxNQUFNLHlCQUE4QixHQUFHLEtBQUssR0FBRyxLQUFLLFFBQVEsT0FBTztBQUFBLEVBQ3JGLE9BQWdCLEVBQUUsTUFBTSx5QkFBOEIsR0FBRyxLQUFLLEdBQUcsS0FBSyxRQUFRLE9BQU87QUFBQSxFQUNyRixPQUFnQixFQUFFLE1BQU0sMkJBQThCLEdBQUcsS0FBSyxHQUFHLEtBQUssUUFBUSxPQUFPO0FBQUEsRUFDckYsTUFBZ0IsRUFBRSxNQUFNLCtCQUE4QixHQUFHLEtBQUssR0FBRyxLQUFLLFFBQVEsT0FBTztBQUFBLEVBQ3JGLGdCQUFnQixFQUFFLE1BQU0sMkJBQThCLEdBQUcsSUFBSyxHQUFHLElBQUssUUFBUSxPQUFPO0FBQUEsRUFDckYsZ0JBQWdCLEVBQUUsTUFBTSxpQkFBOEIsR0FBRyxLQUFLLEdBQUcsSUFBSyxRQUFRLE9BQU87QUFDekY7QUFNQSxTQUFTLGFBQWEsTUFBa0IsU0FBaUIsR0FBVyxHQUFtQjtBQUNuRixRQUFNLFFBQVEsUUFBUSxTQUFTLEtBQUssUUFBUSxNQUFNLEdBQUcsQ0FBQyxJQUFJLFdBQU07QUFDaEUsVUFBUSxNQUFNO0FB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
