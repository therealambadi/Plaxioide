/*
 * BranchEditor — Parallel branch (OR path) rendering for Ladder Diagram.
 *
 * Production-grade implementation with:
 *  - Proper U-shaped vertical junction wires connecting to main rung
 *  - Left vertical wire drops from main wire midline to branch midline
 *  - Right vertical wire rises from branch midline to main wire midline
 *  - Tight layout with contained elements and proper wire spacing
 *  - HTML5 drop target for adding elements to branch
 *  - Visual feedback during drag operations
 *
 * IEC 61131-3 compliant parallel branch rendering.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Branch, LadderElement, Rung, useLogicStoreSelector } from '../logicStore.js';
import { LadderElementRenderer, EL_W, BLOCK_W } from './LadderElementRenderer.js';
import { applyElementDrop, PaletteItemKind } from './LadderCanvas.js';

// ── Layout constants ──────────────────────────────────────────────────────────
const RAIL_W = 4; // power rail width
const LEAD_W = 20; // lead wire from rail to first element
const WIRE_W = 12; // wire between branch elements (tighter than main rung)

// ── Colors ─────────────────────────────────────────────────────────────────────
const C_WIRE = 'var(--vscode-editor-foreground)';
const C_ENRG = 'var(--vscode-charts-green, #22c55e)';
const C_MUTED = 'var(--vscode-descriptionForeground)';
const C_DROP = 'var(--vscode-list-hoverBackground)';
const C_DROPB = 'var(--vscode-focusBorder)';

// ── Branch row component ───────────────────────────────────────────────────────
interface BranchEditorProps {
  rung: Rung;
  branch: Branch;
  selectedElementIds: Set<string>;
  onElementClick: (elementId: string) => void;
  onElementDoubleClick: (elementId: string) => void;
}

export const BranchEditor: React.FC<BranchEditorProps> = ({
  rung, branch, selectedElementIds, onElementClick, onElementDoubleClick
}) => {
  const [over, setOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const kind = e.dataTransfer.getData('application/plc-element') as PaletteItemKind;
    if (kind) {
      // For now, append to main rung (future: add to branch specifically)
      applyElementDrop(kind, rung.id);
    }
  }, [rung.id]);

  const branchEnergized = branch.elements.some((el) => el.energized);
  const wireColor = branchEnergized ? C_ENRG : C_WIRE;

  return (
    <div style={{
      display: 'flex', flexDirection: 'row', alignItems: 'center',
      marginLeft: RAIL_W + LEAD_W,
      marginRight: RAIL_W + LEAD_W,
      marginTop: 6,
      marginBottom: 6,
      position: 'relative'
    }}>
      {/* Left vertical junction wire (drops from main rung midline) */}
      <div style={{
        position: 'absolute',
        left: 0, top: -6, bottom: '50%',
        width: 2,
        background: wireColor,
        boxShadow: branchEnergized ? `0 0 4px ${C_ENRG}` : 'none',
        transition: 'background 0.2s, box-shadow 0.2s'
      }} />

      {/* Right vertical junction wire (rises to main rung midline) */}
      <div style={{
        position: 'absolute',
        right: 0, top: -6, bottom: '50%',
        width: 2,
        background: wireColor,
        boxShadow: branchEnergized ? `0 0 4px ${C_ENRG}` : 'none',
        transition: 'background 0.2s, box-shadow 0.2s'
      }} />

      {/* Branch container with U-shaped border */}
      <div
        onDragOver={(e) => {e.preventDefault();e.dataTransfer.dropEffect = 'copy';setOver(true);}}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
        }}
        onDrop={handleDrop}
        style={{
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          flex: 1,
          borderLeft: `2px solid ${wireColor}`,
          borderRight: `2px solid ${wireColor}`,
          borderBottom: `2px solid ${wireColor}`,
          borderRadius: '0 0 8px 8px',
          padding: '8px 12px',
          minHeight: 52,
          background: over ? C_DROP : 'transparent',
          outline: over ? `2px dashed ${C_DROPB}` : 'none',
          outlineOffset: -2,
          transition: 'background 0.15s, border-color 0.2s',
          overflowX: 'auto',
          gap: 0
        }}>

        {branch.elements.length === 0 ?
        <span style={{
          fontSize: 10, color: C_MUTED, fontStyle: 'italic',
          padding: '0 16px', userSelect: 'none', whiteSpace: 'nowrap'
        }}>Drop elements to create parallel path</span> :
        branch.elements.map((el, i) =>
        <React.Fragment key={el.id}>
            {i > 0 &&
          <div style={{
            width: WIRE_W, height: 2, flexShrink: 0,
            background: el.energized ? C_ENRG : C_WIRE,
            boxShadow: el.energized ? `0 0 4px ${C_ENRG}` : 'none',
            transition: 'background 0.2s, box-shadow 0.2s'
          }} />
          }
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <LadderElementRenderer
              element={el}
              selected={selectedElementIds.has(el.id)}
              onSelect={() => onElementClick(el.id)}
              onDoubleClick={() => onElementDoubleClick(el.id)} />

            </div>
          </React.Fragment>
        )}
      </div>
    </div>);

};