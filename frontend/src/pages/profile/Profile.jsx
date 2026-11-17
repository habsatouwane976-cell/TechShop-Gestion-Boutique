import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { useDispatch, useSelector } from "react-redux"
import { fetchCurrentUser, updateUser } from "../../store/slices/authSlice"
import { authService } from "../../services/authService"
import { useGeolocation } from "../../hooks/useGeolocation"
import PageHeader from "../../components/common/PageHeader"
import { ROLES } from "../../utils/constants"
import { formatDateTime } from "../../utils/formatters"
import { User, Lock, MapPin, Save, Shield } from "lucide-react"
import toast from "react-hot-toast"

export default function Profile() {
  const dispatch = useDispatch()
  const { user } = useSelector(s => s.auth)
  const [tab, setTab] = useState("info")
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, reset } = useForm()
  const { register: rPwd, handleSubmit: hPwd, reset: resetPwd, watch, formState: { errors: ePwd } } = useForm()
  const { position, address, loading: geoLoading, getCurrentPosition } = useGeolocation()
  const pwd = watch("new_password")

  useEffect(() => {
    if (user) reset({ first_name: user.first_name, last_name: user.last_name, phone: user.phone || "" })
  }, [user])

  const onInfo = async data => {
    setLoading(true)
    try {
      const payload = { ...data }
      if (position) { payload.latitude = position.latitude; payload.longitude = position.longitude }
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/auth/me/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        await dispatch(fetchCurrentUser())
        toast.success("Profil mis à jour !")
      }
    } catch { toast.error("Erreur") } finally { setLoading(false) }
  }

  const onPwd = async data => {
    setLoading(true)
    try {
      await authService.changePassword(data)
      toast.success("Mot de passe modifié !")
      resetPwd()
    } catch (err) { toast.error(err.response?.data?.error || "Erreur") } finally { setLoading(false) }
  }

  const TABS = [
    { k: "info", label: "Informations", icon: User },
    { k: "security", label: "Sécurité", icon: Lock },
    { k: "location", label: "Localisation", icon: MapPin },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Mon Profil" subtitle="Gérez vos informations personnelles" />

      {/* Profile card */}
      <div className="card flex items-center space-x-5">
        <div className="w-16 h-16 bg-primary-700 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{user?.first_name} {user?.last_name}</h2>
          <p className="text-gray-500 text-sm">{user?.email}</p>
          <div className="flex items-center space-x-2 mt-2">
            <span className={`badge ${ROLES[user?.role]?.color}`}>
              <Shield className="w-3 h-3 inline mr-1" />{ROLES[user?.role]?.label}
            </span>
            {user?.last_login && (
              <span className="text-xs text-gray-400">Dernière connexion: {formatDateTime(user.last_login)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-all
              ${tab === k ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon className="w-4 h-4" /><span>{label}</span>
          </button>
        ))}
      </div>

      {tab === "info" && (
        <form onSubmit={handleSubmit(onInfo)} className="card space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input {...register("first_name")} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input {...register("last_name")} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input {...register("phone")} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input value={user?.email || ""} disabled className="input bg-gray-50 text-gray-400" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            <Save className="w-4 h-4" />{loading ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      )}

      {tab === "security" && (
        <form onSubmit={hPwd(onPwd)} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ancien mot de passe *</label>
            <input type="password" {...rPwd("old_password", { required: "Requis" })} className="input" />
            {ePwd.old_password && <p className="text-red-500 text-xs mt-1">{ePwd.old_password.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe *</label>
            <input type="password" {...rPwd("new_password", { required: "Requis", minLength: { value: 8, message: "Min 8 caractères" } })} className="input" />
            {ePwd.new_password && <p className="text-red-500 text-xs mt-1">{ePwd.new_password.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer *</label>
            <input type="password" {...rPwd("new_password2", { validate: v => v === pwd || "Mots de passe différents" })} className="input" />
            {ePwd.new_password2 && <p className="text-red-500 text-xs mt-1">{ePwd.new_password2.message}</p>}
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            <Lock className="w-4 h-4" />{loading ? "Modification…" : "Modifier le mot de passe"}
          </button>
        </form>
      )}

      {tab === "location" && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <MapPin className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-800 text-sm">
                  {address || user?.location_address || "Aucune localisation enregistrée"}
                </p>
                {(position || user?.latitude) && (
                  <p className="text-xs text-blue-500 mt-0.5">
                    Lat: {position?.latitude || user?.latitude} - Lng: {position?.longitude || user?.longitude}
                  </p>
                )}
              </div>
            </div>
            <button onClick={getCurrentPosition} disabled={geoLoading}
              className="btn-primary btn-sm">
              {geoLoading ? "…" : "Me localiser"}
            </button>
          </div>
          {position && (
            <button onClick={() => onInfo({ first_name: user?.first_name, last_name: user?.last_name })}
              className="btn-success w-full justify-center">
              <Save className="w-4 h-4" /> Enregistrer ma position
            </button>
          )}
          <p className="text-xs text-gray-400 text-center">
            La géolocalisation permet de situer votre boutique sur la carte.
          </p>
        </div>
      )}
    </div>
  )
}

