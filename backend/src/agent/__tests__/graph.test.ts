import { describe, it, expect } from 'vitest';
import { createAgentGraph } from '../graph';

describe('Agent Graph Structure', () => {
  it('should compile graph without errors', () => {
    expect(() => createAgentGraph()).not.toThrow();
  });

  it('should have correct node names', () => {
    const graph = createAgentGraph();
    const nodeNames = Object.keys((graph as any).nodes);

    // 应该包含新节点
    expect(nodeNames).toContain('classifyIntent');
    expect(nodeNames).toContain('reactLoop');
    expect(nodeNames).toContain('finalResponse');

    // 不应该包含旧节点
    expect(nodeNames).not.toContain('symptomAnalysis');
    expect(nodeNames).not.toContain('consultation');
    expect(nodeNames).not.toContain('hospitalRecommend');
    expect(nodeNames).not.toContain('medicineInfo');
    expect(nodeNames).not.toContain('synthesizeResponse');
  });
});
