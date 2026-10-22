export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
let csrfToken = "";
export function setCsrf(value: string) {
  csrfToken = value;
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      signal: options.signal,
      headers: {
        Accept: "application/json",
        ...(method !== "GET"
          ? { "Content-Type": "application/json", "x-csrf-token": csrfToken }
          : {}),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      0,
      "Sem conexão com o sistema. Seu preenchimento permanece neste aparelho.",
    );
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (
      response.status === 401 &&
      path !== "/auth/login" &&
      path !== "/auth/session"
    )
      window.dispatchEvent(new Event("danielli-session-expired"));
    throw new ApiError(
      response.status,
      payload.error?.message ??
        payload.message ??
        (response.status === 503
          ? "O sistema ainda precisa ser configurado. Tente novamente em instantes."
          : response.status === 409
            ? "Este registro foi alterado. Consulte a versão atual antes de confirmar."
            : "Não foi possível concluir. Tente novamente."),
      payload.error?.code ?? payload.code,
    );
  }
  return payload as T;
}
