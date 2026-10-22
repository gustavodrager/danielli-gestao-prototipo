import { useEffect, useState, type FormEvent } from "react";
import type { AppUser } from "../../shared/contracts";
import { api } from "./api";
import { useAuth } from "./auth";
export function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [role, setRole] = useState<"gestor" | "operador">("operador");
  const [link, setLink] = useState<{
    url: string;
    expiresAt: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  async function refresh() {
    const result = await api<{ users: AppUser[] }>("/users");
    setUsers(result.users);
  }
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, []);
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        user: AppUser;
        activationUrl: string;
        expiresAt: string;
      }>("/users", {
        method: "POST",
        body: { name: name.trim(), login: login.trim(), role },
      });
      setLink({
        url: result.activationUrl,
        expiresAt: result.expiresAt,
        name: result.user.name,
      });
      setCopied(false);
      setName("");
      setLogin("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reset(person: AppUser) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        activationUrl?: string;
        resetUrl?: string;
        expiresAt: string;
      }>(`/users/${person.id}/reset`, { method: "POST", body: {} });
      setLink({
        url: result.activationUrl ?? result.resetUrl ?? "",
        expiresAt: result.expiresAt,
        name: person.name,
      });
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(person: AppUser) {
    if (
      !window.confirm(
        `${person.active ? "Desativar" : "Reativar"} o acesso de ${person.name}?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`/users/${person.id}`, {
        method: "PATCH",
        body: { active: !person.active },
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">ACESSOS</span>
      <h1>Equipe e permissões</h1>
      <p>
        Cada pessoa deve usar seu próprio acesso. Operadores registram entradas;
        gestores também acompanham os números e administram a equipe.
      </p>
      {error && (
        <p role="alert" className="p-error">
          {error}
        </p>
      )}
      {link && (
        <section className="p-panel p-notice">
          <h2>Link para {link.name}</h2>
          <p>
            Entregue diretamente à pessoa. O link é de uso único e expira em{" "}
            {new Date(link.expiresAt).toLocaleString("pt-BR")}.
          </p>
          <label>
            Link de acesso
            <input
              readOnly
              value={link.url}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button
            disabled={!link.url}
            onClick={() => {
              void navigator.clipboard
                .writeText(link.url)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? "Link copiado" : "Copiar link"}
          </button>
        </section>
      )}
      <section className="p-panel">
        <h2>Cadastrar pessoa</h2>
        <form onSubmit={create} className="p-stack">
          <label>
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              required
              maxLength={120}
            />
          </label>
          <label>
            Usuário
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Ex.: caixa.joao"
              required
              minLength={3}
              maxLength={60}
            />
          </label>
          <label>
            Perfil
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              <option value="operador">Operador</option>
              <option value="gestor">Gestor</option>
            </select>
          </label>
          <button className="p-primary" disabled={busy}>
            {busy ? "Salvando…" : "Cadastrar e gerar link"}
          </button>
        </form>
      </section>
      <section className="p-panel">
        <h2>Pessoas cadastradas</h2>
        <div className="p-list">
          {users.map((person) => (
            <div className="p-user-row" key={person.id}>
              <div>
                <b>{person.name}</b>
                <small>
                  {person.login} ·{" "}
                  {person.role === "gestor" ? "Gestor" : "Operador"} ·{" "}
                  {person.active ? "Ativo" : "Desativado"}
                </small>
              </div>
              <div className="p-actions">
                <button
                  disabled={busy || !person.active}
                  onClick={() => void reset(person)}
                >
                  Redefinir senha
                </button>
                <button
                  disabled={busy || person.id === user!.id}
                  onClick={() => void toggle(person)}
                >
                  {person.active ? "Desativar" : "Reativar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
export function Account() {
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm)
      return setError("As novas senhas precisam ser iguais.");
    setBusy(true);
    setError("");
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: { currentPassword, password },
      });
      setCurrent("");
      setPassword("");
      setConfirm("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Minha conta</h1>
      <p>
        {user!.name} · {user!.login}
      </p>
      <section className="p-panel">
        <h2>Alterar senha</h2>
        <p>Após a alteração, entre novamente com a nova senha.</p>
        <form onSubmit={submit} className="p-stack">
          <label>
            Senha atual
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label>
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={15}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Repita a nova senha
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={15}
              maxLength={128}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <p className="p-muted">Use de 15 a 128 caracteres.</p>
          {error && (
            <p role="alert" className="p-error">
              {error}
            </p>
          )}
          <button className="p-primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      </section>
    </>
  );
}
