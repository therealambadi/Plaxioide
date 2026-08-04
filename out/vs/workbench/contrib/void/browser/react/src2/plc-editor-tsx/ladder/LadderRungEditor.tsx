/*
 * LadderRungEditor — Production-grade single rung renderer.
 *
 * Layout architecture:
 *   ║──[el]──[el]──[el]──║   ← main horizontal strip
 *    ╰─[el]─[el]─╯           ← parallel branch (OR path)
 *
 * Wire alignment:
 *   - Contact/coil SVGs have wire midline at y=EL_MID=40 (within EL_H=68)
 *   - Flex container uses calculated paddingTop/Bottom to align wire on flex center
 *   - Function blocks connect via their first input pin Y coordinate
 *   - All horizontal wires are 2px divs positioned at the flex midline
 *
 * Drop target:
 *   - Entire rung body detects dragOver/drop events
 *   - Calculates drop insertion point based on mouse X coordinate
 *   - Visual feedback: subtle background + dashed border during drag
 *
 * Parallel branches:
 *   - Rendered below main strip
 *   - Left/right vertical junction wires connect to main wire midline
 *   - Each branch has proper U-shaped border with contained elements
 */

import React, { useState, useCallback, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Rung, LadderElement, logicStore, useLogicStoreSelector } from '../logicStore.js';
import {
  LadderElementRenderer,
  EL_H, EL_MID, EL_W, BLOCK_W, LABEL_H,
  blockHeight, blockMidY, FB_PINS } from
'./LadderElementRenderer.js';
import { updateElementTag, setRungComment } from './ladderCommands.js';
import { applyElementDrop, PaletteItemKind } from './LadderCanvas.js';

// ── Layout constants ──────────────────────────────────────────────────────────
const RAIL_W = 6; // power rail bar width
const LEAD_W = 20; // lead/trail wire (rail ↔ first/last element)
const WIRE_W = 16; // wire between consecutive elements
// Element total height = LABEL_H (html label) + EL_H (svg).
// Wire midline is at LABEL_H + EL_MID from element top.
// Flex container aligns items at its vertical center. To put the wire at the center
// we add paddingTop to shift the flex center down to match EL_MID inside the SVG portion.
// Net offset = (LABEL_H + EL_MID) - (LABEL_H + EL_H)/2 = EL_MID - EL_H/2 + LABEL_H/2
const RUNG_PT = EL_MID - EL_H / 2 + LABEL_H / 2 + 6;
const RUNG_PB = EL_H - EL_MID + LABEL_H / 2 + 6;

// ── Colors ─────────────────────────────────────────────────────────────────────
const C_RAIL = 'var(--vscode-focusBorder)';
const C_WIRE = 'var(--vscode-editor-foreground)';
const C_ENRG = 'var(--vscode-charts-green, #22c55e)';
const C_BG = 'var(--vscode-editor-background)';
const C_HDR = 'var(--vscode-sideBar-background)';
const C_LINE = 'var(--vscode-editorGroup-border)';
const C_MUTED = 'var(--vscode-descriptionForeground)';
const C_FG = 'var(--vscode-editor-foreground)';
const C_DROP = 'var(--vscode-list-hoverBackground)';
const C_DROPB = 'var(--vscode-focusBorder)';

// ── Power rail ─────────────────────────────────────────────────────────────────
const Rail: React.FC<{side: 'left' | 'right';energized?: boolean;}> = ({ side, energized }) =>
<div style={{
  width: RAIL_W,
  alignSelf: 'stretch',
  flexShrink: 0,
  background: energized ? C_ENRG : C_RAIL,
  borderRadius: 1,
  boxShadow: energized ? `0 0 8px ${C_ENRG}` : 'none'
}} />;


// ── Horizontal wire ────────────────────────────────────────────────────────────
const Wire: React.FC<{w?: number;energized?: boolean;}> = ({ w = WIRE_W, energized }) =>
<div style={{
  width: w, height: 2,
  flexShrink: 0,
  alignSelf: 'center',
  background: energized ? C_ENRG : C_WIRE,
  boxShadow: energized ? `0 0 4px ${C_ENRG}` : 'none'
}} />;


// ── Rung header ────────────────────────────────────────────────────────────────
const RungHeader: React.FC<{
  rung: Rung;onDelete: () => void;onInsertAfter: () => void;
}> = ({ rung, onDelete, onInsertAfter }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rung.comment);

  const commit = useCallback(() => {
    setRungComment(rung.id, draft);
    setEditing(false);
  }, [rung.id, draft]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 28, padding: '0 10px', flexShrink: 0,
      background: C_HDR, borderBottom: `1px solid ${C_LINE}`,
      fontSize: 11
    }}>
      {/* Rung number badge */}
      <span style={{
        minWidth: 20, textAlign: 'center',
        fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
        padding: '2px 6px', borderRadius: 3, lineHeight: '16px',
        background: 'var(--vscode-badge-background)',
        color: 'var(--vscode-badge-foreground)',
        flexShrink: 0
      }}>{rung.number}</span>

      {/* Energized indicator */}
      <div style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: rung.energized ? C_ENRG : C_LINE,
        boxShadow: rung.energized ? `0 0 6px ${C_ENRG}` : 'none'
      }} />

      {/* Comment */}
      {editing ?
      <input autoFocus value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {setDraft(rung.comment);setEditing(false);}
      }}
      style={{
        flex: 1, fontSize: 11, padding: '3px 7px', outline: 'none',
        background: 'var(--vscode-input-background)',
        border: '1px solid var(--vscode-focusBorder)',
        borderRadius: 3, color: C_FG
      }} /> :


      <span
        title="Click to edit comment"
        onClick={() => setEditing(true)}
        style={{
          flex: 1, cursor: 'text',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: rung.comment ? C_FG : C_MUTED,
          fontStyle: rung.comment ? 'normal' : 'italic',
          transition: 'color 0.12s'
        }}
        onMouseEnter={(e) => !rung.comment && (e.currentTarget.style.color = C_FG)}
        onMouseLeave={(e) => !rung.comment && (e.currentTarget.style.color = C_MUTED)}>
        {rung.comment || 'Add comment…'}</span>
      }

      {/* Action buttons */}
      {[
      { lbl: '+', ttl: 'Insert rung below', fn: onInsertAfter },
      { lbl: '×', ttl: 'Delete rung', fn: onDelete }].
      map(({ lbl, ttl, fn }) =>
      <button key={lbl} title={ttl} onClick={fn}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: C_MUTED, fontSize: 15, padding: '2px 5px',
        lineHeight: 1, borderRadius: 3, flexShrink: 0,
        transition: 'color 0.12s, background 0.12s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = C_FG;
        e.currentTarget.style.background = 'var(--vscode-toolbar-hoverBackground, rgba(90,93,94,.31))';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = C_MUTED;
        e.currentTarget.style.background = 'none';
      }}>
        {lbl}</button>
      )}
    </div>);

};

// ── Shared popup card styles ───────────────────────────────────────────────────
const POPUP_STYLE: React.CSSProperties = {
  position: 'absolute', top: '110%', left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 500, minWidth: 230,
  background: 'var(--vscode-editorWidget-background, #252526)',
  border: '1px solid var(--vscode-focusBorder, #007fd4)',
  borderRadius: 6, padding: '12px 14px',
  boxShadow: '0 8px 32px rgba(0,0,0,.7)'
};

const POPUP_TITLE_STYLE: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: C_FG,
  marginBottom: 10, paddingBottom: 6,
  borderBottom: `1px solid var(--vscode-editorGroup-border, #3c3c3c)`,
  fontFamily: 'monospace'
};

const POPUP_LABEL_STYLE: React.CSSProperties = {
  fontSize: 10, color: C_MUTED, marginBottom: 4
};

const POPUP_INPUT_STYLE: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  fontSize: 12, padding: '5px 8px', outline: 'none',
  background: 'var(--vscode-input-background, #3c3c3c)',
  border: '1px solid var(--vscode-input-border, #3c3c3c)',
  borderRadius: 3, color: C_FG, fontFamily: 'monospace'
};

const POPUP_BTN_OK: React.CSSProperties = {
  flex: 1, fontSize: 11, padding: '5px 0', borderRadius: 3,
  border: 'none', cursor: 'pointer', fontWeight: 600,
  background: 'var(--vscode-button-background, #0e639c)',
  color: 'var(--vscode-button-foreground, #fff)'
};

const POPUP_BTN_CANCEL: React.CSSProperties = {
  fontSize: 11, padding: '5px 12px', borderRadius: 3,
  cursor: 'pointer', background: 'transparent',
  border: '1px solid var(--vscode-input-border, #3c3c3c)',
  color: C_FG
};

// ── Tag inspector popup ────────────────────────────────────────────────────────
const Inspector: React.FC<{
  el: LadderElement;rungId: string;onClose: () => void;monitorMode: string;
}> = ({ el, rungId, onClose, monitorMode }) => {
  const hasTag = el.kind !== 'block';
  const [name, setName] = useState(hasTag ? (el as any).tag?.name ?? '' : (el as any).instanceName ?? '');

  const commit = useCallback(() => {
    if (hasTag && name.trim()) {
      updateElementTag(rungId, el.id, { ...(el as any).tag, name: name.trim() });
    } else if (!hasTag && name.trim()) {
      // Update instance name for block elements
      logicStore.updateElement(rungId, el.id, { instanceName: name.trim() } as any);
    }
    onClose();
  }, [hasTag, name, rungId, el, onClose]);

  const kindLabel = el.kind === 'contact' ?
  `${(el as any).type === 'NO' ? 'Normally Open' : (el as any).type === 'NC' ? 'Normally Closed' : (el as any).type} Contact` :
  el.kind === 'coil' ?
  `${(el as any).type === 'normal' ? 'Output' : (el as any).type} Coil` :
  `${(el as any).fbType} Function Block`;

  const isBlock = el.kind === 'block';
  const fbPins = isBlock ? FB_PINS[(el as any).fbType] ?? { in: [], out: [] } : null;
  const blockEl = isBlock ? el as any : null;
  const isRunning = monitorMode === 'running';

  return (
    <div data-inspector onClick={(e) => e.stopPropagation()} style={POPUP_STYLE}>
      <div style={POPUP_TITLE_STYLE}>{kindLabel}</div>

      {isBlock &&
      <div style={{ fontSize: 10, color: C_MUTED, marginBottom: 6 }}>
          Type: <span style={{ color: C_FG, fontFamily: 'monospace' }}>{blockEl.fbType}</span>
        </div>
      }

      <div style={POPUP_LABEL_STYLE}>{hasTag ? 'Tag name' : 'Instance name'}</div>
      <input autoFocus value={name}
      placeholder={hasTag ? 'e.g. PB_START' : 'e.g. TIMER_1'}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') onClose();
      }}
      style={POPUP_INPUT_STYLE} />


      {/* Block: input pins (edit mode) or output values (run mode) */}
      {isBlock && fbPins && !isRunning && fbPins.in.length > 0 &&
      <div style={{ marginTop: 10 }}>
          <div style={{ ...POPUP_LABEL_STYLE, marginBottom: 6 }}>Input pins</div>
          {fbPins.in.map((pin: string) =>
        <div key={pin} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: C_FG, minWidth: 28 }}>{pin}</span>
              <input
            value={blockEl.pins?.[pin]?.name ?? ''}
            placeholder={`tag for ${pin}`}
            onChange={(e) => {
              logicStore.updateElement(rungId, el.id, {
                pins: { ...(blockEl.pins ?? {}), [pin]: { name: e.target.value, dataType: 'BOOL' } }
              } as any);
            }}
            style={{ ...POPUP_INPUT_STYLE, flex: 1 }} />

            </div>
        )}
        </div>
      }

      {isBlock && fbPins && isRunning && blockEl.pinValues && Object.keys(blockEl.pinValues).length > 0 &&
      <div style={{ marginTop: 10 }}>
          <div style={{ ...POPUP_LABEL_STYLE, marginBottom: 4 }}>Output values</div>
          {fbPins.out.map((pin: string) =>
        <div key={pin} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
              <span style={{ fontFamily: 'monospace', color: C_MUTED }}>{pin}</span>
              <span style={{ fontFamily: 'monospace', color: C_ENRG }}>{blockEl.pinValues[pin] ?? '—'}</span>
            </div>
        )}
        </div>
      }

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={commit} style={POPUP_BTN_OK}>OK</button>
        <button onClick={onClose} style={POPUP_BTN_CANCEL}>Cancel</button>
      </div>
    </div>);

};

// ── Force modal (shown near the element in running mode) ──────────────────────
// Styled as a modal dialog matching the Edit Coil / Edit Contact style.
// Rendered via portal to document.body to escape transform:scale context.
interface ForceMenuState {elRef: HTMLElement;tagName: string;}

const ForcePopover: React.FC<{
  menu: ForceMenuState;
  hasForcedValue: boolean;
  currentValue?: string;
  onClose: () => void;
}> = ({ menu, hasForcedValue, currentValue, onClose }) => {
  const popRef = useRef<HTMLDivElement>(null);
  const MODAL_W = 280;
  const MODAL_H = 220;

  // Position the modal anchored below (or above) the clicked element
  const getPos = () => {
    const rect = menu.elRef.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - MODAL_W / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - MODAL_W - 12));
    let top = rect.bottom + 6;
    if (top + MODAL_H > window.innerHeight - 12) top = rect.top - MODAL_H - 6;
    top = Math.max(12, top);
    return { top, left };
  };

  const [pos, setPos] = useState(getPos);
  useLayoutEffect(() => {setPos(getPos());}, [menu.elRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {if (e.key === 'Escape') onClose();};
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const isForcedTrue = hasForcedValue && (currentValue === 'TRUE' || currentValue === 'true' || currentValue === 'true');
  const isForcedFalse = hasForcedValue && !isForcedTrue;
  const displayValue = isForcedTrue ? 'TRUE' : isForcedFalse ? 'FALSE' : (currentValue ?? '—').toUpperCase();

  const modal =
  <div
    ref={popRef}
    onMouseDown={(e) => e.stopPropagation()}
    style={{
      position: 'fixed',
      top: pos.top, left: pos.left,
      width: MODAL_W,
      zIndex: 9999,
      background: 'var(--vscode-editor-background, #1e1e1e)',
      border: '1px solid var(--vscode-contrastBorder, #6fc3df)',
      borderRadius: 6,
      boxShadow: '0 8px 32px rgba(0,0,0,.8)',
      overflow: 'hidden',
      fontFamily: 'var(--vscode-font-family, sans-serif)'
    }}>

      {/* Title bar — matches Edit Coil modal header */}
      <div style={{
      padding: '10px 14px 8px',
      borderBottom: '1px solid var(--vscode-editorGroup-border, #3c3c3c)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C_FG }}>Force Tag</span>
        <button onClick={onClose} style={{
        background: 'none', border: 'none', color: C_MUTED, cursor: 'pointer',
        fontSize: 18, lineHeight: 1, padding: '0 2px'
      }}>×</button>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Tag name label */}
        <div>
          <div style={{ fontSize: 10, color: C_MUTED, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TAG NAME</div>
          <div style={{
          padding: '5px 8px', borderRadius: 3, fontSize: 12,
          background: 'var(--vscode-input-background, #3c3c3c)',
          border: '1px solid var(--vscode-input-border, #3c3c3c)',
          color: C_FG, fontFamily: 'monospace'
        }}>{menu.tagName}</div>
        </div>

        {/* Current status */}
        <div>
          <div style={{ fontSize: 10, color: C_MUTED, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CURRENT VALUE</div>
          <div style={{
          padding: '5px 8px', borderRadius: 3, fontSize: 12, fontFamily: 'monospace',
          background: 'var(--vscode-input-background, #3c3c3c)',
          border: `1px solid ${isForcedTrue ? '#80C000' : isForcedFalse ? '#4080FF' : 'var(--vscode-input-border, #3c3c3c)'}`,
          color: isForcedTrue ? '#80C000' : isForcedFalse ? '#4080FF' : C_FG
        }}>
            {isForcedTrue ? 'FORCED TRUE' : isForcedFalse ? 'FORCED FALSE' : displayValue}
          </div>
        </div>

        {/* Force buttons row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
          onClick={() => {logicStore.forceTag(menu.tagName, 'TRUE');onClose();}}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 3, cursor: 'pointer',
            fontSize: 11, fontWeight: 600,
            border: `1px solid ${isForcedTrue ? '#80C000' : 'var(--vscode-button-background, #0e639c)'}`,
            background: isForcedTrue ? '#80C00033' : 'var(--vscode-button-background, #0e639c)',
            color: isForcedTrue ? '#80C000' : 'var(--vscode-button-foreground, #fff)'
          }}>
          Force TRUE</button>
          <button
          onClick={() => {logicStore.forceTag(menu.tagName, 'FALSE');onClose();}}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 3, cursor: 'pointer',
            fontSize: 11, fontWeight: 600,
            border: `1px solid ${isForcedFalse ? '#4080FF' : 'var(--vscode-button-secondaryBackground, #3a3d41)'}`,
            background: isForcedFalse ? '#4080FF33' : 'var(--vscode-button-secondaryBackground, #3a3d41)',
            color: isForcedFalse ? '#4080FF' : 'var(--vscode-button-secondaryForeground, #ccc)'
          }}>
          Force FALSE</button>
        </div>

        {/* Release force button */}
        <button
        onClick={() => {logicStore.releaseForce(menu.tagName);onClose();}}
        disabled={!hasForcedValue}
        style={{
          width: '100%', padding: '6px 0', borderRadius: 3, cursor: hasForcedValue ? 'pointer' : 'default',
          fontSize: 11, fontWeight: 500,
          border: `1px solid ${hasForcedValue ? '#f59e0b' : 'var(--vscode-input-border, #3c3c3c)'}`,
          background: 'transparent',
          color: hasForcedValue ? '#f59e0b' : C_MUTED,
          opacity: hasForcedValue ? 1 : 0.45
        }}>
        Release Force</button>
      </div>
    </div>;


  return createPortal(modal, document.body);
};

// ── Element strip (horizontal row of elements between rails) ───────────────────
const ElementStrip: React.FC<{
  rung: Rung;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onInspect: (el: LadderElement, e?: React.MouseEvent) => void;
  inspecting: LadderElement | null;
  tagDatabase: Array<{name: string;forcedValue?: string;liveValue?: string;}>;
  monitorMode: string;
}> = ({ rung, selectedIds, onSelect, onInspect, inspecting, tagDatabase, monitorMode }) =>
<div style={{
  display: 'flex', flexDirection: 'row', alignItems: 'center',
  flex: 1, minWidth: 0,
  paddingTop: RUNG_PT,
  paddingBottom: RUNG_PB,
  overflowX: 'auto', overflowY: 'visible'
}}>
    {/* Lead wire — always live when simulation is running (left rail has power) */}
    <Wire w={LEAD_W} energized={monitorMode === 'running'} />

    {rung.elements.length === 0 ?
  <span style={{
    fontSize: 11, color: C_MUTED, fontStyle: 'italic',
    padding: '0 24px', userSelect: 'none', whiteSpace: 'nowrap', flexShrink: 0
  }}>
        Drop elements here…
      </span> :
  rung.elements.map((el, i) => {
    const tagName = el.kind === 'block' ? el.instanceName : (el as any).tag?.name ?? '';
    const tagEntry = tagDatabase.find((t) => t.name === tagName);
    // Wire between element[i-1] and element[i] is energized when element[i-1] passed power through
    const prevEl = i > 0 ? rung.elements[i - 1] : null;
    return (
      <React.Fragment key={el.id}>
          {i > 0 && <Wire energized={prevEl?.energized} />}
          <div data-ld-element style={{ position: 'relative', flexShrink: 0 }}>
            <LadderElementRenderer
            element={el}
            selected={selectedIds.has(el.id)}
            onSelect={() => onSelect(el.id)}
            onDoubleClick={(e) => onInspect(el, e)}
            forcedValue={tagEntry?.forcedValue}
            liveValue={tagEntry?.liveValue}
            monitorMode={monitorMode} />

            {inspecting?.id === el.id &&
          <Inspector el={el} rungId={rung.id} onClose={() => onInspect(el)} monitorMode={monitorMode} />
          }
          </div>
        </React.Fragment>);

  })}

    {/* Trail wire — only energized if last element is a contact/FB (power flows through).
       Coils are terminal: they receive power but don't pass it to the right rail. */}
    {(() => {
    const last = rung.elements.at(-1);
    const lastPassesPower = last && last.kind !== 'coil';
    return <Wire w={LEAD_W} energized={lastPassesPower ? last?.energized : false} />;
  })()}
  </div>;


// ── Rung body (HTML5 drop target with insertion point detection) ───────────────
const RungBody: React.FC<{
  rung: Rung;children: React.ReactNode;
}> = ({ rung, children }) => {
  const [over, setOver] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const kind = e.dataTransfer.getData('application/plc-element') as PaletteItemKind;
    if (!kind) return;

    // Calculate insertion index based on drop X position
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) {
      applyElementDrop(kind, rung.id);
      return;
    }

    const mouseX = e.clientX - rect.left;
    const elementStripStart = RAIL_W + LEAD_W;
    const relX = mouseX - elementStripStart;

    if (relX < 0 || rung.elements.length === 0) {
      // Dropped before first element or empty rung
      applyElementDrop(kind, rung.id, 0);
      return;
    }

    // Calculate which gap the drop falls into
    let accumulatedX = 0;
    for (let i = 0; i < rung.elements.length; i++) {
      const el = rung.elements[i];
      const elWidth = el.kind === 'block' ? BLOCK_W : EL_W;
      const gapMid = accumulatedX + elWidth / 2;

      if (relX < gapMid + WIRE_W / 2) {
        // Insert before this element
        applyElementDrop(kind, rung.id, i);
        return;
      }

      accumulatedX += elWidth + WIRE_W;
    }

    // Dropped after last element
    applyElementDrop(kind, rung.id);
  }, [rung]);

  return (
    <div
      ref={bodyRef}
      onDragOver={(e) => {e.preventDefault();e.dataTransfer.dropEffect = 'copy';setOver(true);}}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={handleDrop}
      style={{
        display: 'flex', flexDirection: 'row', alignItems: 'stretch',
        background: over ? C_DROP : C_BG,
        outline: over ? `2px dashed ${C_DROPB}` : 'none',
        outlineOffset: -2,
        transition: 'background 0.15s',
        position: 'relative'
      }}>

      {children}
    </div>);

};

// ── Parallel branch row ────────────────────────────────────────────────────────
// IEC 61131-3 parallel branch: horizontal wire path below main rung,
// connected via vertical bus wires on left and right.
const BranchRow: React.FC<{
  rung: Rung;
  branch: {id: string;elements: LadderElement[];};
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onInspect: (el: LadderElement, e?: React.MouseEvent) => void;
  inspecting: LadderElement | null;
  tagDatabase: Array<{name: string;forcedValue?: string;liveValue?: string;}>;
  monitorMode: string;
}> = ({ rung, branch, selectedIds, onSelect, onInspect, inspecting, tagDatabase, monitorMode }) => {
  const [over, setOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const kind = e.dataTransfer.getData('application/plc-element') as PaletteItemKind;
    if (kind) applyElementDrop(kind, rung.id);
  }, [rung.id]);

  return (
    <div
      onDragOver={(e) => {e.preventDefault();e.dataTransfer.dropEffect = 'copy';setOver(true);}}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        marginLeft: RAIL_W + LEAD_W,
        marginRight: RAIL_W + LEAD_W,
        background: over ? C_DROP : 'transparent',
        transition: 'background 0.15s'
      }}>

      {/* Left vertical bus wire - always live when running (left rail is always powered) */}
      <div style={{
        position: 'absolute', left: 0, top: -RUNG_PT - RUNG_PB - 2, bottom: '50%', width: 2,
        background: monitorMode === 'running' ? C_ENRG : C_WIRE
      }} />

      {/* Right vertical bus wire — energized if this branch path passes power */}
      <div style={{
        position: 'absolute', right: 0, top: -RUNG_PT - RUNG_PB - 2, bottom: '50%', width: 2,
        background: branch.energized ? C_ENRG : C_WIRE
      }} />

      {/* Branch element strip */}
      <div style={{
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        padding: '8px 12px',
        minHeight: 56,
        overflowX: 'auto'
      }}>
        {/* Left lead wire from vertical bus to first branch element — always live when running */}
        <Wire w={12} energized={monitorMode === 'running'} />

        {branch.elements.length === 0 ?
        <span style={{
          fontSize: 10, color: C_MUTED, fontStyle: 'italic',
          padding: '0 16px', userSelect: 'none', whiteSpace: 'nowrap'
        }}>Drop contact here (OR path)</span> :
        branch.elements.map((el, i) => {
          const tagName = el.kind === 'block' ? el.instanceName : (el as any).tag?.name ?? '';
          const tagEntry = tagDatabase.find((t) => t.name === tagName);
          const prevBranchEl = i > 0 ? branch.elements[i - 1] : null;
          return (
            <React.Fragment key={el.id}>
              {i > 0 && <Wire w={12} energized={prevBranchEl?.energized} />}
              <div data-ld-element style={{ position: 'relative', flexShrink: 0 }}>
                <LadderElementRenderer
                  element={el}
                  selected={selectedIds.has(el.id)}
                  onSelect={() => onSelect(el.id)}
                  onDoubleClick={(e) => onInspect(el, e)}
                  forcedValue={tagEntry?.forcedValue}
                  liveValue={tagEntry?.liveValue}
                  monitorMode={monitorMode} />

                {inspecting?.id === el.id &&
                <Inspector el={el} rungId={rung.id} onClose={() => onInspect(el)} monitorMode={monitorMode} />
                }
              </div>
            </React.Fragment>);

        })}

        {/* Right trail wire to vertical bus — energized = branch path delivers power */}
        <Wire w={12} energized={branch.energized} />
      </div>
    </div>);

};

// ── LadderRungEditor ───────────────────────────────────────────────────────────
export const LadderRungEditor: React.FC<{
  rung: Rung;onDelete: () => void;onInsertAfter: () => void;
}> = ({ rung, onDelete, onInsertAfter }) => {
  const selectedIds = useLogicStoreSelector((s) => s.selectedElementIds);
  const monitorMode = useLogicStoreSelector((s) => s.monitorMode);
  const tagDatabase = useLogicStoreSelector((s) => s.tagDatabase);
  const [inspecting, setInspecting] = useState<LadderElement | null>(null);
  const [forceMenu, setForceMenu] = useState<ForceMenuState | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const handleSelect = useCallback((id: string) => {
    logicStore.setSelection([id], rung.id);
  }, [rung.id]);

  const handleInspect = useCallback((el: LadderElement, e?: React.MouseEvent) => {
    if (monitorMode === 'running') {
      const tagName = el.kind === 'block' ? el.instanceName : (el as any).tag?.name ?? '';
      if (tagName && e) {
        // Anchor the popover to the element's container div
        const elRef = (e.currentTarget as HTMLElement).closest('[data-ld-element]') as HTMLElement ??
        e.currentTarget as HTMLElement;
        setForceMenu({ elRef, tagName });
      }
    } else {
      setInspecting((prev) => prev?.id === el.id ? null : el);
    }
  }, [monitorMode]);

  const forceMenuTag = forceMenu ?
  tagDatabase.find((t) => t.name === forceMenu.tagName) :
  null;

  return (
    <div
      style={{ background: C_BG, borderBottom: `1px solid ${C_LINE}` }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('[data-inspector]')) setInspecting(null);
      }}>

      <RungHeader rung={rung} onDelete={onDelete} onInsertAfter={onInsertAfter} />

      <RungBody rung={rung}>
        <Rail side="left" energized={monitorMode === 'running'} />
        <ElementStrip
          rung={rung}
          selectedIds={selectedSet}
          onSelect={handleSelect}
          onInspect={handleInspect}
          inspecting={inspecting}
          tagDatabase={tagDatabase}
          monitorMode={monitorMode} />

        {/* Right rail is always un-energized — it's a bus reference, not powered */}
        <Rail side="right" energized={false} />
      </RungBody>

      {/* Parallel branch rows */}
      {rung.branches.map((branch) =>
      <BranchRow
        key={branch.id}
        rung={rung}
        branch={branch}
        selectedIds={selectedSet}
        onSelect={handleSelect}
        onInspect={handleInspect}
        inspecting={inspecting}
        tagDatabase={tagDatabase}
        monitorMode={monitorMode} />

      )}

      {/* Force popover (single instance per rung, shown on top of everything) */}
      {forceMenu &&
      <ForcePopover
        menu={forceMenu}
        hasForcedValue={!!forceMenuTag?.forcedValue}
        currentValue={forceMenuTag?.liveValue}
        onClose={() => setForceMenu(null)} />

      }
    </div>);

};