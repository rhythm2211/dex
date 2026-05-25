'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { TYPE_COLORS } from '../constants';

export interface FocusedNodeData {
  label: string;
  fullName: string;
  nodeType: string;
  layer: string;
  layerName: string;
  color: string;
  complexity: 'simple' | 'moderate' | 'complex';
  summary: string;
  isHighlighted: boolean;
  searchScore?: number;
  isSelected: boolean;
  isNeighbor: boolean;
  isSelectionFaded: boolean;
  isSeed: boolean;
}

const TYPE_GLYPHS: Record<string, string> = {
  file:     '◈',
  function: 'ƒ',
  class:    '◇',
  module:   '⬡',
  folder:   '⊞',
};

function FocusedNodeComponent({ data, selected }: NodeProps<FocusedNodeData>) {
  const isSelected = selected || data.isSelected;
  const accentColor = data.color || '#475569';
  const typeColor = TYPE_COLORS[data.nodeType] || accentColor;
  const relevance = data.searchScore !== undefined ? Math.round((1 - data.searchScore) * 100) : null;
  const glyph = TYPE_GLYPHS[data.nodeType] || '○';

  const opacity = data.isSelectionFaded ? 0.22 : 1;

  const rightBorderColor = isSelected
    ? 'rgba(255,255,255,0.12)'
    : data.isNeighbor
    ? 'rgba(148,163,184,0.18)'
    : 'rgba(255,255,255,0.05)';

  const shadow = isSelected
    ? `0 0 0 1px rgba(255,255,255,0.15), 0 4px 24px rgba(0,0,0,0.7)`
    : data.isSeed
    ? `0 0 14px rgba(251,191,36,0.18), 0 2px 10px rgba(0,0,0,0.5)`
    : `0 2px 8px rgba(0,0,0,0.45)`;

  const leftAccentColor = data.isSeed
    ? '#fbbf24'
    : isSelected
    ? '#ffffff'
    : accentColor;

  const monoFont = "var(--font-geist-mono,'JetBrains Mono',ui-monospace,monospace)";

  return (
    <div
      style={{
        width: 200,
        opacity,
        background: 'rgba(10,10,20,0.92)',
        borderRadius: 8,
        border: `1px solid ${rightBorderColor}`,
        borderLeft: `3px solid ${leftAccentColor}`,
        boxShadow: shadow,
        animation: isSelected ? 'pulse-ring 2s ease-out infinite' : undefined,
        transition: 'opacity 0.15s ease, box-shadow 0.15s ease',
        cursor: 'pointer',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: 'transparent', border: 'none', width: 6, height: 6, top: -3 }}
      />

      <div style={{ padding: '8px 10px 7px 10px' }}>
        {/* Name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
          <span style={{ color: accentColor, fontSize: 11, lineHeight: 1, flexShrink: 0, fontFamily: monoFont }}>
            {glyph}
          </span>
          <span
            title={data.fullName}
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: '#f0f0f5',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.25,
              flex: 1,
              minWidth: 0,
              fontFamily: monoFont,
            }}
          >
            {data.label}
          </span>
          {relevance !== null && (
            <span
              style={{
                fontSize: 9,
                color: '#fbbf24',
                fontWeight: 600,
                flexShrink: 0,
                opacity: 0.9,
              }}
            >
              {relevance}%
            </span>
          )}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: typeColor,
              background: `${typeColor}14`,
              border: `1px solid ${typeColor}28`,
              borderRadius: 4,
              padding: '1px 5px',
              flexShrink: 0,
              fontFamily: monoFont,
            }}
          >
            {data.nodeType}
          </span>
          <span
            style={{
              fontSize: 9,
              color: '#6b7280',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {data.layerName}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: 'transparent', border: 'none', width: 6, height: 6, bottom: -3 }}
      />
    </div>
  );
}

export default memo(FocusedNodeComponent);
