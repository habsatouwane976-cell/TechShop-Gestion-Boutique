import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { salesService } from "../../services/salesService"
import { useAuth } from "../../hooks/useAuth"
import PageHeader from "../../components/common/PageHeader"
import SearchInput from "../../components/common/SearchInput"
import LoadingSpinner from "../../components/common/LoadingSpinner"
import StatusBadge from "../../components/common/StatusBadge"
import Pagination from "../../components/common/Pagination"
import EmptyState from "../../components/common/EmptyState"
import { formatCurrency, formatDateTime, cleanLabel } from "../../utils/formatters"
import { PAYMENT_METHODS } from "../../utils/constants"
import { Plus, FileText, Download, ShoppingCart, Eye, X } from "lucide-react"
import toast from "react-hot-toast"

export default function Sales() {
  const { isAdmin } = useAuth()
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [viewSale, setViewSale] = useState(null)

  useEffect(() => {
    setLoading(true)
    const params = { page, search }
    if (status) params.status = status
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    salesService.getAll(params)
      .then(r => {
        const d = r.data
        if (d.results) { setSales(d.results); setTotal(d.count) }
        else { setSales(d); setTotal(d.length) }
      }).finally(() => setLoading(false))
  }, [page, search, status, dateFrom, dateTo])

  const handleDownloadPdf = async (id, invoiceNum) => {
    try {
      
   
      const res = await salesService.getPdf(id)
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }))
      const a = document.createElement("a")
      a.href = url; a.download = `facture_${invoiceNum}.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast.success("Facture téléchargée !")
    } catch { toast.error("Erreur lors du téléchargement") }
  }

const handleApprove = async (id) => {
  try {
    await salesService.approve(id)

    toast.success("Commande approuvée avec succès !")

    setSales((sales) =>
      sales.map((s) =>
        s.id === id
          ? { ...s, status: "completed" }
          : s
      )
    )
  } catch (error) {
    toast.error("Impossible d'approuver la commande")
    console.error(error)
  }
}
  return (
    <div className="space-y-6">
      <PageHeader
        title="Historique des Ventes"
        subtitle={`${total} vente(s) au total`}
        actions={
          <Link to="/sales/new" className="btn-primary">
            <Plus className="w-4 h-4" /> Nouvelle vente
          </Link>
        }
      />

      {/* Filters */}
      <div className="card py-4">
        <div className="flex flex-wrap gap-3 items-end">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Rechercher N° facture, client…" className="w-56" />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="input w-auto text-sm">
              <option value="">Tous</option>
              <option value="completed">Complétée</option>
              <option value="pending">En attente</option>
              <option value="cancelled">Annulée</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Du</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input text-sm w-36" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Au</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input text-sm w-36" />
          </div>
          {(dateFrom || dateTo || status) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); setStatus("") }}
              className="btn-ghost text-sm py-2 text-gray-500">
              <X className="w-4 h-4" /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : sales.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="Aucune vente trouvée"
          action={<Link to="/sales/new" className="btn-primary"><Plus className="w-4 h-4" />Nouvelle vente</Link>} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                {["N° Facture","Date","Client","Caissier","Mode Paiement","Total","Bénéfice","Statut","Actions"].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {sales.map(s => (
                <tr key={s.id}>
                  <td className="font-mono text-xs font-semibold text-primary-700">{s.invoice_number}</td>
                  <td className="text-xs text-gray-500">{formatDateTime(s.created_at)}</td>
                  <td className="font-medium">{s.customer_name || <span className="text-gray-400 italic">Anonyme</span>}</td>
                  <td className="text-sm text-gray-600">{s.cashier_name}</td>
                  <td>
                    <span className="text-sm">
                      {PAYMENT_METHODS[s.payment_method]?.icon} {PAYMENT_METHODS[s.payment_method]?.label || cleanLabel(s.payment_method)}
                    </span>
                  </td>
                  <td className="font-bold text-gray-900">{formatCurrency(s.total_amount)}</td>
                  <td className="font-semibold text-emerald-600">{formatCurrency(s.profit)}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    <div className="flex space-x-1">
                      <button onClick={() => setViewSale(s)}
                        className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg" title="Voir">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDownloadPdf(s.id, s.invoice_number)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="PDF">
                        <Download className="w-4 h-4" />
                      </button>

                        {s.status === "pending" && (
                          <button
                            onClick={() => handleApprove(s.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Approuver"
                          >
                            ✔
                           </button>
                         )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={Math.ceil(total/20)} onPageChange={setPage} total={total} perPage={20} />
          </div>
        </div>
      )}

      {/* View Sale Modal */}
      {viewSale && (
        <div className="modal-overlay" onClick={() => setViewSale(null)}>
          <div className="modal max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="font-bold text-lg">Facture {viewSale.invoice_number}</h2>
                <p className="text-xs text-gray-400">{formatDateTime(viewSale.created_at)}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => handleDownloadPdf(viewSale.id, viewSale.invoice_number)}
                  className="btn-success btn-sm"><Download className="w-3.5 h-3.5" /> PDF</button>
                <button onClick={() => setViewSale(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Client</p>
                  <p className="font-medium">{viewSale.customer_name || "Client anonyme"}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Caissier</p>
                  <p className="font-medium">{viewSale.cashier_name}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Paiement</p>
                  <p className="font-medium">
                    {PAYMENT_METHODS[viewSale.payment_method]?.icon} {PAYMENT_METHODS[viewSale.payment_method]?.label}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Statut</p>
                  <StatusBadge status={viewSale.status} />
                </div>
              </div>
              <table className="w-full text-sm border-t pt-3">
                <thead>
                  <tr className="text-gray-500 text-xs border-b">
                    <th className="text-left py-2">Produit</th>
                    <th className="text-center py-2">Qté</th>
                    <th className="text-right py-2">P.U</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewSale.items?.map(item => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-2 font-medium">{item.product_name}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="py-2 text-right font-semibold">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600"><span>Sous-total HT</span><span>{formatCurrency(viewSale.subtotal)}</span></div>
                {Number(viewSale.discount_amount) > 0 && (
                  <div className="flex justify-between text-red-500"><span>Remise ({viewSale.discount_percent}%)</span><span>- {formatCurrency(viewSale.discount_amount)}</span></div>
                )}
                <div className="flex justify-between text-gray-600"><span>TVA ({viewSale.tax_rate}%)</span><span>{formatCurrency(viewSale.tax_amount)}</span></div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>TOTAL TTC</span><span className="text-primary-700">{formatCurrency(viewSale.total_amount)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Bénéfice</span><span>{formatCurrency(viewSale.profit)}</span>
                </div>
                {Number(viewSale.amount_paid) > 0 && (
                  <>
                    <div className="flex justify-between text-gray-600 border-t pt-1.5"><span>Reçu</span><span>{formatCurrency(viewSale.amount_paid)}</span></div>
                    <div className="flex justify-between text-gray-600"><span>Monnaie rendue</span><span>{formatCurrency(viewSale.change_amount)}</span></div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
