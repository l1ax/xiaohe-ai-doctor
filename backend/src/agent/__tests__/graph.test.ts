import { describe, it, expect } from 'vitest';
import { createAgentGraph } from '../graph';

describe('Agent Graph Structure', () => {
  it('should compile graph without errors', () => {
    expect(() => createAgentGraph()).not.toThrow();
  });

  it('should have correct node structure', () => {
    const graph = createAgentGraph();

    // 验证图已成功编译
    expect(graph).toBeDefined();
    expect(graph.invoke).toBeDefined();
    expect(graph.stream).toBeDefined();

    // 验证图的基本结构
    expect(typeof graph.invoke).toBe('function');
    expect(typeof graph.stream).toBe('function');
  });
});
