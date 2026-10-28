import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  ExternalLink,
  Info,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wind,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiBase, request } from "./api";
import type { Dashboard, Pair, Summary, Version } from "./types";
import {
  CorrelationChart,
  formatNumber as num,
  formatTime as dt,
  GenerationChart,
} from "./Charts";

type View = "overview" | "accuracy" | "explorer" | "methodology";
const pages: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "accuracy", label: "Forecast Accuracy", icon: BarChart3 },
  { id: "explorer", label: "Forecast Explorer", icon: Search },
  { id: "methodology", label: "Data & Methodology", icon: BookOpen },
];
const titles: Record<View, string> = {
  overview: "UK Wind Forecast Intelligence",
  accuracy: "Forecast Accuracy",
  explorer: "Forecast Explorer",
  methodology: "Data & Methodology",
};
const signed = (v: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${num(v)}`;
const toExclusive = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const initialView = (): View =>
  pages.some((p) => p.id === location.hash.slice(1))
    ? (location.hash.slice(1) as View)
    : "overview";

function Kpi({
  label,
  value,
  note,
  icon: Icon,
  accent = false,
  sign = false,
}: {
  label: string;
  value: number | null;
  note: string;
  icon: LucideIcon;
  accent?: boolean;
  sign?: boolean;
}) {
  return (
    <article className={`kpi ${accent ? "accent" : ""}`}>
      <div className="kpi-top">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <div className="kpi-value">
        {sign ? signed(value) : num(value)}
        <small>MW</small>
      </div>
      <div className="kpi-note">{note}</div>
    </article>
  );
}

function ErrorTable({
  rows,
  onSelect,
  compact = false,
}: {
  rows: Pair[];
  onSelect: (p: Pair) => void;
  compact?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>
              Delivery interval <small>UTC</small>
            </th>
            <th>
              Published <small>UTC</small>
            </th>
            <th>
              Forecast <small>MW</small>
            </th>
            <th>
              Actual <small>MW</small>
            </th>
            <th>
              Signed error <small>MW</small>
            </th>
            {!compact && (
              <th>
                Absolute error <small>MW ↓</small>
              </th>
            )}
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.start_time}>
              <td>
                <button className="table-link" onClick={() => onSelect(r)}>
                  {dt(r.start_time)}
                </button>
              </td>
              <td className="muted">{dt(r.forecast_publish_time)}</td>
              <td>{num(r.forecast_generation)}</td>
              <td>{num(r.actual_generation)}</td>
              <td>
                <span
                  className={`error-pill ${(r.error || 0) > 0 ? "positive" : "negative"}`}
                >
                  {signed(r.error)}
                </span>
              </td>
              {!compact && <td>{num(r.absolute_error)}</td>}
              <td>
                <button
                  className="icon-button"
                  aria-label={`Inspect ${dt(r.start_time)}`}
                  onClick={() => onSelect(r)}
                >
                  <ArrowUpRight size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="empty">
          No matched intervals under this policy. Try a later cutoff or a
          different delivery range.
        </div>
      )}
    </div>
  );
}

function VersionPanel({
  pair,
  query,
  close,
}: {
  pair: Pair;
  query: string;
  close: () => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request<{ data: Version[] }>(
      `/api/forecasts?${query}&delivery_time=${encodeURIComponent(pair.start_time)}&limit=1000`,
      { signal: controller.signal },
    )
      .then((v) => setVersions(v.data))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const focusable = panel.current?.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex="0"]',
        );
        if (!focusable?.length) return;
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      controller.abort();
      document.body.style.overflow = overflow;
      previous?.focus();
      window.removeEventListener("keydown", onKey);
    };
  }, [pair.start_time, query, close]);
  return (
    <div className="drawer-backdrop" onClick={close}>
      <div
        className="drawer"
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-heading">
          <span className="eyebrow">FORECAST AUDIT TRAIL</span>
          <button
            className="icon-button"
            aria-label="Close interval details"
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        <h2 id="detail-title">{dt(pair.start_time, true)}</h2>
        <p className="muted">Delivery start · UTC</p>
        <div className="detail-stats">
          <div>
            <span>Selected forecast</span>
            <strong>
              {num(pair.forecast_generation)} <small>MW</small>
            </strong>
          </div>
          <div>
            <span>Actual generation</span>
            <strong>
              {num(pair.actual_generation)} <small>MW</small>
            </strong>
          </div>
          <div>
            <span>Signed error</span>
            <strong>
              {signed(pair.error)} <small>MW</small>
            </strong>
          </div>
        </div>
        <div className="policy-box">
          <Clock3 size={17} />
          <div>
            <strong>Decision cutoff: {dt(pair.cutoff_time)} UTC</strong>
            <p>
              {pair.eligible
                ? `Selected publication: ${dt(pair.forecast_publish_time)} UTC.`
                : "No eligible forecast. Later versions are excluded from accuracy metrics."}{" "}
              Prototype assumption.
            </p>
          </div>
        </div>
        <h3>
          Publication history{" "}
          <span className="count-tag">{pair.version_count}</span>
        </h3>
        <p className="muted small">
          Every available version, newest first. Eligibility is based on
          publication time, including versions published after delivery.
        </p>
        {loading ? (
          <div className="empty" role="status">
            Loading publication history…
          </div>
        ) : error ? (
          <div className="notice error" role="alert">
            {error}
          </div>
        ) : (
          <div className="version-list">
            {versions.map((v) => (
              <div
                className={`version ${v.selected ? "selected" : ""}`}
                key={v.publish_time}
              >
                <div>
                  <strong>
                    {dt(v.publish_time)} <small>UTC</small>
                  </strong>
                  <span>
                    {v.selected ? (
                      <>
                        <Check size={12} /> Selected for evaluation
                      </>
                    ) : v.eligible_under_policy ? (
                      "Eligible · earlier publication"
                    ) : (
                      "After cutoff · excluded"
                    )}
                  </span>
                </div>
                <b>
                  {num(v.generation)} <small>MW</small>
                </b>
              </div>
            ))}
            {!versions.length && (
              <div className="empty">
                No WINDFOR publications exist at this delivery start. Hourly
                forecasts do not cover the intervening half-hours.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Explorer({
  rows,
  onSelect,
}: {
  rows: Pair[];
  onSelect: (p: Pair) => void;
}) {
  const [day, setDay] = useState("");
  const [interval, setInterval] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("delivery-desc");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const list = rows.filter(
      (r) =>
        (!day || r.start_time.startsWith(day)) &&
        (!interval || r.start_time.slice(11, 16) === interval) &&
        (status === "all" ||
          (status === "matched"
            ? r.error != null
            : status === "ineligible"
              ? r.version_count > 0 && !r.eligible
              : r.version_count === 0)),
    );
    const [key, direction] = sort.split("-");
    return list.sort((a, b) => {
      const x =
        key === "delivery"
          ? a.start_time
          : key === "publication"
            ? a.forecast_publish_time
            : a.absolute_error;
      const y =
        key === "delivery"
          ? b.start_time
          : key === "publication"
            ? b.forecast_publish_time
            : b.absolute_error;
      if (x == null) return y == null ? 0 : 1;
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * (direction === "asc" ? 1 : -1);
    });
  }, [rows, day, interval, status, sort]);
  useEffect(() => setPage(0), [rows, day, interval, status, sort]);
  const maxPage = Math.max(0, Math.ceil(filtered.length / 24) - 1);
  const current = Math.min(page, maxPage);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Delivery intervals</h2>
          <p>Inspect the selected forecast and its full publication history.</p>
        </div>
        <span className="subtle-badge">{num(filtered.length)} intervals</span>
      </div>
      <div className="explorer-controls">
        <label>
          Delivery date
          <input
            type="date"
            aria-label="Explorer delivery date"
            min={rows[0]?.start_time.slice(0, 10)}
            max={rows.at(-1)?.start_time.slice(0, 10)}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <label>
          Exact start (UTC)
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
          >
            <option value="">All times</option>
            {Array.from(
              { length: 48 },
              (_, i) =>
                `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
            ).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Coverage
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All intervals</option>
            <option value="matched">Matched pairs</option>
            <option value="ineligible">No eligible forecast</option>
            <option value="missing">No forecast at delivery start</option>
          </select>
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="delivery-desc">Delivery · newest</option>
            <option value="delivery-asc">Delivery · oldest</option>
            <option value="publication-desc">Publication · newest</option>
            <option value="publication-asc">Publication · oldest</option>
            <option value="error-desc">Absolute error · largest</option>
            <option value="error-asc">Absolute error · smallest</option>
          </select>
        </label>
        <button
          className="text-button"
          onClick={() => {
            setDay("");
            setInterval("");
            setStatus("all");
            setSort("delivery-desc");
          }}
        >
          Reset
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>
                Delivery <small>UTC</small>
              </th>
              <th>
                Selected publication <small>UTC</small>
              </th>
              <th>
                Forecast <small>MW</small>
              </th>
              <th>
                Actual <small>MW</small>
              </th>
              <th>
                Error / |error| <small>MW</small>
              </th>
              <th>Policy status</th>
              <th>Versions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(current * 24, current * 24 + 24).map((r) => (
              <tr key={r.start_time}>
                <td>
                  <button className="table-link" onClick={() => onSelect(r)}>
                    {dt(r.start_time)}
                  </button>
                </td>
                <td className="muted">{dt(r.forecast_publish_time)}</td>
                <td>{num(r.forecast_generation)}</td>
                <td>{num(r.actual_generation)}</td>
                <td>
                  {signed(r.error)} / {num(r.absolute_error)}
                </td>
                <td>
                  <span className={`status-tag ${r.eligible ? "good" : ""}`}>
                    {r.eligible ? "Eligible" : "No eligible forecast"}
                  </span>
                </td>
                <td>
                  <button
                    className="version-button"
                    onClick={() => onSelect(r)}
                  >
                    {r.version_count} <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="empty">
            No intervals match these filters. Reset the filters to inspect the
            selected delivery period.
          </div>
        )}
      </div>
      <div className="pagination">
        <span>
          {filtered.length ? current * 24 + 1 : 0}–
          {Math.min((current + 1) * 24, filtered.length)} of {filtered.length}{" "}
          intervals
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Previous page"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            Page {current + 1} of {maxPage + 1}
          </span>
          <button
            className="icon-button"
            aria-label="Next page"
            disabled={current >= maxPage}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}

function Methodology({ summary }: { summary: Summary }) {
  const m = summary.metrics,
    c = summary.counts;
  return (
    <div className="method-grid">
      <section className="panel prose">
        <span className="eyebrow">01 / SOURCE & SCOPE</span>
        <h2>One provider. An auditable history.</h2>
        <p>
          Elexon is the sole provider. FUELHH supplies national wind actuals
          filtered to <code>fuelType = WIND</code>. WINDFOR supplies forecast
          versions. The source describes Great Britain operationally metered
          wind; it does not represent every embedded or unmetered UK wind
          generator.
        </p>
        <p>
          Generation and errors are in <strong>MW</strong>. Actuals are
          half-hour averages; the inspected January forecasts have hourly
          delivery starts. Matching uses identical <code>startTime</code> values
          only, with no interpolation or zero filling. Half-hour actuals without
          forecasts remain visible in the Explorer.
        </p>
        <p>
          Scope is{" "}
          <strong>
            1 January 2026 00:00 UTC inclusive to 1 February 2026 00:00 UTC
            exclusive
          </strong>
          . All displayed times are UTC, which equals Europe/London in January.
        </p>
        <div className="source-links">
          <a
            href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
            target="_blank"
            rel="noreferrer"
          >
            FUELHH documentation <ExternalLink size={13} />
          </a>
          <a
            href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
            target="_blank"
            rel="noreferrer"
          >
            WINDFOR documentation <ExternalLink size={13} />
          </a>
          <a
            href="https://data.elexon.co.uk/swagger/v1/swagger.json"
            target="_blank"
            rel="noreferrer"
          >
            Official OpenAPI schema <ExternalLink size={13} />
          </a>
        </div>
      </section>
      <section className="panel prose">
        <span className="eyebrow">02 / FORECAST POLICY</span>
        <h2>What was known before delivery?</h2>
        <p>
          <strong>{summary.forecast_policy.description}.</strong> This cutoff is
          a configurable prototype assumption, not a verified UK market decision
          rule.
        </p>
        <p>
          <code>startTime</code> is when power is delivered.{" "}
          <code>publishTime</code> is when a forecast was released. For each
          delivery start, the latest publication at or before the previous day’s
          cutoff is selected. Later publications are retained in the audit trail
          and excluded from evaluation.
        </p>
        <p>
          If no eligible publication exists, the selected forecast remains
          missing. A selected publication with a null generation stays missing;
          we do not silently substitute an older forecast. Publications from
          December can qualify for January delivery.
        </p>
        <div className="policy-box">
          <ShieldCheck size={20} />
          <div>
            <strong>No future information in selection</strong>
            <p>Every selected publication must pass publishTime ≤ cutoff.</p>
          </div>
        </div>
      </section>
      <section className="panel prose">
        <span className="eyebrow">03 / ACCURACY METRICS</span>
        <h2>Clear formulas. Consistent samples.</h2>
        <p>
          Let F be forecast generation, A actual generation, e = F − A, and n
          the number of valid matched pairs. Every primary KPI uses the same n ={" "}
          <strong>{num(c.matched_pairs)}</strong> pairs.
        </p>
        <dl className="formulas">
          <div>
            <dt>MAE = Σ |F − A| / n</dt>
            <dd>Average absolute forecast error, in MW.</dd>
          </div>
          <div>
            <dt>RMSE = √(Σ (F − A)² / n)</dt>
            <dd>Gives larger errors more weight, in MW.</dd>
          </div>
          <div>
            <dt>Bias = Σ (F − A) / n</dt>
            <dd>
              Positive means overforecasting; negative means underforecasting.
            </dd>
          </div>
          <div>
            <dt>MAPE = 100 × mean(|(F − A) / A|)</dt>
            <dd>
              {num(m.mape, 2)}% across {num(m.mape_pair_count)} nonzero-actual
              pairs. Zero actuals excluded; near-zero actuals can distort this
              metric.
            </dd>
          </div>
        </dl>
        <p>
          Missing pairs are excluded. When n = 0, all primary metrics are
          unavailable. Error rankings use |e| descending.
        </p>
      </section>
      <section className="panel prose">
        <span className="eyebrow">04 / PROVENANCE & QUALITY</span>
        <h2>Know what you are looking at.</h2>
        <p>
          Current mode:{" "}
          <strong>
            {summary.source_mode === "live_cache"
              ? "Live retrieval cached in this server instance"
              : "Bundled real Elexon snapshot"}
          </strong>
          . Last successful retrieval:{" "}
          <strong>{dt(summary.retrieved_at, true)} UTC</strong>. Refresh
          retrieves the full configured history; a failed window keeps the
          previous snapshot.
        </p>
        <p>
          Streams return JSON arrays with no pagination. Retrieval uses daily
          publication windows from 25 December through 2 February for forecasts,
          and 1 January through 2 February for actuals, then filters delivery
          times to January. This bounded window may omit unusually late
          corrections or publications outside the retrieved history.
        </p>
        <p>
          Actual duplicates use the latest publication. Forecast duplicates use
          (delivery, publication); conflicting same-key numeric values use the
          smallest value deterministically. Duplicate counts include overlapping
          inclusive request boundaries.
        </p>
        <div className="quality-grid">
          {Object.entries(summary.quality).map(([key, value]) => (
            <div key={key}>
              <strong>{num(value)}</strong>
              <span>{key.replaceAll("_", " ")}</span>
            </div>
          ))}
        </div>
        <p>
          Quality counters cover the full snapshot. Coverage counters on the
          dashboard follow your selected date range. This tool supports
          inspection; it does not recommend or execute electricity trades.
        </p>
      </section>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>(initialView);
  const [mobileNav, setMobileNav] = useState(false);
  const [start, setStart] = useState("2026-01-01");
  const [end, setEnd] = useState("2026-01-31");
  const [cutoff, setCutoff] = useState("11:00");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Pair | null>(null);
  const valid =
    !!start &&
    !!end &&
    !!cutoff &&
    start >= "2026-01-01" &&
    end <= "2026-01-31" &&
    start <= end &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff);
  const query = valid
    ? new URLSearchParams({ start, end: toExclusive(end), cutoff }).toString()
    : "";
  useEffect(() => {
    const hash = () => setView(initialView());
    window.addEventListener("hashchange", hash);
    return () => window.removeEventListener("hashchange", hash);
  }, []);
  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSelected(null);
    request<Dashboard>(`/api/dashboard?${query}`, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, reload]);
  const navigate = (next: View) => {
    setView(next);
    location.hash = next;
    setMobileNav(false);
  };
  const refresh = async () => {
    setRefreshing(true);
    setRefreshMessage(
      "Retrieving all January publication windows from Elexon…",
    );
    try {
      await request("/api/refresh", {
        method: "POST",
        signal: AbortSignal.timeout(240000),
      });
      setRefreshMessage("Elexon data refreshed successfully.");
      setReload((v) => v + 1);
    } catch (e) {
      setRefreshMessage(
        `${e instanceof Error ? e.message : "Refresh failed."} Your previous data remains available.`,
      );
    } finally {
      setRefreshing(false);
    }
  };
  const s = data?.summary,
    m = s?.metrics,
    c = s?.counts;
  const coverage = c ? (c.matched_pairs / c.expected_intervals) * 100 : 0;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <a
          className="brand"
          href="#overview"
          onClick={() => navigate("overview")}
        >
          <span className="brand-icon">
            <Wind size={24} strokeWidth={1.7} />
          </span>
          WindLens<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">ENERGY INTELLIGENCE</div>
        <nav aria-label="Main navigation">
          {pages.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={18} strokeWidth={1.7} />
              {label}
              {view === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-card">
            <span className="source-icon">
              <Database size={19} />
            </span>
            <h4>Built on trusted data</h4>
            <p>
              National wind data from
              <br />
              Elexon Insights.
            </p>
            <a
              href="https://bmrs.elexon.co.uk/api-documentation"
              target="_blank"
              rel="noreferrer"
            >
              Explore the source <ArrowUpRight size={13} />
            </a>
          </div>
          <div className="sidebar-foot">
            <span className="uk-mark">GB</span>
            <span>
              Great Britain
              <br />
              <small>National generation</small>
            </span>
            <span className="status-dot" />
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          aria-label="Close navigation"
          className="nav-backdrop"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Toggle navigation"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{pages.find((p) => p.id === view)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="environment">
              <span className="status-dot" /> January 2026 analysis
            </span>
            <button
              className="icon-button"
              title="Data & Methodology"
              aria-label="Open methodology"
              onClick={() => navigate("methodology")}
            >
              <CircleHelp size={18} />
            </button>
            <div className="avatar" title="Analyst workspace">
              WL
            </div>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="heading-kicker">
                <span className="green-line" /> WIND GENERATION ANALYTICS
              </div>
              <h1>{titles[view]}</h1>
              <p>
                {view === "overview"
                  ? "A clearer view of wind. A better-informed day ahead."
                  : view === "accuracy"
                    ? "Measure the gap between what was expected and what was delivered."
                    : view === "explorer"
                      ? "Follow every forecast from publication to delivery."
                      : "The data, decisions, and assumptions behind every number."}
              </p>
            </div>
            <a
              className={`button export-button ${!data || loading || !valid || error ? "disabled" : ""}`}
              href={
                data && !loading && valid && !error
                  ? `${apiBase}/api/export?${query}`
                  : undefined
              }
              aria-disabled={!data || loading || !valid || !!error}
            >
              <ArrowDownToLine size={16} />
              Export data
            </a>
          </div>
          <div className="context-row">
            <div className="context-label">
              <span className="status-dot" /> National wind generation{" "}
              <span>·</span> January 2026
            </div>
            <div className="freshness">
              <Database size={13} />
              <span>
                {s?.source_mode === "live_cache"
                  ? "Elexon · live cache"
                  : "Elexon · snapshot"}
              </span>
              <span className="freshness-time">
                {s
                  ? `Retrieved ${dt(s.retrieved_at)} UTC`
                  : "Connecting to data"}
              </span>
              <button
                className="icon-button"
                title="Refresh all January data from Elexon"
                aria-label="Refresh data from Elexon"
                disabled={refreshing}
                onClick={refresh}
              >
                <RefreshCw size={14} className={refreshing ? "spinning" : ""} />
              </button>
            </div>
          </div>
          <section className="filters" aria-label="Analysis filters">
            <div className="date-filter">
              <CalendarDays size={16} />
              <label>
                <span>From</span>
                <input
                  type="date"
                  aria-label="Start date"
                  min="2026-01-01"
                  max="2026-01-31"
                  value={start}
                  onInput={(e) => setStart(e.currentTarget.value)}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <span className="date-arrow">→</span>
              <label>
                <span>Through</span>
                <input
                  type="date"
                  aria-label="End date inclusive"
                  min="2026-01-01"
                  max="2026-01-31"
                  value={end}
                  onInput={(e) => setEnd(e.currentTarget.value)}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <div className="preset-buttons">
              {[
                { label: "Full month", start: "2026-01-01", end: "2026-01-31" },
                { label: "First week", start: "2026-01-01", end: "2026-01-07" },
              ].map((p) => (
                <button
                  key={p.label}
                  className={
                    start === p.start && end === p.end ? "selected" : ""
                  }
                  onClick={() => {
                    setStart(p.start);
                    setEnd(p.end);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="cutoff-control">
              <SlidersHorizontal size={15} />
              <span>Day-ahead cutoff</span>
              <input
                type="time"
                aria-label="Day-ahead cutoff Europe London"
                value={cutoff}
                onInput={(e) => setCutoff(e.currentTarget.value)}
                onChange={(e) => setCutoff(e.target.value)}
              />
              <span className="timezone">London</span>
            </label>
          </section>
          {!valid && (
            <div role="alert" className="notice error">
              Choose a valid date range within January 2026 and a cutoff time.
            </div>
          )}
          {refreshMessage && (
            <div className="notice" role="status">
              <Info size={16} />
              <span>{refreshMessage}</span>
              {!refreshing && (
                <button
                  className="icon-button"
                  aria-label="Dismiss refresh message"
                  onClick={() => setRefreshMessage("")}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          )}
          {loading && (
            <div className="loading-state" role="status">
              <div className="loading-line" />
              <Wind size={31} />
              <h2>Bringing the data into focus</h2>
              <p>Matching Elexon forecasts with observed generation…</p>
            </div>
          )}
          {!loading && error && (
            <div className="panel error-state" role="alert">
              <Database size={30} />
              <h2>Data is temporarily unavailable</h2>
              <p>{error}</p>
              <button
                className="button primary"
                onClick={() => setReload((v) => v + 1)}
              >
                <RefreshCw size={16} />
                Try again
              </button>
            </div>
          )}
          {!loading && !error && valid && data && s && m && c && (
            <>
              <div className="policy-note">
                <ShieldCheck size={15} />
                <span>
                  <strong>Decision-time view</strong> Latest forecast published
                  by <b>{cutoff} London, previous day</b>.
                </span>
                <button
                  className="assumption-tag"
                  onClick={() => navigate("methodology")}
                >
                  Prototype assumption <Info size={12} />
                </button>
              </div>
              {c.matched_pairs === 0 && (
                <div className="notice" role="status">
                  <Info size={17} />
                  No matched pairs for this range and cutoff. Metrics remain
                  unavailable; inspect the Explorer for forecast availability.
                </div>
              )}
              {s.last_refresh_error && (
                <div className="notice" role="status">
                  Last refresh failed: {s.last_refresh_error}
                </div>
              )}
              {view === "overview" && (
                <>
                  <section className="kpi-grid" aria-label="Overview metrics">
                    <Kpi
                      label="Mean forecast generation"
                      value={m.mean_forecast}
                      note="Selected day-ahead forecast"
                      icon={Wind}
                      accent
                    />
                    <Kpi
                      label="Mean actual generation"
                      value={m.mean_actual}
                      note="Observed at matched delivery starts"
                      icon={Activity}
                    />
                    <Kpi
                      label="Mean absolute error"
                      value={m.mae}
                      note="Average magnitude of forecast error"
                      icon={BarChart3}
                    />
                    <Kpi
                      label="Forecast bias"
                      value={m.bias}
                      note={
                        m.bias == null
                          ? "No matched pairs"
                          : m.bias >= 0
                            ? "Forecasts above actuals on average"
                            : "Forecasts below actuals on average"
                      }
                      icon={SlidersHorizontal}
                      sign
                    />
                  </section>
                  <section className="panel main-chart-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Forecast vs. actual generation</h2>
                        <p>What we expected. What the wind delivered.</p>
                      </div>
                      <div className="chart-legend">
                        <span>
                          <i className="legend-line forecast" />
                          Selected forecast
                        </span>
                        <span>
                          <i className="legend-line actual" />
                          Actual generation
                        </span>
                        <span className="unit-tag">MW</span>
                      </div>
                    </div>
                    <GenerationChart
                      rows={data.timeseries}
                      onSelect={setSelected}
                    />
                    <div className="chart-footer">
                      <span>
                        <Info size={13} />
                        Native hourly forecast starts · click a point to inspect
                        publications
                      </span>
                      <span>Delivery time · UTC</span>
                    </div>
                  </section>
                  <div className="lower-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Largest forecast deviations</h2>
                          <p>The intervals with the greatest absolute error.</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => navigate("accuracy")}
                        >
                          View all <ArrowRight size={14} />
                        </button>
                      </div>
                      <ErrorTable
                        rows={data.errors.slice(0, 5)}
                        onSelect={setSelected}
                        compact
                      />
                    </section>
                    <section className="panel coverage-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Data coverage</h2>
                          <p>Every interval accounted for.</p>
                        </div>
                        <ShieldCheck size={18} className="green" />
                      </div>
                      <div className="coverage-value">
                        {num(coverage, 1)}
                        <small>%</small>
                        <span>matched half-hour starts</span>
                      </div>
                      <div className="coverage-bar">
                        <span style={{ width: `${coverage}%` }} />
                      </div>
                      <div className="coverage-rows">
                        <div>
                          <span>
                            <i className="tiny-dot green-bg" />
                            Valid matched pairs
                          </span>
                          <strong>
                            {num(c.matched_pairs)}{" "}
                            <small>/ {num(c.expected_intervals)}</small>
                          </strong>
                        </div>
                        <div>
                          <span>
                            <i className="tiny-dot lavender-bg" />
                            Actual observations
                          </span>
                          <strong>{num(c.actual_records)}</strong>
                        </div>
                        <div>
                          <span>
                            <i className="tiny-dot gray-bg" />
                            No forecast at start
                          </span>
                          <strong>{num(c.missing_forecasts)}</strong>
                        </div>
                        <div>
                          <span>
                            <i className="tiny-dot amber-bg" />
                            No eligible publication
                          </span>
                          <strong>{num(c.no_eligible_forecast)}</strong>
                        </div>
                        <div>
                          <span>Missing actuals / selected nulls</span>
                          <strong>
                            {num(c.missing_actuals)} /{" "}
                            {num(c.null_selected_values)}
                          </strong>
                        </div>
                      </div>
                      <p className="coverage-note">
                        Forecasts are hourly; actuals are half-hourly. Unmatched
                        starts stay missing.
                      </p>
                    </section>
                  </div>
                </>
              )}
              {view === "accuracy" && (
                <>
                  <section className="kpi-grid">
                    <Kpi
                      label="Mean absolute error"
                      value={m.mae}
                      note={`${num(c.matched_pairs)} valid matched pairs`}
                      icon={BarChart3}
                      accent
                    />
                    <Kpi
                      label="Root mean squared error"
                      value={m.rmse}
                      note="Greater weight on larger deviations"
                      icon={Activity}
                    />
                    <Kpi
                      label="Forecast bias"
                      value={m.bias}
                      note="Positive = overforecast · negative = underforecast"
                      icon={SlidersHorizontal}
                      sign
                    />
                    <article className="kpi">
                      <div className="kpi-top">
                        <span>Valid matched pairs</span>
                        <ShieldCheck size={16} />
                      </div>
                      <div className="kpi-value">
                        {num(c.matched_pairs)}
                        <small>pairs</small>
                      </div>
                      <div className="kpi-note">
                        {num(coverage, 1)}% of half-hour starts
                      </div>
                    </article>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Forecast vs. actual generation</h2>
                        <p>Same selected policy, same matched sample.</p>
                      </div>
                      <div className="chart-legend">
                        <span><i className="legend-line forecast" />Selected forecast</span>
                        <span><i className="legend-line actual" />Actual generation</span>
                        <span className="unit-tag">MW</span>
                      </div>
                    </div>
                    <GenerationChart
                      rows={data.timeseries}
                      onSelect={setSelected}
                    />
                  </section>
                  <div className="accuracy-charts">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Signed error over time</h2>
                          <p>
                            Forecast − actual · above zero means overforecast.
                          </p>
                        </div>
                        <span className="unit-tag">MW</span>
                      </div>
                      <GenerationChart
                        rows={data.timeseries}
                        onSelect={setSelected}
                        error
                      />
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Actual vs. forecast</h2>
                          <p>
                            Diagonal = perfect agreement · forecast on vertical
                            axis.
                          </p>
                        </div>
                      </div>
                      <CorrelationChart rows={data.timeseries} />
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Largest absolute errors</h2>
                        <p>
                          Ranked by |forecast − actual|, largest first. Select
                          an interval for its audit trail.
                        </p>
                      </div>
                      <span className="subtle-badge">
                        Top {data.errors.length}
                      </span>
                    </div>
                    <ErrorTable rows={data.errors} onSelect={setSelected} />
                  </section>
                  <div className="notice">
                    <Info size={16} />
                    MAE = mean |F − A| · RMSE = √mean (F − A)² · Bias = mean (F
                    − A). All use {num(c.matched_pairs)} valid pairs.{" "}
                    <button
                      className="text-button"
                      onClick={() => navigate("methodology")}
                    >
                      Metric definitions
                    </button>
                  </div>
                </>
              )}
              {view === "explorer" && (
                <Explorer rows={data.timeseries} onSelect={setSelected} />
              )}
              {view === "methodology" && <Methodology summary={s} />}
              <footer className="page-footer">
                <span>
                  <Wind size={14} /> WindLens{" "}
                  <span className="footer-separator">/</span> Clarity for the
                  day ahead.
                </span>
                <span>
                  {num(c.matched_pairs)} matched pairs ·{" "}
                  {num(c.forecast_records)} publications · All times UTC
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {selected && (
        <VersionPanel
          pair={selected}
          query={query}
          close={() => setSelected(null)}
        />
      )}
    </div>
  );
}
