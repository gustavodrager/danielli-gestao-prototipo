import { useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, Brand, Login, SetPassword, useAuth } from "./auth";
import { Dashboard, DayDetail } from "./Dashboard";
import { Sales } from "./Sales";
import { Account, Users } from "./Users";
import "../production.css";
export default function ProductionApp() {
  return (
    <AuthProvider>
      <Application />
    </AuthProvider>
  );
}
function Application() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const accountMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setError("");
    if (accountMenu.current) accountMenu.current.open = false;
  }, [location.pathname, location.search]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const menu = accountMenu.current;
      if (
        menu?.open &&
        event.target instanceof Node &&
        !menu.contains(event.target)
      )
        menu.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      const menu = accountMenu.current;
      if (event.key === "Escape" && menu?.open) {
        event.preventDefault();
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  if (location.pathname === "/ativar") return <SetPassword />;
  if (!user) return <Login />;
  const manager = user.role === "gestor";
  const month = new URLSearchParams(location.search).get("mes");
  const suffix = month ? `?mes=${encodeURIComponent(month)}` : "";
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await logout();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="production-app">
      <a className="p-skip" href="#main-content">
        Pular para o conteúdo
      </a>
      <header className="p-header">
        <Link
          to={manager ? `/${suffix}` : `/caixa/vendas${suffix}`}
          aria-label="Danielli início"
        >
          <Brand />
        </Link>
        <details ref={accountMenu} className="p-account-menu">
          <summary aria-label="Menu da conta">
            ☰ <span>Menu</span>
          </summary>
          <nav
            aria-label="Conta"
            onClick={(event) => {
              if (
                event.target instanceof Element &&
                event.target.closest("a") &&
                accountMenu.current
              ) {
                accountMenu.current.open = false;
                accountMenu.current.querySelector("summary")?.focus();
              }
            }}
          >
            <p>
              <b>{user.name}</b>
              <small>{manager ? "Gestor" : "Operador"}</small>
            </p>
            {manager && (
              <Link to={`/usuarios${suffix}`}>Gerenciar acessos</Link>
            )}
            <Link to={`/conta${suffix}`}>Minha conta</Link>
            <button disabled={busy} onClick={() => void signOut()}>
              {busy ? "Saindo…" : "Sair da conta"}
            </button>
          </nav>
        </details>
      </header>
      <main id="main-content" tabIndex={-1}>
        {error && (
          <p role="alert" className="p-error">
            {error}
          </p>
        )}
        <Routes>
          <Route
            path="/"
            element={
              manager ? <Dashboard /> : <Navigate to="/caixa/vendas" replace />
            }
          />
          <Route
            path="/caixa"
            element={<Navigate to={`/caixa/vendas${suffix}`} replace />}
          />
          <Route path="/caixa/vendas" element={<Sales />} />
          <Route
            path="/dias/:date"
            element={
              manager ? <DayDetail /> : <Navigate to="/caixa/vendas" replace />
            }
          />
          <Route
            path="/usuarios"
            element={
              manager ? <Users /> : <Navigate to="/caixa/vendas" replace />
            }
          />
          <Route path="/conta" element={<Account />} />
          <Route path="/compras/cmv" element={<ExpensesUnavailable />} />
          <Route
            path="*"
            element={
              <>
                <h1>Página não encontrada</h1>
                <Link
                  className="p-primary"
                  to={manager ? "/" : "/caixa/vendas"}
                >
                  Voltar ao início
                </Link>
              </>
            }
          />
        </Routes>
      </main>
      <nav className="p-bottom-nav" aria-label="Navegação principal">
        {manager ? (
          <NavLink to={`/${suffix}`} end>
            <span aria-hidden="true">▦</span>Visão geral
          </NavLink>
        ) : (
          <span className="p-disabled" aria-disabled="true">
            <span aria-hidden="true">▦</span>Visão geral
          </span>
        )}
        <NavLink to={`/caixa/vendas${suffix}`}>
          <span aria-hidden="true">↗</span>Entradas
        </NavLink>
        <NavLink to={`/compras/cmv${suffix}`}>
          <span aria-hidden="true">≡</span>Despesas
        </NavLink>
      </nav>
    </div>
  );
}
function ExpensesUnavailable() {
  return (
    <>
      <span className="eyebrow">DESPESAS</span>
      <h1>Próxima etapa</h1>
      <section className="p-panel">
        <h2>Primeiro, as entradas</h2>
        <p>
          O piloto está concentrado no registro de vendas e na visão gerencial.
          Compras/CMV, despesas e pessoal serão liberados após a validação dessa
          etapa.
        </p>
        <p className="p-muted">
          Nenhum valor estimado será apresentado como despesa real.
        </p>
        <Link className="p-primary" to="/caixa/vendas">
          Ir para Entradas
        </Link>
      </section>
    </>
  );
}
