import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const AUDIO_RE = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;

// Custom renderers: images get framed; links to audio files become players.
const components: Components = {
  img: ({ src, alt }) =>
    typeof src === "string" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ""} className="my-3 max-h-96 rounded-sm border border-stone-200 object-contain" />
    ) : null,

  a: ({ href, children }) => {
    if (typeof href === "string" && AUDIO_RE.test(href)) {
      return (
        <span className="my-2 block">
          <audio controls src={href} className="w-full max-w-md">
            <a href={href}>Audio</a>
          </audio>
        </span>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-stone-700 underline underline-offset-2 hover:text-stone-900">
        {children}
      </a>
    );
  },

  h1: ({ children }) => <h1 className="mt-6 mb-2 font-display text-2xl font-semibold text-stone-900 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-5 mb-2 font-display text-xl font-semibold text-stone-900 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-4 mb-1.5 font-display text-lg font-medium text-stone-800 first:mt-0">{children}</h3>,
  p:  ({ children }) => <p className="my-3 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-stone-300 pl-4 italic text-stone-600">{children}</blockquote>,
  code: ({ children }) => <code className="rounded-sm bg-stone-100 px-1 py-0.5 font-mono text-[0.85em] text-stone-700">{children}</code>,
  hr: () => <hr className="my-6 border-stone-200" />,
  table: ({ children }) => <table className="my-3 w-full border-collapse text-sm">{children}</table>,
  th: ({ children }) => <th className="border border-stone-200 bg-stone-50 px-2 py-1 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border border-stone-200 px-2 py-1">{children}</td>,
};

/** Renders narrative markdown with inline media (images + audio). */
export default function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`font-display text-base text-stone-800 ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
