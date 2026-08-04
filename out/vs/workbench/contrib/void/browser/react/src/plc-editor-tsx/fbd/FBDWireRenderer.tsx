/*
 * FBDWireRenderer — Wire rendering with Manhattan (orthogonal) routing.
 *
 * Wires connect output pins to input pins using horizontal and vertical segments only.
 * Routing algorithm:
 *  - If target is to the right: simple 3-segment route (horizontal → vertical → horizontal)
 *  - If target is to the left (feedback): route around below both blocks
 *
 * Wire states:
 *  - Normal: gray
 *  - Energized (monitor mode): green
 *  - Selected: blue with thicker stroke
 *  - Negated input: small circle at target end
 */

import React, { useCallback } from 'react';
import { FBDNode, FBDWire, logicStore } from '../logicStore.js';
import { getPinPosition } from './FBDNodeTypes.js';

export const FBDWireRenderer: React.FC<{
  wire: FBDWire;
  fromNode: FBDNode;
  toNode: FBDNode;
  selected: boolean;
  energized: boolean;
}> = ({ wire, fromNode, toNode, selected, energized }) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      // Add to selection
      const current = Array.from(logicStore.getState().selectedElementIds);
      logicStore.setSelection([...current, wire.id]);
    } else {
      // Replace selection
      logicStore.setSelection([wire.id]);
    }
  }, [wire.id]);
  const fromPos = getPinPosition(fromNode, wire.from.pin, 'output');
  const toPos = getPinPosition(toNode, wire.to.pin, 'input');

  // Determine wire color
  let strokeColor = 'var(--vscode-editorGroup-border)';
  if (selected) {
    strokeColor = 'var(--vscode-focusBorder)';
  } else if (energized) {
    strokeColor = '#4ade80';
  }

  const strokeWidth = selected ? 2.5 : 1.5;

  // Manhattan routing
  const points: Array<{ x: number; y: number }> = [];

  if (toPos.x >= fromPos.x) {
    // Target is to the right or same X → simple 3-segment route
    const midX = (fromPos.x + toPos.x) / 2;
    points.push({ x: fromPos.x, y: fromPos.y });
    points.push({ x: midX, y: fromPos.y });
    points.push({ x: midX, y: toPos.y });
    points.push({ x: toPos.x, y: toPos.y });
  } else {
    // Target is to the left (feedback) → route around below
    const clearance = 30;
    const lowestY = Math.max(fromPos.y, toPos.y) + clearance;
    points.push({ x: fromPos.x, y: fromPos.y });
    points.push({ x: fromPos.x + 20, y: fromPos.y });
    points.push({ x: fromPos.x + 20, y: lowestY });
    points.push({ x: toPos.x - 20, y: lowestY });
    points.push({ x: toPos.x - 20, y: toPos.y });
    points.push({ x: toPos.x, y: toPos.y });
  }

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <g>
      {/* Invisible thicker path for easier click targeting */}
      <path
        d={pathData}
        stroke="transparent"
        strokeWidth={12}
        fill="none"
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
        onClick={handleClick}
      />
      {/* Visible wire path */}
      <path
        d={pathData}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={energized ? 1 : 0.75}
        style={{ transition: 'stroke 0.15s, stroke-width 0.15s', pointerEvents: 'none' }}
      />

      {/* Negated input indicator (small circle at target end) */}
      {wire.negated && (
        <circle
          cx={toPos.x - 6}
          cy={toPos.y}
          r={3}
          stroke={strokeColor}
          strokeWidth={1.5}
          fill="var(--vscode-editor-background)"
        />
      )}

      {/* Energy flow animation (optional) */}
      {energized && (
        <circle r={3} fill="#4ade80" opacity={0.8}>
          <animateMotion dur="1.5s" repeatCount="indefinite" path={pathData} />
        </circle>
      )}
    </g>
  );
};
