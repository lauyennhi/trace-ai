import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { normalizeVietnameseText } from "../lib/formatText";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "",
}) => {
  const normalized = normalizeVietnameseText(content);

  return (
    <div
      className={`markdown-content font-sans text-xs md:text-sm leading-relaxed ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ ...props }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <table
                className="w-full text-left text-xs border-collapse divide-y divide-zinc-200 dark:divide-zinc-800 font-sans"
                {...props}
              />
            </div>
          ),
          thead: ({ ...props }) => (
            <thead
              className="bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 font-bold uppercase tracking-wider text-[11px]"
              {...props}
            />
          ),
          th: ({ ...props }) => (
            <th
              className="py-2.5 px-3.5 border-r last:border-r-0 border-zinc-200 dark:border-zinc-800 font-bold"
              {...props}
            />
          ),
          tbody: ({ ...props }) => (
            <tbody
              className="divide-y divide-zinc-100 dark:divide-zinc-800/50 bg-white dark:bg-zinc-900/40"
              {...props}
            />
          ),
          tr: ({ ...props }) => (
            <tr
              className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
              {...props}
            />
          ),
          td: ({ ...props }) => (
            <td
              className="py-2.5 px-3.5 border-r last:border-r-0 border-zinc-100 dark:border-zinc-800/60 align-top text-zinc-800 dark:text-zinc-200 font-normal leading-relaxed"
              {...props}
            />
          ),
          h1: ({ ...props }) => (
            <h1
              className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 mt-4 mb-2 first:mt-0 tracking-tight"
              {...props}
            />
          ),
          h2: ({ ...props }) => (
            <h2
              className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-3.5 mb-1.5 first:mt-0 tracking-tight"
              {...props}
            />
          ),
          h3: ({ ...props }) => (
            <h3
              className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-2.5 mb-1 first:mt-0 uppercase tracking-wide"
              {...props}
            />
          ),
          p: ({ ...props }) => <p className="mb-2 last:mb-0 leading-relaxed font-sans" {...props} />,
          ul: ({ ...props }) => (
            <ul className="list-disc list-inside space-y-1 mb-2 pl-1" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="list-decimal list-inside space-y-1 mb-2 pl-1" {...props} />
          ),
          li: ({ ...props }) => (
            <li className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans" {...props} />
          ),
          blockquote: ({ ...props }) => (
            <blockquote
              className="border-l-4 border-amber-500 pl-3 py-1 my-2 bg-amber-500/5 dark:bg-amber-500/10 rounded-r-lg italic text-zinc-700 dark:text-zinc-300 font-sans"
              {...props}
            />
          ),
          code: ({ inline, children, ...props }: any) => {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-[11px] border border-zinc-200 dark:border-zinc-700 font-medium"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="p-3 my-2 rounded-xl bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto border border-zinc-800 leading-relaxed">
                <code {...props}>{children}</code>
              </pre>
            );
          },
          hr: ({ ...props }) => (
            <hr className="my-4 border-t border-zinc-200 dark:border-zinc-800" {...props} />
          ),
          strong: ({ ...props }) => (
            <strong className="font-bold text-zinc-900 dark:text-zinc-100" {...props} />
          ),
          em: ({ ...props }) => (
            <em className="italic font-medium font-sans" {...props} />
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
};
