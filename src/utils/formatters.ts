export const formatRupiah = (val: number | string | undefined | null): string => {
  if (val === "" || val === null || val === undefined || val === "-") return "—";
  const n = Number(val);
  if (isNaN(n)) return "—";
  if (n === 0) return "Rp0";
  return "Rp" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const formatPercent = (val: number | string | undefined | null): string => {
  if (val === "" || val === null || val === undefined || val === "-") return "—";
  let n = Number(val);
  if (isNaN(n)) return "—";
  // If the number is a decimal representation (e.g. 0.025 for 2.5% vs 2.5)
  // Usually Yahoo quote regularMarketChangePercent is already percentage e.g. -1.17
  // If |n| < 0.001 and n != 0, it might be 0.0005, format safely
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

export const formatPercentRaw = (val: number | string | undefined | null): string => {
  return formatPercent(val);
};

export const formatX = (val: number | string | undefined | null): string => {
  if (val === "" || val === null || val === undefined || val === "-") return "—";
  const n = Number(val);
  if (isNaN(n) || n <= 0) return "—";
  return n.toFixed(2) + "x";
};

export const formatVolume = (val: number | string | undefined | null): string => {
  if (val === "" || val === null || val === undefined || val === "-") return "—";
  const n = Number(val);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + " B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + " M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + " K";
  return n.toString();
};
