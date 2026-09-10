import { describe, expect, it } from 'vitest';
import { splitFlowPhases } from '@/lib/flow-phases';
import type { FlowNode } from '@/lib/recipe-schema';

function node(id: string, type: FlowNode['type'], label: string): FlowNode {
  return { id, type, label, detail: null, inputs: [], outputs: [], ingredientIds: [], durationMinutes: null, temperature: null };
}

describe('flow phase classification', () => {
  it('moves the cooking boundary to the first cooking action', () => {
    const phases = splitFlowPhases([
      node('mix', 'mix', 'Mix the batter'),
      node('pan', 'assemble', 'Pour into the pan'),
      node('bake', 'bake', 'Bake for 45 minutes'),
      node('check', 'prep', 'Check until the center is set'),
      node('cool', 'cool', 'Cool before slicing'),
    ]);

    expect(phases.prepare.map(item => item.id)).toEqual(['mix', 'pan']);
    expect(phases.cook.map(item => item.id)).toEqual(['bake', 'check']);
    expect(phases.finish.map(item => item.id)).toEqual(['cool']);
  });

  it('recognizes localized cooking and finishing keywords', () => {
    const phases = splitFlowPhases([
      node('prep', 'combine', 'Campurkan bahan'),
      node('cook', 'prep', 'Bakar selama 30 minit'),
      node('finish', 'prep', 'Sejukkan sebelum dihidangkan'),
    ]);

    expect(phases.prepare.map(item => item.id)).toEqual(['prep']);
    expect(phases.cook.map(item => item.id)).toEqual(['cook']);
    expect(phases.finish.map(item => item.id)).toEqual(['finish']);
  });

  it('reserves the final actions for Finish when extraction has no finish type', () => {
    const phases = splitFlowPhases([
      node('mix', 'mix', 'Mix ingredients'),
      node('bake', 'bake', 'Bake until golden'),
      node('rest', 'prep', 'Rest for 10 minutes'),
      node('slice', 'prep', 'Slice and serve'),
    ]);

    expect(phases.prepare.map(item => item.id)).toEqual(['mix']);
    expect(phases.cook.map(item => item.id)).toEqual(['bake']);
    expect(phases.finish.map(item => item.id)).toEqual(['rest', 'slice']);
    expect(phases.finish.length).toBeGreaterThan(0);
  });
});
