export const formatCurrency = (amount, currency = "FCFA") =>
  `${Number(amount || 0).toLocaleString("fr-FR")} ${currency}`

// 176 189 500 -> "176,2 M" : évite les montants tronqués dans les cartes et axes de graphiques.
export const formatCompact = (amount) => {
  const value = Number(amount || 0)
  const abs = Math.abs(value)
  const fmt = (n, unit) => `${n.toFixed(1).replace(".", ",").replace(",0", "")} ${unit}`
  if (abs >= 1e9) return fmt(value / 1e9, "Md")
  if (abs >= 1e6) return fmt(value / 1e6, "M")
  if (abs >= 1e3) return `${Math.round(value / 1e3)} k`
  return String(Math.round(value))
}

export const formatCompactCurrency = (amount) => `${formatCompact(amount)} FCFA`

export const formatDate = (dateStr, opts = {}) =>
  new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric", ...opts
  })

export const formatDateTime = (dateStr) =>
  new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  })

export const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return "À l instant"
  if (diff < 3600) return `Il y a ${Math.floor(diff/60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff/3600)}h`
  return formatDate(dateStr)
}

// Texte lisible : aucune valeur technique avec "_" n'est affichée (remplacée par "-")
export const cleanLabel = (value) => {
  const text = String(value ?? "").replace(/_/g, "-")
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "-"
}

export const formatPercent = (val) => `${Number(val || 0).toFixed(1)}%`

export const truncate = (str, max = 50) =>
  str && str.length > max ? str.slice(0, max) + "…" : str
