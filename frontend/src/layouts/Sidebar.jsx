import logo from "../assets/logo.png"
import { Link, useLocation } from "react-router-dom"
import { useSelector, useDispatch } from "react-redux"
import { useAuth } from "../hooks/useAuth"
import { setSidebarCollapsed } from "../store/slices/uiSlice"
import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck,
  Warehouse, BarChart3, Store, ArrowLeftCircle,
  ChevronLeft, ChevronRight, FileText, UserCog, Map
} from "lucide-react"

const ALL_LINKS = [
  { to: "/dashboard",   icon: LayoutDashboard, label: "Tableau de Bord", roles: ["admin","manager","cashier"] },
  { to: "/products",    icon: Package,          label: "Produits",        roles: ["admin","manager"] },
  { to: "/sales",       icon: ShoppingCart,     label: "Ventes",          roles: ["admin","manager","cashier"] },
  { to: "/sales/new",   icon: ShoppingCart,     label: "Nouvelle Vente",  roles: ["cashier"] },
  { to: "/customers",   icon: Users,            label: "Clients",         roles: ["admin","manager"] },
  { to: "/suppliers",   icon: Truck,            label: "Fournisseurs",    roles: ["admin","manager"] },
  { to: "/inventory",   icon: Warehouse,        label: "Stock",           roles: ["admin","manager"] },
  { to: "/reports",     icon: BarChart3,        label: "Rapports",        roles: ["admin","manager"] },
  { to: "/map",         icon: Map,              label: "Carte",           roles: ["admin","manager","cashier"] },
  { to: "/activity",    icon: FileText,         label: "Journal",         roles: ["admin"] },
  { to: "/users",       icon: UserCog,          label: "Utilisateurs",    roles: ["admin"] },
]

export default function Sidebar({ mobile = false, onClose }) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const dispatch = useDispatch()
  const { sidebarCollapsed } = useSelector(s => s.ui)

  const links = ALL_LINKS.filter(l => l.roles.includes(user?.role))
  const collapsed = !mobile && sidebarCollapsed

  return (
    <aside className={`
      flex flex-col h-full bg-white text-gray-700 border-r border-gray-200 transition-all duration-300
      ${collapsed ? "w-16" : "w-64"}
      ${mobile ? "w-72" : ""}
    `}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2 w-full">
            <img src={logo} alt="" className="w-10 h-10 rounded-xl object-contain shrink-0" />
            <div className="leading-tight">
              <p className="font-extrabold text-gray-900 text-sm">
                Tech<span className="text-accent-600">Shop</span>
              </p>
              <p className="text-[9px] tracking-widest text-gray-400 -mt-0.5">ELECTRONICS</p>
            </div>
          </Link>
        )}
        {collapsed && (
          <img src={logo} alt="TechShop" className="h-9 w-9 rounded-lg object-contain mx-auto" />
        )}
        {!mobile && (
          <button
            onClick={() => dispatch(setSidebarCollapsed(!sidebarCollapsed))}
            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700"
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <ChevronLeft className="w-4 h-4" />
            }
          </button>
        )}
      </div>

      {/* Retour à la boutique */}
      <div className="px-2 pt-3">
        <Link
          to="/"
          onClick={mobile ? onClose : undefined}
          title={collapsed ? "Retour à la boutique" : undefined}
          className={`
            flex items-center rounded-lg border border-accent-200 bg-accent-50 text-accent-700
            hover:bg-accent-100 transition-all duration-150
            ${collapsed ? "justify-center p-3" : "space-x-3 px-3 py-2.5"}
          `}
        >
          <ArrowLeftCircle className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-semibold">Retour à la boutique</span>}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {links.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to))
          return (
            <Link
              key={to} to={to}
              onClick={mobile ? onClose : undefined}
              title={collapsed ? label : undefined}
              className={`
                flex items-center rounded-lg transition-all duration-150
                ${collapsed ? "justify-center p-3" : "space-x-3 px-3 py-2.5"}
                ${active
                  ? "bg-accent-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }
              `}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      {!collapsed && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-accent-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
