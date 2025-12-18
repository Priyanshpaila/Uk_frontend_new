"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";

import {
  fetchRafFormForService,
  createConsultationSessionApi,
  saveRafAnswersApi,
  uploadPageImageApi,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Types & helpers for dynamic questions                              */
/* ------------------------------------------------------------------ */

type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "radio"
  | "date"
  | "file"
  // layout / non-answer elements:
  | "static-text"
  | "divider"
  | "image"
  | "page-break";

type VisibilityCond = {
  field: string;
  equals?: any;
  in?: any[];
  notEquals?: any;
  truthy?: boolean;
};

type Question = {
  id: string;
  key?: string;

  label: string;
  helpText?: string;
  type: QuestionType;

  // input fields
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  multiple?: boolean;
  accept?: string;
  htmlInputType?: string; // e.g. "text" | "email" | "number"

  // layout / content fields
  isLayoutOnly?: boolean;
  contentHtml?: string; // for text blocks
  imageUrl?: string; // for image blocks

  // grouping / logic
  sectionKey?: string;
  sectionTitle?: string;
  showIf?: VisibilityCond;
};

type Answers = Record<string, any>;

type ApiClinicForm = {
  _id: string;
  name?: string;
  description?: string;
  form_type?: string;
  is_active?: boolean;
  raf_status?: string;
  service_id?: string;
  service_slug?: string;
  schema?: any;
  raf_schema?: any;
};

const slugify = (s: string) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/* ---------------------- showIf normalisation ---------------------- */

function extractShowIf(input: any): VisibilityCond | undefined {
  const cand =
    input?.showIf ??
    input?.visibleIf ??
    input?.when ??
    input?.condition ??
    input?.dependency ??
    input?.dependsOn ??
    input?.data?.showIf ??
    input?.data?.visibleIf ??
    input?.data?.when ??
    input?.data?.condition;

  if (!cand || typeof cand !== "object") return undefined;

  // honour enabled flag
  if (
    cand.enabled === false ||
    cand.enabled === "false" ||
    cand.enabled === 0
  ) {
    return undefined;
  }

  const field =
    cand.field ??
    cand.id ??
    cand.key ??
    cand.question ??
    cand.source ??
    cand.on ??
    cand.dependsOn ??
    cand.dependency;

  if (!field || typeof field !== "string") return undefined;

  const equals = cand.equals ?? cand.equal ?? cand.value ?? cand.is;
  const inList = cand.in ?? cand.oneOf;
  const notEquals = cand.notEquals ?? cand.not;
  const truthy = cand.truthy ?? cand.whenTrue ?? undefined;

  const out: VisibilityCond = { field: String(field) };
  if (equals !== undefined) out.equals = equals;
  if (notEquals !== undefined) out.notEquals = notEquals;
  if (inList !== undefined) out.in = Array.isArray(inList) ? inList : [inList];
  if (truthy !== undefined) out.truthy = !!truthy;
  return out;
}

/* ---------------------- field-type mapping ------------------------ */

function mapFieldType(
  rawType: string,
  wantsMulti: boolean,
  input: any
): {
  mappedType: QuestionType;
  htmlInputType?: string;
  isLayoutOnly?: boolean;
  contentHtml?: string;
  imageUrl?: string;
} {
  const t = rawType.toLowerCase();
  let htmlInputType: string | undefined;
  let isLayoutOnly = false;
  let contentHtml: string | undefined;
  let imageUrl: string | undefined;

  let mapped: QuestionType;

  switch (t) {
    case "divider":
      mapped = "divider";
      isLayoutOnly = true;
      break;

    case "image":
      mapped = "image";
      isLayoutOnly = true;
      imageUrl =
        input?.data?.url ??
        input?.data?.src ??
        input?.data?.imageUrl ??
        input?.url ??
        "";
      break;

    case "text_block":
    case "text-block":
    case "content":
    case "html":
    case "richtext":
      mapped = "static-text";
      isLayoutOnly = true;
      contentHtml =
        input?.data?.content ??
        input?.data?.html ??
        input?.data?.text ??
        input?.content ??
        "";
      break;

    case "page_break":
    case "page-break":
    case "pagebreak":
      mapped = "page-break";
      isLayoutOnly = true;
      break;

    case "boolean":
    case "yesno":
      mapped = "boolean";
      break;

    case "textarea":
    case "text_area":
      mapped = "textarea";
      break;

    case "number":
    case "numeric":
      mapped = "number";
      htmlInputType = "number";
      break;

    case "date":
    case "datepicker":
      mapped = "date";
      htmlInputType = "date";
      break;

    case "multiselect":
    case "multi_select":
    case "checkboxes":
    case "checkbox":
    case "checkbox_group":
    case "checkbox-group":
      mapped = "multiselect";
      break;

    case "select":
    case "dropdown":
      mapped = wantsMulti ? "multiselect" : "select";
      break;

    case "radio":
      mapped = wantsMulti ? "multiselect" : "radio";
      break;

    case "file":
    case "file_upload":
    case "file-upload":
      mapped = "file";
      break;

    case "email":
      mapped = "text";
      htmlInputType = "email";
      break;

    case "signature":
      mapped = "text";
      htmlInputType = "text";
      break;

    default:
      mapped = "text";
      break;
  }

  // Extra hint from builder: data.inputType
  const dataInputType = input?.data?.inputType;
  if (
    mapped === "text" &&
    !htmlInputType &&
    typeof dataInputType === "string"
  ) {
    if (dataInputType === "email") htmlInputType = "email";
    else if (dataInputType === "number") htmlInputType = "number";
    else htmlInputType = dataInputType;
  }

  return {
    mappedType: mapped,
    htmlInputType,
    isLayoutOnly,
    contentHtml,
    imageUrl,
  };
}

/* -------------------- schema → Question[] ------------------------- */

function toQuestionArray(input: any): Question[] {
  if (!input) return [];

  if (typeof input === "string") {
    try {
      return toQuestionArray(JSON.parse(input));
    } catch {
      return [];
    }
  }

  // Case A: wrapper object { schema: [...] }
  if (!Array.isArray(input) && typeof input === "object") {
    const maybe =
      input.schema ??
      input.raf_schema ??
      input.questions ??
      input.fields ??
      input.form?.schema;
    return toQuestionArray(maybe);
  }

  // Case B: flat array (your current schema)
  if (Array.isArray(input)) {
    const items: Question[] = [];
    let curSectionKey: string | undefined;
    let curSectionTitle: string | undefined;

    input.forEach((x: any, i: number) => {
      if (!x || typeof x !== "object") return;

      const t = String(x.type ?? x.data?.type ?? "").toLowerCase();

      // Section element: grouping only, no actual question
      if (t === "section") {
        const title = String(x.label ?? x.data?.label ?? x.title ?? "Section");
        curSectionTitle = title;
        curSectionKey = String(x.key ?? x.data?.key ?? slugify(title));
        return;
      }

      const rawType = String(x.type ?? x.data?.type ?? "").toLowerCase();
      const wantsMulti = Boolean(x.multiple ?? x.data?.multiple);

      const { mappedType, htmlInputType, isLayoutOnly, contentHtml, imageUrl } =
        mapFieldType(rawType, wantsMulti, x);

      const options = Array.isArray(x.options)
        ? x.options.map((o: any) =>
            typeof o === "string"
              ? { value: o, label: o }
              : {
                  value: String(o.value ?? o.id ?? o),
                  label: String(o.label ?? o.name ?? o),
                }
          )
        : Array.isArray(x.data?.options)
        ? x.data.options.map((o: any) =>
            typeof o === "string"
              ? { value: o, label: o }
              : {
                  value: String(o.value ?? o.id ?? o),
                  label: String(o.label ?? o.name ?? o),
                }
          )
        : undefined;

      const label =
        x.label ??
        x.title ??
        x.name ??
        x.data?.label ??
        (mappedType === "static-text" ? "" : `Question ${i + 1}`);

      const id = String(x.id ?? x.key ?? x.data?.key ?? `q_${i}`);

      const sKey = String(x.section ?? x.data?.section ?? curSectionKey ?? "");
      const sTitle = String(
        x.sectionTitle ??
          x.data?.sectionTitle ??
          curSectionTitle ??
          (sKey ? "Section" : "")
      );

      items.push({
        id,
        key: x.key
          ? String(x.key)
          : x.data?.key
          ? String(x.data.key)
          : undefined,
        label: String(label),
        helpText: x.helpText ?? x.help ?? x.data?.help ?? undefined,
        type: mappedType,
        required: isLayoutOnly
          ? false
          : Boolean(x.required ?? x.data?.required),
        placeholder: x.placeholder ?? x.data?.placeholder ?? undefined,
        min: typeof x.min === "number" ? x.min : undefined,
        max: typeof x.max === "number" ? x.max : undefined,
        options,
        multiple: Boolean(x.multiple ?? x.data?.multiple),
        accept: String(x.accept ?? x.data?.accept ?? "image/*,application/pdf"),
        sectionKey: sKey || undefined,
        sectionTitle: sTitle || undefined,
        showIf: extractShowIf(x),
        htmlInputType,
        isLayoutOnly,
        contentHtml,
        imageUrl,
      });
    });

    return items;
  }

  return [];
}

/* ------------------ localStorage helpers -------------------------- */

const rafStorageKey = (slug: string) => `raf_answers.${slug}`;
const legacyRafStorageKey = (slug: string) => `raf.answers.${slug}`;
const rafSectionKey = (slug: string) => `raf_section.${slug}`;
const rafFormIdKey = (slug: string) => `raf_form_id.${slug}`;

function getCookie(name: string): string | undefined {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()!.split(";").shift();
  } catch {}
  return undefined;
}

function asNumber(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function stashSessionId(id: number) {
  try {
    localStorage.setItem("consultation_session_id", String(id));
    localStorage.setItem("pe_consultation_session_id", String(id));
    document.cookie = `pe_consultation_session_id=${id}; path=/; max-age=604800`;
  } catch {}
}

function getFirstSearchParamNumber(
  search: any,
  names: string[]
): number | undefined {
  try {
    for (const k of names) {
      const v = search?.get?.(k);
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {}
  return undefined;
}

function resolveInitialSessionId(search: any): number | undefined {
  try {
    const urlId = getFirstSearchParamNumber(search as any, ["session_id"]);
    if (urlId) {
      stashSessionId(urlId);
      return urlId;
    }

    const cookieId = asNumber(
      getCookie("consultation_session_id") ||
        getCookie("pe_consultation_session_id") ||
        getCookie("pe.consultation_session_id") ||
        getCookie("csid")
    );
    if (cookieId) return cookieId;

    const raw =
      (typeof window !== "undefined" &&
        (localStorage.getItem("consultation_session_id") ||
          localStorage.getItem("pe_consultation_session_id") ||
          localStorage.getItem("consultationSessionId") ||
          sessionStorage.getItem("consultation_session_id") ||
          sessionStorage.getItem("pe_consultation_session_id") ||
          sessionStorage.getItem("consultationSessionId"))) ||
      "";
    return asNumber(raw);
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Main RAF step component                                            */
/* ------------------------------------------------------------------ */

type UploadedFile = {
  name: string;
  size?: number;
  type?: string;
  path?: string;
  url?: string;
  uploading?: boolean;
};

export default function RafStep() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();

  const slug = params?.slug ?? "";
  const nextStep = search.get("next") || "calendar";
  const prevStep = search.get("prev") || "treatments";

  const serviceIdParam =
    search?.get("serviceId") || search?.get("service_id") || undefined;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [saveFlash, setSaveFlash] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | undefined>(() =>
    resolveInitialSessionId(search as any)
  );
  const [formMetaServiceId, setServiceId] = useState<string | null>(
    serviceIdParam ?? null
  );

  // keep URL session_id in sync if it changes later
  useEffect(() => {
    const urlId = getFirstSearchParamNumber(search as any, ["session_id"]);
    if (urlId && urlId !== sessionId) {
      stashSessionId(urlId);
      setSessionId(urlId);
    }
  }, [search, sessionId]);

  // Ensure a consultation session exists
  useEffect(() => {
    let cancelled = false;

    async function createIfMissing() {
      if (!slug || sessionId) return;
      try {
        const sid = await createConsultationSessionApi(slug);
        if (!cancelled && sid) {
          stashSessionId(sid);
          setSessionId(sid);
        }
      } catch {
        // soft-fail, user can still answer
      }
    }

    createIfMissing();
    return () => {
      cancelled = true;
    };
  }, [slug, sessionId]);

  // Load cached answers (and last_raf fallback) on mount
  useEffect(() => {
    try {
      if (!slug) return;

      const cached =
        localStorage.getItem(rafStorageKey(slug)) ||
        localStorage.getItem(legacyRafStorageKey(slug)) ||
        localStorage.getItem(`assessment.answers.${slug}`);

      if (cached) {
        setAnswers(JSON.parse(cached));
        return;
      }

      // Fallback: last_raf object { slug, sessionId, answers, ts }
      const lastRaw = localStorage.getItem("last_raf");
      if (lastRaw) {
        try {
          const parsed = JSON.parse(lastRaw);
          if (parsed?.slug === slug && parsed.answers) {
            setAnswers(parsed.answers);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }, [slug]);

  // Fetch RAF form + questions
  useEffect(() => {
    if (!slug) return;

    let done = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchRafFormForService(slug, serviceIdParam);
        if (!result) {
          setQuestions([]);
          return;
        }

        if (result.service_id) {
          setServiceId(result.service_id);
        }

        const list = toQuestionArray(result.schema);
        setQuestions(list);

        // store label map + form id in localStorage
        try {
          const labelMap: Record<string, { label: string; key: string }> = {};

          for (const q of list) {
            if (q.isLayoutOnly) continue; // ignore dividers, static text, etc.
            const fieldKey = q.id;
            labelMap[fieldKey] = {
              label: q.label,
              key: q.key ?? q.id,
            };
          }

          localStorage.setItem(`raf_labels.${slug}`, JSON.stringify(labelMap));

          const formMeta = {
            formId: result._id,
            serviceId: result.service_id ?? null,
            slug,
            name: result.name ?? null,
            description: result.description ?? null,
          };

          localStorage.setItem(`raf_form.${slug}`, JSON.stringify(formMeta));
          localStorage.setItem(rafFormIdKey(slug), String(result._id));
        } catch {
          // ignore storage errors
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load questions.");
        setQuestions([]);
      } finally {
        if (!done) setLoading(false);
      }
    }

    run();
    return () => {
      done = true;
    };
  }, [slug, serviceIdParam]);

  // Persist answers to localStorage + dispatch event
  useEffect(() => {
    try {
      if (!slug) return;
      const json = JSON.stringify(answers);
      localStorage.setItem(rafStorageKey(slug), json);
      localStorage.setItem(legacyRafStorageKey(slug), json);
      localStorage.setItem(`assessment.answers.${slug}`, json);

      window.dispatchEvent(
        new CustomEvent("raf:updated", {
          detail: {
            slug,
            sessionId,
            count: Object.keys(answers || {}).length,
          },
        })
      );
    } catch {
      // ignore
    }
  }, [slug, answers, sessionId]);

  /* -------------------- visibility & progress -------------------- */

  const idByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const q of questions) {
      if (q.key) m.set(q.key, q.id);
    }
    return m;
  }, [questions]);

  const getAnswerByField = (field: string) => {
    if (answers[field] !== undefined) return answers[field];
    const byKey = idByKey.get(field);
    return byKey ? answers[byKey] : undefined;
  };

  // loose comparison for showIf
  const looseEqual = (a: any, b: any): boolean => {
    const norm = (v: any) => {
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (["yes", "true", "y", "1"].includes(s)) return true;
        if (["no", "false", "n", "0"].includes(s)) return false;
        return s;
      }
      if (typeof v === "boolean") return v;
      return v;
    };

    const va = norm(a);
    const vb = norm(b);

    if (typeof va === "boolean" || typeof vb === "boolean") {
      return Boolean(va) === Boolean(vb);
    }

    return va === vb;
  };

  const isVisible = (q: Question): boolean => {
    const c = q.showIf;
    if (!c) return true;

    const rawVal = getAnswerByField(c.field);

    // truthy condition
    if (c.truthy) {
      if (Array.isArray(rawVal)) return rawVal.length > 0;
      return !!rawVal;
    }

    const values: any[] = Array.isArray(rawVal) ? rawVal : [rawVal];

    if (c.in && c.in.length > 0) {
      return values.some((v) => c.in!.some((item) => looseEqual(v, item)));
    }

    if (c.equals !== undefined) {
      return values.some((v) => looseEqual(v, c.equals));
    }

    if (c.notEquals !== undefined) {
      return !values.some((v) => looseEqual(v, c.notEquals));
    }

    if (Array.isArray(rawVal)) return rawVal.length > 0;
    return !!rawVal;
  };

  const visibleQuestions = useMemo(
    () => questions.filter((q) => isVisible(q)),
    [questions, answers]
  );

  const SECTION_NONE = "__default__";

  const sections = useMemo(() => {
    const order: string[] = [];
    const meta = new Map<string, { title: string }>();
    for (const q of visibleQuestions) {
      const key = q.sectionKey ?? SECTION_NONE;
      if (!meta.has(key)) {
        meta.set(key, {
          title:
            q.sectionTitle ?? (key === SECTION_NONE ? "General" : "Section"),
        });
        order.push(key);
      }
    }
    return { order, meta };
  }, [visibleQuestions]);

  const [sectionIdx, setSectionIdx] = useState(0);

  // Restore section index from storage
  useEffect(() => {
    if (!slug) return;
    try {
      const raw = localStorage.getItem(rafSectionKey(slug));
      if (!raw) return;
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) {
        setSectionIdx(n);
      }
    } catch {
      // ignore
    }
  }, [slug]);

  // Keep section index within bounds
  useEffect(() => {
    if (sectionIdx >= sections.order.length) {
      setSectionIdx(0);
    }
  }, [sections.order.length, sectionIdx]);

  // Persist section index
  useEffect(() => {
    if (!slug) return;
    try {
      localStorage.setItem(rafSectionKey(slug), String(sectionIdx));
    } catch {
      // ignore
    }
  }, [slug, sectionIdx]);

  const currentSectionKey = sections.order[sectionIdx] ?? SECTION_NONE;
  const currentSectionTitle =
    sections.meta.get(currentSectionKey)?.title ??
    (currentSectionKey === SECTION_NONE ? "General" : "Section");

  const questionsInSection = useMemo(
    () =>
      visibleQuestions.filter(
        (q) => (q.sectionKey ?? SECTION_NONE) === currentSectionKey
      ),
    [visibleQuestions, currentSectionKey]
  );

  const isEmptyAnswer = (v: any) =>
    v === undefined ||
    v === null ||
    v === "" ||
    (Array.isArray(v) && v.length === 0);

  const requiredUnanswered = useMemo(
    () =>
      visibleQuestions.filter(
        (q) => q.required && !q.isLayoutOnly && isEmptyAnswer(answers[q.id])
      ),
    [visibleQuestions, answers]
  );

  const requiredUnansweredInSection = useMemo(
    () =>
      questionsInSection.filter(
        (q) => q.required && !q.isLayoutOnly && isEmptyAnswer(answers[q.id])
      ),
    [questionsInSection, answers]
  );

  const totalRequired = useMemo(
    () => visibleQuestions.filter((q) => q.required && !q.isLayoutOnly).length,
    [visibleQuestions]
  );

  const hasUploadingFiles = useMemo(
    () =>
      questions.some((q) => {
        if (q.type !== "file") return false;
        const val = answers[q.id];
        if (!Array.isArray(val)) return false;
        return val.some((f: any) => f && f.uploading);
      }),
    [questions, answers]
  );
  const remainingRequired = requiredUnanswered.length;
  const answeredRequired = Math.max(totalRequired - remainingRequired, 0);
  const percentComplete = totalRequired
    ? Math.round((answeredRequired / totalRequired) * 100)
    : 100;
  const showProgressBar = !error && totalRequired > 0;

  /* ------------------------ local actions ------------------------- */

  const onChange = (id: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const clearAnswers = () => {
    try {
      localStorage.removeItem(rafStorageKey(slug));
      localStorage.removeItem(legacyRafStorageKey(slug));
      localStorage.removeItem(`assessment.answers.${slug}`);
      localStorage.removeItem("last_raf");
    } catch {}
    setAnswers({});
  };

  const onBack = () => {
    router.push(
      `/private-services/${encodeURIComponent(
        slug
      )}/book?step=${encodeURIComponent(prevStep)}`
    );
  };

  const scrollToQuestion = (qid: string) => {
    try {
      const el = document.getElementById(`q-${qid}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-rose-400");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-rose-400");
      }, 1600);
    } catch {
      // ignore
    }
  };

  const onSubmit = async () => {
    setError(null);

    if (hasUploadingFiles) {
      setError(
        "Please wait for all files to finish uploading before continuing."
      );
      setSaveFlash(null);
      return;
    }

    // Block moving to next step if any required is unanswered
    if (requiredUnanswered.length > 0) {
      const firstMissing = requiredUnanswered[0];
      setError("Please answer all required questions before continuing.");
      scrollToQuestion(firstMissing.id);
      setSaveFlash(null);
      return;
    }

    setSubmitting(true);
    setSaveFlash("Saving…");

    // answers already contain file URLs / paths
    const answersToSend: Answers = { ...answers };
    const sid = sessionId != null ? Number(sessionId) : undefined;

    try {
      if (sid && Number.isFinite(sid) && sid > 0) {
        await saveRafAnswersApi(sid, slug, answersToSend);
      }

      try {
        localStorage.setItem(
          "last_raf",
          JSON.stringify({
            slug,
            sessionId: sid,
            answers: answersToSend,
            ts: Date.now(),
          })
        );
      } catch {
        // ignore
      }

      setSaveFlash("Saved");
      setTimeout(() => setSaveFlash(null), 1500);

      const qp = new URLSearchParams();
      qp.set("step", nextStep);
      if (sid && Number.isFinite(sid) && sid > 0) {
        qp.set("session_id", String(sid));
        try {
          document.cookie = `pe_consultation_session_id=${sid}; path=/; max-age=604800`;
        } catch {
          // ignore
        }
      }

      router.push(
        `/private-services/${encodeURIComponent(slug)}/book?${qp.toString()}`
      );
    } catch (e: any) {
      setError(e?.message || "Failed to save answers.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /* UI                                                               */
  /* ---------------------------------------------------------------- */

  return (
    <>
      {showProgressBar && (
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-medium text-slate-800">
                  Medical questions progress
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                  {remainingRequired} required left
                </span>
              </div>
              <div
                className="mt-2 h-2 rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={percentComplete}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={clearAnswers}
              className="hidden rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Clear answers
            </button>
          </div>
          {saveFlash && (
            <div className="pb-2 text-center text-[11px] text-slate-600">
              {saveFlash}
            </div>
          )}
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 pb-10 pt-6">
        {/* Top bar: back + title */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to treatments
          </button>

          {sections.order.length > 1 && (
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Section {sectionIdx + 1} of {sections.order.length} •{" "}
              {currentSectionTitle}
            </div>
          )}
        </div>

        {/* Main card */}
        <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-soft-card sm:p-6 md:p-8">
          <header className="mb-6 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Medical questions
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
              Risk assessment
            </h1>
            <p className="text-sm text-slate-600">
              Please answer these questions so our clinicians can safely assess
              your suitability for this treatment.
            </p>
          </header>

          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
              <div className="space-y-3 animate-pulse">
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="h-4 w-1/2 rounded bg-slate-200" />
                <div className="h-4 w-5/6 rounded bg-slate-200" />
                <div className="h-4 w-1/3 rounded bg-slate-200" />
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {!loading && !error && questions.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-600">
              There are no medical questions configured for this service yet.
              You can continue to the next step.
            </div>
          )}

          {!loading && questionsInSection.length > 0 && (
            <>
              {/* Section header in card */}
              {sections.order.length > 1 && (
                <div className="mb-4 flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                      {sectionIdx + 1}
                    </span>
                    <span>{currentSectionTitle}</span>
                  </div>
                </div>
              )}

              <div className="space-y-5">
                {questionsInSection.map((q) => (
                  <QuestionField
                    key={q.id}
                    q={q}
                    value={answers[q.id]}
                    onChange={(v) => onChange(q.id, v)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Footer inside card */}
          <footer className="mt-8 flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>
                {answeredRequired} of {totalRequired || 0} required questions
                completed
              </span>
              {requiredUnansweredInSection.length > 0 && (
                <span className="text-[11px] text-amber-600">
                  • {requiredUnansweredInSection.length} required in this
                  section remaining
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSectionIdx((i) => Math.max(0, i - 1))}
                  disabled={sectionIdx === 0}
                  className="rounded-full border  border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous section
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSectionIdx((i) =>
                      Math.min(sections.order.length - 1, i + 1)
                    )
                  }
                  disabled={
                    sectionIdx >= sections.order.length - 1 ||
                    requiredUnansweredInSection.length > 0
                  }
                  title={
                    sectionIdx >= sections.order.length - 1
                      ? undefined
                      : requiredUnansweredInSection.length > 0
                      ? "Answer all required questions in this section first"
                      : undefined
                  }
                  className="rounded-full border bg-emerald-500 border-slate-200 px-3 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next section
                </button>
              </div>
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting || hasUploadingFiles}
                className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold text-white shadow-sm ${
                  submitting || hasUploadingFiles
                    ? "bg-emerald-300 cursor-not-allowed opacity-80"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {submitting ? "Saving…" : "Save & continue"}
              </button>
            </div>
          </footer>
        </section>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Question field renderer                                            */
/* ------------------------------------------------------------------ */

function QuestionField({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: any;
  onChange: (v: any) => void;
}) {
  const base =
    "block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white";

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /* ----- Layout-only elements (no answer) ----- */

  if (q.type === "divider") {
    return (
      <div id={`q-${q.id}`} className="py-3">
        <div className="border-t border-dashed border-slate-300" />
      </div>
    );
  }

  if (q.type === "static-text") {
    return (
      <div
        id={`q-${q.id}`}
        className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
      >
        {q.label && (
          <p className="mb-1 text-sm font-semibold text-slate-900">{q.label}</p>
        )}
        {q.contentHtml ? (
          <div
            className="prose prose-sm max-w-none text-slate-700"
            dangerouslySetInnerHTML={{ __html: q.contentHtml }}
          />
        ) : q.helpText ? (
          <p className="text-xs text-slate-600">{q.helpText}</p>
        ) : null}
      </div>
    );
  }

  if (q.type === "image") {
    const src = q.imageUrl || "";
    return (
      <div
        id={`q-${q.id}`}
        className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
      >
        {q.label && (
          <p className="mb-2 text-sm font-medium text-slate-900">{q.label}</p>
        )}
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={q.label || "Image"}
            className="max-h-64 w-auto rounded-xl border border-slate-200 bg-white object-contain"
          />
        ) : (
          <p className="text-xs text-slate-500">
            No image configured yet. You can add one in the form builder.
          </p>
        )}
        {q.helpText && (
          <p className="mt-2 text-[11px] text-slate-500">{q.helpText}</p>
        )}
      </div>
    );
  }

  if (q.type === "page-break") {
    return (
      <div id={`q-${q.id}`} className="py-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
          <span className="flex-1 border-t border-dashed border-slate-300" />
          <span>Page break</span>
          <span className="flex-1 border-t border-dashed border-slate-300" />
        </div>
      </div>
    );
  }

  /* ----- Answerable elements ----- */

  return (
    <div
      id={`q-${q.id}`}
      className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
    >
      <label className="mb-1 block text-sm font-medium text-slate-900">
        {q.label} {q.required && <span className="text-rose-600">*</span>}
      </label>
      {q.helpText && (
        <p className="mb-2 text-xs text-slate-600">{q.helpText}</p>
      )}

      {q.type === "text" && (
        <input
          type={q.htmlInputType || "text"}
          className={base}
          placeholder={q.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {q.type === "textarea" && (
        <textarea
          className={base}
          placeholder={q.placeholder}
          rows={4}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {q.type === "number" && (
        <input
          type="number"
          className={base}
          placeholder={q.placeholder}
          min={q.min}
          max={q.max}
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
        />
      )}

      {q.type === "boolean" && (
        <div className="inline-flex gap-2 rounded-full bg-slate-100 p-1 text-xs">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`rounded-full px-3 py-1 font-medium ${
              value === true ? "bg-emerald-600 text-white" : "text-slate-700"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`rounded-full px-3 py-1 font-medium ${
              value === false ? "bg-emerald-600 text-white" : "text-slate-700"
            }`}
          >
            No
          </button>
        </div>
      )}

      {q.type === "select" && (
        <select
          className={base}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            {q.placeholder || "Please select"}
          </option>
          {(q.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {q.type === "radio" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.options || []).map((opt) => {
            const checked = value === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items_center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  checked
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  className="h-4 w-4 border-slate-300 text-emerald-600"
                  checked={checked}
                  onChange={() => onChange(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {q.type === "multiselect" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.options || []).map((opt) => {
            const arr: string[] = Array.isArray(value) ? value : [];
            const checked = arr.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  checked
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  checked={checked}
                  onChange={(e) => {
                    const next = new Set(arr);
                    if (e.target.checked) next.add(opt.value);
                    else next.delete(opt.value);
                    onChange(Array.from(next));
                  }}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {q.type === "date" && (
        <input
          type="date"
          className={base}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {q.type === "file" && (
        <div className="space-y-2">
          <input
            type="file"
            id={`input-${q.id}`}
            accept={q.accept ?? "image/*,application/pdf"}
            multiple={!!q.multiple}
            className="mt-1 block w-full text-xs file:mr-3 file:rounded-xl file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
            onChange={async (e) => {
              setUploadError(null);
              const list = Array.from(e.target.files || []);
              if (!list.length) {
                onChange([]);
                return;
              }

              const max = 10 * 1024 * 1024; // 10MB
              const kept = list.filter((f) => f.size <= max);

              if (!kept.length) {
                setUploadError("Each file must be 10MB or smaller.");
                onChange([]);
                return;
              }

              // Optimistic local state: mark as uploading
              onChange(
                kept.map<UploadedFile>((f) => ({
                  name: f.name,
                  size: f.size,
                  type: f.type || "file",
                  uploading: true,
                }))
              );

              setUploading(true);
              try {
                const uploaded: UploadedFile[] = [];

                for (const f of kept) {
                  try {
                    // Use your page image upload API instead of the old RAF upload
                    const res: any = await uploadPageImageApi(f);

                    // Try to be flexible with response shape
                    const url = res?.url ?? res?.data?.url ?? res?.location; // add any other key you use
                    const path = res?.path ?? res?.data?.path ?? res?.key; // add any other key you use

                    if (url) {
                      uploaded.push({
                        name: f.name,
                        size: f.size,
                        type: f.type || "file",
                        path,
                        url,
                      });
                    } else {
                      setUploadError(
                        res?.message ||
                          "A file failed to upload. Please try again."
                      );
                    }
                  } catch {
                    setUploadError(
                      "A file failed to upload due to a network error. Please try again."
                    );
                  }
                }

                if (uploaded.length) {
                  // Final value: includes backend URL / path
                  onChange(uploaded);
                } else {
                  // All failed – clear value
                  onChange([]);
                }
              } finally {
                setUploading(false);
              }
            }}
          />

          {Array.isArray(value) && value.length > 0 && (
            <ul className="text-xs text-slate-600">
              {value.map((f: any, i: number) => (
                <li key={i}>
                  {f.name}{" "}
                  {typeof f.size === "number"
                    ? `(${Math.round(f.size / 1024)} KB)`
                    : ""}
                  {f.url ? " – uploaded" : f.uploading ? " – uploading…" : ""}
                </li>
              ))}
            </ul>
          )}

          {uploading && (
            <p className="text-[11px] text-slate-500">
              Uploading file(s)… please wait.
            </p>
          )}

          {uploadError && (
            <p className="text-[11px] text-rose-500">{uploadError}</p>
          )}

          {!q.helpText && (
            <p className="text-[11px] text-slate-500">
              Max 10MB. PDF or image files.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
