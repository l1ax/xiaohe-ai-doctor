import { describe, it, expect } from 'vitest';
import { buildIntentGuidance, buildPriorityReminder } from '../intentGuidance';

describe('Intent Guidance', () => {
  it('should provide guidance for symptom consultation', () => {
    const guidance = buildIntentGuidance(['symptom_consult'], {});

    expect(guidance).toContain('症状');
    expect(guidance).toContain('query_knowledge_base');
  });

  it('should provide guidance for emergency', () => {
    const guidance = buildIntentGuidance(['emergency'], {
      hasEmergencyKeywords: true,
      severity: 'severe'
    });

    expect(guidance).toContain('紧急');
    expect(guidance).toContain('就医');
  });

  it('should handle multiple intents', () => {
    const guidance = buildIntentGuidance(
      ['symptom_consult', 'medicine_info'],
      {}
    );

    expect(guidance).toContain('症状');
    expect(guidance).toContain('药品');
  });

  it('should provide guidance for medicine information', () => {
    const guidance = buildIntentGuidance(['medicine_info'], {});

    expect(guidance).toContain('药品');
    expect(guidance).toContain('用法用量');
  });

  it('should provide guidance for hospital recommendation', () => {
    const guidance = buildIntentGuidance(['hospital_recommend'], {});

    expect(guidance).toContain('医院');
    expect(guidance).toContain('search_web');
  });

  it('should provide guidance for health advice', () => {
    const guidance = buildIntentGuidance(['health_advice'], {});

    expect(guidance).toContain('健康');
    expect(guidance).toContain('query_knowledge_base');
  });

  it('should provide guidance for general Q&A', () => {
    const guidance = buildIntentGuidance(['general_qa'], {});

    expect(guidance).toContain('通用');
    expect(guidance).toContain('query_knowledge_base');
  });

  it('should prioritize emergency guidance when risk indicators present', () => {
    const guidance = buildIntentGuidance(['symptom_consult', 'emergency'], {
      hasEmergencyKeywords: true,
      severity: 'severe'
    });

    expect(guidance).toContain('紧急');
    expect(guidance.indexOf('紧急')).toBeLessThan(guidance.indexOf('症状'));
  });

  it('should return empty string for empty intents', () => {
    const guidance = buildIntentGuidance([], {});

    expect(guidance).toBe('');
  });

  it('should build priority reminder', () => {
    const reminder = buildPriorityReminder();

    expect(reminder).toContain('knowledge_base');
    expect(reminder).toContain('web_search');
    expect(reminder).toContain('model_knowledge');
    expect(reminder).toContain('优先级');
  });
});
