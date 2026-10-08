import {
  availableMonths,
  currentMonth,
  daysCovered,
  monthLabel,
  todayInSaoPaulo,
} from "./months";
import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Link, NavLink } from "./navigation";
import { useDemo } from "./demo-context";
import { units, metricNames, type Metric } from "./data";
import { currentPrototypeView, prototypeViews } from "./prototype-views";
export function Icon({
  name,
  size = 20,
}: {
  name:
    | "home"
    | "cash"
    | "more"
    | "arrow"
    | "back"
    | "check"
    | "document"
    | "spark";
  size?: number;
}) {
  const paths = {
    home: "M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9",
    cash: "M3 5h18v14H3zM3 9h18M7 14h3m5 0h2",
    more: "M5 6h14M5 12h14M5 18h14",
    arrow: "m9 5 7 7-7 7",
    back: "m15 5-7 7 7 7",
    check: "m5 12 4 4L19 6",
    document: "M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h6",
    spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function PrototypeViews({ onSelect }: { onSelect?: () => void }) {
  const { pathname } = useLocation();
  const { profile, setProfile } = useDemo();
  const selected = currentPrototypeView(pathname, profile);
  return (
    <div className="view-options">
      {prototypeViews.map((view) => (
        <Link
          key={view.id}
          to={view.path}
          className={selected === view.id ? "selected" : ""}
          aria-current={selected === view.id ? "page" : undefined}
          onClick={() => {
            setProfile(view.profile);
            onSelect?.();
          }}
        >
          <Icon name={view.icon} />
          <span>
            <b>{view.name}</b>
            <small>{view.description}</small>
          </span>
          {selected === view.id ? <Icon name="check" size={16} /> : null}
        </Link>
      ))}
    </div>
  );
}
function ViewMenu() {
  const { pathname } = useLocation();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        ref.current &&
        !ref.current.contains(event.target)
      )
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <details
      className="view-menu"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape" && ref.current) {
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        role="button"
        aria-label="Mudar visão do protótipo"
        title="Mudar visão do protótipo"
      >
        <Icon name="more" />
      </summary>
      <nav aria-label="Visões do protótipo">
        <span className="eyebrow">VISÕES DO PROTÓTIPO</span>
        <PrototypeViews
          onSelect={() => {
            if (ref.current) ref.current.open = false;
          }}
        />
      </nav>
    </details>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation();
  const scrollPositions = useRef<Record<string, number>>({});
  const lastPath = useRef(pathname);
  const { scenario, profile, setProfile } = useDemo();
  const simulation =
    pathname === "/simulacao" ||
    pathname.startsWith("/caixa/historico/local-") ||
    pathname.startsWith("/caixa/novo") ||
    pathname === "/caixa/concluido" ||
    pathname === "/caixa/vendas" ||
    pathname === "/compras/cmv" ||
    (pathname === "/" && profile !== "gestor");
  const real = pathname.startsWith("/caixa/historico/")
    ? pathname.startsWith("/caixa/historico/real-")
    : scenario === "real";
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const key = pathname;
    lastPath.current = key;
    requestAnimationFrame(() =>
      window.scrollTo(0, scrollPositions.current[key] ?? 0),
    );
    if (!first.current) mainRef.current?.focus({ preventScroll: true });
    first.current = false;
    const heading = mainRef.current?.querySelector("h1")?.textContent;
    document.title = heading
      ? `${heading} · Danielli Gestão`
      : "Danielli Gestão";
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [pathname, hash, scenario, profile]);
  useEffect(() => {
    const track = () => {
      scrollPositions.current[lastPath.current] = window.scrollY;
    };
    window.addEventListener("scroll", track, { passive: true });
    return () => window.removeEventListener("scroll", track);
  }, []);
  return (
    <div className={`app ${simulation ? "operational" : "manager"}`}>
      <a className="skip-link" href="#content">
        Pular para conteúdo
      </a>
      <header className="brand-header">
        <Link
          className="brand"
          to={
            profile === "caixa"
              ? "/caixa/vendas"
              : profile === "compras"
                ? "/compras/cmv"
                : "/"
          }
          aria-label="Danielli Gestão, início"
        >
          <span className="brand-logo">
            <img
              src="/danielli-logo-transparent.png"
              alt="Danielli Restaurante & Doceria"
              width="398"
              height="140"
            />
          </span>
        </Link>
        <ViewMenu />
        {!simulation && !real ? (
          <Link className="demo-pill" to="/mais">
            DADOS FICTÍCIOS
          </Link>
        ) : null}
      </header>
      <main
        id="content"
        ref={mainRef}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (
            event.key !== "Enter" ||
            !(event.target instanceof HTMLInputElement) ||
            event.target.type === "checkbox" ||
            event.target.type === "radio"
          )
            return;
          const form = event.target.closest("form");
          if (!form) return;
          event.preventDefault();
          const fields = Array.from(
            form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
              "input:not([disabled]), textarea:not([disabled])",
            ),
          ).filter((field) => field.getClientRects().length > 0);
          const next = fields[fields.indexOf(event.target) + 1];
          if (next) {
            next.focus();
            next.scrollIntoView({ block: "nearest" });
          } else
            form
              .querySelector<HTMLButtonElement>('button[type="submit"]')
              ?.focus();
        }}
      >
        {children}
      </main>
      <footer className="page-footer">
        {simulation
          ? "Simulação local · dados desta aba"
          : real
            ? "Histórico real · transcrição a conferir"
            : "Dados fictícios · Danielli Gestão"}
        <br />
        Feito para enxergar o negócio com clareza.
      </footer>
      <nav className="bottom-nav" aria-label="Navegação principal">
        {prototypeViews.map((view) => (
          <NavLink
            key={view.id}
            to={view.path}
            end={view.path === "/"}
            className={() =>
              currentPrototypeView(pathname, profile) === view.id
                ? "active"
                : ""
            }
            onClick={() => setProfile(view.profile)}
          >
            <Icon name={view.icon} />
            <span>{view.name}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
export function Back({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="back" to={to}>
      <Icon name="back" size={17} />
      {children}
    </Link>
  );
}
export function Badge({
  kind,
  example = true,
}: {
  kind: "observado" | "calculado" | "estimado";
  example?: boolean;
}) {
  return (
    <span className={`badge ${kind}`}>
      {kind === "observado"
        ? example
          ? "Observado · exemplo"
          : "Observado · a conferir"
        : kind === "calculado"
          ? "Calculado"
          : "Estimado"}
    </span>
  );
}
export function PeriodSelect() {
  const { period, setPeriod } = useDemo();
  const months = availableMonths();
  const today = todayInSaoPaulo();
  return (
    <section className="month-filter" aria-label="Filtro de mês">
      <div className="section-title">
        <span className="eyebrow">{monthLabel(period)}</span>
        <button
          type="button"
          className="text-link"
          onClick={() => setPeriod(currentMonth())}
        >
          Mês atual
        </button>
      </div>
      <div className="month-buttons">
        {months.map((month) => (
          <button
            type="button"
            key={month}
            aria-label={monthLabel(month)}
            aria-pressed={period === month}
            className={period === month ? "selected" : ""}
            onClick={() => setPeriod(month)}
          >
            <b>{monthLabel(month, true).replace(".", "")}</b>
            <small>
              {month.slice(0, 4)}
              {month === today.slice(0, 7)
                ? ` · até ${today.slice(-2)}/${today.slice(5, 7)}`
                : ""}
            </small>
          </button>
        ))}
      </div>
      <p className="hint">
        {period === "2026-07"
          ? "Dados reais · livro de julho"
          : `Dados fictícios · ${daysCovered(period)} dias de demonstração`}
      </p>
    </section>
  );
}
export function Empty({
  title = "Ainda não há dados neste período",
  text = "Os indicadores aparecem quando houver lançamentos. Ausência de dados não significa valor zero.",
}: {
  title?: string;
  text?: string;
}) {
  const { setPeriod, setScenario } = useDemo();
  return (
    <section className="empty panel">
      <span className="empty-icon">
        <Icon name="document" size={30} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button
        className="primary"
        onClick={() => {
          setPeriod("2026-09");
          setScenario("regular");
        }}
      >
        Explorar setembro de exemplo
      </button>
    </section>
  );
}
export function RowLink({
  to,
  title,
  subtitle,
  value,
  color,
}: {
  to: string;
  title: string;
  subtitle?: string;
  value?: string;
  color?: string;
}) {
  const location = useLocation();
  const parts = location.pathname.split("/").filter(Boolean);
  const fields: Record<string, string> = {
    registrado: "Total registrado no livro",
    saidas: "Saídas anotadas no caixa",
    diferenca: "Diferenças anotadas",
    vendas: "Total de vendas no livro",
    dinheiro: "Dinheiro",
    pix: "Pix",
    debito: "Débito",
    credito: "Crédito",
    voucher: "Voucher",
    ifood: "iFood",
  };
  const returnName =
    parts[0] === "indicadores"
      ? units.find((u) => u.id === parts[2])?.name ||
        fields[parts[2]] ||
        metricNames[parts[1] as Metric] ||
        "Indicador"
      : parts[0] === "caixa"
        ? "Histórico do caixa"
        : parts[0] === "dias"
          ? `Registros de ${parts[1].slice(-2)}/${parts[1].slice(5, 7)}/${parts[1].slice(0, 4)}`
          : "Visão geral";
  return (
    <Link
      className="row-link"
      to={to}
      state={{ returnTo: location.pathname + location.search, returnName }}
    >
      {color ? (
        <span className="unit-dot" style={{ background: color }} />
      ) : null}
      <span className="row-copy">
        <b>{title}</b>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
      {value ? <strong>{value}</strong> : null}
      <Icon name="arrow" size={16} />
    </Link>
  );
}
export function Note({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: "warning" | "success" | "";
}) {
  return <div className={`note ${tone}`}>{children}</div>;
}
