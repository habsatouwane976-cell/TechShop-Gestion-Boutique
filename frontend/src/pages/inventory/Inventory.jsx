import { useState, useEffect } from "react"
import { inventoryService } from "../../services/inventoryService"
import { productsService } from "../../services/productsService"
import { suppliersService } from "../../services/suppliersService"
import { useAuth } from "../../hooks/useAuth"
import PageHeader from "../../components/common/PageHeader"
import LoadingSpinner from "../../components/common/LoadingSpinner"
import EmptyState from "../../components/common/EmptyState"
import Pagination from "../../components/common/Pagination"
import { formatCurrency, formatDateTime } from "../../utils/formatters"
import { MOVEMENT_TYPES } from "../../utils/constants"
import { Warehouse, ArrowDownCircle, ArrowUpCircle, RefreshCw, X, Package } from "lucide-react"
import toast from "react-hot-toast"

export default function Inventory() {
  const { canManage } = useAuth()
  const [movements, setMovements] = useState([])
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    product_id: "", movement_type: "in", quantity: 1,
    unit_price: 0, notes: "", supplier_id: ""
  })
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("movements")

  const fetchMovements = () => {
    setLoading(true)
    inventoryService.getMovements({ page })
      .then(r => {
        const d = r.data
        if (d.results) { setMovements(d.results); setTotal(d.count) }
        else { setMovements(d); setTotal(d.length) }
      }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchMovements() }, [page])
  useEffect(() => {
    productsService.getAll({ page_size: 200 }).then(r => setProducts(r.data.results || r.data))
    suppliersService.getAll({ page_size: 100 }).then(r => setSuppliers(r.data.results || r.data))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.product_id) return toast.error("Sélectionnez un produit")
    setSubmitting(true)
    try {
      await inventoryService.adjust({
        product_id: parseInt(form.product_id),
        movement_type: form.movement_type,
        quantity: parseInt(form.quantity),
        unit_price: parseFloat(form.unit_price) || 0,
        notes: form.notes,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
      })
      toast.success("Mouvement enregistré !")
      setShowModal(false)
      setForm({ product_id: "", movement_type: "in", quantity: 1, unit_price: 0, notes: "", supplier_id: "" })
      fetchMovements()
    } catch (err) {
      toast.error(err.response?.data?.error || "Erreur")
    } finally { setSubmitting(false) }
  }

  const MOVEMENT_ICONS = {
    in: <ArrowDownCircle className="w-4 h-4 text-green-500" />,
    out: <ArrowUpCircle className="w-4 h-4 text-red-500" />,
    adjustment: <RefreshCw className="w-4 h-4 text-blue-500" />,
    return: <ArrowUpCircle className="w-4 h-4 text-orange-500" />,
    loss: <ArrowUpCircle className="w-4 h-4 text-red-700" />,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion du Stock"
        subtitle="Mouvements et approvisionnements"
        actions={canManage && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Warehouse className="w-4 h-4" /> Nouveau mouvement
          </button>
        )}
      />

      {/* Stats rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Entrées", icon: <ArrowDownCircle className="w-5 h-5 text-green-500" />, color: "bg-green-50 border-green-200" },
          { label: "Sorties", icon: <ArrowUpCircle className="w-5 h-5 text-red-500" />, color: "bg-red-50 border-red-200" },
          { label: "Ajustements", icon: <RefreshCw className="w-5 h-5 text-blue-500" />, color: "bg-blue-50 border-blue-200" },
          { label: "Total mouvements", icon: <Warehouse className="w-5 h-5 text-purple-500" />, color: "bg-purple-50 border-purple-200" },
        ].map(s => (
          <div key={s.label} className={`card border ${s.color} flex items-center space-x-3 py-4`}>
            <div className="p-2 rounded-lg bg-white">{s.icon}</div>
            <div>
              <p className="text-sm font-medium text-gray-700">{s.label}</p>
              <p className="text-lg font-bold text-gray-900">
                {s.label === "Total mouvements" ? total
                  : movements.filter(m => {
                    if (s.label === "Entrées") return m.movement_type === "in"
                    if (s.label === "Sorties") return m.movement_type === "out"
                    return m.movement_type === "adjustment"
                  }).length}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Movements table */}
      {loading ? <LoadingSpinner /> : movements.length === 0 ? (
        <EmptyState icon={Package} title="Aucun mouvement enregistré" />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>{["Date","Produit","Référence","Type","Qté avant","Mouvement","Qté après","Prix U.","Créé par","Notes"].map(h=><th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody className="bg-white">
              {movements.map(m => (
                <tr key={m.id}>
                  <td className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                  <td className="font-medium text-gray-900">{m.product_name}</td>
                  <td className="font-mono text-xs text-gray-500">{m.product_reference}</td>
                  <td>
                    <span className={`flex items-center space-x-1.5 font-medium text-sm ${MOVEMENT_TYPES[m.movement_type]?.color || "text-gray-600"}`}>
                      {MOVEMENT_ICONS[m.movement_type]}
                      <span>{m.movement_type_display}</span>
                    </span>
                  </td>
                  <td className="text-center text-gray-500">{m.quantity_before}</td>
                  <td className="text-center">
                    <span className={`font-bold ${["in"].includes(m.movement_type) ? "text-green-600" : "text-red-600"}`}>
                      {["in"].includes(m.movement_type) ? "+" : "-"}{m.quantity}
                    </span>
                  </td>
                  <td className="text-center font-semibold text-gray-900">{m.quantity_after}</td>
                  <td className="text-sm">{formatCurrency(m.unit_price)}</td>
                  <td className="text-sm text-gray-600">{m.created_by_name}</td>
                  <td className="text-xs text-gray-400 max-w-xs truncate">{m.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={Math.ceil(total/20)} onPageChange={setPage} total={total} perPage={20} />
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="font-bold text-lg">Nouveau Mouvement de Stock</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produit *</label>
                <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                  className="input" required>
                  <option value="">Sélectionner un produit</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>[{p.reference}] {p.name} - Stock: {p.quantity}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de mouvement *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(MOVEMENT_TYPES).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setForm(f => ({ ...f, movement_type: k }))}
                      className={`p-2.5 rounded-lg border text-sm font-medium transition-all flex items-center space-x-2
                        ${form.movement_type === k ? "border-primary-700 bg-primary-50 text-primary-700" : "border-gray-200 hover:border-gray-300"}`}>
                      {MOVEMENT_ICONS[k]}
                      <span>{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.movement_type === "adjustment" ? "Nouveau stock *" : "Quantité *"}
                  </label>
                  <input type="number" min="1" value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix unitaire (FCFA)</label>
                  <input type="number" min="0" step="0.01" value={form.unit_price}
                    onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                    className="input" />
                </div>
              </div>
              {form.movement_type === "in" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                  <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} className="input">
                    <option value="">Aucun</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="input resize-none" />
              </div>
              <div className="flex justify-end space-x-3 pt-2 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
