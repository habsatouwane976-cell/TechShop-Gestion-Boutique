import { useState, useEffect } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useForm } from "react-hook-form"
import { useDispatch, useSelector } from "react-redux"
import { loginUser, clearError } from "../../store/slices/authSlice"
import { useGeolocation } from "../../hooks/useGeolocation"
import { Eye, EyeOff, MapPin } from "lucide-react"
import toast from "react-hot-toast"
import logo from "../../assets/logo.png"

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || "/"
  const { loading, error, isAuthenticated } = useSelector(s => s.auth)
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [showPwd, setShowPwd] = useState(false)
  const { position, address, loading: geoLoading, getCurrentPosition } = useGeolocation()

  useEffect(() => { dispatch(clearError()) }, [])
  useEffect(() => {
    if (isAuthenticated) navigate(redirectTo, { replace: true })
  }, [isAuthenticated])

  const onSubmit = async data => {
    const payload = { ...data }
    if (position) {
      payload.latitude = position.latitude
      payload.longitude = position.longitude
    }
    const res = await dispatch(loginUser(payload))
    if (loginUser.fulfilled.match(res)) {
      toast.success(`Bienvenue ${res.payload.user.first_name} !`)
      navigate(redirectTo)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mini en-tête */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src={logo} alt="TechShop Electronics" className="h-10 w-10 rounded-xl object-contain" />
            <span className="font-bold text-gray-900">
              TechShop <span className="text-accent-600">Electronics</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Connexion</h1>
            <p className="text-gray-500 text-sm mt-1">
              Accédez à votre compte TechShop Electronics
            </p>
          </div>

          {/* Formulaire */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Adresse Email
                </label>
                <input
                  type="email"
                  {...register("email", { required: "Email requis" })}
                  placeholder="admin@boutique.sn"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent text-sm"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    {...register("password", { required: "Mot de passe requis" })}
                    placeholder="••••••••"
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent text-sm pr-12"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              {/* Géolocalisation optionnelle */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    {address || (position ? "Position obtenue ✓" : "Localisation optionnelle")}
                  </span>
                </div>
                <button type="button" onClick={getCurrentPosition} disabled={geoLoading}
                  className="text-xs text-accent-600 hover:text-accent-700 underline">
                  {geoLoading ? "…" : "Me localiser"}
                </button>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-accent-600 hover:bg-accent-700 text-white font-semibold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 mt-2">
                {loading ? "Connexion en cours…" : "Se connecter"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Pas encore de compte ?{" "}
              <Link to="/register" className="text-accent-600 font-medium hover:text-accent-700">
                Créer un compte
              </Link>
            </p>

            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-center text-xs text-gray-400 mb-3">Comptes de démonstration</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { role: "Admin", email: "admin@boutique.sn" },
                  { role: "Manager", email: "manager@boutique.sn" },
                  { role: "Caissier", email: "caissier@boutique.sn" },
                ].map(c => (
                  <div key={c.role} className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                    <p className="font-semibold text-primary-700">{c.role}</p>
                    <p className="text-gray-500 truncate">{c.email}</p>
                    <p className="text-gray-500">Pass@1234</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
