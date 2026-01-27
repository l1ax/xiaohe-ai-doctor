import React, { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css'; // 默认使用暗色代码主题，符合 AI 风格

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * 通用 Markdown 渲染组件
 * 使用 markdown-it 引擎，支持代码高亮和更精细的样式控制
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const md: MarkdownIt = useMemo(() => {
    const instance = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      highlight: (str: string, lang: string): string => {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return `<pre class="hljs"><code>${
              hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
            }</code></pre>`;
          } catch (__) {
            /* ignore */
          }
        }
        return `<pre class="hljs"><code>${instance.utils.escapeHtml(str)}</code></pre>`;
      },
    });
    return instance;
  }, []);

  const renderedContent = useMemo(() => {
    return { __html: md.render(content) };
  }, [content, md]);

  return (
    <div 
      className={`markdown-body ${className}`}
      dangerouslySetInnerHTML={renderedContent}
    />
  );
};
