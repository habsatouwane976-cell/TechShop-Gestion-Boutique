import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authService } from "../../services/authService";
import { useGeolocation } from "../../hooks/useGeolocation";
import logo from "../../assets/logo.png";

const Register = () => {
  const navigate = useNavigate();
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { position, loading: locating, error: geoError, getCurrentPosition } = useGeolocation();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      password: "",
      password2: "",
      address: "",
      city: "",
      latitude: "",
      longitude: "",
    },
  });

  const password = watch("password");

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleGeolocation = () => {
    getCurrentPosition();
  };

  useEffect(() => {
    if (position) {
      setValue("latitude", position.latitude.toFixed(6));
      setValue("longitude", position.longitude.toFixed(6));
    }
  }, [position, setValue]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("phone", values.phone);
      formData.append("email", values.email);
      formData.append("password", values.password);
      formData.append("password2", values.password2);
      formData.append("address", values.address);
      formData.append("city", values.city);
      if (values.latitude) formData.append("latitude", values.latitude);
      if (values.longitude) formData.append("longitude", values.longitude);
      if (photoFile) formData.append("photo", photoFile);

      const res = await authService.register(formData);
      toast.success(
        res.data?.message ||
          "Compte créé avec succès. Un e-mail de confirmation vous a été envoyé.",
        { duration: 7000 }
      );
      navigate("/login");
    } catch (error) {
      const data = error.response?.data;
      if (data && typeof data === "object") {
        Object.values(data).forEach((messages) => {
          const message = Array.isArray(messages) ? messages[0] : messages;
          toast.error(String(message));
        });
      } else {
        toast.error("Une erreur est survenue lors de l'inscription.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <img src={logo} alt="TechShop Electronics" className="h-16 w-16 rounded-2xl object-contain" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Créer un compte</h1>
          <p className="text-gray-500 mt-2">Rejoignez TechShop Electronics dès aujourd'hui</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
              {photoPreview ? (
                <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400 text-center px-2">Photo de profil</span>
              )}
            </div>
            <label className="cursor-pointer text-sm font-medium text-accent-600 hover:text-accent-700">
              Choisir une photo
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
              <input
                type="text"
                {...register("name", { required: "Le nom complet est requis" })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                placeholder="Amadou Diop"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                type="tel"
                {...register("phone", {
                  required: "Le téléphone est requis",
                  pattern: { value: /^[0-9+ ]{9,15}$/, message: "Numéro de téléphone invalide" },
                })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                placeholder="77 123 45 67"
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              {...register("email", {
                required: "L'email est requis",
                pattern: { value: /^\S+@\S+\.\S+$/, message: "Email invalide" },
              })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
              placeholder="exemple@email.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input
                type="password"
                {...register("password", {
                  required: "Le mot de passe est requis",
                  minLength: { value: 8, message: "8 caractères minimum" },
                })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                placeholder="••••••••"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
              <input
                type="password"
                {...register("password2", {
                  required: "Veuillez confirmer le mot de passe",
                  validate: (value) => value === password || "Les mots de passe ne correspondent pas",
                })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                placeholder="••••••••"
              />
              {errors.password2 && <p className="text-red-500 text-xs mt-1">{errors.password2.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <input
              type="text"
              {...register("address", { required: "L'adresse est requise" })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
              placeholder="Rue 10, Sacré-Cœur"
            />
            {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
            <input
              type="text"
              {...register("city", { required: "La ville est requise" })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
              placeholder="Dakar"
            />
            {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Position GPS</span>
              <button
                type="button"
                onClick={handleGeolocation}
                disabled={locating}
                className="text-sm font-medium text-accent-600 hover:text-accent-700 disabled:opacity-50"
              >
                {locating ? "Localisation..." : "Utiliser ma position actuelle"}
              </button>
            </div>
            {geoError && <p className="text-red-500 text-xs mb-2">{geoError}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                <input
                  type="text"
                  readOnly
                  {...register("latitude")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 text-sm"
                  placeholder="Non renseignée"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                <input
                  type="text"
                  readOnly
                  {...register("longitude")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 text-sm"
                  placeholder="Non renseignée"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent-600 hover:bg-accent-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {submitting ? "Création du compte..." : "Créer mon compte"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Vous avez déjà un compte ?{" "}
          <Link to="/login" className="text-accent-600 font-medium hover:text-accent-700">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
