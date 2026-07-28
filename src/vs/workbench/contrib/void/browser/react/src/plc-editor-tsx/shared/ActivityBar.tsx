/*
 * ActivityBar.tsx — OpenPLC-inspired narrow left sidebar with context-specific tool icons.
 * Used inside LadderCanvas, FBDCanvas, and SFCCanvas.
 *
 * LD: draggable SVG icons that set HTML5 drag data 'application/plc-ladder-element'
 * FBD: draggable icons that set 'application/plc-element' (same as FBDPalette)
 * SFC: buttons to add Step / Transition
 */

import React, { useState } from 'react';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ActivityBarProps {
  language: 'LD' | 'FBD' | 'SFC';
  onSFCAddStep?: () => void;
  onSFCAddTransition?: () => void;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ICON_WRAP_BASE: React.CSSProperties = {
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 4,
  cursor: 'grab',
  border: '1px solid transparent',
  transition: 'background 0.12s, border-color 0.12s',
  userSelect: 'none',
  flexShrink: 0,
};

const DIVIDER: React.CSSProperties = {
  width: 28,
  height: 1,
  background: 'var(--vscode-editorGroup-border)',
  flexShrink: 0,
  margin: '2px 0',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

interface IconWrapProps {
  title: string;
  onDragStart?: (e: React.DragEvent) => void;
  children: React.ReactNode;
  draggable?: boolean;
  onClick?: () => void;
  isButton?: boolean;
}

const IconWrap: React.FC<IconWrapProps> = ({ title, onDragStart, children, draggable = true, onClick, isButton }) => {
  const [hovered, setHovered] = useState(false);

  const style: React.CSSProperties = {
    ...ICON_WRAP_BASE,
    cursor: isButton ? 'pointer' : 'grab',
    background: hovered ? 'var(--vscode-list-hoverBackground)' : 'transparent',
    borderColor: hovered ? 'var(--vscode-input-border, #3c3c3c)' : 'transparent',
  };

  if (isButton) {
    return (
      <button
        title={title}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...style,
          background: hovered ? 'var(--vscode-list-hoverBackground)' : 'transparent',
          border: `1px solid ${hovered ? 'var(--vscode-input-border, #3c3c3c)' : 'transparent'}`,
          width: 36,
          height: 36,
          borderRadius: 4,
          padding: 0,
          cursor: 'pointer',
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      draggable={draggable}
      title={title}
      onDragStart={onDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={style}
    >
      {children}
    </div>
  );
};

// ── LD SVG Glyphs ─────────────────────────────────────────────────────────────

const ContactNO: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    {/* Left vertical bar */}
    <line x1={8} y1={4} x2={8} y2={20} stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} strokeLinecap="round" />
    {/* Right vertical bar */}
    <line x1={20} y1={4} x2={20} y2={20} stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} strokeLinecap="round" />
    {/* Horizontal wire left */}
    <line x1={2} y1={12} x2={8} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    {/* Horizontal wire right */}
    <line x1={20} y1={12} x2={26} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
  </svg>
);

const ContactNC: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    {/* Left vertical bar */}
    <line x1={8} y1={4} x2={8} y2={20} stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} strokeLinecap="round" />
    {/* Right vertical bar */}
    <line x1={20} y1={4} x2={20} y2={20} stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} strokeLinecap="round" />
    {/* Horizontal wire left */}
    <line x1={2} y1={12} x2={8} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    {/* Horizontal wire right */}
    <line x1={20} y1={12} x2={26} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    {/* Diagonal slash */}
    <line x1={10} y1={6} x2={18} y2={18} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const CoilNormal: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    {/* Left wire */}
    <line x1={2} y1={12} x2={7} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    {/* Right wire */}
    <line x1={21} y1={12} x2={26} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    {/* Left parenthesis */}
    <path d="M 11 5 Q 7 12 11 19" stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} fill="none" strokeLinecap="round" />
    {/* Right parenthesis */}
    <path d="M 17 5 Q 21 12 17 19" stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} fill="none" strokeLinecap="round" />
  </svg>
);

const CoilSet: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    <line x1={2} y1={12} x2={7} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <line x1={21} y1={12} x2={26} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <path d="M 11 5 Q 7 12 11 19" stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} fill="none" strokeLinecap="round" />
    <path d="M 17 5 Q 21 12 17 19" stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} fill="none" strokeLinecap="round" />
    <text x={14} y={15} textAnchor="middle" fontSize={8} fontWeight={700} fontFamily="monospace"
      fill="var(--vscode-foreground, #ccc)">S</text>
  </svg>
);

const CoilReset: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    <line x1={2} y1={12} x2={7} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <line x1={21} y1={12} x2={26} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <path d="M 11 5 Q 7 12 11 19" stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} fill="none" strokeLinecap="round" />
    <path d="M 17 5 Q 21 12 17 19" stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} fill="none" strokeLinecap="round" />
    <text x={14} y={15} textAnchor="middle" fontSize={8} fontWeight={700} fontFamily="monospace"
      fill="var(--vscode-foreground, #ccc)">R</text>
  </svg>
);

const BlockFB: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    <rect x={6} y={3} width={16} height={18} rx={2} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} fill="none" />
    <line x1={6} y1={9} x2={22} y2={9} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1} />
    <line x1={2} y1={13} x2={6} y2={13} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <line x1={22} y1={13} x2={26} y2={13} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <text x={14} y={7} textAnchor="middle" fontSize={6} fontWeight={700} fontFamily="monospace"
      fill="var(--vscode-foreground, #ccc)">FB</text>
  </svg>
);

// ── FBD SVG Glyphs ────────────────────────────────────────────────────────────

const FBDInputVar: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    <rect x={2} y={5} width={20} height={14} rx={2} stroke="#4ade80" strokeWidth={1.5} fill="#4ade8018" />
    <text x={12} y={15} textAnchor="middle" fontSize={7} fontFamily="monospace" fill="#4ade80" fontWeight={700}>IN</text>
    {/* Right arrow pointing right */}
    <line x1={22} y1={12} x2={26} y2={12} stroke="#4ade80" strokeWidth={1.5} />
    <polyline points="24,10 26,12 24,14" stroke="#4ade80" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FBDOutputVar: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    <rect x={6} y={5} width={20} height={14} rx={2} stroke="#fb923c" strokeWidth={1.5} fill="#fb923c18" />
    <text x={16} y={15} textAnchor="middle" fontSize={7} fontFamily="monospace" fill="#fb923c" fontWeight={700}>OUT</text>
    {/* Left arrow pointing left */}
    <line x1={2} y1={12} x2={6} y2={12} stroke="#fb923c" strokeWidth={1.5} />
    <polyline points="4,10 2,12 4,14" stroke="#fb923c" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FBDBlock: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    <rect x={4} y={3} width={20} height={18} rx={2} stroke="#60a5fa" strokeWidth={1.5} fill="#60a5fa18" />
    <line x1={4} y1={9} x2={24} y2={9} stroke="#60a5fa" strokeWidth={1} />
    <text x={14} y={7} textAnchor="middle" fontSize={6} fontWeight={700} fontFamily="monospace" fill="#60a5fa">FB</text>
    <line x1={0} y1={13} x2={4} y2={13} stroke="#60a5fa" strokeWidth={1.5} />
    <line x1={24} y1={13} x2={28} y2={13} stroke="#60a5fa" strokeWidth={1.5} />
  </svg>
);

// ── SFC Buttons ───────────────────────────────────────────────────────────────

const SFCStepIcon: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    <rect x={4} y={4} width={20} height={16} rx={2} stroke="var(--vscode-focusBorder, #007acc)" strokeWidth={1.5} fill="none" />
    <text x={14} y={15} textAnchor="middle" fontSize={8} fontWeight={700} fontFamily="monospace"
      fill="var(--vscode-focusBorder, #007acc)">S</text>
    <text x={14} y={8.5} textAnchor="middle" fontSize={6} fontFamily="monospace"
      fill="var(--vscode-descriptionForeground, #888)">+</text>
  </svg>
);

const SFCTransIcon: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    {/* vertical wire with horizontal bar */}
    <line x1={14} y1={2} x2={14} y2={22} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <line x1={6} y1={12} x2={22} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={2.5} strokeLinecap="round" />
    <text x={20} y={11} fontSize={8} fontWeight={700} fontFamily="monospace"
      fill="var(--vscode-focusBorder, #007acc)">+</text>
  </svg>
);

const ContactP: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    <line x1={8} y1={4} x2={8} y2={20} stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} strokeLinecap="round" />
    <line x1={20} y1={4} x2={20} y2={20} stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} strokeLinecap="round" />
    <line x1={2} y1={12} x2={8} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <line x1={20} y1={12} x2={26} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <text x={14} y={15} textAnchor="middle" fontSize={7} fontWeight={700} fontFamily="monospace"
      fill="var(--vscode-foreground, #ccc)">P</text>
  </svg>
);

const ContactN: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    <line x1={8} y1={4} x2={8} y2={20} stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} strokeLinecap="round" />
    <line x1={20} y1={4} x2={20} y2={20} stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} strokeLinecap="round" />
    <line x1={2} y1={12} x2={8} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <line x1={20} y1={12} x2={26} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <line x1={10} y1={6} x2={18} y2={18} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} strokeLinecap="round" />
    <text x={14} y={15} textAnchor="middle" fontSize={7} fontWeight={700} fontFamily="monospace"
      fill="var(--vscode-foreground, #ccc)">N</text>
  </svg>
);

const CoilNegated: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    <line x1={2} y1={12} x2={7} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <line x1={21} y1={12} x2={26} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <path d="M 11 5 Q 7 12 11 19" stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} fill="none" strokeLinecap="round" />
    <path d="M 17 5 Q 21 12 17 19" stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} fill="none" strokeLinecap="round" />
    <line x1={11} y1={7} x2={17} y2={17} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const CoilLatch: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    <line x1={2} y1={12} x2={7} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <line x1={21} y1={12} x2={26} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <path d="M 11 5 Q 7 12 11 19" stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} fill="none" strokeLinecap="round" />
    <path d="M 17 5 Q 21 12 17 19" stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} fill="none" strokeLinecap="round" />
    <text x={14} y={15} textAnchor="middle" fontSize={8} fontWeight={700} fontFamily="monospace"
      fill="var(--vscode-foreground, #ccc)">S</text>
  </svg>
);

const CoilUnlatch: React.FC = () => (
  <svg width={28} height={24} viewBox="0 0 28 24" fill="none">
    <line x1={2} y1={12} x2={7} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <line x1={21} y1={12} x2={26} y2={12} stroke="var(--vscode-foreground, #ccc)" strokeWidth={1.5} />
    <path d="M 11 5 Q 7 12 11 19" stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} fill="none" strokeLinecap="round" />
    <path d="M 17 5 Q 21 12 17 19" stroke="var(--vscode-foreground, #ccc)" strokeWidth={2} fill="none" strokeLinecap="round" />
    <text x={14} y={15} textAnchor="middle" fontSize={8} fontWeight={700} fontFamily="monospace"
      fill="var(--vscode-foreground, #ccc)">R</text>
  </svg>
);

// ── LD Items ──────────────────────────────────────────────────────────────────

interface LDItem {
  kind: string;
  title: string;
  Icon: React.FC;
  group: 'contacts' | 'coils' | 'timers' | 'counters' | 'bistable' | 'edge';
}

const LD_ITEMS: LDItem[] = [
  // Contacts
  { kind: 'contact-NO', title: 'Contact (NO) — Normally Open',   Icon: ContactNO,    group: 'contacts' },
  { kind: 'contact-NC', title: 'Contact (NC) — Normally Closed', Icon: ContactNC,    group: 'contacts' },
  { kind: 'contact-P',  title: 'Contact (P) — Rising Edge',      Icon: ContactP,     group: 'contacts' },
  { kind: 'contact-N',  title: 'Contact (N) — Falling Edge',     Icon: ContactN,     group: 'contacts' },
  // Coils
  { kind: 'coil-normal',   title: 'Coil (Normal)',         Icon: CoilNormal,   group: 'coils' },
  { kind: 'coil-negated',  title: 'Coil (Negated/NOT)',    Icon: CoilNegated,  group: 'coils' },
  { kind: 'coil-set',      title: 'Coil (Set/Latch)',      Icon: CoilSet,      group: 'coils' },
  { kind: 'coil-reset',    title: 'Coil (Reset/Unlatch)',  Icon: CoilReset,    group: 'coils' },
  { kind: 'coil-latch',    title: 'Coil (Latch S)',        Icon: CoilLatch,    group: 'coils' },
  { kind: 'coil-unlatch',  title: 'Coil (Unlatch R)',      Icon: CoilUnlatch,  group: 'coils' },
  // Timers
  { kind: 'block-TON', title: 'Block — TON (On-Delay Timer)',  Icon: BlockFB, group: 'timers' },
  { kind: 'block-TOF', title: 'Block — TOF (Off-Delay Timer)', Icon: BlockFB, group: 'timers' },
  { kind: 'block-TP',  title: 'Block — TP (Pulse Timer)',      Icon: BlockFB, group: 'timers' },
  // Counters
  { kind: 'block-CTU',  title: 'Block — CTU (Count Up)',       Icon: BlockFB, group: 'counters' },
  { kind: 'block-CTD',  title: 'Block — CTD (Count Down)',     Icon: BlockFB, group: 'counters' },
  { kind: 'block-CTUD', title: 'Block — CTUD (Count Up/Down)', Icon: BlockFB, group: 'counters' },
  // Bistable / Edge
  { kind: 'block-SR',    title: 'Block — SR (Set-dominant)',   Icon: BlockFB, group: 'bistable' },
  { kind: 'block-RS',    title: 'Block — RS (Reset-dominant)', Icon: BlockFB, group: 'bistable' },
  { kind: 'block-RTRIG', title: 'Block — R_TRIG (Rising Edge)', Icon: BlockFB, group: 'edge' },
  { kind: 'block-FTRIG', title: 'Block — F_TRIG (Falling Edge)', Icon: BlockFB, group: 'edge' },
];

// ── FBD Items ─────────────────────────────────────────────────────────────────

interface FBDItem {
  blockType: string;
  title: string;
  Icon: React.FC;
}

const FBD_ITEMS: FBDItem[] = [
  { blockType: 'IN_VARIABLE',  title: 'Input Variable',  Icon: FBDInputVar },
  { blockType: 'OUT_VARIABLE', title: 'Output Variable', Icon: FBDOutputVar },
  { blockType: 'AND',          title: 'Block — AND',     Icon: FBDBlock },
  { blockType: 'OR',           title: 'Block — OR',      Icon: FBDBlock },
  { blockType: 'TON',          title: 'Block — TON',     Icon: FBDBlock },
  { blockType: 'CTU',          title: 'Block — CTU',     Icon: FBDBlock },
];

// ── ActivityBar ───────────────────────────────────────────────────────────────

export const ActivityBar: React.FC<ActivityBarProps> = ({ language, onSFCAddStep, onSFCAddTransition }) => {
  return (
    <div style={{
      width: 44,
      flexShrink: 0,
      background: 'var(--vscode-activityBar-background, var(--vscode-sideBar-background, #252526))',
      borderRight: '1px solid var(--vscode-editorGroup-border)',
      padding: '4px 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      overflowY: 'auto',
      overflowX: 'hidden',
      zIndex: 1,
    }}>

      {language === 'LD' && (
        <>
          {/* Contacts group */}
          {LD_ITEMS.filter(i => i.group === 'contacts').map(item => (
            <IconWrap key={item.kind} title={item.title}
              onDragStart={e => { e.dataTransfer.setData('application/plc-ladder-element', item.kind); e.dataTransfer.effectAllowed = 'copy'; }}>
              <item.Icon />
            </IconWrap>
          ))}

          <div style={DIVIDER} />

          {/* Coils group */}
          {LD_ITEMS.filter(i => i.group === 'coils').map(item => (
            <IconWrap key={item.kind} title={item.title}
              onDragStart={e => { e.dataTransfer.setData('application/plc-ladder-element', item.kind); e.dataTransfer.effectAllowed = 'copy'; }}>
              <item.Icon />
            </IconWrap>
          ))}

          <div style={DIVIDER} />

          {/* Timers group */}
          {LD_ITEMS.filter(i => i.group === 'timers').map(item => (
            <IconWrap key={item.kind} title={item.title}
              onDragStart={e => { e.dataTransfer.setData('application/plc-ladder-element', item.kind); e.dataTransfer.effectAllowed = 'copy'; }}>
              <item.Icon />
            </IconWrap>
          ))}

          <div style={DIVIDER} />

          {/* Counters group */}
          {LD_ITEMS.filter(i => i.group === 'counters').map(item => (
            <IconWrap key={item.kind} title={item.title}
              onDragStart={e => { e.dataTransfer.setData('application/plc-ladder-element', item.kind); e.dataTransfer.effectAllowed = 'copy'; }}>
              <item.Icon />
            </IconWrap>
          ))}

          <div style={DIVIDER} />

          {/* Bistable + Edge Detect */}
          {LD_ITEMS.filter(i => i.group === 'bistable' || i.group === 'edge').map(item => (
            <IconWrap key={item.kind} title={item.title}
              onDragStart={e => { e.dataTransfer.setData('application/plc-ladder-element', item.kind); e.dataTransfer.effectAllowed = 'copy'; }}>
              <item.Icon />
            </IconWrap>
          ))}
        </>
      )}

      {language === 'FBD' && (
        <>
          {/* Variable types */}
          {FBD_ITEMS.slice(0, 2).map(item => (
            <IconWrap
              key={item.blockType}
              title={item.title}
              onDragStart={e => {
                e.dataTransfer.setData('application/plc-element', `block-${item.blockType}`);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <item.Icon />
            </IconWrap>
          ))}

          <div style={DIVIDER} />

          {/* Block types */}
          {FBD_ITEMS.slice(2).map(item => (
            <IconWrap
              key={item.blockType}
              title={item.title}
              onDragStart={e => {
                e.dataTransfer.setData('application/plc-element', `block-${item.blockType}`);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <item.Icon />
            </IconWrap>
          ))}
        </>
      )}

      {language === 'SFC' && (
        <>
          <IconWrap
            title="Add Step"
            isButton
            onClick={onSFCAddStep}
          >
            <SFCStepIcon />
          </IconWrap>

          <div style={DIVIDER} />

          <IconWrap
            title="Add Transition"
            isButton
            onClick={onSFCAddTransition}
          >
            <SFCTransIcon />
          </IconWrap>
        </>
      )}
    </div>
  );
};
