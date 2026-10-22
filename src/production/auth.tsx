import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import type { AppUser } from "../../shared/contracts";
import { api, setCsrf } from "./api";
import { todayInSaoPaulo } from "../months";
type Session = { user: AppUser | null; csrfToken: string; today: string };
type AuthValue = {
  user: AppUser | null;
  today: string;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setDefaultRates: (userId: string, rates: AppUser["defaultRates"]) => void;
};
const AuthContext = createContext<AuthValue | null>(null);
export const useAuth = () => useContext(AuthContext)!;
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [clockToday, setClockToday] = useState(todayInSaoPaulo());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const update = useCallback((value: Session) => {
    setCsrf(value.csrfToken);
    setSession(value);
    setClockToday(value.today);
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      update(await api<Session>("/auth/session"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [update]);
  useEffect(() => {
    void refresh();
    const expired = () => {
      setSession((old) => (old ? { ...old, user: null } : null));
      void api<Session>("/auth/session")
        .then(update)
        .catch(() => {});
    };
    window.addEventListener("danielli-session-expired", expired);
    return () =>
      window.removeEventListener("danielli-session-expired", expired);
  }, [refresh, update]);
  useEffect(() => {
    const checkDay = () => setClockToday(todayInSaoPaulo());
    const interval = window.setInterval(checkDay, 60000);
    window.addEventListener("focus", checkDay);
    document.addEventListener("visibilitychange", checkDay);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkDay);
      document.removeEventListener("visibilitychange", checkDay);
    };
  }, []);
  const login = async (login: string, password: string) =>
    update(
      await api<Session>("/auth/login", {
        method: "POST",
        body: { login, password },
      }),
    );
  const logout = async () => {
    await api("/auth/logout", { method: "POST", body: {} });
    update(await api<Session>("/auth/session"));
  };
  if (loading)
    return (
      <div className="p-auth">
        <Brand />
        <p role="status">Conectando ao sistema…</p>
      </div>
    );
  if (error)
    return (
      <div className="p-auth">
        <Brand />
        <h1>Não foi possível acessar</h1>
        <p role="alert">{error}</p>
        <button className="p-primary" onClick={() => void refresh()}>
          Tentar novamente
        </button>
      </div>
    );
  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        today: clockToday,
        login,
        logout,
        refresh,
        setDefaultRates: (userId, rates) =>
          setSession((old) =>
            old?.user?.id === userId
              ? { ...old, user: { ...old.user, defaultRates: rates } }
              : old,
          ),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function Brand() {
  return (
    <div className="p-brand">
      <img
        src="/danielli-logo-transparent.png"
        alt="Danielli Restaurante & Doceria"
        width="260"
        height="100"
      />
    </div>
  );
}
export function Login() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(identifier.trim(), password);
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="p-auth">
      <Brand />
      <span className="eyebrow">GESTÃO DANIELLI</span>
      <h1>Bem-vindo</h1>
      <p>Entre com seu acesso individual para continuar.</p>
      <form onSubmit={submit} className="p-stack">
        <label>
          Usuário
          <input
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="p-error">
            {error}
          </p>
        )}
        <button className="p-primary" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="p-muted">
        Precisa de acesso ou esqueceu a senha? Peça um link ao gestor.
      </p>
    </div>
  );
}
export function SetPassword() {
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) return setError("As senhas precisam ser iguais.");
    setBusy(true);
    setError("");
    try {
      await api("/auth/set-password", {
        method: "POST",
        body: { token, password },
      });
      setDone(true);
      setPassword("");
      setConfirm("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="p-auth">
      <Brand />
      <h1>{done ? "Senha definida" : "Defina sua senha"}</h1>
      {done ? (
        <>
          <p>Seu acesso está pronto.</p>
          <a className="p-primary" href="/">
            Ir para o login
          </a>
        </>
      ) : !token ? (
        <p role="alert">
          Este link está incompleto. Solicite um novo link ao gestor.
        </p>
      ) : (
        <form onSubmit={submit} className="p-stack">
          <p>
            Use de 15 a 128 caracteres. Você pode criar uma frase fácil de
            lembrar.
          </p>
          <label>
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={15}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Repita a senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={15}
              maxLength={128}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && (
            <p className="p-error" role="alert">
              {error}
            </p>
          )}
          <button className="p-primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar senha"}
          </button>
        </form>
      )}
    </div>
  );
}
