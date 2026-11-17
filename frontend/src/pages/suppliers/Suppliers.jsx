import { useState, useEffect } from "react"
import { suppliersService } from "../../services/suppliersService"
import { useAuth } from "../../hooks/useAuth"
import { useForm } from "react-hook-form"
import PageHeader from "../../components/common/PageHeader"
import SearchInput from "../../components/common/SearchInput"
import LoadingSpinner from "../../components/common/LoadingSpinner"
import ConfirmModal from "../../components/common/ConfirmModal"
import EmptyState from "../../components/common/EmptyState"
import { formatCurrency } from "../../utils/formatters"
import { Plus, Pencil, Trash2, Truck, X } from "lucide-react"
import toast from "react-hot-toast"

export default function Suppliers() {
  const { canManage } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const fetch = () => {
    setLoading(true)
    suppliersService.getAll({ search })
      .then(r => setSuppliers(r.data.results || r.data))
      .finally(() => setLoading(false))
  }
  useEffect(() => { fetch() }, [search])

  const openCreate = () => { setEditItem(null); reset({}); setShowModal(true) }
  const openEdit = s => { setEditItem(s); reset(s); setShowModal(true) }

  const onSubmit = async data => {
    try {
      if (editItem) { await suppliersService.update(editItem.id, data); toast.success("Fournisseur modifié !") }
      else { await suppliersService.create(data); toast.success("Fournisseur ajouté !") }
      setShowModal(false); fetch()
    } catch { toast.error("Erreur") }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await suppliersService.delete(deleteId); toast.success("Supprimé !"); setDeleteId(null); fetch() }
    catch { toast.error("Impossible de supprimer") }
    finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Gestion des Fournisseurs" subtitle={`${suppliers.length} fournisseur(s)`}
        actions={canManage && <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" />Nouveau fournisseur</button>} />
      <div className="card py-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher nom, contact…" className="max-w-sm" />
      </div>
      {loading ? <LoadingSpinner /> : suppliers.length === 0 ? (
        <EmptyState icon={Truck} title="Aucun fournisseur"
          action={canManage && <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" />Ajouter</button>} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr>{["Fournisseur","Contact","Téléphone","Email","Ville","Appros","Total Achats","Actions"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody className="bg-white">
              {suppliers.map(s => (
                <tr key={s.id}>
                  <td><p className="font-medium text-gray-900">{s.name}</p></td>
                  <td className="text-sm text-gray-600">{s.contact_person || "-"}</td>
                  <td className="text-sm">{s.phone || "-"}</td>
                  <td className="text-sm text-gray-600">{s.email || "-"}</td>
                  <td className="text-sm text-gray-600">{s.city || "-"}</td>
                  <td><span className="badge bg-blue-100 text-blue-700">{s.total_supplies}</span></td>
                  <td className="font-semibold text-emerald-600">{formatCurrency(s.total_supply_amount)}</td>
                  <td>{canManage && (
                    <div className="flex space-x-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="font-bold text-lg">{editItem ? "Modifier" : "Nouveau"} Fournisseur</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du fournisseur *</label>
                <input {...register("name", { required: "Requis" })} className="input" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Personne contact</label><input {...register("contact_person")} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label><input {...register("phone")} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" {...register("email")} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Ville</label><input {...register("city")} className="input" /></div>
              <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label><textarea {...register("address")} rows={2} className="input resize-none" /></div>
              <div className="col-span-2 flex justify-end space-x-3 pt-2 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" className="btn-primary">{editItem ? "Modifier" : "Ajouter"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        loading={deleting} title="Supprimer le fournisseur" message="Ce fournisseur sera supprimé définitivement."
        confirmText="Supprimer" danger />
    </div>
  )
}
