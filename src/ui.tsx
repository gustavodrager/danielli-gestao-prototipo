import { useEffect, useRef, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useDemo } from "./demo-context";
import { periods, type Period } from "./data";
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
export function Shell({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (!first.current) mainRef.current?.focus({ preventScroll: true });
    first.current = false;
    const heading = mainRef.current?.querySelector("h1")?.textContent;
    document.title = heading
      ? `${heading} · Danielli Gestão`
      : "Danielli Gestão";
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [pathname, hash]);
  return (
    <div className="app">
      <a className="skip-link" href="#content">
        Pular para conteúdo
      </a>
      <header className="brand-header">
        <Link className="brand" to="/" aria-label="Danielli Gestão, início">
          <span className="brand-mark">
            D<span>✦</span>
          </span>
          <span>
            <b>DANIELLI</b>
            <small>RESTAURANTE & DOCERIA</small>
          </span>
        </Link>
        <Link className="demo-pill" to="/mais">
          DEMONSTRAÇÃO
        </Link>
      </header>
      <main id="content" ref={mainRef} tabIndex={-1}>
        {children}
      </main>
      <footer className="page-footer">
        Dados fictícios · Danielli Gestão
        <br />
        Feito para enxergar o negócio com clareza.
      </footer>
      <nav className="bottom-nav" aria-label="Navegação principal">
        <NavLink
          to="/"
          end
          className={() =>
            pathname === "/" ||
            pathname.startsWith("/indicadores/") ||
            pathname.startsWith("/lancamentos/")
              ? "active"
              : ""
          }
        >
          <Icon name="home" />
          <span>Visão geral</span>
        </NavLink>
        <NavLink to="/caixa">
          <Icon name="cash" />
          <span>Caixa</span>
        </NavLink>
        <NavLink to="/mais">
          <Icon name="more" />
          <span>Mais</span>
        </NavLink>
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
}: {
  kind: "observado" | "calculado" | "estimado";
}) {
  return (
    <span className={`badge ${kind}`}>
      {kind === "observado"
        ? "Observado · exemplo"
        : kind === "calculado"
          ? "Calculado"
          : "Estimado"}
    </span>
  );
}
export function PeriodSelect() {
  const { period, setPeriod } = useDemo();
  return (
    <label className="period-select">
      <span className="eyebrow">PERÍODO DOS INDICADORES</span>
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value as Period)}
      >
        {Object.entries(periods).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
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
  return (
    <Link className="row-link" to={to}>
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
