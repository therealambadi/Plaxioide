/*
 * TagBindingInput — inline autocomplete input for binding IEC tags/addresses.
 * Shows filtered suggestions from the tag database with type info.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TagRef, TagEntry, IECDataType, useLogicStoreSelector } from '../logicStore.js';
import { logicStore } from '../logicStore.js';

interface TagBindingInputProps {
  value: TagRef;
  onChange: (tag: TagRef) => void;
  allowedTypes?: IECDataType[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const TagBindingInput: React.FC<TagBindingInputProps> = ({
  value, onChange, allowedTypes, placeholder = 'Tag name or %I0.0...', className = '', autoFocus
}) => {
  const tagDatabase = useLogicStoreSelector(s => s.tagDatabase);
  const [inputVal, setInputVal] = useState(value.name || value.address || '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const filtered = tagDatabase
    .filter(t => {
      if (allowedTypes && !allowedTypes.includes(t.dataType)) return false;
      const q = inputVal.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.address.toLowerCase().includes(q);
    })
    .slice(0, 12);

  const isAddress = (s: string) => /^%[IQM]/.test(s);

  const commit = useCallback((raw: string) => {
    if (!raw.trim()) return;
    if (isAddress(raw)) {
      // Raw IEC address — create synthetic tag
      onChange({ name: raw, address: raw, dataType: 'BOOL' });
    } else {
      const match = tagDatabase.find(t => t.name === raw);
      if (match) {
        onChange({ name: match.name, address: match.address, dataType: match.dataType });
      } else {
        // New unresolved tag
        onChange({ name: raw, dataType: 'BOOL' });
      }
    }
    setOpen(false);
  }, [tagDatabase, onChange]);

  const selectSuggestion = useCallback((tag: TagEntry) => {
    setInputVal(tag.name);
    onChange({ name: tag.name, address: tag.address, dataType: tag.dataType });
    setOpen(false);
  }, [onChange]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown') { setOpen(true); return; }
      if (e.key === 'Enter') { commit(inputVal); return; }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) selectSuggestion(filtered[highlighted]); else commit(inputVal); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  // Type badge color
  const typeColor = (dt: IECDataType) => {
    if (dt === 'BOOL') return '#4ade80';
    if (['INT','UINT','DINT','UDINT','LINT','ULINT'].includes(dt)) return '#60a5fa';
    if (['REAL','LREAL'].includes(dt)) return '#f472b6';
    return '#a78bfa';
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={inputVal}
        onChange={e => { setInputVal(e.target.value); setOpen(true); setHighlighted(0); }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        style={{
          width: '100%',
          background: '#1e1e2e',
          border: '1px solid #3f3f5a',
          borderRadius: 4,
          color: '#cdd6f4',
          padding: '4px 8px',
          fontSize: 12,
          outline: 'none',
          boxSizing: 'border-box',
        }}
        spellCheck={false}
      />
      {/* Current tag address hint */}
      {value.address && value.address !== inputVal && (
        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#6c7086', pointerEvents: 'none' }}>
          {value.address}
        </span>
      )}
      {open && filtered.length > 0 && (
        <div
          ref={dropRef}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
            background: '#181825', border: '1px solid #3f3f5a', borderRadius: 4,
            maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          {filtered.map((tag, i) => (
            <div
              key={tag.name}
              onMouseDown={() => selectSuggestion(tag)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 10px', cursor: 'pointer',
                background: i === highlighted ? '#313244' : 'transparent',
                color: '#cdd6f4', fontSize: 12,
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span style={{ fontFamily: 'monospace', flex: 1 }}>{tag.name}</span>
              <span style={{ color: '#6c7086', fontSize: 10, fontFamily: 'monospace' }}>{tag.address}</span>
              <span style={{
                background: typeColor(tag.dataType) + '30',
                color: typeColor(tag.dataType),
                borderRadius: 3, padding: '1px 5px', fontSize: 10, fontWeight: 600,
              }}>{tag.dataType}</span>
              {tag.liveValue !== undefined && (
                <span style={{ color: '#a6e3a1', fontSize: 10 }}>{tag.liveValue}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
