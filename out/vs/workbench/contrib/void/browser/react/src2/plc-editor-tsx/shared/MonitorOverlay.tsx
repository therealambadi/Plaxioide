/*
 * MonitorOverlay — live value overlays and rail coloring for monitor mode.
 */

import React from 'react';

const GREEN = 'var(--vscode-charts-green, #a6e3a1)';
const RED = 'var(--vscode-charts-red, #f38ba8)';
const ORANGE = 'var(--vscode-charts-orange, #fab387)';
const OFF = 'var(--vscode-widget-border, #454545)';
const IDLE = 'var(--vscode-input-placeholderForeground)';

interface LiveValueBadgeProps {
  value: string | undefined;
  forced?: boolean;
  style?: React.CSSProperties;
}

export const LiveValueBadge: React.FC<LiveValueBadgeProps> = ({ value, forced, style }) => {
  if (value === undefined) return null;
  const color = forced ? ORANGE : value === 'TRUE' || value === '1' ? GREEN : RED;
  return (
    <div style={{
      background: color + '22',
      color,
      border: `1px solid ${color}55`,
      borderRadius: 3,
      padding: '1px 5px',
      fontSize: 10,
      fontFamily: 'monospace',
      fontWeight: 700,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      ...style
    }}>
      {forced && '⚑ '}{value}
    </div>);

};

interface EnergizedDotProps {
  energized: boolean;
  size?: number;
}

export const EnergizedDot: React.FC<EnergizedDotProps> = ({ energized, size = 6 }) =>
<div style={{
  width: size, height: size, borderRadius: '50%',
  background: energized ? GREEN : OFF,
  boxShadow: energized ? `0 0 6px ${GREEN}` : 'none',
  flexShrink: 0
}} />;


export const getRailColor = (energized: boolean, forced: boolean = false, isMonitoring: boolean = false) => {
  if (!isMonitoring) return IDLE;
  if (forced) return ORANGE;
  return energized ? GREEN : OFF;
};

export const getWireColor = (energized: boolean | undefined, isMonitoring: boolean) => {
  if (!isMonitoring || energized === undefined) return IDLE;
  return energized ? GREEN : OFF;
};