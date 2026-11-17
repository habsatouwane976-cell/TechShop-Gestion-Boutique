
import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react"
import {
  clearCart,
  decreaseQuantity,
  addToCart,
  removeFromCart,
} from "../../store/slices/cartSlice"
import { authService } from "../../services/authService"
import { salesService } from "../../services/salesService"
import StoreHeader from "../../components/store/StoreHeader"
import toast from "react-hot-toast"
import StoreFooter from "../../components/store/StoreFooter"
import { PAYMENT_METHODS } from "../../utils/constants"

// Modes de paiement proposés au client. Wave, Orange Money et carte sont payés
// tout de suite : la commande est alors complétée automatiquement.
const ONLINE_METHODS = ["wave", "orange_money", "card"]
const CHECKOUT_METHODS = ["wave", "orange_money", "card", "cash"]

export default function ClientCart() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const items = useSelector(state => state.cart.items)
  const { isAuthenticated } = useSelector(state => state.auth)

  const [paymentMethod, setPaymentMethod] = useState("wave")
  const [payerPhone, setPayerPhone] = useState("")

  const [customer, setCustomer] = useState(null)
  const [loadingCustomer, setLoadingCustomer] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  useEffect(() => {
  async function loadCustomer() {
    if (!isAuthenticated) {
      setLoadingCustomer(false)
      return
    }
    try {
      const response = await authService.me()
      setCustomer(response.data)
      console.log(response.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingCustomer(false)
    }
  }

  loadCustomer()
}, [isAuthenticated])

  const formatPrice = price =>
    new Intl.NumberFormat("fr-FR").format(Number(price || 0))

  const total = items.reduce(
    (sum, item) =>
      sum + Number(item.selling_price || 0) * item.cartQuantity,
    0
  )

  const handleOrder = async () => {
    if (items.length === 0 || submitting) return

    // Le panier est visible sans compte, mais il faut se connecter pour commander
    if (!isAuthenticated) {
      navigate("/login", { state: { from: "/client/cart" } })
      return
    }

    const isOnline = ONLINE_METHODS.includes(paymentMethod)
    const needsPhone = paymentMethod === "wave" || paymentMethod === "orange_money"
    const phone = (payerPhone || customer?.phone || "").trim()

    if (needsPhone && !phone) {
      setError("Indiquez le numéro de téléphone utilisé pour le paiement.")
      return
    }

    setError("")
    setSuccess("")
    setSubmitting(true)

    const payload = {
      payment_method: paymentMethod,
      discount_percent: 0,
      tax_rate: 0,
      amount_paid: isOnline ? total : 0,
      delivery_status: "store",
      delivery_address: customer?.location_address || "",
      customer_phone: phone,
      notes: "Commande passée depuis l'espace client",
      items: items.map(item => ({
        product_id: item.id,
        quantity: item.cartQuantity,
        unit_price: Number(item.selling_price),
        discount_percent: 0,
      })),
    }

    try {
      const response = await salesService.create(payload)
      const sale = response.data

      setSuccess(
        sale?.status === "completed"
          ? `Paiement confirmé, commande complétée${
              sale?.invoice_number ? ` - ${sale.invoice_number}` : ""
            }.`
          : `Commande enregistrée avec succès${
              sale?.invoice_number ? ` - ${sale.invoice_number}` : ""
            }. Paiement à la livraison.`
      )

      dispatch(clearCart())

      setTimeout(() => {
        navigate("/client/products")
      }, 1800)
    } catch (err) {
      console.error("Erreur commande :", err)

      const data = err.response?.data

      if (typeof data === "string") {
        setError(data)
      } else if (data?.error) {
        setError(data.error)
      } else if (data?.detail) {
        setError(data.detail)
      } else if (data) {
        setError(JSON.stringify(data))
      } else {
        setError(
          "Impossible de passer la commande. Vérifiez que le serveur Django est démarré."
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StoreHeader showSearch={false} />

      <div className="max-w-6xl mx-auto w-full p-6 flex-1">
        <button
          onClick={() => navigate("/client/products")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Retour au catalogue
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-gray-500">Boutique</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">
              Mon panier
            </h1>
          </div>

          {items.length > 0 && (
            <button
              onClick={() => dispatch(clearCart())}
              className="text-red-600 hover:text-red-700"
              disabled={submitting}
            >
              Vider le panier
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
            {success}
          </div>
        )}

        {items.length === 0 && !success ? (
          <div className="bg-white rounded-2xl shadow p-16 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto" />

            <h2 className="text-xl font-bold text-gray-900 mt-5">
              Votre panier est vide
            </h2>

            <button
              onClick={() => navigate("/client/products")}
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl"
            >
              Voir les produits
            </button>
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {items.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl shadow p-5 flex gap-5"
                >
                  <div className="w-28 h-28 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <ShoppingCart className="w-10 h-10 text-gray-300" />
                    )}
                  </div>

                  <div className="flex-1">
                    <h2 className="font-bold text-gray-900">{item.name}</h2>

                    <p className="text-sm text-gray-500 mt-1">
                      Réf. {item.reference}
                    </p>

                    <p className="font-bold text-accent-600 mt-3">
                      {formatPrice(item.selling_price)} FCFA
                    </p>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center border rounded-xl">
                        <button
                          onClick={() =>
                            dispatch(decreaseQuantity(item.id))
                          }
                          className="p-2"
                          disabled={submitting}
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <span className="px-4 font-semibold">
                          {item.cartQuantity}
                        </span>

                        <button
                          onClick={() => {
                            const maxStock = Number(item.quantity)
                            if (!Number.isNaN(maxStock) && item.cartQuantity >= maxStock) {
                              toast.error("Quantité maximale en stock atteinte")
                              return
                            }
                            dispatch(addToCart(item))
                          }}
                          className="p-2"
                          disabled={submitting}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() =>
                          dispatch(removeFromCart(item.id))
                        }
                        className="text-red-500 hover:text-red-700"
                        disabled={submitting}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="bg-white rounded-2xl shadow p-6 sticky top-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Résumé
                </h2>

                <div className="flex justify-between mt-6 text-gray-600">
                  <span>Articles</span>
                  <span>
                    {items.reduce(
                      (sum, item) => sum + item.cartQuantity,
                      0
                    )}
                  </span>
                </div>

                <div className="border-t mt-6 pt-6 flex justify-between">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-accent-600">
                    {formatPrice(total)} FCFA
                  </span>
                </div>

                {isAuthenticated ? (
                  <div className="mt-6">
                    <p className="text-sm font-semibold text-gray-900 mb-2">
                      Mode de paiement
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {CHECKOUT_METHODS.map(method => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          disabled={submitting}
                          className={`rounded-xl border p-2 text-xs font-medium transition ${
                            paymentMethod === method
                              ? "border-[#f68b1e] bg-orange-50 text-gray-900"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          <img
                            src={PAYMENT_METHODS[method].icon}
                            alt=""
                            className="h-8 w-full object-contain mb-1"
                          />
                          {method === "cash"
                            ? "Espèces à la livraison"
                            : PAYMENT_METHODS[method].label}
                        </button>
                      ))}
                    </div>

                    {(paymentMethod === "wave" || paymentMethod === "orange_money") && (
                      <input
                        type="tel"
                        value={payerPhone}
                        onChange={event => setPayerPhone(event.target.value)}
                        placeholder={customer?.phone || "Numéro de téléphone du paiement"}
                        className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-[#f68b1e] focus:outline-none"
                      />
                    )}
                  </div>
                ) : (
                  <p className="mt-6 rounded-xl bg-orange-50 p-3 text-sm text-gray-700">
                    Connectez-vous ou créez un compte pour finaliser votre commande.
                    Votre panier est conservé.
                  </p>
                )}

                <button
                  onClick={handleOrder}
                  disabled={submitting}
                  className="w-full mt-6 bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold"
                >
                  {submitting
                    ? "Commande en cours..."
                    : !isAuthenticated
                    ? "Se connecter pour commander"
                    : ONLINE_METHODS.includes(paymentMethod)
                    ? `Payer ${formatPrice(total)} FCFA`
                    : "Passer la commande"}
                </button>

                {!isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => navigate("/register")}
                    className="w-full mt-2 text-sm font-medium text-[#f68b1e] hover:underline"
                  >
                    Créer un compte
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <StoreFooter />
    </div>
  )
}
