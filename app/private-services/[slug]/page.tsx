import type { Metadata } from "next";
import Image from "next/image";
import parse, {
  domToReact,
  Element as HtmlElement,
  type DOMNode,
  type HTMLReactParserOptions,
} from "html-react-parser";
import { ShieldCheck, Truck, MessageCircle, CheckCircle2 } from "lucide-react";
import Container from "@/components/ui/Container";
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

// Recursively collect all <img> elements under a node
function collectImgElements(node: any, acc: HtmlElement[] = []): HtmlElement[] {
  if (!node) return acc;

  if (node.type === "tag") {
    const el = node as HtmlElement;

    if (el.name === "img") {
      acc.push(el);
    }

    if (el.children && Array.isArray(el.children)) {
      el.children.forEach((child) => collectImgElements(child, acc));
    }
  } else if ((node as any).children && Array.isArray((node as any).children)) {
    (node as any).children.forEach((child: any) =>
      collectImgElements(child, acc)
    );
  }

  return acc;
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

        // e.g. "Start now / Reorder" line -> CTA buttons row
        if (isButtonRow) {
          const anchors = children.filter(
            (child) =>
              child.type === "tag" && (child as HtmlElement).name === "a"
          ) as HtmlElement[];

          return (
            <div className="my-8 flex flex-wrap justify-center gap-3">
              {anchors.map((a, idx) => {
                const href = a.attribs.href || "#";

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
                    className={`${baseBtn} ${idx === 0 ? primary : secondary}`}
                  >
                    {label}
                  </a>
                );
              })}
            </div>
          );
        }

        // Paragraph that contains ANY <img> (even nested)
        const imgElements = collectImgElements(el);
        if (imgElements.length) {
          return (
            <div className="my-8 flex flex-col items-center gap-4">
              {imgElements.map((img, idx) => {
                const src = img.attribs.src || "";
                const alt = img.attribs.alt || "";
                return (
                  <figure key={idx} className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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

        // Normal paragraph, with detection for "callout" style
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

        // Callout paragraph if it starts with a short <strong> label
        const firstTagChild = children.find(
          (child) => child.type === "tag"
        ) as HtmlElement | undefined;
        const firstStrongLabel =
          firstTagChild && firstTagChild.name === "strong"
            ? getNodeText(firstTagChild)
            : "";
        const isCallout =
          !!firstStrongLabel &&
          firstStrongLabel.trim().length > 0 &&
          firstStrongLabel.trim().length <= 40 &&
          textContent.trim().length <= 260; // avoid giant blocks

        if (isCallout) {
          return (
            <div
              className={[
                "my-4 mx-auto max-w-2xl rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3",
                "text-sm md:text-[15px] leading-relaxed text-emerald-900 shadow-soft-card",
              ].join(" ")}
            >
              {childrenReact}
            </div>
          );
        }

        return (
          <p
            className={[
              "mb-4 max-w-2xl text-[13px] md:text-[15px] leading-relaxed tracking-[0.01em] text-slate-700",
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
            <h2 className="mb-5 mt-10 text-center text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              {childrenReact}
              <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
            </h2>
          );

        case "h3":
          return (
            <h3 className="mt-8 mb-3 border-l-4 border-emerald-200 pl-3 text-lg font-semibold text-slate-900 md:text-xl">
              {childrenReact}
            </h3>
          );

        case "h4":
          return (
            <h4 className="mt-6 mb-2 border-l-2 border-emerald-200 pl-3 text-base font-semibold text-slate-900 md:text-lg">
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
            <ul className="my-5 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-slate-700 shadow-soft-card">
              {childrenReact}
            </ul>
          );

        case "ol":
          return (
            <ol className="my-5 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-slate-700 shadow-soft-card">
              {childrenReact}
            </ol>
          );

        case "li":
          // Iconic bullet style, similar to NHS page
          return (
            <li className="flex items-start gap-2 text-sm leading-relaxed text-slate-700 md:text-[15px]">
              <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-emerald-500" />
              <span>{childrenReact}</span>
            </li>
          );

        case "a": {
          const href = el.attribs.href || "#";

          return (
            <a
              href={href}
              className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
            >
              {childrenReact}
            </a>
          );
        }

        case "blockquote":
          return (
            <blockquote className="my-6 mx-auto max-w-2xl rounded-2xl border-l-4 border-emerald-400 bg-emerald-50/70 px-5 py-3 text-sm italic text-emerald-900 shadow-soft-card">
              {childrenReact}
            </blockquote>
          );

        case "table":
          return (
            <div className="my-6 overflow-x-auto">
              <table className="min-w-full border-collapse overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm shadow-soft-card">
                {childrenReact}
              </table>
            </div>
          );

        case "thead":
          return (
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {childrenReact}
            </thead>
          );

        case "tbody":
          return <tbody className="divide-y divide-slate-100">{childrenReact}</tbody>;

        case "tr":
          return <tr className="hover:bg-slate-50/60">{childrenReact}</tr>;

        case "th":
          return (
            <th className="px-4 py-2 text-xs font-semibold text-slate-700">
              {childrenReact}
            </th>
          );

        case "td":
          return (
            <td className="px-4 py-2 align-top text-xs text-slate-700">
              {childrenReact}
            </td>
          );

        case "img": {
          // images that are *not* wrapped in a paragraph
          const src = el.attribs.src || "";
          const alt = el.attribs.alt || "";
          return (
            <figure className="my-8 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                className="max-h-80 w-auto max-w-full rounded-3xl border border-slate-200/70 bg-slate-50/60 p-2 shadow-soft-card object-contain"
              />
            </figure>
          );
        }

        case "hr":
          return <div className="my-8 h-px w-full bg-slate-200" />;

        case "br":
          return <br />;

        default:
          return;
      }
    },
  };

  return (
    <div className="rich-content mx-auto max-w-3xl space-y-4 text-[13px] leading-relaxed tracking-[0.01em] text-slate-700 md:text-[15px]">
      {parse(html, options)}
    </div>
  );
}

/* ------------ Page component with “iconic” layout ------------ */

export default async function ServiceLanding({
  params,
}: {
  params: ParamsPromise;
}) {
  const { slug } = await params;
  const page = await fetchPageBySlug(slug);

  if (!page) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
          Service page not found.
        </section>
      </main>
    );
  }

  const html = page.rendered_html || page.content || "";

  const bg = page.meta?.background;
  const bgUrl = bg?.url || null;
  const resolvedBgUrl = resolveMediaUrl(bgUrl);
  const bgEnabled = bg?.enabled ?? true;
  const overlayPct = Math.max(0, Math.min(80, Number(bg?.overlay ?? 30)));
  const blur = Number(bg?.blur ?? 12);
  const blurCls = blurClass(blur);

  const hasBg = Boolean(bgUrl && bgEnabled);

  return (
    <main className="bg-slate-50">
      {/* HERO – styled similarly to NHS services page */}
      <section className="relative border-b border-emerald-100/70 bg-gradient-to-b from-emerald-50/70 via-white to-emerald-50/30">
        {hasBg && (
          <div className="pointer-events-none absolute inset-0">
            <Image
              src={resolvedBgUrl}
              alt={page.title || ""}
              fill
              priority={false}
              sizes="100vw"
              className="object-cover opacity-70"
            />
            <div
              className="absolute inset-0 bg-slate-900"
              style={{ opacity: overlayPct / 100, mixBlendMode: "multiply" }}
            />
          </div>
        )}

        <div className="relative">
          <Container>
            <div className="py-8 md:py-12 lg:py-16">
              <div
                className={`mx-auto max-w-5xl rounded-3xl border border-emerald-100/70 bg-white/85 ${blurCls} px-5 py-6 shadow-soft-card ring-1 ring-slate-900/5 md:px-8 md:py-8`}
              >
                {/* Top pill */}
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                  <span className="h-1 w-1 rounded-full bg-emerald-700" />
                  <span>Pharmacy Express</span>
                </div>

                {/* Title intentionally left dynamic / handled by content if needed */}

                {/* Icon chips – iconic feel like NHS page */}
                <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 shadow-sm ring-1 ring-slate-100">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    GPhC-registered UK pharmacy
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 shadow-sm ring-1 ring-slate-100">
                    <Truck className="h-3.5 w-3.5 text-emerald-500" />
                    Fast, discreet delivery
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 shadow-sm ring-1 ring-slate-100">
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                    Online clinician support
                  </span>
                </div>
              </div>
            </div>
          </Container>
        </div>
      </section>

      {/* MAIN CONTENT – dynamic rendered HTML inside a card */}
      <section className="border-b border-slate-200 bg-white/95 py-8 md:py-12">
        <Container>
          <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200/80 bg-white/95 px-5 py-6 shadow-soft-card md:px-8 md:py-8">
            <RichContent html={html} />
          </div>
        </Container>
      </section>
    </main>
  );
}
