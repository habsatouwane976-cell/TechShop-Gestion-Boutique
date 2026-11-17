import { useState, useEffect } from "react"
import { usersService } from "../../services/usersService"
import { useForm } from "react-hook-form"
import PageHeader from "../../components/common/PageHeader"
import SearchInput from "../../components/common/SearchInput"
import LoadingSpinner from "../../components/common/LoadingSpinner"
import ConfirmModal from "../../components/common/ConfirmModal"
import EmptyState from "../../components/common/EmptyState"
import { ROLES } from "../../utils/constants"
import { formatDate } from "../../utils/formatters"
import { Plus, Pencil, Trash2, UserCog, X, Shield } from "lucide-react"
import toast from "react-hot-toast"

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const fetch = () => {
    setLoading(true)
    usersService.getAll({ search }).then(r => setUsers(r.data.results || r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { fetch() }, [search])

  const openCreate = () => { setEditItem(null); reset({}); setShowModal(true) }
  const openEdit = u => { setEditItem(u); reset({ first_name: u.first_name, last_name: u.last_name, email: u.email, phone: u.phone, role: u.role }); setShowModal(true) }

  const onSubmit = async data => {
    try {
      if (editItem) { await usersService.update(editItem.id, data); toast.success("Utilisateur modifié !") }
      else { await usersService.create(data); toast.success("Utilisateur créé !") }
      setShowModal(false); fetch()
    } catch (err) { toast.error(Object.values(err.response?.data || {}).flat().join(", ") || "Erreur") }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await usersService.delete(deleteId); toast.success("Utilisateur supprimé !"); setDeleteId(null); fetch() }
    catch { toast.error("Impossible de supprimer") }
    finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Gestion des Utilisateurs" subtitle={`${users.length} utilisateur(s)`}
        actions={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" />Nouvel utilisateur</button>} />
      <div className="card py-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher nom, email…" className="max-w-sm" />
      </div>
      {loading ? <LoadingSpinner /> : users.length === 0 ? (
        <EmptyState icon={UserCog} title="Aucun utilisateur"
          action={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" />Ajouter</button>} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr>{["Utilisateur","Email","Téléphone","Rôle","Dernière connexion","Statut","Actions"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody className="bg-white">
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm">
                        {u.first_name?.[0]}{u.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-gray-400">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-gray-600">{u.email}</td>
                  <td className="text-sm text-gray-600">{u.phone || "-"}</td>
                  <td>
                    <span className={`badge ${ROLES[u.role]?.color || "bg-gray-100 text-gray-600"}`}>
                      <Shield className="w-3 h-3 inline mr-1" />{ROLES[u.role]?.label || u.role}
                    </span>
                  </td>
                  <td className="text-xs text-gray-500">{u.last_login ? formatDate(u.last_login) : "Jamais"}</td>
                  <td>
                    <span className={`badge ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {u.is_active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td>
                    <div className="flex space-x-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(u.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="font-bold text-lg">{editItem ? "Modifier" : "Nouvel"} Utilisateur</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                <input {...register("first_name", { required: "Requis" })} className="input" />
                {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>}</div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input {...register("last_name", { required: "Requis" })} className="input" />
                {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>}</div>
              <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" {...register("email", { required: "Requis" })} className="input" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}</div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nom d utilisateur *</label>
                <input {...register("username", { required: !editItem ? "Requis" : false })} className="input" disabled={!!editItem} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input {...register("phone")} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
                <select {...register("role", { required: "Requis" })} className="input">
                  <option value="cashier">Caissier</option>
                  <option value="manager">Gestionnaire</option>
                  <option value="admin">Administrateur</option>
                </select></div>
              {!editItem && (
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                  <input type="password" {...register("password", { required: !editItem ? "Requis" : false, minLength: { value: 8, message: "Min 8 caractères" } })} className="input" />
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}</div>
              )}
              {!editItem && (
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
                  <input type="password" {...register("password2")} className="input" /></div>
              )}
              <div className="col-span-2 flex justify-end space-x-3 pt-2 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" className="btn-primary">{editItem ? "Modifier" : "Créer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        loading={deleting} title="Supprimer l utilisateur" message="Cet utilisateur sera définitivement supprimé."
        confirmText="Supprimer" danger />
    </div>
  )
}
