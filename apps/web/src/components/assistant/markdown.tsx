import type { Components } from "react-markdown";
import MarkdownLib from "react-markdown";
import { Link } from "react-router";

const TASK_KEY = /^[A-Z][A-Z0-9]{1,5}-\d+$/;

const components: Components = {
  a({ href, children }) {
    if (href?.startsWith("/")) return <Link to={href}>{children}</Link>;
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
  strong({ children }) {
    const text = String(children);
    if (TASK_KEY.test(text)) {
      return (
        <Link to={`/tasks?q=${encodeURIComponent(text)}`} className="font-mono text-accent hover:underline">
          {text}
        </Link>
      );
    }
    return <strong>{children}</strong>;
  },
};

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-chat">
      <MarkdownLib components={components}>{text}</MarkdownLib>
    </div>
  );
}
