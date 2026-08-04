/*
 * LadderElementRenderer — IEC 61131-3 compliant element glyphs.
 *
 * Production-grade SVG rendering for:
 *  - Contacts: Two vertical bars (NO/NC/P/N) with proper IEC geometry
 *  - Coils: Two bezier paren arcs (NOT circles) with inner character
 *  - Function blocks: Rectangle with header, pin rows, stub wires, connection dots
 *
 * All colors use --vscode-* CSS custom properties exclusively.
 * No hardcoded hex values, no external wire stubs (owned by rung layout).
 *
 * Wire midline constants:
 *   - Contacts/coils: EL_MID = 40 (within EL_H = 68)
 *   - Function blocks: blockMidY() returns first input pin Y
 */

import React from 'react';
import { LadderElement, ContactType, CoilType, FBType } from '../logicStore.js';

// ── Glyph sizing ───────────────────────────────────────────────────────────────
export const EL_W = 56; // contact/coil cell width
export const EL_H = 68; // contact/coil cell height
export const EL_MID = 40; // wire midline Y inside contact/coil SVG

export const BLOCK_W = 112; // function block total width (body + stubs)
const BLOCK_BODY_W = 80; // body rectangle width
const BLOCK_STUB = 16; // pin stub wire length (each side)
const HDR_H = 34; // header band height
const PIN_ROW_H = 20; // height per pin row
const BODY_PAD = 6; // padding before/after pin rows

// Contact geometry (IEC 61131-3 standard)
const BAR_H = 22; // bar height
const BAR_W = 3; // bar width
const BAR_GAP = 9; // half-distance from center to bar outer edge

// Coil geometry (IEC 61131-3: paren arcs, not filled circles)
const COIL_HALF = 10; // half-gap from center to paren
const COIL_PH = 11; // paren arc height half
const COIL_BULGE = 8; // bezier control point offset

// ── Colors ─────────────────────────────────────────────────────────────────────
const C_EL = 'var(--vscode-editor-foreground)';
const C_ENRG = 'var(--vscode-charts-green, #22c55e)';
const C_TAG = 'var(--vscode-descriptionForeground)';
const C_SEL = 'var(--vscode-focusBorder, #007fd4)';
const C_BG = 'var(--vscode-input-background)';
const C_BD = 'var(--vscode-widget-border, #505050)';
const C_PIN = 'var(--vscode-descriptionForeground)';
const C_HDR = 'var(--vscode-sideBarSectionHeader-background, #2d2d2d)';
const C_FORCE_T = '#80C000'; // force TRUE — green
const C_FORCE_F = '#4080FF'; // force FALSE — blue

// ── Function block pin definitions ─────────────────────────────────────────────
export const FB_PINS: Record<FBType, {in: string[];out: string[];}> = {
  TON: { in: ['IN', 'PT'], out: ['Q', 'ET'] },
  TOF: { in: ['IN', 'PT'], out: ['Q', 'ET'] },
  TP: { in: ['IN', 'PT'], out: ['Q', 'ET'] },
  CTU: { in: ['CU', 'R', 'PV'], out: ['Q', 'CV'] },
  CTD: { in: ['CD', 'LD', 'PV'], out: ['Q', 'CV'] },
  CTUD: { in: ['CU', 'CD', 'R', 'LD', 'PV'], out: ['QU', 'QD', 'CV'] },
  SR: { in: ['S1', 'R'], out: ['Q1'] },
  RS: { in: ['S', 'R1'], out: ['Q1'] },
  RTRIG: { in: ['CLK'], out: ['Q'] },
  FTRIG: { in: ['CLK'], out: ['Q'] },
  EQ: { in: ['IN1', 'IN2'], out: ['OUT'] },
  NE: { in: ['IN1', 'IN2'], out: ['OUT'] },
  GT: { in: ['IN1', 'IN2'], out: ['OUT'] },
  GE: { in: ['IN1', 'IN2'], out: ['OUT'] },
  LT: { in: ['IN1', 'IN2'], out: ['OUT'] },
  LE: { in: ['IN1', 'IN2'], out: ['OUT'] },
  ADD: { in: ['IN1', 'IN2'], out: ['OUT'] },
  SUB: { in: ['IN1', 'IN2'], out: ['OUT'] },
  MUL: { in: ['IN1', 'IN2'], out: ['OUT'] },
  DIV: { in: ['IN1', 'IN2'], out: ['OUT'] },
  MOD: { in: ['IN1', 'IN2'], out: ['OUT'] },
  ABS: { in: ['IN'], out: ['OUT'] },
  SQRT: { in: ['IN'], out: ['OUT'] },
  MOVE: { in: ['IN'], out: ['OUT'] },
  SEL: { in: ['G', 'IN0', 'IN1'], out: ['OUT'] },
  LIMIT: { in: ['MN', 'IN', 'MX'], out: ['OUT'] },
  MIN: { in: ['IN1', 'IN2'], out: ['OUT'] },
  MAX: { in: ['IN1', 'IN2'], out: ['OUT'] }
};

export function blockHeight(fbType: FBType): number {
  const pins = FB_PINS[fbType] ?? { in: [], out: [] };
  const rows = Math.max(pins.in.length, pins.out.length, 1);
  return HDR_H + BODY_PAD + rows * PIN_ROW_H + BODY_PAD;
}

// Y coordinate of the first input pin (= wire midline for rung connection)
export function blockMidY(fbType: FBType): number {
  return HDR_H + BODY_PAD + PIN_ROW_H / 2;
}

// ── Contact glyph ──────────────────────────────────────────────────────────────
//
//   TAG          ← tag name label above bars
//    | |         ← two vertical bars (NO)
//    |/|         ← NC: diagonal slash
//    P/N         ← P rising / N falling: letter between bars
//   TYPE         ← type hint below (NC / P↑ / N↓)
//

export const ContactGlyph: React.FC<{
  ctype: ContactType;tag: string;energized?: boolean;selected?: boolean;forcedValue?: string;
}> = ({ ctype, tag, energized, selected, forcedValue }) => {
  const stroke = forcedValue === 'TRUE' ? C_FORCE_T : forcedValue === 'FALSE' ? C_FORCE_F : energized ? C_ENRG : selected ? C_SEL : C_EL;
  const cx = EL_W / 2;
  const cy = EL_MID;

  const lx = cx - BAR_GAP;
  const rx = cx + BAR_GAP;
  const ty = cy - BAR_H / 2;
  const by = cy + BAR_H / 2;

  return (
    <svg width={EL_W} height={EL_H} style={{ display: 'block', flexShrink: 0 }}>
      {/* Left wire stub: rail edge → left bar */}
      <line x1={0} y1={cy} x2={lx} y2={cy}
      stroke={stroke} strokeWidth={2} strokeLinecap="square" />

      {/* Right wire stub: right bar → element edge */}
      <line x1={rx} y1={cy} x2={EL_W} y2={cy}
      stroke={stroke} strokeWidth={2} strokeLinecap="square" />

      {/* Left bar */}
      <line x1={lx} y1={ty} x2={lx} y2={by}
      stroke={stroke} strokeWidth={BAR_W} strokeLinecap="square" />

      {/* Right bar */}
      <line x1={rx} y1={ty} x2={rx} y2={by}
      stroke={stroke} strokeWidth={BAR_W} strokeLinecap="square" />

      {/* NC: diagonal slash */}
      {ctype === 'NC' &&
      <line
        x1={lx + 2} y1={by - 2}
        x2={rx - 2} y2={ty + 2}
        stroke={stroke} strokeWidth={2} />

      }

      {/* P rising / N falling: centered letter */}
      {(ctype === 'P_CONTACT' || ctype === 'N_CONTACT') &&
      <text x={cx} y={cy + 4}
      textAnchor="middle" fontSize={10} fontWeight="700"
      fontFamily="monospace" fill={stroke}
      style={{ userSelect: 'none' }}>
          {ctype === 'P_CONTACT' ? 'P' : 'N'}
        </text>
      }

      {/* Type hint below */}
      {ctype !== 'NO' &&
      <text x={cx} y={by + 12}
      textAnchor="middle" fontSize={8}
      fontFamily="monospace" fill={stroke} opacity={0.7}
      style={{ userSelect: 'none' }}>
          {ctype === 'NC' ? 'NC' : ctype === 'P_CONTACT' ? 'P↑' : 'N↓'}
        </text>
      }

      {selected &&
      <rect x={2} y={2} width={EL_W - 4} height={EL_H - 4}
      fill="none" stroke={C_SEL} strokeWidth={2}
      strokeDasharray="4 3" rx={3} opacity={0.9} />
      }
    </svg>);

};

// ── Coil glyph ─────────────────────────────────────────────────────────────────
//
//   TAG          ← tag name label above
//   ( )          ← two bezier paren arcs (IEC standard, NOT a circle)
//    C           ← inner character for non-normal coils (S/R/L/U//)
//   TYPE         ← type label below
//
export const CoilGlyph: React.FC<{
  ctype: CoilType;tag: string;energized?: boolean;selected?: boolean;forcedValue?: string;
}> = ({ ctype, tag, energized, selected, forcedValue }) => {
  const stroke = forcedValue === 'TRUE' ? C_FORCE_T : forcedValue === 'FALSE' ? C_FORCE_F : energized ? C_ENRG : selected ? C_SEL : C_EL;
  const cx = EL_W / 2;
  const cy = EL_MID;

  const lax = cx - COIL_HALF;
  const rax = cx + COIL_HALF;

  // Left paren: open-right arc
  const leftParen = `M ${lax},${cy - COIL_PH} Q ${lax - COIL_BULGE},${cy} ${lax},${cy + COIL_PH}`;
  // Right paren: open-left arc
  const rightParen = `M ${rax},${cy - COIL_PH} Q ${rax + COIL_BULGE},${cy} ${rax},${cy + COIL_PH}`;

  const INNER: Record<CoilType, string> = {
    normal: '', negated: '/', set: 'S', reset: 'R', latch: 'L', unlatch: 'U'
  };

  return (
    <svg width={EL_W} height={EL_H} style={{ display: 'block', flexShrink: 0 }}>
      {/* Left wire stub: element edge → left paren */}
      <line x1={0} y1={cy} x2={lax} y2={cy}
      stroke={stroke} strokeWidth={2} strokeLinecap="square" />

      {/* Right wire stub: right paren → element edge */}
      <line x1={rax} y1={cy} x2={EL_W} y2={cy}
      stroke={stroke} strokeWidth={2} strokeLinecap="square" />

      {/* Left paren arc */}
      <path d={leftParen} fill="none" stroke={stroke} strokeWidth={BAR_W} strokeLinecap="round" />

      {/* Right paren arc */}
      <path d={rightParen} fill="none" stroke={stroke} strokeWidth={BAR_W} strokeLinecap="round" />

      {/* Inner character */}
      {INNER[ctype] &&
      <text x={cx} y={cy + 4}
      textAnchor="middle" fontSize={10} fontWeight="700"
      fontFamily="monospace" fill={stroke}
      style={{ userSelect: 'none' }}>
          {INNER[ctype]}
        </text>
      }

      {/* Type label below */}
      {ctype !== 'normal' &&
      <text x={cx} y={cy + COIL_PH + 13}
      textAnchor="middle" fontSize={8}
      fontFamily="monospace" fill={stroke} opacity={0.7}
      style={{ userSelect: 'none' }}>
          {ctype.toUpperCase()}
        </text>
      }

      {selected &&
      <rect x={2} y={2} width={EL_W - 4} height={EL_H - 4}
      fill="none" stroke={C_SEL} strokeWidth={2}
      strokeDasharray="4 3" rx={3} opacity={0.9} />
      }
    </svg>);

};

// ── Function Block glyph ───────────────────────────────────────────────────────
//
//  ─────┬──────────┬─────
//       │  TON     │      ← header with type name
//       │  inst    │      ← instance name
//       ├──────────┤      ← divider
//  ─IN──┤          ├──Q── ← input/output pin rows with stubs
//  ─PT──┤          ├─ET──
//       └──────────┘
//
// Pin stub wires are rendered INSIDE the SVG.
// Rung wires connect to stub ends at x=0 (left) and x=BLOCK_W (right).
//
export const BlockGlyph: React.FC<{
  fbType: FBType;instanceName: string;energized?: boolean;selected?: boolean;forcedValue?: string;
}> = ({ fbType, instanceName, energized, selected, forcedValue }) => {
  const pins = FB_PINS[fbType] ?? { in: [], out: [] };
  const rows = Math.max(pins.in.length, pins.out.length, 1);
  const w = BLOCK_W;
  const h = blockHeight(fbType);

  const bdC = forcedValue === 'TRUE' ? C_FORCE_T : forcedValue === 'FALSE' ? C_FORCE_F : selected ? C_SEL : energized ? C_ENRG : C_BD;
  const wireC = forcedValue === 'TRUE' ? C_FORCE_T : forcedValue === 'FALSE' ? C_FORCE_F : energized ? C_ENRG : C_EL;
  const bx = BLOCK_STUB;
  const bw = BLOCK_BODY_W;

  return (
    <svg width={w} height={h} style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}>
      {/* Body rectangle */}
      <rect x={bx} y={2} width={bw} height={h - 4}
      fill={C_BG} stroke={bdC} strokeWidth={selected ? 2.5 : 1.5} rx={4} />

      {/* Header background band */}
      <rect x={bx + 1} y={3} width={bw - 2} height={HDR_H - 5}
      fill={C_HDR} rx={3} />

      {/* FB type name */}
      <text x={bx + bw / 2} y={HDR_H / 2}
      textAnchor="middle" fontSize={12} fontWeight="700"
      fontFamily="monospace" fill={C_EL}
      style={{ userSelect: 'none' }}>
        {fbType}
      </text>

      {/* Instance name */}
      <text x={bx + bw / 2} y={HDR_H / 2 + 14}
      textAnchor="middle" fontSize={8}
      fontFamily="monospace" fill={C_PIN}
      style={{ userSelect: 'none' }}>
        {instanceName || '…'}
      </text>

      {/* Divider line */}
      <line x1={bx + 1} y1={HDR_H} x2={bx + bw - 1} y2={HDR_H}
      stroke={C_BD} strokeWidth={1} />

      {/* Input pin rows */}
      {pins.in.map((name, i) => {
        const py = HDR_H + BODY_PAD + i * PIN_ROW_H + PIN_ROW_H / 2;
        return (
          <g key={`in-${i}`}>
            {/* Stub wire from left edge to body */}
            <line x1={0} y1={py} x2={bx} y2={py}
            stroke={wireC} strokeWidth={2} strokeLinecap="square" />
            {/* Pin connection dot */}
            <circle cx={bx} cy={py} r={2.5} fill={wireC} />
            {/* Pin label */}
            <text x={bx + 6} y={py + 4}
            fontSize={8} fontFamily="monospace" fill={C_PIN}
            style={{ userSelect: 'none' }}>
              {name}
            </text>
          </g>);

      })}

      {/* Output pin rows */}
      {pins.out.map((name, i) => {
        const py = HDR_H + BODY_PAD + i * PIN_ROW_H + PIN_ROW_H / 2;
        return (
          <g key={`out-${i}`}>
            {/* Stub wire from body to right edge */}
            <line x1={bx + bw} y1={py} x2={w} y2={py}
            stroke={wireC} strokeWidth={2} strokeLinecap="square" />
            {/* Pin connection dot */}
            <circle cx={bx + bw} cy={py} r={2.5} fill={wireC} />
            {/* Pin label */}
            <text x={bx + bw - 6} y={py + 4}
            fontSize={8} fontFamily="monospace" fill={C_PIN}
            textAnchor="end" style={{ userSelect: 'none' }}>
              {name}
            </text>
          </g>);

      })}

      {selected &&
      <rect x={bx - 2} y={0} width={bw + 4} height={h}
      fill="none" stroke={C_SEL} strokeWidth={2}
      strokeDasharray="4 3" rx={5} opacity={0.9} />
      }
    </svg>);

};

export const LABEL_H = 14; // height reserved above SVG for the HTML tag label

// ── Unified renderer ───────────────────────────────────────────────────────────
export const LadderElementRenderer: React.FC<{
  element: LadderElement;
  selected?: boolean;
  onSelect?: () => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  forcedValue?: string;
  liveValue?: string;
  monitorMode?: string;
}> = ({ element, selected, onSelect, onDoubleClick, forcedValue, liveValue, monitorMode }) => {
  const energized = element.energized ?? false;
  const tagName = element.kind === 'block' ? element.instanceName : element.tag?.name ?? '';
  const glyphW = element.kind === 'block' ? BLOCK_W : EL_W;

  return (
    <div
      onClick={(e) => {e.stopPropagation();onSelect?.();}}
      onDoubleClick={(e) => {e.stopPropagation();onDoubleClick?.(e);}}
      title={tagName}
      style={{
        cursor: 'pointer',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        position: 'relative'
      }}>

      {/* HTML label above the glyph — proper text overflow without bleeding into neighbors */}
      {element.kind !== 'block' &&
      <div style={{
        width: glyphW,
        height: LABEL_H,
        textAlign: 'center',
        fontSize: 9,
        fontWeight: 500,
        fontFamily: 'monospace',
        color: C_TAG,
        userSelect: 'none',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: `${LABEL_H}px`,
        paddingLeft: 2,
        paddingRight: 2,
        boxSizing: 'border-box',
        flexShrink: 0
      }} title={tagName}>
          {tagName || '?'}
        </div>
      }

      {element.kind === 'contact' &&
      <ContactGlyph
        ctype={element.type}
        tag={element.tag?.name ?? ''}
        energized={energized} selected={selected}
        forcedValue={forcedValue} />

      }
      {element.kind === 'coil' &&
      <CoilGlyph
        ctype={element.type}
        tag={element.tag?.name ?? ''}
        energized={energized} selected={selected}
        forcedValue={forcedValue} />

      }
      {element.kind === 'block' &&
      <BlockGlyph
        fbType={element.fbType}
        instanceName={element.instanceName}
        energized={energized} selected={selected}
        forcedValue={forcedValue} />

      }

      {/* Force indicator badge (top-right corner) */}
      {forcedValue !== undefined &&
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 9, height: 9,
        background: '#f59e0b',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 6, fontWeight: 800, color: '#000',
        borderRadius: 2, zIndex: 10, pointerEvents: 'none',
        fontFamily: 'monospace'
      }}>F</div>
      }

      {/* Live value badge (below element, monitor mode only) */}
      {monitorMode === 'running' && element.kind !== 'block' && liveValue !== undefined &&
      <div style={{
        fontSize: 8, padding: '1px 4px', borderRadius: 8,
        background: '#22c55e22', color: '#22c55e',
        textAlign: 'center', marginTop: 1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: glyphW, alignSelf: 'center',
        fontFamily: 'monospace'
      }}>
          {liveValue === 'true' || liveValue === 'TRUE' ? 'TRUE' :
        liveValue === 'false' || liveValue === 'FALSE' ? 'FALSE' :
        liveValue}
        </div>
      }

      {/* FB block output pin value badges (monitor mode) */}
      {monitorMode === 'running' && element.kind === 'block' && element.pinValues && Object.keys(element.pinValues).length > 0 &&
      <div style={{
        display: 'flex', flexDirection: 'row', flexWrap: 'wrap',
        gap: 2, justifyContent: 'center', marginTop: 2, maxWidth: glyphW
      }}>
          {Object.entries(element.pinValues).map(([pin, val]) =>
        <div key={pin} style={{
          fontSize: 7, padding: '1px 3px', borderRadius: 6,
          background: '#a78bfa22', color: '#a78bfa',
          fontFamily: 'monospace', whiteSpace: 'nowrap'
        }}>
              {pin}:{val === 'true' || val === 'TRUE' ? 'T' : val === 'false' || val === 'FALSE' ? 'F' : val}
            </div>
        )}
        </div>
      }
    </div>);

};