// app/private-services/[slug]/page.tsx

import type { Metadata } from "next";
import Image from "next/image";
import parse, {
  domToReact,
  Element as HtmlElement,
  type DOMNode,
  type HTMLReactParserOptions,
} from "html-react-parser";
import { fetchPageBySlug } from "@/lib/api";

export const revalidate = 0;

/* ------------ Next.js 15: params is a Promise ------------ */

type ParamsPromise = Promise<{ slug: string }>;

/* ------------ Metadata (SEO) ------------ */

export async function generateMetadata({
  params,
}: {
  params: ParamsPromise;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPageBySlug(slug);

  return {
    title: page?.meta_title || page?.title || "",
    description: page?.meta_description || page?.description || undefined,
  };
}

/* ------------ Helpers ------------ */

function blurClass(n: number): string {
  if (n <= 0) return "backdrop-blur-0";
  if (n <= 4) return "backdrop-blur-sm";
  if (n <= 8) return "backdrop-blur";
  if (n <= 12) return "backdrop-blur-md";
  if (n <= 16) return "backdrop-blur-lg";
  if (n <= 20) return "backdrop-blur-xl";
  if (n <= 24) return "backdrop-blur-2xl";
  return "backdrop-blur-3xl";
}

function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const origin =
    process.env.NEXT_PUBLIC_MEDIA_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "";

  if (!origin) return path;

  return `${origin.replace(/\/$/, "")}${
    path.startsWith("/") ? path : `/${path}`
  }`;
}

// Grab plain text from a node tree (used to detect empty strong/span wrappers)
function getNodeText(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.data ?? "";
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(getNodeText).join("");
  }
  return "";
}

/* ------------ Styled HTML renderer (styles your content HTML) ------------ */

function RichContent({ html }: { html: string }) {
  if (!html) return null;

  const options: HTMLReactParserOptions = {
    replace(domNode) {
      if (domNode.type !== "tag") return;

      const el = domNode as HtmlElement;
      const classAttr = el.attribs?.class || "";
      const isCentered = classAttr.split(" ").includes("ql-align-center");

      /* ---------- CTA paragraph: only links / <br> / empty spans ---------- */
      if (el.name === "p") {
        const children = el.children || [];

        const hasAnchor = children.some(
          (child) => child.type === "tag" && (child as HtmlElement).name === "a"
        );

        const isButtonRow =
          hasAnchor &&
          children.every((child) => {
            if (child.type === "text") {
              const text = (child as any).data ?? "";
              return !text.trim();
            }
            if (child.type === "tag") {
              const name = (child as HtmlElement).name;
              if (name === "a" || name === "br") return true;
              if (name === "strong" || name === "span") {
                const t = getNodeText(child);
                return !t.trim();
              }
            }
            return false;
          });

        // e.g. "Start now / Reorder" line
        if (isButtonRow) {
          const anchors = children.filter(
            (child) =>
              child.type === "tag" && (child as HtmlElement).name === "a"
          ) as HtmlElement[];

          return (
            <div className="my-8 flex flex-wrap justify-center gap-3">
              {anchors.map((a, idx) => {
                const href = a.attribs.href || "#";
                const target = a.attribs.target;
                const rel =
                  target === "_blank" ? "noopener noreferrer" : undefined;

                const label = domToReact(
                  (a.children || []) as unknown as DOMNode[],
                  options
                );

                const baseBtn =
                  "inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

                const primary =
                  "bg-emerald-600 text-white shadow-md hover:bg-emerald-700 focus-visible:ring-emerald-500";
                const secondary =
                  "border border-emerald-200 bg-white/90 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 focus-visible:ring-emerald-500";

                return (
                  <a
                    key={idx}
                    href={href}
                    target={target}
                    rel={rel}
                    className={`${baseBtn} ${idx === 0 ? primary : secondary}`}
                  >
                    {label}
                  </a>
                );
              })}
            </div>
          );
        }

        // 🔧 NEW: paragraph that contains <img> → render as image block, not <p>
        const hasImgTag = children.some(
          (child) =>
            child.type === "tag" && (child as HtmlElement).name === "img"
        );
        if (hasImgTag) {
          const imgs = children.filter(
            (child) =>
              child.type === "tag" && (child as HtmlElement).name === "img"
          ) as HtmlElement[];

          return (
            <div className="my-8 flex flex-col items-center gap-4">
              {imgs.map((img, idx) => {
                const src = img.attribs.src || "";
                const alt = img.attribs.alt || "";
                return (
                  <figure key={idx} className="flex justify-center">
                    <img
                      src={src}
                      alt={alt}
                      className="max-h-80 w-auto max-w-full rounded-3xl border border-slate-200/70 bg-slate-50/60 p-2 shadow-soft-card object-contain"
                    />
                  </figure>
                );
              })}
            </div>
          );
        }

        // Normal paragraph
        const childrenReact = domToReact(
          (el.children || []) as unknown as DOMNode[],
          options
        );

        const hasNonBrTag = children.some(
          (child) =>
            child.type === "tag" && (child as HtmlElement).name !== "br"
        );
        const textContent = children.map((c) => getNodeText(c)).join("");

        // Pure spacer paragraphs (just <br> / spaces)
        if (!hasNonBrTag && !textContent.trim()) {
          return <div className="h-4 md:h-6" />;
        }

        return (
          <p
            className={[
              "mb-4 max-w-2xl text-sm md:text-base leading-relaxed text-slate-700",
              "mx-auto",
              isCentered ? "text-center" : "text-left",
            ].join(" ")}
          >
            {childrenReact}
          </p>
        );
      }

      // For everything else, render children then wrap in styled tag
      const childrenReact = domToReact(
        (el.children || []) as unknown as DOMNode[],
        options
      );

      switch (el.name) {
        case "h1":
          return (
            <h1 className="mb-5 mt-2 text-center text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
                {childrenReact}
              </span>
            </h1>
          );

        case "h2":
          return (
            <h2 className="mb-4 mt-10 text-center text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              {childrenReact}
              <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-emerald-400/80" />
            </h2>
          );

        case "h3":
          return (
            <h3 className="mt-8 mb-3 text-lg font-semibold text-slate-900 md:text-xl">
              {childrenReact}
            </h3>
          );

        case "h4":
          return (
            <h4 className="mt-6 mb-2 text-base font-semibold text-slate-900 md:text-lg">
              {childrenReact}
            </h4>
          );

        case "strong":
          return (
            <strong className="font-semibold text-slate-900">
              {childrenReact}
            </strong>
          );

        case "em":
          return <em className="text-slate-800">{childrenReact}</em>;

        case "ul":
          return (
            <ul className="my-5 space-y-2 rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
              {childrenReact}
            </ul>
          );

        case "ol":
          return (
            <ol className="my-5 space-y-2 rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
              {childrenReact}
            </ol>
          );

        case "li":
          return (
            <li className="relative pl-4 text-sm leading-relaxed text-slate-700 md:text-base">
              <span className="absolute left-0 top-2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-emerald-400" />
              {childrenReact}
            </li>
          );

        case "a": {
          const href = el.attribs.href || "#";
          const target = el.attribs.target;
          const rel = target === "_blank" ? "noopener noreferrer" : undefined;

          return (
            <a
              href={href}
              target={target}
              rel={rel}
              className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
            >
              {childrenReact}
            </a>
          );
        }

        case "img": {
          // images that are *not* wrapped in a paragraph
          const src = el.attribs.src || "";
          const alt = el.attribs.alt || "";
          return (
            <figure className="my-8 flex justify-center">
              <img
                src={src}
                alt={alt}
                className="max-h-80 w-auto max-w-full rounded-3xl border border-slate-200/70 bg-slate-50/60 p-2 shadow-soft-card object-contain"
              />
            </figure>
          );
        }

        case "br":
          return <br />;

        default:
          return;
      }
    },
  };

  return (
    <div className="rich-content mx-auto max-w-3xl space-y-2 text-sm leading-relaxed text-slate-700 md:text-base">
      {parse(html, options)}
    </div>
  );
}

/* ------------ Page component ------------ */

export default async function ServiceLanding({
  params,
}: {
  params: ParamsPromise;
}) {
  const { slug } = await params;
  const page = await fetchPageBySlug(slug);

  const html = page.rendered_html || page.content || "";

  const bg = page.meta?.background;
  const bgUrl = bg?.url || null;
  const resolvedBgUrl = resolveMediaUrl(bgUrl);
  const bgEnabled = bg?.enabled ?? true;
  const overlayPct = Math.max(0, Math.min(80, Number(bg?.overlay ?? 30)));
  const blur = Number(bg?.blur ?? 12);
  const blurCls = blurClass(blur);

  // Simple layout if no background image configured
  if (!bgUrl || !bgEnabled) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-slate-50/90 p-6 shadow-soft-card md:p-10">
          {/* soft theme gradient */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-50/70 via-white to-cyan-50/60" />
          <div className="relative">
            <RichContent html={html} />
          </div>
        </section>
      </main>
    );
  }

  // Layout with hero background image
  return (
    <div className="relative min-h-screen bg-black">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src={resolvedBgUrl}
          alt={page.title || ""}
          fill
          priority={false}
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${overlayPct / 100})` }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10">
        <div
          className={`rounded-4xl bg-amber-50/95 ${blurCls} p-6 shadow-2xl ring-1 ring-black/10 md:p-10`}
        >
          <RichContent html={html} />
        </div>
      </div>
    </div>
  );
}
