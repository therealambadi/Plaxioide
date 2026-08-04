/*
 * LadderRung.tsx — IEC 61131-3 Ladder Diagram rung.
 *
 * Renders a single rung as pure HTML/SVG — no ReactFlow viewport transforms.
 * This gives pixel-perfect wire alignment and exact drop-slot positioning.
 *
 * Layout:
 *   Left power rail | gap | [element gap]* | gap | Right power rail
 *   A horizontal wire at WIRE_Y runs through every element's center.
 *   Labels (tag names) float above each element.
 *
 * Drag-drop:
 *   Insertion slots appear between elements during drag.
 *   The active slot highlights in blue showing the exact insertion index.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Rung, LadderElement, logicStore, useLogicStoreSelector } from '../logicStore.js';
import { undoRedoStore } from '../undoRedoStore.js';
import { insertContact, insertCoil, insertBlock, addElementToBranch } from './ladderCommands.js';
import { FB_PINS } from './LadderElementRenderer.js';
import type { FBType } from '../logicStore.js';

export const RUNG_HEADER_H = 32;

// ── Dimensions ────────────────────────────────────────────────────────────────
const LABEL_H = 22; // space above wire for tag labels
const RAIL_HALF = 26; // rail extends this many px above/below the wire center
const WIRE_Y = LABEL_H + RAIL_HALF; // wire Y = 48
const RAIL_Y = WIRE_Y - RAIL_HALF; // rail top Y = 22
const RAIL_H_PX = RAIL_HALF * 2; // rail height = 52px
const RAIL_W = 3; // power rail width — 3px like reference
const GAP = 40; // wire gap between elements
const CONTACT_W = 28;
const CONTACT_H = 28;
const COIL_W = 34;
const COIL_H = 28;
const BLOCK_W = 160;
const BLOCK_H = 96;
const SLOT_W = 10; // drag insertion slot visual width
const MIN_CANVAS_W = 500;

// ── Colors ────────────────────────────────────────────────────────────────────
const C_FG = 'var(--vscode-editor-foreground, #cccccc)';
const C_BG = 'var(--vscode-editor-background, #1e1e1e)';
const C_HDR_BG = 'var(--vscode-sideBarSectionHeader-background, #1a1a1a)'; // neutral-900-ish header
const C_BORDER = 'var(--vscode-editorGroup-border, #2e2e2e)';
const C_MUTED = 'var(--vscode-descriptionForeground, #888)';
const C_ENRG = 'var(--vscode-charts-green, #22c55e)';
const C_SEL = 'var(--vscode-focusBorder, #0078d4)';
const C_RAIL = '#737373'; // neutral-500, matches reference
const C_SLOT = 'rgba(0,120,212,0.55)';

// ── Layout helpers ────────────────────────────────────────────────────────────

function elW(el: LadderElement) {
  if (el.kind === 'contact') return CONTACT_W;
  if (el.kind === 'coil') return COIL_W;
  return BLOCK_W;
}
function elH(el: LadderElement) {
  if (el.kind === 'contact') return CONTACT_H;
  if (el.kind === 'coil') return COIL_H;
  return BLOCK_H;
}

// Serial insertion slot (left/right of elements, on the wire)
interface Slot {cx: number;index: number;}
// Parallel slot (below an element — creates a parallel branch)
interface ParallelSlot {cx: number;cy: number;elIndex: number;elId: string;}

interface ElLayout {el: LadderElement;x: number;y: number;w: number;h: number;}

const PARALLEL_SLOT_GAP = 18; // px below element bottom edge — where the diamond appears

function computeLayout(elements: LadderElement[]): {
  elLayouts: ElLayout[];
  slots: Slot[];
  parallelSlots: ParallelSlot[];
  rightRailX: number;
  totalW: number;
  canvasH: number;
} {
  let curX = RAIL_W + GAP;
  const elLayouts: ElLayout[] = [];
  const slotsBefore: Slot[] = [];
  const parallelSlots: ParallelSlot[] = [];

  let maxH = 0;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const w = elW(el);
    const h = elH(el);
    const y = WIRE_Y - h / 2;
    slotsBefore.push({ cx: curX - GAP / 2, index: i });
    elLayouts.push({ el, x: curX, y, w, h });
    // Parallel slot: centered horizontally below the element
    parallelSlots.push({
      cx: curX + w / 2,
      cy: y + h + PARALLEL_SLOT_GAP,
      elIndex: i,
      elId: el.id
    });
    curX += w + GAP;
    if (h > maxH) maxH = h;
  }

  const rightRailX = Math.max(MIN_CANVAS_W - RAIL_W, curX);
  const totalW = rightRailX + RAIL_W;

  const lastSlotCx = elements.length > 0 ? curX - GAP / 2 : (RAIL_W + rightRailX) / 2;
  const slots: Slot[] = [...slotsBefore, { cx: lastSlotCx, index: elements.length }];

  const halfMax = maxH > 0 ? Math.max(RAIL_HALF, Math.ceil(maxH / 2)) : RAIL_HALF;
  const canvasH = LABEL_H + halfMax + halfMax + 16;
  return { elLayouts, slots, parallelSlots, rightRailX, totalW, canvasH };
}

// ── Helper: create a new LadderElement from a palette kind string ─────────────
function makeBranchElement(kind: string): import('../logicStore.js').LadderElement | null {
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  if (kind.startsWith('contact')) {
    const typeMap: Record<string, string> = {
      'contact-NO': 'NO', 'contact-NC': 'NC',
      'contact-P': 'P_CONTACT', 'contact-N': 'N_CONTACT'
    };
    return { kind: 'contact', id: `contact-${uid()}`, type: (typeMap[kind] ?? 'NO') as any, tag: { name: '', dataType: 'BOOL' }, position: { x: 0, y: 0 } };
  } else if (kind.startsWith('coil')) {
    const typeMap: Record<string, string> = {
      'coil-normal': 'normal', 'coil-negated': 'negated',
      'coil-set': 'set', 'coil-reset': 'reset',
      'coil-latch': 'latch', 'coil-unlatch': 'unlatch'
    };
    return { kind: 'coil', id: `coil-${uid()}`, type: (typeMap[kind] ?? 'normal') as any, tag: { name: '', dataType: 'BOOL' }, position: { x: 0, y: 0 } };
  } else if (kind.startsWith('block')) {
    const fbType = kind.replace('block-', '') as any;
    return { kind: 'block', id: `block-${uid()}`, fbType, instanceName: '', pins: {}, position: { x: 0, y: 0 } };
  }
  return null;
}

// SVG path data for coil parentheses
const COIL_LEFT = "M7 0 C0 7 0 21 7 28 C4 21 4 7 7 0 Z";
const COIL_RIGHT = "M27 0 C34 7 34 21 27 28 C30 21 30 7 27 0 Z";

const BLOCK_COLORS: Record<string, string> = {
  TON: '#a78bfa', TOF: '#a78bfa', TP: '#a78bfa',
  CTU: '#f472b6', CTD: '#f472b6', CTUD: '#f472b6',
  SR: '#fbbf24', RS: '#fbbf24',
  RTRIG: '#60a5fa', FTRIG: '#60a5fa',
  EQ: '#fb923c', NE: '#fb923c', GT: '#fb923c', GE: '#fb923c', LT: '#fb923c', LE: '#fb923c',
  ADD: '#34d399', SUB: '#34d399', MUL: '#34d399', DIV: '#34d399', MOD: '#34d399', ABS: '#34d399', SQRT: '#34d399',
  MOVE: '#94a3b8', SEL: '#94a3b8', LIMIT: '#94a3b8', MIN: '#94a3b8', MAX: '#94a3b8'
};

// ── Element SVG renderers ─────────────────────────────────────────────────────

const C_FORCED_TRUE = '#80C000';
const C_FORCED_FALSE = '#4080FF';

function renderContact(el: LadderElement, x: number, y: number, selected: boolean, energized: boolean, opacity = 1, forcedState: 'true' | 'false' | null = null) {
  const stroke = forcedState === 'true' ? C_FORCED_TRUE : forcedState === 'false' ? C_FORCED_FALSE : energized ? C_ENRG : selected ? C_SEL : C_FG;
  const variant = (el as any).variant ?? contactVariantOf((el as any).type);
  const tagName = (el as any).tag?.name ?? '';
  const label = tagName || '…';

  return (
    <g key={el.id} transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }} opacity={opacity}>
      {/* Selection ring */}
      {selected && <rect x={-3} y={-3} width={CONTACT_W + 6} height={CONTACT_H + 6}
      rx={3} fill="none" stroke={C_SEL} strokeWidth={1.5} strokeDasharray="3 2" />}
      {/* Contact glyph */}
      <line x1={0.75} y1={4} x2={0.75} y2={CONTACT_H - 4} stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      <line x1={CONTACT_W - 0.75} y1={4} x2={CONTACT_W - 0.75} y2={CONTACT_H - 4} stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      {variant === 'negated' &&
      <line x1={5} y1={CONTACT_H - 5} x2={CONTACT_W - 5} y2={5} stroke={stroke} strokeWidth={1.5} />
      }
      {variant === 'risingEdge' &&
      <text x={CONTACT_W / 2} y={18} textAnchor="middle" fontSize={11} fill={stroke} fontFamily="monospace" fontWeight="bold">P</text>
      }
      {variant === 'fallingEdge' &&
      <text x={CONTACT_W / 2} y={18} textAnchor="middle" fontSize={11} fill={stroke} fontFamily="monospace" fontWeight="bold">N</text>
      }
    </g>);

}

function renderCoil(el: LadderElement, x: number, y: number, selected: boolean, energized: boolean, opacity = 1, forcedState: 'true' | 'false' | null = null) {
  const stroke = forcedState === 'true' ? C_FORCED_TRUE : forcedState === 'false' ? C_FORCED_FALSE : energized ? C_ENRG : selected ? C_SEL : C_FG;
  const variant = (el as any).variant ?? coilVariantOf((el as any).type);
  const tagName = (el as any).tag?.name ?? '';
  const label = tagName || '…';

  return (
    <g key={el.id} transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }} opacity={opacity}>
      {selected && <rect x={-3} y={-3} width={COIL_W + 6} height={COIL_H + 6}
      rx={3} fill="none" stroke={C_SEL} strokeWidth={1.5} strokeDasharray="3 2" />}
      {/* Coil parentheses — always solid filled; color reflects energized state */}
      <path d={COIL_LEFT} fill={stroke} />
      <path d={COIL_RIGHT} fill={stroke} />
      {variant === 'negated' && <line x1={8} y1={22} x2={26} y2={6} stroke={stroke} strokeWidth={1.5} />}
      {variant === 'set' && <text x={17} y={18} textAnchor="middle" fontSize={10} fill={stroke} fontFamily="monospace" fontWeight="bold">S</text>}
      {variant === 'reset' && <text x={17} y={18} textAnchor="middle" fontSize={10} fill={stroke} fontFamily="monospace" fontWeight="bold">R</text>}
      {variant === 'latch' && <text x={17} y={18} textAnchor="middle" fontSize={10} fill={stroke} fontFamily="monospace" fontWeight="bold">L</text>}
      {variant === 'unlatch' && <text x={17} y={18} textAnchor="middle" fontSize={10} fill={stroke} fontFamily="monospace" fontWeight="bold">U</text>}
      {variant === 'risingEdge' && <text x={17} y={18} textAnchor="middle" fontSize={10} fill={stroke} fontFamily="monospace" fontWeight="bold">P</text>}
      {variant === 'fallingEdge' && <text x={17} y={18} textAnchor="middle" fontSize={10} fill={stroke} fontFamily="monospace" fontWeight="bold">N</text>}
    </g>);

}

function renderBlock(el: LadderElement, x: number, y: number, selected: boolean, energized: boolean, opacity = 1, forcedState: 'true' | 'false' | null = null) {
  const fbType = (el as any).fbType as FBType ?? 'TON';
  const baseColor = BLOCK_COLORS[fbType] ?? '#94a3b8';
  const color = forcedState === 'true' ? C_FORCED_TRUE : forcedState === 'false' ? C_FORCED_FALSE : baseColor;
  const pins = FB_PINS[fbType] ?? { in: [], out: [] };
  const instanceName = (el as any).instanceName ?? '';
  const PIN_START = 36;
  const PIN_STEP = 28;

  return (
    <g key={el.id} transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }} opacity={opacity}>
      {selected && <rect x={-3} y={-3} width={BLOCK_W + 6} height={BLOCK_H + 6}
      rx={5} fill="none" stroke={C_SEL} strokeWidth={1.5} strokeDasharray="3 2" />}
      {/* Block body */}
      <rect x={0} y={0} width={BLOCK_W} height={BLOCK_H} rx={4}
      fill={C_BG} stroke={`${color}88`} strokeWidth={1.5} />
      {/* Header bar */}
      <rect x={0} y={0} width={BLOCK_W} height={24} rx={4}
      fill={`${color}22`} />
      <rect x={0} y={20} width={BLOCK_W} height={4} fill={`${color}22`} />
      <line x1={0} y1={24} x2={BLOCK_W} y2={24} stroke={`${color}44`} strokeWidth={1} />
      <text x={BLOCK_W / 2} y={16} textAnchor="middle" fontSize={11}
      fill={color} fontFamily="monospace" fontWeight={700}>{fbType}</text>
      {/* Input pins */}
      {pins.in.map((name: string, i: number) => {
        const py = PIN_START + i * PIN_STEP;
        return (
          <g key={`in-${i}`}>
            <line x1={-GAP / 2} y1={py} x2={0} y2={py} stroke={C_FG} strokeWidth={1.5} />
            <text x={6} y={py + 4} fontSize={8} fill={C_MUTED} fontFamily="monospace">{name}</text>
          </g>);

      })}
      {/* Output pins */}
      {pins.out.map((name: string, i: number) => {
        const py = PIN_START + i * PIN_STEP;
        return (
          <g key={`out-${i}`}>
            <line x1={BLOCK_W} y1={py} x2={BLOCK_W + GAP / 2} y2={py} stroke={C_FG} strokeWidth={1.5} />
            <text x={BLOCK_W - 6} y={py + 4} fontSize={8} fill={C_MUTED} fontFamily="monospace" textAnchor="end">{name}</text>
          </g>);

      })}
    </g>);

}

// ── Variant mappers ───────────────────────────────────────────────────────────

function contactVariantOf(type: string): string {
  if (type === 'NC') return 'negated';
  if (type === 'P_CONTACT') return 'risingEdge';
  if (type === 'N_CONTACT') return 'fallingEdge';
  return 'default';
}
function coilVariantOf(type: string): string {
  if (type === 'negated') return 'negated';
  if (type === 'set') return 'set';
  if (type === 'reset') return 'reset';
  if (type === 'latch') return 'latch';
  if (type === 'unlatch') return 'unlatch';
  if (type === 'risingEdge') return 'risingEdge';
  if (type === 'fallingEdge') return 'fallingEdge';
  return 'default';
}

// ── Drop-kind → insertXxx ─────────────────────────────────────────────────────

/** After any structural edit, warn if a rung has no output (ends in contacts only). */
function warnIfNoOutput(rungId: string) {
  const rung = logicStore.getState().ladderProgram.rungs.find((r) => r.id === rungId);
  if (!rung) return;
  const hasOutput = rung.elements.some((e) => e.kind === 'coil' || e.kind === 'block');
  if (!hasOutput && rung.elements.length > 0) {
    logicStore.addConsoleEntry('warn', `Rung ${rung.number}: no output element (coil or block) — rung will not drive any tag`);
  }
}

function applyDrop(rungId: string, kind: string, idx: number) {
  const EMPTY_TAG = { name: '', dataType: 'BOOL' as const };
  switch (kind) {
    case 'contact-NO':insertContact(rungId, EMPTY_TAG, 'NO', idx);break;
    case 'contact-NC':insertContact(rungId, EMPTY_TAG, 'NC', idx);break;
    case 'contact-P':insertContact(rungId, EMPTY_TAG, 'P_CONTACT', idx);break;
    case 'contact-N':insertContact(rungId, EMPTY_TAG, 'N_CONTACT', idx);break;
    case 'coil-normal':insertCoil(rungId, EMPTY_TAG, 'normal', idx);break;
    case 'coil-negated':insertCoil(rungId, EMPTY_TAG, 'negated', idx);break;
    case 'coil-set':insertCoil(rungId, EMPTY_TAG, 'set', idx);break;
    case 'coil-reset':insertCoil(rungId, EMPTY_TAG, 'reset', idx);break;
    case 'coil-latch':insertCoil(rungId, EMPTY_TAG, 'latch', idx);break;
    case 'coil-unlatch':insertCoil(rungId, EMPTY_TAG, 'unlatch', idx);break;
    case 'block-TON':insertBlock(rungId, 'TON', 'ton1', idx);break;
    case 'block-TOF':insertBlock(rungId, 'TOF', 'tof1', idx);break;
    case 'block-TP':insertBlock(rungId, 'TP', 'tp1', idx);break;
    case 'block-CTU':insertBlock(rungId, 'CTU', 'ctu1', idx);break;
    case 'block-CTD':insertBlock(rungId, 'CTD', 'ctd1', idx);break;
    case 'block-CTUD':insertBlock(rungId, 'CTUD', 'ctud1', idx);break;
    case 'block-SR':insertBlock(rungId, 'SR', 'sr1', idx);break;
    case 'block-RS':insertBlock(rungId, 'RS', 'rs1', idx);break;
    case 'block-RTRIG':insertBlock(rungId, 'RTRIG', 'rtrig1', idx);break;
    case 'block-FTRIG':insertBlock(rungId, 'FTRIG', 'ftrig1', idx);break;
    case 'block-EQ':insertBlock(rungId, 'EQ', 'eq1', idx);break;
    case 'block-NE':insertBlock(rungId, 'NE', 'ne1', idx);break;
    case 'block-GT':insertBlock(rungId, 'GT', 'gt1', idx);break;
    case 'block-GE':insertBlock(rungId, 'GE', 'ge1', idx);break;
    case 'block-LT':insertBlock(rungId, 'LT', 'lt1', idx);break;
    case 'block-LE':insertBlock(rungId, 'LE', 'le1', idx);break;
    case 'block-ADD':insertBlock(rungId, 'ADD', 'add1', idx);break;
    case 'block-SUB':insertBlock(rungId, 'SUB', 'sub1', idx);break;
    case 'block-MUL':insertBlock(rungId, 'MUL', 'mul1', idx);break;
    case 'block-DIV':insertBlock(rungId, 'DIV', 'div1', idx);break;
    case 'block-MOD':insertBlock(rungId, 'MOD', 'mod1', idx);break;
    case 'block-ABS':insertBlock(rungId, 'ABS', 'abs1', idx);break;
    case 'block-SQRT':insertBlock(rungId, 'SQRT', 'sqrt1', idx);break;
    case 'block-MOVE':insertBlock(rungId, 'MOVE', 'move1', idx);break;
    case 'block-SEL':insertBlock(rungId, 'SEL', 'sel1', idx);break;
    case 'block-LIMIT':insertBlock(rungId, 'LIMIT', 'limit1', idx);break;
    case 'block-MIN':insertBlock(rungId, 'MIN', 'min1', idx);break;
    case 'block-MAX':insertBlock(rungId, 'MAX', 'max1', idx);break;
  }
  // Warn in the console panel if the rung now has no output element
  warnIfNoOutput(rungId);
}

// Apply a new element as a parallel branch below the element identified by elId
function applyParallelDrop(rungId: string, kind: string, anchorElId: string) {
  const EMPTY_TAG = { name: '', dataType: 'BOOL' as const };
  undoRedoStore.push();
  logicStore.addParallelBranch(rungId, anchorElId, kind, EMPTY_TAG);
}

// ── Element Edit Modal ────────────────────────────────────────────────────────

const CONTACT_MODIFIERS = [
{ value: 'NO', label: 'Normally Open' },
{ value: 'NC', label: 'Normally Closed' },
{ value: 'P_CONTACT', label: 'Rising Edge (P)' },
{ value: 'N_CONTACT', label: 'Falling Edge (N)' }];


const COIL_MODIFIERS = [
{ value: 'normal', label: 'Output Coil' },
{ value: 'negated', label: 'NOT Coil' },
{ value: 'set', label: 'Set Coil (S)' },
{ value: 'reset', label: 'Reset Coil (R)' },
{ value: 'latch', label: 'Latch Coil (L)' },
{ value: 'unlatch', label: 'Unlatch Coil (U)' }];


// Small SVG previews for each contact modifier
const ContactPreview: React.FC<{type: string;}> = ({ type }) => {
  const variant = contactVariantOf(type);
  const stroke = C_FG;
  return (
    <svg width={56} height={56} viewBox="0 0 28 28" fill="none">
      <line x1="0.75" x2="0.75" y1="4" y2="24" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <line x1="27.25" x2="27.25" y1="4" y2="24" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      {variant === 'negated' && <line x1="5" y1="22" x2="23" y2="6" stroke={C_SEL} strokeWidth="1.5" />}
      {variant === 'risingEdge' && <text x="14" y="18" textAnchor="middle" fontSize="11" fill={C_SEL} fontFamily="monospace" fontWeight="bold">P</text>}
      {variant === 'fallingEdge' && <text x="14" y="18" textAnchor="middle" fontSize="11" fill={C_SEL} fontFamily="monospace" fontWeight="bold">N</text>}
    </svg>);

};

const CoilPreview: React.FC<{type: string;}> = ({ type }) => {
  const stroke = C_FG;
  const letter = type === 'set' ? 'S' : type === 'reset' ? 'R' : type === 'latch' ? 'L' : type === 'unlatch' ? 'U' :
  type === 'risingEdge' ? 'P' : type === 'fallingEdge' ? 'N' : null;
  const slash = type === 'negated';
  return (
    <svg width={68} height={56} viewBox="0 0 34 28" fill="none">
      <path d={COIL_LEFT} fill={stroke} />
      <path d={COIL_RIGHT} fill={stroke} />
      {slash && <line x1="8" y1="22" x2="26" y2="6" stroke={C_SEL} strokeWidth="1.5" />}
      {letter && <text x="17" y="17" textAnchor="middle" fontSize="10" fill={C_SEL} fontFamily="monospace" fontWeight="bold">{letter}</text>}
    </svg>);

};

const Inspector: React.FC<{
  elementId: string;rungId: string;
  elements: LadderElement[];onClose: () => void;
}> = ({ elementId, rungId, elements, onClose }) => {
  const el = elements.find((e) => e.id === elementId);

  const initType = el?.kind === 'contact' ? (el as any).type ?? 'NO' :
  el?.kind === 'coil' ? (el as any).type ?? 'normal' :
  null;
  const initTag = el?.kind !== 'block' ? (el as any).tag?.name ?? '' : (el as any).instanceName ?? '';

  const [modifierVal, setModifierVal] = useState<string>(initType ?? '');
  const [tagVal, setTagVal] = useState<string>(initTag);

  useEffect(() => {
    setModifierVal(el?.kind === 'contact' ? (el as any).type ?? 'NO' :
    el?.kind === 'coil' ? (el as any).type ?? 'normal' : '');
    setTagVal(el?.kind !== 'block' ? (el as any).tag?.name ?? '' : (el as any).instanceName ?? '');
  }, [elementId]);

  if (!el) return null;

  const isBlock = el.kind === 'block';
  const modifiers = el.kind === 'contact' ? CONTACT_MODIFIERS : el.kind === 'coil' ? COIL_MODIFIERS : [];
  const title = el.kind === 'contact' ? 'Edit Contact' : el.kind === 'coil' ? 'Edit Coil' : `Edit ${(el as any).fbType}`;

  const commit = () => {
    if (!isBlock) {
      logicStore.updateElement(rungId, elementId, {
        type: modifierVal,
        tag: { name: tagVal.trim(), dataType: 'BOOL' }
      } as any);
    } else {
      logicStore.updateElement(rungId, elementId, { instanceName: tagVal.trim() } as any);
    }
    onClose();
  };

  const changed = modifierVal !== initType || tagVal !== initTag;

  // Backdrop
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420, borderRadius: 8,
          background: 'var(--vscode-editor-background, #1e1e1e)',
          border: `1px solid ${C_BORDER}`,
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          overflow: 'hidden'
        }}>

        {/* Header */}
        <div style={{
          padding: '14px 18px 12px', borderBottom: `1px solid ${C_BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C_FG }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C_MUTED, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px', display: 'flex', gap: 20 }}>

          {/* Left: tag field + modifier list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Tag / instance name */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: C_MUTED, marginBottom: 6 }}>
                {isBlock ? 'Instance Name' : 'Tag Name'}
              </div>
              <input
                autoFocus
                value={tagVal}
                placeholder={isBlock ? 'e.g. ton1' : 'e.g. PB_START'}
                onChange={(e) => setTagVal(e.target.value)}
                onKeyDown={(e) => {if (e.key === 'Enter') commit();if (e.key === 'Escape') onClose();}}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '5px 9px',
                  background: 'var(--vscode-input-background, #3c3c3c)',
                  border: `1px solid var(--vscode-input-border, #555)`,
                  borderRadius: 4, color: C_FG, fontSize: 12, outline: 'none',
                  fontFamily: 'monospace'
                }} />

            </div>

            {/* Modifier list */}
            {modifiers.length > 0 &&
            <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: C_MUTED, marginBottom: 6 }}>
                  Modifier
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {modifiers.map((m) => {
                  const active = modifierVal === m.value;
                  return (
                    <label key={m.value} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
                      background: active ? `${C_SEL}22` : 'transparent',
                      border: `1px solid ${active ? C_SEL : 'transparent'}`,
                      transition: 'all 0.1s'
                    }}>
                        <input
                        type="radio"
                        name="modifier"
                        checked={active}
                        onChange={() => setModifierVal(m.value)}
                        style={{ accentColor: C_SEL, margin: 0 }} />

                        <span style={{ fontSize: 12, color: active ? C_FG : C_MUTED }}>{m.label}</span>
                      </label>);

                })}
                </div>
              </div>
            }
          </div>

          {/* Right: preview */}
          {!isBlock &&
          <div style={{
            width: 100, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--vscode-input-background, #3c3c3c)',
            borderRadius: 6, padding: '12px 8px', gap: 8
          }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', color: C_MUTED }}>Preview</div>
              {el.kind === 'contact' && <ContactPreview type={modifierVal} />}
              {el.kind === 'coil' && <CoilPreview type={modifierVal} />}
            </div>
          }
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 18px 14px', borderTop: `1px solid ${C_BORDER}`,
          display: 'flex', gap: 8, justifyContent: 'flex-end'
        }}>
          <button onClick={onClose} style={{
            padding: '6px 18px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
            background: 'transparent', border: `1px solid ${C_BORDER}`, color: C_FG
          }}>Cancel</button>
          <button
            onClick={commit}
            disabled={!changed && tagVal === initTag}
            style={{
              padding: '6px 18px', borderRadius: 4, border: 'none', cursor: changed ? 'pointer' : 'not-allowed',
              fontSize: 12, fontWeight: 600,
              background: changed ? 'var(--vscode-button-background, #0078d4)' : 'var(--vscode-button-background, #0078d4)',
              color: 'var(--vscode-button-foreground, #fff)',
              opacity: changed ? 1 : 0.5
            }}>
            Confirm</button>
        </div>
      </div>
    </div>);

};

// ── ForcePopover ──────────────────────────────────────────────────────────────
// Modal-style dialog matching Edit Coil / Edit Contact design language.
// Rendered via createPortal to document.body so it escapes any SVG/transform context.

interface ForceMenuState {x: number;y: number;tagName: string;}

const FORCE_W = 272;
const FORCE_H = 230;

const ForcePopover: React.FC<{
  menu: ForceMenuState;
  hasForcedValue: boolean;
  currentValue?: string;
  onClose: () => void;
}> = ({ menu, hasForcedValue, currentValue, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  // Smart position: prefer below cursor, flip above if needed
  const getPos = () => {
    let left = menu.x - FORCE_W / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - FORCE_W - 12));
    let top = menu.y + 12;
    if (top + FORCE_H > window.innerHeight - 12) top = menu.y - FORCE_H - 12;
    top = Math.max(12, top);
    return { top, left };
  };
  const [pos] = useState(getPos);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {if (e.key === 'Escape') onClose();};
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const isForcedTrue = hasForcedValue && (currentValue === 'TRUE' || currentValue === 'true');
  const isForcedFalse = hasForcedValue && !isForcedTrue;
  const displayVal = isForcedTrue ? 'FORCED TRUE' : isForcedFalse ? 'FORCED FALSE' : (currentValue ?? '—').toUpperCase();

  const modal =
  <div
    ref={ref}
    onMouseDown={(e) => e.stopPropagation()}
    style={{
      position: 'fixed', top: pos.top, left: pos.left,
      width: FORCE_W, zIndex: 9999,
      background: 'var(--vscode-editor-background, #1e1e1e)',
      border: '1px solid var(--vscode-contrastBorder, #6fc3df)',
      borderRadius: 6,
      boxShadow: '0 8px 32px rgba(0,0,0,.85)',
      overflow: 'hidden',
      fontFamily: 'var(--vscode-font-family, sans-serif)'
    }}>

      {/* Title bar — matches modal header style */}
      <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px 8px',
      borderBottom: '1px solid var(--vscode-editorGroup-border, #3c3c3c)',
      background: 'var(--vscode-sideBarSectionHeader-background, #252526)'
    }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vscode-editor-foreground, #ccc)' }}>
          Force Tag
        </span>
        <button onClick={onClose} style={{
        background: 'none', border: 'none',
        color: 'var(--vscode-descriptionForeground, #888)',
        cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px'
      }}>×</button>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Tag name row */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground, #888)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            TAG NAME
          </div>
          <div style={{
          padding: '5px 8px', borderRadius: 3, fontSize: 12,
          background: 'var(--vscode-input-background, #3c3c3c)',
          border: '1px solid var(--vscode-input-border, #555)',
          color: 'var(--vscode-editor-foreground, #ccc)',
          fontFamily: 'var(--vscode-editor-font-family, monospace)'
        }}>{menu.tagName}</div>
        </div>

        {/* Current value row */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground, #888)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            CURRENT VALUE
          </div>
          <div style={{
          padding: '5px 8px', borderRadius: 3, fontSize: 12,
          fontFamily: 'var(--vscode-editor-font-family, monospace)',
          background: 'var(--vscode-input-background, #3c3c3c)',
          border: `1px solid ${isForcedTrue ? '#80C000' : isForcedFalse ? '#4080FF' : 'var(--vscode-input-border, #555)'}`,
          color: isForcedTrue ? '#80C000' : isForcedFalse ? '#4080FF' : 'var(--vscode-editor-foreground, #ccc)'
        }}>{displayVal}</div>
        </div>

        {/* Force TRUE / Force FALSE buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
          onClick={() => {logicStore.forceTag(menu.tagName, 'TRUE');onClose();}}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontWeight: 600,
            border: `1px solid ${isForcedTrue ? '#80C000' : 'var(--vscode-button-background, #0e639c)'}`,
            background: isForcedTrue ? '#80C00033' : 'var(--vscode-button-background, #0e639c)',
            color: isForcedTrue ? '#80C000' : 'var(--vscode-button-foreground, #fff)'
          }}>
          Force TRUE</button>
          <button
          onClick={() => {logicStore.forceTag(menu.tagName, 'FALSE');onClose();}}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontWeight: 600,
            border: `1px solid ${isForcedFalse ? '#4080FF' : 'var(--vscode-button-secondaryBackground, #3a3d41)'}`,
            background: isForcedFalse ? '#4080FF33' : 'var(--vscode-button-secondaryBackground, #3a3d41)',
            color: isForcedFalse ? '#4080FF' : 'var(--vscode-button-secondaryForeground, #ccc)'
          }}>
          Force FALSE</button>
        </div>

        {/* Release Force */}
        <button
        onClick={() => {if (hasForcedValue) {logicStore.releaseForce(menu.tagName);onClose();}}}
        style={{
          width: '100%', padding: '6px 0', borderRadius: 3,
          cursor: hasForcedValue ? 'pointer' : 'default',
          fontSize: 11, fontWeight: 500,
          border: `1px solid ${hasForcedValue ? '#f59e0b' : 'var(--vscode-input-border, #555)'}`,
          background: 'transparent',
          color: hasForcedValue ? '#f59e0b' : 'var(--vscode-descriptionForeground, #888)',
          opacity: hasForcedValue ? 1 : 0.4
        }}>
        Release Force</button>
      </div>
    </div>;


  return createPortal(modal, document.body);
};

// ── LadderRung ────────────────────────────────────────────────────────────────

export interface LadderRungProps {
  rung: Rung;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDoubleClick: (id: string) => void;
  onAddRungAfter?: () => void;
  onDeleteRung?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}

export const LadderRung: React.FC<LadderRungProps> = ({
  rung, selectedId, onSelect, onDoubleClick, onAddRungAfter, onDeleteRung, dragHandleProps
}) => {
  const monitorMode = useLogicStoreSelector((s) => s.monitorMode);
  const tagDatabase = useLogicStoreSelector((s) => s.tagDatabase);

  const [inspectId, setInspectId] = useState<string | null>(null);
  const [forceMenu, setForceMenu] = useState<ForceMenuState | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number>(-1);
  const [activeParallelSlot, setActiveParallelSlot] = useState<number>(-1);
  const [draggingElIdx, setDraggingElIdx] = useState<number>(-1);
  const [overBranchId, setOverBranchId] = useState<string | null>(null);

  // Refs for values needed in drag handlers (avoid stale closures)
  const activeSlotRef = useRef<number>(-1);
  const activeParallelSlotRef = useRef<number>(-1);
  const reorderSrcRef = useRef<number>(-1); // index of element being reordered (-1 = not reordering)
  const slotsRef = useRef<Slot[]>([]);
  const parallelSlotsRef = useRef<ParallelSlot[]>([]);
  const rungIdRef = useRef<string>(rung.id);
  const elementsLenRef = useRef<number>(rung.elements.length);
  const canvasRef = useRef<HTMLDivElement>(null);

  const { elLayouts, slots, parallelSlots, rightRailX, totalW, canvasH: baseCanvasH } = React.useMemo(
    () => computeLayout(rung.elements),
    [rung.elements]
  );

  // Each branch row adds one element-height row below the main wire.
  // The vertical gap between main wire and branch wire = element half-height + spacing.
  const BRANCH_V_GAP = 36; // vertical distance from main wire center to branch wire center
  // Only count branches whose anchor element still exists on the main rail.
  // Orphaned branches (anchor deleted) are skipped during rendering.
  const anchorIds = new Set(elLayouts.map((l) => l.el.id));
  const canvasH = baseCanvasH + rung.branches.reduce((acc, branch) => {
    if (!anchorIds.has(branch.startNodeId)) return acc; // orphan — no height
    const maxBH = branch.elements.reduce((m, el) => Math.max(m, elH(el)), CONTACT_H);
    return acc + maxBH + BRANCH_V_GAP;
  }, 0);

  // Keep refs up-to-date with latest values
  slotsRef.current = slots;
  parallelSlotsRef.current = parallelSlots;
  rungIdRef.current = rung.id;
  elementsLenRef.current = rung.elements.length;

  const canvasW = Math.max(MIN_CANVAS_W, totalW);

  // ── Drag helpers ──────────────────────────────────────────────────────────

  const resetDragState = useCallback(() => {
    setIsDragOver(false);
    setActiveSlot(-1);
    setActiveParallelSlot(-1);
    setDraggingElIdx(-1);
    activeSlotRef.current = -1;
    activeParallelSlotRef.current = -1;
    reorderSrcRef.current = -1;
  }, []);

  // Returns nearest slot index and whether it's a parallel (bottom) slot.
  // Parallel slots compete on 2D distance; serial slots are distance on X only.
  // The closest one overall wins.
  const computeNearestActiveSlots = (clientX: number, clientY: number): {serial: number;parallel: number;} => {
    if (!canvasRef.current) return { serial: 0, parallel: -1 };
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = clientX - rect.left + canvasRef.current.scrollLeft;
    const mouseY = clientY - rect.top + canvasRef.current.scrollTop;

    const serial = slotsRef.current;
    let bestSerial = 0,bestSerialDist = Infinity;
    serial.forEach((slot, i) => {
      // Serial slots: 1D distance on X axis (they all sit at WIRE_Y)
      const d = Math.abs(mouseX - slot.cx);
      if (d < bestSerialDist) {bestSerialDist = d;bestSerial = i;}
    });

    const parallel = parallelSlotsRef.current;
    let bestParallel = -1,bestParallelDist = Infinity;
    parallel.forEach((slot, i) => {
      // Parallel slots: 2D Euclidean distance
      const dx = mouseX - slot.cx;
      const dy = mouseY - slot.cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestParallelDist) {bestParallelDist = d;bestParallel = i;}
    });

    // If mouse is significantly closer to a parallel slot, activate it exclusively
    const PARALLEL_THRESHOLD = 36; // px — how close to bottom slot before it wins
    if (bestParallel >= 0 && bestParallelDist < PARALLEL_THRESHOLD && bestParallelDist < bestSerialDist - 10) {
      return { serial: -1, parallel: bestParallel };
    }
    return { serial: bestSerial, parallel: -1 };
  };

  const isLDDrag = (dt: DataTransfer) =>
  dt.types.includes('application/plc-ladder-element') ||
  dt.types.includes('application/plc-element-reorder') ||
  reorderSrcRef.current >= 0; // reorder drag from same rung

  // ── Drag event handlers ───────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!isLDDrag(e.dataTransfer)) return;
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    // Ignore leave events that are just moving to a child element
    const { clientX: cx, clientY: cy } = e;
    if (cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom) return;
    // If we're reordering (drag started from this rung), keep slots visible
    if (reorderSrcRef.current >= 0) return;
    setIsDragOver(false);
    setActiveSlot(-1);
    activeSlotRef.current = -1;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isLDDrag(e.dataTransfer)) return;
    e.preventDefault();
    // Palette drag uses effectAllowed='copy'; reorder drag uses effectAllowed='move'.
    e.dataTransfer.dropEffect = reorderSrcRef.current >= 0 ? 'move' : 'copy';
    const { serial, parallel } = computeNearestActiveSlots(e.clientX, e.clientY);
    if (serial !== activeSlotRef.current) {
      setActiveSlot(serial);
      activeSlotRef.current = serial;
    }
    if (parallel !== activeParallelSlotRef.current) {
      setActiveParallelSlot(parallel);
      activeParallelSlotRef.current = parallel;
    }
    // Ensure slots are visible (covers case where dragenter didn't fire)
    if (!isDragOver) setIsDragOver(true);
  }, [isDragOver]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const rungId = rungIdRef.current;
    const fromIdx = reorderSrcRef.current;
    const pSlotIdx = activeParallelSlotRef.current;

    // Case 1: within-rung reorder — parallel slot not applicable
    if (fromIdx >= 0) {
      const slotIdx = activeSlotRef.current >= 0 ? activeSlotRef.current : slotsRef.current.length - 1;
      const toIdx = slotsRef.current[slotIdx]?.index ?? elementsLenRef.current;
      if (fromIdx !== toIdx && fromIdx !== toIdx - 1) {
        const finalTo = Math.min(toIdx > fromIdx ? toIdx - 1 : toIdx, elementsLenRef.current - 1);
        undoRedoStore.push();
        logicStore.moveElement(rungId, fromIdx, Math.max(0, finalTo));
      }
      resetDragState();
      return;
    }

    const kind = e.dataTransfer.getData('application/plc-ladder-element');
    if (!kind) {resetDragState();return;}

    // Case 2: drop onto a parallel (bottom) slot → add parallel branch
    if (pSlotIdx >= 0) {
      const ps = parallelSlotsRef.current[pSlotIdx];
      if (ps) {
        applyParallelDrop(rungId, kind, ps.elId);
        resetDragState();
        return;
      }
    }

    // Case 3: serial slot drop
    const slotIdx = activeSlotRef.current >= 0 ? activeSlotRef.current : slotsRef.current.length - 1;
    const toIdx = slotsRef.current[slotIdx]?.index ?? elementsLenRef.current;
    applyDrop(rungId, kind, toIdx);
    resetDragState();
  }, [resetDragState]);

  // Clean up drag state when drag ends anywhere on document
  useEffect(() => {
    const onDragEnd = () => {
      if (reorderSrcRef.current >= 0 || isDragOver) resetDragState();
    };
    document.addEventListener('dragend', onDragEnd);
    return () => document.removeEventListener('dragend', onDragEnd);
  }, [isDragOver, resetDragState]);

  // ── Wire energization — render-layer graph traversal ────────────────────
  // Mirrors the OpenPLC Editor approach: compute power flow directly from
  // live tag values in the render, not from evaluator-stored powerAfter.
  // Rule (IEC 61131-3):
  //   powerAfterElement(i) = powerBefore(i) AND elementConducts(i)
  //   contact_no : conducts when tagValue === true
  //   contact_nc : conducts when tagValue === false  (negated)
  //   coil       : always transparent (passes power through visually)
  //   block      : uses energized from evaluator (FB output unknown here)
  //   parallel branch bypasses its anchor: power after anchor =
  //     (anchor conducts) OR (branch conducts)
  const isRunning = monitorMode === 'running';

  // Helper: does a contact element conduct given its live tag value?
  const contactConductsRender = (el: LadderElement): boolean => {
    if (el.kind !== 'contact') return true; // coils/blocks treated as transparent
    const tagVal = tagDatabase.find((t) => t.name === (el as any).tag?.name);
    const live = tagVal?.forcedValue !== undefined && tagVal.forcedValue !== null && tagVal.forcedValue !== '' ?
    tagVal.forcedValue === 'TRUE' || tagVal.forcedValue === 'true' :
    tagVal?.liveValue === 'TRUE' || tagVal?.liveValue === 'true';
    const variant = (el as any).type as string; // 'NO' | 'NC' | 'P_CONTACT' | 'N_CONTACT'
    if (variant === 'NC') return !live;
    return live; // NO, P, N all treated as live value (edge detection not tracked here)
  };

  // Compute powerAfter for each main-rail element index (includes branch bypass)
  // powerAfterArr[i] = power exiting right side of element[i]
  const powerAfterArr: boolean[] = [];
  if (isRunning) {
    for (let i = 0; i < elLayouts.length; i++) {
      const el = elLayouts[i].el;
      const powerIn = i === 0 ? true : powerAfterArr[i - 1];
      if (!powerIn) {powerAfterArr.push(false);continue;}
      if (el.kind === 'coil' || el.kind === 'block') {
        // Coils are transparent for wire color; blocks use evaluator energized
        powerAfterArr.push(el.kind === 'coil' ? true : !!el.energized);
        continue;
      }
      // Contact: check if this element has a parallel branch that bypasses it
      const bypass = rung.branches.some((br) => {
        if (br.startNodeId !== el.id) return false;
        if (br.elements.length === 0) return true; // empty branch = short circuit
        // All branch elements must conduct for branch to pass power
        let branchPower = true;
        for (const bel of br.elements) {
          if (!branchPower) break;
          branchPower = contactConductsRender(bel);
        }
        return branchPower;
      });
      const thisConducts = contactConductsRender(el);
      powerAfterArr.push(thisConducts || bypass);
    }
  }

  const wireSegments: {x1: number;x2: number;energized: boolean;}[] = [];
  if (elLayouts.length === 0) {
    wireSegments.push({ x1: RAIL_W, x2: rightRailX, energized: false });
  } else {
    wireSegments.push({ x1: RAIL_W, x2: elLayouts[0].x, energized: isRunning });
    for (let i = 0; i < elLayouts.length - 1; i++) {
      wireSegments.push({ x1: elLayouts[i].x + elLayouts[i].w, x2: elLayouts[i + 1].x, energized: isRunning && powerAfterArr[i] });
    }
    const lastLayout = elLayouts[elLayouts.length - 1];
    const lastIdx = elLayouts.length - 1;
    wireSegments.push({ x1: lastLayout.x + lastLayout.w, x2: rightRailX, energized: isRunning && powerAfterArr[lastIdx] });
  }

  // Junction dots: where branch vertical bars touch the main wire
  // Each branch contributes two junctions: leftBarX and rightBarX at WIRE_Y
  const junctionDots: {cx: number;}[] = rung.branches.flatMap((branch) => {
    const anchorLayout = elLayouts.find((l) => l.el.id === branch.startNodeId);
    if (!anchorLayout) return [];
    return [
    { cx: anchorLayout.x - GAP / 2 },
    { cx: anchorLayout.x + anchorLayout.w + GAP / 2 }];

  });

  return (
    <div style={{ background: C_BG, position: 'relative', minWidth: 0, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{
        height: RUNG_HEADER_H, display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 6px', background: C_HDR_BG,
        borderBottom: `1px solid ${C_BORDER}`, userSelect: 'none', flexShrink: 0
      }}>
        {/* Drag handle — receives dnd-kit listeners from parent SortableRung */}
        <span
          {...dragHandleProps ?? {}}
          title="Drag to reorder"
          style={{ color: C_MUTED, fontSize: 13, cursor: 'grab', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>
          ⠿</span>

        {/* Rung number badge */}
        <span style={{
          minWidth: 20, height: 18, borderRadius: 9, padding: '0 5px',
          background: rung.energized ? C_ENRG : 'var(--vscode-badge-background, #3a3a3a)',
          color: 'var(--vscode-badge-foreground, #fff)',
          fontSize: 10, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>{rung.number}</span>

        {/* Energized dot */}
        <div style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: rung.energized ? C_ENRG : C_BORDER,
          boxShadow: rung.energized ? `0 0 5px ${C_ENRG}` : 'none'
        }} />

        {/* Comment — takes remaining space */}
        <CommentField rungId={rung.id} comment={rung.comment} />

        {/* No-output warning */}
        {(() => {
          const hasOutput = rung.elements.some((e) => e.kind === 'coil' || e.kind === 'block');
          const showNoOutputWarning = rung.elements.length > 0 && !hasOutput;
          return showNoOutputWarning ?
          <span
            title="No output element (coil/block) — rung will not drive any tag"
            style={{ color: 'var(--vscode-editorWarning-foreground, #f0ab00)', fontSize: 12, flexShrink: 0, lineHeight: 1 }}>
            ⚠</span> :
          null;
        })()}

        {/* Action buttons — right-aligned */}
        {onAddRungAfter &&
        <button title="Duplicate rung" onClick={onAddRungAfter} style={{
          width: 22, height: 22, borderRadius: 4, border: 'none', cursor: 'pointer',
          background: 'transparent', color: C_MUTED, fontSize: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vscode-toolbar-hoverBackground, rgba(90,93,94,0.31))'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          ⧉</button>
        }
        {onDeleteRung &&
        <button title="Delete rung" onClick={onDeleteRung} style={{
          width: 22, height: 22, borderRadius: 4, border: 'none', cursor: 'pointer',
          background: 'transparent', color: C_MUTED, fontSize: 14, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vscode-toolbar-hoverBackground, rgba(90,93,94,0.31))'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          ×</button>
        }
      </div>

      {/* ── Canvas — grows vertically, scrolls horizontally ── */}
      <div
        ref={canvasRef}
        style={{
          overflowX: 'auto', overflowY: 'visible',
          width: '100%', minWidth: 0,
          padding: '4px 8px 12px 8px',
          boxSizing: 'border-box',
          outline: isDragOver ? `1px dashed ${C_SEL}` : 'none',
          outlineOffset: -2
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}>

        <div
          style={{ position: 'relative', width: canvasW, height: canvasH, flexShrink: 0 }}
          onClick={() => {onSelect(null);setInspectId(null);}}>

          {/* SVG layer: power rails + wires + element glyphs (pointer-events none so drag passes to overlay divs) */}
          <svg
            width={canvasW}
            height={canvasH}
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>

            {/* Left power rail — green whenever simulation is running (it is the power bus source) */}
            <rect x={0} y={RAIL_Y} width={RAIL_W} height={RAIL_H_PX} fill={isRunning ? C_ENRG : C_RAIL} />
            {/* Right power rail — green when last wire is energized (circuit is complete) */}
            <rect x={rightRailX} y={RAIL_Y} width={RAIL_W} height={RAIL_H_PX}
            fill={wireSegments.length > 0 && wireSegments[wireSegments.length - 1].energized ? C_ENRG : C_RAIL} />
            {/* Horizontal wires at WIRE_Y */}
            {wireSegments.map((seg, i) =>
            <line key={i} x1={seg.x1} y1={WIRE_Y} x2={seg.x2} y2={WIRE_Y}
            stroke={seg.energized ? C_ENRG : C_FG} strokeWidth={seg.energized ? 2.5 : 2}
            style={seg.energized ? { filter: 'drop-shadow(0 0 3px #22c55e)' } : undefined} />
            )}
            {/* Junction dots where branch vertical bars meet the main wire */}
            {junctionDots.map((j, i) =>
            <circle key={`jd${i}`} cx={j.cx} cy={WIRE_Y} r={3} fill={C_FG} />
            )}
            {/* Element glyphs — ghost out the element being reordered */}
            {elLayouts.map(({ el, x, y }, elIdx) => {
              const sel = el.id === selectedId;
              // Glyph: power arrived at this element AND it conducted (or is a coil/block that received power)
              const powerIn = elIdx === 0 ? isRunning : isRunning && (powerAfterArr[elIdx - 1] ?? false);
              const enrg = powerIn && (el.kind === 'coil' ? !!el.energized : el.kind === 'block' ? !!el.energized : contactConductsRender(el));
              const opacity = draggingElIdx === elIdx ? 0.25 : 1;
              const tagName = el.kind === 'block' ?
              (el as any).instanceName ?? '' :
              (el as any).tag?.name ?? '';
              const tagEntry = tagDatabase.find((t) => t.name === tagName);
              const forcedState: 'true' | 'false' | null = tagEntry?.forcedValue === 'TRUE' || tagEntry?.forcedValue === 'true' ? 'true' :
              tagEntry?.forcedValue === 'FALSE' || tagEntry?.forcedValue === 'false' ? 'false' : null;
              if (el.kind === 'contact') return renderContact(el, x, y, sel, enrg, opacity, forcedState);
              if (el.kind === 'coil') return renderCoil(el, x, y, sel, enrg, opacity, forcedState);
              return renderBlock(el, x, y, sel, enrg, opacity, forcedState);
            })}

            {/* Parallel branch rows — each branch forms an enclosed box below the main wire.
                 The box spans from the wire-junction BEFORE the anchor element to the junction AFTER it.
                 Left bar X  = midpoint of the gap before the anchor element on the main wire.
                 Right bar X = midpoint of the gap after the anchor element on the main wire.
                 Branch wire is horizontal at branchWireY, running between leftBarX and rightBarX.
                 Elements in the branch start at leftBarX + GAP/2 (wire entry gap). */}
            {(() => {
              let yOffset = baseCanvasH;
              return rung.branches.map((branch) => {
                const maxBH = branch.elements.reduce((m, el) => Math.max(m, elH(el)), CONTACT_H);
                // Branch wire sits below the main wire; vertically centered in the extra height
                const branchWireY = yOffset + BRANCH_V_GAP / 2 + maxBH / 2;
                yOffset += maxBH + BRANCH_V_GAP;

                // Find the anchor element (the main-wire element this branch parallels).
                // If the anchor no longer exists (was deleted), skip rendering this branch
                // entirely — dangling branch wires with no anchor are confusing and incorrect.
                const anchorIdx = elLayouts.findIndex((l) => l.el.id === branch.startNodeId);
                const anchorLayout = anchorIdx >= 0 ? elLayouts[anchorIdx] : null;
                if (!anchorLayout) return null;

                // Left junction: midpoint of gap BEFORE anchor element
                // = anchor.x - GAP/2  (i.e. the slot diamond position before the element)
                const leftBarX = anchorLayout ?
                anchorLayout.x - GAP / 2 :
                RAIL_W + GAP / 2;

                // Right junction: midpoint of gap AFTER anchor element
                // = anchor.x + anchor.w + GAP/2
                const rightBarX = anchorLayout ?
                anchorLayout.x + anchorLayout.w + GAP / 2 :
                rightRailX - GAP / 2;

                // Lay out branch elements within the same horizontal span [leftBarX … rightBarX].
                // Start the first element's left edge at leftBarX + GAP/2 (mirroring main wire entry gap).
                let bCurX = leftBarX + GAP / 2;
                const branchLayouts: {el: LadderElement;bx: number;by: number;bw: number;bh: number;}[] = [];
                for (const bel of branch.elements) {
                  const bw = elW(bel);const bh = elH(bel);
                  branchLayouts.push({ el: bel, bx: bCurX, by: branchWireY - bh / 2, bw, bh });
                  bCurX += bw + GAP / 2;
                }

                const isRunning2 = monitorMode === 'running';

                // Power at the left bar = power arriving at the anchor's left side.
                // Use powerAfterArr from the main-rail traversal above (same render-layer computation).
                const powerAtLeftBar = (() => {
                  if (!isRunning2) return false;
                  if (anchorIdx < 0) return false;
                  if (anchorIdx === 0) return true; // anchor is first — fed directly by left rail
                  return powerAfterArr[anchorIdx - 1] ?? false;
                })();

                // Branch power flow: chain through branch elements from left bar
                const branchPowerArr: boolean[] = [];
                if (isRunning2 && powerAtLeftBar) {
                  for (let bi = 0; bi < branchLayouts.length; bi++) {
                    const bel = branchLayouts[bi].el;
                    const bPowerIn = bi === 0 ? true : branchPowerArr[bi - 1];
                    if (!bPowerIn) {branchPowerArr.push(false);continue;}
                    if (bel.kind === 'coil') {branchPowerArr.push(true);continue;}
                    branchPowerArr.push(contactConductsRender(bel));
                  }
                } else {
                  for (let bi = 0; bi < branchLayouts.length; bi++) branchPowerArr.push(false);
                }

                const branchEnergized = isRunning2 && (branchLayouts.length === 0 ?
                powerAtLeftBar :
                branchPowerArr[branchPowerArr.length - 1] ?? false);

                // Wire segments with energization — use render-layer branchPowerArr
                const branchWires: {x1: number;x2: number;energized: boolean;}[] = [];
                if (branchLayouts.length === 0) {
                  branchWires.push({ x1: leftBarX, x2: rightBarX, energized: branchEnergized });
                } else {
                  branchWires.push({ x1: leftBarX, x2: branchLayouts[0].bx, energized: powerAtLeftBar });
                  for (let i = 0; i < branchLayouts.length - 1; i++) {
                    branchWires.push({ x1: branchLayouts[i].bx + branchLayouts[i].bw, x2: branchLayouts[i + 1].bx, energized: isRunning2 && (branchPowerArr[i] ?? false) });
                  }
                  const lastBi = branchLayouts.length - 1;
                  branchWires.push({ x1: branchLayouts[lastBi].bx + branchLayouts[lastBi].bw, x2: rightBarX, energized: branchEnergized });
                }

                const branchLive = branchEnergized;
                const leftBarColor = powerAtLeftBar ? C_ENRG : C_FG;
                const rightBarColor = branchLive ? C_ENRG : C_FG;

                return (
                  <g key={branch.id}>
                    {/* Left vertical bar — energized when power reaches the branch entry point */}
                    <line x1={leftBarX} y1={WIRE_Y} x2={leftBarX} y2={branchWireY}
                    stroke={leftBarColor} strokeWidth={powerAtLeftBar ? 2.5 : 2}
                    style={powerAtLeftBar ? { filter: 'drop-shadow(0 0 3px #22c55e)' } : undefined} />
                    {/* Right vertical bar — energized when branch path delivers power */}
                    <line x1={rightBarX} y1={branchWireY} x2={rightBarX} y2={WIRE_Y}
                    stroke={rightBarColor} strokeWidth={branchLive ? 2.5 : 2}
                    style={branchLive ? { filter: 'drop-shadow(0 0 3px #22c55e)' } : undefined} />
                    {/* Horizontal branch wire segments */}
                    {branchWires.map((seg, i) =>
                    <line key={i} x1={seg.x1} y1={branchWireY} x2={seg.x2} y2={branchWireY}
                    stroke={seg.energized ? C_ENRG : C_FG} strokeWidth={seg.energized ? 2.5 : 2}
                    style={seg.energized ? { filter: 'drop-shadow(0 0 3px #22c55e)' } : undefined} />
                    )}
                    {/* Branch element glyphs — use actual energized state */}
                    {branchLayouts.map(({ el, bx, by }, bi) => {
                      const sel = el.id === selectedId;
                      // Glyph lights up when power reached this element AND it conducted
                      const bPowerIn = bi === 0 ? powerAtLeftBar : branchPowerArr[bi - 1] ?? false;
                      const enrg = isRunning2 && bPowerIn && contactConductsRender(el);
                      const bTagName = el.kind === 'block' ? (el as any).instanceName ?? '' : (el as any).tag?.name ?? '';
                      const bTagEntry = tagDatabase.find((t) => t.name === bTagName);
                      const bForcedState: 'true' | 'false' | null = bTagEntry?.forcedValue === 'TRUE' || bTagEntry?.forcedValue === 'true' ? 'true' :
                      bTagEntry?.forcedValue === 'FALSE' || bTagEntry?.forcedValue === 'false' ? 'false' : null;
                      if (el.kind === 'contact') return renderContact(el, bx, by, sel, enrg, 1, bForcedState);
                      if (el.kind === 'coil') return renderCoil(el, bx, by, sel, enrg, 1, bForcedState);
                      return renderBlock(el, bx, by, sel, enrg, 1, bForcedState);
                    })}
                  </g>);

              });
            })()}
          </svg>

          {/* Drag slot overlay — all insertion diamonds shown simultaneously */}
          {isDragOver &&
          <svg
            width={canvasW}
            height={canvasH}
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>

              {/* Serial (left/right) slot diamonds on the wire */}
              {slots.map((slot, i) => {
              const isActive = activeSlot === i;
              const cx = slot.cx;
              if (isActive) {
                return (
                  <g key={i}>
                      <line x1={cx} y1={RAIL_Y - 2} x2={cx} y2={RAIL_Y + RAIL_H_PX + 2}
                    stroke={C_SEL} strokeWidth={2} strokeDasharray="4 3" opacity={0.7} />
                      <polygon
                      points={`${cx},${WIRE_Y - 8} ${cx + 8},${WIRE_Y} ${cx},${WIRE_Y + 8} ${cx - 8},${WIRE_Y}`}
                      fill={C_SEL} />

                    </g>);

              }
              return (
                <polygon key={i}
                points={`${cx},${WIRE_Y - 5} ${cx + 5},${WIRE_Y} ${cx},${WIRE_Y + 5} ${cx - 5},${WIRE_Y}`}
                fill="none"
                stroke={C_SEL}
                strokeWidth={1.5}
                opacity={0.45} />);


            })}
              {/* Parallel (bottom) slot diamonds below each element */}
              {parallelSlots.map((ps, i) => {
              const isActive = activeParallelSlot === i;
              const { cx, cy } = ps;
              if (isActive) {
                return (
                  <g key={`p${i}`}>
                      {/* Vertical connector from element bottom to diamond */}
                      <line x1={cx} y1={cy - PARALLEL_SLOT_GAP} x2={cx} y2={cy - 8}
                    stroke={C_SEL} strokeWidth={1.5} strokeDasharray="3 2" opacity={0.7} />
                      <polygon
                      points={`${cx},${cy - 8} ${cx + 8},${cy} ${cx},${cy + 8} ${cx - 8},${cy}`}
                      fill={C_SEL} />

                    </g>);

              }
              return (
                <g key={`p${i}`}>
                    <line x1={cx} y1={cy - PARALLEL_SLOT_GAP} x2={cx} y2={cy - 4}
                  stroke={C_SEL} strokeWidth={1} opacity={0.25} />
                    <polygon
                    points={`${cx},${cy - 4} ${cx + 4},${cy} ${cx},${cy + 4} ${cx - 4},${cy}`}
                    fill="none"
                    stroke={C_SEL}
                    strokeWidth={1.5}
                    opacity={0.35} />

                  </g>);

            })}
            </svg>
          }

          {/* HTML label overlay — one div per element, positioned above the glyph.
                Uses overflow:hidden + textOverflow:ellipsis so long names truncate cleanly
                without bleeding into neighboring element space. */}
          {elLayouts.map(({ el, x, y, w, h }) => {
            const tagName = el.kind === 'block' ?
            (el as any).instanceName ?? '' :
            (el as any).tag?.name ?? '';
            const tagEntry = tagDatabase.find((t) => t.name === tagName);
            const isForced = !!tagEntry?.forcedValue;
            const liveValue = tagEntry?.liveValue;
            const showLive = monitorMode === 'running' && liveValue !== undefined;
            return (
              <React.Fragment key={`lbl-${el.id}`}>
                {/* Tag name label */}
                <div style={{
                  position: 'absolute',
                  left: x,
                  top: y - LABEL_H,
                  width: w,
                  height: LABEL_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  overflow: 'hidden'
                }}>
                  <span style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    fontWeight: 500,
                    color: tagName ? C_MUTED : 'rgba(136,136,136,0.4)',
                    fontStyle: tagName ? 'normal' : 'italic',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    paddingLeft: 2,
                    paddingRight: 2,
                    boxSizing: 'border-box' as const
                  }} title={tagName}>
                    {tagName || '…'}
                  </span>
                </div>
                {/* Forced "F" badge */}
                {isForced &&
                <div style={{
                  position: 'absolute',
                  left: x + w - 10,
                  top: y - 4,
                  width: 10, height: 10,
                  background: '#f97316',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 7, fontWeight: 800, fontFamily: 'monospace',
                  color: '#fff', borderRadius: 1,
                  zIndex: 2, pointerEvents: 'none'
                }}>F</div>
                }
                {/* Live value badge */}
                {showLive &&
                <div style={{
                  position: 'absolute',
                  left: x + w / 2 - 16,
                  top: y + h + 2,
                  minWidth: 32, height: 14,
                  background: liveValue === 'TRUE' || liveValue === 'true' ? '#166534' : '#374151',
                  borderRadius: 7,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 700, fontFamily: 'monospace',
                  color: liveValue === 'TRUE' || liveValue === 'true' ? '#4ade80' : '#9ca3af',
                  paddingLeft: 4, paddingRight: 4, boxSizing: 'border-box',
                  zIndex: 2, pointerEvents: 'none'
                }}>{liveValue}</div>
                }
              </React.Fragment>);

          })}

          {/* Click-target + drag-source overlay divs (transparent, on top of SVG) */}
          {elLayouts.map(({ el, x, y, w, h }, elIdx) =>
          <div
            key={el.id}
            draggable
            onDragStart={(e) => {
              // Transparent ghost — element SVG stays visible (ghosted) in place
              const ghost = document.createElement('div');
              ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
              document.body.appendChild(ghost);
              e.dataTransfer.setDragImage(ghost, 0, 0);
              setTimeout(() => ghost.remove(), 0);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('application/plc-element-reorder', String(elIdx));
              reorderSrcRef.current = elIdx;
              setDraggingElIdx(elIdx);
              setIsDragOver(true);
              setActiveSlot(-1);
              activeSlotRef.current = -1;
            }}
            onDragEnd={resetDragState}
            onDragOver={(e) => {
              // Pass palette drags through to the canvas drop zone beneath this overlay
              if (e.dataTransfer.types.includes('application/plc-ladder-element')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }
            }}
            onDrop={(e) => {
              if (e.dataTransfer.types.includes('application/plc-ladder-element')) {
                handleDrop(e);
              }
            }}
            onClick={(e) => {e.stopPropagation();onSelect(el.id);}}
            onDoubleClick={(e) => {
              e.stopPropagation();
              const tagName = el.kind === 'block' ?
              (el as any).instanceName ?? '' :
              (el as any).tag?.name ?? '';
              if (monitorMode === 'running' && tagName) {
                setForceMenu({ x: e.clientX, y: e.clientY, tagName });
              } else {
                // No tag assigned yet (or not running) — open inspector to assign tag
                setInspectId(el.id);
                onDoubleClick(el.id);
              }
            }}
            style={{
              position: 'absolute',
              left: x - 4, top: y - 4,
              width: w + 8, height: h + 8,
              cursor: 'grab',
              zIndex: 1
            }} />

          )}

          {/* Click targets for branch elements (non-draggable, just select/inspect) */}
          {(() => {
            let yOff = baseCanvasH;
            return rung.branches.flatMap((branch) => {
              const maxBH = branch.elements.reduce((m, el) => Math.max(m, elH(el)), CONTACT_H);
              const branchWireY = yOff + BRANCH_V_GAP / 2 + maxBH / 2;
              yOff += maxBH + BRANCH_V_GAP;
              const anchorLayout = elLayouts.find((l) => l.el.id === branch.startNodeId);
              const leftBarX = anchorLayout ? anchorLayout.x - GAP / 2 : RAIL_W + GAP / 2;
              let bCurX = leftBarX + GAP / 2;
              return branch.elements.map((bel) => {
                const bw = elW(bel);const bh = elH(bel);
                const bx = bCurX;const by = branchWireY - bh / 2;
                bCurX += bw + GAP / 2;
                return (
                  <div key={bel.id}
                  onClick={(e) => {e.stopPropagation();onSelect(bel.id);}}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const tagName = bel.kind === 'block' ?
                    (bel as any).instanceName ?? '' :
                    (bel as any).tag?.name ?? '';
                    if (monitorMode === 'running' && tagName) {
                      setForceMenu({ x: e.clientX, y: e.clientY, tagName });
                    } else {
                      setInspectId(bel.id);
                      onDoubleClick(bel.id);
                    }
                  }}
                  style={{ position: 'absolute', left: bx - 4, top: by - 4, width: bw + 8, height: bh + 8, cursor: 'pointer', zIndex: 1 }} />);


              });
            });
          })()}

          {/* Branch drop zone overlays — allow dropping palette elements into existing branches */}
          {(() => {
            let yOff = baseCanvasH;
            return rung.branches.map((branch) => {
              const maxBH = branch.elements.reduce((m, el) => Math.max(m, elH(el)), CONTACT_H);
              const branchWireY = yOff + BRANCH_V_GAP / 2 + maxBH / 2;
              const zoneTop = branchWireY - maxBH / 2 - 4;
              const zoneHeight = maxBH + 8;
              yOff += maxBH + BRANCH_V_GAP;
              const anchorLayout = elLayouts.find((l) => l.el.id === branch.startNodeId);
              if (!anchorLayout) return null;
              const leftBarX = anchorLayout.x - GAP / 2;
              const rightBarX = anchorLayout.x + anchorLayout.w + GAP / 2;
              const zoneLeft = leftBarX;
              const zoneWidth = rightBarX - leftBarX;
              const isOver = overBranchId === branch.id;
              return (
                <div
                  key={`bdrop-${branch.id}`}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes('application/plc-ladder-element')) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                    setOverBranchId(branch.id);
                  }}
                  onDragLeave={(e) => {
                    if (overBranchId === branch.id) setOverBranchId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const kind = e.dataTransfer.getData('application/plc-ladder-element');
                    if (!kind) {setOverBranchId(null);return;}
                    const newEl = makeBranchElement(kind);
                    if (newEl) addElementToBranch(rung.id, branch.id, newEl);
                    setOverBranchId(null);
                  }}
                  style={{
                    position: 'absolute',
                    left: zoneLeft,
                    top: zoneTop,
                    width: zoneWidth,
                    height: zoneHeight,
                    zIndex: 2,
                    border: isOver ? '2px dashed #3b82f6' : '2px dashed transparent',
                    borderRadius: 4,
                    background: isOver ? 'rgba(59,130,246,0.08)' : 'transparent',
                    boxSizing: 'border-box',
                    pointerEvents: 'all',
                    transition: 'border-color 0.1s, background 0.1s'
                  }} />);


            });
          })()}
        </div>
      </div>

      {/* ── Inspector popup ── */}
      {inspectId &&
      <Inspector
        elementId={inspectId}
        rungId={rung.id}
        elements={[...rung.elements, ...rung.branches.flatMap((b) => b.elements)]}
        onClose={() => setInspectId(null)} />

      }

      {/* ── Force popover ── */}
      {forceMenu && (() => {
        const fmTag = tagDatabase.find((t) => t.name === forceMenu.tagName);
        return (
          <ForcePopover
            menu={forceMenu}
            hasForcedValue={!!fmTag?.forcedValue}
            currentValue={fmTag?.forcedValue ?? fmTag?.liveValue}
            onClose={() => setForceMenu(null)} />);


      })()}
    </div>);

};

// ── CommentField ──────────────────────────────────────────────────────────────

const CommentField: React.FC<{rungId: string;comment: string;}> = ({ rungId, comment }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment);
  useEffect(() => {setDraft(comment);}, [comment]);

  if (editing) {
    return (
      <input autoFocus value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {logicStore.updateRungComment(rungId, draft);setEditing(false);}}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {logicStore.updateRungComment(rungId, draft);setEditing(false);}
        if (e.key === 'Escape') {setDraft(comment);setEditing(false);}
      }}
      placeholder="Add comment..."
      style={{
        flex: 1, background: 'transparent', border: `1px solid ${C_SEL}`,
        color: C_FG, fontSize: 11, padding: '1px 5px', borderRadius: 3, outline: 'none'
      }} />);


  }
  return (
    <span onClick={() => setEditing(true)} style={{
      flex: 1, fontSize: 11, cursor: 'text', overflow: 'hidden',
      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      color: comment ? C_FG : C_MUTED, fontStyle: comment ? 'normal' : 'italic'
    }}>
      {comment || 'Add comment...'}
    </span>);

};

export default LadderRung;