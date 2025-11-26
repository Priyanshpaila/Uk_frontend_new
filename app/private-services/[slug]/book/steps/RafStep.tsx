"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";

/**
 * RAF (Risk Assessment Form) Step
 *
 * Now uses:
 *  1) GET  `${apiBase}/api/clinic-forms`
 *     - Find the clinic form matching current service by `service_slug` or `service_id` (query param).
 *     - Prefer `form_type === "raf"` + `is_active !== false`.
 *  2) GET  `${apiBase}/api/clinic-forms/{formId}`
 *     - Load full form (schema / raf_schema) and map into dynamic Questions.
 *
 * Answer submission still uses the existing consultation endpoints as before.
 */

type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "date"
  | "file";

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
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  multiple?: boolean;
  accept?: string;
  sectionKey?: string;
  sectionTitle?: string;
  showIf?: VisibilityCond; // conditionally visible based on another answer
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

function getAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  try {
    const t =
      (typeof window !== "undefined"
        ? localStorage.getItem("token") ||
          localStorage.getItem("auth_token") ||
          ""
        : "") || "";
    if (t) h.Authorization = `Bearer ${t}`;
  } catch {}
  return h;
}

function getCookie(name: string): string | undefined {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()!.split(";").shift();
  } catch {}
  return undefined;
}

async function ensureCsrfCookie(base: string) {
  try {
    await fetch(`${base}/sanctum/csrf-cookie`, { credentials: "include" });
  } catch {}
}

// Extract conditional visibility from common shapes like showIf, visibleIf, when, condition
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

const slugify = (s: string) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function asNumber(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
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

// --- Helpers to normalise different schema shapes into our Question[] ---
function toQuestionArray(input: any): Question[] {
  if (!input) return [];

  // If the backend stored JSON as a string, parse and recurse.
  if (typeof input === "string") {
    try {
      return toQuestionArray(JSON.parse(input));
    } catch {
      return [];
    }
  }

  // Case A: Array of sections with `fields`
  if (
    Array.isArray(input) &&
    input.every((sec) => Array.isArray((sec as any)?.fields))
  ) {
    const out: Question[] = [];
    for (const sec of input as any[]) {
      const secTitle = String(
        (sec as any)?.label ??
          (sec as any)?.title ??
          (sec as any)?.name ??
          "Section"
      );
      const secKey = String(
        (sec as any)?.key ??
          (sec as any)?.data?.key ??
          slugify(secTitle)
      );
      for (const f of sec.fields || []) {
        if (!f) continue;
        const rawType = String(f.type || "").toLowerCase();

        const mappedType: QuestionType =
          rawType === "radio"
            ? "select"
            : rawType === "multiselect" ||
              rawType === "multi_select" ||
              rawType === "checkboxes"
            ? "multiselect"
            : rawType === "textarea" || rawType === "text_area"
            ? "textarea"
            : rawType === "date" || rawType === "datepicker"
            ? "date"
            : rawType === "number" || rawType === "numeric"
            ? "number"
            : rawType === "boolean" || rawType === "yesno"
            ? "boolean"
            : rawType === "file" || rawType === "file_upload"
            ? "file"
            : "text";

        const opts = Array.isArray(f.options)
          ? f.options.map((o: any) =>
              typeof o === "string"
                ? { value: o, label: o }
                : {
                    value: String(o.value ?? o.id ?? o),
                    label: String(o.label ?? o.name ?? o),
                  }
            )
          : Array.isArray(f.data?.options)
          ? f.data.options.map((o: any) =>
              typeof o === "string"
                ? { value: o, label: o }
                : {
                    value: String(o.value ?? o.id ?? o),
                    label: String(o.label ?? o.name ?? o),
                  }
            )
          : undefined;

        out.push({
          id: String(f.id ?? f.key ?? `q_${out.length}`),
          key: f.key ? String(f.key) : undefined,
          label: String(
            f.label ??
              f.title ??
              f.name ??
              f.data?.label ??
              "Question"
          ),
          helpText: f.helpText ?? f.help ?? f.data?.help ?? undefined,
          type: mappedType,
          required: Boolean(f.required ?? f.data?.required),
          placeholder: f.placeholder ?? f.data?.placeholder ?? undefined,
          min: typeof f.min === "number" ? f.min : undefined,
          max: typeof f.max === "number" ? f.max : undefined,
          options: opts,
          multiple: Boolean(f.multiple ?? f.data?.multiple),
          accept: String(
            f.accept ?? f.data?.accept ?? "image/*,application/pdf"
          ),
          sectionKey: secKey,
          sectionTitle: secTitle,
          showIf: extractShowIf(f),
        });
      }
    }
    return out;
  }

  // Case B: Generic array of question-like items
  if (Array.isArray(input)) {
    const items: Question[] = [];
    let curSectionKey: string | undefined;
    let curSectionTitle: string | undefined;
    input.forEach((x: any, i: number) => {
      if (!x || typeof x !== "object") return;

      // Capture explicit section header blocks and advance context
      const t = String(x.type ?? x.data?.type ?? "").toLowerCase();
      if (t === "section") {
        const title = String(
          x.label ?? x.data?.label ?? x.title ?? "Section"
        );
        curSectionTitle = title;
        curSectionKey = String(
          x.key ?? x.data?.key ?? slugify(title)
        );
        return; // do not push a question for a section header
      }

      // Allow nested section objects inside mixed arrays
      if (Array.isArray(x.fields)) {
        items.push(...toQuestionArray([x]));
        return;
      }

      const rawType = String(
        x.type ?? x.data?.type ?? ""
      ).toLowerCase();
      const wantsMulti = Boolean(x.multiple ?? x.data?.multiple);

      const mappedType: QuestionType =
        rawType === "boolean" || rawType === "yesno"
          ? "boolean"
          : rawType === "textarea" || rawType === "text_area"
          ? "textarea"
          : rawType === "number" || rawType === "numeric"
          ? "number"
          : rawType === "date" || rawType === "datepicker"
          ? "date"
          : rawType === "multiselect" ||
            rawType === "multi_select" ||
            rawType === "checkboxes"
          ? "multiselect"
          : rawType === "select" ||
            rawType === "dropdown" ||
            rawType === "radio"
          ? wantsMulti
            ? "multiselect"
            : "select"
          : rawType === "file" || rawType === "file_upload"
          ? "file"
          : "text";

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
        `Question ${i + 1}`;
      const id = String(
        x.id ?? x.key ?? x.data?.key ?? `q_${i}`
      );

      // Section assignment for this question
      const sKey = String(
        x.section ?? x.data?.section ?? curSectionKey ?? ""
      );
      const sTitle = String(
        x.sectionTitle ??
          x.data?.sectionTitle ??
          curSectionTitle ??
          (sKey ? "Section" : "")
      );

      items.push({
        id,
        key: x.key ? String(x.key) : undefined,
        label: String(label),
        helpText: x.helpText ?? x.help ?? x.data?.help ?? undefined,
        type: mappedType,
        required: Boolean(x.required ?? x.data?.required),
        placeholder: x.placeholder ?? x.data?.placeholder ?? undefined,
        min: typeof x.min === "number" ? x.min : undefined,
        max: typeof x.max === "number" ? x.max : undefined,
        options,
        multiple: Boolean(x.multiple ?? x.data?.multiple),
        accept: String(
          x.accept ?? x.data?.accept ?? "image/*,application/pdf"
        ),
        sectionKey: sKey || undefined,
        sectionTitle: sTitle || undefined,
        showIf: extractShowIf(x),
      });
    });
    return items;
  }

  // Case C: Object wrapper with `.schema` or similar
  if (typeof input === "object") {
    const maybe =
      input.schema ??
      input.questions ??
      input.fields ??
      input.form?.schema;
    return toQuestionArray(maybe);
  }

  return [];
}

const rafStorageKey = (slug: string) => `raf_answers.${slug}`;
const legacyRafStorageKey = (slug: string) => `raf.answers.${slug}`;

function stashSessionId(id: number) {
  try {
    localStorage.setItem("consultation_session_id", String(id));
    localStorage.setItem("pe_consultation_session_id", String(id));
    document.cookie = `pe_consultation_session_id=${id}; path=/; max-age=604800`;
  } catch {}
}

function resolveInitialSessionId(search: any): number | undefined {
  try {
    const urlId = getFirstSearchParamNumber(search as any, [
      "session_id",
    ]);
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
    const ls = asNumber(raw);
    return ls;
  } catch {
    return undefined;
  }
}

export default function RafStep() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();

  const slug = params?.slug ?? "";
  const nextStep = search.get("next") || "calendar"; // default after RAF
  const prevStep = search.get("prev") || "treatments"; // default back

  // Root API base, without /api
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") ||
    "http://localhost:8000";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [saveFlash, setSaveFlash] = useState<string | null>(null);
  // Keep real File objects here so we can upload them before posting answers
  const [fileStash, setFileStash] = useState<Record<string, File[]>>({});

  const [sessionId, setSessionId] = useState<number | undefined>(() =>
    resolveInitialSessionId(search as any)
  );

  useEffect(() => {
    const urlId = getFirstSearchParamNumber(search as any, [
      "session_id",
    ]);
    if (urlId && urlId !== sessionId) {
      stashSessionId(urlId);
      setSessionId(urlId);
    }
  }, [search, sessionId]);

  useEffect(() => {
    let aborted = false;
    async function createIfMissing() {
      if (!slug || sessionId) return;
      try {
        const res = await fetch(
          `${apiBase}/api/consultations/sessions`,
          {
            method: "POST",
            headers: {
              ...getAuthHeaders(),
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            credentials: "omit",
            body: JSON.stringify({ service_slug: slug }),
          }
        );
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const sid = Number(data?.session_id || data?.id);
        if (!aborted && Number.isFinite(sid) && sid > 0) {
          stashSessionId(sid);
          setSessionId(sid);
        }
      } catch {}
    }
    createIfMissing();
    return () => {
      aborted = true;
    };
  }, [slug, apiBase, sessionId]);

  useEffect(() => {
    if (search.get("debug") !== "1") return;
    try {
      const fromUrl = getFirstSearchParamNumber(search as any, [
        "session_id",
      ]);
      const cookies = {
        consultation_session_id: getCookie("consultation_session_id"),
        pe_consultation_session_id: getCookie(
          "pe_consultation_session_id"
        ),
        pe_dot_consultation_session_id: getCookie(
          "pe.consultation_session_id"
        ),
        csid: getCookie("csid"),
      } as const;
      const storage = {
        ls_consultation_session_id:
          typeof window !== "undefined"
            ? localStorage.getItem("consultation_session_id")
            : null,
        ls_pe_consultation_session_id:
          typeof window !== "undefined"
            ? localStorage.getItem("pe_consultation_session_id")
            : null,
        ls_consultationSessionId:
          typeof window !== "undefined"
            ? localStorage.getItem("consultationSessionId")
            : null,
        ss_consultation_session_id:
          typeof window !== "undefined"
            ? sessionStorage.getItem("consultation_session_id")
            : null,
        ss_pe_consultation_session_id:
          typeof window !== "undefined"
            ? sessionStorage.getItem("pe_consultation_session_id")
            : null,
        ss_consultationSessionId:
          typeof window !== "undefined"
            ? sessionStorage.getItem("consultationSessionId")
            : null,
      } as const;
      console.log("[raf] session snapshot", {
        sessionId,
        fromUrl,
        cookies,
        storage,
      });
    } catch {}
  }, [sessionId, search]);

  // Load cached answers from localStorage (with legacy fallback)
  useEffect(() => {
    try {
      if (!slug) return;
      const cached =
        localStorage.getItem(rafStorageKey(slug)) ||
        localStorage.getItem(legacyRafStorageKey(slug)) ||
        localStorage.getItem(`assessment.answers.${slug}`);
      if (cached) {
        setAnswers(JSON.parse(cached));
      }
    } catch {
      // ignore
    }
  }, [slug]);

  // 🔹 Fetch RAF questions via clinic-forms
  useEffect(() => {
    let done = false;
    async function run() {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        // 1) Get list of clinic forms
        const listRes = await fetch(
          `${apiBase}/api/clinic-forms`,
          {
            credentials: "omit",
            headers: {
              ...getAuthHeaders(),
              Accept: "application/json",
            },
          }
        );

        if (!listRes.ok) {
          const text = await listRes.text().catch(() => "");
          throw new Error(
            text
              ? `Failed to load clinic forms (${listRes.status}): ${text.slice(
                  0,
                  180
                )}`
              : `Failed to load clinic forms (${listRes.status})`
          );
        }

        let listPayload: any = null;
        try {
          listPayload = await listRes.json();
        } catch {
          listPayload = null;
        }

        const forms: ApiClinicForm[] = Array.isArray(listPayload?.data)
          ? listPayload.data
          : Array.isArray(listPayload)
          ? listPayload
          : [];

        const serviceIdParam =
          search?.get("serviceId") ||
          search?.get("service_id") ||
          undefined;

        const candidates = forms.filter((f) => {
          const matchesSlug =
            f.service_slug &&
            String(f.service_slug) === String(slug);
          const matchesId =
            serviceIdParam &&
            f.service_id &&
            String(f.service_id) === String(serviceIdParam);
          const isRaf =
            (f.form_type || "").toLowerCase() === "raf";
          const isActive = f.is_active !== false;
          return (matchesSlug || matchesId) && isRaf && isActive;
        });

        const form = candidates[0] || null;

        if (!form?._id) {
          // No matching form: not a hard error, just no questions
          setQuestions([]);
          return;
        }

        // 2) Load the concrete form by ID
        const detailRes = await fetch(
          `${apiBase}/api/clinic-forms/${encodeURIComponent(
            form._id
          )}`,
          {
            credentials: "omit",
            headers: {
              ...getAuthHeaders(),
              Accept: "application/json",
            },
          }
        );

        if (!detailRes.ok) {
          const text = await detailRes.text().catch(() => "");
          throw new Error(
            text
              ? `Failed to load form (${detailRes.status}): ${text.slice(
                  0,
                  180
                )}`
              : `Failed to load form (${detailRes.status})`
          );
        }

        let detailPayload: any = null;
        try {
          detailPayload = await detailRes.json();
        } catch {
          detailPayload = null;
        }

        // Your sample object matches this shape
        const rawSchema =
          detailPayload?.schema ??
          detailPayload?.raf_schema ??
          detailPayload?.questions ??
          null;

        const list = toQuestionArray(rawSchema);
        setQuestions(list);
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
  }, [apiBase, slug, search]);

  // Persist answers to localStorage (with legacy and assessment keys, and event)
  useEffect(() => {
    try {
      if (!slug) return;
      const json = JSON.stringify(answers);
      localStorage.setItem(rafStorageKey(slug), json);
      localStorage.setItem(legacyRafStorageKey(slug), json);
      localStorage.setItem(`assessment.answers.${slug}`, json);
      try {
        window.dispatchEvent(
          new CustomEvent("raf:updated", {
            detail: {
              slug,
              sessionId,
              count: Object.keys(answers || {}).length,
            },
          })
        );
        // Debug logging if ?debug=1
        if (search.get("debug") === "1") {
          try {
            console.log("[raf] updated", {
              count: Object.keys(answers || {}).length,
              answers,
            });
          } catch {}
        }
      } catch {}
    } catch {
      // ignore
    }
  }, [slug, answers, sessionId, search]);

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

  const normalize = (v: any) => {
    if (v === null || v === undefined) return v;
    if (typeof v === "string") return v.trim().toLowerCase();
    if (typeof v === "boolean" || typeof v === "number") return v;
    if (typeof v === "object" && "value" in v)
      return normalize((v as any).value);
    return v;
  };

  const isVisible = (q: Question): boolean => {
    const c = q.showIf;
    if (!c) return true;
    const val = getAnswerByField(c.field);
    if (c.truthy) return !!val;
    if (c.in) return c.in.map(normalize).includes(normalize(val));
    if (c.equals !== undefined) {
      const eq = normalize(c.equals);
      let v = normalize(val);
      // handle common yes strings
      if (eq === "yes")
        return v === true || v === "yes" || v === "y" || v === "true";
      if (eq === "no")
        return v === false || v === "no" || v === "n" || v === "false";
      return v === eq;
    }
    if (c.notEquals !== undefined)
      return normalize(val) !== normalize(c.notEquals);
    return !!val;
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
            q.sectionTitle ??
            (key === SECTION_NONE ? "General" : "Section"),
        });
        order.push(key);
      }
    }
    return { order, meta };
  }, [visibleQuestions]);

  const [sectionIdx, setSectionIdx] = useState(0);

  useEffect(() => {
    if (sectionIdx >= sections.order.length) setSectionIdx(0);
  }, [sections.order.length, sectionIdx]);

  const currentSectionKey =
    sections.order[sectionIdx] ?? SECTION_NONE;
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

  const requiredUnansweredInSection = useMemo(
    () =>
      questionsInSection.filter(
        (q) =>
          q.required &&
          (answers[q.id] === undefined ||
            answers[q.id] === null ||
            answers[q.id] === "" ||
            (Array.isArray(answers[q.id]) &&
              answers[q.id].length === 0))
      ),
    [questionsInSection, answers]
  );

  const isEmptyAnswer = (v: any) =>
    v === undefined ||
    v === null ||
    v === "" ||
    (Array.isArray(v) && v.length === 0);

  const requiredUnanswered = useMemo(
    () =>
      visibleQuestions.filter(
        (q) => q.required && isEmptyAnswer(answers[q.id])
      ),
    [visibleQuestions, answers]
  );

  const totalRequired = useMemo(
    () => visibleQuestions.filter((q) => q.required).length,
    [visibleQuestions]
  );
  const remainingRequired = useMemo(
    () => requiredUnanswered.length,
    [requiredUnanswered]
  );
  const answeredRequired = useMemo(
    () => Math.max(totalRequired - remainingRequired, 0),
    [totalRequired, remainingRequired]
  );
  const percentComplete = useMemo(
    () =>
      totalRequired
        ? Math.round((answeredRequired / totalRequired) * 100)
        : 100,
    [answeredRequired, totalRequired]
  );
  const showProgressBar = !error && totalRequired > 0;

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

  type UploadedFile = {
    name: string;
    size?: number;
    type?: string;
    path?: string;
    url?: string;
  };

  // Bearer token resolver (no cookies)
  function getBearerToken(): string {
    try {
      const envTok = (process.env.NEXT_PUBLIC_API_TOKEN || "").trim();
      if (envTok) return envTok;
      if (typeof window !== "undefined") {
        const userTok =
          localStorage.getItem("token") ||
          localStorage.getItem("auth_token") ||
          "";
        if (userTok) return userTok;
      }
    } catch {}
    return "";
  }

  // Stateless intake image uploader
  async function uploadIntakeImage(
    apiBase: string,
    file: File,
    kind: string = "raf"
  ): Promise<{
    ok: boolean;
    url?: string;
    path?: string;
    message?: string;
  }> {
    try {
      const token = getBearerToken();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);

      const res = await fetch(
        `${apiBase}/api/uploads/intake-image`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd, // browser sets multipart boundary
          credentials: "omit", // IMPORTANT: never send cookies
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok !== true) {
        return {
          ok: false,
          message:
            data?.message ||
            `Upload failed (${res.status})`,
        };
      }
      return { ok: true, url: data.url, path: data.path };
    } catch (e: any) {
      return {
        ok: false,
        message: e?.message || "Network error",
      };
    }
  }

  function normalizeUploadResponse(json: any): UploadedFile[] {
    if (!json) return [];
    // Common shapes:
    // { files: [...] }, { data: [...] }, [...], { name, path, url }
    if (Array.isArray(json)) return json as UploadedFile[];
    if (Array.isArray(json?.files)) return json.files as UploadedFile[];
    if (Array.isArray(json?.data)) return json.data as UploadedFile[];
    if (json?.file) return [json.file as UploadedFile];
    if (json?.path || json?.url || json?.name)
      return [json as UploadedFile];
    return [];
  }

  async function uploadFilesForQuestion(
    qid: string,
    files: File[]
  ): Promise<UploadedFile[]> {
    const out: UploadedFile[] = [];

    for (const f of files) {
      const res = await uploadIntakeImage(apiBase, f, "raf");
      if (res.ok) {
        out.push({
          name: f.name || "",
          size: f.size,
          type: f.type || "file",
          path: res.path,
          url: res.url,
        });
      } else {
        if (search.get("debug") === "1") {
          try {
            console.warn("[raf] upload failed", {
              qid,
              file: f.name,
              message: res.message,
            });
          } catch {}
        }
      }
    }

    return out;
  }

  async function uploadPendingFiles(): Promise<
    Record<string, UploadedFile[]>
  > {
    const out: Record<string, UploadedFile[]> = {};
    const entries = Object.entries(fileStash || {});
    for (const [qid, files] of entries) {
      if (!files || files.length === 0) continue;
      const uploaded = await uploadFilesForQuestion(
        qid,
        files
      ).catch(() => []);
      if (uploaded.length) out[qid] = uploaded;
    }
    return out;
  }

  async function postAnswersToConsultation(
    override?: Answers
  ) {
    const sid =
      sessionId != null ? Number(sessionId) : NaN;
    const effectiveAnswers = override ?? answers;
    if (!Number.isFinite(sid) || sid <= 0) {
      console.warn("[raf] missing sessionId — skipping POST");
      return { ok: false, skipped: true };
    }
    try {
      await ensureCsrfCookie(apiBase);
      const headers: Record<string, string> = {
        ...getAuthHeaders(),
      };
      const xsrf = getCookie("XSRF-TOKEN");
      if (xsrf) {
        try {
          headers["X-XSRF-TOKEN"] = decodeURIComponent(xsrf);
        } catch {
          headers["X-XSRF-TOKEN"] = xsrf;
        }
      }

      const payload = {
        form_type: "raf",
        service_slug: slug,
        answers: effectiveAnswers,
        session_id: sid,
      };

      if (search.get("debug") === "1") {
        try {
          console.log("[raf] posting consultation answers", {
            sid,
            payload,
            api: `${apiBase}/api/consultations/${encodeURIComponent(
              String(sid)
            )}/answers`,
          });
        } catch {}
      }

      const res = await fetch(
        `${apiBase}/api/consultations/${encodeURIComponent(
          String(sid)
        )}/answers`,
        {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      const text = await res.text().catch(() => "");
      if (!res.ok) {
        let json: any = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {}
        console.warn(
          "[raf] consult answers failed",
          res.status,
          json || text || "(empty)"
        );
      } else if (search.get("debug") === "1") {
        console.log("[raf] consult answers ok", res.status);
      }
      return { ok: res.ok };
    } catch (e) {
      console.warn("[raf] error posting answers", e);
      return { ok: false };
    }
  }

  const onContinue = async () => {
    setSubmitting(true);
    setError(null);
    setSaveFlash("Saving");
    // First, upload any pending files and merge server-returned urls/paths into answers
    let answersToSend: Answers = { ...answers };
    const uploadedByQ = await uploadPendingFiles().catch(() => ({}));
    for (const [qid, items] of Object.entries(uploadedByQ)) {
      answersToSend[qid] = items.map((it) => ({
        name: it.name,
        size: it.size,
        type: it.type,
        path: it.path,
        url: it.url,
      }));
    }
    try {
      try {
        localStorage.setItem(
          "last_raf",
          JSON.stringify({
            slug,
            sessionId,
            answers,
            ts: Date.now(),
          })
        );
      } catch {}

      try {
        sessionStorage.setItem(
          "raf.last_submit",
          JSON.stringify({
            slug,
            sessionId,
            answers,
            ts: Date.now(),
          })
        );
      } catch {}

      try {
        window.dispatchEvent(
          new CustomEvent("raf:submit", {
            detail: { slug, sessionId, answers },
          })
        );
        if (search.get("debug") === "1") {
          console.log("[raf] submit", { slug, sessionId, answers });
        }
      } catch {}

      // primary save
      await postAnswersToConsultation(answersToSend);

      // legacy best effort
      try {
        await ensureCsrfCookie(apiBase);
        const xsrf = getCookie("XSRF-TOKEN");
        const postUrls = [
          `${apiBase}/api/services/${encodeURIComponent(
            slug
          )}/raf/answers`,
          `${apiBase}/api/services/${encodeURIComponent(
            slug
          )}/forms/answers`,
        ];
        for (const url of postUrls) {
          try {
            const legacyHeaders: Record<string, string> = {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
              ...getAuthHeaders(),
            };
            if (xsrf) {
              try {
                legacyHeaders["X-XSRF-TOKEN"] =
                  decodeURIComponent(xsrf);
              } catch {
                legacyHeaders["X-XSRF-TOKEN"] = xsrf;
              }
            }

            const r = await fetch(url, {
              method: "POST",
              headers: legacyHeaders,
              credentials: "include",
              body: JSON.stringify({
                answers: answersToSend,
                session_id: sessionId,
                service: slug,
                slug,
              }),
            });

            if (!r.ok && r.status === 419) {
              if (
                typeof window !== "undefined" &&
                (window as any).__raf_legacy_retry__ !== url
              ) {
                (window as any).__raf_legacy_retry__ = url;
                await ensureCsrfCookie(apiBase);
                const retryXsrf = getCookie("XSRF-TOKEN");
                if (retryXsrf) {
                  try {
                    legacyHeaders["X-XSRF-TOKEN"] =
                      decodeURIComponent(retryXsrf);
                  } catch {
                    legacyHeaders["X-XSRF-TOKEN"] = retryXsrf;
                  }
                }
                await fetch(url, {
                  method: "POST",
                  headers: legacyHeaders,
                  credentials: "include",
                  body: JSON.stringify({
                    answers: answersToSend,
                    session_id: sessionId,
                    service: slug,
                    slug,
                  }),
                }).catch(() => {});
              }
            }
            if (r.ok) break;
          } catch {}
        }
      } catch {}

      setSaveFlash("Saved");
      setTimeout(() => setSaveFlash(null), 1500);

      // navigate with sessionId so calendar and payment can read it
      const qp = new URLSearchParams();
      qp.set("step", nextStep);
      if (sessionId) {
        qp.set("session_id", String(sessionId));
        try {
          document.cookie = `pe_consultation_session_id=${sessionId}; path=/; max-age=604800`;
        } catch {}
      }
      if (search.get("debug") === "1") qp.set("debug", "1");
      router.push(
        `/private-services/${encodeURIComponent(
          slug
        )}/book?${qp.toString()}`
      );
    } catch (e: any) {
      setError(e?.message || "Failed to save answers.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {showProgressBar && (
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-gray-200 dark:border-slate-700">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700 dark:text-slate-100">
                  Progress
                </span>
                <span className="rounded-full px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200">
                  {remainingRequired} left
                </span>
              </div>
              <div
                className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-slate-800"
                role="progressbar"
                aria-label="Risk assessment progress"
                aria-valuenow={percentComplete}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-2 rounded-full bg-emerald-600"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearAnswers}
                className="text-sm px-3 py-1 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Clear answers
              </button>
              {search.get("debug") === "1" && (
                <span className="text-xs rounded-full px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200">
                  session {sessionId ?? "none"}
                </span>
              )}
            </div>
          </div>
          {saveFlash && (
            <div className="text-center text-xs text-gray-600 dark:text-slate-300 pb-2">
              {saveFlash}
            </div>
          )}
        </div>
      )}
      <div className="max-w-4xl mx-auto mt-4">
        <h2 className="text-2xl md:text-3xl font-semibold mb-2">
          Risk Assessment
        </h2>
        {search.get("debug") === "1" && (
          <div className="mb-2 text-xs text-gray-600 dark:text-slate-300">
            session {sessionId ?? "none"}
          </div>
        )}
        <p className="text-gray-600 mb-6">
          Please answer a few questions to help our clinicians assess your
          suitability for this treatment.
        </p>

        {loading && (
          <div className="rounded-xl border p-6 bg-white shadow-sm">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4 mb-4">
            {error}
          </div>
        )}

        {!loading && !error && questions.length === 0 && (
          <div className="rounded-xl border p-6 bg-white shadow-sm text-gray-600">
            No questions for this service yet. You can still continue to the
            next step.
          </div>
        )}

        {!loading && questionsInSection.length > 0 && (
          <>
            {/* Section navigator */}
            <div className="mb-4 flex items-center justify-between text-sm">
              <div className="text-gray-700 dark:text-slate-200">
                Section {sectionIdx + 1} of {sections.order.length} •{" "}
                {currentSectionTitle}
              </div>
              {sections.order.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSectionIdx((i) => Math.max(0, i - 1))
                    }
                    disabled={sectionIdx === 0}
                    className="px-3 py-1 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
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
                    disabled={sectionIdx >= sections.order.length - 1}
                    className="px-3 py-1 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next section
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {questionsInSection.map((q) => (
                <QuestionField
                  key={q.id}
                  q={q}
                  value={answers[q.id]}
                  onChange={(v) => onChange(q.id, v)}
                  fileStash={fileStash}
                  setFileStash={setFileStash}
                />
              ))}
            </div>
          </>
        )}

        {/* Footer actions */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              sectionIdx > 0
                ? setSectionIdx((i) => Math.max(0, i - 1))
                : onBack()
            }
            className="px-5 py-2 rounded-full border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
          >
            {sectionIdx === 0 ? "Back" : "Previous Section"}
          </button>

          <div className="text-sm text-gray-500">
            {requiredUnansweredInSection.length > 0 && (
              <div>
                {requiredUnansweredInSection.length} required{" "}
                {requiredUnansweredInSection.length === 1
                  ? "question"
                  : "questions"}{" "}
                left in this section
              </div>
            )}
            {requiredUnanswered.length > 0 && (
              <div>
                {requiredUnanswered.length} required{" "}
                {requiredUnanswered.length === 1
                  ? "question"
                  : "questions"}{" "}
                left in total
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (sectionIdx < sections.order.length - 1) {
                setSectionIdx((i) =>
                  Math.min(sections.order.length - 1, i + 1)
                );
              } else {
                onContinue();
              }
            }}
            disabled={
              submitting ||
              (sectionIdx >= sections.order.length - 1 &&
                requiredUnanswered.length > 0)
            }
            className={`px-6 py-2 rounded-full text-white ${
              submitting ||
              (sectionIdx >= sections.order.length - 1 &&
                requiredUnanswered.length > 0)
                ? "bg-emerald-300"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {submitting
              ? "Saving…"
              : sectionIdx < sections.order.length - 1
              ? "Next Section"
              : "Continue"}
          </button>
        </div>
      </div>
    </>
  );
}

function QuestionField({
  q,
  value,
  onChange,
  fileStash,
  setFileStash,
}: {
  q: Question;
  value: any;
  onChange: (v: any) => void;
  fileStash: Record<string, File[]>;
  setFileStash: Dispatch<
    SetStateAction<Record<string, File[]>>
  >;
}) {
  const base =
    "block w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  return (
    <div
      id={`q-${q.id}`}
      className="rounded-xl border p-4 bg-white shadow-sm"
    >
      <label className="block font-medium mb-1">
        {q.label}{" "}
        {q.required && (
          <span className="text-red-600">*</span>
        )}
      </label>
      {q.helpText && (
        <p className="text-sm text-gray-500 mb-2">
          {q.helpText}
        </p>
      )}

      {q.type === "text" && (
        <input
          type="text"
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
            onChange(
              e.target.value === ""
                ? ""
                : Number(e.target.value)
            )
          }
        />
      )}

      {q.type === "boolean" && (
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name={`bool-${q.id}`}
              checked={value === true}
              onChange={() => onChange(true)}
            />
            <span>Yes</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name={`bool-${q.id}`}
              checked={value === false}
              onChange={() => onChange(false)}
            />
            <span>No</span>
          </label>
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

      {q.type === "multiselect" && (
        <div className="grid sm:grid-cols-2 gap-2">
          {(q.options || []).map((opt) => {
            const arr: string[] = Array.isArray(value)
              ? value
              : [];
            const checked = arr.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2"
              >
                <input
                  type="checkbox"
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
            className="mt-2 block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:text-gray-700 hover:file:bg-gray-50"
            onChange={(e) => {
              const list = Array.from(e.target.files || []);
              const max = 10 * 1024 * 1024; // 10MB
              const kept = list.filter(
                (f) => f.size <= max
              );
              // Stash real files for upload at submit time
              setFileStash((prev) => ({
                ...prev,
                [q.id]: kept,
              }));
              // Store lightweight meta to keep UI responsive and localStorage serialisable
              const meta = kept.map((f) => ({
                name: f.name,
                size: f.size,
                type: f.type || "file",
              }));
              onChange(meta);
            }}
          />
          {Array.isArray(value) && value.length > 0 && (
            <ul className="text-sm text-gray-600">
              {value.map((f: any, i: number) => (
                <li key={i}>
                  {f.name}{" "}
                  {typeof f.size === "number"
                    ? `(${Math.round(
                        f.size / 1024
                      )} KB)`
                    : ""}
                </li>
              ))}
            </ul>
          )}
          {fileStash[q.id]?.length ? (
            <div className="text-xs text-gray-500">
              files queued and will upload on continue
            </div>
          ) : null}
          {!q.helpText && (
            <p className="text-xs text-gray-500">
              Max 10MB. PDF or image.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
