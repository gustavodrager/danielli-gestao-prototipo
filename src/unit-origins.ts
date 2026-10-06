// Correspondências confirmadas pelo usuário; identificam receita, sem rateio.
export const confirmedUnitOrigins = [
  { id: "buffet", name: "Buffet", original: "Almoço" },
  { id: "marmita", name: "Marmita", original: "Marmitex" },
  { id: "vitrine", name: "Vitrine", original: "Lojista" },
] as const;
export type RealUnit = (typeof confirmedUnitOrigins)[number]["id"];
