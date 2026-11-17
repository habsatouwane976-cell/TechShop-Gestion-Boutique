import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import {
  User, ClipboardList, ShoppingCart, LogOut, CheckCircle2, AlertCircle, Download, Package,
} from "lucide-react"
import toast from "react-hot-toast"

import StoreHeader from "../../components/store/StoreHeader"
import StoreFooter from "../../components/store/StoreFooter"
import { logoutUser } from "../../store/slices/authSlice"
import { salesService } from "../../services/salesService"
import { SALE_STATUS, PAYMENT_METHODS } from "../../utils/constants"
import { cleanLabel } from "../../utils/formatters"

const formatPrice = price =>
  new Intl.NumberFormat("fr-FR").format(Number(price || 0))

const formatDate = value =>
  new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-[#75757a]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-[#313133]">{value || "Non renseigné"}</dd>
    </div>
  )
}

// Espace client : visible uniquement une fois connecté
export default function ClientDashboard() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useSelector(state => state.auth)

  const section = searchParams.get("section") === "orders" ? "orders" : "account"

  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    let active = true

    salesService
      .getAll()
      .then(res => {
        if (active) setOrders(res.data.results || res.data || [])
      })
      .catch(() => {
        if (active) setOrders([])
      })
      .finally(() => {
        if (active) setLoadingOrders(false)
      })

    return () => { active = false }
  }, [])

  const handleLogout = () => {
    dispatch(logoutUser())
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    navigate("/", { replace: true })
  }

  const downloadInvoice = async order => {
    try {
      const res = await salesService.getPdf(order.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }))
      const link = document.createElement("a")
      link.href = url
      link.download = `facture_${order.invoice_number}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Impossible de télécharger la facture")
    }
  }

  const navItem = (key, label, Icon) => (
    <button
      type="button"
      onClick={() => setSearchParams(key === "account" ? {} : { section: key })}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-[#f5f5f5] ${
        section === key ? "font-semibold text-[#f68b1e]" : "text-[#313133]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5] font-['Inter',sans-serif] text-[#313133]">
      <StoreHeader showSearch={false} />

      <main className="mx-auto grid w-full max-w-[1200px] flex-1 gap-4 px-4 py-4 md:grid-cols-[240px_1fr]">
        {/* Menu de l'espace client */}
        <aside className="h-fit overflow-hidden rounded-lg bg-white">
          <p className="border-b border-[#ededed] px-4 py-3 font-['Ubuntu',sans-serif] text-base font-bold">
            Mon espace client
          </p>
          {navItem("account", "Mon compte", User)}
          {navItem("orders", "Mes commandes", ClipboardList)}
          <Link
            to="/client/cart"
            className="flex items-center gap-3 px-4 py-3 text-sm text-[#313133] transition hover:bg-[#f5f5f5]"
          >
            <ShoppingCart className="h-4 w-4" />
            Mon panier
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 border-t border-[#ededed] px-4 py-3 text-left text-sm font-semibold text-[#f68b1e] transition hover:bg-[#f5f5f5]"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </aside>

        {/* Contenu */}
        <section className="rounded-lg bg-white">
          {section === "account" ? (
            <>
              <div className="border-b border-[#ededed] px-5 py-4">
                <h1 className="font-['Ubuntu',sans-serif] text-lg font-bold">
                  Bienvenue {user?.first_name || user?.username || "Client"}
                </h1>
                <p className="mt-1 text-sm text-[#75757a]">
                  Retrouvez ici vos informations et le suivi de vos commandes.
                </p>
              </div>

              <div className="p-5">
                <div
                  className={`mb-5 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    user?.email_verified === false
                      ? "bg-[#fff4e5] text-[#9a5200]"
                      : "bg-[#e9f7ef] text-[#1e7d46]"
                  }`}
                >
                  {user?.email_verified === false ? (
                    <>
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      E-mail non confirmé : ouvrez le lien reçu dans votre boîte mail.
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Adresse e-mail confirmée
                    </>
                  )}
                </div>

                <dl className="grid gap-5 sm:grid-cols-2">
                  <Info label="Nom complet" value={user?.full_name} />
                  <Info label="Adresse e-mail" value={user?.email} />
                  <Info label="Téléphone" value={user?.phone} />
                  <Info label="Adresse" value={user?.location_address} />
                  <Info
                    label="Client depuis"
                    value={user?.created_at ? formatDate(user.created_at) : ""}
                  />
                  <Info label="Commandes passées" value={loadingOrders ? "..." : String(orders.length)} />
                </dl>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/client/products"
                    className="rounded bg-[#f68b1e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e07b0e]"
                  >
                    Voir le catalogue
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSearchParams({ section: "orders" })}
                    className="rounded border border-[#d7d7da] px-5 py-2.5 text-sm font-semibold text-[#313133] transition hover:border-[#f68b1e]"
                  >
                    Mes commandes
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-[#ededed] px-5 py-4">
                <h1 className="font-['Ubuntu',sans-serif] text-lg font-bold">Mes commandes</h1>
              </div>

              {loadingOrders ? (
                <p className="p-8 text-center text-sm text-[#75757a]">Chargement...</p>
              ) : orders.length === 0 ? (
                <div className="p-12 text-center">
                  <Package className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-sm text-[#75757a]">Vous n'avez pas encore passé de commande.</p>
                  <Link
                    to="/client/products"
                    className="mt-4 inline-block rounded bg-[#f68b1e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e07b0e]"
                  >
                    Découvrir les produits
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-[#ededed]">
                  {orders.map(order => {
                    const status = SALE_STATUS[order.status]
                    const payment = PAYMENT_METHODS[order.payment_method]

                    return (
                      <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{order.invoice_number}</p>
                          <p className="mt-0.5 text-xs text-[#75757a]">
                            {formatDate(order.created_at)}
                            {payment ? `, ${payment.label}` : ""}
                          </p>
                          <p className="mt-1 truncate text-xs text-[#55555a]">
                            {(order.items || []).map(item => `${item.quantity} x ${item.product_name}`).join(", ")}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status?.color || "bg-gray-100 text-gray-800"}`}>
                            {status?.label || cleanLabel(order.status)}
                          </span>
                          <span className="text-sm font-bold">{formatPrice(order.total_amount)} FCFA</span>
                          {order.status === "completed" && (
                            <button
                              type="button"
                              onClick={() => downloadInvoice(order)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-[#f68b1e] hover:underline"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Facture
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      </main>

      <StoreFooter />
    </div>
  )
}
