import { useState, useEffect } from "react"
import { customersService } from "../../services/customersService"
import { useAuth } from "../../hooks/useAuth"
import { useForm } from "react-hook-form"
import { useGeolocation } from "../../hooks/useGeolocation"
import PageHeader from "../../components/common/PageHeader"
import SearchInput from "../../components/common/SearchInput"
import LoadingSpinner from "../../components/common/LoadingSpinner"
import ConfirmModal from "../../components/common/ConfirmModal"
import EmptyState from "../../components/common/EmptyState"
import Pagination from "../../components/common/Pagination"
import { formatCurrency, formatDate } from "../../utils/formatters"
import { Plus, Pencil, Trash2, Users, MapPin, Phone, Mail, X } from "lucide-react"
import toast from "react-hot-toast"

export default function Customers() {
  const { canManage } = useAuth()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm()
  const { position, address, loading: geoLoading, getCurrentPosition } = useGeolocation()

  const fetch = () => {
    setLoading(true)
    customersService.getAll({ page, search })
      .then(r => {
        const d = r.data
        if (d.results) { setCustomers(d.results); setTotal(d.count) }
        else { setCustomers(d); setTotal(d.length) }
      }).finally(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [page, search])

  useEffect(() => {
    if (position && showModal) {
      setValue("latitude", position.latitude)
      setValue("longitude", position.longitude)
    }
  }, [position])

  const openCreate = () => { setEditItem(null); reset({}); setShowModal(true) }
  const openEdit = c => {
    setEditItem(c)
    reset({ name: c.name, phone: c.phone, email: c.email, address: c.address, city: c.city, notes: c.notes })
    setShowModal(true)
  }

  const onSubmit = async data => {
    if (position && !editItem) {
      data.latitude = position.latitude
      data.longitude = position.longitude
    }
    try {
      if (editItem) { await customersService.update(editItem.id, data); toast.success("Client modifié !") }
      else { await customersService.create(data); toast.success("Client ajouté !") }
      setShowModal(false); fetch()
    } catch (err) {
    console.log(err.response?.data)

    toast.error(
      err.response?.data?.password?.[0] ||
      err.response?.data?.email?.[0] ||
      err.response?.data?.phone?.[0] ||
      err.response?.data?.name?.[0] ||
      "Erreur"
    )
  }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await customersService.delete(deleteId); toast.success("Client supprimé !"); setDeleteId(null); fetch() }
    catch { toast.error("Impossible de supprimer") }
    finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Clients"
        subtitle={`${total} client(s) enregistré(s)`}
        actions={canManage && (
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Nouveau client
          </button>
        )}
      />
      <div className="card py-4">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Rechercher nom, téléphone, email…" className="max-w-sm" />
      </div>
      {loading ? <LoadingSpinner /> : customers.length === 0 ? (
        <EmptyState icon={Users} title="Aucun client trouvé"
          action={canManage && <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" />Ajouter</button>} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>{["Nom","Téléphone","Email","Ville","Achats","Total dépensé","Actions"].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody className="bg-white">
              {customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{c.name}</p>
                        {c.latitude && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />Géolocalisé</p>}
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-gray-600">{c.phone || "-"}</td>
                  <td className="text-sm text-gray-600">{c.email || "-"}</td>
                  <td className="text-sm text-gray-600">{c.city || "-"}</td>
                  <td><span className="badge bg-blue-100 text-blue-700">{c.total_purchases} ventes</span></td>
                  <td className="font-semibold text-emerald-600">{formatCurrency(c.total_spent)}</td>
                  <td>
                    {canManage && (
                      <div className="flex space-x-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="font-bold text-lg">{editItem ? "Modifier" : "Nouveau"} Client</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                <input {...register("name", { required: "Requis" })} className="input" placeholder="Moussa Diallo" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input {...register("phone")} className="input" placeholder="+221 77 000 00 00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" {...register("email")} className="input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input {...register("address")} className="input" placeholder="Médina, Dakar" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                <input {...register("city")} className="input" placeholder="Dakar" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea {...register("notes")} rows={2} className="input resize-none" />
              </div>
              {!editItem && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700">
                      {address || (position ? "Position obtenue ✓" : "Localisation optionnelle")}
                    </span>
                  </div>
                  <button type="button" onClick={getCurrentPosition} disabled={geoLoading}
                    className="text-xs text-blue-600 hover:underline font-medium">
                    {geoLoading ? "Recherche…" : "Localiser"}
                  </button>
                </div>
              )}
              <input type="hidden" {...register("latitude")} />
              <input type="hidden" {...register("longitude")} />
              <div className="flex justify-end space-x-3 pt-2 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" className="btn-primary">{editItem ? "Modifier" : "Ajouter"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        loading={deleting} title="Supprimer le client" message="Ce client sera définitivement supprimé."
        confirmText="Supprimer" danger />
    </div>
  )
}
