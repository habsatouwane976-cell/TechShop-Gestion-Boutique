import { useState, useEffect } from "react"
import { reportsService } from "../../services/reportsService"
import LoadingSpinner from "../../components/common/LoadingSpinner"
import PageHeader from "../../components/common/PageHeader"
import { formatCurrency, formatPercent, cleanLabel } from "../../utils/formatters"
import { PAYMENT_METHODS } from "../../utils/constants"
import { Download, BarChart3, TrendingUp, FileSpreadsheet } from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts"
import toast from "react-hot-toast"

export default function Reports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState("month")
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [exporting, setExporting] = useState(false)

  const fetchReport = () => {
    setLoading(true)
    reportsService.getSalesReport({ period, year, month })
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchReport() }, [period, year, month])

  const handleExport = async (type) => {
    setExporting(true)
    try {
      const res = await reportsService.exportExcel({ type, period, year, month })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement("a")
      a.href = url
      a.download = `rapport_${type}_${period}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Export téléchargé !")
    } catch { toast.error("Erreur lors de l export") }
    finally { setExporting(false) }
  }

  const PERIODS = [
    { value: "today", label: "Aujourd hui" },
    { value: "yesterday", label: "Hier" },
    { value: "week", label: "Cette semaine" },
    { value: "last7", label: "7 derniers jours" },
    { value: "month", label: "Ce mois" },
    { value: "last30", label: "30 derniers jours" },
    { value: "year", label: "Cette année" },
  ]

  const MONTHS = [
    "Janvier","Février","Mars","Avril","Mai","Juin",
    "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports & Analyses"
        subtitle="Analyses détaillées de votre activité commerciale"
        actions={
          <div className="flex space-x-2">
            <button onClick={() => handleExport("sales")} disabled={exporting}
              className="btn-success btn-sm">
              <FileSpreadsheet className="w-4 h-4" />
              {exporting ? "Export…" : "Export Ventes"}
            </button>
            <button onClick={() => handleExport("stock")} disabled={exporting}
              className="btn-primary btn-sm">
              <Download className="w-4 h-4" />
              Export Stock
            </button>
          </div>
        }
      />

      {/* Period filters */}
      <div className="card py-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Période</label>
            <select value={period} onChange={e => setPeriod(e.target.value)} className="input w-auto text-sm">
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {period === "year" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Année</label>
              <select value={year} onChange={e => setYear(e.target.value)} className="input w-auto text-sm">
                {[2022,2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          {period === "month" && (
            <div className="flex space-x-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Mois</label>
                <select value={month} onChange={e => setMonth(e.target.value)} className="input w-auto text-sm">
                  {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Année</label>
                <select value={year} onChange={e => setYear(e.target.value)} className="input w-auto text-sm">
                  {[2022,2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? <LoadingSpinner text="Génération du rapport…" /> : !data ? null : (
        <>
          {/* KPI Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Ventes", value: data.summary.count, color: "text-primary-700" },
              { label: "Chiffre d affaires", value: formatCurrency(data.summary.revenue), color: "text-emerald-600" },
              { label: "Bénéfices", value: formatCurrency(data.summary.profit), color: "text-emerald-600" },
              { label: "Coût des ventes", value: formatCurrency(data.summary.cost), color: "text-red-600" },
              { label: "Panier moyen", value: formatCurrency(data.summary.avg_basket), color: "text-blue-600" },
              { label: "Taux de marge", value: formatPercent(data.summary.margin_rate), color: "text-purple-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="card text-center py-4">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          {data.daily.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-5 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                <span>Évolution journalière - {data.start_date} au {data.end_date}</span>
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data.daily}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => [formatCurrency(v)]} contentStyle={{ borderRadius:"8px" }} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="CA" stroke="#1d4ed8" strokeWidth={2} fill="url(#revGrad)" />
                  <Area type="monotone" dataKey="profit" name="Bénéfice" stroke="#059669" strokeWidth={2} fill="url(#profGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top products */}
            {data.top_products.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-gray-800 mb-4">Top Produits</h2>
                <div className="space-y-2">
                  {data.top_products.slice(0,8).map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {i+1}
                        </span>
                        <span className="text-sm font-medium text-gray-800 truncate max-w-48">{p.product_name}</span>
                      </div>
                      <div className="text-right ml-2">
                        <span className="badge bg-primary-100 text-primary-700">{p.qty} vendus</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By payment method */}
            {data.by_payment.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-gray-800 mb-4">Par Mode de Paiement</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.by_payment.map(p => ({
                    ...p,
                    label: PAYMENT_METHODS[p.payment_method]?.label || cleanLabel(p.payment_method)
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={v => [formatCurrency(v),"CA"]} contentStyle={{ borderRadius:"8px" }} />
                    <Bar dataKey="total" name="CA" fill="#1d4ed8" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
