import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MedicalAdviceCard } from '../../src/components/message/MessageRenderer';

describe('MedicalAdviceCard', () => {
  const mockAdvice = {
    symptoms: ['发热', '头痛', '乏力'],
    possibleConditions: ['上呼吸道感染', '流感'],
    suggestions: ['多休息', '多喝水', '必要时就医'],
    urgencyLevel: 'medium' as const,
  };

  describe('渲染测试', () => {
    it('应该渲染医疗建议卡片', () => {
      render(<MedicalAdviceCard advice={mockAdvice} />);

      expect(screen.getByText('健康建议')).toBeInTheDocument();
    });

    it('应该显示紧急程度标签', () => {
      render(<MedicalAdviceCard advice={mockAdvice} />);

      expect(screen.getByText('建议就医')).toBeInTheDocument();
    });

    it('应该显示可能症状', () => {
      render(<MedicalAdviceCard advice={mockAdvice} />);

      expect(screen.getByText('可能症状')).toBeInTheDocument();
      expect(screen.getByText('发热')).toBeInTheDocument();
      expect(screen.getByText('头痛')).toBeInTheDocument();
      expect(screen.getByText('乏力')).toBeInTheDocument();
    });

    it('应该显示可能情况', () => {
      render(<MedicalAdviceCard advice={mockAdvice} />);

      expect(screen.getByText('可能情况')).toBeInTheDocument();
      expect(screen.getByText('上呼吸道感染')).toBeInTheDocument();
      expect(screen.getByText('流感')).toBeInTheDocument();
    });

    it('应该显示建议列表', () => {
      render(<MedicalAdviceCard advice={mockAdvice} />);

      expect(screen.getByText('建议')).toBeInTheDocument();
      expect(screen.getByText('多休息')).toBeInTheDocument();
      expect(screen.getByText('多喝水')).toBeInTheDocument();
      expect(screen.getByText('必要时就医')).toBeInTheDocument();
    });
  });

  describe('紧急程度测试', () => {
    it('low 紧急程度应该显示绿色样式', () => {
      const lowAdvice = { ...mockAdvice, urgencyLevel: 'low' as const };
      render(<MedicalAdviceCard advice={lowAdvice} />);

      expect(screen.getByText('建议关注')).toBeInTheDocument();
    });

    it('high 紧急程度应该显示红色样式', () => {
      const highAdvice = { ...mockAdvice, urgencyLevel: 'high' as const };
      render(<MedicalAdviceCard advice={highAdvice} />);

      expect(screen.getByText('尽快就医')).toBeInTheDocument();
    });
  });

  describe('空数据测试', () => {
    it('空症状不应该渲染症状部分', () => {
      const emptySymptomAdvice = {
        ...mockAdvice,
        symptoms: [],
      };
      render(<MedicalAdviceCard advice={emptySymptomAdvice} />);

      expect(screen.queryByText('可能症状')).not.toBeInTheDocument();
    });

    it('空可能情况不应该渲染可能情况部分', () => {
      const emptyConditionAdvice = {
        ...mockAdvice,
        possibleConditions: [],
      };
      render(<MedicalAdviceCard advice={emptyConditionAdvice} />);

      expect(screen.queryByText('可能情况')).not.toBeInTheDocument();
    });

    it('空建议不应该渲染建议部分', () => {
      const emptySuggestionAdvice = {
        ...mockAdvice,
        suggestions: [],
      };
      render(<MedicalAdviceCard advice={emptySuggestionAdvice} />);

      expect(screen.queryByText('建议')).not.toBeInTheDocument();
    });
  });
});
