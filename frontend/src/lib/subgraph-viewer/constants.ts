/** Node dimensions for ELK layout. */
export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 60;

export const LAYER_ORDER = ['api', 'service', 'data', 'ui', 'util', 'other'] as const;

export const LAYER_COLORS: Record<string, string> = {
  api:     '#6366f1',
  service: '#8b5cf6',
  data:    '#06b6d4',
  ui:      '#f59e0b',
  util:    '#64748b',
  other:   '#475569',
};

export const TYPE_COLORS: Record<string, string> = {
  file:     '#3b82f6',
  function: '#10b981',
  class:    '#8b5cf6',
  module:   '#ec4899',
  folder:   '#f59e0b',
  layer:    '#6366f1',
};

export const COMPLEXITY_COLORS: Record<string, string> = {
  simple:   '#10b981',
  moderate: '#f59e0b',
  complex:  '#ef4444',
};
