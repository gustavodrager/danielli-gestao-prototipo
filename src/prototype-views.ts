export const prototypeViews = [
  {
    id: "gestor",
    name: "Visão geral",
    description: "Indicadores e detalhamentos",
    path: "/",
    profile: "gestor",
    icon: "home",
  },
  {
    id: "vendas",
    name: "Caixa",
    description: "Recebimentos por unidade de negócio",
    path: "/caixa/vendas",
    profile: "caixa",
    icon: "cash",
  },
  {
    id: "cmv",
    name: "Compras (CMV)",
    description: "Entrada de compras gerais",
    path: "/compras/cmv",
    profile: "compras",
    icon: "document",
  },
] as const;
export type PrototypeProfile = "gestor" | "caixa" | "compras";
export function currentPrototypeView(
  pathname: string,
  profile: PrototypeProfile,
) {
  if (pathname.startsWith("/compras/cmv")) return "cmv";
  if (pathname === "/caixa/vendas") return "vendas";
  if (pathname.startsWith("/caixa")) return "vendas";
  if (pathname === "/")
    return profile === "caixa"
      ? "vendas"
      : profile === "compras"
        ? "cmv"
        : "gestor";
  if (
    pathname.startsWith("/indicadores") ||
    pathname.startsWith("/lancamentos")
  )
    return "gestor";
  return null;
}
