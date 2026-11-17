import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { reportsService } from "../../services/reportsService"
import StatCard from "../../components/common/StatCard"
import { DashboardSkeleton } from "../../components/common/Skeleton"
import { StaggerGroup, StaggerItem } from "../../components/motion/Stagger"
import { formatCurrency, formatCompact, formatCompactCurrency } from "../../utils/formatters"
import { useAuth } from "../../hooks/useAuth"
import PageHeader from "../../components/common/PageHeader"
import {
  ShoppingCart, TrendingUp, Package, Users,
  AlertTriangle, DollarSign, BarChart3, ArrowRight
} from "lucide-react"
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area
} from "recharts"

const COLORS = ["#1d4ed8","#059669","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#10b981"]

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user, isManager } = useAuth()

  useEffect(() => {
    reportsService.getDashboard()
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardSkeleton />
  if (!data) return null

  const { today, month, totals, sales_evolution, monthly_evolution, top_products, category_sales, low_stock_alerts } = data

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour, ${user?.first_name} 👋`}
        subtitle="Voici le résumé de votre activité commerciale"
      />

      {/* KPI Cards */}
      <StaggerGroup className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Ventes du jour" numericValue={today.sales_count}
          subtitle={formatCurrency(today.revenue)} icon={ShoppingCart} color="blue" />
        <StatCard title="CA du jour" numericValue={today.revenue} format={formatCurrency}
          subtitle={`Bénéfice: ${formatCurrency(today.profit)}`} icon={DollarSign} color="green" />
        <StatCard title="CA du mois" numericValue={month.revenue} format={formatCompactCurrency}
          subtitle={`${month.sales_count} ventes`} icon={TrendingUp} color="purple" />
        <StatCard title="Bénéfice mois" numericValue={month.profit} format={formatCompactCurrency}
          icon={BarChart3} color="orange" />
      </StaggerGroup>

      <StaggerGroup className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Produits" numericValue={totals.products}
          icon={Package} color="teal" />
        <StatCard title="Total Clients" numericValue={totals.customers}
          icon={Users} color="blue" />
        <StatCard title="CA Global" numericValue={totals.all_time_revenue} format={formatCompactCurrency}
          icon={DollarSign} color="green" />
        <StatCard title="Alertes Stock" numericValue={totals.low_stock_alerts}
          subtitle={totals.low_stock_alerts > 0 ? "Produits en stock bas" : "Stocks OK ✓"}
          icon={AlertTriangle} color={totals.low_stock_alerts > 0 ? "red" : "green"} />
      </StaggerGroup>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution mensuelle */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-5 flex items-center justify-between">
            Évolution du CA (12 mois)
            <Link to="/reports" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              Détails <ArrowRight className="w-3 h-3" />
            </Link>
          </h2>
          {monthly_evolution.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthly_evolution}>
                <defs>
                  <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCompact} />
                <Tooltip formatter={v => [formatCurrency(v)]} contentStyle={{ borderRadius:"8px", border:"1px solid #e5e7eb" }} />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="CA" stroke="#1d4ed8" strokeWidth={2} fill="url(#colorCA)" />
                <Area type="monotone" dataKey="profit" name="Bénéfice" stroke="#059669" strokeWidth={2} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-12 text-gray-300">Aucune donnée</p>}
        </div>

        {/* Évolution 7 jours */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-5">Ventes - 7 derniers jours</h2>
          {sales_evolution.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sales_evolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCompact} />
                <Tooltip formatter={v => [formatCurrency(v),"CA"]} contentStyle={{ borderRadius:"8px" }} />
                <Bar dataKey="revenue" name="CA" fill="#1d4ed8" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-12 text-gray-300">Aucune vente récente</p>}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top produits */}
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-gray-800 mb-5">Top 10 Produits Vendus</h2>
          {top_products.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top_products.slice(0,8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="product_name" width={140} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius:"8px" }} />
                <Bar dataKey="total_qty" name="Quantité" fill="#1d4ed8" radius={[0,6,6,0]}>
                  {top_products.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-12 text-gray-300">Aucune vente</p>}
        </div>

        {/* Répartition catégories */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-5">Catégories</h2>
          {category_sales.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={category_sales} cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="total">
                  {category_sales.map((entry, i) => (
                    <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => [formatCurrency(v),"CA"]} contentStyle={{ borderRadius:"8px" }} />
                <Legend formatter={v => v} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-12 text-gray-300">Aucune donnée</p>}
        </div>
      </div>

      {/* Low stock alerts */}
      {low_stock_alerts.length > 0 && (
        <div className="card border-l-4 border-orange-400">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h2 className="font-semibold text-gray-800">Alertes de Stock</h2>
              <span className="badge bg-orange-100 text-orange-700">{low_stock_alerts.length}</span>
            </div>
            <Link to="/inventory" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              Gérer <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {low_stock_alerts.slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center justify-between bg-orange-50 rounded-lg p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.reference}</p>
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                  <p className={`font-bold text-sm ${p.quantity === 0 ? "text-red-600" : "text-orange-600"}`}>
                    {p.quantity === 0 ? "Rupture" : p.quantity}
                  </p>
                  <p className="text-xs text-gray-400">Min: {p.min_stock}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
