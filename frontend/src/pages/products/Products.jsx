import { useState, useEffect, useCallback } from "react"
import { productsService } from "../../services/productsService"
import { useAuth } from "../../hooks/useAuth"
import { useForm } from "react-hook-form"
import PageHeader from "../../components/common/PageHeader"
import SearchInput from "../../components/common/SearchInput"
import LoadingSpinner from "../../components/common/LoadingSpinner"
import ConfirmModal from "../../components/common/ConfirmModal"
import EmptyState from "../../components/common/EmptyState"
import Pagination from "../../components/common/Pagination"
import { formatCurrency } from "../../utils/formatters"
import { Plus, Pencil, Trash2, AlertTriangle, Package, X, Image } from "lucide-react"
import toast from "react-hot-toast"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

export default function Products() {
  const { canManage } = useAuth()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [lowStockFilter, setLowStockFilter] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm()

  const PER_PAGE = 20

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, search }
      if (categoryFilter) params.category = categoryFilter
      if (lowStockFilter) params.low_stock = "true"
      const res = await productsService.getAll(params)
      const d = res.data
      if (d.results) { setProducts(d.results); setTotal(d.count) }
      else { setProducts(d); setTotal(d.length) }
    } finally { setLoading(false) }
  }, [page, search, categoryFilter, lowStockFilter])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => {
    productsService.getCategories().then(r => setCategories(r.data.results || r.data))
  }, [])

  const openCreate = () => { setEditItem(null); reset({}); setShowModal(true) }
  const openEdit = p => {
    setEditItem(p)
    reset({
      name: p.name, description: p.description, barcode: p.barcode,
      purchase_price: p.purchase_price, selling_price: p.selling_price,
      quantity: p.quantity, min_stock: p.min_stock, unit: p.unit,
      category: p.category, reference: p.reference,
    })
    setShowModal(true)
  }

  const onSubmit = async data => {
    const fd = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (k === "image" && v?.[0]) fd.append("image", v[0])
      else if (v !== undefined && v !== "" && k !== "image") fd.append(k, v)
    })
    try {
      if (editItem) {
        await productsService.update(editItem.id, fd)
        toast.success("Produit modifié !")
      } else {
        await productsService.create(fd)
        toast.success("Produit créé !")
      }
      setShowModal(false)
      fetchProducts()
    } catch (err) {
      toast.error(Object.values(err.response?.data || {}).flat().join(", ") || "Erreur")
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await productsService.delete(deleteId)
      toast.success("Produit supprimé !")
      setDeleteId(null)
      fetchProducts()
    } catch { toast.error("Impossible de supprimer") }
    finally { setDeleting(false) }
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Produits"
        subtitle={`${total} produit(s) en catalogue`}
        actions={canManage && (
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Nouveau produit
          </button>
        )}
      />

      {/* Filters */}
      <div className="card py-4">
        <div className="flex flex-wrap gap-3">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }}
            placeholder="Rechercher produit, référence…" className="w-64" />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="input w-auto">
            <option value="">Toutes catégories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <label className="flex items-center space-x-2 cursor-pointer px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <input type="checkbox" checked={lowStockFilter}
              onChange={e => setLowStockFilter(e.target.checked)}
              className="rounded w-4 h-4" />
            <AlertTriangle className="w-4 h-4" />
            <span>Stock bas uniquement</span>
          </label>
        </div>
      </div>

      {/* Table */}
      {loading ? <LoadingSpinner /> : products.length === 0 ? (
        <EmptyState icon={Package} title="Aucun produit trouvé"
          description="Ajoutez votre premier produit pour commencer."
          action={canManage && <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Ajouter un produit
          </button>} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                {["Image","Réf.","Produit","Catégorie","Prix Achat","Prix Vente","Stock","Marge","Statut","Actions"].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {products.map(p => (
                <tr key={p.id}>
                  <td>
<div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
    {p.image ? (
      <img
        src={p.image.startsWith("http")
          ? p.image
          : `http://localhost:8000${p.image}`}
        alt={p.name}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          console.log("Image introuvable :", p.image)
          e.target.style.display = "none"
        }}
      />
    ) : (
      <Package className="w-6 h-6 text-gray-400" />
    )}
  </div>
</td>
                  <td className="font-mono text-xs text-gray-500">{p.reference}</td>
                  <td>
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.unit}</p>
                  </td>
                  <td>
                    <span className="text-xs">{p.category_name || "-"}</span>
                  </td>
                  <td className="font-medium">{formatCurrency(p.purchase_price)}</td>
                  <td className="font-semibold text-primary-700">{formatCurrency(p.selling_price)}</td>
                  <td>
                    <span className={`badge ${
                      p.quantity === 0 ? "bg-red-100 text-red-700"
                      : p.is_low_stock ? "bg-orange-100 text-orange-700"
                      : "bg-green-100 text-green-700"
                    }`}>
                      {p.quantity === 0 ? "Rupture" : (
                        p.is_low_stock
                          ? <><AlertTriangle className="w-3 h-3 inline mr-0.5" />{p.quantity}</>
                          : p.quantity
                      )}
                    </span>
                  </td>
                  <td className="text-emerald-600 font-medium">{p.margin?.toFixed(1)}%</td>
                  <td>
                    <span className={`badge ${p.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.is_active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td>
                    {canManage && (
                      <div className="flex space-x-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteId(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage}
              total={total} perPage={PER_PAGE} />
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="font-bold text-lg">{editItem ? "Modifier" : "Nouveau"} Produit</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du produit *</label>
                <input {...register("name", { required: "Requis" })} className="input" placeholder="Ex: Riz Parfumé 5kg" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Référence</label>
                <input {...register("reference")} className="input" placeholder="Auto si vide" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                <select {...register("category", { required: "Requis" })} className="input">
                  <option value="">Sélectionner</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix d achat (FCFA) *</label>
                <input type="number" step="0.01" {...register("purchase_price", { required: "Requis", min: 0 })} className="input" />
                {errors.purchase_price && <p className="text-red-500 text-xs mt-1">{errors.purchase_price.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (FCFA) *</label>
                <input type="number" step="0.01" {...register("selling_price", { required: "Requis", min: 0 })} className="input" />
                {errors.selling_price && <p className="text-red-500 text-xs mt-1">{errors.selling_price.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
                <input type="number" {...register("quantity", { required: "Requis", min: 0 })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock minimum *</label>
                <input type="number" {...register("min_stock", { required: "Requis", min: 0 })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
                <input {...register("unit")} className="input" placeholder="unité, kg, L…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code-barres</label>
                <input {...register("barcode")} className="input" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea {...register("description")} rows={2} className="input resize-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Image du produit</label>
                <input type="file" accept="image/*" {...register("image")}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
              </div>
              <div className="col-span-2 flex justify-end space-x-3 pt-2 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" className="btn-primary">{editItem ? "Modifier" : "Créer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        loading={deleting} title="Supprimer le produit"
        message="Cette action est irréversible. Le produit sera définitivement supprimé."
        confirmText="Supprimer" danger />
    </div>
  )
}

